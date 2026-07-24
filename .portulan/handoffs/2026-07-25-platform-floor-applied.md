# Handoff — the platform floor stops being convention

**State.** Done. Branch protection is live on `main` and proposal 0001 is closed as applied. The
documents that described the floor as unconfigured are updated to describe what it actually enforces.
This is the last item from the milestone-1 arc; nothing from it is now outstanding except `CODEOWNERS`,
which is newly recorded rather than newly discovered.

**Decisions + why.**

- **Applied with 0 required approving reviews, deviating from the proposal as written.** The proposal
  asked for "at least one approving review", and that was wrong: GitHub does not let anyone approve their
  own pull request, so one required review plus `enforce_admins` would have left a one-person repository
  unable to merge anything at all. Applied instead as *pull request required, `docs-integrity` green
  required, administrators included, zero reviews*. `enforce_admins` is the load-bearing setting — a
  floor that exempts the only actor who can act is not a floor — and the review count is the part to
  raise when a second reviewer exists. Recorded as a deviation in the proposal rather than quietly
  matching the docs to what was done.
- **Verified by attempting the thing it forbids.** A direct push to `main` was made and rejected
  (*"Changes must be made through a pull request"*). The alternative — reading the settings back and
  calling it done — would have been assertion, which is what this build's own exit criteria forbid. The
  probe commit was discarded immediately.
- **`CODEOWNERS` named as still missing rather than left implicit.** Nothing yet requires a specific
  human on a specific path, including [`../../docs/vision.md`](../../docs/vision.md) — which today is
  protected only by the prohibition in [`../gate-map.md`](../gate-map.md), a prompt-level rule, not by
  the platform. That is precisely the class of protection this doctrine says not to trust, so it is
  written down as the next piece of the floor rather than treated as complete.

**Open questions.**

1. **`CODEOWNERS` before the milestone-3 public flip.** Wanted for `docs/vision.md` at minimum. Note it
   interacts with the zero-review setting: code-owner review is a separate requirement and would need a
   second human to be satisfiable, so it may have to wait for one.
2. Proposal [`0002`](../proposals/0002-sealed-provenance.md) still awaits a decision, sequenced for
   milestone 2.

**Next action.** Milestone 2 — Workspace spec v1.

**Recoverability.** The branch protection change is reversible from the API by the maintainer; the exact
settings are recorded in [`../gate-map.md`](../gate-map.md), so it can be restored or removed
deliberately rather than from memory. No other state was changed.
