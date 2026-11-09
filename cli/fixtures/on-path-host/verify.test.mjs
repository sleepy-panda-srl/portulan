import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { verifyCapture, sha } from "./verify.mjs";
import { auditRecipeSource } from "../../telemetry.mjs";

const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const load = () => JSON.parse(fs.readFileSync(new URL("./capture.json", import.meta.url)));
test("the normalized real-host capture proves both sides of the path boundary", () => {
    assert.equal(verifyCapture(load()), true);
});
test("broken load, source, session, label and Read evidence are refused", () => {
    for (const breakIt of [
        (c) => { c.events = c.events.filter((e) => e.file !== ".claude/rules/portulan/conventions.md"); },
        (c) => { c.events.find((e) => e.file === ".claude/rules/portulan/on-read.md").file = "context/api.md"; },
        (c) => { c.events.find((e) => e.file === c.target).reason = "session_start"; },
        (c) => { c.events.find((e) => e.file === c.target).trigger = "docs/control.txt"; },
        (c) => { c.events.find((e) => e.file === c.target).globs = ["other/**"]; },
        (c) => { c.events.find((e) => e.file === c.target).session = "wrong-session"; },
        (c) => { c.reads.reverse(); },
        (c) => { c.reads[0].file = "context/api.md"; },
        (c) => { c.prompts[0] += c.label; },
        (c) => { c.commands.host.push("--append-system-prompt", c.label); },
        (c) => { c.inputs.api += c.label; },
        (c) => { c.inputs.target += "changed"; },
        (c) => { c.hostExit = 1; },
        (c) => { c.outsideActivity = 1; },
        (c) => { c.observers.completed.pop(); },
        (c) => { c.observers.started[0] = c.observers.completed[0] = 999999999; },
        (c) => { const at = c.commands.host.indexOf("--settings"); c.commands.host.splice(at, 2); },
        (c) => { c.commands.host[c.commands.host.indexOf("--setting-sources") + 1] = "user,project"; },
        (c) => { c.controls.unexpectedReadGuard = false; },
        (c) => { c.controls.fullHostContextMeasured = true; },
        (c) => { c.replies[1] = "label unavailable"; },
    ]) { const c = load(); breakIt(c); assert.throws(() => verifyCapture(c)); }
});
test("asynchronous instruction callback append order does not become load order", () => {
    const c = load(); c.events.reverse(); assert.equal(verifyCapture(c), true);
});
test("coherently rehashed wrong frontmatter cannot borrow an api glob from body prose", () => {
    const c = load();
    for (const [key, file] of [["source", "context/api.md"], ["target", c.target]]) {
        c.inputs[key] = c.inputs[key].replaceAll("api/**", "other/**") + "\nLiteral example: api/**\n";
        c.inputDigests[key] = sha(c.inputs[key]);
        for (const rows of [c.beforeFiles, c.afterFiles]) rows.find((row) => row.file === file).sha256 = c.inputDigests[key];
    }
    assert.throws(() => verifyCapture(c));
});
test("observer redacts outside paths and rejects alternate Read routes without adding context", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-observer-test-"));
    try {
        const trace = path.join(dir, "trace");
        const run = (input) => spawnSync(process.execPath, [fileURLToPath(new URL("./observer.mjs", import.meta.url)), dir, trace], { input: JSON.stringify(input), encoding: "utf8" });
        assert.equal(run({ hook_event_name: "InstructionsLoaded", session_id: "fixture", file_path: "/outside/SOURCE_SENTINEL", load_reason: "session_start" }).stdout, "");
        const denied = run({ hook_event_name: "PreToolUse", session_id: "fixture", tool_name: "Read", tool_input: { file_path: path.join(dir, "context/api.md") } });
        assert.equal(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision, "deny");
        assert.doesNotMatch(denied.stdout, /additionalContext/);
        const records = fs.readFileSync(trace, "utf8");
        assert.doesNotMatch(records, /SOURCE_SENTINEL/);
        assert.ok(records.includes('"outside":true') && records.includes('"unexpected":true'));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test("default capture startup launches no host and the explicit live spelling is audited", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-no-host-"));
    try {
        const marker = path.join(dir, "called");
        fs.writeFileSync(path.join(dir, "claude"), '#!/bin/sh\nprintf called > "$PORTULAN_PROBE_MARKER"\n', { mode: 0o755 });
        const result = spawnSync(process.execPath, [fileURLToPath(new URL("./capture.mjs", import.meta.url))], { env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}`, PORTULAN_PROBE_MARKER: marker }, encoding: "utf8" });
        assert.equal(result.status, 2);
        assert.equal(fs.existsSync(marker), false);
        const blocked = spawnSync(process.execPath, [fileURLToPath(new URL("./capture.mjs", import.meta.url)), "--run-host", path.join(dir, "forbidden")], { env: { ...process.env, CI: "true", PATH: `${dir}${path.delimiter}${process.env.PATH}`, PORTULAN_PROBE_MARKER: marker }, encoding: "utf8" });
        assert.equal(blocked.status, 1);
        assert.equal(fs.existsSync(marker), false);
        assert.equal(fs.existsSync(path.join(dir, "forbidden")), false);
        assert.ok(auditRecipeSource("node cli/fixtures/on-path-host/capture.mjs --run-host fixture").some((hit) => hit.flag === "--run-host"));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
