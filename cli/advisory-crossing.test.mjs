// First recorded crossings survive delayed batches without stale Stop holds.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { onPrompt, onTool, onStop, onStatus, stateFile } from "./advisory.mjs";

const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
const priced = { horizon: 20, resume: 0 };
function row(id, context, fresh = false) {
    return JSON.stringify({ type: "assistant", timestamp: "2026-11-11T00:00:00Z", message: { id, model: "fixture", usage: {
        input_tokens: 1, cache_creation_input_tokens: fresh ? context - 1 : 0, cache_read_input_tokens: fresh ? 0 : context - 1, output_tokens: 1,
        cache_creation: { ephemeral_5m_input_tokens: fresh ? context - 1 : 0, ephemeral_1h_input_tokens: 0 },
    } } });
}
function trial(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-crossing-"));
    const file = path.join(dir, "transcript.jsonl"), payload = { session_id: "fixture", transcript_path: file };
    const append = (...lines) => fs.appendFileSync(file, lines.join("\n") + "\n");
    try { append(row("r1", 1000, true)); fn({ dir, file, payload, append, options: { dir, ...priced } }); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const text = value => { assert.notEqual(value, null, "the crossing is reported"); return JSON.parse(value).hookSpecificOutput.additionalContext; };

for (const latest of [1500, 1900]) test(`delayed 1700/${latest} batch identifies request two as the first crossing`, () => trial(({ payload, append, options }) => {
    assert.equal(onTool(payload, options), null);
    assert.equal(onTool(payload, options), null);
    append(row("r2", 1700), row("r2", 1700), row("r3", latest));
    const line = text(onTool(payload, options));
    assert.match(line, /First crossing: request 2, context 1,700 .*threshold 1,625/);
    assert.match(line, new RegExp(`after 3 requests, context ${latest === 1500 ? "1,500" : "1,900"} tokens`));
    if (latest === 1500) assert.match(line, /Latest estimate does not favor restarting/);
    assert.equal(onPrompt(payload, options), null);
    assert.equal(onTool(payload, options), null);
}));

for (const change of [{ horizon: 40 }, { resume: 400 }, { declared: { read: 0.2, write: { "5m": 1.25, "1h": 2 } } }]) {
    test(`changed comparison replays the earliest crossing: ${JSON.stringify(change)}`, () => trial(({ payload, append, options }) => {
        append(row("r2", 1400), row("r3", 1700), row("r4", 1900), row("r5", 1800));
        onStatus(payload, options);
        const updated = { ...options, ...change };
        const warm = text(onTool(payload, updated));
        const cold = text(onTool({ ...payload, session_id: "cold" }, updated));
        assert.equal(warm, cold);
        assert.match(warm, new RegExp(`First crossing: request ${change.resume ? 4 : 2},`));
    }));
}

test("a later explicit lifetime does not rewrite the original crossing", () => trial(({ payload, file, options }) => {
    const unknown = context => JSON.stringify({ type: "assistant", message: { id: `u${context}`, model: "fixture", usage: { input_tokens: context, output_tokens: 1 } } });
    const hour = JSON.parse(row("h3", 1500, true));
    hour.message.usage.cache_creation = { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 1499 };
    fs.writeFileSync(file, [unknown(1000), unknown(1700), JSON.stringify(hour)].join("\n") + "\n");
    onStatus(payload, options);
    const warm = text(onPrompt(payload, options));
    assert.equal(warm, text(onPrompt({ ...payload, session_id: "cold" }, options)));
    assert.match(warm, /First crossing: request 2, context 1,700 \/ threshold 1,625 .*write 1\.25×, assumed 5m/);
    assert.match(warm, /context 1,500 tokens, threshold 2,000/);
    assert.match(warm, /Latest estimate does not favor restarting/);
    assert.equal(onStop(payload, options), null);
}));

test("compaction clears an unreported old crossing, and replacement replays", () => trial(({ payload, file, append, options }) => {
    append(row("r2", 1700));
    onStatus(payload, options);
    append(JSON.stringify({ type: "system", subtype: "compact_boundary" }), row("r3", 2000, true), row("r4", 3000));
    assert.equal(onTool(payload, options), null);
    append(row("r5", 3300), row("r6", 3200));
    assert.match(text(onTool(payload, options)), /First crossing: request 5, context 3,300 \/ threshold 3,250/);
    const other = { ...payload, session_id: "replaced" };
    onStatus(other, options);
    fs.renameSync(file, `${file}.old`);
    fs.writeFileSync(file, row("new1", 500, true) + "\n" + row("new2", 900) + "\n" + row("new3", 600) + "\n");
    assert.match(text(onTool(other, options)), /First crossing: request 2, context 900 \/ threshold 813/);
}));

test("torn and sidechain records cannot become the first crossing", () => trial(({ payload, file, append, options }) => {
    const side = JSON.parse(row("side", 3000)); side.isSidechain = true;
    append(JSON.stringify(side));
    const line = row("r2", 1700);
    fs.appendFileSync(file, line);
    assert.equal(onTool(payload, options), null);
    fs.appendFileSync(file, "\n");
    append(row("r3", 1500));
    assert.match(text(onPrompt(payload, options)), /First crossing: request 2, context 1,700/);
}));

test("a malformed first-crossing cache is discarded and safely replayed", () => trial(({ payload, append, options, dir }) => {
    append(row("r2", 1700), row("r3", 1500));
    onStatus(payload, options);
    const file = stateFile(payload.session_id, dir);
    const valid = JSON.parse(fs.readFileSync(file, "utf8"));
    valid.crossing.compactions += 1;
    fs.writeFileSync(file, JSON.stringify(valid));
    assert.match(text(onTool(payload, options)), /First crossing: request 2, context 1,700/);
}));

test("a status read retains an equality crossing and a stale crossing never holds Stop", () => trial(({ payload, append, options }) => {
    assert.equal(onPrompt(payload, options), null);
    append(row("r2", 1625), row("r3", 1500));
    assert.match(onStatus(payload, options), /estimated saving -250/);
    assert.equal(onStop(payload, options), null);
    const line = text(onPrompt(payload, options));
    assert.match(line, /First crossing: request 2, context 1,625 .*threshold 1,625/);
    assert.match(line, /Latest estimate does not favor restarting/);
    assert.equal(onStop(payload, options), null);
    assert.equal(onTool(payload, options), null);
}));
