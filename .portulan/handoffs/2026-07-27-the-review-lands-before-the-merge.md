# 2026-07-27 — The review lands before the merge, not after it

**The ruling.** Marius, 2026-07-27: **a pull request cannot merge until Copilot's feedback has been
awaited and resolved.** Provenance is his own, and it is the good kind — he went and looked at **closed**
pull requests and found merges that had landed before Copilot's round on the final push arrived.

**The half that was missing.** `main` already required conversation resolution, which covers *resolved*.
Nothing covered *awaited*. Copilot is requested on every pull request by ruleset, so "Copilot reviews
everything" was true and doing no work: the request was made, nothing waited for the answer, and a merge
in the ordinary window between a final push and a review arriving left the feedback on a closed pull
request. Disregarded by nobody in particular, which is worse than being argued with.

**Third instance of `a-mandate-nothing-checks-is-already-broken` in this subject area**, and the pattern
is now sharp enough to state as its own rule: **a watcher that is only *requested* is not a gate.**
Requesting a review, enabling an alert, adding a bot — all create the feeling of coverage. Only something
that refuses creates coverage.

**The head SHA is the design, not a detail.** A review of an earlier commit does not satisfy the check,
because that is the defect itself: the review existed and described a different tree than the one
merging. A checker matching "a Copilot review exists" would have gone green on every case this rule was
written for. So `commit_id` is compared against the pull request's live head, and `synchronize` re-runs
it — pushing puts it back to pending.

**Three fail-closed decisions in the workflow**, each because "could not look" is never "nothing wrong":
an unreadable pull request, unreadable reviews, and a missing head SHA all report failure rather than
passing. The cost is that a GitHub API outage blocks merges. Accepted: a gate that opens whenever it is
unwell is not a gate.

**Two implementation notes worth carrying:**

1. **The head SHA is read from the API, not the payload.** On `pull_request_review` the payload's
   `pull_request` block is a snapshot from when the review was submitted, so a push racing a review would
   have the check compare against a head that had already moved — a green on a stale commit, in the check
   written to prevent exactly that.
2. **`--paginate` on the reviews call.** A pull request with a long review history would otherwise have
   its newest reviews on a page never fetched. A check that silently examines the first thirty of forty
   reviews is the fail-open in miniature.

**The fragile part, named rather than hidden.** Which login counts as "Copilot" is a platform fact the
workflow hard-codes. A rename surfaces as a permanent red with the observed logins printed — the right
failure direction — but it is a fragility, and it is the thing to check first if this ever reds
inexplicably.

**It composes with the autonomy modes; it does not substitute for one.** A mode governs whether the
*agent* raises a ship-step prompt. This is a required status check, and floor rows hold at every mode. So
under `auto` — where no prompt is raised — this check still refuses. The rule is worth **more** under a
loose mode than under a strict one, which is the opposite of how it might read.

**Not yet a required check, deliberately**, per proposal `0004`'s lesson: a required context that has
never reported blocks every open pull request not carrying the workflow, and `enforce_admins` leaves
nobody able to force past. The workflow merges first; the one `gh api` command that adds it to protection
is in the pull request body and is **Gated** — his.

**Seam scan clean** across files, commit message, and branch name.
