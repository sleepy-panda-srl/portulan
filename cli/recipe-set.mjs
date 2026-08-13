/**
 * The recipe set — the one carrier of *what this workspace runs*.
 *
 * Row 7's amendment of 2026-07-31 (argument in `docs/milestones/m07.md`) ruled that a composed
 * pack's verify recipes reach the adopting workspace's runnable set, under a contract stated in the
 * row rather than left to this file: **additive only** — a pack may add a recipe and may never
 * redefine, remove or replace one the workspace declares, nor become the workspace's
 * `verify.default` — **namespaced by its pack, so a collision is impossible rather than resolved**,
 * and **could-not-run — exit 2, never silently absent** when a composed recipe cannot resolve.
 *
 * ## Why this is a module and not four implementations
 *
 * Until this landed the recipe set was read independently in four places — `.github/workflows/verify.yml`,
 * `cli/doctor.mjs`, `cli/vendor.mjs` and `cli/stop-gate.mjs` — with none authoritative. Composing into
 * fewer than all four would have left the rest disagreeing about what the set IS, which is
 * `../.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md`'s defect in its code
 * material: one rule, several enforcement sites, repaired at fewer than all of them. The repair that
 * proposal prescribes is `core/operating/evolution.md`'s — **one carrier, and the others reach it** —
 * and here the rule can be a function, which is where that repair applies.
 *
 * The row makes CI part of the contract in its own words: *CI runs the recipe set the manifest yields*,
 * and a composed recipe missing from it *"would be a green computed over something nobody ran"*. So
 * `verify.yml` calls this module rather than carrying its own enumeration, and `cli/recipe-set.test.mjs`
 * pins the roster so a fifth reader reds instead of drifting.
 *
 * ## What the namespace buys, and why the refusal stays anyway
 *
 * A workspace-declared recipe id is a bare slug (`$defs/slug`, `^[a-z0-9]+(-[a-z0-9]+)*$`) in
 * `spec/workspace.schema.json`, and so is `verify.default`. A composed id is `<category>/<name>:<id>`,
 * whose `/` and `:` are outside that grammar. So a composed recipe cannot carry a workspace id and
 * cannot be named by `verify.default`: **both are impossible by construction, not refused by a check
 * somebody has to remember.**
 *
 * The refusal below is kept as belt and braces behind that construction — the pattern `verify.yml`
 * already names in its own comment — and it is not a claim to an enforcement that cannot fire, which
 * `../.portulan/memory/a-stated-enforcer-must-be-the-real-one.md` would forbid. Two classes reach it:
 *
 *   1. **A pack declaring one id twice with different runs.** Schema-legal: `contributes.verify`'s
 *      `uniqueItems` compares whole recipe objects, so two entries differing only in `run` validate.
 *      The namespacer gives both the same composed id and only this refusal catches it. It is forced
 *      red in the suite.
 *   2. **A hand-edited manifest reaching a reader that does not validate against the schema** — CI and
 *      the Stop gate both read `workspace.json` raw.
 *
 * ## The composed `run` contract
 *
 * `spec/pack.schema.json` glosses a recipe's `run` as *"the command, as it would be typed from the
 * repository root"*. A pack has no repository until it is adopted, and its script ships inside the
 * pack — so a composed `run` needs a way to name its own files from a root it cannot know. It does
 * that with **`${PACK_ROOT}`**, expanded here to the resolved pack root before the command is handed
 * to anyone. After expansion the gloss is true again, which is the point: what runs is a command
 * typeable from the repository root.
 *
 * Expansion happens **before** the newline and tab check, so a pack root carrying one cannot smuggle
 * it past a validation that ran too early. A workspace recipe's `run` is never expanded — the token
 * has no meaning outside a pack, and rewriting it would be this module inventing a feature the
 * Workspace Definition does not declare.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { resolvePack, rootPlan } from "./compile.mjs";
import { AUTO, discoverPackRoots, namedWithAuto } from "./discover.mjs";

/**
 * Every reader of the recipe set, by path.
 *
 * **Pinned in two halves, because this list alone holds less than it looks like it holds.**
 * `cli/recipe-set.test.mjs` asserts the roster's contents, which catches a reader being removed or
 * renamed — but a *fifth* reader that never adds itself here touches nothing that assertion reads. So
 * `cli/recipe-set.live.test.mjs` sweeps `cli/*.mjs` and the workflows for an undeclared enumeration of
 * `verify.recipes`, which is the half that actually catches drift. `cli/collisions.test.mjs` carries
 * the same pair for the three `collisions()`, and the sweep is the half it had to add for the same
 * reason: a copy nothing asserts is invisible to every other test.
 *
 * Two sites enumerate `verify.recipes` directly and are exempt by argument, not by oversight: this
 * module, and `cli/doctor.mjs`, which validates the workspace's own DECLARATION rather than reading
 * the runnable set.
 */
export const RECIPE_SET_READERS = Object.freeze([
    ".github/workflows/verify.yml",
    "cli/doctor.mjs",
    "cli/stop-gate.mjs",
    "cli/vendor.mjs",
]);

/** `$defs/slug`, held identically by both schemas. A workspace id and `verify.default` are this. */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The token a composed `run` uses to name its own pack's files. */
const PACK_ROOT_TOKEN = "${PACK_ROOT}";

/** The composed spelling. Exported so no caller re-derives it — one carrier, again, one layer down. */
export function composedId(packRef, id) {
    return `${packRef}:${id}`;
}

function refuse(reason) {
    return { ok: false, exitCode: 2, reason };
}

/**
 * Validate one recipe's runnable parts. Returns an error string or null.
 *
 * These four refusals were carried by `.github/workflows/verify.yml`'s inline emitter alone until this
 * module took them. Losing one in the move would have been a fix not done at the site it was found,
 * committed inside the change that cites the doctrine — so they are asserted here in the suite rather
 * than trusted to have survived.
 */
function invalidRunnable(id, run, where, { requireSlug = true } = {}) {
    // `requireSlug` is off only on the deliberately-bypassed path. Without it `trustPackSpelling` could
    // not do the one thing its JSDoc says it exists for: a genuinely pre-namespaced id carries `/` and
    // `:`, so the slug check refused it *before* the shadow refusal it was meant to reach — an option
    // that named a purpose it could not serve. Copilot round 6.
    if (requireSlug && !SLUG.test(String(id ?? ""))) return `${where} declares a recipe id that is not a slug: ${JSON.stringify(id)}`;
    const command = String(run ?? "");
    if (!command.trim()) return `${where} declares an empty run command for recipe \`${id}\``;
    // Names all three characters it rejects. It said "newline or tab" while the pattern also refused a
    // carriage return, so a manifest carrying one got a message pointing at two characters it did not
    // contain — a diagnosis that sends the reader looking for the wrong thing. Copilot round 1.
    if (/[\n\r\t]/.test(command)) {
        return `${where} declares a run containing a newline, carriage return or tab for recipe \`${id}\``;
    }
    return null;
}

/**
 * The composed runnable set for a workspace manifest.
 *
 * @param {object} manifest              a parsed Workspace Definition
 * @param {object}   [options]
 * @param {string[]} [options.packs]     the workspace's `packs` array; defaults to `manifest.packs`
 * @param {(ref: string) => ({ ref: string, root: string, manifest: object } | null)} [options.resolve]
 *        resolves a pack reference to its root and manifest, or null when it cannot be found.
 *        Absent when packs are declared means nothing resolves, which is could-not-run — fail-closed,
 *        because a resolver that silently is not there would compose nothing and report green.
 * @param {boolean}  [options.trustPackSpelling]  use a pack's own recipe id verbatim instead of
 *        namespacing it. Exists so the shadow refusal can be exercised against a real input; no
 *        production caller passes it.
 *
 * @returns {{ ok: true, recipes: object[], default: string|undefined }
 *          | { ok: false, exitCode: 2, reason: string }}
 */
export function recipeSet(manifest, options = {}) {
    const { packs = manifest?.packs ?? [], resolve = null, trustPackSpelling = false } = options;

    // `packs` must be an array, for the same reason `verify.recipes` must be — and this is that fix's
    // sibling, at the site round 1 did not reach. A string here would iterate CHARACTERS and report
    // "the pack `t` could not be resolved", a refusal whose message names something the manifest never
    // said; an object would throw a TypeError, which is a stack trace rather than a diagnosis. Both are
    // could-not-run wearing a worse face. Copilot round 3.
    if (!Array.isArray(packs)) {
        return refuse(`this workspace's \`packs\` is not an array (${typeof packs}) — could-not-run rather than a set composed from a value nothing can enumerate`);
    }

    // A manifest with no `verify.recipes` ARRAY is could-not-run, not a workspace that declares none.
    //
    // This was `?? []`, and that was a fail-open the move introduced: the CI emitter this carrier
    // replaced iterated `m.verify.recipes` directly, so an absent block threw and became exit 2. Under
    // `?? []` an invalid manifest could still yield a runnable set as soon as a pack contributed one —
    // CI would then run a green over a workspace whose own declaration nobody could read. One of the
    // four validations that was supposed to survive the move, and the one that did not; the pre-commit
    // checkpoint asked the question and neither pass caught it. Copilot round 1's suppressed note did.
    //
    // Absent is distinguishable from empty here only in the message: both refuse, because `spec/workspace.schema.json`
    // requires the block and a workspace that declares no recipes cannot report green either way.
    if (!Array.isArray(manifest?.verify?.recipes)) {
        return refuse(
            "the workspace manifest declares no `verify.recipes` array — could-not-run rather than a set " +
                "computed as if it had declared none",
        );
    }
    const declared = manifest.verify.recipes;
    const recipes = [];
    const seen = new Set();

    for (const recipe of declared) {
        const bad = invalidRunnable(recipe?.id, recipe?.run, "the workspace manifest");
        if (bad) return refuse(bad);
        // Normalised to strings on the way out, the way the pack path below already does.
        //
        // The validation above coerces with `String(...)`, so a non-string `id` that stringifies to a
        // slug PASSED and was then pushed through unchanged — and every downstream comparison is an
        // identity check on that value: `r.id === set.default` in the Stop gate, `seen.has(id)` here,
        // the emitter's tab-separated line. One arm of this function stringified and the other did not,
        // which is the two-sites-one-rule shape this whole change is about, inside the carrier that
        // carries it. Copilot round 2's suppressed note.
        const id = String(recipe.id);
        const run = String(recipe.run);
        if (seen.has(id)) return refuse(`the workspace manifest declares the recipe \`${id}\` more than once`);
        seen.add(id);
        recipes.push({ ...recipe, id, run, source: { kind: "workspace" } });
    }

    for (const ref of packs) {
        const found = resolve ? resolve(ref) : null;
        if (!found) {
            // Never silently absent. The row's words: exit 2, and the run says which pack — and which
            // recipe, where one is known. A composed recipe quietly missing from the set would be a
            // green computed over something nobody ran, arriving through the composition path.
            return refuse(
                `the pack \`${ref}\` is composed by this workspace and could not be resolved, so its verify recipes ` +
                    `could not be read — could-not-run rather than a set that quietly lost them`,
            );
        }

        // A pack declaring no `verify` key contributes no recipes and is not an error. That is
        // `packs/rituals/checkpoints`'s deliberate shape, by its own argued policy, and conflating
        // "declared none" with "failed to resolve" would make the honest pack red.
        //
        // But a key that is PRESENT and not an array is neither of those: it is a manifest nobody can
        // read, and `for..of` over it throws a TypeError — the carrier crashing where its whole
        // contract is to exit 2 with a sentence naming the pack. Third site of round 1's rule, and the
        // second one it did not reach. Copilot round 3.
        const contributed = found.manifest?.contributes?.verify;
        if (contributed !== undefined && !Array.isArray(contributed)) {
            return refuse(`the pack \`${ref}\` declares \`contributes.verify\` as ${typeof contributed}, not an array — could-not-run`);
        }
        for (const recipe of contributed ?? []) {
            const declaredId = String(recipe?.id ?? "");
            if (!trustPackSpelling && !SLUG.test(declaredId)) {
                return refuse(`the pack \`${ref}\` declares a recipe id that is not a slug: ${JSON.stringify(recipe?.id)}`);
            }

            const id = trustPackSpelling ? declaredId : composedId(ref, declaredId);

            // Expansion first, so a pack root carrying a newline cannot pass a check that ran too early.
            const run = String(recipe?.run ?? "").split(PACK_ROOT_TOKEN).join(found.root);

            const bad = invalidRunnable(declaredId, run, `the pack \`${ref}\``, { requireSlug: !trustPackSpelling });
            if (bad) return refuse(bad);

            if (seen.has(id)) {
                return refuse(
                    `the pack \`${ref}\` contributes a recipe that would shadow \`${id}\`, which is already in this ` +
                        `workspace's set — composition is additive and may never redefine or replace a recipe`,
                );
            }
            seen.add(id);
            recipes.push({ ...recipe, id, run, source: { kind: "pack", pack: ref, root: found.root } });
        }
    }

    // Reporting green having run nothing is the failure the whole gate exists to prevent, and
    // enumeration is a precondition exactly as it is inside each recipe —
    // `../.portulan/memory/verify-preconditions-fail-closed.md`.
    if (recipes.length === 0) return refuse("the manifest yields no verify recipes — refusing to report green");

    // `default` is normalised the same way the ids are, and this is round 2's own fix's sibling.
    //
    // Round 2 stringified every recipe's `id` on the way out and left `default` as whatever the
    // manifest held. Every downstream lookup is an identity comparison — `r.id === set.default` in
    // `cli/stop-gate.mjs` — so a non-string default that used to match a non-string id stopped matching
    // the moment one side was normalised and the other was not. A repair that reached one of the two
    // values it had to reach, in the change whose subject is exactly that. Copilot round 6.
    const declaredDefault = manifest?.verify?.default;
    return { ok: true, recipes, default: declaredDefault == null ? declaredDefault : String(declaredDefault) };
}

/**
 * A resolver over a workspace's declared pack roots, for callers that actually compose.
 *
 * Reaches `compile.mjs`'s `rootPlan` and `resolvePack` rather than re-deriving where a pack lives —
 * the precedence rule (**a named root wins outright; asked-for discovery is unioned with the derived
 * root, discovered first**) lives once, in `resolutionRoots`, and a second derivation here would be a
 * second carrier of the fact `cli/discover.mjs` was built to hold. The pack root handed to
 * `${PACK_ROOT}` is made **relative to the repository root**, because that is the root a recipe's
 * `run` is typed from.
 *
 * **`forced` rides beside `discovery` because without it the pair is dead plumbing.** This function
 * accepted `discovery` and passed it on while `resolutionRoots` consults it only under `forced`, so no
 * caller could ever have reached discovery through here — the parameter looked wired and was not. It
 * is threaded rather than deleted because the recipe set is exactly a place an adopter will want it;
 * what is refused is a parameter that reads as a capability and is none.
 */
export function resolverFor({ workspaceDir, manifest, repoRoot = ".", named = [], discovery = null, forced = false }) {
    const plan = rootPlan(workspaceDir, manifest, { named, discovery, forced });
    // A refusal must not arrive as an empty root set. That is the silent drop this change exists to
    // remove, and the first cut of this function reintroduced it one layer down — an API caller
    // passing `named` beside `forced: true` would have resolved nothing and been told nothing.
    // Raised by Copilot, round 1 on #233; swept to `skills-set.mjs`'s sibling in the same stroke.
    if (plan.refusal) throw new Error(`recipe-set: ${plan.refusal}`);
    if (plan.couldNotRun) throw new Error(`recipe-set: ${plan.couldNotRun}`);
    const roots = plan.roots ?? [];
    return (ref) => {
        const found = resolvePack(ref, roots);
        // `resolvePack` returns `manifest` as the PATH to `pack.json`, not as the parsed object —
        // reading it is this adapter's job. The first cut of this function treated it as parsed, and
        // every pack then contributed nothing while the suite stayed green, because the fixture
        // resolver in `recipe-set.test.mjs` handed back a parsed object and so inherited the same
        // assumption the code made. Caught by running the emitter against this repository rather than
        // against its own fixtures; `cli/recipe-set.live.test.mjs` is what stops it coming back.
        if (!found?.dir || !found.manifest) return null;
        let parsed;
        try {
            parsed = JSON.parse(fs.readFileSync(found.manifest, "utf8"));
        } catch {
            // A pack whose manifest is present and unreadable is NOT a pack that contributes nothing.
            // Returning null here makes it could-not-run at the caller, which is the honest answer —
            // only absence is absence.
            return null;
        }
        const rel = path.relative(path.resolve(repoRoot), path.resolve(found.dir));
        return { ref, root: rel === "" ? "." : rel, manifest: parsed };
    };
}

/**
 * The emitter CI runs: one `id<TAB>run` line per recipe in the composed set, exit 2 if the set cannot
 * be produced.
 *
 * `.github/workflows/verify.yml` carried this as an inline `node -e` until milestone 7's composition
 * amendment. It is here now because the row puts CI inside the contract — *CI runs the recipe set the
 * manifest yields* — so a workflow computing its own set would be the required check reporting green
 * over a recipe nobody ran, which is the false green the row names in words.
 */
export function run(argv = [], { stdout = process.stdout, stderr = process.stderr } = {}) {
    // **Three refusals, not one.** `init`, `new` and `vendor` each refuse a missing value, a FLAG as a
    // value, and an empty one; session 9 recorded a fourth parser taking only the first, where
    // `--tree --write <dir>` swallowed the write and silently reported instead of migrating. This was
    // the fifth: `argv.indexOf` plus a truthiness test meant `--workspace --pack-root packs` bound the
    // workspace to the string `--pack-root`, and the run then failed with a misleading *manifest could
    // not be read* about a directory nobody asked for. Copilot, round 5 on #236.
    let argError = null;
    const arg = (flag, fallback) => {
        const i = argv.indexOf(flag);
        if (i < 0) return fallback;
        const value = argv[i + 1];
        if (value === undefined) argError ??= `${flag} needs a value`;
        else if (value.startsWith("-")) argError ??= `${flag} was given ${JSON.stringify(value)}, which is a flag rather than a value`;
        else if (value.trim() === "") argError ??= `${flag} was given an empty value, and no option here has a meaningful empty value`;
        return argError ? fallback : value;
    };
    const repoRoot = arg("--repo-root", ".");
    const workspaceDir = arg("--workspace", path.join(repoRoot, ".portulan"));
    if (argError) {
        stderr.write(`${argError}\n`);
        return 2;
    }

    // `--pack-root`, repeatable, with `auto` and the shared refusal — the same surface the other six
    // tools take (`compile`, `doctor`, `index`, `init`, `vendor`, `skills-set`). It was missing here, and the plumbing behind it (`resolverFor`'s `discovery` and
    // `forced`) existed with no way to reach it: a capability that looked wired and was not, which is
    // the defect this file's neighbour `skills-set` was caught with a day earlier. CI calls this
    // command for the recipe set it runs, so without the flag a workspace composing from the host
    // cache had no invocation that could enumerate its own recipes.
    const named = [];
    let forced = false;
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] !== "--pack-root") continue;
        const value = argv[i + 1];
        i += 1;
        if (value === undefined || value.startsWith("-")) {
            stderr.write("--pack-root needs a directory, or `auto` to discover one from the host plugin cache. A directory actually named `auto` is `./auto`\n");
            return 2;
        }
        // The keyword on the RAW argument, before any resolution, so `./auto` still names a directory.
        if (value === AUTO) {
            forced = true;
            continue;
        }
        // A root that is not there is a fact about the FILESYSTEM, not a pack that failed to resolve,
        // and reporting it as the latter sends an author to the one file that is not at fault. A FILE
        // is the sharper case: `resolvePack` only tests for `pack.json` under the root, so a file-valued
        // root yields "unresolvable" for every pack while the argument is what was wrong. Fourth carrier
        // of a rule `compile`, `doctor` and `index` already hold; raised by Copilot, round 1 on #236,
        // as an inconsistency with them.
        const resolved = path.resolve(value);
        let rootStat = null;
        try {
            rootStat = fs.statSync(resolved);
        } catch (cause) {
            stderr.write(`--pack-root ${value} cannot be read — ${cause.code ?? cause.message}. Refusing to report a pack unresolvable against a root nothing looked in\n`);
            return 2;
        }
        if (!rootStat.isDirectory()) {
            stderr.write(`--pack-root ${value} is not a directory — a resolution root is a directory packs are looked up under\n`);
            return 2;
        }
        named.push(resolved);
    }
    const bothAsked = namedWithAuto(named, forced);
    if (bothAsked) {
        stderr.write(`${bothAsked}\n`);
        return 2;
    }

    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(workspaceDir, "workspace.json"), "utf8"));
    } catch (err) {
        stderr.write(`the workspace manifest at ${workspaceDir} could not be read: ${err.message}\n`);
        return 2;
    }

    let resolve;
    try {
        resolve = resolverFor({ workspaceDir, manifest, repoRoot, named, discovery: () => discoverPackRoots(), forced });
    } catch (err) {
        // `resolverFor` throws on a refusal or a could-not-look; both are exit 2 rather than a set.
        stderr.write(`${err.message}\n`);
        return 2;
    }
    const set = recipeSet(manifest, { resolve });
    if (!set.ok) {
        stderr.write(`${set.reason}\n`);
        return set.exitCode;
    }
    for (const recipe of set.recipes) stdout.write(`${recipe.id}\t${recipe.run}\n`);
    return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exit(run(process.argv.slice(2)));
}
