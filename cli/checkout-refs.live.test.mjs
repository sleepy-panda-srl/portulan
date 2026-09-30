// A workflow that checks out MORE THAN ONCE names the ref of every checkout after the first.
//
// Only after the first: a lone checkout rightly takes the event's ref, while a second one wants another tree.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKFLOWS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".github", "workflows");

// Reads indentation, not YAML, and sees that a `ref` is named, never whether it is the right one.
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
    const withRef = `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@abc # v7\n        with:\n          ref: main\n          path: x\n`;
    const without = `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@abc # v7\n        with:\n          path: x\n`;
    assert.deepEqual(checkouts(withRef), [{ line: 4, hasRef: true }]);
    assert.deepEqual(checkouts(without), [{ line: 4, hasRef: false }]);
    const nextStep = `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@abc # v7\n        with:\n          path: x\n      - uses: actions/checkout@abc # v7\n        with:\n          ref: main\n`;
    assert.deepEqual(checkouts(nextStep), [
        { line: 4, hasRef: false },
        { line: 7, hasRef: true },
    ]);
});
