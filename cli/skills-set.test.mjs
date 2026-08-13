// The registrable set — what a plugin manifest must declare so a composed pack's skills register.
//
//   node --test "cli/**/*.test.mjs"
//
// Row 7 clause (b)'s adopter half, issue #184: *the generator that derives a plugin's `skills` from a
// workspace's `packs`*. Until this landed, registration was a property of `.claude-plugin/plugin.json`
// and of nothing else — measured 2026-08-09 on Claude Code 2.1.226 by deleting the `packs` key from
// the governing workspace and reinstalling, which changed the host's inventory not at all — so a
// composed pack's skill was invocable **by coincidence of a hand-written path**.
//
// ## Written against the shape `recipe-set` established, and against the defects it recorded
//
// Every refusal below has a sibling in `cli/recipe-set.test.mjs`, and each of those was found by a
// Copilot round rather than by design: a `packs` that is not an array iterates CHARACTERS and reports
// a pack the manifest never named; a `contributes.<key>` that is present and not an array throws a
// TypeError where the contract is exit 2 with a sentence; a pack that cannot resolve must be
// could-not-run rather than a quietly smaller set. They are asserted here rather than trusted to have
// been learned.
//
// ## The one place this carrier's contract differs from the recipe set's, deliberately
//
// `recipeSet` REFUSES an empty set — a workspace that yields no verify recipe cannot report green.
// Here an empty set is legitimate: **a workspace may compose no packs at all**, and that is a
// different answer from *nothing could be read*. An empty set is two questions
// (`../.portulan/memory/verify-preconditions-fail-closed.md`), and the carrier answers the one it
// actually knows — gated on examination, never on emptiness.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { HOST_SKILL_DEPTH, skillsSet, packPortion, compare, declaredFor, canonical, run } from "./skills-set.mjs";

// A HERMETIC HOST. The tools consult the host's installed-plugin record on the UNASKED path as of
// 2026-08-13, so a suite that does not neutralise it reads the machine it runs on and a fixture's
// verdict moves with what somebody has installed. Swept by `pinned-roots.live.test.mjs`, whose header
// carries the argument and the limit. A case that wants a host passes `env:` explicitly, which wins.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

/** A resolver over an in-memory table, mirroring `resolverFor`'s return shape (root ABSOLUTE). */
function resolverOver(table) {
    return (ref) => (Object.hasOwn(table, ref) ? table[ref] : null);
}

/** A pack that declares one skills root. */
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
        // `packs/tools/github` is exactly this shape: it contributes `verify` and nothing else.
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
        // The equivalence the derivation rests on. A root that IS one skill registers at depth 0 and a
        // root that CONTAINS them registers them at depth 1, so declaring the root reaches both — which
        // is only true while HOST_SKILL_DEPTH is at least 1. Asserted as the property rather than as
        // `1 <= 1`, which was a tautology dressed as a check: it restated line 112 and would have gone
        // on passing if the derivation started emitting a parent or a child. Raised at the pre-commit
        // checkpoint.
        assert.ok(HOST_SKILL_DEPTH >= 1, "a host reaching zero levels could not register a root of skills");
        const packDir = path.join(PLUGIN_ROOT, "packs", "a", "b");
        const set = skillsSet({ packs: ["a/b"] }, { pluginRoot: PLUGIN_ROOT, resolve: resolverOver({ "a/b": pack(packDir, ["skills/"]) }) });
        assert.equal(set.paths[0].path, canonical(path.relative(PLUGIN_ROOT, path.join(packDir, "skills"))));
    });
});

describe("one partition, so --check converges and --write is idempotent", () => {
    // The blocking finding of this session's pre-commit checkpoint, pinned in both the unit and the
    // end-to-end shape. The derivation emitted a path for any pack inside the plugin root while the
    // declared side recognised only `<pluginRoot>/packs`, so a `tree` pointing anywhere else produced a
    // path that was derived and never recognised as derived: `--check` reported the same drift forever
    // and `--write` appended a duplicate every run. This repository's own layout makes the two
    // partitions coincide, which is why every other test passed over it.
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
        // `--pack-root <pluginRoot>` puts packs at `<pluginRoot>/<category>/<name>`, so the resolution
        // root IS the plugin root and every declared path — `./core/skills/` included — reads as a pack
        // path. `--check` called it uncomposed and `--write` DELETED it: the contract's "preserved
        // verbatim" turned into data loss, one flag away. Raised at the pre-commit re-check.
        const set = skillsSet(
            { packs: ["rituals/demo"] },
            { pluginRoot: PLUGIN_ROOT, resolve: resolverOver({ "rituals/demo": pack(path.join(PLUGIN_ROOT, "rituals", "demo")) }) },
        );
        assert.equal(set.ok, false);
        assert.equal(set.exitCode, 2);
        assert.match(set.reason, /contains the plugin root/);
    });

    test("a FALLBACK root containing the plugin root is refused too — the guard's sibling site", () => {
        // With no packs composed the derived set is empty, so an owned set of `[pluginRoot]` made every
        // declared entry pack-owned and `--write` DELETED `./core/skills/` and `./plugin/skills/`,
        // exiting 0 and announcing "wrote 0 skills path(s)". Silent data loss, reachable with
        // `--pack-root <pluginRoot>`. The guard existed on the resolved-pack arm and not on this one —
        // the third instance in this change of a fix landing at one site of an operation and not its
        // sibling. Raised by Copilot on #229.
        const set = skillsSet({ packs: [] }, { pluginRoot: PLUGIN_ROOT, fallbackRoots: [PLUGIN_ROOT] });
        assert.equal(set.ok, false);
        assert.equal(set.exitCode, 2);
        assert.match(set.reason, /contains the plugin root/);
    });

    test("the fallback owned set follows the caller's resolution roots, not the conventional path", () => {
        // A workspace that has STOPPED composing still needs its stale entries cleaned wherever its
        // packs would have been. Falling straight to `<pluginRoot>/packs` did that only for the
        // conventional layout — layout-dependence in the fallback of a fix about layout-dependence.
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
        // With nothing resolved there is no root to derive, so the conventional one stands in —
        // otherwise a stale `./packs/x/y/skills/` would be preserved forever because nothing pointed at
        // it any more.
        const set = skillsSet({ packs: [] }, { pluginRoot: PLUGIN_ROOT });
        assert.deepEqual(set.owned, [path.join(PLUGIN_ROOT, "packs")]);
        assert.deepEqual(declaredFor(set, { skills: ["./core/skills/", "./packs/x/y/skills/"] }, PLUGIN_ROOT), ["./core/skills/"]);
    });
});

describe("the refusals — could-not-run, never a quietly smaller set", () => {
    test("`packs` that is not an array is exit 2, not a set computed from something nothing can enumerate", () => {
        // A string here would iterate CHARACTERS and report "the pack `r` could not be resolved" — a
        // refusal naming something the manifest never said. recipe-set's Copilot round 3.
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
        // Both are could-not-run, and saying "could not be resolved" about a pack sitting exactly where
        // it should be sends the reader to check roots and spelling instead of the file. `resolverFor`
        // collapsed the two into `null`; it now reports why. Raised as a promoted low-confidence note
        // on #229.
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
        // A resolver that silently is not there would derive nothing and report an empty set — the
        // fail-open recipe-set names in its own JSDoc.
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
    // Session-open finding 8. Both of this repository's packs resolve in-tree, but the adopter case
    // plugin-cache discovery exists FOR — a pack resolved out of the host's cache — resolves fine and
    // has no path expressible relative to the plugin root. It is not drift, not could-not-run, and
    // must not be silence: it registers through its own plugin or not at all.
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
        return dir;
    }

    test("it rewrites only the `skills` array and leaves every other key alone", () => {
        const root = scratch();
        fs.mkdirSync(path.join(root, ".claude-plugin"), { recursive: true });
        // `skills` sits in the MIDDLE deliberately. With it last, the assertion below could not fail
        // for the reason it exists — a `--write` that moved the key to the end would still match — so
        // the test was pinning nothing about order. Raised as a suppressed note on #229, alongside a
        // second note claiming the spread DOES move it. This fixture is what settles that: it does not,
        // because re-assigning an existing string key keeps its insertion position, and the key is
        // appended only when the manifest had none.
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
        // The first cut lstat'd `dirname(file)` and `file` only, so a symlinked `--plugin-root` was
        // resolved straight through and this tool wrote into whatever it pointed at — `init`'s own
        // failure at nine files written into an unrelated directory and reported as success. Raised at
        // the pre-commit checkpoint. The rule is `cli/new.mjs`'s: above the named path resolve, at it
        // and below refuse.
        const base = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "skills-set-"));
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
    // Raised by Copilot on #229. A `SyntaxError` from `JSON.parse` carries no `.code`, so the arm that
    // reported `error.code ?? error.message` under "could not be read" told an adopter with a malformed
    // manifest to go looking at permissions. Both messages are asserted, because the repair is the
    // sentence and a test on the exit code alone would pass over it.
    function runWith(contents) {
        const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "skills-set-"));
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

// ------------------------------------------------ `--pack-root auto`: the arm that was inert

describe("`--pack-root auto` reaches discovery here, and refuses to be combined with a named root", () => {
    // Both cases exist because a pre-commit checkpoint's own mutations survived this file. The fix
    // for the inert-`auto` defect — the one this change names in its CHANGELOG — could be reverted
    // verbatim and 1515 tests stayed green, because nothing here passed `auto` at all. A headline fix
    // with no binding test is a fix that comes back.

    const scratch = () => fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "skills-set-auto-"));

    /** A host whose plugin cache carries one repository-shaped install with `packs/`. */
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
        // **This case pinned the clause under disposal and is re-derived rather than adjusted.** Its
        // title was *"a pack only discovery can reach is found under it and NOT WITHOUT it"*, and the
        // second half was precisely `--pack-root` failing to be *optional where discovery finds a root*:
        // measured 2026-08-13, this exact shape made `skills-set --check` exit **2** with no flag, which
        // is a hard block rather than a worse verdict. The first half is untouched and still asserted.
        const config = host("rituals/checkpoints");
        const dir = workspace();
        const said = [];
        const io = { stdout: { write: (s) => said.push(s) }, stderr: { write: (s) => said.push(s) } };

        // Unasked: the workspace derives no root, and discovery answers anyway. Not exit 2 — the pack
        // was READ, so whatever this returns is a verdict about the registrable set rather than a
        // refusal to compute one.
        const without = withHost(config, () => run(["--workspace", path.join(dir, ".portulan"), "--check"], io));
        assert.notEqual(without, 2, `discovery should have answered unasked — ${said.join("")}`);

        // With `auto`: the same answer. `forced` still carries the request into `resolutionRoots`, and
        // asking is now a way of insisting rather than the only way of reaching.
        said.length = 0;
        const withAuto = withHost(config, () => run(["--workspace", path.join(dir, ".portulan"), "--pack-root", "auto", "--check"], io));
        assert.notEqual(withAuto, 2, `discovery should have answered — ${said.join("")}`);

        // **The control that keeps this from passing for the wrong reason.** On a host with nothing
        // installed the pack is unreachable from anywhere, and THAT is still could-not-run — so the two
        // assertions above are about discovery answering, not about this tool having stopped refusing.
        said.length = 0;
        const emptyHost = withHost(scratch(), () => run(["--workspace", path.join(dir, ".portulan"), "--check"], io));
        assert.equal(emptyHost, 2, `a pack nothing can reach is still could-not-run — ${said.join("")}`);
    });

    test("the pair is refused BEFORE the workspace manifest is read", () => {
        // The sibling of Copilot's round-2 finding in `compile`, swept in the same stroke. It sat
        // below the manifest read here too, so an unreadable workspace answered first.
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

// A host whose plugin record EXISTS and will not parse — could-not-look, not absence.
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
    fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), JSON.stringify({
        portulan: { spec: "2.8" }, name: "w", kind: "demo", packs: ["rituals/checkpoints"],
    }));
    const config = unreadableHost(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "skills-set-host-")));
    const said = [];
    const io = { stdout: { write: (x) => said.push(x) }, stderr: { write: (x) => said.push(x) } };
    assert.equal(withEnv(config, () => run(["--workspace", path.join(dir, ".portulan"), "--pack-root", "auto", "--check"], io)), 2, said.join(""));
    // Exit 2 alone cannot bind this: a pack that will not resolve is could-not-run here BY CONTRACT,
    // so the code is 2 whether or not the mapping exists. The message is the discriminator — with the
    // mapping it names the unreadable record; without it, it names an unresolvable pack.
    // `could not be read` appears in the UNRESOLVABLE-PACK sentence too, so it discriminates
    // nothing; `Discovery could not look` is only ever the discovery diagnostic. Measured by
    // mutating the mapping away and reading what the other path actually says.
    assert.match(said.join(""), /Discovery could not look/);
});
