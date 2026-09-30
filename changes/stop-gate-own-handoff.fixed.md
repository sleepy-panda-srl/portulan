- **The Stop-gate no longer takes another session's handoff for this one's.** It counted any file in
  `handoffs/` named with today's date, so a handoff committed and pushed already, as one merged on the base
  branch is, released every session whose tree held uncommitted or unpushed work on the day it landed.
  [`cli/stop-gate.mjs`](../cli/stop-gate.mjs) now counts only a handoff the tree has not yet committed and
  pushed: untracked, changed, or committed with content no remote has held, in whatever commit a rebase or a
  squash merge put it. Its refusal names a dated handoff it did not count and says why. Its count of handoff
  refusals starts again once nothing is left unrecorded, so work begun after a push meets the whole cap.
