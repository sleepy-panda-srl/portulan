// Own native settings without inventing a gate policy.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
export const CONTEXT_CAP_ENV = "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS";
const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
export function readContextCap(manifest, pack) {
    const c = manifest?.contributes?.contexts;
    if (c === undefined) return null;
    const bad = why => { throw Error(`\`${pack}\` contributes.contexts ${why}`); };
    if (manifest.category !== "rituals" || !pack.startsWith("rituals/")) bad("is reserved for ritual packs");
    if (manifest?.portulan?.pack !== "1.1") bad("requires supported Pack Definition 1.1");
    if (!object(c) || Object.keys(c).length !== 1 || !Object.hasOwn(c, "max_concurrent_subagents")) bad("requires only max_concurrent_subagents");
    const n = c.max_concurrent_subagents;
    if (!Number.isSafeInteger(n) || n < 1) bad("max_concurrent_subagents must be a positive safe integer");
    return n;
}
export function contextCaps(contributions, unresolved = []) {
    const sources = contributions.filter(c => c.contextCap != null).map(c => {
        if (!Number.isSafeInteger(c.contextCap) || c.contextCap < 1) throw Error("invalid contributes.contexts count");
        return { pack: c.pack, limit: c.contextCap, origin: c.origin ?? null, version: c.version ?? null };
    }).sort((a, b) => a.pack.localeCompare(b.pack));
    if (sources.length && unresolved.length) throw Error("ritual contexts cap cannot compile while composed packs remain unresolved; their contributions are unknown");
    return { limit: sources.length ? sources.reduce((n, s) => Math.min(n, s.limit), Infinity) : null, sources, unknown: unresolved.length };
}
export function contextCapLines(cap) {
    if (cap.limit === null) return cap.unknown ? ["No context cap found in resolved packs; unresolved pack contributions are unknown."] : [];
    return [
        `Claude Code: ${CONTEXT_CAP_ENV}=${cap.limit}, minimum of ${cap.sources.map(s => `${s.pack}=${s.limit}`).join(", ")}; compiled for ordinary fresh native Agent admission within one session.`,
        "Parent excluded; project setting applies across rituals. Total children, requests, time and tokens are unbounded. Resumes and /subtask forks can exceed the admission limit; workflows/team agents have independent limits. Higher-precedence settings and native experimental/ultracode bypasses can defeat it. Measured on Claude Code 2.1.321; not a universal hard ceiling.",
        "GitHub repository ruleset and AGENTS guidance: context cap not compiled by these adapters.",
    ];
}
const keys = (v, required, optional = []) => object(v) && required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => [...required, ...optional].includes(k));
const canonical = v => Array.isArray(v) ? v.map(canonical) : object(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const fingerprint = v => {
    const payload = structuredClone(v); delete payload.$portulan.digest;
    return createHash("sha256").update(JSON.stringify(canonical(payload))).digest("hex");
};
const sourcesValid = sources => Array.isArray(sources) && sources.length > 0 && sources.every((s, i) =>
    keys(s, ["pack", "limit", "origin", "version"]) && /^rituals\/[a-z0-9][a-z0-9-]*$/.test(s.pack) && Number.isSafeInteger(s.limit) && s.limit > 0 &&
    [null, "tree", "outside-tree", "discovered"].includes(s.origin) && (s.version === null || typeof s.version === "string") &&
    (i === 0 || sources[i - 1].pack.localeCompare(s.pack) < 0));
const capValid = (env, sources) => keys(env, [CONTEXT_CAP_ENV]) && sourcesValid(sources) && env[CONTEXT_CAP_ENV] === String(Math.min(...sources.map(s => s.limit)));
const commandValid = (v, action) => keys(v, ["type", "command"]) && v.type === "command" && typeof v.command === "string" && new RegExp(String.raw`^node "[^"\r\n]+[/\\]advisory\.mjs" ${action}(?: --(?:read|write-5m|write-1h|horizon|resume-tokens) [0-9.eE+-]+)*$`).test(v.command);
const hookValid = (v, action) => Array.isArray(v) && v.length === 1 && keys(v[0], ["hooks"]) && Array.isArray(v[0].hooks) && v[0].hooks.length === 1 && commandValid(v[0].hooks[0], action);
function adviceOwned(v) {
    const m = v?.$portulan;
    return keys(v, ["$portulan", "hooks", "statusLine"], ["includeGitInstructions", "promptCacheTtl", "env"]) &&
        keys(m, ["generated", "kind", "digest", "source", "warning"], ["sessions", "spend", "packs", "contexts"]) &&
        m.generated === "cli/compile.mjs" && m.kind === "advisory" && /^[a-f0-9]{64}$/.test(m.digest) && m.digest === fingerprint(v) &&
        typeof m.source === "string" && !path.isAbsolute(m.source) && !m.source.split("/").includes("..") && /(?:^|\/)workspace\.json$/.test(m.source) && typeof m.warning === "string" &&
        ["sessions", "spend"].every(k => !Object.hasOwn(m, k) || m[k] === m.source) &&
        (!Object.hasOwn(m, "packs") || (Array.isArray(m.packs) && m.packs.length > 0 && m.packs.every((p, i) => keys(p, ["pack", "origin", "version"]) && typeof p.pack === "string" && ["tree", "outside-tree", "discovered"].includes(p.origin) && (p.version === null || typeof p.version === "string") && (i === 0 || m.packs[i - 1].pack.localeCompare(p.pack) < 0)))) &&
        (!Object.hasOwn(v, "includeGitInstructions") || typeof v.includeGitInstructions === "boolean") && (!Object.hasOwn(v, "promptCacheTtl") || ["5m", "1h"].includes(v.promptCacheTtl)) &&
        (Object.hasOwn(v, "env") ? capValid(v.env, m.contexts) : !Object.hasOwn(m, "contexts")) &&
        keys(v.hooks, ["PostToolUse", "UserPromptSubmit"], ["Stop"]) && hookValid(v.hooks.PostToolUse, "tool") && hookValid(v.hooks.UserPromptSubmit, "prompt") &&
        (!Object.hasOwn(v.hooks, "Stop") || hookValid(v.hooks.Stop, "stop")) && commandValid(v.statusLine, "status");
}
export function capOnlyPlan(root, cap, advice = null) {
    const file = path.join(root, ".claude/settings.json");
    const parent = path.dirname(file), desired = advice !== null || cap.limit !== null;
    let parentStat;
    try { parentStat = fs.lstatSync(parent); } catch (e) { if (e.code !== "ENOENT") throw e; }
    if (parentStat && (!parentStat.isDirectory() || parentStat.isSymbolicLink())) {
        if (!desired) return null;
        throw Error("native settings parent is not an owned directory");
    }
    let current = null, old = null, links = 1;
    try {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink()) {
            if (!desired) return null;
            throw Error("native settings is not a regular owned file");
        }
        links = stat.nlink;
        current = fs.readFileSync(file, "utf8");
        try { old = JSON.parse(current); } catch { /* foreign */ }
    } catch (e) { if (e.code !== "ENOENT") throw e; }
    const generated = old?.$portulan?.generated === "cli/compile.mjs";
    const marked = generated && old.$portulan.kind === "ritual-contexts";
    const advisory = generated && old.$portulan.kind === "advisory";
    if (advisory && advice === null) return null;
    if (links !== 1 && (desired || marked)) throw Error("native settings is multiply linked; refusing replacement or removal");
    if (cap.limit === null && !marked && !advisory && generated && Object.hasOwn(old?.env ?? {}, CONTEXT_CAP_ENV)) throw Error("previous policy-generated settings retain a stale context cap after policy removal; preserve and resolve those settings explicitly, or restore the policy and recompile");
    const legacy = marked && keys(old, ["$portulan", "env"]) && keys(old.$portulan, ["generated", "kind", "sources"]) && capValid(old.env, old.$portulan.sources);
    const owned = legacy || (advisory && adviceOwned(old));
    if (current !== null && !owned && (desired || marked)) throw Error("native compile refuses settings with edited, unrelated or unowned content; preserve it and resolve ownership explicitly");
    if (!desired && !owned) return null;
    const value = advice !== null ? structuredClone(advice) : cap.limit === null ? null : {
        $portulan: { generated: "cli/compile.mjs", kind: "ritual-contexts", sources: cap.sources },
        env: { [CONTEXT_CAP_ENV]: String(cap.limit) },
    };
    if (advice !== null) { value.$portulan.kind = "advisory"; value.$portulan.digest = fingerprint(value); }
    return { file, current, text: value === null ? null : JSON.stringify(value, null, 2) + "\n" };
}
export function emitCapOnly(plan, { check, say }) {
    if (!plan || plan.current === plan.text) return 0;
    if (check) { say("RED — native Claude settings drifted; recompile"); return 1; }
    if (plan.text === null) { fs.rmSync(plan.file); say(`removed ${plan.file} — no ritual cap remains`); }
    else { fs.mkdirSync(path.dirname(plan.file), { recursive: true }); fs.writeFileSync(plan.file, plan.text); say(`wrote ${plan.file}`); }
    return 0;
}
