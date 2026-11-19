# Proposal 0042 — find-and-quote reading earns its place by a record of its own

**Status. DRAFT — prepared 2026-11-19 for Marius Cetanas. Not accepted; nothing here is ruled.**
Extends [`0039`](0039-a-local-model-runs-without-the-host-floor-and-under-a-thinking-cap.md) clause 4
(loopback is a rail; routing is earned) to a second use of the earned `code` role: reading one file or
one log and quoting lines from it. Answers [#678](https://github.com/sleepy-panda-srl/portulan/issues/678).

**Pull request:** https://github.com/sleepy-panda-srl/portulan/pull/679

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

## What exists, and the gap

Built on the branch this proposal ships with, as an implementation of the issue's runner and screen
asks:

- **`chat` and `summarize` take `--number-lines`**, so an answer can cite lines without a hand-made
  numbered copy; the receipt records `line-numbers=on`. It opens no guard: `summarize` still refuses,
  `transform` refuses the flag, and the numbers count against the input ceiling.
- **`eval --task read`** screens the use: eight one-question calls about two synthetic fixtures that ship
  in `packs/tools/local-llm/screen/read/`, graded with no judgement, three of them absent-item traps,
  passing only when all eight are right. On 2026-11-19 it passed on `qwen/qwen3.8-27b`, 8 of 8 with the
  three traps right, one sample on a loaded machine. **The screen earns nothing.**
- **The skill names find and quote as an operator-selected candidate use**, with its rails, and the
  pack's README states when a reading call pays.

**The gap:** no record supports reading. The captured
[`evals/ab/local-worker.json`](../../evals/ab/local-worker.json) measured `code` on a transform-shaped
task, and is captured once over exactly three tasks; `eval --ab` refuses `--task`. Until a record is
earned, the use can only be described as a candidate, which is what the skill now does.

## Proposed rule

1. **Find-and-quote reading is a use of the earned `code` role that is earned on its own record.** The
   skill may call it supported only where an A/B record of reading qualifies under the rule the
   local-worker record fixed before outcomes: all five local turns pass, all five host turns complete,
   and local passes are at least host passes. A tie at zero earns nothing.
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

## Enforcement — the record, and what would capture it

**A record of its own, not an extension of `local-worker.json`.** Extending that record would change
its matrix, its prompts' fingerprint and its turn count, all of which `eval --verify` checks; it is
captured once, so extending it means recapturing all three earned cells and paying their fifteen host
calls again. A separate `evals/ab/local-reader.json` with its generated register `local-reader.md`
leaves the earned record untouched.

Its shape, for ruling (question 2):

- **One task, two arms, `k = 5`.** Arm L is `--role code` at `--effort low` on loopback, with a seed per
  turn as today. Arm H is the host agent through `--host-cmd`, under the same refusals the local-worker
  capture applies.
- **A turn is one pass of the eight screen questions**, each sent as its own call, graded by the
  screen's `gradeReadAnswer`; a turn passes only when all eight are right. Arm H is therefore forty paid
  host calls, each leaving the machine.
- **`eval --verify` gains the reading record**: shape, seeds, every completed question regraded by the
  predicate as it ships, the questions' and fixtures' sha256 fingerprints, the fold, and the register
  byte-compared; the `ab-run` recipe runs it without a model, as it runs the local-worker record's.
- **`EARNED_ROUTING` gains a reading entry** derived by `cli/local-routing.mjs` from the record, and
  the skill moves from "candidate" to "supported" only in the change that commits a qualifying record.

**What is built today, and what is not.** The screen's questions, fixtures, numbering and grader are
built and are what a capture would grade with. The capture path is not built: the gate map starts an
idea that adds a surface as a proposal, and a second captured record is one. After a ruling, the
capture machinery is one implementation change, and the capture itself is the maintainer's step, run
once on the machine that holds the host's sign-in. The command it would add, which **does not run
today** (`--ab` refuses `--task` with exit 2):

```bash
node packs/tools/local-llm/runner/local-llm.mjs eval --ab --task read --k 5 --seed <seed> \
  --host-cmd "claude --print --model <host model> --max-budget-usd <ceiling>" \
  --host-model <host model> --write
```

## Questions for the maintainer

1. Is find-and-quote reading a use to earn at all, or should it stay an operator-selected candidate
   with no record?
2. If earned: a record of its own as above, or a recapture of `local-worker.json` with a fourth task?
3. The turn: one pass of all eight questions (forty host calls), or one question per turn with fewer,
   harder questions?
4. Whether `eval` should keep `read` in its default task set (it does on this branch), or run it only
   under `--task read`.

---

**Provenance.** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/issues/678` — the trial
and the four asks; [#583](https://github.com/sleepy-panda-srl/portulan/issues/583) for the cost of a
call.

**Retire when.** A reading record is captured and ruled on, or the use is declined and the skill drops
it.

**Decision.** Pending: Marius Cetanas.
