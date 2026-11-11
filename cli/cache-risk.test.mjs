// Project cache warnings are reports; no host state or server is consulted.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cacheRiskLines } from "./cache-risk.mjs";
const doctor = fileURLToPath(new URL("./doctor.mjs", import.meta.url));
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
function fixture(fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-cache-risk-"));
    const write = (rel, value) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value)); };
    write("workspace/workspace.json", { portulan: { spec: "2.0" }, name: "fixture", kind: "repository", tree: "../", slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" }, verify: { default: "docs", recipes: [{ id: "docs", run: "./verify.sh" }] } });
    for (const name of ["identity", "principles", "gate-map"]) write(`workspace/${name}.md`, `# ${name}\n\nFixture.\n`);
    write("workspace/verify.sh", "#!/bin/sh\nexit 0\n");
    fs.mkdirSync(path.join(root, "host"));
    const invoke = (...flags) => spawnSync(process.execPath, [doctor, ...flags, path.join(root, "workspace")], { cwd: root, encoding: "utf8", env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(root, "host") } });
    try { return fn({ root, write, invoke }); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("ordinary doctor reports both cache risks and their paired controls", () => fixture(({ write, invoke }) => {
    const baseline = invoke(); assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);
    write(".claude/settings.json", { model: "opusplan", env: { ENABLE_TOOL_SEARCH: "false" }, enableAllProjectMcpServers: true });
    write(".mcp.json", { mcpServers: { fixture: { command: "never-executed" } } });
    const risky = invoke(); assert.equal(risky.status, baseline.status, risky.stderr || risky.stdout);
    assert.match(risky.stdout, /cache-risk.*plan-mode.*cache/);
    assert.match(risky.stdout, /cache-risk.*tool search.*1.*MCP/);
    write(".claude/settings.json", { model: "sonnet", env: { ENABLE_TOOL_SEARCH: "true" } });
    const control = invoke(); assert.equal(control.status, 0, control.stderr || control.stdout);
    assert.doesNotMatch(control.stdout, /cache-risk.*(?:plan-mode|tool search)/);
}));

const risky = { model: "opusplan", env: { ENABLE_TOOL_SEARCH: "false" }, enableAllProjectMcpServers: true };
const servers = { mcpServers: { fixture: { command: "never-executed", env: { TOKEN: "DO_NOT_PRINT_FIXTURE" } } } };
const report = root => cacheRiskLines(root).filter(line => !line.startsWith("Assessed selectors:")).join("\n");
for (const model of ["opusplan", "opusplan[1m]", "haiku", "claude-haiku-5-5"]) test(`potential plan-boundary warning: ${model}`, () => fixture(({ root, write }) => {
    write(".claude/settings.json", { model }); assert.match(report(root), /plan-mode.*cache/);
}));
for (const model of ["sonnet", "opus", "claude-sonnet-5-5"]) test(`stable project model: ${model}`, () => fixture(({ root, write }) => {
    write(".claude/settings.json", { model }); assert.doesNotMatch(report(root), /plan-mode/);
}));

test("local scalars and per-key env override shared settings, including empty values", () => fixture(({ root, write }) => {
    write(".claude/settings.json", risky); write(".mcp.json", servers);
    write(".claude/settings.local.json", { model: "sonnet", env: { ENABLE_TOOL_SEARCH: "true" } });
    assert.equal(report(root), "");
    write(".claude/settings.local.json", { model: "", env: { ENABLE_TOOL_SEARCH: "" } });
    assert.match(report(root), /empty.*unassessed/); assert.doesNotMatch(report(root), /tool search disabled/);
    write(".claude/settings.local.json", { env: { ANTHROPIC_MODEL: "sonnet" } });
    assert.doesNotMatch(report(root), /plan-mode/); assert.match(report(root), /tool search disabled/);
    write(".claude/settings.local.json", { env: { ANTHROPIC_MODEL: "" } });
    assert.match(report(root), /plan-mode model switching/);
}));

test("project env overrides a stable model and local env merges by key", () => fixture(({ root, write }) => {
    write(".claude/settings.json", { model: "sonnet", env: { ANTHROPIC_MODEL: "opusplan", ENABLE_TOOL_SEARCH: "false" } });
    write(".claude/settings.local.json", { env: { OTHER: "DO_NOT_PRINT_FIXTURE" } }); write(".mcp.json", servers);
    assert.match(report(root), /plan-mode.*cache/); assert.match(report(root), /tool search disabled/);
    assert.doesNotMatch(report(root), /DO_NOT_PRINT_FIXTURE/);
}));

test("MCP candidates, project approvals and rejections are distinct", () => fixture(({ root, write }) => {
    write(".mcp.json", servers);
    write(".claude/settings.json", { env: risky.env, enableAllProjectMcpServers: false });
    assert.match(report(root), /1 eligible project MCP candidate\(s\), 0 with project-file approval/);
    write(".claude/settings.local.json", { enabledMcpjsonServers: ["fixture"] });
    assert.match(report(root), /1 with project-file approval/);
    write(".claude/settings.json", { ...risky, disabledMcpjsonServers: ["fixture"] });
    write(".claude/settings.local.json", { disabledMcpjsonServers: [], enabledMcpjsonServers: ["fixture"], enableAllProjectMcpServers: true });
    assert.doesNotMatch(report(root), /tool search disabled/);
    write(".claude/settings.json", risky); write(".claude/settings.local.json", { enableAllProjectMcpServers: false });
    assert.match(report(root), /0 with project-file approval/);
}));

test("a shared ToolSearch denial survives an empty local denial array", () => fixture(({ root, write }) => {
    write(".claude/settings.json", { permissions: { deny: ["ToolSearch"] } });
    write(".claude/settings.local.json", { permissions: { deny: [] }, env: { ENABLE_TOOL_SEARCH: "true" } });
    write(".mcp.json", servers); assert.match(report(root), /tool search disabled by project ToolSearch denial/);
}));

test("no configured servers, empty servers and invalid servers never imply active MCP tools", () => fixture(({ root, write }) => {
    write(".claude/settings.json", { env: risky.env }); assert.equal(report(root), "");
    write(".mcp.json", { mcpServers: {} }); assert.equal(report(root), "");
    write(".mcp.json", { mcpServers: { DO_NOT_PRINT_FIXTURE: { type: "http", url: "DO_NOT_PRINT_FIXTURE" } } });
    assert.match(report(root), /unassessed/); assert.doesNotMatch(report(root), /tool search disabled|DO_NOT_PRINT_FIXTURE/);
}));

for (const value of [{ model: 1 }, { env: [] }, { env: { ENABLE_TOOL_SEARCH: false } }, { permissions: { deny: {} } }, { enabledMcpjsonServers: true }, { disabledMcpjsonServers: [null] }, { enableAllProjectMcpServers: "true" }]) {
    test(`invalid relevant project setting is unassessed: ${JSON.stringify(value)}`, () => fixture(({ root, write }) => {
        write(".claude/settings.json", value); assert.match(report(root), /unassessed.*invalid shapes/);
    }));
}
test("malformed and nonregular configuration emits only sanitized unassessed notes", () => fixture(({ root, write }) => {
    write(".claude/settings.json", '{"DO_NOT_PRINT_FIXTURE":');
    fs.mkdirSync(path.join(root, ".mcp.json"));
    assert.match(report(root), /unassessed/); assert.doesNotMatch(report(root), /DO_NOT_PRINT_FIXTURE|SyntaxError|Unexpected/);
}));

for (const parent of [false, true]) test(`configuration symlink ${parent ? "parent" : "file"} cannot open outside content`, t => fixture(({ root, write }) => fixture(({ root: outside, write: otherWrite }) => {
    otherWrite("settings.json", risky);
    if (parent) fs.symlinkSync(outside, path.join(root, ".claude"));
    else { fs.mkdirSync(path.join(root, ".claude")); fs.symlinkSync(path.join(outside, "settings.json"), path.join(root, ".claude/settings.json")); }
    const original = fs.readFileSync, realOutside = fs.realpathSync(outside), opened = [];
    t.mock.method(fs, "readFileSync", (file, ...args) => { opened.push(String(file)); if (String(file).startsWith(realOutside)) throw Error("outside read"); return original(file, ...args); });
    assert.match(report(root), /unassessed.*outside/); assert.doesNotMatch(report(root), /plan-mode model switching/);
    assert.ok(opened.every(file => !file.startsWith(realOutside)), "no outside content read was attempted");
})));

test("only the three owned project sources are opened", t => fixture(({ root, write }) => {
    write(".claude/settings.json", risky); write(".claude/settings.local.json", {}); write(".mcp.json", servers);
    const allowed = new Set([".claude/settings.json", ".claude/settings.local.json", ".mcp.json"].map(p => fs.realpathSync(path.join(root, p))));
    const original = fs.readFileSync, opened = [];
    t.mock.method(fs, "readFileSync", (file, ...args) => { opened.push(String(file)); if (!allowed.has(String(file))) throw Error("unexpected read"); return original(file, ...args); });
    assert.match(report(root), /tool search disabled/);
    assert.deepEqual(new Set(opened), allowed);
}));

test("read failures sanitize error text and remain nonfailing reports", t => fixture(({ root, write }) => {
    write(".claude/settings.json", risky);
    t.mock.method(fs, "readFileSync", () => { throw Object.assign(Error("DO_NOT_PRINT_FIXTURE"), { code: "EACCES" }); });
    assert.match(report(root), /unassessed/); assert.doesNotMatch(report(root), /DO_NOT_PRINT_FIXTURE/);
}));

test("ordinary/static warnings preserve verdict, private-value boundaries and one-line agent output", () => fixture(({ write, invoke }) => {
    write(".claude/settings.json", { ...risky, env: { ...risky.env, OTHER: "DO_NOT_PRINT_FIXTURE" } });
    write(".mcp.json", { mcpServers: { DO_NOT_PRINT_FIXTURE: { type: "http", url: "https://do-not-print-fixture.invalid/mcp", headers: { Authorization: "DO_NOT_PRINT_FIXTURE" } } } });
    const ordinary = invoke(), staticMode = invoke("--static"), agent = invoke("--static", "--agent");
    for (const out of [ordinary, staticMode, agent]) { assert.equal(out.status, 0, out.stderr || out.stdout); assert.doesNotMatch(out.stdout + out.stderr, /DO_NOT_PRINT_FIXTURE|do-not-print-fixture\.invalid/); }
    for (const out of [ordinary, staticMode]) { assert.match(out.stdout, /cache-risk.*plan-mode/); assert.match(out.stdout, /cache-risk.*tool search/); assert.match(out.stdout, /live activation.*unassessed/); }
    assert.equal(agent.stdout.trim().split("\n").length, 1); assert.equal(agent.stderr, "");
}));

test("unsupported-only controls and empty project sources still disclose assessment scope", () => fixture(({ root, write }) => {
    for (const settings of [{}, { model: "unknown-selector", env: { CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1" } }]) {
        write(".claude/settings.json", settings); write(".mcp.json", servers);
        const lines = cacheRiskLines(root);
        assert.equal(lines.length, 1);
        assert.match(lines[0], /Assessed selectors:.*ENABLE_TOOL_SEARCH=false.*full MCP schema.*experimental-beta disabling.*unassessed/);
        assert.doesNotMatch(lines[0], /unknown-selector|DO_NOT_PRINT_FIXTURE/);
    }
}));
