# The local-reader A/B record — what a run of the arms measured on find-and-quote reading

> Rendered from `evals/ab/local-reader.json` by `local-llm.mjs eval --write`. Do not edit by hand: it is
> regenerated from that file and byte-compared, so a hand-edit survives exactly until the next run.
>
> **The record is the unreproducible half.** Its turns are model events, captured once.

## The conditions

- **Taken:** 2026-11-20T09:10:51.845Z
- **Commit:** `1fcc176cd8b420205da825cf0246187cbbaa8bfb`
- **Machine:** Apple M5 Max, 128 GiB, darwin arm64, node v26.13.1
- **k:** 5 turns per arm, the k the maintainer ruled for `evals/ab/baseline.md` on 2026-08-31
- **A turn:** one pass of the 8 screen questions in `screen/read/`, each its own call, graded by `gradeReadAnswer()`; it passes only when all 8 are right, and does not complete where any of its host calls does not (ruled 2026-11-20)
- **Seed:** `portulan-reader-20261120` — each arm-L turn's sampling seed derives from it, shared by its 8 calls; arm H's command takes none
- **Arm L:** role `code` → `qwen/qwen3.8-27b`, through `local-llm.mjs` at `--effort low` with no host floor, against `http://127.0.0.1:1234/v1`; each question's `readMessages()` verbatim
- **Arm H:** `claude --print --model claude-sonnet-5-5 --max-budget-usd 0.15 <prompt>`, host `2.1.325 (Claude Code)`, in an empty working directory, with a per-call timeout of 600s; the prompt is the question's two messages joined by a blank line
- **Arm H's model:** `claude-sonnet-5-5`, as the operator declared it — the runner does not observe it
- **Runner source:** sha256 `477d054de94d17235059a48219967db87b81f850cdb0ab3fe6f421db1e13b037`
- **Screen fingerprints:** prompts `57b5ead953e7387ac18bbcbef563e4354e16460e076da10040d8157b071cc43f`, questions `2c124be9c14bf4aff47788796ec1e5ed0b0c71ffe43e64aef693bd20ef5716c6`, fixtures `0973bbcff03866607afb75617dd651aa2883b466a2de1231d47462f4d0f9fda7`, grader `7a1c40e10e4ea31768b11975d5a891f58d01190dd97b26156e4bb5ad02322cd6`

## The figures

| Arm | Model | passed | failed | did-not-complete |
|---|---|---|---|---|
| L | `qwen/qwen3.8-27b` | **5**/5 | 0 | 0 |
| H | `claude-sonnet-5-5` | **5**/5 | 0 | 0 |

**Arm L 5/5, arm H 5/5 — a tie, recorded as measured.**

## Every turn

| Arm | run | seed | verdict | exit | ms | detail |
|---|---|---|---|---|---|---|
| L | 0 | 4069502210 | `pass` | — | 42962 | `right=8/8 traps=3/3` |
| L | 1 | 616679883 | `pass` | — | 33974 | `right=8/8 traps=3/3` |
| L | 2 | 1771965907 | `pass` | — | 34612 | `right=8/8 traps=3/3` |
| L | 3 | 745603375 | `pass` | — | 32869 | `right=8/8 traps=3/3` |
| L | 4 | 3595497759 | `pass` | — | 33052 | `right=8/8 traps=3/3` |
| H | 0 | — | `pass` | 0 | 39487 | `right=8/8 traps=3/3` |
| H | 1 | — | `pass` | 0 | 36235 | `right=8/8 traps=3/3` |
| H | 2 | — | `pass` | 0 | 37150 | `right=8/8 traps=3/3` |
| H | 3 | — | `pass` | 0 | 37970 | `right=8/8 traps=3/3` |
| H | 4 | — | `pass` | 0 | 38008 | `right=8/8 traps=3/3` |

## Every question, so each turn can be checked against them

| Arm | run | question | verdict | exit | ms | detail |
|---|---|---|---|---|---|---|
| L | 0 | `module-declares` | `pass` | — | 9524 | `lines=[26] want=[26]` |
| L | 0 | `module-constant` | `pass` | — | 3130 | `value="48" lines=[5] want="48"@[5]` |
| L | 0 | `module-calls` | `pass` | — | 7739 | `lines=[48,62] want=[48,62]` |
| L | 0 | `module-absent-function` | `pass` | — | 4085 | `absent=true lines=[]` |
| L | 0 | `module-absent-env` | `pass` | — | 3577 | `absent=true lines=[]` |
| L | 0 | `log-skipped` | `pass` | — | 3969 | `value="2" lines=[39] want="2"@[39]` |
| L | 0 | `log-first-failure` | `pass` | — | 8590 | `lines=[12] want=[12]` |
| L | 0 | `log-absent-coverage` | `pass` | — | 2348 | `absent=true lines=[]` |
| L | 1 | `module-declares` | `pass` | — | 2616 | `lines=[26] want=[26]` |
| L | 1 | `module-constant` | `pass` | — | 2963 | `value="48" lines=[5] want="48"@[5]` |
| L | 1 | `module-calls` | `pass` | — | 7452 | `lines=[48,62] want=[48,62]` |
| L | 1 | `module-absent-function` | `pass` | — | 3846 | `absent=true lines=[]` |
| L | 1 | `module-absent-env` | `pass` | — | 3147 | `absent=true lines=[]` |
| L | 1 | `log-skipped` | `pass` | — | 3328 | `value="2" lines=[39] want="2"@[39]` |
| L | 1 | `log-first-failure` | `pass` | — | 8310 | `lines=[12] want=[12]` |
| L | 1 | `log-absent-coverage` | `pass` | — | 2312 | `absent=true lines=[]` |
| L | 2 | `module-declares` | `pass` | — | 2513 | `lines=[26] want=[26]` |
| L | 2 | `module-constant` | `pass` | — | 2924 | `value="48" lines=[5] want="48"@[5]` |
| L | 2 | `module-calls` | `pass` | — | 7286 | `lines=[48,62] want=[48,62]` |
| L | 2 | `module-absent-function` | `pass` | — | 3796 | `absent=true lines=[]` |
| L | 2 | `module-absent-env` | `pass` | — | 3971 | `absent=true lines=[]` |
| L | 2 | `log-skipped` | `pass` | — | 3675 | `value="2" lines=[39] want="2"@[39]` |
| L | 2 | `log-first-failure` | `pass` | — | 8121 | `lines=[12] want=[12]` |
| L | 2 | `log-absent-coverage` | `pass` | — | 2326 | `absent=true lines=[]` |
| L | 3 | `module-declares` | `pass` | — | 2445 | `lines=[26] want=[26]` |
| L | 3 | `module-constant` | `pass` | — | 2848 | `value="48" lines=[5] want="48"@[5]` |
| L | 3 | `module-calls` | `pass` | — | 7084 | `lines=[48,62] want=[48,62]` |
| L | 3 | `module-absent-function` | `pass` | — | 3774 | `absent=true lines=[]` |
| L | 3 | `module-absent-env` | `pass` | — | 2979 | `absent=true lines=[]` |
| L | 3 | `log-skipped` | `pass` | — | 3200 | `value="2" lines=[39] want="2"@[39]` |
| L | 3 | `log-first-failure` | `pass` | — | 8236 | `lines=[12] want=[12]` |
| L | 3 | `log-absent-coverage` | `pass` | — | 2303 | `absent=true lines=[]` |
| L | 4 | `module-declares` | `pass` | — | 2424 | `lines=[26] want=[26]` |
| L | 4 | `module-constant` | `pass` | — | 2763 | `value="48" lines=[5] want="48"@[5]` |
| L | 4 | `module-calls` | `pass` | — | 7260 | `lines=[48,62] want=[48,62]` |
| L | 4 | `module-absent-function` | `pass` | — | 3737 | `absent=true lines=[]` |
| L | 4 | `module-absent-env` | `pass` | — | 3484 | `absent=true lines=[]` |
| L | 4 | `log-skipped` | `pass` | — | 3146 | `value="2" lines=[39] want="2"@[39]` |
| L | 4 | `log-first-failure` | `pass` | — | 7914 | `lines=[12] want=[12]` |
| L | 4 | `log-absent-coverage` | `pass` | — | 2324 | `absent=true lines=[]` |
| H | 0 | `module-declares` | `pass` | 0 | 5866 | `lines=[26] want=[26]` |
| H | 0 | `module-constant` | `pass` | 0 | 4342 | `value="48" lines=[5] want="48"@[5]` |
| H | 0 | `module-calls` | `pass` | 0 | 5933 | `lines=[48,62] want=[48,62]` |
| H | 0 | `module-absent-function` | `pass` | 0 | 4619 | `absent=true lines=[]` |
| H | 0 | `module-absent-env` | `pass` | 0 | 4952 | `absent=true lines=[]` |
| H | 0 | `log-skipped` | `pass` | 0 | 4427 | `value="2" lines=[39] want="2"@[39]` |
| H | 0 | `log-first-failure` | `pass` | 0 | 4367 | `lines=[12] want=[12]` |
| H | 0 | `log-absent-coverage` | `pass` | 0 | 4981 | `absent=true lines=[]` |
| H | 1 | `module-declares` | `pass` | 0 | 4581 | `lines=[26] want=[26]` |
| H | 1 | `module-constant` | `pass` | 0 | 4644 | `value="48" lines=[5] want="48"@[5]` |
| H | 1 | `module-calls` | `pass` | 0 | 4474 | `lines=[48,62] want=[48,62]` |
| H | 1 | `module-absent-function` | `pass` | 0 | 4477 | `absent=true lines=[]` |
| H | 1 | `module-absent-env` | `pass` | 0 | 4575 | `absent=true lines=[]` |
| H | 1 | `log-skipped` | `pass` | 0 | 4453 | `value="2" lines=[39] want="2"@[39]` |
| H | 1 | `log-first-failure` | `pass` | 0 | 4578 | `lines=[12] want=[12]` |
| H | 1 | `log-absent-coverage` | `pass` | 0 | 4453 | `absent=true lines=[]` |
| H | 2 | `module-declares` | `pass` | 0 | 4433 | `lines=[26] want=[26]` |
| H | 2 | `module-constant` | `pass` | 0 | 4406 | `value="48" lines=[5] want="48"@[5]` |
| H | 2 | `module-calls` | `pass` | 0 | 4676 | `lines=[48,62] want=[48,62]` |
| H | 2 | `module-absent-function` | `pass` | 0 | 4582 | `absent=true lines=[]` |
| H | 2 | `module-absent-env` | `pass` | 0 | 4686 | `absent=true lines=[]` |
| H | 2 | `log-skipped` | `pass` | 0 | 4759 | `value="2" lines=[39] want="2"@[39]` |
| H | 2 | `log-first-failure` | `pass` | 0 | 4794 | `lines=[12] want=[12]` |
| H | 2 | `log-absent-coverage` | `pass` | 0 | 4814 | `absent=true lines=[]` |
| H | 3 | `module-declares` | `pass` | 0 | 4604 | `lines=[26] want=[26]` |
| H | 3 | `module-constant` | `pass` | 0 | 4399 | `value="48" lines=[5] want="48"@[5]` |
| H | 3 | `module-calls` | `pass` | 0 | 4968 | `lines=[48,62] want=[48,62]` |
| H | 3 | `module-absent-function` | `pass` | 0 | 4709 | `absent=true lines=[]` |
| H | 3 | `module-absent-env` | `pass` | 0 | 4665 | `absent=true lines=[]` |
| H | 3 | `log-skipped` | `pass` | 0 | 4716 | `value="2" lines=[39] want="2"@[39]` |
| H | 3 | `log-first-failure` | `pass` | 0 | 4786 | `lines=[12] want=[12]` |
| H | 3 | `log-absent-coverage` | `pass` | 0 | 5123 | `absent=true lines=[]` |
| H | 4 | `module-declares` | `pass` | 0 | 4571 | `lines=[26] want=[26]` |
| H | 4 | `module-constant` | `pass` | 0 | 5022 | `value="48" lines=[5] want="48"@[5]` |
| H | 4 | `module-calls` | `pass` | 0 | 4830 | `lines=[48,62] want=[48,62]` |
| H | 4 | `module-absent-function` | `pass` | 0 | 4735 | `absent=true lines=[]` |
| H | 4 | `module-absent-env` | `pass` | 0 | 4887 | `absent=true lines=[]` |
| H | 4 | `log-skipped` | `pass` | 0 | 4594 | `value="2" lines=[39] want="2"@[39]` |
| H | 4 | `log-first-failure` | `pass` | 0 | 4498 | `lines=[12] want=[12]` |
| H | 4 | `log-absent-coverage` | `pass` | 0 | 4871 | `absent=true lines=[]` |

**What may not be concluded from the figures above.**

- **`k = 5` per arm supports a recorded rate and nothing else**: no significance, no interval, and no
  claim that a difference between the arms is a difference between the models.
- **A pass is `gradeReadAnswer()`'s and nothing more**: the exact set of cited lines, a value and its
  line, or `ABSENT` citing none, on two synthetic fixtures. It does not say a reading call pays, which
  turns on the file and the parent's context, nor how often reading answers are wrong elsewhere.
- **`eval --verify` regrades every completed question with the grader that ships**, and any verdict
  that moves is red.
- **The arms differ in more than the model**, as in `evals/ab/local-worker.md`: arm H is the host agent
  under the operator's own environment, and its model is the operator's declaration.
- **Which use these figures support is not stated here.** It is stated where the routing ships.
