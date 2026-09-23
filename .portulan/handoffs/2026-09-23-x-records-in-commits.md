# Handoff — a change's record is its commit

**State.** Piece 1 of the records rethink, on `claude/records-rethink-o33tes`, reviewed by the
coordinator session before its first push. The Session log's last state is
`git show c18b314:docs/plan.md`, and the pull request names that commit. The context rails do not move:
`cli/context.mjs` counts neither the log nor the handoff index, and the boot files this edits (identity,
definition of done, gate map, memory index, repository card) take the own boot read-set from 89,236 to
89,057 bytes against a rail of 90,726. Pre-commit checkpoint: skipped by his instruction of 2026-09-23
12:38 (no fresh-context runs unless he asks); the coordinator session reviewed the diff before the
commit; his review is on the PR.

**Open questions.** Three edits are the maintainer's to accept on the pull request: condition 6 of
`.portulan/dod.md`, the Protocol's seam line in `docs/plan.md`, and line 46 of `CODEOWNERS`, which still
calls the session log a record and is left as it is because the file is his. The rest of the rethink is
later pull requests in the order the coordinator session holds: history and READMEs, the boot card with
on-path rules, the memory cap and the librarian (whose `--log` writer in `cli/librarian.mjs` retires
there; its workflow already stopped passing it), what adopters get from compile, vendor and init, and
session usage.

**Next action.** A pull request open across this merge moves its CHANGELOG bullet into a file under
`changes/`, drops its Session log entry, and ends its commit message with a `Seam-scan: clean …` line.

**Recoverability.** Nothing outside this branch changed. Reverting the merge restores the log, the
committed handoff index and the Unreleased bullets.
