// The required checks name their resolution root, and this is what makes that a rail.
//
// **Why this file exists.** A pre-commit checkpoint stripped all six `--pack-root packs` from the
// tree at once and everything stayed green: eleven recipes, 1535 tests, nothing red. The pins were
// shell prose. Removing the one in `doctor.sh` silently reverts `examples/` to green-by-not-looking —
// its declared packs reported *unverifiable* rather than graded — which is the exact fail-open class
// the change that added the pins was written to close. A containment nothing enforces is a comment.
//
// **What a pinned root buys, said once.** A named root REPLACES every other source, so a check that
// names one cannot consult the host's plugin cache whatever the unasked default becomes. That is what
// keeps a required check's verdict a statement about the TREE rather than about the machine running
// it — the property the 2026-08-09 narrowing was protecting, kept without the narrowing.
//
// **The limit, stated rather than discovered.** This reads the invocation lines as text. It cannot
// tell that the root is *correct*, only that one is named; and a caller that pins by building the
// argument list dynamically would pass while naming nothing. Both are out of reach of a text sweep,
// and a stronger check would need the recipes to report their own plan — which is worth doing when a
// second pinned caller wants it, not before.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Every invocation that MUST name a root, with the tool it invokes.
 *
 * A roster rather than a sweep, deliberately, and the difference is worth one sentence: a sweep would
 * ask "does every invocation of these tools pin?", which is false by design — `cli/`'s own tests and
 * an adopter's command line legitimately do not. The question here is narrower and is the one that
 * matters: **does every REQUIRED check pin?** That set is enumerated in policy, so it is enumerated
 * here, and a seventh required invocation added without a pin is caught by the count assertion below
 * rather than by this list silently not mentioning it.
 */
const PINNED = Object.freeze([
    { file: ".portulan/verify/doctor.sh", tool: "cli/doctor.mjs" },
    { file: ".portulan/verify/compile.sh", tool: "cli/compile.mjs" },
    { file: ".portulan/verify/index.sh", tool: "cli/index.mjs" },
    { file: ".portulan/verify/plugin.sh", tool: "cli/skills-set.mjs" },
    { file: ".github/workflows/verify.yml", tool: "cli/recipe-set.mjs" },
    { file: ".portulan/dod.md", tool: "cli/recipe-set.mjs" },
]);

const readLines = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8").split("\n");

/**
 * Lines that name a run of the tool, with whole-line `#` comments stripped first.
 *
 * **Described at its real width, because the first draft was not.** It said "a line that RUNS the
 * tool, never one that merely mentions it in prose", and the matcher does no such thing — it takes any
 * surviving line containing `node <tool>`. That is deliberate rather than sloppy: the sixth pinned
 * site is `.portulan/dod.md`, where the command sits **inside prose, in backticks**, and is a command
 * a reader copies. A matcher that excluded prose would exclude the one carrier most likely to be
 * copied wrong.
 *
 * What the stripping buys is narrower and real: a shell comment ABOVE an invocation, explaining it,
 * does not count as a second invocation. What it cannot do is tell a documented example from a live
 * one on the same line — which would matter if a file ever wrote "do not run `node cli/doctor.mjs`
 * without a root", and does not today. Raised as a promoted note by Copilot, round 2 on #236.
 */
function invocations(rel, tool) {
    return readLines(rel).filter((line) => line.replace(/^\s*#.*$/, "").includes(`node ${tool}`));
}

test("every required check names its resolution root", () => {
    const unpinned = [];
    for (const { file, tool } of PINNED) {
        const lines = invocations(file, tool);
        assert.ok(lines.length > 0, `${file} no longer invokes ${tool} — this roster is stale`);
        for (const line of lines) {
            if (!/--pack-root\s+\S/.test(line)) unpinned.push(`${file}: ${line.trim()}`);
        }
    }
    assert.deepEqual(
        unpinned,
        [],
        "a required check with no named root inherits the machine it runs on — see this file's header",
    );
});

test("the roster covers every verify recipe that invokes a root-taking tool", () => {
    // The count assertion the roster leans on. If a recipe grows an invocation of a tool that takes
    // `--pack-root`, this goes red and somebody has to decide whether it pins — rather than the
    // roster quietly not mentioning it, which is how a list stops being a rail.
    // EVERY tool that accepts `--pack-root`, not just the ones a recipe happens to call today. The
    // first cut listed five and omitted `init` and `vendor`, so a recipe invoking either would have
    // slipped past the sweep — this rail carrying the exact hole it exists to catch. Copilot, round 1
    // on #236. Derived rather than remembered: a tool takes a root if its source parses the flag.
    const takesRoot = fs
        .readdirSync(path.join(REPO, "cli"))
        .filter((f) => f.endsWith(".mjs") && !f.includes(".test."))
        // Quote-agnostic. The first derivation searched for the double-quoted spelling alone, so a
        // tool parsing `'--pack-root'` would have been missed — this rail carrying a NARROWER version
        // of the hole it had just been fixed for, two rounds running. Copilot, round 3 on #236.
        .filter((f) => /["']--pack-root["']/.test(fs.readFileSync(path.join(REPO, "cli", f), "utf8")))
        .map((f) => `cli/${f}`);
    assert.ok(takesRoot.length >= 5, `expected several root-taking tools, derived ${takesRoot.length}`);
    const found = [];
    for (const entry of fs.readdirSync(path.join(REPO, ".portulan", "verify"))) {
        if (!entry.endsWith(".sh")) continue;
        const rel = path.join(".portulan", "verify", entry);
        for (const tool of takesRoot) {
            if (invocations(rel, tool).length) found.push(`${rel}:${tool}`);
        }
    }
    const rostered = new Set(PINNED.map((p) => `${p.file}:${p.tool}`));
    assert.deepEqual(
        found.filter((f) => !rostered.has(f)),
        [],
        "a verify recipe invokes a root-taking tool and is not in this file's roster",
    );
});
