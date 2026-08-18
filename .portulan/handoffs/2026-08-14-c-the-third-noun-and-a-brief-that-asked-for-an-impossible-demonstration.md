# Handoff — the third noun, and a brief that asked for an impossible demonstration

**Post-M7 hardening, session 19. Full lane.** No milestone row moves. One issue repaired and awaiting its
merge, one pull request, three review rounds to empty, and the session's most useful finding was that the
instruction it started from could not be carried out as written.

**The arrangement:** Claude Fable 5 supervised only, in a fresh context, and held every gate; Claude
Opus 5 implemented. The implementer model was verified from the system context's own identity line at
boot rather than from a `/model` printout — the printout has been measured lying while the context line
stayed correct, and that measurement lives in the maintainer's session memory rather than in this tree,
so it is named here without a repository citation to follow. _(Every `2026-07-30` in this repository is
the residence ruling, a different event; a dated citation here would have sent a reader to it.)_

## What landed

[#269](https://github.com/sleepy-panda-srl/portulan/issues/269) — `cli/gate.mjs` read the policy this
workspace **declares** where `cli/compile.mjs` enforces the one it **yields**. The PreToolUse hook walked
`.portulan/gates.json` alone while the permission rules compiled beside it came from the composed set, so
a pack-contributed gate was enforced by the layer that cannot say why and invisible to the layer whose
whole job is the sentence.

**Third noun of the class**, after `dod.md` condition 1 and `doctor`. Repaired by **arm 1** of the four
the issue lists — compose through `compile`'s own `packContributions`/`composeFragments` — which is the
repair `doctor` took one session earlier. No second composer.

**A second half the issue does not name.** `decide()` returned the **first** matching rule, and
`composeFragments` *appends*, so a pack-contributed `prohibited` rule always lost the tie-break to a
broader declared `gated` one — `ask` on an action the policy prohibits. Now the strongest matching tier.
It turned out to reach **single-file policies too**: a workspace composing nothing, declaring `git push`
gated above `git push --mirror` prohibited, diverged the same way. Measured. Strengthen-only in every
case — `ask` may become `deny`, never the reverse.

## The brief asked for a demonstration that cannot be produced

The session brief demanded *"the composed prohibited gate DENIED by the live hook, forced red→green"*,
naming `self-certify-a-checkpoint`. That rule carries `action: {none: …}` on the maintainer's own
[`0029`](../proposals/0029-a-constraint-names-a-category-not-a-list.md) Q3 ruling of **2026-08-14**;
`matchesRule` answers `shell`/`write`/`read` and false otherwise, and `compile --matrix` lists it among
the five gates no backend compiles. **So the premise — compile enforces it and the hook does not — is
false for that rule: compile does not enforce it either.** Producing the demanded red→green would have
meant giving a `none` rule a matcher, reversing a ruling dated the same week. #269's own text says this
and generalises instead.

The demonstration is therefore on a **fixture** whose pack contributes a *matchable* prohibition, driven
through the real binary: zero bytes before, `deny` after, wrapper spellings included. On this repository
the defect was **latent, not live**, and it is fixed on its shape. Stated in four carriers.

**The brief's second error:** *"must fail closed on an unreadable policy per the house doctrine"* inverts
the doctrine `cli/gate.mjs:8-24` argues from the CLI 2.1.220 measurement, is the conflation `:100-106`
records an earlier draft making, and contradicts the brief's own byte-identical constraint — failing
closed is itself a behaviour change on the declared-only path. The tree's fail-open was held.
**Both errors were the supervisor's**, as session 18's two were, and both were caught the same way: by
checking a citation against the source before transcribing it.

## What the checkpoints caught that the suite could not

Sixteen adjustments across four passes — session-open **6**, pre-commit **6**, **1**, **3** — all binding,
the optional ones included, on the maintainer's ruling. Five were defects that would otherwise have
shipped, and two of those are the ones worth carrying forward:

- **An inert rail.** The hermeticity test's poisoned plugin record used the wrong filename, the wrong
  schema version and the wrong shape, so it was green against a runner that *did* go looking. The
  supervisor wired discovery in and watched the rail stay green. **A test that cannot fail is not a
  test**, and nothing but an attack on the instrument distinguishes it from one that passes.
- **A claim stated one size too large.** "Byte-identical for any declared-only workspace" was false and
  is now a counterexample test. This repository's own policy is unchanged only because
  `edit-the-constitution`, its one `prohibited` rule, is listed **first**.

Also mine: I counted **ten** recipes by reading the declared set rather than the yielded one — the exact
slip this change repairs, committed while repairing it. The yielded set is **eleven**.

**A process fault, twice.** I folded adjustments while the pre-commit pass was still measuring, and the
second time it made the supervisor's own observation inconsistent mid-pass (a suite that grew from 17 to
18 tests between two of its runs). It reconciled by hashing and proved the delta comment-only, but the
rule now stated is: **fold after the verdict lands, not while the pass is running.** The round that
observed it was the first where every reported number matched the supervisor's to the digit.

## The review loop

**Three rounds to empty**, and the maintainer granted going past the standing two-fix-round bound.

- **Round 1** — one finding on two threads, correct and reproduced before acceptance: `composeFragments`
  never checks that an **added** fragment is a well-formed rule, so a fragment with no `reason` composed
  cleanly and the hook denied with the literal sentence `— undefined` where `compile --check` refuses at
  exit 2. Fixed by running the composed policy through the compiler's own `parse`. Copilot suggested
  deciding on `parse`'s *return*; validated with it instead and still deciding on the composed policy —
  and **the first defence of that choice was false**, claiming the parsed rules would break `matchesRule`
  when they carry the same `action` object. The real grounds are that `parse` refuses rather than
  normalises, and that the fallback path has no parsed form.
- **Round 2** — two findings. *"Two limits" enumerating three*: correct, and the same
  undercount-by-enumeration the gate map's `action none` row was corrected for on 2026-08-14, repeated
  within the week. *`error.stdout` may be a Buffer despite `encoding`*: **did not reproduce** — probed on
  node v26.7.0 across **ten** error paths — string on the nine that produce output, `undefined` on
  ENOENT, never a Buffer. Coerced anyway and labelled **hardening, not a fix**, with the control
  recorded: `encoding` absent *does* produce a Buffer, so the probe can see what it reports missing.
  _(That count reached ten the hard way. The reply posted to the thread said **nine** and tabulated a
  path this session had not actually run — the supervisor's four probes and mine were being added
  without their union being taken. Re-run in one place: ten paths, nine strings, one `undefined`, zero
  Buffers. A figure without its instrument, published in the round whose own finding was a count that
  did not move with what it counted.)_
- **Round 3** — empty. No inline comment, no suppressed note. Terminated on emptiness, not on the bound.

## Where this leaves the tree

**PR [#272](https://github.com/sleepy-panda-srl/portulan/pull/272) open at `4af99d8`, unmerged — the
maintainer merges, and #269 stays OPEN until he does.** `mergeStateStatus` is `BLOCKED` on unresolved threads, which is
`required_conversation_resolution` doing its job: the App cannot resolve threads, so all four carry
replies and none is resolved by the party that answered it.

Suite **1608** (1590 + 18), **eleven** recipes exit 0 each read individually, seam scan clean against 51
distinguishing terms with the grep control-cased in both directions before each use. **Six mutations each
red the rail** rather than shrinking it to a no-op. Composition costs **0.041 ms** median and `parse`
**0.003 ms**, against a ~30 ms end-to-end invocation — so arm 3, emitting a composed file at compile time,
is not needed and the threshold for revisiting it is stated rather than left to taste.

The gate map's honest-holes list moves **six → seven**: the hook composes from the root derived from the
manifest's `tree` and wires no discovery, so a pack resolving only from the host cache reaches a bare
`compile` and not this hook. Which resolution set is right for a *rail* is
[#264](https://github.com/sleepy-panda-srl/portulan/issues/264)'s question and was not decided here.

**Still open by name, untouched:** #264, #266, #268, #270, and **#265 routed to the maintainer** as a
policy question — whether a change to a pack's gate fragment owes a version bump — with nothing in the
tree saying and nothing checking.
