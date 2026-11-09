// Shared asynchronous recipe execution, bounded output and process-tree cleanup.
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";

const CANNOT_RUN = new Set([2, 126, 127]);
export const INTERRUPTIONS = ["SIGINT", "SIGTERM", "SIGHUP"];

/** A stream's last `limit` bytes, retaining at most `limit` and one chunk. */
export function tailKeeper(limit = 64 * 1024) {
    const chunks = [];
    let held = 0;
    return {
        add(chunk) {
            chunks.push(chunk);
            held += chunk.length;
            while (held - chunks[0].length >= limit) held -= chunks.shift().length;
        },
        get held() { return held; },
        text: () => Buffer.concat(chunks).subarray(-limit).toString("utf8"),
    };
}

export function windowsTaskkill(env, access = fs.accessSync) {
    const root = env.SystemRoot || env.SYSTEMROOT || "C:\\Windows";
    if (!path.win32.isAbsolute(root)) throw new Error("taskkill requires an absolute Windows system root");
    const command = path.win32.join(root, "System32", "taskkill.exe");
    access(command, fs.constants.F_OK);
    return command;
}

/** Signal only a recipe-owned group, or force its Windows tree with a bounded system utility. */
export function terminateTree(pid, signal, { platform = process.platform, kill = process.kill.bind(process), exec = execFileSync, taskkill } = {}) {
    if (!Number.isInteger(pid) || pid <= 0) throw new Error("recipe has no valid process id");
    if (platform === "win32") {
        if (!taskkill) throw new Error("taskkill was not preflighted");
        exec(taskkill, ["/PID", String(pid), "/T", "/F"], { timeout: 1000, windowsHide: true, stdio: "pipe" });
    } else {
        try { kill(-pid, signal); } catch (error) { if (error.code !== "ESRCH") throw error; }
    }
}

export function runRecipe(recipe, { root, env = process.env, timeout = 600_000, onOutput = null, mergeOutput = true, inheritGroup = false, groupId = null }) {
    return new Promise((resolve) => {
        const kept = tailKeeper();
        const failures = [];
        let child, taskkill, limit, grace, drain;
        let settled = false, closed = false, stopping = false, escalated = false, late = false;
        let status = null, interrupted = null;
        const handlers = new Map();
        const record = (error) => failures.push(String(error?.message ?? error));
        const terminate = (signal) => terminateTree(inheritGroup && process.platform !== "win32" ? groupId : child.pid, signal, { taskkill });
        const pipes = () => { child?.stdout?.destroy(); child?.stderr?.destroy(); };
        const settle = () => {
            if (settled) return;
            settled = true;
            for (const timer of [limit, grace, drain]) clearTimeout(timer);
            for (const [signal, handler] of handlers) process.removeListener(signal, handler);
            const code = failures.length || late || interrupted ? null : status;
            if (code === 0) return resolve({ id: recipe.id, outcome: "green" });
            const why = [
                ...failures,
                ...(interrupted ? [`interrupted by ${interrupted}`] : []),
                ...(late ? [`killed at its time limit of ${timeout / 1000} s`] : []),
            ];
            resolve({ id: recipe.id, outcome: code === null || CANNOT_RUN.has(code) ? "could not run" : "red", code,
                output: kept.text() + (why.length ? `\n${why.join("\n")}` : ""),
                ...(onOutput ? { diagnostics: why } : {}),
                ...(interrupted ? { interrupted } : {}) });
        };
        const hardStop = () => {
            try { terminate("SIGKILL"); }
            catch (error) {
                record(error);
                try { child.kill("SIGKILL"); } catch (error) { record(error); }
            }
            escalated = true;
            if (closed) return settle();
            drain = setTimeout(() => {
                record(new Error("recipe did not close after forced termination"));
                pipes();
                child.unref();
                settle();
            }, 1000);
        };
        const stop = (signal) => {
            if (settled) return;
            if (signal && interrupted === null) interrupted = signal;
            if (stopping) return;
            stopping = true;
            clearTimeout(limit);
            clearTimeout(drain);
            if (process.platform === "win32") return hardStop();
            try { terminate(signal || "SIGTERM"); } catch (error) { record(error); }
            // The group may outlive its leader and pipes: neither event cancels escalation.
            grace = setTimeout(hardStop, 250);
        };
        try {
            for (const signal of INTERRUPTIONS) {
                const handler = () => stop(signal);
                handlers.set(signal, handler);
                process.on(signal, handler);
            }
            if (process.platform === "win32") taskkill = windowsTaskkill(env);
            if (inheritGroup && process.platform !== "win32" && (!Number.isInteger(groupId) || groupId <= 1)) throw new Error("inherited recipe group is invalid");
            child = spawn("bash", ["-c", `${mergeOutput ? "exec 2>&1\n" : ""}${inheritGroup ? "" : "export PORTULAN_RECIPE_GROUP=$$\n"}${recipe.run}`], {
                cwd: root, env: { ...env, PORTULAN_RECIPE_MANAGED: "1" }, detached: process.platform !== "win32" && !inheritGroup, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
            });
        } catch (error) { record(error); settle(); return; }
        for (const [name, stream] of [["stdout", child.stdout], ["stderr", child.stderr]]) {
            stream.on("data", (chunk) => {
                kept.add(chunk);
                try { onOutput?.(name, chunk); } catch (error) { record(error); stop(); }
            });
            stream.on("error", (error) => { record(error); stop(); });
        }
        child.on("error", (error) => { record(error); if (!child.pid) settle(); else stop(); });
        child.on("exit", (code) => {
            status = code;
            clearTimeout(limit);
            if (!stopping) drain = setTimeout(() => { pipes(); settle(); }, 1000);
        });
        child.on("close", (code) => {
            status = code;
            closed = true;
            if (!stopping || escalated) settle();
        });
        if (!inheritGroup) limit = setTimeout(() => { late = true; stop(); }, timeout);
    });
}
