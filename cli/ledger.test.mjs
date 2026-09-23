// Tests for `ledger` — what a change spends, from the host's own usage records.
//
// Zero dependencies, node's own runner, and run by the same recipe as every suite here:
//
//   node --test "cli/**/*.test.mjs"
//
// Every case builds its records in a temporary directory or reads the committed fixture under
// `./fixtures/ledger/`; **none reads this machine's host records**, which is the ledger's own rule for a
// recipe (proposal `0038`, ruling 4) and holds for its suite too. What the suite pins is the reader's
// arithmetic — one request per message id, the classes, the attribution, the rebuilds and their causes,
// the threshold — and the exit code each refusal owes. The fixture's own totals are the recipe's to rail.

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
    figureOf,
    foldFigures,
    hostPaths,
    hostTotals,
    ledger,
    markRebuilds,
    mayHold,
    multipliers,
    print,
    projectKey,
    readLine,
    readTranscript,
    restartThreshold,
    run,
    sessionFigures,
    tally,
    thresholdFor,
    worktrees,
} from "./ledger.mjs";

// A HERMETIC HOST: the ledger's defaults read the host's configuration home, so this suite points it at
// an empty directory that exists, as every suite that can reach the host does.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOL = path.join(REPO, "cli", "ledger.mjs");
const FIXTURE = path.join(REPO, "cli", "fixtures", "ledger");

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
            // Past its threshold of 80,000 before the compaction: the context the figures hold until the
            // next request is the one the compaction replaced, so a figure from it would be wrong.
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
        for (const file of fs.readdirSync(path.join(FIXTURE, "projects"), { recursive: true }).filter((f) => f.endsWith(".jsonl"))) {
            const source = fs.readFileSync(path.join(FIXTURE, "projects", file), "utf8");
            const whole = readTranscript(path.join(FIXTURE, "projects", file)).figures;
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
        // They keep the latest 16 distinct ids, and a repeat is passed over before anything is kept, so a
        // request's own blocks never push its id out, nor do a subagent's requests written between them.
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

    test("the committed fixture reproduces its known totals", () => {
        const out = say();
        assert.equal(run(["--fixture", FIXTURE], out.fn), 0, out.lines.join("\n"));
        assert.match(out.lines.at(-1), /ok fixture/);
    });

    test("the fixture is what its generator writes, byte for byte, known totals included", () => {
        withTemp((dir) => {
            const result = spawnSync(process.execPath, [path.join(REPO, "cli", "fixtures", "generate-ledger.mjs"), dir], { encoding: "utf8" });
            assert.equal(result.status, 0, result.stderr);
            const files = (root) => fs.readdirSync(root, { recursive: true }).filter((f) => fs.statSync(path.join(root, f)).isFile()).sort();
            assert.deepEqual(files(dir), files(FIXTURE));
            for (const f of files(FIXTURE)) assert.ok(fs.readFileSync(path.join(dir, f)).equals(fs.readFileSync(path.join(FIXTURE, f))), `${f} is not what the generator writes`);
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
        assert.equal(run(["--fixture", path.join(os.tmpdir(), "no-such-fixture-here")], say().fn), 2);
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
            // And a file where the host keeps its records is read as nothing at all.
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
            // A worktree whose .git file names a directory that is gone.
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
        assert.deepEqual(calls.map((l) => l.trim()), ['node cli/ledger.mjs --fixture "$FIXTURE"']);
        assert.match(recipe, /export HOME="\$tmp\/home" CLAUDE_CONFIG_DIR="\$tmp\/home\/\.claude" TMPDIR="\$tmp\/state"/);
    });
});
