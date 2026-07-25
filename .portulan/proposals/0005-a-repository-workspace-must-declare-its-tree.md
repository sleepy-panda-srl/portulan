# Proposal — a `repository` workspace must declare its `tree`

**Incident.** Found at the milestone-2 close checkpoint, by a fresh-context supervisor who did not take
the documents' word for it and instead tried to break the check. Delete the single line `"tree": "../"`
from this workspace's manifest, drift a repo card so its claims are false, and `doctor` reports **GREEN,
exit 0, "10 unverifiable"**. The entire claims-against-the-tree class — the half of the milestone-2
criterion that exists to catch drift — degrades to notes on a one-line manifest edit.

The edit is visible in a pull request, so this is not a silent bypass. But "you would have to notice it in
review" is the standard this repository converts into rails rather than relies on
([`../principles.md`](../principles.md), *prefer the rail to the reminder*), and the one thing review is
worst at noticing is a line that was **removed**.

**Why `tree` is opt-in today, and why that reasoning does not cover every case.** The slot exists because
the claims lint needs to know which tree a repo card describes, and two of the three workspace kinds have
no honest answer: [`../../examples/`](../../examples/) describes fictional repositories, and the
portfolio workspace at milestone 6 will span many. Making the lint mandatory would fabricate defects in
both. So the workspace declares it — and the escape hatch that is correct for those two is also,
accidentally, available to the one kind that has no excuse for using it.

**Proposed rule.** Into the Workspace Definition:

> A workspace whose `kind` is `repository` **must** declare `tree`. A `demo` or `portfolio` workspace may
> omit it, and its repo-card claims are reported unverifiable as they are today.

The justification is not symmetry, it is that the three kinds differ in the one way that matters here:
a `repository` workspace *is* the policy layer of a repository that is present. There is no case where it
cannot answer the question. `demo` and `portfolio` have real answers to the contrary; `repository` has
only an omission.

**Enforcement.** `doctor` fails a `repository` workspace with no `tree`, naming the rule. This cannot be
expressed in the schema subset — a conditional dependency between two keys needs `if`/`then` or
`dependentRequired`, and [`../../spec/README.md`](../../spec/README.md)'s subset has neither. So it is a
cross-field check in [`../../cli/doctor.mjs`](../../cli/doctor.mjs) alongside `verify.default`, and
`spec/slots.md` states it as a rule the schema does not carry. **That asymmetry is a cost, not a
detail:** a constraint living in the validator rather than the schema is invisible to anyone reading the
schema alone, which is exactly the complaint this proposal makes about the current state.

**Version.** Additive constraint on an existing optional slot, so it can invalidate a manifest that used
to pass: **MAJOR** by [`../../spec/README.md`](../../spec/README.md)'s own rule — 1.1 → 2.0, shipping with
the first migration this spec has ever needed. That is a real cost for one check, and it is the strongest
argument against adopting this now rather than at milestone 4, when the enforcement compiler is likely to
force a MAJOR anyway and this can ride along.

**Provenance.** `form=link` `href=../../docs/plan.md` — the milestone-2 close checkpoint, recorded in the
Session log. The supervisor's exact demonstration: one line removed, drift introduced, exit 0.

**Honest limits.**

- **It closes one hole and leaves its sibling open.** `kind` is still self-declared, so `repository`
  → `demo` is a one-word edit that reopens exactly the same gap. This proposal narrows the escape from
  *omit a line* to *lie about what you are*, which is better and is not a fix.
- **It does not make the lint complete.** The lint reads path-shaped tokens; prose claims about facts
  outside the tree stay invisible to it, as the agent-identity staleness found in this same session
  demonstrates.
- **MAJOR for one check is a poor trade in isolation.** Adopting it means the first migration, and
  migrations are the thing a spec's adopters feel. Waiting means carrying the hole. That trade is the
  decision, and it is the maintainer's.

**Decision.** Marius Cetanas — **pending**. Drafted at the milestone-2 close, not applied. The close
checkpoint returned CLOSE with this recorded as carried debt rather than as a blocker, on the grounds
that the opt-out is loud, PR-visible, and the same shape as the rest of the enforcement fabric — where
declaring a recipe is what enforces it.
