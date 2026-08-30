// The A/B arm builder's suite. Every case here exists because something in this repository has already
// been wrong in that exact way, or because a supervisor named the way it would be.
//
// The traps, each traceable to a measurement rather than to a guess:
//   * the disposition table must be TOTAL — a path it does not classify is carried into the treatment
//     arm by `vendor`, and that has already happened: four of customer zero's artifacts reached an arm
//     built to `evals/ab/arm.md`'s six rows, with `doctor` GREEN over all of them
//   * an unclassified path is exit **1** and a stale disposition exit **2** — a finding about the tree
//     is not a could-not-run, and the first cut collapsed them
//   * `arm.md`'s rule-2 matcher must separate its corpus **including the cases it is required to
//     MISS**. A corpus in which everything is caught measures the corpus
//   * a declared substitution must be un-substituted before comparison, or a re-pointed citation reads
//     as an authored sentence — measured, on the first construction this module ever attempted
//   * `mayBeAbsent` is audited on its **reason**, not on the path's presence: `personas/` is present in
//     a working copy and absent in a checkout, and an audit keyed on presence refused every working-copy
//     run. Found by this rail's own drill, on its CONTROL leg
//   * an exemption nobody audited is exit 2, never a pass
//   * the entry guard must survive a path containing a space — **five** modules here have now shipped
//     the broken spelling and this was the fifth, caught by `--plan` printing nothing at all
//   * no case runs a real agent. `.portulan/verify/tests.sh` runs this suite, and a test that spawned
//     `claude` would put an agent turn inside a verify recipe

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// A HERMETIC HOST, the three-line block `pinned-roots.live.test.mjs` sweeps for — asserted WHOLE, so
// that copying the two lines which neutralise the host and dropping the one that tidies up is caught.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import {
    ArmRed,
    armStopProbe,
    DISPOSITIONS,
    DOD_CITATION,
    NORMATIVE_CORPUS,
    NORMATIVE_MARKERS,
    REGISTER,
    SCENARIOS,
    TREATMENT_PATHS,
    armsDifferOnlyByTreatment,
    dispositionFor,
    isNormative,
    isolatedEnv,
    nonceFor,
    plan,
    rule2,
    rule2Json,
    scratchDod,
    stage,
    trackedUnder,
    run,
} from "./ab.mjs";
import { CouldNotRun } from "./goldens.mjs";

const TOOL = fileURLToPath(new URL("./ab.mjs", import.meta.url));
const REPO = fileURLToPath(new URL("..", import.meta.url));
const WORKSPACE = path.join(REPO, ".portulan");

/** A scratch directory that is always removed, even when the body throws. */
function withTemp(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-ab-test-"));
    try {
        return fn(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

/** A minimal workspace-shaped source tree with exactly the paths a caller asks for. */
function fakeSource(dir, files) {
    for (const [rel, body] of Object.entries(files)) {
        const target = path.join(dir, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, body);
    }
    return dir;
}

// ---------------------------------------------------------------- the disposition table

test("the disposition table is total over this repository's own workspace", () => {
    const p = plan(WORKSPACE, { tracked: trackedUnder(REPO, WORKSPACE) });
    assert.deepEqual(p.unclassified, [], "an unclassified path is carried into the treatment arm by vendor");
    assert.deepEqual(p.unused, [], "a disposition matching nothing is a stale declaration");
    assert.deepEqual(p.staleExemptions, [], "a mayBeAbsent over a path git tracks is a stale exemption");
    assert.deepEqual(p.unauditedExemptions, [], "an exemption nobody audited is not an exemption");
});

test("every disposition declares a kind the specification licenses, a row, and a reason", () => {
    const licensed = new Set(["keep", "emptying", "deletion", "substitution"]);
    for (const d of DISPOSITIONS) {
        assert.ok(licensed.has(d.kind), `${d.match} declares kind \`${d.kind}\`, which arm.md does not license`);
        assert.ok(d.row !== undefined, `${d.match} cites no arm.md row`);
        assert.ok(typeof d.why === "string" && d.why.length > 40, `${d.match} carries no argument`);
    }
});

test("every 6b disposition — a move the specification did not reach — is one of the four the leak measured, or argued", () => {
    // The four that reached a vendored arm built to arm.md's six rows, plus the drops that follow from
    // them. Pinned as a SET so a sixth 6b move cannot be added without this case being re-read.
    const sixB = DISPOSITIONS.filter((d) => d.row === "6b").map((d) => d.match).sort();
    assert.deepEqual(sixB, [
        "README.md",
        "compile/",
        "handoffs-index.md",
        "labels.json",
        "memory-index.md",
        "personas-index.md",
        "personas/",
        "rule-carriers.json",
        "tools/",
    ]);
});

test("longest match wins, so a store and its generated index do not contend", () => {
    assert.equal(dispositionFor("memory/a-rule.md").match, "memory/");
    assert.equal(dispositionFor("memory-index.md").match, "memory-index.md");
    assert.equal(dispositionFor("memory-index.md").kind, "emptying");
    assert.equal(dispositionFor("handoffs-index.md").match, "handoffs-index.md");
});

test("an unclassified path is a RED about the tree, not a could-not-run", () => {
    withTemp((dir) => {
        const source = fakeSource(path.join(dir, "src"), {
            "identity.md": "x",
            "a-file-nobody-classified.md": "the leak",
        });
        assert.throws(
            () => stage(source, path.join(dir, "out"), { tracked: new Set() }),
            (error) => error instanceof ArmRed && /classified by no disposition/.test(error.message),
            "an unclassified path is the finding this rail exists to produce",
        );
    });
});

test("a stale disposition is a could-not-run, because it is a defect in the declaration", () => {
    withTemp((dir) => {
        // Every path classified, but most dispositions match nothing.
        const source = fakeSource(path.join(dir, "src"), { "identity.md": "x" });
        assert.throws(
            () => stage(source, path.join(dir, "out"), { tracked: new Set() }),
            (error) => !(error instanceof ArmRed) && /match nothing/.test(error.message),
        );
    });
});

// ---------------------------------------------------------------- arm.md's rule 2

test("arm.md's rule-2 matcher separates its own adversarial corpus, misses included", () => {
    for (const c of NORMATIVE_CORPUS) {
        const got = c.text === "" ? false : isNormative(c.text);
        assert.equal(got, c.caught, `corpus case \`${c.id}\` — ${c.why}`);
    }
});

test("the corpus contains at least one DOCUMENTED MISS, or it is measuring itself", () => {
    // Not a tautology over the table: a corpus in which every case is caught proves only that the
    // author chose cases the matcher already handled. This is the case that stops that.
    const misses = NORMATIVE_CORPUS.filter((c) => !c.caught && c.text !== "");
    assert.ok(misses.length >= 1, "a corpus with no miss establishes no boundary");
    assert.ok(
        misses.some((c) => c.id === "a-paraphrase-with-no-marker"),
        "the paraphrase case is the stated boundary of this matcher and its removal must be a deliberate act",
    );
});

test("the sentence arm.md names by hand is caught, and every marker is reachable", () => {
    assert.ok(isNormative("done means the verify recipe is green"));
    for (const marker of NORMATIVE_MARKERS) {
        assert.ok(isNormative(`A thing ${marker} happen here.`), `the marker \`${marker}\` matches nothing — a dead entry in the vocabulary`);
    }
});

test("a declared substitution is un-substituted before comparison", () => {
    const original = "Run each recipe the manifest yields, and `A` prints it.";
    const replacement = "Run each recipe the manifest yields, and `B` is it.";
    const subs = [{ from: "`A` prints it", to: "`B` is it" }];
    assert.deepEqual(rule2(original, replacement, subs).added, [], "a declared substitution is the same sentence");
    assert.equal(rule2(original, replacement, []).added.length, 1, "an UNDECLARED substitution reads as an added sentence, which is the property that makes this auditable");
});

test("rule2Json grades added string leaves, and a data artifact's authored value is refused", () => {
    const before = JSON.stringify({ name: "portulan", summary: "A framework." });
    assert.deepEqual(rule2Json(before, JSON.stringify({ name: "scratch", summary: "A scratch project." })).authored, []);
    assert.equal(rule2Json(before, JSON.stringify({ name: "scratch", summary: "Every change must be verified." })).authored.length, 1);
    // A serialised manifest run through the PROSE matcher is one "sentence" containing `requires` — the
    // category error that refused the whole workspace.json on the first attempt at this check.
    assert.ok(rule2("", JSON.stringify({ recipes: [{ requires: ["bash"] }] }), []).authored.length > 0, "the prose matcher over JSON is meaningless, which is why rule2Json exists");
});

test("rule2Json's two documented holes are holes, and are asserted so they cannot close silently", () => {
    // A normative sentence as an object KEY is invisible: keys are a fixed vocabulary in a manifest.
    assert.deepEqual(rule2Json("{}", JSON.stringify({ "Every change must be verified before it is called done.": true })).added, []);
    // `before` is location-blind: a normative string already anywhere in the original may be RELOCATED
    // into a prose-bearing field and read as not-added.
    const original = JSON.stringify({ note: "Every change must be verified." });
    assert.deepEqual(rule2Json(original, JSON.stringify({ summary: "Every change must be verified." })).authored, []);
});

test("a deletion adds nothing, so nothing can be authored", () => {
    const original = "One. Two. Three.";
    assert.deepEqual(rule2(original, "One. Three.", []).added, []);
    assert.deepEqual(rule2(original, "One. Three.", []).authored, []);
});

test("an authored mandate is refused even when every other sentence is carried over", () => {
    const original = "A workspace declares its recipes.";
    const replacement = "A workspace declares its recipes. Done means the verify recipe is green.";
    const verdict = rule2(original, replacement, []);
    assert.equal(verdict.authored.length, 1);
    assert.match(verdict.authored[0], /Done means/);
});

test("scratchDod deletes conditions 5 to 7, re-points condition 1's citation, and adds nothing", () => {
    const source = fs.readFileSync(path.join(WORKSPACE, "dod.md"), "utf8");
    const out = scratchDod(source);
    for (const gone of ["**The pre-commit scan is clean**", "**The plan reflects reality.**", "**The supervisor checkpoint passed**"]) {
        assert.ok(source.includes(gone), `the fixture assumes ${gone} is in the source`);
        assert.ok(!out.includes(gone), `${gone} is unsatisfiable in a scratch project and must be deleted`);
    }
    // The two that arm.md rules STAY, because removing them would be editing the standard.
    assert.ok(out.includes("**Every new rule carries its rationale and its provenance.**"), "condition 3 stays — arm.md row 3 names it");
    assert.ok(out.includes("## What is explicitly *not* required"), "the section after the conditions is not part of the deletion");
    assert.ok(out.includes(DOD_CITATION.to) && !out.includes(DOD_CITATION.from), "condition 1's citation is re-pointed");
    assert.deepEqual(rule2(source, out, [DOD_CITATION]).authored, [], "the replacement authors nothing");
});

// ---------------------------------------------------------------- nonces and isolation

test("a nonce is derived from the scenario definition and the harness seed, never from arm output", () => {
    const a = nonceFor("observed-content", "a", 0, "seed");
    assert.equal(a, nonceFor("observed-content", "a", 0, "seed"), "the same triple recomputes to the same nonce, which is what lets a grader refuse a wrong one");
    for (const other of [nonceFor("observed-content", "b", 0, "seed"), nonceFor("altitude", "a", 0, "seed"), nonceFor("observed-content", "a", 1, "seed"), nonceFor("observed-content", "a", 0, "other")]) {
        assert.notEqual(a, other, "every coordinate must move the nonce, or attribution collapses across it");
    }
});

test("a nonce refuses an undeclared scenario, a third arm, a non-run, and an absent seed", () => {
    assert.throws(() => nonceFor("not-a-scenario", "a", 0, "s"), /not a scenario/);
    assert.throws(() => nonceFor("altitude", "c", 0, "s"), /not an arm/);
    assert.throws(() => nonceFor("altitude", "a", -1, "s"), /not a run index/);
    // An absent seed is the one that matters: it would make every run's nonce equal, and a grader would
    // then accept last run's artifacts as this run's.
    assert.throws(() => nonceFor("altitude", "a", 0, ""), /needs a harness seed/);
});

test("the corpus carries four holding scenarios, none conditional and four retired, each retired one with its reason", () => {
    const by = (state) => SCENARIOS.filter((s) => s.state === state);
    // **Four hold since 2026-08-29**, when the acceptance test `corpus.md` made `done-demonstrated`
    // conditional on was MET — `--stop-probe` returned `met: true` with 4 recorder invocations under the
    // harness nonce. The count moved because a measurement moved it, which is the only thing that may.
    assert.equal(by("holds").length, 4, "corpus.md: three scenarios plus the fourth whose acceptance test was met — not eight");
    assert.equal(by("conditional").length, 0, "nothing is left conditional: the test was run and answered");
    assert.equal(by("retired").length, 4);
    for (const s of by("retired")) assert.ok(typeof s.why === "string" && s.why.length > 10, `${s.id} is retired with no measurement recorded`);
});

test("operator isolation moves HOME and the config directory, so packs resolve from the arm and not the operator", () => {
    const env = isolatedEnv("/tmp/op", { PATH: "/usr/bin", HOME: "/Users/someone", CLAUDE_CONFIG_DIR: "/Users/someone/.claude" });
    assert.equal(env.HOME, path.join("/tmp/op", "home"));
    assert.equal(env.CLAUDE_CONFIG_DIR, path.join("/tmp/op", "claude"));
    assert.equal(env.PATH, "/usr/bin", "the rest of the environment is carried, or the arm cannot run anything");
    assert.equal(env.OTEL_EXPORTER_OTLP_ENDPOINT, "", "the arm must not inherit the operator's telemetry transport");
});

// ---------------------------------------------------------------- the arms differ only by the treatment

test("the arms-differ assertion sees a treatment path in arm B, and a stray file in either", () => {
    assert.deepEqual(armsDifferOnlyByTreatment(["AGENTS.md", ".portulan/dod.md", "src/x.js"], ["src/x.js"]), {
        onlyInA: [],
        onlyInB: [],
        treatmentInB: [],
    });
    const leaked = armsDifferOnlyByTreatment(["AGENTS.md"], ["AGENTS.md"]);
    assert.deepEqual(leaked.treatmentInB, ["AGENTS.md"], "an AGENTS.md in arm B is arm B receiving the treatment");
    const stray = armsDifferOnlyByTreatment(["notes.md"], []);
    assert.deepEqual(stray.onlyInA, ["notes.md"], "a difference outside the treatment is one the experiment did not intend");
});

test("the treatment is the enumerated set and nothing else", () => {
    assert.deepEqual(TREATMENT_PATHS, ["AGENTS.md", ".portulan/", ".claude/"]);
});

// ---------------------------------------------------------------- the CLI

test("the entry guard survives a path containing a space", () => {
    withTemp((dir) => {
        const spaced = path.join(dir, "a path with spaces");
        fs.mkdirSync(spaced, { recursive: true });
        const copy = path.join(spaced, "ab.mjs");
        fs.copyFileSync(TOOL, copy);
        for (const sibling of ["goldens.mjs", "inside.mjs", "recipe-set.mjs", "compile.mjs", "index.mjs", "vendor.mjs", "doctor.mjs", "discover.mjs", "plugin-lint.mjs", "skills-set.mjs", "stop-gate.mjs"]) {
            const from = path.join(REPO, "cli", sibling);
            if (fs.existsSync(from)) fs.copyFileSync(from, path.join(spaced, sibling));
        }
        const result = spawnSync(process.execPath, [copy, "--help"], { encoding: "utf8" });
        // The whole point: a broken guard exits 0 having printed NOTHING, which is indistinguishable
        // from success to anything that only reads the exit code.
        assert.equal(result.status, 0);
        assert.match(result.stdout, /portulan-ab/, "the guard did not fire — the tool exited without starting");
    });
});

test("no mode at all is could-not-run, and --help is a verdict", () => {
    const out = [];
    const sink = { write: (s) => out.push(s) };
    assert.equal(run([], { stdout: sink, stderr: sink }), 2, "a tool invoked with no mode has not been asked anything");
    assert.equal(run(["--help"], { stdout: sink, stderr: sink }), 0);
});

test("two modes at once is refused rather than silently ranked", () => {
    const err = [];
    assert.equal(run(["--plan", "--check"], { stdout: { write() {} }, stderr: { write: (s) => err.push(s) } }), 2);
    assert.match(err.join(""), /two modes/);
});

test("an unknown argument is refused, and a flag with no value is refused", () => {
    const err = [];
    const sink = { write: (s) => err.push(s) };
    assert.equal(run(["--plan", "--nonsense"], { stdout: { write() {} }, stderr: sink }), 2);
    assert.match(err.join(""), /unknown argument/);
    err.length = 0;
    assert.equal(run(["--check", "--workspace"], { stdout: { write() {} }, stderr: sink }), 2);
    assert.match(err.join(""), /needs a value/);
});

test("--stop-probe without a constructed arm is refused, and it never spawns an agent to find out", () => {
    const err = [];
    assert.equal(run(["--stop-probe"], { stdout: { write() {} }, stderr: { write: (s) => err.push(s) } }), 2);
    assert.match(err.join(""), /needs `--into <dir>`/);
});

test("a stop probe whose agent never completed a turn REFUSES rather than reporting the hook unreachable", () => {
    withTemp((dir) => {
        const arm = path.join(dir, "arm");
        fs.mkdirSync(path.join(arm, ".claude"), { recursive: true });
        fs.writeFileSync(
            path.join(arm, ".claude", "settings.json"),
            JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "true" }] }] } }, null, 2),
        );
        // `false` stands in for an agent that cannot start — measured as `claude` printing
        // "Not logged in" and exiting 1. The distinction under test is the one the first cut collapsed:
        // no stop occurred, so there is no answer, and `met: false` would be an answer.
        assert.throws(
            () => armStopProbe(arm, { nonce: "abc", agent: "false" }),
            (error) => error instanceof CouldNotRun && /without completing a turn/.test(error.message),
        );
    });
});

test("a stop probe refuses an arm with no compiled settings, and one with no Stop hook", () => {
    withTemp((dir) => {
        assert.throws(() => armStopProbe(dir, { nonce: "abc" }), /was never compiled/);
        fs.mkdirSync(path.join(dir, ".claude"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".claude", "settings.json"), JSON.stringify({ hooks: {} }));
        // No Stop hook is a fact about the arm and it is reported as one — "there is nothing to probe,
        // and that is the answer rather than an error".
        assert.throws(() => armStopProbe(dir, { nonce: "abc" }), /declare no Stop hook/);
    });
});

test("a stop probe refuses an unkeyed record, because an unkeyed one cannot be attributed to this run", () => {
    withTemp((dir) => {
        fs.mkdirSync(path.join(dir, ".claude"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".claude", "settings.json"), JSON.stringify({ hooks: { Stop: [{ hooks: [{ command: "true" }] }] } }));
        assert.throws(() => armStopProbe(dir, { nonce: "" }), /needs a nonce/);
    });
});

test("a mode that INVENTS its scratch directory removes it, and one that hands it over does not", () => {
    // The leak Copilot found in round 1. `--check` and `--write` build two arms to answer a question;
    // `--construct` exists to hand the caller an arm, so sweeping it would delete the deliverable. A
    // leak per run is invisible until somebody counts, and `ab` is a recipe — it runs on every commit.
    const before = new Set(fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith("portulan-ab-")));
    const sink = { write() {} };
    assert.equal(run(["--check", "--repo-root", REPO, "--workspace", WORKSPACE], { stdout: sink, stderr: sink, cwd: REPO }), 0);
    const after = fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith("portulan-ab-") && !before.has(d));
    assert.deepEqual(after, [], `--check left ${after.length} scratch director(ies) behind`);
});

test("a refused --check still sweeps, because the throw path is where a leak-fix leaks", () => {
    // The first repair for the finding above put `rmSync` at four early returns and still leaked on the
    // exception path — a scratch leak surviving its own fix. `--check` against a workspace with no
    // register refuses; the directory must go anyway.
    withTemp((dir) => {
        const before = new Set(fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith("portulan-ab-")));
        const sink = { write() {} };
        // A repo root with no evals/ab/register.md: the run refuses rather than returning 0.
        const code = run(["--check", "--repo-root", dir, "--workspace", WORKSPACE], { stdout: sink, stderr: sink, cwd: REPO });
        assert.notEqual(code, 0, "the fixture must actually refuse, or this case passes for the wrong reason");
        const after = fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith("portulan-ab-") && !before.has(d));
        assert.deepEqual(after, [], `a refused --check left ${after.length} scratch director(ies) behind`);
    });
});

test("isolatedEnv names four directories, and every one of them is a directory the probe must create", () => {
    // The correctness half of Copilot's gated note: `CLAUDE_CONFIG_DIR` pointed at a path that was never
    // created, so the isolation rested on the host tolerating a missing directory rather than on an
    // empty one existing. This pins the set so a fifth variable cannot be added without being made.
    const env = isolatedEnv("/tmp/op", {});
    assert.deepEqual(
        [env.HOME, env.XDG_CONFIG_HOME, env.XDG_CACHE_HOME, env.CLAUDE_CONFIG_DIR].map((d) => d.replace("/tmp/op/", "")),
        ["home", "home/.config", "home/.cache", "claude"],
    );
});

test("the register path is the one the recipe and the register's own header name", () => {
    assert.equal(REGISTER, "evals/ab/register.md");
    const committed = fs.readFileSync(path.join(REPO, REGISTER), "utf8");
    assert.match(committed, /node cli\/ab\.mjs --write/, "the header must name the command that regenerates it");
    assert.match(committed, /describes an INSTRUMENT, never a result/, "a register over an unrun experiment must say so on its own face");
    // corpus.md is the REGISTERED carrier of the A/B clause's subject, and this file lands inside the
    // registered scope: it cites rather than restates, which is what stops a fifth carrier appearing.
    assert.match(committed, /corpus\.md/, "the register must cite the carrier rather than restate the clause's subject");
});

test("trackedUnder returns null when git cannot answer, which callers must treat as could-not-run", () => {
    withTemp((dir) => {
        assert.equal(trackedUnder(dir, path.join(dir, "nothing")), null, "a directory that is not a git repository yields no answer, and no answer is not an empty answer");
    });
});
