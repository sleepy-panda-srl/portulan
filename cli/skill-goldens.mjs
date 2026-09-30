#!/usr/bin/env node
// The core-skill golden corpus — every mandate a core skill states, bound to the live artifacts it governs, and graded.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// The carriers' own exports, never a second spelling of their checks.
import { RETIRE_WHEN, parseProvenance } from "./doctor.mjs";

export const CASE_KINDS = ["load-bearing", "census"];
export const UNBINDABLE_REASONS = ["judgement-only", "no-artifact", "cross-language", "already-carried"];

// Prefix-matched, as three spellings exist; anchored, as a bare `pass` matches another `consolidate` heading.
const PASS_HEADING = /^##\s+The pass\b/i;
// On the number alone, the bold read separately, so an unbolded step still counts.
const STEP = /^(\d+)\.\s+(.*)$/;

export class CouldNotRun extends Error {}

export function skillSet(repoRoot) {
    const dir = path.join(repoRoot, "core/skills");
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        throw new CouldNotRun(`core/skills/ could not be read — ${e.message}`);
    }
    const skills = entries
        .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "SKILL.md")))
        .map((d) => d.name)
        .sort();
    if (skills.length === 0) throw new CouldNotRun("core/skills/ holds no SKILL.md — nothing to grade");
    return skills;
}

export function passSteps(repoRoot, skill) {
    const file = path.join(repoRoot, "core/skills", skill, "SKILL.md");
    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    } catch (e) {
        throw new CouldNotRun(`${skill}: SKILL.md could not be read — ${e.message}`);
    }
    let inPass = false;
    const steps = [];
    for (const line of text.split("\n")) {
        if (/^##\s/.test(line)) {
            inPass = PASS_HEADING.test(line);
            continue;
        }
        if (!inPass) continue;
        const m = STEP.exec(line);
        if (m) {
            const bolded = /^\*\*(.+?)\*\*/.exec(m[2]);
            steps.push({ n: Number(m[1]), title: bolded ? bolded[1] : m[2] });
        }
    }
    if (steps.length === 0) {
        throw new CouldNotRun(
            `${skill}: no numbered steps found under a '## The pass' heading. ` +
                "An empty denominator would satisfy every coverage rule vacuously, so it is refused.",
        );
    }
    return steps;
}

export function anchorQuote(repoRoot, skill, quote) {
    const text = fs.readFileSync(path.join(repoRoot, "core/skills", skill, "SKILL.md"), "utf8");
    let count = 0;
    let i = text.indexOf(quote);
    while (i !== -1) {
        count += 1;
        i = text.indexOf(quote, i + 1);
    }
    if (count !== 1) {
        throw new CouldNotRun(
            `${skill}: the mandate quote places ${count} time(s) in SKILL.md, not once — ` +
                `${JSON.stringify(quote.slice(0, 60))}`,
        );
    }
}

export function slotFiles(workspaceDir, manifest, slot) {
    const rel = manifest?.slots?.[slot];
    if (typeof rel !== "string" || rel.length === 0) {
        throw new CouldNotRun(`the workspace declares no '${slot}' slot — this case has nothing to grade`);
    }
    const dir = path.join(workspaceDir, rel);
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (e) {
        throw new CouldNotRun(`slot '${slot}' points at ${rel}, which could not be read — ${e.message}`);
    }
    const files = names.filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md").sort();
    if (files.length === 0) {
        throw new CouldNotRun(`slot '${slot}' (${rel}) holds no records — a green over zero files is not a rail`);
    }
    return files.map((f) => ({ name: f, path: path.join(dir, f) }));
}

// ---------------------------------------------------------------------------------------------
// The predicates
// ---------------------------------------------------------------------------------------------

export function fieldBlock(text, field) {
    const lines = text.split("\n");
    const start = lines.findIndex((l) => new RegExp(`^\\s*\\*\\*${field}\\.?\\*\\*`, "i").test(l));
    if (start === -1) return null;
    const out = [];
    for (let i = start + 1; i < lines.length; i += 1) {
        if (/^\s*\*\*[A-Z]/.test(lines[i]) || /^##\s/.test(lines[i])) break;
        out.push(lines[i]);
    }
    return out.join("\n");
}

export function bulletsOf(block) {
    const out = [];
    for (const line of block.split("\n")) {
        if (/^\s*[-*]\s/.test(line)) out.push(line.replace(/^\s*[-*]\s*(\[[ xX]\]\s*)?/, "").trim());
        else if (out.length > 0 && line.trim()) out[out.length - 1] += ` ${line.trim()}`;
    }
    return out.filter(Boolean);
}

// A reduction of EARS as `core/templates/task.md` states it; the template is the rule.
export const isEars = (b) => /\bwhen\b/i.test(b) && /\bshall\b/i.test(b);

export const PREDICATES = {
    "ears-acceptance-criteria": (text) => {
        const block = fieldBlock(text, "Acceptance criteria");
        if (block === null) return { ok: false, why: "no **Acceptance criteria.** section" };
        const bs = bulletsOf(block);
        if (bs.length === 0) return { ok: false, why: "an Acceptance criteria section with no criteria" };
        const bad = bs.filter((b) => !isEars(b));
        return bad.length === 0
            ? { ok: true, total: bs.length }
            : { ok: false, why: `${bad.length} of ${bs.length} criteria are not EARS-shaped`, total: bs.length };
    },
    "enforcement-present": (text) => {
        const has = /^\s*\*\*Enforcement\.?\*\*/im.test(text) || /^##+\s+Enforcement/im.test(text);
        return has ? { ok: true } : { ok: false, why: "no enforcement field in any spelling" };
    },
    "provenance-present": (text) => {
        const has = /^\s*\*\*Provenance\.?\*\*/im.test(text) || /^##+\s+Provenance/im.test(text);
        return has ? { ok: true } : { ok: false, why: "no provenance field in any spelling" };
    },
    // Scoped to `type: rule`, the scope `doctor` enforces the two forms at.
    "provenance-two-form": (text) => {
        const type = (/^\s*\*\*type:\*\*\s*(\w+)/im.exec(text) || [])[1];
        if (type !== "rule") return { ok: true, skipped: "not a rule" };
        const p = parseProvenance(text);
        return p.present && p.fields ? { ok: true } : { ok: false, why: "a rule with no two-form provenance stamp" };
    },
    "retire-when-present": (text) =>
        RETIRE_WHEN.test(text) ? { ok: true } : { ok: false, why: "no **Retire when:** line" },
};

export function budgetIds(repoRoot) {
    const schema = JSON.parse(fs.readFileSync(path.join(repoRoot, "spec/workspace.schema.json"), "utf8"));
    const mem = schema.properties?.memory?.properties ?? {};
    const ids = [];
    for (const group of ["index", "store"]) {
        const props = mem[group]?.properties?.budget?.properties ?? {};
        for (const id of Object.keys(props)) ids.push(id);
    }
    if (ids.length === 0) throw new CouldNotRun("the schema declares no memory budget ids — nothing to contain");
    return ids.sort();
}

// ---------------------------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------------------------

function gradeBound(skill, c, ctx) {
    anchorQuote(ctx.repoRoot, skill, c.mandate.quote);

    if (c.predicate === "schema-budget-containment") {
        const ids = budgetIds(ctx.repoRoot);
        const text = fs.readFileSync(path.join(ctx.repoRoot, "core/skills", skill, "SKILL.md"), "utf8");
        const missing = ids.filter((id) => !text.includes(`\`${id}\``));
        return { total: ids.length, failing: missing, detail: `${ids.length - missing.length}/${ids.length} budget id(s) named` };
    }

    const predicate = PREDICATES[c.predicate];
    if (!predicate) throw new CouldNotRun(`${skill}: unknown predicate ${JSON.stringify(c.predicate)}`);
    const files = slotFiles(ctx.workspaceDir, ctx.manifest, c.artifacts.slot);
    const failing = [];
    let considered = 0;
    for (const f of files) {
        const answer = predicate(fs.readFileSync(f.path, "utf8"));
        if (answer.skipped) continue;
        considered += 1;
        if (!answer.ok) failing.push(`${f.name} — ${answer.why}`);
    }
    return { total: considered, failing, detail: `${considered - failing.length}/${considered} compliant` };
}

export function gradeSkill(skill, corpus, ctx) {
    const findings = [];
    const steps = passSteps(ctx.repoRoot, skill);
    const declared = new Map();
    for (const c of corpus.cases ?? []) {
        if (declared.has(c.step)) findings.push(`${skill}: step ${c.step} is declared twice`);
        declared.set(c.step, c);
    }
    for (const step of steps) {
        if (!declared.has(step.n)) {
            findings.push(
                `${skill}: step ${step.n} — "${step.title.slice(0, 60)}" — is in the skill's pass and in no case. ` +
                    "Every step is bound or adjudicated unbindable; a new step is a finding, not a default.",
            );
        }
    }
    // Step 0 is a mandate outside `## The pass`, such as `consolidate`'s routing sentence.
    for (const n of declared.keys()) {
        if (n !== 0 && !steps.some((s) => s.n === n)) {
            findings.push(`${skill}: case names step ${n}, which the pass does not have`);
        }
    }

    const rows = [];
    const graded = declared.has(0) ? [{ n: 0, title: "the routing sentence, outside `## The pass`" }, ...steps] : steps;
    for (const step of graded) {
        const c = declared.get(step.n);
        if (!c) continue;
        if (c.state === "unbindable") {
            if (!UNBINDABLE_REASONS.includes(c.reason)) {
                findings.push(`${skill}: step ${step.n} is unbindable for ${JSON.stringify(c.reason)}, which is not one of ${UNBINDABLE_REASONS.join(" | ")}`);
            }
            if (typeof c.why !== "string" || c.why.trim().length < 40) {
                findings.push(
                    `${skill}: step ${step.n} is unbindable and carries no argument. ` +
                        "The reason is a vocabulary term; the `why` is what makes it an adjudication.",
                );
            }
            if (c.reason === "judgement-only" && c.artifacts) {
                findings.push(
                    `${skill}: step ${step.n} claims judgement-only and names artifacts. ` +
                        "A mandate whose artifacts you can name is unbuilt, not unjudgeable.",
                );
            }
            rows.push({ step: step.n, state: "unbindable", reason: c.reason, kind: null });
            continue;
        }
        if (!CASE_KINDS.includes(c.kind)) {
            findings.push(`${skill}: step ${step.n} has kind ${JSON.stringify(c.kind)}, not one of ${CASE_KINDS.join(" | ")}`);
        }
        let result;
        try {
            result = gradeBound(skill, c, ctx);
        } catch (e) {
            if (e instanceof CouldNotRun) throw e;
            throw new CouldNotRun(`${skill}: step ${step.n} could not be graded — ${e.message}`);
        }
        const acceptedEntries = c.expect?.accepted ?? [];
        for (const a of acceptedEntries) {
            if (typeof a !== "object" || typeof a.file !== "string") {
                findings.push(`${skill}: step ${step.n} — an accepted-drift entry is not {file, why}: ${JSON.stringify(a)}`);
            } else if (typeof a.why !== "string" || a.why.trim().length < 20) {
                findings.push(
                    `${skill}: step ${step.n} — accepted drift ${a.file} carries no argument. ` +
                        "A silenced finding needs a reason a reviewer can refuse.",
                );
            }
        }
        const accepted = new Set(acceptedEntries.filter((a) => a && typeof a.file === "string").map((a) => a.file));
        const unexpected = result.failing.filter((f) => !accepted.has(f.split(" — ")[0]));
        const repaired = [...accepted].filter((a) => !result.failing.some((f) => f.split(" — ")[0] === a));
        for (const u of unexpected) findings.push(`${skill}: step ${step.n} — ${u}`);
        for (const r of repaired) {
            findings.push(
                `${skill}: step ${step.n} — ${r} now complies, and is still listed as accepted drift. ` +
                    "Remove it from `expect.accepted`; a drift list that outlives its drift is as wrong as one that hides it.",
            );
        }
        rows.push({ step: step.n, state: "bound", kind: c.kind, carrier: c.carrier?.tool ?? null, detail: result.detail, accepted: accepted.size });
    }
    return { skill, rows, findings };
}

const USAGE = [
    "usage: node cli/skill-goldens.mjs [--workspace <dir>] [--repo-root <dir>]",
    "",
    "Grades evals/goldens/skills/ against the core skills and the live artifacts they govern.",
    "exit 0 green · 1 red · 2 could not run",
].join("\n");

export function run(argv = process.argv.slice(2), io = console) {
  try {
    let repoRoot = ".";
    let workspaceDir = null;
    for (let i = 0; i < argv.length; i += 1) {
        const value = (flag) => {
            const v = argv[i + 1];
            if (v === undefined || v.startsWith("--")) throw new CouldNotRun(`${flag} needs a value`);
            i += 1;
            return v;
        };
        if (argv[i] === "--repo-root") repoRoot = value("--repo-root");
        else if (argv[i] === "--workspace") workspaceDir = value("--workspace");
        else if (argv[i] === "--help" || argv[i] === "-h") {
            io.log(USAGE);
            return 0;
        } else {
            io.error(`skill-goldens: unrecognised argument ${JSON.stringify(argv[i])}`);
            io.error(USAGE);
            return 2;
        }
    }
    repoRoot = path.resolve(repoRoot);
    workspaceDir = path.resolve(workspaceDir ?? path.join(repoRoot, ".portulan"));

    let ctx;
    let skills;
    try {
        ctx = { repoRoot, workspaceDir, manifest: JSON.parse(fs.readFileSync(path.join(workspaceDir, "workspace.json"), "utf8")) };
        skills = skillSet(repoRoot);
    } catch (e) {
        io.error(`skill-goldens: ${e.message}`);
        return 2;
    }

    const corpusDir = path.join(repoRoot, "evals/goldens/skills");
    const findings = [];
    const all = [];
    for (const skill of skills) {
        const file = path.join(corpusDir, `${skill}.json`);
        if (!fs.existsSync(file)) {
            findings.push(`${skill}: core/skills/${skill}/ exists and evals/goldens/skills/${skill}.json does not`);
            continue;
        }
        let corpus;
        try {
            corpus = JSON.parse(fs.readFileSync(file, "utf8"));
        } catch (e) {
            io.error(`skill-goldens: ${skill}.json is not JSON — ${e.message}`);
            return 2;
        }
        if (corpus.skill !== skill) {
            io.error(`skill-goldens: ${skill}.json declares skill ${JSON.stringify(corpus.skill)}`);
            return 2;
        }
        try {
            const graded = gradeSkill(skill, corpus, ctx);
            all.push(graded);
            findings.push(...graded.findings);
        } catch (e) {
            io.error(`skill-goldens: ${e.message}`);
            return 2;
        }
    }

    let bound = 0;
    let unbindable = 0;
    let loadBearing = 0;
    let census = 0;
    for (const g of all) {
        io.log(`skill-goldens: ${g.skill}`);
        for (const r of g.rows) {
            if (r.state === "bound") {
                bound += 1;
                if (r.kind === "load-bearing") loadBearing += 1;
                else census += 1;
                const acc = r.accepted > 0 ? `  (+${r.accepted} accepted drift)` : "";
                io.log(`  step ${r.step}  bound       ${String(r.kind).padEnd(12)} carrier ${String(r.carrier ?? "none").padEnd(7)} ${r.detail}${acc}`);
            } else {
                unbindable += 1;
                io.log(`  step ${r.step}  unbindable  ${r.reason}`);
            }
        }
    }

    io.log("");
    io.log(`  ${bound} of ${bound + unbindable} mandate(s) bound to live artifacts — ${loadBearing} load-bearing, ${census} census`);
    const reasons = {};
    for (const g of all) for (const r of g.rows) if (r.state === "unbindable") reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
    io.log(`  ${unbindable} adjudicated unbindable — ${Object.entries(reasons).map(([k, v]) => `${v} ${k}`).join(", ")}`);
    io.log("");
    io.log("  THE RATIO IS A FINDING, not bookkeeping: it measures how much of a core skill is artifact");
    io.log("  discipline and how much is agent judgement. Read the SPLIT, not the total — the");
    io.log("  judgement-only rows are the A/B clause's FIRST subject; cross-language and already-carried");
    io.log("  mean a carrier exists and is somewhere else.");
    io.log("  A `census` row re-indexes a figure an existing recipe already prints; it is not a new check.");
    io.log("  `unbindable` is the dodge, so its reason comes from a closed vocabulary and is adjudicated.");
    io.log("  `carrier` is a DECLARED, reviewed field. Nothing links it to a check: a corpus naming a");
    io.log("  module that does not exist still grades green, and a reviewer is what catches that.");
    io.log("  Presence, not adequacy: a mandate can be bound and the binding trivial.");
    io.log("  It grades a skill's MANDATES against the tree, never an agent's judgement in following one.");

    if (findings.length > 0) {
        io.error("");
        for (const f of findings) io.error(`  FAIL  ${f}`);
        io.error(`skill-goldens: ${findings.length} finding(s)`);
        return 1;
    }
    io.log("");
    io.log("GREEN — every core skill's mandates are accounted for and every binding holds.");
    return 0;
  } catch (e) {
    if (e instanceof CouldNotRun) {
        io.error(`skill-goldens: ${e.message}`);
        io.error(USAGE);
        return 2;
    }
    throw e;
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

if (isMain()) process.exitCode = run(process.argv.slice(2));
