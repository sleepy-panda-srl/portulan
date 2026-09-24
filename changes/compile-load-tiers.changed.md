- **A workspace's guidance compiles into the load tier it declares, so a long instruction file can be split
  without losing a line.** Workspace Definition 2.10 adds one optional slot, `slots.context`: a directory of
  Markdown units, each naming in its frontmatter one of proposal
  [`0036`](../.portulan/proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md)'s four load tiers
  (`always`, `on-path` with its `paths`, `on-invoke` or `on-read`) and, for every tier but `always`, the
  one-line description an agent decides by. [`compile`](../cli/compile.mjs) emits each in Claude Code's own
  form: an unscoped rule in `.claude/rules/portulan/`, a rule scoped by `paths:`, a project skill, or one
  line in an index of pointers, and `compile --check` byte-compares every one against its unit, so the
  existing compile recipe reds a stale file. A tier a host cannot express degrades to a pointer, never to
  nothing: the `AGENTS.md` that `vendor --host` writes carries the `always` units inline and the rest as
  one line each. `compile` never writes `CLAUDE.md`, never writes or removes through a link, and never
  replaces or removes a rule or a skill it cannot show it wrote. A workspace with guidance and no gate policy
  compiles its guidance alone and says no enforcement is compiled; a `gates` key `compile` will not read still
  stops it with exit 2. What `compile` wrote from guidance a workspace stops declaring is removed by its next
  run, with a gate policy or without one. An adopter moves a section of an always-loaded file into a unit and
  runs `npx @sleepy_panda_srl/portulan compile`.
