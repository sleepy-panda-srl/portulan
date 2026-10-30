#!/usr/bin/env node
// Zero-dependency local LLM runner for Portulan: loopback guard, input-byte rail, verify-gated atomic transform, role eval, and offline self-test.
//
// Exit codes: 0 green · 1 red check or model/verify failure · 2 could not run.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { historyOf, jsComments } from "../../../../cli/comments.mjs";
import { parseProvenance } from "../../../../cli/doctor.mjs";
import { fieldBlock } from "../../../../cli/skill-goldens.mjs";

export const DEFAULT_BASE_URL = process.env.PORTULAN_LOCAL_LLM_URL ?? "http://127.0.0.1:1234/v1";
export const DEFAULT_MAX_INPUT_BYTES = 32 * 1024;
export const DEFAULT_RETRIES = 2;

export const ROLE_MODELS = Object.freeze({
    code: process.env.PORTULAN_LOCAL_CODE_MODEL ?? "qwen/qwen3.8-27b",
    prose: process.env.PORTULAN_LOCAL_PROSE_MODEL ?? "google/gemma-4-31b",
    embed: process.env.PORTULAN_LOCAL_EMBED_MODEL ?? "text-embedding-nomic-embed-text-v1.5",
});

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
    return text.replace(/^<think>[\s\S]*?<\/think>\s*/i, "").trim();
}

export function extractFencedCode(text) {
    const cleaned = stripThinking(text);
    const match = /```[a-zA-Z0-9_-]*\n([\s\S]*?)```/.exec(cleaned);
    return match ? match[1] : cleaned;
}

export function formatPassReceipt({ mode, model, attempts = 1, promptTokens = 0, completionTokens = 0, ttftMs = 0, tokPerSec = 0, target = "" }) {
    const where = target ? ` target=${target}` : "";
    return `OK mode=${mode} model=${model}${where} attempts=${attempts} in=${promptTokens}t out=${completionTokens}t ttft=${ttftMs}ms rate=${tokPerSec}tok/s spend=$0.00`;
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
    let res;
    try {
        res = await fetchImpl(`${endpoint}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: maxTokens,
                reasoning_effort: effort,
                chat_template_kwargs: {
                    enable_thinking: effort !== "none" && effort !== "low" ? true : false,
                    reasoning_effort: effort === "none" ? "low" : effort,
                },
                stream: false,
            }),
        });
    } catch (err) {
        throw new CouldNotRunError(`Local LLM server unreachable at ${endpoint} — ${err.message}`);
    }

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new CouldNotRunError(`Local LLM server returned HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const totalMs = Math.max(1, Math.round(performance.now() - t0));
    const rawContent = data.choices?.[0]?.message?.content ?? "";
    const content = stripThinking(rawContent);
    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? Math.round(rawContent.length / 4);
    const tokPerSec = Number((completionTokens / (totalMs / 1000)).toFixed(1));

    return {
        content,
        rawContent,
        promptTokens,
        completionTokens,
        ttftMs: totalMs,
        totalMs,
        tokPerSec,
    };
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
    retries = DEFAULT_RETRIES,
    chatFn = callLocalChat,
    execFn = (cmd) => spawnSync(cmd, { shell: true, encoding: "utf8" }),
}) {
    if (!fs.existsSync(filePath)) {
        throw new CouldNotRunError(`Target file does not exist: ${filePath}`);
    }
    const originalText = fs.readFileSync(filePath, "utf8");
    const allLines = originalText.split("\n");

    let startLine = 1;
    let endLine = allLines.length;
    if (lineRange) {
        const m = /^(\d+)-(\d+)$/.exec(String(lineRange));
        if (!m) throw new CouldNotRunError(`Invalid --lines range ${JSON.stringify(lineRange)} (expected start-end)`);
        startLine = Math.max(1, Number(m[1]));
        endLine = Math.min(allLines.length, Number(m[2]));
        if (startLine > endLine) throw new CouldNotRunError(`Invalid --lines range: start ${startLine} > end ${endLine}`);
    }

    const targetSlice = allLines.slice(startLine - 1, endLine).join("\n");
    let lastError = "";
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let lastStats = { ttftMs: 0, tokPerSec: 0 };

    try {
        for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
            const retryFeedback = lastError
                ? `\n\nThe previous attempt failed verification with this output:\n\`\`\`\n${lastError.slice(0, 1500)}\n\`\`\`\nFix the issue and return ONLY the replacement code.`
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

            const reply = await chatFn({
                baseUrl,
                allowRemote,
                model,
                messages,
                maxInputBytes,
            });

            totalPromptTokens += reply.promptTokens;
            totalCompletionTokens += reply.completionTokens;
            lastStats = reply;

            const replacement = extractFencedCode(reply.content).replace(/\n$/, "");
            const updatedLines = [
                ...allLines.slice(0, startLine - 1),
                replacement,
                ...allLines.slice(endLine),
            ];
            fs.writeFileSync(filePath, updatedLines.join("\n"), "utf8");

            if (!verifyCmd) {
                return {
                    ok: true,
                    attempts: attempt,
                    receipt: formatPassReceipt({
                        mode: "transform",
                        model,
                        attempts: attempt,
                        promptTokens: totalPromptTokens,
                        completionTokens: totalCompletionTokens,
                        ttftMs: lastStats.ttftMs,
                        tokPerSec: lastStats.tokPerSec,
                        target: path.basename(filePath),
                    }),
                };
            }

            const check = execFn(verifyCmd);
            if (check.status === 0) {
                return {
                    ok: true,
                    attempts: attempt,
                    receipt: formatPassReceipt({
                        mode: "transform",
                        model,
                        attempts: attempt,
                        promptTokens: totalPromptTokens,
                        completionTokens: totalCompletionTokens,
                        ttftMs: lastStats.ttftMs,
                        tokPerSec: lastStats.tokPerSec,
                        target: path.basename(filePath),
                    }),
                };
            }
            if (check.status === 2) {
                fs.writeFileSync(filePath, originalText, "utf8");
                throw new CouldNotRunError(`Verify recipe exited 2 (could not run): ${(check.stderr || check.stdout || "").trim()}`);
            }

            lastError = [check.stdout, check.stderr].filter(Boolean).join("\n").trim();
        }

        fs.writeFileSync(filePath, originalText, "utf8");
        return {
            ok: false,
            attempts: retries + 1,
            error: `Verification remained red after ${retries + 1} attempt(s); restored ${filePath} byte-for-byte.\n${lastError}`,
        };
    } catch (err) {
        fs.writeFileSync(filePath, originalText, "utf8");
        throw err;
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

export function gradeRoleOutput(task, rawText) {
    const cleaned = stripThinking(rawText);
    if (task === "code") {
        const code = extractFencedCode(cleaned);
        const comments = jsComments(code);
        const historyHits = historyOf(comments);
        const exportsSummarize = /export\s+function\s+summarizeRun\b/.test(code);
        const ok = Boolean(code.trim()) && historyHits.length === 0 && exportsSummarize;
        return {
            ok,
            detail: `comments=${comments.length} history=${historyHits.length} exported=${exportsSummarize}`,
        };
    }
    if (task === "codify") {
        const normalized = cleaned.replace(/\*\*Provenance\.\*\*\s*\n?/i, "**Provenance:** ");
        const prov = parseProvenance(normalized);
        const fields = {
            incident: fieldBlock(cleaned, "Incident") !== null,
            proposedRule: fieldBlock(cleaned, "Proposed rule") !== null,
            enforcement: fieldBlock(cleaned, "Enforcement") !== null,
            retireWhen: fieldBlock(cleaned, "Retire when") !== null,
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

export async function runRoleEval({
    model = ROLE_MODELS.code,
    tasks = ["code", "codify", "handoff"],
    baseUrl = DEFAULT_BASE_URL,
    allowRemote = false,
    effort = "low",
    chatFn = callLocalChat,
} = {}) {
    const prompts = {
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
    };

    const results = [];
    for (const task of tasks) {
        if (!prompts[task]) throw new CouldNotRunError(`Unknown eval task: ${task}`);
        const reply = await chatFn({
            baseUrl,
            allowRemote,
            model,
            effort,
            messages: prompts[task],
        });
        const verdict = gradeRoleOutput(task, reply.content);
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
    try {
        const res = await verifyGatedTransform({
            filePath: sampleFile,
            instruction: "change x to 2",
            verifyCmd: "exit 1",
            retries: 1,
            chatFn: async () => ({
                content: "```js\nexport const x = 2;\n```",
                promptTokens: 10,
                completionTokens: 5,
                ttftMs: 50,
                tokPerSec: 40,
            }),
            execFn: () => ({ status: 1, stdout: "assertion failed: x !== 1", stderr: "" }),
        });
        const afterBytes = fs.readFileSync(sampleFile, "utf8");
        if (res.ok || afterBytes !== originalBytes) {
            return { status: 1, message: "FAIL: verifyGatedTransform did not restore original bytes after red verify" };
        }
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    const receipt = formatPassReceipt({ mode: "transform", model: "qwen/qwen3.8-27b", attempts: 1, promptTokens: 120, completionTokens: 45, ttftMs: 310, tokPerSec: 32.4, target: "sample.mjs" });
    if (receipt.includes("\n")) {
        return { status: 1, message: "FAIL: pass receipt spanned more than one line" };
    }

    return { status: 0, message: "OK tools/local-llm:runner-rails (4/4 offline rails held)" };
}

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i += 1) {
        const tok = argv[i];
        if (tok === "--verify-offline") args.verifyOffline = true;
        else if (tok === "--allow-remote") args.allowRemote = true;
        else if (tok === "--base-url") args.baseUrl = argv[++i];
        else if (tok === "--model") args.model = argv[++i];
        else if (tok === "--role") args.role = argv[++i];
        else if (tok === "--effort") args.effort = argv[++i];
        else if (tok === "--task") args.task = argv[++i];
        else if (tok === "--file") args.file = argv[++i];
        else if (tok === "--lines") args.lines = argv[++i];
        else if (tok === "--verify") args.verify = argv[++i];
        else if (tok === "--retries") args.retries = Number(argv[++i]);
        else if (tok === "--max-input-bytes") args.maxInputBytes = Number(argv[++i]);
        else if (tok === "--prompt") args.prompt = argv[++i];
        else args._.push(tok);
    }
    return args;
}

export async function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
    if (args.verifyOffline) {
        const res = await runOfflineVerify();
        if (res.status === 0) console.log(res.message);
        else console.error(res.message);
        return res.status;
    }

    const cmd = args._[0] ?? "status";
    const baseUrl = args.baseUrl ?? DEFAULT_BASE_URL;
    const model = args.model ?? ROLE_MODELS[args.role ?? "code"] ?? ROLE_MODELS.code;

    try {
        if (cmd === "status") {
            const endpoint = assertLoopback(baseUrl, { allowRemote: args.allowRemote });
            const res = await fetch(`${endpoint}/models`);
            if (!res.ok) throw new CouldNotRunError(`HTTP ${res.status} from ${endpoint}/models`);
            const data = await res.json();
            const ids = (data.data ?? []).map((m) => m.id);
            console.log(`OK endpoint=${endpoint} models=${ids.length} [${ids.join(", ")}]`);
            return 0;
        }

        if (cmd === "chat" || cmd === "summarize") {
            let input = args.prompt ?? args._.slice(1).join(" ");
            if (args.file) {
                const fileText = fs.readFileSync(args.file, "utf8");
                input = `${input}\n\n\`\`\`\n${fileText}\n\`\`\``;
            }
            const reply = await callLocalChat({
                baseUrl,
                allowRemote: args.allowRemote,
                model: args.model ?? (cmd === "summarize" ? ROLE_MODELS.prose : model),
                effort: args.effort ?? "low",
                maxInputBytes: args.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES,
                messages: [{ role: "user", content: input }],
            });
            console.log(reply.content);
            console.error(
                formatPassReceipt({
                    mode: cmd,
                    model: args.model ?? (cmd === "summarize" ? ROLE_MODELS.prose : model),
                    promptTokens: reply.promptTokens,
                    completionTokens: reply.completionTokens,
                    ttftMs: reply.ttftMs,
                    tokPerSec: reply.tokPerSec,
                }),
            );
            return 0;
        }

        if (cmd === "transform") {
            if (!args.file || !args.prompt) {
                throw new CouldNotRunError("Usage: local-llm.mjs transform --file <path> [--lines <start>-<end>] [--verify <cmd>] --prompt <instruction>");
            }
            const res = await verifyGatedTransform({
                filePath: args.file,
                lineRange: args.lines ?? null,
                instruction: args.prompt,
                verifyCmd: args.verify ?? null,
                model,
                baseUrl,
                allowRemote: args.allowRemote,
                maxInputBytes: args.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES,
                retries: args.retries ?? DEFAULT_RETRIES,
            });
            if (res.ok) {
                console.log(res.receipt);
                return 0;
            }
            console.error(res.error);
            return 1;
        }

        if (cmd === "eval") {
            const tasks = args.task ? [args.task] : ["code", "codify", "handoff"];
            const results = await runRoleEval({
                model,
                tasks,
                baseUrl,
                allowRemote: args.allowRemote,
                effort: args.effort ?? "low",
            });
            for (const r of results) {
                console.log(`${r.ok ? "PASS" : "FAIL"} task=${r.task} model=${r.model} time=${r.totalMs}ms rate=${r.tokPerSec}tok/s ${r.detail}`);
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
    main().then((code) => process.exit(code));
}
