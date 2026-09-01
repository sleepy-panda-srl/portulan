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

## And a second opinion on the diff found the same class again, one level down

The pre-commit round hardened `verifyShape` against hand-written records and wrote a comment saying two
rules were the whole of it. **A second fresh context then produced six counterexamples that pass both.**

**A present-degenerate value is neither absent nor a branch.** `source.commit: null` renders
`| Commit | \`null\` |`; `""` renders an empty cell; `captured: "   "` renders whitespace. None is
`undefined` or `NaN`, so the derived probe sees a clean page, and none is a boolean, so the by-name
checks miss them. The rule is **three** now, and the third is structural rather than a field list — no
leaf may be `null`, no string leaf may be blank — because a hand-written roster of "fields that must be
non-empty" is this file's own defect at a fourth depth. `--date` was the one route in through the front
door and is validated at parse. A leftover `?? "<commit>"` survived the round that removed the fallbacks,
in the limitations block whose whole subject is claims a capture never made.

**And the totality test deleted leaves without ever nulling or blanking them** — which is structurally
why the class survived a round that fixed the identical claim once already. It does both now.

**The republish path CRASHED, and the comment above it claimed it passed.** `cli/release-eval.mjs`
exists in no tag before `v0.1.3` — `git ls-tree v0.1.1 --name-only cli/release-eval.mjs` is empty for all
three — so on the manual-dispatch path the workflow documents *for exactly those tags*, running the
grader out of the tagged checkout hits `MODULE_NOT_FOUND`, exits 1 under `set -euo pipefail`, and blocks
a publish it was meant to wave through. Reproduced on a real `git archive v0.1.1`. **That is the fifth
appearance of the defect this session's own recipe guards against by name** — node on a missing file
exits 1 and reads as a finding — and the recipe had the guard while the workflow step did not. The
grader is checked out separately from the workflow's own ref now, so it is always current and the subject
is always the tag; the version carve-out stays in one carrier instead of being re-derived in shell.

**`changelogVersions` had two latent holes.** A column-0 fenced example of a cut would enter the released
set as a phantom release, and a `## 0.1.3-rc.1` heading was dropped **silently** — deciding by omission
exactly what `compareVersions` refuses out loud two functions away. Fences are skipped and a
version-shaped heading that is not `X.Y.Z` now refuses.

**Two rounds, two fresh contexts, and the same class both times.** The first found it in the record
layer; the second found it in the *values inside a record that passes*. Neither is produced by reading a
diff, and the second was found in a check that had just been hardened and had just written down what it
now covered.

## Copilot's two rounds, and both found this change's own repairs

**Round 1 — a commit field that names nothing.** `verifyShape` carried three rules by then, each added by
an earlier reviewer, and none of them asked whether `source.commit` *names* a commit. Verified before
fixing: `"banana"` passed, `"HEAD"` passed — the worse of the two, because it reads like an answer — and
so did an abbreviated `a642d55`. **Rule 3 is a floor under every leaf and a name check for none**, so a
present, non-blank, perfectly-rendering string sailed through it. Rules 3 and 4 are different questions
about the same leaf: *is anything there*, and *is it the kind of thing it claims to be*. Full object
names only now, 40 hex or 64 for a SHA-256 repository, abbreviations refused because nothing here writes
one. The docblock said *three rules* and says four, with the note that each after the first came from a
further round of the same class — a docblock claiming totality is what the two rounds before it caught
this file doing.

**Round 2 — the grader checkout fetched the tree it exists to avoid, inside its own repair.**
`actions/checkout` defaults `ref` to *"the reference or SHA for that event"*, which on
`release: published` is the **tag**. The second checkout added one commit earlier — to stop the grader
being run out of a tagged tree that has no `cli/release-eval.mjs` — carried no `ref`, so it fetched
exactly that tree and brought `MODULE_NOT_FOUND` back on the dispatch path the workflow documents for
those tags. The ref is `github.event.repository.default_branch` now, named rather than
`github.workflow_sha` because on `release: published` GitHub runs the workflow file *from* the default
branch, so there that genuinely is this workflow's own ref — and on a dispatch from an older ref, a
current grader is the better answer anyway.

**Twice at one step is this repository's threshold for stopping the patching**
([`../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)),
so round 2 built a rail: `cli/checkout-refs.live.test.mjs` — *a workflow that checks out more than once
names the ref of every checkout after the first.* **The narrowness was measured before the rule was
written, because the obvious rule is wrong:** five of the seven checkouts in `.github/workflows/` carry
no `ref` and **every one of them is correct**, so a blanket rule would red five right answers to expose
one wrong one, which is how a recipe gets switched off. Checking out *twice* is a statement that two
different trees are wanted, so the second cannot inherit a default whose value depends on which event
fired. Verified both ways — green on the fixed tree, red when the `ref:` is deleted. What it does **not**
establish is written into it: an explicit tag on a grader would pass and be the same bug; it establishes
that the choice was made rather than inherited.

**The pattern across both rounds is the one this session keeps producing.** Round 1 found a rule that was
a floor and not a name check; round 2 found a repair that reintroduced its own defect. Neither is what
reading a diff produces, and both were confirmed by running the case before the fix rather than from the
description.

### Round 3 raised no thread and its two suppressed notes were both right

**A padded date passed a check that had normalised its own input.** `ISO_DATE.test(captured.trim())`
accepted `"2026-09-01 "`, and the renderer then printed the padding into the table — a value that passes
a format check and violates the format it was checked against. **A check that normalises its input is
checking something other than what will be published.** The `.trim()` is gone.

**And the leaf sweep skipped arrays, in the test whose name claims every leaf path.** `!Array.isArray(v)`
treated an array as a leaf, so `recipes[].id`, `recipes[].exit`, `excluded[].id` and `excluded[].why` —
four fields the renderer reads — were **never swept**. Measured: 14 leaves walked against 16 that exist.
**That is the third time in this change a totality claim outran the body under it, and the second time in
this very function**, which was itself written to replace a test whose title claimed totality over six
hand-picked drops. The two sweeps in the file were also two copies of one walk, one of them wrong; they
share a single helper now, so they cannot drift apart again the way they just did.

Both were **suppressed notes rather than threads**, so under the loop's rule 3 they blocked nothing and
would ordinarily have earned one batched reply and no push. They are fixed because the maintainer granted
the loop past its bound with *"address feedback until it's empty"*.

## The bound was EXCEEDED and GRANTED, and rebasing made a record of this session's own class

**The maintainer granted the loop past rule 4's bound** — *"address feedback until it's empty"* — and it
is recorded as a **grant**, never as a bound that was met. A waived rule written down as a met one is how
a bound stops meaning anything, and the sibling session 7b recorded its own overrun as **EXCEEDED, not
granted** on the same day; the two entries must not read alike when they are not.

**And the rebase onto `main` falsified two of this handoff's own sentences.** They said the one-carrier
rule could not be registered because the A/B aggregate stood in three live prose carriers. Session 7b
merged first and fixed exactly that — deriving the figure into the byte-compared register and registering
`ab-baseline-figures` against `evals/ab/baseline.md`. Re-measured after the rebase: the aggregate now
appears in **one** live file, the carrier. The sentences are corrected above rather than left standing,
because a record that keeps asserting what a sibling has since repaired is the stale-carrier defect this
whole session is about — met here in the session's own account of itself.

**Both `docs/plan.md` conflicts were the append point conflicting by construction**, and both were
resolved by keeping both entries and **regenerating** the indexes rather than hand-merging them.

## What is owed, and to whom

- **RULED the same day: the clause waits for a real cut.** Put to him rather than left for a
  milestone-close reviewer to find, and answered — *"it waits for a real cut; a new release will be done
  after M8 is finished."* So the ninth clause is **not** closable on the mechanism, and the sequence is
  fixed: the last remaining clause lands, then `0.1.3` is cut carrying `evals/releases/0.1.3.{json,md}`,
  then the row closes. **The cut is the last act of the milestone rather than the first act after it** —
  which is what puts the record in the tagged tree the close reads. `docs/milestones/m08.md` carries the
  ruling and what a cut mechanically is, measured from `b410c020` rather than described.
- **The one-carrier rule was not registrable when this session measured it, and it is registered now —
  by the sibling session, not by this one.** The finding here was that `rule-carriers.json`'s dead-tell
  audit reds on a tell matching nothing, so a fresh rule cannot carry invented spellings; and that the
  natural tell already failed, because the A/B figures stood in **three live prose carriers** outside the
  record layer, so registering would have red on merged, reviewed prose from two earlier sessions. It was
  filed rather than repaired inside a change about releases.
  **Session 7b took it and went further than the brief:** the three sentences now cite a figure
  `ab-run.mjs` *derives* into the byte-compared register — the carrier had held per-cell counts only, so a
  citation would have sent a reader to sum four rows — and `ab-baseline-figures` is registered with
  `evals/ab/baseline.md` as its carrier. **Re-measured on the rebased tree: `6/20` now appears in exactly
  one live file, the carrier.** _(This bullet asserted the unregistered state as current until the rebase
  onto `main`; a record that keeps asserting what a sibling has since fixed is the stale-carrier defect
  this session spent itself on, so it is corrected here rather than left standing.)_
- **`acceptedUnder.reRunWhen` is still NOT discharged.** `ab --stop-probe --operator-env isolated`
  refuses at exit 2 here: none of `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`
  is set, and an isolated `HOME` reaches no stored login. **The refusal is recorded, and a recorded
  refusal is not a discharge.** This handoff is its carrier. Note the probe's own caveat: it reads those
  three variables and nothing else, and this host has `ANTHROPIC_BASE_URL` set — a channel it cannot see.
- **RULED 2026-09-01: the record SHIPS.** `evals/releases/` is in `package.json`'s `files`. The reach was
  the implementer's choice and the tree marked it open to him three times; he took it, after a second
  opinion adjudicated adversarially against both positions and returned SHIP-WITH-CHANGES. **A
  measurement settled it, not an argument:** a record written into the *unpacked tarball* is graded
  `exit 0` by `cli/release-eval.mjs --tagged`, which already ships — so the artifact carries both the
  claim and the tool that checks it, and the objection that an npm consumer can run no recipe was true
  and beside the point. Consistency runs the same way: without a shipped record, the grader is itself
  the ships-but-cannot-run class a concurrent change is purging. Three repairs came with it — every
  register now says **whose build it measures** (a consumer reading it inside `node_modules` would
  otherwise take it for a claim about their tree); `evals/releases/README.md`'s *"empty of records"* was
  a standing claim that would have shipped **frozen false beside the record it denied**; and both landed
  before the first record exists, since a later renderer change forces a re-render of every register
  already cut. Growth is accepted knowingly: ~8KB per release, monotonic, against a 749KB payload.
  _(What follows is the position it replaced, kept because the reasoning is the record.)_
- **The record's reach WAS the implementer's choice and was NOT a ruling**, which is what a first draft
  called it. `package.json`'s `files` ships neither `evals/` nor `CHANGELOG.md`, so a release record is
  carried by the **tagged tree** and not by the npm payload. **Measured before leaving it there:** a
  plugin adopter already receives the whole tree, so only the npm tarball is a subset; shipping
  `evals/releases/` alone would send a document whose central citation — `evals/ab/baseline.md` — is not
  in the payload, in a record whose whole design is to cite rather than restate; shipping all of `evals/`
  is 376KB of corpora about this repository's own build; and an npm consumer cannot run any recipe a
  record reports on, because `.portulan/` does not ship either. It stays **open to the maintainer** —
  adding `evals/releases/` to `files` is one line — but the honest instrument for supply-chain provenance
  is a signed attestation rather than a Markdown file, and npm freezes content per version.
- **`cli/ab-run.mjs` carries the identical false claim and the identical hole**, inherited because this
  module adopted its shape: `snap.agent ?? "<agent>"` and — worse — `t.verdict ?? "could-not-attribute"`,
  where a missing verdict renders as that specific verdict. Not repaired here: it belongs to the A/B
  clause and its capture is a committed record of events that do not repeat. Filed as its own task.

## One principle, two branches — for whoever merges second

A concurrent change removes `cli/ab.mjs`, `cli/ab-run.mjs` and `cli/ab-grade.mjs` from the payload; this
one adds `evals/releases/` to it. They look opposed and are **one rule**: *the tarball carries what can
run inside it, plus the release's own record.* The `ab*` modules go because they read `evals/ab/`, which
stays repository-only, and because none is one of the eight dispatched subcommands — they ship and can
never run. The record comes because `cli/release-eval.mjs --tagged` grades it **in place**, measured on a
real `npm pack`. Had the record stayed out, that grader would have been the same ships-but-cannot-run
class its sibling branch is purging, which is how the two changes check each other.

The two edits touch the same six lines of `package.json`'s `files`. A second opinion ran `git merge-file`
over base/ours/theirs: **exit 0, both land, no conflict.** Either order is fine; whichever merges second
should carry this paragraph forward rather than restating half of it, and both must land **before the
`0.1.3` cut** — the first tarball that can carry a record should be the first one that does.
