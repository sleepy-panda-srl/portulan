# Handoff — a correction reached three carriers of four

**Off the milestone row. Triage lane** by the threshold's own test — one file, no rule change, no new
claim about what the product does, no milestone effect. The pre-commit checkpoint ran anyway, on the
maintainer's instruction for this session.

## The defect

[`../tools/gh-bot`](../tools/gh-bot)'s opening docblock declared its scope as *"PULL REQUEST
CONVERSATION ONLY — comments, review replies, resolving threads."* **The third item was never true.**
GitHub refuses `resolveReviewThread` to a GitHub App, and the wrapper's own token is a GitHub App's.

## Measured before it was fixed, not after

Four measurements, 2026-08-10, none of them taken on trust from the report that opened the session:

| What | Result |
|---|---|
| The live installation's permission set | `{"contents": "read", "metadata": "read", "pull_requests": "write"}` |
| `resolveReviewThread` through this wrapper | `FORBIDDEN — Resource not accessible by integration` |
| Review-thread **replies** through this wrapper | Real — both threads on [#212](https://github.com/sleepy-panda-works/portulan/pull/212) carry `portulan-agent` comments |
| Who actually resolves, on [#195](https://github.com/sleepy-panda-works/portulan/pull/195) | 21 threads, 21 resolved, **all 21 by `marius-cetanas`** |

The refusal probe was aimed at a thread that was **already resolved**, so the mutation was a no-op in
the branch where it succeeded. A capability test that changes the world when it passes is not a test
anyone should run on a live pull request, and the already-resolved thread is what makes it safe.

## Why the repair is (a) and not (b), and why that is not a decision taken here

The session was offered two endings: correct the prose, or record a **gap** in the App's permissions
for the maintainer to rule on. **(b) has no object.** The refusal is not a permission the installation
is missing — it already holds `pull_requests: write`, the permission that covers review conversation,
and is refused anyway. There is no setting whose flip would grant this, so there is nothing for a
ruling to decide. That is reported rather than assumed: the permission set above was read from the live
installation on the day, not from a record of it.

The split is right on the merits regardless, which is the part that would survive even if GitHub changed
its mind — a reply is *what the agent says*; resolving is *the judgement that a review point is settled*,
and this repository gates merging on conversation resolution, so that judgement belongs to the merge
gate. [`../gate-map.md`](../gate-map.md)'s *Resolving a review thread* row has carried the refusal since
`69d61f1` created it on 2026-07-25 — its Identity cell amended 2026-07-27, *by hand* → *the maintainer
decides* — and needed no change here.

## The sibling sweep, and the thing it got wrong first

The session was told the gate map *may carry the same claim*. **Today it does not — and it did, which is
the more useful answer.** No living carrier in the tree still says an App can resolve a thread: the gate
map's row, [`./README.md`](../tools/README.md),
[`../memory/agent-activity-is-attributable.md`](../memory/agent-activity-is-attributable.md),
[`../memory/a-stated-enforcer-must-be-the-real-one.md`](../memory/a-stated-enforcer-must-be-the-real-one.md)
and four further sites that cite the row rather than restate it are all on the right side. The docblock
was alone, so the fix is one file.

**The first draft of this handoff said the gate map "never did", and the pre-commit checkpoint measured
that false** — at `69d61f1^` the gate map's conversation row read *"comments, review replies, resolving
threads"*, which is the docblock's sentence **word for word, in the same order**. That is not a
coincidence to be noted and passed over; it is the mechanism. The docblock was a **copy of the row**, and
`69d61f1` rewrote the original to *"comments and review replies"* — the exact wording restored here,
sixteen days later — while the copy went on speaking for the tool.

Worth recording that a change whose entire subject is a false claim about a capability drafted a false
absolute about its own tree, and that the instrument which caught it was the fresh context, not the
author. The claim was cheap to check and was not checked, for the ordinary reason: it read as background.

## How it survived, which is the part worth keeping

The history answers it exactly, and the answer is uncomfortable:

- **`ce13a45`, 2026-07-25 10:58** — *Give the agent an identity of its own* creates `gh-bot`, docblock
  and all, from the belief that the App could resolve threads.
- **`69d61f1`, 2026-07-25 15:52** — *"The agent identity cannot resolve a review thread; three documents
  said it could."* Four hours and fifty-four minutes later, the same day. Its own body says the claim was
  *"written into three places before anyone ran it, which is the order that matters here."* It corrected
  three files. **There were four.** The fourth had been written that morning by the commit the sweep was
  cleaning up after, and it was a **copy of the gate map's row** — see the section above.
- **`e680674`, 2026-07-28** — adds the `graphql` note to `gh-bot` stating the refusal **correctly**, into
  a file whose opening paragraph still claimed the capability. From that day the file carried a claim and
  its own refutation, over a hundred lines apart.

So the claim stood **sixteen days**, thirteen of them inside a file that also contained its own
disproof. Two classes, compounded: [`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)'s
— a fix not done at every site — feeding the `#133` class, prose wrong where the mechanism is right. And
the mechanism here was never wrong for a moment: the `api` allowlist admits `graphql` and says in terms
that GitHub refuses the mutation regardless, which is why nothing ever broke and nobody ever looked.

**The transferable lesson is about where the defect sat, not what it said.** A correction sweep counted
the carriers it had found rather than searching for the ones it had not — and the carrier it missed was a
*scope summary at the top of a tool*, which is read as orientation and audited as prose, by readers who
have come to the file to use it rather than to check it. **A copy of a sentence is the hardest kind of
sibling to find**, because it does not look like a second statement of the rule; it looks like the file
introducing itself.

## For the next session

- **This is a pointed data point for `0020`**: the missed sibling was a *verbatim copy* of the carrier
  that got fixed, created by the commit the correction was cleaning up after, four hours earlier in the
  same working session. If `0020` ever grows a search procedure, *"grep the corrected sentence itself,
  not the topic"* would have found this in one command on the day. Whether
  that is worth a line in `0020` itself is a judgement, and it is **not taken here** — this is a
  triage-lane change and amending a proposal is not.
- **An unrelated observation from the sweep, recorded because it confirms an existing rule rather than
  raising a new one:** one of #212's two threads was resolved by the account named `Copilot`, exactly the
  self-resolution the gate map's floor section records from [#44](https://github.com/sleepy-panda-works/portulan/pull/44).
  *Resolved* is still not *judged*; read `resolvedBy`.
- **Nothing in `.portulan/gate-map.md` was touched**, so the *any change to this gate map* trigger for the
  full lane never fired. If a later session wants the survival story in the gate map rather than in a tool's
  docblock, that is a full-lane change and a different pull request.
