# Task 0035 — librarian context headroom and demotion drafts

**Lane:** full · **Opened:** 2026-11-09 · **Status:** approved for PR

**Goal.** Resolve [#508](https://github.com/sleepy-panda-srl/portulan/issues/508):
report the measured Claude Code project always tier against its declared budget,
with conditional file-specific demotion drafts the human applies.

**Acceptance criteria.**

- When a workspace is near or over its declared budget, a pass shall report
  measured bytes, estimated tokens and signed remaining headroom.
- When data is absent, unmeasurable or malformed, the pass shall distinguish
  those states, retain measurement exclusions, and never invent zero headroom.
- When a declared budget has eligible workspace-owned always units, the report
  shall draft conditional later-tier moves in deterministic bounded order.
- When the command writes its report, sources, compiled rules and configuration
  shall remain unchanged; only already-permitted index writes shall occur.

**Plan.** Reuse context measurement and guidance validation. Draft only actual
loaded, byte-matching pure always units, excluding the boot card, imports,
expansion directives, stale targets and links. Use the existing report-only
demotion contract and standing-report delivery, with no new write surface or
arbitrary near-budget threshold. The human judges whether guidance can wait,
supplies its description, recompiles and records before/after measurements.
Add red-first tests, update stale documentation, run every yielded recipe,
obtain independent review, seam-scan and finish one labeled PR.

**Session-open.** Independent `/root/checkpoint_508_open` returned
APPROVE-WITH-ADJUSTMENTS: correct the report's figure-origin claim; label the
Claude Code project domain and preserve exclusions. Included. Report-only drafts
and candidates for every declared budget were approved. Row 12 stays open.

**Focused evidence.** The initial headroom and report regressions failed before
implementation. The librarian suite now passes, including a real repeated
write/report command, near/over/undeclared/unmeasured states, source and target
links, stale/unloaded targets, reserved boot and later tiers, expansions,
deterministic bounded ordering and reported measurement exclusions. A separately
imported source is also excluded: a tier-only change would leave that copy always
loaded. Its regression failed before this safeguard. Headroom describes the
arrival snapshot, before permitted index regeneration. Independent full-recipe
review follows.

**Review repair.** Independent `/root/checkpoint_508_precommit` ran all 31 recipes
green with 3,475 tests, but found that byte equality did not prove compiler
ownership. The shared read-only `guidanceEdits` plan now withholds candidates
whose marker or target needs repair; absent or malformed ownership is a typed failure.
Absent/omitted-marker regressions failed before this safeguard. A single stale
candidate tests matching independently of the top-three limit, and a human-
application fixture proves an owned candidate's old rule is removed, its body
retained and its always-tier cost reduced. Whole-diff re-review follows.

A second independent run passed all 31 recipes and 3,478 tests, then found an
alias boundary: a compiler ownership plan could cover a root other than the one
measured. A new regression failed before requiring the plan's canonical root to
equal the measured tree. A mismatch now refuses with a typed error; the shared
resolver is unchanged. Whole-diff re-review follows.

**Pre-commit.** Independent `/root/checkpoint_508_precommit` returned
APPROVE-WITH-ADJUSTMENTS over `79f64fd428eb5399c6ff92f9527416c2aace119b`.
All 31 recipes and 3,479 tests passed independently; ownership, root, marker,
stale-target, headroom, bounds and imported-source mutations were killed. Strict
plugin and private seam checks passed. The bounded adjustment checks the shared
resolver's source directory as well as the plan root: a colocated layout cannot
certify another workspace's empty plan. Its regression failed before the fix.
An independent source/test/record fold review is owed before commit. Final finish
reruns every recipe. Exact host tokens, semantic suitability and milestone
closure remain undemonstrated.

**Fold approval.** Independent `/root/checkpoint_508_precommit` approved
`ff561fff5d21c0b6a6847a0318aeddac4be402c7`: 115 librarian tests, the real report
command, docs, comments, compile, context, package identity, diff and private seam
checks passed. Both missing and existing alternate source directories were
refused, and removing the source guard made those regressions fail. Final finish
and CI follow this approval; no source changes remain.
