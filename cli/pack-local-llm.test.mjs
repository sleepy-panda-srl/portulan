// Tests for the `tools/local-llm` pack's runner — its loopback, input-budget and rollback rails, its eval screen, dedup ranking and A/B record.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
    AB_RECORD,
    AB_REGISTER,
    AB_TASKS,
    acquireEndpointLock,
    assertInputBudget,
    assertLoopback,
    beginLifecycle,
    buildPrompt,
    callLocalChat,
    cosine,
    CouldNotRunError,
    currentScreen,
    DEFAULT_DEDUP_THRESHOLD,
    endpointLockPath,
    extractFencedCode,
    EARNED_ROUTING,
    operationalModel,
    FEEDBACK_CHARS,
    formatCancelReceipt,
    formatPassReceipt,
    foldAb,
    gradeRoleOutput,
    hostPrompt,
    lifecycleDir,
    loadPredicates,
    main,
    normalizeLifecycleUsage,
    parseArgs,
    publishAb,
    RailError,
    READ_QUESTIONS,
    readLifecycleRecords,
    reconcileLifecycleRecords,
    renderAbRegister,
    resolveInstruction,
    RESTORE_SIGNALS,
    ROLE_MODELS,
    runHostTurn,
    parseThreshold,
    rankDuplicatePairs,
    readSlot,
    runOfflineVerify,
    runRoleEval,
    spliceInsertion,
    stripThinking,
    TASK_ROLES,
    turnSeed,
    usualBlankRun,
    verifyAb,
    verifyAbRecord,
    verifyGatedTransform,
    writeAbRegister,
} from "../packs/tools/local-llm/runner/local-llm.mjs";

import { receiptOf } from "./ledger.mjs";
import { deriveRouting, verifyRoutingRecord } from "./local-routing.mjs";

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
    assert.match(receipt, / in=\? out=\? time=\d+ms rate=\? reasoning=\? cached-in=\? max-tokens=4096 spend=\$0\.00$/);
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

const recordingServer = async ({ onRequest = () => {} } = {}) => {
    const bodies = [];
    const server = http.createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            bodies.push(JSON.parse(body));
            onRequest(bodies.length);
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
            const given = ["--model", "explicit-candidate", ...(effort === "low" ? [] : ["--effort", effort])];
            named(await run(0, "chat", "--base-url", baseUrl, ...given, "--prompt", "hi"), effort, 1);
            named(await run(0, "summarize", "--base-url", baseUrl, ...given, "--prompt", "hi"), effort, 1);
            named(await run(0, "transform", "--base-url", baseUrl, ...given, "--file", file(), "--verify", "true", "--prompt", "set a"), effort, 1);
            named(await run(1, "eval", "--base-url", baseUrl, ...given), effort, 3 + READ_QUESTIONS.length);
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

    test("--help and transform missing-flag usage name the same flags including --role, --model and --effort", async () => {
        const help = await captured(() => main(["--help"]));
        assert.equal(help.code, 0);
        const helpOutput = help.out.join("\n");
        const helpTransformLine = helpOutput.split("\n").find((l) => l.trim().startsWith("local-llm.mjs transform "));
        assert.ok(helpTransformLine, "missing transform line in --help");
        assert.match(helpOutput, /transform defaults to --role code at --effort low/);

        const missing = await captured(() => main(["transform"]));
        assert.equal(missing.code, 2);
        const errTransformLine = missing.err.join("\n").split("\n").find((l) => l.startsWith("Usage: local-llm.mjs transform "));
        assert.ok(errTransformLine, "missing Usage line on missing flags");

        const flagsOf = (line) => [...new Set(line.match(/--[a-z-]+/g) ?? [])].sort();
        const helpFlags = flagsOf(helpTransformLine);
        const errFlags = flagsOf(errTransformLine);
        assert.deepEqual(helpFlags, errFlags);
        for (const required of ["--role", "--model", "--effort", "--prompt-file"]) {
            assert.ok(helpFlags.includes(required), `missing ${required}`);
        }
    });
});

describe("--prompt-file, --context, --insert-after and endpoint locking", () => {
    test("transform --prompt-file sends file bytes unchanged and stdin - works; combining with --prompt exits 2", async () => {
        const dir = scratch();
        const promptFile = path.join(dir, "prompt.txt");
        const exactPrompt = "Replace '\\\"$HOME\"' and (char)47 verbatim.\nLine 2 with $DOLLAR and `backticks`.";
        fs.writeFileSync(promptFile, exactPrompt);
        const target = path.join(dir, "Sample.cs");
        fs.writeFileSync(target, "export const a = 1;\n");

        const { baseUrl, run, close } = await recordingServer();
        try {
            const bodies = await run(
                0,
                "transform",
                "--base-url",
                baseUrl,
                "--file",
                target,
                "--verify",
                "true",
                "--prompt-file",
                promptFile,
            );
            assert.equal(bodies.length, 1);
            assert.ok(bodies[0].messages[1].content.startsWith(`Instruction: ${exactPrompt}\n\n`));

            await run(2, "transform", "--base-url", baseUrl, "--file", target, "--verify", "true", "--prompt", "hi", "--prompt-file", promptFile);
            await run(2, "chat", "--base-url", baseUrl, "--prompt", "hi", "--prompt-file", promptFile);
            const missingFlag = await captured(() => main(["transform", "--file", target, "--verify", "true"]));
            assert.equal(missingFlag.code, 2);
            assert.match(missingFlag.err.join("\n"), /--prompt-file/);
            const help = await captured(() => main(["--help"]));
            assert.equal(help.code, 0);
            assert.match(help.out.join("\n"), /--prompt-file/);
        } finally {
            close();
        }

        assert.equal(resolveInstruction({ promptFile: "-", readFileFn: undefined }, { readStdinFn: () => "from stdin\n$x" }), "from stdin\n$x");
        const stdinTarget = path.join(dir, "stdin.mjs");
        fs.writeFileSync(stdinTarget, "export const a = 1;\n");
        const stdinFail = spawnSync(
            process.execPath,
            [RUNNER, "transform", "--base-url", "https://api.example.com/v1", "--file", stdinTarget, "--verify", "true", "--prompt-file", "-"],
            { input: "stdin spec $HOME '\\\"x\\\"", encoding: "utf8" },
        );
        assert.equal(stdinFail.status, 1);
        assert.match(stdinFail.stderr, /Refused non-loopback endpoint/);
    });

    test("--context and --context-file send read-only slices, keep outside lines byte-identical, and count against --max-input-bytes", async () => {
        const dir = scratch();
        const target = path.join(dir, "worker.mjs");
        const helper = path.join(dir, "helper.mjs");
        const initial = "export function sig(a, b) {\n    return a + b;\n}\nexport function target() {\n    return 1;\n}\n";
        fs.writeFileSync(target, initial);
        fs.writeFileSync(helper, "export const FACTOR = 10;\nexport const UNUSED = 99;\n");

        const { baseUrl, sent, run, close } = await recordingServer();
        try {
            const bodies = await run(
                0,
                "transform",
                "--base-url",
                baseUrl,
                "--file",
                target,
                "--lines",
                "4-6",
                "--context",
                "1-3",
                "--context-file",
                `${helper}:1-1`,
                "--verify",
                "true",
                "--prompt",
                "update target",
            );
            assert.equal(bodies.length, 1);
            const promptText = bodies[0].messages[1].content;
            assert.match(promptText, /Reference context \(read-only, do NOT return these lines — worker\.mjs lines 1-3\):\n```\nexport function sig\(a, b\) \{\n    return a \+ b;\n\}\n```/);
            assert.match(promptText, /Reference context \(read-only, do NOT return these lines — helper\.mjs lines 1-1\):\n```\nexport const FACTOR = 10;\n```/);
            assert.doesNotMatch(promptText, /UNUSED/);
            assert.equal(
                fs.readFileSync(target, "utf8"),
                "export function sig(a, b) {\n    return a + b;\n}\nexport const a = 2;\n",
            );

            const sentBefore = sent.length;
            await run(
                1,
                "transform",
                "--base-url",
                baseUrl,
                "--file",
                target,
                "--lines",
                "4-4",
                "--context",
                "1-3",
                "--max-input-bytes",
                "120",
                "--verify",
                "true",
                "--prompt",
                "update",
            );
            assert.equal(sent.length, sentBefore);
            await run(2, "chat", "--base-url", baseUrl, "--context", "1-2", "--prompt", "hi");
        } finally {
            close();
        }
    });

    test("--insert-after and --insert-before keep original non-blank lines identical and enforce seam blank lines", async () => {
        const dir = scratch();
        const pyFile = path.join(dir, "sample.py");
        fs.writeFileSync(pyFile, "def first():\n    return 1\n\n\ndef second():\n    return 2\n");
        assert.equal(usualBlankRun(fs.readFileSync(pyFile, "utf8").split("\n")), 2);

        const prompts = [];
        const res = await verifyGatedTransform({
            filePath: pyFile,
            insertAfter: 2,
            instruction: "add middle()",
            verifyCmd: "true",
            chatFn: async ({ messages }) => {
                prompts.push(messages);
                return { content: "```python\n\n\ndef middle():\n    return 42\n\n\n```", promptTokens: 20, completionTokens: 10, totalMs: 50 };
            },
            execFn: () => ({ status: 0, stdout: "", stderr: "" }),
        });
        assert.equal(res.ok, true);
        assert.match(prompts[0][0].content, /Never repeat existing anchor lines/);
        assert.match(prompts[0][1].content, /Insertion point: immediately after line 2/);
        assert.equal(
            fs.readFileSync(pyFile, "utf8"),
            "def first():\n    return 1\n\n\ndef middle():\n    return 42\n\n\ndef second():\n    return 2\n",
        );

        const custom = spliceInsertion(["a", "", "b"], 1, "\n\n    x\n\n", 1);
        assert.deepEqual(custom, ["a", "", "    x", "", "b"]);
        assert.deepEqual(spliceInsertion(["a", "", "b"], 1, "\n\nx\n\n", 0), ["a", "x", "b"]);
        assert.deepEqual(spliceInsertion(["a", "b"], 0, "\n\ntop\n\n", 2), ["top", "", "", "a", "b"]);

        const jsFile = path.join(dir, "mod.mjs");
        const initialJs = "const a = 1;\n\nconst c = 3;\n";
        fs.writeFileSync(jsFile, initialJs);
        const beforeRes = await verifyGatedTransform({
            filePath: jsFile,
            insertBefore: 3,
            seamBlankLines: 1,
            instruction: "add b",
            verifyCmd: "true",
            chatFn: async () => ({ content: "\nconst b = 2;\n\n", promptTokens: 10, completionTokens: 5, totalMs: 20 }),
            execFn: () => ({ status: 0 }),
        });
        assert.equal(beforeRes.ok, true);
        assert.equal(fs.readFileSync(jsFile, "utf8"), "const a = 1;\n\nconst b = 2;\n\nconst c = 3;\n");

        const parsed = parseArgs(["transform", "--file", jsFile, "--verify", "true", "--prompt", "x", "--insert-after", "2", "--seam-blank-lines", "0"]);
        assert.equal(parsed.insertAfter, 2);
        assert.equal(parsed.seamBlankLines, 0);
        assert.equal(await main(["transform", "--file", jsFile, "--verify", "true", "--prompt", "x", "--lines", "1-1", "--insert-after", "1"]), 2);
        assert.equal(await main(["transform", "--file", jsFile, "--verify", "true", "--prompt", "x", "--seam-blank-lines", "1"]), 2);
        assert.equal(await main(["chat", "--insert-after", "1", "--prompt", "x"]), 2);
    });

    test("concurrent runner processes serialise per endpoint, exclude queue wait from deadline, recover dead locks, and allow --no-lock", { timeout: 60_000 }, async () => {
        const lockDir = scratch();
        let active = 0;
        let maxConcurrent = 0;
        const timeline = [];
        const children = new Set();
        let firstArrived, releaseFirst, releaseParallel, parallelArrived;
        const firstRequest = new Promise((resolve) => (firstArrived = resolve));
        const firstGate = new Promise((resolve) => (releaseFirst = resolve));
        const parallelRequests = new Promise((resolve) => (parallelArrived = resolve));
        const parallelGate = new Promise((resolve) => (releaseParallel = resolve));
        let parallel = false;
        let parallelCount = 0;
        const bounded = async (promise, label) => {
            let timer;
            try {
                return await Promise.race([promise, new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), 20_000);
                })]);
            } finally {
                clearTimeout(timer);
            }
        };
        const server = http.createServer((req, res) => {
            active += 1;
            maxConcurrent = Math.max(maxConcurrent, active);
            const id = timeline.length + 1;
            const started = Date.now();
            const respond = () => setTimeout(() => {
                active -= 1;
                timeline.push({ id, started, ended: Date.now() });
                res.setHeader("Content-Type", "application/json");
                res.end(
                    JSON.stringify({
                        choices: [{ finish_reason: "stop", message: { content: "```js\nexport const x = 2;\n```" } }],
                        usage: { prompt_tokens: 10, completion_tokens: 5 },
                    }),
                );
            }, 140);
            if (timeline.length === 0 && active === 1 && !parallel) {
                firstArrived();
                firstGate.then(respond);
            } else if (parallel) {
                if (++parallelCount === 2) parallelArrived();
                parallelGate.then(respond);
            } else respond();
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
        const runCli = (extra = [], onStderr = () => {}) =>
            new Promise((resolve, reject) => {
                const child = spawn(
                    process.execPath,
                    [RUNNER, "chat", "--base-url", baseUrl, "--prompt", "hi", ...extra],
                    { env: { ...process.env, PORTULAN_LOCAL_LLM_LOCK_DIR: lockDir }, stdio: ["ignore", "pipe", "pipe"] },
                );
                children.add(child);
                let stdout = "";
                let stderr = "";
                child.stdout.setEncoding("utf8").on("data", (c) => (stdout += c));
                child.stderr.setEncoding("utf8").on("data", (c) => { stderr += c; onStderr(stderr); });
                child.on("error", reject);
                child.on("close", (status) => { children.delete(child); resolve({ status, stdout, stderr }); });
            });
        try {
            const first = runCli();
            await bounded(Promise.race([firstRequest, first.then(() => { throw new Error("First runner exited before its request"); })]), "first request");
            let queued;
            const waiterQueued = new Promise((resolve) => (queued = resolve));
            const second = runCli(["--progress"], (stderr) => {
                if ((stderr.match(/phase=queued/g) ?? []).length >= 2) queued();
            });
            await bounded(Promise.race([waiterQueued, second.then(() => { throw new Error("Waiter exited before queuing"); })]), "queued waiter heartbeat");
            releaseFirst();
            const [r1, r2] = await Promise.all([first, second]);
            assert.equal(r1.status, 0, r1.stderr);
            assert.equal(r2.status, 0, r2.stderr);
            assert.equal(maxConcurrent, 1);
            assert.equal(timeline.length, 2);
            assert.ok(timeline[1].started >= timeline[0].ended - 5, JSON.stringify(timeline));
            assert.doesNotMatch(r1.stderr, /queued=/);
            assert.match(r2.stderr, /waited \d+ms for endpoint lock/);
            assert.match(r2.stderr, / queued=\d+ms max-tokens=4096 spend=\$0\.00$/m);
            const r2ReceiptLine = r2.stderr.trim().split("\n").find((l) => l.startsWith("OK "));
            const parsed = receiptOf(r2ReceiptLine);
            const queueMs = Number(/ queued=(\d+)ms/.exec(r2ReceiptLine)?.[1]);
            assert.ok(parsed && parsed.time >= 100 && parsed.time < queueMs, r2ReceiptLine);

            const lockFile = endpointLockPath(baseUrl.replace("127.0.0.1", "localhost"), lockDir);
            fs.writeFileSync(lockFile, JSON.stringify({ pid: 99999999, startedAt: Date.now() - 10_000, endpoint: baseUrl }));
            const recovered = await runCli();
            assert.equal(recovered.status, 0, recovered.stderr);
            assert.equal(fs.existsSync(lockFile), false);

            maxConcurrent = 0;
            parallel = true;
            const parallelRuns = [runCli(["--no-lock"]), runCli(["--no-lock"])];
            await bounded(Promise.race([parallelRequests, ...parallelRuns.map((run) => run.then(() => { throw new Error("Parallel runner exited before overlap"); }))]), "parallel requests");
            releaseParallel();
            const [p1, p2] = await Promise.all(parallelRuns);
            assert.equal(p1.status, 0);
            assert.equal(p2.status, 0);
            assert.equal(maxConcurrent, 2);
        } finally {
            releaseFirst();
            releaseParallel();
            for (const child of children) child.kill("SIGKILL");
            server.closeAllConnections();
            server.close();
        }

        const beforeListeners = listening();
        const lockOnly = await acquireEndpointLock("http://127.0.0.1:43210/v1", { lockDir });
        lockOnly.release();
        assert.deepEqual(listening(), beforeListeners);
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
    assert.match(offline.stdout, /7\/7 offline rails held/);

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

describe("the A/B record", () => {
    const FIXTURE = path.join(REPO, "cli", "fixtures", "local-worker");
    const GENERATOR = path.join(REPO, "cli", "fixtures", "generate-local-worker.mjs");
    const fixtureRecord = () => JSON.parse(fs.readFileSync(path.join(FIXTURE, "local-worker.json"), "utf8"));
    const fixtureRegister = () => fs.readFileSync(path.join(FIXTURE, "local-worker.md"), "utf8");

    const repoWith = ({ record = fixtureRecord(), register = fixtureRegister() } = {}) => {
        const root = scratch();
        fs.mkdirSync(path.join(root, "evals", "ab"), { recursive: true });
        if (record !== null) fs.writeFileSync(path.join(root, AB_RECORD), typeof record === "string" ? record : `${JSON.stringify(record, null, 2)}\n`);
        if (register !== null) fs.writeFileSync(path.join(root, AB_REGISTER), register);
        return root;
    };
    const viaMain = (root) => main(["eval", "--verify", "--repo-root", root]);
    // The fixture is reached through the injected option, which `main` never passes.
    const verifyExit = async (root) => {
        try {
            await verifyAbRecord(root, { allowFixture: true });
            return 0;
        } catch (err) {
            if (err instanceof RailError) return 1;
            if (err instanceof CouldNotRunError) return 2;
            throw err;
        }
    };
    const unfixtured = () => {
        const rec = fixtureRecord();
        delete rec.fixture;
        return rec;
    };
    const grading = async () => ({ predicates: await loadPredicates(), screen: currentScreen() });

    const PASSING = {
        code: "```js\nexport function summarizeRun(records) {\n    return { requests: records.length, billableTokens: 0, maxContext: 0 };\n}\n```",
        codify: "**Incident.** x\n\n**Proposed rule.** x\n\n**Enforcement.** x\n\n**Provenance.** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/433`.\n\n**Retire when.** x",
        handoff: "## Did\n`claude/spend-ledger` `0038` `cli/ledger.mjs` `cli/advisory.mjs` `ef91a02` `85k` `m13`\n## Open\nx\n## Next\nx",
    };

    // A committed git repository, and an executable fake host that logs every prompt it is given and answers it passing.
    // With `interruptAt`, the fake host sends SIGTERM to the runner on that prompt call while a `<log>.interrupt` file exists.
    const capturable = ({ interruptAt = null } = {}) => {
        const root = scratch();
        const git = (...argv) => {
            const r = spawnSync("git", ["-c", "user.email=fixture@example.invalid", "-c", "user.name=fixture", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...argv], { cwd: root, encoding: "utf8" });
            assert.equal(r.status, 0, r.stderr);
            return r.stdout.trim();
        };
        git("init", "-q");
        fs.writeFileSync(path.join(root, "README.md"), "fixture\n");
        git("add", "README.md");
        git("commit", "-q", "-m", "fixture");
        const tools = scratch();
        const log = path.join(tools, "host.log");
        const host = path.join(tools, "fake-host.mjs");
        fs.writeFileSync(
            host,
            [
                `#!${process.execPath}`,
                'import fs from "node:fs";',
                `const log = ${JSON.stringify(log)};`,
                'if (process.argv.includes("--version")) { fs.appendFileSync(log + ".version", JSON.stringify(process.argv.slice(2)) + "\\n"); console.log("9.9.9 (fake host)"); process.exit(0); }',
                'fs.appendFileSync(log, JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }) + "\\n");',
                `if (${JSON.stringify(interruptAt)} !== null && fs.existsSync(log + ".interrupt") && fs.readFileSync(log, "utf8").trim().split("\\n").length === ${JSON.stringify(interruptAt)}) {`,
                '    process.kill(process.ppid, "SIGTERM");',
                "    setTimeout(() => {}, 60000);",
                "} else {",
                `    const passing = ${JSON.stringify(PASSING)};`,
                "    const prompt = process.argv.at(-1);",
                '    process.stdout.write(prompt.includes("summarizeRun") ? passing.code : prompt.includes("Provenance") ? passing.codify : passing.handoff);',
                "}",
            ].join("\n"),
        );
        fs.chmodSync(host, 0o755);
        if (interruptAt !== null) fs.writeFileSync(`${log}.interrupt`, "");
        const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []);
        const journal = path.join(root, ".git", "portulan", "local-worker-journal");
        return { root, head: git("rev-parse", "HEAD"), host, log, calls, journal };
    };
    const abArgs = ({ root, host }, baseUrl, seed = "s1") => ["eval", "--ab", "--k", "5", "--write", "--seed", seed, "--host-cmd", `${host} --print`, "--host-model", "fake/host-model", "--base-url", baseUrl, "--repo-root", root];

    test("the fixture capture regenerates byte for byte from its generator, and says it is synthetic", () => {
        const out = scratch();
        const r = spawnSync(process.execPath, [GENERATOR, out], { encoding: "utf8", env: { ...process.env, PORTULAN_LOCAL_LLM_URL: "http://localhost:9/v1" } });
        assert.equal(r.status, 0, r.stderr);
        for (const name of ["local-worker.json", "local-worker.md"]) {
            assert.equal(fs.readFileSync(path.join(out, "local-worker", name), "utf8"), fs.readFileSync(path.join(FIXTURE, name), "utf8"), name);
        }
        assert.match(fixtureRegister(), /^> \*\*SYNTHETIC FIXTURE: not a record of any run\.\*\*/m);
        const real = fixtureRecord();
        delete real.fixture;
        assert.doesNotMatch(renderAbRegister(real), /SYNTHETIC FIXTURE/);
    });

    test("the fixture's cells are its generator's plan, and both arms are graded by the screen's own predicates", async () => {
        const rec = fixtureRecord();
        assert.deepEqual(
            rec.cells.map((c) => [c.task, c.arm, c.passed, c.failed, c.didNotComplete]),
            [
                ["code", "l", 4, 1, 0],
                ["code", "h", 5, 0, 0],
                ["codify", "l", 3, 2, 0],
                ["codify", "h", 4, 0, 1],
                ["handoff", "l", 4, 1, 0],
                ["handoff", "h", 4, 0, 1],
            ],
        );
        const predicates = await loadPredicates();
        for (const t of rec.turns.filter((turn) => turn.completed)) {
            const { ok, detail } = gradeRoleOutput(t.task, t.output, predicates);
            assert.deepEqual({ ok, detail }, { ok: t.ok, detail: t.detail }, `(${t.task}, ${t.arm}, ${t.run})`);
        }
        assert.match(rec.machine, /synthetic/);
        assert.match(fixtureRegister(), /\*\*Arm L 11\/15, arm H 13\/15 — a difference of -2, recorded as measured\.\*\*/);
        assert.match(fixtureRegister(), /`k = 5` per cell supports a recorded rate and nothing else/);
    });

    test("eval --verify is green on the fixture, could-not-run with no record, and red on every drift", async () => {
        assert.equal(await verifyExit(repoWith()), 0);
        assert.match(await verifyAbRecord(repoWith(), { allowFixture: true }), /predicate files changed since capture, and every verdict regrades the same/);
        assert.equal(await verifyExit(repoWith({ record: null, register: null })), 2);
        assert.equal(await verifyExit(repoWith({ record: null })), 2);
        assert.equal(await verifyExit(repoWith({ register: null })), 1);
        assert.equal(await verifyExit(repoWith({ register: `${fixtureRegister()} ` })), 1);
        assert.equal(await verifyExit(repoWith({ register: fixtureRegister().replace("**4**/5", "**5**/5") })), 1);
        assert.equal(await verifyExit(repoWith({ record: "{ not json" })), 1);

        // The register is re-rendered from the drifted record, so each case reds on its own check rather than on the byte-compare.
        const drifted = (edit) => {
            const rec = fixtureRecord();
            edit(rec);
            let register;
            try {
                register = renderAbRegister(rec);
            } catch {
                register = fixtureRegister();
            }
            return repoWith({ record: rec, register });
        };
        const firstFail = (rec) => rec.turns.find((t) => t.ok === false);
        assert.equal(await verifyExit(drifted((rec) => (firstFail(rec).ok = true))), 1, "a flipped verdict no longer folds to its cell");
        const forged = (rec) => {
            firstFail(rec).ok = true;
            rec.cells = foldAb(rec.turns, rec.k);
        };
        assert.equal(await verifyExit(drifted(forged)), 1, "a forged verdict, its cells re-folded and its register re-rendered");
        assert.equal(await verifyExit(drifted((rec) => rec.turns.pop())), 1, "a missing turn");
        assert.equal(await verifyExit(drifted((rec) => (rec.turns[1] = { ...rec.turns[0] }))), 1, "a turn standing in for another");
        assert.equal(await verifyExit(drifted((rec) => (rec.turns[0].seed += 1))), 1, "a seed the record's seed does not derive");
        assert.equal(
            await verifyExit(
                drifted((rec) => {
                    for (const t of rec.turns.filter((turn) => turn.task === "code" && turn.arm === "l")) t.model = "other/model";
                    rec.cells = foldAb(rec.turns, rec.k);
                }),
            ),
            1,
            "a cell naming a model arm L does not route its task to",
        );
        assert.equal(await verifyExit(drifted((rec) => (rec.arms.l.endpoint = "https://api.example.com/v1"))), 1, "arm L off loopback");
        assert.equal(await verifyExit(drifted((rec) => (rec.arms.h.version = ""))), 1, "no host version");
        assert.equal(await verifyExit(drifted((rec) => rec.turns.forEach((t) => delete t.output))), 1, "turns nobody can regrade");
        assert.equal(await verifyExit(drifted((rec) => (rec.screen.prompts = "f".repeat(64)))), 1, "prompts that moved since capture");
        assert.equal(await verifyExit(drifted((rec) => delete rec.screen)), 1, "no screen fingerprint");
        assert.equal(
            await verifyExit(
                drifted((rec) => {
                    rec.k = 4;
                    rec.turns = rec.turns.filter((t) => t.run < 4);
                    rec.cells = foldAb(rec.turns, 4);
                }),
            ),
            1,
            "a whole record at another k",
        );
        assert.equal(await verifyExit(drifted((rec) => Object.assign(rec.turns.find((t) => t.timedOut), { timedOut: false, exit: 0 }))), 1, "did-not-complete against its own exit 0");
    });

    test("a regraded verdict that moved is red, and says whether the predicates moved or the record was forged", async () => {
        const now = await grading();
        const rec = fixtureRecord();
        assert.deepEqual(verifyAb(rec, now), []);
        rec.turns.find((t) => t.ok === false).ok = true;
        rec.cells = foldAb(rec.turns, rec.k);
        const moved = verifyAb(rec, now);
        assert.equal(moved.length, 1);
        assert.match(moved[0], /records pass `comments=1 history=1 exported=true` where its output regrades fail .*the predicates moved since capture/);

        rec.screen.predicates = now.screen.predicates;
        const forged = verifyAb(rec, now);
        assert.equal(forged.length, 1);
        assert.match(forged[0], /a recorded verdict does not match its output/);
    });

    test("eval --verify and eval --write cannot regrade without cli/, and say so with exit 2", async () => {
        const payload = scratch();
        const copy = path.join(payload, "packs", "tools", "local-llm", "runner", "local-llm.mjs");
        fs.mkdirSync(path.dirname(copy), { recursive: true });
        fs.copyFileSync(RUNNER, copy);
        for (const mode of ["--verify", "--write"]) {
            const r = spawnSync(process.execPath, [copy, "eval", mode, "--repo-root", repoWith({ record: unfixtured() })], { encoding: "utf8" });
            assert.equal(r.status, 2, r.stderr);
            assert.match(r.stderr, /cli\/ predicates/);
        }
    });

    test("a synthetic fixture at the real record path is refused by eval --verify and eval --write, exit 1", async () => {
        for (const mode of ["--verify", "--write"]) {
            const root = repoWith({ register: mode === "--write" ? null : fixtureRegister() });
            const r = spawnSync(process.execPath, [RUNNER, "eval", mode, "--repo-root", root], { encoding: "utf8" });
            assert.equal(r.status, 1, r.stderr);
            assert.match(r.stderr, /a synthetic fixture is not a capture/);
            if (mode === "--write") assert.equal(fs.existsSync(path.join(root, AB_REGISTER)), false);
        }
        assert.equal(await viaMain(repoWith({ record: unfixtured(), register: renderAbRegister(unfixtured()) })), 0, "the same turns without the fixture field verify");
    });

    test("eval --write re-renders the fixture's register, and refuses a record --verify would red", async () => {
        const root = repoWith({ register: null });
        assert.match(await writeAbRegister(root, { allowFixture: true }), /wrote/);
        assert.equal(fs.readFileSync(path.join(root, AB_REGISTER), "utf8"), fixtureRegister());

        const rec = fixtureRecord();
        rec.turns.find((t) => t.ok === false).ok = true;
        rec.cells = foldAb(rec.turns, rec.k);
        const red = repoWith({ record: rec, register: null });
        await assert.rejects(writeAbRegister(red, { allowFixture: true }), RailError);
        assert.equal(fs.existsSync(path.join(red, AB_REGISTER)), false);
    });

    test("eval --ab refuses without --host-cmd, exit 1, naming the paid off-machine run, and contacts nothing", async () => {
        const root = scratch();
        const r = spawnSync(process.execPath, [RUNNER, "eval", "--ab", "--k", "5", "--write", "--seed", "s", "--host-model", "m", "--repo-root", root], { encoding: "utf8" });
        assert.equal(r.status, 1, r.stderr);
        assert.match(r.stderr, /PAID run of 15 host calls whose prompts leave this machine/);
        assert.match(r.stderr, /--host-cmd/);
        assert.deepEqual(fs.readdirSync(root), []);

        const help = spawnSync(process.execPath, [RUNNER, "--help"], { encoding: "utf8" });
        assert.equal(help.status, 0);
        assert.match(help.stdout, /Routing evidence: evals\/ab\/local-worker.md/);
        assert.match(help.stdout, /PAID calls whose prompts LEAVE THIS MACHINE/);
    });

    test("a refused argument is exit 2 before any request or host call", async () => {
        const fixture = capturable();
        const { baseUrl, sent, run, close } = await recordingServer();
        try {
            await run(1, "eval", "--ab", "--write", "--seed", "s", "--host-model", "m", "--base-url", baseUrl, "--repo-root", fixture.root);
            const ab = ["eval", "--ab", "--host-cmd", `${fixture.host} --print`, "--base-url", baseUrl, "--repo-root", fixture.root];
            const complete = ["--write", "--seed", "s", "--host-model", "m"];
            for (const argv of [
                ["--seed", "s", "--host-model", "m"],
                ["--write", "--host-model", "m"],
                ["--write", "--seed", "s"],
                [...complete, "--k", "3"],
                [...complete, "--model", "x"],
                [...complete, "--role", "code"],
                [...complete, "--task", "code"],
                [...complete, "--allow-remote"],
                [...complete, "--effort", "high"],
                [...complete, "--retries", "1"],
            ]) {
                await run(2, ...ab, ...argv);
            }
            for (const bypass of ["--dangerously-skip-permissions", "--permission-mode bypassPermissions"]) {
                await run(2, "eval", "--ab", "--host-cmd", `${fixture.host} --print ${bypass}`, "--base-url", baseUrl, "--repo-root", fixture.root, ...complete);
            }
            await run(2, "eval", "--ab", "--verify", "--repo-root", fixture.root);
            await run(2, "eval", "--host-cmd", "no-such-host", "--base-url", baseUrl);
            await run(2, "eval", "--repo-root", fixture.root, "--base-url", baseUrl);
            await run(2, "eval", "--verify", "--task", "code", "--repo-root", fixture.root);
            await run(2, "eval", "--verify", "extra", "--repo-root", fixture.root);
            await run(2, "eval", "extra", "--base-url", baseUrl);
            await run(2, "chat", "--ab", "--base-url", baseUrl, "--prompt", "hi");
            await run(2, "chat", "--host-cmd", "x", "--base-url", baseUrl, "--prompt", "hi");
            assert.deepEqual(sent, []);
            assert.deepEqual(fixture.calls(), []);
            assert.equal(fs.existsSync(path.join(fixture.root, "evals")), false);
            assert.equal(fs.existsSync(fixture.journal), false);
        } finally {
            close();
        }
    });

    test("a host command that names no version is exit 2 with no request sent", async () => {
        const fixture = capturable();
        const { baseUrl, sent, run, close } = await recordingServer();
        try {
            await run(2, ...abArgs({ ...fixture, host: path.join(scratch(), "no-such-host") }, baseUrl));
            assert.deepEqual(sent, []);
            assert.equal(fs.existsSync(path.join(fixture.root, AB_RECORD)), false);
        } finally {
            close();
        }
    });

    test("a dead local server is exit 2 before the host is given any prompt, and writes no record", async () => {
        const fixture = capturable();
        const dead = http.createServer();
        await new Promise((resolve) => dead.listen(0, "127.0.0.1", resolve));
        const baseUrl = `http://127.0.0.1:${dead.address().port}/v1`;
        await new Promise((resolve) => dead.close(resolve));
        assert.equal(await main(abArgs(fixture, baseUrl)), 2);
        assert.deepEqual(fixture.calls(), []);
        assert.equal(fs.existsSync(path.join(fixture.root, AB_RECORD)), false);
    });

    test("publication refuses an existing record without changing it or its register", async () => {
        const root = repoWith();
        const before = [AB_RECORD, AB_REGISTER].map((name) => fs.readFileSync(path.join(root, name)));
        assert.throws(() => publishAb(root, fixtureRecord(), {}), CouldNotRunError);
        for (const [i, name] of [AB_RECORD, AB_REGISTER].entries()) assert.deepEqual(fs.readFileSync(path.join(root, name)), before[i]);
    });

    test("a record appearing during CLI capture is preserved and leaves the journal for recovery", async () => {
        const fixture = capturable();
        const prior = ["an earlier irreproducible capture\n", "its existing register\n"];
        const { baseUrl, run, close } = await recordingServer({ onRequest: (n) => {
            if (n !== 15) return;
            fs.mkdirSync(path.join(fixture.root, path.dirname(AB_RECORD)), { recursive: true });
            for (const [i, name] of [AB_RECORD, AB_REGISTER].entries()) fs.writeFileSync(path.join(fixture.root, name), prior[i]);
        } });
        try {
            assert.equal((await run(2, ...abArgs(fixture, baseUrl))).length, 15);
        } finally {
            close();
        }
        for (const [i, name] of [AB_RECORD, AB_REGISTER].entries()) assert.equal(fs.readFileSync(path.join(fixture.root, name), "utf8"), prior[i]);
        assert.equal(fs.readdirSync(fixture.journal).length, 31, "conditions and all30 completed turns remain recoverable");
        assert.equal(fixture.calls().length, 15, "only the fake host was invoked");
    });

    test("unruled k values fail promptly before verification or rendering work", () => {
        for (const k of [4, 1_000_000_000]) {
            for (const mode of ["--verify", "--write"]) {
                const rec = unfixtured();
                rec.k = k;
                const root = repoWith({ record: rec });
                const before = fs.readFileSync(path.join(root, AB_REGISTER));
                const child = spawnSync(process.execPath, ["--max-old-space-size=64", RUNNER, "eval", mode, "--repo-root", root], { encoding: "utf8", timeout: 2000, maxBuffer: 64 * 1024 });
                assert.equal(child.status, 1, child.stderr || child.error?.message);
                assert.match(child.stderr, /the maintainer ruled 5/);
                assert.deepEqual(fs.readFileSync(path.join(root, AB_REGISTER)), before);
            }
        }
    });

    test("resuming pins the loaded runner bytes even with identical dirty-tree conditions", async () => {
        const dir = scratch();
        const source = fs.readFileSync(RUNNER, "utf8");
        const textA = source.replace("maxTokens = 4096", "maxTokens = 2048");
        const textB = source.replace("maxTokens = 4096", "maxTokens = 1024");
        assert.notEqual(textA, textB);
        const fileA = path.join(dir, "runner-a.mjs");
        const fileB = path.join(dir, "runner-b.mjs");
        fs.writeFileSync(fileA, textA);
        fs.writeFileSync(fileB, textB);
        const a = await import(pathToFileURL(fileA));
        const b = await import(pathToFileURL(fileB));
        const { predicates, screen } = await grading();
        const journal = path.join(dir, "journal");
        const conditions = { commit: "a".repeat(40), clean: false, machine: "synthetic", hostVersion: "fake", captured: "2000-01-01T00:00:00.000Z", runner: "caller cannot choose this" };
        const caps = [];
        const fetchImpl = async (_url, init) => {
            caps.push(JSON.parse(init.body).max_tokens);
            return new Response(JSON.stringify({ choices: [{ message: { content: "synthetic" } }] }));
        };
        const options = { seed: "s", hostCommand: ["fake-host"], hostModel: "fake/model", baseUrl: "http://127.0.0.1:1234/v1", conditions, screen, journal, predicates,
            hostFn: async () => ({ completed: true, exit: 0, timedOut: false, ms: 1, output: "synthetic" }) };
        let taken = 0;
        await assert.rejects(a.captureAb({ ...options, chatFn: (o) => a.callLocalChat({ ...o, fetchImpl }), onTurn: () => { if (++taken === 2) throw new Error("synthetic interruption"); } }), /synthetic interruption/);
        assert.deepEqual(caps, [2048, 2048]);
        const before = fs.readdirSync(journal).sort().map((name) => [name, fs.readFileSync(path.join(journal, name), "utf8")]);
        await assert.rejects(b.captureAb({ ...options, chatFn: (o) => b.callLocalChat({ ...o, fetchImpl }) }), /other conditions.*runner/);
        assert.deepEqual(caps, [2048, 2048], "changed runner is rejected before a model request");
        assert.deepEqual(fs.readdirSync(journal).sort().map((name) => [name, fs.readFileSync(path.join(journal, name), "utf8")]), before);
        const resumed = await a.captureAb({ ...options, chatFn: (o) => a.callLocalChat({ ...o, fetchImpl }) });
        assert.equal(resumed.turns.length, 30);
        assert.equal(caps.length, 15, "the same runner reuses its first two local turns");
        assert.ok(caps.every((cap) => cap === 2048));
        assert.equal(resumed.source.runner, createHash("sha256").update(textA).digest("hex"));
    });

    test("eval --ab --write captures both arms through a recording server and a fake host, and its record verifies", async () => {
        const fixture = capturable();
        const { baseUrl, run, close } = await recordingServer();
        let bodies;
        try {
            bodies = await run(0, ...abArgs(fixture, baseUrl));
            await run(2, ...abArgs(fixture, baseUrl));
        } finally {
            close();
        }
        assert.equal(bodies.length, 15);
        let i = 0;
        for (const task of AB_TASKS) {
            for (let r = 0; r < 5; r += 1, i += 1) {
                assert.equal(bodies[i].reasoning_effort, "low");
                assert.equal(bodies[i].seed, turnSeed("s1", task, r));
                assert.equal(bodies[i].model, ROLE_MODELS[TASK_ROLES[task]]);
            }
        }
        const calls = fixture.calls();
        assert.equal(calls.length, 15, "the second capture was refused before any host call: a record is captured once");
        assert.deepEqual(calls.map((c) => c.args), AB_TASKS.flatMap((task) => Array(5).fill(["--print", hostPrompt(task)])));
        for (const c of calls) {
            assert.notEqual(c.cwd, fixture.root);
            assert.equal(fs.existsSync(c.cwd), false);
        }

        const rec = JSON.parse(fs.readFileSync(path.join(fixture.root, AB_RECORD), "utf8"));
        assert.equal(rec.source.commit, fixture.head);
        assert.equal(rec.source.clean, true);
        assert.equal(rec.arms.h.version, "9.9.9 (fake host)");
        assert.equal(fs.readFileSync(`${fixture.log}.version`, "utf8"), '["--print","--version"]\n', "the version is the whole host command's, run once");
        assert.deepEqual(rec.arms.h.command, [fixture.host, "--print"]);
        assert.deepEqual(rec.screen, currentScreen());
        assert.deepEqual(rec.cells.map((c) => `${c.task}/${c.arm}=${c.passed}`), ["code/l=0", "code/h=5", "codify/l=0", "codify/h=5", "handoff/l=0", "handoff/h=5"]);
        assert.equal(fs.existsSync(fixture.journal), false, "the journal is removed once the record is written");
        assert.equal(await viaMain(fixture.root), 0);
    });

    test("a capture interrupted in arm H keeps its turns in the journal, refuses other conditions, and resumes without re-running one", async () => {
        const fixture = capturable({ interruptAt: 3 });
        const { baseUrl, run, close } = await recordingServer();
        try {
            const child = spawn(process.execPath, [RUNNER, ...abArgs(fixture, baseUrl)], { stdio: ["ignore", "pipe", "pipe"] });
            let stderr = "";
            child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
            const [status] = await new Promise((resolve) => child.on("close", (...exit) => resolve(exit)));
            assert.equal(status, 2, stderr);
            assert.match(stderr, /Interrupted by SIGTERM; 17 turn\(s\) kept in .*local-worker-journal/);
            const journalled = fs.readdirSync(fixture.journal).sort();
            assert.equal(journalled.length, 18);
            assert.equal(journalled.filter((name) => name.includes("__h__")).length, 2);
            assert.equal(fs.existsSync(path.join(fixture.root, AB_RECORD)), false);
            assert.equal(fixture.calls().length, 3);
            assert.equal(fs.existsSync(fixture.calls()[2].cwd), false, "the interrupted turn's directory is removed");

            fs.rmSync(`${fixture.log}.interrupt`);
            assert.deepEqual(await run(2, ...abArgs(fixture, baseUrl, "another-seed")), []);
            assert.equal(fs.readdirSync(fixture.journal).length, 18, "a journal of other conditions is refused and left alone");

            assert.deepEqual(await run(0, ...abArgs(fixture, baseUrl)), [], "arm L is resumed from the journal, not re-run");
        } finally {
            close();
        }
        const calls = fixture.calls();
        assert.equal(calls.length, 3 + 13, "only the turn that was interrupted, and the ones never taken, reach the host");
        assert.deepEqual(calls.slice(3).map((c) => c.args.at(-1)), [hostPrompt("code"), hostPrompt("code"), hostPrompt("code"), ...Array(5).fill(hostPrompt("codify")), ...Array(5).fill(hostPrompt("handoff"))]);
        assert.equal(fs.existsSync(fixture.journal), false);
        assert.equal(await viaMain(fixture.root), 0);
    });

    test("runHostTurn runs in an empty directory it removes, and tells a failed turn from an unspawnable or overflowing one", async () => {
        const echo = await runHostTurn({ command: [process.execPath, "-e", "process.stdout.write(JSON.stringify([process.cwd(), require('fs').readdirSync('.'), process.argv.at(-1)]))"], prompt: "the prompt" });
        assert.equal(echo.completed, true);
        assert.equal(echo.exit, 0);
        const [cwd, entries, prompt] = JSON.parse(echo.output);
        assert.deepEqual(entries, []);
        assert.equal(prompt, "the prompt");
        assert.equal(fs.existsSync(cwd), false);

        const red = await runHostTurn({ command: [process.execPath, "-e", "process.exit(3)"], prompt: "p" });
        assert.deepEqual([red.completed, red.exit, red.timedOut], [false, 3, false]);
        const slow = await runHostTurn({ command: [process.execPath, "-e", "setTimeout(() => {}, 10000)"], prompt: "p", timeoutMs: 200 });
        assert.deepEqual([slow.completed, slow.exit, slow.timedOut], [false, null, true]);
        await assert.rejects(runHostTurn({ command: [path.join(scratch(), "no-such-host")], prompt: "p" }), CouldNotRunError);
        await assert.rejects(runHostTurn({ command: [process.execPath, "-e", "process.stdout.write('x'.repeat(4096))"], prompt: "p", maxOutputBytes: 1024 }), /more than 1024 bytes/);
    });
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
            assert.match(ran.err[1], /^OK mode=dedup model=\S+ attempts=1 in=7t out=\? time=\d+ms rate=\? reasoning=\? cached-in=\? spend=\$0\.00$/);

            const none = await captured(() => main(["dedup", "--dir", dir, "--base-url", baseUrl, "--threshold", "0.999", "--model", "other-embedder"]));
            assert.equal(none.code, 0);
            assert.deepEqual(none.out, []);
            assert.equal(none.err[0], "dedup files=3 pairs=0 threshold=0.999");
            assert.match(none.err[1], /mode=dedup model=other-embedder attempts=1/);
            assert.equal(requests[1].body.model, "other-embedder");
        } finally {
            server.closeAllConnections?.();
            server.close();
        }
    });
});

describe("acquired local routing", () => {
    const acquired = () => JSON.parse(fs.readFileSync(path.join(REPO, AB_RECORD), "utf8"));
    test("rederives code support and withholds shared prose without changing historical task routing", async () => {
        assert.deepEqual(TASK_ROLES, { code: "code", codify: "prose", handoff: "prose" });
        assert.deepEqual(await deriveRouting(acquired()), EARNED_ROUTING.roles);
        const rec = acquired();
        const turn = rec.turns.find((t) => t.task === "code" && t.arm === "h");
        Object.assign(turn, { completed: false, exit: 1, ok: null, detail: null, output: "authentication failed" });
        rec.cells = foldAb(rec.turns, rec.k);
        assert.equal((await deriveRouting(rec)).code.enabled, false, "incomplete H cannot earn a positive local tie");
        rec.turns.pop();
        await assert.rejects(deriveRouting(rec), RailError, "a malformed matrix earns nothing");
    });

    test("the acquired digest, role flags and model IDs are all held", async () => {
        assert.match(await verifyRoutingRecord(REPO), /digest and models match/);
        for (const edit of [
            (r) => { r.sha256 = "0".repeat(64); },
            (r) => { r.roles.prose.enabled = true; },
            (r) => { r.roles.code.enabled = false; },
            (r) => { r.roles.code.model = "unmeasured-model"; },
        ]) {
            const routing = structuredClone(EARNED_ROUTING); edit(routing);
            await assert.rejects(verifyRoutingRecord(REPO, routing), /differs from its acquired record/);
        }
    });

    test("unsupported defaults, explicit roles and overrides refuse before a socket or file change", async () => {
        const target = path.join(scratch(), "mod.mjs");
        fs.writeFileSync(target, "export const a = 1;\n");
        let requests = 0;
        const fetchImpl = async () => { requests++; throw new Error("no socket may open"); };
        for (const args of [
            ["summarize", "--prompt", "digest"],
            ["chat", "--role", "prose", "--prompt", "draft"],
            ["chat", "--role", "prose", "--model", "qwen/qwen3.8-27b", "--prompt", "draft"],
            ["transform", "--role", "prose", "--file", target, "--verify", "true", "--prompt", "rewrite"],
            ["transform", "--role", "code", "--model", "other", "--file", target, "--verify", "true", "--prompt", "rewrite"],
            ["chat", "--effort", "high", "--prompt", "draft"],
        ]) {
            assert.equal((await captured(() => main(args, { fetchImpl }))).code, 1, args.join(" "));
            assert.equal(fs.readFileSync(target, "utf8"), "export const a = 1;\n");
        }
        assert.equal(requests, 0);
        assert.equal(operationalModel({ model: "candidate" }, "prose"), "candidate");
        assert.equal(operationalModel({}, "code"), "qwen/qwen3.8-27b");
        const mismatched = spawnSync(process.execPath, [RUNNER, "chat", "--base-url", "http://127.0.0.1:1/v1", "--prompt", "x"], {
            encoding: "utf8", env: { ...process.env, PORTULAN_LOCAL_CODE_MODEL: "unmeasured" },
        });
        assert.equal(mismatched.status, 1, mismatched.stderr);
        assert.match(mismatched.stderr, /was measured with/);
    });

    test("explicit model-only candidates and packs-only role dispatch remain usable without root records", async () => {
        const root = scratch();
        const copy = path.join(root, "runner.mjs"); fs.copyFileSync(RUNNER, copy);
        const probe = spawnSync(process.execPath, ["--input-type=module", "-e", `
            import assert from 'node:assert/strict';
            import {main} from ${JSON.stringify(pathToFileURL(copy).href)};
            let sent=0;
            const fetchImpl=async (_url,init)=>{sent++;const body=JSON.parse(init.body);assert.equal(body.model,'qwen/qwen3.8-27b');return {ok:true,json:async()=>({choices:[{message:{content:'ok'}}]})};};
            assert.equal(await main(['chat','--prompt','x'],{fetchImpl}),0);
            assert.equal(await main(['summarize','--prompt','x'],{fetchImpl}),1);
            assert.equal(await main(['summarize','--model','qwen/qwen3.8-27b','--prompt','x'],{fetchImpl}),0);
            assert.equal(sent,2);
        `], { encoding: "utf8", env: { ...process.env, PORTULAN_LOCAL_CODE_MODEL: "qwen/qwen3.8-27b" } });
        assert.equal(probe.status, 0, probe.stderr);
    });
});

test("authorized host replacement preserves every acquired local object and failed evidence byte", () => {
    const dir = path.join(REPO, "evals/ab/acquisitions/2026-11-03-auth-failed");
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json")));
    for (const file of ["local-worker.json", "local-worker.md"]) {
        const bytes = fs.readFileSync(path.join(dir, file));
        assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest[file].sha256);
        assert.equal(bytes.length, manifest[file].bytes);
    }
    const failed = JSON.parse(fs.readFileSync(path.join(dir, "local-worker.json")));
    const final = JSON.parse(fs.readFileSync(path.join(REPO, AB_RECORD)));
    assert.equal(fs.readFileSync(path.join(dir, "local-worker.md"), "utf8"), renderAbRegister(failed));
    assert.deepEqual(final.turns.filter((t) => t.arm === "l"), failed.turns.filter((t) => t.arm === "l"));
    assert.deepEqual({ ...final, turns: null, cells: null }, { ...failed, turns: null, cells: null });
    assert.equal(failed.turns.filter((t) => t.arm === "h" && !t.completed && t.output.includes("OAuth session expired")).length, 15);
    assert.equal(final.turns.filter((t) => t.arm === "h" && t.completed && t.exit === 0 && !t.timedOut && t.output.trim()).length, 15);
});

test("each A/B check result survives later greens and every check still runs", () => {
    for (const codes of [[0,0,0],[1,0,0],[2,0,0],[0,1,0],[0,2,0],[1,2,0],[2,1,1],[0,0,1],[0,0,2],[3,0,0],[0,3,0]]) {
        const dir = scratch();
        const calls = path.join(dir, "calls");
        const fake = path.join(dir, "node");
        fs.writeFileSync(fake, `#!/bin/sh
printf '%s\\n' "$1" >> '${calls}'
case "$1" in
cli/ab-run.mjs) exit ${codes[0]} ;;
packs/tools/local-llm/runner/local-llm.mjs) exit ${codes[1]} ;;
cli/local-routing.mjs) exit ${codes[2]} ;;
*) exit 99 ;;
esac
`, { mode: 0o755 });
        const result = spawnSync("bash", [path.join(REPO, ".portulan/verify/ab-run.sh")], { encoding: "utf8", env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}` } });
        const want = codes.some((code) => code !== 0 && code !== 1) ? 2 : codes.includes(1) ? 1 : 0;
        assert.equal(result.status, want, `${codes}: ${result.stderr}`);
        assert.deepEqual(fs.readFileSync(calls, "utf8").trim().split("\n"), ["cli/ab-run.mjs", "packs/tools/local-llm/runner/local-llm.mjs", "cli/local-routing.mjs"]);
    }
});

test("a zero-quality tie earns nothing and both prose tasks must qualify", async () => {
    const record = () => JSON.parse(fs.readFileSync(path.join(REPO, AB_RECORD)));
    const predicates = await loadPredicates();
    const change = (rec, select, output) => {
        for (const t of rec.turns.filter(select)) Object.assign(t, { output }, gradeRoleOutput(t.task, output, predicates));
        rec.cells = foldAb(rec.turns, rec.k);
    };
    const zero = record();
    change(zero, (t) => t.task === "code", "no exported code");
    assert.equal((await deriveRouting(zero)).code.enabled, false);
    const prose = record();
    change(prose, (t) => t.task === "codify" && t.arm === "l", "**Incident.** x\n**Proposed rule.** x\n**Enforcement.** x\n**Provenance.** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/433`.\n**Retire when.** x");
    assert.equal((await deriveRouting(prose)).prose.enabled, true, "counterfactual codify support joins existing handoff support");
    change(prose, (t) => t.task === "handoff" && t.arm === "l" && t.run === 0, "no handoff headings");
    assert.equal((await deriveRouting(prose)).prose.enabled, false, "one failing handoff withholds the whole shared role");
});

describe("transform --preflight, --verify-expect and candidate preservation (#577)", () => {
    test("--preflight refuses an unrunnable verify before calling the model and allows green/red baselines", async () => {
        const dir = scratch();
        const target = path.join(dir, "Sample.cs");
        const before = "public int X() => 1;\n";
        fs.writeFileSync(target, before);

        let modelCalls = 0;
        const countingChat = async () => {
            modelCalls += 1;
            return { content: "```\npublic int X() => 2;\n```", promptTokens: 5, completionTokens: 4, totalMs: 10, tokPerSec: 100 };
        };

        await assert.rejects(
            () => verifyGatedTransform({
                filePath: target,
                instruction: "change X to 2",
                verifyCmd: "missing-verify",
                preflight: true,
                chatFn: countingChat,
                execFn: () => ({ status: 127, stdout: "", stderr: "missing-verify: not found" }),
            }),
            (err) => err instanceof CouldNotRunError && /preflight exited 127/.test(err.message),
        );
        assert.equal(modelCalls, 0, "counting stub proves model was never called on exit 127 preflight");
        assert.equal(fs.readFileSync(target, "utf8"), before);

        for (const baselineStatus of [0, 1]) {
            let phase = 0;
            const res = await verifyGatedTransform({
                filePath: target,
                instruction: "change X to 2",
                verifyCmd: "dotnet test",
                preflight: true,
                chatFn: countingChat,
                execFn: () => ({ status: phase++ === 0 ? baselineStatus : 0, stdout: "Passed: 1\n", stderr: "" }),
            });
            assert.equal(res.ok, true);
            assert.equal(res.preflight, baselineStatus === 0 ? "green" : "red");
            assert.match(res.receipt, new RegExp(`preflight=${baselineStatus === 0 ? "green" : "red"} max-tokens=4096 spend=\\$0\\.00$`));
        }
    });

    test("--verify-expect rejects exit-0 without match, retries on failure, and CLI exits 1 restoring file", async () => {
        const dir = scratch();
        const target = path.join(dir, "Sample.cs");
        const before = "public int X() => 1;\n";
        fs.writeFileSync(target, before);

        let modelCalls = 0;
        await assert.rejects(
            () => verifyGatedTransform({
                filePath: target,
                instruction: "change X",
                verifyCmd: "dotnet test",
                verifyExpect: "[",
                chatFn: async () => { modelCalls += 1; return { content: "```\nx\n```" }; },
            }),
            (err) => err instanceof CouldNotRunError && /Invalid --verify-expect/.test(err.message),
        );
        assert.equal(modelCalls, 0);

        const prompts = [];
        let execCalls = 0;
        const retried = await verifyGatedTransform({
            filePath: target,
            instruction: "change X",
            verifyCmd: "dotnet test",
            verifyExpect: "Passed:\\s*[1-9]",
            retries: 1,
            chatFn: async ({ messages }) => {
                prompts.push(messages[1].content);
                return { content: "```\npublic int X() => 2;\n```", promptTokens: 5, completionTokens: 5, totalMs: 10, tokPerSec: 50 };
            },
            execFn: () => ({ status: 0, stdout: ++execCalls === 1 ? "Total tests: 0\n" : "Passed: 2\n", stderr: "" }),
        });
        assert.equal(retried.ok, true);
        assert.equal(retried.attempts, 2);
        assert.match(prompts[1], /--verify-expect/);

        fs.writeFileSync(target, before);
        const { baseUrl, run, close } = await recordingServer({ replyContent: "```\npublic int X() => 3;\n```" });
        try {
            await run(
                1,
                "transform",
                "--base-url",
                baseUrl,
                "--file",
                target,
                "--retries",
                "0",
                "--verify",
                "printf 'Passed: 0\\n'",
                "--verify-expect",
                "Passed:\\s*[1-9]",
                "--prompt",
                "change X to 3",
            );
            assert.equal(fs.readFileSync(target, "utf8"), before, "original file restored when --verify-expect does not match");
        } finally {
            close();
        }
    });

    test("no-verdict verify exit saves candidate reply to a temp file and restores target; skill step 3 names both flags", async () => {
        const dir = scratch();
        const target = path.join(dir, "Sample.cs");
        const before = "public int X() => 1;\n";
        fs.writeFileSync(target, before);
        let savedPath = null;
        try {
            await assert.rejects(
                () => verifyGatedTransform({
                    filePath: target,
                    instruction: "change X to 2",
                    verifyCmd: "missing-tool",
                    chatFn: async () => ({ content: "```\npublic int X() => 2;\n```" }),
                    execFn: () => ({ status: 127, stdout: "", stderr: "missing-tool: command not found" }),
                }),
                (err) => {
                    const m = /Saved candidate reply to ([^\n]+\.txt)\./.exec(err.message);
                    savedPath = m?.[1] ?? null;
                    return err instanceof CouldNotRunError && savedPath !== null && /restored/.test(err.message);
                },
            );
            assert.equal(fs.readFileSync(target, "utf8"), before);
            assert.equal(fs.readFileSync(savedPath, "utf8"), "```\npublic int X() => 2;\n```");
        } finally {
            if (savedPath) fs.rmSync(path.dirname(savedPath), { recursive: true, force: true });
        }

        const skill = fs.readFileSync(path.join(REPO, "packs/tools/local-llm/skills/delegate-local/SKILL.md"), "utf8");
        const step3 = skill.slice(skill.indexOf("3. **Gate every edit.**"), skill.indexOf("4. **Read only the receipt back.**"));
        assert.match(step3, /--preflight/);
        assert.match(step3, /--verify-expect/);
        assert.equal((await captured(() => main(["chat", "--preflight", "--prompt", "hi"]))).code, 2);
        assert.equal((await captured(() => main(["chat", "--verify-expect", "ok", "--prompt", "hi"]))).code, 2);
    });

    test("SIGINT/SIGTERM interrupt transform generation and verification with durable receipts and restored bytes (#581)", async () => {
        for (const sig of ["SIGINT", "SIGTERM"]) {
            const dir = scratch();
            const stateDir = scratch();
            const target = path.join(dir, "gen-int.mjs");
            const original = "export const secretSource = 'KEEP_ME_SAFE';\n";
            fs.writeFileSync(target, original);
            let hit = 0;
            let holdRes = null;
            const server = http.createServer((req, res) => {
                if (req.method === "POST" && req.url === "/v1/chat/completions") {
                    req.resume();
                    req.on("end", () => {
                        hit += 1;
                        if (hit === 1) {
                            res.writeHead(200, { "Content-Type": "application/json" });
                            res.end(JSON.stringify({
                                choices: [{ finish_reason: "stop", message: { content: "```js\nexport const secretSource = 'UNVERIFIED_EDIT';\n```" } }],
                                usage: { prompt_tokens: 10, completion_tokens: 5 },
                            }));
                            return;
                        }
                        holdRes = res;
                    });
                }
            });
            await new Promise((r) => server.listen(0, "127.0.0.1", r));
            const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
            let child = null;
            try {
                child = spawn(
                    process.execPath,
                    [
                        RUNNER,
                        "transform",
                        "--base-url",
                        baseUrl,
                        "--file",
                        target,
                        "--verify",
                        "exit 1",
                        "--retries",
                        "1",
                        "--no-lock",
                        "--prompt",
                        "SECRET_PROMPT_DO_NOT_LEAK",
                    ],
                    { env: { ...process.env, PORTULAN_LOCAL_LLM_STATE_DIR: stateDir }, stdio: ["ignore", "pipe", "pipe"] },
                );
                let stderr = "";
                child.stderr.on("data", (d) => { stderr += d.toString(); });
                await waitFor(() => hit === 2, "second generation request started", 5000);
                await new Promise((r) => setTimeout(r, 30));
                child.kill(sig);
                const code = await new Promise((r) => child.on("exit", r));
                assert.equal(code, 2, stderr);
                assert.equal(fs.readFileSync(target, "utf8"), original);
                assert.match(stderr, new RegExp(`CANCELLED id=[^ ]+ mode=transform .*phase=generation signal=${sig} reason=interrupted elapsed=\\d+ms rollback=restored provider-cancel=unknown in=\\? out=\\? reasoning=\\? cached-in=\\?`));
                assert.doesNotMatch(stderr, /SECRET_PROMPT_DO_NOT_LEAK|KEEP_ME_SAFE/);

                const records = readLifecycleRecords({ stateDir, reconcile: false });
                assert.equal(records.length, 1);
                assert.equal(records[0].status, "cancelled");
                assert.equal(records[0].terminalOutcome, "cancelled");
                assert.equal(records[0].phase, "generation");
                assert.equal(records[0].signal, sig);
                assert.equal(records[0].rollback, "restored");
                assert.equal(records[0].providerCancellation, "unknown");
                assert.deepEqual(records[0].usage, { input: null, output: null, cached: null, reasoning: null });
                const rawJson = fs.readFileSync(path.join(lifecycleDir(stateDir), fs.readdirSync(lifecycleDir(stateDir))[0]), "utf8");
                assert.doesNotMatch(rawJson, /SECRET_PROMPT_DO_NOT_LEAK|KEEP_ME_SAFE|UNVERIFIED_EDIT/);
            } finally {
                if (child && child.exitCode === null && child.signalCode === null) try { child.kill("SIGKILL"); } catch {}
                if (holdRes && !holdRes.writableEnded) holdRes.destroy();
                server.closeAllConnections?.();
                server.close();
            }
        }

        const dir = scratch();
        const stateDir = scratch();
        const target = path.join(dir, "verify-int.mjs");
        const pidFile = path.join(dir, "verify.pid");
        const original = "export const val = 1;\n";
        fs.writeFileSync(target, original);
        const server = http.createServer((req, res) => {
            req.resume();
            req.on("end", () => {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    choices: [{ finish_reason: "stop", message: { content: "```js\nexport const val = 2;\n```" } }],
                    usage: { prompt_tokens: 12, completion_tokens: 4 },
                }));
            });
        });
        await new Promise((r) => server.listen(0, "127.0.0.1", r));
        const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
        let verifyChild = null;
        try {
            const verify = `echo $$ > ${JSON.stringify(pidFile)} && exec sleep 20`;
            verifyChild = spawn(
                process.execPath,
                [RUNNER, "transform", "--base-url", baseUrl, "--file", target, "--verify", verify, "--no-lock", "--prompt", "edit"],
                { env: { ...process.env, PORTULAN_LOCAL_LLM_STATE_DIR: stateDir }, stdio: ["ignore", "pipe", "pipe"] },
            );
            let stderr = "";
            verifyChild.stderr.on("data", (d) => { stderr += d.toString(); });
            await waitFor(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, "utf8").trim() !== "", "verify started", 5000);
            verifyChild.kill("SIGINT");
            const code = await new Promise((r) => verifyChild.on("exit", r));
            assert.equal(code, 2);
            assert.equal(fs.readFileSync(target, "utf8"), original);
            assert.match(stderr, /CANCELLED id=[^ ]+ mode=transform .*phase=verification signal=SIGINT .*rollback=restored provider-cancel=unknown in=\? out=\?/);
            const recs = readLifecycleRecords({ stateDir, reconcile: false });
            assert.equal(recs[0].phase, "verification");
            assert.equal(recs[0].rollback, "restored");
        } finally {
            if (verifyChild && verifyChild.exitCode === null && verifyChild.signalCode === null) try { verifyChild.kill("SIGKILL"); } catch {}
            server.closeAllConnections?.();
            server.close();
        }
    });

    test("read-only modes report not_applicable rollback on completion and cancellation and compose with #574 lock (#581)", async () => {
        const stateDir = scratch();
        const lockDir = scratch();
        const slotDir = slot({ "a.md": "alpha text\n", "b.md": "beta text\n" });
        let releaseHolder = null;
        let callIndex = 0;
        const server = http.createServer((req, res) => {
            req.resume();
            req.on("end", async () => {
                if (req.url === "/v1/embeddings") {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ data: [{ index: 0, embedding: [1, 0] }, { index: 1, embedding: [0, 1] }], usage: { prompt_tokens: 7 } }));
                    return;
                }
                callIndex += 1;
                if (callIndex === 1) {
                    await new Promise((r) => { releaseHolder = r; });
                }
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    choices: [{ finish_reason: "stop", message: { content: "OK reply" } }],
                    usage: { prompt_tokens: 15, completion_tokens: 5 },
                }));
            });
        });
        await new Promise((r) => server.listen(0, "127.0.0.1", r));
        const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
        const env = { ...process.env, PORTULAN_LOCAL_LLM_STATE_DIR: stateDir, PORTULAN_LOCAL_LLM_LOCK_DIR: lockDir };
        let holder = null;
        let waiter = null;
        let dedupChild = null;
        try {
            holder = spawn(process.execPath, [RUNNER, "chat", "--base-url", baseUrl, "--prompt", "first"], { env, stdio: ["ignore", "pipe", "pipe"] });
            let hErr = "";
            holder.stderr.on("data", (d) => { hErr += d.toString(); });
            await waitFor(() => callIndex === 1, "holder acquired lock and started chat", 5000);

            waiter = spawn(process.execPath, [RUNNER, "chat", "--base-url", baseUrl, "--prompt", "second"], { env, stdio: ["ignore", "pipe", "pipe"] });
            let wErr = "";
            waiter.stderr.on("data", (d) => { wErr += d.toString(); });
            const lockFile = endpointLockPath(baseUrl, lockDir);
            await waitFor(
                () => readLifecycleRecords({ stateDir, reconcile: false }).some((r) => r.pid === waiter.pid && r.status === "started"),
                "waiter lifecycle started",
                5000,
            );
            await new Promise((r) => setTimeout(r, 50));

            waiter.kill("SIGTERM");
            const wCode = await new Promise((r) => waiter.on("exit", r));
            assert.equal(wCode, 2, wErr);
            assert.match(wErr, /CANCELLED id=[^ ]+ mode=chat .*phase=queued signal=SIGTERM .*rollback=not_applicable provider-cancel=unknown/);
            assert.equal(fs.existsSync(lockFile), true, "cancelling queued caller must not remove holder lock");

            releaseHolder();
            releaseHolder = null;
            const hCode = await new Promise((r) => holder.on("exit", r));
            assert.equal(hCode, 0, hErr);
            assert.match(hErr, /OK mode=chat .* spend=\$0\.00/);
            assert.equal(fs.existsSync(lockFile), false, "holder cleaned up its own lock");

            dedupChild = spawn(process.execPath, [RUNNER, "dedup", "--base-url", baseUrl, "--dir", slotDir], { env, stdio: ["ignore", "pipe", "pipe"] });
            assert.equal(await new Promise((r) => dedupChild.on("exit", r)), 0);

            const recs = readLifecycleRecords({ stateDir, reconcile: false });
            const cancelled = recs.find((r) => r.status === "cancelled");
            const completed = recs.filter((r) => r.status === "completed");
            assert.ok(cancelled && cancelled.rollback === "not_applicable" && cancelled.phase === "queued");
            assert.equal(completed.length, 2);
            for (const c of completed) assert.equal(c.rollback, "not_applicable");
        } finally {
            if (releaseHolder) releaseHolder();
            for (const p of [holder, waiter, dedupChild]) {
                if (p && p.exitCode === null && p.signalCode === null) try { p.kill("SIGKILL"); } catch {}
            }
            server.closeAllConnections?.();
            server.close();
        }
    });

    test("SIGKILL leaves start record, reconcile marks dead PIDs orphaned safely, and records stay metadata-only and bounded (#581)", async () => {
        const stateDir = scratch();
        let reqStarted = false;
        const server = http.createServer((req, res) => {
            reqStarted = true;
            req.resume();
        });
        await new Promise((r) => server.listen(0, "127.0.0.1", r));
        const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
        let child = null;
        try {
            child = spawn(
                process.execPath,
                [RUNNER, "chat", "--base-url", baseUrl, "--no-lock", "--prompt", "CRASH_PROMPT_SECRET"],
                { env: { ...process.env, PORTULAN_LOCAL_LLM_STATE_DIR: stateDir }, stdio: "ignore" },
            );
            await waitFor(() => reqStarted, "request started", 5000);
            child.kill("SIGKILL");
            await new Promise((r) => child.on("exit", r));

            const rawRecords = readLifecycleRecords({ stateDir, reconcile: false });
            assert.equal(rawRecords.length, 1);
            assert.equal(rawRecords[0].status, "started");
            assert.equal(rawRecords[0].terminalOutcome, null);

            const liveAdapter = beginLifecycle({ mode: "adapter", model: "qwen", endpoint: baseUrl, phase: "generation", stateDir, reconcile: false });
            const cliReconcile = spawnSync(process.execPath, [RUNNER, "lifecycle"], {
                env: { ...process.env, PORTULAN_LOCAL_LLM_STATE_DIR: stateDir },
                encoding: "utf8",
            });
            assert.equal(cliReconcile.status, 0, cliReconcile.stderr);
            const parsed = JSON.parse(cliReconcile.stdout);
            assert.equal(parsed.reconciled.length, 1);
            assert.equal(parsed.reconciled[0].requestId, rawRecords[0].requestId);
            assert.equal(parsed.reconciled[0].status, "orphaned");
            assert.equal(parsed.reconciled[0].terminalOutcome, "orphaned");
            assert.equal(parsed.reconciled[0].reason, "orphan_dead_pid");
            assert.equal(parsed.reconciled[0].elapsedMs, null);
            assert.equal(parsed.reconciled[0].providerCancellation, "unknown");
            assert.deepEqual(parsed.reconciled[0].usage, { input: null, output: null, cached: null, reasoning: null });

            const liveRec = parsed.records.find((r) => r.requestId === liveAdapter.id);
            assert.equal(liveRec.status, "started", "live peer PID must not be marked orphaned");
            liveAdapter.complete({ phase: "completed", rollback: "not_applicable" });

            const boundedDir = scratch();
            for (let i = 0; i < 6; i += 1) {
                const lc = beginLifecycle({ mode: "adapter", model: "m", stateDir: boundedDir, maxRecords: 3, reconcile: false });
                lc.complete({ rollback: "not_applicable" });
            }
            const remaining = fs.readdirSync(lifecycleDir(boundedDir)).filter((f) => f.endsWith(".json"));
            assert.equal(remaining.length, 3);
            assert.equal(lifecycleDir().startsWith(os.tmpdir()), true);
            assert.match(formatCancelReceipt({ requestId: "r1", mode: "chat", model: "m", phase: "generation", signal: "SIGINT", reason: "interrupted", elapsedMs: 10, rollback: "not_applicable", providerCancellation: "unknown", usage: null }), /^CANCELLED id=r1 /);
            assert.deepEqual(normalizeLifecycleUsage({ prompt_tokens: 5, completion_tokens_details: { reasoning_tokens: 9 } }), { input: 5, output: null, cached: null, reasoning: null });
        } finally {
            if (child && child.exitCode === null && child.signalCode === null) try { child.kill("SIGKILL"); } catch {}
            server.closeAllConnections?.();
            server.close();
        }
    });
});
