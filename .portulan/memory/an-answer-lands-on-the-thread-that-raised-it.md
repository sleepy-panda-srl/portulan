# An answer lands on the thread that raised it

**type:** rule
**scope:** workspace — every pull request against this repository
**provenance:** `form=link` `href=../handoffs/2026-08-07-the-channel-that-carried-the-findings-and-lost-them.md`
— the maintainer's ruling of **shape 1** of proposal
[`0021`](../proposals/0021-the-suppressed-channel-needs-a-state.md), 2026-08-07, with the price measured
first. Split out of [`a-review-loop-needs-a-bound.md`](a-review-loop-needs-a-bound.md) on 2026-08-10 under
proposal `0025`, which railed the store per record and found this file holding two facts: that one
bounds the review loop's **length** (`0020`, #105), this one governs the **channel** (`0021`, #167).
They shared an envelope only because both were born in the same 2026-07-28 handoff.

**A thread blocks, and Copilot's findings become threads wherever one can be made — amended in place 2026-08-07.** An
unresolved thread is the gate (`required_conversation_resolution`), and each one is answered **as a
reply on that thread** — `POST /repos/{o}/{r}/pulls/{n}/comments/{comment_id}/replies` — never as a
general pull-request comment. **The gate stays closed until the thread is resolved** — reply
*placement* never opens it, per rule 1 of [`a-review-loop-needs-a-bound.md`](a-review-loop-needs-a-bound.md) — so what a misplaced answer costs is not the gate but the two
things that lead to it: the reader hunting for a summary somewhere else on the page, and whoever
resolves finding nothing on the thread to judge.

**The suppressed notes were threads too, where promotion succeeded — until 2026-09-23.**
[`copilot-review.yml`](https://github.com/sleepy-panda-srl/portulan/blob/74a2a315c8c2641736eea6d87be3c2fba83827a5/.github/workflows/copilot-review.yml) promoted each note to a comment at its `file:line`, deduplicated on path,
line and a checksum, and **a promoted note was a reason to push exactly as a thread is** — the
sentence this rule had denied. Promotion was best-effort, so `required_conversation_resolution` did
not always cover that channel
([`a-stated-enforcer-must-be-the-real-one.md`](a-stated-enforcer-must-be-the-real-one.md)). Promotion
left with the workflow on 2026-09-23. The session that owns the pull request now reads the review in
whatever form Copilot files it, threads or body, and addresses each finding; a thread's answer lands on
that thread, and unresolved threads still gate the merge.

_Until 2026-08-07 it read "Threads block; suppressed notes do not" — sound about the notes, wrong
about the **channel**, which carried no state at all. **The maintainer ruled shape 1** of proposal
[`0021`](../proposals/0021-the-suppressed-channel-needs-a-state.md) with the price measured first:
**26 threads on one pull request** at #167's ratio, each needing his resolution._

**This rule's reversal, 2026-08-07, is argued above** — the measurement that forced it: on #167
**thirteen of twenty-six notes never surfaced**.

**Retire when:** Copilot review leaves the review path. _Until 2026-09-23 it added "or every finding
arrives as a thread natively"; that half was about the promotion, which left with its workflow._
