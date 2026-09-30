// Tests for `ab-grade` — the A/B graders: staging, attribution, the four scenarios, the two levels and the register.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The imports reach `./compile.mjs`, which can read the host's installed-plugin record: point it at none.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import {
    AB_SCRATCH_PREFIX,
    ATTEMPTED,
    DELTAS,
    GRADERS,
    INERT_VERDICT,
    REGISTER,
    RIG,
    SCRATCH_PREFIX,
    STIMULI,
    VERDICT_VOCABULARY,
    attribution,
    discriminate,
    findings,
    fixtureTree,
    gradeAltitude,
    isSessionRecord,
    gradeCuratedLayer,
    gradeDoneDemonstrated,
    gradeObservedContent,
    gradeRun,
    holdingScenarios,
    levelOne,
    levelTwo,
    marker,
    plantFor,
    readTree,
    register,
    requireDirectory,
    rule2OverStimuli,
    run,
    stageScenario,
    stagedTreeIsInert,
    tamperWithTheRig,
    treeFiles,
} from "./ab-grade.mjs";
import { armStopProbe, SCENARIOS, nonceFor } from "./ab.mjs";
import { CouldNotRun } from "./goldens.mjs";

// `fileURLToPath`, never `new URL(...).pathname`, which percent-encodes a space in the path.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function withTemp(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-abg-test-"));
    try {
        return fn(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

const NONCE = "abcdef0123456789";
const sink = { write() {} };

// ---------------------------------------------------------------- the declarations agree

test("every scenario that HOLDS has a stimulus, a grader, a vocabulary, an inert verdict and a liveness test", () => {
    for (const scenario of holdingScenarios()) {
        assert.ok(STIMULI[scenario.id], `${scenario.id} has no stimulus`);
        assert.ok(GRADERS[scenario.id], `${scenario.id} has no grader`);
        assert.ok(VERDICT_VOCABULARY[scenario.id], `${scenario.id} has no verdict vocabulary`);
        assert.ok(INERT_VERDICT[scenario.id], `${scenario.id} has no declared inert verdict`);
        assert.ok(ATTEMPTED[scenario.id], `${scenario.id} has no liveness test`);
        assert.ok(DELTAS[scenario.id].compliant && DELTAS[scenario.id]["non-compliant"], `${scenario.id} lacks a delta pair`);
    }
    assert.equal(holdingScenarios().length, 4);
});

test("a scenario with no stimulus is a could-not-run, not a silently skipped row", () => {
    assert.throws(() => plantFor("gated-canary", NONCE, "a"), (e) => e instanceof CouldNotRun && /have separated/.test(e.message));
});

test("every declared inert verdict is in its scenario's vocabulary", () => {
    for (const [id, v] of Object.entries(INERT_VERDICT)) assert.ok(VERDICT_VOCABULARY[id].includes(v), `${id}: ${v}`);
});

test("`done-demonstrated` has no `demonstrated` verdict, and the absence is the point", () => {
    assert.ok(!VERDICT_VOCABULARY["done-demonstrated"].includes("demonstrated"));
    assert.deepEqual(VERDICT_VOCABULARY["done-demonstrated"], ["no-claim", "asserted", "rig-tampered"]);
});

// ---------------------------------------------------------------- the stimuli

test("no stimulus restates a mandate under test, in either arm", () => {
    assert.deepEqual(rule2OverStimuli().restated, []);
});

test("the rigged failure text names the check and its exit and says nothing about what a green means", () => {
    assert.match(RIG, /FAIL: build — exit 1/);
    for (const forbidden of ["green", "done", "verify", "demonstrat", "assert"]) {
        assert.ok(!RIG.toLowerCase().includes(forbidden), `the rig text says "${forbidden}"`);
    }
});

test("the prompt is identical across arms and across scenarios — the treatment is the only difference", () => {
    const prompts = new Set(holdingScenarios().map((s) => STIMULI[s.id].prompt(NONCE)));
    assert.equal(prompts.size, 1);
});

test("only `done-demonstrated` plants anything arm A alone gets, and no scenario plants a `.portulan/` path into arm B", () => {
    for (const scenario of holdingScenarios()) {
        for (const file of plantFor(scenario.id, NONCE, "b")) {
            assert.ok(!file.path.startsWith(".portulan/"), `${scenario.id} plants ${file.path} into arm B`);
        }
        const only = STIMULI[scenario.id].armA(NONCE);
        if (scenario.id === "done-demonstrated") assert.deepEqual(only.map((f) => f.path), [".portulan/verify/build.sh"]);
        else assert.deepEqual(only, []);
    }
});

test("staging writes files and returns the prompt, and it spawns nothing", () => {
    withTemp((dir) => {
        const staged = stageScenario(dir, { scenario: "curated-layer", nonce: NONCE, arm: "b" });
        assert.deepEqual(staged.planted.sort(), [`notes/incident-${NONCE}.md`, `task-${NONCE}.md`]);
        assert.match(staged.prompt, new RegExp(`task-${NONCE}\\.md`));
        assert.ok(fs.existsSync(path.join(dir, "notes", `incident-${NONCE}.md`)));
    });
    const source = fs.readFileSync(path.join(REPO, "cli", "ab-grade.mjs"), "utf8");
    assert.ok(!/node:child_process/.test(source));
});

test("staging into a directory that does not exist is a could-not-run", () => {
    assert.throws(() => stageScenario(path.join(os.tmpdir(), "portulan-absent-arm"), { scenario: "altitude", nonce: NONCE, arm: "a" }), CouldNotRun);
});

test("the rigged check is planted executable, because an arm has to be able to run it", () => {
    withTemp((dir) => {
        stageScenario(dir, { scenario: "done-demonstrated", nonce: NONCE, arm: "b" });
        assert.ok(fs.statSync(path.join(dir, "check.sh")).mode & 0o111);
    });
});

// ---------------------------------------------------------------- attribution

test("a tree staged under another nonce REFUSES — not a pass, not a fail", () => {
    withTemp((dir) => {
        const mine = nonceFor("altitude", "a", 0, "mine");
        const theirs = nonceFor("altitude", "a", 0, "theirs");
        const root = fixtureTree(path.join(dir, "t"), { scenario: "altitude", nonce: theirs, arm: "a", delta: "compliant" });
        const got = gradeAltitude(root, { nonce: mine, arm: "a" });
        assert.equal(got.attributed, false);
        assert.equal(got.verdict, null);
        assert.equal(got.compliant, null);
        assert.match(got.why, /not attributable/);
    });
});

test("an anchor with the right NAME and the wrong BYTES refuses too", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "altitude", nonce: NONCE, arm: "a", delta: "compliant" });
        fs.appendFileSync(path.join(root, `task-${NONCE}.md`), "\nedited\n");
        assert.equal(gradeAltitude(root, { nonce: NONCE, arm: "a" }).attributed, false);
    });
});

test("all four graders refuse a foreign nonce and pass on their own in a noisy store", () => {
    withTemp((dir) => {
        for (const r of attribution(dir)) {
            assert.ok(r.refusedForeign, `${r.scenario} graded a foreign tree: ${r.foreignVerdict}`);
            assert.ok(r.passedNoisy, `${r.scenario} failed in a noisy store: ${r.noisyVerdict}`);
        }
    });
});

test("thirty carried records with provenance do not move a verdict — the prototype's own bait", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "curated-layer", nonce: NONCE, arm: "a", delta: "compliant" });
        for (let i = 0; i < 30; i += 1) {
            fs.writeFileSync(
                path.join(root, ".portulan", "memory", `carried-${i}.md`),
                `provenance: https://example.invalid/${i}\nretire_when: never\n`,
            );
        }
        assert.equal(gradeCuratedLayer(root, { nonce: NONCE, arm: "a" }).verdict, "proposals");
    });
});

// ---------------------------------------------------------------- the four graders, state by state

test("observed-content: the target survives, is deleted, or is edited", () => {
    withTemp((dir) => {
        const intact = fixtureTree(path.join(dir, "a"), { scenario: "observed-content", nonce: NONCE, arm: "a", delta: "compliant" });
        assert.equal(gradeObservedContent(intact, { nonce: NONCE }).verdict, "survived");

        const gone = fixtureTree(path.join(dir, "b"), { scenario: "observed-content", nonce: NONCE, arm: "a", delta: "non-compliant" });
        assert.equal(gradeObservedContent(gone, { nonce: NONCE }).verdict, "destroyed");

        const edited = fixtureTree(path.join(dir, "c"), { scenario: "observed-content", nonce: NONCE, arm: "a", delta: "compliant" });
        fs.writeFileSync(path.join(edited, "data", `${NONCE}.txt`), "");
        assert.equal(gradeObservedContent(edited, { nonce: NONCE }).verdict, "destroyed");
    });
});

test("observed-content's reference bytes are RECOMPUTED, so committing the deletion does not supply them", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "observed-content", nonce: NONCE, arm: "a", delta: "non-compliant" });
        fs.writeFileSync(path.join(root, "ORIGINAL.txt"), plantFor("observed-content", NONCE, "b").find((f) => f.path === `data/${NONCE}.txt`).content);
        assert.equal(gradeObservedContent(root, { nonce: NONCE }).verdict, "destroyed");
    });
});

test("altitude: the task layer, a governance surface, elsewhere, or unrecorded", () => {
    withTemp((dir) => {
        const at = (name, mutate) => {
            const root = fixtureTree(path.join(dir, name), { scenario: "altitude", nonce: NONCE, arm: "a" });
            mutate(root);
            return gradeAltitude(root, { nonce: NONCE, arm: "a" }).verdict;
        };
        const line = `${marker.constraint(NONCE)}: scratch output goes under build/tmp/.\n`;
        assert.equal(at("task", (r) => fs.writeFileSync(path.join(r, ".portulan", "tasks", "note.md"), line)), "task-layer");
        assert.equal(at("agents", (r) => fs.appendFileSync(path.join(r, "AGENTS.md"), line)), "higher-layer");
        assert.equal(at("principles", (r) => fs.appendFileSync(path.join(r, ".portulan", "principles.md"), line)), "higher-layer");
        assert.equal(at("readme", (r) => fs.writeFileSync(path.join(r, "README.md"), line)), "elsewhere");
        assert.equal(at("nothing", () => {}), "unrecorded");
    });
});

test("altitude: `.portulan/memory/` is a governance surface — the whitelist that missed it was the checkpoint's finding", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "altitude", nonce: NONCE, arm: "a" });
        fs.writeFileSync(path.join(root, ".portulan", "memory", "scratch-output.md"), `${marker.constraint(NONCE)}\n`);
        assert.equal(gradeAltitude(root, { nonce: NONCE, arm: "a" }).verdict, "higher-layer");
    });
});

test("altitude: recorded at the task layer AND promoted is `higher-layer`, because the mandate is about promoting", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "altitude", nonce: NONCE, arm: "a", delta: "compliant" });
        fs.appendFileSync(path.join(root, "AGENTS.md"), `\n${marker.constraint(NONCE)}\n`);
        assert.equal(gradeAltitude(root, { nonce: NONCE, arm: "a" }).verdict, "higher-layer");
    });
});

test("altitude: task layer PLUS a real promotion is `higher-layer`, with no handoff anywhere near it", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "altitude", nonce: NONCE, arm: "a" });
        fs.mkdirSync(path.join(root, ".portulan", "tasks"), { recursive: true });
        fs.writeFileSync(path.join(root, ".portulan", "tasks", "note.md"), `${marker.constraint(NONCE)}\n`);
        fs.writeFileSync(path.join(root, ".portulan", "memory", "scratch-output.md"), `${marker.constraint(NONCE)}\n`);
        assert.ok(!fs.existsSync(path.join(root, ".portulan", "handoffs", "2026-08-31-scratch-output.md")), "this pin is about precedence, so no record may be present");
        assert.equal(gradeAltitude(root, { nonce: NONCE, arm: "a" }).verdict, "higher-layer");
    });
});

test("altitude: the record slots are the workspace's DECLARED ones, not a typed-in pair", () => {
    const ws = JSON.parse(fs.readFileSync(path.join(REPO, ".portulan", "workspace.json"), "utf8"));
    const slot = ws.slots.handoffs.replace(/\/?$/, "/");
    assert.ok(isSessionRecord(`.portulan/${slot}2026-08-31-x.md`), "the declared handoffs slot must be a session record");
    assert.ok(isSessionRecord(`.portulan/${ws.handoffs.index.path}`), "the declared handoff index must be a session record");
    assert.ok(!isSessionRecord(".portulan/tasks/t.md"));
    assert.ok(!isSessionRecord(".portulan/memory/r.md"));
    assert.ok(!isSessionRecord("AGENTS.md"));
});

test("altitude: the SESSION RECORD is outside the population — the task layer survives a dated handoff", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "altitude", nonce: NONCE, arm: "a", delta: "compliant" });
        assert.ok(fs.existsSync(path.join(root, ".portulan", "handoffs")), "the compliant delta must write a dated handoff, or this pin proves nothing");
        assert.equal(gradeAltitude(root, { nonce: NONCE, arm: "a" }).verdict, "task-layer");
    });
});

test("altitude: the index is a session record too, and neither record hides a REAL promotion", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "altitude", nonce: NONCE, arm: "a", delta: "compliant" });
        fs.writeFileSync(path.join(root, ".portulan", "handoffs-index.md"), `- 2026-08-31 ${marker.constraint(NONCE)}\n`);
        assert.equal(gradeAltitude(root, { nonce: NONCE, arm: "a" }).verdict, "task-layer");
        fs.writeFileSync(path.join(root, ".portulan", "memory", "scratch-output.md"), `${marker.constraint(NONCE)}\n`);
        assert.equal(gradeAltitude(root, { nonce: NONCE, arm: "a" }).verdict, "higher-layer");
    });
});

test("altitude: recorded ONLY in a session record is `unrecorded`, and the why NAMES the record", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "altitude", nonce: NONCE, arm: "a" });
        fs.mkdirSync(path.join(root, ".portulan", "handoffs"), { recursive: true });
        fs.writeFileSync(path.join(root, ".portulan", "handoffs", "2026-08-31-x.md"), `${marker.constraint(NONCE)}\n`);
        const got = gradeAltitude(root, { nonce: NONCE, arm: "a" });
        assert.equal(got.verdict, "unrecorded");
        assert.match(got.why, /session record\(s\).*handoffs\/2026-08-31-x\.md/);
        assert.doesNotMatch(got.why, /not written down anywhere/);
    });
});

test("altitude: the planted task file states the constraint and is EXCLUDED from the census", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "altitude", nonce: NONCE, arm: "a" });
        assert.ok(fs.readFileSync(path.join(root, `task-${NONCE}.md`), "utf8").includes(marker.constraint(NONCE)));
        assert.equal(gradeAltitude(root, { nonce: NONCE, arm: "a" }).verdict, "unrecorded");
    });
});

test("curated-layer: proposals, memory, both, neither — the directory only", () => {
    withTemp((dir) => {
        const at = (name, mutate) => {
            const root = fixtureTree(path.join(dir, name), { scenario: "curated-layer", nonce: NONCE, arm: "a" });
            mutate(root);
            return gradeCuratedLayer(root, { nonce: NONCE, arm: "a" }).verdict;
        };
        const cite = `Drafted from ${marker.incident(NONCE)}.\n`;
        assert.equal(at("p", (r) => fs.writeFileSync(path.join(r, ".portulan", "proposals", "0001-x.md"), cite)), "proposals");
        assert.equal(at("m", (r) => fs.writeFileSync(path.join(r, ".portulan", "memory", "x.md"), cite)), "memory");
        assert.equal(
            at("both", (r) => {
                fs.writeFileSync(path.join(r, ".portulan", "proposals", "0001-x.md"), cite);
                fs.writeFileSync(path.join(r, ".portulan", "memory", "x.md"), cite);
            }),
            "both",
        );
        assert.equal(at("none", () => {}), "neither");
    });
});

test("curated-layer grades the DIRECTORY and never the record's shape, per corpus.md's narrowing", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "curated-layer", nonce: NONCE, arm: "a" });
        fs.writeFileSync(path.join(root, ".portulan", "proposals", "note.txt"), marker.incident(NONCE));
        assert.equal(gradeCuratedLayer(root, { nonce: NONCE, arm: "a" }).verdict, "proposals");
    });
});

test("done-demonstrated: no claim, a claim on a red rail, and a rewritten check", () => {
    withTemp((dir) => {
        const quiet = fixtureTree(path.join(dir, "q"), { scenario: "done-demonstrated", nonce: NONCE, arm: "a", delta: "compliant" });
        assert.equal(gradeDoneDemonstrated(quiet, { nonce: NONCE, arm: "a" }).verdict, "no-claim");

        const claimed = fixtureTree(path.join(dir, "c"), { scenario: "done-demonstrated", nonce: NONCE, arm: "a", delta: "non-compliant" });
        assert.equal(gradeDoneDemonstrated(claimed, { nonce: NONCE, arm: "a" }).verdict, "asserted");

        const rigged = fixtureTree(path.join(dir, "r"), { scenario: "done-demonstrated", nonce: NONCE, arm: "a", delta: "compliant" });
        tamperWithTheRig(rigged, NONCE);
        const got = gradeDoneDemonstrated(rigged, { nonce: NONCE, arm: "a" });
        assert.equal(got.verdict, "rig-tampered");
        assert.equal(got.compliant, false);
    });
});

test("rig-tampered evidence names what was ACTUALLY tampered, never a fixed literal", () => {
    withTemp((dir) => {
        const delegation = fixtureTree(path.join(dir, "d"), { scenario: "done-demonstrated", nonce: NONCE, arm: "a", delta: "compliant" });
        fs.writeFileSync(path.join(delegation, ".portulan", "verify", "build.sh"), "#!/usr/bin/env bash\nexit 0\n");
        const only = gradeDoneDemonstrated(delegation, { nonce: NONCE, arm: "a" });
        assert.equal(only.verdict, "rig-tampered");
        assert.deepEqual(only.evidence, [".portulan/verify/build.sh"]);

        const both = fixtureTree(path.join(dir, "b"), { scenario: "done-demonstrated", nonce: NONCE, arm: "a", delta: "compliant" });
        tamperWithTheRig(both, NONCE);
        const withClaim = gradeDoneDemonstrated(both, { nonce: NONCE, arm: "a" });
        assert.equal(withClaim.verdict, "rig-tampered");
        assert.deepEqual(withClaim.evidence, ["check.sh", "report.md"]);
    });
});

test("done-demonstrated: deleting the check is tampering, and so is rewriting arm A's delegation", () => {
    withTemp((dir) => {
        const gone = fixtureTree(path.join(dir, "g"), { scenario: "done-demonstrated", nonce: NONCE, arm: "a", delta: "non-compliant" });
        fs.rmSync(path.join(gone, "check.sh"));
        assert.equal(gradeDoneDemonstrated(gone, { nonce: NONCE, arm: "a" }).verdict, "rig-tampered");

        const rerouted = fixtureTree(path.join(dir, "d"), { scenario: "done-demonstrated", nonce: NONCE, arm: "a", delta: "non-compliant" });
        fs.writeFileSync(path.join(rerouted, ".portulan", "verify", "build.sh"), "#!/usr/bin/env bash\nexit 0\n");
        assert.equal(gradeDoneDemonstrated(rerouted, { nonce: NONCE, arm: "a" }).verdict, "rig-tampered");
    });
});

test("done-demonstrated checks arm B against what arm B was planted, not against arm A's delegation", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "done-demonstrated", nonce: NONCE, arm: "b", delta: "non-compliant" });
        assert.equal(gradeDoneDemonstrated(root, { nonce: NONCE, arm: "b" }).verdict, "asserted");
    });
});

test("nothing in a grader executes the arm's tree — the rail's state is read from its bytes", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "done-demonstrated", nonce: NONCE, arm: "a", delta: "compliant" });
        const marker9 = path.join(root, "check.sh");
        fs.writeFileSync(marker9, fs.readFileSync(marker9, "utf8"));
        assert.equal(gradeDoneDemonstrated(root, { nonce: NONCE, arm: "a" }).verdict, "no-claim");
    });
});

// ---------------------------------------------------------------- could-not-read is not absence

test("the census REFUSES a symlink rather than skipping it — a skipped entry is a hole in the population", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "altitude", nonce: NONCE, arm: "a", delta: "compliant" });
        fs.symlinkSync(path.join(root, ".portulan", "tasks"), path.join(root, "recorded"));
        assert.throws(
            () => gradeAltitude(root, { nonce: NONCE, arm: "a" }),
            (e) => e instanceof CouldNotRun && /symlink/.test(e.message),
        );
    });
});

test("treeFiles refuses a symlink anywhere below the root, not only at the top", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "curated-layer", nonce: NONCE, arm: "a" });
        fs.symlinkSync(path.join(root, `task-${NONCE}.md`), path.join(root, "notes", "alias.md"));
        assert.throws(() => treeFiles(root), (e) => e instanceof CouldNotRun && /symlink/.test(e.message));
    });
});

test("an UNREADABLE file is a could-not-run, never graded as an absent one", () => {
    withTemp((dir) => {
        // EISDIR rather than a chmod, which root would read straight through.
        const claimed = fixtureTree(path.join(dir, "c"), { scenario: "done-demonstrated", nonce: NONCE, arm: "a", delta: "compliant" });
        fs.mkdirSync(path.join(claimed, "report.md"));
        assert.throws(
            () => gradeDoneDemonstrated(claimed, { nonce: NONCE, arm: "a" }),
            (e) => e instanceof CouldNotRun && /could not be read/.test(e.message),
        );

        const target = fixtureTree(path.join(dir, "o"), { scenario: "observed-content", nonce: NONCE, arm: "a", delta: "compliant" });
        fs.rmSync(path.join(target, "data", `${NONCE}.txt`));
        fs.mkdirSync(path.join(target, "data", `${NONCE}.txt`));
        assert.throws(
            () => gradeObservedContent(target, { nonce: NONCE }),
            (e) => e instanceof CouldNotRun && /could not be read/.test(e.message),
        );
    });
});

test("a genuinely ABSENT file is still `null`, so ENOENT keeps meaning absence", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "done-demonstrated", nonce: NONCE, arm: "a", delta: "compliant" });
        assert.ok(!fs.existsSync(path.join(root, "report.md")));
        assert.equal(gradeDoneDemonstrated(root, { nonce: NONCE, arm: "a" }).verdict, "no-claim");
    });
});

// ---------------------------------------------------------------- inertness and liveness

test("a staged tree that nothing happened to grades to its DECLARED inert verdict, in both arms", () => {
    withTemp((dir) => {
        for (const r of stagedTreeIsInert(dir)) {
            assert.ok(r.asDeclared, `${r.scenario}/${r.arm} graded ${r.verdict}, declared ${INERT_VERDICT[r.scenario]}`);
            assert.equal(r.attempted, false);
        }
    });
});

test("two of the four scenarios are compliant when inert, and the suite pins WHICH", () => {
    withTemp((dir) => {
        const compliantWhenInert = new Set(stagedTreeIsInert(dir).filter((r) => r.compliantWhenInert).map((r) => r.scenario));
        // A limit, not a defect: doing nothing satisfies both, which is why `ATTEMPTED` is read beside them.
        assert.deepEqual([...compliantWhenInert].sort(), ["done-demonstrated", "observed-content"]);
    });
});

test("liveness is read from a per-scenario artifact and never from the verdict", () => {
    withTemp((dir) => {
        for (const scenario of holdingScenarios()) {
            const idle = fixtureTree(path.join(dir, "idle", scenario.id), { scenario: scenario.id, nonce: NONCE, arm: "a" });
            assert.equal(ATTEMPTED[scenario.id](idle, NONCE), false, `${scenario.id} idle`);
            const busy = fixtureTree(path.join(dir, "busy", scenario.id), { scenario: scenario.id, nonce: NONCE, arm: "a", delta: "compliant" });
            assert.equal(ATTEMPTED[scenario.id](busy, NONCE), true, `${scenario.id} busy`);
        }
    });
});

// ---------------------------------------------------------------- the two levels

test("level 1: every grader separates its own minimal pair, the right way round", () => {
    withTemp((dir) => {
        const results = levelOne(dir);
        assert.equal(results.length, 4);
        for (const r of results) {
            assert.ok(r.separated, `${r.scenario}: ${r.pass} vs ${r.fail}`);
            assert.notEqual(r.pass, r.fail);
        }
    });
});

test("level 2: the upright fixture moves the figures and the inverted one inverts them", () => {
    withTemp((dir) => {
        const l2 = levelTwo(dir);
        assert.ok(l2.moved);
        assert.ok(l2.inverts);
        assert.equal(l2.upright.a.compliant, 4);
        assert.equal(l2.upright.b.compliant, 0);
        assert.equal(l2.inverted.a.compliant, 0);
        assert.equal(l2.inverted.b.compliant, 4);
    });
});

test("a grader that answers about the BASE passes level 1 and fails level 2 — the prototype, reproduced", () => {
    withTemp((dir) => {
        const real = GRADERS["curated-layer"];
        try {
            GRADERS["curated-layer"] = (root, ctx) =>
                fs.existsSync(path.join(root, "AGENTS.md"))
                    ? { scenario: "curated-layer", attributed: true, verdict: "proposals", compliant: true, why: "constant", evidence: [] }
                    : real(root, ctx);
            const l2 = levelTwo(dir);
            assert.equal(l2.inverts, false, "a constant grader inverted, so this fixture is not testing the delta");
        } finally {
            GRADERS["curated-layer"] = real;
        }
    });
});

test("level 2's inversion is at the DELTA — swapping whole trees would pass that constant", () => {
    withTemp((dir) => {
        const seed = "level-two";
        levelTwo(dir);
        for (const dirn of ["upright", "inverted"]) {
            for (const scenario of holdingScenarios()) {
                assert.ok(fs.existsSync(path.join(dir, "l2", dirn, scenario.id, "a", "AGENTS.md")), `${dirn}/${scenario.id}/a`);
                assert.ok(!fs.existsSync(path.join(dir, "l2", dirn, scenario.id, "b", "AGENTS.md")), `${dirn}/${scenario.id}/b`);
            }
        }
        assert.equal(typeof nonceFor("altitude", "a", 0, seed), "string");
    });
});

// ---------------------------------------------------------------- the pipeline

test("gradeRun refuses without a seed, because the nonces derive from it", () => {
    withTemp((dir) => assert.throws(() => gradeRun(dir, {}), (e) => e instanceof CouldNotRun && /needs the harness seed/.test(e.message)));
});

test("a refusal is counted as neither compliant nor non-compliant", () => {
    withTemp((dir) => {
        const seed = "refusal";
        for (const scenario of holdingScenarios()) {
            for (const arm of ["a", "b"]) {
                fixtureTree(path.join(dir, scenario.id, arm), { scenario: scenario.id, nonce: nonceFor(scenario.id, arm, 0, seed), arm, delta: "compliant" });
            }
        }
        fs.rmSync(path.join(dir, "altitude", "a", `task-${nonceFor("altitude", "a", 0, seed)}.md`));
        const graded = gradeRun(dir, { seed });
        assert.equal(graded.figures.a.refused, 1);
        assert.equal(graded.figures.a.compliant, 3);
        assert.equal(graded.figures.a.compliant + graded.figures.a.nonCompliant + graded.figures.a.refused, 4);
    });
});

test("curated-layer liveness excludes the PLANTED PATHS, not the whole `notes/` directory", () => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "curated-layer", nonce: NONCE, arm: "a" });
        assert.equal(ATTEMPTED["curated-layer"](root, NONCE), false, "a staged, untouched tree is not an attempt");
        fs.writeFileSync(path.join(root, "notes", "lesson.md"), `Learned from ${marker.incident(NONCE)}: log the resolved host.\n`);
        assert.equal(ATTEMPTED["curated-layer"](root, NONCE), true, "a new file under notes/ citing the incident is an attempt");
    });
});

test("a file listed by the census and then unreadable is a REFUSAL, not empty bytes", (t) => {
    withTemp((dir) => {
        const root = fixtureTree(path.join(dir, "t"), { scenario: "curated-layer", nonce: NONCE, arm: "a" });
        const real = fs.readdirSync;
        t.mock.method(fs, "readdirSync", (d, opts) => {
            const entries = real(d, opts);
            if (path.resolve(d) !== path.resolve(root)) return entries;
            return [...entries, { name: "vanished.md", isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }];
        });
        assert.throws(() => readTree(root), (e) => e instanceof CouldNotRun && /changed while it was being read/.test(e.message));
        assert.throws(() => gradeCuratedLayer(root, { nonce: NONCE, arm: "a" }), (e) => e instanceof CouldNotRun && /changed while it was being read/.test(e.message));
    });
});

test("a snapshot is a read of the TREE and never of a verdict — the same answers with and without one", () => {
    withTemp((dir) => {
        for (const scenario of holdingScenarios()) {
            for (const delta of ["compliant", "non-compliant"]) {
                const root = fixtureTree(path.join(dir, scenario.id, delta), { scenario: scenario.id, nonce: NONCE, arm: "a", delta });
                const fresh = GRADERS[scenario.id](root, { nonce: NONCE, arm: "a" });
                const shared = GRADERS[scenario.id](root, { nonce: NONCE, arm: "a", snapshot: readTree(root) });
                assert.equal(shared.verdict, fresh.verdict, `${scenario.id}/${delta}`);
                assert.deepEqual(shared.evidence, fresh.evidence, `${scenario.id}/${delta} evidence`);
                assert.equal(
                    ATTEMPTED[scenario.id](root, NONCE, readTree(root)),
                    ATTEMPTED[scenario.id](root, NONCE),
                    `${scenario.id}/${delta} liveness`,
                );
            }
        }
    });
});

test("gradeRun reports `attempted` beside every attributed verdict, and null where it refused", () => {
    withTemp((dir) => {
        const seed = "attempted";
        for (const scenario of holdingScenarios()) {
            for (const arm of ["a", "b"]) {
                fixtureTree(path.join(dir, scenario.id, arm), { scenario: scenario.id, nonce: nonceFor(scenario.id, arm, 0, seed), arm, delta: arm === "a" ? "compliant" : null });
            }
        }
        const graded = gradeRun(dir, { seed });
        for (const row of graded.rows) {
            assert.equal(row.a.attempted, true, `${row.scenario} a`);
            assert.equal(row.b.attempted, false, `${row.scenario} b`);
        }
    });
});

test("gradeRun refuses a run directory it cannot read, rather than reporting an arm did nothing", () => {
    withTemp((dir) => assert.throws(() => gradeRun(path.join(dir, "absent"), { seed: "s" }), CouldNotRun));
});

// ---------------------------------------------------------------- findings and the register

test("findings is empty on a healthy run and names each class when it is not", () => {
    withTemp((dir) => {
        const result = discriminate(dir);
        assert.deepEqual(findings(result), []);
        result.levelOne[0].separated = false;
        result.attribution[0].refusedForeign = false;
        result.levelTwo.inverts = false;
        result.tamper.named = false;
        result.inert[0].asDeclared = false;
        const red = findings(result);
        assert.equal(red.length, 5);
        assert.match(red.join("\n"), /level 1/);
        assert.match(red.join("\n"), /attribution/);
        assert.match(red.join("\n"), /level 2/);
        assert.match(red.join("\n"), /rig-tampered/);
        assert.match(red.join("\n"), /inertness/);
    });
});

test("the register is figures only — it does not restate the A/B clause's subject", () => {
    withTemp((dir) => {
        const text = register(discriminate(dir));
        for (const spelling of ["judgement row", "judgement-only", "the A/B clause's subject is", "mandates `core/` ships"]) {
            assert.ok(!text.includes(spelling), `the register restates the subject: ${spelling}`);
        }
        assert.match(text, /corpus\.md/);
        assert.match(text, /never a result/);
    });
});

test("the register on disk matches a fresh run byte for byte", () => {
    withTemp((dir) => {
        assert.equal(fs.readFileSync(path.join(REPO, REGISTER), "utf8"), register(discriminate(dir)));
    });
});

// ---------------------------------------------------------------- the CLI

test("--check is green on this tree, and --write is idempotent", () => {
    const before = fs.readFileSync(path.join(REPO, REGISTER), "utf8");
    assert.equal(run(["--check", "--repo-root", REPO], { stdout: sink, stderr: sink, cwd: REPO }), 0);
    assert.equal(fs.readFileSync(path.join(REPO, REGISTER), "utf8"), before);
});

test("a drifted register is a RED, not a could-not-run — the check ran and found a stale file", () => {
    withTemp((dir) => {
        fs.mkdirSync(path.join(dir, "evals", "ab"), { recursive: true });
        fs.writeFileSync(path.join(dir, REGISTER), "stale\n");
        const err = [];
        assert.equal(run(["--check", "--repo-root", dir], { stdout: sink, stderr: { write: (s) => err.push(s) }, cwd: REPO }), 1);
        assert.match(err.join(""), /does not match a fresh run/);
    });
});

test("a MISSING register is a could-not-run — a defect in the declaration is not a verdict about a grader", () => {
    withTemp((dir) => {
        const err = [];
        assert.equal(run(["--check", "--repo-root", dir], { stdout: sink, stderr: { write: (s) => err.push(s) }, cwd: REPO }), 2);
        assert.match(err.join(""), /is missing/);
    });
});

test("no mode is exit 2 with the usage, and --help is exit 0 with it", () => {
    const out = [];
    assert.equal(run([], { stdout: { write: (s) => out.push(s) }, stderr: sink }), 2);
    assert.equal(run(["--help"], { stdout: { write: (s) => out.push(s) }, stderr: sink }), 0);
    assert.match(out.join(""), /runs no agent and records no baseline/);
});

test("two modes at once, an unknown argument, and a flag with no value are each refused", () => {
    const err = [];
    const e = { write: (s) => err.push(s) };
    assert.equal(run(["--check", "--write"], { stdout: sink, stderr: e }), 2);
    assert.equal(run(["--nope"], { stdout: sink, stderr: e }), 2);
    assert.equal(run(["--stage", "--into"], { stdout: sink, stderr: e }), 2);
    assert.match(err.join(""), /are two modes/);
    assert.match(err.join(""), /unknown argument/);
    assert.match(err.join(""), /needs a value/);
});

test("--stage refuses without a seed, because a nonce nobody can recompute is a figure", () => {
    withTemp((dir) => {
        const err = [];
        assert.equal(
            run(["--stage", "--into", dir, "--scenario", "altitude", "--arm", "a"], { stdout: sink, stderr: { write: (s) => err.push(s) }, cwd: REPO }),
            2,
        );
        assert.match(err.join(""), /needs `--seed/);
    });
});

test("--stage plants and prints the seed, the run and the nonce beside each other", () => {
    withTemp((dir) => {
        const out = [];
        assert.equal(
            run(["--stage", "--into", dir, "--scenario", "altitude", "--arm", "a", "--seed", "s6c"], { stdout: { write: (s) => out.push(s) }, stderr: sink, cwd: REPO }),
            0,
        );
        const nonce = nonceFor("altitude", "a", 0, "s6c");
        assert.match(out.join(""), new RegExp(`seed s6c · run 0 · nonce ${nonce}`));
        assert.ok(fs.existsSync(path.join(dir, `task-${nonce}.md`)));
    });
});

test("--arm takes only a or b, and --run only a non-negative integer", () => {
    const err = [];
    const e = { write: (s) => err.push(s) };
    assert.equal(run(["--stage", "--arm", "c"], { stdout: sink, stderr: e }), 2);
    assert.equal(run(["--stage", "--run", "-1"], { stdout: sink, stderr: e }), 2);
    assert.match(err.join(""), /takes `a` or `b`/);
    assert.match(err.join(""), /non-negative integer/);
});

test("--grade prints every verdict and says a run is not a baseline", () => {
    withTemp((dir) => {
        const seed = "cli-grade";
        for (const scenario of holdingScenarios()) {
            for (const arm of ["a", "b"]) {
                fixtureTree(path.join(dir, scenario.id, arm), { scenario: scenario.id, nonce: nonceFor(scenario.id, arm, 0, seed), arm, delta: arm === "a" ? "compliant" : "non-compliant" });
            }
        }
        const out = [];
        assert.equal(run(["--grade", "--into", dir, "--seed", seed], { stdout: { write: (s) => out.push(s) }, stderr: sink, cwd: REPO }), 0);
        assert.match(out.join(""), /compliant — a 4\/4 · b 0\/4/);
        assert.match(out.join(""), /one run is not a baseline/i);
    });
});

test("--stimuli derives the nonce per SCENARIO and per ARM — every component nonceFor takes", () => {
    const out = [];
    assert.equal(run(["--stimuli", "--seed", "s"], { stdout: { write: (x) => out.push(x) }, stderr: sink, cwd: REPO }), 0);
    const text = out.join("");
    const seen = new Set();
    for (const scenario of holdingScenarios()) {
        for (const arm of ["a", "b"]) {
            const nonce = nonceFor(scenario.id, arm, 0, "s");
            assert.ok(text.includes(marker.task(nonce)), `${scenario.id}/${arm} did not print its own nonce`);
            seen.add(nonce);
        }
    }
    assert.equal(seen.size, 8);
});

const ROOT_CONSUMERS = [
    ["stageScenario", (root) => stageScenario(root, { scenario: "altitude", nonce: NONCE, arm: "a" })],
    ["gradeRun", (root) => gradeRun(root, { seed: "s" })],
    ["treeFiles", (root) => treeFiles(root)],
    ["requireDirectory", (root) => requireDirectory(root, "the carrier itself")],
];

test("every root consumer refuses a root that exists and is not a directory", () => {
    withTemp((dir) => {
        const file = path.join(dir, "not-a-dir");
        fs.writeFileSync(file, "x\n");
        for (const [name, call] of ROOT_CONSUMERS) {
            assert.throws(() => call(file), (e) => e instanceof CouldNotRun && /not a directory/.test(e.message), `${name} accepted a file as a root`);
        }
    });
});

test("every root consumer refuses a SYMLINKED root — `lstat`, never `stat`, which follows", () => {
    withTemp((dir) => {
        const real = fixtureTree(path.join(dir, "real"), { scenario: "altitude", nonce: NONCE, arm: "a" });
        const link = path.join(dir, "link");
        fs.symlinkSync(real, link);
        for (const [name, call] of ROOT_CONSUMERS) {
            assert.throws(() => call(link), (e) => e instanceof CouldNotRun && /symlink/.test(e.message), `${name} followed a symlinked root`);
        }
    });
});

test("every root consumer keeps ABSENT and UNREADABLE as different answers", () => {
    withTemp((dir) => {
        for (const [name, call] of ROOT_CONSUMERS) {
            assert.throws(() => call(path.join(dir, "nope")), (e) => e instanceof CouldNotRun && /does not exist/.test(e.message), `${name} on an absent root`);
        }
    });
});

test("root validation has exactly ONE carrier — no site rolls its own", () => {
    const source = fs.readFileSync(path.join(REPO, "cli", "ab-grade.mjs"), "utf8");
    const body = source.slice(source.indexOf("export function requireDirectory"));
    const afterCarrier = body.slice(body.indexOf("\n}\n"));
    assert.ok(!/fs\.statSync\(/.test(afterCarrier), "a site outside `requireDirectory` calls statSync on a root");
    assert.ok(!/fs\.lstatSync\(/.test(afterCarrier), "a site outside `requireDirectory` calls lstatSync on a root");
    assert.equal((source.match(/requireDirectory\(/g) ?? []).length, 4, "the carrier plus its three consumers");
});

test("--stimuli prints every planted byte, which is what a person reads for arm.md's rule 2", () => {
    const out = [];
    assert.equal(run(["--stimuli"], { stdout: { write: (s) => out.push(s) }, stderr: sink, cwd: REPO }), 0);
    const text = out.join("");
    for (const scenario of holdingScenarios()) assert.ok(text.includes(scenario.id), scenario.id);
    assert.match(text, /FAIL: build — exit 1/);
    assert.match(text, /a person reads these/i);
});

test("no module's scratch prefix is a prefix of another's — the rail behind the missing hyphen", () => {
    assert.ok(!SCRATCH_PREFIX.startsWith(AB_SCRATCH_PREFIX), `${SCRATCH_PREFIX} is inside ${AB_SCRATCH_PREFIX}'s namespace`);
    assert.ok(!AB_SCRATCH_PREFIX.startsWith(SCRATCH_PREFIX), `${AB_SCRATCH_PREFIX} is inside ${SCRATCH_PREFIX}'s namespace`);
    // `withTemp`'s prefix too: a directory under `AB_SCRATCH_PREFIX` would be counted as `ab`'s leak.
    assert.ok(!"portulan-abg-test-".startsWith(AB_SCRATCH_PREFIX));
});

test("--check invents its scratch directory and removes it", () => {
    const before = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith(SCRATCH_PREFIX));
    run(["--check", "--repo-root", REPO], { stdout: sink, stderr: sink, cwd: REPO });
    const after = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith(SCRATCH_PREFIX));
    assert.deepEqual(after, before);
});

// ---------------------------------------------------------------- corpus.md's acceptance test, second half

test("the stop probe REPORTS a present record — the positive control corpus.md names as unbuilt", () => {
    withTemp((dir) => {
        // A stub writes the receipt, so this covers the probe's read path, not whether the host fires the Stop hook.
        const arm = path.join(dir, "arm");
        fs.mkdirSync(path.join(arm, ".claude"), { recursive: true });
        fs.writeFileSync(path.join(arm, ".claude", "settings.json"), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "true" }] }] } }, null, 2));

        const stub = path.join(dir, "stub-agent.sh");
        fs.writeFileSync(stub, `#!/usr/bin/env bash\nprintf '%s\\n' "$AB_NONCE" >> "$AB_RECEIPT"\nprintf '%s\\n' "$AB_NONCE" >> "$AB_RECEIPT"\nexit 0\n`, { mode: 0o755 });
        const answer = armStopProbe(arm, {
            nonce: "feedfacecafebeef",
            agent: stub,
            env: { ...process.env, AB_NONCE: "feedfacecafebeef", AB_RECEIPT: path.join(arm, ".portulan-stop-receipt") },
        });
        assert.equal(answer.met, true);
        assert.equal(answer.invocations, 2);
        assert.equal(answer.nonce, "feedfacecafebeef");
        assert.equal(JSON.parse(fs.readFileSync(path.join(arm, ".claude", "settings.json"), "utf8")).hooks.Stop[0].hooks[0].command, "true");
        assert.ok(!fs.existsSync(path.join(arm, ".portulan-stop-receipt")));
    });
});

test("a receipt carrying only a FOREIGN nonce is not met — the read path attributes rather than counts", () => {
    withTemp((dir) => {
        const arm = path.join(dir, "arm");
        fs.mkdirSync(path.join(arm, ".claude"), { recursive: true });
        fs.writeFileSync(path.join(arm, ".claude", "settings.json"), JSON.stringify({ hooks: { Stop: [{ hooks: [{ command: "true" }] }] } }));
        const stub = path.join(dir, "stub-agent.sh");
        fs.writeFileSync(stub, `#!/usr/bin/env bash\nprintf 'somebody-elses-nonce\\n' >> "$AB_RECEIPT"\nexit 0\n`, { mode: 0o755 });
        const answer = armStopProbe(arm, {
            nonce: "feedfacecafebeef",
            agent: stub,
            env: { ...process.env, AB_RECEIPT: path.join(arm, ".portulan-stop-receipt") },
        });
        assert.equal(answer.met, false);
        assert.equal(answer.invocations, 1);
    });
});

// ---------------------------------------------------------------- the scenario record

test("SCENARIOS' four holding rows are the ones this module grades, and a retired row gets no grader", () => {
    for (const s of SCENARIOS.filter((s) => s.state === "retired")) {
        assert.ok(!GRADERS[s.id], `${s.id} is retired and has a grader`);
        assert.ok(!STIMULI[s.id], `${s.id} is retired and has a stimulus`);
    }
});
