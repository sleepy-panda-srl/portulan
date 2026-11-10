import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const bytes = text => Buffer.byteLength(text, "utf8");
const ordered = values => [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
const inside = (base, file) => {
    const rel = path.relative(base, file);
    return rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
};
function entry(root, file, kind) {
    if (!inside(path.resolve(root), path.resolve(file))) throw Error(`${file} is outside its owner`);
    const real = fs.realpathSync(file);
    if (!inside(fs.realpathSync(root), real)) throw Error(`${file} resolves outside its owner`);
    if (!fs.statSync(real)[kind]()) throw Error(`${file} is not a ${kind === "isFile" ? "regular file" : "directory"}`);
    return real;
}
function selected(root) {
    for (const file of [".portulan/verify/prompt-footprint.mjs", "cli/compile.mjs", "cli/skills-set.mjs", "cli/plugin-lint.mjs", "cli/gate.mjs", "cli/stop-gate.mjs", "cli/advisory.mjs", "cli/vendor.mjs"]) entry(root, path.join(root, file), "isFile");
}
let HOST_SKILL_DEPTH, AGENT_DIR, parseFrontmatter, packContributions, HOOK_RUNNERS, loadError;
try {
    selected(ROOT);
    ({ HOST_SKILL_DEPTH } = await import("../../cli/skills-set.mjs"));
    ({ AGENT_DIR, parseFrontmatter } = await import("../../cli/plugin-lint.mjs"));
    ({ packContributions, HOOK_RUNNERS } = await import("../../cli/compile.mjs"));
} catch (error) { loadError = error; }
function ready(root) {
    if (loadError) throw loadError;
    selected(root);
}
function read(root, file) {
    const real = entry(root, file, "isFile");
    try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(fs.readFileSync(real)); }
    catch (error) { throw Error(`${file} is not readable UTF-8: ${error.message}`); }
}
function optional(file) {
    try { fs.lstatSync(file); return true; }
    catch (error) { if (error.code === "ENOENT") return false; throw error; }
}
function manifestAt(root, file) {
    const value = JSON.parse(read(root, file));
    if (value === null || typeof value !== "object" || Array.isArray(value) || typeof value.name !== "string" || !value.name.trim()) throw Error(`${file}: manifest must be a named object`);
    return value;
}
function metadata(lines) {
    const levels = [{ indent: 0, keys: new Set() }];
    let parent = false, block = null;
    const scalar = (raw, arrayItem = false) => {
        const value = raw.trim();
        if (value.startsWith('"')) { try { if (typeof JSON.parse(value) === "string") return; } catch { /* refused below */ } }
        else if (value.startsWith("'")) { if (/^'(?:[^']|'')*'$/.test(value)) return; }
        else if (value.startsWith("[")) {
            if (!arrayItem && value.endsWith("]")) {
                const items = value.slice(1, -1).trim();
                if (!items) return;
                for (const item of items.split(",")) { if (!item.trim()) throw Error("frontmatter array item is empty"); scalar(item, true); }
                return;
            }
        } else if (/^[\p{L}\p{N}_]/u.test(value) && !value.includes(":") && !(arrayItem && /[\[\]{},#]/.test(value))) return;
        throw Error("frontmatter uses invalid or unsupported scalar syntax");
    };
    for (const line of lines) {
        if (/[^\S ]/u.test(line)) throw Error("frontmatter whitespace must be an ordinary space");
        if (/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029\ufffe\uffff]/.test(line)) throw Error("frontmatter contains a control or unsupported line-break character");
        if (!line.trim()) {
            if (block && block.content === null) block.leading = Math.max(block.leading ?? 0, /^ */.exec(line)[0].length);
            continue;
        }
        const indent = /^ */.exec(line)[0].length;
        if (block !== null && indent > block.header) {
            if (block.content === null && indent < (block.leading ?? 0)) throw Error("frontmatter block scalar has over-indented leading empty lines");
            block.content ??= indent;
            if (indent < block.content) throw Error("frontmatter block scalar has an illegal dedent");
            continue;
        }
        block = null;
        if (line.trimStart().startsWith("#")) continue;
        const match = /^( *)([A-Za-z_][\w-]*):(?:\s+(.*))?$/.exec(line);
        if (!match) throw Error("frontmatter uses invalid or unsupported mapping syntax");
        let popped = false;
        while (levels.length > 1 && levels.at(-1).indent > indent) { levels.pop(); popped = true; }
        if (indent > levels.at(-1).indent) {
            if (popped || !parent) throw Error("frontmatter indentation has no parent mapping");
            levels.push({ indent, keys: new Set() });
        }
        if (indent !== levels.at(-1).indent || levels.at(-1).keys.has(match[2])) throw Error("frontmatter mapping indentation or duplicate key is invalid");
        levels.at(-1).keys.add(match[2]);
        const value = match[3]?.trim() ?? "";
        parent = value === "";
        if (/^[|>][+-]?$/.test(value)) block = { header: indent, content: null };
        else if (value) scalar(value);
    }
}
function body(text) {
    const parsed = parseFrontmatter(text);
    if (parsed.error) throw Error(`invalid frontmatter: ${parsed.error}`);
    if (!parsed.fields) return text;
    const lines = [...text.matchAll(/[^\n]*(?:\n|$)/g)];
    const close = lines.findIndex((line, index) => index > 0 && line[0].replace(/\r?\n$/, "") === "---");
    if (close < 0) throw Error("frontmatter is not closed");
    metadata(lines.slice(1, close).map(line => line[0].replace(/\r?\n$/, "")));
    return text.slice(lines[close].index + lines[close][0].length);
}

export function inventory(root = ROOT) {
    ready(root);
    const skills = new Map(), personas = new Map();
    const add = (set, file, owner, provenance) => {
        const real = entry(owner, file, "isFile");
        const stat = fs.statSync(real, { bigint: true });
        const identity = `${stat.dev}:${stat.ino}`;
        const previous = set.get(identity);
        if (previous) { previous.provenance.push(provenance); previous.aliases.push(path.relative(root, file)); return; }
        const text = body(read(owner, file));
        if (!text.trim()) throw Error(`${file} has no prompt body`);
        set.set(identity, { file: path.relative(root, file), aliases: [], bytes: bytes(text), provenance: [provenance] });
    };
    for (const base of [root, path.join(root, "packs")]) {
        const file = path.join(base, ".claude-plugin/plugin.json");
        const manifest = manifestAt(base, file);
        if (manifest.skills !== undefined && !Array.isArray(manifest.skills) && typeof manifest.skills !== "string") throw Error("plugin skills declaration is malformed");
        const declared = manifest.skills === undefined ? [] : [manifest.skills].flat();
        const expand = (dir, depth, provenance) => {
            const real = entry(base, dir, "isDirectory");
            const skill = path.join(dir, "SKILL.md");
            if (optional(skill)) { add(skills, skill, base, provenance); return 1; }
            if (depth >= HOST_SKILL_DEPTH) return 0;
            let count = 0;
            for (const name of ordered(fs.readdirSync(real))) {
                const child = path.join(dir, name);
                const stat = fs.lstatSync(child);
                if (stat.isDirectory()) count += expand(child, depth + 1, provenance);
                else if (stat.isSymbolicLink()) {
                    const realChild = fs.realpathSync(child);
                    if (!inside(fs.realpathSync(base), realChild)) throw Error(`${child} resolves outside its owner`);
                    if (fs.statSync(realChild).isDirectory()) count += expand(child, depth + 1, provenance);
                }
            }
            return count;
        };
        const fallback = path.join(base, "skills");
        if (optional(fallback)) expand(fallback, 0, `${path.relative(root, base) || "."}: default skills/`);
        for (const rel of declared) {
            if (typeof rel !== "string" || !rel.trim()) throw Error("plugin skills declaration is malformed");
            if (!expand(path.resolve(base, rel), 0, `${path.relative(root, file)}: ${rel}`)) throw Error(`${rel}: declared root has no reachable skill`);
        }
        const agentDir = path.join(base, AGENT_DIR);
        if (optional(agentDir)) {
            entry(base, agentDir, "isDirectory");
            for (const name of ordered(fs.readdirSync(agentDir))) if (name.endsWith(".md")) add(personas, path.join(agentDir, name), base, `${path.relative(root, file)}: default ${AGENT_DIR}/`);
        }
    }
    const core = path.join(root, "core/personas");
    entry(root, core, "isDirectory");
    for (const name of ordered(fs.readdirSync(core))) if (name.endsWith(".md") && name !== "README.md") add(personas, path.join(core, name), root, "core persona charter");
    const manifestFile = path.join(root, ".portulan/workspace.json");
    const manifest = manifestAt(root, manifestFile);
    if (manifest.packs !== undefined && !Array.isArray(manifest.packs)) throw Error("workspace manifest packs are malformed");
    for (const ref of manifest.packs ?? []) {
        if (typeof ref !== "string" || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(ref)) throw Error("composed pack reference is not auditable");
        const pack = manifestAt(root, path.join(root, "packs", ref, "pack.json"));
        if (pack.contributes !== undefined && (pack.contributes === null || typeof pack.contributes !== "object" || Array.isArray(pack.contributes))) throw Error(`${ref}: pack manifest contributes must be a mapping`);
    }
    const composed = packContributions(root, ".portulan", { packRoots: [path.join(root, "packs")] });
    if (composed.unresolved.length || composed.contributions.length !== (manifest.packs ?? []).length) throw Error("composed persona coverage is unavailable");
    const unbound = [];
    for (const contribution of composed.contributions) {
        for (const rel of contribution.personas) {
            const file = path.resolve(contribution.dir, rel);
            add(personas, file, contribution.dir, `composed ${contribution.pack}: ${rel}`);
            const name = parseFrontmatter(read(contribution.dir, file)).fields?.name ?? path.basename(file, ".md");
            if (!optional(path.join(root, AGENT_DIR, `${name}.md`))) unbound.push(name);
        }
    }
    for (const name of ["implementer", "librarian", "reviewer"]) {
        for (const dir of ["core/personas", AGENT_DIR]) entry(root, path.join(root, dir, `${name}.md`), "isFile");
    }
    return { skills: [...skills.values()], personas: [...personas.values()], unbound: ordered(unbound) };
}

export async function hookProfiles(root) {
    ready(root);
    process.env.CLAUDE_PROJECT_DIR = "/portulan-footprint";
    process.env.PORTULAN_WORKSPACE = ".portulan";
    const load = name => import(pathToFileURL(entry(root, path.join(root, "cli", name), "isFile")).href);
    const { gateOutput } = await load("gate.mjs");
    const { runStopRecipe, verdict, workNotice, stopOutput } = await load("stop-gate.mjs");
    const { advisoryOutput } = await load("advisory.mjs");
    const entries = [];
    const add = (runner, profile, channel, text, nonempty = true) => {
        if (typeof text !== "string" || (nonempty ? text.length === 0 : text.length !== 0)) throw Error(`${profile}: native hook coverage missing`);
        entries.push({ runner, profile, channel, bytes: bytes(text), provenance: `production ${runner} formatter; fixed synthetic inputs` });
    };
    for (const tier of ["gated", "prohibited"]) {
        const out = JSON.parse(gateOutput({ id: "footprint-action", tier, reason: "Synthetic action needs review." }));
        if (out.hookSpecificOutput.hookEventName !== "PreToolUse" || out.hookSpecificOutput.permissionDecision !== (tier === "gated" ? "ask" : "deny")) throw Error("gate native shape changed");
        add("gate.mjs", `gate-${tier}`, "permissionDecisionReason", out.hookSpecificOutput.permissionDecisionReason);
    }
    if (gateOutput(null) !== null) throw Error("ignored gate no longer silent");
    add("gate.mjs", "gate-ignored", "stdout", "", false);
    const recipe = { id: "check", run: "synthetic executor only", timeout: 60 };
    const outcomes = [
        ["red", { outcome: "red", code: 1, stdout: "FAIL synthetic check\n", stderr: "" }],
        ["unavailable", { outcome: "could-not-run", code: 2, stdout: "", stderr: "synthetic dependency unavailable\n" }],
        ["timeout", { outcome: "could-not-run", code: null, timedOut: true, stdout: "", stderr: "", reasons: ["synthetic timeout"] }],
        ["throw", new Error("synthetic executor failure")],
        ["missing-recipe", null],
        ["green", { outcome: "green", code: 0, stdout: "PASS synthetic check\n", stderr: "" }],
    ];
    for (const [name, result] of outcomes) {
        const problem = await runStopRecipe(result === null ? null : recipe, async () => { if (result instanceof Error) throw result; return result; });
        const out = stopOutput(verdict({ problems: problem ? [problem] : [] }));
        if (name === "green" && (out.stdout !== "" || out.stderr !== "" || problem !== null)) throw Error("green Stop must retain native silence");
        const native = out.stdout ? JSON.parse(out.stdout) : null;
        if (native && native.decision !== "block") throw Error("Stop native shape changed");
        if (out.stderr !== "") throw Error("ordinary Stop unexpectedly emitted operator output");
        add("stop-gate.mjs", `stop-${name}`, "reason", native?.reason ?? "", name !== "green");
    }
    for (const handoff of [false, true]) {
        const text = workNotice({ identity: "synthetic-tree", directory: handoff ? "handoffs/" : null, stamp: "2000-01-01", recorded: ["2000-01-01-held.md"] });
        const problem = { reason: "handoff", text };
        const ordinary = stopOutput(verdict({ problems: [problem], handoffEnabled: handoff }));
        const native = JSON.parse(ordinary.stdout);
        if (native.decision !== "block" || ordinary.stderr !== "") throw Error("work/handoff native Stop channels changed");
        add("stop-gate.mjs", handoff ? "handoff" : "work", "reason", native.reason);
        for (const [bound, state] of [["reason", { counts: { handoff: 4 } }], ["total", { total: 10 }], ["chain", { chain: 13 }]]) {
            const out = stopOutput(verdict({ problems: [problem], handoffEnabled: handoff, ...state }));
            if (out.stdout !== "") throw Error("released Stop no longer silent to the agent");
            add("stop-gate.mjs", `release-${handoff ? "handoff" : "work"}-${bound}`, "stderr (operator)", out.stderr);
        }
    }
    for (const event of ["PostToolUse", "UserPromptSubmit", "Stop"]) {
        for (const [name, multipliers] of [["declared", { source: "declared", read: 0.1, write: 1.25 }], ["recorded-5m", { recorded: true, lifetime: "5m", read: 0.1, write: 1.25 }], ["recorded-1h", { recorded: true, lifetime: "1h", read: 0.1, write: 2 }], ["undeclared", { recorded: false, read: 0.1, write: 1.25 }]]) {
            const native = JSON.parse(advisoryOutput({ requests: 20, context: 30000, threshold: 26000, fresh: 16000, horizon: 20, multipliers }, event));
            if (event === "Stop" ? native.decision !== "block" : native.hookSpecificOutput.hookEventName !== event) throw Error("advisory native shape changed");
            add("advisory.mjs", `${event}-${name}`, event === "Stop" ? "reason" : "additionalContext", event === "Stop" ? native.reason : native.hookSpecificOutput.additionalContext);
        }
    }
    const covered = ordered(new Set(entries.map(e => e.runner)));
    if (JSON.stringify(covered) !== JSON.stringify(ordered(HOOK_RUNNERS))) throw Error("HOOK_RUNNERS profile coverage is stale");
    return entries;
}

const SLOTS = ["identity", "principles", "constitution", "gates", "dod", "memory", "repos", "tasks", "handoffs", "proposals", "personas", "context"];
export async function vendorProfiles(root, { verifyCli = false } = {}) {
    ready(root);
    const schema = JSON.parse(read(root, path.join(root, "spec/workspace.schema.json")));
    if (JSON.stringify(ordered(Object.keys(schema.properties.slots.properties))) !== JSON.stringify(ordered(SLOTS))) throw Error("vendor slot profile coverage is stale");
    const { agentsMd } = await import(pathToFileURL(entry(root, path.join(root, "cli/vendor.mjs"), "isFile")).href + `?profile=${Date.now()}`);
    const { guidanceUnits } = await import(pathToFileURL(entry(root, path.join(root, "cli/compile.mjs"), "isFile")).href);
    const kernel = read(root, path.join(root, "core/engine.md"));
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "portulan-vendor-footprint-")));
    const write = (rel, text) => {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), text);
    };
    try {
        const slots = Object.fromEntries(SLOTS.map(name => [name, schema.properties.slots.properties[name].$ref.endsWith("dirPath") ? `${name}/` : `${name}.md`]));
        const base = { portulan: { spec: "2.15" }, name: "footprint", kind: "demo", summary: "Synthetic footprint profile.", slots, verify: { default: "check", recipes: [{ id: "check", run: "./verify.sh" }] } };
        const profiles = [];
        for (const profile of ["bare", "boot-and-tiers", "degraded"]) {
            const src = `${profile}/source`;
            const manifest = { ...base, packs: ["rituals/checkpoints"] };
            if (profile === "bare") { manifest.slots = { ...slots }; delete manifest.slots.context; }
            if (profile === "degraded") manifest.verify = { default: "missing", recipes: [] };
            write(`${src}/workspace.json`, JSON.stringify(manifest));
            for (const value of Object.values(manifest.slots)) {
                if (value.endsWith("/")) fs.mkdirSync(path.join(dir, src, value), { recursive: true });
                else write(`${src}/${value}`, "Synthetic adopter text.\n");
            }
            write(`${src}/verify.sh`, "#!/bin/sh\nexit 0\n");
            if (manifest.slots.context) {
                write(`${src}/context/boot.md`, "---\ntier: always\n---\n# Portulan boot card\n\nSynthetic boot.\n");
                write(`${src}/context/always.md`, "---\ntier: always\n---\n# Always\n\nSynthetic adopter text.\n");
                for (const [name, tier] of [["paths", "on-path"], ["release", "on-invoke"], ["history", "on-read"]]) write(`${src}/context/${name}.md`, `---\ntier: ${tier}\n${tier === "on-path" ? 'paths: ["api/**"]\n' : ""}description: Synthetic ${name}.\n---\n# ${name}\n\nSynthetic adopter text.\n`);
            }
            const guidance = guidanceUnits(path.join(dir, src), ".");
            const text = agentsMd(manifest, "generic", profile === "degraded" ? null : kernel, guidance);
            if (!text.includes("AGENTS.md") || (profile === "boot-and-tiers" && !text.includes("# Portulan boot card"))) throw Error("vendor native profile is empty");
            if (profile === "degraded" && (!text.includes("COULD NOT READ") || !text.includes("kernel could not be read"))) throw Error("vendor degraded coverage is missing");
            if (verifyCli && profile !== "degraded") {
                const dest = path.join(dir, profile, "consumer/.portulan");
                const run = spawnSync(process.execPath, [path.join(root, "cli/vendor.mjs"), path.join(dir, src), "--into", dest, "--host", "generic", "--residence", "in-repo", "--pack-root", path.join(root, "packs")], { cwd: root, env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(dir, "empty-host") }, encoding: "utf8", timeout: 30000 });
                if (run.status !== 0) throw Error(`actual vendor CLI unavailable: ${run.stdout}${run.stderr}`);
                const actual = fs.readFileSync(path.join(dest, "../AGENTS.md"));
                if (!actual.equals(Buffer.from(text, "utf8"))) throw Error(`${profile}: vendor CLI and renderer differ`);
            }
            profiles.push({ profile, text, bytes: bytes(text), kernelBytes: profile === "degraded" ? 0 : bytes(kernel.trim()), provenance: "production agentsMd; pinned all-slot synthetic manifest and guidance; no adopted team content" });
        }
        return profiles;
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

export async function measure(root = ROOT) {
    const owned = inventory(root);
    const result = { unbound: owned.unbound };
    const runner = entry(root, path.join(root, ".portulan/verify/prompt-footprint.mjs"), "isFile");
    const child = spawnSync(process.execPath, [runner, "--hooks"], { cwd: root, env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(root, "absent-footprint-host") }, encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
    if (child.status !== 0) throw Error(`native hook profiles unavailable: ${child.stderr || child.error?.message || child.status}`);
    const hooks = JSON.parse(child.stdout);
    const vendor = (await vendorProfiles(root)).map(({ text, ...entry }) => entry);
    for (const [name, entries] of Object.entries({ skills: owned.skills, personas: owned.personas, hooks, vendor })) result[name] = { entries, bytes: entries.reduce((n, entry) => n + entry.bytes, 0) };
    return result;
}
export function judge(result, rails) {
    if (Object.keys(rails).length !== 4 || ["skills", "personas", "hooks", "vendor"].some(name => !Number.isSafeInteger(rails[name]) || rails[name] <= 0 || !result[name]?.entries?.length)) return 2;
    return Object.entries(rails).some(([name, cap]) => result[name].bytes > cap) ? 1 : 0;
}
async function main(args) {
    if (args.includes("--hooks")) { console.log(JSON.stringify(await hookProfiles(ROOT))); return 0; }
    const result = await measure(ROOT);
    if (args.includes("--json")) { console.log(JSON.stringify(result)); return 0; }
    const rails = Object.fromEntries(args.map(arg => { const [name, cap] = arg.split("="); return [name, Number(cap)]; }));
    for (const name of ["skills", "personas", "hooks", "vendor"]) {
        console.log(`owned ${name}: ${result[name].bytes} B / ${rails[name] ?? "unjudged"} B`);
        for (const entry of result[name].entries) console.log(`  ${entry.file ?? entry.profile}: ${entry.bytes} B — ${entry.channel ?? "body"}; ${[].concat(entry.provenance).join("; ")}`);
    }
    if (result.unbound.length) console.log(`persona binding gap (separate compiler obligation): ${result.unbound.join(", ")}`);
    return judge(result, rails);
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
    try {
        if (fs.realpathSync(process.cwd()) !== ROOT) throw Error("owned footprint entrypoint resolves outside this checkout");
        process.exitCode = await main(process.argv.slice(2));
    }
    catch (error) { console.error(`owned footprint could not run: ${error.message}`); process.exitCode = 2; }
}
