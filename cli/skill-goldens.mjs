#!/usr/bin/env node
// The core-skill golden corpus — every mandate a core skill states, bound to the live artifacts it
// governs, and graded.
//
// Milestone 8, the row's **original first subject**: *Golden tasks per core skill.* Untouched by either
// amendment — the 2026-07-28 expansion says it "stands exactly as written", and clause (a) *widened its
// subject* to reach the gates "as well as the skills" without narrowing the subject it already had
// (`../docs/milestones/m08.md` line 18). The gates half landed at (a) as `./goldens.mjs`; this is the
// half that sentence always named and nobody had built.
//
// ## What a golden task IS here, and it was RULED rather than derived
//
// The criterion reads two ways — a deterministic corpus, or task specifications run against a live
// model — and `../.portulan/gate-map.md`'s *"Session-open runs `clarify` against the milestone row
// itself"* exists because milestone 4 guessed at exactly this shape of ambiguity and cost a
// session-blocking question. So it was put to the maintainer instead of argued. **His ruling: a
// deterministic corpus graded against LIVE ARTIFACTS in the tree.** The model-run sense belongs to the
// A/B clause, which is separately named in the same row.
//
// ## The object: a mandate, its live artifacts, and the carrier that enforces it
//
// A case binds one **numbered step** of one skill's `## The pass` to the artifact set it governs, and
// records which existing rail enforces it — or `null`, which is the interesting value.
//
// Four properties, and every one of them exists because a checkpoint found the version without it:
//
//  1. **The denominator is DERIVED, not chosen.** The runner enumerates the numbered steps under each
//     skill's `## The pass` heading and requires every one to be either `bound` or `unbindable`. A
//     fifteenth step is red. The first draft let the author pick which mandates to write cases for,
//     and a census over a set its own author drew reports "5 of 5" and means nothing — the difference
//     `./goldens.mjs` already draws by deriving its denominator from the yielded policy.
//  2. **The heading is PREFIX-matched, and an empty step list is could-not-run.** Three spellings exist
//     — `## The pass`, `## The pass (bounded)`, `## The pass, in order` — so an exact match finds one
//     skill of three and the other two get an empty denominator that satisfies "every step is bound"
//     vacuously. That is `../evals/README.md`'s own sentence about clause (d): *"a check whose
//     enumeration went empty … reports green and has stopped being a rail."* The match is also anchored
//     at `The pass`, because a loose `/pass/` grabs `consolidate`'s `## The one move this pass may not
//     make`.
//  3. **The quote must anchor EXACTLY ONCE** in the skill's own file, or the case is could-not-run —
//     `./mutants.mjs`'s discipline, adopted rather than re-derived. A skill whose wording is reworded,
//     softened or deleted reddens instead of drifting, and nothing in this tree did that before.
//  4. **The predicates use the carriers' own exported functions rather than re-spelling them.** This
//     module imports `RETIRE_WHEN` and `parseProvenance` from `./doctor.mjs`, so the retire-when check
//     is `doctor`'s regex and not a second one.
//
//     **What that does NOT do, stated because three carriers of this file's prose once said it did:**
//     it does not verify the `carrier` field. Nothing links `c.carrier.symbol` to an import — the
//     pre-commit checkpoint rewrote every carrier in a corpus file to a module that does not exist and
//     the corpus stayed green, and moved `.portulan/verify/index.sh` out of the tree with the same
//     result. `carrier` is a **declared, reviewed field**: it records which rail a mandate's enforcement
//     lives in, for the census, and a reviewer is what checks it. And a carrier that deleted an export
//     would fail this module's own import with a stack trace and exit **1**, not the 2 the earlier
//     sentence promised.
//
// ## What the carrier field does NOT establish, said here because a census implies more than it means
//
// An import proves the carrier **contains** the check. It does not prove the carrier **runs** it: a
// rail could keep `RETIRE_WHEN` exported, stop calling it, and this corpus would not notice, because
// `expect` is computed here over the artifacts rather than by asking the rail. Closing that needs a
// per-mandate drill — perturb a record, require the named rail to fire with its own tell — which is
// `./drills.mjs`'s shape at a finer grain and a second clause's work.
//
// ## `unbindable` is adjudicated, never asserted
//
// The dodge is obvious: call a mandate unbindable and it needs no case. So the reason takes a **closed
// vocabulary** rather than free prose, on `./mutants.mjs`'s rule that a `survives` record is admissible
// only as a proof and never as a standing note that a gap exists:
//
//   * `judgement-only`  — the mandate is about a human or agent decision and no artifact can witness it
//                         ("Get the answers from the human"). **Such a step may name no artifact path**:
//                         if you can name the artifacts, it is not judgement, it is unbuilt.
//   * `no-artifact`     — the mandate governs something that leaves no trace in this tree.
//   * `cross-language`  — a carrier exists but in another language, so binding it here would put two
//                         spellings of one rule across a language boundary.
//   * `already-carried` — a carrier exists IN THIS LANGUAGE and already holds the mandate, so a case
//                         here would be a third carrier of a rail that is already drilled. Added at the
//                         pre-commit checkpoint, which found `consolidate` step 5 classed `bound` with
//                         a carrier the runner never reads: deleting `.portulan/verify/index.sh` left
//                         the corpus green. The row was inflating the headline, and the vocabulary had
//                         no honest term for what it actually was.
//
// **And the ratio is a finding, not bookkeeping.** How much of a core skill is artifact discipline and
// how much is agent judgement is a measurement about the engine, which is what this row exists to
// produce. It is printed as such.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// The carriers, imported rather than grepped — property 4 above. A carrier that stops exporting these
// fails this module at load, which is the strongest form of the check available for free.
import { RETIRE_WHEN, parseProvenance } from "./doctor.mjs";

export const CASE_KINDS = ["load-bearing", "census"];
export const UNBINDABLE_REASONS = ["judgement-only", "no-artifact", "cross-language", "already-carried"];

// Anchored at `The pass` and prefix-matched, for the two reasons in property 2.
const PASS_HEADING = /^##\s+The pass\b/i;
// **Enumerated on the number, and the bold is read separately.** This was
// `/^(\d+)\.\s+\*\*(.+?)\*\*/`, which made an UNBOLDED step invisible: the pre-commit checkpoint
// added `5. A brand new fifth mandate, not bolded` to a pass and the corpus stayed green at 5 of 15.
// The empty-enumeration guard catches the all-or-nothing case; this catches the incremental one, which
// is the realistic one.
const STEP = /^(\d+)\.\s+(.*)$/;

export class CouldNotRun extends Error {}

/** Every core skill in the engine, derived from the tree. A skill with no corpus file is a finding. */
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

/** The numbered steps under a skill's `## The pass`. Zero is could-not-run, never a vacuous green. */
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

/** A quote must place exactly once in the skill's own file, or the case cannot be graded. */
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

/**
 * The artifact set a case grades, resolved through the workspace's DECLARED slots rather than a
 * hard-coded path. A slot rename must not silently empty a denominator, and an empty match is
 * could-not-run for the same reason a zero-step list is.
 */
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
// The predicates. Each is named in its case, because a figure computed before its rule was decided is
// how both of this session's opening passes produced a different number for the same question.
// ---------------------------------------------------------------------------------------------

/** A bolded field's block: the `**Field.**` line, then lines until the next bolded field or heading. */
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

/** Bullets with wrapped continuation lines rejoined — a wrapped criterion is one criterion. */
export function bulletsOf(block) {
    const out = [];
    for (const line of block.split("\n")) {
        if (/^\s*[-*]\s/.test(line)) out.push(line.replace(/^\s*[-*]\s*(\[[ xX]\]\s*)?/, "").trim());
        else if (out.length > 0 && line.trim()) out[out.length - 1] += ` ${line.trim()}`;
    }
    return out.filter(Boolean);
}

// EARS as `core/templates/task.md` states it. The shape is NOT restated in this module's prose: the
// template is the rule and this is a reduction of it, cited rather than re-spelled.
//
// **Three carriers state the shape** — that template, `core/operating/operating`-adjacent
// `core/operating/verification.md`, and `core/skills/clarify/SKILL.md` — all `core/` at tier `propose`.
// Reducing them to one is deferred on **budget** and on a real design question (making a CLI module the
// carrier that core doctrine cites inverts the cascade), filed as
// https://github.com/sleepy-panda-srl/portulan/issues/359. _(An earlier version of this comment said
// there were four, one of them `docs/vision.md` at tier `prohibited`, and concluded the reduction was
// impossible to an agent. `docs/vision.md` names EARS in a comparison-table row and nowhere states the
// shape; the count and the conclusion were both wrong, and the pre-commit checkpoint measured it.)_
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
    // `codify` step 3 — *"Attach how it earns its place"*. core/templates/proposal.md mandates an
    // **Enforcement.** field, and nothing checks it. The pre-commit checkpoint found this step classed
    // judgement-only on the argument that presence-checking would be "the presence floor with none of
    // the value" — an argument this module refutes in its own printed output, and which equally refutes
    // the provenance binding it did ship. Same spelling tolerance, same reason.
    "enforcement-present": (text) => {
        const has = /^\s*\*\*Enforcement\.?\*\*/im.test(text) || /^##+\s+Enforcement/im.test(text);
        return has ? { ok: true } : { ok: false, why: "no enforcement field in any spelling" };
    },
    // Any spelling of a provenance field. Deliberately shape-tolerant: the tree carries `**Provenance.**`
    // and `## Provenance` and a literal predicate would report the renamed ones as absent — the false-red
    // this session's own opening pass produced once against the task corpus.
    "provenance-present": (text) => {
        const has = /^\s*\*\*Provenance\.?\*\*/im.test(text) || /^##+\s+Provenance/im.test(text);
        return has ? { ok: true } : { ok: false, why: "no provenance field in any spelling" };
    },
    // The two defined forms, answered by `doctor`'s own exported parser. Scoped to `type: rule`, which
    // is the scope the mandate has and the scope `doctor` enforces at — a `decision` carrying prose
    // provenance is reported by `doctor` and is not a violation of this mandate.
    "provenance-two-form": (text) => {
        const type = (/^\s*\*\*type:\*\*\s*(\w+)/im.exec(text) || [])[1];
        if (type !== "rule") return { ok: true, skipped: "not a rule" };
        const p = parseProvenance(text);
        return p.present && p.fields ? { ok: true } : { ok: false, why: "a rule with no two-form provenance stamp" };
    },
    "retire-when-present": (text) =>
        RETIRE_WHEN.test(text) ? { ok: true } : { ok: false, why: "no **Retire when:** line" },
};

/**
 * The containment case: every budget id the Workspace Definition declares must be named in the
 * routing sentence `consolidate` states. Derived from the schema on both sides — a fifth budget, or a
 * rename, reddens rather than drifting.
 */
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
// Grading. Every case's `expect` is compared against what the predicate answers over the LIVE
// artifacts; nothing here is graded against a fixture the corpus invented.
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

/**
 * Grade one skill's corpus file against the tree.
 *
 * Every numbered step must be accounted for. `unbindable` is adjudicated: the reason comes from a
 * closed vocabulary, and a `judgement-only` step may name no artifact — if you can name the artifacts
 * the mandate governs, it is not judgement, it is unbuilt.
 */
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
    // Step 0 is reserved for a mandate outside `## The pass` — `consolidate`'s routing sentence lives
    // under `## When to use it`. Numbered 0 so the pass accounting stays a clean 1..N and the row cannot
    // be mistaken for a step. Any OTHER number the pass does not have is a finding.
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
            // **A reason without an argument is a label, not an adjudication.** `./mutants.mjs` refuses
            // an operator carrying no `why` — *"a mutation nobody can read is not reviewable"* — and
            // `./goldens.mjs` refuses a `documented-hole` naming no record. This carried neither until
            // the pre-commit checkpoint stripped every `why` from all ten unbindable cases and watched
            // the corpus stay green.
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
        // **`expect.accepted` is the larger dodge, and it was entirely unadjudicated.** Any finding
        // could be silenced by appending a bare filename — the pre-commit checkpoint created a
        // non-compliant task file, listed it, and the corpus went green over eighteen silenced
        // findings. So an entry is an object carrying its own `why`, on the same rule as `unbindable`
        // above: the both-directions check stops a STALE entry, and this stops an UNJUSTIFIED one.
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
        // Both directions, as `documented-hole` has on the gate side: an accepted drift that is
        // REPAIRED is a finding too, or an accepted-drift list outlives the drift it records.
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
        // **A missing option value must not swallow the next flag.** `argv[++i]` on a trailing
        // `--repo-root` yields `undefined` and on `--repo-root --workspace x` yields `"--workspace"`,
        // so the tool would grade a directory nobody named and say nothing. `./rule-carriers.mjs`
        // treats a missing value as exit 2 and this now matches it. Copilot round 1 on #360.
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
            // The derived skill set is what makes this a coverage rail: a new core skill cannot ship
            // with no mandates accounted for.
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
            // The filename is checked against the file's own field, the repair `../evals/README.md`
            // records for the gate corpus after a misfiled fixture graded cleanly.
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
    // **The split is printed, because the aggregate hides which unbindable means what.** Three prose
    // carriers of this file's own output once said "two thirds of these mandates are judgement" when
    // two thirds were merely UNBINDABLE and `cross-language` and `already-carried` mean the opposite —
    // a carrier exists. Caught at the pre-commit checkpoint.
    io.log(`  ${unbindable} adjudicated unbindable — ${Object.entries(reasons).map(([k, v]) => `${v} ${k}`).join(", ")}`);
    io.log("");
    io.log("  THE RATIO IS A FINDING, not bookkeeping: it measures how much of a core skill is artifact");
    io.log("  discipline and how much is agent judgement. Read the SPLIT, not the total — only the");
    io.log("  judgement-only rows are the A/B clause's subject; cross-language and already-carried mean");
    io.log("  a carrier exists and is somewhere else.");
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

// The entry guard, in the ONE form `./rule-carriers.mjs` designates: `file://${argv[1]}` percent-encodes
// differently from `import.meta.url` and this working copy lives under a path with spaces, so the naive
// spelling exits 0 having run nothing — met four times in this repository, once in the session before
// this one.
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
