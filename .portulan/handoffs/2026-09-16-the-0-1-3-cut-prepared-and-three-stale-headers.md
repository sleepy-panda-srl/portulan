# Handoff — 2026-09-16: the 0.1.3 cut prepared, and three stale headers

**What landed.** Milestone 8's ninth clause — *a release carries an eval result* — has its **in-tree
half**: `0.1.3` is cut in the tree and carries `evals/releases/0.1.3.{json,md}`. The clause is **not
demonstrated** by this and the PR says so; `tag-a-release` and `publish-a-release` are Gated, and a
release body citing the register is reachable by no in-tree check. Row 8's Status cell does not move.

**The version number was the one thing I had no right to decide, and I nearly did.** My plan treated
`0.1.3` as already ruled because five carriers name it. The session-open checkpoint showed all five are
**agent-written forward references he merged** — stronger than a session brief, weaker than a ruling —
and that the accumulator leads with a breaking change while `SECURITY.md` says a `0.x` minor bump may
carry one, which reads toward `0.2.0`. It was put to him and he answered `0.1.3`. The distinction is the
same one the 2026-09-09 residue turned on: an instruction that lifts a hold does not choose the value.

**Two carriers move at a cut that no list names, and neither existed at 0.1.2.** `cli/drills.mjs`
anchors two drills on the current-version literal — unmoved, `drills --check` exits 2 — and
`evals/telemetry/review-loop.otlp.json` embeds `package.json`'s version through `cli/manifest.mjs`.
Either left behind **poisons the capture**, which runs the whole recipe set and writes what the release
then ships. Filed as [#417](https://github.com/sleepy-panda-srl/portulan/issues/417): same class as #325
and #384, three cut obligations now, each carried by nothing runnable.

**The capture caught me writing a citation one commit early.** My first `--capture` recorded `docs` at
exit 1. Cause: I put the register citation in the commit *before* the one that creates the register, and
`docs` refuses a link to an untracked path — so the rail reported a red that was mine, not the
release's. The session-open had sequenced that citation into the later commit for exactly this reason
and I deviated from it. Deferred the citation, amended commit 1, re-captured clean. **Commit 1 must not
be amended again: the record names its sha.**

**What the pre-commit checkpoint caught that I would not have.** `.portulan/identity.md` was never
staged, so the payload figure would have shipped absent; the figure's own sentence claimed a clean-clone
measurement I had taken in the working tree; the compile entry's *"which is why it leads"* was false at
the entry list, with a sibling at the Fixed entry calling it *"the first entry in this release"*; and
**two carriers describe a sequencing this cut did not follow** — `evals/README.md` and the register's own
renderer both say the capture's commit is the *pre-cut* HEAD, when `--capture` refuses a version below
the first governed one and so can never run before the bump.

**What is still owed, and it is all his.** The tag; a release body citing the register; `--tagged` on the
real tag; published-tarball byte-identity. And `acceptedUnder.reRunWhen` — **still NOT DISCHARGED**, its
owner *the maintainer, at the `0.1.3` cut*, which this change makes arrive. No rail was proposed for it:
one was refused as scope creep on four grounds on 2026-09-09 and that refusal stands. It is re-pointed
**nowhere** here — twice in one week is already the limit, and a third would be motion.

**A limit on the board.** #417 is filed but **not on project 1**: the token carries `repo` and not
`project`, so `addProjectV2ItemById` refuses. Adding it is his.

**Where it is.** [#418](https://github.com/sleepy-panda-srl/portulan/pull/418), two commits: `fac7b6d3`
the carriers, `eb026685` the record and the prose its existence falsified. Session-open
**A-W-A (11+5)**, pre-commit **A-W-A (6+4)**, both Fable 5.1 fresh-context, all folded including the
optional on his standing instruction. 27 green, `--pack-root packs` pinned.

**One thing raised before the merge rather than after it.** The record's `source.commit` names
`fac7b6d3`, a branch commit, and this repository squash-merges and deletes branches — so after merge
that sha resolves in no clone, the `0f49868` class `identity.md` already records. Nothing reds;
`--verify` is shape-only. The choice of merge strategy is his and the PR says why it is his.

**The review's own finding, and it is the one worth keeping.** Three Copilot rounds, thirteen threads.
Four were the same wrong claim — that `evals/README.md` cannot ship because the allowlist names
`evals/releases/` — refused each time on a clean-export measurement, since npm matches a bare
`README.md` entry at **any depth**. Three were the capture anchor, which is the maintainer's merge
strategy and not a defect to fix. **But one was right and nothing in this repository had noticed it:**
`.portulan/verify/release-eval.sh` claimed `--tagged` catches a tag whose `## Unreleased` accumulator
was never renamed. Constructed, it does not — `--tagged` never reads `CHANGELOG.md` at all, and exits 0
on that tree while `--verify` reds it with two findings. Two shapes, and the prose named only the one
`--tagged` catches. That is `a-stated-enforcer-must-be-the-real-one` in a sentence about this very
recipe. Prose corrected at both carriers; whether `--tagged` should read the heading is
[#419](https://github.com/sleepy-panda-srl/portulan/issues/419), with the argument against written into
it — widening it duplicates `--verify`'s `cut` check at a second site.
