#!/usr/bin/env node
// The forced-red drill harness — every rail broken on purpose, and required to fire.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { CouldNotRun } from "./goldens.mjs";
import { isInside } from "./inside.mjs";
import { recipeSet, resolverFor } from "./recipe-set.mjs";

const RAIL_TIMEOUT_MS = 10 * 60 * 1000;

export const DRILL_SESSION_PREFIX = "portulan-drill";

/** Hooks answer in their stdout JSON and exit 0 either way, so their drills judge by a tell read from stdout. */
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

export const NOT_DRILLED = [
    {
        rail: "the platform floor — branch protection, the required checks, `enforce_admins`",
        why: "forcing it red means a direct push to `main` or a merge of a red pull request: outward, Gated, and the maintainer's. `../.portulan/gate-map/platform-floor.md` records what `enforce_admins` holds and why the test that would force it past is deliberately not run.",
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

/** A rail that reads only the index misses a created file unless the drill sets `stage`. */
export const DRILLS = [
    // ------------------------------------------------------------------------- the yielded recipes
    {
        rail: "docs",
        perturb: {
            file: "CONTRIBUTING.md",
            find: "- [`docs/plan.md`](docs/plan.md) — the milestones. A change's record is its commit message.",
            replace: "- [`docs/plan.md`](docs/plan-the-drill-broke-this.md) — the milestones. A change's record is its commit message.",
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
        rail: "doctor",
        perturb: {
            file: ".portulan/gates.json",
            find: '"id": "edit-on-a-working-branch",\n      "tier": "auto",',
            replace: '"id": "edit-on-a-working-branch",\n      "tier": "gated",',
        },
        exit: 1,
        tell: "matches no path a host can submit",
        why: "A gate whose target can never match is the one defect this repository cannot see by reading a policy: the compiler reports it COMPILED and `doctor` counts it covered, so the gate map, the artifact and the report all agree about a gate that enforces nothing. Hole 8 of the gate map, closed by #337's option 3 — and the only rail that can watch the closure is the one whose exit is a verdict rather than a refusal.",
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
            // Appends, so the fixture's anchor still finds the program and the rail exits 1 rather than 2.
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
        rail: "context",
        perturb: {
            file: "core/engine.md",
            find: "# Portulan engine",
            // 408 bytes: over the engine rail's headroom, under the boot rails', so only the engine rail fires.
            replace: `# Portulan engine${" (moved back from an on-read file)".repeat(12)}`,
        },
        exit: 1,
        tell: "over its rail of",
        why: "Every boot in every adopting repository reads the kernel and the boot skill in full, so a demotion undone there costs every context everywhere. The rail is the only thing that turns that growth from a quiet diff into a red.",
    },
    {
        rail: "ledger",
        perturb: {
            file: "cli/ledger.mjs",
            find: "const prior = request.id === null ? undefined : byId.get(request.id);",
            replace: "const prior = undefined;",
        },
        exit: 1,
        tell: "does not reproduce",
        why: "The host writes one usage record per content block, so a reader that stops deduplicating by message id multiplies every figure by the blocks per request and still prints plausible numbers. The fixture's known totals are the only thing that tells those numbers from the true ones.",
    },
    {
        rail: "control-chars",
        perturb: {
            file: "CONTRIBUTING.md",
            find: "# Contributing",
            // A real NUL, written as an escape so this file carries no control byte of its own.
            replace: "# Contributing\u0000",
        },
        exit: 1,
        tell: "control character(s) — first at line",
        why: "A raw NUL shipped here once inside a template literal, and the tool most likely to have shown it — `grep` — is the tool the byte silences. Only a byte reader can fire on this, so only a byte reader's silence would hide it.",
    },
    {
        rail: "comments",
        perturb: {
            file: "cli/comments.mjs",
            find: 'const figure = (n) => n.toLocaleString("en-US");',
            replace: 'const figure = (n) => n.toLocaleString("en-US"); // Added 2026-09-24.',
        },
        exit: 1,
        tell: "is over the limit of",
        why: "A comment carrying a change's history is read again by every session that opens its file, and a model matching the surrounding code copies it. Only a reader of the comments themselves can tell one from the code around it.",
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
            find: "**Current release: `0.2.0`**",
            replace: "**Current release: `0.1.3`** <!-- the drill edited this and did not stage it -->",
        },
        stage: false,
        exit: 1,
        tell: "the package would not install the tree's bytes",
        why: "`.portulan/identity.md` claims the `npx` path installs the same bytes as the tree. This rail is that claim's only continuous check; an unstaged edit is precisely the drift it owns.",
    },
    {
        rail: "payload",
        perturb: {
            create: "cli/a-module-the-drill-left-unclassified.mjs",
            content: [
                "// A forced-red drill fixture, written by `cli/drills.mjs` into a throwaway worktree and never",
                "// committed. If you are reading this file inside the repository, a drill did not clean up after",
                "// itself and that is the bug.",
                "//",
                "// It is here because `package.json`'s `files` sweeps `cli/`, so ANY module landing here joins the",
                "// npm payload. `cli/pack-identity.mjs` would report green over it — it checks the bytes of what is",
                "// packed and never the roster — which is how `ab.mjs`, `ab-run.mjs` and `ab-grade.mjs` shipped for",
                "// three sessions before #382 removed them.",
                "",
                "export const theDrillPlantedThis = true;",
                "",
            ].join("\n"),
        },
        // Not staged: `npm pack` reads the working tree, so an untracked module ships too.
        stage: false,
        exit: 1,
        tell: "SHIPS and is classified by nothing",
        why:
            "`package.json`'s `files` array governs the payload and nothing derived its membership until #383 — " +
            "`pack-identity` holds the packed BYTES and is silent on which files are packed. The drill proves the " +
            "rail sees a real arrival in the tree rather than only a synthetic report handed to `findings()`, " +
            "which is the half a unit test cannot reach.",
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
            find: "**Current release: `0.2.0`**",
            replace: "**Current release: `0.1.3`**",
        },
        // Staged: this rail reads the index (`git show :<path>`), so an unstaged edit is invisible to it.
        stage: true,
        exit: 1,
        tell: "but package.json declares",
        why: "This repository shipped that exact defect twice, and `README.md` is in `package.json`'s `files` — npm freezes a README per version, so a wrong sentence that reaches a publish needs another release to correct.",
    },
    {
        rail: "skill-goldens",
        perturb: {
            file: "core/skills/clarify/SKILL.md",
            find: "## Why it earns its tokens",
            replace: "5. **A step the drill added** — bound to nothing, answered by no case.\n\n## Why it earns its tokens",
        },
        exit: 1,
        tell: "is in the skill's pass and in no case",
        why: "A core skill states its mandates in prose, and prose is what this repository ships. Before this rail a step could be added, reworded or deleted with every check still green. The derived denominator is what makes the corpus a rail rather than a self-graded exam, so it is the half worth drilling.",
    },
    {
        rail: "review-loop",
        perturb: {
            file: "evals/review-loop/register.md",
            find: "- **Repository:** `sleepy-panda-srl/portulan`",
            replace: "- **Repository:** `sleepy-panda-srl/portulan` (edited by hand)",
        },
        exit: 1,
        tell: "is out of date against the snapshot",
        why: "The register is the review loop's published figures, and this clause exists because the figures it replaces were hand-maintained. A register that could drift from its own snapshot would be that hand-maintained tally wearing a generated file's clothes.",
    },
    {
        rail: "telemetry",
        perturb: {
            file: ".portulan/verify/review-loop.sh",
            find: "    --snapshot evals/review-loop/snapshot.json \\",
            replace: "    --fetch \\\n    --snapshot evals/review-loop/snapshot.json \\",
        },
        exit: 1,
        tell: "invokes cli/review-meter.mjs --fetch",
        why: "A verify recipe that can reach the network goes red about the world rather than about the tree, and this repository prohibits it in three carriers while nothing checked it. The drill proves the checker sees a real invocation — spread across continued lines, the spelling a recipe actually uses — rather than only the literal string a test would hand it.",
    },
    {
        rail: "ab",
        perturb: {
            create: ".portulan/a-file-the-drill-left-unclassified.md",
            content: [
                "A forced-red drill fixture, written by `cli/drills.mjs` into a throwaway worktree and never",
                "committed. If you are reading this file inside the repository, a drill did not clean up after",
                "itself and that is the bug.",
                "",
                "It is here because `cli/ab.mjs`'s disposition table has to be TOTAL over `.portulan/`: anything",
                "it does not classify is carried into the A/B treatment arm by `cli/vendor.mjs`, which walks the",
                "whole workspace directory.",
                "",
            ].join("\n"),
        },
        exit: 1,
        tell: "classified by no disposition",
        why:
            "The A/B treatment arm is built by removing things from customer zero's workspace, and `cli/vendor.mjs` carries " +
            "every ordinary file under it — so a specification that names what to remove leaks whatever it forgot, silently, " +
            "into the arm an experiment is about to measure. That leak has already happened once and `doctor` was green on it. " +
            "This is the rail that turns the next one into a red on the commit that adds the file.",
    },
    {
        rail: "ab-grade",
        perturb: {
            file: "cli/ab-grade.mjs",
            find: '    const scenario = "curated-layer";\n    const anchor = anchored(root, scenario, nonce);',
            replace:
                '    const scenario = "curated-layer";\n' +
                '    if (fs.existsSync(path.join(root, "AGENTS.md"))) return verdict(scenario, "proposals", "a drill-planted constant about the BASE", []);\n' +
                "    const anchor = anchored(root, scenario, nonce);",
        },
        exit: 1,
        tell: "did not invert the figures",
        why:
            "A grader that has stopped reading the arm produces a baseline about file copying, and it does so silently: the " +
            "prototype this instrument was built around passed level-1 discrimination and was still a constant. Only inversion " +
            "caught it. This drill plants that constant back and requires the rail to fire — on the level-2 tell specifically, " +
            "because a fix that restored level 1 alone would leave the arm-blindness in place.",
    },
    {
        rail: "release-eval",
        perturb: {
            file: "cli/release-eval.mjs",
            find: 'export const FIRST_GOVERNED_VERSION = "0.1.3";',
            replace: 'export const FIRST_GOVERNED_VERSION = "0.1.2";',
        },
        exit: 1,
        tell: "is a release from milestone 8 onward and there is no",
        why:
            "Milestone 8's ninth clause is that a release carries an eval result, and the check that carries it is *a governed " +
            "release with no record reds*. Every governed release this repository has cut carries its record, so that arm cannot " +
            "be exercised from the committed tree at all — the rail's green grades a non-empty set and finds every member " +
            "complete, which is a measurement whose red arm nothing in the tree can reach. This drill moves the boundary so " +
            "the arm becomes reachable and requires it to fire, so the " +
            "clause's central check is watched working rather than assumed from a green over an empty set.",
    },
    {
        rail: "ab-run",
        perturb: {
            file: "evals/ab/baseline.json",
            find: '"operatorEnv": "isolated"',
            replace: '"operatorEnv": "inherit"',
        },
        exit: 1,
        tell: "no baseline may be recorded under an unisolated arm",
        why:
            "A baseline is the only record in this repository derived from events rather than from the tree, so it cannot be " +
            "re-derived and a reader has nothing but the capture beside it to trust. This rail holds the published document to " +
            "that capture, and refuses a baseline claiming an arm that is not the ruled one — the departure `evals/ab/corpus.md` " +
            "forbids in terms, and the one a later session is likeliest to reach for when a credential is inconvenient.",
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
            // Split so this line is not its own anchor; additive so every other anchor still places.
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
        perturb: {
            file: "CONTRIBUTING.md",
            find: "- [`docs/plan.md`](docs/plan.md) — the milestones. A change's record is its commit message.",
            replace: "- [`docs/plan.md`](docs/plan-the-drill-broke-this.md) — the milestones. A change's record is its commit message.",
        },
        stdin: {
            hook_event_name: "Stop",
            session_id: DRILL_SESSION_PREFIX,
        },
        exit: 0,
        // The recipe reason only: whether this hook also blocks for a missing handoff depends on the date.
        tell: "PORTULAN STOP-GATE (recipe",
        why: "This gate is what makes a red unmissable rather than merely recorded. It fails open on a crash by design, so a crashed Stop-gate and a green one are indistinguishable from outside — and only a drill that requires the refusal can tell them apart.",
    },
    {
        rail: "gate",
        perturb: null,
        stdinControl: { tool_name: "Bash", tool_input: { command: "git status --short" } },
        stdin: { tool_name: "Bash", tool_input: { command: "git push --force origin main" } },
        exit: 0,
        tell: "PORTULAN GATE `force-push-without-a-lease`",
        why: "The wrapper spellings and the shell writes are the ground the permission pattern cannot reach, so for those this hook is the only layer. A hook that had stopped emitting would leave that ground uncovered and say nothing.",
    },
];

const digest = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

/** Throws `CouldNotRun`, never skips, when the anchor is absent or ambiguous or the bytes do not move. */
export function perturb(worktree, drill) {
    if (!drill.perturb) return null;

    const contained = (rel) => {
        let root;
        try {
            root = fs.realpathSync(worktree);
        } catch (cause) {
            throw new CouldNotRun(
                `the drill worktree ${worktree} cannot be resolved — ${cause.code ?? cause.message}. ` +
                    "Nothing is perturbed against a tree that is not there",
            );
        }
        const target = path.resolve(worktree, rel);

        // The realpath loop below skips past a dangling link, so a link at the target is refused here.
        let leaf = null;
        try {
            leaf = fs.lstatSync(target);
        } catch {
            /* Not there at all, which is the ordinary case for a `create`. */
        }
        if (leaf?.isSymbolicLink()) {
            throw new CouldNotRun(
                `drill \`${drill.rail}\` names ${JSON.stringify(rel)}, which is a symlink. A write follows it, so it can ` +
                    "leave the drill worktree even when the link is dangling — refused whatever it points at",
            );
        }

        let probe = target;
        for (;;) {
            try {
                probe = fs.realpathSync(probe);
                break;
            } catch {
                const parent = path.dirname(probe);
                if (parent === probe) break;
                probe = parent;
            }
        }
        // The first stops a symlink hop, the second a `..` that never touches an existing directory.
        if (!isInside(root, probe) || !isInside(path.resolve(worktree), target)) {
            throw new CouldNotRun(
                `drill \`${drill.rail}\` names ${JSON.stringify(rel)}, which resolves outside the drill worktree. ` +
                    "A perturbation may only touch the throwaway tree — the isolation is the reason a drill is safe to run at all",
            );
        }
        return target;
    };

    if (drill.perturb.create !== undefined) {
        const target = contained(drill.perturb.create);
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
    const target = contained(rel);
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

/** Never consults the host for packs, so the set cannot move with what happens to be installed. */
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

/** Returns findings; throws `CouldNotRun` for an anchor that does not place exactly once. */
export function check({ recipes, repoRoot, drills = DRILLS }) {
    const findings = [];
    const recipeIds = new Set(recipes.map((r) => r.id));
    const nonRecipeIds = new Set(NON_RECIPE_RAILS.map((r) => r.id));
    const drilled = new Set();

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
        if (drill.exit !== 0 && drill.exit !== 1) {
            findings.push({
                where,
                what:
                    `declares \`exit: ${JSON.stringify(drill.exit)}\`. A fire is 0 (a hook, which answers in its stdout) or ` +
                    "1 (a red); 2 is could-not-run everywhere here, and counting it as a fire would read a refusal as a verdict",
            });
        }
        // A null `stdinControl` falls back to `stdin` in `drillOne`, so it does not count as differing input.
        const inputCanDiffer =
            nonRecipeIds.has(drill.rail) &&
            drill.stdinControl !== undefined &&
            drill.stdinControl !== null &&
            JSON.stringify(drill.stdinControl) !== JSON.stringify(drill.stdin);
        if (!drill.perturb && !inputCanDiffer) {
            findings.push({
                where,
                what:
                    nonRecipeIds.has(drill.rail)
                        ? "has no perturbation and no control input that differs from its fire input, so its control and its fire are the same run"
                        : "has no perturbation, and a recipe rail is handed no stdin at all — so its control and its fire are the same run",
            });
        }

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

function git(args, { cwd }) {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    if (result.error) throw new CouldNotRun(`git ${args[0]} could not run — ${result.error.message}`);
    if (result.status !== 0) {
        throw new CouldNotRun(`git ${args.join(" ")} exited ${result.status} — ${(result.stderr || "").trim()}`);
    }
    return result.stdout;
}

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

function runRail({ rail, worktree, stdin, workspaceRel }) {
    if (rail.argv) {
        const payload =
            stdin?.session_id === DRILL_SESSION_PREFIX
                ? { ...stdin, session_id: `${DRILL_SESSION_PREFIX}-${path.basename(worktree)}` }
                : stdin;
        const result = spawnSync(process.execPath, rail.argv, {
            cwd: worktree,
            encoding: "utf8",
            // After the spread, so a drill's own `cwd` cannot point the hook at another tree.
            input: `${JSON.stringify({ ...payload, cwd: worktree })}\n`,
            timeout: RAIL_TIMEOUT_MS,
            // Set, never inherited: the hooks read their tree and workspace from these two.
            env: { ...process.env, CLAUDE_PROJECT_DIR: worktree, PORTULAN_WORKSPACE: workspaceRel },
        });
        if (result.error) throw new CouldNotRun(`rail \`${rail.id}\` could not run — ${result.error.message}`);
        return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
    }
    // `bash -c`, as CI and the Stop-gate run a recipe; no drill declaration may reach this command line.
    const result = spawnSync("bash", ["-c", rail.run], {
        cwd: worktree,
        encoding: "utf8",
        timeout: RAIL_TIMEOUT_MS,
    });
    if (result.error) throw new CouldNotRun(`rail \`${rail.id}\` could not run — ${result.error.message}`);
    return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

const tellText = (rail, out) => (rail.tellStream === "stdout" ? out.stdout : `${out.stdout}${out.stderr}`);

const salient = (text, lines = 12) => {
    const all = text.split("\n").filter((l) => l.trim() !== "");
    const findings = all.filter((l) => /^\s*(FAIL|RED|✗|✖|not ok|UNPINNED)\b/.test(l) || /^RED —/.test(l));
    const chosen = findings.length ? [...findings.slice(0, lines), ...all.slice(-2)] : all.slice(-lines);
    return [...new Set(chosen)].map((l) => `           | ${l}`).join("\n");
};

/** A finding, or null when the rail fired as recorded; throws `CouldNotRun` when no verdict can be formed. */
export function drillOne({ drill, rail, repoRoot, sha, say, workspaceRel = ".portulan" }) {
    const worktree = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-drill-"));
    // `git worktree add` creates the directory itself; `mkdtemp` only reserved a unique name for it.
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
        if (fire.status === null) {
            throw new CouldNotRun(
                `rail \`${drill.rail}\` was killed by a signal rather than exiting, so no verdict was formed` +
                    `${moved ? ` after ${moved.path} was perturbed` : ""}. Output:\n${salient(`${fire.stdout}${fire.stderr}`)}`,
            );
        }
        if (fire.status === 2 && drill.exit !== 2) {
            throw new CouldNotRun(
                `rail \`${drill.rail}\` exited 2 — could not run — so it formed no verdict about the perturbation` +
                    `${moved ? ` in ${moved.path}` : ""}. Output:\n${salient(`${fire.stdout}${fire.stderr}`)}`,
            );
        }
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
        // Only this harness's prefix: a wider match would delete a live session's counter and disarm its cap.
        try {
            const dir = os.tmpdir();
            const mine = `portulan-stopgate-${DRILL_SESSION_PREFIX}-${path.basename(worktree)}`;
            for (const entry of fs.readdirSync(dir)) {
                if (entry.startsWith(mine)) fs.rmSync(path.join(dir, entry), { force: true });
            }
        } catch {
            /* A counter file this run cannot retire is litter in a temp directory, never a wrong verdict. */
        }
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

        // The whole table in every mode: `--only` narrows what runs, not what must be well formed.
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

        // Before `treeToDrill`, so a mistyped `--only` on a dirty tree is not reported as the dirty tree.
        const selected = only === null ? DRILLS : DRILLS.filter((d) => d.rail === only);
        if (only !== null && selected.length === 0) {
            throw new CouldNotRun(
                `--only ${JSON.stringify(only)} names no drill. The declared rails are: ` +
                    `${DRILLS.map((d) => d.rail).join(", ")}`,
            );
        }

        // `realpathSync` on both sides: on macOS `/var` is `/private/var`, one directory under two names.
        const real = (dir) => {
            try {
                return fs.realpathSync(dir);
            } catch {
                return path.resolve(dir);
            }
        };
        const repoReal = real(repoRoot);
        for (const root of packRoots) {
            if (!isInside(repoReal, real(root))) {
                throw new CouldNotRun(
                    `--pack-root ${root} is outside ${repoRoot}, and the sweep runs each rail from a throwaway worktree. ` +
                        "A composed recipe's `${PACK_ROOT}` is relativised against the repository, so from a worktree it " +
                        "would point at neither copy. Pass a root inside the repository, or use --check, which runs no rail",
                );
            }
        }
        if (!isInside(repoReal, real(workspaceDir))) {
            throw new CouldNotRun(
                `--workspace ${workspaceDir} is outside ${repoRoot}, and the hook rails are handed their workspace as a ` +
                    "path inside the tree being drilled. Pass a workspace inside the repository, or use --check",
            );
        }
        // `.`, not "": the hooks' `PORTULAN_WORKSPACE || ".portulan"` reads an empty value as unset.
        const workspaceRel = path.relative(repoRoot, workspaceDir) || ".";

        if (findings.length) {
            for (const f of findings) stderr.write(`drills: ${f.where}\n           ${f.what}\n`);
            stderr.write(`RED — ${findings.length} finding(s) in the drill roster; no rail was drilled\n`);
            return 1;
        }

        const tree = treeToDrill({ repoRoot, workingCopy });
        const byId = new Map([
            ...recipes.map((r) => [r.id, { id: r.id, run: r.run }]),
            ...NON_RECIPE_RAILS.map((r) => [r.id, r]),
        ]);

        say(`drills: forcing every rail red on ${tree.sha.slice(0, 7)} — ${tree.kind}`);
        say(`drills: ${selected.length} of ${DRILLS.length} drill(s), one throwaway git worktree each`);
        for (const excluded of NOT_DRILLED) say(`  not drilled  ${excluded.rail}`);

        const unjudged = [];
        for (const drill of selected) {
            const rail = byId.get(drill.rail);
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

// Not `file://${argv[1]}`: `import.meta.url` percent-encodes, so a path with a space would never match.
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
