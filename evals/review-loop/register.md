# Review-loop register — portulan

> Generated from `snapshot.json` by `node cli/review-meter.mjs`. Do not edit by hand:
> it is regenerated and byte-compared, so a hand-edit survives exactly until the next run.
>
> **Every figure here is in SUBMISSION units** — every review the reviewer submits, one
> per push, including on the branch as opened. It is not the fix-round unit that
> `../../.portulan/memory/a-review-loop-needs-a-bound.md` rule 4 bounds, and no figure
> here may be read as one. See `../../cli/review-meter.mjs` for why fix-rounds are not
> derivable from the API at all.

- **Repository:** `sleepy-panda-srl/portulan`
- **Captured:** 2026-08-26T11:14:20.052Z
- **Window:** 30 most recently merged pull request(s)

## The figures

| Measure | Unit | Value |
|---|---|---|
| Pull requests | count | 30 |
| Submissions | count | 140 |
| Submissions per pull request | ratio | 4.67 |
| Submissions with no inline comment | count | 94 |
| — as a rate, an **upper bound** on the found-nothing rate | rate | 67.1% |
| Pushes the reviewer saw | floor | 140 |
| Pushes per pull request | ratio | 4.67 |
| Pushes per **submission** — the criterion's literal figure | ratio | 1.00 |
| Pushes per finding-bearing submission | ratio | 3.04 |

**Two of those rows are one row.** Every submission in this window judged its own head, so pushes and submissions coincide exactly and the last ratio is not an independent measurement: it is `1 / (1 - the no-inline rate)`. That is what `review_on_push: true` does to this pair, and it is stated here rather than left to be discovered by a reader dividing the columns.

## Against the record's own retirement threshold

`a-review-loop-needs-a-bound.md` retires when submissions per pull request measures below **2.0** for a full milestone. This window measures **4.67**, which is **at or above** it.

**A window is not a milestone.** Which pull requests belong to which milestone row is not a field the API carries, so this tool measures a window of merged pull requests and the record's *for a full milestone* clause is not evaluated here. Reading this row as the retirement condition met would be reading a different measure than the one the record states.

## Per pull request

| PR | Submissions | No inline | Finding-bearing | Pushes (floor) |
|---|---|---|---|---|
| #354 | 1 | 1 | 0 | 1 |
| #352 | 2 | 2 | 0 | 2 |
| #351 | 1 | 1 | 0 | 1 |
| #349 | 4 | 2 | 2 | 4 |
| #342 | 12 | 2 | 10 | 12 |
| #345 | 4 | 2 | 2 | 4 |
| #343 | 9 | 6 | 3 | 9 |
| #346 | 3 | 2 | 1 | 3 |
| #341 | 6 | 3 | 3 | 6 |
| #338 | 10 | 6 | 4 | 10 |
| #336 | 11 | 5 | 6 | 11 |
| #335 | 1 | 1 | 0 | 1 |
| #332 | 8 | 5 | 3 | 8 |
| #328 | 2 | 0 | 2 | 2 |
| #326 | 3 | 3 | 0 | 3 |
| #324 | 2 | 2 | 0 | 2 |
| #323 | 5 | 4 | 1 | 5 |
| #320 | 5 | 4 | 1 | 5 |
| #319 | 5 | 4 | 1 | 5 |
| #315 | 3 | 3 | 0 | 3 |
| #314 | 4 | 3 | 1 | 4 |
| #313 | 5 | 4 | 1 | 5 |
| #310 | 8 | 8 | 0 | 8 |
| #312 | 1 | 1 | 0 | 1 |
| #309 | 6 | 5 | 1 | 6 |
| #308 | 7 | 5 | 2 | 7 |
| #306 | 1 | 1 | 0 | 1 |
| #305 | 1 | 1 | 0 | 1 |
| #304 | 3 | 2 | 1 | 3 |
| #301 | 7 | 6 | 1 | 7 |

