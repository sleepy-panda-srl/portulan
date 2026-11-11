// Class indices compare stated assumptions, never bills or route quality.
import { CLASSES, GENERAL_READ, WRITE_BY_LIFETIME, RECORDED_ROLES, SPEND_FIGURES, restartSaving } from "./ledger.mjs";

const classes = ["uncached", "written", "read", "output"];
const efforts = ["low", "medium", "high", "max"];
const families = ["opus", "sonnet", "haiku", "fable", "mythos"];
const causes = ["compaction", "model change", "effort change", "lifetime lapsed", "unexplained"];
const grouped = n => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const estimate = n => n.toLocaleString("en-US", { maximumSignificantDigits: 8 });
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const count = n => Number.isSafeInteger(n) && n >= 0;
const leaders = scores => {
    const max = Math.max(...Object.values(scores));
    return max <= 0 ? [] : classes.filter(k => Math.abs(scores[k] - max) <= max * Number.EPSILON * 8);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function scopeLines(label, contexts, rates) {
    const total = Object.fromEntries(CLASSES.map(k => [k, 0]));
    const roles = new Map(), inferred = Object.fromEntries(causes.map(k => [k, 0]));
    let contributing = 0, requests = 0;
    try {
        for (const c of contexts) {
            if (c.requests.length) contributing++;
            for (const r of c.requests) {
                if (r.usageMissing || r.usageUnsafe) return [`${label}: class analysis unassessed — usage counters are missing or invalid; totals are partial.`];
                requests++;
                for (const k of CLASSES) {
                    if (!count(r[k]) || !count(total[k] + r[k])) throw Error();
                    total[k] += r[k];
                }
                if (r.rebuild) inferred[causes.includes(r.rebuild.cause) ? r.rebuild.cause : "unexplained"]++;
                const role = RECORDED_ROLES.includes(r.role) ? r.role : c.agent === null ? "main" : "unattributed subagent";
                if (!roles.has(role)) roles.set(role, { output: 0, efforts: {}, models: {} });
                const into = roles.get(role), effort = efforts.includes(r.effort) ? r.effort : "unknown";
                const family = families.find(f => typeof r.model === "string" && new RegExp(`^(?:claude-)?${f}(?:-|$)`).test(r.model)) ?? "unknown";
                into.output += r.output;
                into.efforts[effort] = (into.efforts[effort] ?? 0) + r.output;
                into.models[family] = (into.models[family] ?? 0) + r.output;
            }
        }
        if (!requests) return [`${label}: no host requests in this scope; local receipts excluded.`];
        const written = total.written1h + total.written5m + total.writtenUnknown;
        if (!count(written)) throw Error();
        const knownWrites = total.written1h * rates.write["1h"] + total.written5m * rates.write["5m"];
        const low = { uncached: total.uncached, written: knownWrites + total.writtenUnknown * Math.min(...Object.values(rates.write)), read: total.read * rates.read, output: total.output * 5 };
        const high = { ...low, written: knownWrites + total.writtenUnknown * Math.max(...Object.values(rates.write)) };
        if (![...Object.values(low), ...Object.values(high)].every(Number.isFinite)) throw Error();
        const first = leaders(low), last = leaders(high), certain = same(first, last);
        const index = classes.map(k => `${k} ~${estimate(low[k])}${low[k] === high[k] ? "" : `..${estimate(high[k])}`}`).join(", ");
        const verdict = certain ? first.length ? `dominant ${first.join(" + ")}${first.length > 1 ? " (tie)" : ""}` : "no nonzero dominant class"
            : `uncertain dominance (lower-bound leaders ${first.join(" + ")}; upper-bound leaders ${last.join(" + ")})`;
        const lines = [
            `${label} tokens: ${grouped(requests)} requests; uncached ${grouped(total.uncached)}, written ${grouped(written)}, read ${grouped(total.read)}, output ${grouped(total.output)}.`,
            `${label} class index: ${index}; ${verdict}.`,
        ];
        if (total.writtenUnknown) lines.push(`${label}: ${grouped(total.writtenUnknown)} write tokens have unstated TTL; index spans min/max of both write rates.`);
        for (const key of new Set([...first, ...last])) {
            const lever = {
                read: "session length and tool output; compare a restart only with supported estimates",
                written: `fresh contexts, TTL gaps and cache busts; ${grouped(contributing)} contributing contexts; inferred rebuilds: ${causes.map(k => `${k} ${inferred[k]}`).join(", ")}`,
                output: "effort and model by recorded role; alternate-route savings unpriced without quality evidence",
                uncached: "caching may not be engaged; inspect uncached tails and cache controls",
            }[key];
            lines.push(`${label} ${key} lever: ${lever}.`);
        }
        if (first.includes("output") || last.includes("output")) {
            for (const [role, r] of [...roles].sort(([a], [b]) => compare(a, b))) {
                const histogram = values => Object.entries(values).filter(([, n]) => n > 0).sort(([a], [b]) => compare(a, b)).map(([k, n]) => `${k} ${grouped(n)}`).join(", ") || "none";
                lines.push(`${label} output role ${role}: ${grouped(r.output)} tokens; recorded effort ${histogram(r.efforts)}; model family ${histogram(r.models)}.`);
            }
        }
        return lines;
    } catch { return [`${label}: class analysis unassessed — token counts or estimated indices are unsafe or overflow.`]; }
}

function counterfactual(figure) {
    if (figure?.unavailable === "branch-scope") return "restart counterfactual unpriced: latest session tail is outside branch-owned scope.";
    if (figure?.unavailable === "usage") return "restart counterfactual unpriced: input usage counters are invalid or incomplete.";
    const unavailable = "restart counterfactual unpriced: explicit horizon, resume expense and usable latest-branch figures required; model/effort and TTL alternatives are not priced here.";
    if (!figure?.horizonDeclared || figure.resume == null) return unavailable;
    const { fresh, context, horizon, resume } = figure, read = figure.multipliers?.read, write = figure.multipliers?.write;
    if (![fresh, context, horizon, resume, read, write].every(Number.isFinite) || fresh <= 0 || context < 0 || horizon <= 0 || resume < 0 || read <= 0 || write <= 0) return unavailable;
    try {
        const continuing = horizon * read * context, restarting = horizon * read * fresh + write * fresh + resume;
        const saving = restartSaving({ fresh, context, horizon, resume, read, write });
        if (![continuing, restarting].every(Number.isFinite)) return unavailable;
        return `restart counterfactual: continue reads ~${estimate(continuing)} vs restart write + reads + resume ~${estimate(restarting)} input-equivalents; estimated saving ~${estimate(saving)}${saving <= 0 ? " (no positive saving)" : ""}; fixed-context comparison using caller-supplied horizon/resume, not a forecast.`;
    } catch { return unavailable; }
}

export function spendAnalysis(report) {
    const contexts = report.collected.contexts;
    if (!contexts.some(c => c.requests.length)) return [];
    const rates = report.priced?.declared ?? { read: GENERAL_READ, write: WRITE_BY_LIFETIME };
    if (!SPEND_FIGURES.read.holds(rates.read) || ["5m", "1h"].some(k => !SPEND_FIGURES.write.holds(rates.write?.[k]))) return ["class analysis unassessed — invalid rate assumptions."];
    const sessions = new Map();
    for (const c of contexts) for (const r of c.requests) {
        if (Number.isFinite(r.at)) sessions.set(c.session, Math.max(sessions.get(c.session) ?? -Infinity, r.at));
    }
    const chosen = [...sessions].sort(([a, x], [b, y]) => y - x || compare(String(a), String(b))).slice(0, 5).map(([id]) => id);
    const undated = new Set(contexts.map(c => c.session).filter(id => !sessions.has(id))).size;
    const branch = contexts.map(c => ({ ...c, requests: c.requests.filter(r => r.branch === report.branch) }));
    return [
        `class index assumptions: uniform input rate across models; uncached 1×, read ${rates.read}×, writes 5m ${rates.write["5m"]}× / 1h ${rates.write["1h"]}× (${report.priced?.declared ? "declared" : "general, undeclared"}); output 5× assumed. Estimated normalized input-equivalents, not monetary dominance or a bill; local receipts excluded${report.collected.malformed ? "; partial usage data" : ""}.`,
        ...scopeLines("branch", branch, rates),
        `recent selection: latest ${chosen.length} of at most 5 timed owned parent sessions across branches/worktrees; latest main/child timestamp, session-ID tie break; all owned requests in selected sessions included; ${undated} wholly undated sessions excluded.`,
        ...scopeLines("recent", contexts.filter(c => chosen.includes(c.session)), rates),
        counterfactual(report.restart),
    ];
}
