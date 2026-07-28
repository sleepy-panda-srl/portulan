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
const KNOWN_SPECS = new Set(["2.0", "2.1", "2.2", "2.3"]);

// The store's own signpost, not a record. `doctor` excludes exactly this name from its walk, so the
// two tools agree on what the store contains; disagreeing would put a record in the index that the
// store report does not count, or the reverse.
const NOT_A_RECORD = new Set(["README.md"]);

const KB = 1024;

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
export function readStore(dir, workspace) {
    const slot = workspace?.slots?.memory;
    if (!slot) {
        throw new IndexError(
            "the manifest declares a `memory` budget but no `slots.memory` store — there is nothing to index. " +
                "The declared JSON Schema subset has no `dependentRequired` (spec/README.md), so this is checked here and by `doctor`",
        );
    }

    const storeDir = path.resolve(dir, slot);
    let names;
    try {
        names = fs.readdirSync(storeDir);
    } catch (cause) {
        throw new IndexError(
            `cannot read the memory store at ${slot} — ${cause.code ?? cause.message}. ` +
                "Refusing to render an index of nothing: an empty index compares equal to an empty committed one and would pass",
        );
    }

    const files = names.filter((n) => n.endsWith(".md") && !NOT_A_RECORD.has(n)).sort();
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
            type: (source.match(/^\s*\*\*type:\*\*\s*(\S+)/im)?.[1] ?? "untyped").toLowerCase(),
            heading: headingOf(source),
        });
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
    const fail = (check, message) => findings.push({ severity: "fail", check, message });

    const memory = workspace.memory;
    if (!memory) return { dir, declared: false, path: null, expected: null, findings };

    const declaredIndex = memory.index?.path;
    if (!declaredIndex) {
        // A budget with no index is coherent — a workspace may rail its store's size and generate
        // nothing — so this is not an error. There is simply no file to render.
        const store = readStore(dir, workspace);
        budgetFindings(memory, store, null, fail);
        return { dir, declared: true, path: null, expected: null, findings };
    }

    const indexPath = path.resolve(dir, declaredIndex);
    const storeDir = path.resolve(dir, workspace.slots?.memory ?? "");

    // An index inside the store it indexes is refused, not special-cased. `doctor` counts every
    // `.md` in the store as a record: sited there, the index would be counted, sized into the KB
    // figure, and reported for stating no retirement condition. The alternative — excluding it by
    // name — is a hiding place any record could use, and this repository has found eight fail-opens
    // of that shape in its own scaffolding.
    if (workspace.slots?.memory && !path.relative(storeDir, indexPath).startsWith("..")) {
        throw new IndexError(
            `${declaredIndex} sits inside the store it indexes (${workspace.slots.memory}) — ` +
                "`doctor` would count it as a record. Site the index beside the store, not in it",
        );
    }

    const store = readStore(dir, workspace);

    // Titles first, and alone. A disagreement means there is no correct line to emit for that
    // record, so rendering anyway would produce a generated file the generator knows is wrong.
    for (const r of store.records) {
        if (r.heading && normalize(r.heading) !== normalize(r.title)) {
            fail(
                "title",
                `${path.join(workspace.slots.memory, r.file)} carries the heading "${r.heading}", which is not its filename's title ` +
                    `"${r.title}". A record may hold two carriers of its name; it may not hold two answers — ` +
                    "rename the file or reword the heading",
            );
        }
    }
    if (findings.length) return { dir, declared: true, path: indexPath, expected: null, findings };

    const expected = render(workspace, store);

    if (write) {
        // The artifact's own directory is created, and a write that still fails is an IndexError
        // rather than a throw. Both halves matter, and the second is the one with teeth: an uncaught
        // ENOENT here exits node with 1, which `index.sh` passes through as a RED — "the index has
        // drifted", said about a store nothing had judged, for what is a configuration problem.
        // That is `a-checker-must-refuse-what-it-cannot-check` exactly, and the suite already
        // carried the fixture that triggers it (`notes/memory-index.md`) while stopping one call
        // short of writing through it. Found by Copilot on #72.
        try {
            fs.mkdirSync(path.dirname(indexPath), { recursive: true });
            fs.writeFileSync(indexPath, expected);
        } catch (cause) {
            throw new IndexError(
                `cannot write the index at ${declaredIndex} — ${cause.code ?? cause.message}. ` +
                    "Refusing rather than reporting a verdict about the store: this is a fact about the filesystem, not about memory",
            );
        }
    }

    let actual = null;
    try {
        actual = fs.readFileSync(indexPath);
    } catch { /* absent — reported below, and never repaired here */ }

    if (actual === null) {
        fail("index", `${declaredIndex} is declared and absent — run \`node cli/index.mjs ${dir}\` to generate it`);
    } else if (!actual.equals(Buffer.from(expected, "utf8"))) {
        // Byte-compared, and never written in check mode. A verify recipe that repairs what it is
        // checking always passes — the property ../.portulan/verify/compile.sh was built around.
        fail("index", `${declaredIndex} is out of date against the store — run \`node cli/index.mjs ${dir}\` to regenerate it`);
    }

    budgetFindings(memory, store, expected, fail);

    return { dir, declared: true, path: indexPath, expected, findings };
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
            say(`  · ${dir}: declares no memory index`);
            continue;
        }
        for (const f of result.findings) say(`  ✗ ${dir}: ${f.message}`);
        if (result.findings.length && worst < 1) worst = 1;
        if (!result.findings.length) {
            // A workspace may declare budgets and no index — rail the store's size, generate
            // nothing. Saying "index current" there is a green about a file that does not exist,
            // which is the one sentence a tool whose subject is generated artifacts must not print.
            // Found by Copilot on #72, in the suppressed half of the round.
            say(
                result.path === null
                    ? `  ok ${dir}: no index declared; store within budget`
                    : `  ok ${dir}: ${check ? "index current" : "index written"}, within budget`,
            );
        }
    }

    return worst;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exit(run(process.argv.slice(2)));
}
