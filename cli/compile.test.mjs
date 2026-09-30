// Tests for `compile` — the enforcement compiler.
//
// Emission only: that Claude Code honours what is emitted, only a running host can show.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This suite imports `./compile.mjs`, which can read the host's installed-plugin record: point it at none.
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
    policyDeclaration,
    sessionsDeclaration,
    spendDeclaration,
    CACHE_LIFETIMES,
    resolveWorkspace,
    FILE_WRITERS,
    IN_PLACE_EDITORS,
    resolvePack,
    recordedOrigin,
    packRoots,
    packContributions,
    composeFragments,
    tierRank,
    shellWords,
    neverMatches,
    LOAD_TIERS,
    GUIDANCE_HOSTS,
    GUIDANCE_RULES_DIR,
    RULES_MARKER,
    ON_READ_INDEX,
    SKILLS_DIR,
    parseUnit,
    guidanceUnits,
    compileGuidance,
    guidanceEdits,
    claudeCodeGuidance,
    agentsMdGuidance,
    HOOK_RUNNERS,
    BOOT_CARD_UNIT,
    BOOT_CARD_LINE,
    IMPORT_DEPTH,
} from "./compile.mjs";
import { alwaysTier } from "./context.mjs";
import { spendFlags } from "./advisory.mjs";
import { inspect } from "./doctor.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

// One exit handler for every scratch directory: one each would pass node's default limit of ten listeners.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-compile-"));
    SCRATCH.push(dir);
    return dir;
}

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
// 1. Nothing is dropped on the floor — and the accounting is per backend
// ===========================================================================================

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

    test("a `none` value may contain parentheses — it is prose, not a permission pattern", () => {
        const p = policy();
        p.rules.push({
            id: "money",
            tier: "gated",
            action: { none: "no tool-level surface exists for spending money (the host has no payment tool)" },
            reason: "gated",
        });
        let parsed;
        assert.doesNotThrow(() => {
            parsed = parse(p);
        });
        const refusal = claudeCode(parsed).refused.find((r) => r.id === "money");
        assert.match(refusal.why, /\(the host has no payment tool\)/, "the aside survives into the reported reason");
    });

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

    for (const kind of ["write", "read"]) {
        test(`a ${kind} target climbing out with \`..\` refuses`, () => {
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
            const p = policy();
            p.rules[0].action = { [kind]: "docs/a..b.md" };
            assert.doesNotThrow(() => parse(p));
        });

        test(`an absolute ${kind} target refuses rather than being silently made relative`, () => {
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

describe("fail-closed", () => {
    test("Claude Code: a policy carrying gate rules that would emit no gate at all refuses", () => {
        const p = policy();
        p.rules = p.rules.map((r) =>
            r.tier === "gated" || r.tier === "prohibited"
                ? { ...r, action: { none: "deliberately unreachable for this test" } }
                : r,
        );
        assert.throws(() => claudeCode(parse(p)), CompileError, "a policy that declares gates and emits none must not report success");
    });

    test("the floor backend: a declared floor that would emit no ruleset rule at all refuses", () => {
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
// Measured on Claude Code 2.1.220, unless a case names its own version.

describe("the Claude Code backend", () => {
    test("gated compiles to `ask` — per-action approval, which is what Gated means", () => {
        const settings = claudeCode(parse(policy())).artifact.value;
        assert.ok(settings.permissions.ask.includes("Bash(git push:*)"));
        assert.ok(!(settings.permissions.deny ?? []).includes("Bash(git push:*)"), "gated is not a prohibition");
    });

    test("prohibited compiles to `deny` — an action with no approval path", () => {
        const settings = claudeCode(parse(policy())).artifact.value;
        assert.ok(settings.permissions.deny.includes("Edit(./docs/vision.md)"), "expected Edit(./docs/vision.md)");
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

    test("a write action covers every tool that can write — the CLAIM stands, the instrument moved", () => {
        // Claude Code 2.1.240 discards `Write(path)` and `NotebookEdit(path)` permission rules.
        const settings = claudeCode(parse(policy())).artifact.value;
        const denied = settings.permissions.deny.join(" ");
        assert.match(denied, /\bEdit\(/, "the one pattern the host matches, and it covers every file-editing tool");
        for (const tool of ["Write", "NotebookEdit"]) {
            assert.doesNotMatch(denied, new RegExp(`\\b${tool}\\(`), `${tool}(path) is discarded by the host — emitting it reports a rule that enforces nothing`);
        }
        assert.deepEqual(
            settings.hooks.PreToolUse.map((h) => h.matcher).sort(),
            ["Bash", "Edit", "NotebookEdit", "Write"],
            "the hook matchers are a DIFFERENT consumer of WRITE_TOOLS and must not narrow with the permission patterns",
        );
    });

    test("a write gate's permission patterns narrow to Edit in the `ask` tier too, not only `deny`", () => {
        // Claude Code 2.1.240 discards `Write(path)` in `ask` as it does in `deny`.
        const gatedWrite = policy({
            rules: [{ id: "gated-write", tier: "gated", action: { write: "docs/vision.md" }, reason: "a gated write" }],
        });
        const settings = claudeCode(parse(gatedWrite)).artifact.value;
        assert.deepEqual(settings.permissions.ask, ["Edit(./docs/vision.md)"]);
        assert.deepEqual(settings.permissions.deny ?? [], []);
    });

    test("the hook matcher set is pinned, because narrowing it with the patterns would open a real hole", () => {
        const onlyAWrite = policy({
            rules: [{ id: "ban", tier: "prohibited", action: { write: "docs/vision.md" }, reason: "constitution" }],
        });
        const settings = claudeCode(parse(onlyAWrite)).artifact.value;
        assert.deepEqual(settings.permissions.deny, ["Edit(./docs/vision.md)"], "one pattern, the one the host matches");
        assert.deepEqual(
            settings.hooks.PreToolUse.map((h) => h.matcher).sort(),
            ["Bash", "Edit", "NotebookEdit", "Write"],
            "all three write tools reach the hook, plus Bash for the shell spelling",
        );
    });

    test("a write gate wires the Bash hook, or its shell coverage is a matcher nothing reaches", () => {
        // Only a write rule: any shell rule would wire the Bash matcher by itself.
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
        const result = claudeCode(parse(policy()));
        const permissions = [...result.artifact.value.permissions.deny, ...result.artifact.value.permissions.ask];
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

    test("the restart advisory is the PostToolUse and UserPromptSubmit hooks and the status line, all on the third runner", () => {
        const result = claudeCode(parse(policy()));
        const settings = result.artifact.value;
        assert.equal(HOOK_RUNNERS[2], "advisory.mjs");
        assert.deepEqual(settings.hooks.PostToolUse, [{ hooks: [{ type: "command", command: `node "\${CLAUDE_PROJECT_DIR}/cli/advisory.mjs" tool` }] }], "no matcher: every tool's result");
        assert.deepEqual(
            settings.hooks.UserPromptSubmit.flatMap((h) => h.hooks.map((x) => x.command)),
            [`node "\${CLAUDE_PROJECT_DIR}/cli/advisory.mjs" prompt`],
        );
        assert.deepEqual(settings.statusLine, { type: "command", command: `node "\${CLAUDE_PROJECT_DIR}/cli/advisory.mjs" status` });
        assert.ok(
            result.notes.some((n) => /status line/.test(n) && /settings\.local\.json/.test(n)),
            "replacing a status line a person set is said on every run, with where to keep their own",
        );
        const named = claudeCode(parse(policy()), { advisoryRunner: '"/elsewhere/advisory.mjs"' }).artifact.value;
        assert.equal(named.statusLine.command, 'node "/elsewhere/advisory.mjs" status');
    });

    test("emitted hook commands invoke node directly rather than an inline shell one-liner", () => {
        const settings = claudeCode(parse(policy())).artifact.value;
        const commands = [...settings.hooks.PreToolUse, ...settings.hooks.PostToolUse, ...settings.hooks.Stop, ...settings.hooks.UserPromptSubmit]
            .flatMap((h) => h.hooks.map((x) => x.command))
            .concat(settings.statusLine.command);
        for (const c of commands) {
            assert.doesNotMatch(c, /[|;&><]/, "quoting and word-splitting inside emitted shell is where the next fail-open lives");
        }
    });

    test("the artifact carries a generation header naming its source", () => {
        const settings = claudeCode(parse(policy())).artifact.value;
        assert.match(JSON.stringify(settings), /gates\.json/, "a reader must be able to find what generated this");
    });

    test("the header names the policy actually read, not a hard-coded default", () => {
        const settings = claudeCode(parse(policy()), { source: ".portulan/policy/rules.json" }).artifact.value;
        assert.equal(settings.$portulan.source, ".portulan/policy/rules.json");
        assert.match(settings.$portulan.warning, /policy\/rules\.json/, "the warning must point at the same file");
    });
});

// ===========================================================================================
// The session switches — `sessions`, compiled only where declared
// ===========================================================================================

function workspaceWithSessions(sessions, p = policy()) {
    const dir = workspace(p);
    const file = path.join(dir, ".portulan", "workspace.json");
    const m = JSON.parse(fs.readFileSync(file, "utf8"));
    m.portulan.spec = "2.11";
    m.sessions = sessions;
    fs.writeFileSync(file, JSON.stringify(m, null, 2));
    return dir;
}

describe("the session switches", () => {
    test("undeclared, the settings carry no switch and read exactly as they did", () => {
        const plain = claudeCode(parse(policy()));
        const none = claudeCode(parse(policy()), { sessions: null });
        assert.equal(none.artifact.text, plain.artifact.text);
        assert.equal(plain.artifact.value.includeGitInstructions, undefined);
        assert.equal(plain.artifact.value.promptCacheTtl, undefined);
        assert.equal(plain.artifact.value.$portulan.sessions, undefined);
    });

    test("declared, each switch becomes its Claude Code setting, and the header names where it came from", () => {
        const sessions = { manifest: ".portulan/workspace.json", git_instructions: false, cache_lifetime: "5m" };
        const out = claudeCode(parse(policy()), { sessions });
        assert.equal(out.artifact.value.includeGitInstructions, false);
        assert.equal(out.artifact.value.promptCacheTtl, "5m");
        assert.equal(out.artifact.value.$portulan.sessions, ".portulan/workspace.json");
        assert.match(out.artifact.value.$portulan.warning, /`sessions` in \.portulan\/workspace\.json/);
        assert.ok(out.notes.some((n) => /CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=0/.test(n)), out.notes.join("\n"));
        assert.ok(out.notes.some((n) => /compiled as 5m/.test(n) && /CLAUDE_CODE_PROMPT_CACHE_TTL/.test(n)), out.notes.join("\n"));
    });

    test("declared on, the git instructions are said too, with the way to go without them for one session", () => {
        const out = claudeCode(parse(policy()), { sessions: { manifest: ".portulan/workspace.json", git_instructions: true } });
        assert.equal(out.artifact.value.includeGitInstructions, true);
        assert.ok(out.notes.some((n) => /compiled on/.test(n) && /CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1/.test(n)), out.notes.join("\n"));
        assert.ok(!out.notes.some((n) => /compiled off/.test(n)), out.notes.join("\n"));
    });

    test("`headless` alone compiles nothing into the settings, and says it is not compiled", () => {
        const sessions = { manifest: ".portulan/workspace.json", headless: { cache_lifetime: "5m", exclude_dynamic_sections: true } };
        const plain = claudeCode(parse(policy()));
        const out = claudeCode(parse(policy()), { sessions });
        assert.equal(out.artifact.text, plain.artifact.text);
        assert.ok(out.notes.some((n) => /`sessions\.headless` is not compiled/.test(n)), out.notes.join("\n"));
    });

    test("the lifetimes are the two the host takes", () => {
        assert.deepEqual(CACHE_LIFETIMES, ["5m", "1h"]);
    });

    test("the declaration is read from the manifest, and a manifest without it reads as none", () => {
        assert.equal(sessionsDeclaration(workspace()), null);
        const dir = workspaceWithSessions({ cache_lifetime: "1h", headless: { git_instructions: false } });
        assert.deepEqual(sessionsDeclaration(dir), {
            manifest: ".portulan/workspace.json",
            cache_lifetime: "1h",
            headless: { git_instructions: false },
        });
    });

    for (const [what, sessions] of [
        ["an unknown switch", { model: "any" }],
        ["a switch spelled as a string", { git_instructions: "false" }],
        ["a lifetime the host does not take", { cache_lifetime: "30m" }],
        ["an unknown headless switch", { headless: { effort: "low" } }],
        ["the exclusion outside `headless`, where no setting carries it", { exclude_dynamic_sections: true }],
        ["a list in place of the object", ["git_instructions"]],
    ]) {
        test(`${what} stops compile with exit 2 and writes nothing`, () => {
            const dir = workspaceWithSessions(sessions);
            assert.throws(() => sessionsDeclaration(dir), CompileError);
            assert.equal(run(["--workspace", dir], { quiet: true }), 2);
            assert.equal(fs.existsSync(path.join(dir, ".claude", "settings.json")), false);
        });
    }

    test("compiled end to end, the settings carry the switches and --check holds them", () => {
        const dir = workspaceWithSessions({ git_instructions: false, cache_lifetime: "1h" });
        assert.equal(run(["--workspace", dir], { quiet: true }), 0);
        const settings = JSON.parse(fs.readFileSync(path.join(dir, ".claude", "settings.json"), "utf8"));
        assert.equal(settings.includeGitInstructions, false);
        assert.equal(settings.promptCacheTtl, "1h");
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 0);
        const file = path.join(dir, ".portulan", "workspace.json");
        const m = JSON.parse(fs.readFileSync(file, "utf8"));
        delete m.sessions;
        fs.writeFileSync(file, JSON.stringify(m, null, 2));
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 1);
    });
});

// ===========================================================================================
// The declared figures — `spend`, written onto the advisory's commands
// ===========================================================================================

function workspaceWithSpend(spend, p = policy(), spec = spend?.restart === undefined ? "2.12" : "2.13") {
    const dir = workspace(p);
    const file = path.join(dir, ".portulan", "workspace.json");
    const m = JSON.parse(fs.readFileSync(file, "utf8"));
    m.portulan.spec = spec;
    m.spend = spend;
    fs.writeFileSync(file, JSON.stringify(m, null, 2));
    return dir;
}

function afterMode(command, mode) {
    const words = command.split(" ");
    return words.slice(words.indexOf(mode) + 1);
}

function advisoryCommands(settings) {
    const block = settings.hooks.Stop[0].hooks[1]?.command;
    return [
        [settings.hooks.PostToolUse[0].hooks[0].command, "tool"],
        [settings.hooks.UserPromptSubmit[0].hooks[0].command, "prompt"],
        [settings.statusLine.command, "status"],
        ...(block === undefined ? [] : [[block, "stop"]]),
    ];
}

const DECLARED = { manifest: ".portulan/workspace.json", multipliers: { read: 0.05, write: { "5m": 1.5, "1h": 2.5 } }, horizon: 30, restart: null };

describe("the declared figures", () => {
    test("undeclared, or declared with neither half, the settings and the notes read exactly as they did", () => {
        const plain = claudeCode(parse(policy()));
        const none = { manifest: ".portulan/workspace.json", multipliers: null, horizon: null };
        for (const spend of [null, none, { ...none, restart: null }, { ...none, restart: "advise" }]) {
            const out = claudeCode(parse(policy()), { spend });
            assert.equal(out.artifact.text, plain.artifact.text);
            assert.deepEqual(out.notes, plain.notes);
        }
        assert.equal(plain.artifact.value.$portulan.spend, undefined);
    });

    test("declared, all three advisory commands carry the figures, and the header names where they came from", () => {
        const settings = claudeCode(parse(policy()), { spend: DECLARED }).artifact.value;
        const figures = " --read 0.05 --write-5m 1.5 --write-1h 2.5 --horizon 30";
        assert.deepEqual(
            settings.hooks.PostToolUse.flatMap((h) => h.hooks.map((x) => x.command)),
            [`node "\${CLAUDE_PROJECT_DIR}/cli/advisory.mjs" tool${figures}`],
        );
        assert.deepEqual(
            settings.hooks.UserPromptSubmit.flatMap((h) => h.hooks.map((x) => x.command)),
            [`node "\${CLAUDE_PROJECT_DIR}/cli/advisory.mjs" prompt${figures}`],
        );
        assert.equal(settings.statusLine.command, `node "\${CLAUDE_PROJECT_DIR}/cli/advisory.mjs" status${figures}`);
        assert.equal(settings.$portulan.spend, ".portulan/workspace.json");
        assert.equal(
            settings.$portulan.warning,
            "Generated file. Edit .portulan/gates.json, or `spend` in .portulan/workspace.json, and recompile; `verify/compile.sh` fails on drift.",
        );
    });

    test("declared, the figures are said on every run, with what carries them", () => {
        const out = claudeCode(parse(policy()), { spend: DECLARED });
        assert.ok(
            out.notes.includes(
                "the restart advisory and the status line compute the threshold at the declared figures (`spend`): read 0.05×, " +
                    "write 1.5× for five minutes and 2.5× for an hour, whichever lifetime the host records, and a horizon of 30 " +
                    "requests. The compiled commands carry them, so an edit to `spend` is drift until recompiled",
            ),
            out.notes.join("\n"),
        );
    });

    test("each half is written alone: the multipliers at the general horizon, and a horizon at the general multipliers", () => {
        const multipliers = claudeCode(parse(policy()), { spend: { ...DECLARED, horizon: null } });
        assert.match(multipliers.artifact.value.statusLine.command, / status --read 0\.05 --write-5m 1\.5 --write-1h 2\.5$/);
        assert.ok(multipliers.notes.some((n) => /for an hour, whichever lifetime the host records, and the general horizon of 20 requests\./.test(n)), multipliers.notes.join("\n"));
        const horizon = claudeCode(parse(policy()), { spend: { ...DECLARED, multipliers: null } });
        assert.match(horizon.artifact.value.statusLine.command, / status --horizon 30$/);
        assert.ok(horizon.notes.some((n) => /declared figures \(`spend`\): the general multipliers, and a horizon of 30 requests\./.test(n)), horizon.notes.join("\n"));
        for (const out of [multipliers, horizon]) assert.equal(out.artifact.value.$portulan.spend, ".portulan/workspace.json");
    });

    test("a declared block is a second Stop command beside the Stop-gate's, carrying the figures, and said on every run", () => {
        const stopGate = `node "\${CLAUDE_PROJECT_DIR}/cli/stop-gate.mjs"`;
        const block = claudeCode(parse(policy()), { spend: { ...DECLARED, restart: "block" } });
        assert.deepEqual(
            block.artifact.value.hooks.Stop,
            [{ hooks: [{ type: "command", command: stopGate }, { type: "command", command: `node "\${CLAUDE_PROJECT_DIR}/cli/advisory.mjs" stop --read 0.05 --write-5m 1.5 --write-1h 2.5 --horizon 30` }] }],
        );
        const said =
            "the restart advisory also holds a turn's end (`spend.restart` \"block\"): at the first stop at or past the restart threshold that no block provoked, " +
            "once in a session and again after each compaction, with the line as the reason, beside the Stop-gate. Nothing ends the session, " +
            "and the line still comes with a tool result or at the prompt";
        assert.ok(block.notes.includes(said), block.notes.join("\n"));
        const alone = claudeCode(parse(policy()), { spend: { manifest: ".portulan/workspace.json", multipliers: null, horizon: null, restart: "block" } });
        const value = alone.artifact.value;
        assert.equal(value.hooks.Stop[0].hooks[1].command, `node "\${CLAUDE_PROJECT_DIR}/cli/advisory.mjs" stop`);
        assert.equal(value.statusLine.command, `node "\${CLAUDE_PROJECT_DIR}/cli/advisory.mjs" status`);
        assert.equal(value.$portulan.spend, ".portulan/workspace.json");
        assert.equal(value.$portulan.warning, "Generated file. Edit .portulan/gates.json, or `spend` in .portulan/workspace.json, and recompile; `verify/compile.sh` fails on drift.");
        assert.ok(alone.notes.includes(said), alone.notes.join("\n"));
        assert.ok(!alone.notes.some((n) => /declared figures/.test(n)), alone.notes.join("\n"));
        // The Stop-gate stays first: `ab.mjs` wraps an arm's first Stop command in its recorder.
        assert.equal(value.hooks.Stop[0].hooks[0].command, stopGate);
    });

    test("the warning names each key where it was declared: two in one manifest once, and two manifests each", () => {
        const sessions = { manifest: ".portulan/workspace.json", cache_lifetime: "5m" };
        const header = (options) => claudeCode(parse(policy()), options).artifact.value.$portulan;
        const both = header({ sessions, spend: DECLARED });
        assert.equal(
            both.warning,
            "Generated file. Edit .portulan/gates.json, or `sessions` and `spend` in .portulan/workspace.json, and recompile; `verify/compile.sh` fails on drift.",
        );
        assert.deepEqual(Object.keys(both), ["generated", "source", "sessions", "spend", "warning"]);
        // An API caller may name two manifests; `compile` reads one.
        const apart = header({ sessions: { ...sessions, manifest: "a/workspace.json" }, spend: { ...DECLARED, manifest: "b/workspace.json" } });
        assert.equal(
            apart.warning,
            "Generated file. Edit .portulan/gates.json, or `sessions` in a/workspace.json, or `spend` in b/workspace.json, and recompile; `verify/compile.sh` fails on drift.",
        );
        const headless = header({ sessions: { manifest: ".portulan/workspace.json", headless: { cache_lifetime: "5m" } }, spend: DECLARED });
        assert.equal(headless.warning, header({ spend: DECLARED }).warning);
        assert.equal(headless.sessions, undefined);
        assert.equal(
            header({ sessions, spend: { ...DECLARED, multipliers: null, horizon: null } }).warning,
            "Generated file. Edit .portulan/gates.json, or `sessions` in .portulan/workspace.json, and recompile; `verify/compile.sh` fails on drift.",
        );
    });

    test("the figures on each command read back, through the advisory's own reader, as the declaration", () => {
        for (const spend of [
            DECLARED,
            { manifest: "w.json", multipliers: { read: 1, write: { "5m": 1, "1h": 1 } }, horizon: 1 },
            { manifest: "w.json", multipliers: { read: 1e-7, write: { "5m": 1e21, "1h": 12.5 } }, horizon: Number.MAX_SAFE_INTEGER },
            // `String(1e21)` is `1e+21`, which `doctor` passes as a positive integer.
            { manifest: "w.json", multipliers: null, horizon: 1e21 },
            { manifest: "w.json", multipliers: null, horizon: 7 },
            { manifest: "w.json", multipliers: { read: 0.25, write: { "5m": 1.25, "1h": 2 } }, horizon: null },
        ]) {
            const commands = advisoryCommands(claudeCode(parse(policy()), { spend: { ...spend, restart: "block" } }).artifact.value);
            assert.deepEqual(commands.map(([, mode]) => mode), ["tool", "prompt", "status", "stop"]);
            for (const [command, mode] of commands) {
                assert.deepEqual(spendFlags(afterMode(command, mode)), { declared: spend.multipliers, horizon: spend.horizon, fault: null }, command);
            }
        }
    });

    test("the commands carry no shell syntax: after the runner and its mode, only flags and numbers", () => {
        const spend = { manifest: "w.json", multipliers: { read: 1e-7, write: { "5m": 1e21, "1h": 2 } }, horizon: 30, restart: "block" };
        for (const [command, mode] of advisoryCommands(claudeCode(parse(policy()), { spend }).artifact.value)) {
            assert.doesNotMatch(command, /[|;&><]/, command);
            for (const word of afterMode(command, mode)) assert.match(word, /^(--[a-z0-9-]+|[0-9][0-9.e+-]*)$/, command);
        }
    });

    test("the declaration is read from the manifest in the ledger's shape, and a manifest without it reads as none", () => {
        assert.equal(spendDeclaration(workspace()), null);
        const dir = workspaceWithSpend({ multipliers: { read: 0.05, write: { "5m": 1.5, "1h": 2.5 } }, horizon: { requests: 30 } });
        assert.deepEqual(spendDeclaration(dir), DECLARED);
        assert.deepEqual(spendDeclaration(workspaceWithSpend({})), { manifest: ".portulan/workspace.json", multipliers: null, horizon: null, restart: null });
        assert.deepEqual(spendDeclaration(workspaceWithSpend({ restart: "block" })), { manifest: ".portulan/workspace.json", multipliers: null, horizon: null, restart: "block" });
        // A missing or unparseable manifest is `doctor`'s to name: `run` stops on the second before it asks.
        assert.equal(spendDeclaration(scratch()), null);
        const broken = workspace();
        fs.writeFileSync(path.join(broken, ".portulan", "workspace.json"), "{");
        assert.equal(spendDeclaration(broken), null);
    });

    for (const [what, spend] of [
        ["a key it does not take", { budget: 1 }],
        ["a list in place of the object", [0.1]],
        ["a read above 1, dearer than the token sent uncached", { multipliers: { read: 1.5, write: { "5m": 1.25, "1h": 2 } } }],
        ["a read of 0", { multipliers: { read: 0, write: { "5m": 1.25, "1h": 2 } } }],
        ["a write below 1, cheaper than the token sent uncached", { multipliers: { read: 0.1, write: { "5m": 0.9, "1h": 2 } } }],
        ["a write missing one of the two lifetimes", { multipliers: { read: 0.1, write: { "5m": 1.25 } } }],
        ["a lifetime the host does not take", { multipliers: { read: 0.1, write: { "5m": 1.25, "1h": 2, "30m": 1.5 } } }],
        ["a figure spelled as a string", { multipliers: { read: "0.1", write: { "5m": 1.25, "1h": 2 } } }],
        ["multipliers without their write", { multipliers: { read: 0.1 } }],
        ["a horizon that is not a whole number of requests", { horizon: { requests: 2.5 } }],
        ["a horizon of no requests", { horizon: { requests: 0 } }],
        ["a horizon spelled as a bare number", { horizon: 20 }],
        ["a restart it does not take", { restart: "stop" }],
        ["a restart spelled as a boolean", { restart: true }],
    ]) {
        test(`${what} stops compile with exit 2 and writes nothing`, () => {
            const dir = workspaceWithSpend(spend);
            assert.throws(
                () => spendDeclaration(dir),
                (error) => error instanceof CompileError && error.message.startsWith("`spend` in .portulan/workspace.json "),
            );
            assert.equal(run(["--workspace", dir], { quiet: true }), 2);
            assert.equal(fs.existsSync(path.join(dir, ".claude", "settings.json")), false);
        });
    }

    test("a restart in a manifest that declares 2.12 stops compile with exit 2, in doctor's words", async () => {
        for (const restart of ["block", "advise"]) {
            const dir = workspaceWithSpend({ restart }, policy(), "2.12");
            const doctors = (await inspect(path.join(dir, ".portulan"))).findings.find((f) => f.message.startsWith("`spend.restart`"));
            assert.throws(
                () => spendDeclaration(dir),
                (error) => error instanceof CompileError && error.message === doctors?.message.replace("`spend.restart`", "`spend.restart` in .portulan/workspace.json"),
            );
            assert.equal(run(["--workspace", dir], { quiet: true }), 2);
            assert.equal(fs.existsSync(path.join(dir, ".claude", "settings.json")), false);
        }
        assert.equal(spendDeclaration(workspaceWithSpend({ horizon: { requests: 30 } }, policy(), "2.12")).restart, null, "the rest of `spend` is 2.12's");
    });

    test("compiled end to end, the commands carry the figures and --check holds them to the manifest", () => {
        const dir = workspaceWithSpend({ multipliers: { read: 0.05, write: { "5m": 1.5, "1h": 2.5 } }, horizon: { requests: 30 } });
        assert.equal(run(["--workspace", dir], { quiet: true }), 0);
        const target = path.join(dir, ".claude", "settings.json");
        const settings = JSON.parse(fs.readFileSync(target, "utf8"));
        for (const [command, mode] of advisoryCommands(settings)) {
            assert.ok(command.endsWith(` ${mode} --read 0.05 --write-5m 1.5 --write-1h 2.5 --horizon 30`), command);
        }
        assert.equal(settings.$portulan.spend, ".portulan/workspace.json");
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 0);
        const file = path.join(dir, ".portulan", "workspace.json");
        const edit = (change) => {
            const m = JSON.parse(fs.readFileSync(file, "utf8"));
            change(m);
            fs.writeFileSync(file, JSON.stringify(m, null, 2));
        };
        edit((m) => (m.spend.horizon.requests = 40));
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 1);
        const before = fs.readFileSync(target, "utf8");
        edit((m) => (m.spend.multipliers.read = 2));
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 2);
        assert.equal(run(["--workspace", dir], { quiet: true }), 2);
        assert.equal(fs.readFileSync(target, "utf8"), before);
        edit((m) => delete m.spend);
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 1);
        assert.equal(run(["--workspace", dir], { quiet: true }), 0);
        assert.doesNotMatch(fs.readFileSync(target, "utf8"), /--read|--horizon|"spend"/);
    });

    test("compiled end to end, a declared block is written and held to the manifest, and an advice compiles as none", () => {
        const dir = workspaceWithSpend({ restart: "block" });
        const without = workspace();
        const target = path.join(dir, ".claude", "settings.json");
        assert.equal(run(["--workspace", dir], { quiet: true }), 0);
        const [gate, block, ...more] = JSON.parse(fs.readFileSync(target, "utf8")).hooks.Stop[0].hooks.map((h) => h.command);
        assert.ok(gate.endsWith('/cli/stop-gate.mjs"') && block.endsWith('/cli/advisory.mjs" stop') && more.length === 0, [gate, block, ...more].join("\n"));
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 0);
        const file = path.join(dir, ".portulan", "workspace.json");
        const m = JSON.parse(fs.readFileSync(file, "utf8"));
        m.spend.restart = "advise";
        fs.writeFileSync(file, JSON.stringify(m, null, 2));
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 1);
        assert.equal(run(["--workspace", dir], { quiet: true }), 0);
        assert.equal(run(["--workspace", without], { quiet: true }), 0);
        assert.equal(fs.readFileSync(target, "utf8"), fs.readFileSync(path.join(without, ".claude", "settings.json"), "utf8"));
    });

    test("a manifest declaring `spend` with neither half compiles byte for byte as one without the key", () => {
        const without = workspace();
        const empty = workspaceWithSpend({});
        assert.equal(run(["--workspace", without], { quiet: true }), 0);
        assert.equal(run(["--workspace", empty], { quiet: true }), 0);
        const read = (dir) => fs.readFileSync(path.join(dir, ".claude", "settings.json"), "utf8");
        assert.equal(read(empty), read(without));
    });
});

describe("a path target no path can match — hole 8, closed at the tier that asks", () => {
    const REDUCES_TO_NOTHING = ["./", ".", "./.", "././", ".//"];
    const INTERIOR_DOT_OR_EMPTY = ["docs/./vision.md", "docs//vision.md", "docs//", "docs/.", "./docs/./", "docs/vision.md/."];
    const CARRIES_A_BACKSLASH = ["docs\\vision.md", "docs\\"];
    const NEVER = [...REDUCES_TO_NOTHING, ...INTERIOR_DOT_OR_EMPTY, ...CARRIES_A_BACKSLASH];
    // The predicate removes exactly one trailing slash: `docs/` is a real subtree target, `docs//` is not.
    const CONTROLS = ["docs/", "./docs/", "docs/vision.md", "core/operating/loop.md", ".portulan/", ".hidden", ".gitignore", "docs/.gitignore", "..hidden"];

    const one = (target, tier, kind = "write") => ({
        portulan: { spec: "2.2" },
        why: "gate-map.md",
        rules: [{ id: "probe", tier, reason: "probe", action: { [kind]: target } }],
    });

    test("the predicate answers for every never-matching spelling, and for none of the controls", () => {
        for (const t of NEVER) assert.ok(neverMatches(t), `${JSON.stringify(t)} should never match`);
        for (const t of CONTROLS) assert.ok(!neverMatches(t), `${JSON.stringify(t)} is a real target`);
        // `parse` refuses both, but the predicate must answer for them on its own.
        assert.ok(neverMatches(""));
        assert.ok(neverMatches("/"));
    });

    test("the predicate agrees with the matcher it speaks for", () => {
        const candidates = ["/repo/x.md", "/repo/docs/vision.md", "/repo/core/operating/loop.md", "/repo/a/b/c"];
        for (const t of NEVER) {
            const rule = parse(one(t, "auto")).rules[0];
            for (const c of candidates) {
                assert.equal(matchesRule(rule, "Write", { file_path: c }), false, `${JSON.stringify(t)} vs ${c}`);
            }
        }
    });


    // Assumed, not measured: a host submits an absolute path with no `.` segment, no empty segment and no backslash.
    const hostWouldSubmit = (c) => !c.includes("\\") && !c.includes("//") && !/(^|\/)\.(\/|$)/.test(c);

    test("the predicate agrees with `matchesPath` itself, target by target", () => {
        const derive = (t) => {
            const clean = String(t).replace(/^\.\//, "").replace(/^\/+/, "");
            const body = clean.endsWith("/") ? clean.slice(0, -1) : clean;
            return [`/r/${clean}`, `/r/${body}`, `/r/${body}/x`, `/r/${body}x`, `/r/x/${body}`, "/r/x.md", "/r/a/b/c"].filter(hostWouldSubmit);
        };
        for (const t of NEVER) {
            for (const c of derive(t)) {
                assert.equal(matchesPath(c, t), false, `${JSON.stringify(t)} must not match ${c}`);
            }
        }
        for (const t of CONTROLS) {
            assert.ok(
                derive(t).some((c) => matchesPath(c, t)),
                `${JSON.stringify(t)} is a real target and must match at least one derived candidate`,
            );
        }
        for (const t of [...NEVER, ...CONTROLS]) {
            assert.equal(
                neverMatches(t),
                !derive(t).some((c) => matchesPath(c, t)),
                `${JSON.stringify(t)}: the predicate and the matcher disagree`,
            );
        }
    });

    test("the interior family compiles to a named surface and still matches nothing — the hazard, not a typo", () => {
        assert.equal(claudeCode(parse(one("docs/./vision.md", "auto"))).compiled.length, 0, "auto compiles nothing");
        assert.throws(
            () => claudeCode(parse(one("docs/./vision.md", "gated"))),
            (e) => e.message.includes("Edit(./docs/./vision.md)"),
        );
        for (const t of INTERIOR_DOT_OR_EMPTY) {
            const rule = parse(one(t, "auto")).rules[0];
            for (const c of ["/repo/docs/vision.md", "/repo/docs", "/repo/docs/a/b", "/repo/x.md"]) {
                assert.equal(matchesRule(rule, "Write", { file_path: c }), false, `${JSON.stringify(t)} vs ${c}`);
            }
        }
    });

    for (const tier of ["gated", "prohibited"]) {
        test(`the Claude Code backend refuses a ${tier} write target that can never match`, () => {
            for (const t of NEVER) {
                assert.throws(
                    () => claudeCode(parse(one(t, tier))),
                    (e) => e instanceof CompileError && e.message.includes("matches no path a host") && e.message.includes(JSON.stringify(t)),
                    `${tier} ${JSON.stringify(t)}`,
                );
            }
        });

        test(`and refuses it for a ${tier} READ target too — one predicate, both path kinds`, () => {
            assert.throws(() => claudeCode(parse(one("./", tier, "read"))), CompileError);
        });
    }

    test("the `auto` tier is untouched — the two rules this workspace actually has keep their spelling", () => {
        for (const t of NEVER) {
            const out = claudeCode(parse(one(t, "auto")));
            assert.equal(out.compiled.length, 0);
            assert.equal(out.refused.length, 1);
            assert.equal(out.refused[0].tier, "auto");
        }
    });

    test("a `shell` target is not a path, and is not touched by this", () => {
        const out = claudeCode(parse(one("./", "gated", "shell")));
        assert.ok(out.compiled.some((c) => c.surface.includes("Bash(./:*)")));
    });

    test("a real target still compiles, so the refusal is not a blanket", () => {
        for (const t of CONTROLS) {
            const out = claudeCode(parse(one(t, "gated")));
            assert.equal(out.compiled.length, 1);
            assert.ok(out.compiled[0].surface.startsWith("Edit("));
        }
    });

// ---- the neighbouring family this predicate deliberately does NOT claim
    // A known divergence, pinned as it stands: the permission layer gates a glob target and the hook does not.
    test("a glob metacharacter is unmatchable by the hook, is NOT flagged, and says so", () => {
        for (const t of ["docs/**", "docs/*", "docs/?.md"]) {
            assert.equal(neverMatches(t), false, `${JSON.stringify(t)} is deliberately not flagged`);
            const rule = parse(one(t, "auto")).rules[0];
            for (const c of ["/repo/docs/vision.md", "/repo/docs/a/b.md", "/repo/x.md"]) {
                assert.equal(matchesRule(rule, "Write", { file_path: c }), false, `${JSON.stringify(t)} vs ${c}`);
            }
        }
    });

    test("and `docs/**` emits the same surface a real subtree target does — which is why refusing it would remove a gate", () => {
        const glob = claudeCode(parse(one("docs/**", "gated"))).compiled[0].surface;
        const real = claudeCode(parse(one("docs/", "gated"))).compiled[0].surface;
        assert.equal(glob, real);
        assert.ok(glob.startsWith("Edit(./docs/**)"), glob);
        assert.equal(matchesRule(parse(one("docs/", "auto")).rules[0], "Write", { file_path: "/repo/docs/a.md" }), true);
        assert.equal(matchesRule(parse(one("docs/**", "auto")).rules[0], "Write", { file_path: "/repo/docs/a.md" }), false);
    });

    test("the refusal names the surface it would have emitted, and points at the record", () => {
        try {
            claudeCode(parse(one("././", "gated")));
            assert.fail("expected a refusal");
        } catch (e) {
            assert.ok(e instanceof CompileError);
            assert.ok(e.message.includes("Edit(././**)"), e.message);
            assert.ok(e.message.includes("entry 8"), e.message);
        }
    });
});

// ===========================================================================================
// 4a. The floor backend — a GitHub repository ruleset, compiled from the same policy
// ===========================================================================================

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
        const rule = ruleset().rules.find((r) => r.type === "required_status_checks");
        assert.equal(rule.parameters.strict_required_status_checks_policy, true);
    });

    test("every declared check reaches the emitted ruleset, with its app pin intact", () => {
        const rule = ruleset().rules.find((r) => r.type === "required_status_checks");
        assert.deepEqual(rule.parameters.required_status_checks, [{ context: "workspace-verify", integration_id: 15368 }]);
    });

    test("bypass_actors is empty, deliberately and unconditionally", () => {
        assert.deepEqual(ruleset().bypass_actors, []);
    });

    test("enforcement is active — an exported ruleset in evaluate mode reads as a floor and holds nothing", () => {
        assert.equal(ruleset().enforcement, "active");
    });

    test("the ruleset name says it is generated, because the format has nowhere else to say it", () => {
        assert.match(ruleset().name, /generated/i);
        assert.match(ruleset().name, /gates\.json/);
    });

    test("only the server's input fields are emitted — never an id, a timestamp or a source", () => {
        for (const key of ["id", "node_id", "source", "source_type", "created_at", "updated_at", "_links", "current_user_can_bypass"]) {
            assert.ok(!(key in ruleset()), `${key} is the server's to say, not this compiler's`);
        }
    });

    test("the declared branch becomes the ref condition, and nothing else does", () => {
        assert.deepEqual(ruleset().conditions.ref_name, { include: ["refs/heads/main"], exclude: [] });
        assert.deepEqual(ruleset(withFloor({ branch: "trunk" })).conditions.ref_name.include, ["refs/heads/trunk"]);
    });

    // ---- the four ways the floor declaration could be believed and be wrong ------------------

    test("a `floor.branch` already carrying a ref prefix is refused, not double-prefixed", () => {
        for (const branch of ["refs/heads/main", "refs/tags/v1"]) {
            assert.throws(() => parse(withFloor({ branch })), CompileError, `${branch} must be refused`);
        }
        assert.equal(githubRuleset(parse(withFloor({ branch: "release/2026" }))).artifact.value.conditions.ref_name.include[0], "refs/heads/release/2026");
    });

    test("a check context with surrounding whitespace is refused rather than normalised", () => {
        assert.throws(() => parse(withFloor({ checks: [{ context: " workspace-verify " }] })), CompileError);
    });

    test("an `auto` rule never compiles to a ref rule, whatever it is spelled", () => {
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
        const p = withFloor();
        p.rules = p.rules.filter((r) => r.tier !== "propose");
        const result = githubRuleset(parse(p));
        const types = result.artifact.value.rules.map((r) => r.type);
        assert.ok(!types.includes("pull_request"), "no rule asked for a pull-request requirement");
        assert.ok(!types.includes("required_status_checks"));
        assert.ok(types.includes("non_fast_forward"), "the ref rules that WERE asked for still compile");

        const surfaces = new Set(result.compiled.flatMap((c) => c.surface.split(" · ")));
        for (const type of types) assert.ok(surfaces.has(type), `\`${type}\` is in the artifact and no rule compiled to it`);

        assert.ok(result.notes.some((n) => /no `propose` rule/.test(n)), "declared checks nothing compiles must be named");
    });

    test("a floor declaring no checks refuses the pull-request rule TOO — the mapping is a pair", () => {
        // The two ref-gated rules keep the ruleset non-empty, so the refusal is visible rather than fatal.
        const result = githubRuleset(parse(withFloor({ checks: [] })));
        assert.ok(!result.artifact.value.rules.some((r) => r.type === "pull_request"));
        assert.ok(!result.artifact.value.rules.some((r) => r.type === "required_status_checks"));
        const refusal = result.refused.find((r) => r.id === "pr");
        assert.match(refusal.why, /declares no status check/, "the refusal must name the missing declaration");
    });

    test("a floor declaring no checks and holding no ref rule refuses the whole compile", () => {
        const p = withFloor({ checks: [] });
        p.rules = p.rules.filter((r) => r.id !== "force" && r.id !== "drop");
        assert.throws(() => githubRuleset(parse(p)), CompileError, "nothing in this policy reaches the floor");
    });

    // ---- the mapping is a table of exact spellings, not a parser -----------------------------

    test("the ref-gated spellings compile; a spelling one character off refuses", () => {
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
        // On its one ref, `non_fast_forward` also blocks `--force-with-lease`, which the policy makes Auto.
        const notes = githubRuleset(parse(withFloor())).notes ?? [];
        assert.ok(notes.some((n) => /--force-with-lease/.test(n)), "the stricter-than-policy direction must be recorded");
        assert.ok(notes.some((n) => /only.*refs\/heads\/main|one declared ref/.test(n)), "the narrower-than-policy direction too");
    });

    // ---- refusals must be true about GitHub, not merely convenient --------------------------

    test("a write-scoped rule is refused for SCOPE, never for impossibility", () => {
        // CODEOWNERS and push rulesets do gate paths on GitHub, so "the platform cannot" would be false.
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
        const dir = workspace(withFloor());
        assert.equal(run(["--workspace", dir], { quiet: true }), 0);
        const orphan = path.join(dir, ".portulan", "compile", "github-ruleset.json");
        assert.ok(fs.existsSync(orphan));

        const p = withFloor();
        delete p.floor;
        fs.writeFileSync(path.join(dir, ".portulan", "gates.json"), JSON.stringify(p, null, 2));
        assert.equal(run(["--workspace", dir, "--check"], { quiet: true }), 1, "the orphan must be a verdict, not a silence");

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
        const rule = { tier: "gated", action: { shell: "./.portulan/verify/" } };
        assert.ok(matchesRule(rule, "Bash", { command: "./.portulan/verify/docs.sh" }));
        assert.ok(matchesRule(rule, "Bash", { command: "./.portulan/verify/tests.sh --quiet" }));
        assert.ok(matchesRule(rule, "Bash", { command: 'bash -c "./.portulan/verify/docs.sh"' }), "through a wrapper too");
        assert.ok(!matchesRule(rule, "Bash", { command: "./.portulan/verifyx/docs.sh" }), "the slash is the boundary");
    });

    test("a trailing slash does not loosen an ordinary command prefix", () => {
        assert.ok(!matchesRule({ action: { shell: "git push" } }, "Bash", { command: "git pushall" }));
    });

    for (const [label, target, command] of [
        ["after `&&`", "git push --force", "ls && git push --force origin main"],
        ["after `;`", "git push --force", "git status; git push --force origin main"],
        ["after a newline", "git push --force", "git status\ngit push --force origin main"],
        ["a merge, mid-line", "gh pr merge", "echo hi && gh pr merge 60"],
        ["a repo delete, mid-line", "gh repo delete", "cd . && gh repo delete foo"],
        ["a publish after a pipe", "npm publish", "echo y | npm publish"],
        ["a path-prefix target, mid-line", "./.portulan/verify/", "ls && ./.portulan/verify/docs.sh"],
        ["a `$'…'` wrapper payload", "git push --force", "bash -c $'git push --force origin main'"],
        ['a `$"…"` wrapper payload', "git push --force", 'bash -c $"git push --force origin main"'],
        ["a `$'…'` wrapper, mid-line", "git push --force", "ls && bash -c $'git push --force origin main'"],
        ["a plain wrapper, mid-line", "git push --force", 'ls && bash -c "git push --force origin main"'],
        ["a wrapper after a `;`", "gh pr merge", 'git status; bash -c "gh pr merge 60"'],
        ["after an escaped quote", "git push --force", 'echo "x\\""; git push --force origin main'],
    ]) {
        test(`a gated command is gated wherever it sits on the line: ${label}`, () => {
            assert.ok(matchesRule({ tier: "gated", action: { shell: target } }, "Bash", { command }), command);
        });
    }

    test("splitting the line does not widen any gate — the Auto spellings stay Auto", () => {
        const force = { tier: "gated", action: { shell: "git push --force" } };
        assert.ok(!matchesRule(force, "Bash", { command: "git push --force-with-lease origin main" }));
        assert.ok(!matchesRule(force, "Bash", { command: "ls && git push --force-with-lease origin main" }), "mid-line too");
        assert.ok(!matchesRule(force, "Bash", { command: "git pushall --force" }), "the word boundary still holds");
        assert.ok(!matchesRule(force, "Bash", { command: 'echo "git push --force"' }), "quoted text is not a command");
    });

    // Left open on purpose: a table of leading words (`nice`, `time`, `nohup`, `doas`…) has no natural edge.
    for (const [label, command] of [
        ["a leading assignment", "FOO=bar git push --force origin main"],
        ["`env`", "env git push --force origin main"],
        ["`sudo`", "sudo git push --force origin main"],
        ["a `then` branch", "if true; then git push --force origin main; fi"],
        ["a `do` body", "for x in 1; do git push --force origin main; done"],
        ["a brace group", "{ git push --force origin main; }"],
    ]) {
        test(`the limit is asserted, not just documented: a leader still escapes — ${label}`, () => {
            const rule = { tier: "gated", action: { shell: "git push --force" } };
            assert.ok(!matchesRule(rule, "Bash", { command }), command);
            assert.ok(matchesRule(rule, "Bash", { command: "git push --force origin main" }));
        });
    }

    for (const [label, command] of [
        ["a leading `2>&1`", "2>&1 git push --force origin main"],
        ["a leading `>` to a file", "> /tmp/log git push --force origin main"],
        ["a leading `2>/dev/null`", "2>/dev/null git push --force origin main"],
        ["a leading `<`", "< /dev/null git push --force origin main"],
        ["a leading `>|`", ">| /tmp/log git push --force origin main"],
        ["a leading `&>`", "&> /tmp/log git push --force origin main"],
        ["two stacked redirections", "> /tmp/out 2>&1 git push --force origin main"],
        ["a double-quoted target with a space", '> "foo bar" git push --force origin main'],
        ["a single-quoted target with a space", "> 'foo bar' git push --force origin main"],
        ["a backslash-escaped space in the target", "> foo\\ bar git push --force origin main"],
        ["a quoted target after a numbered fd", '2> "my log.txt" git push --force origin main'],
        ["a quoted target after `>|`", '>| "foo bar" git push --force origin main'],
        ["a quoted target after `&>`", '&> "foo bar" git push --force origin main'],
        ["two stacked redirections, one quoted", '> "a" 2> "b c" git push --force origin main'],
    ]) {
        test(`a leading redirection is CLOSED, not documented — ${label}`, () => {
            const rule = { tier: "gated", action: { shell: "git push --force" } };
            assert.ok(matchesRule(rule, "Bash", { command }), command);
        });
    }

    for (const [label, command, gated] of [
        ["a bare redirection is not a command", "> /tmp/log", false],
        ["the lease survives a leading redirection", "2>&1 git push --force-with-lease origin main", false],
        ["`&&` still separates", "ls && git push --force origin main", true],
        ["a background `&` still separates", "ls & git push --force origin main", true],
        ["a pipe still separates", "ls | git push --force origin main", true],
        ["`&>` beside `&&` splits at the `&&` only", "ls &>/dev/null && git push --force origin main", true],
        ["quoted text is still not a command", 'echo "2>&1 git push --force"', false],
        ["an unquoted two-word target is a target and a COMMAND", "> foo bar git push --force origin main", false],
        ["the lease survives a quoted target", '> "foo bar" git push --force-with-lease origin main', false],
        ["an escaped `>` before a REAL pipe", "echo \\>| git push --force origin main", true],
        ["an escaped `>` before a REAL background separator", "echo \\>& git push --force origin main", true],
        ["an escaped `<` before a real separator", "echo \\<& git push --force origin main", true],
        ["the lease survives the escaped form too", "echo \\>| git push --force-with-lease origin main", false],
    ]) {
        test(`closing the redirection leader widens nothing — ${label}`, () => {
            const rule = { tier: "gated", action: { shell: "git push --force" } };
            assert.equal(matchesRule(rule, "Bash", { command }), gated, command);
        });
    }

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

    // `gate.mjs` steps aside on a throw, so a throw here would remove the gate being evaluated.
    for (const input of [{}, { command: undefined }, { command: null }, { command: 123 }, { command: {} }]) {
        test(`the never-throws contract holds for a Bash payload of ${JSON.stringify(input)}`, () => {
            const rule = { tier: "gated", action: { shell: "git push --force" } };
            assert.equal(matchesRule(rule, "Bash", input), false, "a payload with no readable command matches nothing");
        });
    }


    // ---------------------------------------------------------------------------------------------
    // The CLASS rail: the redirection-target reader agrees with `shellWords` about what a word is
    // ---------------------------------------------------------------------------------------------
    // A limit: it cannot invent spellings, so a form neither this table nor `shellWords` handles escapes both.
    const ONE_WORD_TARGETS = [
        "/dev/null",
        "/tmp/log",
        '"foo bar"',
        "'foo bar'",
        "foo\\ bar",
        '"foo \\"bar baz\\""',
        '"a\\"b"',
        "'a b'",
        '"a;b"',
        '"a|b"',
        '"a&&b"',
        "''",
        '""',
    ];
    
    for (const target of ONE_WORD_TARGETS) {
        test(`the target reader agrees with shellWords that this is ONE word — ${target}`, () => {
            const words = shellWords(target).filter((w) => !w.op);
            assert.equal(words.length, 1, `shellWords does not call ${target} one word — the table is wrong, not the matcher`);
    
            const rule = { tier: "gated", action: { shell: "git push --force" } };
            assert.ok(
                matchesRule(rule, "Bash", { command: `> ${target} git push --force origin main` }),
                `a leading redirection to ${target} hid the command behind it`,
            );
    
            assert.ok(!matchesRule(rule, "Bash", { command: `> ${target} git push --force-with-lease origin main` }));
        });
    }
    
    test("an UNQUOTED two-word target is two words to shellWords, and the matcher agrees", () => {
        // Bash redirects to `foo` and runs `bar`, so `git push --force` is not the command.
        assert.equal(shellWords("foo bar").filter((w) => !w.op).length, 2);
        const rule = { tier: "gated", action: { shell: "git push --force" } };
        assert.ok(!matchesRule(rule, "Bash", { command: "> foo bar git push --force origin main" }));
    });
    
    test("a single-quoted span has NO escapes, and the reader must not invent them", () => {
        const rule = { tier: "gated", action: { shell: "git push --force" } };
        assert.ok(matchesRule(rule, "Bash", { command: "> 'a\\' git push --force origin main" }));
    });

    for (const [label, command, gated] of [
        ["a leading redirect before a wrapper", '> /tmp/log bash -c "echo x >> ./docs/vision.md"', true],
        ["the same, after a separator", 'git status; > /tmp/log bash -c "echo x >> ./docs/vision.md"', true],
        ["an fd-dup leader before a wrapper", '2>&1 bash -c "echo x >> ./docs/vision.md"', true],
        ["after `&&` too", 'ls && > /tmp/log bash -c "echo x >> ./docs/vision.md"', true],
        ["the reported shape — the redirect IS the write", "> ./docs/vision.md echo ok", true],
        ["the reported shape inside a wrapper", 'bash -c "> ./docs/vision.md echo ok"', true],
        ["a leading redirect before a writer", "> /tmp/log cp /tmp/x ./docs/vision.md", true],
        ["a leading redirect before a container removal", "> /tmp/log rm -rf docs", true],
        ["an unrelated file through the same path", '> /tmp/log bash -c "echo x >> docs/plan.md"', false],
        ["a leading redirect and no write at all", "> /tmp/log echo ok", false],
    ]) {
        test(`the redirection strip does not weaken the WRITE gate — ${label}`, () => {
            const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
            assert.equal(matchesRule(rule, "Bash", { command }), gated, command);
        });
    }

    for (const writer of FILE_WRITERS) {
        test(`every FILE_WRITERS entry is exercised, not just tabled — ${writer}`, () => {
            const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
            assert.ok(
                matchesRule(rule, "Bash", { command: `${writer} /tmp/x docs/vision.md` }),
                `${writer} names the constitution and writes what it names`,
            );
        });
    }

    for (const editor of IN_PLACE_EDITORS) {
        test(`every IN_PLACE_EDITORS entry is exercised, not just tabled — ${editor}`, () => {
            const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
            assert.ok(
                matchesRule(rule, "Bash", { command: `${editor} -i s/a/b/ docs/vision.md` }),
                `${editor} under an in-place flag writes what it names`,
            );
            assert.ok(
                !matchesRule(rule, "Bash", { command: `${editor} -n 1,5p docs/vision.md` }),
                `${editor} without an in-place flag is a read`,
            );
        });
    }

    for (const [label, command] of [
        ["`&>`", "echo x &> docs/vision.md"],
        ["`2>`", "echo x 2> docs/vision.md"],
        ["`>|`", "echo x >| docs/vision.md"],
        ["`>>`", "echo x >> docs/vision.md"],
    ]) {
        test(`a write redirection reaches the constitution — ${label}`, () => {
            const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
            assert.ok(matchesRule(rule, "Bash", { command }), command);
        });
    }

    test("a `#` comment is read as code — a false RED, and the safe direction", () => {
        const rule = { tier: "gated", action: { shell: "git push --force" } };
        assert.ok(
            matchesRule(rule, "Bash", { command: "echo ok #; git push --force origin main" }),
            "a real shell ignores this; the matcher does not, and asks",
        );
    });

    test("a `#` inside quotes never hides the command after it", () => {
        const rule = { tier: "gated", action: { shell: "git push --force" } };
        assert.ok(matchesRule(rule, "Bash", { command: 'echo "a#b"; git push --force origin main' }));
    });

    test("the limit is asserted, not just documented: two wrappers still escape", () => {
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
        ["a wrapper after a `;`", 'git status; bash -c "echo x >> docs/vision.md"'],
        ['an escaped quote before the separator', 'echo "x\\""; cp /tmp/x docs/vision.md'],
        // Both pin a false red: no shell measured (bash 3.2.57, 5.2.15, 5.2.37, zsh 5.9) continues a line at `\` CRLF.
        ["a CRLF continuation before the path", "cp /tmp/x \\\r\ndocs/vision.md"],
        ["a CRLF continuation after `>`", "echo x > \\\r\ndocs/vision.md"],
        ["an LF continuation, the control", "cp /tmp/x \\\ndocs/vision.md"],
        ["a wrapper after `&&`", 'ls && bash -c "cp /tmp/x docs/vision.md"'],
        ["a `$'…'` wrapper, mid-line", "ls && bash -c $'echo x > docs/vision.md'"],
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
        ["reading it with cat", "cat docs/vision.md"],
        ["grepping it", "grep -n foo docs/vision.md"],
        ["diffing it", "git diff docs/vision.md"],
        ["sed WITHOUT an in-place flag", "sed -n '1,5p' docs/vision.md"],
        ["sed -E, which is not -i", "sed -E 's/a/b/' docs/vision.md"],
        ["it as a redirected INPUT", "patch /tmp/other.md < docs/vision.md"],
        ["the path named inside a quoted string", "echo 'x > docs/vision.md'"],
        ["a sentence mentioning it", 'echo "writing to docs/vision.md is prohibited"'],
        ["a sibling file", "echo x > docs/plan.md"],
        ["a lookalike suffix", "echo x > docs/not-vision.md"],
        ["an ordinary command", "node cli/compile.mjs --check"],
    ]) {
        test(`a write rule does NOT fire on: ${label}`, () => {
            const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
            assert.ok(!matchesRule(rule, "Bash", { command }), command);
        });
    }

    for (const [label, command] of [
        ["a writer on the second line", "git status\ncp /tmp/x docs/vision.md"],
        ["a remover on the second line", "git status\nrm -f docs/vision.md"],
        ["an in-place edit on the third line", "a\nb\nsed -i '' s/x/y/ docs/vision.md"],
        ["a backslash-newline continuation", "cp /tmp/x \\\ndocs/vision.md"],
        ["inside a brace group", "{ cp /tmp/x docs/vision.md; }"],
        ["inside if/then", "if true; then cp /tmp/x docs/vision.md; fi"],
        ["inside a for loop", "for f in a; do cp /tmp/x docs/vision.md; done"],
        ["inside a piped while loop", "echo a | while read f; do rm -f docs/vision.md; done"],
        ["a `/./` in the path", "echo x > docs/./vision.md"],
        ["a doubled slash", "echo x > docs//vision.md"],
        ["a `..` climbing back in", "echo x > foo/../docs/vision.md"],
        ["a `/./` in a writer's argument", "cp /tmp/x docs/./vision.md"],
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
        const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
        assert.ok(!matchesRule(rule, "Bash", { command: "cp foo docs/plan.md" }));
        assert.ok(!matchesRule(rule, "Bash", { command: "rm -f docs/plan.md" }));
        assert.ok(!matchesRule(rule, "Bash", { command: "echo x > docs/not-vision.md" }));
    });

    test("the shell half of a write gate is a table, and its limits are asserted rather than implied", () => {
        const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
        for (const [why, command] of [
            ["an interpolated path", "echo x > $VISION"],
            ["a heredoc whose target is interpolated", "cat > $TARGET <<'EOF'\nx\nEOF"],
            ["a runtime assembling the write itself", `python3 -c "open('docs/vision.md','w').write('x')"`],
            ["a writer outside the table", "ex -sc wq docs/vision.md"],
            ["two shell wrappers", `bash -c "bash -c 'echo x > docs/vision.md'"`],
            ["find -exec invoking a writer", "find . -name x -exec cp {} docs/vision.md ;"],
            ["xargs invoking a writer", "echo /tmp/x | xargs -I{} cp {} docs/vision.md"],
        ]) {
            assert.ok(!matchesRule(rule, "Bash", { command }), `${why} is a stated hole, not coverage`);
        }
    });

    test("a heredoc BODY is data, not commands — and this one was measured the hard way", () => {
        const write = { tier: "prohibited", action: { write: "docs/vision.md" } };
        const force = { tier: "gated", action: { shell: "git push --force" } };
        assert.ok(!matchesRule(write, "Bash", { command: "git commit -F - <<'MSG'\nfixed: cp /tmp/x docs/vision.md\nMSG" }));
        assert.ok(!matchesRule(write, "Bash", { command: "cat <<'EOF' > /tmp/notes\nrm -rf docs\nEOF" }));
        assert.ok(!matchesRule(force, "Bash", { command: "git commit -F - <<'MSG'\nls && git push --force escaped\nMSG" }));
        assert.ok(!matchesRule(write, "Bash", { command: "cat <<-EOF > /tmp/x\n  sed -i '' s/a/b/ docs/vision.md\n\tEOF" }), "<<- too");
    });

    test("dropping the body does not drop the line that opens it, nor what follows the terminator", () => {
        const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
        assert.ok(matchesRule(rule, "Bash", { command: "tee docs/vision.md <<'EOF'\nx\nEOF" }));
        assert.ok(matchesRule(rule, "Bash", { command: "cat <<'EOF' > /tmp/x\nharmless\nEOF\ncp /tmp/x docs/vision.md" }));
    });

    test("a heredoc naming the path literally IS covered — the coverage is not understated either", () => {
        const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
        assert.ok(matchesRule(rule, "Bash", { command: "cat > docs/vision.md <<'EOF'\nx\nEOF" }));
        assert.ok(matchesRule(rule, "Bash", { command: "cat <<'EOF' > docs/vision.md\nx\nEOF" }));
    });

    test("a redirected INPUT is skipped rather than ending the command it feeds", () => {
        const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
        assert.ok(matchesRule(rule, "Bash", { command: "tee < /tmp/in docs/vision.md" }));
        assert.ok(!matchesRule(rule, "Bash", { command: "patch /tmp/other.md < docs/vision.md" }), "and it is still an input");
    });

    test("a writer READING the protected path is refused too — the stated coarse direction", () => {
        const rule = { tier: "prohibited", action: { write: "docs/vision.md" } };
        assert.ok(matchesRule(rule, "Bash", { command: "cp docs/vision.md /tmp/backup" }));
    });

    test("a read rule is NOT given shell coverage — the scope is write, and it says so", () => {
        // Deliberate: a shell can read a path through any command or runtime, and that table has no bound.
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
        // The hook resolves this on every tool call: a bad manifest is `doctor`'s to judge, never a crash here.
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
        // `doctor` refuses such a manifest, but nothing makes it run before the hook reads this one.
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), JSON.stringify({ gates: "/etc/passwd" }));
        assert.equal(policyPath(dir), path.join(dir, ".portulan", "gates.json"));
    });

    test("a `../` escape is refused after resolution, not by pattern alone", () => {
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), JSON.stringify({ gates: "../../../etc/passwd" }));
        assert.equal(policyPath(dir), path.join(dir, ".portulan", "gates.json"));
    });

    test("customer zero's manifest and the default agree — so this repo exercises both paths identically", () => {
        assert.equal(policyPath(REPO), path.resolve(REPO, ".portulan", "gates.json"));
    });
});

describe("an undeclared gate policy is a state, not an unreadable file", () => {
    const bare = (extra = {}) => {
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
        fs.writeFileSync(
            path.join(dir, ".portulan", "workspace.json"),
            JSON.stringify({ portulan: { spec: "2.8" }, name: "w", kind: "repository", tree: "../", ...extra }),
        );
        return dir;
    };
    const stderrOf = (t, argv) => {
        const said = [];
        t.mock.method(process.stderr, "write", (chunk) => (said.push(String(chunk)), true));
        const code = run(argv);
        t.mock.restoreAll();
        return { code, said: said.join("") };
    };

    test("`policyDeclaration` reports which arm produced the path", () => {
        const named = bare({ gates: "policy/rules.json" });
        assert.deepEqual(policyDeclaration(named), {
            file: path.resolve(named, ".portulan", "policy", "rules.json"),
            declared: true,
            reason: "declared",
        });
        const none = bare();
        assert.deepEqual(policyDeclaration(none), {
            file: path.join(none, ".portulan", "gates.json"),
            declared: false,
            reason: "no-key",
        });
    });

    test("a directory named `..something` is inside the workspace, not an escape", () => {
        const dir = bare({ gates: "..policy/rules.json" });
        const got = policyDeclaration(dir);
        assert.equal(got.declared, true, "`..policy` is a directory name, not a traversal");
        assert.equal(got.file, path.resolve(dir, ".portulan", "..policy", "rules.json"));
    });

    test("`declared: false` carries WHY — the arm is four situations, not one", () => {
        assert.equal(policyDeclaration(bare()).reason, "no-key");
        assert.equal(policyDeclaration(bare({ gates: "/etc/passwd" })).reason, "refused");
        assert.equal(policyDeclaration(bare({ gates: 7 })).reason, "refused", "a wrong type named something");
        const empty = scratch();
        fs.mkdirSync(path.join(empty, ".portulan"), { recursive: true });
        assert.equal(policyDeclaration(empty).reason, "no-manifest");
    });

    test("a REFUSED value is not reported as a manifest with no `gates` key", (t) => {
        const { code, said } = stderrOf(t, ["--workspace", bare({ gates: "../../../etc/passwd" })]);
        assert.equal(code, 2);
        assert.match(said, /will not read/);
        assert.doesNotMatch(said, /has no top-level `gates` key/, "it has one; it is the value that was refused");
        assert.doesNotMatch(said, /leave it undeclared deliberately/, "wrong advice for a declared-but-bad value");
    });

    test("a REFUSED value stops the run even where a `gates.json` sits at the conventional path", (t) => {
        for (const gates of [42, "", "../outside.json"]) {
            const dir = bare({ gates });
            fs.writeFileSync(path.join(dir, ".portulan", "gates.json"), JSON.stringify(policy()));
            for (const argv of [["--workspace", dir], ["--workspace", dir, "--check"]]) {
                const { code, said } = stderrOf(t, argv);
                assert.equal(code, 2, `${JSON.stringify(gates)}, ${argv.join(" ")}: ${said}`);
                assert.match(said, /will not read.*is not the policy it names.*Nothing was compiled and nothing was written/s);
                assert.doesNotMatch(said, /there is no `gates.json`/, "there is one; it is not the one named");
            }
            assert.ok(!fs.existsSync(path.join(dir, ".claude")), `${JSON.stringify(gates)}: nothing written`);
        }
    });

    test("an unauthored workspace is not reported as a manifest with no `gates` key", (t) => {
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
        const { code, said } = stderrOf(t, ["--workspace", dir]);
        assert.equal(code, 2);
        assert.match(said, /no readable `workspace.json`/);
        assert.doesNotMatch(said, /has no top-level `gates` key/, "there is no manifest to have a key");
    });

    test("a REFUSED path is `declared: false` — it fell back, so the fallback owns the diagnostic", () => {
        assert.equal(policyDeclaration(bare({ gates: "/etc/passwd" })).declared, false);
        assert.equal(policyDeclaration(bare({ gates: "../../../etc/passwd" })).declared, false);
    });

    test("run() names the state instead of reporting ENOENT, and still writes nothing", (t) => {
        const dir = bare();
        const { code, said } = stderrOf(t, ["--workspace", dir]);
        assert.equal(code, 2, "nothing was compiled, so this stays a refusal rather than becoming a pass");
        assert.match(said, /declares no gate policy/);
        assert.doesNotMatch(said, /ENOENT/, "the old message sent readers hunting for a file never claimed");
        assert.ok(!fs.existsSync(path.join(dir, ".claude", "settings.json")), "and it emits no artifact");
    });

    test("a DECLARED policy that is missing still reports the read failure", (t) => {
        const { code, said } = stderrOf(t, ["--workspace", bare({ gates: "policy/rules.json" })]);
        assert.equal(code, 2);
        assert.match(said, /cannot read the gate policy/);
    });

    test("the message counts the pack rules the absence strands, and names the pack", (t) => {
        const dir = bare({ packs: ["rituals/checkpoints"] });
        const root = path.join(dir, "packs");
        packAt(root, "rituals", "checkpoints", [fragment("a", "prohibited"), fragment("b", "prohibited")]);
        const { code, said } = stderrOf(t, ["--workspace", dir, "--pack-root", root]);
        assert.equal(code, 2);
        assert.match(said, /2 pack-contributed gate rule\(s\)/);
        assert.match(said, /checkpoints/, "naming the dependency is what the merge step is for");
    });

    test("a pack refusal does not replace the answer with a different question", (t) => {
        const dir = bare({ packs: ["rituals/checkpoints"] });
        const root = path.join(dir, "packs");
        const packDir = path.join(root, "rituals", "checkpoints");
        fs.mkdirSync(packDir, { recursive: true });
        // Malformed, not unresolved: `packContributions` collects an unresolved pack rather than throwing.
        fs.writeFileSync(path.join(packDir, "pack.json"), "{ not json");
        const { code, said } = stderrOf(t, ["--workspace", dir, "--pack-root", root]);
        assert.equal(code, 2);
        assert.match(said, /declares no gate policy/, "the missing policy is still the answer");
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

describe("customer zero", () => {
    const real = JSON.parse(fs.readFileSync(path.join(REPO, ".portulan", "gates.json"), "utf8"));

    test("the real policy compiles without refusing", () => {
        const result = claudeCode(parse(real));
        assert.ok(result.compiled.length >= 6, "this repository has at least six enforceable gates");
    });

    test("this repository declares a floor, and the export reproduces the checks `main` really requires", () => {
        const contexts = parse(real).floor.checks.map((c) => c.context).sort();
        assert.deepEqual(contexts, ["pr-labeled", "workspace-verify"]);
        for (const check of parse(real).floor.checks) {
            assert.equal(check.integration_id, 15368, "an unpinned context is satisfiable by any app reporting that name");
        }
    });

    test("every context this repository's floor declares is reported by a job in this repository", () => {
        const workflows = fs
            .readdirSync(path.join(REPO, ".github", "workflows"))
            .map((f) => fs.readFileSync(path.join(REPO, ".github", "workflows", f), "utf8"))
            .join("\n");
        for (const check of parse(real).floor.checks) {
            assert.match(workflows, new RegExp(`^\\s{2}${check.context}:`, "m"), `no job reports \`${check.context}\``);
        }
    });

    const composedGates = (JSON.parse(fs.readFileSync(path.join(REPO, ".portulan", "workspace.json"), "utf8")).packs ?? [])
        .flatMap((ref) => JSON.parse(fs.readFileSync(path.join(REPO, "packs", ref, "pack.json"), "utf8")).contributes?.gates ?? []);

    test("every rule id in the policy — declared or composed — appears in the gate map's prose", () => {
        const prose = fs.readFileSync(path.join(REPO, ".portulan", "gate-map.md"), "utf8");
        for (const rule of [...real.rules, ...composedGates]) {
            assert.match(prose, new RegExp(`\`${rule.id}\``), `gate-map.md never mentions \`${rule.id}\``);
        }
    });

    // Citations are checked in every half; membership and tiers in the index alone, the half a boot reads.
    const gateMapProse = () => {
        const dir = path.join(REPO, ".portulan", "gate-map");
        const moved = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
        return [
            ["gate-map.md", fs.readFileSync(path.join(REPO, ".portulan", "gate-map.md"), "utf8")],
            ...moved.map((f) => [`gate-map/${f}`, fs.readFileSync(path.join(dir, f), "utf8")]),
        ];
    };

    const TIERED = [
        ["identity.md", "identity"],
        ["dod.md", "dod"],
        ["repos/portulan.md", "repos/portulan"],
    ];
    const tieredProse = ([boot, dir]) => {
        const abs = path.join(REPO, ".portulan", dir);
        const moved = fs.readdirSync(abs).filter((f) => f.endsWith(".md")).sort();
        return [
            [boot, fs.readFileSync(path.join(REPO, ".portulan", boot), "utf8")],
            ...moved.map((f) => [`${dir}/${f}`, fs.readFileSync(path.join(abs, f), "utf8")]),
        ];
    };

    test("every rule id the gate map cites exists in the policy — declared or composed", () => {
        const ids = new Set([...real.rules, ...composedGates].map((r) => r.id));
        for (const [file, prose] of gateMapProse()) {
            const cited = [...prose.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+){2,})`/g)].map((m) => m[1]);
            for (const id of cited) {
                if (/\.(md|json|sh|mjs)$/.test(id) || id.includes("/")) continue;
                assert.ok(ids.has(id), `${file} cites \`${id}\`, which no rule declares`);
            }
        }
    });

    test("every on-read file of the gate map is linked from its index", () => {
        const [[, index], ...moved] = gateMapProse();
        assert.ok(moved.length > 0, "gate-map/ holds no files, so this rail checks nothing");
        for (const [file] of moved) assert.ok(index.includes(`](${file}`), `${file} is linked from nowhere a boot reads`);
    });

    test("every on-read file of a tiered boot file is linked from it", () => {
        for (const pair of TIERED) {
            const [[boot, prose], ...moved] = tieredProse(pair);
            assert.ok(moved.length > 0, `${pair[1]}/ holds no files, so this rail checks nothing`);
            for (const [file] of moved) {
                const rel = path.posix.relative(path.posix.dirname(boot), file);
                assert.ok(prose.includes(`](${rel}`), `${file} is not linked from ${boot}, which a boot reads`);
            }
        }
    });

    test("every section link between a boot file and its on-read files lands on a heading", () => {
        // GitHub's slug: lower-cased, punctuation but `-` and `_` dropped, spaces to hyphens, repeats suffixed `-1`.
        const files = new Map([...gateMapProse(), ...TIERED.flatMap(tieredProse)]);
        const slug = (heading) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-");
        const anchors = new Map();
        for (const [file, prose] of files) {
            const seen = new Map();
            const headings = [...prose.replace(/^```[\s\S]*?^```/gm, "").matchAll(/^#{1,6} (.+)$/gm)];
            anchors.set(file, new Set(headings.map(([, heading]) => {
                const s = slug(heading);
                const n = seen.get(s) ?? 0;
                seen.set(s, n + 1);
                return n ? `${s}-${n}` : s;
            })));
        }
        let checked = 0;
        for (const [file, prose] of files) {
            for (const [, target, fragment] of prose.matchAll(/\]\(([^)\s#]*)#([^)\s]+)\)/g)) {
                const resolved = target === "" ? file : path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
                if (!anchors.has(resolved)) continue;
                checked++;
                assert.ok(anchors.get(resolved).has(fragment), `${file} links \`${target}#${fragment}\`, and ${resolved} has no such heading`);
            }
        }
        assert.ok(checked > 0, "no section link between a boot file and its on-read files was found, so this rail checks nothing");
    });

    test("the composed set is non-empty, so the two rails above are not widened to a no-op", () => {
        assert.ok(composedGates.length > 0, "the composed packs contribute no gates, so the rails above check nothing");
    });

    test("every rule is cited under the gate map section matching its TIER", () => {
        const prose = fs.readFileSync(path.join(REPO, ".portulan", "gate-map.md"), "utf8");
        const HEADING = /^#{2,3} (.+)$/gm;
        const sections = [];
        let m;
        while ((m = HEADING.exec(prose)) !== null) sections.push({ title: m[1], start: m.index });
        sections.forEach((s, i) => {
            s.body = prose.slice(s.start, sections[i + 1]?.start ?? prose.length);
        });

        const owner = {
            auto: sections.find((s) => /^Auto\b/.test(s.title)),
            propose: sections.find((s) => /^Propose\b/.test(s.title)),
            gated: sections.find((s) => /^Gated\b/.test(s.title)),
            prohibited: sections.find((s) => /^Prohibited\b/.test(s.title)),
        };
        for (const [tier, section] of Object.entries(owner)) {
            assert.ok(section, `gate-map.md has no section speaking for tier \`${tier}\``);
        }

        for (const rule of [...real.rules, ...composedGates]) {
            const section = owner[rule.tier];
            assert.match(
                section.body,
                new RegExp(`\`${rule.id}\``),
                `\`${rule.id}\` is tier \`${rule.tier}\` in the policy, but gate-map.md does not cite it under "${section.title}"`,
            );
        }
    });

    test("the constitution changes by pull request, and no gate refuses or prompts an edit to it", () => {
        const rule = real.rules.find((r) => r.action?.write === "docs/vision.md");
        assert.equal(rule.tier, "propose", "the constitution changes by pull request");
        const { contributions } = packContributions(REPO, ".portulan", { packRoots: [path.join(REPO, "packs")] });
        const refusing = composeFragments(real, contributions).policy.rules.filter(
            (r) => (r.tier === "gated" || r.tier === "prohibited") && matchesRule(r, "Edit", { file_path: path.join(REPO, "docs", "vision.md") }),
        );
        assert.deepEqual(refusing.map((r) => r.id), [], "a rule refuses or prompts an edit the maintainer allowed");
    });

    test("the two destructive push spellings are gated; the ordinary one is not", () => {
        const tierOf = (shell) => real.rules.find((r) => r.action?.shell === shell)?.tier;
        assert.equal(tierOf("git push"), "auto", "an ordinary working-branch push is unattended");
        assert.equal(tierOf("git push --force"), "gated", "bare --force is not recoverable");
        assert.equal(tierOf("git push --delete"), "gated", "deleting a remote ref is not adding one");
    });

    test("the gated push prefixes do not swallow the Auto spelling they sit beside", () => {
        const force = real.rules.find((r) => r.id === "force-push-without-a-lease");
        assert.ok(matchesRule(force, "Bash", { command: "git push --force origin x" }));
        assert.ok(!matchesRule(force, "Bash", { command: "git push --force-with-lease origin x" }));
        assert.ok(!matchesRule(force, "Bash", { command: "git push origin x" }));
    });
});

// ===========================================================================================
// Pack-contributed gate fragments — the cascade's middle layer, tighten-only
// ===========================================================================================

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

// A fragment tightening an existing id must carry that rule's action: changing what it matches is refused.
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
        assert.ok(!policy().rules.some((r) => r.id === "fresh"));
    });

    test("a fragment naming an existing id at a STRONGER tier tightens it", () => {
        const out = composeFragments(policy(), [
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

    test("a pack may not compose onto a rule whose own tier is not a tier", () => {
        const bad = {
            ...policy(),
            rules: [{ id: "r", tier: "bogus", action: { shell: "git push" }, reason: "malformed base" }],
        };
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
        // `doctor` bars it too, but nothing makes `doctor` run before `compile`.
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
        assert.throws(() => parse(out.policy), /carries no reason/);
    });

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
        // Built from `policy()`: `parse` refuses a bare `{ rules }` envelope before it reads any id.
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

    // `compile` does not validate workspace.json, so `packs` may hold anything.
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
    test("a pack present ONLY in the workspace's tree does not resolve when a root is named", () => {
        const dir = workspace();
        packAt(path.join(dir, "packs"), "rituals", "checkpoints", [fragment("commit-without-the-hooks", "gated")]);
        const w = path.join(dir, ".portulan", "workspace.json");
        const manifest = JSON.parse(fs.readFileSync(w, "utf8"));
        manifest.packs = ["rituals/checkpoints"];
        fs.writeFileSync(w, JSON.stringify(manifest, null, 2));

        assert.equal(run(["--workspace", dir], { quiet: true }), 0);
        const fromTree = JSON.parse(fs.readFileSync(path.join(dir, ".claude", "settings.json"), "utf8"));
        assert.match(JSON.stringify(fromTree), /commit-without-the-hooks/);

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
        const dir = workspace();
        assert.equal(run(["--workspace", dir, "--pack-root", path.join(dir, ".portulan", "gates.json")], { quiet: true }), 2);
    });

    test("a directory is still accepted", () => {
        const dir = workspace();
        const feed = scratch();
        assert.equal(run(["--workspace", dir, "--pack-root", feed], { quiet: true }), 0);
    });
});

// ---------------------------------------------------------------- where the emitted hook points

// Not `os.tmpdir()` itself, which a checkout can sit under, as a `git worktree` there does.
const OUTSIDE_ANY_PROJECT = path.join(os.tmpdir(), "portulan-no-project-lives-here");

describe("the emitted runner path — nothing asserted this until the checkpoint said so", () => {
    test("a runner under the project is spelled relative to CLAUDE_PROJECT_DIR", () => {
        const here = path.resolve(fileURLToPath(new URL(".", import.meta.url)));
        const out = claudeCode(parse(policy()), { root: path.resolve(here, "..") });
        const text = JSON.stringify(out.artifact.value);
        assert.match(text, /\$\{CLAUDE_PROJECT_DIR\}\/cli\/gate\.mjs/);
        assert.match(text, /\$\{CLAUDE_PROJECT_DIR\}\/cli\/stop-gate\.mjs/);
    });

    test("a runner OUTSIDE the project falls back to absolute AND says so", () => {
        const out = claudeCode(parse(policy()), { root: OUTSIDE_ANY_PROJECT });
        const emitted = JSON.stringify(out.artifact.value);
        assert.doesNotMatch(emitted, /CLAUDE_PROJECT_DIR/, "a runner outside the project cannot have a project-relative spelling");
        assert.match(emitted, /cli\/gate\.mjs/);
        assert.ok(
            (out.notes ?? []).some((n) => /pinned to an ABSOLUTE path/i.test(n)),
            `the absolute fallback was silent — notes were: ${JSON.stringify(out.notes)}`,
        );
    });

    test("`root` is honoured, so cross-compiling cannot name a file the target lacks", () => {
        const a = JSON.stringify(claudeCode(parse(policy()), { root: OUTSIDE_ANY_PROJECT }));
        const b = JSON.stringify(claudeCode(parse(policy()), { root: path.resolve(fileURLToPath(new URL("..", import.meta.url))) }));
        assert.notEqual(a, b, "the emitted path did not change with `root`, so `root` is being ignored");
    });
});

// ---------------------------------------------------------------- parity: a workspace is not a place
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
        const dir = scratch();
        const ws = path.join(dir, "workspaces", "acme");
        fs.mkdirSync(ws, { recursive: true });
        fs.writeFileSync(path.join(ws, "workspace.json"), JSON.stringify({ name: "acme", kind: "portfolio" }));
        assert.deepEqual(resolveWorkspace(ws), { workspaceRoot: path.resolve(ws), workspaceDir: "." });
    });

    test("a `tree` that does not contain its own workspace changes nothing", () => {
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

        assert.equal(run(["--workspace", ws, "--check"], { quiet: true }), 0);
        fs.rmSync(path.join(ws, "compile", "github-ruleset.json"));
        assert.equal(run(["--workspace", ws, "--check"], { quiet: true }), 1, "a missing artifact is drift in either residence");
    });

    test("the same policy compiles to the same rules in both residences", () => {
        // The artifact paths differ by residence, as they should, so only the gate and refusal lines are compared.
        const shared = withFloor(policy());

        const repo = scratch();
        fs.mkdirSync(path.join(repo, ".portulan"), { recursive: true });
        fs.writeFileSync(path.join(repo, ".portulan", "workspace.json"), JSON.stringify({ name: "acme", kind: "repository", tree: "../" }));
        fs.writeFileSync(path.join(repo, ".portulan", "gates.json"), JSON.stringify(shared));

        const feed = scratch();
        fs.writeFileSync(path.join(feed, "workspace.json"), JSON.stringify({ name: "acme", kind: "portfolio" }));
        fs.writeFileSync(path.join(feed, "gates.json"), JSON.stringify(shared));

        // Hand-restored: this mock lives for one call of `said`, which runs twice, and `t.mock.method` lasts the test.
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
        const dir = scratch();
        fs.writeFileSync(path.join(dir, "workspace.json"), "{ not json");
        assert.throws(() => resolveWorkspace(dir), (e) => e instanceof CompileError && /not valid JSON/.test(e.message));

        // A stub, not chmod: root ignores modes, and CI often runs as root.
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

        assert.deepEqual(resolveWorkspace(scratch()).workspaceDir, ".portulan");
    });
});

// -------------------------------------- `auto` beside a named root: refused, not half-honoured

test("compile refuses a named root combined with `--pack-root auto`", () => {
    const dir = workspace();
    assert.equal(run(["--workspace", path.join(dir, ".portulan")], { quiet: true }), 0, "the control: this workspace compiles");
    assert.equal(run(["--workspace", path.join(dir, ".portulan"), "--pack-root", "auto", "--pack-root", dir], { quiet: true }), 2);
});

test("compile refuses the pair BEFORE it resolves a workspace or reads a policy", (t) => {
    // An absent workspace: a parse-time refusal never looks at it, and any later refusal says something else.
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
    // Called directly: `run` refuses the pair at parse time, before it reaches this function.
    const dir = scratch();
    fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
    const manifest = { portulan: { spec: "2.8" }, name: "w", kind: "repository", tree: "../", packs: ["tools/thing"] };
    fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), JSON.stringify(manifest));

    assert.throws(
        () => packContributions(dir, ".portulan", { packRoots: [dir], forced: true, discovery: { ok: true, roots: [dir] } }),
        /never both/,
    );

    const { plan } = packContributions(dir, ".portulan", { packRoots: [dir] });
    assert.equal(plan.source, "named");
    assert.deepEqual(plan.origins, [{ root: dir, origin: "named" }]);
    assert.equal(plan.refusal, null);
});

test("compile prints the union plan line even without `--matrix`", () => {
    const home = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "compile-union-host-"));
    SCRATCH.push(home);
    const installPath = path.join(home, "plugins", "cache", "feed", "carrier", "0.1.0");
    fs.mkdirSync(path.join(installPath, "packs"), { recursive: true });
    // A real pack: `isPackRoot` takes an empty `packs/` for no root, and unasked discovery would find nothing.
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

    // Hand-restored: `t.mock.property` throws on `process.env` in Node 26.7.0, so one `finally` restores both.
    const said = [];
    const write = process.stdout.write.bind(process.stdout);
    const before = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = home;
    process.stdout.write = (chunk) => (said.push(String(chunk)), true);
    const unasked = [];
    try {
        run(["--workspace", path.join(dir, ".portulan"), "--pack-root", "auto"]);
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
    // It must compose a pack: with none, `packContributions` returns before it builds a plan.
    const dir = workspace();
    const manifestPath = path.join(dir, ".portulan", "workspace.json");
    const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    m.packs = ["rituals/checkpoints"];
    fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));

    const config = unreadableHost(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "compile-unreadable-")));
    SCRATCH.push(config);
    assert.equal(withEnv(config, () => run(["--workspace", path.join(dir, ".portulan"), "--pack-root", "auto"], { quiet: true })), 2);
    const empty = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "compile-absent-"));
    SCRATCH.push(empty);
    assert.notEqual(withEnv(empty, () => run(["--workspace", path.join(dir, ".portulan"), "--pack-root", "auto"], { quiet: true })), 2);
});

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
// What compiled this — the artifact records the world it was compiled from
// ===========================================================================================

describe("the artifact records what compiled it (#264)", () => {
    const PLAN = (origins) => ({ origins });

    test("the resolver's THREE tags collapse to two, or two correct spellings disagree", () => {
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
        const plan = PLAN([{ root: "/elsewhere/x", origin: "named" }]);
        assert.equal(recordedOrigin("/elsewhere/x", plan, "/repo"), "outside-tree");
    });

    test("the artifact carries origin and version, and NEVER a root path", () => {
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
        const [withNone] = backends(parse(policy()), { source: ".portulan/gates.json" });
        assert.equal("packs" in JSON.parse(withNone.artifact.text).$portulan, false);
    });
});


describe("the drift RED names the origin difference (#264)", () => {
    const artifactWith = (packs) => JSON.stringify({
        $portulan: { generated: "cli/compile.mjs", source: ".portulan/gates.json", packs, warning: "w" },
        permissions: { deny: [], ask: [], allow: [] },
    }, null, 2);

    const withAPack = () => {
        const dir = workspace();
        const manifestPath = path.join(dir, ".portulan", "workspace.json");
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        manifest.packs = ["rituals/checkpoints"];
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        packAt(path.join(dir, "packs"), "rituals", "checkpoints", null);
        return dir;
    };

    const checkAgainst = (onDisk, dir = workspace()) => {
        fs.mkdirSync(path.join(dir, ".claude"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".claude", "settings.json"), onDisk);
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
        // It must declare a pack: one present in only one of the two worlds falls back to the plain RED.
        const { code, out } = checkAgainst(
            artifactWith([{ pack: "rituals/checkpoints", origin: "discovered", version: "0.2.0" }]),
            withAPack(),
        );
        assert.equal(code, 1, "it is still a drift");
        assert.match(out, /compiled from the discovered 0\.2\.0 copy/, "the world it was compiled from");
        assert.match(out, /--pack-root packs/, "and the spelling that does not reproduce the drift");
    });

    test("an artifact this compiler cannot parse leaves the plain RED standing", () => {
        for (const hostile of ["{ not json", JSON.stringify({ no: "header" }), JSON.stringify({ $portulan: "a string" }), JSON.stringify({ $portulan: { packs: "not an array" } })]) {
            const { code, out } = checkAgainst(hostile);
            assert.equal(code, 1, `still a drift: ${hostile.slice(0, 24)}`);
            assert.match(out, /has drifted from/, "and still says so");
        }
    });
});


// ===========================================================================================
// Guidance — `slots.context`, compiled to each host's load tiers
// ===========================================================================================

const GUIDANCE_FIXTURE = path.join(HERE, "fixtures", "guidance");

function guidanceCopy() {
    const dir = scratch();
    fs.cpSync(GUIDANCE_FIXTURE, dir, { recursive: true });
    return dir;
}

function said(t, argv) {
    const out = [];
    t.mock.method(process.stdout, "write", (chunk) => (out.push(String(chunk)), true));
    t.mock.method(process.stderr, "write", (chunk) => (out.push(String(chunk)), true));
    let code;
    try {
        code = run(argv);
    } finally {
        t.mock.restoreAll();
    }
    return { code, out: out.join("") };
}

const unitText = (lines, body = "Guidance.") => `---\n${lines.join("\n")}\n---\n\n${body}\n`;

describe("guidance: a unit declares its tier, and what cannot be read is refused", () => {
    test("the tier vocabulary is 0036's four words, and every host says what it does with each", () => {
        assert.deepEqual(LOAD_TIERS, ["always", "on-path", "on-invoke", "on-read"]);
        for (const [id, host] of Object.entries(GUIDANCE_HOSTS)) {
            for (const tier of LOAD_TIERS) assert.ok(Object.hasOwn(host, tier), `${id} says nothing about ${tier}`);
        }
        assert.ok(LOAD_TIERS.every((tier) => GUIDANCE_HOSTS["claude-code"][tier] !== null), "Claude Code expresses every tier");
        assert.deepEqual(LOAD_TIERS.filter((tier) => GUIDANCE_HOSTS["agents-md"][tier] === null), ["on-path", "on-invoke"]);
    });

    test("each tier reads, with `paths` as a flow list or a block list", () => {
        assert.deepEqual(parseUnit("a", unitText(["tier: always"], "# A\n\nText.")), { name: "a", tier: "always", paths: null, description: null, body: "# A\n\nText.\n", source: "a.md", bytes: 33 });
        assert.deepEqual(parseUnit("b", unitText(["tier: on-path", 'paths: ["api/**", "db/*.sql"]', "description: Handlers."])).paths, ["api/**", "db/*.sql"]);
        assert.deepEqual(parseUnit("b", unitText(["tier: on-path", "paths:", '  - "api/**"', "  - db/*.sql", "description: Handlers."])).paths, ["api/**", "db/*.sql"]);
        assert.equal(parseUnit("c", unitText(["tier: on-invoke", 'description: "Release: the checklist."'])).description, "Release: the checklist.");
        assert.equal(parseUnit("d", unitText(["tier: on-read", "description: 'Why it''s split.'"])).description, "Why it's split.");
    });

    const refused = [
        ["no frontmatter", "a", "# A\n", /first line must be `---`/],
        ["frontmatter never closed", "a", "---\ntier: always\n\nA.\n", /never closed/],
        ["a key no unit takes", "a", unitText(["tier: always", "model: fast"]), /`model` is not a key a unit takes/],
        ["a key declared twice", "a", unitText(["tier: always", "tier: always"]), /declared twice/],
        ["no tier", "a", unitText(["description: A."]), /`tier` is missing/],
        ["a tier outside the four", "a", unitText(["tier: sometimes"]), /must be one of/],
        ["an on-path unit with no paths", "a", unitText(["tier: on-path", "description: A."]), /names none/],
        ["paths on a unit that is not on-path", "a", unitText(["tier: on-read", 'paths: ["a/**"]', "description: A."]), /scopes an on-path unit/],
        ["a description on an always unit", "a", unitText(["tier: always", "description: A."]), /loaded whole/],
        ["an on-read unit with no description", "a", unitText(["tier: on-read"]), /an on-read unit needs a one-line `description`/],
        ["paths that are not a list", "a", unitText(["tier: on-path", "paths: api/**", "description: A."]), /is not a list/],
        ["an absolute glob", "a", unitText(["tier: on-path", 'paths: ["/etc/**"]', "description: A."]), /relative to the repository/],
        ["a glob that climbs out", "a", unitText(["tier: on-path", 'paths: ["../x/**"]', "description: A."]), /relative to the repository/],
        ["no guidance under the frontmatter", "a", "---\ntier: always\n---\n\n", /carries no guidance/],
        ["a name that is not a slug", "API", unitText(["tier: always"]), /must be a slug/],
        ["the index's own name", "on-read", unitText(["tier: always"]), /no unit may take it/],
        ["an unclosed single quote", "a", unitText(["tier: on-read", "description: 'A."]), /single-quoted and either not closed/],
        ["a lone quote inside single quotes", "a", unitText(["tier: on-read", "description: 'a'''b'"]), /not written `''`/],
        ["a line break spelled inside a quoted description", "a", unitText(["tier: on-read", 'description: "One.\\n- `x.md`: two."']), /holds a line break or another control character/],
        ["a line break spelled inside a quoted glob", "a", unitText(["tier: on-path", 'paths: ["api/**\\nb"]', "description: A."]), /a glob on one line/],
    ];
    for (const [why, name, text, pattern] of refused) {
        test(`refused, as could-not-compile: ${why}`, () => {
            assert.throws(() => parseUnit(name, text), (error) => {
                assert.ok(error instanceof CompileError, `a ${error.constructor.name}, not a CompileError`);
                assert.match(error.message, pattern);
                return true;
            });
        });
    }

    test("a byte-order mark is dropped, and a doubled quote inside single quotes is one quote", () => {
        const unit = parseUnit("a", `\uFEFF${unitText(["tier: on-read", "description: 'The team''s history.'"])}`);
        assert.equal(unit.description, "The team's history.");
    });
});

describe("guidance: Claude Code gets one file per unit, in its tier's own form", () => {
    const guidance = guidanceUnits(GUIDANCE_FIXTURE, ".");
    const files = new Map(claudeCodeGuidance(guidance).files.map((f) => [f.path, f.text]));

    test("the fixture holds one unit in each tier, read in name order", () => {
        assert.equal(guidance.source, "context/");
        assert.deepEqual(guidance.units.map((u) => [u.name, u.tier]), [["api", "on-path"], ["conventions", "always"], ["history", "on-read"], ["release", "on-invoke"]]);
    });

    test("always is an unscoped rule carrying the unit's guidance and nothing else", () => {
        assert.equal(files.get(`${GUIDANCE_RULES_DIR}/conventions.md`), guidance.units.find((u) => u.name === "conventions").body);
    });

    test("on-path is a rule scoped by `paths:`, each glob quoted", () => {
        assert.match(files.get(`${GUIDANCE_RULES_DIR}/api.md`), /^---\npaths:\n {2}- "api\/\*\*"\n---\n\n# Handlers\n/);
    });

    test("on-invoke is a project skill, named for the unit and marked as compiled", () => {
        const skill = files.get(`${SKILLS_DIR}/release/SKILL.md`);
        assert.match(skill, /^---\nname: release\ndescription: "Cut a release\. The checklist, for when a release is what the task is\."\n---\n\n<!-- compiled by `portulan compile` from context\/release\.md;/);
    });

    test("on-read is one pointer line per unit in the index, naming its file's size, and nothing else", () => {
        const index = files.get(`${GUIDANCE_RULES_DIR}/${ON_READ_INDEX}`);
        assert.equal(index, "- `context/history.md` (<1 KB): Why the service is split the way it is. Read it before restructuring it.\n");
        assert.ok(!files.has(`${GUIDANCE_RULES_DIR}/history.md`), "the on-read unit itself is never copied into a rule");
    });

    test("an index line's size is the unit file's bytes in whole KB, and one under a KB is `<1 KB`", () => {
        // 42 bytes of frontmatter and blank line around the guidance, so `n` of it makes a file of n + 42.
        const line = (n) => claudeCodeGuidance({ units: [parseUnit("big", unitText(["tier: on-read", "description: Big."], "x".repeat(n)))] }).files[0].text;
        assert.equal(line(981), "- `big.md` (<1 KB): Big.\n", "1,023 B");
        assert.equal(line(982), "- `big.md` (~1 KB): Big.\n", "1,024 B");
        assert.equal(line(1493), "- `big.md` (~1 KB): Big.\n", "1,535 B");
        assert.equal(line(1494), "- `big.md` (~2 KB): Big.\n", "1,536 B, rounded half up");
        assert.equal(line(1_536_000 - 42), "- `big.md` (~1,500 KB): Big.\n", "thousands grouped, as the context line groups them");
        const marked = parseUnit("marked", `\uFEFF${unitText(["tier: on-read", "description: Marked."], "é")}`);
        assert.equal(marked.bytes, 3 + Buffer.byteLength(unitText(["tier: on-read", "description: Marked."], "é")), "a byte-order mark and a two-byte letter are bytes the file holds");
    });

    test("the vendored AGENTS.md carries always inline and every other tier as a pointer", () => {
        const { inline, pointers } = agentsMdGuidance(guidance, ".portulan/context/");
        assert.deepEqual(inline, [guidance.units.find((u) => u.name === "conventions").body]);
        assert.deepEqual(pointers.map((p) => p.slice(0, p.indexOf(":"))), ["- `.portulan/context/api.md`", "- `.portulan/context/history.md`", "- `.portulan/context/release.md`"]);
        assert.match(pointers[0], /when you work on `api\/\*\*`/);
    });

    test("the measurement counts each emitted file in the tier the unit declared", (t) => {
        const dir = guidanceCopy();
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        const measured = alwaysTier(dir);
        const always = measured.entries.map((e) => path.relative(dir, e.file).split(path.sep).join("/")).sort();
        assert.deepEqual(always, [`${GUIDANCE_RULES_DIR}/conventions.md`, `${GUIDANCE_RULES_DIR}/${ON_READ_INDEX}`, `${SKILLS_DIR}/release/SKILL.md`]);
        assert.equal(measured.scoped, 1, "the on-path rule is scoped, so it is not in the always tier");
    });
});

describe("guidance: written, then byte-compared", () => {
    test("a workspace with guidance and no gate policy compiles it, and says the policy is absent", (t) => {
        const dir = guidanceCopy();
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 0);
        assert.match(out, /declares no gate policy.*No enforcement is compiled; the workspace's guidance still is/);
        assert.match(out, /AGENTS\.md, vendored: expresses always and on-read; on-path and on-invoke degrade to an on-read pointer/);
        for (const rel of ["conventions.md", "api.md", ON_READ_INDEX]) assert.ok(fs.existsSync(path.join(dir, GUIDANCE_RULES_DIR, rel)), rel);
        assert.ok(fs.existsSync(path.join(dir, SKILLS_DIR, "release", "SKILL.md")));
        assert.ok(!fs.existsSync(path.join(dir, ".claude", "settings.json")), "no policy, so no enforcement artifact");
        const check = said(t, ["--workspace", dir, "--check"]);
        assert.equal(check.code, 0, check.out);
        assert.match(check.out, /GREEN — every compiled guidance file matches its unit/);
    });

    test("a declared `spend` beside guidance and no gate policy compiles nothing, and says so", (t) => {
        const dir = guidanceCopy();
        const file = path.join(dir, "workspace.json");
        const m = JSON.parse(fs.readFileSync(file, "utf8"));
        m.portulan.spec = "2.12";
        m.spend = { horizon: { requests: 30 } };
        fs.writeFileSync(file, JSON.stringify(m, null, 2));
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 0, out);
        assert.match(out, /note {4}`spend` in workspace\.json compiled nothing: what it declares rides the restart advisory's commands in the settings a gate policy compiles to, and this workspace has none/);
        assert.ok(!fs.existsSync(path.join(dir, ".claude", "settings.json")), "no policy, so no settings");
        m.spend = { horizon: { requests: -1 } };
        fs.writeFileSync(file, JSON.stringify(m, null, 2));
        assert.equal(said(t, ["--workspace", dir, "--check"]).code, 2);
    });

    test("a `gates` key the compiler refuses stops the run beside guidance too: exit 2, nothing written", (t) => {
        for (const gates of [42, "", "../outside.json"]) {
            for (const conventional of [false, true]) {
                const dir = guidanceCopy();
                const manifestPath = path.join(dir, "workspace.json");
                const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
                m.gates = gates;
                fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
                if (conventional) fs.writeFileSync(path.join(dir, "gates.json"), JSON.stringify(policy()));
                const label = `${JSON.stringify(gates)}${conventional ? " beside gates.json" : ""}`;
                for (const args of [["--workspace", dir], ["--workspace", dir, "--check"]]) {
                    const { code, out } = said(t, args);
                    assert.equal(code, 2, `${label}, ${args.join(" ")}: ${out}`);
                    assert.match(out, /names a gate policy this compiler will not read.*Nothing was compiled and nothing was written/s);
                }
                assert.ok(!fs.existsSync(path.join(dir, ".claude")), `${label}: nothing written`);
            }
        }
    });

    test("a compiled file edited by hand is red, and names the unit to edit instead", (t) => {
        const dir = guidanceCopy();
        said(t, ["--workspace", dir]);
        fs.appendFileSync(path.join(dir, GUIDANCE_RULES_DIR, "api.md"), "A hand-fix.\n");
        const { code, out } = said(t, ["--workspace", dir, "--check"]);
        assert.equal(code, 1);
        assert.match(out, /api\.md has drifted from context\/api\.md\. Edit the unit, then recompile\./);
    });

    test("a unit that is removed leaves nothing behind: red until recompiled, and the recompile removes it", (t) => {
        const dir = guidanceCopy();
        said(t, ["--workspace", dir]);
        fs.rmSync(path.join(dir, "context", "api.md"));
        fs.rmSync(path.join(dir, "context", "release.md"));
        const check = said(t, ["--workspace", dir, "--check"]);
        assert.equal(check.code, 1);
        assert.match(check.out, /api\.md is where this compiler writes guidance, and no unit compiles to it/);
        assert.match(check.out, /release[\\/]SKILL\.md is where this compiler writes guidance/);
        const rewrite = said(t, ["--workspace", dir]);
        assert.equal(rewrite.code, 0);
        assert.match(rewrite.out, /removed .*api\.md — no unit compiles to it/);
        assert.ok(!fs.existsSync(path.join(dir, GUIDANCE_RULES_DIR, "api.md")));
        assert.ok(!fs.existsSync(path.join(dir, SKILLS_DIR, "release")), "the emptied skill directory goes with it");
        assert.equal(said(t, ["--workspace", dir, "--check"]).code, 0);
    });

    test("a file in the rules directory that this compiler never writes is red, and left for a human", (t) => {
        const dir = guidanceCopy();
        said(t, ["--workspace", dir]);
        fs.writeFileSync(path.join(dir, GUIDANCE_RULES_DIR, "notes.txt"), "mine\n");
        const checked = said(t, ["--workspace", dir, "--check"]);
        assert.equal(checked.code, 1);
        assert.match(checked.out, /notes\.txt is in the directory this compiler writes its rules to, and is not a file it wrote, so a recompile leaves it\. Move it out by hand\./);
        const { out } = said(t, ["--workspace", dir]);
        assert.match(out, /left .*notes\.txt — it is not a file this compiler wrote/);
        assert.ok(fs.existsSync(path.join(dir, GUIDANCE_RULES_DIR, "notes.txt")));
        assert.equal(said(t, ["--workspace", dir, "--check"]).code, 1);
    });

    test("the marker is written after the rules it lists, and lists each of them", (t) => {
        assert.ok(!RULES_MARKER.endsWith(".md"), "Claude Code loads only .md files as rules, so the marker costs no context");
        const dir = guidanceCopy();
        const marker = path.join(dir, GUIDANCE_RULES_DIR, RULES_MARKER);
        const { out } = said(t, ["--workspace", dir]);
        assert.equal(out.lastIndexOf("wrote "), out.lastIndexOf(`wrote ${marker}`), "the marker is the last file written");
        const lines = fs.readFileSync(marker, "utf8").split("\n");
        assert.match(lines[0], /^`portulan compile` wrote the rules listed below/);
        assert.deepEqual(lines.slice(1), ["api.md", "conventions.md", "on-read.md", ""], "one rule a line, and no skill: a skill carries its own mark");
    });

    test("a run stopped before a rule is written leaves no marker listing it, so a file put there later is never taken", (t) => {
        const dir = guidanceCopy();
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        fs.writeFileSync(path.join(dir, "context", "extra.md"), unitText(["tier: always"]));
        const extra = path.join(dir, GUIDANCE_RULES_DIR, "extra.md");
        const marker = path.join(dir, GUIDANCE_RULES_DIR, RULES_MARKER);
        const write = fs.writeFileSync;
        t.mock.method(fs, "writeFileSync", (target, ...rest) => {
            if (target === extra) throw new Error("stopped");
            return write(target, ...rest);
        });
        assert.equal(said(t, ["--workspace", dir]).code, 2);
        assert.doesNotMatch(fs.readFileSync(marker, "utf8"), /^extra\.md$/m, "no name is listed before its rule is written");
        fs.writeFileSync(extra, "Ours.\n");
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 2);
        assert.match(out, /extra\.md exists and was not compiled here/);
        assert.equal(fs.readFileSync(extra, "utf8"), "Ours.\n");
    });

    test("a rule a stopped run wrote before its marker is taken back when it is byte for byte what its unit compiles to", (t) => {
        const dir = guidanceCopy();
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        fs.writeFileSync(path.join(dir, "context", "extra.md"), unitText(["tier: always"]));
        const extra = path.join(dir, GUIDANCE_RULES_DIR, "extra.md");
        const marker = path.join(dir, GUIDANCE_RULES_DIR, RULES_MARKER);
        const write = fs.writeFileSync;
        t.mock.method(fs, "writeFileSync", (target, ...rest) => {
            if (target === marker && String(rest[0]).includes("extra.md")) throw new Error("stopped");
            return write(target, ...rest);
        });
        assert.equal(said(t, ["--workspace", dir]).code, 2);
        assert.ok(fs.existsSync(extra), "the rule was written");
        assert.doesNotMatch(fs.readFileSync(marker, "utf8"), /^extra\.md$/m, "and the marker that lists it was not");
        assert.equal(said(t, ["--workspace", dir, "--check"]).code, 1, "red, because the marker does not list it; not refused");
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        assert.match(fs.readFileSync(marker, "utf8"), /^extra\.md$/m);
        assert.equal(said(t, ["--workspace", dir, "--check"]).code, 0);
    });

    test("a rule no unit compiles to is unlisted before it is removed, so a run stopped between leaves it to a human", (t) => {
        const dir = guidanceCopy();
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        fs.rmSync(path.join(dir, "context", "conventions.md"));
        const conventions = path.join(dir, GUIDANCE_RULES_DIR, "conventions.md");
        const marker = path.join(dir, GUIDANCE_RULES_DIR, RULES_MARKER);
        const rm = fs.rmSync;
        t.mock.method(fs, "rmSync", (target, ...rest) => {
            if (target === conventions) throw new Error("stopped");
            return rm(target, ...rest);
        });
        assert.equal(said(t, ["--workspace", dir]).code, 2);
        assert.doesNotMatch(fs.readFileSync(marker, "utf8"), /^conventions\.md$/m, "no name stays listed once its removal begins");
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 0);
        assert.match(out, /left .*conventions\.md — it is not a file this compiler wrote/);
        assert.ok(fs.existsSync(conventions));
    });

    test("a marker not in this compiler's form grants nothing: exit 2, and nothing is written or removed", (t) => {
        const dir = guidanceCopy();
        said(t, ["--workspace", dir]);
        const rules = path.join(dir, GUIDANCE_RULES_DIR);
        fs.writeFileSync(path.join(rules, RULES_MARKER), "mine\n");
        fs.writeFileSync(path.join(dir, "context", "extra.md"), unitText(["tier: always"]));
        const before = fs.readdirSync(rules).sort();
        for (const argv of [["--workspace", dir], ["--workspace", dir, "--check"]]) {
            const { code, out } = said(t, argv);
            assert.equal(code, 2);
            assert.match(out, /\.compiled is not a marker this compiler wrote, so nothing shows which rules beside it are its own/);
        }
        assert.deepEqual(fs.readdirSync(rules).sort(), before);
        assert.equal(fs.readFileSync(path.join(rules, RULES_MARKER), "utf8"), "mine\n");
    });

    test("a rule added by hand beside compiled ones is the team's: red under --check, left by a write, never replaced", (t) => {
        const dir = guidanceCopy();
        said(t, ["--workspace", dir]);
        const mine = path.join(dir, GUIDANCE_RULES_DIR, "mine.md");
        fs.writeFileSync(mine, "Ours.\n");
        const checked = said(t, ["--workspace", dir, "--check"]);
        assert.equal(checked.code, 1);
        assert.match(checked.out, /mine\.md is in the directory this compiler writes its rules to, and is not a file it wrote/);
        assert.match(said(t, ["--workspace", dir]).out, /left .*mine\.md — it is not a file this compiler wrote/);
        assert.equal(fs.readFileSync(mine, "utf8"), "Ours.\n");
        fs.writeFileSync(path.join(dir, "context", "mine.md"), unitText(["tier: always"]));
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 2);
        assert.match(out, /mine\.md exists and was not compiled here — context\/mine\.md would replace a rule written by hand/);
        assert.equal(fs.readFileSync(mine, "utf8"), "Ours.\n");
    });

    test("nothing is written through a link, even one that stays inside the repository: a linked rule, rules directory or skill directory is exit 2, and what it points at is untouched", (t) => {
        const cases = [
            ["a compiled rule", (dir, target) => {
                said(t, ["--workspace", dir]);
                const rule = path.join(dir, GUIDANCE_RULES_DIR, "conventions.md");
                fs.rmSync(rule);
                fs.symlinkSync(path.join(target, "keep.md"), rule);
            }, /conventions\.md is a link, and writing it would change whatever the link points at/],
            ["the rules directory", (dir, target) => {
                fs.mkdirSync(path.join(dir, ".claude", "rules"), { recursive: true });
                fs.symlinkSync(target, path.join(dir, GUIDANCE_RULES_DIR));
            }, /lies through a link, \.claude\/rules\/portulan, and writing through it would change whatever the link points at/],
            ["a skill's directory", (dir, target) => {
                fs.mkdirSync(path.join(dir, SKILLS_DIR), { recursive: true });
                fs.symlinkSync(target, path.join(dir, SKILLS_DIR, "release"));
            }, /release\/SKILL\.md lies through a link, \.claude\/skills\/release, and writing through it/],
        ];
        for (const inside of [false, true]) {
            for (const [what, arrange, pattern] of cases) {
                const dir = guidanceCopy();
                const target = inside ? path.join(dir, "kept") : scratch();
                const where = `${what}, linked ${inside ? "inside" : "out of"} the repository`;
                fs.mkdirSync(target, { recursive: true });
                fs.writeFileSync(path.join(target, "keep.md"), "Keep.\n");
                arrange(dir, target);
                for (const argv of [["--workspace", dir], ["--workspace", dir, "--check"]]) {
                    const { code, out } = said(t, argv);
                    assert.equal(code, 2, where);
                    assert.match(out, pattern, where);
                }
                assert.deepEqual(fs.readdirSync(target), ["keep.md"], where);
                assert.equal(fs.readFileSync(path.join(target, "keep.md"), "utf8"), "Keep.\n", where);
            }
        }
    });

    test("nothing is removed through a link, even one that stays inside the repository: a linked rules or skills directory is left as it is, and green", (t) => {
        const dir = workspace();
        const manifestPath = path.join(dir, ".portulan", "workspace.json");
        const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        m.portulan.spec = "2.10";
        m.slots.context = "context/";
        fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
        fs.mkdirSync(path.join(dir, ".portulan", "context"));
        fs.writeFileSync(path.join(dir, ".portulan", "context", "history.md"), unitText(["tier: on-read", "description: Why."]));
        fs.writeFileSync(path.join(dir, ".portulan", "context", "release.md"), unitText(["tier: on-invoke", "description: Cut a release."]));
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        for (const [from, to] of [[GUIDANCE_RULES_DIR, "kept-rules"], [SKILLS_DIR, "kept-skills"]]) {
            fs.renameSync(path.join(dir, from), path.join(dir, to));
            fs.symlinkSync(path.join(dir, to), path.join(dir, from));
        }
        const before = [["kept-rules", RULES_MARKER], ["kept-rules", "on-read.md"], ["kept-skills", "release", "SKILL.md"]].map((p) => [p, fs.readFileSync(path.join(dir, ...p), "utf8")]);
        delete m.slots.context;
        fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
        assert.equal(said(t, ["--workspace", dir, "--check"]).code, 0);
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        for (const [p, text] of before) assert.equal(fs.readFileSync(path.join(dir, ...p), "utf8"), text, p.join("/"));
    });

    test("without the marker, Markdown in the rules directory is not this compiler's: exit 2, and nothing is written", (t) => {
        const dir = guidanceCopy();
        const rules = path.join(dir, GUIDANCE_RULES_DIR);
        fs.mkdirSync(rules, { recursive: true });
        fs.writeFileSync(path.join(rules, "conventions.md"), "Ours.\n");
        fs.writeFileSync(path.join(rules, "notes.md"), "Ours too.\n");
        for (const argv of [["--workspace", dir], ["--workspace", dir, "--check"]]) {
            const { code, out } = said(t, argv);
            assert.equal(code, 2);
            assert.match(out, /holds conventions\.md, notes\.md and no `\.compiled` marker, so nothing shows this compiler wrote them/);
        }
        assert.deepEqual(fs.readdirSync(rules).sort(), ["conventions.md", "notes.md"]);
        assert.equal(fs.readFileSync(path.join(rules, "conventions.md"), "utf8"), "Ours.\n");
        assert.ok(!fs.existsSync(path.join(dir, SKILLS_DIR)));
    });

    test("a skill written by hand is never replaced: exit 2, and the file is untouched", (t) => {
        const dir = guidanceCopy();
        const mine = path.join(dir, SKILLS_DIR, "release", "SKILL.md");
        fs.mkdirSync(path.dirname(mine), { recursive: true });
        fs.writeFileSync(mine, "---\nname: release\ndescription: Ours.\n---\n\nOurs.\n");
        for (const argv of [["--workspace", dir], ["--workspace", dir, "--check"]]) {
            const { code, out } = said(t, argv);
            assert.equal(code, 2);
            assert.match(out, /exists and was not compiled here/);
        }
        assert.equal(fs.readFileSync(mine, "utf8"), "---\nname: release\ndescription: Ours.\n---\n\nOurs.\n");
        assert.ok(!fs.existsSync(path.join(dir, GUIDANCE_RULES_DIR)), "refused before anything was written");
    });

    test("a skill that only quotes the mark is not compiled: never replaced, and never removed", (t) => {
        const dir = guidanceCopy();
        const quoting = "---\nname: release\ndescription: Ours.\n---\n\nHow compile marks a skill:\n<!-- compiled by `portulan compile` from context/release.md; edit that file, then recompile -->\n";
        const owed = path.join(dir, SKILLS_DIR, "release", "SKILL.md");
        fs.mkdirSync(path.dirname(owed), { recursive: true });
        fs.writeFileSync(owed, quoting);
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 2);
        assert.match(out, /release\/SKILL\.md exists and was not compiled here/);
        assert.equal(fs.readFileSync(owed, "utf8"), quoting);
        fs.rmSync(path.dirname(owed), { recursive: true });
        const mine = path.join(dir, SKILLS_DIR, "mine", "SKILL.md");
        fs.mkdirSync(path.dirname(mine), { recursive: true });
        fs.writeFileSync(mine, quoting.replace("name: release", "name: mine"));
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        assert.equal(said(t, ["--workspace", dir, "--check"]).code, 0);
        assert.equal(fs.readFileSync(mine, "utf8"), quoting.replace("name: release", "name: mine"));
    });

    test("a skill compiled from another unit is not this unit's to replace: exit 2, and the file is untouched", (t) => {
        const dir = guidanceCopy();
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        const skill = path.join(dir, SKILLS_DIR, "release", "SKILL.md");
        const other = fs.readFileSync(skill, "utf8").replace("from context/release.md;", "from elsewhere/release.md;");
        fs.writeFileSync(skill, other);
        for (const argv of [["--workspace", dir], ["--workspace", dir, "--check"]]) {
            const { code, out } = said(t, argv);
            assert.equal(code, 2);
            assert.match(out, /release\/SKILL\.md was compiled from elsewhere\/release\.md, and context\/release\.md would replace it/);
        }
        assert.equal(fs.readFileSync(skill, "utf8"), other);
    });

    test("a skill written by hand stops a workspace with a gate policy too, before the policy is written", (t) => {
        const dir = workspace();
        const manifestPath = path.join(dir, ".portulan", "workspace.json");
        const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        m.portulan.spec = "2.10";
        m.slots.context = "context/";
        fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
        fs.mkdirSync(path.join(dir, ".portulan", "context"));
        fs.writeFileSync(path.join(dir, ".portulan", "context", "release.md"), unitText(["tier: on-invoke", "description: Cut a release."]));
        const mine = path.join(dir, SKILLS_DIR, "release", "SKILL.md");
        fs.mkdirSync(path.dirname(mine), { recursive: true });
        fs.writeFileSync(mine, "Ours.\n");
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 2);
        assert.match(out, /exists and was not compiled here/);
        assert.ok(!fs.existsSync(path.join(dir, ".claude", "settings.json")), "no gate artifact written beside the refusal");
        assert.equal(fs.readFileSync(mine, "utf8"), "Ours.\n");
    });

    test("a slot naming the workspace directory itself, or a directory outside it, is refused", (t) => {
        for (const declared of ["./", "../elsewhere/"]) {
            const dir = guidanceCopy();
            const manifestPath = path.join(dir, "workspace.json");
            const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
            m.slots.context = declared;
            fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
            const { code, out } = said(t, ["--workspace", dir]);
            assert.equal(code, 2, declared);
            assert.match(out, /resolves to the workspace directory itself or outside it/);
            assert.ok(!fs.existsSync(path.join(dir, ".claude")));
        }
    });

    test("a slot where compile writes is refused, in .claude/ or the workspace's compile/, and nothing is written", (t) => {
        for (const declared of [`${GUIDANCE_RULES_DIR}/`, `${GUIDANCE_RULES_DIR}/units/`, `${SKILLS_DIR}/units/`, ".claude/context/", "compile/context/"]) {
            const dir = guidanceCopy();
            const manifestPath = path.join(dir, "workspace.json");
            const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
            m.slots.context = declared;
            fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
            const slot = path.join(dir, ...declared.split("/"));
            fs.mkdirSync(path.dirname(slot), { recursive: true });
            fs.renameSync(path.join(dir, "context"), slot);
            const units = () => fs.readdirSync(slot).map((f) => [f, fs.readFileSync(path.join(slot, f), "utf8")]);
            const before = units();
            for (const argv of [["--workspace", dir], ["--workspace", dir, "--check"]]) {
                const { code, out } = said(t, argv);
                assert.equal(code, 2, declared);
                assert.match(out, /lies in a directory `compile` writes into/, declared);
            }
            assert.deepEqual(units(), before, declared);
            assert.ok(!fs.existsSync(path.join(dir, GUIDANCE_RULES_DIR, RULES_MARKER)), declared);
        }
    });

    test("a unit that is a link into where compile writes is refused, and what it points at is untouched", (t) => {
        const dir = guidanceCopy();
        const target = path.join(dir, ".claude", "notes", "linked.md");
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, unitText(["tier: always"]));
        fs.symlinkSync(target, path.join(dir, "context", "linked.md"));
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 2);
        assert.match(out, /context\/linked\.md is a link into a directory `compile` writes into/);
        assert.equal(fs.readFileSync(target, "utf8"), unitText(["tier: always"]));
        assert.ok(!fs.existsSync(path.join(dir, GUIDANCE_RULES_DIR)));
    });

    test("a unit that is a link out of the workspace is refused, and nothing is written", (t) => {
        const dir = guidanceCopy();
        const outside = path.join(scratch(), "outside.md");
        fs.writeFileSync(outside, unitText(["tier: always"]));
        fs.symlinkSync(outside, path.join(dir, "context", "outside.md"));
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 2);
        assert.match(out, /context\/outside\.md is a link out of the workspace/);
        assert.ok(!fs.existsSync(path.join(dir, ".claude")));
    });

    test("a malformed unit stops the run before anything is written", (t) => {
        const dir = guidanceCopy();
        fs.writeFileSync(path.join(dir, "context", "bad.md"), unitText(["tier: sometimes"]));
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 2);
        assert.match(out, /context\/bad\.md: `tier` is "sometimes"/);
        assert.ok(!fs.existsSync(path.join(dir, ".claude")));
    });

    test("with a gate policy beside it, both compile, and the check covers both", (t) => {
        const dir = workspace();
        const manifestPath = path.join(dir, ".portulan", "workspace.json");
        const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        m.portulan.spec = "2.10";
        m.slots.context = "context/";
        fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
        fs.mkdirSync(path.join(dir, ".portulan", "context"));
        fs.writeFileSync(path.join(dir, ".portulan", "context", "history.md"), unitText(["tier: on-read", "description: Why."]));
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        assert.equal(fs.readFileSync(path.join(dir, GUIDANCE_RULES_DIR, ON_READ_INDEX), "utf8"), "- `.portulan/context/history.md` (<1 KB): Why.\n");
        assert.ok(fs.existsSync(path.join(dir, ".claude", "settings.json")));
        const { code, out } = said(t, ["--workspace", dir, "--check"]);
        assert.equal(code, 0, out);
        assert.match(out, /GREEN — every emitted artifact matches the policy, and every guidance file its unit/);
    });

    test("a workspace that stops declaring guidance owes none, so the rules it left are red, then removed", (t) => {
        const dir = workspace();
        const manifestPath = path.join(dir, ".portulan", "workspace.json");
        const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        m.portulan.spec = "2.10";
        m.slots.context = "context/";
        fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
        fs.mkdirSync(path.join(dir, ".portulan", "context"));
        fs.writeFileSync(path.join(dir, ".portulan", "context", "history.md"), unitText(["tier: on-read", "description: Why."]));
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        delete m.slots.context;
        fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
        const check = said(t, ["--workspace", dir, "--check"]);
        assert.equal(check.code, 1);
        assert.match(check.out, /on-read\.md is where this compiler writes guidance, and no unit compiles to it/);
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        assert.ok(!fs.existsSync(path.join(dir, GUIDANCE_RULES_DIR)), "the marker goes with the rules it marked");
        assert.equal(said(t, ["--workspace", dir, "--check"]).code, 0);
    });

    test("so does one with no gate policy, and the run after refuses it as declaring neither", (t) => {
        const dir = guidanceCopy();
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        const manifestPath = path.join(dir, "workspace.json");
        const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        delete m.slots.context;
        fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
        const check = said(t, ["--workspace", dir, "--check"]);
        assert.equal(check.code, 1, check.out);
        assert.match(check.out, /no guidance is declared: what an earlier run compiled from guidance is this compiler's to remove/);
        assert.match(check.out, /on-read\.md is where this compiler writes guidance, and no unit compiles to it/);
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        assert.ok(!fs.existsSync(path.join(dir, GUIDANCE_RULES_DIR)), "the rules and their marker are gone");
        assert.ok(!fs.existsSync(path.join(dir, SKILLS_DIR, "release")), "and the compiled skill");
        assert.equal(said(t, ["--workspace", dir, "--check"]).code, 2);
    });

    const claudeTree = (dir) => {
        const files = {};
        const walk = (at) => {
            for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
                const file = path.join(at, entry.name);
                if (entry.isDirectory()) walk(file);
                else files[path.relative(dir, file).split(path.sep).join("/")] = fs.readFileSync(file, "utf8");
            }
        };
        walk(path.join(dir, ".claude"));
        return files;
    };

    test("a manifest that does not parse stops the run, with a gate policy or without one: nothing written or removed", (t) => {
        for (const policyBeside of [true, false]) {
            for (const [label, broken] of [
                ["cut short", (text) => text.slice(0, -2)],
                ["null", () => "null"],
                ["an array", () => "[]"],
            ]) {
                const dir = scratch();
                fs.cpSync(GUIDANCE_FIXTURE, path.join(dir, ".portulan"), { recursive: true });
                if (policyBeside) fs.writeFileSync(path.join(dir, ".portulan", "gates.json"), JSON.stringify(policy()));
                assert.equal(said(t, ["--workspace", dir]).code, 0);
                const before = claudeTree(dir);
                assert.ok(`${GUIDANCE_RULES_DIR}/${RULES_MARKER}` in before, "the marker is among what must survive");
                assert.equal(`.claude/settings.json` in before, policyBeside);
                const manifestPath = path.join(dir, ".portulan", "workspace.json");
                fs.writeFileSync(manifestPath, broken(fs.readFileSync(manifestPath, "utf8")));
                const why = label === "cut short" ? /it is not valid JSON — \S/ : /it is not a JSON object/;
                for (const args of [["--workspace", dir], ["--workspace", dir, "--check"]]) {
                    const { code, out } = said(t, args);
                    const where = `${label}${policyBeside ? " beside gates.json" : ""}, ${args.join(" ")}`;
                    assert.equal(code, 2, `${where}: ${out}`);
                    assert.match(out, /workspace\.json is not a manifest this compiler can read/, where);
                    assert.match(out, why, where);
                    assert.deepEqual(claudeTree(dir), before, `${where}: nothing written or removed`);
                }
            }
        }
    });

    // `init`, `vendor` and `upgrade` reach guidance through these functions, not through the command line.
    test("every entry point that compiles or plans guidance stops on a manifest that does not parse", (t) => {
        const dir = scratch();
        fs.cpSync(GUIDANCE_FIXTURE, path.join(dir, ".portulan"), { recursive: true });
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        const before = claudeTree(dir);
        const manifestPath = path.join(dir, ".portulan", "workspace.json");
        fs.writeFileSync(manifestPath, fs.readFileSync(manifestPath, "utf8").slice(0, -2));
        for (const [name, call] of [
            ["compileGuidance", () => compileGuidance(dir)],
            ["compileGuidance under check", () => compileGuidance(dir, { check: true })],
            ["guidanceEdits", () => guidanceEdits(dir)],
            ["guidanceUnits", () => guidanceUnits(dir, ".portulan")],
        ]) {
            assert.throws(call, (e) => e instanceof CompileError && /workspace\.json is not a manifest this compiler can read: it is not valid JSON — \S/.test(e.message), name);
            assert.deepEqual(claudeTree(dir), before, `${name}: nothing written or removed`);
        }
    });

    test("a workspace whose manifest is gone, with no gate policy, is no reason to remove anything", (t) => {
        const dir = scratch();
        fs.cpSync(GUIDANCE_FIXTURE, path.join(dir, ".portulan"), { recursive: true });
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        const before = claudeTree(dir);
        fs.rmSync(path.join(dir, ".portulan", "workspace.json"));
        for (const args of [["--workspace", dir], ["--workspace", dir, "--check"]]) {
            const { code, out } = said(t, args);
            assert.equal(code, 2, `${args.join(" ")}: ${out}`);
            assert.match(out, /no readable `workspace.json`/);
            assert.deepEqual(claudeTree(dir), before, `${args.join(" ")}: nothing removed`);
        }
    });

    test("a rules directory without the marker is not this compiler's where it owes no rule: left, and green", (t) => {
        const dir = workspace();
        fs.mkdirSync(path.join(dir, GUIDANCE_RULES_DIR), { recursive: true });
        fs.writeFileSync(path.join(dir, GUIDANCE_RULES_DIR, "ours.md"), "Ours.\n");
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        assert.equal(said(t, ["--workspace", dir, "--check"]).code, 0);
        assert.equal(fs.readFileSync(path.join(dir, GUIDANCE_RULES_DIR, "ours.md"), "utf8"), "Ours.\n");
    });

    test("--matrix prints each unit against each host, and writes nothing", (t) => {
        const dir = guidanceCopy();
        const { code, out } = said(t, ["--workspace", dir, "--matrix"]);
        assert.equal(code, 0);
        assert.match(out, /^ {2}api +on-path +expressed +pointer +$/m);
        assert.ok(!fs.existsSync(path.join(dir, ".claude")));
    });

    test("this repository's guidance opens with its boot card, and what it compiles to is what is committed", () => {
        const guidance = guidanceUnits(REPO, ".portulan");
        const card = guidance.units.find((u) => u.name === BOOT_CARD_UNIT);
        assert.equal(card?.tier, "always");
        assert.equal(card.text.split("\n")[0], BOOT_CARD_LINE);
        for (const file of claudeCodeGuidance(guidance).files) {
            assert.equal(fs.readFileSync(path.join(REPO, ...file.path.split("/")), "utf8"), file.text, file.path);
        }
    });

    test("this repository's card names each gate under the tier the composed policy gives it, and no other gate", () => {
        const policy = JSON.parse(fs.readFileSync(path.join(REPO, ".portulan", "gates.json"), "utf8"));
        const { contributions } = packContributions(REPO, ".portulan", { packRoots: [path.join(REPO, "packs")] });
        const held = composeFragments(policy, contributions).policy.rules.map((rule) => `${rule.tier} ${rule.id}`);
        const card = fs.readFileSync(path.join(REPO, ".portulan", "context", `${BOOT_CARD_UNIT}.md`), "utf8");
        const labelsBesideGates = new Set(["agent-driven"]);
        const named = [];
        for (const [, tier, body] of card.matchAll(/^- \*\*(Auto|Propose|Gated|Prohibited)\*\*(.*(?:\n {2}.*)*)/gm)) {
            for (const [, id] of body.matchAll(/`([a-z]+(?:-[a-z]+)+)`/g)) {
                if (!labelsBesideGates.has(id)) named.push(`${tier.toLowerCase()} ${id}`);
            }
        }
        assert.deepEqual(named.sort(), held.sort());
    });
});

// Imports are checked against what Claude Code 2.1.281 loads.
describe("guidance: the boot card, its imports and its lead lines", () => {
    function withFiles(files) {
        const dir = guidanceCopy();
        for (const [rel, text] of Object.entries(files)) {
            fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
            fs.writeFileSync(path.join(dir, rel), text);
        }
        return dir;
    }
    const card = (...lines) => unitText(["tier: always"], [BOOT_CARD_LINE, "", ...lines].join("\n"));
    const rule = (dir, name) => fs.readFileSync(path.join(dir, GUIDANCE_RULES_DIR, `${name}.md`), "utf8");

    test("an import is spelled again from the rule it compiles to, and the measurement follows it there", (t) => {
        const dir = withFiles({ "context/boot.md": card("@../identity.md", "", "A path in a code span, `@nothing.md`, is text.") });
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 0, out);
        assert.match(rule(dir, "boot"), /^@\.\.\/\.\.\/\.\.\/identity\.md$/m);
        assert.doesNotMatch(rule(dir, "boot"), /^@\.\.\/identity\.md$/m, "the unit's own spelling resolves from the wrong directory");
        const measured = alwaysTier(dir);
        assert.equal(measured.card, path.join(dir, GUIDANCE_RULES_DIR, "boot.md"));
        assert.ok(measured.entries.some((e) => e.file === path.join(dir, "identity.md") && e.label === "import, depth 1"), "the imported file is in the always tier");
        assert.deepEqual([measured.missing, measured.outside, measured.tooDeep], [[], [], []]);
        const check = said(t, ["--workspace", dir, "--check"]);
        assert.equal(check.code, 0, check.out);
    });

    test("an escaped space and a fragment are read as the host reads them, and kept where the import is spelled again", (t) => {
        const dir = withFiles({ "context/boot.md": card("@../my\\ notes.md#part"), "my notes.md": "Notes.\n" });
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 0, out);
        assert.match(rule(dir, "boot"), /^@\.\.\/\.\.\/\.\.\/my\\ notes\.md#part$/m);
        assert.ok(alwaysTier(dir).entries.some((e) => e.file === path.join(dir, "my notes.md")), "the file whose name holds a space loads");
        assert.equal(said(t, ["--workspace", dir, "--check"]).code, 0);
        fs.writeFileSync(path.join(dir, "context", "api.md"), unitText(["tier: on-path", 'paths: ["api/**"]', "description: Handlers."], "@../my\\ notes.md"));
        const stray = said(t, ["--workspace", dir]);
        assert.equal(stray.code, 2);
        assert.match(stray.out, /`@\.\.\/my\\ notes\.md` names a file, and only an always unit may import one/);
    });

    test(`a file ${IMPORT_DEPTH} imports below the rule is refused, since the host loads nothing there, and one ${IMPORT_DEPTH - 1} below compiles`, (t) => {
        const dir = withFiles({ "context/boot.md": card("@../d1.md"), "d1.md": "@d2.md\n", "d2.md": "@d3.md\n", "d3.md": "@d4.md\n", "d4.md": "@d5.md\n", "d5.md": "Five down.\n" });
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 2);
        assert.match(out, /`@d5\.md` \(in d4\.md\) sits 5 imports below the rule, and the host loads nothing 5 deep/);
        assert.ok(!fs.existsSync(path.join(dir, ".claude")));
        fs.writeFileSync(path.join(dir, "d4.md"), "Four down.\n");
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        assert.deepEqual(alwaysTier(dir).tooDeep, []);
    });

    const refusedImports = [
        ["an import that leaves the tree compiled", card("@../../outside.md"), /`@\.\.\/\.\.\/outside\.md` \(in context\/boot\.md\) leaves .+, the tree compiled here/],
        ["a home path", card("@~/notes.md"), /`@~\/notes\.md` \(in context\/boot\.md\) is a home or an absolute path/],
        ["an absolute path", card("@/etc/hostname"), /`@\/etc\/hostname` \(in context\/boot\.md\) is a home or an absolute path/],
        ["an import that names no file", card("@../missing.md"), /`@\.\.\/missing\.md` \(in context\/boot\.md\) names no file/],
        ["an import that shares its line", card("Read @../identity.md first."), /`@\.\.\/identity\.md` \(in context\/boot\.md\) shares its line with other text/],
        ["an import two files down that names no file", card("@../d1.md"), /`@gone\.md` \(in d1\.md\) names no file/, { "d1.md": "See\n\n@gone.md\n" }],
    ];
    for (const [why, text, pattern, more = {}] of refusedImports) {
        test(`refused, and nothing is written: ${why}`, (t) => {
            const dir = withFiles({ "context/boot.md": text, ...more });
            const { code, out } = said(t, ["--workspace", dir]);
            assert.equal(code, 2);
            assert.match(out, pattern);
            assert.ok(!fs.existsSync(path.join(dir, ".claude")));
        });
    }

    test("an import through a link out of the tree is refused, and nothing is written", (t) => {
        const elsewhere = scratch();
        fs.writeFileSync(path.join(elsewhere, "notes.md"), "Elsewhere.\n");
        const dir = withFiles({ "context/boot.md": card("@../linked.md") });
        fs.symlinkSync(path.join(elsewhere, "notes.md"), path.join(dir, "linked.md"));
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 2);
        assert.match(out, /`@\.\.\/linked\.md` \(in context\/boot\.md\) is a link out of .+, the tree compiled here/);
        assert.ok(!fs.existsSync(path.join(dir, ".claude")));
    });

    test("a unit in another tier that imports a file is refused, since it would not load as the unit does; `@` text naming no file is text", (t) => {
        const onPath = (body) => unitText(["tier: on-path", 'paths: ["api/**"]', "description: Handlers."], body);
        const dir = withFiles({ "context/api.md": onPath("Ask @copilot.\n\n@../identity.md") });
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 2);
        assert.match(out, /context\/api\.md: `@\.\.\/identity\.md` names a file, and only an always unit may import one — the host loads a path-scoped rule's imports into every context/);
        assert.ok(!fs.existsSync(path.join(dir, ".claude")));
        for (const [tier, why] of [["on-invoke", /compiles to a skill in another directory/], ["on-read", /opened as it stands/]]) {
            fs.writeFileSync(path.join(dir, "context", "api.md"), unitText([`tier: ${tier}`, "description: Handlers."], "@../identity.md"));
            const other = said(t, ["--workspace", dir]);
            assert.equal(other.code, 2);
            assert.match(other.out, why);
        }
        fs.writeFileSync(path.join(dir, "context", "api.md"), onPath("Ask @copilot, and open `identity.md`."));
        assert.equal(said(t, ["--workspace", dir]).code, 0);
    });

    test("a path in an HTML comment is no import, as the host strips comments before it reads one", (t) => {
        const dir = withFiles({ "context/boot.md": card("<!-- @../missing.md -->", "", "@../identity.md") });
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 0, out);
        assert.match(rule(dir, "boot"), /^<!-- @\.\.\/missing\.md -->$/m, "left as the unit wrote it");
        assert.match(rule(dir, "boot"), /^@\.\.\/\.\.\/\.\.\/identity\.md$/m);
    });

    // Claude Code 2.1.281's lexer hands a list item's text over whole, so a code span there hides no import.
    test("in a list item a code span hides no import, tight or loose, and a refusal sends text that is not one elsewhere", (t) => {
        const advice = /text that is not an import (goes )?in a fenced block, or in a code span outside a list/;
        for (const list of [["- Run `cat @../identity.md now` first.", "- Then the rest."], ["- Run `cat @../identity.md now` first.", "", "- Then the rest."]]) {
            const dir = withFiles({ "context/boot.md": card(...list) });
            const { code, out } = said(t, ["--workspace", dir]);
            assert.equal(code, 2, out);
            assert.match(out, /`@\.\.\/identity\.md` \(in context\/boot\.md\) shares its line with other text/);
            assert.match(out, advice);
            assert.ok(!fs.existsSync(path.join(dir, ".claude")));
        }
        const below = said(t, ["--workspace", withFiles({ "context/boot.md": card("@../notes.md"), "notes.md": "- Run `cat @gone.md now` first.\n" })]);
        assert.equal(below.code, 2, below.out);
        assert.match(below.out, /`@gone\.md` \(in notes\.md\) names no file, so the host would load nothing/);
        assert.match(below.out, advice);
        const text = card("Run `cat @../identity.md now` first.", "", "```", "- cat @../identity.md", "```", "", "- Open `@../identity.md` on demand.");
        const kept = said(t, ["--workspace", withFiles({ "context/boot.md": text })]);
        assert.equal(kept.code, 0, `a paragraph's code span, a fenced block, and an \`@\` straight after a backtick are text: ${kept.out}`);
    });

    test("a leads line is the lead sentence of each item in the file's first list, and a change there is drift", (t) => {
        const rules = [
            "# Rules",
            "",
            "Prose first. It is not a list.",
            "",
            "1. **Ship small.** A reviewer reads a small change whole.",
            "2. **Run `a.b` first** when the change is a fix. Then the rest,",
            "   which continues here.",
            "3. **Say what is enforced!** And what is not.",
            "",
            "- A second list, never read.",
            "",
        ].join("\n");
        const dir = withFiles({ "rules.md": rules, "context/boot.md": card("The rules:", "", "<!-- leads: ../rules.md -->", "", "Open `rules.md` for the reasons.") });
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        assert.match(rule(dir, "boot"), /The rules:\n\n1\. \*\*Ship small\.\*\*\n2\. \*\*Run `a\.b` first\*\* when the change is a fix\.\n3\. \*\*Say what is enforced!\*\*\n\nOpen/);
        fs.writeFileSync(path.join(dir, "rules.md"), rules.replace("Ship small.", "Ship smaller."));
        const check = said(t, ["--workspace", dir, "--check"]);
        assert.equal(check.code, 1);
        assert.match(check.out, /boot\.md has drifted from context\/boot\.md, whose leads are written from rules\.md\. Edit the unit or those files, then recompile\./);
    });

    // To CommonMark, a line with no indent straight under an item's text is more of that item.
    test("a line with no indent under an item's text is refused, naming its line, and a line that opens a block still ends the list", (t) => {
        const rules = (under) =>
            ["# Rules", "", "1. **Ship small.** A reviewer reads a small change", "   whole.", "2. **Say what is enforced.** And what is not.", under, "3. **Never read.** It is past the list.", ""].join("\n");
        const dir = withFiles({ "rules.md": rules("which is the half a reader forgets."), "context/boot.md": card("<!-- leads: ../rules.md -->") });
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 2, out);
        assert.match(out, /context\/boot\.md: line 6 of rules\.md follows an item of its first list with no blank line and no indent, .+ indent it under the item, or end the list with a blank line/);
        assert.ok(!fs.existsSync(path.join(dir, ".claude")));
        for (const opener of ["## Next", "> A quote.", "---", "* Another list.", "<!-- A note. -->", "```"]) {
            fs.writeFileSync(path.join(dir, "rules.md"), rules(opener));
            const opened = said(t, ["--workspace", dir]);
            assert.equal(opened.code, 0, `${opener}: ${opened.out}`);
            assert.match(rule(dir, "boot"), /^1\. \*\*Ship small\.\*\*\n2\. \*\*Say what is enforced\.\*\*$/m, opener);
            assert.doesNotMatch(rule(dir, "boot"), /Never read/, opener);
        }
    });

    const refusedLeads = [
        ["a file with no list", "# Rules\n\nOnly prose.\n", /the leads of \.\.\/rules\.md were asked for, and it holds no list|the leads of rules\.md were asked for, and it holds no list/],
        ["an item with no bold lead", "1. **Ship small.** Why.\n2. Plain words.\n", /an item of rules\.md's first list opens without a bold lead/],
        ["a lead carrying a link", "1. **Ship [small](x.md).** Why.\n", /the lead .+ of rules\.md carries a link/],
    ];
    for (const [why, rules, pattern] of refusedLeads) {
        test(`refused, and nothing is written: a leads line naming ${why}`, (t) => {
            const dir = withFiles({ "rules.md": rules, "context/boot.md": card("<!-- leads: ../rules.md -->") });
            const { code, out } = said(t, ["--workspace", dir]);
            assert.equal(code, 2);
            assert.match(out, pattern);
            assert.ok(!fs.existsSync(path.join(dir, ".claude")));
        });
    }

    test("refused, and nothing is written: a leads line naming a file outside the tree, or none", (t) => {
        for (const [target, pattern] of [["../../rules.md", /lies outside the tree compiled here/], ["../missing.md", /names no file/]]) {
            const dir = withFiles({ "context/boot.md": card(`<!-- leads: ${target} -->`) });
            const { code, out } = said(t, ["--workspace", dir]);
            assert.equal(code, 2);
            assert.match(out, pattern);
            assert.ok(!fs.existsSync(path.join(dir, ".claude")));
        }
    });

    test("a leads line ending `#<heading>` reads the first list under that heading, and one no heading or several answer is refused", (t) => {
        const rules = ["# Rules", "", "- **Not these.** Above the heading.", "", "## Kept", "", "- **Ship small.** Why.", "- **Say so.** Why.", "", "## Why", "", "### Why", "", "Twice.", ""].join("\n");
        const dir = withFiles({ "rules.md": rules, "context/boot.md": card("<!-- leads: ../rules.md#kept -->") });
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 0, out);
        assert.match(rule(dir, "boot"), /^- \*\*Ship small\.\*\*\n- \*\*Say so\.\*\*$/m);
        assert.doesNotMatch(rule(dir, "boot"), /Not these/);
        for (const [fragment, pattern] of [["gone", /the leads of rules\.md#gone were asked for, and no heading answers #gone/], ["Why", /the leads of rules\.md#Why were asked for, and #Why names 2 headings/]]) {
            fs.writeFileSync(path.join(dir, "context", "boot.md"), card(`<!-- leads: ../rules.md#${fragment} -->`));
            const refused = said(t, ["--workspace", dir]);
            assert.equal(refused.code, 2, refused.out);
            assert.match(refused.out, pattern);
        }
    });

    test("an engine line writes the leads of the engine's own file, keeps `<plugin root>/` in a tree that is not the engine, and an edit is drift", (t) => {
        const dir = withFiles({ "context/boot.md": card("<!-- engine: operating/context.md#every-request-pays-for-what-the-session-has-read -->") });
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 0, out);
        const written = rule(dir, "boot");
        assert.match(written, /^- \*\*Send independent tool calls in one request\.\*\*$/m);
        assert.match(written, /`node <plugin root>\/cli\/symbols\.mjs <file>`/, "a consumer's card names the command from where Portulan is installed");
        fs.writeFileSync(path.join(dir, GUIDANCE_RULES_DIR, "boot.md"), written.replace("one request", "two requests"));
        const check = said(t, ["--workspace", dir, "--check"]);
        assert.equal(check.code, 1);
        assert.match(check.out, /whose leads are written from the engine's core\/operating\/context\.md\./);
        const own = fs.readFileSync(path.join(REPO, GUIDANCE_RULES_DIR, "boot.md"), "utf8");
        assert.match(own, /`node cli\/symbols\.mjs <file>`/);
        assert.doesNotMatch(own, /<plugin root>/);
    });

    test("refused, and nothing is written: an engine line naming a file outside the engine's core/, or none", (t) => {
        for (const target of ["../cli/compile.mjs", "operating/missing.md"]) {
            const dir = withFiles({ "context/boot.md": card(`<!-- engine: ${target} -->`) });
            const { code, out } = said(t, ["--workspace", dir]);
            assert.equal(code, 2, out);
            assert.match(out, new RegExp(`the engine's leads of ${target.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")} were asked for, and it names no file in the engine's core/`));
            assert.ok(!fs.existsSync(path.join(dir, ".claude")));
        }
    });

    test("refused, and nothing is written: an engine line naming a link in core/ that leads out of it", () => {
        const engine = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "compile-engine-"));
        SCRATCH.push(engine);
        fs.mkdirSync(path.join(engine, "cli"));
        for (const file of ["compile.mjs", "discover.mjs", "inside.mjs", "symbols.mjs", "ledger.mjs"]) fs.copyFileSync(path.join(REPO, "cli", file), path.join(engine, "cli", file));
        fs.mkdirSync(path.join(engine, "core"));
        const leads = "# Leads\n\n- **A lead.**\n";
        fs.writeFileSync(path.join(engine, "core", "inside.md"), leads);
        fs.writeFileSync(path.join(engine, "outside.md"), leads);
        fs.symlinkSync(path.join(engine, "outside.md"), path.join(engine, "core", "link.md"));
        const compile = (target) => {
            const dir = withFiles({ "context/boot.md": card(`<!-- engine: ${target} -->`) });
            const { status, stdout, stderr } = spawnSync(process.execPath, [path.join(engine, "cli", "compile.mjs"), "--workspace", dir], { encoding: "utf8" });
            return { dir, status, out: stdout + stderr };
        };
        const inside = compile("inside.md");
        assert.equal(inside.status, 0, inside.out);
        const link = compile("link.md");
        assert.equal(link.status, 2, link.out);
        assert.match(link.out, /the engine's leads of link\.md were asked for, and it names no file in the engine's core\//);
        assert.ok(!fs.existsSync(path.join(link.dir, ".claude")));
    });

    const policy = (...rules) => `${JSON.stringify({ portulan: { spec: "2.2" }, rules: rules.map(([id, tier]) => ({ id, tier, action: { write: `${id}.md` }, reason: `Why ${id}.` })) }, null, 2)}\n`;

    test("a gates line writes out the policy's gate ids by tier, in its order, a tier with none says so, and an edit to the policy is drift", (t) => {
        const dir = withFiles({ "gates.json": policy(["b-first", "gated"], ["a-second", "gated"], ["never", "prohibited"]), "context/boot.md": card("<!-- gates: ../gates.json -->") });
        assert.equal(said(t, ["--workspace", dir]).code, 0);
        assert.match(
            rule(dir, "boot"),
            /\n- \*\*Auto\*\*, unattended: none\.\n- \*\*Propose\*\*, a human decides: none\.\n- \*\*Gated\*\*, a human's approval for each action, never inferred and never standing: `b-first`, `a-second`\.\n- \*\*Prohibited\*\*, where no approval exists: `never`\.\n/,
        );
        assert.doesNotMatch(rule(dir, "boot"), /Packs/, "a manifest composing no pack has no pack line");
        fs.writeFileSync(path.join(dir, "gates.json"), policy(["b-first", "gated"]));
        const check = said(t, ["--workspace", dir, "--check"]);
        assert.equal(check.code, 1);
        assert.match(check.out, /boot\.md has drifted from context\/boot\.md, whose gates are written from gates\.json\./);
    });

    test("a gates line names the packs the manifest composes, whose gates only a compile resolving them can list", (t) => {
        const dir = withFiles({ "gates.json": policy(["one", "auto"]), "context/boot.md": card("<!-- gates: ../gates.json -->") });
        const manifest = JSON.parse(fs.readFileSync(path.join(dir, "workspace.json"), "utf8"));
        fs.writeFileSync(path.join(dir, "workspace.json"), `${JSON.stringify({ ...manifest, packs: ["team-rules", "house-style"] }, null, 2)}\n`);
        const { code, out } = said(t, ["--workspace", dir]);
        assert.equal(code, 0, out);
        assert.match(rule(dir, "boot"), /^- \*\*Packs\*\* add gates of their own, which `portulan compile --matrix` lists: `team-rules`, `house-style`\.$/m);
    });

    const refusedGates = [
        ["a file that is no JSON", "not json\n", /the gates of gates\.json were asked for, and it is not a readable JSON policy/],
        ["a policy the gate reader refuses", `${JSON.stringify({ portulan: { spec: "2.2" }, rules: [] })}\n`, /the gates of gates\.json were asked for, and the gate policy declares no rules/],
    ];
    for (const [why, text, pattern] of refusedGates) {
        test(`refused, and nothing is written: a gates line naming ${why}`, (t) => {
            const dir = withFiles({ "gates.json": text, "context/boot.md": card("<!-- gates: ../gates.json -->") });
            const { code, out } = said(t, ["--workspace", dir]);
            assert.equal(code, 2);
            assert.match(out, pattern);
            assert.ok(!fs.existsSync(path.join(dir, ".claude")));
        });
    }

    const refusedUnits = [
        ["a leads line in an on-read unit", "a", unitText(["tier: on-read", "description: A."], "<!-- leads: ../rules.md -->"), /written out only in an always unit, and this one is `on-read`/],
        ["a gates line in an on-path unit", "a", unitText(["tier: on-path", "paths: [\"src/**\"]", "description: A."], "<!-- gates: ../gates.json -->"), /a `<!-- gates: … -->` line is written out only in an always unit, and this one is `on-path`/],
        ["an engine line in an on-read unit", "a", unitText(["tier: on-read", "description: A."], "<!-- engine: operating/context.md -->"), /a `<!-- engine: … -->` line is written out only in an always unit, and this one is `on-read`/],
        ["a boot unit in another tier", BOOT_CARD_UNIT, unitText(["tier: on-read", "description: A."], `${BOOT_CARD_LINE}\n\nA.`), /is an `always` unit, and this one is `on-read`/],
        ["a boot unit that does not open with the card's line", BOOT_CARD_UNIT, unitText(["tier: always"], "# Boot\n\nA."), /a boot card opens with the line `# Portulan boot card`, which is how the boot skill knows it is loaded/],
        ["the card's line opening another unit", "welcome", unitText(["tier: always"], `${BOOT_CARD_LINE}\n\nA.`), /only the unit named `boot` is one/],
    ];
    for (const [why, name, text, pattern] of refusedUnits) {
        test(`refused, as could-not-compile: ${why}`, () => {
            assert.throws(() => parseUnit(name, text), (error) => {
                assert.ok(error instanceof CompileError, `a ${error.constructor.name}, not a CompileError`);
                assert.match(error.message, pattern);
                return true;
            });
        });
    }

    test("the vendored AGENTS.md names each import's file where the vendored tree holds it, one level deep", () => {
        const dir = withFiles({ "context/boot.md": card("@../identity.md") });
        const { inline } = agentsMdGuidance(guidanceUnits(dir, "."), ".portulan/context/");
        const carried = inline.find((body) => body.startsWith(BOOT_CARD_LINE));
        assert.match(carried, /^- `\.portulan\/identity\.md`: read it in full — a host that follows imports loads it here\.$/m);
        assert.doesNotMatch(carried, /^@/m, "a host of that file follows no import");
    });

    test("and each file an import imports in turn, to the host's depth, once, naming the file that imports it", () => {
        const dir = withFiles({
            "context/boot.md": card("@../d1.md", "", "@../identity.md"),
            "d1.md": "One.\n\n@d2.md\n\n@identity.md\n",
            "d2.md": "Two.\n\n@sub/d3.md\n",
            "sub/d3.md": "Three.\n",
        });
        const { inline } = agentsMdGuidance(guidanceUnits(dir, "."), ".portulan/context/");
        const carried = inline.find((body) => body.startsWith(BOOT_CARD_LINE));
        assert.match(
            carried,
            new RegExp(
                [
                    "^- `\\.portulan/d1\\.md`: read it in full — a host that follows imports loads it here\\.",
                    "- `\\.portulan/d2\\.md`: read it in full too — `\\.portulan/d1\\.md` imports it\\.",
                    "- `\\.portulan/sub/d3\\.md`: read it in full too — `\\.portulan/d2\\.md` imports it\\.$",
                ].join("\n"),
                "m",
            ),
        );
        assert.equal(carried.match(/`\.portulan\/identity\.md`/g).length, 1, "a file the card imports itself is named once, on its own line");
        assert.doesNotMatch(carried, /^@/m);
    });
});
