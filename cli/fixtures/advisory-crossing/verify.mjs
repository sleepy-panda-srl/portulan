// Offline replay of the controlled host trace; never starts a host or a backend.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { onPrompt, onTool, onStop } from "../../advisory.mjs";

export function verifyCapture(capture) {
    assert.deepEqual(Object.keys(capture).sort(), ["host", "runs", "schema", "sources"]);
    assert.equal(capture.schema, 1);
    assert.match(capture.host, /^2\.1\.321 \(Claude Code\)$/);
    assert.deepEqual(Object.keys(capture.sources).sort(), ["../../advisory.mjs", "../../ledger.mjs", "capture.mjs", "observe.mjs"]);
    for (const digest of Object.values(capture.sources)) assert.match(digest, /^[a-f0-9]{64}$/);
    assert.deepEqual(capture.runs.map(r => r.name), ["below", "crossing"]);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-host-trace-"));
    try {
        for (const run of capture.runs) {
            assert.deepEqual(Object.keys(run).sort(), ["code", "completed", "contexts", "guard", "name", "trace"]);
            assert.equal(run.code, 0); assert.equal(run.completed, true);
            assert.deepEqual(run.guard, ["loopback allowed", "egress denied"]);
            assert.deepEqual(run.contexts, [1000, run.name === "crossing" ? 1700 : 1500, 1500, 1500]);
            const file = path.join(dir, `${run.name}.jsonl`);
            fs.writeFileSync(file, "");
            const ids = [], types = [], outputs = [];
            for (const entry of run.trace) {
                types.push(entry.kind);
                if (entry.kind === "response") {
                    assert.deepEqual(Object.keys(entry).sort(), ["context", "id", "kind"]);
                    assert.equal(entry.id, `trace_${run.name}_${ids.length + 1}`);
                    assert.equal(entry.context, run.contexts[ids.length]);
                    const first = ids.length === 0;
                    ids.push(entry.id);
                    fs.appendFileSync(file, JSON.stringify({ type: "assistant", message: { id: entry.id, model: "trace-fixture", usage: {
                        input_tokens: 1, cache_creation_input_tokens: first ? entry.context - 1 : 0, cache_read_input_tokens: first ? 0 : entry.context - 1, output_tokens: 1,
                        cache_creation: { ephemeral_5m_input_tokens: first ? entry.context - 1 : 0, ephemeral_1h_input_tokens: 0 },
                    } } }) + "\n");
                } else {
                    assert.equal(entry.kind, "hook");
                    assert.deepEqual(Object.keys(entry).sort(), ["event", "kind", "output", "visible"]);
                    assert.deepEqual(entry.visible, ids, "this capture observed zero completed-request lag at each hook");
                    const event = ids.length === 0 ? "UserPromptSubmit" : ids.length === 4 ? "Stop" : "PostToolUse";
                    assert.equal(entry.event, event);
                    const output = { UserPromptSubmit: onPrompt, PostToolUse: onTool, Stop: onStop }[event]({ session_id: run.name, transcript_path: file }, { dir, horizon: 20, resume: 0 });
                    assert.deepEqual(entry.output, output === null ? null : JSON.parse(output));
                    if (entry.output !== null) outputs.push({ at: ids.length, event, output: entry.output });
                }
            }
            assert.deepEqual(types, ["hook", "response", "hook", "response", "hook", "response", "hook", "response", "hook"]);
            assert.equal(ids.length, 4);
            assert.equal(outputs.length, run.name === "crossing" ? 1 : 0);
            if (outputs.length) {
                assert.equal(outputs[0].at, 2); assert.equal(outputs[0].event, "PostToolUse");
                assert.match(outputs[0].output.hookSpecificOutput.additionalContext, /after 2 requests, context 1,700 tokens, threshold 1,625/);
            }
        }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    return "Paired synthetic Claude Code 2.1.321 trace replays: crossing request 2; zero observed completed-request lag; no below-threshold or final Stop output.";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.stdout.write(verifyCapture(JSON.parse(fs.readFileSync(new URL("./capture.json", import.meta.url)))) + "\n");
}
