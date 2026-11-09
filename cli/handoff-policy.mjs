// Handoff caps and windows.
import { declaredContext } from "./context.mjs";

export class HandoffError extends Error {}

const object = (value, where, keys) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new HandoffError(`${where} must be an object`);
    for (const key of Object.keys(value)) if (!keys.includes(key)) throw new HandoffError(`${where}.${key} is not a handoff setting`);
    return value;
};
const positive = (value, where) => {
    if (!Number.isSafeInteger(value) || value <= 0) throw new HandoffError(`${where} must be a positive integer`);
    return value;
};

export function realHandoffDay(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const at = new Date(0);
    const [y, m, d] = value.split("-").map(Number);
    at.setUTCFullYear(y, m - 1, d);
    return at.toISOString().slice(0, 10) === value;
}

export function handoffPolicy(workspace) {
    let cap = null, cutoff = null, window = null;
    if (workspace.handoffs !== undefined) {
        const handoffs = object(workspace.handoffs, "handoffs", ["series", "index"]);
        if (handoffs.series !== undefined) {
            const series = object(handoffs.series, "handoffs.series", ["budget"]);
            const budget = object(series.budget, "handoffs.series.budget", ["record_tokens", "cutoff"]);
            cap = positive(budget.record_tokens, "handoffs.series.budget.record_tokens");
            cutoff = budget.cutoff;
            if (!realHandoffDay(cutoff)) throw new HandoffError("handoffs.series.budget.cutoff must be a real day written YYYY-MM-DD");
        }
        if (handoffs.index !== undefined) {
            const index = object(handoffs.index, "handoffs.index", ["path", "budget"]);
            if (typeof index.path !== "string" || !index.path) throw new HandoffError("handoffs.index.path must name the generated index");
            if (index.budget !== undefined) window = positive(object(index.budget, "handoffs.index.budget", ["tokens"]).tokens, "handoffs.index.budget.tokens");
        }
    }
    if (cap === null && window === null) return { cap, cutoff, window, ratio: null };
    if (!/^2\.(?:15|1[6-9]|[2-9]\d|\d{3,})$/.test(workspace.portulan?.spec ?? "")) throw new HandoffError("handoff budgets require Workspace Definition 2.15 or later");
    if (!workspace.slots?.handoffs) throw new HandoffError("handoff budgets require slots.handoffs");
    let ratio;
    try { ratio = declaredContext(workspace).ratio; }
    catch (error) { throw new HandoffError(error.message); }
    if (ratio === null) throw new HandoffError("handoff budgets require an explicit context.ratio to count tokens by");
    return { cap, cutoff, window, ratio };
}

export const handoffTokens = (bytes, ratio) => Math.round(bytes / ratio);

export function handoffOverages(series, policy) {
    const bound = [], historical = [];
    if (policy.cap !== null) for (const record of series.records) {
        const tokens = handoffTokens(record.bytes, policy.ratio);
        if (tokens > policy.cap) (record.date > policy.cutoff ? bound : historical).push({ ...record, tokens });
    }
    return { bound, historical };
}

export const HANDOFF_OFFER = "Handoffs: offer 3000 tokens per new handoff and 3000 for the index window, independently optional. Supply a measured ratio; its provenance is not proof of host calibration. Decline leaves both undeclared.";

export function handoffOffer(raw, { today = new Date().toISOString().slice(0, 10), newest = today } = {}) {
    if (raw === undefined || raw === null || raw === "none") return null;
    let value;
    try { value = typeof raw === "string" ? JSON.parse(raw) : raw; }
    catch { throw new HandoffError("handoff-budget must be JSON or `none`"); }
    object(value, "handoff-budget", ["record_tokens", "index_tokens", "ratio"]);
    if (value.record_tokens === undefined && value.index_tokens === undefined) throw new HandoffError("handoff-budget must accept record_tokens, index_tokens, or both");
    const manifest = { portulan: { spec: "2.15" }, slots: { handoffs: "handoffs/" }, context: { ratio: value.ratio }, handoffs: { index: { path: "handoffs-index.md" } } };
    if (value.record_tokens !== undefined) manifest.handoffs.series = { budget: { record_tokens: value.record_tokens, cutoff: newest > today ? newest : today } };
    if (value.index_tokens !== undefined) manifest.handoffs.index.budget = { tokens: value.index_tokens };
    handoffPolicy(manifest);
    return { context: manifest.context, handoffs: manifest.handoffs };
}
