# Task — the Stop-gate counts per reason, not per session

**Status.** **Done, 2026-07-27** — milestone 4, session 1, alongside the repository-ruleset export, the
per-host backend matrix and `doctor`'s degradation report. **Ruled by Marius, 2026-07-27.** Written as a
task rather than left in a cross-session message because that is the only form that survives into a
fresh context — the decision arrived after the session-0 pull request had merged, and a ruling nobody
can find is a ruling that gets re-litigated. It worked: this task is what the implementing session read,
and a session-open supervisor checked the claim that the ruling was recorded-but-unbuilt against
`../compile/stop.mjs` rather than taking it on trust.

**Goal.** [`../compile/stop.mjs`](../../cli/stop-gate.mjs) keeps **one** consecutive-refusal counter for the
whole session, and the gate refuses for **two** independent reasons — a default recipe that was **not
observed green** (red, or could-not-run: exit 2, 126, 127, or an unreadable manifest — all of which block
exactly as red does), and a missing dated handoff. Give each reason its own counter. The recipe counter is
wired to *not green*, not to *red*; wiring it to red alone would leave could-not-run uncounted, which is
the distinction this gate exists to preserve.

- Each reason gets its own consecutive cap of **3**.
- A reason's counter resets only when **that reason's** condition clears: the recipe counter on an
  observed green recipe run, the handoff counter on the handoff being present.
- The absolute, non-resetting ceiling of **9** stays, as the backstop that guarantees the gate can
  always stop.

**Why, in the maintainer's terms.** This is the reset-on-green ruling *faithfully generalized* rather
than patched. Session 0 implemented reset-on-green literally and discovered it made the gate unbounded:
the reset keyed off the recipe while the gate refused for two reasons, so a session with a green recipe
and a missing handoff reset its count on every attempt and never reached a cap. The ceiling of 9 closed
that hang, and it was flagged at the time as an addition to the ruling rather than a reading of it.

It also left an asymmetry nobody chose: a red recipe got three refusals while a missing handoff rode to
nine — **a missing five-line file getting three times the patience of a failing suite.** Per-reason
counters remove that by construction, and match the standing preference for a uniform rule over an
incidental exception.

**Acceptance criteria.**

- [x] When the default recipe is **not observed green** on three consecutive stop attempts — red or
      could-not-run, since both block — the gate shall release on the fourth *for that reason*.
- [x] When a handoff is missing on three consecutive stop attempts **and the recipe is observed green
      throughout**, the gate shall release on the fourth *for that reason* — **this is the case that
      produced the original hang, and it must now cap at 3 rather than riding to 9.** The green recipe is
      part of the criterion, not scenery: with a red fixture the release could come from the *recipe* cap
      while a handoff counter still rode to 9, and the test would pass without exercising the ruling.
- [x] When the recipe goes green while the handoff is still missing, the recipe counter shall reset and
      the handoff counter shall **not**.
- [x] When the total refusals across all reasons reach the absolute ceiling, the gate shall release on
      the **next** attempt, regardless of any per-reason count — matching the convention the suite already
      pins for the per-reason cap ("the last blocked stop is the cap itself, not one past it").
- [x] When the gate releases, the message shall name **which** bound released it — the reason's cap or
      the ceiling. _(Session 0 shipped this misreporting once already and fixed it; do not regress it.)_
- [x] The two-reason interaction shall be tested directly. A per-reason design that is only tested one
      reason at a time has not been tested at all — the original defect lived exactly in the interaction.

**The trap, stated so it is not rediscovered.** The counter is keyed by session id **and** working tree,
because several worktrees of this repository are routinely checked out at once. Adding a reason
dimension must not collapse that: two reasons in one session share a session and a tree and must still
not share a count. The existing key-collision tests in
[`../../cli/stop-gate.test.mjs`](../../cli/stop-gate.test.mjs) are the shape to extend, including the one
covering session ids that sanitise to the empty string.

**Lane.** full — not because [`../gate-map.md`](../gate-map.md) names gate machinery (it does not; its
full-lane bullet names doctrine, the kernel, milestone status, and changes to the gate map or a verify
recipe), but because this change fails the triage lane's own conditions: it touches more than one file and
it changes behaviour a rule depends on. Cited that way round deliberately — claiming a document classifies
something it never mentions is the loose-citation defect [`../proposals/0008-adopting-a-control-is-not-knowing-what-it-did.md`](../proposals/0008-adopting-a-control-is-not-knowing-what-it-did.md)
was revised over.

**Context.** [`../handoffs/2026-07-27-the-enforcement-compiler.md`](../handoffs/2026-07-27-the-enforcement-compiler.md)
— where the hang was found and the ceiling flagged · [`../compile/README.md`](../compile/README.md)
— the current semantics and their stated limits ·
[`../handoffs/2026-07-27-the-floor-backend-and-the-matrix.md`](../handoffs/2026-07-27-the-floor-backend-and-the-matrix.md)
— where it was built.

**How it landed.** `{consecutive, total}` became `{counts: {recipe, handoff}, total}`; `resetConsecutive`
became `clearReason(session, reason)`; `verdict` takes `problems` tagged with their reason and releases
when a **currently-active** reason is past its cap, or the ceiling is. Three choices are worth reading as
decisions rather than as details, because each had a defensible opposite:

- **`REASONS` is exported data**, not three implicit lists in three functions. The single-counter version
  went wrong precisely because the counter, the reset and the message disagreed about what a reason was.
- **One refusal charges the ceiling once**, however many reasons name it — otherwise a two-reason session
  reaches nine in half the attempts, and the backstop starts firing during ordinary work.
- **Release keys off reasons that are wrong *now*.** A cleared reason's counter is zeroed, so the gate
  can never release a later stop on the strength of a problem that has since been fixed. Pinned by a test
  rather than left to be inferred from the zeroing.

One acceptance criterion was met **by the suite rather than by a live run** when this task closed, and
[`../compile/README.md`](../compile/README.md)'s observation table said so in the row itself rather than
counting it as covered: the handoff branch cannot fire in this tree on a day when any session has already
written a dated handoff. The recipe branch was re-run live end-to-end and released naming its own reason.
**The milestone-4 close checkpoint then ran the handoff branch too**, in an isolated clone — recipe green
throughout, blocked `handoff 1/3 → 3/3`, released on its own cap of three rather than on the ceiling of
nine. Every criterion here now has a live observation behind it, and the one that was hardest to get was
observed by a fresh context rather than by the session that wanted it to pass.
