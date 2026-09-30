#!/usr/bin/env node
// Grade this workspace's compiled gates against a corpus of adversarial fixtures.
//
// Exit 0 green · 1 red · 2 could not run.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
    CompileError,
    READ_TOOLS,
    WRITE_TOOLS,
    composeFragments,
    matchesRule,
    packContributions,
    parse,
    policyDeclaration,
    resolveWorkspace,
    unreadableManifest,
} from "./compile.mjs";

export const CORPUS_DIR = "evals/goldens/gates";

export const MATCHABLE = ["shell", "write", "read"];

/** `holds`: the matcher catches the case and must keep catching it; `documented-hole`: it does not, as the gate map records. */
export const CLASSES = ["holds", "documented-hole"];

/** The branch of `matchesRule` a case takes, since two branches segment a command differently. */
export const PATHS = ["matchesPath", "shell-write", "shell-prefix", "no-branch"];

/** `no-branch`: a kind and tool the matcher has no code for, such as `Bash` against a `read:` rule. */
export function matcherPath(kind, tool) {
    if (kind === "shell") return tool === "Bash" ? "shell-prefix" : "no-branch";
    if (kind === "write") {
        if (WRITE_TOOLS.includes(tool)) return "matchesPath";
        return tool === "Bash" ? "shell-write" : "no-branch";
    }
    if (kind === "read") return READ_TOOLS.includes(tool) ? "matchesPath" : "no-branch";
    return "no-branch";
}

export class CouldNotRun extends Error {}

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

/** Composed before `parse`, as `compile` does, so a pack's fragment is graded like a hand-written rule. */
export function yieldedRules(named, { packRoots = null } = {}) {
    const { workspaceRoot, workspaceDir } = resolveWorkspace(named);
    const unreadable = unreadableManifest(workspaceRoot, workspaceDir);
    if (unreadable !== null) {
        throw new CouldNotRun(
            `${unreadable.file} is not a manifest this tool can read: ${unreadable.why}. Read as one declaring nothing, ` +
                `it would have fixtures graded against a \`gates.json\` found by convention, which it may not name. ` +
                `There is nothing to grade fixtures against`,
        );
    }
    const { file: policyFile, declared, reason } = policyDeclaration(workspaceRoot, workspaceDir);
    if (reason === "refused" || (!declared && !fs.existsSync(policyFile))) {
        const why =
            reason === "no-manifest"
                ? `there is no ${workspaceDir}/workspace.json, so nothing here has been authored as a workspace yet`
                : reason === "refused"
                  ? `${workspaceDir}/workspace.json DOES name a gate policy, and it was refused — the manifest is not at fault, the path it names is`
                  : `${workspaceDir}/workspace.json declares no \`gates\` key, which is a legitimate shape and means the policy is expected at the default path`;
        const head =
            reason === "refused" && fs.existsSync(policyFile)
                ? `the \`gates.json\` at ${policyFile} is not the gate policy the manifest names`
                : `no gate policy at ${policyFile}`;
        throw new CouldNotRun(`${head}: ${why}. There is nothing to grade fixtures against`);
    }
    const policy = readJson(policyFile, "the gate policy");
    // Never the host's plugin cache: a rail that consulted it would grade the machine, not the tree.
    const { contributions, unresolved } = packContributions(workspaceRoot, workspaceDir, {
        ...(packRoots === null ? { named: [] } : { packRoots }),
        discovery: null,
        forced: false,
    });
    const composed = composeFragments(policy, contributions);
    return { workspaceRoot, rules: parse(composed.policy).rules, unresolved };
}

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
        if (name !== `${doc.rule}.json`) {
            throw new CouldNotRun(
                `${where} declares rule \`${doc.rule}\` — one fixture file per rule, named for it, so rename it to ` +
                    `${dir}/${doc.rule}.json or correct the \`rule\` field. A misfiled corpus grades correctly and ` +
                    `reviews badly, which is the worse of the two`,
            );
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
            if (!PATHS.includes(c?.path)) {
                throw new CouldNotRun(`${at} declares path ${JSON.stringify(c?.path)} — one of ${PATHS.join(" / ")}`);
            }
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

export function grade(rules, corpus) {
    const { matchable, exempt } = partition(rules);
    const byId = new Map(matchable.map((r) => [r.id, r]));
    const covered = new Set();
    const findings = [];
    const byPath = new Map();
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
            const derived = matcherPath(rule.kind, c.tool);
            byPath.set(derived, (byPath.get(derived) ?? 0) + 1);
            if (c.path !== derived) {
                findings.push({
                    where: `${where} → ${c.id}`,
                    what:
                        `declares path \`${c.path}\` and \`matchesRule\` takes \`${derived}\` for a ` +
                        `${rule.kind}: rule reached through ${c.tool}. The path is derived from the action kind and the ` +
                        `tool, so this is a mislabel rather than a disagreement — correct the case`,
                });
                continue;
            }
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
                `\`${rule.id}\` (${rule.tier}, a \`${rule.kind}:\` rule) compiles to a matcher and no fixture attacks it. ` +
                `Coverage is measured, not named — add ${CORPUS_DIR}/${rule.id}.json with at least one case`,
        });
    }

    return { findings, cases, matchable, exempt, covered, byPath };
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
    // First, so `--help` is answered whatever else the command line holds.
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
                // A value starting with `-` is a flag, not a path; a directory so named is `./-name`.
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
        const { findings, cases, matchable, exempt, byPath } = grade(rules, corpus);

        for (const u of unresolved) say(`pack    ${u.name} UNRESOLVED — ${u.why}; its gate fragments are not in this census`);

        say(`goldens: ${cases} case(s) over ${matchable.length} matchable rule(s) in ${corpus.length} fixture file(s)`);
        say(`goldens: by matcher path — ${PATHS.map((p) => `${p} ${byPath.get(p) ?? 0}`).join(" · ")}`);
        // Printed on every run, so the exemption cannot become a quiet way out of fixtures.
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
        say("goldens: this is a PRESENCE floor — whether a corpus is a real attack is a reviewer's judgement, not this rail's");
        return 0;
    } catch (error) {
        if (error instanceof CouldNotRun || error instanceof CompileError) {
            stderr.write(`goldens: ${error.message}\n`);
            return 2;
        }
        // An unexpected throw exits 2, never 1: a crash is not a verdict on the corpus.
        stderr.write(`goldens: could not finish grading — ${error?.stack ?? error}\n`);
        return 2;
    }
}

// URLs on both sides, since `import.meta.url` percent-encodes; the realpath covers a symlinked `bin`.
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

// `exitCode`, not `exit()`: exiting outright can cut off output a pipe has not drained.
if (isMain()) process.exitCode = run(process.argv.slice(2));
