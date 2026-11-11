// Manual, synthetic installed-host trace. Never imported by an offline check.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.CI || process.argv.length !== 3) throw Error("manual capture only: node capture.mjs <new private output directory>");
const directory = path.resolve(process.argv[2]);
fs.mkdirSync(directory, { recursive: false, mode: 0o700 });
const here = path.dirname(fileURLToPath(import.meta.url));
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const sources = Object.fromEntries(["capture.mjs", "observe.mjs", "../../advisory.mjs", "../../ledger.mjs"].map(p => [p, hash(path.join(here, p))]));
const binary = "/opt/homebrew/bin/claude";
const host = spawnSync(binary, ["--version"], { encoding: "utf8" });
if (host.status !== 0) throw Error("installed host version unavailable");
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const runs = [];
for (const [name, contexts] of [["below", [1000, 1500, 1500, 1500]], ["crossing", [1000, 1700, 1500, 1500]]]) {
    const run = path.join(directory, name);
    fs.mkdirSync(run);
    const config = path.join(run, "config"), state = path.join(run, "state"), work = path.join(run, "work");
    for (const dir of [config, state, work]) fs.mkdirSync(dir);
    fs.writeFileSync(path.join(work, "fixture.txt"), "Synthetic local trace fixture.\n");
    const journal = path.join(run, "events.jsonl");
    const events = [];
    let request = 0;
    const server = http.createServer((req, res) => {
        req.resume();
        req.on("end", () => {
            if (!req.url.startsWith("/v1/messages") || request >= contexts.length) { res.writeHead(400).end(); return; }
            const n = ++request, id = `trace_${name}_${n}`, context = contexts[n - 1];
            const usage = { input_tokens: 1, cache_read_input_tokens: n === 1 ? 0 : context - 1, cache_creation_input_tokens: n === 1 ? context - 1 : 0, output_tokens: 1,
                cache_creation: { ephemeral_5m_input_tokens: n === 1 ? context - 1 : 0, ephemeral_1h_input_tokens: 0 } };
            const send = (event, body) => res.write(`event: ${event}\ndata: ${JSON.stringify(body)}\n\n`);
            res.writeHead(200, { "content-type": "text/event-stream" });
            send("message_start", { type: "message_start", message: { id, type: "message", role: "assistant", model: "trace-fixture", content: [], stop_reason: null, stop_sequence: null, usage } });
            if (n < contexts.length) {
                send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: `tool_${n}`, name: "Read", input: {} } });
                send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify({ file_path: path.join(work, "fixture.txt") }) } });
            } else {
                send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
                send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "TRACE_DONE" } });
            }
            send("content_block_stop", { type: "content_block_stop", index: 0 });
            send("message_delta", { type: "message_delta", delta: { stop_reason: n < contexts.length ? "tool_use" : "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } });
            send("message_stop", { type: "message_stop" });
            const entry = { kind: "response", id, context };
            events.push(entry);
            fs.appendFileSync(journal, JSON.stringify(entry) + "\n");
            res.end();
        });
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const profile = `(version 1)(allow default)(deny network-outbound)(allow network-outbound (remote ip "localhost:${port}"))`;
    const probe = `import socket; socket.create_connection(("127.0.0.1",${port}),2).close(); print("loopback allowed")\ntry: socket.create_connection(("203.0.113.1",80),1); raise RuntimeError("egress allowed")\nexcept PermissionError: print("egress denied")`;
    const guard = spawnSync("/usr/bin/sandbox-exec", ["-p", profile, "/usr/bin/python3", "-c", probe], { encoding: "utf8" });
    if (guard.status !== 0 || guard.stdout !== "loopback allowed\negress denied\n") throw Error(`network guard failed: ${guard.stderr}`);
    const hooks = Object.fromEntries([["UserPromptSubmit", "prompt"], ["PostToolUse", "tool"], ["Stop", "stop"]].map(([event, mode]) => [event, [{ hooks: [{ type: "command", command: [process.execPath, path.join(here, "observe.mjs"), journal, mode].map(quote).join(" ") }] }]]));
    const settings = path.join(run, "settings.json");
    fs.writeFileSync(settings, JSON.stringify({ hooks }));
    const env = Object.fromEntries(["PATH", "HOME", "USER", "LANG", "SHELL"].filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]));
    Object.assign(env, { TMPDIR: state, CLAUDE_CONFIG_DIR: config, ANTHROPIC_API_KEY: "synthetic-loopback-only", ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
        DISABLE_AUTOUPDATER: "1", DISABLE_TELEMETRY: "1", DISABLE_ERROR_REPORTING: "1", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" });
    const args = ["-p", "Read the synthetic fixture then finish.", "--model", "trace-fixture", "--system-prompt", "Synthetic local lifecycle test.", "--setting-sources", "project", "--settings", settings,
        "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--tools", "Read", "--allowedTools", "Read", "--permission-mode", "dontAsk", "--disable-slash-commands"];
    const child = spawn("/usr/bin/sandbox-exec", ["-p", profile, binary, ...args], { cwd: work, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", data => { stdout += data; }); child.stderr.on("data", data => { stderr += data; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 45000);
    const code = await new Promise(resolve => child.on("close", resolve));
    clearTimeout(timer);
    await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(run, "stdout.txt"), stdout); fs.writeFileSync(path.join(run, "stderr.txt"), stderr);
    const trace = fs.existsSync(journal) ? fs.readFileSync(journal, "utf8").trim().split("\n").map(JSON.parse) : [];
    runs.push({ name, guard: guard.stdout.trim().split("\n"), code, completed: stdout.trim() === "TRACE_DONE", contexts, trace });
    if (code !== 0 || !stdout.includes("TRACE_DONE") || request !== 4) { fs.writeFileSync(path.join(directory, "attempt.json"), JSON.stringify({ host: host.stdout.trim(), sources, runs }, null, 2)); throw Error(`host trace incomplete: ${name}; inspect private stdout/stderr`); }
}
fs.writeFileSync(path.join(directory, "capture.json"), JSON.stringify({ schema: 1, host: host.stdout.trim(), sources, runs }, null, 2) + "\n");
process.stdout.write("Synthetic paired host trace captured.\n");
