// Tests for `ledger` — what a change spends, from the host's own usage records.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    GENERAL_READ,
    HORIZON,
    LedgerError,
    WRITE_BY_LIFETIME,
    collect,
    compareHost,
    contextOf,
    describeMultipliers,
    figureOf,
    foldFigures,
    hostPaths,
    hostTotals,
    ledger,
    markRebuilds,
    mayHold,
    multipliers,
    overflowingWrite,
    print,
    projectKey,
    readLine,
    readSpend,
    receiptOf,
    readTranscript,
    restartThreshold,
    run,
    sessionFigures,
    tally,
    tallyLocal,
    thresholdFor,
    worktrees,
} from "./ledger.mjs";
import { formatDedupReceipt, formatPassReceipt } from "../packs/tools/local-llm/runner/local-llm.mjs";

// The ledger's defaults read the host's configuration home: point it at an empty one.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOL = path.join(REPO, "cli", "ledger.mjs");
const FIXTURE = path.join(REPO, "cli", "fixtures", "ledger");
const HYBRID = path.join(REPO, "cli", "fixtures", "ledger-hybrid");

function withTemp(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-ledger-"));
    try {
        return fn(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

let serial = 0;
/** The records the host writes for one request: one per content block, each carrying the whole usage. */
function blocks({ id = `msg_${(serial += 1)}`, n = 1, cwd = "/r", branch = "b", model = "m", effort = "high", at = "2026-09-23T10:00:00.000Z", sidechain = false, agentId = undefined, uncached = 1, w1h = 0, w5m = 0, read = 0, output = 1, breakdown = true } = {}) {
    const usage = { input_tokens: uncached, cache_creation_input_tokens: w1h + w5m, cache_read_input_tokens: read, output_tokens: output };
    if (breakdown) usage.cache_creation = { ephemeral_1h_input_tokens: w1h, ephemeral_5m_input_tokens: w5m };
    return Array.from({ length: n }, (_, b) =>
        JSON.stringify({ type: "assistant", isSidechain: sidechain, ...(agentId ? { agentId } : {}), cwd, gitBranch: branch, effort, timestamp: at, apiBlockIndex: b, uuid: `${id}-${b}`, message: { id, model, usage, content: [{ type: "text", text: "never read" }] } }),
    );
}

const write = (file, lines) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${lines.join("\n")}\n`);
};

const boundary = (chain = {}) => JSON.stringify({ type: "system", subtype: "compact_boundary", timestamp: "2026-09-23T10:00:00.000Z", ...chain });

/** A request whose one block calls a tool, as the host writes it. */
function calling(call, { name = "Bash", ...o } = {}) {
    const [line] = blocks(o);
    const record = JSON.parse(line);
    record.message.content = [{ type: "tool_use", id: call, name, input: {} }];
    return JSON.stringify(record);
}

/** The host's record of a tool's output, which it writes as the next user turn. */
const answering = (call, content, { cwd = "/r", branch = "b", sidechain = false, agentId = undefined } = {}) =>
    JSON.stringify({ type: "user", isSidechain: sidechain, ...(agentId ? { agentId } : {}), cwd, gitBranch: branch, timestamp: "2026-09-23T10:00:01.000Z", message: { role: "user", content: [{ tool_use_id: call, type: "tool_result", content, is_error: false }] } });

const RECEIPT = "OK mode=transform model=local-coder target=a b.mjs attempts=2 in=1840t out=412t time=5310ms rate=77.6tok/s spend=$0.00";

describe("reading one transcript", () => {
    test("a request written once per content block is counted once, each class at the largest its records carry", () => {
        withTemp((dir) => {
            const file = path.join(dir, "s.jsonl");
            const lines = blocks({ id: "msg_a", n: 3, uncached: 2, w1h: 100, read: 50, output: 7 });
            // The host's output count can grow across a request's block records; the last is the true one.
            lines[2] = lines[2].replace('"output_tokens":7', '"output_tokens":90');
            write(file, [...lines, ...blocks({ id: "msg_b", n: 2, uncached: 1, read: 150, output: 3 })]);
            const t = readTranscript(file);
            assert.equal(t.requests.length, 2);
            assert.equal(t.records, 5);
            assert.equal(t.duplicates, 3);
            assert.deepEqual(
                t.requests.map((r) => [r.uncached, r.written1h, r.read, r.output]),
                [
                    [2, 100, 50, 90],
                    [1, 0, 150, 3],
                ],
            );
        });
    });

    test("content is never what a line is read for: a prompt quoting the markers is not a record", () => {
        withTemp((dir) => {
            const file = path.join(dir, "s.jsonl");
            const prompt = JSON.stringify({ type: "user", message: { content: 'look for "usage": and "compact_boundary" here' } });
            write(file, [prompt, ...blocks({ id: "msg_a" }), prompt, ...blocks({ id: "msg_b" })]);
            const t = readTranscript(file);
            assert.equal(t.compactions, 0, "an escaped quotation of the marker is not a boundary");
            assert.equal(t.malformed, 0);
            assert.equal(t.requests.length, 2);
        });
    });

    test("a torn line is counted and passed over, and a host-written record is no request", () => {
        withTemp((dir) => {
            const file = path.join(dir, "s.jsonl");
            const synthetic = JSON.stringify({ type: "assistant", message: { id: "x", model: "<synthetic>", usage: { input_tokens: 0, output_tokens: 0 } } });
            write(file, [...blocks({ id: "msg_a" }), synthetic, '{"type":"assistant","message":{"usage":{"input_tokens":4']);
            const t = readTranscript(file);
            assert.deepEqual([t.requests.length, t.synthetic, t.malformed], [1, 1, 1]);
        });
    });

    test("writes with no lifetime stated are counted as written, under the unstated lifetime", () => {
        withTemp((dir) => {
            const file = path.join(dir, "s.jsonl");
            write(file, blocks({ w5m: 300, breakdown: false }));
            const [r] = readTranscript(file).requests;
            assert.deepEqual([r.written1h, r.written5m, r.writtenUnknown], [0, 0, 300]);
        });
    });

    test("a compaction marks the request after it, and the fresh context is the first request after the last one", () => {
        withTemp((dir) => {
            const file = path.join(dir, "s.jsonl");
            write(file, [
                ...blocks({ id: "one", w1h: 40000, read: 0 }),
                ...blocks({ id: "two", w1h: 1000, read: 40001 }),
                boundary(),
                ...blocks({ id: "three", w1h: 9000, read: 3000 }),
                ...blocks({ id: "four", w1h: 500, read: 12001 }),
            ]);
            const t = readTranscript(file);
            assert.deepEqual(t.requests.map((r) => r.compacted), [false, false, true, false]);
            assert.equal(t.figures.fresh, contextOf(t.requests[2]));
            assert.equal(t.figures.last, contextOf(t.requests[3]));
            assert.deepEqual([t.figures.freshLifetime, t.figures.compactions, t.figures.pending], ["1h", 1, false]);
        });
    });

    test("a compaction with no request after it yet leaves no threshold, not the one it replaced", () => {
        withTemp((dir) => {
            const file = path.join(dir, "s.jsonl");
            // Past its threshold of 80,000 before the compaction, so a figure from the replaced context would show.
            write(file, [...blocks({ id: "one", w1h: 39999 }), ...blocks({ id: "two", w1h: 49999, read: 40000 }), boundary()]);
            const t = readTranscript(file);
            assert.deepEqual([t.figures.compactions, t.figures.pending], [1, true]);
            assert.equal(thresholdFor(t), null);
        });
    });

    test("a subagent's compaction marks its own next request, and never the session's", () => {
        withTemp((dir) => {
            // Its own transcript: every record a sidechain, the boundary too, as the host writes them.
            const projects = path.join(dir, "projects");
            const own = { sidechain: true, agentId: "a" };
            write(path.join(projects, projectKey("/r"), "s", "subagents", "agent-a.jsonl"), [
                ...blocks({ ...own, id: "one", w1h: 40000 }),
                ...blocks({ ...own, id: "two", w1h: 1000, read: 40001 }),
                boundary({ isSidechain: true, agentId: "a" }),
                ...blocks({ ...own, id: "three", w1h: 9000, read: 3000 }),
            ]);
            write(path.join(projects, projectKey("/r"), "s.jsonl"), blocks({ read: 5 }));
            const sub = readTranscript(path.join(projects, projectKey("/r"), "s", "subagents", "agent-a.jsonl"));
            assert.deepEqual(sub.requests.map((r) => r.compacted), [false, false, true]);
            const f = tally(collect({ projects, roots: ["/r"] }).contexts, "b");
            assert.deepEqual([f.causes, f.compactions], [{ compaction: 1 }, 0], "the rebuild is the subagent's compaction, and the session compacted nothing");
            // Written inline by an earlier host: the session's next request is not compacted, and its figures stand.
            const file = path.join(dir, "inline.jsonl");
            write(file, [...blocks({ id: "m1", w1h: 40000 }), boundary({ isSidechain: true, agentId: "q" }), ...blocks({ id: "m2", w1h: 1000, read: 40001 })]);
            const t = readTranscript(file);
            assert.deepEqual(t.requests.map((r) => r.compacted), [false, false]);
            assert.deepEqual([t.figures.compactions, t.figures.pending, t.figures.fresh], [0, false, 40001]);
        });
    });

    test("folding a transcript in pieces gives the figures a whole read gives, wherever it is cut", () => {
        const transcripts = [FIXTURE, HYBRID].flatMap((root) => fs.readdirSync(path.join(root, "projects"), { recursive: true }).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(root, "projects", f)));
        for (const file of transcripts) {
            const source = fs.readFileSync(file, "utf8");
            const whole = readTranscript(file).figures;
            const lines = source.split("\n");
            for (let cut = 0; cut <= lines.length; cut += 1) {
                const figures = sessionFigures();
                for (const part of [lines.slice(0, cut), lines.slice(cut)]) {
                    for (const line of part) {
                        const read = readLine(line);
                        if (read !== null && !read.malformed) foldFigures(figures, read);
                    }
                    // What a reader keeps between calls is JSON, so each piece starts from a round trip.
                    Object.assign(figures, JSON.parse(JSON.stringify(figures)));
                }
                assert.deepEqual(figures, whole, `${file} cut at line ${cut}`);
            }
        }
    });

    test("a request written in more blocks than the running figures keep ids for is still one request", () => {
        // The figures keep the latest 16 distinct ids, and a repeat is passed over before anything is kept.
        withTemp((dir) => {
            const toolResult = JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", content: "never read" }] } });
            const inline = Array.from({ length: 20 }, () => blocks({ sidechain: true, agentId: "q", read: 3 })).flat();
            const long = blocks({ id: "msg_long", n: 40, w1h: 50000, read: 10000 });
            const around = (middle) => [...blocks({ id: "msg_first", w1h: 40000 }), ...middle, ...blocks({ id: "msg_next", w1h: 500, read: 60000 })];
            write(path.join(dir, "blocks.jsonl"), around([...long.slice(0, 20).flatMap((l) => [l, toolResult]), ...inline, ...long.slice(20)]));
            write(path.join(dir, "once.jsonl"), around(long.slice(0, 1)));
            const figures = readTranscript(path.join(dir, "blocks.jsonl")).figures;
            assert.deepEqual(figures.recent, ["msg_first", "msg_long", "msg_next"]);
            assert.deepEqual(figures, readTranscript(path.join(dir, "once.jsonl")).figures);
        });
    });
});

describe("the local runner's receipts", () => {
    test("a receipt is the runner's whole line, read as it prints it, and a figure it printed as ? is unreported, never 0", () => {
        assert.deepEqual(receiptOf(RECEIPT), { mode: "transform", model: "local-coder", attempts: 2, in: 1840, out: 412, time: 5310 });
        const unreported = formatPassReceipt({ mode: "summarize", model: "m" });
        assert.deepEqual(receiptOf(unreported), { mode: "summarize", model: "m", attempts: 1, in: null, out: null, time: null });
        const reported = formatPassReceipt({ mode: "chat", model: "m", promptTokens: 0, completionTokens: 7, totalMs: 1, tokPerSec: 7000 });
        assert.deepEqual(receiptOf(reported), { mode: "chat", model: "m", attempts: 1, in: 0, out: 7, time: 1 });
    });

    test("dedup uses the shared receipt contract for known and unreported figures", () => {
        assert.deepEqual(receiptOf(formatDedupReceipt({ model: "local-embedder", promptTokens: 7, totalMs: 4 })), {
            mode: "dedup", model: "local-embedder", attempts: 1, in: 7, out: null, time: 4,
        });
        assert.deepEqual(receiptOf(formatDedupReceipt({ model: "local-embedder" })), {
            mode: "dedup", model: "local-embedder", attempts: 1, in: null, out: null, time: null,
        });
        assert.equal(receiptOf("dedup files=3 pairs=1 threshold=0.8"), null);
    });

    test("a line one edit from a receipt is no receipt", () => {
        const near = [
            RECEIPT.replace("spend=$0.00", "spend=$0.01"),
            RECEIPT.replace("spend=$0.00", "spend=$0.00 (cached)"),
            ` ${RECEIPT}`,
            `${RECEIPT}\r`,
            RECEIPT.replace("OK ", "ok "),
            RECEIPT.replace("attempts=2", "attempts=0"),
            RECEIPT.replace("attempts=2 ", ""),
            RECEIPT.replace("in=1840t", "in=?t"),
            RECEIPT.replace("in=1840t", "in=1840"),
            RECEIPT.replace("in=1840t", "in=01840t"),
            RECEIPT.replace("out=412t", "out=-412t"),
            RECEIPT.replace("out=412t", "out=4.5t"),
            RECEIPT.replace("time=5310ms", "time=5310s"),
            RECEIPT.replace("in=1840t", `in=${"9".repeat(17)}t`),
            RECEIPT.replace("model=local-coder", "model="),
            `$ echo ${RECEIPT}`,
        ];
        for (const line of near) assert.equal(receiptOf(line), null, JSON.stringify(line));
    });

    test("only a Bash call's result is read for receipts: a prompt, an assistant's text, an agent's report and an unanswered result are not", () => {
        withTemp((dir) => {
            const file = path.join(dir, "s.jsonl");
            const [said] = blocks({ id: "msg_said" });
            const quoting = JSON.parse(said);
            quoting.message.content = [{ type: "text", text: RECEIPT }];
            write(file, [
                JSON.stringify({ type: "user", cwd: "/r", gitBranch: "b", message: { role: "user", content: `${RECEIPT}\n` } }),
                JSON.stringify(quoting),
                calling("toolu_bash"),
                answering("toolu_bash", `stdout first\n${RECEIPT}\nstderr after`),
                calling("toolu_text", {}),
                answering("toolu_text", [{ type: "text", text: RECEIPT }]),
                calling("toolu_agent", { name: "Agent" }),
                answering("toolu_agent", [{ type: "text", text: RECEIPT }]),
                calling("toolu_mixed"),
                answering("toolu_mixed", [{ type: "text", text: RECEIPT }, { type: "image" }]),
                answering("toolu_unasked", RECEIPT),
            ]);
            const t = readTranscript(file);
            assert.deepEqual(t.receipts.map((r) => r.key), ["toolu_bash#0", "toolu_text#0"]);
            assert.equal(t.records, 5, "a tool result is no usage record");
            assert.equal(t.malformed, 0);
        });
    });

    test("a receipt counts once, inside the roots, on the branch its own record names, and its figures stay apart from the host's", () => {
        withTemp((dir) => {
            const projects = path.join(dir, "projects");
            const session = [calling("toolu_1", { w1h: 1000 }), answering("toolu_1", RECEIPT), calling("toolu_2", { read: 1000 }), answering("toolu_2", formatPassReceipt({ mode: "chat", model: "m", promptTokens: 5 }), { branch: "other" })];
            write(path.join(projects, projectKey("/r"), "s.jsonl"), session);
            write(path.join(projects, projectKey("/r"), "t.jsonl"), session.slice(0, 2));
            write(path.join(projects, projectKey("/r-old"), "u.jsonl"), [calling("toolu_3", { cwd: "/r-old" }), answering("toolu_3", RECEIPT, { cwd: "/r-old" })]);
            const report = ledger({ projects, config: null, roots: ["/r"], branch: "b" });
            assert.deepEqual(report.local, { receipts: 1, sessions: 1, in: 1840, out: 412, time: 5310, unreported: { in: 0, out: 0, time: 0 } });
            assert.deepEqual([report.figures.total.uncached, report.figures.total.output], [2, 2], "the host's tokens are its two requests', with nothing of the receipt's");
            assert.deepEqual(tallyLocal(report.collected.receipts, "other"), { receipts: 1, sessions: 1, in: 5, out: null, time: null, unreported: { in: 0, out: 1, time: 1 } });
            assert.deepEqual(tallyLocal([], "b"), { receipts: 0, sessions: 0, in: null, out: null, time: null, unreported: { in: 0, out: 0, time: 0 } });
        });
    });

    test("a receipt in a subagent's own transcript is the subagent's, counted under its session", () => {
        withTemp((dir) => {
            const projects = path.join(dir, "projects");
            write(path.join(projects, projectKey("/r"), "s.jsonl"), [calling("toolu_a", { name: "Agent", w1h: 1000 }), answering("toolu_a", [{ type: "text", text: RECEIPT }])]);
            write(path.join(projects, projectKey("/r"), "s", "subagents", "agent-lw.jsonl"), [calling("toolu_b", { sidechain: true, agentId: "lw" }), answering("toolu_b", RECEIPT, { sidechain: true, agentId: "lw" })]);
            const report = ledger({ projects, config: null, roots: ["/r"], branch: "b" });
            assert.deepEqual(report.collected.receipts.map((r) => [r.session, r.agent, r.key]), [["s", "lw", "toolu_b#0"]]);
            assert.equal(report.local.receipts, 1);
        });
    });

    test("receipts are never a figure of the threshold: whatever they carry, it is the host's alone, and finite", () => {
        withTemp((dir) => {
            const file = (name) => path.join(dir, `${name}.jsonl`);
            const host = [calling("toolu_1", { w1h: 40000 }), calling("toolu_2", { uncached: 2, w1h: 500, read: 40000 })];
            const odd = ["OK mode=chat model=m attempts=1 in=0t out=0t time=0ms rate=0tok/s spend=$0.00", formatPassReceipt({ mode: "chat", model: "m" }), RECEIPT.replace("in=1840t", `in=${Number.MAX_SAFE_INTEGER}t`)];
            write(file("host"), host);
            write(file("hybrid"), [host[0], answering("toolu_1", odd.join("\n")), host[1], answering("toolu_2", RECEIPT)]);
            const hybrid = readTranscript(file("hybrid"));
            assert.equal(hybrid.receipts.length, 4);
            assert.deepEqual(hybrid.figures, readTranscript(file("host")).figures);
            const figure = thresholdFor(hybrid);
            assert.ok(Number.isFinite(figure.threshold) && figure.threshold > 0, String(figure.threshold));
            assert.equal(figure.threshold, restartThreshold({ fresh: 40001, write: 2, read: GENERAL_READ }));
            // The advisory folds line by line, and a result line leaves its figures as they were.
            const before = JSON.stringify(hybrid.figures);
            assert.equal(JSON.stringify(foldFigures(hybrid.figures, readLine(answering("toolu_1", RECEIPT)))), before);
        });
    });

    test("a zero-price multiplier is refused wherever one could arrive, so $0.00 is never divided by", () => {
        const write5 = { "5m": 1.25, "1h": 2 };
        assert.throws(() => readSpend({ multipliers: { read: 0, write: write5 } }, "ws/workspace.json"), (error) => error instanceof LedgerError && /sets `read` to 0, which is not a number above 0 and at most 1/.test(error.message));
        for (const zero of [{ read: 0 }, { write: 0 }, { fresh: 0 }, { horizon: 0 }, { read: Number.NaN }]) {
            assert.throws(() => restartThreshold({ fresh: 1, read: 0.1, write: 2, horizon: 20, ...zero }), LedgerError, JSON.stringify(zero));
        }
        // A session whose only records are receipts has no fresh context, so no threshold, and says what one would take.
        withTemp((dir) => {
            const projects = path.join(dir, "projects");
            write(path.join(projects, projectKey("/r"), "s.jsonl"), [calling("toolu_1", { branch: "other" }), answering("toolu_1", RECEIPT)]);
            const report = ledger({ projects, config: null, roots: ["/r"], branch: "b" });
            assert.equal(report.restart, null);
            const lines = [];
            print(report, (l) => lines.push(l));
            assert.deepEqual(lines.slice(3, 5), [
                "  no request on b is recorded here",
                "  local worker: 1 line(s) in the runner's receipt format, from Bash results in 1 session(s), at $0.00, none of it in the host's tokens or the restart threshold: in 1,840 tokens, out 412 tokens, time 5,310 ms",
            ]);
            assert.match(lines[5], /^  restart: no session on this branch has a request with a time to judge; a threshold would take a horizon of 20 requests/);
        });
    });
});

describe("rebuilds and their causes", () => {
    const at = (minutes) => new Date(Date.UTC(2026, 8, 23, 10, 0) + minutes * 60000).toISOString();
    const req = (o) => ({ uncached: 1, written1h: 0, written5m: 0, writtenUnknown: 0, read: 0, output: 1, model: "m", effort: "high", compacted: false, ...o, at: Date.parse(at(o.minute ?? 0)) });

    test("each cause is read from the records around the rebuild, in order", () => {
        const rs = markRebuilds([
            req({ minute: 0, written1h: 40000 }),
            req({ minute: 1, written1h: 1000, read: 40001 }),
            req({ minute: 130, written1h: 35000, read: 6000 }), // the hour lapsed
            req({ minute: 131, model: "n", written1h: 42000 }),
            req({ minute: 132, model: "n", effort: "max", written1h: 43000 }),
            req({ minute: 133, model: "n", effort: "max", written1h: 9000, read: 3000, compacted: true }),
            req({ minute: 134, model: "n", effort: "max", written1h: 11000, read: 1000 }),
        ]);
        assert.deepEqual(
            rs.map((r) => r.rebuild?.cause ?? null),
            [null, null, "lifetime lapsed", "model change", "effort change", "compaction", "unexplained"],
        );
        assert.equal(rs[2].rebuild.tokens, 41001 - 6000, "what it could have read is the prefix before it, as far as its own context still carries it");
    });

    test("a five-minute lifetime lapses in five minutes, and a one-hour one does not", () => {
        const five = markRebuilds([req({ minute: 0, written5m: 30000 }), req({ minute: 10, written5m: 30001 })]);
        assert.equal(five[1].rebuild?.cause, "lifetime lapsed");
        const hour = markRebuilds([req({ minute: 0, written1h: 30000 }), req({ minute: 10, written1h: 30001 })]);
        assert.equal(hour[1].rebuild?.cause, "unexplained");
    });

    test("a model the records do not name is no model change, as an effort they do not name is no effort change", () => {
        const rs = markRebuilds([req({ minute: 0, written1h: 40000 }), req({ minute: 1, model: null, written1h: 42000 })]);
        assert.equal(rs[1].rebuild?.cause, "unexplained");
    });

    test("a miss under 2,000 tokens, or under 5% of the context, is no rebuild — the host's own threshold", () => {
        const small = markRebuilds([req({ written1h: 30000 }), req({ minute: 1, written1h: 1999, read: 28002 })]);
        assert.equal(small[1].rebuild, null);
        const share = markRebuilds([req({ written1h: 100000 }), req({ minute: 1, written1h: 4999, read: 95002 })]);
        assert.equal(share[1].rebuild, null, "4,999 of 100,001 is under 5%");
    });
});

describe("where the host keeps its records", () => {
    test("the configuration home is CLAUDE_CONFIG_DIR, else ~/.claude, with the totals file beside it; a relative one is a reason, never ~/.claude", () => {
        assert.deepEqual(hostPaths({ CLAUDE_CONFIG_DIR: "/c" }, "/h"), { projects: path.join("/c", "projects"), config: path.join("/c", ".claude.json") });
        assert.deepEqual(hostPaths({}, "/h"), { projects: path.join("/h", ".claude", "projects"), config: path.join("/h", ".claude.json") });
        assert.match(hostPaths({ CLAUDE_CONFIG_DIR: "relative" }, "/h").why, /the relative path "relative".*name --projects and --config/);
    });

    test("a project key is the path with every other character a dash, cut at 200 with the host's hash", () => {
        assert.equal(projectKey("/home/claude/portulan"), "-home-claude-portulan");
        assert.equal(projectKey("/Users/x/Projects/some.repo/.claude/worktrees/w1-3b64a9"), "-Users-x-Projects-some-repo--claude-worktrees-w1-3b64a9");
        const long = `/${"a".repeat(250)}`;
        const key = projectKey(long);
        assert.match(key, /^-a{199}-[0-9a-z]+$/);
        assert.ok(mayHold(key, long));
        assert.ok(mayHold(projectKey(`${long}/sub`), long), "a session in a subdirectory of a long root");
    });

    test("a sibling directory sharing the prefix may be opened, and its requests are never counted", () => {
        withTemp((dir) => {
            const projects = path.join(dir, "projects");
            write(path.join(projects, projectKey("/w/demo"), "s1.jsonl"), blocks({ cwd: "/w/demo", w1h: 10 }));
            write(path.join(projects, projectKey("/w/demo-old"), "s2.jsonl"), blocks({ cwd: "/w/demo-old", w1h: 99 }));
            write(path.join(projects, projectKey("/elsewhere"), "s3.jsonl"), blocks({ cwd: "/elsewhere", w1h: 77 }));
            assert.ok(mayHold(projectKey("/w/demo-old"), "/w/demo"), "the pre-filter cannot tell them apart");
            const c = collect({ projects, roots: ["/w/demo"] });
            assert.equal(c.files, 2, "the unrelated project is never opened");
            assert.equal(tally(c.contexts, "b").total.written1h, 10);
        });
    });

    test("a subagent's transcript is found at any depth under its session's subagents/, and kept apart", () => {
        withTemp((dir) => {
            const projects = path.join(dir, "projects");
            const key = path.join(projects, projectKey("/r"));
            write(path.join(key, "s.jsonl"), blocks({ read: 5 }));
            write(path.join(key, "s", "subagents", "agent-a.jsonl"), blocks({ sidechain: true, read: 7 }));
            write(path.join(key, "s", "subagents", "workflows", "w", "agent-b.jsonl"), blocks({ sidechain: true, read: 11 }));
            write(path.join(key, "s", "subagents", "notes.txt"), ["not a transcript"]);
            const f = tally(collect({ projects, roots: ["/r"] }).contexts, "b");
            assert.deepEqual([f.main.read, f.subagents.read, f.sessions, f.subagentContexts], [5, 18, 1, 2]);
        });
    });

    test("a sidechain written inline, as earlier hosts did, is a subagent's context and not the session's", () => {
        withTemp((dir) => {
            const projects = path.join(dir, "projects");
            write(path.join(projects, projectKey("/r"), "s.jsonl"), [...blocks({ read: 5 }), ...blocks({ sidechain: true, agentId: "q", read: 7 }), ...blocks({ read: 9 })]);
            const f = tally(collect({ projects, roots: ["/r"] }).contexts, "b");
            assert.deepEqual([f.main.requests, f.subagents.requests, f.subagentContexts], [2, 1, 1]);
        });
    });

    test("a request copied into a second transcript is one request", () => {
        withTemp((dir) => {
            const projects = path.join(dir, "projects");
            const copied = blocks({ id: "msg_shared", read: 1000 });
            write(path.join(projects, projectKey("/r"), "a.jsonl"), copied);
            write(path.join(projects, projectKey("/r"), "b.jsonl"), [...copied, ...blocks({ read: 1 })]);
            const c = collect({ projects, roots: ["/r"] });
            assert.equal(tally(c.contexts, "b").total.read, 1001);
            assert.equal(c.duplicates, 1);
        });
    });

    test("a copy outside the roots, read first, passes over no copy inside them", () => {
        withTemp((dir) => {
            const projects = path.join(dir, "projects");
            // The sibling's key sorts before the second root's, so its copy is read first.
            write(path.join(projects, projectKey("/w/demo-0ld"), "a.jsonl"), blocks({ id: "msg_shared", cwd: "/w/demo-0ld", read: 1000 }));
            write(path.join(projects, projectKey("/w/demo-feature"), "b.jsonl"), blocks({ id: "msg_shared", cwd: "/w/demo-feature", read: 1000 }));
            const c = collect({ projects, roots: ["/w/demo", "/w/demo-feature"] });
            assert.equal(c.files, 2);
            assert.equal(tally(c.contexts, "b").total.read, 1000);
            assert.equal(c.duplicates, 0);
        });
    });

    test("the request after copied ones is judged against them, whichever transcript is read first", () => {
        const copied = [...blocks({ id: "msg_1", at: "2026-09-23T10:00:00.000Z", w1h: 40000 }), ...blocks({ id: "msg_2", at: "2026-09-23T10:01:00.000Z", w1h: 1000, read: 40000 })];
        // Resumed two and a half hours later: the hour has lapsed, and the whole prefix is written again.
        const resumed = [...copied, ...blocks({ id: "msg_3", at: "2026-09-23T12:31:00.000Z", w1h: 42000 })];
        for (const [original, copy] of [["a", "b"], ["d", "c"]]) {
            withTemp((dir) => {
                const projects = path.join(dir, "projects");
                write(path.join(projects, projectKey("/r"), `${original}.jsonl`), copied);
                write(path.join(projects, projectKey("/r"), `${copy}.jsonl`), resumed);
                const f = tally(collect({ projects, roots: ["/r"] }).contexts, "b");
                assert.equal(f.main.requests, 3, `${copy} holding the copies`);
                assert.deepEqual([f.rebuilds, f.rebuilt, f.causes], [1, 41001, { "lifetime lapsed": 1 }], `${copy} holding the copies`);
            });
        }
    });

    test("a request is attributed to the branch its own record names, whatever the session began on", () => {
        withTemp((dir) => {
            const projects = path.join(dir, "projects");
            write(path.join(projects, projectKey("/r"), "s.jsonl"), [...blocks({ branch: "main", read: 3 }), ...blocks({ branch: "topic", read: 5 })]);
            const c = collect({ projects, roots: ["/r"] });
            assert.equal(tally(c.contexts, "topic").total.read, 5);
            assert.equal(tally(c.contexts, "main").total.read, 3);
        });
    });
});

describe("the restart threshold", () => {
    test("it reproduces proposal 0038's worked figures for an 85k fresh context and 20 requests to go", () => {
        const f = 85000;
        assert.equal(restartThreshold({ fresh: f, read: 0.1, write: 1.25 }), 138125);
        assert.equal(restartThreshold({ fresh: f, read: 0.1, write: 2 }), 170000);
        assert.equal(restartThreshold({ fresh: f, read: 0.05, write: 2 }), 255000);
        assert.equal(restartThreshold({ fresh: f, read: 0.025, write: 2 }), 425000);
        assert.equal(HORIZON, 20);
    });

    test("undeclared multipliers are the general read and the write of the lifetime the host recorded, and say so", () => {
        assert.deepEqual(multipliers({ lifetime: "1h" }), { read: GENERAL_READ, write: WRITE_BY_LIFETIME["1h"], lifetime: "1h", recorded: true, source: "undeclared" });
        assert.deepEqual(multipliers({}), { read: 0.1, write: 1.25, lifetime: "5m", recorded: false, source: "undeclared" });
    });

    test("a threshold refuses a zero it would divide by", () => {
        assert.throws(() => restartThreshold({ fresh: 1, read: 0, write: 2 }));
    });

    test("a session with no request yet has no threshold", () => {
        assert.equal(figureOf(sessionFigures()), null);
    });

    test("declared multipliers take the write of the lifetime the host recorded, as the general ones do, and say so", () => {
        // A declaration prices both lifetimes, and the records say which one applies.
        const declared = { read: 0.05, write: { "5m": 1.25, "1h": 2 } };
        assert.deepEqual(multipliers({ declared, lifetime: "1h" }), { read: 0.05, write: 2, lifetime: "1h", recorded: true, source: "declared" });
        assert.deepEqual(multipliers({ declared }), { read: 0.05, write: 1.25, lifetime: "5m", recorded: false, source: "declared" });
        assert.equal(describeMultipliers(multipliers({ declared, lifetime: "5m" })), "multipliers declared: read 0.05×, write 1.25× (the five-minute writes the host recorded)");
        assert.equal(describeMultipliers(multipliers({ declared })), "multipliers declared: read 0.05×, write 1.25× (a five-minute write, the lifetime the records did not state)");
        // A fresh context of 40,000 written for an hour, judged 30 requests out: 40,000 × (1 + 2 / (30 × 0.05)).
        const figure = figureOf({ ...sessionFigures(), fresh: 40000, freshLifetime: "1h", lifetime: "1h", last: 50000 }, { declared, horizon: 30 });
        assert.deepEqual([figure.threshold, figure.horizon, figure.multipliers.write], [93333, 30, 2]);
    });
});

describe("a declared `spend`, as a manifest carries it", () => {
    // `compile` reads a manifest through `readSpend` without `doctor` having run, so it refuses what `doctor` refuses.
    const write = { "5m": 1.25, "1h": 2 };

    test("undeclared, either half alone, or both, each read as the shape the threshold takes", () => {
        assert.deepEqual(readSpend(undefined, "w.json"), { multipliers: null, horizon: null, restart: null });
        assert.deepEqual(readSpend({}, "w.json"), { multipliers: null, horizon: null, restart: null });
        assert.deepEqual(readSpend({ horizon: { requests: 30 } }, "w.json"), { multipliers: null, horizon: 30, restart: null });
        assert.deepEqual(readSpend({ multipliers: { read: 0.05, write }, horizon: { requests: 30 } }, "w.json"), { multipliers: { read: 0.05, write }, horizon: 30, restart: null });
        // The bounds themselves: a read at the cost of an uncached token, and writes at it.
        assert.deepEqual(readSpend({ multipliers: { read: 1, write: { "5m": 1, "1h": 1 } } }, "w.json").multipliers, { read: 1, write: { "5m": 1, "1h": 1 } });
        // `doctor`'s positive-integer check passes a horizon past 2^53, so it is taken here too.
        assert.equal(readSpend({ horizon: { requests: 1e16 } }, "w.json").horizon, 1e16);
    });

    test("what a crossed threshold does is read as declared, alone or beside the figures", () => {
        for (const restart of ["advise", "block"]) {
            assert.deepEqual(readSpend({ restart }, "w.json"), { multipliers: null, horizon: null, restart });
            assert.equal(readSpend({ multipliers: { read: 0.05, write }, horizon: { requests: 30 }, restart }, "w.json").restart, restart);
        }
    });

    for (const [what, spend, says] of [
        ["a list in place of the object", [], /is not an object/],
        ["null", null, /is not an object/],
        ["an unknown key", { price: 1 }, /names `price`, which is neither `multipliers` nor `horizon` nor `restart`/],
        ["a restart it does not take", { restart: "stop" }, /sets `restart` to "stop", which is neither "advise" nor "block"/],
        ["a restart spelled as a boolean", { restart: true }, /sets `restart` to true/],
        ["multipliers with no write", { multipliers: { read: 0.1 } }, /at `multipliers` has no `write`/],
        ["multipliers with no read", { multipliers: { write } }, /at `multipliers` has no `read`/],
        ["a write for one lifetime only", { multipliers: { read: 0.1, write: { "5m": 1.25 } } }, /at `multipliers\.write` has no `1h`/],
        ["a lifetime the host does not take", { multipliers: { read: 0.1, write: { ...write, "30m": 1.5 } } }, /at `multipliers\.write` names `30m`, which is neither `5m` nor `1h`/],
        ["a read of 0, which the threshold would divide by", { multipliers: { read: 0, write } }, /sets `read` to 0, which is not a number above 0 and at most 1/],
        ["a read above 1", { multipliers: { read: 1.5, write } }, /sets `read` to 1\.5/],
        ["a read spelled as a string", { multipliers: { read: "0.1", write } }, /sets `read` to "0\.1"/],
        ["a write under 1", { multipliers: { read: 0.1, write: { ...write, "5m": 0.5 } } }, /at `multipliers\.write` sets `5m` to 0\.5, which is not a number of at least 1/],
        ["a horizon of 0", { horizon: { requests: 0 } }, /at `horizon` sets `requests` to 0, which is not a positive integer/],
        ["a fractional horizon", { horizon: { requests: 2.5 } }, /sets `requests` to 2\.5/],
        ["a horizon with no requests", { horizon: {} }, /at `horizon` has no `requests`/],
        ["a horizon with a key besides", { horizon: { requests: 20, turns: 3 } }, /names `turns`, which is not `requests`/],
    ]) {
        test(`${what} is refused, naming the manifest and the fault`, () => {
            assert.throws(
                () => readSpend(spend, "w.json"),
                (e) => e instanceof LedgerError && e.message.startsWith("`spend` in w.json ") && says.test(e.message),
            );
        });
    }
});

describe("the host's own totals", () => {
    test("only numbers are taken, only for projects inside a root, and the difference is ledger less host", () => {
        withTemp((dir) => {
            const config = path.join(dir, "claude.json");
            const totals = { lastTotalInputTokens: 10, lastTotalCacheCreationInputTokens: 20, lastTotalCacheReadInputTokens: 30, lastTotalOutputTokens: 40 };
            fs.writeFileSync(config, JSON.stringify({ oauthAccount: { emailAddress: "never read" }, projects: { "/r": { lastSessionId: "s", ...totals }, "/other": { lastSessionId: "t", ...totals }, "/r/sub": { lastSessionId: "u", lastTotalInputTokens: "ten" } } }));
            const found = hostTotals(config, ["/r"]);
            assert.deepEqual(found.map((h) => h.session), ["s"], "outside a root, or not numbers, is passed over");
            const projects = path.join(dir, "projects");
            write(path.join(projects, projectKey("/r"), "s.jsonl"), blocks({ uncached: 9, w1h: 20, read: 31, output: 38 }));
            const [cmp] = compareHost(collect({ projects, roots: ["/r"] }).contexts, found);
            assert.deepEqual(cmp.difference, { uncached: -1, written: 0, read: 1, output: -2 });
        });
    });

    test("no configuration file is no totals, and an unreadable one is could-not-run", () => {
        withTemp((dir) => {
            assert.deepEqual(hostTotals(path.join(dir, "absent.json"), ["/r"]), []);
            fs.writeFileSync(path.join(dir, "bad.json"), "{");
            assert.throws(() => hostTotals(path.join(dir, "bad.json"), ["/r"]), /could not be read/);
        });
    });
});

describe("the command", () => {
    const say = () => {
        const lines = [];
        return { lines, fn: (l) => lines.push(l) };
    };

    test("the committed fixtures reproduce their known totals", () => {
        for (const fixture of [FIXTURE, HYBRID]) {
            const out = say();
            assert.equal(run(["--fixture", fixture], out.fn), 0, out.lines.join("\n"));
            assert.match(out.lines.at(-1), /ok fixture/);
        }
    });

    test("each fixture is what its generator writes, byte for byte, known totals included", () => {
        for (const [fixture, generator] of [[FIXTURE, "generate-ledger.mjs"], [HYBRID, "generate-ledger-hybrid.mjs"]]) {
            withTemp((dir) => {
                const result = spawnSync(process.execPath, [path.join(REPO, "cli", "fixtures", generator), dir], { encoding: "utf8" });
                assert.equal(result.status, 0, result.stderr);
                const files = (root) => fs.readdirSync(root, { recursive: true }).filter((f) => fs.statSync(path.join(root, f)).isFile()).sort();
                assert.deepEqual(files(dir), files(fixture));
                for (const f of files(fixture)) assert.ok(fs.readFileSync(path.join(dir, f)).equals(fs.readFileSync(path.join(fixture, f))), `${f} is not what ${generator} writes`);
            });
        }
    });

    test("the hybrid session's receipts are on their own line at $0.00, beside the host's tokens and its finite threshold", () => {
        const out = say();
        assert.equal(run(["--fixture", HYBRID], out.fn), 0, out.lines.join("\n"));
        const at = out.lines.findIndex((l) => l.startsWith("  local worker: "));
        assert.equal(out.lines[at - 1].trimStart().split(/\s+/)[0], "output", "it follows the host's token rows");
        assert.equal(
            out.lines[at],
            "  local worker: 4 line(s) in the runner's receipt format, from Bash results in 1 session(s), at $0.00, none of it in the host's tokens or the restart threshold: in 5,017 tokens, out 600 tokens (2 receipt(s) did not report it), time 7,714 ms (1 receipt(s) did not report it)",
        );
        assert.ok(out.lines.some((l) => l.startsWith("  restart: session hybrid is at 43,601 tokens and is below its threshold of 76,006 = ")), out.lines.join("\n"));
        const plain = say();
        run(["--fixture", FIXTURE], plain.fn);
        assert.ok(plain.lines.includes("  local worker: no line in the runner's receipt format on feature/x is recorded here"));
    });

    test("a hybrid fixture that counts a receipt it should not is red, and names the figure", () => {
        withTemp((dir) => {
            fs.cpSync(HYBRID, dir, { recursive: true });
            const spec = JSON.parse(fs.readFileSync(path.join(dir, "fixture.json"), "utf8"));
            spec.expect.local.receipts += 1;
            fs.writeFileSync(path.join(dir, "fixture.json"), JSON.stringify(spec));
            const out = say();
            assert.equal(run(["--fixture", dir], out.fn), 1);
            assert.ok(out.lines.some((l) => l.startsWith('  ✗ fixture: local is {"receipts":4,')), out.lines.join("\n"));
        });
    });

    test("a fixture whose known totals the reader no longer reproduces is red, and names the figure", () => {
        withTemp((dir) => {
            fs.cpSync(FIXTURE, dir, { recursive: true });
            const spec = JSON.parse(fs.readFileSync(path.join(dir, "fixture.json"), "utf8"));
            spec.expect.rebuilds += 1;
            fs.writeFileSync(path.join(dir, "fixture.json"), JSON.stringify(spec));
            const out = say();
            assert.equal(run(["--fixture", dir], out.fn), 1);
            assert.ok(out.lines.some((l) => /✗ fixture: rebuilds is 6, and its known total is 7/.test(l)));
        });
    });

    test("a fixture without its records or its totals file, or with roots that are not absolute paths, is could-not-run", () => {
        const respec = (change) => (dir) => {
            const file = path.join(dir, "fixture.json");
            const spec = JSON.parse(fs.readFileSync(file, "utf8"));
            change(spec);
            fs.writeFileSync(file, JSON.stringify(spec));
        };
        const cases = [
            [(dir) => fs.rmSync(path.join(dir, "projects"), { recursive: true }), /--fixture \S*projects could not be read — ENOENT/],
            [(dir) => fs.rmSync(path.join(dir, "claude.json")), /--fixture \S*claude\.json could not be read — ENOENT/],
            [respec((s) => (s.roots = ["work/demo"])), /does not carry roots as absolute paths/],
            [respec((s) => (s.roots = [7])), /does not carry roots as absolute paths/],
            [respec((s) => (s.roots = [])), /does not carry roots as absolute paths/],
            [respec((s) => (s.expect = [])), /does not carry roots as absolute paths, a branch and the known totals/],
        ];
        for (const [spoil, said] of cases) {
            withTemp((dir) => {
                fs.cpSync(FIXTURE, dir, { recursive: true });
                spoil(dir);
                const out = say();
                assert.equal(run(["--fixture", dir], out.fn), 2, out.lines.join("\n"));
                assert.match(out.lines.join("\n"), said);
            });
        }
    });

    test("--fixture reads nothing but the fixture, so it takes no other argument", () => {
        const out = say();
        assert.equal(run(["--fixture", FIXTURE, "--projects", "/somewhere"], out.fn), 2);
        assert.equal(run(["--fixture", FIXTURE, "--workspace", REPO], say().fn), 2, "its known threshold is priced at the general multipliers");
        assert.equal(run(["--fixture", path.join(os.tmpdir(), "no-such-fixture-here")], say().fn), 2);
    });

    test("--workspace prices the threshold at the manifest's `spend`, and without the key or the flag nothing moves", () => {
        withTemp((dir) => {
            const host = { cwd: dir, env: { CLAUDE_CONFIG_DIR: dir }, home: dir };
            // A fresh context of 40,001 written for an hour, now at 80,002: exactly its threshold at the general multipliers.
            write(path.join(dir, "projects", projectKey(dir), "s.jsonl"), [...blocks({ cwd: dir, w1h: 40000 }), ...blocks({ cwd: dir, uncached: 2, read: 80000 })]);
            const ws = path.join(dir, "ws");
            fs.mkdirSync(ws);
            const manifest = (m) => fs.writeFileSync(path.join(ws, "workspace.json"), JSON.stringify(m));
            const restart = (argv) => {
                const out = say();
                assert.equal(run(["--branch", "b", ...argv], out.fn, host), 0, out.lines.join("\n"));
                return out.lines.find((l) => l.startsWith("  restart: "));
            };
            const general = restart([]);
            assert.equal(general, "  restart: session s is at 80,002 tokens and has reached its threshold of 80,002 = 40,001 × (1 + 2 / (20 × 0.1)); multipliers undeclared: the general read 0.1× and the 2× of the one-hour writes the host recorded");
            manifest({ portulan: { spec: "2.11" } });
            assert.equal(restart(["--workspace", ws]), general, "a manifest declaring no `spend` prices as no flag does");
            manifest({ portulan: { spec: "2.12" }, spend: { multipliers: { read: 0.05, write: { "5m": 1.25, "1h": 2 } }, horizon: { requests: 30 } } });
            assert.equal(
                restart(["--workspace", ws]),
                "  restart: session s is at 80,002 tokens and is below its threshold of 93,336 = 40,001 × (1 + 2 / (30 × 0.05)); multipliers declared: read 0.05×, write 2× (the one-hour writes the host recorded)",
            );
            manifest({ portulan: { spec: "2.12" }, spend: { horizon: { requests: 10 } } });
            assert.match(restart(["--workspace", ws]), /threshold of 120,003 = 40,001 × \(1 \+ 2 \/ \(10 × 0\.1\)\); multipliers undeclared/, "the horizon stands alone");
        });
    });

    test("a report with no threshold to judge still says the horizon and multipliers one would take, declared or not", () => {
        withTemp((dir) => {
            const host = { cwd: dir, env: { CLAUDE_CONFIG_DIR: dir }, home: dir };
            const ws = path.join(dir, "ws");
            fs.mkdirSync(ws);
            const restart = (argv) => {
                const out = say();
                assert.equal(run(["--branch", "b", ...argv], out.fn, host), 0, out.lines.join("\n"));
                assert.ok(out.lines.includes("  no request on b is recorded here"), out.lines.join("\n"));
                return out.lines.find((l) => l.startsWith("  restart: "));
            };
            const unjudged = "  restart: no session on this branch has a request with a time to judge; a threshold would take a horizon of ";
            assert.equal(restart([]), `${unjudged}20 requests and the general multipliers, undeclared: read 0.1×, writes 1.25× for five minutes and 2× for an hour`);
            fs.writeFileSync(path.join(ws, "workspace.json"), JSON.stringify({ portulan: { spec: "2.12" }, spend: { multipliers: { read: 0.05, write: { "5m": 1.25, "1h": 2 } }, horizon: { requests: 30 } } }));
            assert.equal(restart(["--workspace", ws]), `${unjudged}30 requests and the declared multipliers: read 0.05×, writes 1.25× for five minutes and 2× for an hour`);
            // A request with no time is counted, and still leaves no session to judge.
            write(path.join(dir, "projects", projectKey(dir), "s.jsonl"), blocks({ cwd: dir, at: null }));
            const out = say();
            assert.equal(run(["--branch", "b", "--workspace", ws], out.fn, host), 0, out.lines.join("\n"));
            assert.ok(!out.lines.includes("  no request on b is recorded here"), out.lines.join("\n"));
            assert.equal(out.lines.at(-1), `${unjudged}30 requests and the declared multipliers: read 0.05×, writes 1.25× for five minutes and 2× for an hour`);
        });
    });

    test("figures each in range that give no finite threshold are refused, and a threshold that overflows is none", () => {
        const where = "ws/workspace.json";
        assert.throws(() => readSpend({ multipliers: { read: 0.05, write: { "5m": 1.25, "1h": Number.MAX_VALUE } } }, where), (error) => error instanceof LedgerError && /gives no finite restart threshold, since `write\["1h"\]` divided by `read` overflows/.test(error.message));
        assert.equal(overflowingWrite({ read: 0.05, write: { "5m": 1.25, "1h": 2 } }), null);
        // A quotient in range, which a fresh context of 100 still carries past the largest number.
        assert.throws(() => restartThreshold({ fresh: 100, write: Number.MAX_VALUE, read: 1, horizon: 1 }), (error) => error instanceof LedgerError && /overflows, so these multipliers give none$/.test(error.message));
    });

    test("--workspace naming a manifest that cannot be read, or a `spend` it refuses, is could-not-run, never a report", () => {
        withTemp((dir) => {
            const host = { cwd: dir, env: { CLAUDE_CONFIG_DIR: dir }, home: dir };
            const ws = path.join(dir, "ws");
            fs.mkdirSync(ws);
            for (const [what, text, said] of [
                ["no manifest", null, /--workspace \S*workspace\.json could not be read as a manifest — ENOENT/],
                ["a manifest that does not parse", "{", /--workspace \S*workspace\.json could not be read as a manifest — /],
                ["a manifest that is not an object", "[]", /is not a JSON object, so no `spend` could be read from it/],
                ["a refused `spend`", JSON.stringify({ spend: { multipliers: { read: 2, write: { "5m": 1.25, "1h": 2 } } } }), /`spend` in \S*workspace\.json at `multipliers` sets `read` to 2/],
            ]) {
                if (text === null) fs.rmSync(path.join(ws, "workspace.json"), { force: true });
                else fs.writeFileSync(path.join(ws, "workspace.json"), text);
                const out = say();
                assert.equal(run(["--branch", "b", "--workspace", ws], out.fn, host), 2, what);
                assert.match(out.lines.join("\n"), said, what);
                assert.ok(!out.lines.some((l) => l.startsWith("ledger: branch")), `${what}: nothing is reported`);
            }
            const out = say();
            assert.equal(run(["--branch", "b", "--workspace", path.join(dir, "absent")], out.fn, host), 2);
            assert.match(out.lines.join("\n"), /--workspace \S*absent could not be read — ENOENT/);
        });
    });

    test("an unknown argument, a missing value or one given twice is could-not-run", () => {
        assert.equal(run(["--nope"], say().fn), 2);
        assert.equal(run(["--branch"], say().fn), 2);
        assert.equal(run(["--branch", "a", "--branch", "b"], say().fn), 2);
    });

    test("a named records directory or totals file that is not one is could-not-run, never 0 transcripts", () => {
        withTemp((dir) => {
            const file = path.join(dir, "a-file");
            fs.writeFileSync(file, "");
            const host = { cwd: dir, env: { CLAUDE_CONFIG_DIR: dir }, home: dir };
            for (const [argv, why] of [
                [["--projects", file], /--projects .* is not a directory/],
                [["--projects", path.join(dir, "absent")], /--projects .* could not be read — ENOENT/],
                [["--config", dir], /--config .* is not a file/],
                [["--config", path.join(dir, "absent.json")], /--config .* could not be read — ENOENT/],
            ]) {
                const out = say();
                assert.equal(run(["--branch", "b", ...argv], out.fn, host), 2, argv.join(" "));
                assert.match(out.lines.join("\n"), why);
            }
            // The host's own default may be absent, which is a machine where it never ran: a report of none.
            const out = say();
            assert.equal(run(["--branch", "b"], out.fn, host), 0, out.lines.join("\n"));
            // A file in its place, though, is could-not-run.
            fs.writeFileSync(path.join(dir, "projects"), "");
            assert.equal(run(["--branch", "b"], say().fn, host), 2);
        });
    });

    test("outside a git repository the branch must be named, and with it the run reports", () => {
        withTemp((dir) => {
            assert.equal(run([], say().fn, { cwd: dir, env: { CLAUDE_CONFIG_DIR: dir }, home: dir }), 2);
            const projects = path.join(dir, "projects");
            write(path.join(projects, projectKey(dir), "s.jsonl"), blocks({ cwd: dir, branch: "b", read: 42 }));
            const out = say();
            assert.equal(run(["--branch", "b"], out.fn, { cwd: dir, env: { CLAUDE_CONFIG_DIR: dir }, home: dir }), 0);
            assert.ok(out.lines.some((l) => /^ {2}read +42 +0 +42$/.test(l)), out.lines.join("\n"));
            assert.ok(out.lines.some((l) => /per changed line: not computed — .* is not inside a git repository/.test(l)));
        });
    });

    test("a repository git cannot list the worktrees of is could-not-run, never a report of the one directory", () => {
        withTemp((dir) => {
            assert.equal(worktrees(dir), null, "no .git in it or above it: outside a repository");
            const broken = path.join(dir, "broken");
            fs.mkdirSync(broken);
            fs.writeFileSync(path.join(broken, ".git"), `gitdir: ${path.join(dir, "gone")}\n`);
            assert.throws(() => worktrees(broken), (e) => e instanceof LedgerError && /the worktrees of .*broken could not be listed — \S/.test(e.message));
            const out = say();
            assert.equal(run(["--branch", "b"], out.fn, { cwd: broken, env: { CLAUDE_CONFIG_DIR: dir }, home: dir }), 2);
            assert.match(out.lines.join("\n"), /could not be listed/);
        });
    });

    test("a relative CLAUDE_CONFIG_DIR is could-not-run until both paths are named, never a read of ~/.claude", () => {
        withTemp((dir) => {
            const out = say();
            assert.equal(run(["--branch", "b"], out.fn, { cwd: dir, env: { CLAUDE_CONFIG_DIR: "relative" }, home: dir }), 2);
            assert.match(out.lines.join("\n"), /CLAUDE_CONFIG_DIR is the relative path "relative"/);
            const projects = path.join(dir, "projects");
            write(path.join(projects, projectKey(dir), "s.jsonl"), blocks({ cwd: dir, branch: "b", read: 42 }));
            fs.writeFileSync(path.join(dir, "claude.json"), "{}");
            const named = ["--branch", "b", "--projects", projects, "--config", path.join(dir, "claude.json")];
            assert.equal(run(named, say().fn, { cwd: dir, env: { CLAUDE_CONFIG_DIR: "relative" }, home: dir }), 0);
        });
    });

    test("a branch whose requests recorded no input has no hit rate, and says so rather than 0.0%", () => {
        withTemp((dir) => {
            const projects = path.join(dir, "projects");
            write(path.join(projects, projectKey("/r"), "s.jsonl"), blocks({ uncached: 0, read: 0, output: 3 }));
            const lines = [];
            print(ledger({ projects, config: null, roots: ["/r"], branch: "b" }), (l) => lines.push(l));
            assert.ok(lines.includes("  hit rate: none — no input was recorded, so none could be read from cache"), lines.join("\n"));
        });
    });

    test("a session exactly at its threshold has reached it, the word the advisory uses", () => {
        withTemp((dir) => {
            const projects = path.join(dir, "projects");
            // A fresh context of 40,001 written for an hour: a threshold of 40,001 × (1 + 2 / (20 × 0.1)).
            write(path.join(projects, projectKey("/r"), "s.jsonl"), [...blocks({ w1h: 40000 }), ...blocks({ uncached: 2, read: 80000 })]);
            const lines = [];
            print(ledger({ projects, config: null, roots: ["/r"], branch: "b" }), (l) => lines.push(l));
            assert.ok(lines.some((l) => l.startsWith("  restart: session s is at 80,002 tokens and has reached its threshold of 80,002 = ")), lines.join("\n"));
        });
    });

    test("the entry guard runs the tool, and a crash is exit 2 rather than a figure", () => {
        const result = spawnSync(process.execPath, [TOOL, "--fixture", FIXTURE], { encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /ok fixture/);
    });

    test("the recipe runs the fixture and nothing of the host's", () => {
        const recipe = fs.readFileSync(path.join(REPO, ".portulan", "verify", "ledger.sh"), "utf8");
        const calls = recipe.split("\n").filter((l) => /node cli\/ledger\.mjs/.test(l) && !l.trimStart().startsWith("#"));
        assert.deepEqual(calls.map((l) => l.trim()), ['node cli/ledger.mjs --fixture "$FIXTURE"', 'node cli/ledger.mjs --fixture "$HYBRID" >"$tmp/hybrid"']);
        assert.match(recipe, /export HOME="\$tmp\/home" CLAUDE_CONFIG_DIR="\$tmp\/home\/\.claude" TMPDIR="\$tmp\/state"/);
    });
});
