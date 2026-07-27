# Handoff — the security half, and then everything that was watching nothing

**State.** Post-milestone-3, before milestone 4; **no milestone row was touched and none should have been**.
Six pull requests merged, #24 through #29, `main` at `1f8f756`, 0 open, every branch of this session deleted.
The task was Dependabot **security** updates; it pulled in four more things that were wrong in the same way.
Nothing is left in a partial state — see Recoverability.
*Amended 2026-07-27 (audit remediation): the count above was written before its own merge — #30, the pull
request this handoff rode in, made it seven. Later the same day #32 and #33 landed as their own arc,
recorded (as a labelled reconstruction) in
[`2026-07-27-the-gate-is-the-decision-not-the-keystroke.md`](2026-07-27-the-gate-is-the-decision-not-the-keystroke.md).*

**⚠️ This session ran with no supervision at any checkpoint.** No session-open review, **no pre-commit
checkpoint before any of the seven commits**, no milestone-close (none was due). The gate map's fallback
applies and is invoked here rather than passed over: *"If supervision is unavailable in a session, that is
stated plainly and the maintainer reviews the diff."* Six pull requests were reviewed by Copilot and by the
maintainer at merge, which is **not** the fresh-context pre-commit checkpoint the protocol asks for. Two of
the three defects found in this session's own work were found by Copilot, not by me, which is the argument
against treating maintainer-at-merge as a substitute.

## What landed

| PR | What |
|---|---|
| #24 | Dependency graph, alerts, security updates **on**; gate-map rule; 0006 closed on observed API responses |
| #25 | The pin deliberately regressed to v7.0.0 to force the #22 watcher to prove itself |
| #26 | The platform floor is **three** layers, not one — audit |
| #27 | Dependabot's own bump back to v7.0.1 — the proof and the revert |
| #28 | Proposal 0007, `PROPOSED` |
| #29 | 0007 accepted → the rule installed in the gate map |

## Decisions + why

- **Forced the watcher red rather than accepting its silence** — because `actions/checkout` v7.0.1 was
  already the newest release, so "opened no pull request" and "never ran" were the *same observable*. Two
  alternatives were on the table and both were worse: probe-only (a last-checked timestamp proves the job
  ran, never that it would open anything) and document-the-boundary (honest, but leaves the mechanism
  unproven forever). Forcing red is this repository's standing bar and it had never been applied to this check.
- **Chose v7.0.0 — one patch, same `node24` runtime — over an older major.** Minimal blast radius inside the
  required check's own job, and neither the v6 credentials change nor the v5.1.0 fork-checkout caveat is
  crossed by a patch step. **The regression PR's own green run was the evidence** that v7.0.0 was safe to
  stand on before it reached `main`; the log was read to confirm the runner actually fetched `9c091bb2…`
  rather than assuming CI used the branch's workflow.
- **Did not schedule a manual revert.** Dependabot's pull request *is* the revert, so merging it was
  simultaneously the proof and the cleanup. A hand revert would have restored the pin while proving nothing,
  leaving the session exactly where it started.
- **Recorded the `enforce_admins`-versus-ruleset-bypass interaction as UNTESTED rather than inferring it.**
  GitHub documents that rulesets and classic protection aggregate to the most restrictive rule, which implies
  the bypass cannot beat `enforce_admins` — but it does **not** document that specific interaction, and the
  existing direct-push demonstration exercised classic protection, not the bypass. The only real test is an
  admin force-push, whose failure mode is `main`. The gate map therefore claims *less* than it did before:
  very probably intact, one layer unverified.
- **Did not flip the two API-reachable toggles**, though the session held an admin token that could
  (`PUT /vulnerability-alerts`, `PUT /automated-security-fixes`). Settings are Gated: the bar is
  authorization, not capability. 0006 had asserted "an agent cannot perform them", which conflates
  *prohibited* with *impossible* — corrected in #24, in a document whose own subject is two things conflated
  because they share a name.
- **The Copilot ruleset carries only `copilot_code_review`** — only that rule, so a second ruleset does not
  become a divergent copy of the floor.
- **`review_on_push` was set false and the maintainer reversed it to true the same day.** The
  original reasoning was that conversation resolution is required on `main`, so a re-review per push
  would open a merge-blocking thread on every iteration and the gate would get slower the more
  carefully you worked. That cost is real, but it was weighed against nothing: **with it false, a
  fix is never re-reviewed.** Every round after the first needs someone to remember to ask, and
  until they do the pull request reads as reviewed while the reviewed content is several commits
  stale. This was found by walking into it — three rounds of fixes on #32 sat unreviewed, and the
  missing round had to be requested by hand. The setting now favours the failure that announces
  itself (an extra thread to resolve) over the one that stays quiet (a stale review that looks
  current), which is the same preference the rest of this session kept arriving at.
- **Applied 0007 in a change separate from the one proposing it**, as 0006 was, so the record shows a
  decision taken rather than a proposal that applied itself.
- **Did not widen `a-mandate-nothing-checks-is-already-broken` while instantiating it.** Widening a rule in
  the same breath as citing it makes both harder to review. It is [`0008`](../proposals/0008-adopting-a-control-is-not-knowing-what-it-did.md) instead — which on
  close reading found something better than "state it more broadly": see that file.
- **Left `m4-enforcement-compiler` alone** — it has unmerged commits and is checked out in another worktree.
  "Delete this session's branches" was read literally for that reason.

## What this session got wrong, since that is the useful part

- **0006 shipped with an overclaim** ("an agent cannot perform them"), caught by re-reading rather than by
  any check.
- **Two claims written as if they would stay true** — "the current v7.0.1" with no date, and a check-run
  absence generalised from four commits into a standing property of the repository. **Both found by Copilot**,
  the second filed as *low confidence* and the better of the two.
- **A false claim reached `main` and sat there between two merges.** Dependabot rewrote the pin and could not
  rewrite the paragraph describing the pin, so `main` carried a deliberate-regression notice, and an
  instruction not to fix the pin by hand, above a line reading v7.0.1. **Produced by the fix working exactly
  as designed.** Generalised as *a mechanical revert is not a narrative revert*.
- **Adding the Copilot ruleset made #26 incomplete while #26 was open** — a pull request about uncounted
  rulesets, made inaccurate by adding one.
- **Every `git push` in this session was handed back to the maintainer to type by hand.** Added
  after the fact, because it was found after this handoff first merged and belongs in the session's
  own record rather than only in the fix. The gate map states that the gate is the maintainer's
  *decision* and not his keystroke — but stated it **once, in the Propose tier, attached to
  merging**, while `git push` and `Merge a pull request` both sat in the Gated tier, at the time,
  under a header reading "explicit human approval, per action, before it happens". Nothing connected
  the two, so the Gated tier was read literally, for a whole session. (`git push` on a working
  branch moved to Auto later the same day, downstream of this finding.) The original note had
  predicted exactly this — *"an agent following it literally would have to refuse a direct
  instruction from the person the rule exists to protect"* — so it was right about the hazard and
  wrong about its scope. Fixed by hoisting the principle into the Gated header, with the
  generalisation recorded because it outlives this file: **where a rule and its clarification live
  apart, only the rule gets read.**

## Open questions

- **[`0008`](../proposals/0008-adopting-a-control-is-not-knowing-what-it-did.md) is undecided — Marius's.** It argues the three cited instances are *not* three of one
  rule: only the first matches the parent as written. Read it before deciding; it corrects the citations in
  0006 and 0007 rather than just broadening a sentence.
- **The weekly schedule is unproven — nobody's yet.** What was demonstrated is that the watcher detects drift
  when a run is *forced*. Monday 07:00 firing unaided has never been observed. Now admitted in
  [`../../.github/dependabot.yml`](../../.github/dependabot.yml) per the rule this session installed. The
  observation is free: after the first Monday, check *Insights → Dependency graph → Dependabot* for a
  last-checked timestamp nobody triggered.
- **`enforce_admins` versus the ruleset bypass — Marius's**, because the only test risks `main`.
- **Organisation defaults for new repositories remain `false`** for all three Dependabot settings,
  deliberately untouched: this task was about one repository.
- Housekeeping, both Marius's: three older `claude/…` local branches are fully upstream and safe to clear,
  and the main worktree `~/Sleepy Panda Projects/portulan` sits at `589f76c`, **ten commits behind**
  `origin/main`.

**Next action.** Decide 0008. If accepted, the change is an edit to
[`../memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
plus the corrected citations in 0006 and 0007, in a separate pull request from the proposal — the sequence
0006 and 0007 both followed.

**Recoverability.** Nothing partial, checked rather than assumed. The pin is back at
`3d3c42e5…` / v7.0.1 on `main` and no regression is live. All six pull requests are merged and every branch
this session created is deleted, each verified with `git cherry origin/main` showing no `+` lines first.
`delete_branch_on_merge` is now `true`, so remote branches clean themselves up — observed on three merges,
not merely set. The three Dependabot settings and the Copilot ruleset are live repository state and survive
independently of this repository's contents; the ruleset's effect was observed firing twice, on #28 and #29.
The one thing an unlucky interruption could have left behind — a regressed pin on `main` with no bump pull
request to restore it — did not happen, and the recovery for it was always one line.
