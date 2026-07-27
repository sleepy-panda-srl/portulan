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
    compile,
    claudeCode,
    run,
    spellings,
    matchesRule,
    matchesPath,
    policyPath,
    MODES,
    STRICTNESS,
    declaredMode,
    resolveTier,
    readSessionMode,
    writeSessionMode,
    effectiveMode,
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

/** A minimal well-formed policy, with one rule of each tier. Tests mutate a clone. */
function policy(overrides = {}) {
    return {
        portulan: { spec: "2.1" },
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
// 1. Nothing is dropped on the floor
// ===========================================================================================
//
// The distinctive failure of a compiler that emits gate machinery is a rule that goes in and
// nothing comes out: the gate reads as configured and enforces nothing. So the accounting is a
// test, not a diagnostic — every rule ends in exactly one of {compiled, refused-with-a-reason},
// and the two counts must add up to the input.

describe("the accounting", () => {
    test("every rule is either compiled or refused, and the counts add up", () => {
        const result = compile(policy());
        const seen = new Set([...result.compiled, ...result.refused].map((r) => r.id));
        assert.equal(seen.size, policy().rules.length, "every rule accounted for exactly once");
        assert.equal(result.compiled.length + result.refused.length, policy().rules.length);
    });

    test("a refusal always carries a stated reason, never a bare skip", () => {
        for (const r of compile(policy()).refused) {
            assert.ok(r.why && r.why.length > 20, `refusal ${r.id} must say why in a sentence`);
        }
    });

    test("auto and propose are refused as tiers, not silently ignored", () => {
        const refusedIds = compile(policy()).refused.map((r) => r.id);
        assert.ok(refusedIds.includes("pr"), "propose is not a gate");
        assert.ok(refusedIds.includes("read"), "auto is not a gate");
    });

    test("an action declaring `none` is refused carrying the policy's own words", () => {
        const p = policy();
        p.rules.push({ id: "money", tier: "gated", action: { none: "no tool-level surface exists for spending money" }, reason: "gated" });
        const refusal = compile(p).refused.find((r) => r.id === "money");
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
        assert.throws(() => compile(p), CompileError, "an unrecognised tier is not a rule to skip");
    });

    test("an unknown action shape refuses the whole compile", () => {
        const p = policy();
        p.rules[1].action = { telepathy: "git push" };
        assert.throws(() => compile(p), CompileError);
    });

    test("an action declaring two kinds at once refuses the whole compile", () => {
        const p = policy();
        p.rules[1].action = { shell: "git push", write: "x" };
        assert.throws(() => compile(p), CompileError, "ambiguous is not the same as either");
    });

    test("a duplicate rule id refuses the whole compile", () => {
        const p = policy();
        p.rules.push({ ...p.rules[1] });
        assert.throws(() => compile(p), CompileError);
    });

    test("a rule id that is not a slug refuses the whole compile", () => {
        const p = policy();
        p.rules[1].id = "Push To Origin";
        assert.throws(() => compile(p), CompileError);
    });

    test("a rule with no reason refuses the whole compile", () => {
        const p = policy();
        delete p.rules[1].reason;
        assert.throws(() => compile(p), CompileError, "a gate with no sentence to show a human is not finished");
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
            assert.throws(() => compile(p), CompileError);
        });
    }

    test("a target with surrounding whitespace refuses rather than being silently trimmed", () => {
        const p = policy();
        p.rules[1].action = { shell: " git push " };
        assert.throws(() => compile(p), CompileError, "the host would not match it, so quietly fixing it hides a policy error");
    });

    test("a path target may contain a colon — only shell targets use it structurally", () => {
        const p = policy();
        p.rules[0].action = { write: "docs/odd:name.md" };
        assert.doesNotThrow(() => compile(p));
    });

    test("a policy whose spec version has never shipped refuses", () => {
        assert.throws(() => compile(policy({ portulan: { spec: "99.0" } })), CompileError);
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
    test("a policy carrying gate rules that would emit no gate at all refuses", () => {
        const p = policy();
        // Every gate becomes unreachable, but the rules are still there claiming enforcement.
        p.rules = p.rules.map((r) =>
            r.tier === "gated" || r.tier === "prohibited"
                ? { ...r, action: { none: "deliberately unreachable for this test" } }
                : r,
        );
        assert.throws(() => compile(p), CompileError, "a policy that declares gates and emits none must not report success");
    });

    test("a policy with no rules at all refuses", () => {
        assert.throws(() => compile(policy({ rules: [] })), CompileError);
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
        const { settings } = claudeCode(compile(policy()));
        assert.ok(settings.permissions.ask.includes("Bash(git push:*)"));
        assert.ok(!(settings.permissions.deny ?? []).includes("Bash(git push:*)"), "gated is not a prohibition");
    });

    test("prohibited compiles to `deny` — an action with no approval path", () => {
        const { settings } = claudeCode(compile(policy()));
        for (const rule of ["Edit(./docs/vision.md)", "Write(./docs/vision.md)"]) {
            assert.ok(settings.permissions.deny.includes(rule), `expected ${rule}`);
        }
        assert.ok(!(settings.permissions.ask ?? []).includes("Edit(./docs/vision.md)"));
    });

    test("no `allow` rules are emitted — the compiler only ever adds restriction", () => {
        const { settings } = claudeCode(compile(policy()));
        assert.deepEqual(settings.permissions.allow ?? [], [], "maintainer's ruling, 2026-07-27: gates only");
    });

    test("every gate is emitted as a permission rule AND backed by a hook", () => {
        const { settings } = claudeCode(compile(policy()));
        assert.ok(settings.permissions.ask.length > 0, "permissions are the load-bearing layer");
        assert.ok(settings.hooks.PreToolUse.length > 0, "the hook is the explanation layer");
    });

    test("a write action covers every tool that can write, not just Edit", () => {
        const { settings } = claudeCode(compile(policy()));
        const denied = settings.permissions.deny.join(" ");
        for (const tool of ["Edit", "Write", "NotebookEdit"]) {
            assert.match(denied, new RegExp(`${tool}\\(`), `${tool} can write and must be covered`);
        }
    });

    test("the Stop hook is wired to the session-end runner", () => {
        const { settings } = claudeCode(compile(policy()));
        assert.ok(settings.hooks.Stop?.length > 0, "the Stop-gate is the other half of milestone 4");
    });

    test("emitted hook commands invoke node directly rather than an inline shell one-liner", () => {
        const { settings } = claudeCode(compile(policy()));
        const commands = [...settings.hooks.PreToolUse, ...settings.hooks.Stop]
            .flatMap((h) => h.hooks.map((x) => x.command));
        for (const c of commands) {
            assert.doesNotMatch(c, /[|;&><]/, "quoting and word-splitting inside emitted shell is where the next fail-open lives");
        }
    });

    test("the artifact carries a generation header naming its source", () => {
        const { settings } = claudeCode(compile(policy()));
        assert.match(JSON.stringify(settings), /gates\.json/, "a reader must be able to find what generated this");
    });

    test("the header names the policy actually read, not a hard-coded default", () => {
        // It was a literal for one round, so a workspace declaring a non-default policy got an artifact
        // claiming it came from somewhere it did not — in the field whose only job is saying what
        // generated the file. Found by review.
        const { settings } = claudeCode(compile(policy()), { source: ".portulan/policy/rules.json" });
        assert.equal(settings.$portulan.source, ".portulan/policy/rules.json");
        assert.match(settings.$portulan.warning, /policy\/rules\.json/, "the warning must point at the same file");
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
// 5b. Autonomy MODES — how often the development cycle stops
// ===========================================================================================
//
// A mode is not a tier. A **tier** says what an action IS (how hard it is to undo) and is decided
// per action; a **mode** says how often the *development cycle* stops for approval, and is decided
// per workspace and per session. The two share the words "auto" and "gated" because the maintainer
// named them that way, and the collision is real — so these tests pin the distinction that the
// vocabulary cannot: `tier` is a rule's field, `mode` is the policy's, and a mode may only ever move
// a rule between `auto`, `propose` and `gated`.
//
// Everything below is red-first. The rails that matter are the four refusals: a mode cannot reach
// Prohibited, cannot be partially specified, cannot loosen as it gets stricter, and cannot be
// resolved at all without a declared default.

/** A policy with one mode-varying rule. `push` is Auto until Strict, which gates it. */
function modePolicy(overrides = {}) {
    return {
        portulan: { spec: "2.1" },
        mode: "gated",
        rules: [
            { id: "ban", tier: "prohibited", action: { write: "docs/vision.md" }, reason: "constitution" },
            {
                id: "push",
                tier: { auto: "auto", gated: "auto", strict: "gated" },
                action: { shell: "git push" },
                reason: "a working branch is not a claim on the repository",
            },
            {
                id: "ship",
                tier: { auto: "auto", gated: "gated", strict: "gated" },
                action: { shell: "gh pr merge" },
                reason: "the ship step",
            },
        ],
        ...overrides,
    };
}

describe("modes — the vocabulary", () => {
    test("there are exactly three, and they are ordered by strictness", () => {
        assert.deepEqual([...MODES], ["auto", "gated", "strict"]);
    });

    test("a mode may never reach the Prohibited tier — in either direction", () => {
        // The whole reason the fourth tier exists is that it is NOT approvable. A mode that could
        // grant or revoke it would make "no agent edits the constitution" a setting, which is the
        // exact collapse core/operating/autonomy.md says the fourth tier was added to prevent.
        const p = modePolicy();
        p.rules[1].tier = { auto: "auto", gated: "gated", strict: "prohibited" };
        assert.throws(() => compile(p), /prohibited/i);
    });

    test("a mode-keyed tier must name all three modes — no silent default", () => {
        const p = modePolicy();
        p.rules[1].tier = { auto: "auto", strict: "gated" };
        assert.throws(() => compile(p), CompileError);
    });

    test("a mode-keyed tier may not name a mode that does not exist", () => {
        const p = modePolicy();
        p.rules[1].tier = { auto: "auto", gated: "auto", strict: "gated", yolo: "auto" };
        assert.throws(() => compile(p), CompileError);
    });

    test("a stricter mode may never be LOOSER than a laxer one", () => {
        // Without this the names lie: a policy could declare Strict more permissive than Auto and
        // every document describing the modes would be false while the compiler reported green.
        const p = modePolicy();
        p.rules[1].tier = { auto: "gated", gated: "gated", strict: "auto" };
        assert.throws(() => compile(p), /looser|monotonic|stricter/i);
    });

    test("equal tiers across modes are fine — non-loosening, not strictly increasing", () => {
        const p = modePolicy();
        p.rules[1].tier = { auto: "gated", gated: "gated", strict: "gated" };
        assert.doesNotThrow(() => compile(p));
    });

    test("a mode-keyed tier with no declared mode refuses the whole compile", () => {
        const p = modePolicy();
        delete p.mode;
        assert.throws(() => compile(p), CompileError);
    });

    test("a policy declaring a mode that is not one of the three refuses", () => {
        assert.throws(() => compile(modePolicy({ mode: "yolo" })), CompileError);
    });

    test("a policy with no modes at all still compiles — modes are opt-in", () => {
        // Backwards compatibility is not a courtesy here: examples/ ships a workspace with no
        // gates.json at all, and an adopter on scalar tiers must not be broken by a feature they
        // never declared.
        assert.doesNotThrow(() => compile(policy()));
    });
});

describe("modes — what each one compiles to", () => {
    const tierOf = (result, id) => result.compiled.find((g) => g.id === id)?.tier;

    test("Auto gates neither the push nor the ship step", () => {
        const result = compile(modePolicy({ mode: "auto" }));
        assert.equal(tierOf(result, "push"), undefined, "push is not a gate in Auto");
        assert.equal(tierOf(result, "ship"), undefined, "the ship step is not a gate in Auto");
    });

    test("Gated gates the ship step and nothing before it", () => {
        const result = compile(modePolicy({ mode: "gated" }));
        assert.equal(tierOf(result, "push"), undefined, "push stays unattended in Gated");
        assert.equal(tierOf(result, "ship"), "gated", "the last step asks");
    });

    test("Strict gates every push, and the ship step too", () => {
        const result = compile(modePolicy({ mode: "strict" }));
        assert.equal(tierOf(result, "push"), "gated");
        assert.equal(tierOf(result, "ship"), "gated");
    });

    test("the Prohibited rule is identical under all three modes", () => {
        for (const mode of MODES) {
            const result = compile(modePolicy({ mode }));
            assert.equal(tierOf(result, "ban"), "prohibited", `mode ${mode} moved the constitution gate`);
        }
    });

    test("the emitted artifact differs by mode — the compiled file IS the declared default", () => {
        const auto = claudeCode(compile(modePolicy({ mode: "auto" }))).settings;
        const strict = claudeCode(compile(modePolicy({ mode: "strict" }))).settings;
        assert.ok(!auto.permissions.ask.includes("Bash(git push:*)"));
        assert.ok(strict.permissions.ask.includes("Bash(git push:*)"));
    });

    test("the compiled artifact records which mode produced it", () => {
        // An artifact that does not say which mode it expresses cannot be audited after the fact —
        // and the mode is the one input that changes the output without changing a rule.
        const settings = claudeCode(compile(modePolicy({ mode: "strict" })), { mode: "strict" }).settings;
        assert.equal(settings.$portulan.mode, "strict");
    });

    test("a refused mode-varying rule still accounts — it is refused, never dropped", () => {
        const result = compile(modePolicy({ mode: "gated" }));
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
        assert.equal(resolveTier(rule, "auto"), "auto");
        assert.equal(resolveTier(rule, "strict"), "gated");
    });

    test("declaredMode falls back to the strictest mode when a policy is silent", () => {
        // Silence must never be read as the loosest setting. A policy that says nothing gets the
        // safest answer, not the most convenient one.
        assert.equal(declaredMode({}), "strict");
        assert.equal(declaredMode({ mode: "auto" }), "auto");
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
        assert.throws(() => writeSessionMode("auto", { dir, root: "/repo/b", sessionId: "s1", policy: modePolicy() }), /tighten|loosen/i);
    });

    test("one session's override is invisible to another in the same working tree", () => {
        const dir = scratch();
        writeSessionMode("strict", { dir, root: "/repo/c", sessionId: "s1" });
        const other = effectiveMode({ policy: modePolicy(), dir, root: "/repo/c", sessionId: "s2" });
        assert.equal(other.mode, "gated", "a foreign session's override must not bind this one");
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
        assert.equal(effectiveMode({ policy: modePolicy(), dir, root: "/repo/h" }).mode, "gated");
    });

    test("the same override in a different working tree is invisible too", () => {
        const dir = scratch();
        writeSessionMode("strict", { dir, root: "/repo/d", sessionId: "s1" });
        assert.equal(effectiveMode({ policy: modePolicy(), dir, root: "/repo/OTHER", sessionId: "s1" }).mode, "gated");
    });

    test("no override means the workspace default, and says so", () => {
        const dir = scratch();
        const eff = effectiveMode({ policy: modePolicy(), dir, root: "/repo/e", sessionId: "s1" });
        assert.equal(eff.mode, "gated");
        assert.equal(eff.source, "workspace default");
    });

    test("an unreadable override degrades to the default rather than throwing", () => {
        // The gate runner that consumes this fails open by design; a throw here would be a crash in
        // the one component whose crash removes the sentence a human reads.
        const dir = scratch();
        fs.writeFileSync(path.join(dir, "junk"), "not json");
        assert.doesNotThrow(() => readSessionMode({ dir, root: "/repo/f", sessionId: "s1" }));
        assert.equal(effectiveMode({ policy: modePolicy(), dir, root: "/repo/f", sessionId: "s1" }).mode, "gated");
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
        const result = compile(real);
        assert.ok(result.compiled.length >= 6, "this repository has at least six enforceable gates");
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
        // it: at `auto` the merge is in the Auto tier, so this check would demand that the merge
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

    test("this workspace declares Auto — customer zero runs the most autonomous mode", () => {
        // The declared mode is a maintainer's ruling, not an implementation detail: it is the
        // difference between a session that merges on its own and one that stops for a click.
        assert.equal(declaredMode(real), "auto");
        const tierAt = (shell, mode) => resolveTier(real.rules.find((r) => r.action?.shell === shell), mode);
        assert.equal(tierAt("gh pr merge", "auto"), "auto", "Auto raises no agent-side prompt at the ship step");
        assert.equal(tierAt("gh pr merge", "gated"), "gated", "the engine's shipped default still gates it");
        assert.equal(tierAt("git push", "gated"), "auto", "Gated does not gate the push");
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
        // the suite would notice them acquiring a mode-keyed tier.
        const carved = [
            "change-repository-settings",
            "change-settings-through-the-api",
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
