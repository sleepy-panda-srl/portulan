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

import { CompileError, compile, claudeCode, run, spellings, matchesRule, matchesPath, policyPath } from "./compile.mjs";

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
