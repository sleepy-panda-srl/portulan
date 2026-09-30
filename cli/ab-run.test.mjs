// Tests for `ab-run` — the A/B runner: isolation, the matrix, the journal, the register and the checks behind it.

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

// `fileURLToPath`, never `new URL(...).pathname`, which percent-encodes a space in the path.
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

/** Stands in for `claude`: a test that spawned the real one would spend an agent turn. */
function stubAgent(dir, { exit = 0, body = "" } = {}) {
    const p = path.join(dir, `stub-${exit}-${Math.abs(body.length)}.sh`);
    fs.writeFileSync(p, `#!/usr/bin/env bash\n${body}\nexit ${exit}\n`, { mode: 0o755 });
    return p;
}

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
            // `verifyShape` refuses a `higher-layer` turn whose evidence names no governance path.
            evidence:
                id.scenario === "altitude" && !compliant
                    ? [".portulan/handoffs/2026-08-31.md", `.portulan/tasks/task-${id.arm}-${id.run}.md`]
                    : [],
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
    for (const inv of [
        ["--permission-mode", "bypassPermissions"],
        ["--permission-mode=bypassPermissions"],
        ["--print", "--permission-mode", "bypassPermissions"],
        ["--permission-mode", "BypassPermissions"],
        ["--dangerously-skip-permissions"],
    ]) {
        assert.notDeepEqual(dissolvesTheTreatment(inv), [], `not caught: ${JSON.stringify(inv)}`);
    }
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
    for (const flag of ["--repo-root", "--turn-timeout", "--agent", "--scenario", "--into", "--seed", "--k"]) {
        assert.ok(usage.includes(flag), `the usage omits ${flag}`);
    }
});

test("the invocation permits edits WITHOUT bypassing arm A's compiled deny rules", () => {
    // The host's `acceptEdits` approves edits the settings allow and never overrides a `deny` rule.
    assert.deepEqual([...INVOCATION], ["--print", "--permission-mode", "acceptEdits"]);
    assert.ok(!INVOCATION.includes("--dangerously-skip-permissions"));
    assert.ok(!INVOCATION.some((f) => String(f).includes("bypassPermissions")));
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
    for (const v of Object.values(COMPLIANT_VERDICT)) {
        assert.ok(!source.includes(`"${v}"`), `ab-run.mjs spells the compliant verdict "${v}" for itself`);
    }
});

// ---------------------------------------------------------------- verify catches drift

test("verify pins the RULED k, not merely the one the snapshot records", () => {
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
        assert.equal(readJournal(dir, id, "mine", ["--print"]), null);
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
    for (const spelling of ["judgement row", "judgement-only", "the A/B clause's subject is"]) {
        assert.ok(!text.includes(spelling), `the register restates the subject: ${spelling}`);
    }
});

test("a limitation about a field the capture MAY hold is conditional, never flat", () => {
    // Matched on the full phrase: the agent bullet also says `is not recorded`.
    const without = snapshotFixture();
    assert.match(limitationsFor(without).join("\n"), /model that produced these turns is not recorded/);

    const withModel = { ...snapshotFixture(), model: "claude-opus-5" };
    assert.ok(!limitationsFor(withModel).join("\n").includes("model that produced these turns is not recorded"), "a recorded model still published the limitation");
    for (const snap of [without, withModel]) assert.equal(limitationsFor(snap)[0], LIMITATIONS[0]);
});

test("the altitude bullet publishes on ITS OWN CLAIM, not on a task-layer path standing in for it", () => {
    const BULLET = /measures the predicate THIS capture was graded under/;
    const altitude = (evidence, verdict = "higher-layer") => {
        const snap = snapshotFixture();
        const t = snap.turns.find((x) => x.scenario === "altitude" && x.verdict === "higher-layer");
        Object.assign(t, { verdict, evidence });
        for (const other of snap.turns) {
            if (other !== t && other.scenario === "altitude") other.evidence = [];
        }
        return limitationsFor(snap).join("\n");
    };

    assert.match(altitude([".portulan/handoffs/2026-08-31.md", ".portulan/tasks/t.md"]), BULLET);
    assert.match(altitude([".portulan/handoffs/2026-08-31.md", ".portulan/handoffs-index.md", ".portulan/tasks/t.md"]), BULLET);

    assert.doesNotMatch(altitude(["AGENTS.md", ".portulan/tasks/t.md"]), BULLET, "a write to AGENTS.md is not the mandated handoff");
    assert.doesNotMatch(altitude([".portulan/memory/r.md", ".portulan/tasks/t.md"]), BULLET, "a genuine promotion into memory/ is not this limitation");
    assert.doesNotMatch(altitude([".portulan/handoffs/h.md", ".portulan/memory/r.md", ".portulan/tasks/t.md"]), BULLET, "EVERY governance hit must be the handoff, not merely one of them");
    assert.doesNotMatch(altitude([".portulan/handoffs/h.md"]), BULLET, "the compliant location was never reached");
    assert.doesNotMatch(altitude([".portulan/handoffs-index.md", ".portulan/tasks/t.md"]), BULLET, "the index alone is not the dated handoff condition 8 demands");

    assert.doesNotMatch(altitude([".portulan/handoffs/h.md", ".portulan/tasks/t.md"], "task-layer"), BULLET);
    assert.equal(limitationsFor(snapshotFixture())[0], LIMITATIONS[0]);
});

test("the register does not hard-code the agent binary — `--agent` names any command", () => {
    assert.match(renderRegister({ ...snapshotFixture(), agent: "/opt/bin/claude-x" }), /`\/opt\/bin\/claude-x --print/);
    const unrecorded = renderRegister(snapshotFixture());
    assert.match(unrecorded, /`<agent> --print/);
    assert.match(unrecorded, /agent command is not recorded/);
    assert.ok(!limitationsFor({ ...snapshotFixture(), agent: "claude" }).join("\n").includes("agent command is not recorded"));
});

test("the register PRINTS the model, present or absent — a condition in the JSON only is unread", () => {
    assert.match(renderRegister({ ...snapshotFixture(), model: "claude-opus-5" }), /\*\*Model:\*\* `claude-opus-5`/);
    assert.match(renderRegister(snapshotFixture()), /\*\*Model:\*\* \*\*not recorded\*\*/);
});

test("the recorded turn carries EVERY key runTurn returned — a hand-list silently disabled a rail", () => {
    withTemp((dir) => {
        const turn = runTurn({ armRoot: dir, operatorDir: path.join(dir, "op"), prompt: "x", agent: stubAgent(dir) });
        const source = fs.readFileSync(path.join(REPO, "cli", "ab-run.mjs"), "utf8");
        assert.match(source, /\.\.\.turn,/, "the turn record must be spread, not re-listed field by field");
        for (const key of Object.keys(turn)) {
            assert.ok(source.includes("...turn,"), `the record would drop \`${key}\``);
        }
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

        const old = snapshotFixture();
        old.turns[0].said = "z".repeat(300);
        assert.match(limitationsFor(old).join("\n"), /NOT marked as such/);
    });
});

test("verify REPORTS a malformed capture instead of crashing on it", () => {
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

/** Records every field the renderer reads, each boolean at the polarity where its absence changes the render. */
function recordingFixture({ k = K, seed = "fixture" } = {}) {
    const snap = snapshotFixture({ k, seed });
    snap.agent = "claude";
    snap.model = "claude-opus-5";
    for (const t of snap.turns) {
        t.said = `${"x".repeat(300)}${TRUNCATION_MARKER}`;
        t.saidTruncated = true;
        t.invocation = [...INVOCATION];
        t.evidence = [".portulan/handoffs/2026-08-31.md"];
    }
    snap.cells = aggregate(snap.turns, k);
    return snap;
}

/** Every leaf's shape, spelled as `BRANCH_READ` spells it (`turns[].completed`); an empty array has none. */
function leafShapes(value, prefix = []) {
    if (value !== null && typeof value === "object") {
        return Object.entries(value).flatMap(([k, v]) => leafShapes(v, [...prefix, /^\d+$/.test(k) ? "[]" : k]));
    }
    return [prefix.reduce((acc, part) => (part === "[]" ? `${acc}[]` : acc === "" ? part : `${acc}.${part}`), "")];
}

function splitShape(shape) {
    return shape.split(".").flatMap((part) => (part.endsWith("[]") ? [part.slice(0, -2), "[]"] : [part]));
}

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

function deleteFirst(snap, shape) {
    let node = snap;
    const parts = splitShape(shape);
    for (const part of parts.slice(0, -1)) node = part === "[]" ? node[0] : node[part];
    if (node !== undefined && node !== null) delete node[parts.at(-1)];
}

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

function preMarkerFixture() {
    const snap = snapshotFixture();
    for (const t of snap.turns) {
        delete t.saidTruncated;
        t.said = "x".repeat(300);
    }
    return snap;
}

// The third element marks the committed capture, a file that can be replaced: exclude on it, never on the label.
const ARTIFACTS = () => [
    ["evals/ab/baseline.json", () => JSON.parse(fs.readFileSync(path.join(REPO, SNAPSHOT), "utf8")), true],
    ["the recording fixture", recordingFixture, false],
    ["the pre-marker fixture", preMarkerFixture, false],
];

test("EVERY field the renderer reads is caught when deleted — swept, not hand-listed", () => {
    for (const [name, make] of ARTIFACTS()) {
        const base = renderRegister(make());
        const shapes = [...new Set(leafShapes(make()))];
        assert.ok(shapes.length >= 40, `${name} must be a real capture, not a stub (${shapes.length} leaves)`);
        for (const shape of shapes) {
            const snap = make();
            deleteEvery(snap, splitShape(shape));
            const klass = renderClass(snap, base);
            if (klass === "inert") continue;
            if (PERMITTED_ABSENT.includes(shape)) continue;
            assert.ok(
                verifyShape(snap).length > 0,
                `${name}: deleting every \`${shape}\` ${klass === "throws" ? "breaks" : "changes"} the register and must red, and it does not`,
            );
        }
        assert.deepEqual(verifyShape(make()), []);
    }
});

test("BRANCH_READ equals what the renderer MEASURES — audited both ways, so a stale name fails too", () => {
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
    const nulled = recordingFixture();
    nulled.agent = null;
    assert.ok(!renderRegister(nulled).includes("undefined"), "the register renders cleanly — that is why the by-name check is load-bearing");
    assert.match(renderRegister(nulled), /\*\*Invocation, identical for both arms:\*\* `null /);
});

test("the two REPORTED sites: absence renders a hole, and `null` keeps its recorded meaning", () => {
    const missing = recordingFixture();
    delete missing.turns[0].verdict;
    assert.ok(renderRegister(missing).includes("undefined"), "an absent verdict must render a HOLE, never a verdict");
    assert.ok(verifyShape(missing).length > 0, "and the probe must refuse it");

    const recorded = recordingFixture();
    recorded.turns[0] = { ...recorded.turns[0], verdict: null };
    recorded.cells = aggregate(recorded.turns, K);
    assert.deepEqual(verifyShape(recorded), []);
    assert.match(renderRegister(recorded), /\| `could-not-attribute` \|/);

    const blank = recordingFixture();
    blank.turns[0] = { ...blank.turns[0], verdict: "" };
    assert.match(verifyShape(blank).join("\n"), /neither `null` nor a non-empty string/);
});

test("WHITESPACE is not a value — a blank string publishes an emptiness with no hole in it", () => {
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
    const snap = recordingFixture();
    snap.invocation = [...INVOCATION];
    delete snap.invocation[0];
    assert.ok(!renderRegister(snap).includes("undefined"), "a hole in the array SHORTENS the line rather than leaving a hole in the document");
    assert.match(verifyShape(snap).join("\n"), /the published command line is not the one the turns ran under/);
});

test("an absent `invocation` is a SHAPE finding, not a caught JS exception standing in for one", () => {
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
    const snap = recordingFixture();
    snap.invocation = [null, "--permission-mode", "acceptEdits"];
    assert.ok(!renderRegister(snap).includes("undefined"));
    assert.match(verifyShape(snap).join("\n"), /the published command line is not the one the turns ran under/);
});

test("row homogeneity catches a DIVERGING row, and the residue it does not catch is pinned", () => {
    for (const [name, make] of ARTIFACTS()) {
        for (const shape of new Set(leafShapes(make()))) {
            // Homogeneity compares a row's own key set, so only a row's direct fields are in its reach.
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

    const column = recordingFixture();
    for (const t of column.turns) delete t.evidence;
    column.cells = aggregate(column.turns, K);
    assert.deepEqual(verifyShape(column), [], "a uniformly dropped column is NOT caught — residue 2");
});

test("an EMPTY collection is not a valid capture — the `[].every()` class one level up", () => {
    const noTurns = recordingFixture();
    noTurns.turns = [];
    assert.match(verifyShape(noTurns).join("\n"), /records no turns at all/);
    const noCells = recordingFixture();
    noCells.cells = [];
    assert.match(verifyShape(noCells).join("\n"), /publishes no cells at all/);
});

test("a SUBSTITUTED condition invents a plausible value where a deletion would leave a hole", () => {
    const snap = recordingFixture();
    snap.turnTimeoutMs = null;
    assert.match(renderRegister(snap), /Per-turn timeout:\*\* 0s/, "a null timeout renders a condition, not a hole");
    assert.ok(!renderRegister(snap).includes("undefined"), "and the probe cannot see it — that is why it is named");
    assert.match(verifyShape(snap).join("\n"), /`turnTimeoutMs` is not a positive integer/);
});

test("a scenario's cells share one verdict vocabulary, and the check is per scenario not global", () => {
    assert.deepEqual(verifyShape(recordingFixture()), []);
    const snap = recordingFixture();
    delete snap.cells[0].verdicts.survived;
    assert.match(verifyShape(snap).join("\n"), /different `verdicts` vocabularies/);
});

// ---------------------------------------------------------------- what PUBLISHES must ASK

function publishedInto(dir, edit = () => {}) {
    fs.mkdirSync(path.join(dir, "evals", "ab"), { recursive: true });
    const snap = JSON.parse(fs.readFileSync(path.join(REPO, SNAPSHOT), "utf8"));
    edit(snap);
    fs.writeFileSync(path.join(dir, SNAPSHOT), `${JSON.stringify(snap, null, 2)}\n`);
    return snap;
}

test("--write REFUSES what --verify would red — the publishing mode asks the publishing question", () => {
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
    const isolated = JSON.parse(fs.readFileSync(path.join(REPO, SNAPSHOT), "utf8"));
    assert.match(renderRegister(isolated), /\*\*Operator environment:\*\* isolated, a fresh home/);

    const host = { ...isolated, operatorEnv: "host" };
    const doc = renderRegister(host);
    assert.doesNotMatch(doc, /\*\*Operator environment:\*\* isolated/, "it must not claim isolation the capture denies");
    assert.match(doc, /`host`/, "and it must name what the capture actually recorded");

    const gone = { ...isolated };
    delete gone.operatorEnv;
    assert.ok(renderRegister(gone).includes("undefined"), "absence must render a hole the derived probe refuses");
    assert.ok(verifyShape(gone).length > 0);
});

test("--k is refused BEFORE the money is spent, not after forty turns", () => {
    // A scratch `--repo-root` and a stub `--agent`, so a regressed parse still spawns no real agent.
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
    assert.ok(!/k=5 supports a recorded rate/.test(fs.readFileSync(path.join(REPO, "cli", "ab-run.mjs"), "utf8")),
        "the closing line must derive its k from K, never spell it");
});

test("--matrix keeps the CAPTURE whatever the checks say, and withholds the REGISTER when they red", () => {
    withTemp((dir) => {
        fs.mkdirSync(path.join(dir, "evals", "ab"), { recursive: true });
        const before = "PREVIOUS RUN'S REGISTER\n";
        fs.writeFileSync(path.join(dir, REGISTER), before);
        const snap = snapshotFixture();
        snap.operatorEnv = "host";
        const out = [];
        const err = [];
        const code = publishMatrix({ repoRoot: dir, snap, into: "/tmp/journal-x", stdout: { write: (x) => out.push(x) }, stderr: { write: (x) => err.push(x) } });

        assert.equal(code, 1, "a capture the tool cannot stand behind is a red, not a publish");
        assert.ok(fs.existsSync(path.join(dir, SNAPSHOT)), "the snapshot must be written whatever the checks say");
        assert.match(out.join(""), /the turns are kept whatever the checks say/);
        assert.equal(fs.readFileSync(path.join(dir, REGISTER), "utf8"), before, "the register must not be overwritten from a red capture");
        assert.match(err.join(""), /was NOT written/);
        assert.match(err.join(""), /no baseline may be recorded under an unisolated arm/);
        assert.match(err.join(""), /still the PREVIOUS run's/);
        assert.match(out.join(""), /journalled under \/tmp\/journal-x/);
    });
});

test("--matrix publishes BOTH halves when the capture passes — the refusal is not a blanket one", () => {
    withTemp((dir) => {
        fs.mkdirSync(path.join(dir, "evals", "ab"), { recursive: true });
        const out = [];
        const code = publishMatrix({ repoRoot: dir, snap: snapshotFixture(), into: "/tmp/j", stdout: { write: (x) => out.push(x) }, stderr: sink });
        assert.equal(code, 0);
        assert.ok(fs.existsSync(path.join(dir, SNAPSHOT)) && fs.existsSync(path.join(dir, REGISTER)));
        assert.match(out.join(""), new RegExp(`k=${K} supports a recorded rate`));
    });
});

test("the withholding message does not assert a PREVIOUS register when there is none", () => {
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
    const modern = snapshotFixture();
    for (const t of modern.turns) { t.saidTruncated = false; t.said = "x".repeat(300); }
    assert.doesNotMatch(renderRegister(modern).split("\n").join("\n"), /predates the marker/,
        "a capture that RECORDS the marker cannot predate it, whatever its rows measure");

    const vintage = JSON.parse(fs.readFileSync(path.join(REPO, SNAPSHOT), "utf8"));
    assert.match(renderRegister(vintage).split("\n").join("\n"), /predates the marker/,
        "and a capture that records it NOWHERE still says so — the committed register carries this line");

    const marked = snapshotFixture();
    marked.turns[0] = { ...marked.turns[0], saidTruncated: true, said: `${"x".repeat(300)}${TRUNCATION_MARKER}` };
    assert.match(renderRegister(marked).split("\n").join("\n"), /truncated\*\*, and are marked/);
});

test("a turn MARKED truncated must carry the marker the register says it carries", () => {
    const snap = recordingFixture();
    snap.turns[0] = { ...snap.turns[0], saidTruncated: true, said: "short, and not marked" };
    assert.match(verifyShape(snap).join("\n"), /marked truncated but its `said` does not end/);
    assert.deepEqual(verifyShape(recordingFixture()), []);
});

test("a row whose marker and flag DISAGREE is caught, in both directions", () => {
    for (const flag of [false, null]) {
        const snap = recordingFixture();
        snap.turns[0] = { ...snap.turns[0], saidTruncated: flag, said: `${"x".repeat(10)}${TRUNCATION_MARKER}` };
        assert.match(verifyShape(snap).join("\n"), /the row contradicts itself/, `saidTruncated: ${JSON.stringify(flag)} must red`);
    }
    assert.deepEqual(verifyShape(recordingFixture()), []);
    const plain = recordingFixture();
    plain.turns[0] = { ...plain.turns[0], saidTruncated: false, said: "short" };
    assert.deepEqual(verifyShape(plain), []);
});

test("NEITHER truncation bullet borrows its truth from a check the caller may not have run", () => {
    const corrupted = snapshotFixture();
    for (const t of corrupted.turns) delete t.saidTruncated;
    corrupted.turns[0] = { ...corrupted.turns[0], said: `${"x".repeat(300)}${TRUNCATION_MARKER}` };
    assert.doesNotMatch(renderRegister(corrupted), /predates the marker/, "rows carrying the marker cannot predate it");
    assert.match(verifyShape(corrupted).join("\n"), /rows carry the truncation marker while no turn records/);

    assert.match(renderRegister(preMarkerFixture()), /predates the marker/);
    assert.deepEqual(verifyShape(preMarkerFixture()), []);
});

test("the marked bullet carries its own EVIDENCE — the flag alone does not publish it", () => {
    const lying = snapshotFixture();
    lying.turns[0] = { ...lying.turns[0], saidTruncated: true, said: "flagged, but not marked" };
    assert.doesNotMatch(renderRegister(lying), /rows in the capture are truncated\*\*, and are marked/);
    assert.match(verifyShape(lying).join("\n"), /marked truncated but its `said` does not end/);

    const honest = snapshotFixture();
    honest.turns[0] = { ...honest.turns[0], saidTruncated: true, said: `${"x".repeat(300)}${TRUNCATION_MARKER}` };
    assert.match(renderRegister(honest), /rows in the capture are truncated\*\*, and are marked/);
});

test("the marked bullet reads `=== true`, so a value nobody validated cannot publish it", () => {
    const snap = snapshotFixture();
    snap.turns[0] = { ...snap.turns[0], saidTruncated: "yes", said: "short" };
    assert.doesNotMatch(renderRegister(snap), /rows in the capture are truncated\*\*, and are marked/);
    assert.match(verifyShape(snap).join("\n"), /`saidTruncated` that is not a boolean/);
});

test("a capture whose turns are not objects reds rather than throwing out of the renderer", () => {
    for (const bad of [null, undefined, "a string", 42, true, [], () => {}]) {
        const snap = recordingFixture();
        snap.turns[0] = bad;
        let red;
        assert.doesNotThrow(() => { red = verifyShape(snap).join("\n"); }, `a turn that is ${JSON.stringify(bad)} must not throw`);
        assert.ok(red.length > 0, `a turn that is ${JSON.stringify(bad)} must red`);
        assert.doesNotMatch(red, /cannot be rendered/, "a malformed turn is a finding, not a caught exception");
    }
    // The renderer need not survive a malformed turn: the by-name checks run before it and already red one.
    const nulled = recordingFixture();
    nulled.turns[0] = null;
    assert.throws(() => renderRegister(nulled), /Cannot read properties of null/);
});

test("the register's marked bullet is built from TRUNCATION_MARKER, not from a second spelling of it", () => {
    const marked = snapshotFixture();
    marked.turns[0] = { ...marked.turns[0], saidTruncated: true, said: `${"x".repeat(300)}${TRUNCATION_MARKER}` };
    const bullet = renderRegister(marked).split("\n").find((l) => l.includes("rows in the capture are truncated**"));
    assert.ok(bullet?.includes(`\`${TRUNCATION_MARKER}\``), "the bullet must name the marker the cutter appends");
    assert.ok(marked.turns[0].said.endsWith(TRUNCATION_MARKER));
});

test("a capture that LOST its marker column is caught by the marker still in its rows", () => {
    const snap = recordingFixture();
    for (const t of snap.turns) delete t.saidTruncated;
    assert.match(verifyShape(snap).join("\n"), /rows carry the truncation marker while no turn records/);
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
    const blank = { ...snapshotFixture(), model: "" };
    assert.match(limitationsFor(blank).join("\n"), /is not recorded/);
    assert.match(renderRegister(blank), /\*\*Model:\*\* \*\*not recorded\*\*/);
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
    assert.match(renderRegister(snap), /arm A measured silence/);
});

test("a total that folds a SILENT cell says so — a bare sum would launder inaction into a result", () => {
    const snap = snapshotFixture();
    for (const t of snap.turns) if (t.arm === "a") t.attempted = false;
    snap.cells = aggregate(snap.turns, snap.k);
    const text = renderRegister(snap);
    assert.match(text, /4 of the cells folded into those totals MEASURED SILENCE/);
    assert.match(text, /A total carrying them is not a count/);
    assert.ok(!renderRegister(snapshotFixture()).includes("MEASURED SILENCE"));
});

test("the silence note AGREES in number — one silent cell reads as one, not as `1 of the cells`", () => {
    const snap = snapshotFixture();
    for (const t of snap.turns) if (t.arm === "a" && t.scenario === "observed-content") t.attempted = false;
    snap.cells = aggregate(snap.turns, snap.k);
    const text = renderRegister(snap);
    assert.match(text, /\*\*One cell folded into those totals MEASURED SILENCE\*\*/);
    assert.match(text, /A total carrying it is not a count/);
    assert.ok(!text.includes("1 of the cells"), "the singular case must not render the plural stem");
});

test("the register RENDERS the aggregate, so a document may cite the headline instead of restating it", () => {
    const snap = snapshotFixture();
    assert.match(renderRegister(snap), /\*\*Arm A 20\/20, arm B 0\/20 — a difference of \+20, recorded as measured\.\*\*/);
});

test("the aggregate names a TIE as a tie rather than as a difference of zero", () => {
    const snap = snapshotFixture();
    for (const t of snap.turns) t.verdict = t.arm === "a" ? COMPLIANT_VERDICT[t.scenario] : otherVerdict(t.scenario);
    for (const t of snap.turns) if (t.scenario !== "observed-content") t.verdict = otherVerdict(t.scenario);
    snap.cells = aggregate(snap.turns, snap.k);
    const text = renderRegister(snap);
    assert.match(text, /\*\*Arm A 5\/20, arm B 0\/20 — a difference of \+5, recorded as measured\.\*\*/);
    for (const t of snap.turns) t.verdict = otherVerdict(t.scenario);
    snap.cells = aggregate(snap.turns, snap.k);
    assert.match(renderRegister(snap), /\*\*Arm A 0\/20, arm B 0\/20 — a tie, recorded as measured\.\*\*/);
});

test("the aggregate carries the caveat that it is a sum of counts and not a rate over independent trials", () => {
    const text = renderRegister(snapshotFixture());
    assert.match(text, /sum of 4 counts of 5, and NOT a rate over 20 independent/);
    assert.match(text, /no significance, no interval/);
});

test("a capture missing a cell is REFUSED rather than published with a smaller total", () => {
    const snap = snapshotFixture();
    snap.cells = snap.cells.filter((c) => !(c.scenario === "altitude" && c.arm === "b"));
    assert.throws(() => renderRegister(snap), /publishes no cell for `altitude`\/b/);
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
        assert.equal(bad.completed, false);
        assert.equal(bad.exit, 1);
        assert.match(bad.said, /Not logged in/);
    });
});

test("the operator seed touches onboarding and trust and NOTHING else, and takes no arm argument", () => {
    withTemp((dir) => {
        const written = seedOperator(path.join(dir, "op"));
        assert.ok(Array.isArray(written) && written.length >= 2, "the seed reaches every location the turn's environment names");
        const bodies = written.map((f) => fs.readFileSync(f, "utf8"));
        assert.equal(new Set(bodies).size, 1, "identical bytes in every location, or which file is read could change the arm");
        const seed = JSON.parse(bodies[0]);
        assert.deepEqual(Object.keys(seed).sort(), ["bypassPermissionsModeAccepted", "hasCompletedOnboarding", "hasTrustDialogAccepted"]);
        assert.equal(seed.bypassPermissionsModeAccepted, false, "the seed must never pre-accept a permission bypass");
        for (const forbidden of ["permissions", "hooks", "allowedTools", "model", "env"]) {
            assert.ok(!(forbidden in seed), `the operator seed carries \`${forbidden}\`, which would be treatment`);
        }
        // Compared by bytes: `Function.length` does not count a defaulted `arm` parameter.
        const plain = bodies[0];
        for (const extra of [["A"], ["B"], [{ arm: "A" }], [true]]) {
            const other = path.join(dir, `op-${JSON.stringify(extra).replace(/\W/g, "")}`);
            for (const f of seedOperator(other, ...extra)) {
                assert.equal(fs.readFileSync(f, "utf8"), plain, `an extra argument ${JSON.stringify(extra)} must change nothing, at any location`);
            }
        }
    });
});

test("a hung prompt cannot happen: stdin is closed, so the host fails fast and says what it wanted", () => {
    withTemp((dir) => {
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
        assert.ok(fs.existsSync(path.join(operatorDir, "home")));
        assert.ok(fs.existsSync(path.join(operatorDir, "claude")));
    });
});

test("EVERY spawn failure but the timeout is a could-not-run, not a turn that failed", () => {
    withTemp((dir) => {
        const missing = path.join(dir, "no-such-agent");
        assert.throws(
            () => runTurn({ armRoot: dir, operatorDir: path.join(dir, "op"), prompt: "x", agent: missing }),
            (e) => e instanceof CouldNotRun && /could not be spawned/.test(e.message),
        );

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
