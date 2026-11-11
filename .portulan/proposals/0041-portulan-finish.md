# Proposal 0041 — `portulan finish`, a closing command an adopter's agent can run

**Status. ACCEPTED — active, 2026-11-11.**

**Pull request:** https://github.com/sleepy-panda-srl/portulan/pull/658

## Decision

[Issue 657](https://github.com/sleepy-panda-srl/portulan/issues/657): the boot card `portulan init`
drafts told an agent to close a change with `node <plugin root>/cli/finish.mjs`. Nothing an adopter's
session loads resolves `<plugin root>`, and in two sampled runs on 0.4.0 the agent searched the whole
disk for the file until the two-minute tool limit. The placeholder was deliberate, since a committed
card cannot spell one machine's install directory.

The maintainer ruled twice in conversation on 2026-11-11.

1. **The fix.** Add `finish` to the subcommands, so the card names a command that resolves through the
   path: `portulan finish`. This was chosen over a sentence in the card that explains the placeholder.
2. **The constitution.** Amend [`../../docs/vision.md`](../../docs/vision.md) to name `finish` in its
   delivery tiers, as it was amended for `new` and `feedback`. This was chosen over naming the
   subcommand only through this proposal. The edit is the `change-the-constitution` act, and its
   commit message cites this ruling.

Both rulings preceded this proposal, which records them, and the implementation shares its pull
request. [Task 0059](../tasks/0059-portulan-finish.md) carries the acceptance criteria.

## Enforcement and cost

`portulan finish <arguments>` dispatches to `cli/finish.mjs`, whose arguments and exit codes are
unchanged, and `node cli/finish.mjs` still runs from a checkout. The drafted card's Records section
names `portulan finish` and, for a machine where `portulan` is not on the path, which a plugin-only
install is, `npx @sleepy_panda_srl/portulan finish`, with an instruction not to search the disk. That
adds one sentence to a card loaded into every context. A vendored copy whose card names
`portulan finish` is still told the package is not in the copy.

The `tests` recipe holds each of these: the drafted card's line, the dispatch and its exit codes, the
vendor note, and that the constitution's delivery tiers name every subcommand in the list's order. The
`payload` recipe holds that `finish.mjs` ships as a module the entry point reaches.

## Limits

- A card already drafted keeps the old line: nothing rewrites it, and its owner edits one line by
  hand. An `upgrade` repair that does so is out of scope here and is to be filed as an issue.
- `npx` answers with `finish` only from the first published version that carries it. Until that
  release, the fallback reaches a package without the subcommand, which exits 2 and names the ones
  it has.
- Other card commands that use the placeholder, such as `symbols.mjs`, are unchanged.

**Decision.** Marius Cetanas's two rulings above accept the subcommand and the amendment. The
session-open checkpoint approved the plan with adjustments, which the task carries; it could not
verify the rulings, which were given in conversation.

**Provenance.** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/issues/657` — the issue
the rulings answer, given in conversation on 2026-11-11 before this proposal and its implementation.
