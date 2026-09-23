# Merge discipline — enforcement and bounds

> The rest of the gate map's [Merge discipline](../gate-map.md#merge-discipline--the-review-is-awaited-not-just-resolved), after the
> ruling it opens with.

The two halves have different carriers, and since 2026-09-23 neither is a check of this repository's own:

| Half | What it means | What carries it |
|---|---|---|
| **Resolved** | No Copilot thread is left unaddressed | `required_conversation_resolution` on `main` — in [the floor](../gate-map.md#the-platform-floor) |
| **Awaited** | A **round** on the **current head** has landed — and a review object is not a round | The session that owns the pull request, in the line its ready message carries (below); GitHub's own Copilot run shows on the head while the round is under way |

**Copilot is asked for by CI, on every head.** The Copilot ruleset requests a round on a pull request a person
opens and on every push to it; [`copilot-request.yml`](../../.github/workflows/copilot-request.yml) does the
same on one a bot opens, which the ruleset does not, and goes red only when the maintainer's token is missing
or its request refused, when the job's own token is refused a read before the request, or when three reads
after the request all show every reviewer and none is Copilot. It judges no round: it asks for its event's
head once Copilot holds no request, and whether a round landed on that head is the session's to read. See
*Which identity acts* in [identity.md](identity.md) for why the request is his.

**No check awaits the round — amended 2026-09-23, his ruling of 17:21 UTC and his choice at 21:22 UTC.** His
words: *"Work with coordinator on this, the whole process needs to be rethought, discarded, approach
completely differently if need be - anything that's actually more streamlined, with less friction than it is
now. Today too many PRs have CI red because of the Copilot review step."* The check that awaited the round,
`copilot-reviewed`, was never a required context, so it never held a merge; what it added that day was colour.
It went red at its three-minute close on #431, before any round had been asked for, and on #432 a minute
before the round landed, and it read every round of the day as unrecognised, because Copilot's review body had
moved to a new format (`## Copilot review overview`) under its matcher. So its workflow is removed, and what
it did for this rule the owning session now does, from the review itself.

**The session reads the review in whatever form Copilot files it**, threads or body, and addresses each
finding, fixing it or answering it; unresolved threads still gate the merge. **Its ready message carries
one line, in one form.** When the session that owns a pull request tells the maintainer it is ready, the
message carries:

> Copilot: review <id> on <commit>: fixed <what>; answered <what>.

— the review's id, the commit it reviewed, what was fixed and what was answered instead of fixed, or
`Copilot: review <id> on <commit> found nothing.` The commit is the pull request's **current head**: a
push after the review draws a new round, which the session awaits before it says ready again. A body
saying Copilot *"encountered an error and was unable to review this pull request"* is not a round
([#286](https://github.com/sleepy-panda-srl/portulan/issues/286)). A draft draws none — the ruleset carries
`review_draft_pull_requests: false` — so the session marks the pull request ready and then awaits. When no
round lands on the head, the line says so and what was seen, `Copilot: no round on <commit>: <what was
seen>`, and merging without one is his call, in his words of 14:07 that day: *"This shouldn't be an error
and it shouldn't cause the CI to fail."* A pull request no session owns, such as the weekly librarian
pass, is awaited by whoever merges it, from the pull request's own page.

**The head SHA is still the whole design.** A review of an earlier commit does not satisfy the rule,
because that is the defect the ruling was about: the review existed and described a different tree from
the one merging. The line names the commit so that it can be checked against the head in one look.

**What this gives up, stated rather than left to be found.** The awaited half is now discipline, not a
rail — the class [`memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
names, taken knowingly: the rail cost a red on most of the day's pull requests and held none. Nothing
refuses a merge whose line is missing or names an older commit. What stands there is the maintainer
reading the line against the head at the merge he approves, since every merge here is Gated
([identity.md](identity.md)). *Resolved* is still not *adjudicated*: a reviewer can resolve
its own thread, as recorded in [the floor section](platform-floor.md).

**The loop is bounded by its records**, cited rather than restated:
[`memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md) bounds its length, and
[`memory/an-answer-lands-on-the-thread-that-raised-it.md`](../memory/an-answer-lands-on-the-thread-that-raised-it.md)
says where an answer lands. A rule with a second, narrower carrier is obeyed at the narrower one, which is
the class [`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md) names, so this map
carries no copy of them.

**Whether Copilot is worth it is measured on demand, not in CI**, on the coordinator session's delegated
call of 2026-09-23: over the next ten rounds on pull requests a session opens, each round's handoff notes whether its findings were real, missed by the
coordinator session's draft review, nits or wrong, and how many minutes the round took, against a bar of
at least three rounds with a real finding the draft review missed, at most one wrong finding per two real
ones, and a median round of seven minutes or less; below it, Copilot leaves the review path on his word.
[`cli/review-meter.mjs`](../../cli/review-meter.mjs) derives the submission counts from the pull requests;
the classification is the handoffs'.

**What left with the check.** `copilot-review.yml` and its fixtures: the three-minute window and the
20-minute budget before it, the round matcher and its #286 classifier, the promotion of suppressed
low-confidence notes into threads, the derived verdict the agent identity submitted and dismissed, and the
re-run re-request. Proposal [`0023`](../proposals/0023-a-head-that-never-draws-a-round-needs-an-answer.md)'s
exit (2) had been retired earlier the same day. The history is in the handoffs:
[2026-07-27](../handoffs/2026-07-27-the-review-lands-before-the-merge.md),
[2026-07-28](../handoffs/2026-07-28-awaiting-a-review-is-not-a-failure.md),
[2026-07-29](../handoffs/2026-07-29-the-verdict-is-derived.md),
[2026-08-18](../handoffs/2026-08-18-a-review-object-is-not-a-round.md),
[2026-09-23 c](../handoffs/2026-09-23-c-the-copilot-review-window-is-three-minutes.md),
[2026-09-23 g](../handoffs/2026-09-23-g-a-copilot-window-with-no-round-is-reported-not-failed.md) and
[2026-09-23 j](../handoffs/2026-09-23-j-the-session-awaits-copilot-and-no-check-does.md).
