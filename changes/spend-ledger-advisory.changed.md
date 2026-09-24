- **What a change spends is read from the host's own records, and a session is told once when continuing
  costs more than restarting.** [`cli/ledger.mjs`](../cli/ledger.mjs), proposal
  [`0038`](../.portulan/proposals/0038-what-a-change-spends-is-measured.md)'s ledger, prints what a branch spent
  across the repository's worktrees: requests and tokens by class for sessions and subagents apart, contexts
  opened, compactions, the largest context, the hit rate, each rebuild and its cause, tokens per changed
  line, the difference from the totals the host saves, and the latest session's restart threshold. It reads
  Claude Code's local transcripts, numbers only, counts a request once although the host writes it once per
  content block, makes no network call and never runs inside a recipe; an adopter runs it as
  `node <plugin root>/cli/ledger.mjs`. `compile` now wires [`cli/advisory.mjs`](../cli/advisory.mjs) into
  `.claude/settings.json` for every workspace: a `PostToolUse` and a `UserPromptSubmit` hook that put one
  line into the context, once, with the first tool result or at the first prompt whose recorded usage has
  reached the threshold `F × (1 + m_w / (20 × m_r))`, never in a subagent, and a status line that shows the
  human the same figure, each reading only what the transcript gained since its last call. Both lead with
  the session's request count, the unit a change is priced in, as a report and never a budget. The tool
  result is what reaches a session at work: a headless run's one prompt comes before any request is
  recorded, so the prompt hook alone never spoke in one. **The status line takes the place of one set in your
  user settings, in that repository**; set `statusLine` in `.claude/settings.local.json` to keep yours. Until
  a manifest key declares the multipliers, both say `undeclared` and use the general read multiplier, 0.1×,
  and the write multiplier of the cache lifetime the host recorded. The new
  [`ledger`](../.portulan/verify/ledger.sh) recipe rails the reader on synthetic records with known totals.
