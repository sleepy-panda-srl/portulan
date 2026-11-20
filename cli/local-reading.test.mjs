// Find-and-quote reading tests.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
    AB_TASKS,
    buildPrompt,
    CouldNotRunError,
    currentScreen,
    EVAL_PROMPTS,
    formatPassReceipt,
    gradeReadAnswer,
    main,
    READ_ANSWER_FORM,
    READ_FIXTURES,
    READ_QUESTIONS,
    readFixtureText,
    readMessages,
    runOfflineVerify,
    runRoleEval,
} from "../packs/tools/local-llm/runner/local-llm.mjs";
import { receiptOf } from "./ledger.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACK = path.join(REPO, "packs", "tools", "local-llm");
const RUNNER = path.join(PACK, "runner", "local-llm.mjs");

const SCRATCH = [];
after(() => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});
const scratch = () => {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "portulan-local-reading-test-"));
    SCRATCH.push(dir);
    return dir;
};
const writeFile = (name, text) => {
    const file = path.join(scratch(), name);
    fs.writeFileSync(file, text);
    return file;
};
const twelve = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n") + "\n";

const captured = async (fn) => {
    const out = [];
    const err = [];
    const [log, error] = [console.log, console.error];
    console.log = (...parts) => out.push(parts.join(" "));
    console.error = (...parts) => err.push(parts.join(" "));
    try {
        return { code: await fn(), out, err };
    } finally {
        [console.log, console.error] = [log, error];
    }
};

const recordingServer = async (reply = "ANSWER: - | LINES: 1") => {
    const bodies = [];
    const server = http.createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            bodies.push(JSON.parse(body));
            res.setHeader("Content-Type", "application/json");
            const content = typeof reply === "function" ? reply(JSON.parse(body)) : reply;
            res.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content } }], usage: { prompt_tokens: 40, completion_tokens: 6 } }));
        });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
    const run = async (expected, ...argv) => {
        const before = bodies.length;
        const res = await captured(() => main(argv, { fetchImpl: (url, init) => fetch(url, init) }));
        assert.equal(res.code, expected, `${argv.join(" ")}\n${res.err.join("\n")}`);
        return { sent: bodies.slice(before), ...res };
    };
    return { baseUrl, run, close: () => server.close() };
};

describe("--number-lines", () => {
    test("numbers every line of --file from 1, padded to the widest number, and says so above the block", () => {
        const file = writeFile("twelve.txt", twelve);
        const prompt = buildPrompt({ _: ["chat"], prompt: "Where?", file, numberLines: true });
        assert.match(prompt, /^Where\?\n\ntwelve\.txt lines 1-12, each line prefixed with its line number and a tab:\n```\n/);
        assert.match(prompt, /\n 1\tline 1\n/);
        assert.match(prompt, /\n 9\tline 9\n10\tline 10\n/);
        assert.match(prompt, /\n12\tline 12\n```$/);
    });

    test("under --lines a-b the numbers are the file's own: line a is numbered a", () => {
        const file = writeFile("twelve.txt", twelve);
        const prompt = buildPrompt({ _: ["chat"], prompt: "q", file, lines: "9-11", numberLines: true });
        assert.match(prompt, /twelve\.txt lines 9-11, each line prefixed/);
        assert.match(prompt, /```\n 9\tline 9\n10\tline 10\n11\tline 11\n```$/);
        assert.doesNotMatch(prompt, /\t line 1\n|^1\t/m);
    });

    test("a numbered prompt keeps every byte of each line after the number", () => {
        const file = writeFile("odd.txt", "\tindented\n\n  two spaces `tick` $HOME\n");
        const prompt = buildPrompt({ _: ["chat"], prompt: "q", file, numberLines: true });
        assert.match(prompt, /```\n1\t\tindented\n2\t\n3\t  two spaces `tick` \$HOME\n```$/);
    });

    test("--context and --context-file blocks carry their own file's numbers too, so no quoted line lacks one", () => {
        const file = writeFile("twelve.txt", twelve);
        const other = writeFile("other.txt", "alpha\nbeta\ngamma\n");
        const prompt = buildPrompt({ _: ["chat"], prompt: "q", file, lines: "11-12", contexts: ["2-3"], contextFiles: [`${other}:2-3`, other], numberLines: true });
        assert.match(prompt, /twelve\.txt lines 2-3\):\n```\n2\tline 2\n3\tline 3\n```/);
        assert.match(prompt, /other\.txt lines 2-3\):\n```\n2\tbeta\n3\tgamma\n```/);
        assert.match(prompt, /other\.txt\):\n```\n1\talpha\n2\tbeta\n3\tgamma\n```/);
        const plain = buildPrompt({ _: ["chat"], prompt: "q", file, lines: "11-12", contexts: ["2-3"] });
        assert.match(plain, /```\nline 2\nline 3\n```/);
        assert.doesNotMatch(plain, /prefixed with its line number/);
    });

    test("without --file it is refused: there is nothing whose lines it could number", () => {
        assert.throws(() => buildPrompt({ _: ["chat"], prompt: "q", numberLines: true }), CouldNotRunError);
    });

    test("through main, chat sends the numbered file and its receipt records line-numbers=on, which the ledger reads", async () => {
        const file = writeFile("twelve.txt", twelve);
        const { baseUrl, run, close } = await recordingServer();
        try {
            const numbered = await run(0, "chat", "--base-url", baseUrl, "--file", file, "--lines", "10-12", "--number-lines", "--prompt", "Where?");
            assert.equal(numbered.sent.length, 1);
            assert.match(numbered.sent[0].messages[0].content, /```\n10\tline 10\n11\tline 11\n12\tline 12\n```$/);
            const receipt = numbered.err.at(-1);
            assert.match(receipt, / max-tokens=4096 line-numbers=on spend=\$0\.00$/);
            assert.deepEqual(receiptOf(receipt), { mode: "chat", model: "qwen/qwen3.8-27b", attempts: 1, in: 40, out: 6, time: receiptOf(receipt).time });

            const plain = await run(0, "chat", "--base-url", baseUrl, "--file", file, "--prompt", "Where?");
            assert.doesNotMatch(plain.err.at(-1), /line-numbers/);
            assert.doesNotMatch(plain.sent[0].messages[0].content, /\tline/);

            const candidate = await run(0, "summarize", "--base-url", baseUrl, "--model", "a-candidate", "--file", file, "--lines", "1-2", "--number-lines", "--prompt", "Digest");
            assert.match(candidate.sent[0].messages[0].content, /```\n1\tline 1\n2\tline 2\n```$/);
            assert.match(candidate.err.at(-1), /^OK mode=summarize model=a-candidate .* line-numbers=on spend=\$0\.00$/);
        } finally {
            close();
        }
    });

    test("it does not open summarize's guard, the transform path, or the input ceiling", async () => {
        const file = writeFile("twelve.txt", twelve);
        const { baseUrl, run, close } = await recordingServer();
        try {
            const guarded = await run(1, "summarize", "--base-url", baseUrl, "--file", file, "--number-lines", "--prompt", "Digest");
            assert.equal(guarded.sent.length, 0);
            const transform = await run(2, "transform", "--base-url", baseUrl, "--file", file, "--verify", "true", "--number-lines", "--prompt", "edit");
            assert.equal(transform.sent.length, 0);
            assert.match(transform.err.join("\n"), /--number-lines belongs to chat or summarize, not transform/);
            for (const argv of [["eval", "--number-lines"], ["status", "--number-lines"], ["dedup", "--dir", ".", "--number-lines"]]) {
                assert.equal((await run(2, ...argv, "--base-url", baseUrl)).sent.length, 0, argv.join(" "));
            }
            assert.equal((await run(2, "chat", "--base-url", baseUrl, "--number-lines", "--prompt", "q")).sent.length, 0);

            const plainBytes = Buffer.byteLength(buildPrompt({ _: ["chat"], prompt: "q", file }), "utf8");
            const refused = await run(1, "chat", "--base-url", baseUrl, "--file", file, "--number-lines", "--max-input-bytes", String(plainBytes), "--prompt", "q");
            assert.equal(refused.sent.length, 0, "the numbers count against the ceiling");
            assert.equal((await run(0, "chat", "--base-url", baseUrl, "--file", file, "--max-input-bytes", String(plainBytes), "--prompt", "q")).sent.length, 1);
        } finally {
            close();
        }
    });

    test("--help lists it on the chat line and nowhere else, and the offline rails check it", async () => {
        const help = (await captured(() => main(["--help"]))).out.join("\n");
        const chatLine = help.split("\n").find((l) => l.trim().startsWith("local-llm.mjs chat|summarize "));
        assert.match(chatLine, /\[--file <path> \[--lines <a>-<b>\] \[--number-lines\]\]/);
        assert.equal(help.split("\n").filter((l) => l.includes("--number-lines")).length, 2, "the chat line and the one sentence that explains it");
        const transformLine = help.split("\n").find((l) => l.trim().startsWith("local-llm.mjs transform "));
        assert.doesNotMatch(transformLine, /--number-lines/);
        const offline = await runOfflineVerify();
        assert.equal(offline.status, 0, offline.message);
        assert.match(offline.message, /7\/7 offline rails held/);
    });

    test("formatPassReceipt adds the field only when numbering was on", () => {
        const base = { mode: "chat", model: "m", promptTokens: 1, completionTokens: 1, totalMs: 1, tokPerSec: 1, maxTokens: 700 };
        assert.match(formatPassReceipt({ ...base, lineNumbers: true }), / max-tokens=700 line-numbers=on spend=/);
        assert.doesNotMatch(formatPassReceipt(base), /line-numbers/);
        assert.notEqual(receiptOf(formatPassReceipt({ ...base, lineNumbers: true })), null);
    });
});

describe("the read task of the eval screen", () => {
    const answerFor = (q) => {
        if (q.kind === "absent") return "The file does not contain it.\nANSWER: ABSENT | LINES: none";
        return `It is on the cited lines.\nANSWER: ${q.kind === "value" ? q.value : "-"} | LINES: ${q.lines.join(", ")}`;
    };

    test("the questions' answers hold against the fixtures that ship with the pack", () => {
        assert.ok(READ_QUESTIONS.length >= 6);
        assert.ok(READ_QUESTIONS.filter((q) => q.kind === "absent").length >= 2, "at least two absent-item traps");
        for (const name of Object.values(READ_FIXTURES)) assert.ok(fs.existsSync(path.join(PACK, "screen", "read", name)), name);
        const ids = new Set();
        for (const q of READ_QUESTIONS) {
            assert.ok(!ids.has(q.id), `duplicate id ${q.id}`);
            ids.add(q.id);
            assert.ok(q.question.trim().endsWith("?"), q.id);
            const lines = readFixtureText(q.fixture).replace(/\n$/, "").split("\n");
            if (q.kind === "absent") {
                assert.equal(lines.some((l) => l.includes(q.needle)), false, `${q.id}: ${q.needle} must be absent`);
                continue;
            }
            assert.ok(q.lines.length > 0, q.id);
            for (const n of q.lines) assert.ok(lines[n - 1]?.includes(q.anchor), `${q.id}: line ${n} must hold ${q.anchor}`);
            const elsewhere = lines.map((l, i) => (l.includes(q.anchor) ? i + 1 : null)).filter((n) => n !== null && !q.lines.includes(n));
            assert.deepEqual(elsewhere, q.except ?? [], `${q.id}: ${q.anchor} appears on lines the answer leaves out`);
            if (q.kind === "value") assert.ok(lines[q.lines[0] - 1].includes(q.value), q.id);
        }
    });

    test("each question goes as one pointed question about one numbered file, ending as the use asks", () => {
        for (const q of READ_QUESTIONS) {
            const messages = readMessages(q);
            assert.equal(messages.length, 2);
            const user = messages[1].content;
            assert.ok(user.startsWith(`${q.question} Give line numbers. If the file does not contain it, say so.\n${READ_ANSWER_FORM}\n\n`), q.id);
            assert.match(user, new RegExp(`${READ_FIXTURES[q.fixture].replace(/\./g, "\\.")} lines 1-\\d+, each line prefixed with its line number and a tab:`));
            assert.match(user, /\n *1\t/);
        }
    });

    test("gradeReadAnswer passes a right answer and fails every kind of wrong one", () => {
        const [where] = READ_QUESTIONS.filter((q) => q.kind === "lines" && q.lines.length === 1);
        const many = READ_QUESTIONS.find((q) => q.kind === "lines" && q.lines.length > 1);
        const value = READ_QUESTIONS.find((q) => q.kind === "value");
        const absent = READ_QUESTIONS.find((q) => q.kind === "absent");
        for (const q of READ_QUESTIONS) assert.equal(gradeReadAnswer(q, answerFor(q)).ok, true, q.id);

        assert.equal(gradeReadAnswer(where, `ANSWER: - | LINES: ${where.lines[0] + 1}`).ok, false, "a wrong line");
        assert.equal(gradeReadAnswer(where, `ANSWER: - | LINES: ${where.lines[0]}, ${where.lines[0] + 1}`).ok, false, "a right line among wrong ones");
        assert.equal(gradeReadAnswer(many, `ANSWER: - | LINES: ${many.lines[0]}`).ok, false, "half of the lines");
        assert.equal(gradeReadAnswer(where, "ANSWER: ABSENT | LINES: none").ok, false, "absent where present");
        assert.equal(gradeReadAnswer(value, `ANSWER: ${value.value}0 | LINES: ${value.lines[0]}`).ok, false, "a wrong value");
        assert.equal(gradeReadAnswer(value, `ANSWER: ${value.value} | LINES: ${value.lines[0] + 2}`).ok, false, "the value on a wrong line");
        assert.equal(gradeReadAnswer(absent, "ANSWER: - | LINES: 3").ok, false, "a trap answered with a line");
        assert.equal(gradeReadAnswer(absent, "ANSWER: ABSENT | LINES: 3").ok, false, "absent, yet citing a line");
        assert.equal(gradeReadAnswer(absent, "The file does not contain it.").ok, false, "no ANSWER line is no verdict to grade");

        assert.equal(gradeReadAnswer(value, `<think>maybe 7</think>\n**ANSWER:** \`${value.value}\` | LINES: ${value.lines[0]}.`).ok, true, "thinking, bold and backticks are not the answer");
        assert.equal(gradeReadAnswer(many, `ANSWER: - | LINES: ${[...many.lines].reverse().join(",")}`).ok, true, "order is not judged");
        assert.equal(gradeReadAnswer(where, `ANSWER: - | LINES: 99\nOn reflection:\nANSWER: - | LINES: ${where.lines[0]}`).ok, true, "the last ANSWER line counts");
        assert.match(gradeReadAnswer(where, "ANSWER: - | LINES: 99").detail, /^lines=\[99\] want=\[\d+\]$/);
    });

    test("runRoleEval runs every read question as its own call and passes only when all are right", async () => {
        const byQuestion = (wrongId = null) => async ({ messages }) => {
            const q = READ_QUESTIONS.find((r) => messages[1].content.startsWith(r.question));
            return { content: q.id === wrongId ? "ANSWER: - | LINES: 1" : answerFor(q), totalMs: 10, tokPerSec: 5 };
        };
        let calls = 0;
        const counting = async (options) => {
            calls += 1;
            return byQuestion()(options);
        };
        const [right] = await runRoleEval({ model: "m", tasks: ["read"], chatFn: counting, predicates: null });
        assert.equal(calls, READ_QUESTIONS.length);
        assert.equal(right.ok, true, right.detail);
        assert.equal(right.task, "read");
        assert.equal(right.totalMs, 10 * READ_QUESTIONS.length);
        assert.match(right.detail, new RegExp(`^right=${READ_QUESTIONS.length}/${READ_QUESTIONS.length} traps=\\d+/\\d+$`));

        const trap = READ_QUESTIONS.find((q) => q.kind === "absent");
        const [wrong] = await runRoleEval({ model: "m", tasks: ["read"], chatFn: byQuestion(trap.id), predicates: null });
        assert.equal(wrong.ok, false);
        assert.match(wrong.detail, new RegExp(`right=${READ_QUESTIONS.length - 1}/${READ_QUESTIONS.length} .* wrong=${trap.id}`));
    });

    test("the read task is outside the A/B record: its tasks, prompts and fingerprints are as captured", () => {
        assert.deepEqual([...AB_TASKS], ["code", "codify", "handoff"]);
        assert.deepEqual(Object.keys(EVAL_PROMPTS), ["code", "codify", "handoff"]);
        const record = JSON.parse(fs.readFileSync(path.join(REPO, "evals", "ab", "local-worker.json"), "utf8"));
        assert.equal(currentScreen().prompts, record.screen.prompts);
    });

    test("eval --task read screens from a payload with packs/ and no cli/, since reading needs no cli/ predicate", async () => {
        const root = scratch();
        const packCopy = path.join(root, "packs", "tools", "local-llm");
        fs.mkdirSync(path.join(packCopy, "runner"), { recursive: true });
        fs.copyFileSync(RUNNER, path.join(packCopy, "runner", "local-llm.mjs"));
        fs.cpSync(path.join(PACK, "screen"), path.join(packCopy, "screen"), { recursive: true });
        const { baseUrl, close } = await recordingServer((body) => {
            const q = READ_QUESTIONS.find((r) => body.messages[1].content.startsWith(r.question));
            return answerFor(q);
        });
        const runCopy = (...argv) =>
            new Promise((resolve) => {
                const child = spawn(process.execPath, [path.join(packCopy, "runner", "local-llm.mjs"), ...argv], { stdio: ["ignore", "pipe", "pipe"] });
                let out = "";
                let err = "";
                child.stdout.on("data", (c) => (out += c));
                child.stderr.on("data", (c) => (err += c));
                child.on("close", (code) => resolve({ code, out, err }));
            });
        try {
            const read = await runCopy("eval", "--task", "read", "--base-url", baseUrl, "--no-lock");
            assert.equal(read.code, 0, read.err);
            assert.match(read.out, /^PASS task=read model=qwen\/qwen3\.8-27b /);
            const all = await runCopy("eval", "--base-url", baseUrl, "--no-lock");
            assert.equal(all.code, 2, "the other tasks still need cli/");
            assert.match(all.err, /cli\/ predicates/);
        } finally {
            close();
        }
    });
});
