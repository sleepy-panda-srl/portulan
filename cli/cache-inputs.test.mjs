// Missing cache inputs stay unpriced in reports and hooks.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readTranscript, thresholdFor, projectKey } from "./ledger.mjs";
import { onStatus, onPrompt, onTool, onStop, stateFile, toldFile, heldFile } from "./advisory.mjs";
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
const priced = { horizon: 20, resume: 0 };
const doctor = fileURLToPath(new URL("./doctor.mjs", import.meta.url));
const fields = ["cache_read_input_tokens", "cache_creation_input_tokens"];
function fixture(fn) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "portulan-cache-input-")));
    const write = (rel, value) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof value === "string" ? value : JSON.stringify(value)); };
    const file = path.join(root, "host/projects", projectKey(root), "fixture.jsonl"), dir = path.join(root, "state");
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.mkdirSync(dir);
    const frame = (id, input, overrides = {}) => ({ type: "assistant", cwd: root, gitBranch: "feature/cache", timestamp: "2026-11-11T00:00:00Z", message: { id, model: "fixture", usage: { input_tokens: input, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 1, ...overrides } } });
    const rows = (...values) => fs.writeFileSync(file, values.map(JSON.stringify).join("\n") + "\n");
    const append = value => fs.appendFileSync(file, JSON.stringify(value) + "\n");
    const payload = { session_id: "fixture", transcript_path: file }, options = { dir, ...priced };
    let initialized = false;
    const invoke = () => {
        if (!initialized) {
            const git = (...args) => { const r = spawnSync("git", ["-C", root, "-c", "core.hooksPath=/dev/null", "-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", ...args], { encoding: "utf8" }); assert.equal(r.status, 0, r.stderr); };
            git("init", "-q", "-b", "feature/cache"); write("seed", "fixture\n"); git("add", "seed"); git("commit", "-qm", "fixture");
            write("workspace/workspace.json", { portulan: { spec: "2.16" }, name: "fixture", kind: "repository", tree: "../", slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" }, verify: { default: "docs", recipes: [{ id: "docs", run: "true" }] }, spend: { horizon: { requests: 20 }, resume: { tokens: 0 } } });
            for (const s of ["identity", "principles", "gate-map"]) write(`workspace/${s}.md`, `# ${s}\n`);
            initialized = true;
        }
        return spawnSync(process.execPath, [doctor, path.join(root, "workspace")], { cwd: root, encoding: "utf8", env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(root, "host") } });
    };
    try { return fn({ root, file, dir, frame, rows, append, payload, options, invoke }); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
for (const field of fields) for (const position of ["fresh", "latest"]) test(`missing ${field} in ${position} is unpriced in doctor and cold/warm hooks`, () => fixture(({ frame, rows, payload, options, file, invoke }) => {
    const first = frame("r1", 1000), last = frame("r2", 1800);
    delete (position === "fresh" ? first : last).message.usage[field]; rows(first, last);
    assert.equal(thresholdFor(readTranscript(file), priced).unavailable, "usage");
    const cold = onStatus(payload, options); assert.match(cold, /not known.*missing counters/);
    assert.equal(onStatus(payload, options), cold); assert.equal(onPrompt(payload, options), null); assert.equal(onTool(payload, options), null); assert.equal(onStop(payload, options), null);
    const result = invoke(); assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /class analysis unassessed/); assert.match(result.stdout, /restart: comparison unavailable/); assert.doesNotMatch(result.stdout, /branch class index.*dominant/);
}));
for (const field of fields) for (const supplied of [0, 900]) test(`same-session duplicate completes ${field} with observed ${supplied}`, () => fixture(({ frame, rows, append, payload, options, dir, file, invoke }) => {
    const first = frame("r1", 1000); delete first.message.usage[field]; rows(first, frame("r2", 1800));
    assert.match(onStatus(payload, options), /not known/); assert.equal(onStop(payload, options), null); assert.equal(onPrompt(payload, options), null);
    assert.ok(!fs.existsSync(toldFile("fixture", 0, dir))); assert.ok(!fs.existsSync(heldFile("fixture", 0, dir)));
    append(frame("r1", 1000, { [field]: supplied }));
    const estimate = thresholdFor(readTranscript(file), priced); assert.equal(estimate.saving, supplied ? -2575 : 350);
    assert.match(onStatus(payload, options), new RegExp(`estimated saving ${estimate.saving.toLocaleString("en-US")}`));
    if (supplied === 0) {
        assert.notEqual(onPrompt(payload, options), null); assert.equal(onPrompt(payload, options), null);
        assert.equal(JSON.parse(onStop(payload, options)).decision, "block"); assert.equal(onStop(payload, options), null);
        assert.ok(fs.existsSync(toldFile("fixture", 0, dir))); assert.ok(fs.existsSync(heldFile("fixture", 0, dir)));
    } else { assert.equal(onPrompt(payload, options), null); assert.equal(onStop(payload, options), null); }
    const result = invoke(); assert.equal(result.status, 0, result.stderr); assert.doesNotMatch(result.stdout, /class analysis unassessed/);
}));
test("derived writes use both observed buckets and merged maxima, never a synthetic aggregate ceiling", () => fixture(({ frame, rows, file }) => {
    const derived = (id, buckets, aggregate) => { const r = frame(id, 100, { cache_creation: buckets }); if (aggregate === undefined) delete r.message.usage.cache_creation_input_tokens; else r.message.usage.cache_creation_input_tokens = aggregate; return r; };
    for (const bucket of ["ephemeral_1h_input_tokens", "ephemeral_5m_input_tokens"]) {
        rows(derived("r1", { [bucket]: 900 })); assert.equal(thresholdFor(readTranscript(file), priced).unavailable, "usage");
    }
    rows(derived("r1", { ephemeral_1h_input_tokens: 100, ephemeral_5m_input_tokens: 0 }), derived("r1", { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 200 }));
    let read = readTranscript(file); assert.equal(read.requests[0].writeTotal, null); assert.equal(read.requests[0].written1h + read.requests[0].written5m, 300); assert.notEqual(thresholdFor(read, priced).unavailable, "usage");
    rows(derived("r1", { ephemeral_1h_input_tokens: 100 }), derived("r1", { ephemeral_5m_input_tokens: 200 }));
    read = readTranscript(file); assert.notEqual(thresholdFor(read, priced).unavailable, "usage"); assert.equal(read.requests[0].written1h + read.requests[0].written5m, 300);
    rows(derived("r1", { ephemeral_1h_input_tokens: 100, ephemeral_5m_input_tokens: 0 }, 200), derived("r1", { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 200 }, 200));
    assert.equal(thresholdFor(readTranscript(file), priced).unavailable, "usage");
}));
test("explicit partial live usage declines, complete TTL-derived usage prices, null retains fallback", () => fixture(({ frame, rows, payload, options }) => {
    rows(frame("r1", 1000), frame("r2", 1800));
    for (const field of ["input_tokens", ...fields]) {
        const usage = { input_tokens: 1800, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }; delete usage[field];
        assert.match(onStatus({ ...payload, context_window: { current_usage: usage } }, options), /not known.*current input.*missing/);
    }
    const usage = { input_tokens: 1000, cache_read_input_tokens: 0, cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 800 } };
    assert.match(onStatus({ ...payload, context_window: { current_usage: usage } }, options), /context 2k.*estimated saving 350/);
    assert.match(onStatus({ ...payload, context_window: { current_usage: null } }, options), /estimated saving 350/);
}));
test("cache6 apparently priced state is reread without losing told/held markers", () => fixture(({ frame, rows, payload, options, file, dir, append }) => {
    const first = frame("r1", 1000); delete first.message.usage.cache_read_input_tokens; rows(first, frame("r2", 1800));
    const figures = { compactions: 0, pending: false, fresh: 1000, freshLifetime: null, lifetime: null, last: 1800, requests: 2, recent: ["r1", "r2"] };
    const stale = { v: 6, transcript: file, ino: fs.statSync(file).ino, offset: fs.statSync(file).size, tail: "", figures, comparison: JSON.stringify([null, null, null, 20, 0]), crossing: { ...figures, recent: [] }, recentInputs: [["r1", [1000, 0, 0, 0, 0], 0], ["r2", [1800, 0, 0, 0, 0], 0]], freshUnsafe: false, latestUnsafe: false, freshId: "r1", latestId: "r2", crossingId: "r2", freshInput: [1000, 0, 0, 0, 0], latestInput: [1800, 0, 0, 0, 0], crossingInput: [1800, 0, 0, 0, 0] };
    for (const marked of [false, true]) {
        fs.writeFileSync(stateFile("fixture", dir), JSON.stringify(stale));
        if (marked) for (const f of [toldFile("fixture", 0, dir), heldFile("fixture", 0, dir)]) fs.writeFileSync(f, "preserve");
        assert.match(onStatus(payload, options), /not known.*missing counters/); assert.equal(onStop(payload, options), null);
        if (marked) for (const f of [toldFile("fixture", 0, dir), heldFile("fixture", 0, dir)]) assert.equal(fs.readFileSync(f, "utf8"), "preserve");
    }
    append(frame("r1", 1000)); assert.equal(onPrompt(payload, options), null); assert.equal(onStop(payload, options), null);
}));
test("partial output stays independent of complete input-only pricing", () => fixture(({ frame, rows, file, payload, options }) => {
    for (const output of [undefined, -1]) {
        const first = frame("r1", 1000, { output_tokens: output }); rows(first, frame("r2", 1800));
        assert.equal(thresholdFor(readTranscript(file), priced).saving, 350);
        assert.match(onStatus(payload, options), /estimated saving 350/);
    }
}));
test("torn completion stays unavailable until newline, compaction and sidechains preserve scope", () => fixture(({ frame, rows, append, payload, options, file }) => {
    const first = frame("r1", 1000); delete first.message.usage.cache_creation_input_tokens; rows(first, frame("r2", 1800));
    assert.match(onStatus(payload, options), /not known/);
    fs.appendFileSync(file, JSON.stringify(frame("r1", 1000))); assert.match(onStatus(payload, options), /not known/);
    fs.appendFileSync(file, "\n"); assert.match(onStatus(payload, options), /estimated saving 350/);
    const child = frame("child", 1000); child.isSidechain = true; delete child.message.usage.cache_read_input_tokens; append(child);
    assert.match(onStatus(payload, options), /estimated saving 350/);
    append({ type: "system", subtype: "compact_boundary" }); append(frame("new", 1000)); append(frame("next", 1800));
    assert.equal(JSON.parse(onStop(payload, options)).decision, "block");
}));
for (const field of fields) test(`ordinary doctor and cold Stop independently reject missing ${field}`, () => fixture(({ frame, rows, payload, options, invoke }) => {
    const first = frame("r1", 1000); delete first.message.usage[field]; rows(first, frame("r2", 1800));
    const result = invoke(); assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /class analysis unassessed/); assert.match(result.stdout, /restart: comparison unavailable/);
    assert.equal(onStop(payload, options), null);
}));
for (const field of fields) test(`latest missing ${field} recovers on a complete next request`, () => fixture(({ frame, rows, append, payload, options }) => {
    const latest = frame("r2", 1800); delete latest.message.usage[field]; rows(frame("r1", 1000), latest);
    assert.match(onStatus(payload, options), /latest context usage.*missing/); assert.equal(onStop(payload, options), null);
    append(frame("r3", 1900)); assert.equal(JSON.parse(onStop(payload, options)).decision, "block"); assert.equal(onStop(payload, options), null);
}));
for (const field of fields) test(`same-value completion of historical ${field} replays the first usable crossing`, () => fixture(({ frame, rows, append, payload, options }) => {
    const partial = frame("r2", 1700); delete partial.message.usage[field]; rows(frame("r1", 1000), partial, frame("r3", 1800));
    onStatus(payload, options); append(frame("r2", 1700));
    assert.match(JSON.parse(onPrompt(payload, options)).hookSpecificOutput.additionalContext, /First crossing: request 2, context 1,700/);
}));
test("complete valid appends remain incremental", t => fixture(({ frame, rows, append, payload, options, file }) => {
    rows(frame("r1", 1000)); const original = fs.readFileSync; let wholeReads = 0;
    t.mock.method(fs, "readFileSync", function (target, ...args) { if (target === file) wholeReads++; return original.call(this, target, ...args); });
    onStatus(payload, options); append(frame("r2", 1800)); onStatus(payload, options); assert.equal(wholeReads, 0);
}));
