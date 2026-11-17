// The shipped host trace is evidence data; CI only replays its public counters.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { verifyCapture } from "./fixtures/advisory-crossing/verify.mjs";
const capture = JSON.parse(fs.readFileSync(new URL("./fixtures/advisory-crossing/capture.json", import.meta.url)));

test("paired installed-host trace replays against production advisory", () => assert.match(verifyCapture(capture), /zero observed/));
for (const [name, mutate] of [
    ["changed usage", c => { c.runs[1].trace[3].context = 1500; }],
    ["missing hook-visible ID", c => { c.runs[1].trace[4].visible.pop(); }],
    ["missing crossing output", c => { c.runs[1].trace[4].output = null; }],
    ["changed historical restart action", c => { c.runs[1].trace[4].output.hookSpecificOutput.additionalContext = c.runs[1].trace[4].output.hookSpecificOutput.additionalContext.replace("consider a handoff", "write a handoff"); }],
    ["changed historical numeric prefix", c => { c.runs[1].trace[4].output.hookSpecificOutput.additionalContext = c.runs[1].trace[4].output.hookSpecificOutput.additionalContext.replace("1,700", "1,701"); }],
    ["current wording substituted into historical evidence", c => { c.runs[1].trace[4].output.hookSpecificOutput.additionalContext = c.runs[1].trace[4].output.hookSpecificOutput.additionalContext.replace("consider a handoff and restart if these estimates still fit the task.", "consider restart if these estimates still fit the task, after collecting all delegated work and results."); }],
    ["extra Stop hold", c => { c.runs[1].trace[8].output = { decision: "block", reason: "stale" }; }],
    ["unverified network guard", c => { c.runs[0].guard.pop(); }],
    ["unexpected acquisition text", c => { c.prompt = "unexpected text"; }],
]) test(`trace rejects ${name}`, () => { const changed = structuredClone(capture); mutate(changed); assert.throws(() => verifyCapture(changed)); });
