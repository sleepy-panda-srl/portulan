// Writes `./ledger-hybrid/`: one session whose host requests ran the local runner, its receipts among the
// tool results, and the totals they are known to sum to.
//
// The totals are summed here from what is written, never by `../ledger.mjs`, which is what they check.

import fs from "node:fs";
import path from "node:path";

import { formatPassReceipt as receipt } from "../../packs/tools/local-llm/runner/local-llm.mjs";

const out = process.argv[2];
if (out === undefined || out === "") {
    process.stderr.write("usage: node cli/fixtures/generate-ledger-hybrid.mjs <dir>\n");
    process.exit(2);
}
for (const name of ["projects", "claude.json", "fixture.json"]) fs.rmSync(path.join(out, name), { recursive: true, force: true });

const T0 = Date.parse("2026-11-02T14:00:00.000Z");
const iso = (ms) => new Date(ms).toISOString();
const S = 1000;

const H = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";
const cwd = "/work/hybrid";
const branch = "feature/local";
const VERSION = "2.1.317";

const TRANSFORM = { mode: "transform", model: "local-coder", target: "parse.mjs", attempts: 2, promptTokens: 1840, completionTokens: 412, totalMs: 5310, tokPerSec: 77.6 };
const SUMMARIZE = { mode: "summarize", model: "local-prose", attempts: 1, promptTokens: 2210 };
const DELEGATED = { mode: "transform", model: "local-coder", target: "lexer.mjs", attempts: 1, promptTokens: 960, completionTokens: 188, totalMs: 2400, tokPerSec: 78.3 };
const QUOTED = receipt({ mode: "chat", model: "local-prose", attempts: 1, promptTokens: 90, completionTokens: 30, totalMs: 800, tokPerSec: 37.5 });

let n = 0;
const nextId = () => `msg_hybrid${String(++n).padStart(4, "0")}`;
const call = (id, name) => ({ type: "tool_use", id, name, input: { "(synthetic)": "the ledger reads a call's name and id only" } });
const said = (text) => ({ type: "text", text });

const requests = [];
const counted = [];
const lines = new Map();
const add = (rel, record) => {
    if (!lines.has(rel)) lines.set(rel, []);
    lines.get(rel).push(typeof record === "string" ? record : JSON.stringify(record));
};
const chain = (agent) => ({ isSidechain: agent !== null, ...(agent ? { agentId: agent } : {}) });

// One record per content block, each carrying the whole usage, as the host writes them.
function request(rel, agent, at, o, content) {
    const r = { id: nextId(), uncached: 0, w1h: 0, w5m: 0, read: 0, output: 0, agent, ...o };
    requests.push(r);
    content.forEach((block, b) =>
        add(rel, {
            parentUuid: null,
            ...chain(agent),
            userType: "external",
            cwd,
            sessionId: H,
            version: VERSION,
            gitBranch: branch,
            effort: "high",
            requestId: `req_${r.id}`,
            apiBlockIndex: b,
            type: "assistant",
            uuid: `${r.id}-block-${b}`,
            timestamp: iso(at),
            message: {
                id: r.id,
                type: "message",
                role: "assistant",
                model: "model-a",
                content: [block],
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
        }),
    );
    return r;
}

function result(rel, agent, at, id, content, receipts = []) {
    add(rel, { parentUuid: null, ...chain(agent), type: "user", message: { role: "user", content: [{ tool_use_id: id, type: "tool_result", content, is_error: false }] }, uuid: `result-${id}`, timestamp: iso(at), userType: "external", cwd, sessionId: H, version: VERSION, gitBranch: branch });
    counted.push(...receipts.map((o) => ({ in: o.promptTokens ?? null, out: o.completionTokens ?? null, time: o.totalMs ?? null })));
}

const ctx = (r) => r.uncached + r.w1h + r.w5m + r.read;
const main = `projects/-work-hybrid/${H}.jsonl`;
const sub = `projects/-work-hybrid/${H}/subagents/agent-lw1.jsonl`;
let t = T0;

add(main, { type: "user", isSidechain: false, cwd, sessionId: H, gitBranch: branch, timestamp: iso(t), uuid: "prompt-1", message: { role: "user", content: `a prompt quoting a receipt is no receipt:\n${QUOTED}` } });

// The runner's own output, on stdout and stderr together, as a Bash result carries them.
const H1 = request(main, null, t, { uncached: 3, w1h: 30000, read: 8000, output: 200 }, [said("(synthetic)"), call("toolu_hybrid01", "Bash")]);
result(main, null, (t += 20 * S), "toolu_hybrid01", `kept parse.mjs lines 10-42\n${receipt(TRANSFORM)}`, [TRANSFORM]);
request(main, null, (t += S), { uncached: 1, w1h: 1500, read: 38000, output: 150 }, [call("toolu_hybrid02", "Bash")]);
result(main, null, (t += 20 * S), "toolu_hybrid02", `(a synthetic digest)\n${receipt(SUMMARIZE)}`, [SUMMARIZE]);

// Lines a runner never prints, each one edit from a receipt.
const near = [
    QUOTED.replace("spend=$0.00", "spend=$0.01"),
    `  ${QUOTED}`,
    `${QUOTED} `,
    QUOTED.replace("attempts=1", "attempts=0"),
    QUOTED.replace("in=90t", "in=?t"),
    QUOTED.replace("in=90t", "in=090t"),
    QUOTED.replace("out=30t", "out=-30t"),
    QUOTED.replace("OK ", "FAIL "),
    `$ echo ${QUOTED}`,
];
request(main, null, (t += S), { uncached: 1, w1h: 1200, read: 39500, output: 140 }, [call("toolu_hybrid03", "Bash")]);
result(main, null, (t += 5 * S), "toolu_hybrid03", near.join("\n"));

// A local-worker subagent runs the runner itself, and its report quotes the receipt back.
request(main, null, (t += S), { uncached: 1, w1h: 2000, read: 40700, output: 300 }, [said(`the last receipt read:\n${QUOTED}`), call("toolu_hybrid04", "Agent")]);
let s = t + S;
request(sub, "lw1", s, { uncached: 2, w5m: 9000, output: 120 }, [call("toolu_hybrid05", "Bash")]);
result(sub, "lw1", (s += 10 * S), "toolu_hybrid05", receipt(DELEGATED), [DELEGATED]);
request(sub, "lw1", (s += S), { uncached: 1, w5m: 700, read: 9002, output: 90 }, [said("(synthetic report)")]);
result(main, null, (t = s + 5 * S), "toolu_hybrid04", [said(`lexer.mjs kept:\n${receipt(DELEGATED)}`)]);
// A result answering no call this transcript made.
result(main, null, (t += S), "toolu_hybrid99", receipt(TRANSFORM));
const last = request(main, null, (t += S), { uncached: 1, w1h: 900, read: 42700, output: 180 }, [said("(synthetic)")]);

for (const [rel, body] of lines) {
    const full = path.join(out, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, `${body.join("\n")}\n`);
}

// ---- the host's own totals for the session, subagent included: the ledger's, to the token
const sum = (rs, k) => rs.reduce((a, r) => a + r[k], 0);
const hostH = { uncached: sum(requests, "uncached"), written: sum(requests, "w1h") + sum(requests, "w5m"), read: sum(requests, "read"), output: sum(requests, "output") };
const claude = { projects: { [cwd]: { lastSessionId: H, lastTotalInputTokens: hostH.uncached, lastTotalOutputTokens: hostH.output, lastTotalCacheCreationInputTokens: hostH.written, lastTotalCacheReadInputTokens: hostH.read } } };
fs.writeFileSync(path.join(out, "claude.json"), `${JSON.stringify(claude, null, 2)}\n`);

// ---- the known totals, from what was written
const host = requests.filter((r) => r.agent === null);
const subagent = requests.filter((r) => r.agent !== null);
const pair = (k) => [sum(host, k), sum(subagent, k)];
const blocks = [...lines.values()].flat().filter((l) => JSON.parse(l).type === "assistant").length;
const figure = (k) => (counted.some((r) => r[k] !== null) ? counted.reduce((a, r) => a + (r[k] ?? 0), 0) : null);
const expect = {
    records: blocks,
    duplicates: blocks - requests.length,
    synthetic: 0,
    malformed: 0,
    requests: [host.length, subagent.length],
    uncached: pair("uncached"),
    written1h: pair("w1h"),
    written5m: pair("w5m"),
    writtenUnknown: [0, 0],
    read: pair("read"),
    output: pair("output"),
    sessions: 1,
    subagentContexts: 1,
    compactions: 0,
    largest: Math.max(...requests.map(ctx)),
    rebuilds: 0,
    rebuilt: 0,
    causes: {},
    host: [{ session: H, difference: { uncached: 0, written: 0, read: 0, output: 0 } }],
    local: {
        receipts: counted.length,
        sessions: 1,
        in: figure("in"),
        out: figure("out"),
        time: figure("time"),
        unreported: Object.fromEntries(["in", "out", "time"].map((k) => [k, counted.filter((r) => r[k] === null).length])),
    },
    // The host's alone: a fresh context written for an hour, at the general multipliers.
    threshold: Math.round(ctx(H1) * (1 + 2 / (20 * 0.1))),
};
if (ctx(last) >= expect.threshold) throw new Error("the session is meant to end below its threshold");
fs.writeFileSync(path.join(out, "fixture.json"), `${JSON.stringify({ roots: [cwd], branch, expect }, null, 2)}\n`);
process.stdout.write(`wrote ${out}: ${lines.size} transcripts, and the ${Object.keys(expect).length} known totals in fixture.json\n`);
