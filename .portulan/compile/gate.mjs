#!/usr/bin/env node
// The PreToolUse gate runner — the *explanation* half of the enforcement compiler.
//
// Wired by `../../cli/compile.mjs` into `.claude/settings.json`. It reads the host's hook payload on
// stdin, finds which rule in `../gates.json` the attempted action matches, and returns that rule's
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
// failed closed, a malformed `../gates.json` would deny EVERY matched tool call until someone fixed it:
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
//      `../../core/operating/autonomy.md` calls the platform floor the gate that holds when this
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
import { matchesRule, policyPath } from "../../cli/compile.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Resolved the same way the compiler resolves it — through the manifest's `gates` key — because the
// emitter and the runtime reading different policy files is the drift that would be hardest to see: both
// would work, on different rules.
const POLICY = policyPath(path.resolve(HERE, "..", ".."), path.basename(path.resolve(HERE, "..")));

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
