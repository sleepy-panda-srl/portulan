// The warm-start A/B's suite. **No case runs a real agent**: a stub stands in, writing a transcript where the
// host would and printing the host's JSON result, because a test starting `claude` would put a session and a
// credential inside a verify recipe. What the stub cannot stand in for is the host honouring a switch; that is
// the recorded run's to show (`../evals/ab/warm.md`).

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
    EXCLUDE_FLAG, HOSTED_VAR, PARENT_VARS, SWITCH_VARS, TASKS, isCode,
    childArgs, childEnv, portulanBytes, portulanSources, priced, readSequence, reportLines, run, runSequence, shareOf, summary, verdict,
} from "./warm.mjs";
import { readTranscript } from "./ledger.mjs";

// A HERMETIC HOST: the runner reads the ledger's and compile's defaults, which can reach the host's
// configuration home, so this suite points it at an empty directory that exists; each rig names its own.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch() {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "portulan-warm-")));
    SCRATCH.push(dir);
    return dir;
}

/**
 * The stand-in agent. Its first call in a state directory writes the prefix to the cache and every later call
 * reads it, which is what a sequence in one cache looks like; each call logs what it was started with.
 */
const STUB = `#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const args = process.argv.slice(2);
if (args[0] === "--version") { console.log("stub 0.0.0"); process.exit(0); }
const state = process.env.WARM_STUB_STATE;
const e = process.env;
fs.appendFileSync(path.join(state, "calls.jsonl"), JSON.stringify({ args, cwd: process.cwd(), ttl: e.CLAUDE_CODE_PROMPT_CACHE_TTL ?? null,
    git: e.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS ?? null, hosted: e.CLAUDE_CODE_REMOTE ?? null, parent: e.CLAUDECODE ?? null }) + "\\n");
const n = fs.readFileSync(path.join(state, "calls.jsonl"), "utf8").trim().split("\\n").length;
const warm = n > 1;
const sid = "session-" + n;
const dir = path.join(e.CLAUDE_CONFIG_DIR, "projects", process.cwd().replace(/[^a-zA-Z0-9]/g, "-"));
fs.mkdirSync(dir, { recursive: true });
const five = e.CLAUDE_CODE_PROMPT_CACHE_TTL === "5m";
const w = (t) => ({ cache_creation_input_tokens: t, cache_creation: { ephemeral_5m_input_tokens: five ? t : 0, ephemeral_1h_input_tokens: five ? 0 : t } });
const rec = (id, usage) => JSON.stringify({ type: "assistant", timestamp: new Date().toISOString(), message: { id, model: "stub", usage } });
fs.writeFileSync(path.join(dir, sid + ".jsonl"), [
    rec(sid + "-1", { input_tokens: 10, ...w(warm ? 0 : 20000), cache_read_input_tokens: warm ? 20000 : 0, output_tokens: 100 }),
    rec(sid + "-1", { input_tokens: 10, ...w(warm ? 0 : 20000), cache_read_input_tokens: warm ? 20000 : 0, output_tokens: 150 }),
    rec(sid + "-2", { input_tokens: 5, ...w(1000), cache_read_input_tokens: 20000, output_tokens: 50 }),
].join("\\n") + "\\n");
// Asked to, it changes its checkout: a file of its own, that file committed, or a file the tree ignores.
if (e.WARM_STUB_TOUCH === "ignored") fs.writeFileSync("local.log", "a run's own ignored file\\n");
else if (e.WARM_STUB_TOUCH) fs.writeFileSync("touched.txt", "a run's own file\\n");
if (e.WARM_STUB_TOUCH === "commit") {
    execFileSync("git", ["add", "touched.txt"]);
    execFileSync("git", ["-c", "user.name=s", "-c", "user.email=s@example.invalid", "commit", "-q", "-m", "a run's own commit"]);
}
console.log(JSON.stringify({ type: "result", subtype: "success", is_error: false, session_id: sid, num_turns: 2,
    result: e.WARM_STUB_ANSWER ?? "Propose; every verify recipe ran green first." }));
`;

/** A committed tree to clone, a stub agent, and an environment whose host home is the scratch directory. */
function rig({ answer, touch } = {}) {
    const root = scratch();
    const tree = path.join(root, "tree");
    fs.mkdirSync(tree);
    fs.writeFileSync(path.join(tree, "README.md"), "A tree.\n");
    fs.writeFileSync(path.join(tree, ".gitignore"), "*.log\n");
    const git = (args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...args], { cwd: tree, stdio: "ignore" });
    git(["init", "-q"]);
    git(["add", "."]);
    git(["commit", "-q", "-m", "a tree"]);
    const agent = path.join(root, "claude-stub.mjs");
    fs.writeFileSync(agent, STUB, { mode: 0o755 });
    const state = path.join(root, "state");
    fs.mkdirSync(state);
    const env = {
        PATH: process.env.PATH,
        HOME: root,
        CLAUDE_CONFIG_DIR: path.join(root, "config"),
        WARM_STUB_STATE: state,
        CLAUDECODE: "1",
        CLAUDE_CODE_PROMPT_CACHE_TTL: "1h",
        [HOSTED_VAR]: "true",
        ...(answer === undefined ? {} : { WARM_STUB_ANSWER: answer }),
        ...(touch === undefined ? {} : { WARM_STUB_TOUCH: touch }),
    };
    const calls = () => fs.readFileSync(path.join(state, "calls.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    return { root, tree, agent, env, calls, into: path.join(root, "runs") };
}

describe("pricing a run from its transcript", () => {
    const write = (lines) => {
        const file = path.join(scratch(), "t.jsonl");
        fs.writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`);
        return readTranscript(file).requests;
    };
    const rec = (id, usage, extra = {}) => ({ type: "assistant", message: { id, model: "m", usage }, ...extra });
    const w1h = (t) => ({ cache_creation_input_tokens: t, cache_creation: { ephemeral_1h_input_tokens: t, ephemeral_5m_input_tokens: 0 } });

    test("billed at the general multipliers, one request per message id, the main chain only", () => {
        const requests = write([
            rec("a", { input_tokens: 10, ...w1h(20000), cache_read_input_tokens: 0, output_tokens: 100 }),
            rec("a", { input_tokens: 10, ...w1h(20000), cache_read_input_tokens: 0, output_tokens: 150 }),
            rec("b", { input_tokens: 5, ...w1h(1000), cache_read_input_tokens: 20000, output_tokens: 50 }),
            rec("s", { input_tokens: 999, ...w1h(999), cache_read_input_tokens: 999, output_tokens: 999 }, { isSidechain: true }),
        ]);
        const f = priced(requests);
        // 15 uncached + 21,000 written at 2 + 20,000 read at 0.1 + 200 output at 5.
        assert.equal(f.billed, 15 + 42000 + 2000 + 1000);
        assert.equal(f.tokens, 15 + 21000 + 20000 + 200, "B is every token the host recorded, cache reads included");
        assert.equal(priced(requests, "1h", { read: 0.05, output: 5 }).billed, 15 + 42000 + 1000 + 1000, "C prices reads at the multiplier named");
        assert.equal(f.requests, 2);
        assert.equal(f.lifetime, "1h");
        assert.equal(f.cold, f.billed, "a run that read nothing at its first request is already cold");
        assert.equal(f.startedWarm, false);
    });

    test("cold prices the first request's reads as writes at the run's lifetime", () => {
        const requests = write([
            rec("a", { input_tokens: 10, ...w1h(0), cache_read_input_tokens: 20000, output_tokens: 150 }),
            rec("b", { input_tokens: 5, ...w1h(1000), cache_read_input_tokens: 20000, output_tokens: 50 }),
        ]);
        const f = priced(requests);
        assert.equal(f.billed, 15 + 2000 + 4000 + 1000);
        assert.equal(f.cold, f.billed + 20000 * (2 - 0.1));
        assert.equal(f.startedWarm, true);
        assert.deepEqual(f.first, { context: 20010, read: 20000, written: 0 });
    });

    test("a run that wrote nothing it named takes the arm's lifetime", () => {
        const requests = write([rec("a", { input_tokens: 1, cache_read_input_tokens: 100, output_tokens: 1 })]);
        assert.equal(priced(requests, "5m").lifetime, "5m");
        assert.equal(priced(requests, "1h").lifetime, "1h");
    });
});

describe("A: Portulan's share of what entered the context", () => {
    const OWN = ["# Notes kept by the workspace", "A session reads this file before it edits anything.", "", "- the first rule of the workspace, long enough to count"];
    const OTHER = "export const answer = 42; // application code, not Portulan's";

    /** A committed tree with one file of Portulan's and one of the application's. */
    const tree = () => {
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"));
        fs.mkdirSync(path.join(dir, "src"));
        fs.writeFileSync(path.join(dir, ".portulan", "notes.md"), `${OWN.join("\n")}\n`);
        // The application quotes one of the workspace's lines, so a line can be both code's and Portulan's.
        fs.writeFileSync(path.join(dir, "src", "app.js"), `${OTHER}\n${OWN[1]}\n`);
        const git = (args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...args], { cwd: dir, stdio: "ignore" });
        git(["init", "-q"]);
        git(["add", "."]);
        git(["commit", "-q", "-m", "a tree"]);
        return dir;
    };

    test("code is the five-run set's, but the compiled rule files under .claude/rules/ are Portulan's", () => {
        assert.deepEqual(
            [".claude/rules/portulan/boot.md", ".claude/settings.json", "cli/warm.mjs", "package.json", "core/engine.md", ".portulan/notes.md"].map(isCode),
            [false, true, true, true, false, false],
        );
        const dir = tree();
        fs.mkdirSync(path.join(dir, ".claude", "rules", "portulan"), { recursive: true });
        const card = "The boot card a session reads before its first request, compiled by Portulan.";
        fs.writeFileSync(path.join(dir, ".claude", "rules", "portulan", "boot.md"), `${card}\n`);
        execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "add", "-f", "."], { cwd: dir, stdio: "ignore" });
        execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", "a card"], { cwd: dir, stdio: "ignore" });
        const sources = portulanSources(dir);
        assert.ok(sources.lines.has(card) && !sources.code.has(card));
    });

    test("a line is Portulan's when a file of Portulan's holds it, printed with a line number or not; a short line follows the one before", () => {
        const sources = portulanSources(tree());
        assert.equal(sources.files, 1, "every tracked file that is not code, and only those");
        assert.equal(sources.before, 0, "a tree whose workspace cannot be measured loads nothing of Portulan's before the first request");
        const read = OWN.map((line, i) => `${String(i + 1).padStart(6)}\t${line}`).join("\n");
        assert.equal(portulanBytes(read, sources.lines), Buffer.byteLength(read));
        const mixed = `${OWN[0]}\n${OWN[1]}\n${OTHER}\n}`;
        assert.equal(portulanBytes(mixed, sources.lines), Buffer.byteLength(OWN[0]) + 1 + Buffer.byteLength(OWN[1]) + 1);
        assert.equal(portulanBytes(`src/app.js:1:${OTHER}`, sources.lines), 0);
    });

    /** A transcript: a prompt, a read of Portulan's file, and three requests; a compaction before the third if asked. */
    const transcript = ({ compact = false } = {}) => {
        const usage = (uncached, written, read, output) => ({
            input_tokens: uncached, cache_creation_input_tokens: written,
            cache_creation: { ephemeral_1h_input_tokens: written, ephemeral_5m_input_tokens: 0 }, cache_read_input_tokens: read, output_tokens: output,
        });
        const result = OWN.map((line, i) => `${String(i + 1).padStart(6)}\t${line}`).join("\n");
        const input = { file_path: "/x/.portulan/notes.md" };
        const lines = [
            { type: "user", message: { role: "user", content: "Boot, then answer." } },
            { type: "assistant", message: { id: "a", model: "m", content: [{ type: "tool_use", id: "t1", name: "Read", input }], usage: usage(10, 20000, 0, 40) } },
            { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: result }] } },
            { type: "assistant", message: { id: "b", model: "m", content: [{ type: "text", text: "ok" }], usage: usage(5, 995, 20010, 20) } },
            ...(compact ? [{ type: "system", subtype: "compact_boundary" }] : []),
            { type: "assistant", message: { id: "c", model: "m", content: [{ type: "text", text: "done" }], usage: usage(5, 100, 21010, 10) } },
        ];
        const file = path.join(scratch(), "t.jsonl");
        fs.writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`);
        return { file, read: Buffer.byteLength(result), use: Buffer.byteLength(JSON.stringify(input)) };
    };

    test("a block takes its share by bytes of the growth where it entered, sent again by every later request", () => {
        const sources = portulanSources(tree());
        const t = transcript();
        const { requests } = readTranscript(t.file);
        // Request b grew by 1,000 over request a; the read is that share of what entered, and b and c both send it.
        assert.deepEqual(shareOf(t.file, requests, sources), { tokens: Math.round(((1000 * t.read) / (t.read + t.use)) * 2), estimated: 0 });
    });

    /** Request a, then what `between` holds, then request b, which grew by 1,000: A is what of that growth is Portulan's. */
    const aOf = (uses, between) => {
        const usage = (uncached, written, read, output) => ({
            input_tokens: uncached, cache_creation_input_tokens: written,
            cache_creation: { ephemeral_1h_input_tokens: written, ephemeral_5m_input_tokens: 0 }, cache_read_input_tokens: read, output_tokens: output,
        });
        const lines = [
            { type: "user", message: { role: "user", content: "Boot, then answer." } },
            { type: "assistant", message: { id: "a", model: "m", content: uses, usage: usage(10, 20000, 0, 40) } },
            ...between,
            { type: "assistant", message: { id: "b", model: "m", content: [{ type: "text", text: "ok" }], usage: usage(5, 995, 20010, 20) } },
        ];
        const file = path.join(scratch(), "t.jsonl");
        fs.writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`);
        return shareOf(file, readTranscript(file).requests, portulanSources(tree())).tokens;
    };
    const read = (id, file) => ({ type: "tool_use", id, name: "Read", input: { file_path: file } });
    const result = (id, text) => ({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: text }] } });

    test("a line the code holds too is the code's when the call named a code file, and Portulan's when it named Portulan's", () => {
        const line = `     2\t${OWN[1]}`;
        assert.equal(aOf([read("t1", "/x/src/app.js")], [result("t1", line)]), 0);
        const own = aOf([read("t1", "/x/.portulan/notes.md")], [result("t1", line)]);
        const use = Buffer.byteLength(JSON.stringify({ file_path: "/x/.portulan/notes.md" }));
        assert.equal(own, Math.round((1000 * Buffer.byteLength(line)) / (use + Buffer.byteLength(line))));
    });

    test("the skill text the host injects is matched; a prompt, a plain message and a hook's attachment are bytes only", () => {
        const text = OWN.join("\n");
        assert.ok(aOf([], [{ type: "user", isMeta: true, message: { role: "user", content: [{ type: "text", text }] } }]) > 0);
        assert.equal(aOf([], [{ type: "user", message: { role: "user", content: [{ type: "text", text }] } }]), 0);
        assert.equal(aOf([], [{ type: "user", message: { role: "user", content: text } }]), 0);
        assert.equal(aOf([], [{ type: "attachment", attachment: { type: "hook_additional_context", content: [text] } }]), 0);
    });

    test("a run that compacted has no A, rather than a count of what its summary replaced", () => {
        const t = transcript({ compact: true });
        assert.equal(shareOf(t.file, readTranscript(t.file).requests, portulanSources(tree())), null);
    });
});

describe("what the child starts with", () => {
    test("the parent's conversation and the host's switch variables are removed, and the arm's set", () => {
        const parent = Object.fromEntries([...PARENT_VARS, ...SWITCH_VARS].map((v) => [v, "parent"]));
        parent.KEEP = "kept";
        parent[HOSTED_VAR] = "true";
        const env = childEnv(parent, { git_instructions: false, cache_lifetime: "5m" });
        assert.equal(env.KEEP, "kept");
        assert.equal(env[HOSTED_VAR], "true", "a hosted child stays hosted unless asked");
        for (const v of PARENT_VARS) assert.equal(env[v], undefined, v);
        assert.equal(env.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS, "1");
        assert.equal(env.CLAUDE_CODE_PROMPT_CACHE_TTL, "5m");
        assert.equal(env.FORCE_PROMPT_CACHING_5M, undefined);
        assert.equal(childEnv(parent, { git_instructions: true }).CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS, "0");
        assert.equal(childEnv(parent, {}, { local: true })[HOSTED_VAR], undefined);
    });

    test("the task's prompt and arguments, and the exclusion only when the arm asks for it", () => {
        const plain = childArgs("boot", "/t", {});
        assert.deepEqual(plain.slice(0, 2), ["-p", TASKS.boot.prompt]);
        assert.ok(plain.includes("--plugin-dir") && plain[plain.indexOf("--plugin-dir") + 1] === "/t");
        assert.equal(plain.includes(EXCLUDE_FLAG), false);
        assert.ok(childArgs("probe", "/t", { exclude_dynamic_sections: true }).includes(EXCLUDE_FLAG));
        assert.deepEqual(childArgs("probe", "/t", {}, { model: "m" }).slice(-2), ["--model", "m"]);
        assert.throws(() => childArgs("edit", "/t", {}), /no task `edit`/);
    });
});

describe("a sequence, end to end on a stub", () => {
    test("the first run writes the prefix, the later ones read it, and each transcript is kept", () => {
        const r = rig();
        runSequence({ tree: r.tree, into: r.into, label: "host", runs: 3, agent: r.agent, env: r.env });
        const s = readSequence(path.join(r.into, "host"));
        assert.equal(s.runs.length, 3);
        for (const run of s.runs) assert.ok(fs.existsSync(path.join(r.into, "host", run.transcript)));
        assert.deepEqual(
            { first: s.summary.first, warm: s.summary.warm, cold: s.summary.cold, startedWarm: s.summary.startedWarm, graded: s.summary.graded },
            { first: 45015, warm: 7015, cold: 45015, startedWarm: 2, graded: 3 },
        );
        const calls = r.calls();
        assert.equal(new Set(calls.map((c) => c.cwd)).size, 1, "one checkout");
        assert.equal(calls[0].parent, null, "the parent session's marker does not reach the child");
        assert.equal(calls[0].ttl, null, "the parent's lifetime does not reach the child");
    });

    test("the arm reaches the child, and a five-minute sequence is billed at the five-minute write", () => {
        const r = rig();
        runSequence({ tree: r.tree, into: r.into, label: "five", runs: 2, arm: { cache_lifetime: "5m" }, agent: r.agent, env: r.env });
        assert.deepEqual(r.calls().map((c) => c.ttl), ["5m", "5m"]);
        const s = readSequence(path.join(r.into, "five"));
        assert.equal(s.summary.first, 15 + 21000 * 1.25 + 2000 + 1000);
        assert.equal(s.summary.warm, 15 + 1000 * 1.25 + 4000 + 1000);
    });

    test("--copies each starts every run in a directory of its own, and --between commit commits between runs", () => {
        const r = rig();
        runSequence({ tree: r.tree, into: r.into, label: "each", runs: 2, copies: "each", agent: r.agent, env: r.env });
        assert.equal(new Set(r.calls().map((c) => c.cwd)).size, 2);
        runSequence({ tree: r.tree, into: r.into, label: "commits", runs: 3, between: "commit", local: true, agent: r.agent, env: r.env });
        const clone = path.join(r.into, "commits", "tree");
        const git = (args) => execFileSync("git", args, { cwd: clone, encoding: "utf8" });
        assert.equal(git(["log", "--oneline"]).trim().split("\n").length, 3, "the tree's commit and one between each pair of runs");
        assert.equal(git(["remote"]), "", "no remote, so a run can push nothing");
        assert.equal(git(["rev-list", "--max-count=1", "HEAD", "--not", "--remotes"]), "", "what the runner committed reads as recorded, so the stop gate asks no run for a handoff");
        assert.match(git(["log", "-1", "--format=%B"]), /^Seam-scan: clean\b/m, "the line the docs recipe reads on the newest change");
    });

    test("a commit between runs needs one checkout and a local session, refused before anything is recorded", () => {
        const r = rig();
        const both = { tree: r.tree, into: r.into, runs: 2, between: "commit", agent: r.agent, env: r.env };
        assert.throws(() => runSequence({ ...both, label: "each", copies: "each", local: true }), /needs one checkout/);
        assert.throws(() => runSequence({ ...both, label: "hosted" }), /needs --local/);
        assert.equal(fs.existsSync(r.into), false);
        const said = [];
        const argv = ["run", "--tree", r.tree, "--into", r.into, "--label", "cli", "--between", "commit", "--agent", r.agent];
        assert.equal(run(argv, { say: (l) => said.push(l), env: r.env }), 2);
        assert.match(said.join("\n"), /needs --local/);
    });

    for (const touch of ["file", "commit", "ignored"]) {
        test(`a run that changed its clone (${touch}) fails its task, and the clone goes back to where the run started`, () => {
            const r = rig({ touch });
            const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: r.tree, encoding: "utf8" });
            runSequence({ tree: r.tree, into: r.into, label: "touched", runs: 2, agent: r.agent, env: r.env });
            const s = readSequence(path.join(r.into, "touched"));
            assert.deepEqual(s.runs.map((run) => [run.answered, run.changed, run.graded]), [[true, true, false], [true, true, false]]);
            assert.deepEqual([s.summary.graded, s.summary.changed], [0, 2]);
            const clone = path.join(r.into, "touched", "tree");
            assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { cwd: clone, encoding: "utf8" }), head);
            assert.equal(execFileSync("git", ["status", "--porcelain", "--ignored"], { cwd: clone, encoding: "utf8" }), "");
            assert.match(reportLines(s).at(-1), /answered 0 of 2; changed a file 2$/);
        });
    }

    test("a sequence reports its three lines, A first, and C against its cold figure at 100", () => {
        const r = rig();
        runSequence({ tree: r.tree, into: r.into, label: "lines", runs: 3, agent: r.agent, env: r.env });
        const lines = reportLines(readSequence(path.join(r.into, "lines")));
        const three = lines.slice(-3);
        assert.deepEqual(three.map((l) => l.slice(0, 5)), ["  A  ", "  B  ", "  C  "]);
        assert.match(three[0], /Portulan's share: 0 tokens a run/, "a stub reads nothing of Portulan's");
        assert.match(three[1], /the whole task: 41,215 tokens a run/);
        assert.match(three[2], /cost: warm 16 against cold 100 \(7,015 against 45,015, reads at 0\.1 and output at 5, the general multipliers\)/);
        const said = [];
        assert.equal(run(["report", path.join(r.into, "lines"), "--read", "0.05"], { say: (l) => said.push(l) }), 0);
        assert.match(said.at(-1), /cost: warm 11 against cold 100 \(5,015 against 44,015, reads at 0\.05 and output at 5\)/);
        assert.equal(run(["report", path.join(r.into, "lines"), "--read", "0"], { say: () => {} }), 2);
    });

    test("a sequence is recorded once: its directory existing is a refusal", () => {
        const r = rig();
        runSequence({ tree: r.tree, into: r.into, label: "once", runs: 2, agent: r.agent, env: r.env });
        assert.throws(() => runSequence({ tree: r.tree, into: r.into, label: "once", runs: 2, agent: r.agent, env: r.env }), /recorded once/);
    });
});

describe("a switch against its control", () => {
    // One tree, so both start from the same commit, and a stub state each, so each starts cold.
    const pair = ({ answer, touch } = {}) => {
        const a = rig({ touch });
        const b = rig({ answer });
        runSequence({ tree: a.tree, into: a.into, label: "control", runs: 2, agent: a.agent, env: a.env });
        runSequence({ tree: a.tree, into: b.into, label: "treatment", runs: 2, arm: { cache_lifetime: "5m" }, agent: b.agent, env: b.env });
        return [path.join(a.into, "control"), path.join(b.into, "treatment")];
    };

    test("cheaper and every run answered is a pass, exit 0, said in the three lines", () => {
        const [control, treatment] = pair();
        const v = verdict(readSequence(control), readSequence(treatment));
        assert.equal(v.pass, true);
        assert.ok(v.ratio < 1);
        const said = [];
        assert.equal(run(["report", control, treatment], { say: (l) => said.push(l) }), 0);
        assert.deepEqual(said.slice(-3).map((l) => l.slice(0, 5)), ["  A  ", "  B  ", "  C  "]);
        assert.match(said.at(-1), /cost: 68 against the control's 100, the mean of all runs with the first priced cold; every run measured, every run answered, no run of either changed a file: PASS/);
    });

    test("cheaper and answering off-task is a fail, exit 1", () => {
        const [control, treatment] = pair({ answer: "I could not tell." });
        const v = verdict(readSequence(control), readSequence(treatment));
        assert.deepEqual([v.cuts, v.answered, v.pass], [true, false, false]);
        assert.equal(run(["report", control, treatment], { say: () => {} }), 1);
    });

    test("cheaper against a control whose runs changed a file is a fail, exit 1", () => {
        const [control, treatment] = pair({ touch: "file" });
        const v = verdict(readSequence(control), readSequence(treatment));
        assert.deepEqual([v.cuts, v.answered, v.unchanged, v.pass], [true, true, false, false]);
        const said = [];
        assert.equal(run(["report", control, treatment], { say: (l) => said.push(l) }), 1);
        assert.match(said.at(-1), /every run answered, a run changed a file: FAIL/);
    });

    test("a run with no transcript leaves its sequence unmeasured: no figure and a fail, exit 1", () => {
        const [control, treatment] = pair();
        const file = path.join(treatment, "sequence.json");
        const record = JSON.parse(fs.readFileSync(file, "utf8"));
        record.runs[1].transcript = null;
        fs.writeFileSync(file, JSON.stringify(record));
        const v = verdict(readSequence(control), readSequence(treatment));
        assert.deepEqual([v.measured, v.cuts, v.pass, v.ratio], [false, false, false, null]);
        const said = [];
        assert.equal(run(["report", control, treatment], { say: (l) => said.push(l) }), 1);
        assert.match(said.at(-1), /no figure against the control's 100.*a run was not measured/);
    });

    test("a transcript that records no request of the session's own leaves its run unmeasured, never free, exit 1", () => {
        const [control, treatment] = pair();
        const { runs } = JSON.parse(fs.readFileSync(path.join(treatment, "sequence.json"), "utf8"));
        const file = path.join(treatment, runs[1].transcript);
        const lines = fs.readFileSync(file, "utf8").trim().split("\n");
        const subagent = lines.map((l) => JSON.stringify({ ...JSON.parse(l), isSidechain: true })).join("\n");
        const hostWritten = JSON.stringify({ type: "assistant", message: { model: "<synthetic>", usage: { input_tokens: 0, output_tokens: 0 } } });
        const torn = '{"type":"assistant","message":{"usage":';
        for (const body of ["", torn, hostWritten, subagent]) {
            fs.writeFileSync(file, body);
            const s = readSequence(treatment);
            assert.equal(s.runs[1].figures, null);
            assert.equal(s.summary.measured, 1);
            const v = verdict(readSequence(control), s);
            assert.deepEqual([v.measured, v.cuts, v.pass, v.ratio], [false, false, false, null]);
        }
        const said = [];
        assert.equal(run(["report", control, treatment], { say: (l) => said.push(l) }), 1);
        assert.match(said.at(-1), /no figure against the control's 100.*a run was not measured/);
        assert.match(reportLines(readSequence(treatment)).at(-1), /; measured 1 of 2; answered 2 of 2;/);
        const controlRun = path.join(control, JSON.parse(fs.readFileSync(path.join(control, "sequence.json"), "utf8")).runs[1].transcript);
        fs.writeFileSync(controlRun, fs.readFileSync(controlRun, "utf8").replaceAll('"model":"stub"', '"model":"stub-2"'));
        const partly = verdict(readSequence(control), readSequence(treatment));
        assert.deepEqual([partly.measured, partly.pass], [false, false], "a model only the unmeasured run's twin recorded is no other shape");
        fs.writeFileSync(path.join(treatment, runs[0].transcript), "");
        const none = reportLines(readSequence(treatment));
        assert.match(none.at(-3), /A {2}Portulan's share: no figure, since no run was measured$/);
        assert.match(none.at(-1), /; measured 0 of 2;/);
        const v = verdict(readSequence(control), readSequence(treatment));
        assert.deepEqual([v.measured, v.pass, v.ratio], [false, false, null]);
        said.length = 0;
        assert.equal(run(["report", control, treatment], { say: (l) => said.push(l) }), 1);
        assert.match(said.at(-1), /no figure against the control's 100.*a run was not measured/);
    });

    test("two sequences of different shapes are no comparison, exit 2", () => {
        const a = rig();
        runSequence({ tree: a.tree, into: a.into, label: "two", runs: 2, agent: a.agent, env: a.env });
        runSequence({ tree: a.tree, into: a.into, label: "three", runs: 3, agent: a.agent, env: a.env });
        assert.equal(run(["report", path.join(a.into, "two"), path.join(a.into, "three")], { say: () => {} }), 2);
    });

    test("two sequences of one arm, or apart in anything else the runner records, are no comparison, exit 2", () => {
        const a = rig();
        runSequence({ tree: a.tree, into: a.into, label: "one", runs: 2, agent: a.agent, env: a.env });
        runSequence({ tree: a.tree, into: a.into, label: "other", runs: 2, agent: a.agent, env: a.env });
        const [one, other] = [path.join(a.into, "one"), path.join(a.into, "other")];
        assert.throws(() => verdict(readSequence(one), readSequence(other)), /the same arm/);
        const file = path.join(other, "sequence.json");
        const record = JSON.parse(fs.readFileSync(file, "utf8"));
        assert.equal(record.source, execFileSync("git", ["rev-parse", "HEAD"], { cwd: a.tree, encoding: "utf8" }).trim());
        const apart = { arm: { cache_lifetime: "5m" } };
        fs.writeFileSync(file, JSON.stringify({ ...record, ...apart }));
        assert.doesNotThrow(() => verdict(readSequence(one), readSequence(other)), "apart in the arm alone, a comparison");
        for (const [what, change] of [["the host's version", { agent: "stub 0.0.1" }], ["the commit", { source: "0".repeat(40) }]]) {
            fs.writeFileSync(file, JSON.stringify({ ...record, ...apart, ...change }));
            assert.throws(() => verdict(readSequence(one), readSequence(other)), /differ in shape/, what);
        }
        fs.writeFileSync(file, JSON.stringify({ ...record, ...apart }));
        const transcript = path.join(other, "run-1.jsonl");
        fs.writeFileSync(transcript, fs.readFileSync(transcript, "utf8").replaceAll('"model":"stub"', '"model":"stub-2"'));
        assert.throws(() => verdict(readSequence(one), readSequence(other)), /recorded stub against|differ in shape/, "the models the host recorded");
        assert.equal(run(["report", one, other], { say: () => {} }), 2);
        for (const name of fs.readdirSync(other).filter((n) => /^run-\d+\.jsonl$/.test(n))) {
            const t = path.join(other, name);
            fs.writeFileSync(t, fs.readFileSync(t, "utf8").replaceAll(/"model":"stub(?:-2)?"/g, '"model":null'));
        }
        assert.throws(() => verdict(readSequence(one), readSequence(other)), /differ in shape.*\(recorded run 1 none, run 2 none\)/, "measured runs that recorded no model");
    });

    test("what the cache held before a sequence is neither arm's: the first run is priced cold", () => {
        const r = rig();
        runSequence({ tree: r.tree, into: r.into, label: "control", runs: 2, agent: r.agent, env: r.env });
        runSequence({ tree: r.tree, into: r.into, label: "treatment", runs: 2, arm: { cache_lifetime: "5m" }, agent: r.agent, env: r.env });
        const [control, treatment] = [readSequence(path.join(r.into, "control")), readSequence(path.join(r.into, "treatment"))];
        assert.equal(treatment.runs[0].figures.startedWarm, true, "the treatment's first run found the control's prefix cached");
        assert.equal(Math.round((treatment.summary.billed / control.summary.billed) * 100), 24, "billed alone would credit the switch with that");
        assert.equal(Math.round(verdict(control, treatment).ratio * 100), 68, "the same as two sequences each started cold");
    });

    test("an answer counts when it says what its task expects, not negated, and the probe's word alone", () => {
        for (const [answer, counts] of [
            ["Changing a verify recipe gets the propose tier; done needs every recipe green.", true],
            ["Tier: **propose**. Done needs the default recipe to run green first.", true],
            ["do not propose; nothing is green", false],
            ["It is propose, and it counts as done even if the recipes are not green.", false],
            ["It isn’t propose, it is decide; green recipes.", false],
        ]) assert.equal(TASKS.boot.expect(answer), counts, answer);
        for (const [answer, counts] of [["ok", true], ["OK.", true], ["not ok", false], ["ok, and more", false]]) {
            assert.equal(TASKS.probe.expect(answer), counts, answer);
        }
    });

    test("the summary of nothing measured is no figure, not a zero", () => {
        assert.deepEqual(
            [summary([{ k: 1, figures: null, graded: false }]).warm, summary([{ k: 1, figures: null, graded: false }]).share],
            [null, null],
        );
    });
});

describe("the command line", () => {
    const quiet = { say: () => {} };

    for (const [what, argv] of [
        ["no mode", []],
        ["an unknown mode", ["rerun"]],
        ["run without its tree, destination and label", ["run"]],
        ["a single run, which has nothing to start warm", ["run", "--tree", ".", "--into", "x", "--label", "a", "--runs", "1"]],
        ["a lifetime the host does not take", ["run", "--tree", ".", "--into", "x", "--label", "a", "--cache-lifetime", "30m"]],
        ["a label that is no slug", ["run", "--tree", ".", "--into", "x", "--label", "../up"]],
        ["an unknown argument", ["run", "--tree", ".", "--into", "x", "--label", "a", "--effort", "low"]],
        ["report with nothing to read", ["report"]],
    ]) {
        test(`${what} is could-not-run, exit 2`, () => {
            assert.equal(run(argv, quiet), 2);
        });
    }

    test("--declared starts the arm a workspace declares for headless runs, and refuses switches beside it", () => {
        const r = rig();
        const ws = path.join(r.root, "ws");
        fs.mkdirSync(ws);
        fs.writeFileSync(path.join(ws, "workspace.json"), JSON.stringify({ portulan: { spec: "2.11" }, sessions: { headless: { cache_lifetime: "5m" } } }));
        const argv = ["run", "--tree", r.tree, "--into", r.into, "--label", "declared", "--runs", "2", "--agent", r.agent, "--declared", ws];
        assert.equal(run(argv, { ...quiet, env: r.env }), 0);
        assert.deepEqual(r.calls().map((c) => c.ttl), ["5m", "5m"]);
        assert.equal(run([...argv.slice(0, 6), "again", ...argv.slice(7), "--cache-lifetime", "1h"], { ...quiet, env: r.env }), 2);
        fs.writeFileSync(path.join(ws, "workspace.json"), JSON.stringify({ portulan: { spec: "2.11" } }));
        assert.equal(run([...argv.slice(0, 6), "none", ...argv.slice(7)], { ...quiet, env: r.env }), 2);
    });
});
