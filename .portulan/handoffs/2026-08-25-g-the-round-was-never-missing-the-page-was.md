# Handoff — the round was never missing, the page was

**Date:** 2026-08-25 · **No milestone row moves** · Implementer: Opus 5 · Supervisor: Fable 5, fresh.

**Scope:** record one measured fact in the **agent memory store** about a Copilot round a watcher failed
to see on [#342](https://github.com/sleepy-panda-srl/portulan/pull/342). The fact as dictated was
**refuted by measurement and recorded corrected.** No file in this repository changed except this
handoff and its Session log line — which is the whole reason the record matters: with no diff, this is
the only repo-side trace that a human-supplied, dated account was re-measured and overridden.

The store edited is `~/.claude/projects/…/memory/portulan-gotchas.md`, **not** this repository's
`.portulan/memory/`. Nothing crossed between them. Final state **797/800 words**, hash re-verified at
session close per the supervisor's adjustment.

## The measurement that inverted the task

The session was asked to record that a round had arrived as inline threads with **no review object at
all**, and that the remedy was to poll `/pulls/N/comments` instead of `/pulls/N/reviews`.

**Both halves are false, and the remedy is the dangerous half.**

- **The review object existed, on the head:** `5021974869`, `copilot-pull-request-reviewer[bot]`,
  `commit_id` `ddae9fa7`, submitted 17:34:12Z. All four threads carry
  `pull_request_review_id: 5021974869`. They were never orphaned — the review trailed the first comment
  by two seconds.
- **The reporter's *observable* was real and still reproduces:** an **unpaginated** `/reviews` returns
  three Copilot entries, none on the head. The cause is **pagination**, not a missing object. #342 held
  81 reviews, **74 of them `portulan-agent[bot]`** — our own thread replies are submitted as reviews —
  so page 1, the 30 oldest, cannot reach the current round.
- **The prescribed remedy would not have worked.** `/comments` ran 88 long and its page 1 holds five
  equally stale Copilot threads. The surface was never the problem; `--paginate` is the fix, on both.

**A second fact fell out that nothing here carried:** an inline comment's `commit_id` **drifts onto a
later head**. Two of those four threads report `5da07da1`, a commit made **21m37s after** they were
written, `updated_at` unmoved; `original_commit_id` holds the sha actually judged. A *review's*
`commit_id` is stable — which is why [`copilot-review.yml`](../../.github/workflows/copilot-review.yml),
reading that field with `--paginate`, was never exposed to any of this. **No gate, workflow or tool
changed, and none needed to:** nothing in `.github/workflows/`, `.portulan/tools/` or `.portulan/verify/`
reads a comment's `commit_id`. This was an ad-hoc watcher's defect, not the repository's.

## Why the dictated fact was overridden rather than recorded

The file's header promises *every line was measured*, and `memory-stays-small` says corrections are made
by deletion, not by stacking. Recording a refuted mechanism — and a remedy measured not to work — would
have installed a false rule in the store that governs later sessions. The reporter's **observable is
preserved inside the corrected bullet**, so the experience is explained rather than erased. The
2026-08-09 ruling that *an unre-measured figure is presumed wrong* is the same principle pointed at a
number instead of a mechanism.

## The latency figure: not lost, and now superseded

The pre-commit pass charged this session with destroying the `150–390s over 9 rounds on #298–#300`
figure and reported **no carrier anywhere**. Both halves are wrong, and the second is the useful
correction: [`2026-08-25-d`](2026-08-25-d-the-consolidation-that-first-made-the-file-bigger.md) already
carries it, deliberately, as a **recorded compression** — *"named here because a compression nobody
records is indistinguishable from a loss."* That handoff's own reasoning stands: the distribution's
extremes are what the rule turns on, so its interior was judged cost rather than shape. The attribution
to this session was withdrawn on evidence; the figure died in a parallel lineage's budget squeeze no
later than 18:24 local, roughly 2.5 hours before this session's window.

**Re-measured live, because a retired figure with a live carrier is worth re-deriving once:**

| PR | commit → Copilot round |
|---|---|
| #298 | 204s, 162s, 188s, 141s |
| #299 | 265s, 422s, 227s, 325s, 147s |
| #300 | 191s, 94s |

**n=11, 94–422s.** Measured `commit.committer.date` → `submitted_at`, because REST exposes no push
time; Copilot reacts to the **push**, so **every figure above is an upper bound**. That is a different
quantity from the retired line, which is why it is recorded here and **not** restored into a memory file
whose header would have overclaimed it. The retired `150–390s over 9` does not reproduce: the range is
wider at both ends and the count is 11, not 9. The eleventh round is the one this session first missed —
`e24423f7`, committed 16:51:42Z, reviewed 16:55:06Z, body opening *"## Pull request overview"*, a
genuine round absent from #298's **current** commit list because it was rebased away. The supervisor
caught the omission; the exclusion had no reason behind it.

`2026-08-25-d`'s companion figure, Copilot's **`~626s` silent case, is confirmed unverifiable** — the
only `626` in this repository is a test-suite count, a digit coincidence. It stays retired, now with
that stated rather than implied.

## The concurrency hazard, surfaced

`2026-08-25-d` already records that the agent memory store is **not a git repository** and is **shared
mutable state with no locking**. This session priced that: **at least three lineages held divergent
drafts of the same file tonight**, and the supervisor's first verdict graded this session against a
baseline two consolidations removed from the one it actually edited — which is how a correct edit drew
a false charge of destroying a fact. Two sessions were still writing after this one's save, so the final
state was re-hashed at close before this handoff was written.

**What is not claimed:** nothing was silently lost in the interleaving. The one fact at issue was
compressed on purpose and recorded. The hazard is real but its cost so far is **wasted verification**,
not data loss — worth the maintainer's attention as a store-design question, not an incident.

## Next

Nothing outstanding. The 20-minute wait budget in `copilot-review.yml` remains roughly 3× the slowest
round measured here, so no adjustment is indicated.
