// Independent project context measurements for the two guidance formats.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { alwaysTier, alwaysLine } from "./context.mjs";
import { inspect, run as doctor } from "./doctor.mjs";
import { READING_LINE, formOf } from "./form.mjs";
import { instructionsState } from "./instructions.mjs";

const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const made = [];
after(() => made.forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));
function scratch() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-context-host-"));
    made.push(root);
    return root;
}
function write(root, file, value) {
    const full = path.join(root, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, value);
}
function project({ budget, ratio = 3, files = {} } = {}) {
    const root = scratch(), workspace = path.join(root, ".portulan");
    const manifest = {
        portulan: { spec: "2.9" }, name: "host-fixture", kind: "repository", tree: "../",
        slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" },
        verify: { default: "check", recipes: [{ id: "check", run: "true" }] },
        ...(budget === undefined ? {} : { context: { always: { budget: { tokens: budget } }, ratio: { bytes_per_token: ratio, calibrated_by: "claude-code" } } }),
    };
    for (const [file, value] of Object.entries({
        ".portulan/workspace.json": JSON.stringify(manifest), ".portulan/identity.md": "# Fixture\n",
        ".portulan/principles.md": "# Principles\n", ".portulan/gate-map.md": "# Gates\n", ...files,
    })) write(root, file, value);
    return { root, workspace, manifest };
}
const context = result => result.findings.filter(f => f.check === "context");
function host(result, name) {
    const found = context(result).find(f => f.message.startsWith(`${name}:`));
    assert.ok(found, JSON.stringify(context(result)));
    return found;
}
const agents = "AGENTS.md, vendored";
const measured = f => inspect(f.workspace, { packRoots: [path.join(ROOT, "packs")] });

test("doctor automatically measures the real vendored AGENTS file and excludes pointed-to bodies", async () => {
    const root = scratch(), workspace = path.join(root, ".portulan");
    const result = spawnSync(process.execPath, [path.join(ROOT, "cli/vendor.mjs"), path.join(ROOT, "cli/fixtures/guidance"), "--into", workspace, "--residence", "in-repo", "--host", "codex", "--pack-root", path.join(ROOT, "packs")], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const bytes = fs.statSync(path.join(root, "AGENTS.md")).size;
    const report = host(await measured({ workspace }), agents);
    assert.match(report.message, new RegExp(`${bytes.toLocaleString("en-US")} B`));
    assert.match(report.message, /the largest: AGENTS\.md/);
    assert.match(report.message, /pointer|pointed/);
    assert.doesNotMatch(report.message, /init would offer|plugin's descriptions add/);
    const manifest = JSON.parse(fs.readFileSync(path.join(workspace, "workspace.json")));
    write(root, `.portulan/${manifest.slots.identity}`, "POINTED_BODY".repeat(10000));
    assert.equal(host(await measured({ workspace }), agents).message, report.message);
    write(root, "literal.md", "AT_TARGET".repeat(10000));
    fs.appendFileSync(path.join(root, "AGENTS.md"), "\n@literal.md\n");
    const before = host(await measured({ workspace }), agents).message;
    write(root, "literal.md", "CHANGED_TARGET".repeat(30000));
    assert.equal(host(await measured({ workspace }), agents).message, before);
    assert.equal(fs.statSync(path.join(root, "AGENTS.md")).size, bytes + Buffer.byteLength("\n@literal.md\n"));
});

test("one unchanged budget is judged independently, and either host alone can fail and recover", async () => {
    const f = project({ budget: 1000, files: { "CLAUDE.md": "C".repeat(2100), "AGENTS.md": "A".repeat(2100) } });
    const declared = fs.readFileSync(path.join(f.workspace, "workspace.json"));
    const initial = await measured(f);
    assert.equal(context(initial).length, 2);
    assert.equal(host(initial, "Claude Code").severity, "report");
    assert.equal(host(initial, agents).severity, "report");
    assert.match(host(initial, agents).message, /extrapolat|calibration host.*not|shared ratio.*estimate/i);
    for (const [file, name] of [["AGENTS.md", agents], ["CLAUDE.md", "Claude Code"]]) {
        write(f.root, file, "X".repeat(3300));
        const over = await measured(f);
        assert.equal(host(over, name).severity, "fail");
        assert.equal(host(over, name === agents ? "Claude Code" : agents).severity, "report");
        assert.match(host(over, name).message, /~1,100 tokens.*over the 1,000/);
        if (file === "AGENTS.md") assert.doesNotMatch(host(over, name).message, /instructions\.mjs|portulan: on-read|init would offer/);
        const body = fs.readFileSync(path.join(f.root, file));
        write(f.root, `details/${file}`, body);
        write(f.root, file, `Read details/${file} on demand.\n`);
        assert.equal(host(await measured(f), name).severity, "report");
        assert.deepEqual(fs.readFileSync(path.join(f.root, `details/${file}`)), body);
    }
    assert.deepEqual(fs.readFileSync(path.join(f.workspace, "workspace.json")), declared);
});

test("growing only AGENTS changes its unbudgeted report without failing Claude or the workspace", async () => {
    const f = project({ files: { "AGENTS.md": "A".repeat(11000) } });
    const first = await measured(f);
    assert.match(host(first, agents).message, /11,000 B/);
    write(f.root, "AGENTS.md", "A".repeat(22000));
    const second = await measured(f);
    assert.match(host(second, agents).message, /22,000 B/);
    assert.equal(host(second, agents).severity, "report");
    assert.equal(host(second, "Claude Code").message, host(first, "Claude Code").message);
    assert.equal(second.findings.some(f => f.severity === "fail"), false);
});

test("an absent optional AGENTS file is zero, while present unmeasurable sources cannot judge a budget", async t => {
    const empty = project({ budget: 1000 });
    assert.match(host(await measured(empty), agents).message, /~0 tokens, 0 B/);
    for (const kind of ["dangling", "directory", "invalid-utf8", "outside", "denied"]) {
        for (const budget of [undefined, 1000]) {
            const f = project({ budget, files: { "CLAUDE.md": "Claude stays measurable.\n" } });
            const file = path.join(f.root, "AGENTS.md");
            if (kind === "dangling") fs.symlinkSync(path.join(f.root, "absent"), file);
            if (kind === "directory") fs.mkdirSync(file);
            if (kind === "invalid-utf8") fs.writeFileSync(file, Buffer.from([0xc3, 0x28]));
            const outside = path.join(scratch(), "outside.md");
            if (kind === "outside") { fs.writeFileSync(outside, "OUTSIDE_PRIVATE_BODY"); fs.symlinkSync(outside, file); }
            const read = fs.readFileSync, opened = [];
            const access = t.mock.method(fs, "readFileSync", (target, ...args) => {
                let real;
                try { real = fs.realpathSync(target); } catch { real = String(target); }
                opened.push(real);
                if (kind === "denied" && String(target) === file) throw Object.assign(new Error("FIXTURE_SECRET"), { code: "EACCES" });
                return read(target, ...args);
            });
            try {
                if (kind === "denied") fs.writeFileSync(file, "Present but unreadable.\n");
                const result = await measured(f), found = host(result, agents);
                if (kind === "outside") assert.ok(!opened.includes(fs.realpathSync(outside)), "outside body was opened");
                assert.equal(found.severity, budget === undefined ? "report" : "fail", kind);
                assert.match(found.message, budget === undefined ? /not measured/ : /cannot be judged/);
                assert.doesNotMatch(found.message, /OUTSIDE_PRIVATE_BODY|FIXTURE_SECRET/);
                assert.equal(host(result, "Claude Code").severity, "report");
            } finally { access.mock.restore(); }
        }
    }
});

test("host measurement stays scoped and no-tree and pointer reports remain explicit", () => {
    const f = project({ files: { "AGENTS.md": "Agents only.\n", "CLAUDE.md": "Claude only.\n" } });
    assert.deepEqual(alwaysTier(f.root, { host: "agents-md" }).entries.map(e => path.basename(e.file)), ["AGENTS.md"]);
    assert.deepEqual(alwaysTier(f.root).entries.map(e => path.basename(e.file)), ["CLAUDE.md"]);
    for (const manifest of [{ ...f.manifest, tree: undefined }, { ...f.manifest, kind: "pointer", tree: undefined }]) {
        const line = alwaysLine(f.workspace, manifest, { host: "agents-md" });
        assert.equal(line.verdict, "unmeasured");
        assert.match(line.line, /^AGENTS\.md, vendored:.*not measured/);
    }
});

test("the AGENTS measurer opens only its root source, without host records or transport", t => {
    const f = project({ budget: 1, files: { "AGENTS.md": "Instructions for this host.\n", "CLAUDE.md": "Other host.\n" } });
    const read = fs.readFileSync, opened = [];
    t.mock.method(fs, "readFileSync", (file, ...args) => {
        opened.push(String(file));
        return read(file, ...args);
    });
    const found = alwaysLine(f.workspace, f.manifest, { host: "agents-md" });
    assert.equal(found.verdict, "over");
    assert.deepEqual(opened, [path.join(f.root, "AGENTS.md")]);
});

function boot(f) {
    f.manifest.portulan.spec = "2.10";
    f.manifest.slots.context = "context/";
    write(f.root, ".portulan/workspace.json", JSON.stringify(f.manifest));
    write(f.root, ".portulan/context/boot.md", `---\ntier: always\n---\n# Portulan boot card\n\n${READING_LINE}\n`);
}

test("actual static doctor never blocks on a rejected root FIFO", t => {
    if (process.platform === "win32") { t.skip("POSIX FIFO fixture"); return; }
    for (const file of ["CLAUDE.md", "AGENTS.md"]) {
        const f = project({ budget: 1000 });
        boot(f);
        execFileSync("mkfifo", [path.join(f.root, file)]);
        const result = spawnSync(process.execPath, [path.join(ROOT, "cli/doctor.mjs"), "--static", f.workspace], { encoding: "utf8", timeout: 3000, killSignal: "SIGKILL" });
        assert.equal(result.error, undefined, `${file}: ${result.error?.message}`);
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stdout, /cannot be judged/);
        assert.doesNotMatch(result.stdout, /a boot card at the head of AGENTS/);
    }
});

test("form cannot reopen escaping AGENTS or an instruction through an escaping ancestor", async t => {
    for (const kind of ["agents", "claude-parent"]) {
        const f = project({ budget: 1000 });
        boot(f);
        const outside = scratch();
        if (kind === "agents") {
            write(outside, "source.md", "# Portulan boot card\nOUTSIDE_SENTINEL\n");
            fs.symlinkSync(path.join(outside, "source.md"), path.join(f.root, "AGENTS.md"));
        } else {
            write(outside, "CLAUDE.md", "# Outside\n\n## Section\n<!-- portulan: on-read -->\n\nOUTSIDE_SENTINEL\n");
            fs.symlinkSync(outside, path.join(f.root, ".claude"), "dir");
        }
        const outsideReal = fs.realpathSync(outside), read = fs.readFileSync, opened = [];
        const access = t.mock.method(fs, "readFileSync", (file, ...args) => {
            let real;
            try { real = fs.realpathSync(file); } catch { real = String(file); }
            opened.push(real);
            return read(file, ...args);
        });
        try {
            const result = await measured(f);
            if (kind === "claude-parent") {
                const state = instructionsState(f.root, rel => {
                    try { return fs.readFileSync(path.join(f.root, rel), "utf8"); }
                    catch (error) { if (error.code === "ENOENT" || error.code === "ENOTDIR") return null; throw error; }
                });
                assert.equal(state.pending, 0);
            }
            assert.ok(!opened.some(file => file.startsWith(outsideReal + path.sep)), JSON.stringify(opened));
            const form = result.findings.find(f => f.check === "form").message;
            assert.doesNotMatch(form, /a boot card at the head of AGENTS|section.*marked to move|OUTSIDE_SENTINEL/);
        } finally { access.mock.restore(); }
    }
});

test("ratio labels match each reported format ID and qualify unknown calibration IDs", async () => {
    for (const calibratedBy of ["claude-code", "agents-md", "fixture-host"]) {
        const f = project({ budget: 1000, files: { "AGENTS.md": "A\n", "CLAUDE.md": "C\n" } });
        f.manifest.context.ratio.calibrated_by = calibratedBy;
        write(f.root, ".portulan/workspace.json", JSON.stringify(f.manifest));
        const result = await measured(f);
        assert.equal(result.findings.some(f => f.severity === "fail"), false);
        for (const [id, label] of [["claude-code", "Claude Code"], ["agents-md", agents]]) {
            const line = host(result, label).message;
            if (id === calibratedBy) {
                assert.match(line, new RegExp(`calibrated by ${calibratedBy}`));
                assert.doesNotMatch(line, /extrapolat/);
            } else assert.match(line, /extrapolat/);
        }
    }
});

test("instruction state preserves a supplied reader for prospective files", () => {
    const root = scratch();
    const result = instructionsState(root, file => file === "CLAUDE.md" ? "# Local\n\n## Section\n<!-- portulan: on-read -->\n\nOpen on demand.\n" : null);
    assert.equal(result.pending, 1);
});

test("split advice also refuses a nonregular root without blocking", t => {
    if (process.platform === "win32") { t.skip("POSIX FIFO fixture"); return; }
    const root = scratch();
    execFileSync("mkfifo", [path.join(root, "CLAUDE.md")]);
    const code = `import {splitOffers} from ${JSON.stringify(pathToFileURL(path.join(ROOT, "cli/instructions.mjs")).href)}; console.log(JSON.stringify(splitOffers(${JSON.stringify(root)},{ratio:3,floor:0})));`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8", timeout: 3000, killSignal: "SIGKILL" });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.stdout.trim(), "[]");
});

test("the instruction file reader refuses FIFO and invalid UTF-8 sources", t => {
    if (process.platform === "win32") { t.skip("POSIX FIFO fixture"); return; }
    const observations = [];
    for (const kind of ["fifo", "invalid-utf8"]) {
        const root = scratch(), file = path.join(root, "CLAUDE.md");
        if (kind === "fifo") execFileSync("mkfifo", [file]);
        else fs.writeFileSync(file, Buffer.from([0xc3, 0x28]));
        const code = `import {treeReader} from ${JSON.stringify(pathToFileURL(path.join(ROOT, "cli/instructions.mjs")).href)}; try {treeReader(${JSON.stringify(root)})('CLAUDE.md'); console.log('UNSAFE READ');} catch(error) {console.log(error.message);}`;
        observations.push([kind, spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8", timeout: 3000, killSignal: "SIGKILL" })]);
    }
    for (const [kind, result] of observations) {
        assert.equal(result.error, undefined, `${kind}: ${result.error?.message}`);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout, /regular instruction source|not valid UTF-8/);
        assert.doesNotMatch(result.stdout, /UNSAFE READ/);
    }
});

test("in-tree links still expose legitimate boot cards and instruction markers", async () => {
    const f = project({ budget: 1000 });
    boot(f);
    write(f.root, "local/agents.md", "# Portulan boot card\nLocal guidance.\n");
    fs.symlinkSync(path.join(f.root, "local/agents.md"), path.join(f.root, "AGENTS.md"));
    write(f.root, "local/CLAUDE.md", "# Local\n\n## Section\n<!-- portulan: on-read -->\n\nLocal body.\n");
    fs.symlinkSync(path.join(f.root, "local/CLAUDE.md"), path.join(f.root, "CLAUDE.md"));
    const result = await measured(f), form = result.findings.find(f => f.check === "form").message;
    assert.match(formOf(f.workspace, f.manifest).pieces.find(p => p.id === "card").text, /a boot card at the head of AGENTS\.md/);
    assert.match(form, /section.*marked to move/);
    assert.match(form, /CLAUDE\.md is a link/);
});

test("an unmeasurable Claude source does not suppress the separate AGENTS verdict", async () => {
    for (const kind of ["dangling", "directory", "invalid-utf8"]) {
        const f = project({ budget: 1000, files: { "AGENTS.md": "Agents remain measurable.\n" } });
        const file = path.join(f.root, "CLAUDE.md");
        if (kind === "dangling") fs.symlinkSync(path.join(f.root, "absent"), file);
        if (kind === "directory") fs.mkdirSync(file);
        if (kind === "invalid-utf8") fs.writeFileSync(file, Buffer.from([0xc3, 0x28]));
        const result = await measured(f);
        assert.equal(host(result, "Claude Code").severity, "fail", kind);
        assert.match(host(result, "Claude Code").message, /cannot be judged/);
        assert.equal(host(result, agents).severity, "report");
        assert.ok(host(result, agents).message.includes(`${fs.statSync(path.join(f.root, "AGENTS.md")).size} B`));
    }
});

test("Claude advice stays scoped and form migration waits for an AGENTS-only budget repair", async () => {
    const f = project({ budget: 1000, files: { "AGENTS.md": "A".repeat(3300), "CLAUDE.md": "Small.\n" } });
    const result = await measured(f);
    assert.match(result.findings.find(f => f.check === "lever").message, /^Claude Code project domain:/);
    assert.match(result.findings.find(f => f.check === "form").message, /AGENTS\.md budget.*before.*migration/);
});

test("static and agent doctor report both budgets while the provider corpus remains Claude-only", async () => {
    const f = project({ budget: 1000, files: { "CLAUDE.md": "CLAUDE_CORPUS\n", "AGENTS.md": "AGENTS_CORPUS\n" } });
    let calls = 0;
    const countOptions = { env: { ANTHROPIC_API_KEY: "fixture-secret" }, fetch: async (_url, options) => {
        calls++;
        assert.ok(options.body.includes("CLAUDE_CORPUS"));
        assert.ok(!options.body.includes("AGENTS_CORPUS"));
        return new Response(JSON.stringify({ input_tokens: 20 }), { status: 200 });
    } };
    assert.equal(await doctor(["--static", f.workspace], { quiet: true, countOptions }), 0);
    assert.equal(calls, 0);
    const human = spawnSync(process.execPath, [path.join(ROOT, "cli/doctor.mjs"), "--static", f.workspace], { encoding: "utf8", env: { ...process.env, PORTULAN_AGENT: "0" } });
    assert.equal(human.status, 0, human.stdout + human.stderr);
    assert.match(human.stdout, /AGENTS\.md, vendored:/);
    assert.equal(await doctor(["--count-tokens", "fixture-model", f.workspace], { quiet: true, countOptions }), 0);
    assert.equal(calls, 1);
    write(f.root, "AGENTS.md", "A".repeat(3300));
    assert.equal(await doctor(["--count-tokens", "fixture-model", f.workspace], { quiet: true, countOptions }), 1);
    assert.equal(calls, 1);
    const child = spawnSync(process.execPath, [path.join(ROOT, "cli/doctor.mjs"), "--agent", "--static", f.workspace], { encoding: "utf8" });
    assert.equal(child.status, 1);
    assert.match(child.stdout, /AGENTS\.md, vendored:.*over/);
    write(f.root, "AGENTS.md", "Small.\n");
    const green = spawnSync(process.execPath, [path.join(ROOT, "cli/doctor.mjs"), "--agent", "--static", f.workspace], { encoding: "utf8" });
    assert.equal(green.status, 0, green.stdout + green.stderr);
    assert.equal(green.stdout.trim().split("\n").length, 1);
});
