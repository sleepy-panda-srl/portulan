# Handoff — the librarian goes on a cron, and a repository cannot open its own pull request

**Date:** 2026-07-28 · **Milestone 5 (Memory lifecycle & librarian), session 1 of 1–2** · Branch
`m5-the-librarian-goes-on-a-cron`

**State.** Clauses 4 and 5 of the row, in one pull request: `cli/librarian.mjs` and its suite,
`.github/workflows/librarian.yml`, spec 2.3 → 2.4, `docs.sh`'s new `proposal` check, pull-request
pointers on all fourteen existing proposals, and proposal `0015`. Suite 499 → **558**; all eight
recipes green, each exit code read. **The first real pull request has not been filed yet** — it needs
the merge plus the two repository secrets, which are the maintainer's. Two clauses the row gained this
session are session 2's: mining, and scheduled consolidation.

## The finding that changed the design, at the session-open checkpoint

**A repository cannot open a pull request its own required checks will ever run on.** GitHub starts no
workflow runs for events raised by `GITHUB_TOKEN`. `main` requires `workspace-verify` and
`pr-labeled`, both `pull_request` jobs. So the obvious build — a scheduled workflow opening a pull
request with the token it already has — produces one that is not slow to merge but *unmergeable*, with
two checks that never report rather than two that failed. Absent reads like pending, and the job that
produced it exits 0.

The plan going into this session had the `portulan-agent` App open it instead. **The supervisor
refuted that from this repository's own record**: `.portulan/tools/README.md` has said since
2026-07-26, with an HTTP 422 behind it, that the App *cannot* open a pull request — creating one needs
repository-contents read, which the installation was refused. That is a measurement, and it stands.

What did not stand is the reasoning written beside it, and the correction is worth more than the
original claim. It priced the refusal as *granting contents would give the token the ability to write
code*. It would not: `contents: read` is read. And it was written while this repository was **private**;
since 2026-07-27 it is public, so the scope grants reading what any stranger can already read.
Nobody re-read the sentence when the visibility changed — which is this project's signature defect,
a fact with two carriers drifting at the weaker one, here between a permission and a paragraph.

Marius chose to widen the App over the alternative (*Allow GitHub Actions to create and approve pull
requests*, one switch for two capabilities, the second of which is *approve*). Recorded as
[`0015`](../proposals/0015-the-librarian-files-as-the-agent.md) rather than folded into the diff, on
the `0009`/`0010`/`0011` precedent: a settings change with no proposal behind it is a floor nobody can
audit. **Generalised** as [`a-scheduled-agent-needs-its-own-identity`](../memory/a-scheduled-agent-needs-its-own-identity.md),
because the shape is not ours — any team wiring an unattended agent into a protected branch meets it,
and meets it late.

## Decisions, and why

- **A pass is a session**, so it ends with a dated handoff and one Session log entry. The maintainer's
  ruling, put to him because his 2026-07-25 cadence ruling predates the category. It is the decision
  that made the rest simple: the "report" this pass owes has an existing home, an existing shape, and
  two existing rails, instead of being a new generated artifact with a new checker. The alternative
  designs were a committed report file (generated, committed, and — as the supervisor pointed out —
  unverifiable in principle, since a threshold crossing changes it with no change to the tree) or a
  pull-request body only, which is a nag that vanishes when the pull request is closed.

- **No update path.** One pass, one dated branch, one pull request; today's already exists → the job
  says so and stops. Not laziness: an update push raises `synchronize` from `GITHUB_TOKEN`, which
  starts no runs, so updating would take a mergeable pull request and make it unmergeable. The
  strongest form of idempotence available here is *do nothing*.

- **Thresholds in the manifest, cadence in the workflow.** 90 / 180 / 30 days, the maintainer's, as
  `librarian.staleness` in spec 2.4 — additive, optional, nothing defaulted, non-positive-integers
  refused, all three the 2.2 and 2.3 rule reused rather than restated. The *cadence* is deliberately
  not declarable: how often a host runs a job is the host's scheduler, and a cron expression in a
  manifest nothing reads is configuration pretending to be policy.

- **Author date, never committer date.** This repository rebase-merges everything, which rewrites every
  committer date; a committer-dated pass would report the whole store as touched on the day of the
  last rebase.

- **The seam attestation is earned rather than asserted.** The pass cannot run the seam scan — the term
  list is outside the repository, deliberately — so the generated log entry says what is true instead:
  every line it writes is a filename, a date git recorded, a count, or a condition quoted verbatim from
  a record that passed the scan when it landed. **A diff with no new prose cannot carry a new seam
  hit.** The residual limit is stated in the code rather than left to be found: a term already leaked
  into a filename would be quoted forward, but that leak would already be in the history.

## What the forced observations found, and one of them was mine

Nothing fires on the real store — the oldest record is days old against a 90-day threshold — and
**every section says so in those words**. That is the same shape session 0 reported rather than
dressed up: a rail nobody reaches teaches nothing, and tuning the numbers until something fired would
have made the demonstration a decoration.

So the nags were forced instead, on a scratch clone: all three at 1 day → 23 records stale, 5 proposals
nagged, and the demo workspace's one sealed rule due, naming its owner and the date it was sealed. Two
runs on an unchanged store are **byte-identical** — the no-churn claim measured, not argued, and it
holds because the record carries dates rather than *N days ago*.

**The defect the forcing found was in this session's own code.** The first draft refused any record git
could not date, on the reasoning that treating an undatable record as fresh is the fail-open. The first
thing it refused was proposal `0015`, written an hour earlier and not yet committed — and refusing that
turns `tests.sh` **red on a correct tree with uncommitted work in it**, which makes a verify recipe
depend on git history. That is precisely the thing the split between this pass and the recipes exists
to prevent, built by the change that documents the split. The repair distinguishes two cases that had
been collapsed: *untracked* is **new**, not undatable — nothing in the history is older than a file's
absence from it — so it is age 0, reported as `uncommitted` rather than as a date git did not give;
*committed and undatable* is still refused. Found by running the thing, not by reading it.

**And the first repair had the same defect one state further in.** It asked whether git *tracks* the
file — and `git add` makes a file tracked while leaving it with no commit, so staging the work before
running the pass produced the identical red. The question with one answer for all three states is
whether the path is in **`HEAD`**. Found the same way, minutes later, by staging and re-running. That
is now five consecutive sessions where a defect came from using a check rather than inspecting one,
and twice in one afternoon from the same check.

## Clause 5, and why it went red first

`proposal` asserts the series' shape: a numbered filename, a recorded outcome, and the **pull request
that filed it**. All fourteen failed the third on the real tree. The pointers were then resolved
**mechanically** — the commit that added each file, then GitHub's own commit→pull-request mapping,
which resolves rebase-merged commits — rather than reconstructed from anyone's memory.

What it deliberately does not check is whether a proposal is accepted, pending or rejected. That
reading is the librarian's, where a wrong answer costs a line in a report; as a rail it would be a grep
classifying prose, and a red on a proposal whose only fault is the maintainer's phrasing is how a whole
recipe gets switched off. Two of the fourteen record their outcome under `**Status.**` rather than
`**Decision.**`, which is a real shape in a real store and not one to fail over.

## Open questions

- **The two repository secrets are the maintainer's, and they gate the demonstration.** `gh secret
  list` returns nothing today. Until `PORTULAN_BOT_APP_ID` and `PORTULAN_BOT_PRIVATE_KEY` exist *and*
  the App's `contents: read` is accepted on the installation, the workflow refuses to file — by design,
  leaving its branch pushed. Steps are in [`../tools/README.md`](../tools/README.md).
- **Can the App add a label?** Unmeasured, and the demonstration leans on it: `pr-labeled` runs at
  `opened` before any label can exist, so the re-run has to come from an App-raised `labeled` event.
  If the App cannot, the fallback is one click from the maintainer — recoverable, and the workflow says
  so rather than failing silently.
- **Is `librarian` a seventh CLI subcommand at milestone 7?** `docs/vision.md` names six and is
  human-owned, so the default taken here is the `plugin-lint` precedent: off the list, said out loud in
  `cli/README.md`. Changing that is his.

## Next action

Merge, then the demonstration: dispatch the workflow, confirm the pull request it files carries both
required contexts on its head and is mergeable, then a fresh-context milestone-close checkpoint. The
milestone does **not** close on it — mining and scheduled consolidation are session 2's.

## What the pre-commit checkpoint found

**APPROVE-WITH-ADJUSTMENTS**, seven required, all folded in. Three were claims this diff made that were
false against the live world, and the checkpoint measured rather than read them: the App's permission
set is still `metadata: read` + `pull_requests: write`, so every sentence saying the widening *had
happened* was rewritten to say it is ruled and his to apply; `#80` was already taken by another open
pull request, so proposal `0015`'s pointer was a guess and a wrong one; and the schema's `title` still
said v2.3 beside a `$id` saying 2.4 — this change introducing the two-carrier drift its own README has
a paragraph about.

**The one that would have blocked the merge: this suite was red in CI, and for its own stated reason.**
The live-workspace tests called the pass on the real tree; `verify.yml` checks out at
`actions/checkout`'s default depth of 1; the pass refuses a shallow repository. Reproduced at depth 1 —
three failures — so `tests.sh`, a verify recipe, would have failed `workspace-verify` on this pull
request and every one after it. *A check that reads history is a false-red generator in a shallow CI
checkout* is the sentence this change is built on, and the suite broke it. Split by what each assertion
needs: the sealed-count bindings read the store's files with no git at all, and the one test that needs
history asserts the pass where history exists and the **refusal** where it does not. Skipping in CI was
the alternative and is worse — a binding that stops binding where nobody is watching.

Two more were real and neither cosmetic. `spec/README.md` and `doctor` both said `slots.md` documents
the conditional requirements; `slots.md` documented three and still called `tree` "the **one** rule
here the schema does not carry" — the two new ones are now argued there. And the workflow's idempotence
check read a *branch* where it meant a *pull request*: after the credentials refusal leaves a branch
pushed on purpose, a second dispatch would have printed "nothing to do" and exited 0 over a branch
nobody can see — a green covering the exact failure the refusal exists to make loud, in the sequence
setting the secrets up actually produces.

**And the attestation was overstated by one word.** *This pass authors no prose* is false on its face —
the handoff it writes is full of sentences. The true and narrower claim is that it composes no new prose
**at run time**: every string is a literal from a reviewed, scanned file, or a value derived from the
tree. The checkpoint accepted the mechanism and rejected the compression, which is the right split.

## The rebase, and a clause that arrived while this was in flight

Rebased onto `3e01a87` on the maintainer's instruction. Two conflicts, both in the files the collision
note predicted: the milestone rows, where [#80](https://github.com/sleepy-panda-works/portulan/pull/80)
had rewritten rows 5–8 — resolved by taking its rows 6–8 whole and grafting this session's two
insertions onto **its** row 5, so nothing of #80's was lost — and the Session log tail, resolved by
date with #80's entry keeping its position and this one going last, which is the ordering #73's rebase
established.

**#80 also amended this row, and added a clause this session does not deliver.** The librarian's
reindex and staleness are now scoped to the **handoff series as well as the memory store** — a
generated, byte-compared index over `.portulan/handoffs/`, which is 3.4× the store by its own
measurement and has no index at all. `cli/librarian.mjs` reads `slots.memory` and nothing else. So the
row's undelivered set is **three** clauses, not two, and the session note says so rather than leaving
it to the diff: a row amended by one pull request while another is being written against it is exactly
how a clause ends up owned by nobody. Filed as an issue for session 2 rather than absorbed here.

**Recoverability.** Everything is on one branch. Nothing outward happened: no secrets were set, no App
permission changed, no workflow has run. The forced observations ran in a scratch clone under `/tmp`
holding no repository state, and the two scratch handoffs written during them were deleted.
