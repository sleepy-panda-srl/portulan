// The recipe set — one carrier, and every reader reaches it.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { recipeSet, composedId, resolverFor, run, RECIPE_SET_READERS } from "./recipe-set.mjs";

// This suite imports `./recipe-set.mjs`, which can read the host's installed-plugin record: point it at none.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function workspace(recipes, extra = {}) {
    return { name: "w", verify: { default: recipes[0]?.id, recipes }, ...extra };
}

function pack(ref, recipes, root = `../packs/${ref}`) {
    const [category, name] = ref.split("/");
    return { ref, root, manifest: { portulan: { pack: "1.0", version: "0.1.0" }, category, name, contributes: { verify: recipes } } };
}

function resolverOver(packs) {
    return (ref) => packs.find((p) => p.ref === ref) ?? null;
}

const DOCS = { id: "docs", run: "./.portulan/verify/docs.sh" };
const TESTS = { id: "tests", run: "./.portulan/verify/tests.sh" };

describe("composition is additive, and the workspace's own set is untouched", () => {
    test("a pack's recipe is ADDED, and every workspace recipe survives unchanged", () => {
        const gh = pack("tools/github", [{ id: "actions-pinned", run: "bash ${PACK_ROOT}/verify/actions-pinned.sh" }]);
        const out = recipeSet(workspace([DOCS, TESTS]), { packs: ["tools/github"], resolve: resolverOver([gh]) });

        assert.equal(out.ok, true);
        assert.deepEqual(
            out.recipes.map((r) => r.id),
            ["docs", "tests", "tools/github:actions-pinned"],
        );
        assert.deepEqual(out.recipes[0], { ...DOCS, source: { kind: "workspace" } });
    });

    test("the workspace's recipes come FIRST, so a composed one can never be the set's head", () => {
        const gh = pack("tools/github", [{ id: "a", run: "x" }]);
        const out = recipeSet(workspace([DOCS]), { packs: ["tools/github"], resolve: resolverOver([gh]) });
        assert.equal(out.recipes[0].source.kind, "workspace");
    });

    test("no packs is not an error — it is the ordinary workspace, and it composes nothing", () => {
        const out = recipeSet(workspace([DOCS, TESTS]), {});
        assert.equal(out.ok, true);
        assert.equal(out.recipes.length, 2);
        assert.ok(out.recipes.every((r) => r.source.kind === "workspace"));
    });
});

describe("the namespace, and what it makes impossible", () => {
    test("a composed id is `<category>/<name>:<id>`, built by the CARRIER and never taken from the pack", () => {
        const evil = pack("tools/github", [{ id: "docs", run: "echo pack" }]);
        const out = recipeSet(workspace([DOCS]), { packs: ["tools/github"], resolve: resolverOver([evil]) });

        assert.equal(out.ok, true);
        assert.deepEqual(out.recipes.map((r) => r.id), ["docs", "tools/github:docs"]);
        assert.equal(out.recipes[0].run, DOCS.run, "the workspace's `docs` still runs the workspace's command");
        assert.equal(out.recipes[1].source.pack, "tools/github");
    });

    test("`composedId` is exported, so no caller re-derives the spelling", () => {
        assert.equal(composedId("tools/github", "actions-pinned"), "tools/github:actions-pinned");
    });

    test("a composed recipe can never be `verify.default`, because `default` is a bare slug", () => {
        const gh = pack("tools/github", [{ id: "a", run: "x" }]);
        const out = recipeSet(workspace([DOCS], {}), { packs: ["tools/github"], resolve: resolverOver([gh]) });
        assert.equal(out.default, "docs");
        assert.ok(!out.recipes.find((r) => r.id === out.default).id.includes(":"));
    });
});

describe("the shadow refusal — belt and braces behind the namespacer, and it FIRES", () => {
    test("a pack declaring one id TWICE with different runs is refused, not silently deduplicated", () => {
        // Schema-legal: `uniqueItems` compares whole objects, so two entries differing only in `run` pass.
        const twice = pack("tools/github", [
            { id: "a", run: "echo one" },
            { id: "a", run: "echo two" },
        ]);
        const out = recipeSet(workspace([DOCS]), { packs: ["tools/github"], resolve: resolverOver([twice]) });

        assert.equal(out.ok, false);
        assert.equal(out.exitCode, 2);
        assert.match(out.reason, /tools\/github/);
        assert.match(out.reason, /\ba\b/);
    });

    test("a composed id that would shadow a workspace id is refused if the namespacer is ever bypassed", () => {
        const sneaky = pack("tools/github", [{ id: "docs", run: "echo pack", __preNamespaced: true }]);
        const out = recipeSet(workspace([DOCS]), {
            packs: ["tools/github"],
            resolve: resolverOver([sneaky]),
            trustPackSpelling: true,
        });
        assert.equal(out.ok, false);
        assert.equal(out.exitCode, 2);
        assert.match(out.reason, /shadow/i);
    });
});

describe("could-not-run is exit 2, and never silently absent", () => {
    test("a pack that cannot resolve is could-not-run, naming the pack", () => {
        const out = recipeSet(workspace([DOCS]), { packs: ["stacks/python"], resolve: resolverOver([]) });
        assert.equal(out.ok, false);
        assert.equal(out.exitCode, 2);
        assert.match(out.reason, /stacks\/python/);
        assert.doesNotMatch(out.reason, /^$/);
    });

    test("an unresolvable pack does NOT degrade to running the workspace's own recipes", () => {
        const out = recipeSet(workspace([DOCS, TESTS]), { packs: ["stacks/python"], resolve: resolverOver([]) });
        assert.equal(out.ok, false);
        assert.equal(out.recipes, undefined);
    });

    test("a resolvable pack that declares NO verify key composes nothing and is not an error", () => {
        const quiet = pack("rituals/checkpoints", undefined);
        delete quiet.manifest.contributes.verify;
        const out = recipeSet(workspace([DOCS]), { packs: ["rituals/checkpoints"], resolve: resolverOver([quiet]) });
        assert.equal(out.ok, true);
        assert.deepEqual(out.recipes.map((r) => r.id), ["docs"]);
    });
});

describe("the validations the CI emitter used to carry alone", () => {
    test("a workspace recipe id that is not a bare slug is refused", () => {
        const out = recipeSet(workspace([{ id: "Not A Slug", run: "x" }]), {});
        assert.equal(out.ok, false);
        assert.equal(out.exitCode, 2);
        assert.match(out.reason, /slug/i);
    });

    test("an empty or whitespace-only run is refused", () => {
        for (const run of ["", "   "]) {
            const out = recipeSet(workspace([{ id: "a", run }]), {});
            assert.equal(out.ok, false, `run ${JSON.stringify(run)} must be refused`);
            assert.match(out.reason, /empty/i);
        }
    });

    test("a newline or tab smuggled into a run is refused", () => {
        for (const run of ["a\nb", "a\tb", "a\rb"]) {
            const out = recipeSet(workspace([{ id: "a", run }]), {});
            assert.equal(out.ok, false, `run ${JSON.stringify(run)} must be refused`);
            assert.match(out.reason, /newline|tab/i);
        }
    });

    test("a manifest declaring no recipes at all is refused rather than reported green", () => {
        const out = recipeSet({ name: "w", verify: { recipes: [] } }, {});
        assert.equal(out.ok, false);
        assert.equal(out.exitCode, 2);
        assert.match(out.reason, /no verify recipes/i);
    });

    test("a manifest with NO `verify.recipes` array is could-not-run, even when a pack would supply one", () => {
        const gh = pack("tools/github", [{ id: "a", run: "x" }]);
        for (const manifest of [{ name: "w" }, { name: "w", verify: {} }, { name: "w", verify: { recipes: "nine" } }]) {
            const out = recipeSet(manifest, { packs: ["tools/github"], resolve: resolverOver([gh]) });
            assert.equal(out.ok, false, `${JSON.stringify(manifest)} must be refused`);
            assert.equal(out.exitCode, 2);
            assert.match(out.reason, /verify\.recipes/);
        }
    });

    test("`trustPackSpelling` reaches the shadow refusal with a GENUINELY namespaced id", () => {
        const sneaky = pack("tools/github", [{ id: "tools/github:docs", run: "echo pack" }]);
        const first = recipeSet(workspace([DOCS]), { packs: ["tools/github"], resolve: resolverOver([sneaky]), trustPackSpelling: true });
        assert.equal(first.ok, true, "a namespaced spelling that collides with nothing is composed, not refused as a non-slug");
        assert.ok(first.recipes.find((r) => r.id === "tools/github:docs"));

        const clash = pack("tools/github", [{ id: "docs", run: "echo pack" }]);
        const second = recipeSet(workspace([DOCS]), { packs: ["tools/github"], resolve: resolverOver([clash]), trustPackSpelling: true });
        assert.equal(second.ok, false);
        assert.match(second.reason, /shadow/i);
    });

    test("`verify.default` comes out normalised the same way the ids do", () => {
        const odd = { toString: () => "docs" };
        const out = recipeSet({ name: "w", verify: { default: odd, recipes: [DOCS] } }, {});
        assert.strictEqual(out.default, "docs");
        assert.ok(out.recipes.find((r) => r.id === out.default), "the default must resolve by identity");
    });

    test("an absent `verify.default` stays absent rather than becoming the string \"undefined\"", () => {
        const out = recipeSet({ name: "w", verify: { recipes: [DOCS] } }, {});
        assert.equal(out.ok, true);
        assert.equal(out.default, undefined);
    });

    test("a non-array `packs` is could-not-run, never iterated as characters", () => {
        for (const packs of ["tools/github", { a: 1 }, 7]) {
            const out = recipeSet(workspace([DOCS]), { packs, resolve: resolverOver([]) });
            assert.equal(out.ok, false, `packs=${JSON.stringify(packs)} must be refused`);
            assert.equal(out.exitCode, 2);
            assert.match(out.reason, /`packs` is not an array/);
        }
    });

    test("a pack whose `contributes.verify` is present but not an array is could-not-run, not a crash", () => {
        for (const value of [{ id: "a" }, "actions-pinned", 3]) {
            const bad = pack("tools/github", []);
            bad.manifest.contributes.verify = value;
            const out = recipeSet(workspace([DOCS]), { packs: ["tools/github"], resolve: resolverOver([bad]) });
            assert.equal(out.ok, false, `verify=${JSON.stringify(value)} must be refused`);
            assert.equal(out.exitCode, 2);
            assert.match(out.reason, /tools\/github/);
            assert.match(out.reason, /not an array/);
        }
    });

    test("a workspace recipe's id and run come out as STRINGS, whatever the manifest put in", () => {
        const odd = { id: { toString: () => "docs" }, run: { toString: () => "./x.sh" } };
        const out = recipeSet({ name: "w", verify: { default: "docs", recipes: [odd] } }, {});
        assert.equal(out.ok, true);
        assert.strictEqual(out.recipes[0].id, "docs");
        assert.strictEqual(out.recipes[0].run, "./x.sh");
        assert.ok(out.recipes.find((r) => r.id === out.default), "the default must resolve by identity, not by coercion");
    });

    test("the run refusal names every character it rejects, including the carriage return", () => {
        const out = recipeSet(workspace([{ id: "a", run: "a\rb" }]), {});
        assert.match(out.reason, /carriage return/i);
    });

    test("the same validations apply to a COMPOSED recipe, not only to the workspace's own", () => {
        const bad = pack("tools/github", [{ id: "a", run: "one\ntwo" }]);
        const out = recipeSet(workspace([DOCS]), { packs: ["tools/github"], resolve: resolverOver([bad]) });
        assert.equal(out.ok, false);
        assert.match(out.reason, /newline|tab/i);
        assert.match(out.reason, /tools\/github/);
    });
});

describe("the composed run reaches the pack's own files", () => {
    test("`${PACK_ROOT}` expands to the resolved pack root, so the command is typeable from the repo root", () => {
        const gh = pack("tools/github", [{ id: "p", run: "bash ${PACK_ROOT}/verify/actions-pinned.sh" }], "packs/tools/github");
        const out = recipeSet(workspace([DOCS]), { packs: ["tools/github"], resolve: resolverOver([gh]) });
        assert.equal(out.recipes[1].run, "bash packs/tools/github/verify/actions-pinned.sh");
    });

    test("expansion happens BEFORE the newline check, so a root cannot smuggle one in", () => {
        const gh = pack("tools/github", [{ id: "p", run: "bash ${PACK_ROOT}/x.sh" }], "packs/a\nb");
        const out = recipeSet(workspace([DOCS]), { packs: ["tools/github"], resolve: resolverOver([gh]) });
        assert.equal(out.ok, false);
        assert.match(out.reason, /newline|tab/i);
    });

    test("a workspace recipe's run is NOT expanded — `${PACK_ROOT}` has no meaning there", () => {
        const out = recipeSet(workspace([{ id: "a", run: "echo ${PACK_ROOT}" }]), {});
        assert.equal(out.ok, true);
        assert.equal(out.recipes[0].run, "echo ${PACK_ROOT}");
    });
});

describe("the roster — every reader of the recipe set reaches this carrier", () => {
    // Blind to a reader that never declares itself; `recipe-set.live.test.mjs` sweeps the tree for one.
    test("the declared roster is every reader, and the assertion is the roster", () => {
        assert.deepEqual([...RECIPE_SET_READERS].sort(), [
            ".github/workflows/verify.yml",
            "cli/doctor.mjs",
            "cli/drills.mjs",
            "cli/finish.mjs",
            "cli/form.mjs",
            "cli/stop-gate.mjs",
            "cli/vendor.mjs",
        ]);
    });
});

test("`resolverFor` reaches discovery with or without `forced`, and reaches nothing with no thunk", () => {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "recipe-set-forced-"));
    SCRATCH.push(root);
    const packDir = path.join(root, "tools", "thing");
    fs.mkdirSync(packDir, { recursive: true });
    fs.writeFileSync(
        path.join(packDir, "pack.json"),
        JSON.stringify({ portulan: { pack: "1.0", version: "0.1.0" }, name: "thing", category: "tools", summary: "x", doc: "README.md", contributes: {} }),
    );
    const manifest = { portulan: { spec: "2.8" }, name: "w", kind: "demo", packs: ["tools/thing"] };
    const discovery = { ok: true, roots: [root] };

    const unforced = resolverFor({ workspaceDir: root, manifest, discovery });
    assert.notEqual(unforced("tools/thing"), null, "unasked, a wired thunk is still consulted");

    const forced = resolverFor({ workspaceDir: root, manifest, discovery, forced: true });
    assert.notEqual(forced("tools/thing"), null, "with `forced`, the discovered root answers");

    // Under the empty host, no thunk and nothing installed answer alike: `discover.test.mjs` tells them apart.
    const hermetic = resolverFor({ workspaceDir: root, manifest });
    assert.equal(hermetic("tools/thing"), null, "with no thunk wired, the host is never reached");
});

test("`resolverFor` refuses a named root beside `forced` rather than resolving nothing", () => {
    assert.throws(
        () => resolverFor({ workspaceDir: ".", manifest: { packs: [] }, named: ["/a"], forced: true, discovery: { ok: true, roots: [] } }),
        /never both/,
    );
});

describe("`--pack-root` at the CLI, which this tool had no way to reach", () => {
    const io = () => {
        const out = [], err = [];
        return { out, err, sink: { stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } } };
    };

    test("a named root reaches resolution — a pack found only there is composed", () => {
        const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "recipe-set-cli-"));
        SCRATCH.push(root);
        const packDir = path.join(root, "packs", "tools", "thing");
        fs.mkdirSync(packDir, { recursive: true });
        fs.writeFileSync(path.join(packDir, "pack.json"), JSON.stringify({
            portulan: { pack: "1.0", version: "0.1.0" }, name: "thing", category: "tools",
            summary: "x", doc: "README.md",
            contributes: { verify: [{ id: "check", run: "bash ${PACK_ROOT}/v.sh", requires: ["bash"] }] },
        }));
        fs.writeFileSync(path.join(packDir, "README.md"), "# x\n");
        const ws = path.join(root, ".portulan");
        fs.mkdirSync(ws, { recursive: true });
        fs.writeFileSync(path.join(ws, "workspace.json"), JSON.stringify({
            portulan: { spec: "2.8" }, name: "w", kind: "demo", packs: ["tools/thing"],
            verify: { default: "own", recipes: [{ id: "own", run: "./own.sh", requires: ["bash"] }] },
        }));

        const bare = io();
        assert.equal(run(["--workspace", ws, "--repo-root", root], bare.sink), 2, "no root: the pack cannot resolve");

        const pinned = io();
        assert.equal(run(["--workspace", ws, "--repo-root", root, "--pack-root", path.join(root, "packs")], pinned.sink), 0, pinned.err.join(""));
        assert.match(pinned.out.join(""), /tools\/thing:check/, "the composed recipe is in the set");
    });

    test("a named root beside `auto` is refused here too, in the one shared sentence", () => {
        const h = io();
        assert.equal(run(["--pack-root", "auto", "--pack-root", "."], h.sink), 2);
        assert.match(h.err.join(""), /never both/);
    });
});

function unreadableHost(scratchDir) {
    const record = path.join(scratchDir, "plugins", "installed_plugins.json");
    fs.mkdirSync(path.dirname(record), { recursive: true });
    fs.writeFileSync(record, "{ not json");
    return scratchDir;
}
function withEnv(config, fn) {
    const before = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = config;
    try { return fn(); } finally {
        if (before === undefined) delete process.env.CLAUDE_CONFIG_DIR;
        else process.env.CLAUDE_CONFIG_DIR = before;
    }
}

test("recipe-set: `auto` against an unreadable record is exit 2", () => {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "recipe-set-unreadable-"));
    SCRATCH.push(root);
    const ws = path.join(root, ".portulan");
    fs.mkdirSync(ws, { recursive: true });
    fs.writeFileSync(path.join(ws, "workspace.json"), JSON.stringify({
        portulan: { spec: "2.8" }, name: "w", kind: "demo",
        verify: { default: "own", recipes: [{ id: "own", run: "./own.sh", requires: ["bash"] }] },
    }));
    const config = unreadableHost(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "recipe-set-host-")));
    SCRATCH.push(config);
    const err = [];
    const sink = { stdout: { write: () => {} }, stderr: { write: (x) => err.push(x) } };
    assert.equal(withEnv(config, () => run(["--workspace", ws, "--repo-root", root, "--pack-root", "auto"], sink)), 2, err.join(""));
});

test("recipe-set refuses a --pack-root that is missing or is a file", () => {
    const io = () => { const err = []; return { err, sink: { stdout: { write: () => {} }, stderr: { write: (x) => err.push(x) } } }; };
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "recipe-set-badroot-"));
    SCRATCH.push(root);
    const aFile = path.join(root, "not-a-directory");
    fs.writeFileSync(aFile, "x");

    const missing = io();
    assert.equal(run(["--pack-root", path.join(root, "nope")], missing.sink), 2);
    assert.match(missing.err.join(""), /cannot be read/);

    const file = io();
    assert.equal(run(["--pack-root", aFile], file.sink), 2);
    assert.match(file.err.join(""), /is not a directory/);

    // `path.resolve("")` is the cwd, so an empty root would pass a directory check made after resolving.
    const blank = io();
    assert.equal(run(["--pack-root", ""], blank.sink), 2);
    assert.match(blank.err.join(""), /cannot be read|is not a directory/);
});

test("recipe-set's valued flags take all three refusals, not one", () => {
    const io = () => { const err = []; return { err, sink: { stdout: { write: () => {} }, stderr: { write: (x) => err.push(x) } } }; };

    const asFlag = io();
    assert.equal(run(["--workspace", "--pack-root", "packs"], asFlag.sink), 2);
    assert.match(asFlag.err.join(""), /flag rather than a value/);

    const missing = io();
    assert.equal(run(["--repo-root"], missing.sink), 2);
    assert.match(missing.err.join(""), /needs a value/);

    const empty = io();
    assert.equal(run(["--workspace", "   "], empty.sink), 2);
    assert.match(empty.err.join(""), /empty value/);
});
