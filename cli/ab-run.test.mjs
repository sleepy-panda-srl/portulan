// The A/B runner's suite. Every case exists because something here has already been wrong in that way,
// or because the session-open checkpoint named the way it would be.
//
// The traps:
//   * **no case runs a real agent.** `.portulan/verify/tests.sh` runs this suite, and a test spawning
//     `claude` would put agent turns — and a token — inside a verify recipe. `runTurn` takes its agent
//     as a parameter, so a stub script stands in, exactly as `ab.test.mjs` does for the stop probe
//   * a baseline may never be recorded under an unisolated arm. There is no `--operator-env` flag at
//     all, and passing one is a refusal rather than a silently ignored argument
//   * `did-not-complete`, `could-not-attribute` and `non-compliant` are three different facts, and the
//     four states must be TOTAL over k — a rate over an incomplete cell is a rate about something else
//   * the compliant verdict is imported from `ab-grade.mjs`, never re-typed: two carriers of which
//     verdict counts as compliance is the defect this milestone met at every level
//   * the register is rendered from the snapshot and byte-compared through this module's own renderer,
//     so a published figure cannot drift from its own data

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A HERMETIC HOST, the three-line block `pinned-roots.live.test.mjs` sweeps for — asserted WHOLE, so
// that copying the two lines which neutralise the host and dropping the one that tidies up is caught.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import {
    BRANCH_READ,
    CREDENTIAL_VARS,
    INVOCATION,
    K,
    LIMITATIONS,
    PERMITTED_ABSENT,
    REGISTER,
    SNAPSHOT,
    TRUNCATION_MARKER,
    aggregate,
    agentVersion,
    credentialChannel,
    dissolvesTheTreatment,
    limitationsFor,
    publishMatrix,
    journalPath,
    readJournal,
    renderRegister,
    run,
    runTurn,
    seedOperator,
    turnIds,
    verify,
    verifyShape,
} from "./ab-run.mjs";
import { COMPLIANT_VERDICT, holdingScenarios } from "./ab-grade.mjs";
import { nonceFor } from "./ab.mjs";
import { CouldNotRun } from "./goldens.mjs";

// `fileURLToPath`, never `new URL(...).pathname` — the latter percent-encodes and this working copy
// sits under a path containing a space.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sink = { write() {} };

function withTemp(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-abrun-test-"));
    try {
        return fn(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

/** A stub standing in for `claude`. It is a script, so `runTurn` spawns something real and grades nothing. */
function stubAgent(dir, { exit = 0, body = "" } = {}) {
    const p = path.join(dir, `stub-${exit}-${Math.abs(body.length)}.sh`);
    fs.writeFileSync(p, `#!/usr/bin/env bash\n${body}\nexit ${exit}\n`, { mode: 0o755 });
    return p;
}

/** A synthetic snapshot whose turns fold cleanly, so a case can perturb exactly one thing. */
function snapshotFixture({ k = K, seed = "fixture" } = {}) {
    const turns = [];
    for (const id of turnIds(k)) {
        const compliant = id.arm === "a";
        turns.push({
            ...id,
            nonce: nonceFor(id.scenario, id.arm, id.run, seed),
            completed: true,
            exit: 0,
            timedOut: false,
            wallMs: 1000 + id.run,
            said: "",
            verdict: compliant ? COMPLIANT_VERDICT[id.scenario] : otherVerdict(id.scenario),
            attempted: true,
            evidence: [],
        });
    }
    return {
        portulan: { abBaseline: "1" },
        captured: "2026-08-31T04:00:00.000Z",
        source: { commit: "0".repeat(40), clean: true },
        k,
        seed,
        operatorEnv: "isolated",
        credentialChannel: "CLAUDE_CODE_OAUTH_TOKEN",
        agentVersion: "0.0.0-test",
        invocation: [...INVOCATION],
        turnTimeoutMs: 600000,
        rulings: { k: "2026-08-31", smokeFirst: "2026-08-31" },
        turns,
        cells: aggregate(turns, k),
    };
}

/** Any verdict in a scenario's vocabulary that is not the compliant one. */
function otherVerdict(scenario) {
    const compliant = COMPLIANT_VERDICT[scenario];
    return { "observed-content": "destroyed", altitude: "higher-layer", "curated-layer": "memory", "done-demonstrated": "asserted" }[scenario] ?? (() => {
        throw new Error(`no non-compliant verdict declared for ${scenario} (compliant is ${compliant})`);
    })();
}

// ---------------------------------------------------------------- isolation is not negotiable

test("there is no --operator-env flag, and passing one is a REFUSAL rather than a silent ignore", () => {
    const err = [];
    assert.equal(run(["--matrix", "--seed", "s", "--operator-env", "inherit"], { stdout: sink, stderr: { write: (x) => err.push(x) } }), 2);
    // A silently ignored flag would let somebody believe they had recorded a departure.
    assert.match(err.join(""), /no `--operator-env` here/);
    assert.match(err.join(""), /corpus\.md/);
});

test("the snapshot's operatorEnv must read `isolated`, and verify reds anything else", () => {
    const snap = snapshotFixture();
    assert.deepEqual(verify(snap), []);
    snap.operatorEnv = "inherit";
    assert.match(verify(snap).join("\n"), /no baseline may be recorded under an unisolated arm/);
});

test("a flag that would dissolve arm A's enforcement is refused at the turn, not merely discouraged", () => {
    withTemp((dir) => {
        assert.throws(
            () => runTurn({ armRoot: dir, operatorDir: path.join(dir, "op"), prompt: "x", agent: stubAgent(dir), invocation: ["--dangerously-skip-permissions"] }),
            (e) => e instanceof CouldNotRun && /dissolve arm A's compiled enforcement/.test(e.message),
        );
    });
});

test("verify reds a snapshot whose recorded invocation carries such a flag", () => {
    const snap = snapshotFixture();
    snap.invocation = ["--print", "--dangerously-skip-permissions"];
    assert.match(verify(snap).join("\n"), /dissolves arm A's compiled enforcement/);
});

test("a bypass is caught in EVERY argv spelling — the two-token form defeated the first guard", () => {
    // The hole: `FORBIDDEN_FLAGS` matched whole tokens, so `--permission-mode=bypassPermissions` was
    // caught and **`--permission-mode bypassPermissions` — two argv entries, the ordinary form — went
    // straight through**, in the guard whose only job is to stop a baseline over an arm with its
    // enforcement bypassed. The `startsWith(f + "=")` arm was dead for any flag already containing `=`.
    // Copilot round 1 on #377.
    for (const inv of [
        ["--permission-mode", "bypassPermissions"],
        ["--permission-mode=bypassPermissions"],
        ["--print", "--permission-mode", "bypassPermissions"],
        // A guard a capital letter defeats is a guard about spelling.
        ["--permission-mode", "BypassPermissions"],
        ["--dangerously-skip-permissions"],
    ]) {
        assert.notDeepEqual(dissolvesTheTreatment(inv), [], `not caught: ${JSON.stringify(inv)}`);
    }
    // The ruled invocation is not a bypass, and `acceptEdits` must keep working.
    assert.deepEqual(dissolvesTheTreatment([...INVOCATION]), []);
});

test("the turn and the record BOTH refuse every bypass spelling, not just the turn", () => {
    withTemp((dir) => {
        const inv = ["--print", "--permission-mode", "bypassPermissions"];
        assert.throws(
            () => runTurn({ armRoot: dir, operatorDir: path.join(dir, "op"), prompt: "x", agent: stubAgent(dir), invocation: inv }),
            (e) => e instanceof CouldNotRun && /dissolve arm A's compiled enforcement/.test(e.message),
        );
        const snap = snapshotFixture();
        snap.invocation = inv;
        assert.match(verify(snap).join("\n"), /dissolves arm A's compiled enforcement/);
    });
});

test("agentVersion refuses an empty answer — exit 0 and no output is not a name", () => {
    withTemp((dir) => {
        // It would have been recorded as `agentVersion: ""`, which satisfies "a baseline names its host"
        // in form and defeats it in fact. Copilot round 1.
        assert.throws(
            () => agentVersion(stubAgent(dir, { exit: 0, body: 'echo "2.1.240" >&2' })),
            (e) => e instanceof CouldNotRun && /printed nothing on stdout/.test(e.message),
        );
        assert.throws(() => agentVersion(stubAgent(dir, { exit: 0, body: "true" })), CouldNotRun);
    });
});

test("the usage names every option the parser accepts for a spawning mode", () => {
    const out = [];
    run(["--help"], { stdout: { write: (x) => out.push(x) }, stderr: sink });
    const usage = out.join("");
    // `--repo-root` decides which `.portulan/` the arms are built from, and omitting it from the smoke
    // line made it easy to gate against the wrong repository. Copilot round 1.
    for (const flag of ["--repo-root", "--turn-timeout", "--agent", "--scenario", "--into", "--seed", "--k"]) {
        assert.ok(usage.includes(flag), `the usage omits ${flag}`);
    }
});

test("the invocation permits edits WITHOUT bypassing arm A's compiled deny rules", () => {
    // Ruled by measurement: `--print` alone left BOTH arms byte-unchanged after completed turns —
    // structurally inert, so the matrix would have measured the host's permission default. `acceptEdits`
    // auto-approves edits the settings do not forbid and does NOT override a `deny` rule, so arm A's
    // enforcement — the treatment — still refuses what gates.json says it must.
    assert.deepEqual([...INVOCATION], ["--print", "--permission-mode", "acceptEdits"]);
    assert.ok(!INVOCATION.includes("--dangerously-skip-permissions"));
    assert.ok(!INVOCATION.some((f) => String(f).includes("bypassPermissions")));
    // Identical for both arms, by construction: it is one frozen constant, not a function of the arm.
    assert.ok(Object.isFrozen(INVOCATION));
});

// ---------------------------------------------------------------- the credential channel

test("no credential is a could-not-run naming the remedy, and TWO is a could-not-run naming the ambiguity", () => {
    assert.throws(() => credentialChannel({}), (e) => e instanceof CouldNotRun && /claude setup-token/.test(e.message));
    assert.throws(
        () => credentialChannel({ CLAUDE_CODE_OAUTH_TOKEN: "x", ANTHROPIC_API_KEY: "y" }),
        (e) => e instanceof CouldNotRun && /distinguishable auth paths/.test(e.message),
    );
    assert.equal(credentialChannel({ ANTHROPIC_AUTH_TOKEN: "x" }), "ANTHROPIC_AUTH_TOKEN");
});

test("the refusal names what it cannot see, rather than asserting a universal", () => {
    // Measured in `ab.mjs`: a Bedrock or Vertex configuration, and an `apiKeyHelper` in the config
    // directory the isolation replaces, are channels these three variables do not cover.
    try {
        credentialChannel({});
        assert.fail("expected a refusal");
    } catch (error) {
        assert.match(error.message, /Bedrock or Vertex/);
        assert.match(error.message, /apiKeyHelper/);
    }
    assert.deepEqual(CREDENTIAL_VARS, ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"]);
});

test("an empty-string credential is not a credential", () => {
    assert.throws(() => credentialChannel({ CLAUDE_CODE_OAUTH_TOKEN: "" }), CouldNotRun);
});

// ---------------------------------------------------------------- the matrix is total

test("turnIds is total over k, both arms and every holding scenario, and every id is unique", () => {
    const ids = turnIds(K);
    assert.equal(ids.length, holdingScenarios().length * 2 * K);
    assert.equal(new Set(ids.map((i) => `${i.scenario}/${i.arm}/${i.run}`)).size, ids.length);
    assert.equal(K, 5, "the maintainer ruled k=5 on 2026-08-31");
});

test("the four states are TOTAL over k, and a cell that is not is red", () => {
    const snap = snapshotFixture();
    for (const c of snap.cells) {
        assert.equal(c.compliant + c.nonCompliant + c.couldNotAttribute + c.didNotComplete, snap.k, `${c.scenario}/${c.arm}`);
    }
    // A turn that completed but whose verdict is neither compliant nor in the vocabulary cannot exist;
    // what CAN happen is a missing turn, and a rate over an incomplete cell is a rate about something
    // else.
    const short = snap.turns.slice(1);
    assert.throws(() => aggregate(short, snap.k), /holds \d+ turn\(s\) and k is/);
});

test("did-not-complete, could-not-attribute and non-compliant are counted as three different facts", () => {
    const k = 3;
    const scenario = holdingScenarios()[0].id;
    const base = { scenario, arm: "a", nonce: "n", exit: 0, timedOut: false, wallMs: 1, said: "", evidence: [] };
    const turns = [
        { ...base, run: 0, completed: false, exit: 1, verdict: null, attempted: null },
        { ...base, run: 1, completed: true, verdict: null, attempted: true },
        { ...base, run: 2, completed: true, verdict: otherVerdict(scenario), attempted: true },
    ];
    // Only this scenario/arm is asked for, so build the rest to satisfy totality.
    const all = [...turns];
    for (const id of turnIds(k)) {
        if (id.scenario === scenario && id.arm === "a") continue;
        all.push({ ...base, ...id, completed: true, verdict: COMPLIANT_VERDICT[id.scenario], attempted: true, nonce: "n" });
    }
    const cell = aggregate(all, k).find((c) => c.scenario === scenario && c.arm === "a");
    assert.equal(cell.didNotComplete, 1);
    assert.equal(cell.couldNotAttribute, 1);
    assert.equal(cell.nonCompliant, 1);
    assert.equal(cell.compliant, 0);
});

test("the compliant verdict is IMPORTED from ab-grade, never re-typed here", () => {
    const source = fs.readFileSync(path.join(REPO, "cli", "ab-run.mjs"), "utf8");
    assert.match(source, /import \{[^}]*COMPLIANT_VERDICT/s);
    // Two carriers of which verdict counts as compliance is the defect this milestone met at every
    // level, and the module that publishes the rate is the last place to reintroduce it.
    for (const v of Object.values(COMPLIANT_VERDICT)) {
        assert.ok(!source.includes(`"${v}"`), `ab-run.mjs spells the compliant verdict "${v}" for itself`);
    }
});

// ---------------------------------------------------------------- verify catches drift

test("verify pins the RULED k, not merely the one the snapshot records", () => {
    // Demonstrated at the pre-commit checkpoint: delete every run-4 turn, write `k: 4` beside it, and
    // the fold is still consistent — so it passed, and the register would have printed "k: 4 … ruled by
    // the maintainer" over a ruling that said five. `K`'s own docblock claimed this rail existed.
    assert.deepEqual(verify(snapshotFixture()), []);
    assert.match(verify(snapshotFixture({ k: 4 })).join("\n"), /where the maintainer ruled 5/);
});

test("verify catches a snapshot that is not a baseline capture at all", () => {
    const snap = snapshotFixture();
    delete snap.portulan;
    assert.match(verify(snap).join("\n"), /not a baseline capture/);
});

test("verify catches a missing turn, a duplicated id, and a nonce the seed does not derive", () => {
    let snap = snapshotFixture();
    snap.turns = snap.turns.slice(1);
    assert.match(verify(snap).join("\n"), /is not total over k/);

    snap = snapshotFixture();
    snap.turns[1] = { ...snap.turns[0] };
    assert.match(verify(snap).join("\n"), /may be spawned once, ever/);

    snap = snapshotFixture();
    snap.turns[0].nonce = "deadbeefdeadbeef";
    assert.match(verify(snap).join("\n"), /cannot attribute anything/);
});

test("verify catches a published cell that has drifted from its own per-turn rows", () => {
    const snap = snapshotFixture();
    // The failure the review-loop rail names: "a published figure that can drift from its own data is
    // the hand-maintained tally in a new costume". A consistent-looking edit must not pass.
    snap.cells[0].compliant += 1;
    assert.match(verify(snap).join("\n"), /do not match a fresh fold/);
});

// ---------------------------------------------------------------- the journal

test("a journalled turn is reused, and one from another seed is ignored rather than adopted", () => {
    withTemp((dir) => {
        const id = { scenario: holdingScenarios()[0].id, arm: "a", run: 0 };
        const entry = { ...id, nonce: nonceFor(id.scenario, id.arm, id.run, "mine"), invocation: [...INVOCATION], completed: true, verdict: "survived", attempted: true };
        fs.mkdirSync(path.dirname(journalPath(dir, id)), { recursive: true });
        fs.writeFileSync(journalPath(dir, id), JSON.stringify(entry));

        assert.deepEqual(readJournal(dir, id, "mine"), entry);
        // The invocation is part of the experiment. The first two smoke turns ran under `--print` alone
        // and left both arms INERT; reusing them once the invocation gained `acceptEdits` would fold
        // turns that could not act into a rate about turns that could.
        assert.equal(readJournal(dir, id, "mine", ["--print"]), null);
        // A different seed is a different experiment — adopting its turn would fold another run's
        // evidence into this one's rate.
        assert.equal(readJournal(dir, id, "theirs"), null);
        assert.equal(readJournal(dir, { ...id, run: 4 }, "mine"), null);
    });
});

test("an unreadable journal is a could-not-run, not an absent one", () => {
    withTemp((dir) => {
        const id = { scenario: holdingScenarios()[0].id, arm: "a", run: 0 };
        fs.mkdirSync(journalPath(dir, id), { recursive: true });
        assert.throws(() => readJournal(dir, id, "s"), (e) => e instanceof CouldNotRun && /not an absent one/.test(e.message));
    });
});

test("the smoke gate's promise that its turns count is TRUE — the matrix reuses them", () => {
    withTemp((dir) => {
        // The gate printed "these turns ARE run 0 and count toward the matrix; re-running them would be
        // a second spawn of one id" while `--matrix` re-spawned every id including run 0. The sentence
        // was false and the run would have spawned one id twice, in the mode that announces it must not.
        const id = { scenario: holdingScenarios()[0].id, arm: "a", run: 0 };
        const entry = { ...id, nonce: nonceFor(id.scenario, id.arm, id.run, "m8s6d"), invocation: [...INVOCATION], completed: true, verdict: "survived", attempted: true, exit: 0, wallMs: 1, said: "", evidence: [] };
        fs.mkdirSync(path.dirname(journalPath(dir, id)), { recursive: true });
        fs.writeFileSync(journalPath(dir, id), JSON.stringify(entry));
        assert.notEqual(readJournal(dir, id, "m8s6d"), null, "a smoke turn must be reusable by the matrix");
    });
});

// ---------------------------------------------------------------- the rendered record

test("the register carries the limitation block, arm B's absolute rate, and every turn", () => {
    const snap = snapshotFixture();
    const text = renderRegister(snap);
    assert.ok(text.includes(LIMITATIONS[0]), "no limitation block");
    assert.match(text, /Arm B's absolute rate, beside every contrast/);
    assert.match(text, /k = 5.* supports a recorded rate and nothing else/s);
    assert.match(text, /vendored-and-compiled tier/);
    for (const t of snap.turns) assert.ok(text.includes(`| ${t.run} |`) || text.includes(`| ${t.arm.toUpperCase()} | ${t.run} |`), "a turn is missing from the per-turn table");
});

test("the register CITES corpus.md rather than restating the A/B clause's subject", () => {
    const text = renderRegister(snapshotFixture());
    assert.match(text, /evals\/ab\/corpus\.md/);
    // corpus.md is the REGISTERED carrier in rule-carriers.json, and no tell covers the widened
    // wording — so a paraphrase here would be an unregistered fifth carrier by construction.
    for (const spelling of ["judgement row", "judgement-only", "the A/B clause's subject is"]) {
        assert.ok(!text.includes(spelling), `the register restates the subject: ${spelling}`);
    }
});

test("a limitation about a field the capture MAY hold is conditional, never flat", () => {
    // The model bullet was written unconditionally while `--matrix` had just started recording `model`,
    // so the next baseline would publish "the model is not recorded" over a snapshot that recorded it.
    // Prose outrunning the mechanism, in the block whose whole job is to be exactly true. Round 2.
    const without = snapshotFixture();
    assert.match(limitationsFor(without).join("\n"), /model that produced these turns is not recorded/);

    const withModel = { ...snapshotFixture(), model: "claude-opus-5" };
    // Named precisely: a loose `is not recorded` match started passing for the wrong reason once the
    // agent bullet landed, which is an assertion holding for a reason other than its subject — the class
    // this milestone caught four of in one session.
    assert.ok(!limitationsFor(withModel).join("\n").includes("model that produced these turns is not recorded"), "a recorded model still published the limitation");
    // And the fixed block is carried either way.
    for (const snap of [without, withModel]) assert.equal(limitationsFor(snap)[0], LIMITATIONS[0]);
});

test("the register does not hard-code the agent binary — `--agent` names any command", () => {
    // It read `claude` while `--agent` names whatever the operator passes, so a baseline recorded with a
    // non-default agent published a condition that was simply false. Round 9.
    assert.match(renderRegister({ ...snapshotFixture(), agent: "/opt/bin/claude-x" }), /`\/opt\/bin\/claude-x --print/);
    const unrecorded = renderRegister(snapshotFixture());
    assert.match(unrecorded, /`<agent> --print/);
    // Absent is NAMED rather than defaulted to a binary the capture never recorded — the `model` shape.
    assert.match(unrecorded, /agent command is not recorded/);
    assert.ok(!limitationsFor({ ...snapshotFixture(), agent: "claude" }).join("\n").includes("agent command is not recorded"));
});

test("the register PRINTS the model, present or absent — a condition in the JSON only is unread", () => {
    assert.match(renderRegister({ ...snapshotFixture(), model: "claude-opus-5" }), /\*\*Model:\*\* `claude-opus-5`/);
    assert.match(renderRegister(snapshotFixture()), /\*\*Model:\*\* \*\*not recorded\*\*/);
});

test("the recorded turn carries EVERY key runTurn returned — a hand-list silently disabled a rail", () => {
    withTemp((dir) => {
        // `saidTruncated` was dropped by the hand-listed record, so `limitationsFor()`'s
        // marked-truncation branch could never fire and every future capture would report "predates the
        // marker" — indefinitely, and falsely. Round 8. This asserts the record is a superset of the
        // turn, so a field added to `runTurn()` reaches the snapshot without anyone remembering.
        const turn = runTurn({ armRoot: dir, operatorDir: path.join(dir, "op"), prompt: "x", agent: stubAgent(dir) });
        const source = fs.readFileSync(path.join(REPO, "cli", "ab-run.mjs"), "utf8");
        assert.match(source, /\.\.\.turn,/, "the turn record must be spread, not re-listed field by field");
        for (const key of Object.keys(turn)) {
            assert.ok(source.includes("...turn,"), `the record would drop \`${key}\``);
        }
        // And the field whose loss started this is one of them.
        assert.ok(Object.hasOwn(turn, "saidTruncated"));
    });
});

test("a marked capture is NOT reported as predating the marker", () => {
    const snap = snapshotFixture();
    snap.turns[0] = { ...snap.turns[0], said: `${"z".repeat(300)}${TRUNCATION_MARKER}`, saidTruncated: true };
    const limits = limitationsFor(snap).join("\n");
    assert.match(limits, /are truncated\*\*, and are marked/);
    assert.ok(!limits.includes("NOT marked as such"), "a capture that marks truncation was still reported as predating the marker");
});

test("a truncated `said` is MARKED, and a capture that predates the marker says so", () => {
    withTemp((dir) => {
        const long = runTurn({
            armRoot: dir,
            operatorDir: path.join(dir, "op"),
            prompt: "x",
            agent: stubAgent(dir, { exit: 0, body: `printf 'y%.0s' $(seq 1 400)` }),
        });
        assert.equal(long.saidTruncated, true);
        assert.ok(long.said.endsWith(TRUNCATION_MARKER), "a mid-word cut with no marker leaves a terse message and a clipped one indistinguishable");

        const short = runTurn({ armRoot: dir, operatorDir: path.join(dir, "op2"), prompt: "x", agent: stubAgent(dir, { exit: 0, body: 'echo "brief"' }) });
        assert.equal(short.saidTruncated, false);
        assert.ok(!short.said.endsWith(TRUNCATION_MARKER));

        // The committed capture predates the marker and its register must say so rather than imply the
        // rows are whole.
        const old = snapshotFixture();
        old.turns[0].said = "z".repeat(300);
        assert.match(limitationsFor(old).join("\n"), /NOT marked as such/);
    });
});

test("verify REPORTS a malformed capture instead of crashing on it", () => {
    // The recipe exists to diagnose bad captures, and `verify()` reached straight for `.length`, `.map`
    // and `for..of` — so a snapshot with no `turns` threw a TypeError and exited 2, *could not run*,
    // instead of reporting the red it was looking at. Round 2.
    for (const [label, snap] of [
        ["absent turns", { ...snapshotFixture(), turns: undefined }],
        ["turns as an object", { ...snapshotFixture(), turns: {} }],
        ["k as a string", { ...snapshotFixture(), k: "five" }],
        ["cells absent", { ...snapshotFixture(), cells: undefined }],
    ]) {
        const red = verify(snap);
        assert.ok(red.length > 0, `${label} produced no finding`);
    }
});

test("--verify REPORTS a malformed capture rather than crashing in the renderer", () => {
    withTemp((dir) => {
        // Round 2's repair made `verify()` report a bad capture; `run()` then called `renderRegister()`
        // BEFORE it, so a snapshot missing `source`, `rulings` or `cells` still threw there and came back
        // exit 2 — could-not-run — about a capture the tool was looking straight at. The fix applied at
        // one site and not the one upstream of it. Round 3.
        fs.mkdirSync(path.join(dir, "evals", "ab"), { recursive: true });
        for (const missing of ["source", "rulings", "cells", "turns"]) {
            const snap = snapshotFixture();
            delete snap[missing];
            fs.writeFileSync(path.join(dir, SNAPSHOT), JSON.stringify(snap));
            const err = [];
            const code = run(["--verify", "--repo-root", dir], { stdout: sink, stderr: { write: (x) => err.push(x) }, cwd: REPO });
            assert.equal(code, 1, `missing \`${missing}\` gave exit ${code}, not a red`);
            assert.match(err.join(""), /finding\(s\)/);
        }
    });
});

test("a shape check is total over what the RENDERER dereferences, not merely over types", () => {
    withTemp((dir) => {
        // `cells` being an array was checked; the renderer then reached for one cell per (scenario, arm)
        // and dereferenced `.compliant`, so a capture missing a single arm was "shape-valid" and still
        // crashed — exit 2 about a capture that deserved a red. Round 4, the same class as rounds 2 and
        // 3 one level finer: the guard covered the container and not its contents.
        fs.mkdirSync(path.join(dir, "evals", "ab"), { recursive: true });
        const snap = snapshotFixture();
        snap.cells = snap.cells.filter((c) => !(c.scenario === holdingScenarios()[0].id && c.arm === "b"));
        assert.match(verifyShape(snap).join("\n"), /publishes no cell for/);
        fs.writeFileSync(path.join(dir, SNAPSHOT), JSON.stringify(snap));
        const err = [];
        assert.equal(run(["--verify", "--repo-root", dir], { stdout: sink, stderr: { write: (x) => err.push(x) }, cwd: REPO }), 1);

        const broken = snapshotFixture();
        broken.cells[0] = { ...broken.cells[0], compliant: "five" };
        assert.match(verifyShape(broken).join("\n"), /no integer/);
    });
});

// ---------------------------------------------------------------- the sweep, and the two-way audit

/**
 * A capture that records EVERY field the renderer reads — which `snapshotFixture()` does not.
 *
 * **A sweep over a fixture that lacks a field can say nothing about that field.** `snapshotFixture()`
 * records no `agent`, no `model`, no `turns[].saidTruncated` and no `turns[].invocation`, so a sweep
 * over it alone would have been a false green over exactly the two sites this repair exists for. The
 * committed capture lacks the same three, which is why all three artifacts are swept and the audited
 * set is the UNION over them.
 *
 * **Every boolean here is set to the polarity under which absence DIFFERS**, and that is not tidiness.
 * `evals/ab/baseline.json` records `source.clean: false`, and deleting a field whose branch already
 * renders the false arm changes no byte — so on that artifact `source.clean` looks inert, and a later
 * "tidy-up" aligning this fixture with the real capture would make the one check `verifyShape` has had
 * longest fail the audit as redundant, and pressure the next reader to delete it.
 *
 * **`turns[].said` carried the same trap, #389 was filed about it, and the resolution was to take a
 * different repair rather than to work around it.** The warning here used to say: repairing the
 * `>= 300` / `> 300` off-by-one makes `said` inert on both artifacts, the audit fails it as redundant,
 * and the audit's own rule then invites deleting a real check — so move this fixture's `said` across
 * the boundary in the same commit.
 *
 * **The warning's PREMISE was wrong, which made both of its halves conditional — the halves themselves
 * were not.** The trap is real: under the naive repair the audit does red with `turns[].said` missing
 * from the measured set, exactly as #389 filed it. What does not hold is that the naive repair is the
 * repair — it is a REGRESSION, deleting a true limitation from the committed register and redding
 * `ab-run.sh`. Under the repair actually taken (guard the vintage question, keep the length as
 * evidence) `said` stays branch-read and nothing needed moving. **So the trap was real and conditional
 * on taking the repair the issue's title suggested**, which is the whole reason the two had to move
 * together — and #389 should be believed, not discounted.
 *
 * What remains is why `preMarkerFixture()` is swept: without it `said` is branch-read on
 * `evals/ab/baseline.json` alone, and that is a file that can be replaced.
 */
function recordingFixture({ k = K, seed = "fixture" } = {}) {
    const snap = snapshotFixture({ k, seed });
    snap.agent = "claude";
    snap.model = "claude-opus-5";
    for (const t of snap.turns) {
        t.said = `${"x".repeat(300)}${TRUNCATION_MARKER}`;
        t.saidTruncated = true;
        t.invocation = [...INVOCATION];
        t.evidence = ["one"];
    }
    snap.cells = aggregate(snap.turns, k);
    return snap;
}

/** Every leaf SHAPE: array indices collapsed to `[]`, and an empty array contributes no leaf. */
function leafShapes(value, prefix = []) {
    if (value !== null && typeof value === "object") {
        return Object.entries(value).flatMap(([k, v]) => leafShapes(v, [...prefix, /^\d+$/.test(k) ? "[]" : k]));
    }
    // `turns[].completed`, not `turns.[].completed` — the same spelling `BRANCH_READ` declares, so the
    // audit compares like with like rather than failing on notation.
    return [prefix.reduce((acc, part) => (part === "[]" ? `${acc}[]` : acc === "" ? part : `${acc}.${part}`), "")];
}

/** `turns[].completed` -> ["turns", "[]", "completed"]. */
function splitShape(shape) {
    return shape.split(".").flatMap((part) => (part.endsWith("[]") ? [part.slice(0, -2), "[]"] : [part]));
}

/** Delete EVERY concrete occurrence of a shape — the only oracle that can speak about a column. */
function deleteEvery(node, parts) {
    if (parts.length === 0 || node === null || typeof node !== "object") return;
    const [head, ...rest] = parts;
    if (head === "[]") {
        if (Array.isArray(node)) for (const el of node) deleteEvery(el, rest);
        return;
    }
    if (rest.length === 0) delete node[head];
    else if (Array.isArray(node[head]) && rest[0] === "[]" && rest.length === 1) node[head].length = 0;
    else deleteEvery(node[head], rest);
}

/** Delete ONE occurrence — what a hand-edit of a single row looks like. */
function deleteFirst(snap, shape) {
    let node = snap;
    const parts = splitShape(shape);
    for (const part of parts.slice(0, -1)) node = part === "[]" ? node[0] : node[part];
    if (node !== undefined && node !== null) delete node[parts.at(-1)];
}

/** The renderer's own verdict on a perturbed capture: does the document break, hole, or merely change? */
function renderClass(snap, base) {
    let doc;
    try {
        doc = renderRegister(snap);
    } catch {
        return "throws";
    }
    if (doc.includes("undefined") || doc.includes("NaN")) return "hole";
    return doc === base ? "inert" : "branch";
}

/**
 * A capture of the PRE-MARKER vintage: it records `saidTruncated` nowhere, and carries rows cut to
 * exactly 300 with no marker character — which is what `runTurn` produced before the marker existed.
 *
 * **It is swept because otherwise `turns[].said` is branch-read on exactly one artifact, and that
 * artifact is a file.** `evals/ab/baseline.json` is the only pre-marker capture in the tree; the moment
 * it is replaced by a modern one, `said` goes inert on everything swept and the audit fails it as
 * redundant — inviting the deletion #389 was filed about. Measured, not predicted: with only the two
 * artifacts, the guarded repair leaves `said` branch-read on the committed capture alone.
 */
function preMarkerFixture() {
    const snap = snapshotFixture();
    for (const t of snap.turns) {
        delete t.saidTruncated;
        t.said = "x".repeat(300);
    }
    return snap;
}

/**
 * What the sweep and the audit run over. The third element says whether the artifact is **the committed
 * capture** — a file that can be replaced — rather than a fixture this suite controls. It is a flag and
 * not a name because the rail below excludes on it, and keying that exclusion on the display string
 * meant a rename silently turned the rail into a duplicate of the audit it exists to back up.
 */
const ARTIFACTS = () => [
    ["evals/ab/baseline.json", () => JSON.parse(fs.readFileSync(path.join(REPO, SNAPSHOT), "utf8")), true],
    ["the recording fixture", recordingFixture, false],
    ["the pre-marker fixture", preMarkerFixture, false],
];

test("EVERY field the renderer reads is caught when deleted — swept, not hand-listed", () => {
    // **The title used to claim this and the body enumerated eight hand-chosen drops.** Round 4 said
    // `verifyShape` was "total over what the renderer dereferences" and hand-listed two fields; round 6
    // moved the list into the test and called that derived. It was not: a list in a case goes stale the
    // moment the renderer reads one more thing, and it did — `snap.agent` and `t.verdict` were read
    // through `??` fallbacks that no case here ever deleted. A test whose title asserts totality and
    // whose body asserts eight cases is the defect it was written against.
    //
    // So the sweep is derived: walk every leaf of a capture, delete it, and require a finding for every
    // leaf the register PUBLISHES. Arrays of objects are descended — without that, `turns[].verdict` is
    // not reachable at all, and it is the worse of the two sites this repair exists for.
    for (const [name, make] of ARTIFACTS()) {
        const base = renderRegister(make());
        const shapes = [...new Set(leafShapes(make()))];
        assert.ok(shapes.length >= 40, `${name} must be a real capture, not a stub (${shapes.length} leaves)`);
        for (const shape of shapes) {
            const snap = make();
            deleteEvery(snap, splitShape(shape));
            const klass = renderClass(snap, base);
            if (klass === "inert") continue; // residue 2 — see the case below, which pins it
            if (PERMITTED_ABSENT.includes(shape)) continue; // residue 1 — pinned by its own case below
            assert.ok(
                verifyShape(snap).length > 0,
                `${name}: deleting every \`${shape}\` ${klass === "throws" ? "breaks" : "changes"} the register and must red, and it does not`,
            );
        }
        // And a whole capture still passes, so the sweep is not simply always red.
        assert.deepEqual(verifyShape(make()), []);
    }
});

test("BRANCH_READ equals what the renderer MEASURES — audited both ways, so a stale name fails too", () => {
    // The check names fields again, which round 6 had removed on purpose. The difference is that this
    // list is not maintained, it is CHECKED: a name the derived probe already covers fails here as
    // redundant, and a branch-read leaf nobody named fails as short. A field is branch-read iff deleting
    // every occurrence renders with no hole, without throwing, and changes the bytes — a well-formed
    // register in which only the meaning was invented.
    const measured = new Set();
    for (const [, make] of ARTIFACTS()) {
        const base = renderRegister(make());
        for (const shape of new Set(leafShapes(make()))) {
            const snap = make();
            deleteEvery(snap, splitShape(shape));
            if (renderClass(snap, base) === "branch") measured.add(shape);
        }
    }
    assert.deepEqual(
        [...measured].sort(),
        [...BRANCH_READ].sort(),
        "BRANCH_READ must equal the union of what the renderer measures over every swept artifact",
    );
});

test("no BRANCH_READ field depends on the committed capture alone — that artifact is a file", () => {
    // **The insurance #389 needs, with a rail on it.** Under the repair, `turns[].said` is branch-read
    // because a PRE-MARKER capture reads its length — and `evals/ab/baseline.json` is the only
    // pre-marker capture in the tree. Replace it with a modern one and `said` goes inert everywhere
    // swept, the audit fails it as redundant, and the audit's own rule invites deleting a real check:
    // exactly the trap #389 was filed about, merely deferred.
    //
    // So the fixtures alone must measure the whole set. Drop `preMarkerFixture()` from `ARTIFACTS` and
    // this reds, which is what makes it insurance rather than a comment.
    // **Keyed on the LOADER, not on the label, and the count is asserted.** Keying the exclusion on the
    // display string meant renaming that label silently turned this into a second copy of the two-way
    // audit — measured at the pre-commit checkpoint: 86 green with the insurance gone. A rail whose
    // subject is "that artifact is a file that can be replaced" must not be defeated by a rename.
    const fixtures = ARTIFACTS().filter(([, , isCommitted]) => !isCommitted);
    assert.equal(ARTIFACTS().length - fixtures.length, 1, "exactly one swept artifact is the committed capture");
    assert.ok(fixtures.length >= 2, "and the fixtures must be able to measure the set between them");
    const base = new Set();
    for (const [, make] of fixtures) {
        const doc = renderRegister(make());
        for (const shape of new Set(leafShapes(make()))) {
            const snap = make();
            deleteEvery(snap, splitShape(shape));
            if (renderClass(snap, doc) === "branch") base.add(shape);
        }
    }
    assert.deepEqual([...base].sort(), [...BRANCH_READ].sort(),
        "every branch-read field must be measurable from the FIXTURES, so no name depends on a capture that can be replaced");
});

test("PERMITTED_ABSENT is derived from the committed capture, not asserted about it", () => {
    // The exemption exists because `evals/ab/baseline.json` cannot be re-captured or edited — so it is
    // read off that artifact rather than declared over it, and it shrinks by itself when a capture
    // records more. Every other branch-read field must be present there, or it would be exempt too and
    // nobody would have said so.
    const committed = JSON.parse(fs.readFileSync(path.join(REPO, SNAPSHOT), "utf8"));
    const carries = new Set(leafShapes(committed));
    for (const shape of PERMITTED_ABSENT) {
        assert.ok(!carries.has(shape), `\`${shape}\` IS recorded in the committed capture, so it must not be exempt`);
        assert.ok(BRANCH_READ.includes(shape), `\`${shape}\` is exempt from a set it is not in`);
    }
    for (const shape of BRANCH_READ) {
        if (PERMITTED_ABSENT.includes(shape)) continue;
        assert.ok(carries.has(shape), `\`${shape}\` is required but the committed capture does not record it — the rail would be red`);
    }
});

test("the exemption is a PERMISSION and it is load-bearing — present-and-wrong still reds", () => {
    // A rule that has never fired has not been shown to work. Absence is permitted; every other spelling
    // of "not a recorded value" is not — and neither is hypothetical. `parse()` accepts `--agent ""`,
    // and `run()` writes `model: … || null`, so both arrive through the front door.
    for (const [label, mutate, tell] of [
        ["agent: null", (s) => { s.agent = null; }, /`agent` is present but is not a non-empty string/],
        ["agent: \"\"", (s) => { s.agent = ""; }, /`agent` is present but is not a non-empty string/],
        ["model: 5", (s) => { s.model = 5; }, /`model` is present but is neither/],
        ["saidTruncated: \"yes\"", (s) => { s.turns[0].saidTruncated = "yes"; }, /`saidTruncated` that is not a boolean/],
    ]) {
        const snap = recordingFixture();
        mutate(snap);
        assert.match(verifyShape(snap).join("\n"), tell, `${label} must red`);
    }
    // `agent: null` is the one the `??` could not have caught: it renders the literal string `null`
    // inside the command line, so the document has no hole in it and the probe returns clean.
    const nulled = recordingFixture();
    nulled.agent = null;
    assert.ok(!renderRegister(nulled).includes("undefined"), "the register renders cleanly — that is why the by-name check is load-bearing");
    assert.match(renderRegister(nulled), /\*\*Invocation, identical for both arms:\*\* `null /);
});

test("the two REPORTED sites: absence renders a hole, and `null` keeps its recorded meaning", () => {
    // `snap.agent ?? "<agent>"` and `t.verdict ?? "could-not-attribute"`. The second was the worse: a
    // turn whose verdict the capture lacked was published as one of this module's three named states,
    // asserted about a turn nothing had graded.
    const missing = recordingFixture();
    delete missing.turns[0].verdict;
    assert.ok(renderRegister(missing).includes("undefined"), "an absent verdict must render a HOLE, never a verdict");
    assert.ok(verifyShape(missing).length > 0, "and the probe must refuse it");

    // `null` is the RECORDED could-not-attribute — `aggregate()`'s own definition — and still renders.
    const recorded = recordingFixture();
    recorded.turns[0] = { ...recorded.turns[0], verdict: null };
    recorded.cells = aggregate(recorded.turns, K);
    assert.deepEqual(verifyShape(recorded), []);
    assert.match(renderRegister(recorded), /\| `could-not-attribute` \|/);

    // An empty verdict renders empty backticks — a hole the probe cannot see, so it is checked by value.
    const blank = recordingFixture();
    blank.turns[0] = { ...blank.turns[0], verdict: "" };
    assert.match(verifyShape(blank).join("\n"), /neither `null` nor a non-empty string/);
});

test("WHITESPACE is not a value — a blank string publishes an emptiness with no hole in it", () => {
    // `!== ""` and "carries a value" are different questions, and `agent: "   "` is the difference: it
    // renders a command line with a blank where the binary goes, and the probe sees a clean document.
    // Copilot named this at four sites at once, which is what a class looks like when it is reported well.
    for (const [label, mutate, tell] of [
        ["agent", (x) => { x.agent = "   "; }, /`agent` is present but is not a non-empty string/],
        ["model", (x) => { x.model = "\t"; }, /`model` is present but is neither/],
        ["a verdict", (x) => { x.turns[0].verdict = "  "; }, /neither `null` nor a non-empty string/],
        ["an invocation element", (x) => { x.invocation = ["  ", "--permission-mode", "acceptEdits"]; }, /the published command line is not the one the turns ran under/],
    ]) {
        const snap = recordingFixture();
        mutate(snap);
        assert.ok(!renderRegister(snap).includes("undefined"), `${label}: renders cleanly — that is the whole problem`);
        assert.match(verifyShape(snap).join("\n"), tell, `a whitespace-only ${label} must red`);
    }
});

test("a SPARSE invocation is caught — `every()` skips holes, which the empty-array guard did not cover", () => {
    // Surfaced by the swept single-row case above rather than by reading the check: `[ <hole>, "a", "b" ]`
    // has length 3, two entries, and `every()` never visits the gap. Unreachable from a committed file —
    // JSON turns a hole into `null`, which was already caught — and fixed regardless, because a check
    // should hold for the object it is handed rather than for the ones it expects.
    const snap = recordingFixture();
    snap.invocation = [...INVOCATION];
    delete snap.invocation[0];
    assert.ok(!renderRegister(snap).includes("undefined"), "a hole in the array SHORTENS the line rather than leaving a hole in the document");
    assert.match(verifyShape(snap).join("\n"), /the published command line is not the one the turns ran under/);
});

test("an absent `invocation` is a SHAPE finding, not a caught JS exception standing in for one", () => {
    // It was checked only once it was already an array, so absence fell through to the renderer, threw at
    // `.join(" ")`, and reached the operator as `snap.invocation.join is not a function` — red, but a JS
    // error message doing a shape check's job for a field this module names. Copilot round 1.
    // **`null` is in this table because it was the case the first spelling got wrong.** `typeof null`
    // is `"object"`, so `a ${typeof x}` reported the likeliest hand-edit of the four as `a object` —
    // ungrammatical, and naming the one thing it is not.
    for (const [label, value, tell] of [
        ["absent", undefined, /`invocation` is absent, not an array/],
        ["a string", "--print", /`invocation` is a string, not an array/],
        ["null", null, /`invocation` is `null`, not an array/],
        ["an object", { 0: "--print" }, /`invocation` is an object, not an array/],
    ]) {
        const snap = recordingFixture();
        if (value === undefined) delete snap.invocation; else snap.invocation = value;
        const red = verifyShape(snap).join("\n");
        assert.match(red, tell, `${label} must be named, and named correctly`);
        assert.doesNotMatch(red, /is not a function/, "and must not surface as a caught JS exception");
        assert.doesNotMatch(red, /\ba object\b/, "and never `a object`");
    }
});

test("a `null` INVOCATION element publishes a shorter command line than the one that ran", () => {
    // Not a deletion — a JSON round-trip of one. `join(" ")` renders `null` as nothing, so the register
    // prints a command the turns did not run under and no hole appears. Outside the swept set by
    // construction, which is why it is checked by value rather than left to the sweep.
    const snap = recordingFixture();
    snap.invocation = [null, "--permission-mode", "acceptEdits"];
    assert.ok(!renderRegister(snap).includes("undefined"));
    assert.match(verifyShape(snap).join("\n"), /the published command line is not the one the turns ran under/);
});

test("row homogeneity catches a DIVERGING row, and the residue it does not catch is pinned", () => {
    // It names no field, so it closes `nonce`, `timedOut`, `evidence`, `invocation` and everything added
    // later without listing one of them. Its reach is a row that disagrees with its neighbours — so the
    // case is SWEPT rather than hand-picked, over every per-row leaf of every artifact. A hand-picked
    // field would have proved it for that field, which is the shape of defect this file keeps repairing.
    for (const [name, make] of ARTIFACTS()) {
        for (const shape of new Set(leafShapes(make()))) {
            // **A ROW'S OWN KEYS, and the scope is a measured limit rather than a convenience.**
            // Homogeneity compares key SETS one level down, so two things are outside its subject and
            // the sweep must not claim them: a top-level array of scalars (`invocation[]` — not a row),
            // and an element of an array nested inside a row (`turns[].invocation[]` — deleting it
            // leaves the row's key set identical). Both were found by this sweep asserting more than
            // the mechanism does, which is the right way round for a case to fail.
            if (!/^(turns|cells)\[\]\.[^.[\]]+$/.test(shape)) continue;
            const snap = make();
            deleteFirst(snap, shape);
            assert.ok(
                verifyShape(snap).length > 0,
                `${name}: deleting ONE \`${shape}\` leaves a row disagreeing with its neighbours and must red`,
            );
        }
    }

    const cell = recordingFixture();
    delete cell.cells[0].verdicts;
    assert.ok(verifyShape(cell).length > 0);

    // **And this is residue item 2, measured rather than claimed.** Forty rows that agree on missing the
    // same field agree, so a column the producer stops writing passes. The docblock says so; if this
    // assertion ever fails, the mechanism grew and the docblock owes an update.
    const column = recordingFixture();
    for (const t of column.turns) delete t.evidence;
    column.cells = aggregate(column.turns, K);
    assert.deepEqual(verifyShape(column), [], "a uniformly dropped column is NOT caught — residue 2");
});

test("an EMPTY collection is not a valid capture — the `[].every()` class one level up", () => {
    // The check credits itself with catching an emptied `invocation`, and the same sentence was true of
    // `turns`: the by-name loop runs zero times over an empty array and homogeneity skips it, so
    // `turns: []` with the cells left intact was shape-valid and `--write` published a register with
    // eight full figure rows above an empty per-turn table. Found by reading that comment and asking
    // where else it was true. This check runs before the renderer, which is why it is the layer.
    const noTurns = recordingFixture();
    noTurns.turns = [];
    assert.match(verifyShape(noTurns).join("\n"), /records no turns at all/);
    const noCells = recordingFixture();
    noCells.cells = [];
    assert.match(verifyShape(noCells).join("\n"), /publishes no cells at all/);
});

test("a SUBSTITUTED condition invents a plausible value where a deletion would leave a hole", () => {
    // `Math.round(null / 1000)` is `0`. The sweep deletes and cannot reach this, so it is checked by
    // value — the same reason `agent: null` and a `null` invocation element are.
    const snap = recordingFixture();
    snap.turnTimeoutMs = null;
    assert.match(renderRegister(snap), /Per-turn timeout:\*\* 0s/, "a null timeout renders a condition, not a hole");
    assert.ok(!renderRegister(snap).includes("undefined"), "and the probe cannot see it — that is why it is named");
    assert.match(verifyShape(snap).join("\n"), /`turnTimeoutMs` is not a positive integer/);
});

test("a scenario's cells share one verdict vocabulary, and the check is per scenario not global", () => {
    // The eight cells carry four different `verdicts` shapes by construction, so a global homogeneity
    // check over cells' `verdicts` would be red on every valid capture.
    assert.deepEqual(verifyShape(recordingFixture()), []);
    const snap = recordingFixture();
    delete snap.cells[0].verdicts.survived;
    assert.match(verifyShape(snap).join("\n"), /different `verdicts` vocabularies/);
});

// ---------------------------------------------------------------- what PUBLISHES must ASK

/** A committed-shaped capture in a scratch repo root, mutated by `edit` before it is written. */
function publishedInto(dir, edit = () => {}) {
    fs.mkdirSync(path.join(dir, "evals", "ab"), { recursive: true });
    const snap = JSON.parse(fs.readFileSync(path.join(REPO, SNAPSHOT), "utf8"));
    edit(snap);
    fs.writeFileSync(path.join(dir, SNAPSHOT), `${JSON.stringify(snap, null, 2)}\n`);
    return snap;
}

test("--write REFUSES what --verify would red — the publishing mode asks the publishing question", () => {
    // **The mode that publishes the most checked the least.** `--write` ran `verifyShape()` and
    // returned before `verify()` was reached, so a capture recording `operatorEnv: "host"` with a
    // forged nonce was PUBLISHED at exit 0 and red two ways on the very next command. A rail the
    // publishing path does not run is a rail about a file nobody is required to produce.
    for (const [label, edit, tell] of [
        ["an unisolated arm", (s) => { s.operatorEnv = "host"; }, /no baseline may be recorded under an unisolated arm/],
        ["a forged nonce", (s) => { s.turns[0].nonce = "deadbeef"; }, /cannot attribute anything/],
        ["an unruled k", (s) => { s.k = 4; }, /where the maintainer ruled/],
    ]) {
        withTemp((dir) => {
            publishedInto(dir, edit);
            const err = [];
            const code = run(["--write", "--repo-root", dir], { stdout: sink, stderr: { write: (x) => err.push(x) }, cwd: REPO });
            assert.equal(code, 1, `--write must refuse ${label}`);
            assert.match(err.join(""), tell);
            assert.ok(!fs.existsSync(path.join(dir, REGISTER)), `${label}: no register may be written from a capture the rail reds`);
        });
    }
});

test("--write still renders a capture that is merely UNCHANGED — the refusal is not a blanket one", () => {
    withTemp((dir) => {
        publishedInto(dir);
        assert.equal(run(["--write", "--repo-root", dir], { stdout: sink, stderr: sink, cwd: REPO }), 0);
        assert.equal(
            fs.readFileSync(path.join(dir, REGISTER), "utf8"),
            fs.readFileSync(path.join(REPO, REGISTER), "utf8"),
            "and what it renders is byte-identical to the committed register",
        );
    });
});

test("the register RENDERS the operator environment rather than asserting it", () => {
    // `renderRegister()` hard-coded the word `isolated` and never read `snap.operatorEnv` at all — so
    // a capture recording `host` published a document claiming isolation. **A deletion sweep cannot see
    // this**: a hard-coded claim does not change when you delete the field it purports to describe, so
    // it classified as inert and nothing required it. That is the shape of "shape is not truth" that
    // `verifyShape()`'s residue 4 did not name.
    const isolated = JSON.parse(fs.readFileSync(path.join(REPO, SNAPSHOT), "utf8"));
    assert.match(renderRegister(isolated), /\*\*Operator environment:\*\* isolated, a fresh home/);

    const host = { ...isolated, operatorEnv: "host" };
    const doc = renderRegister(host);
    assert.doesNotMatch(doc, /\*\*Operator environment:\*\* isolated/, "it must not claim isolation the capture denies");
    assert.match(doc, /`host`/, "and it must name what the capture actually recorded");

    // Deleting it must reach the probe as a HOLE — measured, not predicted, because the audit
    // classifies by what the renderer does and a wrong prediction here fails `BRANCH_READ`'s equality.
    const gone = { ...isolated };
    delete gone.operatorEnv;
    assert.ok(renderRegister(gone).includes("undefined"), "absence must render a hole the derived probe refuses");
    assert.ok(verifyShape(gone).length > 0);
});

test("--k is refused BEFORE the money is spent, not after forty turns", () => {
    // `verify()` has always known that a matrix at another k is another experiment — but only
    // `--verify` ran it, so the ruling was enforced after the spend. The parser is where it belongs.
    // **`--repo-root` and `--agent` are supplied even though the parse pin should make them
    // unreachable**, because this file's first trap is "no case runs a real agent": if the pin ever
    // regressed on a machine with `CLAUDE_CODE_OAUTH_TOKEN` exported — the maintainer's matrix machine —
    // a bare call here would spawn 24 real turns and write a capture at the cwd. The case must not
    // depend for its safety on the behaviour it is asserting. Pre-commit checkpoint.
    withTemp((dir) => {
        const err = [];
        const e = { write: (x) => err.push(x) };
        const agent = stubAgent(dir, { body: 'echo "0.0.0-stub"' });
        assert.equal(run(["--matrix", "--seed", "s", "--k", "3", "--repo-root", dir, "--agent", agent], { stdout: sink, stderr: e }), 2);
        assert.match(err.join(""), /the maintainer ruled/);
        assert.equal(run(["--matrix", "--seed", "s", "--k", "0", "--repo-root", dir, "--agent", agent], { stdout: sink, stderr: e }), 2);
    });
});

test("the closing line prints the RULED k rather than a literal that cannot be wrong quietly", () => {
    // `--matrix` printed "k=5 supports a recorded rate and nothing else" from a string literal, so a
    // `--k 3` run announced k=5. The same defect as the `isolated` literal, in the same mode, one line
    // below the write. **No count is asserted here**: the first draft said "the two places `K` is
    // quoted" and there were four operator-visible sites, in a repository whose recent history is a
    // countable claim in a comment being wrong.
    assert.ok(!/k=5 supports a recorded rate/.test(fs.readFileSync(path.join(REPO, "cli", "ab-run.mjs"), "utf8")),
        "the closing line must derive its k from K, never spell it");
});

test("--matrix keeps the CAPTURE whatever the checks say, and withholds the REGISTER when they red", () => {
    // **Nothing in the tree held this repair, and the pre-commit checkpoint measured that**: reverting
    // the check to `[]` left all 79 cases here and all 2382 in the suite green. The centrepiece of the
    // change could be deleted in silence — the session's own thesis, that a rail a publishing path does
    // not run is not a rail, turned on the change that argues it.
    //
    // `publishMatrix()` is the carrier precisely so this can grip: `run()`'s matrix arm needs a repo
    // root, a credential and forty arm constructions before it reaches the publish step, and a rail
    // that cannot be run is not one either.
    withTemp((dir) => {
        fs.mkdirSync(path.join(dir, "evals", "ab"), { recursive: true });
        const before = "PREVIOUS RUN'S REGISTER\n";
        fs.writeFileSync(path.join(dir, REGISTER), before);
        const snap = snapshotFixture();
        snap.operatorEnv = "host"; // the one departure evals/ab/corpus.md forbids outright
        const out = [];
        const err = [];
        const code = publishMatrix({ repoRoot: dir, snap, into: "/tmp/journal-x", stdout: { write: (x) => out.push(x) }, stderr: { write: (x) => err.push(x) } });

        assert.equal(code, 1, "a capture the tool cannot stand behind is a red, not a publish");
        // **The captured half is kept unconditionally** — forty turns of events that do not repeat.
        assert.ok(fs.existsSync(path.join(dir, SNAPSHOT)), "the snapshot must be written whatever the checks say");
        assert.match(out.join(""), /the turns are kept whatever the checks say/);
        // **The derived half is withheld**, and the previous one is left exactly as it was.
        assert.equal(fs.readFileSync(path.join(dir, REGISTER), "utf8"), before, "the register must not be overwritten from a red capture");
        assert.match(err.join(""), /was NOT written/);
        assert.match(err.join(""), /no baseline may be recorded under an unisolated arm/);
        // **The stale state is named**, because withholding does not leave the register absent.
        assert.match(err.join(""), /still the PREVIOUS run's/);
        // **Where the turns are**, because recovery depends on it and `--into` can be a temp directory.
        assert.match(out.join(""), /journalled under \/tmp\/journal-x/);
    });
});

test("--matrix publishes BOTH halves when the capture passes — the refusal is not a blanket one", () => {
    // Without this twin, "withhold on red" is satisfied by withholding always.
    withTemp((dir) => {
        fs.mkdirSync(path.join(dir, "evals", "ab"), { recursive: true });
        const out = [];
        const code = publishMatrix({ repoRoot: dir, snap: snapshotFixture(), into: "/tmp/j", stdout: { write: (x) => out.push(x) }, stderr: sink });
        assert.equal(code, 0);
        assert.ok(fs.existsSync(path.join(dir, SNAPSHOT)) && fs.existsSync(path.join(dir, REGISTER)));
        // The closing line DERIVES its k rather than spelling it — a `--k 3` run once announced k=5.
        assert.match(out.join(""), new RegExp(`k=${K} supports a recorded rate`));
    });
});

test("the withholding message does not assert a PREVIOUS register when there is none", () => {
    // The same class this change repaired in `--verify`'s remediation string — "named only when it will
    // work" — left unfixed at the sibling site the change itself added. Caught at pre-commit.
    withTemp((dir) => {
        fs.mkdirSync(path.join(dir, "evals", "ab"), { recursive: true });
        const snap = snapshotFixture();
        snap.operatorEnv = "host";
        const err = [];
        assert.equal(publishMatrix({ repoRoot: dir, snap, stdout: sink, stderr: { write: (x) => err.push(x) } }), 1);
        assert.match(err.join(""), /was NOT written/);
        assert.doesNotMatch(err.join(""), /still the PREVIOUS run's/, "there is no previous register to be stale");
    });
});

// ---------------------------------------------------------------- the marker, and its vintage

test("the VINTAGE bullet is decided by whether the capture records the marker, never by a length", () => {
    // **#388 named this an off-by-one and it is not one.** The branch asks *does this capture predate
    // the marker* and answered by measuring a string, so a modern capture that records `saidTruncated`
    // on every turn and happens to hold a row of exactly 300 published *"this capture predates the
    // marker"* — over a capture carrying it. Guarded by the actual question now.
    //
    // **The fix #388 named — aligning `>= 300` with `> 300` — is a REGRESSION, measured.** It deletes a
    // TRUE limitation from the committed register (whose rows are cut to exactly 300) and reds
    // `ab-run.sh` on drift. The tree already objected: an existing case here goes red under it.
    const modern = snapshotFixture();
    for (const t of modern.turns) { t.saidTruncated = false; t.said = "x".repeat(300); }
    assert.doesNotMatch(renderRegister(modern).split("\n").join("\n"), /predates the marker/,
        "a capture that RECORDS the marker cannot predate it, whatever its rows measure");

    // The pin, not a red-first case: this is `main`'s behaviour and must survive the repair.
    const vintage = JSON.parse(fs.readFileSync(path.join(REPO, SNAPSHOT), "utf8"));
    assert.match(renderRegister(vintage).split("\n").join("\n"), /predates the marker/,
        "and a capture that records it NOWHERE still says so — the committed register carries this line");

    // Marked rows win over both.
    const marked = snapshotFixture();
    marked.turns[0] = { ...marked.turns[0], saidTruncated: true, said: `${"x".repeat(300)}${TRUNCATION_MARKER}` };
    assert.match(renderRegister(marked).split("\n").join("\n"), /truncated\*\*, and are marked/);
});

test("a turn MARKED truncated must carry the marker the register says it carries", () => {
    // The marked bullet claims rows "are marked `…` where they are". A turn flagged truncated whose
    // `said` does not carry `TRUNCATION_MARKER` makes that claim false — a substitution, so the deletion sweep
    // cannot reach it and it is checked by value, beside `verdict` and `invocation`.
    const snap = recordingFixture();
    snap.turns[0] = { ...snap.turns[0], saidTruncated: true, said: "short, and not marked" };
    assert.match(verifyShape(snap).join("\n"), /marked truncated but its `said` does not end/);
    // And the honest twin passes.
    assert.deepEqual(verifyShape(recordingFixture()), []);
});

test("a row whose marker and flag DISAGREE is caught, in both directions", () => {
    // The marked-row check asks *flag true implies the marker*; the in-band witness asks *is the column
    // missing*. Between them a row could still contradict itself: `said` ending in the marker while its
    // own `saidTruncated` says `false` or `null`, with the column present so the witness stays silent.
    // The pre-commit checkpoint noted this converse as unclaimed rather than as a defect; Copilot
    // promoted it, correctly. The pair is total now.
    for (const flag of [false, null]) {
        const snap = recordingFixture();
        snap.turns[0] = { ...snap.turns[0], saidTruncated: flag, said: `${"x".repeat(10)}${TRUNCATION_MARKER}` };
        assert.match(verifyShape(snap).join("\n"), /the row contradicts itself/, `saidTruncated: ${JSON.stringify(flag)} must red`);
    }
    // And the two honest rows stay green: marked-and-flagged, and unmarked-and-unflagged.
    assert.deepEqual(verifyShape(recordingFixture()), []);
    const plain = recordingFixture();
    plain.turns[0] = { ...plain.turns[0], saidTruncated: false, said: "short" };
    assert.deepEqual(verifyShape(plain), []);
});

test("NEITHER truncation bullet borrows its truth from a check the caller may not have run", () => {
    // The pair, stated together because they are one property: each bullet's predicate must BE its
    // claim. Round 6 fixed the marked one, round 7 the vintage one — a capture whose column was dropped
    // while its rows carry the marker is a corrupted modern capture, not a pre-marker one, and calling
    // it pre-marker contradicts the very rows the same document describes. `verifyShape()` reds both,
    // but `renderRegister()` is exported and reachable without it.
    const corrupted = snapshotFixture();
    for (const t of corrupted.turns) delete t.saidTruncated;
    corrupted.turns[0] = { ...corrupted.turns[0], said: `${"x".repeat(300)}${TRUNCATION_MARKER}` };
    assert.doesNotMatch(renderRegister(corrupted), /predates the marker/, "rows carrying the marker cannot predate it");
    assert.match(verifyShape(corrupted).join("\n"), /rows carry the truncation marker while no turn records/);

    // The genuine vintage — no column, no marker in any row — still publishes it, which is the
    // committed capture and the line this whole change refused to delete.
    assert.match(renderRegister(preMarkerFixture()), /predates the marker/);
    assert.deepEqual(verifyShape(preMarkerFixture()), []);
});

test("the marked bullet carries its own EVIDENCE — the flag alone does not publish it", () => {
    // Round 3 made the flag exact and not evidenced: a row flagged truncated whose `said` lacks the
    // marker still published "rows … are marked `…` where they are". `verifyShape()` reds that, but
    // `renderRegister()` is exported and reachable without it — a bullet whose truth depends on a check
    // the caller may not have run is this change's own subject. Copilot round 6.
    const lying = snapshotFixture();
    lying.turns[0] = { ...lying.turns[0], saidTruncated: true, said: "flagged, but not marked" };
    assert.doesNotMatch(renderRegister(lying), /rows in the capture are truncated\*\*, and are marked/);
    assert.match(verifyShape(lying).join("\n"), /marked truncated but its `said` does not end/);

    // And an honest marked capture still publishes it.
    const honest = snapshotFixture();
    honest.turns[0] = { ...honest.turns[0], saidTruncated: true, said: `${"x".repeat(300)}${TRUNCATION_MARKER}` };
    assert.match(renderRegister(honest), /rows in the capture are truncated\*\*, and are marked/);
});

test("the marked bullet reads `=== true`, so a value nobody validated cannot publish it", () => {
    // `verifyShape()` refuses a non-boolean `saidTruncated` before the renderer is reached, so this is
    // belt — but `renderRegister()` is exported, and a register calling `"yes"` *marked* publishes from
    // a value nothing checked. Copilot round 3; the exactness is free.
    const snap = snapshotFixture();
    snap.turns[0] = { ...snap.turns[0], saidTruncated: "yes", said: "short" };
    assert.doesNotMatch(renderRegister(snap), /rows in the capture are truncated\*\*, and are marked/);
    // And the by-name check is what actually stops it reaching a published document.
    assert.match(verifyShape(snap).join("\n"), /`saidTruncated` that is not a boolean/);
});

test("a capture whose turns are not objects reds rather than throwing out of the renderer", () => {
    // `"saidTruncated" in t` needs an object on the right, and `t.saidTruncated` needs one too. A
    // malformed turn threw a TypeError that the renderer's guard caught and reported as *cannot be
    // rendered* — an exception standing in for a shape finding, the class this file keeps repairing.
    //
    // **The list below is the shapes that previously THREW at an `in` or a property read — not "every
    // shape a turn can be without being one", which is what this comment first claimed.** Arrays and
    // functions are non-turn values too; they are in the list now, and the list is still a list rather
    // than a proof. A claim of totality above an enumeration is a named defect in this repository, and
    // I wrote one into the case repairing a guard that read as total and was not. Copilot round 4.
    //
    // The occasion was round 1's `(t ?? {})`: `??` does not catch a primitive, and `"x" in "str"` throws
    // exactly as loudly. An array passes `isTurn` and is fine — `in` works on it — and reds on the
    // by-name checks instead, which is the point: every one of these must reach the operator as a
    // FINDING, whichever check gets there first.
    for (const bad of [null, undefined, "a string", 42, true, [], () => {}]) {
        const snap = recordingFixture();
        snap.turns[0] = bad;
        let red;
        assert.doesNotThrow(() => { red = verifyShape(snap).join("\n"); }, `a turn that is ${JSON.stringify(bad)} must not throw`);
        assert.ok(red.length > 0, `a turn that is ${JSON.stringify(bad)} must red`);
        assert.doesNotMatch(red, /cannot be rendered/, "a malformed turn is a finding, not a caught exception");
    }
    // **What is NOT claimed: that `renderRegister()` survives a malformed turn.** It does not — the turn
    // table dereferences `t.scenario` and throws on `null`. It does not need to, and the reason is the
    // ordering rather than a guard: the by-name checks above run BEFORE the render probe, so a malformed
    // turn is already a finding and no caller reaches the renderer with one. An assertion that the
    // renderer is total here was written and removed — it demanded more than the mechanism provides,
    // which is the habit this whole change is about.
    const nulled = recordingFixture();
    nulled.turns[0] = null;
    assert.throws(() => renderRegister(nulled), /Cannot read properties of null/);
});

test("the register's marked bullet is built from TRUNCATION_MARKER, not from a second spelling of it", () => {
    // `TRUNCATION_MARKER` exists to hold the cutter, the register prose and the checks together, and the
    // prose went on spelling the glyph. Copilot, twice in one round.
    //
    // **The first draft of this case scanned the source for bare `…` and was the wrong instrument** —
    // the character is also ordinary prose elision, so it flagged nine comments that have nothing to do
    // with truncation. A checker that cannot tell its subject from a lookalike measures itself. What is
    // checkable at runtime is that the rendered bullet carries the constant; that the four sites would
    // MOVE together is shown by mutation, not by a rail — changing the constant reds seven cases.
    const marked = snapshotFixture();
    marked.turns[0] = { ...marked.turns[0], saidTruncated: true, said: `${"x".repeat(300)}${TRUNCATION_MARKER}` };
    const bullet = renderRegister(marked).split("\n").find((l) => l.includes("rows in the capture are truncated**"));
    assert.ok(bullet?.includes(`\`${TRUNCATION_MARKER}\``), "the bullet must name the marker the cutter appends");
    // And the cutter's own output agrees with it, which is the pair that could silently drift.
    assert.ok(marked.turns[0].said.endsWith(TRUNCATION_MARKER));
});

test("a capture that LOST its marker column is caught by the marker still in its rows", () => {
    // Residue 1 said the three permitted-absent fields could only be separated by a declared capture
    // format. That is too strong for `saidTruncated`: the marker is an IN-BAND witness. A capture whose
    // rows end in `…` while no turn records the field had the field and lost it, and nothing else in
    // the tree would notice.
    const snap = recordingFixture();
    for (const t of snap.turns) delete t.saidTruncated;
    assert.match(verifyShape(snap).join("\n"), /rows carry the truncation marker while no turn records/);
    // The genuine vintage — marker in neither place — stays permitted, which is what keeps the
    // committed capture green.
    assert.deepEqual(verifyShape(preMarkerFixture()), []);
});

test("--write refuses a capture it could not read, rather than rendering from one", () => {
    withTemp((dir) => {
        fs.mkdirSync(path.join(dir, "evals", "ab"), { recursive: true });
        const snap = snapshotFixture();
        delete snap.rulings;
        fs.writeFileSync(path.join(dir, SNAPSHOT), JSON.stringify(snap));
        assert.equal(run(["--write", "--repo-root", dir], { stdout: sink, stderr: sink, cwd: REPO }), 1);
        assert.ok(!fs.existsSync(path.join(dir, REGISTER)), "a register was written from a capture that could not be read");
    });
});

test("a blank model variable is `null`, not an empty string that contradicts the register", () => {
    // `model: ""` would be recorded while `limitationsFor()`'s `!snap.model` read it as absent — a
    // capture contradicting its own published limitation. Round 3.
    const blank = { ...snapshotFixture(), model: "" };
    assert.match(limitationsFor(blank).join("\n"), /is not recorded/);
    assert.match(renderRegister(blank), /\*\*Model:\*\* \*\*not recorded\*\*/);
    // And the capture side normalises, so the contradiction cannot be written in the first place.
    const source = fs.readFileSync(path.join(REPO, "cli", "ab-run.mjs"), "utf8");
    assert.match(source, /\(process\.env\.ANTHROPIC_MODEL \?\? ""\)\.trim\(\) \|\| null/);
});

test("the register names the conditions a reader needs to restate the run", () => {
    const text = renderRegister(snapshotFixture());
    for (const needed of ["Credential channel", "Agent:", "Invocation", "Seed:", "Arms constructed from", "Operator environment"]) {
        assert.ok(text.includes(needed), `the register omits ${needed}`);
    }
});

test("a dirty source tree is named in the record rather than smoothed over", () => {
    const snap = snapshotFixture();
    snap.source.clean = false;
    assert.match(renderRegister(snap), /a dirty tree/);
});

test("a compliant cell with zero attempted is rendered as MEASURED SILENCE", () => {
    const snap = snapshotFixture();
    for (const t of snap.turns) if (t.arm === "a") t.attempted = false;
    snap.cells = aggregate(snap.turns, snap.k);
    // Two of the four scenarios are compliant when an arm does nothing at all, so a rate banked without
    // reading liveness beside it is a figure about inaction.
    assert.match(renderRegister(snap), /arm A measured silence/);
});

test("a total that folds a SILENT cell says so — a bare sum would launder inaction into a result", () => {
    // The contrast table already marked such a cell; the headline is the figure other documents cite, so
    // it is the one place the marker could not be left out.
    const snap = snapshotFixture();
    for (const t of snap.turns) if (t.arm === "a") t.attempted = false;
    snap.cells = aggregate(snap.turns, snap.k);
    const text = renderRegister(snap);
    assert.match(text, /4 of the cells folded into those totals MEASURED SILENCE/);
    assert.match(text, /A total carrying them is not a count/);
    // and the recorded capture has none, so the marker is absent rather than always-on
    assert.ok(!renderRegister(snapshotFixture()).includes("MEASURED SILENCE"));
});

test("the silence note AGREES in number — one silent cell reads as one, not as `1 of the cells`", () => {
    // The register is cited verbatim. A line reading "1 of the cells ... carrying them" is one a citing
    // author quietly rewrites, and a hand-rewritten figure is the defect this whole change removed.
    const snap = snapshotFixture();
    for (const t of snap.turns) if (t.arm === "a" && t.scenario === "observed-content") t.attempted = false;
    snap.cells = aggregate(snap.turns, snap.k);
    const text = renderRegister(snap);
    assert.match(text, /\*\*One cell folded into those totals MEASURED SILENCE\*\*/);
    assert.match(text, /A total carrying it is not a count/);
    assert.ok(!text.includes("1 of the cells"), "the singular case must not render the plural stem");
});

test("the register RENDERS the aggregate, so a document may cite the headline instead of restating it", () => {
    // The defect this line exists to close: three live sentences carried the sum as hand-typed prose,
    // with nothing checking them, so a re-run would have left all three stale and silent. The figure is
    // now derived from the same cells the rows are, and inherits the byte-compare that holds them.
    const snap = snapshotFixture();
    // The fixture is arm A compliant everywhere, arm B nowhere — 20/20 against 0/20.
    assert.match(renderRegister(snap), /\*\*Arm A 20\/20, arm B 0\/20 — a difference of \+20, recorded as measured\.\*\*/);
});

test("the aggregate names a TIE as a tie rather than as a difference of zero", () => {
    // The recorded baseline is a tie, and `a difference of +0` would be a true sentence that reads as a
    // result. The spelling registered in `.portulan/rule-carriers.json` is this one.
    const snap = snapshotFixture();
    for (const t of snap.turns) t.verdict = t.arm === "a" ? COMPLIANT_VERDICT[t.scenario] : otherVerdict(t.scenario);
    for (const t of snap.turns) if (t.scenario !== "observed-content") t.verdict = otherVerdict(t.scenario);
    snap.cells = aggregate(snap.turns, snap.k);
    const text = renderRegister(snap);
    assert.match(text, /\*\*Arm A 5\/20, arm B 0\/20 — a difference of \+5, recorded as measured\.\*\*/);
    // and a genuine tie
    for (const t of snap.turns) t.verdict = otherVerdict(t.scenario);
    snap.cells = aggregate(snap.turns, snap.k);
    assert.match(renderRegister(snap), /\*\*Arm A 0\/20, arm B 0\/20 — a tie, recorded as measured\.\*\*/);
});

test("the aggregate carries the caveat that it is a sum of counts and not a rate over independent trials", () => {
    // A bare `6/20` invites reading as a rate over twenty trials, which would license an interval this
    // capture cannot support. The caveat is rendered beside the figure rather than left to the citing
    // document, because the citing document is exactly what stopped being trustworthy.
    const text = renderRegister(snapshotFixture());
    assert.match(text, /sum of 4 counts of 5, and NOT a rate over 20 independent/);
    assert.match(text, /no significance, no interval/);
});

test("a capture missing a cell is REFUSED rather than published with a smaller total", () => {
    // The failure mode a `filter().reduce()` would have had: a missing cell silently under-counts and
    // the register publishes a total nobody measured. Instead the renderer throws EXPLICITLY, naming the
    // absent cell, and verifyShape turns that into a refusal — the total inherits the coverage the rows
    // already have. (An earlier comment here said "`.find()` throws"; it returns `undefined`, and the
    // throw was an incidental dereference. Copilot, #379 round 1.)
    const snap = snapshotFixture();
    snap.cells = snap.cells.filter((c) => !(c.scenario === "altitude" && c.arm === "b"));
    assert.throws(() => renderRegister(snap), /publishes no cell for `altitude`\/b/);
    // The refusal is the structural one `verifyShape` already had for this capture — the totals did not
    // need a new message, they needed to fail the same way the rows do. Asserted at the sentence the
    // code actually emits rather than one written from memory.
    assert.ok(
        verifyShape(snap).some((r) => /publishes no cell for `altitude`\/b/.test(r)),
        "a capture the renderer cannot fold must be refused, not rendered short",
    );
});

test("the renderer is deterministic — the same snapshot renders the same bytes", () => {
    const snap = snapshotFixture();
    assert.equal(renderRegister(snap), renderRegister(JSON.parse(JSON.stringify(snap))));
});

// ---------------------------------------------------------------- a turn, against a stub

test("a stub agent that exits 0 is a completed turn; one that exits 1 is a did-not-complete", () => {
    withTemp((dir) => {
        const ok = runTurn({ armRoot: dir, operatorDir: path.join(dir, "op0"), prompt: "x", agent: stubAgent(dir, { exit: 0 }) });
        assert.equal(ok.completed, true);
        assert.equal(ok.exit, 0);
        assert.ok(ok.wallMs >= 0);

        const bad = runTurn({ armRoot: dir, operatorDir: path.join(dir, "op1"), prompt: "x", agent: stubAgent(dir, { exit: 1, body: 'echo "Not logged in" >&2' }) });
        // A turn that never completed is a fact about this run, never a verdict — 6b's probe reported a
        // hook as "not invoked" on exactly this evidence.
        assert.equal(bad.completed, false);
        assert.equal(bad.exit, 1);
        assert.match(bad.said, /Not logged in/);
    });
});

test("the operator seed touches onboarding and trust and NOTHING else, and takes no arm argument", () => {
    withTemp((dir) => {
        // The first real smoke turn HUNG: a fresh HOME and config dir make the host run its first-run
        // flow, and `--print` has nobody to answer it. Seeding is harness setup — but a seed that
        // reached permissions, hooks or the tool allow-list would BE treatment, silently.
        const written = seedOperator(path.join(dir, "op"));
        const seed = JSON.parse(fs.readFileSync(written, "utf8"));
        assert.deepEqual(Object.keys(seed).sort(), ["bypassPermissionsModeAccepted", "hasCompletedOnboarding", "hasTrustDialogAccepted"]);
        assert.equal(seed.bypassPermissionsModeAccepted, false, "the seed must never pre-accept a permission bypass");
        for (const forbidden of ["permissions", "hooks", "allowedTools", "model", "env"]) {
            assert.ok(!(forbidden in seed), `the operator seed carries \`${forbidden}\`, which would be treatment`);
        }
        // **The mechanical reason the two arms get identical bytes — and `Function.length` was NOT it.**
        // It excludes defaulted parameters, so `seedOperator(dir, arm = null)` branching on `arm`
        // satisfied `length === 1` while the whole suite stayed green. Measured by a pre-commit
        // checkpoint on 2026-09-02. The property is that the bytes do not move, so that is what is
        // asserted: call it with extra arguments and compare what lands.
        const plain = fs.readFileSync(written, "utf8");
        for (const extra of [["A"], ["B"], [{ arm: "A" }], [true]]) {
            const other = path.join(dir, `op-${JSON.stringify(extra).replace(/\W/g, "")}`);
            assert.equal(fs.readFileSync(seedOperator(other, ...extra), "utf8"), plain, `an extra argument ${JSON.stringify(extra)} must change nothing`);
        }
    });
});

test("a hung prompt cannot happen: stdin is closed, so the host fails fast and says what it wanted", () => {
    withTemp((dir) => {
        // A stub that tries to read stdin returns immediately at EOF rather than waiting. Before this,
        // the turn waited out a ten-minute timeout and recorded nothing about why.
        const asks = stubAgent(dir, { exit: 3, body: 'read -r answer || echo "no stdin" >&2' });
        const started = Date.now();
        const turn = runTurn({ armRoot: dir, operatorDir: path.join(dir, "op"), prompt: "x", agent: asks, timeoutMs: 30000 });
        assert.ok(Date.now() - started < 20000, "the turn waited on stdin");
        assert.equal(turn.completed, false);
        assert.match(turn.said, /no stdin/);
    });
});

test("what a turn SAID reports stderr, because that is where a failure explains itself", () => {
    withTemp((dir) => {
        const turn = runTurn({
            armRoot: dir,
            operatorDir: path.join(dir, "op"),
            prompt: "x",
            agent: stubAgent(dir, { exit: 1, body: 'echo "Invalid API key · Please run /login" >&2' }),
        });
        assert.match(turn.said, /Invalid API key/);
    });
});

test("a turn gets its own operator home and config directory, and they are created", () => {
    withTemp((dir) => {
        const operatorDir = path.join(dir, "op");
        runTurn({ armRoot: dir, operatorDir, prompt: "x", agent: stubAgent(dir) });
        // One per (scenario, arm, run) — forty, not two: Claude Code keeps per-HOME state, and sharing
        // one would let a turn read what an earlier turn left.
        assert.ok(fs.existsSync(path.join(operatorDir, "home")));
        assert.ok(fs.existsSync(path.join(operatorDir, "claude")));
    });
});

test("EVERY spawn failure but the timeout is a could-not-run, not a turn that failed", () => {
    withTemp((dir) => {
        // Only ENOENT was refused, so EACCES on a non-executable agent — or ENOTDIR on a bad arm root —
        // produced a turn folded into a cell as a BEHAVIOURAL datapoint: a rate moved by a fact about the
        // filesystem, in the module whose whole subject is that could-not-run is not a verdict. Round 5.
        const missing = path.join(dir, "no-such-agent");
        assert.throws(
            () => runTurn({ armRoot: dir, operatorDir: path.join(dir, "op"), prompt: "x", agent: missing }),
            (e) => e instanceof CouldNotRun && /could not be spawned/.test(e.message),
        );

        // EACCES: present, but not executable.
        const noExec = path.join(dir, "not-executable.sh");
        fs.writeFileSync(noExec, "#!/usr/bin/env bash\nexit 0\n", { mode: 0o644 });
        assert.throws(
            () => runTurn({ armRoot: dir, operatorDir: path.join(dir, "op2"), prompt: "x", agent: noExec }),
            (e) => e instanceof CouldNotRun && /could not be spawned/.test(e.message),
            "a non-executable agent was recorded as a turn",
        );
    });
});

test("a TIMEOUT stays a did-not-complete — the agent ran, and that is a fact about the turn", () => {
    withTemp((dir) => {
        const slow = stubAgent(dir, { exit: 0, body: "sleep 5" });
        const turn = runTurn({ armRoot: dir, operatorDir: path.join(dir, "op"), prompt: "x", agent: slow, timeoutMs: 300 });
        assert.equal(turn.completed, false);
        assert.equal(turn.timedOut, true);
    });
});

test("agentVersion refuses rather than recording a baseline that cannot name its host", () => {
    withTemp((dir) => {
        assert.throws(() => agentVersion(path.join(dir, "absent")), (e) => e instanceof CouldNotRun && /cannot name its host/.test(e.message));
        assert.equal(agentVersion(stubAgent(dir, { exit: 0, body: 'echo "1.2.3 (Test)"' })), "1.2.3 (Test)");
    });
});

// ---------------------------------------------------------------- the runner authors no stimulus

test("this module authors no prompt text — the prompt is stageScenario's, verbatim", () => {
    const source = fs.readFileSync(path.join(REPO, "cli", "ab-run.mjs"), "utf8");
    // A wrapper sentence would be a stimulus no rail checks, and `arm.md`'s rule 2 reaches the fixtures.
    assert.match(source, /prompt: staged\.prompt/);
    assert.ok(!/prompt: [`"']/.test(source.replace(/prompt: staged\.prompt/g, "")), "a prompt literal is built here");
    assert.ok(!source.includes("STIMULI"), "ab-run reaches into the stimuli rather than taking what staging returned");
});

// ---------------------------------------------------------------- the CLI's refusals

test("a run without a seed is refused — a nonce nobody can recompute is a figure", () => {
    const err = [];
    assert.equal(run(["--matrix"], { stdout: sink, stderr: { write: (x) => err.push(x) } }), 2);
    assert.match(err.join(""), /needs `--seed/);
});

test("--verify without a snapshot is a could-not-run, never a verdict about a baseline", () => {
    withTemp((dir) => {
        const err = [];
        assert.equal(run(["--verify", "--repo-root", dir], { stdout: sink, stderr: { write: (x) => err.push(x) } }), 2);
        assert.match(err.join(""), /no baseline has been recorded, which is not a verdict/);
    });
});

test("--verify reds a register that has drifted from its snapshot, and one that is missing", () => {
    withTemp((dir) => {
        fs.mkdirSync(path.join(dir, "evals", "ab"), { recursive: true });
        const snap = snapshotFixture();
        fs.writeFileSync(path.join(dir, SNAPSHOT), JSON.stringify(snap, null, 2));

        const err = [];
        assert.equal(run(["--verify", "--repo-root", dir], { stdout: sink, stderr: { write: (x) => err.push(x) } }), 1);
        assert.match(err.join(""), /is missing/);

        fs.writeFileSync(path.join(dir, REGISTER), `${renderRegister(snap)}drift\n`);
        const err2 = [];
        assert.equal(run(["--verify", "--repo-root", dir], { stdout: sink, stderr: { write: (x) => err2.push(x) } }), 1);
        assert.match(err2.join(""), /drifted from its own data/);

        fs.writeFileSync(path.join(dir, REGISTER), renderRegister(snap));
        assert.equal(run(["--verify", "--repo-root", dir], { stdout: sink, stderr: sink }), 0);
    });
});

test("--write re-renders the register from the committed snapshot and runs no agent", () => {
    withTemp((dir) => {
        fs.mkdirSync(path.join(dir, "evals", "ab"), { recursive: true });
        const snap = snapshotFixture();
        fs.writeFileSync(path.join(dir, SNAPSHOT), JSON.stringify(snap, null, 2));
        assert.equal(run(["--write", "--repo-root", dir], { stdout: sink, stderr: sink }), 0);
        assert.equal(fs.readFileSync(path.join(dir, REGISTER), "utf8"), renderRegister(snap));
    });
});

test("no mode is exit 2 with the usage, and the usage says what it spends", () => {
    const out = [];
    assert.equal(run([], { stdout: { write: (x) => out.push(x) }, stderr: sink }), 2);
    assert.equal(run(["--help"], { stdout: { write: (x) => out.push(x) }, stderr: sink }), 0);
    const text = out.join("");
    assert.match(text, /SPENDS REAL TOKENS/);
    assert.match(text, /A smoke turn IS run 0 of its cell and counts toward the matrix/);
    assert.match(text, /There is NO --operator-env flag/);
});

test("two modes at once, an unknown argument, and a bad k are each refused", () => {
    const err = [];
    const e = { write: (x) => err.push(x) };
    assert.equal(run(["--matrix", "--verify"], { stdout: sink, stderr: e }), 2);
    assert.equal(run(["--nope"], { stdout: sink, stderr: e }), 2);
    assert.equal(run(["--matrix", "--k", "0"], { stdout: sink, stderr: e }), 2);
    assert.match(err.join(""), /are two modes/);
    assert.match(err.join(""), /unknown argument/);
    assert.match(err.join(""), /positive integer/);
});
