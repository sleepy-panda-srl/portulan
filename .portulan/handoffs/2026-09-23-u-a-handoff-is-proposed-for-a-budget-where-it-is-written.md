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

**Delegated calls.** The eight defaults in the proposal stand as the coordinator session's calls on the maintainer's
criterion of better performance, reasons there. Two more are this change's own: no CHANGELOG bullet, by the precedent
of #429, #433 and #438, since a proposal gives a release's reader nothing; and no plan row, since 0036 places this
work in row 12, whose text is his third question.

**Review.** No fresh-context checkpoint ran, by the maintainer's instruction of 2026-09-23 12:38. The coordinator
session reviewed the diff before the commit and reproduced its figures; two corrections are folded (37 headings repeat
their date, not 19, and the cutoff now says why it is a manifest date when the specification declines one for the
ratio), with one sentence saying the window saves on-demand reads of the index, not the boot. Copilot's five rounds
found eight things. Fixed: the window fits the whole index (52 handoffs here, not 54); the cutoff moves to the newest
handoff's date where that is later, a rename past it is bound, and a date more than a day ahead will be refused; the
judge will read the series with no index declared; the Session log's figures name `457b0b6`. Stated as rules no
checker establishes: the cutoff day's own handoffs stay unbound, the gap `docs.sh`'s check 4c has too; no handoff is
dated earlier than it is written; a cutoff move exempts what has merged, not what is open, rather than a cap schedule,
by the coordinator session's delegated call. The coordinator session's checks after those pushes added that the date
rail holds in every workspace and that the cutoff never moves earlier, and put the date refusal in the future tense:
it is proposed, not present.

**Next action.** His rulings on the three questions and his acceptance, recorded in a separate change as 0036's and
0038's were. The build follows 0036's measurement module; this repository declares its cap once its ratio is declared
from the exact mode.
