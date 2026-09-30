#!/usr/bin/env node
// Host plugin-cache discovery: reads a host's installed-plugin record to resolve a pointer and find pack roots.
//
//   node cli/discover.mjs [--json] <workspace-dir>
//
// Exit 0 resolved or resides-here · 1 not-installed or ambiguous · 2 could not run or could not look.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const RECORD = path.join("plugins", "installed_plugins.json");

/** Claude Code 2.1.226 writes record version `2`; a version not listed here reads as `unreadable`. */
export const RECORD_VERSIONS = new Set([2]);

export const MANIFEST_AT = ["workspace.json", path.join(".portulan", "workspace.json")];

/** A blank `CLAUDE_CONFIG_DIR` is unset: `path.resolve("")` would answer the working directory. */
export function configDir({ env = process.env, home = os.homedir() } = {}) {
    const named = env.CLAUDE_CONFIG_DIR;
    if (typeof named === "string" && named.trim() !== "") return path.resolve(named);
    return path.join(home, ".claude");
}

export function recordPath(options = {}) {
    return path.join(configDir(options), RECORD);
}

export function readInstalls(options = {}) {
    const file = recordPath(options);
    let raw;
    try {
        raw = fs.readFileSync(file, "utf8");
    } catch (cause) {
        if (cause.code === "ENOENT") return { state: "absent", path: file, entries: [], detail: null };
        return { state: "unreadable", path: file, entries: [], detail: cause.code ?? cause.message };
    }
    let record;
    try {
        record = JSON.parse(raw);
    } catch (cause) {
        return { state: "unreadable", path: file, entries: [], detail: `not JSON — ${cause.message}` };
    }
    if (record === null || typeof record !== "object" || Array.isArray(record) || typeof record.plugins !== "object" || record.plugins === null || Array.isArray(record.plugins)) {
        return { state: "unreadable", path: file, entries: [], detail: "no `plugins` object — this is not an installed-plugin record" };
    }
    if (!RECORD_VERSIONS.has(record.version)) {
        return {
            state: "unreadable",
            path: file,
            entries: [],
            detail:
                `record version ${JSON.stringify(record.version)} is not one this reader understands ` +
                `(${[...RECORD_VERSIONS].join(", ")}) — refusing rather than reading a shape nobody has verified`,
        };
    }
    const entries = [];
    for (const [key, installs] of Object.entries(record.plugins)) {
        if (!Array.isArray(installs)) continue;
        // `<plugin>@<marketplace>`, split on the LAST `@` so a scoped plugin name keeps its own.
        const at = key.lastIndexOf("@");
        const plugin = at > 0 ? key.slice(0, at) : key;
        const marketplace = at > 0 ? key.slice(at + 1) : null;
        for (const install of installs) {
            if (install === null || typeof install !== "object") continue;
            if (typeof install.installPath !== "string" || install.installPath === "") continue;
            entries.push({
                key,
                plugin,
                marketplace,
                installPath: path.resolve(install.installPath),
                version: typeof install.version === "string" ? install.version : null,
                scope: typeof install.scope === "string" ? install.scope : null,
                gitCommitSha: typeof install.gitCommitSha === "string" ? install.gitCommitSha : null,
            });
        }
    }
    return { state: "read", path: file, entries, detail: null };
}

function readCandidate(root) {
    for (const rel of MANIFEST_AT) {
        const file = path.join(root, rel);
        let parsed;
        try {
            parsed = JSON.parse(fs.readFileSync(file, "utf8"));
        } catch {
            continue;
        }
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) continue;
        if (typeof parsed.name !== "string") continue;
        // `workspace.json` is a common filename in other tools; `portulan.spec` is what marks a Portulan one.
        if (parsed.portulan === null || typeof parsed.portulan !== "object" || Array.isArray(parsed.portulan)) continue;
        if (typeof parsed.portulan.spec !== "string") continue;
        return { manifest: file, dir: path.dirname(file), name: parsed.name, kind: typeof parsed.kind === "string" ? parsed.kind : null };
    }
    return null;
}

export function resolveGovernor(governedBy, options = {}) {
    // Blank is unset, but padding is kept: normalising a slug is conformance, and conformance is `doctor`'s.
    const named = (value) => (typeof value === "string" && value.trim() !== "" ? value : null);
    const wanted = {
        workspace: named(governedBy?.workspace),
        feed: named(governedBy?.feed),
    };
    const verdict = (state, extra) => ({
        state,
        wanted,
        root: null,
        manifest: null,
        plugin: null,
        marketplace: null,
        version: null,
        matches: [],
        nearMisses: [],
        record: null,
        ...extra,
    });

    if (wanted.workspace === null) {
        return verdict("could-not-look", {
            sentence: "this pointer names no governing workspace, so there is nothing to resolve — `governed_by.workspace` is required of a pointer",
        });
    }

    const installs = options.installs ?? readInstalls(options);
    const where = installs.path;
    if (installs.state === "unreadable") {
        return verdict("could-not-look", {
            record: where,
            sentence:
                `the host's installed-plugin record at \`${where}\` could not be read (${installs.detail}), so whether ` +
                `\`${wanted.workspace}\` is installed here is unknown — this is *could not look*, never *not installed*`,
        });
    }
    if (installs.state === "absent") {
        return verdict("not-installed", {
            record: where,
            sentence:
                `\`${wanted.workspace}\` is not installed here — this host has no installed-plugin record at ` +
                `\`${where}\`, so nothing is installed for it to be among. Nothing was fetched: discovery reads ` +
                "what is on disk and never the network",
        });
    }

    const matches = [];
    const nearMisses = [];
    for (const entry of installs.entries) {
        const found = readCandidate(entry.installPath);
        if (found === null || found.name !== wanted.workspace) continue;
        const candidate = { ...entry, manifest: found.manifest, root: found.dir, kind: found.kind };
        if (wanted.feed !== null && entry.marketplace !== wanted.feed) {
            nearMisses.push({ ...candidate, why: "feed" });
            continue;
        }
        if (found.kind === "pointer") {
            nearMisses.push({ ...candidate, why: "pointer" });
            continue;
        }
        matches.push(candidate);
    }

    // One workspace installed at two scopes is two entries and one root, not an ambiguity.
    const roots = [...new Set(matches.map((m) => m.root))];
    if (roots.length > 1) {
        return verdict("ambiguous", {
            record: where,
            matches,
            nearMisses,
            sentence:
                `\`${wanted.workspace}\` resolves to ${roots.length} installed workspaces here — ` +
                `${matches.map((m) => `\`${m.key}\` at \`${m.root}\``).join(", ")}. Refusing to pick one: booting on a ` +
                "workspace the repository did not ask for looks exactly like a boot and is not one",
        });
    }
    if (roots.length === 1) {
        const hit = matches[0];
        return verdict("resolved", {
            record: where,
            matches,
            nearMisses,
            root: hit.root,
            manifest: hit.manifest,
            plugin: hit.plugin,
            marketplace: hit.marketplace,
            version: hit.version,
            sentence:
                `\`${wanted.workspace}\` is installed here — \`${hit.key}\`` +
                (hit.version ? ` version ${hit.version}` : "") +
                `, its manifest at \`${hit.manifest}\`. That directory is the workspace this repository is governed by`,
        });
    }
    return verdict("not-installed", {
        record: where,
        nearMisses,
        sentence:
            `\`${wanted.workspace}\` is not installed here — nothing among the ${installs.entries.length} install(s) ` +
            `recorded at \`${where}\` carries a workspace manifest of that name` +
            (nearMisses.length
                ? `. ${nearMisses
                      .map((m) =>
                          m.why === "feed"
                              ? `\`${m.key}\` carries that name and ships through ${
                                    m.marketplace === null ? "no marketplace the record names" : `\`${m.marketplace}\``
                                }, which is not the feed \`${wanted.feed}\` this pointer names`
                              : `\`${m.key}\` carries that name and is itself a pointer, and a repository is governed by exactly one workspace`,
                      )
                      .join("; ")}`
                : "") +
            ". Nothing was fetched: discovery reads what is on disk and never the network",
    });
}

// ===========================================================================================
// The command — the seam the boot skill reads
// ===========================================================================================

/** The resolver's verdicts; `run()` also exits 0 on `resides-here`, so a caller keys on `state`. */
export const EXIT = { resolved: 0, "not-installed": 1, ambiguous: 1, "could-not-look": 2 };

export function run(argv, options = {}) {
    const say = options.say ?? ((line) => process.stdout.write(`${line}\n`));
    const warn = options.warn ?? ((line) => process.stderr.write(`${line}\n`));
    const json = argv.includes("--json");
    const dirs = argv.filter((a) => !a.startsWith("-"));
    const KNOWN = new Set(["--json", "--help", "-h"]);
    const unknown = argv.filter((a) => a.startsWith("-") && !KNOWN.has(a));
    if (unknown.length) {
        warn(`discover: unknown option ${unknown.map((f) => `\`${f}\``).join(", ")} — refusing rather than ignoring it, because a dropped flag here returns prose where a caller asked for JSON.`);
        warn("usage: node cli/discover.mjs [--json] <workspace-dir>");
        return 2;
    }
    if (argv.includes("--help") || argv.includes("-h")) {
        say("usage: node cli/discover.mjs [--json] <workspace-dir>");
        say("");
        say("Resolves a `kind: pointer` manifest's `governed_by` against the host's installed-plugin");
        say("record. Reads what is on disk; never the network.");
        say("Exit: 0 resolved — and also `resides-here`, a manifest that is not a pointer · 1 not");
        say("resolvable here (`not-installed`, `ambiguous`) · 2 could not run or could not look.");
        say("Key on `state`: two states share exit 0 and the code cannot tell them apart.");
        return 0;
    }
    if (dirs.length !== 1) {
        warn("usage: node cli/discover.mjs [--json] <workspace-dir>");
        return 2;
    }
    const manifestPath = path.join(path.resolve(dirs[0]), "workspace.json");
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (cause) {
        warn(`discover: no readable manifest at ${manifestPath} — ${cause.message}`);
        return 2;
    }
    if (manifest?.kind !== "pointer") {
        const verdict = {
            state: "resides-here",
            root: path.dirname(manifestPath),
            manifest: manifestPath,
            wanted: null,
            sentence:
                `this manifest is \`kind: ${manifest?.kind ?? "unknown"}\`, not a pointer — the workspace governing this ` +
                `repository resides at \`${path.dirname(manifestPath)}\` and nothing needs resolving`,
        };
        say(json ? JSON.stringify(verdict, null, 2) : verdict.sentence);
        return 0;
    }
    const verdict = resolveGovernor(manifest.governed_by, options);
    say(json ? JSON.stringify(verdict, null, 2) : verdict.sentence);
    return EXIT[verdict.state] ?? 2;
}

// ===========================================================================================
// Pack-resolution roots
// ===========================================================================================

/** Matched against the raw `--pack-root` value, so a directory named `auto` is reached as `./auto`. */
export const AUTO = "auto";

export function isPackRoot(dir) {
    let categories;
    try {
        categories = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return false;
    }
    for (const category of categories) {
        if (!category.isDirectory() || category.name.startsWith(".")) continue;
        let packs;
        try {
            packs = fs.readdirSync(path.join(dir, category.name), { withFileTypes: true });
        } catch {
            continue;
        }
        for (const pack of packs) {
            if (!pack.isDirectory()) continue;
            if (fs.existsSync(path.join(dir, category.name, pack.name, "pack.json"))) return true;
        }
    }
    return false;
}

export function discoverPackRoots(options = {}) {
    const read = readInstalls(options);
    if (read.state === "absent") {
        return {
            ok: true,
            roots: [],
            installs: [],
            why: `${read.path} does not exist — this host has nothing installed, which is an answer rather than a failure to look`,
        };
    }
    if (read.state !== "read") {
        return {
            ok: false,
            roots: [],
            installs: [],
            why: `${read.path} could not be read (${read.state}${read.detail ? ` — ${read.detail}` : ""}). Discovery could not look; this is not the same as finding nothing installed`,
        };
    }
    const roots = [];
    const contributing = [];
    for (const install of read.entries) {
        // A repository-shaped plugin keeps its packs under `packs/`; a flat pack family is a root itself.
        for (const candidate of [path.join(install.installPath, "packs"), install.installPath]) {
            if (!isPackRoot(candidate)) continue;
            roots.push(candidate);
            contributing.push({ ...install, root: candidate });
        }
    }
    return { ok: true, roots, installs: contributing, why: null };
}

export const NAMED_WITH_AUTO =
    "name roots or ask for `auto`, never both: `--pack-root auto` cannot be combined with a named root";

/** The refusal to print, or `null` unless both a named root and `auto` were asked for. */
export function namedWithAuto(named = [], forced = false) {
    const given = Array.isArray(named) ? named.length > 0 : Boolean(named);
    return given && forced ? NAMED_WITH_AUTO : null;
}

/** A named root wins outright; otherwise discovered roots lead the derived ones, as `resolvePack` takes the first match. */
export function resolutionRoots({ named = [], namedGiven = null, derived = [], discovery = null, forced = false } = {}) {
    let cached;
    const resolveDiscovery = () => {
        if (cached === undefined) cached = typeof discovery === "function" ? discovery() : discovery;
        return cached;
    };
    // An explicitly empty named set searches nowhere rather than falling through to the derived root.
    const givenNamed = namedGiven ?? named.length > 0;
    const tag = (roots, origin) => roots.map((root) => ({ root, origin }));
    const plan = (roots, source, why, origins = null, refusal = null, couldNotRun = null) => ({
        roots,
        source,
        why,
        origins: origins ?? tag(roots, source),
        refusal,
        couldNotRun,
    });
    // `union` means discovery contributed a root or was asked for, not that the set has two origins.
    const union = (found, lead) => {
        const nothingFound = found.roots.length === 0 && found.why;
        return plan(
            [...found.roots, ...derived],
            "union",
            `${lead} (${found.roots.length} root(s))${nothingFound ? ` — ${found.why}` : ""} and derived from the manifest's \`tree\` (${derived.length} root(s)) — each pack's resolution states which of the two it came from`,
            [...tag(found.roots, "discovered"), ...tag(derived, "derived")],
        );
    };

    const refusal = namedWithAuto(givenNamed, forced);
    if (refusal) {
        return plan(
            [],
            "none",
            "both an explicit root and `auto` were given — discovery adds a root only where none was named, so this asks for two different resolution sets",
            [],
            refusal,
        );
    }
    if (givenNamed) {
        return plan(
            [...named],
            "named",
            named.length ? "named on the command line" : "named on the command line as an empty set — search nowhere",
        );
    }
    if (forced) {
        const found = resolveDiscovery();
        if (!found) {
            const why = "discovery was requested and did not run — no discovery was wired into this call";
            return plan([], "none", why, [], null, why);
        }
        // Asked for and could not look is could-not-run, never an empty set `doctor` would pass as unverifiable.
        if (!found.ok) return plan([], "none", found.why, [], null, found.why);
        return union(found, "discovered in the host plugin cache");
    }
    const found = discovery === null || discovery === undefined ? null : resolveDiscovery();
    if (found && found.ok && found.roots.length) return union(found, "discovered in the host plugin cache unasked");
    const said = (lead) => (found.why ? `${lead} — ${found.why}` : lead);
    const because = !found
        ? null
        : found.ok
          ? // `why` is optional: a record that lists no pack root carries none.
            said("discovery was consulted and found no root")
          : // Unasked, an unreadable record degrades to the derived root, reported rather than exit 2.
            said("discovery was consulted and could not look, so only the derived root is searched");
    if (derived.length) {
        return plan(
            [...derived],
            "derived",
            `derived from the workspace manifest's \`tree\`${because ? `; ${because}` : " — pass `--pack-root auto` to search the host plugin cache as well"}`,
        );
    }
    return plan(
        [],
        "none",
        `no root was named and none is derivable from the manifest; ${because ?? "discovery was not asked for (`--pack-root auto`)"}`,
    );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = run(process.argv.slice(2));
}
