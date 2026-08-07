// Tests for `index` — the memory index generator and its budget rail.
//
// Written before the generator, per ../core/operating/verification.md: the failing test is the spec.
// Zero dependencies, node's own runner, same as ./doctor.test.mjs and ./compile.test.mjs, and run by
// the same recipe.
//
//   node --test "cli/**/*.test.mjs"
//
// What this suite CANNOT establish: that the index is any good at recall. It checks that the file is
// derived from the store, that nothing in it was hand-written, and that a breach of the declared
// budget is red. Whether a reader given these lines finds the right record is a question for evals
// (milestone 8) and for the humans who name the records, and no assertion here should be read as
// answering it.
//
// The last group binds the two live stores byte-for-byte, the way ./doctor.test.mjs binds their
// retirement conditions: for this repository the suite is the rail, and an index left stale by a
// change to a record turns it red here as well as in the recipe.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    IndexError,
    titleOf,
    headingOf,
    dateOf,
    isInside,
    memoryScopeOf,
    readStore,
    readHandoffs,
    render,
    renderHandoffIndex,
    inspect,
    run,
} from "./index.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

// One exit handler for every scratch directory — the per-directory form exceeds node's default ten
// listeners partway through a suite this size, which ./doctor.test.mjs learned in review.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-index-"));
    SCRATCH.push(dir);
    return dir;
}

/** Write a tree described as { "relative/path": "contents" }. */
function tree(dir, files) {
    for (const [rel, body] of Object.entries(files)) {
        const target = path.join(dir, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, body);
    }
    return dir;
}

/** A record in the shape ../core/templates/memory-entry.md prescribes — no H1, by design. */
const record = (type, body = "A durable fact.") =>
    `**type:** ${type}\n**scope:** workspace — the fixture\n` +
    "**provenance:** `form=link` `href=https://example.invalid/1`\n\n" +
    `${body}\n\n**Retire when:** the fixture is deleted.\n`;

const wellFormed = (over = {}) => ({
    portulan: { spec: "2.3" },
    name: "fixture",
    kind: "demo",
    slots: {
        identity: "identity.md",
        principles: "principles.md",
        gates: "gate-map.md",
        memory: "memory/",
    },
    verify: { default: "docs", recipes: [{ id: "docs", run: "./verify.sh" }] },
    memory: {
        index: { path: "memory-index.md", budget: { lines: 60, columns: 140 } },
        store: { budget: { kilobytes: 200 } },
    },
    ...over,
});

/** A workspace on disk with `records` named as given, and no index written yet. */
function workspace(files = {}, manifest = wellFormed()) {
    return tree(scratch(), {
        "workspace.json": JSON.stringify(manifest, null, 2),
        "identity.md": "Identity.\n",
        "principles.md": "Principles.\n",
        "gate-map.md": "Gate map.\n",
        ...files,
    });
}

const failures = (result) => result.findings.filter((f) => f.severity === "fail");
const text = (findings) => findings.map((f) => f.message).join("\n");

// ---------------------------------------------------------------- titles

describe("a record's title is its filename", () => {
    // The store carries no H1s — ../core/templates/memory-entry.md prescribes none and 24 of the 27
    // live records have none — so the filename is the only title every record already has. It is
    // also the title every cross-reference in this repository already uses.
    test("de-kebabs a filename into a sentence", () => {
        assert.equal(titleOf("a-review-loop-needs-a-bound.md"), "A review loop needs a bound");
        assert.equal(titleOf("readme-map-must-match-shape.md"), "Readme map must match shape");
        assert.equal(titleOf("two-layers-need-two-jobs.md"), "Two layers need two jobs");
    });

    test("leaves a single word alone but for its first letter", () => {
        assert.equal(titleOf("glossary.md"), "Glossary");
    });

    test("does not invent punctuation the filename cannot carry", () => {
        // A filename cannot hold a comma or an apostrophe, so a title derived from one never has
        // them. Stated as a test because the alternative — guessing where punctuation belongs — is
        // how a generated file starts disagreeing with the thing it was generated from.
        assert.equal(titleOf("who-may-commit-is-verified-not-assumed.md"), "Who may commit is verified not assumed");
    });
});

describe("a record carrying an H1 must carry the same title in it", () => {
    // The store may hold two carriers of a record's name. It may not hold two ANSWERS. This is the
    // check that keeps the second carrier honest, and it is here rather than in `doctor` because the
    // index is the artifact that has to pick one.
    test("reads an H1 when the record has one", () => {
        assert.equal(headingOf("# A review loop needs a bound\n\n**type:** rule\n"), "A review loop needs a bound");
    });

    test("returns null when the record has none", () => {
        assert.equal(headingOf(record("rule")), null);
    });

    test("ignores a `#` that is not a heading", () => {
        assert.equal(headingOf("**type:** rule\n\nSee `# not a heading` here.\n"), null);
    });

    test("ignores a `#` at column 0 inside a fenced block", () => {
        // The false red this check was measured to produce before it was anchored: a record with no
        // heading at all, but a shell comment in a code fence, came back as carrying that comment as
        // its title — and the title check then failed a record whose filename was never in question.
        // A false red is not a milder failure than a false green; it is the one that gets a whole
        // check switched off (../.portulan/verify/README.md).
        const source = "**type:** rule\n\n```sh\n# regenerate the thing\n```\n\n**Retire when:** never.\n";
        assert.equal(headingOf(source), null);
        const dir = workspace({ "memory/a-fenced-record.md": source });
        assert.equal(failures(inspect(dir, { write: true })).length, 0);
    });

    test("reads the heading only from the first non-blank line", () => {
        assert.equal(headingOf("\n\n# A rule holds\n\n**type:** rule\n"), "A rule holds");
        // The residual limit, asserted so it is a decision rather than an accident: a heading further
        // down is not read, so a stray one cannot red a record whose filename is correct.
        assert.equal(headingOf("**type:** rule\n\n# A later heading\n"), null);
    });

    test("agrees when the H1 restates the filename", () => {
        const dir = workspace({ "memory/a-rule-holds.md": "# A rule holds\n\n" + record("rule") });
        assert.equal(failures(inspect(dir, { write: true })).length, 0);
    });

    test("agrees across punctuation the filename cannot carry", () => {
        // "Who may commit is verified, not assumed" is the same title as its filename; the comma is
        // not a disagreement. Normalising away what a filename cannot express is what keeps this
        // check from being a false-red machine, which is the failure that gets a check switched off.
        const dir = workspace({
            "memory/who-may-commit-is-verified-not-assumed.md":
                "# Who may commit is verified, not assumed\n\n" + record("rule"),
        });
        assert.equal(failures(inspect(dir, { write: true })).length, 0);
    });

    test("fails when the H1 says something else, naming both spellings", () => {
        // A disagreement stops the render rather than joining the other findings: there is no
        // correct line to emit for this record, so an index written anyway would be a generated
        // file the generator itself knows is wrong. The drift and budget checks are skipped.
        const dir = workspace({
            "memory/a-rule-holds.md": "# A different claim entirely\n\n" + record("rule"),
        });
        const bad = failures(inspect(dir, { write: true }));
        assert.equal(bad.length, 1);
        assert.equal(bad[0].check, "title");
        assert.equal(fs.existsSync(path.join(dir, "memory-index.md")), false);
        assert.match(text(bad), /a-rule-holds\.md/);
        assert.match(text(bad), /A different claim entirely/);
        assert.match(text(bad), /A rule holds/);
    });
});

// ---------------------------------------------------------------- reading the store

describe("reading the store", () => {
    test("returns one entry per record, sorted, with its type", () => {
        const dir = workspace({
            "memory/b-second.md": record("decision"),
            "memory/a-first.md": record("rule"),
        });
        const store = readStore(dir, wellFormed());
        assert.deepEqual(store.records.map((r) => r.file), ["a-first.md", "b-second.md"]);
        assert.deepEqual(store.records.map((r) => r.type), ["rule", "decision"]);
    });

    test("skips README.md, which is the store's own signpost rather than a record", () => {
        const dir = workspace({
            "memory/README.md": "# Memory\n\nWhat lives here.\n",
            "memory/a-first.md": record("rule"),
        });
        assert.deepEqual(readStore(dir, wellFormed()).records.map((r) => r.file), ["a-first.md"]);
    });

    test("sizes the store from the bytes on disk", () => {
        const dir = workspace({ "memory/a-first.md": record("rule") });
        const store = readStore(dir, wellFormed());
        assert.equal(store.bytes, fs.statSync(path.join(dir, "memory", "a-first.md")).size);
    });

    test("calls an untyped record untyped rather than failing it", () => {
        // `doctor` already reports a record with no `**type:**`, and legislating it twice — in a
        // different tool, with a different severity — is how two checkers start disagreeing about
        // one store. The index renders what is there.
        const dir = workspace({ "memory/a-first.md": "Just prose.\n\n**Retire when:** never.\n" });
        assert.equal(readStore(dir, wellFormed()).records[0].type, "untyped");
    });

    test("refuses to run when the store directory is missing", () => {
        // Not a red. An absent store is a `paths` failure `doctor` already owns; from in here it is
        // the difference between a store with nothing in it and a manifest pointing nowhere, and
        // this tool cannot tell them apart — so it declines to judge instead of reporting an empty
        // index as correct. ../.portulan/memory/verify-preconditions-fail-closed.md.
        const dir = workspace();
        assert.throws(() => readStore(dir, wellFormed()), IndexError);
    });

    test("refuses to run when a record is present and unreadable", () => {
        const dir = workspace({ "memory/a-first.md": record("rule") });
        const target = path.join(dir, "memory", "a-first.md");
        fs.chmodSync(target, 0o000);
        try {
            assert.throws(() => readStore(dir, wellFormed()), IndexError);
        } finally {
            fs.chmodSync(target, 0o644);
        }
    });
});

// ---------------------------------------------------------------- rendering

describe("rendering the index", () => {
    const dir = () =>
        workspace({
            "memory/a-first.md": record("rule"),
            "memory/b-second.md": record("reference"),
        });

    test("emits one line per record and nothing per record that is not derived", () => {
        const d = dir();
        const out = render(wellFormed(), readStore(d, wellFormed()));
        const entries = out.split("\n").filter((l) => l.startsWith("- ["));
        assert.equal(entries.length, 2);
        assert.equal(entries[0], "- [A first](memory/a-first.md) — rule");
        assert.equal(entries[1], "- [B second](memory/b-second.md) — reference");
    });

    test("links relative to the index's own location, not to the workspace root", () => {
        // The index is a sibling of the store, so `memory/x.md` resolves from it. Sited elsewhere,
        // the links have to move with it — and `docs.sh`'s links check is what would catch it, one
        // recipe over, in a file nobody would think to look at.
        const manifest = wellFormed({
            memory: {
                index: { path: "notes/memory-index.md", budget: { lines: 60, columns: 140 } },
                store: { budget: { kilobytes: 200 } },
            },
        });
        const d = workspace({ "memory/a-first.md": record("rule") }, manifest);
        const out = render(manifest, readStore(d, manifest));
        assert.match(out, /\(\.\.\/memory\/a-first\.md\)/);
    });

    test("states the record count and the budget in the file the budget governs", () => {
        const d = dir();
        const out = render(wellFormed(), readStore(d, wellFormed()));
        assert.match(out, /2 record\(s\)/);
        assert.match(out, /60 lines/);
    });

    test("says it is generated, so an editor is warned before the recipe tells them", () => {
        const d = dir();
        assert.match(render(wellFormed(), readStore(d, wellFormed())), /cli\/index\.mjs/);
    });

    test("ends with exactly one newline", () => {
        const d = dir();
        const out = render(wellFormed(), readStore(d, wellFormed()));
        assert.ok(out.endsWith("\n") && !out.endsWith("\n\n"));
    });
});

// ---------------------------------------------------------------- the budgets

describe("the budget is a rail", () => {
    /** A store of `n` records, each named distinctly. */
    const store = (n) =>
        Object.fromEntries(
            Array.from({ length: n }, (_, i) => [`memory/record-number-${i}.md`, record("rule")]),
        );

    test("green when the index fits", () => {
        const dir = workspace(store(3));
        const result = inspect(dir, { write: true });
        assert.equal(failures(result).length, 0);
    });

    test("red when the index is over its line budget, naming the overage", () => {
        const manifest = wellFormed({
            memory: {
                index: { path: "memory-index.md", budget: { lines: 8, columns: 140 } },
                store: { budget: { kilobytes: 200 } },
            },
        });
        const dir = workspace(store(20), manifest);
        const bad = failures(inspect(dir, { write: true }));
        assert.equal(bad.length, 1);
        assert.equal(bad[0].check, "budget");
        assert.match(text(bad), /8/);
        assert.match(text(bad), /consolidat/i);
    });

    test("the over-budget red survives the index being written", () => {
        // The generator writes and then judges, rather than refusing to write what breaches. A tool
        // that will not emit an over-budget index leaves the author with no artifact to consolidate
        // FROM, and the row's remedy is consolidation — so the file is produced and the verdict is
        // red. Stated as a test because the opposite is the more obvious implementation.
        const manifest = wellFormed({
            memory: {
                index: { path: "memory-index.md", budget: { lines: 8, columns: 140 } },
                store: { budget: { kilobytes: 200 } },
            },
        });
        const dir = workspace(store(20), manifest);
        inspect(dir, { write: true });
        assert.ok(fs.existsSync(path.join(dir, "memory-index.md")));
    });

    test("red when one line is over the column cap", () => {
        // The hole a line budget has: one record with a very long name absorbs what the budget is
        // counting. Refused rather than truncated — a silently shortened title is a generated file
        // disagreeing with its source, which is the whole class this tool exists to close.
        const long = "a-" + "very-".repeat(40) + "long-name.md";
        const dir = workspace({ [`memory/${long}`]: record("rule") });
        const bad = failures(inspect(dir, { write: true }));
        assert.equal(bad.length, 1);
        assert.equal(bad[0].check, "budget");
        assert.match(text(bad), /140/);
        assert.match(text(bad), /column/i);
    });

    test("the store-size red carries exact bytes, so its sentence cannot contradict its verdict", () => {
        // Copilot, #72. `kb.toFixed(1)` alone prints `1.0 KB against a budget of 1 KB` at 1025
        // bytes — a message that reads as within budget inside the finding announcing it is not.
        const manifest = wellFormed({
            memory: {
                index: { path: "memory-index.md", budget: { lines: 600, columns: 140 } },
                store: { budget: { kilobytes: 1 } },
            },
        });
        const dir = workspace({ "memory/a-first.md": "x".repeat(1025) + "\n" }, manifest);
        const bad = failures(inspect(dir, { write: true }));
        assert.equal(bad.length, 1);
        assert.match(text(bad), /1026 bytes/);
        assert.match(text(bad), /1024 bytes/);
    });

    test("red when the store is over its size budget, in KB", () => {
        // The axis the index cannot see: 23 records can grow to any size with the index unchanged.
        const manifest = wellFormed({
            memory: {
                index: { path: "memory-index.md", budget: { lines: 60, columns: 140 } },
                store: { budget: { kilobytes: 1 } },
            },
        });
        const dir = workspace(store(10), manifest);
        const bad = failures(inspect(dir, { write: true }));
        assert.equal(bad.length, 1);
        assert.equal(bad[0].check, "budget");
        assert.match(text(bad), /KB/);
    });

    test("a budget of zero is refused rather than read as undeclared", () => {
        // The hole an optional number has: `lines: 0` is falsy, so a rail switched OFF looks exactly
        // like a rail nobody asked for. The schema cannot catch it — the declared keyword subset has
        // no `minimum` — so the tool refuses, and refuses with exit 2, because a broken budget is a
        // defect in the policy rather than a verdict about the store.
        for (const bad of [0, -1, 1.5, "60", null]) {
            const manifest = wellFormed({
                memory: { index: { path: "memory-index.md", budget: { lines: bad } } },
            });
            const dir = workspace({ "memory/a-first.md": record("rule") }, manifest);
            assert.throws(() => inspect(dir, { write: true }), IndexError, `budget ${JSON.stringify(bad)}`);
        }
    });

    test("an undeclared budget is not checked, and does not become a default", () => {
        // Every number here is the workspace's, and none of them is defaulted — the `floor` object's
        // rule at spec 2.2, for the same reason: a default is a policy this project would be setting
        // for every workspace that ever adopts the spec, in a key nobody typed.
        const manifest = wellFormed({
            memory: { index: { path: "memory-index.md" } },
        });
        const dir = workspace(store(200), manifest);
        assert.equal(failures(inspect(dir, { write: true })).length, 0);
    });
});

// ---------------------------------------------------------------- drift

describe("--check compares and never repairs", () => {
    test("green when the committed index is what the store renders", () => {
        const dir = workspace({ "memory/a-first.md": record("rule") });
        inspect(dir, { write: true });
        assert.equal(failures(inspect(dir)).length, 0);
    });

    test("red when a record was added and the index was not regenerated", () => {
        const dir = workspace({ "memory/a-first.md": record("rule") });
        inspect(dir, { write: true });
        tree(dir, { "memory/b-second.md": record("rule") });
        const bad = failures(inspect(dir));
        assert.equal(bad.length, 1);
        assert.equal(bad[0].check, "index");
        assert.match(text(bad), /out of date/i);
        assert.match(text(bad), /cli\/index\.mjs/);
    });

    test("stale and over-budget are different reds with different repairs", () => {
        // Conflating them teaches the wrong fix: one is `run the generator`, the other is
        // `consolidate the store`. A recipe that says only "index check failed" sends an author to
        // regenerate a file that is already correct and still too big.
        const manifest = wellFormed({
            memory: {
                index: { path: "memory-index.md", budget: { lines: 8, columns: 140 } },
                store: { budget: { kilobytes: 200 } },
            },
        });
        const dir = workspace(
            Object.fromEntries(
                Array.from({ length: 20 }, (_, i) => [`memory/record-number-${i}.md`, record("rule")]),
            ),
            manifest,
        );
        const checks = new Set(failures(inspect(dir)).map((f) => f.check));
        assert.ok(checks.has("index"));
        assert.ok(checks.has("budget"));
    });

    test("does not write the file it disagrees with", () => {
        // A verify recipe that repairs what it is checking always passes — the property
        // ../.portulan/verify/compile.sh was built around, restated here because this generator has
        // a write mode one flag away.
        const dir = workspace({ "memory/a-first.md": record("rule") });
        inspect(dir, { write: true });
        const indexPath = path.join(dir, "memory-index.md");
        const before = fs.readFileSync(indexPath);
        tree(dir, { "memory/b-second.md": record("rule") });
        inspect(dir);
        assert.deepEqual(fs.readFileSync(indexPath), before);
    });

    test("creates the index's own directory rather than throwing ENOENT through the recipe", () => {
        // Copilot, #72. `notes/memory-index.md` with no `notes/` threw an uncaught ENOENT out of
        // `run()`, node exited 1, and the recipe passed that through as a RED — "the index has
        // drifted", about a store nothing had judged, for a filesystem fact. The fixture for this
        // path was already in this file, one call short of writing through it.
        const manifest = wellFormed({
            memory: { index: { path: "notes/memory-index.md", budget: { lines: 60, columns: 140 } } },
        });
        const dir = workspace({ "memory/a-first.md": record("rule") }, manifest);
        assert.equal(failures(inspect(dir, { write: true })).length, 0);
        assert.ok(fs.existsSync(path.join(dir, "notes", "memory-index.md")));
        assert.equal(run(["--check", dir]), 0);
    });

    test("a write it cannot perform is exit 2, never a verdict about the store", () => {
        const manifest = wellFormed({
            memory: { index: { path: "locked/memory-index.md", budget: { lines: 60, columns: 140 } } },
        });
        const dir = workspace({ "memory/a-first.md": record("rule") }, manifest);
        const locked = path.join(dir, "locked");
        fs.mkdirSync(locked);
        fs.chmodSync(locked, 0o500);
        try {
            assert.throws(() => inspect(dir, { write: true }), IndexError);
        } finally {
            fs.chmodSync(locked, 0o700);
        }
    });

    test("red when the index is declared and absent", () => {
        const dir = workspace({ "memory/a-first.md": record("rule") });
        const bad = failures(inspect(dir));
        assert.equal(bad.length, 1);
        assert.equal(bad[0].check, "index");
        assert.match(text(bad), /memory-index\.md/);
    });

    test("an index that cannot be READ is exit 2, never `declared and absent`", () => {
        // Issue #91, raised verbatim by Copilot in five consecutive rounds on #85. Every
        // `readFileSync` failure was read as *the file is not there*, so `EACCES`, `EISDIR` and the
        // rest came back as actionable drift telling the operator to regenerate a file that may be
        // sitting right where it belongs. *Could not look* reported as *I looked and found nothing* —
        // `a-checker-must-refuse-what-it-cannot-check.md` in as many words — and the exit code is
        // wrong with it: a fact about the filesystem is a 2, never a 1.
        //
        // A DIRECTORY where the index goes yields `EISDIR` and does not depend on the uid running
        // the suite the way a chmod does.
        const dir = workspace({ "memory/a-first.md": record("rule") });
        fs.mkdirSync(path.join(dir, "memory-index.md"));
        // The errno is named, and the sentence the old code printed — the one whose repair is `run the
        // generator` — is asserted absent. Matching on the bare word `absent` would be wrong: the
        // refusal says *refusing rather than reporting it absent*, which is the message being correct.
        assert.throws(
            () => inspect(dir),
            (e) => e instanceof IndexError && /EISDIR/.test(e.message) && !/declared and absent/.test(e.message),
        );
    });

    test("a permission failure is refused on the same rule", () => {
        const dir = workspace({ "memory/a-first.md": record("rule") });
        run([dir]); // written, correct, and about to be unopenable — the case the old red lied about
        const written = path.join(dir, "memory-index.md");
        fs.chmodSync(written, 0o000);
        try {
            assert.throws(() => inspect(dir), (e) => e instanceof IndexError && /EACCES/.test(e.message));
        } finally {
            fs.chmodSync(written, 0o644);
        }
    });

    test("`run` keeps the two codes apart: 1 for absent, 2 for unreadable", () => {
        // The distinction has to survive the command, because `index.sh` passes both codes through
        // unchanged and CI branches on them: 1 is *the index has drifted*, 2 is *nothing was judged*.
        const dir = workspace({ "memory/a-first.md": record("rule") });
        assert.equal(run(["--check", dir]), 1);
        fs.mkdirSync(path.join(dir, "memory-index.md"));
        assert.equal(run(["--check", dir]), 2);
    });
});

// ---------------------------------------------------------------- preconditions

describe("what this tool refuses to judge", () => {
    test("a workspace with no manifest", () => {
        assert.throws(() => inspect(scratch()), IndexError);
    });

    test("a manifest that does not parse", () => {
        const dir = tree(scratch(), { "workspace.json": "{ not json" });
        assert.throws(() => inspect(dir), IndexError);
    });

    test("a spec version this tool does not understand", () => {
        // `doctor` shipped for a day reading no version at all, and a manifest naming a spec that
        // had never existed validated green. Same class, closed at birth.
        const dir = workspace({}, wellFormed({ portulan: { spec: "9.9" } }));
        assert.throws(() => inspect(dir), IndexError);
    });

    test("a manifest declaring `memory` with no memory slot", () => {
        // The store is `slots.memory`; the budget object governs it. Declaring the second without
        // the first asks for an index of nothing — and the declared JSON Schema subset has no
        // `dependentRequired`, so this is a tool's job, exactly as `tree`-when-`kind`-is-repository
        // already is (spec/README.md).
        const manifest = wellFormed();
        delete manifest.slots.memory;
        const dir = workspace({}, manifest);
        assert.throws(() => inspect(dir), IndexError);
    });

    test("a filename beginning with `..` is a name, not a way out of the store", () => {
        // Copilot, #72, suppressed half. `!path.relative(parent, child).startsWith("..")` calls
        // `memory/..index.md` OUTSIDE `memory/`, because a leading `..` in a filename is not a
        // traversal — a fail-open in the check chosen over a filename exemption precisely because an
        // exemption would be a door any record could use.
        assert.equal(isInside("/x/memory", "/x/memory/..index.md"), true);
        assert.equal(isInside("/x/memory", "/x/memory/..a/INDEX.md"), true);
        assert.equal(isInside("/x/memory", "/x/memory/INDEX.md"), true);
        assert.equal(isInside("/x/memory", "/x/memory"), true);
        assert.equal(isInside("/x/memory", "/x/memory-index.md"), false);
        assert.equal(isInside("/x/memory", "/x/notes/i.md"), false);
        assert.equal(isInside("/x/memory", "/x"), false);
    });

    test("an index named `..something` inside the store is refused, end to end", () => {
        // The measured consequence before the fix: the index was written into the store, `run`
        // reported ok, and `doctor` counted it as a second record — reporting it for stating no
        // retirement condition, about a file that is not a record at all.
        const manifest = wellFormed({
            memory: {
                index: { path: "memory/..index.md", budget: { lines: 60, columns: 140 } },
                store: { budget: { kilobytes: 200 } },
            },
        });
        const dir = workspace({ "memory/a-first.md": record("rule") }, manifest);
        assert.throws(() => inspect(dir, { write: true }), IndexError);
        assert.equal(fs.readdirSync(path.join(dir, "memory")).sort().join(","), "a-first.md");
    });

    test("an index sited inside the store it indexes", () => {
        // `doctor`'s store report counts every `.md` in the store; an index living there is counted
        // as a record, sized into the KB figure, and reported for stating no retirement condition.
        // Refused rather than special-cased: a name-based exemption is a hiding place, and this
        // repository had found eight fail-opens of that shape in its own scaffolding — and this check
        // became the ninth before it shipped, which is the test two above this one.
        const manifest = wellFormed({
            memory: {
                index: { path: "memory/INDEX.md", budget: { lines: 60, columns: 140 } },
                store: { budget: { kilobytes: 200 } },
            },
        });
        const dir = workspace({ "memory/a-first.md": record("rule") }, manifest);
        assert.throws(() => inspect(dir, { write: true }), IndexError);
    });

    test("a workspace declaring no memory at all is not an error — it is a workspace with no index", () => {
        const manifest = wellFormed();
        delete manifest.memory;
        const dir = workspace({ "memory/a-first.md": record("rule") }, manifest);
        const result = inspect(dir);
        assert.equal(failures(result).length, 0);
        assert.equal(result.declared, false);
    });
});

// ---------------------------------------------------------------- the command

describe("run", () => {
    test("exits 2 with no arguments rather than guessing a workspace", () => {
        assert.equal(run([]), 2);
    });

    test("exits 0 when every named workspace is current and within budget", () => {
        const dir = workspace({ "memory/a-first.md": record("rule") });
        assert.equal(run([dir]), 0);
        assert.equal(run(["--check", dir]), 0);
    });

    test("does not report an index current when the workspace declares none", () => {
        // Copilot, #72, from the suppressed half. A workspace may rail its store's size and generate
        // no index — a coherent shape — and `run` said `ok … index written, within budget` about a
        // file that does not exist. A green about a nonexistent artifact is the one sentence a tool
        // whose subject is generated artifacts must not print.
        const manifest = wellFormed({ memory: { store: { budget: { kilobytes: 200 } } } });
        const dir = workspace({ "memory/a-first.md": record("rule") }, manifest);
        const lines = [];
        assert.equal(run([dir], (s) => lines.push(s)), 0);
        // `no store index declared` rather than `no index declared` since 2.5: with two series, a
        // sentence that names neither reads as covering both, which is the same over-claim in a
        // smaller font.
        assert.match(lines.join("\n"), /no store index declared/);
        assert.doesNotMatch(lines.join("\n"), /index (current|written)/);
        // The store budget IS declared here, so the clause is earned and stays — which is what makes
        // the three cases below a real distinction rather than the clause being dropped everywhere.
        assert.match(lines.join("\n"), /store within budget/);
    });

    test("does not report a budget held when the workspace declares none", () => {
        // Issue #92, the sibling of the case above: budgets are optional in the schema and none is
        // defaulted, so an index with no budget is an ordinary shape — and `run` said `within budget`
        // over it, which reads as a verified constraint where the truth is that nothing was measured.
        // A green about something never examined is the one sentence a tool whose subject is generated
        // artifacts must not print, and it is the same sentence the clause beside it was repaired for.
        const manifest = wellFormed({ memory: { index: { path: "memory-index.md" } } });
        const dir = workspace({ "memory/a-first.md": record("rule") }, manifest);
        const lines = [];
        assert.equal(run([dir], (s) => lines.push(s)), 0);
        assert.match(lines.join("\n"), /store index written/);
        assert.doesNotMatch(lines.join("\n"), /budget/);
    });

    test("declaring neither an index nor a budget says exactly that and nothing more", () => {
        // `memory: {}` is schema-legal — every key under it is optional — and it declared the object
        // and asked for nothing. The old sentence answered `no store index declared; store within
        // budget`, half of which was a verdict about a budget that does not exist.
        const manifest = wellFormed({ memory: {} });
        const dir = workspace({ "memory/a-first.md": record("rule") }, manifest);
        const lines = [];
        assert.equal(run([dir], (s) => lines.push(s)), 0);
        assert.match(lines.join("\n"), /no store index declared/);
        assert.doesNotMatch(lines.join("\n"), /budget/);
    });

    test("a budget declared where nothing can measure it is not one it reports holding", () => {
        // `lines` and `columns` are measured against the RENDERED index, so a manifest declaring them
        // under no `index.path` has neither judged — and the clause must not appear on the strength of
        // the declaration alone. The schema makes `path` required inside `index`, so this is a manifest
        // `doctor` rejects; `index` does not validate against the schema and the two tools have no
        // ordering, so it is a shape this code reaches. Counting declarations rather than measurements
        // would have left the false green standing here — #91's class, a fix arriving without its
        // sibling, in the change that fixes the sibling.
        const manifest = wellFormed({ memory: { index: { budget: { lines: 60, columns: 140 } } } });
        const dir = workspace({ "memory/a-first.md": record("rule") }, manifest);
        const lines = [];
        assert.equal(run([dir], (s) => lines.push(s)), 0);
        assert.match(lines.join("\n"), /no store index declared/);
        assert.doesNotMatch(lines.join("\n"), /budget/);
    });

    test("exits 1 when a workspace is stale", () => {
        const dir = workspace({ "memory/a-first.md": record("rule") });
        run([dir]);
        tree(dir, { "memory/b-second.md": record("rule") });
        assert.equal(run(["--check", dir]), 1);
    });

    test("exits 2 when a workspace cannot be judged, without judging the others", () => {
        // A red is a verdict about a store. An unparseable manifest is not a verdict about
        // anything, and borrowing 1 for it claims a judgement nobody made.
        const good = workspace({ "memory/a-first.md": record("rule") });
        run([good]);
        const bad = tree(scratch(), { "workspace.json": "{ not json" });
        assert.equal(run(["--check", good, bad]), 2);
    });

    test("judges every workspace before returning, rather than stopping at the first red", () => {
        const a = workspace({ "memory/a-first.md": record("rule") });
        const b = workspace({ "memory/a-first.md": record("rule") });
        run([a]);
        run([b]);
        tree(a, { "memory/b-second.md": record("rule") });
        tree(b, { "memory/b-second.md": record("rule") });
        const lines = [];
        assert.equal(run(["--check", a, b], (s) => lines.push(s)), 1);
        assert.equal(lines.filter((l) => /out of date/i.test(l)).length, 2);
    });
});

// ---------------------------------------------------------------- this repository

describe("the live stores", () => {
    // Customer zero holding itself to the rail, the way ./doctor.test.mjs binds the live retirement
    // conditions. The recipe checks this too; the suite checks it as well so a record edited without
    // a regenerate is red in both places rather than only in CI.
    for (const ws of [".portulan", "examples"]) {
        test(`${ws}'s index is current and within budget`, () => {
            const result = inspect(path.join(REPO, ws));
            assert.equal(result.declared, true);
            assert.equal(text(failures(result)), "");
        });
    }
});

// ---------------------------------------------------------------- the handoff series

// Added at 2.5. The generator gained a second series rather than a second copy of itself: the
// enumeration, the siting refusal, the byte comparison and the write are one implementation, and only
// what a line is made of differs. Two copies of that machinery would drift, and the two copies this
// repository has already shipped both drifted into the identical defect before either was merged
// (../.portulan/memory/ — `isInside` was extracted for exactly this reason).
//
// What differs is the title carrier, and it differs on evidence rather than taste: a memory record's
// title is its filename because most records carry no heading, while every handoff carries one and its
// filename leads with a date, so `titleOf` would render `2026 07 28 the librarian goes on a cron`.

/** A handoff in the shape ../core/templates/handoff.md prescribes — an H1 first, always. */
const handoff = (title, body = "What happened, and why.") => `# ${title}\n\n${body}\n`;

// Only the handoff series is configured here — `memory` is dropped, so these fixtures need no store on
// disk and a finding can only have come from the series under test. The live-tree binding at the end
// is what exercises both series in one workspace.
const withSeries = (over = {}) =>
    wellFormed({
        memory: undefined,
        slots: {
            identity: "identity.md",
            principles: "principles.md",
            gates: "gate-map.md",
            handoffs: "handoffs/",
        },
        handoffs: { index: { path: "handoffs-index.md" } },
        ...over,
    });

describe("a handoff's date comes from its filename", () => {
    test("reads the ISO date a dated filename leads with", () => {
        assert.equal(dateOf("2026-07-28-the-librarian-goes-on-a-cron.md"), "2026-07-28");
        assert.equal(dateOf("2026-01-01-a.md"), "2026-01-01");
    });

    test("returns null when the filename carries none", () => {
        // ../core/operating/loop.md fixes the form as `YYYY-MM-DD-{slug}.md`, and ../.portulan/verify/docs.sh
        // already fails an undated file in the series. This is not a second opinion about that rule:
        // the generator cannot derive a field it needs, so it has nothing to emit.
        assert.equal(dateOf("the-librarian-goes-on-a-cron.md"), null);
        assert.equal(dateOf("2026-7-8-short-fields.md"), null);
    });

    test("refuses a date-shaped prefix that is not a date", () => {
        // `2026-13-45` sorts fine and means nothing. A generated index whose dates are unparseable
        // strings is a chronological index that is not chronological.
        assert.equal(dateOf("2026-13-45-impossible.md"), null);
    });
});

describe("rendering the handoff index", () => {
    test("one line per handoff: the date, the H1, and a link", () => {
        const dir = workspace(
            {
                "handoffs/2026-07-01-the-first-one.md": handoff("The first one"),
                "handoffs/2026-07-28-the-second-one.md": handoff("The second one, with a comma"),
            },
            withSeries(),
        );
        const out = renderHandoffIndex(JSON.parse(fs.readFileSync(path.join(dir, "workspace.json"), "utf8")), readHandoffs(dir, JSON.parse(fs.readFileSync(path.join(dir, "workspace.json"), "utf8"))));
        assert.match(out, /- 2026-07-01 · \[The first one\]\(handoffs\/2026-07-01-the-first-one\.md\)/);
        assert.match(out, /- 2026-07-28 · \[The second one, with a comma\]\(handoffs\/2026-07-28-the-second-one\.md\)/);
    });

    test("the title is the H1, never the filename", () => {
        // The whole reason this series has its own title rule. `titleOf` here would emit
        // `2026 07 28 the librarian goes on a cron`, which is not the name of anything.
        const dir = workspace(
            { "handoffs/2026-07-28-the-librarian-goes-on-a-cron.md": handoff("The librarian goes on a cron") },
            withSeries(),
        );
        inspect(dir, { write: true });
        const out = fs.readFileSync(path.join(dir, "handoffs-index.md"), "utf8");
        assert.match(out, /\[The librarian goes on a cron\]/);
        assert.doesNotMatch(out, /2026 07 28/);
    });

    test("newest first, so the index opens on what just happened", () => {
        const dir = workspace(
            {
                "handoffs/2026-07-01-older.md": handoff("Older"),
                "handoffs/2026-07-28-newer.md": handoff("Newer"),
            },
            withSeries(),
        );
        inspect(dir, { write: true });
        const out = fs.readFileSync(path.join(dir, "handoffs-index.md"), "utf8");
        assert.ok(out.indexOf("Newer") < out.indexOf("Older"), "newest should lead");
    });
});

describe("what the handoff index refuses to guess", () => {
    test("a handoff with no H1 fails, and is never titled from its filename", () => {
        const dir = workspace(
            { "handoffs/2026-07-28-no-heading-here.md": "Just prose, no heading.\n" },
            withSeries(),
        );
        const bad = failures(inspect(dir, { write: true }));
        assert.equal(bad.length, 1);
        assert.equal(bad[0].check, "title");
        assert.equal(bad[0].series, "handoffs");
        assert.match(text(bad), /no `# ` heading/i);
        assert.equal(fs.existsSync(path.join(dir, "handoffs-index.md")), false, "nothing is written when a line cannot be derived");
    });

    test("a handoff whose filename carries no date fails, with a different repair", () => {
        const dir = workspace({ "handoffs/no-date-at-all.md": handoff("No date at all") }, withSeries());
        const bad = failures(inspect(dir, { write: true }));
        assert.equal(bad.length, 1);
        assert.equal(bad[0].check, "date");
        assert.equal(bad[0].series, "handoffs");
        assert.match(text(bad), /YYYY-MM-DD/);
    });

    test("an index sited inside the series is refused, not special-cased", () => {
        // Same rule as the memory index and a second reason for it: a file in `slots.handoffs` is
        // either counted as a handoff by docs.sh's date correspondence, or failed by it for carrying
        // no date. Both are wrong answers about a generated artifact.
        const dir = workspace(
            { "handoffs/2026-07-28-a.md": handoff("A") },
            withSeries({ handoffs: { index: { path: "handoffs/index.md" } } }),
        );
        assert.throws(() => inspect(dir, { write: true }), (e) => {
            assert.ok(e instanceof IndexError);
            assert.match(e.message, /sits inside the series it indexes/);
            return true;
        });
    });

    test("a `handoffs` object with no `slots.handoffs` is refused", () => {
        const dir = workspace(
            {},
            withSeries({
                slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md", memory: "memory/" },
            }),
        );
        assert.throws(() => inspect(dir, { write: true }), (e) => {
            assert.ok(e instanceof IndexError);
            assert.match(e.message, /no `slots\.handoffs`/);
            return true;
        });
    });

    test("a workspace declaring no `handoffs` object indexes its store and says nothing about the series", () => {
        const dir = workspace({ "memory/a-first.md": record("rule") });
        const result = inspect(dir, { write: true });
        assert.equal(result.series.handoffs.declared, false);
        assert.equal(failures(result).length, 0);
    });
});

describe("the handoff index is byte-compared like the store's", () => {
    test("red when a handoff was added and the index was not regenerated", () => {
        const dir = workspace({ "handoffs/2026-07-01-a.md": handoff("A") }, withSeries());
        inspect(dir, { write: true });
        tree(dir, { "handoffs/2026-07-28-b.md": handoff("B") });
        const bad = failures(inspect(dir));
        assert.equal(bad.length, 1);
        assert.equal(bad[0].check, "index");
        assert.equal(bad[0].series, "handoffs");
        assert.match(text(bad), /out of date/i);
    });

    test("--check does not write the file it disagrees with", () => {
        const dir = workspace({ "handoffs/2026-07-01-a.md": handoff("A") }, withSeries());
        inspect(dir, { write: true });
        const before = fs.readFileSync(path.join(dir, "handoffs-index.md"));
        tree(dir, { "handoffs/2026-07-28-b.md": handoff("B") });
        inspect(dir);
        assert.deepEqual(fs.readFileSync(path.join(dir, "handoffs-index.md")), before);
    });

    test("no budget is declarable, so no budget finding can be raised over the series", () => {
        // The absence is the design (spec/slots.md): every remedy a budget could ask for on an
        // append-only series is barred, so a rail here is one built to be broken. Asserted rather
        // than left to the schema, because `additionalProperties: false` is checked by `doctor` and
        // this generator is what would have to implement the rail.
        const dir = workspace(
            Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`handoffs/2026-07-${String(i + 1).padStart(2, "0")}-h.md`, handoff(`H${i}`)])),
            withSeries(),
        );
        const bad = failures(inspect(dir, { write: true }));
        assert.equal(bad.filter((f) => f.series === "handoffs" && f.check === "budget").length, 0);
    });
});

describe("the live handoff series", () => {
    test(".portulan's handoff index is current", () => {
        const result = inspect(path.join(REPO, ".portulan"));
        assert.equal(result.series.handoffs.declared, true);
        assert.equal(text(failures(result).filter((f) => f.series === "handoffs")), "");
    });
});

// ---------------------------------------------------------------- persona memory scopes

// The third series, added at Workspace Definition 2.6 for milestone 6's landing clause. It differs
// from the other two in where it is derived FROM: the memory store and the handoff series are
// directories this workspace owns, while a scope is declared by a persona inside a pack the
// workspace merely composes. So the source is the cascade, not the tree — which is the whole point.
// `../docs/milestones/m06.md` binds the demonstration to three observations, and the last two are
// what these tests exist to make mechanical: the location must be shown CONNECTED to the declared
// scope (a positive control), and the pack must be shown carrying none of the contents.

const persona = (name, scope = "Its own supervisor memory: classes of defect this codebase produces.") =>
    `---\nname: ${name}\ndescription: Grades work it did not do.\ntools: [read]\n---\n\n` +
    `# Persona — ${name}\n\n## Charter\n\nGrades one checkpoint.\n\n` +
    `## Memory scope\n\n${scope}\n\n## Read / write posture\n\nReads broadly.\n`;

const packManifest = (over = {}) =>
    JSON.stringify(
        {
            portulan: { pack: "1.0", version: "0.1.0" },
            name: "checkpoints",
            category: "rituals",
            summary: "A ritual pack for the fixtures.",
            doc: "README.md",
            contributes: { personas: ["personas/supervisor.md"] },
            ...over,
        },
        null,
        2,
    );

/** Only the scopes series is configured, for the same isolation reason `withSeries` gives. */
const withScopes = (over = {}) =>
    wellFormed({
        portulan: { spec: "2.6" },
        memory: undefined,
        tree: "./",
        packs: ["rituals/checkpoints"],
        slots: {
            identity: "identity.md",
            principles: "principles.md",
            gates: "gate-map.md",
            personas: "personas/",
        },
        personas: { index: { path: "personas-index.md" } },
        ...over,
    });

/** A workspace composing one pack that ships one persona, both on disk. */
const withPack = (files = {}, manifest = withScopes()) =>
    workspace(
        {
            "packs/rituals/checkpoints/pack.json": packManifest(),
            "packs/rituals/checkpoints/README.md": "# checkpoints\n",
            "packs/rituals/checkpoints/personas/supervisor.md": persona("supervisor"),
            ...files,
        },
        manifest,
    );

describe("a persona's declared memory scope lands in the adopter's layer", () => {
    test("the location is created, and created EMPTY", () => {
        // m06.md observation 1, and the maintainer's ruling of 2026-07-30: `present and empty` binds
        // literally. Not a marker file, not a .gitkeep — nothing. The connection is carried by the
        // index, which is why it can be.
        const dir = withPack();
        inspect(dir, { write: true });
        const landed = path.join(dir, "personas", "supervisor");
        assert.equal(fs.existsSync(landed), true, "the location should be created by the landing step");
        assert.deepEqual(fs.readdirSync(landed), [], "and it should hold nothing at all");
    });

    test("the location is in the ADOPTER's layer, never in the pack", () => {
        // m06.md observation 3 as a siting assertion rather than as prose.
        const dir = withPack();
        inspect(dir, { write: true });
        assert.equal(fs.existsSync(path.join(dir, "personas", "supervisor")), true);
        assert.equal(fs.existsSync(path.join(dir, "packs", "rituals", "checkpoints", "personas", "supervisor")), false);
    });

    test("the index names the persona, the pack it came from, and the location", () => {
        const dir = withPack();
        inspect(dir, { write: true });
        const out = fs.readFileSync(path.join(dir, "personas-index.md"), "utf8");
        assert.match(out, /supervisor/);
        assert.match(out, /rituals\/checkpoints/);
        assert.match(out, /personas\/supervisor\//);
    });

    test("the scope's text reaches the index, so the index moves when the scope does", () => {
        // The positive control m06.md calls the load-bearing one and the easiest to skip: what
        // distinguishes `arrived` from `a directory somebody made`. If the pack reworded its
        // persona's scope and this file did not move, the connection would be decorative.
        const dir = withPack();
        inspect(dir, { write: true });
        const before = fs.readFileSync(path.join(dir, "personas-index.md"), "utf8");

        tree(dir, { "packs/rituals/checkpoints/personas/supervisor.md": persona("supervisor", "Something else entirely.") });
        inspect(dir, { write: true });
        const after = fs.readFileSync(path.join(dir, "personas-index.md"), "utf8");

        assert.notEqual(before, after, "a reworded scope must change the generated index");
    });

    test("a scope reworded without regenerating is red, not silently tolerated", () => {
        const dir = withPack();
        inspect(dir, { write: true });
        tree(dir, { "packs/rituals/checkpoints/personas/supervisor.md": persona("supervisor", "Reworded.") });
        const bad = failures(inspect(dir));
        assert.equal(bad.length, 1);
        assert.equal(bad[0].series, "scopes");
        assert.equal(bad[0].check, "index");
        assert.match(text(bad), /out of date/);
    });
});

describe("what the scopes index refuses to guess", () => {
    test("a persona carrying no Memory scope section fails, and nothing is written", () => {
        // The five-part contract's fourth part. Refusing here is derivation declining to invent a
        // scope, not contract validation — that arrives at milestone 7 under `row 6 declares, row 7
        // validates` (core/operating/memory.md).
        const dir = withPack({
            "packs/rituals/checkpoints/personas/supervisor.md":
                "---\nname: supervisor\n---\n\n# Persona — supervisor\n\n## Charter\n\nGrades.\n",
        });
        const bad = failures(inspect(dir, { write: true }));
        assert.equal(bad.length, 1);
        assert.equal(bad[0].series, "scopes");
        assert.equal(bad[0].check, "scope");
        assert.match(text(bad), /Memory scope/);
        assert.equal(fs.existsSync(path.join(dir, "personas-index.md")), false, "nothing is written when a line cannot be derived");
    });

    test("a declared pack that does not resolve is reported, never skipped", () => {
        const dir = withPack({}, withScopes({ packs: ["rituals/checkpoints", "rituals/absent"] }));
        const bad = failures(inspect(dir, { write: true }));
        assert.equal(bad.some((f) => f.series === "scopes" && f.check === "pack"), true);
        assert.match(text(bad), /rituals\/absent/);
    });

    test("an index sited inside the layer it indexes is refused", () => {
        const dir = withPack({}, withScopes({ personas: { index: { path: "personas/personas-index.md" } } }));
        assert.throws(() => inspect(dir, { write: true }), (e) => e instanceof IndexError && /sits inside/.test(e.message));
    });

    test("an index declared with no layer to land in is refused", () => {
        const dir = withPack({}, withScopes({ slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" } }));
        assert.throws(() => inspect(dir, { write: true }), (e) => e instanceof IndexError && /slots\.personas/.test(e.message));
    });

    test("a workspace declaring no packs declares no scopes, and that is not a failure", () => {
        const dir = withPack({}, withScopes({ packs: [] }));
        const result = inspect(dir, { write: true });
        assert.equal(failures(result).filter((f) => f.series === "scopes").length, 0);
    });
});

describe("the two controls the landing clause turns on", () => {
    test("negative control: a location no composed persona declares is reported orphaned", () => {
        // `a directory somebody made` — the shape m06.md names. Without this sweep the layer would
        // accept any directory and the positive control would only ever look at the ones it expected.
        const dir = withPack({ "personas/invented/.keep": "" });
        const bad = failures(inspect(dir, { write: true }));
        assert.equal(bad.some((f) => f.series === "scopes" && f.check === "orphan"), true);
        assert.match(text(bad), /invented/);
    });

    test("a location that has EARNED records is not an orphan and not a failure", () => {
        // Empty is the correct end state on day one, never a permanent requirement. A rail that
        // reddened once the adopter wrote their first record would be a rail against the feature.
        const dir = withPack();
        inspect(dir, { write: true });
        tree(dir, { "personas/supervisor/a-defect-class.md": record("rule") });
        assert.equal(failures(inspect(dir)).filter((f) => f.series === "scopes").length, 0);
    });

    test("observation 3: a pack shipping memory records of its own is refused", () => {
        // The pack declares the scope and must carry none of its contents — thesis 6 from the
        // distributing side. A pack that shipped records would be core-and-packs absorbing the
        // adopter's specifics, which the constitution forbids.
        const dir = withPack({ "packs/rituals/checkpoints/memory/a-record.md": record("rule") });
        const bad = failures(inspect(dir, { write: true }));
        assert.equal(bad.some((f) => f.series === "scopes" && f.check === "contents"), true);
        assert.match(text(bad), /carries/i);
    });
});

describe("--check never lands anything", () => {
    test("check mode creates no location, so a verify recipe cannot manufacture its own green", () => {
        const dir = withPack();
        inspect(dir);
        assert.equal(fs.existsSync(path.join(dir, "personas", "supervisor")), false);
        assert.equal(fs.existsSync(path.join(dir, "personas-index.md")), false);
    });
});

describe("the live scopes series", () => {
    test(".portulan's persona-scope index is current", () => {
        const result = inspect(path.join(REPO, ".portulan"));
        assert.equal(result.series.scopes.declared, true);
        assert.equal(text(failures(result).filter((f) => f.series === "scopes")), "");
    });
});

describe("the summary names every series, including the third", () => {
    test("a workspace declaring only scopes is not reported as declaring no index", () => {
        // The comment in `run` says a series that generates nothing must say so, and that "the same
        // trap has two doors now that there are two series". A third series is a third door, and the
        // first draft of this feature walked straight through it: `index` printed a green naming the
        // store and the handoffs and silently omitted the scopes it had just written.
        const dir = withPack();
        const lines = [];
        const code = run([dir], (s) => lines.push(s));
        assert.equal(code, 0);
        assert.match(lines.join("\n"), /scope index written/);
    });

    test("--check says current where a write says written, for the scopes series too", () => {
        const dir = withPack();
        run([dir], () => {});
        const lines = [];
        assert.equal(run(["--check", dir], (s) => lines.push(s)), 0);
        assert.match(lines.join("\n"), /scope index current/);
    });
});

describe("a scope line names its location and does NOT link to it", () => {
    test("the location is inline code, never a markdown link", () => {
        // Caught in CI, green locally, which is the whole lesson. The first version emitted
        // `[personas/supervisor/](personas/supervisor/)` and the `links` check passed on the author's
        // disk — where the directory exists — and FAILED on a fresh checkout, because the location is
        // EMPTY and git does not carry an empty directory. A link asserts a resolvable target; this path
        // is a declaration, and may legitimately not exist yet. So it is named, not linked.
        const dir = withPack();
        inspect(dir, { write: true });
        const out = fs.readFileSync(path.join(dir, "personas-index.md"), "utf8");
        assert.match(out, /`personas\/supervisor\/`/);
        assert.doesNotMatch(out, /\]\(personas\/supervisor/, "a link would be unresolvable in any clone");
    });

    test("no line in the rendered index is a relative link at all", () => {
        // The rail this feature must not break: `.portulan/verify/docs.sh`'s `links` check walks every
        // relative link in every tracked Markdown file. A generated file is the worst place to put one
        // that cannot resolve, because regenerating reproduces it.
        const dir = withPack();
        inspect(dir, { write: true });
        const body = fs.readFileSync(path.join(dir, "personas-index.md"), "utf8")
            .split("\n").filter((l) => l.startsWith("- ")).join("\n");
        assert.doesNotMatch(body, /\]\(/, "scope lines must carry no markdown links");
    });

    test("a scope whose first sentence runs long is truncated visibly, never silently", () => {
        const long = "A".repeat(200) + ".";
        const dir = withPack({ "packs/rituals/checkpoints/personas/supervisor.md": persona("supervisor", long) });
        inspect(dir, { write: true });
        const out = fs.readFileSync(path.join(dir, "personas-index.md"), "utf8");
        assert.match(out, /…/, "a cut must be visible in the artifact");
    });

    test("a colon does not end a sentence: the clause after it is the informative half", () => {
        const dir = withPack();
        inspect(dir, { write: true });
        const out = fs.readFileSync(path.join(dir, "personas-index.md"), "utf8");
        assert.match(out, /classes of defect/, "the text after the colon carries the meaning");
    });
});

describe("a pack root can be named on the command line", () => {
    // Adjustment 6 of the milestone-6 session-open checkpoint. `resolvePack` was root-parameterized at
    // session 0 precisely so an installed-from-a-feed pack would be the same code path — but nothing
    // SET those roots, so the parameter was reachable only from a test. "Zero new resolver code" was
    // true and "only a new root" was not: a root needs a caller.
    test("a pack outside the workspace's own tree resolves from a named root", () => {
        const feed = tree(scratch(), {
            "rituals/checkpoints/pack.json": packManifest(),
            "rituals/checkpoints/README.md": "# checkpoints\n",
            "rituals/checkpoints/personas/supervisor.md": persona("supervisor"),
        });
        // No `packs/` in this workspace's own tree at all — so a green here cannot have come from it.
        const dir = workspace({}, withScopes({ tree: undefined }));
        const lines = [];
        assert.equal(run(["--pack-root", feed, dir], (s) => lines.push(s)), 0);
        assert.match(lines.join("\n"), /scope index written/);
        assert.deepEqual(fs.readdirSync(path.join(dir, "personas", "supervisor")), []);
    });

    test("without the root, the same workspace reports the pack unresolved", () => {
        const dir = workspace({}, withScopes({ tree: undefined }));
        const lines = [];
        assert.equal(run([dir], (s) => lines.push(s)), 1);
        assert.match(lines.join("\n"), /does not resolve/);
    });

    test("a named root is searched before the workspace's own, so a feed install cannot be faked by the tree", () => {
        const feed = tree(scratch(), {
            "rituals/checkpoints/pack.json": packManifest(),
            "rituals/checkpoints/README.md": "# checkpoints\n",
            "rituals/checkpoints/personas/supervisor.md": persona("supervisor", "From the feed."),
        });
        const dir = withPack();
        run(["--pack-root", feed, dir], () => {});
        const out = fs.readFileSync(path.join(dir, "personas-index.md"), "utf8");
        assert.match(out, /From the feed\./);
    });

    test("--pack-root with no directory is exit 2, never a verdict", () => {
        const dir = withPack();
        const lines = [];
        assert.equal(run(["--pack-root"], (s) => lines.push(s)), 2);
        assert.equal(run(["--pack-root", "--check", dir], (s) => lines.push(s)), 2);
    });

    test("a named root that does not exist is exit 2, not a pack that failed to resolve", () => {
        // The distinction `verify-preconditions-fail-closed` is about: "I was told to look somewhere
        // that is not there" is a configuration fact, and reporting it as `does not resolve` would send
        // an author to look at their manifest.
        const dir = withPack();
        const lines = [];
        assert.equal(run(["--pack-root", path.join(dir, "nope"), dir], (s) => lines.push(s)), 2);
        assert.match(lines.join("\n"), /nope/);
    });
});

describe("what the orphan sweep sees, measured rather than named", () => {
    test("a stray FILE under the layer is reported, not only a stray directory", () => {
        // Pre-commit checkpoint, adjustment 4: the sweep tested `isDirectory()` and skipped everything
        // else, so a `.md` dropped into the layer passed silently — a checker's coverage is measured, not
        // named (`a-checkers-coverage-is-measured-not-named`).
        const dir = withPack();
        inspect(dir, { write: true });
        tree(dir, { "personas/stray-notes.md": "Notes nobody declared.\n" });
        const bad = failures(inspect(dir));
        assert.equal(bad.some((f) => f.series === "scopes" && f.check === "orphan"), true);
        assert.match(text(bad), /stray-notes\.md/);
    });

    test("a record inside a DECLARED location is still fine — that is earned memory", () => {
        const dir = withPack();
        inspect(dir, { write: true });
        tree(dir, { "personas/supervisor/a-defect-class.md": record("rule") });
        assert.equal(failures(inspect(dir)).filter((f) => f.series === "scopes").length, 0);
    });
});

describe("the scope digest covers what the comment says it covers", () => {
    test("a provenance aside containing a markdown link is stripped, nested parens and all", () => {
        // Pre-commit checkpoint, adjustment 7: `_\([^)]*\)_` cannot pass a `)` from a link target, so the
        // one aside the shipped persona actually carries was digest input while the comment said asides
        // were dropped. A checker whose comment overstates it is the same defect as prose that does.
        const withLink = "Its own memory.\n\n_(See [memory.md](../../core/operating/memory.md).)_";
        const withoutAside = "Its own memory.";
        const a = memoryScopeOf(persona("supervisor", withLink));
        const b = memoryScopeOf(persona("supervisor", withoutAside));
        assert.equal(a, b, "the aside must not reach the digest input");
    });

    test("a reworded SCOPE still moves, so stripping asides did not blunt the control", () => {
        const a = memoryScopeOf(persona("supervisor", "One thing."));
        const b = memoryScopeOf(persona("supervisor", "Another thing."));
        assert.notEqual(a, b);
    });
});

describe("empty means readable-and-zero, never could-not-look", () => {
    test("a declared location that cannot be enumerated is refused, not reported empty", () => {
        // The enumeration fail-open this repository has now fixed five times: an unreadable directory
        // returning nothing is indistinguishable from an empty one, and "empty until earned" is the
        // feature's own success state — so here the confusion would read as the design working.
        // Exit 2 (`IndexError`), never a pass: it is a fact about the filesystem, not about the scope.
        const dir = withPack();
        inspect(dir, { write: true });
        const landed = path.join(dir, "personas", "supervisor");
        fs.chmodSync(landed, 0o000);
        try {
            assert.throws(
                () => inspect(dir),
                (e) => e instanceof IndexError && /cannot be read|cannot enumerate/i.test(e.message) && /supervisor/.test(e.message),
            );
        } finally {
            fs.chmodSync(landed, 0o755);
        }
    });

    test("a location the LAYER hides is refused too, not skipped as absent", () => {
        // #91's sibling, found inside the paragraph that states the rule. The guard was
        // `if (!fs.existsSync(location)) continue`, and `existsSync` is a `stat` that answers `false`
        // for every failure, permission included. A layer at mode `0400` is readable — so the
        // enumeration above it passes — and not searchable, so every declared location under it
        // stat-ed false, was skipped as absent, and the refusal below became unreachable. The guard
        // whose own comment promises *never could-not-look* was the one thing looking, and it could
        // not. The read decides now, and its `ENOENT` is the only absent.
        const dir = withPack();
        inspect(dir, { write: true });
        const layer = path.join(dir, "personas");
        fs.chmodSync(layer, 0o400);
        try {
            assert.throws(
                () => inspect(dir),
                (e) =>
                    e instanceof IndexError &&
                    /cannot be read/i.test(e.message) &&
                    /supervisor/.test(e.message) &&
                    // And it does not claim the location EXISTS. That word was true while `existsSync`
                    // gated the read and became false the moment the guard came out: an `EACCES` from
                    // an unsearchable ancestor is exactly the case where existence cannot be known, so
                    // the refusal would be asserting the one thing it could not establish — this
                    // change's own defect, in this change's own sentence. Copilot, round 1 on #166.
                    !/exists/.test(e.message),
            );
        } finally {
            fs.chmodSync(layer, 0o755);
        }
    });

    test("a readable, empty location is green — the state of every landing on day one", () => {
        const dir = withPack();
        inspect(dir, { write: true });
        assert.equal(failures(inspect(dir)).filter((f) => f.series === "scopes").length, 0);
    });

    test("an ABSENT location is green too, and that is a different fact from unreadable", () => {
        // Absent is the fresh-clone state, because git carries no empty directory. Refusing it would
        // red every checkout; confusing it with unreadable would hide a real filesystem failure.
        const dir = withPack();
        inspect(dir, { write: true });
        fs.rmSync(path.join(dir, "personas", "supervisor"), { recursive: true });
        assert.equal(failures(inspect(dir)).filter((f) => f.series === "scopes").length, 0);
    });
});

describe("a pack cannot read outside itself through a declared persona path", () => {
    test("a `..` path in contributes.personas is refused, not resolved", () => {
        // Copilot, round 5 on #117. `resolvePack` guards the pack NAME against `..` — with a comment
        // saying a `..` segment there "would resolve a declared pack outside every root it was supposed
        // to be searched in" — and the persona paths INSIDE the manifest had no such guard. A composed
        // pack is third-party content by construction, which is the whole reason its gate fragments may
        // only tighten; a manifest that can name any path on the filesystem reads files the adopter
        // never offered it, and would put their contents into a committed index.
        const outside = path.join(scratch(), "secret.md");
        fs.writeFileSync(outside, "---\nname: x\n---\n\n## Memory scope\n\nSomething private.\n");
        const dir = withPack({
            "packs/rituals/checkpoints/pack.json": packManifest({
                contributes: { personas: ["../../../" + path.relative(path.dirname(path.dirname(path.dirname(outside))), outside)] },
            }),
        });
        assert.throws(
            () => inspect(dir, { write: true }),
            (e) => e instanceof IndexError && /outside the pack/i.test(e.message),
        );
    });

    test("an absolute path is refused on the same rule", () => {
        const dir = withPack({
            "packs/rituals/checkpoints/pack.json": packManifest({ contributes: { personas: ["/etc/hosts"] } }),
        });
        assert.throws(
            () => inspect(dir, { write: true }),
            (e) => e instanceof IndexError && /outside the pack/i.test(e.message),
        );
    });

    test("an ordinary nested path inside the pack still resolves", () => {
        const dir = withPack({
            "packs/rituals/checkpoints/pack.json": packManifest({ contributes: { personas: ["roles/supervisor.md"] } }),
            "packs/rituals/checkpoints/roles/supervisor.md": persona("supervisor"),
        });
        const result = inspect(dir, { write: true });
        assert.equal(failures(result).filter((f) => f.series === "scopes").length, 0);
    });
});

describe("the generated index is valid Markdown, not just correct text", () => {
    test("no strong-emphasis span is broken across a line", () => {
        // Copilot, round 5. Markdown strong emphasis cannot span a newline, so a `**…**` split across
        // two rendered lines prints the asterisks literally — and the committed index already showed it.
        // A generated artifact that renders wrong is the same class as one that says something wrong.
        const dir = withPack();
        inspect(dir, { write: true });
        const out = fs.readFileSync(path.join(dir, "personas-index.md"), "utf8");
        for (const line of out.split("\n")) {
            const stars = (line.match(/\*\*/g) ?? []).length;
            assert.equal(stars % 2, 0, `unbalanced ** on: ${line}`);
        }
    });
});

describe("a malformed pack manifest fails CLOSED, never as a crash", () => {
    test("a non-string persona entry is an IndexError naming the pack, not a TypeError", () => {
        // Copilot, round 6. `contributes.personas: [123]` parses, so the schema never sees it if `doctor`
        // has not run — and `path.resolve` on a number threw a bare TypeError that escaped as an
        // unanticipated crash rather than the exit 2 this module reserves for "could not judge". The
        // surrounding code already prefers a named IndexError for every other malformed-manifest shape.
        const dir = withPack({
            "packs/rituals/checkpoints/pack.json": packManifest({ contributes: { personas: [123] } }),
        });
        assert.throws(
            () => inspect(dir, { write: true }),
            (e) => e instanceof IndexError && /rituals\/checkpoints/.test(e.message) && /not a string|string path/i.test(e.message),
        );
    });

    test("--pack-root pointing at a FILE is refused, since the flag says it needs a directory", () => {
        // Copilot, round 6. `existsSync` is true for a file, so the flag was accepted and every later
        // resolution failure was then misattributed to the packs rather than to the argument.
        const dir = withPack();
        const file = path.join(dir, "identity.md");
        const lines = [];
        assert.equal(run(["--pack-root", file, dir], (s) => lines.push(s)), 2);
        assert.match(lines.join("\n"), /not a directory/i);
    });
});

describe("a symlink cannot get a pack past either containment guard", () => {
    // Copilot, round 8 on #117. Round 6 closed the LEXICAL traversal and left two symlink doors open in
    // the same two guards. `path.resolve` is textual; `readFileSync` follows links. So the guard proved a
    // string was inside the pack and then read whatever the filesystem pointed at — which is the
    // fail-open shape this repository names most, arriving one round after its own repair.
    test("a persona symlinked out of the pack is refused, not read", () => {
        const outside = path.join(scratch(), "secret.md");
        fs.writeFileSync(outside, "---\nname: x\n---\n\n## Memory scope\n\nSomething private.\n");
        const dir = withPack();
        const link = path.join(dir, "packs", "rituals", "checkpoints", "personas", "supervisor.md");
        fs.rmSync(link);
        fs.symlinkSync(outside, link);
        assert.throws(
            () => inspect(dir, { write: true }),
            (e) => e instanceof IndexError && /outside the pack/i.test(e.message),
        );
    });

    test("a `memory` SYMLINK does not slip past the pack-carries-no-records refusal", () => {
        // The other door: `packRecords` matched the segment `memory/`, and a symlink named `memory` is
        // neither a directory it recurses into nor a file under one — so it was invisible to a check whose
        // whole subject is what the pack ships.
        const store = scratch();
        fs.writeFileSync(path.join(store, "smuggled.md"), record("rule"));
        const dir = withPack();
        fs.symlinkSync(store, path.join(dir, "packs", "rituals", "checkpoints", "memory"));
        const result = (() => { try { return inspect(dir, { write: true }); } catch (e) { return e; } })();
        if (result instanceof Error) {
            assert.match(result.message, /memory/i);
        } else {
            assert.equal(failures(result).some((f) => f.series === "scopes" && f.check === "contents"), true, text(failures(result)));
        }
    });

    test("an ordinary persona file inside the pack still resolves", () => {
        const dir = withPack();
        assert.equal(failures(inspect(dir, { write: true })).filter((f) => f.series === "scopes").length, 0);
    });
});
