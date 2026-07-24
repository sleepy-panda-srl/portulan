# Proposal — configure the platform floor on `main`

**Incident.** Milestone 1, session 3. A check against the live remote found that
`sleepy-panda-works/portulan` has **no branch protection on `main`**, no required status checks, and no
`CODEOWNERS`. The constitution calls the platform floor "the universal gate no model can bypass"
([`../../docs/vision.md`](../../docs/vision.md)) and core states it as the floor that "holds when
everything above it fails" ([`../../core/operating/autonomy.md`](../../core/operating/autonomy.md)) — and
the product's own repository does not have it. PR-as-gate has held for three milestones purely by the
maintainer's convention, which is exactly the "trust that the model will behave" posture the doctrine
rejects. Nothing has gone wrong yet; that is the argument for fixing it now rather than after something
does.

**Proposed rule.** Into [`../gate-map.md`](../gate-map.md), under the platform floor:

> `main` is never written to directly. Every change reaches it through a pull request with at least one
> approving review and every required status check green. The rule includes administrators.

**Enforcement.** GitHub branch protection on `main` — the floor enforces itself, which is the whole
point of naming it a floor:

- Require a pull request before merging; require one approving review.
- Require conversation resolution before merging.
- Block force-pushes and branch deletion.
- **Include administrators.** On a solo-maintainer repository this is the setting that decides whether
  the floor is real: without it the one human on the project is precisely the actor who can bypass it,
  and the gate degrades back into convention.
- Required status checks: the **`docs-integrity`** context from
  [`../../.github/workflows/verify.yml`](../../.github/workflows/verify.yml), which runs
  [`../verify/docs.sh`](../verify/docs.sh) on every pull request and on `main`. It ships with this
  proposal, so the recipe can be required well before the enforcement compiler (milestone 4)
  generalises this. Pin the rule to that job id and not to a display name — and note that renaming the
  job silently detaches the requirement, which is a gate that fails open.

**The cost, honestly.** Including administrators means the maintainer cannot push a one-line fix to
`main` either — every change, including his own, needs a branch and a PR he approves himself. That is
real friction for one person, and it is the friction being bought deliberately: a floor with an exemption
for the only person who can act is not a floor. If the friction proves worse than the risk, the honest
response is to change this rule through another proposal, not to leave the setting off while the
documents claim otherwise.

**Provenance.** Vision thesis 3 — rails, not prose; the platform floor in
[`../../core/operating/autonomy.md`](../../core/operating/autonomy.md); platform-engineering practice —
the same policy for agents as for humans; and the incident above. Carried into the rule so it can be
retired if the repository ever stops being merged into by more than one actor.

**Decision.** Marius Cetanas — **accepted, administrators included**, on 2026-07-25 — because a floor
that exempts the only actor able to bypass it is not a floor, and self-approving his own pull requests is
the price of the gate being real rather than declared. Configuring branch protection is a
repository-settings change and therefore a **Gated** action ([`../gate-map.md`](../gate-map.md)): it is
his to perform, not an agent's to do on inference.

**Status: APPLIED, 2026-07-25.** Live on `main`: pull request required, `docs-integrity` required green,
administrators included, conversation resolution required, force-pushes and deletion blocked.
[`../gate-map.md`](../gate-map.md) now describes the floor as configured, and records what it enforces.

**Demonstrated, not asserted.** A direct push to `main` was attempted immediately after the change and
rejected — *"Changes must be made through a pull request."* This proposal closes on the same bar the
milestones use.

**One deviation from the proposal as written, and it matters.** The rule above asked for "at least one
approving review". That was wrong and would have deadlocked the repository: GitHub does not permit
anyone to approve their own pull request, so one required review plus `enforce_admins` leaves a solo
maintainer unable to merge anything. Applied with **0** required reviews instead — the PR and the green
check are required of everyone, with no exemption. `enforce_admins` is the load-bearing setting and it
is on; raise the review count when a second reviewer exists.

**Remaining.** `CODEOWNERS` is still absent, so no path-specific human is required on any file. Tracked
in [`../gate-map.md`](../gate-map.md) as the next piece of the floor, wanted before the milestone-3
public flip.
