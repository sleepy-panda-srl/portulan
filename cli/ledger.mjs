#!/usr/bin/env node
// What a change spends, measured — the ledger proposal `0038` names.
//
//   node cli/ledger.mjs [--branch <name>] [--repo <dir>] [--base <ref>] [--projects <dir>] [--config <file>]
//       [--workspace <dir>]
//   node cli/ledger.mjs --fixture <dir>
//
// `0036` prices one context's prefix. Nothing priced how many times it is re-read, how many times it is
// written again, or what a change came to in the end — and the one number a host shows, the hit rate,
// does not bound spend: session length does. This reads the host's own usage records and prints, for one
// change (a branch), what it spent: requests, tokens by class, the contexts it opened, its largest
// context, its hit rate, the rebuilds and what caused each, and tokens per changed line (`0038`, rule 1).
//
// ## Numbers only, local only, and never inside a recipe
//
// It reads each record's usage and the few fields that attribute it — message id, model, effort, branch,
// working directory, time — and nothing a context said: a line is parsed only when it carries a usage
// object or a compaction boundary, and no content field is read, kept or printed. It makes no network
// call. **It never runs inside a recipe** (`0038`, ruling 4): host records differ per machine, so a rail on
// them would be red on one machine and green on the next. What a recipe runs is `--fixture`, which reads
// the committed synthetic records under `./fixtures/ledger/` and nothing of the host's, and fails when
// they no longer reproduce their known totals.
//
// ## The host's format, pinned where it was measured
//
// Claude Code keeps one transcript per session, `<config>/projects/<key>/<session>.jsonl`, and one per
// subagent under `<session>/subagents/`, where `<config>` is `CLAUDE_CONFIG_DIR` or `~/.claude` and `<key>`
// is the session's working directory with every character outside `[a-zA-Z0-9]` replaced by `-`, cut at
// 200 with a hash of the whole path appended past that. The format is **undocumented**: it was read here
// on host version 2.1.280, and the fixture is what turns a change in it into a red rather than a quiet
// move in every figure. **The host writes one record per content block**, each carrying the whole
// request's usage — 59 records for 24 requests when `0038` was drafted, 33 for 17 when this was built —
// so a request is counted once per message id, with each count the largest its records carry.
//
// ## A rebuild, and what caused it
//
// A request is a rebuild when it wrote again at least `MISS_TOKENS`, and more than `MISS_PERCENT` of its
// context, that the request before it had in cache — the threshold the host's own `/usage` uses for a
// miss. The cause is read from the records around it, in this order: a compaction boundary between the
// two, a model change, an effort change, or a gap longer than the lifetime of the writes before it; with
// none of those it is `unexplained`, which is the host pruning history, a tool list changing, or an
// eviction the records do not name.
//
// ## The restart threshold
//
// `C* ≈ F × (1 + m_w / (n × m_r))`, `0038`'s arithmetic: past it, continuing `n` more requests costs more
// in reads than one write of a fresh context `F`. `F` here is the session's first request after its last
// compaction, which is the host's floor and the always tier as the host sent them. It leaves out the
// handoff and what a new session re-reads to orient itself, so the threshold errs toward an earlier line,
// the direction ruling 2 chose to err in for the multipliers; a restart that finds its floor still in the
// directory's shared cache pulls the other way. The multipliers are the manifest's to declare (`0038`,
// ruling 2), and so is the horizon: `spend`, since Workspace Definition 2.12, which `--workspace <dir>` reads
// from `<dir>/workspace.json`, the declared write taken at the lifetime the host recorded. Without the flag,
// or where the manifest declares no `spend`, every figure here says `undeclared` and uses the general ones:
// reads at a tenth of input, and writes at the lifetime the host recorded, 1.25× for five minutes and 2× for
// an hour; and the horizon is 20 requests (ruling 3). `./advisory.mjs` is the one line this threshold feeds,
// with the next tool result or at the next prompt, and in the status line, from the same running figures,
// and it takes the declared ones from the flags `./compile.mjs` writes onto its commands.
//
// Exit 0 a report · 1 `--fixture` only: the fixture no longer reproduces its known totals · 2 could not run:
// an argument, a records directory or file that could not be read, a fixture missing, or a manifest named by
// `--workspace` that could not be read or whose `spend` is refused, or a threshold its figures carry past the
// largest number.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { isInside } from "./inside.mjs";

/** The general read multiplier: `0038`'s cache reads cost *between a fortieth and a tenth*, and the tenth errs early, which ruling 2 found the cheaper way to err. */
export const GENERAL_READ = 0.1;

/** The write multiplier by the cache lifetime the host recorded, from the price list `0038` cites. */
export const WRITE_BY_LIFETIME = { "5m": 1.25, "1h": 2 };

/** A lifetime the records do not state is taken as the API's default, five minutes. */
export const DEFAULT_LIFETIME = "5m";

export const LIFETIME_MS = { "5m": 5 * 60 * 1000, "1h": 60 * 60 * 1000 };

/** Requests still to go when the threshold is judged — `0038`'s ruling 3, where the manifest's `spend.horizon` declares no other. */
export const HORIZON = 20;

/** A rebuild wrote again at least this many tokens the request before it had in cache… */
export const MISS_TOKENS = 2000;

/** …and more than this share of its context: the host's own definition of a miss. */
export const MISS_PERCENT = 5;

/** Where the host cuts a project key and appends a hash of the whole path. */
export const KEY_LIMIT = 200;

/** The classes a request is billed in, in the order a report prints them. */
export const CLASSES = ["uncached", "written1h", "written5m", "writtenUnknown", "read", "output"];

export class LedgerError extends Error {
    constructor(message) {
        super(message);
        this.name = "LedgerError";
    }
}

const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const count = (v) => (Number.isSafeInteger(v) && v > 0 ? v : 0);

const text = (v) => (typeof v === "string" && v !== "" ? v : null);

/**
 * The host's configuration home, its transcripts, and the file holding its own per-project totals, or why
 * there is no default. The host takes a relative `CLAUDE_CONFIG_DIR` as it stands, so from the directory
 * it was started in, which a later reader cannot know: that is a reason to name both paths, never a
 * reason to read `~/.claude` in its place.
 */
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

/**
 * Could this project directory hold sessions started in `root` or below it? A pre-filter only: the key
 * of `/work/demo` is a prefix of `/work/demo-old`'s too, so what decides is each record's own `cwd`.
 */
export function mayHold(name, root) {
    const key = root.replace(/[^a-zA-Z0-9]/g, "-");
    const stem = key.length <= KEY_LIMIT ? key : key.slice(0, KEY_LIMIT);
    return name === projectKey(root) || name.startsWith(`${stem}-`);
}

/** One request from one record, or null for a record that is not an API response with usage. */
function requestOf(record) {
    if (record === null || typeof record !== "object" || record.type !== "assistant") return null;
    const message = record.message;
    if (message === null || typeof message !== "object") return null;
    const usage = message.usage;
    if (usage === null || typeof usage !== "object") return null;
    // The host writes records of its own under this model — an interruption, an API error — and no
    // request stands behind them.
    if (message.model === "<synthetic>") return { synthetic: true };
    const lifetimes = usage.cache_creation !== null && typeof usage.cache_creation === "object" ? usage.cache_creation : {};
    const written1h = count(lifetimes.ephemeral_1h_input_tokens);
    const written5m = count(lifetimes.ephemeral_5m_input_tokens);
    const at = Date.parse(record.timestamp);
    return {
        id: text(message.id) ?? text(record.requestId) ?? text(record.uuid),
        model: text(message.model),
        effort: text(record.effort),
        branch: text(record.gitBranch),
        cwd: text(record.cwd),
        at: Number.isFinite(at) ? at : null,
        sidechain: record.isSidechain === true,
        agent: text(record.agentId),
        uncached: count(usage.input_tokens),
        written1h,
        written5m,
        writtenUnknown: Math.max(0, count(usage.cache_creation_input_tokens) - written1h - written5m),
        read: count(usage.cache_read_input_tokens),
        output: count(usage.output_tokens),
    };
}

export const contextOf = (r) => r.uncached + r.written1h + r.written5m + r.writtenUnknown + r.read;

const writtenOf = (r) => r.written1h + r.written5m + r.writtenUnknown;

/** The context a record belongs to: the session's own, or a subagent's, by its id. */
const chainOf = (r) => (r.sidechain ? `agent:${r.agent ?? ""}` : "session");

/**
 * What one line of a transcript is to the ledger: `{ request }`, `{ boundary: true, sidechain, agent }` for
 * a compaction boundary and the context it compacted, `{ malformed: true }` for a line that does not parse,
 * or null for anything else. A line is parsed only when it carries a usage object's key or the boundary's
 * subtype, and a match inside content is escaped there, so a prompt quoting either is passed over once
 * parsed.
 */
export function readLine(line) {
    const usageLike = line.includes('"usage":');
    const boundaryLike = line.includes('"compact_boundary"');
    if (!usageLike && !boundaryLike) return null;
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
    return request === null ? null : { request };
}

/**
 * Read one transcript: its requests in the order the host wrote them, one per message id, each marked
 * `compacted` where a compaction boundary comes before it, and the session's running `figures`. Throws
 * what `fs` throws; the caller decides what an unreadable transcript means.
 */
export function readTranscript(file) {
    const source = fs.readFileSync(file, "utf8");
    const byId = new Map();
    const requests = [];
    const tally = { records: 0, duplicates: 0, malformed: 0, synthetic: 0, compactions: 0 };
    const figures = sessionFigures();
    // The contexts a boundary has compacted and no request has run in since. A subagent's own transcript
    // writes every record as a sidechain, its boundaries too, so a boundary marks the next request of its
    // own context: a subagent's compaction is never the session's.
    const awaiting = new Set();
    for (const line of source.split("\n")) {
        const read = readLine(line);
        if (read === null) continue;
        if (read.malformed) {
            // A torn last line is what a live transcript looks like mid-write; counted, never fatal.
            tally.malformed += 1;
            continue;
        }
        foldFigures(figures, read);
        if (read.boundary) {
            tally.compactions += 1;
            awaiting.add(chainOf(read));
            continue;
        }
        const request = read.request;
        tally.records += 1;
        if (request.synthetic) {
            tally.synthetic += 1;
            continue;
        }
        const prior = request.id === null ? undefined : byId.get(request.id);
        if (prior !== undefined) {
            // One request, written again for its next content block. The input side repeats; the output
            // count may have grown, so each class keeps the largest any of its records carried.
            tally.duplicates += 1;
            for (const c of CLASSES) prior[c] = Math.max(prior[c], request[c]);
            continue;
        }
        if (request.id !== null) byId.set(request.id, request);
        request.compacted = awaiting.delete(chainOf(request));
        requests.push(request);
    }
    return { requests, figures, ...tally };
}

/** The lifetime a request's writes used, or null where it wrote nothing it named. */
function lifetimeOf(r) {
    if (r.written1h === 0 && r.written5m === 0) return null;
    return r.written1h >= r.written5m ? "1h" : "5m";
}

/** Mark every rebuild in one context's requests, in place, with the tokens written again and its cause. */
export function markRebuilds(requests) {
    let lifetime = DEFAULT_LIFETIME;
    for (let i = 0; i < requests.length; i += 1) {
        const r = requests[i];
        r.rebuild = null;
        if (i > 0) {
            const before = requests[i - 1];
            const context = contextOf(r);
            // What this request could have read: the prefix the request before it left in cache, as far
            // as this request still carries it. A context that shrank carries less of it.
            const missed = Math.min(contextOf(before), context) - r.read;
            if (missed >= MISS_TOKENS && missed * 100 > context * MISS_PERCENT) {
                const gap = r.at !== null && before.at !== null ? r.at - before.at : null;
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

/** How many of a session's latest request ids its running figures remember, to pass over their repeats. */
const RECENT = 16;

/**
 * The running figures one session's restart threshold is computed from: its compactions, whether the
 * last has no request after it yet, the fresh context and its write lifetime, the latest lifetime named,
 * the latest context, and the ids of its latest requests; and how many requests the session has made,
 * compactions or not, which the advisory reports beside the threshold (`0038`, rule 1: a change is priced
 * by its requests, and every request re-reads the context). **One fold, two readers**: `readTranscript`
 * folds a whole transcript into them, and `./advisory.mjs` keeps them between calls and folds in only
 * the lines a transcript gained since, so what the advisory says and what the ledger prints cannot part.
 * Every field is a number, a string, a boolean or null, so they survive a round trip through JSON.
 */
export function sessionFigures() {
    return { compactions: 0, pending: false, fresh: null, freshLifetime: null, lifetime: null, last: null, requests: 0, recent: [] };
}

/**
 * Fold one read line into a session's running figures, in place. A subagent's request or compaction
 * written inline is not the session's context, and a request's next content block repeats its input
 * counts, so a repeat of one of the latest ids is passed over: the host writes a request's blocks one
 * after another.
 */
export function foldFigures(figures, read) {
    if (read.boundary) {
        if (read.sidechain) return figures;
        figures.compactions += 1;
        figures.pending = true;
        return figures;
    }
    const r = read.request;
    if (r === undefined || r.synthetic || r.sidechain) return figures;
    if (r.id !== null) {
        if (figures.recent.includes(r.id)) return figures;
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

/**
 * What each figure of a workspace's `spend` may be (Workspace Definition 2.12, `0038`'s ruling 2): a cache
 * read costs more than nothing, since the threshold divides by it, and at most an uncached input token; a
 * cache write costs at least one; and the horizon is a whole number of requests. One table, read by
 * `readSpend` here and by `./advisory.mjs`, which takes the same figures back from the flags `./compile.mjs`
 * writes onto its commands. Each test is the one `./doctor.mjs` applies to the same key, the horizon's
 * included, which is `Number.isInteger` there as for every positive integer it checks, so a manifest
 * `doctor` passes is one these readers take.
 */
export const SPEND_FIGURES = {
    read: { holds: (v) => Number.isFinite(v) && v > 0 && v <= 1, is: "a number above 0 and at most 1" },
    write: { holds: (v) => Number.isFinite(v) && v >= 1, is: "a number of at least 1" },
    requests: { holds: (v) => Number.isInteger(v) && v > 0, is: "a positive integer" },
};

/**
 * The write, `"5m"` or `"1h"`, that the read divides past the largest number, or null. The restart threshold
 * divides each write by the horizon times the read, so figures each in its range can still give no threshold:
 * a read near zero under a write near the largest number overflows to Infinity, a line no session reaches. A
 * horizon is at least 1, so a write the read divides finitely gives a finite quotient at every horizon.
 */
export function overflowingWrite({ read, write }) {
    return ["5m", "1h"].find((at) => !Number.isFinite(write[at] / read)) ?? null;
}

/**
 * A manifest's `spend`, read: `{ multipliers, horizon }`, each null where its half is undeclared, and both
 * null where `spend` is. `where` names the manifest in a refusal. **Refused at the first fault, in any shape
 * the schema refuses, any figure out of its range, or a pair that gives no finite threshold**, because every
 * threshold the ledger prints and the advisory says is priced by it, and neither reader may depend on
 * `doctor` having been run: `./compile.mjs` writes what this returns into the settings the host reads, and
 * `--workspace` prints by it.
 */
export function readSpend(value, where) {
    if (value === undefined) return { multipliers: null, horizon: null };
    const refuse = (what) => new LedgerError(`\`spend\` in ${where} ${what}; ../spec/slots.md gives its shape, and \`doctor\` names every finding`);
    const code = (key) => `\`${key}\``;
    // An object of `keys` and no other, holding every one of them where `whole` says it must.
    const shaped = (v, at, keys, whole) => {
        if (v === null || typeof v !== "object" || Array.isArray(v)) throw refuse(`${at}is not an object`);
        const stray = Object.keys(v).find((key) => !keys.includes(key));
        if (stray !== undefined) throw refuse(`${at}names ${code(stray)}, which is ${keys.length === 1 ? `not ${code(keys[0])}` : `neither ${keys.map(code).join(" nor ")}`}`);
        const missing = whole ? keys.find((key) => !Object.hasOwn(v, key)) : undefined;
        if (missing !== undefined) throw refuse(`${at}has no ${code(missing)}, which it needs`);
        return v;
    };
    const figure = (v, at, key, range) => {
        if (!SPEND_FIGURES[range].holds(v)) throw refuse(`${at}sets ${code(key)} to ${JSON.stringify(v)}, which is not ${SPEND_FIGURES[range].is}`);
        return v;
    };
    shaped(value, "", ["multipliers", "horizon"], false);
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
    return { multipliers, horizon };
}

/**
 * The multipliers a threshold is computed at, and where each came from. Declared or general, the write is
 * the one for the lifetime the host recorded, else the default's: a declaration prices both lifetimes, and
 * the records say which one the fresh context was written at.
 */
export function multipliers({ declared = null, lifetime = null } = {}) {
    const recorded = lifetime !== null && lifetime in WRITE_BY_LIFETIME;
    const at = recorded ? lifetime : DEFAULT_LIFETIME;
    if (declared !== null) return { read: declared.read, write: declared.write[at], lifetime: at, recorded, source: "declared" };
    return { read: GENERAL_READ, write: WRITE_BY_LIFETIME[at], lifetime: at, recorded, source: "undeclared" };
}

/** `C* ≈ F × (1 + m_w / (n × m_r))`, in whole tokens. */
export function restartThreshold({ fresh, write, read, horizon = HORIZON }) {
    if (!(fresh > 0 && write > 0 && read > 0 && horizon > 0)) throw new LedgerError("a restart threshold needs a fresh context, both multipliers and a horizon, each above zero");
    const threshold = Math.round(fresh * (1 + write / (horizon * read)));
    // Figures a declaration may hold can still overflow with a fresh context, and a line at Infinity is none.
    if (!Number.isFinite(threshold)) throw new LedgerError(`the restart threshold ${fresh} × (1 + ${write} / (${horizon} × ${read})) overflows, so these multipliers give none`);
    return threshold;
}

/** The words that say which multipliers a figure assumed, and which lifetime its write was taken at. */
export function describeMultipliers(m) {
    const lifetime = m.lifetime === "1h" ? "one-hour" : "five-minute";
    const at = m.recorded ? `the ${lifetime} writes the host recorded` : `a ${lifetime} write, the lifetime the records did not state`;
    if (m.source === "declared") return `multipliers declared: read ${m.read}×, write ${m.write}× (${at})`;
    return `multipliers undeclared: the general read ${m.read}× and the ${m.write}× of ${at}`;
}

/**
 * The threshold a session's running figures give, or null where no request is recorded yet, or none since
 * its last compaction: until then the context the figures hold is the one the compaction replaced.
 */
export function figureOf(figures, { declared = null, horizon = HORIZON } = {}) {
    if (figures.fresh === null || figures.pending || figures.fresh === 0) return null;
    const m = multipliers({ declared, lifetime: figures.freshLifetime ?? figures.lifetime });
    const threshold = restartThreshold({ fresh: figures.fresh, write: m.write, read: m.read, horizon });
    return { fresh: figures.fresh, context: figures.last, threshold, horizon, multipliers: m, compactions: figures.compactions, requests: figures.requests };
}

/** The threshold for one read transcript, or null where it has none yet. */
export function thresholdFor(transcript, options = {}) {
    return figureOf(transcript.figures, options);
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

/** The transcripts that may hold sessions run in any of `roots`: each session's, then its subagents'. */
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

/**
 * Read every transcript that may hold sessions run in `roots`, and keep the requests whose own working
 * directory is inside one of them. Each context's rebuilds are marked over all its requests, before any
 * branch is chosen, so a rebuild at a branch switch lands on the branch it happened on, and before any
 * copy is passed over, so the request after a copied one is judged against the prefix it continued from.
 */
export function collect({ projects, roots }) {
    const contexts = [];
    const tally = { files: 0, records: 0, duplicates: 0, malformed: 0, synthetic: 0 };
    const seen = new Set();
    for (const entry of transcriptFiles(projects, roots)) {
        let transcript;
        try {
            transcript = readTranscript(entry.file);
        } catch (error) {
            throw new LedgerError(`${entry.file} could not be read — ${error.code ?? error.message}`);
        }
        tally.files += 1;
        for (const k of ["records", "duplicates", "malformed", "synthetic"]) tally[k] += transcript[k];
        // A subagent's own transcript is its context whole. In a session's, a sidechain written inline,
        // as earlier hosts did, is a subagent's context and not the session's, one per agent id.
        const parts = new Map();
        for (const r of transcript.requests) {
            const agent = entry.agent ?? (r.sidechain ? `inline:${r.agent ?? "unnamed"}` : null);
            if (!parts.has(agent)) parts.set(agent, []);
            parts.get(agent).push(r);
        }
        for (const [agent, requests] of parts) {
            markRebuilds(requests);
            // A request copied into a second transcript is still one request, counted in the first that
            // keeps it. A copy outside the roots is not kept, so it passes over no copy inside them.
            const inside = requests.filter((r) => insideAny(r.cwd, roots));
            const kept = inside.filter((r) => r.id === null || !seen.has(r.id));
            for (const r of kept) if (r.id !== null) seen.add(r.id);
            tally.duplicates += inside.length - kept.length;
            if (kept.length) contexts.push({ file: entry.file, session: entry.session, agent, requests: kept, transcript: agent === null ? transcript : null });
        }
    }
    return { contexts, ...tally };
}

const zero = () => ({ requests: 0, uncached: 0, written1h: 0, written5m: 0, writtenUnknown: 0, read: 0, output: 0 });

/** What one branch spent, main sessions and subagents apart. */
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

/** Every session's totals, main and subagents together and every branch, for the host-totals comparison. */
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

/**
 * The host's own totals for the last session it ran in each root: the `lastTotal*` counters it saves per
 * project in its global configuration. Numbers and the session id only; nothing else there is read.
 */
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

/**
 * The repository's worktrees, the main one first; null where `repo` is not inside a git repository, which
 * is where no `.git` is in it or above it. Where one is and git cannot list them, the run cannot either: a
 * report of the one directory would read as the whole repository's.
 */
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

/** The latest main session on the branch, by the time of its last request. */
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

/**
 * The whole report for one branch, as figures; `print` turns it into lines. `spend` is what `readSpend`
 * gives, and every threshold the report computes is priced by it.
 */
export function ledger({ projects, config, roots, branch, lines = null, spend = { multipliers: null, horizon: null } }) {
    const collected = collect({ projects, roots });
    const figures = tally(collected.contexts, branch);
    const host = config === null ? [] : compareHost(collected.contexts, hostTotals(config, roots));
    const latest = latestSession(collected.contexts, branch);
    const priced = { declared: spend.multipliers, horizon: spend.horizon ?? HORIZON };
    const restart = latest === null ? null : { session: latest.session, ...thresholdFor(latest.transcript, priced) };
    return { projects, roots, branch, collected, figures, host, restart, lines, priced };
}

const signed = (n) => (n > 0 ? `+${grouped(n)}` : n < 0 ? `−${grouped(-n)}` : "0");

const short = (id) => id.slice(0, 8);

/**
 * The restart line of a report with no threshold to judge. It still says the horizon and the multipliers a
 * threshold would take, so a declaration `--workspace` read is said where no request is recorded.
 */
function unjudged({ declared, horizon } = { declared: null, horizon: HORIZON }) {
    const m = declared ?? { read: GENERAL_READ, write: WRITE_BY_LIFETIME };
    return (
        "  restart: no session on this branch has a request with a time to judge; a threshold would take a horizon of " +
        `${horizon} requests and ${declared === null ? "the general multipliers, undeclared" : "the declared multipliers"}: ` +
        `read ${m.read}×, writes ${m.write["5m"]}× for five minutes and ${m.write["1h"]}× for an hour`
    );
}

export function print(report, say) {
    const { collected, figures: f, host, restart, lines, priced } = report;
    say(`ledger: branch ${report.branch} — what this change spent, from Claude Code's own usage records (numbers only: nothing a context said is read)`);
    say(`  worktrees: ${report.roots.join(", ")}`);
    say(
        `  read: ${grouped(collected.files)} transcript(s) under ${report.projects}, ${grouped(collected.records)} usage record(s): ` +
            `${grouped(collected.duplicates)} per-block duplicate(s) counted once, ${grouped(collected.synthetic)} host-written record(s) with no request behind them, ` +
            `${grouped(collected.malformed)} line(s) that did not parse`,
    );
    if (f.main.requests + f.subagents.requests === 0) {
        say(`  no request on ${report.branch} is recorded here`);
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
    if (restart === null || restart.threshold === undefined) {
        say(unjudged(priced));
        return;
    }
    const m = restart.multipliers;
    say(
        `  restart: session ${short(restart.session)} is at ${grouped(restart.context)} tokens and ` +
            `${restart.context >= restart.threshold ? "has reached" : "is below"} its threshold of ${grouped(restart.threshold)} = ` +
            `${grouped(restart.fresh)} × (1 + ${m.write} / (${restart.horizon} × ${m.read})); ${describeMultipliers(m)}`,
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
        threshold: report.restart?.threshold ?? null,
    };
}

/**
 * A path the person named, which must be what it is named as. The host's own defaults may be absent — a
 * machine where the host never ran has no records, and that is a report of none — but a named directory
 * that is missing or a file would read as "0 transcripts" about a place nothing was read from.
 */
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

/**
 * The `spend` of the manifest in a directory `--workspace` names. A manifest that cannot be read or parsed
 * is could-not-run, as a named records directory that is not one is: read as declaring nothing, every
 * figure would say `undeclared` of a workspace that may declare them.
 */
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

/** Run the fixture: its records, its config, its roots and branch, and the known totals it carries. */
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
    // The fixture names its records and its totals file by being a fixture, so either missing is
    // could-not-run: read as none, it would say the reader no longer reproduces totals nothing was read for.
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
        // Before any record is read, so a refused declaration costs no walk of the host's transcripts.
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
    // 1 is `--fixture`'s verdict, so anything unhandled is 2: a crash is a defect in the ledger, never a
    // figure. `process.exitCode`, not `process.exit`, so a pipe that has not drained is not cut.
    try {
        process.exitCode = run(process.argv.slice(2));
    } catch (cause) {
        process.stderr.write(`ledger: could not run — ${cause?.stack ?? cause}\nThis is a defect in the ledger, not a figure: nothing was measured.\n`);
        process.exitCode = 2;
    }
}
