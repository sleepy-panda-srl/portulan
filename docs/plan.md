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
├── portulan                      monorepo + public marketplace
│                                 PUBLIC at the milestone-3 flip; private today
│   ├── core/                     engine: operating docs, personas, universal skills, templates
│   ├── packs/                    stacks/ · tools/ · rituals/
│   ├── spec/                     Workspace Definition schema, docs, migrations
│   ├── plugin/                   Claude Code packaging (SKILL.md dirs, hooks, settings)
│   ├── agents/                   Claude Code agent bindings of core/personas/ — a platform-fixed
│   │                             location: the default agents dir of the repo-rooted plugin
│   ├── cli/                      init · doctor · compile · vendor · index · upgrade
│   │                             (today: doctor + plugin-lint, standalone; the CLI absorbs them at M7)
│   ├── examples/                 fictional demo workspace
│   ├── .portulan/                this repo's own workspace — customer zero, dogfooding
│   ├── evals/                    golden tasks, A/B harness, CI eval gate
│   ├── docs/                     vision.md (constitution) · plan.md (this file)
│   └── .claude-plugin/           plugin + marketplace manifests
├── portulan-workspace-template   PUBLIC  "Use this template" scaffold
└── portulan-internal             PRIVATE Sleepy Panda feed (portfolio workspace + packs)
```

## Milestones

Status legend: `todo` · `in-progress` · `done (date, fidelity note)`

| # | Milestone | Sessions | Exit criterion | Status |
|---|---|---|---|---|
| 0 | Bootstrap | 1 | `sleepy-panda-works/portulan` skeleton pushed **as a private repo** (public flip happens at milestone 3 only, after the clearance tracked in the private context): license, README stub, directory scaffold per the topology above, `.gitignore` already excluding the bootstrap file, and this folder's `plan.md` + `vision.md` seeded as `docs/plan.md` + `docs/vision.md` | done (2026-07-24; Fable 5 verified live remote: PRIVATE, zero residue, criterion complete) |
| 1 | Core re-expression | 3 | `core/` authored fresh — zero copied prose, zero client references; every engine-relevant `vision.md` clause mapped to a home in `core/` or a recorded deferral; a real task runs end-to-end on engine + the repo's own `.portulan/` workspace, with a recorded red→green verify | done (2026-07-25; Fable 5 M1-close, fresh context: independent vision→core walk found 0 unmapped clauses — 44 covered, 14 recorded deferrals; verify rerun green; red pre-existed per git as an M0 omission; seam clean across files + history) |
| 2 | Workspace spec v1 | 1–2 | Manifest + **constitution & product-layer slots** (team principles; mission/what/why) + gate map + verify recipes + **agent-affordances slot** (portfolio-aware: many products per workspace) + **provenance slot**, per the decision on `.portulan/proposals/0002-sealed-provenance.md` (proposed: a well-formed link or a sealed owner+date stamp); `doctor` validates the demo workspace **and this repo's own `.portulan/`**, and lints **workspace claims against the tree** — repo-card build/test/run lines and layout, gate map — the way the `map` check already holds the root README to the repo's shape | done (2026-07-25; Fable 5 M2-close, fresh context: forced every clause red before believing any green — 7 schema violations, dead and mistyped paths, drifted build-line/layout/gate-map claims each FAIL at `map`-check severity wherever a `tree` is declared; prose or malformed provenance fails rules and only rules, sealed proportion always printed; both workspaces green through CLI and recipes, drifted fixture red, suite 68/68 and red with `doctor` removed, exits 0/1/2 honest; `tree` and `type` remain declared-not-proven opt-ins, recorded as `.portulan/proposals/0005-a-repository-workspace-must-declare-its-tree.md`). **Criterion amended with Marius, 2026-07-26, this row only: the clause *"(and, privately, the pilot)"* was struck.** Not because it was inconvenient — because it contradicted the ruling that closed milestone 1. That amendment established, in the private context that governs client-related questions, that the client-rooted work remaining there *"neither gates any public milestone"*; this row had never been reconciled to it and gated one. It also carried the same two defects the milestone-1 amendment was written to remove: a criterion that no build session could execute under our own rules, so it structurally guaranteed a close-by-assertion, and a public milestone made dependent on the predecessor framework as an input. The pilot check remains a standing task in its own context — **non-gating, not optional**. Generalised so it cannot recur: [`.portulan/memory/a-public-criterion-must-be-demonstrable-from-this-repo.md`](../.portulan/memory/a-public-criterion-must-be-demonstrable-from-this-repo.md), which binds **exit criteria only** and explicitly does not reach an authorization hold — the milestone-3 flip clearance stays a gate. · Strike audited (2026-07-26; Fable 5 strike-audit, fresh context: the quoted ruling read at source — verbatim, dated before every build commit of the day, the clause unreconciled since bootstrap; the governing document gates one public thing explicitly, the milestone-3 flip, and this close touches it nowhere; its own terms wanted the pilot validation unreferenced in repo docs, so the struck clause was doubly unhomed; recipes and doctor re-run green, six forced reds red, seam and consistency greps clean). |
| 3 | Plugin & public marketplace | 1–2 | **The plugin, the marketplace manifest, and every shipped skill validate** — `claude plugin validate --strict` green and recorded, *and* a repo-owned zero-dependency lint declared as a verify recipe so CI checks every declared skill and agent on each pull request; v0.1.0 tagged; fresh-machine install boots the engine with no local folder | done (2026-07-27; Fable 5 M3-close, fresh context: every clause re-demonstrated independently rather than replayed from the transcript. `claude plugin validate --strict` exit 0; all five recipes green; five forced reds red with honest messages and the documented agents-deletion hole behaving exactly as recorded — note, exit 0, handed to task 0005; annotated `v0.1.0` on the remote dereferencing to `9305a16`, both manifests there declaring `0.1.0`, the changelog in the tagged tree; `workspace-verify` green on PR #20's pull_request event with the `plugin` recipe read from the manifest, not the workflow. The install was reproduced from an empty config dir on CLI 2.1.220 — HTTPS after the SSH probe, `Skills (3)` / `Agents (3)  reviewer, librarian, implementer`, cache byte-identical to the `v0.1.0` tree bar the host's `.in_use` marker, engine at 43 lines — which also re-confirms convention loading on a second CLI version, though the suppression half of the agents-key measurement remains 2.1.215-only. The boot ran three times from a real-config install: with bundle read granted the kernel loaded and its doctrine was recited; a project carrying a workspace built for this audit — its glossary marker `GIMBAL-LATCH-63` grepped absent from the payload first — had that marker quoted back, with all three bundled manifests refused by name in every run; the bare project's absence was reported. The kernel-denial limit reproduced exactly under true default headless permissions, and an allowlisted Read suffices to clear it with no `--add-dir`; the denied run's honest self-report came from the model, not the skill, because the installed skill predates the staged fix paragraph — which therefore ships unverified by any install until this merges, carried to milestone 4. What is demonstrated remains *no local folder*, not *no local credentials*, and visibility was PRIVATE at every measurement; the flip stays an authorization hold outside this criterion. Three record fixes were required in the staged records before recording — a ticked 0003 criterion whose letter is false against the shipped `plugin.json`, a suite figure of 149 where the tree holds 155, and a two-boots-plus-denied-attempt phrasing that reads as a contradiction — none touching the criterion's substance; the maintainer's config was restored to its exact baseline.) · session 1 of 1–2, 2026-07-26: the install demonstration refuted an accepted criterion, and that is what session 1 mostly was.** A machine with no local copy — empty `CLAUDE_CONFIG_DIR`, temp project — added the marketplace by GitHub shorthand and installed: clone pinned to `9e21688`, which was `origin/main` at the time of that measurement (the merge below has since moved it), over HTTPS after the CLI probed SSH and fell back unaided, visibility **PRIVATE** recorded at the moment of the install. The payload is the whole repository, as `plugin/README.md` says it costs. Then the host's own inventory said **`Agents (0)`** for a plugin declaring three, whose files all shipped, whose lint counted three, and which `claude plugin validate --strict` passed. A seven-form fixture matrix **with a positive control** established why: an `agents` key does not merely fail to point at the files, it **suppresses** the only scan that loads them, and no location but the default `./agents/` is scanned at all. Fixed by dropping the key and **moving the three bindings to a top-level `agents/`** — the default agents directory of a plugin whose root is this repository, per the maintainer's ruling. Rooting the plugin at `plugin/` instead would have made `plugin/agents/` the default, and would have been far worse: the installed payload is the plugin root's subtree, so that plugin would ship skills and agents and *not* `core/`, and the install exists to deliver the engine. **Verified from a real install, not from `--plugin-dir`** — marketplace add plus install into a versioned cache reports `Skills (3)` and `Agents (3)  reviewer, librarian, implementer`, with `${CLAUDE_PLUGIN_ROOT}/core/engine.md` readable at 43 lines, which is one check confirming both the repo-rooted decision and this fix. **Two fail-opens the fix itself opened, both closed:** the recipe printed `0 agent(s)` and GREEN the moment nothing declared them — so `plugin-lint` now finds agents by convention, fails on a present `agents` key, and asserts this repository's count of three against the tree; and the `map` check could not see a top-level symlink at all, because `awk -F/ 'NF > 1'` only yields directories that contain tracked files — now extended, and red-first against the un-documented entry. Suite 146 → 149, red on 9 before the fix. **The remote path is now measured too** — PR #19 rebase-merged, `v0.1.0` tagged on `9305a16`, and a clone-backed install from an empty config dir reports `Agents (3)  reviewer, librarian, implementer` with the engine readable at 43 lines. The criterion was held unticked until that ran, minutes after the merge made it possible, because a green from one install path is not a green from another — which is the whole reason this session exists. **The two symlink claims the payload decision rested on were measured and are false** — both readings of "local-directory install" follow a link out of the plugin directory; the decision stands on a reason the record did not give, that this repository's own lint refuses that shape and taking the alternative means relaxing it. **`v0.1.0` was cut after the merge**, on the maintainer's ruling — fix first, then tag the merge — so the tagged tree carries the first `CHANGELOG.md`, which Protocol → Versioning has required since bootstrap and nothing had yet produced. **Milestone 3 stays open on one clause: the boot.** It needs a live session and the account's credit balance blocks every one, including a control `claude -p` with no plugin loaded — an auth failure, classified as one rather than mistaken for a packaging failure, which was the risk session 0 flagged. · session 0 of 1–2, 2026-07-26: the plugin exists and validates — `plugin.json` + a populated marketplace entry sourcing the repository root, the `/portulan` boot skill, the three personas bound as agents, `cli/plugin-lint.mjs`, its suite written first and red on the right module, declared as the fifth verify recipe so CI runs it with no workflow edit; `CODEOWNERS` landed with its enforcing setting deliberately off. The tag and the fresh-machine install are session 1 — both need a push). **Criterion amended with Marius, 2026-07-26, this row only: the clause *"Skills pass `skills-ref validate`"* was replaced by the wording above.** `skills-ref` is a third-party npm package whose own README states it is *"intended for demonstration purposes only. It is not meant to be used in production"* — a public exit criterion resting on one maintainer's demo package, and a supply-chain dependency inside a gate. The amendment is an **expansion, not a narrowing**, and was checked for that in the way the milestone-1 and milestone-2 amendments established: the tool was **run first** (with lifecycle scripts disabled) and **both skills passed it, exit 0**, so nothing was fled; and it validates a single skill directory only — pointed at this repository it fails, because a repository is not a skill — so the original clause could never have covered the plugin or the marketplace, which are two thirds of what the milestone ships. The replacement names **two** checkers on purpose, because measuring their coverage showed neither contains the other: `claude plugin validate --strict` refused a `plugin.json` the repo lint passed, and passed a `SKILL.md` with its frontmatter deleted, its description emptied, and a non-kebab-case name — it validates no skills at a marketplace root and only default-path skills in plugin form, so it examines none of this repository's. Recorded as [`.portulan/memory/a-checkers-coverage-is-measured-not-named.md`](../.portulan/memory/a-checkers-coverage-is-measured-not-named.md). The public flip is **not** part of this criterion: it is an authorization hold granted from outside, which [`.portulan/memory/a-public-criterion-must-be-demonstrable-from-this-repo.md`](../.portulan/memory/a-public-criterion-must-be-demonstrable-from-this-repo.md) explicitly does not reach. *Amended 2026-07-27 (fresh-context audit): "asserts this repository's count of three against the tree" in this row overstates `plugin-lint` — that assertion lives in its test suite, `cli/plugin-lint.test.mjs`, and runs with `tests.sh`, not `plugin.sh`.* |
| 4 | Enforcement compiler | 1–2 | `gates.json` → hooks + permissions (+ **a GitHub repository-ruleset export** — importable branch-protection JSON: require pull requests, required status checks, block force-pushes — compiled from the same policy, and positioned in the matrix as **the floor backend**: what every host falls back to, and all that a host with no hook system has); verify recipes → Stop-gate runner, **including the session-end gate: a handoff dated that day exists**; per-host backend matrix + doctor degradation report. Demo: unapproved push blocked; "done" without green verify blocked | in-progress. **Criterion amended with Marius, 2026-07-27, this row only — twice.** *(1)* The clause *"including the session-end gate: a handoff dated that day exists"* was added. *(2)* The phrase *"Copilot ruleset export"* was **reworded, not replaced**: it always meant a GitHub **repository-ruleset** export — importable branch-protection JSON compiled from the same policy — and never a GitHub-Copilot integration. Confirmed by Marius, 2026-07-27. The rewording is not cosmetic: the ambiguity **cost a session-blocking question**, because an implementer could not tell which of two unrelated things the deliverable was, and guessing would have built the wrong one. Two limits ride with it and are recorded rather than discovered later — the compiler **generates, never applies** (importing a ruleset is a repository-settings change: outward, Gated, the maintainer's, per the proposal-0001 precedent), and exported-versus-live drift is checked at the supervised checkpoints and **not** in CI, since `doctor` cannot see live settings and a recipe here may not make a network call. `core/operating/autonomy.md`'s doctrine sentence stays exactly as written — the promise it makes is this deliverable, so the row moved to meet the doctrine rather than the reverse. **Checked for narrowing in its own right**, not by inheriting amendment (1)'s check: a rewording can narrow silently in a way an addition cannot, and this one does not — the deliverable is the same object, now named so that only one thing answers to the name. **Its generalisation is the rewording itself**, deliberately rather than as a new memory entry: what prevents recurrence is that the ambiguous phrase is gone from every forward-looking sentence in this file, which was done in the same change. A rule saying *write unambiguous criteria* would be advice nothing checks — and this repository already fails a memory entry for mandates with no checker. An **expansion, not a narrowing** — checked for that in the way the milestone-1, -2 and -3 amendments established, and it is the easy direction to get right here because the clause adds a deliverable rather than removing one. It was added because `core/operating/loop.md` and `.portulan/memory/every-session-ends-with-a-handoff.md` have both promised this gate *to milestone 4* since the cadence rule landed, and the row named only two of the three things the doctrine owed here — so the criterion and the doctrine disagreed, and the build was following the doctrine. Found at the session-open checkpoint, which counted the promises **`core/` and this workspace's memory make about the loop and verification** and got three where the row named two. That scoping is not a hedge — counting every doctrine sentence pointing here gives **four**, because `core/operating/autonomy.md` also promises that this compiler generates the *platform floor* configuration. The fourth is deliberately **not** folded in: it is a question for Marius, below, because the honest answers include rewording the doctrine rather than growing the row. **The principle runs one way only, and the direction is the whole of its safety: plan-to-doctrine reconciliation may only EXPAND a criterion.** A row clause that no doctrine file backs — `+ Copilot ruleset export` is exactly one — goes to the maintainer as a question, never to a strike-by-reconciliation. Written down because the milestone-2 amendment was nearly loaded the same way, and generalised so it cannot recur: [`.portulan/memory/a-doctrine-promise-belongs-in-the-row-it-names.md`](../.portulan/memory/a-doctrine-promise-belongs-in-the-row-it-names.md). **Scope is held to the promise as stated**: the gate checks that a dated handoff exists, and nothing about its length, shape or contents — not session analytics, which is the direction this would drift if left to grow. (Session 0 of 1–2, 2026-07-27: **both demo clauses demonstrated on a live host, in this repository, with the compiled settings in force.** `gates.json` → `.claude/settings.json` via `cli/compile.mjs`, declared as the sixth verify recipe so a policy edited without recompiling fails CI with no workflow edit; the Stop-gate runner blocks "done" on red *or* exit 2 and carries the session-end handoff gate `core/operating/loop.md` had promised here; spec 2.0 → 2.1, additive. **Unapproved push blocked:** a headless session ran `git status` (positive control), then was refused the push; the scratch bare remote — used so a failing gate would still perform no outward action — held 0 refs; the same command from the maintainer's hand then pushed, so *blocked* is demonstrably not *impossible*. **"Done" blocked:** with one dead link planted, a session told to reply `done` was held open three times carrying the recipe's own output naming the file and line, then released at its cap; with the tree green it ended in one turn. **The session's real finding inverted its own design:** the hook was to supply the gate's sentence, and measurement showed the host runs the hook and then *discards its reason* whenever a permission rule matches — proven with a canary recording both the invocation and the command seen. Shipping as planned would have been an inert component reading as an active one, one milestone after `a-manifest-field-can-validate-and-load-nothing`. The layer was re-earned instead: a permission pattern never sees `bash -c "git push …"`, the hook does, and there the hook's decision and sentence are what the agent gets. Recorded as `two-layers-need-two-jobs.md`. **And the hazard that nearly shipped:** a plugin carrying `hooks/hooks.json` has those hooks fire for *every installer, in unrelated projects* — measured with a control — so a top-level `hooks/` here would have pushed our gate map onto strangers' machines; `.claude/settings.json` was measured and does not leak. Named by the session-open supervisor before any code was written; recorded as `a-plugin-payload-can-enforce-on-strangers.md`. Maintainer's rulings: artifact **tracked and in force**, **no `allow` rules** so the compiler only ever adds restriction, Stop-gate **blocks with a cap**, handoff gate **built now**. **Session 1 carries the rest**: the GitHub repository-ruleset export (the floor backend), the per-host backend matrix, and `doctor`'s degradation report — for which the refusal accounting is already the data — plus one rider ruled after this session merged: **the Stop-gate counts refusals per reason, not per session** ([`.portulan/tasks/0007-per-reason-stop-gate-counters.md`](../.portulan/tasks/0007-per-reason-stop-gate-counters.md)). Each reason gets its own consecutive cap of 3, resetting only when that reason's condition clears; the non-resetting ceiling of 9 stays as backstop. That is the reset-on-green ruling **generalized rather than patched**, and it removes the asymmetry **the ruling itself names** — a missing five-line handoff gets three times the patience of a failing suite, and does so on `main` until session 1 lands this. (Session 0 flagged the *hang* and flagged the ceiling as an addition rather than a reading; the asymmetry is the maintainer's own observation, and attributing it to the session would be this file crediting the wrong party in the document that grades every other change.) Both questions that stood open here were **answered by Marius on 2026-07-27 and are no longer open**: the export is a GitHub repository-ruleset export, and it is where `autonomy.md`'s platform-floor promise lands — the row's criterion now names it. Left corrected rather than deleted, because a session note that still asks a settled question sends the next reader to re-open it) |
| 5 | Memory lifecycle & librarian | 1–2 | Generated size-budgeted index whose budget is a **rail, not librarian diligence**: a verify recipe goes red on breach, demonstrated red→green — the index forced over budget fails, and consolidation (merge, compress, retire), never a budget raise in the same change, returns it green; consolidation skill; scheduled librarian (reindex; staleness — the sealed-stamp re-validation nag, and the age half of the store report `doctor` deliberately cannot give because it reads the tree and never git; proposal nagging; demotion drafts) files its first real PR; proposals-as-PRs live. _Sharpened 2026-07-27 under the maintainer's directive "this issue should never ever happen: memory growing too large" — an expansion, not a narrowing: every deliverable already named stays, and the budgets gain the machinery that makes a breach red. The store already reports its own count and size and names any record stating no retirement condition (`doctor` notes since the same change), so this milestone starts from a measured store rather than owing the measuring._ | todo |
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
  `.portulan/proposals/0001-platform-floor-on-main.md`, accepted with administrators included, **not yet
  applied**. The M1 exit
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

- 2026-07-25 · Doctrine · **Handoff cadence made uniform** (maintainer ruling): every session ends with a
  dated handoff — short is fine, absent is not, an exception is a last resort. Landed in
  `core/operating/loop.md`, the `core/templates/handoff.md` header, `.portulan/dod.md` condition 8, and
  `.portulan/memory/every-session-ends-with-a-handoff.md`. *Why binary rather than discretionary:* "write
  one when it's warranted" is prose no gate can check, so only the uniform form compiles into machinery;
  and the failure modes are asymmetric — an unnecessary handoff costs five lines, a skipped one loses
  decisions-and-why permanently. The no-ceremony-that-can't-scale-down non-goal is satisfied *inside* the
  artifact, which may be five lines, not by omitting it. **Forward only, as a cutoff rather than a list**
  — the series begins with sessions closing after the rule lands on `main`; everything earlier (bootstrap,
  both earlier M1 sessions, and the constitution session) keeps its record in the PR descriptions and this
  log, because a handoff written after the fact fabricates a contemporaneous artifact and adds nothing the
  *why* could be reconstructed from. Also resolved this session: the repo card's self-reference is
  self-hosting rather than a dependency cycle (nothing needs the card to build or verify; the cascade
  stays one-directional), so the card stays — but the real risk is **drift**, and a `doctor` lint checking
  workspace claims against the tree is recorded as a milestone-2 requirement alongside validating
  `.portulan/`. · Supervised in a fresh Fable 5 context: APPROVE-WITH-ADJUSTMENTS, all six folded in — the
  change had shipped in violation of itself (this session back-editing the previous session's handoff
  instead of writing its own), the forward-only exemption named two sessions when four lacked handoffs so
  a correspondence checker would have failed immediately, and `core/` legislated on "session" without
  defining it. Seam scan clean across files, commit message, and branch name.

- 2026-07-25 · Loose ends before M2 · Cleared the open items so the next milestone starts from an
  accurate plan rather than a backlog. (1) **`doctor`'s scope amended** in the M2 row: it now validates
  this repository's own `.portulan/` alongside the demo workspace, and lints **workspace claims against
  the tree** — repo-card build/test/run lines and layout, and the gate map — which is the answer to the
  drift risk behind the earlier "is the repo card circular?" question (it is self-hosting, not a cycle;
  drift was always the real exposure). (2) **Sealed provenance drafted** as
  `.portulan/proposals/0002-sealed-provenance.md`: the constitution's thesis 4 (every rule links to its incident) and thesis 6
  (a team's specifics stay in the owner's layer) collide whenever a rule generalises upward out of a
  private incident, and the collision was found *independently* by a fresh-context reviewer and in the
  design conversation. The proposal gives the provenance slot two machine-checkable forms — a resolvable
  link, or a sealed owner+date stamp with the de-identified failure shape — has `doctor` reject a rule
  with neither and report the *sealed proportion* (a workspace where everything is sealed has opted out
  of retirement), and has the librarian nag the owner to re-validate rather than retire on evidence it
  cannot see. Drafted, not adopted. (3) **The "generic must never decay into vague" bar** added to
  `codify` step 1: a rule crossing a confidentiality boundary keeps its concrete failure shape — inputs,
  wrong outcome, why the obvious guard misses — with the bar that someone who never saw the incident can
  still write the rule's test. (4) The handoff-cadence handoff amended with the "dated" definition,
  visibly marked rather than woven in — errata, since the git record shows that decision was taken during
  that session's own review cycle and merely went unrecorded. · Supervised in a fresh Fable 5 context:
  APPROVE-WITH-ADJUSTMENTS, all five folded in — the `codify` addition used "sealed" as established
  vocabulary that `core/` defines nowhere and pointed at a doc that does not contain the word; two
  statements about *when* the "dated" decision was taken were wrong against git, in a workspace whose
  forward-only rule rests on refusing fabricated contemporaneity; the M2 row baked in a pending
  proposal's outcome; and the proposal's honest-limits omitted that a checker validates a stamp's form
  and never its truth. `core/operating/memory.md` deliberately left recording the edge as unresolved —
  updating it would presuppose the human gate's outcome, and core cannot cite a workspace proposal
  without pulling customer-zero's specifics upward. Seam scan clean across files, commit message, and
  branch name.

- 2026-07-25 · Platform floor · **Branch protection applied to `main`** — the last item from the
  milestone-1 arc, and the point at which PR-as-gate here stops being convention. Live: direct pushes
  rejected, `docs-integrity` required green, **administrators included**, conversation resolution
  required, force-pushes and deletion blocked. **Demonstrated, not asserted** — a direct push to `main`
  was attempted afterwards and rejected ("Changes must be made through a pull request"); the probe commit
  was discarded. One deviation from `.portulan/proposals/0001-platform-floor-on-main.md` as drafted, and
  it is recorded there rather than smoothed over: the proposal asked for one approving review, which
  would have deadlocked a one-person repository, because GitHub does not permit approving one's own pull
  request — applied with **0** required reviews instead, since `enforce_admins` is the load-bearing
  setting and the review count is what rises when a second reviewer exists. Newly recorded as still
  missing: `CODEOWNERS`, so no path-specific human is required on any file — including `docs/vision.md`,
  which is protected today only by a prompt-level prohibition and not by the platform. Wanted before the
  milestone-3 public flip. Seam scan clean across files, commit message, and branch name.

- 2026-07-25 · M2 (Workspace spec v1), session 1 of 2 · **The workspace layer stopped being a folder
  convention.** `spec/` now carries the Workspace Definition — the schema, an orientation, and a per-slot
  document in which every slot cites what it was derived from (the milestone criterion, a constitution
  clause, or the one real workspace that existed), so "derived from real content" is checkable rather than
  claimed. `.portulan/` became its first instance via `workspace.json`. One constraint did most of the
  design work: a slot must be a **whole file**, because this repository's `links` check cannot validate
  `#fragment` targets and a fragment-addressed slot would be unlintable by construction — which is what
  forced `identity.md` to split into identity · `principles.md` (the constitution slot) · `products/` (the
  product layer plus the new agent-affordances slot), rather than the schema bending around the document.
  Two design calls were made *against* the available evidence and are worth keeping: `products` is an array
  though this workspace has exactly one product, since a faithful one-sample derivation would have modelled
  it singular and been wrong by milestone 6; and `constitution` is the one slot permitted to point outside
  the workspace directory, because customer zero's is `docs/vision.md` — a containment rule would have sent
  `doctor`'s first run red for a schema-design reason rather than a content one. Provenance landed as a
  **record field rather than a manifest key**: a rule lives in Markdown, so a manifest key would have
  described a workspace's policy about provenance while leaving every actual rule unchecked. The repository
  also gained a second verify recipe, `verify/json.sh`, written **before** the JSON it guards and red→green
  on a fixture; it caught its own author first, reporting a file that had been fine since milestone 0 as
  malformed — a **false red**, fixed by deleting the argument handling that caused it, and recorded because
  a false red is the failure that gets a whole recipe switched off. `docs.sh` stays POSIX-only; the `node`
  dependency is confined to the new recipe and to `doctor`, and each recipe now declares its own needs, which
  is what keeps *could not run* distinguishable from *ran and failed*. Five placeholder READMEs claiming
  "populated from milestone 1" were corrected — `examples/` and the four under `packs/` — the milestone's
  own first instance of the claims-drift its `doctor` lint exists to catch. (The first draft of this very
  sentence said "three … and the three under `packs/`", wrong twice, and was caught at the pre-commit
  checkpoint — which is the argument for the lint restated as evidence.) **Milestone 2 stays open:**
  `doctor`, the demo workspace, and the claims-against-the-tree lint are session 2, and task `0002` carries
  both halves. · **Maintainer decisions this session:** proposal `0002` (sealed provenance) **accepted** and
  closed as applied — with two questions it had deferred settled in the applying (*resolvable* means
  well-formed, never fetched; the slot is a record field) and the matching **`docs/vision.md` thesis-4
  wording change reserved to Marius's own hand**, so until it lands the constitution reads "links" while the
  spec permits a stamp, stated in both rather than smoothed over; and **JSON as the format product-wide**,
  which is why milestone 4's row now reads `gates.json` — raised because a "no YAML parser" rationale that
  ignored the YAML artifact the plan named one milestone later would have been a rationale with a hole in it.
  Proposal `0003` was **drafted, not applied**: the new `kind` slot fires the retirement condition
  `three-workspaces-not-one.md` wrote for itself, but only for its general half, since which of this
  repository's directories is which kind is a specific that thesis 6 keeps with its owner. · Supervised in a
  fresh Fable 5 context: session-open APPROVE-WITH-ADJUSTMENTS (nine required, all folded in — chiefly that
  the slot inventory be driven by the criterion and the constitution rather than by the one available
  sample, that products be modelled as repeated, that no unparseable JSON ship, and that `.portulan/README.md`'s
  own "no manifest and no schema" limit be corrected in the same change); pre-commit APPROVE-WITH-ADJUSTMENTS
  (nine required, seven mechanical, all folded in). The pre-commit pass verified by hand what no validator
  yet can — that the schema stays inside its declared keyword subset, and that the shipped manifest would
  actually validate against the shipped schema — and caught four claims that were false against the tree:
  this entry's own README miscount; three `$defs` patterns whose descriptions promised to reject absolute
  paths while the regexes accepted them; a stale "the platform floor is not configured" line in
  `.portulan/README.md`, left over from before it was, and now contradicted by a file this same change adds;
  and an over-literal "before any of the JSON it guards existed" in the handoff, which the transcript beneath
  it disproved. **A Copilot review on the pull request then found a fifth, and the best of the set: both
  verify recipes reported GREEN when `git ls-files` failed** — empty list, zero iterations, confident pass.
  It flagged only the newly added `json.sh`; checking whether the same shape existed elsewhere found it in
  `docs.sh`, where it had sat since milestone 1, session 3, inherited by `json.sh` for the ordinary reason
  that the new recipe was modelled on the existing one. Both now treat enumerating the tree as a
  **precondition** — exit 2, "could not run", never 0 — demonstrated by running `docs.sh` in a non-git
  directory before and after. Recorded as `.portulan/memory/verify-preconditions-fail-closed.md`, the first
  memory entry written in the two-form provenance this same change defines. The review's three other
  comments were taken as well: every id-shaped field now routes through one `$defs/slug` (`verify.default`
  had carried only a length constraint, so a manifest could name a default no recipe could ever match), and
  two places where the spec's prose demanded more than the schema declared were reconciled. Seam scan clean
  across files, commit message, and branch name.

- 2026-07-25 · Infrastructure · **CI reads the verify recipes from the manifest instead of naming them.**
  Adding the second recipe exposed a choice with no good answer: a new CI job would have had an honest name
  and **not been a required check** (`main` requires exactly one context, so it would report without
  blocking until a Gated settings change), while a second step inside `docs-integrity` is enforced on merge
  at the cost of a check whose name no longer describes it. The pressure recurs on a known schedule —
  `doctor` is the next recipe. So the workflow now reads `verify.recipes` from
  [`.portulan/workspace.json`](../.portulan/workspace.json) and runs each: **declaring a recipe is what
  enforces it**, with no workflow edit and no settings change, which inverts the failure mode from
  fail-open to fail-closed. A manifest that cannot be read, or that declares zero recipes, exits 2 rather
  than reporting an unearned green — the same precondition rule minted earlier the same day, applied one
  level up. It also gives `spec/slots.md`'s argument for why the `verify` slot is structured data rather
  than prose — that something consumes it — an actual consumer, a milestone before the Stop-gate runner. **The rename is deliberately not
  done**: renaming the job id makes *that* pull request unmergeable — the required context stops reporting
  and `enforce_admins` prevents forcing the merge, so it fails closed and strands the rename behind the very
  settings change it was avoiding; other pull requests are unaffected. So
  [`.portulan/proposals/0004-ci-runs-every-declared-recipe.md`](../.portulan/proposals/0004-ci-runs-every-declared-recipe.md)
  records the three-step sequence and the **Gated** middle step that is the maintainer's. Verified by
  extracting the step's shell and running it under `bash -e` across nine paths — both green, one red,
  manifest missing, manifest truncated, zero recipes, and the four degenerate-value cases review added
  (empty, whitespace-only and newline-bearing `run`, and a non-slug `id`) — after a first measurement that
  read the exit code through a pipe and so reported `tail`'s status instead of the step's, which is the same
  class of mistake the change is about.
  Seam scan clean across files, commit message, and branch name.

- 2026-07-25 · Infrastructure · **Required-check rename, step 1 of 3** (maintainer's direction: do it before
  `doctor`, so the next recipe joins a check whose name already tells the truth). `workspace-verify` is now
  the job that runs the recipes; `docs-integrity` survives only as a transitional job that runs nothing and
  mirrors the other's verdict, because it is the context `main` pins and renaming it in place would leave
  the renaming pull request permanently unmergeable. The work moved *into* the new job rather than the old
  one keeping it, so step 3 is a deletion rather than a migration. **One trap, caught while writing it:** the
  transitional job uses `if: always()` plus an explicit check of `needs.workspace-verify.result` rather than
  a bare `needs:` — a job skipped because its dependency failed reports *skipped*, and a skipped required
  check does not block a merge, so the obvious spelling would have turned a red recipe into a mergeable pull
  request. That is the third fail-open of this shape in two days, all in gate machinery, and the pattern is
  worth naming: the scaffolding around a check is where the check stops holding. **Step 2 is Gated and the
  maintainer's** — re-point branch protection at `workspace-verify` once this is on `main` — and step 3
  deletes the transitional job. Seam scan clean across files, commit message, and branch name.

- 2026-07-25 · Infrastructure · **Required-check rename complete — steps 2 and 3.** Branch protection now
  requires `workspace-verify` and the transitional `docs-integrity` job is deleted: one job, one context,
  and a name that describes the work rather than a third of it. Step 3 moved nothing but a comment block,
  which was the point of step 1 putting the work in the *new* job and leaving the old one thin — a choice
  that looked arbitrary when both read identically. Two details worth keeping, both invisible from where
  anyone would normally look. **Protection was changed through the `required_status_checks` sub-endpoint,
  never `PUT …/protection`:** that endpoint takes the whole protection object and silently resets whatever
  the payload omits, so a one-field change made that way would have dropped `enforce_admins`, conversation
  resolution, and the force-push block — a settings tweak becoming a hole in the floor, with no error to
  notice. And the check is **pinned to app 15368**, because a context without an app id is satisfiable by
  any GitHub App reporting that name; the branch-protection UI does not surface this and the older
  `contexts` API shape cannot express it. Read back live afterwards: one required check, `enforce_admins`
  true, 0 reviews, conversation resolution on. Recorded as still-unverified rather than smoothed over: the
  floor has not been *probed* since the rename — the settings read back correctly, and reading settings
  back is assertion, which is the distinction this build applies to everything else. Seam scan clean across
  files, commit message, and branch name.

- 2026-07-25 · Doctrine · **The agent gets an identity of its own.** Found while answering a review about
  claims false against the tree: four review replies written by an implementer agent had been posted through
  the maintainer's credentials and therefore appeared under his name. The defect is invisible from inside
  the artifact — a reader cannot tell — and it is the same failure as backfilling a handoff, with the author
  swapped for the timestamp: a record that fabricates a human participant. Mechanism chosen (maintainer's
  call): a **GitHub App**, so comments carry the `[bot]` suffix and attribution rests on the platform rather
  than on a signature convention. Landed: `.portulan/tools/` (a zero-dependency token minter and a `gh`
  wrapper), the rule with its incident in `.portulan/memory/agent-activity-is-attributable.md`, a **"Which
  identity acts"** table in the gate map, and `*.pem` ignored. The asymmetry is stated rather than left to
  look inconsistent: **commits stay the maintainer's** — the build's provenance discipline depends on his
  authorship there — while conversation stops being his, because attribution is not one principle applied
  uniformly but the question *who actually did this*, whose honest answer differs by artifact. Enforcement
  is the App's permission set (pull-request conversation and nothing else — it cannot push, merge, or change
  settings), not the wrapper, which is a guard against habit and bypassable in one line. **The identity does
  not exist yet and an agent cannot create it:** creating accounts and handling credentials are outside what
  an agent does here, so steps 1–5 of `.portulan/tools/README.md` are the maintainer's, and until they are
  done replies still go out under his name carrying a signature line. Verified without credentials —
  signing against a throwaway key, every misconfiguration path exiting 2, and a real API call surfacing
  GitHub's refusal; that last one corrected the code, since a nonexistent App returns 404 rather than 401
  and the hint would have sent a reader to check their clock. · Supervised in a fresh Fable 5 context:
  APPROVE-WITH-ADJUSTMENTS, all four folded in — the gate map described the mechanism as live when the App
  does not exist yet; an unanticipated exception in the token minter would have exited 1, borrowing the code
  that means "GitHub refused" for a script that could not run; and the wrapper's guard refused `gh pr` — the
  tool's own purpose — with a flat no, which would have sent an agent straight back to plain `gh` and the
  maintainer's name, so it now names the sanctioned spelling. Seam scan clean across files, commit message,
  and branch name.

- 2026-07-25 · M2 (Workspace spec v1), session 2 of 2 · **The spec became a rail, and its first run found
  the repository in arrears.** `cli/doctor.mjs` validates a workspace against the Workspace Definition —
  schema conformance, path resolution, cross-references, workspace claims against the tree, and every
  rule's provenance — with a test suite written before it and ten known-bad manifests plus a drifted
  workspace behind it. It is declared as a verify recipe, so CI ran it **without the workflow being
  touched**, which is proposal 0004's claim collected a milestone after it was made. Two demonstrations
  matter more than the fixtures. **The first run against `.portulan/` went red on three of five rules**
  carrying prose provenance where the two-form stamp had been mandated one session earlier and written
  into the spec, the schema and two core templates the same day — nobody was wrong on purpose, nobody
  looked, because looking needed a tool that was one session away (`a-mandate-nothing-checks-is-already-broken.md`).
  And the validator **fails closed on any JSON Schema keyword outside its declared subset** rather than
  ignoring it, which makes true a sentence `spec/README.md` had only asserted — that a schema reaching
  outside the subset is a change to `doctor` too — because skipping and enforcing are indistinguishable
  from outside (`a-checker-must-refuse-what-it-cannot-check.md`). The demo workspace landed as the
  schema's **second instance**, fictional, two products, exercising what customer zero cannot: repeated
  products, affordances resolving down the cascade, declared packs, and a sealed provenance stamp. It
  earned its keep immediately by producing a schema change — the claims lint needed to know *which* tree a
  repo card describes, and the demo's repositories do not exist. The obvious answer, dispatching on
  `kind`, was rejected twice: it breaks on the portfolio workspace at milestone 6, which is not a demo and
  has no single tree either; and it would disable a whole check class on a **self-declared** field. So
  `tree` is declared, and a workspace without one has its claims **reported unverifiable**, never skipped.
  It began optional and ended **required for `kind: repository`** — see the proposals below — which took
  the spec to **2.0** with the first migration this project has written. Provenance binds `type: rule` and nothing else, because thesis 4,
  proposal 0002 as adopted, `dod.md` condition 3 and the milestone criterion are all rule-scoped; binding
  more would be tooling enforcing a rule nobody legislated. Two thesis-4 notices swept, now that the
  constitution names both forms — the machine enforces what the constitution states, which is the only
  order those two are allowed to be in. Also caught, and **not this change's doing**: the gate map still
  said the agent identity did not exist, hours after it went live. Found by grepping by hand, and the lint
  this milestone shipped **cannot catch it** — prose about a fact outside the tree is outside what a
  claims lint sees, which is a narrower boundary than "workspace claims are linted" implies. One false red
  is recorded rather than buried: the session's *first* red test run used `node --test cli/`, which Node 26
  rejects as a bare directory, so it failed on the wrong module and looked exactly like the red it was
  meant to be. · Supervised in two fresh Fable 5 contexts. Session-open APPROVE-WITH-ADJUSTMENTS (ten
  required, all folded in) — chiefly that the provenance mandate is **rule-scoped**, which corrected an
  implementer assumption that would have bound `decision` records nobody had legislated for, and that the
  claims lint must not dispatch on `kind`. **Pre-commit APPROVE-WITH-ADJUSTMENTS: nine required, and five
  were defects in `doctor` itself, in the milestone whose own new memory entry is titled *a checker must
  refuse what it cannot check*.** A manifest declaring a Workspace Definition version that has never
  shipped validated green, because nothing read `portulan.spec` at all; `additionalProperties: false`
  written without a sibling `properties` — a supported spelling that forbids every key — was silently a
  no-op; the gate map's required-check claim was extracted *inside* the tree branch, so a workspace
  without a tree had that claim dropped rather than reported, in exact contradiction of the paragraph
  promising it never would be; an unguarded read of the gates file turned a workspace already judged
  **red** into exit 2, trading a verdict for "could not run"; and the provenance parser took the last
  matching token, so a correct record whose annotation prose *discussed* the other form would have gone
  red — a false red invited by the template's own instruction to annotate freely. Four more findings were
  claims false against the tree in this session's prose, including a fixture miscount in two files and a
  justification resting on two proposals' states that were both wrong. Every fix carries a test; the suite
  went 59 → 68. **Milestone-close CLOSE** on every clause the build may demonstrate, reached by forcing
  each check red before believing any green — and it measured the design's real hole: deleting the one
  `tree` line from customer zero's manifest degrades the entire claims-lint class to notes, GREEN, exit 0.
  Loud and pull-request-visible, and the same shape as the rest of the fabric where declaring is what
  enforces, so it is carried debt rather than a blocker — drafted as
  `.portulan/proposals/0005-a-repository-workspace-must-declare-its-tree.md`, not applied, because binding
  it is a MAJOR bump for one check and that trade is the maintainer's. **A Copilot review on the pull
  request then found the fifth and sixth defects of the fail-open class in four days**, both in the two
  recipes this session added, both in the scaffolding rather than in a check: `doctor.sh` passed a missing
  validator through as exit 1 — a red verdict about two workspaces nothing had looked at, one dependency
  over from the `node` guard written to stop that exact shape — and `tests.sh` piped `find` into `wc -l`
  without checking `find`, where the dangerous case is a *partial* failure rather than a total one, since
  one unreadable subdirectory yields a plausible-but-short count and the suite then runs a subset while
  reporting on the whole. Both demonstrated and now exit 2. The pattern is worth naming once: the guard is
  never where the check is. **Both pending proposals were then decided and applied in the same pull
  request**, on a recommendation the maintainer commissioned from a fresh-context Fable 5 and posted under
  the agent identity. `0003` retired its memory entry — demoted to `reference` and trimmed to the
  directory-to-`kind` mapping, with the vocabulary left to the spec where it is now singular rather than
  duplicated; the first retirement condition in this workspace to have fired and been acted on, which
  gives milestone 5's demotion pass a real instance instead of a specification of one. `0005` made `tree`
  **required for `kind: repository`**, taking the spec to **2.0** with its first migration. That
  recommendation reversed this session's own conclusion and was right to: the proposal had priced "MAJOR
  for one check" against the wrong date, when two manifests exist, one already declared `tree` and the
  other is exempt — fourteen files moved and **zero content edits**. The implementer's follow-on
  objection, that 1.1 had to reach `main` first, was also wrong and is recorded as such: `main` carries
  1.0, so 1.0 → 2.0 is a migration from a version that genuinely shipped, and publishing 1.1 only to
  obsolete it an hour later would have cost two bumps to do one bump's work. One cost is stated rather
  than hidden — the new constraint is the single rule the schema does not carry, because the declared
  subset has no `dependentRequired`, so it lives in `doctor` and `spec/slots.md` says so loudly.
  **The milestone does not close.** The criterion's private-pilot clause was checked rather than assumed —
  the pilot carries no workspace manifest, so it is not onboarded to the Workspace Definition and there is
  nothing to validate. Striking the clause on that evidence was offered and **declined**: the maintainer
  kept it, which makes onboarding the pilot a client-session task and leaves milestone 2 in-progress until
  it is discharged as written. Worth recording as the harder of the two choices — the criterion could have
  been narrowed to fit what had been built, and narrowing a criterion until it closes is precisely the
  failure the milestone-1 amendment was written to warn about. Seam scan clean across files, commit
  message, and branch name.

- 2026-07-26 · M2 (Workspace spec v1) · **Milestone closed, and the clause that had held it open was
  struck as contradicting a ruling already taken.** The previous day the maintainer was offered the
  strike and declined — correctly, because the argument offered was *"there is nothing there to
  validate"*, which is narrowing a criterion to fit what was built. Asked plainly what the clause was even
  asking for, the honest answer was different and much stronger: the governing private context's
  milestone-1 footnote, amended 2026-07-25, states that the client-rooted work remaining there **neither
  gates any public milestone** — and this row gated one. (Non-gating, *not* optional: a residual check
  there is a standing task in its own context. An earlier draft of this entry said "optional", which
  overstates in the direction that flatters the argument; the strike audit caught it.) It had never been reconciled to
  that ruling, and *nothing could have reconciled it*: the governing document sits outside this repository
  by design, so no check here can read it. The clause also carried both defects the milestone-1 amendment
  was written to remove — a criterion no build session could execute under our own rules, structurally
  guaranteeing a close-by-assertion, and a public milestone made dependent on the predecessor framework as
  an input. Removed in one row and left standing in the next, which makes it an anecdote about one row
  rather than a rule. So the criterion was amended with Marius (that row only), the pilot check stays
  available privately and gates nothing, and **the milestone closes on what was already demonstrated and
  merged.** Generalised rather than fixed once:
  `.portulan/memory/a-public-criterion-must-be-demonstrable-from-this-repo.md` — an exit criterion must be
  demonstrable from this repository alone, and the entry says this is **mostly not railable** and records the grep-able part that is,
  because the same boundary that hides the private context is the one that let the gate map claim the
  agent identity did not exist for hours after it did. Prose about a fact outside the tree is invisible to
  every check here; naming that limit is the point of the entry. Recorded as a candidate for `core/` — the
  general form is universal and `operating/verification.md` scopes *what* a done-claim must be without
  scoping *where* it must be demonstrable — but promoting it needs a proposal through the human gate, not
  a workspace incident written upward. · **Strike audited in a fresh Fable 5 context: CLOSE, with three
  riders, all folded in.** It read the governing document at source rather than taking the claim on trust
  and found the argument *stronger* than stated — that document's own live terms wanted the pilot
  validation unreferenced in repo docs, so the struck clause had been doubly unhomed since bootstrap. It
  also found the one overstatement: the private work is **non-gating, not optional**, and "optional" had
  propagated into four files. And the rider that mattered most — **the new rule as first drafted was a
  ready-made argument for striking the milestone-3 public-flip clearance.** A rule written to prevent one
  bad strike, loaded to authorise the next. It now binds *exit criteria* only and says explicitly that it
  never reaches an authorization hold: a criterion answers *is this done?* and must be demonstrable where
  it is claimed; a hold answers *may this happen?* and is legitimately granted from outside. Also caught:
  a figure silently dropped from the earlier dated fidelity note (restored), and a misquotation of
  `core/operating/verification.md` in the new entry. Seam scan clean across files, commit message, and
  branch name.

- 2026-07-26 · M3 (Plugin & public marketplace), session 0 of 1–2 · **The engine stopped being a
  directory you clone.** The repository is now a plugin as well as a marketplace: `.claude-plugin/plugin.json`
  declares the engine's skills and the personas as agents, the marketplace entry sources the repository
  root, `plugin/skills/portulan/SKILL.md` boots the engine, and `plugin/agents/` binds the three personas
  to this host. `cli/plugin-lint.mjs` checks the packaging, written after its suite — 57 tests then, 59
  once two of the session's own defects each earned one — and red on the
  right module first, and declared as the fifth verify recipe — so CI runs it with **no workflow edit**,
  the third time proposal 0004's mechanism has paid out. `CODEOWNERS` landed too, five handoffs after it
  was first wanted — owned by the org team `@sleepy-panda-works/maintainers` rather than by a person, on
  the maintainer's instruction, so the day a second reviewer arrives is a membership change and not an
  edit to eleven lines — with the honest half stated in the file: *Require review from Code Owners* stays
  **off**, because one human plus `enforce_admins` plus a platform that forbids approving your own pull
  request means switching it on would deadlock every merge — so `docs/vision.md` is still protected by
  prohibition and not by the platform, and the file is a routing table until a second reviewer exists.
  · **The design turned on one platform rule, read at source rather than assumed:** component paths must
  start with `./` and stay inside the plugin root, so a plugin rooted at `plugin/` could not reference
  `../core/skills/` and would have had to carry *copies* of the engine's skills — the drift class the
  previous milestone built a lint against. Rooting the plugin at the repository makes the skills the
  engine documents and the skills a user installs the same files. The maintainer took the payload
  decision knowingly: an install copies the whole repository into the plugin cache, `examples/` and
  `spec/` included, which for a product whose thesis is *the product is the files* is closer to a feature
  than a cost; the session-open supervisor found the symlink alternative the implementer had missed, and
  it is recorded in `plugin/README.md` with why it was not taken rather than left unmentioned. That
  choice creates one real hazard and it is designed against, not documented around: the bundle contains
  **two valid workspace manifests**, so a boot skill looking for "a `.portulan/` nearby" would find one
  inside its own installation and boot green on another team's gate map. The skill searches the project
  directory and says so. · **The session's sharpest finding is about checkers, and it inverted an
  assumption this plan had already written down.** Two validators were run against the same tree within
  the same hour and each went green on a defect the other caught: the repo-owned lint passed a
  `plugin.json` the first-party validator refused outright, and `claude plugin validate --strict` passed
  a `SKILL.md` with its frontmatter deleted, its `description` emptied, and a non-kebab-case name —
  measured further, it validates **no** skills at a marketplace root and only default-path skills in
  plugin form, so it examines none of the skills this repository ships. Had the amended criterion named
  the first-party validator alone, as the implementer first proposed, it would have been **weaker on
  skills than the clause it replaced.** Recorded as
  [`.portulan/memory/a-checkers-coverage-is-measured-not-named.md`](../.portulan/memory/a-checkers-coverage-is-measured-not-named.md),
  and it is a third rule in a family: one governs a checker we write, one a rule with no checker at all,
  and this one the checker that runs, reports green, and never looked. · One defect in the new validator
  is worth keeping because the suite could not have caught it: with a **relative** root — which is how
  the verify recipe calls it — declared skill paths resolved absolute while the tree walk stayed
  relative, so every shipped skill was reported as undeclared. Every fixture in the suite passed an
  absolute temporary directory. A suite that exercises one shape of an argument has not exercised the
  argument. · The carried harness item finally has a home: `.portulan/tasks/0004-a-harness-for-the-verify-recipes.md`,
  with all seven fail-opens listed, rather than a third forward-reference in a handoff. · Supervised at
  session-open in a fresh Fable 5 context: **APPROVE-WITH-ADJUSTMENTS, ten required, all folded in** —
  including the symlink alternative, the boot-skill false green, the two `CODEOWNERS` claims missing from
  the sweep list, and the instruction to *measure* the first-party validator's coverage by forced red
  rather than cite it, which is what produced the finding above. · **Three Copilot rounds on the pull
  request then found eight more, and every one was a claim false against the thing beside it.** Two were
  substantive: containment was **lexical**, so a symlink out of the tree read as inside it — the shape
  this repository had already considered and rejected for its own payload; and skills were validated with
  `requireName: false` while three documents said a name is checked, which is the docs being right and
  the code not doing it. One finding was **refused with a measurement rather than an argument** — that
  the audit's pathspec reaches only one directory deep, when git's default magic lets `*` cross `/`,
  shown by planting a manifest four levels down. And **rounds 2 and 3 were each about the previous
  round's repair**, which is the durable lesson: a fix is a change, and a change is unreviewed until it
  is reviewed. · `CODEOWNERS` then moved from a personal handle to the org team
  `@sleepy-panda-works/maintainers` on the maintainer's instruction, in the order where every wrong step
  is silent — team created visible, granted write, and only then referenced — verified by GitHub's own
  `codeowners/errors` returning zero rather than by eye. · A second limit of the agent identity was found
  **by attempting the action rather than by reading the permission list**: it cannot open a pull request
  at all, because that needs repository-contents read and the App is deliberately refused it. Not a gap
  to close — that refusal is what makes the permission set the enforcement rather than the wrapper — so
  the pull request was opened under the maintainer's credentials with an attribution line in its body,
  and every comment on it came from the bot. **Milestone 3 stays open:** `v0.1.0`
  tagged and the fresh-machine install are session 1, and both need a push. Seam scan clean across files,
  commit message, and branch name.

- 2026-07-26 · M3 (Plugin & public marketplace), session 1 · **The install demonstration was the
  session.** A machine with no local copy of this repository — empty `CLAUDE_CONFIG_DIR`, a temp project
  with no relation to the tree — added the marketplace by GitHub shorthand and installed the plugin: the
  clone landed on `9e21688`, byte-identical to `origin/main`, fetched over **HTTPS** after the CLI probed
  for SSH and fell back without being told to, which corrects session 0's open question 1 (no
  `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` was needed). Visibility recorded at the moment of the install:
  **PRIVATE**. The payload is the whole repository, exactly the cost `plugin/README.md` states. · **Then
  the host's own component inventory reported `Agents (0)`** — for a plugin whose `plugin.json` declared
  three, whose three files all shipped in the cache, whose repo-owned lint counted three, and which
  `claude plugin validate --strict` had just passed. The persona-binding criterion had been ticked in
  session 0 and was false; the install is the only thing that could have said so, because the defect is
  not in any file. A seven-form fixture matrix **with a positive control** — a second plugin reporting
  `Agents (1)` from the same command in the same minute — established that the reading was a measurement
  and not an artifact of the command, and established the mechanism: an `agents` key does not merely fail
  to point the loader at the files, it **suppresses** the default scan that finds them, and no location
  but `./agents/` is scanned at all. Every declaration form the manifest can express is either inert or
  refuses the whole plugin. · Fixed on the maintainer's persona/agent ruling — separation is load-bearing
  (three theses require it) and must never become duplication — by dropping the key and reaching the
  bindings to a top-level `agents/` — the default agents directory of a plugin whose root is this
  repository, and therefore a location fixed by the platform rather than chosen. The tempting
  alternative, re-rooting the plugin at `plugin/` so that `plugin/agents/` became the default, is the
  one to record as refused: **the installed payload is the plugin root's subtree**, so that plugin would
  ship skills and agents and *not* `core/`, which is the milestone's whole point. A symlink was built
  first and worked, and was rejected on the maintainer's direction for the honest reason — it was
  measured through `--plugin-dir` and a local-path install but never through a clone, so it stacked an
  untested path on a platform quirk. · **Verified from a real install rather than from `--plugin-dir`:**
  marketplace add plus install into a versioned cache reports `Agents (3)  reviewer, librarian,
  implementer` and `${CLAUDE_PLUGIN_ROOT}/core/engine.md` readable at 43 lines — one check confirming
  both the repo-rooted decision and the fix. The remote clone stays untested until this merges, and its
  criterion stays unticked. · **The fix opened two fail-opens and both were
  closed in the same change**, which is the part worth keeping: the verify recipe printed `0 agent(s)` and
  **GREEN** the instant nothing declared them, so `plugin-lint` now finds agents by convention, fails on a
  present `agents` key, and asserts this repository's count of three against the tree; and the `map` check
  turned out unable to see a top-level symlink at all — `awk -F/ 'NF > 1'` yields only directories that
  contain tracked files — so it had silently stopped covering the tree the day the tree gained one. Both
  extended red-first; suite 146 → 149 with 9 red before the implementation, and every new check forced red
  on the real tree afterwards, including the one that stays open: deleting `agents/` outright is a note and
  exit 0, named rather than hidden and handed to `.portulan/tasks/0005-lint-the-persona-agent-binding.md`.
  · **The two symlink claims the payload decision rested on were measured and are false.** Both readings
  of "local-directory install" follow a link resolving outside the plugin directory — the marketplace path
  dereferences it into the cache, `--plugin-dir` loads it in place. The decision stands anyway, on a reason
  the record never gave: this repository's own lint refuses that shape, so taking the alternative means
  relaxing the check the gate map singles out as the one to scrutinise hardest. A third path — a clone from
  a remote carrying such a link — is left explicitly **unmeasured**, because the only way to test it is to
  publish a fixture repository, and one measurement standing in for two claims is how the false sentence
  got written in the first place. · `CHANGELOG.md` is written, the first, and merges ahead of the tag it
  describes so the tagged tree carries its own entry: Protocol →
  Versioning has required a changelog per release since this file was locked and nothing had produced one
  — found by the session-open supervisor, not by the implementer. · Supervised at session-open in a fresh
  Fable 5 context: **APPROVE-WITH-ADJUSTMENTS, eight required, six changing the work** — the missing
  changelog; an ordering that would have merged a Session log asserting a tag that did not yet exist, the
  exact shape the preceding commit is named for; pinning the clone's provenance rather than asserting it;
  inspecting the payload *before* the boot test that depends on it; a distinguishable identity in the test
  workspace so a transcript proves which one was read; and the requirement that the symlink measurement
  exercise the install path each claim is about. **Adjustment 4 — list what the host actually registered —
  is what found `Agents (0)`.** · **Two pre-commit checkpoints, both APPROVE-WITH-ADJUSTMENTS** — four
  required, then seven after the maintainer changed the fix and delegated the topology amendment, which
  his standing rule sends to a fresh context. The second's work item is the one to carry: **the rejected
  symlink arrangement passed every check in this repository.** The supervisor rebuilt it and got lint
  GREEN, map GREEN, suite green — one session after "a shape that passed both checkers and was inert at
  runtime" became the newest rule here. It is refused now by a repository-anchored test rather than by a
  rule in the lint, because the platform *accepts* that shape and a generic refusal would encode this
  repository's risk appetite into a tool other plugins run. The same pass found that `readdirSync`
  reports a symlink as neither file nor directory, so the obvious filter **dropped** a symlinked agent
  silently — this session's defect in miniature, inside the fix for it. The first checkpoint found
  `v0.1.0` asserted as cut in four places with no tag in existence, `Agents (3)` attributed to an
  install it had not been read from, a task edit claimed and never made, and suite arithmetic carried
  from a stale figure. · **Three Copilot rounds on the pull request, four findings, three real and one
  refused with a measurement** — recorded here before the merge rather than after, which is the rule the
  preceding commit exists to state. Round 1: `existsSync` **follows** symlinks, so a broken `agents`
  link answered "absent" and went GREEN with `0 agent(s)`. Round 2: the repair's own catch-all filed
  *every* error under absent, so EACCES became the same benign note — three states now, because "I could
  not tell" is a real answer. Round 3: the layout table still put the personas under `plugin/`, and **the
  `map` check cannot catch that** — it holds the README to the *set* of top-level entries, never to what
  a row says about one, so the table can be complete and wrong at once; the second time this repository
  has hit that exact boundary, after "the App does not exist" survived hours in the gate map. The refused
  one was an unmatched backtick that is a template-literal delimiter in the source and not a character in
  the output, measured and left alone. **Rounds 2 and 3 were each about the previous round's repair**,
  and rounds 1 and 2 are both the short-input-set defect — the class this pull request is about, found
  twice inside the code written to close it. · **Milestone 3 stays open on one clause.** The boot needs a live session
  and the account's credit balance blocks every one, including a control `claude -p` with no plugin loaded;
  classified as an auth failure rather than read as a packaging failure, which is the misreading session 0
  flagged in advance. Seam scan clean across files, commit message, and branch name.
  *Amended 2026-07-27 (fresh-context audit): "asserts this repository's count of three against the tree"
  above overstates `plugin-lint` — that assertion lives in its test suite, `cli/plugin-lint.test.mjs`, so
  it runs with `tests.sh`, not `plugin.sh`; the tool itself counts and reports.*

- 2026-07-26 · M3 (Plugin & public marketplace), session 1 close-out · **PR #19 rebase-merged
  (`main` = `9305a16`), `v0.1.0` tagged and pushed** — annotated, on the commit whose manifests declare
  `0.1.0` and whose tree carries its own `CHANGELOG.md`, the ordering the maintainer ruled: fix first,
  then tag the merge. · **The tag immediately paid for itself.** With the fix on `main` the clone could
  finally carry it, so the install was re-run the way a stranger runs it — empty `CLAUDE_CONFIG_DIR`,
  temp project, marketplace added by GitHub shorthand — and the host reported `Agents (3)  reviewer,
  librarian, implementer`, clone HEAD `9305a16`, `${CLAUDE_PLUGIN_ROOT}/core/engine.md` readable at 43
  lines. That criterion had been held **unticked through the whole session on purpose**, with the
  measurement sitting in hand from two other install paths; ticking it early would have been the exact
  mistake the session exists to correct, one level up. · **Milestone 3 still does not close, and the
  blocker is unchanged and external:** booting the installed engine needs a live session, and every
  `claude -p` returns `Credit balance is too low` — including a control run with no plugin loaded, which
  is what classifies it as auth rather than packaging. The milestone-close checkpoint has therefore not
  run: its job is to verify the criterion was *demonstrated* and sign a fidelity note, and one clause has
  nothing to sign. What is demonstrated is that the engine **arrives**; what is not is that it **boots**.

- 2026-07-27 · M3 (Plugin & public marketplace) · **MILESTONE CLOSED.** The blocker was billing, not
  packaging: the standalone CLI was signed in in Console/API mode against an empty credit balance while
  interactive sessions billed the subscription — one account, two wallets. **The control probe is what
  localized it** — a `claude -p` with no plugin loaded failed identically, so it was never chased as a
  packaging fault. · **The boot, run from an install of the tagged release** (clone `9305a16`,
  `git describe --tags` = `v0.1.0`), twice because the clause has two halves and one is a false green
  waiting to happen: in a project with no workspace the engine reported the absence and named all three
  bundled manifests as things it declined to fall back to; in a project carrying its own workspace it read
  *that* one and quoted its glossary marker, grepped absent from the merged tree and the payload before the
  fixture was built — which is what makes a transcript proof rather than assertion. The previous session's
  marker was retired precisely because writing it into a handoff ships it inside the payload. · **A real
  limit, found by the first attempt and now written into the skill:** under default headless permissions
  the kernel read is **denied**, because `${CLAUDE_PLUGIN_ROOT}` lies outside the project. The boot handled
  the workspace half correctly anyway, which is the dangerous part — it looks like a boot with no engine in
  context. Step 1 of the boot skill now says a denied kernel read is an incomplete boot to be reported
  rather than worked around. · One criterion was **un-ticked mid-session and re-ticked on the boot**: it had
  read `[x]` for a day on the strength of the skill's wording, and the wording is a fact about a file while
  the criterion is about behaviour — the same confusion that produced `Agents (0)`. · Supervised at
  milestone-close in a fresh Fable 5 context: **CLOSE**, reached by reproducing every clause independently
  on a second CLI version rather than replaying the transcript — including its own install, its own boot
  fixture with its own marker term, and five forced reds. It required three record fixes first (a ticked
  criterion whose letter is false against the shipped manifest, a stale suite figure, and a self-
  contradicting boot count) and left the maintainer's config restored to its exact baseline. Seam scan
  clean across files, commit message, and branch name.

- 2026-07-27 · post-M3, pre-M4 — **no milestone row touched, and none was due** · Dependabot **security**
  updates turned on and closed on what was *observed*, not on the toggles being flipped: SBOM `404` → `200`
  listing the exact pinned `actions/checkout` SHA, `vulnerability-alerts` `404` → `204`,
  `dependabot_security_updates` `disabled` → `enabled`, the advisory list `403` → `[]`. Coverage is honestly
  **one** dependency and the record says so. Proposal `0006` accepted, its rule in the gate map — and its own
  Decision line corrected, because it claimed "an agent cannot perform them" of three settings when two are
  reachable by any admin token: prohibited is not impossible, in a document whose subject is two things
  conflated because they share a name. · **PR #22's watcher was made to prove itself.** For five days it had
  no evidence behind it at all — no REST endpoint for version-update jobs, no `dependabot` check run on any
  commit read, and the pin already newest, so "opened no pull request" and "never ran" were the same
  observable. The pin was deliberately regressed to v7.0.0 (#25), Dependabot opened the bump back (#27), and
  **merging that was simultaneously the proof and the revert** — demonstrating the claim the config rests on,
  that the SHA and its trailing version comment are rewritten together. Generalised as proposal `0007`,
  accepted and applied: *a watcher earns its place by being watched*. · **The platform floor was three layers
  and the gate map described one** (#26). Missing: an organisation ruleset over every default branch carrying
  an `OrganizationAdmin` always-bypass. Understated: `sha_pinning_required: true` at org and repo — **a rail
  written down as a habit**, the first drift here to run in that direction and no less wrong for it. The
  `enforce_admins`-versus-bypass interaction is recorded **untested**, because GitHub documents aggregation
  but not that interaction and the only test risks `main`; the section now claims less than it did. · Copilot
  auto-review made automatic via a repository ruleset carrying that rule only, observed firing at pull-request
  open on #28 and #29, unasked. `delete_branch_on_merge` set and verified by three merges. · Two lessons cost
  something to learn: **a mechanical revert is not a narrative revert** — Dependabot rewrote the pin and not
  the paragraph about the pin, so `main` briefly carried a false claim produced by the fix working as
  designed; and adding the Copilot ruleset made #26 incomplete while #26 was open. Residuals swept rather
  than left: the weekly schedule is unproven and `.github/dependabot.yml` now says so, and proposal `0008`
  asks whether the rule 0006 and 0007 both cited actually covers them — on close reading it does not, and
  **two of three citations were loose**. · **Supervisor fidelity: NONE. This session ran unsupervised at every
  checkpoint — no session-open, no pre-commit before any of seven commits, no milestone-close (none due).**
  The gate map's fallback is invoked explicitly rather than passed over: supervision was unavailable, it is
  stated plainly, and the maintainer reviews the diff. Copilot reviewed all six pull requests and the
  maintainer merged each, which is **not** the fresh-context pre-commit checkpoint the protocol asks for —
  and two of the three defects found in this session's own work were found by Copilot rather than by the
  implementer, which is the argument against treating review-at-merge as a substitute. Handoff:
  [`.portulan/handoffs/2026-07-27-dependabot-security-and-the-watchers.md`](../.portulan/handoffs/2026-07-27-dependabot-security-and-the-watchers.md).
  *Amended 2026-07-27 (audit remediation): this entry closed without the seam attestation its siblings
  carry. An independent scan of the arc — files, commit messages, branch names — was clean, so this was a
  record gap and not a leak: seam scan clean, attested after the fact.*

- 2026-07-27 · post-M3, pre-M4 — no milestone row touched · **The git-push tier doctrine rewrite (#32)
  and the two-lessons extraction (#33) — recorded here after the fact; the arc itself logged nothing,
  which is an audit finding and the reason this entry exists.** #32 hoisted *the gate is the maintainer's
  decision, not his keystroke* into the Gated tier header where it governs every action in the tier — it
  had been stated once, in the Propose tier, attached to merging, and the Gated tier was read literally
  for a whole session of hand-typed pushes; `git push` of a working branch moved to Auto (its old reason
  did not survive: the guarantee was always at the merge, which stays Gated), force-push Auto only with
  `--force-with-lease`, the merge's two-tier split resolved, three falsified tier definitions re-read and
  fixed, and the parent handoff visibly amended with the defect found after it merged. Generalisation
  recorded: *where a rule and its clarification live apart, only the rule gets read.* #33 extracted the
  day's two lessons into memory rules by handoff provenance — `a-stated-enforcer-must-be-the-real-one`
  and `a-mechanical-revert-is-not-a-narrative-revert` — each retire-when naming the in-flight `0008`
  revision; `doctor` then counted 14 memory records, 12 rules. · **Supervisor fidelity: no fresh-context
  pre-commit checkpoint is recorded for either pull request** — Copilot review plus the maintainer at
  merge, which the parent session's record itself says is not the checkpoint; `review_on_push` was
  reversed to `true` mid-arc after three fix rounds on #32 sat unreviewed. · *This entry is a
  reconstruction, written 2026-07-27 by the audit-remediation session from the merged record.* · Seam
  scan of the arc's diffs, commit messages, and branch names: clean (re-scanned independently during
  reconstruction). Handoff (labelled reconstruction):
  [`.portulan/handoffs/2026-07-27-the-gate-is-the-decision-not-the-keystroke.md`](../.portulan/handoffs/2026-07-27-the-gate-is-the-decision-not-the-keystroke.md).

- 2026-07-27 · M4 (Enforcement compiler), session 0 of 1–2 · **The gate map stopped being a document.**
  `.portulan/gates.json` is the policy as data — actions bound to tiers in a **host-neutral** vocabulary,
  `{"shell": "git push"}` rather than any host's matcher syntax, so session 1's second backend tests the
  seam instead of forcing a redesign. `cli/compile.mjs` compiles it to `.claude/settings.json`;
  `.portulan/compile/` is the runtime that artifact points at; `compile --check` is the **sixth verify
  recipe**, declared in the manifest, and **CI ran it on the pull request with no workflow edit** —
  `compile — ./.portulan/verify/compile.sh`, `10 compiled, 12 refused`, GREEN, in the `workspace-verify`
  job on [#31](https://github.com/sleepy-panda-works/portulan/pull/31). Proposal 0004's mechanism, fourth
  payout, collected rather than asserted. (Held as a conditional in this entry until the run existed,
  which is the same discipline that kept milestone 3's install criterion unticked for a whole session.) Spec 2.0 → **2.1**, one optional additive key, with the demo workspace deliberately left at 2.0
  so the older-minor path is exercised rather than swept along. Suite 155 → 226. (199 at the pre-commit checkpoint, 209 after its regressions, 214 after the consistency review, 226 after the Copilot round and the push-tier reconciliation. Written out because this figure has now been wrong three times in this row — it is edited in the same breath as the sentence beside it and then not re-measured.) · **Both demo clauses ran
  against a live host with the settings in force.** The push demo used a scratch bare remote **on
  purpose**: had the gate failed, the demonstration itself would still have performed no outward action.
  A headless session ran `git status --short` (positive control), was refused the push, and the remote
  held 0 refs; the maintainer's own hand then pushed the same command successfully, which is what makes
  the claim *blocked* rather than *impossible*. The Stop-gate demo planted one dead link, and a session
  told to reply `done` was held open three times carrying the recipe's own output — naming the file and
  line — before being released at its cap; green, it ended in one turn. · **The session's sharpest finding
  refuted its own design, and it was a measurement that did it.** The hook existed to supply a better
  sentence than "permission denied". It cannot: when a permission rule matches, the host runs the hook and
  **discards its reason**, proven with a canary that recorded both the invocation and the exact command the
  hook saw while the agent still received the generic message. Shipping it as planned would have been an
  inert component reading as an active one — `a-manifest-field-can-validate-and-load-nothing` again, one
  milestone later, inside the milestone whose whole subject is enforcement. The layer was **re-earned
  rather than kept out of habit**: a permission pattern is a literal prefix match and never sees
  `bash -c "git push …"`; the hook does, and there the permission layer has nothing to say, so the hook's
  decision *and* its sentence reach the agent. Demonstrated live in both directions. The other half of why
  both layers exist is that **a crashed hook fails open** — measured — so the permission rule is the gate
  and the hook steps aside silently on any internal error. Recorded as
  `.portulan/memory/two-layers-need-two-jobs.md`. · **The hazard that nearly shipped is the one worth
  keeping.** This repository *is* a plugin whose payload is the whole tree, and a plugin carrying
  `hooks/hooks.json` has those hooks **fire for everyone who installs it, in unrelated projects** —
  measured, with a positive control, and discovered before any hook fired because the malformed shape made
  the *whole plugin* refuse to load, which proved the file was being read. A top-level `hooks/` here would
  have denied strangers' pushes and blocked their sessions over a policy they never adopted, and it would
  have looked correct from every angle available at rest. `.claude/settings.json` was measured too and does
  **not** leak. The `agents/` lesson from milestone 3 with the blast radius pointed outward; recorded as
  `.portulan/memory/a-plugin-payload-can-enforce-on-strangers.md`. · **Maintainer's rulings, taken with the
  measurements in hand rather than before them:** the artifact lands **tracked and in force** here; the
  compiler emits **no `allow` rules**, so a defect in it can only ever add a gate; the Stop-gate **blocks
  with an iteration cap**; and the **session-end handoff gate is built now** rather than deferred again.
  · **Supervised at session-open in a fresh Fable 5 context: APPROVE-WITH-ADJUSTMENTS, eleven required.**
  Three changed the outcome rather than the wording. It counted **four** tier classes in the gate map
  against the three the implementer had planned — so `prohibited` exists as its own class, and the
  constitution is refused outright instead of compiling to a prompt that says *never, unless someone clicks
  yes*. It refused the plan's Gated-as-unconditional-deny and sent it to be measured, which is how `ask`
  turned out to fail closed headless and to be the honest reading of "explicit human approval, per action".
  And it demanded the plugin non-leak probe, which is the only reason the `hooks/` hazard was measured
  rather than met by an adopter. It also found the **third** milestone-4 promise the plan had missed
  entirely — the session-end handoff gate — and, supporting it, that no handoff was written for the
  milestone-3 close the day before: the cadence rule going unfollowed the day before the milestone meant to
  mechanise it. · **Milestone 4 stays open.** Session 1 carries the **GitHub repository-ruleset export**,
  the per-host backend matrix and `doctor`'s degradation report — for which the refusal accounting is
  already the data model, so that session is mostly formatting rather than new measurement. The two
  questions this entry left open were **both answered by Marius on 2026-07-27**: the export is a
  repository-ruleset export and not a Copilot integration, and it is exactly where
  `core/operating/autonomy.md`'s platform-floor promise lands. Corrected here rather than left standing,
  because the retired phrase surviving in a forward-looking sentence is the whole defect the rewording was
  paid for — found by grepping for it afterwards, which is the practice proposal 0008's direction B asks
  for. Seam scan clean across files, commit message, and branch name.

- 2026-07-27 · post-M3, pre-M4 — no milestone row touched · **Audit remediation: four pull requests, one
  per finding category of the day's fresh-context audit (taken at `aa48abe`, every finding re-verified
  against `863b87b` before fixing).** #34 contradictions — `v0.1.0` present tense in `README.md` and the
  product card (the tag exists); `spec/slots.md` no longer names a spec 1.1 that never reached `main` and
  drops a proposal count that had rotted; a retire-when stops citing a milestone-2 report milestone 2
  never built. #36 precision — the count-of-three assertion reattributed from `plugin-lint` to its test
  suite (`tests.sh`, not `plugin.sh`) in the living doc, with visible amendments on three dated carriers;
  `CODEOWNERS` dropped from the kernel's platform-floor enumeration (the gate map: not yet part of the
  floor) and from `identity.md`'s glossary row, kernel at 43/60. #37 stale claims — nine living documents
  rebound from "public at milestone 3" to the public-flip clearance, `repo-is-private-until-milestone-3.md`
  renamed to `repo-is-private-until-flip-clearance.md` with links updated; `docs/vision.md:20` and
  `docs/plan.md:19`/`:34` carry the same phrase and are the maintainer's own to reword — flagged, not
  touched. This PR closes the record: the #32/#33 arc's reconstruction (entry above, labelled handoff),
  visible amendments restoring the State-line count and the missing seam attestation, and a `record`
  check added to `docs.sh` — red first on exactly the missing attestation (`docs/plan.md:714`), green
  once the record was repaired. Enforcement of the audit's unchecked mandates stays milestone 4's; this
  session closed the record, not the gates. · **Supervisor fidelity: commissioned by the maintainer from
  a fresh-context audit; each pull request passed a fresh-context Fable 5 pre-commit review (three of the
  four reviews returned must-fix items — every one folded in and re-verified, this pull request's by
  amending its commit so the shipped commit postdates its review's verdict); no separate session-open
  review; no milestone-close (none due).** The maintainer merges all four; nothing here was merged by the
  session. · Seam scan clean across files, commit messages, and branch names, per pull request. Handoff:
  [`.portulan/handoffs/2026-07-27-the-audit-remediation.md`](../.portulan/handoffs/2026-07-27-the-audit-remediation.md).

- 2026-07-27 · Memory management (maintainer directive; no milestone status moved — the milestone-5
  criterion sharpened, not started) · **The store now reports its own growth, and milestone 5's budgets
  stopped being prose.** The directive — "We need a bullet-proof memory management system. This issue
  should never ever happen: memory growing too large" — followed an incident on the operator's side of
  the seam: the build's harness-local session memory, never part of this tree, had grown into a
  duplicate of history the repo already records, and was consolidated the same day under hard budgets
  whose own retire-when names milestone 5. In-tree, the assessment first: the kernel's 60-line budget is
  this repository's one true size rail; provenance-on-rules is a rail; capture restraint is doctrine
  ("a change that taught nothing durable should add nothing"); but retire-when — the field the
  milestone-5 demotion pass will run on — was checked by nothing, the store's size was visible to no
  check, and the M5 row's "size-budgeted index" read as librarian diligence in a workspace whose own
  verify doctrine says a budget that lives only in prose is the first thing a busy session negotiates
  with. So `doctor` gained a `retirement` report: record count and store size on every run, plus a note
  naming any record that states no `Retire when:` condition — reported, never failed, because nothing
  legislates the field, and ages deliberately absent (doctor reads the tree, never git; in a fresh clone
  every mtime is checkout time, so an age line would be fabrication — staleness stays the librarian's).
  Both live stores measured clean — 17 records / 56.8 KB and 4 / 7.6 KB on the shipped tree (56.7 at
  the review's baseline; the merged audit pull requests edited four records in between), every record
  naming its condition — so the notes guard the future rather than flagging a mess. Suite 240 → 244 (both figures
  measured, not derived), including a test that binds customer zero byte-for-byte: a record added here
  without a retirement condition turns `tests` red, so for this repository the note is backed by a rail
  — a workspace extending the floor, which dod.md permits and the product's doctor deliberately does not
  impose. Doctrine gained its one missing sentence (budgets are rails; breach means consolidate, never
  squeeze past or raise in the same change; enforcement is milestone 5's and says so, per dod condition
  4), and the M5 row now owns that machinery — red on breach, with the red→green demo being
  consolidation rather than a budget edit; an expansion, not a narrowing. Deliberately not built: the
  index, the consolidation skill, any scheduled machinery — milestone 5's, under its own discipline.
  Deliberately not written: a new memory entry (the lesson is already recorded in verify/README.md and
  the mandate-nothing-checks rule — minting one would be growing the store to say the store must not
  grow), and a repo-card quirk about the harness-side memory, because a claim about a fact outside the
  tree is the class that went stale twice here; the seam statement lives in this dated entry and the
  handoff instead — harness memory is operator-local, not product. Rebased onto `5a11127` mid-session
  when the record rail (#39) merged — the conflict was two sessions appending this log, resolved by
  keeping both entries; all six recipes re-run green on the rebased tree, now including the `record`
  check, which this entry and its handoff satisfy. · Commissioned directly by the
  maintainer, the written directive standing as the session-open plan; supervised at pre-commit in a
  fresh Fable 5 context: APPROVE, zero required adjustments — the reviewer re-measured rather than
  read: suite 240/240 at baseline `4352569` via git archive and 244/244 at head, both stores' figures
  reproduced by independent byte sums (58035 B and 7827 B), all six recipes green; its one optional
  note (an unreadable record is counted but never assessed for retirement) is deliberately not folded,
  because that record already fails the run and hedging the common case to cover an already-red corner
  is the wrong trade. Seam scan clean across files, commit message, and branch name.

- 2026-07-27 · post-M4-session-0 — no milestone row touched, and none was due · **A maintainer ruling:
  nothing merges from behind `main`.** Marius ruled that a pull request may not merge while it is behind
  `main` — sync first, then merge. The repository when the ruling was taken is why it is not a
  formality: **three open pull requests, #41, #42 and #43, each exactly one commit behind**, and #43
  reported by GitHub as `CLEAN` / `MERGEABLE` — mergeable on the spot, with a green `workspace-verify`
  describing a test merge against a `main` that stopped existing at `8c02c5f`. CI runs on
  `pull_request` against `refs/pull/N/merge` and nothing re-runs it when the base moves, so the class of
  defect that gets through is the union of two individually-green branches — which is exactly what this
  workspace's *correspondence* recipes catch and neither branch's own run can see (`links` on a file one
  deletes and another links to, `map` on a directory added beside a rewritten README table, `record` on a
  Session log date whose handoff is on the other branch). Landed as
  [`.portulan/memory/a-branch-syncs-with-main-before-it-merges.md`](../.portulan/memory/a-branch-syncs-with-main-before-it-merges.md)
  with the one-command condition (`compare/main...<head> --jq .behind_by`, zero or nothing), as a
  precondition on the Gated merge in [`.portulan/gate-map.md`](../.portulan/gate-map.md), and — after
  Marius's second instruction mid-session, *"this rule needs to be set in GitHub too"* — as a **new
  platform-floor row that is actually enforced**: `required_status_checks.strict` flipped `false → true`
  on `main`, which is why a branch one commit behind had been reading `CLEAN`. Applied by the session on
  his explicit per-action instruction, which is the Gated tier working rather than bypassed;
  [`0011-no-merge-from-behind-main.md`](../.portulan/proposals/0011-no-merge-from-behind-main.md) records
  it **ACCEPTED and APPLIED**, with the `checks` array sent explicitly so the `app_id: 15368` pin could
  not be dropped by a `PATCH` meant only to flip a boolean, and the whole protection object re-read
  afterwards (`enforce_admins`, conversation resolution, force-push and deletion blocks, review count —
  unmoved). It also obliges milestone 4's ruleset export to carry strict checks, noted there rather than
  folded into the row. **The end-to-end demonstration is missing and is recorded as missing:** the three
  behind pull requests all merged or rebased within the same half-hour, so no refusal was observed — a
  `BLOCKED` reading on #43 mid-recompute is not evidence, and this repository does not accept that
  standard elsewhere. This pull request, behind `main` when the setting landed, is the honest subject. **The session's own correction:** the first draft called the gate reason a second
  enforcement layer; `.portulan/compile/gate.mjs` records the measurement that the host discards a hook's
  reason whenever a permission rule matches, so that sentence reaches an agent only on the wrapped
  spelling — a fresh instance of `a-stated-enforcer-must-be-the-real-one`, caught in the session that was
  adding a rule about honest greens, and both documents now say the carrier is a human reading them.
  `.claude/settings.json` recompiled byte-identical (reasons live in `gates.json`; the hook reads them at
  runtime). · **Supervisor fidelity: none — no fresh-context checkpoint was taken. Doctrine work, no
  milestone state touched; the maintainer reviews the diff, per `.portulan/gate-map.md`.** Nothing was
  merged by the session and the three behind pull requests were not touched. · Seam scan clean across
  files, commit message, and branch name. Handoff:
  [`.portulan/handoffs/2026-07-27-nothing-merges-behind-main.md`](../.portulan/handoffs/2026-07-27-nothing-merges-behind-main.md).
