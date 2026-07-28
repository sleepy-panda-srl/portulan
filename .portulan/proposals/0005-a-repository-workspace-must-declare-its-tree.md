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
to pass: **MAJOR** by [`../../spec/README.md`](../../spec/README.md)'s own rule — shipping with
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

**Decision.** Marius Cetanas — **accepted, 2026-07-25**, on a recommendation he commissioned from a
fresh-context Fable 5 and posted as [`portulan-agent[bot]` on pull request 15](https://github.com/sleepy-panda-works/portulan/pull/15#issuecomment-5078534991).
**Apply before the milestone-3 public flip, not riding milestone 4's bump** — which reverses this
proposal's own recommendation, and the reasoning is better than the one it replaces:

- **The first migration is nearly free right now.** Two manifests exist. `.portulan/` already declares
  `tree`; `examples/` is a `demo` and exempt. The migration is a version bump and a note — **zero manifest
  edits.** Every milestone toward public makes a MAJOR strictly more expensive, so "MAJOR for one check is
  a poor trade" was priced against the wrong date: it is the cheapest it will ever be, today.
- **Deferring carries the hole across the milestone-3 flip** — precisely the window when outside
  evaluators first probe the spec, and a fail-open in gate machinery is the worst thing for them to find.
- **It exercises the migration machinery while the blast radius is zero.** Same logic that justified
  building the demo as the schema's second instance: a migration path whose first run is on a real adopter
  is a claimed capability, not a demonstrated one.

**Applied, 2026-07-25, in the same pull request** — at the maintainer's direction, rather than as the
follow-up this section first proposed. The reversal is worth recording because the objection turned out to
be wrong. It ran: *1.1 must land on `main` first, or the change reads 1.0 → 2.0 and the migration is
between a version nobody ever had and one nobody has yet.* But `main` carries **1.0**, so 1.0 → 2.0 is a
migration from a version that genuinely shipped — and 1.1 existed only on an unmerged branch, which is not
a version anyone had either. Publishing 1.1 to `main` in order to obsolete it an hour later would have
been the worse practice, and it would have cost two version bumps where one does the work.

What landed: the `doctor` cross-field check ([`../../cli/doctor.mjs`](../../cli/doctor.mjs), test written
red-first and red for the right reason — adding it turned eight existing tests red at once, since their
shared baseline manifest was a `repository` with no `tree`, which is the cheapest possible confirmation
that the constraint binds every such workspace and not only the one it was written against); the rule
stated in [`../../spec/slots.md`](../../spec/slots.md) **with its cost named** — it is the one rule the
schema does not carry, because the subset has no `dependentRequired`; spec 1.0 → **2.0** with the
migration written up in [`../../spec/README.md`](../../spec/README.md); and every manifest moved to 2.0,
which was fourteen files and **zero content edits**, exactly as the acceptance argument predicted.

**Pull request:** [#15](https://github.com/sleepy-panda-works/portulan/pull/15) — the change that filed this.
