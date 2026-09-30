// The registrable set, against THIS repository rather than against fixtures.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { skillsSet, resolverFor, compare, canonical, manifestPath, HOST_SKILL_DEPTH } from "./skills-set.mjs";
import os from "node:os";

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
        const set = live();
        assert.ok(manifest.packs.includes("tools/github"), "this test is about a pack this workspace composes");
        assert.equal(set.paths.some((p) => p.pack === "tools/github"), false);
    });

    test("nothing in this repository resolves outside the plugin root", () => {
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
        assert.equal(seen.root, 0, "no derived root in this tree is itself a skill");
        assert.ok(seen.nested > 0, "the depth-1 shape must actually have been exercised, not vacuously skipped");
    });
});
