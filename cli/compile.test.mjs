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
    FILE_WRITERS,
    IN_PLACE_EDITORS,
    MODES,
    STRICTNESS,
    declaredMode,
    resolveTier,
    readSessionMode,
    writeSessionMode,
    effectiveMode,
    sessionModeFile,
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
    // tidy: ../.portulan/compile/gate.mjs catches and steps aside, so an exception here does not
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
// 5b. Autonomy MODES — how often the development cycle stops
// ===========================================================================================
//
// A mode is not a tier. A **tier** says what an action IS (how hard it is to undo) and is decided
// per action; a **mode** says how often the *development cycle* stops for approval, and is decided
// per workspace and per session. The two vocabularies once shared the words "auto" and "gated";
// the maintainer renamed the modes (autonomous / ship-gate / strict, 2026-07-27) so they no longer
// collide — and these tests still pin the distinction the words alone never could: `tier` is a
// rule's field, `mode` is the policy's, and a mode may only ever move a rule between `auto`,
// `propose` and `gated`.
//
// Everything below is red-first. The rails that matter are the four refusals: a mode cannot reach
// Prohibited, cannot be partially specified, cannot loosen as it gets stricter, and cannot be
// resolved at all without a declared default.

/** A policy with one mode-varying rule. `push` is Auto until Strict, which gates it. */
function modePolicy(overrides = {}) {
    return {
        portulan: { spec: "2.1" },
        mode: "ship-gate",
        rules: [
            { id: "ban", tier: "prohibited", action: { write: "docs/vision.md" }, reason: "constitution" },
            {
                id: "push",
                tier: { autonomous: "auto", "ship-gate": "auto", strict: "gated" },
                action: { shell: "git push" },
                reason: "a working branch is not a claim on the repository",
            },
            {
                id: "ship",
                tier: { autonomous: "auto", "ship-gate": "gated", strict: "gated" },
                action: { shell: "gh pr merge" },
                reason: "the ship step",
            },
        ],
        ...overrides,
    };
}

describe("modes — the vocabulary", () => {
    test("there are exactly three, and they are ordered by strictness", () => {
        assert.deepEqual([...MODES], ["autonomous", "ship-gate", "strict"]);
    });

    test("a mode may never reach the Prohibited tier — in either direction", () => {
        // The whole reason the fourth tier exists is that it is NOT approvable. A mode that could
        // grant or revoke it would make "no agent edits the constitution" a setting, which is the
        // exact collapse core/operating/autonomy.md says the fourth tier was added to prevent.
        const p = modePolicy();
        p.rules[1].tier = { autonomous: "auto", "ship-gate": "gated", strict: "prohibited" };
        assert.throws(() => parse(p), /prohibited/i);
    });

    test("a mode-keyed tier must name all three modes — no silent default", () => {
        const p = modePolicy();
        p.rules[1].tier = { autonomous: "auto", strict: "gated" };
        assert.throws(() => parse(p), CompileError);
    });

    test("a mode-keyed tier may not name a mode that does not exist", () => {
        const p = modePolicy();
        p.rules[1].tier = { autonomous: "auto", "ship-gate": "auto", strict: "gated", yolo: "auto" };
        assert.throws(() => parse(p), CompileError);
    });

    test("a stricter mode may never be LOOSER than a laxer one", () => {
        // Without this the names lie: a policy could declare Strict more permissive than Auto and
        // every document describing the modes would be false while the compiler reported green.
        const p = modePolicy();
        p.rules[1].tier = { autonomous: "gated", "ship-gate": "gated", strict: "auto" };
        assert.throws(() => parse(p), /looser|monotonic|stricter/i);
    });

    test("equal tiers across modes are fine — non-loosening, not strictly increasing", () => {
        const p = modePolicy();
        p.rules[1].tier = { autonomous: "gated", "ship-gate": "gated", strict: "gated" };
        assert.doesNotThrow(() => parse(p));
    });

    test("a mode-keyed tier with no declared mode refuses the whole compile", () => {
        const p = modePolicy();
        delete p.mode;
        assert.throws(() => parse(p), CompileError);
    });

    test("a policy declaring a mode that is not one of the three refuses", () => {
        assert.throws(() => parse(modePolicy({ mode: "yolo" })), CompileError);
    });

    test("a policy with no modes at all still compiles — modes are opt-in", () => {
        // Backwards compatibility is not a courtesy here: examples/ ships a workspace with no
        // gates.json at all, and an adopter on scalar tiers must not be broken by a feature they
        // never declared.
        assert.doesNotThrow(() => parse(policy()));
    });
});

describe("modes — what each one compiles to", () => {
    const tierOf = (result, id) => result.compiled.find((g) => g.id === id)?.tier;

    test("Autonomous gates neither the push nor the ship step", () => {
        const result = claudeCode(parse(modePolicy({ mode: "autonomous" })));
        assert.equal(tierOf(result, "push"), undefined, "push is not a gate in Autonomous");
        assert.equal(tierOf(result, "ship"), undefined, "the ship step is not a gate in Autonomous");
    });

    test("Ship-gate gates the ship step and nothing before it", () => {
        const result = claudeCode(parse(modePolicy({ mode: "ship-gate" })));
        assert.equal(tierOf(result, "push"), undefined, "push stays unattended in Ship-gate");
        assert.equal(tierOf(result, "ship"), "gated", "the last step asks");
    });

    test("Strict gates every push, and the ship step too", () => {
        const result = claudeCode(parse(modePolicy({ mode: "strict" })));
        assert.equal(tierOf(result, "push"), "gated");
        assert.equal(tierOf(result, "ship"), "gated");
    });

    test("the Prohibited rule is identical under all three modes", () => {
        for (const mode of MODES) {
            const result = claudeCode(parse(modePolicy({ mode })));
            assert.equal(tierOf(result, "ban"), "prohibited", `mode ${mode} moved the constitution gate`);
        }
    });

    test("the emitted artifact differs by mode — the compiled file IS the declared default", () => {
        const auto = claudeCode(parse(modePolicy({ mode: "autonomous" }))).artifact.value;
        const strict = claudeCode(parse(modePolicy({ mode: "strict" }))).artifact.value;
        assert.ok(!auto.permissions.ask.includes("Bash(git push:*)"));
        assert.ok(strict.permissions.ask.includes("Bash(git push:*)"));
    });

    test("the compiled artifact records which mode produced it", () => {
        // An artifact that does not say which mode it expresses cannot be audited after the fact —
        // and the mode is the one input that changes the output without changing a rule.
        const settings = claudeCode(parse(modePolicy({ mode: "strict" }))).artifact.value;
        assert.equal(settings.$portulan.mode, "strict");
    });

    test("a refused mode-varying rule still accounts — it is refused, never dropped", () => {
        const result = claudeCode(parse(modePolicy({ mode: "ship-gate" })));
        const ids = [...result.compiled, ...result.refused].map((r) => r.id).sort();
        assert.deepEqual(ids, ["ban", "push", "ship"], "every rule ends in exactly one bucket");
    });
});

describe("modes — resolution", () => {
    test("resolveTier returns the scalar for a mode-invariant rule, whatever the mode", () => {
        const rule = { id: "x", tier: "gated", action: { shell: "a" }, reason: "r" };
        for (const mode of MODES) assert.equal(resolveTier(rule, mode), "gated");
    });

    test("resolveTier reads the mode's cell for a mode-varying rule", () => {
        const rule = modePolicy().rules[1];
        assert.equal(resolveTier(rule, "autonomous"), "auto");
        assert.equal(resolveTier(rule, "strict"), "gated");
    });

    test("declaredMode falls back to the strictest mode when a policy is silent", () => {
        // Silence must never be read as the loosest setting. A policy that says nothing gets the
        // safest answer, not the most convenient one.
        assert.equal(declaredMode({}), "strict");
        assert.equal(declaredMode({ mode: "autonomous" }), "autonomous");
    });

    test("STRICTNESS orders the tiers a mode may move between, and excludes prohibited", () => {
        assert.ok(STRICTNESS.auto < STRICTNESS.propose);
        assert.ok(STRICTNESS.propose < STRICTNESS.gated);
        assert.equal(STRICTNESS.prohibited, undefined, "prohibited is not on the mode axis");
    });
});

describe("modes — the per-session override", () => {
    // Session state, mirroring ../.portulan/compile/stop.mjs's counter: untracked, in the OS temp
    // dir, keyed by the working tree, and carrying the session that claimed it. Never a tracked
    // file — two parallel sessions sharing one would let either disarm the other's gate, and an
    // override that outlives its session is a setting nobody remembers making.

    test("an override tightens, and the tightened mode is what resolves", () => {
        const dir = scratch();
        writeSessionMode("strict", { dir, root: "/repo/a", sessionId: "s1" });
        assert.equal(effectiveMode({ policy: modePolicy(), dir, root: "/repo/a", sessionId: "s1" }).mode, "strict");
    });

    test("an override may NOT loosen below the declared default", () => {
        // Not a taste call. The permission layer — the half that cannot fail open — was compiled at
        // the default, so a loosened session would still meet the prompt the mode promised to
        // remove. A mode that says "no prompt" while the host prompts is a false claim about an
        // enforcer, which is the defect this repository has a memory entry about.
        const dir = scratch();
        assert.throws(() => writeSessionMode("autonomous", { dir, root: "/repo/b", sessionId: "s1", policy: modePolicy() }), /tighten|loosen/i);
    });

    test("one session's override is invisible to another in the same working tree", () => {
        const dir = scratch();
        writeSessionMode("strict", { dir, root: "/repo/c", sessionId: "s1" });
        const other = effectiveMode({ policy: modePolicy(), dir, root: "/repo/c", sessionId: "s2" });
        assert.equal(other.mode, "ship-gate", "a foreign session's override must not bind this one");
        assert.equal(other.source, "workspace default");
    });

    test("a second session writing does not erase the first session's override", () => {
        // The regression test for the defect this mechanism shipped with for one checkpoint. The
        // record was keyed on the working tree ALONE and the reader compared the session id it found,
        // which reads correctly and WRITES wrongly: two sessions in one worktree shared a file, so the
        // second to tighten silently erased the first — and the first fell back to the workspace
        // default while its own tool had reported success. The claim in three documents was that an
        // override is "invisible to every other session"; it was invisible in one direction only.
        // Found at the pre-commit checkpoint by a supervisor who ran two writers.
        const dir = scratch();
        writeSessionMode("strict", { dir, root: "/repo/shared", sessionId: "first" });
        writeSessionMode("strict", { dir, root: "/repo/shared", sessionId: "second" });
        assert.equal(
            effectiveMode({ policy: modePolicy(), dir, root: "/repo/shared", sessionId: "first" }).mode,
            "strict",
            "the first session's tightening must survive the second session writing its own",
        );
    });

    test("an id-less reader is not bound by a session's override", () => {
        // A reader with no session id must not inherit somebody else's tightening — and, more to the
        // point, must not inherit one that nothing can ever clear.
        const dir = scratch();
        writeSessionMode("strict", { dir, root: "/repo/h", sessionId: "s1" });
        assert.equal(effectiveMode({ policy: modePolicy(), dir, root: "/repo/h" }).mode, "ship-gate");
    });

    test("the same override in a different working tree is invisible too", () => {
        const dir = scratch();
        writeSessionMode("strict", { dir, root: "/repo/d", sessionId: "s1" });
        assert.equal(effectiveMode({ policy: modePolicy(), dir, root: "/repo/OTHER", sessionId: "s1" }).mode, "ship-gate");
    });

    test("no override means the workspace default, and says so", () => {
        const dir = scratch();
        const eff = effectiveMode({ policy: modePolicy(), dir, root: "/repo/e", sessionId: "s1" });
        assert.equal(eff.mode, "ship-gate");
        assert.equal(eff.source, "workspace default");
    });

    test("an unreadable override degrades to the default rather than throwing", () => {
        // The gate runner that consumes this fails open by design; a throw here would be a crash in
        // the one component whose crash removes the sentence a human reads.
        const dir = scratch();
        fs.writeFileSync(path.join(dir, "junk"), "not json");
        assert.doesNotThrow(() => readSessionMode({ dir, root: "/repo/f", sessionId: "s1" }));
        assert.equal(effectiveMode({ policy: modePolicy(), dir, root: "/repo/f", sessionId: "s1" }).mode, "ship-gate");
    });

    test("the override reports its own provenance, for the record", () => {
        const dir = scratch();
        writeSessionMode("strict", { dir, root: "/repo/g", sessionId: "s1" });
        assert.equal(effectiveMode({ policy: modePolicy(), dir, root: "/repo/g", sessionId: "s1" }).source, "session override");
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

    test("every rule id in the policy appears in the gate map's prose", () => {
        const prose = fs.readFileSync(path.join(REPO, ".portulan", "gate-map.md"), "utf8");
        for (const rule of real.rules) {
            assert.match(prose, new RegExp(`\`${rule.id}\``), `gate-map.md never mentions \`${rule.id}\``);
        }
    });

    test("every rule id the gate map cites exists in the policy", () => {
        const prose = fs.readFileSync(path.join(REPO, ".portulan", "gate-map.md"), "utf8");
        const ids = new Set(real.rules.map((r) => r.id));
        const cited = [...prose.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+){2,})`/g)].map((m) => m[1]);
        for (const id of cited) {
            if (/\.(md|json|sh|mjs)$/.test(id) || id.includes("/")) continue;
            assert.ok(ids.has(id), `gate-map.md cites \`${id}\`, which no rule declares`);
        }
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

        // **Mode-invariant rules only.** A rule whose tier moves with the mode does not *have* a tier
        // section — it has a row in the mode table, and the next test is what holds it there. Filing
        // such a rule under whichever tier it happens to hold today would be worse than not checking
        // it: at `autonomous` the merge is in the Auto tier, so this check would demand that the merge
        // bullet be moved out of the Gated section and into "the agent acts unattended", and a reader
        // meeting it there would learn the wrong thing about why a merge is dangerous. The two checks
        // partition the rules — every rule is held by exactly one of them, which is the property that
        // matters, and losing it is what would let a rule go uncited entirely.
        const mode = declaredMode(real);
        let invariant = 0;
        for (const rule of real.rules) {
            if (typeof rule.tier !== "string") continue;
            invariant += 1;
            const tier = resolveTier(rule, mode);
            const section = owner[tier];
            assert.match(
                section.body,
                new RegExp(`\`${rule.id}\``),
                `\`${rule.id}\` is tier \`${tier}\` in gates.json, but gate-map.md does not cite it under "${section.title}"`,
            );
        }
        const varying = real.rules.length - invariant;
        assert.equal(invariant + varying, real.rules.length, "every rule is held by this check or the mode-table one");
        assert.ok(varying > 0, "no rule varies by mode — the mode model has become decorative");
    });

    test("every mode-varying rule is cited where the modes are explained", () => {
        // A rule whose tier moves with the mode is the one a reader is most likely to misread from
        // the tier sections alone — those state today's answer, not the setting that produced it.
        const prose = fs.readFileSync(path.join(REPO, ".portulan", "gate-map.md"), "utf8");
        const start = prose.search(/^## The three modes\b/m);
        assert.ok(start !== -1, "gate-map.md has no section explaining the modes");
        const body = prose.slice(start, prose.indexOf("\n## ", start + 1));
        for (const rule of real.rules) {
            if (typeof rule.tier === "string") continue;
            assert.match(body, new RegExp(`\`${rule.id}\``), `\`${rule.id}\` varies by mode but the modes section never names it`);
        }
    });

    test("this workspace declares Ship-gate — the ship step asks, nothing before it does", () => {
        // The declared mode is a maintainer's ruling, not an implementation detail: it is the
        // difference between a session that merges on its own and one that stops for a click.
        assert.equal(declaredMode(real), "ship-gate");
        const tierAt = (shell, mode) => resolveTier(real.rules.find((r) => r.action?.shell === shell), mode);
        assert.equal(tierAt("gh pr merge", "ship-gate"), "gated", "Ship-gate gates the ship step");
        assert.equal(tierAt("gh pr merge", "autonomous"), "auto", "Autonomous raises no agent-side prompt there");
        assert.equal(tierAt("git push", "ship-gate"), "auto", "Ship-gate does not gate the push");
        assert.equal(tierAt("git push", "strict"), "gated", "Strict gates every push");
    });

    test("the compiled artifact on disk expresses the declared mode", () => {
        // The tracked artifact is the audit record: it bounds what any session could have done,
        // because a session may only ever tighten from here.
        const artifact = JSON.parse(fs.readFileSync(path.join(REPO, ".claude", "settings.json"), "utf8"));
        assert.equal(artifact.$portulan.mode, declaredMode(real));
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
        // Resolved at the declared mode since 2026-07-27: the ordinary push is mode-varying — Auto
        // until Strict — while the two destructive spellings are gated at EVERY mode, because a mode
        // governs how often the cycle stops, not whether a destructive action is recoverable.
        const tierOf = (shell, mode = declaredMode(real)) => resolveTier(real.rules.find((r) => r.action?.shell === shell), mode);
        assert.equal(tierOf("git push"), "auto", "an ordinary working-branch push is unattended at the declared mode");
        for (const mode of MODES) {
            assert.equal(tierOf("git push --force", mode), "gated", `bare --force is not recoverable, whatever the mode (${mode})`);
            assert.equal(tierOf("git push --delete", mode), "gated", `deleting a remote ref is not adding one (${mode})`);
        }
    });

    test("no mode makes an irreversible non-development action unattended", () => {
        // The carve-out, asserted rather than promised. A mode is a development-cycle setting; it is
        // not a licence for repository settings, deletions, releases or spending. If one of these
        // ever acquires a mode-keyed tier, this test is what says so out loud.
        // This list must cover everything the gate map's prose says it covers. It omitted the three
        // below for one round while the prose claimed "settings, deletions, releases, package
        // publication, spending, sending outward" — a stated checker narrower than its sentence, which
        // is the defect this repository names oftenest. Found at the pre-commit checkpoint. The three
        // `none`-action rules are included deliberately: they compile to nothing, so nothing else in
        // the suite would notice them acquiring a mode-keyed tier. (`change-settings-through-the-api`
        // was on this list until the `gh api` gate came off, 2026-07-28 — the rule no longer exists,
        // and this assertion is the drift alarm that said so during the rebase.)
        const carved = [
            "change-repository-settings",
            "delete-a-repository",
            "create-a-repository",
            "rename-or-transfer-a-repository",
            "delete-a-remote-branch",
            "force-push-without-a-lease",
            "tag-a-release",
            "publish-a-release",
            "publish-to-a-package-registry",
            "spend-money-or-register-a-domain",
            "send-something-outside-this-repository",
        ];
        for (const id of carved) {
            const rule = real.rules.find((r) => r.id === id);
            assert.ok(rule, `no rule \`${id}\` — the carve-out list has drifted from the policy`);
            for (const mode of MODES) {
                assert.equal(resolveTier(rule, mode), "gated", `\`${id}\` stopped being gated at mode ${mode}`);
            }
        }
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
