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

**One clause of row 8: (a), adversarial fixtures per compiled gate.** Landed 2026-08-24.

```
evals/goldens/gates/<rule-id>.json      one fixture file per rule in the yielded gate policy
```

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

### What this rail does NOT establish

**Adequacy.** It is a **presence floor**: a rule that compiles to a matcher and carries no fixture is
red, so a gate cannot reach the compiled policy with no adversarial thought recorded against it. But
one trivial happy-path fixture per rule satisfies that while proving nothing, and no check can tell the
difference — whether a corpus is a real attack is a reviewer's judgement. The runner prints this limit
on every green rather than letting the exit code imply more than it means.

The **exemption** is the obvious way to dodge the rail: write the next gate `none`-shaped and it needs
no fixtures. So every exempt rule is named in the output on every run, the way `compile --matrix` prints
its own refused rules.

### What it found on its first run

A hole nobody had recorded: **a rule whose target is the whole repository (`./`) matches nothing at
runtime.** `matchesPath` reduces `"./"` to the empty string and then refuses the empty string, so
`edit-on-a-working-branch` and `read-anything-in-the-repository` answer false for every input. Nothing
is mis-enforced today — both are `auto`, and neither layer ever asks — but a **gated** rule written
that way would compile to a permission rule covering the tree and a matcher covering nothing. Now
entry 8 of [`../.portulan/gate-map.md`](../.portulan/gate-map.md)'s honest-holes list, and asserted here.

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
- **(b) Mutation testing over both matchers, and grammar-aware fuzzing over the shell segmenter** —
  arrives in milestone 8, a later session. This corpus is its kill-set and is the reason (a) came first.
- **(c) Review-loop metering** — rounds per pull request, pushes per round, empty-round rate. Arrives
  in milestone 8, a later session. The *110 rounds over 30 pull requests* figure that bounds the review
  loop was measured by hand and nothing checks it.
- **(d) Scheduled forced-red drills** — every rail forced red on a calendar and required to fire.
  Arrives in milestone 8, a later session. The three drills run against this recipe on 2026-08-24 were
  run by hand, in a session, and recorded in that session's handoff — which is the state (d) exists to
  replace.
- **"From milestone 8, releases carry an eval result"** ([`../docs/plan.md`](../docs/plan.md), Protocol
  → Versioning) — a milestone-8 carrier that is not one of row 8's eight clauses. Unassigned as of
  2026-08-24; it belongs to a later session or to the maintainer's release procedure.
