# Prohibited — why, and the shell half

> The rest of the gate map's [Prohibited tier](../gate-map.md#prohibited--what-no-yes-makes-acceptable). The tier's rules
> are in the index; nothing here restates them.

## `self-certify-a-checkpoint`, composed

**Neither backend compiles it**, for the reason
[`0019`](../proposals/0019-the-development-cycle-is-doctrine-not-anecdote.md) states outright: *no permission
rule can observe whether the context reading a checkpoint skill has already seen the work*. The clearest
instance in this file of a gate that is doctrine and habit and nothing else. _Listed here as of
2026-08-13, for the same reason as `commit-without-the-hooks` and found in the same pass._

## `edit-the-constitution`

_Why this is a prohibition rather than simply the Gated tier: every other change in this repository is
graded against that file. An agent that can edit the standard it is judged by can launder any other
change past its own grader, and the gate stops meaning anything._

Since milestone 4 this is a tier of its own — `prohibited`, not `gated` — in both [`gates.json`](../gates.json)
and, as of the same session, [`../../core/operating/autonomy.md`](../../core/operating/autonomy.md). The distinction is load-bearing rather than decorative. Gated means *approvable
per action* and compiles to a prompt; prohibited means *no approval exists* and compiles to a flat refusal.
A three-tier policy would have had to file this under Gated, and the compiler would then have emitted a
prompt — turning "no agent edits it, ever" into "no agent edits it unless someone clicks yes". Found at the
session-open checkpoint, before the schema was written, by a supervisor counting the classes in this file
against the three the implementer had planned.

### The shell half, and why the strongest rule here had the weakest layer

**A `write:` rule names a path, not a tool** — and for one milestone it reached only the tools that carry a
`file_path`. `Edit`, `Write` and `NotebookEdit` were denied; `echo x >> docs/vision.md` through `Bash` was
denied by **neither** layer, because the permission rule rejects the tool and the shared matcher fell
through to *false*. The rule's own sentence is what that cost: an agent that can edit the constitution can
launder any other change past its own grader, and within a session nothing local stopped it. The platform
floor still refused it at the merge — but the floor is a rail for what *lands*, not for what an agent does
to the file it is graded against while it works.

Closed by giving the `write:` action a shell half in the matcher both halves of the compiler share,
[`../../cli/compile.mjs`](../../cli/compile.mjs). It recognises two things and no more:

- a `>` or `>>` **redirection** into the path, and
- a **named table** of file-writing commands naming it — `cp`, `mv`, `ln`, `rm`, `tee`, `dd`, `install`,
  `truncate`, `shred`, `patch`, plus `sed`, `gsed`, `perl` and `ruby` under an in-place flag — or naming a
  **directory the path lives in**, because `rm -rf docs` destroys the constitution as thoroughly as
  `rm -rf docs/vision.md` does, and a gate decided by a trailing slash is not a gate.

Both halves read the line the way a shell does, which took a second pass to get right: commands are
separated by `;`, `&&`, `|`, a subshell, **and a newline**, and a writer hiding behind `{`, `then` or `do`
is still a writer. The first version treated a newline as ordinary whitespace, so the plainest spelling
there is — two lines, the write on the second — folded into one command whose head was `git status` and
reached nothing. A **heredoc body** is skipped, because it is text being written rather than commands being
run; the line that opens it still gates, and so does anything after the terminator.

A table rather than a parser, for the reason the floor backend's own recognition is a table: a limit a
reader can measure beats a matcher clever enough to be wrong quietly. **`git` is deliberately not in it**,
though `git checkout -- docs/vision.md` and `git restore` both overwrite the file — the head of those
commands is `git`, so admitting it would gate `git diff docs/vision.md` and `git log` alongside them, and a
gate on reading the constitution is a rule this policy does not declare. It is the likeliest uncovered
writer in this repository, so it is named here rather than left inside "any writer outside the table".

**Reading the file through a shell is untouched** — `cat`, `grep`, `sed -n` and `git diff` all pass — because reading it is Auto here, and a
matcher that contradicts a declared tier is worse than one that admits a gap. In the other direction the
matcher is deliberately coarse: it fires on *any* argument of a writing command, so `cp docs/vision.md
/tmp/backup` is refused although it only reads. Argument grammars differ per command, so "the last word is
the destination" is true of a subset only, and being wrong about it is a false green on the one file that
must not change.

**This half is the hook's alone, and so it fails open with the hook.** No permission rule stands beside it,
and that is not an omission: `Bash(prefix:*)` matches a literal command *prefix* while the path sits at an
arbitrary position in the command, so that DSL cannot express *any command writing this file*. The patterns
that would fit — `Bash(cp:*)` — gate the utility rather than the path, which is a far larger rule than this
policy declares. So the strongest tier in this file has, in its shell half, the weaker of the two layers.
`compile` prints that on every run rather than leaving it to be discovered.
