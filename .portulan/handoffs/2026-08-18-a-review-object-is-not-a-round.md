# Handoff — a review object is not a round

**Post-M7 hardening, session 22. Full lane.** No milestone row moves. Closes
[#286](https://github.com/sleepy-panda-works/portulan/issues/286). Suite **1706**, thirteen recipes
green. Implementer Opus 5, identity line checked at boot before any file was written — the check the
previous session failed, and the reason two merged pull requests carry no valid pre-commit checkpoint.

## The defect, and why it was not the one the issue described

`copilot-reviewed` reported **green** over a review whose entire body read *"Copilot encountered an
error and was unable to review this pull request"*, and the derived verdict then submitted an
**APPROVED** asserting that round *"raised no inline comment and no suppressed low-confidence note"*.
On [#283](https://github.com/sleepy-panda-works/portulan/pull/283) that approval was submitted
**4m36s before** the only genuine round arrived, so it cannot have been derived from it. The real round
then found nothing, which made the sentence true by coincidence — the worst available outcome, because
nothing on that pull request now distinguishes an earned approval from an unearned one.

The mechanism the issue named is correct: `copilot-review.yml:354` establishes that a review OBJECT
exists — right login, right head, not dismissed — and never that a judgement happened. **Both repairs it
proposed are refuted by measurement**, which is the same shape as the previous session's batch, one level
up.

**Instrument:** every review by a login matching `/copilot/i` on pull requests 230-288, read with
`gh api repos/.../pulls/N/reviews --paginate`; 129 bodies with content. A census over that window, not a
sample.

- **Arm 2 — require the coverage line *"Copilot reviewed N out of M changed files"* — reds three genuine
  rounds.** #246, #262 and #263 open `## Pull request overview`, summarise the diff, and never announce
  coverage. A positive signal that 3 in 129 real rounds do not carry is a false red, not a rail.
- **Arm 1 keyed on the body CONTAINING *"unable to review"* reds a genuine round too, and this
  repository mints that case itself.** #287's round quotes the phrase out of `docs/plan.md` while
  carrying the coverage line. The phrase now lives in the workflow, the gate map, the memory record and
  the plan, so a body-contains test would red this repository against its own writing about the defect.
  It is the trap `workflow-filters.mjs` already pins for the notes matcher, arriving one channel over.

**The maintainer ruled for a third, composed arm** on those measurements rather than choosing between
the two as written.

**One figure in this session's own planning was wrong, and it failed in the instructive direction.** The
census grep tested the error phrase before the coverage clause, so it counted #287's genuine round as an
error notice and reported four notices where there are **three** (#282 twice, #283 once). The measurement
committed arm 1's trap in the same breath as the finding that the trap exists. Caught at the session-open
checkpoint, adjustment 1.

## What the fix is

The matched review's body is classified before it counts as a round. `round` — a structural announcement
(`<summary>` or a column-0 heading naming an overview, review details or an approval) or the coverage
line, tested **outside fenced code blocks** on the same toggle the notes matcher uses. `refused` — no
round evidence **and** the body's **first non-blank line** says the reviewer was unable to review, so a
later quotation cannot reach it. `unrecognised` — neither.

- `round` → the gate opens, as before.
- `refused` → **does not satisfy the check.** The wait continues on the same budget; on #283's real
  timing the genuine round arrives 4m36s later and the next poll greens on it. At expiry the check reds
  with its own branch, because the four request-state branches answer *was a round asked for* and here
  one was asked for and answered with a refusal.
- `unrecognised` → greens the check and carries **no verdict**, which is the disposition `unparsable`
  already has for the notes channel. Chosen over a red so a vendor rewording cannot hold every pull
  request until somebody edits a matcher. **The residual is stated rather than left to be found**, here
  and in `gate-map.md`: if Copilot rewords its *error* notice specifically, the check greens again on a
  review that judged nothing, and the tell is the missing verdict plus the job summary.

The verdict step gets the same treatment: `round_state` rides to it, its guard is now **positive** —
approve only on a state it documents, rather than naming the bad ones and letting an unknown value
through — and it re-applies the **byte-identical** matcher. The repetition is the mechanism: the fixture
binder refuses when one anchor covers two distinct programs, so the day somebody edits one site and not
the other, `workflow-filters` reds instead of the two quietly disagreeing about what a round is. The
approval body now says what established that a round occurred, not only what it found.

## The gate was watched failing

A gate nobody has watched fail is a gate nobody has watched work, so both halves were forced.

**Fixture level** — the two matchers are lifted out of the parsed `run:` scalars by
`.portulan/verify/workflow-filters.mjs` and run against bodies measured off this repository. The
instrument went to **exit 2** the moment the matchers landed uncovered (*"a matcher this recipe does not
exercise must not be reported as covered"*), and green at 9 awk programs / 36 fixtures once they were.
Then each guard was degraded in turn and the right fixture redded: dropping the fence toggle, keying
refusal on containment, and **arm 2 exactly as the issue words it — which reds
`round-evidence-overview-without-a-coverage-line` at both sites, 2 of 68 fixtures.**

**Gate level** — the await step's shell was lifted from the parsed block scalar (761 lines, `bash -n`
clean) and replayed against #283's real review sequence with `gh` stubbed and `jq` real; only the three
wait constants were overridden. Replayed against **`fb85498`, before the fix**, with the error notice as
the only review on the head:

```
exit=0 · round=green · review_id=2001 (the error notice) · notes_state=none
```

which is exactly the input that produced the false APPROVED. Against the fixed workflow, same state:

```
exit=1 · GITHUB_OUTPUT empty
```

so `round == 'green'` is false and the verdict step never runs. Let the genuine round arrive as it did at
05:59:44Z and the step waits through the notice and greens on the round — `review_id=2002`,
`round_state=round`.

An in-tree harness for this file's shell was **not** built, and the supervisor concurred in declining it:
the error notice cannot be produced on demand, so the replay is the honest substitute, recorded here
rather than asserted. The matchers themselves are permanently covered.

## The sweep, with its instrument stated

Proposal `0020`. **Instrument:** in each of the four files under `.github/workflows/`, every site that
can produce a pass — a bare `exit 0` on a success path, or an assignment licensing one — classified as
**content-testing** (inspects the substance carrying the judgement) or **existence-testing** (inspects
only the presence, identity or metadata of an artifact supposed to carry it). 28 `exit 0` sites and 3
assignments across 1866 lines, re-counted independently at the checkpoint.

**One primary instance and one derivative, both in `copilot-review.yml`; no third site.** `verify.yml`
runs each recipe and reads its exit code; `pr-labels.yml` passes on `comm -12` over real label names.
And `librarian.yml` carries **the same class already repaired** — it refuses to read a branch's existence
as evidence a pull request was filed, and says so at length. That is the in-repo precedent this fix
cites.

## Fidelity

Session-open checkpoint: Fable 5, fresh context, **APPROVE-WITH-ADJUSTMENTS**, eight numbered, all
folded. Three changed the design rather than the wording: the verdict must require the **newest** matched
review to classify `round`, or an older round would license an approval over a newer body nobody had read
(2); the `unrecognised` disposition was re-grounded on `unparsable` rather than `unread`, since the two
differ — could-not-fetch against fetched-and-not-understood — and its residual made a stated limit (4);
and the gate-level replay was required as the forcing case rather than fixtures alone (3). The rest swept
carriers the plan had missed: the step name in the Checks UI, and this recipe's own jq-only wording,
weeks stale after the awk half landed.

Pre-commit checkpoint: Fable 5, fresh context, **APPROVE-WITH-ADJUSTMENTS**, three, all folded — and
one was a defect this change introduced rather than a carrier it missed. The first cut let an older
round license the verdict when the newest matched review classified `refused`, on the reasoning that a
notice is readable and contradicts nothing. But the verdict body asserts the round *"is the newest word
on this head"*, and under that exception the sentence is **false** — a positive claim the step has not
established, which is the whole defect of #286 reintroduced one field over by the change closing it. The
rule is now strict: anything newer than the round withholds the verdict. **The check is unaffected** —
`round_ok` is decided independently — so a head that drew a real round is never held red by it; only the
displayed approval waits. Replayed to confirm: round then newer notice gives `round=green` with
`round_state=refused`. The checkpoint also caught that the regenerated handoff index was **unstaged**, so
the staged tree was red while the worktree was green — the third time this session that a check had to be
run against the state being committed rather than the state in front of me.

**A rail fired on this session and was obeyed rather than raised.** The first draft of the memory
amendment took the record to 8777 bytes against an 8 KB per-record cap; `index` and `tests` both redded,
and the record was compressed to 8097 rather than the cap being moved — which is the one repair
`core/operating/memory.md` rules out.

## Where this leaves things

Every figure here was re-measured by the pre-commit checkpoint in its own context rather than read off
this record — thirteen recipes, the census, the byte-identity of the two matcher copies, every fixture
degradation, and both replays.

Thirteen recipes green and suite **1706**, measured on the tree rebased onto `f1a8c11` — the base this
merged from, after the concurrent flip session took `main` fifteen commits further while this was in
review. Not the branch's own earlier figures: the rebase happened first and every number here was
taken again after it. #286 is answered on
all three clauses of its retire-when: the error notice no longer satisfies the check, the verdict no
longer describes a round it has not established, and both are demonstrated by a case that forces them.

**Open, and deliberately not taken here:** the residual above is a real hole with a stated shape rather
than a closed one. If a reworded error notice is ever observed, the fixture goes into
`workflow-filters.mjs` first and the matcher changes second — the rule this file already keeps for the
notes marker.
