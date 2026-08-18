# Handoff — a reply belongs where the comment is

**Date:** 2026-07-29 · **post-M6-session-0, no milestone row touched** · Branch
`a-reply-belongs-where-the-comment-is` · [#110](https://github.com/sleepy-panda-srl/portulan/pull/110)

**State.** `main` at `6840bd7`, eight recipes green, seam clean. Doctrine wording plus two workflow
report strings. No logic, no criterion.

## The gap

The loop rule split threads from suppressed notes on whether they **block**, and never said **where each
is answered**. Rule 1's *"a round is answered once, not per finding"* then reads as licensing one summary
comment for the whole round, threads included. Nothing in this repository said a thread is answered on
the thread.

Rule 3 now names the destination for each channel, and says which way round the exception runs: a note is
answered in a batched pull-request comment **because the platform gives it nowhere else**, not because
batching is the house style. Rule 1 gains the clause that keeps them apart — it bounds **pushes, not
replies**. `copilot-review.yml`'s two report strings say the same, since they are what a session reads at
the moment it acts.

## Three things the round caught, and the pattern behind them

**All three were correct, and two were claims this change itself introduced.**

1. **Rule 1 said a reply is "the only thing that clears the gate".** False. `required_conversation_resolution`
   clears on **resolution**, which [`../gate-map.md`](../gate-map.md) makes the maintainer's judgement,
   travelling with his merge approval. A reply is what the loop obliges; it is not what opens the gate,
   and they are not the same person's act. **This is `a-stated-enforcer-must-be-the-real-one` for the
   third time in one session** — prose claiming a guarantee the mechanism does not make.
2. **The workflow said suppressed notes mean "nothing else will ever mention them again".** The verdict
   step in the same file quotes them into the derived-verdict review. True when written, false since that
   step shipped, and this change was touching the sentence without noticing.
3. **The Session log entry linked the wrong handoff** — #106's, which documents a changelog cut. This
   file exists because of that finding.

**The pattern is the finding.** Three of this session's four review rounds found a sentence claiming more
than the mechanism delivers, and every one was in prose *about* correctness. The rails cannot see this
class; only a reader who checks the claim against the code can.

## For the next session

- **`a-stated-enforcer-must-be-the-real-one` earned its keep three times today** and has no rail. Its own
  retirement condition is not met and will not be soon. Worth knowing that the reviewer, not the
  implementer, caught it every time.
- **Rule 3 still says suppressed notes are "never a reason to push again".** Twice on
  [#107](https://github.com/sleepy-panda-srl/portulan/pull/107) they demonstrated statements that were
  false, and pushing was right; once on [#109](https://github.com/sleepy-panda-srl/portulan/pull/109) a
  note was a rendering preference about pre-existing prose, and refusing was right. **The rule has no
  words for that difference** — it is the shape #94 replaced, where the compliant answer to a known
  falsehood is to leave it standing. Raised in #110's body and unresolved; a carve-out is a doctrine
  change and the maintainer's.
