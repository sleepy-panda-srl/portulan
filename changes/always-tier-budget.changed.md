- **A workspace can declare what its always tier may cost, and the doctrine says what that tier is.**
  [`core/operating/context.md`](../core/operating/context.md) states proposal
  [`0036`](../.portulan/proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md)'s rule: guidance
  sits in four load tiers (always, on-path, on-invoke, on-read) and belongs in the latest that still
  reaches the agent in time, with one level of index, and the always tier is budgeted in tokens like
  memory, never defaulted and repaired by demotion, merge or retirement rather than a raise. Workspace
  Definition **2.9** adds one optional key, `context`, for that budget and the bytes-per-token ratio it is
  counted at, and `doctor` checks their shape and refuses the key under an earlier declared version; every
  2.8 manifest stays valid unchanged. Nothing measures the tier yet: that is the next change. The kernel gains one word, 11 bytes on every boot.
