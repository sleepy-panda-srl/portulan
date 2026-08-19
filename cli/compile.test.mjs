// Tests for `compile` — the enforcement compiler.
//
// Written before the compiler, per ../core/operating/verification.md: the failing test is the spec.
// Zero dependencies, node's own runner, same as ./doctor.test.mjs and ./plugin-lint.test.mjs, and
// run by the same recipe.
//
//   node --test "cli/**/*.test.mjs"
//
// What this suite CANNOT establish, stated first because the milestone before this one was spent
// learning it the expensive way: **that Claude Code honours what the compiler emits.** A schema-valid
// settings file that the host ignores looks identical, from in here, to one it enforces — that is
// exactly ../.portulan/memory/a-manifest-field-can-validate-and-load-nothing.md, where three agents
// shipped, validated green twice, and loaded nowhere. The host behaviours this compiler is built on
// were measured against a running host and are recorded in ../.portulan/memory/ and in
// ../.portulan/compile/README.md. This suite tests emission fidelity only. CI proves the artifact is
// what the policy says; only a running host proves it holds.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A HERMETIC HOST. The tools consult the host's installed-plugin record on the UNASKED path as of
// 2026-08-13, so a suite that does not neutralise it reads the machine it runs on and a fixture's
// verdict moves with what somebody has installed. Swept by `pinned-roots.live.test.mjs`, whose header
// carries the argument and the limit. A case that wants a host passes `env:` explicitly, which wins.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import {
    CompileError,
    parse,
    claudeCode,
    githubRuleset,
    backends,
    matrix,
    run,
    spellings,
    matchesRule,
    matchesPath,
    policyPath,
    resolveWorkspace,
    FILE_WRITERS,
    IN_PLACE_EDITORS,
    resolvePack,
    recordedOrigin,
    packRoots,
    packContributions,
    composeFragments,
    tierRank,
} from "./compile.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

// One exit handler for every scratch directory, not one per directory — the per-directory form
// exceeds node's default listener limit partway through a suite this size and prints a warning,
// which trains a reader to skim warnings from a test run. Inherited from ./plugin-lint.test.mjs.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-compile-"));
    SCRATCH.push(dir);
    return dir;
}

/**
 * A minimal well-formed policy, with one rule of each tier. Tests mutate a clone.
 *
 * It declares **no `floor`** on purpose: a workspace that has not declared its platform floor is a
 * legitimate shape, it is the shape every fixture had before the floor backend existed, and the
 * no-floor path is the one that must refuse rather than invent a branch name. Tests that want a
 * floor add one with `withFloor`.
 */
function policy(overrides = {}) {
    return {
        portulan: { spec: "2.2" },
        why: "gate-map.md",
        rules: [
            { id: "ban", tier: "prohibited", action: { write: "docs/vision.md" }, reason: "constitution" },
            { id: "push", tier: "gated", action: { shell: "git push" }, reason: "ask first" },
            { id: "pr", tier: "propose", action: { shell: "gh pr create" }, reason: "by pull request" },
            { id: "read", tier: "auto", action: { read: "./" }, reason: "unattended" },
        ],
        ...overrides,
    };
}

/** The same policy with a complete floor declaration, and the two ref-gated push spellings. */
function withFloor(overrides = {}) {
    const p = policy();
    p.rules.push(
        { id: "force", tier: "gated", action: { shell: "git push --force" }, reason: "no lease" },
        { id: "drop", tier: "gated", action: { shell: "git push --delete" }, reason: "destroys a ref" },
    );
    p.floor = {
        branch: "main",
        checks: [{ context: "workspace-verify", integration_id: 15368 }],
        reviews: 0,
        resolve_conversations: true,
        ...overrides,
    };
    return p;
}

/** Writes a policy file into a scratch workspace and returns the workspace dir. */
function workspace(p = policy()) {
    const dir = scratch();
    fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".portulan", "gates.json"), JSON.stringify(p, null, 2));
    fs.writeFileSync(
        path.join(dir, ".portulan", "workspace.json"),
        JSON.stringify({
            portulan: { spec: "2.1" },
            name: "scratch",
            summary: "s",
            kind: "repository",
            tree: "../",
            gates: "gates.json",
            slots: { gates: "gate-map.md" },
            verify: { default: "docs", recipes: [{ id: "docs", run: "./v.sh", requires: ["bash"] }] },
        }, null, 2),
    );
    return dir;
}

// ===========================================================================================
// 1. Nothing is dropped on the floor — and the accounting is now PER BACKEND
// ===========================================================================================
//
// The distinctive failure of a compiler that emits gate machinery is a rule that goes in and
// nothing comes out: the gate reads as configured and enforces nothing. So the accounting is a
// test, not a diagnostic — every rule ends in exactly one of {compiled, refused-with-a-reason},
// and the two counts must add up to the input.
//
// **Per backend, since the floor backend arrived.** For one session the tier partition lived in the
// shared stage: `auto` and `propose` were refused before any backend ran. That is the Claude Code
// backend's partition, not a property of policy — the floor backend inverts it, compiling exactly
// the `propose` rules the other one refuses *on the grounds that the floor enforces them*. Left
// where it was, the second backend could never have compiled anything, and the matrix would have
// been a column of refusals wearing a compiler's name.

describe("the accounting", () => {
    for (const backend of backends(parse(withFloor()))) {
        test(`${backend.backend}: every rule is either compiled or refused, and the counts add up`, () => {
            const seen = new Set([...backend.compiled, ...backend.refused].map((r) => r.id));
            assert.equal(seen.size, withFloor().rules.length, "every rule accounted for exactly once");
            assert.equal(backend.compiled.length + backend.refused.length, withFloor().rules.length);
        });

        test(`${backend.backend}: a refusal always carries a stated reason, never a bare skip`, () => {
            for (const r of backend.refused) {
                assert.ok(r.why && r.why.length > 20, `refusal ${r.id} must say why in a sentence`);
            }
        });

        test(`${backend.backend}: a compiled rule names the surface it became`, () => {
            for (const c of backend.compiled) {
                assert.ok(c.surface, `${c.id} compiled into nothing a reader can name`);
            }
        });
    }

    test("the Claude Code backend refuses auto and propose as tiers, not silently", () => {
        const refusedIds = claudeCode(parse(policy())).refused.map((r) => r.id);
        assert.ok(refusedIds.includes("pr"), "propose is not a tool-level gate");
        assert.ok(refusedIds.includes("read"), "auto is not a gate");
    });

    test("an action declaring `none` is refused carrying the policy's own words", () => {
        const p = policy();
        p.rules.push({ id: "money", tier: "gated", action: { none: "no tool-level surface exists for spending money" }, reason: "gated" });
        const refusal = claudeCode(parse(p)).refused.find((r) => r.id === "money");
        assert.match(refusal.why, /no tool-level surface/, "the compiler reports the policy's reason, never one it invented");
    });
});

// ===========================================================================================
// 2. A checker must refuse what it cannot check
// ===========================================================================================
//
// ../.portulan/memory/a-checker-must-refuse-what-it-cannot-check.md. Skipping and enforcing are
// indistinguishable from outside, so an unknown tier or action shape refuses the WHOLE compile
// rather than dropping one rule. A compiler that half-understands its input emits a half-gate.

describe("refusing what it cannot compile", () => {
    test("an unknown tier refuses the whole compile", () => {
        const p = policy();
        p.rules[1].tier = "sometimes";
        assert.throws(() => parse(p), CompileError, "an unrecognised tier is not a rule to skip");
    });

    test("an unknown action shape refuses the whole compile", () => {
        const p = policy();
        p.rules[1].action = { telepathy: "git push" };
        assert.throws(() => parse(p), CompileError);
    });

    test("an action declaring two kinds at once refuses the whole compile", () => {
        const p = policy();
        p.rules[1].action = { shell: "git push", write: "x" };
        assert.throws(() => parse(p), CompileError, "ambiguous is not the same as either");
    });

    test("a duplicate rule id refuses the whole compile", () => {
        const p = policy();
        p.rules.push({ ...p.rules[1] });
        assert.throws(() => parse(p), CompileError);
    });

    test("a rule id that is not a slug refuses the whole compile", () => {
        const p = policy();
        p.rules[1].id = "Push To Origin";
        assert.throws(() => parse(p), CompileError);
    });

    test("a rule with no reason refuses the whole compile", () => {
        const p = policy();
        delete p.rules[1].reason;
        assert.throws(() => parse(p), CompileError, "a gate with no sentence to show a human is not finished");
    });

    for (const [label, bad] of [
        ["a colon, which separates prefix from wildcard in the host DSL", "git log --pretty=format:%h"],
        ["parentheses, which delimit the rule", "git (push)"],
        ["a newline", "git push\npwd"],
    ]) {
        test(`a shell target containing ${label} refuses the whole compile`, () => {
            // Targets are interpolated into `Bash(target:*)`. A structural character there emits a rule
            // the host reads differently from what the policy says, and an ambiguous gate is
            // indistinguishable from an absent one. Refused rather than escaped: extending the DSL is a
            // deliberate change, not something a compiler should improvise. Found by review.
            const p = policy();
            p.rules[1].action = { shell: bad };
            assert.throws(() => parse(p), CompileError);
        });
    }

    test("a target with surrounding whitespace refuses rather than being silently trimmed", () => {
        const p = policy();
        p.rules[1].action = { shell: " git push " };
        assert.throws(() => parse(p), CompileError, "the host would not match it, so quietly fixing it hides a policy error");
    });

    test("a path target may contain a colon — only shell targets use it structurally", () => {
        const p = policy();
        p.rules[0].action = { write: "docs/odd:name.md" };
        assert.doesNotThrow(() => parse(p));
    });

    // #205. The reserved-character check was applied to all four action kinds on one justification —
    // the value is interpolated into the host's permission DSL. A `none` value never is: it is the
    // PROSE the policy gives for why no surface exists, which the compiler reports verbatim (see the
    // `none` arm of the emitter, and the refusal test above). So the DSL reasoning did not reach it,
    // and the DSL regex forbade parentheses in an English sentence — a gate refusing to compile over
    // an aside.
    test("a `none` value may contain parentheses — it is prose, not a permission pattern", () => {
        const p = policy();
        p.rules.push({
            id: "money",
            tier: "gated",
            action: { none: "no tool-level surface exists for spending money (the host has no payment tool)" },
            reason: "gated",
        });
        // Parsed ONCE and reused: the first draft called `parse(p)` twice, once inside `doesNotThrow`
        // and once to build the backend, so the assertion about the reported reason rode a second
        // parse that no assertion had checked. Copilot, #256 round 2.
        let parsed;
        assert.doesNotThrow(() => {
            parsed = parse(p);
        });
        const refusal = claudeCode(parsed).refused.find((r) => r.id === "money");
        assert.match(refusal.why, /\(the host has no payment tool\)/, "the aside survives into the reported reason");
    });

    // The whitespace refusal carried the SAME over-reach nine lines below the split above: it told
    // every kind the host "would not match" its value, and nothing about a `none` value is matched by
    // the host. The refusal is right and the reason was wrong. Round 2 then got the REPLACEMENT reason
    // wrong too — it blamed the report's padding, which comes from `r.id.padEnd(38)` and cannot be
    // affected by the sentence — so this asserts the reason that is actually true: leading whitespace
    // shifts the sentence out of line with every other refusal. Copilot, #256 rounds 1 and 3.
    test("a `none` value with surrounding whitespace refuses, and NOT because the host would not match it", () => {
        const p = policy();
        p.rules.push({ id: "money", tier: "gated", action: { none: " no surface exists " }, reason: "gated" });
        assert.throws(
            () => parse(p),
            (e) =>
                e instanceof CompileError &&
                /out of line with every other refusal/.test(e.message) &&
                !/the host would not match/.test(e.message),
            "the refusal stands; the reason must be the report, not a host match that never happens",
        );
    });

    test("a shell target with surrounding whitespace still refuses for the HOST reason", () => {
        const p = policy();
        p.rules[1].action = { shell: " git push " };
        assert.throws(() => parse(p), (e) => e instanceof CompileError && /the host would not match/.test(e.message));
    });

    // …and the half of the old check that DOES reach `none`, kept for its own reason rather than
    // folded back into the DSL one. That sentence is printed into a line-based refusal report —
    // `refused ${id.padEnd(38)} ${why}` — so a newline splits one refusal across two lines and
    // misaligns every column after it. Same class as `json.sh`'s report, one tool over.
    for (const [label, bad] of [
        ["a newline", "no surface exists\nfor this"],
        ["a tab", "no surface exists\tfor this"],
    ]) {
        test(`a \`none\` value containing ${label} still refuses — the report is line-based`, () => {
            const p = policy();
            p.rules.push({ id: "money", tier: "gated", action: { none: bad }, reason: "gated" });
            assert.throws(() => parse(p), CompileError);
        });
    }

    // These arrived on `main` in `f545228` while the floor backend was in flight, written against the
    // `compile()` name this branch renamed to `parse()` when the tier partition moved into the
    // backends. Retargeted, not rewritten: the validation is the shared stage's either way, and it is
    // where they were always aimed.
    //
    // Their nine reds on the rebase were **entirely** this rename, and reading them as something else
    // cost a defect. The first diagnosis was that the merge had dropped the validation itself; it had
    // not — the block came through untouched — and "restoring" it added a second copy of a
    // load-bearing validator, which a Copilot round then caught. `git show <commit>:cli/compile.mjs`
    // would have settled it in one command before any of that. Recorded here rather than only in the
    // handoff, because this is where the next person meets these tests.
    for (const kind of ["write", "read"]) {
        test(`a ${kind} target climbing out with \`..\` refuses`, () => {
            // The sibling of the absolute case, one spelling over: `../secrets/` emits
            // `Edit(./../secrets/**)` — which the host may resolve against the PARENT tree — while
            // `matchesPath` can never match a `/../`-bearing tail against a resolved path. The
            // emitter and the matcher disagree about which way it is wrong, and a gate that reads as
            // present while holding nothing is the worse half. Found by the supervisor on #51.
            const p = policy();
            p.rules[0].action = { [kind]: "../secrets/" };
            assert.throws(() => parse(p), CompileError);
        });

        test(`a ${kind} target with an interior \`..\` segment refuses`, () => {
            const p = policy();
            p.rules[0].action = { [kind]: "docs/../../etc/" };
            assert.throws(() => parse(p), CompileError);
        });

        test(`a ${kind} target merely CONTAINING dots is fine — only a \`..\` segment escapes`, () => {
            // `..` is a path segment, not a substring: a file legitimately named `a..b.md`, or any
            // dotfile, must still compile. Refusing on the substring would be a false red.
            const p = policy();
            p.rules[0].action = { [kind]: "docs/a..b.md" };
            assert.doesNotThrow(() => parse(p));
        });

        test(`an absolute ${kind} target refuses rather than being silently made relative`, () => {
            // `pattern()` and `matchesPath()` both strip the leading slash, so `/etc/passwd` compiled
            // to `Edit(./etc/passwd)` and matched any path ENDING in `/etc/passwd` — a gate enforcing
            // something both different from and broader than the policy's own words. The same
            // "refuse rather than escape" reasoning as the reserved-character check. Found by review.
            const p = policy();
            p.rules[0].action = { [kind]: "/etc/passwd" };
            assert.throws(() => parse(p), CompileError);
        });
    }

    test("an absolute shell target still compiles — it is a command spelling, not a rewritten path", () => {
        const p = policy();
        p.rules[1].action = { shell: "/usr/bin/git push" };
        assert.doesNotThrow(() => parse(p));
    });

    test("a policy whose spec version has never shipped refuses", () => {
        assert.throws(() => parse(policy({ portulan: { spec: "99.0" } })), CompileError);
    });
});

// ===========================================================================================
// 3. The fail-closed floor
// ===========================================================================================
//
// Seven fail-opens in this repository so far, every one in scaffolding rather than in a check
// (../.portulan/tasks/0004). The compiler's own version: emitting an artifact with no gates in it
// while reporting success. The workflow already refuses to report green having run nothing; this is
// that rule one level down.

describe("fail-closed", () => {
    // The guard is **per backend** now, and it has to be: what a backend "should have compiled"
    // differs by backend, so a shared version would either fire on a backend that legitimately
    // compiles nothing, or never fire at all. Asserted for each backend against the input that
    // makes that backend's own claim empty.
    test("Claude Code: a policy carrying gate rules that would emit no gate at all refuses", () => {
        const p = policy();
        // Every gate becomes unreachable, but the rules are still there claiming enforcement.
        p.rules = p.rules.map((r) =>
            r.tier === "gated" || r.tier === "prohibited"
                ? { ...r, action: { none: "deliberately unreachable for this test" } }
                : r,
        );
        assert.throws(() => claudeCode(parse(p)), CompileError, "a policy that declares gates and emits none must not report success");
    });

    test("the floor backend: a declared floor that would emit no ruleset rule at all refuses", () => {
        // A floor is declared — so the workspace is claiming a platform floor — and nothing in the
        // policy reaches it. Writing an empty ruleset here would be the same defect: an importable
        // file, valid, named for a floor, enforcing nothing.
        const p = withFloor();
        p.rules = p.rules.filter((r) => r.tier !== "propose" && !String(r.action?.shell ?? "").startsWith("git push --"));
        assert.throws(() => githubRuleset(parse(p)), CompileError, "a declared floor that compiles to no rule must not report success");
    });

    test("a policy with no rules at all refuses", () => {
        assert.throws(() => parse(policy({ rules: [] })), CompileError);
    });

    test("run() exits 2 — never 0 or 1 — when the policy cannot be read", () => {
        const dir = scratch();
        assert.equal(run(["--workspace", path.join(dir, "nope")], { quiet: true }), 2);
    });

    test("run() exits 2 on a malformed policy rather than emitting a partial artifact", () => {
        const dir = workspace();
        fs.writeFileSync(path.join(dir, ".portulan", "gates.json"), "{ not json");
        assert.equal(run(["--workspace", dir], { quiet: true }), 2);
    });
});

// ===========================================================================================
// 4. The Claude Code backend — the tier→surface mapping, as measured
// ===========================================================================================
//
// Each assertion below corresponds to a probe run against a live host on 2026-07-27, CLI 2.1.220.
// They are asserted here so that a later edit to the mapping is loud; they are not evidence that
// the host still behaves this way. Re-measure on upgrade.

describe("the Claude Code backend", () => {
    test("gated compiles to `ask` — per-action approval, which is what Gated means", () => {
        const settings = claudeCode(parse(policy())).artifact.value;
        assert.ok(settings.permissions.ask.includes("Bash(git push:*)"));
        assert.ok(!(settings.permissions.deny ?? []).includes("Bash(git push:*)"), "gated is not a prohibition");
    });

    test("prohibited compiles to `deny` — an action with no approval path", () => {
        const settings = claudeCode(parse(policy())).artifact.value;
        for (const rule of ["Edit(./docs/vision.md)", "Write(./docs/vision.md)"]) {
            assert.ok(settings.permissions.deny.includes(rule), `expected ${rule}`);
        }
        assert.ok(!(settings.permissions.ask ?? []).includes("Edit(./docs/vision.md)"));
    });

    test("no `allow` rules are emitted — the compiler only ever adds restriction", () => {
        const settings = claudeCode(parse(policy())).artifact.value;
        assert.deepEqual(settings.permissions.allow ?? [], [], "maintainer's ruling, 2026-07-27: gates only");
    });

    test("every gate is emitted as a permission rule AND backed by a hook", () => {
        const settings = claudeCode(parse(policy())).artifact.value;
        assert.ok(settings.permissions.ask.length > 0, "permissions are the load-bearing layer");
        assert.ok(settings.hooks.PreToolUse.length > 0, "the hook is the explanation layer");
    });

    test("a write action covers every tool that can write, not just Edit", () => {
        const settings = claudeCode(parse(policy())).artifact.value;
        const denied = settings.permissions.deny.join(" ");
        for (const tool of ["Edit", "Write", "NotebookEdit"]) {
            assert.match(denied, new RegExp(`${tool}\\(`), `${tool} can write and must be covered`);
        }
    });

    test("a write gate wires the Bash hook, or its shell coverage is a matcher nothing reaches", () => {
        // The load-bearing half of the shell-write fix, and the half with no visible effect in THIS
        // repository — whose policy already gates shell commands, so `Bash` is a matcher either way.
        // A policy carrying ONLY a write prohibition is where the omission shows: without this, the
        // runner is never invoked for a Bash call and `matchesRule`'s shell-write branch is dead
        // code. A capability that validates and loads nothing is this repository's most expensive
        // recurring defect, so it is asserted on the shape that would hide it.
        const onlyAWrite = policy({
            rules: [{ id: "ban", tier: "prohibited", action: { write: "docs/vision.md" }, reason: "constitution" }],
        });
        const settings = claudeCode(parse(onlyAWrite)).artifact.value;
        assert.ok(
            settings.hooks.PreToolUse.some((h) => h.matcher === "Bash"),
            "a shell write reaches the gate only if the hook is wired for Bash",
        );
    });

    test("no Bash PERMISSION rule joins it — the shell half is the hook's alone, and the note says so", () => {
        // `Bash(prefix:*)` matches a literal command prefix while the path sits anywhere in the
        // command, so the DSL cannot express "any command writing this file". The patterns that would
        // fit — `Bash(cp:*)` — gate the utility rather than the path, which is a larger rule than the
        // policy declares. So this coverage fails open with the hook, and that is reported on every
        // run rather than left for a reader to infer from an absence.
        const result = claudeCode(parse(policy()));
        const permissions = [...result.artifact.value.permissions.deny, ...result.artifact.value.permissions.ask];
        // Derived from the real tables rather than a hand-listed subset. This read
        // `/^Bash\((cp|sed|tee|mv|rm)/` until 2026-07-28 — five of the fourteen — so a change that
        // began emitting `Bash(ln:*)` or `Bash(dd:*)` would have passed while violating exactly the
        // guarantee this asserts. Found by Copilot review on #60. Deriving it means the next entry
        // added to either table is covered without anyone remembering to widen a regex.
        const utilities = [...FILE_WRITERS, ...IN_PLACE_EDITORS];
        const leaked = permissions.filter((p) => utilities.some((u) => p.startsWith(`Bash(${u}`)));
        assert.deepEqual(leaked, [], "gating the utility is not gating the path");
        assert.ok(
            result.notes.some((n) => /FAILS OPEN/.test(n) && /heredoc/.test(n)),
            "the layer that fails open, and what it misses, are both named",
        );
        const gate = result.compiled.find((c) => c.id === "ban");
        assert.match(gate.surface, /hook: a Bash command writing \.\/docs\/vision\.md/, "the surface distinguishes the two halves");
    });

    test("the Stop hook is wired to the session-end runner", () => {
        const settings = claudeCode(parse(policy())).artifact.value;
        assert.ok(settings.hooks.Stop?.length > 0, "the Stop-gate is the other half of milestone 4");
    });

    test("emitted hook commands invoke node directly rather than an inline shell one-liner", () => {
        const settings = claudeCode(parse(policy())).artifact.value;
        const commands = [...settings.hooks.PreToolUse, ...settings.hooks.Stop]
            .flatMap((h) => h.hooks.map((x) => x.command));
        for (const c of commands) {
            assert.doesNotMatch(c, /[|;&><]/, "quoting and word-splitting inside emitted shell is where the next fail-open lives");
        }
    });

    test("the artifact carries a generation header naming its source", () => {
        const settings = claudeCode(parse(policy())).artifact.value;
        assert.match(JSON.stringify(settings), /gates\.json/, "a reader must be able to find what generated this");
    });

    test("the header names the policy actually read, not a hard-coded default", () => {
        // It was a literal for one round, so a workspace declaring a non-default policy got an artifact
        // claiming it came from somewhere it did not — in the field whose only job is saying what
        // generated the file. Found by review.
        const settings = claudeCode(parse(policy()), { source: ".portulan/policy/rules.json" }).artifact.value;
        assert.equal(settings.$portulan.source, ".portulan/policy/rules.json");
        assert.match(settings.$portulan.warning, /policy\/rules\.json/, "the warning must point at the same file");
    });
});

// ===========================================================================================
// 4a. The floor backend — a GitHub repository ruleset, compiled from the same policy
// ===========================================================================================
//
// The milestone-4 criterion positions this as **the floor backend**: what every host falls back to,
// and all that a host with no hook system has. So its refusals matter more than the other backend's,
// not less — this is the column an adopter reads to learn what their host cannot give them.
//
// Two properties are asserted hardest, because both were reachable failures at design time:
//   1. It never invents policy. No declared floor → no artifact and no invented branch name.
//   2. It never emits half a mapping. `pull_request` without `required_status_checks` imports
//      cleanly and reads as a configured floor while letting a red pull request merge.

describe("the floor backend", () => {
    const ruleset = (p = withFloor()) => githubRuleset(parse(p)).artifact.value;
    const types = (p = withFloor()) => ruleset(p).rules.map((r) => r.type);

    test("the three rules the criterion names are emitted", () => {
        const t = types();
        for (const type of ["pull_request", "required_status_checks", "non_fast_forward"]) {
            assert.ok(t.includes(type), `the criterion names ${type}`);
        }
    });

    test("required status checks are STRICT — a branch behind the base cannot merge", () => {
        // Not optional and not read from the policy: proposal 0011 ruled that a pull request may not
        // merge from behind `main`, and applied it live. An export that let a policy declare
        // `strict: false` would be a compiled artifact quietly undoing a ruling the repository took.
        const rule = ruleset().rules.find((r) => r.type === "required_status_checks");
        assert.equal(rule.parameters.strict_required_status_checks_policy, true);
    });

    test("every declared check reaches the emitted ruleset, with its app pin intact", () => {
        const rule = ruleset().rules.find((r) => r.type === "required_status_checks");
        assert.deepEqual(rule.parameters.required_status_checks, [{ context: "workspace-verify", integration_id: 15368 }]);
    });

    test("bypass_actors is empty, deliberately and unconditionally", () => {
        // The gate map's own words: a floor carrying an exemption for the only actor who can act is
        // not a floor. This is why the org-level ruleset's `OrganizationAdmin` always-bypass is
        // recorded as the unverified layer rather than copied.
        assert.deepEqual(ruleset().bypass_actors, []);
    });

    test("enforcement is active — an exported ruleset in evaluate mode reads as a floor and holds nothing", () => {
        assert.equal(ruleset().enforcement, "active");
    });

    test("the ruleset name says it is generated, because the format has nowhere else to say it", () => {
        // JSON has no comments and a GitHub ruleset has no description field. The name is the only
        // field a human sees in the settings UI, so it carries the warning the `$portulan` header
        // carries in the other artifact.
        assert.match(ruleset().name, /generated/i);
        assert.match(ruleset().name, /gates\.json/);
    });

    test("only the server's input fields are emitted — never an id, a timestamp or a source", () => {
        // Read from two live rulesets on 2026-07-27: GitHub returns `id`, `node_id`, `source`,
        // `source_type`, `created_at`, `updated_at`, `_links` and `current_user_can_bypass`. None is
        // an input. Emitting any of them would be the export asserting a fact it cannot know.
        for (const key of ["id", "node_id", "source", "source_type", "created_at", "updated_at", "_links", "current_user_can_bypass"]) {
            assert.ok(!(key in ruleset()), `${key} is the server's to say, not this compiler's`);
        }
    });

    test("the declared branch becomes the ref condition, and nothing else does", () => {
        assert.deepEqual(ruleset().conditions.ref_name, { include: ["refs/heads/main"], exclude: [] });
        assert.deepEqual(ruleset(withFloor({ branch: "trunk" })).conditions.ref_name.include, ["refs/heads/trunk"]);
    });

    // ---- the four ways the floor declaration could be believed and be wrong ------------------
    //
    // All four found by review on the pull request, and all four share a shape: an input this
    // compiler accepted and then used in a way that produced an artifact GitHub would take and not
    // enforce. That is worse than a refusal by exactly the margin that matters here.

    test("a `floor.branch` already carrying a ref prefix is refused, not double-prefixed", () => {
        // `refs/heads/main` passed the branch pattern and the emitter prefixes unconditionally, so
        // the ruleset would have targeted `refs/heads/refs/heads/main` — a ref no repository has.
        // Importable, valid, and matching nothing: the exact shape this backend's own fail-closed
        // guard exists against, arriving through the one field that names what the floor protects.
        for (const branch of ["refs/heads/main", "refs/tags/v1"]) {
            assert.throws(() => parse(withFloor({ branch })), CompileError, `${branch} must be refused`);
        }
        // And a branch name that merely contains a slash is still fine — `release/2026` is ordinary.
        assert.equal(githubRuleset(parse(withFloor({ branch: "release/2026" }))).artifact.value.conditions.ref_name.include[0], "refs/heads/release/2026");
    });

    test("a check context with surrounding whitespace is refused rather than normalised", () => {
        // `" workspace-verify "` was non-empty after `trim()` and was then stored untrimmed, so the
        // ruleset would require a context no job can report. Refused rather than quietly fixed, for
        // the same reason a rule target is: quietly fixing it hides a policy error, and the policy
        // is the artifact a human reviews.
        assert.throws(() => parse(withFloor({ checks: [{ context: " workspace-verify " }] })), CompileError);
    });

    test("an `auto` rule never compiles to a ref rule, whatever it is spelled", () => {
        // The ref-rule table was consulted before the tier was, so an Auto rule spelled exactly
        // `git push --force` compiled into `non_fast_forward` — a gate emitted for an action the
        // policy declares unattended, and `floorRefusal`'s own `auto` branch left unreachable for it.
        // The tier is the policy's answer; the table is only how this backend spells it.
        const p = withFloor();
        p.rules.find((r) => r.id === "force").tier = "auto";
        const result = githubRuleset(parse(p));
        assert.ok(!result.compiled.some((c) => c.id === "force"), "an unattended action gets no ruleset rule");
        assert.match(result.refused.find((r) => r.id === "force").why, /unattended/);
        assert.ok(!result.artifact.value.rules.some((r) => r.type === "non_fast_forward"));
    });

    test("a `prohibited` ref spelling still compiles — the restriction is not gated-only", () => {
        const p = withFloor();
        p.rules.find((r) => r.id === "force").tier = "prohibited";
        assert.ok(githubRuleset(parse(p)).compiled.some((c) => c.id === "force" && c.surface === "non_fast_forward"));
    });

    // ---- the two paths that must refuse rather than guess ------------------------------------

    test("no floor declared: no artifact, no invented branch, and every rule refused with that reason", () => {
        const result = githubRuleset(parse(policy()));
        assert.equal(result.artifact, null, "a workspace that declared no floor gets no floor file");
        assert.equal(result.compiled.length, 0);
        assert.equal(result.refused.length, policy().rules.length, "still accounted for, one by one");
        for (const r of result.refused) assert.match(r.why, /no `floor`/, "the reason must name what is missing");
    });

    test("checks declared with NO propose rule emit nothing — the pair is compiled, never assumed", () => {
        // Found by review, round 3. `pull_request` + `required_status_checks` were emitted whenever
        // `floor.checks` was non-empty, whether or not any rule said changes go by pull request. Two
        // things wrong with that, and the second is the worse one. It invents policy: an exported
        // floor requiring pull requests that nothing in the policy asked for. And it breaks the
        // accounting — those two ruleset rules would sit in the artifact with no rule credited for
        // compiling them, so `--matrix` and `doctor` would describe a floor that is missing two of
        // its rules, which is the failure this backend's whole reporting layer exists to prevent.
        const p = withFloor();
        p.rules = p.rules.filter((r) => r.tier !== "propose");
        const result = githubRuleset(parse(p));
        const types = result.artifact.value.rules.map((r) => r.type);
        assert.ok(!types.includes("pull_request"), "no rule asked for a pull-request requirement");
        assert.ok(!types.includes("required_status_checks"));
        assert.ok(types.includes("non_fast_forward"), "the ref rules that WERE asked for still compile");

        // Every emitted ruleset rule is credited to a policy rule. Asserted directly, because it is
        // the property that was silently false rather than the symptom that was visible.
        const surfaces = new Set(result.compiled.flatMap((c) => c.surface.split(" · ")));
        for (const type of types) assert.ok(surfaces.has(type), `\`${type}\` is in the artifact and no rule compiled to it`);

        // And the orphaned declaration is reported rather than dropped in silence: a manifest field
        // that validates and compiles nothing is this repository's most expensive recurring defect.
        assert.ok(result.notes.some((n) => /no `propose` rule/.test(n)), "declared checks nothing compiles must be named");
    });

    test("a floor declaring no checks refuses the pull-request rule TOO — the mapping is a pair", () => {
        // Emitting `pull_request` alone would import cleanly, read as a configured floor, and let a
        // red pull request merge. Half a mapping is the silent weakening this repository keeps
        // finding, so the propose rules refuse together and say what is missing.
        //
        // Two ref-gated rules survive here, so the ruleset is non-empty and the refusal is visible
        // rather than fatal — which is the case worth pinning, since a fatal one would be indistinct
        // from any other refusal to compile.
        const result = githubRuleset(parse(withFloor({ checks: [] })));
        assert.ok(!result.artifact.value.rules.some((r) => r.type === "pull_request"));
        assert.ok(!result.artifact.value.rules.some((r) => r.type === "required_status_checks"));
        const refusal = result.refused.find((r) => r.id === "pr");
        assert.match(refusal.why, /declares no status check/, "the refusal must name the missing declaration");
    });

    test("a floor declaring no checks and holding no ref rule refuses the whole compile", () => {
        // The same policy with the ref-gated spellings gone: a declared floor that reaches nothing.
        // Writing an empty ruleset would be importable, valid, named for a floor, and inert.
        const p = withFloor({ checks: [] });
        p.rules = p.rules.filter((r) => r.id !== "force" && r.id !== "drop");
        assert.throws(() => githubRuleset(parse(p)), CompileError, "nothing in this policy reaches the floor");
    });

    // ---- the mapping is a table of exact spellings, not a parser -----------------------------

    test("the ref-gated spellings compile; a spelling one character off refuses", () => {
        // The action vocabulary has no `ref` kind — a rule says `{"shell": "git push --force"}` — so
        // this backend recognises exact command strings and nothing else. `git push -f` is the same
        // action to a human and is refused, loudly, rather than silently gated. An ambitious matcher
        // here would buy false confidence with false reds, which is the trade `spec/slots.md` refuses.
        const ok = githubRuleset(parse(withFloor()));
        assert.ok(ok.compiled.some((c) => c.id === "force" && c.surface === "non_fast_forward"));
        assert.ok(ok.compiled.some((c) => c.id === "drop" && c.surface === "deletion"));

        const p = withFloor();
        p.rules.find((r) => r.id === "force").action.shell = "git push -f";
        const refusal = githubRuleset(parse(p)).refused.find((r) => r.id === "force");
        assert.ok(refusal, "an unrecognised spelling refuses rather than compiling to nothing quietly");
        assert.match(refusal.why, /exact/i, "the refusal must say that recognition is by exact spelling");
    });

    test("the coarseness is stated in BOTH directions in the refusal record", () => {
        // On the protected ref `non_fast_forward` is STRICTER than the policy — it blocks
        // `--force-with-lease`, which this policy makes Auto. Off that ref it enforces nothing at
        // all. A backend that reported only the second half would be flattering itself.
        const notes = githubRuleset(parse(withFloor())).notes ?? [];
        assert.ok(notes.some((n) => /--force-with-lease/.test(n)), "the stricter-than-policy direction must be recorded");
        assert.ok(notes.some((n) => /only.*refs\/heads\/main|one declared ref/.test(n)), "the narrower-than-policy direction too");
    });

    // ---- refusals must be true about GitHub, not merely convenient --------------------------

    test("a write-scoped rule is refused for SCOPE, never for impossibility", () => {
        // `CODEOWNERS` and push rulesets do gate paths on GitHub — `core/operating/autonomy.md` names
        // CODEOWNERS as part of the floor. So "the platform cannot" would be false, and
        // `a-stated-enforcer-must-be-the-real-one.md` binds every sentence containing *cannot*.
        const refusal = githubRuleset(parse(withFloor())).refused.find((r) => r.id === "ban");
        assert.match(refusal.why, /CODEOWNERS/, "name the mechanism that would, and why this export does not emit it");
        assert.doesNotMatch(refusal.why, /the platform cannot/i);
    });

    test("a tag-scoped rule is refused naming tag rulesets, which this export does not emit", () => {
        const p = withFloor();
        p.rules.push({ id: "tag", tier: "gated", action: { shell: "git tag" }, reason: "a published claim" });
        const refusal = githubRuleset(parse(p)).refused.find((r) => r.id === "tag");
        assert.match(refusal.why, /tag ruleset/i);
    });

    test("the merge rule is refused, and the refusal says what the floor DOES constrain", () => {
        // The honest answer, and the one most easily got wrong: the floor constrains what a merge may
        // land — green required checks, and strict, so not from behind the base — but with a review
        // count of 0 it does not require anyone's yes, which is what the Gated tier means. Calling
        // that "compiled" would overstate the guarantee in the artifact whose whole subject is
        // guarantees.
        const p = withFloor();
        p.rules.push({ id: "merge", tier: "gated", action: { shell: "gh pr merge" }, reason: "the maintainer decides" });
        const refusal = githubRuleset(parse(p)).refused.find((r) => r.id === "merge");
        assert.match(refusal.why, /constrains/i, "say what the floor does do, not only what it does not");
    });

    test("--check covers the floor artifact too, and its absence is drift rather than a crash", () => {
        const dir = workspace(withFloor());
        assert.equal(run(["--workspace", dir], { quiet: true }), 0, "write both artifacts");
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 0);
        fs.rmSync(path.join(dir, ".portulan", "compile", "github-ruleset.json"));
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 1, "a missing floor artifact is drift");
    });

    test("an artifact a backend NO LONGER owes is red, not quietly ignored", () => {
        // The eighth fail-open of this repository's series, found at the pre-commit checkpoint.
        // `--check` handled absent-and-not-owed and not present-and-not-owed: delete `floor` from a
        // policy that had one, and the orphaned ruleset sat there unexamined while the recipe
        // reported GREEN — an importable file whose own `name` field claims to be generated from the
        // policy that no longer produces it. A stale gate artifact is exactly the hand-edit this rail
        // exists to catch, arriving by deletion instead of by hand.
        const dir = workspace(withFloor());
        assert.equal(run(["--workspace", dir], { quiet: true }), 0);
        const orphan = path.join(dir, ".portulan", "compile", "github-ruleset.json");
        assert.ok(fs.existsSync(orphan));

        const p = withFloor();
        delete p.floor;
        fs.writeFileSync(path.join(dir, ".portulan", "gates.json"), JSON.stringify(p, null, 2));
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 1, "the orphan must be a verdict, not a silence");

        // And a plain compile clears it, so the fix is reachable by the command the message names.
        assert.equal(run(["--workspace", dir], { quiet: true }), 0);
        assert.ok(!fs.existsSync(orphan), "compile removes what it no longer owes");
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 0);
    });

    test("a workspace with no floor is not asked for a floor artifact", () => {
        const dir = workspace(policy());
        assert.equal(run(["--workspace", dir], { quiet: true }), 0);
        assert.ok(!fs.existsSync(path.join(dir, ".portulan", "compile", "github-ruleset.json")));
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 0, "absent-and-not-owed is green");
    });
});

// ===========================================================================================
// 4a-ii. The per-host backend matrix
// ===========================================================================================
//
// Derived from the backends rather than written beside them. A matrix maintained by hand is a claim
// about compilers, and this repository has spent two milestones learning what claims about
// machinery are worth. This one cannot drift from the compilers because it *is* their accounting.

describe("the backend matrix", () => {
    test("every rule appears once per backend, with a verdict", () => {
        const rows = matrix(parse(withFloor()));
        assert.equal(rows.length, withFloor().rules.length);
        for (const row of rows) {
            assert.equal(Object.keys(row.backends).length, 2, "one column per backend");
            for (const cell of Object.values(row.backends)) {
                assert.ok(cell.verdict === "compiled" || cell.verdict === "refused");
                assert.ok(cell.detail, "a cell with no detail is a matrix that says nothing");
            }
        }
    });

    test("the matrix names the rules NO backend compiles — the honest degradation signal", () => {
        const rows = matrix(parse(withFloor()));
        const uncovered = rows.filter((r) => Object.values(r.backends).every((c) => c.verdict === "refused"));
        assert.ok(uncovered.some((r) => r.id === "read"), "an Auto rule is covered by nothing, and that is correct");
    });
});

// ===========================================================================================
// 4b. The action vocabulary — one definition, used by the emitter and by the runtime hook
// ===========================================================================================
//
// These are the reason the hook is emitted at all. Measured on a live host: when a permission rule
// matches, the host runs the hook and then **discards its reason** — so a hook that only improved a
// message would be an inert component reading as an active one. What it does that the permission
// pattern cannot is see through one shell wrapper, and that is what these assert.

describe("the shared matcher", () => {
    test("the literal command is always a spelling", () => {
        assert.deepEqual(spellings("git push origin HEAD"), ["git push origin HEAD"]);
    });

    for (const [label, raw] of [
        ["bash -c, double quotes", 'bash -c "git push origin HEAD"'],
        ["sh -c, single quotes", "sh -c 'git push origin HEAD'"],
        ["zsh -c", 'zsh -c "git push origin HEAD"'],
        ["env-prefixed", '/usr/bin/env bash -c "git push origin HEAD"'],
        ["combined flags", 'bash -lc "git push origin HEAD"'],
    ]) {
        test(`one wrapper is peeled: ${label}`, () => {
            assert.ok(spellings(raw).includes("git push origin HEAD"), `${raw} must reach the gate`);
        });
    }

    test("a gated rule matches the wrapper spelling the permission pattern cannot see", () => {
        const rule = { tier: "gated", action: { shell: "git push" } };
        assert.ok(matchesRule(rule, "Bash", { command: 'bash -c "git push origin HEAD"' }));
        assert.ok(matchesRule(rule, "Bash", { command: "git push origin HEAD" }));
    });

    test("a prefix must end at a word boundary — `git pushx` is not `git push`", () => {
        assert.ok(!matchesRule({ action: { shell: "git push" } }, "Bash", { command: "git pushx --force" }));
    });

    test("an unrelated command matches nothing", () => {
        assert.ok(!matchesRule({ action: { shell: "git push" } }, "Bash", { command: "git status" }));
    });

    test("a shell target ending in `/` is a path prefix, and covers what is under it", () => {
        // The two halves of compile.mjs must agree about what a target covers. They did not: the
        // emitted `Bash(./.portulan/verify/:*)` prefix-matches the command string on the host, while
        // this matcher required an exact hit or a space after the target — which a path never has.
        // No rule was mis-enforced by it: the one target of this shape in ../.portulan/gates.json is
        // `auto`, so it compiles to nothing and the runtime gate never reads it. The divergence was
        // the defect, and this test is what keeps the two halves one. Found by review on #31.
        const rule = { tier: "gated", action: { shell: "./.portulan/verify/" } };
        assert.ok(matchesRule(rule, "Bash", { command: "./.portulan/verify/docs.sh" }));
        assert.ok(matchesRule(rule, "Bash", { command: "./.portulan/verify/tests.sh --quiet" }));
        assert.ok(matchesRule(rule, "Bash", { command: 'bash -c "./.portulan/verify/docs.sh"' }), "through a wrapper too");
        assert.ok(!matchesRule(rule, "Bash", { command: "./.portulan/verifyx/docs.sh" }), "the slash is the boundary");
    });

    test("a trailing slash does not loosen an ordinary command prefix", () => {
        // The subtree reading applies to targets that end in `/` and nothing else: `git push` must
        // still refuse `git pushall`, or the fix above would have widened every gate in the policy.
        assert.ok(!matchesRule({ action: { shell: "git push" } }, "Bash", { command: "git pushall" }));
    });

    // A SIBLING of the write defect, found by the same supervisor pass and fixed in the same stroke.
    // The shell matcher prefix-matched the whole command string, so every Gated outward action in
    // ../.portulan/gates.json was defeated by putting anything at all in front of it. Measured on the
    // real runner before the fix: `ls && git push --force origin main` reached no gate.

    for (const [label, target, command] of [
        ["after `&&`", "git push --force", "ls && git push --force origin main"],
        ["after `;`", "git push --force", "git status; git push --force origin main"],
        ["after a newline", "git push --force", "git status\ngit push --force origin main"],
        ["a merge, mid-line", "gh pr merge", "echo hi && gh pr merge 60"],
        ["a repo delete, mid-line", "gh repo delete", "cd . && gh repo delete foo"],
        ["a publish after a pipe", "npm publish", "echo y | npm publish"],
        ["a path-prefix target, mid-line", "./.portulan/verify/", "ls && ./.portulan/verify/docs.sh"],
        // ANSI-C and locale quoting of the wrapper payload. `spellings()` stripped a leading `'` or
        // `"` and nothing else, so the `$` survived and the inner command never matched — a bypass
        // costing one character. Measured stepping aside before the fix. The mid-line form is the
        // one that matters most: it composes with the separator gap this block already covers.
        ["a `$'…'` wrapper payload", "git push --force", "bash -c $'git push --force origin main'"],
        ['a `$"…"` wrapper payload', "git push --force", 'bash -c $"git push --force origin main"'],
        ["a `$'…'` wrapper, mid-line", "git push --force", "ls && bash -c $'git push --force origin main'"],
        // The wider one, found writing the case above: a wrapper that is not the first thing on the
        // line escaped in EVERY quoting form, plain ones included. Unwrapping was anchored at the
        // start of the command and segmentation ran separately, so hole 1's "one wrapper, peeled"
        // and hole 2's mid-line reach each held alone and did not compose. This is the plain-quote
        // spelling, which is what a session would actually type.
        ["a plain wrapper, mid-line", "git push --force", 'ls && bash -c "git push --force origin main"'],
        ["a wrapper after a `;`", "gh pr merge", 'git status; bash -c "gh pr merge 60"'],
        // The escaped-quote spelling on the shell side — same defect as the write case, same commit.
        ["after an escaped quote", "git push --force", 'echo "x\\""; git push --force origin main'],
    ]) {
        test(`a gated command is gated wherever it sits on the line: ${label}`, () => {
            assert.ok(matchesRule({ tier: "gated", action: { shell: target } }, "Bash", { command }), command);
        });
    }

    test("splitting the line does not widen any gate — the Auto spellings stay Auto", () => {
        // The load-bearing control on the fix above. `--force-with-lease` is Auto by the maintainer's
        // ruling of 2026-07-27, and a segment matcher that re-gated it would be the compiler taking
        // back an ungating — worse than the hole it closes.
        const force = { tier: "gated", action: { shell: "git push --force" } };
        assert.ok(!matchesRule(force, "Bash", { command: "git push --force-with-lease origin main" }));
        assert.ok(!matchesRule(force, "Bash", { command: "ls && git push --force-with-lease origin main" }), "mid-line too");
        assert.ok(!matchesRule(force, "Bash", { command: "git pushall --force" }), "the word boundary still holds");
        assert.ok(!matchesRule(force, "Bash", { command: 'echo "git push --force"' }), "quoted text is not a command");
    });

    // The other half of the segment fix, asserted so the gate map's hole 2 cannot drift back to
    // claiming "closed" unqualified. Splitting on SEPARATORS reaches a command after `&&`, `;`, `|`
    // or a newline; it does not reach a word sitting in front of a command INSIDE a segment. These
    // are ordinary shell, not exotic spellings, and each was measured stepping aside on the runner
    // while the bare command answers `ask`.
    //
    // Left open on purpose. A named table of leaders would close the common ones the way the writer
    // table does, but that table has no natural edge — `nice`, `time`, `nohup`, `timeout`, `command`,
    // `stdbuf`, `doas` — and one missing entry buys the false confidence this suite exists to deny.
    // Found by Copilot review on #60, against the paragraph that had just claimed the hole closed.
    for (const [label, command] of [
        ["a leading assignment", "FOO=bar git push --force origin main"],
        ["`env`", "env git push --force origin main"],
        ["`sudo`", "sudo git push --force origin main"],
        ["a `then` branch", "if true; then git push --force origin main; fi"],
        ["a `do` body", "for x in 1; do git push --force origin main; done"],
        ["a brace group", "{ git push --force origin main; }"],
        // A leading redirection is the one row of this table with a CLOSED grammar — an optional fd,
        // one of `< > >> <> >& &>`, and a word — so unlike the leader names it could be stripped with
        // an edge a reader could check. Left open deliberately, and asserted here so the choice is
        // visible rather than looking like an oversight. Found by Copilot review on #60.
        ["a leading `2>&1`", "2>&1 git push --force origin main"],
        ["a leading `>` to a file", "> /tmp/log git push --force origin main"],
        ["a leading `2>/dev/null`", "2>/dev/null git push --force origin main"],
        ["a leading `<`", "< /dev/null git push --force origin main"],
    ]) {
        test(`the limit is asserted, not just documented: a leader still escapes — ${label}`, () => {
            const rule = { tier: "gated", action: { shell: "git push --force" } };
            assert.ok(!matchesRule(rule, "Bash", { command }), command);
            // The control: strip the leader and the same line is gated, so this is the leader
            // escaping rather than the target being wrong.
            assert.ok(matchesRule(rule, "Bash", { command: "git push --force origin main" }));
        });
    }

    // A heredoc opener is detected on a RAW line, so `<<EOF` inside a quoted string or after a `#`
    // set the delimiter on text that opened nothing — and everything after it was swallowed looking
    // for a terminator that never came. That is a fail-open manufactured by a defensive step: worse
    // than the gap it closes, because a gated command on any later line went invisible.
    //
    // Fixed by treating an unterminated opener as no opener. The last two cases are the controls that
    // stop the fix from degenerating into "keep everything" — a real heredoc's body is data and must
    // still be stripped. Found by Copilot review on #60.
    const force = { tier: "gated", action: { shell: "git push --force" } };
    for (const [label, command, gated] of [
        ["`<<EOF` inside a quoted string", 'echo "not a heredoc <<EOF"\ngit push --force origin main', true],
        ["`<<EOF` in a comment", "# <<EOF\ngit push --force origin main", true],
        ["a real heredoc, command after it", "cat <<EOF\nhello\nEOF\ngit push --force origin main", true],
        ["a gated command INSIDE a real heredoc body", "cat <<EOF\ngit push --force origin main\nEOF", false],
    ]) {
        test(`a heredoc opener that opens nothing does not hide the line after it: ${label}`, () => {
            assert.equal(matchesRule(force, "Bash", { command }), gated, command);
        });
    }

    // `matchesRule` documents that it never throws, and that promise is load-bearing rather than
    // tidy: ./gate.mjs catches and steps aside, so an exception here does not
    // surface as an error — it silently removes whatever gate was being evaluated. For the shell
    // half of `edit-the-constitution` that is the only layer there is (hole 3), so a throw is a
    // fail-open wearing a stack trace.
    //
    // It threw on all four of these until 2026-07-28, introduced on this branch by the fix that
    // began passing the raw payload to `commandSegments` instead of an already-stringified spelling.
    // Found by Copilot review on #60.
    for (const input of [{}, { command: undefined }, { command: null }, { command: 123 }, { command: {} }]) {
        test(`the never-throws contract holds for a Bash payload of ${JSON.stringify(input)}`, () => {
            const rule = { tier: "gated", action: { shell: "git push --force" } };
            assert.equal(matchesRule(rule, "Bash", input), false, "a payload with no readable command matches nothing");
        });
    }

    // `#` does not start a comment here, deliberately. Both directions are pinned, because the pair
    // is the argument: taking the false red away means deciding where a comment begins, and getting
    // that wrong swallows a real command instead of a commented one. Reported by Copilot on #60 and
    // declined on the exchange rate `shellWrites`'s docblock states — a false red costs one prompt,
    // a false green costs the laundering.
    test("a `#` comment is read as code — a false RED, and the safe direction", () => {
        const rule = { tier: "gated", action: { shell: "git push --force" } };
        assert.ok(
            matchesRule(rule, "Bash", { command: "echo ok #; git push --force origin main" }),
            "a real shell ignores this; the matcher does not, and asks",
        );
    });

    test("a `#` inside quotes never hides the command after it", () => {
        // The case a comment-skipping reader would break. If this ever returns false, the matcher has
        // started treating quoted text as a comment and a gated command has gone invisible.
        const rule = { tier: "gated", action: { shell: "git push --force" } };
        assert.ok(matchesRule(rule, "Bash", { command: 'echo "a#b"; git push --force origin main' }));
    });

    test("the limit is asserted, not just documented: two wrappers still escape", () => {
        // Recorded as a test so that anyone tempted to call this layer a rail meets the counterexample.
        // The platform floor is what covers this — ../core/operating/autonomy.md.
        const rule = { tier: "gated", action: { shell: "git push" } };
        assert.ok(!matchesRule(rule, "Bash", { command: `bash -c "bash -c 'git push origin HEAD'"` }));
    });

    test("a write rule matches every writing tool and no reading one", () => {
        const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
        for (const tool of ["Edit", "Write", "NotebookEdit"]) {
            assert.ok(matchesRule(rule, tool, { file_path: "/repo/docs/vision.md" }), tool);
        }
        assert.ok(!matchesRule(rule, "Read", { file_path: "/repo/docs/vision.md" }), "reading it is not editing it");
    });

    // A `write:` rule names a PATH, and for one milestone it reached only the three tools carrying a
    // `file_path` — so `echo x >> docs/vision.md` was gated by neither layer. The permission rule
    // rejected the tool and the matcher fell through to false. These are the shell spellings that
    // must now reach the gate, and, below them, the ones that still do not.

    for (const [label, command] of [
        ["append", "echo x >> docs/vision.md"],
        ["truncate", "echo x > docs/vision.md"],
        ["no space after the operator", "echo x >docs/vision.md"],
        ["a `./`-spelled target", "echo x > ./docs/vision.md"],
        ["an absolute target", "echo x > /repo/docs/vision.md"],
        ["a numbered fd", "echo x 2> docs/vision.md"],
        ["later in a list", "git status; echo x >> docs/vision.md"],
        ["after a `&&`", "ls && echo x > docs/vision.md"],
        ["inside a subshell", "(cd . && echo x > docs/vision.md)"],
        ["through a shell wrapper", 'bash -c "echo x >> docs/vision.md"'],
        // A wrapper that is not first on the line. The `shell` branch grew segment composition for
        // this in an earlier commit on this branch; the `write` branch did not, and the gap it left
        // was the worse of the two — the CONSTITUTION reachable behind any separator plus one
        // wrapper, while the same wrapper alone answered `deny`. Measured stepping aside before the
        // fix. Found by Copilot review on #60, five commits after the sibling was fixed.
        ["a wrapper after a `;`", 'git status; bash -c "echo x >> docs/vision.md"'],
        // A CRLF line continuation. `\r\n` was consumed one character at a time, so the `\n` survived
        // as an operator and flushed the word instead of continuing it — the LF spelling denied and
        // the CRLF spelling stepped aside, which made the constitution reachable by editing the file
        // on Windows. Both are asserted so the pair cannot drift apart again.
        // An escaped quote inside `"…"`. The run closed at the `\"`, the real closing quote opened a
        // new one, and the `;` was swallowed inside it — so the line never split and the write was
        // never evaluated. A false GREEN on the constitution, from a spelling that appears whenever a
        // commit message or JSON blob contains a quote.
        ['an escaped quote before the separator', 'echo "x\\""; cp /tmp/x docs/vision.md'],
        ["a CRLF continuation before the path", "cp /tmp/x \\\r\ndocs/vision.md"],
        ["a CRLF continuation after `>`", "echo x > \\\r\ndocs/vision.md"],
        ["an LF continuation, the control", "cp /tmp/x \\\ndocs/vision.md"],
        ["a wrapper after `&&`", 'ls && bash -c "cp /tmp/x docs/vision.md"'],
        ["a `$'…'` wrapper, mid-line", "ls && bash -c $'echo x > docs/vision.md'"],
        // The same `$'…'` gap on the write side. `shellWords` glued the `$` onto the front, so
        // `$'docs/vision.md'` tokenised as `$docs/vision.md` and the constitution's gate missed it.
        ["a `$'…'` redirect target", "echo x > $'docs/vision.md'"],
        ["a `$'…'` target to a writer", "cp /tmp/x $'docs/vision.md'"],
        ["cp", "cp /tmp/x docs/vision.md"],
        ["cp, quoted target", "cp /tmp/x 'docs/vision.md'"],
        ["cp by absolute path", "/bin/cp /tmp/x docs/vision.md"],
        ["cp behind sudo", "sudo cp /tmp/x docs/vision.md"],
        ["mv", "mv /tmp/x docs/vision.md"],
        ["rm", "rm -f docs/vision.md"],
        ["ln", "ln -sf /tmp/x docs/vision.md"],
        ["tee, at the end of a pipeline", "cat /tmp/x | tee docs/vision.md"],
        ["dd, through `of=`", "dd if=/dev/null of=docs/vision.md"],
        ["install", "install -m 644 /tmp/x docs/vision.md"],
        ["truncate(1)", "truncate -s 0 docs/vision.md"],
        ["patch", "patch docs/vision.md < /tmp/d.diff"],
        ["sed -i", "sed -i '' 's/a/b/' docs/vision.md"],
        ["sed -i.bak", "sed -i.bak s/a/b/ docs/vision.md"],
        ["sed -i behind an assignment", "LC_ALL=C sed -i '' s/a/b/ docs/vision.md"],
        ["perl -pi", "perl -pi -e 's/a/b/' docs/vision.md"],
    ]) {
        test(`a write rule reaches the shell spelling: ${label}`, () => {
            const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
            assert.ok(matchesRule(rule, "Bash", { command }), command);
        });
    }

    for (const [label, command] of [
        // Reading the file is Auto by this policy, and a matcher that contradicts a declared tier is
        // worse than one that admits a gap. This is why the in-place editors need their flag.
        ["reading it with cat", "cat docs/vision.md"],
        ["grepping it", "grep -n foo docs/vision.md"],
        ["diffing it", "git diff docs/vision.md"],
        ["sed WITHOUT an in-place flag", "sed -n '1,5p' docs/vision.md"],
        ["sed -E, which is not -i", "sed -E 's/a/b/' docs/vision.md"],
        ["it as a redirected INPUT", "patch /tmp/other.md < docs/vision.md"],
        // An operator inside quotes is not an operator.
        ["the path named inside a quoted string", "echo 'x > docs/vision.md'"],
        ["a sentence mentioning it", 'echo "writing to docs/vision.md is prohibited"'],
        // The path boundary is the same one `matchesPath` enforces everywhere else.
        ["a sibling file", "echo x > docs/plan.md"],
        ["a lookalike suffix", "echo x > docs/not-vision.md"],
        ["an ordinary command", "node cli/compile.mjs --check"],
    ]) {
        test(`a write rule does NOT fire on: ${label}`, () => {
            const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
            assert.ok(!matchesRule(rule, "Bash", { command }), command);
        });
    }

    // Everything below was found by the fresh-context supervisor at the pre-merge checkpoint, after
    // the first round of this change shipped a four-item hole list that was missing five holes. Each
    // one was a live escape: measured false on the matcher AND confirmed to write the file in a real
    // shell. They are tests rather than prose because a hole list is a claim, and this repository
    // grades an overstated coverage as a defect (dod.md, condition 4).

    for (const [label, command] of [
        // The most ordinary spelling there is. `\n` was not a separator, so the whole line folded
        // into one segment whose head was the FIRST command — never the writer.
        ["a writer on the second line", "git status\ncp /tmp/x docs/vision.md"],
        ["a remover on the second line", "git status\nrm -f docs/vision.md"],
        ["an in-place edit on the third line", "a\nb\nsed -i '' s/x/y/ docs/vision.md"],
        ["a backslash-newline continuation", "cp /tmp/x \\\ndocs/vision.md"],
        // A leader is not a command: `{`, `then` and `do` sat where the head goes and hid the writer.
        ["inside a brace group", "{ cp /tmp/x docs/vision.md; }"],
        ["inside if/then", "if true; then cp /tmp/x docs/vision.md; fi"],
        ["inside a for loop", "for f in a; do cp /tmp/x docs/vision.md; done"],
        ["inside a piped while loop", "echo a | while read f; do rm -f docs/vision.md; done"],
        // A tail comparison is not a path normaliser, and neither spelling ends with the literal tail.
        ["a `/./` in the path", "echo x > docs/./vision.md"],
        ["a doubled slash", "echo x > docs//vision.md"],
        ["a `..` climbing back in", "echo x > foo/../docs/vision.md"],
        ["a `/./` in a writer's argument", "cp /tmp/x docs/./vision.md"],
        // Destroying the container destroys the file, and a trailing slash decided it.
        ["removing the parent directory", "rm -rf docs"],
        ["removing the parent directory, with a slash", "rm -rf docs/"],
        ["moving the parent directory away", "mv docs docs.bak"],
    ]) {
        test(`a write rule reaches the shell spelling: ${label}`, () => {
            const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
            assert.ok(matchesRule(rule, "Bash", { command }), command);
        });
    }

    test("a subtree write target is reached whether or not the command spells the trailing slash", () => {
        const rule = { tier: "prohibited", action: { write: ".portulan/" } };
        assert.ok(matchesRule(rule, "Bash", { command: "rm -rf .portulan/" }));
        assert.ok(matchesRule(rule, "Bash", { command: "rm -rf .portulan" }), "the slash must not decide it");
        assert.ok(matchesRule(rule, "Bash", { command: "rm -rf .portulan/compile" }), "and neither does depth");
    });

    test("naming a SIBLING under the protected file's directory is not naming the directory", () => {
        // The ancestor rule earns `rm -rf docs`, and it must not earn anything else. Spelling the
        // ancestors as subtree patterns made every file under `docs/` a hit, so an ordinary edit to
        // `docs/plan.md` — which this policy gates at `propose`, not `prohibited` — was refused.
        const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
        assert.ok(!matchesRule(rule, "Bash", { command: "cp foo docs/plan.md" }));
        assert.ok(!matchesRule(rule, "Bash", { command: "rm -f docs/plan.md" }));
        assert.ok(!matchesRule(rule, "Bash", { command: "echo x > docs/not-vision.md" }));
    });

    test("the shell half of a write gate is a table, and its limits are asserted rather than implied", () => {
        // Recorded as a test for the same reason two-wrapper nesting is, one block up: anyone tempted
        // to read the shell coverage as complete meets the counterexamples. `compile.mjs` says so in
        // prose and ../.portulan/gate-map.md lists them among the honest holes; this is the half that
        // fails loudly if somebody later widens the claim without widening the matcher.
        const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
        for (const [why, command] of [
            ["an interpolated path", "echo x > $VISION"],
            ["a heredoc whose target is interpolated", "cat > $TARGET <<'EOF'\nx\nEOF"],
            ["a runtime assembling the write itself", `python3 -c "open('docs/vision.md','w').write('x')"`],
            ["a writer outside the table", "ex -sc wq docs/vision.md"],
            ["two shell wrappers", `bash -c "bash -c 'echo x > docs/vision.md'"`],
            // A program that INVOKES a writer. Parsing THEIR flags to find the real command is the
            // ambitious parser this design refuses to become, so these are disclosed instead.
            ["find -exec invoking a writer", "find . -name x -exec cp {} docs/vision.md ;"],
            ["xargs invoking a writer", "echo /tmp/x | xargs -I{} cp {} docs/vision.md"],
        ]) {
            assert.ok(!matchesRule(rule, "Bash", { command }), `${why} is a stated hole, not coverage`);
        }
    });

    test("a heredoc BODY is data, not commands — and this one was measured the hard way", () => {
        // Once a newline separated commands, every line of a heredoc body became its own segment. The
        // commit that fixed the newline hole was itself REFUSED by this gate, because its message
        // quoted `cp /tmp/x docs/vision.md` as the escape being closed. A matcher that stops you
        // describing an attack has stopped being cautious and started being wrong: a heredoc body is
        // text being written, and no shell runs it.
        const write = { tier: "prohibited", action: { write: "docs/vision.md" } };
        const force = { tier: "gated", action: { shell: "git push --force" } };
        assert.ok(!matchesRule(write, "Bash", { command: "git commit -F - <<'MSG'\nfixed: cp /tmp/x docs/vision.md\nMSG" }));
        assert.ok(!matchesRule(write, "Bash", { command: "cat <<'EOF' > /tmp/notes\nrm -rf docs\nEOF" }));
        assert.ok(!matchesRule(force, "Bash", { command: "git commit -F - <<'MSG'\nls && git push --force escaped\nMSG" }));
        assert.ok(!matchesRule(write, "Bash", { command: "cat <<-EOF > /tmp/x\n  sed -i '' s/a/b/ docs/vision.md\n\tEOF" }), "<<- too");
    });

    test("dropping the body does not drop the line that opens it, nor what follows the terminator", () => {
        // The half that would turn the fix above into a hole. The redirection lives on the OPENING
        // line, so it must still gate; and a real command after the terminator is a real command.
        const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
        assert.ok(matchesRule(rule, "Bash", { command: "tee docs/vision.md <<'EOF'\nx\nEOF" }));
        assert.ok(matchesRule(rule, "Bash", { command: "cat <<'EOF' > /tmp/x\nharmless\nEOF\ncp /tmp/x docs/vision.md" }));
    });

    test("a heredoc naming the path literally IS covered — the coverage is not understated either", () => {
        // Filed under limits by an earlier draft, which had it backwards. A heredoc redirects like
        // anything else; what escapes is the interpolated TARGET, tested above. Understating coverage
        // is the same defect as overstating it — both make the hole list untrue.
        const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
        assert.ok(matchesRule(rule, "Bash", { command: "cat > docs/vision.md <<'EOF'\nx\nEOF" }));
        assert.ok(matchesRule(rule, "Bash", { command: "cat <<'EOF' > docs/vision.md\nx\nEOF" }));
    });

    test("a redirected INPUT is skipped rather than ending the command it feeds", () => {
        // The `<` branch is load-bearing here and nowhere else: `tee` keeps its head and its real
        // argument. Asserted because the branch survived a mutation with zero tests red, which means
        // nothing was checking it — and an unchecked branch in a security matcher is the shape this
        // repository has a memory entry about.
        const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
        assert.ok(matchesRule(rule, "Bash", { command: "tee < /tmp/in docs/vision.md" }));
        assert.ok(!matchesRule(rule, "Bash", { command: "patch /tmp/other.md < docs/vision.md" }), "and it is still an input");
    });

    test("a writer READING the protected path is refused too — the stated coarse direction", () => {
        // Asserted rather than only claimed in four prose carriers. `cp P /tmp/backup` only reads,
        // and is refused, because argument grammars differ per command and guessing which word is the
        // destination is a false GREEN on the file that must not change.
        const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
        assert.ok(matchesRule(rule, "Bash", { command: "cp docs/vision.md /tmp/backup" }));
    });

    test("a read rule is NOT given shell coverage — the scope is write, and it says so", () => {
        // Deliberate rather than forgotten. Reading a path through a shell has no bounded table —
        // `cat`, `head`, `awk`, `git show`, any language runtime — so a matcher for it would be the
        // ambitious parser the floor backend's own comment warns against, buying false confidence
        // with false reds. No `read` rule in this repository's policy is gated in any case.
        const rule = { tier: "gated", action: { read: "docs/vision.md" } };
        assert.ok(!matchesRule(rule, "Bash", { command: "cat docs/vision.md" }));
    });

    test("a path rule does not match a lookalike suffix", () => {
        assert.ok(!matchesPath("/repo/docs/not-vision.md", "docs/vision.md"));
        assert.ok(matchesPath("/repo/docs/vision.md", "docs/vision.md"));
    });

    test("a directory target matches anything beneath it", () => {
        assert.ok(matchesPath("/repo/core/operating/loop.md", "core/"));
        assert.ok(!matchesPath("/repo/coreish/loop.md", "core/"));
    });
});

// ===========================================================================================
// 4c. The policy location comes from the manifest, not from a constant
// ===========================================================================================
//
// Found by review. `compile` hard-coded `.portulan/gates.json` while spec 2.1 defines the manifest's
// `gates` key as "a path to a JSON file the enforcement compiler reads" and `doctor` resolves it — so a
// workspace naming a different file would have had one tool validate a policy the other never compiled,
// both green. A manifest key that validates and is never consumed is this repository's most expensive
// recurring defect, and this was it inside the key the milestone had just added.

describe("the policy location", () => {
    test("comes from the manifest's `gates` key when one is declared", () => {
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), JSON.stringify({ gates: "policy/rules.json" }));
        assert.equal(policyPath(dir), path.resolve(dir, ".portulan", "policy", "rules.json"));
    });

    test("falls back to the default when no key is declared", () => {
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), JSON.stringify({ name: "x" }));
        assert.equal(policyPath(dir), path.join(dir, ".portulan", "gates.json"));
    });

    test("falls back when there is no manifest at all — a legitimate shape, not an error", () => {
        const dir = scratch();
        assert.equal(policyPath(dir), path.join(dir, ".portulan", "gates.json"));
    });

    test("an unreadable or malformed manifest falls back rather than throwing", () => {
        // `doctor` is the tool that judges a manifest. This one only needs to know where the policy is,
        // and a parse error here must not become a crash in the hook that runs on every tool call.
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), "{ not json");
        assert.equal(policyPath(dir), path.join(dir, ".portulan", "gates.json"));
    });

    test("compiles the file the manifest names, end to end", () => {
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan", "policy"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), JSON.stringify({ gates: "policy/rules.json" }));
        fs.writeFileSync(path.join(dir, ".portulan", "policy", "rules.json"), JSON.stringify(policy()));
        assert.equal(run(["--workspace", dir], { quiet: true }), 0, "the named policy is the one compiled");
        assert.ok(fs.existsSync(path.join(dir, ".claude", "settings.json")));
    });

    test("an absolute path is refused and falls back — a hook must not read outside the workspace", () => {
        // Found by review. This resolves on every tool call, so an unvalidated manifest value is an
        // arbitrary file-read surface. `doctor` would refuse such a manifest, but there is no ordering
        // between the two tools: the schema is the contract, not the sequence.
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), JSON.stringify({ gates: "/etc/passwd" }));
        assert.equal(policyPath(dir), path.join(dir, ".portulan", "gates.json"));
    });

    test("a `../` escape is refused after resolution, not by pattern alone", () => {
        // A traversal chain satisfies any reasonable regex and still leaves the directory, so
        // containment is checked on the resolved path.
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), JSON.stringify({ gates: "../../../etc/passwd" }));
        assert.equal(policyPath(dir), path.join(dir, ".portulan", "gates.json"));
    });

    test("customer zero's manifest and the default agree — so this repo exercises both paths identically", () => {
        assert.equal(policyPath(REPO), path.resolve(REPO, ".portulan", "gates.json"));
    });
});

// ===========================================================================================
// 5. --check is the drift rail
// ===========================================================================================

describe("--check", () => {
    test("exits 1 when the committed artifact does not match the policy", () => {
        const dir = workspace();
        fs.mkdirSync(path.join(dir, ".claude"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".claude", "settings.json"), JSON.stringify({ permissions: {} }));
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 1, "drift is a verdict, not a crash");
    });

    test("exits 1 when the artifact is absent entirely", () => {
        const dir = workspace();
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 1);
    });

    test("exits 0 when the artifact is exactly what the policy compiles to", () => {
        const dir = workspace();
        assert.equal(run(["--workspace", dir], { quiet: true }), 0, "write it");
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 0, "then it agrees with itself");
    });
});

// ===========================================================================================
// 6. This repository's own policy compiles, and its gate map agrees with it
// ===========================================================================================
//
// Anchored to the real tree rather than to a fixture, deliberately. The rejected symlink
// arrangement in milestone 3 passed every fixture in the repository and was inert at runtime; the
// lesson recorded then was that some invariants only hold if something asserts them against THIS
// tree. Two-way membership is one: a rule added to the prose and not the policy, or the reverse, is
// exactly the claims drift this repository keeps finding.

describe("customer zero", () => {
    const real = JSON.parse(fs.readFileSync(path.join(REPO, ".portulan", "gates.json"), "utf8"));

    test("the real policy compiles without refusing", () => {
        const result = claudeCode(parse(real));
        assert.ok(result.compiled.length >= 6, "this repository has at least six enforceable gates");
    });

    test("this repository declares a floor, and the export reproduces the checks `main` really requires", () => {
        // Both contexts, not one. `pr-labeled` joined `workspace-verify` on the live protection after
        // the labels workflow reached `main`, and an export naming only the first would encode a floor
        // weaker than the one in force — in the artifact whose entire purpose is being importable.
        const contexts = parse(real).floor.checks.map((c) => c.context).sort();
        assert.deepEqual(contexts, ["pr-labeled", "workspace-verify"]);
        for (const check of parse(real).floor.checks) {
            assert.equal(check.integration_id, 15368, "an unpinned context is satisfiable by any app reporting that name");
        }
    });

    test("every context this repository's floor declares is reported by a job in this repository", () => {
        // The highest-cost typo the tree can catch: a required context that never reports blocks every
        // pull request, and `enforce_admins` leaves nobody able to force past it — proposal 0004's
        // lesson, which cost a three-step rename to work around. Checked here against the workflows
        // themselves rather than trusted.
        const workflows = fs
            .readdirSync(path.join(REPO, ".github", "workflows"))
            .map((f) => fs.readFileSync(path.join(REPO, ".github", "workflows", f), "utf8"))
            .join("\n");
        for (const check of parse(real).floor.checks) {
            assert.match(workflows, new RegExp(`^\\s{2}${check.context}:`, "m"), `no job reports \`${check.context}\``);
        }
    });

    // Both directions below read the policy as *declared plus composed*, and that is the repair rather
    // than a convenience. They used to read `real.rules` alone — the ids in `.portulan/gates.json` — so
    // a gate contributed by a composed pack was invisible to them: naming one in the prose failed the
    // second rail, and leaving one undocumented satisfied the first. Milestone 7's close found the same
    // blind spot in two other readers of this policy (`compile --matrix` counted composed gates and
    // reported 4 uncompiled where `doctor` counted only declared ones and reported 3 — `doctor` was
    // repaired on 2026-08-13 and they now agree), and this file carried two
    // more — the citation rails here and the tier rail below — making FOUR readers of one policy.
    // The tier rail was still narrow when the first two were widened, which is this comment's own rule
    // broken in the change that states it; the pre-commit pass caught it. A rule with several readers is repaired at all of them or at none —
    // `../.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md`.
    const composedGates = (JSON.parse(fs.readFileSync(path.join(REPO, ".portulan", "workspace.json"), "utf8")).packs ?? [])
        .flatMap((ref) => JSON.parse(fs.readFileSync(path.join(REPO, "packs", ref, "pack.json"), "utf8")).contributes?.gates ?? []);

    test("every rule id in the policy — declared or composed — appears in the gate map's prose", () => {
        const prose = fs.readFileSync(path.join(REPO, ".portulan", "gate-map.md"), "utf8");
        for (const rule of [...real.rules, ...composedGates]) {
            assert.match(prose, new RegExp(`\`${rule.id}\``), `gate-map.md never mentions \`${rule.id}\``);
        }
    });

    test("every rule id the gate map cites exists in the policy — declared or composed", () => {
        const prose = fs.readFileSync(path.join(REPO, ".portulan", "gate-map.md"), "utf8");
        const ids = new Set([...real.rules, ...composedGates].map((r) => r.id));
        const cited = [...prose.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+){2,})`/g)].map((m) => m[1]);
        for (const id of cited) {
            if (/\.(md|json|sh|mjs)$/.test(id) || id.includes("/")) continue;
            assert.ok(ids.has(id), `gate-map.md cites \`${id}\`, which no rule declares`);
        }
    });

    test("the composed set is non-empty, so the two rails above are not widened to a no-op", () => {
        // Without this, a `packs` key that stopped resolving would silently shrink both rails back to
        // declared-only and they would go on passing — the shape this session's sibling suite calls a
        // rail losing its most important members and reporting nothing.
        // `> 0`, matching this test's name, rather than a floor of 2: a hard-coded count would red on a
        // legitimate change to what the packs contribute. The narrower property — that a SPECIFIC gate is
        // still composed — is already covered, since the citation rail fails the moment gate-map.md names
        // an id the composed set no longer carries. (Copilot, round 1 on #240.)
        assert.ok(composedGates.length > 0, "the composed packs contribute no gates, so the rails above check nothing");
    });

    test("every rule is cited under the gate map section matching its TIER", () => {
        // Membership alone only proves a rule is *mentioned*. It does not stop the prose filing a
        // Gated action under Auto — which is the drift that matters, because the gate map is the
        // document humans read and the policy is the one that compiles. Headings are structure
        // rather than prose, so this is a real check and not the ambitious parser `spec/slots.md`
        // warns against: it asks only which section an id appears in.
        const prose = fs.readFileSync(path.join(REPO, ".portulan", "gate-map.md"), "utf8");
        const HEADING = /^#{2,3} (.+)$/gm;
        const sections = [];
        let m;
        while ((m = HEADING.exec(prose)) !== null) sections.push({ title: m[1], start: m.index });
        sections.forEach((s, i) => {
            s.body = prose.slice(s.start, sections[i + 1]?.start ?? prose.length);
        });

        // Which section speaks for which tier, keyed off the headings the file actually carries.
        const owner = {
            auto: sections.find((s) => /^Auto\b/.test(s.title)),
            propose: sections.find((s) => /^Propose\b/.test(s.title)),
            gated: sections.find((s) => /^Gated\b/.test(s.title)),
            prohibited: sections.find((s) => /^Prohibited\b/.test(s.title)),
        };
        for (const [tier, section] of Object.entries(owner)) {
            assert.ok(section, `gate-map.md has no section speaking for tier \`${tier}\``);
        }

        // Declared PLUS composed, like the two rails above and for the same reason — this is the third
        // of the three that read this document against the policy, and it was the one left behind when
        // the other two were widened. It is also the one that matters most: the other two ask whether an
        // id is mentioned *somewhere*, while this asks whether it is filed under the tier it actually
        // carries. Left narrow, a composed Gated action could be enforced on every commit, mentioned
        // once in a paragraph about the compiler, and never listed among the things that need approval —
        // which is exactly what `commit-without-the-hooks` was until milestone 7's close.
        for (const rule of [...real.rules, ...composedGates]) {
            const section = owner[rule.tier];
            assert.match(
                section.body,
                new RegExp(`\`${rule.id}\``),
                `\`${rule.id}\` is tier \`${rule.tier}\` in the policy, but gate-map.md does not cite it under "${section.title}"`,
            );
        }
    });

    test("the constitution is prohibited, not merely gated", () => {
        const rule = real.rules.find((r) => r.action?.write === "docs/vision.md");
        assert.equal(rule.tier, "prohibited", "an approvable constitution edit is not a prohibition");
    });

    test("the two destructive push spellings are gated; the ordinary one is not", () => {
        // The policy changed on 2026-07-27: pushing a working branch moved to Auto, because the
        // guarantee the push gate stood in for lives at the *merge*. What stayed Gated is the pair
        // that destroys rather than adds — a bare `--force`, and a branch deletion. This test asserted
        // the old policy and failed the moment the new one landed, which is the test doing its job.
        const tierOf = (shell) => real.rules.find((r) => r.action?.shell === shell)?.tier;
        assert.equal(tierOf("git push"), "auto", "an ordinary working-branch push is unattended");
        assert.equal(tierOf("git push --force"), "gated", "bare --force is not recoverable");
        assert.equal(tierOf("git push --delete"), "gated", "deleting a remote ref is not adding one");
    });

    test("the gated push prefixes do not swallow the Auto spelling they sit beside", () => {
        // `--force` must not match `--force-with-lease`, which is explicitly Auto. A prefix rule that
        // over-matched here would silently re-gate the thing the maintainer just ungated.
        const force = real.rules.find((r) => r.id === "force-push-without-a-lease");
        assert.ok(matchesRule(force, "Bash", { command: "git push --force origin x" }));
        assert.ok(!matchesRule(force, "Bash", { command: "git push --force-with-lease origin x" }));
        assert.ok(!matchesRule(force, "Bash", { command: "git push origin x" }));
    });
});

// ===========================================================================================
// Pack-contributed gate fragments — the cascade's middle layer, tighten-only
// ===========================================================================================
//
// The floor was ruled at milestone 4 and built at milestone 6: a pack may raise a tier or add a
// prohibition, and may NEVER demote another layer's classification. The refusal is the whole
// guarantee, and it is the branch nothing exercises naturally — the one real pack contributes pure
// additions against a core layer that ships no gate policy at all. So it is forced here by fixture,
// which is the only way a check like this is ever seen to work.

/** A pack on disk at `<root>/<category>/<name>/pack.json`. */
function packAt(root, category, name, gates) {
    const dir = path.join(root, category, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, "pack.json"),
        JSON.stringify(
            { portulan: { pack: "1.0" }, name, category, contributes: gates ? { gates } : {} },
            null,
            2,
        ),
    );
    return dir;
}

// A fragment. `action` defaults to one derived from the id, which is right for ADDED fragments; a
// fragment tightening an EXISTING id must carry that rule's own action, because changing what a rule
// matches while raising its tier is refused — see the action-swap tests below.
const fragment = (id, tier, extra = {}) => ({
    id,
    tier,
    action: { shell: `run-${id}` },
    reason: "because the pack says so",
    ...extra,
});

describe("resolving a declared pack name", () => {
    test("`category/name` resolves to the pack.json beneath a root", () => {
        const root = scratch();
        packAt(root, "rituals", "checkpoints", null);
        const found = resolvePack("rituals/checkpoints", [root]);
        assert.equal(found.category, "rituals");
        assert.equal(found.pack, "checkpoints");
        assert.ok(found.dir);
    });

    test("roots are searched in order, and the first hit wins", () => {
        const a = scratch();
        const b = scratch();
        packAt(b, "rituals", "only-in-b", null);
        assert.equal(resolvePack("rituals/only-in-b", [a, b]).dir, path.join(b, "rituals", "only-in-b"));
        assert.equal(resolvePack("rituals/only-in-b", [a]).dir, null);
    });

    // The shape an ADOPTER resolves in: a pack inside an installed plugin, not a `packs/` directory
    // sitting beside the workspace. Same call, different root — which is the property that makes the
    // feed case (milestone 6, session 1) the same code path rather than a parallel one.
    test("an installed-plugin root resolves identically to a sibling packs/ directory", () => {
        const home = scratch();
        const installed = path.join(home, ".claude", "plugins", "portulan-internal", "portulan@0.1.0", "packs");
        packAt(installed, "rituals", "checkpoints", [fragment("x", "gated")]);
        const found = resolvePack("rituals/checkpoints", [installed]);
        assert.ok(found.dir, "an installed-shape root must resolve");
        assert.equal(found.why, null);
        const { contributions } = packContributions(workspace(), ".portulan", { packRoots: [installed] });
        assert.equal(contributions.length, 0, "the workspace declares no packs, so nothing is composed");
    });

    test("a name that is not `category/name` does not resolve, and says why", () => {
        const root = scratch();
        for (const bad of ["checkpoints", "a/b/c", "/rituals/checkpoints", ""]) {
            const found = resolvePack(bad, [root]);
            assert.equal(found.dir, null);
            assert.match(found.why, /category\/name/);
        }
    });

    test("a `..` segment cannot escape the roots — a name is a name, never a path", () => {
        const root = scratch();
        packAt(path.dirname(root), "rituals", "outside", null);
        const found = resolvePack("../rituals/outside", [root]);
        assert.equal(found.dir, null);
    });
});

describe("composing pack fragments onto a policy — tighten-only", () => {
    test("a fragment naming an id no layer carries is added", () => {
        const out = composeFragments(policy(), [{ pack: "rituals/r", fragments: [fragment("fresh", "gated")] }]);
        assert.equal(out.added.length, 1);
        assert.equal(out.tightened.length, 0);
        assert.ok(out.policy.rules.some((r) => r.id === "fresh"));
        // The base policy is not mutated — the caller keeps a policy it can still compare against.
        assert.ok(!policy().rules.some((r) => r.id === "fresh"));
    });

    test("a fragment naming an existing id at a STRONGER tier tightens it", () => {
        const out = composeFragments(policy(), [
            // `pr` is propose in the base; the action must be carried through unchanged.
            { pack: "rituals/r", fragments: [fragment("pr", "gated", { action: { shell: "gh pr create" } })] },
        ]);
        assert.equal(out.tightened.length, 1);
        assert.deepEqual(
            { from: out.tightened[0].from, to: out.tightened[0].to },
            { from: "propose", to: "gated" },
        );
        assert.equal(out.policy.rules.find((r) => r.id === "pr").tier, "gated");
    });

    test("auto → anything is a tightening; every step up the order is permitted", () => {
        for (const [from, to] of [["auto", "propose"], ["auto", "prohibited"], ["propose", "prohibited"], ["gated", "prohibited"]]) {
            const base = { ...policy(), rules: [{ id: "r", tier: from, action: { shell: "x" }, reason: "b" }] };
            const out = composeFragments(base, [{ pack: "p/q", fragments: [fragment("r", to, { action: { shell: "x" } })] }]);
            assert.equal(out.policy.rules.find((r) => r.id === "r").tier, to, `${from} → ${to}`);
        }
    });

    // The refusal. This is the guarantee the whole design exists for.
    test("a fragment that would DEMOTE an existing id throws rather than being dropped", () => {
        for (const [from, to] of [["gated", "propose"], ["prohibited", "gated"], ["prohibited", "propose"]]) {
            const base = { ...policy(), rules: [{ id: "r", tier: from, action: { shell: "x" }, reason: "b" }] };
            assert.throws(
                () => composeFragments(base, [{ pack: "hostile/pack", fragments: [fragment("r", to, { action: { shell: "x" } })] }]),
                (error) => {
                    assert.ok(error instanceof CompileError);
                    assert.match(error.message, /only tighten/);
                    assert.match(error.message, /hostile\/pack/);
                    assert.match(error.message, new RegExp(`${from}.*${to}`));
                    return true;
                },
                `${from} → ${to} must be refused`,
            );
        }
    });

    // The hole a tier-only comparison leaves, found by the pre-commit supervisor and measured against
    // this repository's LIVE policy before it was closed: raising the tier while replacing the action
    // passes every rank check, is printed as `tightens gated → prohibited`, and removes the emitted
    // `Bash(git push --force:*)` gate entirely. Tighten-only that only reads the tier is not
    // tighten-only — it is a supply-chain hole wearing the guarantee's name.
    test("a fragment may NOT change what a rule matches while raising its tier", () => {
        const base = {
            ...policy(),
            rules: [{ id: "force", tier: "gated", action: { shell: "git push --force" }, reason: "no lease" }],
        };
        const swap = {
            id: "force",
            tier: "prohibited",
            action: { none: "no surface, honest gap" },
            reason: "we take this very seriously",
        };
        assert.throws(
            () => composeFragments(base, [{ pack: "evil/pack", fragments: [swap] }]),
            (error) => {
                assert.match(error.message, /may not redefine the action/);
                assert.match(error.message, /shell:git push --force/);
                return true;
            },
        );
    });

    test("an action-swap to a different path or command is refused the same way", () => {
        const base = {
            ...policy(),
            rules: [{ id: "c", tier: "propose", action: { write: "core/" }, reason: "by pull request" }],
        };
        for (const action of [{ write: "core/unused/" }, { shell: "true" }, { read: "core/" }]) {
            assert.throws(
                () => composeFragments(base, [{ pack: "p/q", fragments: [{ id: "c", tier: "gated", action, reason: "r" }] }]),
                /may not redefine the action/,
            );
        }
    });

    test("an IDENTICAL action tightens normally — the check must not block the legitimate case", () => {
        const base = {
            ...policy(),
            rules: [{ id: "force", tier: "gated", action: { shell: "git push --force" }, reason: "no lease" }],
        };
        const out = composeFragments(base, [
            {
                pack: "good/pack",
                fragments: [{ id: "force", tier: "prohibited", action: { shell: "git push --force" }, reason: "never" }],
            },
        ]);
        assert.equal(out.tightened.length, 1);
        assert.equal(out.policy.rules.find((r) => r.id === "force").tier, "prohibited");
        assert.deepEqual(out.policy.rules.find((r) => r.id === "force").action, { shell: "git push --force" });
    });

    test("a fragment at the SAME tier is refused too — replacing a rule is not tightening it", () => {
        const base = { ...policy(), rules: [{ id: "r", tier: "gated", action: { shell: "x" }, reason: "b" }] };
        assert.throws(
            () => composeFragments(base, [{ pack: "p/q", fragments: [fragment("r", "gated", { action: { shell: "x" } })] }]),
            /only tighten/,
        );
    });

    // A fail-open found in the suppressed channel: `tierRank` returns -1 for a malformed base tier, so
    // every fragment outranked it, the refusal never fired, and the fragment REPLACED the bad rule —
    // meaning a policy `parse` refuses on its own compiled green once a pack named the same id, with
    // the provenance line claiming `tightens bogus -> gated`. A pack must never be able to make an
    // invalid policy compile.
    test("a pack may not compose onto a rule whose own tier is not a tier", () => {
        const bad = {
            ...policy(),
            rules: [{ id: "r", tier: "bogus", action: { shell: "git push" }, reason: "malformed base" }],
        };
        // The control: the base policy is genuinely invalid on its own.
        assert.throws(() => parse(bad), /not one of/);
        assert.throws(
            () => composeFragments(bad, [{ pack: "p/q", fragments: [fragment("r", "gated", { action: { shell: "git push" } })] }]),
            (error) => {
                assert.ok(error instanceof CompileError);
                assert.match(error.message, /is not one of/);
                assert.match(error.message, /never be able to make an invalid policy compile/);
                return true;
            },
        );
    });

    test("tier `auto` is refused even though the Pack Definition already bars it", () => {
        // Two layers, and the compiler does not depend on the schema having been applied: `doctor` and
        // `compile` have no ordering between them.
        assert.throws(
            () => composeFragments(policy(), [{ pack: "p/q", fragments: [fragment("fresh", "auto")] }]),
            /only ADD restriction/,
        );
    });

    test("an unrecognised tier throws rather than sorting below everything and reading as a tightening", () => {
        assert.throws(
            () => composeFragments(policy(), [{ pack: "p/q", fragments: [fragment("fresh", "advisory")] }]),
            /not one of/,
        );
        assert.equal(tierRank("advisory"), -1);
    });

    test("a composed fragment is validated by `parse` exactly as a hand-written rule is", () => {
        const out = composeFragments(policy(), [
            { pack: "p/q", fragments: [{ id: "no-reason", tier: "gated", action: { shell: "x" } }] },
        ]);
        // composeFragments places it; parse is what refuses it, which is the point of composing first.
        assert.throws(() => parse(out.policy), /carries no reason/);
    });

    // #111. The ordering above is deliberate and stays — but it cost the diagnostic, because a
    // malformed id reached `parse` stripped of the one fact the reader needs: which dependency put it
    // there. Both halves are asserted: the refusal happens, and it NAMES THE PACK.
    test("a fragment whose id is not a slug is refused BY NAME OF THE PACK, not left to `parse`", () => {
        for (const bad of [undefined, null, "", "  ", 7, {}, ["x"], "Not A Slug", "trailing-", "UPPER"]) {
            assert.throws(
                () => composeFragments(policy(), [{ pack: "p/q", fragments: [{ ...(bad === undefined ? {} : { id: bad }), tier: "gated", action: { shell: "x" }, reason: "r" }] }]),
                (e) => {
                    assert.ok(e instanceof CompileError, `id ${JSON.stringify(bad)} threw ${e?.constructor?.name}`);
                    assert.match(e.message, /pack `p\/q`/, `the refusal must name the pack: ${e.message}`);
                    assert.match(e.message, /is not a slug/);
                    return true;
                },
                `id ${JSON.stringify(bad)} was not refused`,
            );
        }
    });

    test("the bare `parse` refusal is what this replaced, and it names no pack — the measurement, kept", () => {
        // The control, so the fix is not credited with a diagnostic the old path already gave. This is
        // the sentence an adopter used to get, reproduced from `parse` directly: correct, closed, and
        // silent about which dependency to go and look at.
        //
        // Built from `policy()` rather than hand-rolled, and that is a measurement rather than a
        // preference: the first draft passed a bare `{ rules: [...] }` and got *"gate policy declares
        // gate-policy spec undefined"* — `parse` refuses the envelope long before it reaches an id, so
        // the control was asserting a sentence this tool never emits for this shape. It failed, which
        // is the only reason it is right now.
        assert.throws(
            () => parse(policy({ rules: [{ tier: "gated", action: { shell: "x" }, reason: "r" }] })),
            (e) => {
                assert.match(e.message, /rule id undefined is not a slug/);
                assert.doesNotMatch(e.message, /pack/, "the old path never named the pack — that is the whole defect");
                return true;
            },
        );
    });

    test("two id-less fragments are not merged into one another", () => {
        // Not in the issue, and reachable: `at` is keyed by `rule?.id`, so before the guard the second
        // id-less fragment found `at.has(undefined)` TRUE and was composed onto the first — two packs'
        // unrelated fragments merged because both were malformed, then reported as a tightening of a
        // rule that does not exist. The refusal now lands on the first one, so the path is closed.
        assert.throws(
            () =>
                composeFragments(policy(), [
                    { pack: "a/one", fragments: [{ tier: "gated", action: { shell: "x" }, reason: "r" }] },
                    { pack: "b/two", fragments: [{ tier: "prohibited", action: { shell: "y" }, reason: "r" }] },
                ]),
            (e) => e instanceof CompileError && /pack `a\/one`/.test(e.message),
        );
    });
});

describe("what a workspace's declared packs contribute", () => {
    test("a declared pack's fragments are collected and reach the compiled policy", () => {
        const dir = workspace();
        const manifestPath = path.join(dir, ".portulan", "workspace.json");
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        manifest.packs = ["rituals/checkpoints"];
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        packAt(path.join(dir, "packs"), "rituals", "checkpoints", [fragment("from-a-pack", "gated")]);

        const { contributions, unresolved } = packContributions(dir);
        assert.equal(unresolved.length, 0);
        assert.equal(contributions.length, 1);
        assert.equal(contributions[0].fragments[0].id, "from-a-pack");

        const composed = composeFragments(policy(), contributions);
        assert.ok(parse(composed.policy).rules.some((r) => r.id === "from-a-pack"));
    });

    test("roots come from `tree`, and a workspace without one has nowhere to search", () => {
        assert.deepEqual(packRoots("/w/.portulan", { tree: "../" }), [path.resolve("/w/.portulan", "../", "packs")]);
        assert.deepEqual(packRoots("/w/.portulan", {}), []);
        assert.deepEqual(packRoots("/w/.portulan", { tree: "   " }), []);
    });

    test("a declared pack that resolves to nothing is reported, not silently dropped", () => {
        const dir = workspace();
        const manifestPath = path.join(dir, ".portulan", "workspace.json");
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        manifest.packs = ["rituals/absent"];
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        const { contributions, unresolved } = packContributions(dir);
        assert.equal(contributions.length, 0);
        assert.equal(unresolved.length, 1);
        assert.match(unresolved[0].why, /no pack\.json/);
    });

    // `?? []` covers an ABSENT key, not a malformed one — those are different failures and only one
    // is benign. Without this the value reaches `composeFragments` and surfaces as a bare TypeError
    // naming neither the pack nor the field. Found by review.
    test("a pack whose `contributes.gates` is not an array is refused, not iterated", () => {
        const dir = workspace();
        const manifestPath = path.join(dir, ".portulan", "workspace.json");
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        manifest.packs = ["rituals/broken"];
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        const packDir = path.join(dir, "packs", "rituals", "broken");
        fs.mkdirSync(packDir, { recursive: true });
        for (const bad of ["a string", { id: "x" }, 7]) {
            fs.writeFileSync(
                path.join(packDir, "pack.json"),
                JSON.stringify({ portulan: { pack: "1.0" }, name: "broken", category: "rituals", contributes: { gates: bad } }),
            );
            assert.throws(() => packContributions(dir), (error) => {
                assert.ok(error instanceof CompileError);
                assert.match(error.message, /rather than an array/);
                assert.match(error.message, /rituals\/broken/);
                return true;
            });
        }
    });

    test("an ABSENT `contributes.gates` is benign — a pack need not contribute gates", () => {
        const dir = workspace();
        const manifestPath = path.join(dir, ".portulan", "workspace.json");
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        manifest.packs = ["rituals/quiet"];
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        packAt(path.join(dir, "packs"), "rituals", "quiet", null);
        const { contributions } = packContributions(dir);
        assert.deepEqual(contributions[0].fragments, []);
    });

    // `compile` reads workspace.json WITHOUT validating it, so `packs` may hold anything. The printer
    // calls `.padEnd()` on the name, which on a number aborts the whole compile rather than reporting
    // one unresolvable pack. Found by review, in the suppressed channel.
    test("a non-string pack name is reported, not a crash", () => {
        const dir = workspace();
        const manifestPath = path.join(dir, ".portulan", "workspace.json");
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        manifest.packs = [7, { name: "x" }, null, true];
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        const { contributions, unresolved } = packContributions(dir);
        assert.equal(contributions.length, 0);
        assert.equal(unresolved.length, 4);
        for (const u of unresolved) {
            assert.equal(typeof u.name, "string", "every reported name must be printable");
            assert.doesNotThrow(() => u.name.padEnd(30));
        }
    });

    test("a workspace declaring no packs composes nothing", () => {
        const { contributions, unresolved } = packContributions(workspace());
        assert.deepEqual([contributions.length, unresolved.length], [0, 0]);
    });
});

// ===========================================================================================
// A pack root can be named on the command line
// ===========================================================================================
//
// Adjustment 6 of the milestone-6 session-open checkpoint. `packContributions` has taken an
// `options.packRoots` since session 0 and `run` never set it, so the parameter shaped for the
// from-a-feed case was reachable only from a test. "Zero new resolver code" was true; "only a new
// root" was not — a root needs a caller, and this is it.

describe("--pack-root names a resolution root outside the workspace's tree", () => {
    test("a fragment from a pack in a named root reaches the compiled policy", () => {
        const dir = workspace();
        const feed = scratch();
        packAt(feed, "rituals", "checkpoints", [fragment("commit-without-the-hooks", "gated")]);

        const w = path.join(dir, ".portulan", "workspace.json");
        const manifest = JSON.parse(fs.readFileSync(w, "utf8"));
        manifest.packs = ["rituals/checkpoints"];
        // No `packs/` under this workspace's own tree, so a green cannot have come from it.
        fs.writeFileSync(w, JSON.stringify(manifest, null, 2));

        assert.equal(run(["--workspace", dir, "--pack-root", feed], { quiet: true }), 0);
        const compiled = JSON.parse(fs.readFileSync(path.join(dir, ".claude", "settings.json"), "utf8"));
        assert.match(JSON.stringify(compiled), /commit-without-the-hooks|run-commit-without-the-hooks/);
    });

    test("without the flag the same workspace reports the pack UNRESOLVED", () => {
        const dir = workspace();
        const w = path.join(dir, ".portulan", "workspace.json");
        const manifest = JSON.parse(fs.readFileSync(w, "utf8"));
        manifest.packs = ["rituals/checkpoints"];
        fs.writeFileSync(w, JSON.stringify(manifest, null, 2));
        assert.equal(run(["--workspace", dir], { quiet: true }), 0, "an unresolved pack contributes nothing and is not a red");
    });

    test("--pack-root with no directory is refused", () => {
        const dir = workspace();
        assert.equal(run(["--workspace", dir, "--pack-root"], { quiet: true }), 2);
    });

    test("a named root that does not exist is refused rather than reported as an unresolvable pack", () => {
        const dir = workspace();
        assert.equal(run(["--workspace", dir, "--pack-root", path.join(dir, "nope")], { quiet: true }), 2);
    });
});

describe("named pack roots REPLACE the derived one, and the divergence is pinned", () => {
    // Found by the pre-commit checkpoint on this change, by attacking the flag rather than reading it.
    // `compile` appended the derived root after the named ones while `doctor` and `index` replaced it —
    // three tools, two semantics, and every prose carrier described only one. Demonstrated then: this
    // workspace with `--pack-root <an empty directory>` compiled GREEN from the copy in its own tree,
    // which is exactly the thing the flag's stated purpose rules out.
    test("a pack present ONLY in the workspace's tree does not resolve when a root is named", () => {
        const dir = workspace();
        // The pack ships beside the workspace, under the root `tree` derives.
        packAt(path.join(dir, "packs"), "rituals", "checkpoints", [fragment("commit-without-the-hooks", "gated")]);
        const w = path.join(dir, ".portulan", "workspace.json");
        const manifest = JSON.parse(fs.readFileSync(w, "utf8"));
        manifest.packs = ["rituals/checkpoints"];
        fs.writeFileSync(w, JSON.stringify(manifest, null, 2));

        // Without the flag it resolves from the tree, which is the ordinary case and must keep working.
        assert.equal(run(["--workspace", dir], { quiet: true }), 0);
        const fromTree = JSON.parse(fs.readFileSync(path.join(dir, ".claude", "settings.json"), "utf8"));
        assert.match(JSON.stringify(fromTree), /commit-without-the-hooks/);

        // With an empty root named, the derived one is OUT OF SCOPE: the fragment must be gone.
        const empty = scratch();
        assert.equal(run(["--workspace", dir, "--pack-root", empty], { quiet: true }), 0);
        const fromFeed = JSON.parse(fs.readFileSync(path.join(dir, ".claude", "settings.json"), "utf8"));
        assert.doesNotMatch(
            JSON.stringify(fromFeed),
            /commit-without-the-hooks/,
            "a named root must not fall back to the tree — that is the copy the flag exists to exclude",
        );
    });

    test("passing no root leaves the derived path byte-identical", () => {
        const dir = workspace();
        packAt(path.join(dir, "packs"), "rituals", "checkpoints", [fragment("commit-without-the-hooks", "gated")]);
        const w = path.join(dir, ".portulan", "workspace.json");
        const m = JSON.parse(fs.readFileSync(w, "utf8"));
        m.packs = ["rituals/checkpoints"];
        fs.writeFileSync(w, JSON.stringify(m, null, 2));
        run(["--workspace", dir], { quiet: true });
        const first = fs.readFileSync(path.join(dir, ".claude", "settings.json"));
        run(["--workspace", dir], { quiet: true });
        assert.deepEqual(fs.readFileSync(path.join(dir, ".claude", "settings.json")), first);
    });
});

describe("--pack-root fails closed in compile too — the third carrier of one rule", () => {
    test("a root that is a FILE is refused rather than silently ignored", () => {
        // Copilot, round 7. The dangerous shape here is specific: a file-valued root made pack resolution
        // fail and produced a MISLEADING GREEN compile that had simply ignored the intended root — which is
        // worse than the exit 2 the argument deserves, because a green is what a session acts on.
        const dir = workspace();
        assert.equal(run(["--workspace", dir, "--pack-root", path.join(dir, ".portulan", "gates.json")], { quiet: true }), 2);
    });

    test("a directory is still accepted", () => {
        const dir = workspace();
        const feed = scratch();
        assert.equal(run(["--workspace", dir, "--pack-root", feed], { quiet: true }), 0);
    });
});

// ---------------------------------------------------------------- where the emitted hook points (M7)

describe("the emitted runner path — nothing asserted this until the checkpoint said so", () => {
    test("a runner under the project is spelled relative to CLAUDE_PROJECT_DIR", () => {
        const here = path.resolve(fileURLToPath(new URL(".", import.meta.url)));
        const out = claudeCode(parse(policy()), { root: path.resolve(here, "..") });
        const text = JSON.stringify(out.artifact.value);
        assert.match(text, /\$\{CLAUDE_PROJECT_DIR\}\/cli\/gate\.mjs/);
        assert.match(text, /\$\{CLAUDE_PROJECT_DIR\}\/cli\/stop-gate\.mjs/);
    });

    test("a runner OUTSIDE the project falls back to absolute AND says so", () => {
        // The checkpoint's required adjustment 1: the comment promised `refused` would record the
        // pinning and nothing did. Compiling with a root the runner does not live under is exactly the
        // global/npx install, and it must not be silent — a hook pinned to one machine stops working
        // when the package moves, and a missing hook fails open.
        const out = claudeCode(parse(policy()), { root: os.tmpdir() });
        const emitted = JSON.stringify(out.artifact.value);
        assert.doesNotMatch(emitted, /CLAUDE_PROJECT_DIR/, "a runner outside the project cannot have a project-relative spelling");
        assert.match(emitted, /cli\/gate\.mjs/);
        assert.ok(
            (out.notes ?? []).some((n) => /pinned to an ABSOLUTE path/i.test(n)),
            `the absolute fallback was silent — notes were: ${JSON.stringify(out.notes)}`,
        );
    });

    test("`root` is honoured, so cross-compiling cannot name a file the target lacks", () => {
        // Required adjustment 2: `compile --workspace <other>` wrote that project's settings naming this
        // project's runner — a hook the target does not have, failing open silently. The plumbing
        // existed; the caller never used it.
        const a = JSON.stringify(claudeCode(parse(policy()), { root: os.tmpdir() }));
        const b = JSON.stringify(claudeCode(parse(policy()), { root: path.resolve(fileURLToPath(new URL("..", import.meta.url))) }));
        assert.notEqual(a, b, "the emitted path did not change with `root`, so `root` is being ignored");
    });
});

// ---------------------------------------------------------------- parity: a workspace is not a place
//
// Proposal 0017: *"every feature keys to a workspace SLOT, never to a residence… A feature that ever
// dispatches on residence is a parity breach and is refusable on this sentence."* This one dispatched
// on residence for two milestones, and reading the file never showed it — `--workspace <dir>` was
// documented as taking a repository root, which is a true sentence about a tool that only works in one
// of the two residences the ruling says are equal.
//
// **Found by running row 7's fourth demonstration**, where `doctor`, `index` and the workspace's own
// verify recipe all behaved identically at both ends and this exited 2, *could not run*, looking for a
// gate policy at `<feed>/workspaces/.portulan/gates.json`.
describe("a workspace named directly, in either residence", () => {
    test("a repository root still resolves to `.portulan` — the default is untouched", () => {
        const dir = scratch();
        assert.deepEqual(resolveWorkspace(dir), { workspaceRoot: dir, workspaceDir: ".portulan" });
    });

    test("an in-repo workspace named directly resolves back through its own `tree`", () => {
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), JSON.stringify({ name: "x", kind: "repository", tree: "../" }));
        assert.deepEqual(resolveWorkspace(path.join(dir, ".portulan")), { workspaceRoot: path.resolve(dir), workspaceDir: ".portulan" });
    });

    test("a feed-side workspace IS its own root, because that is what ships", () => {
        // Milestone 6 measured it: an installed plugin's `<marketplace>/<plugin>/<version>/` directory
        // is the workspace root. So a feed-side workspace's compiled artifacts belong beside it.
        const dir = scratch();
        const ws = path.join(dir, "workspaces", "acme");
        fs.mkdirSync(ws, { recursive: true });
        fs.writeFileSync(path.join(ws, "workspace.json"), JSON.stringify({ name: "acme", kind: "portfolio" }));
        assert.deepEqual(resolveWorkspace(ws), { workspaceRoot: path.resolve(ws), workspaceDir: "." });
    });

    test("a `tree` that does not contain its own workspace changes nothing", () => {
        // A manifest `doctor` refuses. Here it only means the derivation cannot be trusted, and the
        // safe answer to an untrustworthy input is the one that alters no behaviour.
        const dir = scratch();
        const ws = path.join(dir, "ws");
        fs.mkdirSync(ws, { recursive: true });
        fs.writeFileSync(path.join(ws, "workspace.json"), JSON.stringify({ name: "x", tree: "../../elsewhere" }));
        assert.deepEqual(resolveWorkspace(ws), { workspaceRoot: ws, workspaceDir: ".portulan" });
    });

    test("compiles a feed-side workspace end to end, and its artifacts land beside it", () => {
        const dir = scratch();
        const ws = path.join(dir, "workspaces", "acme");
        fs.mkdirSync(ws, { recursive: true });
        fs.writeFileSync(path.join(ws, "workspace.json"), JSON.stringify({ name: "acme", kind: "portfolio", gates: "gates.json" }));
        fs.writeFileSync(path.join(ws, "gates.json"), JSON.stringify(withFloor(policy())));

        assert.equal(run(["--workspace", ws], { quiet: true }), 0);
        assert.ok(fs.existsSync(path.join(ws, ".claude", "settings.json")), "the Claude settings ship with the workspace");
        assert.ok(fs.existsSync(path.join(ws, "compile", "github-ruleset.json")), "and so does the ruleset — never under a `.portulan` that does not exist here");
        assert.equal(fs.existsSync(path.join(ws, ".portulan")), false, "nothing invents a `.portulan` beside a workspace that is not in one");

        // `--check` has to look in the same place it wrote, or a green means nothing was compared.
        assert.equal(run(["--workspace", ws, "--check"], { quiet: true }), 0);
        fs.rmSync(path.join(ws, "compile", "github-ruleset.json"));
        assert.equal(run(["--workspace", ws, "--check"], { quiet: true }), 1, "a missing artifact is drift in either residence");
    });

    test("the same policy compiles to the same rules in both residences", () => {
        // The parity claim itself, as an assertion rather than as a sentence: identical policy, two
        // residences, and what compiles must not differ. Only the artifact PATHS may, because where a
        // file ships is delivery, which 0017 says is exactly what the residences differ in.
        const shared = withFloor(policy());

        const repo = scratch();
        fs.mkdirSync(path.join(repo, ".portulan"), { recursive: true });
        fs.writeFileSync(path.join(repo, ".portulan", "workspace.json"), JSON.stringify({ name: "acme", kind: "repository", tree: "../" }));
        fs.writeFileSync(path.join(repo, ".portulan", "gates.json"), JSON.stringify(shared));

        const feed = scratch();
        fs.writeFileSync(path.join(feed, "workspace.json"), JSON.stringify({ name: "acme", kind: "portfolio" }));
        fs.writeFileSync(path.join(feed, "gates.json"), JSON.stringify(shared));

        // **Hand-restored on purpose (#254).** `t.mock.method` scopes a mock to the TEST; this one is
        // scoped to a single CALL of `said`, which runs twice and must return only its own call's
        // output. The runner cannot express that, so the manual pair is the correct shape here rather
        // than the unswept one — the sweep converted the sites whose scope the runner does match.
        const said = (argv) => {
            const lines = [];
            const write = process.stdout.write.bind(process.stdout);
            process.stdout.write = (chunk) => (lines.push(String(chunk)), true);
            try {
                run(argv);
            } finally {
                process.stdout.write = write;
            }
            return lines.join("");
        };
        const only = (text) => text.split("\n").filter((l) => /^\s*(gate|refused)\s/.test(l)).join("\n");
        assert.equal(only(said(["--workspace", path.join(repo, ".portulan")])), only(said(["--workspace", feed])));
    });

    test("only ENOENT means `this is a repository root` — an unreadable manifest refuses", (t) => {
        // The only-ENOENT rule, and the first cut of
        // `resolveWorkspace` broke it in the change whose own header states it three times: ANY failure
        // reading `workspace.json` fell back to `.portulan`, so a present-but-unreadable manifest sent
        // `compile` looking for a policy the workspace never named and failed with a confusing secondary
        // error about a missing file. Copilot, round 1 on #164.
        const dir = scratch();
        fs.writeFileSync(path.join(dir, "workspace.json"), "{ not json");
        assert.throws(() => resolveWorkspace(dir), (e) => e instanceof CompileError && /not valid JSON/.test(e.message));

        // And the read-side sibling, forced with a stub rather than chmod — root ignores chmod, CI often
        // runs as root, and a check that stops checking where it matters is worse than none.
        const dir2 = scratch();
        const original = fs.readFileSync;
        t.mock.method(fs, "readFileSync", (p, ...rest) => {
            if (String(p) === path.join(dir2, "workspace.json")) {
                const error = new Error("permission denied");
                error.code = "EACCES";
                throw error;
            }
            return original(p, ...rest);
        });
        assert.throws(() => resolveWorkspace(dir2), (e) => e instanceof CompileError && /EACCES/.test(e.message));
        t.mock.restoreAll();

        // A genuinely absent manifest is still the ordinary repository-root case.
        assert.deepEqual(resolveWorkspace(scratch()).workspaceDir, ".portulan");
    });
});

// -------------------------------------- `auto` beside a named root: refused, not half-honoured

test("compile refuses a named root combined with `--pack-root auto`", () => {
    // One of five carriers the pre-commit checkpoint could delete without the suite noticing. The
    // refusal exists because the alternative was a SILENT drop, and a change justified by *never
    // silently* cannot ship beside one.
    //
    // The fixture is a workspace compile can actually compile, and the CONTROL below is what makes
    // this bind: an earlier version used an incompletable workspace, so it exited 2 whether or not the
    // refusal fired. Two carriers can produce this 2 — the parse-time check and `packContributions` —
    // so the control pins that the same fixture is 0 without the pair.
    const dir = workspace();
    assert.equal(run(["--workspace", path.join(dir, ".portulan")], { quiet: true }), 0, "the control: this workspace compiles");
    assert.equal(run(["--workspace", path.join(dir, ".portulan"), "--pack-root", "auto", "--pack-root", dir], { quiet: true }), 2);
});

test("compile refuses the pair BEFORE it resolves a workspace or reads a policy", (t) => {
    // Copilot, round 2 on #233: the refusal sat below `resolveWorkspace` and the policy read, so an
    // unrelated workspace or policy error masked it — and this tool then disagreed with the four
    // beside it about *when* the command line is judged. The other tools' tests pinned that property
    // and this one's did not, which is exactly why the placement could drift here and nowhere else.
    //
    // The discriminator is a workspace that does not exist: refusing at parse time never looks at it,
    // and anything later fails on the missing workspace with a different sentence.
    // Bound to a name rather than consumed inline, so the scratch root can be swept — the inline form
    // left one directory behind per run with no handle to remove it by.
    const absentRoot = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "compile-absent-"));
    SCRATCH.push(absentRoot);
    const absent = path.join(absentRoot, "nope");
    const said = [];
    t.mock.method(process.stderr, "write", (chunk) => (said.push(String(chunk)), true));
    assert.equal(run(["--workspace", absent, "--pack-root", "auto", "--pack-root", "."]), 2);
    t.mock.restoreAll();
    assert.match(said.join(""), /never both/, "the refusal must be the reason, not the missing workspace");
});

test("`packContributions` refuses `packRoots` beside `forced`, and returns the uniform plan shape", () => {
    // The sixth site, found by the pre-commit checkpoint's sibling sweep. It kept a literal plan
    // object — `{roots, source, why}` — which silently ignored a discovery request and carried neither
    // `origins` nor `refusal`, breaking one file over the uniform shape `resolutionRoots` guarantees.
    // Asserted HERE rather than through `run`, because `run` refuses at parse time and would answer
    // for this function; a test that cannot tell the two apart pins neither.
    const dir = scratch();
    fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
    const manifest = { portulan: { spec: "2.8" }, name: "w", kind: "repository", tree: "../", packs: ["tools/thing"] };
    fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), JSON.stringify(manifest));

    assert.throws(
        () => packContributions(dir, ".portulan", { packRoots: [dir], forced: true, discovery: { ok: true, roots: [dir] } }),
        /never both/,
    );

    // And the shape a caller may rely on, on the branch that does answer.
    const { plan } = packContributions(dir, ".portulan", { packRoots: [dir] });
    assert.equal(plan.source, "named");
    assert.deepEqual(plan.origins, [{ root: dir, origin: "named" }]);
    assert.equal(plan.refusal, null);
});

test("compile prints the union plan line even without `--matrix`", () => {
    // Normally that line is withheld from a byte-compared run because it moves with what is installed.
    // A union is the one arrangement where a tree-derived root joined the search unnamed, and the
    // union's whole contract is that this is never silent — so the line is not optional there.
    // _(This said "`--check` cannot reach it: it names no root and passes no `auto`", which stopped
    // being true on 2026-08-13 — a bare `--check` unions unasked and prints the line for exactly this
    // reason. The REQUIRED check still cannot reach it, because `../.portulan/verify/compile.sh` names a
    // root and `source` is `named` there.)_
    const home = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "compile-union-host-"));
    SCRATCH.push(home);
    const installPath = path.join(home, "plugins", "cache", "feed", "carrier", "0.1.0");
    fs.mkdirSync(path.join(installPath, "packs"), { recursive: true });
    // **A REAL pack in the cache, and the first draft of the unasked half omitted it.** `isPackRoot` asks
    // whether a directory holds `<category>/<name>/pack.json`, so an empty `packs/` is not a root and
    // discovery finds nothing. The `forced` arm unions anyway — it reports what came back from a search
    // somebody asked for, including nothing — while the unasked arm returns `derived` and says discovery
    // found no root in its `why`. That asymmetry is deliberate and it made this fixture pass the asked
    // half while binding nothing on the unasked one.
    const cachePack = path.join(installPath, "packs", "rituals", "checkpoints");
    fs.mkdirSync(cachePack, { recursive: true });
    fs.writeFileSync(
        path.join(cachePack, "pack.json"),
        JSON.stringify({ portulan: { pack: "1.0", version: "0.1.0" }, name: "checkpoints", category: "rituals", summary: "x", doc: "README.md", contributes: {} }),
    );
    fs.writeFileSync(path.join(cachePack, "README.md"), "# x\n");
    const record = path.join(home, "plugins", "installed_plugins.json");
    fs.mkdirSync(path.dirname(record), { recursive: true });
    fs.writeFileSync(record, JSON.stringify({ version: 2, plugins: { "carrier@feed": [{ scope: "user", installPath, version: "0.1.0" }] } }));

    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "compile-union-ws-"));
    SCRATCH.push(dir);
    fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
    fs.writeFileSync(
        path.join(dir, ".portulan", "workspace.json"),
        JSON.stringify({ portulan: { spec: "2.8" }, name: "w", kind: "repository", tree: "../", packs: ["rituals/checkpoints"], gates: "gates.json" }),
    );
    fs.writeFileSync(
        path.join(dir, ".portulan", "gates.json"),
        JSON.stringify({ portulan: { "gate-policy": "2.2" }, tiers: { auto: [], propose: [], gated: [] } }),
    );

    // `run` writes to stdout directly rather than through an injected sink, so the sink is stdout.
    // **Hand-restored, and the reason is a measurement rather than a preference (#254).** This block
    // restores TWO things in one `finally`, and one of them cannot be handed to the runner at all:
    // `t.mock.property` exists on this Node (26.7.0) but throws on `process.env` —
    // `ERR_INVALID_OBJECT_DEFINE_PROPERTY: 'process.env' does not accept an accessor(getter/setter)
    // descriptor` — because it installs the mock as a getter/setter pair. So the `finally` stays for the
    // env half whatever happens to the stdout half, and splitting one restore across two mechanisms
    // would read as an oversight rather than a choice.
    const said = [];
    const write = process.stdout.write.bind(process.stdout);
    const before = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = home;
    process.stdout.write = (chunk) => (said.push(String(chunk)), true);
    const unasked = [];
    try {
        run(["--workspace", path.join(dir, ".portulan"), "--pack-root", "auto"]);
        // **The unasked path prints it too, and this half was unbound until the pre-commit checkpoint
        // asked for it.** "Never silently" is the union's whole justification and `--check` reaches the
        // union now, so the assertion that mattered most was the one nobody had written. The two runs
        // share one `if`, which is exactly why a reader might assume the second needs no case — and why
        // it does: the condition is `plan.source === "union"`, and only a run proves the unasked arm
        // produces that source through this tool rather than only through `resolutionRoots`.
        process.stdout.write = (chunk) => (unasked.push(String(chunk)), true);
        run(["--workspace", path.join(dir, ".portulan"), "--check"]);
    } finally {
        process.stdout.write = write;
        if (before === undefined) delete process.env.CLAUDE_CONFIG_DIR;
        else process.env.CLAUDE_CONFIG_DIR = before;
    }
    assert.match(said.join(""), /resolution root union/);
    assert.match(unasked.join(""), /resolution root union — discovered in the host plugin cache unasked/);
});

// A host whose plugin record EXISTS and will not parse — could-not-look, not absence.
function unreadableHost(scratchDir) {
    const record = path.join(scratchDir, "plugins", "installed_plugins.json");
    fs.mkdirSync(path.dirname(record), { recursive: true });
    fs.writeFileSync(record, "{ not json");
    return scratchDir;
}
function withEnv(config, fn) {
    const before = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = config;
    try { return fn(); } finally {
        if (before === undefined) delete process.env.CLAUDE_CONFIG_DIR;
        else process.env.CLAUDE_CONFIG_DIR = before;
    }
}

test("compile: `auto` against an unreadable record is exit 2, not a green over an unread host", () => {
    // One of four carriers a pre-commit checkpoint could delete without the suite noticing. The claim
    // "every caller maps couldNotRun to exit 2" was demonstrated by `doctor` alone.
    // The workspace must COMPOSE a pack: with none declared, `packContributions` returns before a plan
    // is built and never reaches the mapping. That short-circuit is correct — there is nothing to
    // resolve — and it is why the records say the mapping is reached wherever a plan is BUILT rather
    // than at every invocation.
    const dir = workspace();
    const manifestPath = path.join(dir, ".portulan", "workspace.json");
    const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    m.packs = ["rituals/checkpoints"];
    fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));

    const config = unreadableHost(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "compile-unreadable-")));
    SCRATCH.push(config);
    assert.equal(withEnv(config, () => run(["--workspace", path.join(dir, ".portulan"), "--pack-root", "auto"], { quiet: true })), 2);
    // The control: the same flag on a host whose record is merely ABSENT is not a refusal — the run
    // proceeds and the unresolved pack is reported rather than the command being rejected.
    const empty = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "compile-absent-"));
    SCRATCH.push(empty);
    assert.notEqual(withEnv(empty, () => run(["--workspace", path.join(dir, ".portulan"), "--pack-root", "auto"], { quiet: true })), 2);
});

// `--help` is a request that succeeded. Before this, `compile --help` answered
// `unknown argument "--help"` at exit 2 — a refusal to the one argument every tool should answer.
describe("--help", () => {
    test("`--help` exits 0 and prints the screen to stdout", (t) => {
        const out = [];
        t.mock.method(process.stdout, "write", (chunk) => (out.push(String(chunk)), true));
        const code = run(["--help"]);
        t.mock.restoreAll();
        assert.equal(code, 0);
        assert.match(out.join(""), /^portulan compile — compile a workspace's gate policy into host enforcement/);
        assert.match(out.join(""), /Exit codes: 0 succeeded/);
    });
});


// ===========================================================================================
// What compiled this — the artifact records the world it was compiled from (#264)
// ===========================================================================================
//
// Pack resolution is discovered-first and first-match-wins, so an UNPINNED `compile` on a machine
// with the plugin installed reads the host cache while `verify/compile.sh` reads the tree. Until
// this, a drift RED named a difference no reader could find in the repository, because the deciding
// input was a directory outside it — and the remedy it prescribed, "Recompile", is the very unpinned
// act that caused it.

describe("the artifact records what compiled it (#264)", () => {
    const PLAN = (origins) => ({ origins });

    test("the resolver's THREE tags collapse to two, or two correct spellings disagree", () => {
        // This is the control that stops the feature becoming worse than the hole. The pinned rail
        // spells its root (`named`); a bare run derives the same directory (`derived`). Recorded raw,
        // those emit different bytes for an identical world and `verify/compile.sh` reds on a tree
        // nothing is wrong with — a per-machine false red.
        const named = PLAN([{ root: "/repo/packs", origin: "named" }]);
        const derived = PLAN([{ root: "/repo/packs", origin: "derived" }]);
        assert.equal(recordedOrigin("/repo/packs", named, "/repo"), "tree");
        assert.equal(recordedOrigin("/repo/packs", derived, "/repo"), "tree",
            "the pinned rail and a bare run must record the same world identically");
    });

    test("a discovered root is recorded as discovered — that is the fact worth keeping", () => {
        const plan = PLAN([{ root: "/cache/p", origin: "discovered" }, { root: "/repo/packs", origin: "derived" }]);
        assert.equal(recordedOrigin("/cache/p", plan, "/repo"), "discovered");
    });

    test("a NAMED root outside the repository is not called `tree`", () => {
        // Flattening it would be this field's first lie: `--pack-root /elsewhere` is not the tree.
        const plan = PLAN([{ root: "/elsewhere/x", origin: "named" }]);
        assert.equal(recordedOrigin("/elsewhere/x", plan, "/repo"), "outside-tree");
    });

    test("the artifact carries origin and version, and NEVER a root path", () => {
        // A discovered root is an absolute path under somebody's home directory. Recording it would
        // make a tracked artifact machine-dependent and red the recipe everywhere — trading a silent
        // hazard for a permanent false one.
        const [claude] = backends(parse(policy()), {
            source: ".portulan/gates.json",
            packProvenance: [
                { pack: "rituals/checkpoints", origin: "discovered", version: "0.2.0" },
                { pack: "tools/github", origin: "tree", version: "0.1.0" },
            ],
        });
        const header = JSON.parse(claude.artifact.text).$portulan;
        assert.deepEqual(header.packs, [
            { pack: "rituals/checkpoints", origin: "discovered", version: "0.2.0" },
            { pack: "tools/github", origin: "tree", version: "0.1.0" },
        ]);
        assert.doesNotMatch(claude.artifact.text, /\/Users\/|\/home\/|plugins\/cache/,
            "no absolute root path may reach the artifact");
    });

    test("a pack that declares no version records that, rather than a blank", () => {
        const [claude] = backends(parse(policy()), {
            source: ".portulan/gates.json",
            packProvenance: [{ pack: "a/b", origin: "tree", version: null }],
        });
        assert.deepEqual(JSON.parse(claude.artifact.text).$portulan.packs, [{ pack: "a/b", origin: "tree", version: null }]);
    });

    test("pinned and bare emit BYTE-IDENTICAL artifacts on a cache-less host", () => {
        // **The two runs must actually DIFFER in how they resolve**, or this catches nondeterminism
        // and nothing else. A first version passed identical options to both calls and claimed to be
        // the pinned-vs-bare control — the same shape as a test that cannot fail. Copilot.
        //
        // Pinned names the root (`--pack-root packs`, tagged `named`); bare derives it from the
        // manifest's `tree` (tagged `derived`). Same directory, two documented-correct spellings. On a
        // cache-less host they describe one world and must emit one artifact, byte for byte — if they
        // do not, `verify/compile.sh` reds on a tree nothing is wrong with.
        const dir = workspace();
        const manifestPath = path.join(dir, ".portulan", "workspace.json");
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        manifest.packs = ["rituals/checkpoints"];
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        packAt(path.join(dir, "packs"), "rituals", "checkpoints", null);

        const emit = (options) => {
            const { contributions, plan } = packContributions(dir, ".portulan", options);
            assert.equal(contributions.length, 1, "the pack must resolve, or this compares two empty sets");
            const [claude] = backends(parse(policy()), {
                source: ".portulan/gates.json",
                root: dir,
                packProvenance: contributions,
            });
            return { text: claude.artifact.text, tag: plan.origins[0].origin };
        };
        const pinned = emit({ named: [path.join(dir, "packs")] });
        const bare = emit({ discovery: () => ({ ok: true, roots: [], why: "nothing installed" }) });

        assert.equal(pinned.tag, "named", "premise: the pinned run resolves via a NAMED root");
        assert.equal(bare.tag, "derived", "premise: the bare run resolves via a DERIVED root");
        assert.equal(pinned.text, bare.text,
            "two correct spellings of one world must emit one artifact — otherwise the rail reds on a clean tree");
    });

    test("a directory literally named `..foo` is inside the tree, not outside it", () => {
        // `!rel.startsWith("..")` calls it outside. This repository names that trap in
        // `./index.mjs`'s `isInside` docblock — the ninth fail-open in its scaffolding, and the first
        // written by the change that cited the class. This was the second; the helper is now used
        // rather than a fourth spelling written. Copilot.
        const plan = { origins: [{ root: "/repo/..foo/packs", origin: "named" }] };
        assert.equal(recordedOrigin("/repo/..foo/packs", plan, "/repo"), "tree");
        const escape = { origins: [{ root: "/elsewhere", origin: "named" }] };
        assert.equal(recordedOrigin("/elsewhere", escape, "/repo"), "outside-tree", "a real escape is still outside");
    });

    test("a named root that IS the repository root is the tree, not outside it", () => {
        const plan = { origins: [{ root: "/repo", origin: "named" }] };
        assert.equal(recordedOrigin("/repo", plan, "/repo"), "tree",
            "`rel === \"\"` is the repository itself; calling it outside-tree was this field's first lie");
    });

    test("a workspace with no packs emits the header it always emitted", () => {
        // Byte-identity for the commonest case: nothing to record must add nothing.
        const [withNone] = backends(parse(policy()), { source: ".portulan/gates.json" });
        assert.equal("packs" in JSON.parse(withNone.artifact.text).$portulan, false);
    });
});


describe("the drift RED names the origin difference (#264)", () => {
    const artifactWith = (packs) => JSON.stringify({
        $portulan: { generated: "cli/compile.mjs", source: ".portulan/gates.json", packs, warning: "w" },
        permissions: { deny: [], ask: [], allow: [] },
    }, null, 2);

    /** A workspace that DECLARES a pack, so the recompiled side records provenance to compare against. */
    const withAPack = () => {
        const dir = workspace();
        const manifestPath = path.join(dir, ".portulan", "workspace.json");
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        manifest.packs = ["rituals/checkpoints"];
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        packAt(path.join(dir, "packs"), "rituals", "checkpoints", null);
        return dir;
    };

    /** Runs `--check` against an artifact planted on disk, and returns everything it said. */
    const checkAgainst = (onDisk, dir = workspace()) => {
        fs.mkdirSync(path.join(dir, ".claude"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".claude", "settings.json"), onDisk);
        // `run` writes to `process.stdout` directly — there is no injectable sink — so this captures
        // it the only way available, and restores it even when the call throws.
        let out = "";
        const real = process.stdout.write.bind(process.stdout);
        process.stdout.write = (chunk) => { out += chunk; return true; };
        let code;
        try {
            code = run(["--check", "--workspace", dir]);
        } finally {
            process.stdout.write = real;
        }
        return { code, out };
    };

    test("a drift whose origins differ SAYS so, and gives the pinned spelling", () => {
        // Without this the sentence can regress to the pre-#264 "Recompile." — the remedy that, typed
        // bare, is the act that caused the drift — with every other test still green. The workspace must
        // DECLARE a pack: the why-block compares two worlds, and a pack present in only one of them
        // falls back to the plain RED by design.
        const { code, out } = checkAgainst(
            artifactWith([{ pack: "rituals/checkpoints", origin: "discovered", version: "0.2.0" }]),
            withAPack(),
        );
        assert.equal(code, 1, "it is still a drift");
        assert.match(out, /compiled from the discovered 0\.2\.0 copy/, "the world it was compiled from");
        assert.match(out, /--pack-root packs/, "and the spelling that does not reproduce the drift");
    });

    test("an artifact this compiler cannot parse leaves the plain RED standing", () => {
        // The artifact on disk is a file a human may have edited. A drift report that crashes on one is
        // worse than a drift report that says less.
        for (const hostile of ["{ not json", JSON.stringify({ no: "header" }), JSON.stringify({ $portulan: "a string" }), JSON.stringify({ $portulan: { packs: "not an array" } })]) {
            const { code, out } = checkAgainst(hostile);
            assert.equal(code, 1, `still a drift: ${hostile.slice(0, 24)}`);
            assert.match(out, /has drifted from/, "and still says so");
        }
    });
});
