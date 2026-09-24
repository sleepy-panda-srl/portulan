- **A workspace can declare the host switches that decide whether a fresh session starts warm, each earned by
  an A/B run first.** Workspace Definition 2.11 adds one optional key, `sessions`, the machine half of the new
  doctrine page [`core/operating/sessions.md`](../core/operating/sessions.md): a session that starts after
  another reads the host's prefix from the prompt cache instead of writing it again, so a task runs in as few
  fresh contexts as it can and keeps what varies per session out of the prefix. `git_instructions` and
  `cache_lifetime` compile into `.claude/settings.json` as Claude Code's `includeGitInstructions` and
  `promptCacheTtl`, said on every `compile` run with the way back for one session; `headless` carries the same
  two and the dynamic-sections exclusion for the sessions Portulan's own runners start, since that one is no
  setting. Nothing is defaulted, so a manifest without the key compiles byte for byte as before. In this
  repository, [`cli/warm.mjs`](../cli/warm.mjs) runs fresh headless sessions in sequence and reports each from
  the host's own records in three lines, A Portulan's share, B the whole task and C the cost, warm against
  cold, and [`evals/ab/warm.md`](../evals/ab/warm.md) says what a switch must show before a workspace declares
  it; it does not ship. This repository declares no switch yet.
