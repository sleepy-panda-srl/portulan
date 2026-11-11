// Check native invocation and no-resampling guards.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pendingQuality, nativeInvocation, parentPrompt } from "./acquire-personas.mjs";
import { CORPUS } from "../evals/ab/personas/grader.mjs";

const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const order = CORPUS.cases.flatMap((task, i) => (i % 2 === 0 ? ["a", "b"] : ["b", "a"]).map(arm => `${task.id}-${arm}`));
const probe = { key: "mechanism-medium", task: "mechanism", effort: "medium", state: "complete" };
test("a fresh matrix has eighteen calls and an approved decoding repair retains the first call", () => {
    assert.deepEqual(pendingQuality({ phase: "quality-frozen", qualityFrozen: { order }, calls: [probe] }), order);
    const first = { task: CORPUS.cases[0].id, role: "implementer", effort: null, model: "claude-sonnet-5-5", collected: { model: "claude-sonnet-5-5", invocation: { type: "portulan:implementer", effort: null } }, key: order[0], state: "complete", grade: { ok: false }, regraded: { ok: true } };
    const journal = { phase: "quality-frozen-repaired", model: "claude-sonnet-5-5", parentPolicy: { model: "claude-sonnet-5-5" }, qualityFrozen: { order }, calls: [probe, first], decodeRepair: { retainedKey: order[0], approvedBy: "independent checkpoint" } };
    assert.deepEqual(pendingQuality(journal), order.slice(1));
    for (const changes of [{ phase: "aborted" }, { calls: [probe, first, { ...first, key: order[1] }] }, { decodeRepair: {} }, { calls: [probe, { ...first, regraded: { ok: false } }] }]) assert.throws(() => pendingQuality({ ...journal, ...changes }));
    assert.throws(() => pendingQuality({ ...journal, qualityFrozen: { order: [...order].reverse() } }));
    assert.throws(() => pendingQuality({ ...journal, calls: [first, probe] }));
    assert.throws(() => pendingQuality({ ...journal, calls: [{ ...probe, state: "invalid" }, first] }));
    assert.throws(() => pendingQuality({ ...journal, calls: [probe, { ...first, role: "reviewer" }] }));
    assert.throws(() => pendingQuality({ ...journal, calls: [probe, { ...first, effort: "medium" }] }));
});
test("native role, effort and model-selection mismatches refuse, including duplicate children", () => {
    const call = { type: "tool_use", name: "Agent", id: "one", input: { subagent_type: "portulan:reviewer", prompt: "frozen", effort: "medium", run_in_background: false } };
    const rows = [{ type: "assistant", message: { content: [call] } }];
    assert.equal(nativeInvocation(rows, "reviewer", "medium").effort, "medium");
    for (const input of [{ ...call.input, model: "inherit" }, { ...call.input, effort: "high" }, { ...call.input, subagent_type: "other" }, { ...call.input, run_in_background: true }]) assert.throws(() => nativeInvocation([{ type: "assistant", message: { content: [{ ...call, input }] } }], "reviewer", "medium"));
    assert.throws(() => nativeInvocation([{ type: "assistant", message: { content: [call, { ...call, id: "two" }] } }], "reviewer", "medium"));
    assert.equal(nativeInvocation([{ type: "assistant", message: { content: [{ ...call, input: { subagent_type: "portulan:reviewer", prompt: "frozen" } }] } }], "reviewer", null).effort, null);
    assert.match(parentPrompt("reviewer", "/task.json", null), /exactly once/);
    assert.doesNotMatch(parentPrompt("reviewer", "/task.json", null), /"effort"/);
});
