#!/usr/bin/env node
// `compile` — the enforcement compiler.
//
//   node cli/compile.mjs [--workspace <dir>] [--check]
//
// Exit 0 wrote (or, with --check, agrees) · 1 the artifact has drifted · 2 could not run.
//
// Reads a workspace's gate policy (`gates.json`) and emits host enforcement. Today one backend:
// Claude Code `permissions` + `hooks`. The tier vocabulary and the action vocabulary are the
// WORKSPACE's, never a host's — a rule says `{"shell": "git push"}`, not `Bash(git push:*)` — so a
// second backend translates the same policy rather than forcing the policy to be rewritten. That
// separation is the whole of "LLM-agnostic by construction" (../docs/vision.md) at this layer, and
// it is cheapest to hold while exactly one backend exists.
//
// ## Two layers, and which one is load-bearing
//
// Every gate is emitted TWICE: as a permission rule and as a hook. That is not belt-and-braces for
// its own sake — it was measured. On CLI 2.1.220 a hook that CRASHES fails OPEN: the tool runs
// normally, on the identical wiring that blocked when the hook was healthy. A permission rule does
// not fail open. So the permission rule is the gate and the hook is the sentence a human reads;
// a design resting on hooks alone would be a gate that a syntax error silently removes.
//
// ## Why `ask` rather than `deny` for the Gated tier
//
// ../.portulan/gate-map.md defines Gated as "explicit human approval, per action, before it
// happens" — which is what `ask` is: interactively it prompts; headless, where nobody can approve,
// it blocks. Compiling Gated to `deny` would be the *prohibition* semantics wearing the Gated
// tier's name, and it would make the tier above it — the constitution, which has no approval path
// at all — indistinguishable from an ordinary push.
//
// ## What this file cannot tell you
//
// That the host honours what it emits. A schema-valid settings file the host ignores is
// indistinguishable, from in here, from one it enforces — see
// ../.portulan/memory/a-manifest-field-can-validate-and-load-nothing.md, which cost a milestone.
// The host behaviours above were measured against a running host on 2026-07-27 and are recorded in
// ../.portulan/compile/README.md with their probes. Re-measure on upgrade.
//
// Zero dependencies, no network, no install step — same constraints as ./doctor.mjs.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Raised when `compile` cannot run, or cannot compile honestly. Always exit 2, never 1. */
export class CompileError extends Error {
    constructor(message) {
        super(message);
        this.name = "CompileError";
    }
}

// The versions of the Workspace Definition whose gate policy this compiler understands. Checked
// rather than ignored: `doctor` shipped for a day reading no version at all, so a manifest naming a
// spec that had never existed validated green. Same class of hole, closed at birth this time.
const KNOWN_SPECS = new Set(["2.1"]);

const TIERS = new Set(["auto", "propose", "gated", "prohibited"]);

// Which tiers are gates. `auto` and `propose` are refused wholesale, on the maintainer's ruling of
// 2026-07-27: the compiler emits restriction only, never permission. A compiler whose output can
// only ever ADD a gate cannot loosen an existing check by having a bug — and the alternative,
// emitting `allow` for the Auto tier, would silence prompts the maintainer answers by hand today.
const GATE_TIERS = new Set(["gated", "prohibited"]);

const TIER_NOT_A_GATE = {
    auto: "tier `auto` is unattended by definition — there is nothing to enforce, and emitting an allow rule would loosen a check rather than add one",
    propose: "tier `propose` is enforced by the platform floor — pull requests, required checks, review — not by a tool-level permission rule on this machine",
};

// ===========================================================================================
// Autonomy MODES — how often the development cycle stops
// ===========================================================================================
//
// A **tier** says what an action IS: how hard it is to undo. It is decided per action and it does
// not move. A **mode** says how often the *development cycle* stops for approval. It is decided per
// workspace, and a session may tighten its own. The two are different axes and the doctrine is in
// ../core/operating/autonomy.md; what follows is the mechanism.
//
//   auto    no checkpoint anywhere in the cycle, including the last step
//   gated   unattended until the ship step, which asks once
//   strict  every push asks, and so does the ship step
//
// **They share two words with the tiers, and that collision is deliberate rather than accidental** —
// the maintainer named the modes Auto / Gated / Strict on 2026-07-27. The names are kept as ruled and
// the ambiguity is closed structurally instead: a tier is a *rule's* field, a mode is the *policy's*,
// and the two never appear in the same position. Anywhere prose must say both, it says "the Auto
// tier" or "Auto mode" and never the bare word.
//
// ## What a mode may and may not move
//
// A mode may move a rule between `auto`, `propose` and `gated`. It may **not** reach `prohibited` in
// either direction. That is the whole reason the fourth tier exists: it is the tier no approval
// unlocks, and a mode that could grant or revoke it would turn "no agent edits the constitution"
// into a setting. Enforced below, not promised.
//
// A mode also reaches only the rules that OPT IN, by declaring a mode-keyed tier instead of a scalar
// one. Everything else is mode-invariant — repository settings, deletions, releases, spending. Those
// are irreversible rather than ceremonial, and how often a team wants to be asked about its own
// development loop says nothing about whether deleting a repository is recoverable.
//
// ## Non-loosening, enforced
//
// The three modes are ordered, so a mode-keyed tier must not get *looser* as the mode gets stricter.
// Without that rail a policy could declare Strict more permissive than Auto and every document
// describing the modes would be false while the compiler reported green — the exact shape of
// ../.portulan/memory/a-stated-enforcer-must-be-the-real-one.md.

/** The three modes, ordered from the least ceremony to the most. */
export const MODES = new Set(["auto", "gated", "strict"]);

/** How strict each mode is. Only used to compare two modes; never exposed as a tier. */
const MODE_STRICTNESS = { auto: 0, gated: 1, strict: 2 };

/**
 * The tiers a mode may move a rule between, ordered.
 *
 * `prohibited` is deliberately absent, and its absence is the enforcement: a mode-keyed tier naming
 * it has no rank, so the check below refuses rather than comparing against `undefined`.
 */
export const STRICTNESS = { auto: 0, propose: 1, gated: 2 };

/**
 * The mode a policy declares.
 *
 * A policy that says nothing gets **`strict`**, not `auto`. Silence is not a licence: the safest
 * reading of "nobody chose" is the one that asks most often, and a default that ran unattended
 * because a key was missing would be a gate removed by an omission.
 */
export function declaredMode(policy) {
    const declared = policy?.mode;
    if (declared === undefined || declared === null) return "strict";
    if (typeof declared !== "string" || !MODES.has(declared)) {
        throw new CompileError(
            `the gate policy declares mode ${JSON.stringify(declared)}, which is not one of ${[...MODES].join(" / ")}. ` +
                `An unrecognised mode is not a setting to ignore — ignoring it would run the cycle at a checkpoint frequency nobody chose.`,
        );
    }
    return declared;
}

/** Refuse a mode-keyed tier that cannot mean what it appears to. Returns the map when it is sound. */
function checkModeTier(id, map) {
    const named = Object.keys(map);
    const missing = [...MODES].filter((m) => !named.includes(m));
    const unknown = named.filter((m) => !MODES.has(m));
    if (missing.length || unknown.length) {
        throw new CompileError(
            `rule \`${id}\` declares a mode-keyed tier naming ${JSON.stringify(named)}, but a mode-keyed tier must name ` +
                `exactly ${[...MODES].join(", ")}` +
                `${missing.length ? ` (missing: ${missing.join(", ")})` : ""}${unknown.length ? ` (unknown: ${unknown.join(", ")})` : ""}. ` +
                `No mode may be left to a default — the posture of every mode is the thing a reviewer is here to read.`,
        );
    }
    for (const mode of MODES) {
        const tier = map[mode];
        if (!TIERS.has(tier)) {
            throw new CompileError(`rule \`${id}\` declares tier ${JSON.stringify(tier)} for mode \`${mode}\`, which is not a tier`);
        }
        if (tier === "prohibited") {
            throw new CompileError(
                `rule \`${id}\` puts tier \`prohibited\` behind mode \`${mode}\`. A mode may never reach the Prohibited tier: ` +
                    `prohibited means no approval exists, and a prohibition a setting can grant or revoke is the Gated tier ` +
                    `wearing its name. Modes move rules between ${Object.keys(STRICTNESS).join(", ")} only.`,
            );
        }
    }
    const ranks = [...MODES].map((m) => STRICTNESS[map[m]]);
    for (let i = 1; i < ranks.length; i += 1) {
        if (ranks[i] < ranks[i - 1]) {
            const order = [...MODES];
            throw new CompileError(
                `rule \`${id}\` is looser at mode \`${order[i]}\` (${map[order[i]]}) than at mode \`${order[i - 1]}\` ` +
                    `(${map[order[i - 1]]}). The modes are ordered, so a stricter mode may never relax what a laxer one gates — ` +
                    `otherwise the names lie and every document describing them is false while this compiler reports green.`,
            );
        }
    }
    return map;
}

/**
 * The tier a rule holds at a given mode.
 *
 * A scalar `tier` is mode-invariant and answers the same at every mode. A mode-keyed `tier` is an
 * object naming all three. There is never a second statement of a rule's tier to fall out of sync
 * with the first — the rule carries one shape or the other, never both.
 */
export function resolveTier(rule, mode) {
    const tier = rule?.tier;
    if (typeof tier === "string") return tier;
    if (tier && typeof tier === "object" && !Array.isArray(tier)) {
        return checkModeTier(rule.id, tier)[mode];
    }
    throw new CompileError(`rule \`${rule?.id}\` declares tier ${JSON.stringify(tier)}, which is neither a tier nor a mode-keyed map of them`);
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// The `filePath` shape from ../spec/workspace.schema.json, carried here rather than imported because
// this file has no dependencies by design. Relative, no fragment/query/colon, not a directory.
const FILE_PATH = /^[^#?:/]([^#?:]*[^#?:/])?$/;

/** The tools that can write a path, and the tools that can read one. */
const WRITE_TOOLS = ["Edit", "Write", "NotebookEdit"];
const READ_TOOLS = ["Read"];

// ===========================================================================================
// 1. Compile: policy -> an accounted-for set of gates
// ===========================================================================================

/**
 * Turn a gate policy into gates, accounting for every rule exactly once.
 *
 * Returns `{ compiled, refused }`. The two together always equal the input, which is asserted by
 * the suite rather than merely intended: the distinctive failure of a compiler that emits gate
 * machinery is a rule that goes in and nothing comes out, leaving a gate map that reads as
 * configured and a machine that enforces nothing.
 *
 * Anything it cannot compile refuses the WHOLE compile rather than dropping one rule — skipping and
 * enforcing are indistinguishable from outside
 * (../.portulan/memory/a-checker-must-refuse-what-it-cannot-check.md).
 */
export function compile(policy) {
    if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
        throw new CompileError("the gate policy is not a JSON object");
    }
    const spec = policy.portulan?.spec;
    if (!KNOWN_SPECS.has(String(spec))) {
        throw new CompileError(
            `gate policy declares Workspace Definition ${JSON.stringify(spec)}, which this compiler does not implement ` +
                `(knows: ${[...KNOWN_SPECS].join(", ")}). Refusing rather than compiling a policy it may misread.`,
        );
    }
    if (!Array.isArray(policy.rules) || policy.rules.length === 0) {
        throw new CompileError("the gate policy declares no rules — refusing to emit an artifact that gates nothing");
    }

    // The mode this compile resolves at. `--mode` is not a flag: the artifact expresses the
    // WORKSPACE's declared default, and a per-session override lives at runtime rather than in a
    // generated file (see the session-mode section below). Compiling at anything else would produce
    // a tracked artifact that no reviewer could match to the policy beside it.
    // `null` counts as silence exactly as a missing key does, in all three places that ask. They
    // disagreed for one round — `declaredMode` read `null` as silence while the refusal below and the
    // artifact's `modeDeclared` tested `!== undefined` — so a policy with `"mode": null` and
    // mode-keyed tiers compiled instead of refusing, and stamped `strict` into the artifact as though
    // a workspace had chosen it. That is the artifact asserting a ruling nobody made, which is the one
    // thing the `modeDeclared` flag exists to prevent. Found at the pre-commit checkpoint.
    const declares = policy.mode !== undefined && policy.mode !== null;
    const mode = declaredMode(policy);
    const modeVarying = policy.rules.filter((r) => r?.tier && typeof r.tier === "object" && !Array.isArray(r.tier));
    if (modeVarying.length > 0 && !declares) {
        throw new CompileError(
            `${modeVarying.length} rule(s) declare a mode-keyed tier (${modeVarying.map((r) => r.id).join(", ")}) but the policy ` +
                `declares no \`mode\`. Refusing to pick one: which mode this workspace runs is a ruling, and a compiler that ` +
                `guessed it would set the checkpoint frequency of every session from a missing key.`,
        );
    }

    const compiled = [];
    const refused = [];
    const seen = new Set();

    for (const rule of policy.rules) {
        const id = rule?.id;
        if (typeof id !== "string" || !SLUG.test(id)) {
            throw new CompileError(`rule id ${JSON.stringify(id)} is not a slug — ids are referenced from prose and must be greppable`);
        }
        if (seen.has(id)) throw new CompileError(`duplicate rule id \`${id}\` — one id, one rule, or the gate map cannot cite either`);
        seen.add(id);

        // Resolved once, here, and used everywhere below. A rule's tier is either a scalar or a
        // mode-keyed map; `resolveTier` refuses anything else and refuses a map that cannot mean what
        // it looks like. An unrecognised tier is not a rule to skip — skipping it would silently
        // un-gate whatever it names.
        const tier = resolveTier(rule, mode);
        if (!TIERS.has(tier)) {
            throw new CompileError(
                `rule \`${id}\` resolves at mode \`${mode}\` to tier ${JSON.stringify(tier)}, which is not one of ${[...TIERS].join(" / ")}.`,
            );
        }
        if (typeof rule.reason !== "string" || rule.reason.trim().length === 0) {
            throw new CompileError(`rule \`${id}\` carries no reason — a gate with no sentence to show a human is not finished`);
        }

        const action = rule.action;
        if (!action || typeof action !== "object" || Array.isArray(action)) {
            throw new CompileError(`rule \`${id}\` declares no action`);
        }
        const kinds = Object.keys(action);
        if (kinds.length !== 1) {
            throw new CompileError(
                `rule \`${id}\` declares ${kinds.length} action kinds (${kinds.join(", ")}) — ambiguous is not the same as either, ` +
                    `and guessing which one was meant is how a gate ends up covering something other than what it says`,
            );
        }
        const [kind] = kinds;
        if (!["shell", "write", "read", "none"].includes(kind)) {
            throw new CompileError(`rule \`${id}\` declares action kind ${JSON.stringify(kind)}, which this compiler does not implement`);
        }
        if (typeof action[kind] !== "string" || action[kind].trim() === "") {
            throw new CompileError(`rule \`${id}\`'s action \`${kind}\` has no value`);
        }
        // The value is interpolated into the host's permission DSL — `Bash(prefix:*)`, `Edit(./path)`.
        // Characters that are structural THERE would emit a rule the host parses differently from what
        // the policy meant, and an ambiguous gate is indistinguishable from an absent one. Refuse rather
        // than escape: a workspace needing a gate on a command containing `(` or `:` needs this
        // compiler extended deliberately, not quietly reinterpreted. Found by review on the pull request.
        const RESERVED = kind === "shell" ? /[()\n\r\t:]/ : /[()\n\r\t]/;
        if (RESERVED.test(action[kind])) {
            throw new CompileError(
                `rule \`${id}\`'s ${kind} target ${JSON.stringify(action[kind])} contains a character that is ` +
                    `structural in the host's permission syntax. Emitting it would produce a rule the host reads ` +
                    `differently from what this policy says, which is worse than refusing to compile.`,
            );
        }
        if (action[kind] !== action[kind].trim()) {
            throw new CompileError(`rule \`${id}\`'s ${kind} target has leading or trailing whitespace, which the host would not match`);
        }

        // --- the three ways a rule ends -------------------------------------------------------

        if (!GATE_TIERS.has(tier)) {
            refused.push({ id, tier, why: TIER_NOT_A_GATE[tier] });
            continue;
        }
        if (kind === "none") {
            // The policy itself states why there is no surface. The compiler reports those words
            // rather than inventing its own — a refusal explained by the tool is a refusal nobody
            // can review against the policy.
            refused.push({ id, tier, why: action.none });
            continue;
        }
        compiled.push({ id, tier, kind, target: action[kind], reason: rule.reason });
    }

    // A policy that declares gates and emits none must not report success. This is the workflow's
    // "declares no verify recipes — refusing to report green" one level down: the artifact would be
    // written, the gate map would read as compiled, and nothing would hold.
    const declaresGates = policy.rules.some((r) => GATE_TIERS.has(resolveTier(r, mode)));
    if (declaresGates && compiled.length === 0) {
        throw new CompileError(
            "every gate in this policy refused to compile — refusing to write an artifact that enforces nothing while the policy claims gates",
        );
    }

    // `mode` is what this compile resolved at; `modeDeclared` is whether the policy actually said so.
    // The artifact records the mode only when it was declared — stamping `strict` onto a workspace
    // that never chose a mode would be the artifact asserting a ruling nobody made.
    return { compiled, refused, mode, modeDeclared: declares };
}

// ===========================================================================================
// 2. What an action MEANS — shared by the compiler and the runtime gate
// ===========================================================================================
//
// The emitter and the hook runner must agree about what `{"shell": "git push"}` covers, and the
// only way to guarantee that is one definition. Two implementations of one matcher is the drift
// this repository keeps finding, and a *matcher* that drifts does not look wrong — it looks like a
// gate that quietly stopped covering something.
//
// `../.portulan/compile/gate.mjs` imports these. It is the only thing outside this file that may.

/**
 * The spellings of a shell command a gate will match against: the command itself, and the same
 * command with one `sh -c` / `bash -c` / `zsh -c` wrapper peeled off.
 *
 * The permission rule this compiles to sees only the first — `Bash(git push:*)` is a literal
 * prefix match, so `bash -c "git push …"` is invisible to it. Measured, not assumed. The hook
 * runner sees both, which is the one thing it does that the permission layer cannot, and therefore
 * the reason it is emitted at all.
 *
 * **One level, and no more.** This closes the spelling reached for by accident or convenience, not
 * one constructed on purpose: deeper nesting, a heredoc, an interpolated variable, or a command
 * assembled at runtime all still escape. No amount of parsing here would close that, and an
 * ambitious parser would buy false confidence with false reds. What must not happen regardless of
 * spelling belongs on the platform floor — see ../core/operating/autonomy.md, which calls the floor
 * the gate that holds when this layer fails.
 */
export function spellings(raw) {
    const command = String(raw ?? "").trim();
    const out = [command];
    const wrapper = /^(?:\/usr\/bin\/env\s+)?(?:ba|z|da)?sh\s+-[a-zA-Z]*c\s+(.*)$/s.exec(command);
    if (wrapper) {
        let inner = wrapper[1].trim();
        const quote = inner[0];
        if ((quote === '"' || quote === "'") && inner.endsWith(quote) && inner.length > 1) {
            inner = inner.slice(1, -1);
        }
        if (inner.trim()) out.push(inner.trim());
    }
    return out;
}

/** Does a path handed over by the host fall under a policy target? */
export function matchesPath(candidate, target) {
    if (typeof candidate !== "string" || candidate === "") return false;
    const clean = String(target ?? "").replace(/^\.\//, "").replace(/^\/+/, "");
    if (clean === "" || clean === "/") return false;
    // Compared against the tail rather than resolved against a root: the host hands over an
    // absolute path, the policy names a repository-relative one, and the hook has no reliable
    // repository root at hook time — its cwd is the session's, which need not be the repo.
    const normalised = candidate.replace(/\\/g, "/");
    return clean.endsWith("/") ? normalised.includes(`/${clean}`) : normalised.endsWith(`/${clean}`);
}

/** Does an attempted tool call fall under this rule? Returns true/false; never throws. */
export function matchesRule(rule, tool, input = {}) {
    const action = rule?.action ?? {};
    if (typeof action.shell === "string" && tool === "Bash") {
        return spellings(input.command).some((s) => s === action.shell || s.startsWith(`${action.shell} `));
    }
    if (typeof action.write === "string" && WRITE_TOOLS.includes(tool)) {
        return matchesPath(input.file_path ?? input.notebook_path, action.write);
    }
    if (typeof action.read === "string" && READ_TOOLS.includes(tool)) {
        return matchesPath(input.file_path, action.read);
    }
    return false;
}

// ===========================================================================================
// 2b. The per-session mode override
// ===========================================================================================
//
// The workspace declares a default mode and the compiled artifact expresses it. A session may want a
// tighter one — a run nobody is watching closely, an unfamiliar area of the tree — without editing a
// tracked file and without changing what any other session does. That is this.
//
// ## Tighten-only, and the reason is a measurement rather than a preference
//
// **An override may raise a session's checkpoint frequency. It may never lower it.** Two independent
// reasons, either sufficient:
//
// 1. **It could not be honoured if it did.** The load-bearing layer is the `permissions` rule, and
//    that was compiled at the DEFAULT. A session claiming to be looser would still meet the prompt
//    its mode promised to remove — the host asks, because the artifact says ask. A mode announcing
//    "no checkpoint" while the host checkpoints is a false claim about an enforcer, which is exactly
//    ../.portulan/memory/a-stated-enforcer-must-be-the-real-one.md.
// 2. **The agent writes this file.** Editing on a working branch is Auto, so an agent that could
//    loosen its own mode could un-gate its own merge — self-authorisation with extra steps. Raising
//    your own bar needs nobody's permission; lowering it is the thing gates are for.
//
// So loosening is a change to the workspace default: a `.portulan/` edit, which is Propose, which is
// a pull request somebody reviews. The direction that needs a human keeps one.
//
// Enforced twice on purpose — `writeSessionMode` refuses (so a human gets a sentence) and
// `effectiveMode` clamps (so a hand-written or stale file is inert rather than trusted). This file
// lives in the OS temp directory where nothing validates it, so the read path treats it as untrusted
// input rather than as state this program wrote.
//
// ## Session-scoped, worktree-local, self-expiring
//
// Mirrors the Stop-gate counter in ../.portulan/compile/stop.mjs, for the same reasons and with the
// same shape: keyed by the working tree because several worktrees of this repository are routinely
// checked out at once, and carrying the session that claimed it because two sessions in one tree must
// not bind each other. A record whose session does not match the reader's is ignored — which is also
// the expiry: the next session's id will not match, so yesterday's override is inert without anything
// having to delete it.
//
// Never a tracked file. An override in the repository would cross-contaminate parallel sessions, and
// it would outlive the session that set it — a setting nobody remembers making is worse than no
// setting at all.

/** A short, stable digest. Not security — just enough that two distinct inputs differ. */
function digest(value) {
    let h = 0;
    for (const ch of String(value)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h.toString(36);
}

/**
 * Where one session's mode record lives, for one working tree. Untracked, in the OS temp dir.
 *
 * Keyed by the session **and** the working tree, which is the same key
 * `../.portulan/compile/stop.mjs` uses for its counter and for the same two reasons. An earlier
 * version keyed on the tree alone and let the reader compare the session id it found — which read
 * correctly and *wrote* wrongly: two sessions in one worktree shared a file, so the second to tighten
 * silently erased the first, and the first fell back to the default while its own tool had reported
 * success. Found at the pre-commit checkpoint, against three documents claiming this record was
 * "invisible to every other session". It is now, because there is nothing to share.
 *
 * The readable part is for a human debugging a stuck override; the digest is what makes the name
 * unique. Sanitising alone is not enough and the failure is silent — a session id made entirely of
 * characters outside the class sanitises to the empty string, so every such session would share one
 * record again. Inherited wholesale from `stop.mjs`, including that lesson.
 */
export function sessionModeFile({ dir = os.tmpdir(), root = process.cwd(), sessionId = null } = {}) {
    const readable = String(sessionId ?? "unclaimed").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
    return path.join(dir, `portulan-mode-${readable}-${digest(sessionId)}-${digest(root)}`);
}

/**
 * Read the session-mode record for a working tree, or `null`.
 *
 * Never throws. The gate runner that consumes this is written to fail open on any internal error, so
 * a throw here would remove the sentence a human reads — and a missing, truncated or hand-mangled
 * record is an ordinary state, not an exceptional one.
 */
export function readSessionMode({ dir, root, sessionId = null } = {}) {
    try {
        const record = JSON.parse(fs.readFileSync(sessionModeFile({ dir, root, sessionId }), "utf8"));
        if (!MODES.has(record?.mode)) return null;
        // Belt and braces. The filename already isolates sessions, so this compares equal in every
        // ordinary case; it is kept because the *claim* this design makes is about sessions rather
        // than about filenames, and a record hand-placed or left by a changed naming scheme should
        // not bind a session that did not write it.
        if ((record.session ?? null) !== (sessionId ?? null)) return null;
        return { mode: record.mode, session: record.session ?? null, at: record.at ?? null };
    } catch {
        return null;
    }
}

/**
 * Claim a tighter mode for this session. Returns the written record.
 *
 * `policy` is optional and is what makes the tighten-only refusal possible — without it there is no
 * default to compare against, and the clamp in `effectiveMode` is the backstop.
 */
export function writeSessionMode(mode, { dir = os.tmpdir(), root = process.cwd(), sessionId = null, policy } = {}) {
    if (!MODES.has(mode)) {
        throw new CompileError(`\`${mode}\` is not a mode — expected one of ${[...MODES].join(", ")}`);
    }
    if (policy !== undefined) {
        const base = declaredMode(policy);
        if (MODE_STRICTNESS[mode] < MODE_STRICTNESS[base]) {
            throw new CompileError(
                `a session may tighten its mode, never loosen it: this workspace declares \`${base}\` and \`${mode}\` is looser. ` +
                    `The compiled permission rules were emitted at \`${base}\`, so a looser session would still meet the prompts ` +
                    `it claims to have removed. Loosening is a change to the workspace default in the gate policy — a pull request.`,
            );
        }
    }
    const record = { mode, session: sessionId ?? null, at: new Date().toISOString() };
    fs.writeFileSync(sessionModeFile({ dir, root, sessionId }), JSON.stringify(record));
    return record;
}

/**
 * The mode in force right now, and where it came from.
 *
 * Precedence, in one line: **session override > workspace default**, and the override may only
 * tighten. The Prohibited tier and every mode-invariant rule ignore both.
 */
export function effectiveMode({ policy, dir, root, sessionId } = {}) {
    let base;
    try {
        base = declaredMode(policy);
    } catch {
        // An unreadable or invalid policy mode is not this function's to adjudicate — `compile`
        // refuses it loudly at build time. At runtime the strictest reading is the safe one.
        base = "strict";
    }
    const record = readSessionMode({ dir, root, sessionId });
    if (record && MODE_STRICTNESS[record.mode] > MODE_STRICTNESS[base]) {
        return { mode: record.mode, source: "session override", since: record.at };
    }
    return { mode: base, source: "workspace default", since: null };
}

// ===========================================================================================
// 3. The Claude Code backend
// ===========================================================================================

/** A workspace-relative path becomes a host permission pattern. A trailing `/` means the subtree. */
function pattern(tool, target) {
    const clean = target.replace(/^\.\//, "").replace(/^\/+/, "");
    const spec = clean.endsWith("/") ? `./${clean}**` : `./${clean}`;
    return `${tool}(${spec})`;
}

/**
 * Translate compiled gates into a Claude Code settings object.
 *
 * The mapping, each line of it measured against a running host rather than read from documentation:
 *
 *   prohibited -> permissions.deny  + a hook returning `deny`
 *   gated      -> permissions.ask   + a hook returning `ask`
 *
 * The hook returns the SAME decision as the permission rule on purpose. A hook returning `deny` for
 * a Gated action would turn a per-action prompt into a hard block, which is the tier above it.
 */
export function claudeCode(result, options = {}) {
    // The header names the policy file that was ACTUALLY read. It was a literal for one round, so a
    // workspace declaring a non-default policy got an artifact claiming it came from somewhere it did
    // not — in the one field whose entire job is telling a reader what generated this. Found by review.
    const source = options.source ?? ".portulan/gates.json";
    const runner = options.runner ?? '"${CLAUDE_PROJECT_DIR}/.portulan/compile/gate.mjs"';
    const stopRunner = options.stopRunner ?? '"${CLAUDE_PROJECT_DIR}/.portulan/compile/stop.mjs"';

    const deny = [];
    const ask = [];
    const matchers = new Set();

    for (const gate of result.compiled) {
        const into = gate.tier === "prohibited" ? deny : ask;
        if (gate.kind === "shell") {
            into.push(`Bash(${gate.target}:*)`);
            matchers.add("Bash");
        } else if (gate.kind === "write") {
            for (const tool of WRITE_TOOLS) {
                into.push(pattern(tool, gate.target));
                matchers.add(tool);
            }
        } else if (gate.kind === "read") {
            for (const tool of READ_TOOLS) {
                into.push(pattern(tool, gate.target));
                matchers.add(tool);
            }
        }
    }

    // The generation header. An emitted artifact that does not say what generated it invites the
    // one edit this whole rail exists to catch — a hand-fix that survives until the next compile
    // silently reverts it.
    // The mode this artifact expresses. Recorded because the mode is the one input that changes the
    // output without changing a rule — so an artifact that omitted it could not be matched to the
    // policy beside it by reading either. It is also the audit record: a session may only ever
    // TIGHTEN from here, so this field bounds what any session running against this commit could do.
    const mode = options.mode ?? (result.modeDeclared ? result.mode : undefined);

    const settings = {
        $portulan: {
            generated: "cli/compile.mjs",
            source,
            ...(mode === undefined ? {} : { mode }),
            warning: `Generated file. Edit ${source} and recompile; \`verify/compile.sh\` fails on drift.`,
        },
        permissions: { deny, ask, allow: [] },
        hooks: {
            // Quoted deliberately: this repository's own working copy lives under a path with
            // spaces in it, and an unquoted expansion would word-split into a runner nobody can
            // find. No pipes, redirections or separators — an emitted shell one-liner is where the
            // next quoting fail-open would live (../.portulan/tasks/0004).
            PreToolUse: [...matchers].sort().map((matcher) => ({
                matcher,
                hooks: [{ type: "command", command: `node ${runner}` }],
            })),
            Stop: [{ hooks: [{ type: "command", command: `node ${stopRunner}` }] }],
        },
    };

    return { settings };
}

// ===========================================================================================
// 3. The command line
// ===========================================================================================

/**
 * Where a workspace's gate policy lives.
 *
 * Read from the manifest's top-level `gates` key, because that is what the key MEANS —
 * `../spec/slots.md` calls it "a path to a JSON file the enforcement compiler reads", and `doctor`
 * resolves it. This compiler hard-coded `.portulan/gates.json` for one round, so a workspace naming a
 * different file would have had `doctor` validate one policy and `compile` compile another, with both
 * reporting green. A manifest key that validates and is never consumed is this repository's most
 * expensive recurring defect, and here it was in the very key this milestone added. Found by review on
 * the pull request.
 *
 * The default survives for a workspace with no manifest or no key — that is a legitimate shape, and
 * refusing it would make the key required, which is a spec change nobody decided.
 */
export function policyPath(workspaceRoot, workspaceDir = ".portulan") {
    const base = path.join(workspaceRoot, workspaceDir);
    const manifest = path.join(base, "workspace.json");
    try {
        const declared = JSON.parse(fs.readFileSync(manifest, "utf8")).gates;
        // Validated against the schema's `filePath` shape before it is used, and containment is
        // checked after resolution rather than by pattern alone — a `../` chain passes any regex and
        // still escapes. Without this, a malformed or hand-edited manifest turns a hook that runs on
        // EVERY tool call into an arbitrary file read outside the workspace. `doctor` would refuse such
        // a manifest, but this runner must not depend on `doctor` having been run: the two tools have
        // no ordering between them, and the schema is the contract, not the sequence. Found by review.
        if (typeof declared === "string" && declared.trim() && FILE_PATH.test(declared)) {
            const resolved = path.resolve(base, declared);
            const inside = path.relative(base, resolved);
            if (inside && !inside.startsWith("..") && !path.isAbsolute(inside)) return resolved;
        }
    } catch {
        // No manifest, or unreadable. `doctor` is the tool that judges a manifest; this one only needs
        // to know where the policy is, and the default is where it is when nothing says otherwise.
    }
    return path.join(workspaceRoot, workspaceDir, "gates.json");
}

function readJson(file, what) {
    let raw;
    try {
        raw = fs.readFileSync(file, "utf8");
    } catch (error) {
        throw new CompileError(`cannot read ${what} at ${file} — ${error.code ?? error.message}`);
    }
    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new CompileError(`${what} at ${file} is not valid JSON — ${error.message}`);
    }
}

/** The emitted artifact, as text. One writer, so `--check` compares what `--write` would produce. */
export function render(settings) {
    return `${JSON.stringify(settings, null, 2)}\n`;
}

export function run(argv, options = {}) {
    const say = (line = "") => {
        if (!options.quiet) process.stdout.write(`${line}\n`);
    };
    try {
        let workspaceRoot = process.cwd();
        let check = false;
        for (let i = 0; i < argv.length; i += 1) {
            if (argv[i] === "--check") check = true;
            else if (argv[i] === "--workspace") {
                workspaceRoot = argv[i + 1];
                i += 1;
                if (workspaceRoot === undefined) throw new CompileError("--workspace needs a directory");
            } else throw new CompileError(`unknown argument ${JSON.stringify(argv[i])}`);
        }

        const policyFile = policyPath(workspaceRoot);
        const policy = readJson(policyFile, "the gate policy");
        const result = compile(policy);
        const { settings } = claudeCode(result, {
            source: path.relative(workspaceRoot, policyFile).split(path.sep).join("/"),
        });
        const text = render(settings);
        const artifact = path.join(workspaceRoot, ".claude", "settings.json");

        // The mode is printed first because it is the input that silently changes every line below
        // it. A run that listed gates without naming the mode would be reporting an answer without
        // its question — and the mode-varying rules are rendered in full, all three cells, so the
        // setting is legible from the tool rather than only from the policy file.
        say(
            `mode: ${result.mode}${result.modeDeclared ? "" : " (not declared — defaulting to the strictest)"} ` +
                `— session overrides may tighten, never loosen`,
        );
        for (const rule of policy.rules) {
            if (!rule?.tier || typeof rule.tier !== "object") continue;
            const cells = [...MODES].map((m) => `${m}=${rule.tier[m]}`).join("  ");
            say(`  varies  ${rule.id.padEnd(38)} ${cells}`);
        }
        say(`gates: ${result.compiled.length} compiled, ${result.refused.length} refused`);
        for (const gate of result.compiled) say(`  gate    ${gate.id.padEnd(38)} ${gate.tier}`);
        // Refusals are printed, always. A silent cap reads as "covered everything" when it did not
        // — and these are the rows the per-host degradation report is built from.
        for (const r of result.refused) say(`  refused ${r.id.padEnd(38)} ${r.why}`);

        if (check) {
            let current = null;
            try {
                current = fs.readFileSync(artifact, "utf8");
            } catch {
                say(`RED — ${artifact} does not exist; the policy declares gates that nothing enforces`);
                return 1;
            }
            if (current !== text) {
                say(`RED — ${artifact} has drifted from ${policyFile}. Recompile.`);
                return 1;
            }
            say("GREEN — the emitted artifact matches the policy");
            return 0;
        }

        fs.mkdirSync(path.dirname(artifact), { recursive: true });
        fs.writeFileSync(artifact, text);
        say(`wrote ${artifact}`);
        return 0;
    } catch (error) {
        // Anything reaching here means compile could not judge — including a defect in compile
        // itself. Exit 2. Exit 1 would assert that an artifact drifted when nothing was compared,
        // and exit 0 would be the fail-open this tool exists against.
        if (!options.quiet) {
            process.stderr.write(
                `compile: ${error instanceof CompileError ? error.message : `unanticipated failure — ${error.stack ?? error}`}\n`,
            );
        }
        return 2;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = run(process.argv.slice(2));
}
