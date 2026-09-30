// The PreToolUse gate runner, driven as the host drives it.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The tools read the host's installed-plugin record unasked, so the suite gets an empty host of its own.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(HERE, "gate.mjs");

// One exit handler for every scratch directory: one each would pass node's default listener limit and warn.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-gate-"));
    SCRATCH.push(dir);
    return dir;
}

/** Runs the hook as the host does, returning a non-zero exit rather than throwing: its status is under test. */
function hook(project, payload, env = {}) {
    let stdout = "";
    let status = 0;
    try {
        stdout = execFileSync("node", [RUNNER], {
            input: typeof payload === "string" ? payload : JSON.stringify(payload),
            env: { ...process.env, CLAUDE_PROJECT_DIR: project, ...env },
            encoding: "utf8",
        });
    } catch (error) {
        status = error.status ?? 1;
        stdout = String(error.stdout ?? "");
    }
    const out = stdout.trim() ? JSON.parse(stdout).hookSpecificOutput : null;
    return { status, stdout, decision: out?.permissionDecision ?? null, reason: out?.permissionDecisionReason ?? null };
}

const bash = (command) => ({ tool_name: "Bash", tool_input: { command } });

function policy(rules) {
    return {
        portulan: { spec: "2.2" },
        why: "gate-map.md",
        rules: rules ?? [
            { id: "ban", tier: "prohibited", action: { write: "docs/vision.md" }, reason: "constitution" },
            { id: "push", tier: "gated", action: { shell: "git push" }, reason: "ask first" },
            { id: "pr", tier: "propose", action: { shell: "gh pr create" }, reason: "by pull request" },
            { id: "read", tier: "auto", action: { read: "./" }, reason: "unattended" },
        ],
    };
}

/** A workspace on disk; `packs: undefined` is dropped by JSON.stringify, leaving no `packs` key in the manifest. */
function workspace({ rules, packs, fragments } = {}) {
    const dir = scratch();
    fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".portulan", "gates.json"), JSON.stringify(policy(rules), null, 2));
    fs.writeFileSync(
        path.join(dir, ".portulan", "workspace.json"),
        JSON.stringify(
            {
                portulan: { spec: "2.1" },
                name: "scratch",
                summary: "s",
                kind: "repository",
                tree: "../",
                gates: "gates.json",
                slots: { gates: "gate-map.md" },
                verify: { default: "docs", recipes: [{ id: "docs", run: "./v.sh", requires: ["bash"] }] },
                packs,
            },
            null,
            2,
        ),
    );
    if (fragments) packAt(path.join(dir, "packs"), "tools", "contributor", fragments);
    return dir;
}

function packAt(root, category, name, gates) {
    const dir = path.join(root, category, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, "pack.json"),
        JSON.stringify({ portulan: { pack: "1.0" }, name, category, contributes: { gates } }, null, 2),
    );
    return dir;
}

const composing = (fragments, rules) => workspace({ rules, packs: ["tools/contributor"], fragments });

// ===========================================================================================
// 1. The policy the workspace YIELDS
// ===========================================================================================

describe("the hook reads the policy the workspace yields, not the one it declares", () => {
    test("a pack-ADDED `prohibited` rule with a real matcher is DENIED", () => {
        const dir = composing([
            { id: "exfiltrate", tier: "prohibited", action: { shell: "curl" }, reason: "no network from a tool call" },
        ]);
        const out = hook(dir, bash("curl https://example.com"));
        assert.equal(out.decision, "deny");
        assert.match(out.reason, /PORTULAN GATE `exfiltrate` \(prohibited\) — no network from a tool call/);
    });

    test("...and through a shell WRAPPER, which is the surface where this layer is the only one", () => {
        const dir = composing([
            { id: "exfiltrate", tier: "prohibited", action: { shell: "curl" }, reason: "no network from a tool call" },
        ]);
        for (const command of [
            'bash -c "curl https://example.com"',
            "sh -c 'curl https://example.com'",
            'zsh -c "curl https://example.com"',
        ]) {
            const out = hook(dir, bash(command));
            assert.equal(out.decision, "deny", command);
            assert.match(out.reason, /`exfiltrate`/);
        }
    });

    test("a pack TIGHTENING `gated` → `prohibited` denies where the declared tier would only ask", () => {
        const dir = composing([
            { id: "push", tier: "prohibited", action: { shell: "git push" }, reason: "this pack forbids pushing" },
        ]);
        const out = hook(dir, bash("git push origin main"));
        assert.equal(out.decision, "deny");
        assert.match(out.reason, /\(prohibited\) — this pack forbids pushing/);
    });

    test("a pack TIGHTENING `propose` → `gated` is asked, where the declared tier is not gate machinery at all", () => {
        const dir = composing([
            { id: "pr", tier: "gated", action: { shell: "gh pr create" }, reason: "this pack wants a human first" },
        ]);
        const out = hook(dir, bash("gh pr create --fill"));
        assert.equal(out.decision, "ask");
        assert.match(out.reason, /`pr` \(gated\) — this pack wants a human first/);
    });
});

// ===========================================================================================
// 2. The STRONGEST matching rule, not the first listed
// ===========================================================================================

describe("overlapping rules resolve to the strongest tier", () => {
    test("a pack-added `prohibited` beneath a broader declared `gated` DENIES", () => {
        // Composition appends pack rules after the workspace's own, so a first-match scan would answer `ask`.
        const dir = composing([
            { id: "mirror", tier: "prohibited", action: { shell: "git push --mirror" }, reason: "rewrites every ref" },
        ]);
        const out = hook(dir, bash("git push --mirror origin"));
        assert.equal(out.decision, "deny");
        assert.match(out.reason, /`mirror` \(prohibited\) — rewrites every ref/);
        assert.equal(hook(dir, bash("git push origin main")).decision, "ask");
    });

    test("a DECLARED-ONLY policy diverges too, where the weaker rule is listed first", () => {
        const dir = workspace({
            packs: undefined,
            rules: [
                { id: "push", tier: "gated", action: { shell: "git push" }, reason: "ask first" },
                { id: "mirror", tier: "prohibited", action: { shell: "git push --mirror" }, reason: "rewrites every ref" },
            ],
        });
        assert.equal(hook(dir, bash("git push --mirror origin")).decision, "deny");
        assert.equal(hook(dir, bash("git push origin main")).decision, "ask");
    });

    test("a tie at the same tier keeps the FIRST rule listed, which is what the old scan did", () => {
        const dir = composing(
            [{ id: "second", tier: "gated", action: { shell: "git push" }, reason: "the pack's sentence" }],
            [{ id: "first", tier: "gated", action: { shell: "git push" }, reason: "the workspace's sentence" }],
        );
        assert.match(hook(dir, bash("git push origin main")).reason, /`first` \(gated\) — the workspace's sentence/);
    });
});

// ===========================================================================================
// 3. What must NOT have changed
// ===========================================================================================

describe("a workspace that composes nothing behaves exactly as before", () => {
    // Both shapes: a missing `packs` key and an empty one leave `packContributions` at different early returns.
    for (const [label, packs] of [
        ["no `packs` key at all", undefined],
        ["`packs: []`", []],
    ]) {
        test(`${label} — the declared rules answer, and nothing else appears`, () => {
            const dir = workspace({ packs });
            assert.equal(hook(dir, bash("git push origin main")).decision, "ask");
            assert.match(hook(dir, bash("git push origin main")).reason, /`push` \(gated\) — ask first/);
            assert.equal(hook(dir, { tool_name: "Edit", tool_input: { file_path: "/x/docs/vision.md" } }).decision, "deny");
            assert.equal(hook(dir, bash("echo hi")).stdout, "");
            assert.equal(hook(dir, bash("echo hi")).status, 0);
        });
    }

    test("a composed `action: none` fragment composes cleanly and matches nothing", () => {
        // Both `rituals/checkpoints` fragments take this shape.
        const dir = composing([
            { id: "self-certify", tier: "prohibited", action: { none: "no tool-level surface" }, reason: "fresh context" },
        ]);
        assert.equal(hook(dir, bash("self-certify")).stdout, "");
        assert.equal(hook(dir, bash("git push origin main")).decision, "ask");
        assert.equal(hook(dir, bash("echo hi")).status, 0);
    });

    test("a declared pack that resolves to nothing costs the declared rules nothing", () => {
        const dir = workspace({ packs: ["tools/absent"] });
        assert.equal(hook(dir, bash("git push origin main")).decision, "ask");
        assert.equal(hook(dir, bash("echo hi")).stdout, "");
    });
});

describe("it degrades rather than disappearing, and never blocks", () => {
    test("a composition REFUSAL falls back to the declared policy instead of stepping aside", () => {
        // A step-aside would let a malformed or hostile `pack.json` switch off the gates the workspace declares.
        const dir = composing([
            { id: "push", tier: "gated", action: { shell: "git push" }, reason: "a demotion the compiler refuses" },
            { id: "ban", tier: "propose", action: { write: "docs/vision.md" }, reason: "and so is this" },
        ]);
        const out = hook(dir, bash("git push origin main"));
        assert.equal(out.decision, "ask");
        assert.match(out.reason, /`push` \(gated\) — ask first/);
        assert.equal(hook(dir, { tool_name: "Edit", tool_input: { file_path: "/x/docs/vision.md" } }).decision, "deny");
        assert.equal(out.status, 0);
    });

    test("a fragment that composes but is not a valid RULE falls back, rather than denying with `— undefined`", () => {
        const dir = composing([{ id: "no-reason", tier: "prohibited", action: { shell: "curl" } }]);
        const out = hook(dir, bash("curl https://example.com"));
        assert.equal(out.decision, null);
        assert.equal(out.stdout, "");
        // Only this half tells a fallback from a step-aside: both answer `null` on the payload above.
        const still = hook(dir, bash("git push origin main"));
        assert.equal(still.decision, "ask");
        assert.doesNotMatch(still.reason, /undefined/);
    });

    test("the DECLARED arm keeps its `— undefined`, which is the limit of that fix rather than an oversight", () => {
        // Stepping aside would drop a live prohibition over a missing string; `compile` refuses the shape instead.
        const dir = workspace({
            packs: undefined,
            rules: [
                { id: "no-reason-declared", tier: "prohibited", action: { shell: "curl" } },
                { id: "push", tier: "gated", action: { shell: "git push" }, reason: "ask first" },
            ],
        });
        const out = hook(dir, bash("curl https://example.com"));
        assert.equal(out.decision, "deny");
        assert.match(out.reason, /`no-reason-declared` \(prohibited\) — undefined/);
    });

    test("a pack manifest that is not readable JSON also falls back rather than blocking", () => {
        const dir = composing([{ id: "x", tier: "gated", action: { shell: "curl" }, reason: "r" }]);
        fs.writeFileSync(path.join(dir, "packs", "tools", "contributor", "pack.json"), "{ not json");
        const out = hook(dir, bash("git push origin main"));
        assert.equal(out.decision, "ask");
        assert.equal(out.status, 0);
    });

    test("an unreadable POLICY still steps aside silently — the fail-open this change does not touch", () => {
        // Fail-open on purpose: a hook that blocked on a bad policy would stop the session from repairing it.
        const dir = workspace();
        fs.writeFileSync(path.join(dir, ".portulan", "gates.json"), "{ not json");
        const out = hook(dir, bash("git push origin main"));
        assert.equal(out.stdout, "");
        assert.equal(out.status, 0);
    });

    test("a payload that is not JSON, and a workspace that is not there, both step aside at exit 0", () => {
        assert.equal(hook(workspace(), "not json at all").status, 0);
        assert.equal(hook(workspace(), "not json at all").stdout, "");
        assert.equal(hook(path.join(scratch(), "nowhere"), bash("git push origin main")).status, 0);
    });
});

// ===========================================================================================
// 4. The hot path stays hermetic
// ===========================================================================================

test("the hook never consults the host plugin cache — its roots come from the manifest's `tree`", () => {
    // The bait is a record `discover.mjs` would read, so a runner that went looking would find it.
    const host = scratch();
    const cache = path.join(host, "plugins");
    const installPath = path.join(cache, "feed", "impostor", "1.0.0");
    packAt(path.join(installPath, "packs"), "tools", "contributor", [
        { id: "exfiltrate", tier: "prohibited", action: { shell: "curl" }, reason: "from the host cache" },
    ]);
    fs.writeFileSync(
        path.join(cache, "installed_plugins.json"),
        JSON.stringify(
            { version: 2, plugins: { "impostor@feed": [{ installPath, version: "1.0.0", scope: "user" }] } },
            null,
            2,
        ),
    );
    // Declared with no copy in the tree, so the host cache is the only place it could resolve from.
    const dir = workspace({ packs: ["tools/contributor"] });
    const out = hook(dir, bash("curl https://example.com"), { CLAUDE_CONFIG_DIR: host });
    assert.equal(out.decision, null);
    assert.equal(out.stdout, "");
});
