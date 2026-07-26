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

The close is also explicit that **the pilot clause is Marius's**. It was checked the same day, and the
anticipated outcome is what happened: **the pilot carries no workspace manifest at all.** Searched rather
than assumed — no `workspace.json` anywhere beneath it, at any depth — which is consistent with the record,
since extracting that workspace was a milestone-1 client-half deliverable and milestone 1 closed without
the client half. So there is nothing for `doctor` to validate, and the clause cannot be discharged as
written.

**Striking the clause on that evidence was offered and declined**, and the maintainer was right to decline
— because the argument offered was the wrong one. "There is nothing there to validate" is narrowing a
criterion to fit what was built, which is precisely the failure the milestone-1 amendment warns about.

**The clause was struck later the same day on a different and much stronger argument, and the milestone
closed.** Asked plainly *"what private pilot are you asking for?"*, the honest answer turned out to be:
one the governing document had already de-gated. The private context's milestone-1 footnote, amended
2026-07-25, says the client-rooted work remaining there **"neither gates any public milestone."**
_(An earlier draft of this paragraph called that work "optional" as well. It is not — a residual check
there is a standing task in its own context. **Non-gating** is the true claim and the only one the strike
rests on; caught at the strike audit.)_ This row gated one. It had never been reconciled, and — the part worth keeping — *nothing
could have reconciled it*, because that document is outside the repository by design and no check here
can read it.

The clause also carried both defects the milestone-1 amendment existed to remove: a criterion no build
session could execute under our own rules, so it structurally guaranteed a close-by-assertion; and a
public milestone made dependent on the predecessor framework as an input, which is the weaker posture.
Removed in one row, left standing in the next.

Generalised so it cannot recur, rather than fixed once:
[`../memory/a-public-criterion-must-be-demonstrable-from-this-repo.md`](../memory/a-public-criterion-must-be-demonstrable-from-this-repo.md).
It states plainly that it cannot be a rail — the same boundary that let the gate map claim the agent
identity did not exist for hours after it did. Prose about a fact outside the tree is invisible to every
check this repository has.

## Open questions

1. **Nothing tests the recipes themselves — and this stopped being hypothetical during the review.** A
   Copilot review on [PR #15](https://github.com/sleepy-panda-works/portulan/pull/15) found two more
   exit-code defects, both in the recipes this session added and both of the same shape as the three
   before them. `doctor.sh` passed a missing validator through as exit `1` — a red verdict about two
   workspaces nothing had looked at — one dependency over from the `node` guard written to stop exactly
   that. And `tests.sh` piped `find` into `wc -l` without checking `find`, where the dangerous case is a
   **partial** failure rather than a total one: one unreadable subdirectory and the count comes back
   plausible-but-short, so the suite runs a subset and reports on the whole. Both demonstrated, both now
   exit `2`. A second Copilot pass then found two more, both inside `doctor` itself: `compileSchema`
   checked a keyword's *name* and never its *value*, so `pattern: "["` or `enum: "repository"` reached
   instance validation and surfaced as a raw `SyntaxError`/`TypeError` — exit 2, "unanticipated failure",
   naming neither the keyword nor where it lived, from a defect squarely in the schema; and an unguarded
   read of each memory record turned a workspace defect into exit 2, **discarding every finding the run
   had already made**. That is the identical shape the pre-commit checkpoint found in the gates file, which
   this session fixed *there and nowhere else* — so sweeping the rest of the file for it found a third: an
   unreadable repo card was `continue`d, silently dropping every claim it makes.
   **Seven defects of this class in four days, every one in scaffolding rather than in a check.**
   A recipe harness is the obvious answer and it is not free — `tests.sh` cannot be run from inside the
   suite it runs — so it is named here rather than improvised at a milestone close.
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

## Both pending proposals were decided during the review, and the argument came from elsewhere

The maintainer commissioned a fresh-context Fable 5 to review `0003` and `0005` and posted its
recommendation as [`portulan-agent[bot]` on the pull request](https://github.com/sleepy-panda-works/portulan/pull/15#issuecomment-5078534991).
Both **accepted**. Worth recording that on `0005` the recommendation **reversed this session's own
conclusion, and was right to**: the proposal argued a MAJOR bump for one check was a poor trade and
should ride milestone 4's. It priced that against the wrong date. Two manifests exist, one already
declares `tree` and the other is a `demo` and exempt — so the first migration is a version bump and a
note, **zero manifest edits**, and it will never be cheaper than today. Deferring also carries a
fail-open in gate machinery across the milestone-3 public flip, which is when strangers first probe the
spec.

Neither is applied here. `0005` **cannot** be applied in this pull request without destroying its own
argument: 1.1 has to land on `main` first, or the change reads 1.0 → 2.0 and the "first migration
exercised at zero blast radius" is a migration between a version nobody ever had and one nobody has yet.
Both land in the follow-up immediately after merge, together, which also keeps them out of a pull request
that has already passed all three supervised checkpoints.

## Next action

**Milestone 2 is closed** — the criterion amended (this row only) and every remaining clause demonstrated
rather than asserted. **Milestone 3: plugin & public marketplace.**

Two carried items belong to whoever opens it: `CODEOWNERS`, wanted before the public flip and absent since
the platform-floor session, and the recipe-test harness named in open question 1 — seven-plus defects of
one class in four days is enough evidence that the recipes need what `doctor` now has.

The highest-value thing available is not in this repository. Tipar and one personal project now carry real
Portulan workspaces, and **nobody has yet used one on real work.** That will say more about what `core/`
gets wrong than a fifth instance would.

## Recoverability

Documentation, one new script and its tests, one demo workspace, two added verify recipes, and one
additive schema key. Nothing outward was taken and no repository setting was changed. All four recipes
are green, so the tree can be committed or discarded whole. The push, the pull request, and the merge are
Gated and are the maintainer's.
