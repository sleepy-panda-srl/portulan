// Tests for `fuzz-shell`'s ground truth, measured under real bash: each production's position, the path spellings, the wrappers.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The imports reach `./compile.mjs`, which can read the host's installed-plugin record: point it at none.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import { EFFECT, POSITIONS, groundFor, pathSpellings, prng, respell } from "./fuzz-shell.mjs";

// Neutral, because this file runs bash; read from the file it writes, because an echo of its text fools stdout.
const NEUTRAL = "printf ok > portulan.marker";
const MARKER = "portulan.marker";

function ran(script, cwd, { exitsNonZero = false } = {}) {
    const marker = path.join(cwd, MARKER);
    fs.rmSync(marker, { force: true });
    const result = spawnSync("bash", ["-c", script], { cwd, encoding: "utf8", timeout: 10_000, env: { PATH: process.env.PATH ?? "" } });
    assert.equal(result.error, undefined, `bash did not run: ${result.error?.message}`);
    // Before either branch: a killed child's `status` is `null`, which the `exitsNonZero` branch would take as non-zero.
    assert.equal(result.signal, null, `bash was killed by ${result.signal} running ${JSON.stringify(script)} — nothing was measured`);
    assert.equal(typeof result.status, "number", `bash produced no exit status running ${JSON.stringify(script)} — nothing was measured`);
    if (!exitsNonZero) {
        assert.equal(
            result.status,
            0,
            `bash exited ${result.status} running ${JSON.stringify(script)} — a failed script measures nothing about ` +
                `where the payload sat: ${result.stderr}`,
        );
    } else {
        assert.notEqual(result.status, 0, `${JSON.stringify(script)} declares exitsNonZero and bash exited 0 — the production's own claim is stale`);
    }
    // `touched` as well as `ran`: bash applies a redirection before it looks the command up, so a failing fragment still truncates.
    const exists = fs.existsSync(marker);
    const reading = { ran: exists && fs.readFileSync(marker, "utf8") === "ok", touched: exists };
    fs.rmSync(marker, { force: true });
    return reading;
}

test("every production's declared position is what bash actually does", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-ground-"));
    try {
        const skipped = [];
        for (const position of POSITIONS) {
            if (position.bashSafe === false) {
                assert.ok(typeof position.why === "string" && position.why.trim().length > 20, `${position.id} is unmeasured and argues nothing`);
                skipped.push(position.id);
                continue;
            }
            if (position.exitsNonZero === true) {
                assert.ok(typeof position.why === "string" && position.why.trim().length > 20, `${position.id} declares exitsNonZero and argues nothing`);
            }
            const reading = ran(position.build(NEUTRAL), dir, { exitsNonZero: position.exitsNonZero === true });
            for (const [kind, effect] of Object.entries(EFFECT)) {
                const actual = reading[effect];
                const ground = groundFor(position, kind);
                assert.equal(
                    actual,
                    ground === "command",
                    `production \`${position.id}\` declares ground=${ground} for a ${kind} payload, and bash ` +
                        `${actual ? "DID" : "did not"} ${effect === "ran" ? "run the payload" : "touch the target"}. ` +
                        `The fuzzer's oracle is this declaration, so a wrong one produces a green about the wrong thing`,
                );
            }
        }
        console.log(`ground: measured ${POSITIONS.length - skipped.length} position(s) under bash; unmeasured: ${skipped.join(", ") || "none"}`);
        assert.deepEqual(skipped, ["sudo-prefix"], "the unmeasured set changed — re-read why each member is in it");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("every path spelling names one file, measured by writing to it", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-paths-"));
    try {
        // Bash resolves a `..` hop against the filesystem, so `docs/sibling/../vision.md` needs `sibling` to exist.
        fs.mkdirSync(path.join(dir, "docs", "sibling"), { recursive: true });
        const target = path.join(dir, "docs", "vision.md");
        for (const spelling of pathSpellings("docs/vision.md")) {
            fs.rmSync(target, { force: true });
            const script = `printf ok > ${spelling}`;
            const result = spawnSync("bash", ["-c", script], { cwd: dir, encoding: "utf8", timeout: 10_000, env: { PATH: process.env.PATH ?? "" } });
            assert.equal(result.signal, null, `bash was killed by ${result.signal} running ${JSON.stringify(script)} — nothing was measured`);
            assert.equal(result.status, 0, `bash refused ${JSON.stringify(spelling)}: ${result.stderr}`);
            assert.ok(
                fs.existsSync(target),
                `the spelling ${JSON.stringify(spelling)} did not write docs/vision.md — the generator believes these all name one file and bash disagrees`,
            );
            assert.equal(fs.readFileSync(target, "utf8"), "ok");
        }
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("a respelt word survives a wrapper, so a composed spelling still means what it spells", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-wrapquote-"));
    try {
        // Through `groundFor`, not `p.ground`, which misses a per-kind override.
        const wrappers = POSITIONS.filter((p) => p.id.includes("wrapper") && Object.keys(EFFECT).every((k) => groundFor(p, k) === "command"));
        assert.ok(wrappers.length >= 3, `expected several wrapper productions, found ${wrappers.length}`);
        const drawn = new Set();
        const rand = prng(90210);
        for (let i = 0; i < 200; i += 1) drawn.add(respell("portulan.marker", rand));
        const respellings = ['"portulan.marker"', "'portulan.marker'", "$'portulan.marker'", "portulan.mark\\er", 'portulan"."marker', ...drawn];
        let refused = 0;
        for (const position of wrappers) {
            for (const word of respellings) {
                if (position.carries && !position.carries(`printf ok > ${word}`)) {
                    refused += 1;
                    continue;
                }
                const marker = path.join(dir, "portulan.marker");
                fs.rmSync(marker, { force: true });
                const script = position.build(`printf ok > ${word}`);
                const result = spawnSync("bash", ["-c", script], { cwd: dir, encoding: "utf8", timeout: 10_000, env: { PATH: process.env.PATH ?? "" } });
                assert.equal(result.signal, null, `bash was killed by ${result.signal} running ${JSON.stringify(script)} — nothing was measured`);
                assert.equal(result.status, 0, `bash refused ${JSON.stringify(script)}: ${result.stderr}`);
                assert.ok(
                    fs.existsSync(marker) && fs.readFileSync(marker, "utf8") === "ok",
                    `the respelling ${JSON.stringify(word)} stopped naming the marker inside \`${position.id}\` — ` +
                        `a composed spelling that does not mean what it spells is a generator without ground truth`,
                );
                fs.rmSync(marker, { force: true });
            }
        }
        assert.ok(refused > 0, "no composition was declined — the `carries` predicate has stopped doing anything");
        assert.ok(respellings.length > 20, `only ${respellings.length} respellings were drawn; the sample is too thin to answer the question`);
        console.log(`ground: measured ${wrappers.length} wrapper production(s) × ${respellings.length} respelling(s); ${refused} declined by \`carries\``);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
