# Proposal — the Copilot gate needs an answer for a head that never draws a round

**Status.** Open — awaiting the maintainer's ruling. This proposal deliberately recommends **no exit**.
It supplies the record the decision was missing, names a fourth exit the issue does not list, and stops.

**Pull request:** https://github.com/sleepy-panda-works/portulan/pull/186

## Incident

[#161](https://github.com/sleepy-panda-works/portulan/issues/161). On
[#157](https://github.com/sleepy-panda-works/portulan/pull/157), 2026-08-03, a rebase force-push drew
**no Copilot round at all**: the `copilot auto-review on pull requests` ruleset — the full live name, read from the
rulesets API rather than abbreviated — carries `review_on_push: true` and did not fire; `copilot-review.yml` re-requested at 625s and the `POST .../requested_reviewers` was **accepted**;
at 1216s the request list read empty with no review submitted. No platform incident — Copilot had
reviewed [#158](https://github.com/sleepy-panda-works/portulan/pull/158) normally about ninety minutes
earlier.

`copilot-reviewed` exists so a pull request waits for the round on the commit it is actually merging. A
head that can never draw one leaves a check with **no state that ever clears** — and `main` is
`strict: true`, so a pull request that falls behind **must** rebase. The two constraints pull against
each other directly.

## What is established, and what is not

**Refuted — diff-similarity.** [#160](https://github.com/sleepy-panda-works/portulan/pull/160) was
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
[#86](https://github.com/sleepy-panda-works/portulan/pull/86), where a re-request produced a round in
about ninety seconds.

**The experiment that would settle it** is a controlled pair: one App-authored and one user-authored
pull request, each drawing a round on `opened`, each then given a `synchronize`. It was **not run**, by
the maintainer's ruling of 2026-08-09 — evidence-only, no throwaway pull requests. Its design is named
here so the next session does not re-derive it.

## What it costs

**Structural, and weekly.** `librarian.yml` files its pull request as the App **by design**: a
`GITHUB_TOKEN`-opened one starts no `pull_request` runs at all, so the required checks would never
report ([#86](https://github.com/sleepy-panda-works/portulan/pull/86)). The pass has no update path,
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

Read live from `repos/sleepy-panda-works/portulan/branches/main/protection` on 2026-08-09, because this
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

`form=link href=https://github.com/sleepy-panda-works/portulan/issues/161`, with the refutation and
finding-rate comments on it, [#157](https://github.com/sleepy-panda-works/portulan/pull/157),
[#160](https://github.com/sleepy-panda-works/portulan/pull/160),
[#162](https://github.com/sleepy-panda-works/portulan/pull/162) and
[#86](https://github.com/sleepy-panda-works/portulan/pull/86).

**Retire when:** the ruling lands and its mechanism is configured — or when a controlled experiment
establishes the cause and the exit follows from it rather than from a lead.
