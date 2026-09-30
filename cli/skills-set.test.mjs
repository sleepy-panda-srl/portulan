// The registrable set — what a plugin manifest must declare so a composed pack's skills register.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { HOST_SKILL_DEPTH, skillsSet, packPortion, compare, declaredFor, canonical, run } from "./skills-set.mjs";

// Hermetic: `run` consults discovery, which reads the host's installed-plugin record.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

// One exit handler for every scratch directory: one each would pass node's ten-listener limit.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function resolverOver(table) {
    return (ref) => (Object.hasOwn(table, ref) ? table[ref] : null);
}

function pack(root, skills = ["skills/"]) {
    return { root, manifest: { contributes: { skills } } };
}

const PLUGIN_ROOT = path.resolve("/repo");

describe("the derivation", () => {
    test("a composed pack's declared skills root becomes the path the manifest must declare", () => {
        const set = skillsSet(
            { packs: ["rituals/checkpoints"] },
            {
                pluginRoot: PLUGIN_ROOT,
                resolve: resolverOver({
                    "rituals/checkpoints": pack(path.join(PLUGIN_ROOT, "packs", "rituals", "checkpoints")),
                }),
            },
        );
        assert.equal(set.ok, true);
        assert.deepEqual(
            set.paths.map((p) => p.path),
            ["./packs/rituals/checkpoints/skills/"],
        );
        assert.equal(set.paths[0].pack, "rituals/checkpoints");
    });

    test("a pack declaring several skills roots yields one path each, in declaration order", () => {
        const set = skillsSet(
            { packs: ["rituals/two"] },
            {
                pluginRoot: PLUGIN_ROOT,
                resolve: resolverOver({
                    "rituals/two": pack(path.join(PLUGIN_ROOT, "packs", "rituals", "two"), ["skills/", "extra/"]),
                }),
            },
        );
        assert.equal(set.ok, true);
        assert.deepEqual(
            set.paths.map((p) => p.path),
            ["./packs/rituals/two/skills/", "./packs/rituals/two/extra/"],
        );
    });

    test("a pack declaring no skills contributes none, and that is not an error", () => {
        const set = skillsSet(
            { packs: ["tools/github"] },
            {
                pluginRoot: PLUGIN_ROOT,
                resolve: resolverOver({
                    "tools/github": { root: path.join(PLUGIN_ROOT, "packs", "tools", "github"), manifest: { contributes: { verify: [] } } },
                }),
            },
        );
        assert.equal(set.ok, true);
        assert.deepEqual(set.paths, []);
    });

    test("the emitted path keeps the `./…/` form the manifests already use", () => {
        const set = skillsSet(
            { packs: ["a/b"] },
            { pluginRoot: PLUGIN_ROOT, resolve: resolverOver({ "a/b": pack(path.join(PLUGIN_ROOT, "packs", "a", "b")) }) },
        );
        assert.match(set.paths[0].path, /^\.\/.*\/$/);
    });

    test("the derived path is the nominated root itself, which is what puts both skill shapes in host reach", () => {
        assert.ok(HOST_SKILL_DEPTH >= 1, "a host reaching zero levels could not register a root of skills");
        const packDir = path.join(PLUGIN_ROOT, "packs", "a", "b");
        const set = skillsSet({ packs: ["a/b"] }, { pluginRoot: PLUGIN_ROOT, resolve: resolverOver({ "a/b": pack(packDir, ["skills/"]) }) });
        assert.equal(set.paths[0].path, canonical(path.relative(PLUGIN_ROOT, path.join(packDir, "skills"))));
    });
});

describe("one partition, so --check converges and --write is idempotent", () => {
    const SUB = path.join(PLUGIN_ROOT, ".portulan", "sub", "packs", "rituals", "demo");

    function subtreeSet() {
        return skillsSet(
            { packs: ["rituals/demo"] },
            { pluginRoot: PLUGIN_ROOT, resolve: resolverOver({ "rituals/demo": pack(SUB) }) },
        );
    }

    test("a pack root inside the plugin root but outside ./packs/ is still derived", () => {
        const set = subtreeSet();
        assert.equal(set.ok, true);
        assert.deepEqual(set.paths.map((p) => p.path), ["./.portulan/sub/packs/rituals/demo/skills/"]);
    });

    test("and the SAME partition recognises it on the declared side — no eternal drift", () => {
        const set = subtreeSet();
        const declared = { skills: ["./core/skills/", "./.portulan/sub/packs/rituals/demo/skills/"] };
        assert.equal(compare(set, declared, PLUGIN_ROOT).agree, true);
    });

    test("declaredFor is a fixed point: writing what it returns and re-deriving changes nothing", () => {
        const set = subtreeSet();
        const once = declaredFor(set, { skills: ["./core/skills/"] }, PLUGIN_ROOT);
        const twice = declaredFor(set, { skills: once }, PLUGIN_ROOT);
        assert.deepEqual(twice, once, "a second --write must not append a duplicate");
        assert.equal(compare(set, { skills: once }, PLUGIN_ROOT).agree, true, "--check must agree with what --write wrote");
    });

    test("the owned roots come from where packs actually resolved, not from a convention", () => {
        assert.deepEqual(subtreeSet().owned, [path.join(PLUGIN_ROOT, ".portulan", "sub", "packs")]);
    });

    test("a resolution root that CONTAINS the plugin root is refused, not silently owned", () => {
        const set = skillsSet(
            { packs: ["rituals/demo"] },
            { pluginRoot: PLUGIN_ROOT, resolve: resolverOver({ "rituals/demo": pack(path.join(PLUGIN_ROOT, "rituals", "demo")) }) },
        );
        assert.equal(set.ok, false);
        assert.equal(set.exitCode, 2);
        assert.match(set.reason, /contains the plugin root/);
    });

    test("a FALLBACK root containing the plugin root is refused too — the guard's sibling site", () => {
        const set = skillsSet({ packs: [] }, { pluginRoot: PLUGIN_ROOT, fallbackRoots: [PLUGIN_ROOT] });
        assert.equal(set.ok, false);
        assert.equal(set.exitCode, 2);
        assert.match(set.reason, /contains the plugin root/);
    });

    test("the fallback owned set follows the caller's resolution roots, not the conventional path", () => {
        const elsewhere = path.join(PLUGIN_ROOT, "sub", "packs");
        const set = skillsSet({ packs: [] }, { pluginRoot: PLUGIN_ROOT, fallbackRoots: [elsewhere] });
        assert.deepEqual(set.owned, [elsewhere]);
        assert.deepEqual(
            declaredFor(set, { skills: ["./core/skills/", "./sub/packs/old/old/skills/"] }, PLUGIN_ROOT),
            ["./core/skills/"],
            "a stale entry under the workspace's own pack root is cleaned",
        );
    });

    test("a workspace that has stopped composing still has its stale pack entries recognised", () => {
        const set = skillsSet({ packs: [] }, { pluginRoot: PLUGIN_ROOT });
        assert.deepEqual(set.owned, [path.join(PLUGIN_ROOT, "packs")]);
        assert.deepEqual(declaredFor(set, { skills: ["./core/skills/", "./packs/x/y/skills/"] }, PLUGIN_ROOT), ["./core/skills/"]);
    });
});

describe("the refusals — could-not-run, never a quietly smaller set", () => {
    test("`packs` that is not an array is exit 2, not a set computed from something nothing can enumerate", () => {
        const set = skillsSet({ packs: "rituals/checkpoints" }, { pluginRoot: PLUGIN_ROOT, resolve: resolverOver({}) });
        assert.equal(set.ok, false);
        assert.equal(set.exitCode, 2);
        assert.match(set.reason, /not an array/);
    });

    test("a composed pack that cannot be resolved is exit 2 and names the pack", () => {
        const set = skillsSet({ packs: ["rituals/missing"] }, { pluginRoot: PLUGIN_ROOT, resolve: resolverOver({}) });
        assert.equal(set.ok, false);
        assert.equal(set.exitCode, 2);
        assert.match(set.reason, /rituals\/missing/);
        assert.match(set.reason, /no pack\.json under any resolution root/);
    });

    test("a pack that RESOLVES but whose pack.json defeats the reader gets its own sentence", () => {
        const set = skillsSet(
            { packs: ["a/b"] },
            {
                pluginRoot: PLUGIN_ROOT,
                resolve: resolverOver({
                    "a/b": { ref: "a/b", root: path.join(PLUGIN_ROOT, "packs", "a", "b"), unreadable: "does not parse as JSON — Unexpected token" },
                }),
            },
        );
        assert.equal(set.ok, false);
        assert.equal(set.exitCode, 2);
        assert.match(set.reason, /resolves at .*packs.*a.*b/);
        assert.match(set.reason, /does not parse as JSON/);
        assert.doesNotMatch(set.reason, /could not be resolved/);
    });

    test("packs declared with NO resolver is could-not-run, not a workspace that composes nothing", () => {
        const set = skillsSet({ packs: ["rituals/checkpoints"] }, { pluginRoot: PLUGIN_ROOT });
        assert.equal(set.ok, false);
        assert.equal(set.exitCode, 2);
    });

    test("`contributes.skills` present and not an array is exit 2, never `?? []`", () => {
        const set = skillsSet(
            { packs: ["a/b"] },
            {
                pluginRoot: PLUGIN_ROOT,
                resolve: resolverOver({ "a/b": { root: path.join(PLUGIN_ROOT, "packs", "a", "b"), manifest: { contributes: { skills: "skills/" } } } }),
            },
        );
        assert.equal(set.ok, false);
        assert.equal(set.exitCode, 2);
        assert.match(set.reason, /contributes\.skills/);
    });

    test("a skills entry that is not a non-empty string is exit 2", () => {
        const set = skillsSet(
            { packs: ["a/b"] },
            { pluginRoot: PLUGIN_ROOT, resolve: resolverOver({ "a/b": pack(path.join(PLUGIN_ROOT, "packs", "a", "b"), [""]) }) },
        );
        assert.equal(set.ok, false);
        assert.equal(set.exitCode, 2);
    });

    test("a skills root escaping its own pack is refused rather than derived into a path outside it", () => {
        const set = skillsSet(
            { packs: ["a/b"] },
            { pluginRoot: PLUGIN_ROOT, resolve: resolverOver({ "a/b": pack(path.join(PLUGIN_ROOT, "packs", "a", "b"), ["../../../etc/"]) }) },
        );
        assert.equal(set.ok, false);
        assert.equal(set.exitCode, 2);
        assert.match(set.reason, /outside/);
    });
});

describe("an empty set is two questions", () => {
    test("a workspace composing no packs yields an empty set and is OK — that is a legitimate state", () => {
        const set = skillsSet({}, { pluginRoot: PLUGIN_ROOT });
        assert.equal(set.ok, true);
        assert.deepEqual(set.paths, []);
        assert.equal(set.composed, 0);
    });

    test("`packs: []` is the same answer, and is distinguishable from unreadable", () => {
        const set = skillsSet({ packs: [] }, { pluginRoot: PLUGIN_ROOT });
        assert.equal(set.ok, true);
        assert.equal(set.composed, 0);
    });
});

describe("a pack resolving outside the plugin root — the fourth outcome", () => {
    const external = path.resolve("/elsewhere/portulan-checkpoints");

    test("it is reported, not derived, and does not fail the set", () => {
        const set = skillsSet(
            { packs: ["rituals/checkpoints"] },
            { pluginRoot: PLUGIN_ROOT, resolve: resolverOver({ "rituals/checkpoints": pack(external) }) },
        );
        assert.equal(set.ok, true);
        assert.deepEqual(set.paths, []);
        assert.equal(set.external.length, 1);
        assert.equal(set.external[0].pack, "rituals/checkpoints");
    });

    test("it leaves `--check` agreeing, because there is nothing this manifest could declare for it", () => {
        const set = skillsSet(
            { packs: ["rituals/checkpoints"] },
            { pluginRoot: PLUGIN_ROOT, resolve: resolverOver({ "rituals/checkpoints": pack(external) }) },
        );
        const verdict = compare(set, { skills: [] }, PLUGIN_ROOT);
        assert.equal(verdict.agree, true);
    });
});

describe("the declared side — only the pack portion is this tool's business", () => {
    test("entries outside ./packs/ are left alone", () => {
        const portion = packPortion(["./core/skills/", "./plugin/skills/", "./packs/a/b/skills/"], PLUGIN_ROOT);
        assert.deepEqual(portion.inside, ["./packs/a/b/skills/"]);
        assert.equal(portion.outside.length, 2);
    });

    test("a `skills` key that is absent is an empty portion, and one that is not an array is malformed", () => {
        assert.deepEqual(packPortion(undefined, PLUGIN_ROOT).inside, []);
        assert.equal(packPortion("./packs/a/", PLUGIN_ROOT).malformed, true);
    });

    test("trailing-slash and `./`-prefix spellings compare equal", () => {
        const portion = packPortion(["packs/a/b/skills"], PLUGIN_ROOT);
        assert.deepEqual(portion.inside, ["./packs/a/b/skills/"]);
    });
});

describe("compare — drift is named in both directions", () => {
    const derived = {
        ok: true,
        paths: [{ path: "./packs/a/b/skills/", pack: "a/b" }],
        external: [],
        composed: 1,
    };

    test("agreement", () => {
        const v = compare(derived, { skills: ["./core/skills/", "./packs/a/b/skills/"] }, PLUGIN_ROOT);
        assert.equal(v.agree, true);
        assert.deepEqual(v.missing, []);
        assert.deepEqual(v.extra, []);
    });

    test("a composed pack the manifest does not declare is MISSING — the host registers nothing there", () => {
        const v = compare(derived, { skills: ["./core/skills/"] }, PLUGIN_ROOT);
        assert.equal(v.agree, false);
        assert.deepEqual(v.missing, ["./packs/a/b/skills/"]);
    });

    test("a pack path the manifest declares that no composed pack asks for is EXTRA", () => {
        const v = compare(derived, { skills: ["./packs/a/b/skills/", "./packs/z/z/skills/"] }, PLUGIN_ROOT);
        assert.equal(v.agree, false);
        assert.deepEqual(v.extra, ["./packs/z/z/skills/"]);
    });

    test("a malformed `skills` key never reads as agreement", () => {
        const v = compare(derived, { skills: "./packs/a/b/skills/" }, PLUGIN_ROOT);
        assert.equal(v.agree, false);
        assert.match(v.why ?? "", /array/);
    });
});

describe("declaredFor — the array `--write` would put in the manifest", () => {
    test("it preserves the non-pack entries, in their original order, and appends the derived ones", () => {
        const next = declaredFor(
            { ok: true, paths: [{ path: "./packs/a/b/skills/", pack: "a/b" }], external: [], composed: 1 },
            { skills: ["./core/skills/", "./plugin/skills/", "./packs/stale/stale/skills/"] },
            PLUGIN_ROOT,
        );
        assert.deepEqual(next, ["./core/skills/", "./plugin/skills/", "./packs/a/b/skills/"]);
    });

    test("a manifest with no `skills` key gets exactly the derived set", () => {
        const next = declaredFor({ ok: true, paths: [{ path: "./packs/a/b/skills/", pack: "a/b" }], external: [], composed: 1 }, {}, PLUGIN_ROOT);
        assert.deepEqual(next, ["./packs/a/b/skills/"]);
    });
});

describe("--write, and the three rules a tool writing into somebody's tree carries", () => {
    let dir;
    function scratch() {
        dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "skills-set-"));
        SCRATCH.push(dir);
        return dir;
    }

    test("it rewrites only the `skills` array and leaves every other key alone", () => {
        const root = scratch();
        fs.mkdirSync(path.join(root, ".claude-plugin"), { recursive: true });
        // `skills` sits mid-object, so a write that moved it last would fail the key-order assertion.
        const before = { name: "x", skills: ["./core/skills/"], version: "1.0.0", keywords: ["a"] };
        fs.writeFileSync(path.join(root, ".claude-plugin", "plugin.json"), `${JSON.stringify(before, null, 2)}\n`);
        fs.mkdirSync(path.join(root, "packs", "a", "b", "skills"), { recursive: true });

        const code = run(["--write", "--plugin-root", root], {
            stdout: { write() {} },
            stderr: { write() {} },
            manifest: { packs: ["a/b"] },
            resolve: resolverOver({ "a/b": pack(path.join(root, "packs", "a", "b")) }),
        });
        assert.equal(code, 0);
        const after = JSON.parse(fs.readFileSync(path.join(root, ".claude-plugin", "plugin.json"), "utf8"));
        assert.deepEqual(after.skills, ["./core/skills/", "./packs/a/b/skills/"]);
        assert.equal(after.name, "x");
        assert.deepEqual(after.keywords, ["a"]);
        assert.equal(Object.keys(after).join(","), Object.keys(before).join(","), "key order is preserved");
    });

    test("it never CREATES a manifest that is not there — a workspace shipping no plugin is a state, not a hole", () => {
        const root = scratch();
        const code = run(["--write", "--plugin-root", root], {
            stdout: { write() {} },
            stderr: { write() {} },
            manifest: { packs: [] },
            resolve: resolverOver({}),
        });
        assert.equal(code, 2);
        assert.equal(fs.existsSync(path.join(root, ".claude-plugin", "plugin.json")), false);
    });

    test("it refuses a symlinked manifest rather than resolving through it", () => {
        const root = scratch();
        const elsewhere = path.join(root, "elsewhere.json");
        fs.writeFileSync(elsewhere, "{}\n");
        fs.mkdirSync(path.join(root, ".claude-plugin"), { recursive: true });
        fs.symlinkSync(elsewhere, path.join(root, ".claude-plugin", "plugin.json"));
        const code = run(["--write", "--plugin-root", root], {
            stdout: { write() {} },
            stderr: { write() {} },
            manifest: { packs: [] },
            resolve: resolverOver({}),
        });
        assert.equal(code, 2);
        assert.equal(fs.readFileSync(elsewhere, "utf8"), "{}\n", "the link target is untouched");
    });

    test("a symlink ANYWHERE at or below the named plugin root is refused, not just beside the manifest", () => {
        const base = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "skills-set-"));
        SCRATCH.push(base);
        const real = path.join(base, "real");
        fs.mkdirSync(path.join(real, ".claude-plugin"), { recursive: true });
        const manifest = path.join(real, ".claude-plugin", "plugin.json");
        fs.writeFileSync(manifest, `${JSON.stringify({ name: "x", skills: [] }, null, 2)}\n`);
        const linked = path.join(base, "linked");
        fs.symlinkSync(real, linked);

        const code = run(["--write", "--plugin-root", linked], {
            stdout: { write() {} },
            stderr: { write() {} },
            manifest: { packs: [] },
            resolve: resolverOver({}),
        });
        assert.equal(code, 2);
        assert.equal(fs.readFileSync(manifest, "utf8"), `${JSON.stringify({ name: "x", skills: [] }, null, 2)}\n`);
    });

    test("a manifest that will not parse is could-not-run, never overwritten", () => {
        const root = scratch();
        fs.mkdirSync(path.join(root, ".claude-plugin"), { recursive: true });
        const file = path.join(root, ".claude-plugin", "plugin.json");
        fs.writeFileSync(file, "{ not json\n");
        const code = run(["--write", "--plugin-root", root], {
            stdout: { write() {} },
            stderr: { write() {} },
            manifest: { packs: [] },
            resolve: resolverOver({}),
        });
        assert.equal(code, 2);
        assert.equal(fs.readFileSync(file, "utf8"), "{ not json\n");
    });
});

describe("the workspace manifest: absent, unreadable and unparseable are three answers", () => {
    function runWith(contents) {
        const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "skills-set-"));
        SCRATCH.push(root);
        fs.mkdirSync(path.join(root, ".portulan"), { recursive: true });
        if (contents !== null) fs.writeFileSync(path.join(root, ".portulan", "workspace.json"), contents);
        let said = "";
        const code = run(["--plugin-root", root, "--workspace", path.join(root, ".portulan")], {
            stdout: { write() {} },
            stderr: { write(s) { said += s; } },
        });
        return { code, said };
    }

    test("a manifest that will not parse says so, and does not blame the read", () => {
        const { code, said } = runWith("{ not json\n");
        assert.equal(code, 2);
        assert.match(said, /does not parse as JSON/);
        assert.doesNotMatch(said, /could not be read/);
    });

    test("a manifest that is not there still reports a read failure", () => {
        const { code, said } = runWith(null);
        assert.equal(code, 2);
        assert.match(said, /could not be read — ENOENT/);
    });
});

describe("--check", () => {
    function checkAgainst(skills, packs, table) {
        const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "skills-set-"));
        SCRATCH.push(root);
        fs.mkdirSync(path.join(root, ".claude-plugin"), { recursive: true });
        fs.writeFileSync(
            path.join(root, ".claude-plugin", "plugin.json"),
            `${JSON.stringify({ name: "x", skills }, null, 2)}\n`,
        );
        const resolved = Object.fromEntries(
            Object.entries(table).map(([ref, rel]) => [ref, pack(path.join(root, rel))]),
        );
        return run(["--check", "--plugin-root", root], {
            stdout: { write() {} },
            stderr: { write() {} },
            manifest: { packs },
            resolve: resolverOver(resolved),
        });
    }

    test("agreement exits 0", () => {
        assert.equal(checkAgainst(["./packs/a/b/skills/"], ["a/b"], { "a/b": "packs/a/b" }), 0);
    });

    test("a composed pack the manifest does not declare exits 1 — drift, not could-not-run", () => {
        assert.equal(checkAgainst([], ["a/b"], { "a/b": "packs/a/b" }), 1);
    });

    test("a pack that cannot resolve exits 2, and never 1 — nobody looked outranks we looked and it was bad", () => {
        assert.equal(checkAgainst([], ["a/b"], {}), 2);
    });
});

// ------------------------------------------------ `--pack-root auto`

describe("`--pack-root auto` reaches discovery here, and refuses to be combined with a named root", () => {
    const scratch = () => {
        const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "skills-set-auto-"));
        SCRATCH.push(dir);
        return dir;
    };

    function host(packId) {
        const config = scratch();
        const installPath = path.join(config, "plugins", "cache", "feed", "carrier", "0.1.0");
        const [category, name] = packId.split("/");
        const packDir = path.join(installPath, "packs", category, name);
        fs.mkdirSync(path.join(packDir, "skills", "a-skill"), { recursive: true });
        fs.writeFileSync(
            path.join(packDir, "pack.json"),
            JSON.stringify({ portulan: { pack: "1.0", version: "0.1.0" }, name, category, summary: "x", doc: "README.md", contributes: { skills: ["skills/"] } }),
        );
        fs.writeFileSync(path.join(packDir, "README.md"), "# x\n");
        fs.writeFileSync(path.join(packDir, "skills", "a-skill", "SKILL.md"), "---\nname: a-skill\ndescription: x\n---\n");
        const record = path.join(config, "plugins", "installed_plugins.json");
        fs.mkdirSync(path.dirname(record), { recursive: true });
        fs.writeFileSync(record, JSON.stringify({ version: 2, plugins: { "carrier@feed": [{ scope: "user", installPath, version: "0.1.0" }] } }));
        return config;
    }

    /** A workspace composing that pack and deriving NO root of its own, so only discovery can answer. */
    function workspace() {
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
        fs.writeFileSync(
            path.join(dir, ".portulan", "workspace.json"),
            JSON.stringify({ portulan: { spec: "2.8" }, name: "w", kind: "demo", packs: ["rituals/checkpoints"] }),
        );
        return dir;
    }

    function withHost(config, fn) {
        const before = process.env.CLAUDE_CONFIG_DIR;
        process.env.CLAUDE_CONFIG_DIR = config;
        try {
            return fn();
        } finally {
            if (before === undefined) delete process.env.CLAUDE_CONFIG_DIR;
            else process.env.CLAUDE_CONFIG_DIR = before;
        }
    }

    test("discovery is CONSULTED on both paths since the disposal — `auto` insists, it no longer unlocks", () => {
        const config = host("rituals/checkpoints");
        const dir = workspace();
        const said = [];
        const io = { stdout: { write: (s) => said.push(s) }, stderr: { write: (s) => said.push(s) } };

        const without = withHost(config, () => run(["--workspace", path.join(dir, ".portulan"), "--check"], io));
        assert.notEqual(without, 2, `discovery should have answered unasked — ${said.join("")}`);

        said.length = 0;
        const withAuto = withHost(config, () => run(["--workspace", path.join(dir, ".portulan"), "--pack-root", "auto", "--check"], io));
        assert.notEqual(withAuto, 2, `discovery should have answered — ${said.join("")}`);

        said.length = 0;
        const emptyHost = withHost(scratch(), () => run(["--workspace", path.join(dir, ".portulan"), "--check"], io));
        assert.equal(emptyHost, 2, `a pack nothing can reach is still could-not-run — ${said.join("")}`);
    });

    test("the pair is refused BEFORE the workspace manifest is read", () => {
        const said = [];
        const io = { stdout: { write: (s) => said.push(s) }, stderr: { write: (s) => said.push(s) } };
        const absent = path.join(scratch(), "no-workspace-here");
        const code = run(["--workspace", absent, "--pack-root", "auto", "--pack-root", ".", "--check"], io);
        assert.equal(code, 2);
        assert.match(said.join(""), /never both/, "the refusal must be the reason, not the missing manifest");
    });

    test("a named root AND `auto` is refused here too, in the one shared sentence", () => {
        const config = host("rituals/checkpoints");
        const dir = workspace();
        const said = [];
        const io = { stdout: { write: (s) => said.push(s) }, stderr: { write: (s) => said.push(s) } };
        const code = withHost(config, () =>
            run(["--workspace", path.join(dir, ".portulan"), "--pack-root", "auto", "--pack-root", dir, "--check"], io),
        );
        assert.equal(code, 2);
        assert.match(said.join(""), /never both/);
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

test("skills-set: `auto` against an unreadable record is exit 2", () => {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "skills-set-unreadable-ws-"));
    SCRATCH.push(dir);
    fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), JSON.stringify({
        portulan: { spec: "2.8" }, name: "w", kind: "demo", packs: ["rituals/checkpoints"],
    }));
    const config = unreadableHost(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "skills-set-host-")));
    SCRATCH.push(config);
    const said = [];
    const io = { stdout: { write: (x) => said.push(x) }, stderr: { write: (x) => said.push(x) } };
    assert.equal(withEnv(config, () => run(["--workspace", path.join(dir, ".portulan"), "--pack-root", "auto", "--check"], io)), 2, said.join(""));
    // Only the message tells: an unresolvable pack also exits 2 and also says "could not be read".
    assert.match(said.join(""), /Discovery could not look/);
});

// ------------------------------------------------ a pack two roots answer for

describe("a shadowed pack is refused, not picked (#317)", () => {
    const TMP = fs.realpathSync(os.tmpdir());
    const scratch = (tag) => {
        const dir = fs.mkdtempSync(path.join(TMP, `skills-set-shadow-${tag}-`));
        SCRATCH.push(dir);
        return dir;
    };

    function carrier(base, version, gates) {
        const at = path.join(base, "rituals", "checkpoints");
        fs.mkdirSync(path.join(at, "skills", "a-skill"), { recursive: true });
        fs.writeFileSync(
            path.join(at, "pack.json"),
            JSON.stringify({
                portulan: { pack: "1.0", version },
                name: "rituals/checkpoints",
                category: "rituals",
                summary: "x",
                doc: "README.md",
                contributes: { skills: ["skills/"], gates },
            }),
        );
        fs.writeFileSync(path.join(at, "README.md"), "# x\n");
        fs.writeFileSync(path.join(at, "skills", "a-skill", "SKILL.md"), "---\nname: a-skill\ndescription: x\n---\n");
        return at;
    }

    const SHELL = [{ id: "commit-without-the-hooks", tier: "gated", action: { shell: "git commit --no-verify" }, reason: "x" }];
    const NONE = [{ id: "commit-without-the-hooks", tier: "gated", action: { none: "No honest matcher." }, reason: "x" }];

    function world({ treeGates = NONE, cacheGates = SHELL, treeVersion = "0.2.1", cacheVersion = "0.2.0", tree = "../" } = {}) {
        const root = scratch("repo");
        fs.mkdirSync(path.join(root, ".portulan"), { recursive: true });
        fs.writeFileSync(
            path.join(root, ".portulan", "workspace.json"),
            JSON.stringify({ portulan: { spec: "2.8" }, name: "w", kind: "repository", tree, packs: ["rituals/checkpoints"] }),
        );
        carrier(path.resolve(path.join(root, ".portulan"), tree, "packs"), treeVersion, treeGates);
        const cache = scratch("cache");
        carrier(cache, cacheVersion, cacheGates);
        fs.mkdirSync(path.join(root, ".claude-plugin"), { recursive: true });
        fs.writeFileSync(
            path.join(root, ".claude-plugin", "plugin.json"),
            `${JSON.stringify({ name: "x", skills: ["./packs/rituals/checkpoints/skills/"] }, null, 2)}\n`,
        );
        return { root, cache, manifest: path.join(root, ".claude-plugin", "plugin.json") };
    }

    const invoke = (root, cache, argv) => {
        let said = "";
        const code = run(
            ["--workspace", path.join(root, ".portulan"), "--repo-root", root, "--plugin-root", root, ...argv],
            {
                stdout: { write(s) { said += s; } },
                stderr: { write(s) { said += s; } },
                discovery: () => ({ ok: true, roots: [cache], why: null }),
            },
        );
        return { code, said };
    };

    test("unpinned --check REFUSES, and the message names both roots and both spellings", () => {
        const { root, cache } = world();
        const { code, said } = invoke(root, cache, ["--check"]);
        assert.equal(code, 2, said);
        assert.match(said, /SHADOWED/);
        assert.ok(said.includes(cache), `the discovered root must be named — ${said}`);
        assert.ok(
            !said.includes(path.join(cache, "rituals", "checkpoints")),
            `the discovered PACK DIRECTORY must not be printed as the root — ${said}`,
        );
        assert.match(said, /the root packs /, `the tree root must be named as \`packs\` — ${said}`);
        assert.doesNotMatch(said, /packs\/rituals\/checkpoints/);
        assert.match(said, /--pack-root packs/);
        assert.match(said, /--pack-root auto/);
        assert.match(said, /gate fragments that differ once parsed/);
    });

    test("an AGREEING shadow still refuses, and gives this tool's own reason for it", () => {
        const { root, cache } = world({ treeGates: NONE, cacheGates: NONE, treeVersion: "0.2.1", cacheVersion: "0.2.1" });
        const { code, said } = invoke(root, cache, ["--check"]);
        assert.equal(code, 2, said);
        assert.match(said, /Their manifests agree/);
        assert.match(said, /opposite sides of this plugin root/);
        assert.doesNotMatch(said, /They differ by/);
    });

    test("--write REFUSES, and the tracked manifest is byte-identical afterwards", () => {
        const { root, cache, manifest } = world();
        const before = fs.readFileSync(manifest, "utf8");
        const { code, said } = invoke(root, cache, ["--write"]);
        assert.equal(code, 2, said);
        assert.equal(fs.readFileSync(manifest, "utf8"), before, "the artifact must not be touched");
    });

    test("a NAMED root does not refuse — it answered the question the refusal asks", () => {
        const { root, cache } = world();
        const { code, said } = invoke(root, cache, ["--pack-root", path.join(root, "packs"), "--check"]);
        assert.equal(code, 0, said);
    });

    test("`--pack-root auto` does not refuse either — discovery ELECTED is a choice, not an ambiguity", () => {
        // 1, drift: the elected copy is outside the plugin root, so the tracked declaration is unowned.
        const { root, cache } = world();
        const { code, said } = invoke(root, cache, ["--pack-root", "auto", "--check"]);
        assert.equal(code, 1, said);
        assert.doesNotMatch(said, /SHADOWED/);
    });

    test("an unreadable copy and an unparseable one are two sentences, not one", () => {
        const { root, cache } = world();
        const broken = path.join(cache, "rituals", "checkpoints", "pack.json");
        fs.writeFileSync(broken, "{ not json\n");
        const bad = invoke(root, cache, ["--check"]);
        assert.equal(bad.code, 2, bad.said);
        assert.match(bad.said, /does not parse as JSON/);
        assert.doesNotMatch(bad.said, /could not be read/);
        // The phrase, not the path: the opening clause prints the cache root either way.
        assert.ok(
            bad.said.includes(`the copy under ${cache} `),
            `the message must name WHICH copy is broken — ${bad.said}`,
        );

        const t = world();
        fs.writeFileSync(path.join(t.root, "packs", "rituals", "checkpoints", "pack.json"), "{ not json\n");
        const treeBroken = invoke(t.root, t.cache, ["--check"]);
        assert.equal(treeBroken.code, 2, treeBroken.said);
        assert.match(treeBroken.said, /does not parse as JSON/);
        assert.ok(
            treeBroken.said.includes("the copy under packs "),
            `the tree copy must be named as the broken one — ${treeBroken.said}`,
        );

        // A removed pack.json is no copy: `resolvePack` matches on the file existing, so nothing shadows.
        const gone = world();
        fs.rmSync(path.join(gone.cache, "rituals", "checkpoints", "pack.json"));
        const missing = invoke(gone.root, gone.cache, ["--check"]);
        assert.equal(missing.code, 0, missing.said);
        assert.doesNotMatch(missing.said, /does not parse as JSON/);
    });

    test("the tree spelling it hands back is the root it named, not the conventional guess", () => {
        const { root, cache } = world({ tree: "../nested/" });
        const { code, said } = invoke(root, cache, ["--check"]);
        assert.equal(code, 2, said);
        assert.match(said, /`--pack-root nested\/packs` derives from the tree/, said);
        assert.doesNotMatch(said, /`--pack-root packs`/, said);
        // `verify/plugin.sh` passes the literal `--pack-root packs`, so no other root may claim it.
        assert.doesNotMatch(said, /verify\/plugin\.sh/, said);

        const conv = world();
        const c = invoke(conv.root, conv.cache, ["--check"]);
        assert.match(c.said, /`--pack-root packs` derives from the tree, which is what `verify\/plugin\.sh` checks/, c.said);
    });

    test("no second copy, no refusal — the control that keeps the rest from passing for the wrong reason", () => {
        const { root } = world();
        const empty = scratch("empty");
        const { code, said } = invoke(root, empty, ["--check"]);
        assert.equal(code, 0, said);
        assert.doesNotMatch(said, /SHADOWED/);
    });
});
