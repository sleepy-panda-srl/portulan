#!/usr/bin/env node
// The A/B runner: spawns the agent turns of both arms and records the baseline they measure.
//
// Exit codes: 0 it did it · 1 a red verdict · 2 could not run.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { CouldNotRun } from "./goldens.mjs";
import { ArmRed, OPERATOR_SEED, constructArmA, constructArmB, isolatedEnv, nonceFor, seedOperator, trackedUnder } from "./ab.mjs";
import { ATTEMPTED, COMPLIANT_VERDICT, GRADERS, VERDICT_VOCABULARY, holdingScenarios, stageScenario } from "./ab-grade.mjs";

export const SNAPSHOT = "evals/ab/baseline.json";

export const REGISTER = "evals/ab/baseline.md";

/** Runs per (scenario, arm) cell. */
export const K = 5;

/** Same for both arms. `--print` alone denies every write; `acceptEdits` allows edits yet honours `deny` rules. */
export const INVOCATION = Object.freeze(["--print", "--permission-mode", "acceptEdits"]);

const FORBIDDEN_FLAGS = ["--dangerously-skip-permissions"];

const FORBIDDEN_MODES = ["bypasspermissions"];

export function dissolvesTheTreatment(invocation) {
    const found = [];
    const argv = [...invocation].map(String);
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (FORBIDDEN_FLAGS.includes(token)) {
            found.push(`\`${token}\``);
            continue;
        }
        let mode = null;
        if (token === "--permission-mode") mode = argv[i + 1];
        else if (token.startsWith("--permission-mode=")) mode = token.slice("--permission-mode=".length);
        if (mode !== undefined && mode !== null && FORBIDDEN_MODES.includes(mode.toLowerCase())) {
            found.push(`\`--permission-mode ${mode}\``);
        }
    }
    return found;
}

export const TRUNCATION_MARKER = "…";

export const TURN_TIMEOUT_MS = 10 * 60 * 1000;

export { OPERATOR_SEED, seedOperator };

export const CREDENTIAL_VARS = ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"];

const isTurn = (t) => t !== null && typeof t === "object";

export const LIMITATIONS = [
    "**What may not be concluded from the figures above.** `evals/ab/corpus.md`'s section of that name is",
    "the carrier and this block cites it rather than restating it. In short, and each point is argued there:",
    "",
    "- **`k = 5` per cell supports a recorded rate and nothing else** — no significance, no interval, and no",
    "  claim that a difference between two cells is a difference between the arms.",
    "- **The scope is the vendored-and-compiled tier**, and a baseline over this arm closes row 8 for no",
    "  other configuration of *Portulan on*. `evals/ab/arm.md` specifies the tier; row 8's criterion",
    "  deliberately does not carry the narrowing, because that is the maintainer's amendment.",
    "- **Arm B's absolute rate is reported beside every contrast**, because a bare agent at ceiling makes a",
    "  row uninformative whatever arm A does.",
    "- **A compliant cell whose `attempted` is zero has measured silence.** Two of the four scenarios are",
    "  compliant when an arm does nothing; `evals/ab/graders.md` names which.",
    "- **`did-not-complete` is a fact about a turn and `could-not-attribute` a refusal by a grader.**",
    "  Neither is a verdict, and neither is folded into a rate.",
    "- **Whether the host invoked arm A's compiled `Stop` hook under THIS baseline's environment has no",
    "  instrumented answer.** The only receipt-keyed probe was taken 2026-08-29 under `--operator-env",
    "  inherit`, which is not the arm these turns ran in. Some turns' `said` rows describe the Stop gate",
    "  blocking and releasing, which corroborates and is prose rather than an instrument. `compile` warns",
    "  that a missing hook fails open, so an arm whose hook were unreachable would silently be arm B — and",
    "  nothing here would show it.",
];

export function limitationsFor(snap) {
    const lines = [...LIMITATIONS];
    // The capture-era predicate, frozen: tracking `gradeAltitude` would drop this bullet from the committed capture.
    const IS_DATED_HANDOFF = (rel) => rel.startsWith(".portulan/handoffs/");
    const HANDOFF_RELATED = (rel) => IS_DATED_HANDOFF(rel) || rel === ".portulan/handoffs-index.md";
    const misScoredAltitude = snap.turns?.some?.((t) => {
        if (!isTurn(t) || t.scenario !== "altitude" || t.verdict !== "higher-layer" || !Array.isArray(t.evidence)) return false;
        const paths = t.evidence.filter((rel) => typeof rel === "string");
        const taskLayer = paths.filter((rel) => rel.startsWith(".portulan/tasks/"));
        const governance = paths.filter((rel) => rel === "AGENTS.md" || (rel.startsWith(".portulan/") && !rel.startsWith(".portulan/tasks/")));
        return taskLayer.length > 0 && governance.some(IS_DATED_HANDOFF) && governance.every(HANDOFF_RELATED);
    });
    if (misScoredAltitude) {
        lines.push(
            "- **The `altitude` row measures the predicate THIS capture was graded under, and is not a",
            // `String()` renders an absent commit as the hole `undefined`, which the derived probe reds, instead of throwing.
            `  contrast.** Under the predicate in force at \`${String(snap.source.commit).slice(0, 8)}\`, turns reached the compliant`,
            "  location — `.portulan/tasks/` — and were scored `higher-layer` anyway, because that predicate",
            "  gave any governance-surface hit precedence and arm A's own `dod.md` condition 8 mandates a",
            "  dated handoff on exactly that surface. The treatment arm was marked down for obeying the",
            "  treatment, and arm B — a bare tree — had no path to that branch, so the row is",
            "  one-directional. **That predicate was repaired on 2026-09-09** — the session-record slots",
            "  left the population — so this describes the capture and no longer describes the grader.",
            "  `evals/ab/corpus.md` carries the argument and the re-classification it implies.",
        );
    }
    if (!snap.model) {
        lines.push(
            "- **The model that produced these turns is not recorded.** This capture names the CLI and not the",
            "  model, and `ANTHROPIC_MODEL` crosses into an isolated arm untouched. This module's own bar is that",
            "  a baseline naming no host is a figure with no conditions; this one names the host and not the model.",
        );
    }
    if (!snap.agent) {
        lines.push(
            "- **The agent command is not recorded.** This capture predates the field, and `--agent` can name",
            "  any binary — so the invocation above prints `<agent>` rather than assuming the default. The",
            "  turns it describes were taken with the default `claude` on the operator's PATH; that is stated",
            "  here, where it is a claim by this record, rather than rendered as though the capture said it.",
        );
    }
    if (snap.turns?.some?.((t) => isTurn(t) && t.saidTruncated === true && typeof t.said === "string" && t.said.endsWith(TRUNCATION_MARKER))) {
        lines.push(
            `- **Some \`said\` rows in the capture are truncated**, and are marked \`${TRUNCATION_MARKER}\` where they are. They are`,
            "  diagnostic prose, never graded — `evals/ab/corpus.md` grades the tree an arm left behind.",
        );
    } else if (!snap.turns?.some?.((t) => isTurn(t) && "saidTruncated" in t)
        && !snap.turns?.some?.((t) => typeof t?.said === "string" && t.said.endsWith(TRUNCATION_MARKER))
        && snap.turns?.some?.((t) => typeof t?.said === "string" && t.said.length >= 300)) {
        // This `300` is the pre-marker cutter's cap, frozen: never tie it to `runTurn()`'s.
        lines.push(
            "- **Some `said` rows in the capture are truncated mid-word and are NOT marked as such** — this",
            "  capture predates the marker. They are diagnostic prose, never graded.",
        );
    }
    return lines;
};

// ---------------------------------------------------------------- the matrix

/** Every (scenario, arm, run) id, in the order that keeps a re-rendered snapshot byte-stable. */
export function turnIds(k = K) {
    const ids = [];
    for (const scenario of holdingScenarios()) {
        for (const arm of ["a", "b"]) {
            for (let run = 0; run < k; run += 1) ids.push({ scenario: scenario.id, arm, run });
        }
    }
    return ids;
}

export function credentialChannel(env = process.env) {
    const set = CREDENTIAL_VARS.filter((v) => typeof env[v] === "string" && env[v] !== "");
    if (set.length === 0) {
        throw new CouldNotRun(
            `none of ${CREDENTIAL_VARS.join(", ")} is set, and every turn here runs under a clean home — the host's stored login is reached through \`HOME\`, ` +
                "so an isolated arm has none of its own. Run `claude setup-token` and export CLAUDE_CODE_OAUTH_TOKEN. " +
                "This reads three variables and nothing else: a Bedrock or Vertex setup, or an `apiKeyHelper` in the config directory the isolation replaces, is a channel it cannot see",
        );
    }
    if (set.length > 1) {
        throw new CouldNotRun(`${set.join(" and ")} are both set — they are distinguishable auth paths, and a baseline must name the one it used`);
    }
    return set[0];
}

export function agentVersion(agent = "claude") {
    const r = spawnSync(agent, ["--version"], { encoding: "utf8", timeout: 60_000 });
    if (r.error || r.status !== 0) throw new CouldNotRun(`\`${agent} --version\` did not answer — ${r.error?.code ?? `exit ${r.status}`}. A baseline that cannot name its host is a figure with no conditions`);
    const line = (r.stdout ?? "").trim().split("\n")[0]?.trim() ?? "";
    if (line === "") throw new CouldNotRun(`\`${agent} --version\` exited 0 and printed nothing on stdout, so this baseline would name no host — which is the condition the check above exists to prevent, not a version`);
    return line;
}

export function runTurn({ armRoot, operatorDir, prompt, agent = "claude", env = process.env, timeoutMs = TURN_TIMEOUT_MS, invocation = INVOCATION }) {
    const dissolving = dissolvesTheTreatment(invocation);
    if (dissolving.length > 0) {
        throw new CouldNotRun(
            `${dissolving.join(" and ")} would dissolve arm A's compiled enforcement, which is the treatment under test — ` +
                "this refuses rather than recording a baseline over an arm that is not the ruled arm",
        );
    }
    seedOperator(operatorDir);
    const started = Date.now();
    const result = spawnSync(agent, [...invocation, prompt], {
        cwd: armRoot,
        encoding: "utf8",
        timeout: timeoutMs,
        env: isolatedEnv(operatorDir, env),
        // stdin closed: a prompt the harness cannot answer fails at once instead of waiting out the timeout.
        stdio: ["ignore", "pipe", "pipe"],
    });
    const wallMs = Date.now() - started;
    if (result.error && result.error.code !== "ETIMEDOUT") {
        throw new CouldNotRun(
            `\`${agent}\` could not be spawned — ${result.error.code ?? result.error.message}. Without a turn there is nothing to grade, ` +
                "and recording this as a did-not-complete would fold a fact about the machine into a rate about an arm",
        );
    }
    return {
        completed: result.status === 0,
        exit: result.status,
        timedOut: result.error?.code === "ETIMEDOUT",
        wallMs,
        // Diagnostic only, never graded: stderr first, where a failed turn usually says why.
        ...(() => {
            const whole = [(result.stderr ?? "").trim(), (result.stdout ?? "").trim()].filter(Boolean).join(" | ").split("\n")[0] ?? "";
            const saidTruncated = whole.length > 300;
            return { said: saidTruncated ? `${whole.slice(0, 300)}${TRUNCATION_MARKER}` : whole, saidTruncated };
        })(),
    };
}

export function journalPath(into, id) {
    return path.join(into, "journal", `${id.scenario}__${id.arm}__${id.run}.json`);
}

/** A turn already taken under this seed and this invocation, or `null`. */
export function readJournal(into, id, seed, invocation = INVOCATION) {
    const file = journalPath(into, id);
    let entry;
    try {
        entry = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (cause) {
        if (cause.code === "ENOENT") return null;
        throw new CouldNotRun(`${file} could not be read — ${cause.code ?? cause.message}. A journal that cannot be read is not an absent one`);
    }
    if (entry.nonce !== nonceFor(id.scenario, id.arm, id.run, seed)) return null;
    if (JSON.stringify(entry.invocation ?? null) !== JSON.stringify([...invocation])) return null;
    return entry;
}

// ---------------------------------------------------------------- aggregation

export function aggregate(turns, k = K) {
    const cells = [];
    for (const scenario of holdingScenarios()) {
        for (const arm of ["a", "b"]) {
            const mine = turns.filter((t) => t.scenario === scenario.id && t.arm === arm);
            if (mine.length !== k) throw new ArmRed(`\`${scenario.id}\`/${arm} holds ${mine.length} turn(s) and k is ${k} — a rate over an incomplete cell is a rate about something else`);
            const cell = {
                scenario: scenario.id,
                arm,
                didNotComplete: mine.filter((t) => !t.completed).length,
                couldNotAttribute: mine.filter((t) => t.completed && t.verdict === null).length,
                compliant: mine.filter((t) => t.completed && t.verdict === COMPLIANT_VERDICT[scenario.id]).length,
                nonCompliant: mine.filter((t) => t.completed && t.verdict !== null && t.verdict !== COMPLIANT_VERDICT[scenario.id]).length,
                attempted: mine.filter((t) => t.attempted === true).length,
                verdicts: Object.fromEntries(VERDICT_VOCABULARY[scenario.id].map((v) => [v, mine.filter((t) => t.verdict === v).length])),
            };
            const total = cell.didNotComplete + cell.couldNotAttribute + cell.compliant + cell.nonCompliant;
            if (total !== k) throw new ArmRed(`\`${scenario.id}\`/${arm} accounts for ${total} of ${k} turns — the four states must be total, or a rate is over a denominator nobody stated`);
            cells.push(cell);
        }
    }
    return cells;
}

// ---------------------------------------------------------------- the record

export function renderRegister(snap) {
    const lines = [];
    lines.push("# The A/B baseline — what a run of the arms measured");
    lines.push("");
    lines.push(`> Rendered from \`${SNAPSHOT}\` by \`node cli/ab-run.mjs --write\`. Do not edit by hand: it is`);
    lines.push("> regenerated from that file and byte-compared, so a hand-edit survives exactly until the next run.");
    lines.push(">");
    lines.push("> **The snapshot is the unreproducible half, and it is the only one.** Every other register in");
    lines.push("> this repository is derived from the tree and can be re-derived on any commit; this one is");
    lines.push("> derived from **events** — agent turns, which do not repeat. So the events are captured once,");
    lines.push("> and the rail holds this document to that capture rather than to the world.");
    lines.push("");
    lines.push("## The conditions");
    lines.push("");
    lines.push(`- **Taken:** ${snap.captured}`);
    lines.push(`- **Arms constructed from:** \`${snap.source.commit}\`${snap.source.clean ? "" : " — **a dirty tree**, which is a fact about this baseline's subject"}`);
    lines.push(`- **k:** ${snap.k} per cell, ruled by the maintainer ${snap.rulings.k}`);
    lines.push(`- **Seed:** \`${snap.seed}\` — every nonce derives from it, so a reader can recompute them`);
    lines.push(
        snap.operatorEnv === "isolated"
            ? `- **Operator environment:** isolated, a fresh home and config directory **per turn** (${snap.turns.length} of them)`
            : `- **Operator environment:** \`${snap.operatorEnv}\` — **NOT the isolated arm this baseline is ruled to run in** (${snap.turns.length} turns)`,
    );
    lines.push(`- **Credential channel:** \`${snap.credentialChannel}\` — one of three distinguishable auth paths`);
    lines.push(`- **Agent:** \`${snap.agentVersion}\``);
    lines.push(`- **Model:** ${snap.model ? `\`${snap.model}\`` : "**not recorded** — see the limitations below"}`);
    lines.push(`- **Invocation, identical for both arms:** \`${snap.agent === undefined ? "<agent>" : snap.agent} ${snap.invocation.join(" ")} <prompt>\``);
    lines.push(`- **Prompt:** \`stageScenario()\`'s own, verbatim. This runner authors no stimulus text.`);
    lines.push(`- **Per-turn timeout:** ${Math.round(snap.turnTimeoutMs / 1000)}s`);
    lines.push("");
    lines.push("## The figures");
    lines.push("");
    lines.push("| Scenario | Arm | compliant | non-compliant | could-not-attribute | did-not-complete | attempted |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const c of snap.cells) {
        lines.push(`| \`${c.scenario}\` | ${c.arm.toUpperCase()} | **${c.compliant}**/${snap.k} | ${c.nonCompliant} | ${c.couldNotAttribute} | ${c.didNotComplete} | ${c.attempted}/${snap.k} |`);
    }
    lines.push("");
    // Per scenario, not filtered from `snap.cells`: a missing cell must throw rather than shrink the total.
    const cellsFor = (arm) =>
        holdingScenarios().map((s) => {
            const cell = snap.cells.find((c) => c.scenario === s.id && c.arm === arm);
            if (cell === undefined) throw new Error(`the capture publishes no cell for \`${s.id}\`/${arm}, so no total can be folded from it`);
            return cell;
        });
    const totalFor = (arm) => cellsFor(arm).reduce((n, c) => n + c.compliant, 0);
    const totalA = totalFor("a");
    const totalB = totalFor("b");
    const denominator = snap.k * holdingScenarios().length;
    const verdict = totalA === totalB ? "a tie" : `a difference of ${totalA - totalB > 0 ? "+" : ""}${totalA - totalB}`;
    lines.push(`**Arm A ${totalA}/${denominator}, arm B ${totalB}/${denominator} — ${verdict}, recorded as measured.**`);
    lines.push("");
    const silent = [...cellsFor("a"), ...cellsFor("b")].filter((c) => c.compliant > 0 && c.attempted === 0);
    if (silent.length > 0) {
        const subject = silent.length === 1 ? "One cell folded into those totals" : `${silent.length} of the cells folded into those totals`;
        lines.push(`**${subject} MEASURED SILENCE** — compliant with nothing`);
        lines.push(`attempted. A total carrying ${silent.length === 1 ? "it" : "them"} is not a count of an arm doing the right thing, and the`);
        lines.push("per-scenario table below marks which.");
        lines.push("");
    }
    lines.push(`That total is a sum of ${holdingScenarios().length} counts of ${snap.k}, and NOT a rate over ${denominator} independent`);
    lines.push("trials. It carries no significance, no interval, and no claim that a difference between the arms is");
    lines.push("an effect of the treatment. The per-scenario rows above are the measurement; this line exists so a");
    lines.push("document citing the headline does not have to restate it, and every limitation below governs it");
    lines.push("exactly as it governs the rows.");
    lines.push("");
    lines.push("### Arm B's absolute rate, beside every contrast");
    lines.push("");
    lines.push("| Scenario | arm A | arm B | difference |");
    lines.push("|---|---|---|---|");
    for (const scenario of holdingScenarios()) {
        const a = snap.cells.find((c) => c.scenario === scenario.id && c.arm === "a");
        const b = snap.cells.find((c) => c.scenario === scenario.id && c.arm === "b");
        const silent = a.compliant > 0 && a.attempted === 0 ? " · **arm A measured silence**" : "";
        const silentB = b.compliant > 0 && b.attempted === 0 ? " · **arm B measured silence**" : "";
        lines.push(`| \`${scenario.id}\` | ${a.compliant}/${snap.k} | ${b.compliant}/${snap.k} | ${a.compliant - b.compliant >= 0 ? "+" : ""}${a.compliant - b.compliant}${silent}${silentB} |`);
    }
    lines.push("");
    lines.push("A difference here is a difference between two counts of five. It is not a measurement of an");
    lines.push("effect, and the block below is not a formality.");
    lines.push("");
    lines.push("## Every turn, so the figures above can be checked against them");
    lines.push("");
    lines.push("| Scenario | Arm | run | verdict | attempted | exit | ms |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const t of snap.turns) {
        lines.push(
            `| \`${t.scenario}\` | ${t.arm.toUpperCase()} | ${t.run} | ${t.completed ? `\`${t.verdict === null ? "could-not-attribute" : t.verdict}\`` : "**did-not-complete**"} | ` +
                `${t.attempted === null ? "—" : t.attempted} | ${t.exit === null ? "—" : t.exit} | ${t.wallMs} |`,
        );
    }
    lines.push("");
    lines.push(...limitationsFor(snap));
    lines.push("");
    return `${lines.join("\n")}\n`;
}

/** Fields the renderer reads as a branch, invisible to the derived probe; the suite audits this list both ways. */
export const BRANCH_READ = Object.freeze([
    "agent",
    "invocation[]",
    "model",
    "source.clean",
    "turns[].completed",
    "turns[].evidence[]",
    "turns[].said",
    "turns[].saidTruncated",
]);

/** The branch-read fields the committed capture predates: checked if present, permitted if absent. */
export const PERMITTED_ABSENT = Object.freeze(["agent", "model", "turns[].saidTruncated"]);

function spell(value) {
    if (value === undefined) return "absent";
    if (value === null) return "`null`";
    if (Array.isArray(value)) return "an array";
    return `${/^[aeiou]/.test(typeof value) ? "an" : "a"} ${typeof value}`;
}

/** Blind to `agent` or `model` deleted, a field missing from every row, and a false value of the right shape. */
export function verifyShape(snap) {
    const red = [];
    if (snap?.portulan?.abBaseline !== "1") red.push("the snapshot does not declare `portulan.abBaseline: \"1\"` — this is not a baseline capture");
    if (!Array.isArray(snap?.turns)) red.push(`the snapshot's \`turns\` is ${snap?.turns === undefined ? "absent" : `a ${typeof snap?.turns}`}, not an array — this capture cannot be read as a baseline`);
    if (!Array.isArray(snap?.cells)) red.push("the snapshot's `cells` is not an array — the published figures cannot be compared with a fold of the turns");
    else {
        for (const scenario of holdingScenarios()) {
            for (const arm of ["a", "b"]) {
                const cell = snap.cells.find((c) => c?.scenario === scenario.id && c?.arm === arm);
                if (cell === undefined) red.push(`the snapshot publishes no cell for \`${scenario.id}\`/${arm} — the figures are not total over the scenarios and arms the register prints`);
                else if (!Number.isInteger(cell.compliant) || !Number.isInteger(cell.attempted)) {
                    red.push(`the cell for \`${scenario.id}\`/${arm} carries no integer \`compliant\`/\`attempted\` — the register cannot print a rate from it`);
                }
            }
        }
    }
    if (!Number.isInteger(snap?.k) || snap.k < 1) red.push(`the snapshot records k as ${JSON.stringify(snap?.k)}, which is not a run count`);
    if (typeof snap?.seed !== "string" || snap.seed === "") red.push("the snapshot records no seed, so no nonce in it can be recomputed");
    for (const field of ["source", "rulings"]) {
        if (snap?.[field] === undefined || snap[field] === null) red.push(`the snapshot has no \`${field}\`, which the register prints among the run's conditions`);
    }
    // `BRANCH_READ` by name: a branch leaves no hole for the derived probe below to find.
    if (snap?.source !== undefined && snap?.source !== null && typeof snap.source.clean !== "boolean") {
        red.push("the snapshot's `source.clean` is not a boolean — it renders as a branch, so its absence would silently publish a claim about the tree that the capture never made");
    }
    if (snap?.agent !== undefined && (typeof snap.agent !== "string" || snap.agent.trim() === "")) {
        red.push("the snapshot's `agent` is present but is not a non-empty string — it renders inside the recorded command line, where `null` or blank space would publish an invocation reading `null --print …`");
    }
    if (snap?.model !== undefined && snap.model !== null && (typeof snap.model !== "string" || snap.model.trim() === "")) {
        red.push("the snapshot's `model` is present but is neither `null` nor a non-empty string — `null` is how *the operator set none* is recorded, and anything else renders as a condition nobody measured");
    }
    if (Array.isArray(snap?.turns)) {
        for (const t of snap.turns) {
            const id = `(${t?.scenario}, ${t?.arm}, run ${t?.run})`;
            if (typeof t?.completed !== "boolean") {
                red.push(`${id} carries no boolean \`completed\` — it renders as a branch, so its absence would publish **did-not-complete** about a turn that recorded no such thing`);
            }
            if (typeof t?.said !== "string") {
                red.push(`${id} carries no string \`said\` — the limitation block reads its length as EVIDENCE that a pre-marker capture's rows were cut, once the marker's absence has established the vintage`);
            }
            if (t?.saidTruncated !== undefined && typeof t.saidTruncated !== "boolean") {
                red.push(`${id} carries a \`saidTruncated\` that is not a boolean — its presence decides whether a truncation limitation publishes at all, and its value decides which`);
            }
            if (t?.evidence !== undefined && !Array.isArray(t.evidence)) {
                red.push(`${id} carries an \`evidence\` that is not an array — it is read to decide whether the altitude limitation publishes, and a non-array reads as no evidence at all`);
            }
            if (Array.isArray(t?.evidence) && t.evidence.some((rel) => typeof rel !== "string" || rel.trim() === "")) {
                red.push(`${id} carries an \`evidence\` entry that is not a non-empty path string — the altitude limitation tests these for a \`.portulan/tasks/\` prefix, and a blank entry answers that question silently`);
            }
            // Capture-era governance set, frozen: tracking `gradeAltitude` would red the committed capture.
            if (t?.verdict === "higher-layer" && Array.isArray(t?.evidence)
                && !t.evidence.some((rel) => typeof rel === "string" && (rel === "AGENTS.md" || (rel.startsWith(".portulan/") && !rel.startsWith(".portulan/tasks/"))))) {
                red.push(`${id} is graded \`higher-layer\` and its \`evidence\` names no governance surface — that verdict is returned only where one was hit, so the capture contradicts the grader that wrote it`);
            }
            if (t?.saidTruncated === true && typeof t?.said === "string" && !t.said.endsWith(TRUNCATION_MARKER)) {
                red.push(`${id} is marked truncated but its \`said\` does not end with \`${TRUNCATION_MARKER}\` — the register publishes that marked rows carry the marker`);
            }
            if (t?.verdict !== null && (typeof t?.verdict !== "string" || t.verdict.trim() === "")) {
                red.push(`${id} carries a \`verdict\` that is neither \`null\` nor a non-empty string — \`null\` is how *could-not-attribute* is recorded, and the register prints the rest verbatim`);
            }
        }
    }
    if (!Array.isArray(snap?.invocation)) {
        red.push(`the snapshot's \`invocation\` is ${spell(snap?.invocation)}, not an array — the register prints it as the command line both arms ran under`);
    }
    if (Array.isArray(snap?.invocation) && snap.invocation.length === 0) {
        red.push("the snapshot records an empty `invocation` — the register would publish a command line carrying none of the flags the turns actually ran under");
    }
    // `Array.from` turns holes into `undefined`, which `every()` would otherwise skip.
    if (Array.isArray(snap?.invocation) && !Array.from(snap.invocation).every((a) => typeof a === "string" && a.trim() !== "")) {
        red.push("the snapshot's recorded `invocation` holds an element that is not a non-empty string — `join(\" \")` renders `null` and holes as nothing and a blank string as empty space, so the published command line is not the one the turns ran under");
    }

    if (Array.isArray(snap?.turns) && snap.turns.length === 0) {
        red.push("the snapshot records no turns at all — a baseline with an empty matrix publishes figures over a denominator nothing measured");
    }
    if (Array.isArray(snap?.cells) && snap.cells.length === 0) {
        red.push("the snapshot publishes no cells at all — the register's figure tables would render empty beneath their headings");
    }
    if (snap?.turnTimeoutMs !== undefined && (!Number.isInteger(snap.turnTimeoutMs) || snap.turnTimeoutMs <= 0)) {
        red.push("the snapshot's `turnTimeoutMs` is not a positive integer — it renders through `Math.round`, so `null` would publish a per-turn timeout of `0s` that no run was given");
    }

    if (Array.isArray(snap?.turns) && snap.turns.length > 0
        && !snap.turns.some((t) => isTurn(t) && "saidTruncated" in t)
        && snap.turns.some((t) => typeof t?.said === "string" && t.said.endsWith(TRUNCATION_MARKER))) {
        red.push(`some turns' \`said\` rows carry the truncation marker while no turn records \`saidTruncated\` — a capture that carries the marker did not predate it, so the field was dropped rather than never written`);
    }
    if (Array.isArray(snap?.turns)) {
        for (const t of snap.turns) {
            if (t?.saidTruncated !== undefined && t.saidTruncated !== true
                && typeof t?.said === "string" && t.said.endsWith(TRUNCATION_MARKER)) {
                red.push(`(${t?.scenario}, ${t?.arm}, run ${t?.run}) carries a \`said\` ending in \`${TRUNCATION_MARKER}\` while its \`saidTruncated\` records ${JSON.stringify(t.saidTruncated)} — the row contradicts itself, and the register reads the flag`);
            }
        }
    }

    const keysOf = (o) => Object.keys(o ?? {}).sort().join(",");
    for (const [label, rows] of [["turn", snap?.turns], ["cell", snap?.cells]]) {
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const shapes = new Set(rows.map(keysOf));
        if (shapes.size > 1) {
            red.push(`the snapshot's ${label} rows do not all carry the same fields (${shapes.size} different shapes) — a row missing what its neighbours record is an edit, not a capture`);
        }
    }
    if (Array.isArray(snap?.cells)) {
        const byScenario = new Map();
        for (const c of snap.cells) {
            if (!byScenario.has(c?.scenario)) byScenario.set(c?.scenario, new Set());
            byScenario.get(c?.scenario).add(keysOf(c?.verdicts));
        }
        // Per scenario: each scenario has its own verdict vocabulary.
        for (const [scenario, shapes] of byScenario) {
            if (shapes.size > 1) red.push(`the cells for \`${scenario}\` publish different \`verdicts\` vocabularies — one scenario has one vocabulary`);
        }
    }
    if (red.length > 0) return red;

    // The derived probe: a field the renderer reads and the capture lacks renders as `undefined` or `NaN`.
    let rendered;
    try {
        rendered = renderRegister(snap);
    } catch (cause) {
        red.push(`the register cannot be rendered from this capture — ${cause.message}`);
        return red;
    }
    for (const hole of ["undefined", "NaN"]) {
        if (rendered.includes(hole)) {
            red.push(`the register rendered from this capture contains \`${hole}\` — a field the renderer reads is missing from the snapshot, and a published document with a hole in it is worse than a refusal`);
        }
    }
    return red;
}

export function verify(snap) {
    const red = verifyShape(snap);
    if (red.length > 0) return red;
    if (snap.operatorEnv !== "isolated") {
        red.push(`the snapshot records \`operatorEnv: ${JSON.stringify(snap.operatorEnv)}\` — no baseline may be recorded under an unisolated arm (evals/ab/corpus.md, and cli/ab.mjs's acceptedUnder.scope)`);
    }
    for (const found of dissolvesTheTreatment(snap.invocation ?? [])) {
        red.push(`the recorded invocation carries ${found}, which dissolves arm A's compiled enforcement`);
    }
    if (snap.k !== K) red.push(`the snapshot records k=${snap.k} where the maintainer ruled ${K} — a matrix at another k is another experiment, and the ruling is not the snapshot's to restate`);
    const expected = turnIds(snap.k);
    if (snap.turns.length !== expected.length) red.push(`the snapshot holds ${snap.turns.length} turn(s) where k=${snap.k} over ${holdingScenarios().length} scenario(s) and two arms needs ${expected.length}`);
    const seen = new Set(snap.turns.map((t) => `${t.scenario}\0${t.arm}\0${t.run}`));
    for (const id of expected) {
        if (!seen.has(`${id.scenario}\0${id.arm}\0${id.run}`)) red.push(`no turn for (${id.scenario}, ${id.arm}, run ${id.run}) — the matrix is not total over k`);
    }
    if (seen.size !== snap.turns.length) red.push("two turns share one (scenario, arm, run) id — a slot may be spawned once, ever");
    for (const t of snap.turns) {
        const want = nonceFor(t.scenario, t.arm, t.run, snap.seed);
        if (t.nonce !== want) red.push(`(${t.scenario}, ${t.arm}, ${t.run}) records nonce \`${t.nonce}\` where the seed derives \`${want}\` — a nonce that is not the harness's cannot attribute anything`);
    }
    try {
        const recomputed = aggregate(snap.turns, snap.k);
        if (JSON.stringify(recomputed) !== JSON.stringify(snap.cells)) red.push("the published cells do not match a fresh fold of the per-turn rows — a figure has drifted from its own data");
    } catch (error) {
        red.push(`the per-turn rows do not fold: ${error.message}`);
    }
    return red;
}

export function publishMatrix({ repoRoot, snap, into, stdout, stderr }) {
    fs.writeFileSync(path.join(repoRoot, SNAPSHOT), `${JSON.stringify(snap, null, 2)}\n`);
    stdout.write(`ab-run: wrote ${SNAPSHOT} — the turns are kept whatever the checks say, because they do not repeat\n`);
    if (into !== undefined) stdout.write(`ab-run: turns journalled under ${into} — re-run with the same --seed and --into to reuse them, spawning nothing\n`);
    const published = verify(snap);
    if (published.length > 0) {
        stderr.write(`ab-run: ${published.length} finding(s), so ${REGISTER} was NOT written:\n  - ${published.join("\n  - ")}\n`);
        if (fs.existsSync(path.join(repoRoot, REGISTER))) {
            stderr.write(`ab-run: ${REGISTER} is still the PREVIOUS run's and no longer matches ${SNAPSHOT} beside it — \`--verify\` will red until the capture is repaired or reverted\n`);
        }
        return 1;
    }
    fs.writeFileSync(path.join(repoRoot, REGISTER), renderRegister(snap));
    stdout.write(`ab-run: wrote ${REGISTER}\n`);
    stdout.write(`ab-run: k=${snap.k} supports a recorded rate and nothing else. The register says so in its own voice.\n`);
    return 0;
}

// ---------------------------------------------------------------- the CLI

const USAGE = `portulan-ab-run — run the A/B matrix and record the baseline. THE ONLY MODULE HERE THAT SPAWNS AN AGENT.

  node cli/ab-run.mjs --matrix --seed <s> [--k ${K}] [--into <dir>] [--repo-root <dir>]
  node cli/ab-run.mjs --smoke --seed <s> [--scenario <id>] [--into <dir>] [--repo-root <dir>]
                                        [--turn-timeout <s>] [--agent <path>]
  node cli/ab-run.mjs --verify [--repo-root <dir>]
  node cli/ab-run.mjs --write [--repo-root <dir>]

  --matrix   run every (scenario, arm, run), write ${SNAPSHOT} ALWAYS — the turns do not repeat — and
             write ${REGISTER} only if the capture passes the same checks --verify runs.
             ${K * 2 * holdingScenarios().length} turns at k=${K}. SPENDS REAL TOKENS. Any turn
             already journalled under --into for this seed is REUSED, never re-run: pass the smoke
             gate's --into to continue from it, and to resume after a crash.
  --smoke    the maintainer's ruled smoke gate: ONE scenario, both arms, run 0. It writes no
             snapshot and no register — it prints the cost, the liveness read and what each turn
             said, so a person can decide whether the matrix should run at all. Its turns are
             JOURNALLED under --into, and --matrix reuses them: they are run 0, not a rehearsal.
  --verify   the recipe's mode: no agent. The snapshot's shape and arithmetic, the matrix's
             totality over k, an unisolated claim, and ${REGISTER} byte-compared through this
             module's own renderer.
  --write    re-render ${REGISTER} from the committed snapshot. Runs no agent, and REFUSES a capture
             \`--verify\` would red — the mode that publishes asks the publishing question.

There is NO --operator-env flag. Every turn runs isolated, with a fresh home and config directory of
its own, because evals/ab/corpus.md forbids a baseline over an unisolated arm — a departure would be
a visible code change and the maintainer's ruling, not a flag.

A smoke turn IS run 0 of its cell and counts toward the matrix. Declared here, before any turn runs:
deciding after seeing one is selection.

Exit codes: 0 it did it · 1 a red verdict · 2 could not run.`;

function parse(argv) {
    const out = { mode: null, seed: null, k: K, into: null, repoRoot: ".", scenario: null, agent: "claude", turnTimeoutMs: TURN_TIMEOUT_MS };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const value = () => {
            const v = argv[i + 1];
            if (v === undefined || v.startsWith("--")) throw new CouldNotRun(`\`${arg}\` needs a value`);
            i += 1;
            return v;
        };
        switch (arg) {
            case "--help":
            case "-h":
                out.mode = "help";
                break;
            case "--matrix":
            case "--smoke":
            case "--verify":
            case "--write": {
                const mode = arg.slice(2);
                if (out.mode !== null && out.mode !== mode) throw new CouldNotRun(`\`--${out.mode}\` and \`${arg}\` are two modes — pick one`);
                out.mode = mode;
                break;
            }
            case "--seed":
                out.seed = value();
                break;
            case "--k": {
                const v = Number(value());
                if (!Number.isInteger(v) || v < 1) throw new CouldNotRun("`--k` takes a positive integer");
                if (v !== K) throw new CouldNotRun(`\`--k ${v}\` — the maintainer ruled ${K}, and a run at another k is another experiment. Refused before any turn is spawned rather than after all of them; the ruling is not this tool's to restate`);
                out.k = v;
                break;
            }
            case "--into":
                out.into = value();
                break;
            case "--repo-root":
                out.repoRoot = value();
                break;
            case "--scenario":
                out.scenario = value();
                break;
            case "--agent":
                out.agent = value();
                break;
            case "--turn-timeout": {
                const v = Number(value());
                if (!Number.isFinite(v) || v <= 0) throw new CouldNotRun("`--turn-timeout` takes seconds, as a positive number");
                out.turnTimeoutMs = Math.round(v * 1000);
                break;
            }
            case "--operator-env":
                throw new CouldNotRun(
                    "there is no `--operator-env` here. Every turn runs isolated, because `evals/ab/corpus.md` forbids a baseline over an unisolated arm; " +
                        "a departure is a visible code change and the maintainer's ruling, not a flag",
                );
            default:
                throw new CouldNotRun(`unknown argument \`${arg}\``);
        }
    }
    return out;
}

export function run(argv = [], { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
    let parsed;
    try {
        parsed = parse(argv);
    } catch (error) {
        stderr.write(`ab-run: ${error.message}\n`);
        return 2;
    }
    if (parsed.mode === null || parsed.mode === "help") {
        stdout.write(`${USAGE}\n`);
        return parsed.mode === null ? 2 : 0;
    }

    const repoRoot = path.resolve(cwd, parsed.repoRoot);
    try {
        if (parsed.mode === "verify" || parsed.mode === "write") {
            const snapPath = path.join(repoRoot, SNAPSHOT);
            if (!fs.existsSync(snapPath)) throw new CouldNotRun(`${SNAPSHOT} does not exist — no baseline has been recorded, which is not a verdict about one`);
            const snap = JSON.parse(fs.readFileSync(snapPath, "utf8"));
            // Shape before render: `renderRegister()` throws on a malformed capture, which would exit 2 instead of 1.
            const shape = verifyShape(snap);
            if (shape.length > 0) {
                throw new ArmRed(
                    parsed.mode === "write"
                        ? `${shape.length} finding(s), so ${REGISTER} was NOT written:\n  - ${shape.join("\n  - ")}`
                        : `${shape.length} finding(s):\n  - ${shape.join("\n  - ")}`,
                );
            }
            const rendered = renderRegister(snap);
            if (parsed.mode === "write") {
                const published = verify(snap);
                if (published.length > 0) throw new ArmRed(`${published.length} finding(s), so ${REGISTER} was NOT written:\n  - ${published.join("\n  - ")}`);
                fs.writeFileSync(path.join(repoRoot, REGISTER), rendered);
                stdout.write(`ab-run: wrote ${REGISTER} from ${SNAPSHOT}\n`);
                return 0;
            }
            const red = verify(snap);
            const onDisk = fs.existsSync(path.join(repoRoot, REGISTER)) ? fs.readFileSync(path.join(repoRoot, REGISTER), "utf8") : null;
            if (onDisk === null) {
                red.push(
                    red.length > 0
                        ? `${REGISTER} is missing, and \`--write\` will refuse to render it until the finding(s) above are repaired`
                        : `${REGISTER} is missing — render it with \`node cli/ab-run.mjs --write\``,
                );
            }
            else if (onDisk !== rendered) red.push(`${REGISTER} does not match a fresh render of ${SNAPSHOT} — a published figure has drifted from its own data`);
            if (!rendered.includes(LIMITATIONS[0])) red.push("the rendered register carries no limitation block");
            if (red.length > 0) throw new ArmRed(`${red.length} finding(s):\n  - ${red.join("\n  - ")}`);
            stdout.write(`ab-run: ${snap.turns.length} turn(s) over ${snap.cells.length} cell(s) at k=${snap.k}, isolated, folded consistently, and ${REGISTER} matches byte for byte\n`);
            return 0;
        }

        // ---- the two modes that spawn
        if (parsed.seed === null) throw new CouldNotRun("a run needs `--seed <s>` — every nonce derives from it, and a nonce nobody can recompute is a figure rather than a measurement");
        const channel = credentialChannel();
        const version = agentVersion(parsed.agent);
        const into = parsed.into ? path.resolve(cwd, parsed.into) : fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "portulan-abrun-"));

        const ids = parsed.mode === "smoke"
            ? turnIds(1).filter((id) => id.scenario === (parsed.scenario ?? holdingScenarios()[0].id))
            : turnIds(parsed.k);
        if (ids.length === 0) throw new CouldNotRun(`\`${parsed.scenario}\` is not a scenario that holds`);

        const workspace = path.join(repoRoot, ".portulan");
        const tracked = trackedUnder(repoRoot, workspace);

        stdout.write(`ab-run: ${ids.length} turn(s), isolated, credential ${channel}, agent ${version}\n`);
        const turns = [];
        let consecutiveFailures = 0;
        for (const id of ids) {
            const nonce = nonceFor(id.scenario, id.arm, id.run, parsed.seed);
            const armRoot = path.join(into, "trees", id.scenario, id.arm, String(id.run));
            // One operator directory per turn: the host keeps state under `HOME` that a later turn would read.
            const operatorDir = path.join(into, "operators", id.scenario, id.arm, String(id.run));
            fs.mkdirSync(path.dirname(armRoot), { recursive: true });
            if (id.arm === "a") constructArmA({ workspaceDir: workspace, into: armRoot, repoRoot, cliRoot: repoRoot, tracked });
            else constructArmB(armRoot);
            const staged = stageScenario(armRoot, { scenario: id.scenario, nonce, arm: id.arm });

            const already = readJournal(into, id, parsed.seed, INVOCATION);
            if (already !== null) {
                turns.push(already);
                stdout.write(`ab-run:   ${id.scenario}/${id.arm}/${id.run} — ${already.verdict ?? (already.completed ? "could-not-attribute" : "did-not-complete")} · REUSED from the journal, not re-run\n`);
                consecutiveFailures = already.completed ? 0 : consecutiveFailures + 1;
                continue;
            }
            const turn = runTurn({ armRoot, operatorDir, prompt: staged.prompt, agent: parsed.agent, timeoutMs: parsed.turnTimeoutMs });
            const graded = turn.completed ? GRADERS[id.scenario](armRoot, { nonce, arm: id.arm }) : null;
            turns.push({
                ...id,
                nonce,
                ...turn,
                // Per turn too: `readJournal()` reuses a turn only under the same invocation.
                invocation: [...INVOCATION],
                verdict: graded?.attributed ? graded.verdict : null,
                // Liveness from the artifact, not the verdict: an idle arm is compliant in two scenarios.
                attempted: graded?.attributed ? ATTEMPTED[id.scenario](armRoot, nonce) : null,
                evidence: graded?.evidence ?? [],
            });
            // Journalled at once: a crash costs one turn, and a smoke turn counts as run 0 of its cell.
            fs.mkdirSync(path.dirname(journalPath(into, id)), { recursive: true });
            fs.writeFileSync(journalPath(into, id), `${JSON.stringify(turns[turns.length - 1], null, 2)}\n`);
            const attempted = turns[turns.length - 1].attempted;
            stdout.write(
                `ab-run:   ${id.scenario}/${id.arm}/${id.run} — ${turn.completed ? (graded?.verdict ?? "could-not-attribute") : `did-not-complete (exit ${turn.exit})`}` +
                    ` · attempted ${attempted} · ${turn.wallMs}ms\n`,
            );
            if (parsed.mode === "smoke" && turn.said) stdout.write(`ab-run:     said: ${turn.said}\n`);

            consecutiveFailures = turn.completed ? 0 : consecutiveFailures + 1;
            if (consecutiveFailures >= 3) {
                throw new CouldNotRun(
                    "three turns in a row did not complete — this stops for consultation rather than spending the rest of the matrix on a systemic failure. " +
                        `The last one said: ${JSON.stringify(turn.said)}`,
                );
            }
        }

        if (parsed.mode === "smoke") {
            const ms = turns.reduce((n, t) => n + t.wallMs, 0);
            stdout.write(`ab-run: invocation \`${parsed.agent} ${INVOCATION.join(" ")} <prompt>\` — identical for both arms\n`);
            stdout.write(`ab-run: SMOKE ONLY — no snapshot and no register were written.\n`);
            stdout.write(`ab-run: ${turns.length} turn(s), ${Math.round(ms / 1000)}s total. Liveness: ${turns.map((t) => `${t.arm}=${t.attempted}`).join(" ")}\n`);
            stdout.write(`ab-run: an arm reporting attempted=false did not act at all — read that before pricing the matrix.\n`);
            stdout.write(`ab-run: these turns ARE run 0 of their cells and count toward the matrix — journalled, so --matrix REUSES them rather than spawning one id twice.\n`);
            stdout.write(`ab-run: continue with:  node cli/ab-run.mjs --matrix --seed ${parsed.seed} --into ${into}\n`);
            return 0;
        }

        const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
        const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: repoRoot, encoding: "utf8" });
        const snap = {
            portulan: { abBaseline: "1" },
            captured: new Date().toISOString(),
            source: { commit: (head.stdout ?? "").trim(), clean: (dirty.stdout ?? "").trim() === "" },
            k: parsed.k,
            seed: parsed.seed,
            operatorEnv: "isolated",
            credentialChannel: channel,
            agent: parsed.agent,
            agentVersion: version,
            model: (process.env.ANTHROPIC_MODEL ?? "").trim() || null,
            invocation: [...INVOCATION],
            turnTimeoutMs: parsed.turnTimeoutMs,
            rulings: { k: "2026-08-31", smokeFirst: "2026-08-31" },
            turns,
            cells: aggregate(turns, parsed.k),
        };
        return publishMatrix({ repoRoot, snap, into, stdout, stderr });
    } catch (error) {
        if (error instanceof ArmRed) {
            stderr.write(`ab-run: ${error.message}\n`);
            return 1;
        }
        if (error instanceof CouldNotRun) {
            stderr.write(`ab-run: ${error.message}\n`);
            return 2;
        }
        stderr.write(`ab-run: ${error.stack ?? error.message}\n`);
        return 2;
    }
}

// File URLs on both sides, so a path with a space, or reached through a symlink, still runs as main.
function isMain() {
    const invoked = process.argv[1];
    if (!invoked) return false;
    if (import.meta.url === pathToFileURL(invoked).href) return true;
    try {
        return import.meta.url === pathToFileURL(fs.realpathSync(invoked)).href;
    } catch {
        return false;
    }
}

if (isMain()) {
    process.exitCode = run(process.argv.slice(2));
}
