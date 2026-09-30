#!/usr/bin/env node
// The warm-start A/B: a fresh session's cost when an earlier one left its prefix in the prompt cache, against cold.
//
//   node cli/warm.mjs run --tree <dir> --into <dir> --label <name> [--task boot|probe] [--runs <n>]
//       [--copies one|each] [--between commit] [--declared <workspace dir>] [--git-instructions on|off]
//       [--cache-lifetime 5m|1h] [--exclude-dynamic-sections] [--local] [--model <id>] [--agent <command>]
//       [--read <multiplier>] [--output <multiplier>]
//   node cli/warm.mjs report <sequence dir> [<treatment sequence dir>] [--read <multiplier>] [--output <multiplier>]
//
// `../evals/ab/warm.md` is its specification and record, and defines the three lines A, B and C.
// It starts real sessions, which spend, so no verify recipe runs it.
//
// Exit 0 done · 1 `report` of two sequences whose treatment does not pass `verdict` · 2 could not run.

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

/** Output's price as a multiple of uncached input's. */
export const OUTPUT = 5;

export const GENERAL_RATES = { read: GENERAL_READ, output: OUTPUT };

/** Code, which A never counts; `.claude/rules/` holds compiled guidance, so A counts it. */
export const isCode = (rel) =>
    !rel.startsWith(".claude/rules/") &&
    (/^(?:cli|\.github|\.claude)\//.test(rel) || /\.(?:mjs|js|cjs|sh|yml|yaml)$/.test(rel) || rel === "package.json" || rel === "package-lock.json");

/** A line shorter than this matches too many files to say whose it is, so it takes the verdict of the line before. */
export const MIN_LINE = 16;

/** A negation just before a word: `not green`, `do not propose`, `isn't really green`. */
const NEGATED = String.raw`\b(?:not|never|no|cannot|\w+n['’]t)\s+(?:\w+\s+)?`;

const says = (answer, word) => new RegExp(String.raw`\b${word}\b`, "i").test(answer) && !new RegExp(String.raw`${NEGATED}${word}\b`, "i").test(answer);

/** `boot` is `../evals/ab/warm.md`'s boot task word for word, so its figures compare; `expect` reads words, not meaning. */
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

export const INVOCATION = [
    "--output-format", "json",
    "--strict-mcp-config",
    "--permission-mode", "acceptEdits",
    "--allowedTools", "Bash",
    "--disallowedTools", "Agent", "WebFetch", "WebSearch", "Bash(git push:*)",
];

/** The flag that moves the per-machine sections into the first message; no setting carries it. */
export const EXCLUDE_FLAG = "--exclude-dynamic-system-prompt-sections";

/** What a parent session sets for its own conversation, which a fresh session never starts with. */
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

export function childEnv(parent, arm = {}, { local = false } = {}) {
    const env = { ...parent };
    for (const name of [...PARENT_VARS, ...SWITCH_VARS]) delete env[name];
    if (local) delete env[HOSTED_VAR];
    if (arm.git_instructions !== undefined) env.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS = arm.git_instructions ? "0" : "1";
    if (arm.cache_lifetime !== undefined) env.CLAUDE_CODE_PROMPT_CACHE_TTL = arm.cache_lifetime;
    return env;
}

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

/** `tokens` is B, and `billed` and `cold` are C's two prices of the run. */
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

function readings(raw) {
    const out = [raw.trim()];
    for (const prefix of [READ_PREFIX, GREP_PREFIX, LINENO_PREFIX]) if (prefix.test(raw)) out.push(raw.replace(prefix, "").trim());
    return out;
}

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

/** `before` is the bytes of Portulan's the host loads ahead of the first request. */
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

const PATH_TOKEN = /[\w./-]*[\w-]+\.(?:md|mjs|json|sh|js|yml|yaml|txt)\b/g;

function namesCode(input, codePaths) {
    const text = Object.values(input ?? {}).map((v) => String(v)).join(" ");
    const tokens = (text.match(PATH_TOKEN) ?? []).map((t) => (t.startsWith(".portulan") ? t : t.replace(/^[./]+/, "")));
    // An absolute path in the run's clone ends with the tracked path; a bare name is the end of one.
    return tokens.some((t) => codePaths.some((f) => f === t || t.endsWith(`/${f}`) || f.endsWith(`/${t}`) || (t.length > 6 && f.endsWith(t))));
}

function resultText(b) {
    if (typeof b.content === "string") return b.content;
    return Array.isArray(b.content) ? b.content.map((c) => (c?.type === "text" ? c.text : JSON.stringify(c))).join("\n") : JSON.stringify(b.content ?? null);
}

function blockBytes(b) {
    if (b?.type === "text") return Buffer.byteLength(String(b.text ?? ""), "utf8");
    if (b?.type === "thinking") return Buffer.byteLength(String(b.thinking ?? ""), "utf8") || 1;
    if (b?.type === "tool_use") return Buffer.byteLength(JSON.stringify(b.input ?? {}), "utf8");
    return Buffer.byteLength(JSON.stringify(b ?? null), "utf8");
}

/** Null where the walk and the ledger name different requests, or where the run compacted. */
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

/** `cost` prices the first run cold: what the cache held before a sequence began is not its arm's. */
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

/** Throws unless the two sequences differ in their arm and in nothing else the runner records. */
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

/** Under `refs/remotes/`, so the Stop-gate reads the runner's commits as recorded and asks no run for a handoff. */
export const RECORDED_REF = "refs/remotes/source/recorded";

/** The docs recipe reads a seam line on the newest commit, so the runner's empty commit carries one. */
const BETWEEN_SEAM = "Seam-scan: clean, an empty commit whose message is the runner's own";

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

/** Null when the host holds no transcript; keyed by the real path, the cwd a started process sees. */
export function transcriptOf(sessionId, cwd, env) {
    const paths = hostPaths(env);
    if (paths.why) throw new CouldNotRun(paths.why);
    const file = path.join(paths.projects, projectKey(fs.realpathSync(cwd)), `${sessionId}.jsonl`);
    return fs.existsSync(file) ? file : null;
}

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

export function armOf({ declared = null, switches = {} }) {
    if (declared === null) return { ...switches };
    if (Object.keys(switches).length > 0) throw new CouldNotRun("name the switches or --declared, not both: an arm is one or the other");
    const sessions = sessionsDeclaration(path.dirname(path.resolve(declared)), path.basename(path.resolve(declared)));
    if (sessions === null) throw new CouldNotRun(`${declared} declares no \`sessions\`, so --declared has no arm to start`);
    return { ...(sessions.headless ?? {}) };
}

/** Rewrites `sequence.json` after every run, so a crash loses one run, not the sequence. */
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
        // Ignored files count: a clone starts with none, and one a run leaves is input to the next.
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
