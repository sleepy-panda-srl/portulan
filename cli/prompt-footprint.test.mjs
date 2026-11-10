// Owned prompt footprint regression checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { inventory, measure, vendorProfiles, judge } from "../.portulan/verify/prompt-footprint.mjs";

const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scratch = [];
process.on("exit", () => scratch.forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));
function temp() {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "portulan-footprint-")));
    scratch.push(dir);
    return dir;
}
function write(root, rel, text) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
}
function copy() {
    const root = temp();
    for (const rel of ["cli", "core", "plugin", "packs", "agents", "spec", ".claude-plugin", ".portulan/verify", ".portulan/workspace.json"]) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.cpSync(path.join(ROOT, rel), path.join(root, rel), { recursive: true });
    }
    return root;
}
const sum = entries => entries.reduce((n, entry) => n + entry.bytes, 0);

test("inventory includes manual skills, both plugin manifests, actual bindings and composed charters once", () => {
    const fixture = copy();
    fs.rmSync(path.join(fixture, "agents/local-worker.md"), { force: true });
    const result = inventory(fixture);
    const files = result.skills.map(entry => entry.file);
    assert.equal(files.filter(file => file.endsWith("/delegate-local/SKILL.md")).length, 1);
    assert.ok(files.includes("core/skills/clarify/SKILL.md"));
    for (const file of ["agents/reviewer.md", "core/personas/reviewer.md", "packs/rituals/checkpoints/personas/supervisor.md", "packs/tools/local-llm/personas/local-worker.md"]) {
        assert.ok(result.personas.some(entry => entry.file === file), file);
    }
    assert.ok(result.unbound.includes("local-worker"), "missing compiler bindings are reported, never invented");
    write(fixture, "agents/local-worker.md", "---\nname: local-worker\n---\nSynthetic binding.\n");
    assert.equal(inventory(fixture).unbound.includes("local-worker"), false);
    assert.ok(result.skills.every(entry => entry.provenance.length > 0 && entry.bytes > 0));
    assert.equal(new Set(files).size, files.length);
});

test("registered additions contribute, unreachable fixtures do not, and body bytes preserve UTF-8 and CRLF", () => {
    const root = copy();
    const before = inventory(root);
    write(root, "core/skills/extra/SKILL.md", "---\r\nname: extra\r\ndisable-model-invocation: true\r\n---\r\n\r\nÉléphant.\r\n");
    write(root, "cli/fixtures/unregistered/SKILL.md", "irrelevant".repeat(5000));
    const after = inventory(root);
    assert.equal(sum(after.skills) - sum(before.skills), Buffer.byteLength("\r\nÉléphant.\r\n"));
    assert.equal(sum(after.personas), sum(before.personas));
});

test("declared missing, escaping, malformed and nonregular sources are unavailable", () => {
    const root = copy();
    const manifest = path.join(root, ".claude-plugin/plugin.json");
    const original = fs.readFileSync(manifest, "utf8");
    for (const named of ["./absent/", "../outside/"]) {
        fs.writeFileSync(manifest, JSON.stringify({ ...JSON.parse(original), skills: [named] }));
        assert.throws(() => inventory(root));
    }
    fs.writeFileSync(manifest, original);
    const file = path.join(root, "core/skills/clarify/SKILL.md");
    const kept = fs.readFileSync(file);
    fs.writeFileSync(file, Buffer.from([255]));
    assert.throws(() => inventory(root), /UTF-8/);
    fs.writeFileSync(file, "---\nname: broken\n");
    assert.throws(() => inventory(root), /frontmatter/);
    fs.rmSync(file);
    fs.mkdirSync(file);
    assert.throws(() => inventory(root), /regular/);
    fs.rmSync(file, { recursive: true });
    const outside = temp();
    write(outside, "SKILL.md", kept);
    fs.symlinkSync(path.join(outside, "SKILL.md"), file);
    assert.throws(() => inventory(root), /outside/);
});

test("metadata uncertainty refuses measurement", () => {
    const root = copy();
    const file = path.join(root, "packs/.claude-plugin/plugin.json");
    const kept = fs.readFileSync(file);
    for (const value of [[], true, "invalid"]) {
        fs.writeFileSync(file, JSON.stringify(value));
        assert.throws(() => inventory(root), /manifest/);
    }
    fs.writeFileSync(file, kept);
    const skill = path.join(root, "core/skills/clarify/SKILL.md");
    const original = fs.readFileSync(skill, "utf8");
    for (const declaration of ["name:\u00a0clarify", "name: clarify\n\t", "name: clarify\n\u00a0# comment", "name: clarify:", "name: [read # discarded]", "name: clarify\nsettings:\n    dangling:\n  orp: invalid", "name: [", "name: [foo[bar]", 'name: "unfinished', "name: first\nname: second", "name: clarify\ndescription2: |\n    first line\n  illegal dedent", "name: clarify\ndescription2: |\n    \n  first line", "name: invalid\u0080", "name: invalid\u0085line"]) {
        fs.writeFileSync(skill, original.replace("name: clarify", declaration));
        assert.throws(() => inventory(root), /frontmatter/);
    }
    fs.writeFileSync(skill, original.replace("description: ", "description: >\n  "));
    assert.doesNotThrow(() => inventory(root));
    fs.writeFileSync(skill, original);
    for (const rel of [".portulan/workspace.json", "packs/tools/local-llm/pack.json"]) {
        const target = path.join(root, rel), saved = fs.readFileSync(target);
        fs.writeFileSync(target, "[]");
        assert.throws(() => inventory(root), /manifest/);
        fs.writeFileSync(target, saved);
    }
    const packFile = path.join(root, "packs/tools/local-llm/pack.json"), pack = JSON.parse(fs.readFileSync(packFile));
    for (const contributes of ["malformed", [], null]) {
        fs.writeFileSync(packFile, JSON.stringify({ ...pack, contributes }));
        assert.throws(() => inventory(root), /contributes/);
    }
    fs.writeFileSync(packFile, JSON.stringify(pack));
    write(root, "core/skills/metadata/SKILL.md", '---\nname: metadata\ntools: [read, "search"]\ndescription: >\n  A supported block.\nexperimental:\n  cacheTtl: 5m\n  settings:\n    enabled: true\n  sibling: allowed\nafter: "quoted: colon"\n---\n\nSynthetic body.\n');
    const charter = path.join(root, "core/personas/reviewer.md");
    fs.writeFileSync(charter, fs.readFileSync(charter, "utf8").replace(/^---[\s\S]*?\n---\n/, ""));
    assert.doesNotThrow(() => inventory(root), "supported metadata and frontmatter-free charters remain measurable");
});

test("contained file aliases preserve physical totals", () => {
    const root = copy();
    const before = inventory(root);
    const skill = path.join(root, "core/skills/clarify/SKILL.md");
    fs.mkdirSync(path.join(root, "core/skills/alias"));
    fs.linkSync(skill, path.join(root, "core/skills/alias/SKILL.md"));
    assert.equal(sum(inventory(root).skills), sum(before.skills));
});

test("contained regular-file symlinks in a skill collection are not directories", () => {
    const root = copy();
    const before = inventory(root);
    write(root, "core/README.md", "An ordinary contained document.\n");
    fs.symlinkSync(path.join(root, "core/README.md"), path.join(root, "core/skills/contained-note.md"));
    assert.equal(sum(inventory(root).skills), sum(before.skills));
});

test("green Stop requires literal native silence", async () => {
    const root = copy();
    const stop = path.join(root, "cli/stop-gate.mjs");
    const original = fs.readFileSync(stop, "utf8");
    const mutated = original.replace('reason: result.message }) : ""', 'reason: result.message }) : result.action === "allow" ? JSON.stringify({ decision: "block", reason: "" }) : ""');
    assert.notEqual(mutated, original);
    fs.writeFileSync(stop, mutated);
    await assert.rejects(() => measure(root), /green|silence|native/);
});

test("renderer sources must be owned regular files", async () => {
    const root = copy();
    for (const rel of ["cli/gate.mjs", "cli/vendor.mjs", ".portulan/verify/prompt-footprint.mjs"]) {
        const file = path.join(root, rel), kept = fs.readFileSync(file);
        fs.rmSync(file);
        fs.symlinkSync(path.join(ROOT, rel), file);
        await assert.rejects(() => measure(root), /outside|owned/);
        if (rel.endsWith("prompt-footprint.mjs")) {
            const actual = spawnSync(process.execPath, [file, "--json"], { cwd: root, encoding: "utf8" });
            assert.equal(actual.status, 2, actual.stderr);
        }
        fs.rmSync(file);
        fs.writeFileSync(file, kept);
    }
});

test("the complete recipe validates its selected helper before executing it", () => {
    const root = temp();
    const tracked = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(tracked.status, 0, tracked.stderr);
    for (const rel of tracked.stdout.split("\0").filter(Boolean)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.cpSync(path.join(ROOT, rel), path.join(root, rel));
    }
    for (const args of [["init", "-q"], ["add", "."]]) assert.equal(spawnSync("git", args, { cwd: root }).status, 0);
    const run = () => spawnSync("bash", [".portulan/verify/context.sh"], { cwd: root, env: { ...process.env, CLAUDE_CONFIG_DIR: HERMETIC_HOST }, encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024 });
    const clean = run();
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    const helper = path.join(root, ".portulan/verify/prompt-footprint.mjs"), saved = fs.readFileSync(helper);
    const outside = temp();
    write(outside, "unmeasured.mjs", 'console.log("outside helper executed without measurement");\n');
    fs.rmSync(helper);
    fs.symlinkSync(path.join(outside, "unmeasured.mjs"), helper);
    const unavailable = run();
    assert.equal(unavailable.status, 2, unavailable.stdout + unavailable.stderr);
    assert.doesNotMatch(unavailable.stdout, /outside helper executed/);
    fs.rmSync(helper);
    fs.writeFileSync(helper, saved);
    assert.equal(run().status, 0);
    const compiler = path.join(root, "cli/compile.mjs"), compilerText = fs.readFileSync(compiler);
    const marker = path.join(outside, "compiler-executed.txt");
    write(outside, "compile.mjs", `import fs from "node:fs";\nfs.writeFileSync(${JSON.stringify(marker)}, "executed");\nexport * from ${JSON.stringify(new URL("./compile.mjs", import.meta.url).href)};\n`);
    fs.rmSync(compiler);
    fs.symlinkSync(path.join(outside, "compile.mjs"), compiler);
    const rejected = run();
    assert.equal(rejected.status, 2, rejected.stdout + rejected.stderr);
    assert.equal(fs.existsSync(marker), false, "full consumer must preflight compiler before earlier imports");
    fs.rmSync(compiler);
    fs.writeFileSync(compiler, compilerText);
    assert.equal(run().status, 0);
});

test("selected compiler code is checked before its first import", () => {
    const root = copy(), outside = temp();
    const marker = path.join(outside, "executed.txt");
    write(outside, "compile.mjs", `import fs from "node:fs";\nfs.writeFileSync(${JSON.stringify(marker)}, "executed");\nexport * from ${JSON.stringify(new URL("./compile.mjs", import.meta.url).href)};\n`);
    const compiler = path.join(root, "cli/compile.mjs");
    fs.rmSync(compiler);
    fs.symlinkSync(path.join(outside, "compile.mjs"), compiler);
    const run = spawnSync(process.execPath, [path.join(root, ".portulan/verify/prompt-footprint.mjs"), "--json"], { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 2, run.stderr);
    assert.equal(fs.existsSync(marker), false, "no selected outside compiler may execute before refusal");
});

test("rendered vendor profiles match the actual CLI and refuse schema coverage drift", async () => {
    const root = copy();
    const profiles = await vendorProfiles(root, { verifyCli: true });
    assert.deepEqual(profiles.map(entry => entry.profile), ["bare", "boot-and-tiers", "degraded"]);
    assert.ok(profiles.every(entry => entry.bytes === Buffer.byteLength(entry.text) && entry.bytes > 0));
    assert.match(profiles[0].text, /engine kernel, inlined/);
    assert.match(profiles[1].text, /# Portulan boot card/);
    assert.match(profiles[1].text, /on-invoke|release/);
    const schemaFile = path.join(root, "spec/workspace.schema.json");
    const schema = JSON.parse(fs.readFileSync(schemaFile));
    schema.properties.slots.properties.newSlot = { $ref: "#/$defs/filePath" };
    fs.writeFileSync(schemaFile, JSON.stringify(schema));
    await assert.rejects(() => vendorProfiles(root), /slot.*coverage/i);
});

test("the native gate entrypoint still runs through an installation symlink", () => {
    const root = temp();
    write(root, ".portulan/gates.json", JSON.stringify({ rules: [{ id: "write", tier: "gated", action: { write: "test.md" }, reason: "Synthetic action needs review." }] }));
    const link = path.join(root, "gate.mjs");
    fs.symlinkSync(path.join(ROOT, "cli/gate.mjs"), link);
    const run = spawnSync(process.execPath, [link], { cwd: root, env: { ...process.env, CLAUDE_PROJECT_DIR: root }, input: JSON.stringify({ tool_name: "Write", tool_input: { file_path: path.join(root, "test.md") } }), encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    const native = JSON.parse(run.stdout);
    assert.equal(native.hookSpecificOutput.permissionDecision, "ask");
});

test("native hook profile coverage is nonempty where expected and silent on allow", async () => {
    const result = await measure(ROOT);
    for (const family of ["skills", "personas", "hooks", "vendor"]) {
        assert.equal(result[family].bytes, sum(result[family].entries));
        assert.ok(result[family].entries.length > 0);
    }
    const hooks = result.hooks.entries;
    for (const runner of ["gate.mjs", "stop-gate.mjs", "advisory.mjs"]) assert.ok(hooks.some(entry => entry.runner === runner));
    assert.ok(hooks.some(entry => entry.channel === "permissionDecisionReason"));
    assert.ok(hooks.some(entry => entry.channel === "additionalContext"));
    assert.ok(hooks.some(entry => entry.channel === "reason"));
    assert.ok(hooks.some(entry => entry.channel === "stderr (operator)"));
    assert.equal(hooks.find(entry => entry.profile === "stop-green").bytes, 0);
    assert.equal(hooks.find(entry => entry.profile === "gate-ignored").bytes, 0);
});

test("all four closure mutations trip their named fixed rail and restore green", async () => {
    const root = copy();
    const before = await measure(root);
    const railText = fs.readFileSync(path.join(root, ".portulan/verify/context.sh"), "utf8");
    const rails = Object.fromEntries([...railText.matchAll(/^RAIL_(SKILLS|PERSONAS|HOOKS|VENDOR)=(\d+)/gm)].map(([, name, cap]) => [name.toLowerCase(), Number(cap)]));
    const runRecipe = () => spawnSync(process.execPath, [path.join(root, ".portulan/verify/prompt-footprint.mjs"), ...Object.entries(rails).map(([name, cap]) => `${name}=${cap}`)], { cwd: root, encoding: "utf8" });
    assert.equal(judge(before, rails), 0);
    assert.equal(runRecipe().status, 0);
    const cases = [
        ["skills", "core/skills/clarify/SKILL.md", text => text + "\n" + "Extra guidance. ".repeat(2600) + "\n"],
        ["personas", "agents/reviewer.md", text => text + "\n" + "Extra guidance. ".repeat(2600) + "\n"],
        ["hooks", "cli/stop-gate.mjs", text => text.replace("RED (exit ${clipDiagnostic(result.code, 64)})", "RED (exit ${clipDiagnostic(result.code, 64)})" + " Sizing probe. ".repeat(3000))],
        ["vendor", "cli/vendor.mjs", text => text.replace("this team's way.", "this team's way." + " Sizing probe. ".repeat(3000))],
    ];
    for (const [family, rel, mutate] of cases) {
        const file = path.join(root, rel);
        const kept = fs.readFileSync(file, "utf8");
        const changed = mutate(kept);
        assert.notEqual(changed, kept, `${family} anchor must exist`);
        try {
            fs.writeFileSync(file, changed);
            const after = await measure(root);
            assert.ok(after[family].bytes > rails[family], `${family}: ${after[family].bytes} > ${rails[family]}`);
            assert.equal(judge(after, rails), 1);
            const run = runRecipe();
            assert.equal(run.status, 1, run.stderr);
            assert.match(run.stdout, new RegExp(`owned ${family}: ${after[family].bytes} B / ${rails[family]} B`));
        } finally { fs.writeFileSync(file, kept); }
        assert.equal(judge(await measure(root), rails), 0);
        assert.equal(runRecipe().status, 0);
    }
    fs.rmSync(path.join(root, "packs/tools/local-llm/personas/local-worker.md"));
    const run = spawnSync(process.execPath, [path.join(root, ".portulan/verify/prompt-footprint.mjs"), "--json"], { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 2, run.stderr);
});
