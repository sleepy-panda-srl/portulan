// The composed recipe set, against THIS repository rather than against fixtures.
//
//   node --test "cli/**/*.test.mjs"
//
// `recipe-set.test.mjs` covers the carrier's logic with a fixture resolver. This file exists because
// that is not enough, and the gap is not hypothetical — it was measured on the change that added both.
//
// `compile.mjs`'s `resolvePack` returns `manifest` as the **path** to `pack.json`, not as the parsed
// object. The first cut of `resolverFor` treated it as parsed, so every composed pack contributed
// nothing — and the unit suite stayed green, because its fixture resolver returned a parsed object and
// therefore encoded the same assumption the code made. **A harness you write to check your own change
// inherits your change's blind spot**, which this project has now paid for twice: once here, and once
// when a discovery draft probed only one plugin layout and found neither plugin its own feed shipped.
//
// So these assertions run the real emitter over the real workspace manifest, resolving the real packs
// from the real tree. They are slower and they are the ones that bite.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { recipeSet, resolverFor, composedId } from "./recipe-set.mjs";
import os from "node:os";

// A HERMETIC HOST. The tools consult the host's installed-plugin record on the UNASKED path as of
// 2026-08-13, so a suite that does not neutralise it reads the machine it runs on and a fixture's
// verdict moves with what somebody has installed. Swept by `pinned-roots.live.test.mjs`, whose header
// carries the argument and the limit. A case that wants a host passes `env:` explicitly, which wins.
process.env.CLAUDE_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));

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
        // The assertion that the fixture suite could not make: a real pack, resolved from a real root,
        // whose real `pack.json` had to be READ rather than assumed.
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
        // The command is typed from the repository root, so its script path resolves from there.
        const script = composed.run.split(/\s+/).find((word) => word.endsWith(".sh"));
        assert.ok(script, `no script path found in ${JSON.stringify(composed.run)}`);
        assert.ok(fs.existsSync(path.join(REPO, script)), `${script} does not exist relative to the repository root`);
    });

    test("`rituals/checkpoints` resolves and contributes NO recipe, which is not an error", () => {
        // Its README declines the field by argued policy. Conflating "declared none" with "failed to
        // resolve" would make the honest pack red, so this pins the distinction against the real pack.
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
        // The JavaScript readers are pinned by importing `recipe-set.mjs`; the workflow cannot import
        // anything, so its half of the roster is asserted textually. Without this the roster claims to
        // govern four readers while governing three.
        const yml = fs.readFileSync(path.join(REPO, ".github/workflows/verify.yml"), "utf8");
        assert.match(yml, /cli\/recipe-set\.mjs/, "the workflow must call the carrier");
        assert.doesNotMatch(
            yml,
            /m\.verify\.recipes/,
            "the workflow must not carry its own enumeration of the recipe set — that is the drift this change removed",
        );
    });

    test("every JavaScript reader on the roster imports the carrier", () => {
        for (const rel of ["cli/doctor.mjs", "cli/vendor.mjs", "cli/stop-gate.mjs"]) {
            const src = fs.readFileSync(path.join(REPO, rel), "utf8");
            assert.match(src, /from "\.\/recipe-set\.mjs"/, `${rel} must reach the carrier`);
        }
    });

    test("no UNDECLARED reader enumerates the recipe set", () => {
        // The half a constant-equality check cannot supply, and the half that matters: a fifth reader
        // that never adds itself to `RECIPE_SET_READERS` touches nothing the roster assertion reads.
        // `cli/collisions.test.mjs` learned this — it sweeps `cli/` for an undeclared fourth exporter
        // rather than trusting a list — and this is the same sweep for the same reason.
        //
        // Two sites are allowed to enumerate `verify.recipes` directly, and both are argued in place:
        // the carrier itself, and `doctor`, which validates the workspace's own DECLARATION (resolving
        // each recipe's `doc`, and checking `verify.default` names one of them). Neither is a reader of
        // the runnable set; they are readers of the manifest key. Anything else is drift.
        // **Comments are stripped before matching, and that is not a convenience.** The first cut of
        // this sweep read whole files and went red on `cli/stop-gate.mjs` and `cli/vendor.mjs` — both
        // of which reach the carrier, and both of whose *comments* say so by naming the enumeration
        // they no longer do. A matcher that cannot tell a mention from a use is the false red this
        // repository has already paid for once, when a persona disclaiming `Prohibited` failed a check
        // looking for the word (`docs/milestones/m07.md`). Stripping is the narrow fix; the limit is
        // that a `verify.recipes` read inside a string literal would still be missed, which no reader
        // has any reason to write.
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
