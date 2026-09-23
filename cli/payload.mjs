#!/usr/bin/env node
// Every `cli/*.mjs` the npm payload carries is classified, and nothing arrives in it unclassified.
//
// [#383](https://github.com/sleepy-panda-srl/portulan/issues/383)'s first half. `../package.json`'s
// `files` array governs what ships; **nothing derived or checked its membership.**
// [`./pack-identity.mjs`](pack-identity.mjs) holds every packed file byte-identical to its staged blob
// and is deliberately silent on *which* files those are, so a module landing in `cli/` joined the
// published package with no rail saying so. Demonstrated rather than argued, on the change that filed
// #383: a `cli/workshop-thing.mjs` staged into a scratch clone entered the tarball with
// `pack-identity` reporting green over 84 files.
//
// That is not hypothetical. `./ab.mjs`, `./ab-run.mjs` and `./ab-grade.mjs` entered the payload in
// milestone 8 sessions 6b–6d and stayed there, unnoticed, until #382 removed them.
//
// ## The shape, which is `./eval-bundle.mjs`'s one level down
//
// `assertPartition` there rules that `PAYLOAD ∪ EXCLUDED_TOP_LEVEL` must equal the commit's top-level
// tracked entries, disjointly — *"a new top-level path fails every pull request until somebody decides
// whether it ships"*. This is that discipline at `cli/*.mjs` granularity, and the classes below are the
// dispositions. A module belongs to exactly one.
//
// ## What this does NOT claim
//
// **It does not derive the payload; npm's `files` handling is still the enforcer.** This rail
// *classifies and checks* — `../.portulan/memory/a-stated-enforcer-must-be-the-real-one.md`. The
// authority for *shipped* here is the `npm pack --dry-run --json` roster, never a string match on the
// `!` lines: npm's negation semantics are npm's, and reconciling against what it actually packs is what
// keeps this rail's answer the same as the registry's.
//
// ## Exit codes, per `../.portulan/memory/verify-preconditions-fail-closed.md`
//
//   0  every shipped module is classified, every disposition is live, every exclusion holds
//   1  a finding: an unclassified module, a stale disposition, an unruled module that moved, or an
//      exclusion the payload disagrees with
//   2  could not run: `npm pack` unusable, not a git repository, or a module that cannot be read
//
// The 2 matters here for `./pack-identity.mjs`'s reason: this rail shells out to npm, and reporting
// "an unclassified module" when what happened is "npm did not run" sends someone hunting a defect that
// does not exist.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { HOOK_RUNNERS } from "./compile.mjs";
import { packedPaths } from "./pack-identity.mjs";
import { SUBCOMMANDS } from "./portulan.mjs";

class CannotRun extends Error {}

const git = (root, args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/**
 * The modules that are tracked and deliberately do NOT ship, each with the reason — the roster is
 * reviewable because the reasons are, which is `./eval-bundle.mjs`'s `EXCLUDED_TOP_LEVEL` rule and the
 * only place these reasons can live: `package.json` is JSON and carries no comments.
 *
 * Checked against the payload roster rather than against the `!` lines that produce it. An entry the
 * payload still carries is a finding; so is an entry naming a file the tree no longer has.
 */
export const EXCLUDED = {
    "eval-bundle.mjs":
        "issuer machinery — an evaluee receives the stamped licence, never the stamp press. Excluded at " +
        "the first publish (13e72db0), and `SELF_EXCLUDED` in that module names it too",
    "eval-license.template.md":
        "the licence text the cutter stamps; issuer machinery for the same reason as the cutter itself",
    "ab.mjs":
        "the A/B construction instrument. Its `DISPOSITIONS` table classifies THIS repository's " +
        "`.portulan/` path by path and is compiled into the module, so it can be pointed nowhere else — " +
        "the rig has one subject and it is not the reader's repository (#382)",
    "ab-run.mjs": "the A/B runner; its `SNAPSHOT` is one baseline, of one arm, on one date (#382)",
    "ab-grade.mjs": "the A/B graders, and a register of this repository's own stimuli (#382)",
    "payload.mjs":
        "this rail. Its subject is this repository's own publish surface, which is the argument that " +
        "excluded the A/B rig — self-exclusion on `./eval-bundle.mjs`'s precedent, decided when it was " +
        "written rather than after a totality check demanded a class for it",
};

/**
 * The shipped modules that are reachable from nothing the package exposes and have been **ruled to
 * ship anyway**, each with the ruling and its ground.
 *
 * **This is the class `UNRULED` empties into.** Those thirteen are not here because nobody has been
 * asked, not because anybody decided against them; as #383 is answered, entries move from there to
 * here or to `EXCLUDED`. Without this class the rail could record the absence of a decision and had
 * nowhere to put its presence — a gap it exposed in itself the first time a new module arrived.
 *
 * The bar is the rule `./eval-bundle.mjs`'s `EXCLUDED_TOP_LEVEL.evals` set on 2026-08-24 — **the tool
 * is product and the policy it reads is this team's** — and an entry must say who ruled and on what,
 * because a disposition without its ground is the thing this roster exists to stop being taken on
 * trust.
 *
 * **What makes "ruled by the maintainer" true is his merge over this register**, which is the same and
 * only authority `EXCLUDED`, `EXCLUDED_TOP_LEVEL` and `UNRULED` ever had. This rail cannot verify who
 * ruled and does not claim to — it checks that a disposition exists, is live, and is unique.
 */
export const PRODUCT = {
    "release-eval.mjs":
        "the eval result a release carries, written at publish by `--tagged`. Ruled product by the " +
        "maintainer on 2026-09-01, on two grounds that are NOT one. (1) `./eval-bundle.mjs`'s 2026-08-24 " +
        "rule — *the tool is product, the policy it reads is this team's* — makes a tool product even when " +
        "its data stays home, which is `goldens` shipping without its corpus; this is the a-fortiori case, " +
        "since #381 put `evals/releases/` in `files` and the data ships too. (2) The no-split half is " +
        "**#381's own ruling**, not that rule's: *the artifact carries both the claim and the tool that " +
        "checks it*, since a record shipped without its regenerator is the ships-but-cannot-run inversion " +
        "that change exists to refuse. An earlier draft of this entry fused the two and had the 2026-08-24 " +
        "rule refusing the very split it institutes — caught at the checkpoint",
};

/**
 * The shipped modules that are reachable from nothing the package exposes, and on which **nobody has
 * ruled**.
 *
 * **This class records the absence of a decision, never a decision.** `./discover.mjs` mints
 * `could-not-look` beside its three real verdicts because a resolver with two answers must not spend
 * *could not look* as *not installed*; this is the same refusal — "nobody ruled" is spent as neither
 * *ships* nor *excluded*. #383 is the way back, and
 * `../.portulan/memory/a-recorded-limit-is-not-a-managed-limit.md` is why the class carries it — on
 * the object here and in the text of every finding and every green — since a limit waiting on a
 * decision without its issue link is where the question goes to be forgotten politely.
 *
 * **FROZEN, and that is what separates this from a fail-open.** The rail asserts the class still holds
 * exactly `frozenAt` names, and that none of them is classified anywhere else. A fourteenth module may not join it — an arriving module is classified or the recipe is
 * red. An open hole class would be the shape `../.portulan/gate-map.md` condemns, coverage-reading
 * machinery over an escape hatch, and the pressure to widen it is exactly the pressure this constant
 * exists to refuse.
 *
 * Most are the shape `./eval-bundle.mjs`'s `EXCLUDED_TOP_LEVEL.evals` already ruled ships — *the tool
 * is product, the policy it reads is this team's* — but that ruling was about `goldens` and was never
 * put to the rest. Which of these ship is the maintainer's call, the same way a ninth subcommand is.
 */
export const UNRULED = {
    issue: 383,
    // The freeze, as a number the rail checks rather than a sentence it makes. `findings()` reds if
    // `modules` stops holding exactly this many — measured at the checkpoint, where pushing a
    // fourteenth name produced no finding at all and the class comment's claim that "the rail asserts
    // the class is exactly these names" was the overstated-enforcer defect this repository names.
    frozenAt: 13,
    modules: [
        "control-chars.mjs",
        "drills.mjs",
        "fuzz-shell.mjs",
        "goldens.mjs",
        "librarian.mjs",
        "mutants.mjs",
        "pack-identity.mjs",
        "pack-version.mjs",
        "review-meter.mjs",
        "rule-carriers.mjs",
        "skill-goldens.mjs",
        "telemetry.mjs",
        "version-carriers.mjs",
    ],
};

/**
 * Every dynamic `import(` in a shipped module, and what its subject is.
 *
 * A computed `import()` is an edge this rail's static walk cannot follow, so
 * `../.portulan/memory/a-checker-must-refuse-what-it-cannot-check.md` binds: an unaccounted one is
 * **refused**, never skipped. Each entry says why the site adds no `cli/` edge — either the subject is
 * not a `cli/` module, or the edge is already derived from a roster this rail reads.
 */
export const ACCOUNTED_DYNAMIC_IMPORTS = {
    "portulan.mjs": "the dispatcher's own loader; its subjects are `SUBCOMMANDS`' modules, read below",
    "init.mjs": "a literal node builtin (`node:readline/promises`)",
    "upgrade.mjs": "a workspace's migration module, resolved under the workspace and never under `cli/`",
    "mutants.mjs": "a mutant file this tool wrote itself, and the compiler module under test",
};

/** The module names a `cli/*.mjs` file imports, by every edge form that reaches one. */
export function edgesOf(source) {
    const edges = new Set();
    // `import … from "./x.mjs"`, `export … from "./x.mjs"`, and side-effect `import "./x.mjs"`.
    // **The re-export form is carried on the grammar, not on a live example** — `./portulan.mjs:76`
    // re-exports `VERSION` from `./manifest.mjs`, but line 77 plain-imports it and `./feedback.mjs`
    // does too, so today an `^import`-only reader would still classify `manifest.mjs`. An earlier draft
    // of this comment claimed otherwise and the pre-commit checkpoint measured it false. The form stays
    // because a module reachable ONLY by `export … from` is one edit away and would arrive silently;
    // the reason it is here is the grammar being total, never a defect it currently catches.
    //
    // **What is NOT covered, and is a hole rather than a refusal:** a static edge into a subdirectory
    // or a parent (`./fixtures/x.mjs`, `../x.mjs`). No shipped module has one today; if one arrives it
    // is dropped silently rather than refused, which is the weakest seam in this walk.
    for (const m of source.matchAll(/(?:^|\n)\s*(?:import|export)\b[^;]*?from\s*["']\.\/([^"']+)["']/g)) {
        edges.add(m[1]);
    }
    for (const m of source.matchAll(/(?:^|\n)\s*import\s*["']\.\/([^"']+)["']/g)) edges.add(m[1]);
    return edges;
}

/** Does this source carry a dynamic `import(` outside a comment? */
export function hasDynamicImport(source) {
    return source
        .split("\n")
        .some((line) => /(?:^|[^.\w])import\s*\(/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line));
}

/**
 * Classify every `cli/*.mjs` the payload carries.
 *
 * Roots are derived, never listed: `../package.json`'s `bin` values are the entry points the package
 * exposes, `SUBCOMMANDS` is imported from the dispatcher that owns it, and `HOOK_RUNNERS` from
 * `./compile.mjs`, which spells them into generated host configuration and is their one carrier.
 */
export function classify(root) {
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    } catch (error) {
        throw new CannotRun(`package.json could not be read — ${error.code ?? error.message}`);
    }

    // **`packedPaths` throws `./pack-identity.mjs`'s OWN `CannotRun`, which is a different class than
    // this file's** — two modules, two declarations, and `instanceof` is false across them. Without this
    // boundary the rail CRASHES where it contracts exit 2, which is the fail-open
    // `../.portulan/memory/verify-preconditions-fail-closed.md` exists to refuse: a recipe that dies on
    // "npm did not run" reports nothing, and nothing is not a verdict. Caught by Copilot on #393; the
    // earlier checkpoint's could-not-run cases all tripped this file's own reads first and never reached
    // here. Translating at the seam beats exporting the class, because the guarantee wanted is "no
    // failure of that call escapes as a crash", not "one named class is handled".
    let shipped;
    try {
        shipped = packedPaths(root)
            .filter((p) => /^cli\/[^/]+\.mjs$/.test(p))
            .map((p) => p.slice("cli/".length));
    } catch (error) {
        throw new CannotRun(`the packed roster could not be read — ${error.message}`);
    }

    if (shipped.length === 0) throw new CannotRun("the payload carries no `cli/*.mjs` — refusing to report a green over an empty roster");

    let tracked;
    try {
        tracked = git(root, ["ls-files", "cli"])
            .split("\n")
            .filter((p) => /^cli\/[^/]+\.mjs$/.test(p))
            .map((p) => p.slice("cli/".length));
    } catch (error) {
        throw new CannotRun(`\`git ls-files\` did not run — ${error.message.split("\n")[0]}`);
    }

    const read = (name) => {
        try {
            return fs.readFileSync(path.join(root, "cli", name), "utf8");
        } catch (error) {
            throw new CannotRun(`cli/${name} could not be read — ${error.code ?? error.message}`);
        }
    };

    // **npm's `bin` is legally EITHER a map or a bare string**, and `Object.values` on a string yields
    // its characters — so the string form would have seeded no root at all and mis-classified the real
    // entry point. This repository's is a map, so there is no live defect; the shape is handled because
    // a rail that reads a manifest should read the manifest's schema rather than this manifest.
    const declaredBin = manifest.bin ?? {};
    const binPaths = typeof declaredBin === "string" ? [declaredBin] : Object.values(declaredBin);
    const binTargets = new Set(
        binPaths
            .filter((v) => typeof v === "string" && v.startsWith("cli/"))
            .map((v) => v.slice("cli/".length)),
    );
    const dispatched = new Set(SUBCOMMANDS.map((s) => s.module).filter(Boolean));
    const runners = new Set(HOOK_RUNNERS);

    // Reachability over the SHIPPED set only: an edge to a module the payload does not carry is a
    // dangling import at install time, which `./pack-identity.mjs` cannot see either. It is reported
    // below rather than silently ending the walk.
    const shippedSet = new Set(shipped);
    const dangling = [];
    const seen = new Set();
    // **A root the payload does not carry is a FINDING, never a root quietly dropped.** Filtering the
    // seeds to what ships is necessary — the walk reads shipped sources — but doing it silently is a
    // fail-open of the exact kind this rail exists to refuse: exclude the `bin` by accident and the
    // package installs an entry point pointing at nothing while this reports green over the remainder.
    // Caught by Copilot on #393. The three root kinds are named separately because the repair differs.
    const missingRoots = [
        ...[...binTargets].filter((m) => !shippedSet.has(m)).map((m) => ({ kind: "the `bin` target", name: m })),
        ...[...dispatched].filter((m) => !shippedSet.has(m)).map((m) => ({ kind: "a `SUBCOMMANDS` module", name: m })),
        ...[...runners].filter((m) => !shippedSet.has(m)).map((m) => ({ kind: "a compiled-hook runner", name: m })),
    ];
    const queue = [...binTargets, ...dispatched, ...runners].filter((m) => shippedSet.has(m));
    while (queue.length) {
        const name = queue.pop();
        if (seen.has(name)) continue;
        seen.add(name);
        for (const edge of edgesOf(read(name))) {
            if (!shippedSet.has(edge)) {
                if (tracked.includes(edge)) dangling.push({ from: name, to: edge });
                continue;
            }
            if (!seen.has(edge)) queue.push(edge);
        }
    }

    const unruled = new Set(UNRULED.modules);
    const classOf = (name) => {
        if (binTargets.has(name)) return "bin";
        if (dispatched.has(name)) return "subcommand";
        if (runners.has(name)) return "hook-runner";
        if (seen.has(name)) return "imported";
        if (name in PRODUCT) return "product";
        if (unruled.has(name)) return "unruled";
        return null;
    };

    const classes = new Map(shipped.map((name) => [name, classOf(name)]));
    return { shipped, tracked, classes, reachable: seen, dangling, missingRoots, root };
}

/** Every finding, in the order a reader can act on them. */
export function findings(report) {
    const { shipped, tracked, classes, reachable } = report;
    const red = [];

    for (const [name, cls] of classes) {
        if (cls === null) {
            red.push(
                `cli/${name} SHIPS and is classified by nothing — it is not the \`bin\`, not a \`SUBCOMMANDS\` ` +
                    `module, not imported by one, not a hook runner, and not excluded. Decide whether it belongs ` +
                    `in the package: exclude it in package.json's \`files\` with a reason in EXCLUDED, or rule it into ` +
                    `PRODUCT with the ground for that ruling. It may NOT be added to UNRULED, which is frozen at the ` +
                    `thirteen #${UNRULED.issue} asks about — that class records who has not been asked, not who has been cleared`,
            );
        }
    }

    // UNRULED is frozen in both directions: nothing joins it, and an entry that stops being unreachable
    // has moved and must be reclassified rather than left standing.
    for (const name of UNRULED.modules) {
        if (!shipped.includes(name)) {
            red.push(
                `cli/${name} is UNRULED but the payload no longer carries it — the question #${UNRULED.issue} holds ` +
                    `open was answered somewhere else. Move it to EXCLUDED with the reason, or restore it`,
            );
            continue;
        }
        if (reachable.has(name)) {
            red.push(
                `cli/${name} is UNRULED but is now reachable from the package's own entry points — it is product ` +
                    `by import and the class is stale. Reclassify it; a reachable module is not waiting on a ruling`,
            );
        }
    }

    if (UNRULED.modules.length !== UNRULED.frozenAt) {
        red.push(
            `UNRULED holds ${UNRULED.modules.length} module(s) and is frozen at ${UNRULED.frozenAt}. The class records ` +
                `which modules nobody has been asked about — it may shrink only as #${UNRULED.issue} is answered and each ` +
                `entry MOVES to PRODUCT or EXCLUDED, and it may not grow at all`,
        );
    }

    // The three registers must be pairwise disjoint. Before PRODUCT existed this was unrepresentable;
    // it became possible the moment a ruling could ADD an entry while forgetting to remove the old one,
    // and it was silent until the checkpoint forced it. `eval-bundle.mjs`'s `assertPartition` is the
    // precedent: a path ships or it does not, and it says so once.
    for (const [a, b] of [["PRODUCT", "UNRULED"], ["PRODUCT", "EXCLUDED"], ["UNRULED", "EXCLUDED"]]) {
        const sets = { PRODUCT: Object.keys(PRODUCT), UNRULED: UNRULED.modules, EXCLUDED: Object.keys(EXCLUDED) };
        for (const name of sets[a].filter((n) => sets[b].includes(n))) {
            red.push(
                `cli/${name} is in BOTH ${a} and ${b} — one module, two dispositions, and the rail would otherwise ` +
                    `report a green over a register that contradicts itself. Delete the one the ruling superseded`,
            );
        }
    }

    for (const [name, why] of Object.entries(PRODUCT)) {
        if (!shipped.includes(name)) {
            red.push(
                `PRODUCT rules cli/${name} into the package (${why.split(".")[0]}) but the payload does not carry it — ` +
                    `a ruling outliving its subject. Drop the entry, or restore the file to \`files\``,
            );
            continue;
        }
        if (reachable.has(name)) {
            red.push(
                `cli/${name} is in PRODUCT but is now reachable from the package's own entry points — it classifies as ` +
                    `\`imported\` on its own and the entry is redundant. Drop it, so the roster keeps naming only the ` +
                    `modules that need a ruling to be here`,
            );
        }
    }

    for (const [name, why] of Object.entries(EXCLUDED)) {
        // `tracked` holds only `cli/*.mjs`, so a non-module entry is asked of the tree directly rather
        // than skipped — an exclusion nobody can verify is the half of this rail that would rot first.
        const present = /\.mjs$/.test(name) ? tracked.includes(name) : fs.existsSync(path.join(report.root, "cli", name));
        if (!present) {
            red.push(`EXCLUDED names cli/${name}, which the tree does not carry — a stale exclusion is a defect in the declaration`);
            continue;
        }
        if (shipped.includes(name)) {
            red.push(
                `cli/${name} is EXCLUDED (${why.split("—")[0].trim()}) but the payload CARRIES it — package.json's ` +
                    `\`files\` and this declaration disagree, and npm's is the one that ships`,
            );
        }
    }

    for (const name of tracked) {
        if (/\.test\.mjs$/.test(name)) continue;
        if (shipped.includes(name)) continue;
        if (name in EXCLUDED) continue;
        red.push(
            `cli/${name} is tracked and does NOT ship, and no EXCLUDED entry says why. An unexplained absence is ` +
                `the same defect as an unexplained presence`,
        );
    }

    for (const { kind, name } of report.missingRoots ?? []) {
        red.push(
            `cli/${name} is ${kind} and the payload does NOT carry it — the installed package would expose an entry ` +
                `point resolving to nothing. Restore it to \`files\`, or stop naming it as a root`,
        );
    }

    for (const { from, to } of report.dangling) {
        red.push(`cli/${from} imports ./${to}, which the payload does not carry — the installed package would raise ERR_MODULE_NOT_FOUND`);
    }

    return red;
}

/**
 * Split the dynamic-import register against the tree, in both directions.
 *
 * `unaccounted` is an edge this rail cannot follow and nobody has explained; `stale` is a register
 * entry whose module no longer has a dynamic import at all. They are returned apart because they are
 * opposite defects and a single message path renders one of them as a contradiction — measured at the
 * pre-commit checkpoint, which forced the stale case and read "carries no dynamic import — stale entry"
 * inside a sentence beginning "carries a dynamic `import(` this rail cannot follow".
 */
export function dynamicImportRegister(report) {
    const unaccounted = [];
    const stale = [];
    for (const name of report.shipped) {
        let source;
        try {
            source = fs.readFileSync(path.join(report.root, "cli", name), "utf8");
        } catch (error) {
            // A shipped module this rail cannot read is could-not-run, never a finding about its
            // imports — the same rule `classify`'s `read` follows, which this function had bypassed.
            throw new CannotRun(`cli/${name} could not be read — ${error.code ?? error.message}`);
        }
        const has = hasDynamicImport(source);
        if (has && !(name in ACCOUNTED_DYNAMIC_IMPORTS)) unaccounted.push(name);
        if (!has && name in ACCOUNTED_DYNAMIC_IMPORTS) stale.push(name);
    }
    return { unaccounted, stale };
}

export function run(argv, stdout = process.stdout, stderr = process.stderr) {
    const root = argv.find((a) => !a.startsWith("-")) ?? process.cwd();
    const json = argv.includes("--json");

    // Both calls can refuse, and both refusals are could-not-run. An earlier cut wrapped only
    // `classify`, so a read failure in the register crashed past the contract this file documents.
    let report;
    let unaccounted;
    let stale;
    let red;
    try {
        report = classify(root);
        ({ unaccounted, stale } = dynamicImportRegister(report));
        red = findings(report);
    } catch (error) {
        if (error instanceof CannotRun) {
            stderr.write(`payload: could not run — ${error.message}\n`);
            return 2;
        }
        throw error;
    }
    for (const name of unaccounted) {
        red.push(
            `cli/${name} carries a dynamic \`import(\` this rail cannot follow and ACCOUNTED_DYNAMIC_IMPORTS does ` +
                `not name — refusing rather than walking past it. Say what its subject is, or make the edge static`,
        );
    }
    for (const name of stale) {
        red.push(
            `ACCOUNTED_DYNAMIC_IMPORTS names cli/${name}, which no longer carries a dynamic \`import(\` — a register ` +
                `entry outliving its subject is the drift this rail exists to refuse. Drop the entry`,
        );
    }

    if (json) {
        stdout.write(`${JSON.stringify({ classes: Object.fromEntries(report.classes), findings: red }, null, 2)}\n`);
        return red.length ? 1 : 0;
    }

    if (red.length) {
        for (const line of red) stderr.write(`  ✗ ${line}\n`);
        stderr.write(`\npayload — ${red.length} finding(s) across ${report.shipped.length} shipped cli module(s).\n`);
        return 1;
    }

    const tally = new Map();
    for (const cls of report.classes.values()) tally.set(cls, (tally.get(cls) ?? 0) + 1);
    const shape = [...tally].sort().map(([k, v]) => `${v} ${k}`).join(" · ");
    stdout.write(`ok  payload — all ${report.shipped.length} shipped cli module(s) classified: ${shape}\n`);
    stdout.write(
        `    ${UNRULED.modules.length} are UNRULED and the class is frozen — ` +
            `https://github.com/sleepy-panda-srl/portulan/issues/${UNRULED.issue} holds the question open, and this green is not its answer\n`,
    );
    return 0;
}

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

// `process.exitCode` rather than `process.exit`, per `./control-chars.mjs`: exiting outright can
// truncate a pipe that has not drained, and a truncated line IS exit 0 with no output.
if (isMain()) process.exitCode = run(process.argv.slice(2));

export { CannotRun };
