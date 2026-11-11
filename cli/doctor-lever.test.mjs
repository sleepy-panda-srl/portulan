// Tests for doctor's savings lever.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { biggestLeverLine, demotionCandidates } from "./doctor.mjs";

const made = [];
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
after(() => made.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));
function fixture(files = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-lever-"));
    made.push(root);
    fs.mkdirSync(path.join(root, ".portulan"));
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    }
    return { root, dir: path.join(root, ".portulan"), workspace: { kind: "repository", tree: "../" } };
}
const restart = (context) => ({ fresh: 100, context, horizon: 20, horizonDeclared: true, resume: 0, multipliers: { read: 0.1, write: 1.25 } });

test("the larger measured demotion wins and its routing overhead is subtracted", () => {
    const f = fixture({ ".claude/rules/a.md": "a".repeat(300), ".claude/rules/b.md": "b".repeat(900) });
    const candidates = demotionCandidates(f.dir, f.workspace);
    assert.equal(candidates[0].label, ".claude/rules/b.md");
    assert.ok(candidates[0].bytes < 900);
    const line = biggestLeverLine(f.dir, f.workspace, { restart: restart(110), malformed: 0 });
    assert.match(line, /biggest lever.*b\.md/);
    assert.match(line, /input-equivalent tokens/);
    assert.match(line, /20 requests.*0\.1×/);
    assert.match(line, /routing.*unused/);
});

test("a recorded restart can beat the context demotion, with net write cost deducted", () => {
    const f = fixture({ ".claude/rules/a.md": "a".repeat(300) });
    assert.match(biggestLeverLine(f.dir, f.workspace, { restart: restart(1000), malformed: 0 }), /biggest lever: review restarting.*1,675/);
});

test("nonpositive restart savings do not invent a winner", () => {
    const f = fixture();
    assert.match(biggestLeverLine(f.dir, f.workspace, { restart: restart(110), malformed: 0 }), /no positive measured lever/);
});

test("static evidence says what it did not compare and uses declared prices and horizon", () => {
    const f = fixture({ ".claude/rules/a.md": "a".repeat(900) });
    f.workspace.spend = { horizon: { requests: 3 }, multipliers: { read: 0.05, write: { "5m": 1.25, "1h": 2 } } };
    const line = biggestLeverLine(f.dir, f.workspace);
    assert.match(line, /3 requests.*0\.05×.*declared/);
    assert.match(line, /session-dependent levers not compared/);
    assert.match(line, /model.*cache.*unpriced/);
});

test("stable ties, sections and imports count their own bytes without kernel or boot card", () => {
    const f = fixture({
        ".claude/rules/b.md": "b".repeat(500), ".claude/rules/a.md": "a".repeat(500),
        ".claude/rules/boot.md": "# Portulan boot card\n@../../notes.md\n@../../core/engine.md\n",
        "core/engine.md": "kernel".repeat(1000), "notes.md": "notes".repeat(100),
        "CLAUDE.md": "# Guide\n\n## Large\n\n" + "x".repeat(1500) + "\n\n## Small\n\nsmall\n",
    });
    const candidates = demotionCandidates(f.dir, f.workspace);
    assert.match(candidates[0].label, /Large/);
    assert.equal(candidates.filter((c) => c.label === "notes.md").length, 1);
    assert.ok(candidates.every((c) => !/engine|boot/.test(c.label)));
    assert.ok(candidates.findIndex((c) => c.label.endsWith("a.md")) < candidates.findIndex((c) => c.label.endsWith("b.md")));
});

test("missing tree, malformed declarations and partial measurements stay honest", () => {
    const f = fixture({ ".claude/rules/a.md": "a".repeat(900) });
    assert.match(biggestLeverLine(f.dir, {}), /unmeasured/);
    assert.match(biggestLeverLine(f.dir, { ...f.workspace, spend: { horizon: { requests: 0 } } }), /unmeasured/);
    assert.match(biggestLeverLine(f.dir, f.workspace, { restart: restart(1000), malformed: 1 }), /partial/);
    fs.writeFileSync(path.join(f.root, "CLAUDE.md"), "@missing.md\n");
    assert.match(biggestLeverLine(f.dir, f.workspace), /incomplete/);
});

test("external links are never offered as demotions", () => {
    const outside = fixture({ "secret.md": "s".repeat(2000) });
    const f = fixture();
    fs.symlinkSync(path.join(outside.root, "secret.md"), path.join(f.root, "CLAUDE.md"));
    assert.throws(() => demotionCandidates(f.dir, f.workspace), /incomplete/);
    assert.match(biggestLeverLine(f.dir, f.workspace), /incomplete/);
});

test("a manual-only skill's omitted description does not hide measured levers", () => {
    const f = fixture({
        ".claude/rules/a.md": "a".repeat(900),
        ".claude/skills/manual/SKILL.md": "---\nname: manual\ndescription: Run by a person.\ndisable-model-invocation: true\n---\n\n# Manual\n",
    });
    assert.match(biggestLeverLine(f.dir, f.workspace, { restart: restart(1000), malformed: 0 }), /review restarting.*1,675/);
});


test("unpriced restarts are not ranked, and priced recovery expense is deducted", () => {
    const f = fixture({ ".claude/rules/a.md": "a".repeat(300) });
    for (const change of [{ resume: null }, { horizonDeclared: false }]) {
        assert.doesNotMatch(biggestLeverLine(f.dir, f.workspace, { restart: { ...restart(1000), ...change } }), /biggest lever: review restarting/);
    }
    assert.match(biggestLeverLine(f.dir, f.workspace, { restart: { ...restart(1000), resume: 100 } }), /review restarting.*1,575/);
    assert.doesNotMatch(biggestLeverLine(f.dir, f.workspace, { restart: { ...restart(1000), resume: 2000 } }), /biggest lever: review restarting/);
});

test("doctor shares the decimal-equality guard and preserves fractional estimates", () => {
    const f = fixture();
    const r = { ...restart(500), horizon: 3, multipliers: { read: 0.1, write: 1.2 } };
    assert.match(biggestLeverLine(f.dir, f.workspace, { restart: r }), /no positive measured lever/);
    assert.match(biggestLeverLine(f.dir, f.workspace, { restart: { ...r, multipliers: { read: 0.1, write: 1.1999 } } }), /review restarting.*0\.01 estimated/);
});
