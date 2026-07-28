# Handoff — a `write:` rule named a path and gated three tools

**Date:** 2026-07-28 · **Triage lane, milestone 4 machinery** · Branch `a-write-gate-reaches-the-shell`

`edit-the-constitution` is the one `prohibited` rule in [`../gates.json`](../gates.json), and it did not
cover `echo x >> docs/vision.md`. The permission rule rejects the tool — `Bash` is not `Edit` — and
`matchesRule`'s `write` branch was guarded by `WRITE_TOOLS.includes(tool)`, so it fell through to *false*.
Neither layer held. `sed -i`, `cp` and a `>` redirection were the same story.

The rule's own sentence is what that cost: an agent that can edit the constitution can launder any other
change past its own grader. The platform floor still refused it at the merge, so nothing could **land** —
but the protection was defeated for the length of a session, against the file every other change is graded
against.

## What was decided, and the option that was rejected

A companion `shell:` rule in the policy **cannot express this.** A shell target is a command *prefix*, and
"writes `docs/vision.md`" is not a prefix of anything; the nearest expressible rules — `Bash(cp:*)`,
`Bash(sed -i:*)` — gate the *utility* rather than the *path*, which is a far larger rule than the policy
declares and still misses the redirection. So the `write:` action grew a shell half instead, in the matcher
both halves of the compiler share.

It recognises two shapes and no more: a `>`/`>>` redirection into the path, and a **named table** of
file-writing commands naming it. Reads are untouched, because reading the constitution is Auto here and a
matcher that contradicts a declared tier is worse than one that admits a gap.

## The half with no permission rule beneath it

**This coverage is the hook's alone, and therefore fails open with the hook.** `Bash(prefix:*)` matches a
literal command prefix while the path sits at an arbitrary position, so that DSL cannot express it at all.
It is the first gate here whose only layer is [`../compile/gate.mjs`](../compile/gate.mjs) — a broken hook
removes it silently while the `Edit`/`Write` denials stay standing, so the gate still reads as whole from
outside. Recorded as a fourth entry in the gate map's honest-holes list, and printed by `compile` as a note
on every run rather than left to be inferred from an absence.

**`git` is deliberately outside the table**, though `git checkout -- docs/vision.md` overwrites the file.
Covering it means gating `git diff docs/vision.md` in the same stroke. Named in both carriers rather than
left inside "any writer outside the table", because it is the likeliest escape a session here would take.

## The wiring line that changes no artifact

`matchers.add("Bash")` for a write gate. Without it the runner is never invoked for a `Bash` call and the
whole shell half is a matcher nothing reaches — the manifest-field-that-loads-nothing defect, arriving as a
matcher this time. It changes **nothing** in this repository's `settings.json`, whose policy already gates
shell commands, which is exactly why its absence would not have been noticed here. Asserted against a
policy carrying only a write rule.

## Observation

Run against the **runner**, not a host, and the compile README's table says which. Five payloads on stdin:
the three write spellings each returned `deny` carrying the rule's own sentence; `cat docs/vision.md` and
`git status` produced no output and exit 0 — the runner stepping aside, which is the control that
distinguishes *refused* from *refuses everything*. That the host invokes the hook for a `Bash` call is
**inferred**, not shown; it is the same boundary every row in that table has, and it belongs to a
supervised checkpoint.

## State

Six recipes green, suite 350 (was 309). Rebased onto `bf46153`; `.claude/settings.json` is byte-identical,
so `verify/compile.sh` is green with no artifact change. **No pre-commit supervisor ran** — this session
was told not to spawn subagents, and the checkpoint is the maintainer's to run if he wants one on
enforcement machinery.

Open PRs [#53](https://github.com/sleepy-panda-works/portulan/pull/53) and
[#55](https://github.com/sleepy-panda-works/portulan/pull/55) touch all five of these files and will
conflict textually — neither changes `matchesRule`'s body, only its call sites, so nothing here duplicates
them; whichever lands second rebases.
