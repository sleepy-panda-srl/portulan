# Handoff — the customer-facing surface was written at build-log altitude

**State.** Two pull requests, stacked. [#313](https://github.com/sleepy-panda-srl/portulan/pull/313)
(`cli-roster-rail`) corrects and rails `cli/README.md`'s roster, closing
[#204](https://github.com/sleepy-panda-srl/portulan/issues/204). [#314](https://github.com/sleepy-panda-srl/portulan/pull/314) (`docs-at-reader-altitude`) sweeps
fourteen customer-facing files. Both green on fifteen recipes and
the full suite. **#313 is merged**; #314 retargeted to `main` on that merge, as the stacking
contract predicts, and is rebased onto it.

**Decisions + why.**

- **The defect is altitude, not accuracy.** The maintainer's question — *"why would anyone reading and
  getting introduced to Portulan care about #242 or d6498f0 or any dates"* — generalises: reader-facing
  documents carried the construction record. 179 offending lines across fourteen files, now 99, and the
  survivors are the forms the constitution requires: forward limits, rule-provenance links, owner+date
  rulings, platform-version pins on measurements, and `spec/slots.md`'s derivation column, which is the
  job that file exists to do.
- **The removals relocate nothing** — because the record layer already carried every one. That was
  checked per passage rather than assumed, and the supervisor re-checked the hardest case
  (`packs/README.md`'s `Skills (0)` measurement) independently.
- **The numerals came out of the roster rather than being corrected** — because a sixth correction
  would have been the sixth. `cli/README.md` already ruled that way three times about its own other
  figures. Alternative considered and rejected: correcting "eight" to "nine".
- **The roster rail is a live test, not a `docs.sh` check** — because `identity.md` documents that
  recipe as needing only `git`, `bash` and POSIX utilities, and treats every movement of that line as
  an argued event. Reaching `SUBCOMMANDS` from bash meant adding `node` to it as a side effect of a
  roster fix, or writing a second parser for a JavaScript array. This was my own stated doubt at
  session-open and the supervisor confirmed it; the first design was wrong.
- **The rail anchors on HTML-comment markers, not on prose** — because the very next pull request in
  this session was licensed to rewrite every sentence between them. It did, and the rail stayed green,
  which is the property the markers were for.
- **In `core/operating/`, the rule and its `#98` link stayed; this build's milestone map went** —
  vision thesis 4 requires a rule to carry provenance as a link or a sealed stamp, and thesis 6 says
  core never absorbs the team's specifics. An adopter reading the engine has no milestone 4.
- **Three live falsehoods were found by the accuracy pass, not by the altitude pass** — `cli/README.md`
  said publishing had not happened, `README.md` said 74 packed files where `npm pack --dry-run` says
  76, and `docs/pricing.md` cited eleven recipes and 1608 tests. The README count was **dropped rather
  than bumped**, on `identity.md`'s own repair of that same claim: a figure nobody writes cannot go
  stale. **A fourth was mine** — a first draft of the new README stated registry-vs-pack hash identity
  as a standing property, which it is not; only the tree-side half is railed.

- **One removal had no carrier, and the record layer gains it here rather than losing it.** The
  CHANGELOG's Unreleased entry recorded its own overclaim: a GitHub Packages sidebar measurement taken
  **logged out entirely** was described as absent to *"strangers"*, which takes in signed-in
  non-members — **one population measured, three described**. The corrected claim and the untested cell
  survive in the entry; the record that the overclaim happened, and its shape, existed nowhere else, so
  it is written down here. The class is worth keeping: a population is part of a measurement, and a
  measurement described wider than its population is wrong even when its number is right.
- **The artifact moved under its own supervisor, and that is a process breach worth recording.** The
  pre-commit pass was reading a staged, never-committed diff when this session reset the tree to
  separate two pull requests that had become entangled — a branch checkout had carried one PR's staged
  work onto the other's branch, and committing there would have folded fourteen files of documentation
  rewrite into a pull request titled as a roster fix. The separation was right and the work was
  recovered whole; doing it **while a fresh context was grading the thing being moved** was not. Stage
  or commit before a checkpoint reads, and never restructure the artifact under review.

**Open questions.** Whether `packs/rituals/checkpoints` should be pinned in this repository is the
maintainer's: `doctor` reports the installed copy at 0.2.0 shadowing the tree's 0.2.1, with gate
fragments that differ once parsed. Not touched here — it predates this session and is not a docs defect.

**Next action.** Answer Copilot on both pull requests, then hand to the maintainer. **#313 must not
have its branch deleted until the stacked child has retargeted** — GitHub closes a stacked pull request
whose base branch is deleted, and such a pull request cannot be reopened.

**Recoverability.** Nothing partial. Both branches are pushed and independently green; the sweep can be
merged, reverted or dropped without touching the rail, and the rail stands alone if the sweep is
rejected.
