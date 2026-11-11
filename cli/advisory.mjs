#!/usr/bin/env node
// Restart comparison with explicit horizon and resume expense; unknown recovery cost stays conditional.
//
// node cli/advisory.mjs tool|prompt|status|stop [--read m --write-5m m --write-1h m] [--horizon n] [--resume-tokens cost]
// Undeclared prices/horizon use general figures; unknown resume cost permits conditional reports only.
// Tool/prompt output reaches the agent; a declared Stop holds only with explicit profitable estimates.
// Retain the first crossing in a delayed batch; Stop uses the latest estimate. Hook failures exit 0.
// Unusable figures are named on stderr.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { HORIZON, LedgerError, SPEND_FIGURES, figureOf, foldFigures, overflowingWrite, readLine, readTranscript, restartSaving, sessionFigures } from "./ledger.mjs";

const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const savingWords = (n) => grouped(Number(n.toPrecision(6)));

const STATE_VERSION = 6;

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
    if (typeof kept.comparison !== "string") return null;
    if (typeof kept.freshUnsafe !== "boolean" || typeof kept.latestUnsafe !== "boolean" || ![kept.freshId, kept.latestId, kept.crossingId].every(id => id === null || typeof id === "string")) return null;
    if (![kept.freshInput, kept.latestInput, kept.crossingInput].every(v => v === null || (Array.isArray(v) && v.length === 5 && v.every(isCount)))) return null;
    if (!Array.isArray(kept.recentInputs) || kept.recentInputs.length > 16 || !kept.recentInputs.every(v => Array.isArray(v) && v.length === 3 && typeof v[0] === "string" && Array.isArray(v[1]) && v[1].length === 5 && v[1].every(isCount) && (v[2] === 0 || v[2] === 1))) return null;
    if (kept.crossing !== null && (!wellFormed(kept.crossing) || kept.crossing.pending || kept.crossing.compactions !== kept.figures.compactions || kept.crossing.fresh !== kept.figures.fresh || kept.crossing.requests > kept.figures.requests || kept.crossing.recent.length !== 0)) return null;
    return kept;
}

const comparisonKey = ({ declared, horizon, resume }) => JSON.stringify([declared?.read ?? null, declared?.write?.["5m"] ?? null, declared?.write?.["1h"] ?? null, horizon, resume]);
const inputOf = r => [r.uncached, r.written1h, r.written5m, r.writtenUnknown, r.read];
const validity = () => ({ freshUnsafe: false, latestUnsafe: false, freshId: null, latestId: null, crossingId: null, freshInput: null, latestInput: null, crossingInput: null });
const reset = (kept) => Object.assign(kept, { offset: 0, tail: "", figures: sessionFigures(), crossing: null, recentInputs: [], ...validity() });
function rememberInput(state, r) {
    if (r.id === null) return;
    state.recentInputs = [...state.recentInputs.filter(v => v[0] !== r.id), [r.id, inputOf(r), r.usageMissing & 1]].filter(v => state.figures.recent.includes(v[0])).slice(-16);
}

function replayValidity(kept, transcriptPath, spend) {
    const transcript = readTranscript(transcriptPath, { end: kept.offset });
    const state = { figures: sessionFigures(), crossing: null, recentInputs: [], ...validity() };
    for (const r of transcript.requests.filter(r => !r.sidechain)) {
        if (r.compacted) { foldFigures(state.figures, { boundary: true }); Object.assign(state, { crossing: null, ...validity() }); }
        const fresh = state.figures.fresh === null || state.figures.pending;
        foldFigures(state.figures, { request: r });
        rememberInput(state, r);
        const unsafe = ((r.usageMissing | r.usageUnsafe) & 1) !== 0;
        if (fresh) { state.freshUnsafe = unsafe; state.freshId = r.id; state.freshInput = inputOf(r); }
        state.latestUnsafe = unsafe; state.latestId = r.id; state.latestInput = inputOf(r);
        if (state.freshUnsafe && !isCount(state.figures.fresh)) state.figures.fresh = 0;
        if (state.latestUnsafe && !isCount(state.figures.last)) state.figures.last = 0;
        if (state.freshUnsafe || state.latestUnsafe || state.crossing !== null) continue;
        try {
            const figure = figureOf(state.figures, spend);
            if (figure !== null && figure.saving >= 0) { state.crossing = { ...state.figures, recent: [] }; state.crossingId = r.id; state.crossingInput = inputOf(r); }
        } catch (error) { if (!(error instanceof LedgerError)) throw error; }
    }
    state.figures.compactions = transcript.figures.compactions;
    state.figures.pending = transcript.figures.pending;
    if (state.figures.pending) Object.assign(state, { crossing: null, ...validity() });
    else if (state.crossing) state.crossing.compactions = state.figures.compactions;
    Object.assign(kept, state);
}

function advance(kept, transcriptPath, size, spend) {
    if (size === kept.offset) return false;
    const fd = fs.openSync(transcriptPath, "r");
    try {
        if (kept.offset > 0 && tailBefore(fd, kept.offset) !== kept.tail) {
            reset(kept);
        }
        const start = kept.offset;
        let position = kept.offset;
        let replay = false;
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
                if (read === null || read.malformed) continue;
                const { requests, compactions } = kept.figures;
                const fresh = kept.figures.fresh === null || kept.figures.pending;
                const r = read.request;
                if (r && !r.synthetic && !r.sidechain) {
                    const input = inputOf(r);
                    const tracked = [[kept.freshId, kept.freshInput], [kept.latestId, kept.latestInput], [kept.crossingId, kept.crossingInput]];
                    const recent = kept.recentInputs.find(v => v[0] === r.id);
                    if (((r.usageMissing | r.usageUnsafe) & 1) || (recent && (JSON.stringify(recent[1]) !== JSON.stringify(input) || recent[2] !== (r.usageMissing & 1))) || (r.id !== null && tracked.some(([id, before]) => id === r.id && (JSON.stringify(before) !== JSON.stringify(input) || kept.freshUnsafe || kept.latestUnsafe)))) replay = true;
                }
                foldFigures(kept.figures, read);
                if (compactions !== kept.figures.compactions) Object.assign(kept, { crossing: null, ...validity() });
                if (r && !r.synthetic && !r.sidechain) {
                    rememberInput(kept, r);
                    const unsafe = ((r.usageMissing | r.usageUnsafe) & 1) !== 0;
                    if (requests !== kept.figures.requests) {
                        if (fresh) { kept.freshUnsafe = unsafe; kept.freshId = r.id; kept.freshInput = inputOf(r); }
                        kept.latestUnsafe = unsafe; kept.latestId = r.id; kept.latestInput = inputOf(r);
                    } else if (r.id !== null && (r.usageUnsafe & 1)) {
                        if (r.id === kept.freshId) kept.freshUnsafe = true;
                        if (r.id === kept.latestId) kept.latestUnsafe = true;
                    }
                }
                if (kept.freshUnsafe || kept.latestUnsafe) continue;
                if (requests === kept.figures.requests || kept.crossing !== null) continue;
                try {
                    const figure = figureOf(kept.figures, spend);
                    if (figure !== null && figure.saving >= 0) { kept.crossing = { ...kept.figures, recent: [] }; kept.crossingId = r.id; kept.crossingInput = inputOf(r); }
                } catch (error) {
                    if (!(error instanceof LedgerError)) throw error;
                }
            }
            waiting = end + 1 < got ? [bytes.subarray(end + 1)] : [];
            kept.offset = position - (got - end - 1);
        }
        if (kept.offset !== start) kept.tail = tailBefore(fd, kept.offset);
        if (replay) replayValidity(kept, transcriptPath, spend);
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
    const kept = (file === null ? null : restore(file, transcriptPath, stat)) ?? { v: STATE_VERSION, transcript: transcriptPath, ino: stat.ino, offset: 0, tail: "", figures: sessionFigures(), comparison: "", crossing: null, recentInputs: [], ...validity() };
    return { transcriptPath, sessionId, stat, file, kept };
}

function refresh(found, warn, spend) {
    try {
        const key = comparisonKey(spend);
        const changed = found.kept.comparison !== key;
        if (changed) { reset(found.kept); found.kept.comparison = key; }
        if ((advance(found.kept, found.transcriptPath, found.stat.size, spend) || changed) && found.file !== null) keep(found.file, found.kept, warn);
    } catch (error) {
        return { why: `the transcript could not be read — ${error.code ?? error.message}` };
    }
    let figure;
    if (found.kept.freshUnsafe) return { why: "fresh context usage has invalid or missing counters; comparison unavailable (compaction or completed missing fields required)" };
    if (found.kept.latestUnsafe) return { why: "latest context usage has invalid or missing counters; comparison unavailable (valid next request or completed missing fields required)" };
    try {
        figure = figureOf(found.kept.figures, spend);
        if (figure !== null) figure.crossing = found.kept.crossing === null ? null : figureOf(found.kept.crossing, spend);
    } catch (error) {
        if (!(error instanceof LedgerError)) throw error;
        return { why: error.message };
    }
    if (figure !== null) return figure;
    return found.kept.figures.pending
        ? { why: "no request is recorded since the compaction", after: "the first request since the compaction" }
        : { why: "no request is recorded yet", after: "the first recorded request" };
}

export function adviceLine(figure, event = "UserPromptSubmit") {
    const m = figure.multipliers;
    const horizon = `${figure.horizon} remaining (${figure.horizonDeclared ? "declared" : "default"})`;
    const resume = figure.resume == null ? "resume cost unknown; threshold is a lower bound" : `resume ${grouped(figure.resume)} input equivalents`;
    const comparison = figure.saving < 0 ? "Latest estimate does not favor restarting."
        : figure.resume != null && figure.horizonDeclared
        ? `Estimated savings ${savingWords(figure.saving)} input equivalents; consider a handoff and restart if these estimates still fit the task.`
        : "Restart only if remaining work and recovery cost make it cheaper; finish bounded work when that costs less.";
    const first = figure.crossing;
    const history = first && first.requests !== figure.requests
        ? ` First crossing: request ${grouped(first.requests)}, context ${grouped(first.context)} / threshold ${grouped(first.threshold)} (fresh ${grouped(first.fresh)}, read ${first.multipliers.read}×, write ${first.multipliers.write}×, ${first.multipliers.recorded ? "recorded" : "assumed"} ${first.multipliers.lifetime}).`
        : "";
    return `Portulan restart advisory: after ${grouped(figure.requests)} requests, context ${grouped(figure.context)} tokens, threshold ${grouped(figure.threshold)}; ${horizon}, read ${m.read}×, write ${m.write}× (${m.source}); ${resume}.${history} ${comparison} Said once.`;
}

export function statusLine(figure) {
    const m = figure.multipliers;
    return `${grouped(figure.requests)} requests · context ${compact(figure.context)} / restart ${compact(figure.threshold)} · ${figure.horizon} remaining (${figure.horizonDeclared ? "declared" : "default"}) · ` +
        `${figure.resume == null ? "resume cost unknown: lower bound" : `resume ${grouped(figure.resume)} input-equivalent tokens; estimated saving ${savingWords(figure.saving)}`} · ` +
        `multipliers ${m.source}: read ${m.read}×, write ${m.write}×`;
}

export function advisoryOutput(figure, event) {
    const line = adviceLine(figure, event);
    return event === "Stop"
        ? JSON.stringify({ decision: "block", reason: line })
        : JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: line } });
}

function once(event, payload, { dir = os.tmpdir(), warn = () => {}, declared = null, horizon = null, resume = null } = {}) {
    // Claude Code 2.1.281: a subagent's tool call carries its own `agent_id` and the main session's transcript,
    // and a subagent told to end its session would end nothing.
    if (typeof payload?.agent_id === "string" && payload.agent_id !== "") return null;
    // Without the host's retry marker, rotated session ids can repeat the hold.
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
    const figure = refresh(found, warn, { declared, horizon, resume });
    if (figure.why !== undefined) {
        warn(figure.why);
        return null;
    }
    if (figure.crossing === null) return null;
    if (event === "Stop" && (!figure.horizonDeclared || figure.resume === null || !(figure.saving > 0))) return null;
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
    if (event !== "Stop") return advisoryOutput(figure, event);
    try {
        mark(toldFile(sessionId, figure.compactions, dir));
    } catch (error) {
        if (error.code !== "EEXIST") warn(`the told-once record could not be written — ${error.code ?? error.message}; the line may come once more after the block`);
    }
    return advisoryOutput(figure, event);
}

export const onTool = (payload, options) => once("PostToolUse", payload, options);

export const onPrompt = (payload, options) => once("UserPromptSubmit", payload, options);

export const onStop = (payload, options) => once("Stop", payload, options);

/** The status line, its context the host's own last-call counts where sent: current where the transcript may lag a request. */
export function onStatus(payload, { dir = os.tmpdir(), warn = () => {}, declared = null, horizon = null, resume = null } = {}) {
    const found = locate(payload, dir);
    const figure = found.why === undefined ? refresh(found, warn, { declared, horizon, resume }) : found;
    if (figure.why !== undefined) return figure.after !== undefined ? `restart threshold: after ${figure.after}` : `restart threshold: not known, because ${figure.why}`;
    const usage = payload?.context_window?.current_usage;
    const counts = usage !== null && typeof usage === "object" ? ["input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"].map((k) => usage[k]) : [];
    if (counts.length === 3 && counts.every((n) => Number.isSafeInteger(n) && n >= 0)) {
        const context = counts.reduce((a, b) => a + b, 0);
        if (!Number.isSafeInteger(context)) return "restart threshold: not known, because the current input sum is unsafe";
        try {
            figure.saving = restartSaving({ fresh: figure.fresh, context, horizon: figure.horizon, read: figure.multipliers.read, write: figure.multipliers.write, resume: figure.resume ?? 0 });
        } catch (error) {
            if (error instanceof LedgerError) return "restart threshold: not known, because the estimated saving overflows";
            throw error;
        }
        figure.context = context;
    }
    return statusLine(figure);
}

function readPayload() {
    try {
        return JSON.parse(fs.readFileSync(0, "utf8"));
    } catch {
        return null;
    }
}

const SPEND_FLAGS = { "--read": "read", "--write-5m": "write", "--write-1h": "write", "--horizon": "requests", "--resume-tokens": "resume" };

const MULTIPLIER_FLAGS = ["--read", "--write-5m", "--write-1h"];

/** A figure as `String` spells a positive number, and nothing looser: no sign, no hex, no blank. */
const DECIMAL = /^[0-9]+(\.[0-9]+)?(e[+-]?[0-9]+)?$/;

/** The figures after the mode, `{ declared, horizon, fault }`, each null where absent; a partial multiplier set is undeclared whole. */
export function spendFlags(args) {
    const values = new Map();
    const faults = { multipliers: [], horizon: [], resume: [], other: [] };
    const shown = (s) => (typeof s === "string" && /^[-+.a-zA-Z0-9]+$/.test(s) ? s : JSON.stringify(s));
    for (let i = 0; i < args.length; i += 2) {
        const [flag, raw] = [args[i], args[i + 1]];
        if (!Object.hasOwn(SPEND_FLAGS, flag)) {
            faults.other.push(`${shown(flag)} is no flag it takes`);
            continue;
        }
        const part = flag === "--horizon" ? faults.horizon : flag === "--resume-tokens" ? faults.resume : faults.multipliers;
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
    if (faults.resume.length) said.push(`${faults.resume.join(", ")}, so resume cost is unknown`);
    if (faults.other.length) said.push(`${faults.other.join(", ")}, so ${faults.other.length === 1 ? "it is" : "each is"} passed over with the value after it`);
    return {
        declared: missing.length === 0 && !faults.multipliers.length ? { read: values.get("--read"), write: { "5m": values.get("--write-5m"), "1h": values.get("--write-1h") } } : null,
        horizon: values.has("--horizon") && !faults.horizon.length ? values.get("--horizon") : null,
        resume: values.has("--resume-tokens") && !faults.resume.length ? values.get("--resume-tokens") : null,
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
        if (mode === "stop" && figures.fault !== null) return 0;
        const priced = { dir, warn, declared: figures.declared, horizon: figures.horizon, resume: figures.resume };
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
