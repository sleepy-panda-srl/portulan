// The release-eval suite, on the record layer only: `--capture` spawns every other rail, the tests that run this suite included.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The tools read the host's installed-plugin record unasked, so the suite gets an empty host of its own.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import {
    FIRST_GOVERNED_VERSION,
    PINNED_FROM,
    RECORD_DIR,
    REPOSITORY,
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
import { packedPaths } from "./pack-identity.mjs";

// ---------------------------------------------------------------- fixtures

/** Every leaf of an object as a path, arrays included. */
function leafPaths(value, prefix = []) {
    if (value === null || typeof value !== "object") return [prefix];
    return Object.entries(value).flatMap(([k, v]) => leafPaths(v, [...prefix, k]));
}


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

/** A repository shaped like this one, and not a git repository: `--verify` reads no git. */
function fixtureRepo({ version = "0.1.3", released = ["0.1.3", "0.1.2", "0.1.1", "0.1.0"], records = {} } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-release-eval-"));
    fs.writeFileSync(path.join(root, "package.json"), `${JSON.stringify({ name: "x", version }, null, 4)}\n`);
    // Shaped like the real file: the cut re-seeds `## Unreleased` above the version it wrote.
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
    const none = goodSnap();
    none.abBaseline = null;
    assert.deepEqual(verifyShape(none), [], "shipping against no baseline is still a recorded state");

    // A SHA-1 repository names objects in 40 hex, a SHA-256 one in 64.
    for (const width of [40, 64]) {
        const snap = goodSnap();
        snap.source.commit = "a".repeat(width);
        assert.deepEqual(verifyShape(snap), [], `${width}-hex object names are real`);
    }
});

test("this repository's own committed A/B baseline satisfies the object-name check", () => {
    const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const id = abBaselineIdentity(here);
    const snap = { ...goodSnap(), abBaseline: id };
    assert.deepEqual(verifyShape(snap), [], "the committed baseline's own commit must pass");
});

test("a PRESENT-DEGENERATE value is refused — null and blank render as values, not as holes", () => {
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
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-release-eval-"));
    fs.writeFileSync(path.join(root, "package.json"), '{"version":"0.1.3"}\n');
    fs.writeFileSync(path.join(root, "CHANGELOG.md"), "# Changelog\n\n## Unreleased\n\n## 0.1.3-rc.1 — 2026-09-02\n\n## 0.1.3 — 2026-09-01\n");
    assert.throws(() => changelogVersions(root), /which is not `## X\.Y\.Z`/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("no field the renderer reads has a FALLBACK — a placeholder reads like a measurement", () => {
    const snap = goodSnap();
    delete snap.abBaseline.captured;
    assert.ok(renderRegister(snap).includes("undefined"), "absence must render as a hole, never as a placeholder");
    const doc = renderRegister(goodSnap());
    for (const placeholder of ["<undated>", "<uncommitted>", "<commit>", "<agent>"]) {
        assert.ok(!doc.includes(placeholder), `a valid capture must not render \`${placeholder}\``);
    }
});

test("the host's conditions must be strings — found by sweeping the class, not the site", () => {
    for (const k of ["node", "platform"]) {
        for (const value of [22, true, null, undefined]) {
            const snap = goodSnap();
            snap.host[k] = value;
            assert.ok(verifyShape(snap).length > 0, `\`host.${k} = ${JSON.stringify(value) ?? "undefined"}\` must red`);
        }
    }
});

test("a padded date is refused — a check that normalises its input checks something else", () => {
    for (const bad of ["2026-09-01 ", " 2026-09-01", "\t2026-09-01"]) {
        const snap = goodSnap();
        snap.captured = bad;
        assert.ok(verifyShape(snap).some((r) => /is not a `YYYY-MM-DD` date/.test(r)), `${JSON.stringify(bad)} must red`);
    }
    const ok = goodSnap();
    assert.deepEqual(verifyShape(ok), [], "an exact date still passes");
});

test("`abBaseline.clean: null` is refused — the third state rendered as the false arm", () => {
    const snap = goodSnap();
    snap.abBaseline.clean = null;
    assert.ok(verifyShape(snap).some((r) => /`abBaseline.clean` is not a boolean/.test(r)));
});

test("a missing BOOLEAN is caught explicitly, because it renders as a branch and invents a claim", () => {
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
    const doc = renderRegister(goodSnap());
    assert.match(doc, /evals\/ab\/baseline\.md/);
    assert.match(doc, /Its figures are not repeated here/);
    assert.doesNotMatch(doc, /\b\d+\/20\b/, "no cell figure may appear in a release record");
});

test("from `PINNED_FROM` a register links nothing its package does not carry (#420)", () => {
    const doc = renderRegister(goodSnap(PINNED_FROM));
    const packed = new Set(packedPaths(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")));
    const hrefs = [...doc.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
    assert.ok(hrefs.length >= 4, `the sweep must reach every link the register renders (${hrefs.length})`);
    for (const href of hrefs) {
        if (/^[a-z]+:/.test(href)) {
            assert.ok(href.startsWith(`${REPOSITORY}/blob/v${PINNED_FROM}/`), `${href} is not pinned to the release's tag`);
            continue;
        }
        // The capture ships beside its register, and `--verify` holds the pair together.
        if (href === path.basename(snapshotPath(PINNED_FROM))) continue;
        const target = path.posix.join(RECORD_DIR, href);
        assert.ok(packed.has(target), `${href} resolves to ${target}, which the package does not carry`);
    }
});

test("a register before `PINNED_FROM` keeps the relative citation npm froze into its tarball", () => {
    const doc = renderRegister(goodSnap("0.1.3"));
    assert.match(doc, /\]\(\.\.\/\.\.\/evals\/ab\/baseline\.md\)/);
    assert.ok(!doc.includes(REPOSITORY));
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
    // `publish-github-packages.yml` checks out the tag, so a republish's package.json declares that version.
    const root = fixtureRepo({ version: "0.1.1", released: ["0.1.1", "0.1.0"] });
    const c = capture();
    assert.equal(run(["--tagged", "v0.1.1", "--repo-root", root], c.io), 0);
    assert.match(c.out, /predates `0\.1\.3`/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("--tagged REFUSES a tag whose version the payload does not declare — its whole reason for existing", () => {
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

test("an argument that reaches a path is validated before it gets there", () => {
    const root = fixtureRepo({ version: "0.1.3", records: { "0.1.3": goodSnap() } });
    const outside = path.join(root, "pwned.md");
    fs.writeFileSync(outside, "ORIGINAL\n");

    for (const bad of ["../../pwned", "0.1.3/../../x", "../../../etc/passwd", "..", "0.1.3/x"]) {
        const c = capture();
        assert.equal(run(["--write", "--version", bad, "--repo-root", root], c.io), 2, `--version ${JSON.stringify(bad)} must refuse`);
    }
    assert.equal(fs.readFileSync(outside, "utf8"), "ORIGINAL\n", "nothing outside the record directory may be written");

    for (const bad of ["../../x", "v../../x", "0.1.3/../x"]) {
        const c = capture();
        assert.equal(run(["--tagged", bad, "--repo-root", root], c.io), 2, `--tagged ${JSON.stringify(bad)} must refuse`);
    }
    const ok = capture();
    assert.equal(run(["--write", "--version", "0.1.3", "--repo-root", root], ok.io), 0);
    fs.rmSync(root, { recursive: true, force: true });
});

test("`--tagged` and `--version` cannot collide — one slot was carrying two meanings", () => {
    const root = fixtureRepo({ version: "0.1.2", released: ["0.1.2", "0.1.1", "0.1.0"] });

    const plain = capture();
    assert.equal(run(["--tagged", "v0.1.3", "--repo-root", root], plain.io), 1, "the mismatch is a finding");

    for (const argv of [
        ["--tagged", "v0.1.3", "--version", "0.1.2", "--repo-root", root],
        ["--version", "0.1.2", "--tagged", "v0.1.3", "--repo-root", root],
    ]) {
        const c = capture();
        assert.equal(run(argv, c.io), 2, `${JSON.stringify(argv.slice(0, 4))} must refuse, in either order`);
        assert.match(c.err, /means nothing in any other mode/);
    }

    const w = fixtureRepo({ version: "0.1.3", records: { "0.1.3": goodSnap() } });
    const ok = capture();
    assert.equal(run(["--write", "--version", "0.1.3", "--repo-root", w], ok.io), 0);
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(w, { recursive: true, force: true });
});

test("no mode, two modes, and an unknown argument are all could-not-run with the usage", () => {
    for (const argv of [[], ["--verify", "--capture"], ["--nope"]]) {
        const c = capture();
        assert.equal(run(argv, c.io), 2, `${JSON.stringify(argv)} must be could-not-run`);
        assert.match(c.err, /portulan-release-eval/);
    }
});

test("a record for a release the clause does NOT govern is refused, not ignored", () => {
    const root = fixtureRepo({ version: "0.1.3", records: { "0.1.3": goodSnap() } });
    fs.writeFileSync(path.join(root, snapshotPath("0.1.2")), '{"anything":"at all"}\n');
    fs.writeFileSync(path.join(root, registerPath("0.1.2")), "# Eval result — Portulan 0.1.2\n\nAll 25 recipes green.\n");
    const c = capture();
    assert.equal(run(["--verify", "--repo-root", root], c.io), 1);
    assert.match(c.out, /exists for a release that predates `0\.1\.3`/);
    fs.rmSync(root, { recursive: true, force: true });
});

test("a REGISTER standing with no capture beside it is refused — it is the half a reader reads", () => {
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
    // Not a git repository on purpose: a git read ahead of the refusal would fail with `could not read HEAD`.
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
    // `fileURLToPath`, not `new URL(...).pathname`, which leaves a space in the checkout path percent-encoded.
    const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const id = abBaselineIdentity(here);
    assert.ok(id !== null, "this repository has a committed A/B baseline");
    assert.equal(id.snapshot, "evals/ab/baseline.json");
    assert.equal(typeof id.commit, "string");
    assert.equal(typeof id.clean, "boolean");
    assert.ok(!("cells" in id) && !("k" in id), "a release record cites the baseline and never copies its figures");
});
