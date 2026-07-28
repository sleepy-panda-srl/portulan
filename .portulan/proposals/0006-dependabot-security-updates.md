# Proposal — turn on the dependency graph, Dependabot alerts, and Dependabot security updates

**Incident.** Milestone 3, immediately after close. The pinned `actions/checkout` in
[`../../.github/workflows/verify.yml`](../../.github/workflows/verify.yml) had been declaring
`using: node20` for as long as GitHub had been deprecating that runtime, and the runner was quietly
substituting Node 24 behind it. Nothing in the repository noticed. **The warning in a green run's log was
the entire notification mechanism**, and it was only read because somebody happened to look.

That half is now fixed: [`../../.github/dependabot.yml`](../../.github/dependabot.yml) landed in PR #22
and watches the Actions pins for *version* drift. This proposal is about the half that fix does not
touch, and which is easy to believe is covered because the two share a name.

**Version updates are not security updates.** Version updates come from a config file in the repository
and answer *"is there a newer release?"* on a schedule. Security updates come from the GitHub Advisory
Database and answer *"is the version you have pinned known to be vulnerable?"* — and they are a
repository *setting*, not a file. Nothing that was merged in PR #22 turns them on, and no config file
can.

Read from the API rather than assumed, on 2026-07-27:

| Thing | State | How it was read |
|---|---|---|
| Dependency graph | **off** | `GET /repos/{o}/{r}/dependency-graph/sbom` → `404` |
| Dependabot alerts | **off** | `GET /repos/{o}/{r}/vulnerability-alerts` → `404` |
| Dependabot security updates | **off** | `security_and_analysis.dependabot_security_updates.status` = `disabled`; `GET /automated-security-fixes` → `{"enabled": false}` |
| Org default for new repositories | **off** for all three | `GET /orgs/sleepy-panda-works` |

They are three settings and they chain: the graph feeds alerts, and alerts feed security updates. Turning
on only the last one does nothing.

**Why it matters here specifically, and not as general hygiene.** This repository SHA-pins every action,
because the organisation's Actions policy requires it and the policy is right — a movable tag is a
supply-chain hole. But **a SHA pin is by construction a pin that never moves.** The policy that removes
the tag-hijacking risk creates a staleness risk in its place, and a pinned action with a published
advisory will sit there indefinitely looking exactly like a pinned action without one. The version-update
config partly covers this by accident — a fixed release usually ships as a new version — but "usually"
is not a mechanism, it can be weeks late, and it says nothing about severity.

The blast radius is not theoretical. `actions/checkout` runs on every pull request and on every push to
`main`, inside the job that reports **`workspace-verify`** — the required status check, with
`enforce_admins` on ([`../gate-map.md`](../gate-map.md)). A compromised or vulnerable action there runs in
the same job that decides whether changes may land.

**Proposed rule.** Into [`../gate-map.md`](../gate-map.md), under the platform floor:

> Every dependency the repository pins is watched for published advisories by the platform, not by
> whoever remembers to look. Dependabot alerts and security updates are on, and the dependency graph that
> feeds them is on. A pin that cannot move on its own requires something that can tell you when it should.

**Enforcement.** Three repository settings, in this order — each is a prerequisite for the next:

1. **Dependency graph** — *Settings → Advanced Security → Dependency graph*. Required first; on a private
   repository the other two cannot be enabled without it.
2. **Dependabot alerts** — surfaces advisories against what the graph found.
3. **Dependabot security updates** — opens pull requests that move a pin off a vulnerable version.

All three are repository-settings changes and therefore **Gated**
([`../gate-map.md`](../gate-map.md)): the maintainer's to perform, never an agent's on inference.

**What the graph will actually see.** GitHub Actions is a supported ecosystem, so
[`../../.github/workflows/verify.yml`](../../.github/workflows/verify.yml) is the manifest. Today that is
one action, `actions/checkout`. There is no `package.json`, no lockfile, and nothing else tracked that
declares a dependency — `cli/` is zero-dependency Node by design and the verify recipes are POSIX shell.
So the immediate yield is small and should be stated as small: **this buys one watched dependency.** It
is proposed anyway because the mechanism, not the count, is the point, and because the count is a thing
this repository intends to grow.

**The cost, honestly.**

- **Security-update pull requests ignore `open-pull-requests-limit`.** That cap in
  [`../../.github/dependabot.yml`](../../.github/dependabot.yml) is 1, and it governs *version* updates
  only. A bad advisory week could open more pull requests than the weekly cadence implies, each landing
  through the same gate and competing for the same single reviewer's attention.
- **The dependency graph means GitHub parses repository manifests** and stores the result. On this
  repository that is the workflow file, which carries no client material — checked against the
  confidentiality seam rather than assumed. Worth naming rather than waving past, because the repository
  is **private today** and the flip to public is a separate authorization hold.
- **Alerts on a private repository are visible to anyone with the right permission**, which today is one
  person, and is a thing to revisit when it is not.
- **It adds a fourth thing that can open a pull request** against `main`. That is the intended behaviour
  and it is still a cost: the gate's value depends on somebody reading what arrives at it.

**What this proposal deliberately does not ask for.** No change to the pinning policy, the version-update
config, branch protection, or the required check. It asks for three toggles and one sentence in the gate
map. Bundling more would make a settings change into a doctrine change.

**Provenance.** Vision thesis 3 — rails, not prose; the platform floor in
[`../../core/operating/autonomy.md`](../../core/operating/autonomy.md); the rule
[`../memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md),
of which this is a second instance in the same subject area — SHA pinning was adopted as a mandate and
nothing was ever paired with it to answer for the drift it creates; and the incident above. Retire the
rule if the repository ever stops depending on anything it does not build.

**Decision.** _Accepted — Marius Cetanas, 2026-07-27._ Written by an implementer agent (Claude Opus 5); the
three settings are Gated, so this proposal exists to be decided rather than to be applied by whoever wrote
it. The gate here is a prohibition and not a platform refusal — a distinction this document of all
documents should keep, since its subject is two things being conflated because they share a name. The
agent identity's token cannot touch repository settings at all, but the dependency graph is the only one of
the three with no repository-level REST endpoint; alerts and security updates are both reachable by any
admin-scoped token, including the maintainer's own credentials that this repository already routes every
commit through. _(This paragraph read "an agent cannot perform them" as merged, and was corrected in the
same change that recorded the observations below.)_

**Status: ACCEPTED and APPLIED, 2026-07-27.** All three were enabled by the maintainer. What follows is
what the API returned *afterwards*, because that is the part that counts — flipping a toggle is a claim
about an intention, and only the probe is a claim about a state:

| Thing | Before | Observed after, 08:39:48Z |
|---|---|---|
| Dependency graph | `404` | `200`, and the SBOM lists `actions/checkout @ 3d3c42e5aac5ba805825da76410c181273ba90b1` — the exact SHA pinned in [`../../.github/workflows/verify.yml`](../../.github/workflows/verify.yml) |
| Dependabot alerts | `404` | `204` |
| Dependabot security updates | `disabled` | `enabled`, and `/automated-security-fixes` returns `{"enabled": true, "paused": false}` |
| Advisories against that pin | `403`, alerts disabled | `[]` |
| Org default for new repositories | off, all three | **unchanged, deliberately** — this asked about one repository, and the org default is a separate decision |

The estimate was right about the size, which is the more useful thing to have checked than the toggles:
the graph found **one** dependency, and the SBOM's only other entry is the repository itself. So the
mechanism is now real and its coverage is exactly the one action this repository pins.

`[]` is the shape worth having seen. Before the flip the same endpoint returned `403 Dependabot alerts are
disabled`, and the distance between those two answers is the distance between *a check that ran and found
nothing* and *a check that could not run at all* — which is the confusion this proposal was written about,
appearing one last time in the probe used to close it.

_Not closed by this: the **version**-update side from PR #22. Version-update jobs have no REST endpoint, so
no probe here can speak to them; that is read at Insights → Dependency graph → Dependabot, and the first
scheduled run is the Monday after this._

**Pull request:** [#23](https://github.com/sleepy-panda-works/portulan/pull/23) — the change that filed this.
