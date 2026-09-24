**type:** rule
**dated:** 2026-09-24
**scope:** workspace — every pull request merged into `main`
**provenance:** `form=link` `href=../handoffs/2026-07-27-the-review-lands-before-the-merge.md`
— the maintainer's ruling, 2026-07-27: *a pull request cannot merge until Copilot's feedback has been
awaited and resolved*, taken on merges that had landed before the round on their final push.

**A merge waits for the Copilot round on the commit it merges, and for that feedback to be resolved.**
`required_conversation_resolution` carries *resolved*; the session that owns the pull request carries
*awaited*, in the ready line [`../gate-map/merge-discipline.md`](../gate-map/merge-discipline.md) fixes.
A pull request no session owns is awaited by whoever merges it.

**Why it holds:** the resolved half had been read as the whole rule. Copilot was requested on every pull
request and nothing made a merge wait for the answer, so a fast merge landed in the window between a
final push and its review, and the feedback reached a closed pull request. **A watcher that is only
*requested* is not a gate**, the third instance here of
[`a-mandate-nothing-checks-is-already-broken.md`](a-mandate-nothing-checks-is-already-broken.md); its
sibling, **an artifact a watcher produced is not the judgement it was asked for**: an error notice is no
round ([#286](https://github.com/sleepy-panda-srl/portulan/issues/286)). A review of an earlier commit
describes a different tree, so the head SHA is the rule.

**Awaited is discipline since 2026-09-23**, taken knowingly: every merge here is Gated, so the maintainer
reads the ready line against the head anyway. **If merges stop being Gated, this half needs a rail
again**, one that reads the round rather than a clock. *Resolved* is not *adjudicated*: a reviewer can
resolve its own thread ([#44](https://github.com/sleepy-panda-srl/portulan/pull/44)), so this guarantees
the round happened first, not that anyone agreed with it.

**Retire when:** Copilot review leaves this repository's review path.
