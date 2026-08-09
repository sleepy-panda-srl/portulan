// The recipe set — one carrier, and every reader reaches it.
//
//   node --test "cli/**/*.test.mjs"
//
// Row 7's amendment of 2026-07-31 says a composed pack's verify recipes reach the adopting
// workspace's runnable set: **additive only**, never redefining, removing or replacing a recipe the
// workspace declares, never becoming `verify.default`, **namespaced by its pack so a collision is
// impossible rather than resolved**, and **could-not-run — exit 2, never silently absent** when a
// composed recipe cannot resolve.
//
// ## Why this is one module rather than a fourth implementation
//
// Before this landed, the workspace's recipe set was read independently in four places:
// `.github/workflows/verify.yml` (an inline `node -e` emitter), `cli/doctor.mjs`, `cli/vendor.mjs`
// and `cli/stop-gate.mjs`. Composing into fewer than all four would have left the others disagreeing
// about what this workspace's recipe set IS — one rule, four enforcement sites, repaired at fewer
// than all of them, which is `../.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md`
// exactly. And the row puts CI inside the contract in its own words: *CI runs the recipe set the
// manifest yields*, so a CLI-only composition would leave the required check green over a recipe
// nobody ran.
//
// So: `recipeSet()` is the carrier and the four readers call it. The last test in this file pins the
// roster's CONTENTS — which catches a reader removed or renamed, and catches nothing else. The half
// that catches a *fifth* reader is a sweep, and it lives in `cli/recipe-set.live.test.mjs` because it
// has to read the tree. Both halves are the pattern `cli/collisions.test.mjs` arrived at for the three
// `collisions()`: a list, plus a sweep for what the list does not know about.
//
// ## What the namespace buys, stated precisely
//
// A workspace-declared recipe id is a bare slug — `$defs/slug`, `^[a-z0-9]+(-[a-z0-9]+)*$` — in both
// `spec/workspace.schema.json` and `spec/pack.schema.json`, and so is `verify.default`. A composed id
// is `<category>/<name>:<id>`, and `/` and `:` are outside that grammar. So a composed recipe **cannot**
// carry a workspace id and **cannot** be named by `verify.default`: both are impossible by construction
// rather than refused by a check that has to be remembered.
//
// The refusal is kept anyway, as belt and braces behind the namespacer — the pattern `verify.yml`
// already states in its own comment — because impossibility-by-construction is a property of the
// construction, and two classes reach the carrier around it: a pack declaring the same `id` twice with
// different `run`s (schema-legal, because `contributes.verify`'s `uniqueItems` compares whole objects),
// and a hand-edited manifest reaching CI or the Stop gate, neither of which validates against the
// schema. The first is forced red below.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { recipeSet, composedId, RECIPE_SET_READERS } from "./recipe-set.mjs";

/** A workspace manifest with `n` plain recipes, enough to be legal and no more. */
function workspace(recipes, extra = {}) {
    return { name: "w", verify: { default: recipes[0]?.id, recipes }, ...extra };
}

/** A pack whose manifest contributes `recipes`, resolvable at `root`. */
function pack(ref, recipes, root = `../packs/${ref}`) {
    const [category, name] = ref.split("/");
    return { ref, root, manifest: { portulan: { pack: "1.0", version: "0.1.0" }, category, name, contributes: { verify: recipes } } };
}

/** A resolver over a fixed list of packs; anything not listed is unresolvable. */
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
        // Additive means the originals are not merely present — they are unchanged.
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
        // The pack spells its own recipe `docs` — the same id the workspace owns. The carrier
        // namespaces it rather than trusting the spelling, so the collision never forms.
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
        // Schema-legal: `contributes.verify`'s `uniqueItems` compares whole recipe objects, so two
        // entries differing only in `run` pass validation. The namespacer gives both the same
        // composed id, and only this refusal catches it.
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
        // Reached by handing the carrier a pre-namespaced spelling, which is what a hand-edited
        // manifest or a future caller doing its own namespacing would produce. The construction makes
        // this unreachable today; the refusal is what keeps that true when the construction changes.
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
        // The whole point: a green computed over a set that quietly lost a recipe is the false green
        // this repository names. Refusing is the only honest answer.
        const out = recipeSet(workspace([DOCS, TESTS]), { packs: ["stacks/python"], resolve: resolverOver([]) });
        assert.equal(out.ok, false);
        assert.equal(out.recipes, undefined);
    });

    test("a resolvable pack that declares NO verify key composes nothing and is not an error", () => {
        // `rituals/checkpoints` is exactly this shape, by its own argued policy. Declaring no recipes
        // is not the same as failing to resolve, and conflating them would make the honest pack red.
        const quiet = pack("rituals/checkpoints", undefined);
        delete quiet.manifest.contributes.verify;
        const out = recipeSet(workspace([DOCS]), { packs: ["rituals/checkpoints"], resolve: resolverOver([quiet]) });
        assert.equal(out.ok, true);
        assert.deepEqual(out.recipes.map((r) => r.id), ["docs"]);
    });
});

describe("the validations the CI emitter used to carry alone", () => {
    // `.github/workflows/verify.yml` refused each of these with exit 2 in an inline `node -e`. The
    // emitter is being replaced by a call to this carrier, so the refusals move here — losing one in
    // the move would be the fix-not-done-at-the-site defect, committed inside the change that cites it.
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
        // The regression the move introduced and Copilot round 1's suppressed note caught: under
        // `?? []` an unreadable workspace declaration still produced a runnable set as soon as a pack
        // contributed a recipe, so CI would have reported green over a manifest nobody could read.
        // The emitter this carrier replaced iterated the key directly and threw, i.e. exit 2.
        const gh = pack("tools/github", [{ id: "a", run: "x" }]);
        for (const manifest of [{ name: "w" }, { name: "w", verify: {} }, { name: "w", verify: { recipes: "nine" } }]) {
            const out = recipeSet(manifest, { packs: ["tools/github"], resolve: resolverOver([gh]) });
            assert.equal(out.ok, false, `${JSON.stringify(manifest)} must be refused`);
            assert.equal(out.exitCode, 2);
            assert.match(out.reason, /verify\.recipes/);
        }
    });

    test("a non-array `packs` is could-not-run, never iterated as characters", () => {
        // Round 1 fixed this rule for `verify.recipes`; these are the two sites it did not reach.
        // A string here iterates CHARACTERS and produces "the pack `t` could not be resolved" — a
        // refusal naming something the manifest never said; an object throws a TypeError.
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
        // The validation coerces with `String(...)`, so a non-string id that stringifies to a slug
        // passes — and every downstream use is an identity comparison (`r.id === set.default` in the
        // Stop gate). One arm of the carrier stringified and the other did not.
        const odd = { id: { toString: () => "docs" }, run: { toString: () => "./x.sh" } };
        const out = recipeSet({ name: "w", verify: { default: "docs", recipes: [odd] } }, {});
        assert.equal(out.ok, true);
        assert.strictEqual(out.recipes[0].id, "docs");
        assert.strictEqual(out.recipes[0].run, "./x.sh");
        assert.ok(out.recipes.find((r) => r.id === out.default), "the default must resolve by identity, not by coercion");
    });

    test("the run refusal names every character it rejects, including the carriage return", () => {
        // It said "newline or tab" while rejecting `\r` too, so a manifest carrying one was sent
        // looking for two characters it did not contain.
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
    // This pins the roster's CONTENTS and nothing more: it reds when a reader is removed or renamed,
    // and it is blind to a fifth reader that never declares itself — which is exactly how the four
    // came to disagree in the first place. The sweep that is not blind to that lives in
    // `cli/recipe-set.live.test.mjs`, because it has to read the tree rather than a constant.
    test("the declared roster is the four readers this change re-pointed", () => {
        assert.deepEqual([...RECIPE_SET_READERS].sort(), [
            ".github/workflows/verify.yml",
            "cli/doctor.mjs",
            "cli/stop-gate.mjs",
            "cli/vendor.mjs",
        ]);
    });
});
