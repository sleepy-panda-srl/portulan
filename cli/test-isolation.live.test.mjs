// A test that substitutes a shared object hands the restore to the runner, or says why it cannot.
//
// Only `fs` is swept; stream substitutions, some of which end within their test, are left to judgement.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const testFiles = () => fs.readdirSync(CLI).filter((f) => f.endsWith(".test.mjs")).sort();

// Read as text: it finds an assignment, never whether a mock's lifetime is right.
const BY_ASSIGNMENT = /^\s+fs\.[a-zA-Z]+Sync = /;

test("no test patches an fs method by assignment — the runner owns the restore", () => {
    const offenders = [];
    for (const f of testFiles()) {
        fs.readFileSync(path.join(CLI, f), "utf8")
            .split("\n")
            .forEach((line, i) => {
                if (BY_ASSIGNMENT.test(line)) offenders.push(`${f}:${i + 1}  ${line.trim()}`);
            });
    }
    assert.deepEqual(offenders, [], "use `t.mock.method(fs, \"<name>\", impl)`; see this file's header");
});

test("and the pattern is the repository's, not one repair left where it landed", () => {
    const files = testFiles().filter((f) =>
        fs.readFileSync(path.join(CLI, f), "utf8").includes("t.mock.method("),
    );
    assert.ok(files.length >= 5, `expected t.mock.method across at least 5 test files, found ${files.length}: ${files}`);
});

test("the sweep reads something — a matcher that matched nothing would pass vacuously", () => {
    const files = testFiles();
    assert.ok(files.length >= 20, `expected the cli test corpus, found ${files.length} files`);
    assert.equal(BY_ASSIGNMENT.test("        fs.readFileSync = (p) => {"), true, "the matcher must match the shape it bans");
    assert.equal(BY_ASSIGNMENT.test('        t.mock.method(fs, "readFileSync", (p) => {'), false, "and must not match the repair");
});
