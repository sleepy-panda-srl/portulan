# Handoff — the gate is the decision, not the keystroke (a reconstruction)

**This is a reconstruction, not a contemporaneous record.** The work below wrote no handoff and no
Session log entry — that gap is an audit finding, and this file is its repair. Written 2026-07-27 by the
audit-remediation session, from the merged record only: pull requests #32 and #33, their commits, and
the amendments the arc itself left in
[`2026-07-27-dependabot-security-and-the-watchers.md`](2026-07-27-dependabot-security-and-the-watchers.md).
Where that record is silent, this file says so instead of guessing. A reconstruction can carry *what*
and *why* as the pull requests stated them; it cannot carry what a contemporaneous handoff would have —
the dead ends, the order things were noticed in, the decisions that never reached a PR body.

**State.** Post-milestone-3, before milestone 4; no milestone row touched. Two pull requests, both
rebase-merged 2026-07-27, sitting directly on the dependabot session's close (`f91633c`, #30):
**#32** (branch `the-gate-is-the-decision-not-the-keystroke`, commits `707c8e3..aa48abe`, eight in all)
and **#33** (branch `two-lessons-become-rules`, commits `b223558` and `863b87b`). The arc closed at
`863b87b`; both branches auto-deleted on merge.

## What #32 was — one principle, stated where it does not govern

The gate map said the gate is the maintainer's *decision* and not his keystroke — and said it once, in
the **Propose** tier, attached to merging. `git push` sat one tier over, in **Gated**, under a header
reading "explicit human approval, per action, before it happens." Nothing connected the two, so the
Gated tier was read literally, and every `git push` across a whole session was handed back to the
maintainer to type by hand. The original note had predicted the failure in its own words — *"an agent
following it literally would have to refuse a direct instruction from the person the rule exists to
protect"* — and was right about the hazard, wrong about its scope.

What changed, per the pull request's own account and its commits:

- **The principle was hoisted into the Gated tier header**, where it governs every action in the tier,
  instead of one action in a neighbouring tier (`707c8e3`).
- **`git push` of a working branch moved to Auto**, and the old reason it was Gated — every push
  approved, so the maintainer's name on a commit records his decision — did not survive examination: a
  commit's author is fixed when written, an unmerged branch is not the repository's record, and the
  guarantee was always at the merge, which stays Gated (`6ff746c`). Force-push is Auto only with
  `--force-with-lease`; bare `--force` fails Auto's own recoverability criterion (`aa48abe`).
- **Moving one action falsified three prose definitions of the tiers, and they were re-read and fixed**
  rather than left to drift (`7c73387`) — the tier said approval where the identity table said
  impossibility (`f863fe1`).
- **The merge's two-tier split was resolved**: Propose keeps what is genuinely Propose (an agent does
  not decide a change is ready to land); the mechanics live in the tier the action does.
- **`review_on_push` was reversed to `true` by the maintainer** after three rounds of fixes on #32
  itself sat unreviewed — the loud cost (an extra thread per push) was chosen over the quiet one (a
  stale review that looks current) (`9a53302`; recorded contemporaneously in the dependabot handoff's
  Decisions).
- **The dependabot handoff was amended, visibly, with the defect found after it merged** (`e1aac0f`) —
  the session's own record had not contained the thing the session learned last, a shape this
  repository had already seen once ("the session record did not contain the reviews that changed the
  session"), making it a recurrence rather than an incident.

The generalisation the pull request recorded because it outlives the file: **where a rule and its
clarification live apart, only the rule gets read.**

## What #33 was — two lessons leave the handoff and become rules

Closes the one item the record says was handed across sessions: two lessons from 2026-07-27 existed
only as prose — gate-map narrative, a workflow comment, the handoff — which is
`a-mandate-nothing-checks-is-already-broken` pointed at itself. Extracted as two memory rules, entered
by **handoff provenance** (established practice, checked against the proposal template's stricter
reading before being assumed):

- [`../memory/a-stated-enforcer-must-be-the-real-one.md`](../memory/a-stated-enforcer-must-be-the-real-one.md)
  — one rule, not two, because overstating and understating an enforcer are one defect with two signs;
  the agent-specific cost is that an agent told something is *impossible* does not ask permission, so an
  overclaim deletes the gate it describes.
- [`../memory/a-mechanical-revert-is-not-a-narrative-revert.md`](../memory/a-mechanical-revert-is-not-a-narrative-revert.md)
  — the day's cleanest instance: Dependabot restored the pin exactly as designed and left the paragraph
  announcing a deliberate regression above a line that no longer matched.

Each retire-when names the in-flight revision of proposal `0008` explicitly, so if that revision absorbs
them they retire by their own terms. After the merge `doctor` counted 14 memory records, 12 of them
rules (was 12 and 10). `863b87b` answered a Copilot review round: three of four taken, the fourth a
false positive.

## Supervision, as recorded

**No fresh-context pre-commit checkpoint is recorded for either pull request.** The record shows Copilot
review on both (three fix rounds on #32; one round on #33) and the maintainer merging each — which the
parent session's own handoff states is *not* the checkpoint the protocol asks for. Both PR footers name
the author as an implementer agent (Claude Opus 5), opened under the maintainer's credentials because
the agent App is deliberately refused repository-contents read (HTTP 422 — the gate map's prescribed
fallback), with conversation from `portulan-agent[bot]`. Whether #32 and #33 were one working thread or
two is not something the merged record states, and this reconstruction does not guess.

## Open questions this arc left

- Proposal `0008` remains undecided in this record's window; its revision is the named retirement
  condition of both new rules. (A revision has since been opened as pull request #35 — the milestone-4
  session's work, not this arc's.)
- The tier rewrite's effect on the enforcement compiler (milestone 4, #31 — since merged) is that
  session's to absorb: the gate map it compiles now states the decision-not-keystroke principle in the
  tier header.

## Recoverability

Both pull requests are merged and their branches deleted; nothing of the arc is un-landed. This file is
additive and carries no state of its own — deleting it recreates the audit finding it repairs, and
nothing else.
