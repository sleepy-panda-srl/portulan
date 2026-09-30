#!/usr/bin/env node
// What a context loads, measured: what a boot reads in full, and what the host loads into every context.
//
//   node cli/context.mjs --workspace <dir> [--repo <card>] [--rail <name>=<bytes>]...
//   node cli/context.mjs --workspace <dir> --brief
//
// Exit 0 within every rail and declared budget · 1 a rail or budget exceeded · 2 could not run or judge a declared budget.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { BOOT_CARD_LINE, IMPORT_DEPTH, importPath, importSpans } from "./compile.mjs";
import { offerText, splitOffers } from "./instructions.mjs";
import { AGENT_DIR, parseFrontmatter } from "./plugin-lint.mjs";
import { HOST_SKILL_DEPTH, manifestPath } from "./skills-set.mjs";

export { IMPORT_DEPTH };

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const BUNDLE_ROOT = path.resolve(HERE, "..");

export const BOOT_SKILL = { label: "boot skill", rel: "plugin/skills/portulan/SKILL.md" };

/** What a boot with no card reads from the bundle. */
export const ENGINE = [BOOT_SKILL, { label: "boot steps", rel: "plugin/skills/portulan/steps.md" }, { label: "kernel", rel: "core/engine.md" }];

/** The kernel's first line, by which the router tells whether a session's context already holds it. */
export const KERNEL_LINE = "# Portulan engine";

export const POINTER_STEP = { label: "pointer step", rel: "plugin/skills/portulan/pointer-manifest.md", where: "the manifest is a pointer" };
export const PACKS_STEP = { label: "packs step", rel: "plugin/skills/portulan/packs.md", where: "the manifest names a pack" };
export const STEPS = [POINTER_STEP, PACKS_STEP];

export const WORKSPACE_KINDS = ["repository", "demo", "portfolio"];

/** The schema's required slots, copied: a test holds this list to it. */
export const REQUIRED_SLOTS = ["identity", "principles", "gates"];

export const BOOT_SLOTS = ["identity", "principles", "constitution", "gates", "dod"];

export const ESTIMATED_BYTES_PER_TOKEN = 2.99;

export const OFFER_FLOOR_TOKENS = 8000;

export const HEADROOM_PERCENT = 2;

/** Past this share of headroom, the report says the rail can come down. */
export const NOTE_PERCENT = 5;

export const MEASURED_HOST = "Claude Code";

export const TOP_CONTRIBUTORS = 3;

export const RAILS = ["boot", "engine", "steps", "descriptions"];

export class ContextError extends Error {
    constructor(message) {
        super(message);
        this.name = "ContextError";
    }
}

/** Rounded up in integer arithmetic, so no float decides a byte. */
export function railFor(bytes) {
    return Math.floor((bytes * (100 + HEADROOM_PERCENT) + 99) / 100);
}

const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const tokensOf = (bytes, ratio) => Math.round(bytes / ratio);

function sizeOf(file, what) {
    let stat;
    try {
        stat = fs.statSync(file);
    } catch (error) {
        throw new ContextError(`${what} is not on disk (${error.code ?? error.message}) — a boot would miss it, and a measure without it would understate the load`);
    }
    if (!stat.isFile()) throw new ContextError(`${what} is not a file`);
    return stat.size;
}

function readText(file, what) {
    try {
        return fs.readFileSync(file, "utf8");
    } catch (error) {
        throw new ContextError(`${what} could not be read (${error.code ?? error.message})`);
    }
}

// Only these are absent: a denied read or a loop of links, read as absent, would be a green over less than the host loads.
const ABSENT = new Set(["ENOENT", "ENOTDIR", "ENAMETOOLONG", "ERR_INVALID_ARG_VALUE"]);

function statOf(file) {
    try {
        return fs.statSync(file);
    } catch (error) {
        if (ABSENT.has(error.code)) return null;
        throw new ContextError(`${file} could not be read (${error.code ?? error.message})`);
    }
}

const isDir = (dir) => statOf(dir)?.isDirectory() ?? false;

const isFile = (file) => statOf(file)?.isFile() ?? false;

function realOf(file) {
    try {
        return fs.realpathSync(file);
    } catch (error) {
        throw new ContextError(`${file} could not be resolved (${error.code ?? error.message})`);
    }
}

// ===========================================================================================
// The manifest key
// ===========================================================================================

/** Malformed is refused, never read as absent, so a misspelt key cannot switch the budget off. */
export function declaredContext(manifest) {
    if (manifest?.context === undefined) return { budget: null, ratio: null, calibratedBy: null };
    const shown = (value) => (value === undefined ? "absent" : JSON.stringify(value));
    const shaped = (value, where, keys) => {
        if (value === null || typeof value !== "object" || Array.isArray(value)) {
            throw new ContextError(`${where} is ${shown(value)}, not an object`);
        }
        const unknown = Object.keys(value).filter((key) => !keys.includes(key));
        if (unknown.length) {
            throw new ContextError(`${where} has ${unknown.map((key) => `\`${key}\``).join(", ")}, which spec 2.9 does not define — only ${keys.map((key) => `\`${key}\``).join(" and ")}`);
        }
        return value;
    };
    const context = shaped(manifest.context, "the manifest's `context`", ["always", "ratio"]);
    if (context.ratio === undefined) {
        throw new ContextError("context declares no ratio — spec 2.9 requires context.ratio, because a token budget with nothing to count it by is not a budget");
    }
    const ratio = shaped(context.ratio, "context.ratio", ["bytes_per_token", "calibrated_by"]);
    const bytesPerToken = ratio.bytes_per_token;
    if (!(typeof bytesPerToken === "number" && Number.isFinite(bytesPerToken) && bytesPerToken >= 1)) {
        throw new ContextError(`context.ratio.bytes_per_token is ${shown(bytesPerToken)}, not a finite number of at least 1`);
    }
    if (typeof ratio.calibrated_by !== "string" || ratio.calibrated_by === "") {
        throw new ContextError(`context.ratio.calibrated_by is ${shown(ratio.calibrated_by)}, not the id of the host whose exact count calibrated the ratio`);
    }
    let budget = null;
    if (context.always !== undefined) {
        const always = shaped(context.always, "context.always", ["budget"]);
        budget = shaped(always.budget, "context.always.budget", ["tokens"]).tokens;
        if (!(Number.isInteger(budget) && budget > 0)) {
            throw new ContextError(`context.always.budget.tokens is ${shown(budget)}, not a positive whole number of tokens`);
        }
    }
    return { budget, ratio: bytesPerToken, calibratedBy: ratio.calibrated_by };
}

// ===========================================================================================
// The boot read-set
// ===========================================================================================

function repoCard(workspaceDir, slots, repo) {
    const card = { selected: null, why: null, others: 0, file: null };
    if (slots.repos === undefined) {
        if (repo !== null) throw new ContextError(`--repo ${repo} was given, and this workspace declares no repos slot`);
        return card;
    }
    const dir = path.resolve(workspaceDir, slots.repos);
    let cards = [];
    try {
        cards = fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name.toLowerCase() !== "readme.md")
            .map((e) => e.name.slice(0, -3))
            .sort();
    } catch (error) {
        throw new ContextError(`slot \`repos\` (${slots.repos}) could not be listed (${error.code ?? error.message})`);
    }
    if (repo !== null) {
        if (!cards.includes(repo)) {
            throw new ContextError(`--repo ${repo} names no card in ${slots.repos} — the cards there are ${cards.join(", ") || "none"}`);
        }
        card.selected = repo;
    } else if (cards.length === 1) {
        card.selected = cards[0];
    } else if (cards.length > 1) {
        card.why = `${cards.length} cards and none named with --repo, so none is counted — a boot reads the one naming its repository`;
    } else {
        card.why = "the repos slot holds no card";
    }
    if (card.selected !== null) card.file = path.join(dir, `${card.selected}.md`);
    card.others = cards.length - (card.selected === null ? 0 : 1);
    return card;
}

export function bootReadSet(workspaceDir, manifest, { bundleRoot = BUNDLE_ROOT, repo = null, always = null } = {}) {
    if (manifest.kind === "pointer") {
        throw new ContextError(
            "the manifest is a pointer, and a pointer's workspace is resolved from the host's install records, which a recipe must not read — " +
                `measure the workspace \`node cli/discover.mjs --json\` resolves it to; a boot through the pointer also reads this manifest and the pointer step, ${POINTER_STEP.rel}`,
        );
    }
    if (!WORKSPACE_KINDS.includes(manifest.kind)) {
        throw new ContextError(
            `the manifest's kind is ${manifest.kind === undefined ? "absent" : JSON.stringify(manifest.kind)}, none of ${WORKSPACE_KINDS.join(", ")} or pointer — a defect \`doctor\` reports, and a boot reads no slot of it`,
        );
    }

    const entries = [];
    const engineMissing = [];
    const fromBundle = ({ label, rel }, engine) => {
        const file = path.join(bundleRoot, rel);
        // Reported, not refused: the npm package carries the kernel but not the plugin's skill.
        if (!isFile(file)) {
            engineMissing.push(rel);
            return;
        }
        entries.push({ label, file, bytes: sizeOf(file, label), bundle: true, ...(engine ? { engine: true } : {}) });
    };
    const slots = manifest.slots;
    if (slots === null || typeof slots !== "object" || Array.isArray(slots)) {
        throw new ContextError(`slots is ${slots === undefined ? "absent" : JSON.stringify(slots)}, and a ${manifest.kind} workspace declares its slots as an object`);
    }
    const undeclared = REQUIRED_SLOTS.filter((name) => slots[name] === undefined);
    if (undeclared.length) {
        throw new ContextError(
            `slot${undeclared.length === 1 ? "" : "s"} ${undeclared.map((name) => `\`${name}\``).join(", ")} ${undeclared.length === 1 ? "is" : "are"} not declared — the Workspace Definition requires ${REQUIRED_SLOTS.join(", ")} of every ${manifest.kind} workspace`,
        );
    }
    for (const [name, value] of Object.entries(slots)) {
        if (typeof value !== "string") throw new ContextError(`slot \`${name}\` is ${JSON.stringify(value)}, not a path`);
    }

    // A carded boot reads the skill alone: the host loaded the card, and the rest of the always tier, before it began.
    if (always?.card) {
        fromBundle(BOOT_SKILL, true);
        for (const e of always.entries) entries.push({ ...e, always: true });
        // An adopter's card cannot import a file outside the project, so its boot reads the plugin's kernel.
        if (!always.entries.some((e) => readText(e.file, e.file).split(/\r?\n/)[0] === KERNEL_LINE)) fromBundle(ENGINE[2], true);
        const real = (file) => {
            try {
                return fs.realpathSync(file);
            } catch {
                return path.resolve(file);
            }
        };
        const loaded = new Set(always.entries.map((e) => real(e.file)));
        const waits = (rel) => !loaded.has(real(path.resolve(workspaceDir, rel)));
        const replaced = [];
        if (waits("workspace.json")) replaced.push("the manifest");
        for (const slot of BOOT_SLOTS) if (slots[slot] !== undefined && waits(slots[slot])) replaced.push(`\`${slot}\``);
        if (slots.repos !== undefined) {
            const { file: cardFile } = repoCard(workspaceDir, slots, repo);
            if (cardFile === null || !loaded.has(real(cardFile))) replaced.push("this repository's card");
        } else if (repo !== null) {
            throw new ContextError(`--repo ${repo} was given, and this workspace declares no repos slot`);
        }
        if (typeof manifest.memory?.index?.path === "string" && waits(manifest.memory.index.path)) replaced.push("the memory index");
        if (Array.isArray(manifest.packs) && manifest.packs.length) replaced.push("the packs step");
        const notCounted = [`what the card replaces, each opened when the card or an on-path rule sends a session to it: ${replaced.join(", ")}`];
        if (slots.memory !== undefined) notCounted.push("memory records (the index points at each)");
        for (const [name, value] of Object.entries(slots)) {
            if (BOOT_SLOTS.includes(name) || name === "memory" || name === "repos") continue;
            notCounted.push(`${name} (${value})`);
        }
        notCounted.push("the on-read files anything above links to");
        return { entries, engineMissing, card: { selected: null, why: null, others: 0 }, notCounted, carded: always.card };
    }

    for (const e of ENGINE) fromBundle(e, true);
    const manifestFile = path.join(workspaceDir, "workspace.json");
    entries.push({ label: "manifest", file: manifestFile, bytes: sizeOf(manifestFile, "the manifest"), manifest: true });
    for (const slot of BOOT_SLOTS) {
        if (slots[slot] === undefined) continue;
        const file = path.resolve(workspaceDir, slots[slot]);
        entries.push({ label: slot, file, bytes: sizeOf(file, `slot \`${slot}\` (${slots[slot]})`) });
    }

    const { file: cardFile, ...card } = repoCard(workspaceDir, slots, repo);
    if (cardFile !== null) entries.push({ label: "repo card", file: cardFile, bytes: sizeOf(cardFile, `the ${card.selected} card`) });

    const indexPath = manifest.memory?.index?.path;
    if (indexPath !== undefined) {
        if (typeof indexPath !== "string") throw new ContextError(`memory.index.path is ${JSON.stringify(indexPath)}, not a path`);
        const file = path.resolve(workspaceDir, indexPath);
        entries.push({ label: "memory index", file, bytes: sizeOf(file, `the memory index (${indexPath})`) });
    }

    const packs = Array.isArray(manifest.packs) ? manifest.packs.length : 0;
    if (packs > 0) fromBundle(PACKS_STEP, false);

    const notCounted = [];
    if (slots.memory !== undefined) notCounted.push("memory records (the index points at each)");
    if (card.others > 0) notCounted.push(card.others === 1 ? "1 other repo card" : `${card.others} other repo cards`);
    for (const [name, value] of Object.entries(slots)) {
        if (BOOT_SLOTS.includes(name) || name === "memory" || name === "repos") continue;
        notCounted.push(`${name} (${value})`);
    }
    for (const key of ["handoffs", "personas"]) {
        if (manifest[key]?.index?.path !== undefined) notCounted.push(`the ${key} index`);
    }
    if (packs > 0) notCounted.push(`${packs === 1 ? "1 pack's" : `${packs} packs'`} files (the boot reads the key)`);
    notCounted.push("the on-read files anything above links to");

    return { entries, engineMissing, card, notCounted, carded: null };
}

// ===========================================================================================
// The always tier, as Claude Code loads it from a repository
// ===========================================================================================

export function importsOf(text) {
    return importSpans(text)
        .map(({ target }) => importPath(target))
        .filter((bare) => bare !== null);
}

const inside = (root, file) => {
    const rel = path.relative(root, file);
    return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
};

function descriptionOf(text) {
    const { fields } = parseFrontmatter(text);
    if (fields?.["disable-model-invocation"] === "true") return null;
    if (fields?.description !== undefined && fields.description !== "") return fields.description;
    const lines = text.split(/\r?\n/);
    let start = 0;
    if (lines[0]?.trim() === "---") {
        const close = lines.indexOf("---", 1);
        start = close === -1 ? lines.length : close + 1;
    }
    const paragraph = [];
    for (const line of lines.slice(start)) {
        if (line.trim() === "") {
            if (paragraph.length) break;
            continue;
        }
        paragraph.push(line.trim());
    }
    return paragraph.join(" ");
}

// Code-unit order, never the locale's, so a recipe's output does not move with the machine that printed it.
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

function listed(dir) {
    try {
        return fs.readdirSync(dir, { withFileTypes: true }).sort(byName);
    } catch (error) {
        throw new ContextError(`${dir} could not be listed (${error.code ?? error.message})`);
    }
}

/** Linked directories are not walked. */
function walkMarkdown(dir, kept) {
    const out = [];
    if (!isDir(dir) || !kept(dir)) return out;
    for (const entry of listed(dir)) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walkMarkdown(full, kept));
        else if (entry.name.endsWith(".md") && isFile(full) && kept(full)) out.push(full);
    }
    return out;
}

export function alwaysTier(repoRoot) {
    const entries = [];
    const missing = [];
    const outside = [];
    const tooDeep = [];
    const seen = new Set();

    // Judged on real paths: a link out of the repository is named, never opened, since it is not this repository's to measure.
    const realRoot = realOf(repoRoot);
    const kept = (file) => {
        const real = realOf(file);
        if (real === realRoot || inside(realRoot, real)) return true;
        outside.push(`${path.relative(repoRoot, file)} (a link out of the repository)`);
        return false;
    };

    // A path-scoped rule is on-path, but the files it imports carry no `paths:` and load into every context.
    const follow = (seeds) => {
        const queue = seeds.map(({ file, label, scoped = false }) => ({ file, label, depth: 0, scoped }));
        while (queue.length) {
            const { file, label, depth, scoped } = queue.shift();
            const real = realOf(file);
            if (!(scoped && depth === 0)) {
                if (seen.has(real)) continue;
                seen.add(real);
                const imported = `import, depth ${depth}${scoped ? ", of a path-scoped rule" : ""}`;
                entries.push({ label: depth === 0 ? label : imported, file, bytes: sizeOf(file, file) });
            }
            for (const { target } of importSpans(readText(file, file))) {
                const bare = importPath(target);
                if (bare === null) continue;
                const spelled = `@${target} (in ${path.relative(repoRoot, file)})`;
                if (bare.startsWith("~")) {
                    outside.push(spelled);
                    continue;
                }
                const resolved = path.resolve(path.dirname(file), bare);
                if (!isFile(resolved)) {
                    missing.push(spelled);
                    continue;
                }
                const real = realOf(resolved);
                if (real !== realRoot && !inside(realRoot, real)) {
                    outside.push(spelled);
                    continue;
                }
                if (depth + 1 >= IMPORT_DEPTH) {
                    tooDeep.push(spelled);
                    continue;
                }
                queue.push({ file: resolved, depth: depth + 1, scoped });
            }
        }
    };
    follow(
        ["CLAUDE.md", path.join(".claude", "CLAUDE.md")]
            .map((rel) => path.join(repoRoot, rel))
            .filter((file) => isFile(file) && kept(file))
            .map((file) => ({ file, label: "instructions" })),
    );

    let scoped = 0;
    let card = null;
    const unscoped = [];
    const pathScoped = [];
    for (const file of walkMarkdown(path.join(repoRoot, ".claude", "rules"), kept)) {
        const text = readText(file, file);
        const { fields } = parseFrontmatter(text);
        if (fields && Object.hasOwn(fields, "paths")) {
            scoped += 1;
            pathScoped.push({ file, label: "path-scoped rule", scoped: true });
            continue;
        }
        if (card === null && text.split(/\r?\n/)[0] === BOOT_CARD_LINE) card = file;
        unscoped.push({ file, label: "rule" });
    }
    follow([...unscoped, ...pathScoped]);

    // The host lists a skill's, command's or agent's description in every context, and loads the body when it is invoked.
    let unlisted = 0;
    const describe = (file, label) => {
        const description = descriptionOf(readText(file, file));
        if (description === null) {
            unlisted += 1;
            return;
        }
        entries.push({ label, file, bytes: Buffer.byteLength(description, "utf8") });
    };
    const skills = path.join(repoRoot, ".claude", "skills");
    if (isDir(skills) && kept(skills)) {
        for (const entry of listed(skills)) {
            const file = path.join(skills, entry.name, "SKILL.md");
            if (isFile(file) && kept(file)) describe(file, "skill description");
        }
    }
    for (const file of walkMarkdown(path.join(repoRoot, ".claude", "commands"), kept)) describe(file, "command description");
    const agents = path.join(repoRoot, ".claude", "agents");
    if (isDir(agents) && kept(agents)) {
        for (const entry of listed(agents)) {
            const file = path.join(agents, entry.name);
            if (entry.name.endsWith(".md") && isFile(file) && kept(file)) describe(file, "agent description");
        }
    }

    return { entries, scoped, unlisted, missing, outside, tooDeep, card };
}

export function pluginDescriptions(bundleRoot = BUNDLE_ROOT) {
    const file = manifestPath(bundleRoot);
    if (!isFile(file)) return { unavailable: "this bundle carries no .claude-plugin/plugin.json, so it is not the plugin" };
    let manifest;
    try {
        manifest = JSON.parse(readText(file, "the plugin manifest"));
    } catch (error) {
        if (error instanceof ContextError) throw error;
        throw new ContextError(`the plugin manifest does not parse (${error.message})`);
    }
    const realBundle = realOf(bundleRoot);
    const within = (file) => {
        const real = realOf(file);
        if (real !== realBundle && !inside(realBundle, real)) {
            throw new ContextError(`${path.relative(bundleRoot, file)} resolves out of the bundle — the plugin's skills and agents are read from inside it, never from elsewhere`);
        }
    };
    const declared = manifest.skills === undefined ? [] : [manifest.skills].flat();
    const roots = [path.join(bundleRoot, "skills"), ...declared.map((p) => path.resolve(bundleRoot, String(p)))];
    const skillDirs = new Set();
    const expand = (dir, depth) => {
        if (!isDir(dir)) return;
        within(dir);
        if (isFile(path.join(dir, "SKILL.md"))) {
            skillDirs.add(dir);
            return;
        }
        if (depth >= HOST_SKILL_DEPTH) return;
        for (const entry of listed(dir)) {
            if (entry.isDirectory()) expand(path.join(dir, entry.name), depth + 1);
        }
    };
    for (const root of roots) expand(root, 0);

    const entries = [];
    let skills = 0;
    let agents = 0;
    for (const dir of [...skillDirs].sort()) {
        const skill = path.join(dir, "SKILL.md");
        within(skill);
        const description = descriptionOf(readText(skill, skill));
        if (description === null) continue;
        skills += 1;
        entries.push({ label: "skill description", file: skill, bytes: Buffer.byteLength(description, "utf8") });
    }
    const agentDir = path.join(bundleRoot, AGENT_DIR);
    if (isDir(agentDir)) {
        within(agentDir);
        for (const { name } of listed(agentDir)) {
            const agent = path.join(agentDir, name);
            if (!name.endsWith(".md") || !isFile(agent)) continue;
            within(agent);
            const description = descriptionOf(readText(agent, agent));
            if (description === null) continue;
            agents += 1;
            entries.push({ label: "agent description", file: agent, bytes: Buffer.byteLength(description, "utf8") });
        }
    }
    return { entries, skills, agents };
}

// ===========================================================================================
// The whole measure
// ===========================================================================================

const sum = (entries) => entries.reduce((total, e) => total + e.bytes, 0);

export function readManifest(workspaceDir) {
    let manifest;
    try {
        manifest = JSON.parse(readText(path.join(workspaceDir, "workspace.json"), "the manifest"));
    } catch (error) {
        if (error instanceof ContextError) throw error;
        throw new ContextError(`the manifest does not parse (${error.message})`);
    }
    if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
        throw new ContextError("the manifest is not a JSON object");
    }
    return manifest;
}

export function treeOf(workspaceDir, manifest) {
    if (manifest.tree === undefined) return null;
    if (typeof manifest.tree !== "string") throw new ContextError(`tree is ${JSON.stringify(manifest.tree)}, not a path`);
    const repoRoot = path.resolve(workspaceDir, manifest.tree);
    if (!isDir(repoRoot)) throw new ContextError(`tree (${manifest.tree}) names no directory, so there is no repository here whose always tier could be measured`);
    return repoRoot;
}

export function judgeBudget(declared, bytes) {
    const tokens = tokensOf(bytes, declared.ratio ?? ESTIMATED_BYTES_PER_TOKEN);
    if (declared.budget === null) {
        return {
            verdict: "undeclared",
            tokens,
            text:
                "budget: undeclared (context.always.budget.tokens) — a report, not a rail; init would offer the larger of " +
                `${grouped(OFFER_FLOOR_TOKENS)} tokens and today's load: ${grouped(Math.max(OFFER_FLOOR_TOKENS, tokens))} tokens`,
        };
    }
    if (tokens > declared.budget) {
        return {
            verdict: "over",
            tokens,
            text:
                `budget: the always tier is ~${grouped(tokens)} tokens, over the ${grouped(declared.budget)} declared by ${grouped(tokens - declared.budget)} — ` +
                "repair by demotion to a later tier, by a merge or by a retirement, never by raising the budget in this change",
        };
    }
    return { verdict: "within", tokens, text: `budget: the always tier is ~${grouped(tokens)} tokens of the ${grouped(declared.budget)} declared` };
}

export function measure(workspaceDir, { bundleRoot = BUNDLE_ROOT, repo = null } = {}) {
    const manifest = readManifest(workspaceDir);
    const declared = declaredContext(manifest);
    const repoRoot = treeOf(workspaceDir, manifest);
    const always = repoRoot === null ? null : alwaysTier(repoRoot);
    const boot = bootReadSet(workspaceDir, manifest, { bundleRoot, repo, always });
    const plugin = pluginDescriptions(bundleRoot);
    const steps = STEPS.map(({ rel }) => path.join(bundleRoot, rel));
    const engine = ENGINE.map(({ rel }) => path.join(bundleRoot, rel));
    return {
        declared,
        boot,
        always,
        plugin,
        figures: {
            boot: boot.engineMissing.length ? null : sum(boot.entries),
            records: boot.engineMissing.length || boot.carded ? null : sum(boot.entries.filter((e) => !e.manifest)),
            engine: engine.every(isFile) ? engine.reduce((total, file, i) => total + sizeOf(file, ENGINE[i].label), 0) : null,
            // Every step file, applying here or not: each is some adopter's boot read-set.
            steps: steps.every(isFile) ? steps.reduce((total, file, i) => total + sizeOf(file, STEPS[i].label), 0) : null,
            workspace: sum(boot.entries.filter((e) => !e.bundle)),
            always: always === null ? null : sum(always.entries),
            descriptions: plugin.unavailable === undefined ? sum(plugin.entries) : null,
        },
    };
}

// ===========================================================================================
// The line `doctor` reports and the boot closes with
// ===========================================================================================

/** `over` and `unjudged` are verdicts; `unmeasured` is a report, said where no budget waits on the figure. */
export function alwaysLine(workspaceDir, manifest, { bundleRoot = BUNDLE_ROOT } = {}) {
    // Read raw, so a budget whose key is malformed still counts as one somebody meant to declare.
    const budgeted = manifest.context?.always !== undefined;
    // The tree as declared, before it is checked, since checking it is one of the things that can fail on it.
    const roots = [
        [typeof manifest.tree === "string" ? path.resolve(workspaceDir, manifest.tree) : null, "the repository"],
        [path.resolve(bundleRoot), "the plugin"],
    ];
    const said = (verdict, text) => ({ verdict, line: printable(relativeTo(`${MEASURED_HOST}: ${text}`, roots)) });
    const notMeasured = (why) =>
        budgeted ? said("unjudged", `the declared budget cannot be judged — ${why}`) : said("unmeasured", `the always tier is not measured — ${why}`);
    let declared;
    let root;
    let always;
    try {
        declared = declaredContext(manifest);
        if (manifest.kind === "pointer") return notMeasured("the manifest is a pointer, which declares no tree, so the repository it sits in is not measured here");
        root = treeOf(workspaceDir, manifest);
        if (root === null) return notMeasured("this workspace declares no tree, so there is no repository here whose instruction files a host would load");
        always = alwaysTier(root);
    } catch (error) {
        if (!(error instanceof ContextError)) throw error;
        return notMeasured(error.message);
    }
    let plugin;
    try {
        plugin = pluginDescriptions(bundleRoot);
    } catch (error) {
        if (!(error instanceof ContextError)) throw error;
        plugin = { unavailable: error.message };
    }

    const ratio = declared.ratio ?? ESTIMATED_BYTES_PER_TOKEN;
    const bytes = sum(always.entries);
    const judged = judgeBudget(declared, bytes);
    const parts = [
        `this repository's always tier is ~${grouped(judged.tokens)} tokens, ${grouped(bytes)} B at ${ratio} bytes per token` +
            (declared.ratio === null ? ", proposal 0036's estimate: none is declared" : `, declared, calibrated by ${declared.calibratedBy}`),
    ];
    if (always.entries.length) {
        // Stable, so files of one size keep the host's own order.
        const top = [...always.entries].sort((a, b) => b.bytes - a.bytes).slice(0, TOP_CONTRIBUTORS);
        parts.push(
            `the largest: ${top.map((e) => `${path.relative(root, e.file)} ~${grouped(tokensOf(e.bytes, ratio))} (${e.label})`).join(", ")}` +
                (always.entries.length > top.length ? `, of ${grouped(always.entries.length)} files` : ""),
        );
    } else {
        parts.push("nothing in it: no CLAUDE.md, .claude/CLAUDE.md, unscoped rule, or project skill, command or agent");
    }
    const scoped = always.scoped;
    parts.push(scoped === 0 ? "no path-scoped rule sits on-path" : scoped === 1 ? "1 path-scoped rule sits on-path" : `${grouped(scoped)} path-scoped rules sit on-path`);
    const outside = always.outside.length;
    parts.push(
        outside === 0
            ? "no import or link out of the repository loads"
            : outside === 1
              ? "1 import or link out of the repository loads and is not counted"
              : `${grouped(outside)} imports or links out of the repository load and are not counted`,
    );
    parts.push(
        plugin.unavailable === undefined
            ? `the Portulan plugin's descriptions add ~${grouped(tokensOf(sum(plugin.entries), ratio))} tokens wherever it is enabled, Portulan's to budget, not this workspace's`
            : `the Portulan plugin's descriptions are not measured — ${plugin.unavailable}`,
    );
    parts.push(judged.text);
    // `init` and `upgrade` draft a card importing the identity whole, so over a budget that import is the demotion to name.
    const identity = typeof manifest.slots?.identity === "string" ? path.resolve(workspaceDir, manifest.slots.identity) : null;
    const whole = judged.verdict === "over" && identity !== null ? always.entries.find((e) => e.label.startsWith("import") && path.resolve(e.file) === identity) : undefined;
    if (whole) {
        parts.push(
            `the tier imports ${path.relative(root, identity)} whole, ~${grouped(tokensOf(whole.bytes, ratio))} tokens: one demotion is to make it an on-demand read, ` +
                "as Portulan's own card does, a few lines on the card saying who the team is, naming the file and when to open it",
        );
    }
    const over = judged.verdict === "over";
    const offer = offerText(splitOffers(root, { ratio, floor: OFFER_FLOOR_TOKENS, over }), { over, workspace: path.relative(root, workspaceDir).split(path.sep).join("/") || "." });
    if (offer !== null) parts.push(offer);
    return said(judged.verdict, parts.join("; "));
}

/** Longest root first, so a root inside another gives its own paths; a filesystem root is skipped, as every path is under it. */
function relativeTo(text, roots) {
    const usable = roots.filter(([root]) => root !== null && path.dirname(root) !== root).sort((a, b) => b[0].length - a[0].length);
    for (const [root, name] of usable) {
        text = text.split(`${root}${path.sep}`).join("").split(`${root} `).join(`${name} `);
        if (text.endsWith(root)) text = `${text.slice(0, -root.length)}${name}`;
    }
    return text;
}

function printable(text) {
    return text.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

// ===========================================================================================
// The report
// ===========================================================================================

function parseArgs(argv) {
    const options = { workspace: null, repo: null, rails: new Map(), brief: false };
    for (let i = 0; i < argv.length; i += 1) {
        const flag = argv[i];
        if (flag === "--brief") {
            if (options.brief) throw new ContextError("--brief is given twice");
            options.brief = true;
        } else if (flag === "--workspace" || flag === "--repo" || flag === "--rail") {
            const value = argv[i + 1];
            i += 1;
            if (value === undefined) throw new ContextError(`${flag} needs a value`);
            if (flag === "--workspace") options.workspace = value;
            else if (flag === "--repo") options.repo = value;
            else {
                const match = /^([a-z]+)=([1-9]\d*)$/.exec(value);
                if (!match) throw new ContextError(`--rail ${value} is not <name>=<bytes>, with a whole number of bytes`);
                if (!RAILS.includes(match[1])) throw new ContextError(`--rail ${match[1]} is not a rail — the rails are ${RAILS.join(", ")}`);
                if (options.rails.has(match[1])) throw new ContextError(`--rail ${match[1]} is given twice`);
                if (!Number.isSafeInteger(Number(match[2]))) throw new ContextError(`--rail ${value} is past the largest whole number of bytes this can compare exactly`);
                options.rails.set(match[1], Number(match[2]));
            }
        } else {
            throw new ContextError(`unknown argument ${JSON.stringify(flag)}`);
        }
    }
    if (options.workspace === null) throw new ContextError("--workspace <dir> is required: the directory holding workspace.json");
    if (options.brief && (options.repo !== null || options.rails.size)) {
        throw new ContextError("--brief prints the always tier's line, which judges no rail and reads no card — run without it to use --repo or --rail");
    }
    return options;
}

export function run(argv, say = (line) => process.stdout.write(`${line}\n`), { bundleRoot = BUNDLE_ROOT, cwd = process.cwd() } = {}) {
    let options;
    let result;
    try {
        options = parseArgs(argv);
        if (options.brief) {
            const workspaceDir = path.resolve(cwd, options.workspace);
            const { verdict, line } = alwaysLine(workspaceDir, readManifest(workspaceDir), { bundleRoot });
            say(line);
            return verdict === "over" ? 1 : verdict === "unjudged" ? 2 : 0;
        }
        result = measure(path.resolve(cwd, options.workspace), { bundleRoot, repo: options.repo });
    } catch (error) {
        if (!(error instanceof ContextError)) throw error;
        say(`  ✗ ${error.message}`);
        return 2;
    }
    const { declared, boot, always, plugin, figures } = result;
    const ratio = declared.ratio ?? ESTIMATED_BYTES_PER_TOKEN;
    const shown = (file) => {
        const rel = path.relative(cwd, file);
        return rel.startsWith("..") || path.isAbsolute(rel) ? file : rel;
    };
    const line = (bytes, label, what) =>
        say(`  ${grouped(bytes).padStart(9)} B ${`~${grouped(tokensOf(bytes, ratio))}`.padStart(8)} tok  ${label.padEnd(18)} ${what}`);

    say(`context: ${options.workspace} — what a session that boots here reads, and what the host loads into every context`);
    say(
        declared.ratio === null
            ? `  ratio: ${ESTIMATED_BYTES_PER_TOKEN} bytes per token, proposal 0036's estimate — this workspace declares none, so every token figure is approximate`
            : `  ratio: ${declared.ratio} bytes per token, declared${declared.calibratedBy === null ? "" : `, calibrated by ${declared.calibratedBy}`}`,
    );

    if (boot.carded) {
        const fallback = boot.entries.some((e) => e.bundle && e.label === "kernel");
        say(
            `  boot read-set — carded: ${shown(boot.carded)} is this repository's boot card, loaded into every context with the rest of the always tier, ` +
                (fallback
                    ? "so a session that boots here reads the skill and the plugin's kernel, which nothing in context carries, and the card stands in for the slots"
                    : "so a session that boots here reads the skill and stops: the card carries the kernel and stands in for the slots"),
        );
    } else {
        say("  boot read-set — read in full by every session that boots Portulan here: the skill, its steps and the kernel (step 1), the manifest (step 2, to find the slots), the slots, this repository's card and the memory index (step 3), the packs step where the manifest names a pack (step 3a)");
    }
    for (const e of boot.entries) line(e.bytes, e.label, shown(e.file));
    for (const rel of boot.engineMissing) say(`  ${"—".padStart(9)}   ${"".padStart(8)}      ${"engine".padEnd(18)} ${rel} is not in this bundle, so the engine half is not measured`);
    if (boot.card.why !== null) say(`  ${"—".padStart(9)}   ${"".padStart(8)}      ${"repo card".padEnd(18)} ${boot.card.why}`);
    if (figures.records !== null) line(figures.records, "without manifest", "the figure the 2026-09-23 records measured, which left the manifest out");
    if (figures.boot !== null) {
        line(
            figures.boot,
            "total",
            boot.carded
                ? `the boot read-set; the engine half a boot with no card reads is ${grouped(figures.engine)} B`
                : `the boot read-set; its engine half, which every adopter's boot reads, is ${grouped(figures.engine)} B`,
        );
    }
    else line(figures.workspace, "workspace half", "the boot read-set less the bundle's files, which this bundle does not carry in full");
    if (figures.steps !== null) {
        line(figures.steps, "step files", `the skill's, each read only where it applies: ${STEPS.map((s) => `${shown(path.join(bundleRoot, s.rel))} where ${s.where}`).join(", ")}`);
    }
    say(`  not counted, because a boot opens them on demand: ${boot.notCounted.join(", ")}`);

    say("  always tier — what Claude Code loads into every context in this repository, booted or not (proposal 0036, rule 1)");
    if (always === null) {
        say("  not measured: this workspace declares no tree, so there is no repository whose instruction files a host would load");
    } else {
        for (const e of always.entries) line(e.bytes, e.label, shown(e.file));
        line(figures.always, "repository's own", always.entries.length ? "what a declared context.always.budget.tokens budgets" : "none: no CLAUDE.md, .claude/CLAUDE.md, unscoped rule, or project skill, command or agent");
        const aside = [];
        if (always.scoped) aside.push(`${always.scoped} path-scoped rule(s), on-path`);
        if (always.unlisted) aside.push(`${always.unlisted} description(s) the host does not list (disable-model-invocation)`);
        if (always.missing.length) aside.push(`imports naming no file, which load nothing: ${always.missing.join(", ")}`);
        if (always.tooDeep.length) aside.push(`imports ${IMPORT_DEPTH} deep or more, which the host does not load: ${always.tooDeep.join(", ")}`);
        if (always.outside.length) aside.push(`imports and links outside the repository, loaded and not measured: ${always.outside.join(", ")}`);
        for (const a of aside) say(`  also: ${a}`);
    }
    if (plugin.unavailable !== undefined) say(`  the Portulan plugin's descriptions: not measured — ${plugin.unavailable}`);
    else line(figures.descriptions, "Portulan plugin", `${plugin.skills} skill and ${plugin.agents} agent descriptions, in every session where the plugin is enabled — Portulan's to budget, not this workspace's`);
    say("  not measured, because they are not this repository's: CLAUDE.local.md (personal), CLAUDE.md files above the repository, the host's auto memory, its system prompt, tools and MCP servers");

    let red = false;
    const couldNot = [];
    if (always === null) {
        if (declared.budget === null) say("  budget: undeclared (context.always.budget.tokens) — a report, not a rail");
        else couldNot.push("context.always.budget.tokens is declared, and this workspace declares no tree whose always tier it could budget");
    } else {
        const judged = judgeBudget(declared, figures.always);
        if (judged.verdict === "over") red = true;
        say(`  ${{ undeclared: "", within: "ok ", over: "✗ " }[judged.verdict]}${judged.text}`);
    }

    for (const [name, rail] of options.rails) {
        const figure = figures[name];
        if (figure === null) {
            const why = { descriptions: "the plugin's descriptions were not measured", steps: "the skill's step files are not in this bundle" };
            couldNot.push(`rail ${name} cannot be judged: ${why[name] ?? `${boot.engineMissing.join(" and ")} ${boot.engineMissing.length === 1 ? "is" : "are"} not in this bundle`}`);
            continue;
        }
        if (name === "boot" && boot.card.why !== null && boot.card.others > 0) {
            couldNot.push(`rail boot cannot be judged: ${boot.card.why}`);
            continue;
        }
        if (figure > rail) {
            red = true;
            say(
                `  ✗ rail ${name}: ${grouped(figure)} B, over its rail of ${grouped(rail)} B by ${grouped(figure - rail)} B — ` +
                    "repair by demotion, merge or retirement, never by raising the rail in this change",
            );
            continue;
        }
        say(`  ok rail ${name}: ${grouped(figure)} B of ${grouped(rail)} B (${grouped(rail - figure)} B headroom)`);
        if ((rail - figure) * 100 > rail * NOTE_PERCENT) {
            say(`  note rail ${name}: its headroom is more than ${NOTE_PERCENT}% of it — lower it to ${grouped(railFor(figure))} B, today's figure plus ${HEADROOM_PERCENT}%`);
        }
    }

    if (couldNot.length) {
        for (const c of couldNot) say(`  ✗ ${c}`);
        return 2;
    }
    return red ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    // `process.exitCode` rather than `process.exit`, so a pipe that has not drained is not cut short.
    try {
        process.exitCode = run(process.argv.slice(2));
    } catch (cause) {
        process.stderr.write(
            `context: could not run — ${cause?.stack ?? cause}\n` +
                "This is a defect in the measure, not a verdict about the workspace: nothing was judged.\n",
        );
        process.exitCode = 2;
    }
}
