import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
    assertInputBudget,
    assertLoopback,
    CouldNotRunError,
    extractFencedCode,
    formatPassReceipt,
    gradeRoleOutput,
    RailError,
    runOfflineVerify,
    runRoleEval,
    stripThinking,
    verifyGatedTransform,
} from "./local-llm.mjs";

test("assertLoopback permits 127.0.0.1, localhost, and [::1], and refuses remote hosts unless --allow-remote is set", () => {
    assert.equal(assertLoopback("http://127.0.0.1:1234/v1/"), "http://127.0.0.1:1234/v1");
    assert.equal(assertLoopback("http://localhost:11434/v1"), "http://localhost:11434/v1");
    assert.equal(assertLoopback("http://[::1]:1234/v1"), "http://[::1]:1234/v1");
    assert.throws(() => assertLoopback("https://api.example.com/v1"), RailError);
    assert.equal(assertLoopback("https://api.example.com/v1", { allowRemote: true }), "https://api.example.com/v1");
    assert.throws(() => assertLoopback("not-a-url"), CouldNotRunError);
});

test("assertInputBudget enforces the byte ceiling before any request is sent", () => {
    assert.equal(assertInputBudget("hello", { maxInputBytes: 10 }), 5);
    assert.throws(() => assertInputBudget("01234567890", { maxInputBytes: 10 }), RailError);
});

test("stripThinking and extractFencedCode isolate code from reasoning blocks", () => {
    const raw = "<think>\nLet me analyze the code...\n</think>\n```js\nexport const a = 42;\n```";
    assert.equal(stripThinking(raw), "```js\nexport const a = 42;\n```");
    assert.equal(extractFencedCode(raw).trim(), "export const a = 42;");
});

test("verifyGatedTransform applies a green edit and rolls back byte-for-byte on a red verify", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-local-test-"));
    const target = path.join(tmpDir, "mod.mjs");
    const initial = "export const a = 1;\nexport const b = 2;\n";
    fs.writeFileSync(target, initial, "utf8");

    try {
        const green = await verifyGatedTransform({
            filePath: target,
            lineRange: "1-1",
            instruction: "set a to 10",
            verifyCmd: "true",
            chatFn: async () => ({
                content: "```js\nexport const a = 10;\n```",
                promptTokens: 25,
                completionTokens: 8,
                ttftMs: 120,
                tokPerSec: 30,
            }),
            execFn: () => ({ status: 0, stdout: "", stderr: "" }),
        });
        assert.equal(green.ok, true);
        assert.equal(fs.readFileSync(target, "utf8"), "export const a = 10;\nexport const b = 2;\n");

        const red = await verifyGatedTransform({
            filePath: target,
            instruction: "break the file",
            verifyCmd: "false",
            retries: 1,
            chatFn: async () => ({
                content: "```js\nSYNTAX ERROR\n```",
                promptTokens: 25,
                completionTokens: 8,
                ttftMs: 120,
                tokPerSec: 30,
            }),
            execFn: () => ({ status: 1, stdout: "SyntaxError", stderr: "" }),
        });
        assert.equal(red.ok, false);
        assert.equal(red.attempts, 2);
        assert.equal(fs.readFileSync(target, "utf8"), "export const a = 10;\nexport const b = 2;\n");
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test("gradeRoleOutput and runRoleEval grade code, codify, and handoff outputs with Portulan predicates", async () => {
    const fixtures = {
        code: "```js\nexport function summarizeRun(records) {\n    return { requests: records.length, billableTokens: 0, maxContext: 0 };\n}\n```",
        codify: [
            "**Incident.** Three workspaces loaded the full host floor on 50-line diffs.",
            "",
            "**Proposed rule.** Omit the host floor on bounded local worker calls.",
            "",
            "**Enforcement.** `runner/local-llm.mjs` refuses prompts above `--max-input-bytes`.",
            "",
            "**Provenance.** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/433`.",
            "",
            "**Retire when.** Host subagents natively omit the floor on bounded tasks.",
        ].join("\n"),
        handoff: "## Did\nBranch `claude/spend-ledger` shipped `0038` in `cli/ledger.mjs` and `cli/advisory.mjs` (`ef91a02`, `85k`).\n## Open\n`m13` routing.\n## Next\nRun A/B.",
    };

    const results = await runRoleEval({
        model: "google/gemma-4-31b",
        tasks: ["code", "codify", "handoff"],
        chatFn: async ({ messages }) => {
            const prompt = messages[1].content;
            const key = prompt.includes("summarizeRun") ? "code" : prompt.includes("Provenance") ? "codify" : "handoff";
            return {
                content: fixtures[key],
                promptTokens: 100,
                completionTokens: 60,
                ttftMs: 200,
                totalMs: 1200,
                tokPerSec: 50,
            };
        },
    });
    assert.equal(results.length, 3);
    assert.equal(results.every((r) => r.ok), true);

    const badHandoff = gradeRoleOutput("handoff", "x".repeat(805));
    assert.equal(badHandoff.ok, false);
});

test("runOfflineVerify exits 0 and formatPassReceipt stays on one line", async () => {
    const res = await runOfflineVerify();
    assert.equal(res.status, 0);
    const receipt = formatPassReceipt({ mode: "chat", model: "qwen/qwen3.8-27b", promptTokens: 50, completionTokens: 20, ttftMs: 200, tokPerSec: 25 });
    assert.equal(receipt.includes("\n"), false);
});
