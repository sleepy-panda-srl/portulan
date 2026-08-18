# Handoff — the clause misquoted the ruling it ratified

2026-08-10, off the milestone row. [#217](https://github.com/sleepy-panda-srl/portulan/issues/217):
[#196](https://github.com/sleepy-panda-srl/portulan/issues/196)'s residual question — whether the
**incident citation form** is worth ratifying in writing — answered in one clause, in one carrier.

## What landed

`.portulan/memory/a-superlative-is-a-count-nobody-ran.md`'s rule sentence gains the distinction the
whole #196 arc turned on, and which that sentence could not previously draw:

> Name the class, and cite the incident or the record that carries it — **citing an incident as the case
> whose repair taught the class, never as the carrier that names it.**

Plus one sentence extending the record's own *"Nothing checks it"* bullet to the new clause, on its two
grounds: a grep for the incident form fires where it is correct as loudly as where it is not, and **no
grep reads what a citation asserts**.

## One carrier, and `0020` deliberately untouched

`0020` names the class; this record is about **citation form**. Stating the rule in both would commit
`0020`'s own defect — a rule with two carriers, obeyed at the narrower — on `0020`'s own subject. The
session-open supervisor pushed on this and it survived: a grep of the living tree finds **no other
carrier** of the citation rule, `0020` never stated it, and `0020`'s own nine `#91` citations are all
the legitimate incident form, so they need no edit. **Recorded as decided, not left conditional**, so
the next sweep does not read the absence as an oversight.

## The finding that mattered: the clause misquoted the ruling it ratifies

The first draft attributed to the maintainer a sentence he never wrote:

> *a checkable citation that fails the check is worse than the vague superlative it replaced*

**That aphorism is the session's, not his.** Measured rather than argued: his 2026-08-09 comment on #196
does not contain it, and a sweep of every repository comment since 2026-08-01 finds no instance authored
by him. Its real carriers are `docs/plan.md`'s Session log — which correctly frames it as *"the lesson is
review's"* — and #211's handoff, which is where the attribution to "the maintainer's ruling" was born.

So the change **imported a citation asserting the wrong carrier into living doctrine, and sealed it with
provenance, inside the clause that forbids exactly that.** Found by the fresh-context pre-commit
supervisor; it is the fourth time this arc's own class has recurred inside its own repair.

His actual words, now quoted verbatim in the clause and checked against the API rather than transcribed:

> **"Citing it as the incident whose repair taught a class is correct. Citing it as the carrier that
> names the class is false; `0020` names it."**

**Swept to the sibling.** The misattribution also stands in #211's merged handoff. Records are not
rewritten, so it takes **an appended dated bracket with the original words left verbatim** — the tree's
own idiom for correcting a dated record. `docs/plan.md:2123` needed nothing: it already credits review.

A second finding, folded: *"Ratified by his merge of #217"* — **issues are not merged**. It now reads
*his merge of the pull request closing #217 ratifies this drafting*, which is `0020`'s own idiom and is
present-tense about an act that has not happened yet.

## The instrument had a fourth blindness, and it is the one that had already shipped

`#{1,6}` in the comment-leader strip **ate a line-leading `#91`**, hiding those citations entirely.
Corrected to `#{1,6}(?=\s|$)`:

| Tree | Before the fix | After |
|---|---|---|
| this branch | 56 citations, 32 records | **59 citations, 35 records** |
| `43f1e54` (pre-#211) | 46 citations, 21 records | **47 citations, 22 records** |

The living verdicts do not move — all three recovered sites are records — but **#211's published "46
citations in 18 files" was an undercount of its own tree**, by an instrument whose title is *the
blindness it was built against*. Fourth blindness, third census, and it is stated here rather than
quietly corrected.

## The population, re-derived and not carried

Taken from the corrected instrument, never from #217, #196 or any handoff — all three carry superseded
figures:

- **22 living incident-form citations, 0 wrong**: the **13** the maintainer ruled defensible
  (`cli/vendor.mjs` ×4, `cli/vendor.test.mjs` ×3, `cli/index.test.mjs` ×3, `cli/index.mjs` ×2,
  `.portulan/memory/a-review-loop-needs-a-bound.md` ×1) plus **9 in `0020`** the ruling never listed.
Both figures are **as of `070b038`**, and they moved once already: this branch was rebased twice mid-review
onto a `main` carrying 31 commits dated today, and the record count went **32 -> 35** while the
living count held at 22. The rebase lesson, arriving on the change that cites it — a count is true of a
tree, so it is restated here with the tree named rather than left to imply the branch it was measured on.

- **35 record sites**, governed by the forward-only cutoff rather than by this sentence — so they are
  *not* scored as the clause working. Among them, `.portulan/tasks/0010:27` and `0011:71`, the pair the
  #211 census recorded as **never ruled on**: both are `Status: DONE` task records, so the cutoff covers
  them, and the maintainer's merge absorbs that disposition rather than leaving it dangling.

## The demonstration was the supervisor's, because the author cannot grade his own sentence

The pre-commit supervisor classified every living site twice — under the sentence as it stands on
`main`, and under the amended sentence — reasoning from the sentences alone before reading the
maintainer's ruling or #211's table. **The delta is exactly the three pre-repair sites**: the unamended
sentence licenses citing the incident and is silent on the role the prose asserts, so it cannot separate
them from the thirteen. #196's own history shows that silence failing in **both** directions — the
issue's opening list over-repaired ten legitimate sites, and #193's sweep wrote the naming form believing
it compliant. Its classification then agreed with the 2026-08-09 ruling on all sixteen.

## Verification, and what is undemonstrated

**Ten recipes green**, suite **1240 pass / 0 fail**, seam scan clean against the **explicit** term list.
Checkpoints: session-open **A-W-A (8)** and pre-commit **A-W-A (4)**, both fresh-context Fable 5 on the
maintainer's standing instruction for doctrine, all adjustments folded.

**Undemonstrated.** The clause ships **no rail and argues why** — and the argument is now measured
rather than asserted: the strongest candidate rail, a naming-verb blocklist, **flags this very record
twice**, because the clause quotes both wrong forms as counter-examples. A grep cannot tell a mention
from a use, which is the clause's own thesis turned on the clause. So its only enforcement is a reader,
and the next sweep can reintroduce the defect with every recipe green — which is how it arrived twice.
**And the ratification has not happened**: it exists only at the maintainer's merge.
