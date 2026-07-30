# The slots, and where each came from

> Companion to [`workspace.schema.json`](workspace.schema.json). One section per slot: what it holds,
> **why it is a slot at all**, what it was derived from, and what [`doctor`](../cli/doctor.mjs) checks
> about it. Every "what `doctor` checks" line below was a specification of intent when this file was
> written and is a description of behaviour now — the second milestone-2 session built the validator,
> and where it does **less** than a line here promised, the line says so rather than being quietly
> softened.
>
> The derivation column is not decoration. A schema is the easiest place in a product to smuggle in
> invention — a slot added for symmetry costs every future adopter a decision they did not need to make.
> Every slot below traces to at least one of three sources, and a slot that traced to none was cut:
>
> - **criterion** — the milestone-2 exit criterion in [`../docs/plan.md`](../docs/plan.md), which names
>   the slots this milestone owes.
> - **constitution** — [`../docs/vision.md`](../docs/vision.md): thesis 1's definition of a workspace, or
>   another clause named inline. The parenthetical is deliberately **not** reproduced here. A quotation of
>   the constitution inside a document about accurate derivation is a drift surface, and this one had
>   already drifted: an earlier draft appended the milestone-2 criterion's *"plus the constitution and
>   product-layer slots"* to thesis 1's own list, which does not contain that phrase. Follow the link.
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
| `slots.identity` | path | **for a governing kind** | constitution — thesis 1 *(identity, stack, glossary)*; content — [`identity.md`](../.portulan/identity.md) |
| `slots.principles` | path | **for a governing kind** | criterion — *constitution … slots (team principles)*; content — [`principles.md`](../.portulan/principles.md) |
| `slots.constitution` | path | no | content — customer zero is graded against a document outside its workspace; constitution — spec-driven school, the constitution file |
| `slots.gates` | path | **for a governing kind** | criterion — *gate map*; constitution — [`autonomy.md`](../core/operating/autonomy.md) puts the map in the workspace |
| `slots.dod` | path | no | constitution — thesis 1 *(DoD)*; [`verification.md`](../core/operating/verification.md) — core supplies the floor |
| `slots.memory` | path | no | constitution — thesis 1 *(memory)*; [`memory.md`](../core/operating/memory.md) |
| `slots.repos` | path | no | constitution — thesis 1 *(repo cards)*; [`repo-card.md`](../core/templates/repo-card.md) |
| `slots.tasks` | path | no | content — [`tasks/`](../.portulan/tasks/); constitution — BMAD, the story file as atomic context unit |
| `slots.handoffs` | path | no | content — [`handoffs/`](../.portulan/handoffs/); [`loop.md`](../core/operating/loop.md) — every session ends with one |
| `slots.proposals` | path | no | content — [`proposals/`](../.portulan/proposals/); [`evolution.md`](../core/operating/evolution.md) |
| `verify` | structured | **for a governing kind** | criterion — *verify recipes*; [`verification.md`](../core/operating/verification.md) — the workspace sets the default |
| `governed_by` | manifest | **for `kind: pointer`** | the maintainer's residence ruling, 2026-07-30 — [proposal 0017](../.portulan/proposals/0017-one-repository-one-governing-workspace.md); one repository, one governing workspace |
| `products[]` | structured | no | criterion — *product-layer slot … portfolio-aware*; content — [`identity.md`](../.portulan/identity.md) |
| `affordances` | path | no | criterion — *agent-affordances slot*; constitution — the agent-native / AX row of the influence map |
| `tree` | path | **for `kind: repository`** | criterion — *lints workspace claims against the tree*; content — [`../examples/`](../examples/), the first workspace whose repositories are not present |
| `packs` | structured | no | constitution — thesis 1's cascade, `core < pack < workspace` |
| `memory` | structured | no | criterion — milestone 5, *generated size-budgeted index whose budget is a rail*; [`memory.md`](../core/operating/memory.md) — the Index and Consolidate states of the lifecycle |
| `handoffs` | structured | no | criterion — milestone 5 as amended, *a generated index over the handoff series*; [`loop.md`](../core/operating/loop.md) — the librarian that mines the series |
| `provenance` | record field | **on every rule** | criterion — *provenance slot*; [proposal 0002](../.portulan/proposals/0002-sealed-provenance.md), adopted |

## `kind` — which of the four workspaces this is, and which of them governs

The strongest single piece of evidence in the tree asked for this slot by name. The memory entry
[`three-workspaces-not-one.md`](../.portulan/memory/three-workspaces-not-one.md) records its own
retirement condition as *"the Workspace Definition (milestone 2) names and distinguishes the three
formally"* — so the schema is not inventing a distinction, it is discharging one the workspace had
already written down and was waiting on.

`repository` · `demo` · `portfolio` — the three that **govern** — and, added at 2.7, `pointer`, which
does not. **What `doctor` checks:** that the value is one of the four, and then which form the manifest
must take (below). What it cannot check is the thing that matters about the first three — whether a
`demo` workspace actually carries no real internal policy. That stays human review, and it is the reason
the slot is required rather than inferred from a path: an author who has to type `demo` has been asked
the question.

### `pointer` — a repository whose workspace resides elsewhere

Added at **2.7**, from the maintainer's residence ruling of 2026-07-30
([proposal 0017](../.portulan/proposals/0017-one-repository-one-governing-workspace.md)):

> A repository is governed by exactly one workspace. It carries its own full workspace, or a pointer to
> the workspace that names it — never both.

A team's workspace can reside in two places, and the choice is the customer's: **in the repository**, the
shape customer zero has, self-contained and feed-independent; or **feed-side**, in a portfolio workspace
that names the repository, which reaches many repositories at once and keeps team context out of product
trees whose audiences may be wider. They are one artifact in two residences. What differs is reach and
delivery; what does not differ is what the workspace contains, or what a customer can do with it.

Which is exactly why both may not be present at once. Two residences of the same thing are not two
things — they are one thing written down twice, with nothing holding the copies in agreement. `pointer`
is what makes the second residence expressible without a second copy: a manifest that names its governor
and carries nothing else.

**Why a `kind` value rather than a separate file.** The boot skill looks for exactly one path,
`${CLAUDE_PROJECT_DIR}/.portulan/workspace.json`, and does not search outward. A pointer that lived
anywhere else would be invisible to the one thing that most needs to read it, and a repository governed
from a feed would be indistinguishable from a repository that never adopted Portulan.

**What `doctor` checks:** that a pointer carries `governed_by` and nothing but `governed_by` — the
schema requires the first through its `oneOf`, `doctor` refuses the second in the ruling's own words. It
also skips every governing-workspace check for a pointer **and says so**: a pointer declares no recipes,
so `verify.default` alone would fail every compliant one, and a check that vanishes without a word is
worse than one that admits what it could not reach.

**What nothing checks:** that the workspace a pointer names exists, or governs, or is green. Resolving
`governed_by` needs a host's plugin cache, and this tool does not do discovery — see
[`README.md`](README.md)'s coverage table, where the gap has its own row.

## `slots.identity` and `slots.principles` — and why they are two

Thesis 1 lists identity, stack, and glossary as one cluster; the criterion separately names a
constitution slot glossed as *team principles*. Customer zero had all of it in one document, and the
split was forced by the no-fragments rule rather than chosen: two slots cannot address two halves of one
file when a slot must be a whole file.

The split turned out to be the right cut anyway. **Identity** answers *who we are and what we work with*
— team shape, stack, glossary. **Principles** answers *how we decide*, and it is the half other work is
graded against. They change on different clocks: a stack row turns over every year or two, a principle
almost never.

**What `doctor` checks:** both resolve to files that exist — files specifically, not directories, since
both are declared `filePath`.

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

One consequence worth naming before `doctor` is written: this slot takes `$defs/path`, which admits a
directory as well as a file, so `"constitution": "docs/"` validates. That is deliberate — a team's
constitution may genuinely be a folder rather than one document — and it means `doctor` resolves the
target without assuming it is a file. Same severity as an escape: report what it found, do not fail.

## `slots.gates` — the policy half of autonomy

[`autonomy.md`](../core/operating/autonomy.md) defines the tiers as universal mechanism and says
explicitly that which concrete action lands in which tier is workspace policy. That makes the gate map
the one slot where core has already promised the workspace will answer, so a workspace without it leaves
an engine promise unfulfilled — required, by the minimality rule's own test.

**One convention this slot carries, and it is load-bearing.** `doctor` finds the required-check claim by
looking for a Markdown table row whose first cell matches **`required status check`** (case-insensitive)
and reading the backticked values from the rest of the row. That is the only structure the tool expects
of a gate map — everything else in the file is prose it never parses. It is written here because nothing
else states it: there is no gate-map template in [`../core/templates/`](../core/templates/), so an adopter
whose floor table uses a different row label gets the check **skipped** — no comparison happens at all.
It is no longer *silent*: `doctor` reports that the gate map names no required status check, and names
both readings, so a reader cannot mistake *this workspace requires none* for *I did not recognise your
table*. (It was silent — nothing reported, nothing counted — until a review measured it.) Naming the
convention is the cheap fix; a template is the better one and is not built.

**What `doctor` checks:** the path resolves; and, where the workspace declares a `tree`, that **every**
status check the gate map says `main` requires is one a workflow in that tree actually reports. That is
the gate map's half of the claims-against-the-tree lint, and it is narrower than "does not claim
enforcement the repository does not have": it compares named contexts against what the workflows declare.

Two details cost a false green each before a third workspace exposed them, and both are worth knowing
before writing a gate map. **A job's reported context is its `name:` when it has one, and its id
otherwise** — so a gate map naming the id of a job that carries a display name names something no check
will ever report, and `doctor` says exactly that rather than "no such job". And **a row may name several
checks**; reading only the first silently exempts the rest. Neither could surface on customer zero, whose
workflow deliberately sets no `name:` so that id and context coincide, and which requires exactly one
check.

Whether branch protection *really* requires those contexts, and which app they are pinned to, are live
settings — and a network call is not something a verify recipe here is allowed to make. Worth knowing
when checking by hand: a branch protected by a **repository ruleset** returns `404 Branch not protected`
from the classic `…/branches/main/protection` endpoint, which is a check reporting *not clear* about
something that is fine.

## `gates` — the policy, as distinct from the argument for it

**Added in 2.1, optional.** A path to a JSON file the enforcement compiler reads. It is a *second* key
beside `slots.gates`, and the duplication is the point rather than an oversight: they answer different
questions and only one of them compiles.

- **`slots.gates`** → Markdown. *Why* an action sits in a tier. Read by humans; no tool dispatches on it.
- **`gates`** → JSON. *Which* action sits in which tier, in a vocabulary a backend can translate.

The alternative shapes were both considered and both refused. **Generating the prose from the JSON** adds
a build step to a product whose thesis is that the files *are* the product. **Extracting the JSON from the
prose** needs the ambitious parser this document already warns against elsewhere — it would produce false
reds, and a false red is what gets a whole check switched off.

So two files state one policy, which is this repository's signature defect, and it is contained rather than
denied: every rule carries an `id`, the prose cites those ids in code spans, and **membership is checked
both ways** — a rule with no mention, or a mention with no rule, fails. The forward direction is exact. The
reverse recognises a citation by *shape*, so it is a strong check rather than a total one, and the workspace
that implements it says so at the point of use. What no check can hold is whether a
*sentence* contradicts the rule it names. Hence the tie-break, stated in both files: **where they disagree,
the policy wins**, because it is the one that compiles.

### The action vocabulary is the workspace's, never a host's

A rule says `{"shell": "git push"}`, not `Bash(git push:*)`. That is what keeps "LLM-agnostic by
construction" true at this layer: a second backend translates the same policy instead of forcing every
adopter to rewrite theirs. It is cheapest to hold while exactly one backend exists, which is why it was
held then.

### Four tier classes, where core names three

`auto` · `propose` · `gated` · **`prohibited`**. The fourth is not a stronger `gated` — it is a different
answer. Gated means *approvable per action* and compiles to a prompt; prohibited means *no approval
exists* and compiles to a refusal. A three-class policy would file "no agent edits the constitution" under
Gated, and the compiler would then emit a prompt — turning *never* into *unless someone clicks yes*.

### What a compiler must do with it

Two obligations, both learned from defects rather than designed in the abstract:

1. **Account for every rule.** Each ends as *compiled* or *refused with a stated reason*, and the two
   counts sum to the input. A rule that goes in and produces nothing leaves a policy that reads as
   enforced and a machine that enforces nothing.
2. **Refuse what it cannot compile.** An unknown tier or action shape fails the *whole* compile rather
   than dropping one rule — skipping and enforcing are indistinguishable from outside
   ([`../.portulan/memory/a-checker-must-refuse-what-it-cannot-check.md`](../.portulan/memory/a-checker-must-refuse-what-it-cannot-check.md)).

### `floor` — the platform floor this policy compiles to

**Added in 2.2, optional**, inside the gate policy rather than the manifest — it is policy, and policy
lives where the rules live. Four keys, and each one exists because it varies per repository and the
floor backend would otherwise have to guess it:

| Key | What it declares |
|---|---|
| `branch` | The ref the floor protects. No default: a compiler that invents the ref it gates has stopped compiling policy and started writing it. |
| `checks` | The status checks that must be green, each `{ context, integration_id? }`. An unpinned context is satisfiable by *any* app reporting that name — permitted, and reported by `doctor`. |
| `reviews` | Required approving reviews. Declared rather than defaulted: 0 and 1 are a real difference, and a repository with one maintainer cannot use 1, because GitHub does not permit approving one's own pull request. |
| `resolve_conversations` | Whether review threads must be resolved before merge. Omitting it would export a floor weaker than the one many repositories already run. |

**What is deliberately NOT declarable is `strict`.** A pull request may not merge from behind its base
([proposal 0011](../.portulan/proposals/0011-no-merge-from-behind-main.md), applied live on
2026-07-27), so the export forces strict required status checks unconditionally. A policy able to
declare `strict: false` would be a compiled artifact quietly undoing a ruling, in a diff nobody would
read as one.

A workspace with no `floor` compiles no floor: the backend refuses every rule *by name*, says the key
is missing, and writes nothing. That is a legitimate shape — a workspace whose repositories are not on
GitHub, or whose floor is configured by hand, or which has not got there yet. It is **not** the demo
workspace's, which declares no gate policy at all and so never reaches this backend; saying otherwise
would credit a fixture with exercising a path it does not.

**What `doctor` checks:** that the path resolves; that every `floor.checks` context is reported by a
workflow job in the declared tree (a **failure** — a required context that never reports blocks every
pull request, and `enforce_admins` leaves nobody able to force past it); and, as a report, how much of
the policy each backend compiles, which gates no backend compiles at all, and whether the `floor` and
the gate map's required-check row agree. It does **not** compile the artifact or check the prose
citations — that lives in the compiler's suite, anchored to the real tree, because the citation
convention is this repository's and not the spec's. A workspace may declare prose and no policy; that
is an ordinary state, and it is the demo workspace's state.

## `verify` — the only slot that is structured because it is *consumed*

Every other content slot points at Markdown for a human. This one carries data because the Stop-gate
needs an answer, not a paragraph: which recipe runs when nothing more specific applies. A prose sentence
saying "run the docs recipe" cannot be dispatched.

**As of milestone 2 that argument has a consumer rather than a promise behind it.** This repository's CI reads
`verify.recipes` from the manifest and runs each one, so declaring a recipe is what enforces it — no
workflow edit, no branch-protection change, and no window in which a new recipe exists but nothing runs
it. It is a milestone early (the Stop-gate runner is milestone 4) and it is the cheapest possible
demonstration that a structured slot earns being structured. Recorded in customer zero's
[proposal 0004](../.portulan/proposals/0004-ci-runs-every-declared-recipe.md).

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

**What `doctor` checks:** `default` names a recipe that exists in `recipes`; each `doc` **that is
present** resolves. `doc` is optional by the minimality rule — a recipe whose limits are not yet written
up is still a runnable recipe, and requiring the write-up would be exactly the ceremony that rule refuses.
It does **not** run the recipes, and it does not check that `requires` is honest — a recipe that quietly needs a
tool it did not declare passes. That gap narrowed in milestone 4 rather than closing: the Stop-gate runner
executes the **default** recipe, so that one recipe's `requires` is now tested by being run. Every other
declared recipe is still read and never executed, and `doctor` remains the wrong place to fix it — a
validator that ran arbitrary commands out of a manifest would be a validator you could not safely point
at someone else's workspace.

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

## `tree` — where the claims are checked against, and why it is declared rather than inferred

Added in v2.0, slot and requirement together (an optional-slot draft never reached `main`), and it
exists because the claims lint needed an answer to a question nobody had asked while there was only one
workspace: *which* tree does a repo card's `test:` line refer to?

Customer zero's answer is obvious — the repository the workspace sits in, one level up. The demo's
answer is that there isn't one: Rooftop's repositories are fictional, so its cards' build/test/run lines
and layout point at directories no tree contains. Both must validate, and a lint that failed the second
would be wrong about it rather than right.

The tempting inference is `kind`: check for `repository`, skip for `demo`. It was rejected for two
reasons, and the second is the stronger one.

- **It breaks on its own second case.** A `portfolio` workspace covers many repositories, none of which
  is the one it sits in. It is not a demo, and it has no single tree either — so kind-dispatch would
  demand a lint it cannot run, one milestone after v1.
- **It disables a check class on a self-declared field.** `kind` is typed by an author, and `doctor`
  checks only that it is one of the permitted values. A whole category of checking that switches itself off
  because somebody wrote `demo` is a fail-open with a doorbell on it — this repository has now recorded
  three of that shape ([`../.portulan/memory/verify-preconditions-fail-closed.md`](../.portulan/memory/verify-preconditions-fail-closed.md)),
  every one of them in gate machinery.

So the workspace declares it. Present means *lint these claims against that tree*; absent means *these
claims describe something not present here*.

**And a `repository` workspace must declare it** — spec 2.0, from
[proposal 0005](../.portulan/proposals/0005-a-repository-workspace-must-declare-its-tree.md). Optional
everywhere turned out to be a hole: deleting one line degraded the whole claims-lint class to notes,
GREEN, exit 0. A `repository` workspace *is* the policy layer of a repository that is present, so it
always has an answer; `demo` and `portfolio` genuinely do not, and stay exempt.

**This was the first rule here the schema does not carry, and that is a real cost.** A conditional
dependency between two keys needs `if`/`then` or `dependentRequired`, and neither is in the subset
[`README.md`](README.md) declares — so the constraint lives in `doctor` as a cross-field check, invisible
to anyone reading the schema alone. Stated loudly rather than hidden, because "read the schema to know
the contract" is otherwise false in these places, and an unmarked exception is worse than a marked one.

**It is now one of nine**, and [`README.md`](README.md) keeps the running count because the number is
the thing to watch. Two arrived with `memory` at 2.3 — a declared `memory` object needs a
`slots.memory` store to index, and `memory.index.path` must resolve *outside* it — two more with
`librarian` at 2.4, and then that same store-and-siting pair twice again: over the handoff series at 2.5
and over the per-persona scope layer at 2.6. The two `librarian` brought:

- **`librarian` requires `slots.memory`.** There is nothing to age otherwise, and a pass over an absent
  store reports that nothing is stale, which is indistinguishable from a healthy one.
- **`librarian.staleness.proposal_days` requires `slots.proposals`.** A threshold nothing can ever
  cross reads as configured to anyone who greps for it. The pass itself reports *not asked* in that
  case, which is deliberately not the same answer as *none pending* — but a policy that can only ever
  print *not asked* is a policy nobody meant to write.

**What `doctor` checks:** the path resolves to a directory; and that a `repository` workspace has one.
With `tree` present, every path-shaped claim
in a repo card must exist, and the gate map's required-check claim must match a workflow job. With
`tree` absent, those claims are counted and **reported unverifiable** — never skipped silently, because
the whole point is that a check which vanishes without saying so is worse than one that admits it could
not run.

Three limits worth stating before somebody relies on this. A claim is resolved against **either** the tree
root or the card's own directory, because a real card mixes the two bases in one line — customer zero's
does — and a lint that insisted on one would produce false reds. Only tokens that look like paths are
checked: something containing `/`, never absolute, taken from a code span or a link target. `build: none`
claims nothing. Prose outside the two parsed sections is left alone rather than guessed at, because an
ambitious parser is the shortest route to the false red that gets a whole recipe switched off.

**Severity is where that lesson actually bit**, and the rule is worth knowing before writing a card. A
build/test/run candidate that is a **single path-shaped token** — `./verify.sh` — is an unambiguous claim
and **fails** when absent. A candidate that is a **command** — `dotnet run --project src/App` — only
*contains* tokens that might be paths, and those are **reported, never failed**, because nothing can
distinguish an input path from an output path not built yet, a flag value, a `sed` expression, a glob or
an npm script name. A line with nothing path-shaped in it is counted and reported too. Nothing is
dropped in silence — which it was, until the third real workspace's card exposed it — but the first
attempt at fixing that failed command tokens outright and produced false reds on `go test ./...`,
`cc -o bin/app src/main.c` and `--project=src/App` with the directory present, which is precisely the
shape [`../core/templates/repo-card.md`](../core/templates/repo-card.md) tells adopters to write.

And the third: **claims resolve against the filesystem, not against git.** A card naming a directory that
`.gitignore` excludes — a runtime `state/` or `logs/` — resolves in a working copy where the application
created it and is absent from a clean checkout. The failure direction is local-green / CI-red, which is
fail-closed and therefore the safe one, but it means a local green is the weaker of the two.

## `packs` — the cascade's missing middle

Nothing in the criterion asks for this, and it is included anyway, which needs justifying. The cascade is
`core < pack < workspace < repo card < task`; every layer but one is addressable from a manifest, and a
workspace that cannot say which packs it composes leaves an agent to infer the middle of its own
resolution order. The portfolio workspace at milestone 6 ships as a private-feed plugin composing a pack
delivered by that feed — a manifest that cannot express that forces a MAJOR bump one milestone after v1.

_(This sentence said **premium** packs until milestone 6, session 1, and no shipped pack is premium: the
one the portfolio workspace composes is the universal checkpoint ritual, delivered by the private feed and
authored in the public engine. The prediction was reasonable and turned out not to be what milestone 6
built, so it is corrected to what the tree shows rather than left as a promise about a pack nobody wrote.
Whether a premium pack should exist at all is a commercial question for the maintainer, not a gap this
file may quietly keep open.)_

An array of names in cascade order, empty by default. Each name is the canonical `category/name` form
the Pack Definition owns ([`pack.schema.json`](pack.schema.json)) — but the items stay **free strings**
here, deliberately. Tightening them to that shape would be a constraint a manifest could newly fail,
which is a MAJOR bump, and the two schemas are on separate version trains precisely so neither forces
the other's hand.

**What `doctor` checks**, as of milestone 6: that the names are unique, that each **resolves** to a
`pack.json` under a resolution root, and that the manifest it finds **validates against the Pack
Definition**. It reports what each pack contributes. Resolution roots are derived from `tree` rather
than declared — a slot before its consumer is the mistake this specification was written to avoid — so
a workspace with no `tree` has nowhere to search and its declared packs are reported *unverifiable*
rather than failed, which is the same answer `tree`'s absence already gives every other claim that
needs one.

**What is still not demonstrated is resolution from a FEED.** The roots searched today are the
workspace's own tree; an adopter installing a pack from a private marketplace resolves inside the
installed plugin instead. The resolver takes its roots as an argument for exactly that reason — so the
feed case is the same code path rather than a parallel one — but it has not yet been run that way, and
this sentence is what says so.

## `memory` — what the store's index is called, and what memory may cost

Added at 2.3. `slots.memory` is the store; this object is the machine configuration around it — the
same split as `slots.gates` (the argument, in prose) and `gates` (the policy, compiled), and for the
same reason: one is content a human reads, the other is fields a tool dispatches on.

It exists because [`memory.md`](../core/operating/memory.md) has described a *generated, size-budgeted*
index since milestone 1 and neither adjective had a machine behind it. The index is emitted by
[`../cli/index.mjs`](../cli/index.mjs), committed, and byte-compared by a verify recipe — generated so
the store is the single source, committed so a change to what is always loaded is reviewable in a diff.

| Field | What it is |
|---|---|
| `index.path` | Where the generated index is written. Must resolve **outside** `slots.memory` — see below. |
| `index.budget.lines` | The most lines the index may hold. One line per record, so this is a rail on record count. |
| `index.budget.columns` | The most columns one line may hold — refused, never truncated. |
| `store.budget.kilobytes` | The most the store's records may total, in 1024-byte KB. |

**Two budgets rather than one, because they are different axes.** The index is what gets loaded to
decide what else to load, so its line count is what memory costs on every recall. It cannot see the
other axis at all: a store whose record count never moves can grow without limit in bytes, and nothing
in the index would change. The `columns` cap closes the hole a line budget has — one enormous line
absorbing what the budget counts.

**Nothing is defaulted**, on the `floor` object's rule from 2.2: a default here would be this
specification setting a policy for every workspace that ever adopts it, in a key nobody typed. An
undeclared number is not checked. A number that is declared and is not a positive integer is
**refused** — `lines: 0` would otherwise read as falsy, switching the rail off in the key that exists
to switch it on, and the subset has no `minimum` with which to say so in the schema.

**What `doctor` checks:** that `index.path` resolves; that `slots.memory` is present whenever this
object is; and that `index.path` does **not** resolve inside `slots.memory`. The last is the one worth
arguing. `doctor`'s store report walks every `.md` in the store, so an index living there is counted as
a record, sized into the KB figure, and reported for stating no retirement condition — a report about
the store that includes a file the store does not hold. The alternative repair was to exempt the
index's filename from the walk, and that was rejected: an exemption by name is a door any record could
walk through, and this repository had found eight fail-opens of that shape in its own scaffolding. A
siting rule has no such door — though the rule still has to be *tested* correctly, and the first cut of
this one was the ninth: it read a leading `..` in a **filename** as a traversal, so `memory/..index.md`
was judged outside the store it plainly sits in, written there, and counted as a record. The door was
not in the design; it was in the containment test.

**What no checker establishes:** that a budget was not simply raised in the change that breached it.
That rule is [`memory.md`](../core/operating/memory.md)'s and the human gate's — refusing a raise needs
a check that reads git history, which produces false reds in a shallow CI checkout. The limit is
recorded in [`../.portulan/verify/README.md`](../.portulan/verify/README.md) with the measurement
behind it, rather than left for a reader to assume the rail covers both halves.

## `handoffs` — an index over a series nobody can consolidate

Added at 2.5, and it is deliberately one key. `slots.handoffs` is the series; this object says where
its generated index goes. The same split as `memory` above, built by the same generator, byte-compared
by the same recipe.

| Field | What it is |
|---|---|
| `index.path` | Where the generated index is written. Must resolve **outside** `slots.handoffs` — see below. |

`index` is **required whenever `handoffs` is present**, which is the one way this object differs from
`memory`. There an object with no `index` is coherent: a workspace may rail its store's size and
generate nothing. Here there is no budget and exactly one key, so `handoffs: {}` configures nothing —
a no-op that reads as configured to anyone who greps for it, the same failure
`librarian.staleness.proposal_days` without `slots.proposals` is refused for. Unlike the two
conditional requirements below, this one *is* expressible in the declared subset, so the schema
carries it rather than `doctor`.

**Why it exists.** [`loop.md`](../core/operating/loop.md) has said since the handoff-cadence rule landed
that *"the librarian that mines the series is milestone 5"*, and the series had no index at all while
the store it sits beside had one. Measured on this repository the day the milestone-5 row was amended:
the handoff series was **3.4×** the memory store. The layer with the index was the small one.

**Every field on a line is derived, and the two carriers differ from the store's on purpose.** A
record's title is its **filename** — [`memory-entry.md`](../core/templates/memory-entry.md) prescribes
no heading, and most records carry none, so the filename is the only title every record has. A
handoff's title is its **H1**: the filename leads with an ISO date and continues as a slug, so a
filename-derived title reads `2026 07 28 the librarian goes on a cron` — a string no reader navigates
by and no cross-reference uses. Every handoff in this repository carries an H1, so the heading is the
carrier that actually exists here, and one that does not is **failed** rather than titled from its
filename: a generated line whose title the generator invented is the one thing a generated file must
not contain. The date is derived from the filename, which is where the cadence rule already puts it.

**Its siting rule has two enforcers rather than one, and neither is redundant.** An index inside
`slots.handoffs` is either counted as a handoff by `docs.sh`'s date-correspondence check — inflating
one side of a count the Session log is held to — or, carrying no date, failed by the same check for
exactly that. `index` refuses the siting outright, because it cannot render a series it would then be
a member of. The second enforcer is not a second opinion: the generator physically cannot proceed,
while the recipe is what catches a hand-placed file the generator never saw.

**There is no budget here, and the absence is the argued half.** A budget's only permitted remedy is
consolidation — merge, compress, retire ([`memory.md`](../core/operating/memory.md)) — and a handoff
series is append-only by construction: one per session, dated, held to the Session log by a count-based
correspondence. Retiring a handoff to buy headroom would either red that check or destroy the record it
exists to keep, and raising the budget in the change that breached it is the one repair that doctrine
rules out. Every remedy such a budget could ask for is barred, which makes it a rail designed to be
broken — and a rail that fires with no legal repair is how a whole recipe gets switched off. Whether
the series should be railed on some other axis is a **maintainer's question**, deferred to the
reconciliation that follows milestone 5 rather than pre-answered here in the shape of an unused key.

**What the pass reads that this object does not configure.** Record ages come from git for both series,
and the handoff series is **reported** — count, oldest, total size — with no threshold and no demotion
draft. That is not an omission: `librarian.staleness.record_days` drafts a demotion, and drafting one
against an append-only series would recommend the single repair the paragraph above rules out, weekly,
forever.

## `personas` — where a pack-declared memory scope lands, and how anyone can tell it did

Added at **2.6**, as a pair: `slots.personas` is the adopter's per-persona layer, one directory per
persona whose memory scope a composed pack declares, and `personas.index.path` is the generated artifact
over it. The same split as `memory` and `handoffs`, built by the same generator, byte-compared by the same
recipe.

| Field | What it is |
|---|---|
| `slots.personas` | The layer. One directory per declared scope, each **empty until earned**. |
| `personas.index.path` | Where the generated index goes. Must resolve **outside** `slots.personas`. |

**Why it exists.** [`memory.md`](../core/operating/memory.md) has said since milestone 1 that memory is
per-agent rather than global, and until milestone 6 nothing in this project had a per-agent store: every
store shipped was a *workspace's*, shared by whatever agent read it. A **pack** is the first artifact this
framework distributes that carries per-persona material its adopter does not own, which is the first point
at which *whose* memory this is has an answer that matters — the maintainer's ruling of 2026-07-29,
verbatim, *"row 6 declares, row 7 validates"*.

**This series' source is the cascade, not the tree — the only one of the three.** The memory store and the
handoff series are directories the workspace owns and the generator walks. A scope is declared by a persona
*inside a pack the workspace merely composes*, so finding it means resolving `packs` the way `compile` and
`doctor` already resolve it. One consequence is worth stating because it looks like a bug the first time:
a workspace can be handed a resolution root on the command line (`--pack-root`), so the same workspace
renders the same index whether the pack came from beside it or from a private feed. Every field on a line
is content-derived, so the artifact is **path-independent** — measured at milestone 6, session 1, where
customer zero and a feed-installed adopter produced the identical scope digest.

**Declared rather than derived from `slots.memory`, and both halves of that are the argument.** Not
derived, because a path this specification computed would be Portulan choosing a location inside every
adopter's workspace in a key nobody typed — the rule every memory budget here already obeys. And not a
subdirectory of the store, for two reasons that point the same way: doctrine holds per-agent memory apart
precisely so a reviewer's recall does not spend the implementer's budget, and a store nested inside the
store would be counted by the `kilobytes` rail while being invisible to the flat walk that counts it —
[issue #76](https://github.com/sleepy-panda-works/portulan/issues/76). Siting the layer outside leaves that
issue open to be decided on its own merits instead of settled as a side effect of this one.

**A location is literally empty, and that is a ruling rather than a reading.** *"Present and empty"* could
mean *empty of records* — a marker file inside stating whose scope it is — and the maintainer ruled on
2026-07-30 that it binds literally. Which has a consequence the design leans on: **git does not record an
empty directory**, so the location cannot travel in a plugin payload at all. The declaration travels in the
index; the directory is created in the adopter's own layer when the adopter runs the landing. An absent
location is therefore never a finding — it is the state of every fresh clone.

**Two controls, and the second one is what makes the first mean anything.** The index is the *positive*
control: every field on a line is derived from the pack, including a digest over the declared scope's own
text, so a pack that rewords a scope moves this file and the byte comparison tells the adopter. A first
sentence alone would have let a pack reword everything after it invisibly. The *negative* control is a
sweep for **anything** under the layer that no composed persona declares — a stray file as much as a stray
directory, since the first implementation tested only directories and let a `.md` dropped in pass in silence.
Without it the layer would accept anything and the positive control would only ever examine locations it
already expected, which is
[`a-manifest-field-can-validate-and-load-nothing`](../.portulan/memory/a-manifest-field-can-validate-and-load-nothing.md)
wearing this feature's clothes. A third check runs at the *distributing* side: a pack shipping memory
records of its own is refused, because storage follows ownership and a pack absorbing an adopter's records
is the constitution's thesis 6 violated from the direction the adopter cannot see.

**What no part of this reads, said plainly.** Nothing recalls from these locations, nothing consolidates
them, and no budget rails them. `doctor` validates a persona against its five-part contract at **milestone
7** — that is the *validates* half of the ruling above, and it is named here rather than implied so this
page cannot be read as describing enforcement that does not exist. There is no budget for the same reason:
there is nothing yet to budget, and the axis such a rail should use is per-persona rather than
per-workspace, which belongs to the row where something finally reads these locations.

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
- **Adopting this was a constitutional interpretation**, and the constitution has since been changed to
  match. It decides how thesis 4's "links to the incident" reads in the collision case; the maintainer
  accepted it, reserved the matching wording change in [`../docs/vision.md`](../docs/vision.md) to his
  own hand, and made it. Thesis 4 now names both forms itself, so the machine that enforces the two-form
  shape is enforcing something the constitution states — which is the only order these two are allowed to
  be in. _(For a window between the two changes the constitution read "links" while this spec permitted a
  stamp. That gap was recorded here rather than smoothed over, and closed before `doctor` shipped, which
  is what the proposal required: a rule mechanically enforced by tooling and absent from the constitution
  is backwards for this product.)_

- **It binds a rule, and only a rule.** `doctor` requires a two-form stamp on `type: rule` records in the
  `memory` slot and nowhere else. A `decision`, `reference`, or `glossary` record whose provenance parses
  as neither form is **reported**, never failed — thesis 4, this proposal as adopted, `dod.md` condition
  3, and the milestone's own criterion are all rule-scoped, and having the validator bind types nobody
  legislated for would be the same inversion as the previous bullet. **Proposals are not checked at all**
  in v1, though a proposal argues for a rule and carries a `Provenance` section of its own. Two reasons,
  and the second is the one that decides it. A proposal is the *argument* for a rule; the rule itself
  lands in a memory entry or in `core/` when accepted, and that is the carrier the mandate names — a
  proposal's provenance documents where the reasoning came from, which is a different thing from the
  incident stamp `$defs/provenance` describes. And at any moment a proposal can be sitting
  **pending** the human gate, so a checker demanding a format from it would be acting on a record
  mid-decision, which is the gate's business and not a validator's. Saying which carrier is unchecked
  matters more than the choice does — silence is how the next reader assumes coverage that is not there.

- **`type` is self-declared, and that is an opening.** A rule labelled `decision` walks past the check.
  Closing it means either inferring type from content or extending the mandate, and the first is
  guesswork while the second is the maintainer's to legislate, not the validator's to assume.

## Considered and left out

Each of these was a candidate; none is an oversight.

- **`rituals` as its own slot.** The constitution names rituals as a pack category, and — when this was
  written — also inside thesis 1's workspace list. The two readings disagreed and the schema had to pick
  one. It picks packs: rituals ship as packs ([`../packs/rituals/`](../packs/rituals/)), so a workspace
  composes them through `packs`, and a second slot would be two ways to say one thing. **The ambiguity
  was raised with the maintainer rather than settled here** — the constitution is human-owned and a
  schema is not the place to decide what it means — and he has since settled it: thesis 1 now lists
  rituals once, under packs, which is the reading this schema had guessed at. Kept rather than deleted,
  because the record of *how* the disagreement was resolved is the part worth having: the schema deferred
  and the human legislated. Revisit if a workspace-local ritual ever needs a home that is not a pack.
- **`stack` and `glossary` as slots.** Both are named in thesis 1 and both live inside `identity.md`
  today. Splitting them buys nothing until something *consumes* them — a stack pack selecting itself
  from a declared stack would be that consumer, and it does not exist. Splitting on speculation is how a
  schema acquires slots nobody fills.
- **A sealed-owner registry.** Sealed stamps name an owner as free text; a workspace-level list of valid
  owners would let `doctor` catch typos. Deferred: it adds a required-to-maintain list for a check that
  catches a mild failure. The librarian's nagging is the mechanism that would actually need it, and as
  of milestone 5 it exists and reads the owner as free text — so this is a deferral with a live consumer
  rather than a speculative one, and the first typo'd owner is the incident that would settle it.
- **A per-host capability matrix.** The vision's `doctor` includes a per-host capability report, but that
  is generated from the host and the compiled gates, not declared by the team. It belongs with the
  enforcement backends in milestone 4.
- **`evals`.** Milestone 8 owns the eval harness; a slot pointing at golden tasks before any exist would
  be the emptiest kind of scaffolding.

## What v2.0 is not

- **It has been validated against exactly two instances**, one of which it was derived from. The demo in
  [`../examples/`](../examples/) was the real test, and it did what a second instance is supposed to do:
  it produced a schema change (`tree`) within an hour of being written. A third differently-shaped
  workspace — the portfolio one at milestone 6 — should be expected to produce another.
- **`doctor` checks form, not truth.** Every line above says what it resolves, parses, or matches. It
  cannot tell whether a mission statement is still accurate, whether a sealed stamp describes a real
  incident, whether a gate map's tiers are honoured, or whether a `requires` list is complete. The
  machine catches absence; the human judges substance.
- **It never executes anything.** Recipes are read and never run. The Stop-gate runner (milestone 4)
  executes the **default** recipe, so that one is tested by being run; every other declared recipe is
  still read only, and one quietly needing an undeclared tool still passes.
- **Nothing here describes how a workspace is *installed*.** Workspaces ship as plugins through a feed;
  that packaging is milestone 3 for the public path and milestone 6 for the private one.
