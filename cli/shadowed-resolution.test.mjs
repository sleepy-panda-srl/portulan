// `index` and `recipe-set` refuse a shadowed pack, and the divergence they would otherwise ship — #318.
//
//   node --test "cli/**/*.test.mjs"
//
// #316 fixed `compile`. These two resolve packs on the same unasked path and its refusal could not
// reach them: neither goes through `packContributions`. The issue was filed **code-measured rather
// than fixture-demonstrated** — on the maintainer's host the installed copy contributes no recipes and
// its personas agree, so nothing diverged. This file pays that debt: the first two cases show the two
// worlds producing DIFFERENT output, and the rest pin the refusal that now stands between them.
//
// **The divergence is shown through the two ELECTED spellings**, never the bare path. After this change
// the bare path refuses, so a fixture claiming to demonstrate divergence there would be demonstrating
// the refusal instead — and quietly proving nothing about what the refusal prevents.
//
// Three construction requirements, each because the obvious fixture would show nothing:
//   1. the personas must differ in their **scope section** — `index` digests `memoryScopeOf`, so a
//      difference in body text reaches no committed byte;
//   2. the recipe pack must use **`${PACK_ROOT}`** — it expands to the answering pack DIRECTORY,
//      relative to the REPOSITORY root, which is why agreeing manifests still diverge here and why a
//      manifest comparison would be the wrong predicate for this tool. Every `resolverFor` call in
//      this file therefore passes the repository root: two review rounds turned on that distinction,
//      the second because the first fix corrected one call site and left four;
//   3. both roots must be **named** to elect a world, since discovery-unasked now refuses.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// A HERMETIC HOST, and this file needs one although every case injects its own discovery thunk.
// `readScopes` and `resolverFor` can both reach the installed-plugin record on the unasked path, so
// the neutralisation is about what the TOOL can do rather than what these cases happen to ask of it:
// a later edit dropping a thunk would otherwise start reading whatever is installed on the machine,
// silently. `pinned-roots.live.test.mjs` sweeps for exactly this and caught this file without it —
// the second time that rail has caught a suite added to fix this family.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import { readScopes } from "./index.mjs";
import { resolverFor, recipeSet } from "./recipe-set.mjs";

const SCRATCH = [];
test.after(() => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

// A pack carrying one persona whose SCOPE differs per world, and one recipe naming its own files
// through the token. `scope` is the half that reaches the committed index.
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
            // A declared `personas` index needs the layer it lands in — `readScopes` refuses the pair
            // without it, and a first draft of this fixture tripped exactly that.
            slots: { personas: "personas/" },
            personas: { index: { path: "personas-index.md" } },
            // `recipeSet` refuses a manifest declaring no `verify.recipes` rather than composing a set
            // as if it had declared none — the could-not-run rule, and a first draft of this fixture met it.
            verify: { default: "own", recipes: [{ id: "own", run: "bash ./own.sh" }] },
        }),
    );
    // Two worlds, differing in the scope text and in the file each recipe would run.
    pack(path.join(root, "packs"), { scope: "The TREE copy's scope.", runSuffix: "tree.sh" });
    const cache = path.join(root, "elsewhere");
    pack(cache, { scope: "The INSTALLED copy's scope.", runSuffix: "installed.sh" });
    return { root, wsDir, tree: path.join(root, "packs"), cache };
}

const manifestOf = (wsDir) => JSON.parse(fs.readFileSync(path.join(wsDir, "workspace.json"), "utf8"));

describe("the divergence #318 was filed on, demonstrated", () => {
    // The debt the issue names. Both worlds are ELECTED by naming their root, because the unasked path
    // now refuses — so this measures what the refusal prevents rather than the refusal itself.
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

    // The fact that forecloses a manifest-comparison predicate for this tool: the manifests here are
    // byte-identical apart from the run suffix, and it is the ROOT spliced into `run` that diverges.
    test("recipe-set composes run lines pointing into whichever root answered", () => {
        const { root, wsDir, tree, cache } = world();
        const runsUnder = (named) => {
            // **`repoRoot` is the REPOSITORY root, not the workspace directory.** `${PACK_ROOT}`
            // composes relative to the repository, so passing `wsDir` yielded `../packs/...` — a shape
            // the real emitter never produces when run from a repository root, which made this case
            // pin an artefact of its own wiring rather than the contract. Caught in review.
            const resolve = resolverFor({ workspaceDir: wsDir, manifest: manifestOf(wsDir), repoRoot: root, named });
            const set = recipeSet(manifestOf(wsDir), { resolve });
            assert.ok(set.ok, set.reason);
            return set.recipes.map((r) => r.run).join("\n");
        };
        const fromTree = runsUnder([tree]);
        const fromCache = runsUnder([cache]);
        // `notEqual` alone is satisfiable by the differing run SUFFIX; the two `match` lines below are
        // what pin the root-splicing this case exists for. Measured: neutralising the splice reds the
        // matches and leaves `notEqual` green.
        assert.notEqual(fromTree, fromCache);
        // Measured rather than assumed, and measured TWICE. The token expands to the answering pack
        // directory relative to the **repository** root: `packs/rituals/checkpoints` against
        // `elsewhere/rituals/checkpoints`. A first draft asserted an absolute form; a second passed
        // `repoRoot: root` and so asserted `../packs/...`, which the real emitter never produces.
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

    // **The design that lives only in comments until something pins it.** Both guards refuse an
    // unasked shadow whether or not the two copies agree — for `index` deliberately, since its
    // artifact records no origin and agreeing copies really would produce identical bytes. The
    // argument against a carve-out is that the predicate licensing it is narrower than "the manifests
    // differ" and widens silently with every key a later Pack Definition adds. Without these two
    // cases, an "optimization" inserting a `packDifferences` check would pass every other case here.
    test("an AGREEING shadow still refuses, in either tool", () => {
        const agreeing = () => {
            const w = world();
            // Overwrite the installed copy with the tree's, byte for byte: same manifest, same scope.
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
