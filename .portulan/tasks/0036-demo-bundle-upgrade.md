# Task 0036 — demo boot read-set on bundle upgrade

**Lane:** full · **Opened:** 2026-11-09 · **Status:** ready for independent review

**Goal.** Demonstrate [#511](https://github.com/sleepy-panda-srl/portulan/issues/511)
with pinned release inputs and the unchanged fictional demo workspace.

**Acceptance criteria.**

- When the pinned v0.1.3 boot inputs are replaced by v0.2.0 at the same bundle
  location, the demonstration shall measure both byte rosters and show a reduction.
- When the bundle is replaced, every demo workspace file shall remain byte-identical,
  with the same explicit Combcount card and declared memory-index convention.
- When the real workspace migration CLI runs separately, the evidence shall record
  its argv, exit and no-op output, attributing no reduction to that command.
- When inputs, replacement or workspace invariants drift, offline checks shall refuse
  the demonstration instead of recording a misleading improvement.

**Human ruling.** On 2026-11-09 Marius chose “Bundle-upgrade evidence” when asked
whether upgrade means updating the installed bundle, with workspace migration shown
separately. This is the criterion interpretation; no host installer is simulated.

**Plan.** Preserve exact historical inputs in JSON with paths, release SHAs, byte
lengths and SHA-256 hashes. Materialize a fictional Combcount project in scratch,
measure the legacy roster, replace its pinned boot inputs and measure the current
carrier's roster. Run the actual migration command with an empty host separately.
Record diagnostic read-set bytes, not host timing or exact tokens. Update milestone
evidence and its demo pointer, add a fragment, run all yielded recipes, independently
review, seam-scan and finish one labeled PR. Row 12 stays open.

**Session-open.** Independent `/root/checkpoint_511_reopen` returned
APPROVE-WITH-ADJUSTMENTS. All three are included: historical bytes use JSON rather
than broken fixture Markdown links; evidence records the human ruling and diagnostic
boundary; migration uses supported argv and an empty `CLAUDE_CONFIG_DIR`, with no
invented pack-root flag. The reviewer independently measured 42,958 B before and
36,250 B after, including the same 17,287 B workspace read-set.

**Evidence.** The new capability test failed before the instrument existed. Four
checks now reproduce 42,958 B → 36,250 B and reject missing replacement, workspace
configuration/content edits, corrupt input, release drift and repo selection drift.
The real migration exits 0 without changing any of the 19 demo files. All-recipe
verification and the independent pre-commit checkpoint follow.

**Pre-commit.** Independent `/root/checkpoint_511_precommit` approved staged tree
`933d2a580a3d245ad87511e1e9bd74864d6f9339`. All 31 yielded recipes and 3,512 tests
passed independently; four focused tests and twelve additional attacks held.
The reviewer verified all 19 demo files and six boot inputs against the pinned
release commits and remeasured both rosters. Strict plugin validation and the
private seam scan passed. Host installation, host loading timing, exact tokens
and milestone closure remain undemonstrated. Final finish and CI follow.

**CI repair.** Linux CI exposed a display-path difference: the child process's
canonical working directory differed from macOS's aliased temporary path. A new
real-versus-aliased-root regression failed before canonicalizing the scratch root.
Both root spellings now reproduce the same migration stdout on macOS. Repaired
Linux CI and Windows execution remain unobserved. Only the recorded display path changes; every measured byte and
digest is unchanged. A whole-diff independent re-review follows before pushing
this repair to the existing PR.

**Repair review.** Independent `/root/checkpoint_511_precommit` returned
APPROVE-WITH-ADJUSTMENTS over `34ecf5cc80dc7131ffd748b9a286872b0187b399`:
all 31 recipes and 3,513 tests passed. The only adjustment bounds the platform
observation above. The reviewer saw the new regression fail old source and pass
repaired source, reverified the pinned inputs and twelve attacks, and checked
the whole PR and repair message against the private seam. Final finish and Linux
CI follow this record-only fold's independent grade.
