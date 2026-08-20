// A shadowed pack is refused rather than picked — #316.
//
//   node --test "cli/**/*.test.mjs"
//
// Two roots answer for one declared pack: a **discovered** one outside the repository, and the
// repository's own. `resolvePack` is first-match-wins and discovered leads, so before this the
// compiler silently emitted the discovered copy's policy while `verify/compile.sh` read the tree's.
// On this project's own host that meant a `git commit --no-verify` matcher the tree had deliberately
// removed as false coverage — a rule that reads as protection and provides none.
//
// **Hermetic, and deliberately not through a fake plugin cache.** `rootPlan` takes `discovery` as an
// injectable thunk, so a discovered root can be constructed directly. Faking a host would test
// `discover.mjs`'s record reader a second time — it has its own suite — and would tie these cases to
// a record schema that has nothing to do with what they assert.
//
// The three edges are the whole contract, and the third is the one that keeps the refusal honest:
// refusing where a caller ELECTED discovery would refuse them for answering the question the refusal
// asks.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// A HERMETIC HOST, and this file needs one even though every case injects its own discovery thunk.
// `packContributions` can reach the installed-plugin record on the unasked path, so the neutralisation
// is about what the TOOL can do rather than what these cases happen to ask of it — and a later edit
// that dropped a thunk would otherwise start reading whatever is installed on the machine, silently.
// `pinned-roots.live.test.mjs` sweeps for exactly this and caught this file's first draft without it.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import { packContributions, packDifferences, shadowedCopy } from "./compile.mjs";

function pack(dir, { version, action }) {
    const at = path.join(dir, "rituals", "checkpoints");
    fs.mkdirSync(at, { recursive: true });
    fs.writeFileSync(
        path.join(at, "pack.json"),
        JSON.stringify({
            portulan: { pack: "1.0", version },
            name: "rituals/checkpoints",
            contributes: { gates: [{ id: "commit-without-the-hooks", tier: "gated", action, reason: "…" }] },
        }),
    );
    return at;
}

// A workspace whose `tree` yields a derived root carrying the pack, plus a separate directory
// standing in for an installed copy. Returns both so a case can make them agree or differ.
function world({ treeAction, cacheAction, treeVersion = "0.2.1", cacheVersion = "0.2.0" }) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-shadow-"));
    SCRATCH.push(root);
    const wsDir = path.join(root, ".portulan");
    fs.mkdirSync(wsDir, { recursive: true });
    fs.writeFileSync(
        path.join(wsDir, "workspace.json"),
        JSON.stringify({ portulan: { spec: "2.8" }, name: "w", kind: "repository", tree: "../", packs: ["rituals/checkpoints"] }),
    );
    pack(path.join(root, "packs"), { version: treeVersion, action: treeAction });
    const cache = path.join(root, "elsewhere");
    pack(cache, { version: cacheVersion, action: cacheAction });
    return { root, cache };
}

// Every root `world()` mints is registered and removed at the end of the file, the same shape
// `discover.test.mjs` and `collisions.test.mjs` use. Without it each run left a `portulan-shadow-*`
// directory behind, and a suite that litters the temp directory is one nobody can measure the
// footprint of — which is the subject of an open issue against `tests.sh` itself.
const SCRATCH = [];
test.after(() => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

const SHELL = { shell: "git commit --no-verify" };
const NONE = { none: "No honest matcher. The category is unbounded shell." };

const discovered = (cache) => () => ({ ok: true, roots: [cache], why: null });

describe("a pack that two roots answer for is refused, not picked", () => {
    test("an unasked discovered shadow REFUSES, and the message names what differs", () => {
        const { root, cache } = world({ treeAction: NONE, cacheAction: SHELL });
        assert.throws(
            () => packContributions(root, ".portulan", { discovery: discovered(cache) }),
            (err) => {
                assert.match(err.message, /SHADOWED/);
                assert.match(err.message, /gate fragments that differ once parsed/);
                // **BOTH roots by path.** The first cut named only the tree copy and described the
                // other as "a discovered root outside this repository" — handing back a choice while
                // withholding half of what it is between, and the withheld half is the one the reader
                // cannot see from inside the repository. Caught at the pre-commit checkpoint against
                // the message's own claim to be "naming both roots".
                assert.ok(err.message.includes(cache), "the discovered root, by path");
                assert.match(err.message, /packs\/rituals\/checkpoints/, "and the tree copy, by path");
                assert.match(err.message, /--pack-root packs/);
                assert.match(err.message, /--pack-root auto/);
                return true;
            },
        );
    });

    // The case that reads as over-strict until the bytes are followed: `recordedOrigin` tags the
    // answering root into `$portulan.packs[].origin`, so a discovered answer emits `discovered` where
    // the rail's artifact says `tree`. Agreement in the manifests is not agreement in the artifact,
    // and a carve-out here would ship a compile that still reds the recipe it exists to reconcile with.
    test("a shadow whose manifests AGREE still refuses, and says why", () => {
        const { root, cache } = world({ treeAction: NONE, cacheAction: NONE, cacheVersion: "0.2.1" });
        assert.throws(
            () => packContributions(root, ".portulan", { discovery: discovered(cache) }),
            (err) => {
                assert.match(err.message, /SHADOWED/);
                assert.match(err.message, /manifests agree/);
                assert.match(err.message, /which root answered/);
                return true;
            },
        );
    });

    test("a NAMED root never refuses — nothing is behind it to shadow", () => {
        const { root, cache } = world({ treeAction: NONE, cacheAction: SHELL });
        const got = packContributions(root, ".portulan", {
            packRoots: [path.join(root, "packs")],
            discovery: discovered(cache),
        });
        assert.equal(got.contributions.length, 1);
        assert.deepEqual(got.contributions[0].fragments[0].action, NONE, "the named root's copy is what composed");
    });

    test("ELECTED discovery never refuses — electing it is the choice the refusal asks for", () => {
        const { root, cache } = world({ treeAction: NONE, cacheAction: SHELL });
        const got = packContributions(root, ".portulan", { discovery: discovered(cache), forced: true });
        assert.equal(got.contributions.length, 1);
        assert.deepEqual(got.contributions[0].fragments[0].action, SHELL, "the elected discovered copy is what composed");
    });

    // A shadow we cannot read is not a shadow we may call harmless. Refusing with the read error named
    // is the only honest answer: the question "which copy would this compile from" went unanswered.
    test("an unreadable shadow is a refusal that says the comparison could not be made", () => {
        const { root, cache } = world({ treeAction: NONE, cacheAction: SHELL });
        fs.writeFileSync(path.join(root, "packs", "rituals", "checkpoints", "pack.json"), "{ not json");
        assert.throws(
            () => packContributions(root, ".portulan", { discovery: discovered(cache) }),
            (err) => {
                assert.match(err.message, /could not be read/);
                // The same both-roots obligation as the arm above: an unreadable shadow is still a
                // choice between two directories, and the reader needs both to make it.
                assert.ok(err.message.includes(cache), "the discovered root, by path");
                assert.match(err.message, /packs\/rituals\/checkpoints/, "and the tree copy, by path");
                assert.match(err.message, /--pack-root/);
                return true;
            },
        );
    });
});

describe("the comparison itself, which doctor and compile now share", () => {
    test("reformatting and key order are NOT differences", () => {
        const a = { portulan: { version: "1" }, contributes: { gates: [{ id: "x", tier: "gated", action: { shell: "s" } }] } };
        const b = { portulan: { version: "1" }, contributes: { gates: [{ action: { shell: "s" }, tier: "gated", id: "x" }] } };
        assert.deepEqual(packDifferences(a, b), []);
    });

    // The defect the first spelling shipped: projecting `[id, tier, action]` read a copy differing in
    // `reason` as agreeing, while `composeFragments` pushes the whole fragment.
    test("a difference in `reason` alone IS a difference", () => {
        const a = { contributes: { gates: [{ id: "x", tier: "gated", action: { none: "n" }, reason: "one" }] } };
        const b = { contributes: { gates: [{ id: "x", tier: "gated", action: { none: "n" }, reason: "two" }] } };
        assert.deepEqual(packDifferences(a, b), ["gate fragments that differ once parsed"]);
    });

    test("shadowedCopy answers null for anything a discovered root did not answer", () => {
        assert.equal(shadowedCopy("rituals/checkpoints", "tree", ["/a"], () => "derived"), null);
        assert.equal(shadowedCopy("rituals/checkpoints", "named", ["/a"], () => "named"), null);
    });
});
