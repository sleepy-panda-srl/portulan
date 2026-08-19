// The rail's suite. Every contracted state is exercised POSITIVELY — green, drift, a carrier
// reworded away, and could-not-run — because a failure path nobody has run is one nobody has seen
// work. Two cases exist only because this repository's own corpus refutes the naive design:
// the record layer must be IGNORED, and a `g` regex must not carry lastIndex between files.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inspect, claimsIn, isRecord, MUST_CARRY, CouldNotRun } from "./version-carriers.mjs";

function fixture(files, version = "1.2.3") {
    const root = mkdtempSync(join(tmpdir(), "portulan-vc-"));
    execFileSync("git", ["-C", root, "init", "-q"]);
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", version }, null, 2));
    for (const [rel, body] of Object.entries(files)) {
        mkdirSync(dirname(join(root, rel)), { recursive: true });
        writeFileSync(join(root, rel), body);
    }
    execFileSync("git", ["-C", root, "add", "-A"]);
    return root;
}
const carriers = (v) => ({
    "README.md": `**Current release: \`${v}\`**\n`,
    "SECURITY.md": `| \`${v}\` | Yes — the current release |\n`,
    ".portulan/products/portulan/product.md": `The newest release entry is \`${v}\`.\n`,
});

test("green when every carrier agrees with package.json", () => {
    const root = fixture(carriers("1.2.3"));
    try {
        const r = inspect(root);
        assert.deepEqual(r.findings, []);
        assert.equal(r.claimCount, 3, "all three spellings must be recognised, not just the first");
    } finally { rmSync(root, { recursive: true, force: true }); }
});

test("drift in ANY carrier is a finding that names the file, the line and both versions", () => {
    for (const bad of Object.keys(carriers("x"))) {
        const files = carriers("1.2.3");
        files[bad] = files[bad].replace("1.2.3", "9.9.9");
        const root = fixture(files);
        try {
            const r = inspect(root);
            assert.equal(r.findings.length, 1, `${bad} drift must be caught`);
            assert.match(r.findings[0], /9\.9\.9/);
            assert.match(r.findings[0], /1\.2\.3/);
            assert.ok(r.findings[0].startsWith(bad + ":"), `finding must name ${bad} and a line`);
        } finally { rmSync(root, { recursive: true, force: true }); }
    }
});

test("a carrier reworded away is a finding — the rail may not shrink silently", () => {
    const files = carriers("1.2.3");
    files["SECURITY.md"] = "| `1.2.3` | supported |\n";
    const root = fixture(files);
    try {
        const r = inspect(root);
        assert.equal(r.findings.length, 1);
        assert.match(r.findings[0], /SECURITY\.md carries no current-version claim/);
    } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the RECORD LAYER is ignored, because it quotes retired versions on purpose", () => {
    const files = carriers("1.2.3");
    // Every one of these is a real shape from this repository: the account of a fixed defect.
    files["CHANGELOG.md"] = 'It said *"The newest release entry is `0.2.0`"* and was retired.\n';
    files[".portulan/handoffs/2026-01-01-x.md"] = "**Current release: `0.0.1`**\n";
    files["docs/plan.md"] = "the newest release entry is `0.0.2` was the defect\n";
    const root = fixture(files);
    try {
        assert.deepEqual(inspect(root).findings, [], "quoting a retired version in the record is not drift");
    } finally { rmSync(root, { recursive: true, force: true }); }
    assert.ok(isRecord("CHANGELOG.md") && isRecord(".portulan/handoffs/a.md") && isRecord("docs/plan.md"));
    assert.ok(!isRecord("README.md"), "live prose must NOT be treated as record");
});

test("a `g` pattern does not carry lastIndex between files", () => {
    // Two claims of the same spelling must both be found. A shared `g` regex finds the first, then
    // resumes past it in the next file and reports a clean scan over a drifted one.
    const two = "**Current release: `1.2.3`**\n\n**Current release: `1.2.3`**\n";
    assert.equal(claimsIn(two).length, 2);
});

test("could-not-run is exit 2's cause, never a finding about the prose", () => {
    const root = mkdtempSync(join(tmpdir(), "portulan-vc-"));
    try {
        execFileSync("git", ["-C", root, "init", "-q"]);
        writeFileSync(join(root, "README.md"), "x\n");
        execFileSync("git", ["-C", root, "add", "-A"]);
        assert.throws(() => inspect(root), CouldNotRun, "absent package.json must refuse, not report drift");
        writeFileSync(join(root, "package.json"), "{not json");
        assert.throws(() => inspect(root), CouldNotRun);
        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x" }));
        assert.throws(() => inspect(root), CouldNotRun, "a missing version key must refuse");
    } finally { rmSync(root, { recursive: true, force: true }); }
});

test("MUST_CARRY names the three files the defect actually occurred in", () => {
    assert.deepEqual([...MUST_CARRY].sort(), [".portulan/products/portulan/product.md", "README.md", "SECURITY.md"].sort());
});

// ---------------------------------------------------------------------------------------------
// The CLI itself, run as a SUBPROCESS. Every case above imports the module, so none of them touches
// the entry guard, `main()`'s exit mapping, or the wrapper — and that is precisely the hole the
// first cut shipped through: its guard compared `import.meta.url` to `file://${argv[1]}`, which
// percent-encodes nothing, so on a path containing a SPACE the tool exited 0 having run nothing.
// The recipe printed no line and the author read the 0 as green.
//
// So these assert on OUTPUT, not only on the exit code: rc=0-with-silence is the failure shape, and
// a test that checks rc alone passes against a tool that never started.

// `fileURLToPath(new URL(...))`, which three other suites here already use.
// `import.meta.dirname` is Node 20.11+, while `package.json` declares `engines.node >=20` — so on a
// 20.0–20.10 runner the first cut would have failed to resolve the CLI at all.
const CLI = fileURLToPath(new URL("./version-carriers.mjs", import.meta.url));

function runCli(cwd) {
    const r = spawnSync(process.execPath, [CLI, "."], { cwd, encoding: "utf8" });
    return { rc: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
}

/**
 * A fixture whose absolute path contains a SPACE, which is the only property under test here.
 *
 * The first cut of this helper hardcoded the maintainer's own working-copy directory name. It named
 * nothing client-side and leaked nothing, but it put a detail of one machine's layout into a public
 * repository for no reason — the test needs *a* spaced path, not *his*. It also tripped the seam
 * scan on a word-collision with a real client term, which is a false positive that costs a live
 * re-measurement every time it fires.
 */
function spacedFixture(files, version = "1.2.3") {
    const base = mkdtempSync(join(tmpdir(), "portulan-vc-"));
    const root = join(base, "a spaced directory");
    mkdirSync(root, { recursive: true });
    execFileSync("git", ["-C", root, "init", "-q"]);
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", version }, null, 2));
    for (const [rel, body] of Object.entries(files)) {
        mkdirSync(dirname(join(root, rel)), { recursive: true });
        writeFileSync(join(root, rel), body);
    }
    execFileSync("git", ["-C", root, "add", "-A"]);
    return { base, root };
}

test("the CLI RUNS from a path containing a space, and says so", () => {
    const { base, root } = spacedFixture(carriers("1.2.3"));
    try {
        const { rc, out } = runCli(root);
        assert.equal(rc, 0);
        assert.match(out, /^ok\s+version-carriers/m,
            "exit 0 with no output is the tool never starting — the defect this case exists for");
    } finally { rmSync(base, { recursive: true, force: true }); }
});

test("the CLI exits 1 and names the drift, from a spaced path", () => {
    const files = carriers("1.2.3");
    files["README.md"] = "**Current release: `9.9.9`**\n";
    const { base, root } = spacedFixture(files);
    try {
        const { rc, out, err } = runCli(root);
        assert.equal(rc, 1);
        assert.match(err, /README\.md:1 states the current version as `9\.9\.9`/);
        assert.equal(out, "", "a finding must not also print the green line");
    } finally { rmSync(base, { recursive: true, force: true }); }
});

test("the CLI exits 2 on could-not-run, from a spaced path", () => {
    const { base, root } = spacedFixture(carriers("1.2.3"));
    try {
        rmSync(join(root, "package.json"));
        const { rc, out, err } = runCli(root);
        assert.equal(rc, 2, "a precondition failure is could-not-run, never a finding");
        assert.match(err, /could not run/);
        assert.equal(out, "");
    } finally { rmSync(base, { recursive: true, force: true }); }
});

test("the CLI reads the INDEX, so a staged drift with a clean worktree is still caught", () => {
    const { base, root } = spacedFixture(carriers("1.2.3"));
    try {
        writeFileSync(join(root, "README.md"), "**Current release: `8.8.8`**\n");
        execFileSync("git", ["-C", root, "add", "README.md"]);          // drift staged
        writeFileSync(join(root, "README.md"), "**Current release: `1.2.3`**\n"); // worktree reverted
        const { rc, err } = runCli(root);
        assert.equal(rc, 1, "reading the worktree here would report green over a commit that ships drift");
        assert.match(err, /8\.8\.8/);
    } finally { rmSync(base, { recursive: true, force: true }); }
});

test("a tracked path whose blob cannot be read is could-not-run, NOT a silent skip", () => {
    // The first cut `continue`d here, so a file `git ls-files` had just named could go unexamined
    // while the rail reported green — a check that did not look, reporting as though it had. That is
    // the defect class this whole rail exists for, and it was inside the rail.
    //
    // A gitlink entry reproduces it honestly: `ls-files` lists the path, and `git show :<path>`
    // cannot resolve it to a blob because the index holds a commit object.
    const { base, root } = spacedFixture(carriers("1.2.3"));
    try {
        execFileSync("git", ["-C", root, "update-index", "--add", "--cacheinfo",
            `160000,${"0".repeat(39)}1,vendored.md`]);
        assert.throws(() => inspect(root), CouldNotRun,
            "an unreadable tracked path must refuse, never be skipped past into a green");
        const { rc, out } = runCli(root);
        assert.equal(rc, 2, "and the CLI must map that refusal to 2, never 0 or 1");
        assert.equal(out, "", "no green line may be printed over a scan that could not complete");
    } finally { rmSync(base, { recursive: true, force: true }); }
});
