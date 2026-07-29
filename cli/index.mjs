#!/usr/bin/env node
// `index` — the memory index generator, and the rail on what memory may cost.
//
//   node cli/index.mjs [--check] <workspace-dir> [<workspace-dir> ...]
//
// Exit 0 every index is current and within budget · 1 one is not · 2 could not run.
//
// ../core/operating/memory.md gives the store four states, and this is the third: "a size-budgeted
// index is generated so the right memory is recalled without loading all of it. The index is built,
// never hand-maintained." Before this file existed the *built* half was a promise and the *budgeted*
// half was a sentence binding review — which ../.portulan/memory/a-mandate-nothing-checks-is-already-broken.md
// says is another way of spelling broken.
//
// ## What is budgeted, and why two numbers rather than one
//
// The index is the layer that gets loaded to decide what else to load, so its size is what memory
// costs on every recall — that is the `lines` budget, and with one line per record it is a rail on
// record COUNT. It cannot see the other axis: a store of unchanged record count can grow without
// limit in bytes, and nothing in the index would move. So the store's own size is budgeted too, in
// KB, against the same measure `doctor` already reports. The maintainer's directive was "memory
// growing too large"; one number would have covered half of it.
//
// A third number, `columns`, closes the hole a line budget has — one record whose line is enormous
// absorbs what the line budget is counting. It is refused rather than truncated, because a silently
// shortened title is a generated file disagreeing with the store it was generated from, which is the
// class of defect this whole file exists to make impossible.
//
// **None of the three is defaulted.** An undeclared budget is not checked. Defaulting would be this
// project setting policy for every workspace that ever adopts the spec, in a key nobody typed —
// the rule spec 2.2 already applies to the gate policy's `floor` object.
//
// ## The remedy on breach is consolidation, never a larger budget
//
// Stated in ../core/operating/memory.md and carried out by ../core/skills/consolidate/SKILL.md.
// What this tool can enforce is the breach; it cannot enforce the remedy. Refusing a budget RAISE
// would mean reading git history, and a check that reads history is a false-red generator in a
// shallow CI checkout — the failure ../.portulan/verify/README.md holds to be worse than no check.
// So the raise stays at the human gate, and the limit is written down rather than implied away.
//
// ## Why this generator writes an over-budget index instead of refusing to
//
// Because the remedy is consolidation, and consolidating needs the artifact to consolidate FROM.
// A generator that will not emit what breaches leaves the author holding a red and no file. So it
// emits, and then judges — the one place in this repository where writing and verdict are separate
// steps on purpose.
//
// Zero dependencies, no network, no install step — same constraints as ./doctor.mjs and
// ./compile.mjs. Absorbed by the TypeScript CLI at milestone 7, where `index` is one of the six
// subcommands ../docs/vision.md names. (A note for that session: this file is `cli/index.mjs`
// because the subcommand is called `index`, and npm packaging conventionally wants that name for a
// package entry point. The collision is inherited deliberately rather than discovered.)

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Raised when `index` cannot run, or cannot judge honestly. Always exit 2, never 1. */
export class IndexError extends Error {
    constructor(message) {
        super(message);
        this.name = "IndexError";
    }
}

// The Workspace Definition versions whose shape this tool reads. The `memory` object arrives at 2.3
// and is optional, so an earlier manifest is read correctly — it simply declares no index, which is
// a legitimate shape and the one every workspace had yesterday. Same reasoning as ./compile.mjs's
// KNOWN_SPECS, and the same refusal for anything outside the set: a tool that reads a manifest it
// does not understand reports about a workspace it may have misread.
const KNOWN_SPECS = new Set(["2.0", "2.1", "2.2", "2.3", "2.4", "2.5"]);

// The store's own signpost, not a record. `doctor` excludes exactly this name from its walk, so the
// two tools agree on what the store contains; disagreeing would put a record in the index that the
// store report does not count, or the reverse.
const NOT_A_RECORD = new Set(["README.md"]);

const KB = 1024;

/**
 * Is `child` inside `parent`? Exported because `doctor` asks the same question about the same two
 * paths, and the obvious spelling — `!path.relative(parent, child).startsWith("..")` — is wrong in a
 * way that fails OPEN.
 *
 * A name beginning with `..` is an ordinary filename, not a traversal: `path.relative` of
 * `memory/..index.md` against `memory/` is `..index.md`, which `startsWith("..")` calls *outside*.
 * Measured end to end before this was written — an index declared at `memory/..index.md` was written
 * into the store, reported `ok`, and `doctor` then counted it as a second record, reporting it for
 * stating no retirement condition. That is precisely the outcome the siting rule exists to prevent,
 * in the check chosen over a filename exemption **because** an exemption would be a door any record
 * could walk through. The door was in the containment test. Found by Copilot on #72, in the
 * suppressed half of the round; ninth fail-open found in this repository's scaffolding, and the
 * first one written by the change that cites the class.
 *
 * Only `..` exactly, or `..` followed by a separator, means outside. An absolute result means the
 * two paths share no root and cannot contain one another.
 *
 * It lives here and `doctor` imports it, on the reasoning that already put `compile`'s accounting
 * behind one import: two copies of a rule drift, and these two copies drifted into the identical
 * defect before either had shipped.
 */
export function isInside(parent, child) {
    const rel = path.relative(parent, child);
    if (rel === "") return true;
    if (path.isAbsolute(rel)) return false;
    return rel !== ".." && !rel.startsWith(`..${path.sep}`);
}

// ===========================================================================================
// Titles
// ===========================================================================================
//
// A record's title is its FILENAME. That is not a preference — it is the only title every record
// already has: ../core/templates/memory-entry.md prescribes no heading, and 24 of the 27 live
// records carry none. It is also the title every cross-reference in this repository already uses,
// since links to records are written with the path as the link text.
//
// The three records that DO carry an H1 are the reason for the check below rather than an argument
// against the rule. Two carriers of a name are tolerable; two answers are not.

/**
 * A record's declared `**type:**`, lowercased — `""` when it declares none.
 *
 * The one carrier. Three tools ask this of the same records — this one puts it on every index line,
 * `./doctor.mjs` decides by it which records provenance is mandatory on, and `./librarian.mjs` needs
 * it because thesis 4's mandates are rule-scoped — and all three carried their own spelling of the
 * regex, which is half of what issue #74 is about. It lives here rather than in `./doctor.mjs`
 * because that module already imports `isInside` from this one, and the reverse direction would make
 * the graph a cycle for no gain.
 */
export const recordType = (source) => (source.match(/^\s*\*\*type:\*\*\s*(\S+)/im)?.[1] ?? "").toLowerCase();

/** `a-review-loop-needs-a-bound.md` → `A review loop needs a bound`. */
export function titleOf(filename) {
    const stem = filename.replace(/\.md$/i, "");
    const words = stem.split("-").filter(Boolean).join(" ");
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The record's H1, or null — read from the document's **first non-blank line only**.
 *
 * The obvious spelling, a multiline `^#` match, is a false-red generator and was measured as one
 * before this comment was written: a record with no heading at all but a shell comment at column 0
 * inside a fenced block — `# regenerate the thing` — came back as carrying that heading, and the
 * title check failed a record whose filename was never in question. `docs.sh` has the same blind
 * spot with code spans and states it in Known limits rather than parsing Markdown; this takes the
 * cheaper repair available here, because a record's title can only be its first line.
 *
 * The residual limit, stated rather than left to be found: a heading further down the document is
 * not read, so a record whose *second* section is an `# H1` disagreeing with the filename passes.
 * That is the right trade — the failure it lets through is a stray heading nobody navigates by, and
 * the failure it prevents is a red on a record that is correct, which is what gets a check switched
 * off (../.portulan/verify/README.md).
 */
export function headingOf(source) {
    const first = source.split("\n").find((line) => line.trim() !== "");
    return first?.match(/^#[ \t]+(.+?)[ \t]*$/)?.[1] ?? null;
}

/**
 * A handoff's date, read from the leading `YYYY-MM-DD` of its filename — or `null`.
 *
 * ../core/operating/loop.md fixes the form as `YYYY-MM-DD-{slug}.md` and argues why the date is in the
 * filename rather than in the prose: a date buried in a document needs parsing and is written
 * differently by every author, while a filename sorts chronologically for free. This reads the carrier
 * that rule already established rather than adding a second one.
 *
 * **Validated, not merely matched.** `2026-13-45-impossible.md` matches the shape and names no day. An
 * index whose leading column is an unparseable string is a chronological index that is not
 * chronological, and every consumer downstream — the pass that ages the series, a reader scanning for
 * a month — would be reading a slug. The round-trip through `Date.UTC` is the cheapest complete check:
 * it rejects month 13, day 45, and 30 February, none of which a regex can see.
 *
 * `null` is a refusal, never a default. ../.portulan/verify/docs.sh already fails an undated file in
 * the series; this is not a second opinion about that rule but the generator being unable to derive a
 * field it must emit.
 */
export function dateOf(filename) {
    const m = filename.match(/^(\d{4})-(\d{2})-(\d{2})-/);
    if (!m) return null;
    const [, y, mo, d] = m;
    const at = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    const iso = `${y}-${mo}-${d}`;
    return at.toISOString().slice(0, 10) === iso ? iso : null;
}

// Compared with punctuation and case removed, because a filename cannot carry either. "Who may
// commit is verified, not assumed" is the same title as `who-may-commit-is-verified-not-assumed.md`
// and must not be reported as a disagreement — a check that reds on a comma is a false-red machine,
// and a false red is what gets a whole check switched off (../.portulan/verify/README.md).
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

// ===========================================================================================
// Reading the store
// ===========================================================================================

/**
 * Read a workspace's memory store.
 *
 * Returns `{ records: [{ file, title, type, heading }], bytes }`. Throws `IndexError` rather than
 * returning an empty store for anything it cannot read: an empty list renders an empty index, and an
 * empty index compares equal to an empty committed one and passes — the enumeration fail-open this
 * repository has now fixed four times (../.portulan/memory/verify-preconditions-fail-closed.md).
 */
/**
 * The `.md` files of a series, sorted, or an `IndexError`.
 *
 * One enumeration for both series, because the failure it guards is the same one and this repository
 * has now fixed it four times: an unreadable directory returning `[]` renders an empty index, and an
 * empty index compares byte-equal to an empty committed one and passes
 * (../.portulan/memory/verify-preconditions-fail-closed.md). A second copy of this three-line function
 * is a second place for that to be got wrong.
 */
function listSeries(seriesDir, slot, what) {
    let names;
    try {
        names = fs.readdirSync(seriesDir);
    } catch (cause) {
        throw new IndexError(
            `cannot read the ${what} at ${slot} — ${cause.code ?? cause.message}. ` +
                "Refusing to render an index of nothing: an empty index compares equal to an empty committed one and would pass",
        );
    }
    return names.filter((n) => n.endsWith(".md") && !NOT_A_RECORD.has(n)).sort();
}

export function readStore(dir, workspace) {
    const slot = workspace?.slots?.memory;
    if (!slot) {
        throw new IndexError(
            "the manifest declares a `memory` budget but no `slots.memory` store — there is nothing to index. " +
                "The declared JSON Schema subset has no `dependentRequired` (spec/README.md), so this is checked here and by `doctor`",
        );
    }

    const storeDir = path.resolve(dir, slot);
    const files = listSeries(storeDir, slot, "memory store");
    const records = [];
    let bytes = 0;

    for (const file of files) {
        let source;
        try {
            source = fs.readFileSync(path.join(storeDir, file), "utf8");
        } catch (cause) {
            // Present and unreadable is not "absent". Skipping it would drop a record from the index
            // silently, which is precisely the shape a generated file must never have.
            throw new IndexError(`cannot read the record ${path.join(slot, file)} — ${cause.code ?? cause.message}`);
        }
        bytes += Buffer.byteLength(source);
        records.push({
            file,
            title: titleOf(file),
            // `untyped` rather than a failure: `doctor` already reports a record with no `**type:**`
            // line, and legislating one field in two tools with two severities is how two checkers
            // start disagreeing about one store.
            type: recordType(source) || "untyped",
            heading: headingOf(source),
        });
    }

    return { records, bytes };
}

/**
 * Read a workspace's handoff series.
 *
 * Returns `{ records: [{ file, date, heading }], bytes }`, **newest first** — reverse filename order,
 * which is reverse chronological because the filename leads with the date. Two handoffs of the same
 * date fall in reverse slug order, which carries no claim about which was written first; nothing in
 * the series records that, and inventing an order would be the generated file asserting something its
 * source does not say.
 *
 * `date` and `heading` may be `null`. They are not repaired here — the judge reports them, with a
 * different repair for each, and emits no index at all while either is missing.
 */
export function readHandoffs(dir, workspace) {
    const slot = workspace?.slots?.handoffs;
    if (!slot) {
        throw new IndexError(
            "the manifest declares a `handoffs` index but no `slots.handoffs` series — there is nothing to index. " +
                "The declared JSON Schema subset has no `dependentRequired` (spec/README.md), so this is checked here and by `doctor`",
        );
    }

    const seriesDir = path.resolve(dir, slot);
    const files = listSeries(seriesDir, slot, "handoff series").reverse();
    const records = [];
    let bytes = 0;

    for (const file of files) {
        let source;
        try {
            source = fs.readFileSync(path.join(seriesDir, file), "utf8");
        } catch (cause) {
            throw new IndexError(`cannot read the handoff ${path.join(slot, file)} — ${cause.code ?? cause.message}`);
        }
        bytes += Buffer.byteLength(source);
        records.push({ file, date: dateOf(file), heading: headingOf(source) });
    }

    return { records, bytes };
}

// ===========================================================================================
// Rendering
// ===========================================================================================
//
// One line per record: title, path, type. Everything on the line is derived, so nothing in the file
// can be edited into disagreement with the store — which is what "built, never hand-maintained"
// has to mean if it is to be checkable at all.
//
// `scope` is deliberately NOT on the line. It was measured before it was excluded: all 27 live
// records across both stores carry the same scope head, `workspace`. A field that never varies buys
// no recall and still costs the budget it is counted against, and ../core/operating/evolution.md
// asks every line of context to earn its place.

/** The index as text, for a workspace and the store `readStore` returned. */
export function render(workspace, store) {
    const indexPath = workspace?.memory?.index?.path;
    const lineBudget = workspace?.memory?.index?.budget?.lines;
    const slot = workspace.slots.memory;

    // Links resolve from the index's own directory, not the workspace root — so an index sited
    // anywhere still links correctly, and `docs.sh`'s links check holds it to that. Everything here
    // is posix: these strings end up in a Markdown file that GitHub renders, where a backslash is a
    // character in a filename rather than a separator.
    const posix = (p) => p.split(path.sep).join(path.posix.sep);
    const from = path.posix.dirname(posix(indexPath));

    const header = [
        `# Memory index — ${workspace.name}`,
        "",
        `> Generated from \`${slot}\` by \`node cli/index.mjs\`. Do not edit by hand: it is regenerated`,
        `> and byte-compared, so a hand-edit survives exactly until the next run.`,
        `> ${store.records.length} record(s)` + (lineBudget ? ` · budget ${lineBudget} lines.` : "."),
        "",
    ];

    const entries = store.records.map((r) => {
        const href = path.posix.relative(from, path.posix.join(posix(slot), r.file));
        return `- [${r.title}](${href}) — ${r.type}`;
    });

    return [...header, ...entries].join("\n") + "\n";
}

/**
 * The handoff index as text.
 *
 * Two derived fields per line — the date off the filename, the title off the record's own H1 — and the
 * link. The title carrier differs from the store's **because the evidence differs**: a memory record
 * usually has no heading, so its filename is the only title it has; a handoff always has one, and its
 * filename leads with a date, so `titleOf` would render `2026 07 28 the librarian goes on a cron`. A
 * generator that picked one rule for both series would be choosing consistency over correctness in the
 * one file whose whole claim is that it agrees with its source.
 *
 * The header states the absent budget rather than leaving its absence to be read as an oversight — the
 * argument is in spec/slots.md and ../core/operating/memory.md, and this is the sentence a reader of
 * the artifact gets.
 *
 * **The H1 is printed as written, and the redundancy that produces is deliberate.** Every handoff here
 * opens `# Handoff — …`, so every line of the index repeats the word. Stripping that prefix was the
 * obvious tidy-up and is refused: it is a rule about the series' *content*, which this generator does
 * not own, and it would render two handoffs differently for a difference that really exists between
 * them — a generated file quietly normalising its source is the failure this whole file is built to
 * make impossible. If the repetition is worth removing, the repair is to reword the headings, which
 * changes the fact rather than the report of it.
 */
export function renderHandoffIndex(workspace, series) {
    const indexPath = workspace?.handoffs?.index?.path;
    const slot = workspace.slots.handoffs;

    const posix = (p) => p.split(path.sep).join(path.posix.sep);
    const from = path.posix.dirname(posix(indexPath));

    const header = [
        `# Handoff index — ${workspace.name}`,
        "",
        `> Generated from \`${slot}\` by \`node cli/index.mjs\`. Do not edit by hand: it is regenerated`,
        `> and byte-compared, so a hand-edit survives exactly until the next run.`,
        `> ${series.records.length} handoff(s), newest first. No budget: the series is append-only, so`,
        `> the only remedy a budget could ask for is one this project rules out.`,
        "",
    ];

    const entries = series.records.map((r) => {
        const href = path.posix.relative(from, path.posix.join(posix(slot), r.file));
        return `- ${r.date} · [${r.heading}](${href})`;
    });

    return [...header, ...entries].join("\n") + "\n";
}

/** The number of lines in a rendered index — the unit the `lines` budget is denominated in. */
const lineCount = (text) => text.split("\n").length - (text.endsWith("\n") ? 1 : 0);

// ===========================================================================================
// The verdict
// ===========================================================================================

/**
 * Judge one workspace's index.
 *
 * Returns `{ dir, declared, path, expected, findings }`. A finding is `{ severity, check, message }`
 * with severity `fail` (exit 1); `check` is one of `title`, `index`, `budget`. Throws `IndexError`
 * (exit 2) for anything that is not a verdict about a store.
 *
 * The three checks are kept apart on purpose. *The index is stale* is repaired by running the
 * generator; *the index is over budget* is repaired by consolidating the store; *a record's H1
 * disagrees with its filename* is repaired by editing the record. A single "index check failed"
 * would send an author to regenerate a file that is already correct and still too big.
 */
export function inspect(dir, { write = false } = {}) {
    const manifestPath = path.join(dir, "workspace.json");
    let workspace;
    try {
        workspace = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (cause) {
        throw new IndexError(`cannot read ${manifestPath} — ${cause.message}`);
    }

    const spec = workspace?.portulan?.spec;
    if (!KNOWN_SPECS.has(String(spec))) {
        throw new IndexError(
            `${dir} declares Workspace Definition ${JSON.stringify(spec)}, which this tool does not implement ` +
                `(knows: ${[...KNOWN_SPECS].join(", ")}). Refusing rather than indexing a manifest it may misread`,
        );
    }

    const findings = [];
    const fail = (series, check, message) => findings.push({ severity: "fail", series, check, message });

    const memory = judgeMemory(dir, workspace, { write, fail });
    const handoffs = judgeHandoffs(dir, workspace, { write, fail });

    return {
        dir,
        declared: memory.declared || handoffs.declared,
        series: { memory, handoffs },
        findings,
    };
}

/**
 * Refuse an index sited inside the series it indexes, and return its resolved path.
 *
 * One rule, one implementation, two series — and it is refused rather than special-cased for the same
 * reason in both. In the store, `doctor` counts every `.md` as a record, so an index living there is
 * counted, sized into the KB figure, and reported for stating no retirement condition. In the handoff
 * series, `docs.sh`'s correspondence check counts every dated `.md` as a handoff and fails every
 * undated one, so an index there is either an extra handoff or a red. The alternative repair —
 * excluding the index's filename from each walk — is a door any record could use, and this repository
 * had found eight fail-opens of that shape in its own scaffolding before it stopped taking that door.
 */
function siteOutside(dir, declaredPath, slot, word) {
    const indexPath = path.resolve(dir, declaredPath);
    if (slot && isInside(path.resolve(dir, slot), indexPath)) {
        throw new IndexError(
            `${declaredPath} sits inside the ${word} it indexes (${slot}) — a walk over that directory ` +
                `would count the index as one of its members. Site the index beside the ${word}, not in it`,
        );
    }
    return indexPath;
}

/**
 * Write (when asked) and byte-compare one generated index.
 *
 * Shared, because the ways this goes wrong are the same ways for every series and each has already
 * been paid for once. **Never written in check mode** — a verify recipe that repairs what it is
 * checking always passes, the property ../.portulan/verify/compile.sh was built around. **A failed
 * write is an `IndexError`, not a red** — an uncaught ENOENT here exits node with 1, which `index.sh`
 * passes through as "the index has drifted", said about a series nothing had judged, for what is a
 * configuration problem (`a-checker-must-refuse-what-it-cannot-check`; found by Copilot on #72).
 */
function compareOrWrite({ dir, declaredPath, indexPath, expected, write, series, source, fail }) {
    if (write) {
        try {
            fs.mkdirSync(path.dirname(indexPath), { recursive: true });
            fs.writeFileSync(indexPath, expected);
        } catch (cause) {
            throw new IndexError(
                `cannot write the index at ${declaredPath} — ${cause.code ?? cause.message}. ` +
                    `Refusing rather than reporting a verdict about the ${source}: this is a fact about the filesystem, not about memory`,
            );
        }
    }

    let actual = null;
    try {
        actual = fs.readFileSync(indexPath);
    } catch { /* absent — reported below, and never repaired here */ }

    if (actual === null) {
        fail(series, "index", `${declaredPath} is declared and absent — run \`node cli/index.mjs ${dir}\` to generate it`);
    } else if (!actual.equals(Buffer.from(expected, "utf8"))) {
        fail(series, "index", `${declaredPath} is out of date against the ${source} — run \`node cli/index.mjs ${dir}\` to regenerate it`);
    }
}

/** The memory store's index and its budgets. */
function judgeMemory(dir, workspace, { write, fail }) {
    const memory = workspace.memory;
    if (!memory) return { declared: false, path: null, expected: null };

    const declaredPath = memory.index?.path;
    if (!declaredPath) {
        // A budget with no index is coherent — a workspace may rail its store's size and generate
        // nothing — so this is not an error. There is simply no file to render.
        const store = readStore(dir, workspace);
        budgetFindings(memory, store, null, fail);
        return { declared: true, path: null, expected: null };
    }

    const indexPath = siteOutside(dir, declaredPath, workspace.slots?.memory, "store");
    const store = readStore(dir, workspace);

    // Titles first, and alone. A disagreement means there is no correct line to emit for that
    // record, so rendering anyway would produce a generated file the generator knows is wrong.
    let broken = 0;
    for (const r of store.records) {
        if (r.heading && normalize(r.heading) !== normalize(r.title)) {
            broken += 1;
            fail(
                "memory",
                "title",
                `${path.join(workspace.slots.memory, r.file)} carries the heading "${r.heading}", which is not its filename's title ` +
                    `"${r.title}". A record may hold two carriers of its name; it may not hold two answers — ` +
                    "rename the file or reword the heading",
            );
        }
    }
    // Scoped to this series, not to the whole run. A broken record title says nothing about whether
    // the handoff index is current, and returning early on the shared list would have made one
    // series' defect silence the other's verdict — a green by omission, which is the shape this file
    // exists to refuse.
    if (broken) return { declared: true, path: indexPath, expected: null };

    const expected = render(workspace, store);
    compareOrWrite({ dir, declaredPath, indexPath, expected, write, series: "memory", source: "store", fail });
    budgetFindings(memory, store, expected, fail);

    return { declared: true, path: indexPath, expected };
}

/**
 * The handoff series' index. No budget — see spec/slots.md: every remedy a budget could ask for on an
 * append-only series is barred, so a rail here is one built to be broken.
 */
function judgeHandoffs(dir, workspace, { write, fail }) {
    const declaredPath = workspace.handoffs?.index?.path;
    if (!declaredPath) return { declared: false, path: null, expected: null };

    const indexPath = siteOutside(dir, declaredPath, workspace.slots?.handoffs, "series");
    const series = readHandoffs(dir, workspace);

    // Two derived fields, two ways to be underivable, two repairs — so two checks. `date` is repaired
    // by renaming the file; `title` by editing it. One "handoff malformed" would send an author to
    // the wrong one half the time.
    let broken = 0;
    for (const r of series.records) {
        const where = path.join(workspace.slots.handoffs, r.file);
        if (r.date === null) {
            broken += 1;
            fail(
                "handoffs",
                "date",
                `${where} does not lead with a valid YYYY-MM-DD date, so the index has no date to put on its line. ` +
                    "core/operating/loop.md fixes the form as `YYYY-MM-DD-{slug}.md` — rename the file",
            );
        }
        if (r.heading === null) {
            broken += 1;
            fail(
                "handoffs",
                "title",
                `${where} carries no \`# \` heading on its first non-blank line, so the index has no title to put on its line. ` +
                    "A handoff's title is its H1 — the filename leads with a date and would render as one. Give it a heading",
            );
        }
    }
    if (broken) return { declared: true, path: indexPath, expected: null };

    const expected = renderHandoffIndex(workspace, series);
    compareOrWrite({ dir, declaredPath, indexPath, expected, write, series: "handoffs", source: "series", fail });

    return { declared: true, path: indexPath, expected };
}

// A declared budget must be a positive integer. Without this, `lines: 0` — or `lines: -1`, or
// `lines: "60"` — reads as falsy and turns the rail OFF, silently, in a key whose whole purpose is
// to be on. The schema cannot catch it: the declared keyword subset has no `minimum`, so `type:
// "number"` is the strongest constraint expressible there (spec/README.md). Exit 2 rather than a
// red, because it is a defect in the policy rather than a verdict about the store.
const positive = (v) => typeof v === "number" && Number.isInteger(v) && v > 0;

function budgetNumber(value, where) {
    if (value === undefined) return undefined;
    if (!positive(value)) {
        throw new IndexError(
            `${where} is ${JSON.stringify(value)}, which is not a positive integer. A budget that is zero, ` +
                "negative or non-numeric would read as undeclared and switch the rail off in the key that exists to switch it on",
        );
    }
    return value;
}

/** The three budget checks, each skipped when the workspace declares no number for it. */
function budgetFindings(memory, store, expected, fail) {
    const lines = budgetNumber(memory.index?.budget?.lines, "memory.index.budget.lines");
    const columns = budgetNumber(memory.index?.budget?.columns, "memory.index.budget.columns");
    const kilobytes = budgetNumber(memory.store?.budget?.kilobytes, "memory.store.budget.kilobytes");

    if (expected !== null && lines) {
        const count = lineCount(expected);
        if (count > lines) {
            fail(
                "memory",
                "budget",
                `the index is ${count} lines against a budget of ${lines} — over by ${count - lines}. ` +
                    "Consolidate the store (merge, compress, retire); raising the budget in the change that broke it " +
                    "is the one repair core/operating/memory.md rules out",
            );
        }
    }

    if (expected !== null && columns) {
        for (const line of expected.split("\n")) {
            if (line.length > columns) {
                fail(
                    "memory",
                    "budget",
                    `an index line is ${line.length} columns against a cap of ${columns}: ${JSON.stringify(line.slice(0, 60) + "…")}. ` +
                        "Shorten the record's filename — the cap exists so one long line cannot absorb what the line budget counts",
                );
                break;
            }
        }
    }

    if (kilobytes) {
        const kb = store.bytes / KB;
        if (kb > kilobytes) {
            // The exact byte count rides along with the rounded figure, because rounding alone can
            // print a sentence that contradicts its own verdict: 1025 bytes is `1.0 KB` against a
            // budget of `1 KB`, which reads as within budget in the message announcing that it is
            // not. A red whose sentence argues against it is worse than no message. Found by Copilot
            // on #72. (`doctor`'s retirement note rounds the same way and is left alone: it states a
            // size and compares it with nothing, so there is no verdict for the rounding to
            // contradict.)
            fail(
                "memory",
                "budget",
                `the store is ${kb.toFixed(1)} KB (${store.bytes} bytes) against a budget of ${kilobytes} KB (${kilobytes * KB} bytes). ` +
                    "This is the axis the index cannot see: record count can hold still while the store grows",
            );
        }
    }
}

// ===========================================================================================
// The command
// ===========================================================================================

export function run(argv, say = console.log) {
    const check = argv.includes("--check");
    const dirs = argv.filter((a) => a !== "--check");

    if (dirs.length === 0) {
        say("usage: node cli/index.mjs [--check] <workspace-dir> [<workspace-dir> ...]");
        return 2;
    }

    let worst = 0;
    for (const dir of dirs) {
        let result;
        try {
            result = inspect(dir, { write: !check });
        } catch (error) {
            if (!(error instanceof IndexError)) throw error;
            say(`  ✗ ${dir}: ${error.message}`);
            // Exit 2 wins over a red from another workspace: a run that could not judge one of its
            // targets has not produced the verdict the caller asked for, and reporting 1 would claim
            // it did. Every workspace is still judged first, so one broken manifest does not hide
            // the others' findings.
            worst = 2;
            continue;
        }

        if (!result.declared) {
            say(`  · ${dir}: declares no index`);
            continue;
        }
        for (const f of result.findings) say(`  ✗ ${dir}: ${f.message}`);
        if (result.findings.length && worst < 1) worst = 1;
        if (!result.findings.length) {
            // Each series is named separately, and a series that generates nothing says so. A
            // workspace may declare budgets and no index — rail the store's size, generate nothing —
            // and saying "index current" there is a green about a file that does not exist, which is
            // the one sentence a tool whose subject is generated artifacts must not print. Found by
            // Copilot on #72, in the suppressed half of the round; the same trap has two doors now
            // that there are two series, and a workspace declaring one index would otherwise get a
            // sentence that reads as covering both.
            const state = check ? "current" : "written";
            const parts = [];
            if (result.series.memory.declared) {
                parts.push(result.series.memory.path === null ? "no store index declared; store within budget" : `store index ${state}, within budget`);
            }
            if (result.series.handoffs.declared) parts.push(`handoff index ${state}`);
            say(`  ok ${dir}: ${parts.join("; ")}`);
        }
    }

    return worst;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exit(run(process.argv.slice(2)));
}
