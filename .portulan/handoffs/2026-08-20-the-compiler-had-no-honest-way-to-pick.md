# Handoff — the compiler had no honest way to pick, so it stopped picking

**State.** One branch, `compile-refuses-a-shadowed-pack`, closing
[#316](https://github.com/sleepy-panda-srl/portulan/issues/316). Fifteen recipes green, suite
**1774/1774**. [#317](https://github.com/sleepy-panda-srl/portulan/issues/317) and
[#318](https://github.com/sleepy-panda-srl/portulan/issues/318) filed for the siblings this work found
and did not fix — `skills-set`, and `index`/`recipe-set`, which resolve packs on the same unasked path
where this refusal structurally cannot reach them. Not merged.

**Decisions + why.**

- **`compile` refuses a shadowed pack rather than picking one** — because it does not report, it
  **emits**. `doctor` reports and never grades on install state, deliberately: a fact about a machine
  must not become a verdict about the repository. That reasoning does not transfer to a tool whose
  output is an artifact. Picking silently wrote the discovered copy's fragments while
  `verify/compile.sh` read the tree's, which on this host meant a `git commit --no-verify` matcher
  that `0.2.1` had deliberately removed as false coverage — a rule that reads as protection and
  provides none, which is worse than the honest gap `0.2.1` chose.
- **Refused at resolution, so `--check` and the write path inherit one rule** — the supervisor's
  ruling, against my proposal to refuse on write only. Its ground is better than mine was: under a
  write-only refusal, `--check` would go on adopting the discovered world and exit **1**, asserting
  the *repository* had drifted when it had not. An exit code is the machine-read API, and a false 1 is
  a false verdict about the tree. I had weighed the user cost and missed that the two paths would
  answer one ambiguity two ways.
- **Every unasked shadow refuses, including one whose manifests agree** — also the supervisor's, and
  my plan had the opposite carve-out. `recordedOrigin` tags the answering root into
  `$portulan.packs[].origin`, so a discovered answer emits `discovered` where the rail's artifact says
  `tree`. **Agreement in the manifests is not agreement in the artifact**, and the carve-out would
  have shipped a compile that still reds the recipe it exists to reconcile with.
- **The refusal names both roots by path and both proceed spellings**, `--pack-root packs` and
  `--pack-root auto`. Offering only the tree spelling would make the refusal decide the question it
  claims to hand back. The **paths** half was a correction: the first cut named only the tree copy and
  described the other as *"a discovered root outside this repository"* — handing back a choice while
  withholding the half the reader cannot see from inside the repository, in a message whose own claim
  was to name both. Printing an absolute path is safe here in a way it is not in `$portulan.packs`:
  this is stderr read once by a human, never a tracked artifact, so the origins-never-paths rule that
  keeps a machine-dependent path out of a committed file does not reach it.
- **The comparison moved to one carrier rather than being copied.** It had already been wrong twice in
  `doctor` — a projection over `[id, tier, action]` that read a `reason` difference as agreeing, and a
  *byte-identical* claim `JSON.stringify` of a parsed value cannot make. A third copy of a function
  corrected twice is proposal `0020`'s defect committed inside a fix for its own family.

**Measured, not assumed.**

- The named-root protection is **structural**, not merely guarded: forcing the condition to `true`
  leaves the named case passing, because a named root replaces the derived one and the plan then holds
  no discovered root at all. Recorded at the site; the clause stays as intent.
- Two existing rails caught this work, and both were right. `pinned-roots.live.test.mjs` flagged the
  new suite for not neutralising `CLAUDE_CONFIG_DIR` — correct, because the guard is about what the
  *tool* can reach, not what these cases ask of it, and a later edit dropping a thunk would start
  reading the machine. `doctor.test.mjs` pinned the old remedy wording; that expectation moved
  **deliberately**, with the split named in the test, because a test edited beside the code it guards
  is the shape that hides a regression.

**Open questions.** [#318](https://github.com/sleepy-panda-srl/portulan/issues/318) is code-measured
rather than fixture-demonstrated, and says so: on this host the two copies agree on personas and
contribute no recipes, so the exposure is real in the code and unbitten today.
[#317](https://github.com/sleepy-panda-srl/portulan/issues/317) — whether
`skills-set` should refuse identically or report and decline to `--write`. It writes a different
artifact, and its printed remedy (`--write`) *is* the damaging act, so it is his call rather than a
clause folded into this change.

**Next action.** Pre-commit checkpoint, then open the pull request. The installed pack on this machine
is still `0.2.0` against the tree's `0.2.1`; refreshing it is a host action and moving the feed's pin
is Gated, so neither is done here.

**Recoverability.** Nothing partial. The refusal is additive — a workspace with no shadow, or one
naming a root, reaches exactly the code it reached before.
