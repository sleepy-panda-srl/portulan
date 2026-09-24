# Boot Portulan — step 3a: the workspace names packs

> **Step 3a of [`steps.md`](steps.md) in full, read at boot only where the workspace's manifest names a
> pack in `packs`.** Its step numbers are the skill's, and its reasons are in
> [`rationale.md`](rationale.md) under 3a. It moved here on 2026-09-23, under proposal 0036 as amended
> that day: none of it was deleted, and none is kept in both files.

The cascade is **core < pack < workspace < repo card < task**, so a workspace naming packs has a layer
between the engine and its own policy. That layer is the manifest's `packs` array, and **none of
step 3's slots points at it**: read them in order and you will never meet a pack. Read the key, and report
what a declared pack does and does not deliver here, because the gap is invisible from inside a booted
session.

**A pack resolves against a root, and where that root came from decides what "resolved" proves.** The
manifest's `tree` derives one — `<tree>/packs`. The CLI's `--pack-root` names any directory instead, as
many as it is given, and named roots **replace** the derived one rather than being searched ahead of it.
Where a pack resolves, its gate-policy fragments reach the compiled policy, add-restriction-only.
Nothing here is pinned — a `packs` entry is a name, and the version is whatever the root holds. **Four
things need stating about that layer — two limits that still bind, and two that once did and no longer
do.**

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
  deeper counts them. Declaring `packs/rituals/<pack>/skills/` registers them.

  Depth alone was never parity, and saying so is the point: **registration is a property of
  `.claude-plugin/plugin.json` and of nothing else**. `plugin-lint`'s `compose` check pins the two
  together in both directions — a composed pack whose skills no declared path reaches is red, and a
  skills path inside `packs/` belonging to no composed pack is red — so *composed* and *registered* can
  no longer drift apart in a bundle this validator runs over.

  **The adopter's half is built** ([#184](https://github.com/sleepy-panda-srl/portulan/issues/184)). `cli/skills-set.mjs` is the one carrier of the **registrable set**: it reads each
  composed pack's own `contributes.skills` and derives the paths a plugin manifest must declare, with
  `--check` reporting drift and `--write` deriving the key. So the path is computed rather than typed.
  **Two limits, because the clause is not whole.**
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

**Name the packs, and say all of that in the same breath.**
