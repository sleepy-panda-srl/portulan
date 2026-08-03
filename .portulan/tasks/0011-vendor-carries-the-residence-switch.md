# Task 0011 — `vendor` materialises a workspace, in both directions

**Lane:** full · **Opened:** 2026-08-03, milestone 7 session 2, after [#158](https://github.com/sleepy-panda-works/portulan/pull/158) merged
**Verify recipe:** `tests` · **Status:** scoped, not started · **Unblocked as of 2026-08-03**

> Scoped rather than started, with the blocking question already answered. Task 0010 was written the
> same way and that is what let the next session pick it up without re-deriving anything.

## What unblocked it

`docs/vision.md`'s gloss of `vendor` covered materialising a workspace **into** a repository and not the
reverse, so row 7 deliberately said *"the CLI performs the switch in both directions"* and named no
subcommand — widening the gloss was the maintainer's edit and nobody else's. **He made it on 2026-08-03**:
`vendor` now reads *"materialise a workspace where it is needed: a self-contained AGENTS.md + .portulan/
into any host, and the reverse — out of a repository and into a feed-side workspace that names it"*. The
verb is settled. The deferral recorded in [`../../docs/milestones/m07.md`](../../docs/milestones/m07.md)
is discharged.

## The two jobs, which are one operation with a direction

1. **Vendor into a host** — a self-contained `AGENTS.md` + `.portulan/` for a host that is not Claude
   Code. This is the gloss's original half and the vendored-standards delivery tier.
2. **The residence switch** — feed-side ↔ in-repo, under the contract proposal
   [`0017`](../proposals/0017-one-repository-one-governing-workspace.md) sets, which row 7 states as law:
   the workspace is **materialised in the new residence**, a **pointer or nothing** is left in the old,
   and **`doctor` is green at both ends before the old residence is retired**.

## What the contract forbids, and it is the part that can go wrong silently

**One repository is governed by exactly one workspace.** A switch that materialises the new residence
before retiring the old leaves a window in which two workspaces govern one repository — which is the
dual-management shape `0017` exists to refuse, and `init` already refuses to create. The order in the row
is not a suggestion: green at both ends **first**, retire **after**. A switch that fails halfway must
leave the repository governed by exactly one of them, never zero and never two.

## What already exists to build on

- `cli/init.mjs` writes **both** residences today — a full workspace and a pointer — including the
  pointer's `governed_by` shape and every refusal that guards it. `vendor` is closer to a *move* of what
  `init` can already write than to new emission.
- `cli/new.mjs` has the pointer scaffold (`--kind pointer --governed-by`), demonstrated green under
  `doctor`.
- `cli/doctor.mjs` validates both residences and carries `--repo-root`, which is how "green at both ends"
  is actually measured.
- **The collision, symlink and only-`ENOENT`-means-absent rules are settled** in `init` and `new`. A
  third tool that writes into somebody's tree must carry them too — this is the sibling class
  ([#91](https://github.com/sleepy-panda-works/portulan/issues/91)) that has bitten this milestone in
  every session so far.

## Done when

- [ ] `vendor` materialises a self-contained workspace into a host, and `doctor` is green on the result.
- [ ] The switch runs **both** directions, under `0017`'s ordering, with the old residence retired only
      after both ends are green — and a failure partway leaves exactly one governing workspace.
- [ ] It refuses the same three shapes `init` and `new` refuse: an existing file, a symlink on the
      destination chain, and an `lstat` failure that is not `ENOENT`.
- [ ] Row 7's **fourth demonstration** — parity: one workspace exercised in both residences with no
      functionality difference, and the switch run in both directions. The feed end is the real
      `portulan-internal`, checked out at `~/Sleepy Panda Projects/portulan-internal-repo`.
- [ ] `cli/README.md`, `.portulan/identity.md`, `CHANGELOG.md` and the boot skill updated in the **same**
      change — this milestone has now paid three separate passes for prose a rail cannot see.

## What M7 still owes after this

`upgrade` · verify-recipe composition · clause (b)'s parity · `feedback` · `init`'s interview loop · the
agent-legibility score · pack-cache discovery ([#123](https://github.com/sleepy-panda-works/portulan/issues/123)) ·
the **persona↔agent binding** check (the one row-7 validation family session 2 did not deliver, and the
smallest remaining item) · and **six** demonstrations, not four — amendment 4's composed-recipe
demonstration and clause (c)'s parity clause are row-owed and were missed by session 2's first plan.
