- **The session that owns a pull request awaits Copilot's round and reports it; no check judges the
  round.** This repository's merge discipline still requires Copilot's feedback to be awaited and
  resolved. The owning session now awaits the round on the final head and names the review and the commit
  it addressed when it says the pull request is ready, and unresolved Copilot threads still block the
  merge. The `copilot-reviewed` check and its workflow are removed; the request for bot-authored pull
  requests stays. The rule and its carriers are in
  [`.portulan/gate-map/merge-discipline.md`](../.portulan/gate-map/merge-discipline.md). Nothing in the
  package changes.
