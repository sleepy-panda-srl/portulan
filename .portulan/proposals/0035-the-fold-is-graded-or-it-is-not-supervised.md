# Proposal 0035 — the fold is graded, or the change that ships is not the change that was graded

**Status. PROPOSED, 2026-08-29** — drafted on the maintainer's directive of the same day, after a
supervisor pass over [#366](https://github.com/sleepy-panda-srl/portulan/pull/366) found that two of that
change's three review findings **did not exist when its pre-commit checkpoint ran**. It asks
[`../../packs/rituals/checkpoints/skills/pre-commit/SKILL.md`](../../packs/rituals/checkpoints/skills/pre-commit/SKILL.md)
for one changed disposition and one new sentence.

**Pull request:** https://github.com/sleepy-panda-srl/portulan/pull/370

## Incident — the remediation manufactured the defects, and one of two rules was already there

A pre-commit checkpoint grades a diff and returns numbered adjustments. **The implementer then folds
them by hand, and commits.** The tree that ships is not the tree that was graded, and the difference
between them — *the fold* — is where two of #366's three review findings entered:

- **Folding adjustment 5** split the arm specification's slot-drop row in two, because `products` is not
  a slot and `repos` does not resolve outside the workspace, so the two deletions needed different
  reasons. The summary sentence three sections above still said *"five moves"*. The table had six.
- **Folding a finding about the rule-carrier registry** produced a *new* false claim: that the registry's
  tells are line-level fragments, *"which is the granularity the scanner actually reads"*. The scanner
  normalises whitespace and strips markup, so it is not. The checkpoint had measured that question
  **correctly**; the fold re-measured it with `git grep -F`, which is line-based, and wrote the wrong
  answer over the right one.

Neither defect is in the graded diff. Both are in the fold.

**And the first half of the repair already existed and was skipped.** The pre-commit skill's dispositions
are not symmetrical:

> - **APPROVE-WITH-ADJUSTMENTS** — commit once the numbered adjustments are folded in.
> - **REQUEST-CHANGES** — the diff does not meet the criterion; it needs work **and a second pre-commit
>   pass**.

#366's verdict was **REQUEST-CHANGES**, with seventeen adjustments. **No second pass was run.** So the
sharper half of this incident is a compliance failure rather than a gap — the rule that would have caught
both defects was written, and the session folded and committed past it. That is evidence the rule is
load-bearing, not evidence it is missing.

**The gap is the other disposition.** `APPROVE-WITH-ADJUSTMENTS` mandates no second look at all, and its
folds inject defects too: milestone 8 session 5 ([#362](https://github.com/sleepy-panda-srl/portulan/pull/362))
took A-W-A at both checkpoints, folded eight adjustments, and then ran sixteen review rounds in which
**six of thirty-two findings were introduced by an earlier round's own fix — one of them inside the
derived check built to stop that class.**

## Proposed rule

**In the pack's pre-commit skill**, the verdicts become:

> - **APPROVE** — commit as it stands.
> - **APPROVE-WITH-ADJUSTMENTS** — fold the numbered adjustments, then **grade the fold**: a pass over
>   **the fold delta alone**, in a context that did not perform the fold, before the commit.
> - **REQUEST-CHANGES** — the diff does not meet the criterion; it needs work and a second pre-commit
>   pass **over the whole diff**.

And one new sentence, which is what makes the first two checkable rather than remembered:

> **A checkpoint records the tree it graded** — the index it read, as a tree object (`git write-tree`).
> The fold delta is then **`git diff --cached <graded-tree>`**: the recorded tree against the index, which
> is what is about to be committed. Derived, not reconstructed from memory by the person who folded.

_The `--cached` is not a detail. `git diff <tree>` compares against the **working tree**, which on a
full-lane change is a superset of what commits — so the plain spelling would hand the second pass a delta
containing work nobody proposed to commit, and omit nothing only by luck. A rule whose whole purpose is
to make the subject derivable cannot be vague about which of the two trees it derives from._

**Why the A-W-A pass is scoped to the delta and not to the diff.** A full re-grade after every A-W-A
would double the cost of the cheapest verdict and is the ceremony [`../dod.md`](../dod.md) explicitly
refuses. The delta is small by construction — it is exactly the adjustments — and it is the only region
where a fold-injected defect can be. Scoping it there is what makes the rule affordable enough to be
obeyed, which is the property the skipped REQUEST-CHANGES pass on #366 did not have.

## Enforcement — and the half that is honestly prose

**Derivable, and this is the load-bearing half.** Once the graded tree is recorded, the fold delta is a
`git diff`. That turns *what the second pass must read* from a thing the folder recalls into a thing the
tree computes — the same move this repository has made for recipe counts, the CLI roster and the
review-loop tally, and the one it names when a hand-maintained figure goes stale.

**Not enforceable, stated rather than implied: whether a fresh context actually read that delta.**
Checkpoint freshness is unenforceable by design here — a session can always claim a pass it did not run,
which is why [`../verify/README.md`](../verify/README.md) already carries checkpoint attendance as
discipline rather than as a rail. This proposal does not close that and does not pretend to. What it
closes is narrower and real: **today the second pass has no defined subject**, so even a session that
wants to run one must reconstruct what changed after the verdict from memory.

_A candidate rail, named and not proposed: a Stop-gate refusing a commit whose recorded graded-tree hash
is absent while a checkpoint verdict is claimed in the session. It is buildable and it is out of scope
here, because it would gate on a claim the session makes about itself — the same shape as
`consentIsCommitted`, and worth its own proposal rather than a clause in this one._

## What this does not ask for

- **No change to core.** [`../../core/operating/evolution.md`](../../core/operating/evolution.md) states
  the three-moment cycle and names no verdicts; the dispositions are the pack's. This is the most
  specific layer that still generalises — every adopter composing the checkpoints pack gets it.
- **No fourth moment.** Grading the fold is part of the pre-commit moment, not a new one. A fourth
  moment would be a bigger claim than the incident supports.
- **No change to REQUEST-CHANGES.** Its second pass already exists. #366 is an argument for obeying it,
  not for rewriting it — and this proposal would be dishonest if it quietly converted a compliance
  failure into a request for new machinery.

**Provenance.** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/366` — the fold-injected
defects, found by Copilot's suppressed channel across rounds 3 and 4 and traced to the fold by a
fresh-context supervisor on 2026-08-29. Corroborating: [#362](https://github.com/sleepy-panda-srl/portulan/pull/362),
six of thirty-two findings introduced by an earlier fix after an A-W-A fold.

**Retire when.** A checkpoint's verdict and the tree it graded are recorded by the harness rather than by
prose, so the fold delta is produced without anyone choosing to produce it — at which point this rule is
describing a mechanism instead of asking for one.

**Decision.** {maintainer} — accepted | rejected | revised, on {date} — because {…}.
