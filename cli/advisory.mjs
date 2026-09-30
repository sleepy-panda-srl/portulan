#!/usr/bin/env node
// The restart advisory — one line, once, where the agent is, and the same figure for the human.
//
//   node cli/advisory.mjs tool [<figures>]      a PostToolUse hook: the line, as additionalContext, once, mid-stretch
//   node cli/advisory.mjs prompt [<figures>]    a UserPromptSubmit hook: the same line, at the next prompt, if not said yet
//   node cli/advisory.mjs status [<figures>]    a status-line command: the figure and the request count, on every refresh
//   node cli/advisory.mjs stop [<figures>]      a Stop hook, where a workspace declares it: the same line as a block, once
//
//   <figures>  --read <m> --write-5m <m> --write-1h <m>, all three or none, and --horizon <n>: a workspace's
//              `spend`, as `./compile.mjs` writes it; undeclared, the general multipliers and horizon.
//
// Exit 0 on every path: a 2 would erase the person's prompt at `UserPromptSubmit` and hold every turn's end at
// `Stop`. What it cannot read or use, it passes over and names on stderr.
//
// The line rides a tool result or a prompt: a non-blocking `Stop` hook's output never reaches the model, and a
// headless run's one prompt comes before any request. The transcript is written asynchronously, so the line may
// come one request late, never early.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { HORIZON, LedgerError, SPEND_FIGURES, figureOf, foldFigures, overflowingWrite, readLine, sessionFigures } from "./ledger.mjs";

const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const STATE_VERSION = 2;

const CHUNK = 1 << 16;

/** The bytes before the offset that recognise the transcript on the next call, kept only as a digest: they can be what the session said. */
const TAIL = 64;

export function compact(n) {
    if (n < 1000) return String(n);
    if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
    return `${(n / 1_000_000).toFixed(2)}M`;
}

function digest(value) {
    let h = 0;
    for (const ch of String(value)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h.toString(36);
}

function stem(sessionId) {
    return `portulan-advisory-${String(sessionId).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40)}-${digest(sessionId)}`;
}

export function toldFile(sessionId, compactions, dir = os.tmpdir()) {
    return path.join(dir, `${stem(sessionId)}-${compactions}`);
}

export function heldFile(sessionId, compactions, dir = os.tmpdir()) {
    return path.join(dir, `${stem(sessionId)}-${compactions}-held`);
}

export function stateFile(sessionId, dir = os.tmpdir()) {
    return path.join(dir, `${stem(sessionId)}.json`);
}

const isCount = (v) => Number.isSafeInteger(v) && v >= 0;
const isLifetime = (v) => v === null || v === "1h" || v === "5m";
const FIGURE_KEYS = Object.keys(sessionFigures()).sort().join();

function wellFormed(f) {
    return (
        f !== null &&
        typeof f === "object" &&
        Object.keys(f).sort().join() === FIGURE_KEYS &&
        isCount(f.compactions) &&
        typeof f.pending === "boolean" &&
        (f.fresh === null || isCount(f.fresh)) &&
        (f.last === null || isCount(f.last)) &&
        isCount(f.requests) &&
        isLifetime(f.freshLifetime) &&
        isLifetime(f.lifetime) &&
        Array.isArray(f.recent) &&
        f.recent.every((id) => typeof id === "string")
    );
}

function tailBefore(fd, offset) {
    const length = Math.min(TAIL, offset);
    const bytes = Buffer.alloc(length);
    const got = length === 0 ? 0 : fs.readSync(fd, bytes, 0, length, offset - length);
    return digest(bytes.subarray(0, got).toString("latin1"));
}

function restore(file, transcriptPath, stat) {
    let kept;
    try {
        kept = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return null;
    }
    if (kept === null || typeof kept !== "object" || kept.v !== STATE_VERSION || kept.transcript !== transcriptPath) return null;
    if (kept.ino !== stat.ino || !isCount(kept.offset) || kept.offset > stat.size || typeof kept.tail !== "string" || !wellFormed(kept.figures)) return null;
    return kept;
}

function advance(kept, transcriptPath, size) {
    if (size === kept.offset) return false;
    const fd = fs.openSync(transcriptPath, "r");
    try {
        if (kept.offset > 0 && tailBefore(fd, kept.offset) !== kept.tail) {
            Object.assign(kept, { offset: 0, tail: "", figures: sessionFigures() });
        }
        const start = kept.offset;
        let position = kept.offset;
        // Joined once the newline lands: joining at every chunk would copy a long line once per chunk it spans.
        let waiting = [];
        while (position < size) {
            const chunk = Buffer.allocUnsafe(Math.min(CHUNK, size - position));
            const got = fs.readSync(fd, chunk, 0, chunk.length, position);
            if (got === 0) break;
            position += got;
            const bytes = chunk.subarray(0, got);
            const end = bytes.lastIndexOf(0x0a);
            if (end === -1) {
                waiting.push(bytes);
                continue;
            }
            const complete = waiting.length === 0 ? bytes.subarray(0, end) : Buffer.concat([...waiting, bytes.subarray(0, end)]);
            for (const line of complete.toString("utf8").split("\n")) {
                const read = readLine(line);
                if (read !== null && !read.malformed) foldFigures(kept.figures, read);
            }
            waiting = end + 1 < got ? [bytes.subarray(end + 1)] : [];
            kept.offset = position - (got - end - 1);
        }
        if (kept.offset !== start) kept.tail = tailBefore(fd, kept.offset);
        return kept.offset !== start;
    } finally {
        fs.closeSync(fd);
    }
}

/** Written whole, then renamed over the old: the prompt's and the status line's calls can race, and either snapshot counts nothing twice. */
function keep(file, kept, warn) {
    const temporary = `${file}.${process.pid}-${Date.now().toString(36)}`;
    let created = false;
    try {
        fs.writeFileSync(temporary, `${JSON.stringify(kept)}\n`, { flag: "wx", mode: 0o600 });
        created = true;
        fs.renameSync(temporary, file);
    } catch (error) {
        if (created) fs.rmSync(temporary, { force: true });
        warn(`the running figures could not be kept — ${error.code ?? error.message}; the next call reads from where the last kept ones end`);
    }
}

const sessionOf = (payload) => (typeof payload?.session_id === "string" && payload.session_id !== "" ? payload.session_id : null);

function locate(payload, dir) {
    const transcriptPath = typeof payload?.transcript_path === "string" ? payload.transcript_path : null;
    if (transcriptPath === null) return { why: "the host sent no transcript_path" };
    let stat;
    try {
        stat = fs.statSync(transcriptPath);
    } catch (error) {
        return { why: `the transcript could not be read — ${error.code ?? error.message}` };
    }
    if (!stat.isFile()) return { why: "the transcript could not be read — it is not a file" };
    const sessionId = sessionOf(payload);
    const file = sessionId === null ? null : stateFile(sessionId, dir);
    const kept = (file === null ? null : restore(file, transcriptPath, stat)) ?? { v: STATE_VERSION, transcript: transcriptPath, ino: stat.ino, offset: 0, tail: "", figures: sessionFigures() };
    return { transcriptPath, sessionId, stat, file, kept };
}

function refresh(found, warn, spend) {
    try {
        if (advance(found.kept, found.transcriptPath, found.stat.size) && found.file !== null) keep(found.file, found.kept, warn);
    } catch (error) {
        return { why: `the transcript could not be read — ${error.code ?? error.message}` };
    }
    let figure;
    try {
        figure = figureOf(found.kept.figures, spend);
    } catch (error) {
        if (!(error instanceof LedgerError)) throw error;
        return { why: error.message };
    }
    if (figure !== null) return figure;
    return found.kept.figures.pending
        ? { why: "no request is recorded since the compaction", after: "the first request since the compaction" }
        : { why: "no request is recorded yet", after: "the first recorded request" };
}

const FINISH = { PostToolUse: "finish the current step, then ", UserPromptSubmit: "finish what this prompt asks, then ", Stop: "" };

export function adviceLine(figure, event = "UserPromptSubmit") {
    const m = figure.multipliers;
    const assumed =
        m.source === "declared"
            ? "multipliers declared"
            : `multipliers undeclared, so the general read multiplier and the ${m.recorded ? `${m.lifetime === "1h" ? "one-hour" : "five-minute"} writes the host recorded` : "five-minute write the records did not state"}`;
    return (
        `Portulan restart advisory: after ${grouped(figure.requests)} requests, each re-reading it, this session's context, ${grouped(figure.context)} tokens, has reached its restart threshold of ` +
        `${grouped(figure.threshold)} = fresh context ${grouped(figure.fresh)} × (1 + write ${m.write}× / (${figure.horizon} more requests × read ${m.read}×)); ${assumed}. ` +
        `Continuing costs more in re-reads than restarting: ${FINISH[event]}write the handoff and end the session. Said once.`
    );
}

export function statusLine(figure) {
    const m = figure.multipliers;
    const multiplied = `${m.source === "declared" ? "multipliers declared" : "multipliers undeclared"}: read ${m.read}×, write ${m.write}×`;
    const requests = `${grouped(figure.requests)} request${figure.requests === 1 ? "" : "s"}`;
    return figure.context >= figure.threshold
        ? `${requests} · context ${compact(figure.context)} has reached its ${compact(figure.threshold)} restart threshold: write the handoff and restart · ${multiplied}`
        : `${requests} · context ${compact(figure.context)} of a ${compact(figure.threshold)} restart threshold · ${multiplied}`;
}

function once(event, payload, { dir = os.tmpdir(), warn = () => {}, declared = null, horizon = HORIZON } = {}) {
    // Claude Code 2.1.281: a subagent's tool call carries its own `agent_id` and the main session's transcript,
    // and a subagent told to end its session would end nothing.
    if (typeof payload?.agent_id === "string" && payload.agent_id !== "") return null;
    // A host can give a block's retry a new session id, where the held-once record would hold it again.
    if (event === "Stop" && payload?.stop_hook_active === true) return null;
    const sessionId = sessionOf(payload);
    if (sessionId === null) {
        warn("the host sent no session_id, so saying the line once could not be kept");
        return null;
    }
    const found = locate(payload, dir);
    if (found.why !== undefined) {
        warn(found.why);
        return null;
    }
    const record = event === "Stop" ? heldFile : toldFile;
    // Nothing written since the figures were kept, so nothing compacted: the record at the kept count answers without a read.
    if (found.stat.size === found.kept.offset && fs.existsSync(record(sessionId, found.kept.figures.compactions, dir))) return null;
    const figure = refresh(found, warn, { declared, horizon });
    if (figure.why !== undefined) {
        warn(figure.why);
        return null;
    }
    if (figure.context < figure.threshold) return null;
    const mark = (file) => fs.writeFileSync(file, `${figure.context} ${figure.threshold}\n`, { flag: "wx", mode: 0o600 });
    try {
        mark(record(sessionId, figure.compactions, dir));
    } catch (error) {
        if (error.code !== "EEXIST") {
            warn(
                event === "Stop"
                    ? `the held-once record could not be written — ${error.code ?? error.message}; letting the turn end rather than holding it at every stop`
                    : `the told-once record could not be written — ${error.code ?? error.message}; staying silent rather than saying the line at every prompt`,
            );
        }
        return null;
    }
    if (event !== "Stop") return JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: adviceLine(figure, event) } });
    try {
        mark(toldFile(sessionId, figure.compactions, dir));
    } catch (error) {
        if (error.code !== "EEXIST") warn(`the told-once record could not be written — ${error.code ?? error.message}; the line may come once more after the block`);
    }
    return JSON.stringify({ decision: "block", reason: adviceLine(figure, event) });
}

export const onTool = (payload, options) => once("PostToolUse", payload, options);

export const onPrompt = (payload, options) => once("UserPromptSubmit", payload, options);

export const onStop = (payload, options) => once("Stop", payload, options);

/** The status line, its context the host's own last-call counts where sent: current where the transcript may lag a request. */
export function onStatus(payload, { dir = os.tmpdir(), warn = () => {}, declared = null, horizon = HORIZON } = {}) {
    const found = locate(payload, dir);
    const figure = found.why === undefined ? refresh(found, warn, { declared, horizon }) : found;
    if (figure.why !== undefined) return figure.after !== undefined ? `restart threshold: after ${figure.after}` : `restart threshold: not known, because ${figure.why}`;
    const usage = payload?.context_window?.current_usage;
    const counts = usage !== null && typeof usage === "object" ? ["input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"].map((k) => usage[k]) : [];
    if (counts.length === 3 && counts.every((n) => Number.isSafeInteger(n) && n >= 0)) figure.context = counts.reduce((a, b) => a + b, 0);
    return statusLine(figure);
}

function readPayload() {
    try {
        return JSON.parse(fs.readFileSync(0, "utf8"));
    } catch {
        return null;
    }
}

const SPEND_FLAGS = { "--read": "read", "--write-5m": "write", "--write-1h": "write", "--horizon": "requests" };

const MULTIPLIER_FLAGS = ["--read", "--write-5m", "--write-1h"];

/** A figure as `String` spells a positive number, and nothing looser: no sign, no hex, no blank. */
const DECIMAL = /^[0-9]+(\.[0-9]+)?(e[+-]?[0-9]+)?$/;

/** The figures after the mode, `{ declared, horizon, fault }`, each null where absent; a partial multiplier set is undeclared whole. */
export function spendFlags(args) {
    const values = new Map();
    const faults = { multipliers: [], horizon: [], other: [] };
    const shown = (s) => (typeof s === "string" && /^[-+.a-zA-Z0-9]+$/.test(s) ? s : JSON.stringify(s));
    for (let i = 0; i < args.length; i += 2) {
        const [flag, raw] = [args[i], args[i + 1]];
        if (!Object.hasOwn(SPEND_FLAGS, flag)) {
            faults.other.push(`${shown(flag)} is no flag it takes`);
            continue;
        }
        const part = flag === "--horizon" ? faults.horizon : faults.multipliers;
        const range = SPEND_FIGURES[SPEND_FLAGS[flag]];
        const value = typeof raw === "string" && DECIMAL.test(raw) ? Number(raw) : Number.NaN;
        if (values.has(flag)) part.push(`${flag} is given twice`);
        else if (raw === undefined) part.push(`${flag} has no value`);
        else if (!range.holds(value)) part.push(`${flag} ${shown(raw)} is not ${range.is}`);
        values.set(flag, value);
    }
    const missing = MULTIPLIER_FLAGS.filter((flag) => !values.has(flag));
    if (missing.length > 0 && missing.length < MULTIPLIER_FLAGS.length) faults.multipliers.push(`${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} missing from the set of three`);
    if (missing.length === 0 && !faults.multipliers.length) {
        const over = overflowingWrite({ read: values.get("--read"), write: { "5m": values.get("--write-5m"), "1h": values.get("--write-1h") } });
        if (over !== null) faults.multipliers.push(`--write-${over} divided by --read overflows, which gives no finite threshold`);
    }
    const said = [];
    if (faults.multipliers.length) said.push(`${faults.multipliers.join(", ")}, so the multipliers are undeclared`);
    if (faults.horizon.length) said.push(`${faults.horizon.join(", ")}, so the horizon is undeclared, and ${HORIZON} requests`);
    if (faults.other.length) said.push(`${faults.other.join(", ")}, so ${faults.other.length === 1 ? "it is" : "each is"} passed over with the value after it`);
    return {
        declared: missing.length === 0 && !faults.multipliers.length ? { read: values.get("--read"), write: { "5m": values.get("--write-5m"), "1h": values.get("--write-1h") } } : null,
        horizon: values.has("--horizon") && !faults.horizon.length ? values.get("--horizon") : null,
        fault: said.length ? said.join("; ") : null,
    };
}

export function main(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr, payload = undefined, dir = os.tmpdir() } = {}) {
    const mode = argv[0];
    const input = payload === undefined ? readPayload() : payload;
    const warn = (why) => stderr.write(`portulan advisory: ${why}\n`);
    try {
        const figures = spendFlags(argv.slice(1));
        if (figures.fault !== null) warn(`the figures after ${mode} are not all usable — ${figures.fault}`);
        const priced = { dir, warn, declared: figures.declared, horizon: figures.horizon ?? HORIZON };
        if (mode === "prompt" || mode === "tool" || mode === "stop") {
            const out = { tool: onTool, prompt: onPrompt, stop: onStop }[mode](input, priced);
            if (out !== null) stdout.write(`${out}\n`);
        } else if (mode === "status") {
            stdout.write(`${onStatus(input, priced)}\n`);
        } else {
            warn(`unknown mode ${JSON.stringify(mode)}: the compiled commands pass tool, prompt, status or stop`);
        }
    } catch (cause) {
        warn(`could not run — ${cause?.message ?? cause}`);
    }
    return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = main();
}
