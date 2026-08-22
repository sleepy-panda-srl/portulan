#!/usr/bin/env node
// `compile` — the enforcement compiler.
//
//   node cli/compile.mjs [--workspace <dir>] [--check] [--matrix]
//
// Exit 0 wrote (or, with --check, agrees) · 1 an artifact has drifted · 2 could not run.
//
// Reads a workspace's gate policy (`gates.json`) and emits enforcement, for two backends: the Claude
// Code host (`permissions` + `hooks`) and the GitHub repository ruleset that is the platform floor.
// `--matrix` prints every rule against both. The tier vocabulary and the action vocabulary are the
// WORKSPACE's, never a host's — a rule says `{"shell": "git push"}`, not `Bash(git push:*)` — which is
// what let the second backend translate the same policy instead of forcing every adopter to rewrite
// theirs. That separation is the whole of "LLM-agnostic by construction" (../docs/vision.md) at this
// layer, and the second backend is where it stopped being a claim.
//
// ## Two layers, and which one is load-bearing
//
// Every gate is emitted TWICE: as a permission rule and as a hook. That is not belt-and-braces for
// its own sake — it was measured. On CLI 2.1.220 a hook that CRASHES fails OPEN: the tool runs
// normally, on the identical wiring that blocked when the hook was healthy. A permission rule does
// not fail open. So the permission rule is the gate and the hook is the sentence a human reads;
// a design resting on hooks alone would be a gate that a syntax error silently removes.
//
// ## Why `ask` rather than `deny` for the Gated tier
//
// ../.portulan/gate-map.md defines Gated as "explicit human approval, per action, before it
// happens" — which is what `ask` is: interactively it prompts; headless, where nobody can approve,
// it blocks. Compiling Gated to `deny` would be the *prohibition* semantics wearing the Gated
// tier's name, and it would make the tier above it — the constitution, which has no approval path
// at all — indistinguishable from an ordinary push.
//
// ## What this file cannot tell you
//
// That the host honours what it emits. A schema-valid settings file the host ignores is
// indistinguishable, from in here, from one it enforces — see
// ../.portulan/memory/a-manifest-field-can-validate-and-load-nothing.md, which cost a milestone.
// The host behaviours above were measured against a running host on 2026-07-27 and are recorded in
// ../.portulan/compile/README.md with their probes. Re-measure on upgrade.
//
// Zero dependencies, no network, no install step — same constraints as ./doctor.mjs.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// Host plugin-cache discovery (#123). The record reader, the config directory and the version refusal
// all live there, once — see that file's pack-root section for why this half arrived separately.
import { AUTO, discoverPackRoots, namedWithAuto, resolutionRoots } from "./discover.mjs";
import { isInside } from "./inside.mjs";

/** Raised when `compile` cannot run, or cannot compile honestly. Always exit 2, never 1. */
export class CompileError extends Error {
    constructor(message) {
        super(message);
        this.name = "CompileError";
    }
}

// The GATE-POLICY spec versions this compiler understands — `gates.json`'s `portulan.spec`, which is a
// different train from the Workspace Definition's despite the overlapping numbers. Checked
// rather than ignored: `doctor` shipped for a day reading no version at all, so a manifest naming a
// spec that had never existed validated green. Same class of hole, closed at birth this time.
//
// 2.1 stays known: the `floor` key 2.2 adds is optional, so a 2.1 policy is still a policy this
// compiler reads correctly — it simply declares no floor, which is a legitimate shape and the one
// every workspace had yesterday.
//
// **These are GATE-POLICY versions, not Workspace Definition versions**, and the name is about to be
// misread by someone: the numbers overlap (`gates.json` is on 2.x and so is the Workspace Definition),
// the constant is spelled the same as ./index.mjs's and ./librarian.mjs's, and those two DO track the
// Workspace Definition. A fresh reviewer at milestone 6 session 1 sight-read this as a carrier left
// stale by the 2.5 → 2.6 bump and had to measure to clear it. It is correctly untouched by any
// Workspace Definition bump; renamed to say so, because the next reader may not measure.
const KNOWN_GATE_POLICY_SPECS = new Set(["2.1", "2.2"]);

const TIERS = new Set(["auto", "propose", "gated", "prohibited"]);

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// The `filePath` shape from ../spec/workspace.schema.json, carried here rather than imported because
// this file has no dependencies by design. Relative, no fragment/query/colon, not a directory.
const FILE_PATH = /^[^#?:/]([^#?:]*[^#?:/])?$/;

/** The tools that can write a path, and the tools that can read one. */
const WRITE_TOOLS = ["Edit", "Write", "NotebookEdit"];
const READ_TOOLS = ["Read"];

// ===========================================================================================
// 1. Parse: policy -> validated, normalised rules. NO backend opinion lives here.
// ===========================================================================================

/**
 * Read a gate policy and hand back `{ rules, floor }` — validated and normalised, with every rule
 * carrying its `kind` and `target` resolved, and nothing yet decided about enforcement.
 *
 * Anything it cannot understand refuses the WHOLE policy rather than dropping one rule — skipping
 * and enforcing are indistinguishable from outside
 * (../.portulan/memory/a-checker-must-refuse-what-it-cannot-check.md).
 *
 * **Why this stage holds no tier partition.** For one session it did: `auto` and `propose` were
 * refused here, before any backend ran, with a sentence saying `propose` "is enforced by the
 * platform floor". That sentence was right and its location was wrong — it names the *other*
 * backend, and when that backend arrived it needed to compile exactly the rules this stage had
 * already thrown away. A partition that is one backend's opinion must live in that backend, or the
 * second one is structurally incapable of disagreeing.
 */
export function parse(policy) {
    if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
        throw new CompileError("the gate policy is not a JSON object");
    }
    const spec = policy.portulan?.spec;
    if (!KNOWN_GATE_POLICY_SPECS.has(String(spec))) {
        throw new CompileError(
            `gate policy declares gate-policy spec ${JSON.stringify(spec)}, which this compiler does not implement ` +
                `(knows: ${[...KNOWN_GATE_POLICY_SPECS].join(", ")}). Refusing rather than compiling a policy it may misread.`,
        );
    }
    if (!Array.isArray(policy.rules) || policy.rules.length === 0) {
        throw new CompileError("the gate policy declares no rules — refusing to emit an artifact that gates nothing");
    }

    const rules = [];
    const seen = new Set();

    for (const rule of policy.rules) {
        const id = rule?.id;
        if (typeof id !== "string" || !SLUG.test(id)) {
            throw new CompileError(`rule id ${JSON.stringify(id)} is not a slug — ids are referenced from prose and must be greppable`);
        }
        if (seen.has(id)) throw new CompileError(`duplicate rule id \`${id}\` — one id, one rule, or the gate map cannot cite either`);
        seen.add(id);

        if (!TIERS.has(rule.tier)) {
            throw new CompileError(
                `rule \`${id}\` declares tier ${JSON.stringify(rule.tier)}, which is not one of ${[...TIERS].join(" / ")}. ` +
                    `An unrecognised tier is not a rule to skip — skipping it would silently un-gate whatever it names.`,
            );
        }
        if (typeof rule.reason !== "string" || rule.reason.trim().length === 0) {
            throw new CompileError(`rule \`${id}\` carries no reason — a gate with no sentence to show a human is not finished`);
        }

        const action = rule.action;
        if (!action || typeof action !== "object" || Array.isArray(action)) {
            throw new CompileError(`rule \`${id}\` declares no action`);
        }
        const kinds = Object.keys(action);
        if (kinds.length !== 1) {
            throw new CompileError(
                `rule \`${id}\` declares ${kinds.length} action kinds (${kinds.join(", ")}) — ambiguous is not the same as either, ` +
                    `and guessing which one was meant is how a gate ends up covering something other than what it says`,
            );
        }
        const [kind] = kinds;
        if (!["shell", "write", "read", "none"].includes(kind)) {
            throw new CompileError(`rule \`${id}\` declares action kind ${JSON.stringify(kind)}, which this compiler does not implement`);
        }
        if (typeof action[kind] !== "string" || action[kind].trim() === "") {
            throw new CompileError(`rule \`${id}\`'s action \`${kind}\` has no value`);
        }
        // ONE REGEX WAS CARRYING TWO DIFFERENT JUSTIFICATIONS, and only one of them reaches every kind.
        //
        // For `shell`, `write` and `read` the value is interpolated into the host's permission DSL —
        // `Bash(prefix:*)`, `Edit(./path)`. Characters structural THERE would emit a rule the host
        // parses differently from what the policy meant, and an ambiguous gate is indistinguishable
        // from an absent one. Refuse rather than escape: a workspace needing a gate on a command
        // containing `(` or `:` needs this compiler extended deliberately, not quietly reinterpreted.
        // Found by review on the pull request.
        //
        // **A `none` value is never interpolated into a permission pattern.** It is PROSE: the sentence
        // the policy gives for why there is no surface, which the compiler reports verbatim rather than
        // inventing its own — see the `kind === "none"` arm of the emitter, which pushes it as `why`,
        // and the `refused` loop in the reporter, which prints it. (An earlier draft of this comment
        // cited `describeRefusal`, a function that does not exist in this file — a name asserted without
        // being looked up, in the same change whose subject is tracing what a value actually reaches.
        // The nearest real thing is `floorRefusal`, which answers a different question.) So the DSL
        // justification above does not reach it, and
        // applying the DSL regex to it forbade **parentheses in an English sentence** — a gate refusing
        // to compile over an aside. #205.
        //
        // What DOES still reach it is narrower and worth stating rather than folding back in: that
        // sentence is printed into a LINE-BASED report — `refused ${id.padEnd(38)} ${why}` — so a
        // newline or a tab in it breaks the column and splits one refusal across two lines. That is a
        // different defect with a different fix, and it is the reason `none` keeps `\n\r\t` while
        // losing `()` and `:`. Two justifications, two scopes, stated separately so the next reader
        // cannot collapse them again.
        const RESERVED = kind === "none" ? /[\n\r\t]/ : kind === "shell" ? /[()\n\r\t:]/ : /[()\n\r\t]/;
        if (RESERVED.test(action[kind])) {
            throw new CompileError(
                kind === "none"
                    ? `rule \`${id}\`'s none target ${JSON.stringify(action[kind])} contains a line break or tab. ` +
                          `That sentence is printed into a line-based refusal report, where it would split one ` +
                          `refusal across two lines and misalign every column after it.`
                    : `rule \`${id}\`'s ${kind} target ${JSON.stringify(action[kind])} contains a character that is ` +
                          `structural in the host's permission syntax. Emitting it would produce a rule the host reads ` +
                          `differently from what this policy says, which is worse than refusing to compile.`,
            );
        }
        // THE SAME OVER-REACH, NINE LINES BELOW THE SPLIT THAT FIXED IT. This message told every kind
        // that the host "would not match" its value — and nothing about a `none` value is ever matched
        // by the host, for the reason set out directly above. Surrounding whitespace on a `none` value
        // is still worth refusing, but for a reason this comment got wrong once: the report's padding
        // comes from `r.id.padEnd(38)`, not from `why`, so whitespace on the sentence cannot misalign a
        // column. What it does do is shift the sentence out of line with every other refusal, and hide
        // itself in the record. The message says that now — a refusal's stated reason must match its
        // actual mechanism, which is this change's own subject, missed nine lines below its own fix. Found by Copilot on #256 round 1, in the change that had just split the
        // reserved-character check on exactly this distinction: `0020` at its shortest range yet.
        if (action[kind] !== action[kind].trim()) {
            throw new CompileError(
                kind === "none"
                    ? `rule \`${id}\`'s none target has leading or trailing whitespace. That sentence is printed ` +
                          `verbatim into the refusal report, where leading whitespace shifts it out of line with every ` +
                          `other refusal and trailing whitespace is invisible in the record.`
                    : `rule \`${id}\`'s ${kind} target has leading or trailing whitespace, which the host would not match`,
            );
        }
        // A path target that leaves the workspace is refused rather than normalised, for the reason
        // directly above. Two spellings, one defect: `pattern()` and `matchesPath()` compare against a
        // workspace-relative TAIL, so neither an absolute target nor one climbing out with `..` means
        // at enforcement time what it says in the policy.
        //
        //   "/etc/passwd"  -> emits `Edit(./etc/passwd)` and matches any file whose path ends
        //                     `/etc/passwd`, anywhere on the machine — broader than declared.
        //   "../secrets/"  -> emits `Edit(./../secrets/**)`, which the host may resolve against the
        //                     PARENT tree, while `matchesPath` can never match a `/../`-bearing tail
        //                     against a resolved absolute path — narrower than declared, and the
        //                     emitter and matcher disagree about which.
        //
        // Broader and narrower are both wrong, and the second is worse: it is a gate that reads as
        // present and holds nothing. A workspace needing to gate a path outside its own tree needs
        // this compiler extended deliberately. Shell targets are exempt: `/usr/bin/git` is a command
        // spelling, not a path this compiler rewrites. Absolute found by review on #31; the `..`
        // sibling by the fresh-context supervisor reviewing that fix, which is the same defect one
        // spelling over.
        if (kind === "write" || kind === "read") {
            const escapes = action[kind].startsWith("/")
                ? "is an absolute path"
                : action[kind].split("/").includes("..")
                  ? "climbs out of the workspace with `..`"
                  : null;
            if (escapes) {
                throw new CompileError(
                    `rule \`${id}\`'s ${kind} target ${JSON.stringify(action[kind])} ${escapes}. The emitter and the ` +
                        `runtime matcher both compare against a workspace-relative tail, so the gate enforced would not ` +
                        `be the one declared. Refusing rather than silently rewriting it.`,
                );
            }
        }

        rules.push({ id, tier: rule.tier, kind, target: action[kind], reason: rule.reason, action });
    }

    return { rules, floor: parseFloor(policy.floor) };
}

/**
 * The platform-floor declaration: the facts a floor backend would otherwise have to invent.
 *
 * Optional — a workspace that has declared no floor is a legitimate shape, and it is what every
 * workspace was before this key existed. Present, it is validated whole: a half-declared floor is
 * the one input from which a backend could emit something importable, valid, and weaker than the
 * settings already in force.
 *
 * Four keys, and each is here because it varies per repository and the export would otherwise guess:
 * which ref the floor protects, which status checks must be green, how many approving reviews are
 * required, and whether review threads must be resolved. What is deliberately NOT declarable is
 * `strict` — a pull request may not merge from behind its base
 * (`../.portulan/proposals/0011-no-merge-from-behind-main.md`, applied live on 2026-07-27), so a
 * policy able to declare `strict: false` would be a compiled artifact quietly undoing a ruling.
 */
function parseFloor(floor) {
    if (floor === undefined || floor === null) return null;
    if (typeof floor !== "object" || Array.isArray(floor)) {
        throw new CompileError("`floor` is present but is not a JSON object");
    }
    const branch = floor.branch;
    if (typeof branch !== "string" || !/^[A-Za-z0-9._\-/]+$/.test(branch) || branch.startsWith("/") || branch.endsWith("/")) {
        throw new CompileError(
            `\`floor.branch\` is ${JSON.stringify(branch)} — a floor must name the ref it protects, as an ordinary branch name. ` +
                `Refusing rather than defaulting to \`main\`: a compiler that invents the ref it gates has stopped compiling policy.`,
        );
    }
    // A branch NAME, never a full ref. The emitter prefixes `refs/heads/` unconditionally, so
    // `refs/heads/main` here produced `refs/heads/refs/heads/main` — a ruleset GitHub accepts and
    // that matches no ref in any repository. Importable, valid, enforcing nothing, in the one field
    // that names what the floor protects. Found by review on the pull request. (`release/2026` is an
    // ordinary branch name and stays legal; only a `refs/` prefix is refused.)
    if (/^refs\//.test(branch)) {
        throw new CompileError(
            `\`floor.branch\` is ${JSON.stringify(branch)} — declare a branch NAME, not a full ref. This compiler emits ` +
                `\`refs/heads/<branch>\`, so a \`refs/\` prefix here compiles to a ref no repository has, and a ruleset that ` +
                `matches nothing is worse than one that refuses to build.`,
        );
    }
    if (!Array.isArray(floor.checks)) {
        throw new CompileError("`floor.checks` must be an array — an absent one is indistinguishable from a floor requiring nothing");
    }
    const checks = floor.checks.map((c, i) => {
        if (!c || typeof c !== "object" || typeof c.context !== "string" || c.context.trim() === "") {
            throw new CompileError(`\`floor.checks[${i}]\` declares no \`context\` — a required check with no name cannot be required`);
        }
        // Refused rather than normalised, exactly as a rule target is a few lines up: a context
        // stored with its surrounding whitespace is emitted with it, and GitHub then requires a
        // check no job reports. Trimming it silently would hide a policy error in the file a human
        // reviews. Found by review on the pull request.
        if (c.context !== c.context.trim()) {
            throw new CompileError(
                `\`floor.checks[${i}].context\` is ${JSON.stringify(c.context)} — it has leading or trailing whitespace, which no ` +
                    `status check will report. Fix the policy rather than having this quietly trim it.`,
            );
        }
        // The app pin is optional and its absence is a real weakening rather than a style choice: a
        // context with no `integration_id` is satisfiable by ANY app reporting that name. Permitted,
        // because a workspace may legitimately not know its app id, and reported by `doctor` rather
        // than refused here. Recorded in ../.portulan/gate-map.md, which learned it the same way.
        const pin = c.integration_id;
        if (pin !== undefined && !Number.isInteger(pin)) {
            throw new CompileError(`\`floor.checks[${i}].integration_id\` is not an integer — an app pin GitHub cannot read is not a pin`);
        }
        return pin === undefined ? { context: c.context } : { context: c.context, integration_id: pin };
    });
    if (!Number.isInteger(floor.reviews) || floor.reviews < 0) {
        throw new CompileError("`floor.reviews` must be a non-negative integer — the required approving review count is policy, not a default");
    }
    if (typeof floor.resolve_conversations !== "boolean") {
        throw new CompileError("`floor.resolve_conversations` must be a boolean — omitting it would export a floor weaker than the one in force");
    }
    return { branch, checks, reviews: floor.reviews, resolve_conversations: floor.resolve_conversations };
}

// ===========================================================================================
// 2. What an action MEANS — shared by the compiler and the runtime gate
// ===========================================================================================
//
// The emitter and the hook runner must agree about what `{"shell": "git push"}` covers, and the
// only way to guarantee that is one definition. Two implementations of one matcher is the drift
// this repository keeps finding, and a *matcher* that drifts does not look wrong — it looks like a
// gate that quietly stopped covering something.
//
// `./gate.mjs` imports these. It is the only thing outside this file that may.

/**
 * The spellings of a shell command a gate will match against: the command itself, and the same
 * command with one `sh -c` / `bash -c` / `zsh -c` wrapper peeled off.
 *
 * The permission rule this compiles to sees only the first — `Bash(git push:*)` is a literal
 * prefix match, so `bash -c "git push …"` is invisible to it. Measured, not assumed. The hook
 * runner sees both, which is the one thing it does that the permission layer cannot, and therefore
 * the reason it is emitted at all.
 *
 * **One level, and no more.** This closes the spelling reached for by accident or convenience, not
 * one constructed on purpose: deeper nesting, a heredoc, an interpolated variable, or a command
 * assembled at runtime all still escape. No amount of parsing here would close that, and an
 * ambitious parser would buy false confidence with false reds. What must not happen regardless of
 * spelling belongs on the platform floor — see ../core/operating/autonomy.md, which calls the floor
 * the gate that holds when this layer fails.
 */
export function spellings(raw) {
    const command = String(raw ?? "").trim();
    const out = [command];
    const wrapper = /^(?:\/usr\/bin\/env\s+)?(?:ba|z|da)?sh\s+-[a-zA-Z]*c\s+(.*)$/s.exec(command);
    if (wrapper) {
        let inner = wrapper[1].trim();
        // The same `$'…'` / `$"…"` forms `shellWords` strips, at the other site that reads a quote.
        // Two sites, because a wrapped command is unwrapped HERE and a word is tokenised THERE, and
        // fixing one left `bash -c $'git push --force origin main'` still stepping aside while
        // `cp /tmp/x $'docs/vision.md'` had started denying — measured, and the reason this is not
        // one edit. Found by Copilot on #60.
        if (inner[0] === "$" && (inner[1] === "'" || inner[1] === '"')) inner = inner.slice(1);
        const quote = inner[0];
        if ((quote === '"' || quote === "'") && inner.endsWith(quote) && inner.length > 1) {
            inner = inner.slice(1, -1);
        }
        if (inner.trim()) out.push(inner.trim());
    }
    return out;
}

// The shell spellings of a write, recognised by table. Below, `shellWrites` asks one question of a
// command — *does it name the protected path in a position where that path is being written* — and
// these are the two ways it can answer yes without parsing a shell.
//
// A table rather than a parser, for the reason `REF_RULES` further down is a table: recognition by
// exact spelling is a limit a reader can measure, and a matcher clever enough to generalise is clever
// enough to be wrong quietly.

// `git` is deliberately absent, though `git checkout -- <path>` and `git restore` both overwrite a file.
// The head of those commands is `git`, so admitting it would gate `git diff <path>` and `git log` in the
// same stroke — and a gate on READING a path is a rule no policy here declares. It is the likeliest
// uncovered writer in this repository, which is why ../.portulan/gate-map.md names it rather than leaving
// it inside "any writer outside the table".
/** Commands whose job is to write, replace or remove a file they NAME on their own command line. */
export const FILE_WRITERS = new Set(["cp", "mv", "ln", "rm", "tee", "dd", "install", "truncate", "shred", "patch"]);

/**
 * Editors that READ their arguments by default and write them only under an in-place flag.
 *
 * Separated from the table above rather than folded into it, because folding them in would gate
 * `sed -n '1,5p' docs/vision.md` — which is a *read*, and which this policy declares Auto. A matcher
 * that contradicts a declared tier is worse than one that admits a gap.
 */
export const IN_PLACE_EDITORS = new Set(["sed", "gsed", "perl", "ruby"]);

/** Words that stand in front of the command that actually runs. Recognised, not parsed: `sudo cp …` is seen, `sudo -u someone cp …` is not. */
const COMMAND_PREFIXES = new Set(["sudo", "env", "command", "builtin", "exec", "nohup", "nice", "time"]);

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

// A NEWLINE is a command separator and belongs in this class, which it did not for one review round.
// The Bash tool receives multi-line scripts constantly, so
//
//     git status
//     cp /tmp/x docs/vision.md
//
// folded into ONE segment whose head was `git` — not a writer — and the whole table half fell through
// to false. The most ordinary spelling there is, and it defeated the gate while the redirection half
// (which reads no head) kept working, so the coverage looked alive. Found by the fresh-context
// supervisor at the pre-merge checkpoint.
const OPERATOR = /[|&;<>()\n\r]/;

// Words that lead a segment without being the command in it. `{ cp … ; }`, `if …; then cp …`, and
// `for …; do cp …` all put one of these where the head goes, which hid a writer behind it. Not a
// grammar — a list of leaders, and `find -exec cp` / `xargs cp` stay uncovered because parsing THEIR
// flags to find the real command is the ambitious parser this file keeps refusing to become.
const SEGMENT_LEADERS = new Set(["{", "}", "!", "then", "else", "elif", "do", "done", "fi", "esac"]);

/**
 * Drop heredoc BODIES, keeping the line that opens them.
 *
 * A heredoc body is data being written, not commands being run, so reading it as commands is simply
 * wrong — and it became wrong the moment a newline started separating commands, because that is what
 * turned each body line into its own segment. Measured immediately and expensively: this change's own
 * commit, whose message quoted `cp /tmp/x docs/vision.md` as the escape being fixed, was refused by the
 * gate it was adding. A matcher that blocks you from describing an attack is not being cautious.
 *
 * The opening line stays, so `cat > docs/vision.md <<'EOF'` still gates — the redirection is on it.
 * What is dropped is the text between the delimiter and its terminator, which no shell executes.
 */
function stripHeredocs(command) {
    const out = [];
    let delimiter = null;
    let held = []; // lines after an opener whose terminator has not been seen yet
    for (const line of command.split("\n")) {
        if (delimiter !== null) {
            if (line.trim() === delimiter) {
                // A real heredoc. Its body is data, not command text, so both the body and the
                // terminator line go.
                delimiter = null;
                held = [];
                continue;
            }
            held.push(line);
            continue;
        }
        out.push(line);
        const opened = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(line);
        if (opened) delimiter = opened[2];
    }
    // **An opener with no terminator was not an opener.** The regex reads a raw line, so `<<EOF`
    // inside a quoted string or after a `#` sets `delimiter` on text that opens nothing — and the
    // loop above would then swallow every remaining line looking for a word that never comes.
    //
    // That is a FAIL-OPEN manufactured by a defensive step, which is worse than the parsing gap it
    // was added to close: a gated command on any later line becomes invisible to every matcher
    // downstream. Measured on the runner before this branch existed —
    // `echo "not a heredoc <<EOF"\ngit push --force origin main` stepped aside where the bare
    // command answers `ask`, and `# <<EOF` did the same. Found by Copilot review on #60.
    //
    // Giving the lines back is the fail-CLOSED direction and costs only a false red: a genuine
    // heredoc always has its terminator, so this branch cannot reach one. What it does not close is
    // a mis-detected opener whose delimiter happens to appear later anyway; that is stated in the
    // gate map rather than chased with a quote-aware parser this file refuses to grow.
    if (delimiter !== null) out.push(...held);
    return out.join("\n");
}

/** A shell command split into words, with unquoted operators kept as words of their own. */
function shellWords(command) {
    const words = [];
    let text = "";
    let open = false; // a word has begun — so an empty `""` argument survives as a word
    const flush = () => {
        if (open) words.push({ text, op: false });
        text = "";
        open = false;
    };
    for (let i = 0; i < command.length; i += 1) {
        const c = command[i];
        // `$'…'` (ANSI-C quoting) and `$"…"` (locale translation) are quoting forms whose `$` is not
        // part of the word. Without this the `$` glued onto the front — `$'docs/vision.md'` tokenised
        // as `$docs/vision.md` — and no target matched. Measured on the runner before this branch:
        // `bash -c $'git push --force origin main'` stepped aside where the plain wrapper answers
        // `ask`, and `cp /tmp/x $'docs/vision.md'` stepped aside where the plain target denies. So
        // this was a live bypass of both a Gated shell target and the constitution's write gate,
        // sitting inside the claim one line down that quoting is honoured. Found by Copilot on #60.
        //
        // **Two forms and no more, because this grammar is closed.** `$(…)` is command substitution
        // and deliberately stays out: its content is a command to run, not a word to read, and
        // reading it as a word is precisely how a matcher becomes clever and wrong quietly. That one
        // is hole 1's "command assembled at runtime", where it belongs.
        if (c === "$" && (command[i + 1] === "'" || command[i + 1] === '"')) continue;
        if (c === "'" || c === '"') {
            // Quoted runs are taken whole, and the quotes are stripped: `cp /tmp/x 'docs/vision.md'`
            // must reach the gate, which is what goes red if this branch is removed. (An earlier
            // draft of this comment claimed it was what stops `echo "x > docs/vision.md"` reading as
            // a redirection. Measured at the pre-merge checkpoint: false — without this branch that
            // target tokenises as `docs/vision.md"`, trailing quote and all, and fails to match
            // anyway. Right branch, wrong reason, which `a-stated-enforcer-must-be-the-real-one`
            // counts as the same defect one size down.)
            // Scanned rather than `indexOf`, for the escaped-quote reason above: inside `"…"` a
            // `\"` is a literal quote and must not end the run. The escape is resolved into the word,
            // so `cp /tmp/x "docs/\"v\".md"` compares as the path a shell would pass.
            //
            // `$'…'` reaches here with its `$` already dropped and is read as a single-quoted run, so
            // ANSI-C escape sequences (`\n`, `\t`, `\x41`) are NOT decoded — a stated limit, and the
            // ambitious parser this file refuses to become. A path spelled with them escapes; that is
            // hole 1's "interpolated path" neighbourhood rather than a new one.
            let j = i + 1;
            let run = "";
            while (j < command.length) {
                if (c === '"' && command[j] === "\\" && j + 1 < command.length) {
                    run += command[j + 1];
                    j += 2;
                    continue;
                }
                if (command[j] === c) break;
                run += command[j];
                j += 1;
            }
            text += run;
            open = true;
            i = j >= command.length ? command.length : j;
            continue;
        }
        if (c === "\\" && i + 1 < command.length) {
            // A backslash-newline is a line continuation: both characters vanish, and the word
            // continues on the next line. Appending the newline instead would have glued it into the
            // middle of a path, which no target matches.
            // `\r\n` is consumed as a PAIR. Skipping one character left the `\n` behind, and a
            // newline is an operator here, so a CRLF continuation flushed the word instead of
            // continuing it: `cp /tmp/x \\<CRLF>docs/vision.md` stepped aside where the LF spelling
            // answers `deny` — the constitution, reachable by editing the file on Windows. Measured
            // both ways, 2026-07-28. Found by Copilot review on #60.
            if (command[i + 1] === "\r" && command[i + 2] === "\n") {
                i += 2;
                continue;
            }
            if (command[i + 1] === "\n" || command[i + 1] === "\r") {
                i += 1;
                continue;
            }
            text += command[i + 1];
            open = true;
            i += 1;
            continue;
        }
        // Operators are tested BEFORE whitespace, because a newline is both and the separator reading
        // is the load-bearing one.
        if (OPERATOR.test(c)) {
            flush();
            let run = c;
            while (i + 1 < command.length && OPERATOR.test(command[i + 1])) {
                run += command[i + 1];
                i += 1;
            }
            words.push({ text: run, op: true });
            continue;
        }
        if (/\s/.test(c)) {
            flush();
            continue;
        }
        text += c;
        open = true;
    }
    flush();
    return words;
}

/** Those words folded into `{ head, args, redirects }` per command in a pipeline or list. */
function shellSegments(command) {
    const segments = [];
    let current = { head: null, args: [], redirects: [] };
    let pending = null;
    const close = () => {
        if (current.head !== null || current.args.length || current.redirects.length) segments.push(current);
        current = { head: null, args: [], redirects: [] };
    };
    for (const word of shellWords(command)) {
        if (word.op) {
            // `>` `>>` `2>` `&>` — whatever follows is written, whatever the command is. `<` and `<<`
            // introduce something READ, so the word after them is SKIPPED rather than ending the
            // segment: `tee < /tmp/in docs/vision.md` keeps `tee` as the head and its real argument
            // as an argument, which is what goes red if this branch is removed. (An earlier draft
            // justified it with `patch f < d.diff` instead. Measured: that one is safe either way,
            // because without this branch the `<` merely closes the segment and `d.diff` becomes a
            // head rather than an argument. A branch defended by a hazard that cannot happen is a
            // branch nobody can review.)
            if (word.text.includes(">")) pending = "written";
            else if (word.text.includes("<")) pending = "read";
            else {
                pending = null;
                close();
            }
            continue;
        }
        if (pending) {
            if (pending === "written") current.redirects.push(word.text);
            pending = null;
            continue;
        }
        if (current.head === null) {
            const bare = word.text.split("/").pop();
            if (ASSIGNMENT.test(word.text) || COMMAND_PREFIXES.has(bare) || SEGMENT_LEADERS.has(bare)) continue;
            current.head = bare;
            continue;
        }
        current.args.push(word.text);
    }
    close();
    return segments;
}

/** Does this segment write the files it names? */
function writesWhatItNames({ head, args }) {
    if (head === null) return false;
    if (FILE_WRITERS.has(head)) return true;
    // `-i`, `-i.bak`, `-pi`, `--in-place`, `--in-place=.bak`. A long option other than `--in-place`
    // cannot match, because the single-dash form requires a letter run and `-` is not one.
    return IN_PLACE_EDITORS.has(head) && args.some((a) => /^--in-place(=|$)/.test(a) || /^-[a-zA-Z]*i/.test(a));
}

/**
 * A path as typed on a command line, reduced to the spelling the tail comparison can read.
 *
 * `matchesPath` compares tails literally, which is right for the host's own clean absolute paths and
 * wrong for anything a person types: `docs/./vision.md` and `docs//vision.md` are the constitution
 * and neither ends with `/docs/vision.md`. Both were live escapes for one review round. `..` is
 * resolved for the same reason and in the same place — `foo/../docs/vision.md` is the file too.
 */
function normalisePath(p) {
    const absolute = p.startsWith("/");
    const out = [];
    for (const part of p.split("/")) {
        if (part === "" || part === ".") continue;
        if (part === ".." && out.length && out[out.length - 1] !== "..") out.pop();
        else out.push(part);
    }
    return (absolute ? "/" : "") + out.join("/");
}

/**
 * The directories a target lives under, as exact paths: `a/b/c.md` -> `a`, `a/b`.
 *
 * No trailing slash, and that is the whole correctness of it. Spelled `a/` these would be SUBTREE
 * patterns, and `matchesPath` would then report every file under the directory as a hit — so
 * `cp foo docs/plan.md` matched a rule protecting `docs/vision.md`, which is a false red on an
 * ordinary edit to an unrelated file. Caught by this change's own probe before it left the worktree.
 */
function ancestors(target) {
    const parts = normalisePath(target.replace(/\/+$/, "")).split("/").filter(Boolean);
    return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
}

/**
 * Does a word name the target — quoted, `./`-prefixed, absolute, messy, or after an `of=`-style `=`?
 *
 * With `orAncestor`, a word naming a DIRECTORY the target lives in counts too. That is what makes
 * `rm -rf docs` and `mv docs docs.bak` reach a rule protecting `docs/vision.md`: destroying the
 * container destroys the file, and a gate that reads `rm -rf docs/` and misses `rm -rf docs` is
 * decided by a trailing slash. Ancestors apply to a writer's arguments only, never to a redirection
 * target — `> docs` writes a file called `docs`, it does not remove a directory.
 */
function namesTarget(word, target, orAncestor = false) {
    const eq = word.indexOf("=");
    const candidates = eq > 0 ? [word, word.slice(eq + 1)] : [word];
    return candidates.some((c) => {
        const clean = normalisePath(c);
        if (clean === "") return false;
        // A relative word is given the leading separator the tail comparison needs, rather than a
        // second matcher being written for it.
        const rooted = clean.startsWith("/") ? clean : `/${clean}`;
        // The target itself. A subtree target wants the candidate to look like a directory, which is
        // what lets `rm -rf .portulan` reach a rule written `.portulan/`.
        if (matchesPath(target.endsWith("/") ? `${rooted}/` : rooted, target)) return true;
        // A directory the target lives in, named EXACTLY — `rm -rf docs`, never `cp x docs/plan.md`.
        return orAncestor && ancestors(target).some((a) => matchesPath(rooted, a));
    });
}

/**
 * The commands in a shell line, as SOURCE text, split on unquoted separators.
 *
 * The shell matcher below prefix-matches a command string, which meant a gate held only when its
 * command came FIRST: `ls && git push --force origin main` reached no gate, and neither did
 * `git status; gh pr merge 60` or `cd . && gh repo delete foo`. Every Gated outward action in
 * ../.portulan/gates.json was defeated by putting anything in front of it.
 *
 * That is the same defect as the `write:` one this change began with — a matcher reading only the
 * head of a command string — one action kind over, so it is fixed in the same stroke rather than
 * left as a sibling nobody comes back for. Found by the fresh-context supervisor at the pre-merge
 * checkpoint, which is exactly the class it was asked to hunt.
 *
 * Quoting is respected, so `echo "git push --force"` still splits into one segment that no gate
 * matches; and each segment keeps the whitespace boundary the prefix match relies on, so
 * `--force-with-lease` stays Auto.
 */
function commandSegments(raw) {
    // `String(raw ?? "")`, for the reason `spellings` does the same: `matchesRule` promises never to
    // throw, and a Bash payload carrying no `command` — a malformed host message, a renamed field, a
    // test — would otherwise reach `stripHeredocs` and die on `.split`.
    //
    // What that costs is not an exception some caller reports. ./gate.mjs catches
    // and steps aside, so the throw would SILENTLY remove the shell-write half of the constitution
    // gate — hole 3, the half with no permission rule beneath it. Introduced earlier on this branch
    // by the segment-composition fix, which began passing the raw payload here in place of a spelling
    // that had already been stringified. Found by Copilot review on #60.
    const command = stripHeredocs(String(raw ?? ""));
    const out = [];
    let start = 0;
    let quote = null;
    for (let i = 0; i < command.length; i += 1) {
        const c = command[i];
        if (quote) {
            // Inside `"…"` a backslash escapes the next character, so `\"` is a literal quote and does
            // NOT close the run. Without this, `echo "x\""; git push --force …` closed early, the real
            // closing quote opened a new run, and the `;` was swallowed inside it — no split, no
            // segment, no gate. Measured stepping aside where the unescaped spelling answers `ask`,
            // and the same shape reached `cp /tmp/x docs/vision.md`, so it was a false green on the
            // constitution too. Found by Copilot review on #60.
            //
            // Single quotes are deliberately NOT included: POSIX gives `'…'` no escapes at all, so a
            // backslash there is a literal backslash and honouring it would invent a hole.
            if (quote === '"' && c === "\\" && i + 1 < command.length) {
                i += 1;
                continue;
            }
            if (c === quote) quote = null;
            continue;
        }
        if (c === "'" || c === '"') {
            quote = c;
            continue;
        }
        if (c === "\\") {
            // The same CRLF pair, in the other reader. No spelling was measured behaving differently
            // here — a continuation split into two segments still leaves a gated command at the head
            // of one — so this is fixed for the reason the session kept re-learning rather than for a
            // failing case: one carrier corrected and its sibling left is how the last three defects
            // on this branch happened.
            i += command[i + 1] === "\r" && command[i + 2] === "\n" ? 2 : 1;
            continue;
        }
        // `#` is NOT treated as starting a comment, and that is a decision rather than an oversight.
        // `echo ok #; git push --force origin main` therefore segments as though the comment were
        // code and answers `ask`, which a real shell would not — a false RED, measured 2026-07-28.
        //
        // Taking it would mean deciding where a comment begins, and the failure mode of getting that
        // wrong runs the other way. A `#` opens a comment only at a word boundary and only outside
        // quotes; a reader that skipped from the first `#` would swallow the rest of
        // `echo "a#b"; git push --force origin main` — a real gated command, measured answering `ask`
        // today — and turn a false red into a false GREEN. The docblock on `shellWrites` states the
        // exchange rate: a false red costs one prompt on a rare spelling, a false green costs the
        // laundering the rule exists to prevent.
        //
        // Both spellings are asserted in the suite so this stays a choice rather than drift.
        // Reported by Copilot review on #60 and declined on those grounds.
        if (";|&()\n\r".includes(c)) {
            out.push(command.slice(start, i));
            start = i + 1;
        }
    }
    out.push(command.slice(start));
    return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * Does this shell command write a path a `write:` rule protects?
 *
 * The permission layer cannot ask this. `Bash(prefix:*)` matches a literal command PREFIX and the
 * path sits at an arbitrary position in the command, so there is no pattern in that DSL which means
 * "any command writing this file" — which makes this the hook's coverage alone, exactly like the
 * wrapper spelling above, and it fails open on the same terms.
 *
 * **Stated at its real size, because the boundary is the point.** Two recognitions, both by table:
 * a `>`/`>>` redirection into the path, and a file-writing command that names it — or names a
 * directory the path lives in, since removing the container removes the file.
 *
 * A heredoc is NOT on that list, and the omission is worth stating rather than leaving to be read as
 * one: the body is stripped and the command line survives, so `cat > docs/vision.md <<EOF` is reached
 * and gated — asserted in the suite. What escapes is an interpolated TARGET, heredoc or not, which is
 * the first item below. The emitted note said "a heredoc" flatly until 2026-07-28 and overstated the
 * hole; a gate map that overstates a hole is as wrong as one that hides it, and so is a compiler note.
 *
 * What that leaves open, listed because a hole list that is wrong is worse than none: an
 * interpolated path (`> $VISION`), a command assembled at runtime, a language runtime writing the
 * file itself (`python3 -c`), a writer absent from the table (`ex`, and `git checkout` deliberately
 * — see above), a program that INVOKES a writer (`find -exec cp`, `xargs cp`) because parsing their
 * flags to find the real command is the parser this file refuses to become, and two shell wrappers.
 * Quoting is respected only to one level of nesting, so a write-shaped string inside a `node -e`
 * script can produce a false RED — measured on this repository's own tooling.
 *
 * The first version of this shipped a four-item hole list that was missing five holes, including
 * the plainest spelling there is: a newline. A fresh-context supervisor found them by trying to
 * defeat the matcher rather than by reading it, which is the only way that list gets checked.
 *
 * This closes the spelling reached for by accident or convenience; it does not close one
 * constructed on purpose, and no matcher here could. What must not happen regardless of spelling
 * belongs on the platform floor — ../core/operating/autonomy.md.
 *
 * **Every named argument of a writer counts, not only its destination.** `cp docs/vision.md /tmp/x`
 * reads the protected path rather than writing it, and this matches it anyway. Deliberate: argument
 * grammars differ per command (`dd of=`, `tee f1 f2`, `install -t dir src`), so "the last word is
 * the destination" is true of a subset only, and being wrong about it is a false GREEN on a rule
 * whose whole reason is that the file must not change. A false red here costs one prompt on a rare
 * operation; a false green costs the laundering the rule exists to prevent.
 */
export function shellWrites(command, target) {
    for (const segment of shellSegments(stripHeredocs(String(command ?? "")))) {
        if (segment.redirects.some((word) => namesTarget(word, target))) return true;
        if (writesWhatItNames(segment) && segment.args.some((word) => namesTarget(word, target, true))) return true;
    }
    return false;
}

/** Does a path handed over by the host fall under a policy target? */
export function matchesPath(candidate, target) {
    if (typeof candidate !== "string" || candidate === "") return false;
    const clean = String(target ?? "").replace(/^\.\//, "").replace(/^\/+/, "");
    if (clean === "" || clean === "/") return false;
    // Compared against the tail rather than resolved against a root: the host hands over an
    // absolute path, the policy names a repository-relative one, and the hook has no reliable
    // repository root at hook time — its cwd is the session's, which need not be the repo.
    const normalised = candidate.replace(/\\/g, "/");
    return clean.endsWith("/") ? normalised.includes(`/${clean}`) : normalised.endsWith(`/${clean}`);
}

/** Does an attempted tool call fall under this rule? Returns true/false; never throws. */
export function matchesRule(rule, tool, input = {}) {
    const action = rule?.action ?? {};
    if (typeof action.shell === "string" && tool === "Bash") {
        // A shell target ending in `/` is a PATH PREFIX covering the subtree — the meaning `pattern()`
        // already gives a trailing slash for write and read, and the meaning the emitted
        // `Bash(target:*)` rule already has on the host, which prefix-matches the command string.
        // Without this branch the two halves this section exists to keep identical disagreed: for
        // `"./.portulan/verify/"` the emitted rule covers `./.portulan/verify/docs.sh` and this
        // matcher did not, because a path prefix is never followed by a space.
        //
        // **Stated at its real size.** The one target of this shape in ../.portulan/gates.json is
        // `run-a-verify-recipe`, which is `auto` — refused from compilation, and skipped by
        // ./gate.mjs, which reads only `gated` and `prohibited`. So nothing was
        // mis-enforced today; what existed was a divergence between two definitions this file
        // promises are one, waiting for the first gated rule written in the path form. Fixed on that
        // basis rather than on an incident. An ordinary command prefix keeps its whitespace boundary,
        // or `git push` would cover `git pushall`. Found by a Copilot review comment on #31.
        //
        // Each spelling is tested WHOLE and per segment. Whole, because a path-prefix target is
        // matched against the command as written; per segment, because a gated command that is not
        // the first thing on the line is still that command — see `commandSegments`.
        const hit = (s) =>
            action.shell.endsWith("/") ? s.startsWith(action.shell) : s === action.shell || s.startsWith(`${action.shell} `);
        // `spellings` is applied to each SEGMENT as well as to the whole line, and the second call is
        // not redundant. Unwrapping was anchored at the start of the command, so a wrapper that was
        // not the first thing on the line never got unwrapped: `ls && bash -c "git push --force
        // origin main"` stepped aside, while both halves of it worked alone — the wrapper spelling is
        // hole 1's "one level, peeled", and mid-line reach is hole 2. Two claims that each held and
        // did not compose, which is how a gap survives a reader checking either one.
        //
        // Found while writing a regression test for the `$'…'` form Copilot reported; the plain-quote
        // spelling turned out to escape the same way, so this is wider than the report.
        //
        // **Both calls read the RAW command, and that is the whole care in this line.** The first
        // draft segmented each *spelling* and unwrapped again — which peeled TWO levels for a nested
        // wrapper and made `bash -c "bash -c 'git push origin HEAD'"` match, contradicting hole 1's
        // documented and asserted limit. The suite caught it, which is what that counterexample test
        // is for. Reading the raw command in both branches keeps the budget at exactly one unwrap.
        const segments = commandSegments(input.command);
        return spellings(input.command).some(hit) || segments.some((seg) => spellings(seg).some(hit));
    }
    if (typeof action.write === "string") {
        if (WRITE_TOOLS.includes(tool)) return matchesPath(input.file_path ?? input.notebook_path, action.write);
        // A `write:` rule names a PATH, not a tool. For one milestone it reached only the three tools
        // that carry a `file_path`, so `echo x >> docs/vision.md` through Bash was gated by neither
        // layer: the permission rule rejects the tool, and this matcher fell through to `false`. The
        // rule's own sentence is what that cost — an agent that can edit the constitution can launder
        // any other change past its own grader — and it was reachable inside a session, with only the
        // platform floor stopping it from landing. See `shellWrites` above for what this covers and,
        // more to the point, for what it does not.
        if (tool === "Bash") {
            // Whole line and per segment, exactly as the `shell` branch above — and for the same
            // reason, arrived at the hard way. That branch grew segment composition when a wrapper
            // that was not first on the line turned out to escape it. This branch did not, and the
            // gap it left is the worse of the two: `git status; bash -c "echo x >> docs/vision.md"`
            // stepped aside where the same wrapper alone answers `deny`, so the CONSTITUTION was
            // reachable behind any separator plus one wrapper. Measured 2026-07-28.
            //
            // A fix landing in one carrier and not its sibling is the defect class this repository
            // has a standing ruling about; it happened here between two branches of one function,
            // five commits apart. Found by Copilot review on #60, not by the session that wrote the
            // first half.
            //
            // Both calls read the RAW command so the unwrap budget stays at one level, which is what
            // keeps hole 1's two-wrapper counterexample true on this side too.
            const writes = (s) => shellWrites(s, action.write);
            return (
                spellings(input.command).some(writes) ||
                commandSegments(input.command).some((seg) => spellings(seg).some(writes))
            );
        }
    }
    if (typeof action.read === "string" && READ_TOOLS.includes(tool)) {
        return matchesPath(input.file_path, action.read);
    }
    return false;
}

// ===========================================================================================
// 3. The backends
// ===========================================================================================
//
// A backend takes the parsed policy and returns one shape, always:
//
//   { backend, label, compiled: [{id, tier, surface}], refused: [{id, tier, why}],
//     notes: [string], artifact: { path, value, text } | null }
//
// `compiled` and `refused` together always equal the input, per backend — asserted by the suite,
// because the distinctive failure of a compiler that emits gate machinery is a rule that goes in
// and nothing comes out, leaving a gate map that reads as configured and a machine that enforces
// nothing. The uniform shape is what lets the matrix and `doctor` read every backend the same way
// without either of them knowing what a backend does.

/** A workspace-relative path, as the host spells it. A trailing `/` means the subtree. */
function pathSpec(target) {
    const clean = target.replace(/^\.\//, "").replace(/^\/+/, "");
    return clean.endsWith("/") ? `./${clean}**` : `./${clean}`;
}

/** A workspace-relative path becomes a host permission pattern. */
function pattern(tool, target) {
    return `${tool}(${pathSpec(target)})`;
}

// Which tiers this backend gates. `auto` and `propose` are refused wholesale, on the maintainer's
// ruling of 2026-07-27: the compiler emits restriction only, never permission. A compiler whose
// output can only ever ADD a gate cannot loosen an existing check by having a bug.
//
// ## What the ruling costs — which this comment used to leave to the reader's imagination
//
// Refusing to emit `allow` does not make the Auto tier free. It moves the tier's price off this
// repository. The host prompts for any command it has not been told about, so every Auto action is
// answered by hand, and those answers pile up in the host's own settings files, which are
// per-machine, unreviewable, absent from every diff, and — for a workflow built on throwaway
// worktrees — lost along with the branch that earned them. Measured on one host, 2026-07-28: 404 hand-added allow
// entries, of which exactly ONE corresponded to an Auto rule in ../.portulan/gates.json. So the
// tier is unattended in POLICY and heavily attended in PRACTICE, and those are not the same claim.
// The refusal string below used to make the first one and read as the second.
//
// ## The ruling stands, on a different sentence than before
//
// "Emitting `allow` would loosen a check" is not the hazard, or not obviously so: `git push` is
// Auto and `git push --force` is Gated, and whether a narrower `ask` still outranks a broader
// `allow` is a host precedence question **this repository has never measured** — so no argument
// here should rest on it. The hazard that does not depend on that answer: an allow prefix reaches
// every spelling beneath it, including the ones no rule here names. `git push --mirror` is
// destructive and appears in no tier of ../.portulan/gates.json. An allow on the prefix would
// clear it silently, and nothing in this policy would notice.
const HOST_GATE_TIERS = new Set(["gated", "prohibited"]);

const HOST_TIER_NOT_A_GATE = {
    auto: "tier `auto` is unattended by policy, not by the host — this backend emits no `allow` rule for it, which is what keeps the compiler additive, and the prompts that omission leaves are paid by hand in the host's own settings, outside this repository",
    propose: "tier `propose` is enforced by the platform floor — pull requests, required checks, review — not by a tool-level permission rule on this machine",
};

/**
 * Translate the policy into a Claude Code settings object.
 *
 * The mapping, each line of it measured against a running host rather than read from documentation:
 *
 *   prohibited -> permissions.deny  + a hook returning `deny`
 *   gated      -> permissions.ask   + a hook returning `ask`
 *
 * The hook returns the SAME decision as the permission rule on purpose. A hook returning `deny` for
 * a Gated action would turn a per-action prompt into a hard block, which is the tier above it.
 *
 * One line of that mapping has no permission half. A `write:` rule also gates the SHELL spellings of
 * a write — see `shellWrites` above — and no `Bash(prefix:*)` pattern can express "a command writing
 * this path", so that half is the hook's alone and fails open with it. Emitted anyway, because the
 * alternative was leaving `echo x >> docs/vision.md` gated by nothing at all, and reported in the
 * backend's `notes` on every run so the weaker layer is never inferred from silence.
 */
export function claudeCode(parsed, options = {}) {
    // The header names the policy file that was ACTUALLY read. It was a literal for one round, so a
    // workspace declaring a non-default policy got an artifact claiming it came from somewhere it did
    // not — in the one field whose entire job is telling a reader what generated this. Found by review.
    const source = options.source ?? ".portulan/gates.json";
    // **Where the emitted hook finds its runner, and why this is computed rather than written down.**
    //
    // Both runners used to live at `.portulan/compile/`, which `package.json`'s `files` has never
    // shipped — so every adopter's compiled policy named two files they did not receive, and a missing
    // hook FAILS OPEN. Milestone 7 moves them into `cli/`, which does ship. That fixes what the adopter
    // has; it does not by itself fix how the hook names it, because `cli/` sits in a different place in
    // each of the three contexts this must survive:
    //
    //   1. this checkout            — `<project>/cli/`
    //   2. a project-local install  — `<project>/node_modules/@sleepy_panda_srl/portulan/cli/`
    //   3. a global or npx-only install — NOT under the project at all
    //
    // So the path is derived from where THIS file actually is at compile time and expressed relative to
    // the project when it lands inside it — covering 1 and 2 with one rule rather than two special
    // cases. For 3 there is no project-relative spelling that exists, so an absolute path is emitted and
    // a **note** records that the hook is pinned to this machine — see the `pinned` push below. Naming
    // that is the point: a hook silently pinned to an absolute path is a policy that stops working when
    // the package moves, and finding out by having no gate is the worst way to find out.
    //
    // This sentence said `refused` for one round, and `refused` carries rule-level compilation refusals
    // only — nothing ever added the runner path to it. The pre-commit checkpoint found the recording
    // missing entirely; the fix added it on the `notes` channel and left this line still naming the
    // wrong one, so a reader following the comment would have looked in a place that never holds it.
    // Copilot's round caught the remainder. A fix that leaves its own explanation pointing elsewhere is
    // half a fix.
    const runnerDir = path.dirname(fileURLToPath(import.meta.url));
    // The project this policy is being compiled FOR. `claudeCode` is handed a parsed policy and not a
    // location, so the caller may say; `cwd` is the honest default because `compile` is run from the
    // repository it compiles.
    const project = options.root ?? process.cwd();
    const pinned = [];
    const spell = (file) => {
        const abs = path.join(runnerDir, file);
        const rel = path.relative(project, abs);
        // `rel.split(sep)[0] !== ".."` rather than `!startsWith("..")` — the latter also rejects a
        // directory literally named `..foo`. Benign in direction (it would fall back to absolute), but
        // the exact spelling costs nothing and the loose one is copied from here.
        const inside = rel && rel.split(path.sep)[0] !== ".." && !path.isAbsolute(rel);
        if (inside) return `"\${CLAUDE_PROJECT_DIR}/${rel.split(path.sep).join("/")}"`;
        pinned.push({ file, abs });
        return `"${abs}"`;
    };
    const runner = options.runner ?? spell("gate.mjs");
    const stopRunner = options.stopRunner ?? spell("stop-gate.mjs");

    const compiled = [];
    const refused = [];
    const deny = [];
    const ask = [];
    const matchers = new Set();
    const shellWriteGates = [];

    for (const rule of parsed.rules) {
        if (!HOST_GATE_TIERS.has(rule.tier)) {
            refused.push({ id: rule.id, tier: rule.tier, why: HOST_TIER_NOT_A_GATE[rule.tier] });
            continue;
        }
        if (rule.kind === "none") {
            // The policy itself states why there is no surface. The compiler reports those words
            // rather than inventing its own — a refusal explained by the tool is a refusal nobody
            // can review against the policy.
            refused.push({ id: rule.id, tier: rule.tier, why: rule.target });
            continue;
        }
        const into = rule.tier === "prohibited" ? deny : ask;
        const emitted = []; // permission patterns — the layer that cannot fail open
        const hookOnly = []; // coverage the permission DSL cannot express, carried by the hook alone
        if (rule.kind === "shell") {
            emitted.push(`Bash(${rule.target}:*)`);
            matchers.add("Bash");
        } else {
            for (const tool of rule.kind === "write" ? WRITE_TOOLS : READ_TOOLS) {
                emitted.push(pattern(tool, rule.target));
                matchers.add(tool);
            }
            if (rule.kind === "write") {
                // The hook is wired for Bash so that a shell spelling of this write reaches
                // `matchesRule`, which now answers for it. **This line is the load-bearing half.**
                // The matcher alone would be inert in any workspace whose policy declares no shell
                // gate: `Bash` would be absent from the matchers below, the runner would never be
                // invoked for a Bash call, and the coverage would exist only in a function nothing
                // calls — the manifest-field-that-validates-and-loads-nothing defect
                // (../.portulan/memory/a-manifest-field-can-validate-and-load-nothing.md), arriving
                // this time as a matcher nothing reaches. It changes no artifact in THIS repository,
                // whose policy already gates shell commands, which is precisely why it would not have
                // been noticed here.
                //
                // No permission pattern joins it, and that is not an omission: `Bash(prefix:*)`
                // matches a literal command prefix while the path sits at an arbitrary position, so
                // the DSL has no way to say "any command writing this file". The only patterns that
                // would fit — `Bash(cp:*)`, `Bash(sed -i:*)` — gate the utility rather than the path,
                // which is a different and much larger rule than the policy declares.
                matchers.add("Bash");
                hookOnly.push(`hook: a Bash command writing ${pathSpec(rule.target)}`);
                shellWriteGates.push(rule.id);
            }
        }
        into.push(...emitted);
        // The hook-only clause is carried in the SURFACE and not in `into`. It is not a permission
        // pattern, and a reader of the matrix has to be able to tell which half of a gate would
        // survive a broken hook.
        compiled.push({ id: rule.id, tier: rule.tier, surface: [...emitted, ...hookOnly].join(" · ") });
    }

    // A policy that declares gates and emits none must not report success. This is the workflow's
    // "declares no verify recipes — refusing to report green" one level down: the artifact would be
    // written, the gate map would read as compiled, and nothing would hold.
    if (parsed.rules.some((r) => HOST_GATE_TIERS.has(r.tier)) && compiled.length === 0) {
        throw new CompileError(
            "every gate in this policy refused to compile — refusing to write an artifact that enforces nothing while the policy claims gates",
        );
    }

    // The generation header. An emitted artifact that does not say what generated it invites the
    // one edit this whole rail exists to catch — a hand-fix that survives until the next compile
    // silently reverts it.
    // **What compiled this, recorded beside what generated it** (#264). An unpinned run WOULD read
    // the host's plugin cache while the rail reads the tree — it now refuses that arrangement outright
    // (#316) — and until this field the artifact said nothing about which answered, so a drift RED named a difference no reader could find in the repository, because the
    // deciding input was a directory outside it.
    //
    // **Origin and version, never the ROOT PATH.** The discovered root is an absolute path under
    // somebody's home directory; recording it would make a tracked artifact machine-dependent and red
    // `verify/compile.sh` for every developer and CI — trading a silent hazard for a permanent false
    // one. `recordedOrigin` collapses the resolver's three tags to two for the same reason: the pinned
    // rail and a bare run must agree byte for byte about an identical world.
    const packs = (options.packProvenance ?? [])
        .map((c) => ({ pack: c.pack, origin: c.origin, version: c.version ?? null }))
        .sort((a, b) => a.pack.localeCompare(b.pack));
    const value = {
        $portulan: {
            generated: "cli/compile.mjs",
            source,
            ...(packs.length ? { packs } : {}),
            warning: `Generated file. Edit ${source} and recompile; \`verify/compile.sh\` fails on drift.`,
        },
        permissions: { deny, ask, allow: [] },
        hooks: {
            // Quoted deliberately: this repository's own working copy lives under a path with
            // spaces in it, and an unquoted expansion would word-split into a runner nobody can
            // find. No pipes, redirections or separators — an emitted shell one-liner is where the
            // next quoting fail-open would live (../.portulan/tasks/0004).
            PreToolUse: [...matchers].sort().map((matcher) => ({
                matcher,
                hooks: [{ type: "command", command: `node ${runner}` }],
            })),
            Stop: [{ hooks: [{ type: "command", command: `node ${stopRunner}` }] }],
        },
    };

    // The shell half of every write gate, reported on every run rather than left for a reader to
    // infer from the absence of a `Bash` entry in `deny`. It is the one place in this artifact where
    // a gate is carried by the layer that fails open, so a note that only appeared when something
    // went wrong would be a note nobody ever reads.
    const notes = [];
    // **The promise this comment used to make and the code did not keep.** The fallback above emits an
    // absolute path when the runner is not under the project — a global or npx-only install — and the
    // paragraph at the top of this function said `refused` would record that the hook is pinned to this
    // machine. It recorded nothing: the pre-commit checkpoint compiled from a package outside a project
    // and got two absolute hooks with **zero output about it**. A hook silently pinned to one machine is
    // a policy that stops working when the package moves, and finding out by having no gate is the worst
    // way to find out — so it is said, on the channel that prints every run.
    if (pinned.length) {
        notes.push(
            `${pinned.length} hook(s) are pinned to an ABSOLUTE path on this machine — ` +
                `${pinned.map((x) => x.abs).join(", ")}. The runner is not under this project (a global or \`npx\` install), ` +
                `so no \`\${CLAUDE_PROJECT_DIR}\`-relative spelling exists. The compiled policy therefore stops working if the ` +
                `package moves or is reinstalled elsewhere, and a missing hook FAILS OPEN. Install the package into the ` +
                `project, or pass \`--runner\`/\`--stop-runner\` to name a path you control`,
        );
    }
    if (shellWriteGates.length) {
        notes.push(
            `${shellWriteGates.length} write gate(s) — ${shellWriteGates.join(", ")} — also match a Bash command that writes the ` +
                `path: a \`>\`/\`>>\` redirection into it, or one of \`${[...FILE_WRITERS].join("`, `")}\` naming it ` +
                    `OR naming a directory it lives in (\`rm -rf docs\` reaches \`docs/vision.md\`), or ` +
                `\`${[...IN_PLACE_EDITORS].join("`/`")}\` under an in-place flag. This half is the HOOK's alone and therefore ` +
                `FAILS OPEN if the hook does: \`Bash(prefix:*)\` matches a command prefix while the path sits anywhere in the ` +
                `command, so no permission rule expresses it. A heredoc whose TARGET is interpolated, an interpolated ` +
                `variable, a command assembled at ` +
                `runtime, a runtime writing the file itself (\`python3 -c\`), or any writer outside that table still reaches ` +
                `the path. The platform floor is what covers those.`,
        );
    }

    return {
        backend: "claude-code",
        label: "Claude Code",
        compiled,
        refused,
        notes,
        artifact: { path: ARTIFACT_PATHS["claude-code"], value, text: render(value) },
    };
}

// ===========================================================================================
// 3b. The floor backend — a GitHub repository ruleset
// ===========================================================================================
//
// The milestone-4 criterion positions this as **the floor backend**: what every host falls back to,
// and all that a host with no hook system has. `../core/operating/autonomy.md` says the floor is the
// floor "because it holds when everything above it fails", and promises that the enforcement compiler
// reads the workspace's gate policy and generates the host's own enforcement; this is that promise,
// discharged for the floor half. (Quoted rather than paraphrased-in-quotes, which is the small version
// of the defect ../.portulan/memory/a-stated-enforcer-must-be-the-real-one.md is about.)
//
// It **generates, never applies.** Importing a ruleset is a repository-settings change — outward,
// Gated, the maintainer's, per the proposal-0001 precedent — so this emits a file and stops.
//
// Only the server's *input* fields are emitted: an export carrying an `id` or a `created_at` would be
// asserting facts it cannot know. The envelope and that omission list were read from two live rulesets
// on 2026-07-27; the `pull_request` and `required_status_checks` parameter blocks were **not** — neither
// live ruleset carries those rules — so those come from GitHub's documented schema, and
// ../.portulan/compile/README.md marks them as such rather than folding them into "read from live".
//
// **Recognition is by exact spelling, and that is a limit rather than an oversight.** The action
// vocabulary has no `ref` kind — a rule says `{"shell": "git push --force"}` — so this backend
// matches command strings against a table and refuses everything else out loud. A parser that
// recognised `git push -f` as the same action would be the ambitious parser `../spec/slots.md`
// warns against, and it would buy confidence with false reds.
const REF_RULES = new Map([
    ["git push --force", "non_fast_forward"],
    ["git push --delete", "deletion"],
]);

// Which tiers this backend may emit a ref rule for. `prohibited` is included and `auto` is not:
// a prohibition on a ref operation is a restriction the floor can carry, while an unattended action
// needs no ref gate by definition.
const FLOOR_GATE_TIERS = new Set(["gated", "prohibited"]);

/** Commands a *tag* ruleset would reach. Named individually so the refusal can say which mechanism. */
const TAG_SHAPED = new Set(["git tag", "gh release"]);

export function githubRuleset(parsed, options = {}) {
    const source = options.source ?? ".portulan/gates.json";
    const { floor } = parsed;
    const compiled = [];
    const refused = [];
    const notes = [];

    // No floor declared: refuse everything, by name, and write nothing. Defaulting the branch to
    // `main` was the obvious alternative and is the exact move this compiler must not make — a
    // compiler that invents the ref it gates has stopped compiling policy and started writing it.
    if (!floor) {
        for (const rule of parsed.rules) {
            refused.push({
                id: rule.id,
                tier: rule.tier,
                why: "this workspace declares no `floor` in its gate policy, so nothing names the ref a ruleset would protect. Declare `floor` (branch, checks, reviews, resolve_conversations) to compile a platform floor from this policy.",
            });
        }
        return { backend: "github-ruleset", label: "GitHub repository ruleset", compiled, refused, notes, artifact: null };
    }

    const rules = [];
    // Both halves of the condition are load-bearing, and the second was missing for one round. The
    // pair is **compiled from `propose` rules**, so a policy with none of them asked for no
    // pull-request requirement — emitting one because `floor.checks` happens to be declared is the
    // compiler inventing policy, which is the single thing this backend must not do. It also broke
    // the accounting silently: those two ruleset rules would have sat in the artifact with no policy
    // rule credited for compiling them, so the matrix and `doctor` would have described a floor
    // missing two of its own rules. Found by review, round 3.
    const declaresPropose = parsed.rules.some((r) => r.tier === "propose");
    const hasChecks = floor.checks.length > 0;
    const emitPullRequestPair = hasChecks && declaresPropose;

    // The propose tier and the floor's pull-request pair. Emitted together or not at all: a
    // `pull_request` rule without `required_status_checks` imports cleanly, reads as a configured
    // floor, and lets a red pull request merge. Half a mapping is the silent weakening this
    // repository keeps finding, so the refusal names the missing declaration instead.
    if (emitPullRequestPair) {
        rules.push({
            type: "pull_request",
            parameters: {
                // The five GitHub requires on this rule, and no sixth. `allowed_merge_methods` is a
                // real optional parameter and was dropped deliberately: nothing in the policy drives
                // it and the criterion does not name it, so emitting it would widen the part of this
                // artifact that is invented rather than compiled, to buy nothing. (An earlier draft
                // also argued it "appears in neither live ruleset" — vacuous, since neither of those
                // carries a `pull_request` rule at all. Removed rather than kept as decoration.)
                required_approving_review_count: floor.reviews,
                dismiss_stale_reviews_on_push: true,
                require_code_owner_review: false,
                require_last_push_approval: false,
                required_review_thread_resolution: floor.resolve_conversations,
            },
        });
        rules.push({
            type: "required_status_checks",
            parameters: {
                // Not read from the policy, and deliberately: a pull request may not merge from
                // behind its base (proposal 0011, applied live 2026-07-27). A declarable `strict`
                // would let a later policy edit undo a ruling with no diff anyone would read as one.
                strict_required_status_checks_policy: true,
                do_not_enforce_on_create: false,
                required_status_checks: floor.checks,
            },
        });
    }

    for (const rule of parsed.rules) {
        if (rule.tier === "propose") {
            if (emitPullRequestPair) {
                compiled.push({ id: rule.id, tier: rule.tier, surface: "pull_request · required_status_checks" });
            } else {
                refused.push({
                    id: rule.id,
                    tier: rule.tier,
                    why: "this floor declares no status check, and `pull_request` is emitted only together with `required_status_checks` — requiring a pull request while requiring nothing green of it imports cleanly and reads as a floor. Declare `floor.checks`.",
                });
            }
            continue;
        }

        // The TIER is consulted before the spelling table, and that order is the whole of it. It was
        // the other way round for one round, so an `auto` rule spelled exactly `git push --force`
        // compiled into `non_fast_forward` — a ruleset rule emitted for an action the policy declares
        // unattended, with `floorRefusal`'s own `auto` branch left unreachable for it. The table is
        // only how this backend spells a gate; whether there is a gate at all is the policy's answer.
        // Found by review on the pull request.
        const shell = rule.kind === "shell" && FLOOR_GATE_TIERS.has(rule.tier) ? rule.target : null;
        const refType = shell ? REF_RULES.get(shell) : undefined;
        if (refType) {
            rules.push({ type: refType });
            compiled.push({ id: rule.id, tier: rule.tier, surface: refType });
            continue;
        }

        refused.push({ id: rule.id, tier: rule.tier, why: floorRefusal(rule, floor) });
    }

    if (compiled.length === 0) {
        throw new CompileError(
            `this workspace declares a floor on \`${floor.branch}\` and no rule in the policy reaches it — refusing to write an importable ruleset that enforces nothing`,
        );
    }

    // The coarseness, recorded in BOTH directions. A backend that reported only where it is weaker
    // than the policy would be flattering itself, and the stricter direction is the one an adopter
    // is surprised by.
    if (compiled.some((c) => c.surface === "non_fast_forward")) {
        notes.push(
            `on \`refs/heads/${floor.branch}\` the \`non_fast_forward\` rule is STRICTER than this policy: it blocks every force-push, including \`git push --force-with-lease\`, which the policy classifies Auto. The floor gates a ref and cannot read a command's flags.`,
        );
    }
    notes.push(
        `every rule here applies to one declared ref, \`refs/heads/${floor.branch}\`, and to nothing else. A policy rule naming an action on any other branch is not covered by this export even where it compiled.`,
    );
    // A declaration nothing compiles is reported, never dropped in silence — the manifest-field-that-
    // loads-nothing defect, arriving from the policy side this time.
    if (hasChecks && !declaresPropose) {
        notes.push(
            `this floor declares ${floor.checks.length} status check(s) and the policy carries no \`propose\` rule, so no ` +
                `\`pull_request\` or \`required_status_checks\` rule is emitted. Requiring checks presupposes pull requests, and ` +
                `this backend will not add that requirement on a workspace's behalf. The checks are a declaration nothing compiles.`,
        );
    }
    notes.push(
        "this export carries the three rule types the milestone-4 criterion names and no more. It does not reproduce a repository's whole protection surface, so importing it beside classic branch protection ADDS a layer rather than replacing one — and removing classic protection afterwards would drop whatever this ruleset does not carry.",
    );

    const value = {
        // JSON has no comments and a GitHub ruleset has no description field, so the name is the
        // only place a warning survives into the settings UI a maintainer actually reads. Same job
        // as the `$portulan` header in the other artifact, done in the one field available.
        name: `portulan floor — ${floor.branch} (generated from ${source})`,
        target: "branch",
        enforcement: "active",
        conditions: { ref_name: { include: [`refs/heads/${floor.branch}`], exclude: [] } },
        rules,
        // Unconditional, and the gate map's own sentence is why: a floor carrying an exemption for
        // the only actor who can act is not a floor. The organisation-level ruleset this repository
        // sits under does carry an `OrganizationAdmin` always-bypass, which is recorded there as the
        // unverified layer of the floor — not copied here.
        bypass_actors: [],
    };

    return {
        backend: "github-ruleset",
        label: "GitHub repository ruleset",
        compiled,
        refused,
        notes,
        artifact: { path: artifactPaths(options.workspaceDir ?? ".portulan")["github-ruleset"], value, text: render(value) },
    };
}

/**
 * Why one rule does not reach the floor.
 *
 * Every sentence here is scoped to *this export* rather than to GitHub, because
 * `../.portulan/memory/a-stated-enforcer-must-be-the-real-one.md` binds any sentence containing
 * "cannot" — and the convenient blanket version ("the platform gates a ref, not a path") is simply
 * false: CODEOWNERS gates owned paths and is named as part of the floor by
 * `../core/operating/autonomy.md`, push rulesets gate file paths, and tag rulesets gate `refs/tags/*`.
 */
function floorRefusal(rule, floor) {
    if (rule.tier === "auto") {
        // "Unattended by definition" is literally true on THIS backend, and true only here: a branch
        // ruleset has no prompt to pay, so an Auto rule left out of it costs nobody anything. The
        // host backend carried the identical phrase and it was false there — see the comment above
        // `HOST_GATE_TIERS`. Same words, one backend apart, one of them wrong. Do not carry either
        // version across without re-deriving it for the backend it lands in.
        return "tier `auto` is unattended by definition — the floor exists to refuse what an agent may not do alone, and an action needing nobody's approval needs no ref gate.";
    }
    if (rule.kind === "none") {
        return `${rule.target} No branch ruleset reaches it either.`;
    }
    if (rule.kind === "write" || rule.kind === "read") {
        return `this export compiles BRANCH rules for one declared ref. A path-scoped guarantee on GitHub is \`CODEOWNERS\` (via a pull-request rule's code-owner review) or a push ruleset, neither of which this export emits — this repository's \`CODEOWNERS\` is deliberately non-enforcing, which is a separate decision from this one. Out of scope, not beyond the platform.`;
    }
    if (TAG_SHAPED.has(rule.target)) {
        return "this action creates a tag, which a **tag ruleset** targeting `refs/tags/*` would gate. This export emits one branch ruleset and does not emit tag rulesets, so the rule is out of its scope.";
    }
    if (rule.target === "gh pr merge") {
        return `the floor CONSTRAINS this action — a merge into \`${floor.branch}\` needs its required checks green and, with strict checks, a head that is not behind the base — but with ${floor.reviews} required approving review(s) it does not require a human's yes, which is what the Gated tier means. Reported as not compiled rather than as covered, because the guarantee the rule asks for is not one a branch ruleset makes.`;
    }
    return `no branch-ruleset rule corresponds to \`${rule.target}\`, and recognition here is by EXACT command spelling (\`${[...REF_RULES.keys()].join("`, `")}\`) rather than by parsing — a matcher clever enough to generalise would be clever enough to be wrong quietly.`;
}

/**
 * Where each backend's artifact lives, whether or not this policy produces one.
 *
 * Declared beside the backends rather than read off a result, because `--check` has to look for an
 * artifact a backend *no longer* owes — and a backend that emits nothing has no result to read a
 * path from. Keyed by backend id so adding a backend without a path here is a `TypeError` at the
 * first check rather than a silently unswept file.
 */
const ARTIFACT_PATHS = {
    "claude-code": ".claude/settings.json",
    "github-ruleset": ".portulan/compile/github-ruleset.json",
};

/**
 * The same map, for a workspace that does not live at `.portulan`.
 *
 * **A feature that dispatches on residence is a parity breach**, and proposal
 * `../.portulan/proposals/0017-one-repository-one-governing-workspace.md` says it is refusable on that
 * sentence alone. This one did: the ruleset's path had `.portulan` written into it, so compiling a
 * feed-side workspace looked for a gate policy at `<feed>/workspaces/.portulan/gates.json` — a
 * directory that does not exist and never would — and exited 2, *could not run*, on a workspace that
 * `doctor`, `index` and its own verify recipe all handled identically at both ends.
 *
 * **Found by running row 7's fourth demonstration, not by reading this file.** Every other line of the
 * compiler already keyed to a slot; this one key was location. The default is unchanged, so a caller
 * that names no workspace directory takes a byte-identical path to the one it took before.
 */
function artifactPaths(workspaceDir) {
    if (workspaceDir === ".portulan") return ARTIFACT_PATHS;
    // A workspace directory that IS the root — the feed-side shape, where the workspace ships as the
    // plugin and the installed plugin's directory is the workspace root (milestone 6 measured that).
    // Its compiled artifacts belong beside it, because they ship with it.
    const prefix = workspaceDir === "." ? "" : `${workspaceDir}/`;
    return {
        "claude-code": ARTIFACT_PATHS["claude-code"],
        "github-ruleset": `${prefix}compile/github-ruleset.json`,
    };
}

/** Every backend, run against one parsed policy. The order is the order the matrix prints in. */
export function backends(parsed, options = {}) {
    // **Provenance rides in the Claude Code artifact only, and that is an honest limit rather than an
    // oversight.** `githubRuleset` emits to a fixed external schema that has nowhere to carry a
    // `$portulan` block; its provenance is the one line it can carry, in `name`. Both backends compile
    // from ONE root plan per run, so the recorded origins describe the ruleset's inputs too — they are
    // simply not readable in its file. Stated here and in `../.portulan/compile/README.md` (#264).
    return [claudeCode(parsed, options), githubRuleset(parsed, options)];
}

/**
 * The per-host backend matrix: one row per policy rule, one cell per backend.
 *
 * Derived from the backends rather than maintained beside them. A matrix written by hand is a claim
 * about compilers, and this repository has spent two milestones on what claims about machinery are
 * worth — so this one cannot drift from the compilers, because it *is* their accounting transposed.
 */
export function matrix(parsed, options = {}) {
    const columns = backends(parsed, options);
    return parsed.rules.map((rule) => {
        const cells = {};
        for (const column of columns) {
            const hit = column.compiled.find((c) => c.id === rule.id);
            cells[column.backend] = hit
                ? { verdict: "compiled", detail: hit.surface }
                : { verdict: "refused", detail: column.refused.find((r) => r.id === rule.id)?.why ?? "" };
        }
        return { id: rule.id, tier: rule.tier, backends: cells };
    });
}

// ===========================================================================================
// 3. The command line
// ===========================================================================================

/**
 * The same answer as `policyPath`, plus WHICH ARM produced it — and, where the manifest named
 * something unusable, WHY.
 *
 * `policyPath` returns a path either way, which is all a reader of the policy needs and is exactly
 * what made the caller unable to tell two different situations apart: a workspace that NAMES a policy
 * file which is missing (a genuine error — something is declared and absent), and a workspace that
 * names none at all (a legitimate shape, per this function's own note below). Both arrived at
 * `readJson` as `ENOENT` and were reported identically, so the second — documented here as legitimate
 * — surfaced as `cannot read the gate policy at …/gates.json`, which reads like a corrupt or deleted
 * file and sends the reader to look for one that was never supposed to exist.
 *
 * Found 2026-08-22 while booting the `sleepy-panda` workspace, which declares no `gates` key and
 * composes a pack contributing two gate rules: the compiler refused with an ENOENT that mentioned
 * neither fact. Reporting declaredness is what lets the caller say which of the two it is.
 *
 * **`declared: false` is four situations, not one, so it carries a `reason`.** The first cut reported
 * every one of them as "`workspace.json` has no top-level `gates` key", which is false for a manifest
 * that is absent and false for a `gates` value this function refused — the same two-situations-one-
 * sentence defect this change exists to fix, reproduced one level down. `reason` is `no-key`,
 * `no-manifest`, `refused`, or `declared`. Found by Copilot on this pull request.
 */
export function policyDeclaration(workspaceRoot, workspaceDir = ".portulan") {
    const base = path.join(workspaceRoot, workspaceDir);
    const manifest = path.join(base, "workspace.json");
    const fallback = (reason) => ({ file: path.join(workspaceRoot, workspaceDir, "gates.json"), declared: false, reason });
    let declared;
    try {
        declared = JSON.parse(fs.readFileSync(manifest, "utf8")).gates;
    } catch {
        // No manifest, or unreadable. `doctor` is the tool that judges a manifest; this one only needs
        // to know where the policy is, and the default is where it is when nothing says otherwise.
        return fallback("no-manifest");
    }
    if (declared === undefined) return fallback("no-key");
    // Validated against the schema's `filePath` shape before it is used, and containment is
    // checked after resolution rather than by pattern alone — a `../` chain passes any regex and
    // still escapes. Without this, a malformed or hand-edited manifest turns a hook that runs on
    // EVERY tool call into an arbitrary file read outside the workspace. `doctor` would refuse such
    // a manifest, but this runner must not depend on `doctor` having been run: the two tools have
    // no ordering between them, and the schema is the contract, not the sequence. Found by review.
    //
    // **`isInside`, not another hand-rolled spelling.** The containment test read
    // `!path.relative(base, resolved).startsWith("..")` until 2026-08-22 — the spelling
    // `./inside.mjs` exists to replace, which calls an ordinary directory named `..foo` an escape and
    // falls back for a policy that was inside all along. This module already imports `isInside` and
    // already carries the same warning at `recordedOrigin`, so the rule was in scope and unread.
    // Pre-existing, and surfaced by Copilot on the pull request that touched this line.
    //
    // **No count is asserted here.** A first draft called this "the fifth copy"; the pre-commit
    // checkpoint could not reproduce that figure and a census then found more, including one in THIS
    // module at `resolveWorkspace`. The census is #331 rather than this commit, because the remaining
    // sites do not share semantics — they disagree on the empty relative path and on absolute paths —
    // so each needs its own red and green. An unreproducible number is worse than none.
    if (typeof declared === "string" && declared.trim() && FILE_PATH.test(declared)) {
        const resolved = path.resolve(base, declared);
        if (resolved !== base && isInside(base, resolved)) return { file: resolved, declared: true, reason: "declared" };
    }
    // The manifest named something, and nothing it named is usable — a wrong type, an empty string, a
    // shape the schema refuses, or a path that escapes the workspace. The compiler is on the
    // conventional path, so the fallback owns the diagnostic; but this is NOT the state of a manifest
    // that named nothing, and a message conflating the two is the defect this change is about.
    return fallback("refused");
}

/**
 * Where a workspace's gate policy lives — the path alone.
 *
 * Kept as the narrow answer because most callers want exactly that, and because every existing caller
 * and test was written against a string. `policyDeclaration` is the one that also says whether the
 * workspace named it, and why when it did not.
 *
 * Read from the manifest's top-level `gates` key, because that is what the key MEANS —
 * `../spec/slots.md` calls it "a path to a JSON file the enforcement compiler reads", and `doctor`
 * resolves it. This compiler hard-coded `.portulan/gates.json` for one round, so a workspace naming a
 * different file would have had `doctor` validate one policy and `compile` compile another, with both
 * reporting green. A manifest key that validates and is never consumed is this repository's most
 * expensive recurring defect, and here it was in the very key this milestone added. Found by review on
 * the pull request.
 *
 * The default survives for a workspace with no manifest or no key — that is a legitimate shape, and
 * refusing it would make the key required, which is a spec change nobody decided.
 */
export function policyPath(workspaceRoot, workspaceDir = ".portulan") {
    return policyDeclaration(workspaceRoot, workspaceDir).file;
}

/**
 * What to say when a workspace declares no gate policy and none is there by convention.
 *
 * This is a STATE, not a failure to read a file, and the difference is the whole point: `policyPath`'s
 * note calls an absent `gates` key "a legitimate shape, and refusing it would make the key required,
 * which is a spec change nobody decided" — and then the reader refused it anyway, with `ENOENT` on a
 * file the workspace never claimed to have.
 *
 * It stays a refusal (exit 2, nothing written), because nothing was compiled and a compiler that
 * reports success having emitted nothing is the failure this repository keeps writing checks against.
 * What changes is that the refusal names the actual state and what it costs.
 *
 * **The pack count is the load-bearing half.** A workspace in this shape may still compose packs
 * contributing gate fragments — `sleepy-panda` composes `rituals/checkpoints`, which contributes two
 * — and those rules silently reach nothing, because a fragment tightens a policy and there is none to
 * tighten. That is the fact a reader needs and the one the old message could not carry: it threw
 * before `packContributions` was ever called.
 */
function undeclaredPolicyMessage(policyFile, workspaceRoot, workspaceDir, packOptions, reason = "no-key") {
    const manifest = path.join(workspaceRoot, workspaceDir, "workspace.json");
    // **One opening per arm, because the arm is the reader's first question.** `no-key` is the shape
    // this whole change defends as legitimate; `no-manifest` is a workspace that has not been
    // authored yet; `refused` is a manifest that DID name a policy and named one this compiler will
    // not read, which is neither of the other two and must not be told it has no `gates` key.
    const opening =
        reason === "refused"
            ? `\`workspace.json\` names a gate policy this compiler will not read — its top-level ` +
              `\`gates\` key is not a relative path to a file inside the workspace — and there is no ` +
              `\`gates.json\` at ${policyFile} either.`
            : reason === "no-manifest"
              ? `this workspace declares no gate policy — there is no readable \`workspace.json\` at ` +
                `${manifest}, and there is no \`gates.json\` at ${policyFile}.`
              : `this workspace declares no gate policy — \`workspace.json\` has no top-level \`gates\` key, ` +
                `and there is no \`gates.json\` at ${policyFile}.`;
    const lines = [`${opening} Nothing was compiled and nothing was written.`];
    let composed = null;
    try {
        composed = packContributions(workspaceRoot, workspaceDir, packOptions);
    } catch {
        // The pack layer has refusals of its own — a shadowed pack, a malformed pack manifest, an
        // unresolvable root. Swallowed HERE and nowhere else: this message is about the missing policy,
        // and a pack refusal raised from inside a diagnostic would replace the answer with a different
        // question. Declare a policy and the very next run surfaces it on its own terms.
    }
    const contributions = composed?.contributions ?? [];
    const rules = contributions.reduce((n, c) => n + (c.fragments?.length ?? 0), 0);
    if (rules > 0) {
        const packs = contributions
            .filter((c) => (c.fragments?.length ?? 0) > 0)
            .map((c) => `\`${c.pack}\``)
            .join(", ");
        lines.push(
            `${rules} pack-contributed gate rule(s) from ${packs} are therefore NOT compiled: ` +
                `a fragment tightens a policy, and there is none here to tighten.`,
        );
    }
    lines.push(
        reason === "refused"
            ? "Give `gates` a relative path to a file inside the workspace directory, or remove the key " +
                  "and let `gates.json` be found by convention."
            : "Declare one with `portulan new gate-policy`, or leave it undeclared deliberately — " +
                  "a workspace with no gate policy is a legitimate shape, and this is a state rather than a fault.",
    );
    return lines.join("\n  ");
}

// ===========================================================================================
// Pack-contributed gate fragments — the cascade's middle layer
// ===========================================================================================
//
// The cascade is `core < pack < workspace`, and until now no pack contributed to the gate policy —
// ../packs/tools/README.md called that "the cascade's missing middle". The floor was ruled
// before any of it was built (../.portulan/proposals/0010-prohibited-as-a-fourth-universal-tier.md,
// agreed 2026-07-27): **packs may only tighten.** A pack may raise a tier or add a prohibition; it may
// never demote another layer's classification, because a composed-in third-party artifact able to
// demote `push` to Auto would be a dependency with the power to disarm the gate containing it — and
// the demotion would look exactly like configuration.
//
// That ruling is why the policy was modelled as a list of id-addressed rules with no dependence on
// being the only source. This is the merge step it was shaped for: an addition, not a redesign.

/** The tier partial order, weakest to strongest. Tightening moves UP it and never down. */
const TIER_ORDER = ["auto", "propose", "gated", "prohibited"];

/** Where a tier sits in the partial order; `-1` for anything that is not a tier. */
export const tierRank = (tier) => TIER_ORDER.indexOf(tier);

/**
 * Resolve one declared pack name — the canonical `category/name` — against a list of roots, in order.
 *
 * Root-parameterized rather than deriving one location, because the two shapes that matter are not
 * the same tree: a workspace composing a pack that ships beside it resolves under its own `packs/`,
 * while an adopter installing from a feed resolves inside the installed plugin. One resolver, told
 * where to look, so the second case is the same code path rather than a parallel one discovered later.
 *
 * Returns `{ name, category, pack, dir, manifest, root }` with `dir` and `root` null when nothing
 * matched. `root` is which root answered — the fact a caller states per pack once the set is a union.
 */
export function resolvePack(rawName, roots = []) {
    // Coerced once, and the COERCED value is what every return carries. This compiler reads
    // `workspace.json` without validating it — `doctor` is the tool that judges a manifest, and the
    // two have no ordering between them — so `packs` may hold a number or an object, and the caller
    // formats what comes back (`.padEnd()`), which on a non-string throws a TypeError that aborts the
    // whole compile instead of reporting one unresolvable pack. Found by review.
    const name = String(rawName);
    const parts = name.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return { name, category: null, pack: null, dir: null, manifest: null, root: null, why: "not in `category/name` form" };
    }
    const [category, pack] = parts;
    // A name is a name, never a path: a `..` segment here would resolve a declared pack outside every
    // root it was supposed to be searched in.
    if (!SLUG.test(category) || !SLUG.test(pack)) {
        return { name, category: null, pack: null, dir: null, manifest: null, root: null, why: "`category/name` must both be slugs" };
    }
    for (const root of roots) {
        const dir = path.join(root, category, pack);
        const manifest = path.join(dir, "pack.json");
        // `root` rides along because the resolution set may now be a union, and *which* root answered
        // is the fact a caller states per pack. Deriving it afterwards by re-testing the roots would
        // be a second implementation of this loop, and the two would drift on the first-match rule.
        if (fs.existsSync(manifest)) return { name, category, pack, dir, manifest, root, why: null };
    }
    return { name, category, pack, dir: null, manifest: null, root: null, why: "no pack.json under any resolution root" };
}

/**
 * The roots a declared pack name is resolved against for a workspace on disk.
 *
 * Derived from the manifest's `tree` rather than declared, because adding a key for it would be a
 * Workspace Definition change nobody decided — and a slot before its consumer is the mistake that
 * specification was written to avoid. A workspace with no `tree` gets no roots, and its declared packs
 * are reported unresolvable rather than failed: the same answer `tree`'s absence already gives every
 * other claim that needs a tree to check.
 */
export function packRoots(workspaceDir, workspace) {
    const tree = workspace?.tree;
    if (typeof tree === "string" && tree.trim()) return [path.resolve(workspaceDir, tree, "packs")];
    return [];
}

/**
 * The `options` object for `packContributions` when roots were named on the command line.
 *
 * **Named roots REPLACE the root derived from `tree`; they are not searched ahead of it.** The first
 * implementation appended the derived root after the named ones here, while `doctor` and `index` — both
 * of which spell this as `options.packRoots ?? packRoots(…)` — replaced it. Three tools, two semantics,
 * and every prose carrier described only one of them. The pre-commit checkpoint on the change that added
 * the flag found it by attacking it: a workspace with the pack sitting in its own tree, given
 * `--pack-root <an empty directory>`, compiled **green from the local copy** — which is exactly the thing
 * the flag exists to exclude, since the whole point is that "the pack resolved from the feed" must not be
 * satisfiable by a copy lying around. Replacement is the semantics that serves that, so replacement is
 * what all three now do, and `cli/compile.test.mjs` pins the divergent case rather than trusting the
 * prose to hold the three in line.
 *
 * Returns `{}` when nothing was named, so the derived-only path stays byte-identical to what it was
 * before the flag existed — a caller that passes no roots must not take a different branch, which is the
 * property that keeps the flag a *surface* on the existing behaviour rather than a second one.
 */
// **No caller since `--pack-root auto` landed** — the command line now passes `named` into `rootPlan`
// and the precedence rule decides. Kept, exported and documented because four files cite it in prose
// for the DEFECT it records rather than for the function it is: three tools, two semantics, found by a
// checkpoint. A reader arriving from one of those citations should find this note rather than infer
// that the code path is live.
export function namedRootsOption(workspaceRoot, namedRoots) {
    if (!namedRoots?.length) return {};
    return { packRoots: [...namedRoots] };
}

/**
 * The one place the three tools agree on where a resolution root comes from.
 *
 * `compile`, `doctor` and `index` each spelled the derived-versus-named choice for themselves, and two
 * of the three spelled it differently — the divergence `namedRootsOption` records, found by a
 * checkpoint rather than by the suite. Discovery adds a third source and a precedence between all
 * three, which is three more chances to diverge, so the ordering is written once in `discover.mjs`'s
 * `resolutionRoots` and **called** by each tool rather than described in three places.
 */
export function rootPlan(workspaceDir, manifest, { named = [], namedGiven = null, discovery = null, forced = false } = {}) {
    return resolutionRoots({ named, namedGiven, derived: packRoots(workspaceDir, manifest), discovery, forced });
}

/**
 * What the packs a workspace declares contribute. Reads each resolved `pack.json` and collects its
 * gate fragments. It does NOT validate the manifest against the Pack Definition — `doctor` does that,
 * and this compiler must not depend on `doctor` having been run: the two have no ordering between
 * them. What it depends on instead is `parse`, which validates every composed rule exactly as it
 * validates a hand-written one, so a malformed fragment is refused by the same code either way.
 */
/**
 * How a resolved pack's ORIGIN is recorded in an emitted artifact — a deliberate collapse of the
 * resolver's three tags into two, and the collapse is the load-bearing part.
 *
 * `resolutionRoots` tags roots `named | derived | discovered`. Recording that raw would be wrong in a
 * way that turns this whole feature into a liability: the PINNED rail spells its root
 * (`--pack-root packs`, tagged `named`) while a bare run derives the same directory (tagged
 * `derived`). Two documented-correct spellings of the same world would emit different bytes, and
 * `verify/compile.sh` would go red on a tree nothing was wrong with — a per-machine false red, which
 * is worse than the silent hazard #264 is about.
 *
 * So: `discovered` iff the answering root came from discovery — **which is a statement about where the
 * root was FOUND, not about where it sits.** Discovery reads a record under `CLAUDE_CONFIG_DIR`, and a
 * hermetic run can point that inside the tree, so a discovered root is not necessarily an external one;
 * the docblock said "a directory outside this repository" until review caught the conflation, and the
 * distinction is this field's whole subject rather than a quibble — it is why `outside-tree` exists as
 * a separate answer below. Otherwise `tree`, when the root is one the repository itself yields. A NAMED root that is not under the workspace root is neither, and is recorded as
 * `outside-tree` rather than flattened into `tree`, because calling somebody's `--pack-root /elsewhere`
 * "the tree" would be this field's first lie.
 */
export function recordedOrigin(root, plan, workspaceRoot) {
    const same = (a, b) => path.resolve(a) === path.resolve(b);
    const tagged = (plan?.origins ?? []).find((o) => same(o.root, root));
    if (tagged?.origin === "discovered") return "discovered";
    // **`derived` and `named` take the SAME inside-the-repository test**, and the first draft trusted
    // `derived` on its tag alone. It is derived from the manifest's `tree`, which is a string a human
    // edits: `tree: "../../elsewhere"` resolves a derived root of `/elsewhere/packs` — measured — and
    // that would have been recorded as `tree`. A tag says where a root CAME FROM; only the path says
    // whether it is in this repository, and this field's whole job is the second question. Copilot.
    //
    // Inside INCLUDES being the repository itself, which the first draft called `outside-tree` on a
    // `rel` of `""`. By this function's own standard that was the field's first lie.
    //
    // **Both sides resolved through `realpathSync`**, because a lexical comparison makes two spellings
    // of one directory disagree: `--workspace <alias> --pack-root <realpath>` recorded `outside-tree`
    // for a root plainly inside the tree, which would emit a different artifact for an identical world
    // — the per-machine false red this whole design refuses. Measured. It is the same trap #220's
    // second arm repaired in the Stop-gate's divergence sentence, and it is worth stating twice
    // because the two sites were written a day apart and neither inherits the other's guard.
    const real = (dir) => {
        try {
            return fs.realpathSync(path.resolve(dir));
        } catch {
            return path.resolve(dir);
        }
    };
    // **`isInside`, not a fourth hand-rolled spelling.** `!rel.startsWith("..")` calls a directory
    // literally named `..foo` outside the tree — and this repository has already paid for that exact
    // reasoning once: `./index.mjs`'s docblock records it as the ninth fail-open found in this
    // scaffolding, and *the first one written by the change that cites the class*. This was the second.
    // The helper is exported precisely so a third copy cannot drift into it. Copilot.
    return isInside(real(workspaceRoot), real(root)) ? "tree" : "outside-tree";
}

/**
 * Two copies of one pack answered, and this says what differs between them.
 *
 * **One carrier, because the comparison has already been wrong twice.** `doctor` grew this first and
 * its history is the argument for not writing a fourth: a first spelling projected `[id, tier, action]`
 * and so read a copy differing in `reason` as agreeing — while `composeFragments` pushes the WHOLE
 * fragment, so those differences do reach the compiled policy; a second compared the whole fragment
 * but claimed *byte-identical*, which `JSON.stringify` of a parsed value cannot promise. This is that
 * third, correct version, moved here so `doctor` and `compile` cannot drift apart about what a shadow
 * IS — proposal `0020`'s rule, applied to a function rather than to a sentence.
 *
 * Parsed and key-order-normalised is the RIGHT comparison: reformatting a `pack.json` changes nothing
 * about what the pack contributes, so reporting it would be noise.
 */
export function packDifferences(mine, other) {
    const canonical = (v) =>
        Array.isArray(v)
            ? v.map(canonical)
            : v && typeof v === "object"
              ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]))
              : v;
    const frag = (m) => JSON.stringify(canonical(m?.contributes?.gates ?? []));
    const mineV = mine?.portulan?.version ?? "no version";
    const otherV = other?.portulan?.version ?? "no version";
    const differs = [];
    if (mineV !== otherV) differs.push(`version ${mineV} against the tree's ${otherV}`);
    if (frag(mine) !== frag(other)) differs.push("gate fragments that differ once parsed");
    return differs;
}

/**
 * The non-discovered copy of a pack that a discovered root answered for — or `null` when there is no
 * shadow. `originOf` maps a root to its tag; pass `plan.origins`' lookup.
 *
 * Only a **discovered** answer can be shadowed in the sense that matters: a named root replaces the
 * derived one, so nothing is behind it, and a derived answer is the tree's own copy already.
 */
export function shadowedCopy(name, answeringOrigin, roots, originOf) {
    if (answeringOrigin !== "discovered") return null;
    const behind = resolvePack(name, roots.filter((r) => originOf(r) !== "discovered"));
    return behind.dir ? behind : null;
}

export function packContributions(workspaceRoot, workspaceDir = ".portulan", options = {}) {
    const base = path.join(workspaceRoot, workspaceDir);
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(base, "workspace.json"), "utf8"));
    } catch {
        // No manifest, or unreadable. `doctor` is the tool that judges a manifest; this one only needs
        // to know what is composed, and with nothing to go on the answer is nothing.
        return { contributions: [], unresolved: [] };
    }
    const declared = manifest?.packs;
    if (!Array.isArray(declared) || declared.length === 0) return { contributions: [], unresolved: [] };

    // `options.packRoots` keeps its pre-discovery meaning — the FINAL root set, replacing the derived
    // one; a caller passing `[]` means the empty set and still gets it. `options.named` is the
    // command-line shape. **Both now go through the shared rule**, `namedGiven` carrying the
    // final-set meaning, because the literal plan this replaces was the sixth site of the defect this
    // change is about: given `packRoots` AND `forced`, it silently ignored the discovery request, and
    // it returned a plan with no `origins` and no `refusal` — breaking one file over the uniform shape
    // `resolutionRoots` exists to guarantee. Found by the pre-commit checkpoint's own sibling sweep,
    // after the same class had already been found once in `index` inside this change.
    const givenPackRoots = options.packRoots !== undefined && options.packRoots !== null;
    const plan = rootPlan(base, manifest, {
        named: givenPackRoots ? [...options.packRoots] : (options.named ?? []),
        namedGiven: givenPackRoots ? true : null,
        discovery: options.discovery ?? null,
        forced: options.forced ?? false,
    });
    if (plan.refusal) throw new CompileError(plan.refusal);
    if (plan.couldNotRun) throw new CompileError(plan.couldNotRun);
    const roots = plan.roots;
    const contributions = [];
    const unresolved = [];
    for (const name of declared) {
        const found = resolvePack(name, roots);
        if (!found.dir) {
            unresolved.push(found);
            continue;
        }
        const packManifest = readJson(found.manifest, `the pack manifest for \`${found.name}\``);
        // **A shadowed pack is a could-not-run, not a resolution** (#316). Two roots answered for one
        // declared name and the invocation does not say which the caller meant, so this compiler has
        // no honest way to pick — and unlike `doctor`, which reports and never grades because an
        // install state is a fact about a machine rather than a verdict about the repository, this one
        // does not report: it EMITS. Picking silently wrote the discovered copy's fragments into the
        // artifact while `verify/compile.sh` read the tree's, which on this project's own host meant a
        // `git commit --no-verify` matcher that the tree had deliberately removed as false coverage.
        //
        // **Refused at RESOLUTION, so `--check` and the write path inherit one rule.** Refusing only
        // on write would make one tool answer one ambiguity two ways: the check would go on adopting
        // the discovered world and exit 1 — asserting that the *repository* drifted when it had not.
        // An exit code is the machine-read API, and a false 1 is a false verdict about the tree.
        //
        // **Every unasked shadow refuses, including one whose manifests agree**, which reads as
        // over-strict until you follow the bytes: `recordedOrigin` tags the answering root into
        // `$portulan.packs[].origin`, so a discovered answer emits `discovered` where the rail's
        // artifact says `tree`. Agreement in the manifests is therefore not agreement in the artifact,
        // and a carve-out for it would ship a compile that still reds the recipe it was meant to
        // reconcile with. The message distinguishes the two cases; the refusal does not.
        //
        // **Only where the caller did not choose.** `--pack-root auto` is discovery ELECTED, and
        // electing it is the choice this refusal exists to ask for. Both spellings are offered in the
        // message, because naming only the tree would make the refusal decide the question it claims
        // to be handing back.
        //
        // **The `named` half of this guard is defence in depth, and that was measured rather than
        // assumed.** Forcing the condition to `true` — refuse unconditionally — leaves the named-root
        // case still passing: a named root REPLACES the derived one, so the plan carries no discovered
        // root, `shadowedCopy` finds nothing behind, and there is no shadow to refuse. The protection
        // is structural. The clause stays because it states the intent at the site where a future
        // change to `resolutionRoots` could quietly make it load-bearing.
        if (!(options.forced ?? false) && plan.source !== "named") {
            const behind = shadowedCopy(found.name, recordedOrigin(found.root, plan, workspaceRoot), roots, (r) =>
                (plan.origins ?? []).find((o) => path.resolve(o.root) === path.resolve(r))?.origin,
            );
            if (behind) {
                let other = null;
                try {
                    other = JSON.parse(fs.readFileSync(behind.manifest, "utf8"));
                } catch (cause) {
                    throw new CompileError(
                        `\`${found.name}\` resolved under the root ${found.root} while the root ` +
                            `${path.relative(workspaceRoot, behind.root)} also carries it, ` +
                            `and that second copy could not be read (${cause.message}) — so which one this would compile from could not be established. ` +
                            "Name the root: `--pack-root packs` compiles from the tree, `--pack-root auto` from the installed copy.",
                    );
                }
                const differs = packDifferences(packManifest, other);
                // **Both ROOTS by path — the roots, not the pack directories.** `resolvePack` returns
                // both, and a first cut printed `dir` (`<root>/<category>/<pack>`) while calling it a
                // root: a diagnostic that mislabels the thing it names, in a message whose own claim is
                // to name both roots. The root is also the more useful of the two, because it is what a
                // reader types back into `--pack-root`. A refusal naming only one hands back a choice
                // while withholding half of what it is between. Printing the absolute path is safe in a
                // way it is not in `$portulan.packs`: this is stderr, read once by a human, never a
                // tracked artifact, so #264's origins-never-paths rule (which exists to stop a
                // machine-dependent path being committed) does not reach it. `doctor` already prints it
                // in its resolves-from note, so the two tools now name the same two directories.
                //
                // **"Discovered on this host", never "outside this repository".** Discovery reads a
                // record under `CLAUDE_CONFIG_DIR`, which a hermetic run can point INSIDE the tree — so
                // a discovered root is not necessarily an external one, and the message must not assert
                // a location it has not tested. `recordedOrigin` keeps `discovered` and `outside-tree`
                // as separate answers for exactly this reason: where a root came from and where it sits
                // are different questions, and the path is printed right there for a reader who wants
                // the second one. Caught by review after the first cut conflated them.
                throw new CompileError(
                    `\`${found.name}\` is SHADOWED — it resolved under ${found.root}, a root discovered on this ` +
                        `host, while the root ${path.relative(workspaceRoot, behind.root)} also carries it. ` +
                        (differs.length
                            ? `They differ by ${differs.join(" and ")}, so the two roots compile to different policies. `
                            : "Their manifests agree, but the emitted artifact still records which root answered, so the two roots compile to different bytes. ") +
                        "Refusing to pick: name the root instead — `--pack-root packs` compiles from the tree, which is what " +
                        "`verify/compile.sh` checks, and `--pack-root auto` compiles from the installed copy.",
                );
            }
        }
        const fragments = packManifest?.contributes?.gates;
        // Checked here rather than left to `composeFragments` iterating it: a manifest is a file a
        // human edits, `doctor` may not have run (the two tools have no ordering between them), and a
        // non-array here would surface as a bare TypeError naming neither the pack nor the field.
        // `?? []` covers absent, not malformed — those are different failures and only one is benign.
        if (fragments !== undefined && !Array.isArray(fragments)) {
            throw new CompileError(
                `the pack manifest for \`${found.name}\` declares \`contributes.gates\` as ` +
                    `${Array.isArray(fragments) ? "an array" : typeof fragments} rather than an array. ` +
                    `Refusing to compose it — run \`doctor\` to validate the pack against the Pack Definition.`,
            );
        }
        contributions.push({
            pack: found.name,
            dir: found.dir,
            fragments: fragments ?? [],
            // **Provenance, recorded per pack**, so the artifact this compiles into can say what
            // compiled it (#264). `version` comes from `portulan.version` — the pack manifest's own
            // location for it, not a top-level `version` — and its ABSENCE is recorded as such rather
            // than as a blank, because "this pack declares no version" and "I did not look" are
            // different facts and only one of them is the pack's.
            origin: recordedOrigin(found.root, plan, workspaceRoot),
            version: typeof packManifest?.portulan?.version === "string" ? packManifest.portulan.version : null,
        });
    }
    // `plan` travels with the result because every consumer prints it: which source won, and the path
    // it won with, is what tells a feed resolution from a local one.
    return { contributions, unresolved, plan };
}

/**
 * Compose pack-contributed fragments onto a workspace policy. **Tighten-only, and it throws.**
 *
 * A demotion is refused loudly rather than dropped quietly, because the two are not the same event: a
 * backend refusing a rule it cannot express is a coverage gap, while a pack moving `gated` to
 * `propose` is an attempt to disarm a gate, and a build that continues past it has published an
 * artifact weaker than the policy it claims to compile. Failing closed is right *here* and wrong in
 * ./gate.mjs for a reason worth keeping straight: this runs at build time against a file you
 * can edit, while that runs on every tool call and a refusal there makes the session undriveable.
 *
 * `auto` is barred by the Pack Definition's tier enum, so a schema-valid pack cannot express a
 * demotion to unattended at all. It is checked again here anyway — this compiler does not depend on
 * the schema having been applied, and an unranked tier reaching the comparison would otherwise sort
 * below everything and read as a tightening of nothing.
 */
export function composeFragments(policy, contributions) {
    const rules = [...(policy?.rules ?? [])];
    const at = new Map(rules.map((rule, i) => [rule?.id, i]));
    const added = [];
    const tightened = [];

    for (const { pack, fragments } of contributions) {
        for (const fragment of fragments ?? []) {
            const id = fragment?.id;
            // **The id is validated HERE even though `parse` validates it too, and the duplication is
            // the point** (#111). Composition deliberately runs BEFORE `parse`, so that a fragment is
            // graded by exactly the code that grades a hand-written rule — but that ordering means a
            // malformed id survives composition and surfaces from `parse` with **no pack context at
            // all**: `rule id undefined is not a slug`, which sends an adopter to audit their own
            // `gates.json`, the one file that is not at fault. Every other refusal in this loop names
            // the contributing pack, because naming the dependency is what the merge step is for.
            //
            // It fails closed either way — `parse` refuses the composed policy and nothing invalid
            // compiles — so this is a diagnostic repair, not a correctness one, and it is written down
            // as such.
            //
            // **It also closes a path the issue did not name.** `at` is keyed by `rule?.id`, so with no
            // check here a SECOND id-less fragment finds `at.has(undefined)` true and is composed onto
            // the first one — two unrelated fragments from two packs merged because they were equally
            // malformed, reported as a tightening of a rule that does not exist.
            if (typeof id !== "string" || !SLUG.test(id)) {
                throw new CompileError(
                    `pack \`${pack}\` contributes a fragment whose id is ${JSON.stringify(id)}, which is not a slug. ` +
                        "Ids are referenced from prose and must be greppable, and a fragment without one cannot be " +
                        "matched against the policy it means to tighten. Fix the pack, not the workspace's own gate policy.",
                );
            }
            const rank = tierRank(fragment?.tier);
            if (rank < 0) {
                throw new CompileError(
                    `pack \`${pack}\` contributes fragment \`${id}\` with tier ${JSON.stringify(fragment?.tier)}, ` +
                        `which is not one of ${TIER_ORDER.join(" / ")}. An unrecognised tier is not a fragment to skip.`,
                );
            }
            if (fragment.tier === "auto") {
                throw new CompileError(
                    `pack \`${pack}\` contributes fragment \`${id}\` at tier \`auto\`. A pack may only ADD ` +
                        `restriction, and \`auto\` is the absence of it — the Pack Definition leaves \`auto\` out ` +
                        `of the tier enum for this reason.`,
                );
            }
            if (!at.has(id)) {
                at.set(id, rules.length);
                rules.push(fragment);
                added.push({ pack, id, tier: fragment.tier });
                continue;
            }
            const base = rules[at.get(id)];
            const baseRank = tierRank(base?.tier);
            // The base's tier must BE a tier before any comparison means anything. Without this,
            // `tierRank` returns -1 for a malformed base and every fragment outranks it, so the
            // refusal below never fires and the fragment REPLACES the malformed rule — a policy
            // `parse` refuses on its own compiles green once a pack happens to name the same id.
            // Measured: a base rule at tier `bogus` was refused by `parse` alone, and accepted after
            // composition, reported as `tightens bogus → gated`. That is a fail-open in gate
            // machinery healed by a dependency, and the printed provenance claims a tightening from
            // a tier that is not one. Found by review, in the suppressed channel.
            if (baseRank < 0) {
                throw new CompileError(
                    `pack \`${pack}\` contributes a fragment for \`${id}\`, but the policy's own rule \`${id}\` ` +
                        `declares tier ${JSON.stringify(base?.tier)}, which is not one of ${TIER_ORDER.join(" / ")}. ` +
                        `Refusing to compose onto a rule whose tier cannot be compared — fix the workspace's gate ` +
                        `policy first. A pack must never be able to make an invalid policy compile.`,
                );
            }
            // A tier is not the whole rule. Raising the tier while REPLACING the action removes the
            // matcher and passes every rank comparison — measured on this repository's own policy: a
            // fragment `{id: force-push-without-a-lease, tier: prohibited, action: {none: …}}` was
            // reported as `tightens gated → prohibited` and the emitted `Bash(git push --force:*)`
            // gate DISAPPEARED, leaving the workspace strictly less cautious about the exact action
            // the rule exists to gate. Ids are greppable by design and ship in core, so knowing one
            // is not a barrier. A pack may raise a rule's tier; it may not redefine what the rule
            // matches. Found by the pre-commit supervisor, which is the checkpoint's whole argument.
            if (rank <= baseRank) {
                throw new CompileError(
                    `pack \`${pack}\` would move rule \`${id}\` from \`${base?.tier}\` to ` +
                        `\`${fragment.tier}\`, which does not tighten it. Packs may only tighten: a pack may ` +
                        `raise a tier or add a prohibition, never demote another layer's classification ` +
                        `(../.portulan/proposals/0010-prohibited-as-a-fourth-universal-tier.md). The workspace ` +
                        `owns its own policy and may still set this tier in its own gate map.`,
                );
            }
            const shape = (rule) => {
                const action = rule?.action;
                if (!action || typeof action !== "object" || Array.isArray(action)) return null;
                const kinds = Object.keys(action);
                return kinds.length === 1 ? `${kinds[0]}:${action[kinds[0]]}` : null;
            };
            const here = shape(fragment);
            const there = shape(base);
            if (here === null || there === null || here !== there) {
                throw new CompileError(
                    `pack \`${pack}\` would tighten rule \`${id}\` to \`${fragment.tier}\` while CHANGING what it ` +
                        `matches (${there ?? "unreadable"} → ${here ?? "unreadable"}). A pack may raise a rule's ` +
                        `tier; it may not redefine the action, because replacing the matcher removes the gate ` +
                        `while every tier comparison still reads as a tightening. To gate a different action, ` +
                        `contribute a NEW id; to change what an existing rule matches, edit the workspace's own ` +
                        `gate map, which owns its policy.`,
                );
            }
            rules[at.get(id)] = fragment;
            tightened.push({ pack, id, from: base.tier, to: fragment.tier });
        }
    }
    return { policy: { ...policy, rules }, added, tightened };
}

function readJson(file, what) {
    let raw;
    try {
        raw = fs.readFileSync(file, "utf8");
    } catch (error) {
        throw new CompileError(`cannot read ${what} at ${file} — ${error.code ?? error.message}`);
    }
    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new CompileError(`${what} at ${file} is not valid JSON — ${error.message}`);
    }
}

/** The emitted artifact, as text. One writer, so `--check` compares what `--write` would produce. */
export function render(settings) {
    return `${JSON.stringify(settings, null, 2)}\n`;
}

/**
 * Print the per-host backend matrix.
 *
 * The criterion asks for the floor backend to be "positioned in the matrix as the floor backend:
 * what every host falls back to, and all that a host with no hook system has" — so the matrix says
 * that in words rather than leaving a reader to infer it from a column heading.
 */
function printMatrix(say, parsed, columns, { source }) {
    say(`gate policy: ${source} — ${parsed.rules.length} rule(s), ${columns.length} backend(s)`);
    say();
    for (const column of columns) {
        say(`  ${column.label.padEnd(28)} ${column.compiled.length} compiled, ${column.refused.length} refused` +
            (column.artifact ? ` → ${column.artifact.path}` : " → no artifact"));
    }
    say();
    say("  The GitHub repository ruleset is the FLOOR backend: what every host falls back to, and all");
    say("  that a host with no hook system has. It holds when everything above it fails, and it is the");
    say("  only layer here indifferent to how a command was spelled.");
    say();

    const rows = matrix(parsed, { source });
    const width = Math.max(4, ...rows.map((r) => r.id.length));
    say(`  ${"rule".padEnd(width)}  ${columns.map((c) => c.backend.padEnd(16)).join("  ")}`);
    for (const row of rows) {
        say(`  ${row.id.padEnd(width)}  ${columns.map((c) => row.backends[c.backend].verdict.padEnd(16)).join("  ")}`);
    }
    say();

    // The honest degradation signal, and the reason the matrix is worth printing at all: not which
    // backend is fuller, but what this policy declares that NOTHING enforces.
    //
    // Split by tier, because the two halves mean opposite things and printing them together would
    // pad the alarming number with a harmless one. An `auto` rule compiled by no backend is the
    // system working — unattended is what that tier means. A `gated` or `prohibited` rule compiled
    // by no backend is a gate that exists only as a sentence, which is the thing this product is
    // against. Reporting eight where three are real is how a report gets skimmed.
    const uncovered = rows.filter((r) => columns.every((c) => r.backends[c.backend].verdict === "refused"));
    const gaps = uncovered.filter((r) => r.tier === "gated" || r.tier === "prohibited");
    const unattended = uncovered.filter((r) => r.tier === "auto");

    if (gaps.length === 0) {
        say("  Every gate in this policy is compiled by at least one backend.");
    } else {
        say(`  ${gaps.length} GATE(S) no backend compiles — declared here and enforced by nothing but a habit:`);
        for (const row of gaps) say(`    ${row.id.padEnd(width)}  ${row.tier}`);
    }
    if (unattended.length) {
        say(`  (${unattended.length} \`auto\` rule(s) are compiled by no backend, which is what that tier means.)`);
    }
}

/**
 * What `--workspace <dir>` names, and where the workspace inside it lives.
 *
 * Two shapes, told apart by **`tree`** — the one thing proposal 0017 says is keyed to location, and the
 * same key `cli/vendor.mjs` reads to decide a residence:
 *
 * - `<dir>` is a **repository root** — no manifest here, so the workspace is at `.portulan` and this is
 *   byte-identical to what this tool did before the distinction existed.
 * - `<dir>` is a **workspace directory** — it holds `workspace.json`. A manifest declaring `tree`
 *   resolves back to the repository it governs; one declaring none is feed-side, and *is* its own root,
 *   because an installed plugin's directory is the workspace root.
 *
 * Nothing here validates the manifest. `doctor` judges manifests and these two tools have no ordering
 * between them — this one only needs to know where the policy is.
 *
 * **`workspaceRoot` is returned as given on the repository-root branch and resolved on the other two,
 * and that asymmetry is deliberate rather than an oversight.** The repository-root branch is the path
 * every existing caller takes, including `.portulan/verify/compile.sh`'s `--workspace .`; returning the
 * argument verbatim is what keeps this change byte-identical for them, output included — `compile` joins
 * this value into the paths it PRINTS, so resolving it here would turn `.claude/settings.json` into an
 * absolute path in every run, for no defect. The other two branches derive a path rather than echoing
 * one, and a derived path has to be absolute to mean anything. Raised as an inconsistency by Copilot
 * (round 10 on #164) and declined on that ground; the contract is stated here rather than changed.
 */
export function resolveWorkspace(named) {
    const dir = path.resolve(named);
    const manifestPath = path.join(dir, "workspace.json");
    let raw;
    try {
        raw = fs.readFileSync(manifestPath, "utf8");
    } catch (cause) {
        // **Only `ENOENT` means "this is not a workspace directory".** Anything else — `EACCES` above
        // all — means the question could not be answered, and falling back to `.portulan` would answer
        // it *no* and then fail somewhere else with a confusing secondary error about a policy file.
        // The first cut of this function caught everything, which is the fail-open — "nothing looked"
        // reported as "nothing wrong" — committed in a change whose own header states the rule three times.
        // Copilot, round 1 on #164.
        if (cause.code === "ENOENT") return { workspaceRoot: named, workspaceDir: ".portulan" };
        throw new CompileError(
            `${manifestPath} could not be read — ${cause.code ?? cause.message}. Only a MISSING manifest means ` +
                `\`${named}\` is a repository root; refusing to assume \`.portulan\` on a question nothing could answer`,
        );
    }
    let manifest;
    try {
        manifest = JSON.parse(raw);
    } catch (cause) {
        throw new CompileError(
            `${manifestPath} is not valid JSON — ${cause.message}. A manifest is present and unreadable, which is ` +
                `not the same as absent: treating it as absent would compile a policy from somewhere this workspace never named`,
        );
    }
    if (typeof manifest?.tree === "string" && manifest.tree.trim()) {
        const root = path.resolve(dir, manifest.tree);
        const inside = path.relative(root, dir);
        // A `tree` that does not contain its own workspace is a manifest `doctor` refuses; here it just
        // means the derivation cannot be trusted, so the safe answer is the one that changes nothing.
        if (inside && !inside.startsWith("..") && !path.isAbsolute(inside)) {
            return { workspaceRoot: root, workspaceDir: inside.split(path.sep).join("/") };
        }
        return { workspaceRoot: named, workspaceDir: ".portulan" };
    }
    return { workspaceRoot: dir, workspaceDir: "." };
}

/**
 * The help screen — see `./doctor.mjs`'s for the contract and why these three gained one late.
 * `../.portulan/dod.md` condition 4 binds it: every flag below exists in the parser above.
 */
function usage() {
    return [
        "portulan compile — compile a workspace's gate policy into host enforcement",
        "",
        "  portulan compile [--check] [--matrix] [--workspace <dir>] [--pack-root <dir>|auto]...",
        "",
        "  (no flag)     compile the policy and write each backend's artifact",
        "  --check       write nothing; exit 1 if an artifact is out of date against the policy",
        "  --matrix      print every rule against every backend, and the gates neither compiles",
        "  --workspace   the workspace directory to compile; defaults to `.portulan`",
        "  --pack-root   where declared packs are resolved from; `auto` discovers the host's plugin cache.",
        "                A named root REPLACES every other source. A directory actually named `auto` is `./auto`",
        "",
        "The compiler emits RESTRICTION only: `auto` and `propose` compile to nothing in the Claude Code",
        "backend by design, and the partition inverts in the repository ruleset, which is the floor.",
        "",
        "Exit codes: 0 succeeded · 1 a red verdict · 2 could not run.",
    ].join("\n");
}

export function run(argv, options = {}) {
    const say = (line = "") => {
        if (!options.quiet) process.stdout.write(`${line}\n`);
    };
    // **Before every other argument decision**, so asking for help cannot be outranked by a
    // complaint about the rest of the command line. `./portulan.mjs` states the contract: an
    // explicit `--help` exits 0, because asking for help is a request and it succeeded.
    if (argv.includes("--help") || argv.includes("-h")) {
        say(usage());
        return 0;
    }
    try {
        let named = process.cwd();
        let check = false;
        let showMatrix = false;
        // Named pack roots, which REPLACE the root derived from `tree` rather than being searched ahead
        // of it — see `namedRootsOption` for why that distinction cost a checkpoint finding.
        // `packContributions` has taken `options.packRoots` since session 0 — shaped so that an adopter
        // resolving from an installed feed travels the same code path as a workspace whose packs ship
        // beside it — and nothing ever set it, so the parameter was reachable only from a test.
        // Discovery of a host's plugin cache landed at milestone 7 for BOTH halves (#123): ./discover.mjs
        // dereferences a POINTER's `governed_by`, and `--pack-root auto` resolves a pack root from the same
        // record.
        //
        // **Discovery IS the default as of 2026-08-13**, and this comment said the opposite — *"what is
        // deliberately NOT taken is a DEFAULT … defaulting it would change what every existing run
        // resolves against"*. It would, and the maintainer ruled the change: row 7's clause makes
        // `--pack-root` *optional where discovery finds a root*, and it was not. Both of the old
        // sentence's grounds survive where they were actually load-bearing — a **named** root still
        // REPLACES the derived one (#117, untouched, the arm above), and a required check's verdict still
        // cannot move with the machine, because `../.portulan/verify/compile.sh` **names its root** and
        // `./pinned-roots.live.test.mjs` reds if it stops. What changed is which carrier holds that
        // second guarantee: the pin, not the absence of a default.
        const namedRoots = [];
        let forced = false;
        for (let i = 0; i < argv.length; i += 1) {
            if (argv[i] === "--check") check = true;
            else if (argv[i] === "--matrix") showMatrix = true;
            else if (argv[i] === "--workspace") {
                named = argv[i + 1];
                i += 1;
                if (named === undefined) throw new CompileError("--workspace needs a directory");
            } else if (argv[i] === "--pack-root") {
                const root = argv[i + 1];
                i += 1;
                // A SINGLE leading `-` is refused too, not just `--`: `--pack-root -h` would otherwise
                // consume the flag as a path and fail later as an unreadable one. `doctor` already read
                // it this way, so this aligns the three rather than inventing a rule. A directory whose
                // name really begins with `-` is `./-name`, the same escape `auto` takes.
                if (root === undefined || root.startsWith("-"))
                    throw new CompileError(
                        "--pack-root needs a directory, or `auto` to discover one from the host plugin cache. " +
                            "A directory actually named `auto` is `./auto`",
                    );
                // The keyword, matched on the RAW argument before `path.resolve`, so a directory
                // genuinely named `auto` is still reachable as `./auto`. See ./discover.mjs.
                if (root === AUTO) {
                    forced = true;
                    continue;
                }
                // A root that is not there is a fact about the filesystem, not a pack that failed to
                // resolve — and reporting it as the latter sends an author to the one file that is not
                // at fault. Same distinction as ../.portulan/memory/verify-preconditions-fail-closed.md.
                //
                // A FILE is the sharper case here than in the other two tools, and the reason is what this
                // one emits: a file-valued root made resolution fail and produced a **misleading green
                // compile** that had simply ignored the intended root. A green is what a session acts on,
                // so it is worse than the exit 2 the argument deserves. Third carrier of one rule, found by
                // Copilot on #117, round 7 — the sibling class the 2026-07-27 ruling names.
                let rootStat = null;
                try {
                    rootStat = fs.statSync(root);
                } catch (cause) {
                    throw new CompileError(
                        `--pack-root ${root} cannot be read — ${cause.code ?? cause.message}. Refusing to report a pack unresolvable against a root nothing looked in`,
                    );
                }
                if (!rootStat.isDirectory()) {
                    throw new CompileError(
                        `--pack-root ${root} is not a directory — a resolution root is a directory packs are looked up under`,
                    );
                }
                namedRoots.push(path.resolve(root));
            } else throw new CompileError(`unknown argument ${JSON.stringify(argv[i])}`);
        }

        // Refused HERE — the last statement of the argument parse, before a workspace is resolved or a
        // policy read. It sat below both until Copilot's round 2, where an unrelated workspace or
        // policy error masked the refusal and this tool disagreed with the four beside it about *when*
        // the answer is given. The other tools' tests pin exactly that property; this one's did not,
        // which is why the placement could drift here and nowhere else.
        const bothAsked = namedWithAuto(namedRoots, forced);
        if (bothAsked) throw new CompileError(bothAsked);

        // The workspace may be named as a repository root or as the workspace directory itself, and the
        // second is how a feed-side workspace is reachable at all — see `resolveWorkspace`.
        const { workspaceRoot, workspaceDir } = resolveWorkspace(named);
        const { file: policyFile, declared: policyDeclared, reason: policyReason } = policyDeclaration(workspaceRoot, workspaceDir);
        // **Declared-and-missing and never-declared are different answers.** Only the first is a
        // failure to read something this workspace claimed to have; the second is a shape `policyPath`
        // documents as legitimate, and reporting it as `ENOENT` sent readers hunting for a deleted
        // file. Checked here rather than inside the reader because only the caller knows to name what
        // the absence costs — see `undeclaredPolicyMessage`. The fallback arm is itself FOUR states,
        // and `policyReason` is what lets the message name the one it is in rather than assert the
        // commonest: this comment read "two different answers" while the code below had four.
        if (!policyDeclared && !fs.existsSync(policyFile)) {
            throw new CompileError(
                undeclaredPolicyMessage(
                    policyFile,
                    workspaceRoot,
                    workspaceDir,
                    { named: namedRoots, discovery: () => discoverPackRoots(), forced },
                    policyReason,
                ),
            );
        }
        const policy = readJson(policyFile, "the gate policy");
        // The cascade's middle layer, composed before the policy is parsed so that a pack's fragment
        // is validated by exactly the code that validates a hand-written rule.
        // The thunk means the host's plugin record is read only on a path where it can win — which is
        // still true of the **named** and **refused** arms and is no longer what keeps `compile --check`
        // host-independent. That sentence read *"a required check that names no root"*, and since
        // 2026-08-13 `../.portulan/verify/compile.sh` runs `--pack-root packs --check`: it names one, and
        // a named root replaces every other source. The pin is the carrier; the thunk is what keeps an
        // API caller wiring none hermetic.
        const { contributions, unresolved, plan } = packContributions(workspaceRoot, workspaceDir, {
            named: namedRoots,
            discovery: () => discoverPackRoots(),
            forced,
        });
        // Under `--matrix` only, EXCEPT when the set is a union: that line moves with what is
        // installed, which is why it is normally withheld from a byte-compared run — but a union is the
        // one arrangement where a tree-derived root joined the search without anyone naming it, and the
        // whole contract of the union is that this is never silent.
        //
        // **`--check` CAN reach it now, and that is the point rather than a leak.** This read *"`--check`
        // cannot reach it: it names no root and passes no `auto`, so `forced` is false and the plan is
        // never a union there"* — all three clauses went false on 2026-08-13, when the unasked arm began
        // consulting discovery. A `--check` run whose resolution set included a discovered root and said
        // nothing would be the silent substitution `--pack-root auto`'s own justification refuses, so the
        // line prints. The **required** check reaches neither, because it names a root: `source` is
        // `named` there and this condition is false for the right reason.
        if (plan && (showMatrix || plan.source === "union")) say(`packs: resolution root ${plan.source} — ${plan.why}`);
        const composed = composeFragments(policy, contributions);
        const parsed = parse(composed.policy);
        const source = path.relative(workspaceRoot, policyFile).split(path.sep).join("/");
        // `root` is what makes the emitted runner path correct for the workspace being compiled rather
        // than for the one this process happens to sit in. The plumbing existed and **the caller never
        // used it**: `compile --workspace <other-project>` wrote that project's settings naming
        // `${CLAUDE_PROJECT_DIR}/cli/stop-gate.mjs`, a file the target does not have — and a missing hook
        // fails open, silently. That is the exact defect class this whole change exists to close,
        // reintroduced through the cross-compile path. Found by the pre-commit checkpoint, which
        // demonstrated it rather than reasoning about it.
        const columns = backends(parsed, {
            source,
            root: path.resolve(workspaceRoot),
            workspaceDir,
            // What resolved each pack, carried to the artifact so the file the rail compares says
            // which world compiled it (#264).
            packProvenance: contributions,
        });

        // Printed before the backends, because a rule's provenance changes how its compiled line reads
        // — and an unresolvable pack is a declaration the workspace believes it composed.
        for (const a of composed.added) say(`pack    ${a.pack.padEnd(30)} adds \`${a.id}\` (${a.tier})`);
        for (const t of composed.tightened) {
            say(`pack    ${t.pack.padEnd(30)} tightens \`${t.id}\` ${t.from} → ${t.to}`);
        }
        for (const u of unresolved) {
            say(`pack    ${u.name.padEnd(30)} UNRESOLVED — ${u.why}; it contributes nothing`);
        }
        if (composed.added.length || composed.tightened.length || unresolved.length) say();

        if (showMatrix) {
            printMatrix(say, parsed, columns, { source });
            return 0;
        }

        for (const column of columns) {
            say(`${column.label}: ${column.compiled.length} compiled, ${column.refused.length} refused`);
            for (const gate of column.compiled) say(`  gate    ${gate.id.padEnd(38)} ${gate.surface}`);
            // Refusals are printed, always. A silent cap reads as "covered everything" when it did
            // not — and these are the rows the per-host degradation report is built from.
            for (const r of column.refused) say(`  refused ${r.id.padEnd(38)} ${r.why}`);
            for (const n of column.notes) say(`  note    ${n}`);
            say();
        }

        if (check) {
            let drifted = 0;
            for (const column of columns) {
                // A backend with no artifact is owed no file — but *present* and not owed is drift,
                // and it was the hole here for one checkpoint. Deleting `floor` from a policy left
                // the ruleset behind: importable, valid, and claiming in its own `name` field to be
                // generated from a policy that no longer produces it. `--check` reported GREEN,
                // having compared nothing, which is the shape this recipe exists against. The
                // eighth fail-open of this repository's series, and again in scaffolding rather than
                // in a check. Found at the pre-commit checkpoint.
                if (!column.artifact) {
                    const orphan = path.join(workspaceRoot, ...artifactPaths(workspaceDir)[column.backend].split("/"));
                    if (fs.existsSync(orphan)) {
                        say(`RED — ${orphan} exists and ${policyFile} no longer compiles to it. Recompile to remove it.`);
                        drifted += 1;
                    }
                    continue;
                }
                const file = path.join(workspaceRoot, ...column.artifact.path.split("/"));
                let current = null;
                try {
                    current = fs.readFileSync(file, "utf8");
                } catch {
                    say(`RED — ${file} does not exist; the policy declares enforcement that nothing carries`);
                    drifted += 1;
                    continue;
                }
                if (current !== column.artifact.text) {
                    // **Name the origin difference AT THE MOMENT OF FAILURE** (#264). A drift caused by
                    // a shadowed pack was previously reported as a diff nobody could reproduce from the
                    // files in front of them, because the deciding input was a directory outside the
                    // repository — and the remedy the sentence prescribed, "Recompile", is the very
                    // unpinned act that caused it. Read DEFENSIVELY: the artifact on disk is a file a
                    // human may have edited, so anything unparseable leaves the plain sentence standing
                    // rather than turning a drift report into a crash.
                    let why = "";
                    try {
                        const onDisk = JSON.parse(current)?.$portulan?.packs;
                        const mine = JSON.parse(column.artifact.text)?.$portulan?.packs;
                        if (Array.isArray(onDisk) && Array.isArray(mine)) {
                            const key = (p) => `${p.origin ?? "?"} ${p.version ?? "no version"}`;
                            const byName = new Map(mine.map((p) => [p.pack, p]));
                            const moved = onDisk
                                .filter((p) => byName.has(p.pack) && key(byName.get(p.pack)) !== key(p))
                                .map((p) => `\`${p.pack}\` was compiled from the ${key(p)} copy; this check reads the ${key(byName.get(p.pack))} one`);
                            if (moved.length) {
                                why =
                                    `\n      ${moved.join("\n      ")}` +
                                    "\n      That is a different world, not a stale file: recompile with the root this check uses" +
                                    `\n      — \`node cli/compile.mjs --workspace . --pack-root packs\` — rather than bare, or the drift returns.`;
                            }
                        }
                    } catch {
                        // Unparseable or hand-edited. The plain sentence below is still true.
                    }
                    say(`RED — ${file} has drifted from ${policyFile}. Recompile.${why}`);
                    drifted += 1;
                }
            }
            if (drifted) return 1;
            say("GREEN — every emitted artifact matches the policy");
            return 0;
        }

        for (const column of columns) {
            if (!column.artifact) {
                // Remove a stale artifact rather than leaving it for `--check` to complain about
                // forever: the RED above tells a reader to recompile, so recompiling has to be what
                // fixes it. Deleting a generated file this compiler wrote is the one deletion it may
                // do — it is reproducible by definition, and it is already in git if it mattered.
                const orphan = path.join(workspaceRoot, ...artifactPaths(workspaceDir)[column.backend].split("/"));
                if (fs.existsSync(orphan)) {
                    fs.rmSync(orphan);
                    say(`removed ${orphan} — the policy no longer compiles to it`);
                }
                say(`${column.label}: nothing to write — ${column.refused.length} rule(s) refused, listed above`);
                continue;
            }
            const file = path.join(workspaceRoot, ...column.artifact.path.split("/"));
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, column.artifact.text);
            say(`wrote ${file}`);
        }
        return 0;
    } catch (error) {
        // Anything reaching here means compile could not judge — including a defect in compile
        // itself. Exit 2. Exit 1 would assert that an artifact drifted when nothing was compared,
        // and exit 0 would be the fail-open this tool exists against.
        if (!options.quiet) {
            process.stderr.write(
                `compile: ${error instanceof CompileError ? error.message : `unanticipated failure — ${error.stack ?? error}`}\n`,
            );
        }
        return 2;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = run(process.argv.slice(2));
}
