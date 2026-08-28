# Proposal — one spec bump carries both `evals` and `telemetry`

**Status. OPEN — drafted 2026-08-28.** It asks the Workspace Definition to gain **two** slots in a
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

## Why it is a proposal and not an issue

An issue would record the idea; it would not route it through the gate that
[`../gate-map.md`](../gate-map.md) puts in front of a new surface. The session that hit this rule is the
right one to write it down, and writing it as an issue would have reproduced the reasoning the
checkpoint had just rejected — the artifact matching the rule, rather than the rule matching the
artifact.

## Outcome

**Pending.** It is the maintainer's to accept, amend or decline, and its earliest sensible moment is the
milestone-8 close — by which point row 8's remaining three clauses will have decided what an eval
artifact is here, which is the deferral's own stated condition.
