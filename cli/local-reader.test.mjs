import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
    AB_K,
    AB_RECORD,
    AB_REGISTER,
    AB_TASKS,
    captureReader,
    EARNED_ROUTING,
    foldAb,
    foldReadTurn,
    main,
    READ_QUESTIONS,
    READER_RECORD,
    READER_REGISTER,
    READER_RULED,
    readerHostCalls,
    readFingerprints,
    readHostPrompt,
    readMessages,
    renderReaderRegister,
    turnSeed,
    verifyReader,
    verifyReaderRecord,
    writeReaderRegister,
} from "../packs/tools/local-llm/runner/local-llm.mjs";
import { deriveReading, verifyRoutingRecord } from "./local-routing.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNNER = path.join(REPO, "packs", "tools", "local-llm", "runner", "local-llm.mjs");
const SCRATCH = [];
after(() => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});
const scratch = () => {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "portulan-reader-test-"));
    SCRATCH.push(dir);
    return dir;
};

const answerFor = (q) =>
    q.kind === "absent" ? "The file does not contain it.\nANSWER: ABSENT | LINES: none" : `ANSWER: ${q.kind === "value" ? q.value : "-"} | LINES: ${q.lines.join(", ")}`;
const WRONG = "ANSWER: - | LINES: 1";
const questionOf = (messages) => READ_QUESTIONS.find((q) => JSON.stringify(readMessages(q)) === JSON.stringify(messages));

const stubCapture = async ({ localRead = () => "right", hostRead = () => "right", localCalls = [], hostCalls = [], order = [], journal = null } = {}) => {
    let local = 0;
    let host = 0;
    return captureReader({
        seed: "reading-seed",
        hostCommand: ["stub-host", "--print"],
        hostModel: "stub/host-model",
        model: "stub/local-code",
        baseUrl: "http://127.0.0.1:1234/v1",
        conditions: { captured: "2000-01-01T00:00:00.000Z", commit: "0".repeat(40), clean: true, machine: "none: a stub", hostVersion: "0.0.0 (stub)" },
        journal,
        chatFn: async (options) => {
            localCalls.push(options);
            order.push("l");
            const q = questionOf(options.messages);
            const run = Math.floor(local++ / READ_QUESTIONS.length);
            return { content: localRead(run, q) === "right" ? answerFor(q) : WRONG, totalMs: 3 };
        },
        hostFn: async ({ prompt, timeoutMs }) => {
            hostCalls.push(prompt);
            order.push("h");
            const q = READ_QUESTIONS.find((r) => readHostPrompt(r) === prompt);
            const run = Math.floor(host++ / READ_QUESTIONS.length);
            const how = hostRead(run, q);
            if (how === "exit") return { completed: false, exit: 1, timedOut: false, ms: 5, output: "" };
            if (how === "timeout") return { completed: false, exit: null, timedOut: true, ms: timeoutMs, output: "" };
            return { completed: true, exit: 0, timedOut: false, ms: 5, output: how === "right" ? answerFor(q) : WRONG };
        },
    });
};
const turnOf = (rec, arm, run) => rec.turns.find((t) => t.arm === arm && t.run === run);
const refold = (rec) => {
    rec.cells = foldAb(rec.turns, rec.k, ["read"]);
    return rec;
};
const repoWith = (rec, { register = rec === null ? null : renderReaderRegister(rec) } = {}) => {
    const root = scratch();
    fs.mkdirSync(path.join(root, "evals", "ab"), { recursive: true });
    for (const name of [AB_RECORD, AB_REGISTER]) fs.copyFileSync(path.join(REPO, name), path.join(root, name));
    if (rec !== null) fs.writeFileSync(path.join(root, READER_RECORD), `${JSON.stringify(rec, null, 2)}\n`);
    if (register !== null && rec !== null) fs.writeFileSync(path.join(root, READER_REGISTER), register);
    return root;
};
const readingTable = (root, rec, reading) => ({
    record: AB_RECORD,
    sha256: createHash("sha256").update(fs.readFileSync(path.join(root, AB_RECORD))).digest("hex"),
    roles: structuredClone(EARNED_ROUTING.roles),
    ...(reading ? { reading } : {}),
});

describe("the worker record is untouched, and an absent reader record earns nothing", () => {
    test("the worker matrix stays three tasks and its record verifies as committed", async () => {
        assert.deepEqual([...AB_TASKS], ["code", "codify", "handoff"]);
        assert.equal(fs.existsSync(path.join(REPO, READER_RECORD)), false, "no reader record is captured in this change");
        assert.match(await verifyReaderRecord(REPO), /local-reader\.json is not captured, so reading earns nothing/);
    });

    test("no reading entry ships, none is derived without a record, and a claimed one is red", async () => {
        assert.equal(Object.hasOwn(EARNED_ROUTING, "reading"), false);
        assert.equal(deriveReading(null), null);
        assert.match(await verifyRoutingRecord(REPO), /reading: not captured/);
        await assert.rejects(verifyRoutingRecord(REPO, { ...structuredClone(EARNED_ROUTING), reading: { role: "code", model: "qwen/qwen3.8-27b" } }), /differs from its acquired record/);
    });

    test("a reader register with no reader record is red", async () => {
        const root = repoWith(null);
        fs.writeFileSync(path.join(root, READER_REGISTER), "a register\n");
        await assert.rejects(verifyReaderRecord(root), /exists with no evals\/ab\/local-reader\.json/);
    });

    test("eval --verify through main is green with no reader record, and names it not captured", async () => {
        const root = repoWith(null);
        const out = [];
        const log = console.log;
        console.log = (...p) => out.push(p.join(" "));
        try {
            assert.equal(await main(["eval", "--verify", "--repo-root", root]), 0);
        } finally {
            console.log = log;
        }
        assert.equal(out.length, 2);
        assert.match(out[1], /not captured, so reading earns nothing/);
    });
});

describe("the reading capture", () => {
    test("a full capture is forty host calls, k = 5 turns of eight", () => {
        assert.equal(READ_QUESTIONS.length, 8);
        assert.equal(readerHostCalls(), 40);
        assert.equal(READER_RULED, "2026-11-20");
        assert.equal(READER_RECORD, "evals/ab/local-reader.json");
        assert.equal(READER_REGISTER, "evals/ab/local-reader.md");
    });

    test("a turn sends the eight screen questions, each its own call, arm L with the turn's seed at low effort, arm L first", async () => {
        const localCalls = [];
        const hostCalls = [];
        const order = [];
        const rec = await stubCapture({ localCalls, hostCalls, order });
        assert.equal(rec.portulan.abLocalReader, "1");
        assert.deepEqual(rec.rulings, { k: "2026-08-31", read: READER_RULED });
        assert.deepEqual(rec.screen, readFingerprints());
        assert.deepEqual(rec.arms.l, { endpoint: "http://127.0.0.1:1234/v1", effort: "low", role: "code", model: "stub/local-code" });
        assert.equal(rec.turns.length, 2 * AB_K);
        assert.equal(localCalls.length, 40);
        for (let run = 0; run < AB_K; run += 1) {
            const mine = localCalls.slice(run * 8, run * 8 + 8);
            assert.deepEqual(mine.map((c) => questionOf(c.messages).id), READ_QUESTIONS.map((q) => q.id));
            for (const c of mine) {
                assert.equal(c.seed, turnSeed("reading-seed", "read", run));
                assert.equal(c.effort, "low");
                assert.equal(c.model, "stub/local-code");
            }
        }
        assert.deepEqual(hostCalls, Array.from({ length: AB_K }, () => READ_QUESTIONS.map(readHostPrompt)).flat());
        assert.equal(order.indexOf("h"), 40, "every local call runs before the first host call");
        for (const t of rec.turns) {
            assert.deepEqual(t.questions.map((q) => q.id), READ_QUESTIONS.map((q) => q.id));
            assert.equal(t.ok, true, t.detail);
            assert.equal(Object.hasOwn(t, "output"), false, "a reading turn's outputs are its questions'");
        }
        assert.deepEqual(rec.cells.map((c) => `${c.arm}=${c.passed}/${c.failed}/${c.didNotComplete}`), ["l=5/0/0", "h=5/0/0"]);
        assert.deepEqual(verifyReader(rec), []);
    });

    test("seven of eight right fails a turn; a host question that does not complete makes the turn did-not-complete", async () => {
        const trap = READ_QUESTIONS.find((q) => q.kind === "absent");
        const rec = await stubCapture({
            localRead: (run, q) => (run === 2 && q.id === trap.id ? "wrong" : "right"),
            hostRead: (run, q) => (run === 1 && q.id === READ_QUESTIONS[3].id ? "timeout" : run === 3 && q.id === READ_QUESTIONS[7].id ? "exit" : "right"),
        });
        const seven = turnOf(rec, "l", 2);
        assert.equal(seven.ok, false);
        assert.match(seven.detail, new RegExp(`^right=7/8 traps=2/3 wrong=${trap.id}\\(`));
        const timedOut = turnOf(rec, "h", 1);
        assert.deepEqual([timedOut.completed, timedOut.exit, timedOut.timedOut, timedOut.ok, timedOut.detail], [false, null, true, null, null]);
        assert.equal(timedOut.questions.length, 8, "the turn still asks all eight");
        const exited = turnOf(rec, "h", 3);
        assert.deepEqual([exited.completed, exited.exit, exited.timedOut], [false, 1, false]);
        assert.deepEqual(rec.cells.map((c) => `${c.arm}=${c.passed}/${c.failed}/${c.didNotComplete}`), ["l=4/1/0", "h=3/0/2"]);
        assert.deepEqual(verifyReader(rec), []);
    });

    test("a reading turn's verdict folds from its questions", () => {
        const questions = READ_QUESTIONS.map((r) => ({ id: r.id, completed: true, exit: 0, timedOut: false, ms: 2, ok: true, detail: "d", output: "o" }));
        assert.deepEqual(foldReadTurn("h", questions), { completed: true, exit: 0, timedOut: false, ms: 16, ok: true, detail: "right=8/8 traps=3/3" });
        questions[0] = { ...questions[0], ok: false, detail: "lines=[] want=[26]" };
        assert.equal(foldReadTurn("h", questions).ok, false);
        questions[5] = { ...questions[5], completed: false, exit: 2, ok: null, detail: null };
        assert.deepEqual(foldReadTurn("h", questions), { completed: false, exit: 2, timedOut: false, ms: 16, ok: null, detail: null });
        assert.equal(foldReadTurn("l", questions.map((q) => ({ ...q, exit: null, completed: true }))).exit, null);
    });

    test("a capture resumes from its own journal without re-running a turn, and refuses one of other conditions", async () => {
        const journal = path.join(scratch(), "journal");
        let taken = 0;
        const localCalls = [];
        await assert.rejects(
            captureReader({
                seed: "reading-seed", hostCommand: ["stub-host"], hostModel: "stub/host-model", model: "stub/local-code", baseUrl: "http://127.0.0.1:1234/v1",
                conditions: { captured: "2000-01-01T00:00:00.000Z", commit: "0".repeat(40), clean: true, machine: "m", hostVersion: "v" }, journal,
                chatFn: async (o) => { localCalls.push(o); return { content: answerFor(questionOf(o.messages)), totalMs: 1 }; },
                hostFn: async () => { throw new Error("no host call before arm L ends"); },
                onTurn: () => { if (++taken === 2) throw new Error("synthetic interruption"); },
            }),
            /synthetic interruption/,
        );
        assert.equal(localCalls.length, 16);
        assert.equal(fs.readdirSync(journal).length, 3);
        await assert.rejects(stubCapture({ journal: journal }), /other conditions/);
    });
});

describe("eval --verify over the reader record", () => {
    test("is green on a capture, names it captured, and its register shows every question", async () => {
        const rec = await stubCapture();
        const root = repoWith(rec);
        assert.match(await verifyReaderRecord(root), /local-reader\.json: 10 turn\(s\) of 8 questions at k=5, regraded and folded consistently, and evals\/ab\/local-reader\.md matches byte for byte/);
        assert.equal(await main(["eval", "--verify", "--repo-root", root]), 0);
        const register = renderReaderRegister(rec);
        assert.match(register, /\*\*Arm L 5\/5, arm H 5\/5/);
        assert.match(register, /## Every question/);
        assert.equal((register.match(/^\| [LH] \| \d \| `/gm) ?? []).length, 80);
    });

    test("is red on a missing or drifted register, and refuses a synthetic fixture", async () => {
        const rec = await stubCapture();
        assert.equal(await main(["eval", "--verify", "--repo-root", repoWith(rec, { register: null })]), 1);
        assert.equal(await main(["eval", "--verify", "--repo-root", repoWith(rec, { register: `${renderReaderRegister(rec)} ` })]), 1);
        assert.equal(await main(["eval", "--verify", "--repo-root", repoWith({ ...rec, fixture: "synthetic" })]), 1);
        const root = repoWith(rec, { register: null });
        assert.match(await writeReaderRegister(root), /wrote evals\/ab\/local-reader\.md/);
        assert.equal(fs.readFileSync(path.join(root, READER_REGISTER), "utf8"), renderReaderRegister(rec));
    });

    test("is red on every drift of a reading turn", async () => {
        const base = await stubCapture({ localRead: (run, q) => (run === 0 && q.id === READ_QUESTIONS[1].id ? "wrong" : "right") });
        assert.deepEqual(verifyReader(base), []);
        const red = (edit, why, finding = /./) => {
            const rec = structuredClone(base);
            edit(rec);
            const found = verifyReader(rec);
            assert.ok(found.some((line) => finding.test(line)), `${why}: ${found.join(" / ")}`);
        };
        red((rec) => {
            const t = turnOf(rec, "l", 0);
            t.questions[1].ok = true;
            Object.assign(t, foldReadTurn("l", t.questions));
            refold(rec);
        }, "a forged question verdict, its turn and cells re-folded");
        red((rec) => {
            turnOf(rec, "l", 0).ok = true;
            refold(rec);
        }, "a turn verdict that does not fold from its questions");
        red((rec) => turnOf(rec, "h", 2).questions.pop(), "a turn of seven questions");
        red((rec) => {
            const qs = turnOf(rec, "h", 2).questions;
            [qs[0], qs[1]] = [qs[1], qs[0]];
        }, "questions out of the screen's order", /not the screen's questions in the screen's order/);
        red((rec) => (rec.screen.fixtures = "f".repeat(64)), "fixtures that moved since capture");
        red((rec) => (rec.screen.questions = "f".repeat(64)), "questions that moved since capture");
        red((rec) => (rec.screen.prompts = "f".repeat(64)), "prompts that moved since capture");
        red((rec) => delete rec.rulings.read, "no ruling for reading", /no ruling for its k and for reading/);
        red((rec) => (rec.k = 4), "another k");
        red((rec) => (turnOf(rec, "l", 3).seed += 1), "a seed the record's seed does not derive");
        red((rec) => (turnOf(rec, "h", 3).seed = 7), "a host turn with a seed");
        red((rec) => (turnOf(rec, "l", 3).questions[0].exit = 0), "a local question recorded as a process");
        red((rec) => {
            const t = turnOf(rec, "h", 4);
            Object.assign(t.questions[0], { completed: false, ok: null, detail: null });
            Object.assign(t, foldReadTurn("h", t.questions));
            refold(rec);
        }, "a host question not completed against its exit 0", /records `completed` against its own exit and timeout/);
        red((rec) => (turnOf(rec, "h", 4).questions[2].output = 5), "a question with no output");
        red((rec) => (turnOf(rec, "l", 4).model = "other/model"), "a local turn of another model");
        red((rec) => (rec.arms.l.endpoint = "https://api.example.com/v1"), "arm L off loopback");
        red((rec) => (rec.arms.l.role = "prose"), "arm L not on the code role");
        red((rec) => rec.turns.pop(), "a missing turn");
        red((rec) => (rec.cells[0].passed += 1), "a cell that does not fold from its turns");
        red((rec) => (rec.portulan = { abLocalWorker: "1" }), "a record that is not a reader capture");
        const moved = structuredClone(base);
        moved.screen.grader = "0".repeat(64);
        assert.deepEqual(verifyReader(moved), [], "a grader whose verdicts all regrade the same is no finding");
        moved.turns[0].questions[1].ok = true;
        assert.ok(verifyReader(moved).some((line) => /the grader moved since capture/.test(line)));
    });
});

describe("reading routing is derived from the reader record", () => {
    const earned = { role: "code", model: "stub/local-code" };
    const routed = async (opts) => deriveReading(await stubCapture(opts));

    test("all five local turns pass and all five host turns complete: reading is earned", async () => {
        assert.deepEqual(await routed(), earned);
        assert.deepEqual(await routed({ hostRead: () => "wrong" }), earned, "host answers that complete but fail do not stop local from earning");
    });

    test("one local turn of seven right earns nothing", async () => {
        assert.equal(await routed({ localRead: (run, q) => (run === 4 && q.id === READ_QUESTIONS[0].id ? "wrong" : "right") }), null);
    });

    test("one host turn that does not complete earns nothing", async () => {
        assert.equal(await routed({ hostRead: (run, q) => (run === 0 && q.id === READ_QUESTIONS[0].id ? "exit" : "right") }), null);
    });

    test("a host question that answers nothing earns nothing", async () => {
        const rec = await stubCapture();
        const q = turnOf(rec, "h", 2).questions[4];
        Object.assign(q, { output: "  ", ok: false, detail: "no ANSWER line" });
        Object.assign(turnOf(rec, "h", 2), foldReadTurn("h", turnOf(rec, "h", 2).questions));
        refold(rec);
        assert.deepEqual(verifyReader(rec), []);
        assert.equal(deriveReading(rec), null);
    });

    test("local passes below host passes earn nothing, even where every host turn completes", async () => {
        const one = (run, q) => (run === 0 && q.id === READ_QUESTIONS[0].id ? "wrong" : "right");
        assert.equal(await routed({ localRead: one, hostRead: one }), null, "a positive tie with a local failure earns nothing");
        assert.equal(await routed({ localRead: one, hostRead: (run) => (run < 2 ? "wrong" : "right") }), null, "local above host with a local failure earns nothing");
    });

    test("a tie at zero earns nothing", async () => {
        assert.equal(await routed({ localRead: () => "wrong", hostRead: () => "wrong" }), null);
    });

    test("a record that does not verify earns nothing", async () => {
        const rec = await stubCapture();
        rec.screen.fixtures = "f".repeat(64);
        assert.throws(() => deriveReading(rec), /moved since capture/);
        const fixture = await stubCapture();
        fixture.fixture = "synthetic";
        assert.throws(() => deriveReading(fixture), /a synthetic fixture earns no routing/);
    });

    test("the shipped table carries a reading entry exactly when the reader record earns one", async () => {
        const good = await stubCapture();
        const root = repoWith(good);
        assert.match(await verifyRoutingRecord(root, readingTable(root, good, earned)), /reading: earned/);
        await assert.rejects(verifyRoutingRecord(root, readingTable(root, good, null)), /differs from its acquired record/);
        const bad = await stubCapture({ localRead: (run, q) => (run === 1 && q.id === READ_QUESTIONS[6].id ? "wrong" : "right") });
        const badRoot = repoWith(bad);
        assert.match(await verifyRoutingRecord(badRoot, readingTable(badRoot, bad, null)), /reading: captured and not earned/);
        await assert.rejects(verifyRoutingRecord(badRoot, readingTable(badRoot, bad, earned)), /differs from its acquired record/);
    });
});

describe("eval --ab --task read through main, with a recording server and a fake host", () => {
    const capturable = () => {
        const root = scratch();
        const git = (...argv) => {
            const r = spawnSync("git", ["-c", "user.email=fixture@example.invalid", "-c", "user.name=fixture", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...argv], { cwd: root, encoding: "utf8" });
            assert.equal(r.status, 0, r.stderr);
            return r.stdout.trim();
        };
        git("init", "-q");
        fs.writeFileSync(path.join(root, "README.md"), "fixture\n");
        git("add", "README.md");
        git("commit", "-q", "-m", "fixture");
        const tools = scratch();
        const log = path.join(tools, "host.log");
        const host = path.join(tools, "fake-host.mjs");
        const answers = READ_QUESTIONS.map((q) => [q.question, answerFor(q)]);
        fs.writeFileSync(host, [
            `#!${process.execPath}`,
            'import fs from "node:fs";',
            `const log = ${JSON.stringify(log)};`,
            'if (process.argv.includes("--version")) { console.log("9.9.9 (fake host)"); process.exit(0); }',
            'fs.appendFileSync(log, JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }) + "\\n");',
            `const answers = ${JSON.stringify(answers)};`,
            "const prompt = process.argv.at(-1);",
            'process.stdout.write((answers.find(([q]) => prompt.includes(q)) ?? ["", "no question"])[1]);',
        ].join("\n"));
        fs.chmodSync(host, 0o755);
        const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []);
        return { root, host, calls, head: git("rev-parse", "HEAD"), journal: path.join(root, ".git", "portulan", "local-reader-journal") };
    };
    const server = async () => {
        const bodies = [];
        const s = http.createServer((req, res) => {
            let body = "";
            req.on("data", (c) => (body += c));
            req.on("end", () => {
                const parsed = JSON.parse(body);
                bodies.push(parsed);
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: answerFor(questionOf(parsed.messages)) } }], usage: { prompt_tokens: 40, completion_tokens: 6 } }));
            });
        });
        await new Promise((resolve) => s.listen(0, "127.0.0.1", resolve));
        return { bodies, baseUrl: `http://127.0.0.1:${s.address().port}/v1`, close: () => s.close() };
    };
    const quiet = async (fn) => {
        const [log, error] = [console.log, console.error];
        const err = [];
        console.log = () => {};
        console.error = (...p) => err.push(p.join(" "));
        try {
            return { code: await fn(), err };
        } finally {
            [console.log, console.error] = [log, error];
        }
    };
    const args = ({ root, host }, baseUrl) => ["eval", "--ab", "--task", "read", "--k", "5", "--write", "--seed", "s1", "--host-cmd", `${host} --print`, "--host-model", "fake/host-model", "--base-url", baseUrl, "--repo-root", root];

    test("refuses without --host-cmd, exit 1, naming forty paid off-machine calls, and contacts nothing", () => {
        const root = scratch();
        const r = spawnSync(process.execPath, [RUNNER, "eval", "--ab", "--task", "read", "--k", "5", "--write", "--seed", "s", "--host-model", "m", "--repo-root", root], { encoding: "utf8" });
        assert.equal(r.status, 1, r.stderr);
        assert.match(r.stderr, /PAID run of 40 host calls whose prompts leave this machine/);
        assert.deepEqual(fs.readdirSync(root), []);
    });

    test("refuses another task, a bypassing host, --allow-remote, --model, --role and another k before any call", async () => {
        const fixture = capturable();
        const { bodies, baseUrl, close } = await server();
        try {
            for (const extra of [["--model", "x"], ["--role", "code"], ["--allow-remote"], ["--effort", "high"]]) {
                assert.equal((await quiet(() => main([...args(fixture, baseUrl), ...extra]))).code, 2, extra.join(" "));
            }
            const swap = (from, to) => args(fixture, baseUrl).map((a) => (a === from ? to : a));
            assert.equal((await quiet(() => main(swap("read", "code")))).code, 2);
            assert.equal((await quiet(() => main(swap("5", "3")))).code, 2);
            assert.equal((await quiet(() => main(swap(`${fixture.host} --print`, `${fixture.host} --print --dangerously-skip-permissions`)))).code, 2);
        } finally {
            close();
        }
        assert.deepEqual(bodies, []);
        assert.deepEqual(fixture.calls(), []);
        assert.equal(fs.existsSync(path.join(fixture.root, "evals")), false);
    });

    test("captures both arms, writes the reader record and register beside an untouched worker record, verifies, and refuses a second capture", async () => {
        const fixture = capturable();
        fs.mkdirSync(path.join(fixture.root, "evals", "ab"), { recursive: true });
        for (const name of [AB_RECORD, AB_REGISTER]) fs.copyFileSync(path.join(REPO, name), path.join(fixture.root, name));
        const before = [AB_RECORD, AB_REGISTER].map((name) => fs.readFileSync(path.join(fixture.root, name)));
        const { bodies, baseUrl, close } = await server();
        try {
            assert.equal((await quiet(() => main(args(fixture, baseUrl)))).code, 0);
            assert.equal((await quiet(() => main(args(fixture, baseUrl)))).code, 2, "a record is captured once");
        } finally {
            close();
        }
        assert.equal(bodies.length, 40);
        bodies.forEach((b, i) => {
            assert.equal(b.seed, turnSeed("s1", "read", Math.floor(i / 8)));
            assert.equal(b.reasoning_effort, "low");
            assert.equal(b.model, "qwen/qwen3.8-27b");
        });
        const calls = fixture.calls();
        assert.equal(calls.length, 40);
        assert.deepEqual(calls.map((c) => c.args), Array.from({ length: 5 }, () => READ_QUESTIONS.map((q) => ["--print", readHostPrompt(q)])).flat());
        [AB_RECORD, AB_REGISTER].forEach((name, i) => assert.deepEqual(fs.readFileSync(path.join(fixture.root, name)), before[i], name));
        const rec = JSON.parse(fs.readFileSync(path.join(fixture.root, READER_RECORD), "utf8"));
        assert.equal(rec.source.commit, fixture.head);
        assert.equal(rec.arms.h.version, "9.9.9 (fake host)");
        assert.deepEqual(rec.cells.map((c) => `${c.arm}=${c.passed}`), ["l=5", "h=5"]);
        assert.equal(fs.readFileSync(path.join(fixture.root, READER_REGISTER), "utf8"), renderReaderRegister(rec));
        assert.equal(fs.existsSync(fixture.journal), false);
        assert.equal(await main(["eval", "--verify", "--repo-root", fixture.root]), 0);
    });
});
