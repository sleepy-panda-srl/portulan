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

    for (const kind of ["write", "read"]) {
        test(`a ${kind} target climbing out with \`..\` refuses`, () => {
            // The sibling of the absolute case, one spelling over: `../secrets/` emits
            // `Edit(./../secrets/**)` — which the host may resolve against the PARENT tree — while
            // `matchesPath` can never match a `/../`-bearing tail against a resolved path. The
            // emitter and the matcher disagree about which way it is wrong, and a gate that reads as
            // present while holding nothing is the worse half. Found by the supervisor on #51.
            const p = policy();
            p.rules[0].action = { [kind]: "../secrets/" };
            assert.throws(() => compile(p), CompileError);
        });

        test(`a ${kind} target with an interior \`..\` segment refuses`, () => {
            const p = policy();
            p.rules[0].action = { [kind]: "docs/../../etc/" };
            assert.throws(() => compile(p), CompileError);
        });

        test(`a ${kind} target merely CONTAINING dots is fine — only a \`..\` segment escapes`, () => {
            // `..` is a path segment, not a substring: a file legitimately named `a..b.md`, or any
            // dotfile, must still compile. Refusing on the substring would be a false red.
            const p = policy();
            p.rules[0].action = { [kind]: "docs/a..b.md" };
            assert.doesNotThrow(() => compile(p));
        });

        test(`an absolute ${kind} target refuses rather than being silently made relative`, () => {
            // `pattern()` and `matchesPath()` both strip the leading slash, so `/etc/passwd` compiled
            // to `Edit(./etc/passwd)` and matched any path ENDING in `/etc/passwd` — a gate enforcing
            // something both different from and broader than the policy's own words. The same
            // "refuse rather than escape" reasoning as the reserved-character check. Found by review.
            const p = policy();
            p.rules[0].action = { [kind]: "/etc/passwd" };
            assert.throws(() => compile(p), CompileError);
        });
    }

    test("an absolute shell target still compiles — it is a command spelling, not a rewritten path", () => {
        const p = policy();
        p.rules[1].action = { shell: "/usr/bin/git push" };
        assert.doesNotThrow(() => compile(p));
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

        for (const rule of real.rules) {
            const section = owner[rule.tier];
            assert.match(
                section.body,
                new RegExp(`\`${rule.id}\``),
                `\`${rule.id}\` is tier \`${rule.tier}\` in gates.json, but gate-map.md does not cite it under "${section.title}"`,
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
