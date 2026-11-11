// Numeric class analysis keeps ownership, recency and unknown metadata explicit.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { projectKey, readLine } from "./ledger.mjs";
import { spendAnalysis } from "./spend-analysis.mjs";
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
const doctor = fileURLToPath(new URL("./doctor.mjs", import.meta.url));
let serial = 0;
function row(root, values = {}) {
    const { id = `r${++serial}`, branch = "feature/spend", minute = 0, input = 1, w5 = 0, w1 = 0, unknown = 0, read = 0, output = 1, ...metadata } = values;
    const usage = { input_tokens: input, cache_creation_input_tokens: w5 + w1 + unknown, cache_read_input_tokens: read, output_tokens: output,
        cache_creation: { ephemeral_5m_input_tokens: w5, ephemeral_1h_input_tokens: w1 } };
    if (Object.hasOwn(values, "input") && values.input === undefined) delete usage.input_tokens;
    if (Object.hasOwn(values, "output") && values.output === undefined) delete usage.output_tokens;
    return JSON.stringify({ type: "assistant", cwd: root, gitBranch: branch, timestamp: new Date(Date.UTC(2026, 10, 11, 0, minute)).toISOString(), ...metadata, message: { id, model: "claude-sonnet-5-5", usage } });
}
function fixture(fn, spend = undefined) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "portulan-analysis-")));
    const write = (rel, value) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value)); };
    const git = (...args) => { const result = spawnSync("git", ["-C", root, "-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], { encoding: "utf8" }); assert.equal(result.status, 0, result.stderr); };
    git("init", "-q", "-b", "feature/spend"); write("seed", "fixture\n"); git("add", "seed"); git("commit", "-qm", "fixture");
    write("workspace/workspace.json", { portulan: { spec: "2.16" }, name: "fixture", kind: "repository", tree: "../", slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" }, verify: { default: "docs", recipes: [{ id: "docs", run: "./verify.sh" }] }, ...(spend ? { spend } : {}) });
    for (const name of ["identity", "principles", "gate-map"]) write(`workspace/${name}.md`, `# ${name}\n\nFixture.\n`);
    write("workspace/verify.sh", "#!/bin/sh\nexit 0\n"); fs.mkdirSync(path.join(root, "host"));
    const transcript = (name, rows) => write(path.join("host/projects", projectKey(root), name + ".jsonl"), rows.join("\n") + "\n");
    const invoke = (...flags) => spawnSync(process.execPath, [doctor, ...flags, path.join(root, "workspace")], { encoding: "utf8", cwd: root, env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(root, "host") } });
    try { return fn({ root, write, transcript, invoke }); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
test("ordinary doctor identifies output dominance and the matching role/effort lever", () => fixture(({ root, transcript, invoke }) => {
    transcript("output", [row(root, { input: 1001, read: 2099, output: 50013, effort: "high" })]);
    const result = invoke(); assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /branch class index.*dominant output/);
    assert.match(result.stdout, /50,013/); assert.match(result.stdout, /effort and model by recorded role/);
    assert.match(result.stdout, /recent.*class index.*dominant output/);
}));

const request = (v = {}) => ({ uncached: 0, written1h: 0, written5m: 0, writtenUnknown: 0, read: 0, output: 0, at: 0, branch: "b", model: null, effort: null, role: null, ...v });
const context = (session, requests, agent = null) => ({ session, requests: requests.map(request), agent });
const view = (contexts, extra = {}) => ({ branch: "b", collected: { contexts, malformed: 0 }, priced: { declared: null }, restart: null, ...extra });
const analyze = report => spendAnalysis(report).join("\n");
for (const [name, data, lever] of [
    ["uncached", { uncached: 100 }, "cache controls"], ["written", { written1h: 100 }, "fresh contexts, TTL gaps and cache busts"],
    ["read", { read: 1000 }, "session length and tool output"], ["output", { output: 100 }, "effort and model by recorded role"],
]) test(`${name} dominance maps to its own lever`, () => {
    const out = analyze(view([context("s", [data])]));
    assert.match(out, new RegExp(`branch class index:.*dominant ${name}`)); assert.ok(out.includes(lever));
    assert.match(out, /uniform input rate.*output 5× assumed/);
});
test("token volume and the normalized index differ, and declared prices can change the winner", () => {
    const r = view([context("s", [{ read: 1000, output: 100 }])]);
    assert.match(analyze(r), /branch tokens:.*read 1,000, output 100/);
    assert.match(analyze(r), /branch class index:.*dominant output/);
    r.priced.declared = { read: 1, write: { "5m": 1.25, "1h": 2 } };
    assert.match(analyze(r), /branch class index:.*dominant read/);
    assert.match(analyze(r), /declared/);
});
for (const output of [20, 40]) test(`unknown TTL handles reversed rates and endpoint ties, output ${output}`, () => {
    const out = analyze(view([context("s", [{ writtenUnknown: 100, output }])], { priced: { declared: { read: 0.1, write: { "5m": 3, "1h": 1 } } } }));
    assert.match(out, /written ~100\.\.300/); assert.match(out, /uncertain dominance/);
    assert.match(out, /unstated TTL/); assert.match(out, /written lever/); assert.match(out, /output lever/);
    if (output === 20) assert.match(out, /lower-bound leaders written \+ output/);
});
test("stable TTL endpoint winners and exact class ties are disclosed", () => {
    assert.match(analyze(view([context("s", [{ writtenUnknown: 100 }])])), /dominant written/);
    assert.match(analyze(view([context("s", [{ uncached: 100, read: 1000, output: 20 }])])), /dominant uncached \+ read \+ output \(tie\)/);
    assert.match(analyze(view([context("s", [{}])])), /no nonzero dominant class/);
});
test("raw integer totals stay exact even when estimated indices are rounded", () => {
    assert.match(analyze(view([context("s", [{ output: 100000001 }])])), /output 100,000,001/);
});
test("recent parents use child recency, include undated requests, span branches and exclude older/untimed parents", () => {
    const all = Array.from({ length: 7 }, (_, i) => context(`s${i}`, [{ at: i, branch: i === 1 ? "b" : "other", output: 10 ** i }]));
    all.push(context("s0", [{ at: 20, branch: "other", output: 7 }, { at: null, branch: "other", output: 9 }], "child"));
    all.push(context("untimed", [{ at: null, branch: "other", output: 123 }]));
    const out = analyze(view(all));
    assert.match(out, /branch tokens:.*output 10\./); assert.match(out, /recent tokens:.*output 1,111,017\./);
    assert.match(out, /latest 5.*1 wholly undated sessions excluded/);
});
test("recent cutoff ties use a stable session identifier ordering without disclosing IDs", () => {
    const all = ["a", "b", "c", "d", "e", "f"].map((s, i) => context(s, [{ at: 10, output: 10 ** i }]));
    const a = analyze(view(all)), b = analyze(view([...all].reverse()));
    assert.equal(a, b); assert.match(a, /recent tokens:.*output 11,111\./);
});
test("wholly untimed sessions stay in branch analysis but cannot be ranked as recent", () => {
    const out = analyze(view([context("s", [{ at: null, output: 123 }])]));
    assert.match(out, /branch tokens:.*output 123/); assert.match(out, /recent: no host requests/);
    assert.match(out, /1 wholly undated sessions excluded/);
    assert.deepEqual(spendAnalysis(view([])), []);
});
test("recorded role extraction is closed, with unknown role/effort/model values never printed", () => {
    const parsed = readLine(row("/fixture", { attributionAgent: "portulan:reviewer", effort: "medium", output: 10 })).request;
    assert.equal(parsed.role, "reviewer");
    assert.equal(readLine(row("/fixture", { attributionAgent: "../reviewer" })).request.role, null);
    const out = analyze(view([context("DO_NOT_PRINT_FIXTURE", [parsed, request({ output: 20, role: "DO_NOT_PRINT_FIXTURE", effort: "DO_NOT_PRINT_FIXTURE", model: "DO_NOT_PRINT_FIXTURE", branch: "feature/spend" })], "DO_NOT_PRINT_FIXTURE")], { branch: "feature/spend" }));
    assert.match(out, /output role reviewer: 10 tokens; recorded effort medium 10; model family sonnet 10/);
    assert.match(out, /output role unattributed subagent: 20 tokens; recorded effort unknown 20; model family unknown 20/);
    assert.doesNotMatch(out, /DO_NOT_PRINT_FIXTURE/);
});
test("unsafe totals, estimated overflow and partial data are explicit", () => {
    assert.match(analyze(view([context("s", [{ output: Number.MAX_SAFE_INTEGER + 1 }])])), /unassessed.*unsafe or overflow/);
    assert.match(analyze(view([context("s", [{ written1h: 2 }])], { priced: { declared: { read: 0.1, write: { "5m": 1e308, "1h": 1e308 } } } })), /unassessed.*overflow/);
    assert.match(analyze(view([context("s", [{ output: 10 }])], { collected: { contexts: [context("s", [{ output: 10 }])], malformed: 1 } })), /partial usage data/);
});
test("the priced counterfactual is finite, explicit and separate from unpriced route effects", () => {
    const base = view([context("s", [{ read: 1000 }])], { restart: { fresh: 1000, context: 20000, horizon: 20, horizonDeclared: true, resume: 0, multipliers: { read: 0.1, write: 1.25 } } });
    assert.match(analyze(base), /continue reads ~40,000 vs restart write \+ reads \+ resume ~3,250 input-equivalents; estimated saving ~36,750/);
    base.restart.resume = 40000; assert.match(analyze(base), /estimated saving ~-3,250 \(no positive saving\)/);
    base.restart.resume = null; assert.match(analyze(base), /counterfactual unpriced/);
    base.restart.resume = 0; base.restart.horizonDeclared = false; assert.match(analyze(base), /counterfactual unpriced/);
    base.restart.horizonDeclared = true; base.restart.horizon = Number.MAX_VALUE; assert.match(analyze(base), /counterfactual unpriced/);
});

test("ordinary report retains recent records when the current branch has none", () => fixture(({ root, transcript, invoke }) => {
    transcript("other", [row(root, { branch: "another", w1: 10000 })]);
    const result = invoke(); assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /branch: no host requests/); assert.match(result.stdout, /recent class index:.*dominant written/);
}));
for (const [name, data] of [["uncached", { input: 10000 }], ["written", { w1: 10000 }], ["read", { read: 100000 }]]) {
    test(`ordinary CLI paired ${name} control changes the dominant class`, () => fixture(({ root, transcript, invoke }) => {
        transcript("control", [row(root, data)]);
        const result = invoke(); assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, new RegExp(`branch class index:.*dominant ${name}`));
        assert.match(result.stdout, new RegExp(`branch ${name} lever:`));
    }));
}
test("actual CLI compares a priced read-heavy session and excludes later foreign-branch tails", () => fixture(({ root, transcript, invoke }) => {
    const records = [row(root, { w5: 999 }), row(root, { minute: 1, input: 0, read: 10000 }), row(root, { minute: 2, input: 0, read: 20000 })];
    transcript("priced", records);
    let result = invoke(); assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /branch class index:.*dominant read/); assert.match(result.stdout, /estimated saving ~36,750/);
    transcript("priced", [...records, row(root, { branch: "another", minute: 3, read: 1000000 })]);
    result = invoke(); assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /counterfactual unpriced: latest session tail is outside branch-owned scope/);
    assert.match(result.stdout, /restart not compared: latest session tail is outside branch-owned scope/);
    assert.doesNotMatch(result.stdout, /restart: session .*estimated saving/);
    transcript("priced", [...records, row("/outside", { minute: 3, read: 1000000 })]);
    result = invoke(); assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /counterfactual unpriced: latest session tail is outside branch-owned scope/);
}, { horizon: { requests: 20 }, resume: { tokens: 0 } }));
test("static and both agent modes preserve isolation and compact greens", () => fixture(({ root, transcript, invoke, write }) => {
    const before = invoke("--static");
    transcript("s", [row(root, { output: 10000 })]); write("host/projects/foreign/foreign.jsonl", row("/outside", { output: 999999 }));
    const after = invoke("--static"); assert.equal(after.status, 0, after.stderr); assert.equal(after.stdout, before.stdout);
    assert.doesNotMatch(after.stdout, /class index assumptions|branch tokens:/);
    for (const flags of [["--agent"], ["--agent", "--static"]]) {
        const result = invoke(...flags); assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout.trim().split("\n").length, 1); assert.equal(result.stderr, "");
    }
}));
for (const data of [{ output: Number.MAX_SAFE_INTEGER + 1 }, { input: undefined }, { output: undefined }, { read: "DO_NOT_PRINT_FIXTURE" }, { input: Number.MAX_SAFE_INTEGER, read: Number.MAX_SAFE_INTEGER }]) {
    test(`production parser preserves counter uncertainty: ${JSON.stringify(data)}`, () => fixture(({ root, transcript, invoke }) => {
        transcript("invalid", [row(root, data)]);
        const result = invoke(); assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /class analysis unassessed.*missing or invalid/);
        assert.match(result.stdout, /totals are partial/);
        assert.doesNotMatch(result.stdout, /class index:.*dominant|DO_NOT_PRINT_FIXTURE/);
    }));
}
test("completed duplicate observations fill missing fields without inventing an unsafe zero", () => fixture(({ root, transcript, invoke }) => {
    transcript("filled", [row(root, { id: "same", input: undefined, w5: 999 }), row(root, { id: "same", input: 1, w5: 999 }), row(root, { minute: 1, input: 0, read: 1700 })]);
    const result = invoke(); assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /class analysis unassessed|totals are partial/);
    assert.match(result.stdout, /estimated saving ~150/);
}, { horizon: { requests: 20 }, resume: { tokens: 0 } }));
test("invalid provided duplicate counters remain unassessed after a later numeric value", () => fixture(({ root, transcript, invoke }) => {
    transcript("bad", [row(root, { id: "same", output: "DO_NOT_PRINT_FIXTURE" }), row(root, { id: "same", output: 10 })]);
    const result = invoke(); assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /class analysis unassessed/); assert.doesNotMatch(result.stdout, /DO_NOT_PRINT_FIXTURE/);
}));
test("production pricing consumers reject an unsafe nonzero fresh context", () => fixture(({ root, transcript, invoke }) => {
    transcript("unsafe-fresh", [row(root, { input: Number.MAX_SAFE_INTEGER + 1, w5: 999 }), row(root, { minute: 1, input: 0, read: 1700 })]);
    const result = invoke(); assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /restart: comparison unavailable — input usage counters are invalid or incomplete/);
    assert.match(result.stdout, /restart counterfactual unpriced: input usage counters are invalid or incomplete/);
    assert.match(result.stdout, /restart not compared: input usage counters are invalid or incomplete/);
    assert.doesNotMatch(result.stdout, /restart: session .*estimated saving/);
}, { horizon: { requests: 20 }, resume: { tokens: 0 } }));
test("individually valid duplicate blocks cannot make merged input unsafe", () => fixture(({ root, transcript, invoke }) => {
    transcript("merged", [row(root, { id: "same", input: Number.MAX_SAFE_INTEGER }), row(root, { id: "same", input: 0, w5: Number.MAX_SAFE_INTEGER })]);
    const result = invoke(); assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /class analysis unassessed/); assert.match(result.stdout, /restart: comparison unavailable/);
}));
test("completed lifetime buckets replace the unclassified write residual", () => fixture(({ root, transcript, invoke }) => {
    transcript("ttl", [row(root, { id: "same", unknown: 999 }), row(root, { id: "same", w5: 999 }), row(root, { minute: 1, input: 0, read: 1700 })]);
    const result = invoke(); assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /written, unstated +0 +0 +0/); assert.match(result.stdout, /estimated saving ~150/);
    assert.doesNotMatch(result.stdout, /class analysis unassessed/);
}, { horizon: { requests: 20 }, resume: { tokens: 0 } }));
test("contradictory merged lifetime buckets cannot exceed their reported write total", () => fixture(({ root, transcript, invoke }) => {
    transcript("buckets", [row(root, { id: "same", w5: 999 }), row(root, { id: "same", w1: 999 }), row(root, { minute: 1, input: 0, read: 1700 })]);
    const result = invoke(); assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /class analysis unassessed/); assert.match(result.stdout, /restart: comparison unavailable/);
}));
