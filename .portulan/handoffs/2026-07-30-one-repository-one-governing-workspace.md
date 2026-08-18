# One repository, one governing workspace

**Date:** 2026-07-30 · **Pull request:** [#135](https://github.com/sleepy-panda-srl/portulan/pull/135) ·
**Milestone:** none — a ruling recorded and railed; M6 and M7 amendments are drafted, not applied.

## What this session was for

The maintainer ruled on 2026-07-30 that `portulan-internal > tipar` and `tipar > .portulan` at the same
time is refused: a customer configures Portulan one way or the other, may switch, and exactly one
configuration governs at any time — with **full functionality either way**. The session's job was to
record the ruling, rail it, and route what it implies. Not to reopen it.

## The answer the proposal had to carry

The ruling turned on a question worth keeping: *do the two configurations differ, and if so by what — and
if they differ, why can't they be the same thing?*

**They are one artifact in two residences, differing in reach and delivery, never in content-kind.**
Compared at source, no content-kind differs between customer zero's workspace and the `sleepy-panda`
portfolio workspace in the feed — both carry slots, recipes, a store, a gate map, a cascade position.
Feed-side reaches many repositories and keeps team context out of product trees whose audiences may be
wider; in-repo is self-contained and feed-independent. Two residences of the same thing are not two
things, which is exactly why both may not be present.

## What was built

- **Workspace Definition 2.7**, a MINOR argued on the definition: `kind` gains `pointer`, `governed_by`
  names the governing workspace, and `slots`/`verify` move into a top-level `oneOf` that re-imposes them
  on every governing kind — so the requirement stays **in the published schema** rather than becoming
  another constraint only `doctor` knows about. `spec/README.md`'s own warning about that growing list is
  the reason.
- **Three refusals in `doctor`**, each red-first, each printing the ruling's sentence: a pointer carrying
  governing slots; a governing workspace carrying a `governed_by`; and — given the new repeatable
  `--repo-root` — a repository named by one workspace and governed by another.
- **The boot skill** reports a pointer honestly and does not fetch.

## Two defects the session-open checkpoint caught before they shipped

Both are worth carrying, because both were invisible from the design and obvious from the code.

1. **A compliant pointer went RED.** `verify.default` is checked unconditionally against the recipe list,
   and a pointer declares no recipes — so every correct pointer failed a check about a slot it correctly
   does not carry. A pointer now takes its own path through `inspect`, and **says which checks did not
   run** rather than skipping them silently.
2. **The cross-repository refusal fired on customer zero's own shape.** `.portulan/` names the card
   `portulan`, so a root holding the Portulan checkout finds *this* manifest — one workspace seen from
   outside, refused as two. Identity is compared on the real path now, and the exemption is identity
   alone: a genuine second workspace at the same name is still refused, held by a negative control.

## One count, three carriers, three different numbers

`doctor` enforces **nine** conditional constraints the schema cannot express. `spec/README.md` said
seven — the 2.6 `personas` pair was never added. `spec/slots.md` said five, stale by two bumps. **Nothing
was wrong in the mechanism**; the prose about it was wrong in two places, which is
[#133](https://github.com/sleepy-panda-srl/portulan/issues/133)'s class, and the sibling ruling of
2026-07-27 is why both were fixed in one stroke. `spec/README.md` now also records that 2.7 adds nothing
to that list, and why.

## What is named rather than built

`init` asking the residence question, `vendor` performing the switch, `upgrade` migrating either
residence, and the parity demonstration — all M7, drafted as a row amendment awaiting ratification.
**Discovery** is the other one: nothing resolves a pointer to its governing workspace, because that needs
a host's plugin cache, and `--repo-root` is named rather than found for the same reason `--pack-root` is.

**The cross-repo claims-lint gap is priced, not closed.** A portfolio workspace declares no `tree`, so its
cards' claims are reported unverifiable — `examples/` reports 13 of them in an otherwise GREEN run.
Repo-side the tree is present and the cards are not. No single CI run sees both halves. In-session
validation works; the CI job that would check out both is not built.

## Open for the maintainer

- **The M7 and M6 texts await ratification.** Neither row is touched.
- **`vendor` as the switch's carrier is routed rather than assumed.** `vision.md` glosses `vendor` as
  self-contained output for any host, which fits feed-side → in-repo and stretches for the reverse. Two
  one-line ways to take it, both in the pull request; the drafted text takes the first.

## Verification

Eight declared recipes GREEN. Suite **741 → 754**, measured. Seam scan over diff, message and branch:
clean.

**Both checkpoints were fresh-context Fable 5, and both returned APPROVE-WITH-ADJUSTMENTS.** Session-open:
nine adjustments, all folded, no drops — two of them defects this change would otherwise have shipped
(above). Pre-commit: four adjustments, all folded, one drop taken. It re-ran every recipe, rebuilt every
refusal from its own manifests, and replayed the bump against a 20-manifest battery; **every number in the
diff survived measurement**, and what did not survive was four sentences claiming more than the mechanism
did — **two of them inside the paragraphs arguing against exactly that**. The one drop is commit
`291f14c`'s "all three are corrected", where `doctor` needed no correction: amending pushed history costs
more than the clause's slack, so it stands and is named in the pull request instead.

**The lesson worth carrying past this session:** the count correction in this change was the *point* of
part of it, and the change still shipped a first draft that misattributed the repeating pair by one bump
and overstated the pointer's permit-list by one key. Neither was catchable from the diff — both needed the
world the diff describes to be re-measured, which is what the pre-commit pass is for and what Copilot
cannot do.
