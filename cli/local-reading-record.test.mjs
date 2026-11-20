import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
    AB_K,
    AB_READ_RULED,
    AB_RECORD,
    AB_REGISTER,
    AB_TASKS,
    abHostCalls,
    captureAb,
    currentScreen,
    EARNED_ROUTING,
    foldAb,
    foldReadTurn,
    loadPredicates,
    main,
    READ_QUESTIONS,
    readFingerprints,
    readHostPrompt,
    readMessages,
    recordTasks,
    renderAbRegister,
    ROLE_TASKS,
    TASK_ROLES,
    turnSeed,
    verifyAb,
    verifyAbRecord,
} from "../packs/tools/local-llm/runner/local-llm.mjs";
import { deriveRouting, verifyRoutingRecord } from "./local-routing.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH = [];
after(() => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});
const scratch = () => {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "portulan-reading-record-test-"));
    SCRATCH.push(dir);
    return dir;
};

const committed = () => JSON.parse(fs.readFileSync(path.join(REPO, AB_RECORD), "utf8"));
const answerFor = (q) =>
    q.kind === "absent" ? "The file does not contain it.\nANSWER: ABSENT | LINES: none" : `ANSWER: ${q.kind === "value" ? q.value : "-"} | LINES: ${q.lines.join(", ")}`;
const WRONG = "ANSWER: - | LINES: 1";
const PASSING = {
    code: "```js\nexport function summarizeRun(records) {\n    return { requests: records.length, billableTokens: 0, maxContext: 0 };\n}\n```",
    codify: "**Incident.** x\n\n**Proposed rule.** x\n\n**Enforcement.** x\n\n**Provenance.** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/433`.\n\n**Retire when.** x",
    handoff: "## Did\n`claude/spend-ledger` `0038` `cli/ledger.mjs` `cli/advisory.mjs` `ef91a02` `85k` `m13`\n## Open\nx\n## Next\nx",
};
const questionOf = (messages) => READ_QUESTIONS.find((q) => JSON.stringify(readMessages(q)) === JSON.stringify(messages));
const taskOfPrompt = (prompt) => (prompt.includes("summarizeRun") ? "code" : prompt.includes("Provenance") ? "codify" : "handoff");

const stubCapture = async ({ localRead = () => "right", hostRead = () => "right", localCalls = [], hostCalls = [], order = [] } = {}) => {
    const localRuns = new Map();
    const hostRuns = new Map();
    const runOf = (map, key, perTurn) => {
        const n = map.get(key) ?? 0;
        map.set(key, n + 1);
        return Math.floor(n / perTurn);
    };
    return captureAb({
        seed: "reading-seed",
        hostCommand: ["stub-host", "--print"],
        hostModel: "stub/host-model",
        models: { code: "stub/local-code", prose: "stub/local-prose" },
        baseUrl: "http://127.0.0.1:1234/v1",
        conditions: { captured: "2000-01-01T00:00:00.000Z", commit: "0".repeat(40), clean: true, machine: "none: a stub", hostVersion: "0.0.0 (stub)" },
        predicates: await loadPredicates(),
        chatFn: async (options) => {
            localCalls.push(options);
            order.push("l");
            const q = questionOf(options.messages);
            if (q === undefined) {
                const task = ["code", "codify", "handoff"].find((t) => options.messages[1].content.includes(t === "code" ? "summarizeRun" : t === "codify" ? "Provenance" : "Compress"));
                return { content: PASSING[task], totalMs: 7 };
            }
            const run = runOf(localRuns, "read", READ_QUESTIONS.length);
            return { content: localRead(run, q) === "right" ? answerFor(q) : WRONG, totalMs: 3 };
        },
        hostFn: async ({ prompt, timeoutMs }) => {
            hostCalls.push(prompt);
            order.push("h");
            const q = READ_QUESTIONS.find((r) => readHostPrompt(r) === prompt);
            if (q === undefined) return { completed: true, exit: 0, timedOut: false, ms: 11, output: PASSING[taskOfPrompt(prompt)] };
            const run = runOf(hostRuns, "read", READ_QUESTIONS.length);
            const how = hostRead(run, q);
            if (how === "exit") return { completed: false, exit: 1, timedOut: false, ms: 5, output: "" };
            if (how === "timeout") return { completed: false, exit: null, timedOut: true, ms: timeoutMs, output: "" };
            return { completed: true, exit: 0, timedOut: false, ms: 5, output: how === "right" ? answerFor(q) : WRONG };
        },
    });
};
const grading = async () => ({ predicates: await loadPredicates(), screen: currentScreen() });
const refold = (rec) => {
    rec.cells = foldAb(rec.turns, rec.k, recordTasks(rec));
    return rec;
};
const readTurn = (rec, arm, run) => rec.turns.find((t) => t.task === "read" && t.arm === arm && t.run === run);
const repoWith = (rec) => {
    const root = scratch();
    fs.mkdirSync(path.join(root, "evals", "ab"), { recursive: true });
    fs.writeFileSync(path.join(root, AB_RECORD), `${JSON.stringify(rec, null, 2)}\n`);
    fs.writeFileSync(path.join(root, AB_REGISTER), renderAbRegister(rec));
    return root;
};

describe("the committed three-task record", () => {
    test("names three tasks, verifies, renders its register unchanged, and holds no reading", async () => {
        const rec = committed();
        assert.equal(rec.portulan.abLocalWorker, "1");
        assert.deepEqual(recordTasks(rec), ["code", "codify", "handoff"]);
        assert.equal(renderAbRegister(rec), fs.readFileSync(path.join(REPO, AB_REGISTER), "utf8"));
        assert.deepEqual(verifyAb(rec, await grading()), []);
        assert.match(await verifyAbRecord(REPO), /read: not captured in this record/);
    });

    test("earns no reading: no entry is derived, none ships, and a shipped one is red", async () => {
        const derived = await deriveRouting(committed());
        assert.equal(Object.hasOwn(derived, "reading"), false);
        assert.equal(Object.hasOwn(EARNED_ROUTING, "reading"), false);
        assert.match(await verifyRoutingRecord(REPO), /reading: not captured/);
        const claimed = structuredClone(EARNED_ROUTING);
        claimed.reading = { role: "code", model: "qwen/qwen3.8-27b" };
        await assert.rejects(verifyRoutingRecord(REPO, claimed), /differs from its acquired record/);
    });

    test("a three-task record that carries reading turns is not a record of this matrix", async () => {
        const rec = committed();
        const extra = (await stubCapture()).turns.filter((t) => t.task === "read");
        rec.turns.push(...extra.map(({ questions, ...rest }) => rest));
        const red = verifyAb(rec, await grading());
        assert.ok(red.some((line) => /is not a turn of this matrix/.test(line)), red.join("\n"));
    });

    test("a record of no known version is red", async () => {
        const rec = committed();
        rec.portulan.abLocalWorker = "3";
        assert.equal(recordTasks(rec), null);
        assert.ok(verifyAb(rec, await grading()).some((line) => /abLocalWorker/.test(line)));
    });
});

describe("the capture of reading", () => {
    test("the matrix is four tasks, reading on the code role, and a full capture costs fifteen plus forty host calls", () => {
        assert.deepEqual([...AB_TASKS], ["code", "codify", "handoff", "read"]);
        assert.deepEqual([...ROLE_TASKS], ["code", "codify", "handoff"]);
        assert.equal(TASK_ROLES.read, "code");
        assert.equal(READ_QUESTIONS.length, 8);
        assert.equal(abHostCalls(), 15 + 40);
        assert.equal(AB_READ_RULED, "2026-11-20");
    });

    test("a reading turn sends the eight screen questions, each its own call, with the turn's seed, and both arms are graded by the screen's grader", async () => {
        const localCalls = [];
        const hostCalls = [];
        const order = [];
        const rec = await stubCapture({ localCalls, hostCalls, order });
        assert.equal(rec.portulan.abLocalWorker, "2");
        assert.equal(rec.rulings.read, AB_READ_RULED);
        assert.deepEqual(rec.screen.read, readFingerprints());
        assert.deepEqual(rec.arms.l.routing, { ...TASK_ROLES });
        assert.equal(rec.turns.length, 4 * 2 * AB_K);
        const reads = localCalls.filter((c) => questionOf(c.messages) !== undefined);
        assert.equal(reads.length, AB_K * 8);
        for (let run = 0; run < AB_K; run += 1) {
            const mine = reads.slice(run * 8, run * 8 + 8);
            assert.deepEqual(mine.map((c) => questionOf(c.messages).id), READ_QUESTIONS.map((q) => q.id));
            for (const c of mine) {
                assert.equal(c.seed, turnSeed("reading-seed", "read", run));
                assert.equal(c.effort, "low");
                assert.equal(c.model, "stub/local-code");
            }
        }
        assert.equal(hostCalls.length, abHostCalls());
        assert.deepEqual(hostCalls.slice(15), Array.from({ length: AB_K }, () => READ_QUESTIONS.map(readHostPrompt)).flat());
        assert.equal(localCalls.length, abHostCalls());
        assert.equal(order.indexOf("h"), localCalls.length, "arm L's fifty-five calls all run before arm H's first");
        for (const t of rec.turns.filter((turn) => turn.task === "read")) {
            assert.equal(t.output, null);
            assert.deepEqual(t.questions.map((q) => q.id), READ_QUESTIONS.map((q) => q.id));
            assert.equal(t.ok, true, t.detail);
        }
        for (const t of rec.turns.filter((turn) => turn.task !== "read")) assert.equal(t.questions, null);
        assert.deepEqual(rec.cells.map((c) => `${c.task}/${c.arm}=${c.passed}`), ["code/l=5", "code/h=5", "codify/l=5", "codify/h=5", "handoff/l=5", "handoff/h=5", "read/l=5", "read/h=5"]);
        assert.deepEqual(verifyAb(rec, await grading()), []);
    });

    test("seven of eight right fails the turn, and a host question that does not complete makes the turn did-not-complete", async () => {
        const trap = READ_QUESTIONS.find((q) => q.kind === "absent");
        const rec = await stubCapture({
            localRead: (run, q) => (run === 2 && q.id === trap.id ? "wrong" : "right"),
            hostRead: (run, q) => (run === 1 && q.id === READ_QUESTIONS[3].id ? "timeout" : run === 3 && q.id === READ_QUESTIONS[7].id ? "exit" : "right"),
        });
        const seven = readTurn(rec, "l", 2);
        assert.equal(seven.ok, false);
        assert.match(seven.detail, new RegExp(`^right=7/8 traps=2/3 wrong=${trap.id}\\(`));
        assert.equal(seven.questions.filter((q) => q.ok).length, 7);
        const timedOut = readTurn(rec, "h", 1);
        assert.deepEqual([timedOut.completed, timedOut.exit, timedOut.timedOut, timedOut.ok, timedOut.detail], [false, null, true, null, null]);
        assert.equal(timedOut.questions.length, 8, "the turn still asks all eight questions");
        const exited = readTurn(rec, "h", 3);
        assert.deepEqual([exited.completed, exited.exit, exited.timedOut], [false, 1, false]);
        const cell = (arm) => rec.cells.find((c) => c.task === "read" && c.arm === arm);
        assert.deepEqual([cell("l").passed, cell("l").failed, cell("l").didNotComplete], [4, 1, 0]);
        assert.deepEqual([cell("h").passed, cell("h").failed, cell("h").didNotComplete], [3, 0, 2]);
        assert.deepEqual(verifyAb(rec, await grading()), []);
    });

    test("a reading turn's verdict folds from its questions", () => {
        const q = (ok, extra = {}) => ({ id: "x", completed: true, exit: 0, timedOut: false, ms: 2, ok, detail: "d", output: "o", ...extra });
        const questions = READ_QUESTIONS.map((r) => ({ ...q(true), id: r.id }));
        assert.deepEqual(foldReadTurn("h", questions), { completed: true, exit: 0, timedOut: false, ms: 16, ok: true, detail: "right=8/8 traps=3/3" });
        questions[0] = { ...questions[0], ok: false, detail: "lines=[] want=[26]" };
        assert.equal(foldReadTurn("h", questions).ok, false);
        questions[5] = { ...questions[5], completed: false, exit: 2, ok: null, detail: null };
        assert.deepEqual(foldReadTurn("h", questions), { completed: false, exit: 2, timedOut: false, ms: 16, ok: null, detail: null });
        const local = READ_QUESTIONS.map((r) => ({ ...q(true), id: r.id, exit: null }));
        assert.equal(foldReadTurn("l", local).exit, null);
    });
});

describe("eval --verify over the four-task record", () => {
    test("is green on a stub capture, says reading was captured, and its register renders the questions", async () => {
        const rec = await stubCapture();
        const root = repoWith(rec);
        assert.match(await verifyAbRecord(root), /read: captured, 5 turns of 8 questions per arm/);
        assert.equal(await main(["eval", "--verify", "--repo-root", root]), 0);
        const register = renderAbRegister(rec);
        assert.match(register, /\*\*Arm L 20\/20, arm H 20\/20/);
        assert.match(register, /## Every reading question/);
        assert.match(register, new RegExp(`\\*\\*Reading:\\*\\* .*ruled ${AB_READ_RULED}`));
    });

    test("is red on every drift of a reading turn", async () => {
        const now = await grading();
        const base = await stubCapture({ localRead: (run, q) => (run === 0 && q.id === READ_QUESTIONS[1].id ? "wrong" : "right") });
        assert.deepEqual(verifyAb(base, now), []);
        const red = (edit, why) => {
            const rec = structuredClone(base);
            edit(rec);
            const found = verifyAb(rec, now);
            assert.ok(found.length > 0, why);
            return found;
        };
        red((rec) => {
            const t = readTurn(rec, "l", 0);
            Object.assign(t.questions[1], { ok: true });
            Object.assign(t, foldReadTurn("l", t.questions));
            refold(rec);
        }, "a forged question verdict, its turn and cells re-folded");
        red((rec) => {
            readTurn(rec, "l", 0).ok = true;
            refold(rec);
        }, "a turn verdict that does not fold from its questions");
        red((rec) => readTurn(rec, "h", 2).questions.pop(), "a turn of seven questions");
        red((rec) => {
            const qs = readTurn(rec, "h", 2).questions;
            [qs[0], qs[1]] = [qs[1], qs[0]];
        }, "questions out of the screen's order");
        red((rec) => (rec.screen.read.fixtures = "f".repeat(64)), "fixtures that moved since capture");
        red((rec) => (rec.screen.read.questions = "f".repeat(64)), "questions that moved since capture");
        red((rec) => (rec.screen.read.prompts = "f".repeat(64)), "reading prompts that moved since capture");
        red((rec) => delete rec.screen.read, "no reading fingerprints");
        red((rec) => delete rec.rulings.read, "no ruling for reading");
        red((rec) => (readTurn(rec, "l", 3).seed += 1), "a reading seed the record's seed does not derive");
        red((rec) => (readTurn(rec, "l", 3).questions[0].exit = 0), "a local question recorded as a process");
        red((rec) => Object.assign(readTurn(rec, "h", 4).questions[0], { completed: false, ok: null, detail: null }), "a host question not completed against its exit 0");
        red((rec) => (readTurn(rec, "h", 4).questions[2].output = 5), "a question with no output");
        red((rec) => (readTurn(rec, "h", 4).output = "joined"), "a reading turn with a turn-level output");
        red((rec) => (rec.turns.find((t) => t.task === "code").questions = []), "a non-reading turn carrying questions");
        red((rec) => {
            rec.turns = rec.turns.filter((t) => t.task !== "read");
            rec.cells = foldAb(rec.turns, rec.k, ["code", "codify", "handoff"]);
        }, "a four-task record with no reading turns");
        red((rec) => (rec.portulan.abLocalWorker = "1"), "a four-task record declaring the three-task matrix");
        const moved = structuredClone(base);
        moved.screen.read.grader = "0".repeat(64);
        assert.deepEqual(verifyAb(moved, now), [], "a grader whose verdicts all regrade the same is no finding");
    });
});

describe("reading routing is derived from the record", () => {
    const routed = async (opts) => deriveRouting(await stubCapture(opts));

    test("all five local turns pass and all five host turns complete: reading is earned on the code model", async () => {
        const r = await routed();
        assert.deepEqual(r.reading, { role: "code", model: "stub/local-code" });
        assert.equal(r.code.enabled, true);
    });

    test("the shipped table carries a reading entry exactly when its record earns one", async () => {
        const { createHash } = await import("node:crypto");
        const table = async (rec) => {
            const root = repoWith(rec);
            const bytes = fs.readFileSync(path.join(root, AB_RECORD));
            const { reading, ...roles } = await deriveRouting(rec);
            return { root, routing: { record: AB_RECORD, sha256: createHash("sha256").update(bytes).digest("hex"), roles, ...(reading ? { reading } : {}) } };
        };
        const earned = await table(await stubCapture());
        assert.match(await verifyRoutingRecord(earned.root, earned.routing), /reading: earned/);
        const { reading, ...withheld } = earned.routing;
        assert.ok(reading);
        await assert.rejects(verifyRoutingRecord(earned.root, withheld), /differs from its acquired record/);
        const unearned = await table(await stubCapture({ localRead: (run, q) => (run === 1 && q.id === READ_QUESTIONS[6].id ? "wrong" : "right") }));
        assert.match(await verifyRoutingRecord(unearned.root, unearned.routing), /reading: captured and not earned/);
        await assert.rejects(verifyRoutingRecord(unearned.root, { ...unearned.routing, reading }), /differs from its acquired record/);
    });

    test("one local turn of seven right earns nothing", async () => {
        assert.equal(Object.hasOwn(await routed({ localRead: (run, q) => (run === 4 && q.id === READ_QUESTIONS[0].id ? "wrong" : "right") }), "reading"), false);
    });

    test("one host turn that does not complete earns nothing, though every local turn passed", async () => {
        assert.equal(Object.hasOwn(await routed({ hostRead: (run, q) => (run === 0 && q.id === READ_QUESTIONS[0].id ? "exit" : "right") }), "reading"), false);
    });

    test("a tie at zero earns nothing", async () => {
        const r = await routed({ localRead: () => "wrong", hostRead: () => "wrong" });
        assert.equal(Object.hasOwn(r, "reading"), false);
    });

    test("host passes above local passes earn nothing, and a host that answers wrongly does not stop local from earning", async () => {
        assert.equal(Object.hasOwn(await routed({ localRead: (run) => (run === 0 ? "wrong" : "right") }), "reading"), false);
        assert.deepEqual((await routed({ hostRead: () => "wrong" })).reading, { role: "code", model: "stub/local-code" });
    });

    test("reading does not earn or withhold the code role: only the code task does", async () => {
        const failingRead = await routed({ localRead: () => "wrong" });
        assert.equal(failingRead.code.enabled, true);
        const rec = await stubCapture();
        const predicates = await loadPredicates();
        for (const t of rec.turns.filter((turn) => turn.task === "code" && turn.arm === "l")) {
            Object.assign(t, { output: "no code" });
            Object.assign(t, (({ ok, detail }) => ({ ok, detail }))((await import("../packs/tools/local-llm/runner/local-llm.mjs")).gradeRoleOutput("code", "no code", predicates)));
        }
        refold(rec);
        const r = await deriveRouting(rec);
        assert.equal(r.code.enabled, false);
        assert.deepEqual(r.reading, { role: "code", model: "stub/local-code" }, "reading is earned on its own cell, as ruled");
    });
});
