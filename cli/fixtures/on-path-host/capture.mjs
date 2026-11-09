import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sha, verifyCapture } from "./verify.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const quote = (s) => `'${s.replaceAll("'", "'\\''")}'`;
const inventory = (root, prefix = "") => fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).flatMap((e) => {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    return e.isDirectory() ? inventory(root, rel) : [{ file: rel, sha256: sha(fs.readFileSync(path.join(root, rel))) }];
});
export async function capture(outDir) {
    assert.ok(!process.env.CI, "live capture is forbidden in CI");
    fs.mkdirSync(outDir, { recursive: true });
    outDir = fs.realpathSync(outDir);
    const project = path.join(outDir, "project");
    assert.ok(!fs.existsSync(project), "use a fresh capture directory");
    fs.cpSync(path.join(REPO, "cli/fixtures/guidance"), project, { recursive: true });
    const label = `ON_PATH_${randomUUID().replaceAll("-", "")}`;
    fs.appendFileSync(path.join(project, "context/api.md"), `\nThe API observation label is ${label}. When asked for the label after reading an API file, reply with that value only.\n`);
    fs.mkdirSync(path.join(project, "docs"));
    fs.writeFileSync(path.join(project, "docs/control.txt"), "A nonmatching documentation probe.\n");
    const compileArgs = [path.join(REPO, "cli/compile.mjs"), "--workspace", project, "--pack-root", path.join(REPO, "packs")];
    const compiled = spawnSync(process.execPath, compileArgs, { cwd: project, encoding: "utf8" });
    fs.writeFileSync(path.join(outDir, "compile.log"), compiled.stdout + compiled.stderr);
    assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
    const target = ".claude/rules/portulan/api.md";
    const inputPaths = { source: "context/api.md", target, api: "api/orders.txt", control: "docs/control.txt" };
    const inputs = Object.fromEntries(Object.entries(inputPaths).map(([key, rel]) => [key, fs.readFileSync(path.join(project, rel), "utf8")]));
    const containingLabel = inventory(project).filter(({ file }) => fs.readFileSync(path.join(project, file), "utf8").includes(label)).map(({ file }) => file).sort();
    assert.deepEqual(containingLabel, [target, "context/api.md"].sort());
    const trace = path.join(outDir, "observer.ndjson");
    fs.writeFileSync(trace, "");
    const observer = path.join(HERE, "observer.mjs");
    const command = [process.execPath, observer, project, trace].map(quote).join(" ");
    const excludes = [path.join(os.homedir(), ".claude/**")];
    for (let dir = path.dirname(project); ; dir = path.dirname(dir)) {
        for (const file of ["CLAUDE.md", "CLAUDE.local.md", "AGENTS.md", ".claude/CLAUDE.md", ".claude/rules/**"]) excludes.push(path.join(dir, file));
        if (path.dirname(dir) === dir) break;
    }
    const hook = { hooks: [{ type: "command", command, timeout: 15 }] };
    const settings = { autoMemoryEnabled: false, claudeMdExcludes: excludes, hooks: Object.fromEntries(["InstructionsLoaded", "PreToolUse", "PostToolUse", "UserPromptSubmit", "SessionEnd"].map((event) => [event, [hook]])) };
    const settingsFile = path.join(outDir, "settings.json");
    fs.writeFileSync(settingsFile, JSON.stringify(settings));
    assert.ok(!JSON.stringify(settings).includes(label));
    const beforeFiles = inventory(project);
    const hostVersion = spawnSync("claude", ["--version"], { encoding: "utf8" });
    assert.equal(hostVersion.status, 0, "Claude CLI unavailable");
    const prompts = [
        "Use Read once to read docs/control.txt. Do not read or search any other file. If an API observation label is already in your loaded instructions, reply with it; otherwise reply exactly NOT_LOADED. No explanation or formatting.",
        "Use Read once to read api/orders.txt. Do not read or search any other file. Then reply with the API observation label from your now-loaded guidance. Reply only with the literal value, without formatting.",
    ];
    const args = ["--print", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--replay-user-messages", "--no-session-persistence", "--tools", "Read", "--allowedTools", "Read", "--permission-mode", "dontAsk", "--setting-sources", "project", "--settings", settingsFile, "--disable-slash-commands", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--max-turns", "6"];
    const env = { ...process.env, DISABLE_AUTOUPDATER: "1" };
    delete env.CLAUDECODE;
    delete env.CLAUDE_PROJECT_DIR;
    let raw = "", stderr = "", buffer = "", phase = 0, streamInvalid = false;
    const messages = [];
    const child = spawn("claude", args, { cwd: project, env, stdio: ["pipe", "pipe", "pipe"] });
    const send = (prompt) => child.stdin.write(`${JSON.stringify({ type: "user", message: { role: "user", content: prompt } })}\n`);
    const deadline = setTimeout(() => child.kill("SIGTERM"), 240_000);
    child.stderr.on("data", (data) => { stderr += data; });
    child.stdout.on("data", (data) => {
        raw += data; buffer += data;
        for (;;) {
            const at = buffer.indexOf("\n"); if (at < 0) break;
            const line = buffer.slice(0, at); buffer = buffer.slice(at + 1);
            if (!line.trim()) continue;
            let message;
            try { message = JSON.parse(line); } catch { streamInvalid = true; child.kill("SIGTERM"); continue; }
            messages.push({ ...message, capturePhase: phase });
            if (message.type === "result") {
                if (phase === 0 && !message.is_error) { phase = 1; send(prompts[1]); }
                else child.stdin.end();
            }
        }
    });
    send(prompts[0]);
    const hostExit = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", (code) => resolve(code)); });
    clearTimeout(deadline);
    fs.writeFileSync(path.join(outDir, "host.ndjson"), raw);
    fs.writeFileSync(path.join(outDir, "host.stderr"), stderr);
    assert.equal(hostExit, 0, `host failed; inspect private raw files in ${outDir}`);
    assert.ok(!streamInvalid && !buffer.trim(), "invalid or incomplete host stream");
    let records;
    for (let attempt = 0; attempt < 150; attempt++) {
        records = fs.readFileSync(trace, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
        const starts = records.filter((r) => r.type === "start");
        const done = new Set(records.filter((r) => r.type === "done").map((r) => r.id));
        if (records.some((r) => r.event === "SessionEnd") && starts.length && starts.every((r) => done.has(r.id))) break;
        await pause(100);
    }
    assert.ok(!records.some((r) => r.type === "observer-error"));
    const init = messages.find((m) => m.type === "system" && m.subtype === "init");
    assert.ok(init, "no real host initialization record");
    assert.ok(messages.filter((m) => m.type === "system" && m.subtype === "init").every((m) => m.session_id === init.session_id && m.model === init.model));
    const results = messages.filter((m) => m.type === "result");
    assert.equal(results.length, 2);
    assert.ok(results.every((r) => !r.is_error && r.session_id === init.session_id));
    const relative = (file) => path.relative(project, path.resolve(project, file)).split(path.sep).join("/");
    const reads = messages.flatMap((m) => m.type === "assistant" ? (m.message?.content ?? []).filter((b) => b.type === "tool_use").map((b) => ({ id: b.id, name: b.name, file: relative(b.input.file_path ?? ""), phase: m.capturePhase })) : []);
    for (const read of reads) {
        const result = messages.flatMap((m) => m.type === "user" && Array.isArray(m.message?.content) ? m.message.content : []).find((b) => b.type === "tool_result" && b.tool_use_id === read.id);
        read.resultSeen = Boolean(result);
        read.isError = Boolean(result?.is_error);
        const text = typeof result?.content === "string" ? result.content : JSON.stringify(result?.content);
        assert.ok(text?.includes((read.file === "docs/control.txt" ? inputs.control : inputs.api).trim()), "ordinary file text missing from tool result");
    }
    const events = records.filter((r) => r.type === "event");
    const capture = {
        format: 1, normalization: "fixture-paths-v1; selected SDK fields; replies trimmed", date: new Date().toISOString(),
        hostVersion: hostVersion.stdout.trim(), model: init.model, session: init.session_id, hostExit, target, label,
        prompts, replies: results.map((r) => r.result.trim()), reads, events,
        observers: { started: records.filter((r) => r.type === "start").map((r) => r.id), completed: records.filter((r) => r.type === "done").map((r) => r.id) },
        outsideActivity: events.filter((e) => e.outside || e.unexpected).length,
        inputs, inputDigests: Object.fromEntries(Object.entries(inputs).map(([key, text]) => [key, sha(text)])), beforeFiles, afterFiles: inventory(project),
        controls: { settingsSources: "project", autoMemoryEnabled: false, skillsDisabled: true, strictEmptyMcp: true, instructionExclusionPatterns: excludes.length, unexpectedReadGuard: true, fullHostContextMeasured: false },
        commands: { compile: ["node", "<repo>/cli/compile.mjs", "--workspace", "<project>", "--pack-root", "<repo>/packs"], host: ["claude", ...args.map((arg) => arg === settingsFile ? "<capture>/settings.json" : arg)] },
        provenance: { baseCommit: spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).stdout.trim(), rawStream: sha(raw), rawObserver: sha(fs.readFileSync(trace)), rawStderr: sha(stderr), rawSettings: sha(fs.readFileSync(settingsFile)), captureScript: sha(fs.readFileSync(path.join(HERE, "capture.mjs"))), observerScript: sha(fs.readFileSync(observer)), compiler: sha(fs.readFileSync(path.join(REPO, "cli/compile.mjs"))) },
    };
    verifyCapture(capture);
    fs.writeFileSync(path.join(outDir, "capture.json"), `${JSON.stringify(capture, null, 2)}\n`);
    return capture;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    if (process.argv[2] !== "--run-host" || !process.argv[3] || process.argv.length !== 4) {
        process.stderr.write("usage: node cli/fixtures/on-path-host/capture.mjs --run-host <fresh-output-directory>\nLive host calls are manual; run verify.mjs for offline evidence checks.\n");
        process.exitCode = 2;
    } else {
        try { const result = await capture(path.resolve(process.argv[3])); process.stdout.write(`Captured ${result.hostVersion}, ${result.model}: target loaded on ${result.events.find((e) => e.file === result.target).trigger}\n`); }
        catch (error) { process.stderr.write(`on-path capture failed: ${error.message}\n`); process.exitCode = 1; }
    }
}
