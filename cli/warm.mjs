#!/usr/bin/env node
// The warm-start A/B: what a fresh session costs when an earlier session left its prefix in the prompt cache,
// against the same session priced cold. [`../core/operating/sessions.md`](../core/operating/sessions.md) is
// the doctrine this measures, and [`../evals/ab/warm.md`](../evals/ab/warm.md) its specification and record.
//
//   node cli/warm.mjs run --tree <dir> --into <dir> --label <name> [--task boot|probe] [--runs <n>]
//       [--copies one|each] [--between commit] [--declared <workspace dir>] [--git-instructions on|off]
//       [--cache-lifetime 5m|1h] [--exclude-dynamic-sections] [--local] [--model <id>] [--agent <command>]
//       [--read <multiplier>] [--output <multiplier>]
//   node cli/warm.mjs report <sequence dir> [<treatment sequence dir>] [--read <multiplier>] [--output <multiplier>]
//
// ## A sequence
//
// `run` starts `--runs` fresh headless sessions one after another, each when the one before it has ended,
// with one task's prompt and one invocation, in one clone of `--tree`'s committed HEAD, or under `--copies
// each` in a clone per run, so that no two share a working directory. The first run finds nothing of its
// own cached; each later one finds what the run before it left, within the cache lifetime. `--between
// commit` commits in the clone between runs, which is what moves a local session's startup git snapshot, and
// `--local` starts the child without the variable that marks a hosted session, which takes no snapshot.
//
// The arm under test is what the child starts with: the tree's own compiled settings, and the switches named
// here or, under `--declared`, a workspace's `sessions.headless`. The rest of the child's environment is the
// parent's, less the variables a parent session sets for its own conversation, which would give the child an
// effort, a context or a prefix no fresh session has, and less the host's own switch variables, so that only
// the arm decides them.
//
// ## Three lines, from the host's own records
//
// Each run's transcript is read with the ledger's reader (one request per message id, the main chain only)
// and reported in the maintainer's three lines of 2026-09-24, A first:
//
// - **A, Portulan's share**: the tokens that carried what Portulan installs or manages, counted once for every
//   request that sent them, by the split of the five-run set of 2026-09-24. A tool's result and the skill text
//   the host injects are matched line by line against the tree's tracked files that are not code, and each
//   takes its share by bytes of the context's growth at the request it entered. What the host loaded of
//   Portulan's before the first request, the plugin's descriptions and any always tier, is estimated from its
//   bytes, since the host records that request's context only as a total. A hook's output is not in A.
// - **B, the whole task**: every token the host recorded for the run, cache reads included.
// - **C, the cost**, as an index with the before at 100: uncached input 1, a write at its lifetime's multiplier,
//   a read at the model's read multiplier and output at its rate, which `--read` and `--output` name, the
//   general ones of `0038` otherwise (0.1 and 5). The before is a sequence's cold figure, or the control's
//   billed figure when a treatment is read against it.
//
// A run is priced twice. **Billed** is what the host recorded. **Cold** prices the first request's reads as
// writes at the run's lifetime: the run as if nothing had been cached before it, the convention the five-run
// set's first report priced by. A sequence's warm figure is the mean billed total of its runs after the first, and its cold
// figure the mean cold total of all of them. Two sequences compare by their cost: every run as billed, the first priced
// cold, since what the cache held before a sequence began is neither arm's.
//
// ## Never in a recipe
//
// It starts real sessions, which spend, and reads the host's usage records, which differ per machine, so it
// never runs inside a verify recipe (`0038`'s ruling on the ledger). Its suite stands a stub in for the agent.
//
// Exit 0 done · 1 `report` of two sequences only: a run of either was not measured or changed its clone, a
// treatment run did not answer as its task expects, or the treatment cost no less than its control · 2 could not
// run.

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { CACHE_LIFETIMES, sessionsDeclaration } from "./compile.mjs";
import { ESTIMATED_BYTES_PER_TOKEN, measure, tokensOf } from "./context.mjs";
import { DEFAULT_LIFETIME, GENERAL_READ, WRITE_BY_LIFETIME, contextOf, hostPaths, projectKey, readTranscript } from "./ledger.mjs";

export class CouldNotRun extends Error {
    constructor(message) {
        super(message);
        this.name = "CouldNotRun";
    }
}

/** Output against uncached input, the general figure `0038` prices by. */
export const OUTPUT = 5;

/** The multipliers C prices by unless `--read` and `--output` name the model's own. */
export const GENERAL_RATES = { read: GENERAL_READ, output: OUTPUT };

/**
 * Code, which A never counts: the five-run set's rule. The tree a run starts is the plugin itself, so every other
 * tracked file is Portulan's: its boot set, doctrine and skills, the workspace's context, records and memory.
 * `.claude/rules/` is the one exception to that rule's `.claude/`: the set's tree held only the settings there, and
 * since #452 the folder holds the compiled boot card and rule files, which are Portulan's guidance and so A.
 */
export const isCode = (rel) =>
    !rel.startsWith(".claude/rules/") &&
    (/^(?:cli|\.github|\.claude)\//.test(rel) || /\.(?:mjs|js|cjs|sh|yml|yaml)$/.test(rel) || rel === "package.json" || rel === "package-lock.json");

/** A line shorter than this matches too many files to say whose it is, so it takes the verdict of the line before. */
export const MIN_LINE = 16;

/** A negation just before a word: `not green`, `do not propose`, `isn't really green`. */
const NEGATED = String.raw`\b(?:not|never|no|cannot|\w+n['’]t)\s+(?:\w+\s+)?`;

/** An answer that says `word`, and says it without a negation just before it. */
const says = (answer, word) => new RegExp(String.raw`\b${word}\b`, "i").test(answer) && !new RegExp(String.raw`${NEGATED}${word}\b`, "i").test(answer);

/**
 * The tasks a sequence can run. `boot` is the boot task of the five-run set of 2026-09-24, word for word, so a
 * figure here stands beside that set's; `probe` is one request with no tool, which measures the prefix alone.
 * `expect` is what an answer must say to count as answered: for `boot`, the tier the gate map gives the change
 * and the recipes the definition of done runs first, neither negated; for `probe`, the one word and nothing
 * else. It reads words, not meaning: a guard against a cheaper arm that answers worse, not a grade.
 */
export const TASKS = {
    boot: {
        prompt:
            "Boot Portulan first: run its portulan skill and follow its steps. Then answer in at most five sentences: " +
            "in this workspace's gate map, which tier does changing a verify recipe get, and what does the definition " +
            "of done require before such a change counts as done? Change no file.",
        expect: (answer) => says(answer, "propose") && says(answer, "green"),
        args: (tree) => ["--plugin-dir", tree, "--max-turns", "150"],
    },
    probe: {
        prompt: "Reply with the single word: ok",
        expect: (answer) => /^\W*ok\W*$/i.test(answer),
        args: () => ["--max-turns", "1"],
    },
};

/** Every run's invocation: headless, no MCP server, no subagent, no web, no push. */
export const INVOCATION = [
    "--output-format", "json",
    "--strict-mcp-config",
    "--permission-mode", "acceptEdits",
    "--allowedTools", "Bash",
    "--disallowedTools", "Agent", "WebFetch", "WebSearch", "Bash(git push:*)",
];

/** The flag that moves the per-machine sections into the first message; no setting carries it. */
export const EXCLUDE_FLAG = "--exclude-dynamic-system-prompt-sections";

/**
 * What a parent session sets for its own conversation: its ids and channels, its effort and compaction, the
 * directories and memory it adds, its background tasks, and the tokens it acts with, as measured in a hosted
 * session.
 */
export const PARENT_VARS = [
    "CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_REMOTE_SESSION_ID", "CLAUDE_CODE_CHILD_SESSION",
    "CLAUDE_CODE_MESSAGING_SOCKET", "CLAUDE_CODE_MESSAGING_TOKEN", "CLAUDE_CODE_TEE_SDK_STDOUT",
    "CLAUDE_CODE_POST_FOR_SESSION_INGRESS_V2", "CLAUDE_CODE_SYNC_SESSION_REFS", "CLAUDE_EFFORT", "MAX_THINKING_TOKENS",
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE", "CLAUDE_CODE_AUTO_COMPACT_WINDOW", "CLAUDE_AFTER_LAST_COMPACT",
    "CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD", "CLAUDE_ADDITIONAL_DIRECTORIES", "CLAUDE_MEMORY_STORES",
    "CLAUDE_COWORK_MEMORY_PATH_OVERRIDE", "CLAUDE_CODE_COORDINATOR_EXTRA_TOOLS", "CLAUDE_CODE_TERMINAL_MCP_TOOLS",
    "CLAUDE_CODE_SKILL_PROPOSALS", "CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION", "CLAUDE_CODE_ENABLE_REMOTE_RECAP",
    "CLAUDE_CODE_SYNC_PLUGINS", "CLAUDE_CODE_SYNC_SKILLS", "CLAUDE_AUTO_BACKGROUND_TASKS",
    "CLAUDE_CODE_BG_TASKS_REPORT_RUNNING", "CLAUDE_CODE_DEBUG", "CLAUDE_CODE_INCLUDE_PARTIAL_MESSAGES",
    "CLAUDE_CODE_DIAGNOSTICS_FILE", "CLAUDE_CODE_SESSION_ATTENDED", "GH_TOKEN", "GITHUB_TOKEN",
];

/** The host's own switch variables, each outranking its setting (read in Claude Code 2.1.281's program text). */
export const SWITCH_VARS = ["CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS", "CLAUDE_CODE_PROMPT_CACHE_TTL", "FORCE_PROMPT_CACHING_5M", "ENABLE_PROMPT_CACHING_1H"];

/** Set in a hosted session, where the host takes no startup git snapshot; `--local` starts the child without it. */
export const HOSTED_VAR = "CLAUDE_CODE_REMOTE";

const TURN_TIMEOUT_MS = 45 * 60 * 1000;

/** The child's environment: the parent's, less its conversation and the host's switches, plus the arm's. */
export function childEnv(parent, arm = {}, { local = false } = {}) {
    const env = { ...parent };
    for (const name of [...PARENT_VARS, ...SWITCH_VARS]) delete env[name];
    if (local) delete env[HOSTED_VAR];
    if (arm.git_instructions !== undefined) env.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS = arm.git_instructions ? "0" : "1";
    if (arm.cache_lifetime !== undefined) env.CLAUDE_CODE_PROMPT_CACHE_TTL = arm.cache_lifetime;
    return env;
}

/** The child's arguments: the task's prompt, the invocation, the task's own, and the arm's flag. */
export function childArgs(task, tree, arm = {}, { model = null } = {}) {
    const spec = TASKS[task];
    if (spec === undefined) throw new CouldNotRun(`no task \`${task}\`; the tasks are ${Object.keys(TASKS).join(", ")}`);
    return [
        "-p", spec.prompt,
        ...INVOCATION,
        ...spec.args(tree),
        ...(arm.exclude_dynamic_sections === true ? [EXCLUDE_FLAG] : []),
        ...(model ? ["--model", model] : []),
    ];
}

const writeMultiplier = (lifetime) => WRITE_BY_LIFETIME[lifetime] ?? WRITE_BY_LIFETIME[DEFAULT_LIFETIME];

/**
 * One run's figures from its transcript's requests. The lifetime is the one most of its writes used, else the
 * arm's, else the ledger's default. A run started warm when its first request read more than it wrote. `tokens`
 * is B, every token the host recorded; `billed` and `cold` are C's figures at `rates`.
 */
export function priced(requests, fallbackLifetime = DEFAULT_LIFETIME, rates = GENERAL_RATES) {
    const main = requests.filter((r) => !r.sidechain);
    const sum = (key) => main.reduce((n, r) => n + r[key], 0);
    const [w1h, w5m, unknown] = [sum("written1h"), sum("written5m"), sum("writtenUnknown")];
    const lifetime = w1h === 0 && w5m === 0 ? fallbackLifetime : w1h >= w5m ? "1h" : "5m";
    const billed =
        sum("uncached") +
        w1h * WRITE_BY_LIFETIME["1h"] +
        w5m * WRITE_BY_LIFETIME["5m"] +
        unknown * writeMultiplier(lifetime) +
        sum("read") * rates.read +
        sum("output") * rates.output;
    const first = main[0] ?? null;
    const firstWritten = first === null ? 0 : first.written1h + first.written5m + first.writtenUnknown;
    return {
        requests: main.length,
        lifetime,
        uncached: sum("uncached"),
        written: w1h + w5m + unknown,
        read: sum("read"),
        output: sum("output"),
        tokens: sum("uncached") + w1h + w5m + unknown + sum("read") + sum("output"),
        first: first === null ? null : { context: contextOf(first), read: first.read, written: firstWritten },
        startedWarm: first !== null && first.read > firstWritten,
        billed: Math.round(billed),
        cold: Math.round(billed + (first?.read ?? 0) * (writeMultiplier(lifetime) - rates.read)),
    };
}

// ===========================================================================================
// A: what Portulan installs or manages, found in what entered each run's context
// ===========================================================================================

const READ_PREFIX = /^\s*\d+(?:\t|→)/;
const GREP_PREFIX = /^[\w./-]+\.\w+[:-]\d+[:-]/;
const LINENO_PREFIX = /^\d+[:-]/;

/** A line as it may have been printed, and as a file holds it: without a line number or a path in front. */
function readings(raw) {
    const out = [raw.trim()];
    for (const prefix of [READ_PREFIX, GREP_PREFIX, LINENO_PREFIX]) if (prefix.test(raw)) out.push(raw.replace(prefix, "").trim());
    return out;
}

/**
 * The bytes of `text` that are Portulan's: each line whose text is a line of Portulan's files, and each shorter
 * line after one (a blank, a fence, a table's rule), since a short line cannot say whose it is. A line code holds
 * too is the code's when the tool call named a code file, as a named file wins in the five-run set's split.
 */
export function portulanBytes(text, lines, { code = new Set(), namedCode = false } = {}) {
    const all = String(text);
    let bytes = 0;
    let current = false;
    for (const raw of all.split("\n")) {
        const long = readings(raw).filter((t) => t.length >= MIN_LINE);
        if (long.length > 0) current = long.some((t) => lines.has(t) && !(namedCode && code.has(t)));
        if (current) bytes += Buffer.byteLength(raw, "utf8") + 1;
    }
    return Math.min(bytes, Buffer.byteLength(all, "utf8"));
}

/**
 * What A counts in a tree: the lines of every tracked file that is not code, the lines of the code (for a tool
 * call that named a code file), and the bytes of Portulan's that the host loads before the first request, the
 * plugin's skill and agent descriptions and the always tier's lines of Portulan's files, as `context` measures
 * them. A tree whose workspace `context` cannot measure loads nothing of Portulan's before the first request.
 */
export function portulanSources(tree) {
    const tracked = git(tree, ["ls-files", "-z"]).split("\0").filter(Boolean);
    const lines = new Set();
    const code = new Set();
    let files = 0;
    for (const rel of tracked) {
        let text;
        try {
            if (fs.statSync(path.join(tree, rel)).size > 3_000_000) continue;
            text = fs.readFileSync(path.join(tree, rel), "utf8");
        } catch {
            continue;
        }
        const into = isCode(rel) ? code : lines;
        if (!isCode(rel)) files += 1;
        for (const line of text.split("\n")) if (line.trim().length >= MIN_LINE) into.add(line.trim());
    }
    let measured = null;
    try {
        measured = measure(path.join(tree, ".portulan"), { bundleRoot: tree });
    } catch {
        measured = null;
    }
    let before = measured?.figures.descriptions ?? 0;
    for (const e of measured?.always?.entries ?? []) {
        let text = "";
        try {
            text = fs.readFileSync(e.file, "utf8");
        } catch {
            text = "";
        }
        before += Math.min(e.bytes, portulanBytes(text, lines));
    }
    return { lines, code, codePaths: tracked.filter(isCode), files, before };
}

/** A path a tool call's input names, the five-run set's way: a token ending in a file extension. */
const PATH_TOKEN = /[\w./-]*[\w-]+\.(?:md|mjs|json|sh|js|yml|yaml|txt)\b/g;

/** Whether a tool call's input names a tracked code file. */
function namesCode(input, codePaths) {
    const text = Object.values(input ?? {}).map((v) => String(v)).join(" ");
    const tokens = (text.match(PATH_TOKEN) ?? []).map((t) => (t.startsWith(".portulan") ? t : t.replace(/^[./]+/, "")));
    // An absolute path in the run's clone ends with the tracked path; a bare name is the end of one.
    return tokens.some((t) => codePaths.some((f) => f === t || t.endsWith(`/${f}`) || f.endsWith(`/${t}`) || (t.length > 6 && f.endsWith(t))));
}

/** A tool's result as the context holds it. */
function resultText(b) {
    if (typeof b.content === "string") return b.content;
    return Array.isArray(b.content) ? b.content.map((c) => (c?.type === "text" ? c.text : JSON.stringify(c))).join("\n") : JSON.stringify(b.content ?? null);
}

/** A model's block, in bytes, as the next request sends it back. */
function blockBytes(b) {
    if (b?.type === "text") return Buffer.byteLength(String(b.text ?? ""), "utf8");
    if (b?.type === "thinking") return Buffer.byteLength(String(b.thinking ?? ""), "utf8") || 1;
    if (b?.type === "tool_use") return Buffer.byteLength(JSON.stringify(b.input ?? {}), "utf8");
    return Buffer.byteLength(JSON.stringify(b ?? null), "utf8");
}

/**
 * A for one run, the five-run set's split. The transcript is walked in the ledger's order (one request per
 * message id, the main chain only) for what entered the context before each request, in bytes and in Portulan's
 * bytes: a tool's result and the skill text the host injects are matched line by line; a prompt, a hook's or the
 * host's attachment and the model's own blocks enter as bytes only. Each request's growth is shared by bytes over
 * what entered before it and carried by every request from there on. Request 1 is not split: what the host loaded
 * of Portulan's before it is estimated from its bytes and carried by all. Null where the walk and the ledger do
 * not name the same requests, or where the run compacted, since a compacted context sends a summary in place of
 * what entered it.
 */
export function shareOf(file, requests, sources) {
    const main = requests.filter((r) => !r.sidechain);
    if (main.length === 0 || main.some((r) => r.compacted)) return null;
    const entering = [{ bytes: 0, portulan: 0 }];
    const ids = new Map();
    const codeCalls = new Set();
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        let record;
        try {
            record = JSON.parse(line);
        } catch {
            continue;
        }
        if (record === null || typeof record !== "object" || record.isSidechain === true) continue;
        const message = record.message;
        if (record.type === "assistant" && message?.usage && message.model !== "<synthetic>") {
            const id = message.id ?? record.requestId ?? record.uuid;
            if (!ids.has(id)) {
                ids.set(id, ids.size);
                entering.push({ bytes: 0, portulan: 0 });
            }
            // The model's own blocks enter the next request, and are never Portulan's.
            for (const b of Array.isArray(message.content) ? message.content : []) {
                entering[entering.length - 1].bytes += blockBytes(b);
                if (b?.type === "tool_use" && namesCode(b.input, sources.codePaths)) codeCalls.add(b.id);
            }
            continue;
        }
        const slot = entering[entering.length - 1];
        if (record.type === "user") {
            const content = message?.content;
            if (typeof content === "string") {
                slot.bytes += Buffer.byteLength(content, "utf8");
                continue;
            }
            for (const b of Array.isArray(content) ? content : []) {
                const loaded = b?.type === "tool_result" ? resultText(b) : b?.type === "text" && record.isMeta === true ? String(b.text ?? "") : null;
                const text = loaded ?? (b?.type === "text" ? String(b.text ?? "") : JSON.stringify(b));
                slot.bytes += Buffer.byteLength(text, "utf8");
                if (loaded !== null) {
                    slot.portulan += portulanBytes(loaded, sources.lines, { code: sources.code, namedCode: codeCalls.has(b.tool_use_id) });
                }
            }
        } else if (record.type === "attachment" && record.attachment?.type !== "prompt_snapshot") {
            slot.bytes += Buffer.byteLength(JSON.stringify(record.attachment ?? null), "utf8");
        }
    }
    if (ids.size !== main.length || main.some((r, i) => ids.get(r.id) !== i)) return null;
    const n = main.length;
    const before = tokensOf(sources.before, ESTIMATED_BYTES_PER_TOKEN);
    let carried = before * n;
    for (let i = 1; i < n; i += 1) {
        const growth = Math.max(0, contextOf(main[i]) - contextOf(main[i - 1]));
        const e = entering[i];
        if (e.bytes > 0) carried += ((growth * Math.min(e.portulan, e.bytes)) / e.bytes) * (n - i);
    }
    return { tokens: Math.round(carried), estimated: before * n };
}

const mean = (xs) => (xs.length === 0 ? null : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length));

/**
 * A sequence in its three lines and the figures behind C: A and B as means of a run, its first run, its warm and
 * cold means, and what share of cold warm cost. `cost` is what a comparison weighs: the mean of every run as
 * billed, except the first, priced cold, since whatever the cache held before a sequence began is not its arm's.
 */
export function summary(runs) {
    const measured = runs.filter((r) => r.figures !== null);
    const later = measured.filter((r) => r.k > 1);
    const shared = measured.filter((r) => r.share !== null && r.share !== undefined);
    const warm = mean(later.map((r) => r.figures.billed));
    const cold = mean(measured.map((r) => r.figures.cold));
    return {
        runs: runs.length,
        measured: measured.length,
        graded: runs.filter((r) => r.graded).length,
        changed: runs.filter((r) => r.changed === true).length,
        startedWarm: later.filter((r) => r.figures.startedWarm).length,
        later: later.length,
        a: shared.length === measured.length ? mean(shared.map((r) => r.share.tokens)) : null,
        estimated: shared.length === measured.length ? mean(shared.map((r) => r.share.estimated)) : null,
        b: mean(measured.map((r) => r.figures.tokens)),
        first: measured.find((r) => r.k === 1)?.figures.billed ?? null,
        warm,
        cold,
        billed: mean(measured.map((r) => r.figures.billed)),
        cost: mean(measured.map((r) => (r.k === 1 ? r.figures.cold : r.figures.billed))),
        share: warm !== null && cold ? warm / cold : null,
    };
}

/**
 * A switch against its control: it passes when every run of both sequences was measured, every treatment run
 * answered as its task expects, no run of either changed a file, and the treatment's cost, the mean of its runs
 * with the first priced cold, is lower than the control's. A run that was not measured has no cost, so a mean
 * without it is not its sequence's; a control run that changed a file spent tokens on work its task forbids, so a
 * cut against it is not the switch's; and what the cache held before either sequence began is neither arm's. The
 * two must differ in their arm and in nothing else the runner records (the commit they started from, the task,
 * the run count, the checkouts, what lands between runs, where they ran, the model asked for and the models the
 * host recorded, and the host's version), or no difference between them is the switch's. The models are compared
 * run by run, for the runs both sequences measured: a run with no measurement recorded no model, so its sequence
 * fails as not measured, never as another shape, while a measured run that recorded no model still differs from
 * one that did.
 */
export function verdict(control, treatment) {
    const measuredRun = (s, k) => s.runs.find((r) => r.k === k && r.figures !== null);
    const both = control.runs.map((r) => r.k).filter((k) => measuredRun(control, k) && measuredRun(treatment, k));
    const recorded = (s) => both.map((k) => `run ${k} ${[...(measuredRun(s, k).models ?? [])].sort().join(" and ") || "none"}`).join(", ");
    const shape = (s) =>
        `${s.record.task} × ${s.record.runs.length} from ${s.record.source ?? "an unrecorded commit"}, copies ${s.record.copies}, ` +
        `between ${s.record.between ?? "nothing"}${s.record.local ? ", local" : ""}, model ${s.record.model ?? "the host's default"}` +
        `${both.length ? ` (recorded ${recorded(s)})` : ""}, host ${s.record.agent ?? "unknown"}`;
    if (shape(control) !== shape(treatment)) {
        throw new CouldNotRun(`the two sequences differ in shape (${shape(control)} against ${shape(treatment)}), so no difference between them is the switch's`);
    }
    const arm = (s) => JSON.stringify(Object.entries(s.record.arm ?? {}).sort(([x], [y]) => x.localeCompare(y)));
    if (arm(control) === arm(treatment)) throw new CouldNotRun(`the two sequences start the same arm, ${arm(control)}, so no switch lies between them`);
    const [a, b] = [control.summary, treatment.summary];
    const measured = a.measured === a.runs && b.measured === b.runs;
    const cuts = measured && a.cost !== null && b.cost !== null && b.cost < a.cost;
    const answered = b.graded === b.runs;
    const unchanged = a.changed === 0 && b.changed === 0;
    return {
        measured, cuts, answered, unchanged,
        pass: cuts && answered && unchanged,
        ratio: measured && a.cost && b.cost !== null ? b.cost / a.cost : null,
    };
}

function git(cwd, args) {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * Where a clone keeps what the runner put in it, the tree's commit and the runner's own commits between runs,
 * as already on a remote. The clone has no remote, so nothing a run does can be pushed; but the stop gate reads a
 * commit on no remote as work not yet recorded (`HEAD --not --remotes`, `cli/stop-gate.mjs`) and would ask every
 * run for a handoff, a file its task says not to change. A commit a run makes itself is never recorded here.
 */
export const RECORDED_REF = "refs/remotes/source/recorded";

/** The runner's commit between two runs: empty, with the seam line the docs recipe reads on the newest change. */
const BETWEEN_SEAM = "Seam-scan: clean, an empty commit whose message is the runner's own";

/** A clone of the tree's committed HEAD with no remote: what every run of a sequence starts from. */
export function cloneTree(tree, dest) {
    try {
        execFileSync("git", ["clone", "--quiet", "--no-hardlinks", tree, dest], { stdio: ["ignore", "pipe", "pipe"] });
        git(dest, ["remote", "remove", "origin"]);
        git(dest, ["update-ref", RECORDED_REF, "HEAD"]);
    } catch (cause) {
        throw new CouldNotRun(`could not clone ${tree} into ${dest}: ${String(cause.stderr ?? cause.message).trim().split("\n")[0]}`);
    }
    return dest;
}

/**
 * Where the host keeps the transcript of a session started in `cwd`, or null where it is not there. Keyed by
 * the real path, because that is the working directory a started process sees.
 */
export function transcriptOf(sessionId, cwd, env) {
    const paths = hostPaths(env);
    if (paths.why) throw new CouldNotRun(paths.why);
    const file = path.join(paths.projects, projectKey(fs.realpathSync(cwd)), `${sessionId}.jsonl`);
    return fs.existsSync(file) ? file : null;
}

/** The first line the agent printed on stdout that parses as its JSON result, or null. */
function resultOf(stdout) {
    for (const line of [stdout.trim(), ...stdout.trim().split("\n").reverse()]) {
        try {
            const value = JSON.parse(line);
            if (value !== null && typeof value === "object" && typeof value.session_id === "string") return value;
        } catch {
            // Not the result line.
        }
    }
    return null;
}

/** The arm a run starts with: the switches named on the command line, or a workspace's `sessions.headless`. */
export function armOf({ declared = null, switches = {} }) {
    if (declared === null) return { ...switches };
    if (Object.keys(switches).length > 0) throw new CouldNotRun("name the switches or --declared, not both: an arm is one or the other");
    const sessions = sessionsDeclaration(path.dirname(path.resolve(declared)), path.basename(path.resolve(declared)));
    if (sessions === null) throw new CouldNotRun(`${declared} declares no \`sessions\`, so --declared has no arm to start`);
    return { ...(sessions.headless ?? {}) };
}

/**
 * Run one sequence and record it in `<into>/<label>/sequence.json`, rewritten after every run so a crash
 * loses one run and not the sequence. Each run's transcript is copied beside it.
 */
export function runSequence({
    tree, into, label, task = "boot", runs = 3, copies = "one", between = null, arm = {}, local = false,
    model = null, agent = "claude", env = process.env, timeoutMs = TURN_TIMEOUT_MS, say = () => {},
}) {
    childArgs(task, tree, arm);
    if (between === "commit" && copies === "each") {
        throw new CouldNotRun("--between commit needs one checkout: under --copies each every run starts from a new clone of the tree, so the commit never reaches the next run");
    }
    if (between === "commit" && !local) {
        throw new CouldNotRun("--between commit needs --local: a commit between runs moves only the startup git snapshot, which a hosted session never takes");
    }
    let source;
    try {
        source = git(tree, ["rev-parse", "--verify", "HEAD^{commit}"]).trim();
    } catch (cause) {
        throw new CouldNotRun(`${tree} has no commit to clone: ${String(cause.stderr ?? cause.message).trim().split("\n")[0]}`);
    }
    const dir = path.join(into, label);
    if (fs.existsSync(dir)) throw new CouldNotRun(`${dir} exists; a sequence is recorded once, into a directory of its own`);
    fs.mkdirSync(dir, { recursive: true });
    const version = spawnSync(agent, ["--version"], { encoding: "utf8", env, timeout: 60_000 });
    const record = {
        label, task, source, copies, between, arm, local, model,
        agent: (version.stdout ?? "").trim().split("\n")[0] || null,
        started: new Date().toISOString(),
        runs: [],
    };
    const journal = () => fs.writeFileSync(path.join(dir, "sequence.json"), `${JSON.stringify(record, null, 2)}\n`);
    let copy = null;
    let start = null;
    for (let k = 1; k <= runs; k += 1) {
        if (copy === null || copies === "each") {
            copy = cloneTree(tree, path.join(dir, copies === "each" ? `tree-${k}` : "tree"));
            start = git(copy, ["rev-parse", "HEAD"]).trim();
        }
        const started = Date.now();
        const r = spawnSync(agent, childArgs(task, copy, arm, { model }), {
            cwd: copy,
            env: childEnv(env, arm, { local }),
            encoding: "utf8",
            timeout: timeoutMs,
            maxBuffer: 64 * 1024 * 1024,
            // Closed, so a prompt the run cannot answer fails at once rather than waiting out the timeout.
            stdio: ["ignore", "pipe", "pipe"],
        });
        if (r.error && r.error.code !== "ETIMEDOUT") throw new CouldNotRun(`\`${agent}\` could not be started: ${r.error.code ?? r.error.message}`);
        const result = resultOf(r.stdout ?? "");
        const answer = typeof result?.result === "string" ? result.result : "";
        const answered = r.status === 0 && result?.subtype === "success" && result?.is_error !== true && answer.trim() !== "";
        let transcript = null;
        const found = result === null ? null : transcriptOf(result.session_id, copy, env);
        if (found !== null) {
            transcript = `run-${k}.jsonl`;
            fs.copyFileSync(found, path.join(dir, transcript));
        }
        // A run leaves its clone as it found it: the boot task says to change no file, and the probe's one reply
        // needs none. A run that changed its clone, a file or a commit, fails its task, and once it is recorded the
        // clone goes back to the commit the run started from, so the next run starts where the others did. Ignored
        // files count: a clone starts with none, and one a run leaves (a local settings file) is input to the next.
        const touched = git(copy, ["status", "--porcelain", "--ignored", "--untracked-files=all"]).split("\n").filter(Boolean);
        const changed = git(copy, ["rev-parse", "HEAD"]).trim() !== start || touched.length > 0;
        record.runs.push({
            k,
            exit: r.status,
            timedOut: r.error?.code === "ETIMEDOUT",
            wallMs: Date.now() - started,
            session: result?.session_id ?? null,
            turns: result?.num_turns ?? null,
            answered,
            graded: answered && !changed && TASKS[task].expect(answer),
            answer,
            changed,
            ...(touched.length ? { touched: touched.slice(0, 20).map((l) => l.slice(3)) } : {}),
            transcript,
        });
        journal();
        if (changed) {
            git(copy, ["reset", "--quiet", "--hard", start]);
            git(copy, ["clean", "--quiet", "-d", "-x", "--force"]);
        }
        say(`${label} run ${k}/${runs}: exit ${r.status}${changed ? ", changed its clone, put back" : ""}${transcript ? "" : ", no transcript found"}`);
        if (between === "commit" && k < runs) {
            git(copy, [
                "-c", "user.name=warm", "-c", "user.email=warm@example.invalid", "commit", "--quiet", "--allow-empty",
                "-m", `warm: between runs ${k} and ${k + 1}`, "-m", BETWEEN_SEAM,
            ]);
            git(copy, ["update-ref", RECORDED_REF, "HEAD"]);
            start = git(copy, ["rev-parse", "HEAD"]).trim();
        }
    }
    record.ended = new Date().toISOString();
    journal();
    return record;
}

/**
 * A recorded sequence, read into its three lines at `rates`. A is read against the run's own clone, which the
 * sequence keeps; a run whose clone is gone has no A, and says so rather than a zero. A run whose transcript
 * records no request of its session's own (empty, torn before its first request, or holding only host-written
 * or subagent records) measured nothing: it has no figures, as a run with no transcript has none, never the
 * figures of a run that cost nothing.
 */
export function readSequence(dir, rates = GENERAL_RATES) {
    let record;
    try {
        record = JSON.parse(fs.readFileSync(path.join(dir, "sequence.json"), "utf8"));
    } catch (cause) {
        throw new CouldNotRun(`${dir} holds no readable sequence.json: ${cause.code ?? cause.message}`);
    }
    const sources = new Map();
    const sourcesOf = (clone) => {
        if (!sources.has(clone)) sources.set(clone, fs.existsSync(path.join(clone, ".git")) ? portulanSources(clone) : null);
        return sources.get(clone);
    };
    const runs = record.runs.map((r) => {
        if (r.transcript === null) return { ...r, figures: null, share: null };
        const transcript = path.join(dir, r.transcript);
        const { requests } = readTranscript(transcript);
        if (!requests.some((q) => !q.sidechain)) return { ...r, figures: null, share: null };
        const found = sourcesOf(path.join(dir, record.copies === "each" ? `tree-${r.k}` : "tree"));
        return {
            ...r,
            models: [...new Set(requests.filter((q) => !q.sidechain && q.model !== null).map((q) => q.model))],
            figures: priced(requests, record.arm?.cache_lifetime ?? DEFAULT_LIFETIME, rates),
            share: found === null ? null : shareOf(transcript, requests, found),
        };
    });
    return { record, runs, rates, summary: summary(runs) };
}

const grouped = (n) => (n === null ? "—" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","));

const index = (x, base) => (x === null || !base ? "—" : String(Math.round((x / base) * 100)));

const ratesText = (rates) =>
    `reads at ${rates.read} and output at ${rates.output}` +
    (rates.read === GENERAL_RATES.read && rates.output === GENERAL_RATES.output ? ", the general multipliers" : "");

/** The lines `report` prints for one sequence: its runs, then its three lines, A first. */
export function reportLines(sequence) {
    const { record, runs, rates = GENERAL_RATES, summary: s } = sequence;
    const arm = Object.keys(record.arm ?? {}).length ? JSON.stringify(record.arm) : "the host's defaults";
    const lines = [
        `${record.label}: ${record.task}, ${record.runs.length} run(s), ${record.copies === "each" ? "a checkout each" : "one checkout"}` +
            `${record.between ? `, ${record.between} between runs` : ""}${record.local ? ", local" : ""}; arm ${arm}`,
        "  run  requests  first read / context  A          B           written   read        output  billed   cold     answered",
    ];
    for (const r of runs) {
        const f = r.figures;
        lines.push(
            `  ${String(r.k).padEnd(4)} ${String(f?.requests ?? "—").padEnd(9)} ${`${grouped(f?.first?.read ?? null)} / ${grouped(f?.first?.context ?? null)}`.padEnd(21)} ` +
                `${grouped(r.share?.tokens ?? null).padEnd(10)} ${grouped(f?.tokens ?? null).padEnd(11)} ` +
                `${grouped(f?.written ?? null).padEnd(9)} ${grouped(f?.read ?? null).padEnd(11)} ${grouped(f?.output ?? null).padEnd(7)} ` +
                `${grouped(f?.billed ?? null).padEnd(8)} ${grouped(f?.cold ?? null).padEnd(8)} ${r.graded ? "yes" : r.changed ? "changed a file" : r.answered ? "off-task" : "no"}`,
        );
    }
    lines.push(
        s.a === null
            ? `  A  Portulan's share: no figure, since ${s.measured === 0 ? "no run was measured" : "a run's clone is gone or a run compacted"}`
            : `  A  Portulan's share: ${grouped(s.a)} tokens a run, ${index(s.a, s.b)}% of B; ${grouped(s.estimated)} of them estimated, what the host loaded before the first request`,
        `  B  the whole task: ${grouped(s.b)} tokens a run, cache reads included`,
        `  C  cost: warm ${index(s.warm, s.cold)} against cold 100 (${grouped(s.warm)} against ${grouped(s.cold)}, ${ratesText(rates)}); ` +
            `started warm ${s.startedWarm} of ${s.later}; measured ${s.measured} of ${s.runs}; answered ${s.graded} of ${s.runs}; changed a file ${s.changed}`,
    );
    return lines;
}

/** A treatment against its control, in the same three lines, A first; C decides. */
export function comparisonLines(control, treatment, v) {
    const [c, t] = [control.summary, treatment.summary];
    const facts = [
        v.measured ? "every run measured" : "a run was not measured",
        v.answered ? "every run answered" : "not every run answered",
        v.unchanged ? "no run of either changed a file" : "a run changed a file",
    ];
    return [
        `${treatment.record.label} against ${control.record.label}:`,
        `  A  Portulan's share: ${grouped(t.a)} against ${grouped(c.a)} tokens a run`,
        `  B  the whole task: ${grouped(t.b)} against ${grouped(c.b)} tokens a run`,
        `  C  cost: ${v.ratio === null ? "no figure" : Math.round(v.ratio * 100)} against the control's 100, the mean of all runs with the first priced cold; ` +
            `${facts.join(", ")}: ${v.pass ? "PASS" : "FAIL"}`,
    ];
}

/** `--read` and `--output` taken out of an argument list: the multipliers C prices by, and what is left. */
export function ratesOf(argv) {
    const rates = { ...GENERAL_RATES };
    const rest = [];
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === "--read" || argv[i] === "--output") {
            const v = Number(argv[i + 1]);
            if (i + 1 >= argv.length || !Number.isFinite(v) || v <= 0) throw new CouldNotRun(`${argv[i]} is a multiplier against uncached input, above 0`);
            rates[argv[i].slice(2)] = v;
            i += 1;
        } else rest.push(argv[i]);
    }
    return { rates, rest };
}

const USAGE = `portulan-warm — fresh sessions in sequence, reported in three lines from the host's own records:
A Portulan's share, B the whole task, C the cost against the before at 100.
  node cli/warm.mjs run --tree <dir> --into <dir> --label <name> [--task ${Object.keys(TASKS).join("|")}] [--runs <n>]
      [--copies one|each] [--between commit] [--declared <workspace dir>] [--git-instructions on|off]
      [--cache-lifetime ${CACHE_LIFETIMES.join("|")}] [--exclude-dynamic-sections] [--local] [--model <id>] [--agent <command>]
      [--read <multiplier>] [--output <multiplier>]
  node cli/warm.mjs report <sequence dir> [<treatment sequence dir>] [--read <multiplier>] [--output <multiplier>]
It starts real sessions and never runs inside a verify recipe. See evals/ab/warm.md.`;

function parseRun(argv) {
    const o = { switches: {}, declared: null, task: "boot", runs: 3, copies: "one", between: null, local: false, model: null, agent: "claude" };
    const value = (i, flag) => {
        if (i + 1 >= argv.length) throw new CouldNotRun(`${flag} needs a value`);
        return argv[i + 1];
    };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === "--tree" || a === "--into" || a === "--label" || a === "--task" || a === "--model" || a === "--agent" || a === "--declared") {
            o[a.slice(2)] = value(i, a);
            i += 1;
        } else if (a === "--runs") {
            o.runs = Number(value(i, a));
            if (!Number.isInteger(o.runs) || o.runs < 2) throw new CouldNotRun("--runs is a whole number of at least 2: one cold run and one that can start warm");
            i += 1;
        } else if (a === "--copies") {
            o.copies = value(i, a);
            if (!["one", "each"].includes(o.copies)) throw new CouldNotRun("--copies is one or each");
            i += 1;
        } else if (a === "--between") {
            o.between = value(i, a);
            if (o.between !== "commit") throw new CouldNotRun("--between takes commit");
            i += 1;
        } else if (a === "--git-instructions") {
            const v = value(i, a);
            if (!["on", "off"].includes(v)) throw new CouldNotRun("--git-instructions is on or off");
            o.switches.git_instructions = v === "on";
            i += 1;
        } else if (a === "--cache-lifetime") {
            const v = value(i, a);
            if (!CACHE_LIFETIMES.includes(v)) throw new CouldNotRun(`--cache-lifetime is ${CACHE_LIFETIMES.join(" or ")}`);
            o.switches.cache_lifetime = v;
            i += 1;
        } else if (a === "--exclude-dynamic-sections") o.switches.exclude_dynamic_sections = true;
        else if (a === "--local") o.local = true;
        else throw new CouldNotRun(`unknown argument ${JSON.stringify(a)}`);
    }
    for (const need of ["tree", "into", "label"]) if (!o[need]) throw new CouldNotRun(`--${need} is required`);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(o.label)) throw new CouldNotRun("--label is a lowercase slug: it names a directory");
    return o;
}

export function run(argv, { say = (line) => process.stdout.write(`${line}\n`), env = process.env } = {}) {
    try {
        const [mode, ...args] = argv;
        if (mode === "--help" || mode === "-h") {
            say(USAGE);
            return 0;
        }
        if (mode === "run") {
            const { rates, rest } = ratesOf(args);
            const o = parseRun(rest);
            const arm = armOf({ declared: o.declared, switches: o.switches });
            const record = runSequence({
                tree: path.resolve(o.tree), into: path.resolve(o.into), label: o.label, task: o.task, runs: o.runs,
                copies: o.copies, between: o.between, arm, local: o.local, model: o.model, agent: o.agent, env, say,
            });
            for (const line of reportLines(readSequence(path.join(path.resolve(o.into), record.label), rates))) say(line);
            return 0;
        }
        if (mode === "report") {
            const { rates, rest } = ratesOf(args);
            if (rest.length < 1 || rest.length > 2) throw new CouldNotRun("report takes one sequence directory, or a control and a treatment");
            const sequences = rest.map((dir) => readSequence(dir, rates));
            for (const s of sequences) for (const line of reportLines(s)) say(line);
            if (sequences.length === 1) return 0;
            const v = verdict(sequences[0], sequences[1]);
            for (const line of comparisonLines(sequences[0], sequences[1], v)) say(line);
            return v.pass ? 0 : 1;
        }
        throw new CouldNotRun(`the first argument is run or report\n${USAGE}`);
    } catch (e) {
        if (e instanceof CouldNotRun || e?.name === "CompileError" || e?.name === "LedgerError") {
            say(`could not run: ${e.message}`);
            return 2;
        }
        throw e;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = run(process.argv.slice(2));
}
