// Tests for this repository's branch freshness check and trusted workflow.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { activationPayload, judge, openPulls, refreshAll } from "../.portulan/tools/branch-freshness.mjs";

const repo = "example/project";
const base = "a".repeat(40);
const head = "b".repeat(40);
const moved = "c".repeat(40);
const pr = (number = 1, sha = head, baseSha = base) => ({ number, state: "open", head: { sha }, base: { ref: "main", sha: baseSha, repo: { full_name: repo } } });
const comparison = (behind = 0, sha = base) => ({ base_commit: { sha }, behind_by: behind });

const branch = (sha = base) => ({ name: "main", commit: { sha } });

function transport({ pulls = [pr()], compare = () => comparison(), read = (p) => p, readBranch = () => branch() } = {}) {
    const checks = [];
    const requests = [];
    const api = async (method, route, body) => {
        requests.push({ method, route, body });
        if (route.includes("/pulls?")) return pulls;
        if (route.endsWith("/branches/main")) return readBranch();
        if (method === "GET" && /\/pulls\/\d+$/.test(route)) return read(pulls.find((p) => route.endsWith(`/${p.number}`)));
        if (route.includes("/compare/")) return compare(route);
        if (method === "POST") {
            const check = { id: checks.length + 1, ...body };
            checks.push(check);
            return check;
        }
        if (method === "PATCH") {
            const check = checks.find((c) => route.endsWith(`/${c.id}`));
            Object.assign(check, body);
            return check;
        }
        throw new Error(`unexpected ${method} ${route}`);
    };
    return { api, checks, requests };
}

test("zero through ten commits behind pass, eleven and more fail", () => {
    for (const behind of [0, 9, 10, 11, 12]) assert.equal(judge(comparison(behind), base), behind <= 10 ? "success" : "failure");
    for (const behind of [undefined, null, -1, 1.5, "0", NaN, Infinity]) assert.throws(() => judge({ ...comparison(), behind_by: behind }, base));
    assert.throws(() => judge(comparison(0, moved), base));
});

test("pagination collects every open PR", async () => {
    const pages = [];
    const pulls = await openPulls(async (_method, route) => {
        pages.push(route);
        return pages.length === 1 ? Array.from({ length: 100 }, (_, i) => pr(i + 1)) : [pr(101)];
    }, repo);
    assert.equal(pulls.length, 101);
    assert.match(pages[1], /page=2$/);
    await assert.rejects(openPulls(async () => null, repo));
});

test("read and check-creation failures do not prevent other heads being refreshed", async () => {
    for (const failAt of ["read", "create"]) {
        const t = transport({ pulls: [pr(1), pr(2, moved)] });
        let failed = false;
        const api = async (method, route, body) => {
            if (!failed && ((failAt === "read" && route.endsWith("/pulls/1")) || (failAt === "create" && method === "POST"))) {
                failed = true;
                throw new Error("unavailable");
            }
            return t.api(method, route, body);
        };
        const result = await refreshAll({ api, repository: repo, say: () => {} });
        assert.equal(result.errors, 1);
        assert.equal(t.checks.at(-1).head_sha, moved);
        assert.equal(t.checks.at(-1).conclusion, "success");
        if (failAt === "read") assert.equal(t.checks[0].conclusion, "failure");
    }
});

test("activation payload is derived from policy, keeps check pins, and requires the replacement", () => {
    const policy = JSON.parse(fs.readFileSync(new URL("../.portulan/gates.json", import.meta.url), "utf8"));
    assert.deepEqual(activationPayload(policy), { strict: false, checks: [
        { context: "workspace-verify", app_id: 15368 },
        { context: "pr-labeled", app_id: 15368 },
        { context: "branch-freshness", app_id: 15368 },
    ] });
    policy.floor.checks.pop();
    assert.throws(() => activationPayload(policy));
});

test("each scan reads current state for every PR and publishes exact-head checks", async () => {
    const t = transport({ pulls: [pr(1), pr(2, moved)], compare: (route) => comparison(route.endsWith(moved) ? 11 : 10) });
    const report = await refreshAll({ api: t.api, repository: repo, say: () => {} });
    assert.equal(report.errors, 0);
    assert.deepEqual(t.checks.map((c) => [c.head_sha, c.conclusion]), [[head, "success"], [moved, "failure"]]);
    assert.equal(t.requests.filter((r) => /\/pulls\/\d+$/.test(r.route)).length, 4);
    assert.match(t.checks[0].output.summary, new RegExp(`${base}[\\s\\S]*${head}[\\s\\S]*10`));
});

test("an unreadable comparison fails its head check and does not skip other PRs", async () => {
    let calls = 0;
    const t = transport({ pulls: [pr(1), pr(2, moved)], compare: () => { if (++calls === 1) throw new Error("unavailable"); return comparison(); } });
    const report = await refreshAll({ api: t.api, repository: repo, say: () => {} });
    assert.equal(report.errors, 1);
    assert.deepEqual(t.checks.map((c) => c.conclusion), ["failure", "success"]);
    const bad = transport({ compare: () => comparison("0") });
    assert.equal((await refreshAll({ api: bad.api, repository: repo, say: () => {} })).errors, 1);
    assert.equal(bad.checks[0].conclusion, "failure");
});

test("head and base movement are retried using new SHAs", async () => {
    let reads = 0;
    let branchReads = 0;
    const t = transport({ read: () => ++reads === 1 ? pr() : pr(1, moved, moved), readBranch: () => branch(++branchReads === 1 ? base : moved), compare: (route) => comparison(0, route.includes(`${moved}...`) ? moved : base) });
    assert.equal((await refreshAll({ api: t.api, repository: repo, say: () => {} })).errors, 0);
    assert.equal(t.checks.at(-1).head_sha, moved);
    assert.equal(t.checks.at(-1).conclusion, "success");
    assert.equal(t.checks[0].conclusion, "failure");
});

test("a stale PR base cannot replace the live main ref at the ten/eleven boundary", async () => {
    for (const behind of [10, 11]) {
        const t = transport({ readBranch: () => branch(moved), compare: () => comparison(behind, moved) });
        const result = await refreshAll({ api: t.api, repository: repo, say: () => {} });
        assert.equal(result.errors, 0);
        const compared = t.requests.filter((r) => r.route.includes("/compare/"));
        assert.deepEqual(compared.map((r) => r.route), [`/repos/${repo}/compare/${moved}...${head}`]);
        assert.equal(t.checks.at(-1).conclusion, behind === 10 ? "success" : "failure");
        assert.match(t.checks.at(-1).output.summary, new RegExp(`Base: ${moved}\\nHead: ${head}\\nCommits behind: ${behind}\\n`));
    }
});

test("live main movement retries even while the PR payload stays unchanged", async () => {
    let reads = 0;
    const t = transport({ readBranch: () => branch(++reads === 1 ? base : moved), compare: (route) => route.includes(`${moved}...`) ? comparison(11, moved) : comparison() });
    assert.equal((await refreshAll({ api: t.api, repository: repo, say: () => {} })).errors, 0);
    assert.deepEqual(t.requests.filter((r) => r.route.includes("/compare/")).map((r) => r.route), [`/repos/${repo}/compare/${base}...${head}`, `/repos/${repo}/compare/${moved}...${head}`]);
    assert.ok(t.checks.every((c) => c.conclusion === "failure"));
    assert.match(t.checks.at(-1).output.summary, /Commits behind: 11/);
});

test("malformed live refs never fall back to a stored PR base", async () => {
    for (const live of [null, {}, { name: "other", commit: { sha: base } }, branch("invalid")]) {
        const t = transport({ readBranch: () => live });
        assert.equal((await refreshAll({ api: t.api, repository: repo, say: () => {} })).errors, 1);
        assert.equal(t.checks.at(-1).conclusion, "failure");
        assert.equal(t.requests.filter((r) => r.route.includes("/compare/")).length, 0);
    }
});

test("a failed live-ref read fails its head and continues the scan", async () => {
    let reads = 0;
    const t = transport({ pulls: [pr(1), pr(2, moved)], readBranch: () => { if (++reads === 1) throw new Error("unavailable"); return branch(); } });
    assert.equal((await refreshAll({ api: t.api, repository: repo, say: () => {} })).errors, 1);
    assert.deepEqual(t.checks.map((c) => c.conclusion), ["failure", "success"]);
});

test("a failed final live-ref read cannot publish a passing result", async () => {
    let reads = 0;
    const t = transport({ readBranch: () => { if (++reads === 2) throw new Error("unavailable"); return branch(); } });
    assert.equal((await refreshAll({ api: t.api, repository: repo, say: () => {} })).errors, 1);
    assert.equal(t.checks.at(-1).conclusion, "failure");
});

test("repeated movement stops with a nonpassing check on the latest head", async () => {
    let reads = 0;
    const t = transport({ read: () => pr(1, (++reads % 2 ? head : moved)), compare: () => comparison() });
    assert.equal((await refreshAll({ api: t.api, repository: repo, say: () => {} })).errors, 1);
    assert.ok(t.checks.every((c) => c.conclusion === "failure"));
    assert.ok(t.checks.length <= 7);
    assert.equal(t.requests.filter((r) => r.route.includes("/compare/")).length, 3);
});

test("workflow uses trusted main, refreshes on base movement, and cannot coalesce away another PR", () => {
    const yaml = fs.readFileSync(new URL("../.github/workflows/branch-freshness.yml", import.meta.url), "utf8");
    assert.match(yaml, /pull_request_target:/);
    assert.match(yaml, /push:\n\s+branches: \[main\]/);
    assert.match(yaml, /ref: main/);
    assert.doesNotMatch(yaml, /pull_request\.head|refs\/pull|secrets\./);
    assert.match(yaml, /checks: write/);
    assert.match(yaml, /cancel-in-progress: false/);
    assert.match(yaml, /node \.portulan\/tools\/branch-freshness\.mjs/);
});
