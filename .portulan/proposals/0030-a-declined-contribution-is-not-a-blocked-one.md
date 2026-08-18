# Proposal — a declined contribution is not a blocked one

**Status. OPEN — drafted 2026-08-17, on the maintainer's instruction to handle
[`0004`](0004-ci-runs-every-declared-recipe.md)'s deferred fork decision together with
[#67](https://github.com/sleepy-panda-srl/portulan/issues/67).** Two questions come due at the same
event and are answered here together, because one is the other's premise.

`0004` deferred the fork threat model with an explicit trigger: *"The exposure is bounded today by
`permissions: contents: read`, no secrets, and a private repository … At the milestone-3 public flip it
needs deciding properly."* The flip is that event. #67 blocks the `copilot-reviewed` floor join on a
measurement about fork pull requests. Both are about forks; neither is about the same risk.

## What is measured, and what is not

Measured on this tree, 2026-08-17, rather than recalled:

| Fact | Instrument | Reading |
|---|---|---|
| `verify.yml` trigger | the workflow | `pull_request` — **not** `pull_request_target` |
| its token scope | the workflow | `permissions: contents: read` |
| secrets referenced | `grep 'secrets\.' .github/workflows/verify.yml` — that file only | **zero** |
| Actions cache used | the workflow | **none**, deliberately, and it says so |

Those four together are the whole of the fork exposure argument, and three of them are the bounds `0004`
named. **Only one of `0004`'s three bounds fell at the flip.** On `pull_request` from a fork GitHub issues
a read-only token and withholds secrets — that is platform behaviour, not this repository's configuration,
and it does not depend on visibility. So what a fork pull request can still do is run arbitrary code from
its own tree on an ephemeral runner with a read-only token, no secrets, and no cache to poison.

**Not measured, and it is #67's whole subject:** whether Copilot requests a round on a fork pull request.
That measurement needs a pull request opened from a second GitHub account, which no agent in this build
has; it is the maintainer's to run, or to decline as unnecessary given the proposal below.

## The proposal

**1. `0004`'s deferred decision is answered: the residual fork exposure is accepted, and it is named
rather than mitigated.** Arbitrary code on a runner with no secrets, a read-only token and no cache is
runner abuse — a cost GitHub absorbs and every public repository with CI carries. Nothing repository-
specific is reachable. No workflow change is proposed. What *would* change the answer is any of: adding a
secret to `verify.yml`, switching it to `pull_request_target`, or introducing a cache — so those three are
the re-open conditions, stated here so the next person changing the workflow meets them.

**2. #67's blocker is dissolved rather than measured, because its premise does not hold for this
repository.** #67 reasons that a required `copilot-reviewed` would leave *"every outside contribution
[sitting] pending for twenty minutes and then red out, with no action its author can take — a floor row
failing on exactly the audience a public repository exists to attract."* That is the right worry for a
repository that accepts outside code. **This one declines it, by a ruling that predates the issue and is
stated to contributors in advance**: `CONTRIBUTING.md` says pull requests from outside the organisation
are not accepted and will be closed with a pointer to that file. So a fork pull request's check status
changes nothing about its outcome — it was going to be closed either way — and a red check is not the
thing turning a contributor away; the documented policy is, before they write a line.

**The audience premise is the part worth being precise about.** A public Portulan repository does exist to
attract strangers — to read, clone, fork, file bugs, propose, and send feedback. It does not exist to
attract patches. #67 conflated *reachable* with *open to code*, which was a fair conflation to make while
the repository was private and neither was true.

**3. Therefore the floor join is unblocked on this argument, and the join itself stays Gated and the
maintainer's.** Recommended shape when he takes it: require `copilot-reviewed` and let it red on fork pull
requests, with the behaviour named in the gate map beside the join paragraph rather than worked around in
the workflow. An exemption would be machinery bought for a case the contribution policy already closes.

## Arguments against, because this proposal is an acceptance and those need them

- **It accepts an exposure instead of removing one.** True. The alternative — refusing to run CI on fork
  pull requests — buys nothing here, since the run has nothing to steal, and costs the one honest signal a
  declined contributor gets about whether their idea would even have passed.
- **It resolves #67 by argument where #67 asked for a measurement.** Also true, and it is the weaker form:
  a measurement would settle whether Copilot covers forks for anyone who later changes the contribution
  policy. **The measurement stays wanted and #67 should stay open until someone runs it**; what this
  proposal removes is its status as a *blocker* on the floor join, not its value.
- **The contribution policy could change.** `CONTRIBUTING.md` says so in as many words and promises the
  change will be dated there. If it does, clause 2's premise goes with it and this proposal is re-opened
  by the same event — which is why the premise is named here rather than assumed.

## Decision

_Undecided. The maintainer's, as both a doctrine question and a Gated settings act._

**Pull request:** [#282](https://github.com/sleepy-panda-srl/portulan/pull/282) — the change that filed this.
