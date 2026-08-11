# spec/

The contracts between the engine and the layers above it. `core/` is mechanism and is identical for
everyone; a workspace is the half that is theirs, and a pack is the composable middle. This directory is
what makes both machine-readable instead of a folder convention.

- [`workspace.schema.json`](workspace.schema.json) — the **Workspace Definition**: the manifest at a
  workspace root. Normative.
- [`pack.schema.json`](pack.schema.json) — the **Pack Definition**: the manifest at a pack root, added at
  milestone 6, declaring what the pack contributes to the cascade. Normative, and on **its own version
  train** — see [Versioning](#versioning-and-migrations).
- [`slots.md`](slots.md) — every workspace slot: what it holds, why it exists, where it was derived from,
  and what `doctor` checks about it. The rationale lives there; this file is the orientation.

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
2. **A path slot may point outside the workspace directory.** Two slots commonly do, and neither is
   required to. `constitution`, because a product's constitution normally lives with the product rather
   than with the workspace — customer zero is the first proof: its constitution is `docs/vision.md`, one
   level up. And `tree`, which names the repository a workspace makes claims *about*: usually `../`, for
   a workspace directory sitting inside the repository it describes, but legitimately `./` when the
   workspace root and the tree are the same directory. A schema that required containment would have
   failed on its own author's workspace; one that *expected* escaping would be wrong about the other
   arrangement. `doctor` reports an escape and never fails it, for both of them.

   The schema cannot express *which* slot may escape — a `pattern` sees one string, not which key it
   belongs to — so escaping is legal everywhere and `doctor` **reports** rather than fails when any slot
   other than `constitution` does it. Reporting rather than failing is the right severity: a workspace
   embedded in a larger repository may legitimately reach for a shared document, and a hard failure
   would make the schema wrong about a case it cannot see.

## The four kinds — three that govern, and one that points

`kind` is required, and it is not bookkeeping. Three kinds **govern**: a **demo** workspace is written to
be read by strangers and must carry no real internal policy; a **repository** workspace is a team
dogfooding on their own product; a **portfolio** workspace covers many products at once. Confusing those
three produces the two failures that actually cost something: real internal policy published in a demo, or
a demo written as merely illustrative when it is the only complete worked example an evaluator will ever
read.

The fourth, **`pointer`**, added at 2.7, governs nothing. It names the workspace that governs this
repository and carries no slots of its own — a repository whose policy layer resides elsewhere says so in
one thin manifest instead of keeping a second copy nothing holds in agreement. That is the maintainer's
residence ruling of 2026-07-30 in the schema
([proposal 0017](../.portulan/proposals/0017-one-repository-one-governing-workspace.md)):

> A repository is governed by exactly one workspace. It carries its own full workspace, or a pointer to
> the workspace that names it — never both.

The two residences a customer may choose between — the workspace in the repository, or the workspace in a
portfolio that names the repository — deliver **full functionality either way**, and the mechanism that
makes that a property rather than a promise is that every feature keys to a workspace **slot** and never
to a residence. Nothing in `doctor`, `compile` or `index` asks where the manifest lives. The proposal
carries the one place where that was not yet true, and it was a discovery gap rather than a feature gap:
the boot skill searched the project directory only, so a repository governed from a feed booted to a
pointer's honest report rather than to a resolved workspace. **Closed at milestone 7** by
[`../cli/discover.mjs`](../cli/discover.mjs), which reads the host's installed-plugin record and
dereferences a pointer's `governed_by` — from disk, never over the network. The other half of the same amendment — the **pack** root
([#123](https://github.com/sleepy-panda-works/portulan/issues/123)) — landed beside it: `--pack-root
auto` resolves one from that same record. It runs **only when asked**, which is narrower than the row's
*"optional where discovery finds a root"* and is recorded as a narrowing rather than read as compliance;
the reason is that an unasked-for discovered root would make `.portulan/verify/doctor.sh` read the host
on every run. Either way the state is a workspace's, whichever residence it sits in, so it is not a
residence asymmetry.

## Required versus optional

A slot is **required** only when a workspace without it breaks a promise the engine makes. That is the
whole test, and it is deliberately strict — a day-one workspace has no proposals, no handoffs, and no
memory yet, and it must still validate. Ceremony that cannot scale down is a binding non-goal.

Required of every manifest: `portulan.spec`, `name`, `kind`. Required **per form**, and stated in the
schema itself by the top-level `oneOf` added at 2.7: `slots` and `verify` of a governing workspace —
with `slots.identity`, `slots.principles` and `slots.gates` inside `slots` — and `governed_by` of a
`pointer`. Those live in the schema rather than in this list deliberately: the list below is the price
of the subset's narrowness, and a new constraint belongs in it only when the subset genuinely cannot
express the constraint.

Then the conditional requirements, none of which the schema can express (the subset has no
`dependentRequired`, so `doctor` enforces every one and [`slots.md`](slots.md) says so):
`tree` when `kind` is `repository`; `slots.memory` when `memory` is declared, since the object
configures a store rather than replacing one; `memory.index.path` resolving **outside**
`slots.memory`, since an index inside the store is counted as a record by `doctor`'s own store report;
`slots.memory` when `librarian` is declared, since a pass over nothing reports that nothing is stale;
`slots.proposals` when `librarian.staleness.proposal_days` is, since a threshold nothing can ever
cross reads as configured to anyone who greps for it; as of 2.5, the same two the memory index
carries, applied to the handoff series — `slots.handoffs` when `handoffs` is declared, and
`handoffs.index.path` resolving **outside** `slots.handoffs`, since a file sited in that directory is
either counted as a handoff by the `record` check's correspondence or failed by it for carrying no
date; and, as of 2.6, that same pair a third time over the per-persona scope layer — `slots.personas`
when `personas` is declared, and `personas.index.path` resolving **outside** `slots.personas`, since
`index`'s orphan sweep would examine a file sited there as an undeclared persona location.
Everything else is optional.

_The 2.6 pair was enforced in `doctor` from the day the keys landed and was missing from this list until
2.7 — the list said seven while the validator refused nine. Nothing was wrong in the mechanism; the prose
about it was wrong, which is the class [#133](https://github.com/sleepy-panda-works/portulan/issues/133)
is filed about and the reason the count below is now read off `cli/doctor.mjs` rather than incremented by
hand. [`slots.md`](slots.md) carried the same fact and said **five**, stale by two bumps; both are
corrected in the change that added the pointer kind, because a fix that repairs one carrier and knowingly
leaves its sibling is the class [`0020`](../.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md) names._

**The residence refusals are deliberately NOT in that list, and the distinction is the reason it can
still be trusted.** `doctor` refuses a pointer carrying governing slots, a governing workspace carrying a
`governed_by`, and — where a `--repo-root` makes it visible — a repository named by one workspace and
governed by another. The **first two** are expressible in the subset — a branch-level permit-list would
carry either — and they are enforced in `doctor` anyway, because the schema's own failures return at *the
manifest must conform first*, so a shape the schema refused would never print the sentence the refusal
exists to print. So for those two this is a choice about **where a rule is stated**, not a constraint the
schema cannot carry.

The **third is not expressible in any schema at all** — this subset, full 2020-12, or any other: it reads
a manifest in *another repository*, and no contract over a single document can see one. It still does not
join the list, and the reason is what keeps that list meaningful: every entry there is a dependency
between two keys **of one manifest**, which is the thing a reader of the schema alone would expect to find
and does not. A check that needs a second repository is not in that category, and folding it in would make
the count measure two different things at once. **The count stays at nine**, and it counts what it always
counted.

[`slots.md`](slots.md) argues each one.

_The opening of that paragraph used to carry the count. The number is gone rather than corrected, and
the list is now the only carrier: a sentence that hard-codes the figure it must maintain by hand is the
defect [#77](https://github.com/sleepy-panda-works/portulan/issues/77) is filed about, one file over,
and adding to the list at 2.5 is exactly the edit that would have left it stale again — which is how
this one was noticed._

That the count went from one to three in a single MINOR, then to five, then to seven, and now stands at
**nine**, is worth noticing rather than absorbing. Each is a genuine dependency between two keys and none
can be written in the declared subset, so the gap between *what the schema says* and *what a conforming
manifest must satisfy* is widening — and a constraint invisible to someone reading the schema alone is a
real cost, stated here rather than discovered. The subset earns its narrowness by being implementable
completely and honestly; the price is this list, and the list is the thing to watch if it keeps growing.
**Four MINORs at +2 each** was the growth rate to hold the next bump against, and **2.3's, 2.5's and
2.6's** pairs are the *same* pair three times over — a series needs a store and its index must sit outside
it — which was an argument for generalising it rather than adding it again. _(2.4's pair is `librarian`'s
and is a different one: a pass needs a store to age, and a proposal threshold needs a proposal series.
An earlier draft of this sentence read "2.4's, 2.5's and 2.6's", which would have made the repeating pair
four bumps old instead of three and misattributed `memory`'s contribution to `librarian`.)_

**2.7 is the first MINOR since 2.2 that adds nothing to this list**, and that is the reason its pointer
requirement went into the schema's `oneOf` instead. The generalisation the paragraph above kept asking for
is still owed for the three index pairs; what 2.7 establishes is only that a new conditional requirement
is a last resort rather than the default shape.

**2.8 adds nothing to it either, and needed no argument to avoid doing so** — its one key sits inside
`memory`, whose `slots.memory` requirement is already on the list and already covers it. It does add one
more entry to the *other* running gap, the positive-integer refusals: `record_kilobytes` is the **fourth
budget** the subset can only type as `number`, checked in `cli/doctor.mjs` and `cli/index.mjs` for the
same reason as `lines`, `columns` and `kilobytes`. Counting the whole shape rather than just the budgets,
`doctor`'s hand-check now covers **seven** keys — those four plus `librarian.staleness`'s three — which is
the running number the paragraph above says to watch. **One keyword would not retire them.** `minimum`
closes `0` and the negatives and stops there: the subset cannot say `integer`, so `1.5` still passes and
the gap is **two** keywords wide. _(Not `"8"` — a string is already refused by `type: number`, which the
subset can say, and `doctor` returns at *the manifest must conform first* before its hand-check ever
runs. It is a live hole for `cli/index.mjs` alone, which validates against no schema by design and
therefore refuses the string itself.)_

_These figures are history rather than state: what 2.3 and 2.4 added cannot change, so they do not go
stale the way the removed count did. The one forward-looking sentence is the growth rate, and it is
dated by the version it names._

Note the distinction that does the work here: the *definition* carries a slot, while an *instance* may
leave it empty. "The Workspace Definition has a product-layer slot" and "every workspace must declare a
product" are different claims, and only the first is true.

## Versioning and migrations

**Two schemas, two version trains.** They are separate because they version different contracts, and one
number governing both would make a bump in either mean a change in the other:

| Schema | Manifest key | Current | What it governs |
|---|---|---|---|
| [`workspace.schema.json`](workspace.schema.json) | `portulan.spec` | **2.8** | the Workspace Definition — the manifest at a workspace root |
| [`pack.schema.json`](pack.schema.json) | `portulan.pack` | **1.0** | the Pack Definition — the manifest at a pack root, added at milestone 6 |

The rules below apply to each train independently. `portulan.spec` is `MAJOR.MINOR`, and the current
Workspace Definition version is **2.8**. It did **not** move when the Pack Definition arrived, because
`workspace.schema.json` was byte-identical across that change: `packs` already existed as an array of
strings and was deliberately left that way, since tightening its items to the canonical `category/name`
form would be a constraint an existing manifest could newly fail, which is a MAJOR.

**2.8 is a MINOR on the plainest terms in this train's history: one optional key and nothing else.**
`memory.store.budget.record_kilobytes` — the most bytes any single record may hold — joins the sibling
`kilobytes` it does not replace. Nothing is removed, renamed, tightened or defaulted, so every 2.7
manifest is a valid 2.8 manifest unchanged, and a workspace declaring neither key is checked on neither.
The argument for the key is [`slots.md`](slots.md)'s and proposal `0025`'s: an aggregate over
individually-authored records cannot see inside its units, which is the hole `columns` already closes
for `lines`, one level down.

**Measured across the bump rather than reasoned about:** `node cli/doctor.mjs .portulan examples` is
GREEN, with `examples/` still on **2.4 and untouched** — the same compatibility demonstration 2.7 leaned
on, and the reason `examples/` did *not* acquire the new key in the change that added it. A demo
workspace four MINORs behind, still validating and still exercising the older sibling rail, is worth
more as evidence than a second declaration of the newest key would be.

**What this bump costs.** `KNOWN_SPECS` in [`../cli/index.mjs`](../cli/index.mjs) and
[`../cli/librarian.mjs`](../cli/librarian.mjs) gains `"2.8"` **by addition** — both tools refuse a spec
outside that set with exit 2, so a replacement would have dropped support for every 2.7 manifest those
tools already write and read. The four constants that WRITE a spec version — `cli/init.mjs`,
`cli/new.mjs` (twice) and `cli/vendor.mjs` — deliberately stay at `2.7`, on the rule stated beside them
and demonstrated by the `GATE_POLICY_SPEC = "2.2"` sitting in the same file: a writer declares **the
version its output needs**, not the newest one, and nothing those tools scaffold declares a memory
budget at all. Bumping them would have made every scaffolded manifest claim a contract it does not use
and narrowed it against adopter tooling pinned at 2.7, which is the opposite of what an additive MINOR
is for.

**2.7 is a MINOR, and it is one on the definition rather than by assertion.** It adds a fourth `kind`
value and one optional key, `governed_by`, and it moves `slots` and `verify` out of the top-level
`required` into a `oneOf` branch that requires them of every governing kind. That last move is the one
that has to be argued rather than asserted, because relaxing a `required` list *looks* like a
weakening: it is not, because the branch re-imposes both on all three kinds that existed at 2.6, so no
manifest that was valid becomes invalid and no manifest that was invalid becomes valid. Measured rather
than reasoned — `node cli/doctor.mjs .portulan examples` is GREEN across the bump, with `examples/` still
on **2.4 and untouched**, which is the property a MINOR is supposed to have. No migration exists and none
is owed.

**What the bump costs, stated rather than discovered.** `kind` discriminates the two forms, so a manifest
whose `kind` is in neither enum now fails **twice**: once precisely, at `/kind`, and once at the root
saying it is neither a governing workspace nor a pointer. The second error is true and the first is
unchanged, but a reader who used to see one error sees two. The blast radius is exactly that case — an
unknown key, a `#fragment` slot and a bad path each still produce one error, because the forms constrain
only `kind`, `slots`, `verify` and `governed_by`. It is held there by a test rather than by this sentence.

_(Contrast the bump refused earlier in milestone 6, where the intent was 2.5 → 2.6 and nothing in the
schema had moved at all — the discipline is the same in both directions.)_

**2.6 was a MINOR on the same terms**: two optional keys, `slots.personas` and `personas`, tightening
nothing. The pair is what makes a pack-declared persona memory scope checkable rather than prose, and
[`slots.md`](slots.md) carries the argument for why the layer is **declared** rather than derived from
`slots.memory`.

_(This line read `2.0` for two MINOR bumps after the schema had moved past it — the version of the
spec, stated wrongly in the spec's own README, while the `$id` beside it was right. It is recorded
rather than quietly corrected because it is the exact defect class this project keeps finding: a fact
with two carriers, only one of which anything checks. Both live manifests declare their version and
`doctor` reads it, so nothing was broken by the wrong sentence; nothing would have caught it either.)_

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
more expensive, and deferring would have carried the hole across the public flip — the window when
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
| A declared pack **resolves** | `doctor` | **Built** (milestone 6). Roots are derived from `tree`, and named roots may be given with `--pack-root`, which **replace** the derived one rather than preceding it, so a from-a-feed demonstration cannot be satisfied by a copy in the local tree at all. A workspace with no `tree` and no named root has its packs reported *unverifiable* rather than failed. Resolution **from a feed is demonstrated** as of milestone 6, session 1: the checkpoint ritual pack installed from the private `portulan-internal` marketplace and resolved from the install root, which is the same code path the derived one takes. **Discovery landed at milestone 7** ([#123](https://github.com/sleepy-panda-works/portulan/issues/123)): `--pack-root auto` reads the host's installed-plugin record — in **both** shapes a plugin lands in, packs under `packs/` for a repository-shaped one and categories at the install root for a flat one, which is what this project's own feed ships. Precedence, never union — **named > discovered > derived** — so the replacement property above is unchanged, and `auto` finding *nothing* yields the **empty** set rather than the derived root. Discovery runs **only when asked**: `--pack-root` is therefore not literally optional, and what stops being necessary is knowing the path. |
| A pack manifest conforms to the Pack Definition | `doctor` | **Built** (milestone 6). Same validator, same subset, a different schema and version train. |
| A pack's skills and personas are opened and validated | `doctor` | **Built** (milestone 7 session 2), on the maintainer's ruling of 2026-08-03 that row 7's validation reads broad. A skill's frontmatter (`name` kebab-case, `description` non-empty — the two a host reads before loading a body); a persona against the five-part contract, **including the memory scope** `core/operating/memory.md` promised would be validated at this milestone; and the tier no role may claim. Containment is checked **after resolution**, because opening these paths is what made an escaping value stop being inert. Three honest limits, each measured rather than assumed. The skills walk stops **three levels down**, matching `cli/plugin-lint.mjs`'s bound so two walkers over the same key cannot disagree, and it **reports the directories it did not descend into** rather than counting a root it never opened as empty. The Prohibited check is a prose heuristic defeated by any negation **in the same block** — a bullet list counts as one block — and the structural fix is a declared reach *field*, a contract change that is not built. And the five-part check is **presence**, not content: a persona whose sections are all empty passes, so a declared memory scope is read and not honoured. |
| Pack gate fragments merge **tighten-only** | [`../cli/compile.mjs`](../cli/compile.mjs) | **Built** (milestone 6). Two layers and two axes: `auto` is absent from the Pack Definition's tier enum, so a demotion to unattended is unexpressible; the comparison against the composed base is the compiler's, and both a weakened **tier** and a changed **action** throw rather than being dropped. The action half is the one a tier-only check misses — raising the tier while swapping the matcher removes the gate and still reads as a tightening. |
| A pack declaring a version ahead of `doctor` | `doctor` | **Built** (milestone 6). Refused rather than graded, symmetric with the workspace train, and on the Pack Definition's own `$id`. |
| Path slots resolve to real files | `doctor` | **Built.** File-versus-directory too; a slot resolving outside the workspace is reported, never failed. |
| Workspace claims match the tree | `doctor` | **Built, where a tree is declared** — repo-card build/test/run lines and layout, and the gate map's required-check claim. A workspace with no `tree` has those claims *reported unverifiable*. |
| A rule's provenance is well-formed | `doctor` | **Built.** On `type: rule` records in the `memory` slot; the form only, never the truth. |
| Sealed proportion reported | `doctor` | **Built.** Over rules, which is the denominator the mandate uses. |
| The recipes a workspace declares actually run | Stop-gate runner | **Built** (milestone 4), for the **default** recipe only, and outside `doctor` — which still reads recipes and executes none. A non-default recipe declaring a tool it does not have still passes. |
| The gate policy compiles to host enforcement | `compile` | **Built** (milestone 4). Two backends — the Claude Code host and the GitHub repository ruleset that is the platform floor. Every rule ends as compiled or refused-with-a-reason, **per backend**, and each emitted artifact is held to the policy by a verify recipe. That the *host* honours it is not checkable here — CI installs nothing. |
| What each backend cannot enforce | `doctor` · `compile --matrix` | **Built** (milestone 4). Per-backend coverage, the gates no backend compiles, and the floor's declared status checks against the tree's workflow jobs — the last of those a failure, the rest reports. Exported-versus-live drift is **not** checked: `doctor` does not fetch settings, and no recipe here makes a network call. |
| One repository, one governing workspace | `doctor` | **Built** (2.7). Two refusals need only the manifest in hand: a `pointer` carrying governing slots, and a governing kind carrying a `governed_by`. Both print the ruling's own sentence, which is why they are `doctor`'s and not the schema's — a schema failure returns at *the manifest must conform first* and the sentence would never reach a reader. |
| A repository named by one workspace and governed by another | `doctor --repo-root` | **Built** (2.7), **where visible**. Roots are named, never discovered — **and since milestone 7 this is the narrower limit of the two**: `--pack-root` gained `auto` and `--repo-root` did not, because what it would have to find is a *repository checkout*, which no host plugin record lists. The amendment that ordered discovery names the plugin cache in its own title, so this is outside its scope rather than owed by it. Without a root the check **reports that it did not run** rather than passing quietly. Visibility is one-way: the refusal runs from the naming workspace outward, so a repository carrying a full workspace cannot see a portfolio that claims it. A workspace that names its **own** repository finds itself and is not two managers; that identity is compared on the real path. |
| A pointer resolves to the workspace it names | `discover` · `doctor` | **Built** (milestone 7). `governed_by` is dereferenced against the host's installed-plugin record — `<config>/plugins/installed_plugins.json`, `CLAUDE_CONFIG_DIR` overriding the config directory — and the match is on the **governing manifest's `name`**, never on a plugin's, with `governed_by.feed` constraining the marketplace where it is declared. Four answers, because three of them are not *no*: `resolved` (exactly one), `not-installed`, `ambiguous` (two or more — **refused and both named**, never ranked), `could-not-look` (a record that would not parse, which must never spend as absence). **Nothing is fetched**: the record is read from disk and no path here touches the network, so *discovery of anything not installed* stays out of scope as row 7 states. `doctor` **reports** the answer on a pointer and never grades it — a pointer whose governor is uninstalled is a correct pointer, and no discovery outcome moves this tool's exit code. The candidate locations inside a plugin payload are a **named pair** — `<installPath>/workspace.json` and `<installPath>/.portulan/workspace.json` — rather than a walk, which is what keeps this bundle's demo and drifted fixtures out of reach by construction — neither sits at one; the bundle's own `.portulan/` does, which is the correct answer to a pointer naming `portulan` rather than a hole. `init` **asks** the residence question and writes a pointer as of milestone 7 session 1; `vendor` **performs the switch in both directions** as of session 3, and both write pointers rather than resolving them. |
| A feed-side repo card's claims against a repo-side tree | — | **Not built** — the cross-repo claims-lint gap, priced in [proposal 0017](../.portulan/proposals/0017-one-repository-one-governing-workspace.md). A portfolio workspace declares no `tree`, so its cards' build/test/run and layout claims are *reported unverifiable*; repo-side the tree is present and the cards are not. No single CI run sees both halves. In-session validation does work, and `--repo-root` narrows the governance question specifically — neither closes this. |
| A rule's link resolves | — | Not built, and not planned as a gate: dereferencing needs the network, and a gate that fails for reasons unrelated to the change under test is worse than no gate. |
| Agent-legibility scored | `doctor` | **Built** (milestone 7 session 7). **Seven** dimensions, each optional in this definition so it can genuinely be absent and none of them a restatement of a check that already fails — *executable verification* was an eighth for one checkpoint until that rule was applied to it, since form 0 of the `oneOf` above requires `verify` of every workspace the score can reach: recipes declaring `requires` · a machine-readable gate policy · a `dod` slot · a memory store with a generated index · a handoff series with a generated index · affordances reachable for every product (its own or the workspace-level default) · each of those documents naming what an agent must **not** assume. The `affordances` slot is the **named input, not the only one** — a score confined to it could not tell two workspaces apart. **It moves no exit code**: a measurement is not a verdict, and one that could fail a workspace would make conformance a function of prose volume. The last dimension is a **form** check over a named heading table, so a limits section with an empty body passes. |

As of milestone 2 the schema is a rail rather than only a specification — but read the right-hand column
rather than the middle one. `doctor` checks that a workspace's claims are **well-formed and resolvable**;
almost nothing it checks is a claim about whether the workspace's content is *true*. It is run by CI on
every pull request here, because [`../.portulan/workspace.json`](../.portulan/workspace.json) declares it
as a verify recipe and the workflow runs every recipe the manifest **yields** — which since milestone
7's composition amendment is the recipes the workspace declares plus those the packs it composes
contribute, namespaced by pack. *Declares* was the right word until that landed; the set is computed by
[`../cli/recipe-set.mjs`](../cli/recipe-set.mjs) now, and CI calls it rather than enumerating the
manifest itself.

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
