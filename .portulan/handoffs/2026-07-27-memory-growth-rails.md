# Handoff — memory growth rails (maintainer directive)

**State.** Done, in one pull request: `doctor` gained the `retirement` report (record count and store
size on every run; a note naming any record with no `Retire when:` line — notes, never failures), suite
240 → 244 with the live stores bound byte-for-byte, the consolidate-on-breach sentence in
`core/operating/memory.md`, half a sentence in the memory-entry template, both doctor-coverage docs
updated, and the milestone-5 row sharpened so its budgets are rails: red on breach, and the red→green
demo is consolidation, not a budget edit.

**Decisions + why.**

- The incident behind the directive was harness-side — the operator's session memory duplicating
  history this repo already records — and was fixed there the same day with hard budgets whose own
  retire-when names milestone 5. Product-side nothing was oversized: 17 + 4 records, every one stating
  a retirement condition. So the honest deliverable is forward rails, not cleanup, and it is small.
- `doctor` reports and never fails on retirement — because nothing legislates the field, and doctor
  enforcing it would be tooling legislating; the rejected alternative was a `fail`, which would also
  have bound every workspace the product ever validates. Customer zero still binds itself through the
  suite (a live record without the field turns `tests` red) — a workspace extending the floor, which
  `dod.md` permits.
- No age report in doctor, on purpose: doctor reads the tree and never git, and in a fresh clone every
  mtime is checkout time — measured in this session's own worktree, where all 17 records "dated" to the
  minute of checkout. An age line would be fabricated precision; staleness is the librarian's
  (milestone 5), which may legitimately ask git.
- No new memory entry: the lesson — a budget that lives only in prose is the first thing a busy session
  negotiates with — is already recorded in `verify/README.md`, and the family is covered by
  `a-mandate-nothing-checks-is-already-broken`. Minting another would be growing the store to say the
  store must not grow.
- No repo-card quirk about the harness memory: a claim about a fact outside the tree is the class that
  went stale twice here (the gate map's agent-identity line; the README's floor line). The seam
  statement lives in dated records instead — this file and the Session log. The seam itself: harness
  memory is operator-local and is NOT the product's memory; its budget rule retires by its own terms
  when milestone 5's machinery lands.
- The M5 sharpening is an expansion, not a narrowing — every deliverable already named stays; the
  budgets gain machinery (a verify recipe red on breach; consolidate-on-breach demonstrated). Doctrine
  and row are coupled deliberately: the doctrine sentence names milestone 5, the row names the
  machinery (`a-doctrine-promise-belongs-in-the-row-it-names`).

**Open questions.** None held open here; accepting the sharpened row is the maintainer's, at merge.

**Next action.** At milestone 5: the generated index with its budget as a verify recipe (red on
breach), the consolidation skill, and the librarian's staleness pass. The `retirement` report is the
measured store that index budgets against, and the demo is already written into the row.

**Recoverability.** Everything is on one branch (`memory-growth-rails`); nothing outside the tree was
changed, and the worktree can be deleted once the branch is pushed.
