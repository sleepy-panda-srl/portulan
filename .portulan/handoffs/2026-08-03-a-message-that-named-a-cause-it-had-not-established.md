# Handoff — a message that named a cause it had not established, five times over

**Session of 2026-08-03**, outside the milestone track: it began as *resolve #157's conflicts and merge it*
and became three pull requests, because the check that gates every merge was misdiagnosing its own failure.
[#157](https://github.com/sleepy-panda-works/portulan/pull/157) ·
[#160](https://github.com/sleepy-panda-works/portulan/pull/160) ·
[#162](https://github.com/sleepy-panda-works/portulan/pull/162) ·
[#161](https://github.com/sleepy-panda-works/portulan/issues/161) open.

## State

`main` at `536a3aa`, no open pull requests, suite 907 and eight recipes green. The librarian's first
scheduled pass is merged. `copilot-review.yml`'s timeout message now distinguishes four states instead of
three and asserts no cause it has not established. One question is open and it is the maintainer's: #161.

## Decisions + why

- **A librarian pull request's conflicts are resolved by RE-RUNNING `cli/librarian.mjs`, never by
  hand-merging** — because every line the pass writes is derived, so a hand-merge produces a record
  describing a store it no longer sits on. Done three times on #157 as `main` moved under it. This was
  load-bearing twice over: git merged `handoffs-index.md` **clean and wrong** (both sides raised the count
  57→58 over a list holding 59, which `index.sh` would have caught), and it silently falsified the pass's own
  sentence *expect the regenerated index to show exactly one more*, which nothing checks at all.
- **The timeout message splits four ways, on what the job ESTABLISHED with its own write** — because
  `[ -z "$requested" ]` had been read as *the request was never created*, while `rerequest_state` held `sent`
  from a POST GitHub had accepted. The message contradicted itself four lines apart, and sent the reader to
  check a ruleset that was healthy. The rule was already written correctly in the comment one screen below
  and the code above it did not implement it — #89's defect returning to the message #89 fixed.
- **`requested` is filtered to Copilot's logins, in the shell rather than the jq** — because the endpoint
  answers with every requested reviewer, so a waiting human made the check print `REQUESTED AND UNANSWERED`
  with a human's name under it. In the shell because `REVIEWERS` is already the one carrier for those logins,
  and because it leaves the jq program byte-identical, so its `workflow-filters` fixtures still cover the
  program that actually runs. The bug predated the four-way split; the split made it load-bearing.
- **#157 merged past a red `copilot-reviewed`, on the maintainer's explicit call** — because the silence was
  traced to how the pull request was filed rather than to anything in its diff, so no amount of waiting would
  produce a round. Recorded as an override, not as a green.

## The finding, and it is about the author of this handoff

#160 drew **8 Copilot findings across 5 rounds. The eight-recipe suite caught 0 of them.** Seven were the
same class — *naming a cause the code had not established* — **in the change whose entire subject is that
class**. Rounds 4 and 5 were each seeded by the fix for the round before: a label claiming more than its data
was replaced by a label claiming more than its data, twice.

The suite is not deficient. It tests which branch fires and what a filter returns; seven of eight findings
were about whether an English sentence was true of the data beside it, and no suite holds that. **The
four-state harness written to verify this very change passed every round, because it tested branch selection
and the defects were in the prose.** A harness written to check your own change inherits your blind spot.

Sharpest instance: the explanation invented for #157's silence — *Copilot declines a diff it has already
reviewed* — was refuted by #160 itself an hour before merge, on a **byte-identical** diff that drew a full
round in 3m17s. The documented cause was on screen the whole time: **#86's *the author was a bot***, quoted
in the branch two below the one where the invention was typed. #160 shipped the refuted claim, it printed to
a live log on #157's own second failure, and #162 removed it.

## Open questions

- **#161 — the maintainer's.** An App-authored pull request draws no Copilot round on `synchronize`
  (reproduced twice on #157; refuted for diff-similarity by #160). `librarian.yml` files as the App **by
  design** — a `GITHUB_TOKEN` pull request starts no `pull_request` runs at all — so **every scheduled pass
  that needs a rebase before merging strands the same way, every Monday.** Today that cost two 20-minute
  waits and an override. Three directions are listed there; a fourth appeared only after the refutation:
  file the pass, or re-open it, under a user identity.
- **The loop bound was exceeded by three pushes**, each authorised individually. Rounds 1–2 were defects this
  pull request introduced, which is #154's stated ground; round 3 was older than the branch and would
  ordinarily have been an issue. Whether *the change's subject is the defect class being found* is a general
  exception or was a one-time call is undecided.
- **Session memory is over its own budget** — `portulan-gotchas` 71 lines, `portulan-build` 66, against ≤60.
  Both are lower than at session start despite gaining content, and everything compressible has been
  compressed. Reaching 60 now means retiring facts that are still true; the two version-stamped candidates
  were checked and the CLI is **still 2.1.220**, so they are current. That call is the maintainer's.

## Next action

Decide #161. Until it is decided, a librarian pass merges cleanly only while it is still up to date with
`main` — so merge Monday's promptly, or expect the override.

## Recoverability

Nothing is partial. Three pull requests merged and their branches deleted; #161 is open with its refuted
hypothesis struck through in title, body and the one comment that argued from it, rather than deleted.
