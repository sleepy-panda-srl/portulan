// The fuzzer's ground truth, MEASURED under real bash rather than argued.
//
// ./fuzz-shell.mjs is exact only if its grammar tells the truth about itself: a production declaring
// `ground: "command"` must be a position bash actually executes, and one declaring `ground: "data"`
// must be a position bash never executes. That declaration is the fuzzer's oracle, so getting it
// wrong does not produce a red — it produces a **green about the wrong thing**, which is the one
// failure a fuzzer cannot detect in itself.
//
// **A hole list is a claim like any other, and so is a grammar.** This file runs every production
// through `bash -c` with a NEUTRAL payload — `printf ok`, never a gated command — and fails if bash
// disagrees with what the production declared. It also writes every path spelling to a throwaway file
// under a temp directory, which turns "these all name one file" from an assertion into a measurement.
//
// **Separated from ./fuzz-shell.test.mjs on purpose.** That file handles a force-push spelling and a
// constitution write and must therefore never spawn anything; this one spawns and must therefore
// never handle either. Neither payload appears here, and the fuzzer's own `bashSafe: false` marks the
// one production this file must not execute even neutrally.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

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

import { POSITIONS, pathSpellings, prng, respell } from "./fuzz-shell.mjs";

/**
 * The neutral payload: it drops a marker file in the scratch directory and touches nothing else.
 *
 * **It must not be detectable by its own text, and the first draft was.** `printf PORTULAN_RAN`
 * with a stdout check reported `single-quoted-echo` as a COMMAND position, because
 * `echo 'printf PORTULAN_RAN'` prints the payload's source and the check could not tell printing a
 * command from running one. A measurement harness fooled by the thing it measures is worse than no
 * harness: it would have certified a data position as a command position and every case in that cell
 * would then have been graded against the wrong oracle.
 */
const NEUTRAL = "printf ok > portulan.marker";
const MARKER = "portulan.marker";

/** Run a script under bash in a scratch directory, and say whether the neutral payload ran. */
function ran(script, cwd) {
    const marker = path.join(cwd, MARKER);
    fs.rmSync(marker, { force: true });
    const result = spawnSync("bash", ["-c", script], { cwd, encoding: "utf8", timeout: 10_000, env: { PATH: process.env.PATH ?? "" } });
    // A bash that could not start at all is could-not-measure, and saying so beats reporting `false`
    // — which is a real answer here and would be the wrong one.
    assert.equal(result.error, undefined, `bash did not run: ${result.error?.message}`);
    // **And a bash that RAN and FAILED is could-not-measure too.** This checked only `error`, so a
    // script with a syntax error exited non-zero, dropped no marker, and came back `false` — which
    // for a `ground: "data"` production reads as CONFIRMATION. The position would have been certified
    // as data because the script was broken, not because bash declined to run the payload: a
    // measurement harness fooled by its own failure, in the file whose subject is that exact class
    // and which already records catching one instance of it. Measured before asserting: every
    // production the suite runs exits 0 today. Reported as a suppressed note by Copilot, round 2 on
    // #338 — the channel that carries what the inline one does not.
    assert.equal(
        result.status,
        0,
        `bash exited ${result.status} running ${JSON.stringify(script)} — a failed script measures nothing about ` +
            `where the payload sat: ${result.stderr}`,
    );
    const fired = fs.existsSync(marker);
    fs.rmSync(marker, { force: true });
    return fired;
}

test("every production's declared position is what bash actually does", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-ground-"));
    try {
        const skipped = [];
        for (const position of POSITIONS) {
            if (position.bashSafe === false) {
                // Not silently: a production excluded from the measurement must say why in its own
                // `why`, and the whole excluded set is pinned by the assertion below, so adding a
                // second exclusion reds this test rather than quietly shrinking what bash checks.
                // _(This comment said the exclusion was "printed with the count" and nothing printed
                // anything — a sentence describing a mechanism the file did not have. Found at the
                // pre-commit checkpoint. Printed now as well as pinned, since a reader of the test
                // output should not have to read the test to learn what it skipped.)_
                assert.ok(typeof position.why === "string" && position.why.trim().length > 20, `${position.id} is unmeasured and argues nothing`);
                skipped.push(position.id);
                continue;
            }
            const actual = ran(position.build(NEUTRAL), dir);
            assert.equal(
                actual,
                position.ground === "command",
                `production \`${position.id}\` declares ground=${position.ground}, and bash ${actual ? "RAN" : "did not run"} the payload. ` +
                    `The fuzzer's oracle is this declaration, so a wrong one produces a green about the wrong thing`,
            );
        }
        console.log(`ground: measured ${POSITIONS.length - skipped.length} position(s) under bash; unmeasured: ${skipped.join(", ") || "none"}`);
        assert.deepEqual(skipped, ["sudo-prefix"], "the unmeasured set changed — re-read why each member is in it");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("every path spelling names one file, measured by writing to it", () => {
    // `normalisePath` exists for exactly this list, and this is the measurement behind it. The target
    // is a throwaway path in a temp directory — nothing here writes anywhere the repository can see.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-paths-"));
    try {
        // `sibling` exists because a `..` hop is resolved by bash against the real filesystem: without
        // it, `docs/sibling/../vision.md` is not a spelling of the target, it is an error. The matcher
        // resolves `..` LEXICALLY and so answers the same either way, which is fail-closed and is
        // recorded at `pathSpellings`.
        fs.mkdirSync(path.join(dir, "docs", "sibling"), { recursive: true });
        const target = path.join(dir, "docs", "vision.md");
        for (const spelling of pathSpellings("docs/vision.md")) {
            fs.rmSync(target, { force: true });
            const script = `printf ok > ${spelling}`;
            const result = spawnSync("bash", ["-c", script], { cwd: dir, encoding: "utf8", timeout: 10_000, env: { PATH: process.env.PATH ?? "" } });
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
    // **The gap the pre-commit checkpoint named as undemonstrated, closed by measuring it.** The
    // spelling axis rewrites words into other spellings of the same word — `"w"`, `'w'`, `$'w'`, an
    // escaped character, a split quote — and the position axis then wraps some of them in
    // `bash -c "…"`, whose own quoting could plausibly change what the inner word means. If it did,
    // the generator would be composing a command it no longer has ground truth for, and the fuzzer
    // would be exact about the wrong string.
    //
    // Measured on a NEUTRAL payload whose target word is respelt each way, inside every wrapper
    // production, by checking that the marker file still lands under its unquoted name.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-wrapquote-"));
    try {
        const wrappers = POSITIONS.filter((p) => p.id.includes("wrapper") && p.ground === "command");
        assert.ok(wrappers.length >= 3, `expected several wrapper productions, found ${wrappers.length}`);
        // **Drawn from `respell` itself, not hand-picked.** The hand-picked five were a sample of the
        // generator's space and a reviewer asked the sharper question: `respell` can introduce `"`,
        // `$` and split quotes, and a wrapper interpolates the payload VERBATIM into `bash -c "…"`,
        // so the outer shell could retokenise the inner script into something the generator does not
        // believe it wrote. Sampling the actual space is the only answer to that; the five are kept
        // in front so a reader sees the shapes without running anything. Reported by Copilot on #338.
        const drawn = new Set();
        const rand = prng(90210);
        for (let i = 0; i < 200; i += 1) drawn.add(respell("portulan.marker", rand));
        const respellings = ['"portulan.marker"', "'portulan.marker'", "$'portulan.marker'", "portulan.mark\\er", 'portulan"."marker', ...drawn];
        let refused = 0;
        for (const position of wrappers) {
            for (const word of respellings) {
                // A position that DECLARES it cannot carry this spelling is not a failure — it is the
                // `carries` predicate doing its job, and this measurement is what put that predicate
                // there. Counted so the exclusions cannot grow to swallow the test.
                if (position.carries && !position.carries(`printf ok > ${word}`)) {
                    refused += 1;
                    continue;
                }
                const marker = path.join(dir, "portulan.marker");
                fs.rmSync(marker, { force: true });
                const script = position.build(`printf ok > ${word}`);
                const result = spawnSync("bash", ["-c", script], { cwd: dir, encoding: "utf8", timeout: 10_000, env: { PATH: process.env.PATH ?? "" } });
                assert.equal(result.status, 0, `bash refused ${JSON.stringify(script)}: ${result.stderr}`);
                assert.ok(
                    fs.existsSync(marker),
                    `the respelling ${JSON.stringify(word)} stopped naming the marker inside \`${position.id}\` — ` +
                        `a composed spelling that does not mean what it spells is a generator without ground truth`,
                );
                fs.rmSync(marker, { force: true });
            }
        }
        // Two single-quoted wrapper productions × the two `'`-bearing respellings. Pinned rather than
        // tolerated: a `carries` predicate that quietly widened would thin this measurement to nothing
        // while the test kept passing.
        assert.ok(refused > 0, "no composition was declined — the `carries` predicate has stopped doing anything");
        assert.ok(respellings.length > 20, `only ${respellings.length} respellings were drawn; the sample is too thin to answer the question`);
        console.log(`ground: measured ${wrappers.length} wrapper production(s) × ${respellings.length} respelling(s); ${refused} declined by \`carries\``);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
