# The local-worker A/B record — what a run of the arms measured

> Rendered from `evals/ab/local-worker.json` by `local-llm.mjs eval --write`. Do not edit by hand: it is
> regenerated from that file and byte-compared, so a hand-edit survives exactly until the next run.
>
> **The record is the unreproducible half.** It is derived from **events**, model turns, which do
> not repeat. So the turns are captured once, and the rail holds this document to that capture
> rather than to the world.

> **SYNTHETIC FIXTURE: not a record of any run.** Every turn was scripted by `cli/fixtures/generate-local-worker.mjs` and every output was invented; no model, host or machine ran.

## The conditions

- **Taken:** 2000-01-01T00:00:00.000Z
- **Commit:** `0000000000000000000000000000000000000000`
- **Machine:** none: a synthetic fixture, and no machine ran these turns
- **k:** 5 per cell, the k the maintainer ruled for `evals/ab/baseline.md` on 2026-08-31
- **Seed:** `synthetic-fixture` — each arm-L turn's sampling seed derives from it, so a reader can recompute them; arm H's command takes none
- **Arm L:** the local model as routed, through `local-llm.mjs` at `--effort low` with no host floor, against `http://127.0.0.1:1234/v1`
  - `code` → role `code` → `fixture/local-code-model`
  - `codify` → role `prose` → `fixture/local-prose-model`
  - `handoff` → role `prose` → `fixture/local-prose-model`
- **Arm H:** `fixture-host --print <prompt>`, host `0.0.0 (synthetic fixture host)` as `fixture-host --print --version` reports it, in an empty working directory, with a per-turn timeout of 600s
- **Arm H's model:** `fixture/host-model`, as the operator declared it — the runner does not observe it
- **Prompt:** `EVAL_PROMPTS`' own, verbatim. Arm L receives its system and user messages; arm H the two joined by a blank line, as its command's last argument
- **Graded by:** `gradeRoleOutput()`, the predicates `eval` screens with, the same for both arms
- **Runner source:** sha256 `f2f0e8823a103f49dca7394f77d28650e1245e5231eb1474b49a3d6ab78edd04`
- **Screen fingerprints:** predicates `0000000000000000000000000000000000000000000000000000000000000000`, the sha256 over `cli/comments.mjs`, `cli/doctor.mjs`, `cli/skill-goldens.mjs`, `gradeRoleOutput()` and its required tokens; prompts `c60ce823e1551fee7644f1c376a19cf697f825900c92adfa39a13c6a99058132`

## The figures

| Task | Arm | Model | passed | failed | did-not-complete |
|---|---|---|---|---|---|
| `code` | L | `fixture/local-code-model` | **4**/5 | 1 | 0 |
| `code` | H | `fixture/host-model` | **5**/5 | 0 | 0 |
| `codify` | L | `fixture/local-prose-model` | **3**/5 | 2 | 0 |
| `codify` | H | `fixture/host-model` | **4**/5 | 0 | 1 |
| `handoff` | L | `fixture/local-prose-model` | **4**/5 | 1 | 0 |
| `handoff` | H | `fixture/host-model` | **4**/5 | 0 | 1 |

**Arm L 11/15, arm H 13/15 — a difference of -2, recorded as measured.**

That total is a sum of 3 counts of 5, and NOT a rate over 15 independent
trials. It carries no significance, no interval, and no claim that a difference between the arms is
a difference between the models. The per-task rows above are the measurement.

### Arm H's absolute rate, beside every contrast

| Task | arm L | arm H | difference |
|---|---|---|---|
| `code` | 4/5 | 5/5 | -1 |
| `codify` | 3/5 | 4/5 | -1 |
| `handoff` | 4/5 | 4/5 | +0 |

A difference here is a difference between two counts of 5. It is not a measurement of an
effect, and the block below is not a formality.

## Every turn, so the figures above can be checked against them

| Task | Arm | run | seed | verdict | exit | ms | detail |
|---|---|---|---|---|---|---|---|
| `code` | L | 0 | 2672827590 | `pass` | — | 1000 | `comments=0 history=0 exported=true` |
| `code` | L | 1 | 618709800 | `pass` | — | 1001 | `comments=0 history=0 exported=true` |
| `code` | L | 2 | 3613480712 | `fail` | — | 1002 | `comments=1 history=1 exported=true` |
| `code` | L | 3 | 2894828473 | `pass` | — | 1003 | `comments=0 history=0 exported=true` |
| `code` | L | 4 | 977243220 | `pass` | — | 1004 | `comments=0 history=0 exported=true` |
| `code` | H | 0 | — | `pass` | 0 | 20000 | `comments=0 history=0 exported=true` |
| `code` | H | 1 | — | `pass` | 0 | 20001 | `comments=0 history=0 exported=true` |
| `code` | H | 2 | — | `pass` | 0 | 20002 | `comments=0 history=0 exported=true` |
| `code` | H | 3 | — | `pass` | 0 | 20003 | `comments=0 history=0 exported=true` |
| `code` | H | 4 | — | `pass` | 0 | 20004 | `comments=0 history=0 exported=true` |
| `codify` | L | 0 | 1222993458 | `fail` | — | 1100 | `incident=true proposedRule=true enforcement=false retireWhen=false provenance=true` |
| `codify` | L | 1 | 3116546227 | `pass` | — | 1101 | `incident=true proposedRule=true enforcement=true retireWhen=true provenance=true` |
| `codify` | L | 2 | 407073270 | `fail` | — | 1102 | `incident=true proposedRule=true enforcement=false retireWhen=false provenance=true` |
| `codify` | L | 3 | 1467443926 | `pass` | — | 1103 | `incident=true proposedRule=true enforcement=true retireWhen=true provenance=true` |
| `codify` | L | 4 | 358974920 | `pass` | — | 1104 | `incident=true proposedRule=true enforcement=true retireWhen=true provenance=true` |
| `codify` | H | 0 | — | `pass` | 0 | 21000 | `incident=true proposedRule=true enforcement=true retireWhen=true provenance=true` |
| `codify` | H | 1 | — | `pass` | 0 | 21001 | `incident=true proposedRule=true enforcement=true retireWhen=true provenance=true` |
| `codify` | H | 2 | — | **did-not-complete** | 1 | 21002 | — |
| `codify` | H | 3 | — | `pass` | 0 | 21003 | `incident=true proposedRule=true enforcement=true retireWhen=true provenance=true` |
| `codify` | H | 4 | — | `pass` | 0 | 21004 | `incident=true proposedRule=true enforcement=true retireWhen=true provenance=true` |
| `handoff` | L | 0 | 624190661 | `pass` | — | 1200 | `bytes=175/800 missing=0` |
| `handoff` | L | 1 | 3172532205 | `pass` | — | 1201 | `bytes=175/800 missing=0` |
| `handoff` | L | 2 | 2759889598 | `pass` | — | 1202 | `bytes=175/800 missing=0` |
| `handoff` | L | 3 | 2658469864 | `fail` | — | 1203 | `bytes=153/800 missing=1` |
| `handoff` | L | 4 | 2491166126 | `pass` | — | 1204 | `bytes=175/800 missing=0` |
| `handoff` | H | 0 | — | `pass` | 0 | 22000 | `bytes=175/800 missing=0` |
| `handoff` | H | 1 | — | **did-not-complete** (timed out) | — | 600000 | — |
| `handoff` | H | 2 | — | `pass` | 0 | 22002 | `bytes=175/800 missing=0` |
| `handoff` | H | 3 | — | `pass` | 0 | 22003 | `bytes=175/800 missing=0` |
| `handoff` | H | 4 | — | `pass` | 0 | 22004 | `bytes=175/800 missing=0` |

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
