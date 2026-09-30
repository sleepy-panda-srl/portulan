// `index` and `recipe-set` refuse a shadowed pack, and the divergence they would otherwise ship.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// `readScopes` and `resolverFor` can reach the host's installed-plugin record on the unasked path: point it at none.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import { readScopes } from "./index.mjs";
import { resolverFor, recipeSet } from "./recipe-set.mjs";

const SCRATCH = [];
test.after(() => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function pack(root, { scope, runSuffix }) {
    const at = path.join(root, "rituals", "checkpoints");
    fs.mkdirSync(path.join(at, "personas"), { recursive: true });
    fs.writeFileSync(
        path.join(at, "pack.json"),
        JSON.stringify({
            portulan: { pack: "1.0", version: "0.2.0" },
            name: "rituals/checkpoints",
            contributes: {
                personas: ["personas/supervisor.md"],
                verify: [{ id: "ritual", run: "bash ${PACK_ROOT}/verify/" + runSuffix }],
            },
        }),
    );
    fs.writeFileSync(
        path.join(at, "personas", "supervisor.md"),
        `# Supervisor\n\n## Memory scope\n\n${scope}\n\n## Body\n\nIdentical in both worlds.\n`,
    );
    return at;
}

function world() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-shadowres-"));
    SCRATCH.push(root);
    const wsDir = path.join(root, ".portulan");
    fs.mkdirSync(path.join(wsDir, "personas"), { recursive: true });
    fs.writeFileSync(
        path.join(wsDir, "workspace.json"),
        JSON.stringify({
            portulan: { spec: "2.8" },
            name: "w",
            kind: "repository",
            tree: "../",
            packs: ["rituals/checkpoints"],
            slots: { personas: "personas/" },
            personas: { index: { path: "personas-index.md" } },
            verify: { default: "own", recipes: [{ id: "own", run: "bash ./own.sh" }] },
        }),
    );
    pack(path.join(root, "packs"), { scope: "The TREE copy's scope.", runSuffix: "tree.sh" });
    const cache = path.join(root, "elsewhere");
    pack(cache, { scope: "The INSTALLED copy's scope.", runSuffix: "installed.sh" });
    return { root, wsDir, tree: path.join(root, "packs"), cache };
}

const manifestOf = (wsDir) => JSON.parse(fs.readFileSync(path.join(wsDir, "workspace.json"), "utf8"));

describe("the divergence #318 was filed on, demonstrated", () => {
    test("index digests a DIFFERENT scope depending on which root answered", () => {
        const { root, wsDir, tree, cache } = world();
        const fromTree = readScopes(wsDir, manifestOf(wsDir), { packRoots: [tree] });
        const fromCache = readScopes(wsDir, manifestOf(wsDir), { packRoots: [cache] });
        const digest = (r) => JSON.stringify(r.scopes ?? r);
        assert.notEqual(digest(fromTree), digest(fromCache), "the two worlds must produce different scope material");
        assert.match(digest(fromTree), /TREE copy/);
        assert.match(digest(fromCache), /INSTALLED copy/);
        assert.ok(root);
    });

    test("recipe-set composes run lines pointing into whichever root answered", () => {
        const { root, wsDir, tree, cache } = world();
        const runsUnder = (named) => {
            const resolve = resolverFor({ workspaceDir: wsDir, manifest: manifestOf(wsDir), repoRoot: root, named });
            const set = recipeSet(manifestOf(wsDir), { resolve });
            assert.ok(set.ok, set.reason);
            return set.recipes.map((r) => r.run).join("\n");
        };
        const fromTree = runsUnder([tree]);
        const fromCache = runsUnder([cache]);
        // `notEqual` alone passes on the differing suffix; the `match` lines pin the spliced root.
        assert.notEqual(fromTree, fromCache);
        assert.match(fromTree, /^bash packs\/rituals\/checkpoints\/verify\/tree\.sh$/m, "the tree world's run");
        assert.match(fromCache, /^bash elsewhere\/rituals\/checkpoints\/verify\/installed\.sh$/m, "the installed world's run");
        assert.ok(!fromTree.includes("elsewhere"), "and neither names the other's files");
    });
});

describe("and the refusal that now stands between them", () => {
    const discovered = (cache) => () => ({ ok: true, roots: [cache], why: null });

    test("index REFUSES an unasked shadow", () => {
        const { wsDir, cache } = world();
        assert.throws(
            () => readScopes(wsDir, manifestOf(wsDir), { discovery: discovered(cache) }),
            (err) => {
                assert.match(err.message, /SHADOWED/);
                assert.ok(err.message.includes(cache), "the discovered root, by path");
                assert.match(err.message, /--pack-root packs/);
                return true;
            },
        );
    });

    test("recipe-set REFUSES an unasked shadow, at construction so the caller can catch it", () => {
        const { root, wsDir, cache } = world();
        assert.throws(
            () =>
                resolverFor({
                    workspaceDir: wsDir,
                    manifest: manifestOf(wsDir),
                    repoRoot: root,
                    discovery: discovered(cache),
                }),
            (err) => {
                assert.match(err.message, /SHADOWED/);
                assert.ok(err.message.includes(cache), "the discovered root, by path");
                assert.match(err.message, /PACK_ROOT/, "and why this tool in particular cannot pick");
                return true;
            },
        );
    });

    test("an AGREEING shadow still refuses, in either tool", () => {
        const agreeing = () => {
            const w = world();
            fs.rmSync(path.join(w.cache, "rituals"), { recursive: true, force: true });
            fs.cpSync(path.join(w.tree, "rituals"), path.join(w.cache, "rituals"), { recursive: true });
            return w;
        };
        const a = agreeing();
        assert.deepEqual(
            fs.readFileSync(path.join(a.tree, "rituals", "checkpoints", "pack.json"), "utf8"),
            fs.readFileSync(path.join(a.cache, "rituals", "checkpoints", "pack.json"), "utf8"),
            "the fixture must actually agree, or this case proves nothing",
        );
        assert.throws(
            () => readScopes(a.wsDir, manifestOf(a.wsDir), { discovery: discovered(a.cache) }),
            /SHADOWED/,
            "index refuses an agreeing shadow",
        );
        const b = agreeing();
        assert.throws(
            () => resolverFor({ workspaceDir: b.wsDir, manifest: manifestOf(b.wsDir), repoRoot: b.root, discovery: discovered(b.cache) }),
            /SHADOWED/,
            "recipe-set refuses an agreeing shadow",
        );
    });

    test("a NAMED root never refuses, in either tool", () => {
        const { root, wsDir, tree, cache } = world();
        assert.ok(readScopes(wsDir, manifestOf(wsDir), { packRoots: [tree], discovery: discovered(cache) }));
        assert.ok(
            resolverFor({
                workspaceDir: wsDir,
                manifest: manifestOf(wsDir),
                repoRoot: root,
                named: [tree],
                discovery: discovered(cache),
            }),
        );
    });

    test("ELECTED discovery never refuses, in either tool", () => {
        const { root, wsDir, cache } = world();
        assert.ok(readScopes(wsDir, manifestOf(wsDir), { discoverPacks: true, discovery: discovered(cache) }));
        assert.ok(
            resolverFor({
                workspaceDir: wsDir,
                manifest: manifestOf(wsDir),
                repoRoot: root,
                discovery: discovered(cache),
                forced: true,
            }),
        );
    });
});
