// The recipe set: the verify recipes a workspace yields, its own plus each composed pack's, namespaced by pack.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { resolvePack, rootPlan, shadowedCopy } from "./compile.mjs";
import { AUTO, discoverPackRoots, namedWithAuto } from "./discover.mjs";

/** Add any new reader here: `recipe-set.live.test.mjs` catches only a direct enumeration of `verify.recipes`. */
export const RECIPE_SET_READERS = Object.freeze([
    ".github/workflows/verify.yml",
    "cli/doctor.mjs",
    "cli/drills.mjs",
    "cli/finish.mjs",
    "cli/form.mjs",
    "cli/stop-gate.mjs",
    "cli/vendor.mjs",
]);

/** `$defs/slug`, as both schemas hold it. */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The token a composed `run` uses to name its own pack's files. */
const PACK_ROOT_TOKEN = "${PACK_ROOT}";

/** Its `:` is outside `$defs/slug`, so a composed id never equals a workspace id or `verify.default`. */
export function composedId(packRef, id) {
    return `${packRef}:${id}`;
}

function refuse(reason) {
    return { ok: false, exitCode: 2, reason };
}

/** An error sentence, or null when the recipe is runnable. */
function invalidRunnable(id, run, where, { requireSlug = true } = {}) {
    if (requireSlug && !SLUG.test(String(id ?? ""))) return `${where} declares a recipe id that is not a slug: ${JSON.stringify(id)}`;
    const command = String(run ?? "");
    if (!command.trim()) return `${where} declares an empty run command for recipe \`${id}\``;
    if (/[\n\r\t]/.test(command)) {
        return `${where} declares a run containing a newline, carriage return or tab for recipe \`${id}\``;
    }
    return null;
}

/** `{ ok: true, recipes, default }`, or `{ ok: false, exitCode: 2, reason }` when the set cannot be composed. */
export function recipeSet(manifest, options = {}) {
    const { packs = manifest?.packs ?? [], resolve = null, trustPackSpelling = false } = options;

    if (!Array.isArray(packs)) {
        return refuse(`this workspace's \`packs\` is not an array (${typeof packs}) — could-not-run rather than a set composed from a value nothing can enumerate`);
    }

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
        // As strings: validation coerced them with `String`, and every reader compares ids with `===`.
        const id = String(recipe.id);
        const run = String(recipe.run);
        if (seen.has(id)) return refuse(`the workspace manifest declares the recipe \`${id}\` more than once`);
        seen.add(id);
        recipes.push({ ...recipe, id, run, source: { kind: "workspace" } });
    }

    for (const ref of packs) {
        const found = resolve ? resolve(ref) : null;
        if (!found) {
            return refuse(
                `the pack \`${ref}\` is composed by this workspace and could not be resolved, so its verify recipes ` +
                    `could not be read — could-not-run rather than a set that quietly lost them`,
            );
        }

        // An absent `contributes.verify` is a pack that contributes no recipes, not an error.
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

    if (recipes.length === 0) return refuse("the manifest yields no verify recipes — refusing to report green");

    const declaredDefault = manifest?.verify?.default;
    return { ok: true, recipes, default: declaredDefault == null ? declaredDefault : String(declaredDefault) };
}

/** The `resolve` that `recipeSet` takes; throws on a refusal, a could-not-look or a shadowed pack. */
export function resolverFor({ workspaceDir, manifest, repoRoot = ".", named = [], discovery = null, forced = false }) {
    const plan = rootPlan(workspaceDir, manifest, { named, discovery, forced });
    if (plan.refusal) throw new Error(`recipe-set: ${plan.refusal}`);
    if (plan.couldNotRun) throw new Error(`recipe-set: ${plan.couldNotRun}`);
    const roots = plan.roots ?? [];
    const originAt = (r) => (plan.origins ?? []).find((o) => path.resolve(o.root) === path.resolve(r))?.origin;

    // Checked here, not in the returned closure: that runs inside `recipeSet`, beyond the caller's `try`.
    if (!forced && plan.source !== "named") {
        const declared = Array.isArray(manifest?.packs) ? manifest.packs : [];
        for (const ref of declared) {
            const found = resolvePack(String(ref), roots);
            if (!found?.dir) continue;
            const behind = shadowedCopy(String(ref), originAt(found.root), roots, originAt);
            if (!behind) continue;
            throw new Error(
                `recipe-set: \`${ref}\` is SHADOWED — it resolved under ${found.root}, a root discovered on ` +
                    `this host, while the root ${path.relative(path.resolve(repoRoot), behind.root)} also carries it. ` +
                    "A composed recipe's ${PACK_ROOT} expands to whichever root answered, so the two compose to " +
                    "run lines pointing at different files. Refusing to pick: name the root — `--pack-root packs` " +
                    "for the tree, which is what CI runs, or `--pack-root auto` for the installed copy.",
            );
        }
    }

    return (ref) => {
        const found = resolvePack(ref, roots);
        if (!found?.dir || !found.manifest) return null;
        let parsed;
        try {
            parsed = JSON.parse(fs.readFileSync(found.manifest, "utf8"));
        } catch {
            // Unreadable is not absent: null makes it could-not-run, not a pack with no recipes.
            return null;
        }
        const rel = path.relative(path.resolve(repoRoot), path.resolve(found.dir));
        return { ref, root: rel === "" ? "." : rel, manifest: parsed };
    };
}

/** CI's emitter: one `id<TAB>run` line per recipe in the set; exit 2 when the set cannot be produced. */
export function run(argv = [], { stdout = process.stdout, stderr = process.stderr } = {}) {
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
        // The raw value is stat'd: `path.resolve("")` is the cwd, so resolving first would pass an empty root.
        let rootStat = null;
        try {
            rootStat = fs.statSync(value);
        } catch (cause) {
            stderr.write(`--pack-root ${JSON.stringify(value)} cannot be read — ${cause.code ?? cause.message}. Refusing to report a pack unresolvable against a root nothing looked in\n`);
            return 2;
        }
        if (!rootStat.isDirectory()) {
            stderr.write(`--pack-root ${JSON.stringify(value)} is not a directory — a resolution root is a directory packs are looked up under\n`);
            return 2;
        }
        named.push(path.resolve(value));
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
