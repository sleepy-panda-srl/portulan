# Handoff — 2026-09-23: Copilot is requested over GraphQL, once no round is in flight

**What landed.** [`copilot-request.yml`](../../.github/workflows/copilot-request.yml) asks for Copilot's
review with the GraphQL mutation `requestReviews`, Copilot's Bot node id in `botIds` and `union: true`, and
takes Copilot among the `reviewRequests` in the mutation's own answer as the proof that GitHub recorded the
request. Before asking it reads the pull request: a Copilot round already on the head means nothing is owed;
Copilot holding a request means a round is running or on order, and the job waits, looking every 15 seconds
for up to 15 minutes. It asks at most once per run. One job per pull request runs at a time
(`cancel-in-progress: false`), the timeout moves from 5 to 20 minutes, above the wait, and the filters recipe
covers the job's three `jq` programs with ten fixtures in place of the old program's five.

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
still held the 15:49 request; no event was recorded, the held request was answered on the earlier head, and
the newer head drew no round. A request names no commit, so the job now asks only when nothing is on order,
and stops when a round is already on the head, which also keeps a re-run or a queued job from buying a
second round of the same head.

**What is red, and what warns.** Red: no token, a token GitHub refuses (HTTP 401, bad credentials, a
resource not accessible), a node-id lookup or mutation GitHub refuses, and an answer that does not list
Copilot. A warning and exit 0: the pull request unreadable for the whole wait, or Copilot still holding a
request when the wait runs out; each prints its repair, which is re-running the job.

**Why no proposal.** It re-plumbs an existing actuator: the same request, by the same identity, for the same
rule. No axis, mode or surface is added.

**How it was tested, and what was not.** The step was lifted from the parsed YAML and run under `bash -e`
against a stub `gh`, with the wait shortened, in sixteen cases: a request recorded at once; a round already
on the head; a request held for two looks and then cleared, which asked; held and then answered on the
head, which did not; held past the wait, a warning; an answer not listing Copilot, a refused mutation and
an unreadable answer, each red; one unreadable look and then a request; unreadable throughout, a warning;
bad credentials, red at the first look; a null pull request, a warning; a merged pull request and one turned
draft, nothing asked; a failed node-id lookup, red; and no token, red with no call. The fields the stub
received name the owner, repository, number, pull request node id and Bot id. `pull_request_target`, the
environment and the concurrency group cannot run outside GitHub, and this pull request cannot exercise them.
The harness is in the project's shared files, not in this repository.

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
