#!/usr/bin/env node
// Grade this workspace's compiled gates against a corpus of adversarial fixtures.
//
// Milestone 8, clause (a): *golden tasks reach the gates as well as the skills, so a matcher ships
// with the attack cases that prove its coverage instead of prose describing it.*
//
// ## What this is FOR, at its real size
//
// `../.portulan/gate-map.md` carries an honest-holes list. That list was wrong when first published —
// four items, five missing, the plainest of them a newline — and it was corrected by a supervisor who
// tried to DEFEAT the matcher rather than read it. Fourteen review rounds then found three more live
// bypasses the attack pass itself had not tried. Eight in all, every one found after the gate was
// called done.
//
// A hole list is a claim like any other, and the only thing that checks it is somebody attacking it.
// This runner is where those attacks live so they are re-run on every commit instead of on the day
// somebody happens to look.
//
// ## The two things it rails, and the one it does NOT
//
//   1. **Coverage is measured, not named.** A rule that compiles to a matcher and carries no fixture
//      is RED. So a new gate cannot ship with prose standing in for attack cases — the failure
//      `../.portulan/memory/a-checkers-coverage-is-measured-not-named.md` names, turned into a check.
//   2. **A documented hole stays documented in BOTH directions.** A `documented-hole` case asserts the
//      matcher's CURRENT behaviour and names the hole record it belongs to. If the hole silently
//      closes, that case goes red too — because a hole list that still lists a closed hole is as wrong
//      as one that hides an open one, which is a sentence the gate map has had to write about itself.
//
// **What it does not rail: adequacy.** This is a PRESENCE floor. One trivial happy-path fixture per
// rule satisfies clause 1 while proving nothing adversarial, and no check here can tell the
// difference — judging whether a corpus is a real attack is exactly the judgement a reviewer is for.
// Written down rather than left to be discovered, because a rail whose limit is unstated gets read as
// the guarantee it is not. What the floor buys is narrower and still worth having: a gate cannot reach
// the compiled policy with NO adversarial thought recorded against it at all.
//
// ## How a case is graded — and what is deliberately never done to it
//
// Every case is answered by `./compile.mjs`'s own exported `matchesRule`, the same function
// `./gate.mjs` calls at hook time. Never a re-implementation: "two implementations of one matcher is
// the drift this repository keeps finding, and a *matcher* that drifts does not look wrong — it looks
// like a matcher" (`./compile.mjs`).
//
// **A fixture's command string is DATA and is never executed.** The corpus contains
// `git push --force`, `rm -rf docs` and constitution-write spellings by design — running one would be
// somewhere between tripping the gate under test and destroying the tree it runs in. There is no code
// path from a fixture to a subprocess, and `./goldens.test.mjs` asserts that this module spawns
// nothing at all.
//
// ## Which policy it grades
//
// The one the workspace YIELDS — its own `gates.json` plus the fragments its composed packs
// contribute — never the declared file alone. A rail scoped to the declared list would let a composed
// gate ship with no fixtures while this check stayed green, which is the class `../.portulan/dod.md`
// condition 1 names in so many words and `./gate.mjs` already had repaired.
//
// Resolution is HERMETIC: no host plugin-cache discovery, ever. `compile --matrix` without a pinned
// root refuses on this maintainer's machine as SHADOWED — an installed cache copy at one version
// against the tree's at another — so a runner that consulted the host would grade the machine rather
// than the tree, and its verdict would move with what happens to be installed. The recipe names its
// root as well, on the pin discipline `../.portulan/verify/compile.sh` and `./pinned-roots.live.test.mjs`
// already hold the compiler to.
//
// Exit 0 green · 1 red · 2 could not run.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CompileError, composeFragments, matchesRule, packContributions, parse, policyDeclaration, resolveWorkspace } from "./compile.mjs";

/** Where the corpus lives, relative to the repository root. */
export const CORPUS_DIR = "evals/goldens/gates";

/** The action kinds `matchesRule` can answer for. A rule shaped otherwise has no matcher to attack. */
export const MATCHABLE = ["shell", "write", "read"];

/**
 * The two case classes, and why there are exactly two.
 *
 * `holds` is a regression pin: the matcher catches this today and must keep catching it. Every one of
 * the eight bypasses found on #60 is one of these — they are CLOSED holes, and the corpus exists so
 * they cannot quietly re-open.
 *
 * `documented-hole` is the other direction: the matcher does NOT catch this, the gate map says so, and
 * the case exists to keep that admission true. A third class for "we hope this gets fixed" was
 * considered and refused — it would be a wish, and a wish that goes green when someone fixes it is
 * indistinguishable from a hole that closed without its record being updated.
 */
export const CLASSES = ["holds", "documented-hole"];

export class CouldNotRun extends Error {}

/** Read one JSON file, or say which file and why not. */
function readJson(file, what) {
    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    } catch (cause) {
        throw new CouldNotRun(`${what} at ${file} cannot be read — ${cause.code ?? cause.message}`);
    }
    try {
        return JSON.parse(text);
    } catch (cause) {
        throw new CouldNotRun(`${what} at ${file} is not valid JSON — ${cause.message}`);
    }
}

/**
 * The rules this workspace yields, parsed.
 *
 * Composition runs BEFORE `parse`, exactly as `compile` does it, so a pack's fragment is graded by the
 * same code that grades a hand-written rule. Following the compiler's order rather than inventing one
 * is the whole reason this function is four lines of plumbing and no judgement.
 */
export function yieldedRules(named, { packRoots = null } = {}) {
    const { workspaceRoot, workspaceDir } = resolveWorkspace(named);
    const { file: policyFile, declared } = policyDeclaration(workspaceRoot, workspaceDir);
    if (!declared && !fs.existsSync(policyFile)) {
        throw new CouldNotRun(
            `no gate policy at ${policyFile}, and ${workspaceDir}/workspace.json declares none — there is nothing to grade fixtures against`,
        );
    }
    const policy = readJson(policyFile, "the gate policy");
    // `discovery: null` and `forced: false`, always. See the header: a rail that consults the host
    // grades the host.
    const { contributions, unresolved } = packContributions(workspaceRoot, workspaceDir, {
        ...(packRoots === null ? { named: [] } : { packRoots }),
        discovery: null,
        forced: false,
    });
    const composed = composeFragments(policy, contributions);
    return { workspaceRoot, rules: parse(composed.policy).rules, unresolved };
}

/**
 * Split the yielded rules into the ones a fixture can attack and the ones it cannot.
 *
 * A rule whose action is `none` has no tool-level surface at all — `spend-money-or-register-a-domain`
 * and `send-something-outside-this-repository` are the standing examples, and both say so in their own
 * `action.none` prose. There is no input to hand `matchesRule` for them, so requiring fixtures would be
 * requiring a test of nothing.
 *
 * **They are named in the output on every run regardless**, and that is the load-bearing half. The
 * exemption is the obvious way to dodge this rail — write the next gate `none`-shaped and it needs no
 * attack cases — so the census prints them the way `compile --matrix` prints its own refused rules,
 * rather than letting the exemption be silent.
 */
export function partition(rules) {
    const matchable = [];
    const exempt = [];
    for (const rule of rules) {
        const kind = MATCHABLE.find((k) => typeof rule.action?.[k] === "string");
        if (kind) matchable.push({ ...rule, kind });
        else exempt.push({ ...rule, why: Object.keys(rule.action ?? {}).join(", ") || "no action" });
    }
    return { matchable, exempt };
}

/** Every fixture file in the corpus, read and shape-checked. */
export function readCorpus(repoRoot, dir = CORPUS_DIR) {
    const base = path.join(repoRoot, dir);
    let names;
    try {
        names = fs.readdirSync(base).filter((n) => n.endsWith(".json")).sort();
    } catch (cause) {
        throw new CouldNotRun(`the fixture corpus at ${base} cannot be read — ${cause.code ?? cause.message}`);
    }
    const files = [];
    for (const name of names) {
        const file = path.join(base, name);
        const doc = readJson(file, "a fixture file");
        const where = `${dir}/${name}`;
        if (typeof doc.rule !== "string" || doc.rule === "") {
            throw new CouldNotRun(`${where} names no \`rule\` — a fixture file attacks exactly one rule and must say which`);
        }
        if (!Array.isArray(doc.cases) || doc.cases.length === 0) {
            throw new CouldNotRun(`${where} carries no \`cases\` — an empty fixture file is coverage that is not there`);
        }
        for (const [i, c] of doc.cases.entries()) {
            const at = `${where} case ${i} (${c?.id ?? "unnamed"})`;
            if (typeof c?.id !== "string" || c.id === "") throw new CouldNotRun(`${at} has no \`id\``);
            if (!CLASSES.includes(c?.class)) {
                throw new CouldNotRun(`${at} declares class ${JSON.stringify(c?.class)} — one of ${CLASSES.join(" / ")}`);
            }
            if (typeof c?.tool !== "string" || c.tool === "") throw new CouldNotRun(`${at} names no \`tool\``);
            if (typeof c?.expect !== "boolean") throw new CouldNotRun(`${at} declares no boolean \`expect\``);
            if (typeof c?.why !== "string" || c.why.trim() === "") {
                throw new CouldNotRun(`${at} carries no \`why\` — an attack case nobody can read is not reviewable`);
            }
            if (c.class === "documented-hole" && (typeof c.hole !== "string" || c.hole.trim() === "")) {
                throw new CouldNotRun(`${at} is a documented-hole and names no \`hole\` — the record it keeps true is the point of the class`);
            }
            if (c.input === null || typeof c.input !== "object" || Array.isArray(c.input)) {
                throw new CouldNotRun(`${at} declares no \`input\` object`);
            }
        }
        files.push({ where, doc });
    }
    return files;
}

/**
 * Grade the corpus against the rules. Returns findings; the caller decides what they cost.
 *
 * Every finding names the file, the case and the repair. A red that does not say what to do about it
 * costs a reader the same time twice.
 */
export function grade(rules, corpus) {
    const { matchable, exempt } = partition(rules);
    const byId = new Map(matchable.map((r) => [r.id, r]));
    const covered = new Set();
    const findings = [];
    let cases = 0;

    for (const { where, doc } of corpus) {
        const rule = byId.get(doc.rule);
        if (!rule) {
            const isExempt = exempt.some((e) => e.id === doc.rule);
            findings.push({
                where,
                what: isExempt
                    ? `attacks \`${doc.rule}\`, which declares no matchable action — it has no tool-level surface, so there is nothing to attack. Delete the file, or give the rule an action a matcher can read`
                    : `attacks \`${doc.rule}\`, which the yielded policy does not declare. Either the rule was renamed and this file was not, or the fixture outlived its gate`,
            });
            continue;
        }
        covered.add(rule.id);
        for (const c of doc.cases) {
            cases += 1;
            // The one call that matters, and it is the compiler's own. Never re-implemented here.
            const actual = matchesRule(rule, c.tool, c.input);
            if (actual === c.expect) continue;
            findings.push({
                where: `${where} → ${c.id}`,
                what:
                    c.class === "holds"
                        ? `REGRESSION: \`${rule.id}\` used to answer ${c.expect} for this and now answers ${actual}. ${c.why}`
                        : `the documented hole \`${c.hole}\` has MOVED: this case expects ${c.expect} and the matcher answers ${actual}. ` +
                          `If the hole closed, that is good news and the record must say so — update ${c.hole}, then change this case to \`holds\`. ` +
                          `A hole list that still lists a closed hole is as wrong as one that hides an open one`,
            });
        }
    }

    for (const rule of matchable) {
        if (covered.has(rule.id)) continue;
        findings.push({
            where: `${CORPUS_DIR}/`,
            what:
                `\`${rule.id}\` (${rule.tier}, ${rule.kind}:) compiles to a matcher and no fixture attacks it. ` +
                `Coverage is measured, not named — add ${CORPUS_DIR}/${rule.id}.json with at least one case`,
        });
    }

    return { findings, cases, matchable, exempt, covered };
}

function usage() {
    return [
        "usage: node cli/goldens.mjs [--check] [--workspace <dir>] [--pack-root <dir>]",
        "",
        "  Grades evals/goldens/gates/ against the gate policy the workspace YIELDS.",
        "  --check is the default and the only mode; the flag is accepted so the recipe reads",
        "  like its siblings.",
        "",
        "  Exit 0 green · 1 red · 2 could not run.",
    ].join("\n");
}

export function run(argv = [], { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
    const say = (line = "") => stdout.write(`${line}\n`);
    // Before every other argument decision, so asking for help cannot be outranked by a complaint
    // about the rest of the command line — the contract `./portulan.mjs` states.
    if (argv.includes("--help") || argv.includes("-h")) {
        say(usage());
        return 0;
    }
    let named = cwd;
    let packRoots = null;
    try {
        for (let i = 0; i < argv.length; i += 1) {
            if (argv[i] === "--check") continue;
            if (argv[i] === "--workspace") {
                named = argv[i + 1];
                i += 1;
                if (named === undefined) throw new CouldNotRun("--workspace needs a directory");
            } else if (argv[i] === "--pack-root") {
                const root = argv[i + 1];
                i += 1;
                // A single leading `-` is refused too, the way `compile` and `doctor` refuse it:
                // `--pack-root -h` would otherwise be consumed as a path and fail later as an
                // unreadable one. A directory genuinely named `-name` is `./-name`.
                if (root === undefined || root.startsWith("-")) throw new CouldNotRun("--pack-root needs a directory");
                let stat = null;
                try {
                    stat = fs.statSync(root);
                } catch (cause) {
                    throw new CouldNotRun(`--pack-root ${root} cannot be read — ${cause.code ?? cause.message}`);
                }
                if (!stat.isDirectory()) throw new CouldNotRun(`--pack-root ${root} is not a directory`);
                (packRoots ??= []).push(path.resolve(root));
            } else throw new CouldNotRun(`unknown argument ${JSON.stringify(argv[i])}`);
        }

        const { workspaceRoot, rules, unresolved } = yieldedRules(named, { packRoots });
        const corpus = readCorpus(workspaceRoot);
        const { findings, cases, matchable, exempt } = grade(rules, corpus);

        // An unresolved pack is a declaration the workspace believes it composed, so its fragments are
        // absent from the denominator and this run's coverage claim is narrower than it looks. Printed
        // before the verdict, for the reason `compile` prints it there.
        for (const u of unresolved) say(`pack    ${u.name} UNRESOLVED — ${u.why}; its gate fragments are not in this census`);

        say(`goldens: ${cases} case(s) over ${matchable.length} matchable rule(s) in ${corpus.length} fixture file(s)`);
        // The exemption, named on every run — see `partition`.
        if (exempt.length) {
            say(`goldens: ${exempt.length} rule(s) declare no matchable action and are exempt from fixtures:`);
            for (const e of exempt) say(`           ${e.id} (${e.tier}, ${e.why})`);
        }

        if (findings.length) {
            for (const f of findings) stderr.write(`goldens: ${f.where}\n           ${f.what}\n`);
            stderr.write(`RED — ${findings.length} finding(s) in the gate corpus\n`);
            return 1;
        }
        say("GREEN — every matchable gate carries fixtures, and every case answers as recorded");
        // Said out loud rather than implied by the green, because the limit is the half a reader
        // otherwise supplies wrongly. See the header.
        say("goldens: this is a PRESENCE floor — whether a corpus is a real attack is a reviewer's judgement, not this rail's");
        return 0;
    } catch (error) {
        if (error instanceof CouldNotRun || error instanceof CompileError) {
            stderr.write(`goldens: ${error.message}\n`);
            return 2;
        }
        throw error;
    }
}

// The entry guard, in the ONE form `./rule-carriers.mjs` designates after this repository got it wrong
// twice. `file://${argv[1]}` is NOT that form: `import.meta.url` percent-encodes, this working copy
// lives under a path with spaces, and the comparison fails — so the tool exits 0 having run nothing.
// **A green that is the tool never starting.** This file shipped that spelling for exactly one
// measurement: the first run of `node cli/goldens.mjs` printed nothing and exited 0, on a corpus that
// did not exist yet and against a policy nothing had read. The third time this repository has met it,
// and the reason the designated form is copied rather than re-derived.
//
// The realpath fallback covers the symlink case an npm `bin` produces, in a `try` because a missing
// path must answer no rather than throw.
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

// `process.exitCode` rather than `process.exit`, which `./control-chars.mjs` settled for this
// repository: exiting outright can truncate a pipe that has not drained — and a truncated line IS exit
// 0 with no output, the precise shape of the false green the guard above was fixed for.
if (isMain()) process.exitCode = run(process.argv.slice(2));
