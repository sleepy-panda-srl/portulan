// FORCED-RED DRILL — this file exists to fail, and it is deleted in the next push on this branch.
//
// It is not a test of anything in `cli/`. It is a test of the *rail*: milestone 8's amendment asks
// for "scheduled forced-red drills — every rail forced red on a calendar and required to fire", and
// this is one rail, one drill, ahead of that calendar.
//
// What was unproven when this was written, on 2026-07-30: the `tests` recipe had never been observed
// red on a pull request. Every red `workspace-verify` in this repository's history — four of them,
// against 411 green runs — was `docs`. That the recipe is declared in ../.portulan/workspace.json and
// that CI runs every declared recipe (proposal 0004) were both established; that a red *test* reaches
// `mergeStateStatus: BLOCKED` was inference across a seam nobody had walked.
//
// The assertion is deliberately the dullest possible failure. A drill whose red could be argued about
// — a flaky suite, a real defect, an environment difference — measures the argument rather than the
// rail. `1 === 2` is false on every machine and every runner, so what the transcript records is the
// path from a failing assertion to a blocked merge and nothing else.
//
// If you are reading this on `main`, the drill leaked: it should have gone out with the same pull
// request that brought it in. Delete it, and the evidence it produced is in ../.portulan/verify/README.md.

import { test } from "node:test";
import assert from "node:assert/strict";

test("forced-red drill: the tests recipe reports a failing assertion", () => {
    assert.equal(1, 2);
});
