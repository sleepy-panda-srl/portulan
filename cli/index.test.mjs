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
    readStore,
    render,
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

    test("red when the index is declared and absent", () => {
        const dir = workspace({ "memory/a-first.md": record("rule") });
        const bad = failures(inspect(dir));
        assert.equal(bad.length, 1);
        assert.equal(bad[0].check, "index");
        assert.match(text(bad), /memory-index\.md/);
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

    test("an index sited inside the store it indexes", () => {
        // `doctor`'s store report counts every `.md` in the store; an index living there is counted
        // as a record, sized into the KB figure, and reported for stating no retirement condition.
        // Refused rather than special-cased: a name-based exemption is a hiding place, and this
        // repository has found eight fail-opens of that shape in its own scaffolding.
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
