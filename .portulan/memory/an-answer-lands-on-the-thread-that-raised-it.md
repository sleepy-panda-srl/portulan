# An answer lands on the thread that raised it

**type:** rule
**dated:** 2026-10-30
**scope:** workspace — every pull request against this repository
**provenance:** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/blob/8a33f9b/.portulan/handoffs/2026-07-29-a-reply-belongs-where-the-comment-is.md`
— raised by the maintainer after reading a review round on #106, 2026-07-29, as commit `4171f4b`
records: nothing said a thread is answered on the thread.

**A review thread is answered as a reply on that thread**, whoever opened it —
`POST /repos/{o}/{r}/pulls/{n}/comments/{comment_id}/replies`, never a general pull-request comment. A
finding with no thread, such as one in a review's body, is answered in one pull-request comment, because
the platform gives it nowhere better.

**Why it holds:** the thread is the unit the platform resolves and the unit a reader opens.
`required_conversation_resolution` keeps the merge closed while one is open, and a reply never opens it:
resolving does, with the merge approval ([gate map](../gate-map.md#which-identity-acts)). A misplaced
answer costs the reader a hunt, and whoever resolves finds nothing on the thread to judge.

_Amended in place 2026-10-30, when Copilot review left the review path by the maintainer's decision: the
record also governed Copilot's suppressed notes, promoted to threads until 2026-09-23 under proposal
[`0021`](../proposals/0021-the-suppressed-channel-needs-a-state.md), and now keeps only what no reviewer
changes. Before: `git show 7d72356:.portulan/memory/an-answer-lands-on-the-thread-that-raised-it.md`._

**Retire when:** `main` stops requiring conversation resolution.
