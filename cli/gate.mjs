#!/usr/bin/env node
// The PreToolUse gate runner — the *explanation* half of the enforcement compiler.
//
// Wired by `../../cli/compile.mjs` into `.claude/settings.json`. It reads the host's hook payload on
// stdin, finds which rule in `.portulan/gates.json` the attempted action matches, and returns that rule's
// own sentence as the decision reason.
//
// ## This file is not the gate. Read that twice.
//
// The gate is the `permissions` rule the same compiler emits. This runner exists because a bare
// "permission denied" teaches nobody anything, while `gates.json` already holds a sentence written
// for exactly this moment. The split is forced by a measurement, not by taste: on CLI 2.1.220 a
// PreToolUse hook that CRASHES **fails open** — the tool proceeds — on the identical wiring that
// blocks when the hook is healthy. So a hook can never be the load-bearing layer here, and this one
// is written to fail open *deliberately and visibly* rather than pretending otherwise:
//
//   any internal error => exit 0, emit nothing => the permission rule governs, unchanged.
//
// Refusing loudly on error *is* available — a hook exiting 2 blocks — and it is still wrong here, for a
// reason worth stating precisely rather than with the hand-wave an earlier draft used. If this runner
// failed closed, a malformed `.portulan/gates.json` would deny EVERY matched tool call until someone fixed it:
// an undriveable session, whose only repair is inside the repository it can no longer edit. What is lost
// by stepping aside is bounded and known — the wrapper coverage and the sentences — because the
// permission layer never reads that file at runtime.
//
// ## Why the decision mirrors the permission rule
//
// `prohibited` => `deny`, `gated` => `ask`. The hook returns the SAME decision the permission rule
// carries. A hook returning `deny` for a Gated action would convert a per-action prompt into a hard
// block — that is the tier above it, and collapsing the two would make the constitution's
// protection indistinguishable from an ordinary push.
//
// ## What this layer is FOR, which is not what its author first assumed
//
// The first version of this runner existed to supply a better sentence than "permission denied".
// Measured, that was wrong: when a permission rule matches, **the host runs this hook and then
// discards its reason** — the permission layer's generic message is what the agent sees. Verified
// with a canary that recorded both the invocation and the command it saw. A hook emitted purely to
// improve a message it cannot reach would be an inert component that reads as an active one, which
// is the defect this repository already has a rule about.
//
// So the split earns its keep somewhere else: **this layer covers what the permission pattern
// cannot.** Two things, and in both the permission layer has nothing to say, so this decision AND
// its sentence are what the agent gets:
//
//   1. The WRAPPER spelling. `Bash(git push:*)` is a prefix match against the literal command, so
//      `bash -c "git push …"` is invisible to it — measured, and the reason
//      `../core/operating/autonomy.md` calls the platform floor the gate that holds when this
//      layer fails. This runner unwraps one level of `sh -c` / `bash -c` / `zsh -c` before matching.
//   2. A SHELL WRITE to a path a `write:` rule protects. `Edit(./docs/vision.md)` denies three
//      tools, and `echo x >> docs/vision.md` is a fourth way to the same bytes. `matchesRule` now
//      answers for `Bash` on a write rule, by a table of redirections and file-writing commands
//      that `../../cli/compile.mjs` states in full.
//
// Two layers, two jobs: the permission rule cannot fail open, and this one covers more ground.
// **The second case above is the uncomfortable one**, and it is named in `../gate-map.md`'s
// honest-holes list rather than left here: it is the only gate whose sole layer is this file, so
// every "fails open" sentence above is, for shell writes to the constitution, the whole story
// rather than a footnote about a lost message.
//
// **One level of unwrapping, and no more.** Deeper nesting, a heredoc, an interpolated variable, a
// command assembled at runtime — all still escape, and no amount of parsing here would close that.
// The same is true one layer over: a write spelled through a runtime (`python3 -c`) or a writer
// outside that table reaches the file. Anything that must not happen regardless of spelling belongs
// on the platform floor, not in a matcher.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The action vocabulary is defined ONCE, in the compiler, and imported here. Two implementations of
// one matcher is the drift this repository keeps finding — and a matcher that drifts does not look
// wrong, it looks like a gate that quietly stopped covering something.
import { matchesRule, policyPath } from "./compile.mjs";

// **The project root is TOLD to this runner, never derived from where this file sits.**
//
// It used to be derived: this file lived at `.portulan/compile/gate.mjs`, so `HERE/../..` was the
// repository and `basename(HERE/..)` was the workspace directory. That worked for exactly one layout —
// the author's — and it is why the file could not ship. Milestone 7 moves both runners into `cli/` so an
// adopter actually receives them (`package.json`'s `files` never carried `.portulan/`, so every compiled
// policy named a file the adopter did not have, and a missing hook fails open). From `cli/`, and even
// more so from `node_modules/@sleepy-panda-works/portulan/cli/`, this file has no idea where the
// adopter's workspace is — and inferring one would be #131's class, paths resolved against the author's
// layout, in the tool with the most to lose from it.
//
// `CLAUDE_PROJECT_DIR` is what the host sets and what the emitted hook already interpolates; `cwd` is the
// honest fallback, because a hook runs from the project. `||` rather than `??` on purpose: an env var set
// to the empty string must fall through to `cwd`, not resolve every path against `""`.
//
// **What happens when no workspace is found differs between the two runners, and the first draft of this
// paragraph claimed the stricter behaviour for both.** THIS file steps aside silently — `main()` catches
// and returns without a decision — which is its own defended design: a PreToolUse hook that cannot read
// the policy must not block every tool call, and the permission rules compiled beside it still hold, so
// the layer degrades rather than disappearing. `./stop-gate.mjs` does the opposite and blocks loudly,
// because a Stop-gate that cannot read the workspace has nothing beneath it. Stated per file rather than
// as one sentence covering both, since they genuinely differ and the difference is the interesting part.
const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const WORKSPACE_DIR = process.env.PORTULAN_WORKSPACE || ".portulan";
const POLICY = policyPath(PROJECT, WORKSPACE_DIR);

/** Exit without a decision. The permission rule still holds; only the sentence is lost. */
function stepAside() {
    process.exit(0);
}

function decide(payload, policy) {
    const tool = payload.tool_name;
    const input = payload.tool_input ?? {};
    for (const rule of policy.rules ?? []) {
        if (rule.tier !== "gated" && rule.tier !== "prohibited") continue;
        if (matchesRule(rule, tool, input)) return rule;
    }
    return null;
}

async function main() {
    let raw = "";
    for await (const chunk of process.stdin) raw += chunk;

    let payload;
    let policy;
    try {
        payload = JSON.parse(raw);
        policy = JSON.parse(fs.readFileSync(POLICY, "utf8"));
    } catch {
        stepAside();
        return;
    }

    const rule = decide(payload, policy);
    if (!rule) stepAside();

    const decision = rule.tier === "prohibited" ? "deny" : "ask";
    process.stdout.write(
        `${JSON.stringify({
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: decision,
                permissionDecisionReason: `PORTULAN GATE \`${rule.id}\` (${rule.tier}) — ${rule.reason}`,
            },
        })}\n`,
    );
    process.exit(0);
}

main().catch(stepAside);
