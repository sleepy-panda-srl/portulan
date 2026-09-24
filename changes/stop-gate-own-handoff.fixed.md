- **The Stop-gate no longer takes another session's handoff for this one's.** It counted any file in
  `handoffs/` named with today's date, so a handoff committed and pushed already, as one merged on the base
  branch is, released every session whose tree held uncommitted or unpushed work on the day it landed.
  [`cli/stop-gate.mjs`](../cli/stop-gate.mjs) now counts only a handoff the tree has not yet committed and
  pushed: untracked, changed, or in a commit no remote holds, the test it already puts to the work. Its
  refusal names a dated handoff it did not count and says why.
