// Tests for `review-meter` — the review-loop meter: arithmetic, snapshot contract, register rail, window and shaping.

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

// Valid by default: `mergedAt` descends and `window` matches the corpus, so a case breaks only what it tests.
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
    // An identity when every submission has its own head: exact in arithmetic, not in IEEE 754.
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
    assert.equal(at.submissionsPerPullRequest, RETIRE_THRESHOLD);
    assert.equal(at.belowRetireThreshold, false);
});

// -------------------------------------------------------------------- the snapshot's own contract

test("a snapshot carrying a NON-REVIEWER review is could-not-judge, not a busy loop", () => {
    const problems = validateSnapshot(
        snapshotOf([{ number: 1, submissions: [submission({ login: "portulan-agent[bot]" })] }]),
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0], /portulan-agent\[bot\].*not the reviewer/);
});

test("BOTH observed reviewer logins are accepted — a filter on one returns zero from the other", () => {
    // The reviewer's login differs by endpoint: the `[bot]` form on /reviews, the plain one on /comments.
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
        // `import.meta.url` percent-encodes a space: an entry guard comparing it with `process.argv[1]` never fires.
        const spaced = join(dir, "a directory with spaces");
        mkdirSync(spaced);
        const snap = join(spaced, "s.json");
        writeFileSync(snap, JSON.stringify(snapshotOf([{ number: 1, submissions: [submission()] }])));
        const out = spawnSync(process.execPath, [TOOL, "--snapshot", snap], { encoding: "utf8" });
        assert.equal(out.status, 0);
        assert.ok(out.stdout.includes("submissions per pull request"), `ran nothing: ${JSON.stringify(out.stdout)}`);
    }));

test("the tool spawns nothing unless --fetch is given", () => {
    const source = readFileSync(TOOL, "utf8");
    const spawns = source.match(/spawnSync\(/g) ?? [];
    assert.equal(spawns.length, 1, "exactly one spawn site, and it is the gh helper the fetch uses");
});

// ---------------------------------------------------------------------- the window, by merge date

test("the window is taken by MERGE DATE, not by pull request number", () => {
    const listed = [
        { number: 10, mergedAt: "2026-08-20T00:00:00Z" },
        { number: 9, mergedAt: "2026-08-24T00:00:00Z" },
        { number: 8, mergedAt: "2026-08-19T00:00:00Z" },
        { number: 7, mergedAt: "2026-08-23T00:00:00Z" },
    ];
    assert.deepEqual(selectWindow(listed, 2).map((p) => p.number), [9, 7]);
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
    const wrong = snapshotOf([{ number: 1, submissions: [submission()] }]);
    wrong.window.merged = 300;
    assert.ok(validateSnapshot(wrong).some((p) => /window.merged says 300/.test(p)));
    const absent = snapshotOf([{ number: 1, submissions: [submission()] }]);
    delete absent.window;
    assert.ok(validateSnapshot(absent).some((p) => /window.merged is undefined/.test(p)));
});

test("a submission with no HEAD is refused — pushes are counted from it", () => {
    const bad = snapshotOf([{ number: 1, submissions: [submission({ head: undefined })] }]);
    assert.ok(validateSnapshot(bad).some((p) => /no head sha/.test(p)));
});

test("a mergedAt that is not a timestamp is refused, not ordered as text", () => {
    const absent = snapshotOf([{ number: 1, submissions: [submission()] }]);
    delete absent.pullRequests[0].mergedAt;
    assert.ok(validateSnapshot(absent).some((p) => /no parsable mergedAt/.test(p)));

    const prose = snapshotOf([{ number: 1, submissions: [submission()] }]);
    prose.pullRequests[0].mergedAt = "yesterday";
    assert.ok(validateSnapshot(prose).some((p) => /no parsable mergedAt/.test(p)));

    const ok = snapshotOf([{ number: 2, submissions: [submission()] }, { number: 1, submissions: [submission()] }]);
    ok.pullRequests[0].mergedAt = "2026-08-26T09:00:00.000Z";
    ok.pullRequests[1].mergedAt = "2026-08-26T08:00:00Z";
    assert.deepEqual(validateSnapshot(ok), []);
});

test("an EMPTY window is metered, not refused — a repository with no merged pull requests is a true zero", () => {
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
    assert.deepEqual(selectWindow(listed, 2).map((p) => p.number), [2, 1]);
    assert.deepEqual(validateSnapshot(snapshotOf(selectWindow(listed, 2).map((p) => ({ ...p, submissions: [submission()] })))), []);
});

// ------------------------------------------------------------------------------------ the shaping

test("shapeSubmissions drops non-reviewer reviews and groups inline comments on their review id", () => {
    const reviews = [
        { id: 1, user: { login: "copilot-pull-request-reviewer[bot]" }, state: "COMMENTED", commit_id: "aaa", submitted_at: "t" },
        { id: 2, user: { login: "portulan-agent[bot]" }, state: "COMMENTED", commit_id: "bbb", submitted_at: "t" },
        { id: 3, user: { login: "Copilot" }, state: "COMMENTED", commit_id: "ccc", submitted_at: "t" },
    ];
    const comments = [
        { user: { login: "Copilot" }, pull_request_review_id: 1 },
        { user: { login: "Copilot" }, pull_request_review_id: 1 },
        { user: { login: "portulan-agent[bot]" }, pull_request_review_id: 3 },
    ];
    const shaped = shapeSubmissions(reviews, comments);
    assert.deepEqual(shaped.map((x) => x.id), [1, 3]);
    assert.equal(shaped[0].inline, 2);
    assert.equal(shaped[1].inline, 0);
});

test("shapeSubmissions reads head from the REVIEW, never from a comment", () => {
    // An inline comment's `commit_id` drifts onto a later head; a review's is the head it judged.
    const shaped = shapeSubmissions(
        [{ id: 1, user: { login: "Copilot" }, state: "COMMENTED", commit_id: "the-review-head", submitted_at: "t" }],
        [{ user: { login: "Copilot" }, pull_request_review_id: 1, commit_id: "a-drifted-head" }],
    );
    assert.equal(shaped[0].head, "the-review-head");
});

test("a --pool that cannot exceed the window is refused, and the refusal is REACHED", () => {
    for (const pool of ["30", "29", "0"]) {
        const c = collect();
        assert.equal(run(["--fetch", "--repo", "o/r", "--out", "x", "--limit", "30", "--pool", pool], c.io), 2);
        assert.ok(
            c.err.join("\n").includes("--pool must be an integer greater than --limit"),
            `--pool ${pool} reached the fetch instead of the guard: ${c.err.join(" | ")}`,
        );
    }
});
