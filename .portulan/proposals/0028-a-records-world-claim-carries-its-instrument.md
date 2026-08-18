# Proposal — a record's world-claim carries its instrument

**Status. PROPOSED, 2026-08-10 — and deliberately ships no rail.** One question, **Q1**, is a ruling only
the maintainer can make, and the rail this proposal would otherwise build is **contingent on it**. What
ships now is a doctrine carrier for a convention the record layer already practises and nothing governs.

## Incident

On [#222](https://github.com/sleepy-panda-srl/portulan/pull/222) the change's own records — the handoff
and the Session-log entry — were **factually wrong four times, while all ten verify recipes stayed
green**:

1. **A moved base.** The records named `159df14` after `main` had advanced twelve commits.
2. **A wrong attribution.** *"#211 fixed `repos/portulan.md` and `verify/README.md`"*. The truth is
   **#206** — `git log 159df14..dd7e372 -- <path>` shows `387bef5` and `9ffd2f4`, both #206 commits.
   #211 merged twenty minutes later and touched neither file. **The error came from reading merge times
   instead of commits.**
3. **A range count of eleven** where `159df14..dd7e372` holds twelve.
4. **A rebase count wrong in each direction** — three where the reflog held two, corrected to two, then
   made three true by a third rebase — the second error written *into the sentence tallying the first
   two*.

Every one was caught by a fresh-context checkpoint, which returned **REQUEST-CHANGES three times and
never once on the mechanisms**. The code was right each time. The defect lives entirely in claims about
the world, and the world is precisely what this repository's rails cannot see: `spec/README.md` concedes
that *almost nothing `doctor` checks is a claim about whether the workspace's content is true*, and
milestone 5's criterion says outright that the age half of the store report is something `doctor`
**deliberately cannot give because it reads the tree and never git**.

A second, related instrument failure the same day, which belongs here because its cause is the same —
**a number nobody could check**: measuring how many of nine recipes invoke `grep`, two successive
hand-written one-liners returned **zero for every recipe**, including one the same page calls *"built out
of `grep` throughout"*. The cause was `\b`, which is not ERE on BSD grep. **Only the absurdity of the
result caught it.** A plausible wrong number would have shipped, as `#77`'s *"seventeen invocations"*
already did once, from a word count that included comments.

## The three tiers, because only one of them is railable

This is the load-bearing distinction and the proposal is scoped by it.

| Tier | Example from the incident | Verdict |
|---|---|---|
| **Local and history-derivable** | *"the range holds twelve commits"*, *"these commits touched this file"*, *"`main` is at `<sha>`"* | **Railable** — `git log`, `git rev-list`, `git rev-parse`. This is where defects 1, 2 and 3 live. |
| **Local-only and volatile** | *"rebased twice"* | **Permanently out of rail scope.** Reflogs travel in no clone at any depth; even the librarian's full-history checkout has the *runner's* reflog, not the author's. And the count was wrong in both directions and then made true by a further rebase — a moving target no snapshot can hold. |
| **Network** | *"#215 is open"*, *"#206 merged at 08:50:17Z"* | **Barred from recipes.** A network call inside a verify recipe is a standing prohibition here, stated in `spec/slots.md` and `.portulan/verify/README.md`. |

Note what tier 1 buys: **the wrong attribution — the most consequential of the four — is a tier-1
defect.** *Which commits touched this file in this range* is a local question, and reading merge times
instead of commits is exactly the mistake a local instrument would have refused.

## Proposed rule

> A record's claim about the world **carries the instrument that produced it** — the command, and the
> tree it was measured on. A figure is written as the command that reproduces it wherever a command can;
> where a literal is unavoidable, the literal is stamped with the commit it was true at.

The record layer **already practises this**, unprompted, and that is the argument for promoting it rather
than inventing it. The 2026-08-10 handoffs say *"Every figure below is stated against the tree it was
measured on"*, and a Session-log entry the same day records *"the handoff now carries the command rather
than a fifth literal"*.

**Its only carriers today are dated records.** No document in `core/`, `spec/` or `.portulan/`'s governing
slots states it. That is `0020`'s *"not a missing rule, a missing carrier"* — a convention the build
obeys and governance cannot read. This proposal gives it one, in
[`core/operating/verification.md`](../../core/operating/verification.md).

## The repair hierarchy, stated in order

Borrowed from what this repository already did to `#77`'s figure and to `dod.md` condition 1, and stated
so the cheapest repair is reached for first:

1. **Delete the figure** and point at the live output. `.portulan/verify/README.md` removed its recipe
   count because *"`tests.sh` prints the live one on every run and that carrier cannot be wrong"*. This
   is the best repair and it is free.
2. **Generate it** — [#187](https://github.com/sleepy-panda-srl/portulan/issues/187), *Derive numbers
   in prose from the code that holds them*, already open and already scored against real defects.
   **This proposal does not re-propose it**; a second design carrier of #187 would be the two-carrier
   defect committed on the deliverable itself.
3. **Discipline**, for what neither reaches.

## The control-case clause — the only new mechanical content here

A hand-rolled counter is inadmissible as evidence for prose. Where a figure needs an instrument this
repository does not already own:

> The instrument is **run first against an input whose answer is known independently**, and the control
> is reported beside the result. An instrument with no control is a claim, not a measurement.

At a terminal this is unenforceable, and saying otherwise would be the capability claim
[`a-stated-enforcer-must-be-the-real-one.md`](../memory/a-stated-enforcer-must-be-the-real-one.md)
forbids. **It becomes mechanical at exactly one point**: when a counter becomes a committed producer
under `cli/`, its fixture test *is* the control case made permanent, and `tests.sh` picks it up with no
ceremony. So the binary form of the rule is:

> A figure in prose names its producer; a producer is a **committed tool with a fixture test**; a
> hand-rolled one-liner's output is not admissible.

The `\b` lie would have died in a fixture. The absurdity check stays human, and always will.

**One bar this proposal will not cross.** *Re-running a command named in prose* is barred. `doctor`
refuses to execute recipes because a validator running arbitrary commands out of a manifest would be one
you could not safely point at someone else's workspace; commands scraped from sentences are strictly
worse. The single precedent for executing content lifted from tracked files — `workflow-filters.sh` — is
a **closed interpreter against declared fixtures**, with a token audit that exits 2 on anything it cannot
lift, and it cost a 1,337-line instrument. A producer must therefore be a **registered tool**, never a
string in a sentence.

## Q1 — the ruling this proposal exists to ask for

**Will you fix a form for a record's world-claims?**

`0020` §6 named a form check on checkpoint verdicts, refused it, and said it is **worth building the day
the verdict format is fixed** — refused for exactly one reason: *"it needs a fixed verdict format, and
this workspace has never fixed one."* The same blocker sits under this proposal. Mechanically finding *a
claim about git state* in free prose is the ambitious parser this repository refuses; a **form** is what
makes an omission impossible without anyone parsing meaning.

The precedent that this is an accepted rail shape is in the tree already: `docs.sh`'s `record` check
requires the newest Session-log entry to **carry a seam attestation**, and `doctor` fails a `type: rule`
memory entry whose provenance is not well-formed. **Neither verifies the truth of what it reads; both
make the omission impossible.** That is the honest ceiling here too.

**If you fix a form**, the rail this proposal would then build is:

- Every commit-ish a record cites **resolves** in this repository, and every range count it states
  **re-derives** — tier 1 only.
- Paired, in the same change, with **`fetch-depth: 0` on `verify.yml`**. This is not optional: CI's
  checkout is shallow, `.portulan/verify/README.md` documents that anything reading `git log` there
  *"refuses or lies"*, and a recipe structurally exit-2 in CI is the permanently-red shape that kept
  `claude plugin validate` out of the recipe set. **Either the depth flips or the check stays out of the
  recipe set.** `librarian.yml` already takes full history and argues why.
- With the cost stated rather than hidden: a full clone per pull-request run, cheap on a three-week-old
  repository and a number to re-check as history grows.

**If you do not fix a form**, this proposal is the doctrine carrier and the control-case clause, and the
rail is not built. That is a coherent outcome, not a failure: the discipline demonstrably works — it
caught all four defects — at a demonstrated price of three REQUEST-CHANGES rounds.

## Honest limits

- **The reflog tier is unreachable by any shared rail, permanently.** Discipline only: quote the reflog
  line, or do not count.
- **The network tier is barred from recipes.** Extending the scheduled librarian to nag on stale
  pull-request claims is legal — it is a watcher, not a verdict — but it is new surface and is
  deliberately **not** bundled here.
- **A form check makes an omission impossible and a falsehood no less likely.** A record can carry a
  perfectly well-formed claim block and still name the wrong pull request; only re-derivation catches
  that, and only for tier 1.
- **This proposal ships no rail today**, and says so in its Status rather than implying one.

## Provenance

`form=link`
`href=`[`https://github.com/sleepy-panda-srl/portulan/pull/222`](https://github.com/sleepy-panda-srl/portulan/pull/222)
— the change whose own records were wrong four times while every recipe stayed green, and whose
pre-commit passes caught all four. In-repo and resolvable by anyone who can read this rule; no client
material, so no seal is needed.

**Decision.** PROPOSED — awaiting the maintainer, and **Q1 gates the rail**. The doctrine carrier and the
control-case clause stand or fall on their own.

**Pull request:** [#223](https://github.com/sleepy-panda-srl/portulan/pull/223) — the change that filed this.
