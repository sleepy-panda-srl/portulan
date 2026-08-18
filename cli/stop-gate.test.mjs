// Tests for the Stop-gate runner's cap and date handling.
//
// These exist because a pre-commit supervisor found two defects in `../.portulan/compile/stop.mjs`
// that no test could have caught, because nothing tested it at all. Both were fail-opens in the
// scaffolding around a check rather than in the check — the eighth and ninth of that shape here
// (`../.portulan/tasks/0004-a-harness-for-the-verify-recipes.md`).
//
//   1. The cap counted every Stop event rather than every refusal, so an ordinary session spent its
//      budget on green turns and a genuine red then passed with a note.
//   2. The unwritable-counter fallback returned exactly the cap, which is not ABOVE it — so a red
//      tree blocked forever, the precise opposite of the comment beside it.
//
// What is tested here is the arithmetic that decides whether this gate can be talked past — and,
// since #220, the DID-WORK signals, which are I/O against a real tree and are pinned at the bottom of
// this file by spawning the real binary against real git fixtures. That half used to say it was
// deliberately untested, resting on the demonstration in
// `../.portulan/handoffs/2026-07-27-the-enforcement-compiler.md` where a planted dead link held a
// live session. The demonstration was real and is still cited; what it could not do was notice that
// one of those signals had been answering a rebase-merging repository wrongly since it was written.
// Reading git is no longer untested here. Running a recipe and listing handoffs are exercised only as
// PRECONDITIONS of the cases below — a green recipe so `handoff` is the only live reason, a dated file
// so one case clears — and neither has a directed case: a recipe that reds or cannot run through the
// spawned binary, and the handoff-listing edge shapes, are still nobody's.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { bumpCount, clearReason, today, verdict, REASONS, MAX_BLOCKS, MAX_TOTAL_BLOCKS } from "./stop-gate.mjs";

// A HERMETIC HOST. The tools consult the host's installed-plugin record on the UNASKED path as of
// 2026-08-13, so a suite that does not neutralise it reads the machine it runs on and a fixture's
// verdict moves with what somebody has installed. Swept by `pinned-roots.live.test.mjs`, whose header
// carries the argument and the limit. A case that wants a host passes `env:` explicitly, which wins.
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
    // The gate refuses for two independent reasons: a default recipe not observed green, and a
    // missing dated handoff. One shared counter gave them one shared budget, and the maintainer's
    // ruling of 2026-07-27 named the asymmetry that produced: a missing five-line handoff rode to
    // the ceiling of nine while a failing suite got three. Each reason now has its own.

    test("counts up from one, per session, per reason", () => {
        const dir = scratch();
        assert.equal(bumpCount("s1", ["recipe"], dir).counts.recipe, 1);
        assert.equal(bumpCount("s1", ["recipe"], dir).counts.recipe, 2);
        assert.equal(bumpCount("s1", ["recipe"], dir).counts.recipe, 3);
        assert.equal(bumpCount("s1", ["recipe"], dir).counts.handoff, 0, "the other reason was never raised");
    });

    test("two reasons in ONE session share a session and a tree and still not a count", () => {
        // The trap task 0007 names. The key already carried session and tree; adding a reason
        // dimension must not collapse either, and must not let the two reasons collapse into each
        // other — the original defect lived exactly in the interaction.
        const dir = scratch();
        bumpCount("s", ["recipe"], dir);
        bumpCount("s", ["recipe"], dir);
        const v = bumpCount("s", ["handoff"], dir);
        assert.equal(v.counts.recipe, 2, "the recipe count is untouched by a handoff refusal");
        assert.equal(v.counts.handoff, 1);
        assert.equal(v.total, 3, "but every refusal charges the shared ceiling");
    });

    test("one stop refused for BOTH reasons charges each reason once and the ceiling once", () => {
        // A stop is refused once however many reasons it names, so the ceiling — which exists to
        // guarantee the gate can always stop — must count refusals rather than reasons. Charging it
        // twice would make a two-reason session reach the ceiling in half the attempts.
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
        // Several worktrees of this repository are routinely checked out at once. Sharing a counter
        // across them would let one session disarm another's gate — which is why the key carries the
        // tree as well as the session.
        const dir = scratch();
        bumpCount("same-session", ["recipe"], dir, "/repo/worktree-a");
        bumpCount("same-session", ["recipe"], dir, "/repo/worktree-a");
        assert.equal(bumpCount("same-session", ["recipe"], dir, "/repo/worktree-b").counts.recipe, 1);
    });

    test("ids that both sanitise to EMPTY still get their own counters", () => {
        // Found by review. Sanitising alone collapses any id made entirely of characters outside the
        // allowed class to "", so every such session shared one counter and they charged each other's
        // cap — or released each other early. Silent in both directions. Re-asserted after the reason
        // dimension arrived, because a key change is exactly when this collapses again.
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
        // The direction matters more than the number. An un-capped gate is the one failure here that
        // a human cannot escape from inside the session, so "cannot count" must mean "let it end" —
        // for EVERY reason, or a session refused for the one reason left under its cap still hangs.
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
    // Found by a Copilot review, in the *suppressed* half — the low-confidence section of the review
    // body, which carries no Resolve control and blocks nothing, so it is only read by someone who
    // goes looking. It was right, and it is the same defect `REASONS` was introduced to prevent,
    // one layer down: the constant exists so the counter, the clearing rule and the message agree
    // about what a reason is, and `readCount` filtered by it while `bumpCount` accepted anything.

    test("a stored reason outside REASONS is preserved, counted, and still capped", () => {
        // The failure it produces is silent and weakening: the count resets to 0 on every read, so
        // that reason can never reach its own cap and the gate keeps arguing until the ceiling of
        // nine. A gate that is quietly three times more patient about one reason is the exact
        // asymmetry task 0007 existed to remove, reintroduced through a drifted list.
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
        // And the known reasons are still defaulted, so nothing else changes shape.
        for (const reason of REASONS) assert.equal(past.counts[reason], 0);
    });

    test("every reason the runner can emit is declared in REASONS", () => {
        // The runtime now degrades safely, which is not the same as the lists agreeing. This binds
        // them at test time so a new refusal reason added to `collectProblems` without being added to
        // `REASONS` is RED in CI rather than a gate quietly becoming more patient about it. A source
        // check rather than a behavioural one, deliberately: `collectProblems` needs a real tree and
        // a real recipe run, and the thing worth binding is the declaration, not the run.
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
        // This is the whole of task 0007. Before it, the single counter reset on the recipe while the
        // gate refused for two reasons, so a green recipe beside a missing handoff reset the count on
        // every attempt and the cap was never reached — a hang the ceiling of nine had to paper over.
        const dir = scratch();
        bumpCount("s", ["handoff"], dir);
        bumpCount("s", ["handoff"], dir);
        const after = clearReason("s", "recipe", dir);
        assert.equal(after.counts.handoff, 2, "the handoff has not been dealt with, so its patience is not restored");
    });

    test("the handoff caps at THREE with the recipe green throughout — no longer riding to nine", () => {
        // The green recipe is part of the criterion rather than scenery: with a red fixture the
        // release could come from the recipe cap while a handoff counter still rode to the ceiling,
        // and this test would pass without exercising the ruling at all.
        const dir = scratch();
        let counts;
        for (let i = 0; i < MAX_BLOCKS; i += 1) {
            clearReason("s", "recipe", dir); // the recipe is observed green on every attempt
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
        // The total is what guarantees the gate can still stop whatever the per-reason counts do.
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
            clearReason("s", "recipe", dir); // the red was found and fixed; the recipe ran green
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
        // 2026-07-27 at 01:00 local. In any timezone east of UTC — the maintainer's is one such —
        // `toISOString()` would say the 26th, and the gate would demand yesterday's handoff from a
        // session that had just written today's. A false red is what gets a rail switched off.
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
        // The false-RED direction. A Stop-gate that blocks on green gets switched off by an annoyed
        // human, and then it guards nothing — the `json.sh` false-red lesson, applied to the gate
        // rather than to a recipe.
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
        // The cap bounds how long the gate argues, never whether red can become done.
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
        // Session 0 shipped this misreporting once and fixed it: saying "cap of 3" after nine
        // refusals sends a reader to the wrong constant. Per-reason counters give it one more way to
        // be wrong — naming the cap without naming the reason — so both halves are pinned.
        const byCap = verdict({ problems: red(), counts: { recipe: MAX_BLOCKS + 1 }, total: MAX_BLOCKS + 1 });
        assert.match(byCap.message, /`recipe`/, "name the reason whose patience ran out");
        assert.match(byCap.message, new RegExp(`${MAX_BLOCKS}`));
        assert.doesNotMatch(byCap.message, /ceiling/, "the ceiling did not release this one");

        const byCeiling = verdict({ problems: red(), counts: { recipe: 1 }, total: MAX_TOTAL_BLOCKS + 1 });
        assert.match(byCeiling.message, /ceiling/);
        assert.match(byCeiling.message, new RegExp(`${MAX_TOTAL_BLOCKS}`));
    });

    // ---- the two-reason interaction, tested directly ------------------------------------------
    //
    // Task 0007: "a per-reason design that is only tested one reason at a time has not been tested
    // at all — the original defect lived exactly in the interaction."

    test("one reason over its cap releases the stop even while the other is still under", () => {
        // A stop cannot be half-released. Once the gate has argued four times about anything, it has
        // argued four times — and the session ends RED naming both problems, so nothing is laundered
        // by the reason that had not yet been argued to exhaustion.
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
        // A reason that cleared has its counter zeroed, so a stale over-cap count cannot release a
        // session for a problem that no longer exists. Asserted rather than assumed, because the
        // alternative reading — remembering that the recipe was once red four times — would release
        // every later stop for free.
        const v = verdict({
            problems: [{ reason: "handoff", text: "no handoff" }],
            counts: { recipe: 0, handoff: 1 },
            total: 5,
        });
        assert.equal(v.action, "block");
    });
});

describe("a recipe that cannot run is not a verdict about the repository", () => {
    // Found by review: the Stop-gate ran the recipe through `bash -c` and read every non-zero status
    // except 2 as RED. A missing script exits 127 and was therefore reported as a red verdict about a
    // tree nothing had looked at — the exact laundering the recipes' three-code contract exists to
    // prevent, reaching the gate that contract is for.
    //
    // Asserted against real shell behaviour rather than against a copy of the constant, because the
    // premise ("a missing command exits 127") is a fact about the shell and is the part worth pinning.
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

// ---------------------------------------------------------------------------------------------
// The DID-WORK signals, driven as the host drives them — real git, real binary, real fixtures.
//
// **Every case here spawns `node cli/stop-gate.mjs`** with a payload on stdin and
// `CLAUDE_PROJECT_DIR` pointed at a fixture repository, rather than importing `didWork` and handing
// it a stubbed runner. The shape is `./gate.test.mjs`'s and the reason is the same one, sharpened by
// what is under test here: **the defect is that real git, in a repository that rebase-merges,
// behaves otherwise than the signal assumed.** A stubbed runner is a copy of that assumption, so it
// would pass on every day the gate was wrong. The arm withheld from `#208` was rejected for the
// neighbouring reason — a test-only export adds a surface whose only caller is the entry block — and
// shipped by injecting the fault from outside instead.
//
// `#220`: a rebase-merge rewrites commits, so a merged branch's originals are on no remote; once the
// remote branch is deleted they never will be. `HEAD --not --remotes` therefore reports did-work
// **permanently** for any checkout left on such a branch, and the gate demands a handoff from a
// session that did nothing.

const RUNNER = fileURLToPath(new URL("./stop-gate.mjs", import.meta.url));

/** Git with a fixed identity, so the suite does not read the machine's. */
function git(cwd, args) {
    return execFileSync(
        "git",
        ["-c", "user.name=portulan-test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args],
        { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
}

/**
 * Drive the gate as the host does: one process, payload on stdin, decision on stdout.
 *
 * `spawnSync` rather than `execFileSync` because **this runner always exits 0** — it reports a
 * refusal in its stdout JSON, not in its status — so the stderr this suite asserts on would be
 * unreachable through the throw path `./gate.test.mjs` reads it from.
 */
function gate(project, sessionId, env = {}) {
    const run = spawnSync("node", [RUNNER], {
        input: JSON.stringify({ session_id: sessionId }),
        env: { ...process.env, CLAUDE_PROJECT_DIR: project, ...env },
        encoding: "utf8",
    });
    // **A crash must never read as an allow.** This runner reports a refusal in stdout and exits 0
    // either way, so "no JSON" means allow — but it ALSO means "node could not start" and "the runner
    // threw". Without this assertion the one case that expects `allow` would pass on a broken runner,
    // which is a fail-open in the harness that tests a gate for fail-opens. Copilot, round 1.
    assert.equal(run.error, undefined, `the runner could not be spawned: ${run.error?.message}`);
    assert.equal(run.status, 0, `the runner exited ${run.status} — stderr: ${run.stderr}`);
    const out = run.stdout.trim() ? JSON.parse(run.stdout) : null;
    return { decision: out?.decision ?? "allow", reason: out?.reason ?? "", stderr: run.stderr ?? "" };
}

const MANIFEST = JSON.stringify({
    spec: "2.1",
    name: "fixture",
    // A green recipe, so `handoff` is the only reason that can be live and every assertion below is
    // about the did-work question rather than about a red tree.
    verify: { default: "always-green", recipes: [{ id: "always-green", run: "true" }] },
});

/**
 * A repository whose branch was REBASE-MERGED and whose remote branch was then deleted — #220's
 * shape, built by cloning a scratch origin so `origin/HEAD` exists as it did in the incident.
 */
function rebaseMerged({ genuinelyUnmerged = false } = {}) {
    const root = scratch();
    const origin = path.join(root, "origin.git");
    const work = path.join(root, "work");
    const hub = path.join(root, "hub");
    execFileSync("git", ["init", "-q", "--bare", origin]);
    // **The bare repository's HEAD is set EXPLICITLY, not inherited.** `git init --bare` points HEAD at
    // whatever `init.defaultBranch` says, which is the HOST's setting: `main` on this machine, `master`
    // on a stock CI runner. The fixture then pushes `main` and `git remote set-head origin -a` fails
    // with *"Cannot determine remote HEAD"* wherever the two disagree — so `origin/HEAD` never exists,
    // and the very base this suite's subject resolves is missing. Measured: the first version of this
    // fixture passed on this machine and took the whole did-work block red on CI, which is `./gate.mjs`'s
    // `#131` — paths resolved against the author's layout — in another spelling.
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
    // The platform rebase-merges: the same patches land on main under NEW shas, then the branch goes.
    execFileSync("git", ["clone", "-q", origin, hub], { stdio: ["ignore", "pipe", "pipe"] });
    git(hub, ["checkout", "-q", "main"]);
    // A FIXED, DIFFERENT committer date, because that is what makes this a rebase-merge rather than a
    // no-op. Cherry-picking the same patch onto the same parent with the same identity inside the same
    // second reproduces the ORIGINAL sha exactly — measured: the first draft of this fixture did that,
    // and its own premise assertion caught it, since a fixture with no orphan tests nothing.
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
        // The premise, measured against real git rather than asserted: reachability finds the orphaned
        // commit this fixture makes, patch-id finds nothing unmerged. Asserted as non-empty rather than
        // as a count, so the fixture may grow a commit without this going red for the wrong reason. If
        // this premise ever stops holding the case below is testing nothing.
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

    test("a handoff dated today clears it, orphans or no orphans", () => {
        const repo = rebaseMerged({ genuinelyUnmerged: true });
        fs.writeFileSync(path.join(repo, ".portulan", "handoffs", `${today()}-a-session-that-did-its-job.md`), "five lines is enough\n");
        assert.equal(gate(repo, "handoff-present").decision, "allow");
    });

    test("with several remotes, the base is `origin` — not whichever git lists first", () => {
        // `git remote` lists alphabetically, so a `backup` remote sorts ahead of `origin`. Comparing
        // patch-ids against a non-canonical remote is a wrong VERDICT, not a clumsy message: here
        // `backup` carries none of the work, so a gate that chose it would see the branch as entirely
        // unmerged and demand a handoff from a session that owes none.
        const repo = rebaseMerged();
        const root = path.dirname(repo);
        execFileSync("git", ["init", "-q", "--bare", path.join(root, "backup.git")]);
        execFileSync("git", ["--git-dir", path.join(root, "backup.git"), "symbolic-ref", "HEAD", "refs/heads/main"]);
        git(repo, ["remote", "add", "backup", path.join(root, "backup.git")]);
        // `backup` gets only the base commit, so it shares no patch with the rebase-merged work.
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
        // A remote is configured and has never been fetched, so `origin/HEAD` does not resolve — the
        // innocent shape `git init` + `git remote add` produces. Reading that as "no work" would turn a
        // case that blocks today into a pass, which is the direction this gate's own message says to
        // scrutinise hardest. It blocks, and the sentence names what it could not refine.
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

    test("the history lookup survives a host that reads `*` literally", () => {
        // `GIT_NOGLOB_PATHSPECS` makes a bare `*` literal, which would match nothing and return null —
        // silently reinstating the gap this arm closes, on a host that looks fine. Measured on git
        // 2.50.1: the bare pattern matches 1 normally and 0 under this variable. The pathspec carries
        // `:(glob)` magic so the answer does not depend on the host's pathspec defaults.
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
        // Not an exotic case here: this repository routinely has several detached worktrees checked out
        // at once, and `git rev-parse --abbrev-ref HEAD` answers the literal string `HEAD` in every one
        // of them. Naming a branch that does not exist, in the sentence added so a reader could identify
        // the tree, would be the same defect this half of #220 is about.
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
        // The 2026-08-10 incident's shape: the handoff was written, committed and merged; the tree the
        // gate happened to read did not carry it. The gate still blocks — it cannot know this session
        // wrote that file — but "no handoff dated X" alone sent a reader to write a duplicate, which
        // `docs.sh`'s record check would then have refused. The sentence is the repair.
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
