# Proposal — the Copilot gate needs an answer for a head that never draws a round

**Status. RULED, 2026-08-09** — exit (2) taken; exits (1) and (3) declined; exit (4) staged behind the
controlled experiment, whose opportunistic design is bound in the **Decision** at the foot. The body
below is the evidence as it stood at the ruling and still recommends no exit: the recommendation half of
this record is the Decision.

**Pull request:** https://github.com/sleepy-panda-srl/portulan/pull/186

## Incident

[#161](https://github.com/sleepy-panda-srl/portulan/issues/161). On
[#157](https://github.com/sleepy-panda-srl/portulan/pull/157), 2026-08-03, a rebase force-push drew
**no Copilot round at all**: the `copilot auto-review on pull requests` ruleset — the full live name, read from the
rulesets API rather than abbreviated — carries `review_on_push: true` and did not fire; `copilot-review.yml` re-requested at 625s and the `POST .../requested_reviewers` was **accepted**;
at 1216s the request list read empty with no review submitted. No platform incident — Copilot had
reviewed [#158](https://github.com/sleepy-panda-srl/portulan/pull/158) normally about ninety minutes
earlier.

`copilot-reviewed` exists so a pull request waits for the round on the commit it is actually merging. A
head that can never draw one leaves a check with **no state that ever clears** — and `main` is
`strict: true`, so a pull request that falls behind **must** rebase. The two constraints pull against
each other directly.

## What is established, and what is not

**Refuted — diff-similarity.** [#160](https://github.com/sleepy-panda-srl/portulan/pull/160) was
rebased onto a moved `main`; the intervening commits did not touch the workflow, so the diff was
**byte-identical** — `git diff origin/main..HEAD | git hash-object --stdin` returned
`6f4b38d320945b68a69aa04fe4a57853fb18db67` on both sides, and `range-diff` replayed all six commits as
identical patches. **Copilot returned a full round in 3m17s.** If it deduplicated on diff content, that
is precisely the case it would have declined.

**The surviving lead — who opened the pull request.**

| PR | Opened by | Push | Diff | Round |
|---|---|---|---|---|
| #157 | **App** (`app/portulan-agent`) | rebase force-push | 7 lines changed | **none**, 20m20s |
| #160 | user (`marius-cetanas`) | rebase force-push | **byte-identical** | full, 3m17s |
| #157 | **App** | rebase force-push | re-derived, changed | **none**, 20m32s |

**It stays a lead, and this proposal will not call it a cause.** #157 *did* draw a round on its original
head at 10:04, so a blanket *"Copilot does not review App-authored pull requests"* does not fit the
evidence. The shape that fits is narrower — `synchronize` specifically, `opened` unaffected — and **one
uncontrolled variable across two pull requests is not a mechanism**. Two things stay unexplained: why the
explicit re-request is *accepted* and then yields nothing, and why that differs from
[#86](https://github.com/sleepy-panda-srl/portulan/pull/86), where a re-request produced a round in
about ninety seconds.

**The experiment that would settle it** is a controlled pair: one App-authored and one user-authored
pull request, each drawing a round on `opened`, each then given a `synchronize`. It was **not run**, by
the maintainer's ruling of 2026-08-09 — evidence-only, no throwaway pull requests. Its design is named
here so the next session does not re-derive it.

## What it costs

**Structural, and weekly.** `librarian.yml` files its pull request as the App **by design**: a
`GITHUB_TOKEN`-opened one starts no `pull_request` runs at all, so the required checks would never
report ([#86](https://github.com/sleepy-panda-srl/portulan/pull/86)). The pass has no update path,
so any pass not merged before `main` moves needs a rebase — the exact operation that appears to suppress
the round. If the lead holds, **every scheduled pass needing a rebase strands this way**. It is not
limited to the librarian: any pull request rebased after review meets it.

**Paid once already, as a doctrine exception rather than a fix.** #157 merged **2026-08-03T16:05:55Z**,
authored by `app/portulan-agent`, **without ever drawing a round**, past a red `copilot-reviewed`, on the
maintainer's explicit override. Verified against the API rather than recalled.

**What is on the other side of the scale.** #160 drew **8 findings across five rounds** — 2 inline
threads, 6 suppressed notes. **The eight-recipe suite caught none of them**, and that is not a gap in
the suite: seven of the eight were about whether an English sentence was true of the data beside it. The
one that was not prose is the sharper argument — round 3 found that `requested` was built from *every*
requested reviewer rather than Copilot's, so `-z "$requested"` never meant *Copilot holds no request*;
that bug **predated** #160 and was live in `copilot-review.yml`. Weakening this gate gives that up.

## The floor as it actually stands, measured

Read live from `repos/sleepy-panda-srl/portulan/branches/main/protection` on 2026-08-09, because this
is exactly the class of fact `.portulan/gate-map.md` says no file here can pin:

| Setting | Value |
|---|---|
| Required status checks | **`workspace-verify`, `pr-labeled`** — and nothing else |
| `copilot-reviewed` | **not required** |
| `strict` | `true` |
| `enforce_admins` | `true` |
| Conversation resolution | required |
| Required approving reviews | `0` |

That is why #157 could sit at `UNSTABLE` and still merge: the gate is doctrine here, not platform.

## The four exits

The first three are #161's. **The fourth exists only because the refutation happened** — it was
unavailable while diff-similarity was the hypothesis, because it presumes the round is reachable for a
*different filer*.

1. **Treat *requested, accepted, then abandoned* as a pass with the reason printed** — as the `draft`
   and *not owed* branches already do. *Argued originally on the premise that no round could ever arrive
   for such a head; the refutation damages that premise specifically.* If the trigger is authorship, the
   round is not unreachable — it is unreachable **for this filing mechanism**. Weakens the gate for
   every pull request in order to fix one class.
2. **Keep it red, and make merging around it an explicit, recorded maintainer act.** What already
   happened on #157, promoted from exception to procedure. Cheapest, and it prices the strand at one
   override per occurrence — weekly, if the lead holds.
3. **Make `copilot-reviewed` a required context**, so the tension must be resolved rather than routed
   around. **Strictest, and it converts the strand from overridable into unmergeable** — a librarian
   pass that stranded would block until someone changed how it files.
4. **Change who files.** Have the librarian's pull request opened by a user identity, or re-opened as
   one when a rebase is needed. **This cuts against
   [`0015`](0015-the-librarian-files-as-the-agent.md), which is ACCEPTED** (Marius, 2026-07-28) — so
   taking it reopens a decision already made and must be an amendment to `0015` rather than an
   implementation detail. It also inherits #86's constraint: whatever identity files, it must be one
   whose pushes raise workflow runs, which `GITHUB_TOKEN` does not.

**Not mutually exclusive.** (4) addresses the librarian's structural case and leaves the general one;
(2) or (3) answers the general one. A ruling may take one of each.

## Recommended — none, and that is the position rather than an evasion

This is a platform-floor and doctrine question, and both halves are the maintainer's. The one thing the
drafter will say is narrower and is a fact rather than a preference: **(1) is the exit whose stated
premise the refutation damaged**, so taking it now would weaken the gate on an argument that is **now in
doubt**. Stated at the source's own strength: the correction comment says *"that premise is now
doubtful"*, not that it is dead, and writing it harder here would be the claim-class this whole session
is about. Everything past that is taste, and this document does not have a vote.

## Enforcement

Whatever is ruled lands in a rail rather than in prose — `.github/workflows/copilot-review.yml`, the
branch-protection required-context list, or `librarian.yml`'s filing identity. That is why this is worth
a ruling rather than a note.

## Provenance

`form=link href=https://github.com/sleepy-panda-srl/portulan/issues/161`, with the refutation and
finding-rate comments on it, [#157](https://github.com/sleepy-panda-srl/portulan/pull/157),
[#160](https://github.com/sleepy-panda-srl/portulan/pull/160),
[#162](https://github.com/sleepy-panda-srl/portulan/pull/162) and
[#86](https://github.com/sleepy-panda-srl/portulan/pull/86).

**Retire when:** ~~the ruling lands and its mechanism is configured — or when a controlled experiment
establishes the cause and the exit follows from it rather than from a lead.~~ **SATISFIED on the first
clause, 2026-08-09**: the ruling landed with this change and exit (2)'s mechanism is the doctrine
paragraph in [`../gate-map.md`](../gate-map.md). The clause is struck rather than deleted because it was
the condition this proposal was accepted under, and what replaces it is not a rewrite of it — **the live
retirement conditions are the Decision's**, below: one for the exit-(2) procedure, one for the
experiment, and one each for the exits still staged. A proposal that pointed at its own superseded
clause would be the two-carrier defect this repository names more often than any other.

## Decision

**Decision.** The supervising agent (Claude Fable 5) — **2026-08-09**, on the ruling authority the
maintainer delegated this session, with the reserved halves below left to him by name. **Exit (2) is
taken now; exits (1) and (3) are declined; exit (4) is staged behind a measurement rather than taken.**

**Because:** (1)'s stated premise — that no round can ever arrive for such a head — is the one the
refutation damaged, and weakening the gate on *every* pull request to fix one class would give up a
measured channel (8 findings on #160 alone, none of them catchable by the recipe suite) on a premise now
in doubt. (3) would convert a strand that is structural and weekly *while the authorship lead holds* into
an **unmergeable** pull request, forcing the filing-identity question at 06:00 on a Monday with nobody at
a keyboard; it stays available as the end state once the strand class is closed, as its own Gated
proposal. (2) is what already happened on #157, promoted from doctrine exception to stated procedure: the
check stays red, because **a gate that opens itself on an unexplained absence is not a gate**, and
merging past it is the maintainer's explicit per-occurrence act, recorded on the pull request before the
merge — priced at one recorded override per stranded pass.

**The authorship lead is strengthened, not settled**, by 2026-08-09's evidence: **sixteen** user-authored
Copilot rounds across #183, #185 and #186 in one day, **thirteen on `synchronize` heads** including
rebase force-pushes minutes before merge, against **0-for-2** on App-authored `synchronize`. Every
author-neutral alternative — flaky `synchronize`, rebase suppression, platform load — now has **19**
counterexamples across two days (today's 13, plus #160's **six** post-open rounds), while the treatment
arm is still **one** pull request. _An earlier draft said "~17", derived from #161's five-round table
for #160 — which went stale eight seconds after it was posted, since #160 drew seven rounds in the end.
A figure derived from a record instead of from the source, in the record that exists to be measured._ Under the narrow
shape #86 stops being an anomaly: its answered re-request was on an *opened* head, so *App + `opened`*
reads slow-but-answerable and *App + `synchronize`* unanswered so far. Consistent with the lead; not
established by it.

**The controlled experiment is to be run**, in the opportunistic form that honours the maintainer's
2026-08-09 evidence-only ruling — **no throwaway pull requests**. Instrument the next scheduled librarian
pass when `strict: true` forces its rebase; take a user-authored `synchronize` the same hour as control,
push actor held constant. One clean discordant pair brings exit (4) to the maintainer as an **amendment
to ACCEPTED proposal [`0015`](0015-the-librarian-files-as-the-agent.md)** — which this ruling does not
touch — and a concordant pair kills the lead and returns the design to #161.

**Retire the exit-(2) procedure when:** a scheduled pass that needed a rebase draws its round and merges
with no override; or `copilot-reviewed` joins the required contexts; or Copilot review leaves the review
path.

**Reserved to the maintainer, by name:** every per-occurrence override merge (the procedure itself); any
change to the branch-protection required-context list (exit 3); any change to `librarian.yml`'s filing
identity, authentication or secrets (exit 4). **A confirming experiment result is evidence for his
amendment decision, never authorization to implement it.**

### The experiment, specified so it needs no re-derivation

1. **Treatment arm** — the librarian pass of **2026-08-10, cron 06:00 UTC** (may be platform-delayed).
   Confirm its round on `opened`, which replicates #157's. If that round is absent, the narrow shape is
   already wrong: record on #161 and stop.
2. **Condition** — only if `main` moves before the pass merges (**ordinary work, never manufactured**),
   the pass reads `BEHIND` and must rebase. Rebase and `git push --force-with-lease` — both Auto. Push
   nothing to that branch beyond the one rebase `strict: true` demands.
3. **Control arm** — within the same hour, a `synchronize` (prefer a rebase) on any user-authored open
   pull request, pushed by the same credentials, arising from ordinary session work. Same-day is
   acceptable if the same hour is impossible; record which.
4. **Observation** — three facts come from `copilot-review.yml`'s own runs, which already print them per
   head: was the re-request POSTed and accepted; did a round arrive inside the budget; the filtered
   `requested_reviewers` state at expiry. **The fourth — did `review_on_push` fire — is read from the pull
   request's timeline**, not from the runs: that branch of the workflow disclaims it in its own words
   (*"the RULESET is a separate question and this message cannot answer it"*), and the timeline is how
   #161 established it for #157.
5. **Prediction, registered now** — authorship predicts **no** round on the App pull request's rebased
   head and a round on the user one within ~4 minutes. A clean discordant pair confirms; a round on the
   App pull request **refutes** the narrow lead and closes it.
6. **Stop rule** — if three consecutive scheduled passes never meet the rebase condition, the design
   returns to #161 as still-unrun. No throwaway pull requests, ever, under the evidence-only ruling.
