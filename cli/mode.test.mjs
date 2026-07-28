// Tests for `mode` — reading and tightening a session's autonomy mode.
//
//   node --test "cli/**/*.test.mjs"
//
// The vocabulary and the resolution live in ./compile.mjs and are tested there. What is tested HERE is
// the command's own behaviour, and specifically the two ways a tool like this lies: reporting success
// for work it did not do, and touching a record belonging to somebody else.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { effectiveMode, readSessionMode, sessionModeFile, writeSessionMode } from "./compile.mjs";
import { findRoot, run } from "./mode.mjs";

const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});
function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-mode-"));
    SCRATCH.push(dir);
    return dir;
}

const policy = () => ({
    portulan: { spec: "2.1" },
    mode: "ship-gate",
    rules: [
        {
            id: "ship",
            tier: { autonomous: "auto", "ship-gate": "gated", strict: "gated" },
            action: { shell: "gh pr merge" },
            reason: "the ship step",
        },
    ],
});

describe("clearing an override", () => {
    test("--clear removes THIS session's record, not the unclaimed one", () => {
        // The regression test for a defect found by review on the pull request. The record is keyed by
        // session AND working tree; the clear path passed only the tree, so it deleted the *unclaimed*
        // record — a different file — found nothing, and reported "override cleared" while this
        // session's override sat untouched and still in force. A tool that reports success for work it
        // did not do is worse than one that fails, because the operator stops looking.
        const dir = scratch();
        writeSessionMode("strict", { dir, root: "/repo/x", sessionId: "s1" });
        assert.equal(effectiveMode({ policy: policy(), dir, root: "/repo/x", sessionId: "s1" }).mode, "strict");

        // The command itself, session carried through — not a hand-rolled rmSync that a refactor
        // of the clear path would leave green. Found by review on the pull request, second round.
        const code = run(["--clear"], { dir, root: "/repo/x", sessionId: "s1", quiet: true });
        assert.equal(code, 0);

        assert.equal(readSessionMode({ dir, root: "/repo/x", sessionId: "s1" }), null, "the record is gone");
        assert.equal(
            effectiveMode({ policy: policy(), dir, root: "/repo/x", sessionId: "s1" }).mode,
            "ship-gate",
            "and the session is back on the workspace default",
        );
    });

    test("clearing without the session id would have missed it — the bug, asserted", () => {
        // Stated as its own case so the defect cannot quietly return: deleting the unclaimed record
        // must NOT be mistaken for clearing a claimed one.
        const dir = scratch();
        writeSessionMode("strict", { dir, root: "/repo/y", sessionId: "s1" });
        fs.rmSync(sessionModeFile({ dir, root: "/repo/y" }), { force: true }); // no sessionId — the old path
        assert.equal(
            effectiveMode({ policy: policy(), dir, root: "/repo/y", sessionId: "s1" }).mode,
            "strict",
            "the override survives, which is why passing the session id is load-bearing",
        );
    });

    test("one session's clear does not disturb another's override", () => {
        const dir = scratch();
        writeSessionMode("strict", { dir, root: "/repo/z", sessionId: "keeper" });
        writeSessionMode("strict", { dir, root: "/repo/z", sessionId: "clearer" });
        assert.equal(run(["--clear"], { dir, root: "/repo/z", sessionId: "clearer", quiet: true }), 0);
        assert.equal(effectiveMode({ policy: policy(), dir, root: "/repo/z", sessionId: "keeper" }).mode, "strict");
    });
});

describe("the command may not lie about what it did", () => {
    test("--clear that cannot remove the record fails loudly, it does not say 'cleared'", () => {
        // Found by review on the pull request: the clear path swallowed every rmSync failure and
        // printed "override cleared" regardless. `force: true` already tolerates a missing file, so
        // the only way into that catch is a record that exists and cannot be removed — an override
        // still in force, reported as gone.
        const dir = scratch();
        const repo = scratch(); // a root with no gates.json; --clear must not need one
        writeSessionMode("strict", { dir, root: repo, sessionId: "s1" });
        const record = sessionModeFile({ dir, root: repo, sessionId: "s1" });
        fs.chmodSync(path.dirname(record), 0o555);
        try {
            const code = run(["--clear"], { dir, root: repo, sessionId: "s1", quiet: true });
            assert.equal(code, 2, "an unremovable override is 'could not run', never success");
        } finally {
            fs.chmodSync(path.dirname(record), 0o755);
        }
        assert.notEqual(readSessionMode({ dir, root: repo, sessionId: "s1" }), null, "the record is still there — which is exactly why success would have been a lie");
    });

    test("no readable policy is never reported as a workspace default", () => {
        // The fail-closed clamp to `strict` is effectiveMode's, not the workspace's. Reporting it as
        // `(workspace default)` put the first line of output in contradiction with the second, which
        // says the default is unknown.
        const dir = scratch();
        const repo = scratch(); // no .portulan/gates.json here either
        const lines = [];
        const real = process.stdout.write;
        process.stdout.write = (chunk) => (lines.push(String(chunk)), true);
        let code;
        try {
            code = run([], { dir, root: repo, sessionId: "s1" });
        } finally {
            process.stdout.write = real;
        }
        const out = lines.join("");
        assert.equal(code, 0, "reporting still works without a policy");
        assert.match(out, /fail-closed/, "the clamp is named as a clamp");
        assert.doesNotMatch(out, /\(workspace default\)/, "and never as a declaration nobody made");
        assert.match(out, /unknown — no readable policy/, "the default line still tells the truth");
    });
});

describe("an unclaimed override binds nobody", () => {
    test("not even a reader that itself has no session id", () => {
        // Found by review on the pull request: absence is not an identity. The record's `session`
        // and the reader's session id used to compare with `??  null` on both sides, so null === null
        // matched — and an override written outside any session would bind every consumer whose host
        // happened not to supply a session id. The gate runner's `payload.session_id` is
        // host-supplied, not guaranteed, so that reader exists in the wild.
        const dir = scratch();
        writeSessionMode("strict", { dir, root: "/repo/u", sessionId: null });
        assert.equal(readSessionMode({ dir, root: "/repo/u", sessionId: null }), null, "a missing session id never matches, on either side");
        assert.equal(
            effectiveMode({ policy: policy(), dir, root: "/repo/u", sessionId: null }).mode,
            "ship-gate",
            "the session-less reader stays on the workspace default",
        );
        assert.equal(
            effectiveMode({ policy: policy(), dir, root: "/repo/u", sessionId: "s1" }).mode,
            "ship-gate",
            "and a claimed reader ignores it too",
        );
    });

    test("a fail-closed clamp is reported as a clamp, not as a workspace default", () => {
        // effectiveMode falls back to `strict` when the policy declares no usable mode. The source
        // string must say so: labelling the clamp `workspace default` misled the operator exactly
        // when the policy was readable JSON with a broken mode.
        const eff = effectiveMode({ policy: { mode: "warp-speed" }, dir: scratch(), root: "/repo/v", sessionId: "s1" });
        assert.equal(eff.mode, "strict");
        assert.match(eff.source, /fail-closed/);
        assert.notEqual(eff.source, "workspace default");
    });
});

describe("contradictory arguments", () => {
    test("two different modes refuse rather than resolving by position", () => {
        // `mode strict autonomous` used to take the last word silently — a session meaning strict
        // could claim autonomous. Found by review on the pull request.
        const dir = scratch();
        const repo = scratch();
        assert.equal(run(["strict", "autonomous"], { dir, root: repo, sessionId: "s1", quiet: true }), 1);
        assert.equal(readSessionMode({ dir, root: repo, sessionId: "s1" }), null, "and nothing was written");
    });

    test("repeating the same mode is inert, not a contradiction", () => {
        const dir = scratch();
        const lines = [];
        const real = process.stdout.write;
        process.stdout.write = (chunk) => (lines.push(String(chunk)), true);
        let code;
        try {
            code = run(["strict", "strict"], { dir, root: "/repo/w", sessionId: "s1", quiet: false });
        } finally {
            process.stdout.write = real;
        }
        // No gates.json at cwd root "/repo/w" → setting a mode against an unreadable policy refuses
        // with exit 1; the point here is only that the refusal is the POLICY one, not a
        // two-modes-given contradiction over an identical word.
        assert.equal(code, 1);
    });
});

describe("finding the workspace from wherever the caller stands", () => {
    test("a subdirectory resolves to the root that carries the policy", () => {
        // Found by review on the pull request: `root` defaulted to cwd, so a subdirectory
        // invocation looked for the policy in the wrong place AND keyed the override record to a
        // workspace that does not exist — an override set at the root was not the one a
        // subdirectory query read.
        const repo = scratch();
        fs.mkdirSync(path.join(repo, ".portulan"), { recursive: true });
        fs.writeFileSync(path.join(repo, ".portulan", "gates.json"), JSON.stringify(policy()));
        const sub = path.join(repo, "docs", "deep");
        fs.mkdirSync(sub, { recursive: true });
        assert.equal(findRoot(sub), repo);
        assert.equal(findRoot(repo), repo, "the root itself is a fixed point");
    });

    test("no policy anywhere above keeps the start directory, so the report stays honest", () => {
        const bare = scratch();
        assert.equal(findRoot(bare), bare);
    });
});

describe("the unclaimed write explains itself", () => {
    test("it says the record bound nobody — not that the mode wasn't stricter", () => {
        // Found by review on the pull request: with no session id, the written record binds nobody,
        // so the effective mode stays the default — and the old note blamed strictness for it,
        // which is a false reason precisely when the requested mode IS stricter.
        const dir = scratch();
        const repo = scratch();
        fs.mkdirSync(path.join(repo, ".portulan"), { recursive: true });
        fs.writeFileSync(path.join(repo, ".portulan", "gates.json"), JSON.stringify(policy()));
        const saved = process.env.CLAUDE_CODE_SESSION_ID;
        delete process.env.CLAUDE_CODE_SESSION_ID;
        const lines = [];
        const real = process.stdout.write;
        process.stdout.write = (chunk) => (lines.push(String(chunk)), true);
        let code;
        try {
            code = run(["strict"], { dir, root: repo });
        } finally {
            process.stdout.write = real;
            if (saved !== undefined) process.env.CLAUDE_CODE_SESSION_ID = saved;
        }
        const out = lines.join("");
        assert.equal(code, 0);
        assert.match(out, /unclaimed and binds nobody/, "the true reason is stated");
        assert.doesNotMatch(out, /is not stricter than the workspace default/, "and the false one is not");
    });
});
