// Agent recipe output controls.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { agentCommand, recipeSet, resolverFor } from "./recipe-set.mjs";
import { execute } from "./recipe-output.mjs";
import { Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "cli/recipe-output.mjs");
const made = [];
after(() => made.forEach((p) => fs.rmSync(p, { recursive: true, force: true })));
function temporary() { const p = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-output-")); made.push(p); return p; }
function unmanagedEnv() { const env = { ...process.env }; delete env.PORTULAN_RECIPE_MANAGED; delete env.PORTULAN_RECIPE_GROUP; return env; }
function invoke(command, extra = {}) {
    return spawnSync(process.execPath, [CLI, "--", command], { encoding: "utf8", env: { ...unmanagedEnv(), TMPDIR: temporary() }, ...extra });
}

test("green is exactly one nonempty count line and no stderr", () => {
    const result = invoke("printf 'many\\nlines\\n'; printf 'notes\\n' >&2");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^GREEN — 1 recipe passed\n$/);
    assert.equal(result.stderr, "");
});

for (const code of [1, 2, 126, 127]) {
    test(`exit ${code} preserves complete streams beyond the tail, without adding newlines`, () => {
        const root = temporary();
        const out = Buffer.concat([Buffer.from([0, 255]), Buffer.from("o".repeat(90000))]);
        const err = Buffer.from("e".repeat(80000));
        fs.writeFileSync(path.join(root, "out"), out);
        fs.writeFileSync(path.join(root, "err"), err);
        const command = `cat '${root}/out'; cat '${root}/err' >&2; exit ${code}`;
        const result = invoke(command, { encoding: null });
        assert.equal(result.status, code);
        assert.deepEqual(result.stdout, out);
        assert.deepEqual(result.stderr, err);
    });
}

test("command quoting survives apostrophes, spaces, dollar expressions and backticks", () => {
    const command = "printf '%s' 'a b '\"'\"' $(literal) `literal`'; exit 1";
    const result = spawnSync("bash", ["-c", agentCommand(command)], { encoding: "utf8", env: unmanagedEnv() });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "a b ' $(literal) `literal`");
});

test("every live and future opaque recipe is wrapped through the carrier", () => {
    const workspaceDir = path.join(ROOT, ".portulan");
    const manifest = JSON.parse(fs.readFileSync(path.join(workspaceDir, "workspace.json")));
    const resolve = resolverFor({ workspaceDir, manifest, repoRoot: ROOT, named: [path.join(ROOT, "packs")] });
    const human = recipeSet(manifest, { resolve });
    const agent = recipeSet(manifest, { resolve, agent: true });
    assert.equal(human.ok, true);
    assert.equal(agent.ok, true);
    assert.equal(agent.recipes.length, human.recipes.length);
    for (let i = 0; i < human.recipes.length; i++) assert.equal(agent.recipes[i].run, agentCommand(human.recipes[i].run));
    const future = recipeSet({ verify: { default: "future", recipes: [{ id: "future", run: "printf 'opaque\\noutput\\n'" }] } }, { agent: true });
    const result = spawnSync("bash", ["-c", future.recipes[0].run], { encoding: "utf8", env: unmanagedEnv() });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.split("\n").filter(Boolean).length, 1);
});

test("spool setup failure cannot run the command or print green", async () => {
    const root = temporary(), marker = path.join(root, "ran");
    const file = path.join(root, "not-a-directory");
    fs.writeFileSync(file, "file");
    let stdout = "", stderr = "";
    const sink = (append) => new Writable({ write(chunk, _encoding, done) { append(String(chunk)); done(); } });
    const code = await execute(`touch '${marker}'`, { env: unmanagedEnv(), tmpdir: file, stdout: sink((s) => stdout += s), stderr: sink((s) => stderr += s) });
    assert.equal(code, 2);
    assert.equal(fs.existsSync(marker), false);
    assert.equal(stdout, "");
    assert.match(stderr, /could not run/);
});

test("spool write and replay failures refuse a green", async (t) => {
    const root = temporary();
    const capture = async (command) => {
        let err = "";
        const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
        const errors = new Writable({ write(chunk, _encoding, done) { err += String(chunk); done(); } });
        const code = await execute(command, { env: unmanagedEnv(), tmpdir: root, stdout: output, stderr: errors });
        assert.equal(code, 2);
        assert.match(err, /could not run/);
        assert.deepEqual(fs.readdirSync(root), []);
    };
    const original = fs.writeSync;
    t.mock.method(fs, "writeSync", () => { throw new Error("spool-write-control"); });
    await capture("printf data");
    t.mock.restoreAll();
    assert.equal(fs.writeSync, original);
    t.mock.method(fs, "readSync", () => { throw new Error("replay-control"); });
    await capture("printf data; exit 1");
    t.mock.restoreAll();
});

test("spawn failure is could-not-run and leaves no temporary files", () => {
    const root = temporary();
    const preload = path.join(root, "spawn.cjs");
    fs.writeFileSync(preload, "const cp=require('node:child_process'); cp.spawn=()=>{throw new Error('spawn-control')};require('node:module').syncBuiltinESMExports();");
    const result = spawnSync(process.execPath, ["--require", preload, CLI, "--", "printf data"], { env: { ...unmanagedEnv(), TMPDIR: root }, encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /spawn-control/);
    assert.deepEqual(fs.readdirSync(root), ["spawn.cjs"]);
});

test("a failed output destination refuses both replay and a green summary", async () => {
    for (const command of ["printf data; exit 1", "printf data"]) {
        let diagnostic = "";
        const stdout = new Writable({ write(_chunk, _encoding, done) { done(new Error("sink-control")); } });
        const stderr = new Writable({ write(chunk, _encoding, done) { diagnostic += String(chunk); done(); } });
        assert.equal(await execute(command, { env: unmanagedEnv(), stdout, stderr }), 2);
        assert.match(diagnostic, /sink-control/);
    }
});

test("inherited group ownership must match the executor's actual group", { skip: process.platform === "win32" }, () => {
    const root = temporary(), marker = path.join(root, "ran");
    const result = invoke(`touch '${marker}'`, { env: { ...unmanagedEnv(), PORTULAN_RECIPE_MANAGED: "1", PORTULAN_RECIPE_GROUP: "1" } });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /does not own/);
    assert.equal(fs.existsSync(marker), false);
});

for (const signal of [null, "SIGINT", "SIGTERM", "SIGHUP", "spool-failure"]) {
    test(`outer runner ${signal ?? "timeout"} cleans nested descendants and anonymous spools`, { skip: process.platform === "win32" }, async () => {
        const root = temporary(), capture = path.join(root, "capture");
        fs.mkdirSync(capture);
        const word = (s) => `'${s.replaceAll("'", "'\\''")}'`;
        const leaf = `trap '' TERM INT HUP; echo $$ > ${word(path.join(root, "leaf"))}; sleep 3.5; echo late > ${word(path.join(root, "late"))}`;
        const recipe = `trap '' TERM INT HUP; echo "$$ $PPID" > ${word(path.join(root, "owned"))}; bash -c ${word(leaf)} & while [ ! -f ${word(path.join(root, "leaf"))} ]; do sleep 0.01; done; echo ready > ${word(path.join(root, "ready"))}; ${signal === "spool-failure" ? "printf trigger;" : ""} wait`;
        const preload = path.join(root, "spool.cjs");
        fs.writeFileSync(preload, "require('node:fs').writeSync=()=>{throw new Error('spool-control')};");
        const command = `${signal === "spool-failure" ? `NODE_OPTIONS=${word(`--require ${preload}`)} ` : ""}${agentCommand(recipe)}`;
        const runner = pathToFileURL(path.join(ROOT, "cli/recipe-runner.mjs")).href;
        const program = `import fs from 'node:fs';import {runRecipe} from ${JSON.stringify(runner)};
const result=await runRecipe({id:'outer',run:${JSON.stringify(command)}},{root:${JSON.stringify(root)},env:{...process.env,TMPDIR:${JSON.stringify(capture)}},timeout:${signal ? 10000 : 2500}});
fs.writeFileSync(${JSON.stringify(path.join(root, "result"))},JSON.stringify(result));`;
        const child = spawn(process.execPath, ["--input-type=module", "-e", program], { detached: true, stdio: "ignore" });
        const stopped = new Promise((resolve) => child.on("exit", (code) => resolve(code)));
        const kill = (pid) => { try { process.kill(pid, "SIGKILL"); } catch (e) { if (e.code !== "ESRCH") throw e; } };
        try {
            for (let tries = 0; !fs.existsSync(path.join(root, "ready")) || !fs.existsSync(path.join(root, "leaf")); tries++) {
                if (tries > 400) throw new Error("nested recipe did not start");
                await delay(10);
            }
            assert.deepEqual(fs.readdirSync(capture), []);
            if (signal && signal !== "spool-failure") process.kill(child.pid, signal);
            assert.equal(await Promise.race([stopped, delay(15000).then(() => "hung")]), 0);
            const result = JSON.parse(fs.readFileSync(path.join(root, "result")));
            assert.equal(result.outcome, "could not run");
            if (signal && signal !== "spool-failure") assert.equal(result.interrupted, signal);
            await delay(3600);
            assert.equal(fs.existsSync(path.join(root, "late")), false);
            assert.deepEqual(fs.readdirSync(capture), []);
        } finally {
            for (const file of ["owned", "leaf"]) if (fs.existsSync(path.join(root, file))) {
                for (const pid of fs.readFileSync(path.join(root, file), "utf8").trim().split(/\s+/).map(Number)) { kill(-pid); kill(pid); }
            }
            kill(-child.pid); kill(child.pid);
            await stopped;
        }
    });
}
