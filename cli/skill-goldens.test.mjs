// The core-skill corpus's suite. Every refusal is exercised POSITIVELY, because a failure path nobody
// has run is one nobody has seen work — and three of these exist only because this session's own
// opening passes produced the defect they now pin.
//
//   * the denominator must not go quietly empty — three `## The pass` spellings exist and an exact
//     match finds one skill of three, giving the other two a vacuous green
//   * a mandate quote must place exactly once, or a reworded skill drifts instead of reddening
//   * `unbindable` is adjudicated, not asserted: the reason is a closed vocabulary and a
//     `judgement-only` step may name no artifacts
//   * an accepted drift that starts COMPLYING is a finding too — it caught three filenames the author
//     had written from a number prefix rather than read off disk
//   * the entry guard must survive a path containing a space

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// A HERMETIC HOST, the three-line block `pinned-roots.live.test.mjs` sweeps for — asserted WHOLE, so
// that copying the two lines which neutralise the host and dropping the one that tidies up is caught.
// This suite imports `doctor.mjs`, which consults the host's installed-plugin record, so without it a
// verdict here would move with what somebody happens to have installed.
//
// **The sweep derives membership from IMPORTS rather than from what a module currently does**, and it
// caught this file on its first full run: the corpus never asks `doctor` to resolve anything, but an
// internal refusal is one edit from being relaxed and the containment should not have to be re-added
// on that day. Spelled with namespace imports because the sweep compares it as literal text.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import {
    skillSet,
    passSteps,
    anchorQuote,
    slotFiles,
    budgetIds,
    gradeSkill,
    bulletsOf,
    fieldBlock,
    isEars,
    PREDICATES,
    UNBINDABLE_REASONS,
    CouldNotRun,
    run,
} from "./skill-goldens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const TOOL = join(HERE, "skill-goldens.mjs");

const collect = () => {
    const out = [];
    const err = [];
    return { io: { log: (m = "") => out.push(String(m)), error: (m = "") => err.push(String(m)) }, out, err };
};
const withTemp = (fn) => {
    const dir = mkdtempSync(join(tmpdir(), "skill-goldens-"));
    try {
        return fn(dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
};
// A minimal repo: one skill with N numbered steps under a `## The pass` heading of a given spelling.
const fakeRepo = (dir, { skill = "demo", heading = "## The pass", steps = 2, extra = "" } = {}) => {
    const sdir = join(dir, "core/skills", skill);
    mkdirSync(sdir, { recursive: true });
    const body = Array.from({ length: steps }, (_, i) => `${i + 1}. **Step ${i + 1}** does a thing.`).join("\n");
    writeFileSync(join(sdir, "SKILL.md"), `# Skill\n\n${heading}\n\n${body}\n${extra}\n`);
    return dir;
};

// ------------------------------------------------------------------ the derived denominator

test("the three real `## The pass` spellings all yield steps — an exact match would find one of three", () => {
    // Measured on the tree: "## The pass", "## The pass (bounded)", "## The pass, in order".
    for (const skill of skillSet(REPO)) {
        assert.ok(passSteps(REPO, skill).length > 0, `${skill} yielded no steps`);
    }
    assert.deepEqual(skillSet(REPO), ["clarify", "codify", "consolidate"]);
});

test("an empty step list is could-not-run, never a vacuous green", () =>
    withTemp((dir) => {
        // "Every step is bound or unbindable" is satisfied by zero steps, so a denominator that can go
        // empty is the exact failure clause (d) names: a check whose enumeration went empty reports
        // green and has stopped being a rail.
        fakeRepo(dir, { heading: "## Something else", steps: 3 });
        assert.throws(() => passSteps(dir, "demo"), CouldNotRun);
    }));

test("the heading match is anchored, so `## The one move this pass may not make` is not a pass", () =>
    withTemp((dir) => {
        fakeRepo(dir, { heading: "## The one move this pass may not make", steps: 2 });
        assert.throws(() => passSteps(dir, "demo"), CouldNotRun);
    }));

test("a skill with no corpus file is a finding, because the skill set is derived", () =>
    withTemp((dir) => {
        cpSync(join(REPO, "core"), join(dir, "core"), { recursive: true });
        cpSync(join(REPO, "spec"), join(dir, "spec"), { recursive: true });
        cpSync(join(REPO, ".portulan"), join(dir, ".portulan"), { recursive: true });
        mkdirSync(join(dir, "evals/goldens/skills"), { recursive: true });
        const c = collect();
        assert.equal(run(["--repo-root", dir], c.io), 1);
        const text = c.err.join("\n");
        for (const skill of ["clarify", "codify", "consolidate"]) {
            assert.ok(text.includes(`${skill}.json does not`), `${skill} not reported missing`);
        }
    }));

// ------------------------------------------------------------------------- the quote anchor

test("a mandate quote must place EXACTLY once — zero and two are both could-not-run", () =>
    withTemp((dir) => {
        fakeRepo(dir, { steps: 1, extra: "\nA line saying twice. A line saying twice.\n" });
        assert.throws(() => anchorQuote(dir, "demo", "not present anywhere"), CouldNotRun);
        assert.throws(() => anchorQuote(dir, "demo", "A line saying twice."), CouldNotRun);
        anchorQuote(dir, "demo", "**Step 1**");
    }));

// ------------------------------------------------------------- slots, and the empty denominator

test("artifacts resolve through DECLARED slots, and an undeclared slot is could-not-run", () => {
    const manifest = { slots: { tasks: "tasks/" } };
    assert.throws(() => slotFiles(join(REPO, ".portulan"), manifest, "memory"), CouldNotRun);
    assert.ok(slotFiles(join(REPO, ".portulan"), manifest, "tasks").length > 0);
});

test("a slot that resolves to an empty directory is could-not-run, not a green over zero files", () =>
    withTemp((dir) => {
        mkdirSync(join(dir, "empty"), { recursive: true });
        assert.throws(() => slotFiles(dir, { slots: { tasks: "empty" } }, "tasks"), CouldNotRun);
    }));

// ------------------------------------------------------------------- unbindable is adjudicated

test("an unbindable reason outside the closed vocabulary is a finding", () =>
    withTemp((dir) => {
        fakeRepo(dir, { steps: 1 });
        const g = gradeSkill("demo", { cases: [{ step: 1, state: "unbindable", reason: "it is hard", why: "a".repeat(60) }] }, { repoRoot: dir });
        assert.ok(g.findings.some((f) => /not one of/.test(f)));
        assert.deepEqual(UNBINDABLE_REASONS, ["judgement-only", "no-artifact", "cross-language", "already-carried"]);
    }));

test("a judgement-only step that NAMES artifacts is a finding — nameable means unbuilt, not unjudgeable", () =>
    withTemp((dir) => {
        fakeRepo(dir, { steps: 1 });
        const g = gradeSkill(
            "demo",
            { cases: [{ step: 1, state: "unbindable", reason: "judgement-only", why: "a".repeat(60), artifacts: { slot: "tasks" } }] },
            { repoRoot: dir },
        );
        assert.ok(g.findings.some((f) => /unbuilt, not unjudgeable/.test(f)));
    }));

test("a step in the pass and in no case is a finding — this is what the drill forces", () =>
    withTemp((dir) => {
        fakeRepo(dir, { steps: 2 });
        const g = gradeSkill("demo", { cases: [{ step: 1, state: "unbindable", reason: "no-artifact", why: "a".repeat(60) }] }, { repoRoot: dir });
        assert.ok(g.findings.some((f) => /is in the skill's pass and in no case/.test(f)));
    }));

test("a case naming a step the pass does not have is a finding, and step 0 is exempt by design", () =>
    withTemp((dir) => {
        fakeRepo(dir, { steps: 1 });
        const bad = gradeSkill(
            "demo",
            { cases: [{ step: 1, state: "unbindable", reason: "no-artifact", why: "a".repeat(60) }, { step: 9, state: "unbindable", reason: "no-artifact", why: "a".repeat(60) }] },
            { repoRoot: dir },
        );
        assert.ok(bad.findings.some((f) => /step 9, which the pass does not have/.test(f)));
        // Step 0 carries a mandate outside `## The pass` — consolidate's routing sentence.
        const ok = gradeSkill(
            "demo",
            { cases: [{ step: 1, state: "unbindable", reason: "no-artifact", why: "a".repeat(60) }, { step: 0, state: "unbindable", reason: "no-artifact", why: "a".repeat(60) }] },
            { repoRoot: dir },
        );
        assert.ok(!ok.findings.some((f) => /does not have/.test(f)));
    }));

// ------------------------------------------------------------------------ the predicates

test("the EARS predicate reads the mandate's shape, not the section's presence", () => {
    const absent = PREDICATES["ears-acceptance-criteria"]("# Task\n\n**Goal.** something\n");
    assert.equal(absent.ok, false);
    assert.match(absent.why, /no \*\*Acceptance criteria/);

    const shaped = PREDICATES["ears-acceptance-criteria"](
        "**Acceptance criteria.**\n- When it runs, the system shall exit zero.\n\n**Verify.** x\n",
    );
    assert.equal(shaped.ok, true);

    // The two live cases: a bullet with neither word, and one with `shall` and no trigger.
    assert.equal(isEars("The root README's layout table documents things."), false);
    assert.equal(isEars("The two-reason interaction shall be tested directly."), false);
    assert.equal(isEars("When the recipe runs, the system shall name every entry."), true);
});

test("a wrapped criterion is ONE criterion, not a bullet and an orphan line", () => {
    const bs = bulletsOf("- When the recipe runs, the system shall name every top-level entry\n      absent from the table.\n- When none is absent, the system shall exit zero.");
    assert.equal(bs.length, 2);
    assert.ok(bs[0].endsWith("absent from the table."));
    assert.ok(bs.every(isEars));
});

test("the provenance predicate is shape-TOLERANT, because the tree carries two spellings", () => {
    // 14 files use `**Provenance.**` and 13 use `## Provenance`. A literal predicate would report the
    // thirteen as absent — the false red this session produced once against the task corpus.
    assert.equal(PREDICATES["provenance-present"]("**Provenance.** `form=link` `href=x`").ok, true);
    assert.equal(PREDICATES["provenance-present"]("## Provenance\n\nsomething").ok, true);
    assert.equal(PREDICATES["provenance-present"]("# A proposal\n\nno such field").ok, false);
});

test("the two-form predicate is scoped to `type: rule`, which is the scope doctor enforces at", () => {
    const decision = PREDICATES["provenance-two-form"]("**type:** decision\n**provenance:** prose only\n");
    assert.equal(decision.ok, true);
    assert.ok(decision.skipped, "a decision is skipped, not passed");
    assert.equal(PREDICATES["provenance-two-form"]("**type:** rule\n**provenance:** prose only\n").ok, false);
    assert.equal(
        PREDICATES["provenance-two-form"]("**type:** rule\n**provenance:** `form=link` `href=https://x/1`\n").ok,
        true,
    );
});

test("the retire-when predicate uses doctor's own exported regex, anchored at line start", () => {
    assert.equal(PREDICATES["retire-when-present"]("**Retire when:** the thing goes away").ok, true);
    // Prose merely discussing retirement must not match — doctor's own stated caution.
    assert.equal(PREDICATES["retire-when-present"]("we should think about when to retire this").ok, false);
});

test("fieldBlock stops at the next bolded field, not at the end of the file", () => {
    const block = fieldBlock("**Acceptance criteria.**\n- a\n- b\n\n**Verify.** not this\n", "Acceptance criteria");
    assert.ok(block.includes("- a"));
    assert.ok(!block.includes("not this"));
});

// --------------------------------------------------------- the budget containment, derived both ways

test("the budget ids come from the schema, so a fifth budget reddens the containment case", () => {
    assert.deepEqual(budgetIds(REPO), ["columns", "kilobytes", "lines", "record_kilobytes"]);
});

// ------------------------------------------------------------------- accepted drift, both directions

test("an accepted drift that starts COMPLYING is a finding — it caught three of the author's own", () =>
    withTemp((dir) => {
        // Three filenames in the shipped corpus were written from a number prefix rather than read off
        // disk, and this direction reported all three before any reviewer saw them.
        fakeRepo(dir, { steps: 1 });
        mkdirSync(join(dir, ".portulan/tasks"), { recursive: true });
        writeFileSync(join(dir, ".portulan/tasks/0001-fine.md"), "**Acceptance criteria.**\n- When x, the system shall y.\n");
        const ctx = { repoRoot: dir, workspaceDir: join(dir, ".portulan"), manifest: { slots: { tasks: "tasks" } } };
        const cases = [{
            step: 1,
            state: "bound",
            kind: "load-bearing",
            mandate: { quote: "**Step 1**" },
            artifacts: { slot: "tasks" },
            predicate: "ears-acceptance-criteria",
            expect: { accepted: [{ file: "0001-fine.md", why: "a".repeat(40) }] },
        }];
        const g = gradeSkill("demo", { cases }, ctx);
        assert.ok(g.findings.some((f) => /now complies, and is still listed as accepted drift/.test(f)));
    }));

// ---------------------------------------------------------------------------- the shipped corpus

test("the shipped corpus is green against the real tree, and reports its own ratio", () => {
    const c = collect();
    assert.equal(run(["--repo-root", REPO], c.io), 0);
    const text = c.out.join("\n");
    assert.match(text, /mandate\(s\) bound to live artifacts/);
    assert.match(text, /adjudicated unbindable/);
    assert.ok(text.includes("THE RATIO IS A FINDING"));
    assert.ok(text.includes("DECLARED, reviewed field"), "the carrier limit must be printed");
    assert.ok(text.includes("Presence, not adequacy"));
});

test("a corpus file whose `skill` field disagrees with its filename is could-not-run", () =>
    withTemp((dir) => {
        cpSync(join(REPO, "core"), join(dir, "core"), { recursive: true });
        cpSync(join(REPO, "spec"), join(dir, "spec"), { recursive: true });
        cpSync(join(REPO, ".portulan"), join(dir, ".portulan"), { recursive: true });
        mkdirSync(join(dir, "evals/goldens/skills"), { recursive: true });
        writeFileSync(join(dir, "evals/goldens/skills/clarify.json"), JSON.stringify({ skill: "codify", cases: [] }));
        assert.equal(run(["--repo-root", dir], collect().io), 2);
    }));

test("an unrecognised argument is refused, never ignored", () => {
    assert.equal(run(["--rounds"], collect().io), 2);
});

// -------------------------------------------------------------------------------- the entry guard

test("the entry guard survives a path containing a SPACE — the fifth instance in this repository", () =>
    withTemp((dir) => {
        const spaced = join(dir, "a directory with spaces");
        mkdirSync(spaced);
        const out = spawnSync(process.execPath, [TOOL, "--repo-root", REPO], { encoding: "utf8", cwd: spaced });
        assert.equal(out.status, 0);
        assert.ok(out.stdout.includes("mandate(s) bound"), `ran nothing: ${JSON.stringify(out.stdout.slice(0, 200))}`);
    }));

// ---------------------------------------------- the guards the pre-commit checkpoint had to force

test("an unbindable step with no ARGUMENT is a finding — the reason is a label, the why is the adjudication", () =>
    withTemp((dir) => {
        // The checkpoint stripped every `why` from all ten unbindable cases and watched the corpus stay
        // green. `mutants.mjs` refuses an operator with no `why`; this had no equivalent.
        fakeRepo(dir, { steps: 1 });
        const g = gradeSkill("demo", { cases: [{ step: 1, state: "unbindable", reason: "no-artifact" }] }, { repoRoot: dir });
        assert.ok(g.findings.some((f) => /carries no argument/.test(f)));
    }));

test("an accepted-drift entry with no argument is a finding — the bigger dodge, and it was unguarded", () =>
    withTemp((dir) => {
        // The checkpoint appended a bare filename to `expect.accepted` and silenced eighteen findings
        // at exit 0. The both-directions rule stops a STALE entry; this stops an UNJUSTIFIED one.
        fakeRepo(dir, { steps: 1 });
        mkdirSync(join(dir, ".portulan/tasks"), { recursive: true });
        writeFileSync(join(dir, ".portulan/tasks/0001-bad.md"), "# no criteria at all\n");
        const ctx = { repoRoot: dir, workspaceDir: join(dir, ".portulan"), manifest: { slots: { tasks: "tasks" } } };
        const base = {
            step: 1, state: "bound", kind: "load-bearing",
            mandate: { quote: "**Step 1**" }, artifacts: { slot: "tasks" }, predicate: "ears-acceptance-criteria",
        };
        const bare = gradeSkill("demo", { cases: [{ ...base, expect: { accepted: ["0001-bad.md"] } }] }, ctx);
        assert.ok(bare.findings.some((f) => /is not \{file, why\}/.test(f)));
        const thin = gradeSkill("demo", { cases: [{ ...base, expect: { accepted: [{ file: "0001-bad.md", why: "no" }] } }] }, ctx);
        assert.ok(thin.findings.some((f) => /carries no argument/.test(f)));
    }));

test("an UNBOLDED numbered step is still a step — additions were invisible before", () =>
    withTemp((dir) => {
        // The checkpoint added `5. A brand new fifth mandate, not bolded` to a pass and the corpus
        // stayed green. Deletions were always caught; additions, the realistic case, were not.
        const sdir = join(dir, "core/skills/demo");
        mkdirSync(sdir, { recursive: true });
        writeFileSync(join(sdir, "SKILL.md"), "# S\n\n## The pass\n\n1. **Bolded** step.\n2. Unbolded step, no asterisks.\n");
        const steps = passSteps(dir, "demo");
        assert.equal(steps.length, 2, "an unbolded step was skipped");
        assert.equal(steps[1].title, "Unbolded step, no asterisks.");
    }));

test("`already-carried` exists because a row named a carrier the runner never reads", () => {
    // consolidate step 5 shipped as `bound` with carrier `index`; deleting .portulan/verify/index.sh
    // left the corpus green, because `carrier` is display-only. The vocabulary had no honest term.
    assert.ok(UNBINDABLE_REASONS.includes("already-carried"));
});

test("the printed limits say `carrier` is DECLARED, not verified", () => {
    const c = collect();
    assert.equal(run(["--repo-root", REPO], c.io), 0);
    const text = c.out.join("\n");
    assert.ok(text.includes("DECLARED, reviewed field"), "the carrier limit must not overclaim");
    assert.ok(text.includes("Read the SPLIT, not the total"), "the ratio must not read as all-judgement");
    assert.match(text, /adjudicated unbindable — .*judgement-only/);
});
