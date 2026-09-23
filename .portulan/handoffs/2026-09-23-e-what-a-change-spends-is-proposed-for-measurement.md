# Handoff — 2026-09-23: what a change spends is proposed for measurement, and row 13 follows row 12

**What landed.** Proposal [`0038`](../proposals/0038-what-a-change-spends-is-measured.md), row 13 of the
milestone map in [`../../docs/plan.md`](../../docs/plan.md), and the row's drafting rationale in
[`../../docs/milestones/m13.md`](../../docs/milestones/m13.md). **Nothing is built.** The maintainer ruled the
row and sent the other four questions to the project's coordinator session, on his criterion of better
performance; the rule itself is his to accept on [#433](https://github.com/sleepy-panda-srl/portulan/pull/433).

**Why a second proposal, not a revision of 0036.** 0036 prices what one context loads. The spend it recorded for
its own drafting was in how many times a context is re-read and rewritten, which no always-tier budget reaches,
and 0036 says so of itself. Spend per change reads the host's records rather than the tree, which is a new
surface, and [`../gate-map.md`](../gate-map.md) starts a new surface as a proposal.

**What the research found that shaped the rule.** Every request re-reads its context, so reads grow with the
square of the requests. Between continuing and restarting, growth cancels, so the threshold depends only on the
price multipliers, the fresh context and the horizon, which is why it is computed rather than written down. The
host's own summary reported four research readers at 811.7k tokens while they processed 15.05M; its transcript
writes one usage record per content block, and some output counts in it are not final, so the ledger states its
error. The research notes stay outside this repository because they quote prices per named model.

**What review changed.** No fresh-context checkpoint ran, by his instruction of 2026-09-23 12:38 that this
project's sessions run none unless he asks. The coordinator session reviewed both drafts before the commit instead,
and its twelve corrections are folded. The largest: a non-blocking `Stop` hook's output never reaches the model,
so the advisory moved to the hooks whose output does; growth was wrongly said to lower the threshold; and the
proposal now cites its outside sources by name rather than by link, as every earlier proposal does.
Copilot's review of #433 then found three contradictions, fixed in a second commit: rule 2 said a session *ends*
though nothing proposed ends one, so it is now *told* to; the ledger never runs inside a recipe though `doctor` is
one, so that recipe runs a static mode railed to open no host record; and the advisory was due at the exact
crossing though its hooks read a transcript the host writes asynchronously, so its demonstration allows one
request's lag.

**The commit's co-author line names no model.** This session's operating rules keep model identifiers out of
anything pushed.

**Green.** `docs` and `index` green; this change touches no code, so `tests` did not run.

**Next action.** His acceptance on #433. Row 12's changes go first; 0038's first change, the second part of
`core/operating/context.md`, follows 0036's first four. The per-host multiplier table names models, so its change
comes from a local session. Proposal `0037`, the handoff budget, is still unwritten; 0038's ledger can supply it a
one-line spend figure per handoff.
