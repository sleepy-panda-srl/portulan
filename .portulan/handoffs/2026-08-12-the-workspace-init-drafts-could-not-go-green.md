# Handoff — the workspace `init` drafts could not go green

**Milestone 7, session 10. Full lane.** Task [`0016`](../tasks/0016-the-three-demonstrations.md).
The row's whole remainder: **D1, D2 and D5**, plus one mechanism change the demonstrations forced.

## What this session was handed

Not a slice. The instruction was *the remaining items for M7*, which is exactly three demonstrations
— so for the first time since the row opened, there was nothing to choose between. Two questions went
to the maintainer before anything was planned, and **each was then put to a fresh Fable 5 context at
his own instruction**: the route for D5's invocation half, and the subject for D1. A third ruling
followed from a measurement the planning turned up, and that one changed the session's shape.

## The finding worth carrying forward

**The workspace `portulan init` drafts by default could not be validated green.** Not an edge case
and not a fixture: clause (a) makes `init` compose `rituals/checkpoints`, which lives in the host's
plugin cache, and the moment an adopter adds a pack of their own — which is D2, the very next
demonstration — the two packs live in two residences. Measured across all four arrangements, only the
one naming **both** roots went green, and one of those two is a plugin-cache path nobody should have
to know.

**No session before this one could have found it, and the reason is structural rather than lucky.**
D1 and D2 had never been built in one tree. Each on its own is green; the defect is in their
composition, which is precisely what the row asks for and precisely what a session slicing one
demonstration at a time never assembles. **A demonstration is not a slower way of testing what the
suite already covers** — it builds the arrangement the tests were written inside, and that is where
this repository's seven measured blind-spot instances have all lived.

## The thing I got wrong, and said so rather than building on it

I put the union to the maintainer having read **one** of the two grounds the code gives for refusing
it. `resolutionRoots`' docblock argues *never union* from the unasked-path cost — a required recipe
reading `~/.claude` — and the union-when-asked does not reintroduce that, which is what I priced. The
second ground is stated in the `forced` branch's own `why` string: the set is *"empty rather than
falling back to the tree-derived root, so a pack cannot resolve from a local copy here"*. A union
trades a **structural provenance guarantee** for a per-pack statement, which is detection where there
was prevention.

He re-ruled on the full price: **union, but never silently.** The operative discipline is not "surface
the cost" — it is that **a ruling taken on an incomplete framing is not a ruling**, and the repair is
to say so at once rather than to note it in a record afterwards.

## Four things that cost something, in the order they did

- **A change specified as "one branch" was nine files and eight prose carriers.** The supervisor's
  specification found: the origin must be a **field**, because prose provenance is checkable only
  against sentences the same change wrote; `auto` combined with a named root was **silently dropped**
  in five tools and a change justified by *never silently* cannot ship beside that; and every carrier
  of the replaced sentence had to move together. The scope change was put back to the maintainer
  before it was built, because the session-open verdict had approved three demonstrations in one
  session **on the condition that none built a mechanism**.
- **`skills-set --pack-root auto` was silently inert, and read the host to be so.** It passed a
  discovery result without asking for discovery — `resolutionRoots` consults `discovery` only under
  `forced` — so the answer was computed, discarded, and resolution fell back to the derived root with
  nothing said. The eager call also defeated the thunk whose whole job is keeping unasked paths off
  the host's record. Found by a supervisor while grading, in a sixth caller nobody was looking at.
- **Two of my new tests did not bind, for two different reasons.** The refusal test asserted exit 2,
  which **two** mechanisms produce — deleting the parse-time check left it green through
  `resolutionRoots`' own refusal — so it now names a workspace that does not exist, where only a
  parse-time refusal can produce a 2. And a canary claiming the unasked path *never reads the host*
  could not observe a read whose result is discarded; it was renamed to what it can establish, and the
  never-reads property left with the spy that can count calls. **A mutation that changes nothing
  observable proves nothing**, and neither does the test it was aimed at.
- **My own curated verify recipe reported a could-not-run as red.** It preflighted `$PYTHON` and then
  let `make` invoke bare `python`, which was not on PATH — a missing interpreter returned as **exit
  1**, inside a recipe whose header declares the three codes and why they are separate. This project's
  own subject, committed by the person demonstrating it, one file after writing the paragraph about
  it.

## What to know before touching this next

- **`--pack-root auto` unions now; a NAMED root still wins outright.** Milestone 6's from-a-feed
  property is untouched wherever a root is named. What is gone is the weaker version `auto` alone used
  to imply — so *"`auto` resolves only from the feed"* is now false, and a green under `auto`
  certifies **resolution**, not origin. Every pack's line says which root answered.
- **`origins` is on every branch of the plan, not only the union**, so a consumer never has to ask
  `source` before it dares read the field. `resolvePack` returns `root` for the same reason: deriving
  which root answered by re-testing them would be a second implementation of a first-match loop.
- **`index` states origin in the finding and never in the bytes.** An index whose contents recorded
  which root answered would regenerate differently on two machines, and `index --check` byte-compares.
- **The refusal for `auto`+named is refused at PARSE time in each tool** and again inside
  `resolutionRoots` for API callers. Both ask one exported predicate; do not let a sixth tool invent a
  seventh sentence.
- **D5's transcripts are characterised, never committed.** A fresh context refused the plan's original
  mitigation — seam-scan them and commit — on the ground that turns this session's own D1 argument
  back on it: the maintainer's repositories were refused as D1 subjects because a scan is a mitigation
  rather than a guarantee, and one session cannot hold that for D1 and the opposite for D5. **The term
  list cannot clear what it has no terms for.**
- **The row is not closed by this session.** All six demonstrations are delivered and clause (c) is
  graded; what remains is the milestone-close verdict, in a fresh context, after this merges.

## Fidelity

Session-open ran in a fresh **Fable 5** context and returned **APPROVE-WITH-ADJUSTMENTS (8)**; all
eight folded and recorded as numbered items in [`0016`](../tasks/0016-the-three-demonstrations.md).
Adjustment 1 was time-critical and changed the order of the session: put the pack-root question to
the maintainer **at session open, before D2's captures**, because a ruling landing later forces
re-runs.

**Three further fresh contexts, all on the maintainer's instruction rather than mine.** One graded
D5's route and found the teardown **one carrier short** — it removed the plugin and not the
marketplace record, which points at a worktree deleted after merge. One graded the D1 subject, the
transcript question and the folding, and **reversed a decision this session had already made**. One
specified the union, set three conditions, and found the live `skills-set` defect while reading.

**Eighteen mutations run against the new tests; all caught**, five only after repair. Eleven recipes
green; suite **1528 pass / 0 fail** against a measured baseline of **1505** at `dc1a2bd`, which the
pre-commit checkpoint re-measured in a fresh clone rather than taking on trust. Seam scan clean over
the diff, the branch name and the commit message, run term by term rather than as one pattern, by a
scanner that was itself proved able to fire before it was trusted.

**The suite figure in this file was wrong until the checkpoint caught it** — it said 1514 where the
tree said 1515, in the last paragraph of a session whose subject is records that outrun the thing they
describe. This repository's own theorem about last-mile record claims, measured again on the last
line of the record.
