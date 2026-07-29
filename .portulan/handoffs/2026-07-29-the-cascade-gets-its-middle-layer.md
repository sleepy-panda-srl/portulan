# Handoff — the cascade gets its middle layer, and tighten-only gets its second axis

**Date:** 2026-07-29 · **M6, the first session** · Branch
`m6-pack-schema-and-the-checkpoint-ritual-pack` ·
[#105](https://github.com/sleepy-panda-works/portulan/pull/105)

**State.** The public-repo mechanism half of milestone 6 is built and open as a pull request: the Pack
Definition, the first pack, resolution, and the tighten-only merge. `portulan-internal` does not exist
and the Sleepy Panda product task is untouched — both Gated, both session 1. The row moved `todo →
in-progress`; the milestone is **not** closed. Suite 635 → 673, eight recipes green. Supervision:
session-open APPROVE-WITH-ADJUSTMENTS (12), pre-commit REQUEST-CHANGES (2 blockers + 1 minor), all
folded in before the push. Two Copilot rounds answered inside the loop's bound: three inline findings
(all real, all fixed) and two suppressed notes — one fixed, one declined with a count of this
repository's own gate rules rather than an argument.

## Decisions + why — the reasons are the payload

- **The Pack Definition got its own version train (1.0) and the Workspace Definition did not move** —
  because no constraint on a workspace manifest changed. The session opened intending `2.5 → 2.6` with
  every carrier corrected, on the strength of a remembered instruction; the session-open checkpoint
  refused it and was right twice over. MINOR means *new optional slots, relaxed constraints*, and
  `spec/workspace.schema.json` is byte-identical across this change (verified by sha at pre-commit).
  And `doctor` derives the current version from the schema's own `$id` and **refuses a manifest ahead
  of it** — so a 2.6 manifest without a 2.6 schema would have been refused, and the bump would have
  broken CI. That is the strongest available evidence the instruction was never real: it could not
  have been carried out. *Alternative considered:* one shared train, rejected because a bump in either
  contract would then mean a change in the other.

- **`packs` items stay free strings** — because tightening them to the canonical `category/name` form
  is a constraint an existing manifest could newly fail, and that is a MAJOR. The Pack Definition owns
  the name form; resolution maps it. This is the same reasoning that kept the two trains apart, one
  layer down.

- **Tighten-only is enforced in two layers, and on two axes.** The layers: the schema does what shape
  can do (`auto` is absent from the fragment tier enum, so demotion-to-unattended is unexpressible in a
  manifest at all), and the compiler does what only the composed base can (the relative comparison).
  The axes are the part that nearly went wrong, and the story is the reason to keep this paragraph:
  **the first implementation compared only the tier, which is not tighten-only.** A fragment naming an
  existing id at a stronger tier replaced the *whole rule, including its action* — so raising the tier
  while swapping the matcher passed every rank check. Demonstrated against this repository's live
  policy: `{id: force-push-without-a-lease, tier: prohibited, action: {none: …}}` was reported as
  `tightens gated → prohibited` and the emitted `Bash(git push --force:*)` gate **disappeared**. Rule
  ids are greppable by design and ship in `core/`, so knowing one is no barrier. A fragment naming an
  existing id must now carry that rule's action unaltered; to gate something else it contributes a new
  id. The tier is compared first so a demotion is still reported as a demotion.

- **The refusal is exercised by fixture, not by the shipped pack** — because nothing exercises it
  naturally. The one real pack contributes pure additions against a core layer that ships no gate
  policy at all, so no shipped artifact would ever take the refusing branch. A check nobody has seen
  fail is a check nobody has seen work.

- **Task 0008 was fixed first** — because a pack that cannot ship skills is most of a pack that does
  not work, and the task named this row as what it blocked. The bound is its own constant rather than
  `MAX_WALK_DEPTH`: one bounds a search of something the manifest pointed at, the other a sweep of
  everything it did not. Three of its five tests were demonstrated red against the pre-fix validator
  before the fix was believed.

- **Customer zero composes the pack, so the gate fragment reached this repository's live policy** —
  `Bash(git commit --no-verify:*)` is now `ask` in `.claude/settings.json`. Taken deliberately rather
  than avoided: a resolution demonstration that stopped short of the compiled artifact would have
  proved the manifest parses, not that the cascade runs. It is a real policy change and the pull
  request asks for it to be reviewed as one.

## Open questions — both the maintainer's

- **Issue [#98](https://github.com/sleepy-panda-works/portulan/issues/98) — routed, not answered.** Put
  to him at session-open; his answer was to forward it to a **process-lessons-learned session**. Two
  things were done so that session does not re-derive them. First, the framing was corrected at source:
  **#98's body quotes a draft that never merged.** It says `memory.md` "now states the arrival as
  fact", but `7726c50` — *"The doctrine says 'owed', not 'arrives'"* — reworded that sentence inside
  #96 before it merged, and its own message says *"#98 stays open for the substantive choice."* The
  "arrives in milestone 6" wording **does** sit permanently in `main`'s ancestry (`a833d4c`, also an
  ancestor) but **never survived to a merged tip** — a distinction worth keeping, because the first
  claim I made about it ("never existed on `main`") was wrong and the session-open checkpoint caught
  it: I had searched for a string that never existed rather than the one that did. So #98's own option
  2 is already executed, and the live choice is three-way: amend row 6, amend a later row, or ratify
  the standing text and close it. Second, the pack schema is **memory-silent**, so no ruling is
  foreclosed — a persona already owes a memory scope by its five-part contract, so the pack distributes
  per-persona material with a declared scope under any answer, and a schema key now would have quietly
  executed one option ahead of the choice. **The cost that makes this urgent rather than tidy:** at
  M6-close the doctrine sentence names a *closed* milestone that did not deliver, and `dod.md`
  condition 4 fails outright rather than softly.

- **The plugin-tag namespacing conclusion needs re-deriving.**
  [`the-tag-and-the-install`](2026-07-26-the-tag-and-the-install.md) says its basis went stale and the
  conclusion "needs re-deriving before milestone 6 leans on it… the day a pack is versioned
  independently of the engine." The Pack Definition's `portulan.version` field is that day. **Not done
  here** — it bears on how a pack is released from the private feed, which is session 1's subject.

## For the next session

Session 1 is the Gated half and none of it can be prepared unilaterally: create
`sleepy-panda-works/portulan-internal` as a **private** repo with a marketplace manifest, resolve
`rituals/checkpoints` from that feed (the resolver already takes its roots as an argument, so this
should be a new root and not new code — if it turns out to need new code, that is the finding), and run
a Sleepy Panda product task through the full loop from a private-feed install. The seam holds with a
thesis-6 edge: the public repo keeps mechanism only, anything Sleepy-Panda-specific lives in the private
feed, and the ritual pack must stay free of both.
