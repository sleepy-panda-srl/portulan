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

/**
 * What a truncated `said` ends with. **It was a bare literal at the cutter and in the limitation
 * that describes it, and this commit adds a third site holding those two to each other** — one
 * character three places must agree on, in a module that names `K`, `INVOCATION` and `TURN_TIMEOUT_MS`.
 */
export const TRUNCATION_MARKER = "…";

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
 * Is this a turn-shaped thing at all? **One carrier, because guarding per site was tried and was
 * incomplete.** Round 1 wrote `(t ?? {})` at the two `in` sites, which reads as total and is not: `??`
 * catches `null` and `undefined`, and `"x" in "str"` throws just as loudly on a primitive. Two other
 * predicates read `t.saidTruncated` with no guard at all.
 *
 * A malformed turn must arrive at `verifyShape()` as a **finding**; a TypeError out of `limitationsFor()`
 * reaches the operator as *cannot be rendered*, which is an exception standing in for a shape finding —
 * the class this module has spent three sessions removing. Copilot rounds 1 and 2, the second catching
 * what the first fix left.
 */
const isTurn = (t) => t !== null && typeof t === "object";

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
];

/**
 * The limitations **this** snapshot carries — the fixed block, plus whatever is true of this capture.
 *
 * **A limitation stated unconditionally about a field the capture may or may not hold is a false
 * sentence waiting for its first counterexample.** The model bullet was written flat, and `--matrix`
 * had just started recording `model`: the next baseline would have published *"the model is not
 * recorded"* over a snapshot that recorded it. That is this milestone's own signature defect — prose
 * outrunning the mechanism — in the block whose whole job is to be exactly true. Copilot round 2 on
 * [#377](https://github.com/sleepy-panda-srl/portulan/pull/377).
 *
 * **The second instance is sharper than the first, and it is why #388 was not an off-by-one.** A
 * limitation can also be false by being asserted through a **PROXY** — the truncation bullet asked
 * *does this capture predate the marker* and answered by measuring a string length. The proxy held for
 * the one capture that existed and broke for the first one that recorded the field. A limitation must
 * be keyed to the fact it claims, not to a correlate of it that happens to agree today.
 */
export function limitationsFor(snap) {
    const lines = [...LIMITATIONS];
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
    // **The bullet carries its own evidence.** It claims rows "are marked `…` where they are", and round
    // 3 made the flag EXACT (`=== true`, not truthy) without making it EVIDENCED — so a row flagged
    // truncated whose `said` does not end with the marker still published the claim. `verifyShape()`
    // reds that, but `renderRegister()` is exported and reachable without it, and a bullet whose truth
    // depends on a check the caller may not have run is the shape of defect this whole change is about.
    // The predicate now IS the claim: some row is flagged and carries the marker. Copilot round 6.
    if (snap.turns?.some?.((t) => isTurn(t) && t.saidTruncated === true && typeof t.said === "string" && t.said.endsWith(TRUNCATION_MARKER))) {
        lines.push(
            `- **Some \`said\` rows in the capture are truncated**, and are marked \`${TRUNCATION_MARKER}\` where they are. They are`,
            "  diagnostic prose, never graded — `evals/ab/corpus.md` grades the tree an arm left behind.",
        );
        // **This `300` is the PRE-MARKER cutter's cap and must never be aligned with, shared with, or
        // moved alongside `runTurn()`'s.** They are different constants that happen to be equal: that one
        // is today's cap and may move, this one is frozen forever, because exactly one pre-marker capture
        // exists and it cannot be re-taken. Measured at the session-open checkpoint — setting both to 500
        // reds `ab-run.sh`. A reader who "tidies" them into one constant gets a register drift and fixes
        // it by re-rendering the record, which is the wrong repair.
        //
        // **And the guard above it is the whole of #388.** That issue named an off-by-one; there is none.
        // The branch asks *does this capture predate the marker* and answered by measuring a string, so a
        // modern capture recording `saidTruncated` everywhere and holding a row of exactly 300 published
        // that it predates a marker it carried. The vintage question is now asked directly. **#388's own
        // named fix — aligning the two comparisons — is a REGRESSION**: it deletes this true limitation
        // from the committed register, whose four rows sit at exactly 300 with none above it.
    // Guarded by `isTurn`, not by `?? {}`: `in` throws on a primitive right-hand side too, so the
    // round-1 patch read as total and was not. A malformed capture must reach `verifyShape()` as a
    // FINDING, never as a TypeError caught by the renderer's guard. Copilot rounds 1 and 2.
    } else if (!snap.turns?.some?.((t) => isTurn(t) && "saidTruncated" in t) && snap.turns?.some?.((t) => typeof t?.said === "string" && t.said.length >= 300)) {
        lines.push(
            "- **Some `said` rows in the capture are truncated mid-word and are NOT marked as such** — this",
            "  capture predates the marker. They are diagnostic prose, never graded.",
        );
    }
    return lines;
};

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
    // **ANY spawn failure that is not the timeout is a could-not-run**, not a `did-not-complete`.
    //
    // Only `ENOENT` was refused here, so `EACCES` on a non-executable agent, or `ENOTDIR` on a bad arm
    // root, produced a turn that was folded into a cell as a **behavioural datapoint** — a rate moved by
    // a fact about the filesystem, in the module whose opening comment is that *could-not-run* and *a
    // verdict* are different things. Copilot round 5 on
    // [#377](https://github.com/sleepy-panda-srl/portulan/pull/377).
    //
    // A **timeout is deliberately not in this class**: the agent ran and did not finish in the time this
    // harness allowed, which is a fact about the turn and belongs in the figures as `did-not-complete`.
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
        // The first line only, and never graded: it is here so a reader can tell a login failure from a
        // refusal to act. `../evals/ab/corpus.md` grades the tree an arm left behind, never its prose.
        // stderr FIRST, and never graded: a turn that failed is usually explained there while stdout is
        // empty, and reporting only stdout is how "it hung" gets recorded instead of the reason.
        ...(() => {
            // **Truncation is MARKED.** A mid-word cut with no marker leaves a later reader unable to tell
            // a terse message from a clipped one — and the first capture has several. Copilot round 2.
            const whole = [(result.stderr ?? "").trim(), (result.stdout ?? "").trim()].filter(Boolean).join(" | ").split("\n")[0] ?? "";
            const saidTruncated = whole.length > 300;
            return { said: saidTruncated ? `${whole.slice(0, 300)}${TRUNCATION_MARKER}` : whole, saidTruncated };
        })(),
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
    // **This line said `isolated` as a STRING LITERAL and never read `snap.operatorEnv` at all**, so a
    // capture recording `host` published a document asserting the one condition
    // `../evals/ab/corpus.md` forbids departing from. Not a blind spot in a check — the register
    // making a claim out of a constant.
    //
    // **And a deletion sweep cannot see this class.** A hard-coded claim does not change when you
    // delete the field it purports to describe, so `operatorEnv` measured as *inert* and nothing
    // required it. `verifyShape()`'s residue 4 says "shape is not truth"; this is the sharper form it
    // did not name — **the register can assert a condition it never read.**
    //
    // Rendered from the capture now. Isolated renders exactly what it rendered before, so the
    // committed register does not move; anything else names what was recorded and says plainly that
    // it is not the ruled arm. Absence renders `undefined`, which the derived probe refuses — measured
    // rather than predicted, because the audit classifies by what the renderer does.
    //
    // **What this is worth once both publishing paths run `verify()`:** such a document is never
    // WRITTEN — which is not the same as never rendered. This line is still reached on a `host`
    // capture, three times per `--write`: once by the derived probe inside `verifyShape()`, once by
    // `run()`, and once by `verify()`'s own shape call. The first draft of this comment said "can no
    // longer reach this line at all", which was a claim out of a constant inside the comment explaining
    // a claim out of a constant. Measured at the pre-commit checkpoint. It is worth two things
    // anyway — `renderRegister()` is EXPORTED and callable without either mode, and a reader who opens
    // the register alone is entitled to a document whose conditions come from the capture rather than
    // from the source. Note the boundary honestly: `--matrix` writes `operatorEnv: "isolated"` as a
    // literal too, so this is faithfulness to the CAPTURE and never to the world.
    lines.push(
        snap.operatorEnv === "isolated"
            ? `- **Operator environment:** isolated, a fresh home and config directory **per turn** (${snap.turns.length} of them)`
            : `- **Operator environment:** \`${snap.operatorEnv}\` — **NOT the isolated arm this baseline is ruled to run in** (${snap.turns.length} turns)`,
    );
    lines.push(`- **Credential channel:** \`${snap.credentialChannel}\` — one of three distinguishable auth paths`);
    lines.push(`- **Agent:** \`${snap.agentVersion}\``);
    // Printed here or a reader has to open the JSON to find it, which is where a condition goes to be
    // unread. Absent is stated as absent rather than omitted, because a missing row and a missing fact
    // look identical.
    lines.push(`- **Model:** ${snap.model ? `\`${snap.model}\`` : "**not recorded** — see the limitations below"}`);
    // **The binary is not hard-coded.** It read `claude` while `--agent` names any command the operator
    // passes, so a baseline recorded with a non-default agent published a condition that was simply
    // false. Absent is printed as `<agent>` and named in the limitations, the same shape as `model`,
    // rather than defaulting to a name the capture never recorded. Copilot round 9.
    //
    // **`??` is gone, and the branch is on `=== undefined` alone.** The fallback swallowed `null` as
    // well as absence; the branch does not, and that is deliberate — `${null}` renders the literal
    // string `null` inside the backticked command line, which is a well-formed document the
    // `undefined`/`NaN` probe below cannot see. So `agent`'s by-name check is LOAD-BEARING rather than
    // belt-and-braces: it is the only thing standing between a capture with `agent: null` and a
    // published invocation reading `` `null --print …` ``. `parse()` accepts `--agent ""` too, which is
    // why that check reads *non-empty* string.
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
    // **The aggregate, RENDERED rather than hand-maintained — which is the whole reason it is here.**
    // Three live sentences in `evals/README.md` and `evals/ab/arm.md` carried this sum as prose, typed
    // from a reading of the rows above, with nothing checking them: a re-run would have left all three
    // stale and silent, which is this repository's most-named defect class. Reducing them to citations
    // of this document is only a reduction if THIS document carries the figure — otherwise the citation
    // sends a reader to sum four rows by hand. So the sum is derived here, held by the byte-compare that
    // already holds every other line, and registered as `ab-baseline-figures` in
    // `.portulan/rule-carriers.json`.
    //
    // Looked up per scenario rather than folded with a `filter().reduce()` over `snap.cells`: a filter
    // would silently UNDER-COUNT a capture missing a cell and publish a smaller total as though it were
    // measured. A missing `compliant` folds to `NaN`, which `verifyShape()`'s hole check already refuses.
    //
    // **The missing-cell case is thrown EXPLICITLY, and the first spelling of this got it wrong.** That
    // comment said "`.find()` throws" — `Array.prototype.find()` returns `undefined`, and what threw was
    // the dereference one line later, so the sentence described a mechanism the code did not have and the
    // operator got `Cannot read properties of undefined (reading 'compliant')` for a capture defect. The
    // throw is now deliberate and says which cell is absent; `verifyShape()` still turns it into *cannot
    // be rendered from this capture*, so the guard is inherited rather than restated. Copilot, #379
    // round 1, on both this comment and its twin in the suite.
    //
    // The fold iterates `holdingScenarios()` while the rows table above iterates `snap.cells`, and the
    // two are not the same list. A capture carrying an EXTRA cell — a scenario this build no longer
    // holds — renders a row the total then excludes. `--verify` catches that (it re-folds the cells from
    // the turns), and since #387 `--write` runs `verify()` too — so the path that once published a
    // foreign cell above a total excluding it no longer exists. `holdingScenarios()` remains the right
    // denominator; silently summing whatever a capture happens to carry would still be worse.
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
    // **A total may fold a cell that measured SILENCE, and it must say so.** The contrast table below
    // marks such a cell; a bare sum would launder it into the one figure other documents cite. Two of
    // the four scenarios are compliant when an arm does nothing at all, so a headline carrying them
    // silently is a figure about inaction wearing the clothes of a result.
    //
    // The count AGREES, because this document is meant to be cited verbatim and a register that reads
    // "1 of the cells … carrying them" is one a citing author quietly rewrites — at which point the
    // hand-maintained restatement this whole change removed is back. Copilot, #379 round 2.
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
        // **`??` is gone here too, and this was the worse of the two.** A turn whose `verdict` the
        // capture simply lacks was published as `could-not-attribute` — not a placeholder, but one of
        // this module's three named states, asserted about a turn nothing had graded. `null` is the
        // RECORDED could-not-attribute, which is `aggregate()`'s own definition one screen up, so the
        // branch tests it strictly and an absent verdict now renders a hole the probe refuses. The
        // backticks the `??` form produced are kept: byte-neutral for the committed capture, which
        // records no null verdict, and not byte-neutral for the next one.
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

/**
 * **The fields `renderRegister()` reads as a BRANCH rather than as a value** — the derived probe's
 * blind set, and the whole of it.
 *
 * A branch-read field is one where deleting **every** occurrence renders a document with no
 * `undefined` and no `NaN` in it, that does not throw, and whose **bytes differ**: a perfectly
 * well-formed register in which only the meaning has been invented. The probe at the foot of
 * `verifyShape()` cannot see any of these, and it sees everything else.
 *
 * **This list is declared here and MEASURED in the test, both ways** — a name the probe already covers
 * fails as redundant, and a branch-read leaf nobody named fails as short. That two-way audit is what
 * separates this from the hand-list it replaces: it is not maintained, it is checked, against the
 * renderer, on every run. `ab-run.test.mjs` sweeps `evals/ab/baseline.json`, an enriched fixture and a
 * pre-marker fixture, and requires this set to equal the union of what it measures over all three.
 *
 * **This array is a list of field names. The list of what the check still CANNOT see is four items and
 * lives in `verifyShape()`'s own docblock below** — they are different lists and a pointer that confuses
 * them sends a reader to a frozen array of names to look for a residue that is not there.
 */
export const BRANCH_READ = Object.freeze([
    "agent",
    "invocation[]",
    "model",
    "source.clean",
    "turns[].completed",
    "turns[].said",
    "turns[].saidTruncated",
]);

/**
 * The three of those the committed capture does not record — **permitted absent, checked if present.**
 *
 * `evals/ab/baseline.json` is a capture of events that do not repeat: it cannot be re-captured and it
 * is not edited, so requiring these three would red a record that must not move.
 *
 * **Two of the three announce their own absence and the third does not.** `agent` and `model` each get a
 * limitation bullet, which is why the register says in its own voice that neither is recorded. A missing
 * `saidTruncated`'s absence announces itself only when some `said` is long enough to be evidence
 * that a pre-marker capture's rows were cut — with every row short, absence is **silent**.
 *
 * **The vintage half of that is mechanism now, and the evidence half is still a heuristic.** #388/#389:
 * whether a capture predates the marker is decided by whether any turn records the field, never by a
 * length; but *"some rows are truncated"* is still inferred from a length, and for a pre-marker capture
 * a row that is naturally 300 characters cannot be told from one cut to 300. That is undecidable from
 * the data. The committed capture is the only pre-marker one; **all four of its 300-character rows sit
 * exactly at the cutter's cap with none above it, and one ends mid-word** — `observed-content/a/4` ends
 * *"…which I refused as a lik"*. The bullet says *"Some"*, which needs one, so it is demonstrated rather
 * than assumed. **The universal does not hold and is not claimed**: the other three end on a word or a
 * trailing space, and a naturally-300 row cannot be told from a cut one.
 *
 * **The test audits this set too**: each member must be absent from the committed capture, and every
 * `BRANCH_READ` field that is NOT a member must be present in it. So the exemption is derived from the
 * artifact rather than asserted about it, and it shrinks by itself when a capture records more.
 */
export const PERMITTED_ABSENT = Object.freeze(["agent", "model", "turns[].saidTruncated"]);

/**
 * How a finding names a value it rejected. **`a ${typeof x}` was the first spelling and it was wrong
 * twice over**: ungrammatical for the vowel-initial types (`a object`), and — because `typeof null` is
 * `"object"` — it reported `null` as `a object`, misnaming the likeliest hand-edit there is. A check
 * whose whole contract is that its findings describe the capture accurately cannot misname the thing it
 * is refusing.
 */
function spell(value) {
    if (value === undefined) return "absent";
    if (value === null) return "`null`";
    if (Array.isArray(value)) return "an array";
    return `${/^[aeiou]/.test(typeof value) ? "an" : "a"} ${typeof value}`;
}

/**
 * The structural half — everything `renderRegister()` needs before it may safely touch a snapshot.
 *
 * **It is separate because the caller renders first, and the previous repair fixed the wrong end.**
 * Round 2 made `verify()` report a malformed capture instead of throwing on it; `run()` then called
 * `renderRegister(snap)` **before** `verify(snap)`, so a snapshot missing `source`, `rulings` or `cells`
 * still crashed in the renderer and came back as exit 2 — *could not run* — about a capture the tool was
 * looking straight at. A fix applied at one site and not at the one upstream of it, which is
 * [`../.portulan/proposals/0020`](../.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)
 * for the third time in this milestone. Copilot round 3 on
 * [#377](https://github.com/sleepy-panda-srl/portulan/pull/377).
 *
 * **`--write` runs this check FIRST, and since #387 it runs `verify()` after it.** The sentence here
 * used to read *"`--write` runs no other"*, and that was the defect rather than the design: the mode
 * that publishes the register checked less than the mode that only reports on it, so a capture
 * recording `operatorEnv: "host"` with a forged nonce published at exit 0 and red twice on the next
 * command. The by-name checks still belong **here** rather than in `verify()`, for a reason that
 * survives the repair: this is the check that runs before the renderer is handed the capture, and a
 * shape finding must arrive as a finding rather than as an exception thrown out of `renderRegister()`.
 *
 * ## What this check does NOT see, stated as a list rather than as a number
 *
 * It said *"there is exactly one"* — a boolean — and it was false **inside its own frame and outside
 * it**. Inside: `turns[].completed` is a boolean, was invisible, and rendered `**did-not-complete**`
 * about a turn that recorded no such thing. Outside: `turns[].verdict`, `turns[].said` and the
 * invocation's elements are not booleans and were invisible too — and a missing `verdict` was published
 * as `could-not-attribute`, one of this module's three named states, asserted about a turn nothing had
 * graded. So the count was wrong, and the frame that produced the count was wrong.
 * Found the only way this class ever is — by deleting every field the renderer reads, one at a time,
 * in a context that had not written the check.
 *
 * So, measured rather than reasoned, four things remain uncaught and none of them is closed by
 * pretending otherwise:
 *
 *   1. **`agent`, `model` and `turns[].saidTruncated` deleted from a capture that recorded them.**
 *      `PERMITTED_ABSENT` says why: absence is indistinguishable from the 2026-08-31 vintage. **Not
 *      quite for all three since #389** — `saidTruncated` has an **in-band witness**, so a capture whose
 *      rows carry the marker while no turn records the field is caught by the in-band witness in this
 *      function's body, below. `agent` and `model` have
 *      no such witness, and separating those still needs a declared capture format the maintainer has
 *      not ruled on (filed, not invented here).
 *   2. **A column the producer stops writing.** Row homogeneity catches a row that diverges from its
 *      neighbours; forty rows that agree on missing the same field agree.
 *   3. **A future branch on a field neither swept artifact carries.** The two-way audit measures the
 *      leaves of the capture and the fixture, so a renderer that starts reading something absent from
 *      both is not measured — the staleness moves from the check to the fixture rather than vanishing.
 *      This is exactly what `agent` and `model` were, and the answer is that enriching the fixture is a
 *      hand step that the sweep's own totality claim does not cover.
 *   4. **Shape is not truth.** `source.clean: true` over a dirty tree, or a `captured` naming the wrong
 *      day, passes every check in this file. Nothing here reads the world; it reads the capture.
 */
export function verifyShape(snap) {
    const red = [];
    if (snap?.portulan?.abBaseline !== "1") red.push("the snapshot does not declare `portulan.abBaseline: \"1\"` — this is not a baseline capture");
    if (!Array.isArray(snap?.turns)) red.push(`the snapshot's \`turns\` is ${snap?.turns === undefined ? "absent" : `a ${typeof snap?.turns}`}, not an array — this capture cannot be read as a baseline`);
    if (!Array.isArray(snap?.cells)) red.push("the snapshot's `cells` is not an array — the published figures cannot be compared with a fold of the turns");
    else {
        // **A shape check must be total over what the renderer DEREFERENCES, not merely over the type.**
        // `cells` being an array was checked; the renderer then reached for one cell per (scenario, arm)
        // and dereferenced `.compliant` on it, so a hand-edited capture missing a single arm was still
        // "shape-valid" and still crashed — exit 2 about a capture that deserved a red. The same class as
        // the two rounds before it, one level finer: the guard covered the container and not its
        // contents. Copilot round 4.
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
    // ── THE BRANCH-READ FIELDS, BY NAME. `BRANCH_READ` is the declaration; this is the check. ──────
    //
    // Every one of these is invisible to the derived probe below and to nothing else. A name the probe
    // already covers is NOT added here: that would be two carriers of one policy, and the test audits
    // the set in both directions so a redundant name fails as loudly as a missing one.
    if (snap?.source !== undefined && snap?.source !== null && typeof snap.source.clean !== "boolean") {
        red.push("the snapshot's `source.clean` is not a boolean — it renders as a branch, so its absence would silently publish a claim about the tree that the capture never made");
    }
    // The three the 2026-08-31 capture does not record: **checked if present, permitted if absent**, and
    // `PERMITTED_ABSENT` says why. Present-and-wrong is the half that can be closed, and it is not
    // hypothetical — `parse()` accepts `--agent ""`, and `run()` writes `model: … || null`.
    // **`!== ""` is not the same question as "carries a value", and a whitespace-only string is the
    // difference.** `agent: "   "` renders `` `    --print …` `` — a command line with a blank where the
    // binary goes, no hole in the document, and an emptiness the probe cannot see. Every non-empty test
    // in this check therefore reads `.trim()`, which is the same standard `run()` already applies to
    // `model` (`(… ?? "").trim() || null`) and the one a record should meet if a capture does.
    // Copilot round 1, which named this at four sites at once.
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
            // **The marked bullet claims rows "are marked `…` where they are", so a marked row must
            // carry the marker.** Otherwise the register publishes that claim over a row that falsifies
            // it. A substitution, so the deletion sweep cannot reach it.
            if (t?.saidTruncated === true && typeof t?.said === "string" && !t.said.endsWith(TRUNCATION_MARKER)) {
                red.push(`${id} is marked truncated but its \`said\` does not end with \`${TRUNCATION_MARKER}\` — the register publishes that marked rows carry the marker`);
            }
            // **A VALUE check, not a branch-read one**, and deliberately outside the audited set: the
            // sweep deletes fields, and neither of the two hazards below is a deletion. An absent
            // `verdict` renders a hole now that the `??` is gone; `verdict: ""` renders empty backticks,
            // and `null` is the recorded could-not-attribute that `aggregate()` counts.
            if (t?.verdict !== null && (typeof t?.verdict !== "string" || t.verdict.trim() === "")) {
                red.push(`${id} carries a \`verdict\` that is neither \`null\` nor a non-empty string — \`null\` is how *could-not-attribute* is recorded, and the register prints the rest verbatim`);
            }
        }
    }
    // The same class one level up: a `null` element survives a JSON round-trip and `join(" ")` renders
    // it as nothing, so the published command line is silently SHORTER than the one that ran.
    // **The structural half owes a targeted finding, not a caught exception.** `invocation` was checked
    // only once it was already an array, so an absent or non-array one fell through to the renderer,
    // threw at `.join(" ")`, and reached the operator as *"the register cannot be rendered from this
    // capture — snap.invocation.join is not a function"*. That is red, and it is a JS error message
    // standing in for a shape finding about a field this file names. Copilot round 1.
    if (!Array.isArray(snap?.invocation)) {
        // **`a ${typeof x}` prints `a object`, and prints it for `null` too** — `typeof null` is
        // `"object"`, so the likeliest hand-edit of the four was reported as the one thing it is not.
        // A finding that misnames what it found is the defect this whole check exists to remove, so it
        // is spelled rather than interpolated. Copilot, promoted suppressed note; fixed under the
        // maintainer's grant past the review bound.
        red.push(`the snapshot's \`invocation\` is ${spell(snap?.invocation)}, not an array — the register prints it as the command line both arms ran under`);
    }
    // **`every()` over an EMPTY array is `true`, and that was this check's own blind spot** — the
    // two-way audit below caught it on the first run: emptying `invocation` renders the agent's name
    // followed by nothing at all — `` `<agent>  <prompt>` `` over the committed capture — a command line
    // carrying none of the flags the turns ran under, with no hole for the probe to see.
    // Non-empty is checked before the elements are.
    if (Array.isArray(snap?.invocation) && snap.invocation.length === 0) {
        red.push("the snapshot records an empty `invocation` — the register would publish a command line carrying none of the flags the turns actually ran under");
    }
    // **`every()` SKIPS HOLES, which is the empty-array defect's twin one step along.** A sparse
    // `invocation` — a deleted element rather than a nulled one — has `length` 3 and two entries, and
    // `every()` never visits the gap, so the check passed a capture that renders a command line missing a
    // flag. `Array.from` materialises the holes as `undefined` so they are tested like anything else.
    // Found by the swept single-row case in the suite, not by reading this line. (A JSON round-trip turns
    // a hole into `null`, which was already caught — so this is unreachable from a committed file, and it
    // is fixed anyway: the check should be true of the object it is handed, not of the objects it expects.)
    if (Array.isArray(snap?.invocation) && !Array.from(snap.invocation).every((a) => typeof a === "string" && a.trim() !== "")) {
        // **The message names both renderings, because they are not the same failure.** `null`,
        // `undefined` and a hole `join` to nothing, which SHORTENS the line; a whitespace-only string
        // joins to blank space, which pads it. Saying "renders it as nothing" covered the first and was
        // simply false of the second — a finding message describing a mechanism the code does not have,
        // which is this diff's own subject arriving in its own error text. Copilot round 2.
        red.push("the snapshot's recorded `invocation` holds an element that is not a non-empty string — `join(\" \")` renders `null` and holes as nothing and a blank string as empty space, so the published command line is not the one the turns ran under");
    }

    // **The vacuity one level up, and it is the same defect this file just credited itself with
    // closing.** `for (const t of snap.turns)` over an empty array runs the by-name checks zero times,
    // and the homogeneity loop below skips an empty one — so `turns: []` with the cells left intact was
    // shape-VALID, and `--write` published a register carrying eight full figure rows, an empty per-turn
    // table and *"a fresh home and config directory per turn (0 of them)"*. `verify()` catches it too,
    // and since #387 `--write` runs `verify()` — but this check runs BEFORE the renderer, which is why
    // the by-name checks live here: a shape defect must arrive as a finding, not as a thrown exception.
    // Found at the pre-commit checkpoint, by someone reading the comment above and asking where else the
    // same sentence was true. `cells` gets the same guard for the same reason.
    if (Array.isArray(snap?.turns) && snap.turns.length === 0) {
        red.push("the snapshot records no turns at all — a baseline with an empty matrix publishes figures over a denominator nothing measured");
    }
    if (Array.isArray(snap?.cells) && snap.cells.length === 0) {
        red.push("the snapshot publishes no cells at all — the register's figure tables would render empty beneath their headings");
    }
    // **A SUBSTITUTION, not a deletion, so the sweep cannot reach it**: `Math.round(null / 1000)` is
    // `0`, so a null timeout publishes *"Per-turn timeout: 0s"* — a plausible invented condition with no
    // hole in it. Same shape as `agent: null`, which is guarded a few lines up for the same reason.
    if (snap?.turnTimeoutMs !== undefined && (!Number.isInteger(snap.turnTimeoutMs) || snap.turnTimeoutMs <= 0)) {
        red.push("the snapshot's `turnTimeoutMs` is not a positive integer — it renders through `Math.round`, so `null` would publish a per-turn timeout of `0s` that no run was given");
    }

    // **The converse, and it narrows residue 1.** That residue said the three permitted-absent fields
    // could be separated from a deletion only by a declared capture format. Too strong for
    // `saidTruncated`: the marker is an **in-band witness**. Rows ending in the marker while no turn
    // records the field describe a capture that HAD the field and lost it — which nothing else here
    // would notice, and which the vintage branch would then report as predating a marker its own rows
    // carry. The genuine vintage — marker in neither place — stays permitted, which is what keeps the
    // committed capture green.
    if (Array.isArray(snap?.turns) && snap.turns.length > 0
        && !snap.turns.some((t) => isTurn(t) && "saidTruncated" in t)
        && snap.turns.some((t) => typeof t?.said === "string" && t.said.endsWith(TRUNCATION_MARKER))) {
        red.push(`some turns' \`said\` rows carry the truncation marker while no turn records \`saidTruncated\` — a capture that carries the marker did not predate it, so the field was dropped rather than never written`);
    }
    // **And the row-level disagreement, which the witness above does not reach.** That one asks whether
    // the COLUMN is missing; this asks whether a row's two halves agree. A `said` ending in the marker
    // while its own `saidTruncated` says `false` — or `null` — is a row contradicting itself, and it
    // passed everything: the column is present, so the witness is silent, and the marked-row check runs
    // only when the flag is `true`. The pre-commit checkpoint noted this converse as unclaimed rather
    // than as a defect; Copilot promoted it, correctly. The pair is total now — flag true needs the
    // marker, marker needs the flag true.
    if (Array.isArray(snap?.turns)) {
        for (const t of snap.turns) {
            if (t?.saidTruncated !== undefined && t.saidTruncated !== true
                && typeof t?.said === "string" && t.said.endsWith(TRUNCATION_MARKER)) {
                red.push(`(${t?.scenario}, ${t?.arm}, run ${t?.run}) carries a \`said\` ending in \`${TRUNCATION_MARKER}\` while its \`saidTruncated\` records ${JSON.stringify(t.saidTruncated)} — the row contradicts itself, and the register reads the flag`);
            }
        }
    }

    // ── ROW HOMOGENEITY — derived, and it names no field. ──────────────────────────────────────────
    //
    // Every turn must carry the same key set as every other turn, and likewise every cell, and
    // `verdicts` within a scenario. This closes `nonce`, `timedOut`, `evidence`, `invocation`,
    // `saidTruncated` **and every field added later**, without listing one of them — which is the only
    // form of totality this file has not yet had to rewrite.
    //
    // **Its reach is stated rather than implied: it catches a row that diverges from its neighbours,
    // NOT a column the producer stopped writing.** Measured — `evidence` deleted from one of forty
    // rows reds here; deleted from all forty, nothing fires. That residue is named in `verifyShape`'s
    // docblock rather than papered over, because a mechanism credited with more than it does is the
    // "exactly one" claim in a new costume.
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
        // Per scenario, not globally: each scenario has its OWN verdict vocabulary, so the eight cells
        // carry four different `verdicts` shapes by construction.
        for (const [scenario, shapes] of byScenario) {
            if (shapes.size > 1) red.push(`the cells for \`${scenario}\` publish different \`verdicts\` vocabularies — one scenario has one vocabulary`);
        }
    }
    if (red.length > 0) return red;

    // **The list above is not the check; this is.** Round 4's repair said `verifyShape` was "total over
    // what the renderer dereferences" and then hand-listed `compliant` and `attempted` — missing
    // `source.commit`, `source.clean`, `rulings.k`, and every other cell field the register prints. A
    // hand-maintained list of another function's reads goes stale the moment that function reads one
    // more thing, which is this repository's oldest defect wearing a new costume, and it took a fifth
    // round to stop writing it. Copilot round 6 on
    // [#377](https://github.com/sleepy-panda-srl/portulan/pull/377).
    //
    // So the check is **derived from the renderer**: render, and refuse a document that came out
    // carrying `undefined` or `NaN`. Anything the renderer reads and the capture lacks shows up here
    // without anybody listing it, including reads added later.
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

/** The shape and arithmetic checks a rail can run without an agent. */
export function verify(snap) {
    const red = verifyShape(snap);
    if (red.length > 0) return red;
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

/**
 * How a matrix run publishes its two halves — **one carrier, because they are not symmetric.**
 *
 * The snapshot is forty agent turns of events that do not repeat, so it is written **unconditionally**:
 * a failed check must never be a reason to drop the one artifact nothing can re-derive. The register is
 * a **derived claim**, and a claim the tool cannot stand behind is the one thing it must not publish.
 * Before #387 this path wrote both and asked nothing.
 *
 * **It is a function rather than eight lines inside `run()` because otherwise nothing holds it.** The
 * pre-commit checkpoint reverted the check to `[]` and the entire suite — 79 cases here, 2382 in the
 * tree — stayed green: the centrepiece of that change could be deleted in silence. `run()`'s matrix arm
 * cannot be reached without a repo root, a credential and forty arm constructions, so the rail has to
 * grip somewhere a test can hold. This is that place.
 */
export function publishMatrix({ repoRoot, snap, into, stdout, stderr }) {
    fs.writeFileSync(path.join(repoRoot, SNAPSHOT), `${JSON.stringify(snap, null, 2)}\n`);
    stdout.write(`ab-run: wrote ${SNAPSHOT} — the turns are kept whatever the checks say, because they do not repeat\n`);
    // **Where the journal is, printed here and not only by `--smoke`.** Everything below depends on it
    // for recovery, and `--into` defaults to an unnamed temp directory: a run that fails its checks
    // without saying where its turns are has lost them in practice.
    if (into !== undefined) stdout.write(`ab-run: turns journalled under ${into} — re-run with the same --seed and --into to reuse them, spawning nothing\n`);
    const published = verify(snap);
    if (published.length > 0) {
        stderr.write(`ab-run: ${published.length} finding(s), so ${REGISTER} was NOT written:\n  - ${published.join("\n  - ")}\n`);
        // **Said only when it is true.** Withholding does not leave the register absent — both files are
        // committed, so it leaves the PREVIOUS run's register beside the new capture, a published figure
        // that no longer matches its own data. But when there is no previous register, saying so would
        // be this change asserting a state it never read — the same class it repaired in `--verify`'s
        // remediation string, at a site it had just added. Caught at the pre-commit checkpoint.
        if (fs.existsSync(path.join(repoRoot, REGISTER))) {
            stderr.write(`ab-run: ${REGISTER} is still the PREVIOUS run's and no longer matches ${SNAPSHOT} beside it — \`--verify\` will red until the capture is repaired or reverted\n`);
        }
        return 1;
    }
    fs.writeFileSync(path.join(repoRoot, REGISTER), renderRegister(snap));
    stdout.write(`ab-run: wrote ${REGISTER}\n`);
    // **`k=5` was a string literal here**, so a `--k 3` run announced k=5 — the same defect as the
    // `isolated` literal in the renderer, in the same mode, one line below the write. Derived now.
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
                // **Refused here, before the first spawn, and it used to be refused after the last
                // one.** `verify()` has always known that a matrix at another k is another experiment —
                // but only `--verify` ran it, so the ruling was enforced *after* forty agent turns had
                // been paid for. The parser is where a ruling about how many turns to run belongs.
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
            // **Shape first, render second.** The renderer reaches into `source`, `rulings` and `cells`;
            // handing it a malformed capture turned a red into an exit-2 crash, in the tool whose job is
            // to diagnose malformed captures. `--write` refuses for the same reason rather than emitting
            // a register from a capture it could not read.
            const shape = verifyShape(snap);
            // The shape refusal says what is on disk too. One command answering in two voices, only one
            // of which tells the operator whether anything was written, is a smaller version of the
            // defect this whole change is about. Pre-commit checkpoint.
            if (shape.length > 0) {
                throw new ArmRed(
                    parsed.mode === "write"
                        ? `${shape.length} finding(s), so ${REGISTER} was NOT written:\n  - ${shape.join("\n  - ")}`
                        : `${shape.length} finding(s):\n  - ${shape.join("\n  - ")}`,
                );
            }
            const rendered = renderRegister(snap);
            if (parsed.mode === "write") {
                // **`--write` asks the publishing question now, and it did not.** It ran `verifyShape()`
                // and returned here, so a capture recording `operatorEnv: "host"` with a forged nonce
                // was published at exit 0 and red two ways on the very next command — the mode that
                // publishes checking less than the mode that only reports.
                //
                // **One edge here is load-bearing and it is not the one this comment first claimed.**
                // Shape-before-`verify()` is free — `verify()` calls `verifyShape()` itself, and
                // reordering the two produces byte-identical output, measured. What must not move is
                // `verifyShape()` before the UNGUARDED `renderRegister()` a few lines up: #377 round 3
                // shipped that inverse and a malformed capture crashed inside the renderer, returning
                // exit 2 — *could not run* — about a capture the tool was looking straight at. Stating
                // the wrong constraint would have had the next maintainer defend a rule that is not one.
                const published = verify(snap);
                if (published.length > 0) throw new ArmRed(`${published.length} finding(s), so ${REGISTER} was NOT written:\n  - ${published.join("\n  - ")}`);
                fs.writeFileSync(path.join(repoRoot, REGISTER), rendered);
                stdout.write(`ab-run: wrote ${REGISTER} from ${SNAPSHOT}\n`);
                return 0;
            }
            const red = verify(snap);
            const onDisk = fs.existsSync(path.join(repoRoot, REGISTER)) ? fs.readFileSync(path.join(repoRoot, REGISTER), "utf8") : null;
            // **The remedy is named only when it will work.** This said *"render it with `--write`"*
            // unconditionally; now that `--write` runs `verify()`, a red capture makes that a remedy the
            // same run refuses — a message the tree falsifies the moment anyone follows it. So the
            // findings decide which sentence is true. Caught at the session-open checkpoint.
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
                // **The turn is SPREAD, not re-listed field by field.** It was enumerated by hand, and
                // the hand-list dropped `saidTruncated` — so `limitationsFor()`'s marked-truncation
                // branch could never fire and **every future capture would report "predates the
                // marker"**, indefinitely and falsely. That is the hand-listing defect this pull request
                // has now met at four sites, in the one place it silently disables a rail rather than
                // merely going stale. Copilot round 8 on
                // [#377](https://github.com/sleepy-panda-srl/portulan/pull/377).
                //
                // Spreading means a field added to `runTurn()`'s answer reaches the record without
                // anyone remembering to add it here, and `./ab-run.test.mjs` asserts the record carries
                // every key the turn returned.
                ...turn,
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
            // **Captured from here on, and absent from the first baseline** — the pre-commit checkpoint
            // found that the snapshot named the CLI and not the model, while `ANTHROPIC_MODEL` crosses
            // into an isolated arm untouched. The gap in the 2026-08-31 capture is named in its
            // limitation block rather than back-filled: a snapshot amended after the fact is not a
            // capture. `null` where the operator set nothing, which is itself the condition.
            // **Blank is `null`, not `""`.** A variable set to an empty or whitespace string would be
            // recorded as `model: ""` while `limitationsFor()`'s `!snap.model` read it as absent — a
            // capture contradicting its own register, which is the drift this pair of files exists to
            // make impossible. Copilot round 3.
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
