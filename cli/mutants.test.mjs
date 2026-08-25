// The mutation-census rail's suite.
//
// Two of these cases exist because the naive design is wrong in ways only measurement shows: ESM
// caches by URL with no invalidation, so a harness reusing one temp path grades mutant 1 forever
// while reporting on all of them; and a substitution that produces an unimportable module checks
// nothing about the corpus, so counting it as a kill would be the loudest possible false green in a
// tool whose entire output is a coverage claim.
//
// The rest hold the refusals: an anchor that does not place, an anchor that places twice, a
// substitution that changes nothing, and a corpus that is already red. Every one is exercised
// POSITIVELY, because a failure path nobody has run is one nobody has seen work.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// A HERMETIC HOST, the three-line block `pinned-roots.live.test.mjs` sweeps for — asserted WHOLE, so
// that copying the two lines which neutralise the host and dropping the one that tidies up is caught.
// This suite reaches `compile.mjs`, which consults the host's installed-plugin record on the unasked
// path, so without it a verdict would move with what somebody has installed.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import { OPERATORS, OUTCOMES, REGION, SUBJECT, absolutiseImports, census, mutate, run, runCorpus } from "./mutants.mjs";
import { CouldNotRun } from "./goldens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const SOURCE = fs.readFileSync(join(REPO, SUBJECT), "utf8");

const sink = () => {
    const lines = [];
    return { write: (s) => lines.push(s), text: () => lines.join("") };
};

test("every operator's anchor places exactly once in the subject", () => {
    for (const op of OPERATORS) {
        // `mutate` is the thing under test AND the rail; calling it is the assertion, because it
        // throws on zero matches and on two.
        assert.doesNotThrow(() => mutate(SOURCE, op), `operator ${op.id}`);
    }
});

test("every operator changes the source, records a known outcome, and carries a reason", () => {
    for (const op of OPERATORS) {
        assert.notEqual(mutate(SOURCE, op), SOURCE, `operator ${op.id} placed but changed nothing`);
        assert.ok(OUTCOMES.includes(op.outcome), `operator ${op.id} records ${op.outcome}`);
        assert.ok(op.why.trim().length > 20, `operator ${op.id} carries no readable reason`);
        assert.ok(REGION.includes(op.member), `operator ${op.id} names ${op.member}, which REGION does not list`);
    }
});

test("operator ids are unique", () => {
    const ids = OPERATORS.map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length);
});

test("every matcher-region member carries at least one operator", () => {
    // The coverage floor, asserted here as well as railed in the runner: `REGION` is what makes
    // "mutation testing over both matchers" mean the whole region rather than one function.
    assert.deepEqual(census().uncovered, []);
});

test("an anchor that does not place is could-not-run, never a skip", () => {
    assert.throws(
        () => mutate(SOURCE, { id: "phantom", member: "matchesRule", find: "this text is not in compile.mjs", replace: "x" }),
        (e) => e instanceof CouldNotRun && /does not place/.test(e.message),
    );
});

test("an anchor that places twice is could-not-run", () => {
    assert.throws(
        () => mutate(SOURCE, { id: "ambiguous", member: "matchesRule", find: "return false;", replace: "return true;" }),
        (e) => e instanceof CouldNotRun && /must be exactly one edit/.test(e.message),
    );
});

test("relative imports are rewritten to absolute file URLs, and node builtins are left alone", () => {
    const out = absolutiseImports(SOURCE, join(REPO, "cli"));
    assert.ok(!/from "\.\//.test(out), "a relative import survived the rewrite");
    assert.ok(out.includes('from "node:fs"'), "a builtin import was rewritten and should not have been");
    assert.ok(out.includes(pathToFileURL(join(REPO, "cli", "discover.mjs")).href));
});

test("two different mutants imported in one process answer differently", async () => {
    // **The ESM-cache canary.** `import()` caches by resolved URL and offers no invalidation, so a
    // harness writing every mutant to one reused path would import the first and then grade it once
    // per operator — silently, and including while the record is first being written, where the
    // two-directional rail cannot see it because the record would be built from the same wrong
    // readings. This is the only case in the suite that would still pass if the runner were correct
    // and fail if it were not, so it is worth its weight.
    const rule = { id: "r", tier: "gated", action: { shell: "git push --force" }, reason: "x" };
    const input = { command: "bash -c \"ls; git push --force origin main\"" };
    const load = async (op) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-mutant-test-"));
        const file = path.join(dir, "compile.mjs");
        fs.writeFileSync(file, absolutiseImports(mutate(SOURCE, op), join(REPO, "cli")), "utf8");
        const mod = await import(pathToFileURL(file).href);
        return { mod, dir };
    };
    const a = await load(OPERATORS.find((o) => o.id === "matchesRule-shell-stops-segmenting-a-spelling"));
    const b = await load(OPERATORS.find((o) => o.id === "matchesRule-inserts-a-no-op"));
    try {
        assert.equal(a.mod.matchesRule(rule, "Bash", input), false, "the reverting mutant should not catch it");
        assert.equal(b.mod.matchesRule(rule, "Bash", input), true, "the no-op mutant must behave like the original");
    } finally {
        fs.rmSync(a.dir, { recursive: true, force: true });
        fs.rmSync(b.dir, { recursive: true, force: true });
    }
});

test("runCorpus reports the first disagreement, and a throw counts as one", () => {
    const rules = new Map([["r", { id: "r", tier: "gated", action: { shell: "git push --force" }, reason: "x" }]]);
    const corpus = [{ where: "f.json", doc: { rule: "r", cases: [{ id: "c", tool: "Bash", input: { command: "git push --force x" }, expect: true }] } }];
    assert.equal(runCorpus(() => true, rules, corpus).agreed, true);
    const wrong = runCorpus(() => false, rules, corpus);
    assert.equal(wrong.agreed, false);
    assert.match(wrong.how, /answered false/);
    const threw = runCorpus(() => {
        throw new TypeError("x");
    }, rules, corpus);
    assert.equal(threw.agreed, false);
    assert.match(threw.how, /threw TypeError/);
});

test("a fixture the census cannot grade is refused, never skipped", async () => {
    // **The silent-thinning defect, asserted in both places it could return.** `runCorpus` skipped an
    // unknown rule outright, so a renamed or misfiled fixture sat ungraded while the census reported
    // green on a kill-set smaller than the one it names. Reported as a suppressed note by Copilot,
    // round 5 on #338.
    const rules = new Map([["known", { id: "known", tier: "gated", action: { shell: "git push --force" }, reason: "x" }]]);
    const corpus = [{ where: "stale.json", doc: { rule: "renamed-away", cases: [{ id: "c", tool: "Bash", input: { command: "x" }, expect: false }] } }];
    assert.throws(
        () => runCorpus(() => false, rules, corpus),
        (e) => e instanceof CouldNotRun && /does not declare/.test(e.message),
        "runCorpus skipped a rule it could not find",
    );

    // And end to end: a corpus file naming an unknown rule refuses the whole run at 2, before any
    // mutant is written, with the file named.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-stalefixture-"));
    try {
        fs.cpSync(REPO, path.join(dir, "repo"), {
            recursive: true,
            filter: (src) => !src.includes(`${path.sep}.git${path.sep}`) && !src.endsWith(`${path.sep}.git`) && !src.includes("node_modules"),
        });
        const root = path.join(dir, "repo");
        fs.writeFileSync(
            path.join(root, "evals", "goldens", "gates", "renamed-away.json"),
            JSON.stringify({
                rule: "renamed-away",
                why: "a fixture that outlived its gate",
                cases: [{ id: "c", class: "holds", tool: "Bash", path: "shell-prefix", input: { command: "git push --force x" }, expect: true, why: "a reason a reviewer can read" }],
            }),
            "utf8",
        );
        const err = sink();
        const code = await run(["--workspace", root, "--pack-root", path.join(root, "packs"), "--check"], { stdout: sink(), stderr: err, cwd: root });
        assert.equal(code, 2, "an ungradable fixture did not refuse the census");
        assert.match(err.text(), /renamed-away/);
        assert.match(err.text(), /kill-set is smaller than it looks/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("the census runs green against this repository, and prints every region member", async () => {
    const out = sink();
    const err = sink();
    const code = await run(["--workspace", REPO, "--pack-root", join(REPO, "packs"), "--check"], { stdout: out, stderr: err, cwd: REPO });
    assert.equal(code, 0, err.text());
    for (const member of REGION) assert.match(out.text(), new RegExp(`\\s${member}\\n`), `${member} is missing from the census`);
});

test("--only narrows to one operator, and an unknown id is could-not-run", async () => {
    const out = sink();
    const err = sink();
    assert.equal(await run(["--workspace", REPO, "--pack-root", join(REPO, "packs"), "--only", "matchesPath-tail-becomes-substring"], { stdout: out, stderr: err, cwd: REPO }), 0, err.text());
    assert.match(out.text(), /^mutants: 1 operator\(s\)/m);
    const err2 = sink();
    assert.equal(await run(["--workspace", REPO, "--pack-root", join(REPO, "packs"), "--only", "no-such-operator"], { stdout: sink(), stderr: err2, cwd: REPO }), 2);
    assert.match(err2.text(), /no operator with id/);
});

test("--only still validates the WHOLE operator table", async () => {
    // `--only` narrows what runs; it does not narrow what must be well formed. This validation was
    // skipped entirely in `--only` mode, so a malformed operator slipped through in exactly the mode
    // a person reaches for when something is already wrong. Reported by Copilot, round 1 on #338.
    //
    // Exercised by mutating the table in a copy of the module rather than by reading the source, so
    // the test measures the behaviour rather than the spelling of the guard.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-onlyvalid-"));
    try {
        const copy = path.join(dir, "mutants.mjs");
        const src = fs
            .readFileSync(join(REPO, "cli", "mutants.mjs"), "utf8")
            .replace(/from "\.\/([A-Za-z0-9._-]+\.mjs)"/g, (_, name) => `from "${pathToFileURL(join(REPO, "cli", name)).href}"`)
            // One operator's `outcome` made invalid — the shape the guard exists to refuse. Chosen
            // over emptying a `why` because the first attempt at that left the REST of the sentence
            // behind and the field stayed non-empty, so the test passed while asserting nothing.
            .replace('outcome: "killed",', 'outcome: "maybe",', 1);
        fs.writeFileSync(copy, src, "utf8");
        const mod = await import(pathToFileURL(copy).href);
        const err = sink();
        const code = await mod.run(["--workspace", REPO, "--pack-root", join(REPO, "packs"), "--only", "matchesPath-tail-becomes-substring"], {
            stdout: sink(),
            stderr: err,
            cwd: REPO,
        });
        assert.equal(code, 2, "a malformed operator passed unnoticed in --only mode");
        assert.match(err.text(), /records outcome "maybe"/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("a bad argument is could-not-run, and --help is answered before it", async () => {
    const err = sink();
    assert.equal(await run(["--nonsense"], { stdout: sink(), stderr: err, cwd: REPO }), 2);
    assert.match(err.text(), /unknown argument/);
    const out = sink();
    assert.equal(await run(["--nonsense", "--help"], { stdout: out, stderr: sink(), cwd: REPO }), 0);
    assert.match(out.text(), /usage: node cli\/mutants\.mjs/);
});

test("a workspace with no gate policy is could-not-run", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-nopolicy-"));
    try {
        const err = sink();
        assert.equal(await run(["--workspace", dir], { stdout: sink(), stderr: err, cwd: dir }), 2);
        assert.match(err.text(), /no gate policy|cannot be read|not been authored/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("this module reaches no process-spawning API", () => {
    // The corpus holds `git push --force`, `rm -rf docs` and constitution writes by design. The only
    // thing this module may execute is `import()` on a file it wrote itself.
    const text = fs.readFileSync(join(REPO, "cli", "mutants.mjs"), "utf8");
    for (const forbidden of ["child_process", "execSync", "execFileSync", "spawnSync", "node:vm"]) {
        assert.ok(!text.includes(forbidden), `cli/mutants.mjs reaches ${forbidden}`);
    }
});

test("the entry guard survives a path containing a space", () => {
    // The third false green of this shape in this repository: `import.meta.url` percent-encodes and
    // this working copy lives under a path with spaces, so the naive comparison fails and the tool
    // exits 0 having run nothing. Pinned by construction rather than by reading the source.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan mutants guard-"));
    try {
        const copy = path.join(dir, "mutants.mjs");
        fs.writeFileSync(copy, absolutiseImports(fs.readFileSync(join(REPO, "cli", "mutants.mjs"), "utf8"), join(REPO, "cli")), "utf8");
        const text = execFileSync(process.execPath, [copy, "--help"], { encoding: "utf8" });
        assert.match(text, /usage: node cli\/mutants\.mjs/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
