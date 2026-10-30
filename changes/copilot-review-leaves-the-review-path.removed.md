- **Copilot review has left this repository's review path, by the maintainer's decision of 2026-10-30.**
  The `copilot-request` workflow, which asked for Copilot's review with his token on a pull request a bot
  opened, is gone, with the `workflow-filters` fixtures that pinned its jq programs. The gate map no
  longer makes a merge wait for Copilot's round: an open review thread still blocks it, whoever opened it,
  and [*Merge discipline*](../.portulan/gate-map/merge-discipline.md) keeps the retired rule as history.
  Three memory records named Copilot's leaving as their retirement condition: two are retired, and
  [`an-answer-lands-on-the-thread-that-raised-it.md`](../.portulan/memory/an-answer-lands-on-the-thread-that-raised-it.md)
  keeps only its reviewer-neutral rule. The review-loop register is now historical.
