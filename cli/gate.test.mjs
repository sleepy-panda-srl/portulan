// The PreToolUse gate runner, driven as the host drives it.
//
// **Every case here spawns the real binary** — `node cli/gate.mjs`, payload on stdin, decision read
// off stdout — rather than importing `decide` and calling it. The choice is not ceremony. This file
// exists because `./gate.mjs` read the policy the workspace *declares* where `./compile.mjs` enforces
// the one it *yields* (`#269`), and the whole class of defect it belongs to is a component that reads
// correct and behaves otherwise once something real is wired to it. A unit test on `decide` would have
// passed on every day the hook was blind, because `decide` was never the part that was wrong: what was
// wrong was which rules reached it. So the rails are drawn around the process boundary the host actually
// uses. That is this file's own argument rather than a citation: a draft of this header attributed it to
// a standing sentence in `../.portulan/memory/`, and no record there carries one — it came from a
// session's notes, outside this repository. The nearest thing the tree does carry is `./gate.mjs`'s own
// header on `#131`, where paths resolved against the author's layout passed every reading and failed on
// the first machine that was not his.
//
// Until this file, `./gate.mjs` had no suite of its own; it was reached only through
// `./compile.test.mjs`'s assertions that the emitted settings *wire* it.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A HERMETIC HOST, for the reason ./compile.test.mjs states: the tools consult the host's
// installed-plugin record on the unasked path, so a suite that does not neutralise it reads the
// machine it runs on. It matters twice as much here — one case below asserts this runner never
// consults that record at all, and a test of that claim must not be the thing that supplies it.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(HERE, "gate.mjs");

// One exit handler for every scratch directory rather than one each — the per-directory form exceeds
// node's default listener limit partway through a suite and prints a warning, which trains a reader to
// skim warnings from a test run. Inherited from ./compile.test.mjs.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-gate-"));
    SCRATCH.push(dir);
    return dir;
}

/**
 * Run the hook exactly as the host does: one process, payload on stdin, decision on stdout.
 *
 * Returns `{ status, decision, reason, stdout }`, with `decision` null where the runner stepped aside.
 * A non-zero exit is reported rather than thrown, because *this runner never exits non-zero* is itself
 * one of the properties under test — a PreToolUse hook exiting 2 blocks the tool call.
 */
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
        stdout = error.stdout ?? "";
    }
    const out = stdout.trim() ? JSON.parse(stdout).hookSpecificOutput : null;
    return { status, stdout, decision: out?.permissionDecision ?? null, reason: out?.permissionDecisionReason ?? null };
}

const bash = (command) => ({ tool_name: "Bash", tool_input: { command } });

/** A policy declaring one rule of each tier that matters, so composition has something to sit beside. */
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

/**
 * A workspace on disk. `packs` is written to the manifest verbatim, INCLUDING `undefined` — which
 * `JSON.stringify` drops, giving the no-key shape a declared-only workspace really has, rather than an
 * empty array standing in for it. The two are different fixtures and one case below needs both.
 */
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

/** A workspace whose one declared pack contributes the given fragments. */
const composing = (fragments, rules) => workspace({ rules, packs: ["tools/contributor"], fragments });

// ===========================================================================================
// 1. The policy the workspace YIELDS — #269
// ===========================================================================================
//
// The measurement that opened the issue, as a rail. On the file this change replaces, every case in
// this section produced ZERO BYTES of output: the runner walked the declared rules, found nothing, and
// stepped aside on actions the compiled artifact beside it gates.

describe("the hook reads the policy the workspace yields, not the one it declares", () => {
    test("a pack-ADDED `prohibited` rule with a real matcher is DENIED", () => {
        const dir = composing([
            { id: "exfiltrate", tier: "prohibited", action: { shell: "curl" }, reason: "no network from a tool call" },
        ]);
        const out = hook(dir, bash("curl https://example.com"));
        assert.equal(out.decision, "deny");
        // The rule's own sentence reaches the agent, which is this layer's entire job — and for a
        // composed rule it never had. Asserted on the text rather than only on the decision, because
        // "denied with the wrong reason" is the shape a later refactor would produce.
        assert.match(out.reason, /PORTULAN GATE `exfiltrate` \(prohibited\) — no network from a tool call/);
    });

    test("...and through a shell WRAPPER, which is the surface where this layer is the only one", () => {
        // The sharpest case, and the reason it is separated from the one above. Where the spelling is
        // plain, the compiled `deny` permission rule matches too and the host discards this runner's
        // answer — so a plain-spelling rail proves the decision and not the coverage. `bash -c "…"` is
        // invisible to a `Bash(curl:*)` prefix pattern by measurement (../.portulan/gate-map.md, hole
        // 1), so here the hook IS the gate, and before this change a composed prohibition had no layer
        // at all on this spelling.
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
        // Not a missing rule but a contradicted one: the runner had the id and answered with the wrong
        // tier, so this arm of #269 is a hook that actively disagrees with the artifact beside it.
        const dir = composing([
            { id: "push", tier: "prohibited", action: { shell: "git push" }, reason: "this pack forbids pushing" },
        ]);
        const out = hook(dir, bash("git push origin main"));
        assert.equal(out.decision, "deny");
        assert.match(out.reason, /\(prohibited\) — this pack forbids pushing/);
    });

    test("a pack TIGHTENING `propose` → `gated` is asked, where the declared tier is not gate machinery at all", () => {
        // `propose` is enforced by the platform floor and skipped by this runner's tier filter, so
        // before composition a tightened `propose` rule was invisible for a second, independent reason.
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
        // The ordering half of #269, and the case that decides whether the fix is whole. Composition
        // APPENDS added rules after the workspace's own, so a first-match scan returns the declared
        // `gated` rule and answers `ask` on an action the policy prohibits — the composed rule present,
        // reached, and outvoted by its position in the list.
        const dir = composing([
            { id: "mirror", tier: "prohibited", action: { shell: "git push --mirror" }, reason: "rewrites every ref" },
        ]);
        const out = hook(dir, bash("git push --mirror origin"));
        assert.equal(out.decision, "deny");
        assert.match(out.reason, /`mirror` \(prohibited\) — rewrites every ref/);
        // The broader rule still answers for the spellings only it covers.
        assert.equal(hook(dir, bash("git push origin main")).decision, "ask");
    });

    test("a DECLARED-ONLY policy diverges too, where the weaker rule is listed first", () => {
        // The behaviour change this carries, pinned rather than buried. First-match was never the same
        // thing as strongest — a single-file policy listing `git push` gated before `git push --mirror`
        // prohibited answered `ask` on the prohibited spelling, with no pack anywhere. Composition makes
        // the divergence systematic (added rules are appended, so a contributed rule always loses the
        // tie-break) rather than causing it. A draft of `./gate.mjs`'s docblock claimed the opposite and
        // called the old scan indistinguishable from this one for a single-file policy; the pre-commit
        // supervisor built this counterexample, so it is a rail now instead of a sentence.
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
        // The stability half. "Strongest, ties to the first" is only byte-identical to the old
        // behaviour if ties are actually left alone, and nothing but this case says so.
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
    // The property that made this change safe to land first, so it is asserted rather than argued: a
    // declared-only workspace must not take a different branch. Both shapes, because a missing `packs`
    // key and an empty one leave `packContributions` at different early returns.
    for (const [label, packs] of [
        ["no `packs` key at all", undefined],
        ["`packs: []`", []],
    ]) {
        test(`${label} — the declared rules answer, and nothing else appears`, () => {
            const dir = workspace({ packs });
            assert.equal(hook(dir, bash("git push origin main")).decision, "ask");
            assert.match(hook(dir, bash("git push origin main")).reason, /`push` \(gated\) — ask first/);
            assert.equal(hook(dir, { tool_name: "Edit", tool_input: { file_path: "/x/docs/vision.md" } }).decision, "deny");
            // Stepping aside is still silence on stdout, not an empty JSON object.
            assert.equal(hook(dir, bash("echo hi")).stdout, "");
            assert.equal(hook(dir, bash("echo hi")).status, 0);
        });
    }

    test("a composed `action: none` fragment composes cleanly and matches nothing", () => {
        // **The live shape on this repository**, which no other case here uses: both fragments
        // `rituals/checkpoints` contributes carry `action: {none: …}`, the form the ruling in
        // `../.portulan/proposals/0029-a-constraint-names-a-category-not-a-list.md` Q3 settled on for a
        // category whose spellings are unbounded. `matchesRule` answers `shell`/`write`/`read` and
        // returns false for anything else, so such a rule reaches `decide` and matches nothing — the
        // reason #269 was latent here rather than live. Pinned so that a later matcher change cannot
        // quietly give a `none` rule reach, and so that composing one is known not to throw.
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
        // A pack demoting a rule is refused by `composeFragments`, which throws. Were that throw to
        // reach the top of `main()`, this runner would step aside — and a malformed or hostile
        // `pack.json` would switch off the gates the workspace declares in its own file. The composed
        // half is lost; the declared half must not be.
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

    test("a pack manifest that is not readable JSON also falls back rather than blocking", () => {
        const dir = composing([{ id: "x", tier: "gated", action: { shell: "curl" }, reason: "r" }]);
        fs.writeFileSync(path.join(dir, "packs", "tools", "contributor", "pack.json"), "{ not json");
        const out = hook(dir, bash("git push origin main"));
        assert.equal(out.decision, "ask");
        assert.equal(out.status, 0);
    });

    test("an unreadable POLICY still steps aside silently — the fail-open this change does not touch", () => {
        // `./gate.mjs`'s header argues this from a measurement: on CLI 2.1.220 a PreToolUse hook that
        // crashes fails open anyway, and a runner that blocked on a malformed policy would make the
        // session undriveable — repairable only inside the repository it can no longer edit.
        // `./stop-gate.mjs` is the runner that blocks loudly; these two genuinely differ.
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
    // Composition enters a path that runs on EVERY tool call, and `packContributions` can be wired to
    // discovery. It is not wired here, and this is the rail on that: a host record naming a root that
    // WOULD contribute a matching prohibition must change no decision. Two things ride on it — a gate
    // whose answer moved with what is installed on the machine could not be reviewed from the
    // repository, and `#264` (an unpinned compile reads the host plugin cache while the rail reads the
    // tree) stays out of this runner by construction rather than by nobody having tried.
    // **The poison has to be shaped like the real record, and the first draft of this test was not.**
    // It wrote `plugins/installs.json` at `version: 1` with an `installs` ARRAY — three independent
    // mismatches against `./discover.mjs`, which reads `plugins/installed_plugins.json` (`RECORD`),
    // refuses any version outside `RECORD_VERSIONS` (`{2}`), and wants a `plugins` OBJECT keyed
    // `<plugin>@<marketplace>` whose entries carry `installPath`. So the record was unreadable and the
    // test passed on a fixture that could not have been picked up even by a runner that went looking —
    // a rail green because its own bait was inert. Caught by the pre-commit supervisor, which wired
    // discovery into the runner and watched this suite stay 14/14 green: the exact regression this
    // case names itself the rail against, undetected. Guarding the instrument before trusting it is
    // this repository's standing rule about its own tests, and this is what it looks like when skipped.
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
    // The workspace declares the pack and has NO copy of it in its own tree, so the host cache is the
    // only place it could come from. It must stay unresolved.
    const dir = workspace({ packs: ["tools/contributor"] });
    const out = hook(dir, bash("curl https://example.com"), { CLAUDE_CONFIG_DIR: host });
    assert.equal(out.decision, null);
    assert.equal(out.stdout, "");
});
