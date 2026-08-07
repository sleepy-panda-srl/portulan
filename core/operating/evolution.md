# Supervised evolution

> Core doctrine — loaded on demand. How the curated layer changes over time without drifting. Memory
> (`memory.md`) is the store; evolution is the governance of changes to it. This is the moat: a framework
> that cannot safely improve itself rots, and one that improves itself without a gate drifts.

## Every mistake compiles into a rule

When something goes wrong, the fix is not only the patch — it is a **rule that makes the class of
mistake impossible or caught**, carrying a link to the incident that motivated it. Over time the rule
set becomes a compacted history of everything the team learned the hard way. _(Provenance: compounding
engineering — Every; the mistake→rule-with-provenance loop — agentic craft, Hashimoto.)_

A rule earns its place only if it **enforces itself** (a hook, a compiled gate, a Stop-gate),
**measures itself** (an eval), or is worth the context-window tokens it costs as prose. A rule that does
none of these is demoted to reference, not kept standing. _(Vision thesis 3 — rails, not prose.)_

**And a fix is not done at the site it was found.** A rule holds where it is enforced, so a rule enforced
in two places can be repaired in one — and the site left standing is the one the next reader copies. Name
the rule a patch restores, find that rule's other sites, and either fix each or record which were
knowingly left. This is one defect in two materials — a rule with two prose carriers is obeyed at the
narrower one; a rule with two enforcement sites is repaired at fewer than all of them — and it has one
repair: **one carrier, and the others reach it**, by citing it in prose and by calling it in code. That
is how *impossible* above is reached rather than merely preferred, because a rule with a single site
cannot be missed at a second. Where two sites genuinely cannot be merged, pin them together in one check,
so a divergence reds instead of drifting. What does **not** work is explaining the rule beside its site:
that has been measured failing, in both materials. _(Provenance: single-source-of-truth, carried from
data to rules; compounding engineering — Every.)_

## Agent-drafted, human-owned

Agents draft rule changes; humans own them. The curated layer is never edited by an agent on its own
authority: a change is a **proposal**, and a proposal becomes a rule only through a reviewed,
eval-gated PR. It is the same gate as for code (see `autonomy.md`), applied to the framework's own
rules. _(Provenance: ETH Zurich — curated beats generated; spec-driven — the human-owned constitution;
binding non-goal — no unsupervised self-evolution. See `../templates/proposal.md`.)_

## Speed up the gate; never remove it

The human gate is the guarantee, so the work is to make it cheap — not to bypass it:

- **Proposals as PRs** — a rule change is reviewable, diff-able, and revertable like any other change.
  As of milestone 5 that is machinery rather than a convention: a proposal **names the pull request
  that filed it**, and a verify recipe fails one that does not. The sentence was true before and
  nothing recorded it, so no rule could be traced back to the review that accepted it, and a proposal
  that had skipped the gate entirely would have looked identical to one that had not.
- **The librarian nags** — a scheduled pass chases what is going stale, so the backlog is drafted
  *for* the human rather than *by* them. **Built at milestone 5**: record age from git, the
  sealed-stamp re-validation nag, undecided proposals, demotion drafts, and — since the milestone's
  second session — **mining and consolidation**, on a cadence, filed as a pull request. What a
  workspace supplies is the schedule and an identity the job can file under; the pass itself is the
  part that ships. **What mining produces is candidates, not proposals, and the difference is the
  honest part.** The pass names an incident nothing in the curated layer points back at, and a path
  reviewers keep leaving findings on; it does not write the proposal, because the argument is the
  proposal and a stub filled from derived fields has everything except that. `../skills/codify/SKILL.md`
  is the pass a human then runs on a candidate. _(The codify ritual; provenance: compounding
  engineering.)_
- **Evals decide where they can** — once golden tasks exist, a rule change carries evidence and is
  merged or rejected on the eval result rather than on taste. _(Milestone 8.)_

## The supervised cycle

The framework is built the way it tells teams to build, and that cycle is doctrine an adopter receives
rather than a story about this repository. **Work is agent-drafted and fresh-context-graded at three
moments**: the plan before building starts, the diff before it goes outward, and the exit criteria at
the close — where done is *demonstrated, not asserted* (`verification.md`). Two conditions hold the
cycle up and neither is optional. The unit of work carries **hard exit criteria** fixed before it
begins, so the close has a standard to grade rather than an impression. And **every session ends by
writing the record** (`loop.md`), so the context arriving at the next moment inherits the reasoning
instead of re-deriving it — a graded moment whose grader must first reconstruct what was decided is
grading its own reconstruction.

The altitudes stay separate, and the separation is the part that travels. Core states that the three
moments exist and that the grader has not done the work. **A workspace composes its checkpoint ritual**,
names the moments in its own vocabulary, sets the threshold that decides which work earns them, and says
who grades. Core names no ritual, no pack and no model: the cascade runs core < pack < workspace, so a
core doc naming a specific pack would invert it.

**Portulan is customer zero.** The two-tier supervised build — an implementer plus a fresh-context
supervisor grading against the constitution — is this principle turned on the framework's own
construction: the instance it generalises from, not the principle itself. If the doctrine will not hold
for its own repository, it is not ready to ship.
