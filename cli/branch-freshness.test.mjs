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

function transport({ pulls = [pr()], compare = () => comparison(), read = (p) => p } = {}) {
    const checks = [];
    const requests = [];
    const api = async (method, route, body) => {
        requests.push({ method, route, body });
        if (route.includes("/pulls?")) return pulls;
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
    const t = transport({ read: () => ++reads === 1 ? pr() : pr(1, moved, moved), compare: (route) => comparison(0, route.includes(`${moved}...`) ? moved : base) });
    assert.equal((await refreshAll({ api: t.api, repository: repo, say: () => {} })).errors, 0);
    assert.equal(t.checks.at(-1).head_sha, moved);
    assert.equal(t.checks.at(-1).conclusion, "success");
    assert.equal(t.checks[0].conclusion, "failure");
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
