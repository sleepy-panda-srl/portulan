# Task 0038 — on-path guidance observed in a real host

**Lane:** full · **Opened:** 2026-11-09 · **Status:** ready for independent review

**Goal.** Demonstrate [#510](https://github.com/sleepy-panda-srl/portulan/issues/510)
with an actual Claude Code run over the existing invented guidance fixture.

**Acceptance criteria.**

- When the intended API path has not been touched, the completed capture shall show the
  nonmatching Read and no startup/include load of the scoped target.
- When the API file is first read, the host shall report the target's path-glob
  load with the correct trigger and demonstrate receipt of its observation label.
- When evidence is checked offline, missing controls, alternate label routes,
  altered inputs and wrong load/session/trigger data shall refuse the capture.
- When verification runs, no recipe shall launch the live host capture mode.

**Plan.** Copy the existing fictional guidance workspace into canonical scratch,
add a random observation label only to the copied scoped source, and compile it.
Observe real instruction-load and Read hooks without injecting context. Use two
prompts in one host session: a nonmatching Read, then the API Read. Collect through
successful host exit and recorder completion, verify causal fields rather than
callback append order, and retain private raw-stream digests. Commit a normalized
capture with invented inputs, not a manufactured transcript. Keep authentication
ordinary and settings/exclusions scratch-local. Only the two probe files may be
read; unexpected reads fail the capture. Verify source/target digests, session,
controls and label routes offline. Run all recipes and fresh review before one PR
and its authorized merge. Row 12 remains open.

**Session-open.** Independent `/root/checkpoint_510_open` returned
APPROVE-WITH-ADJUSTMENTS. Its five adjustments bind this implementation: completed
capture and causal event checks; alternate-route rejection and redacted outside
activity; separate instruction exclusions from settings-source selection; actual
model/version/argv/session/digest provenance; and mutation checks that distinguish
harmful phase changes from harmless asynchronous callback ordering. The existing
subscription and scratch-local observers need no additional permission. No host
observation is certified by this opening verdict.

**Observed evidence.** The final live run exited 0 with ten completed recorder
invocations, no unexpected outside activity, exactly the intended two Reads and
the two expected replies. The capture stores its actual model/version/session.
The host reported glob `api` for the compiled `api/**` target; a prototype first
exposed that metadata difference and was not accepted as the final artifact.
Six offline tests exercise the frozen capture, contradiction mutations, observer
redaction/Read guarding and no-host default startup. The coherence test for a
rehashed contradictory header failed before its semantic check. Every yielded
recipe and the independent pre-commit checkpoint follow. Raw final evidence is
retained outside the repository in the capture directory for review.

**Pre-commit.** Independent `/root/checkpoint_510_precommit` returned
APPROVE-WITH-ADJUSTMENTS over `a3d7193a2031f5f041629a924b60b156d1e7b05c`.
The reviewer matched all seven provenance digests and normalized fields to the
private raw evidence, independently reproduced the compiled target, and found the
real-host demonstration sound. Of 31 recipes, 29 were green; task criterion 1's
non-EARS opening caused the skill-goldens rail and its three full-suite failures
(3,540 of 3,543 tests passed). The equivalent When-shaped criterion now passes.
The bounded verifier fold rejects unexpected instruction routes, inconsistent
host controls/argv and unbound or duplicate recorder IDs. New contradiction
regressions failed before those checks. Focused evidence and the skill-goldens
recipe pass; the fold awaits independent delta review. No recapture is needed.
Full host-context isolation, other hosts/versions, independent live repetition,
token calibration and milestone closure remain undemonstrated. Final finish and
CI follow the fold's approval.
