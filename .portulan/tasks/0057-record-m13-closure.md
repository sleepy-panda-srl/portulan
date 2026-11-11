# Record and close M13

**Lane:** full · **Opened:** 2026-11-11 · **Status:** ready for review

**Goal.** Record the completed independent Astra CLOSE for M13, merge its reviewed documentation,
close [milestone 11](https://github.com/sleepy-panda-srl/portulan/milestone/11) and stop. The maintainer
explicitly requested closing it and already approved all M13 merges and closure work.

**Acceptance criteria.**

- When the signed publication note is recorded, it shall match the reviewer artifact byte for byte
  and preserve its verifier, date, verdict, revision/tree, demonstrations and limits.
- When row 13 is marked done, only its Status shall change, within 500 UTF-8 bytes including outer
  spaces, carrying who/when/CLOSE, re-derived facts, undemonstrated scope and the evidence link.
- When current history is updated, it shall link the note, preserve the existing dated body bytes
  and archive the previous Status wording with relative links rebased to their original targets.
- When closure is recorded, conditional spend telemetry and the unmeasured scope shall remain
  explicit; the record shall claim no new runtime, native acquisition, provider run or release.
- When the recording diff is complete, a fresh pre-commit context shall run all yielded recipes and
  both strict plugin validations, check parity/status-only/history/seams, and grade any final fold.
- When the PR is published, independent pushed-head parity/diff/feedback review, required CI,
  resolved threads and current live-main freshness shall precede the authorized merge.
- When that record is merged and the milestone has zero open items, GitHub closure shall follow,
  be read back and end the work without another feature, release or milestone change.

**Opening.** Independent `m13_close_open` returned APPROVE-WITH-ADJUSTMENTS. All three are incorporated:
retain the removed Status scheduling/drafting prose as dated history, explicitly run both strict
validators at pre-commit, and keep conditional spend telemetry plus the full evidence limits visible
without changing the publication note. Existing Astra CLOSE on `4171226c` supplies the demonstration;
this recording change does not self-certify or expand that verdict.

**Verify.** Compare signed bytes/SHA-256; compare all plan bytes except row 13's Status; count the entire
Status; compare dated historical body and previous Status wording/target identity. Run the 32 yielded
recipes sequentially and both manual strict validations in independent pre-commit, normal hooks and
finisher afterward, plus publication seam scan and manual review. No bespoke product tests are added.
The reasoned `--no-fragment` records already merged work with no product/release behavior change.

**Constraints.** Four documentation files only; no runtime, schema, default, cap, gate, recipe,
criterion, frozen evidence or other milestone changes. GitHub writes use Codex Panda; Git commits
retain the maintainer identity. GitHub closure follows the merged record and no work follows it.
