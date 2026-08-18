# Handoff — the store had thirty-five bytes left, and one record was a fifth of it

First handoff of 2026-08-08. A consolidation pass over the `.portulan` memory store, run on the
maintainer's instruction after the previous session's rule amendment breached the budget and had to be
compressed back under in the same change.

**State.** Store **122,845 → 118,109 bytes** against a 122,880-byte budget. Headroom **35 bytes →
4,771**. Nine recipes green. No record retired, none merged, one contradiction surfaced.

## Why the pass was owed, and it is a number rather than a feeling

`main` carried the store at **122,845 of 122,880 bytes — thirty-five bytes of headroom**, which is not a
budget with room in it but a budget already spent. The previous session added a paragraph to one rule and
`index` went red immediately; the compression that followed was done under duress, inside a change about
something else, which is the worst condition for judging what a record can lose.

**One record was 23,596 bytes — 19% of the whole store and 3× its nearest neighbour.**
[`../memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md) had accumulated
three arcs of errata, a census that was wrong three times and recorded each attempt, and a forensic
reconstruction of one pull request's round count.

## What the pass did, in the order the skill sets

**1. Retire — nothing.** Every record's `Retire when:` was read against the tree as it is now. None has
fired. The nearest candidate,
[`a-stated-enforcer-must-be-the-real-one`](../memory/a-stated-enforcer-must-be-the-real-one.md), had
**already evaluated its own condition at milestone 4 and recorded that it does not fire**, with the
reasoning — which is the retirement machinery working rather than an omission. Worth stating plainly: the
store has no dead records. It had one oversized one.

**2. Merge — nothing.** The obvious pairs turned out to be distinct rules.
`a-review-is-awaited-not-just-resolved` and `a-review-loop-needs-a-bound` cross-reference each other and
carry different facts (the guarantee, and the bound on the process built over it). The three
checker-honesty records — `a-checker-must-refuse-what-it-cannot-check`,
`verify-preconditions-fail-closed`, `a-checkers-coverage-is-measured-not-named` — are three facets a merge
would blur: what a validator may claim, what it does on a precondition it cannot meet, and how coverage is
established. **Merging them would have bought bytes and lost precision**, which is the trade this pass
exists to refuse.

**3. Contradiction — one, surfaced and not resolved.**
[`a-published-window-cannot-be-unpublished`](../memory/a-published-window-cannot-be-unpublished.md)
_(renamed 2026-08-17 from `repo-is-private-until-flip-clearance`)_ says the
repository *"went public"* and reasons in the present tense. **It is private** — `private=true`,
`visibility=private`, `forks=0`, unauthenticated `GET` returns **404**, measured rather than recalled. The
flip back happened 2026-08-03 and the window 27 Jul – 3 Aug was world-readable.

The pass **does not pick a winner**: that is its own rule, and a consolidation that silently resolved a
contradiction would be a policy decision wearing the clothes of housekeeping. The measurement is written
into the record and the ruling is the maintainer's. The substance *strengthens* — a closed public window
is still a window and clones cannot be recalled — so what needs ruling is the tense, and whether the
`Retire when` still reads correctly against a repository that has now flipped twice.

**4. Compress — 5,934 bytes from one record, 25% of it.** What was cut is the narrative of *how the lesson
was learned*: the timestamped forensics of #105's answering pushes, the meta-paragraph about a clause being
derived and then ratified, the three-attempts-at-a-census story, and an errata-about-errata comparing #64's
two disagreeing carriers.

**What was not cut, because the skill forbids it:** the failure shape. All four rules survive **verbatim**.
The sibling-exemption definition survives verbatim — *this file is its one carrier* and proposal `0020`
quotes rather than restates it, so a paraphrase here would have broken a rule shipped four days ago. Both
provenance links, the retirement condition and its unit, the operational sentences a reader needs to
re-derive a count (*count pushes and then look inside each one*; two endpoints, two logins) all stand.

**Rule 3's text is left byte-identical to `main`, deliberately.** Pull request
[#176](https://github.com/sleepy-panda-works/portulan/pull/176) amends exactly that block, so touching it
here would have turned a mechanical stack into a hand-merge over doctrine. Different hunks, no conflict.

## What this does not do

It does not consolidate the other twenty-six records. They were read for retirement and for merging and
left alone, which is a judgement rather than an oversight: none is near the size that made this one a
problem, and a pass that trims every record because it is trimming one is churn against the merged record
for no budget it needed.

## Next

The maintainer's ruling on the visibility record's tense. Beyond that the store is under budget with
working room, and the next breach is a genuine signal again rather than the arithmetic of a full shelf.
