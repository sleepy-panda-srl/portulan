import path from "node:path";

import { isInside } from "../../cli/inside.mjs";

const FILE_PATH = /^[^#?:/]([^#?:]*[^#?:/])?$/;
const OLDER_SPECS = new Set(["2.1", "2.2"]);

function policyFileOf(ws) {
    if (ws.manifest?.kind === "pointer") {
        return { rel: null, because: "a pointer manifest carries no gate policy of its own" };
    }
    const declared = ws.manifest?.gates;
    if (declared === undefined) {
        return ws.list().includes("gates.json")
            ? { rel: "gates.json", because: null }
            : { rel: null, because: "this workspace declares no gate policy" };
    }
    if (typeof declared !== "string" || !declared.trim() || !FILE_PATH.test(declared)) {
        return { rel: null, because: "`gates` does not name a policy file inside this workspace" };
    }
    const resolved = path.resolve(ws.dir, declared);
    if (resolved === ws.dir || !isInside(ws.dir, resolved)) {
        return { rel: null, because: "`gates` resolves outside this workspace" };
    }
    const rel = path.relative(ws.dir, resolved).split(path.sep).join("/");
    if (!ws.list().includes(rel)) {
        return { rel: null, because: `\`${rel}\` is not present in this workspace` };
    }
    return { rel, because: null };
}

function inspectStrictSpec(ws) {
    const target = policyFileOf(ws);
    if (!target.rel) return { state: "skip", because: target.because };
    let text;
    try {
        text = ws.read(target.rel);
    } catch (error) {
        return { state: "unknown", because: `\`${target.rel}\` could not be read — ${error.message}` };
    }
    let policy;
    try {
        policy = JSON.parse(text);
    } catch {
        return { state: "skip", because: `\`${target.rel}\` is not valid JSON` };
    }
    if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
        return { state: "skip", because: `\`${target.rel}\` is not a JSON object` };
    }
    const spec = policy.portulan?.spec;
    if (spec === "2.3") {
        return { state: "skip", because: `\`${target.rel}\` already declares gate-policy 2.3` };
    }
    if (!OLDER_SPECS.has(String(spec))) {
        return {
            state: "skip",
            because: `\`${target.rel}\` declares gate-policy ${JSON.stringify(spec)}, which is not a 2.1/2.2 policy this step upgrades`,
        };
    }
    const floor = policy.floor;
    if (!floor || typeof floor !== "object" || Array.isArray(floor) || !Object.hasOwn(floor, "strict")) {
        return { state: "skip", because: `\`${target.rel}\` declares no \`floor.strict\`` };
    }
    if (typeof floor.strict !== "boolean") {
        return {
            state: "unknown",
            because: `\`${target.rel}\` declares non-boolean \`floor.strict\` under gate-policy ${spec}; set \`floor.strict\` to a boolean and \`portulan.spec\` to "2.3" by hand`,
        };
    }
    return {
        state: "owed",
        rel: target.rel,
        policy,
        spec,
        because: `\`${target.rel}\` declares \`floor.strict\` under gate-policy ${spec}; bump \`portulan.spec\` to "2.3"`,
    };
}

export const step = {
    id: "0012-gate-policy-floor-strict",
    kind: "repair",
    from: null,
    to: null,
    title: "bump `portulan.spec` to 2.3 in a gate policy declaring `floor.strict` under 2.2",
    why:
        "CLI 0.2.0 ignored `floor.strict` under gate-policy 2.2, while 0.3.0+ refuses it because `floor.strict` " +
        "arrived in gate-policy 2.3. That single refusal blocks `doctor`, `compile` and `upgrade` until " +
        "`portulan.spec` in the gate policy is updated to `2.3`.",

    owed(ws) {
        const res = inspectStrictSpec(ws);
        if (res.state === "owed") return { owed: true, because: res.because };
        if (res.state === "unknown") return { owed: null, because: res.because };
        return { owed: false, because: res.because };
    },

    plan(ws) {
        const res = inspectStrictSpec(ws);
        if (res.state !== "owed") return { ok: false, reason: res.because };
        const next = { ...res.policy, portulan: { ...res.policy.portulan, spec: "2.3" } };
        return { ok: true, edits: [{ file: res.rel, next: `${JSON.stringify(next, null, 2)}\n` }] };
    },
};
