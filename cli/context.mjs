#!/usr/bin/env node
// What a context loads, measured — the measurement module proposal `0036` names.
//
//   node cli/context.mjs --workspace <dir> [--repo <card>] [--rail <name>=<bytes>]...
//   node cli/context.mjs --workspace <dir> --brief
//
// `0036` rules that what a host loads into every context is budgeted, like memory, and that nothing
// could see it: every size rail in this CLI counted lines, columns or bytes of the curated layer, and
// none looked at what a session is handed before it does anything. This reads that, per workspace, in
// two groups, and says for each file why it counts.
//
// ## The two groups, and why they are two
//
// **The boot read-set** is what every session that boots Portulan reads in full, in the boot skill's
// own order: the skill and the kernel (step 1), the manifest (step 2, read to find the slots), the slots
// `identity`, `principles`, `constitution`, `gates` and `dod`, the one repo card naming this repository,
// and the memory index (step 3), then the skill's packs step where the manifest names a pack (step 3a).
// It is the boot's **on-invoke** content in `0036`'s tiers — a file a procedure always reads is content
// in that procedure's tier, not a pointer — and it is the figure the records of 2026-09-23 measured:
// 213,002 bytes at the proposal, 95,602 after the gate map's split, 92,895 after the boot skill's.
// **Those records left the manifest out**, although step 2 reads it whole, so the output prints the
// figure both ways: the subtotal without it, which is theirs, and the total with it, which is the
// boot's. The engine half — the skill and the kernel — is the part every adopter's boot pays and no
// adopter can slim, so it is printed apart, and so are the skill's step files, which a boot reads only
// where each applies.
//
// **A boot whose card is loaded reads the skill and stops there**: the host loaded the card, with what
// it imports and the rest of the always tier, before the boot began. Its read-set is the skill and that
// tier, and it prints no subtotal, because it read no manifest to leave out.
//
// **A pointer is not measured here.** Its workspace resides elsewhere, and only the host's install
// records say where (step 2a): a measure that read them would give one tree a different figure on each
// machine. Run this on the workspace `cli/discover.mjs` resolves the pointer to. A manifest of no
// governing kind is a defect whose slots no boot reads, so it is refused too, never measured as a
// workspace.
//
// **The always tier** is what the host loads into every context in the repository, booted or not
// (`0036`, rule 1): for Claude Code, the project instruction files and the rules no `paths:` scopes,
// the files any rule imports, a scoped rule's included, and the descriptions of project skills,
// commands and agents. It is the tier a declared budget rails. The Portulan plugin's own descriptions
// load there too, wherever the plugin is enabled, and are printed beside the repository's own rather
// than inside it: an adopter cannot slim them, so a budget that counted them would be one the team
// could breach and not repair. Portulan rails them in its own repository instead (rule 3).
//
// ## A report by default, a rail by declaration
//
// A workspace that declares no budget gets the report and exit 0, with the offer `init` would make
// under `0036`'s ruling 5 — the larger of 8,000 tokens and what the repository loads today. **That
// offer is not a default**: rule 2 says the budget is declared and never defaulted, and a figure never
// below today's load could not fail anyway. Where `context.always.budget.tokens` is declared, the always
// tier over it is red, and the line names the repair the rule names — demotion, merge or retirement,
// never a raise in the change that breached it. That half, like memory's, is a rule no checker
// establishes.
//
// **Bytes become tokens at a declared ratio, never a measured one.** A per-run count would be a network
// call inside a recipe, and a ratio that moved between runs would make one tree red on one run and
// green on the next (`0036`, ruling 2). Where the manifest declares none, the report uses `0036`'s
// estimate and says so; a budget declared without a ratio could not be judged, so it exits 2. The exact
// mode — asking the host for the true count, on demand and never in a recipe — is a later change.
//
// ## One line, for `doctor` and the boot
//
// `0036` has `doctor` report every workspace's always tier with no configuration — its size, the top
// contributors and the tier each sits in — and says *the same figure closes the boot*. Both print
// `alwaysLine`'s one line, `doctor` as its `context` finding and `--brief` for the boot, so a session is
// never told a figure `doctor` does not report. It is the always tier alone: the boot read-set is the
// boot's own on-invoke cost, and the full report's. Nothing in the line waits on the boot read-set, so a
// slot naming nothing, which is `doctor`'s verdict to give, withholds no figure here; what cannot be
// measured is said, and it is a verdict only where a budget is declared, because a budget that could not
// be judged must not read as met.
//
// ## Rails
//
// `--rail <name>=<bytes>` fails the run when a measured group exceeds it: `boot` (the boot read-set,
// an uncarded boot's manifest included), `engine` (its engine half), `steps` (the skill's step files,
// every one, so a step that does not apply in the workspace measured is railed all the same) or
// `descriptions` (the plugin's). They are in bytes because bytes are exact and ratio-free. This
// repository's own rails are declared in `../.portulan/verify/context.sh`, one line each, which is where
// a demotion lowers them.
//
// Exit 0 within every rail and declared budget, or nothing declared · 1 a rail or a declared budget
// exceeded · 2 could not run: a manifest, slot, card or engine file missing, a key malformed, a pointer
// or a manifest of no governing kind, or a rail over a figure this run could not measure. `--brief`
// exits 1 over a declared budget and 2 only where it could not read the manifest or judge a declared
// budget; a figure it could not measure with no budget declared is said, and exits 0.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { BOOT_CARD_LINE, IMPORT_DEPTH, importPath, importSpans } from "./compile.mjs";
import { AGENT_DIR, parseFrontmatter } from "./plugin-lint.mjs";
import { HOST_SKILL_DEPTH, manifestPath } from "./skills-set.mjs";

export { IMPORT_DEPTH };

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The bundle this module runs from: this repository, or the installed plugin. */
export const BUNDLE_ROOT = path.resolve(HERE, "..");

/** The boot skill itself, which every boot reads when it is invoked: a router to the card or to the steps. */
export const BOOT_SKILL = { label: "boot skill", rel: "plugin/skills/portulan/SKILL.md" };

/**
 * What a boot with no card reads from the bundle: the skill, its steps in full, and the kernel step 1 reads.
 * A boot whose card is loaded reads the skill alone, because the card carries the rest.
 */
export const ENGINE = [BOOT_SKILL, { label: "boot steps", rel: "plugin/skills/portulan/steps.md" }, { label: "kernel", rel: "core/engine.md" }];

/** The kernel's first line, by which the router tells whether a session's context already holds it. */
export const KERNEL_LINE = "# Portulan engine";

/**
 * The skill's step files, each read at boot only where it applies: step 2a where the manifest is a
 * pointer, step 3a where it names a pack. They are the bundle's, like the skill.
 */
export const POINTER_STEP = { label: "pointer step", rel: "plugin/skills/portulan/pointer-manifest.md", where: "the manifest is a pointer" };
export const PACKS_STEP = { label: "packs step", rel: "plugin/skills/portulan/packs.md", where: "the manifest names a pack" };
export const STEPS = [POINTER_STEP, PACKS_STEP];

/** The kinds whose manifest is the workspace itself (step 2a). */
export const WORKSPACE_KINDS = ["repository", "demo", "portfolio"];

/** The slots the Workspace Definition requires of such a workspace; its schema is the source, and a test holds this to it. */
export const REQUIRED_SLOTS = ["identity", "principles", "gates"];

/** The slots step 3 reads in full, in its order. The repo card and the memory index follow them. */
export const BOOT_SLOTS = ["identity", "principles", "constitution", "gates", "dod"];

/**
 * `0036`'s estimate, from the sealed incident's instruction file. An estimate, printed as one: a
 * workspace that calibrates declares its own ratio and the host that measured it.
 */
export const ESTIMATED_BYTES_PER_TOKEN = 2.99;

/** `0036`, ruling 5: `init` offers the larger of this and what the repository loads today. */
export const OFFER_FLOOR_TOKENS = 8000;

/** What a rail is set to: today's figure plus this share, rounded up. */
export const HEADROOM_PERCENT = 2;

/** Past this share of headroom, the report says the rail can come down. */
export const NOTE_PERCENT = 5;

/** The host whose loading `alwaysTier` models, named in the line because another host loads other files. */
export const MEASURED_HOST = "Claude Code";

/** How many of the always tier's files the line names, largest first: where a demotion would start. */
export const TOP_CONTRIBUTORS = 3;

export const RAILS = ["boot", "engine", "steps", "descriptions"];

export class ContextError extends Error {
    constructor(message) {
        super(message);
        this.name = "ContextError";
    }
}

/** Today's figure plus `HEADROOM_PERCENT`, rounded up, in integers so no float decides a byte. */
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

// Absent is an answer: a path that names nothing. Anything else a stat meets, a denied read or a loop of
// links, is not, and reading it as absent would be a green over less than the host loads.
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

/**
 * The one reader of the manifest's `context` key, so a rename is one edit. Its names are the doctrine
 * change's: `context.always.budget.tokens`, `context.ratio.bytes_per_token`, `context.ratio.calibrated_by`.
 * Absent, it is a report. Malformed, it is refused rather than read as absent, because a budget this
 * misread would be a rail nobody knows is off: every level is held to spec 2.9's shape — `ratio`
 * required with both its fields, `always` optional and, where present, holding `budget.tokens` — and
 * a key that shape does not name is refused, so a misspelt `always` cannot switch the budget off. The
 * slug pattern `calibrated_by` must match is the schema's, which `doctor` checks, and not copied here.
 */
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

/**
 * The card naming THIS repository — step 3's "select it, do not read the directory". Named by `--repo`, or
 * the only card there is. With several and none named, no card is counted and the report says so: guessing
 * from a directory name would make one tree's figure depend on where it was checked out, which is the
 * instability `0036`'s ruling 2 refuses for the ratio.
 *
 * @returns {{ selected: string|null, why: string|null, others: number, file: string|null }}
 */
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

/**
 * @returns {{ entries: Array<{label: string, file: string, bytes: number, bundle?: boolean, engine?: boolean, manifest?: boolean}>,
 *             engineMissing: string[], card: {selected: string|null, why: string|null, others: number},
 *             notCounted: string[] }}
 */
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
        // Reported, not refused: the npm package carries the kernel and not the plugin's skill, and a
        // run there can still measure the workspace. A rail over the engine refuses it below.
        if (!isFile(file)) {
            engineMissing.push(rel);
            return;
        }
        entries.push({ label, file, bytes: sizeOf(file, label), bundle: true, ...(engine ? { engine: true } : {}) });
    };
    // A governing workspace must declare its slots, and three of them: read as absent, a missing or
    // malformed set would be a boot read-set of the engine alone, and a green over it.
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

    // **A boot whose card is loaded reads the skill and stops there.** The host loaded the card, with the
    // kernel it imports and the rest of the always tier, before the boot began, so that tier is what the
    // boot has; the slots, the manifest and the packs step are opened when the card or an on-path rule
    // sends a session to them, which is the on-read tier.
    if (always?.card) {
        fromBundle(BOOT_SKILL, true);
        for (const e of always.entries) entries.push({ ...e, always: true });
        // Where no file in context opens with the kernel's line, the router has the boot read the plugin's
        // kernel, as an adopter's must: its card cannot import a file outside the project.
        if (!always.entries.some((e) => readText(e.file, e.file).split(/\r?\n/)[0] === KERNEL_LINE)) fromBundle(ENGINE[2], true);
        // What the card imports is counted above, so only what it does not import waits to be opened.
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

    // Step 3a: the packs step, read where the manifest names a pack — the key alone, not the packs.
    const packs = Array.isArray(manifest.packs) ? manifest.packs.length : 0;
    if (packs > 0) fromBundle(PACKS_STEP, false);

    // What a boot does NOT read in full, derived from what this manifest declares, so the list is this
    // workspace's and not a generic one.
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

/**
 * The paths the host reads from the `@path` imports in an instruction file's text, in order. The host
 * evaluates none inside a code span or a fenced block, so neither does this; `importSpans` and
 * `importPath` in `./compile.mjs` are the one reader, so a unit `compile` checks and a rule this counts
 * are read alike.
 */
export function importsOf(text) {
    return importSpans(text)
        .map(({ target }) => importPath(target))
        .filter((bare) => bare !== null);
}

const inside = (root, file) => {
    const rel = path.relative(root, file);
    return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
};

/** A description as the host lists it: the frontmatter's, else the body's first paragraph. */
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

// Code-unit order, never the locale's: the listing is a recipe's output, and it must not move with the
// machine that printed it.
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

function listed(dir) {
    try {
        return fs.readdirSync(dir, { withFileTypes: true }).sort(byName);
    } catch (error) {
        throw new ContextError(`${dir} could not be listed (${error.code ?? error.message})`);
    }
}

/** The Markdown files under `dir` that `kept` lets through, in code-unit order. Linked directories are not walked. */
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

/**
 * @returns {{ entries: Array<{label: string, file: string, bytes: number}>, scoped: number,
 *             unlisted: number, missing: string[], outside: string[], tooDeep: string[], card: string|null }}
 */
export function alwaysTier(repoRoot) {
    const entries = [];
    const missing = [];
    const outside = [];
    const tooDeep = [];
    const seen = new Set();

    // A link the host follows out of the repository loads what it points at all the same, but that is
    // not this repository's to measure, and not this tool's to read: it is named, as an import outside
    // is, and never opened. Judged on real paths, so no link inside can smuggle a file in from outside.
    const realRoot = realOf(repoRoot);
    const kept = (file) => {
        const real = realOf(file);
        if (real === realRoot || inside(realRoot, real)) return true;
        outside.push(`${path.relative(repoRoot, file)} (a link out of the repository)`);
        return false;
    };

    // Breadth-first from the files the host loads, so a file reached at two depths counts once, at the
    // shallower, and one past the host's limit is named rather than silently dropped. A rule goes through the
    // loader an instruction file does, imports included. A rule a `paths:` key scopes is the on-path tier and
    // is not counted here, but the files it imports are: the host loads them into every context, since an
    // imported file carries no `paths:` of its own (`IMPORT_DEPTH` in ./compile.mjs says where both were read).
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
                // The host takes the path as written, to the next space and a closing full stop included,
                // and loads nothing from one that names no file (`IMPORT_DEPTH` in ./compile.mjs, same read).
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

    // Rules: a `paths:` key scopes one to the files it names, which is the on-path tier, while what it imports
    // loads everywhere. The one whose first line is the boot card's is the card, which a boot reads in place
    // of the slots.
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

    // Descriptions: the part of a skill, command or agent the host lists in every context. The body
    // loads when it is invoked. `disable-model-invocation` keeps a description out of the listing.
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

/**
 * The Portulan plugin's own descriptions, found the way the host finds them: the skill roots its
 * manifest declares, each expanded `HOST_SKILL_DEPTH` level, plus the default `skills/` directory, and
 * the agents at `AGENT_DIR` by convention.
 *
 * @returns {{ entries: Array<{label: string, file: string, bytes: number}>, skills: number, agents: number } | { unavailable: string }}
 */
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
    // Everything read here must be the bundle's: a skills root, or a link, that leaves it is a defect in
    // the plugin, and this module runs without `plugin-lint` to catch it first.
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

/** The manifest in `workspaceDir`, parsed, or refused: a manifest that is not a JSON object is no workspace to measure. */
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

/**
 * The repository whose instruction files the host loads: the one the manifest's `tree` names, or null
 * where it names none. A `demo` declares none, and its always tier is not this repository's to report.
 */
export function treeOf(workspaceDir, manifest) {
    if (manifest.tree === undefined) return null;
    if (typeof manifest.tree !== "string") throw new ContextError(`tree is ${JSON.stringify(manifest.tree)}, not a path`);
    const repoRoot = path.resolve(workspaceDir, manifest.tree);
    // A tree naming nothing would be an always tier of nothing, and a declared budget green over it.
    if (!isDir(repoRoot)) throw new ContextError(`tree (${manifest.tree}) names no directory, so there is no repository here whose always tier could be measured`);
    return repoRoot;
}

/**
 * The always tier against the budget the manifest declares: one judgement, which the full report and
 * the line both print, so neither can call within a budget a figure the other calls over it. Where none
 * is declared it is a report, with the offer `init` would make under `0036`'s ruling 5.
 *
 * @returns {{ verdict: "undeclared" | "within" | "over", tokens: number, text: string }}
 */
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
    // The engine half is what a boot with no card reads from the bundle, whichever way this workspace boots:
    // it is what every adopter without a card pays.
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

/**
 * The always tier in one line: its size, its largest files and what each is, what sits on-path beside
 * it, and the verdict against a declared budget. Paths are the repository's own and the plugin's, an
 * error's included, so the line moves neither with the directory it was run from nor with where either
 * sits.
 *
 * `over` and `unjudged` are verdicts: a budget exceeded, and a budget declared that could not be judged.
 * `unmeasured` is a report, said where no budget waits on the figure.
 *
 * @returns {{ verdict: "undeclared" | "within" | "over" | "unmeasured" | "unjudged", line: string }}
 */
export function alwaysLine(workspaceDir, manifest, { bundleRoot = BUNDLE_ROOT } = {}) {
    // Read raw, so a budget whose key is malformed still counts as one somebody meant to declare.
    const budgeted = manifest.context?.always !== undefined;
    // The tree as declared, before it is checked, since checking it is one of the things that can fail
    // on it. Raised by Copilot on #446.
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
    // The plugin's descriptions are an aside, not the workspace's: a defect in the bundle is said and
    // never withholds the repository's figure.
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
    // Both counts are said at zero too, so none reads apart from a count the line left out. Raised by
    // Copilot on #446.
    const scoped = always.scoped;
    parts.push(scoped === 0 ? "no path-scoped rule sits on-path" : scoped === 1 ? "1 path-scoped rule sits on-path" : `${grouped(scoped)} path-scoped rules sit on-path`);
    // Loaded by the host and not in the figure, so the figure must not read as the whole of it.
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
    return said(judged.verdict, parts.join("; "));
}

/**
 * `text` with each path under one of `roots` given from that root, and the root alone by its name. The
 * longest root goes first, so a root inside another gives its own paths; a filesystem root is none, since
 * every path is under it. Raised by Copilot on #446.
 */
function relativeTo(text, roots) {
    const usable = roots.filter(([root]) => root !== null && path.dirname(root) !== root).sort((a, b) => b[0].length - a[0].length);
    for (const [root, name] of usable) {
        text = text.split(`${root}${path.sep}`).join("").split(`${root} `).join(`${name} `);
        if (text.endsWith(root)) text = `${text.slice(0, -root.length)}${name}`;
    }
    return text;
}

/**
 * One line whatever a file is named: a control character in a path is escaped, never printed, so a name
 * can neither end the line nor reach a terminal as a sequence. Raised by Copilot on #446.
 */
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
                // Past 2^53 a number is not the digits typed, and a long enough string is Infinity:
                // either would be a rail no figure could ever breach.
                if (!Number.isSafeInteger(Number(match[2]))) throw new ContextError(`--rail ${value} is past the largest whole number of bytes this can compare exactly`);
                options.rails.set(match[1], Number(match[2]));
            }
        } else {
            throw new ContextError(`unknown argument ${JSON.stringify(flag)}`);
        }
    }
    if (options.workspace === null) throw new ContextError("--workspace <dir> is required: the directory holding workspace.json");
    // Refused rather than ignored: the line judges no rail and reads no card, and a flag taken and
    // dropped would read as a rail that held.
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
        say(
            `  boot read-set — carded: ${shown(boot.carded)} is this repository's boot card, loaded into every context with the rest of the always tier, ` +
                "so a session that boots here reads the skill and stops: the card carries the kernel and what the slots would",
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
    // `process.exitCode` rather than `process.exit`, which `./control-chars.mjs` settled: exiting
    // outright can truncate a pipe that has not drained. And 1 is reserved for a verdict, so anything
    // unhandled is 2 — a crash here is a defect in this tool, never a figure over its rail.
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
