# Task — Workspace Definition v1, and a validator that proves it

**Goal.** The workspace layer stops being a folder convention and becomes a contract: a schema derived
from real content, an instance of it in this workspace, and `doctor` validating both this workspace and
the demo — plus linting what those workspaces *claim* against what the tree actually contains.

This task spans **both milestone-2 sessions** and stays open until the second one closes it. It is the
milestone's exit criterion restated as work, which is the shape a task file is supposed to have.

**Acceptance criteria.**

Session 1 — the definition:
- [x] When the schema is read, the system shall define a manifest with slots for constitution/team
      principles, product layer, gate map, verify recipes, agent affordances, and provenance.
- [x] When a workspace covers more than one product, the schema shall permit a product layer and agent
      affordances **per product** rather than per workspace.
- [x] When a slot names a path, the schema shall require a whole file or directory and reject a
      `#fragment` target.
- [x] When this workspace is described, the system shall carry a manifest instance at
      [`../workspace.json`](../workspace.json).
- [x] When any tracked `.json` file is malformed, the verify recipe shall exit non-zero.
- [x] When every tracked `.json` file parses, the verify recipe shall exit zero.

Session 2 — the validator:
- [ ] When `doctor` runs against a workspace whose manifest violates the schema, it shall exit non-zero
      and name the violated constraint.
- [ ] When `doctor` runs against [`../`](../) and against the demo workspace, it shall exit zero.
- [ ] When a path slot names a target that does not exist, `doctor` shall report it as a failure.
- [ ] When a repo card's build/test/run lines or layout no longer match the tree, `doctor` shall report
      it — the claims lint.
- [ ] When a rule's provenance is neither a well-formed link nor a well-formed sealed stamp, `doctor`
      shall reject it; and it shall report the proportion of rules that are sealed.

**Verify.** `doctor` exits `0` against this workspace and against the demo, and non-zero against a
known-bad manifest fixture. **That fixture is not optional**: a validator that goes green on first
contact with a manifest written to satisfy it has demonstrated nothing. Until `doctor` exists the
standing checks are [`../verify/docs.sh`](../verify/docs.sh) and [`../verify/json.sh`](../verify/json.sh),
and neither reads the schema.

**Constraints.** The schema stays inside the JSON Schema subset named in
[`../../spec/README.md`](../../spec/README.md) — `doctor` carries its own validator, so a keyword the
validator does not implement must not appear. [`../../docs/vision.md`](../../docs/vision.md) is not
edited: the thesis-4 wording change that proposal 0002's adoption implies is the maintainer's, and this
task does not wait on it. The kernel is not touched.

**Context.** [`../../spec/slots.md`](../../spec/slots.md) — each slot and its derivation ·
[`../proposals/0002-sealed-provenance.md`](../proposals/0002-sealed-provenance.md) — the provenance
decision · [`../memory/three-workspaces-not-one.md`](../memory/three-workspaces-not-one.md) — the entry
that asked for the `kind` slot by name · [`../../docs/plan.md`](../../docs/plan.md) — the milestone-2 row.

**Lane.** full — new doctrine, a schema, a changed verify recipe, and milestone status all move.
[`../gate-map.md`](../gate-map.md) puts any one of those in the full lane on its own.
