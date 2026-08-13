# Handoff — the flag made the verdict worse

**Milestone 7, session 12. Full lane.** Task
[`0018`](../tasks/0018-discovery-that-could-not-look-is-not-a-green.md). Two fail-opens on the
`--pack-root auto` path, and the root pins that keep a required check's verdict about the tree.

## The finding worth carrying forward

**`--pack-root auto` made `doctor`'s verdict worse in four of six measured arrangements.** Not
"failed to help" — *worse*: on a host whose plugin record was absent or unreadable, asking for
discovery turned a correct **exit 1** into **exit 0**, and did it by discarding the tree-derived root
it already had. A pack that resolves perfectly well from the adopter's own tree stopped being looked
at, because the flag replaced a good root with an empty set.

**The general form: a fallback that empties the set is worse than no fallback.** Every instinct says a
lookup that finds nothing should degrade to what you had. This one degraded to nothing, and an empty
root set is not "no extra roots" — it is *`doctor` has nothing to check*, which is reported as
**unverifiable** and exits 0. **An empty set is not a neutral element when the consumer treats
emptiness as absence of obligation.**

## What made it findable, having been invisible for four sessions

A table. The behaviour had been argued about in prose for two sessions and the prose was wrong in both
directions; six rows of measured exit codes settled it in one pass and **produced the fix's shape for
free** — the last row, a valid record with nothing installed, was already correct, so `absent` had a
target to be made equal to rather than a design to be invented.

The maintainer asked to see both cases measured before ruling, rather than taking the recommendation.
That is what turned a judgement call into a comparison.

## Two fixes, and why they are two

- **`absent` is an answer.** `readInstalls` keeps `read`/`absent`/`unreadable` apart *and says in its
  own docblock that collapsing them is how a resolver starts lying*; `discoverPackRoots` collapsed two
  of them, and its docblock described the collapse as the design. **The rule was already written down
  twice in this same file** — `readInstalls`'s ENOENT comment, and the pointer path's `not-installed`
  verdict — and `discoverPackRoots` contradicted both.

  _An earlier draft of this handoff quoted "ENOENT counts as examined, because absence IS the answer"
  as if from a workspace memory record. **It appears nowhere in this repository**: it came from the
  implementer's own notes and was dressed as a citation. The pre-commit checkpoint went and read the
  file. **Second fabricated attribution this session** — the first was a maintainer ruling that was
  never given — and both were caught by somebody checking, not by anything structural._
- **Asked-for-and-could-not-look is could-not-run.** Ruled by the maintainer on the measurement. It is
  a genuinely separate fact from the command-line refusal, so it is a separate field: one says *your
  flags asked for two different sets*, the other says *you asked me to look and I could not*. A reader
  with a corrupt plugin record must not be sent back to re-read their flags.

## What to know before touching this next

- **The pins are the half the old narrowing was protecting**, and they are not merely preparation for
  the disposal: pinning turns `examples` from *unverifiable notes* into a graded workspace **today**.
  That is only safe because [`0017`](../tasks/0017-the-demo-composed-a-pack-that-does-not-exist.md)
  made its declared packs true first — the two changes are ordered, not merely sequential.
- **A named root REPLACES every other source**, which is why pinning is the whole containment: those
  six invocations cannot consult the host whatever the unasked default becomes. If a later change adds
  a seventh required invocation, it needs a root or it inherits the machine.
- **`recipe-set` had `discovery` and `forced` plumbing with no CLI reaching it** — a capability that
  looked wired and was not, the same defect `skills-set` was caught with a day earlier. It has the flag
  now; the lesson is that *plumbing without a caller is not a feature, it is a claim*.
- **This is not the disposal.** The unasked path is byte-for-byte unchanged, which is exactly what
  makes this safe to land first. Milestone 7's REQUEST-CHANGES stands and the Status cell is untouched.

## Fidelity

**The checkpoint found more than I did, and the gap is the lesson.** I had bound the could-not-run
mapping at `doctor` alone and written *"every caller maps that to exit 2"* — the pass deleted the throw
at **four other callers** and the full suite stayed green each time. It also **stripped all six root
pins at once** with nothing going red: the pins were shell prose, and dropping `doctor.sh`'s silently
reverts `examples` to green-by-not-looking, which is the exact class this change exists to close.

Both are bound now — four CLI-level cases and `cli/pinned-roots.live.test.mjs`, the latter verified by
stripping each of the six in a copy and watching it go red.

**Four tests failed to bind, in three distinct ways**, and two are new shapes worth naming:

- **An assertion one layer below the property claimed** — the mapping pinned at `resolutionRoots`
  rather than at the tools; and an existing case that **pinned the collapse itself**, rewritten into
  the two cases it conflated rather than deleted.
- **A fixture that failed for an unrelated reason.** The `index` case declared a `personas` index with
  no `slots.personas`, which exits 2 on its own, so it passed without ever reaching the mapping.
- **A discriminator that discriminated nothing.** Both new CLI cases matched `/could not be read/` —
  which is also in the *unresolvable-pack* sentence, so the assertion held with the mapping deleted.
  Found by mutating it away and **reading what the other path actually says**, then tightening to
  `Discovery could not look`, which only the discovery diagnostic emits. **A discriminator has to be
  measured against the thing it is meant to exclude**, not just against the thing it should match.

  **And then I committed it again, two files away, after writing that sentence.** The `init` case
  added in the same session matched `/could not read|unknown rather than no/` — broad enough for any
  other `init` failure — and Copilot found it at round 3. Naming a defect class in a handoff does not
  inoculate the session that named it; the only thing that caught either instance was somebody
  mutating the assertion and reading what the *other* path says.

Eleven recipes green under pinned roots; suite **1535 pass / 0 fail**. Seam scan clean over the diff,
the branch name and the commit message, term by term.
