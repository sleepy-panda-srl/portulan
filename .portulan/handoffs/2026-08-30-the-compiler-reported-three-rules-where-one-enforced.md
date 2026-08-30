# Handoff — the compiler reported three rules where one enforced

**Date:** 2026-08-30 · **Off the milestone row. Full lane.** Implementer: Opus 5.
**Closes** [#373](https://github.com/sleepy-panda-srl/portulan/issues/373), filed from a finding made in
passing during M8 session 6b.

## What landed

[`cli/compile.mjs`](../../cli/compile.mjs)'s Claude Code backend emits **one** permission pattern for a
write-kind gate — `Edit(path)` — where it emitted three. The hook matcher set is **untouched** and still
carries `Edit`, `Write`, `NotebookEdit` and `Bash`. `.claude/settings.json` regenerated. **23 recipes
green; no milestone row moves.**

## The defect

Claude Code **2.1.240** prints on **every** start of this repository:

```
Permission deny rule (.claude/settings.json): Write(./docs/vision.md) is not matched by file
permission checks — only Edit(path) rules are. Use Edit(./docs/vision.md) instead (Edit rules
cover all file-editing tools).
```

and the same for `NotebookEdit(path)`. The emit loop ran over `WRITE_TOOLS`, so `edit-the-constitution`
compiled to three deny rules and the host matched one.

**The gate held throughout.** `Edit(path)` binds and the host states it covers all file-editing tools,
so this was never an open hole. What was wrong is that the compiler's own accounting reported three
rules compiled where one enforces — [`a-stated-enforcer-must-be-the-real-one.md`](../memory/a-stated-enforcer-must-be-the-real-one.md)
— and warned a reader on every start.

## Two things the session-open checkpoint measured that I had wrong

**It is not a `deny`-only defect.** I had scoped it to `deny` and written *"whether the host treats
`ask` the same was not measured"* into the plan as a limit. The checkpoint measured it: the host prints
the identical refusal for an `ask` rule, and [`cli/compile.mjs`](../../cli/compile.mjs) picks the
destination array **before** the shared per-tool loop — so a fix scoped to `deny` would have left the
defect live for any adopter with a `gated` + `write` rule. This repository has none, which is exactly
why it needed a fixture rather than an observation. There is one now.

**`hookOnly` would have been a false claim, in the weakening direction.** My plan proposed moving the
two dropped patterns there and then argued against itself; the checkpoint settled it by measurement
rather than by argument. With `Edit(path)` **alone** in `deny` and `Write` allowed, the host refused the
write; the control writing a different path succeeded. So their coverage is carried by the **permission**
layer and does not fail open with the hook — while `hookOnly` is documented as *"coverage the permission
DSL cannot express, carried by the hook alone"*, and sits beside a note saying that half **fails open**.
Filing them there would have understated the enforcement. The fact went on `notes` instead, version-stamped.

## The invariant this turns on, which nothing pinned

`matchers` and `emitted` are **two consumers of one constant**, and only one changes. `matchers` drives
the `PreToolUse` hook, where all three tool names genuinely arrive and `matchesRule` answers for each.

**A fix that narrowed both would have passed the entire suite and the `compile` recipe** — the
byte-compare is against the artifact the same change regenerates, so it agrees with a narrowed output,
and the `mutants` corpus grades `matchesRule` rather than the artifact. Measured: before this change the
only matcher assertions were `PreToolUse.length > 0` and *some matcher is `Bash`*.

Both new invariants were **forced red** before being believed: reverting the narrowing reds the pattern
cases, and narrowing `matchers` alongside them reds the matcher-set case.

## What was NOT swept, deliberately

`WRITE_TOOLS` keeps all three names — its `matchesRule` consumer needs them, and the `mutants` operator
anchors match its literal declaration. The record layer keeps the old shape as history: the 2026-07-28
write-gate handoff and M8 6b's both describe a three-pattern emission and are excluded from the carrier
rails.

## What is not established

**Which host version began discarding them.** Present at 2.1.240; the compiler has emitted three since
milestone 4 and no earlier version was re-measured. The note the compiler now prints carries its
version and a re-measure mandate, because if a later host stops treating `Edit` as tool-general this
gate narrows to one tool **with nothing here going red** — the artifact would still be correct-looking.
That is the standing hazard this change introduces in exchange for honest accounting.

**It runs backwards too, which the first draft of this paragraph missed.** On a host that honoured all
three patterns and did *not* treat `Edit` as tool-general, this narrowing **removes two working
permission rules**. `compile` is a tool every adopter runs, so that reaches past this tree. Both
directions are now on the note the compiler prints, and the whole dependency is
[`../gate-map.md`](../gate-map.md)'s **hole 9** — because a pre-commit checkpoint pointed out that this
repository keeps a register for exactly this shape and the change had written to only one of its two
carriers.
