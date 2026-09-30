// Tests for `fuzz-shell` — the hermetic half: its payloads are gated commands, so nothing here spawns bash or runs one.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The imports reach `./compile.mjs`, which can read the host's installed-plugin record: point it at none.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import { DEFAULT_CASES, DEFAULT_SEED, EXPECT, PAYLOADS, POSITIONS, WRITERS, asCase, correctFor, generate, groundFor, hash, pathSpellings, prng, run, writePayload } from "./fuzz-shell.mjs";
import { CLASSES, PATHS, grade, readCorpus, yieldedRules } from "./goldens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");

const sink = () => {
    const lines = [];
    return { write: (s) => lines.push(s), text: () => lines.join("") };
};

test("the generator is deterministic for a fixed seed, and different for a different one", () => {
    const draw = (seed) => {
        const rand = prng(seed);
        return POSITIONS.map((p) => generate(p, "shell", rand).command);
    };
    assert.deepEqual(draw(7), draw(7));
    assert.notDeepEqual(draw(7), draw(8));
});

test("no two cells share a random stream, and the rule is asserted rather than the instance", () => {
    const seeds = new Map();
    for (const position of POSITIONS) {
        for (const kind of Object.keys(PAYLOADS)) {
            const key = `${position.id}|${kind}`;
            const derived = DEFAULT_SEED ^ hash(key);
            assert.ok(!seeds.has(derived), `${key} and ${seeds.get(derived)} derive the same stream`);
            seeds.set(derived, key);
        }
    }
    const draw = (key) => {
        const rand = prng(DEFAULT_SEED ^ hash(key));
        return Array.from({ length: 8 }, () => generate(POSITIONS[0], "shell", rand).command);
    };
    assert.notDeepEqual(draw("a|shell"), draw("b|shell"));
    assert.deepEqual(draw("a|shell"), draw("a|shell"), "the same cell must still be reproducible");
});

test("the recorded table is total over the grammar, in both directions", () => {
    const keys = new Set(Object.keys(EXPECT));
    for (const position of POSITIONS) {
        for (const kind of Object.keys(PAYLOADS)) {
            const key = `${position.id}|${kind}`;
            assert.ok(keys.delete(key), `EXPECT records no answer for ${key}`);
        }
    }
    assert.deepEqual([...keys], [], "EXPECT records cells POSITIONS does not generate");
});

test("every recorded divergence from ground truth names a record", () => {
    for (const [key, e] of Object.entries(EXPECT)) {
        const [positionId, kind] = key.split("|");
        const position = POSITIONS.find((p) => p.id === positionId);
        // Checked here too: a failing totality test does not stop this one, which would then throw in `groundFor`.
        assert.ok(position, `EXPECT records ${key}, and POSITIONS declares no position \`${positionId}\``);
        assert.ok(Object.keys(PAYLOADS).includes(kind), `EXPECT records ${key}, and PAYLOADS declares no kind \`${kind}\``);
        // Through `groundFor`, not `position.ground`, which misses a per-kind override.
        const ground = groundFor(position, kind);
        if (e.answer === correctFor(ground)) {
            assert.equal(e.record, undefined, `${key} agrees with ground truth and cites a record anyway`);
            continue;
        }
        assert.ok(typeof e.record === "string" && e.record.trim() !== "", `${key} diverges and names no record`);
        assert.ok(typeof e.why === "string" && e.why.trim().length > 20, `${key} diverges and carries no readable reason`);
    }
});

test("every position id is unique and every payload names a rule", () => {
    const ids = POSITIONS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const p of Object.values(PAYLOADS)) assert.match(p.rule, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const kind of Object.keys(PAYLOADS)) {
        if (kind === "shell") continue;
        assert.ok(Array.isArray(WRITERS[kind]) && WRITERS[kind].length > 0, `${kind} has no writer shapes`);
    }
});

test("a generated write payload never quotes a line continuation, and always names the path", () => {
    // Inside single quotes a backslash-newline is two literal characters, not a continuation.
    const rand = prng(11);
    let sawContinuation = 0;
    for (let i = 0; i < 2000; i += 1) {
        for (const kind of ["write-redirect", "write-named"]) {
            const payload = writePayload(rand, kind);
            if (!payload.includes("\\\n")) continue;
            sawContinuation += 1;
            assert.ok(!payload.includes("'"), `a continuation was quoted: ${JSON.stringify(payload)}`);
        }
    }
    assert.ok(sawContinuation > 0, "no continuation spelling was generated in 2000 draws");
    for (const s of pathSpellings("docs/vision.md")) assert.ok(s.includes("vision.md"), s);
});

test("every payload kind emits a case goldens' OWN reader accepts, not just the shell one", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-emit-"));
    try {
        const { rules } = yieldedRules(REPO, { packRoots: [join(REPO, "packs")] });
        const gates = path.join(dir, "gates");
        fs.mkdirSync(gates, { recursive: true });
        const byRule = new Map();
        for (const kind of Object.keys(PAYLOADS)) {
            const position = POSITIONS.find((p) => p.id === "bare");
            assert.ok(position, "the `bare` position is gone — this case is measuring nothing");
            const rand = prng(5);
            const { command } = generate(position, kind, rand);
            const { _rule, ...body } = asCase(position, kind, PAYLOADS[kind].rule, command, true, 0);
            const list = byRule.get(PAYLOADS[kind].rule) ?? [];
            list.push({ ...body, id: `${body.id}-${kind}` });
            byRule.set(PAYLOADS[kind].rule, list);
        }
        for (const [rule, cases] of byRule) {
            fs.writeFileSync(path.join(gates, `${rule}.json`), JSON.stringify({ rule, why: "generated by the fuzzer", cases }), "utf8");
        }
        const corpus = readCorpus(dir, "gates");
        const { findings } = grade(rules, corpus);
        // Coverage findings are expected: this scratch corpus attacks two rules, not the whole policy.
        const mislabels = findings.filter((f) => /declares path/.test(f.what));
        assert.deepEqual(mislabels, [], "an emitted case carries a path goldens would refuse");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("a finding renders as a corpus case the goldens runner would accept", () => {
    const position = POSITIONS.find((p) => p.id === "bare");
    assert.ok(position, "the `bare` position is gone — this case is measuring nothing");
    const body = asCase(position, "shell", PAYLOADS.shell.rule, "git push --force origin main", true, 3);
    assert.ok(CLASSES.includes(body.class));
    assert.ok(PATHS.includes(body.path));
    assert.equal(typeof body.expect, "boolean");
    assert.ok(body.why.includes("REVIEW THIS BEFORE COMMITTING IT"));
    assert.deepEqual(Object.keys(body.input), ["command"]);
    const escaping = asCase(position, "shell", PAYLOADS.shell.rule, "x", false, 4);
    assert.equal(escaping.class, "documented-hole");
    assert.match(escaping.hole, /UNRECORDED/);
});

test("the fuzzer runs green against this repository and prints its seed on the green", async () => {
    const out = sink();
    const err = sink();
    assert.equal(run(["--workspace", REPO, "--pack-root", join(REPO, "packs"), "--check"], { stdout: out, stderr: err, cwd: REPO }), 0, err.text());
    assert.match(out.text(), new RegExp(`seed ${DEFAULT_SEED}`));
    assert.match(out.text(), new RegExp(`${DEFAULT_CASES} spelling`));
});

test("a bad --seed or --cases is refused rather than coerced", async () => {
    for (const argv of [["--seed", "abc"], ["--cases", "12x"], ["--seed"], ["--cases", "0"]]) {
        const err = sink();
        const code = run(["--workspace", REPO, "--pack-root", join(REPO, "packs"), ...argv], { stdout: sink(), stderr: err, cwd: REPO });
        assert.equal(code, 2, `${argv.join(" ")} was not refused`);
        assert.match(err.text(), /needs a non-negative integer|would generate nothing/);
    }
});

test("a workspace whose policy does not declare a payload's rule is could-not-run", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-fuzz-ws-"));
    try {
        fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
        fs.writeFileSync(
            path.join(dir, ".portulan", "gates.json"),
            JSON.stringify({ portulan: { spec: "2.2" }, why: "x", rules: [{ id: "unrelated", tier: "gated", action: { shell: "gh repo delete" }, reason: "x" }] }),
            "utf8",
        );
        fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), JSON.stringify({ portulan: { spec: "2.8" }, name: "x", summary: "x", kind: "repository", gates: "gates.json", slots: {} }), "utf8");
        const err = sink();
        assert.equal(run(["--workspace", dir], { stdout: sink(), stderr: err, cwd: dir }), 2);
        assert.match(err.text(), /the yielded policy does not declare|half this fuzzer has nothing to attack/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("this module reaches no process-spawning API", () => {
    const text = fs.readFileSync(join(REPO, "cli", "fuzz-shell.mjs"), "utf8");
    for (const forbidden of ["child_process", "execSync", "execFileSync", "spawnSync", "node:vm"]) {
        assert.ok(!text.includes(forbidden), `cli/fuzz-shell.mjs reaches ${forbidden}`);
    }
});

test("the entry guard survives a path containing a space", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan fuzz guard-"));
    try {
        const copy = path.join(dir, "fuzz-shell.mjs");
        const src = fs
            .readFileSync(join(REPO, "cli", "fuzz-shell.mjs"), "utf8")
            .replace(/from "\.\/([A-Za-z0-9._-]+\.mjs)"/g, (_, name) => `from "${new URL(`file://${join(REPO, "cli", name).split(path.sep).join("/")}`).href.replace(/ /g, "%20")}"`);
        fs.writeFileSync(copy, src, "utf8");
        const text = execFileSync(process.execPath, [copy, "--help"], { encoding: "utf8" });
        assert.match(text, /usage: node cli\/fuzz-shell\.mjs/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
