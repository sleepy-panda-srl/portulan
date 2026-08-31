#!/usr/bin/env node
// The A/B run — the only module in this family that spawns an agent, and the only one that records a
// figure about behaviour.
//
// Milestone 8's *A/B (Portulan on/off) baseline recorded* clause, session **6d**, the last third of the
// maintainer's 2026-08-29 split at **construction | grading | running**. `./ab.mjs` builds the arms,
// `./ab-grade.mjs` grades the trees they leave behind, and this runs the turns between the two.
// `../evals/ab/arm.md`, `../evals/ab/corpus.md` and `../evals/ab/graders.md` are **binding input**.
//
// **It is a separate module because `./ab-grade.mjs` says of itself, in its header, its verify recipe
// and `../evals/README.md`, that it runs no agent and imports no child-process API at all — and
// `./ab-grade.test.mjs` asserts the second by reading its source.** A spawn there would falsify three
// carriers and a rail. The one `spawnSync` in the family lives here.
//
// ## What a baseline recorded here may and may not say
//
// **`k = 5` per cell supports a recorded rate and nothing else.** No significance, no interval, no
// "Portulan improves X by Y". `../evals/ab/corpus.md`'s *What may not be concluded* is the carrier and
// `LIMITATIONS` below **cites** it into every rendered record rather than restating it — that file's own
// rule, and the reason a fifth carrier of the A/B clause's subject cannot appear through this one.
//
// **The scope is the vendored-and-compiled tier and no other configuration of "Portulan on".** Row 8's
// criterion deliberately does not carry that narrowing, because narrowing a criterion is the
// maintainer's amendment; the record carries it instead.
//
// **A compliant cell whose `attempted` is zero has measured silence.** Two of the four scenarios are
// compliant when an arm does nothing at all — `../evals/ab/graders.md` names which — so a rate banked
// without reading liveness beside it is a figure about inaction.
//
// ## Three words that are not synonyms, and the record keeps them apart
//
// `./ab-grade.mjs` already owns one meaning of *refused*, and overloading it in a published record is
// how a fact about the harness gets read as a finding about an arm:
//
//   did-not-complete   the TURN produced no stop — the agent exited non-zero, or timed out. A fact
//                      about this run, never a verdict. 6b's probe learned it the expensive way, by
//                      reporting a hook as *not invoked* when no turn had occurred.
//   could-not-attribute  the GRADER refused the tree — the anchor was missing or altered. Reported,
//                      never folded into either rate (`./ab-grade.mjs`'s own rule).
//   non-compliant      a verdict. The arm did the thing the mandate forbids.
//
// `did-not-complete + could-not-attribute + compliant + non-compliant === k`, per cell, checked.
//
// ## Isolation, and what this module refuses
//
// **No baseline may be recorded under an unisolated arm.** The carriers are
// `../evals/ab/corpus.md`'s acceptance-test block and `./ab.mjs`'s `acceptedUnder.scope` on the
// `done-demonstrated` scenario — **not** `../evals/ab/arm.md`, which names *three doors* for this
// session, one of them *"record its own departure"*, and so reads the other way. A session plan cited
// arm.md for it and the session-open checkpoint caught that.
//
// So: **this module has no `--operator-env` flag at all.** Every turn runs under `isolatedEnv()`, and a
// departure would be a visible code change plus a maintainer's ruling rather than a flag somebody
// passed. A **fresh operator directory per (scenario, arm, run)** — forty, not two: Claude Code keeps
// per-`HOME` state, and sharing one would let a turn read what an earlier turn left.
//
// ## The invocation is part of the experiment
//
// `INVOCATION` is a declared constant, **identical for both arms**, recorded verbatim in the snapshot,
// and `--dangerously-skip-permissions` is refused in code: it would dissolve arm A's compiled
// enforcement, which is the treatment. The prompt is `./ab-grade.mjs`'s `stageScenario()` return value
// **verbatim** — this module authors no prompt text, because a wrapper sentence would be a stimulus no
// rail checks and `arm.md`'s rule 2 reaches the fixtures.
//
// ## The record is a snapshot plus a register, on `./review-meter.mjs`'s precedent
//
// Every other register in this repository is byte-compared because it is derived from the **tree**. A
// baseline is derived from **events**, and re-deriving it would mean re-running forty agent turns — a
// rail nobody can run on a commit. The house answer already exists: the events land in a committed
// machine-readable **snapshot**, and the register is rendered from that snapshot and byte-compared
// *through the same renderer that wrote it*. `../.portulan/verify/review-loop.sh` states the reason —
// *"a published figure that can drift from its own data is the hand-maintained tally in a new
// costume"*. **The unreproducible half is the snapshot alone**, and it says so on its own face.
//
// Exit codes: 0 it did it · 1 a red verdict · 2 could not run.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { CouldNotRun } from "./goldens.mjs";
import { ArmRed, constructArmA, constructArmB, isolatedEnv, nonceFor, trackedUnder } from "./ab.mjs";
import { ATTEMPTED, COMPLIANT_VERDICT, GRADERS, VERDICT_VOCABULARY, holdingScenarios, stageScenario } from "./ab-grade.mjs";

/** The committed machine-readable capture. The unreproducible half, and the only one. */
export const SNAPSHOT = "evals/ab/baseline.json";

/** The register rendered from it, byte-compared through this module's own renderer. */
export const REGISTER = "evals/ab/baseline.md";

/** The maintainer's ruling of 2026-08-31. Data, not a comment: the record prints it and `--verify` checks totality against it. */
export const K = 5;

/**
 * The agent invocation, identical for both arms.
 *
 * **The permission surface is part of the experiment, and this line was RULED BY MEASUREMENT rather
 * than chosen.** The first real smoke gate ran `--print` alone: both turns **completed** — 98s for arm
 * A, 21s for arm B, exit 0 — and **both trees were byte-unchanged**. No `summary.md`, planted files
 * intact, `attempted: false` on both. In print mode there is nobody to approve a tool call, so writes
 * are denied and **both arms are structurally inert**; a matrix run that way would have measured the
 * host's permission default and reported it as a fact about Portulan. That is precisely what the
 * maintainer's smoke-first ruling exists to catch, and it caught it on the first two turns.
 *
 * **`acceptEdits` and not a bypass, and the distinction is the whole treatment.** It auto-approves
 * edits the settings do not forbid; it does **not** override a `deny` rule, so arm A's compiled
 * enforcement — the thing under test — still refuses what `gates.json` says it must. A bypass flag
 * would dissolve exactly that, which is why `FORBIDDEN_FLAGS` refuses one in code.
 *
 * It is **identical for both arms** — an asymmetric flag would either cripple arm B or dissolve arm A —
 * and is recorded verbatim in the snapshot so a reader can see what was actually run.
 */
export const INVOCATION = Object.freeze(["--print", "--permission-mode", "acceptEdits"]);

/** The standalone flag that dissolves the treatment outright. */
const FORBIDDEN_FLAGS = ["--dangerously-skip-permissions"];

/** Permission modes that dissolve arm A's compiled enforcement, whichever spelling carries them. */
const FORBIDDEN_MODES = ["bypasspermissions"];

/**
 * Every reason this invocation would dissolve the treatment, read as **argv** rather than as strings.
 *
 * **A token scan does not work here, and the first cut was one.** `--permission-mode` takes its value in
 * either of two spellings, and a flag list matching whole tokens caught `--permission-mode=bypassPermissions`
 * while **`--permission-mode bypassPermissions` — two separate argv entries, the ordinary form — went
 * straight through.** A baseline could then have been recorded over an arm with its enforcement
 * bypassed, by the guard whose entire job is to prevent exactly that. Worse, the `startsWith(f + "=")`
 * arm was dead for any flag that already contained `=`. Found by Copilot round 1 on
 * [#377](https://github.com/sleepy-panda-srl/portulan/pull/377).
 *
 * So this walks the argv the way the host does: a standalone forbidden flag, or a `--permission-mode`
 * whose **value** is forbidden, in either spelling. The mode is compared case-insensitively, because a
 * guard that a capital letter defeats is a guard about spelling.
 */
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

/** How long one turn may take before it is a did-not-complete rather than a verdict. */
export const TURN_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * The one-time state a fresh operator directory does not have, written identically into **both** arms.
 *
 * **Measured: the first real smoke turn hung.** `isolatedEnv()` hands each turn an empty `HOME` and an
 * empty `CLAUDE_CONFIG_DIR`, so the host runs its first-run flow — onboarding, and a trust prompt for a
 * directory it has never seen — and `--print` has nobody to answer it. A ten-minute timeout then turns a
 * two-second question into a ten-minute hang, forty times over.
 *
 * **This is harness setup, and it is bounded so it cannot become treatment.** It touches onboarding and
 * trust and **nothing else**: no permission mode, no hook, no tool allow-list, no model. Arm A's compiled
 * enforcement lives in the arm's own `.claude/settings.json` and nothing here reaches it, and the same
 * bytes go to both arms — `seedOperator()` takes no arm argument, which is a mechanical reason rather
 * than a promise.
 */
export const OPERATOR_SEED = Object.freeze({
    hasCompletedOnboarding: true,
    bypassPermissionsModeAccepted: false,
    hasTrustDialogAccepted: true,
});

/** Write that state into one turn's operator directory. **No arm argument, by construction.** */
export function seedOperator(operatorDir) {
    const home = path.join(operatorDir, "home");
    fs.mkdirSync(home, { recursive: true });
    fs.mkdirSync(path.join(operatorDir, "claude"), { recursive: true });
    fs.writeFileSync(path.join(home, ".claude.json"), JSON.stringify(OPERATOR_SEED, null, 2) + "\n");
    return path.join(home, ".claude.json");
}

/**
 * The credential channels `./ab.mjs` distinguishes. Exactly one must be set: they are three
 * distinguishable auth paths, and a baseline that does not name the one it used is a figure whose
 * conditions nobody can restate.
 */
export const CREDENTIAL_VARS = ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"];

/**
 * The limitation block every rendered record carries, **citing** `../evals/ab/corpus.md` rather than
 * restating it.
 *
 * That file is the **registered** carrier of the A/B clause's subject in
 * `../.portulan/rule-carriers.json`, no tell covers the widened wording, and a paraphrase here would be
 * an unregistered fifth carrier by construction — the exact failure its own registration section
 * documents.
 */
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
    "- **The model that produced these turns is not recorded.** The snapshot names the CLI but not the",
    "  model, and `ANTHROPIC_MODEL` crosses into an isolated arm untouched. This module's own bar is that a",
    "  baseline naming no host is a figure with no conditions; this one names the host and not the model.",
];

// ---------------------------------------------------------------- the matrix

/** One cell's identity. Ordered so a snapshot re-rendered from the same data is byte-stable. */
export function turnIds(k = K) {
    const ids = [];
    for (const scenario of holdingScenarios()) {
        for (const arm of ["a", "b"]) {
            for (let run = 0; run < k; run += 1) ids.push({ scenario: scenario.id, arm, run });
        }
    }
    return ids;
}

/**
 * The credential channel in this environment, refusing anything but exactly one.
 *
 * **What it cannot see is named rather than implied**, on `./ab.mjs`'s measurement: a Bedrock or Vertex
 * configuration, and an `apiKeyHelper` living in the config directory the isolation replaces, are
 * channels these three variables do not cover.
 */
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

/** The `claude` CLI's version string, recorded so a baseline names the host it was taken on. */
export function agentVersion(agent = "claude") {
    const r = spawnSync(agent, ["--version"], { encoding: "utf8", timeout: 60_000 });
    if (r.error || r.status !== 0) throw new CouldNotRun(`\`${agent} --version\` did not answer — ${r.error?.code ?? `exit ${r.status}`}. A baseline that cannot name its host is a figure with no conditions`);
    // **Exit 0 and nothing on stdout is not a name.** A CLI that printed its version to stderr, or
    // printed nothing at all, would have been recorded as `agentVersion: ""` — which satisfies the
    // sentence above in form and defeats it in fact. Copilot round 1 on #377.
    const line = (r.stdout ?? "").trim().split("\n")[0]?.trim() ?? "";
    if (line === "") throw new CouldNotRun(`\`${agent} --version\` exited 0 and printed nothing on stdout, so this baseline would name no host — which is the condition the check above exists to prevent, not a version`);
    return line;
}

/**
 * Run **one** turn, in a tree and an operator directory that belong to it alone.
 *
 * **A turn that does not complete is a `did-not-complete`, never a verdict.** The tree is still graded —
 * an arm that half-finished and then died left something behind, and the grader is the authority on what
 * — but the turn's own state is recorded beside the verdict rather than replacing it.
 */
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
        // **stdin is closed, deliberately.** A prompt this harness cannot answer must fail fast and say
        // what it wanted, not wait out the timeout: the first real smoke turn hung on exactly that, and
        // a hang and a refusal are indistinguishable from outside until the clock runs out.
        stdio: ["ignore", "pipe", "pipe"],
    });
    const wallMs = Date.now() - started;
    if (result.error && result.error.code === "ENOENT") {
        throw new CouldNotRun(`\`${agent}\` could not run — ${result.error.code}. Without an agent there is no turn, which is not the same as a turn that failed`);
    }
    return {
        completed: result.status === 0,
        exit: result.status,
        timedOut: result.error?.code === "ETIMEDOUT",
        wallMs,
        // The first line only, and never graded: it is here so a reader can tell a login failure from a
        // refusal to act. `../evals/ab/corpus.md` grades the tree an arm left behind, never its prose.
        // stderr FIRST, and never graded: a turn that failed is usually explained there while stdout is
        // empty, and reporting only stdout is how "it hung" gets recorded instead of the reason.
        said: [(result.stderr ?? "").trim(), (result.stdout ?? "").trim()].filter(Boolean).join(" | ").split("\n")[0]?.slice(0, 300) ?? "",
    };
}

/**
 * Where a completed turn is written the moment it finishes, keyed by its own id.
 *
 * **Two things needed this and the second one is a correctness defect the smoke gate exposed.**
 *
 * The smoke gate printed *"these turns ARE run 0 of their cells and count toward the matrix"* — the
 * pre-declaration the maintainer's smoke-first ruling requires, so that deciding after seeing a turn
 * cannot be selection. **And `--matrix` re-spawned every id including run 0**, so the sentence was false
 * and the run would have spawned one id twice: the thing this instrument forbids, in the mode that
 * announces it forbids it. A journal makes the sentence true — a turn already recorded under this seed
 * is **reused, never re-run**.
 *
 * The second reason is duller and just as real: forty turns at the smoke gate's measured pace is a
 * half-hour of wall time, and a run that loses everything to one crash is a run nobody dares start.
 *
 * The nonce is part of the key by being checked, not by being in the filename: a journal entry from a
 * different seed describes a different experiment and is ignored rather than silently adopted.
 */
export function journalPath(into, id) {
    return path.join(into, "journal", `${id.scenario}__${id.arm}__${id.run}.json`);
}

/**
 * A turn already taken under this seed **and this invocation**, or `null`.
 *
 * **The invocation is part of the experiment, so a turn taken under a different one is a different
 * experiment.** This is not hypothetical: the first two smoke turns ran under `--print` alone and left
 * both arms inert, and reusing them after the invocation gained `acceptEdits` would have folded turns
 * that could not act into a rate about turns that could.
 */
export function readJournal(into, id, seed, invocation = INVOCATION) {
    const file = journalPath(into, id);
    let entry;
    try {
        entry = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (cause) {
        if (cause.code === "ENOENT") return null;
        throw new CouldNotRun(`${file} could not be read — ${cause.code ?? cause.message}. A journal that cannot be read is not an absent one`);
    }
    // A different seed is a different experiment. Ignored rather than adopted, and said out loud.
    if (entry.nonce !== nonceFor(id.scenario, id.arm, id.run, seed)) return null;
    if (JSON.stringify(entry.invocation ?? null) !== JSON.stringify([...invocation])) return null;
    return entry;
}

// ---------------------------------------------------------------- aggregation

/**
 * Fold the per-turn records into per-cell counts.
 *
 * **The compliant verdict is read from `./ab-grade.mjs`'s declared mapping**, never re-typed here: two
 * carriers of *which verdict counts as compliance* is the defect this milestone has met at every level,
 * and the last place to reintroduce it is the file that publishes the rate.
 */
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

/** The renderer. The register is this function's output and nothing else, which is what makes the byte-compare mean something. */
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
    lines.push(`- **Operator environment:** isolated, a fresh home and config directory **per turn** (${snap.turns.length} of them)`);
    lines.push(`- **Credential channel:** \`${snap.credentialChannel}\` — one of three distinguishable auth paths`);
    lines.push(`- **Agent:** \`${snap.agentVersion}\``);
    lines.push(`- **Invocation, identical for both arms:** \`claude ${snap.invocation.join(" ")} <prompt>\``);
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
            `| \`${t.scenario}\` | ${t.arm.toUpperCase()} | ${t.run} | ${t.completed ? `\`${t.verdict ?? "could-not-attribute"}\`` : "**did-not-complete**"} | ` +
                `${t.attempted === null ? "—" : t.attempted} | ${t.exit === null ? "—" : t.exit} | ${t.wallMs} |`,
        );
    }
    lines.push("");
    lines.push(...LIMITATIONS);
    lines.push("");
    return `${lines.join("\n")}\n`;
}

/** The shape and arithmetic checks a rail can run without an agent. */
export function verify(snap) {
    const red = [];
    if (snap?.portulan?.abBaseline !== "1") red.push("the snapshot does not declare `portulan.abBaseline: \"1\"` — this is not a baseline capture");
    if (snap.operatorEnv !== "isolated") {
        red.push(`the snapshot records \`operatorEnv: ${JSON.stringify(snap.operatorEnv)}\` — no baseline may be recorded under an unisolated arm (evals/ab/corpus.md, and cli/ab.mjs's acceptedUnder.scope)`);
    }
    for (const found of dissolvesTheTreatment(snap.invocation ?? [])) {
        red.push(`the recorded invocation carries ${found}, which dissolves arm A's compiled enforcement`);
    }
    // **The RULED k, not merely the recorded one.** `K`'s docblock said `--verify` checks totality
    // against it and `--verify` checked against `snap.k` — so a snapshot with every run-4 turn deleted
    // and `k: 4` written beside it folded cleanly and passed, and the register would have printed
    // "k: 4 … ruled by the maintainer" over a ruling that said five. Demonstrated at the pre-commit
    // checkpoint, which is where a docblock's claim about its own rail should be attacked.
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

// ---------------------------------------------------------------- the CLI

const USAGE = `portulan-ab-run — run the A/B matrix and record the baseline. THE ONLY MODULE HERE THAT SPAWNS AN AGENT.

  node cli/ab-run.mjs --matrix --seed <s> [--k <n>] [--into <dir>] [--repo-root <dir>]
  node cli/ab-run.mjs --smoke --seed <s> [--scenario <id>] [--into <dir>] [--repo-root <dir>]
                                        [--turn-timeout <s>] [--agent <path>]
  node cli/ab-run.mjs --verify [--repo-root <dir>]
  node cli/ab-run.mjs --write [--repo-root <dir>]

  --matrix   run every (scenario, arm, run) and write ${SNAPSHOT} and ${REGISTER}.
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
  --write    re-render ${REGISTER} from the committed snapshot. Runs no agent.

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
                // Short for a smoke gate, long for the matrix: a hang that costs ten minutes teaches
                // nothing a sixty-second refusal does not.
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
            const rendered = renderRegister(snap);
            if (parsed.mode === "write") {
                fs.writeFileSync(path.join(repoRoot, REGISTER), rendered);
                stdout.write(`ab-run: wrote ${REGISTER} from ${SNAPSHOT}\n`);
                return 0;
            }
            const red = verify(snap);
            const onDisk = fs.existsSync(path.join(repoRoot, REGISTER)) ? fs.readFileSync(path.join(repoRoot, REGISTER), "utf8") : null;
            if (onDisk === null) red.push(`${REGISTER} is missing — render it with \`node cli/ab-run.mjs --write\``);
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

        // Computed ONCE, outside the loop: it is a property of the tree, and asking git forty times
        // would be forty answers to one question.
        const workspace = path.join(repoRoot, ".portulan");
        const tracked = trackedUnder(repoRoot, workspace);

        stdout.write(`ab-run: ${ids.length} turn(s), isolated, credential ${channel}, agent ${version}\n`);
        const turns = [];
        let consecutiveFailures = 0;
        for (const id of ids) {
            const nonce = nonceFor(id.scenario, id.arm, id.run, parsed.seed);
            const armRoot = path.join(into, "trees", id.scenario, id.arm, String(id.run));
            const operatorDir = path.join(into, "operators", id.scenario, id.arm, String(id.run));
            fs.mkdirSync(path.dirname(armRoot), { recursive: true });
            // **`tracked` is not optional here, and the first smoke turn proved it.** `stage()` audits
            // the `personas/` `mayBeAbsent` disposition on its stated REASON — that git carries nothing
            // under the path — and only git can answer that, so an absent tracked set is *nobody asked*
            // and exit 2 rather than a pass. `./ab.mjs --construct` has always passed it; this module
            // did not, and every arm A refused before a turn ran.
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
                completed: turn.completed,
                exit: turn.exit,
                timedOut: turn.timedOut,
                wallMs: turn.wallMs,
                said: turn.said,
                // Recorded per turn, not only per run: the journal has to be able to tell a turn taken
                // under one invocation from a turn taken under another.
                invocation: [...INVOCATION],
                verdict: graded?.attributed ? graded.verdict : null,
                // **Liveness is read from the per-scenario artifact, never from the verdict** —
                // `./ab-grade.mjs`'s rule, and the reason it exists is that two of the four scenarios
                // are compliant when an arm does nothing at all.
                attempted: graded?.attributed ? ATTEMPTED[id.scenario](armRoot, nonce) : null,
                evidence: graded?.evidence ?? [],
            });
            // Journalled the moment it finishes, so a crash costs one turn rather than all of them, and
            // so a smoke turn is genuinely run 0 rather than a claim that it is.
            fs.mkdirSync(path.dirname(journalPath(into, id)), { recursive: true });
            fs.writeFileSync(journalPath(into, id), `${JSON.stringify(turns[turns.length - 1], null, 2)}\n`);
            const attempted = turns[turns.length - 1].attempted;
            stdout.write(
                `ab-run:   ${id.scenario}/${id.arm}/${id.run} — ${turn.completed ? (graded?.verdict ?? "could-not-attribute") : `did-not-complete (exit ${turn.exit})`}` +
                    ` · attempted ${attempted} · ${turn.wallMs}ms\n`,
            );
            // **What the turn said, on every smoke turn.** The first real smoke gate reported two
            // completed turns that had changed nothing, and the reason was not in the output — so the
            // next diagnostic would have cost two more turns. A gate that cannot say WHY is a gate that
            // gets run twice.
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
            agentVersion: version,
            // **Captured from here on, and absent from the first baseline** — the pre-commit checkpoint
            // found that the snapshot named the CLI and not the model, while `ANTHROPIC_MODEL` crosses
            // into an isolated arm untouched. The gap in the 2026-08-31 capture is named in its
            // limitation block rather than back-filled: a snapshot amended after the fact is not a
            // capture. `null` where the operator set nothing, which is itself the condition.
            model: process.env.ANTHROPIC_MODEL ?? null,
            invocation: [...INVOCATION],
            turnTimeoutMs: parsed.turnTimeoutMs,
            rulings: { k: "2026-08-31", smokeFirst: "2026-08-31" },
            turns,
            cells: aggregate(turns, parsed.k),
        };
        fs.writeFileSync(path.join(repoRoot, SNAPSHOT), `${JSON.stringify(snap, null, 2)}\n`);
        fs.writeFileSync(path.join(repoRoot, REGISTER), renderRegister(snap));
        stdout.write(`ab-run: wrote ${SNAPSHOT} and ${REGISTER}\n`);
        stdout.write("ab-run: k=5 supports a recorded rate and nothing else. The register says so in its own voice.\n");
        return 0;
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

// The entry guard in the one spelling that survives a path containing a space — see ./ab.mjs.
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
