# Handoff — the record gets its rail, and the log mandate gets one carrier

**Date:** 2026-07-28 · **Triage lane, between milestones (4 closed, 5 in flight elsewhere)** · Branch
`the-record-gets-its-rail`

Four corrections from the 2026-07-28 two-day review — R1, R2, R7, R8. Scope was exactly those four;
R3 and the milestone-row amendments belong to another session and are untouched here.

## What the session was actually about

One defect wearing four costumes: **a fact with two carriers drifts at the weaker one.** The log mandate
had two carriers and was obeyed at the narrower (R2). The CLI's tool list had five and was stale in two
of them (R7). The log had a stated shape nothing enforced, so entries grew to 105 lines (R8). And the
correspondence between log and handoffs was checked in one direction only, so five sessions' records
went missing without anything going red (R1).

## The finding worth carrying: a rail can be green over its own founding incident

The reverse correspondence direction was drafted as **presence** — every handoff date has at least one
Session log entry of that date. It is the obvious mirror of the existing check, and it is **green on the
exact record it was minted from**: each of the five unlogged sessions shared its date with a sibling
that *had* been logged, so the check the review's own finding demanded would have passed the review's
own finding.

Caught at the **session-open supervisor checkpoint**, which proposed counting instead: a date carries at
least as many entries as handoffs. Same `grep`, no new dependency, and it exits 1 on `origin/main`'s
record naming `2026-07-27 — 14 handoff(s), 13 entr(ies)` and `2026-07-28 — 5, 2`. Red-first here is the
real record rather than a fixture, which is the strongest form of the demonstration this repository asks
for and the first time a `record` check has had it.

Generalisable, and not yet written as a memory rule because one instance is thin: **when a rail is minted
from a specific incident, run it against the tree as that incident left it before believing the design.**
Presence and counting are indistinguishable on a healthy tree and differ entirely on a sick one.

## The second false green, found by the observation procedure

The first implementation read handoff dates out of `git ls-files` output — the git **index** plus
untracked files, not the tree. Emptying `.portulan/handoffs/` therefore left four dates standing and
printed `ok … (4 date(s))` over a directory with nothing in it. The `[ -f ]` test the older direction
had always carried was exactly what the rewrite dropped. Found by the check's own observation procedure,
one step after it was written — the 0007 rule paying for itself on its own machinery.

The stray-file audit that ships with it is the same lesson pointed forward: both directions enumerate by
a dated filename, so a handoff named anything else is not failed, it is **uncounted**. Anything in that
directory without a date now fails by name. The set is empty today.

## The cutoff, and why it binds nothing on arrival

The 10-line budget binds entries dated **after 2026-07-28**. Thirty of the entries below it already
exceed it, two of them dated that same day and already merged. The alternatives were truncating merged
record to satisfy a rule written after it, or an exemption list — and the handoff cadence's own ruling
already refused the list ("a cutoff rather than a list"). So the budget binds nothing at the moment it
is introduced, which is what forward-only means; the recipe prints the count it examined on every run so
a green never implies more than it saw. The six entries this change adds are within budget anyway, and
that is a **measurement** — run with the cutoff lowered so it binds 36 entries, the counter reds 30 and
none of them is one of the six.

## Checkpoint order, recorded rather than smoothed

**The implementation ran ahead of the session-open verdict.** The supervisor was spawned first, with the
full plan, but it was still working when drafting began, and the session did not wait. Nothing outward
happened and no gate was crossed — but the checkpoint exists to shape a design while changing it is
still cheap, and here it *did*: the weak presence-direction reached code, with its weakness documented
rather than removed, and was replaced only once the verdict arrived. The cost was rework; it could as
easily have been a shipped decoration. The next session in this lane should block on the verdict.

Both checkpoints were fresh-context Fable 5. Session-open: **APPROVE-WITH-ADJUSTMENTS**, eleven required,
all folded in — the counting direction, the stray-file audit, the seam attestation added to the pointer
format, the "31 of 33" denominator removed from both its carriers, the cutoff untied from merge-day
phrasing, dod's restated budget number dropped, `identity.md`'s CLI row swept as R7's fifth carrier, and
the budget demonstrated with the shipped counter rather than by hand.

## Limits, stated

- Correspondence is by **date**, not session, in both directions. Counting narrows the blind spot rather
  than closing it: an extra entry on a date offsets a missing one, and a session spanning midnight reds
  honestly but wrongly. The per-session version is now a grep away rather than a convention change away,
  because R8 requires an entry to link its handoff — but it is not written.
- The budget counts **lines**, not substance. Ten lines of pointer and ten of padding score the same.
- The reconstructions are reconstructions. Each says so, each cites the handoff and pull request it was
  built from, and the supervisor-fidelity line of each was read out of the handoff rather than assumed —
  only #59/#60's records a checkpoint, and the other four say plainly that none is recorded.

## The review round, under the bound

One Copilot round on [#73](https://github.com/sleepy-panda-works/portulan/pull/73), one thread, **no
suppressed-notes block at all** — checked for its absence rather than inferred from an empty list, since
that block is the channel with no Resolve control and no effect on any gate.

The finding was **right about a tension and wrong about the fix**, and the useful half was mine. It said
`plan.md`'s `cli/` line should list `plugin-lint` alongside the others. That line is the *planned
milestone-7 surface* — `init · doctor · compile · vendor · index · upgrade` — and `plugin-lint` is
deliberately not on it: `cli/README.md` says so in as many words ("plus one tool that is not on that list
at all"), and the milestone-7 row ships the same six. Adding it would have made the layout map agree with
one reviewer and disagree with two carriers.

**But R7's own fix had inherited the defect it was sent to remove.** The original line read *"today:
doctor + plugin-lint, standalone; the CLI absorbs them at M7"* — two faults, not one: it omitted
`compile`, and it swept `plugin-lint` into an absorption the milestone-7 row does not promise. This
session fixed the omission and carried the wrong claim forward, into `identity.md` as well, where the
sweep for the fifth carrier reproduced it. Both now separate the two facts: `doctor` and `compile` are
absorbed; `plugin-lint` is on no milestone-7 list. Answered on the thread with that reasoning rather
than a bare refusal — a comment that identifies a real inconsistency deserves the correction it led to,
even when its proposed remedy would have made the record worse.

Fix-round **one** of the two the bound allows; this handoff and the Session log entry ride the same
push rather than spawning a round of their own, per rule 2.

## A third false green — or rather, the first false RED

Writing this session's own Session log entry turned the recipe red on the seam attestation the entry
plainly carries. The check joins an entry's lines with `tr '\n' ' '`, which leaves the continuation
indent standing, so an attestation wrapping between *seam* and *scan* arrives as `seam   scan` and
matched nothing. Fixed with `[[:space:]]+`, with the negative control asserted: an entry carrying no
attestation is still red.

Worth keeping for two reasons. It is a **false red**, which this repository has held since milestone 2
to be the worse failure — the one that gets a whole recipe switched off — and it was sitting inside the
recipe that says so. And it had been latent since the check landed on 2026-07-27: every entry until now
passed on the accident of wrapping somewhere else. Nothing found it by reading; it took a sentence that
happened to break in the wrong place. That is the third defect this session found in checks by using
them rather than by inspecting them, after the index-versus-tree false green and the presence-versus-
counting weakness.

## State

Seven recipes green, each exit code read; suite **442**; seam scan clean across files, commit message
and branch name. `.claude/settings.json` untouched, so `compile.sh` is green with no artifact change.
CI re-ran the recipe on `ubuntu-latest` and printed byte-identical `record` lines to the local runs,
which is the first time this check has been measured on a second platform.

**Collision to expect:** [#72](https://github.com/sleepy-panda-works/portulan/pull/72)
(`m5-the-index-is-the-rail`) opened while this was in flight and touches `docs/plan.md`,
`.portulan/dod.md` and `.portulan/verify/README.md` — three of this change's five files. Whichever lands
second rebases, and `main` refuses a merge from behind it. The Session log is the likely textual
conflict, and both changes append to it.

**The merge is the maintainer's.** This session opened the pull request and stops there.
