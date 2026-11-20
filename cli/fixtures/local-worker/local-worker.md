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
  - `read` → role `code` → `fixture/local-code-model`
- **Arm H:** `fixture-host --print <prompt>`, host `0.0.0 (synthetic fixture host)` as `fixture-host --print --version` reports it, in an empty working directory, with a per-turn timeout of 600s
- **Arm H's model:** `fixture/host-model`, as the operator declared it — the runner does not observe it
- **Prompt:** `EVAL_PROMPTS`' own, verbatim. Arm L receives its system and user messages; arm H the two joined by a blank line, as its command's last argument
- **Graded by:** `gradeRoleOutput()`, the predicates `eval` screens with, the same for both arms
- **Runner source:** sha256 `6144e8123cb5cace25300192647198354a803f4a3d40e73e77ab90a7c783c421`
- **Screen fingerprints:** predicates `0000000000000000000000000000000000000000000000000000000000000000`, the sha256 over `cli/comments.mjs`, `cli/doctor.mjs`, `cli/skill-goldens.mjs`, `gradeRoleOutput()` and its required tokens; prompts `c60ce823e1551fee7644f1c376a19cf697f825900c92adfa39a13c6a99058132`
- **Reading:** a `read` turn is one pass of the 8 screen questions in `screen/read/`, each its own call (`readMessages()`; arm H the two messages joined), graded by `gradeReadAnswer()`, and passes only when all 8 are right; arm L's 8 calls share the turn's seed; ruled 2026-11-20
- **Reading fingerprints:** prompts `57b5ead953e7387ac18bbcbef563e4354e16460e076da10040d8157b071cc43f`, questions `2c124be9c14bf4aff47788796ec1e5ed0b0c71ffe43e64aef693bd20ef5716c6`, fixtures `0973bbcff03866607afb75617dd651aa2883b466a2de1231d47462f4d0f9fda7`, grader `0000000000000000000000000000000000000000000000000000000000000000`

## The figures

| Task | Arm | Model | passed | failed | did-not-complete |
|---|---|---|---|---|---|
| `code` | L | `fixture/local-code-model` | **4**/5 | 1 | 0 |
| `code` | H | `fixture/host-model` | **5**/5 | 0 | 0 |
| `codify` | L | `fixture/local-prose-model` | **3**/5 | 2 | 0 |
| `codify` | H | `fixture/host-model` | **4**/5 | 0 | 1 |
| `handoff` | L | `fixture/local-prose-model` | **4**/5 | 1 | 0 |
| `handoff` | H | `fixture/host-model` | **4**/5 | 0 | 1 |
| `read` | L | `fixture/local-code-model` | **4**/5 | 1 | 0 |
| `read` | H | `fixture/host-model` | **3**/5 | 0 | 2 |

**Arm L 15/20, arm H 16/20 — a difference of -1, recorded as measured.**

That total is a sum of 4 counts of 5, and NOT a rate over 20 independent
trials. It carries no significance, no interval, and no claim that a difference between the arms is
a difference between the models. The per-task rows above are the measurement.

### Arm H's absolute rate, beside every contrast

| Task | arm L | arm H | difference |
|---|---|---|---|
| `code` | 4/5 | 5/5 | -1 |
| `codify` | 3/5 | 4/5 | -1 |
| `handoff` | 4/5 | 4/5 | +0 |
| `read` | 4/5 | 3/5 | +1 |

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
| `read` | L | 0 | 1869464975 | `pass` | — | 4028 | `right=8/8 traps=3/3` |
| `read` | L | 1 | 2149045721 | `pass` | — | 4108 | `right=8/8 traps=3/3` |
| `read` | L | 2 | 2019063135 | `fail` | — | 4188 | `right=7/8 traps=2/3 wrong=module-absent-function(absent=false lines=[12])` |
| `read` | L | 3 | 2054832489 | `pass` | — | 4268 | `right=8/8 traps=3/3` |
| `read` | L | 4 | 1006482901 | `pass` | — | 4348 | `right=8/8 traps=3/3` |
| `read` | H | 0 | — | `pass` | 0 | 32028 | `right=8/8 traps=3/3` |
| `read` | H | 1 | — | **did-not-complete** | 1 | 32108 | — |
| `read` | H | 2 | — | `pass` | 0 | 32188 | `right=8/8 traps=3/3` |
| `read` | H | 3 | — | `pass` | 0 | 32268 | `right=8/8 traps=3/3` |
| `read` | H | 4 | — | **did-not-complete** (timed out) | — | 628307 | — |

## Every reading question, so each reading turn can be checked against them

| Arm | run | question | verdict | exit | ms | detail |
|---|---|---|---|---|---|---|
| L | 0 | `module-declares` | `pass` | — | 500 | `lines=[26] want=[26]` |
| L | 0 | `module-constant` | `pass` | — | 501 | `value="48" lines=[5] want="48"@[5]` |
| L | 0 | `module-calls` | `pass` | — | 502 | `lines=[48,62] want=[48,62]` |
| L | 0 | `module-absent-function` | `pass` | — | 503 | `absent=true lines=[]` |
| L | 0 | `module-absent-env` | `pass` | — | 504 | `absent=true lines=[]` |
| L | 0 | `log-skipped` | `pass` | — | 505 | `value="2" lines=[39] want="2"@[39]` |
| L | 0 | `log-first-failure` | `pass` | — | 506 | `lines=[12] want=[12]` |
| L | 0 | `log-absent-coverage` | `pass` | — | 507 | `absent=true lines=[]` |
| L | 1 | `module-declares` | `pass` | — | 510 | `lines=[26] want=[26]` |
| L | 1 | `module-constant` | `pass` | — | 511 | `value="48" lines=[5] want="48"@[5]` |
| L | 1 | `module-calls` | `pass` | — | 512 | `lines=[48,62] want=[48,62]` |
| L | 1 | `module-absent-function` | `pass` | — | 513 | `absent=true lines=[]` |
| L | 1 | `module-absent-env` | `pass` | — | 514 | `absent=true lines=[]` |
| L | 1 | `log-skipped` | `pass` | — | 515 | `value="2" lines=[39] want="2"@[39]` |
| L | 1 | `log-first-failure` | `pass` | — | 516 | `lines=[12] want=[12]` |
| L | 1 | `log-absent-coverage` | `pass` | — | 517 | `absent=true lines=[]` |
| L | 2 | `module-declares` | `pass` | — | 520 | `lines=[26] want=[26]` |
| L | 2 | `module-constant` | `pass` | — | 521 | `value="48" lines=[5] want="48"@[5]` |
| L | 2 | `module-calls` | `pass` | — | 522 | `lines=[48,62] want=[48,62]` |
| L | 2 | `module-absent-function` | `fail` | — | 523 | `absent=false lines=[12]` |
| L | 2 | `module-absent-env` | `pass` | — | 524 | `absent=true lines=[]` |
| L | 2 | `log-skipped` | `pass` | — | 525 | `value="2" lines=[39] want="2"@[39]` |
| L | 2 | `log-first-failure` | `pass` | — | 526 | `lines=[12] want=[12]` |
| L | 2 | `log-absent-coverage` | `pass` | — | 527 | `absent=true lines=[]` |
| L | 3 | `module-declares` | `pass` | — | 530 | `lines=[26] want=[26]` |
| L | 3 | `module-constant` | `pass` | — | 531 | `value="48" lines=[5] want="48"@[5]` |
| L | 3 | `module-calls` | `pass` | — | 532 | `lines=[48,62] want=[48,62]` |
| L | 3 | `module-absent-function` | `pass` | — | 533 | `absent=true lines=[]` |
| L | 3 | `module-absent-env` | `pass` | — | 534 | `absent=true lines=[]` |
| L | 3 | `log-skipped` | `pass` | — | 535 | `value="2" lines=[39] want="2"@[39]` |
| L | 3 | `log-first-failure` | `pass` | — | 536 | `lines=[12] want=[12]` |
| L | 3 | `log-absent-coverage` | `pass` | — | 537 | `absent=true lines=[]` |
| L | 4 | `module-declares` | `pass` | — | 540 | `lines=[26] want=[26]` |
| L | 4 | `module-constant` | `pass` | — | 541 | `value="48" lines=[5] want="48"@[5]` |
| L | 4 | `module-calls` | `pass` | — | 542 | `lines=[48,62] want=[48,62]` |
| L | 4 | `module-absent-function` | `pass` | — | 543 | `absent=true lines=[]` |
| L | 4 | `module-absent-env` | `pass` | — | 544 | `absent=true lines=[]` |
| L | 4 | `log-skipped` | `pass` | — | 545 | `value="2" lines=[39] want="2"@[39]` |
| L | 4 | `log-first-failure` | `pass` | — | 546 | `lines=[12] want=[12]` |
| L | 4 | `log-absent-coverage` | `pass` | — | 547 | `absent=true lines=[]` |
| H | 0 | `module-declares` | `pass` | 0 | 4000 | `lines=[26] want=[26]` |
| H | 0 | `module-constant` | `pass` | 0 | 4001 | `value="48" lines=[5] want="48"@[5]` |
| H | 0 | `module-calls` | `pass` | 0 | 4002 | `lines=[48,62] want=[48,62]` |
| H | 0 | `module-absent-function` | `pass` | 0 | 4003 | `absent=true lines=[]` |
| H | 0 | `module-absent-env` | `pass` | 0 | 4004 | `absent=true lines=[]` |
| H | 0 | `log-skipped` | `pass` | 0 | 4005 | `value="2" lines=[39] want="2"@[39]` |
| H | 0 | `log-first-failure` | `pass` | 0 | 4006 | `lines=[12] want=[12]` |
| H | 0 | `log-absent-coverage` | `pass` | 0 | 4007 | `absent=true lines=[]` |
| H | 1 | `module-declares` | `pass` | 0 | 4010 | `lines=[26] want=[26]` |
| H | 1 | `module-constant` | `pass` | 0 | 4011 | `value="48" lines=[5] want="48"@[5]` |
| H | 1 | `module-calls` | `pass` | 0 | 4012 | `lines=[48,62] want=[48,62]` |
| H | 1 | `module-absent-function` | `pass` | 0 | 4013 | `absent=true lines=[]` |
| H | 1 | `module-absent-env` | `pass` | 0 | 4014 | `absent=true lines=[]` |
| H | 1 | `log-skipped` | **did-not-complete** | 1 | 4015 | — |
| H | 1 | `log-first-failure` | `pass` | 0 | 4016 | `lines=[12] want=[12]` |
| H | 1 | `log-absent-coverage` | `pass` | 0 | 4017 | `absent=true lines=[]` |
| H | 2 | `module-declares` | `pass` | 0 | 4020 | `lines=[26] want=[26]` |
| H | 2 | `module-constant` | `pass` | 0 | 4021 | `value="48" lines=[5] want="48"@[5]` |
| H | 2 | `module-calls` | `pass` | 0 | 4022 | `lines=[48,62] want=[48,62]` |
| H | 2 | `module-absent-function` | `pass` | 0 | 4023 | `absent=true lines=[]` |
| H | 2 | `module-absent-env` | `pass` | 0 | 4024 | `absent=true lines=[]` |
| H | 2 | `log-skipped` | `pass` | 0 | 4025 | `value="2" lines=[39] want="2"@[39]` |
| H | 2 | `log-first-failure` | `pass` | 0 | 4026 | `lines=[12] want=[12]` |
| H | 2 | `log-absent-coverage` | `pass` | 0 | 4027 | `absent=true lines=[]` |
| H | 3 | `module-declares` | `pass` | 0 | 4030 | `lines=[26] want=[26]` |
| H | 3 | `module-constant` | `pass` | 0 | 4031 | `value="48" lines=[5] want="48"@[5]` |
| H | 3 | `module-calls` | `pass` | 0 | 4032 | `lines=[48,62] want=[48,62]` |
| H | 3 | `module-absent-function` | `pass` | 0 | 4033 | `absent=true lines=[]` |
| H | 3 | `module-absent-env` | `pass` | 0 | 4034 | `absent=true lines=[]` |
| H | 3 | `log-skipped` | `pass` | 0 | 4035 | `value="2" lines=[39] want="2"@[39]` |
| H | 3 | `log-first-failure` | `pass` | 0 | 4036 | `lines=[12] want=[12]` |
| H | 3 | `log-absent-coverage` | `pass` | 0 | 4037 | `absent=true lines=[]` |
| H | 4 | `module-declares` | `pass` | 0 | 4040 | `lines=[26] want=[26]` |
| H | 4 | `module-constant` | **did-not-complete** (timed out) | — | 600000 | — |
| H | 4 | `module-calls` | `pass` | 0 | 4042 | `lines=[48,62] want=[48,62]` |
| H | 4 | `module-absent-function` | `pass` | 0 | 4043 | `absent=true lines=[]` |
| H | 4 | `module-absent-env` | `pass` | 0 | 4044 | `absent=true lines=[]` |
| H | 4 | `log-skipped` | `pass` | 0 | 4045 | `value="2" lines=[39] want="2"@[39]` |
| H | 4 | `log-first-failure` | `pass` | 0 | 4046 | `lines=[12] want=[12]` |
| H | 4 | `log-absent-coverage` | `pass` | 0 | 4047 | `absent=true lines=[]` |

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
- **A reading pass is `gradeReadAnswer()`'s and nothing more**: the exact set of cited lines, a value and
  its line, or `ABSENT` citing none, on two synthetic fixtures. It does not say a reading call pays,
  which turns on the file and the parent's context, nor how often a reading answer is wrong elsewhere.
