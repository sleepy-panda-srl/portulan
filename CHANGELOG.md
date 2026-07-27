# Changelog

Every release of Portulan, and what changed in it. Kept because
[`docs/plan.md`](docs/plan.md) — Protocol → Versioning — requires a changelog per release; SemVer
from `v0.1.0`, and from milestone 8 each release carries an eval result as well.

This file is written in the change that cuts the release and merged before the tag is created, so
the tagged tree contains its own entry.

**A date here is the day the release was cut, in the maintainer's timezone (Europe/Bucharest) — not
the `git tag` timestamp. The merger corrects the date if the cut slips past midnight.** The timezone
is named because "past midnight" means nothing without one, and that ambiguity is the part that would
actually bite. Nothing checks this: the true cut date is exactly the class of fact `doctor` never
judges, and the one readable artifact — the tag's own timestamp — is the thing this rule declares
non-authoritative. It is human-owned prose on purpose, and it is not a candidate for a lint.

The Session log in [`docs/plan.md`](docs/plan.md) is the fuller record — it is per *session* and it
records how things were found. This is per *release* and records what a reader gets.

## Unreleased

Milestone 4, session 0. Not tagged — the milestone is open and the remaining clauses are session 1's.

**The enforcement compiler.** [`cli/compile.mjs`](cli/compile.mjs) reads a workspace's gate policy and
generates the host's own enforcement. `.portulan/gates.json` binds actions to tiers in a **host-neutral**
vocabulary — `{"shell": "git push"}`, never a host's matcher syntax — so a second backend translates the
same policy rather than forcing adopters to rewrite theirs. Every rule ends as **compiled** or **refused
with a stated reason**, both printed, both asserted by the suite: a rule that goes in and produces nothing
would leave a policy that reads as enforced and a machine that enforces nothing.

**A Stop-gate that actually blocks.** [`.portulan/compile/stop.mjs`](.portulan/compile/stop.mjs) runs the
workspace's default verify recipe when an agent tries to end its turn, and blocks on red *or* on exit 2 —
"nothing looked" must never read as "nothing wrong". It also enforces the session-end handoff, which
`core/operating/loop.md` had promised to this milestone. Capped at three **consecutive** refusals, resetting on an observed green run of the governing recipe (the cap ends a futile-retry episode, not a long honest session), with an absolute ceiling of nine that does not reset — because a
host's end-of-turn event is not the doctrine's "task finished" and a gate that cannot stop is a hang.

**Workspace Definition 2.1** — one optional `gates` key, additive. `slots.gates` keeps the prose that
argues the policy; `gates` points at the policy that compiles. Rule ids are cited from the prose and
membership is checked both ways.

**A sixth verify recipe**, `compile`, so a policy edited without recompiling fails CI with no workflow
edit — the fourth payout of the mechanism in proposal 0004.

Two limits are shipped stated rather than discovered. A compiled permission rule matches a **spelling**:
the hook peels one shell wrapper and no more, and the platform floor is the only layer indifferent to how
a command was written. And nothing in CI can prove the host *honours* the artifact — CI installs nothing,
so that is measured at the supervised checkpoints and version-stamped.

**For anyone installing the plugin: nothing here enforces on you.** The compiled settings ship in the
payload as an ordinary file and are inert for an installer — measured, with a control. No `hooks/`
directory ships, and that is deliberate: a plugin carrying one has its hooks fire in *your* projects.

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
- **The repository is private at this tag.** It goes public after a clearance tracked outside it.
