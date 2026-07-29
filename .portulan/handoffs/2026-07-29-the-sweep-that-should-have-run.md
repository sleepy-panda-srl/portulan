# Handoff — the sweep that should have run the first time

**Date:** 2026-07-29 · **post-M6-session-0, no milestone row touched** · Branch
`rule-3-said-placement-holds-the-gate` · closes
[#114](https://github.com/sleepy-panda-works/portulan/issues/114)

**State.** `main` at `56d34e7`, eight recipes green, YAML re-parsed, seam clean. Two sentences.

## What was wrong

[#110](https://github.com/sleepy-panda-works/portulan/pull/110) fixed rule 1 of
`a-review-loop-needs-a-bound.md`, which had claimed a reply *"is the only thing that clears the gate"*.
It is not: `required_conversation_resolution` clears on **resolution**, which
[`../gate-map.md`](../gate-map.md) makes the maintainer's judgement, travelling with his merge approval.

**Rule 3, four paragraphs later, made the same claim** — *"an answer that does not sit on it leaves the
gate closed"* — and #110 did not touch it. So that pull request shipped a record contradicting itself,
knowingly: the contradiction was found by Copilot at the two-fix-round bound, and rule 4 says the
remainder becomes an issue rather than another push. It did, and this is that issue.

The second finding is smaller and the same shape: `copilot-review.yml` said the notes appear only in
*"THIS SUMMARY"*, but on the fallback path where `$GITHUB_STEP_SUMMARY` is unset the same text goes to
stdout, where no summary exists. **"THIS REPORT" is true on both paths.**

## The lesson is the sweep, not the sentence

**This is the fourth time in one session that a fix was applied to the sentence that was reported and not
to its siblings**, and the fourth time review found the sibling rather than the author:

- `v0.1.0` named in three prose carriers; the handoff said two.
- `asserts` in two carriers; the fix touched one.
- The persona-contract ordinal wrong in four carriers.
- And now a gate claim in two rules of one file, one fixed and one left.

Every one was a `git grep` away. **This change ran the sweep before claiming the class closed, and the
sweep still missed one** — which is the finding, and it is worse than the four above.

The grep covered gate/clear/block in the record and `summary` in the workflow, and reported no further
carrier. **The pre-commit checkpoint then found one in `copilot-review.yml`** — an emitted string reading
`printed to the job summary`, **eleven lines below the sentence this change was fixing, inside the same
block** — false on exactly the fallback path that convicted `THIS SUMMARY`. _(Quoted as it stood **before
this change**, which removes that clause; it is not in the merged file, and a record naming a line number
in a file it is itself editing goes stale on merge.)_ So an earlier draft of this handoff and of the
Session log entry both said *"found no further carrier"*, and both were **false when written**. They are
corrected here rather than quietly softened.

**What the sweep got wrong is instructive: it grepped for the word, not for the claim.** The literal
`summary` missed nothing — **in the pre-fix file that line contained it**. What missed it was reading the
hits and stopping at the one already known, because the fix was in hand and the grep felt like
confirmation rather than inspection. A sweep that ends when it finds what you expected is not a sweep.

**Five instances now, and the fifth was inside the change written to close the fourth.** The honest
summary is not that this class is closed. It is that nothing in the repository can close it: no rail sees
prose claiming more than a mechanism delivers, and the only thing that has ever caught it here is a
reader — Copilot four times, a fresh-context supervisor once — checking a sentence against the code.

## What the rewrite is careful about

The original sentence's *true* half was discoverability: an answer not on the thread leaves a reader
hunting. That survives. What is removed is the gate claim, replaced with what a misplaced answer actually
costs — the reader, and whoever resolves finding nothing on the thread to judge. **The failure mode for a
change like this is replacing one overclaim with another**, so the new sentence names consequences rather
than mechanisms, and the mechanism sentence points at rule 1 instead of restating it.

## Still open, and still the maintainer's

**Rule 3 says suppressed notes are "never a reason to push again".** In one session this build pushed for
them twice ([#107](https://github.com/sleepy-panda-works/portulan/pull/107) and #110 round two, both
demonstrating false statements), refused one on preference grounds
([#109](https://github.com/sleepy-panda-works/portulan/pull/109)), and triaged two at the bound (#114).
**Three dispositions in four hours, none of them written down.** The working distinction — *a note
demonstrating a false statement gets fixed; a note expressing a preference gets a reply* — is not in the
rule, and adding it is a doctrine change rather than an implementer's call. #114's body carries the
argument; nothing carries the rule.
