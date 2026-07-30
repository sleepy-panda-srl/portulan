# Changelog

Every release of Portulan, and what changed in it. Kept because
[`docs/plan.md`](docs/plan.md) — Protocol → Versioning — requires a changelog per release; SemVer
from `v0.1.0`, and from milestone 8 each release carries an eval result as well.

**`## Unreleased` accumulates.** A change that a reader of a release would want to know about adds its
entry as it lands; the cut then renames that heading to the version and dates it, in a change merged
before the tag is created, so the tagged tree still contains its own entry.

_The rule this replaces said only that the file "is written in the change that cuts the release", which
makes a heading named `Unreleased` one that must always be empty. **The ground for changing it is not
that accumulation was already the practice — it was not.** The record is one accumulating write, at
milestone 4 session 0, and then two sessions that saw the sentence go false and **deliberately declined
to fix it**, citing this header: [#85](https://github.com/sleepy-panda-works/portulan/pull/85) and
[#87](https://github.com/sleepy-panda-works/portulan/pull/87) cut no release, so under the old rule
editing the file would have contradicted it. That is the actual refutation, and it is worse than mere
drift: the rule made a **known-false sentence unfixable**, and it stayed false for a day, across the
close of a second milestone. A rule whose only compliant response to a falsehood is to leave it standing
is the shape
[`.portulan/memory/a-mandate-nothing-checks-is-already-broken.md`](.portulan/memory/a-mandate-nothing-checks-is-already-broken.md)
names. The maintainer's ruling, 2026-07-29 — recorded verbatim, with the two alternatives he declined,
in a comment on [#94](https://github.com/sleepy-panda-works/portulan/issues/94) and again in the pull
request that closes it. It settles the half that issue routed to him, not merely the stale sentence that
prompted it._

_**What accumulating does not license.** The bar is still what a *reader of a release* gets, not what a
session did: the Session log in [`docs/plan.md`](docs/plan.md) is the per-session record and this file
must not grow into a second one. Nothing checks the bar. It is the same judgement the date rule above is
left to, and for the same reason._

**A date here is the day the release was cut, in the maintainer's timezone (Europe/Bucharest) — not
the `git tag` timestamp. The merger corrects the date if the cut slips past midnight.** The timezone
is named because "past midnight" means nothing without one, and that ambiguity is the part that would
actually bite. Nothing checks this: the true cut date is exactly the class of fact `doctor` never
judges, and the one readable artifact — the tag's own timestamp — is the thing this rule declares
non-authoritative. It is human-owned prose on purpose, and it is not a candidate for a lint.

The Session log in [`docs/plan.md`](docs/plan.md) is the fuller record — it is per *session* and it
records how things were found. This is per *release* and records what a reader gets.

## Unreleased

**Packs become real: the cascade's middle layer.** `core < pack < workspace` has been the architecture
since the constitution and was implemented in nothing — a workspace's `packs` array was a list of names
that `doctor` counted. Now [`spec/pack.schema.json`](spec/pack.schema.json), the **Pack Definition**,
says what a pack contributes to that cascade: skills, personas, verify recipes, and gate-policy
fragments. A declared pack **resolves** to a manifest, validates against the Definition, and its
contributions reach the tools that consume them.

**A pack's gate fragments may only ever add restriction.** A pack contributing to the gate map means an
installed dependency can change what an agent is allowed to do, so the rule is that a pack may raise a
tier or add a prohibition and may **never** demote one. Enforced on two axes and in two layers: `auto` is
absent from the fragment tier enum, so a demotion to unattended is unexpressible in a manifest at all;
and [`cli/compile.mjs`](cli/compile.mjs) refuses — loudly, at build time — both a weakened tier and a
**changed action**. That second axis is the one a tier-only check misses: raising a rule's tier while
replacing what it matches removes the gate and still reads as a tightening.

**The first pack: [`rituals/checkpoints`](packs/rituals/checkpoints/README.md).** The supervised-build
ritual this project runs on itself, now a distributable artifact — session-open, pre-commit and
milestone-close skills, a `supervisor` persona, and the verdict vocabulary. It carries no Sleepy Panda
specifics and does not set the adopter's triage boundary, because a ritual that cannot scale down is one
that gets switched off wholesale.

**A pack now resolves from a private feed, and the feed points rather than copies.** The
`portulan-internal` marketplace publishes the checkpoint ritual pack by sourcing this repository's
`packs/` directory through `git-subdir`, pinned to a commit — so the private feed owns the entry, the
version, the pin and the access gate, while the bytes stay in the public layer that authored them. The
alternative, copying universal content into the private side, would have put a second carrier of one file
where no public check can see it. Measured on Claude Code 2.1.220 before it was relied on, including that
a `sha` pointing at a commit from before the pack existed is **refused**.

**`--pack-root` on `compile`, `doctor` and `index`.** A resolution root can now be named on the command
line, searched *before* the one derived from `tree`. The resolver has taken roots as an argument since the
Pack Definition landed and nothing set them, so the from-a-feed case existed in the code and had no way in
from a shell. Named roots **replace** the derived one rather than preceding it, on purpose: a
demonstration that a pack resolved *from the feed* must not be satisfiable by a copy sitting in the local
tree at all. Two of the three tools replaced and one appended when this first landed — a workspace with the
pack in its own tree compiled green against an empty named root — so the divergence is now pinned by a test
rather than held in line by prose. What is still not built is *discovery* — nothing finds a
host's plugin cache on its own.

**Workspace Definition 2.6: a pack-declared memory scope lands in the adopter's own layer.** Two optional
keys — `slots.personas`, the layer, and `personas.index.path`, a generated index over it. A persona shipped
by a pack declares its memory scope in prose; a composing workspace now lands one **empty** directory per
declared scope in the layer it owns, and the index makes the arrival checkable: every field on a line is
derived from the pack, including a digest over the scope's own text, so a pack that rewords a scope turns
the byte comparison red. A sweep reports any location no composed persona declares, and a pack that ships
memory records of its own is refused — storage follows ownership in both directions. Nothing reads these
locations yet: `doctor` validates a persona against its five-part contract at milestone 7, which is the
maintainer's *"row 6 declares, row 7 validates"* split. A MINOR: nothing tightened, no migration owed.

**A pack can ship skills at last.** A declared skills path resolved one level down, so the natural pack
layout failed as *"has no SKILL.md"*. The walk is now bounded at three levels and **reports where it
stopped** rather than going green over what it did not reach.

**Version trains split.** The Pack Definition versions independently of the Workspace Definition, which
stays at 2.5 and is byte-unchanged: one number governing both contracts would make a bump in either mean
a change in the other.

## 0.2.0 — 2026-07-29

**Two milestones and the reconciliation that followed them** — milestone 4 closed 2026-07-28, milestone
5 closed 2026-07-29. [`docs/plan.md`](docs/plan.md) carries the signed close verdicts and
[`docs/milestones/`](docs/milestones/) the evidence behind each.

_Grouped by what a reader gets, not by the session that shipped it. What this replaces led with
`Milestone 4, session 0 … the milestone is open` — a lead pinned to a session, stale the moment the next
one landed, which is what happened twice and is
[#94](https://github.com/sleepy-panda-works/portulan/issues/94). **This cut is also that issue's
resolution:** rather than repair the section in place and leave two milestones sitting untagged against
Protocol → Versioning's "changelog per release", the maintainer ruled the release be cut. The accumulate
rule above governs the interval that starts here._

**The enforcement compiler.** [`cli/compile.mjs`](cli/compile.mjs) reads a workspace's gate policy and
generates the host's own enforcement. `.portulan/gates.json` binds actions to tiers in a **host-neutral**
vocabulary — `{"shell": "git push"}`, never a host's matcher syntax — so a second backend translates the
same policy rather than forcing adopters to rewrite theirs. Every rule ends as **compiled** or **refused
with a stated reason**, both printed, both asserted by the suite: a rule that goes in and produces nothing
would leave a policy that reads as enforced and a machine that enforces nothing.

**A Stop-gate that actually blocks.** [`.portulan/compile/stop.mjs`](.portulan/compile/stop.mjs) runs the
workspace's default verify recipe when an agent tries to end its turn, and blocks on red *or* on exit 2 —
"nothing looked" must never read as "nothing wrong". It also enforces the session-end handoff, which
`core/operating/loop.md` had promised to this milestone. Capped at three **consecutive** refusals **per
reason**, each reason's count clearing only when that reason's own condition clears, with an absolute
ceiling of nine that does not reset — because a host's end-of-turn event is not the doctrine's "task
finished" and a gate that cannot stop is a hang. _(Per-reason rather than per-session because the
session-wide count gave a missing five-line handoff three times the patience of a failing suite; the
asymmetry is the maintainer's own observation, and the generalisation is
[`.portulan/tasks/0007-per-reason-stop-gate-counters.md`](.portulan/tasks/0007-per-reason-stop-gate-counters.md).)_

**Workspace Definition 2.1** — one optional `gates` key, additive. `slots.gates` keeps the prose that
argues the policy; `gates` points at the policy that compiles. Rule ids are cited from the prose and
membership is checked both ways.

**A sixth verify recipe**, `compile`, so a policy edited without recompiling fails CI with no workflow
edit — the fourth payout of the mechanism in proposal 0004. **A seventh**, `workflow-filters`, executes
every `jq` filter a workflow runs against fixtures rather than trusting it to be read correctly by eye —
a rail over the one layer of this repository that CI could not otherwise check, since a workflow's own
logic never runs until the event fires.

**The platform floor, compiled from the same policy.** A second backend emits an importable GitHub
repository ruleset — `pull_request`, `required_status_checks` (**strict**, unconditionally),
`non_fast_forward`, `deletion` — as [`.portulan/compile/github-ruleset.json`](.portulan/compile/github-ruleset.json).
It is positioned as the **floor**: what every host falls back to, and all that a host with no hook system
has. It **generates and never applies** — importing a ruleset is a repository-settings change, which is
outward and Gated. **Most of its rules refuse, and the refusals are the deliverable's honest half** —
each carries a reason scoped to *this export* rather than to GitHub, because the blanket version (*the
platform gates a ref, not a path*) is false. Coarseness is printed in both directions:
`non_fast_forward` is *stricter* than this policy, blocking a `--force-with-lease` spelling that is Auto
here. The live counts are `compile --matrix`'s to print and are deliberately not copied into this file,
which is how a figure goes stale in a second carrier.

**A per-host backend matrix and a degradation report.** `compile --matrix` is derived from the backends
rather than maintained beside them, and `doctor`'s `enforcement` check reports per-backend coverage plus
the **three gates neither backend compiles** — rename-or-transfer, spend money, send something outward.
Both name them, because a policy stating a gate that nothing enforces must never read as configured.

Two limits are shipped stated rather than discovered. A compiled permission rule matches a **spelling**:
the hook peels one shell wrapper and no more, and the platform floor is the only layer indifferent to how
a command was written. And nothing in CI can prove the host *honours* the artifact — CI installs nothing,
so that is measured at the supervised checkpoints and version-stamped.

**For anyone installing the plugin: nothing here enforces on you.** The compiled settings ship in the
payload as an ordinary file and are inert for an installer — measured, with a control. No `hooks/`
directory ships, and that is deliberate: a plugin carrying one has its hooks fire in *your* projects.

**A generated memory index, and a budget that is a rail rather than diligence.**
[`cli/index.mjs`](cli/index.mjs) emits a workspace's memory index from its store — every field on a line
derived from the record it points at, so there is nothing in the file an editor could put out of step
with the store — and judges it against budgets the manifest declares. `index` is the **eighth** verify
recipe, declared in the manifest so CI enforces it with no workflow edit, and it byte-compares the index
as well as checking the budgets: an index that is merely *stale* is as red as one that is over. **Two
axes rather than one**, because an index whose record count never moves cannot see a store doubling in
bytes — `index.budget.lines` rails the count, `store.budget.kilobytes` rails the size an index cannot
see, and `index.budget.columns` closes the hole a line budget leaves. None is defaulted, and a budget
that is not a positive integer is refused rather than read as absent, since `lines: 0` would otherwise
switch off the rail in the very key that exists to switch it on. **The permitted remedy for a breach is consolidation, never a budget raise in
the same change** — and that half is a human-gate rule, not a rail, because refusing a raise needs a check
that reads git history and such a check produces false reds in a shallow CI checkout. Both halves are
written down rather than one being implied by the other's green.

**A consolidation skill** — [`core/skills/consolidate/SKILL.md`](core/skills/consolidate/SKILL.md), the
procedure a breach is answered with. Steps 3 and 4 stay human.

**A scheduled librarian, with an identity of its own.** [`cli/librarian.mjs`](cli/librarian.mjs) reindexes
both series, ages every record from git, nags a sealed stamp's owner to re-validate, chases undecided
proposals and drafts demotions, and mines incidents and pull-request reviews into **candidates a human
files as proposals**. [`.github/workflows/librarian.yml`](.github/workflows/librarian.yml) runs it weekly
and files the result as a pull request. **A pass is a session**, so it ends with a dated handoff and one
Session log entry exactly as a human session does. It files as the `portulan-agent` GitHub App rather than
with `GITHUB_TOKEN`, because a pull request opened with the repository's own token **starts no workflow
runs** — so the two contexts the floor requires would never report and the pull request could never merge.
The pass keeps **no state between runs**: every figure is recomputed from git and the tree, which is why
two runs over an unchanged store produce byte-identical output.

**Proposals are pull requests.** `docs.sh` gained a `proposal` check requiring every proposal to name the
pull request that carried it, resolved through GitHub's own commit→pull-request mapping rather than from
memory.

**An index over the handoff series**, on the same generation terms as the memory index — but deliberately
**no budget**. A handoff series is append-only by construction, so every remedy a budget permits is barred:
retiring a handoff to buy headroom would either red the log↔handoff correspondence check or destroy the
record it exists to keep. A rail designed to be broken is not shipped.

**Workspace Definition 2.2 → 2.5**, every bump additive and nothing defaulted: `floor` (2.2) — and `strict`
is deliberately **not** declarable, so a policy cannot undo proposal `0011` in a diff nobody reads as one;
`memory` (2.3); `librarian` (2.4), carrying staleness intervals but **not** the cadence, because how often
a host runs a job is the host's scheduler and a cron expression in a file nothing reads is configuration
pretending to be policy; `handoffs` (2.5).

**The milestone table stopped being its own archive.** 55,643 characters moved **verbatim** out of the
milestone rows in [`docs/plan.md`](docs/plan.md) into [`docs/milestones/`](docs/milestones/), one file
per milestone — the row keeps the binding criterion and the signed verdict, the file keeps the
legislative history. The only edit permitted in the move was re-basing relative links one directory
deeper, and each re-basing was enumerated in the pull request that made it. `docs.sh` gained a `plan` check that holds the split: a Status cell is
capped at 500 bytes, amendment and session-note markers are refused inside a row, and an unparseable row
is refused outright.

### Known limits, stated rather than discovered

- **The CLI is still not the CLI milestone 7 describes.** `compile`, `doctor`, `index`, `librarian` and
  `plugin-lint` exist; `init`, `vendor`, `upgrade`, `new` and `feedback` do not.
- **No import has ever been attempted.** The ruleset export's acceptance by GitHub's importer is inferred
  from the documented schema plus an observed envelope, not shown. Exported-versus-live drift is compared
  by hand at the supervised checkpoints and by nothing automatic.
- **The cron has never fired.** Every librarian pass so far was dispatched by hand; the first natural run
  is 2026-08-03. Every staleness threshold is unfired on a store days old, so the nags were measured only
  under forced one-day thresholds.
- **Mining reads the smaller channel** — inline review comments carrying a path, never the suppressed
  low-confidence notes, which have in fact produced most of the real findings here.
- **Per-agent memory is still unbuilt.** `core/operating/memory.md` scopes memory per agent or persona;
  nothing implements it, and the doctrine names milestone 6 as where the first instance is *owed*.

## 0.1.0 — 2026-07-26

The first tagged release. Pre-release in the SemVer sense — the `0.` major says the interfaces below
may still move, and the Workspace Definition has already had one breaking revision (1.0 → 2.0) before
any tag existed.

**The engine** — [`core/`](core/). An always-loaded kernel under a 60-line budget
([`core/engine.md`](core/engine.md)); six operating documents (the loop, autonomy tiers, verification,
memory, evolution, safety); three personas as context firewalls; two universal skills, `clarify` and
`codify`; five templates.

**The Workspace Definition** — [`spec/`](spec/), at spec version **2.0**. A JSON Schema over a named
subset of 2020-12, a per-slot document where every slot cites what it was derived from, and the
1.0 → 2.0 migration. A workspace declaring `kind: repository` must declare its `tree`; that constraint
lives in `doctor` rather than in the schema, because the declared subset has no `dependentRequired`.

**Two validators, neither a superset of the other** — [`cli/`](cli/), zero dependencies, no build step.
`doctor.mjs` validates a workspace against the definition and lints its claims against the tree.
`plugin-lint.mjs` validates this repository's packaging. Both exit `0` valid / `1` not / `2` could not
run, and the third code is never spent on a verdict.

**A demo workspace** — [`examples/`](examples/). A fictional urban-beekeeping co-op with two products,
written to exercise what this repository's own workspace cannot: repeated products, affordance
inheritance, declared packs, a sealed provenance stamp.

**The Claude Code plugin, and the marketplace that ships it** — [`plugin/`](plugin/) and
[`.claude-plugin/`](.claude-plugin/). A `/portulan` boot skill that loads the kernel and reads the
*project's* workspace rather than its own bundle's; the three personas bound as host agents; the
engine's skills shipped as the same files `core/` documents, never copies.

### Known limits, stated rather than discovered

- **The CLI is `doctor` and `plugin-lint` only.** `init`, `compile`, `vendor`, `index` and `upgrade` are
  named in the plan and do not exist. Nothing drafts a workspace for a team that has none.
- **No hooks and no settings ship.** The gate map is honoured by people and by review; the compiler that
  turns it into enforcement is milestone 4. Packaging a hooks file now would ship an enforcement that
  does not exist.
- **Nothing runs the verify recipes for you.** They are executable and CI runs them on every pull
  request; the Stop-gate that blocks a "done" claim on a red recipe is milestone 4.
- **Memory has no generated index.** Recall means reading the directory.
- **The repository was private at this tag.** It was to go public after a clearance tracked outside it. _(2026-07-27: it went public on the maintainer's directive ahead of that clearance — see docs/plan.md, Session log.)_
