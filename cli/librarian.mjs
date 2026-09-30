#!/usr/bin/env node
// `librarian` — the scheduled pass over the curated layer: reindex, staleness, nags, demotion drafts.
//
//   node cli/librarian.mjs [--as-of YYYY-MM-DD] [--since YYYY-MM-DD] [--write] [--report <path>] [--reviews <path>] <workspace-dir> [...]
//
// `--write` regenerates a drifted index, the pass's only write to the tree; `--report` writes the report as
// Markdown, never inside a workspace named or a tree one declares.
//
// Exit 0 the pass ran and recorded what it found · 2 it could not run. No 1: a stale record is a nag, not a red.
//
// Everything it emits is a literal in this file or derived from the tree, never prose composed at run time:
// that is what makes its report safe to file unattended.
//
// Observation procedure: two runs on an unchanged store with one `--as-of` give byte-identical reports; at
// 1-day thresholds all three nags fire; a shallow clone, a `0` threshold and a directory git never saw exit 2;
// an uncommitted record is reported undated and never stale.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { inspect as inspectIndex, IndexError, recordType, dateOf, isInside } from "./index.mjs";
import { parseProvenance } from "./doctor.mjs";

/** Raised when the pass cannot run, or cannot report honestly. Always exit 2. */
export class LibrarianError extends Error {
    constructor(message) {
        super(message);
        this.name = "LibrarianError";
    }
}

const KNOWN_SPECS = new Set(["2.0", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "2.11", "2.12", "2.13"]);

const NOT_A_RECORD = new Set(["README.md"]);

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------- Dates

function parseDate(value, where) {
    if (typeof value !== "string" || !ISO.test(value)) {
        throw new LibrarianError(`${where} is ${JSON.stringify(value)}, which is not a YYYY-MM-DD date`);
    }
    const ms = Date.parse(`${value}T00:00:00Z`);
    // Round-tripped: `Date.parse` rolls some impossible dates forward, `2026-02-31` into March.
    if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== value) {
        throw new LibrarianError(`${where} is ${JSON.stringify(value)}, which is not a real date`);
    }
    return ms;
}

/** Whole days from `from` to `to`, negative when `from` is later: never clamped, so a future date shows. */
export function daysBetween(from, to) {
    const a = parseDate(from, "the earlier date");
    const b = parseDate(to, "the later date");
    return Math.round((b - a) / 86_400_000);
}

// ---------------------------------------------------------------- Reading a record

/** A rule's sealed stamp as `{ owner, date }`, or null where there is nobody to nag. */
export function sealedStamp(source) {
    if (recordType(source) !== "rule") return null;
    const { fields } = parseProvenance(source);
    if (!fields || fields.form !== "sealed") return null;
    if (!fields.date) {
        throw new LibrarianError(
            "a sealed rule carries no `date=` in its provenance stamp, so its re-validation cannot be dated. " +
                "`doctor` fails this shape at the schema; refusing rather than passing over the record the nag exists for",
        );
    }
    parseDate(fields.date, "a sealed stamp's `date=`");
    return { owner: fields.owner ?? "", date: fields.date };
}

export function retireWhen(source) {
    const lines = source.split("\n");
    const start = lines.findIndex((l) => /^\s*\*\*retire when:\*\*/i.test(l));
    if (start === -1) return null;
    let end = start;
    while (end + 1 < lines.length && lines[end + 1].trim() !== "") end += 1;
    return lines
        .slice(start, end + 1)
        .join(" ")
        .replace(/^\s*\*\*retire when:\*\*\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

/** Whether a proposal still waits on the human gate: anything short of a stated verdict does, as this feeds a nag, never a gate. */
export function proposalPending(source) {
    const lines = source.split("\n");
    const parts = [];
    for (let i = 0; i < lines.length; i += 1) {
        if (!/^\s*\*\*(decision|status)\b/i.test(lines[i])) continue;
        let end = i;
        while (end + 1 < lines.length && lines[end + 1].trim() !== "") end += 1;
        parts.push(lines.slice(i, end + 1).join(" "));
        i = end;
    }
    if (!parts.length) return true;
    const text = parts.join(" ").replace(/[*_`]/g, "");
    if (/\bpending\b/i.test(text)) return true;
    if (/[{}]|\|/.test(text)) return true; // an unfilled template line is not a decision
    return !/\b(accepted|rejected|revised|applied|withdrawn|superseded)\b/i.test(text);
}

// ---------------------------------------------------------------- Reading history

function git(root, args, what) {
    try {
        return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    } catch (cause) {
        throw new LibrarianError(`git could not ${what} — ${cause.stderr?.toString().trim() || cause.message}`);
    }
}

function historyRoot(dir) {
    const root = git(dir, ["rev-parse", "--show-toplevel"], `find a git repository at ${dir}`);
    // `actions/checkout` clones shallow by default: this is the normal clone, not a theoretical one.
    if (git(root, ["rev-parse", "--is-shallow-repository"], "test for a shallow repository") === "true") {
        throw new LibrarianError(
            "this is a shallow clone, where a file's history may be truncated away entirely — every record " +
                "would read as undated and every threshold would fire or none would. Check out with full history " +
                "(`fetch-depth: 0`) before asking this pass to date anything",
        );
    }
    return root;
}

/** `relative`'s last author date, or null where HEAD lacks it, staged or not: a new file, age 0. */
function lastTouched(root, relative) {
    // The author date: a rebase rewrites committer dates and keeps author dates.
    const out = git(root, ["log", "-1", "--format=%as", "--", relative], `date ${relative}`);
    if (ISO.test(out)) return out;

    try {
        git(root, ["cat-file", "-e", `HEAD:${relative}`], `look ${relative} up in HEAD`);
    } catch {
        return null;
    }
    throw new LibrarianError(
        `${relative} is committed and git returned no date for it, so this pass cannot say how old it is. ` +
            "A shallow clone is already refused above, so this is something else about the checkout — and either way it is not a fact about the store",
    );
}

// ---------------------------------------------------------------- The pass

function threshold(value, where, noun = "threshold", off = "nag") {
    if (value === undefined) return undefined;
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
        throw new LibrarianError(
            `${where} is ${JSON.stringify(value)}, which is not a positive integer. A ${noun} that is zero, ` +
                `negative or non-numeric would read as undeclared and switch the ${off} off in the key that exists to switch it on`,
        );
    }
    return value;
}

const budget = (workspace, group, key) =>
    threshold(workspace.memory?.[group]?.budget?.[key], `memory.${group}.budget.${key}`, "budget", "rail");

const listMarkdown = (dir) => {
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (cause) {
        throw new LibrarianError(`cannot read ${dir} — ${cause.code ?? cause.message}`);
    }
    return names.filter((n) => n.endsWith(".md") && !NOT_A_RECORD.has(n)).sort();
};

/** One workspace's pass, which never writes: `run` does, after it. */
export function passWorkspace(dir, { asOf, reviews, since } = {}) {
    parseDate(asOf, "--as-of");
    if (since !== undefined) parseDate(since, "--since");

    const manifestPath = path.join(dir, "workspace.json");
    let workspace;
    try {
        workspace = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (cause) {
        throw new LibrarianError(`cannot read ${manifestPath} — ${cause.message}`);
    }

    const spec = workspace?.portulan?.spec;
    if (!KNOWN_SPECS.has(String(spec))) {
        throw new LibrarianError(
            `${dir} declares Workspace Definition ${JSON.stringify(spec)}, which this tool does not implement ` +
                `(knows: ${[...KNOWN_SPECS].join(", ")}). Refusing rather than reporting on a manifest it may misread`,
        );
    }

    const name = workspace.name ?? dir;
    if (!workspace.librarian) return { dir, name, declared: false };

    const staleness = workspace.librarian.staleness ?? {};
    const thresholds = {
        record_days: threshold(staleness.record_days, "librarian.staleness.record_days"),
        sealed_days: threshold(staleness.sealed_days, "librarian.staleness.sealed_days"),
        proposal_days: threshold(staleness.proposal_days, "librarian.staleness.proposal_days"),
    };

    const memorySlot = workspace.slots?.memory;
    if (!memorySlot) {
        throw new LibrarianError(
            `${dir} declares a \`librarian\` pass and no \`slots.memory\` store — there is nothing to age. ` +
                "The declared JSON Schema subset has no `dependentRequired` (spec/README.md), so this is checked here and by `doctor`",
        );
    }

    const root = historyRoot(dir);
    // `--show-toplevel` answers a resolved path, so this one is resolved too: on macOS every temporary directory is under the link `/var`.
    const rel = (p) => path.relative(root, fs.realpathSync(p)).split(path.sep).join("/");

    // ---- reindex, read only
    // `inspect` in write mode regenerates before it compares, so it would never report drift.
    let index = { declared: false, drifted: false, series: {}, findings: [], notes: [] };
    try {
        const result = inspectIndex(dir, { write: false });
        const of = (which) => ({
            declared: result.series[which].path !== null,
            drifted: result.findings.some((f) => f.check === "index" && f.series === which),
        });
        index = {
            declared: result.declared,
            drifted: result.findings.some((f) => f.check === "index"),
            series: { memory: of("memory"), handoffs: of("handoffs") },
            expected: result.series.memory.expected,
            findings: result.findings.map((f) => f.message),
            notes: result.notes.map((n) => n.message),
        };
    } catch (cause) {
        if (!(cause instanceof IndexError)) throw cause;
        throw new LibrarianError(`the reindex could not run — ${cause.message}`);
    }

    // ---- the store, dated
    const storeDir = path.resolve(dir, memorySlot);
    const counts = { records: 0, rules: 0, sealed: 0, bytes: 0, uncommitted: 0, largest: { file: null, bytes: 0 } };
    const records = [];
    const seals = [];
    const drafts = [];
    // The store and the proposals, never the handoffs: one handoff naming another traces no rule to its incident.
    const curated = [];
    const byIncident = new Map();

    for (const file of listMarkdown(storeDir)) {
        const full = path.join(storeDir, file);
        let source;
        try {
            source = fs.readFileSync(full, "utf8");
        } catch (cause) {
            throw new LibrarianError(`cannot read the record ${path.join(memorySlot, file)} — ${cause.code ?? cause.message}`);
        }
        curated.push(source);
        const incident = provenanceHref(source);
        if (incident) byIncident.set(incident, [...(byIncident.get(incident) ?? []), file]);

        const touched = lastTouched(root, rel(full));
        const days = touched === null ? 0 : daysBetween(touched, asOf);
        const type = recordType(source) || "untyped";
        const condition = retireWhen(source);

        counts.records += 1;
        const recordBytes = Buffer.byteLength(source);
        counts.bytes += recordBytes;
        if (counts.largest.file === null || recordBytes > counts.largest.bytes) {
            counts.largest = { file, bytes: recordBytes };
        }
        if (touched === null) counts.uncommitted += 1;
        if (type === "rule") counts.rules += 1;

        const record = { file, type, lastTouched: touched, days, condition };
        records.push(record);

        const stamp = sealedStamp(source);
        if (stamp) {
            counts.sealed += 1;
            const age = daysBetween(stamp.date, asOf);
            seals.push({
                file,
                owner: stamp.owner,
                date: stamp.date,
                days: age,
                due: thresholds.sealed_days !== undefined && age >= thresholds.sealed_days,
            });
        }

        if (thresholds.record_days !== undefined && days >= thresholds.record_days) {
            drafts.push({
                file,
                condition,
                lastTouched: touched,
                days,
                recommendation: condition
                    ? "Read the condition against the tree and decide. Nothing here can judge whether it still holds — " +
                      "that is a question about the world, and this pass sees only the store."
                    : "Give it a `**Retire when:**` line, or state a retirement condition here and demote it — " +
                      "a record no condition can demote leaves the store only by someone re-reading it.",
            });
        }
    }

    const stale = thresholds.record_days === undefined ? [] : records.filter((r) => r.days >= thresholds.record_days);

    // ---- proposals
    let proposals = null;
    if (workspace.slots?.proposals) {
        const proposalDir = path.resolve(dir, workspace.slots.proposals);
        proposals = [];
        for (const file of listMarkdown(proposalDir)) {
            const full = path.join(proposalDir, file);
            const source = fs.readFileSync(full, "utf8");
            curated.push(source);
            const touched = lastTouched(root, rel(full));
            const days = touched === null ? 0 : daysBetween(touched, asOf);
            const pending = proposalPending(source);
            proposals.push({
                file,
                lastTouched: touched,
                days,
                pending,
                due: pending && thresholds.proposal_days !== undefined && days >= thresholds.proposal_days,
            });
        }
    }

    const handoffsDir = workspace.slots?.handoffs ? path.resolve(dir, workspace.slots.handoffs) : null;

    // ---- the handoff series, aged and never railed
    const series = { declared: false, count: null, oldest: null, bytes: 0, files: [] };
    if (handoffsDir) {
        series.declared = true;
        series.count = 0;
        for (const file of listMarkdown(handoffsDir)) {
            const full = path.join(handoffsDir, file);
            let source;
            try {
                source = fs.readFileSync(full, "utf8");
            } catch (cause) {
                throw new LibrarianError(
                    `cannot read the handoff ${path.join(workspace.slots.handoffs, file)} — ${cause.code ?? cause.message}`,
                );
            }
            const touched = lastTouched(root, rel(full));
            const days = touched === null ? 0 : daysBetween(touched, asOf);
            series.count += 1;
            series.bytes += Buffer.byteLength(source);
            series.files.push({ file, date: dateOf(file), lastTouched: touched, days });
        }
        series.oldest = series.files.reduce((a, b) => (a === null || b.days > a.days ? b : a), null);
    }

    const mining = {
        incidents: mineIncidents(series, curated, { since }),
        reviews: mineReviews(reviews, { treeRoot: workspace.tree ? path.resolve(dir, workspace.tree) : null }),
    };

    const consolidation = {
        shared: sharedIncidents(byIncident),
        headroom: {
            store: budgetHeadroom(counts.bytes / 1024, budget(workspace, "store", "kilobytes")),
            index: budgetHeadroom(renderedLines(index.expected), budget(workspace, "index", "lines")),
            record: budgetHeadroom(counts.largest.bytes / 1024, budget(workspace, "store", "record_kilobytes")),
        },
        largest: counts.largest,
    };

    return {
        dir,
        name,
        declared: true,
        thresholds,
        index,
        records,
        stale,
        seals,
        drafts,
        proposals,
        counts,
        handoffs: series,
        mining,
        consolidation,
    };
}

// ---------------------------------------------------------------- Mining

/** A pass record in the handoff series, named as older passes wrote it. */
const PASS_RECORD = /-librarian-pass\.md$/;

/** Handoffs nothing in the curated layer points back to: every one counted, those since the last pass listed. */
export function mineIncidents(series, curated, { since: named } = {}) {
    if (!series.declared) return { declared: false, total: null, linked: 0, since: null, candidates: [] };

    const incidents = series.files.filter((f) => !PASS_RECORD.test(f.file));
    const passes = series.files.filter((f) => PASS_RECORD.test(f.file) && f.date);
    const since = named ?? passes.reduce((a, b) => (a === null || b.date > a ? b.date : a), null);

    const isLinked = (file) => curated.some((source) => source.includes(file));
    const linked = incidents.filter((i) => isLinked(i.file)).length;

    const newest = incidents.reduce((a, b) => (a === null || (b.date && b.date > a) ? b.date : a), null);
    // `>=`: a handoff written on a pass's own day, after it ran, is listed by the next pass rather than by none.
    const inWindow = since
        ? (i) => i.date !== null && i.date >= since
        : (i) => i.date !== null && i.date === newest;

    const candidates = incidents
        .filter((i) => inWindow(i) && !isLinked(i.file))
        .map((i) => ({
            file: i.file,
            date: i.date,
            recommendation:
                "Read it. If it taught a rule, run the `codify` skill; if it already did, add the link — " +
                "a rule whose incident cannot be traced can never be retired on evidence.",
        }));

    return { declared: true, total: incidents.length, linked, since, window: since ? "since the last pass" : "the newest date in the series", candidates };
}

/** Paths still in the tree with findings on two or more pull requests, or null when not asked. */
export function mineReviews(reviews, { treeRoot }) {
    if (reviews === undefined || reviews === null || !treeRoot) return null;
    if (!Array.isArray(reviews)) {
        throw new LibrarianError(
            "the review corpus is not a JSON array. GitHub answers an error as an object, so reading this as " +
                "*no reviews* would report *none recurring* over a fetch that failed — refusing instead",
        );
    }

    for (const c of reviews) {
        if (!c || typeof c !== "object" || Array.isArray(c) || typeof c.pull_request_url !== "string") {
            throw new LibrarianError(
                `the review corpus holds an element that is not a review comment (${Array.isArray(c) ? "an array" : typeof c}` +
                    ", with no `pull_request_url`). One flat array of comments is the shape this reads; an array of " +
                    "PAGES is what `--slurp` produces and is not it. Refusing rather than reporting *none recurring* " +
                    "over a corpus it could not read",
            );
        }
    }

    const findings = reviews.filter((c) => !c.in_reply_to_id);
    const replies = reviews.length - findings.length;

    const pulls = new Map();
    for (const c of findings) {
        if (!c.path) continue;
        const pull = c.pull_request_url.split("/").pop();
        if (!pulls.has(c.path)) pulls.set(c.path, new Set());
        pulls.get(c.path).add(pull);
    }

    // A reviewed path is external data: contained before it is probed, or an absolute or `../` path stats the runner's disk.
    const inTree = (p) => {
        const full = path.resolve(treeRoot, p);
        return isInside(treeRoot, full) && fs.existsSync(full);
    };
    const recurring = [...pulls.entries()].map(([p, s]) => ({ path: p, pulls: s.size })).filter((p) => p.pulls >= 2);
    const paths = recurring
        .filter((p) => inTree(p.path))
        .sort((a, b) => b.pulls - a.pulls || a.path.localeCompare(b.path));

    return { comments: reviews.length, findings: findings.length, replies, gone: recurring.length - paths.length, paths };
}

// ---------------------------------------------------------------- Consolidation

export function provenanceHref(source) {
    return source.match(/^\s*\*\*provenance:\*\*.*?href=([^\s`]+)/im)?.[1] ?? null;
}

export function sharedIncidents(byIncident) {
    return [...byIncident.entries()]
        .filter(([, files]) => files.length > 1)
        .map(([incident, files]) => ({
            incident,
            files: [...files].sort(),
            question:
                "Are these one mechanism, or several lessons from one incident? Only the first is a merge — " +
                "and a merge carries BOTH parents' provenance and both retirement conditions.",
        }))
        .sort((a, b) => a.incident.localeCompare(b.incident));
}

export function budgetHeadroom(actual, budget) {
    if (budget === undefined) return null;
    return { actual: Number(actual.toFixed(1)), budget, percent: Math.round((actual / budget) * 100) };
}

/** Lines in the index the store renders now: the committed one runs a line short just after the store grows. */
const renderedLines = (expected) =>
    expected === null || expected === undefined ? 0 : expected.split("\n").length - (expected.endsWith("\n") ? 1 : 0);

// ---------------------------------------------------------------- The report

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Drift, never a repair: the report is composed before `run` regenerates an index, which can still fail. */
const indexState = (s) => (s.declared ? (s.drifted ? "**was out of date when this pass arrived**" : "current") : "none declared");

export function renderReport(results, { asOf }) {
    const out = [
        "# The librarian's scheduled pass",
        "",
        `**Date:** ${asOf} · Filed by \`cli/librarian.mjs\` on a cron.`,
        "",
        "**State.** Every figure below is **as of " + asOf + "**, read from git history rather than from the",
        "filesystem, and nothing here is a decision. This pass drafts; the maintainer disposes.",
        "",
    ];

    for (const r of results) {
        if (!r.declared) {
            out.push(`## ${r.name}`, "", "Declares no `librarian` object — not passed over.", "");
            continue;
        }
        const t = r.thresholds;
        out.push(`## ${r.name}`, "");
        out.push(
            `**Store.** ${plural(r.counts.records, "record")}, ${plural(r.counts.rules, "rule")}, ` +
                `${(r.counts.bytes / 1024).toFixed(1)} KB` +
                (r.counts.uncommitted
                    ? ` — ${r.counts.uncommitted} not yet committed, so undated here and never stale`
                    : "") +
                ". Index: " +
                indexState(r.index.series.memory) +
                "." +
                r.index.notes.map((n) => ` ${n}.`).join(""),
            "",
        );

        // ---- the handoff series
        if (!r.handoffs.declared) {
            out.push("**Handoff series.** This workspace declares no `slots.handoffs` — not asked.", "");
        } else {
            out.push(
                `**Handoff series.** ${plural(r.handoffs.count, "handoff")}, ` +
                    `${(r.handoffs.bytes / 1024).toFixed(1)} KB, oldest ${r.handoffs.oldest ? `\`${r.handoffs.oldest.file}\` at ${plural(r.handoffs.oldest.days, "day")}` : "none — the series is empty"}. ` +
                    "Index: " +
                    indexState(r.index.series.handoffs) +
                    ". No threshold reaches this series and no demotion is drafted against it: it is " +
                    "append-only, so the only repair a staleness draft could recommend is deleting the " +
                    "record the series exists to keep.",
                "",
            );
        }

        // ---- staleness
        if (t.record_days === undefined) {
            out.push(`**Staleness.** No \`record_days\` declared, so nothing is flagged. The oldest record is ${oldest(r.records)}.`, "");
        } else if (r.stale.length === 0) {
            out.push(
                `**Staleness.** Nothing is stale: no record has gone untouched for ${plural(t.record_days, "day")}. ` +
                    `The oldest is ${oldest(r.records)}.`,
                "",
            );
        } else {
            out.push(`**Staleness.** ${plural(r.stale.length, "record")} untouched for ${plural(t.record_days, "day")} or more:`, "");
            for (const s of r.stale) out.push(`  - \`${s.file}\` — last authored ${s.lastTouched ?? "never — uncommitted"}, ${plural(s.days, "day")} ago`);
            out.push("");
        }

        // ---- seals
        if (r.counts.sealed === 0) {
            out.push(
                "**Sealed stamps.** None in this store — every rule links its incident, so retirement here can rest " +
                    "on evidence rather than on asking. Reported at zero rather than omitted: *nothing to nag* and " +
                    "*did not look* must not print the same way.",
                "",
            );
        } else {
            const due = r.seals.filter((s) => s.due);
            out.push(
                `**Sealed stamps.** ${plural(r.counts.sealed, "sealed rule")} of ${r.counts.rules}. ` +
                    (t.sealed_days === undefined
                        ? "No `sealed_days` declared, so none is nagged."
                        : due.length
                          ? `${due.length} due for re-validation:`
                          : `None is past ${plural(t.sealed_days, "day")}.`),
                "",
            );
            for (const s of due) {
                out.push(
                    `  - \`${s.file}\` — sealed ${s.date}, ${plural(s.days, "day")} ago. **${s.owner || "the owner"}**: can the ` +
                        "incident behind this rule still occur? Nothing here can see it, which is what sealing means.",
                );
            }
            if (due.length) out.push("");
        }

        // ---- proposals
        if (r.proposals === null) {
            out.push("**Proposals.** This workspace declares no `slots.proposals` — not asked.", "");
        } else {
            const pending = r.proposals.filter((p) => p.pending);
            const due = r.proposals.filter((p) => p.due);
            out.push(
                `**Proposals.** ${r.proposals.length} filed, ${pending.length} still waiting on the human gate` +
                    (t.proposal_days === undefined
                        ? ", and no `proposal_days` declared, so none is nagged."
                        : due.length
                          ? `, of which ${due.length} past ${plural(t.proposal_days, "day")}:`
                          : `, none past ${plural(t.proposal_days, "day")}.`),
                "",
            );
            for (const p of due) out.push(`  - \`${p.file}\` — last authored ${p.lastTouched ?? "never — uncommitted"}, ${plural(p.days, "day")} ago`);
            if (due.length) out.push("");
        }

        // ---- demotion drafts
        if (r.drafts.length === 0) {
            out.push(
                "**Demotion drafts.** None. A draft is written for a record old enough to be worth re-reading, and " +
                    "no record here is.",
                "",
            );
        } else {
            out.push(`**Demotion drafts.** ${plural(r.drafts.length, "candidate")}, each decided by nobody:`, "");
            for (const d of r.drafts) {
                out.push(`  - \`${d.file}\` — last authored ${d.lastTouched ?? "never — uncommitted"}, ${plural(d.days, "day")} ago.`);
                out.push(`    Retire when — ${d.condition ? d.condition : "NO CONDITION STATED"}`);
                out.push(`    ${d.recommendation}`);
            }
            out.push("");
        }

        // ---- mining: incidents
        const inc = r.mining.incidents;
        if (!inc.declared) {
            out.push("**Mining — incidents.** No `slots.handoffs` series to mine — not asked.", "");
        } else {
            out.push(
                `**Mining — incidents.** ${plural(inc.total, "incident")} in the series; ${inc.linked} have ` +
                    `something in the curated layer pointing back at them, ${inc.total - inc.linked} do not. ` +
                    `Candidates below are ${inc.since ? `those since the last pass (${inc.since})` : "those of the newest date in the series, there being no earlier pass to measure from"}. ` +
                    "The claim is the narrow one: nothing here says an incident taught no rule, only that no " +
                    "rule or proposal points back to it — and a rule whose incident cannot be traced can " +
                    "never be retired on evidence.",
                "",
            );
            if (inc.candidates.length === 0) {
                out.push("  - None in the window.", "");
            } else {
                for (const c of inc.candidates) {
                    out.push(`  - \`${c.file}\` — ${c.date}. ${c.recommendation}`);
                }
                out.push("");
            }
        }

        // ---- mining: pull-request reviews
        if (r.mining.reviews === null) {
            out.push(
                "**Mining — pull-request reviews.** Not asked: no review corpus was supplied, or this " +
                    "workspace declares no `tree` and so makes claims about no repository. *Not asked* is not " +
                    "*none recurring*.",
                "",
            );
        } else {
            const rv = r.mining.reviews;
            out.push(
                `**Mining — pull-request reviews.** ${plural(rv.comments, "inline comment")}: ${rv.findings} open a ` +
                    `thread and are findings, ${rv.replies} are replies and are not. ` +
                    (rv.paths.length
                        ? `${plural(rv.paths.length, "path")} still in the tree have drawn findings on two or more distinct pull requests. `
                        : "No path still in the tree has drawn findings on two or more distinct pull requests. ") +
                    (rv.gone ? `${plural(rv.gone, "other")} did and no longer exists, so they are dropped rather than nagged about forever. ` : "") +
                    "Two is what *recurring* means rather than a number anyone chose. **Inline comments only** " +
                    "— the low-confidence notes collapsed into a review body carry no path and cannot be seen " +
                    "from here, and that is the larger channel.",
                "",
            );
            for (const p of rv.paths) out.push(`  - \`${p.path}\` — findings on ${plural(p.pulls, "pull request")}`);
            if (rv.paths.length) out.push("");
        }

        // ---- consolidation
        const c = r.consolidation;
        const head = (label, h, unit) =>
            h === null ? `${label}: no budget declared` : `${label}: ${h.actual} of ${h.budget} ${unit} (${h.percent}%)`;
        const widest =
            c.headroom.record === null
                ? head("Largest record", null)
                : `${head("Largest record", c.headroom.record, "KB")}` +
                  (c.largest.file === null ? " — no records yet" : ` — \`${c.largest.file}\``);
        out.push(
            `**Consolidation.** ${head("Store", c.headroom.store, "KB")}. ${head("Index", c.headroom.index, "lines")}. ` +
                `${widest}. ` +
                "Reported as a distance rather than a verdict: the `index` recipe already answers over or " +
                "under at pull-request time, and what it cannot say is how close.",
            "",
        );
        if (c.shared.length === 0) {
            out.push("  - No two records cite one incident.", "");
        } else {
            out.push(`  - ${plural(c.shared.length, "group")} of records citing one incident — a question, not a verdict:`, "");
            for (const g of c.shared) {
                out.push(`    - \`${g.incident}\` ← ${g.files.map((f) => `\`${f}\``).join(", ")}`);
                out.push(`      ${g.question}`);
            }
            out.push("");
        }
        out.push(
            "  Steps 3 and 4 of `core/skills/consolidate/SKILL.md` — surfacing contradictions and " +
                "compressing what survives — are **not automated here, and are not silently skipped**. " +
                "Both need a reading of what two records mean, and a pass that guessed would be making " +
                "the policy decision step 3 exists to forbid.",
            "",
        );
    }

    out.push(
        "**Next action.** Every nag above is addressed to the maintainer, and none is answered by",
        "re-running this pass. Where the pass opened a pull request, merge or close it: an unmerged pass",
        "is itself a nag.",
        "",
        "**Recoverability.** This pass writes nothing into the tree but an index that had drifted, and",
        "this report where its scheduler asks. Closing its pull request unopened loses nothing: the next",
        "pass reaches the same conclusions from the same store and says them again.",
        "",
    );
    return out.join("\n");
}

const oldest = (records) => {
    const o = records.reduce((a, b) => (a === null || b.days > a.days ? b : a), null);
    return o ? `\`${o.file}\` at ${plural(o.days, "day")}` : "none — the store is empty";
};

// ---------------------------------------------------------------- The command

const USAGE =
    "usage: node cli/librarian.mjs [--as-of YYYY-MM-DD] [--since YYYY-MM-DD] [--write] [--report <path>] [--reviews <path>] <workspace-dir> [...]";

export function parseArgs(argv) {
    const opts = { asOf: undefined, since: undefined, reportPath: undefined, reviewsPath: undefined, write: false, dirs: [] };
    const value = (flag, next) => {
        if (next === undefined || next.startsWith("--")) {
            throw new LibrarianError(`${flag} needs a value.\n${USAGE}`);
        }
        return next;
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        switch (arg) {
            case "--as-of":
                opts.asOf = value(arg, argv[(i += 1)]);
                break;
            case "--since":
                opts.since = value(arg, argv[(i += 1)]);
                break;
            case "--report":
                opts.reportPath = value(arg, argv[(i += 1)]);
                break;
            case "--reviews":
                opts.reviewsPath = value(arg, argv[(i += 1)]);
                break;
            case "--write":
                opts.write = true;
                break;
            default:
                if (arg.startsWith("--")) throw new LibrarianError(`unknown option ${JSON.stringify(arg)}.\n${USAGE}`);
                opts.dirs.push(arg);
        }
    }
    return opts;
}

/** Where a write to `p` lands, every link resolved, a dangling one too, which `realpathSync` alone refuses. */
function realish(p) {
    const rest = [];
    let at = p;
    for (let hops = 0; ; ) {
        try {
            return path.join(fs.realpathSync(at), ...rest);
        } catch {
            // A link's target resolves against its real parent, as the kernel's does; past Linux's forty hops the write fails.
            let target = null;
            try {
                if (fs.lstatSync(at).isSymbolicLink()) {
                    target = path.resolve(fs.realpathSync(path.dirname(at)), fs.readlinkSync(at));
                }
            } catch {
                // Missing or unreadable: an ancestor resolves instead.
            }
            if (target !== null && hops++ < 40) {
                at = target;
                continue;
            }
            const up = path.dirname(at);
            if (up === at) return path.join(at, ...rest);
            rest.unshift(path.basename(at));
            at = up;
        }
    }
}

/** The tree a workspace declares, read from its manifest, so the report stays out of it even where the pass failed. */
function declaredTree(dir) {
    try {
        const { tree } = JSON.parse(fs.readFileSync(path.join(dir, "workspace.json"), "utf8"));
        return typeof tree === "string" && tree !== "" ? path.resolve(dir, tree) : null;
    } catch {
        return null;
    }
}

export function run(argv, say = console.log) {
    let asOfArg, since, reportPath, reviewsPath, write, dirs;
    try {
        ({ asOf: asOfArg, since, reportPath, reviewsPath, write, dirs } = parseArgs(argv));
    } catch (error) {
        if (!(error instanceof LibrarianError)) throw error;
        say(`  ✗ ${error.message}`);
        return 2;
    }

    if (dirs.length === 0) {
        say(USAGE);
        return 2;
    }

    const asOf = asOfArg ?? new Date().toISOString().slice(0, 10);
    try {
        parseDate(asOf, "--as-of");
        if (since !== undefined) parseDate(since, "--since");
    } catch (error) {
        say(`  ✗ ${error.message}`);
        return 2;
    }

    let reviews;
    if (reviewsPath !== undefined) {
        try {
            reviews = JSON.parse(fs.readFileSync(reviewsPath, "utf8"));
        } catch (cause) {
            say(`  ✗ cannot read the review corpus at ${reviewsPath} — ${cause.message}`);
            return 2;
        }
    }

    const results = [];
    let worst = 0;
    for (const dir of dirs) {
        try {
            const result = passWorkspace(dir, { asOf, reviews, since });
            results.push(result);
            if (!result.declared) {
                say(`  · ${dir}: declares no librarian pass`);
                continue;
            }
            say(
                `  ok ${dir}: ${plural(result.counts.records, "record")}, ${result.stale.length} stale, ` +
                    `${result.seals.filter((s) => s.due).length} seal(s) due, ` +
                    `${result.proposals?.filter((p) => p.due).length ?? 0} proposal(s) nagged, ` +
                    `${result.mining.incidents.candidates.length} incident(s) to codify` +
                    (result.index.drifted ? ", index drift found" : ""),
            );
        } catch (error) {
            if (!(error instanceof LibrarianError)) throw error;
            say(`  ✗ ${dir}: ${error.message}`);
            worst = 2;
        }
    }

    if (reportPath !== undefined) {
        // Written to the resolved path, so the file written is the file judged.
        const target = realish(path.resolve(reportPath));
        const roots = dirs.flatMap((dir) => [path.resolve(dir), declaredTree(dir)]).filter(Boolean);
        const inside = roots.find((root) => isInside(realish(root), target));
        if (inside !== undefined) {
            say(`  ✗ refusing to write the report inside ${inside}: a report goes outside the tree, where no commit carries it`);
            worst = 2;
        } else {
            try {
                fs.mkdirSync(path.dirname(target), { recursive: true });
                // Renamed into place, never written through: a name may be a hard link into the tree, and `wx` opens nothing already there.
                const fresh = `${target}.${process.pid}.tmp`;
                fs.writeFileSync(fresh, renderReport(results, { asOf }), { flag: "wx" });
                try {
                    fs.renameSync(fresh, target);
                } catch (cause) {
                    fs.rmSync(fresh, { force: true });
                    throw cause;
                }
                say(`  ok wrote the report to ${reportPath}`);
            } catch (cause) {
                say(`  ✗ cannot write the report — ${cause.code ?? cause.message}`);
                worst = 2;
            }
        }
    }

    // ---- the indexes, last
    if (write && worst < 2) {
        for (const r of results) {
            if (!r.declared) continue;
            try {
                inspectIndex(r.dir, { write: true });
                if (r.index.drifted) say(`  ok regenerated ${r.name}'s index`);
            } catch (cause) {
                if (!(cause instanceof IndexError)) throw cause;
                say(`  ✗ ${r.dir}: the index could not be regenerated — ${cause.message}`);
                worst = 2;
            }
        }
    }

    return worst;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exit(run(process.argv.slice(2)));
}
