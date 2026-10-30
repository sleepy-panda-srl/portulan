#!/usr/bin/env node
// Zero-dependency local LLM runner for Portulan: loopback guard, input-byte rail, verify-gated transform with rollback, role eval, and offline self-test.
//
// Exit codes: 0 green · 1 red check or model/verify failure · 2 could not run.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const DEFAULT_BASE_URL = process.env.PORTULAN_LOCAL_LLM_URL ?? "http://127.0.0.1:1234/v1";
export const DEFAULT_MAX_INPUT_BYTES = 32 * 1024;
export const DEFAULT_RETRIES = 2;
export const FEEDBACK_CHARS = 1500;
const VERIFY_KEEP_CHARS = 64 * 1024;
export const RESTORE_SIGNALS = Object.freeze(["SIGINT", "SIGTERM", "SIGHUP"]);

export const ROLE_MODELS = Object.freeze({
    code: process.env.PORTULAN_LOCAL_CODE_MODEL ?? "qwen/qwen3.8-27b",
    prose: process.env.PORTULAN_LOCAL_PROSE_MODEL ?? "google/gemma-4-31b",
    embed: process.env.PORTULAN_LOCAL_EMBED_MODEL ?? "text-embedding-nomic-embed-text-v1.5",
});
const CHAT_ROLES = new Set(["code", "prose"]);

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export class RailError extends Error {}
export class CouldNotRunError extends Error {}

export function assertLoopback(baseUrl, { allowRemote = false } = {}) {
    let parsed;
    try {
        parsed = new URL(baseUrl);
    } catch {
        throw new CouldNotRunError(`Invalid --base-url: ${JSON.stringify(baseUrl)}`);
    }
    if (!allowRemote && !LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
        throw new RailError(
            `Refused non-loopback endpoint ${parsed.origin}: local-llm requires 127.0.0.1, localhost, or [::1] unless --allow-remote is explicitly passed.`,
        );
    }
    return parsed.href.replace(/\/+$/, "");
}

export function assertInputBudget(text, { maxInputBytes = DEFAULT_MAX_INPUT_BYTES } = {}) {
    const bytes = Buffer.byteLength(text, "utf8");
    if (bytes > maxInputBytes) {
        throw new RailError(
            `Refused prompt of ${bytes} bytes (limit: ${maxInputBytes} bytes). Outline the target file with cli/symbols.mjs and pass --lines <start>-<end> instead of sending the whole file.`,
        );
    }
    return bytes;
}

export function stripThinking(text) {
    return text.replace(/^\s*<think>[\s\S]*?<\/think>\s*/i, "").trim();
}

export function extractFencedCode(text) {
    const cleaned = stripThinking(text);
    const match = /```[a-zA-Z0-9_-]*\n([\s\S]*?)```/.exec(cleaned);
    return match ? match[1] : cleaned;
}

const figure = (value, unit) => (value === null || value === undefined ? "?" : `${value}${unit}`);

export function formatPassReceipt({ mode, model, attempts = 1, promptTokens = null, completionTokens = null, totalMs = null, tokPerSec = null, target = "" }) {
    const where = target ? ` target=${target}` : "";
    return (
        `OK mode=${mode} model=${model}${where} attempts=${attempts} in=${figure(promptTokens, "t")} out=${figure(completionTokens, "t")} ` +
        `time=${figure(totalMs, "ms")} rate=${figure(tokPerSec, "tok/s")} spend=$0.00`
    );
}

const tail = (text, chars) => (text.length > chars ? `…${text.slice(-chars)}` : text);
const sum = (a, b) => (a === null || b === null || b === undefined ? null : a + b);
const rate = (tokens, ms) => (tokens === null || !ms ? null : Number((tokens / (ms / 1000)).toFixed(1)));

export function runVerify(cmd, { onSpawn = () => {} } = {}) {
    return new Promise((resolve) => {
        let child;
        try {
            child = spawn(cmd, { shell: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
        } catch (error) {
            resolve({ status: null, error, stdout: "", stderr: "" });
            return;
        }
        onSpawn(child);
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout = (stdout + chunk).slice(-VERIFY_KEEP_CHARS)));
        child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr = (stderr + chunk).slice(-VERIFY_KEEP_CHARS)));
        child.on("error", (error) => resolve({ status: null, error, stdout, stderr }));
        child.on("close", (status, signal) => resolve({ status, signal, stdout, stderr }));
    });
}

function stopVerify(child) {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    try {
        process.kill(-child.pid, "SIGKILL");
    } catch {
        child.kill("SIGKILL");
    }
}

async function localFetch(url, init, fetchImpl) {
    try {
        return await fetchImpl(url, { ...init, redirect: "error" });
    } catch (err) {
        const cause = err.cause?.message ? ` (${err.cause.message})` : "";
        throw new CouldNotRunError(`Local LLM server unreachable at ${url} — ${err.message}${cause}`);
    }
}

export async function callLocalChat({
    baseUrl = DEFAULT_BASE_URL,
    allowRemote = false,
    model = ROLE_MODELS.code,
    messages,
    maxInputBytes = DEFAULT_MAX_INPUT_BYTES,
    maxTokens = 4096,
    effort = "low",
    temperature = 0.1,
    fetchImpl = globalThis.fetch,
}) {
    const endpoint = assertLoopback(baseUrl, { allowRemote });
    const serialized = messages.map((m) => m.content ?? "").join("\n");
    assertInputBudget(serialized, { maxInputBytes });

    const t0 = performance.now();
    const res = await localFetch(
        `${endpoint}/chat/completions`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: maxTokens,
                reasoning_effort: effort,
                chat_template_kwargs: {
                    enable_thinking: effort !== "none" && effort !== "low",
                    reasoning_effort: effort === "none" ? "low" : effort,
                },
                stream: false,
            }),
        },
        fetchImpl,
    );

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new CouldNotRunError(`Local LLM server returned HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    let data;
    try {
        data = await res.json();
    } catch (err) {
        throw new CouldNotRunError(`Local LLM server returned a body that is not JSON — ${err.message}`);
    }
    const totalMs = Math.max(1, Math.round(performance.now() - t0));
    const rawContent = data.choices?.[0]?.message?.content ?? "";
    const promptTokens = data.usage?.prompt_tokens ?? null;
    const completionTokens = data.usage?.completion_tokens ?? null;

    return {
        content: stripThinking(rawContent),
        rawContent,
        promptTokens,
        completionTokens,
        totalMs,
        tokPerSec: rate(completionTokens, totalMs),
    };
}

function splitLines(text) {
    const trailingNewline = text.endsWith("\n");
    return { lines: (trailingNewline ? text.slice(0, -1) : text).split("\n"), trailingNewline };
}

export function parseLineRange(spec, lineCount) {
    const m = /^(\d+)-(\d+)$/.exec(String(spec));
    if (!m) throw new CouldNotRunError(`Invalid --lines range ${JSON.stringify(spec)} (expected start-end)`);
    const start = Math.max(1, Number(m[1]));
    const end = Math.min(lineCount, Number(m[2]));
    if (start > end) throw new CouldNotRunError(`Invalid --lines range: start ${start} > end ${end}`);
    return { start, end };
}

export async function verifyGatedTransform({
    filePath,
    lineRange = null,
    instruction,
    verifyCmd,
    model = ROLE_MODELS.code,
    baseUrl = DEFAULT_BASE_URL,
    allowRemote = false,
    maxInputBytes = DEFAULT_MAX_INPUT_BYTES,
    effort = "low",
    retries = DEFAULT_RETRIES,
    chatFn = callLocalChat,
    execFn = runVerify,
}) {
    if (!verifyCmd) {
        throw new CouldNotRunError("transform requires --verify <cmd>: every local edit is gated by a verify command, and kept only on its exit 0");
    }
    if (!fs.existsSync(filePath)) {
        throw new CouldNotRunError(`Target file does not exist: ${filePath}`);
    }
    const originalBytes = fs.readFileSync(filePath);
    const originalText = originalBytes.toString("utf8");
    if (!Buffer.from(originalText, "utf8").equals(originalBytes)) {
        throw new CouldNotRunError(`Refused ${filePath}: it is not valid UTF-8, so rewriting any line would change the bytes of every line`);
    }
    const { lines: allLines, trailingNewline } = splitLines(originalText);
    const { start: startLine, end: endLine } = lineRange
        ? parseLineRange(lineRange, allLines.length)
        : { start: 1, end: allLines.length };
    const targetSlice = allLines.slice(startLine - 1, endLine).join("\n");

    let kept = false;
    let verifying = null;
    const restore = () => {
        try {
            fs.writeFileSync(filePath, originalBytes);
        } catch (err) {
            throw new CouldNotRunError(`Could not restore ${filePath} (${err.message}): it may still hold the model's unverified edit`);
        }
    };
    const onSignal = (signal) => {
        stopVerify(verifying);
        let outcome = kept ? "the verified edit stands" : `restored ${filePath}`;
        if (!kept) {
            try {
                restore();
            } catch (err) {
                outcome = err.message;
            }
        }
        console.error(`Interrupted by ${signal}; ${outcome}.`);
        process.exit(2);
    };
    for (const signal of RESTORE_SIGNALS) process.on(signal, onSignal);

    let lastError = "";
    let promptTokens = 0;
    let completionTokens = 0;
    let modelMs = 0;
    try {
        for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
            const retryFeedback = lastError
                ? `\n\nThe previous attempt failed verification; the end of its output:\n\`\`\`\n${tail(lastError, FEEDBACK_CHARS)}\n\`\`\`\nFix the issue and return ONLY the replacement code.`
                : "";

            const messages = [
                {
                    role: "system",
                    content:
                        "You are a Portulan local code worker. Return ONLY the replacement code inside a single fenced code block (``` ... ```). " +
                        "Never add comments that record change history (dates, proposal/milestone numbers, PR/issue numbers, reviewer names) or narrate obvious code.",
                },
                {
                    role: "user",
                    content:
                        `Instruction: ${instruction}\n\n` +
                        `Target code (${path.basename(filePath)} lines ${startLine}-${endLine}):\n` +
                        "```\n" +
                        targetSlice +
                        "\n```" +
                        retryFeedback,
                },
            ];

            const reply = await chatFn({ baseUrl, allowRemote, model, messages, maxInputBytes, effort });
            promptTokens = sum(promptTokens, reply.promptTokens);
            completionTokens = sum(completionTokens, reply.completionTokens);
            modelMs = sum(modelMs, reply.totalMs);

            const replacement = extractFencedCode(reply.content).replace(/\n$/, "");
            const updatedLines = [...allLines.slice(0, startLine - 1), replacement, ...allLines.slice(endLine)];
            fs.writeFileSync(filePath, updatedLines.join("\n") + (trailingNewline ? "\n" : ""), "utf8");

            const check = await execFn(verifyCmd, { onSpawn: (child) => (verifying = child) });
            verifying = null;
            const output = [check.stdout, check.stderr].filter(Boolean).join("\n").trim();
            if (check.status === 0) {
                kept = true;
                return {
                    ok: true,
                    attempts: attempt,
                    receipt: formatPassReceipt({
                        mode: "transform",
                        model,
                        attempts: attempt,
                        promptTokens,
                        completionTokens,
                        totalMs: modelMs,
                        tokPerSec: rate(completionTokens, modelMs),
                        target: path.basename(filePath),
                    }),
                };
            }
            if (check.status !== 1) {
                const how = check.error
                    ? `failed to run (${check.error.message})`
                    : check.signal
                      ? `was killed by ${check.signal}`
                      : `exited ${check.status}`;
                throw new CouldNotRunError(
                    `Verify command ${how}, which is no verdict (0 green, 1 red); restored ${filePath}.${output ? `\n${tail(output, 400)}` : ""}`,
                );
            }
            lastError = output;
        }

        return {
            ok: false,
            attempts: retries + 1,
            error: `Verification remained red after ${retries + 1} attempt(s); restored ${filePath} byte-for-byte.\n${tail(lastError, FEEDBACK_CHARS)}`,
        };
    } finally {
        try {
            if (!kept) restore();
        } finally {
            for (const signal of RESTORE_SIGNALS) process.off(signal, onSignal);
        }
    }
}

export const HANDOFF_REQUIRED_TOKENS = Object.freeze([
    "claude/spend-ledger",
    "0038",
    "cli/ledger.mjs",
    "cli/advisory.mjs",
    "ef91a02",
    "85k",
    "m13",
]);

export async function loadPredicates(importFn = (specifier) => import(specifier)) {
    try {
        const [comments, doctor, goldens] = await Promise.all([
            importFn("../../../../cli/comments.mjs"),
            importFn("../../../../cli/doctor.mjs"),
            importFn("../../../../cli/skill-goldens.mjs"),
        ]);
        return {
            jsComments: comments.jsComments,
            historyOf: comments.historyOf,
            parseProvenance: doctor.parseProvenance,
            fieldBlock: goldens.fieldBlock,
        };
    } catch (err) {
        throw new CouldNotRunError(
            `eval grades with Portulan's own cli/ predicates, which are not beside this pack (the repository and the npm package carry them) — ${err.message}`,
        );
    }
}

export function gradeRoleOutput(task, rawText, predicates) {
    const cleaned = stripThinking(rawText);
    if ((task === "code" || task === "codify") && !predicates) {
        throw new CouldNotRunError(`Grading ${task} needs Portulan's predicates (loadPredicates)`);
    }
    if (task === "code") {
        const code = extractFencedCode(cleaned);
        const comments = predicates.jsComments(code);
        const historyHits = predicates.historyOf(comments);
        const exportsSummarize = /export\s+function\s+summarizeRun\b/.test(code);
        const ok = Boolean(code.trim()) && historyHits.length === 0 && exportsSummarize;
        return {
            ok,
            detail: `comments=${comments.length} history=${historyHits.length} exported=${exportsSummarize}`,
        };
    }
    if (task === "codify") {
        const normalized = cleaned.replace(/\*\*Provenance\.\*\*\s*\n?/i, "**Provenance:** ");
        const prov = predicates.parseProvenance(normalized);
        const fields = {
            incident: predicates.fieldBlock(cleaned, "Incident") !== null,
            proposedRule: predicates.fieldBlock(cleaned, "Proposed rule") !== null,
            enforcement: predicates.fieldBlock(cleaned, "Enforcement") !== null,
            retireWhen: predicates.fieldBlock(cleaned, "Retire when") !== null,
            provenance:
                prov?.present === true &&
                Boolean(prov?.fields?.form) &&
                (Boolean(prov?.fields?.href) || Boolean(prov?.fields?.shape)),
        };
        const ok = Object.values(fields).every(Boolean);
        return {
            ok,
            detail: Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(" "),
        };
    }
    if (task === "handoff") {
        const md = extractFencedCode(cleaned);
        const bytes = Buffer.byteLength(md, "utf8");
        const missing = HANDOFF_REQUIRED_TOKENS.filter((t) => !md.includes(t));
        const ok = bytes > 0 && bytes <= 800 && missing.length === 0;
        return {
            ok,
            detail: `bytes=${bytes}/800 missing=${missing.length}`,
        };
    }
    throw new CouldNotRunError(`Unknown eval task: ${task}`);
}

const EVAL_PROMPTS = Object.freeze({
    code: [
        {
            role: "system",
            content:
                "Return ONLY valid JavaScript ES module code inside a single ```js fenced block. Never include comments that record change history.",
        },
        {
            role: "user",
            content:
                "Refactor this module to remove all history comments and add `export function summarizeRun(records)` returning `{ requests, billableTokens, maxContext }`:\n" +
                "```js\nexport function parseRange(spec) {\n    const m = /^(\\d+)-(\\d+)$/.exec(String(spec).trim());\n    if (!m) return null;\n    const start = Number(m[1]);\n    const end = Number(m[2]);\n    return start >= 1 && end >= start ? { start, end } : null;\n}\n```",
        },
    ],
    codify: [
        {
            role: "system",
            content: "Draft a concise Portulan proposal in Markdown with bold field leads (**Incident.**, **Proposed rule.**, **Enforcement.**, **Provenance.**, **Retire when.**).",
        },
        {
            role: "user",
            content:
                "Draft a Portulan proposal from these 3 recurring memory entries across `portulan`, `portulan-internal`, and `acme-web`: " +
                "subagent calls inherited an 85k-token host floor (`F`) for 50-line diffs (`https://github.com/sleepy-panda-srl/portulan/pull/433`). " +
                "Include `**Incident.**`, `**Proposed rule.**`, `**Enforcement.**`, `**Provenance.**` with `form=link` and `href=https://github.com/sleepy-panda-srl/portulan/pull/433`, and `**Retire when.**`.",
        },
    ],
    handoff: [
        {
            role: "system",
            content: "Return ONLY the Markdown handoff under 750 bytes. No code fences.",
        },
        {
            role: "user",
            content:
                "Compress this session into a Portulan handoff (`<= 800` bytes) with `## Did`, `## Open`, and `## Next`, preserving every token in " +
                JSON.stringify(HANDOFF_REQUIRED_TOKENS) +
                ":\nBranch `claude/spend-ledger` implemented Proposal `0038` items 2 and 5 in `cli/ledger.mjs` and `cli/advisory.mjs` at commit `ef91a02`. " +
                "Verified `85k` fresh context arithmetic. Open: wire `m13` persona A/B routing next.",
        },
    ],
});

export async function runRoleEval({
    model = ROLE_MODELS.code,
    tasks = ["code", "codify", "handoff"],
    baseUrl = DEFAULT_BASE_URL,
    allowRemote = false,
    effort = "low",
    chatFn = callLocalChat,
    predicates,
} = {}) {
    for (const task of tasks) {
        if (!Object.hasOwn(EVAL_PROMPTS, task)) throw new CouldNotRunError(`Unknown eval task: ${task}`);
    }
    const grading = predicates ?? (await loadPredicates());

    const results = [];
    for (const task of tasks) {
        const reply = await chatFn({ baseUrl, allowRemote, model, effort, messages: EVAL_PROMPTS[task] });
        const verdict = gradeRoleOutput(task, reply.content, grading);
        results.push({
            task,
            model,
            ok: verdict.ok,
            detail: verdict.detail,
            totalMs: reply.totalMs,
            tokPerSec: reply.tokPerSec,
        });
    }
    return results;
}

export async function runOfflineVerify() {
    let caughtRemote = false;
    try {
        assertLoopback("https://api.openai.com/v1");
    } catch (e) {
        caughtRemote = e instanceof RailError;
    }
    if (!caughtRemote) return { status: 1, message: "FAIL: non-loopback endpoint was not refused by assertLoopback" };

    let caughtBudget = false;
    try {
        assertInputBudget("x".repeat(1024), { maxInputBytes: 512 });
    } catch (e) {
        caughtBudget = e instanceof RailError;
    }
    if (!caughtBudget) return { status: 1, message: "FAIL: oversized input was not refused by assertInputBudget" };

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-local-llm-"));
    const sampleFile = path.join(tmpDir, "sample.mjs");
    const originalBytes = "export const x = 1;\n";
    fs.writeFileSync(sampleFile, originalBytes, "utf8");
    const editing = async () => ({ content: "```js\nexport const x = 2;\n```", promptTokens: 10, completionTokens: 5, totalMs: 50, tokPerSec: 40 });
    try {
        const res = await verifyGatedTransform({
            filePath: sampleFile,
            instruction: "change x to 2",
            verifyCmd: "exit 1",
            retries: 1,
            chatFn: editing,
            execFn: () => ({ status: 1, stdout: "assertion failed: x !== 1", stderr: "" }),
        });
        if (res.ok || fs.readFileSync(sampleFile, "utf8") !== originalBytes) {
            return { status: 1, message: "FAIL: verifyGatedTransform did not restore original bytes after red verify" };
        }

        let unjudged = null;
        try {
            await verifyGatedTransform({
                filePath: sampleFile,
                instruction: "change x to 2",
                verifyCmd: "missing-verify-command",
                chatFn: editing,
                execFn: () => ({ status: 127, stdout: "", stderr: "missing-verify-command: not found" }),
            });
        } catch (e) {
            unjudged = e;
        }
        if (!(unjudged instanceof CouldNotRunError) || fs.readFileSync(sampleFile, "utf8") !== originalBytes) {
            return { status: 1, message: "FAIL: a verify exit other than 0 or 1 was not treated as could-not-run with the file restored" };
        }
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    const receipt = formatPassReceipt({ mode: "transform", model: "qwen/qwen3.8-27b", attempts: 1, promptTokens: 120, completionTokens: 45, totalMs: 310, tokPerSec: 32.4, target: "sample.mjs" });
    if (receipt.includes("\n")) {
        return { status: 1, message: "FAIL: pass receipt spanned more than one line" };
    }

    return { status: 0, message: "OK tools/local-llm:runner-rails (5/5 offline rails held)" };
}

const BOOLEAN_FLAGS = Object.freeze({ "--verify-offline": "verifyOffline", "--allow-remote": "allowRemote" });
const VALUE_FLAGS = Object.freeze({
    "--base-url": "baseUrl",
    "--model": "model",
    "--role": "role",
    "--effort": "effort",
    "--task": "task",
    "--file": "file",
    "--lines": "lines",
    "--verify": "verify",
    "--retries": "retries",
    "--max-input-bytes": "maxInputBytes",
    "--prompt": "prompt",
});
const COUNT_FLAGS = Object.freeze({ retries: ["--retries", 0], maxInputBytes: ["--max-input-bytes", 1] });

export function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i += 1) {
        const tok = argv[i];
        if (Object.hasOwn(BOOLEAN_FLAGS, tok)) {
            args[BOOLEAN_FLAGS[tok]] = true;
        } else if (Object.hasOwn(VALUE_FLAGS, tok)) {
            if (i + 1 >= argv.length) throw new CouldNotRunError(`${tok} needs a value`);
            args[VALUE_FLAGS[tok]] = argv[++i];
        } else if (tok.startsWith("--")) {
            throw new CouldNotRunError(`Unknown option ${tok}`);
        } else {
            args._.push(tok);
        }
    }
    for (const [key, [flag, min]] of Object.entries(COUNT_FLAGS)) {
        if (args[key] === undefined) continue;
        if (!/^\d+$/.test(args[key]) || Number(args[key]) < min) {
            throw new CouldNotRunError(`${flag} takes a whole number of at least ${min}, not ${JSON.stringify(args[key])}`);
        }
        args[key] = Number(args[key]);
    }
    if (args.role !== undefined && !CHAT_ROLES.has(args.role)) {
        throw new CouldNotRunError(`--role is one of ${[...CHAT_ROLES].join(", ")}, not ${JSON.stringify(args.role)}`);
    }
    return args;
}

export function buildPrompt(args) {
    let input = args.prompt ?? args._.slice(1).join(" ");
    if (args.file) {
        const text = fs.readFileSync(args.file, "utf8");
        let span = text;
        if (args.lines) {
            const { lines } = splitLines(text);
            const { start, end } = parseLineRange(args.lines, lines.length);
            span = lines.slice(start - 1, end).join("\n");
        }
        input = `${input}\n\n\`\`\`\n${span}\n\`\`\``;
    } else if (args.lines) {
        throw new CouldNotRunError("--lines selects a span of --file, and no --file was given");
    }
    return input;
}

export async function main(argv = process.argv.slice(2), { fetchImpl = globalThis.fetch } = {}) {
    try {
        const args = parseArgs(argv);
        if (args.verifyOffline) {
            const res = await runOfflineVerify();
            if (res.status === 0) console.log(res.message);
            else console.error(res.message);
            return res.status;
        }

        const cmd = args._[0] ?? "status";
        const baseUrl = args.baseUrl ?? DEFAULT_BASE_URL;
        const model = args.model ?? ROLE_MODELS[args.role ?? "code"];

        if (cmd === "status") {
            const endpoint = assertLoopback(baseUrl, { allowRemote: args.allowRemote });
            const res = await localFetch(`${endpoint}/models`, { method: "GET" }, fetchImpl);
            if (!res.ok) throw new CouldNotRunError(`HTTP ${res.status} from ${endpoint}/models`);
            const data = await res.json();
            const ids = (data.data ?? []).map((m) => m.id);
            console.log(`OK endpoint=${endpoint} models=${ids.length} [${ids.join(", ")}]`);
            return 0;
        }

        if (cmd === "chat" || cmd === "summarize") {
            const chosen = args.model ?? (cmd === "summarize" && !args.role ? ROLE_MODELS.prose : model);
            const reply = await callLocalChat({
                baseUrl,
                allowRemote: args.allowRemote,
                model: chosen,
                effort: args.effort ?? "low",
                maxInputBytes: args.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES,
                messages: [{ role: "user", content: buildPrompt(args) }],
                fetchImpl,
            });
            console.log(reply.content);
            console.error(formatPassReceipt({ mode: cmd, model: chosen, ...reply }));
            return 0;
        }

        if (cmd === "transform") {
            if (!args.file || !args.prompt || !args.verify) {
                throw new CouldNotRunError(
                    "Usage: local-llm.mjs transform --file <path> --verify <cmd> --prompt <instruction> [--lines <start>-<end>]",
                );
            }
            const res = await verifyGatedTransform({
                filePath: args.file,
                lineRange: args.lines ?? null,
                instruction: args.prompt,
                verifyCmd: args.verify,
                model,
                baseUrl,
                allowRemote: args.allowRemote,
                maxInputBytes: args.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES,
                effort: args.effort ?? "low",
                retries: args.retries ?? DEFAULT_RETRIES,
                chatFn: (options) => callLocalChat({ ...options, fetchImpl }),
            });
            if (res.ok) {
                console.log(res.receipt);
                return 0;
            }
            console.error(res.error);
            return 1;
        }

        if (cmd === "eval") {
            const results = await runRoleEval({
                model,
                tasks: args.task ? [args.task] : ["code", "codify", "handoff"],
                baseUrl,
                allowRemote: args.allowRemote,
                effort: args.effort ?? "low",
                chatFn: (options) => callLocalChat({ ...options, fetchImpl }),
            });
            for (const r of results) {
                console.log(`${r.ok ? "PASS" : "FAIL"} task=${r.task} model=${r.model} time=${r.totalMs}ms rate=${figure(r.tokPerSec, "tok/s")} ${r.detail}`);
            }
            return results.every((r) => r.ok) ? 0 : 1;
        }

        throw new CouldNotRunError(`Unknown command: ${cmd}`);
    } catch (err) {
        console.error(err.message);
        return err instanceof RailError ? 1 : 2;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
    main().then(
        (code) => process.exit(code),
        (err) => {
            console.error(err?.message ?? err);
            process.exit(2);
        },
    );
}
