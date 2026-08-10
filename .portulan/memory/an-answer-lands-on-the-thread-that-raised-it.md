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

**The suppressed notes are threads too — where promotion succeeds.** That qualifier is the rule, not
a caveat on it. [`copilot-review.yml`](../../.github/workflows/copilot-review.yml) promotes each note
to a comment at its `file:line`, deduplicated on path, line and a checksum, and **a promoted note is
a reason to push exactly as a thread is** — the sentence this rule previously denied. **Promotion is
best-effort** — absent App credentials, a failed dedup read, or a line the diff does not carry each
leave a note surfaced-but-ungated — so **`required_conversation_resolution` does not always cover
this channel**, and the step's `posted / already present / unattachable` line is what says which
([`a-stated-enforcer-must-be-the-real-one.md`](a-stated-enforcer-must-be-the-real-one.md)).

_Until 2026-08-07 it read "Threads block; suppressed notes do not" — sound about the notes, wrong
about the **channel**, which carried no state at all. **The maintainer ruled shape 1** of proposal
[`0021`](../proposals/0021-the-suppressed-channel-needs-a-state.md) with the price measured first:
**26 threads on one pull request** at #167's ratio, each needing his resolution._

**This rule's reversal, 2026-08-07, is argued above** — the measurement that forced it: on #167
**thirteen of twenty-six notes never surfaced**.

**Retire when:** Copilot review leaves the review path, or every finding arrives as a thread natively —
at which point promotion has nothing left to promote and `required_conversation_resolution` covers the
channel without it.
