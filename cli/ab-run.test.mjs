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
    CREDENTIAL_VARS,
    INVOCATION,
    K,
    LIMITATIONS,
    REGISTER,
    SNAPSHOT,
    aggregate,
    agentVersion,
    credentialChannel,
    dissolvesTheTreatment,
    limitationsFor,
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
    assert.ok(!limitationsFor(withModel).join("\n").includes("is not recorded"), "a recorded model still published the limitation");
    // And the fixed block is carried either way.
    for (const snap of [without, withModel]) assert.equal(limitationsFor(snap)[0], LIMITATIONS[0]);
});

test("the register PRINTS the model, present or absent — a condition in the JSON only is unread", () => {
    assert.match(renderRegister({ ...snapshotFixture(), model: "claude-opus-5" }), /\*\*Model:\*\* `claude-opus-5`/);
    assert.match(renderRegister(snapshotFixture()), /\*\*Model:\*\* \*\*not recorded\*\*/);
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
        assert.ok(long.said.endsWith("…"), "a mid-word cut with no marker leaves a terse message and a clipped one indistinguishable");

        const short = runTurn({ armRoot: dir, operatorDir: path.join(dir, "op2"), prompt: "x", agent: stubAgent(dir, { exit: 0, body: 'echo "brief"' }) });
        assert.equal(short.saidTruncated, false);
        assert.ok(!short.said.endsWith("…"));

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
        // The mechanical reason the two arms get identical bytes, rather than a promise that they do.
        assert.equal(seedOperator.length, 1);
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

test("a missing agent binary is a could-not-run, not a turn that failed", () => {
    withTemp((dir) => {
        assert.throws(
            () => runTurn({ armRoot: dir, operatorDir: path.join(dir, "op"), prompt: "x", agent: path.join(dir, "no-such-agent") }),
            (e) => e instanceof CouldNotRun && /could not run/.test(e.message),
        );
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
