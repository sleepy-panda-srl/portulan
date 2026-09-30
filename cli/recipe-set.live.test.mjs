// The composed recipe set, against THIS repository rather than against fixtures.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { recipeSet, resolverFor, composedId } from "./recipe-set.mjs";
import os from "node:os";

// This suite imports `./recipe-set.mjs`, which can read the host's installed-plugin record: point it at none.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE = path.join(REPO, ".portulan");
const manifest = JSON.parse(fs.readFileSync(path.join(WORKSPACE, "workspace.json"), "utf8"));

function live() {
    return recipeSet(manifest, { resolve: resolverFor({ workspaceDir: WORKSPACE, manifest, repoRoot: REPO }) });
}

describe("this workspace's own composed set", () => {
    test("every pack this workspace composes resolves — an unresolvable one is could-not-run, not a quiet loss", () => {
        const set = live();
        assert.equal(set.ok, true, set.ok ? "" : `composition failed: ${set.reason}`);
    });

    test("the workspace's own nine recipes are all present and unchanged", () => {
        const set = live();
        const own = set.recipes.filter((r) => r.source.kind === "workspace").map((r) => r.id);
        assert.deepEqual(own, manifest.verify.recipes.map((r) => r.id));
    });

    test("`tools/github` contributes its recipe, namespaced, into the runnable set", () => {
        const set = live();
        const id = composedId("tools/github", "actions-pinned");
        const composed = set.recipes.find((r) => r.id === id);
        assert.ok(composed, `expected ${id} in the composed set, got: ${set.recipes.map((r) => r.id).join(", ")}`);
        assert.equal(composed.source.kind, "pack");
        assert.equal(composed.source.pack, "tools/github");
    });

    test("the composed run is expanded and points at a file that exists", () => {
        const set = live();
        const composed = set.recipes.find((r) => r.source.kind === "pack");
        assert.doesNotMatch(composed.run, /\$\{PACK_ROOT\}/, "`${PACK_ROOT}` must be expanded before anyone sees the command");
        const script = composed.run.split(/\s+/).find((word) => word.endsWith(".sh"));
        assert.ok(script, `no script path found in ${JSON.stringify(composed.run)}`);
        assert.ok(fs.existsSync(path.join(REPO, script)), `${script} does not exist relative to the repository root`);
    });

    test("`rituals/checkpoints` resolves and contributes NO recipe, which is not an error", () => {
        const set = live();
        assert.ok(manifest.packs.includes("rituals/checkpoints"));
        assert.equal(set.recipes.filter((r) => r.source.pack === "rituals/checkpoints").length, 0);
    });

    test("no composed recipe is the workspace's `verify.default`", () => {
        const set = live();
        const chosen = set.recipes.find((r) => r.id === set.default);
        assert.ok(chosen, "the default must name a recipe in the set");
        assert.equal(chosen.source.kind, "workspace");
    });
});

describe("the roster pin's other half — the reader that is not JavaScript", () => {
    test("`.github/workflows/verify.yml` calls the carrier and no longer enumerates recipes itself", () => {
        const yml = fs.readFileSync(path.join(REPO, ".github/workflows/verify.yml"), "utf8");
        assert.match(yml, /cli\/recipe-set\.mjs/, "the workflow must call the carrier");
        assert.doesNotMatch(
            yml,
            /m\.verify\.recipes/,
            "the workflow must not carry its own enumeration of the recipe set — that is the drift this change removed",
        );
    });

    test("every JavaScript reader on the roster imports the carrier", () => {
        for (const rel of ["cli/doctor.mjs", "cli/vendor.mjs", "cli/stop-gate.mjs", "cli/finish.mjs", "cli/form.mjs"]) {
            const src = fs.readFileSync(path.join(REPO, rel), "utf8");
            assert.match(src, /from "\.\/recipe-set\.mjs"/, `${rel} must reach the carrier`);
        }
    });

    test("no UNDECLARED reader enumerates the recipe set", () => {
        // Matched as text: a read through a string key, as in `verify["recipes"]`, goes unseen.
        const allowed = new Set(["cli/recipe-set.mjs", "cli/doctor.mjs"]);
        const offenders = [];

        const decomment = (src, hash) =>
            src
                .replace(/\/\*[\s\S]*?\*\//g, " ")
                .split("\n")
                .map((line) => (hash ? line.replace(/#.*$/, "") : line.replace(/\/\/.*$/, "")))
                .join("\n");

        const sweep = (dir, filter, hash = false) => {
            for (const entry of fs.readdirSync(path.join(REPO, dir))) {
                const rel = `${dir}/${entry}`;
                if (!filter(entry) || allowed.has(rel)) continue;
                const src = decomment(fs.readFileSync(path.join(REPO, rel), "utf8"), hash);
                if (/verify\s*\??\.\s*recipes/.test(src)) offenders.push(rel);
            }
        };
        sweep("cli", (e) => e.endsWith(".mjs") && !e.endsWith(".test.mjs"));
        sweep(".github/workflows", (e) => e.endsWith(".yml") || e.endsWith(".yaml"), true);

        assert.deepEqual(
            offenders,
            [],
            `these enumerate the recipe set without being the carrier or doctor's argued validation: ${offenders.join(", ")}`,
        );
    });
});
