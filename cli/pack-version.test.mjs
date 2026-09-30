// The pack-version rail, driven on REAL git repositories rather than an injected history.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { run, judge, sameValue, packManifests, mergeBase, insideRepo, CannotRun } from "./pack-version.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(HERE, "pack-version.mjs");

// One exit handler for every scratch directory: one each would pass node's default listener limit and warn.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-packver-"));
    SCRATCH.push(dir);
    return dir;
}

const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function manifest({ version = "0.1.0", reason = "because the pack says so", extra = {} } = {}) {
    return {
        portulan: { pack: "1.0", ...(version === null ? {} : { version }) },
        name: "contributor",
        category: "tools",
        contributes: { gates: [{ id: "a-gate", tier: "gated", action: { shell: "curl" }, reason }], ...extra },
    };
}

function writePack(root, m) {
    const dir = path.join(root, "packs", "tools", "contributor");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "pack.json"), `${JSON.stringify(m, null, 2)}\n`);
}

/** A repository with `main` holding one pack and `feature` checked out, with nothing committed on it yet. */
function repo(initial = manifest()) {
    const root = scratch();
    git(root, "init", "-q", "-b", "main");
    git(root, "config", "user.email", "t@example.com");
    git(root, "config", "user.name", "t");
    fs.writeFileSync(path.join(root, "other.txt"), "x\n");
    writePack(root, initial);
    git(root, "add", "-A");
    git(root, "commit", "-qm", "base");
    git(root, "checkout", "-qb", "feature");
    return root;
}

function commit(root, message) {
    git(root, "add", "-A");
    git(root, "commit", "-qm", message);
}

function check(root, argv = []) {
    let out = "";
    let err = "";
    const code = run([...argv, root], {
        stdout: { write: (s) => (out += s) },
        stderr: { write: (s) => (err += s) },
        cwd: root,
    });
    return { code, out, err };
}

// ===========================================================================================
// 1. The ruling
// ===========================================================================================

describe("a change to `contributes` must move `portulan.version`", () => {
    test("changed and moved is GREEN", () => {
        const root = repo();
        writePack(root, manifest({ version: "0.1.1", reason: "a different sentence" }));
        commit(root, "change a gate and bump");
        const { code, out } = check(root, ["--base", "main"]);
        assert.equal(code, 0);
        assert.match(out, /ok {2,}packs\/tools\/contributor\/pack\.json/);
        assert.match(out, /0\.1\.0.*→.*0\.1\.1/);
    });

    test("changed and NOT moved is RED, at exit 1", () => {
        const root = repo();
        writePack(root, manifest({ version: "0.1.0", reason: "a different sentence" }));
        commit(root, "change a gate, forget the bump");
        const { code, err } = check(root, ["--base", "main"]);
        assert.equal(code, 1);
        assert.match(err, /RED {2}packs\/tools\/contributor\/pack\.json/);
        assert.match(err, /stayed at `0\.1\.0`/);
    });

    test("**a PROSE-ONLY edit to a `reason` counts** — the judgement the ruling had to make", () => {
        const root = repo();
        writePack(root, manifest({ version: "0.1.0", reason: "the very same gate, explained differently" }));
        commit(root, "reword a reason and nothing else");
        const { code, err } = check(root, ["--base", "main"]);
        assert.equal(code, 1);
        assert.match(err, /prose-only edit to a fragment's `reason` counts/);
    });

    test("`contributes` untouched is GREEN however much else changed", () => {
        const root = repo();
        fs.writeFileSync(path.join(root, "other.txt"), "y\n");
        const m = manifest();
        m.summary = "a new summary, outside `contributes`";
        writePack(root, m);
        commit(root, "change everything except contributes");
        const { code, out } = check(root, ["--base", "main"]);
        assert.equal(code, 0);
        assert.match(out, /unchanged {2,}packs\/tools\/contributor/);
    });

    test("REFORMATTING is not a change — the manifests are compared as values, not as bytes", () => {
        const root = repo();
        const m = manifest();
        const reordered = { contributes: m.contributes, category: m.category, name: m.name, portulan: m.portulan };
        fs.writeFileSync(
            path.join(root, "packs", "tools", "contributor", "pack.json"),
            `${JSON.stringify(reordered, null, 4)}\n`,
        );
        commit(root, "reindent and reorder keys");
        assert.notEqual(
            fs.readFileSync(path.join(root, "packs", "tools", "contributor", "pack.json"), "utf8"),
            `${JSON.stringify(m, null, 2)}\n`,
            "the fixture must actually differ in bytes, or this test proves nothing",
        );
        assert.equal(check(root, ["--base", "main"]).code, 0);
    });
});

// ===========================================================================================
// 2. THREE-DOT — the property that cannot be seen without two real branches
// ===========================================================================================

test("the comparison is THREE-DOT: work that landed on the base is not attributed to this branch", () => {
    // Main bumps the pack after the fork; under two-dot, this branch would appear to revert that bump.
    const root = repo();
    fs.writeFileSync(path.join(root, "other.txt"), "feature touched only this\n");
    commit(root, "feature: unrelated change");

    git(root, "checkout", "-q", "main");
    writePack(root, manifest({ version: "0.2.0", reason: "main moved on independently" }));
    commit(root, "main: change a gate and bump it");
    git(root, "checkout", "-q", "feature");

    // Prove the two forms really do disagree on this fixture, so the assertion below is not vacuous.
    const three = git(root, "diff", "--name-only", "main...feature").trim().split("\n").filter(Boolean);
    const two = git(root, "diff", "--name-only", "main..feature").trim().split("\n").filter(Boolean);
    assert.deepEqual(three, ["other.txt"]);
    assert.ok(two.includes("packs/tools/contributor/pack.json"), "two-dot must drag main's pack change in, or the fixture is wrong");

    const { code, out } = check(root, ["--base", "main"]);
    assert.equal(code, 0, "three-dot must not attribute main's own commit to this branch");
    assert.match(out, /unchanged {2,}packs\/tools\/contributor/);
});

test("content is read at the MERGE-BASE, not at the base ref's tip — the false-green the enumeration hides", () => {
    // Main bumps the same pack after the fork, so a read at its tip would credit this branch with that bump.
    const root = repo();
    writePack(root, manifest({ version: "0.1.0", reason: "the branch changes a gate and does NOT bump" }));
    commit(root, "feature: change contributes, no bump");

    git(root, "checkout", "-q", "main");
    writePack(root, manifest({ version: "0.9.9", reason: "main moved on and bumped" }));
    commit(root, "main: unrelated bump after the fork");
    git(root, "checkout", "-q", "feature");

    const { code, err } = check(root, ["--base", "main"]);
    assert.equal(code, 1, "reading main's tip instead of the merge-base would false-green this");
    assert.match(err, /stayed at `0\.1\.0`/);
});

test("BASE == HEAD is GREEN — every push to main runs this recipe", () => {
    const root = repo();
    git(root, "checkout", "-q", "main");
    const { code, out } = check(root, ["--base", "main"]);
    assert.equal(code, 0);
    assert.match(out, /0 pack\(s\) changed/);
});

// ===========================================================================================
// 3. The edges
// ===========================================================================================

describe("the edges", () => {
    test("a pack with NO version that changes `contributes` is RED, and says to declare one", () => {
        const root = repo(manifest({ version: null }));
        writePack(root, manifest({ version: null, reason: "changed, still unversioned" }));
        commit(root, "change contributes on an unversioned pack");
        const { code, err } = check(root, ["--base", "main"]);
        assert.equal(code, 1);
        assert.match(err, /declares no `portulan\.version` to move/);
        assert.match(err, /declare one/);
    });

    test("an ADDED pack is GREEN — it has no prior state to bump from", () => {
        // The schema makes `version` optional, so a pack can arrive unversioned and trip this only once it changes.
        const root = repo();
        const dir = path.join(root, "packs", "rituals", "fresh");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "pack.json"),
            `${JSON.stringify({ portulan: { pack: "1.0" }, name: "fresh", category: "rituals", contributes: { skills: ["s/"] } }, null, 2)}\n`,
        );
        commit(root, "add a pack with no version at all");
        const { code, out } = check(root, ["--base", "main"]);
        assert.equal(code, 0);
        assert.match(out, /added {2,}packs\/rituals\/fresh/);
    });

    test("a DELETED pack is GREEN, and is EXAMINED rather than invisible", () => {
        const root = repo();
        fs.rmSync(path.join(root, "packs", "tools", "contributor"), { recursive: true, force: true });
        commit(root, "remove the pack");
        const { code, out } = check(root, ["--base", "main"]);
        assert.equal(code, 0);
        assert.match(out, /deleted {2,}packs\/tools\/contributor/);
    });

    test("a version DELETED at head, with `contributes` changed, is the same red from the head side", () => {
        const root = repo();
        writePack(root, manifest({ version: null, reason: "changed, and the version was removed" }));
        commit(root, "drop the version while changing contributes");
        const { code, err } = check(root, ["--base", "main"]);
        assert.equal(code, 1);
        assert.match(err, /declares no `portulan\.version` to move/);
    });

    test("absent → present COUNTS as moved, or a red for having no version could never be discharged", () => {
        const root = repo(manifest({ version: null }));
        writePack(root, manifest({ version: "0.0.1", reason: "changed, and a version was declared" }));
        commit(root, "declare a version while changing contributes");
        assert.equal(check(root, ["--base", "main"]).code, 0);
    });

    test("an UNREADABLE packs directory is could-not-run, never an empty-set green", () => {
        const root = repo();
        const packs = path.join(root, "packs");
        fs.chmodSync(packs, 0o000);
        try {
            const { code, err } = check(root, ["--base", "main"]);
            // Root ignores mode bits, so this case cannot be forced when the suite runs as root.
            if (code === 0) {
                assert.ok(process.getuid?.() === 0, "a non-root run must not report green on an unreadable packs/");
                return;
            }
            assert.equal(code, 2);
            assert.match(err, /Refusing to report an empty set of packs/);
        } finally {
            fs.chmodSync(packs, 0o755);
        }
    });

    test("an UNREADABLE manifest is could-not-run, NEVER reported as deleted", () => {
        // No commit: the checker reads the working tree, and a chmod 000 leaves git nothing to commit.
        const root = repo();
        const file = path.join(root, "packs", "tools", "contributor", "pack.json");
        fs.chmodSync(file, 0o000);
        try {
            const { code, err, out } = check(root, ["--base", "main"]);
            if (code === 0) {
                assert.ok(process.getuid?.() === 0, "a non-root run must not report an unreadable manifest as anything but 2");
                return;
            }
            assert.equal(code, 2);
            assert.match(err, /not a removal/);
            assert.doesNotMatch(out, /deleted/);
        } finally {
            fs.chmodSync(file, 0o644);
        }
    });

    test("a DANGLING SYMLINK is could-not-run, not a deletion — the third site of one class", () => {
        // `readFileSync` throws ENOENT on a dangling link as on a missing file; only `lstat` tells them apart.
        const root = repo();
        const file = path.join(root, "packs", "tools", "contributor", "pack.json");
        fs.rmSync(file);
        fs.symlinkSync(path.join(root, "no-such-target"), file);
        assert.ok(fs.lstatSync(file).isSymbolicLink(), "the fixture must actually be a dangling link");
        assert.throws(() => fs.readFileSync(file, "utf8"), { code: "ENOENT" }, "and readFileSync must give ENOENT, or this proves nothing");

        const { code, err, out } = check(root, ["--base", "main"]);
        assert.equal(code, 2);
        assert.match(err, /not a removal/);
        assert.doesNotMatch(out, /deleted/);
    });

    test("a NEW pack whose manifest is a dangling link is SEEN and refused, not silently skipped", () => {
        const root = repo();
        const dir = path.join(root, "packs", "rituals", "fresh");
        fs.mkdirSync(dir, { recursive: true });
        fs.symlinkSync(path.join(root, "no-such-target"), path.join(dir, "pack.json"));
        const { code, err } = check(root, ["--base", "main"]);
        assert.equal(code, 2, "a manifest that is there but unreadable must refuse, even for a new pack");
        assert.match(err, /not a removal/);
    });

    test("a manifest unparseable AT THE BASE is could-not-run too, not only at head", () => {
        const root = scratch();
        git(root, "init", "-q", "-b", "main");
        git(root, "config", "user.email", "t@example.com");
        git(root, "config", "user.name", "t");
        const dir = path.join(root, "packs", "tools", "contributor");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "pack.json"), "{ not json at the base\n");
        git(root, "add", "-A");
        git(root, "commit", "-qm", "base with a broken manifest");
        git(root, "checkout", "-qb", "feature");
        writePack(root, manifest());
        commit(root, "repair it on the branch");
        const { code, err } = check(root, ["--base", "main"]);
        assert.equal(code, 2);
        assert.match(err, /is not valid JSON/);
    });

    test("a CRASH in the checker is could-not-run (2), never a RED verdict", () => {
        const root = repo();
        let err = "";
        const code = run(["--base", "main", root], {
            stdout: {
                write() {
                    throw new TypeError("a defect in the checker, not in the work");
                },
            },
            stderr: { write: (s) => (err += s) },
            cwd: root,
        });
        assert.equal(code, 2);
        assert.match(err, /CRASHED/);
        assert.match(err, /not a finding about the work/);
        assert.match(err, /TypeError/, "the stack stays loud — a crash must not be swallowed");
    });

    test("a manifest that will not parse is COULD-NOT-RUN (2), never a red verdict", () => {
        const root = repo();
        fs.writeFileSync(path.join(root, "packs", "tools", "contributor", "pack.json"), "{ not json\n");
        commit(root, "break the manifest");
        const { code, err } = check(root, ["--base", "main"]);
        assert.equal(code, 2);
        assert.match(err, /not valid JSON/);
    });
});

// ===========================================================================================
// 4. Preconditions — and the instrument is guarded before it is trusted
// ===========================================================================================

describe("it refuses rather than guessing", () => {
    for (const [label, cloneArgs, expected] of [
        ["single-branch (the common CI shape) — the ref is never fetched", ["--depth", "1"], /could not resolve base ref/],
        ["--no-single-branch — the ref resolves, its history does not", ["--depth", "1", "--no-single-branch"], /no merge-base/],
    ]) {
        test(`a SHALLOW clone exits 2 and names \`fetch-depth: 0\`: ${label}`, () => {
            const origin = repo();
            writePack(origin, manifest({ version: "0.1.0", reason: "a change with no bump" }));
            commit(origin, "a red-worthy change");
            git(origin, "checkout", "-q", "main");

            const shallow = scratch();
            execFileSync("git", ["clone", "-q", "--branch", "feature", ...cloneArgs, `file://${origin}`, shallow], {
                stdio: ["ignore", "pipe", "pipe"],
            });
            const { code, err } = check(shallow, ["--base", "origin/main"]);
            assert.equal(code, 2, "a shallow clone must be could-not-run, never a verdict");
            assert.match(err, expected);
            assert.match(err, /SHALLOW/);
            assert.match(err, /fetch-depth: 0/);
        });
    }

    test("...and the same repository at FULL depth reaches the red — so the 2 above is the depth, not the fixture", () => {
        const origin = repo();
        writePack(origin, manifest({ version: "0.1.0", reason: "a change with no bump" }));
        commit(origin, "a red-worthy change");
        git(origin, "checkout", "-q", "main");

        const full = scratch();
        execFileSync("git", ["clone", "-q", "--branch", "feature", `file://${origin}`, full], { stdio: ["ignore", "pipe", "pipe"] });
        const { code, err } = check(full, ["--base", "origin/main"]);
        assert.equal(code, 1, "at full depth the same change must red");
        assert.match(err, /stayed at `0\.1\.0`/);
    });

    test("an unknown base ref exits 2, and the two refusals stay distinguishable", () => {
        const root = repo();
        const { code, err } = check(root, ["--base", "no-such-ref"]);
        assert.equal(code, 2);
        assert.match(err, /could not resolve base ref/);
        // Both refusals mention shallow clones, so the clause, not the word, tells them apart.
        assert.doesNotMatch(err, /no merge-base/);
    });

    test("a NAMED packs directory that exists nowhere is a refusal; the DEFAULT one being absent is an answer", () => {
        const root = repo();
        assert.equal(check(root, ["--base", "main", "--packs", "paks"]).code, 2);
        assert.match(check(root, ["--base", "main", "--packs", "paks"]).err, /exists neither in the working tree nor at the merge-base/);
        assert.equal(check(root, ["--base", "main", "--packs", "packs"]).code, 0);

        const bare = scratch();
        git(bare, "init", "-q", "-b", "main");
        git(bare, "config", "user.email", "t@example.com");
        git(bare, "config", "user.name", "t");
        fs.writeFileSync(path.join(bare, "readme.md"), "no packs here\n");
        git(bare, "add", "-A");
        git(bare, "commit", "-qm", "a workspace that composes nothing");
        const { code, out } = check(bare, ["--base", "main"]);
        assert.equal(code, 0);
        assert.match(out, /nothing to check/);
    });

    test("a refusal carries GIT's own words, not only this file's guess at the cause", () => {
        const { code, err } = check(repo(), ["--base", "no-such-ref"]);
        assert.equal(code, 2);
        assert.match(err, /fetch-depth: 0/, "the guidance survives");
        assert.match(err, /git said:/, "and so does the cause");
        assert.match(err, /Needed a single revision/, "which is git's text, not ours");
    });

    test("a directory that is not a git repository exits 2", () => {
        const { code, err } = check(scratch(), ["--base", "main"]);
        assert.equal(code, 2);
        assert.match(err, /git could not find a git repository/);
    });

    test("an option-shaped base ref is refused as a REF, never obeyed as a flag", () => {
        const root = repo();
        for (const hostile of ["--is-ancestor", "--git-dir=/tmp", "-n"]) {
            const { code } = check(root, ["--base", `${hostile}`]);
            assert.equal(code, 2, hostile);
        }
        // `--help` anywhere outranks the rest of the command line, which is why the loop above leaves it out.
        assert.equal(check(root, ["--base", "--help"]).code, 0);
    });

    test("the guard is not vacuous: unguarded, git obeys an option-shaped ref", () => {
        const root = repo();
        const status = (args) => {
            try {
                execFileSync("git", ["-C", root, ...args], { stdio: ["ignore", "pipe", "pipe"] });
                return 0;
            } catch (error) {
                return error.status;
            }
        };
        assert.equal(status(["merge-base", "--is-ancestor", "HEAD"]), 129, "unguarded, git takes it as a flag");
        assert.equal(status(["merge-base", "--end-of-options", "--is-ancestor", "HEAD"]), 128, "guarded, it is a bad ref");
    });

    test("`--packs` may not escape the repository", () => {
        assert.throws(() => insideRepo("../.."), /not a directory inside the repository/);
        assert.throws(() => insideRepo("packs/../../.."), /not a directory inside the repository/);
        assert.throws(() => insideRepo("/etc"), /absolute path/);
        assert.throws(() => insideRepo("."), /not a directory inside the repository/);
        assert.equal(insideRepo("packs"), "packs");
        assert.equal(insideRepo("vendor/packs"), "vendor/packs");
    });

    test("`--packs` is CANONICALISED, or the two halves of the comparison disagree about a pack's name", () => {
        assert.equal(insideRepo("packs/../packs"), "packs");
        assert.equal(insideRepo("./packs"), "packs");
        assert.equal(insideRepo("packs/"), "packs");
        assert.equal(insideRepo("vendor/./sub/../packs"), "vendor/packs");

        const root = repo();
        writePack(root, manifest({ version: "0.1.0", reason: "changed, not bumped" }));
        commit(root, "a red-worthy change");
        const plain = check(root, ["--base", "main"]);
        const noisy = check(root, ["--base", "main", "--packs", "packs/../packs"]);
        assert.equal(plain.code, 1);
        assert.equal(noisy.code, 1, "the uncanonical spelling must reach the same verdict");
        assert.equal(noisy.out, plain.out, "and the same report — no pack counted twice under two names");
    });

    test("bad arguments exit 2, and `--help` exits 0", () => {
        const root = repo();
        assert.equal(check(root, ["--base"]).code, 2);
        assert.equal(check(root, ["--nope"]).code, 2);
        let out = "";
        assert.equal(run(["--help"], { stdout: { write: (s) => (out += s) }, stderr: { write: () => {} } }), 0);
        assert.match(out, /three-dot/i);
    });
});

// ===========================================================================================
// 5. The units under the verdicts
// ===========================================================================================

describe("sameValue", () => {
    test("key order and whitespace do not matter; array order does", () => {
        assert.ok(sameValue({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }));
        assert.ok(!sameValue({ a: [1, 2] }, { a: [2, 1] }), "gates are applied in order, so a reorder is a change");
        assert.ok(!sameValue({ a: 1 }, { a: 1, b: 2 }));
        assert.ok(!sameValue(null, {}));
        assert.ok(sameValue(undefined, undefined));
    });
});

describe("judge", () => {
    const before = manifest();
    test("names the two reds differently, because they need different repairs", () => {
        const changed = manifest({ reason: "different" });
        assert.equal(judge("p", before, changed).verdict, "stale");
        assert.equal(judge("p", manifest({ version: null }), manifest({ version: null, reason: "x" })).verdict, "unversioned");
    });
    test("added, deleted and unchanged are each their own verdict", () => {
        assert.equal(judge("p", null, before).verdict, "added");
        assert.equal(judge("p", before, null).verdict, "deleted");
        assert.equal(judge("p", before, manifest()).verdict, "unchanged");
    });
});

test("`packManifests` finds every pack, and a repository with no `packs/` is the empty set", () => {
    const root = repo();
    assert.deepEqual(packManifests(root), ["packs/tools/contributor/pack.json"]);
    assert.deepEqual(packManifests(scratch()), []);
});

test("`mergeBase` throws CannotRun rather than returning a guess", () => {
    assert.throws(() => mergeBase(repo(), "no-such-ref"), CannotRun);
});
