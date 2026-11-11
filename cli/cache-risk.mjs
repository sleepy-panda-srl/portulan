// Potential cache risks from project files; host activation is not inferred.
import fs from "node:fs";
import path from "node:path";
import { readOwnedText } from "./compile.mjs";

const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const strings = v => Array.isArray(v) && v.every(s => typeof s === "string");
const scope = "Project files only; full MCP schema, trust, live activation, user/managed/CLI overrides, broader model/MCP policies and untested selectors (including experimental-beta disabling) are unassessed.";

export function cacheRiskLines(root) {
    const lines = [`Assessed selectors: project model/ANTHROPIC_MODEL (opusplan and conditional Haiku), ENABLE_TOOL_SEARCH=false and ToolSearch denial; ${scope}`];
    const read = label => {
        const file = path.join(root, label);
        try { fs.lstatSync(file); }
        catch (error) {
            if (error.code === "ENOENT") return {};
            lines.push(`${label}: unassessed — project source is unreadable.`); return {};
        }
        try {
            const value = JSON.parse(readOwnedText(file, root));
            if (!object(value)) throw Error();
            return value;
        } catch { lines.push(`${label}: unassessed — project source is unreadable, malformed, nonregular or outside its tree.`); return {}; }
    };
    const settings = label => {
        const value = read(label);
        if ((value.model !== undefined && typeof value.model !== "string") ||
            (value.env !== undefined && (!object(value.env) || ["ANTHROPIC_MODEL", "ENABLE_TOOL_SEARCH"].some(k => value.env[k] !== undefined && typeof value.env[k] !== "string"))) ||
            (value.permissions !== undefined && (!object(value.permissions) || (value.permissions.deny !== undefined && !strings(value.permissions.deny)))) ||
            ["enabledMcpjsonServers", "disabledMcpjsonServers"].some(k => value[k] !== undefined && !strings(value[k])) ||
            (value.enableAllProjectMcpServers !== undefined && typeof value.enableAllProjectMcpServers !== "boolean")) {
            lines.push(`${label}: unassessed — relevant project settings have invalid shapes.`); return {};
        }
        return value;
    };
    const shared = settings(".claude/settings.json"), local = settings(".claude/settings.local.json");
    const env = { ...shared.env, ...local.env };
    const model = env.ANTHROPIC_MODEL || (local.model ?? shared.model);
    const source = env.ANTHROPIC_MODEL ? "project ANTHROPIC_MODEL" : "project model";
    if (typeof model === "string" && /^opusplan(?:\[1m\])?$/i.test(model)) {
        lines.push(`plan-mode model switching configured via ${source}: Opus planning and Sonnet execution can rebuild the model-specific cache at the boundary.`);
    } else if (typeof model === "string" && /^(?:haiku(?:\[1m\])?|claude-haiku-[a-z0-9.-]+)$/i.test(model)) {
        lines.push(`plan-mode model upgrade possible via ${source} for a Haiku selection: a permitted Sonnet upgrade can rebuild the model-specific cache. Provider and allowlist behavior is unresolved.`);
    } else if (model === "") lines.push("project model selection is empty: resolved default and plan-mode behavior are unassessed.");
    const mcp = read(".mcp.json");
    const candidates = [];
    if (mcp.mcpServers !== undefined && !object(mcp.mcpServers)) lines.push(".mcp.json: unassessed — project MCP definitions have an invalid shape.");
    else for (const [name, server] of Object.entries(mcp.mcpServers ?? {})) {
        const stdio = object(server) && (server.type === undefined || server.type === "stdio") && typeof server.command === "string" && server.command.trim() !== "";
        let remote = false;
        if (object(server) && ["http", "sse", "ws"].includes(server.type) && typeof server.url === "string") {
            try { remote = (server.type === "ws" ? ["ws:", "wss:"] : ["http:", "https:"]).includes(new URL(server.url).protocol); } catch { /* Invalid endpoint is never printed. */ }
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(name) || (!stdio && !remote) || server.disabled !== undefined ||
            (server.args !== undefined && !strings(server.args)) || (server.env !== undefined && (!object(server.env) || !Object.values(server.env).every(v => typeof v === "string")))) {
            lines.push(".mcp.json: unassessed — a project MCP definition is unsupported or invalid.");
        } else candidates.push(name);
    }
    const rejected = new Set([...(shared.disabledMcpjsonServers ?? []), ...(local.disabledMcpjsonServers ?? [])]);
    const approved = new Set([...(shared.enabledMcpjsonServers ?? []), ...(local.enabledMcpjsonServers ?? [])]);
    const all = local.enableAllProjectMcpServers ?? shared.enableAllProjectMcpServers ?? false;
    const eligible = candidates.filter(name => !rejected.has(name));
    const denial = [...(shared.permissions?.deny ?? []), ...(local.permissions?.deny ?? [])].includes("ToolSearch");
    if (eligible.length && (env.ENABLE_TOOL_SEARCH === "false" || denial)) {
        const known = eligible.filter(name => all || approved.has(name)).length;
        lines.push(`tool search disabled by ${denial ? "project ToolSearch denial" : "project ENABLE_TOOL_SEARCH=false"}: ${eligible.length} eligible project MCP candidate(s), ${known} with project-file approval; upfront tool definitions can enlarge or change the cache prefix.`);
    }
    return lines;
}
