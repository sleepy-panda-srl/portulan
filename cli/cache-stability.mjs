// Prefix baseline.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { alwaysTier } from "./context.mjs";
import { HOOK_RUNNERS, packContributions, policyDeclaration, composeFragments, parse } from "./compile.mjs";
import { isInside } from "./inside.mjs";

export const GOLDEN = "evals/cache-stability.golden.json";
const PATTERNS = {
    date: /\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?\b/g,
    hash: /\b[0-9a-f]{7,40}\b/gi,
    id: /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi,
    path: /(?:\/(?:Users|home|tmp|private|var|work|opt)\/[^\s"'`<>)};,]+|[A-Za-z]:\\[^\s"'`<>)};,]+)/g,
    count: /\b\d[\d,]*(?:\.\d+)?\s+(?:tokens?|requests?|files?|records?|lines?|bytes?|KB)\b/gi,
};

export function volatileTokens(text) {
    return Object.entries(PATTERNS).flatMap(([kind, re]) => [...String(text).matchAll(re)].map((m) => ({ kind, value: m[0] })));
}

export function inventory(named) {
    const root = fs.realpathSync(named);
    const surfaces = new Map();
    const read = (rel) => {
        const file = path.resolve(root, rel);
        if (!isInside(root, fs.realpathSync(file))) throw new Error(`surface outside repository: ${rel}`);
        return fs.readFileSync(file);
    };
    const add = (kind, rel, text = read(rel)) => {
        const id = `${kind}:${rel.split(path.sep).join("/")}`;
        if (surfaces.has(id)) throw new Error(`duplicate surface: ${id}`);
        surfaces.set(id, { id, sha256: createHash("sha256").update(text).digest("hex"), volatile: volatileTokens(text) });
    };
    const always = alwaysTier(root);
    if (!always.entries.length || always.missing.length || always.outside.length || always.tooDeep.length) throw new Error("always-tier coverage is incomplete");
    for (const entry of always.entries) add("always", path.relative(root, entry.file));
    for (const runner of HOOK_RUNNERS) add("hook", `cli/${runner}`);
    const settings = JSON.parse(read(".claude/settings.json"));
    if (!settings.hooks || typeof settings.hooks !== "object" || Array.isArray(settings.hooks) || !Object.keys(settings.hooks).length) throw new Error("compiled hooks are missing or malformed");
    for (const groups of Object.values(settings.hooks)) {
        if (!Array.isArray(groups) || !groups.length) throw new Error("compiled hook event is malformed");
        for (const group of groups) {
            if (!group || !Array.isArray(group.hooks) || !group.hooks.length) throw new Error("compiled hook group is malformed");
            for (const hook of group.hooks) {
                const field = hook?.type === "command" ? "command" : ["prompt", "agent"].includes(hook?.type) ? "prompt" : null;
                if (field === null || typeof hook[field] !== "string" || !hook[field].trim()) throw new Error("compiled hook text is malformed");
            }
        }
    }
    add("hook-commands", ".claude/settings.json", JSON.stringify(settings.hooks));
    const manifest = JSON.parse(read(".portulan/workspace.json"));
    if (typeof manifest.gates !== "string" || (manifest.packs !== undefined && !Array.isArray(manifest.packs))) throw new Error("gate selection is malformed");
    add("gate-selection", ".portulan/workspace.json", JSON.stringify({ gates: manifest.gates, packs: manifest.packs ?? [] }));
    const selected = policyDeclaration(root, ".portulan");
    if (!selected.declared) throw new Error("gate policy selection is refused by the runtime");
    const gateFile = path.relative(root, selected.file);
    const policy = JSON.parse(read(gateFile));
    parse(policy);
    add("gate-input", gateFile);
    const { contributions, unresolved } = packContributions(root, ".portulan", { packRoots: [path.join(root, "packs")] });
    if (unresolved.length) throw new Error("a composed pack did not resolve from repository packs");
    parse(composeFragments(policy, contributions).policy);
    for (const contribution of contributions) {
        if (contribution.fragments.length) add("gate-input", path.relative(root, path.join(contribution.dir, "pack.json")));
    }
    return { version: 1, surfaces: [...surfaces.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) };
}

function readGolden(root) {
    const expected = JSON.parse(fs.readFileSync(goldenPath(root), "utf8"));
    if (expected.version !== 1 || !Array.isArray(expected.surfaces) || !expected.surfaces.length) throw new Error("golden shape is invalid");
    const seen = new Set();
    for (const surface of expected.surfaces) {
        if (typeof surface.id !== "string" || !/^[a-z-]+:[^\r\n]+$/.test(surface.id) || !/^[a-f0-9]{64}$/.test(surface.sha256) || !Array.isArray(surface.volatile) ||
            surface.volatile.some((h) => !Object.hasOwn(PATTERNS, h.kind) || typeof h.value !== "string")) throw new Error("golden surface is malformed");
        if (seen.has(surface.id)) throw new Error(`duplicate golden surface: ${surface.id}`);
        seen.add(surface.id);
    }
    return expected;
}

export function check(root) {
    const actual = inventory(root);
    const expected = readGolden(root);
    const before = new Map(expected.surfaces.map((s) => [s.id, s]));
    const after = new Map(actual.surfaces.map((s) => [s.id, s]));
    return [...new Set([...before.keys(), ...after.keys()])].sort().filter((id) => JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id)));
}

function goldenPath(named) {
    const root = fs.realpathSync(named);
    const file = path.join(root, GOLDEN);
    const actual = fs.lstatSync(file, { throwIfNoEntry: false });
    const checked = actual ? fs.realpathSync(file) : fs.realpathSync(path.dirname(file));
    if (!isInside(root, checked)) throw new Error("golden resolves outside repository");
    return file;
}

export function run(argv, say = (line) => process.stdout.write(`${line}\n`)) {
    try {
        if (argv.includes("--help")) { say("usage: node cli/cache-stability.mjs [--write-golden] [repository-root]"); return 0; }
        if (argv.filter((arg) => arg === "--write-golden").length > 1) throw new Error("repeated --write-golden");
        const write = argv.includes("--write-golden");
        const dirs = argv.filter((arg) => arg !== "--write-golden");
        if (dirs.length > 1 || dirs.some((arg) => arg.startsWith("-"))) throw new Error("expected one repository root");
        const root = path.resolve(dirs[0] ?? ".");
        if (write) {
            const baseline = inventory(root);
            if (fs.lstatSync(path.join(root, GOLDEN), { throwIfNoEntry: false })) readGolden(root);
            fs.writeFileSync(goldenPath(root), JSON.stringify(baseline, null, 2) + "\n");
            say(`cache-stability: wrote ${GOLDEN}; review every baseline change`);
            return 0;
        }
        const drift = check(root);
        if (drift.length) {
            say(`cache-stability: RED — ${drift.length} surface(s) differ from the committed golden`);
            for (const id of drift) say(`  ${id}`);
            return 1;
        }
        say("cache-stability: GREEN — loaded text and hook sources match the committed golden");
        return 0;
    } catch (error) {
        say(`cache-stability: could not run — ${error.message}`);
        return 2;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = run(process.argv.slice(2));
