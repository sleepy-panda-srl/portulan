// Ritual admission caps and total observed contexts have different units.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readContextCap, contextCaps, contextCapLines } from "./ritual-contexts.mjs";
import { run, packDifferences } from "./compile.mjs";
import { inspect } from "./doctor.mjs";
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
const declaration = (n = 1, more = {}) => ({ portulan: { pack: "1.1", version: "0.1.0" }, name: "fixture", category: "rituals", contributes: { contexts: { max_concurrent_subagents: n } }, ...more });
async function fixture(fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-ritual-cap-"));
    const write = (rel, value) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof value === "string" ? value : JSON.stringify(value)); };
    const manifest = { portulan: { spec: "2.0" }, name: "fixture", kind: "repository", tree: "../", packs: ["rituals/fixture"], slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" }, verify: { default: "docs", recipes: [{ id: "docs", run: "true" }] } };
    write("workspace/workspace.json", manifest);
    for (const s of ["identity", "principles", "gate-map"]) write(`workspace/${s}.md`, `# ${s}\n`);
    write("packs/rituals/fixture/pack.json", declaration());
    const compile = (...flags) => run(["--workspace", root + "/workspace", "--pack-root", root + "/packs", ...flags], { quiet: true });
    const settings = () => JSON.parse(fs.readFileSync(root + "/.claude/settings.json", "utf8"));
    const doctor = () => inspect(root + "/workspace", { packRoots: [root + "/packs"], static: true });
    try { return await fn({ root, write, manifest, compile, settings, doctor }); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
test("positive safe integer declaration, version/category/shape refusals", () => {
    assert.equal(readContextCap(declaration(), "rituals/fixture"), 1);
    assert.equal(readContextCap(declaration(Number.MAX_SAFE_INTEGER), "rituals/fixture"), Number.MAX_SAFE_INTEGER);
    assert.equal(readContextCap({ contributes: {} }, "legacy"), null);
    assert.throws(() => readContextCap(declaration(), "tools/fixture"), /ritual/);
    for (const n of [0, -1, 1.5, "1", null, false, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN]) assert.throws(() => readContextCap(declaration(n), "rituals/fixture"), /contexts/);
    for (const m of [declaration(1, { portulan: { pack: "1.0" } }), declaration(1, { portulan: { pack: "1.2" } }), declaration(1, { portulan: { pack: "2.0" } }), declaration(1, { category: "tools" }), declaration(1, { contributes: { contexts: { max_concurrent_subagents: 1, extra: 1 } } }), declaration(1, { contributes: { contexts: [] } })]) assert.throws(() => readContextCap(m, "rituals/fixture"), /contexts/);
});
test("minimum is order independent with sorted provenance and unresolved honesty", () => {
    const a = { pack: "rituals/a", contextCap: 2 }, b = { pack: "rituals/b", contextCap: 1 };
    assert.deepEqual(contextCaps([a, b]), contextCaps([b, a]));
    assert.equal(contextCaps([a, b]).limit, 1);
    assert.throws(() => contextCaps([a], [{ name: "missing" }]), /unresolved/);
    assert.match(contextCapLines(contextCaps([], [{ name: "missing" }])).join(" "), /unresolved.*unknown/);
    assert.equal(packDifferences(declaration(1), declaration(2)).length, 1);
});
test("advice composes caps, changes drift, removal keeps advice", () => fixture(({ root, write, compile, settings }) => {
    assert.equal(compile(), 0); const s = settings();
    assert.deepEqual(Object.keys(s).sort(), ["$portulan", "env", "hooks", "statusLine"]);
    assert.deepEqual(s.env, { CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: "1" });
    assert.equal(compile("--check"), 0);
    write("packs/rituals/fixture/pack.json", declaration(2)); assert.equal(compile("--check"), 1); assert.equal(compile(), 0); assert.equal(settings().env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS, "2");
    write("packs/rituals/fixture/pack.json", declaration(1, { contributes: {} })); assert.equal(compile("--check"), 1); assert.equal(compile(), 0); assert.equal(settings().env, undefined); assert.ok(settings().hooks.PostToolUse);
}));
test("foreign, edited, old-policy and symlink settings refuse before other writes", () => fixture(({ root, write, compile }) => {
    for (const s of [{ model: "foreign" }, { $portulan: { generated: "cli/compile.mjs", kind: "ritual-contexts" }, env: { OTHER: "foreign" } }, { $portulan: { generated: "cli/compile.mjs", kind: "ritual-contexts" }, model: "foreign", env: {} }, { $portulan: { generated: "cli/compile.mjs", source: "workspace/gates.json" }, hooks: {} }]) {
        write(".claude/settings.json", s);
        for (const mode of [[], ["--check"], ["--matrix"]]) { assert.equal(compile(...mode), 2); assert.deepEqual(JSON.parse(fs.readFileSync(root + "/.claude/settings.json")), s); }
    }
    fs.rmSync(root + "/.claude/settings.json"); write("foreign.json", "preserve"); fs.symlinkSync(root + "/foreign.json", root + "/.claude/settings.json");
    assert.equal(compile(), 2); assert.equal(fs.readFileSync(root + "/foreign.json", "utf8"), "preserve");
}));
test("invalid and unresolved declarations refuse all modes without replacing settings", async () => fixture(async ({ root, write, compile, manifest, doctor }) => {
    write(".claude/settings.json", "preserve");
    for (const m of [declaration(0), declaration(1.5), declaration(1, { portulan: { pack: "1.0" } }), declaration(1, { category: "tools" })]) {
        write("packs/rituals/fixture/pack.json", m);
        for (const mode of [[], ["--check"], ["--matrix"]]) { assert.equal(compile(...mode), 2); assert.equal(fs.readFileSync(root + "/.claude/settings.json", "utf8"), "preserve"); }
        const d = await doctor(); assert.ok(d.findings.some(f => f.severity === "fail"));
    }
    write("packs/rituals/fixture/pack.json", declaration()); write("workspace/workspace.json", { ...manifest, packs: [...manifest.packs, "rituals/missing"] });
    for (const mode of [[], ["--check"], ["--matrix"]]) assert.equal(compile(...mode), 2);
}));
test("normal policy gains cap only; absence returns exact original bytes", () => fixture(({ root, manifest, write, compile, settings }) => {
    write("workspace/workspace.json", { ...manifest, gates: "gates.json" });
    write("workspace/gates.json", { portulan: { spec: "2.2" }, why: "gate-map.md", rules: [{ id: "fixture-gated-action", tier: "gated", action: { shell: "git merge" }, reason: "Fixture." }] });
    write("packs/rituals/fixture/pack.json", declaration(1, { contributes: {} })); assert.equal(compile(), 0); const before = fs.readFileSync(root + "/.claude/settings.json", "utf8");
    write("packs/rituals/fixture/pack.json", declaration(1)); assert.equal(compile("--check"), 1); assert.equal(compile(), 0); assert.equal(settings().env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS, "1");
    write("packs/rituals/fixture/pack.json", declaration(1, { contributes: {} })); assert.equal(compile(), 0); assert.equal(fs.readFileSync(root + "/.claude/settings.json", "utf8"), before);
}));
test("doctor and matrix report scoped native support, not a lifetime budget", async () => fixture(async ({ root, doctor }) => {
    const d = await doctor(); const text = d.findings.map(f => f.message).join("\n");
    assert.match(text, /fresh.*Agent/); assert.match(text, /GitHub.*not compiled/); assert.match(text, /resum.*fork/i);
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./compile.mjs", import.meta.url)), "--workspace", root + "/workspace", "--pack-root", root + "/packs", "--matrix"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS/);
}));

test("captured native controls reject incorrect settings, admissions, overlap and ledger totals", async () => {
    const { verifyCapture } = await import("./fixtures/ritual-cap/verify.mjs");
    const captured = JSON.parse(fs.readFileSync(new URL("./fixtures/ritual-cap/capture.json", import.meta.url)));
    assert.match(verifyCapture(captured), /peaks 1\/2\/2\/1/);
    for (const mutate of [
        c => c.extra = "DO_NOT_PRINT", c => c.runs[0].effective = 2, c => c.runs[1].peak = 1,
        c => c.runs[0].accepted = 1, c => c.runs[0].refusals = 0, c => c.runs[0].guard.pop(),
        c => c.runs[0].ledger.children = 1, c => c.runs[0].trace.find(e => e.kind === "start").active = 2,
        c => c.runs[0].trace.pop(), c => c.runs[2].effective = 1,
    ]) { const clone = structuredClone(captured); mutate(clone); assert.throws(() => verifyCapture(clone)); }
});

test("compiler composes actual pack caps by minimum and reports unresolved absence", () => fixture(({ root, write, manifest, compile, settings }) => {
    write("workspace/workspace.json", { ...manifest, packs: ["rituals/fixture", "rituals/second"] });
    write("packs/rituals/fixture/pack.json", declaration(2));
    write("packs/rituals/second/pack.json", declaration(1, { name: "second" }));
    assert.equal(compile(), 0); assert.equal(settings().env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS, "1");
    const before = fs.readFileSync(root + "/.claude/settings.json", "utf8");
    write("workspace/workspace.json", { ...manifest, packs: ["rituals/second", "rituals/fixture"] });
    assert.equal(compile("--check"), 0); assert.equal(fs.readFileSync(root + "/.claude/settings.json", "utf8"), before);
    fs.rmSync(root + "/.claude/settings.json"); write("packs/rituals/fixture/pack.json", declaration(1, { contributes: {} }));
    write("workspace/workspace.json", { ...manifest, packs: ["rituals/fixture", "rituals/missing"] });
    const cli = spawnSync(process.execPath, [fileURLToPath(new URL("./compile.mjs", import.meta.url)), "--workspace", root + "/workspace", "--pack-root", root + "/packs", "--matrix"], { encoding: "utf8" });
    assert.match(cli.stdout, /unresolved pack contributions are unknown/);
}));

test("multiply linked cap settings cannot overwrite or remove another file", () => fixture(({ root, write, compile }) => {
    assert.equal(compile(), 0); fs.linkSync(root + "/.claude/settings.json", root + "/other.json");
    const before = fs.readFileSync(root + "/other.json", "utf8");
    write("packs/rituals/fixture/pack.json", declaration(2)); assert.equal(compile(), 2); assert.equal(fs.readFileSync(root + "/other.json", "utf8"), before);
    write("packs/rituals/fixture/pack.json", declaration(1, { contributes: {} })); assert.equal(compile(), 2); assert.equal(fs.readFileSync(root + "/other.json", "utf8"), before);
}));

test("full guidance compilation refuses unrelated linked settings in write/check/matrix", () => fixture(({ root, write }) => {
    const guided = root + "/guided";
    fs.cpSync(fileURLToPath(new URL("./fixtures/guidance", import.meta.url)), guided, { recursive: true });
    fs.rmSync(guided + "/.claude", { recursive: true, force: true }); fs.mkdirSync(guided + "/.claude");
    const file = guided + "/.claude/settings.json"; fs.writeFileSync(file, '{"model":"foreign"}'); fs.linkSync(file, root + "/other.json");
    const invoke = (...flags) => run(["--workspace", guided, "--pack-root", root + "/packs", ...flags], { quiet: true });
    for (const mode of [[], ["--check"], ["--matrix"]]) {
        assert.equal(invoke(...mode), 2);
        assert.equal(fs.readFileSync(file, "utf8"), '{"model":"foreign"}'); assert.equal(fs.readFileSync(root + "/other.json", "utf8"), '{"model":"foreign"}');
    }
}));

test("removing policy and cap exposes stale generated admission settings in all modes", () => fixture(({ root, write }) => {
    const guided = root + "/guided";
    fs.cpSync(fileURLToPath(new URL("./fixtures/guidance", import.meta.url)), guided, { recursive: true });
    const manifestFile = guided + "/workspace.json", m = JSON.parse(fs.readFileSync(manifestFile));
    m.packs = ["rituals/fixture"]; m.gates = "gates.json"; fs.writeFileSync(manifestFile, JSON.stringify(m));
    fs.writeFileSync(guided + "/gates.json", JSON.stringify({ portulan: { spec: "2.2" }, why: "gate-map.md", rules: [{ id: "fixture-policy-gate", tier: "gated", action: { shell: "git merge" }, reason: "Fixture." }] }));
    const invoke = (...flags) => run(["--workspace", guided, "--pack-root", root + "/packs", ...flags], { quiet: true });
    assert.equal(invoke(), 0); const before = fs.readFileSync(guided + "/.claude/settings.json", "utf8");
    delete m.gates; fs.writeFileSync(manifestFile, JSON.stringify(m)); fs.rmSync(guided + "/gates.json");
    write("packs/rituals/fixture/pack.json", declaration(1, { contributes: {} }));
    for (const mode of [[], ["--check"], ["--matrix"]]) { assert.equal(invoke(...mode), 2); assert.equal(fs.readFileSync(guided + "/.claude/settings.json", "utf8"), before); }
    const cli = spawnSync(process.execPath, [fileURLToPath(new URL("./compile.mjs", import.meta.url)), "--workspace", guided, "--pack-root", root + "/packs", "--matrix"], { encoding: "utf8" });
    assert.match(cli.stderr, /stale context cap after policy removal/);
}));

test("removing cap preserves and refuses unrelated additions to its generated file", () => fixture(({ root, write, compile, settings }) => {
    assert.equal(compile(), 0); const edited = settings(); edited.env.OTHER = "preserve"; write(".claude/settings.json", edited);
    const before = fs.readFileSync(root + "/.claude/settings.json", "utf8"); write("packs/rituals/fixture/pack.json", declaration(1, { contributes: {} }));
    for (const mode of [[], ["--check"], ["--matrix"]]) { assert.equal(compile(...mode), 2); assert.equal(fs.readFileSync(root + "/.claude/settings.json", "utf8"), before); }
}));
