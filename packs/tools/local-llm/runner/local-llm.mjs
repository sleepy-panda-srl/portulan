#!/usr/bin/env node
// Zero-dependency local LLM runner for Portulan: loopback guard, input-byte rail, verify-gated transform with rollback, role eval, embedding dedup, its A/B record, and offline self-test.
//
// Exit codes: 0 green · 1 red check or model/verify failure · 2 could not run.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { pathToFileURL } from "node:url";

const RUNNER_FINGERPRINT = createHash("sha256").update(fs.readFileSync(new URL(import.meta.url))).digest("hex");

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
    seed,
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
                ...(seed === undefined ? {} : { seed }),
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

export const DEFAULT_DEDUP_THRESHOLD = 0.8;

export function parseThreshold(spec) {
    const value = /^-?(\d+(\.\d*)?|\.\d+)$/.test(String(spec)) ? Number(spec) : NaN;
    if (!(value >= -1 && value <= 1)) {
        throw new CouldNotRunError(`--threshold takes a cosine similarity from -1 to 1, not ${JSON.stringify(spec)}`);
    }
    return value;
}

export function cosine(a, b) {
    if (a.length !== b.length) throw new CouldNotRunError(`Cannot compare vectors of ${a.length} and ${b.length} dimensions`);
    const scaleA = a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    const scaleB = b.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    if (!Number.isFinite(scaleA) || !Number.isFinite(scaleB)) throw new CouldNotRunError("Cannot compare a vector that is not all finite numbers");
    if (scaleA === 0 || scaleB === 0) return 0;
    let dot = 0;
    let aa = 0;
    let bb = 0;
    for (let i = 0; i < a.length; i += 1) {
        const x = a[i] / scaleA;
        const y = b[i] / scaleB;
        dot += x * y;
        aa += x * x;
        bb += y * y;
    }
    return Math.min(1, Math.max(-1, dot / Math.sqrt(aa * bb)));
}

const byName = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

export function rankDuplicatePairs(names, vectors, threshold) {
    if (names.length !== vectors.length) throw new CouldNotRunError(`${vectors.length} vectors for ${names.length} files`);
    const pairs = [];
    for (let i = 0; i < names.length; i += 1) {
        for (let j = i + 1; j < names.length; j += 1) {
            const score = cosine(vectors[i], vectors[j]);
            if (score >= threshold) pairs.push({ a: names[i], b: names[j], score });
        }
    }
    return pairs.sort((x, y) => y.score - x.score || byName(x.a, y.a) || byName(x.b, y.b));
}

export function readSlot(dir, { maxInputBytes = DEFAULT_MAX_INPUT_BYTES } = {}) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
        throw new CouldNotRunError(`Cannot read --dir ${dir}: ${err.message}`);
    }
    const names = entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md") && e.name.toLowerCase() !== "readme.md")
        .map((e) => e.name)
        .sort(byName);
    if (names.length < 2) {
        throw new CouldNotRunError(`--dir ${dir} holds ${names.length} Markdown file(s) besides its README; dedup needs two to compare`);
    }
    const each = (fn) =>
        names.map((name) => {
            try {
                return fn(path.join(dir, name));
            } catch (err) {
                throw new CouldNotRunError(`Cannot read ${path.join(dir, name)}: ${err.message}`);
            }
        });
    const refuseOver = (bytes) => {
        const over = names.flatMap((name, i) => (bytes[i] > maxInputBytes ? [`${name} (${bytes[i]} bytes)`] : []));
        if (over.length) {
            throw new RailError(
                `Refused ${over.length} file(s) over the ${maxInputBytes}-byte per-file ceiling: ${over.join(", ")}. dedup embeds whole files and never truncates one; raise --max-input-bytes only as far as the embedding model's context holds.`,
            );
        }
    };
    refuseOver(each((file) => fs.statSync(file).size));
    const texts = each((file) => fs.readFileSync(file, "utf8"));
    refuseOver(texts.map((text) => Buffer.byteLength(text, "utf8")));
    return { names, texts };
}

function parseEmbeddings(data, count) {
    const items = Array.isArray(data?.data) ? data.data : null;
    if (!items || items.length !== count) {
        throw new CouldNotRunError(`Local LLM server returned ${items ? items.length : "no"} embeddings for ${count} files`);
    }
    const vectors = new Array(count);
    items.forEach((item, position) => {
        const index = item?.index ?? position;
        if (!Number.isInteger(index) || index < 0 || index >= count || vectors[index]) {
            throw new CouldNotRunError(`Local LLM server returned an embedding with index ${JSON.stringify(item?.index)}`);
        }
        const vector = item.embedding;
        if (!Array.isArray(vector) || vector.length === 0 || !vector.every((x) => typeof x === "number" && Number.isFinite(x))) {
            throw new CouldNotRunError(`Local LLM server returned embedding ${index} that is not a list of finite numbers`);
        }
        vectors[index] = vector;
    });
    return vectors;
}

export async function runDedup({
    dir,
    threshold = DEFAULT_DEDUP_THRESHOLD,
    model = ROLE_MODELS.embed,
    baseUrl = DEFAULT_BASE_URL,
    allowRemote = false,
    maxInputBytes = DEFAULT_MAX_INPUT_BYTES,
    fetchImpl = globalThis.fetch,
}) {
    const endpoint = assertLoopback(baseUrl, { allowRemote });
    const { names, texts } = readSlot(dir, { maxInputBytes });

    const t0 = performance.now();
    const res = await localFetch(
        `${endpoint}/embeddings`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, input: texts }) },
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
    const vectors = parseEmbeddings(data, names.length);
    return {
        pairs: rankDuplicatePairs(names, vectors, threshold),
        files: names.length,
        promptTokens: data.usage?.prompt_tokens ?? null,
        totalMs: Math.max(1, Math.round(performance.now() - t0)),
    };
}

export function formatDedupReceipt({ model, promptTokens = null, totalMs = null }) {
    return formatPassReceipt({ mode: "dedup", model, promptTokens, totalMs });
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

export const EVAL_PROMPTS = Object.freeze({
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

// ---------------------------------------------------------------- the A/B record

export const AB_RECORD = "evals/ab/local-worker.json";
export const AB_REGISTER = "evals/ab/local-worker.md";
export const AB_K = 5;
export const AB_K_RULED = "2026-08-31";
export const AB_TASKS = Object.freeze(["code", "codify", "handoff"]);
export const AB_ARMS = Object.freeze(["l", "h"]);
export const TASK_ROLES = Object.freeze({ code: "code", codify: "prose", handoff: "prose" });
export const HOST_TURN_TIMEOUT_MS = 10 * 60 * 1000;
export const HOST_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
export const PREDICATE_SOURCES = Object.freeze(["cli/comments.mjs", "cli/doctor.mjs", "cli/skill-goldens.mjs"]);
export const JOURNAL_GIT_PATH = "portulan/local-worker-journal";
const JOURNAL_CONDITIONS = "conditions.json";

export const AB_LIMITATIONS = Object.freeze([
    "**What may not be concluded from the figures above.**",
    "",
    "- **`k = 5` per cell supports a recorded rate and nothing else**, the limit `evals/ab/baseline.md`",
    "  carries and `evals/ab/corpus.md` argues: no significance, no interval, and no claim that a",
    "  difference between two cells is a difference between the models.",
    "- **A pass is the screen's predicate and nothing more.** `gradeRoleOutput()` asks what `eval` asks:",
    "  no history comment and the export for `code`, five fields and a provenance for `codify`, 800 bytes",
    "  and every required token for `handoff`. It does not ask whether an output is correct or good.",
    "- **The verdicts are the screen's as it ships, not only as it was.** `eval --verify` regrades every",
    "  completed turn's output with the predicates of the commit it runs on, and any verdict that moves is",
    "  red, so these figures hold under the screen that ships. The fingerprints above name the screen the",
    "  capture graded under, as recorded; a changed predicate file whose verdicts all regrade the same is",
    "  no finding.",
    "- **The arms differ in more than the model.** Arm L runs with no host floor at `--effort low` and",
    "  receives a system and a user message; arm H is the host agent under the operator's own",
    "  environment, credentials and configuration, with whatever it loads in an empty directory, and",
    "  receives the two as one text.",
    "  That difference is the routing question, not a confound this record removes.",
    "- **Arm H's model is the operator's declaration**, which the runner records and does not observe.",
    "- **`did-not-complete` is a fact about a turn**, a host exit other than `0`, a timeout, or a host",
    "  ended by a signal the capture did not send, and is folded into neither count.",
    "- **Which routing these figures support is not stated here.** It is stated where the routing ships,",
    "  the pack's README and `ROLE_MODELS`, which cite this record.",
]);

export function turnSeed(seed, task, run) {
    return Number.parseInt(createHash("sha256").update(`${seed}\0${task}\0${run}`).digest("hex").slice(0, 8), 16);
}

export function screenFingerprint(readFn = (rel) => fs.readFileSync(new URL(`../../../../${rel}`, import.meta.url))) {
    const hash = createHash("sha256");
    for (const rel of PREDICATE_SOURCES) hash.update(`${rel}\0`).update(readFn(rel)).update("\0");
    return hash.update(gradeRoleOutput.toString()).update("\0").update(JSON.stringify(HANDOFF_REQUIRED_TOKENS)).digest("hex");
}

export function promptsFingerprint() {
    return createHash("sha256").update(JSON.stringify(EVAL_PROMPTS)).digest("hex");
}

export function currentScreen() {
    return { predicates: screenFingerprint(), prompts: promptsFingerprint() };
}

export function hostPrompt(task) {
    return EVAL_PROMPTS[task].map((m) => m.content).join("\n\n");
}

export function parseHostCommand(spec) {
    const argv = String(spec ?? "").trim().split(/\s+/).filter(Boolean);
    if (argv.length === 0) throw new CouldNotRunError("--host-cmd names no command");
    return argv;
}

export function machineDescription() {
    const cpu = os.cpus()[0]?.model?.trim() || "an unnamed CPU";
    const gib = Math.round(os.totalmem() / 2 ** 30);
    return `${cpu}, ${gib} GiB, ${os.platform()} ${os.arch()}, node ${process.version}`;
}

export function runHostTurn({ command, prompt, timeoutMs = HOST_TURN_TIMEOUT_MS, maxOutputBytes = HOST_MAX_OUTPUT_BYTES, onSpawn = () => {} }) {
    const cwd = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "portulan-local-llm-host-"));
    const started = performance.now();
    const unspawnable = (error) =>
        new CouldNotRunError(`\`${command[0]}\` could not be spawned — ${error.code ?? error.message}. That is a fact about this machine, not a turn of arm H`);
    return new Promise((resolve, reject) => {
        let child;
        try {
            child = spawn(command[0], [...command.slice(1), prompt], { cwd, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
        } catch (error) {
            reject(unspawnable(error));
            return;
        }
        onSpawn(child, cwd);
        const chunks = [];
        let bytes = 0;
        let overflowed = false;
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            stopVerify(child);
        }, timeoutMs);
        child.stdout.on("data", (chunk) => {
            bytes += chunk.length;
            if (bytes > maxOutputBytes) {
                overflowed = true;
                stopVerify(child);
            } else chunks.push(chunk);
        });
        child.stderr.resume();
        child.on("error", (error) => {
            clearTimeout(timer);
            reject(unspawnable(error));
        });
        child.on("close", (status) => {
            clearTimeout(timer);
            if (overflowed) {
                reject(new CouldNotRunError(`arm H wrote more than ${maxOutputBytes} bytes, which no screen task asks for; the turn is not journalled, and runs again on resume`));
                return;
            }
            const ms = Math.round(performance.now() - started);
            resolve({ completed: !timedOut && status === 0, exit: timedOut ? null : status, timedOut, ms, output: Buffer.concat(chunks).toString("utf8") });
        });
    }).finally(() => fs.rmSync(cwd, { recursive: true, force: true }));
}

export function abConditions({ repoRoot, hostCommand, spawnFn = spawnSync }) {
    const git = (...argv) => spawnFn("git", argv, { cwd: repoRoot, encoding: "utf8" });
    const head = git("rev-parse", "HEAD");
    if (head.error || head.status !== 0) throw new CouldNotRunError(`${repoRoot} names no commit (\`git rev-parse HEAD\` failed), and a record must name the one it was captured at`);
    const status = git("status", "--porcelain");
    if (status.error || status.status !== 0) throw new CouldNotRunError(`\`git status\` failed in ${repoRoot}, so the record could not say whether its tree was clean`);
    const journal = git("rev-parse", "--git-path", JOURNAL_GIT_PATH);
    if (journal.error || journal.status !== 0) throw new CouldNotRunError(`\`git rev-parse --git-path\` failed in ${repoRoot}, so the capture has nowhere to journal its turns`);
    const version = spawnFn(hostCommand[0], [...hostCommand.slice(1), "--version"], { cwd: os.tmpdir(), encoding: "utf8", timeout: 60_000 });
    const line = (version.stdout ?? "").trim().split("\n")[0]?.trim() ?? "";
    if (version.error || version.status !== 0 || line === "") {
        throw new CouldNotRunError(`\`${hostCommand.join(" ")} --version\` did not name a version, and a record that cannot name its host is a figure with no conditions`);
    }
    return {
        journal: path.resolve(repoRoot, journal.stdout.trim()),
        captured: new Date().toISOString(),
        commit: head.stdout.trim(),
        clean: status.stdout.trim() === "",
        machine: machineDescription(),
        hostVersion: line,
    };
}

export function journalFile(dir, id) {
    return path.join(dir, `${id.task}__${id.arm}__${id.run}.json`);
}

function writeAtomic(file, value) {
    fs.writeFileSync(`${file}.partial`, `${JSON.stringify(value, null, 2)}\n`);
    fs.renameSync(`${file}.partial`, file);
}

function readJournalEntry(file) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (cause) {
        if (cause.code === "ENOENT") return null;
        throw new CouldNotRunError(`${file} could not be read — ${cause.code ?? cause.message}. A journal that cannot be read is not an absent one`);
    }
}

export function openJournal(dir, header) {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, JOURNAL_CONDITIONS);
    const existing = readJournalEntry(file);
    if (existing === null) {
        writeAtomic(file, header);
        return header;
    }
    const differing = [...new Set([...Object.keys(header), ...Object.keys(existing)])].filter(
        (key) => key !== "captured" && JSON.stringify(existing[key]) !== JSON.stringify(header[key]),
    );
    if (differing.length > 0) {
        throw new CouldNotRunError(
            `${dir} journals turns taken under other conditions (${differing.join(", ")}). Its arm-H turns were paid for: inspect it, and remove it yourself to capture afresh`,
        );
    }
    return existing;
}

export async function captureAb({
    seed,
    k = AB_K,
    hostCommand,
    hostModel,
    models = { code: ROLE_MODELS.code, prose: ROLE_MODELS.prose },
    baseUrl = DEFAULT_BASE_URL,
    conditions,
    screen = currentScreen(),
    journal = null,
    chatFn = callLocalChat,
    hostFn = runHostTurn,
    predicates,
    onTurn = () => {},
}) {
    const endpoint = assertLoopback(baseUrl);
    const grading = predicates ?? (await loadPredicates());
    const grade = (task, output) => {
        const verdict = gradeRoleOutput(task, output, grading);
        return { ok: verdict.ok, detail: verdict.detail };
    };
    const header = {
        k,
        seed,
        commit: conditions.commit,
        clean: conditions.clean,
        runner: RUNNER_FINGERPRINT,
        machine: conditions.machine,
        endpoint,
        models,
        hostCommand,
        hostVersion: conditions.hostVersion,
        hostModel,
        screen,
        captured: conditions.captured,
    };
    const opened = journal === null ? header : openJournal(journal, header);

    const turns = [];
    let running = null;
    const onSignal = (signal) => {
        if (running !== null) {
            stopVerify(running.child);
            fs.rmSync(running.cwd, { recursive: true, force: true });
        }
        console.error(`Interrupted by ${signal}; ${journal === null ? `${turns.length} turn(s) lost, with no journal` : `${turns.length} turn(s) kept in ${journal}, and the same command resumes from them`}.`);
        process.exit(2);
    };
    const take = async (id, run) => {
        const file = journal === null ? null : journalFile(journal, id);
        const kept = file === null ? null : readJournalEntry(file);
        if (kept !== null) {
            if (kept.task !== id.task || kept.arm !== id.arm || kept.run !== id.run) throw new CouldNotRunError(`${file} holds another turn than its name says`);
            turns.push(kept);
            onTurn(kept, true);
            return;
        }
        const turn = await run();
        if (file !== null) writeAtomic(file, turn);
        turns.push(turn);
        onTurn(turn, false);
    };
    for (const signal of RESTORE_SIGNALS) process.on(signal, onSignal);
    try {
        for (const task of AB_TASKS) {
            for (let run = 0; run < k; run += 1) {
                await take({ task, arm: "l", run }, async () => {
                    const model = models[TASK_ROLES[task]];
                    const turnSeedValue = turnSeed(seed, task, run);
                    const reply = await chatFn({ baseUrl: endpoint, model, effort: "low", messages: EVAL_PROMPTS[task], seed: turnSeedValue });
                    return { task, arm: "l", run, seed: turnSeedValue, model, completed: true, exit: null, timedOut: false, ms: reply.totalMs, ...grade(task, reply.content), output: reply.content };
                });
            }
        }
        for (const task of AB_TASKS) {
            for (let run = 0; run < k; run += 1) {
                await take({ task, arm: "h", run }, async () => {
                    const res = await hostFn({
                        command: hostCommand,
                        prompt: hostPrompt(task),
                        timeoutMs: HOST_TURN_TIMEOUT_MS,
                        onSpawn: (child, cwd) => (running = { child, cwd }),
                    });
                    running = null;
                    const verdict = res.completed ? grade(task, res.output) : { ok: null, detail: null };
                    return { task, arm: "h", run, seed: null, model: hostModel, completed: res.completed, exit: res.exit, timedOut: res.timedOut, ms: res.ms, ...verdict, output: res.output };
                });
            }
        }
    } finally {
        for (const signal of RESTORE_SIGNALS) process.off(signal, onSignal);
    }
    const order = (t) => AB_TASKS.indexOf(t.task) * 2 * k + AB_ARMS.indexOf(t.arm) * k + t.run;
    turns.sort((a, b) => order(a) - order(b));
    const record = {
        portulan: { abLocalWorker: "1" },
        captured: opened.captured,
        source: { commit: conditions.commit, clean: conditions.clean, runner: opened.runner },
        machine: conditions.machine,
        k,
        seed,
        rulings: { k: AB_K_RULED },
        screen: { ...screen },
        arms: {
            l: { endpoint, effort: "low", models: { ...models }, routing: { ...TASK_ROLES } },
            h: { command: [...hostCommand], version: conditions.hostVersion, model: hostModel, timeoutMs: HOST_TURN_TIMEOUT_MS },
        },
        turns,
    };
    record.cells = foldAb(turns, k);
    return record;
}

export function foldAb(turns, k = AB_K) {
    const cells = [];
    for (const task of AB_TASKS) {
        for (const arm of AB_ARMS) {
            const mine = turns.filter((t) => t?.task === task && t?.arm === arm);
            if (mine.length !== k) throw new RailError(`\`${task}\`/${arm} holds ${mine.length} turn(s) and k is ${k} — a rate over an incomplete cell is a rate about something else`);
            const named = new Set(mine.map((t) => t.model));
            if (named.size !== 1) throw new RailError(`\`${task}\`/${arm} names ${named.size} models — a cell is one model's`);
            const cell = {
                task,
                arm,
                model: mine[0].model,
                passed: mine.filter((t) => t.completed === true && t.ok === true).length,
                failed: mine.filter((t) => t.completed === true && t.ok === false).length,
                didNotComplete: mine.filter((t) => t.completed === false).length,
            };
            if (cell.passed + cell.failed + cell.didNotComplete !== k) {
                throw new RailError(`\`${task}\`/${arm} accounts for ${cell.passed + cell.failed + cell.didNotComplete} of ${k} turns — the three states must be total`);
            }
            cells.push(cell);
        }
    }
    return cells;
}

const isNonEmpty = (v) => typeof v === "string" && v.trim() !== "";

export function verifyAbShape(rec) {
    const red = [];
    if (rec?.portulan?.abLocalWorker !== "1") red.push("the record does not declare `portulan.abLocalWorker: \"1\"` — this is not a local-worker A/B capture");
    if (!isNonEmpty(rec?.captured)) red.push("the record carries no `captured` time");
    if (!isNonEmpty(rec?.source?.commit) || typeof rec?.source?.clean !== "boolean") red.push("the record's `source` names no commit, or does not say whether its tree was clean");
    if (!isNonEmpty(rec?.machine)) red.push("the record names no machine");
    if (rec?.k !== AB_K) red.push(`the record's k is ${JSON.stringify(rec?.k)} where the maintainer ruled ${AB_K}`);
    if (!isNonEmpty(rec?.seed)) red.push("the record carries no seed, so no arm-L seed in it can be recomputed");
    if (!isNonEmpty(rec?.rulings?.k)) red.push("the record carries no ruling for its k");
    const sha = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
    if (!sha(rec?.source?.runner)) red.push("the record carries no sha256 fingerprint of the loaded runner source");
    if (!sha(rec?.screen?.predicates) || !sha(rec?.screen?.prompts)) red.push("the record carries no sha256 fingerprint of the predicates and the prompts it was graded under");
    if (rec?.fixture !== undefined && !isNonEmpty(rec.fixture)) red.push("the record's `fixture` is present and is not a non-empty string");
    const l = rec?.arms?.l;
    const h = rec?.arms?.h;
    if (!isNonEmpty(l?.endpoint) || l?.effort !== "low" || !isNonEmpty(l?.models?.code) || !isNonEmpty(l?.models?.prose)) {
        red.push("arm L does not record a loopback endpoint, `--effort low`, and a model for each chat role");
    }
    if (JSON.stringify(l?.routing) !== JSON.stringify(TASK_ROLES)) red.push("arm L's recorded routing is not the task-to-role map this runner routes by");
    if (!Array.isArray(h?.command) || h.command.length === 0 || !h.command.every(isNonEmpty)) red.push("arm H records no host command");
    if (!isNonEmpty(h?.version)) red.push("arm H names no host version");
    if (!isNonEmpty(h?.model)) red.push("arm H names no model");
    if (!Number.isInteger(h?.timeoutMs) || h.timeoutMs <= 0) red.push("arm H records no per-turn timeout");
    if (!Array.isArray(rec?.turns) || rec.turns.length === 0) red.push("the record carries no turns");
    if (!Array.isArray(rec?.cells) || rec.cells.length === 0) red.push("the record publishes no cells");
    if (Array.isArray(rec?.turns)) {
        for (const t of rec.turns) {
            const id = `(${t?.task}, ${t?.arm}, run ${t?.run})`;
            if (!AB_TASKS.includes(t?.task) || !AB_ARMS.includes(t?.arm) || !Number.isInteger(t?.run)) red.push(`${id} is not a turn of this matrix`);
            if (typeof t?.completed !== "boolean" || typeof t?.timedOut !== "boolean") red.push(`${id} carries no boolean \`completed\` or \`timedOut\``);
            if (t?.completed === true && (typeof t?.ok !== "boolean" || typeof t?.detail !== "string")) red.push(`${id} completed and carries no verdict`);
            if (t?.completed === false && (t?.ok !== null || t?.detail !== null)) red.push(`${id} did not complete and carries a verdict anyway`);
            if (typeof t?.output !== "string") red.push(`${id} carries no output, so nobody can regrade it`);
            if (!isNonEmpty(t?.model)) red.push(`${id} names no model`);
            if (t?.exit !== null && !Number.isInteger(t?.exit)) red.push(`${id} carries an \`exit\` that is neither \`null\` nor an integer`);
            if (!Number.isInteger(t?.ms) || t.ms < 0) red.push(`${id} carries no whole-millisecond time`);
        }
        const shapes = new Set(rec.turns.map((t) => Object.keys(t ?? {}).sort().join(",")));
        if (shapes.size > 1) red.push(`the record's turns do not all carry the same fields (${shapes.size} shapes) — a row missing what its neighbours record is an edit, not a capture`);
    }
    if (red.length > 0) return red;
    let rendered;
    try {
        rendered = renderAbRegister(rec);
    } catch (cause) {
        return [`the register cannot be rendered from this record — ${cause.message}`];
    }
    for (const hole of ["undefined", "NaN"]) {
        if (rendered.includes(hole)) red.push(`the register rendered from this record contains \`${hole}\` — a field the renderer reads is missing`);
    }
    return red;
}

export function verifyAb(rec, { predicates, screen }) {
    const red = verifyAbShape(rec);
    if (red.length > 0) return red;
    if (rec.screen.prompts !== screen.prompts) red.push("the eval prompts moved since capture, so the record measures a screen that no longer ships");
    const moved = rec.screen.predicates !== screen.predicates;
    for (const t of rec.turns.filter((turn) => turn.completed)) {
        const now = gradeRoleOutput(t.task, t.output, predicates);
        if (now.ok !== t.ok || now.detail !== t.detail) {
            red.push(
                `(${t.task}, ${t.arm}, run ${t.run}) records ${t.ok ? "pass" : "fail"} \`${t.detail}\` where its output regrades ${now.ok ? "pass" : "fail"} \`${now.detail}\` — ` +
                    (moved ? "the predicates moved since capture, and the figures must hold under the screen that ships" : "a recorded verdict does not match its output"),
            );
        }
    }
    try {
        assertLoopback(rec.arms.l.endpoint);
    } catch (cause) {
        red.push(`arm L's endpoint is not loopback, so it is not the local model — ${cause.message}`);
    }
    const seen = new Set(rec.turns.map((t) => `${t.task}\0${t.arm}\0${t.run}`));
    if (rec.turns.length !== AB_TASKS.length * AB_ARMS.length * rec.k) red.push(`the record holds ${rec.turns.length} turn(s) where k=${rec.k} needs ${AB_TASKS.length * AB_ARMS.length * rec.k}`);
    for (const task of AB_TASKS) {
        for (const arm of AB_ARMS) {
            for (let run = 0; run < rec.k; run += 1) {
                if (!seen.has(`${task}\0${arm}\0${run}`)) red.push(`no turn for (${task}, ${arm}, run ${run}) — the matrix is not total over k`);
            }
        }
    }
    for (const t of rec.turns) {
        const id = `(${t.task}, ${t.arm}, run ${t.run})`;
        if (t.arm === "l") {
            const want = turnSeed(rec.seed, t.task, t.run);
            if (t.seed !== want) red.push(`${id} records seed ${t.seed} where the record's seed derives ${want}`);
            if (t.model !== rec.arms.l.models[TASK_ROLES[t.task]]) red.push(`${id} names \`${t.model}\`, not the model arm L routes \`${t.task}\` to`);
            if (t.completed !== true || t.exit !== null || t.timedOut !== false) red.push(`${id} is an arm-L turn recorded as a process — a local call either answers or aborts the capture`);
        } else {
            if (t.seed !== null) red.push(`${id} records a seed, and arm H's command takes none`);
            if (t.model !== rec.arms.h.model) red.push(`${id} names \`${t.model}\`, not arm H's declared model`);
            if (t.completed !== (t.exit === 0 && t.timedOut === false)) red.push(`${id} records \`completed\` against its own exit and timeout`);
        }
    }
    try {
        if (JSON.stringify(foldAb(rec.turns, rec.k)) !== JSON.stringify(rec.cells)) red.push("the published cells do not match a fresh fold of the turns — a figure has drifted from its own data");
    } catch (cause) {
        red.push(`the turns do not fold: ${cause.message}`);
    }
    return red;
}

export function renderAbRegister(rec) {
    const k = rec.k;
    const cell = (task, arm) => {
        const found = rec.cells.find((c) => c.task === task && c.arm === arm);
        if (found === undefined) throw new Error(`the record publishes no cell for \`${task}\`/${arm}`);
        return found;
    };
    const lines = [];
    lines.push("# The local-worker A/B record — what a run of the arms measured");
    lines.push("");
    lines.push(`> Rendered from \`${AB_RECORD}\` by \`local-llm.mjs eval --write\`. Do not edit by hand: it is`);
    lines.push("> regenerated from that file and byte-compared, so a hand-edit survives exactly until the next run.");
    lines.push(">");
    lines.push("> **The record is the unreproducible half.** It is derived from **events**, model turns, which do");
    lines.push("> not repeat. So the turns are captured once, and the rail holds this document to that capture");
    lines.push("> rather than to the world.");
    if (rec.fixture !== undefined) {
        lines.push("");
        lines.push(`> **SYNTHETIC FIXTURE: not a record of any run.** ${rec.fixture}`);
    }
    lines.push("");
    lines.push("## The conditions");
    lines.push("");
    lines.push(`- **Taken:** ${rec.captured}`);
    lines.push(`- **Commit:** \`${rec.source.commit}\`${rec.source.clean ? "" : " — **a dirty tree**, which is a fact about the runner and the predicates that graded it"}`);
    lines.push(`- **Machine:** ${rec.machine}`);
    lines.push(`- **k:** ${k} per cell, the k the maintainer ruled for \`evals/ab/baseline.md\` on ${rec.rulings.k}`);
    lines.push(`- **Seed:** \`${rec.seed}\` — each arm-L turn's sampling seed derives from it, so a reader can recompute them; arm H's command takes none`);
    lines.push(`- **Arm L:** the local model as routed, through \`local-llm.mjs\` at \`--effort ${rec.arms.l.effort}\` with no host floor, against \`${rec.arms.l.endpoint}\``);
    for (const task of AB_TASKS) lines.push(`  - \`${task}\` → role \`${rec.arms.l.routing[task]}\` → \`${rec.arms.l.models[rec.arms.l.routing[task]]}\``);
    lines.push(`- **Arm H:** \`${rec.arms.h.command.join(" ")} <prompt>\`, host \`${rec.arms.h.version}\` as \`${rec.arms.h.command.join(" ")} --version\` reports it, in an empty working directory, with a per-turn timeout of ${Math.round(rec.arms.h.timeoutMs / 1000)}s`);
    lines.push(`- **Arm H's model:** \`${rec.arms.h.model}\`, as the operator declared it — the runner does not observe it`);
    lines.push("- **Prompt:** `EVAL_PROMPTS`' own, verbatim. Arm L receives its system and user messages; arm H the two joined by a blank line, as its command's last argument");
    lines.push("- **Graded by:** `gradeRoleOutput()`, the predicates `eval` screens with, the same for both arms");
    lines.push(`- **Runner source:** sha256 \`${rec.source.runner}\``);
    lines.push(`- **Screen fingerprints:** predicates \`${rec.screen.predicates}\`, the sha256 over ${PREDICATE_SOURCES.map((p) => `\`${p}\``).join(", ")}, \`gradeRoleOutput()\` and its required tokens; prompts \`${rec.screen.prompts}\``);
    lines.push("");
    lines.push("## The figures");
    lines.push("");
    lines.push("| Task | Arm | Model | passed | failed | did-not-complete |");
    lines.push("|---|---|---|---|---|---|");
    for (const c of rec.cells) lines.push(`| \`${c.task}\` | ${c.arm.toUpperCase()} | \`${c.model}\` | **${c.passed}**/${k} | ${c.failed} | ${c.didNotComplete} |`);
    lines.push("");
    const total = (arm) => AB_TASKS.reduce((n, task) => n + cell(task, arm).passed, 0);
    const totalL = total("l");
    const totalH = total("h");
    const denominator = k * AB_TASKS.length;
    const verdict = totalL === totalH ? "a tie" : `a difference of ${totalL - totalH > 0 ? "+" : ""}${totalL - totalH}`;
    lines.push(`**Arm L ${totalL}/${denominator}, arm H ${totalH}/${denominator} — ${verdict}, recorded as measured.**`);
    lines.push("");
    lines.push(`That total is a sum of ${AB_TASKS.length} counts of ${k}, and NOT a rate over ${denominator} independent`);
    lines.push("trials. It carries no significance, no interval, and no claim that a difference between the arms is");
    lines.push("a difference between the models. The per-task rows above are the measurement.");
    lines.push("");
    lines.push("### Arm H's absolute rate, beside every contrast");
    lines.push("");
    lines.push("| Task | arm L | arm H | difference |");
    lines.push("|---|---|---|---|");
    for (const task of AB_TASKS) {
        const diff = cell(task, "l").passed - cell(task, "h").passed;
        lines.push(`| \`${task}\` | ${cell(task, "l").passed}/${k} | ${cell(task, "h").passed}/${k} | ${diff >= 0 ? "+" : ""}${diff} |`);
    }
    lines.push("");
    lines.push(`A difference here is a difference between two counts of ${k}. It is not a measurement of an`);
    lines.push("effect, and the block below is not a formality.");
    lines.push("");
    lines.push("## Every turn, so the figures above can be checked against them");
    lines.push("");
    lines.push("| Task | Arm | run | seed | verdict | exit | ms | detail |");
    lines.push("|---|---|---|---|---|---|---|---|");
    for (const t of rec.turns) {
        const state = t.completed ? `\`${t.ok ? "pass" : "fail"}\`` : t.timedOut ? "**did-not-complete** (timed out)" : "**did-not-complete**";
        lines.push(`| \`${t.task}\` | ${t.arm.toUpperCase()} | ${t.run} | ${t.seed ?? "—"} | ${state} | ${t.exit ?? "—"} | ${t.ms} | ${t.detail === null ? "—" : `\`${t.detail}\``} |`);
    }
    lines.push("");
    lines.push(...AB_LIMITATIONS);
    return `${lines.join("\n")}\n`;
}

function readAbRecord(repoRoot) {
    const file = path.join(repoRoot, AB_RECORD);
    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    } catch (cause) {
        if (cause.code === "ENOENT") {
            throw new CouldNotRunError(`${AB_RECORD} does not exist — no A/B record has been captured, which is not a verdict about one`);
        }
        throw new CouldNotRunError(`${AB_RECORD} could not be read — ${cause.code ?? cause.message}`);
    }
    try {
        return JSON.parse(text);
    } catch (cause) {
        throw new RailError(`${AB_RECORD} is not JSON — ${cause.message}`);
    }
}

const findings = (red) => `${red.length} finding(s):\n  - ${red.join("\n  - ")}`;

async function regrading() {
    const predicates = await loadPredicates();
    return { predicates, screen: currentScreen() };
}

function refuseFixture(rec, allowFixture) {
    if (rec?.fixture !== undefined && !allowFixture) {
        throw new RailError(`${AB_RECORD} is a synthetic fixture, and a synthetic fixture is not a capture: no run stands behind its figures`);
    }
}

export async function verifyAbRecord(repoRoot, { allowFixture = false } = {}) {
    const rec = readAbRecord(repoRoot);
    refuseFixture(rec, allowFixture);
    const shape = verifyAbShape(rec);
    if (shape.length > 0) throw new RailError(findings(shape));
    const grading = await regrading();
    const red = verifyAb(rec, grading);
    const rendered = renderAbRegister(rec);
    const registerPath = path.join(repoRoot, AB_REGISTER);
    const onDisk = fs.existsSync(registerPath) ? fs.readFileSync(registerPath, "utf8") : null;
    if (onDisk === null) red.push(`${AB_REGISTER} is missing — render it with \`local-llm.mjs eval --write\``);
    else if (onDisk !== rendered) red.push(`${AB_REGISTER} does not match a fresh render of ${AB_RECORD} — a published figure has drifted from its own data`);
    if (!rendered.includes(AB_LIMITATIONS[0])) red.push("the rendered register carries no limitation block");
    if (red.length > 0) throw new RailError(findings(red));
    const moved = rec.screen.predicates === grading.screen.predicates ? "" : "; the predicate files changed since capture, and every verdict regrades the same";
    return `${rec.turns.length} turn(s) over ${rec.cells.length} cell(s) at k=${rec.k}, regraded and folded consistently, and ${AB_REGISTER} matches byte for byte${moved}`;
}

export async function writeAbRegister(repoRoot, { allowFixture = false } = {}) {
    const rec = readAbRecord(repoRoot);
    refuseFixture(rec, allowFixture);
    const shape = verifyAbShape(rec);
    if (shape.length > 0) throw new RailError(`${findings(shape)}\n${AB_REGISTER} was NOT written`);
    const red = verifyAb(rec, await regrading());
    if (red.length > 0) throw new RailError(`${findings(red)}\n${AB_REGISTER} was NOT written`);
    fs.writeFileSync(path.join(repoRoot, AB_REGISTER), renderAbRegister(rec));
    return `wrote ${AB_REGISTER} from ${AB_RECORD}`;
}

export function publishAb(repoRoot, rec, grading) {
    fs.mkdirSync(path.join(repoRoot, path.dirname(AB_RECORD)), { recursive: true });
    try {
        fs.writeFileSync(path.join(repoRoot, AB_RECORD), `${JSON.stringify(rec, null, 2)}\n`, { flag: "wx" });
    } catch (cause) {
        if (cause.code === "EEXIST") throw new CouldNotRunError(`${AB_RECORD} exists at publication: its bytes and register were preserved; the current journal remains for recovery`);
        throw new CouldNotRunError(`${AB_RECORD} could not be published — ${cause.code ?? cause.message}; the current journal remains for recovery`);
    }
    const red = verifyAb(rec, grading);
    if (red.length > 0) return { ok: false, message: `wrote ${AB_RECORD}, which is kept because its turns do not repeat; ${findings(red)}\n${AB_REGISTER} was NOT written` };
    fs.writeFileSync(path.join(repoRoot, AB_REGISTER), renderAbRegister(rec));
    return { ok: true, message: `wrote ${AB_RECORD} and ${AB_REGISTER}. k=${rec.k} per cell supports a recorded rate and nothing else` };
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

        const green = await verifyGatedTransform({
            filePath: sampleFile,
            instruction: "change x to 2",
            verifyCmd: "exit 0",
            chatFn: editing,
            execFn: () => ({ status: 0, stdout: "", stderr: "" }),
        });
        if (!green.ok || fs.readFileSync(sampleFile, "utf8") !== "export const x = 2;\n" || green.receipt.includes("\n")) {
            return { status: 1, message: "FAIL: a green verify did not keep the edit with a single-line receipt" };
        }

        fs.writeFileSync(path.join(tmpDir, "a.md"), "short\n");
        fs.writeFileSync(path.join(tmpDir, "b.md"), "x".repeat(1024));
        let requested = 0;
        const recording = async () => {
            requested += 1;
            throw new Error("dedup reached the network");
        };
        const refusals = [];
        for (const options of [{ baseUrl: "https://api.openai.com/v1" }, { baseUrl: "http://127.0.0.1:1/v1", maxInputBytes: 512 }]) {
            try {
                await runDedup({ dir: tmpDir, fetchImpl: recording, ...options });
            } catch (e) {
                refusals.push(e instanceof RailError);
            }
        }
        if (requested !== 0 || refusals.length !== 2 || !refusals.every(Boolean)) {
            return { status: 1, message: "FAIL: dedup did not refuse a non-loopback endpoint and an over-ceiling file before any request" };
        }
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    return { status: 0, message: "OK tools/local-llm:runner-rails (6/6 offline rails held)" };
}

const BOOLEAN_FLAGS = Object.freeze({
    "--verify-offline": "verifyOffline",
    "--allow-remote": "allowRemote",
    "--ab": "ab",
    "--write": "write",
    "--help": "help",
});
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
    "--k": "k",
    "--seed": "seed",
    "--host-cmd": "hostCmd",
    "--host-model": "hostModel",
    "--repo-root": "repoRoot",
    "--dir": "dir",
    "--threshold": "threshold",
});
const COUNT_FLAGS = Object.freeze({ retries: ["--retries", 0], maxInputBytes: ["--max-input-bytes", 1], k: ["--k", 1] });
const FLAG_OF = Object.freeze({
    ...Object.fromEntries([...Object.entries(BOOLEAN_FLAGS), ...Object.entries(VALUE_FLAGS)].map(([flag, key]) => [key, flag])),
    verifyRecord: "--verify",
});
const EVAL_ONLY = Object.freeze(["ab", "write", "verifyRecord", "k", "seed", "hostCmd", "hostModel", "repoRoot"]);
const AB_ONLY = Object.freeze(["k", "seed", "hostCmd", "hostModel", "repoRoot"]);
const AB_TAKES = Object.freeze(new Set(["_", "ab", "write", "k", "seed", "hostCmd", "hostModel", "repoRoot", "baseUrl", "effort"]));
const RECORD_TAKES = Object.freeze(new Set(["_", "verifyRecord", "write", "repoRoot"]));
const AB_REFUSALS = Object.freeze({
    model: "arm L is each task's model as routed",
    role: "arm L is each task's model as routed",
    task: "the record is over every task",
    allowRemote: "arm L is the local model, and a remote endpoint is not that arm",
});

function refuseOutside(args, takes, mode) {
    for (const key of Object.keys(args)) {
        if (takes.has(key)) continue;
        const why = AB_REFUSALS[key] ? `: ${AB_REFUSALS[key]}` : "";
        throw new CouldNotRunError(`${FLAG_OF[key] ?? key} does not apply to ${mode}${why}`);
    }
}

export const USAGE = `local-llm.mjs — a zero-dependency runner for a loopback OpenAI-compatible model.

  local-llm.mjs status
  local-llm.mjs chat|summarize [--role code|prose | --model <id>] [--file <path> [--lines <a>-<b>]] --prompt <text>
  local-llm.mjs transform --file <path> --verify <cmd> --prompt <instruction> [--lines <a>-<b>] [--retries <n>]
  local-llm.mjs eval [--role code|prose | --model <id>] [--task code|codify|handoff]
  local-llm.mjs eval --ab --k ${AB_K} --seed <s> --host-cmd "<command>" --host-model <id> --write [--repo-root <dir>]
  local-llm.mjs eval --verify [--repo-root <dir>]
  local-llm.mjs eval --write [--repo-root <dir>]
  local-llm.mjs --verify-offline

  eval           the screen: one sample per task and no baseline arm. A model that fails it is not
                 routed; passing it earns nothing.
  eval --ab      capture the A/B record routing is earned by, k=${AB_K} per (task, arm) over code, codify and
                 handoff, both arms graded by the screen's predicates. Arm L is each task's model as
                 routed, at --effort low, on loopback, at $0.00, and runs first. Arm H is the host agent:
                 ${AB_K * AB_TASKS.length} PAID calls whose prompts LEAVE THIS MACHINE through the command --host-cmd names,
                 under the operator's own environment and credentials, crossing the loopback rail this
                 runner otherwise holds. The command is split on whitespace, so no argument of it can
                 hold a space; it is given the prompt as its last argument, and its version is read by
                 running it with --version appended. Without --host-cmd, --ab refuses with exit 1 and
                 contacts nothing; a command that bypasses permission prompts is refused. --host-model is
                 recorded as declared, never observed. Every turn is journalled under the repository's
                 git directory (${JOURNAL_GIT_PATH}) before the next starts, so an interrupted capture
                 (SIGINT, SIGTERM, SIGHUP: exit 2) resumes from it when run again under the same
                 conditions, and refuses a journal of others. Refuses where ${AB_RECORD} exists: a
                 record is captured once. Creates ${AB_RECORD} exclusively; a late existing record is
                 preserved with the journal (exit2). Removes the journal after writing a new record,
                 and writes ${AB_REGISTER} only where the capture passes --verify.
  eval --verify  no model: the record's shape, its matrix total over k, every arm-L seed, every completed
                 turn REGRADED by the predicates as they ship, the cells re-folded from the turns, and
                 ${AB_REGISTER} byte-compared with a fresh render. Exit 2 where no record exists or cli/
                 is not beside packs/ to regrade with, 1 where anything disagrees.
  eval --write   re-render ${AB_REGISTER} from the committed record, refusing one --verify would red.

NO A/B RECORD HAS BEEN CAPTURED YET: ${AB_RECORD} does not exist, so eval --verify is could-not-run,
and the routing in ROLE_MODELS is not earned by one.

Every chat request is refused off loopback unless --allow-remote is passed, and is refused over
--max-input-bytes (default ${DEFAULT_MAX_INPUT_BYTES}). --effort defaults to low.

Exit codes: 0 green · 1 red check or model/verify failure · 2 could not run.`;

export function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i += 1) {
        const tok = argv[i];
        if (Object.hasOwn(BOOLEAN_FLAGS, tok)) {
            args[BOOLEAN_FLAGS[tok]] = true;
        } else if (tok === "--verify" && args._[0] === "eval") {
            args.verifyRecord = true;
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
    if (args.threshold !== undefined) args.threshold = parseThreshold(args.threshold);
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

async function loadHostRail(importFn = (specifier) => import(specifier)) {
    try {
        return (await importFn("../../../../cli/ab-run.mjs")).dissolvesTheTreatment;
    } catch (err) {
        throw new CouldNotRunError(`eval --ab checks the host command with cli/ab-run.mjs, which is not beside this pack — ${err.message}`);
    }
}

async function abMode(args, { fetchImpl }) {
    const repoRoot = path.resolve(args.repoRoot ?? ".");
    if (args.ab && args.verifyRecord) throw new CouldNotRunError("--ab and --verify are two modes — pick one");
    if (args.verifyRecord) {
        refuseOutside(args, RECORD_TAKES, "eval --verify");
        if (args.write) throw new CouldNotRunError("--verify writes nothing; --write alone re-renders the register");
        console.log(`local-llm: ${await verifyAbRecord(repoRoot)}`);
        return 0;
    }
    if (!args.ab) {
        refuseOutside(args, RECORD_TAKES, "eval --write");
        console.log(`local-llm: ${await writeAbRegister(repoRoot)}`);
        return 0;
    }
    refuseOutside(args, AB_TAKES, "eval --ab");
    if (args.hostCmd === undefined) {
        throw new RailError(
            `Refused eval --ab: arm H is a PAID run of ${AB_K * AB_TASKS.length} host calls whose prompts leave this machine, which crosses the loopback rail this runner holds. ` +
                'Name the host command with --host-cmd "<command>" to declare that crossing; nothing was contacted.',
        );
    }
    if (!args.write) throw new CouldNotRunError(`--ab captures turns that do not repeat and keeps them: pass --write, which writes ${AB_RECORD}`);
    if (fs.existsSync(path.join(repoRoot, AB_RECORD))) {
        throw new CouldNotRunError(`${AB_RECORD} exists, and a record is captured once: removing it to capture another is the operator's deliberate act, not this command's`);
    }
    const k = args.k ?? AB_K;
    if (k !== AB_K) throw new CouldNotRunError(`--k ${k}: the maintainer ruled ${AB_K} for evals/ab/baseline.md, and a record at another k is another experiment`);
    if (args.seed === undefined || args.seed.trim() === "") throw new CouldNotRunError("--ab needs --seed <s>, which every arm-L sampling seed derives from");
    if (args.hostModel === undefined || args.hostModel.trim() === "") throw new CouldNotRunError("--ab needs --host-model <id>: the record names both arms' models");
    if ((args.effort ?? "low") !== "low") throw new CouldNotRunError("--ab runs arm L at --effort low, the effort the routing ships with");
    const hostCommand = parseHostCommand(args.hostCmd);
    const bypassing = (await loadHostRail())(hostCommand);
    if (bypassing.length > 0) throw new CouldNotRunError(`the host command carries ${bypassing.join(" and ")}, which lets arm H act without a permission prompt — refused, as cli/ab-run.mjs refuses it`);
    const baseUrl = assertLoopback(args.baseUrl ?? DEFAULT_BASE_URL);
    const grading = await regrading();
    const conditions = abConditions({ repoRoot, hostCommand });
    console.error(`local-llm: arm H sends ${AB_K * AB_TASKS.length} prompts off this machine through \`${hostCommand.join(" ")}\`, billed to its account, after arm L's ${AB_K * AB_TASKS.length} on ${baseUrl}; turns are journalled in ${conditions.journal}`);
    const rec = await captureAb({
        seed: args.seed,
        k,
        hostCommand,
        hostModel: args.hostModel,
        baseUrl,
        conditions,
        screen: grading.screen,
        journal: conditions.journal,
        predicates: grading.predicates,
        chatFn: (options) => callLocalChat({ ...options, fetchImpl }),
        onTurn: (t, reused) =>
            console.error(`local-llm: ${t.arm.toUpperCase()} ${t.task} run ${t.run} ${t.completed ? (t.ok ? "PASS" : "FAIL") : "DID-NOT-COMPLETE"} ${t.ms}ms${reused ? " · from the journal, not re-run" : ""}`),
    });
    const published = publishAb(repoRoot, rec, grading);
    fs.rmSync(conditions.journal, { recursive: true, force: true });
    if (published.ok) console.log(`local-llm: ${published.message}`);
    else console.error(`local-llm: ${published.message}`);
    return published.ok ? 0 : 1;
}

export async function main(argv = process.argv.slice(2), { fetchImpl = globalThis.fetch } = {}) {
    try {
        const args = parseArgs(argv);
        if (args.help) {
            console.log(USAGE);
            return 0;
        }
        if (args.verifyOffline) {
            const res = await runOfflineVerify();
            if (res.status === 0) console.log(res.message);
            else console.error(res.message);
            return res.status;
        }

        const cmd = args._[0] ?? "status";
        if (cmd !== "eval") {
            for (const key of EVAL_ONLY) {
                if (args[key] !== undefined) throw new CouldNotRunError(`${FLAG_OF[key]} belongs to eval, not ${cmd}`);
            }
        }
        if (cmd === "eval" && args._.length > 1) throw new CouldNotRunError(`eval takes no positional argument, not ${JSON.stringify(args._[1])}`);
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

        if (cmd === "eval" && (args.ab || args.verifyRecord || args.write)) return await abMode(args, { fetchImpl });
        if (cmd === "dedup") {
            if (!args.dir) {
                throw new CouldNotRunError(
                    "Usage: local-llm.mjs dedup --dir <slot-dir> [--threshold 0.80] [--model <embedding model>] [--max-input-bytes <per file>]",
                );
            }
            if (args.role) throw new CouldNotRunError(`--role picks a chat model; dedup embeds with ${ROLE_MODELS.embed} unless --model names another`);
            const chosen = args.model ?? ROLE_MODELS.embed;
            const threshold = args.threshold ?? DEFAULT_DEDUP_THRESHOLD;
            const res = await runDedup({
                dir: args.dir,
                threshold,
                model: chosen,
                baseUrl,
                allowRemote: args.allowRemote,
                maxInputBytes: args.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES,
                fetchImpl,
            });
            for (const p of res.pairs) console.log(`${p.score.toFixed(3)} ${p.a} ${p.b}`);
            console.error(`dedup files=${res.files} pairs=${res.pairs.length} threshold=${threshold}`);
            console.error(formatDedupReceipt({ model: chosen, promptTokens: res.promptTokens, totalMs: res.totalMs }));
            return 0;
        }

        if (cmd === "eval") {
            for (const key of AB_ONLY) {
                if (args[key] !== undefined) throw new CouldNotRunError(`${FLAG_OF[key]} belongs to eval --ab, --verify or --write; the screen takes one sample and runs no host`);
            }
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
