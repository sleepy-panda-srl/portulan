# Task 0018 — discovery that could not look is not a green

**Lane:** full · **Opened:** 2026-08-13 · **Verify recipe:** `tests` · **Status:** IN REVIEW

> Two fail-opens on the `--pack-root auto` path, and the pins that make a required check's verdict a
> statement about the tree rather than about the machine running it. **All of it is true whether or
> not the milestone-7 disposal ever lands** — which is why it ships first and separately.

## What was measured, before anything was changed

On the workspace `portulan init` drafts by default (`--residence in-repo`, composing
`rituals/checkpoints` from the host cache) plus one pack of the adopter's own:

| host record | invocation | exit | what happened to the two packs |
|---|---|---|---|
| **absent** — every CI runner | *(none)* | 1 | cache pack FAILS (correct); own pack resolves |
| **absent** | `--pack-root auto` | **0** | **both unverifiable — neither looked at** |
| **unreadable** | *(none)* | 1 | cache pack FAILS (correct); own pack resolves |
| **unreadable** | `--pack-root auto` | **0** | **both unverifiable — neither looked at** |
| valid, nothing installed | *(none)* | 1 | cache pack FAILS (correct); own pack resolves |
| valid, nothing installed | `--pack-root auto` | 1 | cache pack FAILS (correct); own pack resolves |

**The flag made the verdict worse, not better.** In four of six rows the no-flag run is the honest one.
Asking for discovery turned a correct red into a green in exactly the two rows where discovery could
not answer — and it did so by **discarding the tree-derived root it already had**, so the adopter's own
pack, which resolves perfectly well locally, stopped being looked at too.

**And the target behaviour was already in the table.** The last row — a valid record with nothing
installed — has always been right. That is what `absent` should do, because *nothing installed* is
exactly what an absent record means.

## The two fixes, and why they are different fixes

**1. `absent` is an answer, not a failure to look.** `readInstalls` keeps three states apart at the
source — `read`, `absent`, `unreadable` — and its docblock says collapsing them is how a resolver
starts lying. `discoverPackRoots` then collapsed two of them, and *its own docblock described the
collapse as the design*. `absent` now returns `ok: true` with no roots — which **this module already said in two other
places**: `readInstalls`'s own ENOENT comment (*"a host with nothing installed — or no host at all,
which is CI"*), and the pointer path below it, which has always turned `absent` into a
**`not-installed` verdict** rather than a could-not-look. [`../../cli/plugin-lint.mjs`](../../cli/plugin-lint.mjs)
states the general rule: *"Absent counts as examined … that IS the finding."* `discoverPackRoots` was
the outlier inside its own file.

**A citation was fabricated here and is recorded rather than quietly swapped.** An earlier draft
attributed *"ENOENT counts as examined, because absence IS the answer"* to
[`../memory/verify-preconditions-fail-closed.md`](../memory/verify-preconditions-fail-closed.md). That
sentence appears **nowhere in this repository** — it came from the implementer's own notes and was
dressed as a quotation from a workspace record. Caught by the pre-commit checkpoint, which went and
read the file.

**And the distinction that keeps this from contradicting that memory**, which the fabricated quote was
papering over: a **dependency the check needs** being missing is could-not-run — that is the memory's
actual subject, and why a missing tool still exits 2. A **world-state the check observes** being empty
is an answer. The plugin record is the second kind: discovery's whole question is *what is installed
here*, and *nothing* answers it.

**2. An asked-for discovery that could not look is could-not-run.** Ruled by the maintainer on the
measurement above, after being shown both cases side by side. The `forced` branch returned an empty
plan, and an empty root set makes `doctor` report every declared pack *unverifiable* and exit **0** —
a green over a host nobody could read. It now sets `couldNotRun`, and every caller maps that to **exit
2**.

`refusal` and `couldNotRun` are **separate fields**, both mapping to exit 2. One says *your command
line asked for two different resolution sets*; the other says *you asked me to look and I could not*.
Collapsing them would send a reader with a corrupt plugin record back to re-read their flags.

## The pins — the half the narrowing was actually protecting

**They were unbound when first written**, and a checkpoint proved it by deleting all six with nothing
going red. `pinned-roots.live.test.mjs` is the rail: a roster of the required invocations, plus a
sweep asserting no verify recipe invokes a root-taking tool without appearing in that roster — so a
seventh required invocation cannot be added unpinned and unnoticed. Its limit is stated in its own
header: it reads invocation lines as text, so it knows a root is *named*, never that it is *right*.

A required check answers *does this tree hold its own claims*, so its answer may not move with what
happens to be installed on the machine running it. Six sites now name their root, which **replaces**
every other source and so cannot consult the host whatever the default becomes:
`verify/doctor.sh`, `verify/compile.sh`, `verify/index.sh`, `verify/plugin.sh`,
`.github/workflows/verify.yml`, and the command [`../dod.md`](../dod.md) condition 1 quotes.

It is the argument `doctor.sh` already made one noun over: its workspaces are **named rather than
discovered**, so adding one is a visible edit rather than a silent omission.

**This is not merely preparation.** Pinning changes `examples` from *unverifiable notes* to a real
verdict today — the difference between green-by-not-looking and a graded workspace — which is only
safe because [`0017`](0017-the-demo-composed-a-pack-that-does-not-exist.md) made its declared packs
true first.

## `recipe-set` gains the flag it never had

It is the one carrier of the runnable recipe set and **CI calls it**, and it parsed no root flag at
all — while `resolverFor` already accepted `discovery` and `forced`. Plumbing that looked wired and
was not: the same defect `skills-set` was caught with the day before. Without it, a workspace composing
from the host cache had no invocation that could enumerate its own recipes, and CI could not pin.

## What this does NOT do

- **It is not the disposal.** `--pack-root` is still not *optional where discovery finds a root*;
  milestone 7's close keeps its REQUEST-CHANGES and the Status cell is untouched. Nothing here changes
  the **unasked** path, which is exactly why this is safe to land first.
- **It does not make a green under `auto` certify provenance.** That was traded when the union landed
  and stays traded.
- **The pins are this repository's.** An adopter's CI pins its own roots or does not; nothing here
  writes anyone else's pipeline.

## Tests, and the four that did not bind

**Every property is mutation-tested — and that sentence was false when first written.** A pre-commit
pass deleted each `couldNotRun` throw in turn and the full suite stayed green at **four of five**
carriers; it also stripped **all six** root pins at once with nothing going red. Both are now bound:
four CLI-level cases, and [`../../cli/pinned-roots.live.test.mjs`](../../cli/pinned-roots.live.test.mjs),
which fails if any required invocation drops its root — verified by stripping each of the six in a copy
and watching it go red.

**The mapping is reached wherever a plan is BUILT, not at every invocation**, and the first fixtures
missed that: a workspace declaring no packs short-circuits before the plan, correctly, so two tests
passed while exercising nothing.

Four tests did not bind, in three distinct ways:

- The could-not-run mapping was asserted only at `resolutionRoots`, so deleting `doctor`'s
  `plan.couldNotRun` throw changed nothing any test could see. It now has a **doctor-level** case:
  unreadable record plus `auto` is exit 2, with a **control** showing the same flag on an *absent*
  record is a verdict (exit 1) rather than a refusal.
- One existing case, *"a record that could not be looked at is `ok: false`, never an empty
  discovery"*, **pinned the collapse itself**. It is rewritten rather than deleted, into the two cases
  it was conflating — and the property it was reaching for is real and now lives in the unreadable one.
- **A fixture that failed for an unrelated reason.** The `index` case declared a `personas` index with
  no `slots.personas`, which exits 2 on its own, so it passed without reaching the mapping.
- **A discriminator that discriminated nothing.** Both new CLI cases matched `/could not be read/` —
  which appears in the *unresolvable-pack* sentence too. Measured by mutating the mapping away and
  reading what the other path actually says; tightened to `Discovery could not look`, which only the
  discovery diagnostic ever emits.
