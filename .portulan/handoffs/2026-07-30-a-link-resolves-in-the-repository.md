# Handoff — a link resolves in the repository, and the loop runs from the feed

**Date:** 2026-07-30 · **M6, session 2** · Branch `m6-a-link-resolves-in-the-repository`, opened as
[#129](https://github.com/sleepy-panda-srl/portulan/pull/129) against `main`

**State.** Milestone 6's fourth clause — *a Sleepy Panda product task runs the full loop from a
private-feed install* — is **demonstrated** for Portulan. The task was
[#121](https://github.com/sleepy-panda-srl/portulan/issues/121), and every one of the five phases was
governed by an artifact the private feed delivered, against session 1's one phase. **The row still does
not close:** the maintainer ruled the same day that *both* products must run, so a Tipar API task is owed
and its repos card, affordances and gate deltas are owed to whoever runs it. **Milestone-close therefore
did not run**, and could not — it grades a merged tree.

Supervision: session-open APPROVE-WITH-ADJUSTMENTS (6), all folded; pre-commit APPROVE-WITH-ADJUSTMENTS
(10), all folded. Both checkpoints read their skill out of the feed's install cache. Eight recipes green.

## What the clause actually needed, and why session 1 could not claim it

The clause is about the **loop**, not the task. So the question was never "which task" but "which layer
governs each phase", and the answer had to be the feed's for all five:

| Phase | The feed artifact that drove it |
|---|---|
| Research | `products/portulan/product.md` · `repos/portulan.md` · `memory/` |
| Plan | `skills/session-open/SKILL.md` + `personas/supervisor.md` → A-W-A (6) |
| Implement | `gate-map.md` — which actions had to be surfaced · `principles.md` |
| Verify | `skills/pre-commit/SKILL.md` → A-W-A (10) · `verify/workspace.sh --pack-root <feed pack>` |
| Learn | `dod.md` conditions 3 and 5 |

Session 1 had the verify phase only, and said so at that altitude deliberately. The pin was **re-hashed
here rather than inherited**: six of six files identical to `git show 5a707e3:packs/rituals/checkpoints/…`.

## Decisions + why — the reasons are the payload

- **The resolution domain narrowed; the enumeration domain did not, and that asymmetry is the design.**
  `links` now resolves against `git ls-files --cached` while still *scanning* `--cached --others
  --exclude-standard`. The two lists want opposite directions: scanning a file that is not committed yet
  can only find more defects, while resolving against one can only hide them. The first draft used the
  wide list for both, and the session-open checkpoint refused it on the strongest available ground — the
  memory record's own retirement condition says *"the divergence is unavailable"*, and under the wide list
  the untracked channel keeps diverging, so the record could not honestly retire. **Measured before it was
  chosen:** 0 of 1,382 relative targets in this tree resolve via `--others`, so the narrowing costs nothing
  today. What it costs tomorrow is a red until you `git add` — and that arrived within the hour, on this
  session's own new memory record, with the message naming the repair.

- **One defect, seven faces — and only one of them was reported.** #121 named the empty directory. Asking
  what *else* answers "is this on my disk" produced six more, each measured green-before and red-after:
  ignored paths, wrong-case files, wrong-case directories, untracked paths, an escape that re-enters
  through the absolute filesystem, and an absolute target from a root-level document. The wrong-case one
  was **already recorded in this repository as a known false green, with this exact repair named**, and had
  sat three days. That is the session's most generalizable finding and is now
  [`a-recorded-limit-is-not-a-managed-limit`](../memory/a-recorded-limit-is-not-a-managed-limit.md): a
  limit in prose is documented, not queued. Its own rule was applied to itself — the two limits this review
  surfaced were **filed** ([#130](https://github.com/sleepy-panda-srl/portulan/issues/130)) rather than
  only written down, and so was the `doctor` sibling ([#131](https://github.com/sleepy-panda-srl/portulan/issues/131)).

- **The memory record is NARROWED, not retired, although its retirement condition was literally met.**
  Retiring a rule because its *detector* improved would leave the doctrine claiming the incident cannot
  happen. It still can: `vendor` mode ships `.portulan/` to hosts that run no recipes at all, and the
  naming repair stands on an argument no check makes true or false — a link asserts a resolvable target,
  while a declared location may legitimately not exist yet. The withdrawn advice is **struck rather than
  deleted**, because the reasoning behind a discarded control is what a later reader cannot reconstruct.

- **`doctor`'s claim resolution is the same class pointing the other way, and was deliberately left
  alone.** A false *red* on a gitignored path rather than a false green. It is a tested JS tool with a
  different repair — and its complication is real: it validates workspaces that may not be inside a git
  repository at all, so "tracked" is not always answerable and *unverifiable* is the honest third answer.
  Bundling an unforced validator rewrite into a milestone-close diff is how a close acquires a defect
  nobody asked for. Filed, not folded.

- **The feed's rail: a missing `--pack-root` is exit 2, never a red.** `index --check` without a root fails
  on the *pack*, which reads as "your index is wrong" when the truth is "I could not look" — and it would
  name the one file that is not at fault. The recipe also refuses to report GREEN on `doctor` alone, because
  a green over a check that did not run is the defect this project names most often. **A version bump rode
  the content change** (`0.1.0` → `0.1.1`): an install is resolved and cached by the manifest's version
  field, so leaving it would have made refresh behaviour a question nobody had measured. Now measured —
  both versions cached, the recipe green *run from the install*.

## What went wrong in here

**The private feed's scope index had been stale since hours after it was published, and no rail anywhere
could have said so.** Found in the research phase by running `index --check` against the feed rather than
reading session 1's record of it: exit 1 on the clone and on the install cache. The digest was right
(`41216e14`) and the *rendering* was the markdown-link form CI forced out of the generator later that same
day. The digest being genuinely correct is what made it look settled — `m06.md` says the index "was
regenerated … and the equality re-derived on both carriers", which is true of the digest and false of the
file. **The reason it went unseen is worth more than the file:** `.portulan/verify/index.sh` names
`WORKSPACES=(.portulan examples)`, the feed's workspace is not in this repository to be named, and the
feed's own recipe ran `doctor`, which never reads a generated file's contents. So the split that makes the
feed private put its one generated artifact outside every rail — [#122](https://github.com/sleepy-panda-srl/portulan/issues/122)'s
stated cost arriving in the one adopter with no rail to report it. Errata appended to the merged record
with the original sentence left standing; feed repaired and railed under the maintainer's gate approval.

**Three defects inside the change, none found by reading it.** The diagnosis was misaligned while the
count was perfect — awk emitted an empty middle field, tab is IFS whitespace in bash so a run of two tabs
reads as one delimiter, and every field after it shifted left, so three of seven reds named the wrong
repair. **A drill asserting the number would have passed; this one asserted the message.** The diagnosis
arm had no fallback, so an unknown code would have reused the previous iteration's `note` and attached one
link's explanation to another's line. And the check **caught its own documentation**: the first draft of
the new Known-limits bullet wrote its two example targets as real link syntax and turned `docs.sh` red on
`README.md:767`, because this check scans raw text and backticks exempt nothing — the same trap
`a-generated-file-must-not-point-at-what-git-cannot-carry` records two drafts of *itself* falling into.

**Two false reds the change would have introduced, both caught by the pre-commit checkpoint attacking it
rather than by any run, and neither reachable from a path this tree carries.** `git ls-files` C-quotes
non-ASCII paths, so a committed `docs/naïve.md` would have been reported untracked with `git add` unable to
discharge it — and the `map` check, which shares the enumeration, would have reported a top-level entry
named `"docs`. And `normalize()` conflated "walks off the root" with "lands on the root", so `./` and `../`
were red with a confidently wrong reason. **Fourth consecutive milestone in which a fresh context found a
hole by trying to get past a mechanism rather than reviewing it.**

## Round 3, and the one place the bound was overridden — by him, not by me

Copilot's round-2 **suppressed notes** carried two findings, both correct. Under
[`a-review-loop-needs-a-bound`](../memory/a-review-loop-needs-a-bound.md) rule 3 a note in a review *body*
is never a reason to push, and rule 4 sends the post-two-round remainder to an issue, so both were triaged
to [#132](https://github.com/sleepy-panda-srl/portulan/issues/132) and **not** fixed — with the residue
named out loud, because one of them was a `dod.md` condition 4 breach being merged knowingly on
[#110](https://github.com/sleepy-panda-srl/portulan/pull/110)'s precedent. **The maintainer then said to
fold both in**, which is the right way round: the bound is his to lift and the decision was put to him
rather than taken. Both are now fixed and #132 closes on this merge.

- **A protocol-relative URL is skipped rather than diagnosed.** `//host/path` begins with `/`, so it reached
  the absolute-path arm and was told it should have been relative — nonsense about a link that leaves the
  repository. Not a regression: the old test resolved it as `<dir>///host/path` and went red too. What was
  new was the confident wrong *reason*, which is this change's own class.
- **The `normalize()` comment was wrong where the code was right.** It claimed `./`, `.` and `../` from a
  child directory all name the root. Only `../` does; `./` and `.` normalise to the child directory and
  resolve through the **prefix** rule. The comment now spells the distinction out instead of illustrating
  it, since illustrating it is what went wrong.

**That makes three-of-a-kind in one change, and the pattern is the finding:** a headline that argued with
three of its own findings, an affordance sentence that overclaimed the guarantee, and a comment that
misdescribed the function above it. **Every count in this change was correct and three sentences about
those counts were wrong.** Mechanisms were attacked and held; prose about mechanisms was not, three times.
The cheap generalisation — a claim about what a mechanism does is worth re-deriving from the mechanism,
exactly like a figure — and the reason it is worth writing down is that two fresh-context checkpoints and
a drill all passed over sentences whose adjacent code they had just verified.

**The rebase, which is precedent rather than judgement.** [#119](https://github.com/sleepy-panda-srl/portulan/pull/119)
merged under this branch, so it went `DIRTY` on exactly the two files that always conflict:
`docs/plan.md`'s log tail took **both** entries with this branch's last, and `handoffs-index.md` was
**regenerated**. Worth noting from the merged entry rather than from memory: #105's count settled at
**five** rounds, not four — the fresh-context pre-commit on #119 caught that `08d7d10` answered inline and
was never a reviewed head — and #105's body now carries **two** errata blocks, so the outward obligation
this session inherited is discharged.

## For the next session

**Two things stand between milestone 6 and its close.** First, **a Tipar API task through the full loop** —
the maintainer's ruling of 2026-07-30 is that *both* products run, so the row's singular "a … product task"
is satisfied by Portulan and the close is not. Tipar's card is sealed and names exactly what is owed: a
`repos/` card with build/test/run lines true of the tree, `products/tipar-api/affordances.md`, and whether
its gates differ from the portfolio defaults. Until those exist a task on Tipar cannot honestly be called
done, and the card says so. Second, **the close itself**, which needs the merged tree and its own session.

**What the close must RE-OBSERVE rather than read off a green** is unchanged and now has a corollary this
session honoured: *present and empty* has no standing rail and can have none, so it is a session-time
measurement — and **nothing may write a record into the landed supervisor location**, because that would
destroy the observation. Both landed locations are absent right now, which is the designed fresh state, so
the close must re-run the landing on both carriers rather than infer it.

**One thing the close should not be told is demonstrated:** the new `links` code has never been red in
**CI**. `docs`'s two CI reds belong to the code it replaces. This branch's own run exercises the direction
that matters most — whether tracked-set resolution false-reds on a clean checkout — and it is green.
