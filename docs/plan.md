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
│   ├── evals/                    golden tasks, A/B harness, CI eval gate
│   └── .claude-plugin/marketplace.json
├── portulan-workspace-template   PUBLIC  "Use this template" scaffold
└── portulan-internal             PRIVATE Sleepy Panda feed (portfolio workspace + packs)
```

## Milestones

Status legend: `todo` · `in-progress` · `done (date, fidelity note)`

| # | Milestone | Sessions | Exit criterion | Status |
|---|---|---|---|---|
| 0 | Bootstrap | 1 | `sleepy-panda-works/portulan` skeleton pushed **as a private repo** (public flip happens at milestone 3 only, after the clearance tracked in the private context): license, README stub, directory scaffold per the topology above, `.gitignore` already excluding the bootstrap file, and this folder's `plan.md` + `vision.md` seeded as `docs/plan.md` + `docs/vision.md` | done (2026-07-24; Fable 5 verified live remote: PRIVATE, zero residue, criterion complete) |
| 1 | Core re-expression | 2–3 | Concept inventory of the predecessor framework (private; **reference only — re-express, never copy text**); `core/` authored fresh with zero copied prose and zero client references; the private pilot workspace assembled in its own context (outside this repo); a real task runs end-to-end on engine + pilot workspace, no worse than the predecessor | todo |
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
