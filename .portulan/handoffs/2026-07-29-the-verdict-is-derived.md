# Handoff — the verdict is derived, and the field that cannot take the name

**Date:** 2026-07-29 · **post-M5, no milestone row touched** · Branch
`copilot-verdict-and-pr-ownership` · [#95](https://github.com/sleepy-panda-works/portulan/pull/95)

**State.** The maintainer asked for two things in one sentence: Copilot approving / approving with
suggestions, and `portulan-agent` owning pull requests as the assignee. Both are platform-refused as
stated, and the session's work was the honest remainder: the first half is answered by derivation, the
second half is refuted with a measurement and put back to him as a decision. Suite 635, eight recipes
green. No proposal filed — no setting moved; the one settings option this creates is priced in the
gate map and arrives, if ever, as its own proposal.

## Both halves of the request were platform-refused before anything was built

Copilot submits every review round as `COMMENTED` — never approve, never request-changes — by GitHub's
deliberate design, re-checked against its documentation the day of this session rather than assumed
from memory. And the assignee field takes user accounts only: `portulan-agent[bot]` and `Copilot` both
404 on `…/assignees/{login}`, and the assignee list on this repository has exactly one entry. Neither
refusal is a setting this repository controls.

## What shipped for the first half: the round's outcome, displayed

`copilot-review.yml` already established, per head SHA, that the round exists and what its suppressed
notes say. A second step now computes what the round amounts to and the agent identity submits it as a
real review — the App's `pull_requests: write` covers review creation, measured against the docs. Its
own rounds exercised two branches live: the first head's round raised two inline comments and the step
printed `no verdict … raised 2 inline comment(s)` and submitted nothing, green; the second head's
round was notes-only and the step submitted a real APPROVED review quoting the note. Approve
on a clean round; approve with the notes quoted when they are the round's only content, the body
stating the approval is not their disposal; nothing over findings — threads and conversation
resolution already carry them; nothing, loudly, over a notes channel the step could not read, which
also withdraws a same-head approval. Stale approvals are swept before any verdict branch, on every run
that computes one; the head is re-read at the last moment; and the whole layer is display rather than
gate: required approving reviews stay 0, `GITHUB_TOKEN` stays refused
(`can_approve_pull_request_reviews` false at both levels, read back), and every merge stays the
maintainer's.

## What did not ship for the second half, and what stands instead

A GitHub App's bot identity cannot be an assignee, so ownership-as-assignee has exactly two routes,
both the maintainer's: a machine-user account (a second credential to create, hold, and audit), or the
status quo — authorship, which App-authored pull requests already carry, plus the declared label set.
The measurement, the read-back command, and both options are recorded in the gate map's identity
section so the 404 is a fact on file rather than a per-session rediscovery.

## The two owed repairs it once carried, superseded mid-flight

This branch first shipped both repairs the close session recorded as owed — the librarian requesting
Copilot by name after filing, and the timeout message naming the bot-author cause. While it was in
review, [#96](https://github.com/sleepy-panda-works/portulan/pull/96) shipped the same two repairs as
issues #88 and #89, and better: the re-request lives in `copilot-review.yml` itself, fired once at the
600-second point — the one place every pull request passes through, and the only timing the #86
measurement actually establishes — and the timeout message branches on the `requested_reviewers` read
and names only what the run established. The rebase across #96 therefore **dropped this branch's
duplicates**: the librarian's post-create request (an explicit request seconds after creation is
exactly the case #96 names as not established) and the printed three-hypothesis message. What this
branch adds to the merged permissions story instead: `contents: read` for the verdict step's
checkout, and the measured sentence that `pull-requests: write` still cannot approve — the toggle is
false at both levels, so the verdict rides the App by necessity as well as by design.

## Unvouched, named rather than implied (proposal 0007)

Each verdict branch names its test in the step's header comment; this pull request's own rounds
exercised two branches live, recorded in its body — findings, then approve-with-suggestions.
Unmeasured until they fire, refusals loud in both channels: the plain approve, the unread-channel
refusal, the self-approval skip (the next librarian pull request), the no-credentials skip (the first
fork), and the App dismissing its own approval. The mid-wait re-request now in this same workflow
(#88, merged via #96) had fired on no run when this shipped — the 2026-08-03 pass is its first real
test. Whether an App-submitted approval satisfies a required approving-review count is unmeasurable
short of the Gated flip and is stated as such where the option is priced.

## Fidelity

Session-open APPROVE-WITH-ADJUSTMENTS (10) — the count=1 claim cut back to what is measured, the
orphan-approval sweep, the missing checkout, and the observation procedures were its. Pre-commit
APPROVE-WITH-ADJUSTMENTS (5) — the findings integer guard, the same-head dismissal in the unread
branch, the librarian refusal's second channel, the "every run" overclaim softened, and the
future-facts purged from these records. All folded in. Copilot round one raised two threads — the
permissions comment blurred two tokens, and the checkout rode a scope the block never named — both
fixed in the round's one push. Seam scan clean across diff, commit message, and branch name.
