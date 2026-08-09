# Handoff — a lead is not a cause, and the gate is not a required check

2026-08-09, third of three sessions off the board's `Now` column, on `m7-the-strand-that-has-no-state`.
[#161](https://github.com/sleepy-panda-works/portulan/issues/161) as **proposal `0023`**, evidence-only,
by the maintainer's ruling this session — no controlled experiment, no throwaway pull requests.

## What this is and what it deliberately is not

It is the record assembled in one place, plus a fourth exit the issue does not list. **It recommends
nothing**, which is the position rather than an evasion: both halves of the question — the platform floor
and the review doctrine — are the maintainer's, and a proposal that voted would be a second author.

The one thing it does assert is a fact about the argument rather than a preference: **exit (1) is the one
whose stated premise the refutation damaged.** It was argued on *no round can ever arrive for such a
head*; if the trigger is authorship, the round is not unreachable, it is unreachable for **this filing
mechanism** — which is exit (4), and exit (4) did not exist while diff-similarity was the hypothesis.

## The two things measured rather than carried forward

**The floor, as of two point measurements rather than a span** — 2026-08-03 in the issue and 2026-08-09
here, **six days apart**, with nothing sampled between. The check itself is **twelve days old**:
`.github/workflows/copilot-review.yml` was added 2026-07-28 at `d35a1f1`, measured rather than estimated.
The two figures are different things, and an earlier draft gave only the second beside the first two
dates, where it read as the gap. Read live from
`branches/main/protection`: required contexts are **`workspace-verify` and
`pr-labeled`, and nothing else** — `copilot-reviewed` is **not** required. `strict: true`,
`enforce_admins: true`, conversation resolution required, **0** approving reviews. That is why #157 could
sit at `UNSTABLE` and merge anyway: **the Copilot gate is doctrine here, not platform.** The gate map
says this class of fact is read by hand at the checkpoints because no file can pin it; this is that
reading, dated.

**The override.** #157 merged **2026-08-03T16:05:55Z**, author `app/portulan-agent`, past a red
`copilot-reviewed`. Confirmed against the API. So the strand has already been paid for once, in a
doctrine exception rather than a fix — a datum the ruling needs and which no summary of the issue
carried.

**And `0015` is ACCEPTED** (Marius, 2026-07-28), which is what makes exit (4) an amendment to a settled
decision rather than an implementation detail. Checked in the proposal file, not recalled.

## What stays open, and why the honest answer is "lead"

The cause. #157 **did** draw a round on its original head, so a blanket *Copilot does not review
App-authored pull requests* does not fit; the shape that fits is `synchronize` specifically, with
`opened` unaffected. **One uncontrolled variable across two pull requests is not a mechanism.** Two
things stay unexplained beyond that: why the explicit re-request is *accepted* and then yields nothing,
and why that differs from [#86](https://github.com/sleepy-panda-works/portulan/pull/86), where a
re-request produced a round in about ninety seconds.

The experiment that would settle it is named in the proposal — a controlled App/user pair, each drawing a
round on `opened`, each then given a `synchronize` — so the next session does not re-derive its design.
It costs two real pull requests, which is why it was not run here.

## The recurring cost, if the lead holds

`librarian.yml` files as the App **by design** — a `GITHUB_TOKEN`-opened pull request starts no runs, so
the required checks would never report — and the pass has no update path. So **every scheduled pass not
merged before `main` moves** needs a rebase, which is the operation that appears to suppress the round.
Weekly, structurally, and not limited to the librarian.

## Next

The ruling. Whatever is taken lands in a rail — `copilot-review.yml`, the required-context list, or
`librarian.yml`'s filing identity — which is why it is a proposal rather than a note. #161 stays open
until then.
