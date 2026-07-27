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

import { bumpCount, today, MAX_BLOCKS } from "../.portulan/compile/stop.mjs";

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
        assert.equal(bumpCount("s1", dir), 1);
        assert.equal(bumpCount("s1", dir), 2);
        assert.equal(bumpCount("s1", dir), 3);
    });

    test("sessions do not share a budget", () => {
        const dir = scratch();
        bumpCount("alpha", dir);
        bumpCount("alpha", dir);
        assert.equal(bumpCount("beta", dir), 1, "one session's refusals must not disarm another's gate");
    });

    test("a session id with path separators cannot escape the counter directory", () => {
        const dir = scratch();
        assert.equal(bumpCount("../../etc/passwd", dir), 1);
        assert.deepEqual(
            fs.readdirSync(dir).filter((f) => f.startsWith("portulan-stopgate-")).length,
            1,
            "the id is sanitised into the filename, not used as a path",
        );
    });

    test("an unwritable counter releases the session rather than trapping it", () => {
        // The direction matters more than the number. An un-capped gate is the one failure here that
        // a human cannot escape from inside the session, so "cannot count" must mean "let it end".
        const value = bumpCount("s", path.join(scratch(), "does", "not", "exist"));
        assert.ok(value > MAX_BLOCKS, `expected a value above the cap of ${MAX_BLOCKS}, got ${value}`);
    });

    test("the cap is reached at MAX_BLOCKS and exceeded on the next refusal", () => {
        const dir = scratch();
        let last = 0;
        for (let i = 0; i < MAX_BLOCKS; i += 1) last = bumpCount("s", dir);
        assert.equal(last, MAX_BLOCKS, "the last blocked stop is the cap itself, not one past it");
        assert.ok(bumpCount("s", dir) > MAX_BLOCKS, "the next refusal releases the session");
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
