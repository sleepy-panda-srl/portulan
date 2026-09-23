# Handoff — a handoff is proposed for a budget where it is written, and its index for a window

**What landed.** Proposal [`0037`](../proposals/0037-a-handoff-is-budgeted-where-it-is-written.md), the number
0036's fourth ruling reserved for the handoff size budget. **Nothing is built**, and no milestone row is added: 0036
already makes this row 12's ninth change. The rule and its three questions are the maintainer's, on the pull request.

**Why a cap on each handoff and not a budget on the series.** The specification's argument against a series budget
holds: every remedy is barred on an append-only series held to the Session log by count. A cap on one handoff has
compression as a live remedy only while that handoff is unmerged, so the cap binds handoffs dated after a declared
cutoff, the form `docs.sh` already uses for the Session log's entry budget. A tighter cap or a lower ratio later would
turn merged handoffs red with nothing legal to do, so those are the only changes that move the cutoff.

**Why a window and not a second index.** The index grows by a line per session and is read whole. Monthly indexes
would put a pointer on a pointer, which 0036 rule 1 forbids; a window loses nothing, since every line it leaves out is
derived from a handoff that stays in the series.

**Why it matters now.** 0038 tells a session to hand off and end when continuing costs more than restarting, so a
handoff is part of the fresh context that threshold is computed from. The largest here is 41,573 bytes.

**Delegated calls.** The seven defaults in the proposal stand as the coordinator session's calls on the maintainer's
criterion of better performance, reasons there. Two more are this change's own: no CHANGELOG bullet, by the precedent of
#429, #433 and #438, since a proposal gives a release's reader nothing; and no plan row, since 0036 places this work in
row 12, whose text is his third question.

**Review.** No fresh-context checkpoint ran, by the maintainer's instruction of 2026-09-23 12:38. The coordinator
session reviewed the diff before the commit and reproduced its figures; two corrections are folded (37 headings repeat
their date, not 19, and the cutoff now says why it is a manifest date when the specification declines one for the
ratio), with one sentence saying the window saves on-demand reads of the index, not the boot. Copilot's two rounds
found three things, all fixed: the window counted its lines only, so it now fits the whole index (52 handoffs here,
not 54); a filename date is not a merge date, so the cutoff moves to the newest handoff's date where that is later,
and a rename past it is bound in the change that makes it; and the Session log's figures now name `457b0b6`.

**Next action.** His rulings on the three questions and his acceptance, recorded in a separate change as 0036's and
0038's were. The build follows 0036's measurement module; this repository declares its cap once its ratio is declared
from the exact mode.
