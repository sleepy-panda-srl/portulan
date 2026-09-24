- **A memory record's cap can bind forward only, and the librarian's pass leaves no record of its own.**
  Workspace Definition 2.11 adds one optional key, `memory.store.budget.cutoff`, beside
  `memory.store.budget.record_kilobytes`: with it, the per-record cap binds only the records dated after the
  cutoff, and the index recipe reports the older ones over it without going red. Each record then carries a
  `**dated:**` line, the day its text last changed, which the [memory template](../core/templates/memory-entry.md)
  now holds; a record without a real date, or dated more than a day ahead, is refused, and `doctor` refuses a
  cutoff that is not a real day or has no cap beside it. `cli/librarian.mjs` no longer writes a Session log
  entry or a handoff: `--report <path>` writes its report outside the tree, `--since` names where its mining
  window opens, and the scheduled workflow opens a pull request carrying the report only when the pass changed
  the tree, and otherwise leaves it in the run's summary. In Portulan's own repository the cap is 2 KB from
  2026-09-24, and the four records near the old 8 KB cap are compressed under it.
