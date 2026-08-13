// The registrable set, against THIS repository rather than against fixtures.
//
//   node --test "cli/**/*.test.mjs"
//
// `skills-set.test.mjs` covers the carrier's logic with a fixture resolver. This file exists because
// that is not enough, and the gap is not hypothetical — it was measured on the sibling carrier.
//
// `compile.mjs`'s `resolvePack` returns `manifest` as the **path** to `pack.json`, not as the parsed
// object. The first cut of `recipe-set.mjs`'s `resolverFor` treated it as parsed, so every composed
// pack contributed nothing — and its unit suite stayed green, because the fixture resolver returned a
// parsed object and therefore encoded the same assumption the code made. **A harness you write to
// check your own change inherits your change's blind spot**, which this project has now measured
// **seven** times: that resolver, a discovery draft that probed one plugin layout and found neither
// plugin its own feed ships, a persona-name traversal whose fixtures all used slug names, two more
// before them — and **two in the session that added this file**, a new rail no fixture exercised and a
// partition every green here was blind to. This file undercounted by exactly its own session until the
// pre-commit re-check said so; the ledger is `docs/milestones/m07.md`.
//
// So these assertions run the real derivation over the real workspace manifest, resolving the real
// packs out of the real tree, and compare against the real plugin manifest.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { skillsSet, resolverFor, compare, canonical, manifestPath, HOST_SKILL_DEPTH } from "./skills-set.mjs";
import os from "node:os";

// A HERMETIC HOST. The tools consult the host's installed-plugin record on the UNASKED path as of
// 2026-08-13, so a suite that does not neutralise it reads the machine it runs on and a fixture's
// verdict moves with what somebody has installed. Swept by `pinned-roots.live.test.mjs`, whose header
// carries the argument and the limit. A case that wants a host passes `env:` explicitly, which wins.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE = path.join(REPO, ".portulan");
const manifest = JSON.parse(fs.readFileSync(path.join(WORKSPACE, "workspace.json"), "utf8"));
const plugin = JSON.parse(fs.readFileSync(manifestPath(REPO), "utf8"));

function live() {
    return skillsSet(manifest, { pluginRoot: REPO, resolve: resolverFor({ workspaceDir: WORKSPACE, manifest }) });
}

describe("this workspace's own registrable set", () => {
    test("every pack this workspace composes resolves — an unresolvable one is could-not-run, not a quiet loss", () => {
        const set = live();
        assert.equal(set.ok, true, set.ok ? "" : `derivation failed: ${set.reason}`);
    });

    test("the derived set is exactly what `.claude-plugin/plugin.json` already declares for packs", () => {
        // The equality this session exists to produce: the entry was hand-typed and correct, and is
        // now DERIVED and correct. If this ever fails it means the two have parted — which is the
        // silent state #184 was filed about, made loud.
        const verdict = compare(live(), plugin, REPO);
        assert.equal(verdict.agree, true, `missing: ${verdict.missing.join(", ")} · extra: ${verdict.extra.join(", ")}`);
    });

    test("the checkpoints pack contributes its skills root, and it is the one the manifest names", () => {
        const set = live();
        const checkpoints = set.paths.filter((p) => p.pack === "rituals/checkpoints");
        assert.equal(checkpoints.length, 1);
        assert.equal(checkpoints[0].path, "./packs/rituals/checkpoints/skills/");
        assert.ok(plugin.skills.map(canonical).includes(checkpoints[0].path));
    });

    test("a pack contributing no skills contributes none — `tools/github` is composed and adds nothing", () => {
        // Guards the arm that would turn "declares no skills" into an error, which would make the
        // honest pack red. `tools/github` contributes `verify` only, by its own manifest.
        const set = live();
        assert.ok(manifest.packs.includes("tools/github"), "this test is about a pack this workspace composes");
        assert.equal(set.paths.some((p) => p.pack === "tools/github"), false);
    });

    test("nothing in this repository resolves outside the plugin root", () => {
        // Not a claim that the external arm is dead code — it is the adopter case, exercised in the
        // unit suite. This pins that THIS bundle does not take it, so a future in-tree change that
        // starts resolving a pack out of the cache is visible rather than silent.
        assert.deepEqual(live().external, []);
    });
});

describe("the derived paths are real, and reach the host", () => {
    test("every derived path is a directory that exists in this tree", () => {
        for (const { path: p } of live().paths) {
            const dir = path.join(REPO, p);
            assert.ok(fs.existsSync(dir), `${p} does not exist`);
            assert.ok(fs.statSync(dir).isDirectory(), `${p} is not a directory`);
        }
    });

    test("every derived root is host-reachable in one of the two shapes, and which one is asserted", () => {
        // The equivalence the derivation rests on, checked against the tree rather than asserted about
        // a constant: a `SKILL.md` under a derived root is at depth 0 (the root IS the skill) or depth
        // 1 (the root CONTAINS them). A skill deeper than HOST_SKILL_DEPTH would be packaged, counted
        // and inert — `plugin-lint` is what fails it, and this pins that the derivation does not CREATE
        // that state.
        //
        // The first cut iterated subdirectories only, so the **depth-0 shape asserted nothing**: a root
        // that is itself a skill has no subdirectories, the loop ran zero times, and the test passed
        // while claiming to have checked both. A test that cannot fail on half its own subject —
        // the same class as the tautology the pre-commit checkpoint caught one file over. Raised by
        // Copilot on #229.
        const seen = { root: 0, nested: 0 };
        for (const { path: p } of live().paths) {
            const root = path.join(REPO, p);
            if (fs.existsSync(path.join(root, "SKILL.md"))) {
                seen.root += 1;
                continue;
            }
            const children = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory());
            assert.ok(
                children.length > 0,
                `${p} holds neither a SKILL.md nor a skill directory — nothing there would register`,
            );
            for (const entry of children) {
                assert.ok(
                    fs.existsSync(path.join(root, entry.name, "SKILL.md")),
                    `${p}${entry.name}/ holds no SKILL.md — a skill below the host's ${HOST_SKILL_DEPTH} level would not register`,
                );
                seen.nested += 1;
            }
        }
        // Which shape this repository actually exercises, stated rather than left implicit: every
        // derived root here CONTAINS its skills. If that ever changes the count moves, and a reader
        // learns it from a failure rather than from re-reading the loop.
        assert.equal(seen.root, 0, "no derived root in this tree is itself a skill");
        assert.ok(seen.nested > 0, "the depth-1 shape must actually have been exercised, not vacuously skipped");
    });
});
