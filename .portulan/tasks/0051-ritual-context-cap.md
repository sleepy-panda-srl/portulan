# Compile ritual context admission caps

**Criterion.** [#640](https://github.com/sleepy-panda-srl/portulan/issues/640),
M13 closure gap 4 and proposal 0038's Routing paragraph.

**Acceptance criteria.**

- When ritual packs declare valid positive context counts, compile shall emit
  Claude's native admission setting at their minimum, with source provenance.
- When declarations are invalid or a known cap has unresolved peers, all compile
  modes shall refuse before writes; absent unresolved counts shall remain unknown.
- When no policy exists, cap-only compilation shall own only dedicated settings,
  check drift, remove stale own output and refuse unrelated settings content.
- When host support is reported, it shall distinguish fresh Agent admission from
  lifetime contexts and state overrides, resume/fork and independent-system limits.
- When the native four-control experiment runs, actual admissions and overlapping
  child requests shall discriminate cap1/2 and removed/lowered settings; ledger
  shall count one parent and two children even under cap1.

**Session-open.** Independent `gap4_open` returned APPROVE-WITH-ADJUSTMENTS:
(1) qualify fresh admission, resume/fork and independent-system behavior;
(2) preserve unresolved absence as unknown; (3) add removed/lowered native
negative controls. Folded into implementation and controls. Pack Definition
1.1 and checkpoints content0.3.1 move independently; workspace remains unchanged.
No real provider calls or persona routing/quality changes. Milestone remains open
for the requested independent Astra closure after all four fixes merge.

**Pre-commit refinement.** Independent `gap4_precommit` graded tree
`8150f2380bc1d1bbec0d92b314d91b040d7ed2ff` APPROVE-WITH-ADJUSTMENTS after
all 32 recipes and 4,506 tests passed. The fold preserves uncapped guidance with
unrelated hard-linked settings and explicitly refuses a stale normal-policy cap
when both policy and count are removed. Owned/edited settings remain preserved.
New write/check/matrix controls exercise both transitions and edited-file removal.
