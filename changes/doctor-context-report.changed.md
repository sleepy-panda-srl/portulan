- **`doctor` reports what every context in your repository loads, and the boot closes with the same
  line.** Every `doctor` run now carries a `context` note for each workspace: Claude Code's always tier in
  the repository its manifest's `tree` names, in bytes and tokens, its three largest files and what each
  is, what sits on-path beside it, and the Portulan plugin's own descriptions, measured by
  [`cli/context.mjs`](../cli/context.mjs). It fails only where the manifest declares a budget, Workspace
  Definition 2.9's `context.always.budget.tokens`: over it, or where the budget cannot be judged. The boot
  skill's closing report gives the same line, `node <plugin root>/cli/context.mjs --workspace .portulan
  --brief`, run alongside its slot reads, which adds 194 bytes to the skill, to 9,111, on every boot. It is
  item 4 of proposal [`0036`](../.portulan/proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md)'s
  order of work, and it arrives with the upgrade.
