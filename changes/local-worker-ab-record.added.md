- **The machinery for the local worker's A/B record, and no record yet.**
  [`local-llm.mjs`](../packs/tools/local-llm/runner/local-llm.mjs)'s `eval --ab --write` captures arm L,
  each task's local model as routed, against arm H, the host agent, on `eval`'s three tasks at `k = 5`
  per cell, both graded by `eval`'s predicates. Arm H is a paid run whose prompts leave the machine, so it
  runs only where `--host-cmd` names the host command, and never with a permission bypass. Every turn is
  journalled before the next, so an interrupted capture resumes without paying for a turn twice.
  `eval --verify` regrades every captured turn, re-folds the cells and byte-compares the register without
  running a model, exiting `2` where no record exists. Both are tested offline on a synthetic capture
  under `cli/fixtures/local-worker/`. No capture has run: `evals/ab/local-worker.json` does not exist,
  and the shipped routing is not yet earned by one.
