# 2026-09-01 — the mode that published the most checked the least

**Milestone 8, triage on `cli/ab-run.mjs`.** [#387](https://github.com/sleepy-panda-srl/portulan/issues/387),
the only **Now** on the board from #386's batch. No clause moves, no agent was run,
`evals/ab/baseline.json` was neither edited nor re-captured, and `evals/ab/baseline.md` is
**byte-identical** — `git diff origin/main -- evals/` is empty.

## What was wrong, measured rather than read

Three paths publish. They checked unequally, and the ordering was exactly backwards:

| path | publishes | checked |
|---|---|---|
| `--verify` | nothing | shape + `verify()` + byte-compare |
| `--write` | the register | **shape only** |
| `--matrix` | **the capture AND the register** | **no shape, no verify** |

Reproduced: a capture recording `operatorEnv: "host"` with one forged nonce **published at exit 0** and
red two ways on the very next command. A real `--matrix --k 3` against a stub agent published a register
reading *"**k:** 3 per cell, ruled by the maintainer 2026-08-31"* — **a ruling attributed to him that he
did not make**, on the path that never asks.

## The deeper defect, and why #386's audit was blind to it

**`renderRegister()` printed the word `isolated` as a string literal and never read `snap.operatorEnv`
at all.** The one condition `evals/ab/corpus.md` forbids departing from was the one the register asserted
without ever consulting the capture. Not a gap in a check — the document making a claim out of a constant.

**A deletion sweep cannot see this class.** #386's two-way audit measures fields the renderer *reads*, by
deleting them and looking for a changed document. A hard-coded claim does not change when you delete the
field it purports to describe, so `operatorEnv` measured as **inert** and nothing required it. #386's
residue 4 said *"shape is not truth"*; the sharper form it did not name is **the register can assert a
condition it never read.** That sentence is the finding, and it is now in the docblock.

The same defect had a twin one line below the matrix write: `k=5` printed from a literal, so a `--k 3`
run announced k=5.

## The repair

1. **`--write` runs `verify()`.** Shape first, render second, `verify()` third — the ordering is
   load-bearing and is written down, because #377 round 3 shipped the inverse and a malformed capture
   crashed inside the renderer as exit 2.
2. **`--matrix` verifies before publishing the derived half, and never withholds the captured half.**
   The two halves are not symmetric: the snapshot is forty turns of events that do not repeat, so it is
   written unconditionally; the register is a derived claim, and one the tool cannot stand behind is the
   thing it must not publish.
3. **The register renders `operatorEnv` instead of asserting it** — byte-identical when isolated,
   and naming what was recorded otherwise.
4. **The ruled `k` is refused at PARSE**, before the first spawn, not after forty turns were paid for.
5. The matrix prints where its journal is, because the recovery story depends on it and `--into`
   defaults to an unnamed temp directory.

## What the session-open checkpoint changed — APPROVE-WITH-ADJUSTMENTS (11)

**It caught the plan being unfalsifiable.** Every check the plan's *Done when* listed was green **with
and without** the repairs — a diff that changed nothing would have satisfied it in full. Core's
`verification.md` asks for red first, and the plan had skipped it. The four cases were written and
watched fail before a line of the repair existed.

**It measured my predicted mechanism false.** The plan said rendering `operatorEnv` would make it a
BRANCH and add it to `BRANCH_READ`. It does not: a branch that names the value renders `undefined` when
deleted, so it classifies as a **hole** and the derived probe already covers it. Both candidate designs
were measured **in a scratch clone, never in the repo tree** — a checkpoint reads the change under
review and does not edit it. `BRANCH_READ` is unchanged, and the pre-commit checkpoint re-measured that
independently.

**It refuted a sentence about my own design.** I wrote that withholding the register leaves the operator
"the irreplaceable half and no published claim". False: both files are committed, so withholding leaves
the **previous run's** register beside the new capture — a published figure that no longer matches its
own data. That state is now named in the refusal message rather than discovered.

It also weakened my "irreplaceable" premise correctly — the journal already holds the turns — and
found the `k=5` literal, which I had not.

## What the pre-commit checkpoint changed — APPROVE-WITH-ADJUSTMENTS (6 required, 5 notes)

**The centrepiece had no rail, and it proved it by deleting it.** Reverting `--matrix`'s check to `[]`
left all 79 cases here and all 2382 in the tree green — the repair this session's own plan entry leads
with could be removed in silence. That is this session's thesis (*a rail a publishing path does not run
is not a rail*) turned on the change that argues it. Fixed by giving the publish step its own carrier,
`publishMatrix()`, because `run()`'s matrix arm needs a repo root, a credential and forty arm
constructions before it reaches the publish decision — **a rail that cannot be run is not one either**.
Four mutations now fail it: reverting the check, flipping the return, dropping the journal line, and
forcing the stale-register branch.

**Two of my own comments asserted mechanisms the code does not have** — inside the change whose subject
is exactly that. One said a `host` capture "can no longer reach this line at all"; measured, it reaches
it three times per `--write` and is merely never *written*. The other declared an ordering
"load-bearing" that is free: `verify()` calls `verifyShape()` itself, so the two can be swapped with
byte-identical output. The edge that IS load-bearing — shape before the *unguarded* render — is now the
one named, so the next maintainer defends the real constraint.

**And the withholding message asserted a state it never read**, at a site this change had just added:
it announced a stale PREVIOUS register even when none existed — the same class the change repaired one
function up, in `--verify`'s remediation string. Conditioned, and railed.

It also caught `--help` still advertising `[--k <n>]` after the parser stopped accepting it, a
`--k` case whose safety rested on the behaviour it was asserting (it would have spawned 24 real turns if
the pin regressed on a machine with a token exported), and a countable claim in a comment that was
wrong — *"the two places `K` is quoted"*, where there were four.

## Filed rather than fixed

[#396](https://github.com/sleepy-panda-srl/portulan/issues/396) — the `ab-run` drill's comment claims
its `operatorEnv` perturbation *"forces the arithmetic"*, which it never did: the fold is independent of
that field. Pre-existing, and newly visible because repair 3 makes the same perturbation trip the byte
compare too, so the drill now produces two findings where the comment claims one and neither is the
arithmetic.

`parse()` accepts `--agent ""`, and `agentVersion("")` then throws Node's `ERR_INVALID_ARG_VALUE`
rather than a `CouldNotRun`, so the run exits 2 with a stack trace. Pre-existing, out of this class, and
three lines from the money-spending path.

## Evidence

26 recipes green, run rather than printed. `cli/ab-run.test.mjs` 74 → **82**, four red before the repair and
three more added at pre-commit, each mutation-checked. `ab-run` forced red with `--working-copy`, tell — *"no baseline may be recorded under an
unisolated arm"* — intact, which matters because repair 1 changes which check reaches it first.
Seam scan clean.
