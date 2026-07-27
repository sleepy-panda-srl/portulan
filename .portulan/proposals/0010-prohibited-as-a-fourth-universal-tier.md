# Proposal 0010 — `prohibited` as a fourth universal tier

**Status. ACCEPTED by Marius, 2026-07-27, and applied in this change.** Recorded as a proposal rather
than merely done, because it amends `core/operating/autonomy.md` — the tier model every workspace's gate
map is written against — and the evolution gate documents decided changes, not only contested ones. A
doctrine change with no proposal behind it is a rule with no provenance, which is the thing this
repository fails a memory entry for.

## The change

`core/operating/autonomy.md` gains a fourth tier beside Auto, Propose and Gated:

> **Gated** is grantable at runtime by a human yes. **Prohibited** compiles to deny and is grantable only
> by changing the rule itself through the evolution gate — never by runtime approval.

## Why it is a tier and not a note

It was discovered by building the compiler, which is the honest provenance. Milestone 4 needed a fourth
class **before it had a schema**: a three-value enum forces *"no agent edits the constitution"* into
Gated, and Gated compiles to a prompt. *Never* would have become *unless somebody clicks yes* — a
difference invisible to every reader of the gate map, produced entirely by the vocabulary being one word
short.

The workspace layer carried the fourth class for one session while core still named three. That gap is
the argument: a workspace richer than core's vocabulary is normally a smell, and the resolution is either
to promote the concept or to admit the workspace invented one. Here the concept is universal — every team
has rules no approval should reach — so it is promoted.

## What it does not change

- **The constitution is untouched.** `docs/vision.md` never enumerates the tiers, verified rather than
  assumed, so this is doctrine reaching a settled place rather than a constitutional question.
- **Prohibited is never an autonomy reach.** A persona declaring it would be claiming a permission that
  exists for nobody. `core/personas/README.md` says so.
- **The compiler mapping is unchanged** — `prohibited` → `deny`, `gated` → `ask` — because the compiler
  was built against this distinction before core carried it. What changes is that the mapping now
  implements doctrine instead of anticipating it.

## The cost, stated

A tier no yes can reach is also a tier nobody can work around under pressure. That is the point, and it
is a real cost on the day someone needs the exception. `autonomy.md` therefore says to use it sparingly:
a policy that reaches for `prohibited` often has stopped distinguishing *dangerous* from *forbidden*, and
the tier's value is entirely in being rare enough that its presence means something.

The escape hatch is deliberately slow rather than absent: change the rule through the evolution gate — a
proposal, a human, a pull request. Slow is the feature.

## A second fix rides this one, in the same file and the same section

**The tier table's examples are now marked illustrative, not binding.** Decided by Marius the same day,
and carried here rather than separately because it is the same file, the same section, and the same
review — splitting it would have bought two supervised passes over one paragraph.

It is the *other half* of a fix already made. The "decision, not keystroke" clarification landed in the
Gated tier header after an agent read that tier literally and handed `git push` commands back to be
typed by hand. That fix repaired one row. This sentence repairs the reading for every **other** example
in the table, which is where the same misreading would land next.

The table supplied its own evidence while this was being written: its Gated row still offers *"push to a
shared remote"* as an example, and that is **false for the repository that wrote it** — a working-branch
push moved to Auto on 2026-07-27, gated at the merge instead. An example that has already gone stale in
its own home repository is the clearest possible argument that examples are not classifications.

Written to be retirable: if a future edit drops the examples from the *Action class* column, the
paragraph says it retires with them.

## Related, decided at the same time and deliberately not built

**Packs may contribute gate rules, tighten-only.** Agreed by Marius the same day. A pack may raise a tier
or add a prohibition; it may never demote another layer's classification, because a composed-in
third-party artifact able to demote `push` to Auto would be a dependency with the power to disarm the gate
containing it. The workspace may still override explicitly in its own gate map — it owns its policy — with
core's `prohibited` entries excepted, since those are grantable only here. Nothing is built: no pack
exists, and a slot before its consumer is the mistake the Workspace Definition was written to avoid.
Recorded in [`../compile/README.md`](../compile/README.md), with the policy shaped so a later merge step
is an addition rather than a redesign.
