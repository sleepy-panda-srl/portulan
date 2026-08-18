// A test that substitutes a shared object hands the restore to the runner, or says why it cannot.
//
// **Why this file exists.** #254 found six tests patching an `fs` method by assignment and restoring
// it in `finally`. None was broken — node runs a file's tests sequentially, the `finally` blocks do
// restore, and they restore on throw. What they did not do is *state* the dependency: `t.mock.method`
// removes it instead of resting on it. The rule had already been decided once by review, on
// `init.test.mjs`, and **never swept** — which is the defect proposal `0020` exists for, and a grep in
// an issue body is not a rail.
//
// **The instrument matters, and the issue's was too narrow.** It swept for the NAME —
// `fs.<something>Sync = ` — and so could not see the same shape wearing a different one. Sweeping for
// the SHAPE, *assignment to a property of a shared object inside a test file*, found eight more:
// `process.stdout.write` and `process.stderr.write` across `compile.test.mjs` and `doctor.test.mjs`.
// Fourteen sites, one class.
//
// **Three of the fourteen are NOT converted, and that is a finding rather than an omission.**
// `t.mock.method` scopes a mock to the TEST. Where the code means a narrower lifetime the runner
// cannot express it, and converting would change behaviour while looking like tidying:
//
//   - a substitution inside a helper called twice, which must return only its own call's output;
//   - one inside a per-iteration loop, one mock per flag on a help screen;
//   - one sharing its `finally` with a `process.env` restore — and **`t.mock.property` cannot take
//     that half at all.** Measured on Node 26.7.0: it exists, and on `process.env` it throws
//     `ERR_INVALID_OBJECT_DEFINE_PROPERTY: 'process.env' does not accept an accessor(getter/setter)
//     descriptor`, because it installs the mock as a getter/setter pair. An earlier note in this
//     session's own planning claimed that API made the env sites convertible; running it said
//     otherwise, and this comment is the corrected version.
//
// So this rail binds the part that IS uniform — the `fs` half, whose retire-when the issue states
// exactly — and leaves the stream sites to judgement, since three of them legitimately differ.
//
// **Its limit, stated:** it reads test files as text. It knows an assignment is absent, not that the
// mock a test does use has the right lifetime.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const testFiles = () => fs.readdirSync(CLI).filter((f) => f.endsWith(".test.mjs")).sort();

/** The issue's own retire-when, kept as the rail's matcher so the two cannot drift apart. */
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
    // The count is the point. Before #254 `t.mock.method` appeared twice, both in one file, from the
    // single review that decided the rule — a corpus that establishes it as the REPAIRED pattern and
    // not the house one. A floor rather than an exact number, so adding a test does not red this.
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
