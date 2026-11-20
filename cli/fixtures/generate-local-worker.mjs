// Writes `./local-worker/`: a synthetic A/B capture of the local-llm runner's arms, and the register it renders.
//
// Every turn is scripted from PLAN below and every output is invented; the capture and the render are the runner's own.
// The predicates fingerprint is a fixed fake, so an edit to a predicate file moves no byte here unless a verdict moves.

import fs from "node:fs";
import path from "node:path";

import {
    AB_TASKS,
    captureAb,
    currentScreen,
    EVAL_PROMPTS,
    HANDOFF_REQUIRED_TOKENS,
    hostPrompt,
    loadPredicates,
    promptsFingerprint,
    renderAbRegister,
    verifyAb,
} from "../../packs/tools/local-llm/runner/local-llm.mjs";

const out = process.argv[2];
if (out === undefined || out === "") {
    process.stderr.write("usage: node cli/fixtures/generate-local-worker.mjs <dir>\n");
    process.exit(2);
}

// P passes the screen's predicate, F fails it, X is a host exit 1, T a host timeout.
const PLAN = Object.freeze({
    code: { l: "PPFPP", h: "PPPPP" },
    codify: { l: "FPFPP", h: "PPXPP" },
    handoff: { l: "PPPFP", h: "PTPPP" },
});

const MARK = "(synthetic fixture output: no model wrote this)";
const OUTPUTS = {
    code: {
        P: `${MARK}\n\`\`\`js\nexport function summarizeRun(records) {\n    return { requests: records.length, billableTokens: 0, maxContext: 0 };\n}\n\`\`\``,
        F: `${MARK}\n\`\`\`js\n// added 2026-10-27 for #546\nexport function summarizeRun(records) {\n    return { requests: records.length, billableTokens: 0, maxContext: 0 };\n}\n\`\`\``,
    },
    codify: {
        P: [
            `**Incident.** ${MARK} Bounded calls loaded the whole host floor.`,
            "",
            "**Proposed rule.** Omit the host floor on bounded local worker calls.",
            "",
            "**Enforcement.** The runner refuses prompts above `--max-input-bytes`.",
            "",
            "**Provenance.** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/433`.",
            "",
            "**Retire when.** Host subagents omit the floor on bounded tasks.",
        ].join("\n"),
        F: [
            `**Incident.** ${MARK} Bounded calls loaded the whole host floor.`,
            "",
            "**Proposed rule.** Omit the host floor on bounded local worker calls.",
            "",
            "**Provenance.** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/433`.",
        ].join("\n"),
    },
    handoff: {
        P: `## Did\n${MARK} ${HANDOFF_REQUIRED_TOKENS.map((t) => `\`${t}\``).join(" ")}\n## Open\nNothing.\n## Next\nNothing.`,
        F: `## Did\n${MARK} ${HANDOFF_REQUIRED_TOKENS.slice(1).map((t) => `\`${t}\``).join(" ")}\n## Open\nNothing.\n## Next\nNothing.`,
    },
};

const runs = { l: Object.fromEntries(AB_TASKS.map((t) => [t, 0])), h: Object.fromEntries(AB_TASKS.map((t) => [t, 0])) };
const next = (arm, task) => {
    const run = runs[arm][task]++;
    return { run, state: PLAN[task][arm][run] };
};

const chatFn = async ({ messages }) => {
    const task = AB_TASKS.find((t) => EVAL_PROMPTS[t] === messages);
    const { run, state } = next("l", task);
    return { content: OUTPUTS[task][state], totalMs: 1000 + 100 * AB_TASKS.indexOf(task) + run };
};

const hostFn = ({ prompt, timeoutMs }) => {
    const task = AB_TASKS.find((t) => hostPrompt(t) === prompt);
    const { run, state } = next("h", task);
    const ms = 20000 + 1000 * AB_TASKS.indexOf(task) + run;
    if (state === "X") return { completed: false, exit: 1, timedOut: false, ms, output: "" };
    if (state === "T") return { completed: false, exit: null, timedOut: true, ms: timeoutMs, output: "" };
    return { completed: true, exit: 0, timedOut: false, ms, output: OUTPUTS[task][state] };
};

const predicates = await loadPredicates();
const rec = await captureAb({
    seed: "synthetic-fixture",
    screen: { predicates: "0".repeat(64), prompts: promptsFingerprint() },
    predicates,
    hostCommand: ["fixture-host", "--print"],
    hostModel: "fixture/host-model",
    models: { code: "fixture/local-code-model", prose: "fixture/local-prose-model" },
    baseUrl: "http://127.0.0.1:1234/v1",
    conditions: {
        captured: "2000-01-01T00:00:00.000Z",
        commit: "0".repeat(40),
        clean: true,
        machine: "none: a synthetic fixture, and no machine ran these turns",
        hostVersion: "0.0.0 (synthetic fixture host)",
    },
    chatFn,
    hostFn,
});
rec.fixture = "Every turn was scripted by `cli/fixtures/generate-local-worker.mjs` and every output was invented; no model, host or machine ran.";
const red = verifyAb(rec, { predicates, screen: currentScreen() });
if (red.length > 0) {
    process.stderr.write(`the synthetic capture does not verify:\n  - ${red.join("\n  - ")}\n`);
    process.exit(1);
}
const dir = path.join(out, "local-worker");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "local-worker.json"), `${JSON.stringify(rec, null, 2)}\n`);
fs.writeFileSync(path.join(dir, "local-worker.md"), renderAbRegister(rec));
