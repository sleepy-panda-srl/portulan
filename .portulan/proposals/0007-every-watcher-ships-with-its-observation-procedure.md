# Proposal — a watcher earns its place by being watched

**Incident.** PR #22 added [`../../.github/dependabot.yml`](../../.github/dependabot.yml) to watch the
Actions pins, because nothing had noticed that a pinned `actions/checkout` declared a runtime GitHub had
been deprecating for months. A watcher was adopted to fix *nothing was watching*.

Nothing then confirmed the watcher worked, and for five days nothing could:

- version-update jobs have **no REST endpoint**;
- **no `dependabot` check run existed** on any commit checked — PR #22's head, the rebased `91e3578`,
  `main` — so there was no in-Checks signal either;
- the pin already sat on the newest release, so the correct behaviour was to open nothing.

Together those made *"Dependabot opened no pull request"* indistinguishable from *"Dependabot never ran."*
**Silence was simultaneously the success state and the failure state** — the same shape as the incident PR
#22 was written to fix, where the only notification was a warning nobody was obliged to read.

That makes this the **third instance of
[`../memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
in one subject area**, and the first where the unchecked mandate is *itself a checker*. A rule that keeps
recurring in a new form is a rule stated too narrowly.

**How it was closed — by observation, not argument.** The pin was deliberately regressed one patch to
v7.0.0 (PR #25), which is this repository's standing bar — force a check red before believing its green —
applied to the one check that had never been forced. Dependabot then opened PR #27, *"Bump actions/checkout
from 7.0.0 to 7.0.1 in the actions group"*, whose entire diff is one line:

```
-      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

That demonstrated three things at once, all previously asserted and none previously shown: the watcher
runs; the grouping config applies; and **Dependabot rewrites the SHA and its trailing version comment
together**, which is the only reason a version-update config is compatible with a SHA-pinning policy at
all. Merging PR #27 was simultaneously the proof and the revert — the experiment cleaned up after itself.

**Proposed rule.** Into [`../gate-map.md`](../gate-map.md), under the platform floor:

> A watcher earns its place by being watched. Anything added here whose job is to notice something — a
> bot, a scheduled job, a required check, an alert, a review request — ships with the procedure that
> would demonstrate it works, and that procedure is run once and its result recorded. Where no such
> procedure exists, the artifact says so in as many words, and says that its own silence is not evidence.

**Enforcement.** Weaker than the rule deserves, and stated plainly rather than dressed up, per
[`../memory/a-checker-must-refuse-what-it-cannot-check.md`](../memory/a-checker-must-refuse-what-it-cannot-check.md).

- **Not machine-checkable today.** `doctor` cannot evaluate it. Whether a watcher works is a fact about
  live services and the outside world, and `doctor` already reports that branch protection and live
  settings are things it does not fetch. This rule is prose about the world, which is the one class this
  repository's machinery has never been able to check.
- **What makes it more than taste** is that it names an *artifact* obligation, not an attitude: a change
  that adds a watcher either carries a stated observation procedure or carries a sentence admitting it has
  none. Both are visible in a diff, so a reviewer can ask for one at pull-request time even though no
  script can.
- **Candidate input for milestone 4.** The enforcement compiler takes the gate map as its input. "A
  declared watcher must declare its observation procedure" is closer to compilable than most prose rules
  here, because both halves could become manifest fields. Retire the prose if the compiler subsumes it.

**Provenance.** `form=link`
`href=`[`https://github.com/sleepy-panda-works/portulan/pull/22`](https://github.com/sleepy-panda-works/portulan/pull/22)
— the change that added a watcher and no way to know it worked. The demonstration that closed it is
[`#25`](https://github.com/sleepy-panda-works/portulan/pull/25) and
[`#27`](https://github.com/sleepy-panda-works/portulan/pull/27). All in-repo and resolvable by anyone who
can read this rule, carrying no client material, so no seal is needed — "resolvable" here does not mean
public. Retire the rule if the enforcement compiler subsumes it, or if this repository stops adding things
whose job is to notice.

**Honest limits.**

- **Not every watcher can be forced red safely.** This one could, because the regression was one patch on
  a same-runtime release and cost a few minutes of a required check running an older action. A watcher for
  something destructive, rate-limited, or irreversible may have no safe red test, and the rule's fallback —
  say so in the artifact — is genuinely weaker than a demonstration. The rule prefers evidence and settles
  for an admission; it should not pretend those are equal.
- **The rule closed its own live instance, on this file's own pull request.** The ruleset `copilot
  auto-review on pull requests` (id `19805871`) was added 2026-07-27 so that every pull request gets a
  Copilot review requested without anyone remembering to ask. When this proposal was first written its
  effect was **unobserved**, and it said so: created 09:30:38Z, while the Copilot review on PR #26 was
  hand-requested at 09:26:44Z and arrived at 09:28:00Z — two and a half minutes *before* the ruleset
  existed, so that review was not evidence for it.

  **Observed on [#28](https://github.com/sleepy-panda-works/portulan/pull/28), the first pull request opened
  after that timestamp: Copilot was requested at 09:39:15Z, the same instant as the `CODEOWNERS` team
  request and therefore at pull-request open, with no request made by the maintainer or by the agent.** The
  timestamps are what make that conclusive rather than the attribution — GitHub credits a ruleset-driven
  request to the author's context, so the actor reads as the maintainer either way. What separates the two
  cases is that #26's request arrived three minutes after open, by hand, and #28's arrived simultaneously
  with the automatic one.

  The whole exchange is left here rather than trimmed to its result, because the shape is the point: the
  observation procedure was written down while the answer was still unknown. That is the only order in
  which it is a procedure rather than a description of something that already happened — and it is the
  order this rule is asking for.
- **Three instances suggest the parent rule is stated too narrowly.**
  `a-mandate-nothing-checks-is-already-broken` reads as being about *mandates*. Two of its three instances
  were mandates; this one is a checker. The word that covers all three is closer to *anything adopted in
  order to make a problem stop recurring*. Generalising it is a separate change and is not proposed here,
  because widening a rule in the same breath as instantiating it makes both harder to review.

**Decision.** _Accepted — Marius Cetanas, 2026-07-27._ He directed the demonstration that closes the
incident and then accepted the general rule. Written by an implementer agent (Claude Opus 5).

**Status: ACCEPTED and APPLIED, 2026-07-27.** The rule is in [`../gate-map.md`](../gate-map.md) under the
platform floor, with the three demonstrations above carried across as its worked examples and both honest
limits carried with it — that nothing in this repository can check the rule, and that not every watcher has
a safe red test. Applied in a change separate from the one that proposed it, the same sequence
[`0006-dependabot-security-updates.md`](0006-dependabot-security-updates.md) followed, so that the record
shows a decision taken rather than a proposal that applied itself.
