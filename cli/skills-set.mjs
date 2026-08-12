#!/usr/bin/env node
/**
 * The registrable set — the one carrier of *what a host must declare so a composed pack's skills
 * register*.
 *
 *   node cli/skills-set.mjs [--workspace <dir>] [--repo-root <dir>] [--plugin-root <dir>]
 *                           [--pack-root <dir>|auto ...] [--check|--write]
 *
 * Exit 0 derived (or, with `--check`, agrees) · 1 the manifest has drifted · 2 could not run.
 *
 * Row 7 clause (b)'s adopter half, [#184](https://github.com/sleepy-panda-works/portulan/issues/184):
 * *the generator that derives a plugin's `skills` from a workspace's `packs`*.
 *
 * ## The gap this closes, measured rather than argued
 *
 * **Registration is a property of `.claude-plugin/plugin.json` and of nothing else** — measured
 * 2026-08-09 on Claude Code 2.1.226 by deleting the `packs` key from the governing workspace outright
 * and reinstalling, which changed the host's inventory not at all. So until this landed, a composed
 * pack's skill was invocable **by coincidence of a hand-written path**: two manifests carried one
 * fact, and the only thing holding them together was `cli/plugin-lint.mjs`'s `compose` check, which
 * buys *this bundle's* parity and not an adopter's.
 *
 * `spec/pack.schema.json` had already undertaken this in its own words, under `contributes.skills`:
 * *"Reaching parity means reading this key, so the row has undertaken to open it."* `doctor` opens it
 * to VALIDATE the skills behind it (the 2026-08-03 amendment); nothing folded it into registration.
 * That is exactly the declare-only state `contributes.verify` sat in until milestone 7 session 5, and
 * the repair is the one that session established: **one carrier, and the readers reach it**
 * (`../.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md`).
 *
 * ## Why a module and not a ninth subcommand
 *
 * `docs/vision.md` names eight and is human-owned. `cli/README.md` already records the precedent in
 * `discover`'s own row — *"deliberately not a ninth `portulan` subcommand … joins that list only if
 * the maintainer says so."* And not a widening of `compile` either, whose glossary entry is *"Emits
 * restriction only — never an `allow` rule"*: a skills path is a capability **grant**, which is the
 * other direction, and its input is `workspace.json`'s `packs` rather than the gate policy.
 *
 * ## The derivation, and the one platform fact it rests on
 *
 * A pack declares where its skills live (`contributes.skills`, each entry a directory that either IS
 * one skill or CONTAINS them). The host expands a declared skills path **one level and no further**.
 * Both shapes are therefore reached by declaring the root itself — a root holding `SKILL.md`
 * registers at depth 0, a root of skill directories registers them at depth 1 — which is why the
 * derived path is the `contributes.skills` root, relativised to the plugin root, and nothing cleverer.
 *
 * `HOST_SKILL_DEPTH` lives HERE rather than in `cli/plugin-lint.mjs`, where it was measured and was
 * module-local. It moved because that file now imports this one for the `compose` check, so exporting
 * it from there would have made an import cycle. The direction matches `AGENT_DIR`, which flows
 * plugin-lint → doctor: the carrier of a derived set carries the platform constant the derivation
 * depends on. **It is a measurement, not a derivation** — Claude Code 2.1.224 and 2.1.226 — and a host
 * that changes it makes every path below wrong with nothing here to say so. Re-measure on upgrade.
 *
 * ## What this deliberately does NOT do
 *
 * - **It never creates a plugin manifest.** A workspace shipping no plugin is a legitimate state, not
 *   a hole to fill, and inventing a manifest would be this tool deciding an adopter ships one.
 * - **It touches only the pack portion of `skills`.** Entries outside the roots packs actually resolve
 *   from — `./core/skills/`, `./plugin/skills/` — are somebody else's declaration and are preserved
 *   verbatim, including their original spelling and order.
 *
 *   **That boundary is derived, never assumed to be `./packs/`.** The first cut had two partitions of
 *   one fact: the derivation emitted a path for any pack resolving inside the plugin root, while the
 *   declared side recognised only `<pluginRoot>/packs`. Anything in the gap was derived and never
 *   recognised as derived, so `--check` reported the same drift forever and `--write` appended a
 *   duplicate entry on every run — **reachable with no flags at all**, from a `tree` pointing anywhere
 *   but the conventional place, which is to say from an ordinary adopter's layout. This repository's
 *   own layout makes the two partitions coincide, which is exactly why every test and the byte-identity
 *   check passed over it: *a harness written against blind spots inherits this one.* Found at the
 *   pre-commit checkpoint by constructing the layout rather than by reading the code.
 * - **It does not check the tree.** This derives from what a pack DECLARES. Whether a `SKILL.md` is
 *   actually there, and whether one sits too deep for the host to reach, is `plugin-lint`'s walk. The
 *   two are deliberately different derivations: a pack whose declaration and tree disagree is a
 *   finding, and collapsing them would delete the check that finds it.
 * - **`--write` re-serialises with two-space indentation and a trailing newline**, which is the form
 *   every manifest in this repository already has. A manifest formatted otherwise is reformatted, and
 *   that is a real cost rather than a hidden one.
 *
 * Zero dependencies, no network, no install step — the same constraints as every tool here.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// The precedence rule — **named > discovered > derived, never union** — lives once, in
// `discover.mjs`'s `resolutionRoots`, reached through `compile.mjs`'s `rootPlan`. A second derivation
// here would be a second carrier of the fact that file was built to hold.
import { resolvePack, rootPlan } from "./compile.mjs";
import { AUTO, discoverPackRoots } from "./discover.mjs";

/**
 * How far below a DECLARED skills root the host itself looks. One — `<root>/<skill>/SKILL.md` — and no
 * further.
 *
 * **Measured 2026-08-07 on Claude Code 2.1.224** against a local marketplace built from this
 * repository, in both directions: `./packs/rituals/` registered **0 of the pack's 3 skills**, and
 * `./packs/rituals/checkpoints/skills/` registered **all 3**. Re-measured on 2.1.226. It is its own
 * constant rather than a literal because it is a PLATFORM fact this repository does not control.
 *
 * A skill resolved deeper than this is packaged, counted by a validator, and inert on every install —
 * the failure `../.portulan/memory/a-manifest-field-can-validate-and-load-nothing.md` records against
 * the sibling `agents` key. Re-measure it at a host upgrade; a change here is a change in what
 * installs, not in what this tool prefers, and **nothing here can detect one**.
 *
 * It lived in `./plugin-lint.mjs` until milestone 7 session 8, where it was measured; it moved when
 * that file became a consumer of this one, since exporting it back would have made an import cycle.
 * The counts above moved with it deliberately — the first cut of this move kept the mandate and
 * dropped the evidence, which leaves a re-measurer nothing to compare against.
 */
export const HOST_SKILL_DEPTH = 1;

/** Could-not-run. Always 2, never 1: *nobody looked* outranks *we looked and it was bad*. */
function refuse(reason) {
    return { ok: false, exitCode: 2, reason };
}

/**
 * Lexical containment. `candidate` inside `root`, or `root` itself, is not an escape.
 *
 * Lexical is all this needs and the boundary is worth stating: nothing here OPENS a derived path, so
 * a symlink resolving elsewhere is not this tool's hazard the way it is `plugin-lint`'s walk or
 * `vendor`'s write. What is derived is a *string a manifest will declare*, and the property that
 * matters is that the string names somewhere under the root it claims to be under.
 */
function escapes(root, candidate) {
    const rel = path.relative(root, candidate);
    return rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
}

/**
 * The `./…/` spelling both plugin manifests in this repository already use, from a relative path.
 *
 * Canonical on both sides of every comparison, so `packs/a/skills` and `./packs/a/skills/` are one
 * path rather than two — a difference in spelling is not drift, and reporting it as drift would make
 * `--check` red on a manifest that is correct.
 */
export function canonical(relPath) {
    const posix = String(relPath).split(path.sep).join("/").replace(/^\.\//, "").replace(/\/+$/, "");
    return posix === "" ? "./" : `./${posix}/`;
}

/**
 * The registrable set for a workspace manifest.
 *
 * @param {object} manifest                a parsed Workspace Definition
 * @param {object}   [options]
 * @param {string[]} [options.packs]       the workspace's `packs`; defaults to `manifest.packs`
 * @param {string}   options.pluginRoot    absolute path of the plugin root whose manifest would declare these
 * @param {(ref: string) => ({ ref: string, root: string, manifest: object } | null)} [options.resolve]
 *        resolves a pack reference to its ABSOLUTE root and parsed manifest, or null when it cannot be
 *        found. Absent while packs are declared means nothing resolves, which is could-not-run: a
 *        resolver that silently is not there would derive nothing and report an empty set.
 *
 * @returns {{ ok: true, paths: {path: string, pack: string, root: string}[],
 *             external: {pack: string, root: string}[], composed: number }
 *          | { ok: false, exitCode: 2, reason: string }}
 */
export function skillsSet(manifest, options = {}) {
    const { packs = manifest?.packs ?? [], resolve = null, pluginRoot } = options;

    if (typeof pluginRoot !== "string" || !pluginRoot) {
        return refuse("no plugin root was given — there is nothing for a derived path to be relative to");
    }

    // `packs` must be an array. A string here iterates CHARACTERS and reports "the pack `r` could not
    // be resolved" — a refusal naming something the manifest never said; an object throws a TypeError,
    // which is a stack trace rather than a diagnosis. Both are could-not-run wearing a worse face.
    // `cli/recipe-set.mjs` carries the same guard, put there by review rather than by design.
    if (!Array.isArray(packs)) {
        return refuse(
            `this workspace's \`packs\` is not an array (${packs === null ? "null" : typeof packs}) — ` +
                "could-not-run rather than a set derived from a value nothing can enumerate",
        );
    }

    const paths = [];
    const external = [];
    const reportedExternal = new Set();
    // The roots this tool OWNS in the declared manifest, accumulated from the packs that actually
    // resolved rather than assumed to be `<pluginRoot>/packs`. A resolver hands back a pack directory,
    // and `resolvePack` builds one as `<root>/<category>/<name>` — so the root is two segments up, and
    // recovering it that way keeps this partition identical to the one the derivation uses **by
    // construction**. Two partitions of one fact is the defect this replaces; a second option to pass
    // in would have been a third chance to disagree.
    const owned = new Set();

    for (const ref of packs) {
        if (typeof ref !== "string" || ref === "") {
            return refuse(
                `this workspace declares a \`packs\` entry that is not a non-empty string ` +
                    `(${JSON.stringify(ref)}) — could-not-run rather than a set missing whatever it meant`,
            );
        }

        const found = resolve ? resolve(ref) : null;
        if (!found) {
            // Never silently absent. A pack quietly missing from this set is a manifest that looks
            // complete and registers nothing — the same false green the row refuses for recipes.
            return refuse(
                `the pack \`${ref}\` is composed by this workspace and could not be resolved, so what it ` +
                    "contributes to registration could not be read — could-not-run rather than a set that quietly lost it",
            );
        }

        // Absent is a real state: a pack may contribute no skills at all, which is `packs/tools/github`'s
        // deliberate shape. PRESENT and not an array is neither that nor a resolution failure — it is a
        // manifest nobody can read, and `for..of` over it throws where the contract is a sentence.
        const contributed = found.manifest?.contributes?.skills;
        if (contributed !== undefined && !Array.isArray(contributed)) {
            return refuse(
                `the pack \`${ref}\` declares \`contributes.skills\` as ` +
                    `${contributed === null ? "null" : typeof contributed}, not an array — could-not-run`,
            );
        }

        const packRoot = path.resolve(found.root);
        // Recorded for every pack that resolves inside the plugin root, whether or not it contributes
        // skills: a pack contributing none still makes its root ours, which is what lets a declared
        // path under it be reported as belonging to no composed pack once the pack stops shipping one.
        const resolutionRoot = path.resolve(packRoot, "..", "..");

        // Only a pack INSIDE the plugin root is one this tool could own — an outside one is the fourth
        // outcome below and its resolution root is somebody else's business. Asking the question of an
        // outside pack fires on an ordinary case, since a pack at `/elsewhere/x` has resolution root
        // `/`, which contains every plugin root there is. Caught by the fourth-outcome tests the moment
        // the guard was written without this condition.
        if (!escapes(pluginRoot, packRoot)) {
            // A resolution root that CONTAINS the plugin root — or is it — makes every declared path a
            // pack path, so this tool would own `./core/skills/` and delete it on the next `--write`.
            // That is the contract above ("preserved verbatim") turned into data loss, and it is one
            // `--pack-root <pluginRoot>` away. Refused rather than narrowed: excluding the plugin root
            // from the owned set while still deriving paths under it would put the two partitions back
            // out of step, which is the defect this partition exists to prevent. Symmetric by
            // construction — nothing derived, nothing recognised. Found at the pre-commit re-check.
            if (!escapes(resolutionRoot, pluginRoot)) {
                return refuse(
                    `the pack \`${ref}\` resolves from ${resolutionRoot}, which contains the plugin root ` +
                        "itself — every declared skills path would be indistinguishable from a pack's, including " +
                        "hand-written ones this tool must preserve. Name a narrower `--pack-root`",
                );
            }
            owned.add(resolutionRoot);
        }

        for (const entry of contributed ?? []) {
            if (typeof entry !== "string" || entry.trim() === "") {
                return refuse(
                    `the pack \`${ref}\` declares a \`contributes.skills\` entry that is not a non-empty ` +
                        `string (${JSON.stringify(entry)}) — could-not-run`,
                );
            }

            const absolute = path.resolve(packRoot, entry);

            // A skills root escaping its own pack is `doctor`'s verdict on that pack, and this tool does
            // not render it — but deriving from it anyway would put a path outside the pack into
            // somebody's manifest, which is worse than either. Named and refused.
            if (escapes(packRoot, absolute)) {
                return refuse(
                    `the pack \`${ref}\` declares the skills root \`${entry}\`, which resolves outside the ` +
                        "pack itself — refusing to derive a declaration from it. `doctor` owns the verdict on that pack",
                );
            }

            // The fourth outcome, and the one an adopter meets first. A pack resolved from the host's
            // plugin cache — which is the case `--pack-root auto` and `discover.mjs` exist for —
            // resolves perfectly well and has **no path expressible relative to this plugin root**. It
            // is not drift, not could-not-run, and must not be silence: it registers through its own
            // plugin or not at all. Reported, excluded from the set, and it moves no exit code.
            if (escapes(pluginRoot, absolute)) {
                if (!reportedExternal.has(ref)) {
                    reportedExternal.add(ref);
                    external.push({ pack: ref, root: packRoot });
                }
                continue;
            }

            paths.push({ path: canonical(path.relative(pluginRoot, absolute)), pack: ref, root: packRoot });
        }
    }

    // An empty set is NOT refused here, and that is the one place this carrier's contract differs from
    // `recipeSet`'s on purpose. A workspace that yields no verify recipe cannot report green, so that
    // one refuses; a workspace may legitimately **compose no packs**, and refusing would make the
    // honest case red. Emptiness is two questions — nothing composed, or nothing readable — and every
    // unreadable arm above has already returned. What is left is examined and genuinely empty.
    //
    // With nothing resolved there is no root to derive from a pack, so the caller's own resolution
    // roots stand in — `run` passes the ones `rootPlan` produced — and the conventional root is the
    // last resort. That ordering is the finding: a workspace that has STOPPED composing still needs its
    // stale pack entries recognised as ours and cleaned, and falling straight to `<pluginRoot>/packs`
    // did that **only for the conventional layout**, silently preserving a stale entry forever anywhere
    // else. Layout-dependence in the fallback of a fix whose whole subject was layout-dependence.
    // Raised at the pre-commit re-check.
    const fallback = (options.fallbackRoots ?? []).map((r) => path.resolve(r)).filter((r) => !escapes(pluginRoot, r));
    return {
        ok: true,
        paths,
        external,
        composed: packs.length,
        owned: owned.size ? [...owned] : fallback.length ? fallback : [path.join(pluginRoot, "packs")],
    };
}

/**
 * Split a plugin manifest's declared `skills` into the portion this tool owns and the portion it must
 * leave exactly as it found it.
 *
 * The outside entries keep their **original spelling**, because `declaredFor` writes them back and a
 * generator that silently re-spelled somebody's hand-written path would be editing what it was asked
 * to preserve.
 */
export function packPortion(skills, pluginRoot, ownedRoots) {
    if (skills === undefined) return { inside: [], outside: [], malformed: false };
    if (!Array.isArray(skills)) return { inside: [], outside: [], malformed: true };

    // `skillsSet` reports the roots it owns and every caller passes them through. The conventional root
    // is the default for a caller asking about a manifest with no derivation beside it — never a second
    // opinion about where packs live when one is available.
    const roots = (ownedRoots ?? [path.join(pluginRoot, "packs")]).map((r) => path.resolve(r));
    const inside = [];
    const outside = [];
    for (const raw of skills) {
        // A non-string entry is not this tool's verdict — `plugin-lint` grades the manifest — but it is
        // also not a pack path, so it is preserved rather than dropped.
        if (typeof raw !== "string") {
            outside.push(raw);
            continue;
        }
        const absolute = path.resolve(pluginRoot, raw);
        if (roots.some((root) => !escapes(root, absolute))) inside.push(canonical(path.relative(pluginRoot, absolute)));
        else outside.push(raw);
    }
    return { inside, outside, malformed: false };
}

/**
 * Compare a derived set against what a plugin manifest declares.
 *
 * Both directions are named, because each is a distinct defect and both are silent today: a composed
 * pack the manifest does not declare ships, counts, and is inert on every install; a pack path the
 * manifest declares that no composed pack asks for is a capability the host registers that no
 * workspace layer asked for.
 */
export function compare(set, pluginManifest, pluginRoot) {
    const portion = packPortion(pluginManifest?.skills, pluginRoot, set?.owned);
    if (portion.malformed) {
        return {
            agree: false,
            missing: [],
            extra: [],
            why: "the plugin manifest declares `skills` as something other than an array, so what it registers could not be read",
        };
    }
    // Sets rather than `includes` on both sides. The cost is nothing at this repository's three
    // entries and the shape is an adopter's — the same finding #228 records against the persona
    // correspondence, applied here rather than shipped again and fixed later.
    const derived = set.paths.map((p) => p.path);
    const declared = portion.inside;
    const derivedSet = new Set(derived);
    const declaredSet = new Set(declared);
    const missing = derived.filter((p) => !declaredSet.has(p));
    const extra = declared.filter((p) => !derivedSet.has(p));
    return { agree: missing.length === 0 && extra.length === 0, missing, extra };
}

/**
 * The `skills` array `--write` would put in the manifest: every non-pack entry exactly as it was, in
 * its original order, followed by the derived pack entries.
 *
 * Returns `null` when the manifest's `skills` cannot be read as an array — a caller must not treat
 * that as "there were no entries to preserve", which would silently delete a key it could not parse.
 */
export function declaredFor(set, pluginManifest, pluginRoot) {
    const portion = packPortion(pluginManifest?.skills, pluginRoot, set?.owned);
    if (portion.malformed) return null;
    return [...portion.outside, ...set.paths.map((p) => p.path)];
}

/**
 * A resolver over a workspace's declared pack roots.
 *
 * Reaches `compile.mjs`'s `rootPlan` and `resolvePack` rather than re-deriving where a pack lives.
 * The root handed back is **absolute**, which is where this differs from `recipe-set.mjs`'s resolver
 * and why the two are not shared: a recipe's `${PACK_ROOT}` is typed from the repository root, while a
 * declared skills path is relative to the **plugin** root, and those are not the same directory. The
 * honest way to serve both is to hand back the absolute path and relativise once, at the caller that
 * knows which root it means.
 */
export function resolverFor({ workspaceDir, manifest, named = [], discovery = null, roots = null }) {
    // `roots` lets a caller that already computed the plan share it rather than deriving a second one —
    // `run` needs the same list twice, once to resolve and once as the fallback owned set, and two
    // derivations of one plan is the shape this file exists to refuse.
    const resolved = roots ?? rootPlan(workspaceDir, manifest, { named, discovery }).roots ?? [];
    return (ref) => {
        const found = resolvePack(ref, resolved);
        // `resolvePack` returns `manifest` as the PATH to `pack.json`, not as the parsed object.
        // Reading it is this adapter's job, and the first cut of the sibling resolver got this wrong
        // while its unit suite stayed green, because the fixture resolver returned a parsed object and
        // so encoded the same assumption the code made. `cli/skills-set.live.test.mjs` is what stops
        // that here.
        if (!found?.dir || !found.manifest) return null;
        let parsed;
        try {
            parsed = JSON.parse(fs.readFileSync(found.manifest, "utf8"));
        } catch {
            // Present and unreadable is NOT a pack that contributes nothing. Null makes it
            // could-not-run at the caller, which is the honest answer — only absence is absence.
            return null;
        }
        return { ref, root: path.resolve(found.dir), manifest: parsed };
    };
}

/** Where a plugin root's manifest sits. One spelling, so a reader and a writer cannot disagree. */
export function manifestPath(pluginRoot) {
    return path.join(pluginRoot, ".claude-plugin", "plugin.json");
}

/**
 * Read a plugin manifest for `--check`/`--write`, under the three rules a tool that writes into
 * somebody's tree carries — `init`, `new` and `vendor` paid for these and a fourth reader inherits
 * them.
 *
 * Returns `{ ok: true, text, value }` or `{ ok: false, reason }`.
 */
function readManifest(file, pluginRoot) {
    // Rule 2: refuse a symlink **at or below the named destination**, rather than resolving through it.
    //
    // The whole chain from the named plugin root down, not just the last two steps. The first cut
    // lstat'd `dirname(file)` and `file` alone, so a symlinked `--plugin-root` was resolved straight
    // through and this tool wrote into whatever it pointed at — which is the exact failure `init` paid
    // for at nine files written into an unrelated directory and reported as success. `cli/new.mjs`'s
    // `chain` is the shape being matched; it is not exported, so the walk is spelled here rather than
    // reaching into a subcommand for it, and the boundary rule is the one that file argues: **above the
    // named path, resolve — the user named it, and on macOS `os.tmpdir()` runs through `/var`. At it
    // and below it, refuse.**
    const chain = [];
    for (let at = file, i = 0; i < 64; i += 1) {
        chain.push(at);
        if (at === pluginRoot) break;
        const up = path.dirname(at);
        if (up === at) break;
        at = up;
    }
    for (const candidate of chain.reverse()) {
        let stat;
        try {
            stat = fs.lstatSync(candidate);
        } catch (error) {
            // Rule 3: only ENOENT means absent. An EACCES is a question that could not be answered, and
            // answering it *nothing there* is "nothing looked" recorded as "nothing wrong".
            if (error.code === "ENOENT") {
                return {
                    ok: false,
                    reason:
                        `${candidate} does not exist — this tool never creates a plugin manifest. A workspace ` +
                        "that ships no plugin is a state, not a hole to fill",
                };
            }
            return { ok: false, reason: `${candidate} could not be examined — ${error.code ?? error.message}` };
        }
        if (stat.isSymbolicLink()) {
            return {
                ok: false,
                reason: `${candidate} is a symlink — refusing to write through it rather than resolving it`,
            };
        }
    }

    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    } catch (error) {
        return { ok: false, reason: `${file} could not be read — ${error.code ?? error.message}` };
    }
    try {
        return { ok: true, text, value: JSON.parse(text) };
    } catch (error) {
        // Never overwritten. A manifest that will not parse is one whose other keys nobody can preserve.
        return { ok: false, reason: `${file} does not parse as JSON — ${error.message}` };
    }
}

/**
 * The runnable surface: the printer CI and an adopter's own pipeline call, plus `--check` and
 * `--write`.
 *
 * `options.manifest` and `options.resolve` are injection points for the suite, the way `init` injects
 * its reader. No production caller passes either; every flag below is the real surface.
 */
export function run(argv = [], options = {}) {
    const { stdout = process.stdout, stderr = process.stderr } = options;
    const arg = (flag, fallback) => {
        const i = argv.indexOf(flag);
        return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
    };
    const many = (flag) => argv.reduce((out, a, i) => (a === flag && argv[i + 1] ? [...out, argv[i + 1]] : out), []);

    const check = argv.includes("--check");
    const write = argv.includes("--write");
    if (check && write) {
        stderr.write("skills-set: --check and --write are two questions; pass one\n");
        return 2;
    }

    const repoRoot = path.resolve(arg("--repo-root", "."));
    const workspaceDir = path.resolve(arg("--workspace", path.join(repoRoot, ".portulan")));
    const pluginRoot = path.resolve(arg("--plugin-root", repoRoot));

    let manifest = options.manifest;
    if (manifest === undefined) {
        try {
            manifest = JSON.parse(fs.readFileSync(path.join(workspaceDir, "workspace.json"), "utf8"));
        } catch (error) {
            stderr.write(`skills-set: ${workspaceDir}/workspace.json could not be read — ${error.code ?? error.message}\n`);
            return 2;
        }
    }

    let resolve = options.resolve;
    let fallbackRoots = options.fallbackRoots;
    if (resolve === undefined) {
        const named = many("--pack-root");
        const wantsDiscovery = named.includes(AUTO);
        const roots =
            rootPlan(workspaceDir, manifest, {
                named: named.filter((r) => r !== AUTO),
                discovery: wantsDiscovery ? discoverPackRoots() : null,
            }).roots ?? [];
        resolve = resolverFor({ workspaceDir, manifest, roots });
        // The same roots stand in as the owned set when nothing resolves — so a workspace that has
        // stopped composing gets its stale entries cleaned wherever its packs WOULD have been, not
        // only at the conventional path.
        fallbackRoots ??= roots;
    }

    const set = skillsSet(manifest, { pluginRoot, resolve, fallbackRoots });
    if (!set.ok) {
        stderr.write(`skills-set: ${set.reason}\n`);
        return set.exitCode;
    }

    // Reported on every run, in every mode. A pack registering through its own plugin is not a fault
    // and is not nothing — a reader who cannot see it will read the derived set as the whole answer.
    for (const { pack, root } of set.external) {
        stderr.write(
            `skills-set: the pack \`${pack}\` resolves outside this plugin root (${root}) — it registers ` +
                "through its own plugin or not at all, and nothing here can declare it\n",
        );
    }

    if (!check && !write) {
        for (const { path: p, pack } of set.paths) stdout.write(`${p}\t${pack}\n`);
        return 0;
    }

    const file = manifestPath(pluginRoot);
    const read = readManifest(file, pluginRoot);
    if (!read.ok) {
        stderr.write(`skills-set: ${read.reason}\n`);
        return 2;
    }

    if (check) {
        const verdict = compare(set, read.value, pluginRoot);
        if (verdict.agree) {
            stdout.write(`skills-set: ${path.relative(repoRoot, file) || file} declares every composed pack's skills (${set.paths.length})\n`);
            return 0;
        }
        if (verdict.why) {
            stderr.write(`skills-set: ${verdict.why}\n`);
            return 2;
        }
        for (const missing of verdict.missing) {
            stderr.write(
                `skills-set: a composed pack's skills live at ${missing} and no \`skills\` path declares it — ` +
                    "the host registers nothing there, so the skill ships, counts, and cannot be invoked\n",
            );
        }
        for (const extra of verdict.extra) {
            stderr.write(
                `skills-set: ${extra} is declared and belongs to no pack this workspace composes — the host ` +
                    "would load it without the workspace layer having asked for it\n",
            );
        }
        stderr.write("skills-set: run with --write to derive the `skills` key from `packs`\n");
        return 1;
    }

    const next = declaredFor(set, read.value, pluginRoot);
    if (next === null) {
        stderr.write(
            "skills-set: the plugin manifest declares `skills` as something other than an array — refusing to " +
                "replace a key nobody could read\n",
        );
        return 2;
    }
    const value = { ...read.value, skills: next };
    try {
        fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    } catch (error) {
        stderr.write(`skills-set: ${file} could not be written — ${error.code ?? error.message}\n`);
        return 2;
    }
    stdout.write(`skills-set: wrote ${next.length} \`skills\` path(s) to ${path.relative(repoRoot, file) || file}\n`);
    return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exit(run(process.argv.slice(2)));
}
