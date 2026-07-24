# Handoff — clearing the open items before milestone 2

**State.** Done, in one change off `main` (`bf02ecb`). Four loose ends closed: `doctor`'s scope in the
M2 criterion, a drafted sealed-provenance proposal, the "generic ≠ vague" bar in `codify`, and the
amendment to the previous handoff. Nothing from the milestone-1 arc is now carried unrecorded. Branch
protection remains the one item outside this change.

**Decisions + why.**

- **M2's criterion amended rather than left for the M2 session to discover.** `doctor` now validates this
  repository's own [`../`](../) alongside the demo workspace, and lints **workspace claims against the
  tree** — repo-card build/test/run lines and layout, and the gate map. _Because:_ the earlier question
  about the repo card was answered as *self-hosting, not a dependency cycle*, but that answer left the
  real exposure untouched. The card restates facts that also live in the README, the gate map, and
  memory, and nothing stops it going quietly stale. This is the same move as the `map` check that holds
  the README to the repo's shape — the difference being that a criterion written now is one the M2
  session starts from, rather than one it has to rediscover.
- **Sealed provenance drafted, not adopted** —
  [`../proposals/0002-sealed-provenance.md`](../proposals/0002-sealed-provenance.md). _Because:_ theses 4
  and 6 collide wherever a rule generalises upward out of an incident that cannot leave its owner's
  layer, and `core/operating/memory.md` currently records that as open with prose-only provenance, which
  it also admits cannot be checked. Two machine-checkable forms — a resolvable link, or a sealed
  owner+date stamp carrying the de-identified failure shape — turn thesis 4 from aspiration into a
  `doctor` check. Two additions of my own to the original sketch: `doctor` reports the **sealed
  proportion**, because a workspace where everything is sealed has silently opted out of retirement
  altogether; and the honest limit is stated — a sealed rule is not as good as a linked one, it is
  merely *declared* weak instead of silently absent. Drafted only: an agent may draft the curated layer
  and never own it.
- **The "generic must never decay into vague" bar went into `codify` step 1, not step 2.** _Because:_
  step 1 is where the incident is named and linked, and the seam case is exactly when it cannot be
  linked; step 2 already carries the altitude clause about specifics leaking upward. The bar itself — an
  implementer who never saw the incident can still write the rule's test — is what stops de-identifying
  from sliding into abstracting away.
- **The previous handoff was amended visibly, not rewritten.** _Because:_ the "dated" decision was taken
  during that session's own review cycle and shipped in the same pull request — the git record puts the
  commit two minutes before the merge — so what was missing was the *recording*, not the decision. That
  makes this errata rather than back-writing a post-close decision, and the marked amendment is the right
  shape for errata: append-only, dated, original text untouched. Marius directed it; the marker is what
  keeps it honest. Worth stating precisely, because a workspace whose forward-only rule rests on refusing
  fabricated contemporaneity cannot afford to be loose about which of the two happened.

**Open questions.**

1. **Branch protection is accepted and not yet applied** — the last item from the milestone-1 arc still
   outstanding, and the only one that is a repository setting rather than a file.
2. **Proposal 0002 awaits a decision** and is sequenced for milestone 2, since it amends the Workspace
   Definition that milestone defines.
3. **Amendment recursion has a boundary now, but only by convention.** Amending a closed session's
   handoff is allowed when marked; nothing yet says how many times, or when an amendment should instead
   become its own entry. Worth settling if it recurs.

**Next action.** Milestone 2 — Workspace spec v1 — starting from a criterion that now names `.portulan/`,
the claims lint, and the provenance slot.

**Recoverability.** Documentation only. No settings changed and nothing outward taken in this change;
verify recipe green, so the tree can be committed or discarded whole.
