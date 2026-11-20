#!/usr/bin/env node
// Local model runner: bounded calls, verified edits, role evals and dedup.
//
// Exit codes: 0 green · 1 red check or model/verify failure · 2 could not run.

import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { pathToFileURL } from "node:url";
import http from "node:http";
import https from "node:https";

const RUNNER_FINGERPRINT = createHash("sha256").update(fs.readFileSync(new URL(import.meta.url))).digest("hex");



export const DEFAULT_BASE_URL = process.env.PORTULAN_LOCAL_LLM_URL ?? "http://127.0.0.1:1234/v1";
export const DEFAULT_MAX_INPUT_BYTES = 32 * 1024;
export const DEFAULT_RETRIES = 2;
export const FEEDBACK_CHARS = 1500;
const VERIFY_KEEP_CHARS = 64 * 1024;
export const RESTORE_SIGNALS = Object.freeze(["SIGINT", "SIGTERM", "SIGHUP"]);

// Candidates retain the historical task map; operational roles are gated by EARNED_ROUTING below.
// Evidence: evals/ab/local-worker.md; cli/local-routing.mjs checks the shipped support table.
export const ROLE_MODELS = Object.freeze({
    code: process.env.PORTULAN_LOCAL_CODE_MODEL ?? "qwen/qwen3.8-27b",
    prose: process.env.PORTULAN_LOCAL_PROSE_MODEL ?? "google/gemma-4-31b",
    embed: process.env.PORTULAN_LOCAL_EMBED_MODEL ?? "text-embedding-nomic-embed-text-v1.5",
});
const CHAT_ROLES = new Set(["code", "prose"]);

// Embedded so a packs-only install needs no root evals/ directory. CI rederives these values.
export const EARNED_ROUTING = Object.freeze({
    record: "evals/ab/local-worker.json",
    sha256: "72501e02ce1284e96e19a29cfb60193552d3ac490e6e4c72391f6d68a42d01d2",
    roles: Object.freeze({
        code: Object.freeze({ model: "qwen/qwen3.8-27b", enabled: true }),
        prose: Object.freeze({ model: "google/gemma-4-31b", enabled: false }),
    }),
});

export function operationalModel(args, defaultRole) {
    // An explicitly named model without a role is an operator's candidate, not earned routing.
    if (args.model !== undefined && args.role === undefined) return args.model;
    const role = args.role ?? defaultRole;
    const earned = EARNED_ROUTING.roles[role];
    if (!earned?.enabled) throw new RailError(`Local role ${role} is not supported by ${EARNED_ROUTING.record}; use the parent session, or explicitly evaluate a candidate with --model and no --role.`);
    const model = args.model ?? ROLE_MODELS[role];
    if (model !== earned.model) throw new RailError(`Local role ${role} was measured with ${earned.model}, not ${model}; use --model without --role for an explicit candidate.`);
    if ((args.effort ?? "low") !== "low") throw new RailError(`Local role ${role} was measured at --effort low; use --model without --role for a candidate at another effort.`);
    return model;
}


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
    return text
        .replace(/^\s*<think>[\s\S]*?<\/think>[ \t]*\r?\n?/i, "")
        .replace(/^(?:[ \t]*\r?\n)+/, "")
        .trimEnd();
}

export function extractFencedCode(text) {
    const cleaned = stripThinking(text);
    const opening = /^[ \t]*(`{3,})([^\r\n]*)(?:\r?\n|$)/m.exec(cleaned);
    if (!opening) return cleaned;
    const rest = cleaned.slice(opening.index + opening[0].length);
    const closing = new RegExp("^[ \\t]*`{" + opening[1].length + ",}[ \\t]*(?:\\r?\\n|$)", "m").exec(rest);
    if (!closing || opening[2].includes("`")) {
        throw new CouldNotRunError("Incomplete fenced local output; no replacement accepted");
    }
    return rest.slice(0, closing.index);
}

export function readUsage(usage) {
    const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
    const promptTokens = count(usage?.prompt_tokens);
    const completionTokens = count(usage?.completion_tokens);
    const reasoning = count(usage?.completion_tokens_details?.reasoning_tokens);
    const cached = count(usage?.prompt_tokens_details?.cached_tokens);
    return {
        promptTokens,
        completionTokens,
        reasoningTokens: reasoning !== null && completionTokens !== null && reasoning <= completionTokens ? reasoning : null,
        cachedPromptTokens: cached !== null && promptTokens !== null && cached <= promptTokens ? cached : null,
    };
}

export function incompleteGenerationMessage(usage) {
    const measured = readUsage(usage);
    const figure = value => value === null ? "?" : `${value}t`;
    const reasoningOnly = measured.completionTokens > 0 && measured.reasoningTokens === measured.completionTokens;
    const diagnosis = reasoningOnly ? "reasoning exhausted the combined output budget" : "combined output budget exhausted";
    const counters = `in=${figure(measured.promptTokens)} out=${figure(measured.completionTokens)} reasoning=${figure(measured.reasoningTokens)}`;
    const advice = reasoningOnly
        ? "Inspect backend thinking controls and the task contract; smaller input alone does not bound reasoning."
        : "Review the requested output and task contract before another request.";
    return `Local generation incomplete: ${diagnosis} (${counters}). No replacement accepted. ${advice} Preserve the pinned profile.`;
}

const figure = (value, unit) => (value === null || value === undefined ? "?" : `${value}${unit}`);

export function formatPassReceipt({ mode, model, attempts = 1, promptTokens = null, completionTokens = null, reasoningTokens = null, cachedPromptTokens = null, totalMs = null, tokPerSec = null, target = "", queuedMs = 0, preflight = null, maxTokens, lineNumbers = false }) {
    const usage = readUsage({prompt_tokens:promptTokens,completion_tokens:completionTokens,
        completion_tokens_details:{reasoning_tokens:reasoningTokens},prompt_tokens_details:{cached_tokens:cachedPromptTokens}});
    const where = target ? ` target=${target}` : "";
    const queued = Number.isSafeInteger(queuedMs) && queuedMs > 0 ? ` queued=${queuedMs}ms` : "";
    const baseline = preflight === "green" || preflight === "red" ? ` preflight=${preflight}` : "";
    const budget = maxTokens === undefined ? "" : ` max-tokens=${Number.isSafeInteger(maxTokens) && maxTokens > 0 ? maxTokens : "?"}`;
    const numbered = lineNumbers === true ? " line-numbers=on" : "";
    return (
        `OK mode=${mode} model=${model}${where} attempts=${attempts} in=${figure(usage.promptTokens, "t")} out=${figure(usage.completionTokens, "t")} ` +
        `time=${figure(totalMs, "ms")} rate=${figure(tokPerSec, "tok/s")} reasoning=${figure(usage.reasoningTokens, "t")} cached-in=${figure(usage.cachedPromptTokens, "t")}${queued}${baseline}${budget}${numbered} spend=$0.00`
    );
}

const tail = (text, chars) => (text.length > chars ? `…${text.slice(-chars)}` : text);
const formatDiagnostic = (message) => String(message).replace(/\r\n?|\n/g, "\n  ");
const assertRequestActive = (signal) => {
    if (signal?.aborted) throw Object.assign(new CouldNotRunError("Local request aborted"), { code: "LOCAL_REQUEST_ABORTED" });
};
const sum = (a, b) => (Number.isSafeInteger(a) && a >= 0 && Number.isSafeInteger(b) && b >= 0 && Number.isSafeInteger(a + b) ? a + b : null);
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

export const LOCAL_RESPONSE_DEADLINE_MS = 900_000;
export const LOCAL_RESPONSE_MAX_BYTES = 262_144;

export function localModelFetch(url, init = {}, { deadlineMs = LOCAL_RESPONSE_DEADLINE_MS, maxBytes = LOCAL_RESPONSE_MAX_BYTES } = {}) {
  const target = new URL(url);
  if (!['127.0.0.1', '[::1]', 'localhost'].includes(target.hostname) ||
      !['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
    return Promise.reject(new Error('Local model transport requires literal loopback'));
  }
  if (target.hostname === 'localhost') target.hostname = '127.0.0.1';
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      init.signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(value);
    };
    const req = (target.protocol === 'https:' ? https : http).request(target, {
      method: init.method ?? 'GET', headers: init.headers, agent: false,
    }, response => {
      const chunks = [];
      let size = 0;
      const declared = Number(response.headers['content-length']);
      if (Number.isFinite(declared) && declared > maxBytes) {
        const error = Object.assign(new Error('Local model response exceeds size limit'), { code: 'LOCAL_RESPONSE_SIZE' });
        finish(error);
        req.destroy(error);
        return;
      }
      response.on('data', chunk => {
        size += chunk.length;
        if (size > maxBytes) {
          const error = Object.assign(new Error('Local model response exceeds size limit'), { code: 'LOCAL_RESPONSE_SIZE' });
          finish(error);
          req.destroy(error);
        }
        else chunks.push(chunk);
      });
      response.on('error', error => finish(error));
      response.on('aborted', () => finish(new Error('Local model response was interrupted')));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const status = response.statusCode ?? 0;
        finish(null, {
          ok: status >= 200 && status < 300, status,
          json: async () => JSON.parse(body), text: async () => body,
        });
      });
    });
    const terminate = error => { finish(error); req.destroy(error); };
    const abort = () => terminate(Object.assign(new Error('Local model request aborted'), { code: 'LOCAL_REQUEST_ABORTED' }));
    req.on('error', error => finish(error));
    timer = setTimeout(() => terminate(Object.assign(new Error('Local model response deadline exceeded; generation may still have been running'), { code: 'LOCAL_RESPONSE_TIMEOUT' })), deadlineMs);
    if (init.signal?.aborted) abort();
    else init.signal?.addEventListener('abort', abort, { once: true });
    req.end(init.body);
  });
}

async function localFetch(url, init, fetchImpl) {
    try {
        const target = new URL(url);
        const localChat = ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) &&
            target.pathname.endsWith("/chat/completions");
        const transport = fetchImpl === globalThis.fetch && localChat ? localModelFetch : fetchImpl;
        return await transport(url, { ...init, redirect: "error" });
    } catch (err) {
        if (err instanceof RailError) throw err;
        if (["LOCAL_GENERATION_INCOMPLETE", "LOCAL_RESPONSE_INVALID_JSON"].includes(err.code)) throw new CouldNotRunError(err.message);
        const cause = err.cause?.message ? ` (${err.cause.message})` : "";
        throw new CouldNotRunError(`Local LLM transport failed at ${url} — ${err.message}${cause}`);
    }
}

const ACTIVE_LOCKS = new Set();
let lockSignalsWired = false;
function releaseActiveLocks() {
    for (const release of [...ACTIVE_LOCKS]) release();
}
function onLockSignal(signal) {
    releaseActiveLocks();
    syncLockSignals();
    process.kill(process.pid, signal);
}
function syncLockSignals() {
    const need = ACTIVE_LOCKS.size > 0;
    if (need === lockSignalsWired) return;
    lockSignalsWired = need;
    for (const signal of RESTORE_SIGNALS) {
        if (need) process.on(signal, onLockSignal);
        else process.off(signal, onLockSignal);
    }
}

function isProcessAlive(pid) {
    if (!Number.isSafeInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        return err.code !== "ESRCH";
    }
}

export function endpointLockPath(endpoint, lockDir = process.env.PORTULAN_LOCAL_LLM_LOCK_DIR || os.tmpdir()) {
    const parsed = new URL(endpoint);
    if (parsed.hostname.toLowerCase() === "localhost") parsed.hostname = "127.0.0.1";
    const key = `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
    const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
    return path.join(lockDir, `portulan-local-llm-${hash}.lock`);
}

function tryRecoverStaleLock(lockPath, staleGraceMs) {
    let stat;
    let raw;
    try {
        stat = fs.statSync(lockPath);
        raw = fs.readFileSync(lockPath, "utf8");
    } catch (err) {
        if (err.code === "ENOENT") return true;
        throw err;
    }
    let holder = null;
    try { holder = JSON.parse(raw); } catch { holder = null; }
    const dead = holder !== null && Number.isSafeInteger(holder.pid) && !isProcessAlive(holder.pid);
    const corrupt = holder === null && Date.now() - stat.mtimeMs > staleGraceMs;
    if (!dead && !corrupt) return false;

    const guardPath = `${lockPath}.recover`;
    let ownsGuard = false;
    try {
        const fd = fs.openSync(guardPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
        ownsGuard = true;
        fs.writeSync(fd, `${process.pid}\n`);
        fs.closeSync(fd);
        try {
            const nowStat = fs.statSync(lockPath);
            const nowRaw = fs.readFileSync(lockPath, "utf8");
            let nowHolder = null;
            try { nowHolder = JSON.parse(nowRaw); } catch { nowHolder = null; }
            const stillDead = nowHolder !== null && Number.isSafeInteger(nowHolder.pid) && !isProcessAlive(nowHolder.pid);
            const stillCorrupt = nowHolder === null && Date.now() - nowStat.mtimeMs > staleGraceMs;
            if (stillDead || stillCorrupt) fs.unlinkSync(lockPath);
        } catch (err) {
            if (err.code !== "ENOENT") throw err;
        }
        return true;
    } catch (err) {
        if (err.code === "EEXIST") {
            try {
                if (Date.now() - fs.statSync(guardPath).mtimeMs > 5000) fs.unlinkSync(guardPath);
            } catch {}
            return false;
        }
        if (err.code === "ENOENT") return true;
        throw err;
    } finally {
        if (ownsGuard) {
            try { fs.unlinkSync(guardPath); } catch {}
        }
    }
}

export const DEFAULT_LIFECYCLE_MAX_RECORDS = 100;
export const DEFAULT_LIFECYCLE_MAX_BYTES = 64 * 1024;
const EMPTY_USAGE = Object.freeze({ input: null, output: null, cached: null, reasoning: null });

export function normalizeLifecycleUsage(usage) {
    if (!usage || typeof usage !== "object") return { ...EMPTY_USAGE };
    const adapted = {
        prompt_tokens: usage.promptTokens ?? usage.prompt_tokens ?? usage.input,
        completion_tokens: usage.completionTokens ?? usage.completion_tokens ?? usage.output,
        prompt_tokens_details: {
            cached_tokens: usage.cachedPromptTokens ?? usage.prompt_tokens_details?.cached_tokens ?? usage.cached,
        },
        completion_tokens_details: {
            reasoning_tokens: usage.reasoningTokens ?? usage.completion_tokens_details?.reasoning_tokens ?? usage.reasoning,
        },
    };
    const u = readUsage(adapted);
    return {
        input: u.promptTokens,
        output: u.completionTokens,
        cached: u.cachedPromptTokens,
        reasoning: u.reasoningTokens,
    };
}

function sanitizeEndpoint(url) {
    if (typeof url !== "string" || !url.trim()) return null;
    try {
        const parsed = new URL(url);
        if (parsed.hostname.toLowerCase() === "localhost") parsed.hostname = "127.0.0.1";
        return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
    } catch {
        return null;
    }
}

export function lifecycleDir(stateDir = process.env.PORTULAN_LOCAL_LLM_STATE_DIR || os.tmpdir()) {
    return path.join(stateDir, "portulan-local-llm-lifecycle");
}

function allowlistedLifecycleRecord(rec) {
    return {
        requestId: String(rec.requestId),
        pid: Number.isSafeInteger(rec.pid) && rec.pid > 0 ? rec.pid : null,
        mode: typeof rec.mode === "string" && rec.mode ? rec.mode : "unknown",
        model: typeof rec.model === "string" && rec.model ? rec.model : null,
        endpoint: sanitizeEndpoint(rec.endpoint),
        phase: typeof rec.phase === "string" && rec.phase ? rec.phase : "unknown",
        attempt: Number.isSafeInteger(rec.attempt) && rec.attempt >= 0 ? rec.attempt : 0,
        startedAt: typeof rec.startedAt === "string" ? rec.startedAt : new Date().toISOString(),
        updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : new Date().toISOString(),
        endedAt: typeof rec.endedAt === "string" ? rec.endedAt : null,
        reconciledAt: typeof rec.reconciledAt === "string" ? rec.reconciledAt : null,
        status: typeof rec.status === "string" ? rec.status : "started",
        terminalOutcome: typeof rec.terminalOutcome === "string" ? rec.terminalOutcome : null,
        signal: typeof rec.signal === "string" ? rec.signal : null,
        reason: typeof rec.reason === "string" ? rec.reason : null,
        elapsedMs: Number.isFinite(rec.elapsedMs) && rec.elapsedMs >= 0 ? Math.round(rec.elapsedMs) : null,
        rollback: typeof rec.rollback === "string" ? rec.rollback : "unknown",
        providerCancellation: rec.providerCancellation === "confirmed" ? "confirmed" : "unknown",
        usage: normalizeLifecycleUsage(rec.usage),
        target: typeof rec.target === "string" && rec.target ? path.basename(rec.target) : null,
    };
}

function readLifecycleFile(file) {
    try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
        if (!parsed || typeof parsed !== "object" || typeof parsed.requestId !== "string" || !parsed.requestId) return null;
        return allowlistedLifecycleRecord(parsed);
    } catch {
        return null;
    }
}

function writeLifecycleFileAtomic(file, record) {
    const clean = allowlistedLifecycleRecord(record);
    const payload = `${JSON.stringify(clean)}\n`;
    const tmp = `${file}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
        fs.writeFileSync(tmp, payload, { encoding: "utf8", mode: 0o600 });
        fs.renameSync(tmp, file);
        return clean;
    } catch {
        try { fs.rmSync(tmp, { force: true }); } catch {}
        try {
            fs.writeFileSync(file, payload, { encoding: "utf8", mode: 0o600 });
        } catch {}
        return clean;
    }
}

function pruneLifecycleDir(dir, maxRecords = DEFAULT_LIFECYCLE_MAX_RECORDS, maxBytes = DEFAULT_LIFECYCLE_MAX_BYTES) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    const files = [];
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const file = path.join(dir, entry.name);
        try {
            const st = fs.statSync(file);
            const rec = readLifecycleFile(file);
            files.push({
                file,
                bytes: st.size,
                active: rec?.status === "started",
                stamp: Date.parse(rec?.updatedAt ?? rec?.startedAt ?? "") || st.mtimeMs,
            });
        } catch {}
    }
    files.sort((a, b) => b.stamp - a.stamp);
    let totalBytes = files.reduce((n, f) => n + f.bytes, 0);
    let keptCount = files.length;
    for (let i = files.length - 1; i >= 0 && (keptCount > maxRecords || totalBytes > maxBytes); i -= 1) {
        if (files[i].active) continue;
        try {
            fs.rmSync(files[i].file, { force: true });
            totalBytes -= files[i].bytes;
            keptCount -= 1;
        } catch {}
    }
}

export function reconcileLifecycleRecords({
    stateDir,
    isAlive = isProcessAlive,
    maxRecords = DEFAULT_LIFECYCLE_MAX_RECORDS,
    maxBytes = DEFAULT_LIFECYCLE_MAX_BYTES,
    now = new Date(),
} = {}) {
    const dir = lifecycleDir(stateDir);
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return { reconciled: [], records: [] };
    }
    const stamp = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
    const reconciled = [];
    const records = [];
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const file = path.join(dir, entry.name);
        const rec = readLifecycleFile(file);
        if (!rec) continue;
        if (rec.status === "started") {
            const alive = Number.isSafeInteger(rec.pid) && rec.pid > 0 && isAlive(rec.pid);
            if (!alive) {
                const updated = writeLifecycleFileAtomic(file, {
                    ...rec,
                    status: "orphaned",
                    terminalOutcome: "orphaned",
                    reason: rec.reason ?? "orphan_dead_pid",
                    endedAt: null,
                    reconciledAt: stamp,
                    updatedAt: stamp,
                    elapsedMs: null,
                    rollback: rec.mode === "transform" ? "unknown" : "not_applicable",
                    providerCancellation: "unknown",
                    usage: normalizeLifecycleUsage(rec.usage),
                });
                reconciled.push(updated);
                records.push(updated);
                continue;
            }
        }
        records.push(rec);
    }
    pruneLifecycleDir(dir, maxRecords, maxBytes);
    records.sort((a, b) => Date.parse(b.updatedAt ?? b.startedAt) - Date.parse(a.updatedAt ?? a.startedAt));
    return { reconciled, records };
}

export function readLifecycleRecords(options = {}) {
    if (options.reconcile !== false) return reconcileLifecycleRecords(options).records;
    const dir = lifecycleDir(options.stateDir);
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const records = [];
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const rec = readLifecycleFile(path.join(dir, entry.name));
        if (rec) records.push(rec);
    }
    records.sort((a, b) => Date.parse(b.updatedAt ?? b.startedAt) - Date.parse(a.updatedAt ?? a.startedAt));
    return records;
}

export function formatCancelReceipt(record) {
    const u = normalizeLifecycleUsage(record?.usage);
    return (
        `CANCELLED id=${record?.requestId ?? "?"} mode=${record?.mode ?? "?"} model=${record?.model ?? "?"} ` +
        `phase=${record?.phase ?? "?"} signal=${record?.signal ?? "none"} reason=${record?.reason ?? "interrupted"} ` +
        `elapsed=${figure(record?.elapsedMs, "ms")} rollback=${record?.rollback ?? "unknown"} ` +
        `provider-cancel=${record?.providerCancellation ?? "unknown"} ` +
        `in=${figure(u.input, "t")} out=${figure(u.output, "t")} ` +
        `reasoning=${figure(u.reasoning, "t")} cached-in=${figure(u.cached, "t")}`
    );
}

export function beginLifecycle({
    mode,
    model = null,
    endpoint = null,
    phase = "queued",
    target = null,
    requestId = randomUUID(),
    pid = process.pid,
    stateDir,
    maxRecords = DEFAULT_LIFECYCLE_MAX_RECORDS,
    maxBytes = DEFAULT_LIFECYCLE_MAX_BYTES,
    reconcile = true,
} = {}) {
    const dir = lifecycleDir(stateDir);
    if (reconcile) reconcileLifecycleRecords({ stateDir, maxRecords, maxBytes });
    const file = path.join(dir, `${String(requestId).replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
    const startedAt = new Date().toISOString();
    const t0 = performance.now();
    const controller = new AbortController();
    let settled = false;
    let current = allowlistedLifecycleRecord({
        requestId,
        pid,
        mode,
        model,
        endpoint,
        phase,
        attempt: 0,
        startedAt,
        updatedAt: startedAt,
        endedAt: null,
        reconciledAt: null,
        status: "started",
        terminalOutcome: null,
        signal: null,
        reason: null,
        elapsedMs: null,
        rollback: mode === "transform" ? "unknown" : "not_applicable",
        providerCancellation: "unknown",
        usage: EMPTY_USAGE,
        target: target ? path.basename(String(target)) : null,
    });
    writeLifecycleFileAtomic(file, current);

    const persist = (patch) => {
        current = writeLifecycleFileAtomic(file, { ...current, ...patch, updatedAt: new Date().toISOString() });
        return current;
    };
    const finalize = ({
        status,
        phase: finalPhase = current.phase,
        signal = null,
        reason = null,
        elapsedMs,
        rollback,
        providerCancellation = "unknown",
        usage = null,
    }) => {
        if (settled) return current;
        settled = true;
        const nowIso = new Date().toISOString();
        const computedElapsed = Number.isFinite(elapsedMs) && elapsedMs >= 0
            ? Math.round(elapsedMs)
            : Math.max(0, Math.round(performance.now() - t0));
        const resolvedRollback = rollback ?? (current.mode === "transform" ? "unknown" : "not_applicable");
        const saved = writeLifecycleFileAtomic(file, {
            ...current,
            phase: finalPhase,
            signal,
            reason,
            elapsedMs: computedElapsed,
            endedAt: nowIso,
            updatedAt: nowIso,
            status,
            terminalOutcome: status,
            rollback: resolvedRollback,
            providerCancellation: providerCancellation === "confirmed" ? "confirmed" : "unknown",
            usage: normalizeLifecycleUsage(usage),
        });
        current = saved;
        pruneLifecycleDir(dir, maxRecords, maxBytes);
        return current;
    };

    return {
        id: current.requestId,
        file,
        controller,
        phase: () => current.phase,
        isSettled: () => settled,
        currentRecord: () => ({ ...current, usage: { ...current.usage } }),
        setPhase: (nextPhase, extra = {}) => {
            if (settled) return current;
            const patch = { phase: nextPhase };
            if (extra.attempt !== undefined) patch.attempt = extra.attempt;
            if (extra.model !== undefined) patch.model = extra.model;
            if (extra.endpoint !== undefined) patch.endpoint = sanitizeEndpoint(extra.endpoint);
            return persist(patch);
        },
        complete: ({ phase: finalPhase = "completed", usage = null, elapsedMs, rollback = "not_applicable", reason = null } = {}) =>
            finalize({ status: "completed", phase: finalPhase, usage, elapsedMs, rollback, reason }),
        fail: ({ reason = "failed", phase: finalPhase = current.phase, elapsedMs, rollback, usage = null, providerCancellation = "unknown" } = {}) =>
            finalize({ status: "failed", phase: finalPhase, reason, elapsedMs, rollback, usage, providerCancellation }),
        cancel: ({ signal = null, reason = "interrupted", phase: finalPhase = current.phase, elapsedMs, rollback, providerCancellation = "unknown", usage = null } = {}) => {
            const record = finalize({ status: "cancelled", phase: finalPhase, signal, reason, elapsedMs, rollback, providerCancellation, usage });
            return { record, receipt: formatCancelReceipt(record) };
        },
    };
}

export async function acquireEndpointLock(
    endpoint,
    { lockDir = process.env.PORTULAN_LOCAL_LLM_LOCK_DIR || os.tmpdir(), pollMs = 50, staleGraceMs = 2000, signal } = {},
) {
    fs.mkdirSync(lockDir, { recursive: true });
    const lockPath = endpointLockPath(endpoint, lockDir);
    const lockToken = randomUUID();
    const waitStart = performance.now();
    let waited = false;
    while (true) {
        if (signal?.aborted) {
            throw Object.assign(new Error("Local model request aborted while queued for endpoint lock"), { code: "LOCAL_REQUEST_ABORTED" });
        }
        let fd = null;
        try {
            fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
            fs.writeSync(fd, `${JSON.stringify({ pid: process.pid, token: lockToken, startedAt: Date.now(), endpoint })}\n`);
            fs.closeSync(fd);
            fd = null;
            const queuedMs = waited ? Math.max(1, Math.round(performance.now() - waitStart)) : 0;
            let released = false;
            const release = () => {
                if (released) return;
                released = true;
                ACTIVE_LOCKS.delete(release);
                syncLockSignals();
                try {
                    const holder = JSON.parse(fs.readFileSync(lockPath, "utf8"));
                    if (holder?.pid === process.pid && holder?.token === lockToken) fs.unlinkSync(lockPath);
                } catch {}
            };
            ACTIVE_LOCKS.add(release);
            syncLockSignals();
            return { lockPath, queuedMs, release };
        } catch (err) {
            if (fd !== null) {
                try { fs.closeSync(fd); } catch {}
            }
            if (err.code !== "EEXIST") throw err;
            waited = true;
            if (tryRecoverStaleLock(lockPath, staleGraceMs)) continue;
            await new Promise((resolve) => {
                const timer = setTimeout(() => {
                    signal?.removeEventListener("abort", onAbort);
                    resolve();
                }, pollMs);
                const onAbort = () => {
                    clearTimeout(timer);
                    resolve();
                };
                if (signal) signal.addEventListener("abort", onAbort, { once: true });
            });
        }
    }
}

function registerSignalCancel(onInterrupt) {
    let active = true;
    const handler = (signal) => {
        if (!active) return;
        active = false;
        cleanup();
        onInterrupt(signal);
    };
    const cleanup = () => {
        for (const signal of RESTORE_SIGNALS) process.off(signal, handler);
    };
    for (const signal of RESTORE_SIGNALS) process.on(signal, handler);
    return cleanup;
}

export async function callLocalChat({
    baseUrl = DEFAULT_BASE_URL,
    allowRemote = false,
    model = ROLE_MODELS.code,
    messages,
    maxInputBytes = DEFAULT_MAX_INPUT_BYTES,
    maxTokens = 4096,
    progress = false,
    onProgress = (line) => console.error(line),
    effort = "low",
    temperature = 0.1,
    seed,
    noLock = false,
    useLock,
    lockDir,
    signal,
    lifecycle = null,
    requestId,
    stateDir,
    trackLifecycle = true,
    exitOnSignal = true,
    fetchImpl = globalThis.fetch,
}) {
    if (!Number.isSafeInteger(maxTokens) || maxTokens < 1) {
        throw new CouldNotRunError("--max-tokens takes a positive safe integer");
    }
    const endpoint = assertLoopback(baseUrl, { allowRemote });
    const serialized = messages.map((m) => m.content ?? "").join("\n");
    assertInputBudget(serialized, { maxInputBytes });

    const ownLifecycle = !lifecycle && trackLifecycle !== false
        ? beginLifecycle({ mode: "chat", model, endpoint, phase: "queued", requestId, stateDir })
        : null;
    const activeLifecycle = lifecycle ?? ownLifecycle;
    const controller = ownLifecycle ? ownLifecycle.controller : null;
    const activeSignal = controller?.signal ?? signal ?? lifecycle?.controller?.signal;
    const forwardAbort = () => controller.abort();
    if (signal && controller && signal !== controller.signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener("abort", forwardAbort, { once: true });
    }
    const unregisterSignals = ownLifecycle
        ? registerSignalCancel((sig) => {
            const interruptedPhase = activeLifecycle.phase();
            controller.abort();
            releaseActiveLocks();
            const cancelled = ownLifecycle.cancel({ signal: sig, reason: "interrupted", phase: interruptedPhase, rollback: "not_applicable", providerCancellation: "unknown", usage: null });
            console.error(`Interrupted by ${sig}; rollback=not_applicable.`);
            console.error(cancelled.receipt);
            if (exitOnSignal) process.exit(2);
        })
        : () => {};

    const shouldLock = !noLock && (useLock === true || lockDir !== undefined || fetchImpl === globalThis.fetch);
    let lock = { queuedMs: 0, release: () => {} };
    let progressPhase = "queued";
    const started = performance.now();
    const reportProgress = () => {
        if (!activeSignal?.aborted) onProgress(`local-llm: request=${activeLifecycle?.id ?? requestId ?? "?"} phase=${progressPhase} elapsed=${Math.round(performance.now() - started)}ms tokens=?`);
    };
    const progressTimer = progress ? setInterval(reportProgress, 10_000) : null;
    const stopProgress = () => clearInterval(progressTimer);
    activeSignal?.addEventListener("abort", stopProgress, { once: true });
    try {
        assertRequestActive(activeSignal);
        activeLifecycle?.setPhase("queued", { model, endpoint });
        if (progress) reportProgress();
        lock = shouldLock
            ? await acquireEndpointLock(endpoint, { ...(lockDir ? { lockDir } : {}), ...(activeSignal ? { signal: activeSignal } : {}) })
            : { queuedMs: 0, release: () => {} };
        assertRequestActive(activeSignal);
        if (lock.queuedMs > 0) console.error(`local-llm: waited ${lock.queuedMs}ms for endpoint lock (${endpoint})`);

        activeLifecycle?.setPhase("generation", { model, endpoint });
        progressPhase = "generation";
        if (progress) reportProgress();
        assertRequestActive(activeSignal);
        const t0 = performance.now();
        const res = await localFetch(
            `${endpoint}/chat/completions`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                ...(activeSignal ? { signal: activeSignal } : {}),
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
        assertRequestActive(activeSignal);

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            assertRequestActive(activeSignal);
            throw new CouldNotRunError(`Local LLM server returned HTTP ${res.status}: ${body.slice(0, 200)}`);
        }

        let data;
        try {
            data = await res.json();
        } catch (err) {
            assertRequestActive(activeSignal);
            throw new CouldNotRunError(`Local LLM server returned a body that is not JSON — ${err.message}`);
        }
        assertRequestActive(activeSignal);
        const totalMs = Math.max(1, Math.round(performance.now() - t0));
        const usage = readUsage(data.usage);
        if (data.choices?.[0]?.finish_reason === "length") {
            const diagnosticPath = saveIncompleteResponse({ requestId: activeLifecycle?.id ?? requestId ?? null, model, maxTokens, response: data });
            const note = diagnosticPath ? ` Saved incomplete response to ${diagnosticPath}.` : " Could not save incomplete response diagnostic.";
            throw Object.assign(new CouldNotRunError(incompleteGenerationMessage(data.usage) + note), { diagnosticPath });
        }
        const rawContent = data.choices?.[0]?.message?.content ?? "";
        const { completionTokens } = usage;

        const out = {
            requestId: activeLifecycle?.id ?? null,
            content: stripThinking(rawContent),
            rawContent,
            maxTokens,
            ...usage,
            totalMs,
            queuedMs: lock.queuedMs,
            tokPerSec: rate(completionTokens, totalMs),
        };
        ownLifecycle?.complete({ phase: "completed", usage: out, elapsedMs: totalMs, rollback: "not_applicable" });
        return out;
    } catch (err) {
        ownLifecycle?.fail({
            reason: err instanceof RailError ? "rail_error" : err?.code === "LOCAL_REQUEST_ABORTED" ? "aborted" : "failed",
            phase: activeLifecycle?.phase() ?? "generation",
            rollback: "not_applicable",
            usage: null,
        });
        throw err;
    } finally {
        stopProgress();
        activeSignal?.removeEventListener("abort", stopProgress);
        if (signal && controller) signal.removeEventListener("abort", forwardAbort);
        unregisterSignals();
        lock.release();
    }
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
    signal,
    lifecycle = null,
    requestId,
    stateDir,
    trackLifecycle = true,
    exitOnSignal = true,
    fetchImpl = globalThis.fetch,
}) {
    const endpoint = assertLoopback(baseUrl, { allowRemote });
    const { names, texts } = readSlot(dir, { maxInputBytes });

    const ownLifecycle = !lifecycle && trackLifecycle !== false
        ? beginLifecycle({ mode: "dedup", model, endpoint, phase: "embedding", requestId, stateDir })
        : null;
    const activeLifecycle = lifecycle ?? ownLifecycle;
    const controller = ownLifecycle ? ownLifecycle.controller : null;
    const activeSignal = signal ?? controller?.signal;
    if (signal && controller && signal !== controller.signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    const unregisterSignals = ownLifecycle
        ? registerSignalCancel((sig) => {
            const interruptedPhase = activeLifecycle.phase();
            controller.abort();
            releaseActiveLocks();
            const cancelled = ownLifecycle.cancel({ signal: sig, reason: "interrupted", phase: interruptedPhase, rollback: "not_applicable", providerCancellation: "unknown", usage: null });
            console.error(`Interrupted by ${sig}; rollback=not_applicable.`);
            console.error(cancelled.receipt);
            if (exitOnSignal) process.exit(2);
        })
        : () => {};

    try {
        activeLifecycle?.setPhase("embedding", { model, endpoint });
        const t0 = performance.now();
        const res = await localFetch(
            `${endpoint}/embeddings`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                ...(activeSignal ? { signal: activeSignal } : {}),
                body: JSON.stringify({ model, input: texts }),
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
        const vectors = parseEmbeddings(data, names.length);
        const totalMs = Math.max(1, Math.round(performance.now() - t0));
        const promptTokens = Number.isSafeInteger(data.usage?.prompt_tokens) && data.usage.prompt_tokens >= 0 ? data.usage.prompt_tokens : null;
        const result = {
            requestId: activeLifecycle?.id ?? null,
            pairs: rankDuplicatePairs(names, vectors, threshold),
            files: names.length,
            promptTokens,
            totalMs,
        };
        ownLifecycle?.complete({ phase: "completed", usage: { input: promptTokens, output: null, cached: null, reasoning: null }, elapsedMs: totalMs, rollback: "not_applicable" });
        return result;
    } catch (err) {
        ownLifecycle?.fail({
            reason: err instanceof RailError ? "rail_error" : err?.code === "LOCAL_REQUEST_ABORTED" ? "aborted" : "failed",
            phase: activeLifecycle?.phase() ?? "embedding",
            rollback: "not_applicable",
            usage: null,
        });
        throw err;
    } finally {
        unregisterSignals();
    }
}

export function formatDedupReceipt({ model, promptTokens = null, totalMs = null }) {
    return formatPassReceipt({ mode: "dedup", model, promptTokens, totalMs });
}

function splitLines(text) {
    const trailingNewline = text.endsWith("\n");
    return { lines: (trailingNewline ? text.slice(0, -1) : text).split("\n"), trailingNewline };
}

export function parseLineRange(spec, lineCount, flagName = "--lines") {
    const m = /^(\d+)-(\d+)$/.exec(String(spec));
    if (!m) throw new CouldNotRunError(`Invalid ${flagName} range ${JSON.stringify(spec)} (expected start-end)`);
    const start = Math.max(1, Number(m[1]));
    const end = Math.min(lineCount, Number(m[2]));
    if (start > end) throw new CouldNotRunError(`Invalid ${flagName} range: start ${start} > end ${end}`);
    return { start, end };
}

function readUtf8Validated(filePath, label = "Target") {
    if (!fs.existsSync(filePath)) {
        throw new CouldNotRunError(`${label} file does not exist: ${filePath}`);
    }
    const bytes = fs.readFileSync(filePath);
    const text = bytes.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(bytes)) {
        throw new CouldNotRunError(`Refused ${filePath}: it is not valid UTF-8, so rewriting any line would change the bytes of every line`);
    }
    return { bytes, text };
}

function parseContextFileSpec(spec, existsFn = fs.existsSync) {
    const raw = String(spec);
    const m = /^(.*):(\d+-\d+)$/.exec(raw);
    if (m && m[1] !== "" && (!existsFn(raw) || existsFn(m[1]))) {
        return { filePath: m[1], range: m[2] };
    }
    return { filePath: raw, range: null };
}

export function numberedText(lines, firstNumber) {
    const width = String(firstNumber + lines.length - 1).length;
    return lines.map((line, i) => `${String(firstNumber + i).padStart(width)}\t${line}`).join("\n");
}

export function numberedFileBlock(label, lines, firstNumber) {
    const last = firstNumber + lines.length - 1;
    return `${label} lines ${firstNumber}-${last}, each line prefixed with its line number and a tab:\n\`\`\`\n${numberedText(lines, firstNumber)}\n\`\`\``;
}

export function resolveContextSections({ filePath = null, fileLines = null, contexts = [], contextFiles = [], numberLines = false } = {}) {
    const sections = [];
    if (contexts.length > 0) {
        if (!filePath) throw new CouldNotRunError("--context selects lines of --file, and no --file was given");
        const lines = fileLines ?? splitLines(readUtf8Validated(filePath, "Target").text).lines;
        for (const spec of contexts) {
            const { start, end } = parseLineRange(spec, lines.length, "--context");
            sections.push({
                label: `${path.basename(filePath)} lines ${start}-${end}`,
                text: numberLines ? numberedText(lines.slice(start - 1, end), start) : lines.slice(start - 1, end).join("\n"),
            });
        }
    }
    for (const spec of contextFiles) {
        const parsed = parseContextFileSpec(spec);
        const { text } = readUtf8Validated(parsed.filePath, "Context");
        const { lines } = splitLines(text);
        if (parsed.range) {
            const { start, end } = parseLineRange(parsed.range, lines.length, "--context-file");
            sections.push({
                label: `${path.basename(parsed.filePath)} lines ${start}-${end}`,
                text: numberLines ? numberedText(lines.slice(start - 1, end), start) : lines.slice(start - 1, end).join("\n"),
            });
        } else {
            sections.push({
                label: path.basename(parsed.filePath),
                text: numberLines ? numberedText(lines, 1) : text.endsWith("\n") ? text.slice(0, -1) : text,
            });
        }
    }
    return sections.map(
        (s) => `Reference context (read-only, do NOT return these lines — ${s.label}):\n\`\`\`\n${s.text}\n\`\`\``,
    );
}

const isBlankLine = (line) => /^[ \t]*\r?$/.test(line);

function trimBlankEdges(lines) {
    let start = 0;
    while (start < lines.length && isBlankLine(lines[start])) start += 1;
    let end = lines.length;
    while (end > start && isBlankLine(lines[end - 1])) end -= 1;
    return lines.slice(start, end);
}

export function usualBlankRun(lines) {
    const counts = new Map();
    let run = 0;
    let seenNonBlank = false;
    for (const line of lines) {
        if (isBlankLine(line)) {
            if (seenNonBlank) run += 1;
        } else {
            if (seenNonBlank && run > 0) counts.set(run, (counts.get(run) ?? 0) + 1);
            seenNonBlank = true;
            run = 0;
        }
    }
    if (counts.size === 0) return 0;
    let bestLen = 1;
    let bestFreq = -1;
    for (const [len, freq] of counts) {
        if (freq > bestFreq || (freq === bestFreq && len < bestLen)) {
            bestLen = len;
            bestFreq = freq;
        }
    }
    return bestLen;
}

export function spliceInsertion(allLines, splitIndex, replyText, seamBlankLines = null) {
    const rawLines = splitLines(replyText.replace(/\r\n/g, "\n")).lines;
    const inserted = trimBlankEdges(rawLines);
    if (inserted.length === 0) {
        throw new CouldNotRunError("Empty insertion output; no edit accepted");
    }
    const before = allLines.slice(0, splitIndex);
    const after = allLines.slice(splitIndex);
    let prefixEnd = before.length;
    while (prefixEnd > 0 && isBlankLine(before[prefixEnd - 1])) prefixEnd -= 1;
    let suffixStart = 0;
    while (suffixStart < after.length && isBlankLine(after[suffixStart])) suffixStart += 1;
    const existingSeam = (before.length - prefixEnd) + suffixStart;
    const seam = seamBlankLines !== null ? seamBlankLines : existingSeam > 0 ? existingSeam : usualBlankRun(allLines);
    const prefix = before.slice(0, prefixEnd);
    const suffix = after.slice(suffixStart);
    const gap = Array(seam).fill("");
    return [
        ...prefix,
        ...(prefix.length > 0 ? gap : []),
        ...inserted,
        ...(suffix.length > 0 ? gap : []),
        ...suffix,
    ];
}

function buildInsertionPromptSection(filePath, allLines, splitIndex) {
    const beforeStart = Math.max(0, splitIndex - 10);
    const afterEnd = Math.min(allLines.length, splitIndex + 5);
    const parts = [
        `Insertion point: immediately after line ${splitIndex} (before line ${splitIndex + 1}) of ${path.basename(filePath)}.`,
        "Return ONLY the new code to insert. Do NOT repeat any existing anchor lines.",
    ];
    if (splitIndex > beforeStart) {
        parts.push(
            `Anchor before insertion point (read-only, lines ${beforeStart + 1}-${splitIndex}):\n\`\`\`\n${allLines.slice(beforeStart, splitIndex).join("\n")}\n\`\`\``,
        );
    }
    if (afterEnd > splitIndex) {
        parts.push(
            `Anchor after insertion point (read-only, lines ${splitIndex + 1}-${afterEnd}):\n\`\`\`\n${allLines.slice(splitIndex, afterEnd).join("\n")}\n\`\`\``,
        );
    }
    return parts.join("\n\n");
}

function describeVerifyFault(check) {
    return check.error
        ? `failed to run (${check.error.message})`
        : check.signal
          ? `was killed by ${check.signal}`
          : `exited ${check.status}`;
}

function saveCandidateReply(content) {
    try {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-local-llm-reply-"));
        const saved = path.join(dir, "reply.txt");
        fs.writeFileSync(saved, content, { encoding: "utf8", mode: 0o600 });
        return saved;
    } catch {
        return null;
    }
}

function saveIncompleteResponse(diagnostic) {
    let dir;
    try {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-local-llm-incomplete-"));
        const saved = path.join(dir, "response.json");
        fs.writeFileSync(saved, JSON.stringify(diagnostic, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
        return saved;
    } catch {
        if (dir) {
            try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
        }
        return null;
    }
}

export async function verifyGatedTransform({
    filePath,
    lineRange = null,
    insertAfter = null,
    insertBefore = null,
    seamBlankLines = null,
    contexts = [],
    contextFiles = [],
    instruction,
    verifyCmd,
    precheckCmd = null,
    preflight = false,
    verifyExpect = null,
    model = ROLE_MODELS.code,
    baseUrl = DEFAULT_BASE_URL,
    allowRemote = false,
    maxInputBytes = DEFAULT_MAX_INPUT_BYTES,
    maxTokens = 4096,
    progress = false,
    effort = "low",
    retries = DEFAULT_RETRIES,
    noLock = false,
    signal,
    lifecycle = null,
    requestId,
    stateDir,
    trackLifecycle = true,
    exitOnSignal = true,
    chatFn = callLocalChat,
    execFn = runVerify,
}) {
    if (!verifyCmd) {
        throw new CouldNotRunError("transform requires --verify <cmd>: every local edit is gated by a verify command, and kept only on its exit 0");
    }
    if (!Number.isSafeInteger(maxTokens) || maxTokens < 1) {
        throw new CouldNotRunError("--max-tokens takes a positive safe integer");
    }
    if (precheckCmd !== null && (typeof precheckCmd !== "string" || !precheckCmd.trim())) {
        throw new CouldNotRunError("--precheck requires a non-empty command");
    }
    let expectRegex = null;
    if (verifyExpect !== null && verifyExpect !== undefined) {
        if (typeof verifyExpect !== "string" || verifyExpect === "") {
            throw new CouldNotRunError("--verify-expect requires a non-empty regular expression");
        }
        try {
            expectRegex = new RegExp(verifyExpect);
        } catch (err) {
            throw new CouldNotRunError(`Invalid --verify-expect regex ${JSON.stringify(verifyExpect)}: ${err.message}`);
        }
    }
    const modeCount = [lineRange !== null, insertAfter !== null, insertBefore !== null].filter(Boolean).length;
    if (modeCount > 1) {
        throw new CouldNotRunError("--lines, --insert-after, and --insert-before cannot be combined");
    }
    const insertMode = insertAfter !== null || insertBefore !== null;
    if (seamBlankLines !== null && !insertMode) {
        throw new CouldNotRunError("--seam-blank-lines requires --insert-after or --insert-before");
    }
    if (seamBlankLines !== null && (!Number.isSafeInteger(seamBlankLines) || seamBlankLines < 0)) {
        throw new CouldNotRunError(`--seam-blank-lines takes a whole number of at least 0, not ${JSON.stringify(seamBlankLines)}`);
    }
    const { bytes: originalBytes, text: originalText } = readUtf8Validated(filePath, "Target");
    const parsedFile = splitLines(originalText);
    const trailingNewline = originalText === "" ? true : parsedFile.trailingNewline;
    const allLines = originalText === "" && insertMode ? [] : parsedFile.lines;

    let startLine = 1;
    let endLine = allLines.length;
    let splitIndex = null;
    if (insertAfter !== null) {
        if (!Number.isSafeInteger(insertAfter) || insertAfter < 0 || insertAfter > allLines.length) {
            throw new CouldNotRunError(`Invalid --insert-after line ${insertAfter}: file has ${allLines.length} line(s)`);
        }
        splitIndex = insertAfter;
    } else if (insertBefore !== null) {
        if (!Number.isSafeInteger(insertBefore) || insertBefore < 1 || insertBefore > allLines.length + 1) {
            throw new CouldNotRunError(`Invalid --insert-before line ${insertBefore}: file has ${allLines.length} line(s)`);
        }
        splitIndex = insertBefore - 1;
    } else if (lineRange) {
        ({ start: startLine, end: endLine } = parseLineRange(lineRange, allLines.length));
    }

    const contextSections = resolveContextSections({ filePath, fileLines: allLines, contexts, contextFiles });
    const contextBlock = contextSections.length > 0 ? `${contextSections.join("\n\n")}\n\n` : "";
    const targetSlice = insertMode ? null : allLines.slice(startLine - 1, endLine).join("\n");

    const ownLifecycle = !lifecycle && trackLifecycle !== false
        ? beginLifecycle({ mode: "transform", model, endpoint: baseUrl, phase: preflight ? "preflight" : "generation", target: filePath, requestId, stateDir })
        : null;
    const activeLifecycle = lifecycle ?? ownLifecycle;
    const abortController = activeLifecycle?.controller ?? new AbortController();
    if (signal) {
        if (signal.aborted) abortController.abort();
        else signal.addEventListener("abort", () => abortController.abort(), { once: true });
    }

    let kept = false;
    let verifying = null;
    const stopOnAbort = () => stopVerify(verifying);
    abortController.signal.addEventListener("abort", stopOnAbort);
    let interrupted = false;
    const restore = () => {
        try {
            fs.writeFileSync(filePath, originalBytes);
        } catch (err) {
            throw new CouldNotRunError(`Could not restore ${filePath} (${err.message}): it may still hold the model's unverified edit`);
        }
    };
    const onSignal = (sig) => {
        if (interrupted) return;
        interrupted = true;
        const interruptedPhase = activeLifecycle?.phase() ?? (verifying ? "verification" : "generation");
        abortController.abort();
        stopVerify(verifying);
        releaseActiveLocks();
        let outcome = kept ? "the verified edit stands" : `restored ${filePath}`;
        let rollbackStatus = kept ? "not_applicable" : "restored";
        if (!kept) {
            try {
                restore();
            } catch (err) {
                outcome = err.message;
                rollbackStatus = "failed";
            }
        }
        const cancelled = activeLifecycle?.cancel({
            signal: sig,
            reason: "interrupted",
            phase: interruptedPhase,
            rollback: rollbackStatus,
            providerCancellation: "unknown",
            usage: null,
        });
        for (const s of RESTORE_SIGNALS) process.off(s, onSignal);
        console.error(`Interrupted by ${sig}; ${outcome}.`);
        if (cancelled?.receipt) console.error(cancelled.receipt);
        if (exitOnSignal) process.exit(2);
    };
    for (const sig of RESTORE_SIGNALS) process.on(sig, onSignal);

    let lastError = "";
    const retryFailures = [];
    const recordFailure = (attempt, output, phase = "verification") => {
        lastError = output || `${phase === "precheck" ? "Precheck" : "Verify"} exited 1 without output.`;
        retryFailures.push({ attempt, phase, feedback: tail(lastError, FEEDBACK_CHARS) });
    };
    const assertActive = () => assertRequestActive(abortController.signal);
    const checkCandidate = async (cmd, phase, attempt, content) => {
        assertActive();
        activeLifecycle?.setPhase(phase, { attempt });
        let check;
        try {
            check = await execFn(cmd, { onSpawn: (child) => (verifying = child) });
        } finally {
            verifying = null;
        }
        const output = [check.stdout, check.stderr].filter(Boolean).join("\n").trim();
        if (check.error || check.signal || (check.status !== 0 && check.status !== 1)) {
            const savedPath = saveCandidateReply(content);
            const savedNote = savedPath ? ` Saved candidate reply to ${savedPath}.` : "";
            throw new CouldNotRunError(
                `${phase === "precheck" ? "Precheck" : "Verify"} command ${describeVerifyFault(check)}, which is no verdict (0 green, 1 red); restored ${filePath}.${savedNote}${output ? `\n${tail(output, 400)}` : ""}`,
            );
        }
        assertActive();
        return { ...check, output };
    };
    let promptTokens = 0;
    let completionTokens = 0;
    let reasoningTokens = 0;
    let cachedPromptTokens = 0;
    let modelMs = 0;
    let queuedMs = 0;
    let preflightOutcome = null;
    let effectiveMaxTokens;
    try {
        if (preflight) {
            assertActive();
            activeLifecycle?.setPhase("preflight", { attempt: 0 });
            const baseline = await execFn(verifyCmd, { onSpawn: (child) => (verifying = child) });
            verifying = null;
            assertActive();
            if (baseline.status === 0) {
                preflightOutcome = "green";
            } else if (baseline.status === 1) {
                preflightOutcome = "red";
            } else {
                const baselineOutput = [baseline.stdout, baseline.stderr].filter(Boolean).join("\n").trim();
                throw new CouldNotRunError(
                    `Verify preflight ${describeVerifyFault(baseline)}, which is no verdict (0 green, 1 red); skipped model call and left ${filePath} untouched.${baselineOutput ? `\n${tail(baselineOutput, 400)}` : ""}`,
                );
            }
        }

        for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
            assertActive();
            const returnKind = insertMode ? "the new code to insert" : "the replacement code";
            const retryFeedback = lastError
                ? `\n\nThe previous attempt failed ${retryFailures.at(-1).phase}; the end of its output:\n\`\`\`\n${tail(lastError, FEEDBACK_CHARS)}\n\`\`\`\nFix the issue and return ONLY ${returnKind}.`
                : "";
            const bodySection = insertMode
                ? buildInsertionPromptSection(filePath, allLines, splitIndex)
                : `Target code (${path.basename(filePath)} lines ${startLine}-${endLine}):\n\`\`\`\n${targetSlice}\n\`\`\``;

            const messages = [
                {
                    role: "system",
                    content:
                        `You are a Portulan local code worker. Return ONLY ${returnKind} inside a single fenced code block (\`\`\` ... \`\`\`). ` +
                        (insertMode ? "Never repeat existing anchor lines. " : "") +
                        "Never add comments that record change history (dates, proposal/milestone numbers, PR/issue numbers, reviewer names) or narrate obvious code.",
                },
                {
                    role: "user",
                    content: `Instruction: ${instruction}\n\n${contextBlock}${bodySection}${retryFeedback}`,
                },
            ];

            activeLifecycle?.setPhase("generation", { attempt, model, endpoint: baseUrl });
            const reply = await chatFn({ baseUrl, allowRemote, model, messages, maxInputBytes, maxTokens, progress, effort, noLock, signal: abortController.signal, lifecycle: activeLifecycle, exitOnSignal });
            assertActive();
            const reportedBudget = reply.maxTokens === undefined ? maxTokens : Number.isSafeInteger(reply.maxTokens) && reply.maxTokens > 0 ? reply.maxTokens : null;
            effectiveMaxTokens = attempt === 1 ? reportedBudget : effectiveMaxTokens === reportedBudget ? effectiveMaxTokens : null;
            promptTokens = sum(promptTokens, reply.promptTokens);
            completionTokens = sum(completionTokens, reply.completionTokens);
            reasoningTokens = sum(reasoningTokens, reply.reasoningTokens);
            cachedPromptTokens = sum(cachedPromptTokens, reply.cachedPromptTokens);
            modelMs = sum(modelMs, reply.totalMs);
            queuedMs = sum(queuedMs, reply.queuedMs ?? 0);

            const extracted = extractFencedCode(reply.content).replace(/\n$/, "");
            const updatedLines = insertMode
                ? spliceInsertion(allLines, splitIndex, extracted, seamBlankLines)
                : [...allLines.slice(0, startLine - 1), extracted, ...allLines.slice(endLine)];
            fs.writeFileSync(filePath, updatedLines.join("\n") + (trailingNewline ? "\n" : ""), "utf8");

            if (precheckCmd !== null) {
                const precheck = await checkCandidate(precheckCmd, "precheck", attempt, reply.content);
                assertActive();
                if (precheck.status === 1) {
                    recordFailure(attempt, precheck.output, "precheck");
                    continue;
                }
            }
            const check = await checkCandidate(verifyCmd, "verification", attempt, reply.content);
            assertActive();
            const { output } = check;
            if (check.status === 0) {
                if (expectRegex && !expectRegex.test(output)) {
                    recordFailure(attempt, `Verify exited 0 without matching --verify-expect /${verifyExpect}/.${output ? `\n${output}` : ""}`);
                    continue;
                }
                kept = true;
                activeLifecycle?.complete({
                    phase: "completed",
                    rollback: "not_applicable",
                    usage: { input: promptTokens, output: completionTokens, cached: cachedPromptTokens, reasoning: reasoningTokens },
                });
                return {
                    ok: true,
                    requestId: activeLifecycle?.id ?? null,
                    attempts: attempt,
                    preflight: preflightOutcome,
                    retryFailures,
                    receipt: formatPassReceipt({
                        mode: "transform",
                        model,
                        attempts: attempt,
                        promptTokens,
                        completionTokens,
                        reasoningTokens,
                        cachedPromptTokens,
                        totalMs: modelMs,
                        queuedMs,
                        preflight: preflightOutcome,
                        maxTokens: effectiveMaxTokens,
                        tokPerSec: rate(completionTokens, modelMs),
                        target: path.basename(filePath),
                    }),
                };
            }
            recordFailure(attempt, output);
        }

        restore();
        activeLifecycle?.fail({
            reason: retryFailures.at(-1).phase === "precheck" ? "red_precheck" : "red_verify",
            phase: retryFailures.at(-1).phase,
            rollback: "restored",
            usage: { input: promptTokens, output: completionTokens, cached: cachedPromptTokens, reasoning: reasoningTokens },
        });
        return {
            ok: false,
            requestId: activeLifecycle?.id ?? null,
            attempts: retries + 1,
            retryFailures,
            error: `${retryFailures.at(-1).phase === "precheck" ? "Precheck" : "Verification"} remained red after ${retries + 1} attempt(s); restored ${filePath} byte-for-byte.\n${tail(lastError, FEEDBACK_CHARS)}`,
        };
    } catch (err) {
        let rollbackStatus = kept ? "not_applicable" : "restored";
        if (!kept) {
            try { restore(); } catch { rollbackStatus = "failed"; }
        }
        activeLifecycle?.fail({
            reason: err instanceof RailError ? "rail_error" : err?.code === "LOCAL_REQUEST_ABORTED" ? "aborted" : "failed",
            phase: activeLifecycle?.phase() ?? "generation",
            rollback: rollbackStatus,
            usage: null,
        });
        throw err;
    } finally {
        try {
            if (!kept) restore();
        } finally {
            abortController.signal.removeEventListener("abort", stopOnAbort);
            for (const sig of RESTORE_SIGNALS) process.off(sig, onSignal);
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

// Not in EVAL_PROMPTS: the A/B record hashes it.
export const READ_FIXTURES = Object.freeze({ module: "quota-module.js.txt", log: "gate-run.log.txt" });
export const READ_USE_ENDING = "Give line numbers. If the file does not contain it, say so.";
export const READ_ANSWER_FORM =
    "End with one line in exactly this form: `ANSWER: <the value asked for, or - when the question asks only where> | LINES: <the line numbers, separated by commas>`. " +
    "If the file does not contain it, end with `ANSWER: ABSENT | LINES: none`.";
export const READ_QUESTIONS = Object.freeze(
    [
        { id: "module-declares", fixture: "module", kind: "lines", question: "Which line declares the function `refillBucket`?", anchor: "function refillBucket", lines: [26] },
        { id: "module-constant", fixture: "module", kind: "value", question: "What value is the constant `MAX_BURST` set to?", anchor: "MAX_BURST = ", value: "48", lines: [5] },
        { id: "module-calls", fixture: "module", kind: "lines", question: "Which lines call `refillBucket`, not counting its declaration?", anchor: "refillBucket(", lines: [48, 62], except: [26] },
        { id: "module-absent-function", fixture: "module", kind: "absent", question: "Which line declares the function `drainQueue`?", needle: "drainQueue" },
        { id: "module-absent-env", fixture: "module", kind: "absent", question: "Which line reads an environment variable through `process.env`?", needle: "process.env" },
        { id: "log-skipped", fixture: "log", kind: "value", question: "How many tests were skipped, according to the summary at the end?", anchor: "# skipped", value: "2", lines: [39] },
        { id: "log-first-failure", fixture: "log", kind: "lines", question: "Which line holds the error message of the first failing test?", anchor: "Expected values", lines: [12], except: [26] },
        { id: "log-absent-coverage", fixture: "log", kind: "absent", question: "What line-coverage percentage does this log report?", needle: "coverage" },
    ].map((q) => Object.freeze({ ...q, ...(q.lines ? { lines: Object.freeze(q.lines) } : {}), ...(q.except ? { except: Object.freeze(q.except) } : {}) })),
);
export const SCREEN_TASKS = Object.freeze(["code", "codify", "handoff", "read"]);

export function readFixtureText(fixture) {
    const name = READ_FIXTURES[fixture];
    if (!name) throw new CouldNotRunError(`Unknown read fixture: ${fixture}`);
    try {
        return fs.readFileSync(new URL(`../screen/read/${name}`, import.meta.url), "utf8");
    } catch (err) {
        throw new CouldNotRunError(`The read screen's fixture ${name} is not in screen/read/ beside this runner's directory — ${err.message}`);
    }
}

export function readMessages(question) {
    const { lines } = splitLines(readFixtureText(question.fixture));
    return [
        {
            role: "system",
            content: "You answer one question about one file. Each line of the file is prefixed with its line number and a tab. Cite only lines the file shows, and never guess.",
        },
        {
            role: "user",
            content: `${question.question} ${READ_USE_ENDING}\n${READ_ANSWER_FORM}\n\n${numberedFileBlock(READ_FIXTURES[question.fixture], lines, 1)}`,
        },
    ];
}

export function gradeReadAnswer(question, rawText) {
    const cleaned = stripThinking(rawText).replace(/[*`]/g, "");
    const re = /^[ \t>-]*ANSWER:\s*(.*?)\s*\|\s*LINES:\s*(.*?)\s*$/gim;
    const matches = [...cleaned.matchAll(re)];
    if (matches.length === 0) {
        return { ok: false, detail: "no ANSWER line" };
    }
    const match = matches[matches.length - 1];
    const value = match[1].replace(/^["']/, "").replace(/["'.]+$/, "").trim();
    const cited = [...new Set((match[2].match(/\d+/g) ?? []).map(Number))].sort((a, b) => a - b);
    const absent = /^absent$/i.test(value);
    const want = question.kind === "absent" ? [] : [...question.lines].sort((a, b) => a - b);
    const sameLines = cited.length === want.length && cited.every((n, i) => n === want[i]);
    const shown = (list) => `[${list.join(",")}]`;
    let ok;
    let detail;
    if (question.kind === "absent") {
        ok = absent && cited.length === 0;
        detail = `absent=${absent} lines=${shown(cited)}`;
    } else if (question.kind === "lines") {
        ok = !absent && sameLines;
        detail = `lines=${shown(cited)} want=${shown(want)}`;
    } else {
        ok = !absent && sameLines && value.toLowerCase() === String(question.value).toLowerCase();
        detail = `value=${JSON.stringify(value)} lines=${shown(cited)} want=${JSON.stringify(String(question.value))}@${shown(want)}`;
    }
    return { ok, detail };
}

export function readTaskDetail(verdicts) {
    const wrong = [];
    let right = 0;
    let trapsRight = 0;
    READ_QUESTIONS.forEach((question, i) => {
        if (verdicts[i].ok) {
            right += 1;
            if (question.kind === "absent") trapsRight += 1;
        } else {
            wrong.push(`${question.id}(${verdicts[i].detail})`);
        }
    });
    const traps = READ_QUESTIONS.filter((q) => q.kind === "absent").length;
    return { ok: wrong.length === 0, detail: `right=${right}/${READ_QUESTIONS.length} traps=${trapsRight}/${traps}${wrong.length > 0 ? ` wrong=${wrong.join(" ")}` : ""}` };
}

async function runReadTask({ model, chatFn, request }) {
    const verdicts = [];
    let totalMs = 0;
    let tokens = 0;
    for (const question of READ_QUESTIONS) {
        const reply = await chatFn({ ...request, model, messages: readMessages(question) });
        verdicts.push(gradeReadAnswer(question, reply.content));
        totalMs = sum(totalMs, reply.totalMs ?? null);
        tokens = sum(tokens, reply.completionTokens ?? null);
    }
    const { ok, detail } = readTaskDetail(verdicts);
    return { task: "read", model, ok, detail, totalMs, tokPerSec: rate(tokens, totalMs) };
}

export async function runRoleEval({
    model = ROLE_MODELS.code,
    tasks = SCREEN_TASKS,
    baseUrl = DEFAULT_BASE_URL,
    allowRemote = false,
    effort = "low",
    signal,
    lifecycle = null,
    chatFn = callLocalChat,
    predicates,
} = {}) {
    for (const task of tasks) {
        if (task !== "read" && !Object.hasOwn(EVAL_PROMPTS, task)) throw new CouldNotRunError(`Unknown eval task: ${task}`);
    }
    const grading = predicates ?? (tasks.some((task) => task !== "read") ? await loadPredicates() : null);

    const results = [];
    for (const task of tasks) {
        if (task === "read") {
            const request = { baseUrl, allowRemote, effort, ...(signal ? { signal } : {}), ...(lifecycle ? { lifecycle } : {}) };
            results.push(await runReadTask({ model, chatFn, request }));
            continue;
        }
        const reply = await chatFn({ baseUrl, allowRemote, model, effort, messages: EVAL_PROMPTS[task], ...(signal ? { signal } : {}), ...(lifecycle ? { lifecycle } : {}) });
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

export function abConditions({ repoRoot, hostCommand, spawnFn = spawnSync, journalPath = JOURNAL_GIT_PATH }) {
    const git = (...argv) => spawnFn("git", argv, { cwd: repoRoot, encoding: "utf8" });
    const head = git("rev-parse", "HEAD");
    if (head.error || head.status !== 0) throw new CouldNotRunError(`${repoRoot} names no commit (\`git rev-parse HEAD\` failed), and a record must name the one it was captured at`);
    const status = git("status", "--porcelain");
    if (status.error || status.status !== 0) throw new CouldNotRunError(`\`git status\` failed in ${repoRoot}, so the record could not say whether its tree was clean`);
    const journal = git("rev-parse", "--git-path", journalPath);
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
    const { turns, take, host, close } = journalledTurns({ journal, onTurn, hostFn, hostCommand });
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
                    const res = await host(hostPrompt(task));
                    const verdict = res.completed ? grade(task, res.output) : { ok: null, detail: null };
                    return { task, arm: "h", run, seed: null, model: hostModel, completed: res.completed, exit: res.exit, timedOut: res.timedOut, ms: res.ms, ...verdict, output: res.output };
                });
            }
        }
    } finally {
        close();
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

function journalledTurns({ journal, onTurn, hostFn, hostCommand }) {
    const turns = [];
    let running = null;
    const onSignal = (signal) => {
        if (running !== null) {
            stopVerify(running.child);
            fs.rmSync(running.cwd, { recursive: true, force: true });
        }
        releaseActiveLocks();
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
    const host = async (prompt) => {
        const res = await hostFn({ command: hostCommand, prompt, timeoutMs: HOST_TURN_TIMEOUT_MS, onSpawn: (child, cwd) => (running = { child, cwd }) });
        running = null;
        return res;
    };
    for (const signal of RESTORE_SIGNALS) process.on(signal, onSignal);
    return { turns, take, host, close: () => RESTORE_SIGNALS.forEach((signal) => process.off(signal, onSignal)) };
}

export function foldAb(turns, k = AB_K, tasks = AB_TASKS) {
    const cells = [];
    for (const task of tasks) {
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

export const READER_RECORD = "evals/ab/local-reader.json";
export const READER_REGISTER = "evals/ab/local-reader.md";
export const READER_RULED = "2026-11-20";
export const READER_JOURNAL_GIT_PATH = "portulan/local-reader-journal";
const QUESTION_FIELDS = "completed,detail,exit,id,ms,ok,output,timedOut";
const TURN_FIELDS = "arm,completed,detail,exit,model,ms,ok,questions,run,seed,task,timedOut";

export function readerHostCalls(k = AB_K) {
    return k * READ_QUESTIONS.length;
}

export function readFingerprints() {
    const sha = (text) => createHash("sha256").update(text).digest("hex");
    return {
        prompts: sha(JSON.stringify(READ_QUESTIONS.map(readMessages))),
        questions: sha(JSON.stringify(READ_QUESTIONS)),
        fixtures: sha(Object.entries(READ_FIXTURES).map(([fixture, name]) => `${name}\0${readFixtureText(fixture)}`).join("\0")),
        grader: sha(gradeReadAnswer.toString()),
    };
}

export function readHostPrompt(question) {
    return readMessages(question).map((m) => m.content).join("\n\n");
}

export function foldReadTurn(arm, questions) {
    const completed = questions.every((q) => q.completed === true);
    const stopped = questions.find((q) => q.completed !== true);
    return {
        completed,
        exit: arm === "l" ? null : completed ? 0 : stopped.exit,
        timedOut: questions.some((q) => q.timedOut === true),
        ms: questions.reduce((n, q) => n + q.ms, 0),
        ...(completed ? readTaskDetail(questions) : { ok: null, detail: null }),
    };
}

export async function captureReader({
    seed,
    k = AB_K,
    hostCommand,
    hostModel,
    model = ROLE_MODELS.code,
    baseUrl = DEFAULT_BASE_URL,
    conditions,
    screen = readFingerprints(),
    journal = null,
    chatFn = callLocalChat,
    hostFn = runHostTurn,
    onTurn = () => {},
}) {
    const endpoint = assertLoopback(baseUrl);
    const header = {
        record: READER_RECORD,
        k,
        seed,
        commit: conditions.commit,
        clean: conditions.clean,
        runner: RUNNER_FINGERPRINT,
        machine: conditions.machine,
        endpoint,
        model,
        hostCommand,
        hostVersion: conditions.hostVersion,
        hostModel,
        screen,
        captured: conditions.captured,
    };
    const opened = journal === null ? header : openJournal(journal, header);
    const { turns, take, host, close } = journalledTurns({ journal, onTurn, hostFn, hostCommand });
    const answer = (question, completed, output) => (completed ? (({ ok, detail }) => ({ ok, detail }))(gradeReadAnswer(question, output)) : { ok: null, detail: null });
    try {
        for (let run = 0; run < k; run += 1) {
            await take({ task: "read", arm: "l", run }, async () => {
                const turnSeedValue = turnSeed(seed, "read", run);
                const questions = [];
                for (const question of READ_QUESTIONS) {
                    const reply = await chatFn({ baseUrl: endpoint, model, effort: "low", messages: readMessages(question), seed: turnSeedValue });
                    questions.push({ id: question.id, completed: true, exit: null, timedOut: false, ms: reply.totalMs, ...answer(question, true, reply.content), output: reply.content });
                }
                return { task: "read", arm: "l", run, seed: turnSeedValue, model, ...foldReadTurn("l", questions), questions };
            });
        }
        for (let run = 0; run < k; run += 1) {
            await take({ task: "read", arm: "h", run }, async () => {
                const questions = [];
                for (const question of READ_QUESTIONS) {
                    const res = await host(readHostPrompt(question));
                    questions.push({ id: question.id, completed: res.completed, exit: res.exit, timedOut: res.timedOut, ms: res.ms, ...answer(question, res.completed, res.output), output: res.output });
                }
                return { task: "read", arm: "h", run, seed: null, model: hostModel, ...foldReadTurn("h", questions), questions };
            });
        }
    } finally {
        close();
    }
    turns.sort((a, b) => AB_ARMS.indexOf(a.arm) * k + a.run - (AB_ARMS.indexOf(b.arm) * k + b.run));
    const record = {
        portulan: { abLocalReader: "1" },
        captured: opened.captured,
        source: { commit: conditions.commit, clean: conditions.clean, runner: opened.runner },
        machine: conditions.machine,
        k,
        seed,
        rulings: { k: AB_K_RULED, read: READER_RULED },
        screen: { ...screen },
        arms: {
            l: { endpoint, effort: "low", role: "code", model },
            h: { command: [...hostCommand], version: conditions.hostVersion, model: hostModel, timeoutMs: HOST_TURN_TIMEOUT_MS },
        },
        turns,
    };
    record.cells = foldAb(turns, k, ["read"]);
    return record;
}

function callFindings(id, t) {
    const red = [];
    if (typeof t?.completed !== "boolean" || typeof t?.timedOut !== "boolean") red.push(`${id} carries no boolean \`completed\` or \`timedOut\``);
    if (t?.completed === true && (typeof t?.ok !== "boolean" || typeof t?.detail !== "string")) red.push(`${id} completed and carries no verdict`);
    if (t?.completed === false && (t?.ok !== null || t?.detail !== null)) red.push(`${id} did not complete and carries a verdict anyway`);
    if (t?.exit !== null && !Number.isInteger(t?.exit)) red.push(`${id} carries an \`exit\` that is neither \`null\` nor an integer`);
    if (!Number.isInteger(t?.ms) || t.ms < 0) red.push(`${id} carries no whole-millisecond time`);
    return red;
}

export function verifyReaderShape(rec) {
    const red = [];
    const sha = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
    if (rec?.portulan?.abLocalReader !== "1") red.push("the record does not declare `portulan.abLocalReader: \"1\"` — this is not a local-reader A/B capture");
    if (!isNonEmpty(rec?.captured)) red.push("the record carries no `captured` time");
    if (!isNonEmpty(rec?.source?.commit) || typeof rec?.source?.clean !== "boolean" || !sha(rec?.source?.runner)) red.push("the record's `source` names no commit, clean flag and runner fingerprint");
    if (!isNonEmpty(rec?.machine)) red.push("the record names no machine");
    if (rec?.k !== AB_K) red.push(`the record's k is ${JSON.stringify(rec?.k)} where the maintainer ruled ${AB_K}`);
    if (!isNonEmpty(rec?.seed)) red.push("the record carries no seed, so no arm-L seed in it can be recomputed");
    if (!isNonEmpty(rec?.rulings?.k) || !isNonEmpty(rec?.rulings?.read)) red.push("the record carries no ruling for its k and for reading");
    if (!["prompts", "questions", "fixtures", "grader"].every((key) => sha(rec?.screen?.[key]))) red.push("the record carries no sha256 fingerprint of the reading prompts, questions, fixtures and grader");
    if (rec?.fixture !== undefined && !isNonEmpty(rec.fixture)) red.push("the record's `fixture` is present and is not a non-empty string");
    const l = rec?.arms?.l;
    const h = rec?.arms?.h;
    if (!isNonEmpty(l?.endpoint) || l?.effort !== "low" || l?.role !== "code" || !isNonEmpty(l?.model)) red.push("arm L does not record a loopback endpoint, `--effort low`, the code role and its model");
    if (!Array.isArray(h?.command) || h.command.length === 0 || !h.command.every(isNonEmpty) || !isNonEmpty(h?.version) || !isNonEmpty(h?.model)) red.push("arm H records no host command, version or model");
    if (!Number.isInteger(h?.timeoutMs) || h.timeoutMs <= 0) red.push("arm H records no per-turn timeout");
    if (!Array.isArray(rec?.turns) || rec.turns.length === 0) red.push("the record carries no turns");
    if (!Array.isArray(rec?.cells) || rec.cells.length === 0) red.push("the record publishes no cells");
    for (const t of Array.isArray(rec?.turns) ? rec.turns : []) {
        const id = `(read, ${t?.arm}, run ${t?.run})`;
        if (Object.keys(t ?? {}).sort().join(",") !== TURN_FIELDS) red.push(`${id} does not carry exactly the fields a reading turn records (${TURN_FIELDS})`);
        if (t?.task !== "read" || !AB_ARMS.includes(t?.arm) || !Number.isInteger(t?.run)) red.push(`${id} is not a turn of this matrix`);
        if (!isNonEmpty(t?.model)) red.push(`${id} names no model`);
        red.push(...callFindings(id, t));
        if (!Array.isArray(t?.questions) || t.questions.length !== READ_QUESTIONS.length) {
            red.push(`${id} does not carry the screen's ${READ_QUESTIONS.length} questions`);
            continue;
        }
        t.questions.forEach((q, i) => {
            const qid = `${id} question ${i + 1}`;
            if (Object.keys(q ?? {}).sort().join(",") !== QUESTION_FIELDS) red.push(`${qid} does not carry exactly the fields a question records (${QUESTION_FIELDS})`);
            if (typeof q?.output !== "string") red.push(`${qid} carries no output, so nobody can regrade it`);
            red.push(...callFindings(qid, q));
        });
    }
    if (red.length > 0) return red;
    try {
        const rendered = renderReaderRegister(rec);
        for (const hole of ["undefined", "NaN"]) if (rendered.includes(hole)) red.push(`the register rendered from this record contains \`${hole}\``);
    } catch (cause) {
        red.push(`the register cannot be rendered from this record — ${cause.message}`);
    }
    return red;
}

export function verifyReader(rec, screen = readFingerprints()) {
    const red = verifyReaderShape(rec);
    if (red.length > 0) return red;
    for (const key of ["prompts", "questions", "fixtures"]) {
        if (rec.screen[key] !== screen[key]) red.push(`the reading ${key} moved since capture, so the record measures a screen that no longer ships`);
    }
    const graderMoved = rec.screen.grader !== screen.grader;
    try {
        assertLoopback(rec.arms.l.endpoint);
    } catch (cause) {
        red.push(`arm L's endpoint is not loopback, so it is not the local model — ${cause.message}`);
    }
    if (rec.turns.length !== AB_ARMS.length * rec.k) red.push(`the record holds ${rec.turns.length} turn(s) where k=${rec.k} needs ${AB_ARMS.length * rec.k}`);
    const seen = new Set(rec.turns.map((t) => `${t.arm}\0${t.run}`));
    for (const arm of AB_ARMS) {
        for (let run = 0; run < rec.k; run += 1) if (!seen.has(`${arm}\0${run}`)) red.push(`no turn for (read, ${arm}, run ${run}) — the matrix is not total over k`);
    }
    for (const t of rec.turns) {
        const id = `(read, ${t.arm}, run ${t.run})`;
        if (t.arm === "l") {
            const want = turnSeed(rec.seed, "read", t.run);
            if (t.seed !== want) red.push(`${id} records seed ${t.seed} where the record's seed derives ${want}`);
            if (t.model !== rec.arms.l.model) red.push(`${id} names \`${t.model}\`, not arm L's model`);
        } else {
            if (t.seed !== null) red.push(`${id} records a seed, and arm H's command takes none`);
            if (t.model !== rec.arms.h.model) red.push(`${id} names \`${t.model}\`, not arm H's declared model`);
        }
        const ids = t.questions.map((q) => q.id);
        if (JSON.stringify(ids) !== JSON.stringify(READ_QUESTIONS.map((q) => q.id))) {
            red.push(`${id} asks ${ids.join(", ")}, not the screen's questions in the screen's order`);
            continue;
        }
        t.questions.forEach((q, i) => {
            const qid = `${id} question ${q.id}`;
            if (t.arm === "l" && (q.completed !== true || q.exit !== null || q.timedOut !== false)) red.push(`${qid} is an arm-L call recorded as a process — a local call either answers or aborts the capture`);
            if (t.arm === "h" && q.completed !== (q.exit === 0 && q.timedOut === false)) red.push(`${qid} records \`completed\` against its own exit and timeout`);
            if (!q.completed) return;
            const now = gradeReadAnswer(READ_QUESTIONS[i], q.output);
            if (now.ok !== q.ok || now.detail !== q.detail) {
                red.push(
                    `${qid} records ${q.ok ? "pass" : "fail"} \`${q.detail}\` where its output regrades ${now.ok ? "pass" : "fail"} \`${now.detail}\` — ` +
                        (graderMoved ? "the grader moved since capture, and the figures must hold under the screen that ships" : "a recorded verdict does not match its output"),
                );
            }
        });
        const folded = foldReadTurn(t.arm, t.questions);
        if (Object.keys(folded).some((key) => folded[key] !== t[key])) red.push(`${id} records a verdict, exit, timeout or time that does not fold from its ${READ_QUESTIONS.length} questions`);
    }
    try {
        if (JSON.stringify(foldAb(rec.turns, rec.k, ["read"])) !== JSON.stringify(rec.cells)) red.push("the published cells do not match a fresh fold of the turns — a figure has drifted from its own data");
    } catch (cause) {
        red.push(`the turns do not fold: ${cause.message}`);
    }
    return red;
}

export function renderReaderRegister(rec) {
    const k = rec.k;
    const cell = (arm) => {
        const found = rec.cells.find((c) => c.task === "read" && c.arm === arm);
        if (found === undefined) throw new Error(`the record publishes no cell for \`read\`/${arm}`);
        return found;
    };
    const n = READ_QUESTIONS.length;
    const state = (c) => (c.completed ? `\`${c.ok ? "pass" : "fail"}\`` : c.timedOut ? "**did-not-complete** (timed out)" : "**did-not-complete**");
    const lines = [
        "# The local-reader A/B record — what a run of the arms measured on find-and-quote reading",
        "",
        `> Rendered from \`${READER_RECORD}\` by \`local-llm.mjs eval --write\`. Do not edit by hand: it is`,
        "> regenerated from that file and byte-compared, so a hand-edit survives exactly until the next run.",
        ">",
        "> **The record is the unreproducible half.** Its turns are model events, captured once.",
    ];
    if (rec.fixture !== undefined) lines.push("", `> **SYNTHETIC FIXTURE: not a record of any run.** ${rec.fixture}`);
    lines.push(
        "",
        "## The conditions",
        "",
        `- **Taken:** ${rec.captured}`,
        `- **Commit:** \`${rec.source.commit}\`${rec.source.clean ? "" : " — **a dirty tree**, which is a fact about the runner and the grader that graded it"}`,
        `- **Machine:** ${rec.machine}`,
        `- **k:** ${k} turns per arm, the k the maintainer ruled for \`evals/ab/baseline.md\` on ${rec.rulings.k}`,
        `- **A turn:** one pass of the ${n} screen questions in \`screen/read/\`, each its own call, graded by \`gradeReadAnswer()\`; it passes only when all ${n} are right, and does not complete where any of its host calls does not (ruled ${rec.rulings.read})`,
        `- **Seed:** \`${rec.seed}\` — each arm-L turn's sampling seed derives from it, shared by its ${n} calls; arm H's command takes none`,
        `- **Arm L:** role \`${rec.arms.l.role}\` → \`${rec.arms.l.model}\`, through \`local-llm.mjs\` at \`--effort ${rec.arms.l.effort}\` with no host floor, against \`${rec.arms.l.endpoint}\`; each question's \`readMessages()\` verbatim`,
        `- **Arm H:** \`${rec.arms.h.command.join(" ")} <prompt>\`, host \`${rec.arms.h.version}\`, in an empty working directory, with a per-call timeout of ${Math.round(rec.arms.h.timeoutMs / 1000)}s; the prompt is the question's two messages joined by a blank line`,
        `- **Arm H's model:** \`${rec.arms.h.model}\`, as the operator declared it — the runner does not observe it`,
        `- **Runner source:** sha256 \`${rec.source.runner}\``,
        `- **Screen fingerprints:** prompts \`${rec.screen.prompts}\`, questions \`${rec.screen.questions}\`, fixtures \`${rec.screen.fixtures}\`, grader \`${rec.screen.grader}\``,
        "",
        "## The figures",
        "",
        "| Arm | Model | passed | failed | did-not-complete |",
        "|---|---|---|---|---|",
        ...rec.cells.map((c) => `| ${c.arm.toUpperCase()} | \`${c.model}\` | **${c.passed}**/${k} | ${c.failed} | ${c.didNotComplete} |`),
        "",
        `**Arm L ${cell("l").passed}/${k}, arm H ${cell("h").passed}/${k} — ${cell("l").passed === cell("h").passed ? "a tie" : `a difference of ${cell("l").passed > cell("h").passed ? "+" : ""}${cell("l").passed - cell("h").passed}`}, recorded as measured.**`,
        "",
        "## Every turn",
        "",
        "| Arm | run | seed | verdict | exit | ms | detail |",
        "|---|---|---|---|---|---|---|",
        ...rec.turns.map((t) => `| ${t.arm.toUpperCase()} | ${t.run} | ${t.seed ?? "—"} | ${state(t)} | ${t.exit ?? "—"} | ${t.ms} | ${t.detail === null ? "—" : `\`${t.detail}\``} |`),
        "",
        "## Every question, so each turn can be checked against them",
        "",
        "| Arm | run | question | verdict | exit | ms | detail |",
        "|---|---|---|---|---|---|---|",
        ...rec.turns.flatMap((t) => t.questions.map((q) => `| ${t.arm.toUpperCase()} | ${t.run} | \`${q.id}\` | ${state(q)} | ${q.exit ?? "—"} | ${q.ms} | ${q.detail === null ? "—" : `\`${q.detail}\``} |`)),
        "",
        ...READER_LIMITATIONS,
    );
    return `${lines.join("\n")}\n`;
}

export const READER_LIMITATIONS = Object.freeze([
    "**What may not be concluded from the figures above.**",
    "",
    "- **`k = 5` per arm supports a recorded rate and nothing else**: no significance, no interval, and no",
    "  claim that a difference between the arms is a difference between the models.",
    "- **A pass is `gradeReadAnswer()`'s and nothing more**: the exact set of cited lines, a value and its",
    "  line, or `ABSENT` citing none, on two synthetic fixtures. It does not say a reading call pays, which",
    "  turns on the file and the parent's context, nor how often reading answers are wrong elsewhere.",
    "- **`eval --verify` regrades every completed question with the grader that ships**, and any verdict",
    "  that moves is red.",
    "- **The arms differ in more than the model**, as in `evals/ab/local-worker.md`: arm H is the host agent",
    "  under the operator's own environment, and its model is the operator's declaration.",
    "- **Which use these figures support is not stated here.** It is stated where the routing ships.",
]);

function readReaderRecord(repoRoot) {
    const file = path.join(repoRoot, READER_RECORD);
    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    } catch (cause) {
        if (cause.code === "ENOENT") return null;
        throw new CouldNotRunError(`${READER_RECORD} could not be read — ${cause.code ?? cause.message}`);
    }
    try {
        return JSON.parse(text);
    } catch (cause) {
        throw new RailError(`${READER_RECORD} is not JSON — ${cause.message}`);
    }
}

function refuseReaderFixture(rec, allowFixture) {
    if (rec?.fixture !== undefined && !allowFixture) throw new RailError(`${READER_RECORD} is a synthetic fixture, and a synthetic fixture is not a capture: no run stands behind its figures`);
}

export const READER_NOT_CAPTURED = `${READER_RECORD} is not captured, so reading earns nothing`;

export async function verifyReaderRecord(repoRoot, { allowFixture = false } = {}) {
    const rec = readReaderRecord(repoRoot);
    if (rec === null) {
        if (fs.existsSync(path.join(repoRoot, READER_REGISTER))) throw new RailError(`${READER_REGISTER} exists with no ${READER_RECORD} to render it from`);
        return READER_NOT_CAPTURED;
    }
    refuseReaderFixture(rec, allowFixture);
    const red = verifyReader(rec);
    if (red.length > 0) throw new RailError(findings(red));
    const registerPath = path.join(repoRoot, READER_REGISTER);
    const onDisk = fs.existsSync(registerPath) ? fs.readFileSync(registerPath, "utf8") : null;
    if (onDisk === null) red.push(`${READER_REGISTER} is missing — render it with \`local-llm.mjs eval --write\``);
    else if (onDisk !== renderReaderRegister(rec)) red.push(`${READER_REGISTER} does not match a fresh render of ${READER_RECORD} — a published figure has drifted from its own data`);
    if (red.length > 0) throw new RailError(findings(red));
    return `${READER_RECORD}: ${rec.turns.length} turn(s) of ${READ_QUESTIONS.length} questions at k=${rec.k}, regraded and folded consistently, and ${READER_REGISTER} matches byte for byte`;
}

export async function writeReaderRegister(repoRoot, { allowFixture = false } = {}) {
    const rec = readReaderRecord(repoRoot);
    if (rec === null) return READER_NOT_CAPTURED;
    refuseReaderFixture(rec, allowFixture);
    const red = verifyReader(rec);
    if (red.length > 0) throw new RailError(`${findings(red)}\n${READER_REGISTER} was NOT written`);
    fs.writeFileSync(path.join(repoRoot, READER_REGISTER), renderReaderRegister(rec));
    return `wrote ${READER_REGISTER} from ${READER_RECORD}`;
}

export function publishReader(repoRoot, rec) {
    fs.mkdirSync(path.join(repoRoot, path.dirname(READER_RECORD)), { recursive: true });
    try {
        fs.writeFileSync(path.join(repoRoot, READER_RECORD), `${JSON.stringify(rec, null, 2)}\n`, { flag: "wx" });
    } catch (cause) {
        if (cause.code === "EEXIST") throw new CouldNotRunError(`${READER_RECORD} exists at publication: its bytes and register were preserved; the current journal remains for recovery`);
        throw new CouldNotRunError(`${READER_RECORD} could not be published — ${cause.code ?? cause.message}; the current journal remains for recovery`);
    }
    const red = verifyReader(rec);
    if (red.length > 0) return { ok: false, message: `wrote ${READER_RECORD}, which is kept because its turns do not repeat; ${findings(red)}\n${READER_REGISTER} was NOT written` };
    fs.writeFileSync(path.join(repoRoot, READER_REGISTER), renderReaderRegister(rec));
    return { ok: true, message: `wrote ${READER_RECORD} and ${READER_REGISTER}. k=${rec.k} per arm supports a recorded rate and nothing else` };
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
    const numberedFile = path.join(tmpDir, "numbered.txt");
    fs.writeFileSync(numberedFile, "one\ntwo\nthree\nfour\n", "utf8");
    const plainSpan = buildPrompt({ _: ["chat"], prompt: "q", file: numberedFile, lines: "3-4" });
    const numberedSpan = buildPrompt({ _: ["chat"], prompt: "q", file: numberedFile, lines: "3-4", numberLines: true });
    let numbersCounted = false;
    try {
        assertInputBudget(numberedSpan, { maxInputBytes: Buffer.byteLength(plainSpan, "utf8") });
    } catch (e) {
        numbersCounted = e instanceof RailError;
    }
    if (!numberedSpan.endsWith("```\n3\tthree\n4\tfour\n```") || !numbersCounted) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return { status: 1, message: "FAIL: --number-lines did not keep the file's own numbers under --lines, or its numbers escaped the input ceiling" };
    }
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

    return { status: 0, message: "OK tools/local-llm:runner-rails (7/7 offline rails held)" };
}

const BOOLEAN_FLAGS = Object.freeze({
    "--verify-offline": "verifyOffline",
    "--allow-remote": "allowRemote",
    "--ab": "ab",
    "--write": "write",
    "--preflight": "preflight",
    "--no-lock": "noLock",
    "--progress": "progress",
    "--number-lines": "numberLines",
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
    "--insert-after": "insertAfter",
    "--insert-before": "insertBefore",
    "--seam-blank-lines": "seamBlankLines",
    "--verify": "verify",
    "--precheck": "precheck",
    "--verify-expect": "verifyExpect",
    "--retries": "retries",
    "--max-input-bytes": "maxInputBytes",
    "--max-tokens": "maxTokens",
    "--prompt": "prompt",
    "--prompt-file": "promptFile",
    "--k": "k",
    "--seed": "seed",
    "--host-cmd": "hostCmd",
    "--host-model": "hostModel",
    "--repo-root": "repoRoot",
    "--dir": "dir",
    "--threshold": "threshold",
});
const REPEATABLE_VALUE_FLAGS = Object.freeze({
    "--context": "contexts",
    "--context-file": "contextFiles",
});
const COUNT_FLAGS = Object.freeze({
    retries: ["--retries", 0],
    maxInputBytes: ["--max-input-bytes", 1],
    maxTokens: ["--max-tokens", 1],
    k: ["--k", 1],
    insertAfter: ["--insert-after", 0],
    insertBefore: ["--insert-before", 1],
    seamBlankLines: ["--seam-blank-lines", 0],
});
const FLAG_OF = Object.freeze({
    ...Object.fromEntries(
        [...Object.entries(BOOLEAN_FLAGS), ...Object.entries(VALUE_FLAGS), ...Object.entries(REPEATABLE_VALUE_FLAGS)].map(
            ([flag, key]) => [key, flag],
        ),
    ),
    verifyRecord: "--verify",
});
const EVAL_ONLY = Object.freeze(["ab", "write", "verifyRecord", "k", "seed", "hostCmd", "hostModel", "repoRoot"]);
const AB_ONLY = Object.freeze(["k", "seed", "hostCmd", "hostModel", "repoRoot"]);
const TRANSFORM_ONLY = Object.freeze(["insertAfter", "insertBefore", "seamBlankLines", "preflight", "verifyExpect", "precheck"]);
const PROMPT_MODES = new Set(["chat", "summarize", "transform"]);
const AB_TAKES = Object.freeze(new Set(["_", "ab", "write", "k", "seed", "hostCmd", "hostModel", "repoRoot", "baseUrl", "effort", "noLock"]));
const RECORD_TAKES = Object.freeze(new Set(["_", "verifyRecord", "write", "repoRoot"]));
const READER_TAKES = Object.freeze(new Set([...AB_TAKES, "task"]));
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

const TRANSFORM_USAGE =
    "local-llm.mjs transform [--role code | --model <id>] [--effort low] --file <path> --verify <cmd> [--precheck <cmd>] [--preflight] [--verify-expect <regex>] (--prompt <instruction> | --prompt-file <path>) " +
    "[--lines <a>-<b> | --insert-after <n> | --insert-before <n>] [--seam-blank-lines <n>] " +
    "[--context <a>-<b>] [--context-file <path>[:a-b]] [--retries <n>] [--max-tokens <n>] [--progress] [--no-lock]";

export const USAGE = `local-llm.mjs — a zero-dependency runner for a loopback OpenAI-compatible model.

  local-llm.mjs status
  local-llm.mjs lifecycle
  local-llm.mjs chat|summarize [--role code|prose | --model <id>] [--file <path> [--lines <a>-<b>] [--number-lines]] [--context <a>-<b>] [--context-file <path>[:a-b]] (--prompt <text> | --prompt-file <path>) [--max-tokens <n>] [--progress] [--no-lock]
  ${TRANSFORM_USAGE}
  local-llm.mjs eval [--role code|prose | --model <id>] [--task code|codify|handoff|read] [--no-lock]
  local-llm.mjs eval --ab --k ${AB_K} --seed <s> --host-cmd "<command>" --host-model <id> --write [--repo-root <dir>]
  local-llm.mjs eval --ab --task read --k ${AB_K} --seed <s> --host-cmd "<command>" --host-model <id> --write [--repo-root <dir>]
  local-llm.mjs eval --verify [--repo-root <dir>]
  local-llm.mjs eval --write [--repo-root <dir>]
  local-llm.mjs --verify-offline

  eval           the screen: one sample per task and no baseline arm. A model that fails it is not
                 routed; passing it earns nothing. read asks one question per call about a numbered
                 fixture in screen/read/ and passes only when every answer is right; no routing rests
                 on the screen.
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
  eval --ab --task read
                 capture the reading record, ${READER_RECORD}, apart from ${AB_RECORD}: k=${AB_K} turns per
                 arm, a turn being the ${READ_QUESTIONS.length} screen questions, each its own call graded by
                 gradeReadAnswer(), passing only when all are right. Arm L is --role code at --effort low
                 with the turn's seed, first; arm H is ${readerHostCalls()} PAID host calls under the same refusals,
                 journal (${READER_JOURNAL_GIT_PATH}) and capture-once rule as above.
  eval --verify  no model: the record's shape, its matrix total over k, every arm-L seed, every completed
                 turn REGRADED by the predicates as they ship, the cells re-folded from the turns, and
                 ${AB_REGISTER} byte-compared with a fresh render; then the same for ${READER_RECORD}
                 question by question, where it exists. An absent reading record is reported as not
                 captured and earns nothing. Exit 2 where no worker record exists or cli/ is not beside
                 packs/ to regrade with, 1 where anything disagrees.
  eval --write   re-render ${AB_REGISTER}, and ${READER_REGISTER} where its record exists, refusing a record
                 --verify would red.

Routing evidence: ${AB_REGISTER}, k=5. Code is enabled (L5/H5); shared prose is disabled
(codify L0/H3, handoff L5/H5). Reading has no captured record, so find and quote is a candidate use.
Operational defaults and --role require the measured model at low
effort. --model without --role is an explicit candidate; eval and eval --ab remain screens/captures
and never enable a role automatically.

Every chat request is refused off loopback unless --allow-remote is passed, is refused over
--max-input-bytes (default ${DEFAULT_MAX_INPUT_BYTES}), and serialises per endpoint via an advisory
lockfile unless --no-lock is passed. transform defaults to --role code at --effort low; --effort
defaults to low.
chat, summarize and transform accept --max-tokens (positive safe integer, default 4096),
recorded in the receipt; it does not override a stricter caller-owned profile.
chat and summarize --number-lines prefix each line of --file, --context and --context-file with its
own number in the file and a tab (under --lines a-b, line a is numbered a), so a reply can cite lines;
the numbers count against --max-input-bytes, and the receipt records line-numbers=on.
--progress prints queued/generation phase and elapsed time to stderr immediately and every
10 seconds while waiting. Tokens remain unknown until the nonstreaming response completes.
Incomplete length responses are refused and saved privately to a temporary diagnostic file.
transform --precheck runs a cheap check on every candidate before mandatory --verify:
exit 1 retries without full verification, exit 0 proceeds, any other outcome restores and exits 2.

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
        } else if (Object.hasOwn(REPEATABLE_VALUE_FLAGS, tok)) {
            if (i + 1 >= argv.length) throw new CouldNotRunError(`${tok} needs a value`);
            (args[REPEATABLE_VALUE_FLAGS[tok]] ??= []).push(argv[++i]);
        } else if (tok.startsWith("--")) {
            throw new CouldNotRunError(`Unknown option ${tok}`);
        } else {
            args._.push(tok);
        }
    }
    for (const [key, [flag, min]] of Object.entries(COUNT_FLAGS)) {
        if (args[key] === undefined) continue;
        if (!/^\d+$/.test(args[key]) || !Number.isSafeInteger(Number(args[key])) || Number(args[key]) < min) {
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

export function resolveInstruction(args, { readFileFn = fs.readFileSync, readStdinFn } = {}) {
    if (args.prompt !== undefined && args.promptFile !== undefined) {
        throw new CouldNotRunError("--prompt and --prompt-file cannot be combined");
    }
    if (args.promptFile !== undefined) {
        if (args.promptFile === "") throw new CouldNotRunError("--prompt-file needs a path or -");
        if (args.promptFile === "-") {
            try {
                return readStdinFn ? readStdinFn() : readFileFn(0, "utf8");
            } catch (err) {
                throw new CouldNotRunError(`Could not read --prompt-file -: ${err.message}`);
            }
        }
        try {
            return readFileFn(args.promptFile, "utf8");
        } catch (err) {
            throw new CouldNotRunError(`Could not read --prompt-file ${args.promptFile}: ${err.message}`);
        }
    }
    return args.prompt;
}

export function buildPrompt(args, options = {}) {
    const resolved = resolveInstruction(args, options);
    if (args.promptFile !== undefined && args._.slice(1).length > 0) {
        throw new CouldNotRunError("--prompt-file cannot be combined with positional prompt text");
    }
    let input = resolved ?? args._.slice(1).join(" ");
    let fileLines = null;
    let spanBlock = null;
    if (args.numberLines && !args.file) {
        throw new CouldNotRunError("--number-lines numbers the lines of --file, and no --file was given");
    }
    if (args.file) {
        const { text } = readUtf8Validated(args.file, "Target");
        let span = text;
        if (args.lines || args.numberLines) fileLines = splitLines(text).lines;
        const { start, end } = args.lines ? parseLineRange(args.lines, fileLines.length) : { start: 1, end: fileLines?.length ?? 0 };
        if (args.lines) span = fileLines.slice(start - 1, end).join("\n");
        spanBlock = args.numberLines
            ? numberedFileBlock(path.basename(args.file), fileLines.slice(start - 1, end), start)
            : `\`\`\`\n${span}\n\`\`\``;
    } else if (args.lines) {
        throw new CouldNotRunError("--lines selects a span of --file, and no --file was given");
    }
    const contextSections = resolveContextSections({
        filePath: args.file ?? null,
        fileLines,
        contexts: args.contexts ?? [],
        contextFiles: args.contextFiles ?? [],
        numberLines: Boolean(args.numberLines),
    });
    const suffix = [...contextSections, ...(spanBlock ? [spanBlock] : [])];
    return suffix.length > 0 ? `${input}\n\n${suffix.join("\n\n")}` : input;
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
        console.log(`local-llm: ${await verifyReaderRecord(repoRoot)}`);
        return 0;
    }
    if (!args.ab) {
        refuseOutside(args, RECORD_TAKES, "eval --write");
        console.log(`local-llm: ${await writeAbRegister(repoRoot)}`);
        console.log(`local-llm: ${await writeReaderRegister(repoRoot)}`);
        return 0;
    }
    if (args.task !== undefined) return readerMode(args, repoRoot, { fetchImpl });
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
        chatFn: (options) => callLocalChat({ ...options, noLock: Boolean(args.noLock), exitOnSignal: false, fetchImpl }),
        onTurn: (t, reused) =>
            console.error(`local-llm: ${t.arm.toUpperCase()} ${t.task} run ${t.run} ${t.completed ? (t.ok ? "PASS" : "FAIL") : "DID-NOT-COMPLETE"} ${t.ms}ms${reused ? " · from the journal, not re-run" : ""}`),
    });
    const published = publishAb(repoRoot, rec, grading);
    fs.rmSync(conditions.journal, { recursive: true, force: true });
    if (published.ok) console.log(`local-llm: ${published.message}`);
    else console.error(`local-llm: ${published.message}`);
    return published.ok ? 0 : 1;
}

async function readerMode(args, repoRoot, { fetchImpl }) {
    if (args.task !== "read") throw new CouldNotRunError(`--ab --task takes only read, which captures ${READER_RECORD}; ${AB_RECORD} is captured over every one of its tasks`);
    refuseOutside(args, READER_TAKES, "eval --ab --task read");
    if (args.hostCmd === undefined) {
        throw new RailError(
            `Refused eval --ab --task read: arm H is a PAID run of ${readerHostCalls()} host calls whose prompts leave this machine, which crosses the loopback rail this runner holds. ` +
                'Name the host command with --host-cmd "<command>" to declare that crossing; nothing was contacted.',
        );
    }
    if (!args.write) throw new CouldNotRunError(`--ab captures turns that do not repeat and keeps them: pass --write, which writes ${READER_RECORD}`);
    if (fs.existsSync(path.join(repoRoot, READER_RECORD))) {
        throw new CouldNotRunError(`${READER_RECORD} exists, and a record is captured once: removing it to capture another is the operator's deliberate act, not this command's`);
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
    const conditions = abConditions({ repoRoot, hostCommand, journalPath: READER_JOURNAL_GIT_PATH });
    console.error(`local-llm: arm H sends ${readerHostCalls()} prompts off this machine through \`${hostCommand.join(" ")}\`, billed to its account, after arm L's ${readerHostCalls()} on ${baseUrl}; turns are journalled in ${conditions.journal}`);
    const rec = await captureReader({
        seed: args.seed,
        k,
        hostCommand,
        hostModel: args.hostModel,
        baseUrl,
        conditions,
        journal: conditions.journal,
        chatFn: (options) => callLocalChat({ ...options, noLock: Boolean(args.noLock), exitOnSignal: false, fetchImpl }),
        onTurn: (t, reused) =>
            console.error(`local-llm: ${t.arm.toUpperCase()} read run ${t.run} ${t.completed ? (t.ok ? "PASS" : "FAIL") : "DID-NOT-COMPLETE"} ${t.ms}ms${reused ? " · from the journal, not re-run" : ""}`),
    });
    const published = publishReader(repoRoot, rec);
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
        if (cmd !== "transform") {
            for (const key of TRANSFORM_ONLY) {
                if (args[key] !== undefined) throw new CouldNotRunError(`${FLAG_OF[key]} belongs to transform, not ${cmd}`);
            }
        }
        if (!PROMPT_MODES.has(cmd)) {
            for (const key of ["promptFile", "contexts", "contextFiles", "maxTokens", "progress"]) {
                if (args[key] !== undefined) throw new CouldNotRunError(`${FLAG_OF[key]} belongs to chat, summarize or transform, not ${cmd}`);
            }
        }
        if (args.numberLines && cmd !== "chat" && cmd !== "summarize") {
            throw new CouldNotRunError(`--number-lines belongs to chat or summarize, not ${cmd}: it numbers a file sent to be read, and a transform's reply replaces lines`);
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

        if (cmd === "lifecycle") {
            console.log(JSON.stringify(reconcileLifecycleRecords()));
            return 0;
        }

        const runWithReadonlyLifecycle = async (mode, chosenModel, phase, fn) => {
            const lifecycle = beginLifecycle({ mode, model: chosenModel, endpoint: baseUrl, phase });
            const unregister = registerSignalCancel((sig) => {
                const interruptedPhase = lifecycle.phase();
                lifecycle.controller.abort();
                releaseActiveLocks();
                const cancelled = lifecycle.cancel({ signal: sig, reason: "interrupted", phase: interruptedPhase, rollback: "not_applicable", providerCancellation: "unknown", usage: null });
                console.error(`Interrupted by ${sig}; rollback=not_applicable.`);
                console.error(cancelled.receipt);
                process.exit(2);
            });
            try {
                return await fn(lifecycle);
            } catch (err) {
                lifecycle.fail({ reason: err instanceof RailError ? "rail_error" : "failed", phase: lifecycle.phase(), rollback: "not_applicable", usage: null });
                throw err;
            } finally {
                unregister();
            }
        };

        if (cmd === "chat" || cmd === "summarize") {
            const chosen = operationalModel(args, cmd === "summarize" ? "prose" : "code");
            const reply = await runWithReadonlyLifecycle(cmd, chosen, "queued", async (lifecycle) => {
                const res = await callLocalChat({
                    baseUrl,
                    allowRemote: args.allowRemote,
                    model: chosen,
                    effort: args.effort ?? "low",
                    maxInputBytes: args.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES,
                    maxTokens: args.maxTokens ?? 4096,
                    progress: Boolean(args.progress),
                    noLock: Boolean(args.noLock),
                    signal: lifecycle.controller.signal,
                    lifecycle,
                    messages: [{ role: "user", content: buildPrompt(args) }],
                    fetchImpl,
                });
                lifecycle.complete({ phase: "completed", usage: res, elapsedMs: res.totalMs, rollback: "not_applicable" });
                return res;
            });
            console.log(reply.content);
            console.error(formatPassReceipt({ mode: cmd, model: chosen, ...reply, lineNumbers: Boolean(args.numberLines) }));
            return 0;
        }

        if (cmd === "transform") {
            const instruction = resolveInstruction(args);
            if (!args.file || instruction === undefined || instruction === "" || !args.verify) {
                throw new CouldNotRunError(`Usage: ${TRANSFORM_USAGE}`);
            }
            const res = await verifyGatedTransform({
                filePath: args.file,
                lineRange: args.lines ?? null,
                insertAfter: args.insertAfter ?? null,
                insertBefore: args.insertBefore ?? null,
                seamBlankLines: args.seamBlankLines ?? null,
                contexts: args.contexts ?? [],
                contextFiles: args.contextFiles ?? [],
                instruction,
                verifyCmd: args.verify,
                precheckCmd: args.precheck ?? null,
                preflight: Boolean(args.preflight),
                verifyExpect: args.verifyExpect ?? null,
                model: operationalModel(args, "code"),
                baseUrl,
                allowRemote: args.allowRemote,
                maxInputBytes: args.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES,
                maxTokens: args.maxTokens ?? 4096,
                progress: Boolean(args.progress),
                effort: args.effort ?? "low",
                retries: args.retries ?? DEFAULT_RETRIES,
                noLock: Boolean(args.noLock),
                chatFn: (options) => callLocalChat({ ...options, fetchImpl }),
            });
            if (res.ok) {
                console.log(res.receipt);
                for (const failure of res.retryFailures) {
                    console.error(formatDiagnostic(`local-llm: attempt=${failure.attempt} phase=${failure.phase} failed:\n${failure.feedback}`));
                }
                return 0;
            }
            console.error(formatDiagnostic(res.error));
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
            const res = await runWithReadonlyLifecycle("dedup", chosen, "embedding", async (lifecycle) => {
                const out = await runDedup({
                    dir: args.dir,
                    threshold,
                    model: chosen,
                    baseUrl,
                    allowRemote: args.allowRemote,
                    maxInputBytes: args.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES,
                    signal: lifecycle.controller.signal,
                    lifecycle,
                    fetchImpl,
                });
                lifecycle.complete({ phase: "completed", usage: { input: out.promptTokens, output: null, cached: null, reasoning: null }, elapsedMs: out.totalMs, rollback: "not_applicable" });
                return out;
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
            const results = await runWithReadonlyLifecycle("eval", model, "generation", async (lifecycle) => {
                const out = await runRoleEval({
                    model,
                    tasks: args.task ? [args.task] : SCREEN_TASKS,
                    baseUrl,
                    allowRemote: args.allowRemote,
                    effort: args.effort ?? "low",
                    signal: lifecycle.controller.signal,
                    lifecycle,
                    chatFn: (options) => callLocalChat({ ...options, noLock: Boolean(args.noLock), fetchImpl }),
                });
                lifecycle.complete({ phase: "completed", rollback: "not_applicable" });
                return out;
            });
            for (const r of results) {
                console.log(`${r.ok ? "PASS" : "FAIL"} task=${r.task} model=${r.model} time=${r.totalMs}ms rate=${figure(r.tokPerSec, "tok/s")} ${r.detail}`);
            }
            return results.every((r) => r.ok) ? 0 : 1;
        }

        throw new CouldNotRunError(`Unknown command: ${cmd}`);
    } catch (err) {
        console.error(formatDiagnostic(err.message));
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
