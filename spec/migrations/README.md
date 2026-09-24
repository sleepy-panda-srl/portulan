# `spec/migrations/` — what a migration is

> Part of the **Workspace Definition**. [`../README.md`](../README.md)'s *Versioning and migrations*
> section is the contract this directory implements, and this directory exists on that section's own
> stated condition: a migration needed code. The runner is
> [`../../cli/upgrade.mjs`](../../cli/upgrade.mjs).

## A step, and the three kinds

A migration is not one act. It is an ordered set of **steps**, each a zero-dependency ESM module
exporting a single `step` object, and each of exactly one kind:

| Kind | What it is | Keyed on |
|---|---|---|
| `version` | A Workspace Definition MAJOR migration. `spec/README.md`'s rule stands: **MINORs are additive and owe no migration**, so there is no such thing as a MINOR step and nothing here restamps one. | `from` → `to` |
| `repair` | Something a rewriter owes a workspace it touches, independent of any version — a value that was true where it was written and is not true where the workspace now is. | the workspace's own state |
| `form` | A move of a consumer's records or boot to the form Portulan moved its own to, in the repository beside the workspace as well as in it (2026-09-24). Today's form stays legitimate and boots as it did, so a form step is owed only where the new form is not there yet, and `doctor` reports the form without failing it. | the workspace's and its tree's own state |

The second kind exists by the maintainer's ruling of 2026-08-12. Without it this directory would hold
one step (`1.0 → 2.0`) with **no subject in this repository and none in any tree we have seen** —
machinery demonstrable only on a fixture. What actually bites an adopter is a workspace that travelled.

```js
export const step = {
    id: "0002-bundle-fallback-path",   // stable, sortable; the id IS the chain's order
    kind: "repair",                    // "version" | "repair" | "form"
    from: null, to: null,              // version steps only; null on a repair or a form step
    title: "…",                        // one line, printed in the plan
    why: "…",                          // why it is owed at all, printed under -v
    owed(ws, ctx),                     // → { owed: true | false | null, because, hand? }
    plan(ws, ctx),                     // → { ok: true, edits } | { ok: false, reason }
};
```

`ws` is a read view of the workspace — `{ dir, manifest, manifestText, list(), read(rel), repository }`,
`repository` being a read view of the tree the manifest declares, `{ dir, read(rel), names(rel), git }`,
or `null` where it declares none; `git` runs git in the tree, and is `null` where no work tree answers
there. `ctx` carries `{ bundle, spec, tree, today }`: the CLI root this run is executing from, the
Workspace Definition version **this bundle implements**, the `--tree` a step may need and must never
invent, and the date a record written today carries. An `edit` is `{ file, next }` — a relative path
and its whole next contents — relative to the workspace, or to the tree where it says `root: "tree"`;
a `next` of `null` deletes the file. Rollback puts back what each edit replaced or deleted, in either
root, and the report names each file as its root names it.

**After each step applied, the steps after it are asked again.** A step owed only once an earlier one
has landed, `0007` compiling the card `0006` drafts, is applied in the same run rather than the next.
**And after a pass that applied a step, the whole chain is asked again** until a pass applies nothing
(2026-09-24), so a later step can make an earlier one owed, as `0008` does `0007` by editing the card;
a chain still applying after as many passes as it has steps is refused and rolled back.
**A step owed where it does not place its edits answers `hand: true`** (2026-09-24), its `because` naming
what a person adds: `upgrade --write` applies the rest of the chain, reports that step as owed and not
placed once `doctor` is green, and exits 1, as `--check` does over a step owed.
A form step reads a workspace at this bundle's MAJOR only (`notYetForm` in
[`../../cli/form.mjs`](../../cli/form.mjs)): one a MAJOR behind is moved by a version step first, and
the form steps are then asked again, so a workspace no version step reaches is still refused.

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
  evidence and keeps `new` and `vendor` writing `2.7`. `0006` writes 2.10 into a manifest older than it
  because the step declares `slots.context`, the key 2.10 added, which is the same rule; `init`
  writes 2.10 for the same reason.

## The steps that exist

| Step | Kind | What |
|---|---|---|
| [`0001-repository-declares-its-tree.mjs`](0001-repository-declares-its-tree.mjs) | `version` 1.0 → 2.0 | The one migration `spec/README.md` documents: a `repository` workspace must declare `tree`. It **will not guess** the value — `"../"` only where the parent is verifiably the repository root, otherwise it refuses and names `--tree`. |
| [`0002-bundle-fallback-path.mjs`](0002-bundle-fallback-path.mjs) | `repair` | `init` bakes the bundle it ran from into `verify/index.sh` as an absolute path, marked `# portulan:bundle-fallback`. `vendor --switch` copies it byte for byte. The rail then exits **2 — could not run**, which is fail-closed and therefore easy never to notice. This re-derives it. |
| [`0003-handoff-index-not-kept.mjs`](0003-handoff-index-not-kept.mjs) | `form` | A kept handoff index is deleted and its path git-ignored, so none is committed again; `portulan index --handoffs` prints it. Owed by git's answer: a copy git ignores and does not track is one machine's own, and is left alone. |
| [`0004-changelog-fragments.mjs`](0004-changelog-fragments.mjs) | `form` | Each entry under `CHANGELOG.md`'s Unreleased becomes a fragment under `changes/`, and the heading keeps a two-line pointer. **Proved before it is offered**: the fragments, rendered as the cut renders them, must print each section back as the changelog held it, or the step refuses; a heading naming none of the six sections is refused too. The one change is an entry that does not open `- `, a `*` or `+` marker or a tab after one, whose fragment does since the cut accepts no other, and the step names each such entry by its line. |
| [`0005-session-log-retired.mjs`](0005-session-log-retired.mjs) | `form` | Each tracked Markdown file with a `Session log` holding entries keeps its heading and two lines naming the last commit that holds them. **Refused on a file with changes not committed**, since the pointer would name a commit that lacks them. |
| [`0006-boot-card.mjs`](0006-boot-card.mjs) | `form` | Where `slots.context` is undeclared, a boot card is drafted from the workspace's own files, as `init` drafts one, and the slot declared at 2.10. A declared slot with no `boot` unit is a workspace that boots through its slots, and is owed nothing. |
| [`0007-guidance-compiled.mjs`](0007-guidance-compiled.mjs) | `form` | The guidance half of `portulan compile` written where it drifted: the card and the rules the host loads, through `compile`'s own planner and refusals, and never `.claude/settings.json`, which enforces gates and is a person's to compile. |
| [`0008-card-reading.mjs`](0008-card-reading.mjs) | `form` | A card drafted before it carried the engine's rules on reading and the cache gets that section, which `compile` writes out from the installed Portulan's `core/operating/context.md`, and `0007` compiles it. A card lacking the section under any other head is owed it by hand: the run names the head the step looks for and the line to add, applies the rest of the chain and exits 1, and `doctor` names the card until the line is there. |

**`0001` has no subject in this tree** — nothing declares 1.0 — and is exercised against a fixture,
which is said here rather than dressed up. **`0002` has no subject in this repository either**: this
workspace's `verify/index.sh` was written by hand, not drafted by `init`, and carries no marker. It is
exercised against workspaces the real `init` drafts. **Neither have the form steps**: this repository
moved its own records and boot by hand on 2026-09-23 and 24, and `0003`–`0008` are exercised against a
consumer the real `init` drafts, put back in the form it drafted before, and committed.

## Adding one

Drop a module in, named `NNNN-slug.mjs`. `cli/upgrade.mjs` reads the directory and orders by filename,
so nothing registers a step anywhere else — there is no list to keep in sync with the tree, which is
the second carrier this repository keeps repairing out of its own design.

A `version` step ships **with** the MAJOR bump that needs it, never after: `spec/README.md`'s
*"A MAJOR bump ships with a migration"* is the rule, and a MAJOR that merges without one has already
broken it.
