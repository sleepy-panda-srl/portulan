# The local-worker A/B record — what a run of the arms measured

> Rendered from `evals/ab/local-worker.json` by `local-llm.mjs eval --write`. Do not edit by hand: it is
> regenerated from that file and byte-compared, so a hand-edit survives exactly until the next run.
>
> **The record is the unreproducible half.** It is derived from **events**, model turns, which do
> not repeat. So the turns are captured once, and the rail holds this document to that capture
> rather than to the world.

## The conditions

- **Taken:** 2026-11-03T15:03:26.416Z
- **Commit:** `9848be4ce19888e6b42c7de5428d960c540072fa`
- **Machine:** Apple M5 Max, 128 GiB, darwin arm64, node v26.12.1
- **k:** 5 per cell, the k the maintainer ruled for `evals/ab/baseline.md` on 2026-08-31
- **Seed:** `portulan-m14-20261103` — each arm-L turn's sampling seed derives from it, so a reader can recompute them; arm H's command takes none
- **Arm L:** the local model as routed, through `local-llm.mjs` at `--effort low` with no host floor, against `http://127.0.0.1:1234/v1`
  - `code` → role `code` → `qwen/qwen3.8-27b`
  - `codify` → role `prose` → `google/gemma-4-31b`
  - `handoff` → role `prose` → `google/gemma-4-31b`
- **Arm H:** `/opt/homebrew/bin/claude --print --model claude-sonnet-5-5 --max-budget-usd 0.15 <prompt>`, host `2.1.308 (Claude Code)` as `/opt/homebrew/bin/claude --print --model claude-sonnet-5-5 --max-budget-usd 0.15 --version` reports it, in an empty working directory, with a per-turn timeout of 600s
- **Arm H's model:** `claude-sonnet-5-5`, as the operator declared it — the runner does not observe it
- **Prompt:** `EVAL_PROMPTS`' own, verbatim. Arm L receives its system and user messages; arm H the two joined by a blank line, as its command's last argument
- **Graded by:** `gradeRoleOutput()`, the predicates `eval` screens with, the same for both arms
- **Runner source:** sha256 `f2f0e8823a103f49dca7394f77d28650e1245e5231eb1474b49a3d6ab78edd04`
- **Screen fingerprints:** predicates `a5754887043e208ae64a99c8c2cd4f42913e7ab29ef9c5bd8f3d985f8d190773`, the sha256 over `cli/comments.mjs`, `cli/doctor.mjs`, `cli/skill-goldens.mjs`, `gradeRoleOutput()` and its required tokens; prompts `c60ce823e1551fee7644f1c376a19cf697f825900c92adfa39a13c6a99058132`

## The figures

| Task | Arm | Model | passed | failed | did-not-complete |
|---|---|---|---|---|---|
| `code` | L | `qwen/qwen3.8-27b` | **5**/5 | 0 | 0 |
| `code` | H | `claude-sonnet-5-5` | **0**/5 | 0 | 5 |
| `codify` | L | `google/gemma-4-31b` | **0**/5 | 5 | 0 |
| `codify` | H | `claude-sonnet-5-5` | **0**/5 | 0 | 5 |
| `handoff` | L | `google/gemma-4-31b` | **5**/5 | 0 | 0 |
| `handoff` | H | `claude-sonnet-5-5` | **0**/5 | 0 | 5 |

**Arm L 10/15, arm H 0/15 — a difference of +10, recorded as measured.**

That total is a sum of 3 counts of 5, and NOT a rate over 15 independent
trials. It carries no significance, no interval, and no claim that a difference between the arms is
a difference between the models. The per-task rows above are the measurement.

### Arm H's absolute rate, beside every contrast

| Task | arm L | arm H | difference |
|---|---|---|---|
| `code` | 5/5 | 0/5 | +5 |
| `codify` | 0/5 | 0/5 | +0 |
| `handoff` | 5/5 | 0/5 | +5 |

A difference here is a difference between two counts of 5. It is not a measurement of an
effect, and the block below is not a formality.

## Every turn, so the figures above can be checked against them

| Task | Arm | run | seed | verdict | exit | ms | detail |
|---|---|---|---|---|---|---|---|
| `code` | L | 0 | 3640696105 | `pass` | — | 47717 | `comments=0 history=0 exported=true` |
| `code` | L | 1 | 1631287901 | `pass` | — | 32904 | `comments=0 history=0 exported=true` |
| `code` | L | 2 | 3682966371 | `pass` | — | 40277 | `comments=0 history=0 exported=true` |
| `code` | L | 3 | 2276359888 | `pass` | — | 31296 | `comments=0 history=0 exported=true` |
| `code` | L | 4 | 667955679 | `pass` | — | 25800 | `comments=0 history=0 exported=true` |
| `code` | H | 0 | — | **did-not-complete** | 1 | 2850 | — |
| `code` | H | 1 | — | **did-not-complete** | 1 | 2203 | — |
| `code` | H | 2 | — | **did-not-complete** | 1 | 2200 | — |
| `code` | H | 3 | — | **did-not-complete** | 1 | 2118 | — |
| `code` | H | 4 | — | **did-not-complete** | 1 | 2292 | — |
| `codify` | L | 0 | 1739728957 | `fail` | — | 56792 | `incident=true proposedRule=true enforcement=true retireWhen=true provenance=false` |
| `codify` | L | 1 | 1370902320 | `fail` | — | 53207 | `incident=true proposedRule=true enforcement=true retireWhen=true provenance=false` |
| `codify` | L | 2 | 693472120 | `fail` | — | 41565 | `incident=true proposedRule=true enforcement=true retireWhen=true provenance=false` |
| `codify` | L | 3 | 294675420 | `fail` | — | 46147 | `incident=true proposedRule=true enforcement=true retireWhen=true provenance=false` |
| `codify` | L | 4 | 867099035 | `fail` | — | 41774 | `incident=true proposedRule=true enforcement=true retireWhen=true provenance=false` |
| `codify` | H | 0 | — | **did-not-complete** | 1 | 2129 | — |
| `codify` | H | 1 | — | **did-not-complete** | 1 | 2141 | — |
| `codify` | H | 2 | — | **did-not-complete** | 1 | 2082 | — |
| `codify` | H | 3 | — | **did-not-complete** | 1 | 1973 | — |
| `codify` | H | 4 | — | **did-not-complete** | 1 | 2015 | — |
| `handoff` | L | 0 | 3282932192 | `pass` | — | 58374 | `bytes=272/800 missing=0` |
| `handoff` | L | 1 | 1918482472 | `pass` | — | 44082 | `bytes=272/800 missing=0` |
| `handoff` | L | 2 | 3989843898 | `pass` | — | 58887 | `bytes=266/800 missing=0` |
| `handoff` | L | 3 | 428692503 | `pass` | — | 59724 | `bytes=266/800 missing=0` |
| `handoff` | L | 4 | 2739842303 | `pass` | — | 50855 | `bytes=266/800 missing=0` |
| `handoff` | H | 0 | — | **did-not-complete** | 1 | 2115 | — |
| `handoff` | H | 1 | — | **did-not-complete** | 1 | 2144 | — |
| `handoff` | H | 2 | — | **did-not-complete** | 1 | 2062 | — |
| `handoff` | H | 3 | — | **did-not-complete** | 1 | 2133 | — |
| `handoff` | H | 4 | — | **did-not-complete** | 1 | 2166 | — |

**What may not be concluded from the figures above.**

- **`k = 5` per cell supports a recorded rate and nothing else**, the limit `evals/ab/baseline.md`
  carries and `evals/ab/corpus.md` argues: no significance, no interval, and no claim that a
  difference between two cells is a difference between the models.
- **A pass is the screen's predicate and nothing more.** `gradeRoleOutput()` asks what `eval` asks:
  no history comment and the export for `code`, five fields and a provenance for `codify`, 800 bytes
  and every required token for `handoff`. It does not ask whether an output is correct or good.
- **The verdicts are the screen's as it ships, not only as it was.** `eval --verify` regrades every
  completed turn's output with the predicates of the commit it runs on, and any verdict that moves is
  red, so these figures hold under the screen that ships. The fingerprints above name the screen the
  capture graded under, as recorded; a changed predicate file whose verdicts all regrade the same is
  no finding.
- **The arms differ in more than the model.** Arm L runs with no host floor at `--effort low` and
  receives a system and a user message; arm H is the host agent under the operator's own
  environment, credentials and configuration, with whatever it loads in an empty directory, and
  receives the two as one text.
  That difference is the routing question, not a confound this record removes.
- **Arm H's model is the operator's declaration**, which the runner records and does not observe.
- **`did-not-complete` is a fact about a turn**, a host exit other than `0`, a timeout, or a host
  ended by a signal the capture did not send, and is folded into neither count.
- **Which routing these figures support is not stated here.** It is stated where the routing ships,
  the pack's README and `ROLE_MODELS`, which cite this record.
