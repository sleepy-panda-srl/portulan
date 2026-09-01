# 2026-09-01 — A release carries an eval result: the mechanism, and the instance it is owed

Milestone 8, session 7. Row 8's **ninth** clause, added by the maintainer's ruling of 2026-08-24. The
mechanism landed; the instance did not, because no release has been cut since the clause acquired an
owner. The row does not close and the clause is recorded **half-vouched** — the row's own word, already
carried by clause (d) for exactly this shape.

## What was ruled, and it was the session's actual work

The 2026-08-24 amendment named three things it did not settle. They are settled here:

- **What an eval result consists of** — the verdict every recipe the workspace **yields** returned,
  measured by running them at a named commit, plus the A/B baseline's **identity** and never its figures.
  There is no *eval* subset of the recipe set: `cli/recipe-set.mjs` has no such category, so an
  "eval recipes only" record would have needed a hand-listed roster, which is the defect the record
  exists to avoid. The session-open checkpoint caught that word in the plan.
- **Where it is carried** — one pair per version under `evals/releases/`, cited and never restated.
- **Rail or person — both**, split by reach. The plan answered *"a rail"* flat and that claimed a reach
  it has not got: no in-tree check sees a tag or a release body. The rail grades the tree on every
  commit; `release-eval --tagged` grades the tag's own checkout from
  `.github/workflows/publish-github-packages.yml`, before publishing; the maintainer owns the release
  body, and `gate-map.md` now carries that half beside the tier it belongs to.

## Two designs a fresh context reversed before a line was written

**Cut detection off `CHANGELOG.md`'s top heading never fires.** The cut commit re-seeds `## Unreleased`
*above* the version it just wrote — `b410c020`, and that file's own header requires it, so the tagged
tree contains its own entry. The top heading is `Unreleased` on every commit including the cut. A rail
keyed to it would have reported *no cut in this tree* on precisely the tree it was built to grade. Found
by measuring the last cut rather than by reading the rule.

**A rail keyed to `package.json`'s version alone grades one record at a time.** The moment `0.1.4` is
declared, `0.1.3`'s record can be deleted and nothing is looking at it — a record layer graded one record
at a time is not a graded record layer. The subject is now every version the changelog records from
`0.1.3` onward, permanently, and the set is graded in **both** directions: a record for a release that was
never cut reds as well, because it sits in the tree looking exactly like evidence.

The second was the second opinion's, in a context that had seen neither the plan being drafted nor the
first reversal. Two fresh readers, two different findings, neither of which the author had.

## The finding: the green is a state, and the module says so on its own face

`release-eval --verify` today prints *no release from `0.1.3` onward has been cut yet*. That is the
correct answer and it is **not a measurement of anything**. A clause about releases, satisfied while zero
governed releases exist, is true the way *a baseline names its host* was true of an empty string — this
milestone's own name for the shape. So the arm that matters is exercised by the **drill**: it moves
`FIRST_GOVERNED_VERSION` to `0.1.2`, which makes an already-cut release governed, and requires the rail
to fire on the missing record. It fired — exit 1, on the tell. A drill is not a release, and the
distinction is written wherever the green is.

## The pre-commit checkpoint broke the rail four ways, and that is the session's real finding

**REQUEST-CHANGES.** A fresh context attacked the record layer rather than the code, and every one of
these was green before it did:

- **`--tagged` returned green in every reachable variant of the one case three carriers said it existed
  for.** The workflow read the version from the tagged `package.json` and passed *that* — but in the
  scenario the step is for, a tag created from a tree whose accumulator was never renamed, `package.json`
  still declares the PREVIOUS version. So the step asked about `0.1.2`, was told it predates the clause,
  and published. It takes the **tag** now, and a tag whose version the payload does not declare is a
  finding rather than a `printf` beside a publish that continues.
- **A red rail could be relocated into `excluded`.** `verifyRecord` required only that the
  self-exclusion be *present*, so moving a failing recipe out of `recipes` and into `excluded` with a
  principled-sounding reason was green — the register printed a smaller denominator and the recipe's own
  headline, *no record shows a rail at a non-zero exit*, was satisfied by not recording it. A verdict
  laundered into the exclusion list reads as rigour. It must now be **exactly** the self-exclusion.
- **Two whole classes of record were ungraded.** A record for a version the clause does not govern was
  invisible — `--capture` refuses to write one, so it could only be hand-written — and the sweep
  enumerated `.json` only, so a fabricated register standing alone was invisible too, which is the half
  a reader actually reads. Everything on disk is graded now, both extensions, governed or not.
- **"Exactly one blind spot — a boolean" was false, and there were three.** `abBaseline.captured` and
  `abBaseline.commit` were read through `??` fallbacks and rendered `<undated>` / `<uncommitted>` —
  placeholders that read like measurements, so the derived probe saw a clean document — and
  `abBaseline.clean: null` was **explicitly permitted by the check whose own message said absence must
  not publish an unmeasured claim**, then rendered `**not clean**`. The renderer supplies no fallback
  now, and every branch-rendering field is checked by name. **The test asserting this had a title
  claiming totality over a body of six hand-picked drops** — the defect it was written against — and now
  walks every leaf path of a valid capture and deletes each in turn.

**A fifth was a false green in the suite.** `--capture refuses a version the clause does not govern`
never reached that refusal: the fixture is not a git repository, `sourceOf()` threw first, and the
assertion's `/predates|could not/` alternation swallowed it. The precondition is checked before any git
read now, and the case asserts the git read did **not** happen.

**The pattern is worth more than any of them.** Three of the four came from attacking the *record layer*
— what a hand-written file could get past the rail — rather than from reading the code, and the fourth
came from mechanically deleting every field the renderer reads. Neither is a review technique that
reading a diff produces.

## What is owed, and to whom

- **Whether row 8 closes on the mechanism or waits for a cut is the maintainer's**, and it is put to him
  in `docs/milestones/m08.md`'s session note rather than left for a milestone-close reviewer to find.
- **The one-carrier rule is NOT registered in `rule-carriers.json`, and the reason is measured.** The
  registry's dead-tell audit reds on a tell matching nothing, so a fresh rule cannot be registered with
  invented spellings. Worse, the natural tell already fails: the A/B figures `6/20` stand in **three live
  prose carriers** — `evals/README.md:52,60` and `evals/ab/arm.md:150` — outside the record layer.
  Registering the rule today would red on merged, reviewed prose from two prior sessions. Reported rather
  than either widened or ignored; filed as its own task.
- **`acceptedUnder.reRunWhen` is still NOT discharged.** `ab --stop-probe --operator-env isolated`
  refuses at exit 2 here: none of `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`
  is set, and an isolated `HOME` reaches no stored login. **The refusal is recorded, and a recorded
  refusal is not a discharge.** This handoff is its carrier. Note the probe's own caveat: it reads those
  three variables and nothing else, and this host has `ANTHROPIC_BASE_URL` set — a channel it cannot see.
- **The record's reach is a ruling, and it is recorded as one.** `package.json`'s `files` ships neither
  `evals/` nor `CHANGELOG.md`, so a release record is carried by the **tagged tree** and not by the npm
  payload. Defensible — a release is a tag — but it was a choice among the three carriers the amendment
  listed, and adding `evals/releases/` to `files` stays available to the maintainer.
- **`cli/ab-run.mjs` carries the identical false claim and the identical hole**, inherited because this
  module adopted its shape: `snap.agent ?? "<agent>"` and — worse — `t.verdict ?? "could-not-attribute"`,
  where a missing verdict renders as that specific verdict. Not repaired here: it belongs to the A/B
  clause and its capture is a committed record of events that do not repeat. Filed as its own task.
