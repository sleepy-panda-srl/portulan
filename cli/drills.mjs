#!/usr/bin/env node
// The forced-red drill harness — every rail broken on purpose, and required to fire.
//
// Milestone 8, clause (d): *scheduled forced-red drills — every rail forced red on a calendar and
// required to fire.* The argument for the clause is in `../docs/milestones/m08.md`; the calendar is
// `../.github/workflows/drills.yml`; what belongs here is what a drill is and why the shape is this
// one.
//
// ## What it answers, and what its two siblings answer
//
// `./goldens.mjs` asks whether every compiled gate has adversarial fixtures — **presence**.
// `./mutants.mjs` asks whether those fixtures can tell a working matcher from a broken one —
// **discrimination**. Neither asks the question one level out: **does the rail still fire at all?**
// A recipe whose precondition quietly started exiting 0 over an empty file list, a hook that fails
// open on a crash, a check whose enumeration went empty — each reports green and each has stopped
// being a rail. Nothing in this repository could see that, and the way it was found until now was an
// incident.
//
// ## The clause's provenance is two sessions doing this by hand
//
// `../.portulan/proposals/0007-every-watcher-ships-with-its-observation-procedure.md` — *a watcher
// earns its place by being watched* — asks for a procedure *"run once and its result recorded"*. The
// 2026-07-28 amendment generalises it along both axes: from one demonstration at adoption **to a
// calendar**, and from **watchers to every rail**. Milestone 8 sessions 0 and 1 ran eleven forced-red
// drills by hand and recorded them in their handoffs, which is precisely the state this file exists to
// replace: two sessions running them by hand is evidence for the clause, not a substitute for it.
//
// **And both sessions had a drill that did not fire.** One anchored substitution missed by four spaces
// of indentation; one patch script's quoting broke. Both times the recipe ran green against an
// unmodified file and the drill reported on nothing — the same false green the whole milestone is
// about, inside the instrument built to detect it. Every guard below traces to one of those two.
//
// ## A drill is a PAIR, and the pair is the oracle
//
// Per rail: a **control** run on a pristine tree, then a **fire** run after the perturbation. Both are
// required, because drill 1 of 2026-07-30 recorded the reason —  *"a rail that only ever reds proves
// nothing about its green: a recipe hard-wired to fail would have produced the identical red
// transcript."*
//
// The control does a second job the drills of the two hand sessions could not do: it catches an
// **environment** difference. A rail that is red for a reason having nothing to do with the
// perturbation — a path-sensitive check, a clean checkout that is not a working copy — makes its drill
// exit 2 rather than report a fire it did not cause.
//
// ## Three guards, each from a defect this repository has already shipped
//
//  1. **A `tell` is required, never optional.** A perturbation can red a rail for the wrong reason — a
//     syntax error instead of the finding. So every drill declares a substring the rail's own output
//     must carry when it fires, and the harness requires it **absent in the control and present in the
//     fire**. `../.portulan/verify/README.md` already records one instance caught *"only because the
//     drill asserts the message"*.
//  2. **A perturbation may not no-op.** An anchored substitution must place **exactly once** —
//     `./mutants.mjs`'s discipline, adopted rather than re-derived — *and* the bytes on disk are
//     hashed before and after and must differ. A missing or ambiguous anchor is could-not-run, never
//     a skip.
//  3. **`--only` narrows what RUNS, not what must be well formed.** The whole table is validated in
//     every mode. Session 1's round 1 found the opposite in `./mutants.mjs`: `--only` skipped
//     validation in exactly the mode a person reaches for when something is already wrong.
//
// ## Isolation: one throwaway `git worktree` per drill
//
// `git worktree add --detach <tmp> <tree>` shares the object store, so there is no clone and no
// network, and history is complete — which `pack-version` and `pack-identity` both need. The
// developer's working tree is never perturbed. Both hand sessions perturbed in place and restored by
// hand, which is one crash away from leaving a repository broken.
//
// ## Which tree is drilled, said out loud on every run
//
// A worktree is a **commit**, so this tool reports on a commit and prints which one. By default it
// refuses a dirty tree rather than quietly drilling `HEAD` while the reader believes it drilled what
// they are looking at — the shape of *the gate allows in silence when it reads the wrong tree*.
// `--working-copy` synthesizes a commit from the working copy with `git stash create` and prints
// **that** sha; because `stash create` does not carry untracked-and-unstaged files, that mode refuses
// while any exist, naming them, rather than drilling a tree missing the very file under review.
//
// ## Why the sweep is NOT a verify recipe, and what is
//
// `../.portulan/dod.md` condition 1 asks that every recipe ran green *in this working copy*. A recipe
// that reported on `HEAD` would be a green about a different tree. So the **sweep** belongs to the
// calendar and to `--working-copy` by hand, and what is declared as the `drills` recipe is `--check`:
// the correspondence pass over the working tree — every yielded rail has a drill, every drill names a
// declared rail, every anchor still places exactly once. That is the half that can drift on any commit,
// it runs no rail, and it costs milliseconds.
//
// ## This module SPAWNS, and its siblings assert they do not
//
// `./goldens.mjs`, `./mutants.mjs` and `./fuzz-shell.mjs` are each held by their suites to importing no
// process-spawning API, because a corpus of `git push --force` spellings must never reach a shell.
// This module is the opposite by nature: running a rail *is* spawning it. What its suite pins instead
// is that nothing it spawns is composed from a payload — every command comes from the yielded recipe
// set or from this file's own declarations, and no drill's `perturb` value is ever passed to a shell.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { CouldNotRun } from "./goldens.mjs";
import { recipeSet, resolverFor } from "./recipe-set.mjs";

/** How long any one rail may take before the drill calls it a could-not-run rather than a verdict. */
const RAIL_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * The prefix every session id this harness invents carries.
 *
 * It is load-bearing twice. A hook keyed by session id must not share state between runs, and — because
 * `./stop-gate.mjs` writes its refusal counter into the OS temp directory under
 * `portulan-stopgate-<readable-session-id>-…` — a prefix this harness owns is what lets it retire its
 * own counter files without touching a real session's. Measured before it was relied on: each sweep was
 * leaving one 45-byte file behind, found at the pre-commit checkpoint.
 */
export const DRILL_SESSION_PREFIX = "portulan-drill";

/**
 * The rails that are NOT recipes, declared as an allow-list.
 *
 * **The allow-list is the point rather than the convenience.** Without it a drill whose `rail` is a
 * misspelled recipe id — `doc` for `docs` — would be silently reclassified as a rail of its own, and
 * the coverage check would pass while the real recipe went undrilled. A rail is a yielded recipe id or
 * a member of this list, and nothing else.
 *
 * Both members are hooks: they exit 0 whether they refuse or allow, because a hook communicates through
 * its stdout JSON and not through its status. So their drills declare `exit: 0` and lean entirely on the
 * tell — which is why the tell is mandatory rather than a nicety.
 *
 * `tellStream: "stdout"` for both, measured rather than assumed: `stop-gate` writes git's own
 * diagnostics to stderr when it probes an upstream in a detached worktree (`fatal: HEAD does not point
 * to a branch`), so a tell read from the combined streams would be read out of noise the rail did not
 * choose to say.
 */
export const NON_RECIPE_RAILS = [
    {
        id: "stop-gate",
        what: "the Stop-gate — `./stop-gate.mjs`, wired by the compiler as a `Stop` hook. It runs the workspace's default recipe and blocks the turn ending when it is not green.",
        argv: ["cli/stop-gate.mjs"],
        tellStream: "stdout",
    },
    {
        id: "gate",
        what: "the PreToolUse gate runner — `./gate.mjs`, which finds the rule of the yielded policy an attempted action matches and returns that rule's own sentence.",
        argv: ["cli/gate.mjs"],
        tellStream: "stdout",
    },
];

/**
 * The rails this harness does NOT drill, each with the reason.
 *
 * Printed on every run, green included. The clause's whole subject is the honesty of the word *every*,
 * and a scope claim with no carrier is the defect `../.portulan/verify/README.md`'s register was
 * already carrying by hand. These are rails; they are simply not rails a local process can force.
 */
export const NOT_DRILLED = [
    {
        rail: "the platform floor — branch protection, the required checks, `enforce_admins`",
        why: "forcing it red means a direct push to `main` or a merge of a red pull request: outward, Gated, and the maintainer's. `../.portulan/verify/README.md` records that `enforce_admins` is what stands behind the last inch and that no pull request can demonstrate it about itself.",
    },
    {
        rail: "the `permissions` layer the compiler emits",
        why: "that gate is the host's, not this repository's. `compile` byte-checks what is emitted and `goldens`/`mutants` grade the matcher behind it; forcing the host to refuse is a measurement of Claude Code, taken by hand and recorded in `../.portulan/gate-map.md`.",
    },
    {
        rail: "the CI seam — a non-zero recipe becoming a failed check becoming `BLOCKED`",
        why: "drill 1 of 2026-07-30 established it in both directions on #118, and re-drilling it needs a pull request opened for the purpose. Covered once, deliberately not recurring: the seam is shared by every recipe in one job, so it does not need covering once per rail.",
    },
    {
        rail: "the pre-commit seam scan (`../.portulan/dod.md` condition 5)",
        why: "its term list lives outside this repository by design, so no scheduled job here can run it. It is drilled once per session instead, by the planted-term control every session's attestation records.",
    },
    {
        rail: "`claude plugin validate --strict`",
        why: "deliberately not a verify recipe — `../.portulan/identity.md` argues why: CI installs nothing, so declaring it would make a recipe that exits 2 on every run. It is checked at the supervised checkpoints and before a release, which is a rail on no calendar, and that cost is already stated in `../.portulan/verify/README.md`.",
    },
    {
        rail: "Dependabot, the `copilot auto-review` ruleset, and `pr-labels`",
        why: "platform watchers whose triggering condition is an event this repository cannot manufacture on a schedule. `0007`'s own honest limit applies — not every watcher can be forced red safely — and each carries its own recorded observation instead.",
    },
    {
        rail: "the librarian's scheduled pass",
        why: "not a rail in this sense: it files work for a human rather than refusing an action, so there is no red to force. Its own failure is a failed workflow run, and `0007` covers it as a watcher.",
    },
];

/**
 * The drills. One per rail, and the harness refuses a yielded rail that has none.
 *
 * **One table, in this module** — `./mutants.mjs`'s argument, unchanged: a drill is an anchor into a
 * file plus the outcome expected of it, and splitting those across code and JSON would make two
 * carriers of one drill.
 *
 * Fields:
 *   `rail`    a yielded recipe id, or a `NON_RECIPE_RAILS` member's id
 *   `perturb` `{file, find, replace}` — anchored, must place exactly once; or `{create, content}`;
 *             or `null` for a rail whose control and fire differ by INPUT rather than by tree
 *   `stage`   `git add -A` in the drill worktree before the fire, for a rail that reads the index
 *   `exit`    the status the fire must return
 *   `tell`    a substring the rail's own output must carry when it fires, and must not carry before
 *   `why`     what this drill proves about this rail — not what the perturbation does
 *
 * **Prefer an in-place edit of a tracked file to a creation.** Measured: `docs.sh` and
 * `control-chars.sh` both walk `--cached --others --exclude-standard` and see a new file, while a pass
 * reading `--cached` alone does not — so a creation-shaped perturbation is invisible to some rails and
 * would read as a rail that did not fire. Where a creation is the only honest shape, `stage` makes it
 * visible and says so.
 */
export const DRILLS = [
    // ------------------------------------------------------------------ the eighteen yielded recipes
    {
        rail: "docs",
        perturb: {
            file: "CONTRIBUTING.md",
            find: "- [`docs/plan.md`](docs/plan.md) — the milestones, and the Session log every session appends to.",
            replace: "- [`docs/plan.md`](docs/plan-the-drill-broke-this.md) — the milestones, and the Session log every session appends to.",
        },
        exit: 1,
        tell: "link(s) that do not resolve in the repository",
        why: "The `links` check is the one that has fired for real here, twice on 2026-07-30, over a path that existed in a working copy and not in a clean checkout. This keeps it firing.",
    },
    {
        rail: "json",
        perturb: {
            file: ".portulan/labels.json",
            find: '"policy": "at-least-one",',
            replace: '"policy": "at-least-one",,',
        },
        exit: 1,
        tell: "Expected double-quoted property name",
        why: "A manifest that does not parse gates nothing. This rail is the floor every JSON-reading rail above it stands on, so its silence would be the widest.",
    },
    {
        rail: "doctor",
        perturb: {
            file: ".portulan/workspace.json",
            find: '"identity": "identity.md",',
            replace: '"identity": "identity-the-drill-removed.md",',
        },
        exit: 1,
        tell: "slots.identity points at",
        why: "`doctor` resolving a slot path is the check the Workspace Definition rests on: a manifest naming a file that is not there must never validate.",
    },
    {
        rail: "tests",
        perturb: {
            create: "cli/drill.test.mjs",
            content: [
                "// A forced-red drill fixture, written by `cli/drills.mjs` into a throwaway worktree and never",
                "// committed. If you are reading this file inside the repository, a drill did not clean up after",
                "// itself and that is the bug.",
                'import { test } from "node:test";',
                'import assert from "node:assert/strict";',
                "",
                'test("forced-red drill: the tests recipe reports a failing assertion", () => {',
                "    assert.equal(1, 2);",
                "});",
                "",
            ].join("\n"),
        },
        exit: 1,
        tell: "forced-red drill: the tests recipe reports a failing assertion",
        why: "The shape drill 1 used on #118 on 2026-07-30, kept as the recurring form of the only rail this repository has ever observed firing on purpose in CI.",
    },
    {
        rail: "plugin",
        perturb: {
            file: ".claude-plugin/plugin.json",
            find: '"./plugin/skills/",',
            replace: '"./plugin/skills-the-drill-moved/",',
        },
        exit: 1,
        tell: "plugin/skills-the-drill-moved",
        why: "A declared component path that resolves nowhere is how a plugin ships registering nothing — the defect `skills-set` exists beside this check to make impossible.",
    },
    {
        rail: "compile",
        perturb: {
            file: ".claude/settings.json",
            find: '"Bash(gh pr merge:*)",',
            replace: '"Bash(gh pr merge:*)",\n      "Bash(the-drill-added-this:*)",',
        },
        exit: 1,
        tell: "has drifted from",
        why: "A committed generated file invites the hand-fix that works until the next compile silently reverts it. This is the drift rail for the enforcement itself, so its firing is the difference between a compiled gate and a decorative one.",
    },
    {
        rail: "workflow-filters",
        perturb: {
            file: ".github/workflows/pr-labels.yml",
            find: "if ! declared=$(jq -er '.labels[].name' \"$POLICY\"); then",
            // The program's OUTPUT is changed rather than its shape: dropping a character made the
            // fixture's anchor match no program at all, and the rail then exited 2 — a legitimate
            // refusal, but the arm this drill is not for. Appending a suffix keeps the anchor findable
            // and makes the bytes the surrounding shell branches on differ, which is the exit-1 arm.
            // Measured both ways before this line was written.
            replace: "if ! declared=$(jq -er '.labels[].name + \"-drilled\"' \"$POLICY\"); then",
        },
        exit: 1,
        tell: "fixture(s) failed",
        why: "The jq programs the merge gates branch on are executed rather than described. A filter that silently changed shape would take the label gate down with it.",
    },
    {
        rail: "index",
        perturb: {
            file: ".portulan/memory-index.md",
            find: "- [A branch syncs with main before it merges](memory/a-branch-syncs-with-main-before-it-merges.md) — rule",
            replace: "- [A branch syncs with main before it merges](memory/a-branch-syncs-with-main-before-it-merges.md) — rule (edited by hand)",
        },
        exit: 1,
        tell: "is out of date against the store",
        why: "The index is generated and byte-compared, which is the only thing that makes `core/operating/memory.md`'s *generated, never hand-maintained* a fact rather than a preference.",
    },
    {
        rail: "control-chars",
        perturb: {
            file: "CONTRIBUTING.md",
            find: "# Contributing",
            // A real NUL, written as an escape so THIS file carries no control byte of its own. Session 0
            // shipped a literal NUL as a literal character while writing prose about storing bytes escaped.
            replace: "# Contributing\u0000",
        },
        exit: 1,
        tell: "control character(s) — first at line",
        why: "A raw NUL shipped here once inside a template literal, and the tool most likely to have shown it — `grep` — is the tool the byte silences. Only a byte reader can fire on this, so only a byte reader's silence would hide it.",
    },
    {
        rail: "rule-carriers",
        perturb: {
            file: ".portulan/README.md",
            find: "# `.portulan/` — Portulan's own workspace",
            replace: "# `.portulan/` — Portulan's own workspace\n\nCI runs every recipe the manifest declares.",
        },
        exit: 1,
        tell: "recipe the manifest declares",
        why: "A rule an incident reduced to one carrier must stay reduced. The registered spelling reappearing uncited is exactly the drift proposal 0027 was written for.",
    },
    {
        rail: "pack-version",
        perturb: {
            file: "packs/tools/github/pack.json",
            find: '          "tr"\n        ],',
            replace: '          "tr",\n          "awk"\n        ],',
        },
        exit: 1,
        tell: "without moving `portulan.version`",
        why: "A pack whose contributions moved without its version moving is a pin that no longer names what it pins — the whole basis on which an adopter runs third-party code in their CI.",
    },
    {
        rail: "pack-identity",
        perturb: {
            file: "README.md",
            find: "**Current release: `0.1.2`**",
            replace: "**Current release: `0.1.2`** <!-- the drill edited this and did not stage it -->",
        },
        stage: false,
        exit: 1,
        tell: "the package would not install the tree's bytes",
        why: "`.portulan/identity.md` claims the `npx` path installs the same bytes as the tree. This rail is that claim's only continuous check; an unstaged edit is precisely the drift it owns.",
    },
    {
        rail: "eval-bundle",
        perturb: {
            create: "drill-top-level-path/README.md",
            content: "A top-level path the eval-bundle roster has never seen.\n",
        },
        stage: true,
        exit: 1,
        tell: "drill-top-level-path",
        why: "The bundle's pinned top-level roster is what stops the next licensed cut silently thinning or mislicensing. It reads the index, so this drill stages — a creation it cannot see is a rail that reads as not firing.",
    },
    {
        rail: "goldens",
        perturb: {
            file: "evals/goldens/gates/force-push-without-a-lease.json",
            find: '        "command": "git push --force origin main"\n      },\n      "expect": true,',
            replace: '        "command": "git push --force origin main"\n      },\n      "expect": false,',
        },
        exit: 1,
        tell: "the-bare-spelling",
        why: "The corpus is only worth its green if a case that stops answering as recorded reds it. This flips the control every other case in that file is measured against.",
    },
    {
        rail: "mutants",
        perturb: {
            file: "cli/mutants.mjs",
            find: '        replace: "s === action.shell || s.startsWith(action.shell)",\n        outcome: "killed",',
            replace: '        replace: "s === action.shell || s.startsWith(action.shell)",\n        outcome: "survives",',
        },
        exit: 1,
        tell: "is recorded SURVIVES and was KILLED",
        why: "A recorded outcome that stops being true must red in BOTH directions — a `killed` operator that survives means the kill-set weakened, and a `survives` one that is killed is good news the record has to absorb. This drills the second direction, which is the one a reader is least likely to expect a rail to hold. _(The first draft renamed an operator id instead, on the assumption that the census pins its own roster. Measured: it does not — the census stayed GREEN. The drill was rewritten around what the rail actually does rather than around what its author assumed.)_",
    },
    {
        rail: "fuzz-shell",
        perturb: {
            file: "cli/compile.mjs",
            find: 'const REDIRECTION_TARGET = String.raw`(?:"(?:\\\\[\\s\\S]|[^"\\\\])*"|\'[^\']*\'|\\\\[\\s\\S]|[^\\s])+`;',
            replace: "const REDIRECTION_TARGET = String.raw`[^\\s]+`;",
        },
        exit: 1,
        tell: "disagree with the recorded grammar",
        why: "Session 1's own drill, kept: this is the exact #336 defect — a redirection target reader narrower than a shell word — and the fuzzer is what turns that class from three review rounds into a generated red.",
    },
    {
        rail: "version-carriers",
        perturb: {
            file: "README.md",
            find: "**Current release: `0.1.2`**",
            replace: "**Current release: `0.2.0`**",
        },
        // **Staged, because this rail reads the INDEX** — `git show :<path>`, the same way
        // `pack-identity` does and for the reason that module states: enumerating from the index and
        // then reading the worktree lets a staged drift with a reverted worktree copy report green.
        // Measured: unstaged, the perturbation is invisible and the rail reports its ordinary green,
        // which would have read as a rail that stopped firing.
        stage: true,
        exit: 1,
        tell: "but package.json declares",
        why: "This repository shipped that exact defect twice, and `README.md` is in `package.json`'s `files` — npm freezes a README per version, so a wrong sentence that reaches a publish needs another release to correct.",
    },
    {
        rail: "tools/github:actions-pinned",
        perturb: {
            file: ".github/workflows/verify.yml",
            find: "      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1",
            replace: "      - uses: actions/checkout@v7",
        },
        exit: 1,
        tell: "is a tag or branch, not a commit",
        why: "The composed pack's own rail, drilled from the adopting workspace exactly as a workspace-owned one is — which is the property milestone 7's composition amendment bought and nothing else here re-checks.",
    },

    // ------------------------------------------------------- the coverage rail, which is itself a rail
    {
        rail: "drills",
        perturb: {
            file: "cli/drills.mjs",
            // **The perturbation is ADDITIVE and the anchor is CONCATENATED, and neither is a style
            // choice.** A drill perturbing its own module meets two traps, and the first draft met
            // both. Renaming an existing declaration destroys the very anchor some drill depends on —
            // measured: the child `--check` then exited 2 saying the drill no longer places, instead
            // of 1 reporting the coverage hole. And an anchor written as one literal would place
            // TWICE, once at its target and once in this line, so `--check` would refuse the whole
            // roster as ambiguous. Splitting the literal keeps this line from being what it searches
            // for; inserting rather than editing leaves every other anchor standing.
            find: "export const DRILL" + "S = [",
            replace:
                "export const DRILL" +
                'S = [\n    { rail: "a-rail-this-workspace-does-not-yield", perturb: null, stdinControl: {}, exit: 1, tell: "an inserted drill", why: "inserted by the drill for the `drills` rail" },',
        },
        exit: 1,
        tell: "a-rail-this-workspace-does-not-yield",
        why: "The allow-list is what stops a misspelled recipe id being silently reclassified as a rail of its own, leaving the real recipe undrilled while the coverage check reports green. A drill naming a rail nothing yields is the shortest path to that state.",
    },

    // ------------------------------------------------------------------------- the two non-recipe rails
    {
        rail: "stop-gate",
        // The same perturbation the `docs` drill uses, because `docs` is this workspace's DEFAULT recipe
        // and the default is what this hook runs. The tell is scoped to the recipe reason on purpose:
        // this gate also blocks for a missing same-day handoff, and whether it does depends on the
        // calendar date and on whether HEAD's patches are on a remote — measured at the session-open
        // checkpoint, which saw the identical tree allow on one date and block on the next. A drill whose
        // control demanded *no block at all* would therefore be green or red by the day of the week.
        perturb: {
            file: "CONTRIBUTING.md",
            find: "- [`docs/plan.md`](docs/plan.md) — the milestones, and the Session log every session appends to.",
            replace: "- [`docs/plan.md`](docs/plan-the-drill-broke-this.md) — the milestones, and the Session log every session appends to.",
        },
        stdin: {
            hook_event_name: "Stop",
            // **A session id unique per run**, completed by `runRail` from the worktree's own name. The
            // constant this replaced was harmless and not obviously so, which is the reason it moved:
            // `stop-gate`'s counter file is keyed by session id **and** by the tree, and the tree is a
            // fresh `mkdtemp` every drill, so two runs could not share a counter either way. Measured
            // at the pre-commit checkpoint. Relying on that is relying on another module's key, and the
            // prefix below is also what lets this harness retire the counter file it leaves behind.
            session_id: DRILL_SESSION_PREFIX,
        },
        exit: 0,
        tell: "PORTULAN STOP-GATE (recipe",
        why: "This gate is what makes a red unmissable rather than merely recorded. It fails open on a crash by design, so a crashed Stop-gate and a green one are indistinguishable from outside — and only a drill that requires the refusal can tell them apart.",
    },
    {
        rail: "gate",
        // No perturbation: this rail's control and fire differ by INPUT. The control is a benign command
        // and the fire is a gated one.
        //
        // **The control is byte-identical to this runner having crashed**, and that is worth knowing
        // rather than fixing: `./gate.mjs` fails open deliberately — any internal error exits 0 emitting
        // nothing, so the permission layer governs unchanged. Empty stdout therefore means *allowed* or
        // *crashed*, indistinguishably. What separates them is the FIRE: a crashing runner is silent on
        // both inputs, so the pair is the oracle even though neither half is.
        perturb: null,
        stdinControl: { tool_name: "Bash", tool_input: { command: "git status --short" } },
        stdin: { tool_name: "Bash", tool_input: { command: "git push --force origin main" } },
        exit: 0,
        tell: "PORTULAN GATE `force-push-without-a-lease`",
        why: "The wrapper spellings and the shell writes are the ground the permission pattern cannot reach, so for those this hook is the only layer. A hook that had stopped emitting would leave that ground uncovered and say nothing.",
    },
];

/** The digest used to prove a perturbation moved bytes. Not security — just enough to differ. */
const digest = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

/**
 * Apply a drill's perturbation inside `worktree`.
 *
 * Refuses — could-not-run, never a skip — when the anchor is absent, when it places more than once, or
 * when the bytes on disk did not move. The third is not redundant with the first two: both hand sessions
 * had a drill whose substitution placed and changed nothing that mattered, and `count === 1` alone would
 * have passed a replacement identical to what it replaced.
 */
export function perturb(worktree, drill) {
    if (!drill.perturb) return null;

    if (drill.perturb.create !== undefined) {
        const target = path.join(worktree, drill.perturb.create);
        if (fs.existsSync(target)) {
            throw new CouldNotRun(
                `drill \`${drill.rail}\` would create ${drill.perturb.create}, which already exists in the tree — ` +
                    `a creation that overwrites is an edit wearing the wrong shape. Re-declare it as {file, find, replace} or pick another path`,
            );
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, drill.perturb.content);
        return { path: drill.perturb.create, before: null, after: digest(Buffer.from(drill.perturb.content)) };
    }

    const rel = drill.perturb.file;
    const target = path.join(worktree, rel);
    let source;
    try {
        source = fs.readFileSync(target, "utf8");
    } catch (cause) {
        throw new CouldNotRun(
            `drill \`${drill.rail}\` names ${rel}, which cannot be read in the drilled tree — ${cause.code ?? cause.message}. ` +
                `The file moved and this drill did not: re-anchor it or retire it, but do not let it be skipped`,
        );
    }

    let count = 0;
    let at = 0;
    for (;;) {
        const i = source.indexOf(drill.perturb.find, at);
        if (i === -1) break;
        count += 1;
        at = i + 1;
    }
    if (count === 0) {
        throw new CouldNotRun(
            `drill \`${drill.rail}\` does not place: its anchor is absent from ${rel}. The subject moved and this drill ` +
                `did not — re-anchor it or retire it, but do not let it be skipped`,
        );
    }
    if (count > 1) {
        throw new CouldNotRun(
            `drill \`${drill.rail}\` places ${count} times in ${rel} and a perturbation must be exactly one edit. ` +
                `Lengthen its anchor until it is unique`,
        );
    }

    const before = digest(Buffer.from(source, "utf8"));
    const next = source.replace(drill.perturb.find, () => drill.perturb.replace);
    fs.writeFileSync(target, next);
    const after = digest(fs.readFileSync(target));
    if (before === after) {
        throw new CouldNotRun(
            `drill \`${drill.rail}\` placed in ${rel} and the bytes did not move — the replacement is what it replaced. ` +
                `A drill that does not fire reports on nothing`,
        );
    }
    return { path: rel, before, after };
}

/**
 * The yielded recipe set, at a PINNED root, with host discovery refused.
 *
 * The pin is the same argument `./goldens.sh` and `./compile.sh` state at length: a rail answers *does
 * this tree hold its own claims*, so its answer may not move with what happens to be installed on the
 * machine running it. `discovery: null` and `forced: false` are the second carrier of that, so a stray
 * `--pack-root auto` on the command line cannot reach the host either.
 */
export function yieldedRecipes({ workspaceDir, repoRoot, packRoots }) {
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(workspaceDir, "workspace.json"), "utf8"));
    } catch (cause) {
        throw new CouldNotRun(`the workspace manifest at ${workspaceDir} could not be read — ${cause.message}`);
    }
    let resolve;
    try {
        resolve = resolverFor({ workspaceDir, manifest, repoRoot, named: packRoots, discovery: null, forced: false });
    } catch (cause) {
        throw new CouldNotRun(cause.message);
    }
    const set = recipeSet(manifest, { resolve });
    if (!set.ok) throw new CouldNotRun(set.reason);
    return set.recipes;
}

/**
 * Validate the whole table against a tree. Returns findings; throws `CouldNotRun` for a drill whose
 * anchor no longer places, because that is `./mutants.mjs`'s ruling on the same condition: an anchor
 * that has drifted must refuse rather than be skipped.
 *
 * Runs in **every** mode, `--only` included.
 */
export function check({ recipes, repoRoot, drills = DRILLS }) {
    const findings = [];
    const recipeIds = new Set(recipes.map((r) => r.id));
    const nonRecipeIds = new Set(NON_RECIPE_RAILS.map((r) => r.id));
    const drilled = new Set();

    // **A yielded recipe sharing an id with a non-recipe rail is refused**, because the sweep's lookup
    // map spreads the hooks after the recipes: a workspace recipe called `gate` would be silently
    // shadowed by the hook, `check` would count that id as drilled, and the real recipe would never run
    // while the sweep reported green. Nothing in `spec/workspace.schema.json` reserves these two slugs,
    // so the refusal belongs here. Copilot round 1.
    for (const rail of NON_RECIPE_RAILS) {
        if (recipeIds.has(rail.id)) {
            findings.push({
                where: `rail \`${rail.id}\``,
                what:
                    "is both a recipe this workspace yields and a declared non-recipe rail. One id cannot be two rails: " +
                    "the hook would shadow the recipe, and the recipe would go undrilled behind a green",
            });
        }
    }

    // `drills` is a seam for the suite and never a selection: the CLI never passes it, so the whole
    // declared table is always what gets validated. It exists because a guard nothing can exercise
    // positively is a guard nobody has seen work — this module's own subject, one altitude up.
    for (const drill of drills) {
        const where = `drill \`${drill.rail}\``;
        if (!recipeIds.has(drill.rail) && !nonRecipeIds.has(drill.rail)) {
            findings.push({
                where,
                what:
                    `names a rail that is neither a recipe the workspace yields nor a declared non-recipe rail. ` +
                    `A misspelled recipe id looks exactly like this, and it would leave the real recipe undrilled`,
            });
            continue;
        }
        drilled.add(drill.rail);

        // **A hook drill's session id must be the prefix this harness owns.** The completion in
        // `runRail` and the retirement in `drillOne` both key on it, so a drill inventing its own id
        // would get neither: a counter shared between runs and a file nobody cleans. That is a rail
        // with a precondition nobody states, refused here rather than left as a comment. Raised at the
        // pre-commit checkpoint's second pass, as a trap the fold had left open.
        if (nonRecipeIds.has(drill.rail) && drill.stdin?.session_id !== undefined && drill.stdin.session_id !== DRILL_SESSION_PREFIX) {
            findings.push({
                where,
                what:
                    `declares its own \`session_id\` (${JSON.stringify(drill.stdin.session_id)}). A hook drill's id must be ` +
                    `\`${DRILL_SESSION_PREFIX}\`, which \`runRail\` completes per run and \`drillOne\` retires — an id outside it ` +
                    `is shared between runs and its counter file is never cleaned`,
            });
        }

        if (typeof drill.tell !== "string" || drill.tell.length === 0) {
            findings.push({ where, what: "declares no `tell`, so a red for the wrong reason would count as a fire" });
        }
        if (typeof drill.why !== "string" || drill.why.length === 0) {
            findings.push({ where, what: "declares no `why`. A drill with no stated claim is a perturbation nobody can review" });
        }
        // **0 or 1, never 2.** Exit 2 is reserved throughout this repository for *could not run*, so a
        // drill declaring it would count a rail that could not be judged as a rail that fired — the exact
        // inversion `../.portulan/memory/verify-preconditions-fail-closed.md` exists to prevent, inside
        // the harness built to detect it. A rail whose only non-green arm IS a refusal needs an argument
        // and a different mechanism, not a declaration that quietly reads a refusal as a fire; the
        // `workflow-filters` drill was drafted that way and was rewritten to force the exit-1 arm
        // instead. Copilot round 1.
        if (drill.exit !== 0 && drill.exit !== 1) {
            findings.push({
                where,
                what:
                    `declares \`exit: ${JSON.stringify(drill.exit)}\`. A fire is 0 (a hook, which answers in its stdout) or ` +
                    "1 (a red); 2 is could-not-run everywhere here, and counting it as a fire would read a refusal as a verdict",
            });
        }
        // A drill whose control and fire are the same run proves nothing at all. One of the two must
        // differ: the tree, or the input.
        const inputDiffers = drill.stdinControl !== undefined;
        if (!drill.perturb && !inputDiffers) {
            findings.push({
                where,
                what: "has neither a perturbation nor a differing control input, so its control and its fire are the same run",
            });
        }

        // The anchor is checked against the WORKING TREE here, which is the whole value of `--check`
        // running on a pull request: the commit that moves an anchored line is the one that learns it.
        if (drill.perturb?.file !== undefined) {
            const target = path.join(repoRoot, drill.perturb.file);
            let source;
            try {
                source = fs.readFileSync(target, "utf8");
            } catch (cause) {
                throw new CouldNotRun(
                    `${where} names ${drill.perturb.file}, which cannot be read — ${cause.code ?? cause.message}`,
                );
            }
            let count = 0;
            let at = 0;
            for (;;) {
                const i = source.indexOf(drill.perturb.find, at);
                if (i === -1) break;
                count += 1;
                at = i + 1;
            }
            if (count !== 1) {
                throw new CouldNotRun(
                    `${where} places ${count} time(s) in ${drill.perturb.file} and a perturbation must be exactly one edit. ` +
                        (count === 0
                            ? "The subject moved and this drill did not — re-anchor it or retire it, but do not let it be skipped"
                            : "Lengthen its anchor until it is unique"),
                );
            }
            if (drill.perturb.find === drill.perturb.replace) {
                findings.push({ where, what: "replaces its anchor with itself, so the perturbation cannot move a byte" });
            }
        }
        if (drill.perturb?.create !== undefined && fs.existsSync(path.join(repoRoot, drill.perturb.create))) {
            findings.push({
                where,
                what: `would create ${drill.perturb.create}, which is already in the tree — a creation that overwrites is an edit wearing the wrong shape`,
            });
        }
    }

    for (const recipe of recipes) {
        if (!drilled.has(recipe.id)) {
            findings.push({
                where: `rail \`${recipe.id}\``,
                what: "is yielded by this workspace and has no drill. Nothing here has ever watched it fire",
            });
        }
    }
    for (const rail of NON_RECIPE_RAILS) {
        if (!drilled.has(rail.id)) {
            findings.push({ where: `rail \`${rail.id}\``, what: "is a declared non-recipe rail and has no drill" });
        }
    }
    return findings;
}

/** `git`, run for its stdout, with a could-not-run on failure rather than a throw nobody can read. */
function git(args, { cwd }) {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    if (result.error) throw new CouldNotRun(`git ${args[0]} could not run — ${result.error.message}`);
    if (result.status !== 0) {
        throw new CouldNotRun(`git ${args.join(" ")} exited ${result.status} — ${(result.stderr || "").trim()}`);
    }
    return result.stdout;
}

/**
 * Which commit the sweep drills, and the refusals that keep the answer honest.
 *
 * A worktree is a commit, so this tool reports on a commit. Two modes:
 *   default        `HEAD`, and a dirty tree is refused rather than silently drilled around
 *   --working-copy a commit synthesized from the working copy by `git stash create`
 *
 * `stash create` carries staged additions and unstaged edits to tracked files and does **not** carry
 * untracked-and-unstaged files — measured at the session-open checkpoint. So that mode refuses while any
 * exist, naming them: drilling a tree that is missing the file under review is the wrong-tree green this
 * whole design is arranged against.
 */
export function treeToDrill({ repoRoot, workingCopy }) {
    const head = git(["rev-parse", "HEAD"], { cwd: repoRoot }).trim();
    const dirty = git(["status", "--porcelain"], { cwd: repoRoot }).trim();

    if (!workingCopy) {
        if (dirty) {
            throw new CouldNotRun(
                `the working tree is not clean, and the sweep drills a COMMIT. Reporting on ${head.slice(0, 7)} while you are ` +
                    `looking at uncommitted work would be a green about a different tree. Pass --working-copy to drill the ` +
                    `working copy through a synthesized commit, or commit first`,
            );
        }
        return { sha: head, kind: "HEAD" };
    }

    if (!dirty) return { sha: head, kind: "HEAD (the working tree is clean, so --working-copy has nothing to add)" };

    const untracked = git(["ls-files", "--others", "--exclude-standard"], { cwd: repoRoot }).trim();
    if (untracked) {
        throw new CouldNotRun(
            "`git stash create` does not carry untracked files, so a synthesized commit would be missing these and the " +
                `drill would report on a tree that is not the one under review — stage them (\`git add\`) or remove them:\n` +
                untracked
                    .split("\n")
                    .map((f) => `           ${f}`)
                    .join("\n"),
        );
    }
    const synthesized = git(["stash", "create"], { cwd: repoRoot }).trim();
    if (!synthesized) {
        throw new CouldNotRun(
            "`git stash create` produced no commit over a tree `git status` calls dirty — refusing to guess which tree to drill",
        );
    }
    return { sha: synthesized, kind: "a commit synthesized from the working copy" };
}

/** Run one rail in one tree. Returns `{status, stdout, stderr}`. */
function runRail({ rail, worktree, stdin, workspaceRel }) {
    if (rail.argv) {
        // The id is completed here rather than in the declaration, so it is distinct per worktree and
        // still carries the prefix this harness cleans up under.
        const payload =
            stdin?.session_id === DRILL_SESSION_PREFIX
                ? { ...stdin, session_id: `${DRILL_SESSION_PREFIX}-${path.basename(worktree)}` }
                : stdin;
        const result = spawnSync(process.execPath, rail.argv, {
            cwd: worktree,
            encoding: "utf8",
            // **The enforced fields come LAST**, and the order is a finding rather than a style: spread
            // first, a drill's own `cwd` silently overrode it, and `./stop-gate.mjs` resolves the session
            // tree from that field — so drill data could have pointed a control or a fire at another
            // repository entirely while the transcript said the worktree. The harness owns the execution
            // tree, never the declaration. Copilot round 1.
            input: `${JSON.stringify({ ...payload, cwd: worktree })}\n`,
            timeout: RAIL_TIMEOUT_MS,
            // The hooks are TOLD their project root rather than deriving it, so a drill that did not set
            // this would grade the repository this session is in and not the throwaway worktree.
            //
            // **And `PORTULAN_WORKSPACE` is set rather than inherited.** Both hooks read
            // `process.env.PORTULAN_WORKSPACE || ".portulan"`, so with `--workspace` naming anything else
            // — or with that variable merely present in the ambient environment — the sweep enumerated one
            // workspace's recipes while the hooks read another workspace's policy. A rail graded against a
            // policy the run did not choose is a verdict about the machine. `run` refuses a workspace that
            // is not inside the repository, so this relative spelling always resolves in the worktree.
            // Copilot round 1.
            env: { ...process.env, CLAUDE_PROJECT_DIR: worktree, PORTULAN_WORKSPACE: workspaceRel },
        });
        if (result.error) throw new CouldNotRun(`rail \`${rail.id}\` could not run — ${result.error.message}`);
        return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
    }
    // A recipe's `run` is a shell string in the manifest — `bash -c` is how CI runs it and how the
    // Stop-gate runs it, so it is how a drill must run it. Nothing from a drill's declarations reaches
    // this command line: the string comes from the yielded set and the perturbation is applied to a file.
    const result = spawnSync("bash", ["-c", rail.run], {
        cwd: worktree,
        encoding: "utf8",
        timeout: RAIL_TIMEOUT_MS,
    });
    if (result.error) throw new CouldNotRun(`rail \`${rail.id}\` could not run — ${result.error.message}`);
    return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

/** The text a tell is looked for in — see `NON_RECIPE_RAILS` for why one rail reads stdout alone. */
const tellText = (rail, out) => (rail.tellStream === "stdout" ? out.stdout : `${out.stdout}${out.stderr}`);

/**
 * The part of a rail's output a reader needs, for a message that has to be legible in a CI log.
 *
 * **The finding-shaped lines first, and that is a defect this tool shipped once.** The first version
 * printed the last twelve lines, and this repository's recipes end with a long list of `ok` lines — so
 * the one `FAIL` that explained everything was scrolled off the top of the very diagnostic written to
 * explain it. A reader then has to re-run the rail by hand to find out what it said.
 */
const salient = (text, lines = 12) => {
    const all = text.split("\n").filter((l) => l.trim() !== "");
    const findings = all.filter((l) => /^\s*(FAIL|RED|✗|✖|not ok|UNPINNED)\b/.test(l) || /^RED —/.test(l));
    const chosen = findings.length ? [...findings.slice(0, lines), ...all.slice(-2)] : all.slice(-lines);
    return [...new Set(chosen)].map((l) => `           | ${l}`).join("\n");
};

/**
 * Drill one rail: a pristine control, then the perturbation, then the fire.
 *
 * Returns a finding or `null`. Throws `CouldNotRun` when no verdict can be formed — a control that is
 * already red, a tell already present before the perturbation, an anchor that will not place.
 */
export function drillOne({ drill, rail, repoRoot, sha, say, workspaceRel = ".portulan" }) {
    const worktree = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-drill-"));
    // `mkdtemp` creates the directory and `git worktree add` insists on creating it itself, so the
    // reservation is made and then handed back — which is still the right order: it is what guarantees
    // no two concurrent runs pick one path.
    fs.rmSync(worktree, { recursive: true, force: true });
    try {
        git(["worktree", "add", "--detach", worktree, sha], { cwd: repoRoot });

        const control = runRail({ rail, worktree, stdin: drill.stdinControl ?? drill.stdin, workspaceRel });
        if (control.status !== 0) {
            throw new CouldNotRun(
                `rail \`${drill.rail}\` is not green on the drilled tree, so nothing it does next is attributable to the ` +
                    `perturbation. Its control exited ${control.status}:\n${salient(`${control.stdout}${control.stderr}`)}`,
            );
        }
        if (tellText(rail, control).includes(drill.tell)) {
            throw new CouldNotRun(
                `rail \`${drill.rail}\` already says ${JSON.stringify(drill.tell)} before it is perturbed, so that tell ` +
                    `cannot show the drill fired. Narrow it to something only the finding says`,
            );
        }

        const moved = perturb(worktree, drill);
        if (drill.stage) git(["add", "-A"], { cwd: worktree });

        const fire = runRail({ rail, worktree, stdin: drill.stdin, workspaceRel });
        const text = tellText(rail, fire);
        if (fire.status !== drill.exit) {
            return {
                where: `rail \`${drill.rail}\``,
                what:
                    `did not fire as recorded: the drill expects exit ${drill.exit} and it exited ${fire.status}` +
                    `${moved ? ` after ${moved.path} was perturbed` : ""}. Output:\n${salient(`${fire.stdout}${fire.stderr}`)}`,
            };
        }
        if (!text.includes(drill.tell)) {
            return {
                where: `rail \`${drill.rail}\``,
                what:
                    `exited ${fire.status} as recorded and never said ${JSON.stringify(drill.tell)}, so it may have fired for ` +
                    `another reason entirely. Output:\n${salient(text)}`,
            };
        }
        say(`  fired  ${drill.rail.padEnd(28)} exit ${fire.status} · said ${JSON.stringify(drill.tell)}`);
        return null;
    } finally {
        // **The counter files a hook rail leaves behind, retired.** `./stop-gate.mjs` writes one per
        // (session id, tree) into the OS temp directory, so a sweep that invented a session id and
        // walked away left one 45-byte file per run accumulating forever — the leak #340 names in a
        // sibling module, found here at the pre-commit checkpoint before it could become the same
        // issue. Scoped to this harness's own prefix, which is why the prefix is a constant: a wider
        // glob would retire a live session's counter and quietly disarm its cap.
        try {
            const dir = os.tmpdir();
            const mine = `portulan-stopgate-${DRILL_SESSION_PREFIX}-${path.basename(worktree)}`;
            for (const entry of fs.readdirSync(dir)) {
                if (entry.startsWith(mine)) fs.rmSync(path.join(dir, entry), { force: true });
            }
        } catch {
            /* A counter file this run cannot retire is litter in a temp directory, never a wrong verdict. */
        }
        // `--force` because the perturbation left the worktree dirty, which is the whole point of it.
        try {
            git(["worktree", "remove", "--force", worktree], { cwd: repoRoot });
        } catch {
            fs.rmSync(worktree, { recursive: true, force: true });
            try {
                git(["worktree", "prune"], { cwd: repoRoot });
            } catch {
                /* A worktree this run cannot retire is noise in `git worktree list`, never a wrong verdict. */
            }
        }
    }
}

const USAGE = [
    "usage: node cli/drills.mjs [--check] [--only <rail>] [--working-copy] [--repo-root <dir>] [--workspace <dir>] [--pack-root <dir>]",
    "",
    "  Forces every rail red and requires it to fire. Milestone 8, clause (d).",
    "",
    "  --check         the correspondence pass only: every yielded rail has a drill, every drill names a",
    "                  declared rail, every anchor still places exactly once. Runs no rail. This is what",
    "                  the `drills` verify recipe runs, because the sweep reports on a COMMIT and a recipe",
    "                  must answer about the working copy.",
    "  --only <rail>   drill one rail. Narrows what RUNS, never what must be well formed.",
    "  --working-copy  drill the working copy through a commit synthesized with `git stash create`,",
    "                  instead of refusing a dirty tree. The synthesized sha is printed.",
    "",
    "  Exit 0 every drill fired · 1 a rail did not fire, or a rail has no drill · 2 could not run.",
].join("\n");

export async function run(argv = [], { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
    const say = (line) => stdout.write(`${line}\n`);
    try {
        let checkOnly = false;
        let workingCopy = false;
        let only = null;
        let repoRoot = cwd;
        let workspaceDir = null;
        const packRoots = [];

        for (let i = 0; i < argv.length; i += 1) {
            const value = argv[i + 1];
            const needs = (flag) => {
                if (value === undefined || value.startsWith("-") || value.trim() === "") {
                    throw new CouldNotRun(`${flag} needs a value`);
                }
                i += 1;
                return value;
            };
            if (argv[i] === "--check") checkOnly = true;
            else if (argv[i] === "--working-copy") workingCopy = true;
            else if (argv[i] === "--help" || argv[i] === "-h") {
                say(USAGE);
                return 0;
            } else if (argv[i] === "--only") only = needs("--only");
            else if (argv[i] === "--repo-root") repoRoot = path.resolve(needs("--repo-root"));
            else if (argv[i] === "--workspace") workspaceDir = path.resolve(needs("--workspace"));
            else if (argv[i] === "--pack-root") {
                const root = needs("--pack-root");
                let stat = null;
                try {
                    stat = fs.statSync(root);
                } catch (cause) {
                    throw new CouldNotRun(`--pack-root ${JSON.stringify(root)} cannot be read — ${cause.code ?? cause.message}`);
                }
                if (!stat.isDirectory()) throw new CouldNotRun(`--pack-root ${JSON.stringify(root)} is not a directory`);
                packRoots.push(path.resolve(root));
            } else throw new CouldNotRun(`unknown argument ${JSON.stringify(argv[i])}`);
        }
        workspaceDir ??= path.join(repoRoot, ".portulan");

        const recipes = yieldedRecipes({ workspaceDir, repoRoot, packRoots });

        // **The whole table, in every mode.** `--only` narrows what runs and not what must be well
        // formed — session 1's round 1 on `./mutants.mjs`, where `--only` skipped validation in exactly
        // the mode a person reaches for when something is already wrong.
        const findings = check({ recipes, repoRoot });

        if (checkOnly) {
            say(
                `drills: ${DRILLS.length} drill(s) over ${recipes.length} yielded recipe(s) plus ` +
                    `${NON_RECIPE_RAILS.length} declared non-recipe rail(s); anchors checked against the working tree`,
            );
            for (const excluded of NOT_DRILLED) say(`  not drilled  ${excluded.rail}`);
            if (findings.length) {
                for (const f of findings) stderr.write(`drills: ${f.where}\n           ${f.what}\n`);
                stderr.write(`RED — ${findings.length} finding(s) in the drill roster\n`);
                return 1;
            }
            say("GREEN — every yielded rail has a drill and every drill's anchor places exactly once");
            say("drills: --check runs no rail. Whether each one still FIRES is the sweep's answer, on the calendar");
            return 0;
        }

        // **The argument is validated before the tree is chosen, and the order is a finding rather than
        // a preference.** With `treeToDrill` first, a typo'd `--only` on a dirty tree reported the dirty
        // tree — a refusal naming a cause it had not established, which sends the reader to look at
        // their working copy when what was wrong was what they typed. Caught by this module's own suite.
        const selected = only === null ? DRILLS : DRILLS.filter((d) => d.rail === only);
        if (only !== null && selected.length === 0) {
            throw new CouldNotRun(
                `--only ${JSON.stringify(only)} names no drill. The declared rails are: ` +
                    `${DRILLS.map((d) => d.rail).join(", ")}`,
            );
        }

        // **The sweep runs every command from a throwaway worktree, so every path in one must resolve
        // there.** Two refusals, both measured rather than reasoned:
        //
        //   * a **pack root outside the repository** makes `recipe-set` relativise `${PACK_ROOT}` against
        //     the repo root, which produced `bash ../../../../../../../private/tmp/…/actions-pinned.sh`
        //     — a path with `..` hops, executed from a different directory, landing somewhere nobody
        //     chose. `--check` stays permissive because it runs no rail.
        //   * a **workspace outside the repository** cannot be handed to the hooks, which read
        //     `PORTULAN_WORKSPACE` as a path inside their project root.
        //
        // Both are could-not-run rather than a best effort: a rail run against files the sweep cannot
        // name is a verdict about neither tree. Copilot round 1.
        const inside = (dir) => {
            const rel = path.relative(repoRoot, dir);
            return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
        };
        for (const root of packRoots) {
            if (!inside(root)) {
                throw new CouldNotRun(
                    `--pack-root ${root} is outside ${repoRoot}, and the sweep runs each rail from a throwaway worktree. ` +
                        "A composed recipe's `${PACK_ROOT}` is relativised against the repository, so from a worktree it " +
                        "would point at neither copy. Pass a root inside the repository, or use --check, which runs no rail",
                );
            }
        }
        if (!inside(workspaceDir)) {
            throw new CouldNotRun(
                `--workspace ${workspaceDir} is outside ${repoRoot}, and the hook rails are handed their workspace as a ` +
                    "path inside the tree being drilled. Pass a workspace inside the repository, or use --check",
            );
        }
        const workspaceRel = path.relative(repoRoot, workspaceDir);

        const tree = treeToDrill({ repoRoot, workingCopy });
        const byId = new Map([
            ...recipes.map((r) => [r.id, { id: r.id, run: r.run }]),
            ...NON_RECIPE_RAILS.map((r) => [r.id, r]),
        ]);

        say(`drills: forcing every rail red on ${tree.sha.slice(0, 7)} — ${tree.kind}`);
        say(`drills: ${selected.length} of ${DRILLS.length} drill(s), one throwaway git worktree each`);
        for (const excluded of NOT_DRILLED) say(`  not drilled  ${excluded.rail}`);

        // **One rail that cannot be judged does not end the sweep**, and this is a defect the first run
        // of this tool shipped: a `CouldNotRun` thrown out of one drill aborted the loop and discarded
        // every finding already collected, so the run reported on one rail and said nothing about the
        // twenty behind it. That is the same argument `../.github/workflows/verify.yml` settles with
        // `set +e` — *a red recipe does not abort the loop* — and a sweep whose whole subject is rails
        // nobody has watched fire is the last place to stop looking at the first obstacle.
        //
        // The two outcomes stay distinguishable, per `../.portulan/memory/verify-preconditions-fail-closed.md`:
        // a **finding** is a rail that did not fire, and a **could-not-run** is a rail whose verdict
        // could not be formed. Both are printed; a single could-not-run makes the whole run exit 2,
        // because a set that was not fully judged has not been judged.
        const unjudged = [];
        for (const drill of selected) {
            const rail = byId.get(drill.rail);
            // `check` above has already refused a drill naming an undeclared rail, so this cannot be hit
            // through the CLI — it is the guard that keeps that true if the two ever drift.
            if (!rail) throw new CouldNotRun(`rail \`${drill.rail}\` is not in the yielded set nor declared`);
            try {
                const finding = drillOne({ drill, rail, repoRoot, sha: tree.sha, say, workspaceRel });
                if (finding) findings.push(finding);
            } catch (error) {
                if (!(error instanceof CouldNotRun)) throw error;
                unjudged.push({ where: `rail \`${drill.rail}\``, what: error.message });
                say(`  UNJUDGED  ${drill.rail}`);
            }
        }

        for (const f of [...findings, ...unjudged]) stderr.write(`drills: ${f.where}\n           ${f.what}\n`);
        if (unjudged.length) {
            stderr.write(
                `COULD NOT RUN — ${unjudged.length} rail(s) could not be judged` +
                    `${findings.length ? ` and ${findings.length} did not fire` : ""}. A set that was not fully judged has not been judged\n`,
            );
            return 2;
        }
        if (findings.length) {
            stderr.write(`RED — ${findings.length} rail(s) did not fire as recorded\n`);
            return 1;
        }
        say(`GREEN — every drilled rail was forced red and fired, on ${tree.sha.slice(0, 7)}`);
        say("drills: a rail fires here on ONE known-bad input. That it fires is not that it catches everything");
        return 0;
    } catch (error) {
        if (error instanceof CouldNotRun) {
            stderr.write(`drills: ${error.message}\n`);
            return 2;
        }
        stderr.write(`drills: could not finish the sweep — ${error?.stack ?? error}\n`);
        return 2;
    }
}

// The entry guard, in the ONE form `./rule-carriers.mjs` designates. `file://${argv[1]}` is NOT that
// form: `import.meta.url` percent-encodes, this working copy lives under a path with spaces, and the
// comparison fails — so the tool exits 0 having run nothing. Copied rather than re-derived, for the
// reason `./goldens.mjs` states after meeting the false green a third time.
function isMain() {
    const invoked = process.argv[1];
    if (!invoked) return false;
    if (import.meta.url === pathToFileURL(invoked).href) return true;
    try {
        return import.meta.url === pathToFileURL(fs.realpathSync(invoked)).href;
    } catch {
        return false;
    }
}

if (isMain()) process.exitCode = await run(process.argv.slice(2));
