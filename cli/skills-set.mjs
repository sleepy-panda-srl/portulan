#!/usr/bin/env node
/**
 * The registrable set: the `skills` paths a plugin manifest must declare so a composed pack's skills register.
 *
 *   node cli/skills-set.mjs [--workspace <dir>] [--repo-root <dir>] [--plugin-root <dir>]
 *                           [--pack-root <dir>|auto ...] [--check|--write]
 *
 * Exit 0 derived (or, with `--check`, agrees) · 1 the manifest has drifted · 2 could not run.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { packDifferences, recordedOrigin, resolvePack, rootPlan, shadowedCopy } from "./compile.mjs";
import { AUTO, discoverPackRoots, namedWithAuto } from "./discover.mjs";

/** Claude Code 2.1.226 finds a skill at most one level below a declared skills root: `<root>/<skill>/SKILL.md`. */
export const HOST_SKILL_DEPTH = 1;

function refuse(reason) {
    return { ok: false, exitCode: 2, reason };
}

/** Lexical: a symlink is not followed, since nothing here opens a derived path. */
function escapes(root, candidate) {
    const rel = path.relative(root, candidate);
    return rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
}

export function canonical(relPath) {
    const posix = String(relPath).split(path.sep).join("/").replace(/^\.\//, "").replace(/\/+$/, "");
    return posix === "" ? "./" : `./${posix}/`;
}

/** `options.resolve(ref)` returns a pack's `{ root, manifest }` or `{ root, unreadable }`, and `null` when not found. */
export function skillsSet(manifest, options = {}) {
    const { packs = manifest?.packs ?? [], resolve = null, pluginRoot } = options;

    if (typeof pluginRoot !== "string" || !pluginRoot) {
        return refuse("no plugin root was given — there is nothing for a derived path to be relative to");
    }

    if (!Array.isArray(packs)) {
        return refuse(
            `this workspace's \`packs\` is not an array (${packs === null ? "null" : typeof packs}) — ` +
                "could-not-run rather than a set derived from a value nothing can enumerate",
        );
    }

    const paths = [];
    const external = [];
    const reportedExternal = new Set();
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
            return refuse(
                `the pack \`${ref}\` is composed by this workspace and could not be resolved — no pack.json ` +
                    "under any resolution root, so what it contributes to registration could not be read. " +
                    "Could-not-run rather than a set that quietly lost it",
            );
        }
        if (found.unreadable) {
            return refuse(
                `the pack \`${ref}\` is composed by this workspace and resolves at ${found.root}, but its ` +
                    `pack.json ${found.unreadable} — could-not-run rather than a set that quietly lost it`,
            );
        }

        const contributed = found.manifest?.contributes?.skills;
        if (contributed !== undefined && !Array.isArray(contributed)) {
            return refuse(
                `the pack \`${ref}\` declares \`contributes.skills\` as ` +
                    `${contributed === null ? "null" : typeof contributed}, not an array — could-not-run`,
            );
        }

        const packRoot = path.resolve(found.root);
        // `resolvePack` builds a pack directory as `<root>/<category>/<name>`.
        const resolutionRoot = path.resolve(packRoot, "..", "..");

        // Only an inside pack is owned: an outside pack's root may be `/`, which contains every plugin root.
        if (!escapes(pluginRoot, packRoot)) {
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

            if (escapes(packRoot, absolute)) {
                return refuse(
                    `the pack \`${ref}\` declares the skills root \`${entry}\`, which resolves outside the ` +
                        "pack itself — refusing to derive a declaration from it. `doctor` owns the verdict on that pack",
                );
            }

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

    const fallbackCandidates = (options.fallbackRoots ?? []).map((r) => path.resolve(r));
    for (const candidate of fallbackCandidates) {
        if (!escapes(candidate, pluginRoot)) {
            return refuse(
                `the pack root ${candidate} contains the plugin root itself — every declared skills path ` +
                    "would be indistinguishable from a pack's, including hand-written ones this tool must " +
                    "preserve. Name a narrower `--pack-root`",
            );
        }
    }
    const fallback = fallbackCandidates.filter((r) => !escapes(pluginRoot, r));
    return {
        ok: true,
        paths,
        external,
        composed: packs.length,
        owned: owned.size ? [...owned] : fallback.length ? fallback : [path.join(pluginRoot, "packs")],
    };
}

export function packPortion(skills, pluginRoot, ownedRoots) {
    if (skills === undefined) return { inside: [], outside: [], malformed: false };
    if (!Array.isArray(skills)) return { inside: [], outside: [], malformed: true };

    const roots = (ownedRoots ?? [path.join(pluginRoot, "packs")]).map((r) => path.resolve(r));
    const inside = [];
    const outside = [];
    for (const raw of skills) {
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
    const derived = set.paths.map((p) => p.path);
    const declared = portion.inside;
    const derivedSet = new Set(derived);
    const declaredSet = new Set(declared);
    const missing = derived.filter((p) => !declaredSet.has(p));
    const extra = declared.filter((p) => !derivedSet.has(p));
    return { agree: missing.length === 0 && extra.length === 0, missing, extra };
}

/** Every non-pack entry as it was, in order, then the derived paths; `null` when `skills` is not an array. */
export function declaredFor(set, pluginManifest, pluginRoot) {
    const portion = packPortion(pluginManifest?.skills, pluginRoot, set?.owned);
    if (portion.malformed) return null;
    return [...portion.outside, ...set.paths.map((p) => p.path)];
}

/** The refusal for a composed pack a second root also carries, or `null` when none is shadowed. */
export function shadowRefusal({ packs, roots, plan, repoRoot, pluginRoot }) {
    const originOf = (r) => (plan?.origins ?? []).find((o) => path.resolve(o.root) === path.resolve(r))?.origin;
    for (const ref of Array.isArray(packs) ? packs : []) {
        const found = resolvePack(ref, roots);
        if (!found?.dir || !found.manifest) continue;
        const behind = shadowedCopy(found.name, recordedOrigin(found.root, plan, repoRoot), roots, originOf);
        if (!behind) continue;

        const there = path.relative(repoRoot, behind.root) || behind.root;
        // `verify/plugin.sh` passes `--pack-root packs`, so only that root may claim to be what it checks.
        const rail = there === "packs" ? ", which is what `verify/plugin.sh` checks" : "";

        const load = (file) => {
            let text;
            try {
                text = fs.readFileSync(file, "utf8");
            } catch (error) {
                return { why: `could not be read — ${error.code ?? error.message}` };
            }
            try {
                return { value: JSON.parse(text) };
            } catch (error) {
                return { why: `does not parse as JSON — ${error.message}` };
            }
        };
        const here = load(found.manifest);
        const beneath = load(behind.manifest);
        const broken = here.why ? { at: found.root, why: here.why } : beneath.why ? { at: there, why: beneath.why } : null;
        if (broken) {
            return (
                `the pack \`${found.name}\` resolved under the root ${found.root} while the root ${there} also ` +
                `carries it, and the copy under ${broken.at} ${broken.why} — so which one this would derive ` +
                `from could not be established. Name the root: \`--pack-root ${there}\` derives from the tree${rail}, ` +
                "`--pack-root auto` from the installed copy"
            );
        }
        const mine = here.value;
        const other = beneath.value;

        const differs = packDifferences(mine, other);
        const split = escapes(pluginRoot, path.resolve(found.root)) !== escapes(pluginRoot, path.resolve(behind.root));
        return (
            `the pack \`${found.name}\` is SHADOWED — it resolved under ${found.root}, a root discovered on this ` +
            `host, while the root ${there} also carries it. ` +
            (differs.length
                ? `They differ by ${differs.join(" and ")}, and which root answers decides the derived set anyway: `
                : "Their manifests agree, and here that changes nothing: ") +
            (split
                ? "the two sit on opposite sides of this plugin root, so one of them derives a `skills` path for " +
                  "this pack and the other derives none — `--write` would act on whichever answered. "
                : "the two roots derive different `skills` paths, and `--write` would act on whichever answered. ") +
            `Refusing to pick: name the root instead — \`--pack-root ${there}\` derives from the tree${rail}, ` +
            "and `--pack-root auto` from the installed copy"
        );
    }
    return null;
}

/** Throws on a refused or could-not-run root plan; the resolver returns `null` for a pack it cannot find. */
export function resolverFor({ workspaceDir, manifest, named = [], discovery = null, roots = null }) {
    const plan = roots ? null : rootPlan(workspaceDir, manifest, { named, discovery });
    if (plan?.refusal) throw new Error(`skills-set: ${plan.refusal}`);
    if (plan?.couldNotRun) throw new Error(`skills-set: ${plan.couldNotRun}`);
    const resolved = roots ?? plan.roots ?? [];
    return (ref) => {
        const found = resolvePack(ref, resolved);
        if (!found?.dir || !found.manifest) return null;
        let text;
        try {
            text = fs.readFileSync(found.manifest, "utf8");
        } catch (error) {
            return { ref, root: path.resolve(found.dir), unreadable: `could not be read — ${error.code ?? error.message}` };
        }
        try {
            return { ref, root: path.resolve(found.dir), manifest: JSON.parse(text) };
        } catch (error) {
            return { ref, root: path.resolve(found.dir), unreadable: `does not parse as JSON — ${error.message}` };
        }
    };
}

export function manifestPath(pluginRoot) {
    return path.join(pluginRoot, ".claude-plugin", "plugin.json");
}

function readManifest(file, pluginRoot) {
    // Refuse a symlink at or below the plugin root, not above it: macOS's `os.tmpdir()` runs through `/var`.
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
        return { ok: false, reason: `${file} does not parse as JSON — ${error.message}` };
    }
}

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

    const askedBoth = namedWithAuto(
        many("--pack-root").filter((r) => r !== AUTO),
        many("--pack-root").includes(AUTO),
    );
    if (askedBoth) {
        stderr.write(`skills-set: ${askedBoth}\n`);
        return 2;
    }

    let manifest = options.manifest;
    if (manifest === undefined) {
        const file = path.join(workspaceDir, "workspace.json");
        let text;
        try {
            text = fs.readFileSync(file, "utf8");
        } catch (error) {
            stderr.write(`skills-set: ${file} could not be read — ${error.code ?? error.message}\n`);
            return 2;
        }
        try {
            manifest = JSON.parse(text);
        } catch (error) {
            stderr.write(`skills-set: ${file} does not parse as JSON — ${error.message}\n`);
            return 2;
        }
    }

    let resolve = options.resolve;
    let fallbackRoots = options.fallbackRoots;
    if (resolve === undefined) {
        const named = many("--pack-root");
        const wantsDiscovery = named.includes(AUTO);
        const namedRoots = named.filter((r) => r !== AUTO);
        const plan = rootPlan(workspaceDir, manifest, {
            named: namedRoots,
            // A thunk, so an arm that has no use for discovery never reads the host.
            discovery: options.discovery ?? (() => discoverPackRoots()),
            forced: wantsDiscovery,
        });
        if (plan.refusal || plan.couldNotRun) {
            stderr.write(`skills-set: ${plan.refusal ?? plan.couldNotRun}\n`);
            return 2;
        }
        const roots = plan.roots ?? [];
        if (!wantsDiscovery && plan.source !== "named") {
            const shadowed = shadowRefusal({ packs: manifest?.packs, roots, plan, repoRoot, pluginRoot });
            if (shadowed) {
                stderr.write(`skills-set: ${shadowed}\n`);
                return 2;
            }
        }
        resolve = resolverFor({ workspaceDir, manifest, roots });
        fallbackRoots ??= roots;
    }

    const set = skillsSet(manifest, { pluginRoot, resolve, fallbackRoots });
    if (!set.ok) {
        stderr.write(`skills-set: ${set.reason}\n`);
        return set.exitCode;
    }

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
