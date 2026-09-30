#!/usr/bin/env node
// Every `cli/*.mjs` the npm payload carries is classified, and nothing arrives in it unclassified.
//
// Exit 0 every shipped module classified, every disposition live · 1 a finding · 2 could not run: npm pack, git or a read failed.

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

/** Tracked modules that do not ship, each with its reason: the package ships the product, not the workshop. */
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
    "warm.mjs":
        "the warm-start A/B runner: it starts real sessions on this repository's own tasks, and whether an " +
        "adopter's A/B ships with the adopter path is that change's to rule, not this one's",
    "payload.mjs":
        "this rail. Its subject is this repository's own publish surface, which is the argument that " +
        "excluded the A/B rig — self-exclusion on `./eval-bundle.mjs`'s precedent, decided when it was " +
        "written rather than after a totality check demanded a class for it",
    "roster.mjs":
        "the generator of this directory's README. The page ships as a file; the tool that renders it " +
        "from this repository's own tree is workshop tooling",
};

/** Shipped modules nothing the package exposes reaches, ruled to ship anyway, each with its ground. */
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
    "finish.mjs":
        "the finishing command, which closes a change in one call: every recipe on the commit it makes, the " +
        "changelog fragment, the commit and the push. Product under the same 2026-08-24 rule — *the tool is " +
        "product and the policy it reads is this team's* — since the recipes it runs are the workspace's own; " +
        "adopters reach it through the card `init` drafts (the coordinator session's delegated call of 2026-09-24)",
};

/** Shipped modules nothing the package exposes reaches, on which nobody has ruled: frozen, so none may join. */
export const UNRULED = {
    issue: 383,
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

/** Each shipped module's dynamic `import(`, which the static walk cannot follow, and why it adds no `cli/` edge. */
export const ACCOUNTED_DYNAMIC_IMPORTS = {
    "portulan.mjs": "the dispatcher's own loader; its subjects are `SUBCOMMANDS`' modules, read below",
    "init.mjs": "a literal node builtin (`node:readline/promises`)",
    "upgrade.mjs": "a workspace's migration module, resolved under the workspace and never under `cli/`",
    "mutants.mjs": "a mutant file this tool wrote itself, and the compiler module under test",
    "instructions.mjs":
        "`./context.mjs` and `./upgrade.mjs`, loaded when the command runs because each reaches this module " +
        "statically and an edge back would close a cycle: `upgrade.mjs` is a `SUBCOMMANDS` module, read below, " +
        "and `context.mjs` is imported statically by `doctor.mjs`, another",
};

/** The `./x.mjs` modules a source imports; the walk neither follows nor refuses an edge into a subdirectory or a parent. */
export function edgesOf(source) {
    const edges = new Set();
    for (const m of source.matchAll(/(?:^|\n)\s*(?:import|export)\b[^;]*?from\s*["']\.\/([^"']+)["']/g)) {
        edges.add(m[1]);
    }
    for (const m of source.matchAll(/(?:^|\n)\s*import\s*["']\.\/([^"']+)["']/g)) edges.add(m[1]);
    return edges;
}

export function hasDynamicImport(source) {
    return source
        .split("\n")
        .some((line) => /(?:^|[^.\w])import\s*\(/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line));
}

export function classify(root) {
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    } catch (error) {
        throw new CannotRun(`package.json could not be read — ${error.code ?? error.message}`);
    }

    // `./pack-identity.mjs` throws its own `CannotRun`, which this file's `instanceof` does not match.
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

    // npm's `bin` may be a bare string, and `Object.values` of a string is its characters.
    const declaredBin = manifest.bin ?? {};
    const binPaths = typeof declaredBin === "string" ? [declaredBin] : Object.values(declaredBin);
    const binTargets = new Set(
        binPaths
            .filter((v) => typeof v === "string" && v.startsWith("cli/"))
            .map((v) => v.slice("cli/".length)),
    );
    const dispatched = new Set(SUBCOMMANDS.map((s) => s.module).filter(Boolean));
    const runners = new Set(HOOK_RUNNERS);

    const shippedSet = new Set(shipped);
    const dangling = [];
    const seen = new Set();
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
        // `tracked` holds only `cli/*.mjs`, so a non-module entry is asked of the tree directly.
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

export function dynamicImportRegister(report) {
    const unaccounted = [];
    const stale = [];
    for (const name of report.shipped) {
        let source;
        try {
            source = fs.readFileSync(path.join(report.root, "cli", name), "utf8");
        } catch (error) {
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

// `process.exitCode` rather than `process.exit`, so a pipe that has not drained is not cut short.
if (isMain()) process.exitCode = run(process.argv.slice(2));

export { CannotRun };
