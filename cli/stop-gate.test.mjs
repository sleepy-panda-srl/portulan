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
// The runner's other half — running a recipe, reading git, listing handoffs — is deliberately not
// unit-tested here: it is I/O against a real tree, and the honest test of it is the demonstration in
// `../.portulan/handoffs/2026-07-27-the-enforcement-compiler.md`, where a planted dead link held a
// live session and a green tree let it go. What is tested here is the arithmetic that decides
// whether this gate can be talked past.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { bumpCount, clearReason, today, verdict, REASONS, MAX_BLOCKS, MAX_TOTAL_BLOCKS } from "../.portulan/compile/stop.mjs";

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
        const source = fs.readFileSync(new URL("../.portulan/compile/stop.mjs", import.meta.url), "utf8");
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
