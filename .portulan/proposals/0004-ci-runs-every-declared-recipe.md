# Proposal — CI runs every recipe the manifest declares, under one honestly-named check

**Incident.** No outage — a structural pressure, noticed while reviewing the milestone-2 change that
added a second verify recipe, and named by the maintainer as a question rather than found as a failure.

Adding [`../verify/json.sh`](../verify/json.sh) forced a choice with no good option:

- **A new CI job** would have had an honest name and would **not have been a required check.** `main`
  requires exactly one context, `docs-integrity`. A new job reports and does not block, so the recipe
  would have looked like a rail and been advisory — precisely the failure
  [`../principles.md`](../principles.md) names: *an unenforced rule in a repository with one reviewer is a
  rule that quietly stops being true.* Making it required is a branch-protection change, which is Gated.
- **A second step inside `docs-integrity`** — what was done — is required from the moment it merges, at
  the cost that the check's name is now wrong. `docs-integrity` runs a JSON parser.

The pressure recurs and gets worse on a known schedule: **`doctor` is the next recipe**, in the second
milestone-2 session. Then one context called `docs-integrity` runs docs linting, JSON parsing, and
workspace schema validation. Each new recipe re-poses the same choice, and the expedient answer is always
"add another step", so the name drifts further from what the check asserts. That the job id was chosen
deliberately for what it asserts is on the record — [`../../.github/workflows/verify.yml`](../../.github/workflows/verify.yml)
carries the reasoning, and the commit that set it says so in its title.

**Proposed rule.**

> CI runs **every recipe the workspace manifest declares**, in one required status check. Adding a recipe
> to `verify.recipes` makes it enforced — no workflow edit, no branch-protection change. If the manifest
> cannot be read, or declares no recipes, the check **fails** rather than reporting green.

Two things follow that are worth stating separately, because they are the actual point:

1. **New recipes are enforced by default.** The failure mode this removes is a recipe that ships
   un-required because someone forgot a settings change — the fail-open direction, in the one place this
   repository has a rail at all.
2. **CI becomes the first real consumer of a structured slot.** [`../../spec/slots.md`](../../spec/slots.md)
   argues that `verify` is data rather than prose because something consumes it: the Stop-gate needs an
   answer, not a paragraph. Today nothing consumes it, so that
   argument is a claim about the future. This makes it true a milestone early, and cheaply.

**The rename is a separate, sequenced, Gated step — and deliberately not part of this change.** Renaming
the job id in a pull request makes **that pull request** unmergeable: `docs-integrity` would stop
reporting, branch protection would wait for a check that never arrives, and `enforce_admins: true` means
the merge cannot be forced through. Other pull requests are unaffected — they still report the old
context. It fails closed, which is the safe direction, and it strands the rename behind the very settings
change it was trying to avoid sequencing: the maintainer can always edit branch protection, but now does
it out of order and under pressure. The sequence that works:

1. A pull request adds the new job **alongside** `docs-integrity`; both report. (Mergeable, because the
   required context still exists.)
2. **Gated, maintainer:** branch protection is re-pointed at the new context.
3. A pull request removes `docs-integrity`.

Recommended name: `verify` or `workspace-verify` — something that means *the workspace's verify recipes
ran*, which stays true however many recipes there are. Worth doing before `doctor` lands, though not
because the sequence gets more expensive — it costs the same three steps whenever it is done. What grows
is how wrong the name is, and the window in which someone reads `docs-integrity` on a red check and looks
in the wrong place.

**Enforcement.** The rule enforces itself by construction: the workflow reads the manifest, so a declared
recipe runs whether or not anyone remembered it. The guard against the obvious inversion is explicit — a
manifest that cannot be parsed, or that declares zero recipes, exits non-zero rather than reporting a
green it did not earn. That is the same rule as
[`verify-preconditions-fail-closed.md`](../memory/verify-preconditions-fail-closed.md), applied one level
up: enumerating the *recipes* is a precondition exactly as enumerating the *tree* is.

**Provenance.** `form=link`
`href=`[`https://github.com/sleepy-panda-works/portulan/pull/8`](https://github.com/sleepy-panda-works/portulan/pull/8)
— the milestone-2 pull request whose second recipe forced the choice. The maintainer's question that
prompted the proposal is not *at* that link; the link is to the change that created the situation. In-repo
and resolvable by anyone who can read this rule, and it carries no client material, so no seal is needed —
note "resolvable" here does not mean public: the repository is private until milestone 3. Carried so the
rule can be retired if the enforcement compiler's Stop-gate runner (milestone 4) subsumes it, which it
should.

**Honest limits.**

- **This does not fix the name.** It makes the name matter less, by ensuring the check's *contents* track
  the manifest rather than someone's memory. The rename still wants doing, and still needs a Gated step.
- **It does not change the fork threat model, in either direction.** CI already runs a script from the
  pull request's own tree — `./.portulan/verify/docs.sh` from the branch under test — so a fork PR could
  already execute arbitrary code in the runner. Reading the command from the manifest instead of the
  workflow adds no privilege. The exposure is bounded today by `permissions: contents: read`, no secrets,
  and a private repository, and it is **not bounded by this proposal**. At the milestone-3 public flip it
  needs deciding properly; that belongs with the milestone-4 runner, not here, and pretending otherwise
  would be this repository's own overclaiming failure.
- **The 0/1/2 contract is flattened at the job level.** A recipe that exits 2 (*could not run*) surfaces
  as a step exit of 1, because GitHub's status is binary; the `::error::` annotation carries the real code,
  so nothing is lost to a reader, but anything that later consumes this step's own exit code under the
  0/1/2 contract — the milestone-4 runner — must not read 1 as *ran and failed*.
- **One check still means one signal.** A red says a recipe failed, and you open the log to see which.
  Per-recipe contexts would be granular but would reintroduce the settings-change-per-recipe friction this
  removes. Collapsible log groups are the cheap mitigation, not a fix.
- **It adds a `node` dependency to the workflow itself**, not only to a recipe. Reading a JSON manifest in
  POSIX shell is the same bad trade rejected in [`../identity.md`](../identity.md), and runners ship
  `node`; but a future non-GitHub CI would need it too, and that is a real constraint rather than a
  detail.

**Decision.** Marius Cetanas — **accepted on instruction, 2026-07-25**, and applied in the same pull
request that carries this file. Recorded as a proposal rather than a bare change because the curated layer
changes through proposals ([`../../core/operating/evolution.md`](../../core/operating/evolution.md)), and
because the sequenced rename above needs to exist in writing before the next recipe lands. **The rename
itself is not done and is not authorized by this decision** — it needs the Gated step 2.
