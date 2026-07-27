# Proposal — name the enforcer, and re-read the prose you just falsified

**Status: REVISED 2026-07-27, still PROPOSED.** Not applied. Marius's decision on the first draft was
**revise, not accept**: the diagnosis was right and the directions were wrong. This is the revision.
What it replaces is recorded rather than deleted, because *why* the first set failed is the most useful
thing this document knows.

## What the first draft got right, and where it went wrong

**Right:** two proposals in two days each cited
[`../memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
as precedent, and only one of the citations fitted. That is a **discrimination failure** — a rule that
accumulates near-misses stops being usable as a check — and it is still the thing worth fixing.

**Wrong:** the three directions it proposed (*behind it* · *beside it* · *at it*) were induced from the
three citations that happened to be open, and they turned out to be **ground already covered**:

| First draft's direction | Already covered by |
|---|---|
| *Behind it* — the corpus now in arrears | [`a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md), which is exactly this and says it better |
| *At it* — can the control be observed working | [`0007`](0007-every-watcher-ships-with-its-observation-procedure.md), accepted and applied the same day |
| *Beside it* — a new risk in place of the old | its one motivating instance — a SHA pin closing tag-hijacking and opening staleness — was closed by adopting a watcher, which is 0007's subject. One instance is not a direction. |

Taxonomy over covered ground does not earn its tokens. Worse, a three-bullet checklist whose bullets all
point at existing rules teaches a reader that the checklist *is* the rule, and the rules it points at
stop being read.

**The derivation was the error.** Those directions came from the three documents in front of the author.
The same day produced **two other patterns, repeatedly**, and neither appears above — because nobody was
looking at the documents where they lived.

## The two directions, derived from what actually recurred

### Direction A — the stated enforcer is not the real one

One axis, two signs, which look like opposites until named together:

- **Overclaim** — asserting the platform refuses what only the gate forbids.
  [`0006`](0006-dependabot-security-updates.md) shipped saying "an agent cannot perform them" of three
  settings, when two are reachable by any admin-scoped token. **Prohibited is not impossible.**
- **Underclaim** — asserting policy or habit where the platform is enforcing.
  `sha_pinning_required: true` was described everywhere as "the organisation's policy" — language that
  reads as a convention people comply with — while the platform refuses unpinned actions outright.
  **A rail written down as a habit.**

Same defect, opposite signs: *the stated enforcer does not match the real one*. Each teaches the wrong
lesson in its own direction. **Overclaim teaches an agent not to attempt what is merely forbidden**, so
the prohibition is never tested and its real strength is never learned. **Underclaim invites trusting
discipline where there is steel**, so the steel goes unrecorded and the next person removes it as
ceremony.

More from the same day, which is what makes this a direction rather than an anecdote: the identity table
claimed impossibility where the tier claimed approval; the platform floor was described as one layer when
it is three; a gate map called the floor the thing that refuses a push *"regardless"* after an audit had
withdrawn precisely that unconditional reading.

> **Rule.** A claim of impossibility, or of guarantee, states what enforces it. *"An agent cannot do X"*
> is incomplete. *"The platform refuses X"*, *"the gate forbids X and the token could do it"*, and
> *"convention asks for X"* are three different sentences, and only one is true of any given X.

**Mechanization: partial, and the limit is the point.** The proposal and codify templates gain an
**`enforced by:`** expectation, so a rule arriving without one is visibly incomplete at review. That
catches *new* rules. It does **not** catch the instances above, which were prose in documents nobody was
editing — no lint here reads a sentence and knows whether GitHub would refuse the thing it describes.
Past that template line this is a **review-checklist direction**, and saying so is better than implying
machinery that does not exist.

### Direction B — a change falsifies the prose that defines it

A definition, an example, or a description is invalidated by the very change that alters what it
describes — and the change looks complete, because the mechanical part *is* complete.

- Moving one action between tiers **falsified three separate definitions of the tiers**, none of which
  mentioned that action.
- Dependabot rewrote a pin and could not rewrite the paragraph *about* the pin, so `main` briefly carried
  a false claim **produced by the fix working exactly as designed**. A mechanical revert is not a
  narrative revert.
- The same week: an Auto-tier definition — *"nothing here reaches another person"* — stopped being true
  the moment a push moved into that tier; a heading reading *"Above the tiers"* survived the arrival of a
  tier it now names; a tier table's own example went stale in the repository that wrote it.

> **Rule.** After changing a thing, grep for prose *about* that thing. The edit that completes a change
> is usually not in the file the change was in.

**Mechanization: none, honestly.** The claims lint cannot see this. It resolves paths and compares
declared claims against the tree; *"this sentence defines a category that no longer has these members"*
is semantic, and a path-shaped check is blind to it. The honest enforcement is a **named pre-commit
checklist step**, and calling it a checklist step rather than a rail is the whole of what it can offer.

## What this asks for

1. Amend [`../memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
   **not at all.** The first draft proposed rewriting it around three directions; that was the error. It
   is correct as written and stays.
2. Add **two memory entries**, one per direction, each carrying its own instances — rather than growing
   one entry into a taxonomy that then becomes the only entry anyone reads.
3. Add an `enforced by:` line to [`../../core/templates/proposal.md`](../../core/templates/proposal.md)
   and the matching step in [`../../core/skills/codify/SKILL.md`](../../core/skills/codify/SKILL.md).
4. Add the grep-the-prose step to the pre-commit conditions in [`../dod.md`](../dod.md).
5. Correct the two loose citations in [`0006`](0006-dependabot-security-updates.md) and
   [`0007`](0007-every-watcher-ships-with-its-observation-procedure.md) — as the first draft also asked,
   and for the same reason: leaving them preserves the defect this document exists to name.

**Provenance.** `form=link`
`href=`[`https://github.com/sleepy-panda-works/portulan/pull/28`](https://github.com/sleepy-panda-works/portulan/pull/28)
— the pull request that raised the question. The instances behind both directions are the 2026-07-27
session log and the [#24](https://github.com/sleepy-panda-works/portulan/pull/24)–[#29](https://github.com/sleepy-panda-works/portulan/pull/29)
cluster, all in this repository and carrying no client material, so no seal is needed.

## Honest limits

- **Two directions derived from one day is a thin basis**, exactly as three from three documents was. The
  difference is the count: each direction here has **four or more** instances from that day alone, where
  the first draft's *beside it* had one. Better, not good.
- **Direction B has no mechanization and direction A has very little.** Both are review-checklist
  directions with a template line attached, and a checklist is a thing people stop reading. This
  repository has a memory entry about mandates nothing checks; these two are in that category **by
  construction**, and the entries should say so in their own text rather than leaving a reader to notice.
- **This is still a rule about how to write rules** — the easiest kind to over-value. It changes no
  behaviour on its own. The case is narrow: two patterns each recurred four or more times in a single day
  and neither had a name, so neither could be cited when it happened again.
- **The first draft's fate is the argument for this one's limits.** It was written with the same
  confidence, from a smaller sample, and it was wrong in a way its author could not see. Reading this
  document as settled would repeat that.

**Decision.** _Pending — Marius Cetanas._ The first draft was decided **revise, not accept**; this is that
revision. Written by an implementer agent (Claude Opus 5).
