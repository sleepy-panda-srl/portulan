// Offline receipt checks do not reacquire a native-host experiment.
import fs from "node:fs";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { tally } from "../../ledger.mjs";
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
export function verifyCapture(capture) {
    keys(capture, ["schema", "host", "sources", "runs"]);
    assert.equal(capture.schema, 1); assert.equal(capture.host, "2.1.321 (Claude Code)");
    keys(capture.sources, ["capture.mjs", "../../ritual-contexts.mjs", "../../compile.mjs", "../../ledger.mjs"]);
    for (const sha of Object.values(capture.sources)) assert.match(sha, /^[0-9a-f]{64}$/);
    assert.deepEqual(capture.runs.map(r => r.name), ["one", "two", "removed", "lowered"]);
    for (const [i, run] of capture.runs.entries()) {
        keys(run, ["name", "declared", "effective", "guard", "code", "completed", "peak", "children", "refusals", "accepted", "parentRequests", "ledger", "trace"]);
        assert.equal(run.declared, [1, 2, 1, 2][i]); assert.equal(run.effective, [1, 2, null, 1][i]);
        assert.deepEqual(run.guard, ["loopback allowed", "egress denied"]); assert.equal(run.code, 0); assert.equal(run.completed, true);
        const limited = run.effective === 1;
        assert.equal(run.children, 2); assert.equal(run.accepted, 2); assert.equal(run.refusals, limited ? 1 : 0);
        assert.equal(run.parentRequests, limited ? 4 : 3);
        let active = 0, peak = 0, started = 0, parents = 0, refused = 0;
        const live = new Set(), ended = new Set();
        for (const e of run.trace) {
            if (e.kind === "parent") {
                keys(e, ["kind", "step", "refusals"]); assert.equal(e.step, ++parents);
                assert.ok(e.refusals === 0 || e.refusals === (limited ? 1 : 0)); assert.ok(e.refusals >= refused); refused = e.refusals;
            } else {
                keys(e, ["kind", "child", "active"]);
                if (e.kind === "start") { assert.equal(e.child, ++started); assert.ok(!live.has(e.child)); live.add(e.child); active++; }
                else { assert.equal(e.kind, "end"); assert.ok(live.delete(e.child)); assert.ok(!ended.has(e.child)); ended.add(e.child); active--; }
                assert.equal(e.active, active); peak = Math.max(peak, active);
            }
        }
        assert.equal(active, 0); assert.equal(ended.size, 2); assert.equal(started, 2); assert.equal(parents, run.parentRequests); assert.equal(refused, run.refusals);
        assert.equal(peak, limited ? 1 : 2); assert.equal(run.peak, peak);
        const request = { branch: "fixture", uncached: 10, written1h: 0, written5m: 0, writtenUnknown: 0, read: 0, output: 1 };
        const contexts = [null, "a", "b"].map(agent => ({ session: "fixture", agent, requests: Array.from({ length: agent === null ? parents : 1 }, () => ({ ...request })) }));
        const measured = tally(contexts, "fixture");
        keys(run.ledger, ["sessions", "children", "requests"]);
        assert.deepEqual(run.ledger, { sessions: measured.sessions, children: measured.subagentContexts, requests: measured.total.requests });
        assert.ok(measured.sessions + measured.subagentContexts > 1);
    }
    return "Four synthetic native admission controls agree: peaks 1/2/2/1, two children each, actual ledger totals separate from the cap.";
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.stdout.write(verifyCapture(JSON.parse(fs.readFileSync(new URL("./capture.json", import.meta.url)))) + "\n");
