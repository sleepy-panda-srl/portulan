// The release-eval suite. Every case exists because something here was already wrong in that way, or
// because a fresh-context reviewer named the way it would be before a line was written.
//
// The traps:
//   * **no case runs the recipe set.** `--capture` spawns every rail in the workspace; a test that did
//     would put the whole suite inside one of its own members. `measure()` is reached only through
//     `--capture`, and every case here exercises the record layer instead — which is what the rail reads
//   * **cut detection off `CHANGELOG.md`'s TOP heading never fires.** The cut re-seeds `## Unreleased`
//     above the version it just wrote, so the top heading is `Unreleased` on the cut commit too. The
//     case below pins the released set against a changelog shaped exactly like the real one
//   * **a rail that grades only the newest record is not a rail over the record layer.** Once `0.1.4`
//     is declared, `0.1.3`'s record could be deleted in silence. Every governed release stays graded
//   * **a boolean renders as a branch**, so its absence invents a claim rather than leaving a hole —
//     the one measured blind spot in a derived shape check, and it is checked explicitly
//   * the register is byte-compared through this module's own renderer, so the published document
//     cannot drift from its capture

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A HERMETIC HOST, the three-line block `pinned-roots.live.test.mjs` sweeps for — asserted WHOLE, so
// that copying the two lines which neutralise the host and dropping the one that tidies up is caught.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import {
    FIRST_GOVERNED_VERSION,
    RECORD_DIR,
    SELF,
    abBaselineIdentity,
    changelogVersions,
    compareVersions,
    declaredVersion,
    isGoverned,
    limitationsFor,
    registerPath,
    renderRegister,
    run,
    snapshotPath,
    verifyRecord,
    verifyShape,
} from "./release-eval.mjs";

// ---------------------------------------------------------------- fixtures

/**
 * Every leaf of an object as a path, **arrays included**.
 *
 * Shared by both sweeps below rather than written twice: they were two copies of one walk, one of them
 * skipping arrays, and the copy that skipped them sat under a test asserting totality over every leaf.
 */
function leafPaths(value, prefix = []) {
    if (value === null || typeof value !== "object") return [prefix];
    return Object.entries(value).flatMap(([k, v]) => leafPaths(v, [...prefix, k]));
}


/** A capture that is valid in every respect, for a governed release. Cases mutate a clone of it. */
function goodSnap(version = "0.1.3") {
    return {
        portulan: { releaseEval: "1" },
        version,
        captured: "2026-09-01",
        source: { commit: "0".repeat(40), clean: true },
        host: { node: "v22.0.0", platform: "linux" },
        recipes: [
            { id: "docs", exit: 0 },
            { id: "tests", exit: 0 },
        ],
        excluded: [{ id: SELF, why: "a capture cannot be accurate about the record it is inside" }],
        abBaseline: { snapshot: "evals/ab/baseline.json", register: "evals/ab/baseline.md", captured: "2026-08-31", commit: "a".repeat(40), clean: false },
    };
}

/**
 * A repository shaped like this one: a `package.json`, a `CHANGELOG.md` with a re-seeded accumulator,
 * and whatever records the case wants. Nothing here is a git repository — `--verify` reads no git.
 */
function fixtureRepo({ version = "0.1.3", released = ["0.1.3", "0.1.2", "0.1.1", "0.1.0"], records = {} } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-release-eval-"));
    fs.writeFileSync(path.join(root, "package.json"), `${JSON.stringify({ name: "x", version }, null, 4)}\n`);
    // Shaped like the real file: `## Unreleased` on top, the cut below it, and an entry that QUOTES a
    // heading — the trap a looser matcher falls into.
    const body = [
        "# Changelog",
        "",
        "## Unreleased",
        "",
        "- something that has not shipped. An entry may quote a heading like `## 9.9.9 — 2020-01-01`,",
        "  and indented prose may too:",
        "    ## 8.8.8 — 2019-01-01",
        "",
        ...released.flatMap((v) => [`## ${v} — 2026-08-20`, "", "- an entry.", ""]),
    ].join("\n");
    fs.writeFileSync(path.join(root, "CHANGELOG.md"), body);
    for (const [v, snap] of Object.entries(records)) {
        fs.mkdirSync(path.join(root, RECORD_DIR), { recursive: true });
        fs.writeFileSync(path.join(root, snapshotPath(v)), `${JSON.stringify(snap, null, 4)}\n`);
        fs.writeFileSync(path.join(root, registerPath(v)), renderRegister(snap));
    }
    return root;
}

function capture() {
    const out = { out: "", err: "" };
    return {
        io: { stdout: { write: (s) => (out.out += s) }, stderr: { write: (s) => (out.err += s) } },
        get out() {
            return out.out;
        },
        get err() {
            return out.err;
        },
    };
}

// ---------------------------------------------------------------- version ordering

test("compareVersions orders X.Y.Z numerically, not lexically", () => {
    assert.equal(compareVersions("0.1.3", "0.1.3"), 0);
    assert.equal(compareVersions("0.1.2", "0.1.3"), -1);
    assert.equal(compareVersions("0.1.10", "0.1.9"), 1, "lexical ordering would put 0.1.10 first");
    assert.equal(compareVersions("0.2.0", "0.10.0"), -1);
});

test("compareVersions refuses anything that is not X.Y.Z rather than guessing an order", () => {
    // A partial semver implementation that silently mis-orders a prerelease would decide whether a
    // release is governed. Refusing is the answer that cannot be quietly wrong.
    assert.throws(() => compareVersions("0.1.3-rc.1", "0.1.3"), /not an `X.Y.Z` version/);
    assert.throws(() => compareVersions("0.1.3", "v0.1.3"), /not an `X.Y.Z` version/);
});

test("the clause binds from FIRST_GOVERNED_VERSION onward and not before", () => {
    for (const v of ["0.1.0", "0.1.1", "0.1.2"]) assert.equal(isGoverned(v), false, `${v} predates the clause`);
    assert.equal(isGoverned(FIRST_GOVERNED_VERSION), true);
    assert.equal(isGoverned("0.2.0"), true);
    assert.equal(isGoverned("1.0.0"), true);
});

// ---------------------------------------------------------------- the released set

test("changelogVersions reads the version headings and never the re-seeded accumulator", () => {
    const root = fixtureRepo();
    // The load-bearing assertion of this whole module: `## Unreleased` is on top on EVERY commit, the
    // cut included, so it is never a release — and the quoted headings inside an entry are not either.
    assert.deepEqual(changelogVersions(root), ["0.1.3", "0.1.2", "0.1.1", "0.1.0"]);
    fs.rmSync(root, { recursive: true, force: true });
});

test("a CHANGELOG with no release heading is could-not-run, never a green over an empty set", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-release-eval-"));
    fs.writeFileSync(path.join(root, "package.json"), '{"version":"0.1.3"}\n');
    fs.writeFileSync(path.join(root, "CHANGELOG.md"), "# Changelog\n\n## Unreleased\n");
    assert.throws(() => changelogVersions(root), /records no `## X.Y.Z` release heading/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("declaredVersion refuses a package.json it cannot read rather than reporting on nothing", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-release-eval-"));
    assert.throws(() => declaredVersion(root), /could not read package.json/);
    fs.writeFileSync(path.join(root, "package.json"), "{not json");
    assert.throws(() => declaredVersion(root), /not valid JSON/);
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    assert.throws(() => declaredVersion(root), /declares no version string/);
    fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- shape

test("a well-formed capture passes the shape check and renders without a hole", () => {
    assert.deepEqual(verifyShape(goodSnap()), []);
    const doc = renderRegister(goodSnap());
    assert.ok(!doc.includes("undefined") && !doc.includes("NaN"));
});

test("EVERY field the renderer reads is caught when deleted — swept, not hand-listed", () => {
    // **The title used to claim this and the body enumerated six hand-chosen drops.** A fresh-context
    // reviewer ran the actual sweep and found three escapes: `abBaseline.captured` and
    // `abBaseline.commit` were read through `??` fallbacks and rendered `<undated>` / `<uncommitted>`,
    // and `abBaseline.clean: null` was explicitly permitted and rendered `**not clean**`. A test whose
    // title asserts totality and whose body asserts six cases is the defect it was written against.
    //
    // So the sweep is derived: walk every leaf path of a valid capture, delete it, and require a red.
    // **`!Array.isArray(v)` was here and it made this title false a second time.** Treating an array as
    // a leaf meant `recipes[].id`, `recipes[].exit`, `excluded[].id` and `excluded[].why` were never
    // swept — four fields the renderer reads, inside a test whose name claims *every* leaf path. That is
    // the third time in this change that a totality claim outran the body under it, and the second time
    // in this very function. Arrays are walked. Copilot round 3.
    const paths = leafPaths(goodSnap());
    assert.ok(
        paths.some((p) => p[0] === "recipes" && p.length > 1),
        "the sweep must reach inside arrays — skipping them is what made this test's name false",
    );
    assert.ok(paths.length >= 16, `the sweep must cover a real capture, not a stub (${paths.length} leaves)`);
    for (const p of paths) {
        const snap = goodSnap();
        let node = snap;
        for (const k of p.slice(0, -1)) node = node[k];
        delete node[p.at(-1)];
        assert.ok(verifyShape(snap).length > 0, `deleting \`${p.join(".")}\` must red, and it does not`);
    }
});

test("a commit field must NAME a commit — `banana` and `HEAD` both rendered as measurements", () => {
    // Copilot round 1 on #381, and it is the degenerate-value class one field further in than the round
    // before it reached: rule 3 asks whether a leaf is present and non-blank, which is a floor under
    // every field and a name check for none. `"HEAD"` is the worse of the two, because it reads like an
    // answer. The record's central claim is that it was measured at a named commit.
    for (const [field, value] of [
        ["source", "banana"],
        ["source", "HEAD"],
        ["source", "a642d55"],
        ["source", "A".repeat(40)],
        ["abBaseline", "banana"],
        ["abBaseline", ""],
    ]) {
        const snap = goodSnap();
        snap[field].commit = value;
        assert.ok(
            verifyShape(snap).length > 0,
            `\`${field}.commit = ${JSON.stringify(value)}\` must red — it renders as a measurement`,
        );
    }
    // **A NON-STRING skipped the check entirely**, because the guard read *"if it is a string, validate
    // it"* rather than *"it must be a string that validates"*. `1234567890` rendered as
    // `` `1234567890` ``, `true` as `` `true` ``, `["a"]` as `` `a` `` — each a plausible measurement
    // passing the check whose whole subject is that field. A type-conditional guard is a guard over the
    // field only when someone already used the right type. Copilot round 4.
    for (const field of ["source", "abBaseline"]) {
        for (const value of [1234567890, true, ["a"], {}, undefined]) {
            const snap = goodSnap();
            snap[field].commit = value;
            assert.ok(
                verifyShape(snap).some((r) => new RegExp(`\`${field}\.commit\``).test(r)),
                `\`${field}.commit = ${JSON.stringify(value) ?? "undefined"}\` must red by name`,
            );
        }
    }
    // `abBaseline: null` stays the one legitimate absence, and tightening must not have swallowed it.
    const none = goodSnap();
    none.abBaseline = null;
    assert.deepEqual(verifyShape(none), [], "shipping against no baseline is still a recorded state");

    // A SHA-256 repository's object names are 64 hex, and refusing those would red a tree nothing is
    // wrong with. Both widths pass; nothing else does.
    for (const width of [40, 64]) {
        const snap = goodSnap();
        snap.source.commit = "a".repeat(width);
        assert.deepEqual(verifyShape(snap), [], `${width}-hex object names are real`);
    }
});

test("this repository's own committed A/B baseline satisfies the object-name check", () => {
    // A rail tightened against a hand-edited capture must not red the real one beside it. Live read.
    const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const id = abBaselineIdentity(here);
    const snap = { ...goodSnap(), abBaseline: id };
    assert.deepEqual(verifyShape(snap), [], "the committed baseline's own commit must pass");
});

test("a PRESENT-DEGENERATE value is refused — null and blank render as values, not as holes", () => {
    // **The second round of this same defect, and the reason the docblock now says three rules.** A
    // capture with `source.commit: null` renders `| Commit | \`null\` |` and one with `""` renders an
    // empty cell — neither is `undefined` or `NaN`, so the derived probe sees a clean page, and neither
    // is a branch, so the by-name checks miss it too. Six of these passed a check that had just been
    // hardened against hand-written records.
    const mutations = [
        ["source.commit", null],
        ["source.commit", ""],
        ["host.node", null],
        ["host.platform", ""],
        ["abBaseline.captured", null],
        ["abBaseline.commit", ""],
        ["captured", "   "],
    ];
    for (const [dotted, value] of mutations) {
        const snap = goodSnap();
        const parts = dotted.split(".");
        let node = snap;
        for (const k of parts.slice(0, -1)) node = node[k];
        node[parts.at(-1)] = value;
        assert.ok(verifyShape(snap).length > 0, `\`${dotted} = ${JSON.stringify(value)}\` must red, and it does not`);
    }
});

test("the leaf sweep NULLS and BLANKS every leaf as well as deleting it", () => {
    // Deleting alone is why the degenerate class survived a round that fixed the identical claim once.
    for (const p of leafPaths(goodSnap())) {
        for (const value of [null, ""]) {
            const snap = goodSnap();
            let node = snap;
            for (const k of p.slice(0, -1)) node = node[k];
            node[p.at(-1)] = value;
            assert.ok(verifyShape(snap).length > 0, `setting \`${p.join(".")}\` to ${JSON.stringify(value)} must red`);
        }
    }
});

test("`abBaseline: null` stays the legitimate null — the walk skips it rather than exempting a field", () => {
    const snap = goodSnap();
    snap.abBaseline = null;
    assert.deepEqual(verifyShape(snap), [], "shipping against no baseline is a recorded state");
});

test("--date is validated at the front door, the one reachable route into the degenerate class", () => {
    for (const bad of ["banana", "   ", "2026-9-1"]) {
        const c = capture();
        assert.equal(run(["--capture", "--date", bad, "--repo-root", "."], c.io), 2, `--date ${JSON.stringify(bad)} must refuse`);
        assert.match(c.err, /YYYY-MM-DD/);
    }
});

test("changelogVersions skips FENCED regions — a worked example is not a release", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-release-eval-"));
    fs.writeFileSync(path.join(root, "package.json"), '{"version":"0.1.3"}\n');
    fs.writeFileSync(
        path.join(root, "CHANGELOG.md"),
        ["# Changelog", "", "## Unreleased", "", "A cut looks like this:", "", "```", "## 9.9.9 — 2020-01-01", "```", "", "## 0.1.3 — 2026-09-01", "", "## 0.1.2 — 2026-08-20", ""].join("\n"),
    );
    assert.deepEqual(changelogVersions(root), ["0.1.3", "0.1.2"], "a fenced example must not enter the released set");
    fs.rmSync(root, { recursive: true, force: true });
});

test("a version-shaped heading that is not X.Y.Z is REFUSED, never silently skipped", () => {
    // `compareVersions` refuses a prerelease out loud on the ground that a partial ordering would
    // silently decide whether a release is governed. Dropping the heading decides the same thing by
    // omission, which is the quieter half of one rule.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-release-eval-"));
    fs.writeFileSync(path.join(root, "package.json"), '{"version":"0.1.3"}\n');
    fs.writeFileSync(path.join(root, "CHANGELOG.md"), "# Changelog\n\n## Unreleased\n\n## 0.1.3-rc.1 — 2026-09-02\n\n## 0.1.3 — 2026-09-01\n");
    assert.throws(() => changelogVersions(root), /which is not `## X\.Y\.Z`/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("no field the renderer reads has a FALLBACK — a placeholder reads like a measurement", () => {
    // The mechanism behind the sweep above: absence must reach the document as a hole. `<undated>` and
    // `<uncommitted>` were holes filled in by the renderer, so the derived probe saw a clean document.
    const snap = goodSnap();
    delete snap.abBaseline.captured;
    assert.ok(renderRegister(snap).includes("undefined"), "absence must render as a hole, never as a placeholder");
    const doc = renderRegister(goodSnap());
    for (const placeholder of ["<undated>", "<uncommitted>", "<commit>", "<agent>"]) {
        assert.ok(!doc.includes(placeholder), `a valid capture must not render \`${placeholder}\``);
    }
});

test("the host's conditions must be strings — found by sweeping the class, not the site", () => {
    // Round 4 named `source.commit`. Sweeping its class — a type-conditional guard — across the module
    // turned up `host.node`, which nothing had named: `host.node: 22` rendered `` `22` `` and passed
    // every check. A fix scoped to the site the note named would have left it.
    for (const k of ["node", "platform"]) {
        for (const value of [22, true, null, undefined]) {
            const snap = goodSnap();
            snap.host[k] = value;
            assert.ok(verifyShape(snap).length > 0, `\`host.${k} = ${JSON.stringify(value) ?? "undefined"}\` must red`);
        }
    }
});

test("a padded date is refused — a check that normalises its input checks something else", () => {
    // `ISO_DATE.test(snap.captured.trim())` accepted `"2026-09-01 "` and the renderer printed the padding
    // straight into the table: a value that passes a format check and violates the format it was checked
    // against. Copilot round 3, and the degenerate-value class once more — present, non-blank, and wrong.
    for (const bad of ["2026-09-01 ", " 2026-09-01", "\t2026-09-01"]) {
        const snap = goodSnap();
        snap.captured = bad;
        assert.ok(verifyShape(snap).some((r) => /is not a `YYYY-MM-DD` date/.test(r)), `${JSON.stringify(bad)} must red`);
    }
    const ok = goodSnap();
    assert.deepEqual(verifyShape(ok), [], "an exact date still passes");
});

test("`abBaseline.clean: null` is refused — the third state rendered as the false arm", () => {
    // It was explicitly permitted by the check whose own message said absence must not publish an
    // unmeasured claim, and then rendered `**not clean**`. Permitting the third state defeated the
    // check in the same line that stated it.
    const snap = goodSnap();
    snap.abBaseline.clean = null;
    assert.ok(verifyShape(snap).some((r) => /`abBaseline.clean` is not a boolean/.test(r)));
});

test("a missing BOOLEAN is caught explicitly, because it renders as a branch and invents a claim", () => {
    // The derived check's one measured blind spot: no hole appears in the document — a perfectly
    // well-formed register asserts the false arm instead. Found by attacking the check, not by reasoning.
    const snap = goodSnap();
    delete snap.source.clean;
    assert.ok(!renderRegister(snap).includes("undefined"), "the register renders cleanly — that is the whole problem");
    assert.ok(
        verifyShape(snap).some((r) => /`source.clean` is not a boolean/.test(r)),
        "a boolean's absence must be caught by name, since the render probe cannot see it",
    );
});

test("an absent abBaseline is refused, while a null one is the recorded state of shipping against none", () => {
    const absent = goodSnap();
    delete absent.abBaseline;
    assert.ok(
        verifyShape(absent).some((r) => /has no `abBaseline`/.test(r)),
        "absent must not render as `null` — that would publish *no baseline* without anyone measuring it",
    );
    const none = goodSnap();
    none.abBaseline = null;
    assert.deepEqual(verifyShape(none), []);
    assert.match(renderRegister(none), /None is committed in this tree/);
});

test("a recipe row with no integer exit reds rather than printing a verdict from nothing", () => {
    const snap = goodSnap();
    snap.recipes = [{ id: "docs", exit: "0" }];
    assert.ok(verifyShape(snap).some((r) => /no integer `exit`/.test(r)));
});

test("a capture listing no recipes at all is refused", () => {
    const snap = goodSnap();
    snap.recipes = [];
    assert.ok(verifyShape(snap).some((r) => /lists no recipes at all/.test(r)));
});

test("an exclusion with no reason reds — a dropped row that says nothing implies a green nobody measured", () => {
    const snap = goodSnap();
    snap.excluded = [{ id: SELF }];
    assert.ok(verifyShape(snap).some((r) => /carries no reason/.test(r)));
});

// ---------------------------------------------------------------- the record's verdict

test("`excluded` must be EXACTLY the self-exclusion — a red rail may not be relocated into it", () => {
    // The defect: requiring only that `SELF` be *present* let a failing rail be moved out of `recipes`
    // and into `excluded` with a principled-sounding reason. The record was green, the register printed
    // a smaller denominator, and the recipe's headline — *no record shows a rail at a non-zero exit* —
    // was satisfied by not recording it. A verdict laundered into the exclusion list reads as rigour.
    const laundered = goodSnap();
    laundered.recipes = [{ id: "docs", exit: 0 }];
    laundered.excluded = [
        { id: SELF, why: "a capture cannot be accurate about the record it is inside" },
        { id: "tests", why: "a reason that sounds entirely principled" },
    ];
    assert.deepEqual(verifyShape(laundered), [], "the laundered record is shape-valid — that is what made it dangerous");
    assert.ok(
        verifyRecord(laundered, { version: "0.1.3" }).some((r) => /the only admissible exclusion/.test(r)),
        "a second exclusion must red however plausible its reason",
    );

    const wrong = goodSnap();
    wrong.excluded = [{ id: "docs", why: "some other reason" }];
    assert.ok(verifyRecord(wrong, { version: "0.1.3" }).some((r) => /the only admissible exclusion/.test(r)));

    const none = goodSnap();
    none.excluded = [];
    assert.ok(verifyRecord(none, { version: "0.1.3" }).some((r) => /excludes nothing/.test(r)));
});

test("a record showing a red rail is refused — a release may not carry an eval result it did not pass", () => {
    const snap = goodSnap();
    snap.recipes = [
        { id: "docs", exit: 0 },
        { id: "tests", exit: 1 },
    ];
    assert.ok(verifyRecord(snap, { version: "0.1.3" }).some((r) => /`tests` at exit 1/.test(r)));
});

test("a record keyed to another release cannot answer for this one", () => {
    assert.ok(verifyRecord(goodSnap("0.1.4"), { version: "0.1.3" }).some((r) => /cannot answer for this one/.test(r)));
});

test("limitations are a FUNCTION of the capture, never a fixed paragraph", () => {
    // 6d round 2: a limitation asserted flat about a field the capture may or may not hold is a false
    // sentence waiting for its first counterexample.
    const clean = limitationsFor(goodSnap()).join("\n");
    assert.match(clean, /tree was clean at capture/);
    assert.doesNotMatch(clean, /NOT clean at capture/);

    const dirty = goodSnap();
    dirty.source.clean = false;
    assert.match(limitationsFor(dirty).join("\n"), /NOT clean at capture/);

    const none = goodSnap();
    none.abBaseline = null;
    assert.match(limitationsFor(none).join("\n"), /No A\/B baseline is committed/);
    assert.doesNotMatch(limitationsFor(none).join("\n"), /figures are NOT restated/);
});

test("every register says whose build it measures — it is read inside somebody else's node_modules", () => {
    // The record ships in the npm payload, so it is read where nothing around it says what it is about.
    // A table headed "N of M recipes this workspace yielded", sitting in a consumer's dependency tree,
    // invites exactly one wrong reading. The disclaimer travels with the document rather than living in
    // a README that does not ship beside it.
    for (const snap of [goodSnap(), { ...goodSnap(), abBaseline: null }]) {
        const doc = renderRegister(snap);
        assert.match(doc, /measures the Portulan repository's own build/);
        assert.match(doc, /never the workspace, project or package this release is installed into/);
    }
});

test("the register names the self-exclusion rather than dropping the row", () => {
    assert.match(renderRegister(goodSnap()), new RegExp(`\\\`${SELF}\\\` is excluded`));
});

test("the A/B baseline is cited by identity and its figures are never restated", () => {
    // Restating the cells would be a second carrier of a moving figure, which is the defect this whole
    // module is arranged against.
    const doc = renderRegister(goodSnap());
    assert.match(doc, /evals\/ab\/baseline\.md/);
    assert.match(doc, /Its figures are not repeated here/);
    assert.doesNotMatch(doc, /\b\d+\/20\b/, "no cell figure may appear in a release record");
});

// ---------------------------------------------------------------- `--verify`, end to end

test("a tree with no governed release yet is a stated state, not a green over a record set", () => {
    const root = fixtureRepo({ version: "0.1.2", released: ["0.1.2", "0.1.1", "0.1.0"] });
    const c = capture();
    assert.equal(run(["--verify", "--repo-root", root], c.io), 0);
    assert.match(c.out, /no release from `0\.1\.3` onward has been cut yet/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("a governed release with no record is a finding, naming the command that writes one", () => {
    const root = fixtureRepo();
    const c = capture();
    assert.equal(run(["--verify", "--repo-root", root], c.io), 1);
    assert.match(c.out, /there is no evals\/releases\/0\.1\.3\.json/);
    assert.match(c.out, /--capture/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("a governed release with a good record is green", () => {
    const root = fixtureRepo({ records: { "0.1.3": goodSnap() } });
    const c = capture();
    assert.equal(run(["--verify", "--repo-root", root], c.io), 0);
    assert.match(c.out, /1 governed release\(s\) — 0\.1\.3/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("a register edited away from its capture reds — the published document cannot drift from its data", () => {
    const root = fixtureRepo({ records: { "0.1.3": goodSnap() } });
    const reg = path.join(root, registerPath("0.1.3"));
    fs.writeFileSync(reg, `${fs.readFileSync(reg, "utf8")}\nAn edit nobody's capture says.\n`);
    const c = capture();
    assert.equal(run(["--verify", "--repo-root", root], c.io), 1);
    assert.match(c.out, /is not what evals\/releases\/0\.1\.3\.json renders/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("AN OLDER governed record stays under the rail after a newer release is cut", () => {
    // The design this replaced graded the newest record only, so `0.1.3`'s could be deleted in silence
    // the moment `0.1.4` was declared. This is the case that would have passed under it.
    const root = fixtureRepo({
        version: "0.1.4",
        released: ["0.1.4", "0.1.3", "0.1.2", "0.1.1", "0.1.0"],
        records: { "0.1.3": goodSnap("0.1.3"), "0.1.4": goodSnap("0.1.4") },
    });
    fs.rmSync(path.join(root, snapshotPath("0.1.3")));
    const c = capture();
    assert.equal(run(["--verify", "--repo-root", root], c.io), 1);
    assert.match(c.out, /`0\.1\.3` is a release from milestone 8 onward and there is no/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("the newest heading and package.json must agree — a cut moves them together", () => {
    const root = fixtureRepo({ version: "0.1.4", released: ["0.1.3", "0.1.2", "0.1.1", "0.1.0"] });
    const c = capture();
    assert.equal(run(["--verify", "--repo-root", root], c.io), 1);
    assert.match(c.out, /newest release heading is `0\.1\.3` where package\.json declares `0\.1\.4`/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("a record for a release that was never cut reds — it reads as evidence and is not", () => {
    const root = fixtureRepo({ version: "0.1.3", records: { "0.1.3": goodSnap(), "9.9.9": goodSnap("9.9.9") } });
    const c = capture();
    assert.equal(run(["--verify", "--repo-root", root], c.io), 1);
    assert.match(c.out, /records a release CHANGELOG\.md never cut/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("a record that is not valid JSON is could-not-run, never a finding about a release", () => {
    const root = fixtureRepo({ records: { "0.1.3": goodSnap() } });
    fs.writeFileSync(path.join(root, snapshotPath("0.1.3")), "{not json");
    const c = capture();
    assert.equal(run(["--verify", "--repo-root", root], c.io), 2);
    assert.match(c.err, /is not valid JSON/);
    fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- `--tagged`, the release act

test("--tagged refuses a tagged tree carrying no record for the version being published", () => {
    const root = fixtureRepo();
    const c = capture();
    assert.equal(run(["--tagged", "0.1.3", "--repo-root", root], c.io), 1);
    assert.match(c.out, /the tree tagged `0\.1\.3` carries no/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("--tagged passes a republish of a release that predates the clause", () => {
    // `publish-github-packages.yml` carries a manual dispatch for tags whose release predates the
    // workflow, so a v0.1.1 republish must not be asked for a record it never had. The checkout is OF
    // THE TAG, so its package.json declares 0.1.1 too.
    const root = fixtureRepo({ version: "0.1.1", released: ["0.1.1", "0.1.0"] });
    const c = capture();
    assert.equal(run(["--tagged", "v0.1.1", "--repo-root", root], c.io), 0);
    assert.match(c.out, /predates `0\.1\.3`/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("--tagged REFUSES a tag whose version the payload does not declare — its whole reason for existing", () => {
    // The hole this closes: the workflow used to read the version from `package.json` and pass THAT.
    // In the scenario all three carriers say this check exists for — a tag created from a tree whose
    // `## Unreleased` accumulator was never renamed — package.json still declares the previous version,
    // so the step asked about `0.1.2`, was told it predates the clause, and published. The check fired
    // in zero reachable variants of its motivating case. The tag is what names the release.
    const root = fixtureRepo({ version: "0.1.2", released: ["0.1.2", "0.1.1", "0.1.0"] });
    const c = capture();
    assert.equal(run(["--tagged", "v0.1.3", "--repo-root", root], c.io), 1);
    assert.match(c.out, /the tag names `0\.1\.3` while this tree's package\.json declares `0\.1\.2`/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("--tagged is green on a tagged tree that carries its own record", () => {
    const root = fixtureRepo({ records: { "0.1.3": goodSnap() } });
    const c = capture();
    assert.equal(run(["--tagged", "0.1.3", "--repo-root", root], c.io), 0);
    assert.match(c.out, /carries its own eval result/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("--tagged accepts the `v` prefix a tag actually carries, and refuses what it cannot order", () => {
    const root = fixtureRepo({ records: { "0.1.3": goodSnap() } });
    const ok = capture();
    assert.equal(run(["--tagged", "v0.1.3", "--repo-root", root], ok.io), 0, "`v0.1.3` is the tag's own spelling");
    const bad = capture();
    assert.equal(run(["--tagged", "0.1.3-rc.1", "--repo-root", root], bad.io), 2);
    fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- `--write`

test("--write re-renders a register from its committed capture", () => {
    const root = fixtureRepo({ records: { "0.1.3": goodSnap() } });
    const reg = path.join(root, registerPath("0.1.3"));
    fs.writeFileSync(reg, "drifted\n");
    const c = capture();
    assert.equal(run(["--write", "--repo-root", root], c.io), 0);
    assert.equal(fs.readFileSync(reg, "utf8"), renderRegister(goodSnap()));
    fs.rmSync(root, { recursive: true, force: true });
});

test("--write refuses a capture it could not read, rather than rendering from one", () => {
    // 6d round 3: `run()` rendered before it verified, so a malformed capture crashed in the renderer
    // and came back exit 2 about a capture the tool was looking straight at. The check runs first here.
    const root = fixtureRepo({ records: { "0.1.3": goodSnap() } });
    const broken = goodSnap();
    delete broken.source.clean;
    fs.writeFileSync(path.join(root, snapshotPath("0.1.3")), JSON.stringify(broken));
    const c = capture();
    assert.equal(run(["--write", "--repo-root", root], c.io), 2);
    assert.match(c.err, /refusing to render a register/);
    fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- the CLI's own edges

test("no mode, two modes, and an unknown argument are all could-not-run with the usage", () => {
    for (const argv of [[], ["--verify", "--capture"], ["--nope"]]) {
        const c = capture();
        assert.equal(run(argv, c.io), 2, `${JSON.stringify(argv)} must be could-not-run`);
        assert.match(c.err, /portulan-release-eval/);
    }
});

test("a record for a release the clause does NOT govern is refused, not ignored", () => {
    // The hole: `--capture` refuses to write one, so such a record can only have been written by hand —
    // and `--verify` graded only governed releases, so `0.1.2.json` full of garbage beside a register
    // reading "all 25 recipes green" was invisible. A version this rail declines to DEMAND a record for
    // is not a version it permits an unexamined record for.
    const root = fixtureRepo({ version: "0.1.3", records: { "0.1.3": goodSnap() } });
    fs.writeFileSync(path.join(root, snapshotPath("0.1.2")), '{"anything":"at all"}\n');
    fs.writeFileSync(path.join(root, registerPath("0.1.2")), "# Eval result — Portulan 0.1.2\n\nAll 25 recipes green.\n");
    const c = capture();
    assert.equal(run(["--verify", "--repo-root", root], c.io), 1);
    assert.match(c.out, /exists for a release that predates `0\.1\.3`/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("a REGISTER standing with no capture beside it is refused — it is the half a reader reads", () => {
    // The sweep enumerated `.json` only, so a fabricated `<version>.md` alone was invisible.
    const root = fixtureRepo({ version: "0.1.3" });
    fs.mkdirSync(path.join(root, RECORD_DIR), { recursive: true });
    fs.writeFileSync(path.join(root, registerPath("0.1.3")), "# Eval result — Portulan 0.1.3\n\nEverything was fine.\n");
    const c = capture();
    assert.equal(run(["--verify", "--repo-root", root], c.io), 1);
    assert.match(c.out, /there is no evals\/releases\/0\.1\.3\.json|stands with no capture beside it/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("`README.md` in the record directory is prose, not a record keyed to a version", () => {
    const root = fixtureRepo({ version: "0.1.3", records: { "0.1.3": goodSnap() } });
    fs.writeFileSync(path.join(root, RECORD_DIR, "README.md"), "# what this directory is\n");
    const c = capture();
    assert.equal(run(["--verify", "--repo-root", root], c.io), 0);
    fs.rmSync(root, { recursive: true, force: true });
});

test("--capture's governance refusal is reached BEFORE any git read", () => {
    // It sat after `sourceOf()`, which throws on a tree that is not a git repository — so the only case
    // guarding it passed on a `could not read HEAD` it had let through a loose alternation. The
    // assertion is exact now, and the fixture is deliberately still not a git repository: that is what
    // proves the ordering rather than assuming it.
    const root = fixtureRepo({ version: "0.1.2", released: ["0.1.2", "0.1.1", "0.1.0"] });
    const c = capture();
    assert.equal(run(["--capture", "--repo-root", root], c.io), 2);
    assert.match(c.err, /would manufacture history/);
    assert.doesNotMatch(c.err, /could not read HEAD/, "the git read must not have happened at all");
    fs.rmSync(root, { recursive: true, force: true });
});

test("abBaselineIdentity returns null where no baseline is committed, and never a fabricated one", () => {
    const root = fixtureRepo();
    assert.equal(abBaselineIdentity(root), null);
    fs.rmSync(root, { recursive: true, force: true });
});

test("abBaselineIdentity reads THIS repository's committed baseline and takes no figure from it", () => {
    // **A live read of the real tree, deliberately** — the fixtures above cannot show that this shape
    // matches the baseline actually committed here. `fileURLToPath`, never `new URL(...).pathname`:
    // this repository's own checkout sits under a path containing a space, so the raw pathname arrives
    // percent-encoded and every read off it fails. Measured — the first cut of this case did exactly
    // that, which is `#131`'s class (a path written against the author's layout) in its smallest form.
    const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const id = abBaselineIdentity(here);
    assert.ok(id !== null, "this repository has a committed A/B baseline");
    assert.equal(id.snapshot, "evals/ab/baseline.json");
    assert.equal(typeof id.commit, "string");
    assert.equal(typeof id.clean, "boolean");
    assert.ok(!("cells" in id) && !("k" in id), "a release record cites the baseline and never copies its figures");
});
