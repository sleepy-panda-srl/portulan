- **A repository that installs Portulan is offered five-minute cache writes, with what they save and what a
  pause costs, and a workspace can declare the multipliers its restart threshold is priced at.** `init` asks
  once at a terminal, or takes `--cache-lifetime 5m|1h`, and on a yes drafts
  `"sessions": { "cache_lifetime": "5m" }` at Workspace Definition 2.11, which `portulan compile` writes into
  `.claude/settings.json` as `promptCacheTtl`; without one it prints the offer, and `upgrade` prints it too
  and writes nothing. On Portulan's own tasks, run straight through, five-minute writes cut a boot's cost by
  22 to 30% and an edit's by about 18% against an hour's ([`evals/ab/warm.md`](../evals/ab/warm.md)), while
  one pause past five minutes in a long session can cost more than every write they saved, so the offer says
  so. `doctor` reports every session switch's state, and the multipliers, in one line. Workspace Definition
  **2.12** adds one optional key, `spend`, for the read and write multipliers and the horizon proposal
  [`0038`](../.portulan/proposals/0038-what-a-change-spends-is-measured.md) computes the restart threshold at:
  [`cli/ledger.mjs`](../cli/ledger.mjs) reads it with `--workspace`, `compile` writes its figures onto the
  restart advisory's commands, and `doctor` gates it to 2.12 and checks its ranges; without it every figure
  says `undeclared` as before, and every 2.11 manifest stays valid unchanged. This repository's own headless
  runs now write for five minutes; its interactive sessions keep the host's default.
