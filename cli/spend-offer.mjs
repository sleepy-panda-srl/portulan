// Local evidence for init's optional spend declaration.
import fs from "node:fs";
import path from "node:path";
import { GENERAL_READ, WRITE_BY_LIFETIME, HORIZON, hostPaths, transcriptFiles, readSpend } from "./ledger.mjs";
import { isInside } from "./inside.mjs";

export const PRICE_DATE = "2026-11-09";
export const PRICE_SOURCE = "https://platform.claude.com/docs/en/about-claude/pricing";
export const PRICE_READS = {
    "claude-fable-5-2": 0.025, "claude-mythos-5-2": 0.025,
    "claude-fable-5-1": 0.025, "claude-mythos-5-1": 0.025,
    "claude-opus-5-5": 0.05, "claude-sonnet-5-5": 0.05,
    "claude-haiku-5-5": 0.1, "claude-fable-5": 0.1, "claude-mythos-5": 0.1,
    "claude-opus-5": 0.1, "claude-sonnet-5": 0.1,
    "claude-opus-4-8": 0.1, "claude-opus-4-7": 0.1, "claude-opus-4-6": 0.1,
    "claude-opus-4-5": 0.1, "claude-opus-4-1": 0.1, "claude-opus-4": 0.1,
    "claude-sonnet-4-6": 0.1, "claude-sonnet-4-5": 0.1, "claude-sonnet-4": 0.1,
    "claude-haiku-4-5": 0.1,
};

export function recordedModel(target, projects) {
    let latest = -Infinity;
    const models = new Set();
    let malformed = 0;
    try {
        for (const { file, agent } of transcriptFiles(projects, [target])) {
            if (agent !== null) continue;
            for (const line of fs.readFileSync(file, "utf8").split("\n")) {
                if (!line.trim()) continue;
                let r;
                try { r = JSON.parse(line); } catch { malformed++; continue; }
                if (r?.type !== "assistant" || r.isSidechain || r.agentId || !r.message?.usage || typeof r.message.usage !== "object" || Array.isArray(r.message.usage) || r.message.model === "<synthetic>" || typeof r.timestamp !== "string" || typeof r.cwd !== "string" || !path.isAbsolute(r.cwd) || !isInside(target, r.cwd)) continue;
                const at = Date.parse(r.timestamp);
                if (!Number.isFinite(at) || at < latest) continue;
                if (at > latest) { latest = at; models.clear(); }
                models.add(typeof r.message.model === "string" && r.message.model ? r.message.model : null);
            }
        }
    } catch (error) {
        return { model: null, reason: `recorded model could not be read (${error.code ?? "unreadable"})` };
    }
    const model = models.size === 1 ? [...models][0] : null;
    const reason = model === null ? (models.size > 1 ? "conflicting latest recorded models" : "no recorded model") : `last recorded model ${JSON.stringify(model)}`;
    return { model, reason: reason + (malformed ? `; ignored ${malformed} malformed record(s)` : "") };
}

export function managedPricingFile(platform = process.platform) {
    if (platform === "darwin") return "/Library/Application Support/ClaudeCode/managed-settings.json";
    if (platform === "win32") return "C:\\Program Files\\ClaudeCode\\managed-settings.json";
    return "/etc/claude-code/managed-settings.json";
}

function hostMultipliers(model, canonical, file) {
    if (file === null) return { reason: "file-based managed pricing not supplied" };
    try {
        const dropins = path.join(path.dirname(file), "managed-settings.d");
        if (fs.existsSync(dropins) && fs.readdirSync(dropins).some(name => name.endsWith(".json"))) return { reason: "managed-settings.d may supersede file pricing; drop-ins are not resolved" };
        if (!fs.statSync(file).isFile()) return { reason: "managed pricing is not a regular file" };
        const pricing = JSON.parse(fs.readFileSync(file, "utf8"))?.modelPricing;
        const overrides = pricing?.overrides;
        if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return { reason: "no file-based modelPricing override" };
        const row = Object.hasOwn(overrides, model) ? overrides[model] : canonical !== null && Object.hasOwn(overrides, canonical) ? overrides[canonical] : null;
        if (row === null) return { reason: "no matching file-based modelPricing override" };
        if (!row || ["input", "output", "cacheRead", "cacheWrite"].some(key => typeof row[key] !== "number" || !Number.isFinite(row[key]) || row[key] < 0 || row[key] > 10000)) return { reason: "invalid file-based modelPricing override" };
        try {
            const multipliers = { read: row.cacheRead / row.input, write: { "5m": row.cacheWrite / row.input, "1h": row.cacheWrite / row.input } };
            readSpend({ multipliers }, "host offer");
            return { multipliers };
        } catch { return { reason: "file-based modelPricing override is unrepresentable by spend" }; }
    } catch (error) {
        return { reason: error.code === "ENOENT" ? "no file-based managed pricing" : `file-based managed pricing unreadable (${error.code ?? "invalid JSON"})` };
    }
}

export function spendOffer(target, options = {}) {
    const paths = hostPaths(options.env, options.home);
    const recorded = options.projects !== undefined ? recordedModel(target, options.projects) : paths.why ? { model: null, reason: "host record path is not absolute" } : recordedModel(target, paths.projects);
    const { model } = recorded;
    const normalized = model?.replace(/-\d{8}$/, "");
    const canonical = normalized && Object.hasOwn(PRICE_READS, normalized) ? normalized : null;
    const host = model === null ? { reason: "host pricing needs a recorded model" } : hostMultipliers(model, canonical, options.managedFile === undefined ? managedPricingFile(options.platform) : options.managedFile);
    const source = host.multipliers ? "file-based managed modelPricing (conditional on this file being active)" : canonical !== null ? `Claude Code table ${PRICE_DATE}, ${PRICE_SOURCE}` : "general multipliers";
    const multipliers = host.multipliers ?? { read: canonical === null ? GENERAL_READ : PRICE_READS[canonical], write: { ...WRITE_BY_LIFETIME } };
    return { multipliers, horizon: HORIZON, source, reason: `${recorded.reason}; ${host.reason ?? "one cacheWrite rate supplies both lifetimes; a global multiplier cancels"}` };
}

export function spendOfferLines(offer) {
    return [
        `spend.multipliers offer ${JSON.stringify(offer.multipliers)} — ${offer.source}; ${offer.reason}`,
        `spend.horizon offer {"requests":${offer.horizon}} — requests still to go, not requests already used; choose a task's expected remainder`,
        "Only accepted answers or explicit --multipliers '<JSON>' / --horizon <requests> declare these at spec 2.12. Remote, MDM/registry, helper and embedding-host pricing are not inspected; other providers and unsupported model IDs use general figures. Confirm against your rates and next model.",
    ];
}
