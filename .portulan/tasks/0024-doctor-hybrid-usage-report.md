# Task 0024 — doctor reports hybrid branch usage

**Lane:** full · **Opened:** 2026-11-03 · **Status:** implemented; verification before push

The maintainer requested [M14 closure](https://github.com/sleepy-panda-srl/portulan/milestone/16).
The independent closure sweep found the doctor consumer promised by
[#543](https://github.com/sleepy-panda-srl/portulan/issues/543) and proposal
[0038](../proposals/0038-what-a-change-spends-is-measured.md) still missing. This change supplies that
consumer; it does not assert that the A/B capture or milestone closure is complete.

**Acceptance criteria.**

- When doctor validates a workspace declaring a Git tree, it shall report the current branch's owned
  host token classes and separate local receipt totals through the existing ledger, even when called
  from another working directory or for a linked worktree.
- When optional records are absent, unreadable or malformed, doctor shall preserve validation's exit
  status and report unmeasured or partial data without quoting private record snippets, inventing
  dollar totals or turning unknown receipt figures into zero.
- When doctor is called with --static, help is requested, or the quiet library interface is used, it
  shall not discover or read host usage records. Repository verification and A/B construction shall
  explicitly choose that static interface, and the recipe audit shall reject a default doctor call
  independently of another safe call on the same line.

## Plan and checkpoints

Reuse ledger ownership, parsing and rendering rather than adding a second accounting fold. Derive
ownership from the declared tree and its current Git branch. Add a static CLI mode and wire every
non-interactive validator caller; distinguish local record access from actual network modes in the
offline audit. Cover real Git branches and linked worktrees, injected usage fixtures, inaccessible
records, private error sentinels, help and quiet interfaces, and adversarial mixed invocations.

Fresh session-open, Codex, 2026-11-03: **APPROVE-WITH-ADJUSTMENTS**. Folded declared-tree ownership,
per-invocation static auditing including A/B construction, and non-fatal privacy-preserving handling
of optional data. New test groups failed against the previous implementation and pass with this
change. Full yielded verification and the independent pre-commit verdict are recorded in the commit.

This is a descriptive token/receipt report. Price fetching, dollar estimates and the broader M13
recommendation analysis remain outside this change. No model is called to produce the report.
