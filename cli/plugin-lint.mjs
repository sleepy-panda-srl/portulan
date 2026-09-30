#!/usr/bin/env node
// `plugin-lint` — the packaging validator.
//
//   node cli/plugin-lint.mjs [--payload] <plugin-root> [<plugin-root> ...]
//
// Exit 0 the packaging holds together · 1 it does not · 2 could not run.
// It checks this repository's own invariants; `claude plugin validate --strict` owns the plugin contract.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { HOST_SKILL_DEPTH, skillsSet, canonical } from "./skills-set.mjs";

/** Raised when `plugin-lint` cannot run at all. Always exit 2, never 1. */
export class PluginLintError extends Error {
    constructor(message) {
        super(message);
        this.name = "PluginLintError";
    }
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Kept by hand with docs/plan.md's repo topology: visibility is a GitHub setting no file can read.
const PRIVATE_FEEDS = ["sleepy-panda-srl/portulan-internal"];
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const BLOCK_SCALAR = /^[|>][+-]?$/;

const PATH_FIELDS = [
    "skills",
    "commands",
    "workflows",
    "outputStyles",
    "hooks",
    "mcpServers",
    "lspServers",
];

// Only these: a SKILL.md under any other dot-directory is still walked and reported.
const SKIP_DIRS = new Set([".git", "node_modules", ".claude-plugin"]);

// Claude Code 2.1.215 loads agents from ./agents/ alone, and an `agents` key in plugin.json stops even that.
export const AGENT_DIR = "agents";
const MAX_WALK_DEPTH = 6;

// ===========================================================================================
// Frontmatter
// ===========================================================================================

/** A flat-YAML reader: `fields` is null without a usable block, and `error` is set when that is a defect. */
export function parseFrontmatter(text) {
    const lines = text.split(/\r?\n/);
    if (lines[0]?.trim() !== "---") return { fields: null };

    const close = lines.indexOf("---", 1);
    if (close === -1) {
        return { fields: null, error: "the frontmatter block is never closed" };
    }

    const fields = {};
    const body = lines.slice(1, close);
    for (let i = 0; i < body.length; i += 1) {
        const match = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(body[i]);
        if (!match) continue;
        const key = match[1];
        let value = match[2].trim();

        if (BLOCK_SCALAR.test(value)) {
            const collected = [];
            while (i + 1 < body.length && (body[i + 1].trim() === "" || /^\s+/.test(body[i + 1]))) {
                i += 1;
                collected.push(body[i].trim());
            }
            value = collected.join(" ").trim();
        } else if (
            (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
            (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
        ) {
            value = value.slice(1, -1);
        }
        fields[key] = value;
    }
    return { fields };
}

// ===========================================================================================
// Inspection
// ===========================================================================================

/** Lexical: a symlink inside `root` can still lead out of it. */
function escapes(root, target) {
    const inside = path.relative(root, target);
    return inside.startsWith("..") || path.isAbsolute(inside);
}

/** Throws PluginLintError only when the root is not a readable directory; `payload` excuses an absent marketplace.json. */
export function inspect(rawRoot, { payload = false } = {}) {
    let stat;
    try {
        stat = fs.statSync(path.resolve(rawRoot));
    } catch (error) {
        throw new PluginLintError(`cannot read ${rawRoot} — ${error.code ?? error.message}`);
    }
    if (!stat.isDirectory()) throw new PluginLintError(`${rawRoot} is not a directory`);
    // Canonical, since every containment check and set comparison below is between canonical paths.
    let root;
    try {
        root = fs.realpathSync(path.resolve(rawRoot));
    } catch (error) {
        throw new PluginLintError(`cannot resolve ${rawRoot} — ${error.code ?? error.message}`);
    }

    const findings = [];
    const stats = { skills: 0, agents: 0, paths: 0, unverifiable: 0 };
    const bindings = new Map();
    // Absent counts as examined: a plugin with no ./agents/ has genuinely bound nothing.
    let agentsExamined = false;
    const fail = (check, message) => findings.push({ severity: "fail", check, message });
    const note = (check, message) => findings.push({ severity: "note", check, message });

    /** Never throws: a failed read becomes a finding and returns null. */
    const read = (file, check, label) => {
        try {
            return fs.readFileSync(file, "utf8");
        } catch (error) {
            fail(check, `${label} could not be read — ${error.code ?? error.message}`);
            return null;
        }
    };

    /** Null on any problem, having recorded it as a finding. */
    const manifest = (rel) => {
        const file = path.join(root, rel);
        if (!fs.existsSync(file)) {
            fail("manifest", `${rel} is missing`);
            return null;
        }
        const text = read(file, "manifest", rel);
        if (text === null) return null;
        let value;
        try {
            value = JSON.parse(text);
        } catch (error) {
            fail("manifest", `${rel} does not parse as JSON — ${error.message}`);
            return null;
        }
        if (value === null || typeof value !== "object" || Array.isArray(value)) {
            fail("manifest", `${rel} is not a JSON object`);
            return null;
        }
        return value;
    };

    /** The canonical path and its kind, or null having recorded why. */
    const resolve = (raw, check, where) => {
        stats.paths += 1;
        if (typeof raw !== "string" || raw.trim() === "") {
            fail(check, `${where} declares a path that is not a string`);
            return null;
        }
        if (!raw.startsWith("./")) {
            fail(check, `${where} declares "${raw}" — a component path must start with "./"`);
            return null;
        }
        const target = path.resolve(root, raw);
        if (escapes(root, target)) {
            fail(check, `${where} declares "${raw}", which resolves outside the plugin root`);
            return null;
        }
        if (!fs.existsSync(target)) {
            fail(check, `${where} declares "${raw}", which does not resolve to anything`);
            return null;
        }
        let real;
        try {
            real = fs.realpathSync(target);
        } catch (error) {
            fail(check, `${where} declares "${raw}", which could not be resolved — ${error.code ?? error.message}`);
            return null;
        }
        if (escapes(root, real)) {
            fail(
                check,
                `${where} declares "${raw}", which is a link out of the plugin root (to ${real})`,
            );
            return null;
        }
        let stat;
        try {
            stat = fs.statSync(real);
        } catch (error) {
            fail(check, `${where} declares "${raw}", which could not be read — ${error.code ?? error.message}`);
            return null;
        }
        return { file: real, isDirectory: stat.isDirectory() };
    };

    const asList = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);

    // --- the two manifests --------------------------------------------------------------------

    const plugin = manifest(path.join(".claude-plugin", "plugin.json"));
    // lstat, not existsSync: existsSync follows links, so a dangling marketplace.json would read as absent.
    const marketPath = path.join(root, ".claude-plugin", "marketplace.json");
    let marketAbsent = false;
    let marketUnexaminable = null;
    try {
        fs.lstatSync(marketPath);
    } catch (error) {
        if (error.code === "ENOENT") marketAbsent = true;
        else marketUnexaminable = error.code ?? error.message;
    }
    let market = null;
    if (marketUnexaminable !== null) {
        fail(
            "manifest",
            `.claude-plugin/marketplace.json could not be examined — ${marketUnexaminable}. That is not ` +
                "absence: absent and unusable are different verdicts and this is the second, so it fails " +
                "here whether or not this root is a payload",
        );
    } else if (payload && marketAbsent) {
        stats.unverifiable += 1;
        note(
            "market",
            "payload root — no marketplace.json, and none is owed: the feed that ships this directory " +
                "carries the entry, so the name, version and source path it is published under are not " +
                "checkable from here",
        );
    } else {
        market = manifest(path.join(".claude-plugin", "marketplace.json"));
    }

    if (plugin) {
        if (typeof plugin.name !== "string") {
            fail("plugin", "plugin.json has no string `name` — it is the one required field");
        } else if (!SLUG.test(plugin.name)) {
            fail("plugin", `plugin.json name "${plugin.name}" is not kebab-case`);
        }
        if (plugin.version !== undefined) {
            if (typeof plugin.version !== "string" || !SEMVER.test(plugin.version)) {
                fail("plugin", `plugin.json version ${JSON.stringify(plugin.version)} is not SemVer`);
            }
        }
    }

    if (market) {
        if (typeof market.name !== "string" || !SLUG.test(market.name)) {
            fail("market", "marketplace.json needs a kebab-case string `name`");
        }
        const owner = market.owner;
        if (!owner || typeof owner !== "object" || typeof owner.name !== "string" || !owner.name) {
            fail("market", "marketplace.json needs an `owner` object with a `name`");
        }
        if (!Array.isArray(market.plugins)) {
            fail("market", "marketplace.json needs a `plugins` array");
        } else if (market.plugins.length === 0) {
            // Stricter than `claude plugin validate`, which only warns about an empty marketplace.
            fail("market", "marketplace.json declares no plugins — a marketplace that ships nothing");
        }
    }

    // --- the marketplace entries, and whether they agree with plugin.json ----------------------

    for (const [index, entry] of (Array.isArray(market?.plugins) ? market.plugins : []).entries()) {
        const label = `marketplace plugins[${index}]`;
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            fail("market", `${label} is not an object`);
            continue;
        }
        const name = typeof entry.name === "string" ? entry.name : null;
        if (!name || !SLUG.test(name)) {
            fail("market", `${label} needs a kebab-case string \`name\``);
        }
        if (entry.source === undefined) {
            fail("market", `${label} ("${name ?? "?"}") declares no \`source\``);
            continue;
        }
        if (typeof entry.source !== "string") {
            const target = [entry.source?.repo, entry.source?.url, entry.source?.package]
                .filter((v) => typeof v === "string")
                .join(" ");
            // Compared as owner/name pairs, case-insensitively, as GitHub compares repository names.
            const segments = target.toLowerCase().split(/[\s/:@]+/).map((seg) => seg.replace(/\.git$/, "")).filter(Boolean);
            const pairs = new Set(segments.slice(0, -1).map((seg, i) => `${seg}/${segments[i + 1]}`));
            if (PRIVATE_FEEDS.some((feed) => pairs.has(feed.toLowerCase()))) {
                fail(
                    "market",
                    `${label} ("${name ?? "?"}") is sourced from the private feed (\`${target}\`). ` +
                        "A public marketplace may not point into a private one: the fetch 404s for every " +
                        "stranger, and the entry publishes the private feed's structure. The ruling is " +
                        "one-way — the feed points at this repository, never the reverse",
                );
                continue;
            }
            stats.unverifiable += 1;
            note("market", `${label} ("${name ?? "?"}") has an off-tree source — not verifiable here`);
            continue;
        }

        const resolved = resolve(entry.source, "market", `${label} ("${name ?? "?"}") source`);
        if (!resolved) continue;

        // This entry is this plugin; at runtime plugin.json wins, so a disagreement would go unseen.
        if (resolved.file === root && plugin) {
            if (name && typeof plugin.name === "string" && name !== plugin.name) {
                fail(
                    "agree",
                    `${label} names "${name}" but plugin.json names "${plugin.name}" — same plugin, two names`,
                );
            }
            if (
                typeof entry.version === "string" &&
                typeof plugin.version === "string" &&
                entry.version !== plugin.version
            ) {
                fail(
                    "agree",
                    `${label} version ${entry.version} disagrees with plugin.json ${plugin.version}`,
                );
            }
        }
    }

    // --- component paths ----------------------------------------------------------------------

    const declaredSkillRoots = [];

    for (const field of PATH_FIELDS) {
        for (const raw of asList(plugin?.[field])) {
            // An inline object for hooks / MCP / LSP is configuration, not a path claim.
            if (typeof raw === "object" && raw !== null) continue;
            const resolved = resolve(raw, "paths", `plugin.json ${field}`);
            if (!resolved) continue;
            if (field === "skills") declaredSkillRoots.push(resolved);
        }
    }

    if (plugin !== null && typeof plugin === "object" && plugin.agents !== undefined) {
        fail(
            "agents",
            "plugin.json declares `agents` — measured 2026-07-26 on Claude Code v2.1.215, the key " +
                `suppresses the scan of ./${AGENT_DIR}/ and loads nothing. Remove it; agents load by ` +
                "convention",
        );
    }

    // --- the skills behind those paths ----------------------------------------------------------

    const skillDirs = new Set();
    for (const { file: skillRoot, isDirectory } of declaredSkillRoots) {
        if (!isDirectory) {
            fail("skills", `plugin.json skills path ${path.relative(root, skillRoot)} is not a directory`);
            continue;
        }
        const expanded = expandDeclaredSkillRoot(skillRoot);
        if (expanded.unreadable !== undefined) {
            fail("skills", `${path.relative(root, skillRoot)} could not be read — ${expanded.unreadable}`);
            continue;
        }
        if (expanded.empty) {
            fail(
                "skills",
                `plugin.json declares ${path.relative(root, skillRoot)} but it contains no skill`,
            );
            continue;
        }
        for (const dir of expanded.found) skillDirs.add(dir);
        for (const dir of expanded.barren) {
            fail("skills", `${path.relative(root, dir)}/ has no SKILL.md`);
        }
        for (const dir of expanded.truncated) {
            fail(
                "skills",
                `${path.relative(root, dir)}/ has subdirectories this validator did not search — the ` +
                    `walk below a declared skills path stops ${MAX_DECLARED_SKILL_DEPTH} levels down. ` +
                    `Declare the deeper directory as its own skills path, or flatten the tree; what ` +
                    `this check must never do is go green over what it could not reach. It is NOT a ` +
                    `report that the directory is empty — this walk stopped, it did not finish and ` +
                    `find nothing`,
            );
        }
        for (const { dir, why } of expanded.unreadableBranches ?? []) {
            fail(
                "skills",
                `${path.relative(root, dir)}/ could not be read — ${why}. This validator cannot say ` +
                    `whether a skill is packaged below it, so it says that rather than reporting the ` +
                    `branch empty: could-not-look is not nothing-there`,
            );
        }
        for (const dir of expanded.beyondHostReach ?? []) {
            fail(
                "skills",
                `${path.relative(root, dir)}/ sits more than ${HOST_SKILL_DEPTH} level below the ` +
                    `declared root ${path.relative(root, skillRoot)} — this validator resolves it and ` +
                    `the HOST does not, so it would be counted here and inert on every install. ` +
                    `Declare ${path.relative(root, path.dirname(dir))}/ instead`,
            );
        }
    }

    for (const dir of [...skillDirs].sort()) {
        const rel = path.relative(root, dir);
        const file = path.join(dir, "SKILL.md");
        if (!fs.existsSync(file)) {
            fail("skills", `${rel}/ has no SKILL.md`);
            continue;
        }
        stats.skills += 1;
        const text = read(file, "skills", `${rel}/SKILL.md`);
        if (text === null) continue;
        // The host would name a `"./"`-form skill without `name` after its install directory, a version string.
        checkFrontmatter(text, `${rel}/SKILL.md`, "skills", { requireName: true });
    }

    // --- composition drives registration -------------------------------------------------------
    // Claude Code 2.1.226 registers skills from plugin.json alone, whatever the workspace composes.

    const GOVERNING = path.join(".portulan", "workspace.json");
    let composition;
    let composable = true;
    try {
        composition = JSON.parse(fs.readFileSync(path.join(root, GOVERNING), "utf8"));
    } catch (error) {
        if (error.code === "ENOENT") composable = false;
        else {
            fail(
                "compose",
                `${GOVERNING} could not be read — ${error.code ?? error.message}; composition was ` +
                    "not checked against the declared skills, so this run establishes nothing about it",
            );
            composable = false;
        }
    }

    if (composable && (composition === null || typeof composition !== "object" || Array.isArray(composition))) {
        fail(
            "compose",
            `${GOVERNING} parses but is not a JSON object (${jsonKind(composition)}) — ` +
                "composition could not be read from it, so parity with the declared skills is unchecked",
        );
        composable = false;
    }

    if (composable && composition.packs !== undefined && !Array.isArray(composition.packs)) {
        fail(
            "compose",
            `${GOVERNING} declares \`packs\` as ${jsonKind(composition.packs)} rather than an array — ` +
                "no composition could be read from it, so parity with the declared skills is unchecked",
        );
        composable = false;
    }

    if (composable) {
        const packsRoot = path.join(root, "packs");
        const composed = [];
        for (const entry of Array.isArray(composition.packs) ? composition.packs : []) {
            if (typeof entry !== "string" || entry === "") {
                fail(
                    "compose",
                    `${GOVERNING} has a \`packs\` entry that is not a non-empty string ` +
                        `(${JSON.stringify(entry)}) — it was not checked against the declared skills`,
                );
                continue;
            }
            const name = entry;
            const dir = path.join(packsRoot, name);
            if (escapes(packsRoot, dir)) {
                fail(
                    "compose",
                    `${GOVERNING} composes \`${name}\`, which names a path outside ./packs/ — nothing ` +
                        "was walked for it, so composition is unchecked for that entry",
                );
                continue;
            }
            let real;
            try {
                real = fs.realpathSync(dir);
            } catch {
                real = dir; // absent, or unreadable — the stat below reports it as itself.
            }
            if (escapes(packsRoot, real)) {
                fail(
                    "compose",
                    `${GOVERNING} composes \`${name}\`, which resolves outside ./packs/ — ` +
                        "a link out of the packs tree. Nothing was walked; composition is unchecked for it",
                );
                continue;
            }
            // Only `real` from here: the set comparisons below are by string, against canonical paths.
            let stat;
            try {
                stat = fs.statSync(real);
            } catch (error) {
                note(
                    "compose",
                    `${GOVERNING} composes \`${name}\`, which does not resolve under ./packs/ — ` +
                        `${error.code ?? error.message}. \`doctor\` owns that verdict; nothing here ` +
                        "could check its skills",
                );
                continue;
            }
            if (!stat.isDirectory()) {
                note(
                    "compose",
                    `${GOVERNING} composes \`${name}\`, and ./packs/${name} is not a directory — ` +
                        "nothing was walked for it. `doctor` owns that verdict",
                );
                continue;
            }
            composed.push({ name, dir: real });
        }

        for (const { name, dir } of composed) {
            const problems = [];
            for (const skillDir of walkForSkills(root, dir, 0, [], problems)) {
                if (skillDirs.has(skillDir)) continue;
                fail(
                    "compose",
                    `${GOVERNING} composes \`${name}\` and ${path.relative(root, skillDir)}/ is one of ` +
                        "its skills, but no plugin.json `skills` path reaches it — the host registers " +
                        "nothing here, so the skill ships, counts, and cannot be invoked. Declare " +
                        `./${path.relative(root, path.dirname(skillDir))}/`,
                );
            }
            for (const { dir: where, why } of problems) {
                fail(
                    "compose",
                    `${GOVERNING} composes \`${name}\` and ${path.relative(root, where)}/ ${why} — so a ` +
                        "skill there would be invisible to this check. Composition is unchecked below that point",
                );
            }
        }

        for (const skillDir of skillDirs) {
            if (escapes(packsRoot, skillDir)) continue;
            if (composed.some(({ dir }) => skillDir === dir || !escapes(dir, skillDir))) continue;
            fail(
                "compose",
                `plugin.json registers ${path.relative(root, skillDir)}/, which is inside ./packs/ and ` +
                    `belongs to no pack ${GOVERNING} composes — the host would load it without the ` +
                    "workspace layer having asked for it. Compose the pack, or stop declaring it",
            );
        }

        // --- the declaration side: what each composed pack's pack.json nominates ---------------
        // The walk above goes green over a nominated root that is missing or unreadable; this half does not.
        const declaring = [];
        const resolved = new Map();
        for (const { name, dir } of composed) {
            let text;
            try {
                text = fs.readFileSync(path.join(dir, "pack.json"), "utf8");
            } catch (error) {
                if (error.code === "ENOENT") continue;
                fail(
                    "compose",
                    `${GOVERNING} composes \`${name}\` and its pack.json could not be read — ` +
                        `${error.code ?? error.message}. What it nominates for registration is unchecked`,
                );
                continue;
            }
            let parsed;
            try {
                parsed = JSON.parse(text);
            } catch (error) {
                fail(
                    "compose",
                    `${GOVERNING} composes \`${name}\` and its pack.json does not parse as JSON — ` +
                        `${error.message}. What it nominates for registration is unchecked`,
                );
                continue;
            }
            declaring.push(name);
            resolved.set(name, { ref: name, root: dir, manifest: parsed });
        }
        const derived = skillsSet(composition, {
            packs: declaring,
            pluginRoot: root,
            resolve: (ref) => resolved.get(ref) ?? null,
        });
        if (!derived.ok) {
            fail(
                "compose",
                `the registrable set could not be derived from ${GOVERNING} — ${derived.reason}. ` +
                    "Composition is unchecked on the declaration side",
            );
        } else {
            const declaredRoots = new Set(declaredSkillRoots.map(({ file }) => canonical(path.relative(root, file))));
            for (const { path: want, pack: packName } of derived.paths) {
                if (declaredRoots.has(want)) continue;
                // Declaring each skill by its own path registers them as well as declaring the root.
                const problems = [];
                const beneath = walkForSkills(root, path.join(root, want), 0, [], problems);
                if (problems.length === 0 && beneath.length > 0 && beneath.every((d) => skillDirs.has(d))) continue;
                if (problems.length === 0 && beneath.length === 0) {
                    note(
                        "compose",
                        `${GOVERNING} composes \`${packName}\`, whose pack.json nominates ${want} as a skills ` +
                            "root, and nothing there holds a SKILL.md — there is nothing to register. " +
                            "`doctor` owns the verdict on that pack",
                    );
                    continue;
                }
                fail(
                    "compose",
                    `${GOVERNING} composes \`${packName}\`, whose pack.json nominates ${want} as a skills root, ` +
                        `and no plugin.json \`skills\` path declares it${problems.length ? " (and it could not be examined in full)" : ""} — ` +
                        `the host registers nothing from it. Declare ${want}`,
                );
            }
        }
    }

    // Notes, not failures: an undeclared SKILL.md or a stray agent file may be an example or a fixture.
    for (const stranded of walkForStrandedAgents(root)) {
        note(
            "agents",
            `${path.relative(root, stranded)} is not in ./${AGENT_DIR}/, the only directory the host ` +
                "loads agents from — it will not load",
        );
    }

    for (const found of walkForSkills(root)) {
        if (!skillDirs.has(found)) {
            note(
                "skills",
                `${path.relative(root, found)}/SKILL.md is not covered by any declared skills path`,
            );
        }
    }

    // --- the agents at the convention location --------------------------------------------------

    // lstat, not existsSync: a broken ./agents/ link is unusable, not absent.
    let state;
    try {
        fs.lstatSync(path.join(root, AGENT_DIR));
        state = "present";
    } catch (error) {
        if (error.code === "ENOENT") {
            state = "absent";
        } else {
            state = "unknown";
            fail("agents", `./${AGENT_DIR}/ could not be examined — ${error.code ?? error.message}`);
        }
    }
    if (state === "unknown") {
        // Already failed above.
    } else if (state === "absent") {
        note("agents", `no ./${AGENT_DIR}/ directory — this plugin ships no agents`);
        agentsExamined = true;
    } else {
        const dir = resolve(`./${AGENT_DIR}/`, "agents", "the plugin's agents directory");
        if (dir) {
            if (!dir.isDirectory) {
                fail("agents", `./${AGENT_DIR}/ is not a directory`);
            } else {
                let entries;
                try {
                    entries = fs.readdirSync(dir.file, { withFileTypes: true });
                } catch (error) {
                    fail("agents", `./${AGENT_DIR}/ could not be read — ${error.code ?? error.message}`);
                    entries = null;
                }
                if (entries) {
                    agentsExamined = true;
                    // `isFile()` is false for a symlink: links are judged here, not dropped unseen.
                    const files = entries
                        .filter((e) => e.name.endsWith(".md") && (e.isFile() || e.isSymbolicLink()))
                        .map((e) => ({ file: path.join(dir.file, e.name), link: e.isSymbolicLink() }))
                        .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
                    if (files.length === 0) {
                        fail("agents", `./${AGENT_DIR}/ exists but contains no agent`);
                    }
                    for (const { file, link } of files) {
                        const rel = path.relative(root, file);
                        stats.agents += 1;
                        if (link) {
                            let real = null;
                            try {
                                real = fs.realpathSync(file);
                            } catch (error) {
                                fail("agents", `${rel} is a link that does not resolve — ${error.code ?? error.message}`);
                                continue;
                            }
                            if (escapes(root, real)) {
                                fail("agents", `${rel} is a link out of the plugin root (to ${real})`);
                                continue;
                            }
                        }
                        const text = read(file, "agents", rel);
                        if (text === null) continue;
                        const fields = checkFrontmatter(text, rel, "agents", { requireName: true });
                        bindings.set(path.basename(file, ".md"), { rel, name: fields?.name });
                    }
                }
            }
        }
    }

    // ---- the persona ↔ binding correspondence
    // Fails where doctor only reports: this bundle targets one host, and an unbound persona is inert there.
    const personaDir = path.join(root, "core", "personas");
    let personaFiles = null;
    try {
        personaFiles = fs
            .readdirSync(personaDir)
            .filter((entry) => entry.endsWith(".md") && entry !== "README.md")
            .map((entry) => path.basename(entry, ".md"))
            .sort();
    } catch (error) {
        if (error.code !== "ENOENT") fail("agents", `core/personas/ could not be read — ${error.code ?? error.message}, so the binding correspondence went unchecked`);
    }
    if (personaFiles && !agentsExamined) {
        note(
            "agents",
            `the persona↔binding correspondence went unchecked — ./${AGENT_DIR}/ could not be examined, so an empty binding set is a ` +
                `question nobody answered rather than ${personaFiles.length} persona(s) with nothing bound to them`,
        );
    } else if (personaFiles) {
        for (const persona of personaFiles) {
            const binding = bindings.get(persona);
            if (!binding) {
                fail(
                    "agents",
                    `core/personas/${persona}.md has no binding at ./${AGENT_DIR}/${persona}.md — a persona this plugin ships and does not bind ` +
                        `is doctrine the host never registers, which looks from the outside exactly like a role that is available`,
                );
                continue;
            }
            if (binding.name !== undefined && binding.name !== persona) {
                fail(
                    "agents",
                    `${binding.rel} binds \`core/personas/${persona}.md\` by its filename while declaring \`name: ${binding.name}\` — the host keys ` +
                        `on the field, so the two disagree about which role this file registers`,
                );
            }
        }
        const personaNames = new Set(personaFiles);
        for (const [name, binding] of bindings) {
            if (!personaNames.has(name)) {
                fail(
                    "agents",
                    `${binding.rel} binds no persona — there is no \`core/personas/${name}.md\`. A host file that outlived the doctrine it was ` +
                        `bound to registers a role with no charter behind it`,
                );
            }
        }
    }

    /** The parsed fields, or null when there were none. */
    function checkFrontmatter(text, label, check, { requireName }) {
        const { fields, error } = parseFrontmatter(text);
        if (!fields) {
            fail(check, `${label} has no usable frontmatter${error ? ` — ${error}` : ""}`);
            return null;
        }
        if (!fields.description) {
            fail(check, `${label} has no non-empty \`description\` — it is what decides when it loads`);
        }
        if (fields.name !== undefined && !SLUG.test(fields.name)) {
            fail(check, `${label} declares name "${fields.name}", which is not kebab-case`);
        } else if (requireName && fields.name === undefined) {
            fail(check, `${label} has no \`name\``);
        }
        return fields;
    }

    return { findings, stats };
}

function walkForStrandedAgents(root, dir = root, depth = 0, found = []) {
    if (depth > MAX_WALK_DEPTH) return found;
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return found;
    }
    if (dir !== path.join(root, AGENT_DIR) && path.basename(dir) === AGENT_DIR) {
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith(".md")) found.push(path.join(dir, entry.name));
        }
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (SKIP_DIRS.has(entry.name)) continue;
        walkForStrandedAgents(root, path.join(dir, entry.name), depth + 1, found);
    }
    return found;
}

function jsonKind(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "an array";
    return typeof value === "object" ? "an object" : typeof value;
}

function walkForSkills(root, dir = root, depth = 0, found = [], problems = null) {
    if (depth > MAX_WALK_DEPTH) {
        if (problems) problems.push({ dir, why: `not searched — deeper than ${MAX_WALK_DEPTH} levels` });
        return found;
    }
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
        if (problems) problems.push({ dir, why: `could not be read — ${error.code ?? error.message}` });
        return found;
    }
    if (entries.some((e) => e.isFile() && e.name === "SKILL.md")) found.push(dir);
    if (problems) {
        for (const entry of entries) {
            if (entry.name === "SKILL.md" && entry.isSymbolicLink()) {
                problems.push({
                    dir,
                    why: "holds a SKILL.md that is a SYMLINK — this walk does not follow it and the " +
                        "declared-path walk does, so the two disagree about whether the skill is here",
                });
            }
        }
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (SKIP_DIRS.has(entry.name)) continue;
        walkForSkills(root, path.join(dir, entry.name), depth + 1, found, problems);
    }
    return found;
}

// Three reaches `<pack>/skills/<skill>/SKILL.md` from a declared root.
const MAX_DECLARED_SKILL_DEPTH = 3;

/** `{ unreadable }` alone when the root cannot be read; otherwise each outcome in its own list. */
function expandDeclaredSkillRoot(skillRoot) {
    const found = [];
    const truncated = [];
    const barren = [];
    // Not `unreadable`: the caller reads that key's presence as the whole root being unreadable.
    const unreadableBranches = [];
    const beyondHostReach = [];

    // True once a branch is accounted for; false only when searched to the bottom without a skill.
    const walk = (dir, depth) => {
        if (fs.existsSync(path.join(dir, "SKILL.md"))) {
            found.push(dir);
            if (depth > HOST_SKILL_DEPTH) beyondHostReach.push(dir);
            return true;
        }
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (error) {
            unreadableBranches.push({ dir, why: error.code ?? error.message });
            return true;
        }
        const children = entries.filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name));
        if (children.length === 0) return false;
        if (depth >= MAX_DECLARED_SKILL_DEPTH) {
            truncated.push(dir);
            return true;
        }
        let any = false;
        for (const child of children) {
            if (walk(path.join(dir, child.name), depth + 1)) any = true;
        }
        return any;
    };

    // The `"./"` form: a root holding a SKILL.md is one skill, whatever lies beneath it.
    if (fs.existsSync(path.join(skillRoot, "SKILL.md"))) {
        return { found: [skillRoot], barren, truncated, unreadableBranches, beyondHostReach, empty: false };
    }

    let entries;
    try {
        entries = fs.readdirSync(skillRoot, { withFileTypes: true });
    } catch (error) {
        return { unreadable: error.code ?? error.message };
    }
    const children = entries.filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name));
    if (children.length === 0) return { found, barren, truncated, unreadableBranches, beyondHostReach, empty: true };

    for (const child of children) {
        const dir = path.join(skillRoot, child.name);
        if (!walk(dir, 1)) barren.push(dir);
    }
    return { found, barren, truncated, unreadableBranches, beyondHostReach, empty: false };
}

// ===========================================================================================
// The command
// ===========================================================================================

const ICON = { fail: "FAIL", note: "note" };

export async function run(argv, options = {}) {
    const say = options.quiet ? () => {} : (line = "") => process.stdout.write(`${line}\n`);
    try {
        const payload = argv.includes("--payload");
        const unknown = argv.filter((a) => a.startsWith("-") && a !== "--payload");
        if (unknown.length) {
            if (!options.quiet) {
                process.stderr.write(`plugin-lint: unknown option ${unknown.join(", ")}\n`);
            }
            return 2;
        }
        const roots = argv.filter((a) => !a.startsWith("-"));
        if (roots.length === 0) {
            if (!options.quiet) {
                process.stderr.write("usage: node cli/plugin-lint.mjs [--payload] <plugin-root> [<plugin-root> ...]\n");
                process.stderr.write("  --payload  the roots are payloads a feed publishes: no marketplace.json here, and none owed\n");
            }
            return 2;
        }

        let failed = 0;
        for (const root of roots) {
            const { findings, stats } = inspect(root, { payload });
            const bad = findings.filter((f) => f.severity === "fail");
            say(root);
            for (const f of findings) say(`  ${ICON[f.severity]} ${f.check.padEnd(8)} ${f.message}`);
            say(
                `  ${bad.length ? "RED" : "GREEN"} — ${bad.length} failure(s), ` +
                    `${findings.length - bad.length} note(s), ${stats.skills} skill(s), ` +
                    `${stats.agents} agent(s), ${stats.paths} path(s) checked` +
                    (stats.unverifiable ? `, ${stats.unverifiable} unverifiable` : ""),
            );
            say();
            if (bad.length) failed += 1;
        }
        return failed ? 1 : 0;
    } catch (error) {
        if (!options.quiet) {
            process.stderr.write(
                `plugin-lint: ${
                    error instanceof PluginLintError
                        ? error.message
                        : `unanticipated failure — ${error.stack ?? error}`
                }\n`,
            );
        }
        return 2;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = await run(process.argv.slice(2));
}
