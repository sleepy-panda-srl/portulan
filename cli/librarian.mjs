#!/usr/bin/env node
// `librarian` — the scheduled pass over the curated layer: reindex, staleness, nags, demotion drafts.
//
//   node cli/librarian.mjs [--as-of YYYY-MM-DD] [--write] [--log <path>] <workspace-dir> [...]
//
// Exit 0 the pass ran and recorded what it found · 2 it could not run. **There is no 1**, and that is
// the design rather than an omission: `doctor`, `index` and `compile` are checkers, where 1 means red
// and a red blocks. This is not a checker. A stale record is not a broken build, and a tool that
// exited 1 on one would turn every nag into a failing job until somebody switched the job off — which
// is what ../.portulan/verify/README.md says happens to checks that cry wolf.
//
// ## What this is, and the one thing it can do that `doctor` cannot
//
// ../core/operating/memory.md gives the store four states and the fourth is **Retire**. `doctor`
// reports the store's count and size and says, in its own output, why it stops there: "ages live in
// git, which doctor does not read, so staleness is the librarian's (milestone 5)". That is this file.
// Reading history is the affordance a scheduled job has and a verify recipe must not take — a check
// that reads history is a false-red generator in a shallow CI checkout, so the rule is that the
// *recipe* never asks and this *pass* always may.
//
// The four passes are the ones ../docs/plan.md's milestone-5 row names:
//
//   reindex     regenerate the memory index, so a drift on `main` becomes a diff someone reviews
//   staleness   every record's last-touched date from git, plus the sealed-stamp re-validation nag
//   proposals   which rule changes are still waiting on the human gate, and for how long
//   demotions   a draft per record the human might retire — evidence assembled, nothing decided
//
// ## It drafts. It decides nothing.
//
// ../docs/vision.md thesis 4: the librarian "retires rules whose incidents can no longer occur. It
// cannot judge a sealed rule, so it nags the owner to re-validate instead." Read exactly: **it cannot
// evaluate a retirement condition at all.** `Retire when: the generated client is deleted` is a
// sentence about a world this process cannot see. So a demotion draft carries the condition verbatim,
// the evidence a machine can gather (an age, and whether anything the condition names still exists),
// and a recommendation addressed to a human — never a verdict. A draft that said *this has fired*
// would be the tool exceeding its charter inside the artifact the maintainer trusts it with.
//
// ## Why it composes no new prose at run time, and what that buys
//
// Precisely: every string this pass emits is either a **literal in this file** — reviewed and
// seam-scanned in the change that added it, like any other source — or **derived** from the tree: a
// filename, a date git recorded, a count, a condition quoted from a record that passed the scan when
// it landed. Nothing is composed about the work at run time. A rearrangement of already-scanned atoms
// cannot carry a term the scan has not already seen, which is what makes the output safe to file
// automatically.
//
// The claim is worded that way rather than as *authors no prose*, which a pre-commit checkpoint
// pointed out is false on its face — the handoff below is full of sentences. The distinction between
// *written by a reviewed change* and *written by an unattended run* is the one that matters, and it is
// the difference between this and having the pass write a summary in its own words, which would put an
// unreviewed sentence into a public repository on a cron.
//
// Zero dependencies, no network, no install step — same constraints as ./doctor.mjs, ./compile.mjs and
// ./index.mjs. It is **not** one of the six subcommands ../docs/vision.md names for the milestone-7
// CLI; like ./plugin-lint.mjs it is a tool on no such list, and ./README.md says so.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { inspect as inspectIndex, IndexError, recordType, dateOf, isInside } from "./index.mjs";
import { parseProvenance } from "./doctor.mjs";

/** Windows separators never reach a Markdown link: a backslash there is a filename character. */
const posix = (p) => p.split(path.sep).join(path.posix.sep);

/** Raised when the pass cannot run, or cannot report honestly. Always exit 2. */
export class LibrarianError extends Error {
    constructor(message) {
        super(message);
        this.name = "LibrarianError";
    }
}

// The `librarian` object arrives at 2.4. Earlier manifests are read correctly — they simply declare
// no pass, which is the shape every workspace had yesterday. Same reasoning and same refusal as
// ./index.mjs's KNOWN_SPECS: a tool that reads a manifest it does not understand reports about a
// workspace it may have misread.
const KNOWN_SPECS = new Set(["2.0", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6"]);

// The store's own signpost, not a record — the one name ./index.mjs and ./doctor.mjs both exclude.
// Three tools now share this judgement and none of them shares the code, which is issue #74; this
// file is the third and says so rather than pretending it is the first.
const NOT_A_RECORD = new Set(["README.md"]);

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// ===========================================================================================
// Dates
// ===========================================================================================

/** Parse `YYYY-MM-DD` strictly, or throw. `2026-13-45` is not a date this pass will guess about. */
function parseDate(value, where) {
    if (typeof value !== "string" || !ISO.test(value)) {
        throw new LibrarianError(`${where} is ${JSON.stringify(value)}, which is not a YYYY-MM-DD date`);
    }
    const ms = Date.parse(`${value}T00:00:00Z`);
    // Round-tripping is what rejects a well-shaped impossibility: `Date.parse` accepts some of them
    // and rolls them forward, so `2026-02-31` would silently become March.
    if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== value) {
        throw new LibrarianError(`${where} is ${JSON.stringify(value)}, which is not a real date`);
    }
    return ms;
}

/**
 * Whole days from `from` to `to`. Negative when `from` is later — a record dated after the pass is a
 * clock problem or a fabricated date, and reading it as "0 days old" would hide exactly that.
 */
export function daysBetween(from, to) {
    const a = parseDate(from, "the earlier date");
    const b = parseDate(to, "the later date");
    return Math.round((b - a) / 86_400_000);
}

// ===========================================================================================
// Reading a record
// ===========================================================================================

/**
 * The sealed stamp on a **rule**, as `{ owner, date }` — or null when there is nobody to nag.
 *
 * Null covers three different situations on purpose: a linked rule (its incident is readable, so it
 * can be retired on evidence rather than by asking), a record that is not a rule (thesis 4 and every
 * mandate behind it are rule-scoped, and `doctor` binds provenance the same way), and prose
 * provenance (already a `doctor` failure — this pass does not fail a second time for one defect).
 *
 * A sealed stamp with no `date` is **refused**, not skipped. Skipping would drop the one record that
 * most needs the nag, silently, and silence is the failure this whole pass exists to end.
 */
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

/**
 * The record's retirement condition, verbatim and whitespace-joined — or null when it states none.
 *
 * Anchored to the bolded field at line start, exactly as `doctor`'s `RETIRE_WHEN` is, so prose that
 * merely discusses retiring never matches. The unit is the paragraph rather than the line, the way
 * `parseProvenance` reads a stamp: conditions wrap, and half a condition is worse than none because a
 * reader cannot tell it is half.
 */
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

/**
 * Is this proposal still waiting on the human gate?
 *
 * Deliberately generous toward *pending*, and the asymmetry is the point: this classification feeds a
 * nag, never a gate. Calling a settled proposal pending costs one line in a report a human skims;
 * calling a pending one settled drops it out of the only mechanism that would have chased it. So an
 * absent decision is pending — absence is not consent — a placeholder is pending, and the word
 * *pending* anywhere in the field wins over any verdict beside it.
 *
 * Both field spellings are read. The template says `**Decision.**`; two of this repository's fourteen
 * proposals record the outcome under `**Status.**` instead, which is a real shape in a real store and
 * not one to fail over. What a rail may demand — that the field exists at all — is `docs.sh`'s
 * `proposal` check; what it deliberately does not demand is which word appears in it, because a
 * grep that classified prose would red on a proposal whose only fault is a maintainer's phrasing.
 */
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

// ===========================================================================================
// Reading history
// ===========================================================================================
//
// One `git log` per file. For twenty-odd records across two workspaces that is a few hundred
// milliseconds on a job that runs weekly, and the obvious optimisation — one `git log --name-only`
// walk over all of history — is slower here and harder to read. Noted so the next person does not
// rediscover the trade as a defect.

function git(root, args, what) {
    try {
        return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    } catch (cause) {
        throw new LibrarianError(`git could not ${what} — ${cause.stderr?.toString().trim() || cause.message}`);
    }
}

/**
 * The repository this workspace lives in, refusing anything that would make a date a guess.
 *
 * **Shallow is refused.** In a shallow clone `git log -1 -- <path>` returns nothing for a file whose
 * only commit was truncated away, so every record reads as undated — and a staleness pass over
 * undated records either flags everything or nothing, describing the checkout rather than the store.
 * `actions/checkout` is shallow by default, so this is not a theoretical clone; it is the *normal*
 * one, and the workflow that runs this pass sets `fetch-depth: 0` because of this paragraph.
 */
function historyRoot(dir) {
    const root = git(dir, ["rev-parse", "--show-toplevel"], `find a git repository at ${dir}`);
    if (git(root, ["rev-parse", "--is-shallow-repository"], "test for a shallow repository") === "true") {
        throw new LibrarianError(
            "this is a shallow clone, where a file's history may be truncated away entirely — every record " +
                "would read as undated and every threshold would fire or none would. Check out with full history " +
                "(`fetch-depth: 0`) before asking this pass to date anything",
        );
    }
    return root;
}

/**
 * When a tracked file was last **authored**, `YYYY-MM-DD`.
 *
 * Author date, not committer date, and the difference is load-bearing in this repository: every branch
 * is rebase-merged, which rewrites committer dates wholesale, so a committer-dated pass would report
 * that the entire store was touched on the day of the last rebase. Author date survives a rebase,
 * which is the property that makes it the honest answer to *when was this written*.
 *
 * Returns `null` for a path that is **not in `HEAD`** — untracked, or staged and not yet committed.
 * That is not a refusal and not a fail-open: such a file is *new*, and nothing in the history this
 * pass reads is older than a file's absence from that history, so age 0 is the precise answer. A path
 * that **is** in `HEAD` and still has no date is refused, because that is a fact about the checkout
 * rather than about the store. The reasoning for the split, and the two defects that produced it, are
 * at the call site below rather than repeated here.
 */
function lastTouched(root, relative) {
    const out = git(root, ["log", "-1", "--format=%as", "--", relative], `date ${relative}`);
    if (ISO.test(out)) return out;

    // No dated commit. Two very different situations arrive here and collapsing them is a defect
    // either way round, which this pass learned twice in one session by shipping the collapse and
    // then shipping the wrong seam between the halves.
    //
    //   not in HEAD   the committed tree does not contain this path. It is not undatable, it is NEW:
    //                 nothing in the history this pass reads is older than a file's absence from that
    //                 history, so age 0 is the precise answer rather than a guess. Reported as
    //                 `uncommitted`, so a reader is never told git dated something it did not.
    //   in HEAD       git has the path committed and still returned no date, which should be
    //                 unreachable now that a shallow clone is refused outright. Refused, loudly:
    //                 whatever produces it is a fact about the checkout, and this pass would be
    //                 reporting it as a fact about the store.
    //
    // **`HEAD`, not `git ls-files`** — and that is the second lesson, measured rather than reasoned.
    // The obvious test is whether git *tracks* the file, and it is wrong for one state in between:
    // a file that has been `git add`ed and not yet committed is tracked, has no commit, and is new.
    // Testing tracking refused exactly those, so a session that staged its work before running the
    // pass got the same red the first draft gave for uncommitted work — the same defect, one state
    // further in, found the same way: by running it rather than by reading it.
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

// ===========================================================================================
// The pass
// ===========================================================================================

/** A declared threshold must be a positive integer — ./index.mjs's rule, for ./index.mjs's reason. */
function threshold(value, where) {
    if (value === undefined) return undefined;
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
        throw new LibrarianError(
            `${where} is ${JSON.stringify(value)}, which is not a positive integer. A threshold that is zero, ` +
                "negative or non-numeric would read as undeclared and switch the nag off in the key that exists to switch it on",
        );
    }
    return value;
}

const listMarkdown = (dir) => {
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (cause) {
        throw new LibrarianError(`cannot read ${dir} — ${cause.code ?? cause.message}`);
    }
    return names.filter((n) => n.endsWith(".md") && !NOT_A_RECORD.has(n)).sort();
};

/**
 * Run the pass over one workspace.
 *
 * `asOf` is the date every age is measured against, and it is a parameter rather than a call to the
 * clock so that a test asserting "90 days" does not start failing on a date nobody chose. The command
 * defaults it to today.
 *
 * **This function never writes.** It reads the tree and returns what it found; `run` does the writing,
 * and does it in an order this function cannot get wrong — see the reindex block below.
 *
 * `reviews` is the pull-request review corpus, or `undefined` for *not asked*. It is passed in rather
 * than fetched because this file makes no network call: the workflow fetches, and every line of the
 * reading is then exercised by the suite against a fixture instead of at 06:00 on a Monday.
 */
export function passWorkspace(dir, { asOf, reviews } = {}) {
    parseDate(asOf, "--as-of");

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
    // `realpathSync` on both sides, and it is not defensive programming. `git rev-parse
    // --show-toplevel` answers with the resolved path, while the directory this pass was handed may
    // reach the same place through a symlink — which is the ordinary case on macOS, where `/var` is a
    // link to `/private/var` and every temporary directory is under it. Without this the relative
    // path comes out as a stack of `..` segments and git refuses every file as *outside repository*:
    // a refusal that names the right rule for the wrong reason, on a store that is perfectly fine.
    const rel = (p) => path.relative(root, fs.realpathSync(p)).split(path.sep).join("/");

    // ---- reindex: READ ONLY, always
    //
    // **This pass reads; the command writes, and only after the record is on disk.** The ordering is
    // load-bearing now that a second series is indexed: a pass is a session, so it ends by writing a
    // dated handoff INTO `slots.handoffs` — the very series the handoff index covers. An index
    // regenerated here would be stale the moment the record landed, and the pull request the pass
    // files would carry a handoff index that `index.sh` reds. The pass would have broken the one
    // demonstration it exists to produce, on its first real run, with nobody watching.
    //
    // Reading drift here and writing later also makes an earlier fix structural instead of careful.
    // `inspect` in write mode regenerates and *then* compares, so it never reports drift — it has
    // just removed it — and reading `drifted` off that result said "current" about an index the pass
    // had regenerated a line earlier, putting "no index drift" into a machine-written record of the
    // one thing the run had changed (Copilot, #81, suppressed half, three sites at once). With no
    // write on this path there is no ordering left to get wrong.
    // **Per series, and that is not tidiness.** `declared` here means *this series has an index file*
    // — `path !== null`, so a workspace declaring budgets and no index is correctly *none declared*.
    // The pair-wide flag was what both report sites branched on, and a workspace declaring only one of
    // the two indexes then had "current" printed about an index that does not exist: the exact
    // sentence `./index.mjs`'s `run` was fixed for on #72, reproduced in the record the pass files.
    // Raised on #85 round one in both channels at once, which is what a two-site defect looks like.
    let index = { declared: false, drifted: false, series: {}, findings: [] };
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
            // The store index as the store renders it *now* — not the bytes on disk. Consolidation's
            // headroom is a pressure signal, and reading the committed file gets the direction wrong
            // exactly when it matters: a store that just grew has a committed index one line short, so
            // pressure would be under-reported at the moment it rose. `null` when a title disagreement
            // stopped the render, which `index.sh` is red for anyway.
            expected: result.series.memory.expected,
            findings: result.findings.map((f) => f.message),
        };
    } catch (cause) {
        if (!(cause instanceof IndexError)) throw cause;
        // The index tool's refusals are this pass's refusals: it is the same store, and a pass that
        // reported staleness over a store `index` would not read has judged half a thing.
        throw new LibrarianError(`the reindex could not run — ${cause.message}`);
    }

    // ---- the store, dated
    const storeDir = path.resolve(dir, memorySlot);
    const counts = { records: 0, rules: 0, sealed: 0, bytes: 0, uncommitted: 0 };
    const records = [];
    const seals = [];
    const drafts = [];
    // Every curated-layer document's text, kept for the link scan mining runs below. The curated
    // layer is the memory store and the proposal series and nothing else: a handoff referenced from
    // another handoff is one session mentioning another, not a rule tracing its incident.
    const curated = [];
    // Records grouped by the incident they cite, for consolidation's step-2 question.
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
        // An uncommitted record has no age and is never stale: it cannot have gone untouched for
        // longer than it has existed in the history this pass reads.
        const days = touched === null ? 0 : daysBetween(touched, asOf);
        const type = recordType(source) || "untyped";
        const condition = retireWhen(source);

        counts.records += 1;
        counts.bytes += Buffer.byteLength(source);
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

    // ---- proposals. `null` is *not asked*, which is not the same answer as *none pending*.
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

    // The handoffs slot rides along so the command knows where a pass record belongs without
    // re-reading the manifest — and reads it from the slot rather than assuming the directory name,
    // which is the whole reason slots exist.
    const handoffsDir = workspace.slots?.handoffs ? path.resolve(dir, workspace.slots.handoffs) : null;

    // ---- the handoff series: aged and reported, never railed
    //
    // The milestone-5 row scopes staleness to this series as well as the store, and the same row bars
    // a budget on it — an append-only series has no consolidation to offer, so every remedy a budget
    // could ask for is barred. A staleness THRESHOLD carries that problem one layer down:
    // `record_days` exists to draft a demotion, and a demotion draft here recommends deleting the
    // record the series exists to keep, weekly, forever. So the ages are read and reported — count,
    // oldest, size — and no threshold reaches them.
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
        incidents: mineIncidents(series, curated),
        reviews: mineReviews(reviews, { treeRoot: workspace.tree ? path.resolve(dir, workspace.tree) : null }),
    };

    const consolidation = {
        // Step 2 of core/skills/consolidate/SKILL.md, as a question rather than a verdict — see
        // `sharedIncidents`.
        shared: sharedIncidents(byIncident),
        // Step 5's rail, read as a distance rather than a verdict. `index.sh` answers over/under at
        // pull-request time; what it cannot say is *how close*, and a scheduled pass that reports
        // pressure is the difference between consolidating on a calendar and consolidating on a red.
        headroom: {
            store: budgetHeadroom(counts.bytes / 1024, workspace.memory?.store?.budget?.kilobytes),
            index: budgetHeadroom(renderedLines(index.expected), workspace.memory?.index?.budget?.lines),
        },
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
        handoffsDir,
        handoffs: series,
        mining,
        consolidation,
    };
}

// ===========================================================================================
// Mining — the half of the librarian that reads incidents rather than the store
// ===========================================================================================
//
// `core/skills/codify/SKILL.md` is the on-demand form and the pass is the batch one: same ritual,
// same output shape. What the pass does NOT do is author the proposal, and the reason is mechanical
// as well as principled. `.portulan/verify/docs.sh`'s `proposal` check requires every proposal to
// name the pull request that filed it; this pass writes its files BEFORE the pull request exists and
// has no update path by design, so a generated proposal could never carry that pointer and would red
// the librarian's own pull request on the recipe that shipped one session earlier. And a template
// filled from derived fields is a stub with the argument missing — the part a human has to write is
// exactly the part that makes it a proposal rather than a row in a report.
//
// So mining names CANDIDATES, in the shape the demotion drafts already established: a file, a fact
// about it, and a fixed recommendation. The maintainer's ruling of 2026-07-29.

/** The pass's own records, named by the constant `run` writes them under — not a guess at a shape. */
const PASS_RECORD = /-librarian-pass\.md$/;

/**
 * Incidents the curated layer does not point back to.
 *
 * **The claim is the narrow one, and getting it right is the whole design.** This does not establish
 * that an incident taught no rule — measured on the real tree, one unlinked handoff had in fact
 * minted a rule whose provenance cited the *proposal* that session filed rather than the session. It
 * establishes that **nothing in the curated layer points back to this incident**, which is true in
 * that case too, and is itself the thing thesis 4 asks for: a rule links its incident so a later
 * reader can judge whether it still applies. Read the wider way it would be a query with a known
 * false positive; read this way it has none.
 *
 * **The ratio is the trend; the LIST is windowed.** 25 of this repository's 35 handoffs are unlinked,
 * and a pass that listed all 25 would print the same 25 lines every week over a series that only
 * grows — a nag nobody can finish, which is how a whole report gets skimmed. So the totals are always
 * stated and the candidates are those since the last pass. The window's anchor is derived, not
 * remembered: this pass keeps no state, and the newest pass record in the series *is* the record of
 * when it last ran. Before there is one, the window is the newest date in the series — the last
 * session's incidents, which is small, real, and does not pretend the backlog is not there.
 */
export function mineIncidents(series, curated) {
    if (!series.declared) return { declared: false, total: null, linked: 0, since: null, candidates: [] };

    const incidents = series.files.filter((f) => !PASS_RECORD.test(f.file));
    const passes = series.files.filter((f) => PASS_RECORD.test(f.file) && f.date);
    const since = passes.reduce((a, b) => (a === null || b.date > a ? b.date : a), null);

    const isLinked = (file) => curated.some((source) => source.includes(file));
    const linked = incidents.filter((i) => isLinked(i.file)).length;

    const newest = incidents.reduce((a, b) => (a === null || (b.date && b.date > a) ? b.date : a), null);
    // `>=`, and the boundary is worth a sentence because the strict version loses work permanently.
    // A pass runs in the morning and a session writes its handoff that afternoon; with `>` that
    // handoff is outside this window — the pass had not seen it — and outside every later one too,
    // because `since` only ever moves forward. It would survive nowhere but the unlinked ratio. The
    // cost of `>=` is the opposite and is bounded: an incident dated the same day as a pass can be
    // listed by that pass and by the next one, once. Dates are the granularity the series carries, so
    // one repeat is the price of never dropping a day, and that is the direction to err in.
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

/**
 * Paths pull-request reviewers keep leaving findings on.
 *
 * `codify/SKILL.md` triggers on "a review comment keeps reappearing across PRs — a pattern, not a
 * one-off", and **two distinct pull requests is what *recurring* means** rather than a number someone
 * chose. That is why there is no threshold in the manifest to declare: a tuning knob would be policy
 * and policy belongs there, but a definition is not a knob.
 *
 * **A finding is a comment that OPENS a thread.** Measured on this repository rather than assumed,
 * and the partition is exact: of 376 inline review comments, all 189 from the reviewer open threads
 * and all 187 replies — 162 from the agent identity, 25 from the maintainer — carry
 * `in_reply_to_id`. Filtering by login would have been the obvious spelling and is wrong here in the
 * worst direction, because the reviewer is itself a bot: excluding bots excludes the findings.
 * Counting replies would invert the signal outright — every reply is one more comment on a path we
 * were answering about, so the harder a finding was argued the more it would look like a place
 * reviewers keep finding things.
 *
 * **What this cannot see, stated because it is the larger half.** These are *inline* comments. The
 * low-confidence notes GitHub collapses into a review body carry no path and never appear here — and
 * on [#81](https://github.com/sleepy-panda-works/portulan/pull/81) that channel produced nine of
 * eleven findings, eight of them real. So this mines the smaller channel, and the standing argument
 * for [#66](https://github.com/sleepy-panda-works/portulan/issues/66) — promoting those notes into
 * real threads — is now also an argument about what a scheduled pass can measure at all.
 */
export function mineReviews(reviews, { treeRoot }) {
    // *Not asked* and *none found* must not print the same way — the rule the proposals pass already
    // follows. A workspace with no `tree` makes claims about no repository, so it has nowhere to
    // resolve a reviewed path against and its reviews are not a thing this pass can read.
    if (reviews === undefined || reviews === null || !treeRoot) return null;
    if (!Array.isArray(reviews)) {
        throw new LibrarianError(
            "the review corpus is not a JSON array. GitHub answers an error as an object, so reading this as " +
                "*no reviews* would report *none recurring* over a fetch that failed — refusing instead",
        );
    }

    // **Every element must be comment-shaped, and an element that is not is a refusal.** The version
    // this was built against emits one flat array from `--paginate` — measured on gh 2.96.0 over four
    // pages: 385 objects, one array — but a shape surprise here fails in the worst possible direction.
    // Fed the array-of-pages `--slurp` produces, the earlier reading counted each inner array as a
    // finding (an array carries no `in_reply_to_id`) and then skipped it for having no `path`, and
    // reported *no path has drawn findings on two or more distinct pull requests* over a corpus it had
    // entirely misread. Refusing on shape closes that whatever any `gh` does, which is the version this
    // check should be written against. Raised by Copilot on #85 round two, whose stated mechanism does
    // not hold here and whose hazard does.
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

    // **A path the tree no longer holds is dropped.** Found by running this against the real corpus
    // rather than by reading it: `cli/mode.mjs` came back recurring on two pull requests, and that
    // file does not exist — the mode axis was ruled dead and both its pull requests closed unmerged.
    // Review history is append-only, so without this the pass nags weekly and forever about a file
    // nobody can open, and no action anyone takes will ever clear it. The count of what was dropped
    // rides along, because *some were ignored* and *there were none* must not print the same way.
    //
    // **Contained before it is probed**, and the containment is not belt-and-braces: a review comment's
    // `path` is external data, and `path.resolve` walks straight out of the tree on an absolute path or
    // a `../` chain. Measured on #85 round seven before it was closed — `/etc/hosts` came back as *still
    // in the tree*, because it resolves to itself and exists; the `../` spellings were dropped only by
    // the accident of their targets not existing on that machine. So the pass would have stat'd the
    // runner's filesystem on a corpus it does not author, unattended, weekly. `isInside` is this
    // repository's one implementation of the question, extracted after two copies of it drifted into the
    // identical fail-open — a third copy here would have been that mistake a third time.
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

// ===========================================================================================
// Consolidation — the mechanical half, and an honest account of the rest
// ===========================================================================================

/** A rule's provenance link, or null — the `href=` of a `form=link` stamp. */
export function provenanceHref(source) {
    return source.match(/^\s*\*\*provenance:\*\*.*?href=([^\s`]+)/im)?.[1] ?? null;
}

/**
 * Records citing one incident, raised as a **question** and never as a merge.
 *
 * `core/skills/consolidate/SKILL.md` step 2 merges records that are one **mechanism**. Sharing an
 * incident is not that, and this repository is the counter-example: all three of its shared-incident
 * groups are deliberately distinct facts, because one incident teaches several mechanisms — the
 * enforcement compiler alone minted three. So the pass surfaces the group and states the question a
 * human answers; a pass that concluded *merge these* would be making the policy decision step 3
 * forbids it from making about contradictions, one step earlier.
 *
 * Expected standing yield on this repository: **three groups**, all already judged separate. That is
 * said out loud so a reader of the first real pass does not read three known answers as three open
 * ones.
 */
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

/** How close a measured figure is to its budget — `null` when nothing declared one to be close to. */
export function budgetHeadroom(actual, budget) {
    if (budget === undefined) return null;
    return { actual: Number(actual.toFixed(1)), budget, percent: Math.round((actual / budget) * 100) };
}

/**
 * Lines in the index a store renders **now** — the number the `lines` budget is denominated in.
 *
 * The rendered text, never the committed file. Reading the committed bytes was the first cut and got
 * the direction wrong exactly where a pressure signal must not: a store that has just grown carries a
 * committed index one line short, so the headroom would look *larger* the moment it got smaller. Two
 * of Copilot's rounds on #85 walked into this from opposite ends — one caught a comment describing the
 * trade backwards, the next caught that the trade should not have been taken at all.
 *
 * `null` in, `0` out, and it means *nothing to measure*: either the workspace declares no index, or a
 * title disagreement stopped the render — and that is `index`'s red on every pull request, not a
 * number for this report to invent.
 */
const renderedLines = (expected) =>
    expected === null || expected === undefined ? 0 : expected.split("\n").length - (expected.endsWith("\n") ? 1 : 0);

// ===========================================================================================
// The record the pass writes
// ===========================================================================================
//
// A pass is a session — the maintainer's ruling of 2026-07-28, taken on a category his 2026-07-25
// cadence ruling predates. So it ends the way every session here ends: a dated handoff, and one
// Session log entry pointing at it. That is why this file renders Markdown at all; the alternative
// was a bespoke report format with a bespoke rail, and the repository already has rails for these two.
//
// Both renderings are held to the shape ../.portulan/verify/docs.sh's `record` check enumerates —
// including the two traps a generated entry can walk into that a hand-written one rarely does: the
// ten-line budget binding every entry dated after 2026-07-28, and issue #79, where an unindented
// `- YYYY-` bullet inside an entry is read as the start of the next one.

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * One series' index, in a sentence — and *none declared* is a state, never a synonym for *current*.
 *
 * One function rather than the expression written twice, because it was written twice and both copies
 * branched on the pair-wide flag. A workspace declaring only one of the two indexes then read
 * "current" about the other, which does not exist.
 *
 * **It reports drift, never a repair, and the tense is the whole of it.** This record is composed
 * before `run` regenerates anything — it has to be, since the record is itself a member of one of the
 * indexed series — and the regeneration can still fail. *Has been regenerated* is therefore a sentence
 * the artifact cannot know to be true at the moment it writes it, and in a local run or a partial
 * failure it is a committed record asserting work that did not happen. What is true when this is
 * written is that the index was out of date **when the pass arrived**, so that is what it says. Raised
 * by Copilot on #85 round two, in the suppressed channel, against three sites at once.
 */
const indexState = (s) => (s.declared ? (s.drifted ? "**was out of date when this pass arrived**" : "current") : "none declared");

/** The pass's handoff: what it looked at, what it found, and the date all of that is true as of. */
export function renderRecord(results, { asOf }) {
    const out = [
        "# Handoff — the librarian's scheduled pass",
        "",
        `**Date:** ${asOf} · **Scheduled librarian pass** · Filed by \`cli/librarian.mjs\` on a cron.`,
        "",
        "**State.** Every figure below is **as of " + asOf + "**, read from git history rather than from the",
        "filesystem, and nothing here is a decision. This pass drafts; the maintainer disposes.",
        "",
        // Counts are read before this record is written, and the ordering is forced rather than
        // incidental: a pass IS a session, so it ends by writing a dated handoff INTO the very series
        // it just counted. Regenerating an index any earlier would leave it stale in the commit the
        // job pushes, `index.sh` would red the pull request, and a scheduled pass could never file
        // anything mergeable. So the series count here is always one lower than the index regenerated
        // in the same pull request, and on #86 a reviewer read that gap as an off-by-one — correctly
        // noticing it, wrongly diagnosing it, because nothing in the artifact said why. A number that
        // needs an explanation it does not carry is what gets read as a defect (issue #90).
        "**What the counts include.** They are as of **read time**, taken before this record existed, so",
        "every series figure below **excludes the handoff this pass is about to write**. Expect the",
        "regenerated index in the same pull request to show exactly one more: the two numbers describe",
        "the series this pass examined and the series as it now stands, and both are true.",
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
                ".",
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
        out.push(
            `**Consolidation.** ${head("Store", c.headroom.store, "KB")}. ${head("Index", c.headroom.index, "lines")}. ` +
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
        "**Open questions.** None raised by machinery. Every nag above is addressed to the maintainer,",
        "and none of them is answered by re-running this pass.",
        "",
        "**Next action.** Read the nags; merge, close, or act. An unmerged pass is itself a nag.",
        "",
        "**Recoverability.** This pass writes this handoff, appends one Session log entry when it is",
        "given a log to append to, and regenerates a memory index only when one had drifted. Nothing",
        "outside the tree is touched. Closing the pull request unopened loses nothing — the next pass",
        "reaches the same conclusions from the same store and says them again.",
        "",
    );
    return out.join("\n");
}

const oldest = (records) => {
    const o = records.reduce((a, b) => (a === null || b.days > a.days ? b : a), null);
    return o ? `\`${o.file}\` at ${plural(o.days, "day")}` : "none — the store is empty";
};

/**
 * The Session log entry: a pointer, at most ten lines, carrying a seam attestation.
 *
 * **The attestation is earned, not asserted.** This pass cannot run the seam scan — the term list
 * lives outside the repository, deliberately, and a machine on a cron has no access to it. It never
 * claims one ran. What it states, and what is true, is that it composes no new prose at run time:
 * every line it writes is a literal from this reviewed file, or a filename, a
 * date git recorded, a count, or a condition quoted verbatim out of a record that passed the scan when
 * it landed. A diff with no new prose cannot carry a new seam hit. The residual limit, stated rather
 * than left to be found: if a term had already leaked into a filename or a record, this pass would
 * quote it forward — but that leak would already be in the history, which is the thing the scan exists
 * to prevent and not something this pass could cause.
 */
export function renderLogEntry(results, { asOf, handoff }) {
    const declared = results.filter((r) => r.declared);
    const stale = declared.reduce((n, r) => n + r.stale.length, 0);
    const seals = declared.reduce((n, r) => n + r.seals.filter((s) => s.due).length, 0);
    const proposals = declared.reduce((n, r) => n + (r.proposals?.filter((p) => p.due).length ?? 0), 0);
    const reindexed = declared.filter((r) => r.index.drifted).map((r) => r.name);
    const incidents = declared.reduce((n, r) => n + r.mining.incidents.candidates.length, 0);
    const paths = declared.reduce((n, r) => n + (r.mining.reviews?.paths.length ?? 0), 0);
    const shared = declared.reduce((n, r) => n + r.consolidation.shared.length, 0);

    // Nine lines, against the ten `.portulan/verify/docs.sh`'s `record` check allows every entry dated
    // after 2026-07-28. The margin is one line and it is deliberate: this entry grew by one line when
    // mining and consolidation joined it, so the next thing added here has to displace something
    // rather than append — which is the right pressure on a generated record that a rail is watching.
    return (
        [
            `- ${asOf} · M5 (Memory lifecycle & librarian) · **Scheduled librarian pass**, filed by`,
            "  `cli/librarian.mjs` rather than by a person: " + `${plural(declared.length, "workspace")} passed,`,
            `  ${stale} stale record(s), ${seals} sealed stamp(s) due for re-validation, ` +
                `${proposals} proposal(s) nagged` +
                // Drift found, not drift repaired: this entry is appended before `run` regenerates,
                // and a log line is permanent. Same correction as `indexState`, same round.
                (reindexed.length ? `, index drift found in ${reindexed.join(", ")}.` : ", no index drift."),
            `  · Mined: ${incidents} incident(s) with nothing pointing back at them, ${paths} path(s) drawing`,
            `  repeat review findings, ${shared} record group(s) citing one incident.`,
            "  · No supervisor checkpoint: a scheduled pass makes no decision for one to grade.",
            "  · Seam scan clean by construction — this pass composes no new prose at run time, so its",
            "  diff carries nothing the scan had not already passed.",
            `  Handoff: [\`${asOf}\`](${handoff}).`,
        ].join("\n") + "\n"
    );
}

// ===========================================================================================
// The command
// ===========================================================================================

const USAGE =
    "usage: node cli/librarian.mjs [--as-of YYYY-MM-DD] [--write] [--log <path>] [--reviews <path>] <workspace-dir> [...]";

/**
 * Parse `argv` strictly, or throw `LibrarianError`.
 *
 * **Strictly**, because the permissive version fails silently in both directions and this tool runs
 * unattended. An unknown flag was dropped, so `--wrtie` produced a run that reported everything it
 * found and wrote nothing — a success message over work that did not happen. And a value-bearing flag
 * with no value ate the next argument, so `--log .portulan` set the log path to a *workspace* and then
 * passed over no workspaces at all: a green having examined nothing, which is the enumeration
 * fail-open this repository has now found five of in its own scaffolding. Raised by Copilot on #81.
 *
 * The residual limit, stated rather than left to be found: `--log .portulan` is *not* detectable here.
 * `.portulan` is a perfectly good value and any `--flag value` grammar consumes it. What catches that
 * caller is the layer above — no workspaces left, so `run` prints the usage and exits 2 rather than
 * reporting a green over an empty list. That check is now the only thing standing between the typo and
 * a pass that examined nothing, which is why it is asserted in the suite rather than assumed.
 *
 * `cli/compile.mjs` parses explicitly for the same reason; this now matches it.
 */
export function parseArgs(argv) {
    const opts = { asOf: undefined, logPath: undefined, reviewsPath: undefined, write: false, dirs: [] };
    const value = (flag, next) => {
        // A flag's value may not be another flag. Without this, `--log --write .portulan` sets the log
        // path to `--write` and silently drops the mode the caller asked for.
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
            case "--log":
                opts.logPath = value(arg, argv[(i += 1)]);
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

export function run(argv, say = console.log) {
    let asOfArg, logPath, reviewsPath, write, dirs;
    try {
        ({ asOf: asOfArg, logPath, reviewsPath, write, dirs } = parseArgs(argv));
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
    } catch (error) {
        say(`  ✗ ${error.message}`);
        return 2;
    }

    let reviews;
    if (reviewsPath !== undefined) {
        // Read here rather than inside the pass so a corpus that cannot be read is a refusal about a
        // file, not a verdict about a workspace — and so `passWorkspace` keeps its property of
        // touching nothing but the tree it was pointed at.
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
            const result = passWorkspace(dir, { asOf, reviews });
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
                    // The regeneration is the last thing this command does, so at this point drift is
                    // all that is known. The line that says it was regenerated is printed below, after.
                    (result.index.drifted ? ", index drift found" : ""),
            );
        } catch (error) {
            if (!(error instanceof LibrarianError)) throw error;
            say(`  ✗ ${dir}: ${error.message}`);
            // Exit 2 wins, and every workspace is still passed first: a run that could not read one
            // target has not done what it was asked, and must not hide what it did manage to find.
            worst = 2;
        }
    }

    const filing = results.find((r) => r.declared && r.handoffsDir);
    if (write && results.some((r) => r.declared) && !filing) {
        // A pass is a session (the maintainer's ruling, 2026-07-28), and a session ends with a dated
        // handoff. A workspace with nowhere to put one cannot end a session, so this is said out loud
        // rather than being a silent no-op that looks like a clean run.
        say("  ✗ no workspace declares a `slots.handoffs`, so this pass has nowhere to record itself");
        worst = 2;
    } else if (write && filing) {
        const record = renderRecord(results, { asOf });
        const name = `${asOf}-librarian-pass.md`;
        const target = path.join(filing.handoffsDir, name);
        try {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, record);
            say(`  ok wrote ${target}`);
            if (logPath) {
                // Relative to the LOG's directory, derived from the two paths rather than spelled —
                // the slot exists so a directory name is never assumed, and a hardcoded
                // `../.portulan/handoffs/` sat three lines under the comment saying so. Getting it
                // wrong dangles a link in the file every session reads to boot, and `docs.sh` would
                // catch it only after the pass had already filed.
                const href = path.posix
                    .relative(path.posix.dirname(posix(path.resolve(logPath))), posix(target))
                    .split(path.sep)
                    .join(path.posix.sep);
                const entry = renderLogEntry(results, { asOf, handoff: href });
                const current = fs.readFileSync(logPath, "utf8");
                fs.writeFileSync(logPath, current.replace(/\n*$/, "\n\n") + entry);
                say(`  ok appended a Session log entry to ${logPath}`);
            }
        } catch (cause) {
            say(`  ✗ cannot write the pass record — ${cause.code ?? cause.message}`);
            worst = 2;
        }
    }

    // ---- the indexes, LAST, and that is the ordering this whole split exists for.
    //
    // A pass is a session, so it just wrote a dated handoff into `slots.handoffs` — a member of the
    // series the handoff index covers. Regenerated any earlier, that index would be stale in the very
    // commit the pass pushes, and `index.sh` would red the pull request the pass exists to file. The
    // failure would have arrived on the first real run, unattended, on the one artifact this
    // milestone's criterion names. So the rule is one sentence with no exceptions in it: **nothing
    // regenerates an index until every record this pass writes is on disk.**
    //
    // Only in write mode, and never when the record could not be written: an index regenerated over a
    // series missing the handoff that belongs in it would be current about the wrong tree.
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
