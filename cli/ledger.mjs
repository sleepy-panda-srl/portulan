#!/usr/bin/env node
// What a change spends, measured from the host's own usage records.
//
//   node cli/ledger.mjs [--branch <name>] [--repo <dir>] [--base <ref>] [--projects <dir>] [--config <file>]
//       [--workspace <dir>]
//   node cli/ledger.mjs --fixture <dir>
//
// Exit 0 a report · 1 `--fixture` no longer reproduces its known totals · 2 could not run.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { isInside } from "./inside.mjs";

/** Cache reads cost between a fortieth and a tenth of input; the tenth errs toward an earlier restart. */
export const GENERAL_READ = 0.1;

export const WRITE_BY_LIFETIME = { "5m": 1.25, "1h": 2 };

/** The API's default, for a lifetime the records do not state. */
export const DEFAULT_LIFETIME = "5m";

export const LIFETIME_MS = { "5m": 5 * 60 * 1000, "1h": 60 * 60 * 1000 };

/** Requests still to go when the threshold is judged, where `spend.horizon` declares none. */
export const HORIZON = 20;

/** With `MISS_PERCENT`, the host's own `/usage` definition of a cache miss. */
export const MISS_TOKENS = 2000;

export const MISS_PERCENT = 5;

/** Where the host cuts a project key and appends a hash of the whole path. */
export const KEY_LIMIT = 200;

/** The classes a request is billed in, in the order a report prints them. */
export const CLASSES = ["uncached", "written1h", "written5m", "writtenUnknown", "read", "output"];
export const RECORDED_ROLES = ["implementer", "reviewer", "librarian", "supervisor", "local-worker"];

export class LedgerError extends Error {
    constructor(message) {
        super(message);
        this.name = "LedgerError";
    }
}

const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const count = (v) => (Number.isSafeInteger(v) && v > 0 ? v : 0);

const text = (v) => (typeof v === "string" && v !== "" ? v : null);

export function hostPaths(env = process.env, home = os.homedir()) {
    const configDir = text(env.CLAUDE_CONFIG_DIR);
    if (configDir !== null && !path.isAbsolute(configDir)) {
        return { why: `CLAUDE_CONFIG_DIR is the relative path ${JSON.stringify(configDir)}, which the host read from the directory it was started in; name --projects and --config` };
    }
    return {
        projects: path.join(configDir ?? path.join(home, ".claude"), "projects"),
        config: path.join(configDir ?? home, ".claude.json"),
    };
}

/** The host's 32-bit string hash, as its key function spells it. */
function hostHash(value) {
    let h = 0;
    for (let i = 0; i < value.length; i += 1) h = ((h << 5) - h + value.charCodeAt(i)) | 0;
    return h;
}

/** The directory name the host keeps a working directory's transcripts under. */
export function projectKey(dir) {
    const key = dir.replace(/[^a-zA-Z0-9]/g, "-");
    return key.length <= KEY_LIMIT ? key : `${key.slice(0, KEY_LIMIT)}-${Math.abs(hostHash(dir)).toString(36)}`;
}

/** A pre-filter only: `/work/demo`'s key prefixes `/work/demo-old`'s, so each record's `cwd` decides. */
export function mayHold(name, root) {
    const key = root.replace(/[^a-zA-Z0-9]/g, "-");
    const stem = key.length <= KEY_LIMIT ? key : key.slice(0, KEY_LIMIT);
    return name === projectKey(root) || name.startsWith(`${stem}-`);
}

/** null for a record that is not an API response with usage; no content field is ever read. */
export const INPUT_USAGE_MASK = 1 | 4 | 8;
export const inputUnusable = r => Boolean((r.usageMissing & INPUT_USAGE_MASK) || (r.usageUnsafe & 1));

export function usageOf(usage) {
    const lifetimes = usage.cache_creation !== null && typeof usage.cache_creation === "object" ? usage.cache_creation : {};
    const written1h = count(lifetimes.ephemeral_1h_input_tokens);
    const written5m = count(lifetimes.ephemeral_5m_input_tokens);
    const writeParts = (lifetimes.ephemeral_5m_input_tokens === undefined ? 0 : 1) | (lifetimes.ephemeral_1h_input_tokens === undefined ? 0 : 2);
    const invalid = value => value !== undefined && (!Number.isSafeInteger(value) || value < 0);
    const inputUnsafe = [usage.input_tokens, usage.cache_creation_input_tokens, usage.cache_read_input_tokens, lifetimes.ephemeral_1h_input_tokens, lifetimes.ephemeral_5m_input_tokens].some(invalid) ||
        !Number.isSafeInteger(count(usage.input_tokens) + Math.max(count(usage.cache_creation_input_tokens), written1h + written5m) + count(usage.cache_read_input_tokens)) ||
        (usage.cache_creation_input_tokens !== undefined && count(usage.cache_creation_input_tokens) < written1h + written5m);
    return {
        usageMissing: (usage.input_tokens === undefined ? 1 : 0) | (usage.output_tokens === undefined ? 2 : 0) |
            (usage.cache_read_input_tokens === undefined ? 4 : 0) | (usage.cache_creation_input_tokens === undefined && writeParts !== 3 ? 8 : 0),
        usageUnsafe: (inputUnsafe ? 1 : 0) | (invalid(usage.output_tokens) ? 2 : 0),
        writeTotal: Number.isSafeInteger(usage.cache_creation_input_tokens) && usage.cache_creation_input_tokens >= 0 ? usage.cache_creation_input_tokens : null,
        writeParts,
        uncached: count(usage.input_tokens),
        written1h,
        written5m,
        writtenUnknown: Math.max(0, count(usage.cache_creation_input_tokens) - written1h - written5m),
        read: count(usage.cache_read_input_tokens),
        output: count(usage.output_tokens),
    };
}

function requestOf(record) {
    if (record === null || typeof record !== "object" || record.type !== "assistant") return null;
    const message = record.message;
    if (message === null || typeof message !== "object") return null;
    const usage = message.usage;
    if (usage === null || typeof usage !== "object") return null;
    // Synthetic host records have no request behind them.
    if (message.model === "<synthetic>") return { synthetic: true };
    const at = Date.parse(record.timestamp);
    const roleParts = text(record.attributionAgent)?.split(":");
    const role = roleParts?.every(part => /^[a-zA-Z0-9_-]+$/.test(part)) && RECORDED_ROLES.includes(roleParts.at(-1)) ? roleParts.at(-1) : null;
    return {
        id: text(message.id) ?? text(record.requestId) ?? text(record.uuid),
        model: text(message.model),
        effort: text(record.effort),
        role,
        ...usageOf(usage),
        branch: text(record.gitBranch),
        cwd: text(record.cwd),
        at: Number.isFinite(at) ? at : null,
        sidechain: record.isSidechain === true,
        agent: text(record.agentId),
    };
}

export const contextOf = (r) => r.uncached + r.written1h + r.written5m + r.writtenUnknown + r.read;

const writtenOf = (r) => r.written1h + r.written5m + r.writtenUnknown;

const chainOf = (r) => (r.sidechain ? `agent:${r.agent ?? ""}` : "session");

/** A whole-line local receipt is read wherever it appears. */
const RECEIPT =
    /^OK mode=([a-z]+) model=(\S+)(?: target=.+?)? attempts=([1-9]\d*) in=(?:(0|[1-9]\d*)t|\?) out=(?:(0|[1-9]\d*)t|\?) time=(?:(0|[1-9]\d*)ms|\?) rate=(?:(?:0|[1-9]\d*)(?:\.\d)?tok\/s|\?)(?: reasoning=(?:(0|[1-9]\d*)t|\?) cached-in=(?:(0|[1-9]\d*)t|\?))? spend=\$0\.00$/;

/** A figure the runner printed as `?` is null, never 0. */
export function receiptOf(line) {
    const m = RECEIPT.exec(line);
    if (m === null) return null;
    const [attempts, input, output, time] = [m[3], m[4], m[5], m[6]].map((v) => (v === undefined ? null : Number(v)));
    const [reasoning, cached] = [m[7], m[8]].map((v) => (v === undefined ? null : Number(v)));
    if (![attempts, input, output, time, reasoning, cached].every((v) => v === null || Number.isSafeInteger(v))) return null;
    if (reasoning !== null && (output === null || reasoning > output)) return null;
    if (cached !== null && (input === null || cached > input)) return null;
    return { mode: m[1], model: m[2], attempts, in: input, out: output, time };
}

/** The ids of the Bash calls a record makes: each block's type, name and id, and nothing it says. */
function bashCallsOf(record) {
    const content = record.message?.content;
    if (!Array.isArray(content)) return [];
    return content.filter((b) => b !== null && typeof b === "object" && b.type === "tool_use" && b.name === "Bash" && text(b.id) !== null).map((b) => b.id);
}

/** A tool result's output as the host writes it: a string, or text blocks and nothing else. */
function outputOf(content) {
    if (typeof content === "string") return content;
    if (!Array.isArray(content) || !content.length || !content.every((b) => b?.type === "text" && typeof b.text === "string")) return null;
    return content.map((b) => b.text).join("\n");
}

/** The receipts in a user record's tool results, each still to be matched to the Bash call it answers. */
function resultsOf(record) {
    if (record === null || typeof record !== "object" || record.type !== "user" || !Array.isArray(record.message?.content)) return [];
    const at = Date.parse(record.timestamp);
    const found = [];
    for (const block of record.message.content) {
        if (block === null || typeof block !== "object" || block.type !== "tool_result" || text(block.tool_use_id) === null) continue;
        const receipts = (outputOf(block.content) ?? "").split("\n").map(receiptOf).filter((r) => r !== null);
        if (!receipts.length) continue;
        found.push({
            call: block.tool_use_id,
            receipts,
            branch: text(record.gitBranch),
            cwd: text(record.cwd),
            at: Number.isFinite(at) ? at : null,
            sidechain: record.isSidechain === true,
            agent: text(record.agentId),
        });
    }
    return found;
}

export function readLine(line) {
    const usageLike = line.includes('"usage":');
    const boundaryLike = line.includes('"compact_boundary"');
    const resultLike = line.includes('"tool_result"') && line.includes("spend=$0.00");
    if (!usageLike && !boundaryLike && !resultLike) return null;
    let record;
    try {
        record = JSON.parse(line);
    } catch {
        return { malformed: true };
    }
    if (boundaryLike && record?.type === "system" && record.subtype === "compact_boundary") {
        return { boundary: true, sidechain: record.isSidechain === true, agent: text(record.agentId) };
    }
    const request = requestOf(record);
    if (request !== null) {
        const calls = bashCallsOf(record);
        return calls.length ? { request, calls } : { request };
    }
    const results = resultLike ? resultsOf(record) : [];
    return results.length ? { results } : null;
}

/** Claude Code 2.1.280, undocumented: one record per content block, so one request per message id. */
export function readTranscript(file, { end = null } = {}) {
    const bytes = fs.readFileSync(file, end === null ? "utf8" : undefined);
    if (end !== null && (!Number.isSafeInteger(end) || end < 0 || end > bytes.length)) throw new LedgerError("the bounded transcript snapshot changed");
    const source = end === null ? bytes : bytes.subarray(0, end).toString("utf8");
    const byId = new Map();
    const requests = [];
    const tally = { records: 0, duplicates: 0, malformed: 0, synthetic: 0, compactions: 0 };
    let parentCompactions = 0;
    const calls = new Set();
    const receipts = [];
    // Compacted contexts awaiting their next request, by chain, so a subagent's compaction is never the session's.
    const awaiting = new Set();
    for (const line of source.split("\n")) {
        const read = readLine(line);
        if (read === null) continue;
        if (read.malformed) {
            // A torn last line is what a live transcript looks like mid-write; counted, never fatal.
            tally.malformed += 1;
            continue;
        }
        if (read.results) {
            // Only a Bash result is read for the format: an agent's report quoting a receipt is no second one.
            for (const result of read.results) {
                if (!calls.has(result.call)) continue;
                const { call, receipts: lines, ...where } = result;
                lines.forEach((receipt, i) => receipts.push({ key: `${call}#${i}`, ...receipt, ...where }));
            }
            continue;
        }
        if (read.boundary) {
            if (!read.sidechain) parentCompactions += 1;
            tally.compactions += 1;
            awaiting.add(chainOf(read));
            continue;
        }
        const request = read.request;
        for (const id of read.calls ?? []) calls.add(id);
        tally.records += 1;
        if (request.synthetic) {
            tally.synthetic += 1;
            continue;
        }
        const prior = request.id === null ? undefined : byId.get(request.id);
        if (prior !== undefined) {
            // Merge growing block counters; unclassified writes remain the residual of the reported total.
            tally.duplicates += 1;
            for (const c of CLASSES) prior[c] = Math.max(prior[c], request[c]);
            prior.usageMissing &= request.usageMissing;
            prior.writeParts |= request.writeParts;
            prior.usageUnsafe |= request.usageUnsafe;
            if (request.writeTotal !== null) prior.writeTotal = Math.max(prior.writeTotal ?? 0, request.writeTotal);
            if (prior.writeTotal !== null || prior.writeParts === 3) prior.usageMissing &= ~8;
            if (prior.writeTotal !== null) prior.writtenUnknown = Math.max(0, prior.writeTotal - prior.written1h - prior.written5m);
            if (!Number.isSafeInteger(contextOf(prior)) || (prior.writeTotal !== null && prior.written1h + prior.written5m > prior.writeTotal)) prior.usageUnsafe |= 1;
            continue;
        }
        if (request.id !== null) byId.set(request.id, request);
        request.compacted = awaiting.delete(chainOf(request));
        requests.push(request);
    }
    const figures = sessionFigures();
    for (const r of requests) foldCanonical(figures, r);
    figures.compactions = parentCompactions;
    figures.pending = awaiting.has("session");
    return { requests, receipts, figures, ...tally };
}

/** The lifetime a request's writes used, or null where it wrote nothing it named. */
function lifetimeOf(r) {
    if (r.written1h === 0 && r.written5m === 0) return null;
    return r.written1h >= r.written5m ? "1h" : "5m";
}

export function markRebuilds(requests) {
    let lifetime = DEFAULT_LIFETIME;
    for (let i = 0; i < requests.length; i += 1) {
        const r = requests[i];
        r.rebuild = null;
        if (i > 0) {
            const before = requests[i - 1];
            const context = contextOf(r);
            // What it could have read: the prefix left in cache, as far as a context that shrank still carries it.
            const missed = Math.min(contextOf(before), context) - r.read;
            if (missed >= MISS_TOKENS && missed * 100 > context * MISS_PERCENT) {
                const gap = r.at !== null && before.at !== null ? r.at - before.at : null;
                // Unexplained: pruned history, a changed tool list or an eviction, none of which the records name.
                let cause = "unexplained";
                if (r.compacted) cause = "compaction";
                else if (before.model !== null && r.model !== null && before.model !== r.model) cause = "model change";
                else if (before.effort !== null && r.effort !== null && before.effort !== r.effort) cause = "effort change";
                else if (gap !== null && gap > LIFETIME_MS[lifetime]) cause = "lifetime lapsed";
                r.rebuild = { tokens: missed, cause };
            }
        }
        lifetime = lifetimeOf(r) ?? lifetime;
    }
    return requests;
}

/** Hot IDs only; raw streams need canonical confirmation. */
const RECENT = 16;

/** Every field JSON-safe: `./advisory.mjs` keeps these between calls and folds in only the lines since. */
export function sessionFigures() {
    return { compactions: 0, pending: false, fresh: null, freshLifetime: null, lifetime: null, last: null, requests: 0, recent: [] };
}

export function foldFigures(figures, read) {
    if (read.boundary) {
        if (read.sidechain) return figures;
        figures.compactions += 1;
        figures.pending = true;
        return figures;
    }
    const r = read.request;
    if (r === undefined || r.synthetic || r.sidechain) return figures;
    if (r.id !== null && figures.recent.includes(r.id)) return figures;
    return foldUniqueRequest(figures, r);
}

function foldUniqueRequest(figures, r) {
    if (r.id !== null) {
        figures.recent.push(r.id);
        if (figures.recent.length > RECENT) figures.recent.shift();
    }
    figures.requests += 1;
    const context = contextOf(r);
    const lifetime = lifetimeOf(r);
    if (figures.fresh === null || figures.pending) {
        figures.fresh = context;
        figures.freshLifetime = lifetime;
        figures.pending = false;
    }
    figures.last = context;
    if (lifetime !== null) figures.lifetime = lifetime;
    return figures;
}

export function foldCanonical(figures, r) {
    if (r.synthetic || r.sidechain) return figures;
    if (r.compacted) { figures.compactions += 1; figures.pending = true; }
    return foldUniqueRequest(figures, r);
}

/** Each test is the one `./doctor.mjs` applies to the same key, so a manifest `doctor` passes is one these take. */
export const SPEND_FIGURES = {
    read: { holds: (v) => Number.isFinite(v) && v > 0 && v <= 1, is: "a number above 0 and at most 1" },
    write: { holds: (v) => Number.isFinite(v) && v >= 1, is: "a number of at least 1" },
    requests: { holds: (v) => Number.isInteger(v) && v > 0, is: "a positive integer" },
    resume: { holds: (v) => Number.isFinite(v) && v >= 0, is: "a finite nonnegative number of input-equivalent tokens" },
};

/** What a crossed restart threshold does: `"advise"` says the line; `"block"` also holds the turn's end once. */
export const RESTARTS = ["advise", "block"];

export function overflowingWrite({ read, write }) {
    return ["5m", "1h"].find((at) => !Number.isFinite(write[at] / read)) ?? null;
}

/** Each part null where undeclared; throws at the first fault, since no reader may rely on `doctor` having run. */
export function readSpend(value, where) {
    if (value === undefined) return { multipliers: null, horizon: null, restart: null, resume: null };
    const refuse = (what) => new LedgerError(`\`spend\` in ${where} ${what}; ../spec/slots.md gives its shape, and \`doctor\` names every finding`);
    const code = (key) => `\`${key}\``;
    const shaped = (v, at, keys, allRequired) => {
        if (v === null || typeof v !== "object" || Array.isArray(v)) throw refuse(`${at}is not an object`);
        const stray = Object.keys(v).find((key) => !keys.includes(key));
        if (stray !== undefined) throw refuse(`${at}names ${code(stray)}, which is ${keys.length === 1 ? `not ${code(keys[0])}` : `neither ${keys.map(code).join(" nor ")}`}`);
        const missing = allRequired ? keys.find((key) => !Object.hasOwn(v, key)) : undefined;
        if (missing !== undefined) throw refuse(`${at}has no ${code(missing)}, which it needs`);
        return v;
    };
    const figure = (v, at, key, range) => {
        if (!SPEND_FIGURES[range].holds(v)) throw refuse(`${at}sets ${code(key)} to ${JSON.stringify(v)}, which is not ${SPEND_FIGURES[range].is}`);
        return v;
    };
    shaped(value, "", ["multipliers", "horizon", "restart", "resume"], false);
    let multipliers = null;
    if (value.multipliers !== undefined) {
        const m = shaped(value.multipliers, "at `multipliers` ", ["read", "write"], true);
        const read = figure(m.read, "at `multipliers` ", "read", "read");
        const write = shaped(m.write, "at `multipliers.write` ", ["5m", "1h"], true);
        multipliers = { read, write: { "5m": figure(write["5m"], "at `multipliers.write` ", "5m", "write"), "1h": figure(write["1h"], "at `multipliers.write` ", "1h", "write") } };
        const over = overflowingWrite(multipliers);
        if (over !== null) throw refuse(`at \`multipliers\` gives no finite restart threshold, since \`write["${over}"]\` divided by \`read\` overflows`);
    }
    const horizon = value.horizon === undefined ? null : figure(shaped(value.horizon, "at `horizon` ", ["requests"], true).requests, "at `horizon` ", "requests", "requests");
    if (value.restart !== undefined && !RESTARTS.includes(value.restart)) throw refuse(`sets \`restart\` to ${JSON.stringify(value.restart)}, which is neither ${RESTARTS.map((r) => `"${r}"`).join(" nor ")}`);
    const resume = value.resume === undefined ? null : figure(shaped(value.resume, "at `resume` ", ["tokens"], true).tokens, "at `resume` ", "tokens", "resume");
    return { multipliers, horizon, restart: value.restart ?? null, resume };
}

export function multipliers({ declared = null, lifetime = null } = {}) {
    const recorded = lifetime !== null && lifetime in WRITE_BY_LIFETIME;
    const at = recorded ? lifetime : DEFAULT_LIFETIME;
    if (declared !== null) return { read: declared.read, write: declared.write[at], lifetime: at, recorded, source: "declared" };
    return { read: GENERAL_READ, write: WRITE_BY_LIFETIME[at], lifetime: at, recorded, source: "undeclared" };
}

/** Break-even context including additional resume expense; display rounding never decides profitability. */
export function restartThreshold({ fresh, write, read, horizon = HORIZON, resume = 0 }) {
    if (!(fresh > 0 && write > 0 && read > 0 && horizon > 0)) throw new LedgerError("a restart threshold needs a fresh context, both multipliers and a horizon, each above zero");
    if (!SPEND_FIGURES.resume.holds(resume)) throw new LedgerError("resume expense must be finite and nonnegative");
    const reads = horizon * read;
    const expense = fresh * write + resume;
    const threshold = Math.ceil(fresh + expense / reads);
    if (![reads, expense, threshold].every(Number.isFinite)) throw new LedgerError(`the restart threshold ${fresh} × (1 + ${write} / (${horizon} × ${read})) with resume expense ${resume} overflows, so these figures give none`);
    return threshold;
}

export function describeMultipliers(m) {
    const lifetime = m.lifetime === "1h" ? "one-hour" : "five-minute";
    const at = m.recorded ? `the ${lifetime} writes the host recorded` : `a ${lifetime} write, the lifetime the records did not state`;
    if (m.source === "declared") return `multipliers declared: read ${m.read}×, write ${m.write}× (${at})`;
    return `multipliers undeclared: the general read ${m.read}× and the ${m.write}× of ${at}`;
}

export function restartSaving({ fresh, context, horizon, read, write, resume = 0 }) {
    const gross = horizon * read * (context - fresh);
    const written = write * fresh;
    const saving = gross - written - resume;
    if (![gross, written, resume, saving].every(Number.isFinite)) throw new LedgerError("the estimated restart saving overflows, so no comparison is usable");
    // Eight rounding units at the largest operand bound these products and subtractions, without a fixed cost margin.
    const error = Math.max(Math.abs(gross), Math.abs(written), Math.abs(resume)) * Number.EPSILON * 8;
    return Math.abs(saving) <= error ? 0 : saving;
}

/** null with no request yet, or none since the last compaction: the context held is the one it replaced. */
export function figureOf(figures, { declared = null, horizon = null, resume = null } = {}) {
    if (figures.fresh === null || figures.pending || figures.fresh === 0) return null;
    const m = multipliers({ declared, lifetime: figures.freshLifetime ?? figures.lifetime });
    const n = horizon ?? HORIZON;
    const threshold = restartThreshold({ fresh: figures.fresh, write: m.write, read: m.read, horizon: n, resume: resume ?? 0 });
    const saving = restartSaving({ fresh: figures.fresh, context: figures.last, horizon: n, read: m.read, write: m.write, resume: resume ?? 0 });
    return { fresh: figures.fresh, context: figures.last, threshold, horizon: n, horizonDeclared: horizon !== null, resume, saving, multipliers: m, compactions: figures.compactions, requests: figures.requests };
}

export function thresholdFor(transcript, options = {}) {
    const main = transcript.requests?.filter(r => !r.sidechain) ?? [];
    if (!main.length) return figureOf(transcript.figures, options);
    const first = main[Math.max(0, main.findLastIndex(r => r.compacted))], last = main.at(-1);
    if ([first, last].some(inputUnusable)) return { unavailable: "usage" };
    const lifetime = main.findLast(r => lifetimeOf(r) !== null);
    return figureOf({ ...transcript.figures, fresh: contextOf(first), last: contextOf(last), freshLifetime: lifetimeOf(first), lifetime: lifetime ? lifetimeOf(lifetime) : null }, options);
}

function listDir(dir) {
    try {
        return fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
        if (error.code === "ENOENT" || error.code === "ENOTDIR") return [];
        throw new LedgerError(`${dir} could not be read — ${error.code ?? error.message}`);
    }
}

/** Every `agent-*.jsonl` under a session's `subagents/`, at any depth, as the host nests them. */
function subagentFiles(dir) {
    const found = [];
    for (const entry of listDir(dir)) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) found.push(...subagentFiles(full));
        else if (entry.isFile() && /^agent-.+\.jsonl$/.test(entry.name)) found.push(full);
    }
    return found.sort();
}

export function transcriptFiles(projects, roots) {
    const files = [];
    if (fs.existsSync(projects) && !fs.statSync(projects).isDirectory()) throw new LedgerError(`${projects} is not a directory, so no transcript could be read from it`);
    const dirs = listDir(projects)
        .filter((e) => e.isDirectory() && roots.some((root) => mayHold(e.name, root)))
        .map((e) => e.name)
        .sort();
    for (const name of dirs) {
        const dir = path.join(projects, name);
        for (const entry of listDir(dir).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
            if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
            const session = entry.name.slice(0, -".jsonl".length);
            files.push({ file: path.join(dir, entry.name), session, agent: null });
            for (const sub of subagentFiles(path.join(dir, session, "subagents"))) {
                files.push({ file: sub, session, agent: path.basename(sub, ".jsonl").slice("agent-".length) });
            }
        }
    }
    return files;
}

const insideAny = (cwd, roots) => cwd !== null && roots.some((root) => isInside(root, cwd));

/** Rebuilds are marked over each context whole, before a branch is chosen or a copied request passed over. */
export function collect({ projects, roots }) {
    const contexts = [];
    const tally = { files: 0, records: 0, duplicates: 0, malformed: 0, synthetic: 0 };
    const seen = new Set();
    const receipts = [];
    const seenReceipts = new Set();
    for (const entry of transcriptFiles(projects, roots)) {
        let transcript;
        try {
            transcript = readTranscript(entry.file);
        } catch (error) {
            throw new LedgerError(`${entry.file} could not be read — ${error.code ?? error.message}`);
        }
        tally.files += 1;
        for (const k of ["records", "duplicates", "malformed", "synthetic"]) tally[k] += transcript[k];
        // Earlier hosts wrote a subagent's requests inline, as sidechains: each agent id is a context of its own.
        const parts = new Map();
        for (const r of transcript.requests) {
            const agent = entry.agent ?? (r.sidechain ? `inline:${r.agent ?? "unnamed"}` : null);
            if (!parts.has(agent)) parts.set(agent, []);
            parts.get(agent).push(r);
        }
        for (const [agent, requests] of parts) {
            markRebuilds(requests);
            // A request copied into a second transcript counts once, in the first that keeps it.
            const inside = requests.filter((r) => insideAny(r.cwd, roots));
            const kept = inside.filter((r) => r.id === null || !seen.has(r.id));
            for (const r of kept) if (r.id !== null) seen.add(r.id);
            tally.duplicates += inside.length - kept.length;
            if (kept.length) contexts.push({ file: entry.file, session: entry.session, agent, requests: kept, transcript: agent === null ? transcript : null });
        }
        for (const r of transcript.receipts) {
            if (!insideAny(r.cwd, roots) || seenReceipts.has(r.key)) continue;
            seenReceipts.add(r.key);
            receipts.push({ ...r, session: entry.session, agent: entry.agent ?? (r.sidechain ? `inline:${r.agent ?? "unnamed"}` : null) });
        }
    }
    return { contexts, receipts, ...tally };
}

const zero = () => ({ requests: 0, uncached: 0, written1h: 0, written5m: 0, writtenUnknown: 0, read: 0, output: 0 });

export function tally(contexts, branch) {
    const main = zero();
    const subagents = zero();
    const opened = { sessions: new Set(), subagents: 0 };
    const causes = {};
    let compactions = 0;
    let largest = 0;
    let rebuilds = 0;
    let rebuilt = 0;
    for (const c of contexts) {
        const own = c.requests.filter((r) => r.branch === branch);
        if (!own.length) continue;
        const into = c.agent === null ? main : subagents;
        if (c.agent === null) opened.sessions.add(c.session);
        else opened.subagents += 1;
        for (const r of own) {
            into.requests += 1;
            for (const k of CLASSES) into[k] += r[k];
            largest = Math.max(largest, contextOf(r));
            if (r.rebuild) {
                rebuilds += 1;
                rebuilt += r.rebuild.tokens;
                causes[r.rebuild.cause] = (causes[r.rebuild.cause] ?? 0) + 1;
            }
        }
        if (c.agent === null) compactions += own.filter((r) => r.compacted).length;
    }
    const total = zero();
    for (const k of Object.keys(total)) total[k] = main[k] + subagents[k];
    const input = total.uncached + writtenOf(total) + total.read;
    return {
        main,
        subagents,
        total,
        sessions: opened.sessions.size,
        subagentContexts: opened.subagents,
        compactions,
        largest,
        hitRate: input === 0 ? null : total.read / input,
        rebuilds,
        rebuilt,
        causes: Object.fromEntries(Object.entries(causes).sort(([a], [b]) => (a < b ? -1 : 1))),
    };
}

/** What the lines in the receipt format on `branch` say, apart from every host figure: each null where none reported it. */
export function tallyLocal(receipts, branch) {
    const own = receipts.filter((r) => r.branch === branch);
    const figure = (k) => (own.some((r) => r[k] !== null) ? own.reduce((sum, r) => sum + (r[k] ?? 0), 0) : null);
    return {
        receipts: own.length,
        sessions: new Set(own.map((r) => r.session)).size,
        in: figure("in"),
        out: figure("out"),
        time: figure("time"),
        unreported: Object.fromEntries(["in", "out", "time"].map((k) => [k, own.filter((r) => r[k] === null).length])),
    };
}

function sessionTotals(contexts) {
    const by = new Map();
    for (const c of contexts) {
        const t = by.get(c.session) ?? zero();
        for (const r of c.requests) {
            t.requests += 1;
            for (const k of CLASSES) t[k] += r[k];
        }
        by.set(c.session, t);
    }
    return by;
}

/** The `lastTotal*` counters the host saves per project for its last session; nothing else there is read. */
export function hostTotals(config, roots) {
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(config, "utf8"));
    } catch (error) {
        if (error.code === "ENOENT") return [];
        throw new LedgerError(`${config} could not be read as the host's configuration — ${error.code ?? error.message}`);
    }
    const projects = parsed !== null && typeof parsed === "object" && parsed.projects !== null && typeof parsed.projects === "object" ? parsed.projects : {};
    const found = [];
    for (const [cwd, entry] of Object.entries(projects).sort(([a], [b]) => (a < b ? -1 : 1))) {
        if (!insideAny(cwd, roots) || entry === null || typeof entry !== "object") continue;
        const session = text(entry.lastSessionId);
        const fields = ["lastTotalInputTokens", "lastTotalCacheCreationInputTokens", "lastTotalCacheReadInputTokens", "lastTotalOutputTokens"];
        if (session === null || !fields.every((f) => Number.isSafeInteger(entry[f]))) continue;
        found.push({
            cwd,
            session,
            uncached: entry.lastTotalInputTokens,
            written: entry.lastTotalCacheCreationInputTokens,
            read: entry.lastTotalCacheReadInputTokens,
            output: entry.lastTotalOutputTokens,
        });
    }
    return found;
}

/** Each host total beside the ledger's own for the same session, and the difference, ledger less host. */
export function compareHost(contexts, totals) {
    const ours = sessionTotals(contexts);
    return totals
        .filter((h) => ours.has(h.session))
        .map((h) => {
            const t = ours.get(h.session);
            const ledger = { uncached: t.uncached, written: writtenOf(t), read: t.read, output: t.output };
            const difference = Object.fromEntries(Object.keys(ledger).map((k) => [k, ledger[k] - h[k]]));
            return { cwd: h.cwd, session: h.session, ledger, host: { uncached: h.uncached, written: h.written, read: h.read, output: h.output }, difference };
        });
}

function git(repo, args) {
    return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** The main one first; null outside a git repository. */
export function worktrees(repo) {
    let listing;
    try {
        listing = git(repo, ["worktree", "list", "--porcelain"]);
    } catch (error) {
        if (!underGit(repo)) return null;
        throw new LedgerError(`the worktrees of ${repo} could not be listed — ${String(error.stderr ?? "").trim().split("\n")[0] || error.code || error.message}`);
    }
    return listing
        .split("\n")
        .filter((l) => l.startsWith("worktree "))
        .map((l) => l.slice("worktree ".length));
}

/** Whether `dir` or a directory above it holds a `.git`: the directory a repository keeps, or a worktree's file. */
function underGit(dir) {
    for (let at = path.resolve(dir); ; at = path.dirname(at)) {
        if (fs.existsSync(path.join(at, ".git"))) return true;
        if (path.dirname(at) === at) return false;
    }
}

/** Lines added and removed on `branch` since its merge base with `base`, or the reason there is no figure. */
export function linesChanged(repo, branch, base = null) {
    const candidates = base !== null ? [base] : ["origin/HEAD", "origin/main", "main", "origin/master", "master"];
    const resolved = candidates.find((ref) => {
        try {
            git(repo, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
            return true;
        } catch {
            return false;
        }
    });
    if (resolved === undefined) return { why: base !== null ? `${base} does not name a commit here` : `no base found among ${candidates.join(", ")}; name one with --base` };
    try {
        const since = git(repo, ["merge-base", resolved, branch]);
        const stat = git(repo, ["diff", "--shortstat", since, branch]);
        const added = Number(/(\d+) insertion/.exec(stat)?.[1] ?? 0);
        const removed = Number(/(\d+) deletion/.exec(stat)?.[1] ?? 0);
        return { lines: added + removed, base: resolved };
    } catch {
        return { why: `${branch} has no merge base with ${resolved} here` };
    }
}

function latestSession(contexts, branch) {
    let latest = null;
    for (const c of contexts) {
        if (c.agent !== null || c.transcript === null) continue;
        const own = c.requests.filter((r) => r.branch === branch && r.at !== null);
        if (!own.length) continue;
        const at = own.at(-1).at;
        if (latest === null || at > latest.at) latest = { at, context: c };
    }
    return latest?.context ?? null;
}

export function ledger({ projects, config, roots, branch, lines = null, spend = { multipliers: null, horizon: null } }) {
    const collected = collect({ projects, roots });
    const figures = tally(collected.contexts, branch);
    const host = config === null ? [] : compareHost(collected.contexts, hostTotals(config, roots));
    const latest = latestSession(collected.contexts, branch);
    const priced = { declared: spend.multipliers, horizon: spend.horizon ?? null, resume: spend.resume ?? null };
    const last = latest?.transcript.requests.findLast(r => !r.sidechain);
    const restart = latest === null ? null : last?.branch !== branch || !latest.requests.includes(last)
        ? { session: latest.session, unavailable: "branch-scope" }
        : { session: latest.session, ...thresholdFor(latest.transcript, priced) };
    const local = tallyLocal(collected.receipts, branch);
    return { projects, roots, branch, collected, figures, local, host, restart, lines, priced };
}

const signed = (n) => (n > 0 ? `+${grouped(n)}` : n < 0 ? `−${grouped(-n)}` : "0");

const short = (id) => id.slice(0, 8);

function unjudged({ declared, horizon, resume = null } = { declared: null, horizon: null }) {
    const m = declared ?? { read: GENERAL_READ, write: WRITE_BY_LIFETIME };
    return (
        "  restart: no session on this branch has a request with a time to judge; a threshold would take a horizon of " +
        `${horizon ?? HORIZON} requests (${horizon === null ? "default" : "declared"}) and ${declared === null ? "the general multipliers, undeclared" : "the declared multipliers"}: ` +
        `read ${m.read}×, writes ${m.write["5m"]}× for five minutes and ${m.write["1h"]}× for an hour; ${resume === null ? "resume cost unknown" : `resume expense ${resume} input-equivalent tokens`}`
    );
}

function localLine({ local: l, branch }) {
    if (l.receipts === 0) return `  local worker: no line in the runner's receipt format on ${branch} is recorded here`;
    const figure = (k, unit) => {
        if (l[k] === null) return `${k} unreported`;
        return `${k} ${grouped(l[k])} ${unit}${l.unreported[k] ? ` (${grouped(l.unreported[k])} receipt(s) did not report it)` : ""}`;
    };
    return (
        `  local worker: ${grouped(l.receipts)} line(s) in the runner's receipt format, from Bash results in ${grouped(l.sessions)} session(s), at $0.00, none of it in the host's tokens or the restart threshold: ` +
        `${figure("in", "tokens")}, ${figure("out", "tokens")}, ${figure("time", "ms")}`
    );
}

export function print(report, say) {
    const { collected, figures: f, host, restart, lines, priced } = report;
    say(`ledger: branch ${report.branch} — what this change spent, from Claude Code's own usage records (numbers only: nothing a context said is read but a line in the runner's receipt format in a Bash result)`);
    say(`  worktrees: ${report.roots.join(", ")}`);
    say(
        `  read: ${grouped(collected.files)} transcript(s) under ${report.projects}, ${grouped(collected.records)} usage record(s): ` +
            `${grouped(collected.duplicates)} per-block duplicate(s) counted once, ${grouped(collected.synthetic)} host-written record(s) with no request behind them, ` +
            `${grouped(collected.malformed)} line(s) that did not parse`,
    );
    const uncertain = (collected.contexts ?? []).reduce((n, c) => n + c.requests.filter(r => r.usageMissing || r.usageUnsafe).length, 0);
    if (uncertain) say(`  usage: ${grouped(uncertain)} owned request(s) have missing or invalid counters; totals are partial, sanitized zeros are not known observations`);
    if (f.main.requests + f.subagents.requests === 0) {
        say(`  no request on ${report.branch} is recorded here`);
        say(localLine(report));
        say(unjudged(priced));
        return;
    }
    const row = (label, k) => say(`  ${label.padEnd(18)}${grouped(f.main[k]).padStart(14)}${grouped(f.subagents[k]).padStart(14)}${grouped(f.total[k]).padStart(14)}`);
    say(`  ${"".padEnd(18)}${"main".padStart(14)}${"subagents".padStart(14)}${"total".padStart(14)}`);
    row("requests", "requests");
    row("uncached", "uncached");
    row("written, 1h", "written1h");
    row("written, 5m", "written5m");
    row("written, unstated", "writtenUnknown");
    row("read", "read");
    row("output", "output");
    say(localLine(report));
    say(`  contexts opened: ${grouped(f.sessions + f.subagentContexts)} (${grouped(f.sessions)} session(s), ${grouped(f.subagentContexts)} subagent(s)); compactions: ${grouped(f.compactions)}`);
    say(`  largest context: ${grouped(f.largest)} tokens`);
    if (f.hitRate === null) say("  hit rate: none — no input was recorded, so none could be read from cache");
    else say(`  hit rate: ${(f.hitRate * 100).toFixed(1)}% of input read from cache — a hit rate does not bound spend; requests do`);
    const causes = Object.entries(f.causes).map(([cause, n]) => `${grouped(n)} ${cause}`).join(", ");
    say(`  rebuilds: ${grouped(f.rebuilds)}${f.rebuilds ? `, ${grouped(f.rebuilt)} tokens written again (${causes})` : ""}`);
    const processed = f.total.uncached + writtenOf(f.total) + f.total.read + f.total.output;
    if (lines === null) say("  per changed line: not computed for this run");
    else if (lines.why !== undefined) say(`  per changed line: not computed — ${lines.why}`);
    else if (lines.lines === 0) say(`  per changed line: not computed — no line changed since the merge base with ${lines.base}`);
    else say(`  per changed line: ${grouped(Math.round(processed / lines.lines))} tokens processed per line (${grouped(lines.lines)} changed since the merge base with ${lines.base})`);
    if (!host.length) say("  host totals: none recorded for a session read here");
    for (const h of host) {
        const parts = ["uncached", "written", "read", "output"].map((k) => `${k} ${grouped(h.ledger[k])} of ${grouped(h.host[k])} (${signed(h.difference[k])})`);
        say(`  host totals, session ${short(h.session)} (the last the host saved for ${h.cwd}, every branch): ${parts.join(", ")}`);
    }
    if (restart?.unavailable === "branch-scope") {
        say("  restart: comparison unavailable — the latest session's main request is outside this branch's owned scope");
        return;
    }
    if (restart?.unavailable === "usage") {
        say("  restart: comparison unavailable — input usage counters are invalid or incomplete");
        return;
    }
    if (restart === null || restart.threshold === undefined) {
        say(unjudged(priced));
        return;
    }
    const m = restart.multipliers;
    say(
        `  restart: session ${short(restart.session)} is at ${grouped(restart.context)} tokens and ` +
            `${restart.context >= restart.threshold ? "has reached" : "is below"} its threshold of ${grouped(restart.threshold)} = ` +
            `${grouped(restart.fresh)} × (1 + ${m.write} / (${restart.horizon} × ${m.read})) + ${restart.resume ?? 0} / (${restart.horizon} × ${m.read}); ${describeMultipliers(m)}; ` +
            `horizon ${restart.horizon} requests remaining (${restart.horizonDeclared ? "declared" : "default"}); ` +
            `${restart.resume === null ? "resume cost unknown: threshold is a lower bound" : `resume expense ${restart.resume} input-equivalent tokens; estimated saving ${restart.saving}`}`,
    );
}

/** The figures a fixture pins, flat, in the names `fixture.json` spells them. */
export function pinned(report) {
    const f = report.figures;
    const pair = (k) => [f.main[k], f.subagents[k]];
    return {
        records: report.collected.records,
        duplicates: report.collected.duplicates,
        synthetic: report.collected.synthetic,
        malformed: report.collected.malformed,
        requests: pair("requests"),
        uncached: pair("uncached"),
        written1h: pair("written1h"),
        written5m: pair("written5m"),
        writtenUnknown: pair("writtenUnknown"),
        read: pair("read"),
        output: pair("output"),
        sessions: f.sessions,
        subagentContexts: f.subagentContexts,
        compactions: f.compactions,
        largest: f.largest,
        rebuilds: f.rebuilds,
        rebuilt: f.rebuilt,
        causes: f.causes,
        host: report.host.map((h) => ({ session: h.session, difference: h.difference })),
        local: report.local,
        threshold: report.restart?.threshold ?? null,
    };
}

function named(cwd, value, flag, kind) {
    const full = path.resolve(cwd, value);
    let stat;
    try {
        stat = fs.statSync(full);
    } catch (error) {
        throw new LedgerError(`${flag} ${full} could not be read — ${error.code ?? error.message}`);
    }
    if (kind === "directory" ? !stat.isDirectory() : !stat.isFile()) throw new LedgerError(`${flag} ${full} is not a ${kind}, so nothing could be read from it`);
    return full;
}

function workspaceSpend(dir) {
    const file = path.join(dir, "workspace.json");
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
        throw new LedgerError(`--workspace ${file} could not be read as a manifest — ${error.code ?? error.message}`);
    }
    if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) throw new LedgerError(`--workspace ${file} is not a JSON object, so no \`spend\` could be read from it`);
    return readSpend(manifest.spend, file);
}

function parseArgs(argv) {
    const options = { branch: null, repo: null, base: null, projects: null, config: null, workspace: null, fixture: null };
    const flags = { "--branch": "branch", "--repo": "repo", "--base": "base", "--projects": "projects", "--config": "config", "--workspace": "workspace", "--fixture": "fixture" };
    for (let i = 0; i < argv.length; i += 1) {
        const key = flags[argv[i]];
        if (key === undefined) throw new LedgerError(`unknown argument ${JSON.stringify(argv[i])}`);
        const value = argv[i + 1];
        i += 1;
        if (value === undefined || value === "") throw new LedgerError(`${argv[i - 1]} needs a value`);
        if (options[key] !== null) throw new LedgerError(`${argv[i - 1]} is given twice`);
        options[key] = value;
    }
    if (options.fixture !== null && Object.entries(options).some(([k, v]) => k !== "fixture" && v !== null)) {
        throw new LedgerError("--fixture reads the fixture's own records and nothing else, so it takes no other argument");
    }
    return options;
}

function runFixture(dir, say) {
    let spec;
    try {
        spec = JSON.parse(fs.readFileSync(path.join(dir, "fixture.json"), "utf8"));
    } catch (error) {
        throw new LedgerError(`${path.join(dir, "fixture.json")} could not be read — ${error.code ?? error.message}`);
    }
    const roots = Array.isArray(spec?.roots) && spec.roots.length > 0 && spec.roots.every((r) => typeof r === "string" && path.isAbsolute(r));
    const expect = spec?.expect !== null && typeof spec?.expect === "object" && !Array.isArray(spec.expect);
    if (!roots || typeof spec.branch !== "string" || spec.branch === "" || !expect) {
        throw new LedgerError(`${path.join(dir, "fixture.json")} does not carry roots as absolute paths, a branch and the known totals to expect`);
    }
    const report = ledger({ projects: named(dir, "projects", "--fixture", "directory"), config: named(dir, "claude.json", "--fixture", "file"), roots: spec.roots, branch: spec.branch });
    print(report, say);
    const got = pinned(report);
    const wrong = Object.keys({ ...spec.expect, ...got }).filter((k) => JSON.stringify(got[k]) !== JSON.stringify(spec.expect[k]));
    for (const k of wrong) say(`  ✗ fixture: ${k} is ${JSON.stringify(got[k])}, and its known total is ${JSON.stringify(spec.expect[k])}`);
    if (wrong.length) {
        say(`  ✗ fixture: the ledger does not reproduce ${wrong.length} of the fixture's known totals — the reader changed, or the fixture did; a host format change is recorded by a new fixture, dated, never by editing these totals to match`);
        return 1;
    }
    say(`  ok fixture: ${Object.keys(got).length} figures reproduce their known totals, per-block duplicates included`);
    return 0;
}

export function run(argv, say = (line) => process.stdout.write(`${line}\n`), { env = process.env, home = os.homedir(), cwd = process.cwd() } = {}) {
    try {
        const options = parseArgs(argv);
        if (options.fixture !== null) return runFixture(path.resolve(cwd, options.fixture), say);
        const spend = options.workspace === null ? undefined : workspaceSpend(named(cwd, options.workspace, "--workspace", "directory"));
        const host = hostPaths(env, home);
        if (host.why !== undefined && (options.projects === null || options.config === null)) throw new LedgerError(host.why);
        const repo = path.resolve(cwd, options.repo ?? ".");
        const roots = worktrees(repo);
        let branch = options.branch;
        if (branch === null) {
            if (roots === null) throw new LedgerError(`${repo} is not inside a git repository, so name the branch with --branch`);
            branch = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);
        }
        const report = ledger({
            projects: options.projects === null ? host.projects : named(cwd, options.projects, "--projects", "directory"),
            config: options.config === null ? host.config : named(cwd, options.config, "--config", "file"),
            roots: roots ?? [repo],
            branch,
            lines: roots === null ? { why: `${repo} is not inside a git repository` } : linesChanged(repo, branch, options.base),
            spend,
        });
        print(report, say);
        return 0;
    } catch (error) {
        if (!(error instanceof LedgerError)) throw error;
        say(`  ✗ ${error.message}`);
        return 2;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    // `process.exitCode`, not `process.exit`, so a pipe that has not drained is not cut.
    try {
        process.exitCode = run(process.argv.slice(2));
    } catch (cause) {
        process.stderr.write(`ledger: could not run — ${cause?.stack ?? cause}\nThis is a defect in the ledger, not a figure: nothing was measured.\n`);
        process.exitCode = 2;
    }
}
