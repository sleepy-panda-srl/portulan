// Manual synthetic native-host acquisition; never imported by offline checks.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { run as compile } from "../../compile.mjs";
import { collect, tally } from "../../ledger.mjs";
if (process.env.CI || process.argv.length !== 3) throw Error("manual only: capture.mjs <new private directory>");
const output = path.resolve(process.argv[2]);
fs.mkdirSync(output, { recursive: false, mode: 0o700 });
const here = path.dirname(fileURLToPath(import.meta.url));
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const sources = Object.fromEntries(["capture.mjs", "../../ritual-contexts.mjs", "../../compile.mjs", "../../ledger.mjs"].map(p => [p, hash(path.join(here, p))]));
const binary = "/opt/homebrew/bin/claude";
const version = spawnSync(binary, ["--version"], { encoding: "utf8" });
if (version.status !== 0) throw Error("host unavailable");
const runs = [];
for (const [name, declared, effective] of [["one", 1, 1], ["two", 2, 2], ["removed", 1, null], ["lowered", 2, 1]]) {
    const dir = path.join(output, name); fs.mkdirSync(dir);
    const config = path.join(dir, "config"); fs.mkdirSync(config);
    const work = fs.mkdtempSync("/private/tmp/portulan-cap-trace-");
    const write = (rel, data) => { const f = path.join(work, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data)); };
    write(".portulan/workspace.json", { portulan: { spec: "2.0" }, tree: "../", packs: ["rituals/fixture"] });
    write("packs/rituals/fixture/pack.json", { portulan: { pack: "1.1" }, category: "rituals", name: "fixture", contributes: { contexts: { max_concurrent_subagents: declared } } });
    if (compile(["--workspace", work + "/.portulan", "--pack-root", work + "/packs"], { quiet: true }) !== 0) throw Error("fixture compile failed");
    const settingsFile = work + "/.claude/settings.json";
    const settings = JSON.parse(fs.readFileSync(settingsFile));
    if (settings.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS !== String(declared)) throw Error("compile mismatch");
    if (effective === null) delete settings.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS;
    else settings.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS = String(effective);
    fs.writeFileSync(settingsFile, JSON.stringify(settings));
    fs.copyFileSync(settingsFile, path.join(dir, "settings.json"));
    const trace = []; let active = 0, peak = 0, parent = 0, children = 0, refusals = 0, response = 0, replacement = false;
    const acceptedIds = new Set(), refusedIds = new Set();
    const tool = (id, marker) => ({ type: "tool_use", id, name: "Agent", input: { description: "Synthetic admission trace", prompt: marker, subagent_type: "cap-worker" } });
    const server = http.createServer((req, res) => {
        let body = ""; req.on("data", b => body += b); req.on("end", () => {
            if (!req.url.startsWith("/v1/messages")) { res.writeHead(400).end(); return; }
            const payload = JSON.parse(body);
            fs.appendFileSync(path.join(dir, "backend.jsonl"), body + "\n");
            const lastUser = payload.messages.filter(m => m.role === "user").at(-1);
            const child = typeof lastUser?.content === "string" && /^CAP_CHILD_[AB]$/.test(lastUser.content) ? lastUser.content : null;
            const id = `cap_${name}_response_${++response}`;
            const send = content => {
                const usage = { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 };
                const event = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
                res.writeHead(200, { "content-type": "text/event-stream" });
                event("message_start", { type: "message_start", message: { id, type: "message", role: "assistant", model: "trace-fixture", content: [], stop_reason: null, stop_sequence: null, usage } });
                for (const [index, block] of content.entries()) {
                    event("content_block_start", { type: "content_block_start", index, content_block: block.type === "tool_use" ? { ...block, input: {} } : { type: "text", text: "" } });
                    event("content_block_delta", { type: "content_block_delta", index, delta: block.type === "tool_use" ? { type: "input_json_delta", partial_json: JSON.stringify(block.input) } : { type: "text_delta", text: block.text } });
                    event("content_block_stop", { type: "content_block_stop", index });
                }
                event("message_delta", { type: "message_delta", delta: { stop_reason: content.some(b => b.type === "tool_use") ? "tool_use" : "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } });
                event("message_stop", { type: "message_stop" }); res.end();
            };
            if (child) {
                const index = ++children; active++; peak = Math.max(peak, active); trace.push({ kind: "start", child: index, active });
                setTimeout(() => { active--; trace.push({ kind: "end", child: index, active }); send([{ type: "text", text: "CAP_CHILD_DONE" }]); }, 900);
            } else {
                parent++;
                const results = payload.messages.flatMap(m => Array.isArray(m.content) ? m.content.filter(b => b.type === "tool_result") : []);
                for (const r of results) {
                    if (JSON.stringify(r).includes("Concurrent subagent limit reached")) refusedIds.add(r.tool_use_id);
                    if (JSON.stringify(r).includes("Async agent launched successfully")) acceptedIds.add(r.tool_use_id);
                }
                refusals = refusedIds.size;
                trace.push({ kind: "parent", step: parent, refusals });
                if (parent === 1) send([tool("cap_a", "CAP_CHILD_A"), tool("cap_b", "CAP_CHILD_B")]);
                else {
                    const afterChildren = callback => { const poll = () => active ? setTimeout(poll, 25) : setTimeout(callback, 300); poll(); };
                    if (refusals === 1 && !replacement) { replacement = true; afterChildren(() => send([tool("cap_sequential", "CAP_CHILD_B")])); }
                    else afterChildren(() => send([{ type: "text", text: "CAP_TRACE_DONE" }]));
                }
            }
        });
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const profile = `(version 1)(allow default)(deny network-outbound)(allow network-outbound (remote ip "localhost:${port}"))`;
    const probe = `import socket; socket.create_connection(("127.0.0.1",${port}),2).close(); print("loopback allowed")\ntry: socket.create_connection(("203.0.113.1",80),1); raise RuntimeError("egress allowed")\nexcept PermissionError: print("egress denied")`;
    const guard = spawnSync("/usr/bin/sandbox-exec", ["-p", profile, "/usr/bin/python3", "-c", probe], { encoding: "utf8" });
    if (guard.status !== 0 || guard.stdout !== "loopback allowed\negress denied\n") throw Error("network guard failed");
    const env = Object.fromEntries(["PATH", "HOME", "USER", "LANG", "SHELL"].filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]));
    Object.assign(env, { CLAUDE_CONFIG_DIR: config, ANTHROPIC_API_KEY: "synthetic-loopback-only", ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`, DISABLE_AUTOUPDATER: "1", DISABLE_TELEMETRY: "1", DISABLE_ERROR_REPORTING: "1", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" });
    if (Object.hasOwn(env, "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS")) throw Error("cap must come from compiled project settings");
    const args = ["-p", "CAP_PARENT", "--model", "trace-fixture", "--system-prompt", "Synthetic local admission trace.", "--setting-sources", "project", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--tools", "Agent", "--allowedTools", "Agent", "--agents", JSON.stringify({ "cap-worker": { description: "Synthetic test worker", prompt: "Return CAP_CHILD_DONE", tools: [] } }), "--permission-mode", "dontAsk", "--disable-slash-commands"];
    const childProcess = spawn("/usr/bin/sandbox-exec", ["-p", profile, binary, ...args], { cwd: work, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = ""; childProcess.stdout.on("data", b => stdout += b); childProcess.stderr.on("data", b => stderr += b);
    const timer = setTimeout(() => childProcess.kill("SIGKILL"), 45000);
    const code = await new Promise(resolve => childProcess.on("close", resolve)); clearTimeout(timer);
    await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(dir, "stdout.txt"), stdout); fs.writeFileSync(path.join(dir, "stderr.txt"), stderr);
    const collected = collect({ projects: config + "/projects", roots: [work] });
    const branches = [...new Set(collected.contexts.flatMap(c => c.requests.map(r => r.branch)))];
    const figures = branches.length === 1 ? tally(collected.contexts, branches[0]) : null;
    const result = { name, declared, effective, guard: guard.stdout.trim().split("\n"), code, completed: /^(CAP_TRACE_DONE\s*)+$/.test(stdout.trim()), peak, children, refusals, accepted: acceptedIds.size, parentRequests: parent, ledger: figures ? { sessions: figures.sessions, children: figures.subagentContexts, requests: figures.total.requests } : null, trace };
    runs.push(result); fs.writeFileSync(path.join(output, "capture.json"), JSON.stringify({ schema: 1, host: version.stdout.trim(), sources, runs }, null, 2) + "\n");
    fs.rmSync(work, { recursive: true, force: true });
    if (code !== 0 || !result.completed || children !== 2 || peak !== (effective === 1 ? 1 : 2) || refusals !== (effective === 1 ? 1 : 0) || figures?.sessions !== 1 || figures?.subagentContexts !== 2) throw Error(`incomplete trace ${name}; inspect only this private acquisition directory`);
}
process.stdout.write(`Captured ${runs.length} isolated admission controls; no real provider.\n`);
