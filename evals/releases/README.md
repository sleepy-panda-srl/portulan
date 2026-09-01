# `evals/releases/`

The eval result each release carries, one pair per version — milestone 8's ninth clause. The argument,
the limits and the two designs a fresh context reversed are in [`../README.md`](../README.md); the
mechanism is [`../../cli/release-eval.mjs`](../../cli/release-eval.mjs). This file does not restate
either, because a rule with two carriers is obeyed at the narrower one.

- `<version>.json` — the **capture**: the verdict every recipe the workspace yielded returned, at a named
  commit, plus the identity of the A/B baseline that release ships against. Written by
  `node cli/release-eval.mjs --capture`, which runs them. **A hand-edited capture is NOT caught by the
  byte comparison** — that holds the register to the capture, so `--write` re-renders the edit and the
  pair agrees perfectly. What guards a capture is the rail's reading of its *contents*: an exclusion
  list that is anything but the self-exclusion, a recorded non-zero exit, a version not matching the
  release it is filed under, a record for a version never cut or for one the clause does not govern.
  This sentence used to claim the opposite, and a sentence claiming a guard that does not exist is what
  makes the gap it describes look unreachable.
- `<version>.md` — the **register**, rendered from the capture. Generated; do not edit. `--write`
  re-renders it and the `release-eval` recipe refuses any difference.

**This directory is empty of records, and that is the honest state rather than an oversight.** The clause
binds *from milestone 8* — [`../../docs/plan.md`](../../docs/plan.md), Protocol → Versioning — and
`v0.1.0`, `v0.1.1` and `v0.1.2` were all cut before it had an owner. No release has been cut since, so
none carries a record. The rail says exactly that on every run rather than reporting a green that reads
like a graded set; the first record lands with the first cut from `0.1.3` onward.
