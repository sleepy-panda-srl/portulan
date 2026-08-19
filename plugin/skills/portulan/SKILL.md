---
name: portulan
description: Boot the Portulan engine in this repository — load the always-loaded kernel, find and read the team's workspace (identity, principles, gate map, definition of done, repo card), and report what is and is not enforced here. Use at the start of a working session in a repository that has a `.portulan/` workspace, when asked to "boot Portulan", or when you need to know this team's gates, lanes, verify recipes, or definition of done before acting.
---

# Boot Portulan

> Portulan is an operating framework: a universal **engine** plus a per-team **workspace**. Booting
> means loading the engine's kernel and then the team's own policy layer, so that what follows is
> tailored to *this* team rather than generically sensible. _(See
> [`../../../core/engine.md`](../../../core/engine.md) and [`../../../docs/vision.md`](../../../docs/vision.md).)_

## 1. Load the kernel

Read `${CLAUDE_PLUGIN_ROOT}/core/engine.md` in full. It is deliberately small — the resolution
cascade, the loop, four non-negotiables, and a map to the doctrine behind them. Everything else in
`${CLAUDE_PLUGIN_ROOT}/core/operating/` loads on demand, when the kernel's map sends you there.

Do not read all of `core/` up front. The kernel being small is the design, not an accident.

**If that read is denied, the kernel did not load — say so and do not proceed as though it had.**
`${CLAUDE_PLUGIN_ROOT}` is outside the project directory, so a session whose file access is scoped to
the project will refuse it: measured 2026-07-26 on a headless run with default permissions, where the
boot correctly reported the absence of a workspace while having no engine in context at all. Booting
without the kernel is the same failure shape as booting on the wrong workspace — it looks like a boot
and it is not. Ask for read access to the bundle, or report the boot as incomplete.

## 2. Find the workspace — in the project, never in this bundle

Look for a workspace manifest at `${CLAUDE_PROJECT_DIR}/.portulan/workspace.json` — that is the project
root, the directory the session was started in. If the variable is not set, use the working directory;
do not fall back to searching upward or outward.

**Search the project only.** This plugin bundle ships three workspace manifests of its own — Portulan's,
used to build Portulan; a fictional demo under `examples/`; and a deliberately drifted fixture under
`cli/fixtures/` that exists to be invalid. All three sit inside `${CLAUDE_PLUGIN_ROOT}`. Booting on any
of them would load another team's identity, another team's gate map, and another team's definition of
done, and would look exactly like success. If the project has no workspace, that is the answer; go to
step 4.

### 2a. If the manifest is a pointer, resolve it — the workspace is somewhere else, and the CLI finds it

A manifest whose `kind` is `pointer` is **not** a workspace. It is one thin file saying that this
repository's workspace resides elsewhere, and naming it: `governed_by.workspace` is the governing
workspace's name, and `governed_by.feed`, where present, is the private feed it ships through. A
repository is governed by exactly one workspace — its own, or a pointer to the workspace that names it,
never both — so a pointer is the whole answer about residence, not a hint to be supplemented.

**Ask the CLI where that workspace is. Do not go looking yourself.**

```
node ${CLAUDE_PLUGIN_ROOT}/cli/discover.mjs --json ${CLAUDE_PROJECT_DIR}/.portulan
```

**Substitute the project root yourself if `${CLAUDE_PROJECT_DIR}` is not set** — step 2's rule, that
the working directory stands in for it, applies to this command too. An unset variable expands to
nothing and the command then asks about `/.portulan`, which is not this repository.

It prints one object and exits **0** resolved · **1** not resolvable here · **2** could not run or
could not look. _(That is this step's mapping, where the manifest is already known to be a pointer.
The command itself also exits **0** for `resides-here`, its answer about a manifest that is not one —
so the exit code alone does not distinguish them, which is the reason the next sentence is a rule
rather than a preference.)_ Read the `state` field — never the prose, which is written for a human and
is the half most likely to be reworded. The resolution reads the host's installed-plugin record **from
disk**; nothing is fetched over the network, here or there.

| `state` | What you do |
|---|---|
| `resolved` | `root` **is** the workspace directory. Go to step 3 and read its slots exactly as you would an in-repo workspace's, resolving every slot path against **that** directory. |
| `not-installed` | Go to step 4 and give that section's honest position — you have the engine and none of this team's policy. |
| `ambiguous` | Two or more installs answer to one name and the resolver refused to pick. **Do not pick either.** Report every entry in `matches` and ask the user which is meant. |
| `could-not-look` | The record exists and would not parse. This is *could not look*, which is not *not installed* — say which one you are reporting. |
| **no object at all** | Exit 2 with **nothing on stdout** and a diagnostic on stderr: the command could not run — a bad argument, an unreadable manifest, no Node. Read the diagnostic, say the resolution did not happen and why, and take step 4's position **without** claiming the workspace is not installed. Silence is not an answer, and it is never *no*. |

_(`node ${CLAUDE_PLUGIN_ROOT}/cli/doctor.mjs ${CLAUDE_PROJECT_DIR}/.portulan` prints the same answer as a
`residence` note, and is the spelling to use when a human is reading. It grades the **pointer** and never
the workspace it names: run `doctor` against `root` if you want a verdict on the workspace itself.)_

**This is the one licensed exception to step 2's "search the project only", and it is licensed by the
project itself.** The repository's own manifest named this workspace; the resolver matched on the
governing manifest's `name`, the pointer's `feed` where it declares one, and refused an ambiguity
rather than ranking it. That chain is what makes the read safe. It licenses no search of your own —
if the CLI cannot run, you have no resolution, and *no resolution* is reported as itself rather than
replaced by a guess. _(It does not reach the demo or the drifted fixture either: the resolver looks in
two named locations inside an **installed** payload and nowhere else, and neither of those two sits at
one. This bundle's **own** workspace is a different matter — a pointer naming `portulan` would resolve
to it wherever the plugin is installed, which is the correct answer to that pointer rather than a
hole.)_

**A resolved root is outside the project directory, so the same denial that can stop step 1 can stop
step 3 — and it must not be mistaken for absence.** `root` sits in the host's plugin cache; a session
whose file access is scoped to the project will refuse to read it, exactly as measured for
`${CLAUDE_PLUGIN_ROOT}` above. That state is **resolved but unreadable**, and it is a third thing: the
workspace *is* installed, you know precisely where, and you do not have it. Say that, ask for read
access to the cache, and give step 4's position **for the policy you are missing** — never the *not
installed here* sentence, which would send the user to install something they already have.

Four things stay true whatever the answer is:

- **Do not read the pointer's neighbours as policy.** A pointer carries no slots, and a `.portulan/`
  directory beside it holding files anyway is a defect worth reporting, not a workspace to load.
- **Do not treat this as "no workspace".** The difference matters to the person you are reporting to: a
  repository with no workspace has not adopted Portulan, while this one has and its policy layer is one
  install away — or already installed, which is now a thing you can find out rather than assume.
- **Say where the workspace came from, in the report at step 5.** *"Resolved from the host's plugin
  cache: `<plugin>@<marketplace>` version `<v>`"* is not decoration on two counts. A resolved workspace
  is a **pinned install**, so which version is loaded is the difference between two policy layers that
  may legitimately differ; and *the same report an in-repo workspace produces* must not mean
  *indistinguishable from one*. Name the residence.
- **Resolving the workspace does not resolve its packs.** A governing workspace found this way may
  declare `packs`, and nothing here looks those up in the cache — that is the separate half of
  the CLI's pack-cache discovery, and step 3a's four limits apply to a resolved workspace exactly as they
  apply to an in-repo one. Where the resolved manifest declares a spec MINOR older than this bundle's,
  say so as well: slots added since are simply absent, which is the contract working rather than a
  fault.

Where it is not installed and the user can install it — from the feed, or from a checkout beside this
repository — that is the thing to ask for. Booting on a pointer and proceeding as though you had the
policy layer is the same failure shape as booting on another team's workspace: it looks like a boot and
it is not.



## 3. Read the slots the manifest names

The manifest is an index, never a container: it names paths, and the prose lives in Markdown at the
other end of them. **Paths resolve against the directory the manifest sits in** — the project's
`.portulan/`, or, where step 2a resolved a pointer, the installed workspace's own root. Read the slots
in this order, because each frames the next:

1. `identity` — who this team is, what they work with, and their glossary. Terms defined there mean
   exactly that here.
2. `principles` — how they decide. The tie-breakers.
3. `constitution`, if declared — the document their work is graded against. It may point outside the
   workspace directory; it is the one slot allowed to.
4. `gates` — the gate map: which concrete actions are unattended, which need review, which need a
   human's explicit approval. **Read this before acting, not after.**
5. `dod` — the definition of done, which extends the engine's floor and may never lower it.
6. `repos/` — the card for the repository you are actually in: build, test, run, layout, quirks.
   **Select it, do not read the directory.** A workspace resolved from a pointer is typically a
   portfolio governing several repositories, so `repos/` holds cards for repositories you are not in;
   the one that matters is the card naming *this* repository. Where none does, say so — a governed
   repository with no card is a real gap and reading a sibling's card instead is the wrong repository's
   build, test and quirks presented as this one's.
7. `memory/` — the rules this team has minted from its own incidents. Each carries provenance and a
   retirement condition, so a rule can be weighed rather than merely obeyed.

Then read the recipe set. `verify.recipes` in the manifest is the workspace's **own** half of it; the
executable checks that decide "done" are the set
[`../../../cli/recipe-set.mjs`](../../../cli/recipe-set.mjs) **yields** — those recipes plus the ones
the workspace's composed packs contribute, namespaced by pack — and the manifest names which one is
the default. *Declared* and *runnable* are not the same list; the
`packs` note below carries the rest.

### 3a. Read `packs` too — no slot points at it, and what it delivers is partial

The cascade is **core < pack < workspace < repo card < task**, so a workspace naming packs has a layer
between the engine and its own policy. That layer is the manifest's `packs` array, and **none of the
slots above points at it**: read them in order and you will never meet a pack. Read the key, and report
what a declared pack does and does not deliver here, because the gap is invisible from inside a booted
session.

**A pack resolves against a root, and where that root came from decides what "resolved" proves.** The
manifest's `tree` derives one — `<tree>/packs`. The CLI's `--pack-root` names any directory instead, as
many as it is given, and named roots **replace** the derived one rather than being searched ahead of it:
that is what lets *"this pack resolved from the feed"* mean something a copy lying in the local tree
cannot satisfy. Where a pack resolves, its gate-policy fragments reach the compiled policy,
add-restriction-only. Nothing here is pinned — a `packs` entry is a name, and the version is whatever
the root holds. **Four things need stating about that layer — two limits that still bind, and two that
once did and no longer do.** Each is given in full rather than counted, because a bare figure beside a
mechanism goes stale the moment one of them moves:

- **Discovering the root happens in the CLI only.** The CLI reads the host's
  installed-plugin record, in both shapes a plugin lands in. It reads that record **by default**, because `--pack-root` and its siblings are *optional where discovery finds a root*.
  `--pack-root auto` now selects the strict degrade (asked-and-could-not-look is exit 2) rather than
  unlocking discovery, and a **named** root still **replaces** the derived one, which is the property that
  never moved.

  **What this changes for a boot's report, and it is the load-bearing half.** *"Declared"* and
  *"resolved"* are still two states, and a boot still cannot assume a declared pack resolved **from a
  feed** — a green certifies resolution, never provenance, and each pack's resolution names which root
  answered and whether it was discovered or derived. What a boot may no longer say is that a declared pack
  is unresolved *because nobody passed a flag*. **A workspace resolved from a pointer is in exactly the
  same state about its own packs as an in-repo one.**

  **What bounds it, at its real width.** A bare run's verdict *does* move with the host — `doctor` is a
  per-host capability report and that is what it is for. What is bounded is narrower and is two things: a
  **required** check names its root, which replaces every other source, so it cannot consult the host at
  all; and a **discovered** root can turn an unresolved pack from a note into a resolution and never a
  **miss** into a failure. A discovered copy that resolves and is *invalid* still fails, with its origin
  named — so report the host's answer as the host's, and never as the repository's.
- **A pack's skills register only where the plugin declares the directory that actually holds them.**
  A *validator* also refuses a bundle where that declaration and the workspace's `packs`
  array disagree — a rail on the packaging, never a change to how the host decides. A host expands a declared skills
  path **one level** and no further, so a root pointing at a family of packs — `packs/rituals/`, with
  skills at `<pack>/skills/<skill>/` — registers **nothing**, silently, while a validator walking
  deeper counts them. Declaring `packs/rituals/<pack>/skills/` registers them. Measured both ways on
  Claude Code 2.1.224.

  Depth alone was never parity, and saying so is the point: **registration is a property of
  `.claude-plugin/plugin.json` and of nothing else** — measured on Claude Code 2.1.226, by
  deleting the `packs` key from the governing workspace outright and reinstalling, which changed the
  host's inventory not at all. So a composed pack's ritual was invocable by coincidence of a
  hand-written path. `plugin-lint`'s `compose` check pins the two together in both directions — a
  composed pack whose skills no declared path reaches is red, and a skills path inside `packs/`
  belonging to no composed pack is red — so *composed* and *registered* can no longer drift apart in
  a bundle this validator runs over.

  **The adopter's half is built** ([#184](https://github.com/sleepy-panda-srl/portulan/issues/184)). `cli/skills-set.mjs` is the one carrier of the **registrable set**: it reads each
  composed pack's own `contributes.skills` and derives the paths a plugin manifest must declare, with
  `--check` reporting drift and `--write` deriving the key. So the path is computed rather than typed.
  **What that is demonstrated on is two layouts** — this bundle's, where packs sit at `./packs/`, and a
  workspace whose `tree` puts them elsewhere, which is the case an adopter is likelier to have and the
  one a first cut got wrong in a way every test passed over. **Two limits, because the clause is not whole.**
  It writes no manifest from nothing — only the pack portion of a `skills` key in one that already
  exists, since a workspace shipping no plugin is a state rather than a hole. And the row's
  *demonstration* — a composed pack's skill **invoked** through a host the same way a core skill is —
  is still owed by a session that runs and records it. Derivable is not demonstrated, and a boot that
  reported this as parity would be making exactly the claim the clause refuses.
- **A pack's personas reach the workspace's own layer, and not the host.** A composing workspace lands
  the scope a pack's persona declares, and an index over it can be generated — so this one is not
  simply absent, and reporting it as absent would be as wrong as reporting it as loaded.
- **A pack's verify recipes reach the runnable set.**
  [`../../../cli/recipe-set.mjs`](../../../cli/recipe-set.mjs) is the composing consumer and the
  **one carrier** of the runnable set — CI calls it instead of enumerating a manifest, so *what the
  workspace declares* and *what decides "done"* are no longer the same list. Composition is
  **additive only**, and a composed id is `<category>/<name>:<id>`, whose `/` and `:` are outside the
  slug grammar a workspace id and `verify.default` must both satisfy: a composed recipe therefore
  cannot shadow one the workspace owns or become the default, by construction rather than by a check.
  **What this does not settle is the adopter's side** — nothing here writes an adopter's pipeline, so
  a composed recipe runs for them exactly where their own CI calls that carrier.

**Name the packs, and say all of that in the same breath.** A boot that lists a workspace's packs
without it reads as though the middle of the cascade had loaded.

## 4. If the project has no workspace

Say so plainly rather than improvising a policy layer. Without a workspace you have the engine's
universal mechanism and none of this team's policy — which means you do not know their gates, their
lanes, or their bar for done, and you should not guess at any of the three.

What is available to read, in this bundle:

- `${CLAUDE_PLUGIN_ROOT}/examples/` — a complete fictional workspace, two products, meant to be read
  end to end as the worked example.
- `${CLAUDE_PLUGIN_ROOT}/spec/` — the Workspace Definition: the schema and a per-slot document
  explaining what each slot is for and what it was derived from.
- `node ${CLAUDE_PLUGIN_ROOT}/cli/doctor.mjs <workspace-dir>` — validates a workspace against that
  definition. Zero dependencies; it needs Node and nothing else.

Authoring a workspace ends with a human: `node ${CLAUDE_PLUGIN_ROOT}/cli/init.mjs` drafts one — see
step 5 — and what it emits is a **draft**, so read the demo, compare, and curate before trusting a line
of it.

## 5. Report what is enforced, and what is not

Close the boot by stating the honest position, because the gap between what a framework *says* and
what it *enforces* is the thing an agent must not paper over:

- **The verify recipes are real.** They are executable and they exit 0 green / 1 red / 2 could not
  run. Whether one runs *automatically* depends on the workspace: a Stop-gate exists, but it fires
  only where that workspace has compiled it, and it runs that workspace's **default** recipe alone.
  Running the rest is a condition of the definition of done and a habit.
- **A gate map is compiled only where the workspace compiled it.** Where a gate policy exists and has
  been compiled for this host, tiers are permissions and hooks; where it does not, the tiers are
  honoured by people and by review and nothing enforces them. Do not assume the first. What is real
  either way is the platform floor beneath — branch protection, required checks — where the team has
  configured one, and it is the only layer indifferent to how a command was spelled.
- **A declared pack is not an invocable pack.** Where the workspace names packs, say which, and give
  step 3a's four limits — not a summary of them, which is how one of them ends up quietly dropped. The
  cascade's middle is the layer a boot can least demonstrate, and saying so is the honest position
  rather than a caveat.
- **Memory has a generated index only where the workspace declared one.** `memory.index` is optional:
  a workspace carrying it gets an index written by `index`, and a workspace that also declares a recipe
  comparing that file byte for byte gets it held current by a rail rather than by anyone's diligence —
  two separate opt-ins, and the budget is a third. Where none is declared, recall means reading the
  directory. Say which of them you are looking at rather than assuming any.
- **The CLI is published, so all eight are one `npx` away.**
  `npx @sleepy_panda_srl/portulan <subcommand>`.
  `npx @sleepy_panda_srl/portulan doctor --help` is the cheapest thing to run first. They also run
  from a checkout, which is how this repository measures them — `init`, which drafts a workspace for
  a team that has none; `new`, which
  scaffolds a skill, persona, pack, workspace, gate policy or repo card into a layer you own; `vendor`,
  which materialises a workspace into a host or moves it between residences; `feedback`, which files an
  issue from a report you previewed, seam-scanned before it leaves the machine; `upgrade`, which applies
  the migrations and repairs a workspace owes, in either residence; plus `doctor`, `compile`
  and `index`. What `init`
  and `new` emit is a **draft**: a human curates it, and `init`'s verify recipe exits 2 until they say
  what green means for their repository.

- **Where the workspace came from is part of the report.** In the repository, or resolved from a
  pointer — and where it was resolved, name the plugin and the **version**, because that install is
  pinned and a different pin is a different policy layer. A boot that does not say which of the two it
  loaded leaves the reader unable to tell a stale install from a current one.

State which of these apply to the workspace you just loaded, using its own documents. If a document
claims an enforcement that does not exist, that is a defect worth reporting, not a detail to smooth
over.
