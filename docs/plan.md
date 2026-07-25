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
| 2 | Workspace spec v1 | 1–2 | Manifest + **constitution & product-layer slots** (team principles; mission/what/why) + gate map + verify recipes + **agent-affordances slot** (portfolio-aware: many products per workspace) + **provenance slot**, per the decision on `.portulan/proposals/0002-sealed-provenance.md` (proposed: a well-formed link or a sealed owner+date stamp); `doctor` validates the demo workspace **and this repo's own `.portulan/`** (and, privately, the pilot), and lints **workspace claims against the tree** — repo-card build/test/run lines and layout, gate map — the way the `map` check already holds the root README to the repo's shape | in-progress (session 1 of 2, 2026-07-25: spec authored + instantiated; `doctor`, the demo workspace, and the claims lint owed by session 2) |
| 3 | Plugin & public marketplace | 1–2 | Skills pass `skills-ref validate`; v0.1.0 tagged; fresh-machine install boots the engine with no local folder | todo |
| 4 | Enforcement compiler | 1–2 | `gates.json` → hooks + permissions (+ Copilot ruleset export); verify recipes → Stop-gate runner; per-host backend matrix + doctor degradation report. Demo: unapproved push blocked; "done" without green verify blocked | todo |
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
  done**: renaming the job id would deadlock the repository (the required context stops reporting,
  `enforce_admins` prevents override — fails closed and stuck), so
  [`.portulan/proposals/0004-ci-runs-every-declared-recipe.md`](../.portulan/proposals/0004-ci-runs-every-declared-recipe.md)
  records the three-step sequence and the **Gated** middle step that is the maintainer's. Verified by
  extracting the step's shell and running it under `bash -e` across four paths — both green, one red,
  manifest missing, zero recipes — after a first measurement that read the exit code through a pipe and so
  reported `tail`'s status instead of the step's, which is the same class of mistake the change is about.
  Seam scan clean across files, commit message, and branch name.
