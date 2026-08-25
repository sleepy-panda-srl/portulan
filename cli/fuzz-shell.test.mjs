// The grammar-fuzzer rail's suite — the hermetic half.
//
// The other half is ./fuzz-shell.ground.test.mjs, which runs real bash. The split is deliberate: this
// file must never execute a GENERATED PAYLOAD and must never spawn bash, because the payloads it
// handles are a gated force-push and a write to the constitution; the ground-truth file spawns bash
// and only ever runs a NEUTRAL payload.
//
// _It said "must never execute anything", which is false of this file: the entry-guard case runs a
// copy of the module under `execFileSync` with `--help`. A comment describing a stricter rule than
// the file keeps is the defect this whole pull request is about, met in the file's own header.
// Reported by Copilot on #338._
//
// What is asserted here is the part a green would otherwise let a reader assume: that the generator
// is deterministic, that its budget is real, that the recorded table is total in both directions, and
// that a divergence with no record is refused rather than tolerated.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// A HERMETIC HOST, the three-line block `pinned-roots.live.test.mjs` sweeps for — asserted WHOLE, so
// that copying the two lines which neutralise the host and dropping the one that tidies up is caught.
// This suite reaches `compile.mjs`, which consults the host's installed-plugin record on the unasked
// path, so without it a verdict would move with what somebody has installed.
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
    // **The defect this replaces was a claim broader than its code**: the seed mixed in
    // `position.id.length` and `kind.length`, so most of the grammar shared a stream with another
    // position while the comment beside it promised each cell its own. Reported by Copilot, round 1
    // on #338; the figures for that measurement are dated in the session's handoff.
    //
    // Asserted as the RULE — every cell's derived seed is distinct — rather than as the two ids that
    // happened to collide. Patching the spelling that was quoted is the class this repository met
    // five times on #336 and twice more in this session's own code.
    const seeds = new Map();
    for (const position of POSITIONS) {
        for (const kind of Object.keys(PAYLOADS)) {
            const key = `${position.id}|${kind}`;
            const derived = DEFAULT_SEED ^ hash(key);
            assert.ok(!seeds.has(derived), `${key} and ${seeds.get(derived)} derive the same stream`);
            seeds.set(derived, key);
        }
    }
    // And the streams really differ, not just their seeds: two cells drawing from the same position
    // must not produce the same spellings.
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
    // The rail that stops the table absorbing a new hole silently: an entry may disagree with what
    // its position's ground truth demands only by citing where that disagreement is written down.
    for (const [key, e] of Object.entries(EXPECT)) {
        const position = POSITIONS.find((p) => p.id === key.split("|")[0]);
        // Through `groundFor`, not `position.ground` — one production's truth is per payload kind, and
        // reading the position's field alone reported a TRUE POSITIVE as an undocumented divergence.
        // The runner was routed through `groundFor` and this test was not: one carrier corrected and
        // its sibling left, which is the class this pull request keeps meeting. Caught by the rail.
        const ground = groundFor(position, key.split("|")[1]);
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
    // The guard lives in `writePayload`, not in `respell`, and this asserts it where it lives. Inside
    // `\'…\'` a backslash-newline is two literal characters rather than a continuation, so quoting one
    // would make the generator lie about its own ground truth — the one failure a fuzzer cannot detect
    // in itself, because its oracle would be wrong in the same direction as its output.
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
    // The rail's own rail: an assertion that never fires because the branch is never generated is an
    // assertion nobody has run.
    assert.ok(sawContinuation > 0, "no continuation spelling was generated in 2000 draws");
    for (const s of pathSpellings("docs/vision.md")) assert.ok(s.includes("vision.md"), s);
});

test("every payload kind emits a case goldens' OWN reader accepts, not just the shell one", () => {
    // **Asserted for all three kinds, because the drill that printed a finding used the shell payload
    // and the two write payloads were broken.** `asCase` handed `matcherPath` a PAYLOAD kind, which it
    // does not know, so both write kinds emitted `path: "no-branch"` and `goldens` would have refused
    // them as a mislabel — the paste-ready promise false for two of three. A check written alongside a
    // change inheriting the change's blind spot; reported by Copilot on #338.
    //
    // Graded against `readCorpus` and `grade` themselves rather than against a re-implementation of
    // what they accept, which is the whole reason `goldens.mjs` exports them.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-emit-"));
    try {
        const { rules } = yieldedRules(REPO, { packRoots: [join(REPO, "packs")] });
        const gates = path.join(dir, "gates");
        fs.mkdirSync(gates, { recursive: true });
        const byRule = new Map();
        for (const kind of Object.keys(PAYLOADS)) {
            const position = POSITIONS.find((p) => p.id === "bare");
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
        // Only coverage findings may remain — this scratch corpus deliberately attacks two rules and
        // not the whole policy. A MISLABEL finding is the defect under test.
        const mislabels = findings.filter((f) => /declares path/.test(f.what));
        assert.deepEqual(mislabels, [], "an emitted case carries a path goldens would refuse");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("a finding renders as a corpus case the goldens runner would accept", () => {
    const position = POSITIONS.find((p) => p.id === "bare");
    const body = asCase(position, "shell", PAYLOADS.shell.rule, "git push --force origin main", true, 3);
    assert.ok(CLASSES.includes(body.class));
    assert.ok(PATHS.includes(body.path));
    assert.equal(typeof body.expect, "boolean");
    assert.ok(body.why.includes("REVIEW THIS BEFORE COMMITTING IT"));
    assert.deepEqual(Object.keys(body.input), ["command"]);
    // A generated case that disagrees with ground truth must arrive marked as needing a record, not
    // silently as a `holds` pin — a fixture that records a bypass as normal is how a hole becomes
    // permanent.
    const escaping = asCase(position, "shell", PAYLOADS.shell.rule, "x", false, 4);
    assert.equal(escaping.class, "documented-hole");
    assert.match(escaping.hole, /UNRECORDED/);
});

test("the fuzzer runs green against this repository and prints its seed on the green", async () => {
    const out = sink();
    const err = sink();
    assert.equal(run(["--workspace", REPO, "--pack-root", join(REPO, "packs"), "--check"], { stdout: out, stderr: err, cwd: REPO }), 0, err.text());
    // Printed on a GREEN, not only on a red: a green nobody can reproduce is a green nobody can audit.
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
    // `Number("")` is 0 and `Number("12abc")` is NaN; a fuzzer silently running zero cases and
    // reporting green is the false green this whole module is written against.
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
