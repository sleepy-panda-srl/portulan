// Native admission limits do not count lifetime contexts or spend.
import fs from "node:fs";
import path from "node:path";
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
export function capOnlyPlan(root, cap) {
    const file = path.join(root, ".claude/settings.json");
    const parent = path.dirname(file);
    if (fs.existsSync(parent) && (!fs.lstatSync(parent).isDirectory() || fs.lstatSync(parent).isSymbolicLink())) {
        if (cap.limit === null) return null;
        throw Error("cap-only settings parent is not an owned directory");
    }
    let current = null, old = null, links = 1;
    try {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink()) {
            if (cap.limit === null) return null;
            throw Error("cap-only settings is not a regular owned file");
        }
        links = stat.nlink;
        current = fs.readFileSync(file, "utf8");
        try { old = JSON.parse(current); } catch { /* foreign */ }
    } catch (e) { if (e.code !== "ENOENT") throw e; }
    const marked = old?.$portulan?.generated === "cli/compile.mjs" && old.$portulan.kind === "ritual-contexts";
    if (links !== 1 && (cap.limit !== null || marked)) throw Error("cap-only settings is multiply linked; refusing replacement or removal");
    if (cap.limit === null && !marked && old?.$portulan?.generated === "cli/compile.mjs" && Object.hasOwn(old?.env ?? {}, CONTEXT_CAP_ENV)) throw Error("previous policy-generated settings retain a stale context cap after policy removal; preserve and resolve those settings explicitly, or restore the policy and recompile");
    const owned = marked && Object.keys(old.$portulan).every(k => ["generated", "kind", "sources"].includes(k)) && object(old.env) && Object.keys(old).every(k => ["$portulan", "env"].includes(k)) && Object.keys(old.env).every(k => k === CONTEXT_CAP_ENV);
    if (current !== null && !owned && (cap.limit !== null || marked)) throw Error("cap-only compile refuses settings with unrelated or unowned content; preserve it and resolve ownership explicitly");
    if (cap.limit === null && !owned) return null;
    const value = cap.limit === null ? null : {
        $portulan: { generated: "cli/compile.mjs", kind: "ritual-contexts", sources: cap.sources },
        env: { [CONTEXT_CAP_ENV]: String(cap.limit) },
    };
    return { file, current, text: value === null ? null : JSON.stringify(value, null, 2) + "\n" };
}
export function emitCapOnly(plan, { check, say }) {
    if (!plan || plan.current === plan.text) return 0;
    if (check) { say("RED — cap-only Claude settings drifted; recompile"); return 1; }
    if (plan.text === null) { fs.rmSync(plan.file); say(`removed ${plan.file} — no ritual cap remains`); }
    else { fs.mkdirSync(path.dirname(plan.file), { recursive: true }); fs.writeFileSync(plan.file, plan.text); say(`wrote ${plan.file}`); }
    return 0;
}
