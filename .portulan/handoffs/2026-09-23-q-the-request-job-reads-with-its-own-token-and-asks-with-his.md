# Handoff — 2026-09-23: the request job reads with its own token and asks with his

**What landed.** [`copilot-request.yml`](../../.github/workflows/copilot-request.yml) uses the maintainer's
token for one call: the REST `POST /pulls/{n}/requested_reviewers` naming
`copilot-pull-request-reviewer[bot]`, which recorded the request on #435. Every read uses the job's own
`GITHUB_TOKEN`, now granted `pull-requests: read`: the pull request's head, state and draft flag over REST,
and its review requests over GraphQL, selecting each reviewer's type and a Bot's login. The GraphQL answer is
kept in a file and judged by one `jq` program rather than by `gh`'s exit status, because `gh` exits non-zero
on any GraphQL error. A `FORBIDDEN` error whose path runs through a `requestedReviewer` is read as a reviewer
the job may not see; any other `FORBIDDEN` is red at once, with the answer printed; any other error is a look
that read nothing. The proof of the request is Copilot among the review requests, read up to three times, five
seconds apart, after the call; reads that never find it are red only when all three answered and showed every
reviewer. The mutation, the Bot node-id lookup and their fixtures are gone. The filters recipe covers the two
new programs with fifteen fixtures in place of #436's nine, and the six fixtures of `copilot-review.yml`'s
pull request read anchor on a longer fragment, because `.head.sha` now names two programs.

**What failed.** The first run of #436's job after it merged, on #443's head `2acddc7` at 18:21:40 UTC (run
35901903000, job 107319935704), went red at its first look: `GitHub refused to show #443 to the token`, then
`gh`'s own line, `Resource not accessible by personal access token`. A re-run on #441 failed the same way.
So every pull request a bot opened carried a red check for a fault of this file. The same token's REST
request had worked on #435, so the refusal was a field of the GraphQL read. The log did not say which: on a
GraphQL error `gh` prints the whole answer, unfiltered, to standard output, which the job captured and never
printed, and only the message reached the log.

**The reading, and why the fix does not rest on it.** Two fields fit. [`CODEOWNERS`](../../CODEOWNERS) names
the maintainers team for every path, so GitHub requests the team on a pull request that is opened or made
ready, and it shows a Team only to a token with the organisation's *Members* permission, which a
fine-grained token scoped to this repository's pull requests does not have. The other is the head's commit
id, `headRefOid`, if GitHub files it under *Contents*. Which one it was is inferred, not read off the log.
The fix covers both: the head is read over REST, and a reviewer the job may not see is tolerated whichever
token reads.

**Why this split, and not a wider token.** Giving his token the organisation's *Members* read would probably
also have served; that is inferred and untested. It is not taken: it widens a token that can already approve
as him, for a read the job's own token can make; and every adopter whose `CODEOWNERS` names a team would
need the same grant from its maintainer. `GITHUB_TOKEN` has no *Members* permission to be given, so the
tolerance is what lets the reads leave his token at all. With the split, his token does the one act
[*Which identity acts*](../gate-map/identity.md) records it for, and a read the job cannot make is this
file's `permissions`, not his setup.

**No Copilot beside a hidden reviewer is a warning: the coordinator session's delegated call.** A reviewer
the job may not see may be Copilot's request, since GitHub could hide the Bot from the job's token as it
hides the team. So a request whose reads after it list no Copilot is red only when those reads showed
every reviewer, and a warning, unconfirmed, when one was hidden. The alternative weighed was a second proof
before going red, a read of the timeline for the request; it was not taken, because it adds a read on an
endpoint whose permission is unverified to a job whose first two live runs today failed on exactly that
kind of assumption, while this rule keeps red for what the job's token can prove wrong and never for what
it cannot see. That is the coordinator session's delegated call of 2026-09-23, with that reason.

**What is red, and what warns.** Red: no token; a request GitHub refuses; a read before the request that the
job's own token is refused (HTTP 401, bad credentials, a resource not accessible, or a `FORBIDDEN` error
anywhere but on a reviewer), at once and with GitHub's answer, since waiting would only hide a fault of this
file; and a request GitHub accepted whose review requests, read three times after it, show every reviewer and
never Copilot. A warning and exit 0: the pull request or its review requests unreadable for the whole wait;
Copilot still holding a request when the wait runs out; a request made after which a read of its review
requests failed, a refusal included, with the last answer printed; and one whose reads list no Copilot beside
a hidden reviewer. The last two are new, because the proof is now a read after the call rather than the
mutation's own answer, and a request that was made is never reported as not made. A 403 without the refusal's
words, which a rate limit also answers, is a look that read nothing, as it was in #436.

**How it was tested, and what was not.** The step was lifted from the parsed YAML and run under `bash -e`
against a stub `gh`, with the waits shortened, in twenty-four cases. The stub answers REST and GraphQL in
GitHub's shapes, exits 1 and prints the whole answer on a GraphQL error as `gh` does, and records the token
each call carried. A request recorded, beside a hidden team and without one; Copilot holding a request for two
looks and then none, which asked; held past the wait, a warning; another head at the first look and after two
held looks, a closed pull request and a draft, each with nothing asked; a refused request, red; three reads
after the call showing every reviewer and no Copilot, red; the same beside a hidden reviewer, a warning; three
unreadable, three refused, a read showing every reviewer then two unreadable, and one unreadable then two
showing every reviewer, each a warning; Copilot on the second read, green; the pull request unreadable once,
rate-limited once, and the review requests unreadable once, each then asking; either unreadable throughout, a
warning; the job's token refused on the pull request, and on the review requests, each red at the first look;
and no token, red with no call. In every case that asked, the request carried his token and every read the
job's. `pull_request_target`, the environment, the job token's `permissions` and GitHub's answer for a hidden
team cannot run outside GitHub, and this pull request cannot exercise its own change. The harness is in the
project's shared files, not in this repository.

**Copilot's round on `1920a6d`.** One finding, moderate, and right: a read after the call that showed every
reviewer, followed by two that could not be read, went red, though the rule above asks all three to show every
reviewer. Absence is now proven only when all three answered; otherwise it is the unconfirmed warning. Two
cases above cover it, with the unreadable reads last and first.

**Observation (proposal 0007).** On the next push to a pull request a bot opened, after this merges: the
job's log shows the reads and the request, and its summary Copilot among the review requests; the timeline
shows the maintainer requesting Copilot at the job's time; and a Copilot run for that head starts. If the
reads after the call find no Copilot while the timeline shows the request, GitHub hides the Bot from the
job's token as well, and the run ends in the unconfirmed warning rather than red. In this repository
`CODEOWNERS` requests the team on every pull request, and while the team holds that request the job cannot
see it, so here a request GitHub did not record usually shows as that warning, and red comes from a request
refused or never made.

**Why no proposal.** It re-plumbs an existing actuator: the same request, by the same identity, for the same
rule. No axis, mode or surface is added.

**Checkpoints.** Skipped by his instruction of 2026-09-23 12:38 (no fresh-context runs unless he asks); the
coordinator session reviewed the diff before the commit; his review is on the pull request.

**Left as found.** The gate map is not edited: *Which identity acts* names the request, which stays his.
The removal of `copilot-review.yml` waits on the maintainer's choice, and rebases onto this.

**Next action.** The observation above; then the removal change on his answer.
