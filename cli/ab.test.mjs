// Tests for `ab` — the A/B arm builder: its disposition table, rule-2 matcher, nonces, isolation and stop probe.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The imports reach `./compile.mjs`, which can read the host's installed-plugin record: point it at none.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import {
    ArmRed,
    seedOperator,
    armStopProbe,
    DISPOSITIONS,
    DOD_CITATION,
    NORMATIVE_CORPUS,
    NORMATIVE_MARKERS,
    REGISTER,
    SCENARIOS,
    SCRATCH_PREFIX,
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

function withTemp(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-ab-test-"));
    try {
        return fn(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

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
    const sixB = DISPOSITIONS.filter((d) => d.row === "6b").map((d) => d.match).sort();
    assert.deepEqual(sixB, [
        "README.md",
        "compile/",
        "context/",
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
    assert.ok(rule2("", JSON.stringify({ recipes: [{ requires: ["bash"] }] }), []).authored.length > 0, "the prose matcher over JSON is meaningless, which is why rule2Json exists");
});

test("rule2Json's two documented holes are holes, and are asserted so they cannot close silently", () => {
    // A normative sentence as an object KEY is invisible: keys are a fixed vocabulary in a manifest.
    assert.deepEqual(rule2Json("{}", JSON.stringify({ "Every change must be verified before it is called done.": true })).added, []);
    // `before` is location-blind: a normative string moved into a prose-bearing field reads as not-added.
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
    assert.throws(() => nonceFor("altitude", "a", 0, ""), /needs a harness seed/);
});

test("the corpus carries four holding scenarios, none conditional and four retired, each retired one with its reason", () => {
    const by = (state) => SCENARIOS.filter((s) => s.state === state);
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

test("a credential variable crosses into the isolated arm, which is why isolation is runnable at all", () => {
    const env = isolatedEnv("/tmp/op", { CLAUDE_CODE_OAUTH_TOKEN: "fake", ANTHROPIC_API_KEY: "fake2", ANTHROPIC_AUTH_TOKEN: "fake3", PATH: "/usr/bin" });
    assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, "fake");
    assert.equal(env.ANTHROPIC_API_KEY, "fake2");
    assert.equal(env.ANTHROPIC_AUTH_TOKEN, "fake3");
    assert.equal(env.HOME, path.join("/tmp/op", "home"));
    assert.equal(env.CLAUDE_CONFIG_DIR, path.join("/tmp/op", "claude"));
});

test("an isolated stop probe refuses with the remedy when no credential is set, before spending a turn", () => {
    withTemp((dir) => {
        const saved = { ...process.env };
        for (const v of ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"]) delete process.env[v];
        try {
            const err = [];
            const code = run(["--stop-probe", "--into", dir, "--seed", "t"], { stdout: { write() {} }, stderr: { write: (s) => err.push(s) }, cwd: REPO });
            assert.equal(code, 2);
            assert.match(err.join(""), /claude setup-token/, "the refusal must name the remedy, not merely refuse");
            assert.match(err.join(""), /Bedrock or Vertex/, "it must name the channels it CANNOT see, or it asserts a universal it has not measured");
            assert.doesNotMatch(err.join(""), /was never compiled/, "it must refuse BEFORE reaching the arm, or it has paid for the launch it exists to avoid");
        } finally {
            Object.assign(process.env, saved);
        }
    });
});

test("two credential variables at once is refused, so a baseline cannot be recorded under an ambiguous channel", () => {
    withTemp((dir) => {
        const saved = { ...process.env };
        process.env.CLAUDE_CODE_OAUTH_TOKEN = "fake";
        process.env.ANTHROPIC_API_KEY = "fake2";
        try {
            const err = [];
            assert.equal(run(["--stop-probe", "--into", dir, "--seed", "t"], { stdout: { write() {} }, stderr: { write: (s) => err.push(s) }, cwd: REPO }), 2);
            assert.match(err.join(""), /different auth paths/);
            assert.doesNotMatch(err.join(""), /fake2?/, "a refusal naming the variable must not print its value");
        } finally {
            for (const v of ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"]) delete process.env[v];
            Object.assign(process.env, saved);
        }
    });
});

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
    assert.deepEqual(TREATMENT_PATHS, ["AGENTS.md", ".portulan/", ".claude/", "changes/README.md", ".gitignore"]);
});

// ---------------------------------------------------------------- the CLI

test("the entry guard survives a path containing a space", () => {
    withTemp((dir) => {
        const spaced = path.join(dir, "a path with spaces");
        fs.mkdirSync(spaced, { recursive: true });
        const copy = path.join(spaced, "ab.mjs");
        fs.copyFileSync(TOOL, copy);
        for (const sibling of ["goldens.mjs", "inside.mjs", "recipe-set.mjs", "compile.mjs", "index.mjs", "vendor.mjs", "doctor.mjs", "discover.mjs", "plugin-lint.mjs", "skills-set.mjs", "stop-gate.mjs", "symbols.mjs", "ledger.mjs"]) {
            const from = path.join(REPO, "cli", sibling);
            if (fs.existsSync(from)) fs.copyFileSync(from, path.join(spaced, sibling));
        }
        const result = spawnSync(process.execPath, [copy, "--help"], { encoding: "utf8" });
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
        // `false` is the shell command: an agent that exits 1 without completing a turn.
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
    const before = new Set(fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith(SCRATCH_PREFIX)));
    const sink = { write() {} };
    assert.equal(run(["--check", "--repo-root", REPO, "--workspace", WORKSPACE], { stdout: sink, stderr: sink, cwd: REPO }), 0);
    const after = fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith(SCRATCH_PREFIX) && !before.has(d));
    assert.deepEqual(after, [], `--check left ${after.length} scratch directory(ies) behind`);
});

test("a refused --check still sweeps, because the throw path is where a leak-fix leaks", () => {
    withTemp((dir) => {
        const before = new Set(fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith(SCRATCH_PREFIX)));
        const sink = { write() {} };
        const code = run(["--check", "--repo-root", dir, "--workspace", WORKSPACE], { stdout: sink, stderr: sink, cwd: REPO });
        assert.notEqual(code, 0, "the fixture must actually refuse, or this case passes for the wrong reason");
        const after = fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith(SCRATCH_PREFIX) && !before.has(d));
        assert.deepEqual(after, [], `a refused --check left ${after.length} scratch directory(ies) behind`);
    });
});

test("isolatedEnv names four directories, and every one of them is a directory the probe must create", () => {
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
    assert.match(committed, /corpus\.md/, "the register must cite the carrier rather than restate the clause's subject");
});

test("trackedUnder returns null when git cannot answer, which callers must treat as could-not-run", () => {
    withTemp((dir) => {
        assert.equal(trackedUnder(dir, path.join(dir, "nothing")), null, "a directory that is not a git repository yields no answer, and no answer is not an empty answer");
    });
});

// ---------------------------------------------------------------- the operator seed

test("seedOperator writes the SAME BYTES however it is called — it cannot become treatment", () => {
    withTemp((dir) => {
        const read = (label, ...extra) => seedOperator(path.join(dir, label), ...extra).map((f) => fs.readFileSync(f, "utf8"));
        const plain = read("plain");
        assert.ok(plain.length >= 2, "the seed must reach every location the turn's environment names");
        for (const extra of [["A"], ["B"], [{ arm: "A" }], [true]]) {
            assert.deepEqual(read(`x${JSON.stringify(extra).replace(/\W/g, "")}`, ...extra), plain, `an extra argument ${JSON.stringify(extra)} must change nothing`);
        }
        assert.equal(new Set(plain).size, 1, "every location gets the same bytes, or the arms could differ by which one is read");
        const seeded = JSON.parse(plain[0]);
        assert.deepEqual(Object.keys(seeded).sort(), ["bypassPermissionsModeAccepted", "hasCompletedOnboarding", "hasTrustDialogAccepted"]);
        assert.equal(seeded.bypassPermissionsModeAccepted, false, "a seed accepting bypass would dissolve arm A's enforcement");
        for (const forbidden of ["permissions", "hooks", "allowedTools", "model", "env"]) {
            assert.ok(!(forbidden in seeded), `\`${forbidden}\` in the seed would be treatment, not setup`);
        }
    });
});

test("`--operator-env inherit` reaches its refusal without writing into the operator's home", () => {
    withTemp((dir) => {
        const home = path.join(dir, "stand-in-home");
        fs.mkdirSync(home);
        const saved = process.env.HOME;
        process.env.HOME = home;
        try {
            const out = { std: "", err: "" };
            const code = run(["--stop-probe", "--into", path.join(dir, "no-arm-here"), "--operator-env", "inherit"], {
                stdout: { write: (t) => (out.std += t) },
                stderr: { write: (t) => (out.err += t) },
            });
            assert.equal(code, 2, "no constructed arm is could-not-run, which is how this stops before spawning");
            assert.match(out.std, /--operator-env inherit/, "the inherit branch must actually have run");
            assert.deepEqual(fs.readdirSync(home), [], "the inherit branch must write nothing into the operator's own home");
        } finally {
            if (saved === undefined) delete process.env.HOME;
            else process.env.HOME = saved;
        }
    });
});

test("the seed lands in EVERY location isolatedEnv names, derived rather than listed", () => {
    // Claude Code 2.1.251, given `CLAUDE_CONFIG_DIR`, reads that directory's `.claude.json` and never `$HOME`'s.
    withTemp((dir) => {
        const into = path.join(dir, "arm");
        const env = isolatedEnv(into);
        const written = seedOperator(into);
        const expected = [path.join(env.HOME, ".claude.json"), path.join(env.CLAUDE_CONFIG_DIR, ".claude.json")];
        assert.deepEqual([...written].sort(), [...expected].sort(), "the seed must land wherever the turn is sent to look");
        for (const f of written) assert.ok(fs.existsSync(f), `${f} must actually exist on disk`);
        assert.ok(fs.existsSync(env.CLAUDE_CONFIG_DIR), "the config directory the turn is given must exist");
    });
});

// ---------------------------------------------------------------- the probe's refusal diagnostics

function probeArm(dir) {
    const arm = path.join(dir, "arm");
    fs.mkdirSync(path.join(arm, ".claude"), { recursive: true });
    fs.writeFileSync(
        path.join(arm, ".claude", "settings.json"),
        JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "true" }] }] } }, null, 2),
    );
    return arm;
}

/** Never `claude`: a test that spawned one would spend a real turn. */
function fakeAgent(dir, body) {
    const p = path.join(dir, `agent-${Math.random().toString(36).slice(2)}.sh`);
    fs.writeFileSync(p, body, { mode: 0o755 });
    return p;
}

test("the receipt is TRUNCATED at probe start — an interrupted run must not inflate the next", () => {
    withTemp((dir) => {
        const arm = probeArm(dir);
        fs.writeFileSync(path.join(arm, ".portulan-stop-receipt"), "stale\n".repeat(500));
        const agent = fakeAgent(dir, "#!/usr/bin/env bash\necho no\nexit 3\n");
        assert.throws(
            () => armStopProbe(arm, { nonce: "n", agent }),
            (e) => /fired 0 time\(s\)/.test(e.message),
            "500 lines from a killed run must not be counted as this run's firings",
        );
    });
});

test("every refusal reports how many times the hook fired, and says what the count means", () => {
    withTemp((dir) => {
        const arm = probeArm(dir);
        const receipt = path.join(arm, ".portulan-stop-receipt");
        const agent = fakeAgent(dir, `#!/usr/bin/env bash\nfor i in 1 2 3; do printf 'x\\n' >> ${JSON.stringify(receipt)}; done\necho no\nexit 3\n`);
        assert.throws(
            () => armStopProbe(arm, { nonce: "n", agent }),
            (e) => /fired 3 time\(s\)/.test(e.message) && /the agent did stop/.test(e.message),
            "a non-zero count must be reported and read as the agent having stopped",
        );
    });
});

test("a zero count is read as the agent never reaching a stop, not as the gate looping", () => {
    withTemp((dir) => {
        const arm = probeArm(dir);
        const agent = fakeAgent(dir, "#!/usr/bin/env bash\necho no\nexit 3\n");
        assert.throws(
            () => armStopProbe(arm, { nonce: "n", agent }),
            (e) => /fired 0 time\(s\)/.test(e.message) && /never reached a stop/.test(e.message),
            "zero must point at the agent or its credential, not at the gate",
        );
    });
});
