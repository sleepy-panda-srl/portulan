# Handoff — 2026-09-23: Copilot is requested on a pull request a bot opens

**What landed.** [`copilot-request.yml`](../../.github/workflows/copilot-request.yml) requests
`copilot-pull-request-reviewer[bot]` on a pull request a bot opened, from this repository and not a draft,
when it opens, reopens, leaves draft or takes a push. It asks with a fine-grained token of the maintainer's,
held in environment `copilot-request` and read only from `pull_request_target`, and it goes red unless
GitHub's answer lists Copilot among the requested reviewers. The identity table in
[`../gate-map.md`](../gate-map.md) gains the row for that act, and the filters recipe covers the workflow's
one `jq` program with five fixtures.

**Corrected in place**, being made false by this change or already false for a bot's pull request: the
ruleset requesting Copilot on every pull request (twice in the gate map, once in `copilot-review.yml`), the
gate map's cause on #161 being unestablished (a dated clause; the paragraph's retirement condition stands),
four workflows running `gh` (`review-loop.sh` and its README row, now uncounted), one workflow program
running on the real `jq` binary (the filters recipe and its README row, now uncounted), every workflow
pinning `actions/checkout`, and the scheduled workflow being the only identity that acts with nobody at a
keyboard.

**The cause, found.** GitHub's *About GitHub Copilot code review*, read 2026-09-23: *"For pull requests
authored by other bots, or when a bot requests the review, usage is billed directly to the organization."*
Nothing here pays the organisation's share. The pull-request timelines show the result: on the six
App-authored pull requests read (#86, #157, #415, #421, #429, #430), every Copilot round was started "on
behalf of" the maintainer after a request in his name, and #421, which had none, drew no round. None of
#415, #429 or #430 carries the "requested due to automatic review settings" event that the person-authored
#418 carries on every push. The same page attributes a review a person requests to that person, so a
request in his name is billed as his click is.

**What this explains of issue #161, and what it does not.** The re-request in `copilot-review.yml` uses
`GITHUB_TOKEN`, so it is a bot's request too, which fits the *requested, accepted, and gone* signature
recorded on #157 and #248. It does not explain why #248, a person's pull request, drew no round after its
force-push: whether a push-triggered round is billed to the pusher is neither documented nor measured here.

**His one step, before the merge.** In the repository's Settings, Environments, create
`copilot-request` and limit its deployment branches to `main`. Create a fine-grained personal access
token with this repository as its only resource and *Pull requests: Read and write*, and add it to that
environment as secret `COPILOT_REQUEST_TOKEN`. Before the merge, so the first bot-authored pull
request after it finds the token; without one, that run goes red and names this step. The alternative
needs no token: the organisation paying for these reviews through its *AI credits paid usage* policy, which
costs the organisation per round. If he takes it, this workflow should be removed, or it requests every
round twice.

**Why no proposal.** The gate map sends an idea that adds an axis, a mode or a surface to a proposal. This
adds none of them: it carries the existing rule, a Copilot round awaited on every head, to pull requests
the ruleset never reached. The one new thing, an unattended act under his credentials, is what the
identity table exists to record, so it is recorded there. The counter-argument is precedent: proposal
`0015` changed which identity files the librarian's pull request, and was a proposal, but it reversed a
recorded refusal and this reverses none. The nearest rule is the table's own, that conversation does not go
out under his credentials. A review request says nothing, and the new row names what it costs: the
timeline line reads as his click. Proposal `0015` also holds that a settings change with no proposal behind
it is a floor nobody can audit, and this one adds an environment and a secret and widens what his
credentials do unattended. Its written record is the identity row and this handoff. The secret is one
fine-grained token, for one repository, with *Pull requests: Read and write*, usable by one workflow on
`main` and created by the maintainer himself, and the first bot-authored pull request after the merge is
the observation that confirms or retires it. The call not to write a proposal is the coordinator
session's, under the maintainer's delegation of design questions of 2026-09-23.

**How it was tested, and what was not.** The file was parsed as YAML, and its step was run as Actions runs
it, under `bash -eo pipefail`, against a stub `gh` in nine cases, from a directory holding files the
unquoted logins would glob to. No token and an empty token went red with no call. A refused call went red
after one call, printing `gh`'s message and the 422 body. An answer listing `Copilot`, or
`copilot-pull-request-reviewer[bot]`, went green after one `POST` to `requested_reviewers` naming the
Copilot login. An answer listing nobody, only a person, nothing at all, or something that is not JSON went
red, each naming its fault. The filters recipe runs the workflow's `jq` program against five fixtures. The
`if:` condition, `pull_request_target` and the environment cannot run outside GitHub, and this pull request
cannot exercise them, since the copy of the file that runs is the one on `main`.

**Observation, not yet run (proposal 0007).** It works when a bot-authored pull request's timeline shows,
at this workflow's time, the maintainer requesting Copilot and then "Copilot started reviewing on behalf of"
him, and `copilot-reviewed` finding the round. The first bot-authored pull request after the merge is that
observation, and its handoff records what it showed.

**Checkpoints.** None ran in a fresh context, by his instruction of 2026-09-23 12:38. The coordinator
session reviewed the diff before the commit; his review is on the pull request.

**Left as found.** The identity table's row for opening a pull request by a person or a session names the
maintainer's credentials, and sessions in the cloud now open them as `claude[bot]`. The awaited-review
memory record's sentence that Copilot is requested on every pull request by ruleset records a belief, and
stays.

**Next action.** His setup step, then the observation on the first bot-authored pull request after merge.
