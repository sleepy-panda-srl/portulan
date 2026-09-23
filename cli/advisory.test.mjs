// Tests for `advisory` — the restart advisory's one line at the prompt, and its figure in the status line.
//
// Zero dependencies, node's own runner, and run by the same recipe as every suite here:
//
//   node --test "cli/**/*.test.mjs"
//
// Every case writes its transcript and its told-once directory under a temporary directory, so no case
// reads a real session or leaves a record beside one. What the suite pins is proposal `0038`'s promise
// for the line — at the first prompt whose recorded usage has reached the threshold, once, and at no
// earlier one — and the runner's own: it exits 0 on every path, because a `UserPromptSubmit` hook that
// exits 2 erases the person's prompt.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { adviceLine, compact, main, onPrompt, onStatus, stateFile, statusLine, toldFile } from "./advisory.mjs";
import { readTranscript } from "./ledger.mjs";

// A HERMETIC HOST: nothing here reads the host's configuration, and the suite says so the way every
// suite that imports a reader of it does.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOL = path.join(REPO, "cli", "advisory.mjs");

function withTemp(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-advisory-test-"));
    try {
        return fn(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

let serial = 0;
function record({ w1h = 0, w5m = 0, read = 0, uncached = 1, n = 2 } = {}) {
    const id = `msg_${(serial += 1)}`;
    const usage = { input_tokens: uncached, cache_creation_input_tokens: w1h + w5m, cache_read_input_tokens: read, output_tokens: 10, cache_creation: { ephemeral_1h_input_tokens: w1h, ephemeral_5m_input_tokens: w5m } };
    return Array.from({ length: n }, () => JSON.stringify({ type: "assistant", cwd: "/r", gitBranch: "b", timestamp: "2026-09-23T10:00:00.000Z", message: { id, model: "m", usage } }));
}

const boundary = JSON.stringify({ type: "system", subtype: "compact_boundary" });

/** What the host does to a transcript between two calls: append to it, and nothing else. */
const grow = (file, lines) => fs.appendFileSync(file, `${lines.join("\n")}\n`);

/** A transcript whose fresh context is 40,000 tokens written for an hour: its threshold is 80,000. */
function session(dir, contexts, { tail = [] } = {}) {
    const file = path.join(dir, "s.jsonl");
    const lines = [...record({ w1h: 39999 })];
    let previous = 40000;
    for (const c of contexts) {
        lines.push(...record({ read: previous, w1h: c - previous - 1 }));
        previous = c;
    }
    fs.writeFileSync(file, `${[...lines, ...tail].join("\n")}\n`);
    return file;
}

describe("the line at the prompt", () => {
    test("silent below the threshold, said at the first prompt that reaches it, and never again", () => {
        withTemp((dir) => {
            const state = path.join(dir, "state");
            fs.mkdirSync(state);
            const file = session(dir, [60000, 79999]);
            assert.equal(onPrompt({ session_id: "s", transcript_path: file }, { dir: state }), null);
            grow(file, record({ read: 79999 }));
            const out = onPrompt({ session_id: "s", transcript_path: file }, { dir: state });
            const parsed = JSON.parse(out);
            assert.equal(parsed.hookSpecificOutput.hookEventName, "UserPromptSubmit");
            assert.match(parsed.hookSpecificOutput.additionalContext, /context, 80,000 tokens, has reached its restart threshold of 80,000 = fresh context 40,000 × \(1 \+ write 2× \/ \(20 more requests × read 0\.1×\)\)/);
            assert.match(parsed.hookSpecificOutput.additionalContext, /multipliers undeclared, so the general read multiplier and the one-hour writes the host recorded/);
            grow(file, record({ read: 80000, w1h: 39999 }));
            assert.equal(onPrompt({ session_id: "s", transcript_path: file }, { dir: state }), null, "said once");
        });
    });

    test("a compaction starts the context again, so the line may be owed again", () => {
        withTemp((dir) => {
            const state = path.join(dir, "state");
            fs.mkdirSync(state);
            const file = session(dir, [90000]);
            assert.notEqual(onPrompt({ session_id: "s", transcript_path: file }, { dir: state }), null);
            // After the compaction the fresh context is 20,000 written for an hour: its threshold 40,000.
            grow(file, [boundary, ...record({ w1h: 19999 }), ...record({ read: 20000, w1h: 20000 })]);
            const out = onPrompt({ session_id: "s", transcript_path: file }, { dir: state });
            assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /40,001 tokens, has reached its restart threshold of 40,000/);
            assert.equal(onPrompt({ session_id: "s", transcript_path: file }, { dir: state }), null);
        });
    });

    test("the record of having said it is per session: another session is told for itself", () => {
        withTemp((dir) => {
            const state = path.join(dir, "state");
            fs.mkdirSync(state);
            const file = session(dir, [90000]);
            assert.notEqual(onPrompt({ session_id: "one", transcript_path: file }, { dir: state }), null);
            assert.notEqual(onPrompt({ session_id: "two", transcript_path: file }, { dir: state }), null);
            // Two ids that sanitise to one string stay apart: the defect ./stop-gate.mjs found in its counters.
            assert.notEqual(toldFile("a/b", 0, state), toldFile("ab", 0, state));
        });
    });

    test("where saying it once cannot be remembered, it is not said at all", () => {
        withTemp((dir) => {
            const file = session(dir, [90000]);
            const warnings = [];
            const missing = path.join(dir, "no-such-directory");
            assert.equal(onPrompt({ session_id: "s", transcript_path: file }, { dir: missing, warn: (w) => warnings.push(w) }), null);
            assert.match(warnings.join("\n"), /staying silent rather than saying the line at every prompt/);
            assert.equal(onPrompt({ transcript_path: file }, { dir, warn: (w) => warnings.push(w) }), null, "no session id, nothing to key it by");
        });
    });

    test("no transcript, an unreadable one or one with no request yet is silence, with the reason on stderr", () => {
        withTemp((dir) => {
            const reasons = [];
            const warn = (w) => reasons.push(w);
            assert.equal(onPrompt({ session_id: "s" }, { dir, warn }), null);
            assert.equal(onPrompt({ session_id: "s", transcript_path: path.join(dir, "absent.jsonl") }, { dir, warn }), null);
            fs.writeFileSync(path.join(dir, "empty.jsonl"), `${JSON.stringify({ type: "user", message: { content: "hi" } })}\n`);
            assert.equal(onPrompt({ session_id: "s", transcript_path: path.join(dir, "empty.jsonl") }, { dir, warn }), null);
            assert.deepEqual(reasons.map((r) => r.split(" — ")[0]), ["the host sent no transcript_path", "the transcript could not be read", "no request is recorded yet"]);
        });
    });
});

describe("what a call reads", () => {
    test("a second call folds in only what the transcript gained since the first", () => {
        withTemp((dir) => {
            const state = path.join(dir, "state");
            fs.mkdirSync(state);
            const file = session(dir, [60000]);
            assert.equal(onPrompt({ session_id: "s", transcript_path: file }, { dir: state }), null);
            // Rewrite the fresh context's records in place, at their own length and far from where the
            // first read ended: a call that read the transcript again from its start would take a fresh
            // context of 100,000 and a threshold of 200,000, and stay silent.
            const source = fs.readFileSync(file, "utf8");
            const edited = source.replace(/"cache_creation_input_tokens":39999/g, '"cache_creation_input_tokens":99999').replace(/"ephemeral_1h_input_tokens":39999/g, '"ephemeral_1h_input_tokens":99999');
            assert.notEqual(edited, source);
            assert.equal(edited.length, source.length);
            fs.writeFileSync(file, `${edited}${record({ read: 60000, w1h: 19999 }).join("\n")}\n`);
            const out = onPrompt({ session_id: "s", transcript_path: file }, { dir: state });
            assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /80,000 tokens, has reached its restart threshold of 80,000 = fresh context 40,000/);
        });
    });

    test("cut anywhere, across reads and inside a character, what is kept is what one whole read gives", () => {
        withTemp((dir) => {
            // Lines longer than the 64 KB a read takes, with characters of two and four bytes, so the cuts
            // below fall inside lines, inside characters and across reads.
            const wide = "é🙂".repeat(25000);
            const lines = [];
            let n = 0;
            const say = (usage, extra = {}) => {
                const id = `msg_wide_${(n += 1)}`;
                for (let b = 0; b < 2; b += 1) lines.push(JSON.stringify({ type: "assistant", cwd: "/r", ...extra, message: { id, model: "m", usage, content: [{ type: "text", text: b === 0 ? wide : "short" }] } }));
            };
            const usage = (w1h, read) => ({ input_tokens: 1, cache_creation_input_tokens: w1h, cache_read_input_tokens: read, output_tokens: 5, cache_creation: { ephemeral_1h_input_tokens: w1h, ephemeral_5m_input_tokens: 0 } });
            say(usage(39999, 0));
            say(usage(20000, 40000));
            say(usage(9, 1), { isSidechain: true });
            lines.push(boundary);
            say(usage(29999, 0));
            say(usage(30000, 30000));
            const whole = Buffer.from(`${lines.join("\n")}\n`);
            const file = path.join(dir, "wide.jsonl");
            fs.writeFileSync(file, "");
            const state = path.join(dir, "state");
            fs.mkdirSync(state);
            for (let at = 0; at < whole.length; at += 50001) {
                fs.appendFileSync(file, whole.subarray(at, Math.min(at + 50001, whole.length)));
                onStatus({ session_id: "wide", transcript_path: file }, { dir: state });
            }
            const kept = JSON.parse(fs.readFileSync(stateFile("wide", state), "utf8"));
            assert.equal(kept.offset, whole.length);
            assert.deepEqual(kept.figures, readTranscript(file).figures);
            assert.deepEqual([kept.figures.fresh, kept.figures.last, kept.figures.compactions], [30000, 60001, 1]);
        });
    });

    test("a torn last line is read once its newline lands, never counted before", () => {
        withTemp((dir) => {
            const state = path.join(dir, "state");
            fs.mkdirSync(state);
            const file = session(dir, [60000]);
            const [crossing] = record({ read: 60000, w1h: 29999, n: 1 });
            const cut = Math.floor(crossing.length / 2);
            fs.appendFileSync(file, crossing.slice(0, cut));
            assert.equal(onPrompt({ session_id: "s", transcript_path: file }, { dir: state }), null);
            fs.appendFileSync(file, `${crossing.slice(cut)}\n`);
            assert.match(JSON.parse(onPrompt({ session_id: "s", transcript_path: file }, { dir: state })).hookSpecificOutput.additionalContext, /90,000 tokens/);
        });
    });

    test("what was kept is read as none where it no longer describes the transcript, or is not what was kept", () => {
        withTemp((dir) => {
            const file = session(dir, [90000]);
            const size = fs.statSync(file).size;
            const good = { v: 1, transcript: file, ino: fs.statSync(file).ino, offset: size, tail: "", figures: { compactions: 0, pending: false, fresh: 1, freshLifetime: "1h", lifetime: "1h", last: 1, recent: [] } };
            for (const [what, kept] of [
                ["not JSON", "{"],
                ["another version", { ...good, v: 2 }],
                ["another transcript", { ...good, transcript: `${file}.other` }],
                ["another file", { ...good, ino: good.ino + 1 }],
                ["an offset past the end", { ...good, offset: size + 1 }],
                ["other bytes where the read ended", { ...good, offset: size - 1, tail: "AAAA" }],
                ["a figure out of shape", { ...good, offset: 0, figures: { ...good.figures, fresh: -1 } }],
                ["a figure with a field too many", { ...good, offset: 0, figures: { ...good.figures, extra: 1 } }],
            ]) {
                const state = fs.mkdtempSync(path.join(dir, "state-"));
                fs.writeFileSync(stateFile("s", state), typeof kept === "string" ? kept : JSON.stringify(kept));
                const out = onPrompt({ session_id: "s", transcript_path: file }, { dir: state });
                assert.match(JSON.parse(out ?? "null")?.hookSpecificOutput.additionalContext ?? "", /90,000 tokens, has reached its restart threshold of 80,000/, what);
            }
        });
    });

    test("what is kept is counts, ids and a digest, never what the session said, and only its owner can read it", () => {
        withTemp((dir) => {
            const state = path.join(dir, "state");
            fs.mkdirSync(state);
            const file = session(dir, [90000]);
            // The read ends just after the person's words, so the bytes before the kept offset are theirs.
            grow(file, [JSON.stringify({ type: "user", message: { role: "user", content: "words the person typed, which no file of the advisory may hold" } })]);
            assert.notEqual(onPrompt({ session_id: "s", transcript_path: file }, { dir: state }), null);
            const text = fs.readFileSync(stateFile("s", state), "utf8");
            const bytes = fs.readFileSync(file);
            assert.ok(!text.includes("advisory may hold"));
            assert.ok(!text.includes(bytes.subarray(bytes.length - 64).toString("base64")), "the bytes before the offset, encoded");
            const kept = JSON.parse(text);
            assert.deepEqual(Object.keys(kept).sort(), ["figures", "ino", "offset", "tail", "transcript", "v"]);
            assert.match(kept.tail, /^[0-9a-z]{1,7}$/);
            if (process.platform !== "win32") {
                for (const f of [stateFile("s", state), toldFile("s", 0, state)]) assert.equal(fs.statSync(f).mode & 0o777, 0o600, f);
            }
        });
    });

    test("between a compaction and the first request after it there is no figure, only the reason", () => {
        withTemp((dir) => {
            const file = session(dir, [90000], { tail: [boundary] });
            const reasons = [];
            assert.equal(onPrompt({ session_id: "s", transcript_path: file }, { dir, warn: (w) => reasons.push(w) }), null);
            assert.deepEqual(reasons, ["no request is recorded since the compaction"]);
            assert.equal(onStatus({ session_id: "s", transcript_path: file }, { dir }), "restart threshold: after the first request since the compaction");
        });
    });

    test("the status line keeps the figures it read, so the next call has nothing to read again", () => {
        withTemp((dir) => {
            const file = session(dir, [50000]);
            assert.equal(onStatus({ session_id: "s", transcript_path: file }, { dir }), "context 50k of a 80k restart threshold · multipliers undeclared: read 0.1×, write 2×");
            const kept = JSON.parse(fs.readFileSync(stateFile("s", dir), "utf8"));
            assert.equal(kept.offset, fs.statSync(file).size);
            assert.deepEqual([kept.figures.fresh, kept.figures.last], [40000, 50000]);
        });
    });
});

describe("the status line", () => {
    test("the host's own last-call counts are the context, where it sends them; the threshold is the records'", () => {
        withTemp((dir) => {
            const file = session(dir, [50000]);
            const current_usage = { input_tokens: 3, cache_creation_input_tokens: 997, cache_read_input_tokens: 90000 };
            assert.equal(onStatus({ transcript_path: file, context_window: { current_usage } }), "context 91k is past its 80k restart threshold: write the handoff and restart · multipliers undeclared: read 0.1×, write 2×");
            assert.equal(onStatus({ transcript_path: file, context_window: { current_usage: null } }), "context 50k of a 80k restart threshold · multipliers undeclared: read 0.1×, write 2×");
        });
    });

    test("before the first recorded request it says when the figure arrives", () => {
        assert.equal(onStatus({}), "restart threshold: after the first recorded request");
    });

    test("tokens are shown in thousands, and in millions past one", () => {
        assert.deepEqual([compact(999), compact(80004), compact(1234567)], ["999", "80k", "1.23M"]);
    });

    test("declared multipliers are named as declared", () => {
        const figure = { context: 10, threshold: 20, fresh: 5, horizon: 20, multipliers: { read: 0.05, write: 2, source: "declared" } };
        assert.match(statusLine(figure), /multipliers declared: read 0\.05×, write 2×/);
        assert.match(adviceLine(figure), /; multipliers declared\./);
    });
});

describe("the runner", () => {
    test("it exits 0 on every path, whatever it is handed", () => {
        for (const [mode, input] of [
            ["prompt", "not json"],
            ["prompt", "null"],
            ["status", ""],
            ["other", "{}"],
            ["prompt", JSON.stringify({ session_id: "s", transcript_path: "/no/such/file.jsonl" })],
        ]) {
            const result = spawnSync(process.execPath, [TOOL, mode], { input, encoding: "utf8", env: { ...process.env, TMPDIR: HERMETIC_HOST } });
            assert.equal(result.status, 0, `${mode} ${input}: ${result.stderr}`);
        }
    });

    test("a defect inside it costs the prompt nothing", () => {
        const written = { out: "", err: "" };
        const stdout = { write: (s) => (written.out += s) };
        const stderr = { write: (s) => (written.err += s) };
        // A payload whose transcript_path getter throws stands in for any defect past the parse.
        const payload = Object.defineProperty({ session_id: "s" }, "transcript_path", {
            get() {
                throw new Error("boom");
            },
        });
        assert.equal(main(["prompt"], { stdout, stderr, payload, dir: HERMETIC_HOST }), 0);
        assert.equal(written.out, "");
        assert.match(written.err, /could not run — boom/);
    });

    test("the hook's output is one JSON line the host reads as additional context", () => {
        withTemp((dir) => {
            const file = session(dir, [90000]);
            const result = spawnSync(process.execPath, [TOOL, "prompt"], { input: JSON.stringify({ session_id: "runner", transcript_path: file }), encoding: "utf8", env: { ...process.env, TMPDIR: dir } });
            assert.equal(result.status, 0, result.stderr);
            const lines = result.stdout.trimEnd().split("\n");
            assert.equal(lines.length, 1);
            assert.ok(JSON.parse(lines[0]).hookSpecificOutput.additionalContext.startsWith("Portulan restart advisory:"));
        });
    });
});
