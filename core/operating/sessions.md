# Sessions

> Core doctrine — on-read. Every fresh context pays for the host's own system prompt and tools, and for
> the always tier, at the cache's write price, unless an earlier session left that prefix in the cache.
> On Claude Code that prefix comes before any workspace file, and cache writes were most of what a task
> cost on this repository ([`../../evals/ab/warm.md`](../../evals/ab/warm.md) has the figures). So a task
> runs in as few fresh contexts as it can, each starts warm where it can, the cache lifetime fits the gap
> between uses, and a host switch that changes the prefix is earned by an A/B run.
> [`context.md`](context.md) governs what the host loads; this page governs how sessions start and end
> around it. _(Proposal [`0038`](../../.portulan/proposals/0038-what-a-change-spends-is-measured.md), rules
> 2 to 4, and row 12 of [`../../docs/plan.md`](../../docs/plan.md), whose compile targets carry the cache
> lifetime.)_

## A session starts warm, or it pays the prefix again

**A fresh session starts warm when an earlier one left the same prefix in the cache**: the same host
version, tools, model and effort, the same instruction files and rules, the same working directory, and
nothing that varies per session ahead of the task, within the cache lifetime. A warm start reads the
prefix at the read price; a cold one writes it again. Sessions running side by side in one checkout
already share it. Sessions that follow one another share it only while nothing between them changed it,
and on a local checkout the host's startup git snapshot changes with every commit.

What moves the break earlier is anything per session in front of the task: a git snapshot, a date, a
working directory made fresh for each run, a hook's per-session output, a session's own id. Rule 3 of
`0038` keeps these out of Portulan's own always tier and hook text. A hosted session whose system prompt
names the session itself starts cold whatever a workspace compiles; that is inferred from such a prompt,
not documented.

## Fewer fresh contexts per task

- **Continue until the restart threshold, then restart.** `0038`'s threshold is computed from the multipliers,
  the fresh context and a horizon, which a workspace declares in `spend` (Workspace Definition 2.12) and which
  are the general ones where it does not, and [`../../cli/advisory.mjs`](../../cli/advisory.mjs) says it once.
  A restart that finds its prefix still cached costs less than the threshold assumes.
- **Resume a finished worker within its cache lifetime** rather than start a new one: its context is
  read again rather than written again.
- **A subagent is a fresh context**, on a five-minute cache unless set. Fan out when the reads it keeps
  out of the parent cost more than the prefix it writes ([`loop.md`](loop.md)'s firewall), not for one
  read.
- A checkpoint, persona or ritual states what it loads ([`context.md`](context.md)), and the host's
  prefix is part of that price.

## The cache lifetime fits the gap

**Five minutes where the next use of the prefix comes within five minutes**: bursts, and headless runs that
follow one another. **An hour where sessions idle or the next one starts later.** A five-minute write costs
1.25 times an uncached input token and an hour's 2, and every read renews either; a gap past the lifetime
writes the whole context again. On this repository's own tasks, run straight through, five-minute writes cut a
boot's cost by 22 to 30% and an edit's by about 18% against an hour's
([`../../evals/ab/warm.md`](../../evals/ab/warm.md), row 2 and the measurement beside it); in a long session,
one pause past five minutes, while a person reads or a review or CI runs, can cost more than every write the
shorter lifetime saved. A subagent's lifetime is set apart from the session's.

## A switch that changes the prefix is earned

Claude Code has three switches that change what a session writes: the git instructions (the startup
snapshot together with the commit and pull-request instructions), the cache lifetime, and, for a run
started headless, moving the per-machine sections (working directory, platform, memory paths, the
snapshot) out of the system prompt and into the first message, so runs in different directories or on
different machines share the system prompt. **Each stays off until an A/B run shows it cuts spend with no
loss**, which is `0038` rule 4's gate applied to sessions, and **a session that needs what a switch
removes keeps it**:

- **The git instructions are dropped only for sessions that neither commit nor open a pull request**, or
  where the workspace's own guidance carries its commit and pull-request workflow. A session that needs
  them is started with `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=0`, which outranks the compiled setting, and
  a runner sets that per run.
- **The per-machine sections are moved, never dropped**: the exclusion puts them in the first message. It
  applies to headless runs only, because only whatever starts a session can ask for it.
- **The cache lifetime removes nothing.** It trades the write price against the gap.

## What a workspace declares

**`sessions` in the manifest**, since Workspace Definition 2.11
([`../../spec/slots.md`](../../spec/slots.md)): `git_instructions` and `cache_lifetime` compile into the
host's project settings and reach every session in the repository; `headless` is what Portulan's own runners
apply to the sessions they start. Nothing is defaulted: an undeclared switch is the host's own default. This
repository declares one switch, five-minute writes for its headless runs, which row 2 of
[`../../evals/ab/warm.md`](../../evals/ab/warm.md) earned. Its interactive sessions keep the host's default,
because they commit and idle on reviews and CI; the git instructions wait on that page's row 3, and the
per-machine sections on its row 4.

## What is machinery today, and what is not

`compile` emits the two interactive keys and says so on every run, and writes `spend`'s figures onto the
restart advisory's commands; `doctor` checks the shape and version of `sessions` and `spend`, and reports
every switch's state in one line; `init` offers an adopter's repository the five-minute lifetime with its
reason and its trade-off, and writes the key on a yes for `compile` to carry, and `upgrade` prints the same
offer and writes nothing. [`../../cli/warm.mjs`](../../cli/warm.mjs) runs fresh headless sessions in sequence
and prices each from the host's own usage records, warm against cold, and
[`../../evals/ab/warm.md`](../../evals/ab/warm.md) is its specification and its record. **Still to land**: the
interactive A/B, which needs real local sessions and so runs on a maintainer's device; a report of how often
sessions start warm, from the ledger's first request per context; an offer of the other switches, once their
rows have run; and carrying the key through `vendor`. Until each lands, the rule it would enforce is held by
the human gate.

_(Provenance: the maintainer's five-run measurement of 2026-09-24, whose figures the record in
[`../../evals/ab/warm.md`](../../evals/ab/warm.md) carries as its before, and the cache test of the same day,
which ran its rows 1 and 2; the techniques survey before it, from Claude Code's documentation on prompt
caching, settings and the CLI; and each switch read in Claude Code 2.1.281's program text on 2026-09-24.)_
