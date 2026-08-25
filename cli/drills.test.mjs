// The forced-red drill harness's suite.
//
// **Every refusal is exercised POSITIVELY**, because a failure path nobody has run is one nobody has
// seen work — and this module's whole subject is rails that have quietly stopped firing.
//
// Two groups are worth naming before the code. The **pair oracle** is asserted against a fake rail in a
// throwaway repository rather than against this repository's own recipes: a control that is already
// red, a tell that was already present before the perturbation, a fire with the wrong exit, and a fire
// that exits as recorded and never says its tell are four different verdicts, and only a rail whose
// output this suite controls can produce all four on demand. The **tree-choice refusals** are the other
// group: a dirty tree without `--working-copy`, and untracked-and-unstaged files with it — both
// measured against a real `git` rather than reasoned about, since `git stash create`'s treatment of
// untracked files is the fact the whole mode rests on.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// A HERMETIC HOST, the three-line block `pinned-roots.live.test.mjs` sweeps for — asserted WHOLE, so
// that copying the two lines which neutralise the host and dropping the one that tidies up is caught.
// This suite reaches `recipe-set.mjs`, which consults the host's installed-plugin record on the unasked
// path, so without it a verdict would move with what somebody has installed.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import { DRILLS, DRILL_SESSION_PREFIX, NON_RECIPE_RAILS, NOT_DRILLED, check, drillOne, perturb, run, treeToDrill, yieldedRecipes } from "./drills.mjs";
import { CouldNotRun } from "./goldens.mjs";
import { isInside } from "./inside.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const SOURCE = fs.readFileSync(join(HERE, "drills.mjs"), "utf8");

const sink = () => {
    const lines = [];
    return { write: (s) => lines.push(s), text: () => lines.join("") };
};

const recipes = () => yieldedRecipes({ workspaceDir: join(REPO, ".portulan"), repoRoot: REPO, packRoots: [join(REPO, "packs")] });

/** A throwaway git repository with one tracked file, for the cases that need a real `git`. */
function fixtureRepo(body) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-drill-fixture-"));
    try {
        const git = (...args) => {
            const r = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
            assert.equal(r.status, 0, `git ${args.join(" ")} — ${r.stderr}`);
            return r.stdout;
        };
        git("init", "--quiet", "--initial-branch", "main");
        git("config", "user.email", "drill@example.invalid");
        git("config", "user.name", "Drill Fixture");
        fs.writeFileSync(path.join(dir, "marker.txt"), "clean\n");
        git("add", "-A");
        git("commit", "--quiet", "-m", "the fixture's one commit");
        return body({ dir, git });
    } finally {
        // A worktree this repository created must be retired before the directory goes, or `git` leaves
        // administrative files behind in a temp directory nobody looks at. #340 is the sibling of this
        // in `mutants.test.mjs`, filed rather than fixed there; here it is a `finally` from the start.
        spawnSync("git", ["worktree", "prune"], { cwd: dir });
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

/**
 * A fake rail whose verdict this suite controls.
 *
 * `grep -q` on a tracked file, so the control is green-and-silent and the fire is red-and-loud. Nothing
 * here touches this repository's own recipes: the point is to produce each of the four verdicts on
 * demand, which a real rail cannot be made to do.
 */
const FAKE_RAIL = {
    id: "fake",
    run: "if grep -q DRILLED marker.txt; then echo 'the fake rail fired'; exit 1; fi; echo 'the fake rail is green'",
};
const FAKE_DRILL = {
    rail: "fake",
    perturb: { file: "marker.txt", find: "clean", replace: "DRILLED" },
    exit: 1,
    tell: "the fake rail fired",
    why: "the pair oracle, asserted against a rail whose output this suite controls",
};

// ---------------------------------------------------------------------------- the table, and its floor

test("the declared table is green against this repository's own tree", () => {
    // The rail asserted here as well as in the recipe: every yielded rail has a drill, every drill names
    // a declared rail, every anchor places exactly once, and every drill carries a tell, a why and an
    // exit. `check` throws on an anchor that has drifted, so calling it is the assertion.
    assert.deepEqual(check({ recipes: recipes(), repoRoot: REPO }), []);
});

test("every drill's perturbation moves bytes in this tree", () => {
    for (const drill of DRILLS) {
        if (!drill.perturb?.file) continue;
        const source = fs.readFileSync(path.join(REPO, drill.perturb.file), "utf8");
        assert.notEqual(
            source.replace(drill.perturb.find, () => drill.perturb.replace),
            source,
            `drill ${drill.rail} placed and changed nothing`,
        );
    }
});

test("every non-recipe rail is declared with what it is and how its tell is read", () => {
    for (const rail of NON_RECIPE_RAILS) {
        assert.ok(rail.what.trim().length > 40, `${rail.id} carries no readable description`);
        assert.ok(Array.isArray(rail.argv) && rail.argv.length > 0, `${rail.id} declares no argv`);
        assert.equal(rail.tellStream, "stdout", `${rail.id} is a hook, and a hook's stderr is git's noise`);
    }
});

test("the rails that are NOT drilled are named with reasons", () => {
    // The clause's subject is the honesty of the word *every*, so the exclusions are data with a
    // carrier rather than a paragraph somebody has to remember to update.
    assert.ok(NOT_DRILLED.length > 0);
    for (const excluded of NOT_DRILLED) {
        assert.ok(excluded.rail.trim().length > 0);
        assert.ok(excluded.why.trim().length > 60, `${excluded.rail} carries no readable reason`);
    }
});

// ------------------------------------------------------------------------------ the perturbation guards

test("an anchor that does not place is could-not-run, never a skip", () =>
    fixtureRepo(({ dir }) => {
        assert.throws(
            () => perturb(dir, { rail: "fake", perturb: { file: "marker.txt", find: "not in this file", replace: "x" } }),
            (e) => e instanceof CouldNotRun && /does not place/.test(e.message),
        );
    }));

test("an anchor that places twice is could-not-run", () =>
    fixtureRepo(({ dir }) => {
        fs.writeFileSync(path.join(dir, "marker.txt"), "clean\nclean\n");
        assert.throws(
            () => perturb(dir, { rail: "fake", perturb: { file: "marker.txt", find: "clean", replace: "x" } }),
            (e) => e instanceof CouldNotRun && /places 2 times/.test(e.message),
        );
    }));

test("a substitution that changes nothing is could-not-run — a drill that does not fire reports on nothing", () =>
    fixtureRepo(({ dir }) => {
        // The guard that both hand-run sessions needed and did not have: a patch that placed and left the
        // bytes where they were, with the recipe then running green against an unmodified file.
        assert.throws(
            () => perturb(dir, { rail: "fake", perturb: { file: "marker.txt", find: "clean", replace: "clean" } }),
            (e) => e instanceof CouldNotRun && /the bytes did not move/.test(e.message),
        );
    }));

test("a creation over a path that already exists is could-not-run", () =>
    fixtureRepo(({ dir }) => {
        assert.throws(
            () => perturb(dir, { rail: "fake", perturb: { create: "marker.txt", content: "x" } }),
            (e) => e instanceof CouldNotRun && /already exists/.test(e.message),
        );
    }));

test("a named file that is not in the drilled tree is could-not-run, and says the file moved", () =>
    fixtureRepo(({ dir }) => {
        assert.throws(
            () => perturb(dir, { rail: "fake", perturb: { file: "gone.txt", find: "x", replace: "y" } }),
            (e) => e instanceof CouldNotRun && /cannot be read in the drilled tree/.test(e.message),
        );
    }));

// ------------------------------------------------------------------------------- the correspondence pass

test("a drill naming an undeclared rail is a finding, because a misspelled recipe id looks like one", () => {
    const findings = check({ recipes: [{ id: "docs", run: "true" }], repoRoot: REPO });
    assert.ok(
        findings.some((f) => /neither a recipe the workspace yields nor a declared non-recipe rail/.test(f.what)),
        "a rail this workspace does not yield must not pass as a rail of its own",
    );
});

test("a yielded rail with no drill is a finding", () => {
    const findings = check({ recipes: [...recipes(), { id: "a-rail-nothing-drills", run: "true" }], repoRoot: REPO });
    assert.ok(findings.some((f) => /has no drill/.test(f.what) && /a-rail-nothing-drills/.test(f.where)));
});

test("`--only` narrows what runs and not what must be well formed", async () => {
    // Session 1's round 1 on `mutants.mjs`: `--only` skipped validation in exactly the mode a person
    // reaches for when something is already wrong.
    //
    // **This was a source-text assertion — `!check.toString().includes("only")` — and Copilot round 1
    // reported it as already false, since `toString()` carries the body's comments.** Measured: it was
    // still true, so the claim was wrong about this tree. The finding underneath it was not: an
    // assertion over source text passes or fails on a comment somebody writes later, and it tests the
    // spelling instead of the behaviour. Asserted behaviourally now — a malformed drill for a rail
    // `--only` did NOT select still refuses the run.
    const bad = [...DRILLS, { rail: "not-a-rail-at-all", perturb: null, exit: 1, tell: "x", why: "malformed on purpose" }];
    assert.ok(
        check({ recipes: recipes(), repoRoot: REPO, drills: bad }).some((f) => /neither a recipe/.test(f.what)),
        "the seam must surface a malformed drill",
    );
    // And the real table stays clean, so the case above is exercising the seam rather than a tree defect.
    assert.deepEqual(check({ recipes: recipes(), repoRoot: REPO }), []);
});

// _A first draft of the case above also invoked `run(["--only", "json", …])` against this repository and
// asserted the status was not 2. It failed for a reason that had nothing to do with the property: the
// working tree is dirty while a session is in progress, so the sweep refused the tree. **A test whose
// verdict moves with whether somebody has uncommitted work is testing the desk**, which is the class this
// whole module is about, and it is the second time in this change that a check inherited an assumption
// about where it was run. The property that is decidable without an environment is the one above._

// ------------------------------------------------------------------------------------- the pair oracle

test("a drill fires when the rail reds with its tell", () =>
    fixtureRepo(({ dir }) => {
        const said = sink();
        const finding = drillOne({
            drill: FAKE_DRILL,
            rail: FAKE_RAIL,
            repoRoot: dir,
            sha: "HEAD",
            say: (l) => said.write(l),
        });
        assert.equal(finding, null);
        assert.match(said.text(), /fired/);
    }));

test("a rail that is already red is could-not-run, never a fire the perturbation did not cause", () =>
    fixtureRepo(({ dir, git }) => {
        // The environment case the control exists for: the drilled tree is red for a reason that has
        // nothing to do with the drill.
        fs.writeFileSync(path.join(dir, "marker.txt"), "DRILLED\n");
        git("add", "-A");
        git("commit", "--quiet", "-m", "the rail is red before the drill touches it");
        assert.throws(
            () => drillOne({ drill: FAKE_DRILL, rail: FAKE_RAIL, repoRoot: dir, sha: "HEAD", say: () => {} }),
            (e) => e instanceof CouldNotRun && /is not green on the drilled tree/.test(e.message),
        );
    }));

test("a tell already present in the control is could-not-run, because it cannot show the drill fired", () =>
    fixtureRepo(({ dir }) => {
        assert.throws(
            () =>
                drillOne({
                    drill: { ...FAKE_DRILL, tell: "the fake rail is green" },
                    rail: FAKE_RAIL,
                    repoRoot: dir,
                    sha: "HEAD",
                    say: () => {},
                }),
            (e) => e instanceof CouldNotRun && /before it is perturbed/.test(e.message),
        );
    }));

test("a fire with the wrong exit is a finding", () =>
    fixtureRepo(({ dir }) => {
        const finding = drillOne({
            drill: { ...FAKE_DRILL, exit: 2 },
            rail: FAKE_RAIL,
            repoRoot: dir,
            sha: "HEAD",
            say: () => {},
        });
        assert.match(finding.what, /did not fire as recorded/);
    }));

test("a fire that exits as recorded and never says its tell is a finding", () =>
    fixtureRepo(({ dir }) => {
        // The guard against a red for the WRONG reason — a syntax error where the finding was expected.
        const finding = drillOne({
            drill: { ...FAKE_DRILL, tell: "a sentence this rail never says" },
            rail: FAKE_RAIL,
            repoRoot: dir,
            sha: "HEAD",
            say: () => {},
        });
        assert.match(finding.what, /may have fired for another reason/);
    }));

test("a drill leaves no worktree behind, whichever way it ends", () =>
    fixtureRepo(({ dir, git }) => {
        drillOne({ drill: FAKE_DRILL, rail: FAKE_RAIL, repoRoot: dir, sha: "HEAD", say: () => {} });
        try {
            drillOne({ drill: { ...FAKE_DRILL, tell: "the fake rail is green" }, rail: FAKE_RAIL, repoRoot: dir, sha: "HEAD", say: () => {} });
        } catch {
            /* the could-not-run above; what is under test is the cleanup, not the throw */
        }
        assert.equal(git("worktree", "list").trim().split("\n").length, 1, "a drill left a worktree registered");
    }));

// --------------------------------------------------- a hook rail's session id, and the file it leaves

/**
 * A fake HOOK rail — `argv`, stdin, a tell on stdout — that records the session id it was handed and
 * writes a counter-shaped file exactly where `./stop-gate.mjs` writes one.
 *
 * It exists because two properties of the hook path had no test at all when they landed: that the
 * declared id is **completed per run** rather than shared, and that the file a hook leaves in the OS
 * temp directory is **retired**. Both were folded from a checkpoint finding, and a fold with no rail
 * behind it is the shape this whole module is about.
 */
function fakeHookRail(dir, log) {
    const script = path.join(dir, "fake-hook.mjs");
    fs.writeFileSync(
        script,
        [
            'import fs from "node:fs";',
            'import os from "node:os";',
            'import path from "node:path";',
            'let raw = "";',
            'for await (const chunk of process.stdin) raw += chunk;',
            "const payload = JSON.parse(raw);",
            // The same name shape `stop-gate.mjs` builds, so the harness's cleanup glob is exercised
            // against a real filename rather than against a guess about one.
            'const sanitised = String(payload.session_id).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);',
            'fs.writeFileSync(path.join(os.tmpdir(), `portulan-stopgate-${sanitised}-fake-fake`), "1");',
            `fs.appendFileSync(${JSON.stringify(log)}, \`\${payload.session_id}\\n\`);`,
            'if (fs.readFileSync("marker.txt", "utf8").includes("DRILLED")) process.stdout.write("THE FAKE HOOK FIRED\\n");',
        ].join("\n"),
    );
    return { id: "fake-hook", argv: [script], tellStream: "stdout" };
}

const HOOK_DRILL = {
    rail: "fake-hook",
    perturb: { file: "marker.txt", find: "clean", replace: "DRILLED" },
    stdin: { hook_event_name: "Stop", session_id: DRILL_SESSION_PREFIX },
    exit: 0,
    tell: "THE FAKE HOOK FIRED",
    why: "the hook path: a per-run session id, and the counter file retired",
};

const drillCounters = () =>
    fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith(`portulan-stopgate-${DRILL_SESSION_PREFIX}-`));

test("a hook rail is handed a session id completed per run, not the declared constant", () =>
    fixtureRepo(({ dir }) => {
        const log = path.join(os.tmpdir(), `portulan-drill-suite-${process.pid}-ids.txt`);
        try {
            const rail = fakeHookRail(dir, log);
            drillOne({ drill: HOOK_DRILL, rail, repoRoot: dir, sha: "HEAD", say: () => {} });
            const ids = fs.readFileSync(log, "utf8").trim().split("\n");
            assert.equal(ids.length, 2, "the control and the fire are two invocations");
            for (const id of ids) {
                assert.ok(id.startsWith(`${DRILL_SESSION_PREFIX}-`), `${id} does not carry the prefix`);
                assert.notEqual(id, DRILL_SESSION_PREFIX, "the declared constant reached the rail uncompleted");
            }
            // Under `counterFile`'s 40-character truncation, so the name the glob searches for and the
            // name the hook writes are the same string rather than two that happen to agree today.
            assert.ok(ids[0].length <= 40, `${ids[0]} is longer than the id a counter filename keeps`);
        } finally {
            fs.rmSync(log, { force: true });
        }
    }));

test("a hook rail's counter file is retired, and only this harness's own", () =>
    fixtureRepo(({ dir }) => {
        const log = path.join(os.tmpdir(), `portulan-drill-suite-${process.pid}-clean.txt`);
        // A bystander whose name shares the stem but not this run's worktree — the glob must not reach it.
        const bystander = path.join(os.tmpdir(), `portulan-stopgate-${DRILL_SESSION_PREFIX}-a-real-session-elsewhere`);
        fs.writeFileSync(bystander, "1");
        try {
            const before = drillCounters().length;
            drillOne({ drill: HOOK_DRILL, rail: fakeHookRail(dir, log), repoRoot: dir, sha: "HEAD", say: () => {} });
            assert.equal(drillCounters().length, before, "a sweep left a counter file behind, or removed one it did not create");
            assert.ok(fs.existsSync(bystander), "the cleanup reached a file this run did not create");
        } finally {
            fs.rmSync(bystander, { force: true });
            fs.rmSync(log, { force: true });
        }
    }));

test("a hook drill declaring its own session id is a finding", () => {
    // Exercised POSITIVELY through `check`'s own path, not by reading the guard: an id outside the
    // prefix gets neither the per-run completion nor the retirement, so it has to be refused rather
    // than run. The declared table is passed through the seam with one drill's id replaced.
    const stop = DRILLS.find((d) => d.rail === "stop-gate");
    assert.equal(stop.stdin.session_id, DRILL_SESSION_PREFIX, "the shipped hook drill must use the prefix");
    const tampered = DRILLS.map((d) =>
        d === stop ? { ...d, stdin: { ...d.stdin, session_id: "an-id-this-harness-does-not-own" } } : d,
    );
    const findings = check({ recipes: recipes(), repoRoot: REPO, drills: tampered });
    assert.ok(
        findings.some((f) => /declares its own `session_id`/.test(f.what)),
        `expected a session-id finding, got ${JSON.stringify(findings)}`,
    );
    // And the real table stays clean, so the case above is testing the guard rather than a tree defect.
    assert.deepEqual(check({ recipes: recipes(), repoRoot: REPO }), []);
});

test("a rail that exits 2 is could-not-run, not a rail that failed to fire", () =>
    fixtureRepo(({ dir }) => {
        // 2 is could-not-run everywhere here, so reporting it as *this rail did not fire* is a
        // could-not-measure read as a measurement — session 1's round 3, one module over.
        const rail = { id: "fake", run: "if grep -q DRILLED marker.txt; then exit 2; fi; echo green" };
        assert.throws(
            () => drillOne({ drill: FAKE_DRILL, rail, repoRoot: dir, sha: "HEAD", say: () => {} }),
            (e) => e instanceof CouldNotRun && /exited 2 — could not run/.test(e.message),
        );
    }));

test("a rail killed by a signal is could-not-run, and `status: null` is not read as a verdict", () =>
    fixtureRepo(({ dir }) => {
        // `spawnSync` reports `status: null` for a signal-killed child. A comparison against a declared
        // exit turns that into "did not fire as recorded", which is a finding about a run that produced
        // no verdict at all.
        const rail = { id: "fake", run: "if grep -q DRILLED marker.txt; then kill -TERM $$; fi; echo green" };
        assert.throws(
            () => drillOne({ drill: FAKE_DRILL, rail, repoRoot: dir, sha: "HEAD", say: () => {} }),
            (e) => e instanceof CouldNotRun && /killed by a signal/.test(e.message),
        );
    }));

test("a drill whose control cannot differ from its fire is a finding", () => {
    // Three shapes, and the first two passed the weak test this replaced: a recipe rail cannot be
    // distinguished by stdin at all, since `runRail` hands stdin only to a declared `argv`.
    const vacuous = [
        { rail: "docs", perturb: null, stdinControl: { a: 1 }, stdin: { a: 2 }, exit: 1, tell: "x", why: "a recipe rail ignores stdin" },
        { rail: "stop-gate", perturb: null, stdinControl: null, stdin: { a: 1 }, exit: 0, tell: "x", why: "null falls back to the same input" },
        { rail: "stop-gate", perturb: null, stdinControl: { a: 1 }, stdin: { a: 1 }, exit: 0, tell: "x", why: "identical inputs" },
    ];
    for (const drill of vacuous) {
        const findings = check({ recipes: recipes(), repoRoot: REPO, drills: [drill] });
        assert.ok(
            findings.some((f) => /its control and its fire are the same run/.test(f.what)),
            `expected a same-run finding for ${JSON.stringify(drill.why)}, got ${JSON.stringify(findings)}`,
        );
    }
});

test("a roster finding stays a finding in sweep mode, never a could-not-run", async () => {
    // `check` recorded a drill naming an undeclared rail, and the sweep then walked into the guard and
    // turned that documented exit-1 roster failure into an exit-2 could-not-run, abandoning the rest of
    // the transcript. Asserted at the message, since the exit code alone cannot tell the two apart.
    const err = sink();
    const status = await run(["--check", "--repo-root", REPO, "--pack-root", join(REPO, "packs")], { stdout: sink(), stderr: err, cwd: REPO });
    assert.equal(status, 0, err.text());
    // The sweep path's own reporting is asserted through `check`'s findings reaching stderr with the
    // roster wording rather than the guard's throw.
    assert.match(SOURCE, /RED — \$\{findings\.length\} finding\(s\) in the drill roster; no rail was drilled/);
});

test("a perturbation that resolves outside the worktree is refused before anything is written", () =>
    fixtureRepo(({ dir }) => {
        // The isolation guarantee, asserted rather than promised. Both shapes: a `..` traversal, and a
        // creation through one. Nothing is written in either case — the caller's own tree is what the
        // refusal protects.
        const outside = path.join(dir, "escaped.txt");
        const worktree = path.join(dir, "sub");
        fs.mkdirSync(worktree);
        for (const bad of [
            { file: "../escaped.txt", find: "x", replace: "y" },
            { create: "../escaped.txt", content: "x" },
        ]) {
            assert.throws(
                () => perturb(worktree, { rail: "fake", perturb: bad }),
                (e) => e instanceof CouldNotRun && /resolves outside the drill worktree/.test(e.message),
                JSON.stringify(bad),
            );
        }
        assert.ok(!fs.existsSync(outside), "the refusal wrote a file it was refusing");
    }));

test("a worktree that is not there is could-not-run, not a stack trace", () =>
    fixtureRepo(({ dir }) => {
        assert.throws(
            () => perturb(path.join(dir, "never-created"), { rail: "fake", perturb: { file: "marker.txt", find: "x", replace: "y" } }),
            (e) => e instanceof CouldNotRun && /cannot be resolved/.test(e.message),
        );
    }));

test("a workspace at the repository root is handed `.`, never the empty string", () => {
    // `PORTULAN_WORKSPACE=""` falls through `process.env.PORTULAN_WORKSPACE || ".portulan"` in both hook
    // runners, so an empty relative path would silently drill `.portulan` instead of the workspace the
    // run chose — the defect the threading was added to close, surviving in its own edge case.
    assert.match(SOURCE, /path\.relative\(repoRoot, workspaceDir\) \|\| "\."/);
    // And the fallback really is what the hooks treat as absent, asserted rather than assumed.
    assert.equal(process.env.PORTULAN_WORKSPACE_PROBE_UNSET || ".portulan", ".portulan");
    assert.equal("" || ".portulan", ".portulan");
});

test("containment uses the one carrier, so a name beginning with `..` is not a traversal", () => {
    // `./inside.mjs`'s own subject: `path.relative` of `sub/..packs` against `sub` is `..packs`, which
    // the naive `startsWith("..")` calls outside. Asserted here because this module had that spelling.
    assert.ok(isInside("/a/b", "/a/b/..packs"));
    assert.ok(isInside("/a/b", "/a/b"), "a path is inside itself");
    assert.ok(!isInside("/a/b", "/a/c"));
});

// ------------------------------------------------------------------------------- which tree is drilled

test("a clean tree drills HEAD and says so", () =>
    fixtureRepo(({ dir }) => {
        const tree = treeToDrill({ repoRoot: dir, workingCopy: false });
        assert.equal(tree.kind, "HEAD");
        assert.match(tree.sha, /^[0-9a-f]{40}$/);
    }));

test("a dirty tree is refused rather than drilled around", () =>
    fixtureRepo(({ dir }) => {
        fs.writeFileSync(path.join(dir, "marker.txt"), "edited\n");
        assert.throws(
            () => treeToDrill({ repoRoot: dir, workingCopy: false }),
            (e) => e instanceof CouldNotRun && /would be a green about a different tree/.test(e.message),
        );
    }));

test("--working-copy synthesizes a commit that carries the uncommitted edit", () =>
    fixtureRepo(({ dir, git }) => {
        fs.writeFileSync(path.join(dir, "marker.txt"), "edited\n");
        const tree = treeToDrill({ repoRoot: dir, workingCopy: true });
        assert.match(tree.kind, /synthesized/);
        // Measured rather than asserted from the flag's name: the synthesized commit really carries the
        // edit, so a drill against it reports on the working copy and not on HEAD.
        assert.match(git("show", `${tree.sha}:marker.txt`), /edited/);
    }));

test("--working-copy refuses while untracked-and-unstaged files exist, and names them", () =>
    fixtureRepo(({ dir }) => {
        // `git stash create` does not carry untracked files, so a synthesized tree would be missing the
        // very file under review — a green about the wrong tree, which is the whole thing this mode's
        // printed sha exists to prevent.
        fs.writeFileSync(path.join(dir, "marker.txt"), "edited\n");
        fs.writeFileSync(path.join(dir, "brand-new.txt"), "never staged\n");
        assert.throws(
            () => treeToDrill({ repoRoot: dir, workingCopy: true }),
            (e) => e instanceof CouldNotRun && /brand-new\.txt/.test(e.message),
        );
    }));

test("--working-copy over a clean tree is HEAD, and says it has nothing to add", () =>
    fixtureRepo(({ dir }) => {
        assert.match(treeToDrill({ repoRoot: dir, workingCopy: true }).kind, /the working tree is clean/);
    }));

// ------------------------------------------------------------------------------------------ the surface

test("--check runs no rail and reports the roster", async () => {
    const out = sink();
    const err = sink();
    const status = await run(["--check", "--repo-root", REPO, "--workspace", join(REPO, ".portulan"), "--pack-root", join(REPO, "packs")], {
        stdout: out,
        stderr: err,
        cwd: REPO,
    });
    assert.equal(status, 0, err.text());
    assert.match(out.text(), /GREEN — every yielded rail has a drill/);
    assert.match(out.text(), /not drilled/);
});

test("--only naming no drill is could-not-run, and lists the rails", async () => {
    const err = sink();
    const status = await run(["--only", "not-a-rail", "--repo-root", REPO, "--pack-root", join(REPO, "packs")], {
        stdout: sink(),
        stderr: err,
        cwd: REPO,
    });
    assert.equal(status, 2);
    assert.match(err.text(), /names no drill/);
});

test("an unknown argument is could-not-run", async () => {
    const err = sink();
    assert.equal(await run(["--sweep-everything"], { stdout: sink(), stderr: err, cwd: REPO }), 2);
    assert.match(err.text(), /unknown argument/);
});

test("a flag given another flag as its value is refused", async () => {
    const err = sink();
    assert.equal(await run(["--only", "--check"], { stdout: sink(), stderr: err, cwd: REPO }), 2);
    assert.match(err.text(), /needs a value/);
});

// ---------------------------------------------------------------------------- what reaches a shell here

test("only a rail's own command reaches a shell — no drill declaration is ever interpolated", () => {
    // This module's three siblings assert they import no process-spawning API at all, because a corpus
    // of `git push --force` spellings must never reach one. This module spawns by nature, so the pinned
    // property is the narrower one: every command line is either `git`, the yielded recipe's own `run`,
    // or a declared rail's argv. A `perturb` value is written to a file and never to a command.
    const sites = SOURCE.match(/spawnSync\([^)]*/g) ?? [];
    assert.equal(sites.length, 3, `expected exactly three spawn sites, found ${sites.length}`);
    assert.ok(SOURCE.includes('spawnSync("git", args,'));
    assert.ok(SOURCE.includes("spawnSync(process.execPath, rail.argv, {"));
    assert.ok(SOURCE.includes('spawnSync("bash", ["-c", rail.run], {'));
    for (const site of sites) {
        assert.ok(!/drill\./.test(site), `a spawn site interpolates a drill declaration: ${site}`);
    }
});

test("this file carries no raw control byte, and the control-chars drill's payload is a real NUL", () => {
    // Written as an escape on purpose. Session 0 shipped a literal NUL inside prose ABOUT storing bytes
    // escaped, and `control-chars` would have refused this whole tree for it.
    assert.ok(!SOURCE.includes(String.fromCharCode(0)), "cli/drills.mjs carries a raw NUL");
    const drill = DRILLS.find((d) => d.rail === "control-chars");
    assert.ok(drill.perturb.replace.includes(String.fromCharCode(0)), "the control-chars drill plants no control byte");
});

test("the entry guard survives a path containing a space", () => {
    // The third false green of this shape in this repository: `import.meta.url` percent-encodes and this
    // working copy lives under a path with spaces, so the naive comparison fails and the tool exits 0
    // having run nothing. Pinned by construction rather than by reading the source.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan drills guard-"));
    try {
        const copy = path.join(dir, "drills.mjs");
        const absolutised = SOURCE.replace(
            /from "\.\/([A-Za-z0-9._-]+\.mjs)"/g,
            (_, name) => `from "${new URL(`file://${path.join(HERE, name)}`).href}"`,
        );
        fs.writeFileSync(copy, absolutised, "utf8");
        const text = execFileSync(process.execPath, [copy, "--help"], { encoding: "utf8" });
        assert.match(text, /usage: node cli\/drills\.mjs/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
