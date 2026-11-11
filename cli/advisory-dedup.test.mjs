// Delayed repeats cannot replace the latest distinct request.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { onPrompt, onTool, onStatus, onStop, stateFile, toldFile, heldFile } from "./advisory.mjs";
import { readTranscript, thresholdFor, projectKey } from "./ledger.mjs";
import { run as compile } from "./compile.mjs";
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
const prices = { read: 0.2, write: { "5m": 1.5, "1h": 2 } }, priced = { declared: prices, horizon: 10, resume: 400 };
const boundary = { type: "system", subtype: "compact_boundary" };
const row = (id, n, extra = {}, usage = {}) => ({ type: "assistant", timestamp: "2026-11-11T00:00:00Z", ...extra, message: { id, model: "fixture", usage: { input_tokens: n, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 1, ...usage } } });
const history = n => Array.from({ length: n }, (_, i) => row(`r${String(i + 1).padStart(5, "0")}`, i === 0 ? 400 : i === 1 || i === 2 ? 901 : 600));
function fixture(fn) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "portulan-dedup-"))), dir = root + "/state", file = root + "/session.jsonl";
    fs.mkdirSync(dir);
    const rows = values => fs.writeFileSync(file, values.map(JSON.stringify).join("\n") + "\n");
    const append = (...values) => fs.appendFileSync(file, values.map(JSON.stringify).join("\n") + "\n");
    const payload = { session_id: "fixture", transcript_path: file }, options = { dir, ...priced };
    const kept = () => JSON.parse(fs.readFileSync(stateFile(payload.session_id, dir)));
    try { return fn({ root, dir, file, rows, append, payload, options, kept }); }
    finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function expected(file, count, latest, fresh = 400, compactions = 0, pending = false) {
    const transcript = readTranscript(file), f = transcript.figures;
    assert.deepEqual([f.requests, f.last, f.fresh, f.compactions, f.pending], [count, latest, fresh, compactions, pending]);
    return thresholdFor(transcript, priced);
}
for (const n of [16, 17, 22, 160]) for (const duplicate of [0, 1, 2]) test(`${n} distinct requests retain latest after delayed repeat ${duplicate + 1}`, () => fixture(({ rows, append, file, payload, options, dir }) => {
    const raw = history(n); rows(raw); assert.match(onStatus(payload, options), new RegExp(`${n} requests.*estimated saving -600`)); append(raw[duplicate]);
    assert.equal(expected(file, n, 600).saving, -600);
    for (const p of [payload, { ...payload, session_id: "cold" }]) {
        assert.match(onStatus(p, options), new RegExp(`${n} requests.*estimated saving -600`)); assert.equal(onStop(p, options), null);
    }
    for (const [name, invoke] of [["prompt", onPrompt], ["tool", onTool]]) {
        const p = { ...payload, session_id: name };
        const out = JSON.parse(invoke(p, options)); assert.match(out.hookSpecificOutput.additionalContext, /context 600 tokens.*First crossing: request 2, context 901/);
        assert.equal(invoke(p, options), null); assert.equal(onStop(p, options), null);
    }
    fs.rmSync(stateFile(payload.session_id, dir)); assert.match(onStatus(payload, options), new RegExp(`${n} requests`));
}));
test("canonical maxima change fresh/history without inventing a latest request", () => fixture(({ rows, append, file, payload, options }) => {
    const raw = history(22); rows(raw); onStatus(payload, options); append(row(raw[0].message.id, 500));
    assert.equal(expected(file, 22, 600, 500).saving, -950); assert.match(onStatus(payload, options), /22 requests.*estimated saving -950/); assert.equal(onStop(payload, options), null);
    append(row(raw[1].message.id, "invalid"), row(raw[2].message.id, 1100)); assert.match(JSON.parse(onPrompt(payload, options)).hookSpecificOutput.additionalContext, /First crossing: request 3, context 1,100/);
}));
test("duplicates cannot consume pending parent compactions, including interleaved child boundaries", () => fixture(({ rows, append, file, payload, options }) => {
    const raw = history(22); rows(raw); onStatus(payload, options);
    append(boundary, boundary, { ...boundary, isSidechain: true, agentId: "child" }, raw[1]);
    assert.equal(expected(file, 22, 600, 400, 2, true), null); assert.equal(onStop(payload, options), null);
    onStatus(payload, options); append(row("new", 300)); assert.equal(expected(file, 23, 300, 300, 2).saving, -850);
    assert.match(onStatus(payload, options), /23 requests.*estimated saving -850/);
    append(boundary, raw[2]); assert.equal(expected(file, 23, 300, 300, 3, true), null); assert.equal(onStop(payload, options), null);
}));
for (const childFirst of [true, false]) test(`global first-observation ownership survives shared IDs (child first ${childFirst})`, () => fixture(({ rows, append, file, payload, options }) => {
    const child = { isSidechain: true, agentId: "child" };
    rows(childFirst ? [row("shared", 600, child), row("parent", 400)] : [row("first", 400), row("shared", 600)]);
    onStatus(payload, options); append(row("shared", 901, childFirst ? {} : child));
    expected(file, childFirst ? 1 : 2, childFirst ? 400 : 901);
    assert.match(onStatus(payload, options), new RegExp(`estimated saving ${childFirst ? "-1,000" : "2"}`));
    if (childFirst) assert.equal(onStop(payload, options), null); else assert.equal(JSON.parse(onStop(payload, options)).decision, "block");
    append(boundary, row("shared", 950, childFirst ? {} : child));
    assert.equal(expected(file, childFirst ? 1 : 2, childFirst ? 400 : 950, 400, 1, true), null); assert.equal(onStop({ ...payload, session_id: "pending" }, options), null);
}));
test("shared sidechain observations can complete or invalidate canonical parent usage", () => fixture(({ rows, append, payload, options }) => {
    const first = row("first", 400); delete first.message.usage.cache_read_input_tokens; rows([first, row("last", 901)]);
    assert.match(onStatus(payload, options), /not known/); append(row("first", 400, { isSidechain: true, agentId: "child" }));
    assert.match(onStatus(payload, options), /estimated saving 2/); assert.equal(JSON.parse(onStop(payload, options)).decision, "block");
    append(row("first", "invalid", { isSidechain: true, agentId: "child" })); assert.match(onStatus(payload, options), /not known/); assert.equal(onStop({ ...payload, session_id: "invalid" }, options), null);
}));
test("null IDs stay distinct and synthetic/distinct child observations stay outside parent figures", () => fixture(({ rows, append, file, payload, options }) => {
    rows([row("first", 400), row(null, 901), row(null, 901), row("last", 600)]); onStatus(payload, options);
    append(row("child", 10000, { isSidechain: true, agentId: "child" }), { type: "assistant", message: { id: "synthetic", model: "<synthetic>", usage: {} } });
    expected(file, 4, 600); assert.match(onStatus(payload, options), /4 requests.*estimated saving -600/);
    append(row(null, 901)); expected(file, 5, 901); assert.equal(JSON.parse(onStop(payload, options)).decision, "block");
}));
test("saturated membership confirms identity exactly and still admits a new profitable request", () => fixture(({ rows, append, file, payload, options, kept }) => {
    const raw = history(22); rows(raw); onStatus(payload, options); const saturated = kept(); saturated.seen = "f".repeat(2048); fs.writeFileSync(stateFile(payload.session_id, options.dir), JSON.stringify(saturated));
    append(raw[2]); assert.match(onStatus(payload, options), /22 requests.*estimated saving -600/); expected(file, 22, 600); assert.equal(onStop(payload, options), null);
    const next = kept(); next.seen = "f".repeat(2048); fs.writeFileSync(stateFile(payload.session_id, options.dir), JSON.stringify(next));
    append(row("new-profitable", 901)); assert.match(onStatus(payload, options), /23 requests.*estimated saving 2/); expected(file, 23, 901);
    assert.equal(JSON.parse(onStop(payload, options)).decision, "block"); assert.equal(onStop(payload, options), null);
}));
test("cache7 and malformed membership rebuild without removing once markers", () => fixture(({ rows, append, payload, options, kept, dir }) => {
    const raw = history(22); rows(raw); onStatus(payload, options); append(raw[1]); onStatus(payload, options); const good = kept();
    for (const bad of [undefined, null, "", "0", "0".repeat(2048), "z".repeat(2048), [], {}]) {
        const old = { ...good, seen: bad }; if (bad === undefined) { old.v = 7; delete old.seen; }
        old.figures = { ...old.figures, requests: 23, last: 901 }; fs.writeFileSync(stateFile(payload.session_id, dir), JSON.stringify(old));
        for (const f of [toldFile("fixture", 0, dir), heldFile("fixture", 0, dir)]) fs.writeFileSync(f, "preserve");
        assert.match(onStatus(payload, options), /22 requests.*estimated saving -600/); assert.equal(kept().v, 8); assert.equal(onStop(payload, options), null);
        for (const f of [toldFile("fixture", 0, dir), heldFile("fixture", 0, dir)]) assert.equal(fs.readFileSync(f, "utf8"), "preserve");
    }
}));
test("completed-prefix identity survives a torn duplicate, truncation and inode replacement", () => fixture(({ rows, append, file, payload, options }) => {
    const raw = history(22); rows(raw); onStatus(payload, options); fs.appendFileSync(file, JSON.stringify(raw[1]));
    assert.match(onStatus(payload, options), /22 requests.*estimated saving -600/); fs.appendFileSync(file, "\n"); assert.match(onStatus(payload, options), /22 requests.*estimated saving -600/);
    rows([row("first", 400), row("next", 901)]); assert.match(onStatus(payload, options), /2 requests.*estimated saving 2/);
    fs.renameSync(file, file + ".old"); rows([row("first", 400), row("next", 900)]); assert.match(onStatus(payload, options), /2 requests.*estimated saving 0/); assert.equal(onStop(payload, options), null);
}));
test("bounded membership preserves incremental new appends and exact saturated fallback", t => fixture(({ rows, append, file, payload, options, kept }) => {
    const original = fs.readFileSync; let replays = 0;
    t.mock.method(fs, "readFileSync", function (target, ...args) { if (target === file) replays++; return original.call(this, target, ...args); });
    rows([row("first", 400)]); onStatus(payload, options); append(row("second", 600)); onStatus(payload, options); assert.equal(replays, 0);
    const saturated = kept(); saturated.seen = "f".repeat(2048); fs.writeFileSync(stateFile(payload.session_id, options.dir), JSON.stringify(saturated));
    append(row("third", 600)); onStatus(payload, options); assert.equal(replays, 1); expected(file, 3, 600);
    rows(history(1000)); onStatus(payload, options); const s = kept(); assert.equal(s.seen.length, 2048); assert.ok(s.figures.recent.length <= 16); assert.ok(s.recentInputs.length <= 16); assert.ok(Buffer.byteLength(JSON.stringify(s)) < 8000); t.diagnostic(`raw filter 1024 B, serialized filter ${s.seen.length} B, cache ${Buffer.byteLength(JSON.stringify(s))} B at 1000 distinct IDs; unique appends 0 full reads, saturated new ID 1 replay`);
}));
for (const duplicate of [1, 2]) test(`compiled prompt/tool/status/Stop retain distinct identity (old request ${duplicate + 1})`, () => fixture(({ root, dir, file, rows, append }) => {
    const write = (rel, value) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof value === "string" ? value : JSON.stringify(value)); };
    fs.mkdirSync(root + "/packs");
    write(".portulan/workspace.json", { portulan: { spec: "2.16" }, name: "fixture", kind: "repository", tree: "../", slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" }, verify: { default: "docs", recipes: [{ id: "docs", run: "true" }] }, spend: { multipliers: prices, horizon: { requests: 10 }, resume: { tokens: 400 }, restart: "block" } });
    for (const s of ["identity", "principles", "gate-map"]) write(`.portulan/${s}.md`, `# ${s}\n`);
    assert.equal(compile(["--workspace", root, "--pack-root", root + "/packs"], { quiet: true }), 0);
    const settings = JSON.parse(fs.readFileSync(root + "/.claude/settings.json"));
    const invoke = (kind, sid) => {
        const command = kind === "status" ? settings.statusLine.command : settings.hooks[kind][0].hooks[0].command;
        const r = spawnSync(command, { shell: true, cwd: root, input: JSON.stringify({ session_id: sid, transcript_path: file }), encoding: "utf8", env: { ...process.env, TMPDIR: dir, CLAUDE_CONFIG_DIR: root + "/host", CLAUDE_PROJECT_DIR: root } });
        assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
    };
    const raw = history(22); rows(raw);
    for (const kind of ["UserPromptSubmit", "PostToolUse", "status", "Stop"]) invoke("status", kind + "warm");
    append(raw[duplicate]);
    for (const mode of ["warm", "cold", "cacheless"]) for (const kind of ["UserPromptSubmit", "PostToolUse", "status", "Stop"]) {
        const sid = kind + mode;
        if (mode === "cacheless") { invoke("status", sid); fs.rmSync(stateFile(sid, dir)); }
        const out = invoke(kind, sid);
        if (kind === "Stop") assert.equal(out, "");
        else if (kind === "status") assert.match(out, /22 requests.*estimated saving -600/);
        else { assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /after 22 requests, context 600 tokens.*First crossing: request 2, context 901/); assert.equal(invoke(kind, sid), ""); }
    }
    append(row("new-equality", 900)); assert.equal(invoke("Stop", "equal"), ""); append(row("new-profitable", 901)); assert.equal(JSON.parse(invoke("Stop", "positive")).decision, "block"); assert.equal(invoke("Stop", "positive"), "");
    const git = (...args) => { const r = spawnSync("git", ["-C", root, "-c", "core.hooksPath=/dev/null", "-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", ...args], { encoding: "utf8" }); assert.equal(r.status, 0, r.stderr); };
    git("init", "-q", "-b", "fixture"); git("commit", "-qm", "seed", "--allow-empty");
    const selected = raw.map(r => ({ ...r, cwd: root, gitBranch: "fixture" }));
    write(`host/projects/${projectKey(root)}/witness.jsonl`, [...selected, selected[duplicate]].map(JSON.stringify).join("\n") + "\n");
    const doctor = spawnSync(process.execPath, [fileURLToPath(new URL("./doctor.mjs", import.meta.url)), "--pack-root", root + "/packs", root + "/.portulan"], { cwd: root, encoding: "utf8", env: { ...process.env, CLAUDE_CONFIG_DIR: root + "/host" } });
    assert.equal(doctor.status, 0, doctor.stderr); assert.match(doctor.stdout, /at 600 tokens.*threshold of 900/); assert.match(doctor.stdout, /estimated saving -600/);
}));
test("an older cache snapshot can replay repeated IDs without losing their identity", () => fixture(({ rows, append, file, payload, options, dir }) => {
    const raw = history(22); rows(raw.slice(0, 18)); onStatus(payload, options); const old = fs.readFileSync(stateFile("fixture", dir));
    append(...raw.slice(18), raw[1]); onStatus(payload, options); fs.writeFileSync(stateFile("fixture", dir), old);
    assert.match(onStatus(payload, options), /22 requests.*estimated saving -600/); expected(file, 22, 600); assert.equal(onStop(payload, options), null);
}));
test("mixed global identities and compactions agree with an independently folded stream", () => fixture(({ rows, append, file, payload, options }) => {
    const events = history(22), canonical = [], byId = new Map(); let pending = false, compactions = 0, seed = 1729;
    const accept = event => {
        if (event.type === "system") { if (!event.isSidechain) { compactions++; pending = true; } return; }
        const id = event.message.id, prior = id === null ? undefined : byId.get(id), n = event.message.usage.input_tokens;
        if (prior) { prior.n = Math.max(prior.n, n); return; }
        const r = { n, child: event.isSidechain === true, fresh: !event.isSidechain && pending };
        if (!r.child) pending = false; canonical.push(r); if (id !== null) byId.set(id, r);
    };
    events.forEach(accept); rows(events); onStatus(payload, options);
    for (let at = 0; at < 96; at++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const event = at % 11 === 0 ? { ...boundary, ...(at % 22 ? { isSidechain: true, agentId: "child" } : {}) } : row(at % 13 === 0 ? null : at % 3 ? `r${String(1 + seed % 22).padStart(5, "0")}` : `new-${at}`, 300 + seed % 900, at % 4 === 0 ? { isSidechain: true, agentId: "child" } : {});
        accept(event); append(event);
        const main = canonical.filter(r => !r.child), fresh = main[Math.max(0, main.findLastIndex(r => r.fresh))].n, latest = main.at(-1).n;
        const expectedSaving = 2 * (latest - fresh) - 1.5 * fresh - 400;
        expected(file, main.length, latest, fresh, compactions, pending);
        const status = onStatus(payload, options), cold = { ...payload, session_id: `cold-${at}` };
        assert.equal(onStatus(cold, options), status);
        const stop = onStop(cold, options);
        assert.equal(stop !== null, !pending && expectedSaving > 0, `event ${at}`);
    }
}));
test("an exact old-ID replay preserves the next unique append's incremental cursor", t => fixture(({ rows, append, file, payload, options, kept }) => {
    const raw = history(22); rows(raw); onStatus(payload, options); append(raw[1]);
    assert.match(onStatus(payload, options), /22 requests.*estimated saving -600/);
    const prior = kept().offset, inode = fs.statSync(file).ino, reads = [], readSync = fs.readSync, readFileSync = fs.readFileSync; let full = 0;
    t.mock.method(fs, "readSync", function (fd, ...args) {
        if (fs.fstatSync(fd).ino === inode) reads.push({ position: args[3], length: args[2] });
        return readSync.call(this, fd, ...args);
    });
    t.mock.method(fs, "readFileSync", function (target, ...args) {
        if (target === file) full++;
        return readFileSync.call(this, target, ...args);
    });
    onStatus(payload, options); assert.deepEqual(reads, []); assert.equal(full, 0);
    append(row("after-replay-unique", 600)); assert.match(onStatus(payload, options), /23 requests.*estimated saving -600/);
    assert.equal(kept().offset, fs.statSync(file).size); assert.ok(kept().offset > prior); assert.equal(full, 0);
    assert.ok(reads.length >= 3); assert.ok(reads.every(r => Number.isInteger(r.position) && r.position >= prior - 64), JSON.stringify(reads));
    t.diagnostic(`post-replay append: prior offset ${prior}; reads ${JSON.stringify(reads)}; full replays ${full}`);
}));
