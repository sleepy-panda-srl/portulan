#!/usr/bin/env node
// Stop-gate: bounded recipe and work checks. Hook failures need a verdict, since a crashed hook fails open.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { isInside } from "./inside.mjs";
import { recipeSet } from "./recipe-set.mjs";
import { runRecipe } from "./recipe-runner.mjs";
import { readStopPolicy } from "./stop-policy.mjs";

const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const WORKSPACE = path.resolve(PROJECT, process.env.PORTULAN_WORKSPACE || ".portulan");
const REPO = PROJECT;

/**
 * The payload's `cwd` is trusted only within this repository, since the gated agent can steer it. A limit: it says
 * where a session ended, not where it worked, so a clean sibling worktree named there is allowed.
 */
function resolveSessionTree(cwd, told = { root: REPO, workspace: WORKSPACE }) {
    const fell = (note) => ({ ...told, origin: "told", note });
    if (typeof cwd !== "string" || cwd.trim() === "") return { ...told, origin: "told", note: null };

    const git = (dir, args) => execFileSync("git", ["-C", dir, ...args], {
        encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"],
    }).trim();

    let root;
    try {
        root = git(cwd, ["rev-parse", "--show-toplevel"]);
    } catch {
        return fell(`the session's directory (${cwd}) is not inside a git repository`);
    }
    if (!root) return fell(`the session's directory (${cwd}) yielded no repository root`);

    // `--path-format` needs git 2.31; the bare form prints `.git`, relative, at a repository root (git 2.50.1).
    const commonDir = (dir) => {
        let raw;
        try {
            raw = git(dir, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
        } catch {
            raw = path.resolve(dir, git(dir, ["rev-parse", "--git-common-dir"]));
        }
        try {
            return fs.realpathSync(raw);
        } catch {
            return raw;
        }
    };
    let mine, theirs;
    try {
        mine = commonDir(told.root);
        theirs = commonDir(root);
    } catch {
        return fell("this repository's identity could not be compared with the session's");
    }
    if (mine !== theirs) {
        return fell(
            `the session's directory (${cwd}) is in a different repository from the one this hook governs — ` +
                "its obligations are not this repository's to enforce",
        );
    }

    let resolved = root;
    try {
        resolved = fs.realpathSync(root);
    } catch { /* the toplevel git just printed; keep it */ }
    return {
        root: resolved,
        workspace: path.resolve(resolved, process.env.PORTULAN_WORKSPACE || ".portulan"),
        origin: "session",
        note: null,
    };
}

export const REASONS = ["recipe", "handoff"];

// Stop fires after every response, so a red session is released at a bound rather than held forever. A reason's
// count is consecutive and clears only with that reason; the total never resets.
export const MAX_BLOCKS = 3;
export const MAX_TOTAL_BLOCKS = 9;

// Counted per tree from `stop_hook_active`, since in an A/B arm Claude Code 2.1.251 gave each retry a new session id,
// restarting both caps. Set above MAX_TOTAL_BLOCKS, so a session whose id holds meets the other bounds first.
export const MAX_CHAIN_BLOCKS = 12;

function counterFile(sessionId, dir, root = REPO) {
    const digest = (v) => {
        let h = 0;
        for (const ch of String(v)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        return h.toString(36);
    };
    // Readable for a person; unique by the digest, since distinct ids can sanitise alike.
    const readable = String(sessionId).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
    return path.join(dir, `portulan-stopgate-${readable}-${digest(sessionId)}-${digest(root)}`);
}

function chainFile(dir, root = REPO) {
    const digest = (v) => {
        let h = 0;
        for (const ch of String(v)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        return h.toString(36);
    };
    return path.join(dir, `portulan-stopgate-chain-${digest(root)}`);
}

/** Hook-provoked stops in a row for this tree, this one included, or 0 unless `provoked`; an unwritable count stays put. */
export function bumpChain(provoked, dir = os.tmpdir(), root = REPO) {
    const file = chainFile(dir, root);
    if (!provoked) {
        try {
            fs.rmSync(file, { force: true });
        } catch {
            // A run left in place can only make the chain bound fire sooner.
        }
        return 0;
    }
    let previous = 0;
    try {
        previous = Number(JSON.parse(fs.readFileSync(file, "utf8"))?.chain) || 0;
    } catch {
        previous = 0;
    }
    try {
        fs.writeFileSync(file, JSON.stringify({ chain: previous + 1 }));
    } catch {
        return previous;
    }
    return previous + 1;
}

function readCount(file) {
    let stored = {};
    try {
        stored = JSON.parse(fs.readFileSync(file, "utf8")) ?? {};
    } catch {
        // None yet, or unreadable: read as nothing spent.
    }
    // Every stored reason is kept, not only REASONS: one missing there would reset on each read and never reach its cap.
    const counts = {};
    for (const [reason, value] of Object.entries(stored.counts ?? {})) counts[reason] = Number(value) || 0;
    for (const reason of REASONS) counts[reason] ??= 0;
    return { counts, total: Number(stored.total) || 0 };
}

/** Charges one refusal to `reasons`; where it cannot be written, every count comes back past its cap, releasing the session. */
export function bumpCount(sessionId, reasons, dir = os.tmpdir(), root = REPO) {
    const file = counterFile(sessionId, dir, root);
    const now = readCount(file);
    const counts = { ...now.counts };
    for (const reason of reasons) counts[reason] = (counts[reason] ?? 0) + 1;
    const next = { counts, total: now.total + 1 };
    try {
        fs.writeFileSync(file, JSON.stringify(next));
    } catch {
        const released = {};
        for (const reason of REASONS) released[reason] = MAX_BLOCKS + 1;
        return { counts: released, total: MAX_TOTAL_BLOCKS + 1 };
    }
    return next;
}

export function clearReason(sessionId, reason, dir = os.tmpdir(), root = REPO) {
    const file = counterFile(sessionId, dir, root);
    const now = readCount(file);
    if (!now.counts[reason]) return now;
    const next = { counts: { ...now.counts, [reason]: 0 }, total: now.total };
    try {
        fs.writeFileSync(file, JSON.stringify(next));
    } catch {
        return now;
    }
    return next;
}

/** Today in local time, as a handoff file is named; `toISOString()` is UTC and disagrees near midnight. */
export function today(now = new Date()) {
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

function defaultRecipe() {
    try {
        const manifest = JSON.parse(fs.readFileSync(path.join(WORKSPACE, "workspace.json"), "utf8"));
        // No pack: `verify.default` is a bare slug, which no composed id is.
        const set = recipeSet(manifest, { packs: [] });
        if (!set.ok) return null;
        const recipe = set.recipes.find((r) => r.id === set.default);
        return recipe ? { id: recipe.id, run: recipe.run, timeout: readStopPolicy(manifest).seconds } : null;
    } catch (error) {
        return { error: error.message };
    }
}

function handoffPolicy(tree) {
    const file = path.join(tree.workspace, "workspace.json");
    try {
        const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
        if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("the manifest must be an object");
        const slots = manifest.slots;
        if (slots === undefined) return { directory: null };
        if (!slots || typeof slots !== "object" || Array.isArray(slots)) throw new Error("slots must be an object");
        if (!Object.hasOwn(slots, "handoffs")) return { directory: null };
        if (typeof slots.handoffs !== "string" || !/^[^#?:/][^#?:]*\/$/.test(slots.handoffs)) {
            throw new Error("slots.handoffs must be a directory path ending in /, without a fragment, query or colon");
        }
        return { directory: path.resolve(tree.workspace, slots.handoffs) };
    } catch (error) {
        const why = error instanceof SyntaxError ? "the manifest is not valid JSON" : error.code ?? error.message;
        return { directory: null, error: `could not read the record policy from ${file}: ${why}. Fix the manifest before ending this work.` };
    }
}

function didWork(root = REPO) {
    const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 10_000, maxBuffer: 64 * 1024 * 1024 });

    try {
        if (git(["status", "--porcelain"]).trim() !== "") return true;
    } catch {
        process.stderr.write("portulan stop-gate: cannot read git status — the work check is not running.\n");
        return null;
    }

    try {
        const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).trim();
        if (upstream) return git(["log", "--oneline", `${upstream}..HEAD`]).trim() !== "";
    } catch {
        // No upstream, as on a branch never pushed.
    }

    // By patch-id, not reachability: a rebase-merge rewrites commits, so a merged branch's originals are on no remote.
    try {
        // Nothing off the remotes means nothing to compare; `--max-count=1` asks only that, so no set overflows the buffer.
        if (git(["rev-list", "--max-count=1", "HEAD", "--not", "--remotes"]).trim() === "") return false;

        const remotes = git(["remote"]).trim();
        if (remotes === "") return true;

        // A remote's recorded default head, never a branch picked by name; `origin` first, as `git remote` sorts by name.
        let base = null;
        const listed = remotes.split("\n").filter(Boolean);
        const named = listed.includes("origin") ? ["origin", ...listed.filter((r) => r !== "origin")] : listed;
        for (const remote of named) {
            try {
                base = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", `${remote}/HEAD`]).trim() || null;
                if (base) break;
            } catch {
                // This remote records no default head.
            }
        }

        // Where patch-ids cannot be compared, commits on no remote count as work: a wrong block is capped and speaks, a wrong pass is silent.
        const degraded = (why, check) => {
            process.stderr.write(
                `portulan stop-gate: could not compare by patch-id (${why}), so commits on no remote are ` +
                    "being read as work. If this branch was rebase-merged the work demand may be spurious — " +
                    `${check} and say so rather than working around the gate.\n`,
            );
            return true;
        };
        if (!base) {
            const which = named[0];
            return degraded(
                `no remote records a default head (tried \`${named.join("`, `")}\`)`,
                `record one with \`git remote set-head ${which} -a\`, then check with ` +
                    `\`git cherry ${which}/HEAD HEAD\``,
            );
        }

        // `git cherry` against an unknown ref exits 128 and prints nothing, so its failure is the throw, not an empty output.
        let cherry;
        try {
            cherry = git(["cherry", base, "HEAD"]);
        } catch {
            return degraded(`\`git cherry ${base} HEAD\` could not run`, `check with \`git cherry ${base} HEAD\``);
        }
        return cherry.split("\n").some((line) => line.startsWith("+"));
    } catch {
        process.stderr.write("portulan stop-gate: cannot determine whether this session did work — the work check is not running.\n");
        return null;
    }
}

/** Today's handoffs as `{ own, recorded }`, with remote content checked since two UTC days before their date. */
function handoffToday(stamp, tree, handoffsDir) {
    let dated;
    try {
        dated = fs.readdirSync(handoffsDir).filter((f) => f.startsWith(stamp) && f.endsWith(".md"));
    } catch (error) {
        if (error.code !== "ENOENT") process.stderr.write(`portulan stop-gate: could not read the declared handoff series (${error.code ?? "read failed"}); no handoff was found.\n`);
        return { own: [], recorded: [] };
    }
    const dir = path.relative(tree.root, handoffsDir).split(path.sep).join("/");
    if (dir === "" || !isInside(tree.root, handoffsDir)) return { own: dated, recorded: [] };
    const git = (args) => execFileSync("git", args, { cwd: tree.root, encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
    const own = [];
    const recorded = [];
    const cutoff = new Date(`${stamp}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - 2);
    for (const name of dated) {
        const file = `:(literal)${dir}/${name}`;
        let unrecorded;
        try {
            unrecorded = git(["status", "--porcelain", "--untracked-files=all", "--ignored", "--", file]).trim() !== "";
            if (!unrecorded) {
                // By content, not commit: a rebase or squash merge pushes a handoff in a commit of its own.
                // `--root`, or `log.showRoot=false` skips a root commit.
                const blob = git(["rev-parse", `HEAD:./${dir}/${name}`]).trim();
                unrecorded = git(["log", "-1", "--root", "--format=%h", "--remotes", `--since=${cutoff.toISOString()}`, `--find-object=${blob}`, "--", file]).trim() === "";
            }
        } catch {
            process.stderr.write(`portulan stop-gate: could not tell whether ${name} is committed and pushed, so it counts as this tree's own.\n`);
            unrecorded = true;
        }
        (unrecorded ? own : recorded).push(name);
    }
    return { own, recorded };
}

function treeIdentity(root = REPO) {
    try {
        const run = (args) => execFileSync("git", args, {
            cwd: root, encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"],
        }).trim();
        const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]);
        if (branch === "HEAD") return `${root} (detached at \`${run(["rev-parse", "--short", "HEAD"])}\`)`;
        return `${root} (on \`${branch}\`)`;
    } catch {
        return root;
    }
}

// Refs on disk only: a fetch would put a round trip, or an offline host's timeout, inside every Stop.
function handoffInHistory(stamp, tree, handoffsDir, held = []) {
    try {
        const dir = path.relative(tree.root, handoffsDir).split(path.sep).join("/");
        if (dir === "" || !isInside(tree.root, handoffsDir)) return null;
        const prefix = dir.replace(/[\\*?[\]]/g, "\\$&");
        const git = (args) => execFileSync("git", args, { cwd: tree.root, encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
        // `:(glob)`, since git reads a bare `*` literally under `GIT_NOGLOB_PATHSPECS=1` (git 2.50.1).
        const commit = git(["log", "-1", "--format=%H", "--all", "--not", "HEAD", "--", `:(glob)${prefix}/${stamp}*`,
            ...held.map((name) => `:(exclude,literal)${dir}/${name}`)]).trim();
        if (!commit) return null;
        const refs = git(["branch", "--all", "--contains", commit, "--format=%(refname:short)"])
            .split("\n").map((r) => r.trim()).filter(Boolean);
        return { commit: commit.slice(0, 7), ref: refs[0] ?? null };
    } catch {
        return null;
    }
}

function workProblems(tree) {
    const problems = [];

    const policy = handoffPolicy(tree);
    const handoffEnabled = policy.directory !== null;
    if (policy.error) {
        problems.push({ reason: "handoff", text: policy.error });
        return { problems, handoffEnabled, handoffCleared: false };
    }
    if (!handoffEnabled) {
        const work = didWork(tree.root);
        if (work === true) {
            problems.push({
                reason: "handoff",
                text: `${treeIdentity(tree.root)} holds work that is not committed and pushed. Commit and push it, its why in the commit message.`,
            });
        }
        return { problems, handoffEnabled, handoffCleared: work === false };
    }

    const stamp = today();
    const handoffs = handoffToday(stamp, tree, policy.directory);
    const handoffPresent = handoffs.own.length > 0;
    // `handoffPresent` first: `didWork()` runs git several times and may warn about a handoff that is not owed.
    const work = handoffPresent ? null : didWork(tree.root);
    if (work === true) {
        const real = (dir) => {
            try {
                return fs.realpathSync(dir);
            } catch {
                return path.resolve(dir);
            }
        };
        const answeredElsewhere = tree.origin === "session" && real(tree.root) !== real(REPO)
            ? ` — the tree this session worked in, not the one this hook was told (${REPO})`
            : "";
        const { recorded } = handoffs;
        const elsewhere = handoffInHistory(stamp, tree, policy.directory, recorded);
        const found = elsewhere
            ? ` One dated ${stamp} does exist elsewhere in this repository's refs, at ` +
              `${elsewhere.commit}${elsewhere.ref ? ` on \`${elsewhere.ref}\`` : ""} — so this working tree may not be ` +
              "the tree that did the work. Check before writing a second one."
            : "";
        const notCounted = recorded.length
            ? `${recorded.map((f) => `\`${f}\``).join(", ")} ${recorded.length === 1 ? "is" : "are"} committed and pushed already, ` +
              `so ${recorded.length === 1 ? "it records" : "they record"} work already recorded. `
            : "";
        problems.push({
            reason: "handoff",
            text:
                `no handoff dated ${stamp}${recorded.length ? " of this tree's own" : ""} in ${policy.directory}, read from ` +
                `${treeIdentity(tree.root)}${answeredElsewhere}. ${notCounted}` +
                "This tree holds work that is not committed and pushed. Commit and push it, its why in the commit " +
                "message, or end with a dated handoff naming what is open: where things stand, the open questions " +
                `and the next action. Five lines is enough; absent is not.${found}`,
        });
    }

    return { problems, handoffEnabled, handoffCleared: handoffPresent || work === false };
}

export async function runStopRecipe(recipe, execute = runRecipe) {
    if (!recipe || recipe.error) return {
        reason: "recipe",
        text: `could not read the workspace's default verify recipe from ${path.join(WORKSPACE, "workspace.json")}: ${recipe?.error ?? "no runnable default"}. Nothing verified this work.`,
    };
    try {
        const result = await execute(recipe, { root: REPO, env: process.env, timeout: recipe.timeout * 1000 });
        if (result.outcome === "green") return null;
        const outcome = result.timedOut
            ? `could not run: timed out after ${recipe.timeout} s — the gate could not judge`
            : result.outcome === "red" ? `RED (exit ${result.code})` : `could not run (exit ${result.code ?? "no status"}) — the gate could not judge`;
        const output = (result.output ?? "").trim().split("\n").slice(-25).join("\n");
        return { reason: "recipe", text: `verify recipe \`${recipe.id}\` in ${REPO} — ${outcome}\n${output}` };
    } catch (error) {
        return { reason: "recipe", text: `verify recipe \`${recipe.id}\` could not run — ${error.message}; the gate could not judge` };
    }
}

async function collectProblems(tree, state, chain) {
    const work = workProblems(tree);
    const recipeCapped = (state.counts.recipe ?? 0) >= MAX_BLOCKS;
    const handoffCapped = work.problems.some(p => p.reason === "handoff") && (state.counts.handoff ?? 0) >= MAX_BLOCKS;
    const skip = recipeCapped || handoffCapped || state.total >= MAX_TOTAL_BLOCKS || chain > MAX_CHAIN_BLOCKS;
    const recipeProblem = skip ? {
        reason: "recipe", charge: false, capped: recipeCapped,
        text: "verify recipe not rerun: this Stop is released at a refusal bound. No result was measured on this Stop; existing obligations remain unresolved. Run verification explicitly before claiming done.",
    } : await runStopRecipe(defaultRecipe());
    return { ...work, problems: [...(recipeProblem ? [recipeProblem] : []), ...work.problems], recipeGreen: !skip && recipeProblem === null };
}

export function verdict({ problems, counts = {}, total = 0, chain = 0, max = MAX_BLOCKS, maxTotal = MAX_TOTAL_BLOCKS, maxChain = MAX_CHAIN_BLOCKS, handoffEnabled = true }) {
    if (problems.length === 0) return { action: "allow" };

    const text = problems.map((p) => p.text).join("\n\n");
    const spent = problems.filter((p) => p.capped || (counts[p.reason] ?? 0) > max).map((p) => p.reason);
    const label = (reason) => !handoffEnabled && reason === "handoff" ? "work" : reason;

    if (spent.length || total > maxTotal || chain > maxChain) {
        const bound = spent.length
            ? `the cap of ${max} consecutive refusals for \`${spent.map(label).join("`, `")}\` was reached`
            : total > maxTotal
              ? `the absolute ceiling of ${maxTotal} refusals was reached (no single reason had reached its cap of ${max})`
              : `${chain} consecutive hook-provoked stops were seen in this tree, past the chain bound of ${maxChain} — ` +
                `the per-session caps never fired, which means this host issued a new session id per retry and their ` +
                `counters could not see their own history`;
        return {
            action: "release",
            message:
                `PORTULAN STOP-GATE — ${bound}. This session is ending **RED**, not done.\n` +
                `Nothing below was fixed, and the session ending does not fix it. Say so in ${handoffEnabled ? "the handoff and in any" : "any"}\n` +
                `report of this work; a task that ends at the cap is an unfinished task with a stop attached.\n\n` +
                `${text}\n`,
        };
    }

    const tally = problems.map((p) => `${label(p.reason)} ${counts[p.reason] ?? 0}/${max}`).join(", ");
    return {
        action: "block",
        message:
            `PORTULAN STOP-GATE (${tally}) — this task is not done:\n\n${text}\n\n` +
            "Fix these rather than working around them. If a check is wrong, say so and change it deliberately — " +
            "relaxing a check is the change to scrutinise hardest, because it is the one that makes every future green mean less.",
    };
}

async function main() {
    let payload = {};
    try {
        payload = JSON.parse(fs.readFileSync(0, "utf8"));
    } catch {
        // Without a session id no count can be kept, and a gate that cannot count cannot promise to stop.
        allow();
    }

    const sessionId = payload.session_id ?? "unknown";
    const tree = resolveSessionTree(payload.cwd);
    if (tree.note) process.stderr.write(`portulan stop-gate: ${tree.note}; answering about ${REPO} instead.\n`);

    const prior = readCount(counterFile(sessionId, os.tmpdir()));
    const chain = bumpChain(payload.stop_hook_active === true, os.tmpdir(), tree.root);
    const { problems, recipeGreen, handoffEnabled, handoffCleared } = await collectProblems(tree, prior, chain);

    // The session's counts stay on the told root, so a `cwd` that moves mid-session cannot restart them.
    if (recipeGreen) clearReason(sessionId, "recipe");
    if (handoffCleared) clearReason(sessionId, "handoff");

    const state = problems.length === 0
        ? { counts: {}, total: 0 }
        : bumpCount(sessionId, [...new Set(problems.filter(p => p.charge !== false).map((p) => p.reason))]);
    if (problems.length === 0) bumpChain(false, os.tmpdir(), tree.root);
    const result = verdict({ problems, counts: state.counts, total: state.total, chain, handoffEnabled });

    if (result.action === "allow") allow();
    if (result.action === "release") {
        process.stderr.write(result.message);
        allow();
    }
    block(result.message);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    await main();
}
