# Handoff — the cut the prose rail finally graded, and a green that answered a different question

**Session:** 2026-08-20, fourth of the day. Commission, verbatim: *"Bootstrap Portulan and proceed with
releasing a new version"*, then mid-session: *"All relevant documentation needs to be updated per the
release of v0.1.2."* **No milestone row moves.**
[#324](https://github.com/sleepy-panda-srl/portulan/pull/324).

## State

#324 is open, `workspace-verify` green, Copilot round 1 **empty in both channels** and zero review
threads. `v0.1.2` is not tagged; the GitHub release and both publishes are ahead, and every one of them
is Gated. `main` was `d1ce958` at the cut.

## Decisions + why

- **The number was his, and it is `0.1.2`.** He named it mid-session, which is the precedent this
  repository already keeps for version values (#148, 2026-08-07). The tension was flagged rather than
  decided: the entries say *"this changes commands that used to succeed"* and `SECURITY.md` says *"a
  `0.x` minor bump may carry a breaking change"*, which reads toward `0.2.0`. The patch case is real —
  the refusal fires only where a declared pack is both installed and in the tree, the prior behaviour
  was itself the defect, and *"elsewhere nothing moves."*
- **`SECURITY.md` needed no ruling**, closing the open question #299's handoff left. Whether `0.1.1`
  stays supported is decided by the table's own policy sentence — only the latest published version
  receives fixes — so `0.1.1` falls under "Anything earlier" mechanically. A question can be closed by
  reading the file it is about.
- **`identity.md`'s roster restated 74 → 76, not overwritten**, per that file's convention, naming
  `cli/inside.mjs` and `cli/version-carriers.mjs` as what joined after `0.1.1`.

## The finding worth carrying

**`version-carriers` reads the git INDEX, and run unstaged it printed a green that answered a different
question.** After all seven carriers were edited in the worktree, it reported *"3 current-version
claim(s) … all read `0.1.1`"* — internally consistent, correct, and about a tree that no longer
existed. The rail is right to read the index: comparing prose from the worktree against a manifest from
the index compares two trees, which is how its own index change first shipped. But the operator-facing
consequence is not written anywhere the operator looks — **an unstaged cut is invisible to the rail
built to grade cuts**, and the green is byte-identical in shape to the one that matters. Candidate,
cheap, not built here: print the tree being graded, or refuse when tracked carriers differ between
index and worktree.

**And this is the third consecutive release whose only defect class would have been version-currency
prose** — except that this time the rail existed and it was the sweep, rather than a reader, that
carried it. That is what #299's handoff asked for and did not build.

## Instruments

- **`grep -c "^- \*\*"` over an `awk` range counted 39 entries where there are seven.** The range ended
  at `## v0.1.1`, a heading this file does not contain (it is `## 0.1.1`), so the range ran to EOF and
  swept two released sections. Re-measured against the real heading. The class is this repository's
  standing one: the instrument reported a number, not a failure.
- **The pack roster was measured in a `git clone` fixture, never `cp -R`** — inside a worktree `.git`
  is a pointer file, so a copy drives the real gitdir. 74 at `v0.1.1`, 76 at this cut, diffed by roster
  rather than by count so the two joiners are named rather than inferred.
- **The seam scan's own candidate extractor over-collected** — it flagged `INDEX`, `Session` and `Stop`
  from the private context. All three are this repository's vocabulary, present in 10, 111 and 66
  tracked files on `origin/main`; the verdict is clean and the extractor is loose, which is the correct
  direction for that instrument to fail in.

## Open questions

- **The fresh-context checkpoints did not run.** Subagent dispatch was disabled in this session, so
  session-open and pre-commit have no verdict on this cut — stated in the pull request body rather than
  passed over. Under the two-tier protocol this is full-lane work and both were owed. What partly
  covers it is that the class those passes caught at `0.1.0` and `0.1.1` is now railed.
- **A tree-provenance line for `version-carriers`**, per the finding above. Worth an issue.

## Next action

He merges #324. Then, each Gated and each his: tag `v0.1.2`, cut the GitHub release — which fires the
GitHub Packages workflow — and `npm publish` to npmjs, which needs an OTP no agent can supply.

## Recoverability

Nothing partial and nothing outward. `v0.1.0` and `v0.1.1` and both registry entries are untouched.
#324 is a branch; the cut is reversible by reverting one commit until a tag exists, and after that the
`0.1.2` heading is a record rather than a claim about a published thing.
