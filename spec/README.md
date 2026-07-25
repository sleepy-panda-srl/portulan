# spec/

The **Workspace Definition** — the contract between the engine and a team's own layer. `core/` is
mechanism and is identical for everyone; a workspace is the half that is theirs, and this directory is
what makes that half machine-readable instead of a folder convention.

- [`workspace.schema.json`](workspace.schema.json) — the manifest schema, normative.
- [`slots.md`](slots.md) — every slot: what it holds, why it exists, where it was derived from, and what
  `doctor` checks about it. The rationale lives there; this file is the orientation.

## The manifest is an index, not a container

A workspace's content is Markdown, and it stays Markdown. The manifest names the slots and points at the
documents that hold each one — so the *why* stays next to the rule, where a human reads it, and the
machine gets a contract it can check. A manifest that absorbed the prose would put the product's actual
value in a file nobody enjoys reading.

That splits the slots in two, and the distinction is worth naming because it decides what `doctor` can
say about each:

- **Path slots** — `slots.*`, the workspace-level `affordances`, `tree`, `products[].product`,
  `products[].affordances`, and `verify.recipes[].doc` — resolve to a file or a directory. `doctor` can
  check they exist and that what they claim matches the tree. The list is exhaustive on purpose:
  `doctor`'s existence checks are derived from it, so a path field missing here is a path field nothing
  will ever check.
- **Structured slots** (`verify`, `products`, `packs`) are data in the manifest itself, because they are
  consumed rather than read — the Stop-gate needs to know *which* recipe is the default, and no amount
  of prose gives it that.

Two rules follow, and both were forced by real defects rather than chosen for tidiness:

1. **No `#fragment` targets.** A slot must be a whole file. This repository's own `links` check cannot
   validate fragments ([`../.portulan/verify/README.md`](../.portulan/verify/README.md)), so a slot
   addressed by anchor would be unlintable by construction — the slot would exist and nothing could ever
   confirm it pointed anywhere real.
2. **A path slot may point outside the workspace directory.** Two slots are *expected* to.
   `constitution`, because a product's constitution normally lives with the product, not with the
   workspace — customer zero is the first proof: its constitution is `docs/vision.md`, one level up. And
   `tree`, which names the repository a workspace makes claims *about* and would be pointing at the
   wrong thing if it did not escape. A schema that required containment would have failed on its own
   author's workspace.

   The schema cannot express *which* slot may escape — a `pattern` sees one string, not which key it
   belongs to — so escaping is legal everywhere and `doctor` **reports** rather than fails when any slot
   other than `constitution` does it. Reporting rather than failing is the right severity: a workspace
   embedded in a larger repository may legitimately reach for a shared document, and a hard failure
   would make the schema wrong about a case it cannot see.

## The three kinds

`kind` is required, and it is not bookkeeping. A **demo** workspace is written to be read by strangers
and must carry no real internal policy; a **repository** workspace is a team dogfooding on their own
product; a **portfolio** workspace covers many products at once. Confusing them produces the two failures
that actually cost something: real internal policy published in a demo, or a demo written as merely
illustrative when it is the only complete worked example an evaluator will ever read.

## Required versus optional

A slot is **required** only when a workspace without it breaks a promise the engine makes. That is the
whole test, and it is deliberately strict — a day-one workspace has no proposals, no handoffs, and no
memory yet, and it must still validate. Ceremony that cannot scale down is a binding non-goal.

Required: `portulan.spec`, `name`, `kind`, `slots.identity`, `slots.principles`, `slots.gates`, `verify`
— plus `tree` when `kind` is `repository`, which is the one conditional requirement and the one the
schema cannot express (the subset has no `dependentRequired`; `doctor` enforces it and
[`slots.md`](slots.md) says so). Everything else is optional. [`slots.md`](slots.md) argues each one.

Note the distinction that does the work here: the *definition* carries a slot, while an *instance* may
leave it empty. "The Workspace Definition has a product-layer slot" and "every workspace must declare a
product" are different claims, and only the first is true.

## Versioning and migrations

`portulan.spec` is `MAJOR.MINOR`, and the current version is **2.0**.

- **MINOR** — additive only: new optional slots, relaxed constraints. An older manifest stays valid, and
  `doctor` says so rather than staying silent about it.
- **MAJOR** — anything that can invalidate a manifest that used to pass: a new required slot, a removed
  or renamed one, a tightened constraint. A MAJOR bump ships with a migration.

`doctor` reads `portulan.spec` before it validates anything. A manifest naming a MAJOR it does not
implement, or a MINOR ahead of it, is **refused** — exit `2` — rather than graded against the version it
happens to carry, because grading a manifest against a contract it was not written for produces confident
nonsense: a slot added in a later MINOR comes back as an unexpected property, and the report blames the
author for using the spec correctly.

## Migration 1.0 → 2.0

The only migration so far, and it is deliberately taken while it costs nothing.

**What changed.** The `tree` slot was added, and a workspace whose `kind` is `repository` must now declare
it. `demo` and `portfolio` may omit it. Nothing else.

**How to migrate.** A `repository` workspace adds one line — `"tree": "../"` for the common case, a
workspace directory sitting one level inside the repository it describes — and sets `portulan.spec` to
`2.0`. A `demo` or `portfolio` workspace changes the version and nothing else.

**Why a MAJOR for one constraint, now rather than later.** `tree` began as an optional slot, and optional
was a hole: deleting one manifest line degraded the entire claims-lint class from *checked* to *reported*,
GREEN, exit `0`. That is a fail-open in gate machinery, defended by "review would notice" — on the one
edit review is worst at noticing, a removed line. The trade was priced at the only moment it is cheap: two
manifests exist, one already declared `tree` and the other is a `demo` and exempt, so the migration was a
version bump and a note with **zero manifest edits**. Every milestone toward public makes a MAJOR strictly
more expensive, and deferring would have carried the hole across the milestone-3 flip — the window when
outside readers first probe this spec. It also exercises the migration path while the blast radius is
zero, which is the same reasoning that made the demo workspace worth building: a migration whose first run
is on a real adopter is a claimed capability, not a demonstrated one.
_(Adopted from [proposal 0005](../.portulan/proposals/0005-a-repository-workspace-must-declare-its-tree.md).
`kind` is still self-declared, so the escape narrows from *omit a line* to *lie about what you are* —
better, and not a fix.)_

There is still no `migrations/` directory: this migration is a paragraph and a version bump, and a
directory holding a document that says "add one line" would be scaffolding pretending to be machinery.
One arrives when a migration needs code.

The schema sets `additionalProperties: false` throughout. Unknown keys fail rather than being ignored,
because the common case is a typo in a slot name, and a silently-ignored `principals` would leave a
workspace with no constitution slot and a green report.

## What actually validates any of this, today

| Artifact | Checked by | Status |
|---|---|---|
| Every `.json` file parses | [`../.portulan/verify/json.sh`](../.portulan/verify/json.sh) | **Built.** Well-formedness only — it does not read the schema. |
| Manifest conforms to the schema | [`../cli/doctor.mjs`](../cli/doctor.mjs) | **Built.** Names the violated constraint and its location. |
| Path slots resolve to real files | `doctor` | **Built.** File-versus-directory too; a slot resolving outside the workspace is reported, never failed. |
| Workspace claims match the tree | `doctor` | **Built, where a tree is declared** — repo-card build/test/run lines and layout, and the gate map's required-check claim. A workspace with no `tree` has those claims *reported unverifiable*. |
| A rule's provenance is well-formed | `doctor` | **Built.** On `type: rule` records in the `memory` slot; the form only, never the truth. |
| Sealed proportion reported | `doctor` | **Built.** Over rules, which is the denominator the mandate uses. |
| The recipes a workspace declares actually run | Stop-gate runner | Milestone 4. `doctor` reads recipes and never executes one. |
| A rule's link resolves | — | Not built, and not planned as a gate: dereferencing needs the network, and a gate that fails for reasons unrelated to the change under test is worse than no gate. |
| Agent-legibility scored | `doctor` | Not built. The `affordances` slot is the input such an audit would read; it is not the audit. |

As of milestone 2 the schema is a rail rather than only a specification — but read the right-hand column
rather than the middle one. `doctor` checks that a workspace's claims are **well-formed and resolvable**;
almost nothing it checks is a claim about whether the workspace's content is *true*. It is run by CI on
every pull request here, because [`../.portulan/workspace.json`](../.portulan/workspace.json) declares it
as a verify recipe and the workflow runs every recipe the manifest declares.

## The JSON Schema subset

`doctor` will carry its own validator rather than a dependency, so the schema is written in a subset
small enough to implement completely and honestly. **Full JSON Schema 2020-12 is not supported and will
not be claimed.** The subset is exactly:

`$schema` · `$id` · `$defs` · `$ref` (local, `#/$defs/…` only) · `title` · `description` · `type` ·
`properties` · `required` · `additionalProperties: false` · `items` · `enum` · `pattern` · `minLength` ·
`minItems` · `uniqueItems` · `oneOf`

Two notes a validator author needs. **`$ref` may carry sibling `description` and `title`** — used where a
field reuses a shared definition but deserves its own prose, as `name` and `verify.default` both do with
`$defs/slug`; siblings are annotations and never affect validation. And **every id-shaped field routes
through `$defs/slug`** rather than repeating a pattern, so the field that *declares* an id and the field
that *points at* one cannot drift apart — `verify.default` originally carried only a length constraint,
which let a manifest name a default no recipe could ever match.

A schema change that reaches outside this list is a change to `doctor` too, and the two land together.
`$id` is an identifier, not a live endpoint — nothing is served at that URL until the docs site in
milestone 10.

**Formats are JSON across the product**, not only here: machine inputs are JSON, and the *why* that would
otherwise live in comments belongs in the Markdown the manifest points at. That is a maintainer decision
of 2026-07-25 covering the enforcement compiler's input too.

## Reading an instance

The first real instance is customer zero's own manifest,
[`../.portulan/workspace.json`](../.portulan/workspace.json) — the material this schema was derived from,
rather than an example written to flatter it.

The **second** is [`../examples/`](../examples/), a fictional workspace covering two products, and it is
the one that actually tested the schema: a definition derived from a single sample has not been tested
until it meets a differently-shaped one. It exercises what customer zero cannot — repeated products,
affordances resolving down the cascade, declared packs, a workspace-level default, and a sealed
provenance stamp — and it is where the `tree` slot came from, because writing a workspace whose
repositories are *not present* is what exposed that the claims lint had no way to say so.

Illustrative fragments in [`slots.md`](slots.md) use `{braces}` for placeholders, the same convention as
[`../core/templates/`](../core/templates/).
