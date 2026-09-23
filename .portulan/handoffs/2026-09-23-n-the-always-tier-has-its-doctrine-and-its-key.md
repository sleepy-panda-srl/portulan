# Handoff — 2026-09-23: the always tier has its doctrine and its manifest key

**What landed.** The first two changes of proposal
[`0036`](../proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md)'s order of work, one commit
each. First, [`core/operating/context.md`](../../core/operating/context.md), the doctrine page, and the
kernel's pointer to it: `context` joins the map's `operating/` line, and the same word joins the three other
lists of the doctrine pages (`core/README.md`, the `improvement.yml` issue form and `cli/feedback.mjs`, which
a test holds together). Second, Workspace Definition **2.9**: one optional key, `context`, holding
`always.budget.tokens` and `ratio.{bytes_per_token, calibrated_by}`, argued in
[`spec/slots.md`](../../spec/slots.md) and recorded in [`spec/README.md`](../../spec/README.md).

**Where each paragraph of the page comes from**, so the page itself carries no citations beyond its header:
the header, 0036's incident and *Proposed rule*; *Four load tiers*, rule 1, whose four definitions are
quoted, with one paragraph drawing the consequence of *the latest tier that still reaches the agent in
time*; *One level of index*, rule 1's pointer sentences and *Provenance*'s account of the study; *The always
tier is budgeted in tokens*, rule 2, the maintainer's second ruling and *Enforcement*'s measurement and
report bullets; *Portulan budgets its own contribution*, rule 3; *A fresh context is priced where it is
created*, rule 4; *No optimisation may lower context or code quality*, rule 5 and *What this does not ask
for*; *What is machinery today*, *Order of work* and *Enforcement*. The amendment to 0036 approved the
same day (the boot skill's pointer-manifest and packs sections load only where they apply) is landing as
pull request #439, and nothing on the page contradicts it.

**One pull request, two commits.** This departs from 0036's *one change per pull request*, as a delegated
decision of the coordinator session: the page names the key and the key's schema text points at the page,
so either alone would land with a dangling half, and a second pull request would double the review for
nothing.

**2.9 carries `context` alone.** The root schema refuses unknown keys, so the key could not ship without a
MINOR. Proposals `0034` and `0038` each say their keys ride the MINOR this key needs and that neither waits;
none is drafted, and `0034`'s accepted text names no version number, so their keys take the next free MINOR
when drafted.

**The key's shape, and the calls in it** (the coordinator session's, delegated): `ratio` is required
whenever `context` is declared, because a token budget with nothing to count it by is not a budget, and the
schema can state that. `bytes_per_token` must be finite and at least 1, and `doctor` says why: a token
covers at least one byte, so a smaller figure is tokens per byte entered inverted. The budget sits under
`always`, so a later tier's budget would sit beside it rather than force a rename. There is no date field,
because the commit dates the ratio. `calibrated_by` is a slug, and `slots.md`'s example reuses
`claude-code`, the id `compile` already gives the host. No workspace in this tree declares the key: nothing
measures the always tier yet. `.portulan` stays on 2.8 and `examples/` on 2.4, and `doctor` is GREEN on both
across the bump. The four writers stay at 2.7.

**Measured, with the method of #432 and #437.** This repository's boot read-set went from 95,602 to 95,613
bytes and the demo workspace's from 36,195 to 36,206: the 11 bytes of ` · context` in the kernel, which
stays at 47 lines. The page itself is on-read, 5,829 bytes in 94 lines, and no boot reads it.

**What stayed out.** The measurement module and recipe, the `doctor` report, compile targets, `init`'s
offer (it needs the measurement) and 0038's second part of the page.

**Checkpoints.** Skipped by his instruction of 2026-09-23 12:38 (no fresh-context runs unless he asks); the
coordinator session reviewed the diff before the commit; his review is on the pull request.

**Green in this container needs a non-root run.** All 27 recipes ran green as a non-root user on a copy of
this tree.

**Next action.** His review of the pull request, then 0036's third change: the measurement module and its
recipe.
