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

### 2a. If the manifest is a pointer, the workspace is somewhere else

A manifest whose `kind` is `pointer` is **not** a workspace. It is one thin file saying that this
repository's workspace resides elsewhere, and naming it: `governed_by.workspace` is the governing
workspace's name, and `governed_by.feed`, where present, is the private feed it ships through. A
repository is governed by exactly one workspace — its own, or a pointer to the workspace that names it,
never both — so a pointer is the whole answer about residence, not a hint to be supplemented.

**Report it and stop; do not improvise.** Say which workspace governs this repository, say that it is not
installed here, and then go to step 4 and give that section's honest position — because that is the true
one: you have the engine's universal mechanism and none of this team's policy. In particular:

- **Do not fetch it.** Resolving `governed_by` to an installed plugin needs a host's plugin cache, and
  nothing here discovers one. **Discovery is milestone 7's**, owned by its row as of the 2026-08-03 amendment — and what arrives *here* is narrower than what arrives in the CLI: this skill **is scoped to** reporting discovery's answer honestly, including *not installed here*; resolving a pointer is the CLI's.
- **Do not read the pointer's neighbours as policy.** A pointer carries no slots, and a `.portulan/`
  directory beside it holding files anyway is a defect worth reporting, not a workspace to load.
- **Do not treat this as "no workspace".** The difference matters to the person you are reporting to: a
  repository with no workspace has not adopted Portulan, while this one has and its policy layer is one
  install away. Say which of the two you are looking at.

If the user can install the named workspace — from the feed, or from a checkout beside this repository —
that is the thing to ask for. Booting on a pointer and proceeding as though you had the policy layer is
the same failure shape as booting on another team's workspace: it looks like a boot and it is not.

## 3. Read the slots the manifest names

The manifest is an index, never a container: it names paths, and the prose lives in Markdown at the
other end of them. Read the slots in this order, because each frames the next:

1. `identity` — who this team is, what they work with, and their glossary. Terms defined there mean
   exactly that here.
2. `principles` — how they decide. The tie-breakers.
3. `constitution`, if declared — the document their work is graded against. It may point outside the
   workspace directory; it is the one slot allowed to.
4. `gates` — the gate map: which concrete actions are unattended, which need review, which need a
   human's explicit approval. **Read this before acting, not after.**
5. `dod` — the definition of done, which extends the engine's floor and may never lower it.
6. `repos/` — the card for the repository you are actually in: build, test, run, layout, quirks.
7. `memory/` — the rules this team has minted from its own incidents. Each carries provenance and a
   retirement condition, so a rule can be weighed rather than merely obeyed.

Then read `verify.recipes` from the manifest. Those are the executable checks that decide "done"
here, and the manifest names which one is the default.

### 3a. Read `packs` too — no slot points at it, and what it delivers is partial

The cascade is **core < pack < workspace < repo card < task**, so a workspace naming packs has a layer
between the engine and its own policy. That layer is the manifest's `packs` array, and **none of the
slots above points at it**: read them in order and you will never meet a pack. Read the key, and report
what a declared pack does and does not deliver here, because the gap is invisible from inside a booted
session.

**A pack resolves against a root somebody names** — a feed install or a directory beside the workspace,
those being the two shapes a named root takes — and where it resolves, its gate-policy fragments reach
the compiled policy, add-restriction-only. Nothing here is pinned: a `packs` entry is a name, and the
version is whatever the named root holds. Four things do not follow, and **each is milestone 7's, owed
rather than broken**:

- **Nothing discovers the root.** No host's plugin cache is read to find one, which is the same absence
  step 2a reports for a pointer. Until it lands, a workspace whose manifest declares no `tree` gets no
  root at all and its packs are reported unresolvable — so *"declared"* and *"resolved"* are two states
  here, and which one you are in depends on a path somebody typed.
- **A pack's skills do not register as host capabilities — whatever the channel.** Not a property of
  feeds: it holds for a pack bundled inside a plugin that declares the pack directory as a skills path,
  which is the arrangement this engine itself ships. So a pack's rituals are invoked by **naming their
  path**, never the way a core skill is. Do not tell the user a composed ritual is available as a
  command.
- **A pack's personas reach the workspace's own layer, and not the host.** A composing workspace lands
  the scope a pack's persona declares, and an index over it can be generated — so this one is not
  simply absent, and reporting it as absent would be as wrong as reporting it as loaded.
- **A pack's verify recipes are declared, not composed.** The Pack Definition says so in the key
  itself. The recipes that decide "done" are the ones the workspace's own manifest declares, and a
  pack's are not in that set.

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
of it. _(This paragraph read "there is no scaffolder yet" until milestone 7 shipped `init` and `new` —
which step 5 of this same file already said, so the file contradicted itself one screen later.)_

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
  directory. Say which of them you are looking at rather than assuming any. _(This line read "Memory has
  no generated index" from 2026-07-26 until now, and milestone 5 built one on 2026-07-28 — a sentence
  denying a capability that exists, which is condition 4 of a definition of done pointing the other
  way.)_
- **The CLI is not published, so nothing is one `npx` away.** Six of the eight subcommands are built
  and run from a checkout — `init`, which drafts a workspace for a team that has none; `new`, which
  scaffolds a skill, persona, pack, workspace, gate policy or repo card into a layer you own; `vendor`,
  which materialises a workspace into a host or moves it between residences; plus `doctor`, `compile`
  and `index`. `upgrade` and `feedback` are not built and exit 2 naming where they arrive. What `init`
  and `new` emit is a **draft**: a human curates it, and `init`'s verify recipe exits 2 until they say
  what green means for their repository. _(This bullet said "there is no CLI" and listed `compile` and
  `index` as arriving later; both had shipped at milestones 4 and 5, and the entry point at milestone 7.
  Corrected at milestone 7 session 1, then session 2, then session 3 — the count has now gone stale
  three times, which is the argument for deriving such a figure rather than writing it down, in a file
  where nothing can.)_

State which of these apply to the workspace you just loaded, using its own documents. If a document
claims an enforcement that does not exist, that is a defect worth reporting, not a detail to smooth
over.
