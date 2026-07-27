# Principles that are ours

> The **constitution slot** of this workspace ([`../spec/workspace.schema.json`](../spec/workspace.schema.json)):
> the principles this team's work is graded against. Core doctrine is not restated here — these are the
> ones specific to us, each with its reason. _(Separate from [`identity.md`](identity.md), which says who
> we are and what we build with; these say how we decide. They lived in one document until milestone 2,
> when the Workspace Definition made each slot separately addressable.)_
>
> This workspace also fills the optional `constitution` slot, with
> [`../docs/vision.md`](../docs/vision.md) — the product's constitution, which sits outside this
> directory and is human-owned. The two are not the same thing: the vision is what *Portulan* must be,
> these are how *we* work while building it.

- **Write the limit, not the aspiration.** Every document says what exists *today* and names the
  milestone where the rest lands. _Why:_ the repository goes public as a pre-release when the flip
  clearance completes, and a framework that overclaims about its own enforcement burns the only asset an
  unknown project has.
  _Applied:_ every "arrives in milestone N" note in this workspace, and the platform-floor admission in
  [`gate-map.md`](gate-map.md).
- **Prefer the rail to the reminder.** Given a choice between a rule an agent must remember and a check
  that fails loudly, take the check — even a cruder one. _Why:_ solo-maintainer economics; an unenforced
  rule in a repository with one reviewer is a rule that quietly stops being true. _Applied:_
  [`verify/docs.sh`](verify/docs.sh) — one rule this repository had stated and never checked (the
  kernel's line budget), plus two more minted from the defect that exposed them — and
  [`verify/json.sh`](verify/json.sh), written before the first JSON this repository depends on.
- **Fresh expression, always.** Every sentence in this repository is authored here, from the
  constitution and public practice. _Why:_ this is a provenance property of the product rather than a
  style preference, and unlike most quality bars it cannot be retrofitted later.
- **No private-engagement material, ever.** No names, identifiers, paths, or artifacts of any private
  client engagement enter these files, commit messages, branch names, or the session log — the binding
  non-goal in [`../docs/vision.md`](../docs/vision.md). The pre-commit scan that enforces it is defined
  outside this repository; running it is condition 5 of [`dod.md`](dod.md).
