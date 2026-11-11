// Full compilation wires advice independently of gate policy.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { run, compileGuidance, claudeCode } from "./compile.mjs";
import { capOnlyPlan, contextCaps, CONTEXT_CAP_ENV } from "./ritual-contexts.mjs";
import { inspect } from "./doctor.mjs";
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
const compiler = fileURLToPath(new URL("./compile.mjs", import.meta.url));
const priced = { horizon: { requests: 20 }, resume: { tokens: 0 } };
async function fixture(fn) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "portulan-policyfree-")));
    const write = (rel, value) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof value === "string" ? value : JSON.stringify(value)); };
    const manifest = { portulan: { spec: "2.16" }, name: "fixture", kind: "repository", tree: "../", slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" }, verify: { default: "docs", recipes: [{ id: "docs", run: "true" }] } };
    const save = () => write(".portulan/workspace.json", manifest);
    save(); for (const s of ["identity", "principles", "gate-map"]) write(`.portulan/${s}.md`, `# ${s}\n`);
    fs.mkdirSync(root + "/packs");
    const args = ["--workspace", root, "--pack-root", root + "/packs"];
    const compile = (...flags) => run([...args, ...flags], { quiet: true });
    const cli = (...flags) => spawnSync(process.execPath, [compiler, ...args, ...flags], { encoding: "utf8" });
    const file = root + "/.claude/settings.json", settings = () => JSON.parse(fs.readFileSync(file));
    try { return await fn({ root, manifest, save, write, file, settings, compile, cli }); }
    finally { fs.rmSync(root, { recursive: true, force: true }); }
}
for (const kind of ["repository", "demo", "portfolio"]) test(`doctor-valid minimal ${kind} gets default advice at either workspace address`, () => fixture(async ({ root, manifest, save, settings, compile, cli }) => {
    manifest.kind = kind; save();
    const d = await inspect(root + "/.portulan", { static: true, packRoots: [root + "/packs"] });
    assert.deepEqual(d.findings.filter(f => f.severity === "fail"), []);
    const written = cli(); assert.equal(written.status, 0, written.stderr);
    const s = settings(); assert.equal(s.$portulan.source, ".portulan/workspace.json");
    assert.equal(s.permissions, undefined); assert.equal(s.hooks.PreToolUse, undefined); assert.equal(s.hooks.Stop, undefined);
    assert.match(s.hooks.PostToolUse[0].hooks[0].command, /advisory\.mjs" tool$/);
    assert.match(s.hooks.UserPromptSubmit[0].hooks[0].command, /advisory\.mjs" prompt$/);
    assert.match(s.statusLine.command, /advisory\.mjs" status$/);
    assert.equal(compile("--check"), 0);
    assert.equal(run(["--workspace", root + "/.portulan", "--pack-root", root + "/packs", "--check"], { quiet: true }), 0);
    assert.ok(!fs.existsSync(root + "/.portulan/gates.json"));
    const matrix = cli("--matrix"); assert.equal(matrix.status, 0); assert.match(matrix.stdout, /Claude Code.*advisory/); assert.match(matrix.stdout, /GitHub.*not compiled/); assert.match(matrix.stdout, /general.*20|20.*general/); assert.match(matrix.stdout, /resume.*unknown/);
}));
test("declared switches and spend drift independently; verification timeout stays unused", () => fixture(({ manifest, save, compile, settings, cli }) => {
    manifest.sessions = { git_instructions: false, cache_lifetime: "5m" }; manifest.spend = { ...structuredClone(priced), restart: "block" }; manifest.verify.stopTimeout = 30; save();
    assert.equal(compile(), 0); const s = settings(); assert.equal(s.includeGitInstructions, false); assert.equal(s.promptCacheTtl, "5m");
    assert.equal(s.hooks.Stop[0].hooks.length, 1); assert.match(s.hooks.Stop[0].hooks[0].command, /advisory\.mjs" stop --horizon 20 --resume-tokens 0$/); assert.equal(s.hooks.Stop[0].hooks[0].timeout, undefined);
    assert.match(cli("--matrix").stdout, /stopTimeout.*no outer hook timeout/);
    manifest.spend.horizon.requests = 21; save(); assert.equal(compile("--check"), 1); assert.equal(compile(), 0);
    manifest.sessions.cache_lifetime = "1h"; save(); assert.equal(compile("--check"), 1); assert.equal(compile(), 0);
    manifest.verify.stopTimeout = 0; save(); assert.equal(compile(), 2);
}));
for (const first of ["PostToolUse", "UserPromptSubmit"]) test(`commands from compiled settings deliver once (${first} first), latest status and Stop guards`, () => fixture(({ root, write, manifest, save, compile, settings }) => {
    manifest.spend = { ...structuredClone(priced), restart: "block", multipliers: { read: 0.1, write: { "5m": 1.25, "1h": 2 } } }; save(); assert.equal(compile(), 0);
    const s = settings(), transcript = root + "/transcript.jsonl", temporary = root + "/state"; fs.mkdirSync(temporary);
    const row = (id, input) => ({ type: "assistant", message: { id, model: "fixture", usage: { input_tokens: input, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 1 } } });
    write("transcript.jsonl", [row("r1", 1000), row("r2", 1800)].map(JSON.stringify).join("\n") + "\n");
    const payload = { session_id: "fixture", transcript_path: transcript };
    const invoke = (key, p = payload) => { const command = key === "statusLine" ? s.statusLine.command : s.hooks[key][0].hooks[0].command; const result = spawnSync(command, { shell: true, cwd: root, input: JSON.stringify(p), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: root, TMPDIR: temporary } }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
    assert.match(invoke(first), /restart|Restart/); assert.equal(invoke(first === "PostToolUse" ? "UserPromptSubmit" : "PostToolUse"), "");
    assert.match(invoke("statusLine"), /2 requests.*estimated saving 350/); assert.equal(invoke("Stop", { ...payload, stop_hook_active: true }), "");
    assert.equal(JSON.parse(invoke("Stop")).decision, "block"); assert.equal(invoke("Stop"), "");
    fs.appendFileSync(transcript, JSON.stringify(row("r3", 1500)) + "\n");
    assert.match(invoke("statusLine"), /3 requests.*estimated saving -250/);
    for (const field of ["cache_read_input_tokens", "cache_creation_input_tokens"]) {
        const incomplete = row("r1", 1000); delete incomplete.message.usage[field]; write("transcript.jsonl", [incomplete, row("r2", 1800)].map(JSON.stringify).join("\n") + "\n");
        const unknown = { ...payload, session_id: field }; assert.equal(invoke("Stop", unknown), ""); assert.equal(invoke(first, unknown), ""); assert.match(invoke("statusLine", unknown), /not known.*missing counters/);
    }
    write("transcript.jsonl", [row("r1", 1000), row("r2", 1500)].map(JSON.stringify).join("\n") + "\n"); assert.equal(invoke("Stop", { ...payload, session_id: "latest-below" }), "");
}));
test("managed settings compose cap and migrate exact legacy cap-only output", () => fixture(({ root, write, manifest, save, compile, settings, file }) => {
    manifest.packs = ["rituals/fixture"]; save();
    const pack = { portulan: { pack: "1.1", version: "0.1.0" }, name: "fixture", category: "rituals", contributes: { contexts: { max_concurrent_subagents: 1 } } }; write("packs/rituals/fixture/pack.json", pack);
    const sources = [{ pack: "rituals/fixture", limit: 1, origin: "tree", version: "0.1.0" }];
    const legacy = capOnlyPlan(root, { limit: 1, sources }); write(".claude/settings.json", legacy.text);
    assert.equal(compile("--check"), 1); assert.equal(compile(), 0); assert.equal(settings().env[CONTEXT_CAP_ENV], "1");
    assert.equal(settings().$portulan.kind, "advisory"); assert.match(settings().$portulan.digest, /^[a-f0-9]{64}$/);
    pack.contributes = {}; write("packs/rituals/fixture/pack.json", pack); assert.equal(compile("--check"), 1); assert.equal(compile(), 0); assert.equal(settings().env, undefined); assert.ok(fs.existsSync(file)); assert.ok(settings().hooks.PostToolUse);
}));
for (const edit of [s => s.$portulan.source = "elsewhere/workspace.json", s => s.$portulan.packs = [], s => delete s.$portulan.digest, s => s.$portulan.digest = "bad", s => s.hooks.PostToolUse[0].hooks[0].command += " changed", s => s.promptCacheTtl = "1h", s => s.env = { [CONTEXT_CAP_ENV]: "2" }, s => s.model = "foreign"]) test(`manual payload change refuses every mode before guidance writes (${edit})`, () => fixture(({ root, write, compile, settings, file }) => {
    assert.equal(compile(), 0); const s = settings(); edit(s); write(".claude/settings.json", s); const before = fs.readFileSync(file, "utf8");
    fs.mkdirSync(root + "/.portulan/context"); write(".portulan/context/fixture.md", "---\ntier: always\n---\nFixture guidance.\n");
    const m = JSON.parse(fs.readFileSync(root + "/.portulan/workspace.json")); m.slots.context = "context/"; write(".portulan/workspace.json", m);
    for (const mode of [[], ["--check"], ["--matrix"]]) { assert.equal(compile(...mode), 2); assert.equal(fs.readFileSync(file, "utf8"), before); assert.ok(!fs.existsSync(root + "/.claude/rules/portulan")); }
}));
test("format and key order retain ownership; foreign links and malformed legacy sources refuse", () => fixture(({ root, write, compile, settings, file }) => {
    assert.equal(compile(), 0); const s = settings(); write(".claude/settings.json", Object.fromEntries(Object.entries(s).reverse())); assert.equal(compile("--check"), 1); assert.equal(compile(), 0); assert.equal(compile("--check"), 0);
    fs.linkSync(file, root + "/linked.json"); for (const mode of [[], ["--check"], ["--matrix"]]) assert.equal(compile(...mode), 2); fs.rmSync(file);
    fs.symlinkSync(root + "/linked.json", file); assert.equal(compile(), 2); fs.rmSync(file);
    for (const old of [{ model: "foreign" }, { $portulan: { generated: "cli/compile.mjs", source: ".portulan/gates.json" }, hooks: {} }, { $portulan: { generated: "cli/compile.mjs", kind: "ritual-contexts", sources: [] }, env: { [CONTEXT_CAP_ENV]: "1" } }, { $portulan: { generated: "cli/compile.mjs", kind: "ritual-contexts", sources: [{ pack: "rituals/f", limit: 2, origin: "tree", version: null }] }, env: { [CONTEXT_CAP_ENV]: "1" } }]) { write(".claude/settings.json", old); assert.equal(compile(), 2); }
}));
test("lost manifest or pointer does not adopt or remove managed advisory settings", () => fixture(({ root, manifest, save, compile, file }) => {
    assert.equal(compile(), 0); const before = fs.readFileSync(file, "utf8");
    fs.rmSync(root + "/.portulan/workspace.json"); assert.equal(compile(), 2); assert.equal(fs.readFileSync(file, "utf8"), before);
    manifest.kind = "pointer"; save(); assert.equal(compile(), 2); assert.equal(fs.readFileSync(file, "utf8"), before);
}));
test("portable guidance-only API leaves foreign settings untouched", () => fixture(({ root, write }) => {
    fs.cpSync(fileURLToPath(new URL("./fixtures/guidance", import.meta.url)), root + "/guided", { recursive: true });
    write("guided/.claude/settings.json", { model: "foreign" }); const before = fs.readFileSync(root + "/guided/.claude/settings.json", "utf8");
    assert.equal(compileGuidance(root + "/guided", { check: true, say: () => {} }).drifted, 0); assert.equal(fs.readFileSync(root + "/guided/.claude/settings.json", "utf8"), before);
}));

test("a digest is not sufficient ownership for unrelated shapes or linked parents", () => fixture(({ root, write, compile, settings, file }) => {
    assert.equal(compile(), 0); const original = settings();
    for (const mutate of [s => s.permissions = {}, s => s.$portulan.extra = true, s => s.hooks.PreToolUse = [], s => s.env = { OTHER: "foreign" }]) {
        const s = structuredClone(original); mutate(s); delete s.$portulan.digest;
        const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
        s.$portulan.digest = createHash("sha256").update(JSON.stringify(canonical(s))).digest("hex"); write(".claude/settings.json", s);
        for (const mode of [[], ["--check"], ["--matrix"]]) assert.equal(compile(...mode), 2);
    }
    fs.rmSync(root + "/.claude", { recursive: true }); fs.symlinkSync(root + "/missing-parent", root + "/.claude");
    for (const mode of [[], ["--check"], ["--matrix"]]) assert.equal(compile(...mode), 2);
    assert.ok(!fs.existsSync(root + "/missing-parent")); assert.ok(!fs.existsSync(file));
}));

test("native Windows absolute runner spelling survives repeated ownership checks", () => fixture(({ root, write, file }) => {
    const value = claudeCode(null, { source: ".portulan/workspace.json", root, advisoryRunner: '"C:\\Users\\fixture\\node_modules\\portulan\\cli\\advisory.mjs"' }).artifact.value;
    const cap = contextCaps([]), plan = capOnlyPlan(root, cap, value);
    write(".claude/settings.json", plan.text);
    for (let i = 0; i < 3; i++) {
        const next = capOnlyPlan(root, cap, value);
        assert.equal(next.text, fs.readFileSync(file, "utf8"));
        write(".claude/settings.json", next.text);
    }
}));
