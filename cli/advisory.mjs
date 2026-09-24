#!/usr/bin/env node
// The restart advisory — one line, once, where the agent is, and the same figure for the human.
//
//   node cli/advisory.mjs tool      a PostToolUse hook: the line, as additionalContext, once, mid-stretch
//   node cli/advisory.mjs prompt    a UserPromptSubmit hook: the same line, at the next prompt, if not said yet
//   node cli/advisory.mjs status    a status-line command: the figure and the request count, on every refresh
//
// Wired by `./compile.mjs` into `.claude/settings.json`. `0038`'s rule 2: every request re-reads the
// context, so a session is told to end when continuing costs more than restarting, **once, where the
// agent is**: *with its next tool result mid-stretch, or at its next prompt*. On Claude Code a
// non-blocking `Stop` hook's output never reaches the model, so the line goes in with a tool result or a
// prompt, each of which enters the context without an extra turn; the human sees the same figure in the
// status line, from the host's own last-call token counts, at no token cost. The threshold is
// `./ledger.mjs`'s, computed from the session's own records and never written down.
//
// **The tool-result half is what reaches an agent at work.** The prompt half alone speaks only when a
// person writes, and a headless run gets one prompt, at its start, before any request is recorded: in the
// before-and-after runs of 2026-09-24 the advisory said its line in none of the 15 runs that carried it.
// Both halves read one told-once record, so whichever comes first says the line and the other stays
// silent. Each line and the status line carry the session's request count, `0038`'s rule 1 figure — a
// report, never a budget, which `0038` rules out.
//
// ## A report, never a gate
//
// Ruling 3 of `0038` made the advisory a report by default: the threshold is an estimate, and a forced
// restart on a wrong one costs a fresh write and a handoff, while an ignored line costs nothing. So this
// never blocks and never ends anything — ending stays the agent's or the human's act. **It exits 0 on
// every path.** For `UserPromptSubmit` an exit of 2 would erase the person's prompt, so a runner that
// could crash into it would be the one way this line did harm; anything it cannot read, it passes over
// in silence, and says why on stderr, which the host keeps for its debug log.
//
// ## Once
//
// The line is written at the first tool result or prompt whose last recorded request is at or past the
// threshold. The host writes its transcript asynchronously, so that request may be one behind the one
// just answered: the line is one request late at most, and never early. Whether it was said is kept in the OS temp
// directory, keyed by session and by how many times the session has compacted — a compaction starts the
// context again, so the line may be owed again, and until the first request after it there is no figure
// at all, since the context the records last show is the one the compaction replaced. The file is
// created exclusively before the line is written, and **where it cannot be created, nothing is
// written**: an advisory that could not remember saying itself would say itself at every prompt, which
// is the echo `0038`'s rule 5 forbids.
//
// ## What a call costs
//
// This runs at every prompt and at every refresh of the status line, so what it reads is bounded by
// what the transcript gained, never by its length: at a tool result that is the request just made. The session's running figures — `./ledger.mjs`'s,
// one fold for both — are kept beside the told-once records with the byte offset they were read to and a
// digest of the bytes before it, and each call folds in only the complete lines past that offset; a torn
// last line is read once its newline lands. The transcript is read from its start only when nothing is
// kept, or what is kept no longer describes it: another path, another file, a file shorter than the
// offset, or other bytes where the last read ended. At a tool result or a prompt the told-once record is looked at before
// the transcript is opened, so once the line is said, a prompt with nothing new since the last call costs
// the runner's startup and nothing more. A first read goes 64 KB at a time rather than holding the
// transcript whole. What is kept is counts, message ids and a digest, never a byte of what the session
// said, in files only their owner can read.
//
// The fold passes over a repeat of one of the 16 latest message ids, where the ledger's tally passes over
// a repeat of any: an id the host wrote again further apart than that would be folded twice, and the
// running figures would part from the tally. Of what they hold, only the fresh and the latest context
// feed the threshold.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { figureOf, foldFigures, readLine, sessionFigures } from "./ledger.mjs";

const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** The shape of what is kept between calls; a record of another version is read as none. 2 counts requests. */
const STATE_VERSION = 2;

/**
 * How much of a transcript is read at a time. Measured on a 7.4 MB transcript, a first read peaked at
 * 73 MB resident in 1 MB chunks and at 60 MB in 64 KB ones, against 45 MB for the runner doing nothing,
 * and took no longer.
 */
const CHUNK = 1 << 16;

/**
 * How many bytes before the offset the next call compares to recognise the transcript it read. Only their
 * digest is kept: those bytes can be what the session said, and nothing it said is kept.
 */
const TAIL = 64;

/** Tokens in the status line's width: thousands, one decimal short of a million. */
export function compact(n) {
    if (n < 1000) return String(n);
    if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
    return `${(n / 1_000_000).toFixed(2)}M`;
}

/** A short, stable digest, as `./stop-gate.mjs` keys its counters: not security, only distinctness. */
function digest(value) {
    let h = 0;
    for (const ch of String(value)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h.toString(36);
}

/**
 * The name one session's records share. The readable part is for a person looking in the temp directory;
 * the digest keeps two ids apart that sanitise to one string, the defect `./stop-gate.mjs` found in its
 * own counter names.
 */
function stem(sessionId) {
    return `portulan-advisory-${String(sessionId).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40)}-${digest(sessionId)}`;
}

/** Where the record that the line was said lives, for one session and one compaction epoch. */
export function toldFile(sessionId, compactions, dir = os.tmpdir()) {
    return path.join(dir, `${stem(sessionId)}-${compactions}`);
}

/** Where one session's running figures are kept between calls. */
export function stateFile(sessionId, dir = os.tmpdir()) {
    return path.join(dir, `${stem(sessionId)}.json`);
}

const isCount = (v) => Number.isSafeInteger(v) && v >= 0;
const isLifetime = (v) => v === null || v === "1h" || v === "5m";
const FIGURE_KEYS = Object.keys(sessionFigures()).sort().join();

/** Running figures read back from JSON, in the shape `sessionFigures` gives and no other. */
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

/** The digest of the bytes just before `offset`, which the next call compares to recognise the transcript it read. */
function tailBefore(fd, offset) {
    const length = Math.min(TAIL, offset);
    const bytes = Buffer.alloc(length);
    const got = length === 0 ? 0 : fs.readSync(fd, bytes, 0, length, offset - length);
    return digest(bytes.subarray(0, got).toString("latin1"));
}

/** What the last call kept for this session, if it still describes this transcript as far as a stat can tell. */
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

/**
 * Fold the complete lines the transcript gained past `kept.offset` into `kept.figures`, a chunk at a time,
 * after checking the bytes where the last read ended are the ones it read; where they are not, the
 * transcript is read again from its start. With nothing past the offset the transcript is not opened.
 * Returns whether the offset moved.
 */
function advance(kept, transcriptPath, size) {
    if (size === kept.offset) return false;
    const fd = fs.openSync(transcriptPath, "r");
    try {
        if (kept.offset > 0 && tailBefore(fd, kept.offset) !== kept.tail) {
            Object.assign(kept, { offset: 0, tail: "", figures: sessionFigures() });
        }
        const start = kept.offset;
        let position = kept.offset;
        // The bytes of a line still waiting for its newline, a chunk each, joined once the newline lands:
        // joining them at every chunk would copy a long line once per chunk it spans.
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

/**
 * Keep the figures for the next call: written whole to a new file and renamed over the old, so no reader
 * sees half. The prompt's call and the status line's can race, and the one that read less may rename last;
 * what it leaves is still one snapshot, the offset, the digest and the figures together, so the next call
 * reads again from that offset and counts nothing twice.
 */
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

/**
 * The transcript a host payload names, and what this session last kept of it, or the reason there is
 * nothing to read. With no session id there is nothing to key the figures by, so they are kept nowhere
 * and the transcript is read whole.
 */
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

/**
 * Bring what `locate` found up to date with the transcript, and keep it; the figure, or the reason for none,
 * with `after` naming the request that brings one where the transcript was read and simply has none yet.
 */
function refresh(found, warn) {
    try {
        if (advance(found.kept, found.transcriptPath, found.stat.size) && found.file !== null) keep(found.file, found.kept, warn);
    } catch (error) {
        return { why: `the transcript could not be read — ${error.code ?? error.message}` };
    }
    const figure = figureOf(found.kept.figures);
    if (figure !== null) return figure;
    return found.kept.figures.pending
        ? { why: "no request is recorded since the compaction", after: "the first request since the compaction" }
        : { why: "no request is recorded yet", after: "the first recorded request" };
}

/** What each surface asks the agent to finish before it hands off: mid-stretch the step, at a prompt the prompt. */
const FINISH = { PostToolUse: "finish the current step", UserPromptSubmit: "finish what this prompt asks" };

/** The line the agent reads: the figure, the requests behind it, the multipliers it assumed, and what to do. */
export function adviceLine(figure, event = "UserPromptSubmit") {
    const m = figure.multipliers;
    const assumed =
        m.source === "declared"
            ? "multipliers declared"
            : `multipliers undeclared, so the general read multiplier and the ${m.recorded ? `${m.lifetime === "1h" ? "one-hour" : "five-minute"} writes the host recorded` : "five-minute write the records did not state"}`;
    return (
        `Portulan restart advisory: after ${grouped(figure.requests)} requests, each re-reading it, this session's context, ${grouped(figure.context)} tokens, has reached its restart threshold of ` +
        `${grouped(figure.threshold)} = fresh context ${grouped(figure.fresh)} × (1 + write ${m.write}× / (${figure.horizon} more requests × read ${m.read}×)); ${assumed}. ` +
        `Continuing costs more in re-reads than restarting: ${FINISH[event]}, then write the handoff and end the session. Said once.`
    );
}

/** The status line: the same figure and the request count, short. */
export function statusLine(figure) {
    const m = figure.multipliers;
    const multiplied = `${m.source === "declared" ? "multipliers declared" : "multipliers undeclared"}: read ${m.read}×, write ${m.write}×`;
    const requests = `${grouped(figure.requests)} request${figure.requests === 1 ? "" : "s"}`;
    return figure.context >= figure.threshold
        ? `${requests} · context ${compact(figure.context)} has reached its ${compact(figure.threshold)} restart threshold: write the handoff and restart · ${multiplied}`
        : `${requests} · context ${compact(figure.context)} of a ${compact(figure.threshold)} restart threshold · ${multiplied}`;
}

/**
 * Either hook's half: `event` is `PostToolUse` or `UserPromptSubmit`. Returns what to print: the hook's
 * JSON, or null for silence. `dir` is where the told-once records and the running figures live.
 */
function once(event, payload, { dir = os.tmpdir(), warn = () => {} } = {}) {
    // A subagent's tool call reaches this hook with its own `agent_id` and the main session's transcript
    // (Claude Code 2.1.281's program text). The line and the figures are the main session's, and a subagent
    // told to end its session would end nothing, so its tool results neither say the line nor spend the once.
    if (typeof payload?.agent_id === "string" && payload.agent_id !== "") return null;
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
    // Said in this epoch, and nothing written since the figures were kept: nothing can have compacted, so
    // nothing is owed, and the transcript is not opened.
    if (found.stat.size === found.kept.offset && fs.existsSync(toldFile(sessionId, found.kept.figures.compactions, dir))) return null;
    const figure = refresh(found, warn);
    if (figure.why !== undefined) {
        warn(figure.why);
        return null;
    }
    if (figure.context < figure.threshold) return null;
    try {
        fs.writeFileSync(toldFile(sessionId, figure.compactions, dir), `${figure.context} ${figure.threshold}\n`, { flag: "wx", mode: 0o600 });
    } catch (error) {
        if (error.code !== "EEXIST") warn(`the told-once record could not be written — ${error.code ?? error.message}; staying silent rather than saying the line at every prompt`);
        return null;
    }
    return JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: adviceLine(figure, event) } });
}

/** The `PostToolUse` half: the line with the next tool result, mid-stretch, where no prompt comes. */
export const onTool = (payload, options) => once("PostToolUse", payload, options);

/** The `UserPromptSubmit` half: the line at the next prompt, where no tool result said it first. */
export const onPrompt = (payload, options) => once("UserPromptSubmit", payload, options);

/**
 * The status-line half. The context is the host's own last-call counts where it sends them, which are
 * current where the transcript may lag one request; the fresh context and the lifetime come from the
 * records. Returns the line, or why there is no figure: none yet, or a transcript it could not read, which
 * is said as that and never as one with no request in it.
 */
export function onStatus(payload, { dir = os.tmpdir(), warn = () => {} } = {}) {
    const found = locate(payload, dir);
    const figure = found.why === undefined ? refresh(found, warn) : found;
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

export function main(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr, payload = undefined, dir = os.tmpdir() } = {}) {
    const mode = argv[0];
    const input = payload === undefined ? readPayload() : payload;
    const warn = (why) => stderr.write(`portulan advisory: ${why}\n`);
    try {
        if (mode === "prompt" || mode === "tool") {
            const out = (mode === "tool" ? onTool : onPrompt)(input, { dir, warn });
            if (out !== null) stdout.write(`${out}\n`);
        } else if (mode === "status") {
            stdout.write(`${onStatus(input, { dir, warn })}\n`);
        } else {
            warn(`unknown mode ${JSON.stringify(mode)}: the compiled commands pass tool, prompt or status`);
        }
    } catch (cause) {
        // A defect here must cost the person nothing: no line, and the prompt goes through.
        warn(`could not run — ${cause?.message ?? cause}`);
    }
    return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = main();
}
