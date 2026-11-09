// Stop recipe diagnostics retain failures across noise and stream boundaries.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runStopRecipe } from "./stop-gate.mjs";

const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const recipe = { id: "diagnostic", run: "false", timeout: 10 };
async function relay(parts, result = {}, selected = recipe) {
    return runStopRecipe(selected, async (_recipe, options) => {
        for (const part of parts) {
            const [name, text] = Array.isArray(part) ? part : ["stdout", part];
            options.onOutput?.(name, Buffer.isBuffer(text) ? text : Buffer.from(text));
        }
        return { outcome: "red", code: 1, output: parts.map(p => Array.isArray(p) ? p[1] : p).join(""), ...result };
    });
}
function bounded(problem) {
    assert.equal(problem.reason, "recipe");
    assert.ok(Buffer.byteLength(problem.text) <= 6144, String(Buffer.byteLength(problem.text)));
    assert.doesNotMatch(problem.text, /\uFFFD/);
}

test("real Stop execution keeps stderr failure before more than 64 KiB of success noise", async () => {
    const result = await runStopRecipe({ ...recipe, run: "printf 'FAIL-critical\\n  expected budget <= 200\\n' >&2; for ((i=1;i<=4000;i++)); do printf 'PASS-%s padding-padding-padding\\n' \"$i\"; done; exit 1" });
    bounded(result);
    assert.match(result.text, /FAIL-critical/);
    assert.match(result.text, /expected budget <= 200/);
    assert.doesNotMatch(result.text, /PASS-/);
    assert.match(result.text, /Run verification explicitly/i);
});

test("streamed failures survive a result containing only the runner's later tail", async () => {
    const result = await relay(["FAIL earliest\n", "PASS later\n"], { output: "PASS later\n" });
    assert.match(result.text, /FAIL earliest/);
    assert.doesNotMatch(result.text, /PASS later/);
    bounded(result);
});

test("recipe and TAP failures retain detail but successful test names cannot become errors", async () => {
    const result = await relay(["PASS error and FAIL are test names\nok 1 - error red FAIL handling\nFAIL path\n  expected: 2\n  actual: 3\nnot ok 2 - cap\n  ---\n  location: 'budget.test.mjs:4:2'\n  error: 'too large'\n  ...\nRED — verify recipe failed\nok 3 - no error\n"]);
    for (const text of ["FAIL path", "expected: 2", "actual: 3", "not ok 2 - cap", "location:", "too large", "RED —"]) assert.ok(result.text.includes(text), text);
    assert.doesNotMatch(result.text, /PASS error|ok 1 -|ok 3 -/);
    bounded(result);
});

test("unknown output is labeled while a success-only nonzero exit relays no PASS lines", async () => {
    const fallback = await relay([], { output: "unexpected widget state\n" });
    assert.match(fallback.text, /unrecognized output/i);
    assert.match(fallback.text, /unexpected widget state/);
    bounded(fallback);
    for (const output of ["", "PASS error boundary\nok 1 - FAIL handling\nGREEN all recipes\n"]) {
        const result = await relay([], { output });
        assert.match(result.text, /no failure diagnostic identified/i);
        assert.doesNotMatch(result.text, /PASS error|ok 1 -|GREEN all/);
        assert.match(result.text, /Run verification explicitly/i);
        bounded(result);
    }
});

test("executor diagnostics have reserved space after failures saturate the excerpt", async () => {
    const result = await relay(["FAIL broken\n".repeat(2000)], { outcome: "could not run", code: null, diagnostics: ["spawn EACCES", "interrupted by SIGTERM"], timedOut: true });
    assert.match(result.text, /spawn EACCES/);
    assert.match(result.text, /interrupted by SIGTERM/);
    assert.match(result.text, /timed out after 10 s/);
    assert.match(result.text, /omitted|clipped/i);
    bounded(result);
});

test("compiler error locations survive a later RED summary and passing test names", async () => {
    const result = await relay(["PASS compiler error: handled\nfile.mjs:4: error: bad declaration\nRED — compile failed\n"]);
    assert.match(result.text, /file.mjs:4: error: bad declaration/);
    assert.doesNotMatch(result.text, /PASS compiler/);
    bounded(result);
});

test("an oversized executor reason cannot hide the following interruption reason", async () => {
    const result = await relay(["FAIL x\n"], { diagnostics: ["spawn " + "界".repeat(10000), "interrupted by SIGTERM"] });
    assert.match(result.text, /spawn/);
    assert.match(result.text, /interrupted by SIGTERM/);
    bounded(result);
});

test("split UTF-8, CRLF and separate incomplete streams preserve complete diagnostic lines", async () => {
    const bytes = Buffer.from("FAIL 🚨 café\r\n  expected: 日本語");
    const parts = [...bytes].map(b => ["stdout", Buffer.from([b])]);
    parts.splice(7, 0, ["stderr", "ERROR second"], ["stderr", " stream\n"]);
    const result = await relay(parts);
    assert.match(result.text, /FAIL 🚨 café/);
    assert.match(result.text, /expected: 日本語/);
    assert.match(result.text, /ERROR second stream/);
    bounded(result);
});

test("giant unterminated lines and many short failures stay within the excerpt byte cap", async () => {
    for (const text of ["FAIL 🚨" + "界".repeat(100000), "FAIL x\n".repeat(10000)]) {
        const result = await relay([text]);
        const excerpt = result.text.split("\n").slice(1).join("\n");
        assert.ok(Buffer.byteLength(excerpt) <= 4096, String(Buffer.byteLength(excerpt)));
        assert.match(result.text, /FAIL/);
        assert.match(result.text, /omitted|clipped/i);
        bounded(result);
    }
});

test("oversized recipe identities and failure messages cannot exceed the whole-message ceiling", async () => {
    const selected = { ...recipe, id: "界".repeat(100000) };
    bounded(await relay(["FAIL budget\n"], {}, selected));
    bounded(await runStopRecipe({ error: "界".repeat(100000) }));
    bounded(await runStopRecipe(selected, async () => { throw new Error("界".repeat(100000)); }));
});

test("green execution still returns no recipe problem regardless of output", async () => {
    assert.equal(await relay(["ERROR obsolete output\n"], { outcome: "green" }), null);
});

test("real mixed streams cannot join an unterminated success prefix to a stderr failure", async () => {
    const result = await runStopRecipe({ ...recipe, run: "printf 'PASS passing partial'; printf 'FAIL-critical\\n  expected budget <= 200\\n' >&2; printf '\\n'; exit 1" });
    assert.match(result.text, /FAIL-critical/);
    assert.match(result.text, /expected budget <= 200/);
    assert.doesNotMatch(result.text, /PASS passing partial|unrecognized output/);
    bounded(result);
});

test("real passing TAP and spec transcripts cannot fill the failure excerpt", async () => {
    const file = path.join(HERMETIC_HOST, "passing.test.mjs");
    fs.writeFileSync(file, "import test from 'node:test'; for(let i=0;i<130;i++)test('compiler error: PASS when handled '+i,()=>{});\n");
    const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
    for (const reporter of ["tap", "spec"]) {
        const run = `unset NODE_TEST_CONTEXT; ${quote(process.execPath)} --test --test-reporter=${reporter} ${quote(file)}; exit 1`;
        const result = await runStopRecipe({ ...recipe, run });
        assert.match(result.text, /no failure diagnostic identified/);
        assert.doesNotMatch(result.text, /compiler error|# fail 0|ℹ|unrecognized output/);
        bounded(result);
    }
    fs.appendFileSync(file, "test('ACTUAL-FAILURE-CONTROL',()=>{throw new Error('SPECIFIC-ASSERTION')});\n");
    const result = await runStopRecipe({ ...recipe, run: `unset NODE_TEST_CONTEXT; ${quote(process.execPath)} --test --test-reporter=tap ${quote(file)}` });
    assert.match(result.text, /ACTUAL-FAILURE-CONTROL/);
    assert.match(result.text, /SPECIFIC-ASSERTION/);
    assert.doesNotMatch(result.text, /compiler error: PASS/);
    bounded(result);
});

test("structured interruption survives three cleanup reasons", async () => {
    const result = await relay(["FAIL probe\n"], { outcome: "could not run", code: null, interrupted: "SIGTERM", diagnostics: ["kill EPERM", "kill EPERM", "kill EPERM", "interrupted by SIGTERM"] });
    assert.match(result.text, /interrupted by SIGTERM/);
    bounded(result);
});

test("real runner interruption stays visible when its test-owned process group denies cleanup", async t => {
    if (process.platform === "win32") { t.skip("POSIX process-group control"); return; }
    const original = process.kill.bind(process);
    const marker = path.join(HERMETIC_HOST, "recipe-pid");
    t.mock.method(process, "kill", (pid, signal) => {
        if (pid < 0) throw Object.assign(new Error(`kill ${signal} EPERM (test-owned group)`), { code: "EPERM" });
        return original(pid, signal);
    });
    const timer = setTimeout(() => process.emit("SIGINT"), 150);
    try {
        const result = await runStopRecipe({ ...recipe, run: `echo $$ > '${marker}'; echo FAIL-probe; sleep 5 & wait` });
        assert.match(result.text, /interrupted by SIGINT/);
        assert.match(result.text, /EPERM/);
        bounded(result);
    } finally {
        clearTimeout(timer);
        t.mock.restoreAll();
        if (fs.existsSync(marker)) {
            try { original(-Number(fs.readFileSync(marker, "utf8")), "SIGKILL"); }
            catch (error) { if (error.code !== "ESRCH") throw error; }
        }
    }
});

test("real spawn failures remain executor diagnostics without a fake recipe-output copy", async () => {
    const saved = process.env.PATH;
    process.env.PATH = HERMETIC_HOST;
    try {
        const result = await runStopRecipe(recipe);
        assert.match(result.text, /spawn bash ENOENT/);
        assert.equal(result.text.split("spawn bash ENOENT").length - 1, 1);
        assert.doesNotMatch(result.text, /unrecognized output/);
        bounded(result);
    } finally {
        if (saved === undefined) delete process.env.PATH;
        else process.env.PATH = saved;
    }
});

test("real suite, skipped and expected TODO records cannot displace a genuine reporter failure", async () => {
    const file = path.join(HERMETIC_HOST, "reporter-mix.test.mjs");
    fs.writeFileSync(file, `import {describe,it} from 'node:test'; import assert from 'node:assert/strict';
describe('compiler error: suite name',()=>{
it('ordinary case',()=>{});
it.skip('compiler error: skip name',()=>{});
it.todo('compiler error: TODO name');
it.todo('compiler error: expected assertion',()=>assert.fail('EXPECTED-TODO-ASSERTION'));
});
if(process.env.TRUE_FAILURE)it('ACTUAL-FAILURE-CONTROL',()=>assert.fail('SPECIFIC-ASSERTION'));
`);
    const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
    for (const reporter of ["tap", "spec"]) {
        const command = `${quote(process.execPath)} --test --test-reporter=${reporter} ${quote(file)}`;
        const passing = await runStopRecipe({ ...recipe, run: `unset NODE_TEST_CONTEXT TRUE_FAILURE; ${command}; exit 1` });
        assert.match(passing.text, /no failure diagnostic identified/);
        assert.doesNotMatch(passing.text, /compiler error|EXPECTED-TODO|unrecognized output/);
        bounded(passing);
        const failing = await runStopRecipe({ ...recipe, run: `unset NODE_TEST_CONTEXT; TRUE_FAILURE=1 ${command}` });
        assert.match(failing.text, /ACTUAL-FAILURE-CONTROL/);
        assert.match(failing.text, /SPECIFIC-ASSERTION/);
        assert.match(failing.text, /reporter-mix\.test\.mjs/);
        assert.doesNotMatch(failing.text, /compiler error|EXPECTED-TODO/);
        bounded(failing);
    }
});

test("reporter metadata prefixes cannot swallow ordinary command errors", async () => {
    for (const line of ["--- error: checksum mismatch", "... error: disk full", "type: compiler error: invalid type", "duration_ms: error: clock failed"]) {
        const result = await runStopRecipe({ ...recipe, run: `printf '%s\\n' '${line}'; exit 1` });
        assert.ok(result.text.includes(line), result.text);
        assert.doesNotMatch(result.text, /no failure diagnostic identified/);
        bounded(result);
    }
});

test("expected TODO diagnostic blocks end before following indented real errors", async () => {
    for (const output of [
        "not ok 1 - expected # TODO\n  ---\n  error: expected assertion\n  ...\n  error: actual command failure\n",
        "⚠ expected # TODO\n  AssertionError: expected assertion {\n  }\n  error: actual command failure\n",
    ]) {
        const result = await relay([output]);
        assert.match(result.text, /error: actual command failure/);
        assert.doesNotMatch(result.text, /expected assertion/);
        bounded(result);
    }
});
