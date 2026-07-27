#!/usr/bin/env node
// The Stop-gate runner — "done" is not a thing an agent may simply declare.
//
// Wired by `../../cli/compile.mjs` into `.claude/settings.json` as a `Stop` hook. When an agent
// tries to end its turn, this runs the workspace's default verify recipe and blocks the ending if
// the recipe is not green. `../../core/operating/verification.md` has specified this contract since
// milestone 1 and named milestone 4 as where the runner arrives; this is that runner.
//
// It also enforces the session-end handoff, which `../../core/operating/loop.md` and
// `../memory/every-session-ends-with-a-handoff.md` both promised to this milestone.
//
// ## Two honest limits, stated before the code rather than after
//
// **1. The host's Stop event is not the doctrine's "end of task".** It fires when the agent finishes
// *any* response. So a gate that blocked forever would make a red working copy undriveable —
// including by the session opened to fix the red, which is the failure mode that gets a rail
// switched off rather than fixed. The cap below is the answer, and it is a real weakening: an agent
// that is blocked enough times ends anyway, with the red printed loudly each time. CI still refuses
// the merge, and the platform floor still refuses the push. This gate makes the red *unmissable*;
// the floor is what makes it *binding*.
//
// **The cap counts BLOCKS, not stops, and that distinction is the whole gate.** The first version
// counted every Stop event, which meant an ordinary session spent its budget on turns that were
// perfectly green and then let a genuine red through with a note — a fail-open in the gate written
// to close one, found at the pre-commit checkpoint by a supervisor who spent four green stops and
// then planted a red. A green stop is free. Only a stop this gate actually refuses is charged.
//
// **2. A crashed hook fails open.** Measured, CLI 2.1.220. So every failure path here returns a
// verdict rather than throwing, and the runner has its own timeout — the host's own hook timeout is
// far longer (600s), so a hanging recipe would sit there un-gated until then; this returns first.
// `could not run` blocks exactly as `red` does: the recipes distinguish exit 1 from exit 2 precisely
// so that "nothing looked" is never read as "nothing wrong"
// (../memory/verify-preconditions-fail-closed.md).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(HERE, "..");
const REPO = path.resolve(WORKSPACE, "..");

// How many times one session may be REFUSED before it is allowed to end anyway. Bounded iteration
// is already doctrine — ../../core/operating/loop.md carries the runbook/iteration-cap row — and a
// Stop-gate that cannot stop is not a gate, it is a hang.
export const MAX_BLOCKS = 3;
const RECIPE_TIMEOUT_MS = 90_000;

/**
 * Count one block against a session, and return the running total.
 *
 * Exported for the suite. `dir` is injectable for the same reason.
 *
 * When the counter cannot be kept at all, this returns a number ABOVE the cap so the caller lets
 * the session end. That direction is deliberate: an un-capped gate is the one failure here a human
 * cannot escape from inside the session. (The first version returned exactly `MAX_BLOCKS`, which is
 * not above it — so an unwritable temp dir made a red tree block *forever*, the precise opposite of
 * what its own comment claimed. Found at the pre-commit checkpoint, demonstrated against a
 * read-only TMPDIR.)
 */
export function bumpCount(sessionId, dir = os.tmpdir()) {
    const file = path.join(dir, `portulan-stopgate-${String(sessionId).replace(/[^a-zA-Z0-9-]/g, "")}`);
    let n = 0;
    try {
        n = Number.parseInt(fs.readFileSync(file, "utf8"), 10) || 0;
    } catch {
        n = 0;
    }
    n += 1;
    try {
        fs.writeFileSync(file, String(n));
    } catch {
        return MAX_BLOCKS + 1;
    }
    return n;
}

/** Today, in the machine's LOCAL timezone — the same clock that names a handoff file. */
export function today(now = new Date()) {
    // `toISOString()` is UTC, and handoffs are named by local date. Between midnight and 03:00 in
    // the maintainer's timezone the two disagree, and the gate would demand yesterday's date from a
    // session that had just written today's — a false red, which is the failure that gets a rail
    // switched off rather than fixed. Found at the pre-commit checkpoint.
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function allow() {
    process.exit(0);
}

function block(reason) {
    process.stdout.write(`${JSON.stringify({ decision: "block", reason })}\n`);
    process.exit(0);
}

/** The workspace's default verify recipe: `{ id, run }`, or null if the manifest cannot say. */
function defaultRecipe() {
    try {
        const manifest = JSON.parse(fs.readFileSync(path.join(WORKSPACE, "workspace.json"), "utf8"));
        const id = manifest.verify?.default;
        const recipe = (manifest.verify?.recipes ?? []).find((r) => r.id === id);
        return recipe ? { id: recipe.id, run: recipe.run } : null;
    } catch {
        return null;
    }
}

/** Has this session done work? A read-only session owes no handoff. */
function didWork() {
    try {
        const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8", timeout: 10_000 });
        if (dirty.trim() !== "") return true;
        const ahead = execFileSync("git", ["log", "--oneline", "origin/main..HEAD"], {
            cwd: REPO,
            encoding: "utf8",
            timeout: 10_000,
        });
        return ahead.trim() !== "";
    } catch {
        // Cannot tell. Do not invent an obligation out of a failed git call.
        return false;
    }
}

/** Is there a handoff dated today? The doctrine's checkable form: existence and a date, never length. */
function handoffToday() {
    const stamp = today();
    try {
        return fs.readdirSync(path.join(WORKSPACE, "handoffs")).some((f) => f.startsWith(stamp) && f.endsWith(".md"));
    } catch {
        return false;
    }
}

/** Everything this gate refuses a stop for. Empty means the session may end. */
function collectProblems() {
    const problems = [];

    const recipe = defaultRecipe();
    if (!recipe) {
        problems.push(
            "could not read the workspace's default verify recipe from .portulan/workspace.json, so nothing " +
                "verified this work. That is 'could not run', which blocks exactly as red does.",
        );
    } else {
        try {
            execFileSync("bash", ["-c", recipe.run], {
                cwd: REPO,
                encoding: "utf8",
                timeout: RECIPE_TIMEOUT_MS,
                stdio: ["ignore", "pipe", "pipe"],
            });
        } catch (error) {
            const code = error.status;
            const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim().split("\n").slice(-25).join("\n");
            const verdict = code === 2 ? "could not run (exit 2)" : `RED (exit ${code ?? "?"})`;
            problems.push(`verify recipe \`${recipe.id}\` — ${verdict}\n${output}`);
        }
    }

    if (didWork() && !handoffToday()) {
        problems.push(
            `no handoff dated ${today()} in .portulan/handoffs/. Every session ends with a dated handoff — ` +
                "five lines is enough, absent is not. The Session log records what landed; the handoff records why, " +
                "and the why is the part the next session cannot reconstruct from the diff.",
        );
    }

    return problems;
}

function main() {
    let payload = {};
    try {
        payload = JSON.parse(fs.readFileSync(0, "utf8"));
    } catch {
        // No payload means no session id, so the counter cannot be trusted — and a gate that cannot
        // count its own blocks cannot promise to stop. Stepping aside is safer than a possible hang.
        allow();
    }

    const problems = collectProblems();
    if (problems.length === 0) allow(); // A green stop is free. It must not consume the budget.

    // Charged only now, when this gate is actually about to refuse a stop.
    const count = bumpCount(payload.session_id ?? "unknown");
    if (count > MAX_BLOCKS) {
        process.stderr.write(
            `portulan stop-gate: cap of ${MAX_BLOCKS} refusals reached for this session — allowing the stop.\n` +
                `The following is STILL UNRESOLVED and is not fixed by this session ending:\n\n${problems.join("\n\n")}\n`,
        );
        allow();
    }

    block(
        `PORTULAN STOP-GATE (${count}/${MAX_BLOCKS}) — this task is not done:\n\n${problems.join("\n\n")}\n\n` +
            "Fix these rather than working around them. If a check is wrong, say so and change it deliberately — " +
            "relaxing a check is the change to scrutinise hardest, because it is the one that makes every future green mean less.",
    );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    main();
}
