# A superlative is a count nobody ran

**type:** rule
**scope:** workspace — anyone writing about a defect class in this repository
**provenance:** `form=link` `href=../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md`
— that proposal's Limits section reported the census and deliberately did not repair it, on the ground
that a 37-site prose sweep folded into a doctrine diff is a diff nobody reviews. This is the separate
change it named, on the maintainer's instruction of 2026-08-07.

**Do not write that something is "the defect this repository names most often."** Name the class, and
cite the incident or the record that carries it.

## Why it holds

**Re-derived on the day of the sweep — and then re-derived again, because the first instrument was
blind.** The superlative — *"names most often"*, *"names more often than any other"*, *"names most"*,
*"files most often"*, *"names most consistently"* — stood in **22 living carriers**, and named **four
different things**:

| Referent | Living occurrences |
|---|---|
| A rule with two carriers, or a fix that leaves its sibling ([`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)) | **10** |
| The fail-open — *"nothing looked"* reported as *"nothing wrong"* | **8** |
| Prose describing an enforcement that does not exist (`.portulan/dod.md` condition 4) | **3** |
| The only-ENOENT rule | **1** |

Four superlatives cannot all be true, and **nothing in the tree had ever counted any of them**. Each
site reached for the phrase to say *this one matters*, which is a real thing to want and is not what the
words mean. Every one of the twenty makes its point without the ranking, and most make it better: *a fix
that repairs one carrier and leaves its sibling* is checkable and links to `0020`; *the defect this
repository names most often* is checkable by nobody. That asymmetry is the whole rule.

**The count is not merely missing — it is expensive.** Establishing it means classifying every recorded
defect in this repository's history, which is judgement-heavy and would need a carrier of its own. So the
rule is *do not assert the ranking*, not *go and measure it*.

## What this deliberately does not do

- **It does not touch the records.** The same superlative stands **28 more times across 20 records** —
  handoffs, milestone files, merged proposals — under the forward-only cutoff: *a rule written after a
  record cannot bind it without rewriting the record to suit the rule.* Stated here so a later grep
  finding the phrase is not read as an incomplete sweep.
- **It does not ban ranking.** A ranking with a measurement behind it is a fact. What is banned is the
  bare superlative with nothing behind it.
- **Nothing checks it.** A grep would find the phrase and would also find the 23 records it must not
  touch, so the check is red on arrival and permanently — which
  [`a-mandate-nothing-checks-is-already-broken.md`](a-mandate-nothing-checks-is-already-broken.md) is the
  rule about. The sweep is a one-time repair; the rule's job afterwards is to stop the phrase coming back.
- **A grep for the phrase must join wrapped lines and strip comment prefixes, or it under-finds exactly as
  this rule's own census did.** The first sweep reported 20 across 18 and left **two** standing, both where
  the variant split across a `//` boundary — and the confirming re-run used the same instrument, so it
  inherited the same blindness. Found by a fresh-context checkpoint, not by the sweep. **A count is only as
  re-derivable as the tool that took it**, which is the rule one layer beneath the one this record states.

**The recursion is worth naming:** this is the two-carrier defect committed on the *name* of the
two-carrier defect — one phrase, twenty carriers, four meanings, drifting because nothing owned it. It
was found by running the sibling sweep [`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)
proposes, on that proposal's own vocabulary, while writing it.

**Retire when:** a census of defect classes exists with a carrier of its own, at which point a ranking
becomes a fact and this rule becomes a pointer to it.
