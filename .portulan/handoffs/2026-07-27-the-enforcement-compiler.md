# Handoff — the gate map stopped being a document

**State.** Milestone 4 (Enforcement compiler), session 0 of 1–2. Open. Not pushed — every push is
Gated, and this branch's first push is the maintainer's call.

## What landed

`.portulan/gates.json` is the gate policy as data, and `cli/compile.mjs` turns it into
`.claude/settings.json` — permission rules and hooks — with `compile --check` declared as the **sixth
verify recipe**, so a policy edited without recompiling will fail CI with no workflow edit. That is
proposal 0004's mechanism paying out a fourth time. (Conditional on purpose: the branch is unpushed, so
CI has not run it. The red→green was demonstrated locally.) `.portulan/compile/gate.mjs` and `stop.mjs` are
the runtime the artifact points at. Spec 2.0 → **2.1**: one optional `gates` key, additive.

Both demo clauses of the criterion ran against a **live host**, in this repository, with the compiled
settings in force:

- **Unapproved push blocked.** A headless session was told to run `git status --short`, then push.
  The status ran (positive control); the push was refused; the scratch bare remote held **0 refs**.
  Then the same command from the maintainer's own hand pushed successfully — so *blocked* is
  demonstrably not *impossible*, which is the difference the criterion is actually about.
- **"Done" without green verify blocked.** With one dead link planted, a session told to reply
  `done` was held open by the Stop-gate, which handed back the recipe's own output naming
  `.portulan/DEMO-RED.md:3` and the unresolvable target. It fired three times and then released the
  session at its cap.

The demo used a **scratch bare repository as the remote on purpose**: had the gate failed, the
demonstration itself would still have performed no outward action.

## The finding that changed the design

The two layers do not compose the way the plan assumed, and measuring it was the session's best hour.

The hook was to supply a better sentence than "permission denied". **It cannot.** When a permission
rule matches, the host runs the hook and then *discards its reason* — proven with a canary that
recorded both the invocation and the command the hook saw, while the agent still received the generic
message. A hook emitted only to improve a message it cannot reach would be an inert component reading
as an active one, which is the exact defect `a-manifest-field-can-validate-and-load-nothing.md`
exists to name. Shipping it as planned would have repeated milestone 3 in miniature.

So the split was re-earned rather than kept out of habit: **the hook covers what the permission
pattern cannot.** `Bash(git push:*)` is a literal prefix match and never sees `bash -c "git push …"`.
`gate.mjs` peels one wrapper, so that spelling reaches a gate — and there the permission layer has
nothing to say, so the hook's decision *and* its sentence are what the agent gets. Demonstrated live.

The layers now each do something the other cannot: **the permission rule cannot fail open; the hook
covers more ground.** That is load-bearing, because the other measurement is that **a hook which
crashes fails open** — the tool ran normally on wiring that blocked when the hook was healthy. So
`gate.mjs` steps aside silently on any internal error, handing the decision back to the layer a syntax
error cannot remove.

## The hazard that nearly shipped

This repository **is** a plugin whose payload is the whole tree. Measured: a plugin shipping
`hooks/hooks.json` has those hooks **fire for everyone who installs it**, in unrelated projects — with
a positive control running the same command cleanly when the plugin was absent. A top-level `hooks/`
here would have pushed our gate map onto strangers' machines, denying their pushes and blocking their
sessions. `.claude/settings.json` was measured too and does **not** leak: it ships as inert data and
activates only when this repository is the project.

The `agents/` lesson from milestone 3, with higher stakes: for a repo-rooted plugin, top-level names
are platform-reserved, and picking one by accident is paid for by other people. The session-open
supervisor named this before any code was written, which is why it was measured rather than discovered.

## What the maintainer decided

Four rulings, all taken with the measurements in hand rather than before them: the artifact lands
**tracked and in force** on this repository; the compiler emits **no `allow` rules** — it only ever
adds restriction, so a bug cannot loosen an existing check; the Stop-gate **blocks with an iteration
cap**; and the **session-end handoff gate is built this milestone** rather than deferred, which is
what `core/operating/loop.md` has promised since the cadence rule landed.

## What is left, and the honest state of it

- **Session 1 carries the rest of the criterion**: the Copilot ruleset export, the per-host backend
  matrix, and `doctor`'s degradation report. The refusal accounting is already the matrix's data —
  every rule ends as compiled or refused-with-a-reason, and the counts are asserted — so session 1 is
  mostly formatting rather than new measurement.
- **The criterion was amended** (that row only) to name the session-end gate, which
  `core/operating/loop.md` had promised to this milestone while the row named only two of the three
  things the doctrine owed here. An expansion, not a narrowing.
- **Two questions are still the maintainer's** and both were surfaced rather than assumed: what
  "Copilot ruleset export" means, and where `autonomy.md`'s promise that the compiler generates the
  *platform floor* configuration lands. The second matters — read literally, core doctrine promises
  something the milestone-4 row does not name.
- **The doc sweep is done**, and it shipped in this change: roughly thirty forward references that said
  the Stop-gate and the compiler were coming now say what exists. Deliberate survivors, left in the past
  tense on purpose: the `0.1.0` section of `CHANGELOG.md`, and the dated handoffs and proposals, which are
  contemporaneous records and would be falsified by editing.
- **`tasks/0004` got larger, not smaller.** A sixth recipe means one more piece of untested
  scaffolding; the harness is still unbuilt.
- **Three questions live in [`../proposals/0007-a-gate-policy-beside-the-gate-map.md`](../proposals/0007-a-gate-policy-beside-the-gate-map.md)**:
  whether `prohibited` should be promoted into `core/` as a fourth universal tier (constitution-adjacent,
  so Marius's), whether a **pack** may contribute gate rules — the cascade's missing middle, which
  `packs/tools/README.md` has expected since it was written — and the platform-floor question above.
- **Milestone 3 left one thing unverified and it is still unverified**: the boot skill's kernel-denial
  paragraph ships in no install until a merge carries it. It was carried to milestone 4 and this session
  did not discharge it. Carrying it visibly rather than letting it fade.
- **`.claude/settings.local.json` is git-ignored**, so an adopter's own `allow` rules sit invisibly beside
  the compiled gates. A compiled `deny`/`ask` beats an `allow` on the same pattern; what a broad local
  `Bash` allow does to the *wrapper* spelling is unmeasured and is not claimed either way.

## The pre-commit checkpoint, which found the gate's own fail-open

**APPROVE-WITH-ADJUSTMENTS in a fresh Fable 5 context: thirteen required, five changing the work.** It
re-demonstrated both criterion clauses independently rather than replaying this transcript, and then found
what the suite could not, because nothing tested `stop.mjs` at all:

- **The cap counted stops, not refusals.** Four *green* stops spent the budget, after which a planted red
  passed with a note — and on that path the recipe was never even run. Any session of three or more turns
  disarmed the gate entirely. A fail-open inside the gate written to close one, in the milestone whose
  subject is enforcement. Now only a refusal is charged, a green stop is free, and
  [`../../cli/stop-gate.test.mjs`](../../cli/stop-gate.test.mjs) is the regression that would have caught it.
- **The unwritable-counter fallback returned exactly the cap**, which is not *above* it — so a read-only
  temp dir made a red tree block **forever**, the precise opposite of the comment beside it.
- **`doctor` never resolved the new `gates` path** while `spec/slots.md` already promised it did: a manifest
  naming a policy file that did not exist validated GREEN. *A mandate nothing checks is already broken*,
  demonstrated against the mandate written in this very change.
- **The gate map's "honest hole" paragraph was false** — it described the wrapper spelling falling through
  to the host's default mode, which was true before the hook existed and not of what shipped. An
  overstated hole is as wrong as a hidden one.
- **Two policy rules had sentences broader than their matchers** — `change-repository-settings` claimed
  branch protection while compiling only `gh repo edit`, when this repository's own floor was configured
  through `gh api`. Split, so each rule's matcher covers its sentence or says it does not.

Also caught: a UTC date in the handoff check that would falsely block between midnight and 03:00 local, a
missing `2)` arm making a documented exit code print "not a verdict it documents", and a claim that CI had
caught a drift on a branch that has never been pushed.

## The consistency review, and what it changed

A cross-session consistency review confirmed the four rulings and rode five constraints in with them.
Three were already satisfied and are now evidenced rather than assumed; three changed the code.

Already true, checked rather than claimed: the **freshness rail** exists (`verify/compile.sh` recompiles
and byte-compares, red on mismatch); **emitted hook paths are repo-relative** — `${CLAUDE_PROJECT_DIR}`,
no absolute path, so the tracked artifact does not lie on another machine; and **exit 2 propagates to its
own outcome**, neither folded into red nor read as a pass, which is the shape all three recorded
fail-opens here share.

Changed by the review:

- **Cap exhaustion now says the session is ending RED, not done.** The cap bounds how long the gate
  argues, never whether red can become done — the release message carries the unresolved problems and
  says so in those words.
- **The false-red direction is tested as hard as the false-green.** `verdict()` was extracted as a pure
  function precisely so both can be: a green stop must never block, and a *spent budget* must never turn
  a green stop into a block. A Stop-gate that blocks on green gets switched off by an annoyed human, and
  then it guards nothing.
- **Tier agreement is now checked, not just membership.** Membership proved a rule was *mentioned*; it
  did not stop the prose filing a Gated action under Auto. The suite now checks each rule id appears
  under the gate map heading matching its tier — headings are structure, so this is not the ambitious
  parser the spec warns against.
- **The pressure valve is written down** in `compile/README.md`: personal `allow` convenience belongs in
  untracked `settings.local.json`; the tracked artifact carries policy only. Stated so prompt fatigue
  does not erode the no-allows ruling one informal line at a time.

And the sequencing note earned its keep: both runners were **refactored after** the live demos, so the
last live evidence predated the shipped code. Re-run against the committed artifact — ordinary tool calls
ran, the push was refused, the scratch remote stayed empty. A broken `PreToolUse` hook in a tracked
settings file would wedge every future session, and that was checked rather than reasoned about.

## The thing to be suspicious of next session

The compiled artifact is now enforcing on this working copy, which means every future session here
runs under gates this session wrote. That is the point — but it also means a defect in `gate.mjs`
degrades every later session's guardrails, and the failure would look like nothing at all. The suite
asserts the matcher and the accounting; **nothing asserts that the host still honours the artifact.**
Only a live probe does, and CI cannot run one. Re-measure on every CLI upgrade, the way
`a-checkers-coverage-is-measured-not-named.md` says: measured, never named.
