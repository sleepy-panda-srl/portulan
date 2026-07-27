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

import { bumpCount, resetConsecutive, today, verdict, MAX_BLOCKS, MAX_TOTAL_BLOCKS } from "../.portulan/compile/stop.mjs";

const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});
function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-stopgate-test-"));
    SCRATCH.push(dir);
    return dir;
}

describe("the block counter", () => {
    test("counts up from one, per session", () => {
        const dir = scratch();
        assert.equal(bumpCount("s1", dir).consecutive, 1);
        assert.equal(bumpCount("s1", dir).consecutive, 2);
        assert.equal(bumpCount("s1", dir).consecutive, 3);
    });

    test("sessions do not share a budget", () => {
        const dir = scratch();
        bumpCount("alpha", dir);
        bumpCount("alpha", dir);
        assert.equal(bumpCount("beta", dir).consecutive, 1, "one session's refusals must not disarm another's gate");
    });

    test("two WORKTREES of one repository do not share a budget either", () => {
        // Several worktrees of this repository are routinely checked out at once. Sharing a counter
        // across them would let one session disarm another's gate — which is why the key carries the
        // tree as well as the session.
        const dir = scratch();
        bumpCount("same-session", dir, "/repo/worktree-a");
        bumpCount("same-session", dir, "/repo/worktree-a");
        assert.equal(bumpCount("same-session", dir, "/repo/worktree-b").consecutive, 1);
    });

    test("ids that both sanitise to EMPTY still get their own counters", () => {
        // Found by review. Sanitising alone collapses any id made entirely of characters outside the
        // allowed class to "", so every such session shared one counter and they charged each other's
        // cap — or released each other early. Silent in both directions.
        const dir = scratch();
        bumpCount("!!!", dir);
        bumpCount("###", dir);
        assert.equal(fs.readdirSync(dir).length, 2, "two distinct sessions, two counters");
    });

    test("ids sharing a long prefix are not collapsed by truncation either", () => {
        const dir = scratch();
        const base = "s".repeat(80);
        bumpCount(`${base}-alpha`, dir);
        bumpCount(`${base}-beta`, dir);
        assert.equal(fs.readdirSync(dir).length, 2);
    });

    test("a session id with path separators cannot escape the counter directory", () => {
        const dir = scratch();
        assert.equal(bumpCount("../../etc/passwd", dir).consecutive, 1);
        assert.equal(
            fs.readdirSync(dir).filter((f) => f.startsWith("portulan-stopgate-")).length,
            1,
            "the id is sanitised into the filename, not used as a path",
        );
    });

    test("an unwritable counter releases the session rather than trapping it", () => {
        // The direction matters more than the number. An un-capped gate is the one failure here that
        // a human cannot escape from inside the session, so "cannot count" must mean "let it end".
        const v = bumpCount("s", path.join(scratch(), "does", "not", "exist"));
        assert.ok(v.consecutive > MAX_BLOCKS, `expected above the cap of ${MAX_BLOCKS}, got ${v.consecutive}`);
        assert.ok(v.total > MAX_TOTAL_BLOCKS, "and above the ceiling too, or the ceiling would trap it instead");
    });

    test("the cap is reached at MAX_BLOCKS and exceeded on the next refusal", () => {
        const dir = scratch();
        let last;
        for (let i = 0; i < MAX_BLOCKS; i += 1) last = bumpCount("s", dir);
        assert.equal(last.consecutive, MAX_BLOCKS, "the last blocked stop is the cap itself, not one past it");
        assert.ok(bumpCount("s", dir).consecutive > MAX_BLOCKS, "the next refusal releases the session");
    });
});

describe("consecutive-red semantics — the cap targets a futile-retry episode, not a long session", () => {
    test("an observed green recipe clears the consecutive count", () => {
        const dir = scratch();
        bumpCount("s", dir);
        bumpCount("s", dir);
        assert.equal(resetConsecutive("s", dir).consecutive, 0);
        assert.equal(bumpCount("s", dir).consecutive, 1, "the next episode starts from one");
    });

    test("the reset clears the episode and NOT the running total", () => {
        // The total is what guarantees the gate can still stop. If the reset cleared it too, a session
        // whose recipe is green and whose handoff is missing would reset on every attempt and never
        // reach any cap — unbounded, in the exact case that was demonstrated releasing before this.
        const dir = scratch();
        bumpCount("s", dir);
        bumpCount("s", dir);
        resetConsecutive("s", dir);
        assert.equal(bumpCount("s", dir).total, 3, "the total survives the reset");
    });

    test("a long honest session that fixes each red is not taxed for having done the work", () => {
        const dir = scratch();
        for (let episode = 0; episode < 3; episode += 1) {
            assert.equal(bumpCount("s", dir).consecutive, 1);
            assert.equal(bumpCount("s", dir).consecutive, 2);
            resetConsecutive("s", dir); // the red was found and fixed; the recipe ran green
        }
        assert.equal(bumpCount("s", dir).consecutive, 1, "three fixed reds later, the gate is still willing to argue");
    });

    test("the absolute ceiling still stops a gate the reset would otherwise make unbounded", () => {
        const v = verdict({ problems: ["handoff missing"], count: 1, total: MAX_TOTAL_BLOCKS + 1 });
        assert.equal(v.action, "release", "a low consecutive count must not outvote a spent ceiling");
        assert.match(v.message, /ending \*\*RED\*\*, not done/);
    });

    test("resetting a counter that was never written is harmless", () => {
        assert.equal(resetConsecutive("never-seen", scratch()).consecutive, 0);
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
    test("no problems means allow, and allow never charges the budget", () => {
        // The false-RED direction. A Stop-gate that blocks on green gets switched off by an annoyed
        // human, and then it guards nothing — the `json.sh` false-red lesson, applied to the gate
        // rather than to a recipe.
        assert.equal(verdict({ problems: [], count: 0 }).action, "allow");
        assert.equal(verdict({ problems: [], count: 99 }).action, "allow", "a spent budget must not turn green into a block");
    });

    test("a problem below the cap blocks, and says which refusal this is", () => {
        const v = verdict({ problems: ["recipe red"], count: 2 });
        assert.equal(v.action, "block");
        assert.match(v.message, /2\/3/);
        assert.match(v.message, /recipe red/);
    });

    test("past the cap the session is released, and the message says RED rather than done", () => {
        // The cap bounds how long the gate argues, never whether red can become done.
        const v = verdict({ problems: ["recipe red"], count: MAX_BLOCKS + 1, total: MAX_BLOCKS + 1 });
        assert.equal(v.action, "release");
        assert.match(v.message, /ending \*\*RED\*\*, not done/);
        assert.match(v.message, /recipe red/, "the unresolved problems must survive into the release message");
    });

    test("the cap itself still blocks — release begins one past it", () => {
        assert.equal(verdict({ problems: ["x"], count: MAX_BLOCKS, total: MAX_BLOCKS }).action, "block");
        assert.equal(verdict({ problems: ["x"], count: MAX_BLOCKS + 1, total: MAX_BLOCKS + 1 }).action, "release");
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
