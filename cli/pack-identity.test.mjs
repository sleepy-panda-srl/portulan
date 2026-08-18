// Tests for the byte-identity rail. Every comparable rail in this directory has a suite; this one
// shipped without and Copilot said so on #297, which is the note that produced this file.
//
// The four states the recipe contracts are exercised positively — green, the two findings, and
// could-not-run — because a rail whose failure path is never run is a rail nobody has seen work.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { compare, main } from "./pack-identity.mjs";

const scratch = () => fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "portulan-pack-identity-"));
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

/** A minimal packable repository: one manifest with `files`, and the files it names. */
function fixture() {
    const root = scratch();
    git(root, "init", "-q", "-b", "main");
    git(root, "config", "user.email", "t@example.com");
    git(root, "config", "user.name", "t");
    fs.mkdirSync(path.join(root, "lib"));
    fs.writeFileSync(path.join(root, "lib", "a.mjs"), "export const a = 1;\n");
    fs.writeFileSync(
        path.join(root, "package.json"),
        `${JSON.stringify({ name: "fixture-pack-identity", version: "0.0.0", files: ["lib/"] }, null, 2)}\n`,
    );
    git(root, "add", "-A");
    git(root, "commit", "-qm", "fixture");
    return root;
}

describe("pack-identity", () => {
    test("a clean tree passes, and the roster it walked is not empty", () => {
        const root = fixture();
        const { packed, untracked, differing } = compare(root);
        assert.ok(packed.length > 0, "npm pack reported no files — a green over an empty roster");
        assert.deepEqual(untracked, []);
        assert.deepEqual(differing, []);
    });

    test("a packed file whose bytes drift from the index is a finding", () => {
        const root = fixture();
        fs.writeFileSync(path.join(root, "lib", "a.mjs"), "export const a = 2; // drifted\n");
        const { differing, untracked } = compare(root);
        assert.deepEqual(differing, ["lib/a.mjs"], "the drifted file was not reported");
        assert.deepEqual(untracked, []);
    });

    test("a packed file that is not tracked at all is its own finding, not a byte difference", () => {
        const root = fixture();
        // Ships via `files: ["lib/"]` but was never added — the shape that would put an unreviewed
        // byte in the package, and the one the rail caught on itself when it was written.
        fs.writeFileSync(path.join(root, "lib", "sneaked.mjs"), "export const s = 1;\n");
        const { untracked, differing } = compare(root);
        assert.deepEqual(untracked, ["lib/sneaked.mjs"]);
        assert.deepEqual(differing, [], "an untracked file must not also be reported as differing");
    });

    test("STAGED work compares clean — the property dod.md's before-every-commit rule needs", () => {
        const root = fixture();
        fs.writeFileSync(path.join(root, "lib", "a.mjs"), "export const a = 3; // staged\n");
        git(root, "add", "-A");
        const { differing, untracked } = compare(root);
        assert.deepEqual(differing, [], "a staged edit read as a difference; the rail would be red before every commit");
        assert.deepEqual(untracked, []);
    });

    test("a filename beginning with `-` is compared, not read as an option", () => {
        const root = fixture();
        // The `cat` shell-out this rail shipped with would have taken this as a flag. Raised on #297.
        fs.writeFileSync(path.join(root, "lib", "-n.mjs"), "export const n = 1;\n");
        git(root, "add", "-A");
        git(root, "commit", "-qm", "dash");
        const { differing, untracked } = compare(root);
        assert.deepEqual(untracked, []);
        assert.deepEqual(differing, []);
        fs.writeFileSync(path.join(root, "lib", "-n.mjs"), "export const n = 2;\n");
        assert.deepEqual(compare(root).differing, ["lib/-n.mjs"], "a leading-dash filename was not compared");
    });

    // Containment, raised on #297. `rel` arrives from npm's JSON and is not this tool's to trust: an
    // escape would send both the `git show` and the read outside the repository, and the rail would
    // then compare the wrong bytes and report GREEN — the worst available failure for a rail.
    test("npm excludes a symlink from the pack, so the symlink guard is unreachable through this input", () => {
        const root = fixture();
        fs.symlinkSync("/etc/hosts", path.join(root, "lib", "linked.mjs"));
        git(root, "add", "-A");
        git(root, "commit", "-qm", "link");
        // MEASURED, not assumed: `npm pack --dry-run` omits the symlink entirely — it is not in the
        // roster, so `containedPath` never sees it. The guard in the module stays as defence in depth
        // against npm changing, and this test records WHY it cannot be exercised positively rather than
        // asserting a throw that cannot happen. A test written to the guard's intent instead of npm's
        // behaviour failed here first, which is the reason this comment exists.
        const { packed, untracked, differing } = compare(root);
        assert.ok(!packed.includes("lib/linked.mjs"), "npm packed a symlink; the guard is now reachable and needs a positive test");
        assert.deepEqual(untracked, []);
        assert.deepEqual(differing, []);
    });

    // The 0/1/2 contract, raised on #297: an unexpected throw must not exit as 1, which the runner
    // reads as a finding about the package. Exercised through `main` rather than `compare`, because
    // the translation is what is being tested and only `main` performs it.
    test("an unexpected failure exits 2 with a diagnostic, not 1 — a crash is not a verdict", () => {
        const out = [];
        const err = [];
        const code = main(["node", "pack-identity", path.join(scratch(), "does-not-exist")],
            { write: (t) => out.push(t) }, { write: (t) => err.push(t) });
        assert.equal(code, 2, "a failure that is not a finding exited as one");
        assert.match(err.join(""), /pack-identity: could not run/);
        assert.equal(out.join(""), "", "a could-not-run printed an ok line");
    });

    test("a directory that is not a repository is could-not-run, never a finding", () => {
        assert.throws(() => compare(scratch()), (error) => {
            assert.match(error.message, /not a git repository|HEAD does not resolve/);
            return true;
        });
    });
});
