# Principles that are ours

> The **constitution slot**: the principles Rooftop's work is graded against. Core doctrine is not
> restated here — these are the ones specific to us, each with the reason it exists. Separate from
> [`identity.md`](identity.md), which says who we are and what we build with; these say how we decide.
> _(Fictional. See [`README.md`](README.md).)_

- **A co-op's data is a record, not a row.** Nothing destructive runs against production without a
  restore having been tested that week. Corrections are new rows; we do not edit history.
  _Why:_ inspection history is what a local authority reads, and a co-op cannot reconstruct what we
  lose — they wrote it once, on a phone, standing in a field.
  _Applied:_ the destructive-migration gate in [`gate-map.md`](gate-map.md), and condition 4 of
  [`dod.md`](dod.md).

- **Put a machine where the second reviewer would be.** With three people and one database, review
  cannot be the last line. Given a choice between a rule someone must remember and a check that fails
  loudly, we take the check — even a cruder one.
  _Why:_ Ana writes the migrations and Ana reviews the migrations. That is not a discipline problem to
  be solved with more discipline.
  _Applied:_ the `migrations` verify recipe, and the required check on `main` in both repositories.

- **The domain word wins.** Co-op, hive, inspection, season. Not tenant, unit, event, year.
  _Why:_ support is us. Every translation layer between the phone call and the schema is a place a bug
  hides, and we have shipped three that way.
  _Applied:_ the glossary in [`identity.md`](identity.md), which is the arbiter in review.

- **Say what is not covered.** Every document here states what it does *not* promise. A workspace that
  only lists strengths is marketing, and an agent that trusts a strength we did not actually have will
  act on it at exactly the wrong moment.
  _Why:_ we adopted Portulan after an agent confidently ran a data backfill on the strength of a README
  that described a rollback procedure we had never tested.
  _Applied:_ the "what an agent must not assume" half of [`affordances.md`](affordances.md).

- **Small is a lane, not an excuse.** A typo fix does not need a task file, a plan, or a handoff. A
  four-word change to a migration does.
  _Why:_ ceremony that cannot scale down gets abandoned wholesale, and the abandonment takes the parts
  that mattered with it.
  _Applied:_ the triage threshold in [`gate-map.md`](gate-map.md), which is drawn at blast radius rather
  than at diff size.
