# The slots, and where each came from

> Companion to [`workspace.schema.json`](workspace.schema.json). One section per slot: what it holds,
> **why it is a slot at all**, what it was derived from, and what `doctor` will check about it.
>
> The derivation column is not decoration. A schema is the easiest place in a product to smuggle in
> invention — a slot added for symmetry costs every future adopter a decision they did not need to make.
> Every slot below traces to at least one of three sources, and a slot that traced to none was cut:
>
> - **criterion** — the milestone-2 exit criterion in [`../docs/plan.md`](../docs/plan.md), which names
>   the slots this milestone owes.
> - **constitution** — [`../docs/vision.md`](../docs/vision.md): thesis 1's definition of a workspace
>   *(identity, stack, repo cards, gate map, verify recipes, rituals, DoD, glossary, memory, plus the
>   constitution and product-layer slots)*, or another clause named inline.
> - **content** — the one real workspace that existed when this was written,
>   [`../.portulan/`](../.portulan/). The plan sequences re-expression before schema on purpose: derive
>   the spec from real material rather than guessing it.
>
> Fragments below use `{braces}` for placeholders, as [`../core/templates/`](../core/templates/) does.
> Nothing here embeds customer zero's prose — it is cited by link, because a spec that quoted the first
> workspace would outlive it badly.

## The minimality rule

A slot is **required** only if a workspace lacking it breaks a promise the engine makes. Everything else
is optional, however good an idea it is. The pressure runs the other way — a schema author's instinct is
that a workspace *should* have memory, handoffs, and proposals — but a team adopting Portulan on a
Tuesday afternoon has none of those yet, and a definition that rejects them has made the first
experience a failure. *(Binding non-goal: no ceremony that can't scale down.)*

## Quick reference

| Slot | Carrier | Required | Derived from |
|---|---|---|---|
| `portulan.spec` | manifest | **yes** | constitution — the plan's Versioning protocol; migrations need a version to compare |
| `name` | manifest | **yes** | constitution — workspaces ship as plugins through a feed, so they need a stable identifier |
| `kind` | manifest | **yes** | content — [`three-workspaces-not-one.md`](../.portulan/memory/three-workspaces-not-one.md); constitution — *Reference workspaces* |
| `summary` | manifest | no | constitution — attention budgets per layer |
| `slots.identity` | path | **yes** | constitution — thesis 1 *(identity, stack, glossary)*; content — [`identity.md`](../.portulan/identity.md) |
| `slots.principles` | path | **yes** | criterion — *constitution … slots (team principles)*; content — [`principles.md`](../.portulan/principles.md) |
| `slots.constitution` | path | no | content — customer zero is graded against a document outside its workspace; constitution — spec-driven school, the constitution file |
| `slots.gates` | path | **yes** | criterion — *gate map*; constitution — [`autonomy.md`](../core/operating/autonomy.md) puts the map in the workspace |
| `slots.dod` | path | no | constitution — thesis 1 *(DoD)*; [`verification.md`](../core/operating/verification.md) — core supplies the floor |
| `slots.memory` | path | no | constitution — thesis 1 *(memory)*; [`memory.md`](../core/operating/memory.md) |
| `slots.repos` | path | no | constitution — thesis 1 *(repo cards)*; [`repo-card.md`](../core/templates/repo-card.md) |
| `slots.tasks` | path | no | content — [`tasks/`](../.portulan/tasks/); constitution — BMAD, the story file as atomic context unit |
| `slots.handoffs` | path | no | content — [`handoffs/`](../.portulan/handoffs/); [`loop.md`](../core/operating/loop.md) — every session ends with one |
| `slots.proposals` | path | no | content — [`proposals/`](../.portulan/proposals/); [`evolution.md`](../core/operating/evolution.md) |
| `verify` | structured | **yes** | criterion — *verify recipes*; [`verification.md`](../core/operating/verification.md) — the workspace sets the default |
| `products[]` | structured | no | criterion — *product-layer slot … portfolio-aware*; content — [`identity.md`](../.portulan/identity.md) |
| `affordances` | path | no | criterion — *agent-affordances slot*; constitution — the agent-native / AX row of the influence map |
| `packs` | structured | no | constitution — thesis 1's cascade, `core < pack < workspace` |
| `provenance` | record field | **on every rule** | criterion — *provenance slot*; [proposal 0002](../.portulan/proposals/0002-sealed-provenance.md), adopted |

## `kind` — which of the three workspaces this is

The strongest single piece of evidence in the tree asked for this slot by name. The memory entry
[`three-workspaces-not-one.md`](../.portulan/memory/three-workspaces-not-one.md) records its own
retirement condition as *"the Workspace Definition (milestone 2) names and distinguishes the three
formally"* — so the schema is not inventing a distinction, it is discharging one the workspace had
already written down and was waiting on.

`repository` · `demo` · `portfolio`. **What `doctor` checks:** that the value is one of the three. What it
cannot check is the thing that matters — whether a `demo` workspace actually carries no real internal
policy. That stays human review, and it is the reason the slot is required rather than inferred from a
path: an author who has to type `demo` has been asked the question.

## `slots.identity` and `slots.principles` — and why they are two

Thesis 1 lists identity, stack, and glossary as one cluster; the criterion separately names a
constitution slot glossed as *team principles*. Customer zero had all of it in one document, and the
split was forced by the no-fragments rule rather than chosen: two slots cannot address two halves of one
file when a slot must be a whole file.

The split turned out to be the right cut anyway. **Identity** answers *who we are and what we work with*
— team shape, stack, glossary. **Principles** answers *how we decide*, and it is the half other work is
graded against. They change on different clocks: a stack row turns over every year or two, a principle
almost never.

**What `doctor` checks:** both resolve to files that exist.

## `slots.constitution` — optional, and the one slot expected to escape

The criterion glosses the constitution slot as team principles, which is right for most adopters: their
principles *are* the standard they are graded against. Customer zero is the case that shows those can be
two different things — its principles are workspace policy, while
[`../docs/vision.md`](../docs/vision.md) is the product's constitution, human-owned, sitting outside the
workspace directory entirely.

So the schema takes both: `principles` is required and lives in the workspace; `constitution` is optional
and may point anywhere. Had containment been required, `doctor`'s first run against its own author's
workspace would have gone red for a schema-design reason rather than a content one — a good early
warning, arriving after the design was frozen.

**What `doctor` checks:** the path resolves. It also **reports — never fails —** when *any* path slot's
target escapes the workspace directory. The distinction matters for whoever implements it: the schema
permits escaping everywhere, because a `pattern` sees a string and not the key it belongs to, so "only
`constitution` may escape" is a convention this document states and `doctor` surfaces, not a constraint
the schema carries. Reporting is the right severity — a workspace embedded in a larger repository may
legitimately reach for a shared document, and failing would make the tool wrong about a case it cannot
see.

## `slots.gates` — the policy half of autonomy

[`autonomy.md`](../core/operating/autonomy.md) defines the tiers as universal mechanism and says
explicitly that which concrete action lands in which tier is workspace policy. That makes the gate map
the one slot where core has already promised the workspace will answer, so a workspace without it leaves
an engine promise unfulfilled — required, by the minimality rule's own test.

**What `doctor` checks:** the path resolves; and, from the second milestone-2 session, that the gate map
does not claim enforcement the repository does not have — the claims-against-the-tree lint.

## `verify` — the only slot that is structured because it is *consumed*

Every other content slot points at Markdown for a human. This one carries data because the Stop-gate
needs an answer, not a paragraph: which recipe runs when nothing more specific applies. A prose sentence
saying "run the docs recipe" cannot be dispatched.

```json
"verify": {
  "default": "{recipe-id}",
  "recipes": [
    { "id": "{recipe-id}", "run": "{command}", "requires": ["{tool}"], "doc": "{path}" }
  ]
}
```

`requires` exists because of an exit code. The recipes distinguish *red* (exit 1, the check ran and
failed) from *could not run* (exit 2, a tool is missing), and that distinction is worthless if nothing
declares what was needed. Customer zero now has two recipes with different needs — one POSIX-only, one
requiring `node` — which is exactly the case that made the field earn its place.

**What `doctor` checks:** `default` names a recipe that exists in `recipes`; each `doc` resolves. It does
**not** run the recipes, and it does not check that `requires` is honest — a recipe that quietly needs a
tool it did not declare passes. That is a real gap; the honest fix is executing them, which belongs to
the Stop-gate runner in milestone 4.

## `products[]` — repeated, even though customer zero has one

The criterion says *portfolio-aware: many products per workspace*, and the vision's Reference workspaces
bullet describes a Sleepy Panda workspace covering **all** Sleepy Panda products. So the product layer is
per-product from the start, not a workspace-level field that a later milestone has to unpick.

This is the schema's most deliberate act of resisting its own evidence. Derived faithfully from the only
available sample, `products` would be a singular object — customer zero has exactly one product, and a
one-sample derivation would have modelled it that way, correctly for today and wrongly for milestone 6.

```json
"products": [
  { "id": "{id}", "name": "{Display Name}",
    "product": "{path}", "affordances": "{path}", "repos": ["{repo-card-name}"] }
]
```

`products` is optional: a team adopting Portulan for one repository need not name a product at all, and
the engine still resolves everything else. Note the distinction that keeps this honest — the *definition*
has a product-layer slot, which is what the criterion requires; *instances* may leave it empty.

**What `doctor` checks:** each `product` path resolves; each `affordances` path **that is present**
resolves; each `repos` entry names a card in the `repos` slot. Per-product `affordances` is optional
because a product may inherit the workspace-level default — so the check is conditional, and `doctor`
*reports* a product that has neither its own nor an inherited one rather than failing it. (An earlier
draft of this line said `doctor` checks `affordances` unconditionally, which would have made the spec
demand something the schema declares optional; caught in review of the change that introduced it.) The
claim it cannot check is whether the mission written there is still true.

## `affordances` — what the product offers an agent

The unclaimed niche in the influence map: *agent-legibility, repo affordances scored by `doctor`*. The
slot holds what an agent can rely on — entry points, contracts, budgets, commands — **and** what it must
not assume, which is the half that makes the document worth reading. Customer zero's
[affordances document](../.portulan/products/portulan/affordances.md) is a filled example.

It resolves down the cascade *inside* the workspace: a workspace-level `affordances` is the default, and
a product may override it. That is thesis 1's more-specific-wins rule applied one level lower, and it
exists because a portfolio workspace covering a Markdown framework and a deployed service cannot offer
one honest answer for both.

**What `doctor` checks:** the path resolves. **What it does not do is score anything.** The
agent-legibility score named in the vision's delivery tiers is not built, and this slot is the input such
an audit would read, not the audit. One memory entry
([`readme-map-must-match-shape.md`](../.portulan/memory/readme-map-must-match-shape.md)) records its own
retirement as conditional on that score superseding the README map — worth stating plainly that this
milestone does **not** fire that condition.

## `packs` — the cascade's missing middle

Nothing in the criterion asks for this, and it is included anyway, which needs justifying. The cascade is
`core < pack < workspace < repo card < task`; every layer but one is addressable from a manifest, and a
workspace that cannot say which packs it composes leaves an agent to infer the middle of its own
resolution order. The portfolio workspace at milestone 6 ships as a private-feed plugin composing premium
packs — a manifest that cannot express that forces a MAJOR bump one milestone after v1.

An array of names in cascade order, empty by default. **What `doctor` checks:** that the names are
unique. Resolving a pack to an installed plugin needs the plugin machinery from milestone 3 and the feed
from milestone 6; until then this slot is a declaration, and `doctor` will say so rather than pretending
to verify it.

## `provenance` — a record field, not a manifest key

The criterion lists a provenance slot beside the others, but it does not belong in the manifest, and
saying why is more useful than quietly filing it somewhere. Provenance is a property of **a rule**, and
rules do not live in the manifest — they live in memory entries and proposals, which are Markdown. A
manifest key would have described a workspace's *policy about* provenance while leaving every actual
rule unchecked.

So the schema defines the **shape** in `$defs/provenance` and the records carry instances of it:
one definition, two carriers. `doctor` parses a record's `provenance:` field into that shape and
validates it.

Adopted 2026-07-25 by the maintainer from
[proposal 0002](../.portulan/proposals/0002-sealed-provenance.md). Two forms, one of them mandatory:

```
provenance: form=link   href={ticket | PR | postmortem | commit}
provenance: form=sealed owner={who can re-validate} date={YYYY-MM-DD} shape={the de-identified failure}
```

**Why two.** Thesis 4 requires every rule to link to the incident that created it; thesis 6 requires a
team's specifics to stay in the layer their owner controls. A rule generalised upward out of a private
incident collides with both — it must either carry a link it is not allowed to hold, or drop provenance
and become un-retirable. The sealed form is the declared-weak option: the stamp and the mechanism travel,
the episode does not.

**Honest limits, carried from the proposal rather than lost in adoption:**

- **The machine checks the stamp's form, never its truth.** A fabricated sealed stamp passes exactly as a
  real one does. What guards the content is the *generic must never decay into vague* bar in
  [`codify` step 1](../core/skills/codify/SKILL.md) plus human review — the machine catches absence, the
  human judges substance.
- **"Resolvable" means well-formed, not fetched.** `doctor` validates a link's shape and does not
  dereference it. A gate that needs the network fails for reasons unrelated to the change under test, and
  a flaky gate is worse than no gate — this workspace already refuses network-dependent checks.
- **A sealed rule is not as good as a linked one.** It is *declared* weak instead of silently absent.
  `doctor` therefore reports the **sealed proportion**: a workspace where everything is sealed has
  quietly opted out of retirement altogether, and that is a health signal rather than a curiosity.
- **Adopting this was a constitutional interpretation.** It decides how thesis 4's "links to the
  incident" reads in the collision case. The maintainer accepted it and reserved the matching wording
  change in [`../docs/vision.md`](../docs/vision.md) to his own hand; until that lands, the constitution
  still reads "links" while this spec permits a stamp. Recorded here rather than smoothed over, because
  the gap is exactly the kind this product exists to stop hiding.

## Considered and left out

Each of these was a candidate; none is an oversight.

- **`rituals` as its own slot.** Thesis 1 names rituals in its workspace definition. But rituals ship as
  packs ([`../packs/rituals/`](../packs/rituals/)), so a workspace composes them through `packs` and a
  second slot would be two ways to say one thing. Revisit if a workspace-local ritual ever needs a home
  that is not a pack.
- **`stack` and `glossary` as slots.** Both are named in thesis 1 and both live inside `identity.md`
  today. Splitting them buys nothing until something *consumes* them — a stack pack selecting itself
  from a declared stack would be that consumer, and it does not exist. Splitting on speculation is how a
  schema acquires slots nobody fills.
- **A sealed-owner registry.** Sealed stamps name an owner as free text; a workspace-level list of valid
  owners would let `doctor` catch typos. Deferred: it adds a required-to-maintain list for a check that
  catches a mild failure, and the librarian's nagging (milestone 5) is the mechanism that will actually
  need it.
- **A per-host capability matrix.** The vision's `doctor` includes a per-host capability report, but that
  is generated from the host and the compiled gates, not declared by the team. It belongs with the
  enforcement backends in milestone 4.
- **`evals`.** Milestone 8 owns the eval harness; a slot pointing at golden tasks before any exist would
  be the emptiest kind of scaffolding.

## What v1 is not

- **It has been derived from one workspace and validated against none.** A schema meets its real test on
  its *second* instance, and that is the fictional demo in [`../examples/`](../examples/), which does not
  exist yet. Expect this document to change when it does; the milestone stays open until it has.
- **No `doctor`.** Everything above written as "what `doctor` checks" is a specification of intent. Today
  the only machinery is that the JSON parses.
- **Nothing here describes how a workspace is *installed*.** Workspaces ship as plugins through a feed;
  that packaging is milestone 3 for the public path and milestone 6 for the private one.
