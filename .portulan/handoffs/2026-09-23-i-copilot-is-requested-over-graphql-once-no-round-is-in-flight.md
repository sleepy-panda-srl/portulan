# Handoff — 2026-09-23: Copilot is requested over GraphQL, once no round is in flight

**What landed.** [`copilot-request.yml`](../../.github/workflows/copilot-request.yml) asks for Copilot's
review with the GraphQL mutation `requestReviews`, Copilot's Bot node id in `botIds` and `union: true`,
and takes Copilot among the `reviewRequests` in the mutation's own answer as the proof that GitHub
recorded the request. Before asking it reads the pull request: Copilot holding a request means a round is
running or on order, and the job waits, looking every 15 seconds for up to 15 minutes. It asks at most
once per run, only for the head its event carried, and judges no round already on the head. One job per
pull request runs at a time (`cancel-in-progress: false`), the timeout moves from 5 to 20 minutes, above
the wait, and the filters recipe covers the job's three `jq` programs with nine fixtures in place of the
old program's five.

**Why #435's run went red over a request that worked.** Read from #435's timeline and runs: this job's
`POST` ran 15:49:58 to 15:50:00; the timeline records the maintainer requesting Copilot at 15:49:59; Copilot's
run for that head started at 15:50:09 and ended at 15:54:19, and its review landed at 15:54:21. His only
manual request on #435 was at 15:34:31, before #434 merged. So the token route works, and the job reported
red because GitHub's answer listed no requested reviewers. REST's `requested_reviewers` never lists a Bot.
The maintainer's earlier script in another repository measured that, with GraphQL showing Copilot requested
while REST listed nobody, and so do three field reports:
[bakobo/did-webs#1](https://github.com/bakobo/did-webs/pull/1),
[amarun22-PS/copilot-code-review-api-demo](https://github.com/amarun22-PS/copilot-code-review-api-demo) and
[mfittko/dev-loops#1918](https://github.com/mfittko/dev-loops/issues/1918). The check was red by
construction: the #286 failure turned inside out, a failure denying a request that existed.

**Why GraphQL, and what is reused.** The mutation's answer is the pull request after the call, and its
`reviewRequests` do list a Bot, so one call both asks and shows what GitHub recorded. That is the earlier
script's design, reused along with its check for a pending request before asking. What differs is the
requester: that script asked with `GITHUB_TOKEN` and, where no person could be billed, waited for a human
review instead, because a stored user token was a gate-map decision; #434 took that decision here. The Bot's
node id is looked up at run time from the REST login, so the hard-coded platform facts stay the logins, now
including GraphQL's `copilot-pull-request-reviewer`, which drops the `[bot]` suffix.

**Why the job waits.** On #435 a push at 15:52 had this job ask again, 15:52:32 to 15:52:35, while Copilot
still held the 15:49 request; no event was recorded, the held request was answered on the earlier head,
and the newer head drew no round. A request names no commit, so the job now asks only when nothing is on
order, and only for the head its event carried: a look that finds another head stops it, because that
head's push has a run of its own. So a burst of pushes during a round draws one more round, for the newest
head.

**What is red, and what warns.** Red: no token, a token GitHub refuses (HTTP 401, bad credentials, a
resource not accessible), a node-id lookup or mutation GitHub refuses, and an answer that does not list
Copilot. A warning and exit 0: the pull request unreadable for the whole wait, or Copilot still holding a
request when the wait runs out; each prints its repair, which is re-running the job.

**Why no proposal.** It re-plumbs an existing actuator: the same request, by the same identity, for the same
rule. No axis, mode or surface is added.

**How it was tested, and what was not.** The step was lifted from the parsed YAML and run under `bash -e`
against a stub `gh`, with the wait shortened, in nineteen cases: a request recorded at once; a Copilot
review on the head, a dismissed one, and a request held for two looks and then cleared or answered on the
head, each of which asked; another head at the first look, and another after two held looks, each with
nothing asked; held past the wait, a warning; an answer not listing Copilot, a refused mutation and an
unreadable answer, each red; one unreadable look and then a request; unreadable throughout, a warning; bad
credentials, red at the first look; a null pull request, a warning; a merged pull request and one turned
draft, nothing asked; a failed node-id lookup, red; and no token, red with no call. No case reads the
reviews. The fields the stub received name the owner, repository, number, pull request node id and Bot id.
`pull_request_target`, the environment and the concurrency group cannot run outside GitHub, and this pull
request cannot exercise them. The harness is in the project's shared files, not in this repository.

**Copilot's rounds on #436.** Three findings, all on the job's judgement of whether a round was already on
the head. The first: the state read took the last hundred reviews of the GraphQL connection, and replies
to review threads are reviews too, so a long history could push the round out of that window and draw a
second request; the reviews moved to a paginated REST read. The second: that read kept a DISMISSED review,
which could stand as the head's round and skip a request; it dropped them. The third: Copilot files an
error or a refusal as a review too, so a notice could stand as the round and stop a re-run from asking.
Telling the two apart means reading Copilot's review body, whose format moved that day under
`copilot-review.yml`'s matcher, so the third fix removes the judgement: the job reads no reviews, and the
read the first two fixes shaped goes with its four fixtures. What the judgement also did, keeping a burst
of pushes during a round from buying a second round of the newest head, is kept by asking only for the
event's head. The price is a second round of a head that has had one, on a re-run, a reopening or a draft
made ready again, and on a push that lands in the seconds between a request and Copilot taking it up. The
third came after this repository's two fix-rounds (rule 4 of
[`a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md)), and his words at 18:03 UTC
granted it: *"All PRs need to rebase, fix merge issues and address copilot findings."*

**Observation (proposal 0007).** On the first bot-authored pull request after the merge: this job's log
shows the mutation's answer listing Copilot, the timeline shows the maintainer requesting Copilot at the
job's time, and a Copilot run for that head starts. That the token's *Pull requests: Read and write* is
enough for the mutation is established there for the first time; the earlier script measured the mutation
with `GITHUB_TOKEN`. On a push made while a round runs, the log shows the wait and the timeline shows the
request after that round's review.

**Checkpoints.** Skipped by his instruction of 2026-09-23 12:38 (no fresh-context runs unless he asks); the
coordinator session reviewed the diff before the commit; his review is on the pull request.

**Left as found.** The gate map is not edited, so this lands on either side of its split. Its *Merge
discipline* note that the first bot-authored pull request after #434 is the observation, and
`copilot-review.yml`'s re-run re-request with `GITHUB_TOKEN`, which cannot start a round on a bot's pull
request, belong to the next change, where `copilot-reviewed` follows the round instead of a three-minute
window if the maintainer rules so.

**Next action.** The observation above; then the `copilot-reviewed` change on his answer.
