# Proposal — one spec bump carries both `evals` and `telemetry`

**Status. ACCEPTED — drafted and accepted 2026-08-28.** It asks the Workspace Definition to gain **two** slots in a
single MINOR at the milestone-8 close: `evals`, which [`../../spec/slots.md`](../../spec/slots.md) has
already deferred to exactly that moment, and `telemetry`, which milestone 8 session 5 needed and did
**not** take. It proposes no schema text: what a slot promises is the thing to settle first, and the
close is when both answers exist.

**Pull request:** https://github.com/sleepy-panda-srl/portulan/pull/362

## Incident — a session reached for a slot, and its own checkpoint stopped it

Milestone 8 session 5 built the *OTel opt-in config* clause. Its first plan put the opt-in config in
the manifest as a `telemetry` slot at spec **2.9**, reasoning from
[`../../spec/README.md`](../../spec/README.md)'s 2.8 precedent: one optional key, nothing removed,
renamed, tightened or defaulted, therefore a MINOR.

The session-open checkpoint cut it, and the cut turned on the half of that precedent the plan had not
read. **Every slot in this train arrived through a ruled proposal.** `spec/README.md`'s own argument for
2.8 says the key's case is *"`slots.md`'s and proposal `0025`'s"*; `governed_by` cites
[`0017`](0017-one-repository-one-governing-workspace.md); `provenance` cites
[`0002`](0002-sealed-provenance.md). And [`../gate-map.md`](../gate-map.md) states the rule directly: an
idea that adds *"an axis, a mode, or a surface"* starts as a proposal, **"never opened as an
implementation pull request with tests."** A top-level manifest key is a surface.

`slots.md` then closes it twice over. Its `evals` deferral says filling a slot *"is a schema change, a
spec version bump and a migration, so it is not a thing to do in passing"* — and defers to **when
milestone 8 closes**. Its minimality rule says *"splitting on speculation is how a schema acquires slots
nobody fills."* The proposed `telemetry` slot would have shipped with **zero filled instances**: the
workspace that added it declares telemetry off, and [`../../examples/`](../../examples/) stays at 2.4.

**The config went to a workspace-layer file the tool owns instead** — `evals/telemetry/config.json`,
validated by [`../../cli/telemetry.mjs`](../../cli/telemetry.mjs) and railed by the `telemetry` recipe.
Nothing was lost that this proposal is needed to recover; what is owed is the *adopter's* half, which a
file only this repository's tooling reads does not provide.

## What is proposed

**One MINOR carrying two optional slots**, at the milestone-8 close and not before:

- **`evals`** — where a workspace's eval corpora live. `slots.md`'s stated reason for waiting is that
  `evals/` here holds *"two corpora with two different oracles"* plus a metering register, and a slot
  naming that directory *"would promise adopters a shape this repository has not settled for itself."*
  Row 8's nine clauses are what settle it; three remain.
- **`telemetry`** — whether this team has opted in, and to what. Deliberately **not** transport: the
  session's ruling is that the environment supplies the endpoint and any secret through the
  OpenTelemetry standard variables, so a committed manifest names a decision and never a destination.

**Why together rather than in sequence.** They arrive at the same moment, they are the same kind of
addition, and each costs a version bump, a `KNOWN_SPECS` entry in two tools, and a migration question.
Two bumps a week apart would double that for no gain — and `slots.md`'s deferral already names the close
as the moment for the first of them.

**What this proposal does NOT decide**, so acceptance is not a blank cheque: the key names, the shape of
either slot, whether `telemetry` should carry a signal list at all, and whether a migration is owed.
Those are the drafting work this proposal asks to be commissioned, not work it smuggles in.

**Enforcement.** Nothing new, and that is the point of asking rather than building. Both slots are
**optional**, so no existing manifest becomes invalid and no migration is owed — the property
[`../../spec/README.md`](../../spec/README.md) requires of a MINOR, and the one 2.7 and 2.8 each
demonstrated by running `node cli/doctor.mjs .portulan examples` green across the bump with
[`../../examples/`](../../examples/) untouched. What the bump costs is already known and is small:
`KNOWN_SPECS` in [`../../cli/index.mjs`](../../cli/index.mjs) and
[`../../cli/librarian.mjs`](../../cli/librarian.mjs) gains the new version **by addition**, and the four
constants that *write* a spec version stay where they are, since a writer declares the version its
output needs. Each slot's own validation would be `doctor`'s hand-check, in the shape the seven keys it
already hand-checks use — the JSON Schema subset in use cannot say `integer`, which is why those exist.
**Until this is accepted and drafted, the telemetry config is validated by
[`../../cli/telemetry.mjs`](../../cli/telemetry.mjs) alone and reaches no adopter**, which is the gap
this proposal exists to close rather than a claim that it is closed.

**Provenance.** Milestone 8 session 5's session-open checkpoint, 2026-08-28, which cut a `telemetry`
slot out of that session's plan — recorded in
[`../../docs/milestones/m08.md`](../../docs/milestones/m08.md)'s session note and in
[`../../evals/README.md`](../../evals/README.md). The rule it was cut under is
[`../gate-map.md`](../gate-map.md)'s *"an idea that adds an axis, a mode, or a surface starts as a
proposal … never opened as an implementation pull request with tests"*, and the precedent that a slot
arrives argued is every slot in the train: [`0025`](0025-the-byte-rail-moves-from-the-store-to-the-record.md)
for `memory.store.budget.record_kilobytes`, [`0017`](0017-one-repository-one-governing-workspace.md) for
`governed_by`, [`0002`](0002-sealed-provenance.md) for `provenance`. The `evals` half carries its own
provenance: [`../../spec/slots.md`](../../spec/slots.md)'s *Considered and left out* entry, which defers
it to this exact moment and says why. **Retire when:** both slots are in the Workspace Definition, or the
maintainer rules that neither belongs there.

## Why it is a proposal and not an issue

An issue would record the idea; it would not route it through the gate that
[`../gate-map.md`](../gate-map.md) puts in front of a new surface. The session that hit this rule is the
right one to write it down, and writing it as an issue would have reproduced the reasoning the
checkpoint had just rejected — the artifact matching the rule, rather than the rule matching the
artifact.

## Outcome

**ACCEPTED — Marius, 2026-08-28.** His word, in full: *"I accept."*

**What that commissions, and what it does not.** It accepts the *shape* of the ask — one MINOR carrying
both slots — and commissions the drafting. It settles none of what the proposal explicitly left open:
the key names, either slot's structure, whether `telemetry` carries a signal list at all, and whether a
migration is owed. Those are the drafted work, and they come back through review like any other change.

**When.** The milestone-8 close remains the earliest sensible moment and the acceptance does not move it
earlier: [`../../spec/slots.md`](../../spec/slots.md)'s deferral conditions the `evals` slot on row 8
having decided what an eval artifact is here, and **three clauses remain**. Drafting the schema before
that condition holds would be the "splitting on speculation" this proposal was written to avoid, in the
change accepting the proposal against it.

**Decision.** Marius — accepted, on 2026-08-28 — because the two slots arrive at the same moment and
cost the same bump, and because a manifest surface is his to grant rather than an implementation
session's to take.
