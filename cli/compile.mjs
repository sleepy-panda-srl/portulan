#!/usr/bin/env node
// `compile` — the enforcement compiler: it turns a workspace's gate policy into Claude Code settings and a GitHub
// ruleset, and its guidance into each host's load tiers.
//
//   node cli/compile.mjs [--workspace <dir>] [--check] [--matrix]
//
// Exit 0 wrote (or, with --check, agrees) · 1 an artifact has drifted · 2 could not run.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { AUTO, discoverPackRoots, namedWithAuto, resolutionRoots } from "./discover.mjs";
import { isInside } from "./inside.mjs";
import { CannotOutline, sectionOf } from "./symbols.mjs";
import { HORIZON, LedgerError, readSpend } from "./ledger.mjs";

/** Raised when `compile` cannot run, or cannot compile honestly. Always exit 2, never 1. */
export class CompileError extends Error {
    constructor(message) {
        super(message);
        this.name = "CompileError";
    }
}

/** The `portulan.spec` versions of `gates.json`: a train separate from the Workspace Definition's, though the numbers overlap. */
export const KNOWN_GATE_POLICY_SPECS = new Set(["2.1", "2.2"]);

const TIERS = new Set(["auto", "propose", "gated", "prohibited"]);

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// spec/workspace.schema.json's `filePath`, copied: relative, no `#`, `?` or `:`, and not a directory.
const FILE_PATH = /^[^#?:/]([^#?:]*[^#?:/])?$/;

export const WRITE_TOOLS = ["Edit", "Write", "NotebookEdit"];
export const READ_TOOLS = ["Read"];

// ---------------------------------------------------------------- parse: validated rules, no backend's opinion

/** The policy as `{ rules, floor }`, validated and normalised; anything unreadable throws, since a skipped rule looks enforced. */
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
        if (action[kind] !== action[kind].trim()) {
            throw new CompileError(
                kind === "none"
                    ? `rule \`${id}\`'s none target has leading or trailing whitespace. That sentence is printed ` +
                          `verbatim into the refusal report, where leading whitespace shifts it out of line with every ` +
                          `other refusal and trailing whitespace is invisible in the record.`
                    : `rule \`${id}\`'s ${kind} target has leading or trailing whitespace, which the host would not match`,
            );
        }
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

/** The optional `floor`, validated whole, or null; `strict` is not declarable, as no pull request merges from behind its base. */
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
        if (c.context !== c.context.trim()) {
            throw new CompileError(
                `\`floor.checks[${i}].context\` is ${JSON.stringify(c.context)} — it has leading or trailing whitespace, which no ` +
                    `status check will report. Fix the policy rather than having this quietly trim it.`,
            );
        }
        // Without `integration_id`, any app reporting the name satisfies the check: allowed, and reported by `doctor`.
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

// ---------------------------------------------------------------- what an action means, to the compiler and the gate alike

/** The command and, under one leading `sh -c`-style wrapper, the command inside, which no `Bash(prefix:*)` rule sees; one level only. */
export function spellings(raw) {
    const command = String(raw ?? "").trim();
    const out = [command];
    const wrapper = /^(?:\/usr\/bin\/env\s+)?(?:ba|z|da)?sh\s+-[a-zA-Z]*c\s+(.*)$/s.exec(command);
    if (wrapper) {
        let inner = wrapper[1].trim();
        if (inner[0] === "$" && (inner[1] === "'" || inner[1] === '"')) inner = inner.slice(1);
        const quote = inner[0];
        if ((quote === '"' || quote === "'") && inner.endsWith(quote) && inner.length > 1) {
            inner = inner.slice(1, -1);
        }
        if (inner.trim()) out.push(inner.trim());
    }
    return out;
}

/** Commands that write, replace or remove a file named on their command line; not `git`, which would gate `git diff <path>` too. */
export const FILE_WRITERS = new Set(["cp", "mv", "ln", "rm", "tee", "dd", "install", "truncate", "shred", "patch"]);

/** Editors that write their arguments only under an in-place flag; `sed -n '1,5p' <path>` is a read. */
export const IN_PLACE_EDITORS = new Set(["sed", "gsed", "perl", "ruby"]);

/** Words before the command that runs, recognised and not parsed: `sudo cp …` is seen, `sudo -u someone cp …` is not. */
const COMMAND_PREFIXES = new Set(["sudo", "env", "command", "builtin", "exec", "nohup", "nice", "time"]);

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

const OPERATOR = /[|&;<>()\n\r]/;

const SEGMENT_LEADERS = new Set(["{", "}", "!", "then", "else", "elif", "do", "done", "fi", "esac"]);

/** The command without its heredoc bodies, which are data; each opening line stays, so a redirection on it still counts. */
function stripHeredocs(command) {
    const out = [];
    let delimiter = null;
    let held = [];
    for (const line of command.split("\n")) {
        if (delimiter !== null) {
            if (line.trim() === delimiter) {
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
    // Never terminated, so no heredoc (`<<EOF` in quotes, or after `#`): its lines come back rather than hide a gated command.
    if (delimiter !== null) out.push(...held);
    return out.join("\n");
}

/** A shell command split into words, with unquoted operators kept as words of their own. */
export function shellWords(command) {
    const words = [];
    let text = "";
    let open = false;
    const flush = () => {
        if (open) words.push({ text, op: false });
        text = "";
        open = false;
    };
    for (let i = 0; i < command.length; i += 1) {
        const c = command[i];
        // `$'…'` and `$"…"` quote, and their `$` is not part of the word; `$(…)` runs a command and is deliberately not read.
        if (c === "$" && (command[i + 1] === "'" || command[i + 1] === '"')) continue;
        if (c === "'" || c === '"') {
            // A backslash escapes only inside `"…"`; `$'…'` reads as `'…'`, its `\x41`-style escapes undecoded.
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
            // A backslash-newline continues the word. `\r\n` is one pair here, though bash 3.2 and 5.2 and zsh 5.9 end the
            // command at its `\n` (no Windows bash measured): that fails closed, and dropping the pair fails open.
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
        // Before the whitespace test: a newline is both, and must separate.
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

function writesWhatItNames({ head, args }) {
    if (head === null) return false;
    if (FILE_WRITERS.has(head)) return true;
    return IN_PLACE_EDITORS.has(head) && args.some((a) => /^--in-place(=|$)/.test(a) || /^-[a-zA-Z]*i/.test(a));
}

/** A typed path with its `.`, empty and `..` segments resolved, since `matchesPath` compares tails literally. */
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

/** True when no host-submitted path can match: the target is not normalised, or keeps a backslash no candidate can hold. */
export function neverMatches(target) {
    const clean = String(target ?? "").replace(/^\.\//, "").replace(/^\/+/, "");
    // `clean === "/"` and `body === ""` are unreachable, kept to read line for line with `matchesPath`.
    if (clean === "" || clean === "/") return true;
    const body = clean.endsWith("/") ? clean.slice(0, -1) : clean;
    if (body.includes("\\")) return true;
    return body === "" || normalisePath(body) !== body;
}

/** The directories above a target, `a/b/c.md` -> `a`, `a/b`, with no trailing `/`, which would match every file under each. */
function ancestors(target) {
    const parts = normalisePath(target.replace(/\/+$/, "")).split("/").filter(Boolean);
    return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
}

/** Whether a word, or its value after an `of=`-style `=`, names the target; with `orAncestor`, a directory above it counts too. */
function namesTarget(word, target, orAncestor = false) {
    const eq = word.indexOf("=");
    const candidates = eq > 0 ? [word, word.slice(eq + 1)] : [word];
    return candidates.some((c) => {
        const clean = normalisePath(c);
        if (clean === "") return false;
        const rooted = clean.startsWith("/") ? clean : `/${clean}`;
        // A subtree target needs the word to read as a directory: `rm -rf .portulan` reaches `.portulan/`.
        if (matchesPath(target.endsWith("/") ? `${rooted}/` : rooted, target)) return true;
        return orAncestor && ancestors(target).some((a) => matchesPath(rooted, a));
    });
}

/** A shell line's commands as source text, split on unquoted separators, without heredoc bodies or leading redirections. */
function commandSegments(raw) {
    const command = stripHeredocs(String(raw ?? ""));
    const out = [];
    let start = 0;
    let quote = null;
    // The last character a backslash made data: `\>` is a literal, not a redirection operator.
    let escaped = -1;
    for (let i = 0; i < command.length; i += 1) {
        const c = command[i];
        if (quote) {
            // A backslash escapes inside `"…"` only: POSIX gives `'…'` no escapes, and honouring one there would open a hole.
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
            // `\r\n` as one pair, in step with `shellWords`.
            i += command[i + 1] === "\r" && command[i + 2] === "\n" ? 2 : 1;
            escaped = i;
            continue;
        }
        // `#` is not read as a comment: a false red on `echo ok #; git push`, where misplacing one would be a false green.
        // `&` and `|` inside a redirection operator (`2>&1`, `&>`, `>|`) do not separate, unless the `>` or `<` was escaped.
        const opBefore = i - 1 !== escaped && (command[i - 1] === ">" || command[i - 1] === "<");
        if (c === "&" && (opBefore || command[i + 1] === ">")) continue;
        if (c === "|" && i - 1 !== escaped && command[i - 1] === ">") continue;
        if (";|&()\n\r".includes(c)) {
            out.push(command.slice(start, i));
            start = i + 1;
        }
    }
    out.push(command.slice(start));
    return out.map((s) => stripLeadingRedirections(s.trim())).filter(Boolean);
}

/** A redirection target: one shell word, as `shellWords` reads it. Linear: once an operator matches, the match cannot fail. */
const REDIRECTION_TARGET = String.raw`(?:"(?:\\[\s\S]|[^"\\])*"|'[^']*'|\\[\s\S]|[^\s])+`;

const LEADING_REDIRECTION = new RegExp(String.raw`^\d*(?:&>>|&>|>>|>&|>\||<&|<>|<|>)\s*${REDIRECTION_TARGET}\s*`);

// The one segment leader stripped: a redirection's grammar is closed, where a table of command prefixes would have no edge.
function stripLeadingRedirections(segment) {
    let text = segment;
    for (;;) {
        const shorter = text.replace(LEADING_REDIRECTION, "");
        if (shorter === text) return text;
        text = shorter;
    }
}

/**
 * Whether a shell command writes the target: a `>` or `>>` into it, or a writer from the tables naming it or a directory
 * above it in any argument, its source too. Missed: an interpolated path, a command built at runtime, a runtime writing
 * the file (`python3 -c`), a writer outside the tables (`ex`, `git checkout`), `find -exec` or `xargs`, a second wrapper.
 */
export function shellWrites(command, target) {
    for (const segment of shellSegments(stripHeredocs(String(command ?? "")))) {
        if (segment.redirects.some((word) => namesTarget(word, target))) return true;
        if (writesWhatItNames(segment) && segment.args.some((word) => namesTarget(word, target, true))) return true;
    }
    return false;
}

/** Whether a host-submitted path falls under a policy target, compared by tail: the hook knows no reliable repository root. */
export function matchesPath(candidate, target) {
    if (typeof candidate !== "string" || candidate === "") return false;
    const clean = String(target ?? "").replace(/^\.\//, "").replace(/^\/+/, "");
    if (clean === "" || clean === "/") return false;
    const normalised = candidate.replace(/\\/g, "/");
    return clean.endsWith("/") ? normalised.includes(`/${clean}`) : normalised.endsWith(`/${clean}`);
}

/** Whether a tool call falls under the rule; never throws, since the gate steps aside on a throw. */
export function matchesRule(rule, tool, input = {}) {
    const action = rule?.action ?? {};
    if (typeof action.shell === "string" && tool === "Bash") {
        // A target ending in `/` is a path prefix, as the host's `Bash(target:*)` reads it; any other ends at a word boundary.
        const hit = (s) =>
            action.shell.endsWith("/") ? s.startsWith(action.shell) : s === action.shell || s.startsWith(`${action.shell} `);
        // One unwrap, with splitting before and after it: `ls && bash -c "x; git push"` is reached; a second wrapper is not.
        const reach = (s) => hit(s) || commandSegments(s).some(hit);
        return spellings(input.command).some(reach) || commandSegments(input.command).some((seg) => spellings(seg).some(reach));
    }
    if (typeof action.write === "string") {
        if (WRITE_TOOLS.includes(tool)) return matchesPath(input.file_path ?? input.notebook_path, action.write);
        if (tool === "Bash") {
            // Whole line and per segment, exactly as the `shell` branch above; the two change together.
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

// ---------------------------------------------------------------- the backends
// Each returns `{ backend, label, compiled: [{ id, tier, surface }], refused: [{ id, tier, why }], notes,
// artifact: { path, value, text } | null }`, and `compiled` with `refused` holds every rule.

function pathSpec(target) {
    const clean = target.replace(/^\.\//, "").replace(/^\/+/, "");
    return clean.endsWith("/") ? `./${clean}**` : `./${clean}`;
}

function pattern(tool, target) {
    return `${tool}(${pathSpec(target)})`;
}

// Restriction only, never `allow`: an allow prefix would clear every spelling beneath it, `git push --mirror` included.
const HOST_GATE_TIERS = new Set(["gated", "prohibited"]);

const HOST_TIER_NOT_A_GATE = {
    auto: "tier `auto` is unattended by policy, not by the host — this backend emits no `allow` rule for it, which is what keeps the compiler additive, and the prompts that omission leaves are paid by hand in the host's own settings, outside this repository",
    propose: "tier `propose` is enforced by the platform floor — pull requests, required checks, review — not by a tool-level permission rule on this machine",
};

/** The hook runners, in the order `claudeCode` indexes them; generated settings invoke them, so no import graph finds them. */
export const HOOK_RUNNERS = ["gate.mjs", "stop-gate.mjs", "advisory.mjs"];

/**
 * The policy as Claude Code settings: each gate a permission rule and a hook with one answer, `deny` for prohibited and
 * `ask` for gated, a prompt that blocks headless. Two layers, since on Claude Code 2.1.220 a crashing hook fails open.
 */
export function claudeCode(parsed, options = {}) {
    const source = options.source ?? ".portulan/gates.json";
    const runnerDir = path.dirname(fileURLToPath(import.meta.url));
    const project = options.root ?? process.cwd();
    const pinned = [];
    const spell = (file) => {
        const abs = path.join(runnerDir, file);
        const rel = path.relative(project, abs);
        // Not `startsWith("..")`, which would take a directory named `..foo` for the parent.
        const inside = rel && rel.split(path.sep)[0] !== ".." && !path.isAbsolute(rel);
        if (inside) return `"\${CLAUDE_PROJECT_DIR}/${rel.split(path.sep).join("/")}"`;
        pinned.push({ file, abs });
        return `"${abs}"`;
    };
    const runner = options.runner ?? spell(HOOK_RUNNERS[0]);
    const stopRunner = options.stopRunner ?? spell(HOOK_RUNNERS[1]);
    const advisoryRunner = options.advisoryRunner ?? spell(HOOK_RUNNERS[2]);

    const compiled = [];
    const refused = [];
    const deny = [];
    const ask = [];
    const matchers = new Set();
    const shellWriteGates = [];
    const editCoveredGates = [];

    for (const rule of parsed.rules) {
        if (!HOST_GATE_TIERS.has(rule.tier)) {
            refused.push({ id: rule.id, tier: rule.tier, why: HOST_TIER_NOT_A_GATE[rule.tier] });
            continue;
        }
        if (rule.kind === "none") {
            // A `none` target is the policy's own sentence for why nothing can be gated.
            refused.push({ id: rule.id, tier: rule.tier, why: rule.target });
            continue;
        }
        // A throw, not a `refused` row: a gate declared at an enforcing tier that can never match is a malformed policy.
        if ((rule.kind === "write" || rule.kind === "read") && neverMatches(rule.target)) {
            throw new CompileError(
                `rule \`${rule.id}\` is ${rule.tier} and its ${rule.kind} target ${JSON.stringify(rule.target)} matches no path a host ` +
                    `can submit: the matcher compares a tail, and this target's comparison form is one no candidate can carry. ` +
                    `This backend would emit ${pattern(rule.kind === "write" ? "Edit" : READ_TOOLS[0], rule.target)} ` +
                    `and report the rule compiled, while the runtime matcher answered false for every input: a gate that reads as whole ` +
                    `from outside and enforces nothing. Name the path the rule protects in its normalised spelling — no ` +
                    `\`.\` or empty segment, no backslash — or drop the rule; and where this ` +
                    `rule came from a pack, it is the pack that carries it, not the workspace composing it. ` +
                    `(A never-matching target is harmless at \`auto\`, which this backend refuses one step earlier; it is a hollow gate only ` +
                    `at the tiers that enforce. See .portulan/gate-map.md, honest holes, entry 8.)`,
            );
        }
        const into = rule.tier === "prohibited" ? deny : ask;
        const emitted = []; // permission patterns, the layer that cannot fail open
        const hookOnly = [];
        if (rule.kind === "shell") {
            emitted.push(`Bash(${rule.target}:*)`);
            matchers.add("Bash");
        } else {
            // Claude Code 2.1.240 discards `Write(path)` and `NotebookEdit(path)` and applies `Edit(path)` to every editing
            // tool; the hook still matches all three names, each of which reaches `PreToolUse` on its own.
            const permissionTools = rule.kind === "write" ? ["Edit"] : READ_TOOLS;
            for (const tool of permissionTools) emitted.push(pattern(tool, rule.target));
            for (const tool of rule.kind === "write" ? WRITE_TOOLS : READ_TOOLS) matchers.add(tool);
            if (rule.kind === "write") {
                editCoveredGates.push(rule.id);
                // Without `Bash` among the matchers, a policy with no shell gate would never run the hook on a shell write.
                matchers.add("Bash");
                hookOnly.push(`hook: a Bash command writing ${pathSpec(rule.target)}`);
                shellWriteGates.push(rule.id);
            }
        }
        into.push(...emitted);
        compiled.push({ id: rule.id, tier: rule.tier, surface: [...emitted, ...hookOnly].join(" · ") });
    }

    if (parsed.rules.some((r) => HOST_GATE_TIERS.has(r.tier)) && compiled.length === 0) {
        throw new CompileError(
            "every gate in this policy refused to compile — refusing to write an artifact that enforces nothing while the policy claims gates",
        );
    }

    // Each pack's origin and version, never its root: an absolute path would make the tracked artifact differ per machine.
    const packs = (options.packProvenance ?? [])
        .map((c) => ({ pack: c.pack, origin: c.origin, version: c.version ?? null }))
        .sort((a, b) => a.pack.localeCompare(b.pack));
    const sessions = options.sessions ?? null;
    const switches = {};
    if (sessions?.git_instructions !== undefined) switches.includeGitInstructions = sessions.git_instructions;
    if (sessions?.cache_lifetime !== undefined) switches.promptCacheTtl = sessions.cache_lifetime;
    const sessionsFrom = Object.keys(switches).length ? sessions.manifest : null;
    const spend = options.spend ?? null;
    const figures = [];
    if (spend?.multipliers) figures.push("--read", spend.multipliers.read, "--write-5m", spend.multipliers.write["5m"], "--write-1h", spend.multipliers.write["1h"]);
    if (spend?.horizon) figures.push("--horizon", spend.horizon);
    const spendFlags = figures.map((f) => ` ${f}`).join("");
    const restartBlock = spend?.restart === "block";
    const spendFrom = figures.length || restartBlock ? spend.manifest : null;
    const declaredIn =
        sessionsFrom && sessionsFrom === spendFrom
            ? `\`sessions\` and \`spend\` in ${sessionsFrom}`
            : [sessionsFrom && `\`sessions\` in ${sessionsFrom}`, spendFrom && `\`spend\` in ${spendFrom}`].filter(Boolean).join(", or ");
    const value = {
        $portulan: {
            generated: "cli/compile.mjs",
            source,
            ...(sessionsFrom ? { sessions: sessionsFrom } : {}),
            ...(spendFrom ? { spend: spendFrom } : {}),
            ...(packs.length ? { packs } : {}),
            warning: declaredIn
                ? `Generated file. Edit ${source}, or ${declaredIn}, and recompile; \`verify/compile.sh\` fails on drift.`
                : `Generated file. Edit ${source} and recompile; \`verify/compile.sh\` fails on drift.`,
        },
        permissions: { deny, ask, allow: [] },
        hooks: {
            // Each command is `node` and a quoted path: no pipe, redirection or separator, where a quoting fail-open would live.
            PreToolUse: [...matchers].sort().map((matcher) => ({
                matcher,
                hooks: [{ type: "command", command: `node ${runner}` }],
            })),
            Stop: [
                {
                    hooks: [
                        { type: "command", command: `node ${stopRunner}` },
                        ...(restartBlock ? [{ type: "command", command: `node ${advisoryRunner} stop${spendFlags}` }] : []),
                    ],
                },
            ],
            // No matcher means every tool; a non-blocking `Stop` hook's output would reach only the host's debug log.
            PostToolUse: [{ hooks: [{ type: "command", command: `node ${advisoryRunner} tool${spendFlags}` }] }],
            UserPromptSubmit: [{ hooks: [{ type: "command", command: `node ${advisoryRunner} prompt${spendFlags}` }] }],
        },
        statusLine: { type: "command", command: `node ${advisoryRunner} status${spendFlags}` },
        ...switches,
    };

    const notes = [];
    if (pinned.length) {
        notes.push(
            `${pinned.length} hook(s) are pinned to an ABSOLUTE path on this machine — ` +
                `${pinned.map((x) => x.abs).join(", ")}. The runner is not under this project (a global or \`npx\` install), ` +
                `so no \`\${CLAUDE_PROJECT_DIR}\`-relative spelling exists. The compiled policy therefore stops working if the ` +
                `package moves or is reinstalled elsewhere, and a missing hook FAILS OPEN. Install the package into the ` +
                `project, or pass \`--runner\`/\`--stop-runner\` to name a path you control`,
        );
    }
    notes.push(
        `the status line is compiled: it shows the restart threshold (proposal 0038) and takes the place of a status line ` +
            `set in user settings, in this repository only. To keep your own here, set \`statusLine\` in \`.claude/settings.local.json\`, which ` +
            `outranks this file; the restart advisory with a tool result and at the prompt is unaffected`,
    );
    if (switches.includeGitInstructions === false) {
        notes.push(
            `the git instructions are compiled off (\`sessions.git_instructions\`): every session here starts without the host's ` +
                `startup git snapshot and its commit and pull-request instructions. A session that needs them starts with ` +
                `\`CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=0\`, which outranks this file (read in Claude Code 2.1.281's program text)`,
        );
    }
    if (switches.includeGitInstructions === true) {
        notes.push(
            `the git instructions are compiled on (\`sessions.git_instructions\`): every session here starts with the host's ` +
                `startup git snapshot and its commit and pull-request instructions, whatever a user's own settings say. A session ` +
                `that must go without them starts with \`CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1\`, which outranks this file`,
        );
    }
    if (switches.promptCacheTtl !== undefined) {
        notes.push(
            `the main conversation's cache lifetime is compiled as ${switches.promptCacheTtl} (\`sessions.cache_lifetime\`); ` +
                `\`CLAUDE_CODE_PROMPT_CACHE_TTL\` outranks it for one session, and subagents keep a lifetime of their own`,
        );
    }
    if (sessions?.headless !== undefined) {
        notes.push(
            `\`sessions.headless\` is not compiled: it is what the runners that start sessions apply, today \`cli/warm.mjs\`, ` +
                `and the dynamic-sections exclusion it can carry is no host setting`,
        );
    }
    if (figures.length) {
        const m = spend.multipliers;
        const priced = m ? `read ${m.read}×, write ${m.write["5m"]}× for five minutes and ${m.write["1h"]}× for an hour, whichever lifetime the host records` : "the general multipliers";
        notes.push(
            `the restart advisory and the status line compute the threshold at the declared figures (\`spend\`): ${priced}, and ` +
                `${spend.horizon ? `a horizon of ${spend.horizon} requests` : `the general horizon of ${HORIZON} requests`}. The compiled ` +
                `commands carry them, so an edit to \`spend\` is drift until recompiled`,
        );
    }
    if (restartBlock) {
        notes.push(
            `the restart advisory also holds a turn's end (\`spend.restart\` "block"): at the first stop at or past the restart ` +
                `threshold that no block provoked, once in a session and again after each compaction, with the line as the reason, beside the Stop-gate. Nothing ends the ` +
                `session, and the line still comes with a tool result or at the prompt`,
        );
    }
    if (editCoveredGates.length) {
        notes.push(
            `${editCoveredGates.length} write gate(s) — ${editCoveredGates.join(", ")} — emit \`Edit(path)\` as their only ` +
                `permission pattern, and that ONE pattern is matched for every file-editing tool. Measured on Claude Code ` +
                `2.1.240: with \`Edit(path)\` alone in the list and \`Write\` allowed, the host refused the write — and a ` +
                `\`Write\` to a DIFFERENT path succeeded in the same session, the control that tells *refused* from ` +
                `*refuses everything*. \`Write(path)\` ` +
                `and \`NotebookEdit(path)\` are NOT emitted because the host discards them — it says so on every start — and a ` +
                `compiler that emitted them would report three rules where one enforces. **Re-measure on a host change in EITHER ` +
                `direction:** this is a fact about one CLI version. If a later host stops treating \`Edit\` as tool-general, ` +
                `this gate narrows to one tool at the permission layer with nothing here going red. And no EARLIER host was ` +
                `re-measured — on one that honoured all three patterns and did not treat \`Edit\` as tool-general, this ` +
                `emission removes two working rules. The hook covers all three tool names on any host.`,
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

// ---------------------------------------------------------------- the floor backend: a GitHub repository ruleset

// Exact spellings, never parsed: a rule spelled `git push -f` is refused rather than recognised.
const REF_RULES = new Map([
    ["git push --force", "non_fast_forward"],
    ["git push --delete", "deletion"],
]);

const FLOOR_GATE_TIERS = new Set(["gated", "prohibited"]);

const TAG_SHAPED = new Set(["git tag", "gh release"]);

export function githubRuleset(parsed, options = {}) {
    const source = options.source ?? ".portulan/gates.json";
    const { floor } = parsed;
    const compiled = [];
    const refused = [];
    const notes = [];

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
    const declaresPropose = parsed.rules.some((r) => r.tier === "propose");
    const hasChecks = floor.checks.length > 0;
    const emitPullRequestPair = hasChecks && declaresPropose;

    if (emitPullRequestPair) {
        rules.push({
            type: "pull_request",
            parameters: {
                // GitHub requires all five; the optional `allowed_merge_methods` is left out, as no policy drives it.
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
                // Not declarable: a pull request may never merge from behind its base.
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

    if (compiled.some((c) => c.surface === "non_fast_forward")) {
        notes.push(
            `on \`refs/heads/${floor.branch}\` the \`non_fast_forward\` rule is STRICTER than this policy: it blocks every force-push, including \`git push --force-with-lease\`, which the policy classifies Auto. The floor gates a ref and cannot read a command's flags.`,
        );
    }
    notes.push(
        `every rule here applies to one declared ref, \`refs/heads/${floor.branch}\`, and to nothing else. A policy rule naming an action on any other branch is not covered by this export even where it compiled.`,
    );
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
        // A ruleset has no description field, so its name is where provenance reaches GitHub's settings UI.
        name: `portulan floor — ${floor.branch} (generated from ${source})`,
        target: "branch",
        enforcement: "active",
        conditions: { ref_name: { include: [`refs/heads/${floor.branch}`], exclude: [] } },
        rules,
        // No bypass: a floor exempting the only actor who can act is not a floor.
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

/** Why a rule misses the floor, said of this export and never of GitHub, which can gate paths and tags. */
function floorRefusal(rule, floor) {
    if (rule.tier === "auto") {
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

/** Each backend's artifact path, owed or not: `--check` looks for an artifact a backend no longer emits. */
const ARTIFACT_PATHS = {
    "claude-code": ".claude/settings.json",
    "github-ruleset": ".portulan/compile/github-ruleset.json",
};

function artifactPaths(workspaceDir) {
    if (workspaceDir === ".portulan") return ARTIFACT_PATHS;
    const prefix = workspaceDir === "." ? "" : `${workspaceDir}/`;
    return {
        "claude-code": ARTIFACT_PATHS["claude-code"],
        "github-ruleset": `${prefix}compile/github-ruleset.json`,
    };
}

export const GENERATED_DIRS = ["compile", ".claude"];

export function backends(parsed, options = {}) {
    return [claudeCode(parsed, options), githubRuleset(parsed, options)];
}

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

// ---------------------------------------------------------------- guidance: slots.context compiled per host

export const LOAD_TIERS = ["always", "on-path", "on-invoke", "on-read"];

/** Its rules are claimed by `RULES_MARKER`, not a mark in each: every context pays for an always rule's bytes. */
export const GUIDANCE_RULES_DIR = ".claude/rules/portulan";

/** Not a `.md` file, so it costs no context: Claude Code loads only `.md` files as rules. */
export const RULES_MARKER = ".compiled";
const RULES_MARKER_HEAD = "`portulan compile` wrote the rules listed below from slots.context; it rewrites and removes only these.";

const markerText = (names) => `${RULES_MARKER_HEAD}\n${names.map((name) => `${name}\n`).join("")}`;

/** The rule files a marker lists, or null when its text is not one this compiler writes. */
function markedRules(text) {
    const lines = text.split("\n");
    if (lines[0] !== RULES_MARKER_HEAD || lines.at(-1) !== "") return null;
    const names = lines.slice(1, -1);
    if (!names.every((name) => SLUG.test(name.replace(/\.md$/, "")) && name.endsWith(".md"))) return null;
    return new Set(names).size === names.length ? new Set(names) : null;
}

export const ON_READ_INDEX = "on-read.md";

/** Shared with hand-written skills, so a compiled skill carries a mark naming its unit. */
export const SKILLS_DIR = ".claude/skills";
const SKILL_MARK = "<!-- compiled by `portulan compile` from ";
const SKILL_MARK_TAIL = "; edit that file, then recompile -->";

/** The unit a skill's mark names, or null when the line after its frontmatter is not a mark this compiler writes. */
function skillSource(text) {
    const lines = text.split("\n");
    const close = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
    const line = close === -1 || lines[close + 1] !== "" ? "" : lines[close + 2] ?? "";
    if (!line.startsWith(SKILL_MARK) || !line.endsWith(SKILL_MARK_TAIL)) return null;
    return line.slice(SKILL_MARK.length, -SKILL_MARK_TAIL.length) || null;
}

/** `null` is a tier the host cannot express, whose units degrade to an on-read pointer. */
export const GUIDANCE_HOSTS = {
    "claude-code": {
        label: "Claude Code",
        always: `an unscoped rule in \`${GUIDANCE_RULES_DIR}/\``,
        "on-path": "a rule scoped by `paths:`",
        "on-invoke": `a project skill in \`${SKILLS_DIR}/\``,
        "on-read": `a line in \`${GUIDANCE_RULES_DIR}/${ON_READ_INDEX}\``,
    },
    "agents-md": {
        label: "AGENTS.md, vendored",
        always: "inline in `AGENTS.md`",
        "on-path": null,
        "on-invoke": null,
        "on-read": "a line in `AGENTS.md`",
    },
};

/** Both reserved: the boot skill knows the card is in its context by this first line. */
export const BOOT_CARD_UNIT = "boot";
export const BOOT_CARD_LINE = "# Portulan boot card";

/** Claude Code 2.1.281 resolves an import from the importing file, inside the project only, and loads nothing this deep. */
export const IMPORT_DEPTH = 5;

export const LEADS_LINE = /^<!-- leads: (\S+) -->$/;

export const ENGINE_LINE = /^<!-- engine: (\S+) -->$/;
const ENGINE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN_ROOT = "<plugin root>/";

export const GATES_LINE = /^<!-- gates: (\S+) -->$/;

const TIER_GLOSS = {
    auto: "**Auto**, unattended",
    propose: "**Propose**, a human decides",
    gated: "**Gated**, a human's approval for each action, never inferred and never standing",
    prohibited: "**Prohibited**, where no approval exists",
};

const STRAY_IMPORT = {
    "on-path": "the host loads a path-scoped rule's imports into every context, so the file would not wait for the path",
    "on-invoke": "the unit compiles to a skill in another directory, from which the import names another file",
    "on-read": "an on-read file is opened as it stands, so the import would load nothing",
};

/**
 * The `@` imports Claude Code 2.1.281 finds: none in a fence, nor in a code span or HTML comment outside a list
 * item's text, which it reads raw. Misread: a list in a block quote, and a line its lexer keeps out of an item.
 */
export function importSpans(text) {
    const found = [];
    let fence = null;
    let comment = false;
    let listed = false; // in a list, which a blank line alone does not end
    let flowing = false; // the line above is list text, which an unindented line may continue
    const opensInItem = /^(?:#{1,6}(?:[ \t]|$)|>|<!--)/;
    let offset = 0;
    for (const line of text.split("\n")) {
        const start = offset;
        offset += line.length + 1;
        let raw = false;
        if (!comment) {
            const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
            if (marker) {
                if (fence === null) fence = marker[1];
                else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && /^\s{0,3}[`~]+\s*$/.test(line)) fence = null;
                flowing = false;
                continue;
            }
            if (fence !== null) continue;
            const item = /^\s*(?:[-+*]|\d{1,9}[.)])(?:[ \t]+|$)/.exec(line);
            if (line.trim() === "") {
                flowing = false;
            } else if (item && (listed || /^ {0,3}\S/.test(line))) {
                listed = flowing = true;
                raw = !opensInItem.test(line.slice(item[0].length));
            } else if (listed && (/^\s/.test(line) || (flowing && !OPENS_BLOCK.test(line)))) {
                flowing = true;
                raw = !opensInItem.test(line.trimStart());
            } else {
                listed = flowing = false;
            }
        }
        // Code spans and comments are blanked, not cut, so every offset stays put; an item's text is read whole.
        let seen = raw ? line : "";
        let at = raw ? line.length : 0;
        while (at < line.length) {
            if (comment) {
                const end = line.indexOf("-->", at);
                const to = end === -1 ? line.length : end + 3;
                seen += " ".repeat(to - at);
                at = to;
                comment = end === -1;
                continue;
            }
            const next = /`+|<!--/g;
            next.lastIndex = at;
            const hit = next.exec(line);
            if (hit === null) {
                seen += line.slice(at);
                break;
            }
            seen += line.slice(at, hit.index);
            if (hit[0] === "<!--") {
                comment = true;
                at = hit.index;
                continue;
            }
            const close = line.indexOf(hit[0], hit.index + hit[0].length);
            const to = close === -1 ? hit.index + hit[0].length : close + hit[0].length;
            seen += close === -1 ? hit[0] : " ".repeat(to - hit.index);
            at = to;
        }
        for (const match of seen.matchAll(/(?:^|\s)@((?:[^\s\\]|\\ )+)/g)) {
            found.push({ target: match[1], index: start + match.index + match[0].length - match[1].length, line });
        }
    }
    return found;
}

/** The path Claude Code 2.1.281 reads from an import token, or null where it reads no import. */
export const importPath = (target) => {
    const bare = target.split("#")[0].replaceAll("\\ ", " ");
    return bare !== "" && /^(?:\.\/|~\/|\/.|[A-Za-z0-9._-])/.test(bare) ? bare : null;
};

function checkedImports(text, dir, root, where) {
    const own = [];
    const shown = path.relative(process.cwd(), root) || ".";
    const queue = [{ text, dir, depth: 0, from: where, top: null, file: null }];
    const seen = new Set();
    while (queue.length) {
        const { text: body, dir: base, depth, from, top, file: parent } = queue.shift();
        for (const { target, line } of importSpans(body)) {
            const bare = importPath(target);
            if (bare === null) continue;
            const spelled = `\`@${target}\` (in ${from})`;
            if (depth === 0 && line.trim() !== `@${target}`) {
                throw new CompileError(`${spelled} shares its line with other text — an import stands alone on its line, so compile can spell it again from the file it compiles to; text that is not an import goes in a fenced block, or in a code span outside a list, since the host reads a list item's code spans for imports too`);
            }
            if (bare.startsWith("~") || path.isAbsolute(bare)) {
                throw new CompileError(`${spelled} is a home or an absolute path — an import here is relative to the file that makes it, and stays inside ${shown}`);
            }
            const file = path.resolve(base, bare);
            if (!isInside(root, file)) throw new CompileError(`${spelled} leaves ${shown}, the tree compiled here — the host follows no import out of the project, and a vendored copy carries only its workspace`);
            let real;
            try {
                real = fs.realpathSync(file);
            } catch {
                throw new CompileError(`${spelled} names no file, so the host would load nothing — put text that is not an import in a fenced block, or in a code span outside a list`);
            }
            if (!isInside(fs.realpathSync(root), real)) throw new CompileError(`${spelled} is a link out of ${shown}, the tree compiled here`);
            if (!fs.statSync(real).isFile()) throw new CompileError(`${spelled} names no file, so the host would load nothing`);
            if (depth + 1 >= IMPORT_DEPTH) {
                throw new CompileError(`${spelled} sits ${depth + 1} imports below the rule, and the host loads nothing ${IMPORT_DEPTH} deep — import the file from nearer the rule`);
            }
            // Breadth-first, so a file both imported directly and through another is named once, as the text's own.
            if (depth === 0) own.push({ target, file, nested: [] });
            if (seen.has(real)) continue;
            seen.add(real);
            if (depth > 0) own[top].nested.push({ file, from: parent });
            queue.push({
                text: fs.readFileSync(real, "utf8"),
                dir: path.dirname(file),
                depth: depth + 1,
                from: path.relative(root, file).split(path.sep).join("/"),
                top: depth === 0 ? own.length - 1 : top,
                file,
            });
        }
    }
    return own;
}

/** An unindented line that ends a list, as CommonMark reads it; a block tag such as `<div>` is read as a lazy line. */
const OPENS_BLOCK = /^(?:#{1,6}(?:[ \t]|$)|>|([-*_])(?:[ \t]*\1){2,}[ \t]*$|(?:[-+*]|\d{1,9}[.)])(?:[ \t]|$)|<(?:!--|\?|![A-Za-z]|!\[CDATA\[))/;

/** Each item's first sentence, byte for byte, from the first list in `file` or under its `#fragment` heading. */
function leadsOf(file, where, fragment = null, name = path.basename(file)) {
    let text = fs.readFileSync(file, "utf8");
    if (fragment !== null) {
        try {
            text = sectionOf(text, fragment).text;
        } catch (error) {
            if (!(error instanceof CannotOutline)) throw error;
            throw new CompileError(`${where}: the leads of ${name}#${fragment} were asked for, and ${error.message}`);
        }
    }
    return leadsOfText(text, fragment === null ? name : `${name}#${fragment}`, where);
}

/** `leadsOf` over a text already read; `name` is how the refusals name its file. */
export function leadsOfText(source, name, where) {
    const lines = source.split(/\r?\n/);
    const items = [];
    let kind = null;
    let fence = null;
    let under = false;
    for (const [at, line] of lines.entries()) {
        const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
        if (marker) {
            if (kind !== null) break;
            fence = fence === null ? marker[1] : null;
            continue;
        }
        if (fence !== null) continue;
        const item = /^(\d+)\. (.*)$/.exec(line) ?? /^(-) (.*)$/.exec(line);
        if (item && (kind === null || (item[1] === "-") === (kind === "-"))) {
            kind = item[1] === "-" ? "-" : "1";
            items.push({ marker: item[1] === "-" ? "-" : `${item[1]}.`, text: item[2].trim() });
        } else if (kind !== null && /^\s+\S/.test(line)) {
            items.at(-1).text += ` ${line.trim()}`;
        } else if (kind !== null && line.trim() !== "") {
            if (under && !OPENS_BLOCK.test(line)) {
                throw new CompileError(
                    `${where}: line ${at + 1} of ${name} follows an item of its first list with no blank line and no indent, ` +
                        `where CommonMark reads a line of text as more of that item — indent it under the item, or end the list with a blank line`,
                );
            }
            break;
        }
        under = kind !== null && line.trim() !== "";
    }
    if (items.length === 0) throw new CompileError(`${where}: the leads of ${name} were asked for, and it holds no list`);
    return items.map(({ marker, text }) => {
        if (!text.startsWith("**")) throw new CompileError(`${where}: an item of ${name}'s first list opens without a bold lead — ${JSON.stringify(text.slice(0, 60))}`);
        const code = [...text.matchAll(/(`+)[\s\S]*?\1/g)].map((m) => [m.index, m.index + m[0].length]);
        let end = text.length;
        for (const stop of text.matchAll(/[.!?]/g)) {
            if (code.some(([from, to]) => stop.index >= from && stop.index < to)) continue;
            const after = text.slice(stop.index + 1).replace(/^[*_)"'”]+/, "");
            if (after === "" || /^\s/.test(after)) {
                end = text.length - after.length;
                break;
            }
        }
        const lead = text.slice(0, end);
        if (/\]\(/.test(lead)) throw new CompileError(`${where}: the lead ${JSON.stringify(lead.slice(0, 60))} of ${name} carries a link, which would not resolve from the compiled file`);
        return `${marker} ${lead}`;
    });
}

function gatesOf(file, where, packs = []) {
    let policy;
    try {
        policy = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (cause) {
        throw new CompileError(`${where}: the gates of ${path.basename(file)} were asked for, and it is not a readable JSON policy — ${cause.message}`);
    }
    let rules;
    try {
        ({ rules } = parse(policy));
    } catch (cause) {
        if (!(cause instanceof CompileError)) throw cause;
        throw new CompileError(`${where}: the gates of ${path.basename(file)} were asked for, and ${cause.message}`);
    }
    const lines = TIER_ORDER.map((tier) => {
        const ids = rules.filter((r) => r.tier === tier).map((r) => `\`${r.id}\``);
        return `- ${TIER_GLOSS[tier]}: ${ids.length ? ids.join(", ") : "none"}.`;
    });
    if (packs.length) lines.push(`- **Packs** add gates of their own, which \`portulan compile --matrix\` lists: ${packs.map((p) => `\`${p}\``).join(", ")}.`);
    return lines;
}

/** The unit's body with each leads, engine and gates line written out; a leads path may end `#<heading>`. */
function expandedBody(unit, dir, root, packs = []) {
    unit.leadSources = [];
    unit.written = new Set();
    return unit.body
        .split("\n")
        .flatMap((line) => {
            const leads = LEADS_LINE.exec(line);
            const engine = leads ? null : ENGINE_LINE.exec(line);
            const gates = leads || engine ? null : GATES_LINE.exec(line);
            if (!leads && !engine && !gates) return [line];
            if (engine) return engineLeads(unit, engine[1], root);
            const [what, spelled] = leads ? ["leads", leads[1]] : ["gates", gates[1]];
            const hash = leads ? spelled.indexOf("#") : -1;
            const [named, fragment] = hash === -1 ? [spelled, null] : [spelled.slice(0, hash), spelled.slice(hash + 1)];
            const file = path.resolve(dir, named);
            if (!isInside(root, file)) throw new CompileError(`${unit.source}: the ${what} of ${named} were asked for, and it lies outside the tree compiled here`);
            let real;
            try {
                real = fs.realpathSync(file);
            } catch {
                throw new CompileError(`${unit.source}: the ${what} of ${named} were asked for, and it names no file`);
            }
            if (!isInside(fs.realpathSync(root), real) || !fs.statSync(real).isFile()) {
                throw new CompileError(`${unit.source}: the ${what} of ${named} were asked for, and it is not a file inside the tree compiled here`);
            }
            const rel = path.relative(root, file).split(path.sep).join("/");
            if (!unit.leadSources.includes(rel)) unit.leadSources.push(rel);
            unit.written.add(what);
            return leads ? leadsOf(real, unit.source, fragment, path.basename(named)) : gatesOf(real, unit.source, packs);
        })
        .join("\n");
}

function engineLeads(unit, spelled, root) {
    const hash = spelled.indexOf("#");
    const [named, fragment] = hash === -1 ? [spelled, null] : [spelled.slice(0, hash), spelled.slice(hash + 1)];
    const core = path.join(ENGINE_ROOT, "core");
    const file = path.resolve(core, named);
    let real = null;
    try {
        if (isInside(core, file)) real = fs.realpathSync(file);
    } catch {
        real = null;
    }
    if (real === null || !isInside(fs.realpathSync(core), real) || !fs.statSync(real).isFile()) {
        throw new CompileError(`${unit.source}: the engine's leads of ${spelled} were asked for, and it names no file in the engine's core/`);
    }
    const shown = `core/${path.relative(core, file).split(path.sep).join("/")}`;
    const source = `the engine's ${shown}`;
    if (!unit.leadSources.includes(source)) unit.leadSources.push(source);
    unit.written.add("leads");
    const own = fs.realpathSync(ENGINE_ROOT) === fs.realpathSync(root);
    return leadsOf(real, unit.source, fragment, shown).map((lead) => (own ? lead.replaceAll(PLUGIN_ROOT, "") : lead));
}

const UNIT_KEYS = new Set(["tier", "paths", "description"]);

/** A line break, by any spelling a host might honour, or another control character. */
const CONTROL = /[\u0000-\u001f\u007f\u0085\u2028\u2029]/;

function scalar(raw, where) {
    const value = raw.trim();
    if (value.startsWith('"')) {
        try {
            const parsed = JSON.parse(value);
            if (typeof parsed === "string") return parsed;
        } catch {
            // Refused below.
        }
        throw new CompileError(`${where} is not a string this reader can parse — write it plain, or in double quotes with JSON's escapes`);
    }
    if (value.startsWith("'")) {
        const inner = value.length >= 2 && value.endsWith("'") ? value.slice(1, -1) : null;
        if (inner !== null && /^(?:[^']|'')*$/.test(inner)) return inner.replaceAll("''", "'");
        throw new CompileError(`${where} is single-quoted and either not closed or holding a \`'\` not written \`''\``);
    }
    return value;
}

function unitFrontmatter(lines, where) {
    const fields = {};
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (line.trim() === "") continue;
        const match = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/.exec(line);
        if (!match) throw new CompileError(`${where}: frontmatter line ${i + 2} is not \`key: value\` — ${JSON.stringify(line)}`);
        const [, key, rest = ""] = match;
        if (!UNIT_KEYS.has(key)) {
            throw new CompileError(`${where}: \`${key}\` is not a key a unit takes — only \`tier\`, \`paths\` and \`description\` (spec/slots.md)`);
        }
        if (Object.hasOwn(fields, key)) throw new CompileError(`${where}: \`${key}\` is declared twice`);
        if (key !== "paths") {
            fields[key] = scalar(rest, `${where}: \`${key}\``);
            continue;
        }
        if (rest.trim() !== "") {
            let list;
            try {
                list = JSON.parse(rest.trim());
            } catch {
                list = null;
            }
            if (!Array.isArray(list)) {
                throw new CompileError(`${where}: \`paths\` is not a list — write it \`["a/**", "b/*.md"]\`, each glob in double quotes, or as a block of \`- \` items`);
            }
            fields.paths = list;
            continue;
        }
        const items = [];
        while (i + 1 < lines.length && /^\s*-(\s|$)/.test(lines[i + 1])) {
            i += 1;
            items.push(scalar(lines[i].replace(/^\s*-\s*/, ""), `${where}: an item of \`paths\``));
        }
        fields.paths = items;
    }
    return fields;
}

export function parseUnit(name, text, source = `${name}.md`) {
    const where = source;
    if (!SLUG.test(name)) {
        throw new CompileError(`${where}: a unit's name is its file's name less \`.md\`, and it must be a slug — lowercase letters, digits and single hyphens — because a host names a skill by it`);
    }
    if (name === path.basename(ON_READ_INDEX, ".md")) {
        throw new CompileError(`${where}: \`${name}\` is the name of the index this compiler writes beside the rules, so no unit may take it`);
    }
    // A byte-order mark is an editor's, not the author's: it is dropped, as the host drops it.
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
    if (lines[0] !== "---") throw new CompileError(`${where}: a unit opens with frontmatter naming its tier — the first line must be \`---\``);
    const close = lines.indexOf("---", 1);
    if (close === -1) throw new CompileError(`${where}: the frontmatter is never closed with a \`---\` line`);
    const fields = unitFrontmatter(lines.slice(1, close), where);

    const tier = fields.tier;
    if (!LOAD_TIERS.includes(tier)) {
        throw new CompileError(`${where}: \`tier\` is ${tier === undefined ? "missing" : JSON.stringify(tier)}, and it must be one of ${LOAD_TIERS.map((t) => `\`${t}\``).join(", ")}`);
    }
    let paths = null;
    if (tier === "on-path") {
        if (fields.paths === undefined || fields.paths.length === 0) {
            throw new CompileError(`${where}: an on-path unit names the \`paths\` that load it, and this one names none`);
        }
        for (const glob of fields.paths) {
            if (typeof glob !== "string" || glob.trim() === "" || glob !== glob.trim() || CONTROL.test(glob)) {
                throw new CompileError(`${where}: every item of \`paths\` is a glob on one line with no surrounding space, and ${JSON.stringify(glob)} is not`);
            }
            if (glob.startsWith("/") || /^[A-Za-z]:/.test(glob) || glob.split("/").includes("..") || glob.includes("\\")) {
                throw new CompileError(`${where}: \`${glob}\` is not a glob relative to the repository and inside it — no leading \`/\`, no \`..\`, and \`/\` as the separator`);
            }
        }
        paths = fields.paths;
    } else if (fields.paths !== undefined) {
        throw new CompileError(`${where}: \`paths\` scopes an on-path unit, and this one is \`${tier}\` — a key that loads nothing is one its author believes is in force`);
    }
    let description = null;
    if (tier === "always") {
        if (fields.description !== undefined) {
            throw new CompileError(`${where}: an always unit is loaded whole, so nothing reads a description of it — remove \`description\`, or move the unit to a later tier`);
        }
    } else {
        description = fields.description;
        if (typeof description !== "string" || description.trim() === "") {
            throw new CompileError(`${where}: an ${tier} unit needs a one-line \`description\`: it is what an agent reads to decide whether to open the unit`);
        }
        // A quoted scalar can spell a line break as an escape, and would then add an index line nobody declared.
        if (CONTROL.test(description)) {
            throw new CompileError(`${where}: the \`description\` holds a line break or another control character, and it is written as one line of an index`);
        }
        description = description.trim();
    }
    const rest = lines.slice(close + 1);
    while (rest.length && rest[0].trim() === "") rest.shift();
    while (rest.length && rest[rest.length - 1].trim() === "") rest.pop();
    if (rest.length === 0) throw new CompileError(`${where}: the unit carries no guidance below its frontmatter`);
    if (name === BOOT_CARD_UNIT) {
        if (tier !== "always") {
            throw new CompileError(`${where}: \`${BOOT_CARD_UNIT}\` is the name of a workspace's boot card, which every context loads — it is an \`always\` unit, and this one is \`${tier}\``);
        }
        if (rest[0] !== BOOT_CARD_LINE) {
            throw new CompileError(`${where}: a boot card opens with the line \`${BOOT_CARD_LINE}\`, which is how the boot skill knows it is loaded, and this one opens ${JSON.stringify(rest[0])}`);
        }
    } else if (rest[0] === BOOT_CARD_LINE) {
        throw new CompileError(`${where}: \`${BOOT_CARD_LINE}\` opens the boot card, and only the unit named \`${BOOT_CARD_UNIT}\` is one — the boot skill would take this unit for the card`);
    }
    const written = [["leads", LEADS_LINE], ["engine", ENGINE_LINE], ["gates", GATES_LINE]].find(([, line]) => rest.some((text) => line.test(text)));
    if (tier !== "always" && written) {
        const [which] = written;
        throw new CompileError(`${where}: a \`<!-- ${which}: … -->\` line is written out only in an always unit, and this one is \`${tier}\``);
    }
    return { name, tier, paths, description, body: `${rest.join("\n")}\n`, source, bytes: Buffer.byteLength(text, "utf8") };
}

/** The declared `slots.context`, or null where none is declared or there is no manifest; one that will not parse throws. */
export function guidanceDeclaration(workspaceRoot, workspaceDir = ".portulan") {
    const base = path.join(workspaceRoot, workspaceDir);
    const unreadable = unreadableManifest(workspaceRoot, workspaceDir);
    if (unreadable !== null) {
        throw new CompileError(
            `${unreadable.file} is not a manifest this compiler can read: ${unreadable.why}. Read as one declaring no ` +
                `guidance, it would have every rule and skill an earlier run compiled removed, so nothing was written or removed`,
        );
    }
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(base, "workspace.json"), "utf8"));
    } catch {
        return null;
    }
    const declared = manifest?.slots?.context;
    if (declared === undefined) return null;
    if (typeof declared !== "string" || !/^[^#?:/][^#?:]*\/$/.test(declared) || CONTROL.test(declared)) {
        throw new CompileError(`\`slots.context\` is ${JSON.stringify(declared)}, which is not a relative path to a directory ending in \`/\` — the schema's \`dirPath\``);
    }
    const dir = path.resolve(base, declared);
    if (dir === path.resolve(base) || !isInside(path.resolve(base), dir)) {
        throw new CompileError(`\`slots.context\` (${declared}) resolves to the workspace directory itself or outside it — guidance is read from a directory of its own inside it, never from elsewhere`);
    }
    const rel = path.relative(path.resolve(workspaceRoot), dir).split(path.sep).join("/");
    const top = path.relative(path.resolve(base), dir).split(path.sep)[0];
    if (rel.split("/")[0] === ".claude" || GENERATED_DIRS.includes(top)) {
        throw new CompileError(
            `\`slots.context\` (${declared}) lies in a directory \`compile\` writes into, \`.claude/\` or the workspace's \`compile/\` — ` +
                `a unit there would be overwritten by what it compiles to, and \`vendor\` carries neither directory. Keep guidance in a directory of its own, such as \`context/\``,
        );
    }
    return { dir, rel: `${rel}/`, packs: Array.isArray(manifest.packs) ? manifest.packs.filter((p) => typeof p === "string") : [] };
}

/** Every unit, read and checked, or null where no `slots.context` is declared. */
export function guidanceUnits(workspaceRoot, workspaceDir = ".portulan") {
    const declared = guidanceDeclaration(workspaceRoot, workspaceDir);
    if (declared === null) return null;
    let entries;
    try {
        entries = fs.readdirSync(declared.dir, { withFileTypes: true });
    } catch (cause) {
        throw new CompileError(`\`slots.context\` names ${declared.rel}, which could not be listed — ${cause.code ?? cause.message}`);
    }
    let realBase;
    try {
        realBase = fs.realpathSync(path.join(workspaceRoot, workspaceDir));
    } catch (cause) {
        throw new CompileError(`the workspace directory could not be resolved — ${cause.code ?? cause.message}`);
    }
    const written = [path.join(workspaceRoot, ".claude"), ...GENERATED_DIRS.map((g) => path.join(workspaceRoot, workspaceDir, g))].flatMap((at) => {
        try {
            return [fs.realpathSync(at)];
        } catch (cause) {
            if (cause.code === "ENOENT" || cause.code === "ENOTDIR") return [];
            throw new CompileError(`${at} could not be resolved — ${cause.code ?? cause.message}`);
        }
    });
    const units = [];
    const names = entries
        .filter((e) => e.name.endsWith(".md") && (e.isFile() || e.isSymbolicLink()))
        .map((e) => e.name)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const file of names) {
        const full = path.join(declared.dir, file);
        const source = `${declared.rel}${file}`;
        let real;
        try {
            real = fs.realpathSync(full);
        } catch (cause) {
            throw new CompileError(`${source} could not be resolved — ${cause.code ?? cause.message}`);
        }
        if (!isInside(realBase, real)) throw new CompileError(`${source} is a link out of the workspace — a unit is read from inside it, never from elsewhere`);
        if (written.some((at) => isInside(at, real))) {
            throw new CompileError(`${source} is a link into a directory \`compile\` writes into — a unit there would be overwritten by what it compiles to`);
        }
        let text;
        try {
            text = fs.readFileSync(full, "utf8");
        } catch (cause) {
            throw new CompileError(`${source} could not be read — ${cause.code ?? cause.message}`);
        }
        const unit = parseUnit(path.basename(file, ".md"), text, source);
        if (unit.tier === "always") {
            unit.dir = path.dirname(full);
            unit.text = expandedBody(unit, unit.dir, path.resolve(workspaceRoot), declared.packs);
            unit.imports = checkedImports(unit.text, unit.dir, path.resolve(workspaceRoot), source);
        } else {
            for (const { target } of importSpans(unit.body)) {
                const bare = importPath(target);
                if (bare === null || bare.startsWith("~") || path.isAbsolute(bare)) continue;
                if (fs.statSync(path.resolve(path.dirname(full), bare), { throwIfNoEntry: false })?.isFile()) {
                    throw new CompileError(
                        `${source}: \`@${target}\` names a file, and only an always unit may import one — ${STRAY_IMPORT[unit.tier]}. ` +
                            `Name the file to open instead, in a code span`,
                    );
                }
            }
        }
        units.push(unit);
    }
    return { source: declared.rel, units, root: path.resolve(workspaceRoot) };
}

function rebasedText(unit, root, to) {
    if (!unit.imports.length) return unit.text;
    const byLine = new Map();
    for (const { target, file } of unit.imports) {
        const spelled = path.relative(path.join(root, path.dirname(to)), file).split(path.sep).join("/").replaceAll(" ", "\\ ");
        const fragment = target.includes("#") ? target.slice(target.indexOf("#")) : "";
        byLine.set(`@${target}`, `@${spelled}${fragment}`);
    }
    return unit.text
        .split("\n")
        .map((line) => byLine.get(line.trim()) ?? line)
        .join("\n");
}

/** Double-quoted YAML: JSON's escapes are a subset of YAML's. */
const quoted = (s) => JSON.stringify(s);

const kilobytes = (bytes) => (bytes < 1024 ? "<1 KB" : `~${Math.round(bytes / 1024).toLocaleString("en-US")} KB`);

export function claudeCodeGuidance(guidance) {
    const files = [];
    const pointers = [];
    for (const unit of guidance.units) {
        if (unit.tier === "always") {
            const at = `${GUIDANCE_RULES_DIR}/${unit.name}.md`;
            files.push({ unit, path: at, text: unit.text === undefined ? unit.body : rebasedText(unit, guidance.root, at) });
        } else if (unit.tier === "on-path") {
            const header = ["---", "paths:", ...unit.paths.map((glob) => `  - ${quoted(glob)}`), "---", ""].join("\n");
            files.push({ unit, path: `${GUIDANCE_RULES_DIR}/${unit.name}.md`, text: `${header}\n${unit.body}` });
        } else if (unit.tier === "on-invoke") {
            const header = ["---", `name: ${unit.name}`, `description: ${quoted(unit.description)}`, "---", ""].join("\n");
            const mark = `${SKILL_MARK}${unit.source}${SKILL_MARK_TAIL}\n`;
            files.push({ unit, path: `${SKILLS_DIR}/${unit.name}/SKILL.md`, text: `${header}\n${mark}\n${unit.body}` });
        } else {
            pointers.push(unit);
        }
    }
    if (pointers.length) {
        files.push({
            unit: null,
            path: `${GUIDANCE_RULES_DIR}/${ON_READ_INDEX}`,
            text: pointers.map((u) => `- \`${u.source}\` (${kilobytes(u.bytes)}): ${u.description}\n`).join(""),
        });
    }
    return { backend: "claude-code", label: GUIDANCE_HOSTS["claude-code"].label, files };
}

/** `dir` is where the units sit in the vendored tree, as typed from beside `AGENTS.md`. */
export function agentsMdGuidance(guidance, dir) {
    const always = guidance.units.filter((u) => u.tier === "always");
    const pointed = guidance.units.filter((u) => u.tier !== "always");
    // AGENTS.md's hosts follow no import, so each becomes a pointer, as does each file it imports in turn.
    const inline = (u) => {
        if (u.text === undefined) return u.body;
        const vendored = (file) => `\`${path.posix.normalize(path.posix.join(dir, path.relative(u.dir, file).split(path.sep).join("/")))}\``;
        const byLine = new Map(
            u.imports.map(({ target, file, nested = [] }) => [
                `@${target}`,
                [
                    `- ${vendored(file)}: read it in full — a host that follows imports loads it here.`,
                    ...nested.map((n) => `- ${vendored(n.file)}: read it in full too — ${vendored(n.from)} imports it.`),
                ].join("\n"),
            ]),
        );
        return u.text
            .split("\n")
            .map((line) => byLine.get(line.trim()) ?? line)
            .join("\n");
    };
    const pointer = (u) => {
        const where = `\`${dir}${u.name}.md\``;
        if (u.tier === "on-path") return `- ${where}: when you work on ${u.paths.map((g) => `\`${g}\``).join(", ")}. ${u.description}`;
        return `- ${where}: ${u.description}`;
    };
    return { inline: always.map(inline), pointers: pointed.map(pointer) };
}

/** Why `rel` cannot be written as a real `kind`, or null; a link stops it anywhere, even one inside the repository. */
function landing(workspaceRoot, rel, kind = "file") {
    const parts = rel.split("/");
    let at = workspaceRoot;
    for (const [i, part] of parts.entries()) {
        at = path.join(at, part);
        let stat;
        try {
            stat = fs.lstatSync(at);
        } catch (cause) {
            if (cause.code === "ENOENT") return null;
            throw new CompileError(`${rel} could not be examined — ${cause.code ?? cause.message}`);
        }
        const last = i === parts.length - 1;
        const here = parts.slice(0, i + 1).join("/");
        if (stat.isSymbolicLink()) {
            return last ? "is a link, and writing it would change whatever the link points at" : `lies through a link, ${here}, and writing through it would change whatever the link points at`;
        }
        const want = last ? kind : "directory";
        if (want === "file" ? !stat.isFile() : !stat.isDirectory()) return last ? `is not a ${kind}` : `cannot be created, because ${here} is not a directory`;
    }
    return null;
}

function listReal(workspaceRoot, rel) {
    const dir = path.join(workspaceRoot, ...rel.split("/"));
    if (landing(workspaceRoot, rel, "directory") !== null || !fs.existsSync(dir)) return [];
    try {
        return fs.readdirSync(dir, { withFileTypes: true });
    } catch (cause) {
        throw new CompileError(`${rel} could not be listed — ${cause.code ?? cause.message}`);
    }
}

/** Judged before either half writes, so a refusal leaves no gate artifact written beside it. */
function planGuidance(guidance, workspaceRoot) {
    const files = guidance ? claudeCodeGuidance(guidance).files : [];
    const rules = files.filter((f) => f.path.startsWith(`${GUIDANCE_RULES_DIR}/`));
    const owedFiles = rules.length
        ? [{ unit: null, marker: true, path: `${GUIDANCE_RULES_DIR}/${RULES_MARKER}`, text: markerText(rules.map((f) => path.posix.basename(f.path))) }, ...files]
        : files;
    const owed = new Set(owedFiles.map((f) => f.path));

    for (const file of owedFiles) {
        const stop = landing(workspaceRoot, file.path);
        if (stop) throw new CompileError(`${file.path} ${stop} — this compiler writes only real files, and nothing through a link`);
    }

    const rulesDir = path.join(workspaceRoot, ...GUIDANCE_RULES_DIR.split("/"));
    const entries = listReal(workspaceRoot, GUIDANCE_RULES_DIR);
    const markerEntry = entries.find((e) => e.name === RULES_MARKER);
    let listed = null;
    if (markerEntry) {
        let text = null;
        if (markerEntry.isFile()) {
            try {
                text = fs.readFileSync(path.join(rulesDir, RULES_MARKER), "utf8");
            } catch (cause) {
                throw new CompileError(`${GUIDANCE_RULES_DIR}/${RULES_MARKER} could not be read — ${cause.code ?? cause.message}`);
            }
        }
        listed = text === null ? undefined : markedRules(text) ?? undefined;
    }
    if (rules.length) {
        if (listed === undefined) {
            throw new CompileError(`${GUIDANCE_RULES_DIR}/${RULES_MARKER} is not a marker this compiler wrote, so nothing shows which rules beside it are its own. Move the directory's files out, then compile again`);
        }
        if (listed === null) {
            const markdown = entries.filter((e) => e.name.endsWith(".md")).map((e) => e.name).sort();
            if (markdown.length) {
                const them = markdown.length === 1 ? "it" : "them";
                throw new CompileError(
                    `${GUIDANCE_RULES_DIR}/ holds ${markdown.join(", ")} and no \`${RULES_MARKER}\` marker, so nothing shows this compiler wrote ${them}, and it will not overwrite or remove ${them}. Move ${them} out of the directory, then compile again`,
                );
            }
        } else {
            for (const file of rules) {
                const name = path.posix.basename(file.path);
                if (!entries.some((e) => e.name === name) || listed.has(name)) continue;
                // A run stopped before its marker leaves exactly its unit's output; anything else was written by hand.
                let current;
                try {
                    current = fs.readFileSync(path.join(rulesDir, name), "utf8");
                } catch (cause) {
                    throw new CompileError(`${file.path} could not be read — ${cause.code ?? cause.message}`);
                }
                if (current !== file.text) {
                    throw new CompileError(`${file.path} exists and was not compiled here — ${file.unit ? file.unit.source : `the on-read units in ${guidance.source}`} would replace a rule written by hand. Rename the unit or the rule`);
                }
            }
        }
    }
    for (const file of files) {
        if (!file.path.startsWith(`${SKILLS_DIR}/`)) continue;
        let current;
        try {
            current = fs.readFileSync(path.join(workspaceRoot, ...file.path.split("/")), "utf8");
        } catch {
            continue;
        }
        const source = skillSource(current);
        if (source === null) {
            throw new CompileError(`${file.path} exists and was not compiled here — ${file.unit.source} would replace a skill written by hand. Rename the unit or the skill`);
        }
        if (source !== file.unit.source) {
            throw new CompileError(
                `${file.path} was compiled from ${source}, and ${file.unit.source} would replace it: two units compile to one skill. Rename one of them, or remove the skill by hand if its unit is gone, then compile again`,
            );
        }
    }

    const stray = [];
    if (listed instanceof Set || rules.length) {
        for (const entry of entries) {
            const rel = `${GUIDANCE_RULES_DIR}/${entry.name}`;
            if (owed.has(rel)) continue;
            const ours = listed instanceof Set && entry.isFile() && (listed.has(entry.name) || entry.name === RULES_MARKER);
            stray.push({ path: rel, removable: ours });
        }
    }
    const skillsDir = path.join(workspaceRoot, ...SKILLS_DIR.split("/"));
    for (const entry of listReal(workspaceRoot, SKILLS_DIR)) {
        if (!entry.isDirectory()) continue;
        const rel = `${SKILLS_DIR}/${entry.name}/SKILL.md`;
        const file = path.join(skillsDir, entry.name, "SKILL.md");
        let text;
        try {
            if (!fs.lstatSync(file).isFile()) continue;
            text = fs.readFileSync(file, "utf8");
        } catch {
            continue;
        }
        if (skillSource(text) !== null && !owed.has(rel)) stray.push({ path: rel, removable: true });
    }
    // What the marker may list mid-write: the rules it lists now that are still there and owed; null with no marker.
    const present = new Set(entries.filter((e) => e.isFile()).map((e) => e.name));
    const kept = listed instanceof Set || rules.length
        ? rules.map((f) => path.posix.basename(f.path)).filter((name) => listed instanceof Set && listed.has(name) && present.has(name))
        : null;
    return { owedFiles, stray, kept };
}

function emitGuidance(guidance, plan, { workspaceRoot, check, say }) {
    const { owedFiles, stray, kept } = plan;
    if (guidance === null && stray.length === 0) return 0;

    if (guidance) {
        const files = owedFiles.filter((f) => !f.marker);
        const counts = LOAD_TIERS.map((tier) => `${guidance.units.filter((u) => u.tier === tier).length} ${tier}`).join(", ");
        say(`guidance: ${guidance.units.length} unit(s) in ${guidance.source} — ${counts}`);
        for (const [id, host] of Object.entries(GUIDANCE_HOSTS)) {
            const cannot = LOAD_TIERS.filter((tier) => host[tier] === null);
            const degraded = guidance.units.filter((u) => cannot.includes(u.tier));
            if (id === "claude-code") {
                say(`  ${host.label}: expresses every tier — ${files.length} file(s)`);
                for (const unit of guidance.units) {
                    const target = unit.tier === "on-read" ? `${GUIDANCE_RULES_DIR}/${ON_READ_INDEX}, a pointer` : files.find((f) => f.unit === unit).path;
                    say(`    unit    ${unit.name.padEnd(30)} ${unit.tier.padEnd(9)} → ${target}`);
                }
            } else {
                say(
                    `  ${host.label}: expresses ${LOAD_TIERS.filter((t) => host[t] !== null).join(" and ")}; ${cannot.join(" and ")} degrade to an on-read pointer` +
                        ` — written by \`portulan vendor --host\`, not here`,
                );
                for (const unit of degraded) say(`    degrade ${unit.name.padEnd(30)} ${unit.tier.padEnd(9)} → a pointer in AGENTS.md`);
            }
        }
    }

    if (check) {
        let drifted = 0;
        for (const file of owedFiles) {
            const target = path.join(workspaceRoot, ...file.path.split("/"));
            let current = null;
            try {
                current = fs.readFileSync(target, "utf8");
            } catch {
                say(file.marker
                    ? `RED — ${target} does not exist; it is the marker that lists the rules this compiler wrote. Recompile to write it.`
                    : `RED — ${target} does not exist; ${file.unit ? file.unit.source : "an on-read unit"} compiles to it`);
                drifted += 1;
                continue;
            }
            if (current !== file.text) {
                say(file.marker
                    ? `RED — ${target} does not list the rules the units compile to now. Recompile to rewrite it.`
                    : file.unit?.leadSources?.length
                      ? `RED — ${target} has drifted from ${file.unit.source}, whose ${[...file.unit.written].sort().join(" and ")} are written from ${file.unit.leadSources.join(" and ")}. Edit the unit or those files, then recompile.`
                      : `RED — ${target} has drifted from ${file.unit ? file.unit.source : `the on-read units in ${guidance.source}`}. Edit the unit, then recompile.`);
                drifted += 1;
            }
        }
        for (const s of stray) {
            const where = path.join(workspaceRoot, ...s.path.split("/"));
            say(s.removable
                ? `RED — ${where} is where this compiler writes guidance, and no unit compiles to it. Recompile to remove it.`
                : `RED — ${where} is in the directory this compiler writes its rules to, and is not a file it wrote, so a recompile leaves it. Move it out by hand.`);
            drifted += 1;
        }
        return drifted;
    }

    // Listed only once written, unlisted before removal: an interrupted run never lists a file it did not write.
    const markerPath = path.join(workspaceRoot, ...GUIDANCE_RULES_DIR.split("/"), RULES_MARKER);
    if (kept !== null) {
        fs.mkdirSync(path.dirname(markerPath), { recursive: true });
        fs.writeFileSync(markerPath, markerText(kept));
    }
    for (const s of stray) {
        const target = path.join(workspaceRoot, ...s.path.split("/"));
        if (target === markerPath) continue;
        if (!s.removable) {
            say(`left ${target} — it is not a file this compiler wrote, so it is not this compiler's to remove`);
            continue;
        }
        fs.rmSync(target);
        say(`removed ${target} — no unit compiles to it`);
        if (s.path.startsWith(`${SKILLS_DIR}/`)) {
            try {
                fs.rmdirSync(path.dirname(target));
            } catch {
                // Not empty: whatever else sits beside it was not written here.
            }
        }
    }
    for (const file of owedFiles) {
        if (file.marker) continue;
        const target = path.join(workspaceRoot, ...file.path.split("/"));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.text);
        say(`wrote ${target}`);
    }
    const marker = owedFiles.find((f) => f.marker);
    if (marker) {
        fs.writeFileSync(markerPath, marker.text);
        say(`wrote ${markerPath}`);
    } else if (kept !== null) {
        fs.rmSync(markerPath);
        say(`removed ${markerPath} — no unit compiles to a rule`);
    }
    if (landing(workspaceRoot, GUIDANCE_RULES_DIR, "directory") === null) {
        try {
            fs.rmdirSync(path.join(workspaceRoot, ...GUIDANCE_RULES_DIR.split("/")));
        } catch {
            // Absent, or holding files: either way there is nothing to tidy.
        }
    }
    return 0;
}

/** The guidance half alone: the gate policy is not read, so host settings stay the output of a `compile` a human runs. */
export function compileGuidance(named, { check = false, say = () => {} } = {}) {
    const { workspaceRoot, workspaceDir } = resolveWorkspace(named);
    const guidance = guidanceUnits(workspaceRoot, workspaceDir);
    const plan = planGuidance(guidance, workspaceRoot);
    return { declared: guidance !== null, drifted: emitGuidance(guidance, plan, { workspaceRoot, check, say }) };
}

/** What compiling the guidance would change, writing nothing: `next` null removes a file, and `left` is what a compile leaves. */
export function guidanceEdits(named) {
    const { workspaceRoot, workspaceDir } = resolveWorkspace(named);
    const guidance = guidanceUnits(workspaceRoot, workspaceDir);
    const { owedFiles, stray, kept } = planGuidance(guidance, workspaceRoot);
    const markerRel = `${GUIDANCE_RULES_DIR}/${RULES_MARKER}`;
    const current = (rel) => {
        try {
            return fs.readFileSync(path.join(workspaceRoot, ...rel.split("/")), "utf8");
        } catch (cause) {
            if (cause.code === "ENOENT") return null;
            throw new CompileError(`${rel} could not be read — ${cause.code ?? cause.message}`);
        }
    };
    const edits = [];
    for (const s of stray) if (s.removable && s.path !== markerRel) edits.push({ file: s.path, next: null });
    for (const file of owedFiles) if (!file.marker && current(file.path) !== file.text) edits.push({ file: file.path, next: file.text });
    const marker = owedFiles.find((f) => f.marker);
    if (marker && current(markerRel) !== marker.text) edits.push({ file: markerRel, next: marker.text });
    else if (!marker && kept !== null && current(markerRel) !== null) edits.push({ file: markerRel, next: null });
    return { root: path.resolve(workspaceRoot), edits, left: stray.filter((s) => !s.removable).map((s) => s.path) };
}

// ---------------------------------------------------------------- the manifest's declarations

/** `{ file, why }` for a manifest that is there and will not parse as an object; null when it reads or is absent. */
export function unreadableManifest(workspaceRoot, workspaceDir = ".portulan") {
    const file = path.join(workspaceRoot, workspaceDir, "workspace.json");
    let raw;
    try {
        raw = fs.readFileSync(file, "utf8");
    } catch (cause) {
        if (cause.code === "ENOENT") return null;
        return { file, why: `it could not be read — ${cause.code ?? cause.message}` };
    }
    let manifest;
    try {
        manifest = JSON.parse(raw);
    } catch (cause) {
        return { file, why: `it is not valid JSON — ${cause.message}` };
    }
    if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) return { file, why: "it is not a JSON object" };
    return null;
}

/** `{ file, declared, reason }`, `reason` one of `declared`, `no-key`, `no-manifest` or `refused`. */
export function policyDeclaration(workspaceRoot, workspaceDir = ".portulan") {
    const base = path.join(workspaceRoot, workspaceDir);
    const manifest = path.join(base, "workspace.json");
    const fallback = (reason) => ({ file: path.join(workspaceRoot, workspaceDir, "gates.json"), declared: false, reason });
    let declared;
    try {
        declared = JSON.parse(fs.readFileSync(manifest, "utf8")).gates;
    } catch {
        // An unreadable manifest reaches here only from the hook's reader, which must not stop.
        return fallback("no-manifest");
    }
    if (declared === undefined) return fallback("no-key");
    // Contained after resolution: a `../` chain passes any pattern, and the hook reads this on every tool call.
    if (typeof declared === "string" && declared.trim() && FILE_PATH.test(declared)) {
        const resolved = path.resolve(base, declared);
        if (resolved !== base && isInside(base, resolved)) return { file: resolved, declared: true, reason: "declared" };
    }
    return fallback("refused");
}

export function policyPath(workspaceRoot, workspaceDir = ".portulan") {
    return policyDeclaration(workspaceRoot, workspaceDir).file;
}

/** The prompt-cache lifetimes Claude Code takes. */
export const CACHE_LIFETIMES = ["5m", "1h"];

const SESSION_SWITCHES = {
    git_instructions: (v) => typeof v === "boolean",
    cache_lifetime: (v) => CACHE_LIFETIMES.includes(v),
};
const HEADLESS_SWITCHES = { ...SESSION_SWITCHES, exclude_dynamic_sections: (v) => typeof v === "boolean" };

/** The manifest's `sessions`, or null where it declares none or cannot be read; a shape the schema refuses throws. */
export function sessionsDeclaration(workspaceRoot, workspaceDir = ".portulan") {
    const manifest = path.join(workspaceRoot, workspaceDir, "workspace.json");
    let declared;
    try {
        declared = JSON.parse(fs.readFileSync(manifest, "utf8")).sessions;
    } catch {
        return null;
    }
    if (declared === undefined) return null;
    const where = path.relative(workspaceRoot, manifest).split(path.sep).join("/");
    const refuse = (what) =>
        new CompileError(`\`sessions\` in ${where} ${what}; ../spec/slots.md gives its shape, and \`doctor\` names every finding`);
    const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
    const check = (value, allowed, at) => {
        if (!plain(value)) throw refuse(`${at}is not an object`);
        for (const [key, v] of Object.entries(value)) {
            if (key === "headless" && at === "") continue;
            if (!Object.hasOwn(allowed, key)) throw refuse(`${at}names \`${key}\`, which is no session switch`);
            if (!allowed[key](v)) throw refuse(`${at}sets \`${key}\` to ${JSON.stringify(v)}, which it does not take`);
        }
    };
    check(declared, SESSION_SWITCHES, "");
    if (declared.headless !== undefined) check(declared.headless, HEADLESS_SWITCHES, "at `headless` ");
    return { manifest: where, ...declared };
}

/** The manifest's `spend` as the ledger reads it, or null where it declares none or cannot be read; a refused one throws. */
export function spendDeclaration(workspaceRoot, workspaceDir = ".portulan") {
    const manifest = path.join(workspaceRoot, workspaceDir, "workspace.json");
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(manifest, "utf8"));
    } catch {
        return null;
    }
    const declared = parsed?.spend;
    if (declared === undefined) return null;
    const where = path.relative(workspaceRoot, manifest).split(path.sep).join("/");
    let spend;
    try {
        spend = { manifest: where, ...readSpend(declared, where) };
    } catch (error) {
        if (error instanceof LedgerError) throw new CompileError(error.message);
        throw error;
    }
    const version = /^([0-9]+)\.([0-9]+)$/.exec(parsed.portulan?.spec ?? "");
    if (spend.restart !== null && version && Number(version[1]) === 2 && Number(version[2]) < 13) {
        throw new CompileError(
            `\`spend.restart\` in ${where} is Workspace Definition 2.13's, and this manifest declares ${version[0]}, whose validator ` +
                "refuses it as an unknown key. Declare 2.13, or remove the key",
        );
    }
    return spend;
}

/** `guidanceOnly` is true where guidance still compiles, and `"leftover"` where only an earlier run's is removed. */
function undeclaredPolicyMessage(policyFile, workspaceRoot, workspaceDir, packOptions, reason = "no-key", guidanceOnly = false) {
    const manifest = path.join(workspaceRoot, workspaceDir, "workspace.json");
    const conventional = reason === "refused" && fs.existsSync(policyFile);
    const opening =
        reason === "refused"
            ? `\`workspace.json\` names a gate policy this compiler will not read — its top-level ` +
              `\`gates\` key is not a relative path to a file inside the workspace — and ` +
              (conventional
                  ? `the \`gates.json\` at ${policyFile} is not the policy it names, so it is not compiled in its place.`
                  : `there is no \`gates.json\` at ${policyFile} either.`)
            : reason === "no-manifest"
              ? `this workspace declares no gate policy — there is no readable \`workspace.json\` at ` +
                `${manifest}, and there is no \`gates.json\` at ${policyFile}.`
              : `this workspace declares no gate policy — \`workspace.json\` has no top-level \`gates\` key, ` +
                `and there is no \`gates.json\` at ${policyFile}.`;
    const outcome =
        guidanceOnly === "leftover"
            ? "No enforcement is compiled, and no guidance is declared: what an earlier run compiled from guidance is this compiler's to remove, and is named below."
            : guidanceOnly
              ? "No enforcement is compiled; the workspace's guidance still is."
              : "Nothing was compiled and nothing was written.";
    const lines = [`${opening} ${outcome}`];
    let composed = null;
    try {
        composed = packContributions(workspaceRoot, workspaceDir, packOptions);
    } catch {
        // A pack's refusal would replace this answer; with a policy declared, the next run raises it.
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
                `a fragment tightens a policy, and ${conventional ? "this run reads none" : "there is none here"} to tighten.`,
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

// ---------------------------------------------------------------- pack-contributed gate fragments

const TIER_ORDER = ["auto", "propose", "gated", "prohibited"];

export const tierRank = (tier) => TIER_ORDER.indexOf(tier);

/** The first of `roots` holding the pack; `dir` and `root` are null, with a `why`, where none does or the name is malformed. */
export function resolvePack(rawName, roots = []) {
    const name = String(rawName);
    const parts = name.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return { name, category: null, pack: null, dir: null, manifest: null, root: null, why: "not in `category/name` form" };
    }
    const [category, pack] = parts;
    // Slugs, so no `..` segment resolves a pack outside the roots.
    if (!SLUG.test(category) || !SLUG.test(pack)) {
        return { name, category: null, pack: null, dir: null, manifest: null, root: null, why: "`category/name` must both be slugs" };
    }
    for (const root of roots) {
        const dir = path.join(root, category, pack);
        const manifest = path.join(dir, "pack.json");
        if (fs.existsSync(manifest)) return { name, category, pack, dir, manifest, root, why: null };
    }
    return { name, category, pack, dir: null, manifest: null, root: null, why: "no pack.json under any resolution root" };
}

export function packRoots(workspaceDir, workspace) {
    const tree = workspace?.tree;
    if (typeof tree === "string" && tree.trim()) return [path.resolve(workspaceDir, tree, "packs")];
    return [];
}

/** Named roots replace the one derived from `tree` rather than precede it; `{}` where none is named. */
export function namedRootsOption(workspaceRoot, namedRoots) {
    if (!namedRoots?.length) return {};
    return { packRoots: [...namedRoots] };
}

export function rootPlan(workspaceDir, manifest, { named = [], namedGiven = null, discovery = null, forced = false } = {}) {
    return resolutionRoots({ named, namedGiven, derived: packRoots(workspaceDir, manifest), discovery, forced });
}

/** `discovered` where discovery found the root; else `tree` or `outside-tree` by where it sits, never how it was named. */
export function recordedOrigin(root, plan, workspaceRoot) {
    const same = (a, b) => path.resolve(a) === path.resolve(b);
    const tagged = (plan?.origins ?? []).find((o) => same(o.root, root));
    if (tagged?.origin === "discovered") return "discovered";
    // Real paths on both sides: compared lexically, an alias of the tree would record `outside-tree`.
    const real = (dir) => {
        try {
            return fs.realpathSync(path.resolve(dir));
        } catch {
            return path.resolve(dir);
        }
    };
    return isInside(real(workspaceRoot), real(root)) ? "tree" : "outside-tree";
}

/** Compared parsed, key-sorted and whole: `composeFragments` takes every field of a fragment. */
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

/** The copy behind a discovered answer, or null: only a discovered one can shadow, as a named root replaces the derived. */
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
        return { contributions: [], unresolved: [] };
    }
    const declared = manifest?.packs;
    if (!Array.isArray(declared) || declared.length === 0) return { contributions: [], unresolved: [] };

    // `options.packRoots` is the final root set, `[]` included; `options.named` is the command line's.
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
            origin: recordedOrigin(found.root, plan, workspaceRoot),
            version: typeof packManifest?.portulan?.version === "string" ? packManifest.portulan.version : null,
        });
    }
    return { contributions, unresolved, plan };
}

/** Tighten-only: a fragment that would demote a rule, or change what it matches, throws. */
export function composeFragments(policy, contributions) {
    const rules = [...(policy?.rules ?? [])];
    const at = new Map(rules.map((rule, i) => [rule?.id, i]));
    const added = [];
    const tightened = [];

    for (const { pack, fragments } of contributions) {
        for (const fragment of fragments ?? []) {
            const id = fragment?.id;
            // Checked before `parse` so the refusal names the pack, and so two id-less fragments cannot merge on `undefined`.
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
            if (baseRank < 0) {
                throw new CompileError(
                    `pack \`${pack}\` contributes a fragment for \`${id}\`, but the policy's own rule \`${id}\` ` +
                        `declares tier ${JSON.stringify(base?.tier)}, which is not one of ${TIER_ORDER.join(" / ")}. ` +
                        `Refusing to compose onto a rule whose tier cannot be compared — fix the workspace's gate ` +
                        `policy first. A pack must never be able to make an invalid policy compile.`,
                );
            }
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

export function render(settings) {
    return `${JSON.stringify(settings, null, 2)}\n`;
}

// ---------------------------------------------------------------- the command line

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

function printGuidanceMatrix(say, guidance) {
    const hosts = Object.entries(GUIDANCE_HOSTS);
    say(`guidance: ${guidance.source} — ${guidance.units.length} unit(s), ${hosts.length} host(s)`);
    say();
    for (const [id, host] of hosts) {
        const cannot = LOAD_TIERS.filter((tier) => host[tier] === null);
        say(`  ${id.padEnd(16)} ${cannot.length ? `expresses ${LOAD_TIERS.filter((t) => host[t] !== null).join(" and ")}; ${cannot.join(" and ")} degrade to an on-read pointer` : "expresses every tier"}`);
    }
    say();
    const width = Math.max(4, ...guidance.units.map((u) => u.name.length));
    say(`  ${"unit".padEnd(width)}  ${"tier".padEnd(9)}  ${hosts.map(([id]) => id.padEnd(16)).join("  ")}`);
    for (const unit of guidance.units) {
        const cells = hosts.map(([, host]) => (host[unit.tier] === null ? "pointer" : "expressed").padEnd(16));
        say(`  ${unit.name.padEnd(width)}  ${unit.tier.padEnd(9)}  ${cells.join("  ")}`);
    }
    say();
    say("  A unit a host cannot express in its tier is carried as a one-line pointer to its file: late, never lost.");
}

/** A directory with `workspace.json` is a workspace directory, its own root without a `tree`; any other, a repository root. */
export function resolveWorkspace(named) {
    const dir = path.resolve(named);
    const manifestPath = path.join(dir, "workspace.json");
    let raw;
    try {
        raw = fs.readFileSync(manifestPath, "utf8");
    } catch (cause) {
        // As given, not resolved: `compile` prints paths built on it.
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
        // A `tree` that does not contain its workspace cannot be trusted, so the answer is the one that changes nothing.
        if (inside && !inside.startsWith("..") && !path.isAbsolute(inside)) {
            return { workspaceRoot: root, workspaceDir: inside.split(path.sep).join("/") };
        }
        return { workspaceRoot: named, workspaceDir: ".portulan" };
    }
    return { workspaceRoot: dir, workspaceDir: "." };
}

function usage() {
    return [
        "portulan compile — compile a workspace's gate policy into host enforcement",
        "",
        "  portulan compile [--check] [--matrix] [--workspace <dir>] [--pack-root <dir>|auto]...",
        "",
        "  (no flag)     compile the policy and the guidance, and write each artifact",
        "  --check       write nothing; exit 1 if an artifact is out of date against the policy or the guidance",
        "  --matrix      print every rule against every backend, the gates neither compiles, and every",
        "                guidance unit against every host",
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
    // First, so `--help` is answered whatever else the command line holds.
    if (argv.includes("--help") || argv.includes("-h")) {
        say(usage());
        return 0;
    }
    try {
        let named = process.cwd();
        let check = false;
        let showMatrix = false;
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
                // A value starting with `-` is a flag, not a path; a directory so named is `./-name`.
                if (root === undefined || root.startsWith("-"))
                    throw new CompileError(
                        "--pack-root needs a directory, or `auto` to discover one from the host plugin cache. " +
                            "A directory actually named `auto` is `./auto`",
                    );
                // Matched raw, so `./auto` still names a directory.
                if (root === AUTO) {
                    forced = true;
                    continue;
                }
                // A missing or file-valued root would compile green with every pack unresolved.
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

        // Before the workspace is resolved, so no workspace or policy error masks this refusal.
        const bothAsked = namedWithAuto(namedRoots, forced);
        if (bothAsked) throw new CompileError(bothAsked);

        const { workspaceRoot, workspaceDir } = resolveWorkspace(named);
        // First: every reader below takes a manifest that will not parse for one declaring nothing.
        const unreadable = unreadableManifest(workspaceRoot, workspaceDir);
        if (unreadable !== null) {
            throw new CompileError(
                `${unreadable.file} is not a manifest this compiler can read: ${unreadable.why}. Read as one declaring ` +
                    `nothing, it would remove every rule and skill an earlier run compiled from its guidance and compile a ` +
                    `\`gates.json\` found by convention in its place, so nothing was compiled, written or removed. Fix the ` +
                    `manifest, then compile again`,
            );
        }
        const guidance = guidanceUnits(workspaceRoot, workspaceDir);
        const guidancePlan = showMatrix ? null : planGuidance(guidance, workspaceRoot);
        const sessions = sessionsDeclaration(workspaceRoot, workspaceDir);
        const spend = spendDeclaration(workspaceRoot, workspaceDir);
        const { file: policyFile, declared: policyDeclared, reason: policyReason } = policyDeclaration(workspaceRoot, workspaceDir);
        const packOptions = { named: namedRoots, discovery: () => discoverPackRoots(), forced };
        if (policyReason === "refused") {
            throw new CompileError(undeclaredPolicyMessage(policyFile, workspaceRoot, workspaceDir, packOptions, policyReason));
        }
        if (!policyDeclared && !fs.existsSync(policyFile)) {
            // Only a manifest read and naming no policy clears leftovers: one that is missing has not been authored.
            const leftover = guidance === null && policyReason === "no-key" && guidancePlan !== null && guidancePlan.stray.length > 0;
            if (guidance === null && !leftover) {
                throw new CompileError(undeclaredPolicyMessage(policyFile, workspaceRoot, workspaceDir, packOptions, policyReason));
            }
            say(`note    ${undeclaredPolicyMessage(policyFile, workspaceRoot, workspaceDir, packOptions, policyReason, leftover ? "leftover" : true)}`);
            if (sessions !== null) {
                say(
                    `note    \`sessions\` in ${sessions.manifest} compiled nothing: its host switches ride the settings a gate ` +
                        `policy compiles to, and this workspace has none`,
                );
            }
            if (spend !== null) {
                say(
                    `note    \`spend\` in ${spend.manifest} compiled nothing: what it declares rides the restart advisory's commands ` +
                        `in the settings a gate policy compiles to, and this workspace has none`,
                );
            }
            say();
            if (showMatrix) {
                printGuidanceMatrix(say, guidance);
                return 0;
            }
            const drifted = emitGuidance(guidance, guidancePlan, { workspaceRoot, check, say });
            if (!check) return 0;
            if (drifted) return 1;
            say("GREEN — every compiled guidance file matches its unit");
            return 0;
        }
        const policy = readJson(policyFile, "the gate policy");
        // A thunk, so the host's plugin record is read only where discovery can win.
        const { contributions, unresolved, plan } = packContributions(workspaceRoot, workspaceDir, {
            named: namedRoots,
            discovery: () => discoverPackRoots(),
            forced,
        });
        // Only under `--matrix`, as it moves with what is installed; but a union is never silent.
        if (plan && (showMatrix || plan.source === "union")) say(`packs: resolution root ${plan.source} — ${plan.why}`);
        const composed = composeFragments(policy, contributions);
        const parsed = parse(composed.policy);
        const source = path.relative(workspaceRoot, policyFile).split(path.sep).join("/");
        const columns = backends(parsed, {
            source,
            root: path.resolve(workspaceRoot),
            workspaceDir,
            packProvenance: contributions,
            sessions,
            spend,
        });

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
            if (guidance) {
                say();
                printGuidanceMatrix(say, guidance);
            }
            return 0;
        }

        for (const column of columns) {
            say(`${column.label}: ${column.compiled.length} compiled, ${column.refused.length} refused`);
            for (const gate of column.compiled) say(`  gate    ${gate.id.padEnd(38)} ${gate.surface}`);
            for (const r of column.refused) say(`  refused ${r.id.padEnd(38)} ${r.why}`);
            for (const n of column.notes) say(`  note    ${n}`);
            say();
        }

        if (check) {
            let drifted = 0;
            for (const column of columns) {
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
            drifted += emitGuidance(guidance, guidancePlan, { workspaceRoot, check, say });
            if (drifted) return 1;
            say(guidance ? "GREEN — every emitted artifact matches the policy, and every guidance file its unit" : "GREEN — every emitted artifact matches the policy");
            return 0;
        }

        for (const column of columns) {
            if (!column.artifact) {
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
        emitGuidance(guidance, guidancePlan, { workspaceRoot, check, say });
        return 0;
    } catch (error) {
        // Any throw exits 2, never 1: nothing was compared, so there is no verdict.
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
