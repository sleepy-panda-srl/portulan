// Tests for the `tools/local-llm` pack's runner — its loopback, input-budget and rollback rails, its eval screen, and its dedup ranking.

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
    assertInputBudget,
    assertLoopback,
    buildPrompt,
    callLocalChat,
    cosine,
    CouldNotRunError,
    DEFAULT_DEDUP_THRESHOLD,
    extractFencedCode,
    FEEDBACK_CHARS,
    formatPassReceipt,
    gradeRoleOutput,
    loadPredicates,
    main,
    parseArgs,
    parseThreshold,
    RailError,
    rankDuplicatePairs,
    readSlot,
    RESTORE_SIGNALS,
    ROLE_MODELS,
    runOfflineVerify,
    runRoleEval,
    stripThinking,
    verifyGatedTransform,
} from "../packs/tools/local-llm/runner/local-llm.mjs";

import { receiptOf } from "./ledger.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNNER = path.join(REPO, "packs", "tools", "local-llm", "runner", "local-llm.mjs");

const SCRATCH = [];
after(() => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});
const scratch = () => {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "portulan-local-llm-test-"));
    SCRATCH.push(dir);
    return dir;
};
const reply = (content, extra = {}) => async () => ({ content, promptTokens: 25, completionTokens: 8, totalMs: 120, tokPerSec: 30, ...extra });

const slot = (files) => {
    const dir = scratch();
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
    return dir;
};

const captured = async (fn) => {
    const out = [];
    const err = [];
    const [log, error] = [console.log, console.error];
    console.log = (...parts) => out.push(parts.join(" "));
    console.error = (...parts) => err.push(parts.join(" "));
    try {
        return { code: await fn(), out, err };
    } finally {
        [console.log, console.error] = [log, error];
    }
};

const listening = () => RESTORE_SIGNALS.map((signal) => process.listenerCount(signal));

const waitFor = async (predicate, what, ms = 10_000) => {
    const deadline = Date.now() + ms;
    while (!predicate()) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
};

const alive = (pid) => {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
};

test("assertLoopback permits 127.0.0.1, localhost, and [::1], and refuses remote hosts unless --allow-remote is set", () => {
    assert.equal(assertLoopback("http://127.0.0.1:1234/v1/"), "http://127.0.0.1:1234/v1");
    assert.equal(assertLoopback("http://localhost:11434/v1"), "http://localhost:11434/v1");
    assert.equal(assertLoopback("http://[::1]:1234/v1"), "http://[::1]:1234/v1");
    assert.throws(() => assertLoopback("https://api.example.com/v1"), RailError);
    assert.throws(() => assertLoopback("http://127.0.0.1@api.example.com/v1"), RailError);
    assert.equal(assertLoopback("https://api.example.com/v1", { allowRemote: true }), "https://api.example.com/v1");
    assert.throws(() => assertLoopback("not-a-url"), CouldNotRunError);
});

test("assertInputBudget enforces the byte ceiling before any request is sent", () => {
    assert.equal(assertInputBudget("hello", { maxInputBytes: 10 }), 5);
    assert.throws(() => assertInputBudget("01234567890", { maxInputBytes: 10 }), RailError);
});

test("stripThinking and extractFencedCode isolate code from reasoning blocks, leading whitespace included", () => {
    const raw = "\n<think>\nLet me analyze the code...\n</think>\n```js\nexport const a = 42;\n```";
    assert.equal(stripThinking(raw), "```js\nexport const a = 42;\n```");
    assert.equal(extractFencedCode(raw).trim(), "export const a = 42;");
});

describe("verifyGatedTransform", () => {
    test("applies a green edit and rolls back byte-for-byte on a red verify", async () => {
        const target = path.join(scratch(), "mod.mjs");
        fs.writeFileSync(target, "export const a = 1;\nexport const b = 2;\n");

        const green = await verifyGatedTransform({
            filePath: target,
            lineRange: "1-1",
            instruction: "set a to 10",
            verifyCmd: "true",
            chatFn: reply("```js\nexport const a = 10;\n```"),
            execFn: () => ({ status: 0, stdout: "", stderr: "" }),
        });
        assert.equal(green.ok, true);
        assert.equal(fs.readFileSync(target, "utf8"), "export const a = 10;\nexport const b = 2;\n");

        const red = await verifyGatedTransform({
            filePath: target,
            instruction: "break the file",
            verifyCmd: "false",
            retries: 1,
            chatFn: reply("```js\nSYNTAX ERROR\n```"),
            execFn: () => ({ status: 1, stdout: "SyntaxError", stderr: "" }),
        });
        assert.equal(red.ok, false);
        assert.equal(red.attempts, 2);
        assert.equal(fs.readFileSync(target, "utf8"), "export const a = 10;\nexport const b = 2;\n");
    });

    test("a whole-file edit keeps the file's final newline, and its absence", async () => {
        for (const [initial, expected] of [
            ["export const x = 1;\n", "export const x = 2;\n"],
            ["export const x = 1;", "export const x = 2;"],
        ]) {
            const target = path.join(scratch(), "whole.mjs");
            fs.writeFileSync(target, initial);
            const res = await verifyGatedTransform({
                filePath: target,
                instruction: "set x to 2",
                verifyCmd: "true",
                chatFn: reply("```js\nexport const x = 2;\n```"),
                execFn: () => ({ status: 0 }),
            });
            assert.equal(res.ok, true);
            assert.equal(fs.readFileSync(target, "utf8"), expected);
        }
    });

    test("is refused without a verify command, and the file is untouched", async () => {
        const target = path.join(scratch(), "unverified.mjs");
        fs.writeFileSync(target, "export const x = 1;\n");
        let asked = 0;
        await assert.rejects(
            verifyGatedTransform({ filePath: target, instruction: "x", chatFn: async () => ((asked += 1), { content: "y" }) }),
            CouldNotRunError,
        );
        assert.equal(asked, 0);
        assert.equal(fs.readFileSync(target, "utf8"), "export const x = 1;\n");
    });

    test("refuses a file that is not valid UTF-8, since a rewrite would change bytes it never touched", async () => {
        const target = path.join(scratch(), "latin1.txt");
        const bytes = Buffer.from([0x61, 0xe9, 0x0a, 0x62, 0x0a]);
        fs.writeFileSync(target, bytes);
        await assert.rejects(
            verifyGatedTransform({ filePath: target, lineRange: "2-2", instruction: "x", verifyCmd: "true", chatFn: reply("c") }),
            CouldNotRunError,
        );
        assert.deepEqual(fs.readFileSync(target), bytes);
    });

    for (const [label, check] of [
        ["exit 127 (command not found)", { status: 127, stdout: "", stderr: "verify: not found" }],
        ["exit 2 (could not run)", { status: 2, stdout: "", stderr: "could not run" }],
        ["a signal", { status: null, signal: "SIGKILL", stdout: "", stderr: "" }],
        ["a spawn failure", { status: null, error: new Error("spawnSync /bin/sh ENOBUFS"), stdout: "", stderr: "" }],
    ]) {
        test(`a verify ending in ${label} is could-not-run: restored at once, never retried`, async () => {
            const target = path.join(scratch(), "unjudged.mjs");
            fs.writeFileSync(target, "export const x = 1;\n");
            let asked = 0;
            await assert.rejects(
                verifyGatedTransform({
                    filePath: target,
                    instruction: "set x to 2",
                    verifyCmd: "verify",
                    retries: 3,
                    chatFn: async () => ((asked += 1), { content: "```js\nexport const x = 2;\n```" }),
                    execFn: () => check,
                }),
                CouldNotRunError,
            );
            assert.equal(asked, 1);
            assert.equal(fs.readFileSync(target, "utf8"), "export const x = 1;\n");
        });
    }

    test("the retry is fed the END of the verify output, where a runner reports its failures", async () => {
        const target = path.join(scratch(), "feedback.mjs");
        fs.writeFileSync(target, "export const x = 1;\n");
        const output = `${"ok 1 - passing\n".repeat(400)}not ok 401 - the failure that matters`;
        const prompts = [];
        await verifyGatedTransform({
            filePath: target,
            instruction: "set x to 2",
            verifyCmd: "verify",
            retries: 1,
            chatFn: async ({ messages }) => (prompts.push(messages[1].content), { content: "```\nx\n```" }),
            execFn: () => ({ status: 1, stdout: output, stderr: "" }),
        });
        assert.equal(prompts.length, 2);
        assert.match(prompts[1], /not ok 401 - the failure that matters/);
        assert.ok(prompts[1].length < targetPromptCeiling(prompts[0]));
    });

    test("SIGTERM in the middle of a transform restores the file and exits 2", async () => {
        const dir = scratch();
        const target = path.join(dir, "interrupted.mjs");
        const original = "export const x = 1;\n";
        fs.writeFileSync(target, original);
        const script = `
            import { verifyGatedTransform } from ${JSON.stringify(pathToFileURL(RUNNER).href)};
            let calls = 0;
            await verifyGatedTransform({
                filePath: ${JSON.stringify(target)},
                instruction: "set x to 2",
                verifyCmd: "verify",
                execFn: () => ({ status: 1, stdout: "red", stderr: "" }),
                chatFn: async () => {
                    calls += 1;
                    if (calls === 1) return { content: "\`\`\`js\\nexport const x = 2;\\n\`\`\`" };
                    process.stdout.write("ready\\n");
                    return new Promise((resolve) => setTimeout(resolve, 60_000));
                },
            });
        `;
        const child = spawn(process.execPath, ["--input-type=module", "-e", script], { stdio: ["ignore", "pipe", "pipe"] });
        await new Promise((resolve, reject) => {
            child.stdout.on("data", (chunk) => {
                if (String(chunk).includes("ready")) resolve();
            });
            child.on("exit", (code) => reject(new Error(`child exited ${code} before it was ready`)));
        });
        assert.equal(fs.readFileSync(target, "utf8"), "export const x = 2;\n", "the drill must interrupt a modified file");
        const exited = new Promise((resolve) => child.on("exit", (code) => resolve(code)));
        child.kill("SIGTERM");
        assert.equal(await exited, 2);
        assert.equal(fs.readFileSync(target, "utf8"), original);
    });

    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
        test(`${signal} while the verify command runs stops it, even one ignoring SIGTERM, restores the file and exits 2 at once`, async () => {
            const dir = scratch();
            const target = path.join(dir, "verifying.mjs");
            const pidFile = path.join(dir, "verify.pid");
            const original = "export const x = 1;\n";
            fs.writeFileSync(target, original);
            const verify = `trap '' TERM; echo $$ > ${JSON.stringify(pidFile)} && exec sleep 20`;
            const script = `
                import { verifyGatedTransform } from ${JSON.stringify(pathToFileURL(RUNNER).href)};
                await verifyGatedTransform({
                    filePath: ${JSON.stringify(target)},
                    instruction: "set x to 2",
                    verifyCmd: ${JSON.stringify(verify)},
                    chatFn: async () => ({ content: "\`\`\`js\\nexport const x = 2;\\n\`\`\`" }),
                });
            `;
            const child = spawn(process.execPath, ["--input-type=module", "-e", script], { stdio: "ignore" });
            const exited = new Promise((resolve) => child.on("exit", (code) => resolve(code)));
            await waitFor(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, "utf8").trim() !== "", "the verify to start");
            const verifyPid = Number(fs.readFileSync(pidFile, "utf8"));
            assert.equal(fs.readFileSync(target, "utf8"), "export const x = 2;\n", "the drill must interrupt a modified file");

            const sent = Date.now();
            child.kill(signal);
            assert.equal(await exited, 2);
            assert.ok(Date.now() - sent < 5_000, "the signal must not wait for the verify to finish");
            assert.equal(fs.readFileSync(target, "utf8"), original);
            await waitFor(() => !alive(verifyPid), "the verify command to be stopped", 3_000);
        });
    }

    test("every exit leaves no signal listener behind, a failed restore included", async () => {
        const before = listening();
        const target = path.join(scratch(), "listeners.mjs");
        fs.writeFileSync(target, "export const x = 1;\n");
        const edit = reply("```js\nexport const x = 2;\n```");

        await verifyGatedTransform({ filePath: target, instruction: "x", verifyCmd: "v", chatFn: edit, execFn: () => ({ status: 0 }) });
        assert.deepEqual(listening(), before, "after a green");
        await verifyGatedTransform({ filePath: target, instruction: "x", verifyCmd: "v", retries: 0, chatFn: edit, execFn: () => ({ status: 1, stdout: "red" }) });
        assert.deepEqual(listening(), before, "after a red");
        await assert.rejects(
            verifyGatedTransform({ filePath: target, instruction: "x", verifyCmd: "v", chatFn: edit, execFn: () => ({ status: 127 }) }),
            CouldNotRunError,
        );
        assert.deepEqual(listening(), before, "after a could-not-run");

        try {
            await assert.rejects(
                verifyGatedTransform({
                    filePath: target,
                    instruction: "x",
                    verifyCmd: "v",
                    retries: 0,
                    chatFn: edit,
                    execFn: () => (fs.chmodSync(target, 0o444), { status: 1, stdout: "red" }),
                }),
                /Could not restore/,
            );
        } finally {
            fs.chmodSync(target, 0o644);
        }
        assert.deepEqual(listening(), before, "after a restore that failed");
    });

    test("a transform's receipt totals time and tokens over every attempt", async () => {
        const target = path.join(scratch(), "receipt.mjs");
        fs.writeFileSync(target, "export const x = 1;\n");
        let attempt = 0;
        const res = await verifyGatedTransform({
            filePath: target,
            instruction: "x",
            verifyCmd: "v",
            chatFn: async () => ({ content: "```\nexport const x = 2;\n```", promptTokens: 10, completionTokens: 30, totalMs: 1000 }),
            execFn: () => ((attempt += 1), { status: attempt === 1 ? 1 : 0, stdout: "red" }),
        });
        assert.equal(res.ok, true);
        assert.match(res.receipt, / attempts=2 in=20t out=60t time=2000ms rate=30tok\/s /);
    });
});

const targetPromptCeiling = (firstPrompt) => firstPrompt.length + FEEDBACK_CHARS + 400;

test("a receipt marks what the server did not report as unmeasured, never as zero", async () => {
    const res = await callLocalChat({
        messages: [{ role: "user", content: "hi" }],
        fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }] })),
    });
    assert.equal(res.promptTokens, null);
    assert.equal(res.completionTokens, null);
    const receipt = formatPassReceipt({ mode: "chat", model: "m", ...res });
    assert.match(receipt, / in=\? out=\? time=\d+ms rate=\? spend=\$0\.00$/);
    assert.doesNotMatch(receipt, /ttft/);
    assert.equal(receipt.includes("\n"), false);
});

test("a loopback endpoint that redirects is refused, and nothing reaches the redirect's target", async () => {
    let reached = 0;
    const elsewhere = http.createServer((req, res) => ((reached += 1), res.end("{}")));
    const redirector = http.createServer((req, res) => {
        res.writeHead(307, { Location: `http://127.0.0.1:${elsewhere.address().port}${req.url}` });
        res.end();
    });
    const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    await listen(elsewhere);
    await listen(redirector);
    try {
        const baseUrl = `http://127.0.0.1:${redirector.address().port}/v1`;
        await assert.rejects(callLocalChat({ baseUrl, messages: [{ role: "user", content: "secret" }] }), CouldNotRunError);
        assert.equal(await main(["status", "--base-url", baseUrl]), 2);
        assert.equal(await main(["dedup", "--dir", slot({ "a.md": "one", "b.md": "two" }), "--base-url", baseUrl]), 2);
        assert.equal(reached, 0);
    } finally {
        redirector.close();
        elsewhere.close();
    }
});

const recordingServer = async () => {
    const bodies = [];
    const server = http.createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            bodies.push(JSON.parse(body));
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ choices: [{ message: { content: "```js\nexport const a = 2;\n```" } }] }));
        });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
    const sent = [];
    const fetchImpl = (url, init) => {
        sent.push(String(url));
        if (!String(url).startsWith(baseUrl)) throw new Error(`left the recording server for ${url}`);
        return fetch(url, init);
    };
    const run = async (expected, ...argv) => {
        const before = bodies.length;
        assert.equal(await main(argv, { fetchImpl }), expected, argv.join(" "));
        return bodies.slice(before);
    };
    return { baseUrl, sent, run, close: () => server.close() };
};

test("a refused endpoint or prompt sends nothing, and every chat-completions request names the effort it was given", async () => {
    const { baseUrl, sent, run, close } = await recordingServer();
    const file = () => {
        const target = path.join(scratch(), "mod.mjs");
        fs.writeFileSync(target, "export const a = 1;\n");
        return target;
    };
    const named = (bodies, effort, count) => {
        assert.equal(bodies.length, count);
        for (const body of bodies) {
            assert.equal(body.reasoning_effort, effort);
            assert.deepEqual(body.chat_template_kwargs, { enable_thinking: effort !== "low", reasoning_effort: effort });
        }
    };
    try {
        await run(1, "chat", "--base-url", "https://api.example.com/v1", "--prompt", "hi");
        await run(1, "chat", "--base-url", baseUrl, "--max-input-bytes", "4", "--prompt", "hello");
        assert.deepEqual(sent, []);

        for (const effort of ["low", "high"]) {
            const given = effort === "low" ? [] : ["--effort", effort];
            named(await run(0, "chat", "--base-url", baseUrl, ...given, "--prompt", "hi"), effort, 1);
            named(await run(0, "summarize", "--base-url", baseUrl, ...given, "--prompt", "hi"), effort, 1);
            named(await run(0, "transform", "--base-url", baseUrl, ...given, "--file", file(), "--verify", "true", "--prompt", "set a"), effort, 1);
            named(await run(1, "eval", "--base-url", baseUrl, ...given), effort, 3);
        }
    } finally {
        close();
    }
});

test("through main, a transform exits 0 keeping a green edit with one receipt line, and 1 or 2 leaving a red or unjudged one byte-identical", async () => {
    const { baseUrl, run, close } = await recordingServer();
    const target = path.join(scratch(), "mod.mjs");
    const original = Buffer.from("export const a = 1;\n// kept as it was\n");
    const transform = (expected, verify) =>
        run(expected, "transform", "--base-url", baseUrl, "--file", target, "--verify", verify, "--retries", "0", "--prompt", "set a");
    try {
        for (const [verify, expected] of [
            ["exit 1", 1],
            ["exit 3", 2],
        ]) {
            fs.writeFileSync(target, original);
            assert.equal((await transform(expected, verify)).length, 1, verify);
            assert.deepEqual(fs.readFileSync(target), original, verify);
        }
        fs.writeFileSync(target, original);
        const printed = [];
        const log = console.log;
        console.log = (...parts) => printed.push(parts.join(" "));
        try {
            await transform(0, "exit 0");
        } finally {
            console.log = log;
        }
        assert.equal(fs.readFileSync(target, "utf8"), "export const a = 2;\n");
        assert.equal(printed.length, 1);
        assert.match(printed[0], /^OK mode=transform model=\S+ target=mod\.mjs attempts=1 [^\n]* spend=\$0\.00$/);
    } finally {
        close();
    }
});

describe("arguments", () => {
    test("a malformed count is could-not-run rather than a disabled rail", () => {
        for (const argv of [
            ["chat", "--max-input-bytes", "32k"],
            ["chat", "--max-input-bytes", "0"],
            ["transform", "--retries", "two"],
            ["chat", "--base-url"],
            ["chat", "--promt", "typo"],
            ["chat", "--role", "embed"],
            ["dedup", "--threshold", "high"],
            ["dedup", "--threshold", "1.5"],
        ]) {
            assert.throws(() => parseArgs(argv), CouldNotRunError, JSON.stringify(argv));
        }
        assert.deepEqual(parseArgs(["chat", "--max-input-bytes", "4096", "--retries", "0"]), {
            _: ["chat"],
            maxInputBytes: 4096,
            retries: 0,
        });
    });

    test("main answers a refused argument with exit 2", async () => {
        assert.equal(await main(["chat", "--max-input-bytes", "32k", "--prompt", "hi"]), 2);
    });

    test("--lines selects a span of --file for chat and summarize, as the budget refusal advises", () => {
        const file = path.join(scratch(), "span.md");
        fs.writeFileSync(file, "one\ntwo\nthree\nfour\n");
        assert.equal(buildPrompt({ _: ["chat"], prompt: "Summarize", file, lines: "2-3" }), "Summarize\n\n```\ntwo\nthree\n```");
        assert.throws(() => buildPrompt({ _: ["chat"], prompt: "x", lines: "1-2" }), CouldNotRunError);
    });
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
        handoff:
            "## Did\nBranch `claude/spend-ledger` shipped `0038` in `cli/ledger.mjs` and `cli/advisory.mjs` (`ef91a02`, `85k`).\n## Open\n`m13` routing.\n## Next\nRun A/B.",
    };

    const results = await runRoleEval({
        model: "google/gemma-4-31b",
        tasks: ["code", "codify", "handoff"],
        chatFn: async ({ messages }) => {
            const prompt = messages[1].content;
            const key = prompt.includes("summarizeRun") ? "code" : prompt.includes("Provenance") ? "codify" : "handoff";
            return { content: fixtures[key], totalMs: 1200, tokPerSec: 50 };
        },
    });
    assert.equal(results.length, 3);
    assert.equal(results.every((r) => r.ok), true, JSON.stringify(results));

    assert.equal(gradeRoleOutput("handoff", "x".repeat(805)).ok, false);
    const predicates = await loadPredicates();
    assert.equal(gradeRoleOutput("code", "```js\n// added 2026-10-27 for #546\nexport function summarizeRun() {}\n```", predicates).ok, false);
    assert.throws(() => gradeRoleOutput("code", fixtures.code), CouldNotRunError);
});

test("loadPredicates turns a missing cli/ into could-not-run", async () => {
    await assert.rejects(
        loadPredicates(async () => {
            throw new Error("Cannot find module");
        }),
        CouldNotRunError,
    );
});

test("from a payload that carries packs/ without cli/, the offline rails still run and eval is could-not-run", () => {
    const root = scratch();
    const copy = path.join(root, "packs", "tools", "local-llm", "runner", "local-llm.mjs");
    fs.mkdirSync(path.dirname(copy), { recursive: true });
    fs.copyFileSync(RUNNER, copy);

    const offline = spawnSync(process.execPath, [copy, "--verify-offline"], { encoding: "utf8" });
    assert.equal(offline.status, 0, offline.stderr);
    assert.match(offline.stdout, /6\/6 offline rails held/);

    const graded = spawnSync(process.execPath, [copy, "eval"], { encoding: "utf8" });
    assert.equal(graded.status, 2, graded.stderr);
    assert.match(graded.stderr, /cli\/ predicates/);
});

test("runOfflineVerify exits 0 and formatPassReceipt stays on one line", async () => {
    const res = await runOfflineVerify();
    assert.equal(res.status, 0, res.message);
    const receipt = formatPassReceipt({ mode: "chat", model: "qwen/qwen3.8-27b", promptTokens: 50, completionTokens: 20, totalMs: 200, tokPerSec: 25 });
    assert.equal(receipt.includes("\n"), false);
});

describe("dedup", () => {
    test("cosine is 1, 0 and -1 for parallel, orthogonal and opposite vectors at any finite scale, 0 for a zero vector, and refuses unequal lengths", () => {
        assert.equal(cosine([1, 2, 3], [2, 4, 6]), 1);
        assert.equal(cosine([1, 0], [0, 5]), 0);
        assert.equal(cosine([-2, 0], [1, 0]), -1);
        assert.equal(cosine([1, 1], [-1, -1]), -1);
        assert.equal(cosine([3, 4], [1, 0]), 0.6);
        assert.equal(cosine([0, 0, 0], [1, 2, 3]), 0);
        assert.equal(cosine([0, 0], [0, 0]), 0);
        assert.throws(() => cosine([1, 2], [1, 2, 3]), CouldNotRunError);
        assert.equal(cosine([1e-200], [1e-200]), 1);
        assert.equal(cosine([1e200], [1]), 1);
        assert.equal(cosine([1e300, 1e300], [-1e-300, -1e-300]), -1);
        assert.equal(cosine([1e200, 0], [0, 1e-200]), 0);
        assert.throws(() => cosine([Infinity, 0], [1, 0]), CouldNotRunError);
    });

    test("pairs rank by descending similarity, the threshold is inclusive, and ties fall back to file names", () => {
        const names = ["a.md", "b.md", "c.md", "d.md"];
        const vectors = [
            [1, 0],
            [3, 4],
            [1, 0],
            [4, 3],
        ];
        assert.deepEqual(rankDuplicatePairs(names, vectors, 0.6), [
            { a: "a.md", b: "c.md", score: 1 },
            { a: "b.md", b: "d.md", score: 0.96 },
            { a: "a.md", b: "d.md", score: 0.8 },
            { a: "c.md", b: "d.md", score: 0.8 },
            { a: "a.md", b: "b.md", score: 0.6 },
            { a: "b.md", b: "c.md", score: 0.6 },
        ]);
        assert.deepEqual(
            rankDuplicatePairs(names, vectors, 0.8).map((p) => p.score),
            [1, 0.96, 0.8, 0.8],
        );
        assert.deepEqual(
            rankDuplicatePairs(names, vectors, 0.8000001).map((p) => p.score),
            [1, 0.96],
        );
        assert.deepEqual(rankDuplicatePairs(names, vectors, 1).length, 1);
        assert.equal(DEFAULT_DEDUP_THRESHOLD, 0.8);
    });

    test("a zero vector ranks at 0, never NaN, and a count or length mismatch is could-not-run", () => {
        const ranked = rankDuplicatePairs(["a.md", "b.md", "z.md"], [[1, 0], [1, 0], [0, 0]], -1);
        assert.deepEqual(ranked.map((p) => [p.a, p.b, p.score]), [
            ["a.md", "b.md", 1],
            ["a.md", "z.md", 0],
            ["b.md", "z.md", 0],
        ]);
        assert.equal(rankDuplicatePairs(["a.md", "z.md"], [[1, 0], [0, 0]], 0.8).length, 0);
        assert.throws(() => rankDuplicatePairs(["a.md", "b.md"], [[1, 0]], 0.8), CouldNotRunError);
        assert.throws(() => rankDuplicatePairs(["a.md", "b.md"], [[1, 0], [1, 0, 0]], 0.8), CouldNotRunError);
    });

    test("a threshold is a plain number from -1 to 1, and anything else is refused rather than read as the default", async () => {
        for (const [spec, value] of [
            ["0.8", 0.8],
            ["1", 1],
            ["-1", -1],
            [".5", 0.5],
            ["0", 0],
        ]) {
            assert.equal(parseThreshold(spec), value, spec);
        }
        for (const spec of ["1.5", "-1.01", "high", "", "NaN", "Infinity", "0.8x", "1e-1", "0x1"]) {
            assert.throws(() => parseThreshold(spec), CouldNotRunError, spec);
        }
        assert.equal(await main(["dedup", "--dir", ".", "--threshold", "2"]), 2);
    });

    test("a slot is its Markdown files in name order, its README, other files and subdirectories left out", () => {
        const dir = slot({ "b.md": "bee", "README.md": "index", "a.md": "ay", "C.MD": "sea", "notes.txt": "skip" });
        fs.mkdirSync(path.join(dir, "nested.md"));
        assert.deepEqual(readSlot(dir), { names: ["C.MD", "a.md", "b.md"], texts: ["sea", "ay", "bee"] });
        assert.throws(() => readSlot(slot({ "a.md": "alone", "readme.md": "index" })), CouldNotRunError);
        assert.throws(() => readSlot(path.join(dir, "missing")), CouldNotRunError);
    });

    test("an off-loopback endpoint and a file over the per-file ceiling, measured before and after it is read, are refused with exit 1 before any request, and --role with exit 2", async () => {
        const sent = [];
        const fetchImpl = async (url) => {
            sent.push(String(url));
            throw new Error("reached the network");
        };
        const dir = slot({ "a.md": "short", "b.md": "x".repeat(64) });
        assert.equal(await main(["dedup", "--dir", dir, "--base-url", "https://api.example.com/v1"], { fetchImpl }), 1);
        const over = await captured(() => main(["dedup", "--dir", dir, "--base-url", "http://127.0.0.1:1/v1", "--max-input-bytes", "32"], { fetchImpl }));
        assert.equal(over.code, 1);
        assert.match(over.err.join("\n"), /Refused 1 file\(s\) over the 32-byte per-file ceiling: b\.md \(64 bytes\)\./);

        const huge = slot({ "a.md": "short" });
        fs.closeSync(fs.openSync(path.join(huge, "huge.md"), "w"));
        fs.truncateSync(path.join(huge, "huge.md"), 600 * 2 ** 20);
        const unread = await captured(() => main(["dedup", "--dir", huge, "--base-url", "http://127.0.0.1:1/v1"], { fetchImpl }));
        assert.equal(unread.code, 1, unread.err.join("\n"));
        assert.match(unread.err.join("\n"), /huge\.md \(629145600 bytes\)/);

        const decoded = slot({ "a.md": "short", "b.md": Buffer.alloc(20, 0xff) });
        const grown = await captured(() => main(["dedup", "--dir", decoded, "--base-url", "http://127.0.0.1:1/v1", "--max-input-bytes", "32"], { fetchImpl }));
        assert.equal(grown.code, 1);
        assert.match(grown.err.join("\n"), /b\.md \(60 bytes\)/);

        assert.equal(await main(["dedup", "--dir", dir, "--base-url", "http://127.0.0.1:1/v1", "--role", "code"], { fetchImpl }), 2);
        assert.deepEqual(sent, []);
    });

    test("a server error or an embedding response that cannot be ranked is could-not-run", async () => {
        const dir = slot({ "a.md": "one", "b.md": "two" });
        const answering = (status, body) => async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
        const vector = (embedding, index) => ({ embedding, index });
        for (const [label, fetchImpl] of [
            ["HTTP 500", answering(500, "boom")],
            ["not JSON", answering(200, "<html>")],
            ["no data", answering(200, {})],
            ["one embedding for two files", answering(200, { data: [vector([1, 0], 0)] })],
            ["a non-number", answering(200, { data: [vector([1, null], 0), vector([1, 0], 1)] })],
            ["an empty vector", answering(200, { data: [vector([], 0), vector([], 1)] })],
            ["unequal lengths", answering(200, { data: [vector([1, 0], 0), vector([1, 0, 0], 1)] })],
            ["a repeated index", answering(200, { data: [vector([1, 0], 0), vector([1, 0], 0)] })],
        ]) {
            assert.equal(await main(["dedup", "--dir", dir, "--base-url", "http://127.0.0.1:1/v1"], { fetchImpl }), 2, label);
        }
    });

    test("through main, dedup posts the slot to /v1/embeddings with the embed model and prints each pair over the threshold on one line", async () => {
        const vectors = { alpha: [1, 0, 0], "alpha too": [0.9, 0.1, 0], gamma: [0, 0, 1] };
        const requests = [];
        const server = http.createServer((req, res) => {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", () => {
                const parsed = JSON.parse(body);
                requests.push({ method: req.method, url: req.url, body: parsed });
                const data = parsed.input.map((text, index) => ({ object: "embedding", index, embedding: vectors[text] })).reverse();
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ data, usage: { prompt_tokens: 7 } }));
            });
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
        const dir = slot({ "c.md": "gamma", "b.md": "alpha too", "a.md": "alpha", "README.md": "index" });
        try {
            const ran = await captured(() => main(["dedup", "--dir", dir, "--base-url", baseUrl]));
            assert.equal(ran.code, 0, ran.err.join("\n"));
            assert.deepEqual(requests, [{ method: "POST", url: "/v1/embeddings", body: { model: ROLE_MODELS.embed, input: ["alpha", "alpha too", "gamma"] } }]);
            assert.deepEqual(ran.out, ["0.994 a.md b.md"]);
            assert.equal(ran.err.length, 2);
            assert.equal(ran.err[0], "dedup files=3 pairs=1 threshold=0.8");
            assert.equal(receiptOf(ran.err[0]), null);
            const receipts = ran.err.map(receiptOf).filter((r) => r !== null);
            assert.equal(receipts.length, 1, "exactly one canonical receipt is printed");
            assert.deepEqual({ ...receipts[0], time: null }, { mode: "dedup", model: ROLE_MODELS.embed, attempts: 1, in: 7, out: null, time: null });
            assert.match(ran.err[1], /^OK mode=dedup model=\S+ attempts=1 in=7t out=\? time=\d+ms rate=\? spend=\$0\.00$/);

            const none = await captured(() => main(["dedup", "--dir", dir, "--base-url", baseUrl, "--threshold", "0.999", "--model", "other-embedder"]));
            assert.equal(none.code, 0);
            assert.deepEqual(none.out, []);
            assert.equal(none.err[0], "dedup files=3 pairs=0 threshold=0.999");
            assert.match(none.err[1], /mode=dedup model=other-embedder attempts=1/);
            assert.equal(requests[1].body.model, "other-embedder");
        } finally {
            server.close();
        }
    });
});
