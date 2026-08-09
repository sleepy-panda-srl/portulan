#!/usr/bin/env node
// `plugin-lint` — the packaging validator.
//
//   node cli/plugin-lint.mjs [--payload] <plugin-root> [<plugin-root> ...]
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
//   * **whether a declared skill becomes a capability the host registers — beyond its DEPTH.** Since
//     2026-08-07 one half of that question is checked: a skill resolved more than HOST_SKILL_DEPTH
//     below its declared root fails, because the host expands a declared root exactly one level and a
//     skill deeper than that is packaged, counted and inert. That was measured in both directions on
//     Claude Code 2.1.224 against a local marketplace built from this repository — `./packs/rituals/`
//     registered 0 of the pack's 3, `./packs/rituals/checkpoints/skills/` registered all 3 — and it is
//     why `N skill(s)` and the host's inventory had disagreed by three for a milestone (#134).
//     Since 2026-08-09 a second half is checked, and it is a different question: not *can the host
//     reach this path* but *did the workspace ask for it*. The `compose` check below pins the
//     governing workspace's `packs` array to the `skills` paths that land inside `./packs/`, both
//     ways, because registration is otherwise a property of plugin.json alone — measured by deleting
//     the `packs` key outright and reinstalling, which changed the host's inventory not at all.
//     What is still NOT checked is everything else about registration: whether the host accepts the
//     frontmatter, whether a name collides, whether the plugin loads at all. `N skill(s)` answers *is
//     the packaging coherent and reachable*, never *does this install work* — that stays the
//     fresh-machine demonstration below and `claude plugin validate --strict`.
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

// The private feeds this project ships, named so a public manifest cannot be sourced from one. Named
// rather than pattern-matched on "private": visibility is a live GitHub setting no file can read, so the
// only honest form is a list this repository maintains. `docs/plan.md`'s topology is the declaring
// authority for what is on it, and the name is already public there — what is refused is a *pointer*,
// not a mention. Entries are `owner/name`, not bare names: matching a name alone refused an unrelated
// public repository that happened to share it, which is a false red in a rail, and a false red is how a
// whole rail gets switched off. A feed added to the topology and not added here is the drift this comment
// exists to make findable; the list is short enough to keep by hand.
const PRIVATE_FEEDS = ["sleepy-panda-works/portulan-internal"];
// Deliberately permissive about pre-release and build metadata, strict about the three numbers:
// the platform compares version strings, and this repository's own convention is SemVer from
// v0.1.0 (../docs/plan.md, Protocol → Versioning).
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

// Manifest keys whose value may name a path. `hooks`, `mcpServers` and `lspServers` also accept an
// inline object, so only string values are treated as paths — an object there is configuration, not
// a claim about the tree.
//
// `agents` is deliberately absent: see AGENT_DIR below. Declaring it does not resolve to a component
// the host will load, so treating it as a path claim would be validating a path nobody reads.
const PATH_FIELDS = [
    "skills",
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

// The one location the host loads agents from, and it loads them from nowhere else. Measured
// 2026-07-26 against Claude Code v2.1.215 with a positive control, because the failure is silent in
// both directions:
//
//   files at ./agents/, no `agents` key         →  Agents (1)   loaded
//   the same files named explicitly in `agents` →  Agents (0)   the key SUPPRESSES the scan
//   files at ./plugin/agents/, no key           →  Agents (0)   nowhere else is scanned
//   `agents` naming a directory, any path       →  the plugin fails to load at all
//
// So agents are found here by convention rather than by declaration. That is not a preference: the
// manifest cannot express a working agent path, and `claude plugin validate --strict` accepts the
// explicit-file form that loads nothing — this repository shipped exactly that and its personas were
// inert on every install (../.portulan/memory/a-manifest-field-can-validate-and-load-nothing.md).
const AGENT_DIR = "agents";
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
 * @param {string} rawRoot - the plugin root, absolute or relative.
 * @param {object} [options]
 * @param {boolean} [options.payload=false] - treat this root as a **payload**: a plugin a feed
 *   publishes without being a marketplace itself. It changes exactly one thing — a
 *   `marketplace.json` that is **absent** becomes a counted `unverifiable` note instead of a
 *   `manifest` failure, and every marketplace-specific check is skipped because there is nothing to
 *   check. Everything else is unchanged, and three boundaries are deliberate: a marketplace manifest
 *   that is **present** is validated in full, an **unusable** one (a dangling symlink, an unreadable
 *   file) still fails, and the mode is never inferred from an absent file — the caller opts in. What
 *   the exemption costs is what the note says: nothing here can check that the feed's entry agrees
 *   with this manifest, so the name, version and source path it publishes under are unverified.
 * @throws {PluginLintError} when the root itself cannot be read — that is not a verdict.
 * @returns {{findings: Array<{severity: "fail"|"note", check: string, message: string}>,
 *            stats: {skills: number, agents: number, paths: number, unverifiable: number}}}
 */
/** True when `target` lies outside `root`. Lexical — the caller decides what it is fed. */
function escapes(root, target) {
    const inside = path.relative(root, target);
    return inside.startsWith("..") || path.isAbsolute(inside);
}

export function inspect(rawRoot, { payload = false } = {}) {
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
     * The kind travels back with the path deliberately: it is read here, once, inside this
     * function's guard, so no caller has a second unguarded `statSync` to throw from.
     *
     * @returns {{file: string, isDirectory: boolean}|null} the canonical absolute path and what it
     *   is, or null having recorded the failure.
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
        // The kind is read here, once, inside the guard — rather than by the callers, which used to
        // `statSync` the path a second time unguarded. Existence having been established two lines
        // up makes that second call *look* safe, and it is not: the window is small (a removal
        // between the two calls, a transient filesystem error) but what it costs is large, because
        // a throw from there reaches the top-level catch and turns a run that had already found
        // real failures into exit 2 — "could not run" — discarding every one of them. That is the
        // defect this repository has now fixed four times, and the reliable cure is not another
        // try/catch but having only one read to guard.
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
    // A **payload** root is a plugin a feed ships without being a marketplace itself. `packs/` is one:
    // the private feed's `portulan-checkpoints` entry is a `git-subdir` source rooted there, so the
    // marketplace entry describing it lives in that feed and cannot exist here. Requiring one would
    // demand a fake marketplace beside a real payload.
    //
    // It is an OPT-IN and not an inference — a root that merely *lacks* a marketplace still fails, and
    // the caller has to say which roots are payloads. Inferring it would turn a deleted
    // `marketplace.json` into a silently narrower lint, which is the relaxation
    // `../.portulan/gate-map.md` says to scrutinise hardest.
    //
    // What it costs is stated rather than hidden: **nothing here checks that the feed's entry agrees
    // with this manifest** — the name, the version and the source path are verified in the feed's own
    // repository or not at all. That is one unverifiable, counted as such.
    // `lstatSync` rather than `existsSync`, and the difference is a verdict: `existsSync` FOLLOWS a
    // symlink, so a payload root whose `marketplace.json` is a dangling link read as "none is owed" and
    // went green, where the strict path calls the same tree a `manifest` failure. That is this file's
    // recurring defect in its own words one screen down — *"absent and unusable are different verdicts
    // and only one is benign"* — and it is why only ENOENT takes the payload arm. Found at the
    // pre-commit checkpoint by planting the dangling link.
    const marketPath = path.join(root, ".claude-plugin", "marketplace.json");
    let marketAbsent = false;
    let marketUnexaminable = null;
    try {
        fs.lstatSync(marketPath);
    } catch (error) {
        // ENOENT is the only absence. Every other errno — EACCES, EIO, ELOOP — is a file that is
        // THERE and would not answer, and falling through with `marketAbsent` false sent it to
        // `manifest()`, whose `existsSync` cannot stat it either and reports it **missing**. That is
        // the same conflation this block exists to prevent, one branch further out, and it reached
        // both the payload and the strict path. Reported as itself instead. (Copilot, final round.)
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
            // **One direction only.** The private feed may point at this repository — that is the
            // maintainer's #113 ruling, "the feed points, the public repository carries" — and this
            // repository may never point back. A public entry sourced from the private feed is a **dead
            // pointer for every stranger**, since the fetch 404s on a repository they cannot see, and it
            // publishes the private feed's internal structure in a manifest anyone can read. Refused
            // rather than noted, because the two failure modes are invisible from inside this tree: no
            // resolution attempt here can tell a private repository from a nonexistent one.
            //
            // Deliberately narrow. Pointing at another PUBLIC repository is a legal shape nobody has
            // ruled against, and it stays counted-and-reported below — widening this to every off-tree
            // source would be this lint inventing a policy rather than enforcing one.
            // Matched as a NAME, never as a substring. `includes` false-positives on an unrelated public
            // repository whose name merely contains the feed's — `someone-else/portulan-internal-tools` —
            // and a false red in a rail is how the whole rail gets switched off. Found by Copilot on #117,
            // round 5. Split on everything that can delimit a repository or package name, so
            // `owner/portulan-internal`, an `https://` URL and an `scp`-style `git@host:owner/name.git`
            // all reduce to the same segment set.
            const target = [entry.source?.repo, entry.source?.url, entry.source?.package]
                .filter((v) => typeof v === "string")
                .join(" ");
            // **Lowercased on both sides.** GitHub repository names are case-insensitive, so
            // `Sleepy-Panda-Works/Portulan-Internal` resolves to the same repository and walked straight
            // through a case-sensitive membership test. Found by Copilot one round after the rail landed —
            // a rail a different capitalisation gets past is not a rail, which is why this went past the
            // review loop's two-fix-round bound rather than to triage (the precedent is #105).
            // Matched as **owner/name**, not name alone. Matching the repo segment by itself refused
            // `someone-else/portulan-internal` — an unrelated public repository — which contradicts this
            // rail's own stated narrowness, and a false red is how a whole rail gets switched off. Copilot,
            // #117 round 8. Lowercased on both sides because GitHub names are case-insensitive (round 6),
            // and adjacent segment PAIRS are compared so `owner/name`, an https URL and an scp-style
            // `git@host:owner/name.git` all reduce to the same set.
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
            // A github / url / git-subdir / npm source is legal and points outside this tree, so
            // nothing here can resolve it. Counted and reported, never silently skipped — the same
            // rule doctor applies to a workspace that declares no tree.
            stats.unverifiable += 1;
            note("market", `${label} ("${name ?? "?"}") has an off-tree source — not verifiable here`);
            continue;
        }

        const resolved = resolve(entry.source, "market", `${label} ("${name ?? "?"}") source`);
        if (!resolved) continue;

        // The entry that points at the marketplace root IS this plugin, so the two manifests are
        // describing one artifact and must not contradict each other. Drift between them is
        // invisible at runtime — plugin.json wins — which is what makes it worth a check.
        // Both sides are canonical by construction, so this compares like with like.
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

    // An `agents` key is refused whatever it names — see AGENT_DIR. A path that resolves is exactly
    // as dead as one that does not, so this fails on the key's presence rather than on its value,
    // and it fails rather than notes: a note is read past, and re-adding the key silently unloads
    // every persona the plugin ships.
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
        // A skills path may point straight at one skill (the `"./"` form), at a directory of them, or
        // at a pack-shaped tree with them nested deeper — see expandDeclaredSkillRoot below.
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
                    `this check must never do is go green over what it could not reach`,
            );
        }
        // The host expands a declared root ONE level. A skill this validator resolves deeper than that
        // is packaged, counted, and inert on every install — which is a green over a skill nobody can
        // invoke, the failure ../.portulan/memory/a-manifest-field-can-validate-and-load-nothing.md
        // records against the sibling `agents` key. The repair is in the message because it is one
        // edit: name the directory that actually holds the skills.
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

    // --- composition drives registration -------------------------------------------------------
    //
    // Two manifests carry one fact and nothing pinned them together. A workspace's `packs` array
    // says which packs this repository **composes**; `plugin.json`'s `skills` says which directories
    // the **host registers**. Registration is a property of `plugin.json` and of nothing else —
    // measured 2026-08-09 on Claude Code 2.1.226 by deleting the `packs` key from
    // `.portulan/workspace.json` outright and reinstalling, which changed the host's inventory not at
    // all: the same `Skills (7)`, the checkpoints pack's three among them. So a composed pack's skill
    // is invocable here by coincidence of a hand-written path, which is exactly what row 7 clause (b)
    // refuses ([#184](https://github.com/sleepy-panda-works/portulan/issues/184)): the demonstration
    // it asks for is **parity** — invoked because the workspace composed it — not files present at a
    // path a human knows.
    //
    // The correspondence runs both ways, and each direction is a defect that is silent today:
    //
    //   composed, undeclared  →  packaged, counted by this validator, inert on every install. The
    //                            failure ../.portulan/memory/a-manifest-field-can-validate-and-load-nothing.md
    //                            records against the sibling `agents` key, arriving through the other
    //                            manifest.
    //   declared, uncomposed  →  a capability the host registers that no workspace asked for. The
    //                            cascade is core < pack < workspace, and a pack reaching the host
    //                            without the workspace naming it has skipped the layer that owns the
    //                            decision.
    //
    // **Scoped to the workspace that GOVERNS this bundle, never to every manifest it ships.** The demo
    // under `examples/` composes `stacks/python` and `tools/github`, which deliberately do not exist,
    // and the fixture under `cli/fixtures/` exists to be invalid; holding either to this rule would be
    // a red by construction. That scoping is the whole reason this reads one named path rather than
    // discovering manifests.
    //
    // What this does NOT establish, each found by the pre-commit checkpoint on #195 rather than
    // assumed:
    //   * **that the host then INVOKES the skill.** This establishes that the path the host registers
    //     from is the one composition asked for. `claude plugin details` counts registration and is
    //     run at the checkpoints; nobody has yet shown a composed pack's skill *invoked* through
    //     composition, which is the parity row 7 clause (b) ultimately asks for.
    //   * **that a `packs` entry names a pack at all.** `"."` or a family name like `"rituals"`
    //     satisfies the correspondence without pointing at anything carrying a `pack.json`. Requiring
    //     one here would put a second answer to *what is a pack* beside `doctor`'s, so the gap is
    //     named instead of closed.
    //   * **that the host resolves symlinks the way either walk does.** The walks are aligned with
    //     each other and with `doctor`; what the host does with a symlinked `SKILL.md` at install is
    //     unmeasured, and nothing here claims it.

    const GOVERNING = path.join(".portulan", "workspace.json");
    let composition;
    try {
        composition = JSON.parse(fs.readFileSync(path.join(root, GOVERNING), "utf8"));
    } catch (error) {
        // A bundle shipping no governing workspace composes nothing, which is coherent rather than a
        // fault. *Could not read* is a different answer and is never *not there*
        // (../.portulan/memory/verify-preconditions-fail-closed.md), so the two are reported apart and
        // only the second is a finding.
        if (error.code === "ENOENT") composition = null;
        else {
            fail(
                "compose",
                `${GOVERNING} could not be read — ${error.code ?? error.message}; composition was ` +
                    "not checked against the declared skills, so this run establishes nothing about it",
            );
            composition = null;
        }
    }

    // A manifest that PARSES but is not a plain object — an array, a string, a number — silently
    // skipped this whole check in the first cut, which is a green over something nobody evaluated:
    // the exact shape the `could not read` branch above exists to refuse, one type away. It fails
    // closed and says what was not established. Raised by Copilot on #195.
    if (composition !== null && (typeof composition !== "object" || Array.isArray(composition))) {
        fail(
            "compose",
            `${GOVERNING} parses but is not a JSON object (${Array.isArray(composition) ? "an array" : typeof composition}) — ` +
                "composition could not be read from it, so parity with the declared skills is unchecked",
        );
        composition = null;
    }

    // `packs` PRESENT but not an array is the check's core invariant going quiet: a manifest saying
    // `"packs": "rituals/checkpoints"` iterates zero times and the run then reports nothing at all
    // about parity. Absent is a real state — a workspace may compose nothing — and *the wrong type* is
    // not that state. It joins the unreadable-manifest case above rather than being caught inside the
    // block: the first cut failed here and then RAN ON with an empty composition, so the converse
    // direction reported every declared pack skill as belonging to no composed pack — an unreadable
    // composition read as *composes nothing*, the same fail-open pointing the other way, contradicting
    // the sentence it had just emitted. Both halves raised by Copilot on #195, one round apart: the
    // guard was right and its control flow was not.
    if (composition !== null && composition.packs !== undefined && !Array.isArray(composition.packs)) {
        fail(
            "compose",
            `${GOVERNING} declares \`packs\` as ${typeof composition.packs === "object" ? "an object" : typeof composition.packs} rather than an array — ` +
                "no composition could be read from it, so parity with the declared skills is unchecked",
        );
        composition = null;
    }

    if (composition !== null) {
        const packsRoot = path.join(root, "packs");
        const composed = [];
        for (const entry of Array.isArray(composition.packs) ? composition.packs : []) {
            // A `packs` entry that is not a usable name is `doctor`'s verdict on the workspace, but
            // going quiet about it here would be this check reporting on a composition it did not
            // read in full. Named, then passed on.
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
            // A `packs` entry escaping the tree is the workspace validator's verdict, not this one's —
            // but *skipping* it is not this one's either. It is named as unchecked below rather than
            // `continue`d in silence, because a check that goes quiet on what it could not evaluate is
            // the fail-open this file refuses everywhere else.
            //
            // `escapes` is LEXICAL, and lexical containment is not containment: `packs/` or a composed
            // pack directory can be a symlink whose target is anywhere, and `statSync`/`readdirSync`
            // follow it. So the path is canonicalised and re-checked before anything is walked.
            //
            // **What that buys, stated as narrowly as it is true: a link whose target ESCAPES
            // `./packs/` is refused.** A symlink resolving to somewhere still inside `./packs/` passes,
            // and is meant to — it reaches nothing the walk could not reach by its own path, so
            // refusing it would be policy about tree layout rather than containment. This is
            // deliberately weaker than `../cli/vendor.mjs`'s rule 2, which refuses a symlink at or
            // below the named destination outright: that tool WRITES into somebody's tree, where a
            // link is a way to make it write outside; this one only reads, and the harm is reading
            // outside. The two are different rules for different verbs, and the earlier draft of this
            // comment claimed vendor's. Both halves raised by Copilot on #195 — the lexical hole
            // first, then the comment that overclaimed the fix.
            // Both containment checks are against `packsRoot`, not `root`. The first cut compared
            // against the plugin root while the message and the rule said `./packs/`, so an entry like
            // `../plugin` stayed inside the bundle, passed, and was WALKED — its skills then measured
            // against the declared roots as though it were a composed pack. A guard whose test is wider
            // than the sentence beside it is the two-carriers defect in one statement. Raised by Copilot
            // on #195, in the round after the one that closed the lexical hole.
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
            let stat;
            try {
                stat = fs.statSync(dir);
            } catch (error) {
                // A composed pack absent from the bundle cannot be registered from it, but *why* it is
                // absent is `doctor`'s verdict on the workspace and would be a second carrier here.
                // Noted so the reader knows this check saw it and passed it on.
                note(
                    "compose",
                    `${GOVERNING} composes \`${name}\`, which does not resolve under ./packs/ — ` +
                        `${error.code ?? error.message}. \`doctor\` owns that verdict; nothing here ` +
                        "could check its skills",
                );
                continue;
            }
            // A path that exists and is NOT a directory was dropped from evaluation silently in the
            // first cut — composition claimed and never checked. It is a NOTE rather than a failure,
            // and the distinction was earned rather than chosen: the pre-commit checkpoint on #195
            // tried to construct a false green through a regular file and could not, because a file
            // holds no `SKILL.md` for either walk to disagree about. So this matches the ENOENT branch
            // above — `doctor` owns the verdict on a malformed `packs` entry, and what this check owes
            // is to say it saw it. A failure here would claim a hazard nobody could demonstrate.
            if (!stat.isDirectory()) {
                note(
                    "compose",
                    `${GOVERNING} composes \`${name}\`, and ./packs/${name} is not a directory — ` +
                        "nothing was walked for it. `doctor` owns that verdict",
                );
                continue;
            }
            composed.push({ name, dir });
        }

        for (const { name, dir } of composed) {
            // `problems` is what makes the walk's silences visible to a consumer whose output is a
            // failure. Each one is a place this check could not look, and *could not look* reported as
            // *nothing wrong* is the whole defect class the `compose` check was written inside.
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
    }

    // A skill authored and never declared is a skill nobody ships, and its author will believe
    // otherwise. Reported rather than failed: an undeclared SKILL.md may legitimately be an example
    // or a fixture, and this validator has no way to tell which.
    // The same report, for the side of the asymmetry that has already bitten: a skill under a
    // declared custom path loads, and an agent under any custom path does not. So an agent file
    // anywhere but `./agents/` is one its author believes is loading, and nothing else in this
    // validator would ever mention it. Reported rather than failed for the reason below — a `.md`
    // under some other `agents/` may be a fixture, an example, or another host's binding, and this
    // validator cannot tell which.
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
    //
    // Nothing declares these, so nothing but this pass covers them. The milestone-3 criterion asks
    // that CI check "every declared skill and agent"; for agents the manifest cannot carry the
    // claim, and the coverage has to come from the convention instead. The moment the `agents` key
    // came out of this repository's manifest, the recipe printed `0 agent(s)` and GREEN.

    // `lstat`, not `exists`: the question here is whether the tree *has* an `agents` entry, and
    // `existsSync` answers a different one because it follows the link — so a broken `agents`
    // symlink reported "absent", took the note branch, and went GREEN with `0 agent(s)` over a tree
    // that plainly has an `agents` entry and cannot use it. Absent and unusable are different
    // verdicts and only one is benign. Deciding it non-dereferencingly leaves every other case to
    // `resolve()` below, which already knows how to fail a link that does not resolve. Found by
    // review, and it is the short-input-set defect this pass was written to close, in the pass.
    // Three states, not two, because "I could not tell" is a real answer and collapsing it into
    // either of the others is a lie. Only ENOENT means absent; EACCES, EIO or anything else means
    // the question was not answered, and answering an unanswerable question with the reassuring
    // option is this file's recurring defect — caught here in review, one round after the same
    // shape was caught in the line above.
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
        // Already failed; there is nothing further to say about a directory nobody could look at.
    } else if (state === "absent") {
        // A plugin that ships no agents is legitimate, so this is a note. The residual hole is real
        // and named rather than hidden: deleting `agents/` outright degrades this whole check class
        // to a note, the same shape proposal 0005 closed for `tree`. The check that would bind it is
        // the persona↔agent agreement lint — ../.portulan/tasks/0005-lint-the-persona-agent-binding.md.
        note("agents", `no ./${AGENT_DIR}/ directory — this plugin ships no agents`);
    } else {
        // Routed through the same resolver as every declared path, so an `agents/` that is a symlink
        // out of the tree is an escape here too — undeclared does not mean unchecked, and this is the
        // one component directory nothing declares.
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
                    // `isFile()` is false for a symlink, so the obvious filter *drops* a symlinked
                    // agent — present in the tree, absent from the count, nothing saying so, which
                    // is the exact failure this pass exists to prevent. Symlinks are taken in and
                    // judged instead: a broken one fails through `read` below, and one resolving
                    // out of the plugin root fails here, the same answer `resolve` gives a declared
                    // path. Reporting beats skipping, as everywhere else in this file.
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
                        checkFrontmatter(text, rel, "agents", { requireName: true });
                    }
                }
            }
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
/**
 * Every directory named `agents` in the tree apart from the loadable one at the plugin root.
 *
 * The mistake this catches is not exotic — it is the one this repository made and shipped: agent
 * files under `plugin/agents/`, where the host will never look. It is the natural place to put them,
 * because **skills** do load from custom declared paths and agents do not, and nothing about the
 * asymmetry announces itself. See ../.portulan/memory/a-manifest-field-can-validate-and-load-nothing.md
 * for the measurement.
 *
 * **This rule and that memory entry retire together.** Both exist only because the platform loads
 * agents from one fixed location; if a release makes the `agents` key register the files it names,
 * the stranding stops being a defect, this walk becomes a source of false notes, and both go.
 */
function walkForStrandedAgents(root, dir = root, depth = 0, found = []) {
    if (depth > MAX_WALK_DEPTH) return found;
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        // Same reasoning as the skills walk: an unreadable subtree is not a verdict about packaging.
        return found;
    }
    // Every `agents/` **except the loadable one**, compared by path rather than by depth: the first
    // version of this used `depth > 0`, which excludes the plugin root itself and not the `agents/`
    // directly under it — so it reported the three files sitting exactly where it exists to tell
    // people to put them. Caught by strengthening the test to assert what must *not* be named.
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

// `problems` is opt-in and changes nothing for the caller that does not pass it. It exists because
// this walk acquired a SECOND consumer — the `compose` check — whose output is a **failure** rather
// than a note, and the silences below were sized for the first consumer only. A sweep that misses an
// undeclared skill under-reports a note; the same miss under `compose` is a **silent green over a
// composed pack whose skills nothing registers**, which is the thing that check exists to refuse.
// Raised by the pre-commit checkpoint on #195, which built both cases.
//
// Two silences, and both are the fail-open this repository keeps naming:
//
//   an unreadable subtree      `readdirSync` throws and the walk returns what it has. *Could not
//                              look* becoming *nothing there* — `../cli/vendor.mjs` rule 3.
//   a SYMLINKED SKILL.md       `Dirent.isFile()` is FALSE for a symlink, so the walk cannot see it,
//                              while the DECLARED-side walk reaches the same file through
//                              `existsSync`, which follows links. `../cli/doctor.mjs`'s `walkSkills`
//                              already refuses this shape by `lstat` and says why. One shape, three
//                              behaviours in one repository; this closes the third.
function walkForSkills(root, dir = root, depth = 0, found = [], problems = null) {
    if (depth > MAX_WALK_DEPTH) {
        if (problems) problems.push({ dir, why: `not searched — deeper than ${MAX_WALK_DEPTH} levels` });
        return found;
    }
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
        // For the note-only consumer this stays a silence, deliberately: the declared paths are what
        // that consumer judges, and a failure to read one of those is already reported there.
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

// The depth a DECLARED skills root is searched to, counted from the root itself. Three is what the
// pack shape needs — `<pack>/skills/<skill>/SKILL.md` — and it is deliberately its own bound rather
// than MAX_WALK_DEPTH, which governs the undeclared-skill sweep over a whole tree. One is a search of
// something the manifest pointed at; the other is a sweep of everything it did not.
const MAX_DECLARED_SKILL_DEPTH = 3;

// How far below a DECLARED skills root the host itself looks. One — `<root>/<skill>/SKILL.md` — and
// no further. Measured 2026-08-07 on Claude Code 2.1.224 against a local marketplace built from this
// repository, in both directions: `./packs/rituals/` registered 0 of the pack's 3 skills, and
// `./packs/rituals/checkpoints/skills/` registered all 3. It is its own constant rather than a literal
// because it is a PLATFORM fact this repository does not control, unlike the bound above, which is a
// choice about how far to search. Re-measure it at a host upgrade; a change here is a change in what
// installs, not in what this tool prefers.
const HOST_SKILL_DEPTH = 1;

/**
 * Expand one DECLARED skills root into the skill directories beneath it.
 *
 * For one milestone this resolved a declared root exactly two ways — the root IS one skill (it holds
 * `SKILL.md`), or its IMMEDIATE children are — and nothing deeper. A pack shipping
 * `<root>/<pack>/skills/<skill>/SKILL.md` therefore resolved `<root>/<pack>` as a skill directory and
 * failed it with `has no SKILL.md`, which blocked packs from carrying skills — most of what a pack is
 * for (../.portulan/tasks/0008-a-declared-skills-path-sees-one-level-down.md).
 *
 * Three results, because the fix must not buy depth with silence:
 *   `found`     — directories holding a SKILL.md, at any depth within the bound.
 *   `barren`    — a directory under the root that is not a skill and holds none beneath it. This is
 *                 the real failure the one-level version already caught, kept with its own wording.
 *   `truncated` — where the bound stopped the search with subdirectories still unlooked-at. Reported
 *                 rather than passed over: a check that goes green on what it could not reach is the
 *                 `docs.sh` `map` hole and the `git ls-files` precondition, a third time.
 *
 * A skill directory is a leaf — skills do not nest inside skills — so the walk stops descending the
 * moment it finds one. Symlinked directories are not descended, which is `Dirent.isDirectory()`'s
 * own behaviour rather than a new rule here; the escape refusal on the declared path itself is
 * `escapes()` and does not loosen.
 */
function expandDeclaredSkillRoot(skillRoot) {
    const found = [];
    const truncated = [];
    const barren = [];
    // Skills this validator resolves and the HOST will never see. Measured 2026-08-07 on Claude Code
    // 2.1.224 by installing this repository as a local marketplace and reading the inventory back: the
    // host expands a declared skills root exactly one level — `<root>/<skill>/SKILL.md` — and descends
    // no further. `./core/skills/` gave 3, `./plugin/skills/` gave 1, `./packs/rituals/` gave **0**
    // because the pack's skills sit at `<root>/checkpoints/skills/<skill>/`, and the inventory read
    // `Skills (4)` while this tool counted 7. Declaring `./packs/rituals/checkpoints/skills/` instead
    // read `Skills (7)`, naming `pre-commit`, `session-open` and `milestone-close`.
    //
    // So the depth bound above buys a resolution the platform does not honour, and a count that is
    // higher than the host's is the exact shape of a false green: the packaging looks coherent and
    // three skills are inert on every install. That is
    // ../.portulan/memory/a-manifest-field-can-validate-and-load-nothing.md a second time, in the
    // sibling field, and it is why this is a FAILURE rather than a note.
    const beyondHostReach = [];

    const walk = (dir, depth) => {
        if (fs.existsSync(path.join(dir, "SKILL.md"))) {
            found.push(dir);
            if (depth > HOST_SKILL_DEPTH) beyondHostReach.push(dir);
            return true;
        }
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            // An unreadable subtree below a declared root is not a verdict about packaging; the
            // declared path's own readability is judged by the caller, which reports it.
            return false;
        }
        const children = entries.filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name));
        if (children.length === 0) return false;
        if (depth >= MAX_DECLARED_SKILL_DEPTH) {
            truncated.push(dir);
            return false;
        }
        let any = false;
        for (const child of children) {
            if (walk(path.join(dir, child.name), depth + 1)) any = true;
        }
        return any;
    };

    // The `"./"` form: the root is itself one skill. Checked before the expansion so a root holding
    // both a SKILL.md and subdirectories stays one skill rather than becoming several.
    if (fs.existsSync(path.join(skillRoot, "SKILL.md"))) {
        return { found: [skillRoot], barren, truncated, beyondHostReach, empty: false };
    }

    let entries;
    try {
        entries = fs.readdirSync(skillRoot, { withFileTypes: true });
    } catch (error) {
        return { unreadable: error.code ?? error.message };
    }
    const children = entries.filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name));
    if (children.length === 0) return { found, barren, truncated, beyondHostReach, empty: true };

    // Attribution is per immediate child rather than per branch: a barren branch reported at every
    // level of itself is one defect wearing three failures.
    for (const child of children) {
        const dir = path.join(skillRoot, child.name);
        if (!walk(dir, 1)) barren.push(dir);
    }
    return { found, barren, truncated, beyondHostReach, empty: false };
}

// ===========================================================================================
// The command
// ===========================================================================================

const ICON = { fail: "FAIL", note: "note" };

export async function run(argv, options = {}) {
    const say = options.quiet ? () => {} : (line = "") => process.stdout.write(`${line}\n`);
    try {
        // `--payload` marks EVERY root on the line as a payload root. Kept deliberately coarse: the
        // recipe invokes this once per kind, which is clearer at the call site than a per-root syntax
        // nobody would read twice.
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
                // The usage line takes BOTH the plural and the flag, because it was narrower than the
                // tool on both counts: several roots have been accepted since this file shipped, and
                // `--payload` arrived with this change. A usage message printed at the moment a caller
                // already got it wrong is the worst place to be out of date. (Copilot, on the round
                // reviewing the payload mode — the same sentence-narrower-than-its-code shape this
                // pull request exists to correct one layer down.)
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
