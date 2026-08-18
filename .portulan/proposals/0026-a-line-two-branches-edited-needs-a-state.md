# Proposal 0026 — a line two branches edited needs a state

**Status. PROPOSED, 2026-08-10** — drafted at milestone 7 session 6 on the maintainer's instruction,
after the class it names came within one review of merging a second time. **Three** questions are the
maintainer's and are marked Q1–Q3; the rest is mechanism. _(This said two until review: Q3 was added
when the clearing shape moved, and the count beside the list was not re-read — a number in prose next to
a list nothing derives it from, in the proposal about exactly that.)_

The title is [`0021`](0021-the-suppressed-channel-needs-a-state.md)'s on purpose, and so is the
argument. That proposal's finding was that a low-confidence review note *"had no thread, no Resolve
control and no state, so nothing distinguished answered from ignored"* — and the repair was not to
judge the note but to **give it a state that gates**. This is the same shape one layer down: a line
that landed on `main` while a branch was away, and that the branch also edits, has no state either.
It appears once, as context in a diff, and nothing distinguishes *carried forward* from *reverted*.

## The incident, re-derived from git rather than from anyone's account of it

Row 7's Status cell in `docs/plan.md`. Two commits, thirty-nine minutes apart:

- **`3cf47e9`, 19:00:43+03:00** — merged from [#197](https://github.com/sleepy-panda-srl/portulan/pull/197).
  Its `s5:` clause reads **verify composition — one carrier, four readers, `tools/github` composed;
  D6 done**, and its `Left:` list ends **(b) parity, interview, index rail, four of six demos**.
- **`47bc92b`, 19:40:22+03:00** — merged from [#195](https://github.com/sleepy-panda-srl/portulan/pull/195).
  Its `s5:` clause reads **compose pins `packs` to `plugin.json`'s `skills`**, D6 is gone, and its `Left:`
  list reads **legibility, verify composition, (b) parity's adopter half, interview, index rail, five of
  six demos**.

#195 forked before #197 merged, rebased after it, and resolved the same-line conflict in favour of its
own side. **Three facts were restored to their pre-merge state** — `verify composition` back into
`Left`, `D6 done` deleted, `four of six` back to `five of six` — and none of them was anybody's opinion;
they were simply the older bytes.

**The detail that decides the design: the same edit was also correct.** #195 legitimately refined
`(b) parity` → `(b) parity's **adopter** half`, because it had just landed the bundle half. So this was
not a branch reverting a line. It was a branch **editing one fact on a line and inheriting the stale
version of three others**, because git's unit is the line and the facts are smaller than the line.

`docs/milestones/m07.md` escaped, since #195 never opened that file — which is the only reason the
disagreement was visible at all. One fact, two carriers, and the survivor was the one the milestone
close reads *second*.

**It was presented once and missed rather than hidden.** The moved merge-base put the revert into
#195's own diff as minus-lines carrying `D6 done` and `four of six`, and the review round on that head
generated no comments. A human reading a diff of a 3,000-byte table row does not re-read the row.

**And it came within one review of happening again, in the opposite direction.** On 2026-08-10,
[#206](https://github.com/sleepy-panda-srl/portulan/pull/206) corrected the same cell for D3 while
[#212](https://github.com/sleepy-panda-srl/portulan/pull/212) was open to correct it for D6. The
second was caught only because a person compared the two by hand.

## What already exists, and why none of it fires

- **`0011`, accepted and applied** — a branch must be up to date with `main` before it merges. #195
  *was* up to date; it rebased. The rule prevents merging **from** a stale base and says nothing about
  what a resolution does **on** a fresh one.
- **`docs.sh`'s four `plan` checks** — amendment argument, session note, five-cell parse, 500-byte
  Status budget. Every one is about the cell's **size and shape**; none compares it with another
  carrier, and none could.
- **`0020`** — one carrier, the others cite. It is the right rule and it does not reach this: both
  carriers here are legitimate, the cell being the scoreboard and the milestone file the history.
- **The review loop.** Copilot reads the diff, and *nothing in the diff was wrong* — the branch's line
  was well-formed. What was wrong was its relationship to a commit that is not in the diff.

## The proposal

**A line that landed on `main` after a branch was opened, and that the branch also edits, is surfaced as
a gating item — cleared by an acknowledgement the maintainer resolves, not the author.**

Mechanically, per pull request:

1. **Anchor to something a rebase cannot move.** `T` = the earliest **author date** among the pull
   request's commits, or its `createdAt`, whichever is earlier. Author dates survive rebase-merge — this
   incident proves it, since `47bc92b` carries its 17:11 authorship into `main` — and `createdAt` is not
   a git fact at all.
2. For each path and line range in the head's diff against its current merge-base, find every commit on
   `origin/main` **whose committer date is later than `T`** that touched that range.
3. For each, emit one item: the path, the line range, the landing commit and its subject.
4. **Exit 1** while any item is unacknowledged. **Exit 2** when the comparison cannot be made — a shallow
   clone, an unfetched `main`, no computable diff — because a check that could not look has not
   established that nothing landed. Never 0 on a history it could not read.
5. **An item is posted as a review thread at that `file:line` by the agent identity**, and clears the way
   every other thread on this repository clears: the author replies, and **the maintainer resolves**,
   under the `required_conversation_resolution` already on `main`.

### Why the anchor is the whole design, and the first draft got it wrong

The obvious formulation — *what changed on `main` since the merge-base* — **is silent on this very
incident**, and `0011` is the reason. That proposal requires a branch to be up to date before it merges,
so #195 rebased onto post-#197 `main`; the merge-base then **became** `3cf47e9` or later, the set of
main-side changes since the base went empty, and the intersection with it went empty too. The check
would have exited 0 on the commit that motivates this proposal, and on every future one that obeys
`0011`. **A rail that is structurally green on the workflow this repository mandates is worse than no
rail, because it reports coverage.**

Walked concretely against the incident with the anchor in place: #195's earliest commit is authored
**17:11:01**; `3cf47e9` lands on `main` at **19:00:43** and touches `docs/plan.md` line 67; #195's head
also touches line 67. `19:00:43 > 17:11:01`, so an item is emitted naming `3cf47e9` — **and it keeps
being emitted after any number of rebases**, because neither date moves.

_This is recorded rather than quietly fixed because it is the proposal's own subject: the first draft
substituted "since the merge-base" for #212's "since the branch **forked**", which are the same thing
only when nobody has rebased — and rebasing is the rule here. Caught at the supervisor pass._

### What this deliberately does not claim

It cannot check that the carry-forward is *correct*: the facts are prose, and no rail reads prose. What
it guarantees is that the landing was **given a state** — posted, visible, and blocking until somebody
acts on it. That is precisely what `0021` bought for a suppressed review note, and for the same reason:
*presented once in a diff* is not a state.

**Why the clearing is the maintainer's and not the author's.** An earlier draft had the author clear the
item by naming the commit in the pull-request body, with CI verifying the naming and nothing else. That
is a rubber stamp with extra steps: an agent that has just resolved a conflict in its own favour will
type the sha as readily as it typed the line. `0021`'s **accepted** shape is the one that works and it
is already wired here — a thread, gated by conversation resolution, resolved by the maintainer as part
of the merge decision. Nothing new has to be believed, and no new vocabulary has to be taught.

**The class is file-agnostic; how much of it the rail takes is Q2 and is not settled here.** The Status
cell is where this has bitten, not what it is — any line two branches edit is exposed, and a rail
*defined* as being about one line would be a rule narrower than the thing it names. But reach is a cost
question as well as a principle one, the measurement below is uncomfortable, and this proposal does not
decide it in a sentence here and then re-open it three sections later. _(An earlier draft did exactly
that — it asserted "every file" here while Q2 recommended a scoped set, which is this document's own
subject committed inside it: an edit landing correctly in one place and leaving its neighbour stale.
Found by review.)_

## What was considered and refused

**Deriving the cell's checkable fields.** The demonstration count and the `sN:` session labels are both
derivable — the count from `m07.md`'s pinned list, the labels from the Session log's own M7 entries —
and `cli/index.mjs` already establishes the pattern: generate, then hold by byte comparison. Refused as
the **primary** fix, on the evidence above: #195 restored *three* facts and only one of them was the
count. A derivation covering one fact on a line carrying six leaves five unguarded and creates a second
generated carrier to keep in step. **Named as a possible narrower complement, not as this proposal.**

**A revert detector — red when the branch's bytes equal the pre-merge-base bytes.** Refused, and the
incident is the reason: `47bc92b`'s line equals **neither** side — it restored three facts, edited a
fourth correctly, and rewrote two more besides. A byte-equality test would have been **silent on the
very commit that motivates this proposal.** _(An earlier draft of this paragraph said "Precise, and
it would have fired here", which is false and contradicted the paragraph's own next clause. Struck at
the supervisor pass.)_ It is also blind in the other direction: a deliberate revert produces the same
bytes, so it would need a suppression vocabulary nobody has asked for.

**Blocking the merge on any overlap.** Not refused — put to the maintainer as Q1, because it is a
strictness dial rather than a design error, and the measurement below is what should decide it.

## What it costs, and the contention is not rare

Measured on `main` rather than estimated. **On 2026-08-09 alone: 22 pull requests merged, 33 commits
touched `docs/plan.md`, and 7 of those touched row 7's Status cell — one line, seven times, in one day.**
The cell has been edited on 12 distinct days since 2026-07-24.

So the acknowledgement is not a rare ceremony; on a day like that one it would have fired several times,
and that is the honest cost:

- One acknowledgement per contended line per pull request, and on the busiest file that is **not** a
  once-a-month event.
- CI must fetch `main` rather than the branch alone, and must have a merge-base to reason from.
- **No new vocabulary** — and this line said the opposite until review. The acknowledgement is a review
  thread cleared by conversation resolution, which is the control `main` already requires and every
  session already uses; the cost is the reading and replying, not a convention to teach. _(It read "a new
  heading in the pull-request body", left over from the draft Q3 overturned — **the third time this
  document has left a neighbour stale while correcting something**, which is what it is about.)_
- **A false sense of coverage is the real risk**, and it is why the *does not claim* paragraph above is
  in the proposal rather than in the implementation: a green here means *you were told*, never *you
  carried it forward*.

_**This paragraph's first draft said "measured over the four merges of 2026-08-09, one line qualified",
and every part of that was wrong.** There were 22 merges, not four — the number was carried over from an
earlier session's board sweep, which had used "the four merges" to mean four specific pull requests, and
it was never re-measured against the day it was then attached to. A figure taken from one context and
restated in another, unchecked, inside the proposal about facts that go stale when nobody re-derives
them. Caught by the supervisor pass on this draft, which counted the merges instead of reading the
sentence. It is left visible rather than quietly corrected, because the corrected number is the stronger
argument and the mistake is the proposal's own subject._

## For the maintainer

**Q1 — is the acknowledgement enough, or should an overlap block the merge outright?** The draft takes
the acknowledgement, and the measurement is the argument: **seven edits to one line in one day** means a
hard stop would have fired repeatedly on the file every session must edit, and a rail that stops the
work several times a day gets switched off — this repository's own stated reason for keeping recipes
narrow. The stricter reading is defensible and is his.

**Q2 — repository-wide, or scoped?** This is the question the measurement makes uncomfortable, and it
is put rather than buried. Repo-wide, the trigger fires on **every** line-overlap between a pull request
and a same-window landing, and on 2026-08-09 **52 of the 83 files touched that day were touched more
than once**. Line-level overlap is a subset of that and is unmeasured — the exact figure needs the
branch tips, which rebase-merge does not preserve — so the honest statement is that **the repo-wide
firing rate is bounded above by something large and is not known.** Three ways to take it:

- **Repo-wide as drafted**, and accept that the first week is noisy while the real rate is learned.
- **Scoped to a declared set of contended paths** — `docs/plan.md` and the milestone files to begin —
  with the set in the workspace manifest rather than in the recipe, so widening it is a diff.
- **Repo-wide but advisory** — post the thread, do not gate — for one measured interval, then decide.

The draft recommends the **second**: it is the narrow-rule preference this repository states, the
measured contention is overwhelmingly in those files, and a set that lives in the manifest can grow on
evidence rather than on a guess. The first is what the class deserves in principle and the third is how
to find out; both are his to prefer.

**Q3 — where does the acknowledgement live?** Resolved above in favour of `0021`'s thread shape, and
recorded here because the first draft answered it differently. A commit trailer was the alternative;
note that this repository **rebase-merges** rather than squashing, so a trailer survives — the draft's
earlier claim that the body would outlast a squash was beside the point.

**Provenance.** `form=link href=https://github.com/sleepy-panda-srl/portulan/pull/212` — that pull
request's own body named this gap and declined to propose it: *"a rail comparing a PR's touched lines
against what merged into the merge-base since the branch forked would make this class mechanical. Not
proposed here — it is a doctrine question, not a records fix."* The right call by that session, and the
reason this exists as its own artifact. Filed on the maintainer's instruction of 2026-08-10, given after
the second near-miss: *"file a rail proposal for the status cell."*

**Decision.** Marius Cetanas — pending.

**Pull request:** [#218](https://github.com/sleepy-panda-srl/portulan/pull/218) — the change that filed this.
