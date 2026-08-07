#!/usr/bin/env node
// `index` — the memory index generator, and the rail on what memory may cost.
//
//   node cli/index.mjs [--check] [--pack-root <dir>]... <workspace-dir> [<workspace-dir> ...]
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
// ./compile.mjs. Absorbed by the zero-dependency ESM CLI at milestone 7, where `index` is one of the eight
// subcommands ../docs/vision.md names. (A note for that session: this file is `cli/index.mjs`
// because the subcommand is called `index`, and npm packaging conventionally wants that name for a
// package entry point. The collision is inherited deliberately rather than discovered.)

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// The cascade, imported rather than re-derived. The scopes series is the one series whose source is
// not a directory this workspace owns: a persona's memory scope is declared inside a pack the
// workspace merely composes, so finding it means resolving the `packs` array exactly the way the
// compiler and `doctor` already resolve it. A second resolver here would be a second answer to
// "which pack is that" — and issue #74 already records what a memory store cost this project when
// three copies decided what counted as a record.
import { resolvePack, packRoots } from "./compile.mjs";

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
// KNOWN_GATE_POLICY_SPECS — which tracks the GATE-POLICY train, not this one — and the same refusal
// for anything outside the set: a tool that reads a manifest it
// does not understand reports about a workspace it may have misread.
const KNOWN_SPECS = new Set(["2.0", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7"]);

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

/**
 * The `## Memory scope` section of a persona file, normalized, or `null` if it carries none.
 *
 * The fourth part of the five-part persona contract (../core/personas/README.md). Read as a section
 * rather than a frontmatter key because that is where the contract puts it, and inventing a key would
 * make every persona this project already ships non-conforming to a contract nobody changed.
 */
export function memoryScopeOf(source) {
    const m = source.match(/^##[ \t]+Memory scope[ \t]*$([\s\S]*?)(?=^##[ \t]|$(?![\s\S]))/im);
    if (!m) return null;
    // Collapsed to one line, and parenthetical provenance asides dropped, so the digest is stable
    // against reflowing: a scope rewrapped to a different column width is the same declaration, and a
    // rail that reddened on it would teach authors to distrust the rail. What it is deliberately NOT
    // stable against is a changed word — which is the entire point of digesting this text.
    // `_(…)_` non-greedily to the first `)_`, NOT `[^)]*`: the one aside the shipped supervisor persona
    // carries contains a markdown link, whose own `)` defeated the character class — so the aside was
    // digest input while this comment said asides were dropped. Found by the pre-commit checkpoint.
    const body = m[1].replace(/_\([\s\S]*?\)_/g, " ").replace(/\s+/g, " ").trim();
    return body || null;
}

/**
 * The first sentence of a scope — the legible half of an index line, cut VISIBLY when it runs long.
 *
 * A colon does not end a sentence here, and that is a measured choice rather than a grammatical one:
 * the shipped supervisor persona opens `Its own supervisor memory: classes of defect …`, and breaking
 * on the colon rendered a line that named the persona twice and said nothing. The clause after the
 * colon is the informative half.
 *
 * When the sentence is longer than the budget it is truncated with an ellipsis rather than quietly
 * clipped — a generated file that shortens its source without saying so is the defect `render` above
 * refuses for the same reason. Completeness is the digest's job, not this text's.
 */
const SENTENCE_BUDGET = 120;
const firstSentence = (scope) => {
    const sentence = (scope.match(/^([\s\S]*?\.)(\s|$)/) ?? [null, scope])[1].trim();
    if (sentence.length <= SENTENCE_BUDGET) return sentence;
    const clipped = sentence.slice(0, SENTENCE_BUDGET);
    const atWord = clipped.lastIndexOf(" ");
    return `${(atWord > 40 ? clipped.slice(0, atWord) : clipped).trimEnd()}…`;
};

/** Eight hex of sha-256 over the normalized scope — the complete half, since a first sentence is not. */
const scopeDigest = (scope) => crypto.createHash("sha256").update(scope, "utf8").digest("hex").slice(0, 8);

/**
 * Everything a pack ships that would be a memory record — any path with `memory` as a **segment**.
 *
 * The segment, not the prefix `memory/`: that reports a file under a `memory/` directory, the directory
 * itself, and a **symlink named `memory`** — which is the case the prefix form missed, since a link is
 * neither a directory this walk descends nor a file beneath one. Copilot found that bypass on #117 round
 * 8, and this docstring described the prefix form for one round after the code stopped implementing it —
 * a code/comment mismatch in a security-relevant check, which is `a-stated-enforcer-must-be-the-real-one`
 * pointed at a comment instead of a rule.
 *
 * Bounded by construction rather than by a depth constant: it walks the pack it was handed and nothing
 * above it, and it does not follow links — this answers *what does the pack carry*, and a link named
 * `memory` is something it carries whatever it points at. `memory` is the name the Workspace Definition's
 * store slot uses in both live manifests, so it is the name a pack author would reach for.
 */
function packRecords(packDir, rel = "", out = []) {
    let entries;
    try {
        entries = fs.readdirSync(path.join(packDir, rel), { withFileTypes: true });
    } catch (cause) {
        throw new IndexError(
            `cannot read the pack directory ${path.join(packDir, rel)} — ${cause.code ?? cause.message}. ` +
                "Refusing to report that a pack carries no records of its own when it could not be enumerated",
        );
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const child = rel ? path.posix.join(rel, e.name) : e.name;
        // `memory` as a SEGMENT, matched before anything is recursed into or classified. A symlink named
        // `memory` is neither a directory this walk descends nor a file under `memory/`, so the old
        // `memory/`-only pattern let a pack smuggle a whole store past a check whose entire subject is
        // what the pack ships. Copilot, #117 round 8. Matching the segment closes it without following
        // the link — which is the right trade: this walk answers "what does the pack CARRY", and a link
        // named `memory` is something it carries whatever it points at.
        if (/(^|\/)memory(\/|$)/.test(child)) {
            out.push(child);
            continue;
        }
        if (e.isDirectory()) packRecords(packDir, child, out);
    }
    return out;
}

/**
 * Read the per-persona memory scopes a workspace's composed packs declare.
 *
 * Returns `{ scopes: [{ persona, pack, location, scope }], unresolved, carrying, broken }`.
 *
 * **The one series whose source is the cascade rather than the tree.** A workspace declares `packs`;
 * each pack's manifest declares `contributes.personas`; each persona declares its memory scope. What
 * lands in the adopter's layer is one location per persona — declared by the pack, owned and populated
 * only by the adopter (../docs/milestones/m06.md; thesis 6 of ../docs/vision.md, storage follows
 * ownership). That is also why nothing here reads or writes a record: the scope is a declaration, and
 * the contents are the adopter's to earn.
 *
 * Unresolvable packs, packs carrying records of their own, and personas declaring no scope are all
 * RETURNED rather than thrown — each is a verdict about the composition and belongs in the findings
 * list beside the index's own. What throws is only what makes the render underivable at all.
 */
export function readScopes(dir, workspace, options = {}) {
    const slot = workspace?.slots?.personas;
    if (!slot) {
        throw new IndexError(
            "the manifest declares a `personas` index but no `slots.personas` layer — there is nowhere for a scope to land. " +
                "The declared JSON Schema subset has no `dependentRequired` (spec/README.md), so this is checked here and by `doctor`",
        );
    }

    const declared = Array.isArray(workspace?.packs) ? workspace.packs : [];
    const roots = options.packRoots ?? packRoots(dir, workspace);
    const posixSlot = slot.split(path.sep).join(path.posix.sep).replace(/\/$/, "");

    const scopes = [];
    const unresolved = [];
    const carrying = [];
    const broken = [];

    for (const name of declared) {
        const found = resolvePack(name, roots);
        if (!found.dir) {
            unresolved.push(found);
            continue;
        }

        let manifest;
        try {
            manifest = JSON.parse(fs.readFileSync(found.manifest, "utf8"));
        } catch (cause) {
            throw new IndexError(
                `cannot read the pack manifest for \`${found.name}\` at ${found.manifest} — ${cause.code ?? cause.message}. ` +
                    "Refusing to render a scope index over a pack whose declaration could not be read",
            );
        }

        // Observation 3 of the landing clause, checked at the DISTRIBUTING side. A pack shipping
        // records would be core-and-packs absorbing the adopter's specifics, and it is invisible from
        // the adopter's own layer — which is exactly why the check lives here.
        for (const rel of packRecords(found.dir)) carrying.push({ pack: found.name, file: rel });

        const personas = manifest?.contributes?.personas;
        if (personas !== undefined && !Array.isArray(personas)) {
            throw new IndexError(
                `the pack manifest for \`${found.name}\` declares \`contributes.personas\` as ${typeof personas} rather than an array. ` +
                    "Refusing rather than reading past it — run `doctor` to validate the pack against the Pack Definition",
            );
        }

        for (const rel of personas ?? []) {
            // **A declared persona path must stay inside the pack.** `resolvePack` already refuses a `..`
            // in the pack NAME, on the reasoning that it "would resolve a declared pack outside every root
            // it was supposed to be searched in" — and the paths inside the manifest had no such guard, so
            // `../../../somewhere` or an absolute path read a file the adopter never offered and put a
            // digest of its contents into a committed index. A composed pack is third-party content by
            // construction: that is the whole reason its gate fragments may only ever tighten, and the same
            // reasoning binds what it may read. Found by Copilot on #117, round 5.
            // Checked before `path.resolve` touches it: a manifest is a file a human edits, `doctor` may
            // not have run (the two tools have no ordering), and `path.resolve` on a number throws a bare
            // TypeError that escapes as an unanticipated crash rather than the exit 2 this module reserves
            // for "could not judge". Every other malformed-manifest shape here already gets a named
            // `IndexError`; this one did not. Found by Copilot on #117, round 6.
            if (typeof rel !== "string" || !rel.trim()) {
                throw new IndexError(
                    `pack \`${found.name}\` declares a persona entry that is not a string path — ${JSON.stringify(rel)}. ` +
                        "Refusing rather than resolving it — run `doctor` to validate the pack against the Pack Definition",
                );
            }
            // Containment is checked on the CANONICAL path, not the lexical one. `path.resolve` is textual
            // and `readFileSync` **follows symlinks**, so the lexical check proved a string was inside the
            // pack and then read whatever the filesystem pointed at — a pack shipping `personas/x.md` as a
            // link out of the tree got arbitrary files hashed into a committed index. Found by Copilot on
            // #117 round 8, one round after the lexical traversal was closed: the same guard, a second
            // door. `cli/doctor.mjs` already resolves containment this way, so this follows an established
            // pattern rather than inventing one.
            const file = path.resolve(found.dir, rel);
            let real = file;
            let realPackDir = found.dir;
            try {
                realPackDir = fs.realpathSync(found.dir);
                real = fs.realpathSync(file);
            } catch { /* absent or unresolvable — the lexical check below still applies, then the read reports it */ }
            if (!isInside(found.dir, file) || !isInside(realPackDir, real)) {
                throw new IndexError(
                    `pack \`${found.name}\` declares the persona ${JSON.stringify(rel)}, which resolves outside the pack ` +
                        "directory. A pack may only contribute files it ships — refusing to read it",
                );
            }
            let source;
            try {
                source = fs.readFileSync(file, "utf8");
            } catch (cause) {
                throw new IndexError(
                    `pack \`${found.name}\` declares the persona ${rel}, which cannot be read — ${cause.code ?? cause.message}. ` +
                        "Refusing to render an index that would silently omit a declared persona",
                );
            }

            const persona = path.posix.basename(rel.split(path.sep).join(path.posix.sep), ".md");
            const scope = memoryScopeOf(source);
            if (scope === null) {
                broken.push({ pack: found.name, persona, file: rel });
                continue;
            }
            scopes.push({ persona, pack: found.name, location: `${posixSlot}/${persona}/`, scope });
        }
    }

    scopes.sort((a, b) => `${a.pack}/${a.persona}`.localeCompare(`${b.pack}/${b.persona}`));
    return { scopes, unresolved, carrying, broken };
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

/**
 * The per-persona scope index — the artifact that makes a landing checkable.
 *
 * Every field on a line is derived from the pack that declared the scope, so nothing in the file can
 * be edited into disagreement with the cascade. That is the same property the other two indexes have,
 * and here it carries more weight than in either: this file **is** the positive control the landing
 * clause demands (../docs/milestones/m06.md). A location without a line here is a directory somebody
 * made; a line whose digest no longer matches the persona is a scope that moved without the adopter
 * being told.
 *
 * The digest is over the whole normalized scope, and the sentence beside it is only the legible half.
 * A first sentence alone would let a pack reword everything after it invisibly — which is the exact
 * shape of `a-checkers-coverage-is-measured-not-named`.
 *
 * **What this file is not**, stated here because the alternative is a page describing machinery that
 * does not exist (`.portulan/dod.md` condition 4): nothing reads these locations, nothing recalls from
 * them, and nothing consolidates them. Row 6 declares the scope and shows it landing; `doctor` GAINED
 * the persona-contract check at milestone 7 session 2 (`row 6 declares, row 7 validates`, the
 * maintainer's ruling of 2026-07-29 — ../core/operating/memory.md), so the *validates* half is no
 * longer a future arrival. What it checks is the PRESENCE of the five parts, including a `## Memory
 * scope` section — never what is in these locations, which stay unread by anything. So this remains a
 * declared scope with an empty location, and it says so on its own face rather than in a session
 * record nobody re-reads.
 */
export function renderScopeIndex(workspace, series) {
    const header = [
        `# Persona memory scopes — ${workspace.name}`,
        "",
        "> Generated from the packs this workspace composes by `node cli/index.mjs`. Do not edit by hand:",
        "> it is regenerated and byte-compared, so a hand-edit survives exactly until the next run.",
        // Every emphasis span stays on ONE line. Markdown strong emphasis cannot cross a newline, so a
        // `**…**` split across two rendered lines prints its asterisks literally — which the committed
        // index did, until Copilot pointed at it. A generated artifact that RENDERS wrong is the same class
        // as one that says something wrong, and `cli/index.test.mjs` now asserts balanced `**` per line.
        `> ${series.scopes.length} declared scope(s). **Owned and populated only by this workspace.**`,
        "> Each location is empty until earned — the pack declares the scope and carries none of its",
        "> contents. Nothing reads these locations: `doctor` checks a persona against its five-part",
        "> contract as of milestone 7, which is not a check of what is in them.",
        "",
    ];

    // The location is NAMED, never LINKED, and the reason is the same property the whole design rests on:
    // the location is empty, git does not carry an empty directory, and so it does not exist in a fresh
    // clone. A markdown link asserts a resolvable target; this path is a *declaration* that may
    // legitimately not exist yet. The first version linked it, `docs.sh`'s `links` check passed on the
    // author's disk — where the directory had just been created — and failed in CI on a clean checkout.
    // That is a **local false green in a generated file**, which regenerating would faithfully reproduce.
    // Exempting the filename from the link walk was the other repair available and is refused for the
    // reason this repository always refuses it: an exemption is a door every other record can use.
    //
    // Since 2026-07-30 `links` resolves against `git ls-files --cached` (#121), so linking the location
    // would now be a consistent red rather than a local green. That changes nothing here, and the
    // distinction is worth keeping straight: the check improved, the reason did not. Naming the location
    // is right because the path is a declaration, and it would still be right in a workspace `vendor`
    // shipped to a host that runs no recipes at all.
    const entries = series.scopes.map((s) =>
        `- \`${s.persona}\` · ${s.pack} · \`${s.location}\` · scope \`${scopeDigest(s.scope)}\` — ${firstSentence(s.scope)}`,
    );

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
export function inspect(dir, { write = false, packRoots: extraRoots } = {}) {
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
    const scopes = judgeScopes(dir, workspace, { write, fail, packRoots: extraRoots });

    return {
        dir,
        declared: memory.declared || handoffs.declared || scopes.declared,
        series: { memory, handoffs, scopes },
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
 *
 * **And a failed READ is the same fact, which this function did not say for five review rounds.**
 * Only `ENOENT` means the index is absent; `EACCES`, `EISDIR`, `ELOOP` and the rest mean the process
 * could not look. Reported as *declared and absent* they came back as actionable drift at exit 1,
 * telling the operator to regenerate a file that may be correct and merely unopenable — *could not
 * look* dressed as *I looked and found nothing*, which is the record above in as many words. Issue
 * #91; Copilot raised it verbatim on #85 in rounds three through seven, each triaged under
 * `a-review-loop-needs-a-bound.md` rule 4, which is that rule working rather than failing: a triaged
 * note is not a withdrawn one. The rule it restores is stated three times in `./vendor.mjs` and again
 * in `./doctor.mjs`, `./new.mjs`, `./init.mjs`, `./plugin-lint.mjs` and `./compile.mjs` — this was the
 * one read in the repository that did not carry it.
 */
function compareOrWrite({ dir, declaredPath, indexPath, expected, write, series, source, fail }) {
    if (write) {
        try {
            fs.mkdirSync(path.dirname(indexPath), { recursive: true });
            fs.writeFileSync(indexPath, expected);
        } catch (cause) {
            throw new IndexError(
                `cannot write the index at ${declaredPath} — ${cause.code ?? cause.message}. ` +
                    `Refusing rather than reporting a verdict about the ${source}: this is a fact about the filesystem, ` +
                    `not about the ${source}`,
            );
        }
    }

    let actual = null;
    try {
        actual = fs.readFileSync(indexPath);
    } catch (cause) {
        // Only ENOENT is the red below. Everything else is a fact about the filesystem, and the two
        // repairs have nothing in common: one is `run the generator`, the other is `fix the permissions
        // on this path`. The errno is named because it is the whole diagnosis — `declared and absent`
        // sent an operator to regenerate a file that was sitting right there.
        if (cause.code !== "ENOENT") {
            throw new IndexError(
                `cannot read the index at ${declaredPath} — ${cause.code ?? cause.message}. ` +
                    `Refusing rather than reporting it absent: this is a fact about the filesystem, ` +
                    `not about the ${source}`,
            );
        }
    }

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

/**
 * The persona scopes series: its index, the landing itself, and the two controls the clause turns on.
 *
 * **Write mode creates the locations; check mode never does.** A verify recipe that materialised what
 * it is checking always passes — the property `../.portulan/verify/compile.sh` was built around, and
 * the reason `--check` is the flag the recipe passes and `--write` is the one it does not.
 *
 * The locations are created **empty**, and empty is not a state git records — so a fresh clone has the
 * index and no directories, which is correct and is why the index is the carrier of the declaration
 * rather than the directory. An absent location is therefore never a finding; what *is* a finding is a
 * location under this layer that no composed persona declares (the negative control), because without
 * that sweep the layer would accept anything at all and the positive control would only ever examine the
 * ones it already expected.
 */
function judgeScopes(dir, workspace, { write, fail, packRoots: extraRoots }) {
    const declaredPath = workspace.personas?.index?.path;
    if (!declaredPath) return { declared: false, path: null, expected: null };

    const slot = workspace.slots?.personas;
    const indexPath = siteOutside(dir, declaredPath, slot, "layer");
    const series = readScopes(dir, workspace, { packRoots: extraRoots });

    // Four ways this goes wrong, four repairs, so four checks rather than one "scopes malformed".
    for (const p of series.unresolved) {
        fail(
            "scopes",
            "pack",
            `\`${p.name}\` is declared in \`packs\` and does not resolve — ${p.why}. ` +
                "A scope cannot land from a pack that is not there; resolve the pack or stop declaring it",
        );
    }
    for (const b of series.broken) {
        fail(
            "scopes",
            "scope",
            `pack \`${b.pack}\` contributes the persona \`${b.persona}\` (${b.file}), which carries no \`## Memory scope\` ` +
                "section — the fourth part of the five-part persona contract (core/personas/README.md). " +
                "There is nothing to land, and this generator will not invent a scope for it",
        );
    }
    for (const c of series.carrying) {
        fail(
            "scopes",
            "contents",
            `pack \`${c.pack}\` carries ${c.file}, which is a memory record. A pack declares a scope and carries ` +
                "**none** of its contents: the store belongs to the adopter's layer (docs/vision.md thesis 6 — " +
                "storage follows ownership). Delete it from the pack",
        );
    }

    if (series.unresolved.length || series.broken.length || series.carrying.length) {
        return { declared: true, path: indexPath, expected: null };
    }

    // The negative control. Only over directories that exist — an absent layer means nothing has landed
    // yet, which is the state of every fresh clone.
    if (slot) {
        const layer = path.resolve(dir, slot);
        const declared = new Set(series.scopes.map((s) => s.persona));
        let present = null;
        try {
            present = fs.readdirSync(layer, { withFileTypes: true });
        } catch (cause) {
            // ENOENT is the ordinary state; anything else is a filesystem fact, not a verdict.
            if (cause.code !== "ENOENT") {
                throw new IndexError(
                    `cannot read the persona layer at ${slot} — ${cause.code ?? cause.message}. ` +
                        "Refusing to report that no location is orphaned when the layer could not be enumerated",
                );
            }
        }
        // **Empty means readable-and-zero, never could-not-look.** A declared location that exists and
        // cannot be enumerated is refused with exit 2, because the feature's own success state IS an
        // empty directory — so the enumeration fail-open this repository has fixed four times would here
        // read as the design working rather than as a broken read. Absent is a third, different fact and
        // stays green: git carries no empty directory, so absent is the state of every fresh clone.
        //
        // **Absent is decided by the read itself, not by a prior `existsSync`** — the sibling of #91,
        // in the paragraph that states the rule. `fs.existsSync` is a `stat` that answers `false` for
        // every failure, `EACCES` included, so a layer mode `0400` — readable, not searchable, which
        // the enumeration above passes — made every declared location under it stat-false, skipped as
        // absent, and the refusal three lines down unreachable. The guard whose comment promises
        // *never could-not-look* was the one thing looking, and it could not. Removing it also removes
        // a TOCTOU: one syscall now decides, instead of two that can disagree.
        for (const s of series.scopes) {
            const location = path.resolve(dir, s.location);
            try {
                fs.readdirSync(location);
            } catch (cause) {
                if (cause.code === "ENOENT") continue;
                throw new IndexError(
                    `the persona memory location ${s.location} exists and cannot be read — ${cause.code ?? cause.message}. ` +
                        "Refusing to report it empty: empty is this feature's success state, so an unreadable " +
                        "location reported as empty would read as the design working",
                );
            }
        }

        for (const e of present ?? []) {
            if (e.isDirectory() && declared.has(e.name)) continue;
            // Directories AND files. The first draft tested `isDirectory()` and skipped everything else,
            // so a `.md` dropped straight into the layer passed in silence — found by the pre-commit
            // checkpoint, and the same shape as `a-checkers-coverage-is-measured-not-named`: a sweep
            // whose description says "anything undeclared" while its code says "any directory".
            const where = path.posix.join(slot.replace(/\/$/, ""), e.name) + (e.isDirectory() ? "/" : "");
            fail(
                "scopes",
                "orphan",
                `${where} is under the persona layer and no composed pack declares it. ` +
                    "This layer holds one directory per declared scope and nothing else — what is not declared is " +
                    "something somebody made, which is exactly what this sweep exists to tell apart from a scope " +
                    "that arrived. Remove it, or compose the pack that declares it",
            );
        }
    }

    const expected = renderScopeIndex(workspace, series);
    compareOrWrite({ dir, declaredPath, indexPath, expected, write, series: "scopes", source: "packs this workspace composes", fail });

    // The landing itself, and it happens after the index is written rather than before: if the render
    // could not be derived there is nothing to land, and a directory created for a scope no index
    // records is the orphan the sweep above exists to catch.
    if (write) {
        for (const s of series.scopes) {
            const location = path.resolve(dir, s.location);
            try {
                fs.mkdirSync(location, { recursive: true });
            } catch (cause) {
                throw new IndexError(
                    `cannot create the persona memory location at ${s.location} — ${cause.code ?? cause.message}. ` +
                        "Refusing rather than reporting a verdict about a landing that did not happen",
                );
            }
        }
    }

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
    let check = false;
    const dirs = [];
    // Named pack roots, which REPLACE a workspace's own derived root rather than being searched ahead
    // of it. `resolvePack` was root-parameterized at session 0 so an installed-from-a-feed pack would
    // travel the same code path as one shipping beside the workspace — but nothing set those roots, so
    // the parameter was reachable only from a test. Replacement rather than precedence on purpose: a
    // demonstration that "the pack resolved from the feed" must not be satisfiable by a copy sitting in
    // the local tree at all. The three tools that take this flag disagreed about it once, and
    // ./compile.mjs's `namedRootsOption` carries what that cost.
    // What is deliberately NOT built is discovery of a host's plugin cache — that path is host-shaped,
    // and a flag is the honest surface until a row owned the discovery — **row 7 owns it as of the 2026-08-03 amendment** (#123), so the flag is the surface until that lands rather than until somebody undertakes it.
    const roots = [];
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === "--check") check = true;
        else if (argv[i] === "--pack-root") {
            const dir = argv[i + 1];
            i += 1;
            if (dir === undefined || dir.startsWith("--")) {
                say("  ✗ --pack-root needs a directory");
                return 2;
            }
            roots.push(path.resolve(dir));
        } else dirs.push(argv[i]);
    }

    if (dirs.length === 0) {
        say("usage: node cli/index.mjs [--check] [--pack-root <dir>]... <workspace-dir> [<workspace-dir> ...]");
        return 2;
    }

    for (const root of roots) {
        // A root that is not there is a configuration fact, not a pack that failed to resolve. Reporting
        // it as the latter would send an author to look at the one file that is not at fault — the same
        // distinction ../.portulan/memory/verify-preconditions-fail-closed.md was written for.
        // Existence is not enough: `existsSync` is true for a FILE, and the flag's own usage says it needs
        // a directory — so a file was accepted and every later resolution failure was misattributed to the
        // packs rather than to the argument. A stat that throws fails closed for the same reason. Found by
        // Copilot on #117, round 6.
        let stat = null;
        try {
            stat = fs.statSync(root);
        } catch (cause) {
            say(`  ✗ --pack-root ${root} cannot be read — ${cause.code ?? cause.message}. Refusing to report a pack unresolvable against a root nothing looked in`);
            return 2;
        }
        if (!stat.isDirectory()) {
            say(`  ✗ --pack-root ${root} is not a directory — a resolution root is a directory packs are looked up under`);
            return 2;
        }
    }

    let worst = 0;
    for (const dir of dirs) {
        let result;
        try {
            result = inspect(dir, { write: !check, packRoots: roots.length ? roots : undefined });
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
            // sentence that reads as covering both. **Three doors since 2.6**, and the first draft of
            // the scopes series walked through the new one: `index` printed a green naming the store
            // and the handoffs and silently omitted the scope index it had just written.
            const state = check ? "current" : "written";
            const parts = [];
            if (result.series.memory.declared) {
                parts.push(result.series.memory.path === null ? "no store index declared; store within budget" : `store index ${state}, within budget`);
            }
            if (result.series.handoffs.declared) parts.push(`handoff index ${state}`);
            if (result.series.scopes.declared) parts.push(`scope index ${state}`);
            say(`  ok ${dir}: ${parts.join("; ")}`);
        }
    }

    return worst;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exit(run(process.argv.slice(2)));
}
