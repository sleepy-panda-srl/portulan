import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const [root, trace] = process.argv.slice(2);
const id = process.pid;
const append = (row) => fs.appendFileSync(trace, `${JSON.stringify(row)}\n`);
append({ type: "start", id });
try {
    const input = JSON.parse(fs.readFileSync(0, "utf8"));
    const relative = (file) => {
        if (!file) return null;
        const rel = path.relative(root, path.resolve(root, file));
        return rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel) ? "<outside>" : rel.split(path.sep).join("/");
    };
    const event = { type: "event", id, event: input.hook_event_name, session: input.session_id };
    if (input.hook_event_name === "InstructionsLoaded") Object.assign(event, {
        file: relative(input.file_path), reason: input.load_reason, memoryType: input.memory_type,
        globs: input.globs ?? [], trigger: relative(input.trigger_file_path),
    });
    if (["PreToolUse", "PostToolUse"].includes(input.hook_event_name)) {
        event.tool = input.tool_name;
        event.file = relative(input.tool_input?.file_path);
        event.unexpected = input.tool_name !== "Read" || !["docs/control.txt", "api/orders.txt"].includes(event.file);
        if (event.unexpected && input.hook_event_name === "PreToolUse") process.stdout.write(JSON.stringify({ hookSpecificOutput: {
            hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "Only the two fixture probe files may be read.",
        } }));
    }
    if (input.hook_event_name === "UserPromptSubmit") event.promptSha256 = createHash("sha256").update(input.prompt ?? "").digest("hex");
    event.outside = event.file === "<outside>" || event.trigger === "<outside>";
    append(event);
} catch {
    append({ type: "observer-error", id });
    process.exitCode = 1;
} finally {
    append({ type: "done", id });
}
