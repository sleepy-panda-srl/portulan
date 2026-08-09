# Proposal — a claim about a mechanism is re-derived from the mechanism, like a figure

**Status.** Accepted with amended wording, 2026-08-09 — see **Decision.**

**Pull request:** https://github.com/sleepy-panda-works/portulan/pull/185

_This field said `/184` until the pull request was opened and turned out to be **185** — issues and
pull requests share one number space, so a prediction is only ever a guess. `docs.sh` check 5c asserts
the URL's SHAPE and never that the pull request exists, so it ran green over the wrong number and
always would. [#143](https://github.com/sleepy-panda-works/portulan/issues/143) is the chicken-and-egg
that forces the guess; this is what it costs, measured once._

## Incident

Three arcs. The third happened while this proposal was being written, which is the reason it is worth
filing rather than closing [#133](https://github.com/sleepy-panda-works/portulan/issues/133) as a
one-off.

**[#129](https://github.com/sleepy-panda-works/portulan/pull/129) — six prose defects, zero wrong
counts.** Every figure the code emitted was right, in every drill, on every run. Six *sentences about*
those mechanisms were wrong. **Copilot found five of the six.** Two fresh-context checkpoints, a
twenty-five-shape forced-red drill and eight green recipes found none of them — they attacked
mechanisms, and nobody attacked the claims.

**[#167](https://github.com/sleepy-panda-works/portulan/pull/167) — six more.** Eight rounds, each
authorised past the two-round bound individually. Rounds 1–5 found code; 6, 7 and 8 found a
documentation row, prose, and a test name. Among them *"seventeen `grep` invocations"* — a wrong number
**inside the sentence correcting a wrong universal**, in a pull request whose subject is claims that
outrun their measurement — and *"a 660-line instrument"*, true when
[#68](https://github.com/sleepy-panda-works/portulan/issues/68) was filed and carried in the present
tense ever since, against a file that is **1337 lines** — measured on `.portulan/verify/workflow-filters.mjs`
at `origin/main` on 2026-08-09, not copied.

_Second erratum, and it is the same defect as the first. This sentence said **1211 lines** until Copilot
checked it: the figure came from #133's own 2026-08-07 comment, where it was correct at `415167a` and
has moved since. **A count copied from an issue, in the paragraph of this proposal that quotes the rule
"every claim written from memory or copied from an issue was wrong".** Two errata now, both in the
Incident section, both caught by a reviewer rather than by the author. The document argues better
against itself than for itself, and that is left standing._

**The pattern held without exception across both: every claim written from memory or copied from an
issue was wrong, and every claim measured was right.**

**[#183](https://github.com/sleepy-panda-works/portulan/pull/183) — the third, and it is the one that
decides between the options.** That change shipped a header reading *"The substrate is measured, not
invented."* It was true of the record's **schema** and inverted for the install **layout**: the code
probed `<installPath>/packs` and `<installPath>/.portulan/workspace.json`, which is one of the two
shapes a plugin lands in, and **every plugin this project's own private feed ships is the other one**.
Discovery built to resolve a pack from a feed could not see either plugin on the feed it was built for.
**The suite was green at every point**, because the fixtures encoded the same assumption as the code —
1089 tests at that branch tip, measured at `3a17e48` rather than recalled.

_An earlier draft of this paragraph said "1082 tests". That number was written from session memory, it
appears nowhere in the tree or on the pull request, and the checkpoint measured it wrong — **a figure
from memory, in the decisive paragraph of the proposal arguing that figures from memory are wrong.**
Recorded rather than quietly corrected, because it is the best evidence in this document that the class
is not something other people do._

What matters is **what found it**: a fresh-context pre-commit checkpoint that went and looked at a real
install. Not the suite, not the author, not a reading of the diff.

## The three options, and where the evidence sits now

#133 listed three and said none was obviously right. The record has moved.

**(a) Derive numbers in prose from the code that holds them.** Any number written beside a mechanism
that can produce it becomes generated, the way `memory-index.md` already is. Would have caught
`seventeen`, `660-line` and a stale `100 lines` on #167 — **three of six**; two of six on #129;
**none on #183**, where nothing was a number.

*It keeps earning its place and it is the only mechanical one. It reaches figures, and the dominant
class is sentences.*

**(b) A STRENGTHENING of the pre-commit checkpoint's existing step 3 — not a new step.** This is the
option restated after the checkpoint refuted the drafter's own framing of it, and the correction matters
to what is being ruled on. The first draft said the ritual "does not tell it to re-derive the claims the
diff's own prose makes about the diff's own code". **That is false.** Pre-commit step 3 has read *"Check
every claim the change makes about itself"* since `cea9ca4`, 2026-07-29 — **the day before #133 was
filed**. Adopting the draft's wording as a new instruction would have made a second carrier of step 3's
subject, which is precisely the defect `docs/milestones/m07.md` recorded one milestone ago: *the step
already exists ... adding a second copy would have been the two-carrier defect ... committed inside the
fix for it.*

What step 3 genuinely lacks is narrower, and it is two clauses: **the standard** (re-derive from the
mechanism, and where the claim is about the world, from the world) and **the disqualification** (the
author's reading is not evidence). Estimated on #129 at four of six.

*No longer untested. #167 supplied a hand-run instance — round 7's self-audit checked every claim the
branch added, found three defects nobody had reported, and emptied the code channel, so round 8 found
only a test name. #183 supplied a supervised one, and it produced the most expensive defect either arc
turned up.*

**(c) Do nothing, deliberately.** Every instance was caught before merge, which is the loop working.

*Weaker than it was. #129 cost four rounds past a bound of two; #167 cost six, the last three moving
only prose. And on #183 the loop would **not** have caught it — Copilot reads the diff, and nothing in
that diff was wrong; the world it described was. That is the disjointness this workspace already
recorded between the two channels, and it is an argument against (c) rather than a restatement of it.*

## Recommended — (b), with (a) named as owed rather than bundled

(b) costs nothing to try, is the only one of the three that reaches **sentences**, and now has two
positive instances against none negative. Proposed as **two clauses appended to step 3**, so the pack
keeps one carrier for this rule:

> Re-derive rather than re-read: check a claim about a mechanism **from the mechanism**, and a claim
> about the world — a filesystem layout, a platform behaviour, an install — **from the world**. A
> sentence asserting behaviour is a figure that happens to be spelled in words. **The author's reading
> is not evidence**: the wrong sentence and the code it described were written in the same hour by the
> same context.

(a) is not opposed and is deliberately not bundled: it is a build, it reaches a disjoint set, and
bundling a mechanical rail into a doctrine ruling gets the ruling decided on the build's cost. It wants
its own row.

**What (b) does not claim.** It does not make the class impossible. A checkpoint is read and honoured,
not compiled — `packs/rituals/checkpoints/` cannot rail it, because *ran in a fresh context* is
unobservable at the tool layer, which that pack's own `self-certify-a-checkpoint` gate already records
as `prohibited` with `action: none`. So this adds a **reminder**, and this workspace prefers rails to
reminders. The argument for taking it anyway is that the alternative rail does not exist and would not
reach this class if it did.

## The instance this proposal also fixes

#133's table row 6 was left deliberately unfixed. It is fixed in the same change, and **the correction
is not the one #133 predicted** — which is itself the class.

The claim, in `.portulan/verify/docs.sh`, was *"The sentinel is a byte no path can hold."* #133 proposed
narrowing it to *"this repository treats that byte as unrepresentable in a tracked path."* **Measured,
that is also wrong:** git tracks a filename of any bytes but NUL and `/`, and a file named `a<0x01>b`
commits cleanly. What actually holds is narrower and belongs to the recipe rather than to the
filesystem — the lists that recipe compares are built by `git ls-files` **without** `-z`, and git
C-quotes a control character in that output **regardless of `core.quotePath`**, so the byte arrives as
the printable spelling `"a\001b"` and never as itself. `-z` emits it raw, which is why
`control-chars.sh` could not reuse the sentinel unchanged.

The neighbouring comment is corrected in the same stroke: it cited #68 as *"the rail that would make
such a path impossible in the first place"*, and that is wrong twice over — **#68 is closed**, and the
rail it shipped scans file **contents**, never path names.

## Enforcement

None, and said rather than implied: two clauses appended to step 3 of
`packs/rituals/checkpoints/skills/pre-commit/SKILL.md`, honoured by whoever spawns the checkpoint. That
pack's README already carries why the ritual cannot be compiled. **The standing corpus is unaudited
against this standard** — #167 already showed prose that was true when written and stale when read — so
a defect found in old text after this lands is **arrears, not a regression**
([`../memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)).

## Provenance

`form=link href=https://github.com/sleepy-panda-works/portulan/issues/133` — with the two arcs the issue
names, the 2026-08-07 re-scoring comment on it — posted under the maintainer's account and
self-signed as an agent's backlog-refinement pass, attributed here as it describes itself — and the
#183 instance above.

**Retire when:** two consecutive milestones close with no prose-class defect found after the diff was
written — counted from review threads and checkpoint verdicts, not from recall.

## Decision

**Decision.** The supervising agent (Claude Fable 5) — **accepted as (b) with one amendment to the
wording, 2026-08-09**, under the maintainer's explicit in-session delegation of this ruling. The
amendment: the appended clauses open by *citing* the pre-commit skill's own motto — *"Re-measure rather
than re-read* holds for prose as it does for recipes" — instead of the drafter's *"Re-derive rather than
re-read"*, because that opener would have minted a **second slogan** three lines below step 1's
*"Measured, never derived"*, using *derive* in the opposite valence, in the one file whose header
already carries the rule's verb. The carrier of the final text is
[`../../packs/rituals/checkpoints/skills/pre-commit/SKILL.md`](../../packs/rituals/checkpoints/skills/pre-commit/SKILL.md)
step 3, and this proposal deliberately does not restate it.

**Because:** (b) is the only option that reaches sentences, the dominant class; it has two positive
instances — #167 round 7's hand-run self-audit, and #183's supervised checkpoint — against none
negative; and *"prefer the rail to the reminder"* presupposes a rail on offer, which for this class
there is not. Vision thesis 3's third arm — *"earns its place in the context window"* — is the arm this
rule stands on, and its retirement condition is what keeps that standing honest. **(a) is split out to
its own issue** as the generalisation of
[#93](https://github.com/sleepy-panda-works/portulan/issues/93) — filed as
[#187](https://github.com/sleepy-panda-works/portulan/issues/187) — per this proposal's own argument that
a mechanical rail must be costed as a build rather than smuggled into a doctrine ruling. **The two errata
stand as written**: a record that demonstrated its thesis against its own author is evidence, and
scrubbing it would replace a demonstrated claim with an asserted one — the precedent is
`docs/milestones/m07.md`'s demonstration count, recorded rather than tidied away.
