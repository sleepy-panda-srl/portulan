# evals/

Milestone 8's home: golden tasks, the A/B harness, and the eval gate that lets a rule change merge or
be rejected on evidence rather than assertion. Row 8 of [`../docs/plan.md`](../docs/plan.md) is the
binding criterion; [`../docs/milestones/m08.md`](../docs/milestones/m08.md) is its legislative history.
This file does not restate either — a rule with two carriers is obeyed at the narrower one.

## First, the word — because it already means something else here

**"Eval" carries two unrelated senses in this repository, and only one of them lives in this
directory.** Both were load-bearing before this directory had any content, so the disambiguation is
written down rather than left to be inferred from a filename.

| Sense | Where it lives | What it is |
|---|---|---|
| **Evaluation as measurement** — golden tasks, A/B, the eval gate | **here**, `evals/` | Does the engine make an agent work better? Milestone 8's subject. |
| **Evaluation as a licensed copy** | [`../cli/eval-bundle.mjs`](../cli/eval-bundle.mjs), [`../.portulan/verify/eval-bundle.sh`](../.portulan/verify/eval-bundle.sh) | A named-recipient bundle cut from a commit under evaluation terms. A commercial artifact, with its issuance ledger kept permanently outside this repository. Nothing to do with this directory. |

The machinery this directory ships is therefore named **`goldens`**, never `evals` — so a reader meeting
`cli/goldens.mjs` beside `cli/eval-bundle.mjs` is not left to guess which sense is which. The directory
keeps the row's own word; the tools take a narrower one.

## What is built today

**Two clauses of row 8, of nine.** (a), adversarial fixtures per compiled gate, landed 2026-08-24;
**(b)**, mutation testing over both matchers and grammar-aware fuzzing over the shell segmenter,
landed 2026-08-25. **Seven remain** — golden tasks per core skill, the A/B baseline, OTel opt-in
config, a rule change merged or rejected on eval evidence, (c) review-loop metering, (d) scheduled
forced-red drills, and a release carrying an eval result. Each is listed below with the sentence
[`../.portulan/dod.md`](../.portulan/dod.md) condition 4 requires.

```
evals/goldens/gates/<rule-id>.json      one fixture file per rule in the yielded gate policy
```

**The filename is checked against the file's own `rule` field**, since 2026-08-24. It was documented
here, printed in the missing-fixture red (*"add `evals/goldens/gates/<rule-id>.json`"*), and enforced
nowhere — so a renamed or misfiled fixture validated cleanly and graded anyway. A mandate nothing
checks is already broken, and this directory was carrying one of its own. Found as a suppressed note
in Copilot round 5 of [#336](https://github.com/sleepy-panda-srl/portulan/pull/336).

Graded by [`../cli/goldens.mjs`](../cli/goldens.mjs), run as the `goldens` verify recipe, on every
pull request. Run it by hand with:

```
node cli/goldens.mjs --workspace . --pack-root packs
```

**Why this clause first.** Not because everything else hangs off it — golden tasks, the A/B harness,
OTel and review-loop metering share almost nothing with a matcher-fixture runner, and claiming
otherwise would be an overclaim of exactly the kind this repository keeps finding. The honest reason
is narrower: clause **(b)** — mutation testing over both matchers and grammar-aware fuzzing over the
shell segmenter — needs this corpus as its kill-set and this fixture format as its output shape. (a)
is load-bearing for (b) and for nothing else in the row.

### What a fixture is

A case is **data**, answered by the compiler's own exported `matchesRule` — the same function the hook
calls at tool time, never a re-implementation. **A case's command string is never executed.** The
corpus contains `git push --force`, `rm -rf docs` and constitution-write spellings by design; there is
no code path from a fixture to a subprocess, and the suite asserts the runner imports no
process-spawning API at all.

Two case classes, and exactly two:

- **`holds`** — the matcher catches this today and must keep catching it. Every one of the eight
  bypasses found *after* [#60](https://github.com/sleepy-panda-srl/portulan/pull/60)'s gate was called
  done is one of these.
- **`documented-hole`** — the matcher does **not** catch this, a named record says so, and the case
  keeps that admission true **in both directions**: if the hole silently closes, the case goes red
  until the record is updated. A hole list that still lists a closed hole is as wrong as one that
  hides an open one.

**Every case records which branch of `matchesRule` it exercises**, and the field is **derived, never
declared**: `matcherPath(kind, tool)` computes it from the rule's action kind and the case's tool, and
the runner refuses a case whose stored value disagrees. Four values — `matchesPath`, `shell-write`,
`shell-prefix`, and `no-branch` for a combination the matcher has no code for. The green prints the
per-path census, including the zeroes, because a corpus can carry two hundred cases and exercise one
branch of four.

It earns its place on one asymmetry: a `then`/`do`/brace-group leader is **caught** on the write path
— `shellSegments` knows `SEGMENT_LEADERS` — and **escapes** on the shell path, where `commandSegments`
does not. One rule id, two segmenters, two answers. Without the field those two cases read as a
contradiction rather than as the asymmetry they are.

Byte-level attacks are stored **escaped** (JSON `\r`, `\u0000`) and decoded by `JSON.parse`.
[`../cli/control-chars.mjs`](../cli/control-chars.mjs) refuses a raw CR anywhere in this tree by
decision, and exempting a growing adversarial-content directory is the allow-list defect that same file
names — so the corpus carries no raw control bytes, and a test asserts both halves: the bytes are clean
*and* the escapes really decode.

## Clause (b) — the corpus is measured against a broken matcher, and the grammar against bash

Two rails, landed 2026-08-25, and they answer two different questions:

```
node cli/mutants.mjs    --workspace . --pack-root packs     the mutation census
node cli/fuzz-shell.mjs --workspace . --pack-root packs     the grammar fuzzer
```

**`mutants` asks whether the corpus DISCRIMINATES.** It breaks
[`../cli/compile.mjs`](../cli/compile.mjs)'s matcher region on purpose — one declared, anchored,
place-exactly-once substitution at a time — and grades each mutant against this corpus. An operator
that the corpus fails to notice is a hole in the kill-set, and the repair is a new fixture: `matchesRule`
is a pure function of `(rule, tool, input)` and a fixture is exactly that triple, so any non-equivalent
mutant is killable by one. A `survives` record is admissible only as a **proof** — semantic
equivalence, or equivalence under the yielded policy — never as a standing note that a gap exists,
which would rebuild the prose hole list clause (a) exists to have replaced.

**It went red on its first run and the corpus lost.** Among the breakages that went unnoticed:
removing `sudo` from the command-prefix table, dropping `..` resolution from path normalisation, and
disabling quote tracking in the segmenter. Every one is a fixture now, and each was derived by
measuring which input distinguishes the mutant rather than by reasoning about it — two were *not*
killed by the spelling that seemed obvious.

_The figures for that first run are dated in
[the session's handoff](../.portulan/handoffs/2026-08-25-the-corpus-lost-and-the-fuzzer-found-a-live-bypass.md),
and the SHIPPED totals are printed by `node cli/mutants.mjs` and `node cli/goldens.mjs`, which are
their one carrier. This paragraph carried "eleven of forty-eight" against a table that had since grown
to fifty-three — a count written before the thing it counted stopped growing, which is this
repository's most-repeated defect and was this session's third instance of it. The pre-commit
checkpoint caught the same figure in the handoff and the repair stopped at the site that was quoted;
Copilot round 2 found the one it missed. Deleted rather than corrected, so the trap is not re-armed
for whoever adds the next operator._

**`fuzz-shell` asks whether the SEGMENTERS answer one grammar.** It composes a command from a grammar
instead of mutating a string, so it knows by construction whether the payload sits where bash would
execute it or where bash would only print it. Positions are enumerated and recorded; **spellings are
fuzzed**, and the invariant is that every spelling of one command in one position gets the same
answer. Every recorded divergence from ground truth cites the record that licenses it.

**The grammar's own ground truth is measured, not argued.**
[`../cli/fuzz-shell.ground.test.mjs`](../cli/fuzz-shell.ground.test.mjs) runs every position under
real bash with a **neutral** payload — never a gated command — and writes every path spelling to a
throwaway file. A grammar that lies about itself produces not a red but a green about the wrong thing,
which is the one failure a fuzzer cannot detect in itself. It caught two.

**It found a live bypass of every Gated shell action.** `bash -c "ls; git push --force origin main"`
answered **false**: the composition tested the raw command's segments and each segment's spellings,
and never a spelling's segments. The write matcher never had the gap, because `shellWrites` segments
again internally — one fix landing in one carrier and not its sibling, between two branches of one
function. Closed the same day, at the class rather than the spelling, with the two-wrapper
counterexample asserted so the unwrap budget stays at one level.

### What this rail does NOT establish

**Adequacy — whether the cases are a real attack.** What the rail checks is **presence**, and the two
are worth separating out loud, because a green looks the same either way:

| The rail answers | The rail cannot answer |
|---|---|
| Does every compiled gate have fixtures at all? | Are those fixtures any good? |
| Does every case still answer as recorded? | Is the case worth answering? |

So a gate cannot reach the compiled policy with **no** adversarial thought recorded against it — and
one trivial happy-path fixture per rule satisfies the floor while proving nothing. The runner prints
this limit on every green rather than letting the exit code imply more than it means.

**Half of that gap closed on 2026-08-25, and the sentence has to move with it.** This section used to
end *"no check can tell those apart"*, and clause (b)'s mutation census is a check that tells part of
them apart: it breaks the matchers on purpose and asks whether the corpus notices. So the right split
is now three ways rather than two — **presence** (the `goldens` rail), **discrimination** (the
`mutants` rail: does the kill-set catch a matcher that has been broken?), and **realism** (whether the
attacks resemble anything an adversary would type), which is still a reviewer's judgement and stays
one. The census is what forced the correction rather than a reader noticing: it went red on its first
run, on 2026-08-25, against the corpus as it then stood — which failed to notice a whole class of
breakages, every one of which is a fixture now.

The **exemption** is the obvious way to dodge the rail: write the next gate `none`-shaped and it needs
no fixtures. So every exempt rule is named in the output on every run, the way `compile --matrix` prints
its own refused rules.

### What it found on its first run

A hole nobody had recorded: **a rule whose target is the whole repository (`./`) matches nothing at
runtime.** `matchesPath` reduces `"./"` to the empty string and then refuses the empty string, so
`edit-on-a-working-branch` and `read-anything-in-the-repository` answer false for every input. Nothing
is mis-enforced today — both are `auto`, and neither layer ever asks — but a **gated** rule written
that way would compile to a permission rule covering the tree and a matcher covering nothing. Now
entry 8 of [`../.portulan/gate-map.md`](../.portulan/gate-map.md)'s honest-holes list, tracked as [#337](https://github.com/sleepy-panda-srl/portulan/issues/337), and asserted here.

Ten of the corpus's own hand-written expectations were refuted by the rail on the same run, which is
the argument for the rail in one sentence.

## What is NOT built yet

Each names where it arrives, per [`../.portulan/dod.md`](../.portulan/dod.md) condition 4 — nothing
here claims a capability that does not exist:

- **Golden tasks per core skill** — arrives in milestone 8, a later session. The three core skills
  ([`../core/skills/`](../core/skills/)) have no fixtures of any kind today.
- **The A/B (Portulan on / off) baseline** — arrives in milestone 8, a later session. No baseline has
  been recorded, and no harness exists to record one.
- **OTel opt-in config** — arrives in milestone 8, a later session. Nothing in this repository emits
  telemetry.
- **A rule change merged or rejected on eval evidence** — arrives in milestone 8, a later session.
  Every rule in [`../.portulan/memory/`](../.portulan/memory/) to date was merged on review alone.
- **(c) Review-loop metering** — rounds per pull request, pushes per round, empty-round rate. Arrives
  in milestone 8, a later session. The *110 rounds over 30 pull requests* figure that bounds the review
  loop was measured by hand and nothing checks it.
- **(d) Scheduled forced-red drills** — every rail forced red on a calendar and required to fire.
  Arrives in milestone 8, a later session. The drills run against the `goldens` recipe on 2026-08-24
  and against `mutants` and `fuzz-shell` on 2026-08-25 were all run **by hand, in a session**, and
  recorded in those sessions' handoffs — which is precisely the state (d) exists to replace. Two
  sessions running them by hand is evidence for the clause rather than a substitute for it.
- **A release carries an eval result** ([`../docs/plan.md`](../docs/plan.md), Protocol → Versioning).
  Arrives in milestone 8, a later session. **This was the row's ninth clause as of 2026-08-24 and was
  nobody's until that day**: the Protocol had carried the obligation since the plan was locked while
  row 8's criterion listed eight deliverables and did not include it, so a close re-deriving the
  criterion clause by clause would have re-derived eight and left it unbuilt. Named here first as
  *unassigned*; the maintainer then ruled it a close condition and it is now in the row itself. What
  an eval result consists of, and where a release carries it, is still open.
