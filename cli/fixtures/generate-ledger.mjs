// Writes `./ledger/`: synthetic host usage records, and the totals they are known to sum to.
//
//   node cli/fixtures/generate-ledger.mjs <dir>
//
// The ground truth is the list of distinct requests below. Each is written the way the host writes one —
// a record per content block, each carrying the whole request's usage — and the known totals in
// `fixture.json` are summed here, from those requests, never by `../ledger.mjs`, which is what the
// fixture checks. `../ledger.test.mjs` runs this into a temporary directory and compares what it writes
// with the committed fixture byte for byte, so the totals are this script's and nobody's edit.
//
// It replaces only what it writes under `<dir>` — `projects/`, `claude.json` and `fixture.json` — and
// nothing else there. Paths, ids and models are invented; no line of any real session is here.

import fs from "node:fs";
import path from "node:path";

const out = process.argv[2];
if (out === undefined || out === "") {
    process.stderr.write("usage: node cli/fixtures/generate-ledger.mjs <dir>\n");
    process.exit(2);
}
for (const name of ["projects", "claude.json", "fixture.json"]) fs.rmSync(path.join(out, name), { recursive: true, force: true });

const T0 = Date.parse("2026-09-20T09:00:00.000Z");
const iso = (ms) => new Date(ms).toISOString();
const S = 1000, MIN = 60 * S, H = 60 * MIN;

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const E = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const F = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const X = "99999999-9999-4999-8999-999999999999";

let n = 0;
const nextId = () => `msg_fixture${String(++n).padStart(4, "0")}`;

// A request: its ground truth and the records the host would write for it (one per content block).
function request(o) {
    return { id: o.id ?? nextId(), blocks: o.blocks ?? 1, uncached: 0, w1h: 0, w5m: 0, read: 0, output: 0, sidechain: false, agent: null, ...o };
}
const ctx = (r) => r.uncached + r.w1h + r.w5m + r.read;

function records(session, r) {
    const lines = [];
    for (let b = 0; b < r.blocks; b += 1) {
        lines.push({
            parentUuid: null,
            isSidechain: r.sidechain,
            ...(r.agent ? { agentId: r.agent } : {}),
            userType: "external",
            cwd: r.cwd,
            sessionId: session,
            version: "2.1.280",
            gitBranch: r.branch,
            effort: r.effort,
            requestId: `req_${r.id}`,
            apiBlockIndex: b,
            type: "assistant",
            uuid: `${r.id}-block-${b}`,
            timestamp: iso(r.at),
            message: {
                id: r.id,
                type: "message",
                role: "assistant",
                model: r.model,
                content: [{ type: "text", text: "(synthetic: the ledger never reads this)" }],
                stop_reason: "tool_use",
                usage: {
                    input_tokens: r.uncached,
                    cache_creation_input_tokens: r.w1h + r.w5m,
                    cache_read_input_tokens: r.read,
                    cache_creation: { ephemeral_5m_input_tokens: r.w5m, ephemeral_1h_input_tokens: r.w1h },
                    output_tokens: r.output,
                    service_tier: "standard",
                },
            },
        });
    }
    return lines;
}

const user = (session, cwd, branch, at, text) => ({ type: "user", isSidechain: false, cwd, sessionId: session, gitBranch: branch, timestamp: iso(at), uuid: `user-${at}`, message: { role: "user", content: text } });
const boundary = (session, cwd, branch, at) => ({ type: "system", subtype: "compact_boundary", isSidechain: false, cwd, sessionId: session, gitBranch: branch, timestamp: iso(at), uuid: `boundary-${at}`, content: "Conversation compacted" });
const synthetic = (session, cwd, branch, at) => ({ type: "assistant", isSidechain: false, cwd, sessionId: session, gitBranch: branch, timestamp: iso(at), uuid: `synthetic-${at}`, message: { id: `synthetic-${at}`, model: "<synthetic>", role: "assistant", content: [{ type: "text", text: "(synthetic)" }], usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } });

const files = new Map(); // relative path -> array of line strings
const truth = []; // { request, file, context: "main"|"sub", session }
const add = (rel, line) => {
    if (!files.has(rel)) files.set(rel, []);
    files.get(rel).push(typeof line === "string" ? line : JSON.stringify(line));
};
const emit = (rel, session, r, kind) => {
    for (const l of records(session, r)) add(rel, l);
    truth.push({ r, rel, kind, session });
};

// ---- session A, /work/demo, the main worktree
const demo = "/work/demo";
const aRel = `projects/-work-demo/${A}.jsonl`;
let t = T0;
add(aRel, user(A, demo, "main", t, "(synthetic prompt, which mentions \"usage\": and \"compact_boundary\" only as text)"));
const R = {};
R[1] = request({ cwd: demo, branch: "main", model: "model-a", effort: "high", at: t, uncached: 3, w1h: 30000, read: 10000, output: 500, blocks: 2 });
emit(aRel, A, R[1], "main");
t += MIN;
R[2] = request({ cwd: demo, branch: "feature/x", model: "model-a", effort: "high", at: t, uncached: 1, w1h: 2000, read: 40500, output: 300, blocks: 3 });
emit(aRel, A, R[2], "main");
t += MIN;
R[3] = request({ cwd: demo, branch: "feature/x", model: "model-a", effort: "high", at: t, uncached: 1, w1h: 1500, read: 42800, output: 200, blocks: 2 });
emit(aRel, A, R[3], "main");
t += 2 * H; // the hour lapses
R[4] = request({ cwd: demo, branch: "feature/x", model: "model-a", effort: "high", at: t, uncached: 2, w1h: 38000, read: 8000, output: 250 });
emit(aRel, A, R[4], "main");
t += 30 * S;
R[5] = request({ cwd: demo, branch: "feature/x", model: "model-b", effort: "high", at: t, uncached: 2, w1h: 47000, read: 0, output: 260, blocks: 2 });
emit(aRel, A, R[5], "main");
t += 30 * S;
R[6] = request({ cwd: demo, branch: "feature/x", model: "model-b", effort: "max", at: t, uncached: 1, w1h: 48500, read: 0, output: 270 });
emit(aRel, A, R[6], "main");
t += 30 * S;
R[7] = request({ cwd: demo, branch: "feature/x", model: "model-b", effort: "max", at: t, uncached: 1, w1h: 1000, read: 48500, output: 280, blocks: 2 });
emit(aRel, A, R[7], "main");
t += 10 * S;
add(aRel, synthetic(A, demo, "feature/x", t));
// A torn line, as a live transcript's last line looks mid-write: carries "usage": and does not parse.
add(aRel, '{"type":"assistant","message":{"id":"msg_torn","usage":{"input_tokens":7');
// A subagent's record written inline, as earlier hosts did.
t += 10 * S;
const inline = request({ cwd: demo, branch: "feature/x", model: "model-a", effort: "high", at: t, uncached: 2, w5m: 5000, read: 3000, output: 100, sidechain: true, agent: "inl1", blocks: 2 });
emit(aRel, A, inline, "sub");
t += 20 * S;
add(aRel, boundary(A, demo, "feature/x", t));
t += 40 * S;
R[8] = request({ cwd: demo, branch: "feature/x", model: "model-b", effort: "max", at: t, uncached: 3, w1h: 12000, read: 8000, output: 400 });
emit(aRel, A, R[8], "main");
t += MIN;
R[9] = request({ cwd: demo, branch: "feature/x", model: "model-b", effort: "max", at: t, uncached: 1, w1h: 3000, read: 20000, output: 150, blocks: 2 });
emit(aRel, A, R[9], "main");
t += MIN;
R[10] = request({ cwd: demo, branch: "feature/x", model: "model-b", effort: "max", at: t, uncached: 1, w1h: 2000, read: 23000, output: 160 });
emit(aRel, A, R[10], "main");
t += MIN;
R[11] = request({ cwd: demo, branch: "feature/x", model: "model-b", effort: "max", at: t, uncached: 1, w1h: 20000, read: 6000, output: 170, blocks: 2 });
emit(aRel, A, R[11], "main");
t += MIN;
R[12] = request({ cwd: demo, branch: "feature/x", model: "model-b", effort: "max", at: t, uncached: 1, w1h: 1000, read: 26000, output: 180 });
emit(aRel, A, R[12], "main");

// ---- session A's subagents, one at the top of subagents/ and one nested the way the host nests workflows
const sub1Rel = `projects/-work-demo/${A}/subagents/agent-sub1.jsonl`;
let s = T0 + 3 * MIN;
const S1 = request({ cwd: demo, branch: "feature/x", model: "model-a", effort: "high", at: s, uncached: 3, w5m: 15000, read: 5000, output: 400, sidechain: true, agent: "sub1", blocks: 2 });
emit(sub1Rel, A, S1, "sub");
s += 10 * S;
const S2 = request({ cwd: demo, branch: "feature/x", model: "model-a", effort: "high", at: s, uncached: 1, w5m: 1000, read: 20000, output: 300, sidechain: true, agent: "sub1", blocks: 2 });
emit(sub1Rel, A, S2, "sub");
s += 10 * MIN; // five minutes lapse
const S3 = request({ cwd: demo, branch: "feature/x", model: "model-a", effort: "high", at: s, uncached: 1, w5m: 21500, read: 0, output: 200, sidechain: true, agent: "sub1" });
emit(sub1Rel, A, S3, "sub");
const sub2Rel = `projects/-work-demo/${A}/subagents/workflows/run1/agent-sub2.jsonl`;
const T1 = request({ cwd: demo, branch: "feature/x", model: "model-a", effort: "high", at: T0 + 4 * MIN, uncached: 2, w5m: 9000, read: 1000, output: 100, sidechain: true, agent: "sub2" });
emit(sub2Rel, A, T1, "sub");

// ---- session E, /work/demo, on main only, and carrying a copy of R3's record (a request in two transcripts)
const eRel = `projects/-work-demo/${E}.jsonl`;
const E1 = request({ cwd: demo, branch: "main", model: "model-a", effort: "high", at: T0 + 5 * H, uncached: 4, w1h: 31000, read: 9000, output: 600, blocks: 2 });
emit(eRel, E, E1, "main");
for (const l of records(A, R[3])) add(eRel, { ...l, sessionId: E });

// ---- session B, a worktree nested in the repository, the latest session on the branch, past its threshold
const w1 = "/work/demo/.claude/worktrees/w1";
const bRel = `projects/-work-demo--claude-worktrees-w1/${B}.jsonl`;
let b = T0 + 6 * H;
const B1 = request({ cwd: w1, branch: "feature/x", model: "model-a", effort: "high", at: b, uncached: 2, w1h: 30000, read: 10000, output: 600, blocks: 3 });
emit(bRel, B, B1, "main");
b += 30 * S;
const B2 = request({ cwd: w1, branch: "feature/x", model: "model-a", effort: "high", at: b, uncached: 1, w1h: 20000, read: 40000, output: 400 });
emit(bRel, B, B2, "main");
b += 30 * S;
const B3 = request({ cwd: w1, branch: "feature/x", model: "model-a", effort: "high", at: b, uncached: 1, w1h: 25000, read: 60000, output: 500, blocks: 2 });
emit(bRel, B, B3, "main");

// ---- session C, a worktree outside the repository's directory: a root of its own
const featureDir = "/work/demo-feature";
const cRel = `projects/-work-demo-feature/${C}.jsonl`;
const C1 = request({ cwd: featureDir, branch: "feature/x", model: "model-a", effort: "high", at: T0 + 5 * H + 30 * MIN, uncached: 2, w5m: 20000, read: 0, output: 250 });
emit(cRel, C, C1, "main");

// ---- session D, a sibling directory whose key shares the repository's prefix: opened, never counted
const old = "/work/demo-old";
const dRel = `projects/-work-demo-old/${D}.jsonl`;
const D1 = request({ cwd: old, branch: "feature/x", model: "model-a", effort: "high", at: T0 + 7 * H, uncached: 5, w1h: 99999, read: 1, output: 999, blocks: 2 });
emit(dRel, D, D1, "outside");

// ---- a project nothing here should open
const xRel = `projects/-elsewhere/${X}.jsonl`;
const X1 = request({ cwd: "/elsewhere", branch: "feature/x", model: "model-a", effort: "high", at: T0, uncached: 9, w1h: 9, read: 9, output: 9 });
emit(xRel, X, X1, "unopened");

for (const [rel, lines] of files) {
    const full = path.join(out, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, `${lines.join("\n")}\n`);
}

// ---- the host's own totals: session B's, larger where the host counts calls its transcripts do not carry
const bTruth = truth.filter((x) => x.session === B && x.kind === "main").map((x) => x.r);
const sum = (rs, k) => rs.reduce((a, r) => a + r[k], 0);
const hostB = { uncached: sum(bTruth, "uncached") + 12, written: sum(bTruth, "w1h") + sum(bTruth, "w5m"), read: sum(bTruth, "read"), output: sum(bTruth, "output") + 150 };
const claude = {
    numStartups: 3,
    projects: {
        "/elsewhere": { lastSessionId: X, lastTotalInputTokens: 1, lastTotalOutputTokens: 1, lastTotalCacheCreationInputTokens: 1, lastTotalCacheReadInputTokens: 1 },
        "/work/demo": { lastSessionId: F, lastTotalInputTokens: 5, lastTotalOutputTokens: 5, lastTotalCacheCreationInputTokens: 5, lastTotalCacheReadInputTokens: 5 },
        [w1]: { lastSessionId: B, lastTotalInputTokens: hostB.uncached, lastTotalOutputTokens: hostB.output, lastTotalCacheCreationInputTokens: hostB.written, lastTotalCacheReadInputTokens: hostB.read, lastCost: 0 },
        [old]: { lastSessionId: D, lastTotalInputTokens: 7, lastTotalOutputTokens: 7, lastTotalCacheCreationInputTokens: 7, lastTotalCacheReadInputTokens: 7 },
    },
};
fs.writeFileSync(path.join(out, "claude.json"), `${JSON.stringify(claude, null, 2)}\n`);

// ---- the known totals, from the ground truth
const onBranch = truth.filter((x) => x.r.branch === "feature/x" && (x.kind === "main" || x.kind === "sub"));
const main = onBranch.filter((x) => x.kind === "main").map((x) => x.r);
const sub = onBranch.filter((x) => x.kind === "sub").map((x) => x.r);
const pair = (k) => [sum(main, k), sum(sub, k)];
// Opened files: every file but -elsewhere's. Records there: one per block, plus the synthetic one, plus R3's copy.
const opened = truth.filter((x) => x.kind !== "unopened");
const blockRecords = opened.reduce((a, x) => a + x.r.blocks, 0);
const copyBlocks = R[3].blocks;
const records_ = blockRecords + 1 + copyBlocks;
const duplicates = opened.reduce((a, x) => a + x.r.blocks - 1, 0) + copyBlocks;
// Rebuilds, by construction above: the tokens each could have read and wrote again.
const rebuilds = [
    { tokens: Math.min(ctx(R[3]), ctx(R[4])) - R[4].read, cause: "lifetime lapsed" },
    { tokens: Math.min(ctx(R[4]), ctx(R[5])) - R[5].read, cause: "model change" },
    { tokens: Math.min(ctx(R[5]), ctx(R[6])) - R[6].read, cause: "effort change" },
    { tokens: Math.min(ctx(R[7]), ctx(R[8])) - R[8].read, cause: "compaction" },
    { tokens: Math.min(ctx(R[10]), ctx(R[11])) - R[11].read, cause: "unexplained" },
    { tokens: Math.min(ctx(S2), ctx(S3)) - S3.read, cause: "lifetime lapsed" },
];
const causes = {};
for (const r of rebuilds) causes[r.cause] = (causes[r.cause] ?? 0) + 1;
const bLedger = { uncached: sum(bTruth, "uncached"), written: sum(bTruth, "w1h") + sum(bTruth, "w5m"), read: sum(bTruth, "read"), output: sum(bTruth, "output") };
const expect = {
    records: records_,
    duplicates,
    synthetic: 1,
    malformed: 1,
    requests: [main.length, sub.length],
    uncached: pair("uncached"),
    written1h: pair("w1h"),
    written5m: pair("w5m"),
    writtenUnknown: [0, 0],
    read: pair("read"),
    output: pair("output"),
    sessions: 3,
    subagentContexts: 3,
    compactions: 1,
    largest: Math.max(...onBranch.map((x) => ctx(x.r))),
    rebuilds: rebuilds.length,
    rebuilt: rebuilds.reduce((a, r) => a + r.tokens, 0),
    causes: Object.fromEntries(Object.entries(causes).sort(([a], [z]) => (a < z ? -1 : 1))),
    host: [{ session: B, difference: Object.fromEntries(Object.keys(bLedger).map((k) => [k, bLedger[k] - hostB[k]])) }],
    threshold: Math.round(ctx(B1) * (1 + 2 / (20 * 0.1))),
};
fs.writeFileSync(path.join(out, "fixture.json"), `${JSON.stringify({ roots: [demo, featureDir], branch: "feature/x", expect }, null, 2)}\n`);
process.stdout.write(`wrote ${out}: ${files.size} transcripts, and the ${Object.keys(expect).length} known totals in fixture.json\n`);
