// A shadowed pack is refused rather than picked.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// `packContributions` can reach the host's installed-plugin record on the unasked path: point it at none.
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
                assert.ok(err.message.includes(cache), "the discovered root itself, by path");
                assert.ok(
                    !err.message.includes(path.join(cache, "rituals", "checkpoints")),
                    "the ROOT, not the pack directory under it — `dir` contains `root` as a prefix, so a" +
                        " containment check alone cannot tell them apart",
                );
                assert.match(err.message, /the root packs /, "and the tree-derived root, relative and bare");
                assert.match(err.message, /--pack-root packs/);
                assert.match(err.message, /--pack-root auto/);
                return true;
            },
        );
    });

    // Not over-strict: the compiled artifact records which root answered, in `$portulan.packs[].origin`.
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

    test("an unreadable shadow is a refusal that says the comparison could not be made", () => {
        const { root, cache } = world({ treeAction: NONE, cacheAction: SHELL });
        fs.writeFileSync(path.join(root, "packs", "rituals", "checkpoints", "pack.json"), "{ not json");
        assert.throws(
            () => packContributions(root, ".portulan", { discovery: discovered(cache) }),
            (err) => {
                assert.match(err.message, /could not be read/);
                assert.ok(err.message.includes(cache), "the discovered root itself, by path");
                assert.ok(
                    !err.message.includes(path.join(cache, "rituals", "checkpoints")),
                    "the ROOT, not the pack directory under it",
                );
                assert.match(err.message, /the root packs /, "and the tree-derived root, relative and bare");
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

    // `composeFragments` emits the whole fragment, so `reason` reaches the compiled policy too.
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
