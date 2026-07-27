# Handoff — the audit remediation: four categories, four pull requests

**State.** Post-milestone-3, before milestone 4; no milestone row touched and none was due. A
fresh-context audit taken at `aa48abe` found four categories of defects in the repository's own claims
about itself; the maintainer commissioned one session to fix them, one pull request per category, all
branched from `863b87b` independently — none stacked, any merge order works. Three were opened as **#34**
(contradictions), **#36** (precision), **#37** (stale claims); the fourth, the record close, is the pull
request this handoff ships in. The maintainer merges all four; this session merged nothing. Two other
pull requests — #31 and #35, the milestone-4 session's, both merged later the same day — were not
touched; this branch was rebased onto their merge.

## What each pull request is

- **#34 — contradictions.** `v0.1.0` exists on the remote, so `README.md` and the product card stop
  speaking of the tag in future tense; `spec/slots.md` stops naming a spec 1.1 that only ever existed on
  an unmerged branch (per proposal 0005's own record) and drops a proposal count that had rotted from
  four to eight; a memory retire-when stops citing a milestone-2 report that milestone 2 explicitly did
  not build.
- **#36 — precision, the stated-enforcer pass.** `plugin/README.md` attributed the count-of-three
  assertion to `plugin-lint`; the tool counts and reports, the *test suite* asserts, so the claim now
  names `cli/plugin-lint.test.mjs` and `tests.sh`. Three dated carriers of the same clause (two in
  `docs/plan.md`, one in the tag-and-install handoff) got visible amendments, not rewrites. `CODEOWNERS`
  left the kernel's platform-floor enumeration — the gate map says it is not yet part of the floor — and
  the pre-commit reviewer proved the audit's "one place with no disclaimer" undercounted:
  `identity.md`'s glossary row carried the same claim and was fixed in the same change.
- **#37 — stale claims.** Milestone 3 closed private; the flip is its own clearance gate. Nine living
  documents rebound from "public at milestone 3" to the clearance — six from the audit, three
  stragglers this session's own sweep and reviewer caught (`three-workspaces-not-one.md`,
  `a-public-criterion-must-be-demonstrable-from-this-repo.md`, `spec/README.md`).
  `repo-is-private-until-milestone-3.md` was renamed to `repo-is-private-until-flip-clearance.md`, its
  retire-when now keyed on the flip, living inbound links updated; the one dated reference (a doctor
  output quote in a 2026-07-25 handoff) stays as history.
- **The record close (this one).** The #32/#33 arc — a doctrine rewrite that shipped with no handoff
  and no Session log entry — got both, each **labelled a reconstruction** and sourced from the merged
  record only. The dependabot handoff's State line got a visible amendment (#30 made its six seven;
  the later arc is pointed at). The newest Session log entry got its missing seam attestation restored
  by amendment, backed by a fresh scan, not assumed. And `docs.sh` gained a `record` check so this gap
  class is watched: every Session log date since the cadence ruling (2026-07-25) must have a dated
  handoff, and the newest entry must carry a seam attestation — **red first** on the real gap
  (`docs/plan.md:714`, the missing attestation), green only after the record was repaired.

## Decisions + why

- **Both halves of the either/or.** The brief offered a reconstruction handoff *or* a State-line
  amendment. The tree needed both: the arc's *why* is session-sized and cannot live in one amended
  line of another session's record, and the State line was still self-stale (written before its own
  merge). Chosen over inventing a middle form.
- **Reconstructions say so, loudly.** Both the handoff and the Session log entry for the #32/#33 arc
  open by declaring what they are and what they cannot contain. A reconstruction that reads as
  contemporaneous would be a worse record than the gap it fills. This coexists with
  [`every-session-ends-with-a-handoff.md`](../memory/every-session-ends-with-a-handoff.md) — the rule
  that refuses retroactive handoffs, cited by #30 the same day to refuse backfilling the milestone-3
  close — rather than contradicting it. What that rule forbids is fabricating a contemporaneous
  artifact; a reconstruction labelled as one fabricates nothing. And the arc, unlike the pre-cutoff
  sessions the rule grandfathers, sat *inside* the rule's window and also had no Session log entry, so
  the rule's own fallback carrier — "the pull-request descriptions and the Session log" — was half
  missing. The arc broke the rule; this is the repair of a violation, not an exemption from the
  boundary. The milestone-3 close still gets no handoff, exactly per that rule: its Session log entry
  and milestone row exist, and its unwritten why is what no later writer may invent.
- **The `record` check corresponds by date, not by session.** Two sessions closing on one day are
  satisfied by one handoff — stated as a limit in `verify/README.md` with the live instance named (the
  milestone-3-close session of 2026-07-27 has a log entry and no handoff of its own, and the check
  cannot see that). The honest cheap check beat the dishonest thorough one nobody would write today.
- **Findings already fixed on `main` were to be dropped, and none were** — all re-verified present at
  `863b87b` before any edit.

## What this session got wrong, since that is the useful part

- The stale-claims sweep missed `spec/README.md`'s "across the milestone-3 flip" — my grep patterns
  covered "milestone-3 public" but not "milestone-3 flip". The fresh-context reviewer caught it;
  pattern lists are their own false-green shape.
- The audit phrase "the kernel is the one place with no disclaimer" was repeated into a review brief
  as fact and came back falsified — `identity.md:100` was a second place. Even an auditor's count is a
  claim to re-verify, which is this repository's own rule pointed at the audit.

## Open questions — the maintainer's

- **`docs/vision.md:20`** ("before the milestone-3 public flip") — human-owned; reword or keep, yours.
- **`docs/plan.md:19` and `:34`** — locked decision 2 and the topology diagram carry the same stale
  binding; one amendment can sweep both.
- The audit's list of mandates nothing checks (session-end gate and kin) stays milestone 4's —
  the record is closed here, the enforcement is not.

## Recoverability

Four branches — three based on `863b87b`, this one rebased onto the milestone-4 merge after #31 and #35
landed — each independently mergeable and independently revertable; nothing merged by this session, no
state outside the branches except three worktrees already removed (the fourth goes when this pull
request opens). The `record` check is additive at the end of `docs.sh` and came through the milestone-4
rebase unchanged. Seam scan clean across files, commit
messages, and branch names, per pull request — and re-verified against the two 2026-07-27 arcs while
writing their attestations.
