# Handoff — handoff cadence made uniform

**State.** Done, in one change off `main` (`88d98e7`). The every-session handoff rule is stated in
[`../../core/operating/loop.md`](../../core/operating/loop.md), mirrored in the
[`../../core/templates/handoff.md`](../../core/templates/handoff.md) header, added as condition 8 of
[`../dod.md`](../dod.md), and recorded with its provenance in
[`../memory/every-session-ends-with-a-handoff.md`](../memory/every-session-ends-with-a-handoff.md).
Nothing enforces it yet. This file is the rule's first instance.

**Decisions + why.**

- **The rule is binary, not discretionary** — because "write one when it's warranted" is prose no gate
  can check, and only a binary rule compiles into machinery. The costs are also asymmetric: an
  unnecessary handoff costs five lines, a skipped one loses decisions-and-why permanently, and nobody
  notices until a settled decision gets re-litigated. Alternative considered and rejected: keep it a
  judgement call and let reviewers catch omissions — that is the un-railable version.
- **It does not violate the scale-down non-goal** — because the minimum is one dated short file *per
  session*, not per task; the triage lane is untouched, and a triage-only session still ends exactly
  once. It joins the class the engine already has ("verify and the Stop-gate never scale down") rather
  than minting a new exception. That answer stays honest only while the minimal form is genuinely valid,
  so the template now says so explicitly, and any future gate must check presence and date — never
  structure or length.
- **The invariant sits in `core/`, the specifics in the workspace** — because the reasoning (un-gateable
  discretion, asymmetric costs) is universal, and the machinery that needs an unbroken series is engine
  machinery. What is *ours* — the dated file in `handoffs/`, five-lines-enough, where the series starts
  — stays here. Storage follows ownership: core carries the mechanism, this workspace carries the
  episode.
- **Forward only, expressed as a cutoff rather than a list** — the series starts when this rule lands on
  `main`. Backfilling earlier sessions would fabricate a contemporaneous record, and would add nothing:
  the *why* is exactly what a later writer cannot reconstruct. Stating it as a date rather than naming
  sessions matters because more sessions predate the rule than the first draft listed — a checker built
  on the enumerated version would have failed on day one.
- **The repo card stays** — [`../repos/portulan.md`](../repos/portulan.md) describing the repository it
  lives in is self-hosting, not a dependency cycle: nothing needs the card to build or verify, the
  cascade stays one-directional, and from milestone 6 the portfolio workspace holds cards for *other*
  repositories. The real risk is drift, not circularity, which is the open question below.

**Open questions.**

1. **A `doctor` lint for workspace claims** (milestone 2, alongside validating `.portulan/`): check a repo
   card's build/test/run lines, its layout, and the gate map against what the tree actually contains —
   the same move as the `map` check that holds the README to the repo's shape. This is the answer to
   card drift; nothing stops it going stale today.
2. **Correspondence checking** — once a gate can compare the session log against this directory, it must
   honour the cutoff above, and check presence and date only.
3. Still open from the previous session and unchanged: branch protection is accepted and not yet applied.

**Next action.** Open the PR for the maintainer to review and merge. Nothing else is pending.

**Recoverability.** Documentation only; no settings changed, nothing outward taken. Verify recipe green,
so the tree can be committed or discarded whole.

### Amended 2026-07-25 — recording a decision this session made but did not write down

_The decision below was taken during this session's own review cycle and shipped in the same pull
request; only its recording here happened afterwards. This is errata, not a post-close addition._

**"Dated" now has a definition, because it had none.** Copilot's review found that the rule above turns
on a property no gate could implement: nothing said where the date lives — the filename or a field inside
the document. Both existing handoffs happened to carry an ISO filename prefix, but by accident rather
than by stated convention.

That mattered more than a wording nit. The entire argument for making this rule binary rather than
discretionary was *a binary rule is checkable* — so leaving the checked property undefined undercut the
case for the rule itself. **Decided:** the date leads the **filename**, in ISO form,
`YYYY-MM-DD-{slug}.md`, never an in-document field. _Because:_ a date in prose needs parsing and gets
written differently by every author, whereas a filename is readable without opening the file and sorts
the series chronologically for free. Stated in both [`../../core/operating/loop.md`](../../core/operating/loop.md)
and the [template header](../../core/templates/handoff.md). Descriptive rather than breaking — both
handoffs already conformed.

Worth recording alongside it: three independent reviewers each found a different defect in this one
change, and all three were failures of *checkability* — the very property the rule claims for itself.
Rules about enforceability are unusually easy to write unenforceably.

_(Marked rather than woven into the text above, so the record shows plainly what was written when. The
session knew this by its close; it simply failed to record it — which is the more common failure and the
one the marker is for.)_
