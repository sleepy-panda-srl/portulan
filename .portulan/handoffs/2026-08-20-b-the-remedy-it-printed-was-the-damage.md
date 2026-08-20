# Handoff — the remedy it printed was the damage

**State.** One branch, `skills-set-refuses-a-shadowed-pack`, closing
[#317](https://github.com/sleepy-panda-srl/portulan/issues/317), on
[#320](https://github.com/sleepy-panda-srl/portulan/pull/320). Fifteen recipes green, suite
**1780/1780** against `main`'s 1774. Not merged.
[#318](https://github.com/sleepy-panda-srl/portulan/issues/318) is untouched and still the family's
remainder.

**It was opened stacked and did not stay that way.** The predicate it reuses — `shadowedCopy`,
`packDifferences` — existed only on `compile-refuses-a-shadowed-pack`
([#319](https://github.com/sleepy-panda-srl/portulan/pull/319)), so the branch was cut from that
base. **#319 merged mid-session and its branch was deleted**, and this survived only because GitHub
had already retargeted it to `main` — the arrangement that killed #10 once. What was left was a
`DIRTY` state from the rebase-merge, cleared by rebasing onto `main`: git skipped all four base
commits by patch-id and replayed this one with no conflict.

**Decisions + why.**

- **Refuse identically, rather than report and decline to `--write`.** #317 left that open as a
  judgement about a tool that writes a different artifact. Refusing only the mutation would leave
  `--check` exiting **1** on a repository that had not drifted — the same false machine-read verdict
  that ruled the question for `compile`, and the reason both now refuse at resolution, where the
  printer, `--check` and `--write` inherit one rule instead of three.
- **The predicate is imported, never re-spelled.** A third copy of a comparison already corrected
  twice in `doctor` would be [`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)'s
  defect committed inside a fix for its own family. What is NOT shared is the consequence clause:
  `compile` speaks about emitted policy, this tool about whether a `skills` path is derived at all.
- **The damage was demonstrated, not predicted.** #317 deliberately did not run `--write`, on the
  correct ground that running it would be the defect. Run against an **isolated copy** of the tree it
  is safe and it is the whole case: pre-fix, unpinned `--write` exited **0**, printed
  `wrote 2 skills path(s)`, and removed `./packs/rituals/checkpoints/skills/`. Post-fix the same
  command exits **2** with the manifest byte-identical (`af0c3fd…` before and after).
- **An agreeing shadow refuses here for a SHARPER reason than in `compile`.** There, agreement in the
  manifests is still disagreement in the artifact, because the origin is recorded. Here the two copies
  sit on opposite sides of the plugin root, so which one answers decides whether the pack contributes a
  path **at all** — version parity cannot save it, and the message says which case it is.
- **Containment is computed, not asserted.** The sharp split is not a law: a `--plugin-root` elsewhere
  puts both copies outside, and the refusal still stands because the derived path is relative to
  whichever root answered. Claiming the sharp case unconditionally would be this message's first lie,
  in the sentence written to be exact.
- **The base's own round-two finding was a sibling here, and was taken in the same stroke.** While
  this branch sat on it, `compile` corrected a refusal that printed `dir` — `<root>/<category>/<pack>`
  — while calling it a root. This message had the identical defect, and so did its test: the check was
  `said.includes(cache)`, and because `dir` CONTAINS the root as a prefix, printing either passes it.
  An assertion that cannot fail on the regression it guards is not a test. Both arms now print the
  **roots** and each assertion pairs *root present* with *pack directory absent*, forced red
  independently. The roots are also the more useful half: `packs` is what a reader types back into
  `--pack-root`.
- **The cases went into `cli/skills-set.test.mjs` rather than a new file.** That suite already carries
  the hermetic-host guard and the scratch sweeper a new file would have had to re-establish — and the
  sibling change was caught by Copilot for leaking scratch directories out of a fresh one.

**Measured, not assumed.**

- The four invocations, on this host, where `rituals/checkpoints` is installed at `0.2.0` and the tree
  carries `0.2.1`: unpinned `--check` **1 → 2**; `--pack-root packs --check` **0 → 0**, so
  `verify/plugin.sh` is untouched; `--pack-root auto --check` **1 → 1**, discovery elected; unpinned
  `--write` **0-and-destructive → 2-and-inert**.
- **Every branch was forced red.** Guard disabled reds three cases; over-applied reds one. Each message
  branch was inverted and reds exactly the case that claims it.
- **The `named` half of the guard binds nothing, and that is recorded rather than papered over.**
  Forcing the condition to `true` leaves the named-root case passing — a named root replaces the
  derived one, so no discovered root remains to shadow. The protection is structural. `compile` found
  the same for its own guard; this was re-measured here rather than inherited.
- **An instrument lied once, in my favour, and the check caught it.** The first pass ran the three
  `--check` invocations from a `for inv in "" "--pack-root packs" ...` loop and read all three as
  refusing — which would have meant the guard was over-applying badly. **zsh does not word-split an
  unquoted parameter expansion**, so every run was in fact unpinned and the flags never arrived. The
  table only became true when each invocation was written out in full. Add it to the standing list.

**Open / next.** [#318](https://github.com/sleepy-panda-srl/portulan/issues/318) — `index` and
`recipe-set` — is the family's remainder and is deliberately not folded here: both write different
artifacts and neither goes through this file.

**The base moved four times while this branch sat on it** — twice by force-push, then a merge and a
branch deletion — and every measurement had to be retaken against a tree that no longer existed when
it was taken. Two of those moves carried findings that were siblings HERE, and neither would have been
found by reading this diff: the pack-directory-called-a-root defect in the message and its
non-binding assertion. **Read the base's new commits for siblings before rebasing onto them**, rather
than treating a clean rebase as the whole of the integration.
