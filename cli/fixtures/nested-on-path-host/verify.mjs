import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const sha = (value) => createHash("sha256").update(value).digest("hex");
export function verifyCapture(c) {
    assert.equal(c.format, 2);
    assert.equal(c.normalization, "nested-fixture-paths-v1; selected SDK fields; replies trimmed");
    assert.equal(c.hostExit, 0);
    assert.match(c.hostVersion, /^2\./);
    assert.ok(c.model && c.session);
    assert.match(c.label, /^ON_PATH_[a-f0-9]{32}$/);
    assert.equal(c.target, "api/CLAUDE.md");
    assert.deepEqual(c.beforeFiles, c.afterFiles, "the fixture changed during observation");
    for (const [key, text] of Object.entries(c.inputs)) assert.equal(sha(text), c.inputDigests[key], `${key} digest drift`);
    for (const [key, file] of Object.entries({ source: "context/api.md", target: c.target, api: "api/orders.txt", control: "docs/control.txt" })) assert.equal(c.beforeFiles.find((row) => row.file === file)?.sha256, c.inputDigests[key]);
    const body = text => text.startsWith("---\n") ? text.slice(text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/)[0].length) : text.slice(text.indexOf("\n")+1);
    assert.equal(body(c.inputs.source), body(c.inputs.target));
    assert.match(c.inputs.source, /^---\ntier: on-path\ntarget: "api\/CLAUDE\.md"\n/);
    const first=c.inputs.target.split("\n",1)[0];
    assert.ok(first.startsWith("<!-- portulan compiled instruction ") && first.endsWith(" -->"));
    assert.deepEqual(JSON.parse(first.slice("<!-- portulan compiled instruction ".length,-4)),{workspace:".",source:"context/api.md",target:c.target});
    assert.ok(body(c.inputs.source).includes(c.label));
    assert.ok(!c.inputs.source.slice(0, -body(c.inputs.source).length).includes(c.label));
    assert.ok(!c.inputs.target.slice(0, -body(c.inputs.target).length).includes(c.label));
    assert.ok(c.inputs.source.includes(c.label) && c.inputs.target.includes(c.label));
    assert.ok(!c.inputs.target.startsWith("---\npaths:"));
    assert.ok(!c.inputs.api.includes(c.label) && !c.inputs.control.includes(c.label));
    assert.ok(c.prompts.length === 2 && c.prompts.every((p) => !p.includes(c.label)));
    assert.ok(!JSON.stringify(c.commands).includes(c.label));
    assert.ok(!c.commands.host.some((arg) => /^--(?:append-)?system-prompt(?:-file)?$/.test(arg)));
    assert.equal(c.commands.host[0], "claude");
    const pairs = new Map([
        ["--input-format", "stream-json"], ["--output-format", "stream-json"], ["--tools", "Read"], ["--allowedTools", "Read"],
        ["--permission-mode", "dontAsk"], ["--setting-sources", "project"], ["--settings", "<capture>/settings.json"],
        ["--mcp-config", '{"mcpServers":{}}'], ["--max-turns", "6"],
    ]);
    const flags = new Set(["--print", "--verbose", "--replay-user-messages", "--no-session-persistence", "--disable-slash-commands", "--strict-mcp-config"]);
    const seen = new Set();
    for (let i = 1; i < c.commands.host.length; i++) {
        const flag = c.commands.host[i];
        assert.ok(!seen.has(flag), "duplicate host option");
        seen.add(flag);
        if (pairs.has(flag)) assert.equal(c.commands.host[++i], pairs.get(flag), `${flag} control drift`);
        else assert.ok(flags.has(flag), "unexpected host option");
    }
    assert.equal(seen.size, pairs.size + flags.size, "host controls missing");
    assert.deepEqual(c.replies, ["NOT_LOADED", c.label]);
    assert.deepEqual(c.reads.map(({ name, file, phase }) => ({ name, file, phase })), [
        { name: "Read", file: "docs/control.txt", phase: 0 }, { name: "Read", file: "api/orders.txt", phase: 1 },
    ]);
    assert.ok(c.reads.every((read) => read.resultSeen && !read.isError));
    assert.equal(c.outsideActivity, 0);
    assert.ok(c.events.length > 0 && c.events.every((e) => e.session === c.session && !e.outside && !e.unexpected));
    const loads = c.events.filter((e) => e.event === "InstructionsLoaded");
    assert.equal(loads.length, 3, "unexpected instruction route");
    for (const file of [".claude/rules/portulan/conventions.md", ".claude/rules/portulan/on-read.md"]) {
        const eager = loads.filter((e) => e.file === file);
        assert.equal(eager.length, 1);
        assert.equal(eager[0].reason, "session_start");
        assert.deepEqual(eager[0].globs, []);
        assert.equal(eager[0].trigger, null);
    }
    const target = loads.filter((e) => e.file === c.target);
    assert.equal(target.length, 1);
    assert.equal(target[0].reason, "nested_traversal");
    assert.equal(target[0].trigger, "api/orders.txt");
    assert.deepEqual(target[0].globs, []);
    for (const file of ["docs/control.txt", "api/orders.txt"]) {
        for (const event of ["PreToolUse", "PostToolUse"]) assert.equal(c.events.filter((e) => e.event === event && e.file === file && e.tool === "Read").length, 1);
    }
    assert.ok(c.events.some((e) => e.event === "SessionEnd"));
    assert.deepEqual(c.events.filter((e) => e.event === "UserPromptSubmit").map((e) => e.promptSha256).sort(), c.prompts.map(sha).sort());
    assert.deepEqual([...c.observers.started].sort(), [...c.observers.completed].sort());
    assert.equal(c.observers.started.length, c.events.length);
    assert.ok(c.observers.started.length > 0);
    const ids = c.events.map((e) => e.id);
    assert.ok(ids.every((id) => Number.isSafeInteger(id) && id > 0));
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(c.observers.started).size, ids.length);
    assert.deepEqual([...c.observers.started].sort(), [...ids].sort());
    for (const key of ["rawStream", "rawObserver", "rawStderr", "rawSettings", "captureScript", "observerScript", "compiler", "guidanceFiles"]) assert.match(c.provenance[key], /^[a-f0-9]{64}$/);
    assert.equal(c.provenance.captureScript, sha(fs.readFileSync(new URL("./capture.mjs", import.meta.url))));
    assert.equal(c.provenance.observerScript, sha(fs.readFileSync(new URL("../on-path-host/observer.mjs", import.meta.url))));
    assert.equal(typeof c.provenance.worktreeClean,"boolean");
    assert.equal(c.controls.autoMemoryEnabled, false);
    assert.equal(c.controls.settingsSources, "project");
    assert.equal(c.controls.skillsDisabled, true);
    assert.equal(c.controls.strictEmptyMcp, true);
    assert.equal(c.controls.unexpectedReadGuard, true);
    assert.equal(c.controls.fullHostContextMeasured, false);
    assert.ok(c.controls.instructionExclusionPatterns > 0);
    assert.ok(!JSON.stringify(c.controls).includes(c.label));
    return true;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    try { verifyCapture(JSON.parse(fs.readFileSync(new URL("./capture.json", import.meta.url)))); process.stdout.write("nested on-path real-host capture: verified offline\n"); }
    catch (error) { process.stderr.write(`nested on-path capture: ${error.message}\n`); process.exitCode = 1; }
}
