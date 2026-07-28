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
import { pathToFileURL } from "node:url";

/** Raised when `compile` cannot run, or cannot compile honestly. Always exit 2, never 1. */
export class CompileError extends Error {
    constructor(message) {
        super(message);
        this.name = "CompileError";
    }
}

// The versions of the Workspace Definition whose gate policy this compiler understands. Checked
// rather than ignored: `doctor` shipped for a day reading no version at all, so a manifest naming a
// spec that had never existed validated green. Same class of hole, closed at birth this time.
//
// 2.1 stays known: the `floor` key 2.2 adds is optional, so a 2.1 policy is still a policy this
// compiler reads correctly — it simply declares no floor, which is a legitimate shape and the one
// every workspace had yesterday.
const KNOWN_SPECS = new Set(["2.1", "2.2"]);

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
    if (!KNOWN_SPECS.has(String(spec))) {
        throw new CompileError(
            `gate policy declares Workspace Definition ${JSON.stringify(spec)}, which this compiler does not implement ` +
                `(knows: ${[...KNOWN_SPECS].join(", ")}). Refusing rather than compiling a policy it may misread.`,
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
        // The value is interpolated into the host's permission DSL — `Bash(prefix:*)`, `Edit(./path)`.
        // Characters that are structural THERE would emit a rule the host parses differently from what
        // the policy meant, and an ambiguous gate is indistinguishable from an absent one. Refuse rather
        // than escape: a workspace needing a gate on a command containing `(` or `:` needs this
        // compiler extended deliberately, not quietly reinterpreted. Found by review on the pull request.
        const RESERVED = kind === "shell" ? /[()\n\r\t:]/ : /[()\n\r\t]/;
        if (RESERVED.test(action[kind])) {
            throw new CompileError(
                `rule \`${id}\`'s ${kind} target ${JSON.stringify(action[kind])} contains a character that is ` +
                    `structural in the host's permission syntax. Emitting it would produce a rule the host reads ` +
                    `differently from what this policy says, which is worse than refusing to compile.`,
            );
        }
        if (action[kind] !== action[kind].trim()) {
            throw new CompileError(`rule \`${id}\`'s ${kind} target has leading or trailing whitespace, which the host would not match`);
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
// `../.portulan/compile/gate.mjs` imports these. It is the only thing outside this file that may.

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
            const end = command.indexOf(c, i + 1);
            text += end === -1 ? command.slice(i + 1) : command.slice(i + 1, end);
            open = true;
            i = end === -1 ? command.length : end;
            continue;
        }
        if (c === "\\" && i + 1 < command.length) {
            // A backslash-newline is a line continuation: both characters vanish, and the word
            // continues on the next line. Appending the newline instead would have glued it into the
            // middle of a path, which no target matches.
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
    // What that costs is not an exception some caller reports. ../.portulan/compile/gate.mjs catches
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
            if (c === quote) quote = null;
            continue;
        }
        if (c === "'" || c === '"') {
            quote = c;
            continue;
        }
        if (c === "\\") {
            i += 1;
            continue;
        }
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
        // ../.portulan/compile/gate.mjs, which reads only `gated` and `prohibited`. So nothing was
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
        if (tool === "Bash") return spellings(input.command).some((s) => shellWrites(s, action.write));
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
    const runner = options.runner ?? '"${CLAUDE_PROJECT_DIR}/.portulan/compile/gate.mjs"';
    const stopRunner = options.stopRunner ?? '"${CLAUDE_PROJECT_DIR}/.portulan/compile/stop.mjs"';

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
    const value = {
        $portulan: {
            generated: "cli/compile.mjs",
            source,
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
    if (shellWriteGates.length) {
        notes.push(
            `${shellWriteGates.length} write gate(s) — ${shellWriteGates.join(", ")} — also match a Bash command that writes the ` +
                `path: a \`>\`/\`>>\` redirection into it, or one of \`${[...FILE_WRITERS].join("`, `")}\` naming it, or ` +
                `\`${[...IN_PLACE_EDITORS].join("`/`")}\` under an in-place flag. This half is the HOOK's alone and therefore ` +
                `FAILS OPEN if the hook does: \`Bash(prefix:*)\` matches a command prefix while the path sits anywhere in the ` +
                `command, so no permission rule expresses it. A heredoc, an interpolated variable, a command assembled at ` +
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
        artifact: { path: ARTIFACT_PATHS["github-ruleset"], value, text: render(value) },
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

/** Every backend, run against one parsed policy. The order is the order the matrix prints in. */
export function backends(parsed, options = {}) {
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
 * Where a workspace's gate policy lives.
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
    const base = path.join(workspaceRoot, workspaceDir);
    const manifest = path.join(base, "workspace.json");
    try {
        const declared = JSON.parse(fs.readFileSync(manifest, "utf8")).gates;
        // Validated against the schema's `filePath` shape before it is used, and containment is
        // checked after resolution rather than by pattern alone — a `../` chain passes any regex and
        // still escapes. Without this, a malformed or hand-edited manifest turns a hook that runs on
        // EVERY tool call into an arbitrary file read outside the workspace. `doctor` would refuse such
        // a manifest, but this runner must not depend on `doctor` having been run: the two tools have
        // no ordering between them, and the schema is the contract, not the sequence. Found by review.
        if (typeof declared === "string" && declared.trim() && FILE_PATH.test(declared)) {
            const resolved = path.resolve(base, declared);
            const inside = path.relative(base, resolved);
            if (inside && !inside.startsWith("..") && !path.isAbsolute(inside)) return resolved;
        }
    } catch {
        // No manifest, or unreadable. `doctor` is the tool that judges a manifest; this one only needs
        // to know where the policy is, and the default is where it is when nothing says otherwise.
    }
    return path.join(workspaceRoot, workspaceDir, "gates.json");
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

export function run(argv, options = {}) {
    const say = (line = "") => {
        if (!options.quiet) process.stdout.write(`${line}\n`);
    };
    try {
        let workspaceRoot = process.cwd();
        let check = false;
        let showMatrix = false;
        for (let i = 0; i < argv.length; i += 1) {
            if (argv[i] === "--check") check = true;
            else if (argv[i] === "--matrix") showMatrix = true;
            else if (argv[i] === "--workspace") {
                workspaceRoot = argv[i + 1];
                i += 1;
                if (workspaceRoot === undefined) throw new CompileError("--workspace needs a directory");
            } else throw new CompileError(`unknown argument ${JSON.stringify(argv[i])}`);
        }

        const policyFile = policyPath(workspaceRoot);
        const policy = readJson(policyFile, "the gate policy");
        const parsed = parse(policy);
        const source = path.relative(workspaceRoot, policyFile).split(path.sep).join("/");
        const columns = backends(parsed, { source });

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
                    const orphan = path.join(workspaceRoot, ...ARTIFACT_PATHS[column.backend].split("/"));
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
                    say(`RED — ${file} has drifted from ${policyFile}. Recompile.`);
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
                const orphan = path.join(workspaceRoot, ...ARTIFACT_PATHS[column.backend].split("/"));
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
