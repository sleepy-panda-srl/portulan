// Recipe cleanup controls use isolated, test-owned process groups and late filesystem writes.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { windowsTaskkill, terminateTree, runRecipe } from "./recipe-runner.mjs";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { setTimeout as delay } from "node:timers/promises";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const posix = process.platform !== "win32";
const quote = (s) => `'${s.replaceAll("'", "'\\''")}'`;
for (const timeout of [0, -1]) {
    test(`direct timeout ${timeout} remains a bounded immediate deadline`, async () => {
        const result = await runRecipe({ id: "deadline", run: "sleep 0.15; printf escaped-deadline" }, { root: os.tmpdir(), timeout });
        assert.equal(result.outcome, "could not run");
        assert.match(result.output, /time limit/);
    });
}
test("inherited group 1 is refused before spawning", { skip: !posix }, async (t) => {
    let spawned = false;
    t.mock.method(childProcess, "spawn", () => { spawned = true; throw new Error("spawn-control"); });
    syncBuiltinESMExports();
    try {
        const result = await runRecipe({ id: "ownership", run: "true" }, { root: os.tmpdir(), inheritGroup: true, groupId: 1 });
        assert.equal(result.outcome, "could not run");
        assert.equal(spawned, false);
    } finally {
        t.mock.restoreAll();
        syncBuiltinESMExports();
    }
});
async function until(check) {
    for (let i = 0; i < 300; i++) {
        if (check()) return;
        await delay(10);
    }
    throw new Error("test child did not become ready");
}
function kill(pid) {
    try { process.kill(pid, "SIGKILL"); } catch (e) { if (e.code !== "ESRCH") throw e; }
}

async function control({ signal, ignores = false, drain = false, repeat = false, startup = false }) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-recipe-tree-"));
    const at = (name) => path.join(dir, name);
    const leaf = `trap '' TERM INT HUP; sleep 1.2; echo late > ${quote(at("late"))}`;
    const traps = ignores ? "trap '' TERM" : ["INT", "TERM", "HUP"].map((s) => `trap 'echo ${s} > ${quote(at("receipt"))}; exit 0' ${s}`).join("\n");
    const recipe = `echo $$ > ${quote(at("pid"))}\n${traps}\nbash -c ${quote(leaf)} &\necho ready > ${quote(at("ready"))}\n${drain ? "exit 0" : "wait"}`;
    const code = `import {runRecipe} from ${JSON.stringify(pathToFileURL(path.join(ROOT, "cli/finish.mjs")).href)};
import fs from 'node:fs';
const names=['SIGINT','SIGTERM','SIGHUP']; process.on('SIGTERM',()=>{}); if (${repeat}) process.on('SIGHUP',()=>{}); const before=names.map(s=>process.listenerCount(s));
const r=await runRecipe(${JSON.stringify({ id: "tree", run: recipe })}, {root:${JSON.stringify(dir)},env:process.env,timeout:${signal ? 5000 : 200}});
fs.writeFileSync(${JSON.stringify(at("result"))},JSON.stringify({r,before,after:names.map(s=>process.listenerCount(s))}));`;
    const preload = at("startup.cjs");
    if (startup) fs.writeFileSync(preload, `const cp=require('node:child_process');const original=cp.spawn;cp.spawn=(...a)=>{const child=original(...a);Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);return child;};require('node:module').syncBuiltinESMExports();`);
    const child = spawn(process.execPath, [...(startup ? ["--require",preload] : []), "--input-type=module", "-e", code], { detached: true, stdio: "ignore" });
    let storm;
    const done = new Promise((resolve) => child.on("exit", (code, signal) => { clearInterval(storm); resolve({code,signal}); }));
    try {
        await until(() => fs.existsSync(at("ready")));
        if (drain) await delay(100);
        if (signal) process.kill(child.pid, signal);
        if (repeat) storm = setInterval(() => { if (fs.existsSync(at("result")) || !child.kill(signal)) clearInterval(storm); }, 50);
        const exit = await Promise.race([done, delay(4000).then(() => { throw new Error("runner hung"); })]);
        assert.equal(exit.code, 0, JSON.stringify(exit));
        const result = JSON.parse(fs.readFileSync(at("result"), "utf8"));
        assert.equal(result.r.outcome, "could not run");
        assert.equal(result.r.code, null);
        assert.deepEqual(result.after, result.before);
        if (signal) {
            assert.equal(result.r.interrupted, signal);
            if (!drain) assert.equal(fs.readFileSync(at("receipt"), "utf8").trim(), signal.slice(3));
        }
        await delay(1400);
        assert.equal(fs.existsSync(at("late")), false, "descendant wrote after runner cleanup");
    } finally {
        clearInterval(storm);
        if (fs.existsSync(at("pid"))) kill(-Number(fs.readFileSync(at("pid"), "utf8")));
        kill(-child.pid);
        await done;
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

test("timeout kills descendants after a leader exits on TERM", {skip:!posix}, () => control({}));
test("timeout escalates for a leader ignoring TERM", {skip:!posix}, () => control({ignores:true}));
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    test(`runner forwards ${signal}, latches interruption and kills descendants`, {skip:!posix}, () => control({signal}));
}

test("signal handlers are active before a spawned recipe can become ready", {skip:!posix}, () => control({signal:"SIGINT",startup:true}));

test("an interruption during pipe draining is retained without restarting grace", {skip:!posix}, () => control({signal:"SIGHUP",drain:true,repeat:true}));

function stopFixture(recipe) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-stop-tree-"));
    execFileSync("git", ["init", "-q", dir]);
    fs.mkdirSync(path.join(dir,".portulan"));
    fs.writeFileSync(path.join(dir,".portulan/workspace.json"), JSON.stringify({name:"fixture",verify:{default:"check",recipes:[{id:"check",run:recipe}]}}));
    return dir;
}

test("Stop-gate timeout kills descendants and returns its recipe verdict", {skip:!posix}, async () => {
    const dir = stopFixture("trap '' TERM; (trap '' TERM; sleep 1.2; echo late > late) & wait");
    const preload = path.join(dir,"preload.cjs");
    fs.writeFileSync(preload, `const original=setTimeout;global.setTimeout=(f,ms,...a)=>original(f,ms===90000?200:ms,...a);`);
    const child = spawn(process.execPath, ["--require",preload,path.join(ROOT,"cli/stop-gate.mjs")], {cwd:dir,env:{...process.env,CLAUDE_PROJECT_DIR:dir},detached:true,stdio:["pipe","pipe","pipe"]});
    let output=""; child.stdout.on("data",c=>output+=c);
    child.stdin.end(JSON.stringify({session_id:"tree-timeout"}));
    const done = new Promise(resolve=>child.on("exit",code=>resolve(code)));
    try {
        assert.equal(await Promise.race([done,delay(4000).then(()=>{throw new Error("hook hung");})]),0);
        assert.match(output,/could not run/);
        assert.match(output,/time limit/);
        await delay(1400);
        assert.equal(fs.existsSync(path.join(dir,"late")),false);
    } finally { kill(-child.pid); await done; fs.rmSync(dir,{recursive:true,force:true}); }
});

test("Stop-gate turns an asynchronous spawn failure into a recipe verdict", {skip:!posix}, async () => {
    const dir = stopFixture("true");
    const preload=path.join(dir,"preload.cjs");
    fs.writeFileSync(preload, `const cp=require('node:child_process');cp.spawn=()=>{throw new Error('spawn control');};require('node:module').syncBuiltinESMExports();`);
    try {
        const out=execFileSync(process.execPath,["--require",preload,path.join(ROOT,"cli/stop-gate.mjs")],{cwd:dir,env:{...process.env,CLAUDE_PROJECT_DIR:dir},input:JSON.stringify({session_id:"spawn-control"}),encoding:"utf8",timeout:4000});
        assert.match(out,/could not run/);
        assert.match(out,/spawn control/);
    } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test("Windows cleanup preflights a system path and bounds taskkill to the owned tree", () => {
    let checked;
    const command = windowsTaskkill({SystemRoot:"C:\\Windows"}, (p) => { checked=p; });
    assert.equal(command, checked);
    assert.equal(command, "C:\\Windows\\System32\\taskkill.exe");
    assert.throws(()=>windowsTaskkill({SystemRoot:"relative"},()=>{}), /absolute/);
    assert.throws(()=>windowsTaskkill({},()=>{throw new Error("missing taskkill");}), /missing taskkill/);
    const calls=[];
    terminateTree(123,"SIGTERM",{platform:"win32",taskkill:command,exec:(...args)=>calls.push(args)});
    assert.deepEqual(calls, [[command,["/PID","123","/T","/F"],{timeout:1000,windowsHide:true,stdio:"pipe"}]]);
    assert.throws(()=>terminateTree(0,"SIGTERM"), /valid process id/);
    assert.throws(()=>terminateTree(123,"SIGTERM",{platform:"win32",taskkill:command,exec:()=>{throw new Error("taskkill failed");}}), /taskkill failed/);
});
