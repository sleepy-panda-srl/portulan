- **What a boot reads and what the host loads into every context are measured, and Portulan's own share
  cannot grow unnoticed.** [`cli/context.mjs`](../cli/context.mjs), proposal
  [`0036`](../.portulan/proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md)'s measurement,
  lists for any workspace every file a boot reads in full and every file Claude Code loads into every
  context there (instruction files and their imports, unscoped rules, skill, command and agent
  descriptions), each with its size, its tokens at the declared ratio and why it counts. Where a manifest
  declares a budget, Workspace Definition 2.9's `context.always.budget.tokens`, the always tier is railed
  against it; otherwise it is a report. A pointer manifest is refused with the reason: its
  workspace is resolved from the host's install records, which a recipe must not read, so an adopter
  measures the workspace it resolves to.
  An adopter runs it as `node <plugin root>/cli/context.mjs --workspace .portulan`. This repository's
  new [`context`](../.portulan/verify/context.sh) recipe rails Portulan's own footprint at its figures plus
  2%: the boot skill and kernel every adopter's boot reads (11,825 bytes), the skill's two step files
  (10,729), the plugin's descriptions (3,386), and both workspaces' boot read-sets. **Those now count
  the manifest**, which the boot reads whole and every figure the day's records gave, from 213,002 to
  92,998, left out. On the tree this landed on (main at a534f15), the nine files this repository's
  figures counted are 86,717 bytes, 92,998 with the packs step its boot reads, and 100,053 with the
  manifest; the demo's 33,591 is 35,393 with it.
