// A workflow that checks out MORE THAN ONCE names the ref of every checkout after the first.
//
// ## The defect, twice at one step
//
// `.github/workflows/publish-github-packages.yml` grades the tagged tree with a grader that must NOT
// come from the tagged tree: `cli/release-eval.mjs` exists in no tag before `v0.1.3`, so running it out
// of the tag's own checkout is `MODULE_NOT_FOUND`, exit 1 under `set -euo pipefail`, and a blocked
// publish — on the manual-dispatch path that workflow documents *for exactly those tags*.
//
// The repair was a second `actions/checkout` into `.release-eval-grader`. **It carried no `ref`.**
// `actions/checkout` defaults `ref` to *"the reference or SHA for that event"*, which on
// `release: published` is the tag — so the grader checkout fetched the tagged tree and the crash it
// existed to prevent came straight back, inside its own fix. Raised by Copilot, round 2 on
// [#381](https://github.com/sleepy-panda-srl/portulan/pull/381).
//
// Twice at one step is this repository's own threshold for stopping the patching and building the rail
// (`../.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md`).
//
// ## Why the rule is "after the FIRST" rather than "every checkout"
//
// Measured before it was written, because the obvious rule is wrong. Five of the seven checkouts in
// `.github/workflows/` carry no `ref` and every one of them is **correct**: `verify.yml`,
// `pr-labels.yml`, `copilot-review.yml`, `drills.yml` and `librarian.yml` each check out once and want
// precisely the event's own ref. A rail demanding `ref` everywhere would red five right answers to make
// one wrong answer visible, which is how a recipe gets switched off.
//
// The narrow rule is the true one: **checking out twice is a statement that two different trees are
// wanted**, so the second cannot be left to a default whose value depends on which event fired. It reds
// exactly the defect above and nothing else in this tree.
//
// ## What it does NOT establish
//
// That the ref named is the RIGHT one — `ref: ${{ github.event.release.tag_name }}` on a grader would
// satisfy this and be the same bug wearing an explicit spelling. It establishes that the choice was
// made rather than inherited, which is the half a checker can see. A parser this crude also reads
// indentation rather than YAML structure; it is a rail over a convention, not a schema.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKFLOWS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".github", "workflows");

/**
 * Every `actions/checkout` step in one workflow, with whether its `with:` block names a `ref`.
 *
 * A step ends at the next line that starts a sibling list item at the same indentation, which is the
 * shape every workflow here is written in.
 */
export function checkouts(text) {
    const out = [];
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
        if (!/^\s*(-\s+)?uses:\s*actions\/checkout@/.test(lines[i])) continue;
        const indent = lines[i].search(/\S/);
        let hasRef = false;
        for (let j = i + 1; j < lines.length; j += 1) {
            const cur = lines[j];
            if (cur.trim() === "" || cur.trim().startsWith("#")) continue;
            const curIndent = cur.search(/\S/);
            // A new list item at or above this step's indentation ends the step.
            if (curIndent <= indent && /^\s*-\s/.test(cur)) break;
            if (curIndent < indent) break;
            if (/^\s*ref:\s*\S/.test(cur)) {
                hasRef = true;
                break;
            }
        }
        out.push({ line: i + 1, hasRef });
    }
    return out;
}

test("a workflow that checks out more than once names the ref of every checkout after the first", () => {
    const files = fs.readdirSync(WORKFLOWS).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
    assert.ok(files.length > 0, "there are workflows to read — an empty sweep is not a green");

    const offenders = [];
    let multi = 0;
    for (const f of files) {
        const found = checkouts(fs.readFileSync(path.join(WORKFLOWS, f), "utf8"));
        if (found.length < 2) continue;
        multi += 1;
        for (const c of found.slice(1)) {
            if (!c.hasRef) offenders.push(`${f}:${c.line}`);
        }
    }
    assert.ok(multi > 0, "no workflow checks out twice — this rail would be reporting on nothing");
    assert.deepEqual(
        offenders,
        [],
        "a second checkout with no `ref` inherits the event's own ref — on `release: published` that is the tag, " +
            "which is how the grader checkout fetched the very tree it exists to avoid",
    );
});

test("the rule is narrow on purpose: a SINGLE implicit checkout is correct and stays unflagged", () => {
    // The measurement that decided the rule's shape. If this ever reaches zero, the narrow rule has
    // stopped being narrower than the blanket one and the argument in this file's header is stale.
    const singles = fs
        .readdirSync(WORKFLOWS)
        .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
        .map((f) => checkouts(fs.readFileSync(path.join(WORKFLOWS, f), "utf8")))
        .filter((c) => c.length === 1 && !c[0].hasRef);
    assert.ok(
        singles.length > 0,
        "no single-checkout workflow relies on the default ref — the blanket rule would now cost nothing, " +
            "so re-read this file's header before keeping the narrow one",
    );
});

test("the parser sees a ref that is present and a ref that is absent", () => {
    // The rail's own discrimination, since a parser that never returns `false` would pass everything.
    const withRef = `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@abc # v7\n        with:\n          ref: main\n          path: x\n`;
    const without = `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@abc # v7\n        with:\n          path: x\n`;
    assert.deepEqual(checkouts(withRef), [{ line: 4, hasRef: true }]);
    assert.deepEqual(checkouts(without), [{ line: 4, hasRef: false }]);
    // A ref belonging to the NEXT step must not be read as this one's.
    const nextStep = `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@abc # v7\n        with:\n          path: x\n      - uses: actions/checkout@abc # v7\n        with:\n          ref: main\n`;
    assert.deepEqual(checkouts(nextStep), [
        { line: 4, hasRef: false },
        { line: 7, hasRef: true },
    ]);
});
