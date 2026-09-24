# Handoff — the reading rules' three follow-ups

**State.** Every boot card carries the five rules on reading and the cache, written out by `compile` from
`core/operating/context.md` through an engine line; `upgrade`'s `0008` gives an older drafted card the
section. Three gaps were found in review and left out of that change on purpose.

**Open questions.** None: each is small, and a change of its own.

**Next action.**

- **A near-miss directive renders nothing, silently.** A line `<!--engine: … -->`, one with a trailing
  space, or one closing `-->` without its space compiles green and writes no rules, as a near-miss
  `leads:` or `gates:` line already does. `compile` should refuse any `<!--` line naming `engine:`,
  `leads:` or `gates:` that the exact pattern in `cli/compile.mjs` does not match, naming the line;
  `0008` and `doctor` already read such a card as lacking the section (`carriesReading` in `cli/form.mjs`).
- **The demo carries no card.** `examples/` declares Workspace Definition 2.4 and no `slots.context`, so
  its boot reads the skill, its steps and every slot, and no reading rules reach it. Giving it a card is
  a demo change of its own, measured against its rail in `.portulan/verify/context.sh`.
- **An indented setext title is missed.** A paragraph line indented one to three spaces and underlined
  by `===` or `---` is a heading to the host, but `outlineMd` in `cli/symbols.mjs` opens a paragraph such
  a line may underline only at the margin, since an indented one may sit in a list, so the section before
  it is measured as running through it. Nothing is lost meanwhile; the outline disagrees with the host
  there until the two are told apart.
