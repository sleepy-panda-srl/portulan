# Task — the repository's map must match its shape

**Goal.** The root `README.md` layout table lists every top-level entry in the repository, and a check
enforces it so the two cannot silently drift apart again.

**Acceptance criteria.**
- [x] When the verify recipe runs, the system shall name every top-level entry absent from the root
      README's layout table.
- [x] When at least one entry is absent, the system shall exit non-zero, so "done" is blocked.
- [x] When every top-level entry is documented, the system shall exit zero.
- [x] The root README's layout table documents `.claude-plugin/` and `.portulan/`.

**Verify.** `./.portulan/verify/docs.sh` — written before the fix, red on two undocumented entries, green
once the table was corrected. The transcript of both runs is recorded in
[`../handoffs/2026-07-25-m1-session-3.md`](../handoffs/2026-07-25-m1-session-3.md).

**Constraints.** The check has to hold for entries that are not yet committed, or it would pass on a new
directory right up until the moment it stopped mattering — so the recipe reads tracked *and* untracked
non-ignored paths. The kernel is not touched. The fix to the README adds rows only; nothing already in
the table changes.

**Context.** [`../verify/README.md`](../verify/README.md) — what the check enforces and its limits ·
[`../memory/readme-map-must-match-shape.md`](../memory/readme-map-must-match-shape.md) — the rule this
produced · [`../../core/operating/verification.md`](../../core/operating/verification.md) — the failing
test as spec.

**Lane.** full — it changes the verify recipe, which [`../gate-map.md`](../gate-map.md) puts in the full
lane regardless of size.
