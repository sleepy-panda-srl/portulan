# The warm-start A/B

What a fresh session costs when an earlier one left its prefix in the prompt cache, against the same
session priced cold, and which host switch earns its place in `sessions`
([`../../core/operating/sessions.md`](../../core/operating/sessions.md)). The runner is
[`../../cli/warm.mjs`](../../cli/warm.mjs); this page is what a run of it must be and what the runs found.
It is not the Portulan on/off A/B of [`arm.md`](arm.md): that one grades behaviour, and this one prices
sessions.

## What a run is

A **sequence** is `n` fresh headless sessions started one after another, each when the one before it
ended, with one prompt and one invocation, in one clone of the tree's committed HEAD. The first finds
nothing of its own cached; each later one finds what the one before it left. Every sequence reports
**three lines, A first**, the maintainer's measurement rule of 2026-09-24, from the host's own usage records:

- **A, Portulan's share**: the tokens that carried what Portulan installs or manages (its boot set, rules
  and skill files, the workspace's `.portulan/` context, records and memory), counted once for every
  request that sent them, by the split of the maintainer's five-run measurement of 2026-09-24. A tool's result and the skill text the host injects
  are matched line by line against the run's own clone, whose tracked files are Portulan's unless they are
  code, since the clone is the plugin itself; each takes its share by bytes of the context's growth at the
  request it entered. The plugin's descriptions, loaded before the first request, are estimated from their
  bytes. A hook's output, the host's reminders and the model's own output are not A.
- **B, the whole task**: every token the host recorded, cache reads included.
- **C, the cost**, as an index with the before at 100: uncached input 1, a write at 2 for an hour's
  lifetime and 1.25 for five minutes, a read at the model's read multiplier and output at its rate, which
  `report` takes as `--read` and `--output`, the general 0.1 and 5 otherwise. A run is priced **billed**,
  as the host recorded it, and **cold**, with the first request's reads priced as writes, the convention of
  that measurement. A sequence's **warm** figure is the mean billed total
  of its runs after the first, its **cold** figure the mean cold total of all of them, and its C is warm
  against cold at 100.

The tasks live in the runner, so there is one source for each prompt. `boot` is that set's boot task
word for word, so a figure here stands beside its figures. `probe` is one request with no tool, which
measures the prefix alone. An answer counts only when it says what the task expects and does not negate it,
and the probe's only when it is the one word; that reads words, not meaning, and guards against an arm that
is cheaper because it answers worse. A run leaves its clone as it found it (the boot task says to change no
file, and the probe's one reply needs none), so a run that changed its clone, a file or a commit, has not
answered, and the clone goes back to where the run started before the next one. A commit between runs needs
one checkout and `--local`, since it moves only a local session's startup snapshot; the runner refuses it
otherwise. The clone has no remote, and what the runner put in it (the tree's commit, and its own empty
commit between runs, which carries the seam line the docs recipe reads) is marked as already recorded, so
the stop gate asks no run for a handoff.

## One sequence per question

| Question | Control | Treatment | Where it can run |
|---|---|---|---|
| Does a warm start cut the boot task, and by how much? | the first run of a sequence | its later runs | anywhere |
| Five-minute writes against an hour's | `--cache-lifetime 1h` | `--cache-lifetime 5m` | anywhere |
| The git instructions, when a commit lands between sessions | `--between commit --local` | the same, `--git-instructions off` | where a session takes the startup snapshot: a local checkout |
| The per-machine sections, for runs in different directories | `--copies each` | the same, `--exclude-dynamic-sections` | anywhere |

**A switch passes** when every run of both sequences was measured, its transcript recording at least one
request of its own, every treatment run answered as its task expects, no run of either changed a file, and the
treatment's cost is under its control's 100. A
sequence's cost is the mean of its runs as billed, with the first priced cold, since what the cache held before
a sequence began is neither arm's. The two sequences must differ in their arm and in nothing else the runner
records: the commit they start from, the task, the run count, the checkouts, what lands between runs, where they
ran, the model asked for and the models the host recorded, and the host's version. `node cli/warm.mjs report
<control> <treatment>` prints the three lines and PASS and exits 0, or FAIL and exits 1. A switch that passes becomes a default of
Portulan's own headless runs in `.portulan/workspace.json`, and a default an adopter receives only through
a later change that says so. **The interactive switches are measured on a maintainer's device**, from real
sessions, because a hosted session never takes the snapshot and a headless run is not how people work.

## What may not be concluded

Two or three runs per sequence record a figure, not a rate: no interval, no significance. A cut measured on
the boot task says nothing about an edit task, whose sessions write more than they read. A switch changes
the host's prefix, not what Portulan loads, so A is the same in both arms of every row here, and B moves
only where a switch removes text. The general multipliers price reads at a tenth; on a model whose reads
cost less, a warm start cuts more than those figures say, which `--read` shows. And a warm start is only as common as sessions that follow one another within the cache
lifetime, which is the ledger's to count, not this page's.

## The record

**Not yet run.** The sequences wait on the maintainer's word, since each starts real sessions. When they
run, each row gets its sequence's three lines, the figures behind C (first, warm, cold, runs started warm)
and the switch's verdict, with the host version and the date.

**Before**, from the A/B/C scoring of the maintainer's five-run measurement of 2026-09-24, the boot task on
main at `b91055b`, a mean of five runs: **A 175k tokens**, B 371k tokens, and C 111 at one-hour writes and
82 at five-minute writes, with the task before the 2026-09-23 context work at 100 (there A was 156k and B
332k). A 70% cut puts that boot task at A 47k and B 100k. Over that set the host's prefix was 12.2k tokens
by `/context`, and cache writes, every one at the hour's price, were 54% to 76% of a task's cost. Runs five
at a time in separate clones shared 9,046 tokens of the prefix at their first request and wrote the rest
of it each. The host's prompt, the model's output and the host's reminders alone came to 40% to 56% of a
task's earlier cost, more than a 70% cut allows. Re-priced with five-minute writes, assuming no pause over
five minutes, the boot, doctrine and mechanism tasks cost 28%, 25% and 20% less; that is arithmetic on
recorded requests, and the lifetime row above is the run that checks it. That scoring prices reads at the
read multiplier of the model it ran, so a sequence here stands beside it when `report` is given the same.
