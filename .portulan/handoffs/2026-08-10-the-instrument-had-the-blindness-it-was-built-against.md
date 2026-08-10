# Handoff — the instrument had the blindness it was built against

2026-08-10, off the milestone row. [#196](https://github.com/sleepy-panda-works/portulan/issues/196)
closed by [#211](https://github.com/sleepy-panda-works/portulan/pull/211): three carriers asserted that
#91 *names* the missing-sibling class, and `0020` names it.

## What was wrong, and what was not

#91 is the fail-open incident — *an index that cannot be READ is reported as one that is absent*. Citing
it as **the incident whose repair taught the class** is correct. Asserting it **names** the class is
checkably false, and the maintainer's ruling of 2026-08-09 is the reason this is worth a change at all:
*a checkable citation that fails the check is worse than the vague superlative it replaced*.

_[Corrected 2026-08-10, original words above left verbatim: **that aphorism is this session's, not the
maintainer's** — his 2026-08-09 comment on #196 does not contain it. Its other carriers at the time of
this correction are `docs/plan.md`'s Session log, which correctly frames it as *"the lesson is
review's"*, and the #217 handoff, which quotes it only to say whose it is. Attributing it to his ruling
is a citation asserting the wrong carrier, which is the very
class this handoff is about, committed in its own opening paragraph. His actual words: **"Citing it as
the incident whose repair taught a class is correct. Citing it as the carrier that names the class is
false; `0020` names it."** Found by the fresh-context pre-commit supervisor on
[#217](https://github.com/sleepy-panda-works/portulan/issues/217), which was about to seal the
misattribution into living doctrine.]_

Three sites, all in `cli/`, all repaired in one commit:

| Site | Said |
|---|---|
| `cli/collisions.test.mjs:14` | "the class [#91] **names**" |
| `cli/control-chars.mjs:223` | "the class this repository **files as** #91" |
| `cli/index.mjs:1088` | "**defect class #91**: a fix arriving without its sibling" |

One stroke, because this is `0020`'s own rule applied to citations **of `0020`** — a place it was always
going to bite eventually, and it did.

## The instrument, and its own third blindness

**Neither the issue title's ten nor its corrected comment's three were carried into the change.** The
census was re-derived, because this is the arc the census lesson comes from. Two blindnesses were known
going in; the third was **this instrument's own**, on its first run:

1. **The classifying phrase wraps across comment-line boundaries** — a line grep sees half a sentence
   and matches neither half. Reflow each file to one string, carrying a source line per character.
2. **Comment leaders sit between the words** once it wraps. Strip them before joining.
3. **A markdown link's URL sits inside the phrase** — `the class [#91](https://github.com/…) names` —
   and its dots defeat any pattern written for prose. Collapse a markdown link to its label text
   before classifying — a URL is not prose.

Blindness 3 **under-found `cli/collisions.test.mjs:14`** — the very site the issue's own correction had
flagged as the one that says *names* verbatim. The first classifier run reported two wrong sites, not
three. It was caught only because the number disagreed with the maintainer's, which is the wrong reason
to catch something: had the two agreed, the instrument's hole would have shipped inside the change whose
subject is instruments with holes. **A second instrument agreeing is not a demonstration.**

Also removed: a raw-text pre-filter, which would have reintroduced blindness 1 for the sake of speed —
`issue\n// 91` defeats `/issue\s+91/` on the raw string for precisely the reason the instrument exists.

**The blindness, reproduced on demand.** Of three occurrences of *"a fix arriving without its sibling"*,
**two wrap** (`cli/control-chars.mjs:222→223`, `cli/index.test.mjs:704→705`); a line grep finds **one**,
reflowed finds **three**. That is the pair the 2026-08-09 sweep missed, made repeatable.

**Census: 46 citations in 18 files — 3 wrong, 22 citing the incident, 21 records.** After: 43 and 0.

## Two figures in the issue that do not survive re-measurement

- `.portulan/memory/a-review-loop-needs-a-bound.md` is cited at **`:160`** by both the issue body and its correcting
  comment. The file is **119 lines**; the citation is at **`:101`**. It moved when #202 demoted and
  split the record, and both figures predate that.
- The corrected comment's `3 + 13 = 16` silently omits `.portulan/tasks/0010:27` and `0011:71`. Both are
  correctly left alone (`Status: DONE`, records), but neither was ever ruled on.

## The lane, and the checkpoint that changed the diff

The brief guessed triage. **The gate map puts triage at one file; the code change touches three**, so it is
full-lane and the pre-commit checkpoint was owed *before* the commit. It ran fresh, re-derived the
census independently, agreed on all three sites — and returned **APPROVE-WITH-ADJUSTMENTS** on something
worth having:

> An earlier draft wrote `cli/collisions.test.mjs`'s citation as a **relative markdown link** while the
> other two used the tree's bare-backtick idiom. One rule, three carriers, **two wordings**, inside the
> change repairing exactly that.

It then measured *why* rather than arguing it: `.portulan/verify/docs.sh:150` is `case "$file" in *.md) ;; *)
continue ;; esac`, so the `links` check never opens a `.mjs`. The link would have been checked by **no
rail at all**, and would have traded a URL immune to file moves for a path nothing verifies. Withdrawn.
All three now read ``the class `0020` names`` — the form already standing at four `cli/` sites, so the
class has **seven carriers in one wording**.

## One twin left disagreeing, deliberately

`cli/index.test.mjs:704` argues `cli/index.mjs:1088`'s point in nearly the same words and **keeps #91**. The
possessive form cites the incident, ruled defensible on 2026-08-09, and the thirteen sites using it were
ruled untouchable. So the implementation comment and its test comment cite two carriers **by ruling, not
by oversight** — recorded in the commit message, the PR body and here, so the next sweep reads it as
decided rather than missed. This is the one place the change knowingly declines `0020`'s sweep, and the
reason is that `0020` does not outrank a maintainer's ruling on what the citations mean.

## Left open — the issue's residual question, not taken

#196 says what remains is *"whether the incident form is worth ratifying in writing."* **That is a
doctrine call and this session did not take it.** One finding bears on it:
`.portulan/memory/a-superlative-is-a-count-nobody-ran.md:10` already says *"Name the class, and cite the incident **or**
the record that carries it"* — the `or` reads as permitting the incident form outright. What it does not
do is separate *citing the incident* from *asserting the incident names the class*, which is the whole
distinction here. So the gap is one clause, not a missing rule.

## Round 2 put the class inside this change's own records

Round 1 was empty. **Round 2 raised three suppressed notes, all right, and all the same defect this
change exists to fix** — a citation that reads as a checkable coordinate and fails the check. Mine, in
the records: `docs.sh:150` and `verify/docs.sh:150` for `.portulan/verify/docs.sh:150`, and
`index.mjs:1088` for `cli/index.mjs:1088` — that last in a sentence whose *other* citation was fully
qualified, which is the tell. Promoted to threads under `0021` shape 1, so they gated.

**Swept rather than patched at the three found sites.** The same instrument idea turned on my own prose:
extract every backticked `path(:line)` from the handoff and the log entry, test whether it resolves.
**Eight, not three.** All fixed. Declining `0020`'s sweep here would have been the joke writing itself.

One survivor on purpose: `` `AGENTS.md` `` in the PR body's table sits inside a **quotation of
`cli/vendor.test.mjs`'s own comment**. Quoting is not citing; re-pathing another file's words would
falsify the quote. **That distinction is the same one this whole change turns on** — what a sentence
*does* with a reference decides whether the reference is wrong, not the reference's shape.

## Rounds 3 and 4, and the rebase that invalidated the fix's own citations

**Round 3:** two grammar notes taken (`neither … nor` agrees with the nearer subject, so *were*), swept
to all three carriers including the reply already posted on #196. One note **refused with the render** —
it claimed an inline code span split across a newline shows as plain text; CommonMark turns that line
ending into a space, and `gh api markdown` on the exact two lines returns one joined `<code>` element.
Measured through the renderer that serves the file, not reasoned from the source.

**Round 4** raised the class a third time and was right: two carriers said *"this touches three"* where
the pull request touches six. Triaged to #213 rather than taken — rule 4's sibling exemption *buys
rounds and does not remove the gate*, and an extension past two is the maintainer's to grant. **He
granted it**, so both carriers now read *the **code change** touches three*, and #213 closes with it.

**Then the rebase onto `43f1e54` proved the point again, at this change's own expense.** #206 added one
line to `cli/control-chars.mjs`'s header, which moved the repaired site from **222 to 223** — so the
handoff's own table and its wrap measurement both became **checkable citations that fail the check**,
silently, without anyone editing them. Re-measured on the rebased tree and corrected to `:223` and
`222→223`.

**And the round-2 sweep had not covered them.** Its instrument extracted `` `path(:line)` ``, which the
arrow form `` `control-chars.mjs:221→222` `` does not match — so the two wrap citations were invisible
to the very sweep written to catch this class, one round earlier. **Three instruments in one change,
each blind to something the previous one was built to see.** The durable half: *a line number is a claim
about a tree, and a rebase can falsify it without touching the sentence.* Re-measure line citations
after every rebase, and never trust a sweep's shape to cover a notation it was not shown.

## Verification, and what is undemonstrated

**Ten recipes green** — the nine declared, each run and read, plus composed `tools/github:actions-pinned`
(4/4 pinned). Suite **1240 pass / 0 fail** on the rebased tree (#206 brought it from 1187). Seam scan
clean across diff, branch and commit message, run against **the explicit term list in the private
context's *The seam scan* section** — not a harvest of capitalised nouns, which yields false positives.

**Undemonstrated, and it is the important half.** This ships **no rail**. Nothing in the repository can
fail on a citation asserting #91 names the class, so the next sweep can reintroduce this exact defect
with every recipe green — which is how it arrived, twice. The suite total is unchanged **by design**:
comment text is invisible to it, and no test asserts any of the three comments. And the correctness of
the thirteen survivors is asserted by a ruling and demonstrated by nothing.
