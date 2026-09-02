#!/usr/bin/env node
// The Stop-gate runner — "done" is not a thing an agent may simply declare.
//
// Wired by `./compile.mjs` into `.claude/settings.json` as a `Stop` hook. When an agent
// tries to end its turn, this runs the workspace's default verify recipe and blocks the ending if
// the recipe is not green. `../core/operating/verification.md` has specified this contract since
// milestone 1 and named milestone 4 as where the runner arrives; this is that runner.
//
// It also enforces the session-end handoff, which `../core/operating/loop.md` and
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

import { recipeSet } from "./recipe-set.mjs";

// The project root is TOLD to this runner rather than derived from where this file sits — see the same
// paragraph in ./gate.mjs for why. In short: this file used to live inside the workspace it was reading,
// which is the one layout it could ever work in, and is why it shipped in no artifact an adopter received.
//
// **These stay the TOLD values, and since #220's second arm they are no longer the whole answer.** The
// tree a stop is ABOUT is resolved per invocation by `resolveSessionTree` from the payload's `cwd`,
// because the told root is the repository this hook governs and not necessarily the working tree the
// session used. Three things deliberately keep reading the told values whatever the session's cwd is:
// the refusal COUNTER (a resolution that flips mid-session would rename its file and reset spent
// counts — a cap weakening nobody chose), and both halves of the recipe — `defaultRecipe()` and the
// `cwd` its command runs in. That last one is not a nicety: the gate executes the manifest's `run`
// through `bash -c`, so a recipe read from a workspace found under a payload-supplied path would be
// arbitrary command execution seeded by stdin. The recipe's jurisdiction is the workspace this hook
// was wired into.
const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const WORKSPACE = path.resolve(PROJECT, process.env.PORTULAN_WORKSPACE || ".portulan");
const REPO = PROJECT;

/**
 * WHICH TREE this stop is about — the session's own, or the one the hook was told.
 *
 * The told root is what the hook is wired with (`${CLAUDE_PROJECT_DIR}` in `.claude/settings.json`).
 * It is not always the tree the session worked in: a session running in a git worktree, or simply
 * `cd`-ed elsewhere, has both, and #220's second arm is that the gate answered about the told one.
 * **The failure that arm exists for is a SILENT ALLOW** — told tree clean, session tree carrying
 * unrecorded work — because `didWork()` reads the clean tree, returns false, and nothing is printed.
 * The first arm's naming sentences cannot reach it: they live inside the block path.
 *
 * `payload.cwd` is the datum. Measured on this host, a real Stop payload carries
 * `session_id, transcript_path, cwd, prompt_id, permission_mode, effort, hook_event_name,
 * stop_hook_active, last_assistant_message, background_tasks, session_crons` — recorded because the
 * record held no measurement of this payload's shape at all, and the whole arm rests on one field.
 *
 * **THE SAME-REPOSITORY GUARD, which is the difference between a fix and a bypass.** `cwd` is the one
 * input the gated agent can steer, so a naive rescope would let a session point the gate at a clean
 * unrelated clone and be allowed in silence — the very defect, one remove away. A foreign tree's
 * obligations are also unsatisfiable, which is the shape that gets a rail switched off rather than
 * fixed. So the session tree answers only when it is the SAME repository, compared by
 * `--git-common-dir` and through `realpathSync`: worktrees share their common dir with the origin
 * repository, which is exactly the class this arm exists for, while a foreign clone does not.
 * Compared resolved, because macOS symlinks `/tmp` to `/private/tmp` and raw strings would disagree
 * about identical directories.
 *
 * **What the same-repository condition does NOT close, said plainly because the sentences around it
 * could be read as claiming otherwise.** It stops a foreign tree answering; it does not stop steering
 * *within* this repository. A session whose told root is dirty and unrecorded can name a clean,
 * recorded sibling worktree in `cwd` and be allowed — measured. That is narrower than the hole this
 * arm closes and is not closable from here: the gate is told where the session ENDED, never where it
 * worked, and a `cwd` inside this repository is exactly the datum this arm exists to trust.
 * **Pinned** — as a recorded gap, not a wanted property — by *THE KNOWN HOLE (#307)* in
 * `./stop-gate.test.mjs`, whose comment carries the contract for closing it.
 *
 * Returns `{ root, workspace, origin, note }`. `note` is a sentence to print when the datum was
 * offered and could not be used; it is **null when `cwd` is simply absent**, because a host that
 * never offered the field has degraded nothing and deserves today's behaviour byte for byte.
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
        // Gone, or not a repository. Both exit 128; neither is a tree this gate can ask about.
        return fell(`the session's directory (${cwd}) is not inside a git repository`);
    }
    if (!root) return fell(`the session's directory (${cwd}) yielded no repository root`);

    // Same repository? Worktrees share a common dir with their origin; a foreign clone does not.
    // **`--path-format` needs git 2.31, so it is TRIED, not required.** Where it is missing the flag
    // is fatal, and without a fallback this comparison would throw on every stop — sending a correct
    // worktree down the degraded path with a stderr sentence, on an old git, forever. The arm would
    // read as shipped and do nothing, which is the shape this repository has been bitten by before.
    // The bare spelling answers too, but RELATIVELY at a repository root (measured on git 2.50.1:
    // `.git` there, absolute from a subdirectory or a linked worktree), so it is resolved against the
    // directory that was asked. Copilot, round 2.
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
        // Recomputed against the session tree, never reused from the told root, or the handoff
        // question is asked correctly in the wrong directory. `path.resolve` leaves an ABSOLUTE
        // `PORTULAN_WORKSPACE` absolute, so a workspace named absolutely deliberately does not travel.
        workspace: path.resolve(resolved, process.env.PORTULAN_WORKSPACE || ".portulan"),
        origin: "session",
        note: null,
    };
}

// The independent reasons this gate refuses a stop for. Each keeps its own consecutive count.
//
// Named as data rather than left implicit in the code, because the counters, the reset rule and the
// release message all have to agree about what a reason *is* — and three implicit lists is how the
// single-counter version came to reset one reason on another reason's evidence.
export const REASONS = ["recipe", "handoff"];

// How many CONSECUTIVE refusals **for one reason** a session may accumulate before the gate lets it
// end. Bounded iteration is already doctrine — ../core/operating/loop.md carries the
// runbook/iteration-cap row — and a Stop-gate that cannot stop is not a gate, it is a hang.
//
// **Consecutive, and a reason's count clears only when THAT reason clears** (maintainer's ruling,
// 2026-07-27, generalised in ../tasks/0007-per-reason-stop-gate-counters.md). The cap is aimed at the
// futile-retry episode — the same failure the Ralph Wiggum row names — not at long honest sessions. A
// session that hits three unrelated reds and properly fixes each one should not be taxed for having
// done the work; accumulating across a whole session would be ceremony that cannot scale down, which
// is a binding non-goal.
//
// Session 0 implemented the reset literally, keyed off the recipe alone, and that made the gate
// unbounded: a green recipe beside a missing handoff cleared the count on every attempt. It also left
// an asymmetry nobody chose — a missing five-line handoff rode to nine while a failing suite got
// three. Per-reason counters remove both by construction.
export const MAX_BLOCKS = 3;

// An absolute ceiling on refusals per session, which does NOT reset. It was introduced to close the
// hang above and it survives that hang's removal, as the backstop that guarantees the gate can always
// stop whatever the per-reason counts do — including for a reason added later that nobody remembered
// to give a clearing condition. Counts REFUSALS, not reasons: a stop refused for two reasons is one
// refusal, or a two-reason session would reach the ceiling in half the attempts.
export const MAX_TOTAL_BLOCKS = 9;

// **Both caps above are keyed to `session_id`, and a host that rotates it per retry defeats them.**
//
// Measured 2026-09-02 on Claude Code 2.1.251, inside an A/B arm: the gate refused a stop, the agent
// retried, and the retry arrived under a NEW session id — so `counterFile()` opened a fresh counter,
// every consecutive count restarted at zero, and neither cap was ever reached. **85,839 hook
// invocations and 6,985 distinct counter files from one probe**, none of them ever a fourth consecutive
// refusal. This module's own comment names the result exactly: *a Stop-gate that cannot stop is not a
// gate, it is a hang.*
//
// The platform already answers this and the answer was documented here and never read. `stop_hook_active`
// is true precisely when the stop being judged was itself provoked by a hook block — so it identifies
// the retry CHAIN without reference to any session id. This counter follows it: cleared on a stop that
// no hook provoked, incremented on one that a hook did, and keyed to the TREE alone, which is the thing
// that cannot rotate underneath it.
//
// **It is a backstop, not a replacement.** The per-reason and per-session caps keep their meaning where
// the id is stable, which is every ordinary session; this only bounds the case where they cannot see
// their own history. It is set above `MAX_TOTAL_BLOCKS` deliberately: a session whose id is stable must
// always meet the specific caps first, so their messages, not this one, are what a person normally
// reads.
export const MAX_CHAIN_BLOCKS = 12;

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

/**
 * Where the retry CHAIN's counter lives — keyed by tree, never by session.
 *
 * `counterFile()` is keyed by session id and is the right key for the per-reason caps. This one exists
 * for the case that key cannot survive: a host issuing a new session id per retry. So it is deliberately
 * the one piece of gate state two sessions in a worktree share — the sharing the per-session counters
 * exist to prevent is exactly what makes this able to see a chain the counters cannot.
 */
function chainFile(dir, root = REPO) {
    const digest = (v) => {
        let h = 0;
        for (const ch of String(v)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        return h.toString(36);
    };
    return path.join(dir, `portulan-stopgate-chain-${digest(root)}`);
}

/**
 * How many consecutive hook-provoked stops this tree has seen, and the bump that maintains it.
 *
 * `provoked` is the payload's `stop_hook_active`: false means this stop was not caused by a block, so
 * whatever chain existed has ended. Reading a missing or unreadable file as zero is the stricter
 * direction for the per-session counters and the LOOSER one here, so it is stated rather than inherited:
 * a chain this gate cannot count is a chain it does not charge, and the specific caps still apply.
 */
export function bumpChain(provoked, dir = os.tmpdir()) {
    const file = chainFile(dir);
    if (!provoked) {
        try {
            fs.rmSync(file, { force: true });
        } catch {
            // A chain counter that cannot be cleared costs a later session part of its budget, which is
            // the safe direction: it can only make this backstop fire sooner, never later.
        }
        return 0;
    }
    let n = 0;
    try {
        n = Number(JSON.parse(fs.readFileSync(file, "utf8"))?.chain) || 0;
    } catch {
        n = 0;
    }
    n += 1;
    try {
        fs.writeFileSync(file, JSON.stringify({ chain: n }));
    } catch {
        // Unwritable state means the chain cannot grow, so this backstop simply does not fire — the
        // specific caps are unaffected. Silent because it is not a fact about the session's work.
    }
    return n;
}

/** The stored shape: one consecutive count per reason, plus the non-resetting refusal total. */
function readCount(file) {
    let stored = {};
    try {
        stored = JSON.parse(fs.readFileSync(file, "utf8")) ?? {};
    } catch {
        // No counter yet, or an unreadable one. Either way this session has spent nothing — the
        // stricter direction, since a session that cannot read its budget has not used it.
    }
    // Every stored key is carried forward, THEN the known reasons are defaulted to 0. The order and
    // the carry-forward both matter. Filtering by `REASONS` alone dropped any other key, so a reason
    // this file can emit but the constant does not declare would have reset to 0 on every read —
    // never reaching its own cap, and released only by the ceiling of nine. That is precisely the
    // asymmetry task 0007 removed, reintroduced through a drifted list, and silent in the direction
    // of more patience. The constant exists so the counter, the clearing rule and the message agree
    // about what a reason is; it must not be the thing that also decides what may be *counted*.
    // Found by review, in the suppressed half of a Copilot round. The suite additionally binds every
    // reason this file emits to `REASONS`, so drift is red in CI rather than only survivable here.
    const counts = {};
    for (const [reason, value] of Object.entries(stored.counts ?? {})) counts[reason] = Number(value) || 0;
    for (const reason of REASONS) counts[reason] ??= 0;
    return { counts, total: Number(stored.total) || 0 };
}

/**
 * Count one refusal against a session. `reasons` is every reason THIS stop was refused for.
 * Returns `{ counts, total }`.
 *
 * Exported for the suite; `dir` and `root` are injectable for the same reason.
 *
 * When the counter cannot be kept at all, this returns numbers ABOVE every cap — for every reason,
 * not only the ones passed in — so the caller lets the session end. That direction is deliberate: an
 * un-capped gate is the one failure here a human cannot escape from inside the session. (The first
 * version returned exactly `MAX_BLOCKS`, which is not above it — so an unwritable temp dir made a red
 * tree block *forever*, the precise opposite of what its own comment claimed. Found at the pre-commit
 * checkpoint, demonstrated against a read-only TMPDIR. Filling only the named reasons would have
 * reintroduced that trap one reason over.)
 */
export function bumpCount(sessionId, reasons, dir = os.tmpdir(), root = REPO) {
    const file = counterFile(sessionId, dir, root);
    const now = readCount(file);
    const counts = { ...now.counts };
    for (const reason of reasons) counts[reason] = (counts[reason] ?? 0) + 1;
    // One refusal, however many reasons named it — see MAX_TOTAL_BLOCKS.
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

/**
 * One reason's condition cleared: its consecutive count goes to zero, and **only** its own.
 *
 * This is the whole of task 0007. The previous version cleared *the* count on an observed green
 * recipe while the gate refused for two reasons — so a missing handoff's patience was restored by
 * evidence about the recipe, which made the gate unbounded in that case and gave a five-line file
 * three times the tolerance of a failing suite.
 *
 * The running total survives on purpose: it is what guarantees the gate can still stop.
 */
export function clearReason(sessionId, reason, dir = os.tmpdir(), root = REPO) {
    const file = counterFile(sessionId, dir, root);
    const now = readCount(file);
    if (!now.counts[reason]) return now;
    const next = { counts: { ...now.counts, [reason]: 0 }, total: now.total };
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

/**
 * The workspace's default verify recipe: `{ id, run }`, or null if the manifest cannot say.
 *
 * Reaches `recipeSet()` rather than enumerating `verify.recipes` here, because that enumeration is one
 * rule and this file was one of four places carrying it — see `recipe-set.mjs`'s header for why they
 * were merged and `recipe-set.test.mjs` for the roster pin that keeps them merged.
 *
 * **It asks for the workspace subset deliberately, by passing no packs**, and that is not composition
 * quietly skipped. `verify.default` is a bare slug in `spec/workspace.schema.json` and a composed id is
 * `<category>/<name>:<id>`, so **no composed recipe can ever be the default** — resolving packs here
 * would cost a pack resolution on every Stop event and could not change the answer. What this call
 * still buys is the one definition of a *valid* recipe: a manifest whose default recipe carries an
 * empty or newline-bearing `run` is refused here exactly as CI refuses it, rather than being handed to
 * a shell by a gate that did its own looser check.
 */
function defaultRecipe() {
    try {
        const manifest = JSON.parse(fs.readFileSync(path.join(WORKSPACE, "workspace.json"), "utf8"));
        const set = recipeSet(manifest, { packs: [] });
        if (!set.ok) return null;
        const recipe = set.recipes.find((r) => r.id === set.default);
        return recipe ? { id: recipe.id, run: recipe.run } : null;
    } catch {
        return null;
    }
}

/**
 * Has this session done work? A read-only session owes no handoff.
 *
 * Three signals, tried in order, because the obvious one is not portable. The first version hard-coded
 * `origin/main..HEAD`, which throws in a repository with no `origin`, a differently-named default
 * branch, or an unfetched ref — and the catch turned that throw into `false`, **silently disabling the
 * handoff gate while local commits sat there unrecorded.** A fail-open in the gate, and a quiet one.
 * Found by review on the pull request.
 */
function didWork(root = REPO) {
    // `maxBuffer` raised from node's 1 MiB default **for `git cherry`, which cannot be bounded the way
    // the emptiness probe below can**: it must print a line per compared commit to be read at all,
    // where the probe only has to answer yes-or-no and so is asked with `--max-count=1`. An overflow
    // here throws into the outer catch and reads as *cannot tell* on precisely the branches that carry
    // the most commits. This raise moves that cliff rather than removing it — every buffer is finite —
    // which is why the probe is bounded instead of merely given more room.
    const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 10_000, maxBuffer: 64 * 1024 * 1024 });

    // 1. Uncommitted changes. Portable, and the strongest signal there is.
    try {
        if (git(["status", "--porcelain"]).trim() !== "") return true;
    } catch {
        // Not a git repository, or git is unusable. Nothing below will work either.
        process.stderr.write("portulan stop-gate: cannot read git status — the handoff check is not running.\n");
        return false;
    }

    // 2. Commits ahead of this branch's configured upstream, whatever it is called.
    try {
        const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).trim();
        if (upstream) return git(["log", "--oneline", `${upstream}..HEAD`]).trim() !== "";
    } catch {
        // No upstream configured. Ordinary for a branch that has never been pushed — fall through.
    }

    // 3. Commits whose PATCHES are on no remote — compared by patch-id, never by reachability.
    //
    // **This repository rebase-merges, and that makes reachability the wrong question** (#220). A
    // rebase-merge rewrites commits, so a merged branch's originals appear on no remote; once the
    // remote branch is deleted on merge they never will. `HEAD --not --remotes` therefore answers
    // *yes, there is unrecorded work* **permanently**, for every commit of every merged-and-deleted
    // branch — and any checkout left on such a branch demanded a handoff from a session that had
    // done nothing. Measured 2026-08-10: the gate blocked twice over a handoff that was already on
    // `main`, on the strength of four commits `git cherry` showed as fully upstream.
    //
    // The class is named in this repository for a different tool —
    // `../.portulan/memory/a-branch-syncs-with-main-before-it-merges.md`, *"a rebase-merge leaves the
    // branch tip an ancestor of nothing"* — and the sanctioned test there is `git cherry`:
    // comparison by patch-id. This is that record applied at the site that asked the same wrong
    // question.
    try {
        // The coarse reading first, because it is cheap and it BOUNDS the expensive one: nothing on
        // no remote by reachability means nothing on no remote by patch either, since a rewritten
        // commit is still a commit that reachability would have found.
        //
        // **`rev-list --max-count=1`, not `log --oneline`, and the difference is a fail-open.** This
        // asks only whether the set is EMPTY, but `log --oneline` answers by printing one line per
        // commit — and a long-lived checkout on a rebase-merged branch is exactly where that set gets
        // large, which is the situation this whole signal exists for. Past whatever `maxBuffer` is in
        // force, `execFileSync` throws `ENOBUFS` (measured against node's 1 MiB default, which is what
        // this ran on when the defect was found), the outer catch below turns that into `return false`,
        // and the handoff check disables itself on the repositories most likely to need it.
        //
        // **The raised `maxBuffer` above does not make this redundant, and the order matters.** That
        // raise moves the cliff; it does not remove one, because every buffer is finite and the set
        // this probe asks about has no bound. Bounding the QUESTION is what removes the failure: one
        // hash cannot outgrow any buffer. The raise is defence in depth for `git cherry`, which must
        // print a line per compared commit and so cannot be bounded the same way. Copilot, round 3;
        // the wording corrected in the same round after the raise made the original rationale stale.
        if (git(["rev-list", "--max-count=1", "HEAD", "--not", "--remotes"]).trim() === "") return false;

        // No remote at all: every commit qualifies, which is the correct reading there and is what
        // this signal has always said. Documented rather than degraded, so it reports nothing.
        const remotes = git(["remote"]).trim();
        if (remotes === "") return true;

        // A base to compare patches against: the remote's own recorded default head, never a branch
        // picked by name. `./init.mjs`'s `delete-a-remote-branch` reason settles that — *"a wrong base
        // answers no-unique-work about a question nobody asked"* — and `main` is not a name this file
        // may assume, for the same reason signal 2 above stopped hard-coding `origin/main`.
        // **ONE ordering, used by both the base selection and the sentence that reports its failure.**
        // `git remote` lists alphabetically, so a repository carrying `backup` beside `origin` offered
        // `backup/HEAD` first — and this loop takes the first that resolves, which means comparing
        // patch-ids against a non-canonical remote and reaching a wrong allow/block, not merely a
        // clumsy message. `origin` is the conventional canonical remote and is preferred where it
        // exists. Written as one list rather than two matching literals because the first version of
        // this preferred `origin` in the DEGRADED SENTENCE only, leaving the verdict itself on the
        // alphabetical remote — a fix that repaired the report of a defect and not the defect.
        // Copilot, round 3.
        let base = null;
        const listed = remotes.split("\n").filter(Boolean);
        const named = listed.includes("origin") ? ["origin", ...listed.filter((r) => r !== "origin")] : listed;
        for (const remote of named) {
            try {
                base = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", `${remote}/HEAD`]).trim() || null;
                if (base) break;
            } catch {
                // This remote records no default head. Try the next one.
            }
        }

        // **The refinement failed, so the coarse reading stands — and it stands as TRUE.**
        //
        // This is the fail-CLOSED direction and it is chosen rather than defaulted into. Commits on
        // no remote is an established fact by the time we are here; only the attempt to excuse them
        // as already-upstream could not be made. Reading that as *no work* would newly convert a
        // case that blocks today into a pass — a relaxation, and this gate's own refusal message
        // says relaxing a check is the change to scrutinise hardest. The asymmetry decides it: a
        // wrong block is capped at MAX_BLOCKS and speaks, a wrong pass is unbounded and silent.
        // `../.portulan/memory/verify-preconditions-fail-closed.md` is cited in this file's header
        // for exactly this direction.
        // The advice NAMES A COMMAND THE READER CAN RUN. The first draft always said
        // `git cherry <remote>/HEAD HEAD` — but the commonest way into this branch is that
        // `<remote>/HEAD` does not resolve, so the suggested check failed for the very reason the
        // refinement did. Telling someone to re-run the thing that just broke is a diagnosis-shaped
        // sentence carrying no diagnosis. Copilot, round 1.
        const degraded = (why, check) => {
            process.stderr.write(
                `portulan stop-gate: could not compare by patch-id (${why}), so commits on no remote are ` +
                    "being read as work. If this branch was rebase-merged the handoff demand may be spurious — " +
                    `${check} and say so rather than working around the gate.\n`,
            );
            return true;
        };
        if (!base) {
            // **The remotes are NAMED, because this runner already knows them** — it just tried every
            // one. A `<remote>` placeholder in a multi-remote repository invites the reader to run the
            // repair against whichever they think of first, which is how a diagnosis sends someone to
            // the wrong ref. Copilot, round 3. `named` is already ordered `origin`-first above, so the
            // remote this repairs is the same one the loop would have compared against — the two
            // cannot disagree, which is why the ordering is computed once.
            const which = named[0];
            return degraded(
                `no remote records a default head (tried \`${named.join("`, `")}\`)`,
                `record one with \`git remote set-head ${which} -a\`, then check with ` +
                    `\`git cherry ${which}/HEAD HEAD\``,
            );
        }

        // **Exit 0 AND zero `+` lines, both required.** `git cherry` against an unknown ref exits 128
        // and prints NOTHING, so counting `+` alone reads a failed command as *nothing unmerged* —
        // measured, and already recorded in `../.portulan/gate-map.md` and `./init.mjs`'s
        // `delete-a-remote-branch` reason as a fail-open closed once before. The exit half is carried
        // by `git()` itself, which throws on non-zero; the catch below is that half, not decoration.
        let cherry;
        try {
            cherry = git(["cherry", base, "HEAD"]);
        } catch {
            return degraded(`\`git cherry ${base} HEAD\` could not run`, `check with \`git cherry ${base} HEAD\``);
        }
        return cherry.split("\n").some((line) => line.startsWith("+"));
    } catch {
        // Genuinely cannot tell. Say so rather than inventing an obligation OR silently dropping one:
        // a gate that disables itself without a word is the failure this whole runner exists against.
        process.stderr.write("portulan stop-gate: cannot determine whether this session did work — the handoff check is not running.\n");
        return false;
    }
}

/** Is there a handoff dated today? The doctrine's checkable form: existence and a date, never length. */
function handoffToday(stamp, workspace = WORKSPACE) {
    try {
        return fs.readdirSync(path.join(workspace, "handoffs")).some((f) => f.startsWith(stamp) && f.endsWith(".md"));
    } catch {
        return false;
    }
}

/**
 * WHICH TREE this gate just answered about — the working copy and the branch it is on.
 *
 * `handoffToday()` reads the directory under `WORKSPACE`, which is derived from `PROJECT`, which is
 * whatever the host told this hook or whatever the cwd happens to be. That is deliberate — this file
 * is TOLD its root rather than deriving one, for the reason its header gives — but it means the gate
 * can ask a question about one tree and answer it from another. Measured 2026-08-10: a session whose
 * worktree had been removed had its cwd fall back to the origin repository, parked on an unrelated
 * branch 84 commits behind, and was told *"no handoff dated 2026-08-10"* while five sat on `main`.
 *
 * **Since #220's second arm the gate DOES rescope, and this names whichever tree answered.** An
 * earlier version of this paragraph argued that naming was sufficient because a removed worktree
 * cannot be read. That held for the one stop after the removal and failed as an argument about the
 * arm: for the whole of that session's working phase both trees existed and differed, so every stop
 * before the removal was already answering about the wrong one. The removal exposed the divergence
 * rather than creating it. `resolveSessionTree` above now picks the session's tree from the Stop
 * payload's `cwd` when it belongs to this repository, and falls back here — told root, named — only
 * where it cannot.
 */
function treeIdentity(root = REPO) {
    try {
        const run = (args) => execFileSync("git", args, {
            cwd: root, encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"],
        }).trim();
        const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]);
        // **A DETACHED HEAD is the common case here, not the exotic one.** `--abbrev-ref` answers the
        // literal string `HEAD` when no branch is checked out, and this repository routinely has several
        // detached worktrees at once — measured: four, on the machine this was written on. Printing
        // *"on `HEAD`"* would name a branch that does not exist, in the very sentence added so a reader
        // could identify the tree. The commit is what identifies a detached one. Copilot, round 3.
        if (branch === "HEAD") return `${root} (detached at \`${run(["rev-parse", "--short", "HEAD"])}\`)`;
        return `${root} (on \`${branch}\`)`;
    } catch {
        return root;
    }
}

/**
 * A handoff dated today somewhere in this repository's history — every ref already on disk — or null.
 *
 * **No network, deliberately.** A Stop hook runs on every attempt to end a turn, and a fetch would
 * put a remote round trip — and an offline host's timeout — inside the gate. So this reads refs that
 * are already on disk — `--all` is every ref this repository carries, local branches included, not only
 * remote-tracking ones. The sentence it feeds must not overclaim: *absent from this working tree* is
 * always true when it fires; *present at `<ref>`* is claimed only where some ref on disk shows one.
 */
function handoffInHistory(stamp, tree = { root: REPO, workspace: WORKSPACE }) {
    // **Root and workspace arrive as ONE pair, never mixed.** A told root beside a session workspace
    // makes the relative path below start with `..`, the guard returns null, and the elsewhere arm
    // dies in silence — the same both-must-move-together rule the caller obeys, inside this function.
    try {
        // **Separators normalised to `/`, because this becomes a git PATHSPEC.** `path.relative` yields
        // `\` on Windows and git would match nothing — and the failure is silent: this returns null,
        // the refusal loses the half that tells a reader their handoff is already recorded, and nothing
        // says why. The same spelling is used wherever this repository hands git a derived path
        // (`./librarian.mjs`, `./compile.mjs`). Copilot, round 3.
        const dir = path.relative(tree.root, path.join(tree.workspace, "handoffs")).split(path.sep).join("/");
        // A workspace outside the repository is not a question git can answer about this history.
        if (dir === "" || dir.startsWith("..") || path.isAbsolute(dir)) return null;
        const git = (args) => execFileSync("git", args, { cwd: tree.root, encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
        // `--all` is every ref already on disk, local and remote-tracking. `-1` because existence is
        // the whole question — this is the doctrine's checkable form, not a census.
        // **`:(glob)` magic, because a bare `*` is not reliably a glob.** With `GIT_NOGLOB_PATHSPECS`
        // set, git reads `*` literally, this matches nothing, and the function returns null — silently
        // reintroducing the exact "a handoff exists elsewhere and the gate does not say so" gap this
        // arm exists to close. Measured on git 2.50.1: bare pattern matches 1 normally and **0** under
        // `GIT_NOGLOB_PATHSPECS=1`; with `:(glob)` it matches 1 under both. _(The neighbouring lever
        // `core.globPathspec=false` does NOT reproduce it — measured — so the magic is what makes this
        // deterministic, not a config default.)_ Explicit pathspec magic is the same discipline
        // `../.portulan/verify/plugin.sh` documents. Copilot, round 3.
        const commit = git(["log", "--all", "-1", "--format=%H", "--", `:(glob)${dir}/${stamp}*`]).trim();
        if (!commit) return null;
        const refs = git(["branch", "--all", "--contains", commit, "--format=%(refname:short)"])
            .split("\n").map((r) => r.trim()).filter(Boolean);
        return { commit: commit.slice(0, 7), ref: refs[0] ?? null };
    } catch {
        // Cannot look. Say nothing rather than claim an absence — the refusal below is already
        // correct without this sentence, and a false "nowhere in history either" would be worse
        // than silence.
        return null;
    }
}

/**
 * Everything this gate refuses a stop for, plus whether the governing recipe was observed GREEN.
 * The two are reported separately because the consecutive-cap reset keys off the recipe alone, while
 * whether to block keys off the whole set.
 */
function collectProblems(tree = { root: REPO, workspace: WORKSPACE, origin: "told", note: null }) {
    /** Every problem carries the REASON it belongs to — the key its own counter is kept under. */
    const problems = [];
    let recipeGreen = false;

    const recipe = defaultRecipe();
    if (!recipe) {
        problems.push({
            reason: "recipe",
            text:
                "could not read the workspace's default verify recipe from .portulan/workspace.json, so nothing " +
                "verified this work. That is 'could not run', which blocks exactly as red does.",
        });
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
            // The tree is named here too, now that one verdict can span two: the recipe is always run
            // in the TOLD root (see the header) while the handoff question may have been answered
            // about the session's. Without this, two problems in one refusal would read as though
            // both concerned the same tree. Raised as optional at the session-open checkpoint; taken.
            problems.push({
                reason: "recipe",
                text: `verify recipe \`${recipe.id}\` in ${REPO} — ${outcome}\n${output}`,
            });
        }
    }

    // **ONE date per Stop event, captured once and threaded through every use.** There were four
    // independent `today()` calls on this path — the tree check, the history query, and both halves of
    // the sentence. A stop spanning local midnight (or a host clock that jumps) could therefore CHECK
    // one date and REPORT another, and worse, search history for a date nobody checked the tree for.
    // `today()`'s own header records that this file has already produced one false red from a date
    // disagreement; two dates inside a single verdict is the same class. Copilot, round 3.
    const stamp = today();
    const handoffPresent = handoffToday(stamp, tree.workspace);
    // **`!handoffPresent` first, and the order is load-bearing rather than stylistic.** `didWork()`
    // shells out to git several times and can print the could-not-compare sentence; ordered the other
    // way, a session that HAS written its handoff still paid that cost on every Stop event and could
    // be handed a degradation warning about an obligation it does not owe. Copilot, round 1.
    if (!handoffPresent && didWork(tree.root)) {
        // The tree is NAMED, because the sentence was once true about a tree the reader was not
        // thinking of and read as a verdict about their session (#220).
        //
        // **A REFUSAL names both trees where they differ**, because a reader looking at the hook's
        // configured root would otherwise not find the tree this verdict came from. Only on a refusal:
        // told ≠ session is the routine worktree case here, so a divergence line on every green stop
        // would be a metronome, and this gate's sentences are worth reading precisely because they are
        // rare (#220 second arm).
        // **Both sides resolved through `realpathSync`, or this sentence invents a divergence.**
        // `resolveSessionTree` returns a realpathed root, so comparing it against a merely
        // `path.resolve`d `REPO` makes a symlinked told root — `/tmp` on macOS, or any convenience
        // link — read as a second tree, and the refusal then names one directory twice as though the
        // session had worked somewhere else. Measured. It is the same trap the same-repository guard
        // above already defends against, left unapplied one comparison away, which is why the guard's
        // own reasoning is repeated here rather than assumed to carry.
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
        const elsewhere = handoffInHistory(stamp, tree);
        const found = elsewhere
            ? ` One dated ${stamp} does exist elsewhere in this repository's refs, at ` +
              `${elsewhere.commit}${elsewhere.ref ? ` on \`${elsewhere.ref}\`` : ""} — so this working tree may not be ` +
              "the tree that did the work. Check before writing a second one: a duplicate handoff reds `docs.sh`'s " +
              "record check, which is the trap the bare sentence used to set."
            : "";
        problems.push({
            reason: "handoff",
            text:
                `no handoff dated ${stamp} in ${path.join(tree.workspace, "handoffs")}, read from ` +
                `${treeIdentity(tree.root)}${answeredElsewhere}. ` +
                "Every session ends with a dated handoff — five lines is enough, absent is not. The Session log " +
                "records what landed; the handoff records why, and the why is the part the next session cannot " +
                `reconstruct from the diff.${found}`,
        });
    }

    return { problems, recipeGreen, handoffPresent };
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
export function verdict({ problems, counts = {}, total = 0, chain = 0, max = MAX_BLOCKS, maxTotal = MAX_TOTAL_BLOCKS, maxChain = MAX_CHAIN_BLOCKS }) {
    if (problems.length === 0) return { action: "allow" };

    const text = problems.map((p) => p.text).join("\n\n");
    // Only a reason that is wrong RIGHT NOW may release the gate. A cleared reason's counter is
    // zeroed, so this never remembers that the recipe was once red four times and lets every later
    // stop through on the strength of a problem that no longer exists.
    const spent = problems.map((p) => p.reason).filter((reason) => (counts[reason] ?? 0) > max);

    if (spent.length || total > maxTotal || chain > maxChain) {
        // Name the bound that actually released it. Saying "cap of 3" after nine refusals with a
        // per-reason count of 1 is false, and it is the same defect already fixed once in this very
        // message — a release that misreports why it happened sends a reader to the wrong constant.
        // Per-reason counters add one more way to be wrong: naming the cap without naming whose.
        // The chain bound is named LAST, so the two session-keyed bounds keep reporting themselves
        // wherever they can — a session whose id is stable must always meet those first. Reaching this
        // one is itself a finding about the host: it means the per-session counters could not see their
        // own history, which is what 2.1.251 does inside an isolated arm.
        const bound = spent.length
            ? `the cap of ${max} consecutive refusals for \`${spent.join("`, `")}\` was reached`
            : total > maxTotal
              ? `the absolute ceiling of ${maxTotal} refusals was reached (no single reason had reached its cap of ${max})`
              : `${chain} consecutive hook-provoked stops were seen in this tree, past the chain bound of ${maxChain} — ` +
                `the per-session caps never fired, which means this host issued a new session id per retry and their ` +
                `counters could not see their own history`;
        return {
            action: "release",
            message:
                `PORTULAN STOP-GATE — ${bound}. This session is ending **RED**, not done.\n` +
                `Nothing below was fixed, and the session ending does not fix it. Say so in the handoff and in any\n` +
                `report of this work; a task that ends at the cap is an unfinished task with a stop attached.\n\n` +
                `${text}\n`,
        };
    }

    // The counts shown are per reason, because that is what the caps now are. A single "2/3" would
    // be a number no constant in this file corresponds to the moment two reasons are live.
    const tally = problems.map((p) => `${p.reason} ${counts[p.reason] ?? 0}/${max}`).join(", ");
    return {
        action: "block",
        message:
            `PORTULAN STOP-GATE (${tally}) — this task is not done:\n\n${text}\n\n` +
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

    // **Resolved ONCE, here, and threaded down** — so every question this stop asks is about the same
    // tree, and the sentence that reports the answer names that tree rather than another one.
    const tree = resolveSessionTree(payload.cwd);

    // **Degradation is spoken when the datum was offered and could not be used, and silent when it was
    // never offered.** A host that sends no `cwd` has degraded nothing: it gets today's behaviour byte
    // for byte, which is also what makes every pre-existing case a control for this change. A host that
    // sent one this gate could not use is a different fact, and one a reader needs — printed whatever
    // the verdict turns out to be, because it explains an allow just as much as a refusal.
    //
    // **The honest residue: on this path the silent-allow gap of #220 REMAINS, by construction.** The
    // told root answers, and if the session's real tree carries unrecorded work this gate cannot see
    // it. Forcing a block instead would manufacture an obligation from no evidence and leave the
    // removed-worktree case permanently blocking — the false red the first arm was built to remove.
    if (tree.note) process.stderr.write(`portulan stop-gate: ${tree.note}; answering about ${REPO} instead.\n`);

    const { problems, recipeGreen, handoffPresent } = collectProblems(tree);

    // A reason's condition clearing ends THAT reason's futile-retry episode, whether or not the stop
    // is allowed, and never any other reason's. Done before the bump so a cleared reason cannot be
    // charged a consecutive refusal on the same turn it cleared.
    if (recipeGreen) clearReason(sessionId, "recipe");
    if (handoffPresent) clearReason(sessionId, "handoff");

    // Charged only when this gate is actually about to refuse. A green stop costs nothing.
    const state = problems.length === 0
        ? { counts: {}, total: 0 }
        : bumpCount(sessionId, [...new Set(problems.map((p) => p.reason))]);
    // **The chain follows the platform's own signal, not ours.** `stop_hook_active` is true exactly when
    // the stop being judged was provoked by a hook block, so it identifies the retry chain without any
    // session id. Cleared on a stop nothing provoked — including a green one, which ends a chain as
    // surely as a fixed problem does.
    const chain = bumpChain(problems.length > 0 && payload.stop_hook_active === true);
    const result = verdict({ problems, counts: state.counts, total: state.total, chain });

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
