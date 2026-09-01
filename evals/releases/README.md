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

**Which releases have records is not written here.** `ls` this directory, or run
`node cli/release-eval.mjs --verify`, which prints the governed set and is the carrier — a sentence
counting the files beside it would be a hand-maintained figure of a subject that grows once per release,
which is the defect this repository deletes on sight.

**What is fixed, and is the only thing this file states about coverage:** the clause binds *from
milestone 8* — [`../../docs/plan.md`](../../docs/plan.md), Protocol → Versioning — so `v0.1.0`, `v0.1.1`
and `v0.1.2` carry none and are never asked to. That is history and cannot change.

_(This paragraph read **"This directory is empty of records"** as a standing claim. It would have gone
false in the very commit that wrote the first record — and, since this directory ships inside the npm
payload, it would then have been **frozen false beside the record it denied**, in a tarball only another
release could correct. Caught by a second opinion before the first cut rather than by a reader of it.)_
