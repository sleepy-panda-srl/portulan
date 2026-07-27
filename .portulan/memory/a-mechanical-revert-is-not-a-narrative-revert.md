**type:** rule
**scope:** workspace — anywhere an automated rewrite touches a value that prose nearby describes
**provenance:** `form=link` `href=../handoffs/2026-07-27-dependabot-security-and-the-watchers.md`
— 2026-07-27, where a deliberate experiment was reverted by the mechanism it was testing, and `main`
carried a false claim for the interval as a direct result of that mechanism working.

**Restoring a value does not restore the claims written about it.** An automated rewrite — a Dependabot
bump, a codemod, a formatter, a version-bump script — is scoped to the thing it understands. The sentences
around that thing are not in its scope, and they are where the reasoning lives.

**Why it holds:** the incident is the cleanest possible form of it. The `actions/checkout` pin was
deliberately regressed one patch, to force a watcher that had never been shown to work into producing a
signal. A long comment above it said exactly that, ending with *"do not fix this pin by hand — the fix is
Dependabot's own pull request"*. Dependabot opened that pull request, and merging it restored the pin
**precisely as designed** — while leaving the paragraph announcing a deliberate regression, and the
instruction not to touch it, sitting directly above a line that no longer matched either.

So `main` briefly asserted something false, and **the false claim was produced by the fix succeeding.** Not
by a bug, not by a missed step: the mechanism did exactly what it was asked to do, and its scope simply
stopped at the value.

Nothing in this repository can catch it. `doctor`'s claims lint holds paths and status-check names against
the tree; a sentence that has become untrue about a SHA is prose about a fact, which is the one class the
machinery has never reached — the same boundary [`../gate-map.md`](../gate-map.md) already confesses to
about `CODEOWNERS` and the agent App.

**When to apply:** twice.

- **After any automated rewrite lands**, read the prose around what moved — not the diff, which shows only
  the line that changed, but the paragraph, which is where the stale claim will be. The diff's narrowness
  is exactly what hides this.
- **While writing prose about a value something else may change.** Prefer a claim that dates itself over one
  written in the present tense. This is why the observation table in
  [`../proposals/0006-dependabot-security-updates.md`](../proposals/0006-dependabot-security-updates.md)
  is stamped with the time it was read: when the pin later moved, that table stayed honest as a historical
  reading instead of quietly becoming false, and the surrounding comment — written in the present tense —
  did not.

**The general shape**, of which the automated rewrite is the common special case: any change that restores
or alters state without touching the description of that state. A revert is the sharpest example because
it *feels* like a return to a known-good position, so nobody re-reads.

**Retire when:** a check can evaluate prose against live values — the claims lint reaching facts outside the
tree, which is milestone 5 territory at the earliest. **Retire sooner if** the revision of `0008` in flight
as of 2026-07-27 absorbs this as its *definition falsified by its own change* direction, which is drafted to
cover exactly this instance.
