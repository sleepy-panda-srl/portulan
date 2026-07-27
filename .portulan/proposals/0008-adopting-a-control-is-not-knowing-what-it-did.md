# Proposal — adopting a control is not the same as knowing what it did

**Incident.** Not an outage. Two proposals in two days each cited
[`../memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
as precedent — [`0006`](0006-dependabot-security-updates.md) calling itself the second instance, and
[`0007`](0007-every-watcher-ships-with-its-observation-procedure.md) the third — and the handoff for that
session proposed that three instances meant the rule was "stated too narrowly."

Reading the rule against its own three citations says something more useful than *broaden it*. **Only the
first citation actually matches the rule as written.** The rule says:

> When a rule is adopted before the check that enforces it exists, assume the existing corpus already
> violates it, and say so in the adopting change.

That is about **arrears** — the back-catalogue behind you, silently non-compliant, discovered later as what
looks like a regression. Measured against that:

| Citation | What actually went wrong | Matches the rule? |
|---|---|---|
| Proposal 0002's provenance mandate | 3 of 5 existing memory records violated the new rule | **Yes** — this is arrears, exactly |
| 0006 — SHA pinning | pinning closed the tag-hijacking hole and **opened a staleness hole in its place**, and nothing was paired with it to watch the new one | No — nothing was in arrears; a *new* risk was created |
| 0007 — the `dependabot.yml` watcher | the watcher itself could not be shown to work; success and failure produced identical silence | No — nothing was in arrears; the *control itself* was unverified |

So the citations were loose. Both were filed under the nearest available rule because it was the nearest
available rule, which is its own failure mode: a rule that accumulates near-misses stops discriminating, and
then it stops being usable as a check.

**What the three share** is not arrears. It is that **something was adopted, and the means of knowing what it
did was not adopted with it.** The consequence differs each time — a corpus put in arrears, a new risk
created in place of the old, a control that cannot be observed working — and naming only one of the three is
what let the other two get mis-filed.

**Proposed rule.** Amend
[`../memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
so its general form leads and the arrears case becomes the first of three named consequences:

> Adopting a control is not the same as knowing what it did. When you adopt one — a rule, a mandate, a pin, a
> watcher, a required check — name what it changes, in three directions, and record which of them you have
> not checked:
>
> 1. **Behind it** — what the existing corpus now violates, because nothing enumerated it at the moment of
>    adoption.
> 2. **Beside it** — what new risk it creates in place of the one it closed, because a control that removes a
>    failure mode usually substitutes another.
> 3. **At it** — whether the control itself can be observed working, because a control whose success and
>    failure look identical is indistinguishable from an absent one.
>
> An unchecked direction is not a reason to refuse the adoption. It is a thing to write down, dated, in the
> adopting change.

Everything the current entry says about arrears is kept verbatim as direction 1 — its reasoning, its two
cheap moves, and its *what it does not say*. Direction 3 already has a specific rule of its own,
[`0007`](0007-every-watcher-ships-with-its-observation-procedure.md), which stays: the general form tells you
to look at the control, and 0007 tells you what looking costs and what to do when there is no safe test.
Direction 2 is the one with no rule behind it, and is the reason this proposal exists rather than a memory
edit.

**Enforcement.** Honestly, none today, and less than the parent has.

- The parent's arrears direction is at least *countable* — "how many existing records satisfy this" is
  usually a `grep`, which is why that entry could name two cheap moves. Directions 2 and 3 are not countable:
  they ask what a change makes newly possible, which no tool here evaluates.
- What the amendment buys is **discrimination, not enforcement**. Three named directions give a reviewer
  three questions to ask at proposal time, and — the concrete part — make a mis-citation visible. Under the
  current single-direction wording, 0006 and 0007 both read as precedent-backed; under the amended wording
  they would each have had to name which direction, and neither would have picked direction 1.
- Candidate input for the milestone-4 enforcement compiler and, more plausibly, for the milestone-5
  librarian: "enumerate the corpus against a proposed rule at the moment it is proposed" is already this
  entry's own stated retirement condition, and directions 2 and 3 are the part a librarian could prompt for
  even if it cannot decide.

**Provenance.** `form=link`
`href=`[`https://github.com/sleepy-panda-works/portulan/pull/28`](https://github.com/sleepy-panda-works/portulan/pull/28)
— the pull request whose proposal was the third citation and whose handoff raised the question. The two
mis-citations are readable at [`0006`](0006-dependabot-security-updates.md) and
[`0007`](0007-every-watcher-ships-with-its-observation-procedure.md), in this repository, carrying no client
material, so no seal is needed. Retire when rule adoption and consequence-enumeration land together as a
matter of course — the parent entry's own retirement condition, inherited unchanged.

**Honest limits.**

- **This is a rule about how to write rules, which is the easiest kind to over-value.** It changes no
  behaviour on its own and adds three questions to a process that already has several. The case for it is
  narrow and specific: two documents cited a precedent that did not fit, five days apart, and neither author
  noticed. That is a discrimination failure, and it is the only thing this amendment fixes.
- **If accepted, the citations in 0006 and 0007 should be corrected in the same change**, naming direction 2
  and direction 3 respectively. Leaving them would preserve the exact defect the amendment exists to prevent,
  in the two documents that motivated it.
- **Three directions may not be all of them.** The set was derived from three instances, which is a thin
  basis, and a fourth may arrive that fits none — in which case this entry gets the same scrutiny it is
  applying here, rather than a fourth bullet bolted on. Preferring a rewrite to accretion is the lesson of
  the entry it amends.
- **The parent rule is not wrong and is not being replaced.** Its arrears reasoning is the most developed part
  of it and survives intact. What changes is that it stops being the only named direction, and therefore stops
  being the default home for anything adjacent.

**Decision.** _Pending — Marius Cetanas._ Raised by the same session that produced both mis-citations, which
is worth stating: an agent proposing a rule that would have caught its own two errors is arguing from its own
record, not from taste. Written by an implementer agent (Claude Opus 5).

**Status: PROPOSED, 2026-07-27.** Not applied. On acceptance the change is the amendment to
`a-mandate-nothing-checks-is-already-broken.md` plus the two corrected citations, in a pull request separate
from this one — the sequence 0006 and 0007 both followed.
