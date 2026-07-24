# Portulan — Implementation plan (living document)

> Companion to `vision.md` (the constitution). This file is the build's working state:
> each session boots by reading it and closes by updating milestone status below.
> Locked 24 July 2026 with Marius Cetanas.
> At milestone 0 this file and `vision.md` move into the product repo as `docs/plan.md` +
> `docs/vision.md`; this folder becomes the repo working copy. Client-engagement specifics are
> governed by a private context file kept **outside** this repository.

## Decisions (locked)

1. **Open-core** — public monorepo `github.com/sleepy-panda-works/portulan` (permissive license;
   doubles as public plugin marketplace) + public `portulan-workspace-template` + private
   `portulan-internal` (Sleepy Panda feed). Commercial value in private feeds.
2. **The private pilot workspace stays outside this repo — entirely.** The predecessor framework
   that proved these concepts, and the pilot workspace derived from it, remain local to their
   owner's context: no hosted copy, no references here. Portulan's engine is authored as **fresh
   expression** — concepts may be re-expressed; prose is never copied. The repo starts **private**
   and flips public at milestone 3 only after the predecessor-IP clearance completes (tracked in
   the private context, not here). The seam scan (term list in the private context) runs before
   every commit.
3. **Proof workspaces:** fictional demo (public, `examples/`) + Sleepy Panda portfolio workspace
   (ALL Sleepy Panda products, Tipar API first) via the private feed. Workspaces ship as plugins.
4. **Two-tier supervised build** (see Protocol).
5. **Product shape: product-around-the-files, never an app-instead-of-files** — site, docs,
   community, pricing around the file-based core; no cockpit; no hosted SaaS except the
   self-hostable-first approval relay.

## Repo topology

```
sleepy-panda-works/
├── portulan                      PUBLIC  monorepo + public marketplace
│   ├── core/                     engine: operating docs, personas, universal skills, templates
│   ├── packs/                    stacks/ · tools/ · rituals/
│   ├── spec/                     Workspace Definition schema, docs, migrations
│   ├── plugin/                   Claude Code packaging (SKILL.md dirs, agents, hooks, settings)
│   ├── cli/                      init · doctor · compile · vendor · index · upgrade
│   ├── examples/                 fictional demo workspace
│   ├── .portulan/                this repo's own workspace — customer zero, dogfooding
│   ├── evals/                    golden tasks, A/B harness, CI eval gate
│   ├── docs/                     vision.md (constitution) · plan.md (this file)
│   └── .claude-plugin/marketplace.json
├── portulan-workspace-template   PUBLIC  "Use this template" scaffold
└── portulan-internal             PRIVATE Sleepy Panda feed (portfolio workspace + packs)
```

## Milestones

Status legend: `todo` · `in-progress` · `done (date, fidelity note)`

| # | Milestone | Sessions | Exit criterion | Status |
|---|---|---|---|---|
| 0 | Bootstrap | 1 | `sleepy-panda-works/portulan` skeleton pushed **as a private repo** (public flip happens at milestone 3 only, after the clearance tracked in the private context): license, README stub, directory scaffold per the topology above, `.gitignore` already excluding the bootstrap file, and this folder's `plan.md` + `vision.md` seeded as `docs/plan.md` + `docs/vision.md` | done (2026-07-24; Fable 5 verified live remote: PRIVATE, zero residue, criterion complete) |
| 1 | Core re-expression | 3 | `core/` authored fresh — zero copied prose, zero client references; every engine-relevant `vision.md` clause mapped to a home in `core/` or a recorded deferral; a real task runs end-to-end on engine + the repo's own `.portulan/` workspace, with a recorded red→green verify | done (2026-07-25; Fable 5 M1-close, fresh context: independent vision→core walk found 0 unmapped clauses — 44 covered, 14 recorded deferrals; verify rerun green; red pre-existed per git as an M0 omission; seam clean across files + history) |
| 2 | Workspace spec v1 | 1–2 | Manifest + **constitution & product-layer slots** (team principles; mission/what/why) + gate map + verify recipes + **agent-affordances slot** (portfolio-aware: many products per workspace); `doctor` validates the demo workspace (and, privately, the pilot) | todo |
| 3 | Plugin & public marketplace | 1–2 | Skills pass `skills-ref validate`; v0.1.0 tagged; fresh-machine install boots the engine with no local folder | todo |
| 4 | Enforcement compiler | 1–2 | `gates.yaml` → hooks + permissions (+ Copilot ruleset export); verify recipes → Stop-gate runner; per-host backend matrix + doctor degradation report. Demo: unapproved push blocked; "done" without green verify blocked | todo |
| 5 | Memory lifecycle & librarian | 1–2 | Generated size-budgeted index; consolidation skill; scheduled librarian (reindex, staleness, proposal nagging, demotion drafts) files its first real PR; proposals-as-PRs live | todo |
| 6 | Sleepy Panda workspace & private feed | 1–2 | `portulan-internal` marketplace live; a Sleepy Panda product task runs the full loop from a private-feed install | todo |
| 7 | CLI & onboarding | 2 | `npx @sleepy-panda-works/portulan` ships init/doctor/compile/vendor/index/upgrade; a never-seen repo onboards to a validated workspace in one afternoon | todo |
| 8 | Evals & telemetry | 1–2 | Golden tasks per core skill; A/B (Portulan on/off) baseline recorded; OTel opt-in config; a rule change merges or is rejected on eval evidence | todo |
| 9 | Fleet & v1.0 | 2+ | Headless PR-as-gate recipe; async approvals via the relay; PR-babysitter + bot-review ritual packs; compose with orchestrators (no fleet UI). **v1.0 = the demo and Sleepy Panda workspaces both boot green end-to-end** | todo |
| 10 | Product presence & commercial motion | 1–2 | portulan.dev docs site generated from the repo; quickstart + demo walkthrough; community (discussions, async-only); private-feed pricing; approval relay self-hostable. **A stranger can discover, evaluate, install, and buy without talking to anyone** | todo |

Sequencing rationale: bootstrap before surgery · re-expression before schema (derive the spec
from real content) · plugin after re-expression (the plugin IS the core) · compiler after spec ·
private feed after plugin+spec (dogfood the customer path) · CLI late (wraps proven mechanics) ·
evals before any rule-change cadence · product surface only after v0.1.0 exists.

## Protocol (every session)

- **Portulan builds itself with itself**: run the loop (research → plan → implement → verify →
  learn); write learnings back into the product repo's own memory. The repo is customer #0.
- **Two-tier supervised build.** Implementer: Opus 4.8-class. Supervisor: strongest available
  model, ALWAYS in a fresh context (subagent or separate session — never sharing the implementer's
  context). Three checkpoints: (1) session-open — supervisor approves the session plan against
  plan.md + vision.md; (2) pre-commit — fresh-context diff review against the milestone exit
  criterion; (3) milestone-close — supervisor verifies the exit criterion was *demonstrated* and
  records a signed fidelity note in the Status column. Divergence from vision.md is never silently
  fixed: implementation defect → back to implementer; design question → to Marius. Vision changes
  are human-owned.
- **Hard exit criteria.** A milestone closes only when demonstrated, not asserted.
- **The seam.** Client-confidential material from the predecessor engagement — names, identifiers,
  ticket ids, paths, domains, connection details — never enters this repository: not in files,
  commit messages, branch names, or the Session log. Every session that touched private context
  runs the seam scan (term list in the private context file) before any commit. The repo's
  history stays clean from commit #1.
- **Versioning.** SemVer from v0.1.0; changelog per release; workspaces pin compatible ranges;
  from milestone 8, releases carry an eval result.

## Risks & guardrails

Predecessor-IP hygiene (fresh expression only; own time and equipment; written clearance before
the public flip; details governed in the private context) · scope creep (milestone map is the
scope; new ideas become proposals) · instruction bloat (≤60-line always-loaded core; evals prune;
librarian demotes) · competitors moving down-stack (speed on spec; open-standard positioning) ·
platform absorption (design for deletion — thin workflow, durable context layers) ·
solo-maintainer bottleneck (proposals-as-PRs, librarian nagging, eval gates) · **naming** (FINAL
24 Jul: **Portulan**, the Romanian word for a portolan chart; **portulan.dev registered 24 Jul
2026 by Sleepy Panda SRL** — auto-renew ON, DNSSEC enabled with DS auto-published; consider
portulan.works defensively; trademark sweep EUIPO/USPTO classes 9/42 before brand spend).

## Session log

_(append one line per session: date · milestone · what landed · supervisor fidelity note —
the seam applies here too: no client-identifying references)_

- 2026-07-24 · M0 (Bootstrap) · Private `sleepy-panda-works/portulan` created and pushed
  (commit `f04dedd`): Apache-2.0 license + NOTICE, README stub, directory scaffold per the
  topology, `.gitignore` excluding the local bootstrap file, and `docs/plan.md` + `docs/vision.md`
  seeded from the working copy. · Supervised in fresh contexts throughout: session-open review;
  Fable 5 pre-commit (APPROVE, zero residue, docs byte-identical to source); Fable 5 milestone-close
  verified on the live remote — PRIVATE, all pushed files + full history residue-free, criterion
  demonstrated.

- 2026-07-24 · M1 (Core re-expression) · First cut of `core/` authored fresh, clean-room from the
  constitution + public agentic-engineering practice: the always-loaded kernel `engine.md` (43 lines),
  six operating docs (loop · autonomy · verification · memory · evolution · safety), five templates
  (repo-card · task · handoff · proposal · memory-entry), and shape-fixing READMEs for `personas/` +
  `skills/`. · Supervised in fresh contexts (Fable 5): session-open APPROVE-WITH-ADJUSTMENTS (triage-lane
  doctrine given a home, an explicit concept-coverage step recorded as an M1-close prerequisite,
  repo-altitude wording — all folded in); pre-commit APPROVE with the seam scan clean across all 15
  files and the kernel within its ≤60-line budget. Exemplar personas/skills and the concept-coverage
  pass on `core/` land in the next M1 session; the milestone stays open.

- 2026-07-24 · M1 (Core re-expression), session 2 · Build-half exemplars authored fresh: three
  personas as context firewalls — `implementer`, `reviewer`, `librarian` — each with a capability-class
  `tools:` allow-list, autonomy-tier reach (in tier vocabulary, not concrete actions), read/write
  posture, and per-agent memory scope; two universal skills in `SKILL.md` form — `clarify` (spec-driven
  clarification-before-plan) and `codify` (compounding-engineering mistake→proposal). A concept-coverage
  pass mapped every engine-relevant `vision.md` clause to its home in `core/`: 38 clauses assessed — 31
  covered (6 this session) and 7 deferred by design; the 3 named gaps fall within those two buckets
  (`compact errors` → covered via a bullet in `operating/loop.md`; the cross-artifact consistency-check
  → deferred to a rituals pack after M2; the "Portulan Factors" checklist → deferred to the docs
  surface). Kernel untouched (43 lines, within budget). · Supervised in fresh Fable 5 contexts:
  session-open APPROVE-WITH-ADJUSTMENTS (six adjustments folded in — coverage-first sequencing, widened
  matrix rows, durable-outcome recording, tier reach in tier vocabulary, promise-only-what-exists,
  explicit skill triggers); pre-commit APPROVE-WITH-ADJUSTMENTS (both mechanical — this log line's
  verdict fill and the commit-message seam scan; all substance passed); seam scan clean across files,
  commit message, and branch name. **M1 stays open** — the client-half (predecessor concept inventory,
  the private pilot workspace, and a real task run end-to-end on engine + workspace) is client-rooted
  and lands in its own session.

- 2026-07-25 · M1 (Core re-expression), session 3 · **Milestone closed.** The workspace layer got its
  first real instance: `.portulan/`, this repository's own workspace — identity · gate map · triage
  threshold · DoD · verify recipe · repo card · four memory entries · one task · one proposal · one
  handoff — which is what turned every "the workspace decides this" promise in `core/` into a concrete
  answer. A task then ran end-to-end on engine + that workspace with a recorded red→green verify:
  `.portulan/verify/docs.sh` was written first and went red on two top-level entries missing from the root
  README's layout table (`.claude-plugin/`, absent since M0, and `.portulan/` itself), red a second time
  on the implementer's own dangling links, then green. Those are the repository's first three machine
  checks — links resolve · kernel line budget · the README map matches the repo's shape — of which only
  the budget was a rule the repo had already stated; the other two were minted from the defect, with the
  incident recorded so they can be retired. Also surfaced and written up: `main` carries no branch
  protection, so the platform floor the engine calls unbypassable is, on our own repository, convention —
  `.portulan/proposals/0001`, accepted with administrators included, **not yet applied**. The M1 exit
  criterion was amended with Marius (that row only): the milestone now closes on publicly demonstrable
  facts, and the half that depended on material outside this repository moved to its own context under a
  one-way-flow rule — findings from there reach `core/` only by way of the constitution, never directly.
  · Supervised in three fresh Fable 5 contexts: session-open APPROVE-WITH-ADJUSTMENTS (seven, all folded
  in); pre-commit APPROVE-WITH-ADJUSTMENTS (six, all folded in — including a false "three already-stated
  rules" claim that appeared in three files, and a confirmed false green where the map check grepped the
  whole README rather than its layout table); milestone-close CLOSE on an independent vision→core coverage
  walk. Seam scan clean across files, commit message, and branch name.

- 2026-07-25 · Constitution · **Thesis 6 added to `docs/vision.md` by Marius** — *tailored answers; owned
  specifics*: core and packs carry the universal best practice, the team's own specifics persist only in
  the layer their owner controls, and storage follows ownership. Authored by the human owner and committed
  verbatim; no agent edits that file. Its **write half** turned out to have no home anywhere in `core/` —
  not the concept, not the vocabulary — which would have falsified milestone 1's coverage claim the moment
  it merged, so the same change gives it one: a "Storage follows ownership" section in
  `core/operating/memory.md` (a lesson travels upward only by generalizing **and** only as a proposal
  through the human gate, arriving as a proposed rule rather than a relocated memory entry), plus a clause
  in `core/skills/codify/SKILL.md` step 2, where altitude is chosen and specifics leak in practice. One
  edge recorded rather than papered over: thesis 4 wants every rule linked to the incident that created
  it, and an incident that cannot leave its owner's layer cannot be linked from a public one — interim
  behaviour stated, its cost named, and a verifiable form deferred to the Workspace Definition's
  provenance slot (M2) and the librarian's retirement logic (M5). · Supervised in two fresh Fable 5
  contexts: thesis review SOUND WITH A NOTED CONSEQUENCE (that `core/` gap, now closed); `core/` commit
  APPROVE-WITH-ADJUSTMENTS (both required adjustments folded in, plus the optional one; the kernel
  deliberately not grown — 43/60, since the invariant binds at consolidation time, not on every task).
  Seam scan clean across files, commit messages, and branch name.
