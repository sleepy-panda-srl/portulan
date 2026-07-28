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
outside. Recorded in the gate map's honest-holes list — by description rather than by ordinal, because
#61 landed a hole of its own the same day and every number in that list moved — and printed by `compile` as a note
on every run rather than left to be inferred from an absence.

**`git` is deliberately outside the table**, though `git checkout -- docs/vision.md` overwrites the file.
Covering it means gating `git diff docs/vision.md` in the same stroke. Named in both carriers rather than
left inside "any writer outside the table", because it is the likeliest escape a session here would take.

## The wiring line that changes no artifact

`matchers.add("Bash")` for a write gate. Without it the runner is never invoked for a `Bash` call and the
whole shell half is a matcher nothing reaches — the manifest-field-that-loads-nothing defect, arriving as a
matcher this time. It changes **nothing** in this repository's `.claude/settings.json`, whose policy already gates
shell commands, which is exactly why its absence would not have been noticed here. Asserted against a
policy carrying only a write rule.

## Observation

Runner: five payloads on stdin. The three write spellings each returned `deny` carrying the rule's own
sentence; `cat docs/vision.md` and `git status` produced no output and exit 0 — the runner stepping aside,
which is the control that distinguishes *refused* from *refuses everything*.

**The host half stopped being inferred, twice, by accident.** This handoff said "inferred, not shown" for
one draft. Then the supervisor's own scratch script (`printf … > …/docs/vision.md` under `/private/tmp`)
was refused by the host with verbatim `gate.mjs` output — a string no permission rule can produce, since
the deny list holds only `Edit`/`Write`/`NotebookEdit` — and the implementing session hit the same refusal
on an inline `node -e` probe. So the host **does** invoke this hook for `Bash`, and both the decision and
the sentence reach the agent. Both were also false reds, which is the coarse direction this design chose
deliberately, met in the wild inside an hour.

## What the supervisor checkpoint changed

**Verdict: PASS WITH FIXES**, on DoD condition 4 — the published hole list was wrong. Four entries, five
missing, and the plainest of them a **newline**: `git status\ncp /tmp/x docs/vision.md` folded into one
segment whose head was `git`, so the entire table half fell through while the redirection half kept
working and the coverage looked alive. Also missing: a writer behind `{`, `then` or `do`; `docs/./vision.md`
and `docs//vision.md`, which no tail comparison matches; and `rm -rf docs`, which destroys the constitution
by destroying its container. All five are now closed and asserted, and each was mutation-tested — break the
guard, watch the right tests go red.

Two code comments stated reasons that measurement contradicted (a quote branch and a `<` branch each
defended by a hazard that cannot occur); both rewritten to the reason that actually goes red. Two branches
had no test at all — an unchecked branch in a security matcher — and now do.

**And it found the sibling.** The *shell* matcher had the identical defect one action kind over:
`ls && git push --force origin main` reached no gate, because the match was a prefix on the whole command
string. Every Gated outward action here — merge, publish, release, repo delete — was defeated by typing
anything in front of it. Fixed in the same stroke per the standing ruling on defect classes; the control
that `--force-with-lease` stays **Auto**, mid-line or not, is asserted.

**Then the fix bit its own author.** Once a newline separated commands, every line of a heredoc body became
a segment — and the commit closing the newline hole was **refused by the gate it was adding**, because its
message quoted `cp /tmp/x docs/vision.md` as the escape being fixed. Heredoc bodies are now skipped: a body
is text being written, not commands being run, so reading it as commands was simply wrong. The opening line
still gates and anything after the terminator still counts, both asserted.

The lesson worth keeping is not that the holes were fixed. It is that a hole list is a claim like any
other, and nothing checks it except somebody attacking the matcher instead of reading it — and that a
coarse matcher's false reds land on the people doing the work, which is how this one got measured.

## State

Seven recipes green, suite **442** — 378 when this handoff was first written, 309 on `main` before the
change, 350 before the supervisor checkpoint. `.claude/settings.json` is byte-identical, so
`verify/compile.sh` is green with no artifact change.

The gap between 378 and 442 is the review, and it is the part of this record worth keeping. Fourteen
Copilot rounds found **three further live bypasses of the constitution gate** — a wrapper that was not
first on the line, a CRLF continuation, and an escaped quote closing a run early — each one a spelling the
supervisor checkpoint's own attack pass had not tried. Three of them were the `write` branch missing a fix
the `shell` branch had already received, which is the defect class this handoff cites two sections up while
demonstrating it. A hole list is only ever checked by somebody attacking the matcher; that held for the
checkpoint, and it held again for a reviewer after it.

Open PRs [#53](https://github.com/sleepy-panda-works/portulan/pull/53) and
[#55](https://github.com/sleepy-panda-works/portulan/pull/55) touch all five of these files and will
conflict textually — neither changes `matchesRule`'s body, only its call sites, so nothing here duplicates
them; whichever lands second rebases.
