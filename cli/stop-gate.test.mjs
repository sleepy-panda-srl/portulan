// Tests for the Stop-gate runner: its per-reason caps, the handoff date, its verdicts, the did-work signals and the tree it answers about.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { bumpChain, bumpCount, clearReason, today, verdict, REASONS, MAX_BLOCKS, MAX_CHAIN_BLOCKS, MAX_TOTAL_BLOCKS } from "./stop-gate.mjs";

// `./stop-gate.mjs` imports `./recipe-set.mjs`, which can read the host's installed-plugin record: point it at none.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});
function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-stopgate-test-"));
    SCRATCH.push(dir);
    return dir;
}

describe("the block counter — one count PER REASON, since task 0007", () => {
    test("counts up from one, per session, per reason", () => {
        const dir = scratch();
        assert.equal(bumpCount("s1", ["recipe"], dir).counts.recipe, 1);
        assert.equal(bumpCount("s1", ["recipe"], dir).counts.recipe, 2);
        assert.equal(bumpCount("s1", ["recipe"], dir).counts.recipe, 3);
        assert.equal(bumpCount("s1", ["recipe"], dir).counts.handoff, 0, "the other reason was never raised");
    });

    test("two reasons in ONE session share a session and a tree and still not a count", () => {
        const dir = scratch();
        bumpCount("s", ["recipe"], dir);
        bumpCount("s", ["recipe"], dir);
        const v = bumpCount("s", ["handoff"], dir);
        assert.equal(v.counts.recipe, 2, "the recipe count is untouched by a handoff refusal");
        assert.equal(v.counts.handoff, 1);
        assert.equal(v.total, 3, "but every refusal charges the shared ceiling");
    });

    test("one stop refused for BOTH reasons charges each reason once and the ceiling once", () => {
        const dir = scratch();
        const v = bumpCount("s", ["recipe", "handoff"], dir);
        assert.equal(v.counts.recipe, 1);
        assert.equal(v.counts.handoff, 1);
        assert.equal(v.total, 1);
    });

    test("sessions do not share a budget", () => {
        const dir = scratch();
        bumpCount("alpha", ["recipe"], dir);
        bumpCount("alpha", ["recipe"], dir);
        assert.equal(bumpCount("beta", ["recipe"], dir).counts.recipe, 1, "one session's refusals must not disarm another's gate");
    });

    test("two WORKTREES of one repository do not share a budget either", () => {
        const dir = scratch();
        bumpCount("same-session", ["recipe"], dir, "/repo/worktree-a");
        bumpCount("same-session", ["recipe"], dir, "/repo/worktree-a");
        assert.equal(bumpCount("same-session", ["recipe"], dir, "/repo/worktree-b").counts.recipe, 1);
    });

    test("ids that both sanitise to EMPTY still get their own counters", () => {
        const dir = scratch();
        bumpCount("!!!", ["recipe"], dir);
        bumpCount("###", ["handoff"], dir);
        assert.equal(fs.readdirSync(dir).length, 2, "two distinct sessions, two counters");
    });

    test("ids sharing a long prefix are not collapsed by truncation either", () => {
        const dir = scratch();
        const base = "s".repeat(80);
        bumpCount(`${base}-alpha`, ["recipe"], dir);
        bumpCount(`${base}-beta`, ["recipe"], dir);
        assert.equal(fs.readdirSync(dir).length, 2);
    });

    test("a session id with path separators cannot escape the counter directory", () => {
        const dir = scratch();
        assert.equal(bumpCount("../../etc/passwd", ["recipe"], dir).counts.recipe, 1);
        assert.equal(
            fs.readdirSync(dir).filter((f) => f.startsWith("portulan-stopgate-")).length,
            1,
            "the id is sanitised into the filename, not used as a path",
        );
    });

    test("an unwritable counter releases the session rather than trapping it", () => {
        const v = bumpCount("s", ["recipe"], path.join(scratch(), "does", "not", "exist"));
        for (const reason of REASONS) {
            assert.ok(v.counts[reason] > MAX_BLOCKS, `${reason}: expected above the cap of ${MAX_BLOCKS}, got ${v.counts[reason]}`);
        }
        assert.ok(v.total > MAX_TOTAL_BLOCKS, "and above the ceiling too, or the ceiling would trap it instead");
    });

    test("the cap is reached at MAX_BLOCKS and exceeded on the next refusal", () => {
        const dir = scratch();
        let last;
        for (let i = 0; i < MAX_BLOCKS; i += 1) last = bumpCount("s", ["recipe"], dir);
        assert.equal(last.counts.recipe, MAX_BLOCKS, "the last blocked stop is the cap itself, not one past it");
        assert.ok(bumpCount("s", ["recipe"], dir).counts.recipe > MAX_BLOCKS, "the next refusal releases the session");
    });
});

describe("the reason list and the counter file cannot drift apart", () => {
    test("a stored reason outside REASONS is preserved, counted, and still capped", () => {
        const dir = scratch();
        assert.equal(bumpCount("s", ["surprise"], dir).counts.surprise, 1);
        assert.equal(bumpCount("s", ["surprise"], dir).counts.surprise, 2, "the count survives the round trip");
        assert.equal(bumpCount("s", ["surprise"], dir).counts.surprise, 3);
        const past = bumpCount("s", ["surprise"], dir);
        assert.ok(past.counts.surprise > MAX_BLOCKS);
        assert.equal(
            verdict({ problems: [{ reason: "surprise", text: "x" }], counts: past.counts, total: past.total }).action,
            "release",
            "an unlisted reason must still reach its own cap, not ride to the ceiling",
        );
        for (const reason of REASONS) assert.equal(past.counts[reason], 0);
    });

    test("every reason the runner can emit is declared in REASONS", () => {
        // A source check, since `collectProblems` needs a real tree and a real recipe run.
        const source = fs.readFileSync(new URL("./stop-gate.mjs", import.meta.url), "utf8");
        const emitted = [...source.matchAll(/reason:\s*"([a-z-]+)"/g)].map((m) => m[1]);
        assert.ok(emitted.length >= 2, "the parser must be finding the reasons at all");
        for (const reason of new Set(emitted)) {
            assert.ok(REASONS.includes(reason), `stop.mjs emits reason \`${reason}\`, which REASONS does not declare`);
        }
    });
});

describe("consecutive semantics — a reason's counter clears only when THAT reason clears", () => {
    test("an observed green recipe clears the recipe count", () => {
        const dir = scratch();
        bumpCount("s", ["recipe"], dir);
        bumpCount("s", ["recipe"], dir);
        assert.equal(clearReason("s", "recipe", dir).counts.recipe, 0);
        assert.equal(bumpCount("s", ["recipe"], dir).counts.recipe, 1, "the next episode starts from one");
    });

    test("a green recipe does NOT clear the handoff count — the ruling, stated as a test", () => {
        const dir = scratch();
        bumpCount("s", ["handoff"], dir);
        bumpCount("s", ["handoff"], dir);
        const after = clearReason("s", "recipe", dir);
        assert.equal(after.counts.handoff, 2, "the handoff has not been dealt with, so its patience is not restored");
    });

    test("the handoff caps at THREE with the recipe green throughout — no longer riding to nine", () => {
        const dir = scratch();
        let counts;
        for (let i = 0; i < MAX_BLOCKS; i += 1) {
            clearReason("s", "recipe", dir);
            counts = bumpCount("s", ["handoff"], dir).counts;
            assert.equal(verdict({ problems: [{ reason: "handoff", text: "no handoff" }], counts, total: i + 1 }).action, "block");
        }
        clearReason("s", "recipe", dir);
        const last = bumpCount("s", ["handoff"], dir);
        assert.ok(last.counts.handoff > MAX_BLOCKS);
        assert.ok(last.total <= MAX_TOTAL_BLOCKS, "and it released on the reason's cap, well below the ceiling");
        const released = verdict({ problems: [{ reason: "handoff", text: "no handoff" }], counts: last.counts, total: last.total });
        assert.equal(released.action, "release");
        assert.match(released.message, /handoff/, "the released message must name the reason whose cap was spent");
    });

    test("the clear does not touch the running total", () => {
        const dir = scratch();
        bumpCount("s", ["recipe"], dir);
        bumpCount("s", ["recipe"], dir);
        clearReason("s", "recipe", dir);
        assert.equal(bumpCount("s", ["recipe"], dir).total, 3, "the total survives the clear");
    });

    test("a long honest session that fixes each red is not taxed for having done the work", () => {
        const dir = scratch();
        for (let episode = 0; episode < 3; episode += 1) {
            assert.equal(bumpCount("s", ["recipe"], dir).counts.recipe, 1);
            assert.equal(bumpCount("s", ["recipe"], dir).counts.recipe, 2);
            clearReason("s", "recipe", dir);
        }
        assert.equal(bumpCount("s", ["recipe"], dir).counts.recipe, 1, "three fixed reds later, the gate is still willing to argue");
    });

    test("the absolute ceiling still releases regardless of any per-reason count", () => {
        const v = verdict({ problems: [{ reason: "handoff", text: "handoff missing" }], counts: { handoff: 1 }, total: MAX_TOTAL_BLOCKS + 1 });
        assert.equal(v.action, "release", "a low per-reason count must not outvote a spent ceiling");
        assert.match(v.message, /ending \*\*RED\*\*, not done/);
        assert.match(v.message, /ceiling/, "the message must name the bound that actually released it");
    });

    test("clearing a counter that was never written is harmless", () => {
        assert.equal(clearReason("never-seen", "recipe", scratch()).counts.recipe, 0);
    });
});

describe("the handoff date", () => {
    test("is the LOCAL date, not UTC", () => {
        // 01:00 local: east of UTC, `toISOString()` would say the 26th.
        const stamp = today(new Date(2026, 6, 27, 1, 0, 0));
        assert.equal(stamp, "2026-07-27");
    });

    test("pads month and day so it sorts and matches a filename prefix", () => {
        assert.equal(today(new Date(2026, 0, 5, 12, 0, 0)), "2026-01-05");
    });

    test("the format is exactly the one handoffs are named with", () => {
        assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
    });
});

describe("the verdict — both directions, because only one of them is tested by instinct", () => {
    const red = (text = "recipe red") => [{ reason: "recipe", text }];

    test("no problems means allow, and allow never charges the budget", () => {
        assert.equal(verdict({ problems: [], counts: {}, total: 0 }).action, "allow");
        assert.equal(
            verdict({ problems: [], counts: { recipe: 99, handoff: 99 }, total: 99 }).action,
            "allow",
            "a spent budget must not turn green into a block",
        );
    });

    test("a problem below the cap blocks, and says which refusal this is", () => {
        const v = verdict({ problems: red(), counts: { recipe: 2 }, total: 2 });
        assert.equal(v.action, "block");
        assert.match(v.message, /2\/3/);
        assert.match(v.message, /recipe red/);
    });

    test("past a reason's cap the session is released, and the message says RED rather than done", () => {
        const v = verdict({ problems: red(), counts: { recipe: MAX_BLOCKS + 1 }, total: MAX_BLOCKS + 1 });
        assert.equal(v.action, "release");
        assert.match(v.message, /ending \*\*RED\*\*, not done/);
        assert.match(v.message, /recipe red/, "the unresolved problems must survive into the release message");
    });

    test("the cap itself still blocks — release begins one past it", () => {
        assert.equal(verdict({ problems: red("x"), counts: { recipe: MAX_BLOCKS }, total: MAX_BLOCKS }).action, "block");
        assert.equal(verdict({ problems: red("x"), counts: { recipe: MAX_BLOCKS + 1 }, total: MAX_BLOCKS + 1 }).action, "release");
    });

    test("the release names WHICH bound released it — a reason's cap, or the ceiling", () => {
        const byCap = verdict({ problems: red(), counts: { recipe: MAX_BLOCKS + 1 }, total: MAX_BLOCKS + 1 });
        assert.match(byCap.message, /`recipe`/, "name the reason whose patience ran out");
        assert.match(byCap.message, new RegExp(`${MAX_BLOCKS}`));
        assert.doesNotMatch(byCap.message, /ceiling/, "the ceiling did not release this one");

        const byCeiling = verdict({ problems: red(), counts: { recipe: 1 }, total: MAX_TOTAL_BLOCKS + 1 });
        assert.match(byCeiling.message, /ceiling/);
        assert.match(byCeiling.message, new RegExp(`${MAX_TOTAL_BLOCKS}`));
    });

    // ---- the two-reason interaction, tested directly ------------------------------------------

    test("one reason over its cap releases the stop even while the other is still under", () => {
        const v = verdict({
            problems: [{ reason: "recipe", text: "recipe red" }, { reason: "handoff", text: "no handoff" }],
            counts: { recipe: MAX_BLOCKS + 1, handoff: 1 },
            total: MAX_BLOCKS + 1,
        });
        assert.equal(v.action, "release");
        assert.match(v.message, /recipe red/);
        assert.match(v.message, /no handoff/, "the reason that had not run out is still an unresolved problem");
    });

    test("both reasons under their caps blocks, however many there are", () => {
        const v = verdict({
            problems: [{ reason: "recipe", text: "recipe red" }, { reason: "handoff", text: "no handoff" }],
            counts: { recipe: MAX_BLOCKS, handoff: MAX_BLOCKS },
            total: MAX_BLOCKS,
        });
        assert.equal(v.action, "block", "at the cap, not past it");
        assert.match(v.message, /recipe red/);
        assert.match(v.message, /no handoff/);
    });

    test("a cleared reason's counter does not vote — only what is wrong NOW can release the gate", () => {
        const v = verdict({
            problems: [{ reason: "handoff", text: "no handoff" }],
            counts: { recipe: 0, handoff: 1 },
            total: 5,
        });
        assert.equal(v.action, "block");
    });
});

describe("a recipe that cannot run is not a verdict about the repository", () => {
    const CANNOT_RUN = new Set([2, 126, 127]);

    function statusOf(command) {
        try {
            execFileSync("bash", ["-c", command], { stdio: "ignore" });
            return 0;
        } catch (error) {
            return error.status;
        }
    }

    test("a missing script exits 127, and 127 is classified as could-not-run", () => {
        const code = statusOf("./definitely-not-a-real-recipe.sh");
        assert.equal(code, 127, "premise: the shell reports a missing command as 127");
        assert.ok(CANNOT_RUN.has(code), "so the gate must not call it RED");
    });

    test("a non-executable file exits 126, and 126 is classified as could-not-run", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-noexec-"));
        SCRATCH.push(dir);
        const file = path.join(dir, "recipe.sh");
        fs.writeFileSync(file, "#!/bin/sh\ntrue\n", { mode: 0o644 });
        const code = statusOf(JSON.stringify(file));
        assert.equal(code, 126, "premise: found but not executable is 126");
        assert.ok(CANNOT_RUN.has(code));
    });

    test("an ordinary failure is still RED — the fix must not swallow real reds", () => {
        const code = statusOf("exit 1");
        assert.equal(code, 1);
        assert.ok(!CANNOT_RUN.has(code), "exit 1 is a verdict about the tree and must stay one");
    });
});

// ---------------------------------------------------------------- the did-work signals, driven as the host drives them

const RUNNER = fileURLToPath(new URL("./stop-gate.mjs", import.meta.url));

function git(cwd, args) {
    return execFileSync(
        "git",
        ["-c", "user.name=portulan-test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args],
        { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
}

/** `spawnSync`: the runner exits 0 either way, and `execFileSync` returns stderr only through a throw. */
function gate(project, sessionId, env = {}, payload = {}) {
    const run = spawnSync("node", [RUNNER], {
        input: JSON.stringify({ ...payload, session_id: sessionId }),
        env: { ...process.env, CLAUDE_PROJECT_DIR: project, ...env },
        encoding: "utf8",
    });
    // No output reads as an allow, so a runner that could not start or that threw must fail here.
    assert.equal(run.error, undefined, `the runner could not be spawned: ${run.error?.message}`);
    assert.equal(run.status, 0, `the runner exited ${run.status} — stderr: ${run.stderr}`);
    const out = run.stdout.trim() ? JSON.parse(run.stdout) : null;
    return { decision: out?.decision ?? "allow", reason: out?.reason ?? "", stderr: run.stderr ?? "" };
}

const MANIFEST = JSON.stringify({
    spec: "2.1",
    name: "fixture",
    // A green recipe, so `handoff` is the only reason a case can be refused for.
    verify: { default: "always-green", recipes: [{ id: "always-green", run: "true" }] },
});

/** A clone whose branch was rebase-merged, then deleted: `HEAD --not --remotes` lists its original commits for good. */
function rebaseMerged({ genuinelyUnmerged = false } = {}) {
    const root = scratch();
    const origin = path.join(root, "origin.git");
    const work = path.join(root, "work");
    const hub = path.join(root, "hub");
    execFileSync("git", ["init", "-q", "--bare", origin]);
    // `git init --bare` follows the host's init.defaultBranch, and `set-head -a` fails where that is not `main`.
    execFileSync("git", ["--git-dir", origin, "symbolic-ref", "HEAD", "refs/heads/main"]);
    execFileSync("git", ["clone", "-q", origin, work], { stdio: ["ignore", "pipe", "pipe"] });
    fs.mkdirSync(path.join(work, ".portulan", "handoffs"), { recursive: true });
    fs.writeFileSync(path.join(work, ".portulan", "workspace.json"), MANIFEST);
    fs.writeFileSync(path.join(work, "f.txt"), "base\n");
    git(work, ["add", "-A"]);
    git(work, ["commit", "-m", "base"]);
    git(work, ["branch", "-M", "main"]);
    git(work, ["push", "-q", "origin", "main"]);
    git(work, ["checkout", "-q", "-b", "feat"]);
    fs.appendFileSync(path.join(work, "f.txt"), "one\n");
    git(work, ["commit", "-am", "feat one"]);
    git(work, ["push", "-q", "origin", "feat"]);
    execFileSync("git", ["clone", "-q", origin, hub], { stdio: ["ignore", "pipe", "pipe"] });
    git(hub, ["checkout", "-q", "main"]);
    // Another committer date: a pick with the same parent, identity and second reproduces the original sha.
    execFileSync(
        "git",
        ["-c", "user.name=portulan-test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false",
            "cherry-pick", "origin/feat"],
        { cwd: hub, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, GIT_COMMITTER_DATE: "2026-01-01T00:00:00 +0000" } },
    );
    git(hub, ["push", "-q", "origin", "main"]);
    git(hub, ["push", "-q", "origin", "--delete", "feat"]);
    git(work, ["fetch", "-q", "--prune", "origin"]);
    git(work, ["remote", "set-head", "origin", "-a"]);
    if (genuinelyUnmerged) {
        fs.appendFileSync(path.join(work, "f.txt"), "work nobody has seen\n");
        git(work, ["commit", "-am", "genuinely unmerged"]);
    }
    return work;
}

describe("did-work, in a repository that rebase-merges (#220)", () => {
    test("a rebase-orphaned branch whose every patch is upstream owes no handoff", () => {
        const repo = rebaseMerged();
        assert.notEqual(git(repo, ["log", "--oneline", "HEAD", "--not", "--remotes"]).trim(), "", "premise: orphans exist by reachability");
        assert.equal(git(repo, ["cherry", "origin/main", "HEAD"]).split("\n").filter((l) => l.startsWith("+")).length, 0, "premise: every patch is upstream");
        assert.equal(git(repo, ["status", "--porcelain"]).trim(), "", "premise: the tree is clean");

        const { decision, reason } = gate(repo, "orphaned-and-upstream");
        assert.equal(decision, "allow", `a session that did nothing must not be told to write a handoff — got: ${reason}`);
    });

    test("genuinely unmerged work still owes one — the control that stops this becoming a fail-open", () => {
        const repo = rebaseMerged({ genuinelyUnmerged: true });
        assert.equal(git(repo, ["cherry", "origin/main", "HEAD"]).split("\n").filter((l) => l.startsWith("+")).length, 1, "premise: exactly one patch is not upstream");

        const { decision, reason } = gate(repo, "genuinely-unmerged");
        assert.equal(decision, "block", "work that is on no remote by PATCH must still demand a handoff");
        assert.match(reason, /no handoff dated/, "and it must block for the handoff reason");
    });

    test("the refusal offers committing and pushing as the other way out, and names no Session log", () => {
        const repo = rebaseMerged({ genuinelyUnmerged: true });
        const { decision, reason } = gate(repo, "open-work-names-both-exits");
        assert.equal(decision, "block");
        assert.match(reason, /not committed and pushed/);
        assert.match(reason, /Commit and push it, its why in the commit message, or end with a dated handoff/);
        assert.doesNotMatch(reason, /Session log|Every session ends/);
    });

    test("a handoff dated today clears it, orphans or no orphans", () => {
        const repo = rebaseMerged({ genuinelyUnmerged: true });
        fs.writeFileSync(path.join(repo, ".portulan", "handoffs", `${today()}-a-session-that-did-its-job.md`), "five lines is enough\n");
        assert.equal(gate(repo, "handoff-present").decision, "allow");
    });

    test("with several remotes, the base is `origin` — not whichever git lists first", () => {
        const repo = rebaseMerged();
        const root = path.dirname(repo);
        execFileSync("git", ["init", "-q", "--bare", path.join(root, "backup.git")]);
        execFileSync("git", ["--git-dir", path.join(root, "backup.git"), "symbolic-ref", "HEAD", "refs/heads/main"]);
        git(repo, ["remote", "add", "backup", path.join(root, "backup.git")]);
        git(repo, ["push", "-q", "backup", `${git(repo, ["rev-list", "--max-parents=0", "HEAD"]).trim()}:refs/heads/main`]);
        git(repo, ["fetch", "-q", "backup"]);
        git(repo, ["remote", "set-head", "backup", "-a"]);
        assert.equal(git(repo, ["remote"]).trim().split("\n")[0], "backup", "premise: git lists `backup` first");
        assert.ok(git(repo, ["cherry", "backup/HEAD", "HEAD"]).split("\n").filter((l) => l.startsWith("+")).length > 0,
            "premise: against `backup` the work looks entirely unmerged");

        const { decision, reason } = gate(repo, "several-remotes");
        assert.equal(decision, "allow", `the base must be origin, whose patches this branch carries — got: ${reason}`);
    });

    test("when patch-id cannot answer, the gate keeps the coarse reading and SAYS the refinement failed", () => {
        // A remote added and never fetched: `origin/HEAD` does not resolve, so patch-id cannot answer.
        const root = scratch();
        const repo = path.join(root, "repo");
        fs.mkdirSync(path.join(repo, ".portulan", "handoffs"), { recursive: true });
        fs.writeFileSync(path.join(repo, ".portulan", "workspace.json"), MANIFEST);
        fs.writeFileSync(path.join(repo, "f.txt"), "work\n");
        execFileSync("git", ["init", "-q", repo]);
        git(repo, ["add", "-A"]);
        git(repo, ["commit", "-m", "unpushed work"]);
        git(repo, ["remote", "add", "origin", path.join(root, "nowhere.git")]);
        assert.equal(git(repo, ["remote"]).trim(), "origin", "premise: a remote is configured");

        const { decision, stderr } = gate(repo, "cherry-cannot-answer");
        assert.equal(decision, "block", "could-not-tell must not be spendable as a green");
        assert.match(stderr, /patch/i, "the sentence must name the refinement that failed rather than passing silently");
    });

    test("a repository with no remote at all reads every commit as work, and says nothing about patch-id", () => {
        const root = scratch();
        const repo = path.join(root, "repo");
        fs.mkdirSync(path.join(repo, ".portulan", "handoffs"), { recursive: true });
        fs.writeFileSync(path.join(repo, ".portulan", "workspace.json"), MANIFEST);
        fs.writeFileSync(path.join(repo, "f.txt"), "work\n");
        execFileSync("git", ["init", "-q", repo]);
        git(repo, ["add", "-A"]);
        git(repo, ["commit", "-m", "local only"]);
        assert.equal(git(repo, ["remote"]).trim(), "", "premise: no remotes");

        const { decision, stderr } = gate(repo, "no-remotes-at-all");
        assert.equal(decision, "block", "with nowhere to have pushed, every commit is unrecorded work");
        assert.doesNotMatch(stderr, /patch/i, "this is the documented reading, not a degradation — it must not report one");
    });
});

describe("the handoff question names the tree it answered about (#220, second half)", () => {
    test("a refusal names the working tree and branch, so a reader can see WHICH tree was asked", () => {
        const repo = rebaseMerged({ genuinelyUnmerged: true });
        const { decision, reason } = gate(repo, "names-the-tree");
        assert.equal(decision, "block");
        assert.ok(reason.includes(repo), `the refusal must name the tree it read (${repo}) — got: ${reason}`);
        assert.match(reason, /feat/, "and the branch that tree is on");
    });

    test("one date per verdict — the refusal never carries two", () => {
        const repo = rebaseMerged({ genuinelyUnmerged: true });
        const stamp = today();
        git(repo, ["checkout", "-q", "-b", "carries-the-handoff"]);
        fs.writeFileSync(path.join(repo, ".portulan", "handoffs", `${stamp}-merged-already.md`), "why\n");
        git(repo, ["add", "-A"]);
        git(repo, ["commit", "-m", "the handoff"]);
        git(repo, ["checkout", "-q", "feat"]);

        const { reason } = gate(repo, "one-date-per-verdict");
        const dates = [...new Set(reason.match(/\d{4}-\d{2}-\d{2}/g) ?? [])];
        assert.deepEqual(dates, [stamp], `every date in one refusal must be the same one: ${dates.join(", ")}`);
        // Both halves must be there, or a lone date passes with nothing to disagree with.
        assert.match(reason, /no handoff dated/, "the check half");
        assert.match(reason, /does exist elsewhere/, "the elsewhere half");
    });

    test("the history lookup survives a host that reads `*` literally", () => {
        // Under `GIT_NOGLOB_PATHSPECS` a bare `*` is literal (git 2.50.1), so the runner's pathspec carries `:(glob)`.
        const repo = rebaseMerged({ genuinelyUnmerged: true });
        const stamp = today();
        git(repo, ["checkout", "-q", "-b", "carries-the-handoff"]);
        fs.writeFileSync(path.join(repo, ".portulan", "handoffs", `${stamp}-merged-already.md`), "why\n");
        git(repo, ["add", "-A"]);
        git(repo, ["commit", "-m", "the handoff"]);
        git(repo, ["checkout", "-q", "feat"]);

        const { decision, reason } = gate(repo, "noglob-pathspecs", { GIT_NOGLOB_PATHSPECS: "1" });
        assert.equal(decision, "block");
        assert.match(reason, /carries-the-handoff|elsewhere/i,
            "the elsewhere-report must survive a host that disables glob pathspecs");
    });

    test("a DETACHED tree is named by its commit, never as a branch called HEAD", () => {
        const repo = rebaseMerged({ genuinelyUnmerged: true });
        git(repo, ["checkout", "-q", "--detach"]);
        assert.equal(git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]).trim(), "HEAD", "premise: git says the branch is `HEAD`");
        const short = git(repo, ["rev-parse", "--short", "HEAD"]).trim();

        const { decision, reason } = gate(repo, "detached-tree");
        assert.equal(decision, "block");
        assert.doesNotMatch(reason, /on `HEAD`/, "must not name a branch that does not exist");
        assert.ok(reason.includes(short), `must name the commit instead — expected ${short} in: ${reason}`);
    });

    test("a handoff dated today in fetched history, absent from THIS tree, is reported rather than hidden", () => {
        const repo = rebaseMerged({ genuinelyUnmerged: true });
        const stamp = today();
        git(repo, ["checkout", "-q", "-b", "carries-the-handoff"]);
        fs.writeFileSync(path.join(repo, ".portulan", "handoffs", `${stamp}-merged-already.md`), "why\n");
        git(repo, ["add", "-A"]);
        git(repo, ["commit", "-m", "the handoff"]);
        git(repo, ["checkout", "-q", "feat"]);
        assert.ok(!fs.existsSync(path.join(repo, ".portulan", "handoffs", `${stamp}-merged-already.md`)), "premise: absent from this working tree");

        const { decision, reason } = gate(repo, "handoff-lives-elsewhere");
        assert.equal(decision, "block", "still blocks: the gate cannot know this session wrote it");
        assert.match(reason, /carries-the-handoff|history|another/i, "but it must SAY the record exists elsewhere rather than only that this tree lacks it");
    });
});

/** A clone whose pushed `main` carries another session's handoff dated today, and whose tree holds staged work. */
function mergedHandoff(workspace = ".portulan") {
    const stamp = today();
    const root = scratch();
    const origin = path.join(root, "origin.git");
    const work = path.join(root, "work");
    execFileSync("git", ["init", "-q", "--bare", origin]);
    execFileSync("git", ["--git-dir", origin, "symbolic-ref", "HEAD", "refs/heads/main"]);
    execFileSync("git", ["clone", "-q", origin, work], { stdio: ["ignore", "pipe", "pipe"] });
    fs.mkdirSync(path.join(work, workspace, "handoffs"), { recursive: true });
    fs.writeFileSync(path.join(work, workspace, "workspace.json"), MANIFEST);
    fs.writeFileSync(path.join(work, workspace, "handoffs", `${stamp}-another-session.md`), "what that session left open\n");
    fs.writeFileSync(path.join(work, "f.txt"), "base\n");
    git(work, ["add", "-A"]);
    git(work, ["commit", "-m", "another session's change, merged with its handoff"]);
    git(work, ["branch", "-M", "main"]);
    git(work, ["push", "-q", "-u", "origin", "main"]);
    fs.appendFileSync(path.join(work, "f.txt"), "this session's work\n");
    git(work, ["add", "f.txt"]);
    return { work, stamp };
}

/** A clone whose handoff commit was rebase-merged and its branch deleted, with the next work staged in the tree. */
function rebaseMergedHandoff() {
    const stamp = today();
    const root = scratch();
    const origin = path.join(root, "origin.git");
    const work = path.join(root, "work");
    const merger = path.join(root, "merger");
    execFileSync("git", ["init", "-q", "--bare", origin]);
    execFileSync("git", ["--git-dir", origin, "symbolic-ref", "HEAD", "refs/heads/main"]);
    execFileSync("git", ["clone", "-q", origin, work], { stdio: ["ignore", "pipe", "pipe"] });
    fs.mkdirSync(path.join(work, ".portulan", "handoffs"), { recursive: true });
    fs.writeFileSync(path.join(work, ".portulan", "workspace.json"), MANIFEST);
    fs.writeFileSync(path.join(work, "f.txt"), "base\n");
    git(work, ["add", "-A"]);
    git(work, ["commit", "-m", "base"]);
    git(work, ["branch", "-M", "main"]);
    git(work, ["push", "-q", "-u", "origin", "main"]);
    git(work, ["checkout", "-q", "-b", "feature"]);
    fs.writeFileSync(path.join(work, ".portulan", "handoffs", `${stamp}-this-session.md`), "what this session left open\n");
    git(work, ["add", "-A"]);
    git(work, ["commit", "-m", "this session's change and its handoff"]);
    git(work, ["push", "-q", "-u", "origin", "feature"]);
    execFileSync("git", ["clone", "-q", origin, merger], { stdio: ["ignore", "pipe", "pipe"] });
    fs.writeFileSync(path.join(merger, "g.txt"), "another change\n");
    git(merger, ["add", "g.txt"]);
    git(merger, ["commit", "-m", "another change, merged first"]);
    git(merger, ["cherry-pick", "origin/feature"]);
    git(merger, ["push", "-q", "origin", "main"]);
    git(merger, ["push", "-q", "origin", "--delete", "feature"]);
    git(work, ["fetch", "-q", "--prune"]);
    fs.appendFileSync(path.join(work, "f.txt"), "this session's next work\n");
    git(work, ["add", "f.txt"]);
    return { work, stamp };
}

describe("a handoff answers for the work only while this tree has not pushed it", () => {
    test("a handoff merged on the base branch does not release a tree holding other work", () => {
        const { work, stamp } = mergedHandoff();
        assert.ok(fs.existsSync(path.join(work, ".portulan", "handoffs", `${stamp}-another-session.md`)), "premise: a handoff dated today is in this tree");
        assert.equal(git(work, ["status", "--porcelain", "--", ".portulan"]).trim(), "", "premise: it is committed and unchanged");
        assert.equal(git(work, ["log", "--oneline", "HEAD", "--not", "--remotes"]).trim(), "", "premise: and pushed");
        assert.match(git(work, ["status", "--porcelain"]), /^M {2}f\.txt$/m, "premise: this session's work is staged and uncommitted");

        const { decision, reason } = gate(work, "merged-handoff");
        assert.equal(decision, "block", "a handoff another session recorded must not answer for this session's unrecorded work");
        assert.match(reason, /no handoff dated/);
        assert.ok(reason.includes(`${stamp}-another-session.md`), `the refusal names the dated file it did not count — got: ${reason}`);
        assert.match(reason, /committed and pushed already/, "and says why it did not count");
        assert.doesNotMatch(reason, /does exist elsewhere/, "a handoff this tree holds is not one elsewhere");
    });

    test("a handoff merged by a rebase, its branch deleted, does not release the next work", () => {
        const { work, stamp } = rebaseMergedHandoff();
        const handoff = `.portulan/handoffs/${stamp}-this-session.md`;
        assert.equal(git(work, ["status", "--porcelain", "--", ".portulan"]).trim(), "", "premise: the handoff is committed and unchanged");
        assert.notEqual(git(work, ["log", "--oneline", "HEAD", "--not", "--remotes"]).trim(), "", "premise: no remote holds the commit that carries it");
        assert.equal(git(work, ["rev-parse", `origin/main:${handoff}`]), git(work, ["rev-parse", `HEAD:${handoff}`]), "premise: the base branch holds its content");
        assert.match(git(work, ["status", "--porcelain"]), /^M {2}f\.txt$/m, "premise: this session's next work is staged and uncommitted");

        const { decision, reason } = gate(work, "rebase-merged-handoff");
        assert.equal(decision, "block", "a handoff a remote holds, in whatever commit, must not answer for work after it");
        assert.ok(reason.includes(`${stamp}-this-session.md`), `the refusal names the dated file it did not count — got: ${reason}`);
        assert.match(reason, /committed and pushed already/, "and says why it did not count");
        assert.doesNotMatch(reason, /does exist elsewhere/, "the base branch's copy of a handoff this tree holds is not one elsewhere");
    });

    test("a workspace whose name begins with two dots is still inside the repository", () => {
        const { work, stamp } = mergedHandoff("..portulan");
        const { decision, reason } = gate(work, "dotted-workspace", { PORTULAN_WORKSPACE: "..portulan" });
        assert.equal(decision, "block", "a handoff merged in `..portulan/` is recorded as surely as one in `.portulan/`");
        assert.ok(reason.includes(`${stamp}-another-session.md`), `the refusal names the dated file it did not count — got: ${reason}`);
        assert.match(reason, /committed and pushed already/);
    });

    test("pushing the work ends the handoff refusals it earned, so the next work meets the whole cap", () => {
        const { work, stamp } = mergedHandoff();
        assert.match(gate(work, "refused-then-pushed").reason, /handoff 1\/3/);
        assert.match(gate(work, "refused-then-pushed").reason, /handoff 2\/3/);
        fs.writeFileSync(path.join(work, ".portulan", "handoffs", `${stamp}-this-session.md`), "what is open\n");
        git(work, ["add", "-A"]);
        git(work, ["commit", "-m", "this session's work and its handoff"]);
        git(work, ["push", "-q"]);
        assert.equal(gate(work, "refused-then-pushed").decision, "allow", "premise: the work and its handoff are pushed");
        fs.appendFileSync(path.join(work, "f.txt"), "this session's next work\n");
        git(work, ["add", "f.txt"]);
        const { decision, reason } = gate(work, "refused-then-pushed");
        assert.equal(decision, "block");
        assert.match(reason, /handoff 1\/3/, "the refusals before the push were about work the push recorded");
    });

    test("this session's own handoff, untracked beside the merged one, releases it", () => {
        const { work, stamp } = mergedHandoff();
        fs.writeFileSync(path.join(work, ".portulan", "handoffs", `${stamp}-this-session.md`), "what is open\n");
        assert.equal(gate(work, "own-handoff-untracked").decision, "allow");
    });

    test("this session's own handoff, committed and not yet pushed, releases it", () => {
        const { work, stamp } = mergedHandoff();
        fs.writeFileSync(path.join(work, ".portulan", "handoffs", `${stamp}-this-session.md`), "what is open\n");
        git(work, ["add", "-A"]);
        git(work, ["commit", "-m", "this session's work and its handoff"]);
        assert.equal(git(work, ["status", "--porcelain"]).trim(), "", "premise: nothing is uncommitted");
        assert.notEqual(git(work, ["log", "--oneline", "@{u}..HEAD"]).trim(), "", "premise: the commit is not pushed");
        assert.equal(gate(work, "own-handoff-committed").decision, "allow");
    });
});

// ---------------------------------------------------------------- which tree the gate answers about

/** One repository, two working trees: the root the hook is told, and the session's own. */
function twoTrees({ toldCarriesHandoff = true, sessionDirty = true } = {}) {
    // One date for the whole fixture: a build spanning local midnight would otherwise name two days.
    const stamp = today();
    const root = scratch();
    const origin = path.join(root, "origin.git");
    const told = path.join(root, "told");
    const session = path.join(root, "wt");
    execFileSync("git", ["init", "-q", "--bare", origin]);
    execFileSync("git", ["--git-dir", origin, "symbolic-ref", "HEAD", "refs/heads/main"]);
    execFileSync("git", ["clone", "-q", origin, told], { stdio: ["ignore", "pipe", "pipe"] });
    fs.mkdirSync(path.join(told, ".portulan", "handoffs"), { recursive: true });
    fs.writeFileSync(path.join(told, ".portulan", "workspace.json"), MANIFEST);
    fs.writeFileSync(path.join(told, "f.txt"), "base\n");
    // Committed: an untracked handoff would leave the told tree dirty, which reads as work done.
    if (toldCarriesHandoff) fs.writeFileSync(path.join(told, ".portulan", "handoffs", `${stamp}-told.md`), "why\n");
    git(told, ["add", "-A"]);
    git(told, ["commit", "-m", "base"]);
    git(told, ["branch", "-M", "main"]);
    git(told, ["push", "-q", "-u", "origin", "main"]);

    // The session's worktree commits the handoff's removal, so its only dirt is the unrecorded work below.
    git(told, ["worktree", "add", "-q", session, "-b", "session-branch"]);
    if (toldCarriesHandoff) {
        git(session, ["rm", "-q", path.join(".portulan", "handoffs", `${stamp}-told.md`)]);
        git(session, ["commit", "-m", "this tree carries no handoff for today"]);
    }
    fs.mkdirSync(path.join(session, ".portulan", "handoffs"), { recursive: true });
    if (sessionDirty) fs.appendFileSync(path.join(session, "f.txt"), "work nobody has recorded\n");
    return { told, session, stamp };
}

describe("which tree the gate answers about (#220, second arm)", () => {
    test("THE CRITERION — work in the session's tree is not allowed to pass in silence", () => {
        const { told, session, stamp } = twoTrees();
        assert.equal(git(told, ["status", "--porcelain"]).trim(), "", "premise: told tree clean");
        assert.notEqual(git(session, ["status", "--porcelain"]).trim(), "", "premise: session tree dirty");
        assert.ok(fs.existsSync(path.join(told, ".portulan", "handoffs", `${stamp}-told.md`)), "premise: told carries today's handoff");

        const { decision, reason } = gate(told, "criterion", {}, { cwd: session });
        assert.equal(decision, "block", "a session with unrecorded work in its own tree owes a handoff");
        assert.ok(reason.includes(session), "and the refusal must name the tree that answered");
        assert.ok(reason.includes(told), "and the tree the hook was told, since they differ");
    });

    test("a session tree that is clean and recorded still allows", () => {
        const { told, session, stamp } = twoTrees({ sessionDirty: false });
        fs.writeFileSync(path.join(session, ".portulan", "handoffs", `${stamp}-session.md`), "why\n");
        git(session, ["add", "-A"]);
        git(session, ["commit", "-m", "its own handoff"]);
        assert.equal(git(session, ["status", "--porcelain"]).trim(), "", "premise: the session tree is clean");
        assert.equal(gate(told, "session-clean", {}, { cwd: session }).decision, "allow");
    });

    test("a cwd INSIDE the told tree is the told tree — sessions cd, and that is not divergence", () => {
        const { told } = twoTrees({ sessionDirty: false });
        const sub = path.join(told, "cli");
        fs.mkdirSync(sub, { recursive: true });
        const bare = gate(told, "subdir-a", {});
        const viaSub = gate(told, "subdir-b", {}, { cwd: sub });
        assert.equal(viaSub.decision, bare.decision, "a subdirectory must not change the verdict");
        assert.doesNotMatch(viaSub.reason, /not the one this hook was told/, "nor read as a divergence");
    });

    test("a SYMLINKED told root is one tree, not two — the sentence must not invent a divergence", () => {
        const { told } = twoTrees({ toldCarriesHandoff: false });
        fs.appendFileSync(path.join(told, "f.txt"), "unrecorded\n");
        const link = path.join(path.dirname(told), "told-by-another-name");
        fs.symlinkSync(told, link);
        const sub = path.join(link, "cli");
        fs.mkdirSync(path.join(told, "cli"), { recursive: true });

        const { decision, reason } = gate(link, "symlinked-told", {}, { cwd: sub });
        assert.equal(decision, "block", "premise: there is unrecorded work, so a refusal carries the sentence");
        assert.doesNotMatch(reason, /not the one this hook was told/,
            "one directory under two spellings is one tree");
    });

    test("the degraded path SPEAKS on an allow too — and still cannot see the session's tree", () => {
        const { told } = twoTrees();
        const nowhere = path.join(scratch(), "not-a-repository");
        fs.mkdirSync(nowhere, { recursive: true });

        const { decision, stderr } = gate(told, "degraded-allow", {}, { cwd: nowhere });
        assert.equal(decision, "allow", "the told tree is clean and recorded, so this stop is allowed");
        assert.match(stderr, /not inside a git repository/, "and the degradation is spoken anyway");
    });

    test("THE BYPASS CONTROL — a foreign repository cannot answer for this one", () => {
        const { told } = twoTrees({ toldCarriesHandoff: false });
        fs.appendFileSync(path.join(told, "f.txt"), "unrecorded work in the governed tree\n");
        const foreign = path.join(scratch(), "elsewhere");
        fs.mkdirSync(foreign, { recursive: true });
        execFileSync("git", ["init", "-q", foreign]);
        fs.writeFileSync(path.join(foreign, "f.txt"), "clean\n");
        git(foreign, ["add", "-A"]);
        git(foreign, ["commit", "-m", "clean"]);

        const { decision, stderr } = gate(told, "bypass", {}, { cwd: foreign });
        assert.equal(decision, "block", "a foreign clean tree must not excuse work in the governed one");
        assert.match(stderr, /different repository/, "and the gate must say why it ignored the cwd");
    });

    test("THE KNOWN HOLE (#307) — a clean recorded sibling named in cwd silences a dirty told root; pinned, not endorsed", () => {
        // `cwd` says where a session ended, never where it worked, and it is the one field a gated agent can move.
        const { told, session, stamp } = twoTrees({ toldCarriesHandoff: false, sessionDirty: false });
        fs.appendFileSync(path.join(told, "f.txt"), "unrecorded work in the tree this hook governs\n");
        fs.writeFileSync(path.join(session, ".portulan", "handoffs", `${stamp}-session.md`), "why\n");
        git(session, ["add", "-A"]);
        git(session, ["commit", "-m", "the sibling records its own day"]);

        assert.notEqual(git(told, ["status", "--porcelain"]).trim(), "", "premise: the told tree is dirty");
        assert.ok(!fs.existsSync(path.join(told, ".portulan", "handoffs", `${stamp}-told.md`)), "premise: the told tree has no handoff today");
        assert.equal(git(session, ["status", "--porcelain"]).trim(), "", "premise: the sibling is clean");
        assert.ok(fs.existsSync(path.join(session, ".portulan", "handoffs", `${stamp}-session.md`)), "premise: the sibling carries today's handoff");

        assert.equal(gate(told, "known-hole-control", {}).decision, "block",
            "with no cwd the told tree answers and its unrecorded work is caught");

        const { decision, reason, stderr } = gate(told, "known-hole", {}, { cwd: session });
        assert.equal(decision, "allow", "naming the clean sibling silences it — this is the hole, recorded");
        assert.equal(stderr, "", `the hole is that nothing is said — got: ${JSON.stringify(stderr)}`);
        assert.equal(reason, "", "no refusal text at all");
    });

    test("a cwd that is not a repository degrades to the told tree and SAYS so", () => {
        const { told } = twoTrees({ toldCarriesHandoff: false });
        fs.appendFileSync(path.join(told, "f.txt"), "unrecorded\n");
        const nowhere = path.join(scratch(), "plain-directory");
        fs.mkdirSync(nowhere, { recursive: true });
        const { decision, stderr } = gate(told, "not-a-repo", {}, { cwd: nowhere });
        assert.equal(decision, "block");
        assert.match(stderr, /not inside a git repository/);
    });

    test("a payload with NO cwd behaves exactly as before, and says nothing", () => {
        const { told } = twoTrees({ toldCarriesHandoff: false });
        fs.appendFileSync(path.join(told, "f.txt"), "unrecorded\n");
        const { decision, stderr, reason } = gate(told, "no-cwd", {});
        assert.equal(decision, "block");
        assert.doesNotMatch(stderr, /different repository|not inside a git repository/, "silence, not degradation");
        assert.doesNotMatch(reason, /not the one this hook was told/, "and no divergence clause");
    });
});

// ---------------------------------------------------------------- the chain bound

test("a host that rotates session_id per retry is bounded — the defect this closes", () => {
    // Claude Code 2.1.251 can send a refused stop's retry under a new session id, restarting every per-session count.
    const problems = [{ reason: "handoff", text: "no handoff" }];
    for (let chain = 0; chain <= MAX_CHAIN_BLOCKS; chain += 1) {
        assert.equal(verdict({ problems, chain }).action, "block", `chain ${chain} is within the bound`);
    }
    assert.equal(verdict({ problems, chain: MAX_CHAIN_BLOCKS + 1 }).action, "release", "past the bound it must let go");
});

test("the chain bound is a BACKSTOP — a stable session still meets its specific cap first", () => {
    const problems = [{ reason: "handoff", text: "no handoff" }];
    const both = verdict({ problems, counts: { handoff: MAX_BLOCKS + 1 }, chain: MAX_CHAIN_BLOCKS + 1 });
    assert.equal(both.action, "release");
    assert.match(both.message, /cap of 3 consecutive refusals/, "the per-reason cap names itself when both are spent");
    assert.doesNotMatch(both.message, /hook-provoked/, "the backstop must not claim a release the specific cap earned");

    assert.ok(MAX_CHAIN_BLOCKS > MAX_TOTAL_BLOCKS, "the backstop must sit above the ceiling, or it would pre-empt it");
});

test("the chain release says what it means: the per-session counters could not see their history", () => {
    const problems = [{ reason: "handoff", text: "no handoff" }];
    const m = verdict({ problems, chain: MAX_CHAIN_BLOCKS + 1 }).message;
    assert.match(m, /consecutive hook-provoked stops/);
    assert.match(m, /new session id per retry/, "reaching this bound is a finding about the host and must read as one");
    assert.match(m, /ending \*\*RED\*\*/, "a release is still not a pass");
});

test("the chain is keyed to the tree being JUDGED, not to this module's own repo", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-chainkey-"));
    try {
        assert.deepEqual([1, 2, 3].map(() => bumpChain(true, dir, "/tmp/tree-a")), [1, 2, 3]);
        assert.deepEqual([1, 2].map(() => bumpChain(true, dir, "/tmp/tree-b")), [1, 2], "a second tree starts its own chain");
        assert.equal(bumpChain(true, dir, "/tmp/tree-a"), 4, "and the first tree's chain is untouched by it");
        assert.equal(fs.readdirSync(dir).length, 2, "one file per tree, not one file shared");
        assert.equal(bumpChain(false, dir, "/tmp/tree-a"), 0);
        assert.equal(bumpChain(true, dir, "/tmp/tree-b"), 3, "tree B kept counting while tree A was cleared");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("bumpChain does not advance past a write it could not make", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-chain-ro-"));
    try {
        fs.chmodSync(dir, 0o500);
        assert.deepEqual([bumpChain(true, dir), bumpChain(true, dir), bumpChain(true, dir)], [0, 0, 0],
            "an unwritable counter cannot grow, so the backstop simply does not fire");
    } finally {
        fs.chmodSync(dir, 0o700);
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("bumpChain follows stop_hook_active and is keyed to the tree, not the session", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-chain-"));
    try {
        assert.equal(bumpChain(false, dir), 0, "an unprovoked stop starts no chain");
        assert.equal(bumpChain(true, dir), 1);
        assert.equal(bumpChain(true, dir), 2);
        assert.equal(bumpChain(true, dir), 3, "the count survives without any session id being passed");
        assert.equal(bumpChain(false, dir), 0, "a stop nothing provoked ends the chain");
        assert.equal(bumpChain(true, dir), 1, "and the next chain starts fresh");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
