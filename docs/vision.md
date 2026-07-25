# Portulan — Vision (the constitution)

> This file is ground truth. The build supervisor grades every session's work against it.
> Changes to this file are **human-owned** (Marius Cetanas) — no agent edits it, ever.
> Locked 24 July 2026. Companion: `plan.md` (the milestone map).

## What Portulan is

Portulan is an **operating framework for agentic engineering** — the tailored context, standards,
gates, and institutional memory a team needs so any coding agent works *their* way. It is an
**open-core product by Sleepy Panda Works** that any team, any company, any product domain (web,
mobile, gaming, embedded) can adopt. It distills, in fresh expression, operating concepts proven
in real production engineering practice.

**The name.** *Portulan* is the Romanian word for a portolan chart — a mariner's map compiled
from the accumulated observations of real voyages: hard-won local knowledge, closely guarded,
more valuable with every trip. That is the product thesis in one object, in Sleepy Panda's own
language: **the engine is the chartmaking method; your workspace is your portulan.** (Decided
final 24 Jul 2026; **portulan.dev registered by Sleepy Panda SRL the same day.** Trademark sweep
in classes 9/42 before the milestone-3 public flip.)

One sentence: **cockpit products sell the dashboard; Portulan sells the doctrine.**

## The thesis (why this wins)

1. **Mechanism/policy separation.** A universal engine (the loop, autonomy model, verification
   hierarchy, memory lifecycle, supervised evolution) + a per-team Workspace (identity, stack,
   repo cards, gate map, verify recipes, DoD, glossary, memory) + composable packs
   (stacks / tools / rituals). Resolution cascade: core < pack < workspace < repo card < task.
2. **Context layers outlive workflow machinery.** Hosts keep absorbing orchestration (Agent OS v3
   deleted its own; agent teams went native). Durable value = standards, workspace, memory, evals —
   the customer's own context, which no platform can absorb. Therefore: **design for deletion** —
   workflow stays thin.
3. **Rails, not prose.** Every rule either enforces itself (hooks, compiled gates, Stop-gates,
   platform floor), measures itself (evals, telemetry), or earns its place in the context window.
   The why stays in Markdown; the must lives in machinery.
4. **Every mistake compiles into a permanent rule** — with provenance, in one of exactly two forms:
   a resolvable link to the incident that created it, or — when the incident cannot leave its owner's
   layer — a sealed stamp: owner, date, and the de-identified failure shape (Hashimoto's loop,
   compounding engineering). The librarian retires rules whose incidents can no longer occur; a sealed
   rule it cannot judge, so it nags the owner to re-validate instead.
5. **Human-curated, agent-drafted.** Agents may draft the curated layer, never own it
   (ETH Zurich, arXiv:2602.11988: generated context hurts, curated helps). Supervised evolution —
   proposals reviewed by humans, eval-gated where possible — is the moat against drift.
6. **Tailored answers; owned specifics.** Core and packs carry the universal best practice; at
   work-time the engine reads the team's own specifics — workspace, repo card, memory — and returns
   an answer tailored to them, never a generic guideline. Those specifics persist only in the layer
   their owner controls (their workspace, their portulan); core and packs never absorb the team's.
   Storage follows ownership.

## Product identity

- **Open-core.** Public engine + spec + CLI + demo workspace at `github.com/sleepy-panda-works/portulan`
  (the repo doubles as the public Claude Code plugin marketplace). Commercial value in **private
  feeds**: customer workspaces and premium packs delivered as private-marketplace plugins, plus
  support/onboarding.
- **Delivery tiers:** (1) Claude Code plugin — primary; (2) `npx` CLI: `init` (interview + codebase
  scan → drafted workspace, human curates) · `doctor` (schema validation + per-host capability
  report + agent-legibility score) · `compile` (gates/verify → host enforcement) · `vendor`
  (self-contained AGENTS.md + .portulan/ for any host) · `index` · `upgrade`; (3) vendored
  standards mode for cloud/CI/non-Claude hosts.
- **LLM-agnostic by construction.** Standards first (AGENTS.md + SKILL.md), host adapters second,
  repo-side enforcement always. ~80% of value ships identically on every host; the enforcement
  backends are per-host with an honest degradation report. The **platform floor** (branch
  protection, required checks, CODEOWNERS, PR-as-gate) is the universal gate no model can bypass.
- **Reference workspaces:** a private pilot workspace at a design-partner company (local-only,
  never part of this repository), a fictional demo workspace (public, in `examples/`), and the
  Sleepy Panda portfolio workspace (all Sleepy Panda products, via the private
  `portulan-internal` feed).

## Non-goals (as binding as the goals)

- **No cockpit.** No fleet-management UI, no desktop app, no agent-monitoring dashboard.
  Compose with orchestrators (Claude Code agent teams, GitHub Agentic Workflows, Hyprlayer);
  never compete with them.
- **No hosted SaaS**, with one doctrine-permitted exception: the **approval relay** (async
  Slack/webhook approvals for gated actions), shipped self-hostable first.
- **No auto-generated curated context.** `init` drafts; humans accept.
- **No unsupervised self-evolution.** Rule changes are proposals → human/eval-gated PRs.
- **No ceremony that can't scale down.** The triage lane is a first-class feature
  (BMAD's failed promise is our differentiator).
- **No client references — ever.** This repository (files, history, commit messages, branch
  names, Session log) carries no names, identifiers, paths, or artifacts of any private client
  engagement. Client-side context lives outside the repo and is governed there.

## Influence map (what we adopted from whom)

| School | Adopted |
|---|---|
| HumanLayer ACE-FCA / harness engineering | The loop + compaction (DNA); ≤60-line always-loaded core; skills-first disclosure; subagents as context firewalls |
| Anthropic context engineering | Attention budgets per layer; right-altitude writing |
| Cognition | Handoffs record decisions + why; read-parallel / write-isolated |
| Spec-driven (Spec Kit / Kiro / OpenSpec) | Constitution file; /clarify ritual; EARS-style testable ACs; consistency check. Rejected: spec-as-source, mandatory ceremony |
| Compounding engineering (Every) | Codify ritual: librarian mines incidents + PR reviews into draft proposals |
| Ralph Wiggum loop | Machine-checkable completion + iteration caps; runbooks |
| Letta | Sleep-time consolidation; per-agent memory |
| Verification-first (Cherny) | Failing test as task spec; executable verify + Stop gate |
| AAIF open standards | SKILL.md + AGENTS.md as the distribution plane |
| BMAD | Story file as atomic context unit; scale-down lesson |
| Agent OS v3 | Product layer; standards discovery in init; design for deletion |
| 12-Factor Agents | Auditable checklist format ("Portulan Factors"); compact errors; stateless-reducer resumability |
| Agentic engineering craft (Karpathy/Willison/Osmani/Hashimoto) | Red/green TDD default; "never commit what you couldn't explain" in DoD; last-mile review focus; mistake→rule with provenance; the term "agentic engineering" |
| Agent-native / AX | Agent-legibility audit (repo affordances scored by doctor) — unclaimed niche |
| Platform engineering | Golden-path framing for packs; IDP-for-agents vocabulary; same-policy-for-agents-as-humans |

## Inherited principles (from the predecessor framework)

- **The writing.** Specific, honest about limits, rich in rationale. Keep the voice.
- **The safety culture.** Recoverable-vs-reversible, injection awareness, "a blocked-but-safe run
  beats an unattended mistake," gates classified by undoability.
- **The human gate on rule changes.** Speed it up (PRs, librarian nagging, evals); never remove it.
- **The verification hierarchy.** Compiles < tests pass < behaviour exercised. Applied to the
  product's own construction (hard exit criteria per milestone).
