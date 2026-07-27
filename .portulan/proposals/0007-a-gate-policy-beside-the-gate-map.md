# Proposal 0007 — a gate policy beside the gate map

**Status.** Applied in the same change that proposes it, and recorded here for the reason the earlier
proposals were: the decision has a shape somebody will want to argue with later, and the argument is
worth more than the outcome.

**Decision needed from the maintainer:** none for the shape below — it was ruled at session open. What
remains open is named at the bottom.

## The problem

Milestone 4's criterion says `gates.json`. The workspace already had a gate map — `gate-map.md`, prose,
pointed at by `slots.gates`. Something had to give, because a compiler cannot dispatch on paragraphs and
this repository will not tolerate two files quietly stating one policy.

## What was decided

**Both files, with the seam made checkable.** `gates.json` is the policy; `gate-map.md` is the argument.
A new optional top-level manifest key `gates` points at the policy. Spec **2.0 → 2.1** — additive, so
every existing manifest stays valid and the demo workspace was deliberately left at 2.0 to exercise that
path rather than being swept along.

Every rule carries an `id`; the prose cites ids in code spans; membership is asserted **both ways** by
the compiler's suite, anchored to the real tree rather than a fixture.

## Why not the two obvious alternatives

**Generate the prose from the JSON.** Refused: it adds a build step to a product whose thesis is that the
files are the product, and generated prose is prose nobody edits, which is how rationale dies.

**Extract the JSON from the prose.** Refused: it needs the ambitious parser `spec/slots.md` already warns
against for the claims lint. The failure mode is false reds, and a false red is what gets a whole check
switched off — this repository has that written down after paying for it once.

## The honest limit, stated rather than engineered around

The membership check holds *that* a rule is mentioned. It cannot hold *that the sentence is true of the
rule*. A gate map paragraph can describe `push-to-a-remote` as Propose while the policy compiles it as
Gated, and nothing here will notice. That is the same boundary that let this file's own predecessor claim
the agent identity did not exist for hours after it did — prose about a fact is invisible to a checker
that reads paths and ids.

So the tie-break is written into both files: **where they disagree, `gates.json` wins**, because it is
the one that compiles. A reader who finds a contradiction has found a bug in the prose, and knows which
way to fix it without having to ask.

## What the fourth tier costs, and why it was worth it

Core names three tiers. The policy carries four — `prohibited` joins them. This is a place where the
workspace layer is *richer* than core's vocabulary, which is normally a smell.

It was taken anyway because collapsing it is worse. Gated compiles to a prompt; the constitution has no
approval path at all. Filing "no agent edits `docs/vision.md`" under Gated would have compiled *never*
into *unless someone clicks yes*. Found at the session-open checkpoint by a supervisor counting the
classes in `gate-map.md` against the three the implementer had planned — before any schema existed, which
is the cheapest moment for that finding to arrive.

Whether `prohibited` should be promoted into `core/operating/autonomy.md` as a fourth universal tier is a
**constitution-adjacent question and therefore Marius's**, not an implementer's. Recorded here rather
than decided: core currently describes three tiers and a separate "platform floor", and a fourth class
may or may not be the right way to express *no approval exists*.

## Still open

1. **Should `prohibited` be promoted to core?** Above. Maintainer's.
2. **May a pack contribute gate rules?** The cascade is `core < pack < workspace`, and
   `packs/tools/README.md` has expected exactly this need since it was written. The schema does not
   preclude it and nothing implements it. Deliberately not built — but the vocabulary was kept
   host-neutral and id-addressed so that adding it later is a MINOR rather than a redesign.
3. **Where does `autonomy.md`'s platform-floor promise land?** Core says the compiler "generates that
   configuration" — branch protection, required checks. The milestone-4 row does not name that
   deliverable, and session 1's Copilot-ruleset clause may or may not be it. Surfaced to the maintainer.
