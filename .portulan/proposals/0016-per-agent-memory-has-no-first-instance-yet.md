# 0016 — Per-agent memory has no first instance yet, and the doctrine should say where the first one arrives

**Status.** Accepted — landed with the post-M5 reconciliation.

**Pull request:** https://github.com/sleepy-panda-works/portulan/pull/96

## The claim

[`core/operating/memory.md`](../../core/operating/memory.md) ends with **Per-agent, not global**:
memory is scoped to the agent or persona that uses it, "not dumped into one shared pool", with Letta
as the provenance. It has said so since milestone 1.

**Nothing in this repository implements it, and until now nothing said so.** That is the shape
[`a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
names, and [`../dod.md`](../dod.md) condition 4 is the standing rule it breaks: *if a document
describes enforcement, either the enforcement exists or the sentence names the milestone where it
arrives.* This sentence describes a scoping and names no milestone.

## What was verified, at source, rather than asserted

The obvious candidate for a first instance is the scheduled librarian — it is the only agent here that
runs unattended and repeatedly, which is the condition under which per-agent memory would earn its
keep. It does not have one, and this is read from the code rather than inferred:

- [`cli/librarian.mjs`](../../cli/librarian.mjs) states it in its own words: *"this pass keeps no
  state, and the newest pass record in the series **is** the record of when it last ran."* The
  window's anchor is **derived, not remembered**.
- Every figure a pass reports is recomputed from git and the tree on each run. The milestone-5 record
  says the same thing from the other side — "the pass keeps no state between runs … so per-agent
  memory gets **no first instance** here" — and the M5 close verified that two runs on an unchanged
  store with the same `--as-of` produce **byte-identical** output, which is the property statelessness
  buys and the one a state file would immediately cost.
- Sessions 1 and 2 of milestone 5 (#81, #85) built and then extended that pass without adding a store
  for it, and the reindex/staleness/mining/consolidation passes all read the workspace's **shared**
  curated layer — `slots.memory` and the proposal series — which is a workspace store, not the
  librarian's own.

So the doctrine is not contradicted by anything shipped. It is simply unbuilt, and the honest repair
is the one condition 4 prescribes: name where it arrives.

## The change

One sentence appended to **Per-agent, not global**, naming milestone 6 as the arrival — the row that
ships the pack manifest and the checkpoint/supervisor ritual pack, which is the first time this
repository distributes per-persona material that a *pack* rather than a workspace owns, and therefore
the first place the scoping has anything to scope. Nothing else on the page changes, and the doctrine's
substance is untouched.

## What this deliberately does not do

- **It does not build per-agent memory**, and it does not promise the milestone-6 row will. It records
  where the question is owed. Milestone 6's criterion is amended by nobody here; if the arrival needs
  to become a deliverable, that is a criterion amendment through the same gate the M1–M5 amendments
  used, argued as an expansion, and it is the maintainer's.
- **It does not make the librarian stateful.** The statelessness above is a *feature* with a measured
  benefit (byte-identical reruns, no churn in the record) and giving it a state file to satisfy a
  doctrine sentence would be the tail wagging the dog.

## Provenance

Deferred by the maintainer's ruling of 2026-07-28 — *"Merge #80 as is. We'll reconcile after M5
lands"* — and carried in the post-M5 reconciliation as one of the three items that ruling deferred.
The statelessness half was checked against `cli/librarian.mjs` and the #81/#85 records during that
reconciliation rather than taken from the earlier note that asserted it.
