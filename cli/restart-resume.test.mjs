// Bounded-run restart comparisons, recovery expense, profitability and Stop refusal controls.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { figureOf, sessionFigures, readSpend, restartThreshold } from "./ledger.mjs";
import { onPrompt, onStop, onStatus, main, spendFlags, adviceLine, statusLine } from "./advisory.mjs";

const figures = (context) => ({ ...sessionFigures(), fresh: 26000, last: context, freshLifetime: "5m", requests: 15 });
const request = (id, tokens) => JSON.stringify({ type: "assistant", message: { id, usage: { input_tokens: 0, cache_creation_input_tokens: id === "first" ? tokens : 0, cache_read_input_tokens: id === "first" ? 0 : tokens, output_tokens: 1 } } });

test("resume expense and a short remainder reverse the bounded-run comparison", () => {
    const old = figureOf(figures(50000));
    assert.ok(old.threshold < 50000);
    const priced = figureOf(figures(50000), { horizon: 3, resume: 10000 });
    assert.equal(priced.threshold, 167667);
    assert.ok(priced.saving < 0);
    assert.equal(priced.horizonDeclared, true);
    assert.match(adviceLine(old), /resume cost unknown/);
    assert.doesNotMatch(adviceLine(old), /Continuing costs more|write the handoff and end/);
    assert.match(statusLine(old), /20.*default.*resume cost unknown/);
});

test("resume is nullable, strictly validated and propagated from flags", () => {
    assert.equal(readSpend(undefined, "w").resume, null);
    assert.equal(readSpend({ resume: { tokens: 0 } }, "w").resume, 0);
    assert.equal(readSpend({ resume: { tokens: 10000.5 } }, "w").resume, 10000.5);
    for (const value of [-1, Infinity, NaN, "0", null]) assert.throws(() => readSpend({ resume: { tokens: value } }, "w"));
    assert.throws(() => readSpend({ resume: {} }, "w"));
    assert.deepEqual(spendFlags(["--horizon", "3", "--resume-tokens", "10000"]), { declared: null, horizon: 3, resume: 10000, fault: null });
    assert.equal(spendFlags(["--resume-tokens", "-1"]).resume, null);
    assert.throws(() => restartThreshold({ fresh: 26000, write: 1.25, read: 0.1, horizon: 3, resume: Number.MAX_VALUE }));
});

test("unpriced or default-horizon Stops never hold, even far past the old threshold", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-resume-"));
    try {
        const file = path.join(dir, "session.jsonl");
        fs.writeFileSync(file, [request("first", 26000), request("next", 500000)].join("\n") + "\n");
        const payload = { session_id: "s", transcript_path: file };
        assert.equal(onStop(payload, { dir }), null);
        assert.equal(onStop(payload, { dir, horizon: 3 }), null);
        assert.equal(onStop(payload, { dir, resume: 0 }), null);
        const line = onPrompt(payload, { dir });
        assert.match(JSON.parse(line).hookSpecificOutput.additionalContext, /resume cost unknown/);
        assert.equal(onStop(payload, { dir, horizon: 3, resume: 10000 }) !== null, true);
        assert.equal(onStop(payload, { dir, horizon: 3, resume: 10000 }), null);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("profitability is finite and unrounded; equality is not a saving", () => {
    const at = (context, resume = 0) => figureOf({ ...figures(context), fresh: 100, freshLifetime: "5m" }, { horizon: 10, resume });
    assert.equal(at(225).saving, 0);
    assert.equal(at(225.1).saving > 0, true);
    assert.equal(at(225.1).threshold, 225);
    assert.equal(restartThreshold({ fresh: 100, write: 1.25, read: 0.1, horizon: 3, resume: 0 }), 517);
    assert.throws(() => figureOf({ ...figures(Number.MAX_VALUE), fresh: 100 }, { horizon: 100, resume: 0 }));
});

test("a hold waits past equality and additional expense, and malformed flags never hold via fallback", async () => {
    const { main } = await import("./advisory.mjs");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-break-even-"));
    try {
        const file = path.join(dir, "session.jsonl");
        const payload = { session_id: "equality", transcript_path: file };
        const options = { dir, horizon: 10, resume: 10 };
        fs.writeFileSync(file, [request("first", 100), request("equal", 235)].join("\n") + "\n");
        assert.equal(onStop(payload, options), null);
        fs.appendFileSync(file, request("profitable", 236) + "\n");
        const before = [];
        main(["stop", "--horizon", "10", "--resume-tokens", "10", "--read", "invalid"], { payload, dir, stdout: { write: line => before.push(line) }, stderr: { write: () => {} } });
        assert.deepEqual(before, []);
        assert.equal(JSON.parse(onStop(payload, options)).decision, "block");
        assert.equal(onStop({ ...payload, session_id: "retry", stop_hook_active: true }, options), null);
        assert.equal(onStop(payload, options), null);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("decimal equality stays zero while fractional savings survive on hooks and status", () => {
    const declared = { read: 0.1, write: { "5m": 1.2, "1h": 1.2 } };
    const options = { declared, horizon: 3, resume: 0 };
    const equal = figureOf({ ...figures(500), fresh: 100 }, options);
    assert.equal(equal.threshold, 500);
    assert.equal(equal.saving, 0);
    const positive = figureOf({ ...figures(500), fresh: 100 }, { ...options, declared: { read: 0.1, write: { "5m": 1.1999, "1h": 1.1999 } } });
    assert.ok(Math.abs(positive.saving - 0.01) < 1e-12);
    assert.match(adviceLine(positive), /Estimated savings 0\.01 /);
    assert.match(statusLine(positive), /estimated saving 0\.01/);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-decimal-"));
    try {
        const file = path.join(dir, "session.jsonl");
        fs.writeFileSync(file, [request("first", 100), request("equal", 500)].join("\n") + "\n");
        const payload = { session_id: "decimal", transcript_path: file };
        assert.equal(onStop(payload, { dir, ...options }), null);
        assert.equal(JSON.parse(onStop(payload, { dir, ...options, declared: { read: 0.1, write: { "5m": 1.1999, "1h": 1.1999 } } })).decision, "block");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("live status arithmetic overflow reports unknown on direct and CLI paths", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-status-overflow-"));
    try {
        const file = path.join(dir, "session.jsonl");
        fs.writeFileSync(file, request("first", 100) + "\n");
        const payload = { session_id: "overflow", transcript_path: file, context_window: { current_usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 1000000 } } };
        const expected = "restart threshold: not known, because the estimated saving overflows";
        assert.equal(onStatus(payload, { dir, horizon: 1e308, resume: 0 }), expected);
        const out = [], err = [];
        assert.equal(main(["status", "--horizon", "1e308", "--resume-tokens", "0"], { payload, dir, stdout: { write: line => out.push(line) }, stderr: { write: line => err.push(line) } }), 0);
        assert.deepEqual(out, [expected + "\n"]);
        assert.deepEqual(err, []);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
