#!/usr/bin/env node
// The PreToolUse gate runner — the *explanation* half of the enforcement compiler.
//
// Wired by `./compile.mjs` into `.claude/settings.json`. It reads the host's hook payload on
// stdin, finds which rule of the policy the workspace **yields** the attempted action matches, and
// returns that rule's own sentence as the decision reason. *Yields*, not *declares*: the rules in
// `.portulan/gates.json` plus the fragments its packs contribute — see "The policy this runner reads"
// below, which is the whole of what `#269` was.
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
//      that `./compile.mjs` states in full.
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
//
// **The same argument reaches one level up, and for a milestone it was applied only to the matcher.**
// Importing `matchesRule` kept the two layers agreeing about what an action *is* while they disagreed
// about which rules *exist*: this file read the workspace's declared policy, and `./compile.mjs`
// enforced that policy plus its packs' contributions. `packContributions` and `composeFragments` are
// imported for the same reason as the matcher — a second composer would drift the same way — and
// `doctor` took this identical repair for this identical noun one session earlier.
import { matchesRule, policyPath, packContributions, composeFragments, parse } from "./compile.mjs";

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

// ## The policy this runner reads
//
// **Declared plus composed, and until #269 it was declared alone.** A pack contributes gate fragments
// (`contributes.gates` in its `pack.json`); `./compile.mjs` composes them onto the workspace's own rules
// before it emits anything, so the permission rules sitting beside this hook are compiled from the
// composed set. This file read `.portulan/gates.json` and nothing else, so a rule a pack contributed was
// enforced by the layer that cannot say why and invisible to the layer whose whole job is the sentence —
// and for a `prohibited` fragment with a matcher, the two layers returned different decisions.
//
// **What this cost on THIS repository is nothing, and saying so is the point.** Its one gate-contributing
// pack (`rituals/checkpoints`) contributes two fragments and both carry `action: {none: …}`, which no
// matcher can reach — `compile --matrix` lists them among the gates no backend compiles. So the defect
// here was latent rather than live, and it is fixed on the shape rather than on an incident. The demonstration
// in `./gate.test.mjs` uses a fixture whose pack contributes a *matchable* fragment, because manufacturing
// a live case would have meant giving a `none` rule a matcher — reversing the ruling recorded in
// `../.portulan/proposals/0029-a-constraint-names-a-category-not-a-list.md` Q3, which removed one.
//
// **Three limits, named rather than left to be measured.** _(This said "Two" while enumerating three:
// the third arrived with the round-1 fix below and the count above it did not move. Exactly the
// undercount-by-enumeration `../.portulan/gate-map.md`'s own `action none` row was corrected for on
// 2026-08-14, repeated here within the week. Found by Copilot on #272, round 2.)_
//
// The three share one principle, and stating it is what keeps a later reader from deriving the wrong
// rule from the pair: **this runner degrades toward whatever intact policy remains — composed to
// declared, declared to nothing — and never toward a block.** It is never the load-bearing layer, so
// every arm below hands the decision back rather than taking it.
//
//   1. **No discovery.** `packContributions` is called with no `discovery` thunk, so `resolutionRoots`'
//      unasked arm never consults the host's plugin cache and roots come from the workspace manifest's
//      `tree` alone. Deliberate twice over: this runs on every tool call, and a gate whose answer moved
//      with what is installed on the machine would be a gate nobody could review. A pack resolving ONLY
//      from the host cache therefore contributes to what a bare `compile` yields and not to what this
//      hook composes — the residual gap, stated in `../.portulan/gate-map.md` and owned by `#264`.
//   2. **A composition failure falls back to the DECLARED policy**, and does not step aside. Composition
//      only ever adds a rule or raises a tier — `composeFragments` throws on a demotion rather than
//      applying it — so the composed policy is never weaker than the declared one, and falling back can
//      only lose coverage this file already had rather than drop below it. Stepping aside instead would
//      let a malformed `pack.json` switch off gates the workspace declares in its own file, which hands a
//      dependency a lever on the layer above it. `./compile.mjs` refuses to build in the same case, and
//      the divergence is the intended one: it fails closed at build time against a file you can edit,
//      while this runs on every tool call.
//   3. **The composed policy is VALIDATED, by the same `parse` the compiler validates with.** Composition
//      checks a fragment's *tier* and, when tightening, that the action shape is unchanged; it does not
//      check that an ADDED fragment is a well-formed rule. So a pack contributing
//      `{id, tier: prohibited, action: {shell: curl}}` and no `reason` composed cleanly and this hook
//      denied with the sentence `— undefined`, where `compile` refuses the same input at exit 2 with
//      *"rule `no-reason` carries no reason — a gate with no sentence to show a human is not finished"*.
//      Measured, on the runner. The two layers disagreeing about whether a policy is admissible is this
//      file's own defect one step further in. Raised by Copilot on #272, round 1, in the suppressed
//      channel. **The limit, since the fix is narrower than it reads:** this covers the COMPOSED arm. A
//      rule missing its `reason` in the *declared* policy still denies with `— undefined`, byte-identically
//      with every predecessor — because the fallback for an inadmissible declared policy is that same
//      policy, and stepping aside there would drop a live prohibition over a missing string. `compile`
//      refuses that shape at build time, which is where it belongs. Pinned in `./gate.test.mjs` so the
//      arm cannot be quietly converted to a step-aside.
//
//      **Validation only — the decision is still made on the composed policy, not on `parse`'s return.**
//      Not because the parsed shape would not match: measured, `parse` returns rules carrying the SAME
//      `action` object beside the added `kind`/`target`, and `matchesRule` answers correctly on them —
//      a draft of this comment claimed otherwise and was wrong. The two real grounds: `parse` **refuses
//      rather than normalises**, so once it passes, the composed and parsed forms are identical for
//      matching and deciding on the parsed one buys nothing; and the fallback path has no parsed form to
//      offer — an inadmissible policy produces none — so deciding on `parse`'s return would hand
//      `decide()` two different shapes on its two paths, importing a representational seam rather than
//      closing one. **If `parse` ever stops refusing and starts normalising, that change must sweep this
//      hook too.** The check costs 0.003 ms against a ~30 ms invocation, 2000 iterations, so it is free.
function yielded(declared) {
    try {
        const { contributions } = packContributions(PROJECT, WORKSPACE_DIR);
        const composed = composeFragments(declared, contributions).policy;
        parse(composed);
        return composed;
    } catch {
        return declared;
    }
}

/**
 * The rule this call answers to: the STRONGEST gate it falls under, not the first one listed.
 *
 * This returned the first match for one milestone, which is not the same rule whenever two of different
 * tiers match one call: the weaker one wins if it is listed higher. The shape is ordinary rather than
 * exotic — one dangerous spelling prohibited beneath a prefix the workspace already gates broadly,
 * `git push` at `gated` and `git push --mirror` at `prohibited` — and it lands on `ask` for an action the
 * policy prohibits.
 *
 * **Composition makes that systematic rather than causing it, and a draft of this paragraph had it the
 * other way round** — *"indistinguishable from the strongest for as long as the policy came from one
 * file"*. Measured on a workspace composing nothing, with those two rules in that order: the old scan
 * answered `ask`, this one answers `deny`. What composition adds is that a contributed rule can never
 * win the tie-break, because `composeFragments` APPENDS added rules after the workspace's own — so a
 * pack-contributed `prohibited` rule is always the later one and always the one first-match discards.
 * That is #269's case reached through the ordering rather than through the missing rules, and closing
 * only the missing-rules half would have left it.
 *
 * Grounded in the policy's own semantics rather than in host precedence between two matching patterns,
 * which this repository has never measured and which nothing here needs: `prohibited` means the action
 * must not happen, so answering `ask` on a call the policy prohibits is wrong on the policy's terms
 * whatever the host does with the compiled pair.
 *
 * **It only ever moves a decision UP, and that is the honest form of the guarantee.** `prohibited` is the
 * top of the tier order and `gated` the only other tier considered, so "strongest, ties to the first" is
 * exactly *the first `prohibited` match if there is one, otherwise the first `gated` match* — which is
 * what the loop below is. Output is byte-identical wherever no two matching rules sit at different tiers,
 * and `ask` becomes `deny` where they do. **Not** "byte-identical for any workspace that composes
 * nothing" — that is the claim the counterexample above kills, and this repository is not evidence for it
 * either: its own policy is unchanged only because `edit-the-constitution`, the one `prohibited` rule it
 * declares, is listed FIRST, so first-match already returned it. Measured, on a command matching both it
 * and a gated shell rule: `deny` from either runner. Move that rule down the file and the two disagree.
 * The early return on `prohibited` also keeps the denied path's short-circuit: nothing later can outrank
 * the top of the order.
 */
function decide(payload, policy) {
    const tool = payload.tool_name;
    const input = payload.tool_input ?? {};
    let gated = null;
    for (const rule of policy.rules ?? []) {
        if (rule.tier !== "gated" && rule.tier !== "prohibited") continue;
        if (!matchesRule(rule, tool, input)) continue;
        if (rule.tier === "prohibited") return rule;
        if (gated === null) gated = rule;
    }
    return gated;
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

    const rule = decide(payload, yielded(policy));
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
