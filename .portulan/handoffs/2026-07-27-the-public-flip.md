# Handoff — the public flip

**State.** `sleepy-panda-srl/portulan` is **public** as of 2026-07-27, flipped by the maintainer's
explicit directive, executed and verified in the same hour (~17:46 UTC) (`visibility=PUBLIC`, anonymous fetch 200).
The marketplace is now publicly installable, which was milestone 3's purpose. This handoff ships in the
truth-up pull request that follows the flip, correcting every tracked claim the flip falsified.

**The decision, recorded plainly.** The flip's clearance gate is tracked outside this repository; the
maintainer directed the flip proceed **ahead of that track's completion, accepting the risk on his own
authority** — his decision to make, made in his own words, and recorded here rather than smoothed over.
The recommendation that the remaining clearance step still be completed after the fact stands recorded
with him.

**The trademark sweep, and its honest limits.** Run at knockout level, 2026-07-27, before the flip:

- No PORTULAN or PORTOLAN mark surfaced in Nice classes 9 or 42 in any register reached.
- Nearest registered mark: PORTOLANO — textiles and gloves, classes 24/25, a different mark on
  unrelated goods; no confusion surface with developer tooling.
- One coexistence disclosed: **PORTULAN CLARIN**, a Portuguese academic language-science research
  infrastructure with public repositories. Unregistered as far as reached, composite name, different
  field and audience. Judged not blocking at knockout level; a formal clearance opinion by counsel
  should look at it before brand spend.
- Limit: TMview's search API was unreachable from the sweep environment; register coverage relied on
  reachable indexes. A knockout search is not a clearance opinion, and this record does not claim one.

**The pre-flip scans — every public surface, all clean.** Tracked tree at tip · full commit history ·
branch names · all 43 pull requests' titles and bodies existing at the flip — two of them (#42, #43) created minutes before it by the parallel session and swept immediately after, in this truth-up · every review comment · every issue comment.
The last three had never been swept as a set; they became public with the flip, which is why they were
swept before it.

**What this pull request corrects (the flip falsified these):**
- `README.md` Status: private-during-build → public as of 2026-07-27.
- `.portulan/memory/repo-is-private-until-flip-clearance.md`: its retire-when fired; per its own clause
  the rule inverted into its successor — history is public and permanent, the pre-commit seam scan binds
  harder, not less.
- One sentence in the newest `docs/plan.md` entry, rewritten on the supervisor's must-fix: it said an
  optional review note was "deliberately not folded", written before the commit that folded it — the
  mechanical-revert-is-not-a-narrative-revert shape, one session after it was the lesson.

**Left open, on record:**
- **`.portulan/gate-map.md:78` — the push-stays-Auto revisit clause has fired.** That tier placement was
  "judged acceptable on a one-collaborator **private** repository and is the thing to revisit first if
  either of those facts changes." The repository is no longer private as of 17:46 UTC. Revisiting the
  tier is the maintainer's gate decision to make — flagged here, deliberately not edited by this PR.
- `docs/vision.md:20` and `docs/plan.md:19`/`:34` still say "milestone-3 public flip" / "only after the
  clearance completes" — the maintainer's own one-line rewords; `:19` is a governing "only after" now
  contradicted by the flip, so it is more than cosmetic.
- `CODEOWNERS` remains absent — recorded as wanted before the flip; the flip happened without it, so it
  is now wanted *late* rather than wanted *next*.
- The clearance track's remaining step, per the maintainer's standing acceptance of the risk.

**Supervision.** The maintainer's real-time directive was the session plan; the truth-up diff passed a
fresh-context Fable 5 pre-commit review before push. Seam scan clean across files, commit message, and
branch name.

**Recoverability.** The flip itself is one-way in practice — that fact is now the successor rule in the
memory entry above. Everything else in this change is documentation matching reality and can be amended
by the same means it was written.
