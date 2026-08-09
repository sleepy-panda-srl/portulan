# Handoff — a blank governor is no governor

**Off the milestone row.** Issue [#141](https://github.com/sleepy-panda-works/portulan/issues/141), filed
from Copilot's confirming round on #135 and left rather than fixed there on the maintainer's instruction.

## The defect

`cli/doctor.mjs`'s cross-repository check guarded on `other.governed_by?.workspace === undefined`, which
catches **absent** and not **invalid**. So a pointer carrying `""`, `null`, `7` or `{}` fell through to the
conflicting-governor branch and was refused for naming a governor it does not name — a **false red** about
somebody else's manifest, inside the block whose own stated rule is *read, never validated*.

The guard now asks *is this a usable governor name* — a non-blank string — which is the rule
`cli/discover.mjs` enforces at the other site of the same operation.

**Non-blank string, deliberately, and not *usable slug*.** A padded or otherwise illegal name is still a
name the manifest **declares**, and judging its legality would be validating somebody else's workspace. So
`"  sleepy-panda  "` stays a conflict, and a test pins that boundary rather than leaving it in a comment —
a two-sided trim added later would silently flip that red to green, which a first draft at
`cli/discover.mjs` did once already.

## What the checkpoint found, which is the part worth keeping

The fix was right and **incomplete**, in the way this class always is:

- **The sibling branch three lines below** raw-interpolated the governor into the conflict message, so
  `"sleepy-panda\n"` printed a report broken across two lines mid-sentence. Escaped now.
- **`cli/vendor.mjs` carries the same class**, and its guard is `?? "(nobody)"` — `=== undefined` spelled
  another way. It read `""`, `null` and `{}` as names and printed `` `[object Object]` `` into a refusal
  claiming a *foreign residence*. The refusal stands, because vendor is about to overwrite and
  fail-closed on an unreadable manifest is the right direction; the **sentence** now says which of the two
  it met.
- **`cli/init.test.mjs` carried a suite named for the present tense** — *"the manifest doctor still
  mishandles"* — which this change falsifies on the run that lands it. Past tense now, assertions
  unchanged: `init`'s obligation was never that `doctor` be correct.

## One correction to the issue

#141's prose calls this *"the fourth gap"* while its own numbered list has three. The list is right.

## State

Nine recipes green, suite **1129**. No milestone row moves.
