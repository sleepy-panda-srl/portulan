#!/usr/bin/env node
// `plugin-lint` — the packaging validator.
//
//   node cli/plugin-lint.mjs <plugin-root>
//
// Exit 0 the packaging holds together · 1 it does not · 2 could not run. Same three codes as
// ./doctor.mjs and for the same reason: a verdict ABOUT the tree is 1, and 2 means nothing was
// judged at all. Borrowing 1 for the second would claim a judgement nobody reached.
//
// ## What this checks, and what it deliberately does not
//
// This validator checks **this repository's own invariants** about its packaging: that both
// manifests parse and are objects, that the fields this repository depends on are present and
// correctly shaped, that the two manifests agree with each other, that every path they declare
// starts with `./`, stays inside the tree, and resolves — and that every skill and agent behind
// those paths is a real artifact with frontmatter and a non-empty description.
//
// It is **not** an implementation of the Claude Code plugin contract, and must never be described
// as one. `claude plugin validate --strict` is the authority for that contract; it is run at the
// supervised checkpoints and before any release, and its result is recorded in the session log.
// The split exists because CI here installs nothing by stated doctrine (.github/workflows/verify.yml),
// so a recipe declaring the `claude` binary as a dependency would exit 2 — "could not run" — on
// every pull request, which under this repository's own precondition rule is permanently red.
//
// So: the platform's contract is checked by the platform's own tool at a checkpoint, and the rail
// that runs on every pull request checks what this repository can honestly own. The gap between
// those two is real and is stated in ./README.md and in ../.portulan/products/portulan/affordances.md
// rather than left for someone to discover — a mandate nothing checks is already broken
// (../.portulan/memory/a-mandate-nothing-checks-is-already-broken.md), and so is a claim of coverage
// nothing measures.
//
// Explicitly NOT checked, each for a reason:
//   * reserved marketplace names — the platform re-checks that list on every marketplace load and
//     has already changed it once. A copy frozen here would drift into either a false red or a
//     false green, and the platform enforces it where it actually matters.
//   * field semantics beyond shape — whether a description is *good*, whether a skill is worth its
//     tokens. That is review, and ../core/skills/README.md holds the bar.
//   * anything needing the network. Nothing here fetches (../.portulan/verify/README.md).
//   * whether the plugin, once installed, behaves. That is the fresh-machine install demonstration
//     the milestone-3 criterion asks for, and no lint can stand in for it.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Raised when `plugin-lint` cannot run at all. Always exit 2, never 1. */
export class PluginLintError extends Error {
    constructor(message) {
        super(message);
        this.name = "PluginLintError";
    }
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Deliberately permissive about pre-release and build metadata, strict about the three numbers:
// the platform compares version strings, and this repository's own convention is SemVer from
// v0.1.0 (../docs/plan.md, Protocol → Versioning).
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

// Manifest keys whose value may name a path. `hooks`, `mcpServers` and `lspServers` also accept an
// inline object, so only string values are treated as paths — an object there is configuration, not
// a claim about the tree.
const PATH_FIELDS = [
    "skills",
    "agents",
    "commands",
    "workflows",
    "outputStyles",
    "hooks",
    "mcpServers",
    "lspServers",
];

// Directories never walked when looking for skills nobody declared: `.git` and `node_modules` for
// size, and `.claude-plugin/` because it holds manifests rather than skills. Deliberately NOT a
// blanket dot-directory rule — a SKILL.md under any other dot-directory is walked and reported,
// because "declared is what ships" and a skill hidden from this pass is one its author believes is
// shipping. Reporting beats skipping here for the same reason it does everywhere else in this tree.
const SKIP_DIRS = new Set([".git", "node_modules", ".claude-plugin"]);
const MAX_WALK_DEPTH = 6;

// ===========================================================================================
// Frontmatter
// ===========================================================================================
//
// A deliberately small YAML reader: enough for `name` and `description`, and honest about the rest.
// The policy is the same one ./doctor.mjs applies to a repo card — parse conservatively, because a
// false red is what gets a whole recipe switched off — with one inversion: the ABSENCE of a
// frontmatter block is reported, because for a skill the block is the contract, not decoration.

/**
 * @returns {{fields: Record<string,string>|null, error?: string}}
 *   `fields` is null when there is no usable frontmatter; `error` says why when that is a defect
 *   rather than simply an absent block.
 */
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
        // Only the first colon splits: `description: Use when: x` is one value, not a truncated
        // one. Getting this wrong would silently shorten exactly the field this validator judges.
        const match = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(body[i]);
        if (!match) continue;
        const key = match[1];
        let value = match[2].trim();

        // A block scalar (`|`, `>`, with any chomping indicator) is legal YAML and common in long
        // skill descriptions. Failing one would be a false red on correct input.
        if (/^[|>][+-]?$/.test(value)) {
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

/**
 * Lint the packaging rooted at `root`.
 *
 * @throws {PluginLintError} when the root itself cannot be read — that is not a verdict.
 * @returns {{findings: Array<{severity: "fail"|"note", check: string, message: string}>,
 *            stats: {skills: number, agents: number, paths: number, unverifiable: number}}}
 */
/** True when `target` lies outside `root`. Lexical — the caller decides what it is fed. */
function escapes(root, target) {
    const inside = path.relative(root, target);
    return inside.startsWith("..") || path.isAbsolute(inside);
}

export function inspect(rawRoot) {
    // Absolute from here on. Two sets of paths are compared later — the skills the manifest declares
    // and the skills found by walking the tree — and they are only comparable if both are built the
    // same way. With a relative root (`node cli/plugin-lint.mjs .`, which is how the verify recipe
    // calls it) the declared side resolved to absolute while the walked side stayed relative, so
    // every shipped skill was reported as undeclared: a note that was false about every skill, which
    // is worse than no note, because it hides the true one in noise. The suite missed it because
    // every fixture passed an absolute temp directory. Now normalised once, at the boundary.
    let stat;
    try {
        stat = fs.statSync(path.resolve(rawRoot));
    } catch (error) {
        throw new PluginLintError(`cannot read ${rawRoot} — ${error.code ?? error.message}`);
    }
    if (!stat.isDirectory()) throw new PluginLintError(`${rawRoot} is not a directory`);
    // Canonical, not merely absolute: every containment answer below compares against this, and
    // comparing a canonical target to a symlinked root reports an escape that is not one. Both
    // sides must be canonicalised or neither. (On macOS this is not hypothetical — the temp
    // directories the suite builds fixtures in live under a symlinked `/tmp`.)
    let root;
    try {
        root = fs.realpathSync(path.resolve(rawRoot));
    } catch (error) {
        throw new PluginLintError(`cannot resolve ${rawRoot} — ${error.code ?? error.message}`);
    }

    const findings = [];
    const stats = { skills: 0, agents: 0, paths: 0, unverifiable: 0 };
    const fail = (check, message) => findings.push({ severity: "fail", check, message });
    const note = (check, message) => findings.push({ severity: "note", check, message });

    /** Read a file, turning any failure into a finding rather than an exception. */
    const read = (file, check, label) => {
        try {
            return fs.readFileSync(file, "utf8");
        } catch (error) {
            // doctor shipped this defect twice: an unguarded read turned a tree already judged red
            // into "could not run", discarding every finding the run had made. A file that cannot
            // be read IS a verdict about the tree.
            fail(check, `${label} could not be read — ${error.code ?? error.message}`);
            return null;
        }
    };

    /** Parse a manifest. Returns null on any problem, having recorded it. */
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

    /**
     * Resolve a declared path against the root, enforcing the platform's two stated rules — it
     * must start with `./` and it must not leave the plugin root — and this repository's one:
     * it must actually resolve.
     *
     * Containment is checked **twice**, and the second one is the check that means something.
     * `path.relative` is lexical: it reads `./plugin/skills/` as inside the root whether or not
     * `plugin/skills` is a symlink to somewhere else entirely. Since a plugin's whole contract is
     * that its components live inside it — and since a symlink escaping the root is a shape this
     * repository actively considered and rejected for its own packaging — the lexical answer is
     * the one an attacker or an accident would satisfy. So the target is canonicalised and asked
     * again. The lexical check is kept first because it is the only one that can judge a path that
     * does not exist: `./../elsewhere/` must fail as *outside*, not as *missing*.
     *
     * @returns {string|null} the canonical absolute path, or null having recorded the failure.
     */
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
        // `existsSync` follows symlinks, so a broken link is reported as not resolving rather than
        // crashing the canonicalisation below.
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
        return real;
    };

    const asList = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);

    // --- the two manifests --------------------------------------------------------------------

    const plugin = manifest(path.join(".claude-plugin", "plugin.json"));
    const market = manifest(path.join(".claude-plugin", "marketplace.json"));

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
            // The failure this whole file exists to stop being a warning. `claude plugin validate`
            // reports an empty marketplace as a warning, and a warning is the severity a milestone
            // walks past: the repository would call itself a plugin marketplace and ship nothing.
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
            // A github / url / git-subdir / npm source is legal and points outside this tree, so
            // nothing here can resolve it. Counted and reported, never silently skipped — the same
            // rule doctor applies to a workspace that declares no tree.
            stats.unverifiable += 1;
            note("market", `${label} ("${name ?? "?"}") has an off-tree source — not verifiable here`);
            continue;
        }

        const target = resolve(entry.source, "market", `${label} ("${name ?? "?"}") source`);
        if (!target) continue;

        // The entry that points at the marketplace root IS this plugin, so the two manifests are
        // describing one artifact and must not contradict each other. Drift between them is
        // invisible at runtime — plugin.json wins — which is what makes it worth a check.
        if (path.resolve(target) === path.resolve(root) && plugin) {
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
    const declaredAgentTargets = [];

    for (const field of PATH_FIELDS) {
        for (const raw of asList(plugin?.[field])) {
            // An inline object for hooks / MCP / LSP is configuration, not a path claim.
            if (typeof raw === "object" && raw !== null) continue;
            const target = resolve(raw, "paths", `plugin.json ${field}`);
            if (!target) continue;
            if (field === "skills") declaredSkillRoots.push(target);
            if (field === "agents") declaredAgentTargets.push(target);
        }
    }

    // --- the skills behind those paths ----------------------------------------------------------

    const skillDirs = new Set();
    for (const skillRoot of declaredSkillRoots) {
        if (!fs.statSync(skillRoot).isDirectory()) {
            fail("skills", `plugin.json skills path ${path.relative(root, skillRoot)} is not a directory`);
            continue;
        }
        // A skills path may point straight at one skill (the `"./"` form) or at a directory of them.
        if (fs.existsSync(path.join(skillRoot, "SKILL.md"))) {
            skillDirs.add(skillRoot);
            continue;
        }
        let entries;
        try {
            entries = fs.readdirSync(skillRoot, { withFileTypes: true });
        } catch (error) {
            fail("skills", `${path.relative(root, skillRoot)} could not be read — ${error.code ?? error.message}`);
            continue;
        }
        const children = entries.filter((e) => e.isDirectory());
        if (children.length === 0) {
            fail(
                "skills",
                `plugin.json declares ${path.relative(root, skillRoot)} but it contains no skill`,
            );
            continue;
        }
        for (const child of children) skillDirs.add(path.join(skillRoot, child.name));
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
        // `name` is required here although the platform makes it optional, and the stricter rule is
        // this repository's own invariant rather than a claim about the contract. Without it the
        // invocation name is inherited from the layout, and the fallback differs by layout: a skill
        // in a `skills/<dir>/` subdirectory takes the directory name, which is stable, while a skill
        // reached by a path pointing straight at it — the `"./"` form, which packs will use — takes
        // the *install* directory name, which for a marketplace install is a version string that
        // changes on every update. Requiring `name` makes the invocation name a property of the
        // skill rather than of where it happens to sit, and every skill this repository ships has
        // one already, so the rule costs nothing and closes the case before packs arrive.
        checkFrontmatter(text, `${rel}/SKILL.md`, "skills", { requireName: true });
    }

    // A skill authored and never declared is a skill nobody ships, and its author will believe
    // otherwise. Reported rather than failed: an undeclared SKILL.md may legitimately be an example
    // or a fixture, and this validator has no way to tell which.
    for (const found of walkForSkills(root)) {
        if (!skillDirs.has(found)) {
            note(
                "skills",
                `${path.relative(root, found)}/SKILL.md is not covered by any declared skills path`,
            );
        }
    }

    // --- the agents behind those paths ----------------------------------------------------------

    for (const target of declaredAgentTargets) {
        const files = [];
        if (fs.statSync(target).isDirectory()) {
            // A dated snapshot, not a frozen copy of the contract. Measured 2026-07-26 against
            // Claude Code v2.1.215: `agents` naming a directory — with or without a trailing slash,
            // as a string or in an array — is refused with "agents: Invalid input", while the same
            // files listed explicitly pass. This validator still walks the directory, so the agents
            // are checked either way, and it reports rather than fails: the accepted path forms are
            // the platform's contract to change, and `claude plugin validate` is its authority.
            // This note exists because this repository shipped exactly that manifest and its own
            // lint said GREEN — see ../.portulan/memory/a-checkers-coverage-is-measured-not-named.md.
            note(
                "agents",
                `plugin.json names the directory ${path.relative(root, target)} — as of 2026-07-26 ` +
                    "the platform's validator requires explicit .md files here; run `claude plugin validate --strict`",
            );
            let entries;
            try {
                entries = fs.readdirSync(target, { withFileTypes: true });
            } catch (error) {
                fail("agents", `${path.relative(root, target)} could not be read — ${error.code ?? error.message}`);
                continue;
            }
            for (const e of entries) if (e.isFile() && e.name.endsWith(".md")) files.push(path.join(target, e.name));
            if (files.length === 0) {
                fail("agents", `plugin.json declares ${path.relative(root, target)} but it contains no agent`);
            }
        } else {
            files.push(target);
        }
        for (const file of files) {
            const rel = path.relative(root, file);
            stats.agents += 1;
            const text = read(file, "agents", rel);
            if (text === null) continue;
            checkFrontmatter(text, rel, "agents", { requireName: true });
        }
    }

    function checkFrontmatter(text, label, check, { requireName }) {
        const { fields, error } = parseFrontmatter(text);
        if (!fields) {
            fail(check, `${label} has no usable frontmatter${error ? ` — ${error}` : ""}`);
            return;
        }
        if (!fields.description) {
            fail(check, `${label} has no non-empty \`description\` — it is what decides when it loads`);
        }
        if (fields.name !== undefined && !SLUG.test(fields.name)) {
            fail(check, `${label} declares name "${fields.name}", which is not kebab-case`);
        } else if (requireName && fields.name === undefined) {
            fail(check, `${label} has no \`name\``);
        }
    }

    return { findings, stats };
}

/** Every directory beneath `root` that holds a SKILL.md. Bounded, and skips the obvious noise. */
function walkForSkills(root, dir = root, depth = 0, found = []) {
    if (depth > MAX_WALK_DEPTH) return found;
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        // Unreadable subtrees are not a verdict about packaging; the declared paths above are what
        // this validator judges, and a failure to read one of those is already reported there.
        return found;
    }
    if (entries.some((e) => e.isFile() && e.name === "SKILL.md")) found.push(dir);
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (SKIP_DIRS.has(entry.name)) continue;
        walkForSkills(root, path.join(dir, entry.name), depth + 1, found);
    }
    return found;
}

// ===========================================================================================
// The command
// ===========================================================================================

const ICON = { fail: "FAIL", note: "note" };

export async function run(argv, options = {}) {
    const say = options.quiet ? () => {} : (line = "") => process.stdout.write(`${line}\n`);
    try {
        const roots = argv.filter((a) => !a.startsWith("-"));
        if (roots.length === 0) {
            if (!options.quiet) {
                process.stderr.write("usage: node cli/plugin-lint.mjs <plugin-root>\n");
            }
            return 2;
        }

        let failed = 0;
        for (const root of roots) {
            const { findings, stats } = inspect(root);
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
