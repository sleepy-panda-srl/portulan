# Handoff — every jq filter a workflow runs is exercised

**State.** Branch `every-jq-filter-a-workflow-runs-is-exercised`,
[#64](https://github.com/sleepy-panda-srl/portulan/pull/64), **based on `main`**. It opened stacked
on [#63](https://github.com/sleepy-panda-srl/portulan/pull/63), because the four `--jq` filters it
covers existed only there; #63 merged at 11:22:03Z and GitHub **retargeted this one to `main` by
itself** — the benign half of the stacked-PR trap, which bites only when the base *branch* is deleted
before the base *merges* (#10). Rebased onto `origin/main` afterwards, since `main` had moved two
further commits and refuses a merge from behind it (`strict`, proposal `0011`); the #63 commits dropped
by patch-id. Seven verify recipes green, each read for its exit code; suite 309/309; seam scan clean
across files, commit messages and branch name.

**The rebase was the first unplanned test of the design, and it passed.** #63's rounds four and five
rewrote the middle of `copilot-review.yml` and moved the requested-reviewers filter from line 341 to
370. The recipe followed it with no edit and no red, because no line number — and no copy of any
filter — is written down anywhere in it. That is the property the fixture table was built for,
demonstrated by an event nobody arranged.

**The occasion.** #63's own handoff carried one follow-up rather than smuggling it in: *the regression
harness stubs `gh`, so the workflow's `--jq` filters are executed against null-bearing input only as a
one-off measurement, not by the suite.* This is that follow-up.

**What was actually missing.** Two suppressed low-confidence Copilot comments on #63 claimed
`join("|")` errors on a null element. The claim is wrong — jq renders null as the empty string in
`join`, and errors only on arrays and objects — and it was refused on the pull request with that
evidence. **The refusal was correct and the coverage gap behind it was real:** the evidence was one
measurement, by hand, in a terminal, and the harness that covers the workflow stubs `gh`, so it asserts
the *shape* the filters are assumed to produce — `Copilot||PENDING|7`, `|false` — with nothing anywhere
proving jq produces it. Both are now fixtures, and the recipe runs the filters the workflow contains
rather than a copy of them.

**Decisions + why.**

- **A verify recipe, not a file in `cli/`, and the reason is the third exit code.** The suite is the
  obvious home and `node --test` has two outcomes, not three: a skipped test still exits `0`, so a
  machine without `jq` would report green over a check that never ran — the false green this
  repository has minted five rules about — and a failing test would say the repository is broken when
  only the environment is, which `verify/README.md` records as the failure that gets a whole recipe
  switched off. `2` is the honest answer and only the verify layer has it. Secondary and still real:
  keeping the codes honest inside the suite means adding `jq` to `tests.sh`'s guard, so a machine
  without it could run none of the 309 tests rather than one fewer check.
- **`jq` is the first dependency here that is neither bash, a POSIX utility, nor `node`** —
  `../identity.md` owns that line and now states it. Same test milestone 2 applied to `node`: nothing
  is installed before it runs. It is not the `claude plugin validate` case, which stays out of the
  recipes because it would exit `2` on every CI run — `jq` ships on `ubuntu-latest`, **measured on
  #64's first `workspace-verify` run** rather than predicted: `run through jq-1.7`, green. The runner's
  jq is 1.7 and the maintainer's is 1.7.1, and the 24 answers are identical on both.
- **The filters are never written down.** A copy is a second carrier of one fact that keeps passing
  while the original drifts. A fixture names an **anchor** — a selector saying which program it answers
  for — and the program itself is lifted out of the file.
- **A parse decides, a raw scan audits it**, which is `doctor.sh`'s ordering for `doctor.sh`'s reason.
  The reader handles the one YAML construct it needs, a literal block scalar under `run:`; every jq
  token in the raw file must have been seen inside a parsed scalar, so a scalar ended early by a
  column-0 line — the exact defect #63 records as passing all thirteen lab cases while the workflow no
  longer parsed — takes the count out of agreement and exits `2`.
- **Coverage is checked both ways.** An anchor matching zero programs, or a program no fixture names,
  is `2` and not a verdict: the recipe cannot answer for the file, which is different from answering
  badly. It is what makes a fifth filter added to a workflow impossible to land unexercised.
- **`pr-labels.yml` was covered in the same stroke** — the sibling rule of 2026-07-27, and **the part
  to reject if the expansion is unwelcome.** It is the same defect class one file over, on the check
  that is actually *required* on `main`: `jq -er '.labels[].name'` decides "this policy declares no
  labels" by producing no output (exit 4, measured), and `--jq '.labels[]?.name'` returns nothing over
  a null where `copilot-review.yml`'s `[.users[].login]` is a hard error. **Two spellings of one idea,
  in one repository's workflows, that do not agree** — now stated by fixtures rather than by nobody.

**Observation procedure, all eight measured** on a scratch copy at this commit, jq-1.7.1: output
changed (`join("|")`→`join(",")`) → **red, exit 1**; anchored selector renamed → **2**; a new filter
with no fixture → **2**, printed with file and line; a column-0 line inside the step → **2**, *4 jq
token(s) in the file and 1 inside a parsed run: scalar*; a filter in an uncovered workflow → **2**;
instrument deleted → **2**; `jq` off the `PATH` → **2**, from the wrapper and from the instrument
alone; clean tree → **green, 7 programs, 24 fixtures**. Recorded in `../verify/README.md` under
Provenance, per the 0007 rule.

**Limits, stated rather than left to be found.** This runs `jq`; `gh api --jq` runs **gojq**, the
re-implementation bundled in `gh`, so what is established is these programs' behaviour under jq 1.7.x —
the interpreter the #63 answer was measured with — and a gojq divergence is not covered. `--jq` is
modelled as `jq -r` because `gh` prints strings raw, read off #63's own run logs. And nothing tests
this recipe's reader, which is the sharpest form task `0004` has taken yet: it is the first recipe
carrying logic that can be subtly wrong rather than visibly broken, and what stands behind it is a
second reading of the same file agreeing with the first.

**The review round, under the new bound.** One Copilot round on #64, two inline comments carrying one
true finding: the header promised a byte-for-byte comparison of jq's stdout while `spawnSync` ran with
`encoding: "utf8"`, so the code compared decoded strings. For valid UTF-8 the two agree and nothing was
passing that should have failed — but the promise was wider than the code, inside a recipe whose whole
subject is checks claiming more than they establish. Fixed by keeping the promise: no `encoding`, and
the verdict is `Buffer.equals`, which also closes the case the review named (two different invalid
sequences both decode to U+FFFD and compared equal). Demonstrated on the one non-ASCII fixture —
replacing the em dash in `pr-labels.yml`'s summary program with a hyphen is three bytes for one, and it
comes back FAIL.

Answered under [`../memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md),
which landed on `main` while this branch was open: **one push per round** (both comments batched into
one), **records last** (this handoff correction rides that same push rather than spawning a round of
its own — rule 2 exists for exactly the handoff-only push it would otherwise have been), threads
answered because threads block, and this is fix-round one of the two the bound allows.

**For the next session.** Nothing carried.
