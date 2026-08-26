# Handoff — the Thursday cadence stopped being an implementer's default

**Date:** 2026-08-25 · **M8 (Evals & telemetry), session 2, follow-up** · Implementer: Opus 5.

## What landed

**The forced-red drill calendar's cadence is the maintainer's ruling of 2026-08-25.** Thursdays,
06:00 UTC — and the value did not move. **What moved is whose it is.**

`.github/workflows/drills.yml` shipped with clause (d) saying the cadence was *"the value the clause
shipped with, not a policy an implementer settled"*, which was the honest state for one day. It is his
now, recorded the way [`librarian.yml`](../../.github/workflows/librarian.yml)'s Monday is —
*"the cadence is the maintainer's (2026-07-28)"*.

## Why an unchanged value is worth a commit

Because **"unchanged after a ruling" and "never ruled on" look identical in a diff and mean opposite
things.** The cron line reads `0 6 * * 4` before and after; only the sentence above it changed. A silent
edit would have left the repository unable to distinguish a settled cadence from a default nobody had
looked at — which is the same distinction this milestone spent three sessions defending elsewhere: a
green that states its own coverage, a count with one carrier, a watcher whose silence is not evidence.

It is also the same shape as this row's **session budget**, which sat at `1–2` against nine clauses until
he made it `1 per clause` on 2026-08-25. A budget an implementer picks for itself is not a budget, and a
cadence an implementer picks for itself is not a cadence. Both are now rules with an owner.

## The sweep, whole-file rather than per-line

**One live carrier, found by looking for the class rather than the sentence.** Every mention of a cadence
across `.portulan/`, `docs/`, `evals/`, `.github/`, `cli/`, `spec/` and `core/` was collapsed — comment
prefixes, emphasis and newlines removed — and read: eighteen mentions, seventeen of which are about a
*different* cadence (the handoff cadence, the librarian's Monday, the doctrine-promise rule) or sit in the
record layer. Only the workflow's own comment made the claim that had to move.

**The collapse mattered.** A line-scoped grep is what let the fourth carrier of *"the calendar is
unvouched"* survive one pull request earlier, because that phrase wrapped across two comment lines. The
lesson was applied here before it could cost anything rather than after.

**Two dated records deliberately left standing**: handoffs `2026-08-25-c` and `-f` say the cadence is
*his to rule*, and they were true on the date each carries. `docs/plan.md` and `.portulan/handoffs/` are
the record layer — `cli/version-carriers.mjs`'s own `isRecord()` says so — and rewriting a dated record
to match a later fact destroys the record in order to tidy it.

## State

Clause (d) is in `main` and **six of nine clauses remain**. The calendar is now **half-vouched with a
ruled cadence**: `workflow_dispatch` observed (run
[`32883413709`](https://github.com/sleepy-panda-srl/portulan/actions/runs/32883413709), 21 of 21 on
`da9c06e`), and the **schedule still answered by nothing before its first Thursday** — which is now a
Thursday he chose rather than one an implementer defaulted to. Every recipe the manifest yields is green
and the sweep is 21 of 21. Seam scan clean over every path the diff touches, the commit message and the
branch name, with a planted-term control reddening.

## One thing noticed and not mine to fix

`main` carries **two** handoffs named `2026-08-25-f` — this session's dispatch record and another
session's `the-reachability-was-retired-and-the-removal-was-not-taken`. Nothing enforces letter
uniqueness in the series, and `docs.sh`'s `record` check is green over both, because it holds the
date↔entry correspondence and not the suffix. Harmless today and a real collision hazard once two
sessions on one date both link a handoff by letter. Recorded rather than repaired: the series belongs to
whoever is reconciling it, and inventing a rail for it inside a cadence commit would be the scope creep
this repository files proposals for.
