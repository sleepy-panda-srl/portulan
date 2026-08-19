# `spec/migrations/` — what a migration is

> Part of the **Workspace Definition**. [`../README.md`](../README.md)'s *Versioning and migrations*
> section is the contract this directory implements, and this directory exists on that section's own
> stated condition: a migration needed code. The runner is
> [`../../cli/upgrade.mjs`](../../cli/upgrade.mjs).

## A step, and the two kinds

A migration is not one act. It is an ordered set of **steps**, each a zero-dependency ESM module
exporting a single `step` object, and each of exactly one kind:

| Kind | What it is | Keyed on |
|---|---|---|
| `version` | A Workspace Definition MAJOR migration. `spec/README.md`'s rule stands: **MINORs are additive and owe no migration**, so there is no such thing as a MINOR step and nothing here restamps one. | `from` → `to` |
| `repair` | Something a rewriter owes a workspace it touches, independent of any version — a value that was true where it was written and is not true where the workspace now is. | the workspace's own state |

The second kind exists by the maintainer's ruling. Without it this directory would hold
one step (`1.0 → 2.0`) with **no subject in this repository and none in any tree we have seen** —
machinery demonstrable only on a fixture. What actually bites an adopter is a workspace that travelled.

```js
export const step = {
    id: "0002-bundle-fallback-path",   // stable, sortable; the id IS the chain's order
    kind: "repair",                    // "version" | "repair"
    from: null, to: null,              // version steps only; null on a repair
    title: "…",                        // one line, printed in the plan
    why: "…",                          // why it is owed at all, printed under -v
    owed(ws),                          // → { owed: true | false | null, because }
    plan(ws, ctx),                     // → { ok: true, edits } | { ok: false, reason }
};
```

`ws` is a read view of the workspace — `{ dir, manifest, manifestText, list(), read(rel) }`. `ctx`
carries `{ bundle, spec, tree }`: the CLI root this run is executing from, the Workspace Definition
version **this bundle implements**, and the `--tree` a step may need and must never invent. An `edit`
is `{ file, next }` — a relative path and its whole next contents.

## Three properties, and what each one replaces

**Owedness is derived from the workspace's state, never from a stamp.** There is no
`migrations-applied` ledger, so there is nothing to keep in sync and nothing that can lie about what
ran. A step answers *am I owed* by looking at the workspace, every time.

**Every step is idempotent.** Applying one twice changes nothing. This is what buys out a transaction:
a run interrupted partway is recovered by **re-running**, because the steps that landed now answer
*not owed* and the ones that did not are still owed.

**`owed` is three-valued.** `true`, `false`, and **`null` — could not tell**. A step that cannot
answer must not answer *not owed*: that is *nothing looked* recorded as *nothing wrong*, and it is the
failure shape this workspace has paid for more than any other. `null` maps to **exit 2**, never to a
green. The same discipline governs the reads underneath: only `ENOENT` means absent, and an `EACCES`
is a question that could not be answered.

## Limits, stated where a reader meets them

- **This chain governs the workspace train only.** Two version trains exist —
  `portulan.spec` for the Workspace Definition, `portulan.pack` for the Pack Definition (at 1.0). **No
  step here reaches a pack manifest**, and a pack train migration would be its own directory and its
  own runner.
- **A repair rewrites a value that may still resolve.** `0002` re-points a bundle path at the bundle
  that ran `upgrade`, whether or not the old one still exists. That is deterministic and idempotent,
  and it is chosen out loud: the alternative — repair only what is broken *here* — makes the result
  depend on which machine ran it, which is the property the repair exists to remove.
- **The pre-state gate is asymmetric, by construction.** `cli/upgrade.mjs` refuses to migrate a
  workspace `doctor` already reds. It can only ever apply that gate to a **same-MAJOR** run: a
  workspace behind by a MAJOR is one `doctor` refuses outright — that refusal is why this directory
  exists — so such a run is graded **post-state only**, and a red afterwards is reported without
  claiming the migration caused it.
- **Nothing here restamps a MINOR.** A manifest declares the version its content needs, not the newest
  one — `spec/README.md`'s own rule, the one that keeps `examples/` at 2.4 as live compatibility
  evidence and keeps `init`, `new` and `vendor` writing `2.7`.

## The steps that exist

| Step | Kind | What |
|---|---|---|
| [`0001-repository-declares-its-tree.mjs`](0001-repository-declares-its-tree.mjs) | `version` 1.0 → 2.0 | The one migration `spec/README.md` documents: a `repository` workspace must declare `tree`. It **will not guess** the value — `"../"` only where the parent is verifiably the repository root, otherwise it refuses and names `--tree`. |
| [`0002-bundle-fallback-path.mjs`](0002-bundle-fallback-path.mjs) | `repair` | `init` bakes the bundle it ran from into `verify/index.sh` as an absolute path, marked `# portulan:bundle-fallback`. `vendor --switch` copies it byte for byte. The rail then exits **2 — could not run**, which is fail-closed and therefore easy never to notice. This re-derives it. |

**`0001` has no subject in this tree** — nothing declares 1.0 — and is exercised against a fixture,
which is said here rather than dressed up. **`0002` has no subject in this repository either**: this
workspace's `verify/index.sh` was written by hand, not drafted by `init`, and carries no marker. It is
exercised against workspaces the real `init` drafts.

## Adding one

Drop a module in, named `NNNN-slug.mjs`. `cli/upgrade.mjs` reads the directory and orders by filename,
so nothing registers a step anywhere else — there is no list to keep in sync with the tree, which is
the second carrier this repository keeps repairing out of its own design.

A `version` step ships **with** the MAJOR bump that needs it, never after: `spec/README.md`'s
*"A MAJOR bump ships with a migration"* is the rule, and a MAJOR that merges without one has already
broken it.
