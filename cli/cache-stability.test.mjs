// Cache-prefix tests.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inventory, check, volatileTokens, run, GOLDEN } from "./cache-stability.mjs";

const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
const made = [];
after(() => made.forEach((r) => fs.rmSync(r, { recursive: true, force: true })));
function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-prefix-"));
    made.push(root);
    const files = {
        ".claude/rules/boot.md": "# Portulan boot card\n\n@../../core/engine.md\n",
        "core/engine.md": "# Portulan engine\n\nA stable kernel.\n",
        ".claude/settings.json": JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: 'node "${CLAUDE_PROJECT_DIR}/cli/stop-gate.mjs"' }] }] } }),
        ".portulan/workspace.json": JSON.stringify({ tree: "../", gates: "gates.json", packs: ["tools/fixture"] }),
        ".portulan/gates.json": JSON.stringify({ portulan: { spec: "2.2" }, rules: [{ id: "fixture-gate", tier: "gated", action: { shell: "git merge" }, reason: "Ask for review." }] }),
        "packs/tools/fixture/pack.json": JSON.stringify({ name: "fixture", category: "tools", contributes: { gates: [{ id: "added-gate", tier: "gated", action: { shell: "git push" }, reason: "Review this too." }] } }),
        "cli/gate.mjs": 'export const text = "Ask for review.";\n',
        "cli/stop-gate.mjs": 'export const text = "A stable refusal.";\n',
        "cli/advisory.mjs": 'export const text = "A stable advisory.";\n',
    };
    for (const [rel, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), text);
    }
    fs.mkdirSync(path.join(root, "evals"));
    fs.writeFileSync(path.join(root, GOLDEN), JSON.stringify(inventory(root), null, 2) + "\n");
    return root;
}

test("coverage contains imports, all hook runners, compiled hooks and gate inputs", () => {
    const root = fixture();
    assert.deepEqual(inventory(root).surfaces.map((s) => s.id).sort(), [
        "always:.claude/rules/boot.md", "always:core/engine.md", "hook:cli/advisory.mjs",
        "hook:cli/gate.mjs", "hook:cli/stop-gate.mjs", "hook-commands:.claude/settings.json",
        "gate-input:.portulan/gates.json", "gate-input:packs/tools/fixture/pack.json",
        "gate-selection:.portulan/workspace.json",
    ].sort());
    assert.deepEqual(check(root), []);
});

test("lexical inventory identifies dates, hashes, ids, absolute paths and counts", () => {
    const hits = volatileTokens("2026-11-09 abc123def 123e4567-e89b-12d3-a456-426614174000 /Users/example/work 17 tokens");
    for (const kind of ["date", "hash", "id", "path", "count"]) assert.ok(hits.some((h) => h.kind === kind), kind);
});

for (const rel of [".claude/rules/boot.md", "cli/advisory.mjs", ".portulan/gates.json", "packs/tools/fixture/pack.json"]) {
    test(`volatile insertion in ${rel} reds an untouched golden`, () => {
        const root = fixture();
        const before = fs.readFileSync(path.join(root, GOLDEN));
        const file = path.join(root, rel);
        const text = fs.readFileSync(file, "utf8");
        fs.writeFileSync(file, rel.endsWith(".json") ? text.replace("review", "review on 2026-11-09") : text + "\n2026-11-09 /tmp/prefix 37 tokens abc123def\n");
        if (rel.endsWith("pack.json")) fs.writeFileSync(file, text.replace("Review", "Review on 2026-11-09"));
        assert.ok(check(root).length);
        assert.deepEqual(fs.readFileSync(path.join(root, GOLDEN)), before);
        fs.writeFileSync(file, text);
        assert.deepEqual(check(root), []);
    });
}

test("digest catches benign drift and volatile spellings outside the recognizer", () => {
    const root = fixture();
    for (const text of ["another sentence", "session key zzzzzzz"]) {
        assert.equal(volatileTokens(text).length, 0);
        fs.appendFileSync(path.join(root, "cli/gate.mjs"), text);
        assert.ok(check(root).length);
    }
});

test("surface additions and removals cannot disappear into a green", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, ".claude/rules/new.md"), "New always rule.\n");
    assert.ok(check(root).some((s) => s.includes("new.md")));
    fs.rmSync(path.join(root, ".claude/rules/new.md"));
    fs.rmSync(path.join(root, ".claude/rules/boot.md"));
    assert.throws(() => inventory(root), /always/);
});

test("missing, malformed and duplicate golden records refuse; refresh is explicit", () => {
    const root = fixture();
    const golden = path.join(root, GOLDEN);
    fs.rmSync(golden);
    assert.throws(() => check(root));
    fs.writeFileSync(golden, "{}");
    assert.throws(() => check(root), /golden/);
    const captured = inventory(root);
    captured.surfaces.push(captured.surfaces[0]);
    fs.writeFileSync(golden, JSON.stringify(captured));
    assert.throws(() => check(root), /duplicate/);
    assert.equal(run(["--write-golden", root], () => {}), 2);
    fs.rmSync(golden);
    assert.equal(run(["--write-golden", root], () => {}), 0);
    assert.deepEqual(check(root), []);
});

for (const what of ["escape", "hooks-array", "event-string", "empty-group", "null-rule", "duplicate-rule", "null-fragment"]) {
    test(`${what} refuses both checking and refresh`, () => {
        const root = fixture();
        const edit = (rel, change) => {
            const file = path.join(root, rel), parsed = JSON.parse(fs.readFileSync(file, "utf8"));
            fs.writeFileSync(file, JSON.stringify(change(parsed)));
        };
        if (what === "escape") {
            fs.copyFileSync(path.join(root, ".portulan/gates.json"), path.join(root, "other.json"));
            edit(".portulan/workspace.json", (m) => ({ ...m, gates: "../other.json" }));
        }
        if (what === "hooks-array") edit(".claude/settings.json", (s) => ({ ...s, hooks: [{ command: "echo text" }] }));
        if (what === "event-string") edit(".claude/settings.json", (s) => ({ ...s, hooks: { Stop: "echo text" } }));
        if (what === "empty-group") edit(".claude/settings.json", (s) => ({ ...s, hooks: { Stop: [{}] } }));
        if (what === "null-rule") edit(".portulan/gates.json", (p) => ({ ...p, rules: [null] }));
        if (what === "duplicate-rule") edit(".portulan/gates.json", (p) => ({ ...p, rules: [p.rules[0], p.rules[0]] }));
        if (what === "null-fragment") edit("packs/tools/fixture/pack.json", (p) => ({ ...p, contributes: { gates: [null] } }));
        assert.throws(() => inventory(root), undefined, what);
        assert.equal(run(["--write-golden", root], () => {}), 2, what);
        assert.equal(run([root], () => {}), 2, what);
    });
}

test("incomplete inputs refuse both checking and refreshing", () => {
    for (const what of ["hook", "import", "pack", "external"]) {
        const root = fixture();
        if (what === "hook") fs.rmSync(path.join(root, "cli/gate.mjs"));
        if (what === "import") fs.appendFileSync(path.join(root, ".claude/rules/boot.md"), "\n@missing.md\n");
        if (what === "pack") fs.rmSync(path.join(root, "packs/tools/fixture/pack.json"));
        if (what === "external") {
            fs.rmSync(path.join(root, "cli/gate.mjs"));
            fs.symlinkSync(path.join(fixture(), "cli/gate.mjs"), path.join(root, "cli/gate.mjs"));
        }
        assert.throws(() => inventory(root));
        assert.equal(run(["--write-golden", root], () => {}), 2);
    }
});

test("a golden linked outside the repository cannot be read or overwritten", () => {
    const root = fixture(), outside = fixture();
    const external = path.join(outside, GOLDEN), before = fs.readFileSync(external);
    fs.rmSync(path.join(root, GOLDEN));
    fs.symlinkSync(external, path.join(root, GOLDEN));
    assert.throws(() => check(root), /outside/);
    assert.equal(run(["--write-golden", root], () => {}), 2);
    assert.deepEqual(fs.readFileSync(external), before);
});

test("the digest preserves bytes outside valid UTF-8", () => {
    const root = fixture(), file = path.join(root, "cli/gate.mjs");
    fs.writeFileSync(file, Buffer.from([255]));
    run(["--write-golden", root], () => {});
    fs.writeFileSync(file, Buffer.from([254]));
    assert.ok(check(root).length);
});
