# Task — bound Stop recipe execution and allow a declared deadline

**Status.** Approved for commit; finish and CI precede merge.

**Criterion.** [#552](https://github.com/sleepy-panda-srl/portulan/issues/552),
milestone 11 / plan row 13: a long default recipe can finish under its workspace's
declared limit, and released Stops stop spending another full recipe run.

**Acceptance criteria.**

- When `verify.stopTimeout` is declared at spec 2.14, the trusted workspace shall
  select that integer deadline and compile an outer hook timeout with cleanup margin.
- When a deadline is invalid or declared under an older spec, every reader shall
  refuse it, and compile shall preserve existing artifacts and create none.
- When a recipe has caused three refusals, or an applicable total/chain/handoff
  bound releases a Stop, the gate shall skip execution and report unverified RED.
- When a recipe is skipped for a handoff cap, it shall not gain a recipe failure;
  when that handoff clears before other bounds, recipe execution shall resume.
- When a recipe actually times out, the gate shall name its deadline and retain
  the runner's owned-process cleanup; command and deadline shall stay in the trusted tree.
- When a measured green occurs before the recipe cap, its streak shall clear;
  ordinary Stops shall reset the hook-provoked chain.

**Plan.** Optional deadline and shared validation, compiler outer timeout and drift,
cheap work checks before recipe-cap selection, explicit unverified releases,
runtime and injected controls, schema 2.14 readers and documentation. Refresh the
source fingerprint after inspecting the intended hook change. Run all recipes,
independent pre-commit, strict validation, seam scan, finish and one labeled PR.
Row 13 remains open; no unchanged-tree green cache or cross-session scheduler.

**Session-open.** Independent `/root/checkpoint_552_open` returned
APPROVE-WITH-ADJUSTMENTS: do not charge skipped runs as recipe failures; bind both
command and deadline to the trusted workspace; prove each bound and recovery;
update the glossary and DoD's changed recovery claims. All four are folded in.
The review judged this a bounded parameter of the existing mechanism, covered by
the human-authorized issue and reviewed implementation PR.

**Limits.** A recipe cap retains unverified release for that session even after
files are repaired; explicit verification or a new session is required. The
trusted recipe still runs in the told root, not a payload-selected sibling (#311).
Injected long-deadline selection and a short live timeout do not demonstrate a
five-minute recipe or live-host outer-timeout enforcement. Native Windows cleanup,
counter-file failures and concurrent counter updates retain their existing limits.

**Pre-commit.** Independent `/root/checkpoint_552_precommit` returned APPROVE
on whole-diff regrade tree `3fc9e072`, after the timeout taxonomy, direct backend
validation and isolated recipe-cap fixture corrections. All 32 actual yielded
recipes passed; the full suite passed 3,610/3,610 without skips. Eight mutations
forced red, including a delayed recipe cap caught by the explicit 4-versus-3 run
count. Eleven independent Stops exercised the bounds and recovery; 78 invalid
CLI cases preserved three artifact sentinels and 21 invalid backend cases refused.
The existing timeout test reached its descendant-cleanup assertion and passed.
Strict validation and the full 21-file seam scan passed with seven refusal
controls. The limits above remain; this does not close row 13. Final record-fold
review, finish and refreshed CI precede merge.
