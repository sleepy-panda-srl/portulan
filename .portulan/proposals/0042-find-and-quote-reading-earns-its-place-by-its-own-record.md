# Proposal 0042 — find-and-quote reading earns its place by a record of its own

**Status. ACCEPTED — drafted 2026-11-19; its four questions ruled by Marius Cetanas on 2026-11-20, the
second of them twice.** Extends
[`0039`](0039-a-local-model-runs-without-the-host-floor-and-under-a-thinking-cap.md) clause 4
(loopback is a rail; routing is earned) to a second use of the earned `code` role: reading one file or
one log and quoting lines from it. Answers [#678](https://github.com/sleepy-panda-srl/portulan/issues/678).
The rulings are recorded under *What was ruled*. The capture path they ask for is built in the change
that records them; the capture itself is the maintainer's step, and until he takes it reading stays a
candidate use.

**Pull request:** https://github.com/sleepy-panda-srl/portulan/pull/679 (the draft); the rulings and the
capture path land in the pull request that follows it.

---

## Incident — a checkable kind of reading had no place in the pack

The `delegate-local` skill earns one local use, `transform --role code`, and keeps every digest in the
parent. [#583](https://github.com/sleepy-panda-srl/portulan/issues/583) measured why per-edit delegation
saves little: the local model's output is a small share of a parent session's tokens, and each call is
one more parent request.

[#678](https://github.com/sleepy-panda-srl/portulan/issues/678) reports a narrower use that is checkable:
**find and quote**, a pointed question about one file or log, answered with line numbers, which the
caller confirms by reading only those lines. In a small trial in a consumer workspace, as the issue
states it: ten questions written with their answers before any model ran, one sample each, on runner
0.5.0 `chat`; `--role code` answered 9 of 10 and the candidate prose model 8.5 of 10, both right on the
two absent-item traps, both wrong or muddled on working a weighted pick through by hand. A caller took in
about 1,100 tokens (questions and answers) where reading the files cost about 37,700. That is a screen
in one codebase, not a rate.

## What exists

Built with the draft, as an implementation of the issue's runner and screen asks:

- **`chat` and `summarize` take `--number-lines`**, so an answer can cite lines without a hand-made
  numbered copy; the receipt records `line-numbers=on`. It opens no guard: `summarize` still refuses,
  `transform` refuses the flag, and the numbers count against the input ceiling.
- **`eval --task read`** screens the use: eight one-question calls about two synthetic fixtures that ship
  in `packs/tools/local-llm/screen/read/`, graded with no judgement, three of them absent-item traps,
  passing only when all eight are right. On 2026-11-19 it passed on `qwen/qwen3.8-27b`, 8 of 8 with the
  three traps right, one sample on a loaded machine. **The screen earns nothing.** `read` stays in
  `eval`'s default task set, by the fourth ruling.
- **The skill names find and quote as an operator-selected candidate use**, with its rails, and the
  pack's README states when a reading call pays.

Built with the rulings:

- **`eval --ab --task read` captures the reading record**, `evals/ab/local-reader.json` with its
  generated register `local-reader.md`, and `eval --verify` checks it, as *Enforcement* describes.
- **`EARNED_ROUTING` takes a reading entry only from a qualifying reader record**, derived by
  [`cli/local-routing.mjs`](../../cli/local-routing.mjs).

**What is still missing is the record.** No reader record is captured. `eval --verify` reports it as
`not captured, so reading earns nothing` and stays green, `cli/local-routing.mjs` reports
`reading: not captured`, and the shipped routing carries no reading entry. Until the maintainer captures
it, the use is a candidate.

## Rule

1. **Find-and-quote reading is a use of the earned `code` role that is earned on its own record.** The
   skill may call it supported only where the reader record qualifies under the rule the local-worker
   record fixed before outcomes: all five local turns pass, all five host turns complete, and local
   passes are at least host passes. A tie at zero earns nothing.
2. **Its rails are part of the use, not advice.** One file or one log per call, under the input
   ceiling; one question, ending "Give line numbers. If the file does not contain it, say so."; the
   caller reads only the cited lines, or greps the one number in a log, before relying on the answer;
   never for tracing a function, deciding anything or comparing files; prose digests stay in the
   parent.
3. **A reading call pays only on a file the parent consults without editing.** With `R` the file's
   tokens, `q` the question, answer and checked lines, `C` the parent's context and `T′` the later
   requests that would have re-read the file, it pays while `(R − q) × T′` exceeds `C`, in #583's
   terms. It is to be demoted if wrong answers run worse than 1 in 10 in the consumer's logged use, or
   if the parent's tokens do not fall, as the issue proposes.

## Enforcement — the reader record

**A record of its own, and `local-worker.json` untouched.** Extending the worker record would change
its matrix, its prompts' fingerprint and its turn count, and a recapture would put its three earned
cells back on the table by chance. `evals/ab/local-reader.json` with its generated register
`local-reader.md` leaves the worker record, its register and its verification exactly as committed.

- **One task, two arms, `k = 5`.** Arm L is `--role code` at `--effort low` on loopback, with a seed per
  turn as today, and runs first, so a local failure stops the capture before any host call. Arm H is
  the host agent through `--host-cmd`, under the same refusals the local-worker capture applies.
- **A turn is one pass of the eight screen questions**, each sent as its own call (in arm L with the
  turn's seed), graded by the screen's `gradeReadAnswer`; a turn passes only when all eight are right,
  and does not complete where any of its eight host calls does not. Arm H is therefore forty paid host
  calls, each leaving the machine.
- **`eval --verify` covers both records**: the worker record as before, and the reader record when it
  exists — shape, seeds, every completed question regraded by the grader as it ships, the sha256
  fingerprints of the prompts, questions and fixtures (a grader that moved while every verdict regrades
  the same is no finding, as for the worker's predicates), each turn folded from its eight questions,
  the cells folded from the turns, and the register byte-compared. An absent reader record earns
  nothing and is not a failure; a register with no record is. The `ab-run` recipe runs both without a
  model, as it ran the worker record's.
- **`EARNED_ROUTING` gains a reading entry** derived by `cli/local-routing.mjs` from a reader record
  that qualifies, and from nothing else. The skill moves from "candidate" to "supported" only in the
  change that commits a qualifying record.

**The capture is the maintainer's step**, run once on the machine that holds the host's sign-in:

```bash
node packs/tools/local-llm/runner/local-llm.mjs eval --ab --task read --k 5 --seed <seed> \
  --host-cmd "claude --print --model <host model> --max-budget-usd <ceiling>" \
  --host-model <host model> --write
```

## What was ruled — four questions, 2026-11-20

Each question went to the maintainer as it is quoted here, and his answers follow it word for word, in
the order he gave them.

1. *"Portulan: keep find-and-quote reading a candidate, or earn it with a paid record?"* —
   **"Earn a record"**. Reading is a use to earn by a paid A/B record.
2. *"Portulan: a reading record of its own, or recapture the existing record with a fourth task?"* —
   first **"Recapture all"**. Later the same day, told that a recapture puts the three earned uses back
   on the table by chance, he replaced it: **"Go with a separate record then."** The record is
   `evals/ab/local-reader.json`, and `evals/ab/local-worker.json` is not recaptured or reshaped.
3. *"Portulan: is one reading turn all eight screen questions, or a single harder question?"* —
   **"All eight"**. A reading turn is one pass of the eight screen questions, each its own call, and it
   passes only when all eight are right.
4. *"Portulan, last ruling: keep the reading check in the default screen, or only when asked for?"* —
   **"Keep in default"**. `eval` keeps `read` in its default task set.

---

**Provenance.** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/issues/678` — the trial
and the four asks; [#583](https://github.com/sleepy-panda-srl/portulan/issues/583) for the cost of a
call.

**Retire when.** A reader record is captured and ruled on, so the skill names reading supported or
drops it, or the use is demoted under clause 3.

**Decision.** Marius Cetanas — accepted, on 2026-11-20, by his answers under *What was ruled*. The rule
is the draft's, its record of its own as the draft proposed, after his second question was answered
twice.
