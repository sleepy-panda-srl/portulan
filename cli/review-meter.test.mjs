// The review-loop meter's suite. Every counting trap this repository has already PAID to discover is
// a case here, because the whole argument for the tool is that a hand count kept getting them wrong —
// a suite that only exercised the happy path would be the hand count with more steps.
//
// The traps, each traceable to a measurement on this repository rather than to a guess:
//   * one actor, two logins — a filter on either surface returns zero from the other (#154)
//   * our own reviews sit on the same endpoint and inflate the count (#105: 6 of 15; #342: 74 of 81)
//   * an inline comment belongs to the review that carried it, grouped on `pull_request_review_id`
//   * the entry guard must survive a path containing a space — this file's subject shipped the broken
//     spelling and `--fetch` exited 0 having written nothing, the FOURTH time here
//   * a malformed snapshot is could-not-run, never a review loop measuring zero

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
    meter,
    meterPullRequest,
    validateSnapshot,
    renderRegister,
    selectWindow,
    shapeSubmissions,
    run,
    SNAPSHOT_VERSION,
    RETIRE_THRESHOLD,
} from "./review-meter.mjs";

const TOOL = fileURLToPath(new URL("./review-meter.mjs", import.meta.url));

const submission = (over = {}) => ({
    id: 1,
    login: "copilot-pull-request-reviewer[bot]",
    state: "COMMENTED",
    head: "aaaaaaa",
    at: "2026-08-01T00:00:00Z",
    inline: 0,
    ...over,
});

// Every fixture is stamped with a DESCENDING `mergedAt` and a `window` matching its own corpus, so a
// case asserting something else has to say so. Both contracts arrived at the pre-commit checkpoint:
// the window is by merge date and must prove it, and a window heading that disagrees with the corpus
// under it is a false heading over true figures.
const snapshotOf = (pullRequests) => ({
    portulan: { reviewSnapshot: SNAPSHOT_VERSION },
    repository: "sleepy-panda-srl/portulan",
    captured: "2026-08-26T00:00:00Z",
    window: { merged: pullRequests.length, pool: 200, poolSaturated: false },
    pullRequests: pullRequests.map((pr, i) => ({
        mergedAt: `2026-08-${String(26 - i).padStart(2, "0")}T00:00:00Z`,
        ...pr,
    })),
});

const collect = () => {
    const out = [];
    const err = [];
    return { io: { log: (m = "") => out.push(String(m)), error: (m = "") => err.push(String(m)) }, out, err };
};

const withTemp = (fn) => {
    const dir = mkdtempSync(join(tmpdir(), "review-meter-"));
    try {
        return fn(dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
};

// ------------------------------------------------------------------------------- the arithmetic

test("a pull request's pushes are its DISTINCT reviewed heads, not its submission count", () => {
    const m = meterPullRequest({
        number: 1,
        submissions: [
            submission({ id: 1, head: "aaa", inline: 2 }),
            submission({ id: 2, head: "aaa", inline: 0 }),
            submission({ id: 3, head: "bbb", inline: 0 }),
        ],
    });
    assert.equal(m.submissions, 3);
    assert.equal(m.pushes, 2);
    assert.equal(m.noInline, 2);
    assert.equal(m.findingBearing, 1);
});

test("the aggregate reports ratios, and a coincidence between pushes and submissions is FLAGGED", () => {
    // One head per submission is the shape `review_on_push: true` produces, and it makes
    // pushes-per-finding-bearing-submission an identity rather than a measurement. Measured on the
    // 2026-08-26 capture: 140 submissions, 140 pushes, 3.04 = 1/(1 - 0.671).
    const m = meter(
        snapshotOf([
            { number: 1, submissions: [submission({ id: 1, head: "a", inline: 1 }), submission({ id: 2, head: "b", inline: 0 })] },
            { number: 2, submissions: [submission({ id: 3, head: "c", inline: 0 })] },
        ]),
    );
    assert.equal(m.submissions, 3);
    assert.equal(m.pushes, 3);
    assert.equal(m.pushesCoincideWithSubmissions, true);
    assert.equal(m.submissionsPerPullRequest, 1.5);
    assert.equal(m.noInline, 2);
    // The identity, asserted rather than described — within a tolerance, because it is exact in
    // arithmetic and not in IEEE 754: 3 and 2.9999999999999996 are the same number here and are not
    // the same double. Asserting equality outright failed on the first run of this suite.
    assert.ok(Math.abs(m.pushesPerFindingBearingSubmission - 1 / (1 - m.noInlineRate)) < 1e-9);
});

test("a repeated head breaks the coincidence, and the flag goes with it", () => {
    const m = meter(snapshotOf([{ number: 1, submissions: [submission({ id: 1, head: "a" }), submission({ id: 2, head: "a" })] }]));
    assert.equal(m.pushes, 1);
    assert.equal(m.submissions, 2);
    assert.equal(m.pushesCoincideWithSubmissions, false);
});

test("an empty denominator yields null, never zero — an unmeasured loop is not a quiet one", () => {
    const m = meter(snapshotOf([]));
    assert.equal(m.submissionsPerPullRequest, null);
    assert.equal(m.noInlineRate, null);
    assert.equal(m.pushesPerFindingBearingSubmission, null);
    // And an unmeasured window is NOT a window below the retirement threshold. Conflating the two is
    // how a rule gets retired on a corpus nobody captured.
    assert.equal(m.belowRetireThreshold, null);
});

test("a corpus with no finding-bearing submission has no ratio for one, and does not divide by zero", () => {
    const m = meter(snapshotOf([{ number: 1, submissions: [submission({ inline: 0 })] }]));
    assert.equal(m.findingBearing, 0);
    assert.equal(m.pushesPerFindingBearingSubmission, null);
    assert.equal(m.noInlineRate, 1);
});

test("the retirement threshold is reported on the side the record states, not near it", () => {
    const below = meter(snapshotOf([{ number: 1, submissions: [submission()] }]));
    assert.equal(below.submissionsPerPullRequest, 1);
    assert.equal(below.belowRetireThreshold, true);
    const at = meter(
        snapshotOf([{ number: 1, submissions: [submission({ id: 1, head: "a" }), submission({ id: 2, head: "b" })] }]),
    );
    // Exactly AT the threshold is not below it — the record says *below*, and a boundary read the
    // generous way retires a rule the measurement did not retire.
    assert.equal(at.submissionsPerPullRequest, RETIRE_THRESHOLD);
    assert.equal(at.belowRetireThreshold, false);
});

// -------------------------------------------------------------------- the snapshot's own contract

test("a snapshot carrying a NON-REVIEWER review is could-not-judge, not a busy loop", () => {
    // The trap in one case: our own replies and derived verdicts are submitted as REVIEWS. On #105
    // six of fifteen review objects were `portulan-agent[bot]`; on #342, seventy-four of eighty-one.
    // A snapshot that let one through would inflate every figure in the register with our own traffic.
    const problems = validateSnapshot(
        snapshotOf([{ number: 1, submissions: [submission({ login: "portulan-agent[bot]" })] }]),
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0], /portulan-agent\[bot\].*not the reviewer/);
});

test("BOTH observed reviewer logins are accepted — a filter on one returns zero from the other", () => {
    // `copilot-pull-request-reviewer[bot]` on /reviews, plain `Copilot` on /comments. #154 lost a
    // whole round to an equality test against one spelling.
    const problems = validateSnapshot(
        snapshotOf([
            { number: 1, submissions: [submission({ login: "copilot-pull-request-reviewer[bot]" })] },
            { number: 2, submissions: [submission({ login: "Copilot" })] },
        ]),
    );
    assert.deepEqual(problems, []);
});

test("a snapshot from a future or absent version is refused rather than metered", () => {
    assert.match(validateSnapshot({ ...snapshotOf([]), portulan: { reviewSnapshot: "999" } })[0], /reviewSnapshot/);
    assert.match(validateSnapshot({ ...snapshotOf([]), captured: "" })[0], /captured is missing/);
    assert.deepEqual(validateSnapshot(null), ["the snapshot is not a JSON object"]);
});

test("a duplicated pull request is a finding — the same PR twice doubles every figure it touches", () => {
    const problems = validateSnapshot(
        snapshotOf([{ number: 7, submissions: [submission()] }, { number: 7, submissions: [submission()] }]),
    );
    assert.ok(problems.some((p) => /7 appears twice/.test(p)));
});

test("a submission with no inline COUNT is refused — absent is not zero", () => {
    const problems = validateSnapshot(snapshotOf([{ number: 1, submissions: [{ login: "Copilot" }] }]));
    assert.ok(problems.some((p) => /no inline count/.test(p)));
});

// ------------------------------------------------------------------------------ the register rail

test("the register is byte-compared, so a hand-edit is a red rather than a survival", () =>
    withTemp((dir) => {
        const snap = join(dir, "snapshot.json");
        const reg = join(dir, "register.md");
        writeFileSync(snap, JSON.stringify(snapshotOf([{ number: 1, submissions: [submission({ inline: 1 })] }])));

        assert.equal(run(["--snapshot", snap, "--register", reg, "--write"], collect().io), 0);
        assert.equal(run(["--snapshot", snap, "--register", reg, "--check"], collect().io), 0);

        writeFileSync(reg, `${readFileSync(reg, "utf8")}<!-- edited by hand -->\n`);
        const c = collect();
        assert.equal(run(["--snapshot", snap, "--register", reg, "--check"], c.io), 1);
        assert.ok(c.err.join("\n").includes("is out of date against the snapshot"));
    }));

test("a MISSING register is could-not-run, not a mismatch", () =>
    withTemp((dir) => {
        // **The snapshot here must be VALID, or this passes for the wrong reason.** It was
        // `snapshotOf([])`, which `validateSnapshot` refuses on `window.merged < 1` — so the case
        // returned 2 before ever reaching the register and asserted nothing about a missing one.
        // Copilot round 1 on #357, and the finding is the sharper one of the two: an assertion that
        // holds for a reason other than its subject is a test that will keep passing after the code
        // it names is deleted.
        const snap = join(dir, "snapshot.json");
        writeFileSync(snap, JSON.stringify(snapshotOf([{ number: 1, submissions: [submission()] }])));
        const c = collect();
        assert.equal(run(["--snapshot", snap, "--register", join(dir, "absent.md"), "--check"], c.io), 2);
        assert.ok(c.err.join("\n").includes("run with --write to create it"), "reached the register, not the snapshot");
    }));

test("--check or --write without --register is refused, never a quiet exit 0", () =>
    withTemp((dir) => {
        const snap = join(dir, "s.json");
        writeFileSync(snap, JSON.stringify(snapshotOf([{ number: 1, submissions: [submission()] }])));
        for (const flag of ["--check", "--write"]) {
            const c = collect();
            assert.equal(run(["--snapshot", snap, flag], c.io), 2, `${flag} alone must refuse`);
            assert.ok(c.err.join("\n").includes("needs --register"));
        }
    }));

test("the rendered register states the units and the bound rather than implying them", () => {
    const text = renderRegister(meter(snapshotOf([{ number: 1, submissions: [submission({ inline: 1 })] }])));
    assert.ok(text.includes("SUBMISSION units"));
    assert.ok(text.includes("upper bound"));
    assert.ok(text.includes("A window is not a milestone."));
});

// ------------------------------------------------------------------------------- the command line

test("--check and --write together are refused rather than silently ordered", () =>
    withTemp((dir) => {
        const snap = join(dir, "s.json");
        writeFileSync(snap, JSON.stringify(snapshotOf([])));
        assert.equal(run(["--snapshot", snap, "--register", join(dir, "r.md"), "--check", "--write"], collect().io), 2);
    }));

test("a snapshot that is absent, unparsable, or malformed is exit 2 in every case", () =>
    withTemp((dir) => {
        assert.equal(run(["--snapshot", join(dir, "nope.json")], collect().io), 2);
        const bad = join(dir, "bad.json");
        writeFileSync(bad, "{not json");
        assert.equal(run(["--snapshot", bad], collect().io), 2);
        const wrong = join(dir, "wrong.json");
        writeFileSync(wrong, JSON.stringify({ portulan: { reviewSnapshot: "1" } }));
        assert.equal(run(["--snapshot", wrong], collect().io), 2);
    }));

test("an unrecognised argument is refused, never ignored", () => {
    assert.equal(run(["--snapshot", "x", "--rounds"], collect().io), 2);
});

test("the run prints its limits on every green, so the exit code cannot imply more than it means", () =>
    withTemp((dir) => {
        const snap = join(dir, "s.json");
        writeFileSync(snap, JSON.stringify(snapshotOf([{ number: 1, submissions: [submission({ inline: 3 })] }])));
        const c = collect();
        assert.equal(run(["--snapshot", snap], c.io), 0);
        const text = c.out.join("\n");
        assert.ok(text.includes("none of them is a fix-round count"));
        assert.ok(text.includes("UPPER BOUND"));
        assert.ok(text.includes("It reports; it does not bound"));
    }));

// -------------------------------------------------------------------------------- the entry guard

test("the entry guard survives a path containing a SPACE — the fourth instance of this here", () =>
    withTemp((dir) => {
        // `file://${argv[1]}` percent-encodes nothing while `import.meta.url` percent-encodes the
        // space, so the comparison fails and the tool exits 0 having run nothing. This file's subject
        // shipped exactly that: `--fetch` against the live repository printed nothing and wrote no
        // snapshot. The assertion is that INVOKING it as a program actually runs it.
        const spaced = join(dir, "a directory with spaces");
        mkdirSync(spaced);
        const snap = join(spaced, "s.json");
        writeFileSync(snap, JSON.stringify(snapshotOf([{ number: 1, submissions: [submission()] }])));
        const out = spawnSync(process.execPath, [TOOL, "--snapshot", snap], { encoding: "utf8" });
        assert.equal(out.status, 0);
        assert.ok(out.stdout.includes("submissions per pull request"), `ran nothing: ${JSON.stringify(out.stdout)}`);
    }));

test("the tool spawns nothing unless --fetch is given", () => {
    // The fetch is the ONE mode that talks to anything. A metering run inside a verify recipe must be
    // answerable on a machine with no token and no network, so this asserts the source carries no
    // process spawn outside the `gh` helper the fetch path uses — the shape `goldens.test.mjs`
    // asserts for its own corpus.
    const source = readFileSync(TOOL, "utf8");
    const spawns = source.match(/spawnSync\(/g) ?? [];
    assert.equal(spawns.length, 1, "exactly one spawn site, and it is the gh helper the fetch uses");
});

// ------------------------------------------------------- the window, and the trap that produced it

test("the window is taken by MERGE DATE, not by pull request number", () => {
    // The defect this replaced, in one case: `gh pr list` orders by number, and the first capture
    // taken here carried three inversions — so the corpus sampled was not the corpus the register
    // named. #346 merged before #345 in real data; the newest two here are 9 and 7, not 10 and 9.
    const listed = [
        { number: 10, mergedAt: "2026-08-20T00:00:00Z" },
        { number: 9, mergedAt: "2026-08-24T00:00:00Z" },
        { number: 8, mergedAt: "2026-08-19T00:00:00Z" },
        { number: 7, mergedAt: "2026-08-23T00:00:00Z" },
    ];
    assert.deepEqual(selectWindow(listed, 2).map((p) => p.number), [9, 7]);
    // Number order would have answered [10, 9], and both entries would have been wrong.
    assert.notDeepEqual(selectWindow(listed, 2).map((p) => p.number), [10, 9]);
});

test("a merge-date tie breaks on number descending, so a re-capture is byte-stable", () => {
    const listed = [
        { number: 3, mergedAt: "2026-08-20T00:00:00Z" },
        { number: 5, mergedAt: "2026-08-20T00:00:00Z" },
        { number: 4, mergedAt: "2026-08-20T00:00:00Z" },
    ];
    assert.deepEqual(selectWindow(listed, 3).map((p) => p.number), [5, 4, 3]);
});

test("a snapshot NOT in descending merge order is refused — it is not the newest N", () => {
    const bad = snapshotOf([{ number: 1, submissions: [submission()] }, { number: 2, submissions: [submission()] }]);
    bad.pullRequests[1].mergedAt = "2026-09-01T00:00:00Z";
    assert.ok(validateSnapshot(bad).some((p) => /not in descending merge order/.test(p)));
});

test("a window heading that disagrees with its own corpus is refused", () => {
    // Measured at the checkpoint: `{merged: 300}` over thirty pull requests rendered "300 most
    // recently merged" above "| Pull requests | count | 30 |", rail green.
    const wrong = snapshotOf([{ number: 1, submissions: [submission()] }]);
    wrong.window.merged = 300;
    assert.ok(validateSnapshot(wrong).some((p) => /window.merged says 300/.test(p)));
    const absent = snapshotOf([{ number: 1, submissions: [submission()] }]);
    delete absent.window;
    assert.ok(validateSnapshot(absent).some((p) => /window.merged is undefined/.test(p)));
});

test("a submission with no HEAD is refused — pushes are counted from it", () => {
    // Contracted exactly as `inline` is, and it was not: stripping every head made the tool exit 0
    // printing `pushes 0` and regenerate a register carrying that zero, which is what meter()'s own
    // comment forbids one field over.
    const bad = snapshotOf([{ number: 1, submissions: [submission({ head: undefined })] }]);
    assert.ok(validateSnapshot(bad).some((p) => /no head sha/.test(p)));
});

test("a mergedAt that is not a timestamp is refused, not ordered as text", () => {
    // It was compared lexicographically, so ANY string ordered against any other and a window stamped
    // "yesterday" passed while the register claimed it was by merge date. A check that cannot fail on
    // a malformed input is not checking it. Copilot round 2 on #357.
    const absent = snapshotOf([{ number: 1, submissions: [submission()] }]);
    delete absent.pullRequests[0].mergedAt;
    assert.ok(validateSnapshot(absent).some((p) => /no parsable mergedAt/.test(p)));

    const prose = snapshotOf([{ number: 1, submissions: [submission()] }]);
    prose.pullRequests[0].mergedAt = "yesterday";
    assert.ok(validateSnapshot(prose).some((p) => /no parsable mergedAt/.test(p)));

    // And ordering is on the parsed value: these two are in descending order by DATE and ASCENDING
    // order as text, so a lexicographic check would report a violation that is not there.
    const ok = snapshotOf([{ number: 2, submissions: [submission()] }, { number: 1, submissions: [submission()] }]);
    ok.pullRequests[0].mergedAt = "2026-08-26T09:00:00.000Z";
    ok.pullRequests[1].mergedAt = "2026-08-26T08:00:00Z";
    assert.deepEqual(validateSnapshot(ok), []);
});

test("an EMPTY window is metered, not refused — a repository with no merged pull requests is a true zero", () => {
    // The floor was 1, which made this tool reject a snapshot its own `--fetch` can write. `meter()`
    // already answers an empty corpus correctly with null ratios, so the refusal was the validator
    // disagreeing with its own producer. Copilot round 2 on #357.
    assert.deepEqual(validateSnapshot(snapshotOf([])), []);
    const text = renderRegister(meter(snapshotOf([])));
    assert.ok(text.includes("| Pull requests | count | 0 |"));
    assert.ok(text.includes("unmeasured"), "an empty window is unmeasured, never below the threshold");
});

test("selectWindow orders on the PARSED stamp, so the producer and the validator agree", () => {
    const listed = [
        { number: 1, mergedAt: "2026-08-26T08:00:00Z" },
        { number: 2, mergedAt: "2026-08-26T09:00:00.000Z" },
    ];
    // Text order would put the millisecond form first only by accident of the digit; date order is
    // what both sides must use, or the fetch writes a window the validator refuses.
    assert.deepEqual(selectWindow(listed, 2).map((p) => p.number), [2, 1]);
    assert.deepEqual(validateSnapshot(snapshotOf(selectWindow(listed, 2).map((p) => ({ ...p, submissions: [submission()] })))), []);
});

// ------------------------------------------------- the shaping, where two measured traps both live

test("shapeSubmissions drops non-reviewer reviews and groups inline comments on their review id", () => {
    const reviews = [
        { id: 1, user: { login: "copilot-pull-request-reviewer[bot]" }, state: "COMMENTED", commit_id: "aaa", submitted_at: "t" },
        { id: 2, user: { login: "portulan-agent[bot]" }, state: "COMMENTED", commit_id: "bbb", submitted_at: "t" },
        { id: 3, user: { login: "Copilot" }, state: "COMMENTED", commit_id: "ccc", submitted_at: "t" },
    ];
    const comments = [
        { user: { login: "Copilot" }, pull_request_review_id: 1 },
        { user: { login: "Copilot" }, pull_request_review_id: 1 },
        // Ours, on the same review — counted would inflate a finding-bearing submission out of an
        // empty one, which is the direction that flatters the loop.
        { user: { login: "portulan-agent[bot]" }, pull_request_review_id: 3 },
    ];
    const shaped = shapeSubmissions(reviews, comments);
    assert.deepEqual(shaped.map((x) => x.id), [1, 3]);
    assert.equal(shaped[0].inline, 2);
    assert.equal(shaped[1].inline, 0);
});

test("shapeSubmissions reads head from the REVIEW, never from a comment", () => {
    // A review's commit_id is what it judged; an inline comment's drifts onto a later head. The
    // review's own stability is an assumption with #253 open on it, named in the module header.
    const shaped = shapeSubmissions(
        [{ id: 1, user: { login: "Copilot" }, state: "COMMENTED", commit_id: "the-review-head", submitted_at: "t" }],
        [{ user: { login: "Copilot" }, pull_request_review_id: 1, commit_id: "a-drifted-head" }],
    );
    assert.equal(shaped[0].head, "the-review-head");
});

test("--pool smaller than --limit is refused rather than silently making the window number order", () => {
    assert.equal(run(["--fetch", "--repo", "o/r", "--out", "x", "--limit", "30", "--pool", "30"], collect().io), 2);
});
