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

// How many CONSECUTIVE red-blocked stops one session may accumulate before the gate lets it end.
// Bounded iteration is already doctrine — ../../core/operating/loop.md carries the runbook/iteration-cap
// row — and a Stop-gate that cannot stop is not a gate, it is a hang.
//
// **Consecutive, and it resets on an observed green run of the governing recipe** (maintainer's ruling,
// 2026-07-27). The cap is aimed at the futile-retry episode — the same failure the Ralph Wiggum row names
// — not at long honest sessions. A session that hits three unrelated reds and properly fixes each one
// should not be taxed for having done the work; accumulating across a whole session would be ceremony
// that cannot scale down, which is a binding non-goal.
export const MAX_BLOCKS = 3;

// An absolute ceiling on refusals per session, which does NOT reset. This is a deliberate addition to
// the ruling above rather than an interpretation of it, and the reason is a hang the ruling would
// otherwise reintroduce: the reset keys off the *recipe* going green, and the recipe is only one of the
// two things this gate refuses for. A session with a green recipe and a missing handoff would reset the
// consecutive count on every attempt and never reach the cap — unbounded, in the exact case that was
// demonstrated releasing at the cap before this change. So the consecutive cap governs the ordinary
// futile-retry episode, and this ceiling guarantees the gate can always stop. Surfaced to the maintainer
// rather than applied silently.
export const MAX_TOTAL_BLOCKS = 9;

const RECIPE_TIMEOUT_MS = 90_000;

/**
 * Where one session's counter lives. Keyed by session id **and** by the working tree, because
 * `worktree-local` is a requirement rather than an accident: several worktrees of this repository are
 * routinely checked out at once, and two sessions sharing a counter would let one disarm the other's
 * gate. Untracked, in the OS temp dir — this is session state, not repository state.
 */
function counterFile(sessionId, dir, root = REPO) {
    // A short, stable digest. Not security — just enough that two distinct inputs differ.
    const digest = (v) => {
        let h = 0;
        for (const ch of String(v)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        return h.toString(36);
    };
    // The readable part is for a human debugging a stuck counter; the digest is what makes the name
    // unique. Both are needed. Sanitising ALONE is not enough, and the failure is silent: a session id
    // made entirely of characters outside the class sanitises to the empty string, so every such
    // session shares one counter and they charge each other's cap — or release each other early. The
    // same holds for two ids sharing a 60-character prefix. Found by review on the pull request.
    const readable = String(sessionId).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
    return path.join(dir, `portulan-stopgate-${readable}-${digest(sessionId)}-${digest(root)}`);
}

function readCount(file) {
    try {
        const v = JSON.parse(fs.readFileSync(file, "utf8"));
        return { consecutive: Number(v.consecutive) || 0, total: Number(v.total) || 0 };
    } catch {
        return { consecutive: 0, total: 0 };
    }
}

/**
 * Count one refusal against a session. Returns `{ consecutive, total }`.
 *
 * Exported for the suite; `dir` and `root` are injectable for the same reason.
 *
 * When the counter cannot be kept at all, this returns numbers ABOVE both caps so the caller lets the
 * session end. That direction is deliberate: an un-capped gate is the one failure here a human cannot
 * escape from inside the session. (The first version returned exactly `MAX_BLOCKS`, which is not above
 * it — so an unwritable temp dir made a red tree block *forever*, the precise opposite of what its own
 * comment claimed. Found at the pre-commit checkpoint, demonstrated against a read-only TMPDIR.)
 */
export function bumpCount(sessionId, dir = os.tmpdir(), root = REPO) {
    const file = counterFile(sessionId, dir, root);
    const now = readCount(file);
    const next = { consecutive: now.consecutive + 1, total: now.total + 1 };
    try {
        fs.writeFileSync(file, JSON.stringify(next));
    } catch {
        return { consecutive: MAX_BLOCKS + 1, total: MAX_TOTAL_BLOCKS + 1 };
    }
    return next;
}

/**
 * An observed green run of the governing recipe clears the CONSECUTIVE count — and only that one.
 * The running total survives on purpose: it is what guarantees the gate can still stop.
 */
export function resetConsecutive(sessionId, dir = os.tmpdir(), root = REPO) {
    const file = counterFile(sessionId, dir, root);
    const now = readCount(file);
    if (now.consecutive === 0) return now;
    const next = { consecutive: 0, total: now.total };
    try {
        fs.writeFileSync(file, JSON.stringify(next));
    } catch {
        // Failing to clear a counter can only make the gate stricter, never weaker. Leave it.
        return now;
    }
    return next;
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

/**
 * Everything this gate refuses a stop for, plus whether the governing recipe was observed GREEN.
 * The two are reported separately because the consecutive-cap reset keys off the recipe alone, while
 * whether to block keys off the whole set.
 */
function collectProblems() {
    const problems = [];
    let recipeGreen = false;

    const recipe = defaultRecipe();
    if (!recipe) {
        problems.push(
            "could not read the workspace's default verify recipe from .portulan/workspace.json, so nothing " +
                "verified this work. That is 'could not run', which blocks exactly as red does.",
        );
    } else {
        // `bash -c` with the command as one string, deliberately: the manifest declares a *command*,
        // not a script path — `spec/slots.md` says so and the CI workflow runs each recipe the same
        // way. Passing argv instead would make the Stop-gate execute recipes differently from CI,
        // which trades a small quoting surface for a much worse property: two runners disagreeing
        // about what a recipe means. The real defect the review found was the exit-code reading
        // below, and that is fixed rather than worked around.
        try {
            execFileSync("bash", ["-c", recipe.run], {
                cwd: REPO,
                encoding: "utf8",
                timeout: RECIPE_TIMEOUT_MS,
                stdio: ["ignore", "pipe", "pipe"],
            });
            recipeGreen = true;
        } catch (error) {
            const code = error.status;
            const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim().split("\n").slice(-25).join("\n");
            // Exit 2 gets its OWN outcome, not folded into red. The recipes distinguish "ran and
            // failed" from "could not run" precisely so that neither is mistaken for the other, and a
            // runner that flattened them would either fail open (2 read as pass) or manufacture false
            // reds (2 read as a verdict about the tree). Both block; they say different things.
            // Exit 2 gets its OWN outcome, and so do the shell's "cannot execute" codes. 126 is
            // "found but not executable", 127 is "not found", and a spawn failure has no status at
            // all — none of the three is a verdict about the repository, and calling any of them RED
            // would report a judgement nobody reached. That is the same laundering the recipes'
            // three-code contract exists to prevent, one level up, and it was reaching the gate that
            // contract is *for*. Found by review on the pull request.
            const CANNOT_RUN = new Set([2, 126, 127]);
            const outcome = CANNOT_RUN.has(code) || code === undefined || code === null
                ? `could not run (exit ${code ?? "no status"}) — the gate could not judge`
                : `RED (exit ${code})`;
            problems.push(`verify recipe \`${recipe.id}\` — ${outcome}\n${output}`);
        }
    }

    if (didWork() && !handoffToday()) {
        problems.push(
            `no handoff dated ${today()} in .portulan/handoffs/. Every session ends with a dated handoff — ` +
                "five lines is enough, absent is not. The Session log records what landed; the handoff records why, " +
                "and the why is the part the next session cannot reconstruct from the diff.",
        );
    }

    return { problems, recipeGreen };
}

/**
 * The gate's arithmetic, as a pure function — the part that decides whether this gate can be talked
 * past, or can wrongly refuse. Exported because both directions need testing and neither is
 * testable through a hook that calls `process.exit`.
 *
 * Three outcomes, deliberately distinct:
 *   allow   — nothing is wrong. A green stop is FREE: it must never consume the budget, or an
 *             ordinary session spends its cap on good turns and a real red walks through afterwards.
 *   block   — refuse this stop, and charge it.
 *   release — the cap is spent. The session may end, and the record must say RED rather than done.
 */
export function verdict({ problems, count, total = count, max = MAX_BLOCKS, maxTotal = MAX_TOTAL_BLOCKS }) {
    if (problems.length === 0) return { action: "allow" };
    if (count > max || total > maxTotal) {
        // Name the bound that actually released it. Saying "cap of 3" after nine refusals with a
        // consecutive count of 1 is false, and it is the same defect already fixed once in this very
        // message — a release that misreports why it happened sends a reader to the wrong constant.
        const bound = count > max
            ? `the cap of ${max} consecutive refusals was reached`
            : `the absolute ceiling of ${maxTotal} refusals was reached (consecutive count ${count}, which the green-recipe reset kept low)`;
        return {
            action: "release",
            message:
                `PORTULAN STOP-GATE — ${bound}. This session is ending **RED**, not done.\n` +
                `Nothing below was fixed, and the session ending does not fix it. Say so in the handoff and in any\n` +
                `report of this work; a task that ends at the cap is an unfinished task with a stop attached.\n\n` +
                `${problems.join("\n\n")}\n`,
        };
    }
    return {
        action: "block",
        message:
            `PORTULAN STOP-GATE (${count}/${max}) — this task is not done:\n\n${problems.join("\n\n")}\n\n` +
            "Fix these rather than working around them. If a check is wrong, say so and change it deliberately — " +
            "relaxing a check is the change to scrutinise hardest, because it is the one that makes every future green mean less.",
    };
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

    const sessionId = payload.session_id ?? "unknown";
    const { problems, recipeGreen } = collectProblems();

    // An observed green run of the governing recipe ends the futile-retry episode, whether or not the
    // stop is allowed. Done before the bump so a green recipe never charges a consecutive refusal.
    if (recipeGreen) resetConsecutive(sessionId);

    // Charged only when this gate is actually about to refuse. A green stop costs nothing.
    const counts = problems.length === 0 ? { consecutive: 0, total: 0 } : bumpCount(sessionId);
    const result = verdict({ problems, count: counts.consecutive, total: counts.total });

    if (result.action === "allow") allow();
    if (result.action === "release") {
        process.stderr.write(result.message);
        allow();
    }
    block(result.message);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    main();
}
