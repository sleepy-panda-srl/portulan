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

import { inspect as inspectIndex, IndexError, recordType } from "./index.mjs";
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
const KNOWN_SPECS = new Set(["2.0", "2.1", "2.2", "2.3", "2.4"]);

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
 * A file git cannot date is **refused**. Treating it as new is the fail-open — the single record
 * nothing can date is precisely the one a staleness pass must not wave through — and treating it as
 * ancient is a false red on a file somebody just wrote.
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
 * With `write`, the memory index is regenerated; without it, drift is reported and nothing is touched.
 */
export function passWorkspace(dir, { asOf, write = false } = {}) {
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

    // ---- reindex
    //
    // **Drift is read BEFORE the write, and that ordering is the whole of it.** `inspect` in write
    // mode regenerates the index and *then* compares, so it never reports drift — it has just removed
    // it. Reading `drifted` off that result therefore said "current" about an index the pass had
    // regenerated one line earlier, and the Session log entry it generates said "no index drift" in
    // the same breath: a machine-written record of what a run did, wrong about the one thing the run
    // actually changed. Raised by Copilot on #81, in the suppressed half of the round, against three
    // sites at once. So the check runs first and unconditionally, and the write follows.
    let index = { declared: false, regenerated: false, findings: [] };
    try {
        const before = inspectIndex(dir, { write: false });
        const regenerated = write && before.findings.some((f) => f.check === "index");
        const result = write ? inspectIndex(dir, { write: true }) : before;
        index = {
            declared: result.declared,
            // In check mode this is *drift found and not repaired*; in write mode it is *drift found
            // and repaired*. Both are "the index was out of date when the pass arrived", which is the
            // fact the record is reporting, and the mode says which half happened.
            regenerated: write ? regenerated : before.findings.some((f) => f.check === "index"),
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

    for (const file of listMarkdown(storeDir)) {
        const full = path.join(storeDir, file);
        let source;
        try {
            source = fs.readFileSync(full, "utf8");
        } catch (cause) {
            throw new LibrarianError(`cannot read the record ${path.join(memorySlot, file)} — ${cause.code ?? cause.message}`);
        }
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
    const handoffs = workspace.slots?.handoffs ? path.resolve(dir, workspace.slots.handoffs) : null;

    return { dir, name, declared: true, thresholds, index, records, stale, seals, drafts, proposals, counts, handoffs };
}

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
                (r.index.declared ? (r.index.regenerated ? "**was out of date and has been regenerated**" : "current") : "none declared") +
                ".",
            "",
        );

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
    const reindexed = declared.filter((r) => r.index.regenerated).map((r) => r.name);

    return (
        [
            `- ${asOf} · M5 (Memory lifecycle & librarian) · **Scheduled librarian pass**, filed by`,
            "  `cli/librarian.mjs` rather than by a person: " + `${plural(declared.length, "workspace")} passed,`,
            `  ${stale} stale record(s), ${seals} sealed stamp(s) due for re-validation, ` +
                `${proposals} proposal(s) nagged` +
                (reindexed.length ? `, index regenerated for ${reindexed.join(", ")}.` : ", no index drift."),
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

const USAGE = "usage: node cli/librarian.mjs [--as-of YYYY-MM-DD] [--write] [--log <path>] <workspace-dir> [...]";

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
    const opts = { asOf: undefined, logPath: undefined, write: false, dirs: [] };
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
    let asOfArg, logPath, write, dirs;
    try {
        ({ asOf: asOfArg, logPath, write, dirs } = parseArgs(argv));
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

    const results = [];
    let worst = 0;
    for (const dir of dirs) {
        try {
            const result = passWorkspace(dir, { asOf, write });
            results.push(result);
            if (!result.declared) {
                say(`  · ${dir}: declares no librarian pass`);
                continue;
            }
            say(
                `  ok ${dir}: ${plural(result.counts.records, "record")}, ${result.stale.length} stale, ` +
                    `${result.seals.filter((s) => s.due).length} seal(s) due, ` +
                    `${result.proposals?.filter((p) => p.due).length ?? 0} proposal(s) nagged` +
                    (result.index.drifted ? ", index regenerated" : ""),
            );
        } catch (error) {
            if (!(error instanceof LibrarianError)) throw error;
            say(`  ✗ ${dir}: ${error.message}`);
            // Exit 2 wins, and every workspace is still passed first: a run that could not read one
            // target has not done what it was asked, and must not hide what it did manage to find.
            worst = 2;
        }
    }

    const filing = results.find((r) => r.declared && r.handoffs);
    if (write && results.some((r) => r.declared) && !filing) {
        // A pass is a session (the maintainer's ruling, 2026-07-28), and a session ends with a dated
        // handoff. A workspace with nowhere to put one cannot end a session, so this is said out loud
        // rather than being a silent no-op that looks like a clean run.
        say("  ✗ no workspace declares a `slots.handoffs`, so this pass has nowhere to record itself");
        worst = 2;
    } else if (write && filing) {
        const record = renderRecord(results, { asOf });
        const name = `${asOf}-librarian-pass.md`;
        const target = path.join(filing.handoffs, name);
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

    return worst;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exit(run(process.argv.slice(2)));
}
