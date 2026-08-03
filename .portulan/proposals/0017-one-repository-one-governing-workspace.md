# Proposal 0017 — one repository, one governing workspace

**Status: ACCEPTED, 2026-07-30.** Written as the record of a ruling already taken, on the
[`0011`](0011-no-merge-from-behind-main.md) precedent: a floor with no proposal behind it is a floor
nobody can audit. The maintainer ruled the substance before this was drafted. What this file adds is the
measurement behind it, the rails that make it checkable, and the limits it does not close.

**Incident.** No failure — a question, asked before the shape that would answer it wrongly had been
built. The Sleepy Panda portfolio workspace ships through the private `portulan-internal` feed and names
Tipar API among the repositories it covers. Tipar API is a repository, and a repository can carry a
`.portulan/` workspace of its own. Nothing in the Workspace Definition, in `doctor`, or in the boot skill
said which of those governs when both exist — so the answer would have been settled by whichever was
written first, in a repository whose whole thesis is that a rule with two carriers is obeyed at the
narrower one.

The maintainer settled it on 2026-07-30: *two places managing the same thing is refused. The customer
configures Portulan one way or the other and may switch — exactly one configuration governs at any time.
No active dual management, ever. It applies to any customer, their own private feed or an in-repo
workspace. And either configuration must work with full Portulan functionality.*

## The maintainer's own question, answered

*Do the two configurations differ, and if so by what — and if they differ, why can't they be the same
thing?*

They differ, and the difference is **not** in what the workspace contains. Compared at source — customer
zero's [`../workspace.json`](../workspace.json) here, and the `sleepy-panda` portfolio workspace in the
private feed, the two held side by side the way [#129](https://github.com/sleepy-panda-works/portulan/pull/129)
held a feed install and a checkout at once — **no content-kind differs**. Both carry slots, verify
recipes, a memory store, a gate map, a position in the cascade. Neither carries a key the other cannot.
_(That comparison is not reproducible from this public tree: the portfolio workspace lives in
`portulan-internal`, and its living there is the feature rather than an accident of where it was put.)_

What differs is **reach** and **delivery**:

- **Feed-side.** One workspace reaches many repositories, and it keeps team context out of product trees
  whose audiences may be wider than the team's. A portfolio workspace declares no `tree`, so it is not
  the policy layer of the repository it sits in — it is the policy layer of the repositories it *names*.
- **In-repo.** Self-contained and feed-independent: no marketplace, no install, no second repository in
  the trust path. Workspace and repository coincide, which is customer zero's shape and the reason its
  `tree` is `../`.

So: **one artifact in two residences, differing in reach and delivery, never in content-kind.**

And that is precisely why they cannot both be present. Two residences of the *same* thing are not two
things — they are one thing written down twice, with nothing holding the copies in agreement. This
repository has a name for that shape and a record of what it costs:
[`../memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md),
and proposal [`0003`](0003-demote-three-workspaces-entry.md), where a duplicated paragraph was retired
because *"the workspace copy is the one nothing checks"*. A workspace is not a paragraph. It is the layer
that decides gates, lanes, and the bar for done. Two of them disagreeing is not a stale sentence; it is an
agent booting on the wrong policy and looking exactly like success.

## The rule

> A repository is governed by exactly one workspace. It carries its own full workspace, or a pointer to
> the workspace that names it — never both.

_The rule says "the workspace", not "the portfolio workspace", and the narrowing is deliberate. Neither
`governed_by` nor the cross-repository check constrains the governing workspace's `kind`, and the
maintainer's ruling does not legislate it either — writing "portfolio" here would be a rule claiming more
than its own rail, which is the defect class
[#133](https://github.com/sleepy-panda-works/portulan/issues/133) is filed about. As it happens the only
feed-side instance today is `portfolio`-kind._

## Parity, and where it is keyed

Either residence delivers full Portulan functionality; a customer loses no feature by choosing one. What
makes that a property rather than a promise is that **every feature keys to a workspace SLOT, never to a
residence**: `doctor` reads `slots.*`, `verify`, `memory`, `handoffs`, `personas`, `gates`; `compile`
reads `gates`; `index` reads the declared series; the boot skill reads the slots the manifest names. None
of them asks where the manifest lives. The one thing that *is* keyed to location is `tree` — and `tree`
is declared rather than inferred for reasons argued in [`../../spec/slots.md`](../../spec/slots.md) that
long predate this ruling. A feature that ever dispatches on residence is a parity breach and is refusable
on this sentence.

**One asymmetry exists today, and it is discovery rather than function.** The boot skill searches exactly
one path, `${CLAUDE_PROJECT_DIR}/.portulan/workspace.json`, and is told in as many words not to search
outward — for a good reason, since the bundle ships three manifests of its own and booting on one of them
would look exactly like success. So an in-repo workspace boots hands-free, while a repository governed
feed-side boots to a pointer's report and needs the governing workspace installed. Nothing is *lost* —
once installed, every feature behaves identically — but the step is real and it is named here rather than
claimed away. Closing it is `init`/`vendor`'s work at milestone 7; what this change does is make the
degradation honest instead of silent.

## The switch contract

A customer may move between residences. A switch:

1. **materialises** the workspace in the new residence — the whole thing, not a reference;
2. leaves **a pointer, or nothing**, in the old one;
3. and is not complete until **`doctor` is green at both ends** — the new residence validating as a
   workspace, the old one validating as a pointer or being absent — *before* the old residence is retired.

Green-at-both-ends first, retire second. The reverse order has a window in which the repository is
governed by nothing, and a window in which a repository is governed by nothing looks identical to a
repository that never adopted Portulan.

## Enforcement

Workspace Definition **2.7** adds the kind that makes the rule expressible, and `doctor` carries three
refusals. Each was forced RED before its green was believed, on the
[`0007`](0007-every-watcher-ships-with-its-observation-procedure.md) practice.

- **The pointer kind.** `kind` gains `pointer`, and an optional `governed_by` names the governing
  workspace and, where one exists, the feed it ships through. The schema's top-level `oneOf` requires
  `governed_by` of a pointer and `slots`+`verify` of every governing kind, so the requirement stays *in*
  the published contract rather than moving into `doctor` as another constraint the schema cannot express.
- **A pointer alongside governing slots is RED.** One manifest declaring itself a pointer and carrying
  slots of its own is the ruling's own case, in one file.
- **A governing workspace that also points is RED.** The same refusal from the other side.
- **A repository named by one workspace and governed by another is RED, where visible.** Given
  `--repo-root`, `doctor` looks for a manifest in each named repository, refuses a full workspace there,
  and refuses a pointer aimed at a third workspace.

**Why these are `doctor`'s and not the schema's**, stated because it looks like an oversight and is not —
and the answer differs between the first two and the third.

The **first two** *are* expressible in the declared subset; a branch-level permit-list would carry either.
They are `doctor`'s by **choice**, because `doctor` returns at *the manifest must conform first* when the
schema fails, so a shape the schema refused would never reach the sentence the refusal exists to print —
and the whole point of this rule is that a reader learns *why* two workspaces are one too many. The schema
permits the shape; `doctor` refuses it in the ruling's words.

The **third is not expressible in any schema at all** — this subset, full 2020-12, or any other. It reads
a manifest in *another repository*, and no contract over a single document can see one. It is `doctor`'s
by **necessity**. Neither joins the count of constraints [`../../spec/README.md`](../../spec/README.md)
keeps, and that page argues why: every entry there is a dependency between two keys of one manifest.

## The honest limits

- **The cross-repo claims-lint gap — the real cost of the feed-side residence, priced rather than papered
  over.** A portfolio workspace declares no `tree`, so its repo cards' build/test/run and layout claims
  are *reported unverifiable* rather than checked; `doctor` already behaves that way and says so, and
  [`../../examples/`](../../examples/) is the standing measurement — 13 card claims reported unverifiable
  in a run that is otherwise GREEN. Repo-side, the tree is present and there are no cards to lint, because
  the cards live feed-side. **No single CI run sees both halves.** In-session validation does work — an
  agent can hold the feed install and the checkout at once, which is what #129 demonstrated for the whole
  loop — and `--repo-root` narrows the *governance* question specifically. What is **not** built is a CI
  job that checks out both and lints a feed-side card against a repo-side tree. Named and priced, not
  claimed.
- **`kind` is still self-declared.** The escape narrows from *omit a line* to *lie about what you are* —
  better, and not a fix. Proposal [`0005`](0005-a-repository-workspace-must-declare-its-tree.md) said the
  same of `tree` and it is still true.
- **`--repo-root` is named, never discovered**, exactly as `--pack-root` is. Without one, the
  cross-repository check **reports that it did not run** rather than passing quietly — a check that
  vanishes without a word is the fail-open this repository has recorded more than any other.
- **Visibility is one-way.** The refusal runs from the *naming* workspace outward. A repository carrying
  a full workspace cannot see a portfolio that claims it, and nothing here changes that.
- **A workspace that names its own repository is not two managers.** Customer zero is that shape — it
  names the card `portulan` — so the first draft of the cross-repository check refused the arrangement the
  ruling *permits*. Identity is compared on the real path, and the exemption is identity alone: a genuine
  second workspace at the same name is still refused.
- **Nothing resolves a pointer.** `doctor` and the boot skill read `governed_by` and report it; neither
  fetches. Resolving it needs a host's plugin cache, which is discovery, which is milestone 7's.
- **A `.portulan/` directory holding files but NO manifest is not a residence — and is still never
  written over.** _(Ruled by the maintainer 2026-07-31, when `init` was built and its first cut silently
  replaced a hand-written `gate-map.md`.)_ The rule above turns on the **manifest**, which is what
  declares a workspace and what the boot resolves; a directory of loose files declares nothing and
  governs nothing, so calling it a residence would be a claim the tree cannot support. But *is this
  repository governed?* and *is it safe to write here?* are two questions with two keys, and answering
  the second with the first is how a tool destroys a human's curated layer while correctly reporting
  that no workspace was present. `init` therefore refuses on **any** collision, names each path, and
  offers no `--force`: a flag that overwrites files is the flag that eventually overwrites the wrong
  ones. Recorded here rather than only in that session's handoff because it is a **definition**, and a
  definition that lives in one session's record is one the next session re-argues.

## What this deliberately does not do

It does not build `init`'s residence question, `vendor`'s switch, or `upgrade`'s migration — those are
milestone 7's, and they are drafted as a row amendment for the maintainer rather than assumed here. It
does not fetch anything. And it does not decide where any particular customer's workspace should live:
that is the customer's choice, which is the whole point of ruling that both work.

_**Where they landed, appended 2026-08-03 rather than rewritten** — a proposal records what was argued
when it was argued. `init`'s residence question shipped at milestone 7 session 1;
[`../../cli/vendor.mjs`](../../cli/vendor.mjs) carries the switch as of session 3, holding the ordering
this file's **switch contract** sets. `upgrade`'s migration is still owed. Two things that implementation
found and this text did not anticipate, both stated where the mechanism is rather than only here: the
switch's window is **irreducible** — governance lives in two manifests in two directories and no
primitive changes both, so the ordering above chooses the loud failure over the silent one rather than
avoiding both — and **`compile` was keyed to residence**, which the parity clause above says is
refusable. It was refused, and fixed, in the change that built the switch._

## Provenance

`form=link` `href=`[`https://github.com/sleepy-panda-works/portulan/pull/135`](https://github.com/sleepy-panda-works/portulan/pull/135)
— the maintainer's ruling of 2026-07-30, carried verbatim in the pull request that files this proposal,
together with the `portulan-internal` → Tipar arrangement that raised it. Public, in-repo and resolvable,
carrying no client material, so no seal is needed. Behind it: thesis 6 of
[`../../docs/vision.md`](../../docs/vision.md) — storage follows ownership — which is the sentence a
second, unowned copy of a team's workspace breaks.

**Retire when** a mechanism makes two governing workspaces impossible rather than refusable — a host that
resolves a pointer and has nowhere to put a second workspace would supersede this, at which point the rule
moves into that mechanism rather than being deleted.

## Decision

_Accepted — Marius Cetanas, 2026-07-30_, by the ruling quoted above, recorded in the session that drafted
this. Written by an implementer agent (Claude Opus 5) under two fresh-context Fable 5 checkpoints.

**Pull request:** [#135](https://github.com/sleepy-panda-works/portulan/pull/135) — the change that filed this.
