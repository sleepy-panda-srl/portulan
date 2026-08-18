# Handoff — the override becomes the procedure, and the experiment arrives for free

2026-08-09, fourth session of the day. [#161](https://github.com/sleepy-panda-srl/portulan/issues/161)
ruled: proposal `0023` was merged as evidence-only this morning, and the maintainer asked for the issue
to be addressed. The ruling was **delegated to a Fable 5 supervisor**, as `0022`'s was.

## The ruling

**Exit (2) taken. (1) and (3) declined. (4) staged behind a measurement, not taken.**

The check stays red, and merging past it is the maintainer's explicit **per-occurrence** act, recorded on
the pull request *before* the merge. That is what already happened once on #157; this promotes it from
doctrine exception to stated procedure. The sentence the ruling turns on: **a gate that opens itself on
an unexplained absence is not a gate.**

Why not (1): its stated premise — *no round can ever arrive for such a head* — is the one the refutation
damaged, and weakening the gate for every pull request to fix one class gives up a measured channel on a
premise now in doubt. Why not (3): making `copilot-reviewed` required would turn a **known** strand class
from one recorded override into an unmergeable pull request, at 06:00 on a Monday with nobody at a
keyboard. It stays the end state, once the strand class is closed, as its own Gated proposal.

## What the supervisor measured that nobody had

**The scheduled librarian has run exactly twice, ever** — one `workflow_dispatch` on 2026-07-29 and one
scheduled pass on 2026-08-03. **That one scheduled pass is #157, and it stranded.** The structural cost
is not a projection: it is one for one. The next pass files **2026-08-10, 06:00 UTC**.

**Today's three merges are a control arm nobody had planned.** #183, #185 and #186 drew **sixteen**
Copilot rounds between them, **thirteen on `synchronize` heads**, including rebase force-pushes made
minutes before merge under `strict: true` — the closest possible conditions to #157's, with the same push
credentials. Against **0-for-2** on App-authored `synchronize`. Every author-neutral explanation now owes an account of
**19** counterexamples across two days — today's 13 plus #160's six post-open rounds. (An earlier draft
said ~17, taken from #161's five-round table for #160; that table went stale eight seconds after posting.
Derived from a record rather than the source, in a record whose whole subject is measurement.)

**And #86 stops being the anomaly it looked like.** Its answered re-request was on an *opened* head — the
librarian has no update path, so no `synchronize` existed. Under the narrow shape, *App + opened* reads
slow-but-answerable and *App + synchronize* unanswered so far. Consistent with the lead. Still n=1 on the
treatment arm, and the mechanism — an accepted re-request that yields nothing — is still unexplained.
**Lead, not cause**, and the ruling says so.

## The experiment, and why it costs nothing

It is **opportunistic**, which is what lets it honour this morning's evidence-only ruling: no throwaway
pull requests, ever. Instrument tomorrow's scheduled pass **if ordinary work moves `main`** before it
merges — the rebase `strict: true` then demands is the treatment observation — and take a user-authored
`synchronize` the same hour as control. The observation needs no new instrument: `copilot-review.yml`
already prints three of the four facts per head, and the fourth — whether the ruleset fired — is read
from the pull request's timeline, which is how #161 established it for #157. The workflow disclaims that
fact in its own words, so claiming it printed four would have been a claim about a mechanism that the
mechanism refuses. The prediction is registered in the proposal **before** the run,
which is what makes it an experiment rather than a story told afterwards.

Stop rule: three consecutive condition-less Mondays and the design returns to #161 unrun.

## The boundary, which is the part to read before acting

The supervisor split its own ruling. **Ungated:** these four edits, and the experiment's observational
half — rebase, `--force-with-lease`, reading runs, recording in the tree. **Reserved to Marius by name:**
every override merge past a stranded check, including tomorrow's if the pass strands before this lands;
any change to the required-context list (exit 3); any change to `librarian.yml`'s filing identity,
authentication or secrets (exit 4). **A confirming experiment result is evidence for his amendment
decision, never authorization to implement it** — and exit (4) is an amendment to accepted proposal
`0015`, which this ruling does not touch.

## State

Four files: the gate map's merge-discipline section, `a-review-is-awaited-not-just-resolved.md`, three
`printf` lines in `copilot-review.yml`'s already-existing *requested, accepted and gone* branch, and
`0023`'s Status and Decision. Nine recipes green. **#161 closes with this change**; what remains is the
experiment, which is recorded rather than owed.
