#!/usr/bin/env node
// `compile` — the enforcement compiler.
//
//   node cli/compile.mjs [--workspace <dir>] [--check]
//
// Exit 0 wrote (or, with --check, agrees) · 1 the artifact has drifted · 2 could not run.
//
// Reads a workspace's gate policy (`gates.json`) and emits host enforcement. Today one backend:
// Claude Code `permissions` + `hooks`. The tier vocabulary and the action vocabulary are the
// WORKSPACE's, never a host's — a rule says `{"shell": "git push"}`, not `Bash(git push:*)` — so a
// second backend translates the same policy rather than forcing the policy to be rewritten. That
// separation is the whole of "LLM-agnostic by construction" (../docs/vision.md) at this layer, and
// it is cheapest to hold while exactly one backend exists.
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
const KNOWN_SPECS = new Set(["2.1"]);

const TIERS = new Set(["auto", "propose", "gated", "prohibited"]);

// Which tiers are gates. `auto` and `propose` are refused wholesale, on the maintainer's ruling of
// 2026-07-27: the compiler emits restriction only, never permission. A compiler whose output can
// only ever ADD a gate cannot loosen an existing check by having a bug — and the alternative,
// emitting `allow` for the Auto tier, would silence prompts the maintainer answers by hand today.
const GATE_TIERS = new Set(["gated", "prohibited"]);

const TIER_NOT_A_GATE = {
    auto: "tier `auto` is unattended by definition — there is nothing to enforce, and emitting an allow rule would loosen a check rather than add one",
    propose: "tier `propose` is enforced by the platform floor — pull requests, required checks, review — not by a tool-level permission rule on this machine",
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// The `filePath` shape from ../spec/workspace.schema.json, carried here rather than imported because
// this file has no dependencies by design. Relative, no fragment/query/colon, not a directory.
const FILE_PATH = /^[^#?:/]([^#?:]*[^#?:/])?$/;

/** The tools that can write a path, and the tools that can read one. */
const WRITE_TOOLS = ["Edit", "Write", "NotebookEdit"];
const READ_TOOLS = ["Read"];

// ===========================================================================================
// 1. Compile: policy -> an accounted-for set of gates
// ===========================================================================================

/**
 * Turn a gate policy into gates, accounting for every rule exactly once.
 *
 * Returns `{ compiled, refused }`. The two together always equal the input, which is asserted by
 * the suite rather than merely intended: the distinctive failure of a compiler that emits gate
 * machinery is a rule that goes in and nothing comes out, leaving a gate map that reads as
 * configured and a machine that enforces nothing.
 *
 * Anything it cannot compile refuses the WHOLE compile rather than dropping one rule — skipping and
 * enforcing are indistinguishable from outside
 * (../.portulan/memory/a-checker-must-refuse-what-it-cannot-check.md).
 */
export function compile(policy) {
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

    const compiled = [];
    const refused = [];
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
        // An absolute path target is refused rather than normalised, for the reason directly above.
        // `pattern()` and `matchesPath()` both strip the leading slash and compare against a
        // workspace-relative tail, so `"/etc/passwd"` would emit `Edit(./etc/passwd)` and match any
        // file whose path ends `/etc/passwd` — a gate enforcing something broader than, and different
        // from, what the policy declares. A workspace needing to gate a path outside its own tree
        // needs this compiler extended deliberately. Shell targets are exempt: `/usr/bin/git` is a
        // command spelling, not a path this compiler rewrites. Found by review on #31.
        if ((kind === "write" || kind === "read") && action[kind].startsWith("/")) {
            throw new CompileError(
                `rule \`${id}\`'s ${kind} target ${JSON.stringify(action[kind])} is an absolute path. Both the emitter ` +
                    `and the runtime matcher compare against a workspace-relative tail, so the gate enforced would be ` +
                    `broader than the one declared. Refusing rather than silently rewriting it.`,
            );
        }

        // --- the three ways a rule ends -------------------------------------------------------

        if (!GATE_TIERS.has(rule.tier)) {
            refused.push({ id, tier: rule.tier, why: TIER_NOT_A_GATE[rule.tier] });
            continue;
        }
        if (kind === "none") {
            // The policy itself states why there is no surface. The compiler reports those words
            // rather than inventing its own — a refusal explained by the tool is a refusal nobody
            // can review against the policy.
            refused.push({ id, tier: rule.tier, why: action.none });
            continue;
        }
        compiled.push({ id, tier: rule.tier, kind, target: action[kind], reason: rule.reason });
    }

    // A policy that declares gates and emits none must not report success. This is the workflow's
    // "declares no verify recipes — refusing to report green" one level down: the artifact would be
    // written, the gate map would read as compiled, and nothing would hold.
    const declaresGates = policy.rules.some((r) => GATE_TIERS.has(r.tier));
    if (declaresGates && compiled.length === 0) {
        throw new CompileError(
            "every gate in this policy refused to compile — refusing to write an artifact that enforces nothing while the policy claims gates",
        );
    }

    return { compiled, refused };
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
        const quote = inner[0];
        if ((quote === '"' || quote === "'") && inner.endsWith(quote) && inner.length > 1) {
            inner = inner.slice(1, -1);
        }
        if (inner.trim()) out.push(inner.trim());
    }
    return out;
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
        return spellings(input.command).some((s) =>
            action.shell.endsWith("/") ? s.startsWith(action.shell) : s === action.shell || s.startsWith(`${action.shell} `),
        );
    }
    if (typeof action.write === "string" && WRITE_TOOLS.includes(tool)) {
        return matchesPath(input.file_path ?? input.notebook_path, action.write);
    }
    if (typeof action.read === "string" && READ_TOOLS.includes(tool)) {
        return matchesPath(input.file_path, action.read);
    }
    return false;
}

// ===========================================================================================
// 3. The Claude Code backend
// ===========================================================================================

/** A workspace-relative path becomes a host permission pattern. A trailing `/` means the subtree. */
function pattern(tool, target) {
    const clean = target.replace(/^\.\//, "").replace(/^\/+/, "");
    const spec = clean.endsWith("/") ? `./${clean}**` : `./${clean}`;
    return `${tool}(${spec})`;
}

/**
 * Translate compiled gates into a Claude Code settings object.
 *
 * The mapping, each line of it measured against a running host rather than read from documentation:
 *
 *   prohibited -> permissions.deny  + a hook returning `deny`
 *   gated      -> permissions.ask   + a hook returning `ask`
 *
 * The hook returns the SAME decision as the permission rule on purpose. A hook returning `deny` for
 * a Gated action would turn a per-action prompt into a hard block, which is the tier above it.
 */
export function claudeCode(result, options = {}) {
    // The header names the policy file that was ACTUALLY read. It was a literal for one round, so a
    // workspace declaring a non-default policy got an artifact claiming it came from somewhere it did
    // not — in the one field whose entire job is telling a reader what generated this. Found by review.
    const source = options.source ?? ".portulan/gates.json";
    const runner = options.runner ?? '"${CLAUDE_PROJECT_DIR}/.portulan/compile/gate.mjs"';
    const stopRunner = options.stopRunner ?? '"${CLAUDE_PROJECT_DIR}/.portulan/compile/stop.mjs"';

    const deny = [];
    const ask = [];
    const matchers = new Set();

    for (const gate of result.compiled) {
        const into = gate.tier === "prohibited" ? deny : ask;
        if (gate.kind === "shell") {
            into.push(`Bash(${gate.target}:*)`);
            matchers.add("Bash");
        } else if (gate.kind === "write") {
            for (const tool of WRITE_TOOLS) {
                into.push(pattern(tool, gate.target));
                matchers.add(tool);
            }
        } else if (gate.kind === "read") {
            for (const tool of READ_TOOLS) {
                into.push(pattern(tool, gate.target));
                matchers.add(tool);
            }
        }
    }

    // The generation header. An emitted artifact that does not say what generated it invites the
    // one edit this whole rail exists to catch — a hand-fix that survives until the next compile
    // silently reverts it.
    const settings = {
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

    return { settings };
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

export function run(argv, options = {}) {
    const say = (line = "") => {
        if (!options.quiet) process.stdout.write(`${line}\n`);
    };
    try {
        let workspaceRoot = process.cwd();
        let check = false;
        for (let i = 0; i < argv.length; i += 1) {
            if (argv[i] === "--check") check = true;
            else if (argv[i] === "--workspace") {
                workspaceRoot = argv[i + 1];
                i += 1;
                if (workspaceRoot === undefined) throw new CompileError("--workspace needs a directory");
            } else throw new CompileError(`unknown argument ${JSON.stringify(argv[i])}`);
        }

        const policyFile = policyPath(workspaceRoot);
        const policy = readJson(policyFile, "the gate policy");
        const result = compile(policy);
        const { settings } = claudeCode(result, {
            source: path.relative(workspaceRoot, policyFile).split(path.sep).join("/"),
        });
        const text = render(settings);
        const artifact = path.join(workspaceRoot, ".claude", "settings.json");

        say(`gates: ${result.compiled.length} compiled, ${result.refused.length} refused`);
        for (const gate of result.compiled) say(`  gate    ${gate.id.padEnd(38)} ${gate.tier}`);
        // Refusals are printed, always. A silent cap reads as "covered everything" when it did not
        // — and these are the rows the per-host degradation report is built from.
        for (const r of result.refused) say(`  refused ${r.id.padEnd(38)} ${r.why}`);

        if (check) {
            let current = null;
            try {
                current = fs.readFileSync(artifact, "utf8");
            } catch {
                say(`RED — ${artifact} does not exist; the policy declares gates that nothing enforces`);
                return 1;
            }
            if (current !== text) {
                say(`RED — ${artifact} has drifted from ${policyFile}. Recompile.`);
                return 1;
            }
            say("GREEN — the emitted artifact matches the policy");
            return 0;
        }

        fs.mkdirSync(path.dirname(artifact), { recursive: true });
        fs.writeFileSync(artifact, text);
        say(`wrote ${artifact}`);
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
