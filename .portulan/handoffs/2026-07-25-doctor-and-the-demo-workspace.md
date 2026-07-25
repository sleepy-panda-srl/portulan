# Handoff — `doctor`, the demo workspace, and the first red on real content

**State.** Milestone 2, session 2 of 2. Shipped: [`../../cli/doctor.mjs`](../../cli/doctor.mjs) and its
test suite [`../../cli/doctor.test.mjs`](../../cli/doctor.test.mjs) with
[fixtures](../../cli/fixtures/); the demo workspace [`../../examples/`](../../examples/), fictional, two
products; two new verify recipes ([`../verify/doctor.sh`](../verify/doctor.sh),
[`../verify/tests.sh`](../verify/tests.sh)) which CI picked up with **no workflow edit**; the `tree` slot
(spec 1.0 → 1.1); three memory entries migrated to checkable provenance and two new ones written; and the
documentation sweep the change falsified. Task [`0002`](../tasks/0002-workspace-definition-v1.md) is
complete on both halves. **The milestone-close checkpoint decides whether milestone 2 closes; this
session does not assert it.**

**The brief said "session 1".** It was already merged (`main` = `dc7f64a`; PRs #8, #9, #11–#14 — #10 was
closed rather than merged, superseded by #13 under the same title). Session 2 is what
the plan's status line, the task file, and session 1's own handoff all describe as owed, so that is what
ran. Flagged rather than silently reinterpreted, per the plan's divergence protocol.

## Decisions + why

- **A checker refuses what it cannot check.** `doctor` implements exactly the JSON Schema subset
  [`../../spec/README.md`](../../spec/README.md) declares, and exits `2` on a keyword outside it — rather
  than validating the rest and reporting a verdict. Skipping and enforcing are indistinguishable from
  outside: the author writes a constraint, the machine says GREEN, the constraint never ran. This is
  `verify-preconditions-fail-closed` one level up — there the tool could not see its inputs, here it
  cannot see its rules — and it makes true a sentence `spec/README.md` had only asserted, that a schema
  change outside the subset *is* a change to `doctor` too. Recorded as
  [`../memory/a-checker-must-refuse-what-it-cannot-check.md`](../memory/a-checker-must-refuse-what-it-cannot-check.md).

- **The claims lint dispatches on a declared `tree`, not on `kind`.** This is the session's one schema
  change and the reasoning is worth keeping. The lint needs to know *which* tree a repo card's claims are
  about. Customer zero's is the repository it sits in; the demo's does not exist. The obvious rule —
  check `repository`, skip `demo` — was rejected twice over: it breaks on its own second case, since a
  portfolio workspace is not a demo and has no single tree either; and it would disable an entire check
  class on the strength of a **self-declared** field, which is a fail-open with a doorbell on it. So the
  workspace declares `tree`, and a workspace without one has its claims **reported unverifiable** rather
  than skipped. Additive and optional, so 1.0 manifests stay valid — which is the versioning rule
  demonstrated rather than described, for the first time.

- **Provenance binds `type: rule`, and nothing else.** Every normative source is rule-scoped — thesis 4,
  proposal `0002` as adopted, `dod.md` condition 3, the task's own criterion. A `decision` whose
  provenance is prose is *reported*, never failed. Making `doctor` bind types nobody legislated for would
  be tooling enforcing a rule the constitution does not state, which is the precise inversion proposal
  `0002` spent a paragraph warning about. **The two prose-provenance decisions here were deliberately
  left alone**: they are the live demonstration of the severity split, and one of them
  ([`three-workspaces-not-one.md`](../memory/three-workspaces-not-one.md)) sits under pending proposal
  `0003`, so editing it would pre-empt the gate. Proposals are not checked at all in v1 either — a
  proposal is the *argument* for a rule, while the rule itself lands in a memory entry or in `core/` on
  acceptance, and that is the carrier the mandate names; besides which one of the four is still pending
  the gate, and demanding a format from a record mid-decision is the gate's business, not a validator's.
  That scope is stated in [`../../spec/slots.md`](../../spec/slots.md) rather than left for a reader to
  assume. _(An earlier draft of this paragraph justified it as "the four that exist were decided before
  the mandate", which is false twice over — `0003` is pending and `0004` post-dates the mandate. Caught
  at the pre-commit checkpoint.)_

- **Exit codes: `0` validates, `1` does not, `2` could not run — and a missing manifest is `1`.** That
  last one is the interesting call. A manifest that is absent or malformed is a *verdict about the
  workspace*, not an environment failure; reserving `2` for "this tool could not judge at all" is what
  keeps *could not run* meaningful. An unanticipated exception is `2` and never `1`, because `1` would
  claim a judgement that was never reached — the same laundering already fixed once in
  [`../tools/gh-bot-token.mjs`](../tools/gh-bot-token.mjs).

- **The claims lint parses conservatively, and that is the opposite policy to the schema check.** It reads
  only tokens that look like paths — a code span or link target containing `/` — and leaves alone what it
  cannot confidently read. `build: none` claims nothing; `npm test` names a command. The two policies
  differ because the inputs do: a schema is a **declarative contract** where every clause is meant to bind
  and silence is a lie, while a repo card is **prose** where most of it was never a claim. An ambitious
  parser here would produce false reds, and a false red is what gets a whole recipe switched off.

- **A claim resolves against either the tree root or the card's own directory.** Customer zero's card
  legitimately mixes the two bases in one section — `` `.portulan/` `` is written from the repository root
  while `../../core/` is written from the card. Insisting on one base would have failed a correct card.

- **`doctor` lives in [`../../cli/`](../../cli/), not in this workspace.** It validates *any* workspace, so
  it is product surface; `verify/` is customer zero's own recipes and `tools/` is operator tooling.
  `cli/README.md` already licensed this ("scaffolded earlier where an earlier milestone needs it").

## The verification, run rather than asserted

**The red that mattered was not a fixture.** `doctor`'s first run against this workspace:

```
$ node cli/doctor.mjs .portulan
  FAIL  provenance constitution-is-human-owned.md (rule) carries prose provenance rather than a link or a sealed stamp
  FAIL  provenance every-session-ends-with-a-handoff.md (rule) carries prose provenance rather than a link or a sealed stamp
  FAIL  provenance readme-map-must-match-shape.md (rule) carries prose provenance rather than a link or a sealed stamp
  note  provenance repo-is-private-until-milestone-3.md (decision) carries prose provenance …
  note  provenance three-workspaces-not-one.md (decision) carries prose provenance …
  RED — 3 failure(s), 5 note(s)                                                        exit: 1

$ node cli/doctor.mjs .portulan examples          # after migrating the three rules
  GREEN — 0 failure(s), 6 note(s), 10 claim(s) checked
  GREEN — 0 failure(s), 4 note(s), 0 claim(s) checked, 8 unverifiable                  exit: 0
```

Three of five rules did not satisfy a mandate this repository adopted **one session earlier** and wrote
into the spec, the schema, and two core templates the same day. Nobody was wrong on purpose; nobody
looked, because looking required a tool that was one session away. Recorded as
[`../memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md).

**The test suite, red then green**, with the implementation removed and restored:

```
$ mv cli/doctor.mjs /tmp/ && ./.portulan/verify/tests.sh
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/cli/doctor.mjs' imported from '…/cli/doctor.test.mjs'
ℹ tests 1   ℹ pass 0   ℹ fail 1                                                        exit: 1

$ mv /tmp/doctor.mjs cli/ && ./.portulan/verify/tests.sh
ℹ tests 68  ℹ pass 68  ℹ fail 0                                                        exit: 0
```

_(The suite was 59 tests when that transcript was first taken and is 68 now: the pre-commit checkpoint
found nine defects, and every one of them got a test, because each had survived a suite written
specifically to catch that class.)_

**And a false red in this session's own transcript, worth recording because it nearly went unnoticed.**
The *first* red run of the suite — taken before `doctor.mjs` existed, which is the whole point of taking
it — was `node --test cli/`, and Node 26 rejects a bare directory argument. It failed with
`MODULE_NOT_FOUND` on `…/cli`, not on `…/cli/doctor.mjs`. It looked exactly like the red it was supposed
to be and was a red about the invocation. Found only when the same command failed *after* the
implementation landed. Two consequences: the transcript above is a re-run with the correct invocation,
and [`../verify/tests.sh`](../verify/tests.sh) now carries the working spelling with the reason beside it.
A red for the wrong reason is the same defect class as a green for no reason — it just costs less.

**One more fail-open, found while writing the recipe rather than after.** `node --test` given a glob that
matches nothing exits `0` — measured, not assumed:

```
$ node --test "cli/**/*.nomatch.mjs" ; echo $?
0
```

So `tests.sh` counts the files first and exits `2` on zero, and the `find` that counts and the glob that
runs deliberately cover the same set: a recursive count beside a non-recursive glob would let a test in a
subdirectory be counted and never run.

**Proposal 0004's payoff, demonstrated.** Two recipes were added to the manifest and CI runs four:

```
$ git diff --stat -- .github/workflows/verify.yml
(no output — the workflow was not touched)
```

## Also swept, and one of them is not this session's doing

Every document claiming `doctor` was owed by "the second milestone-2 session" was corrected, and the two
notices proposal `0002` said must not outlive `doctor` were closed — the constitution's thesis 4 now names
both provenance forms (`5a49a98`, `e2cde72`), so the machine enforces something the constitution states,
which is the only order those two are allowed to be in. The `rituals` ambiguity in `spec/slots.md` was
likewise settled by the maintainer and is recorded as *resolved* rather than deleted, because how a
disagreement was resolved — the schema deferred, the human legislated — is the part worth keeping.

**The gate map said the agent identity did not exist.** It had existed for several hours: `230ed2e` brought
it live and updated `tools/README.md` and its handoff, not [`../gate-map.md`](../gate-map.md) or
[`../memory/agent-activity-is-attributable.md`](../memory/agent-activity-is-attributable.md). Both now say
what is true. Worth naming because of where it was found: inside the milestone whose subject is claims
drift, by **grepping by hand**, and because the lint this milestone shipped **cannot catch it** — "the App
does not exist" is prose about a fact outside the tree entirely. That is the honest boundary of the
machinery, and it is narrower than "workspace claims are linted".

## What the pre-commit checkpoint found, because it is the most useful part of this handoff

Nine required adjustments, **five of them defects in `doctor` itself** — in the session whose new memory
entry is titled *a checker must refuse what it cannot check*. Recorded in full rather than summarised,
because the pattern across them is one thing: every defect was at a **boundary the happy path never
crosses**.

- **A manifest could declare a Workspace Definition version that has never shipped and validate green.**
  Nothing read `portulan.spec`. `spec/README.md` said the version is what "the engine uses to decide
  whether a migration is needed" and the only engine machinery shipped ignored it entirely. Now the
  version lives in the schema's `$id` (a machine fact belongs in an identifier, not in a title somebody
  will reword), and a manifest naming a MAJOR or a MINOR this validator does not implement is refused —
  exit `2`, because "I do not implement the contract you name" is not a verdict about the workspace.
- **`additionalProperties: false` with no sibling `properties` was silently a no-op.** In 2020-12 that
  form forbids *every* property. The shipped schema never uses it, but the subset declares the keyword
  supported, so a supported spelling meant the opposite of what it said. The exact failure the entry
  forbids, inside the change that wrote the entry.
- **The gate map's claim was extracted inside the `tree` branch**, so a workspace without a tree had that
  claim *dropped* — while the paragraph in `spec/slots.md` immediately above promised such claims are
  "counted and reported unverifiable, never skipped silently". The promise and the contradiction were
  written in the same hour.
- **An unguarded read turned a red into a `2`.** With `tree` declared and the gates file missing,
  `doctor` had already found and recorded the paths failure — then crashed reading the same file, and
  reported "could not run". A verdict traded away by an exception, which is the mirror image of the
  laundering the exit-code contract exists to prevent.
- **The provenance parser took the last matching token.** A correct `form=link` record whose annotation
  prose mentioned `` `form=sealed` `` in a sentence went red. The template *invites* annotation prose, so
  the trap was set by our own instruction. First-wins now, with the reserved-syntax limit stated next to
  the invitation.

The other four were claims false against the tree in this session's own prose: a fixture miscount
repeated in two files (ten bad manifests, not eleven), a justification resting on two proposals' states
that were both wrong (`0003` is pending, `0004` post-dates the mandate), a stack row saying two recipes
need `node` when three do and the next paragraph named all three, and a milestone Status column still
saying session 2 was *owed* in the same commit that delivered it.

Every fix carries a test. The suite went 59 → 68, which is the honest measure of how much of this the
suite was not catching.

## What the milestone-close checkpoint found

**CLOSE**, on every clause the build is permitted to demonstrate — reached by forcing each check red
before believing any green, which is the right method and is not what this session had done for all of
them. One finding is carried debt rather than a defect, and it is the sharpest thing anyone said about
this design:

**Delete the single line `"tree": "../"` from customer zero's manifest, drift a repo card, and `doctor`
reports GREEN, exit 0, "10 unverifiable".** The whole claims-lint class degrades to notes on a one-line
edit. The opt-out is loud and PR-visible, and it is the same shape as the rest of the enforcement fabric —
declaring is what enforces — so it did not block the close. But the one thing review is worst at noticing
is a line that was *removed*. Drafted as
[proposal `0005`](../proposals/0005-a-repository-workspace-must-declare-its-tree.md): a `repository`
workspace must declare `tree`, since it is the one kind with no honest reason to omit it. Not applied —
it is a MAJOR bump for one check, which is a trade only the maintainer should make, and the honest
alternative is riding along with whatever forces a MAJOR at milestone 4.

The close is also explicit that **the pilot clause is Marius's**, and names what he is being asked: either
the seam-safe verdict of running `doctor` against the pilot in his own context (GREEN/RED/could-not-run
plus counts, nothing more), or an amendment rescoping the clause in his own hand. The likely honest
outcome is worth anticipating — the pilot predates the spec, so if it has no manifest yet the run is exit
1 by design, and the truthful disposition is "not yet onboarded" rather than a failure.

## Open questions

1. **Nothing tests the other three recipes.** `docs.sh`, `json.sh` and `tests.sh` are still verified by
   being run. Both defects ever found in them were found by a human and a reviewer. A defect in `docs.sh`
   today looks exactly like a green run.
2. **`type` is self-declared.** A rule labelled `decision` walks past the provenance check. Closing it
   means inferring type from content (guesswork) or extending the mandate (the maintainer's to legislate).
3. **The gate-map lint sees the tree, never the platform.** It matches a claimed status-check name against
   job ids in `.github/workflows/`. Whether branch protection actually requires that context, and the
   app-id pin, are API facts no recipe here is allowed to fetch.
4. **The schema has now met two instances.** The second produced a schema change within an hour of being
   written. A third differently-shaped one — the portfolio workspace at milestone 6 — should be expected
   to produce another; `spec/` changing then is the milestone working, not slipping.
5. **`requires` is still unchecked**, carried forward unchanged: a recipe quietly needing an undeclared
   tool passes. The honest fix is executing recipes — the Stop-gate runner, milestone 4.
6. **`CODEOWNERS` is still absent**, carried forward from the platform-floor handoff. Nothing requires a
   path-specific human on any file, including the constitution.

## Next action

The milestone-close checkpoint, in a fresh context, against the criterion in
[`../../docs/plan.md`](../../docs/plan.md) — including an explicit disposition for the criterion's
*"(and, privately, the pilot)"* clause, which is the maintainer's and not this build's to run. Then
milestone 3.

## Recoverability

Documentation, one new script and its tests, one demo workspace, two added verify recipes, and one
additive schema key. Nothing outward was taken and no repository setting was changed. All four recipes
are green, so the tree can be committed or discarded whole. The push, the pull request, and the merge are
Gated and are the maintainer's.
