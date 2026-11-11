// Called by the real host; retain only completed request IDs and production hook output.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readLine } from "../../ledger.mjs";

const [journal, mode] = process.argv.slice(2);
const input = fs.readFileSync(0, "utf8");
const payload = JSON.parse(input);
const visible = [];
if (fs.existsSync(payload.transcript_path)) {
    for (const line of fs.readFileSync(payload.transcript_path, "utf8").split("\n").slice(0, -1)) {
        const r = readLine(line)?.request;
        if (r && !r.sidechain && !r.synthetic && !visible.includes(r.id)) visible.push(r.id);
    }
}
const stdout = execFileSync(process.execPath, [fileURLToPath(new URL("../../advisory.mjs", import.meta.url)), mode, "--horizon", "20", "--resume-tokens", "0"], { input, encoding: "utf8" });
fs.appendFileSync(journal, JSON.stringify({ kind: "hook", event: payload.hook_event_name, visible, output: stdout.trim() ? JSON.parse(stdout) : null }) + "\n");
process.stdout.write(stdout);
