# Boot Portulan — steps 1 to 5: the boot where no card is loaded

> **The boot in full, where [`SKILL.md`](SKILL.md) finds no boot card in the session's context.** Every
> instruction is here or, for steps 2a and 3a, in the file that step opens where it applies.

## 1. Load the kernel

Read `${CLAUDE_PLUGIN_ROOT}/core/engine.md` in full. Everything else in
`${CLAUDE_PLUGIN_ROOT}/core/operating/` loads on demand, when the kernel's map sends you there.

Do not read all of `core/` up front.

**If that read is denied, the kernel did not load — say so and do not proceed as though it had.**
Ask for read access to the bundle, or report the boot as incomplete.

## 2. Find the workspace — in the project, never in this bundle

Look for a workspace manifest at `${CLAUDE_PROJECT_DIR}/.portulan/workspace.json` — that is the project
root, the directory the session was started in. If the variable is not set, use the working directory;
do not fall back to searching upward or outward.

**Search the project only.** If the project has no workspace, that is the answer; go to step 4.

### 2a. If the manifest is a pointer, resolve it — the workspace is somewhere else, and the CLI finds it

**Where the manifest's `kind` is `pointer`, read [`pointer-manifest.md`](pointer-manifest.md) and follow
it before step 3: it is this step in full.** If the read is denied, this step did not load: say so, ask
for read access to the file, and do not proceed as though it had. A manifest whose `kind` is
`repository`, `demo` or `portfolio` is the workspace itself, and its boot skips the file. Any other
`kind`, or none, is a defect in the manifest: report it, as `doctor` would, and do not read its slots
as this team's policy.

## 3. Read the slots the manifest names

**Paths resolve against the directory the manifest sits in** — the project's `.portulan/`, or, where
step 2a resolved a pointer, the installed workspace's own root. Read the slots in this order, because
each frames the next:

1. `identity` — who this team is, what they work with, and their glossary. Terms defined there mean
   exactly that here.
2. `principles` — how they decide. The tie-breakers.
3. `constitution`, if declared — the document their work is graded against. It may point outside the
   workspace directory; it is the one slot allowed to.
4. `gates` — the gate map: which concrete actions are unattended, which need review, which need a
   human's explicit approval. **Read this before acting, not after.**
5. `dod` — the definition of done, which extends the engine's floor and may never lower it.
6. `repos/` — the card for the repository you are actually in: build, test, run, layout, quirks.
   **Select it, do not read the directory.** The one that matters is the card naming *this*
   repository. Where none does, say so.
7. `memory/` — the rules this team has minted from its own incidents. Each carries provenance and a
   retirement condition, so a rule can be weighed rather than merely obeyed.

Then read the recipe set. `verify.recipes` in the manifest is the workspace's **own** half of it; the
executable checks that decide "done" are the set
[`../../../cli/recipe-set.mjs`](../../../cli/recipe-set.mjs) **yields** — those recipes plus the ones
the workspace's composed packs contribute, namespaced by pack — and the manifest names which one is
the default. *Declared* and *runnable* are not the same list; step 3a carries the rest.

### 3a. Read `packs` too — no slot points at it, and what it delivers is partial

**Where the workspace's manifest, in the project or resolved at step 2a, names a pack in `packs`, read
[`packs.md`](packs.md) and follow it: it is this step in full.** A boot on a manifest naming no pack
skips the file. If the read is denied, this step did not load: say so, ask for read access to the file,
and do not report the packs as though it had.

## 4. If the project has no workspace

Say so plainly rather than improvising a policy layer. Without a workspace you have the engine's
universal mechanism and none of this team's policy — which means you do not know their gates, their
lanes, or their bar for done, and you should not guess at any of the three.

What is available to read, in this bundle:

- `${CLAUDE_PLUGIN_ROOT}/examples/` — a complete fictional workspace, two products, meant to be read
  end to end as the worked example.
- `${CLAUDE_PLUGIN_ROOT}/spec/` — the Workspace Definition: the schema and a per-slot document
  explaining what each slot is for and what it was derived from.
- `node "${CLAUDE_PLUGIN_ROOT}/cli/doctor.mjs" "<workspace-dir>"` — validates a workspace against that
  definition. Zero dependencies; it needs Node and nothing else.

Authoring a workspace ends with a human: `node "${CLAUDE_PLUGIN_ROOT}/cli/init.mjs"` drafts one — see
step 5 — and what it emits is a **draft**, so read the demo, compare, and curate before trusting a line
of it.

## 5. Report what is enforced, and what is not

Close the boot by stating the honest position:

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
  step 3a's four limits — not a summary of them, which is how one of them ends up quietly dropped.
  Where the read of `packs.md` was denied, say step 3a did not load instead of giving them.
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
  pointer — and where it was resolved, name the plugin and the **version**.
- **So is what every context here loads.** Give the line
  `node "${CLAUDE_PLUGIN_ROOT}/cli/context.mjs" --workspace "${CLAUDE_PROJECT_DIR}/.portulan" --brief`
  prints; run it with step 3's reads. Where `${CLAUDE_PROJECT_DIR}` is not set, the working directory
  stands in for it, as in step 2.

State which of these apply to the workspace you just loaded, using its own documents. If a document
claims an enforcement that does not exist, that is a defect worth reporting, not a detail to smooth
over.
