// The roster beside the eight, against THIS directory rather than against fixtures.
//
//   node --test "cli/**/*.test.mjs"
//
// `docs.sh`'s `cli table` check already holds the *table* to this directory in both directions. The
// SENTENCE beside it — which files are subcommands, which are runnable tools on none of the lists,
// which are modules and hook runners — was left unrailed, and it drifted by exactly the mechanism the
// table's own rail exists to stop. `cli/README.md`'s parentheticals record the counts wrong four
// times; when this file was written they were wrong a fifth, `version-carriers.mjs` and `inside.mjs`
// having reached the table and neither roster sentence. That is #204, whose reporter diagnosed it
// precisely: "The eight themselves are fine — they are derived from one list and the suite counts
// them. It is the sentence beside the list that drifted."
//
// **So the sentence is derived from the same place the list is.** The eight come from
// `portulan.mjs`'s exported `SUBCOMMANDS` — a real import, never a hand-copied list — and everything
// else in the directory must be named between the roster markers in `cli/README.md`. Both
// directions, because both have failed here: a file arrived with no classification, and prose has
// outlived what it named.
//
// **Why the numerals are gone rather than corrected.** A sixth hand-correction would have been the
// sixth. This file's own convention already rules the other way three times over — the packaged-file
// count is "not restated here as a number", the table's arrears figure "is not stated here any more,
// because a number maintained by hand is the thing that kept going wrong", and the root README's CLI
// cell refuses "one more hand-maintained figure". The roster now carries membership and no count; a
// figure nobody writes cannot go stale, and the membership is what this test holds.
//
// **Why the anchor is a marker and not a heading or a sentence.** The prose between the markers is
// argued text that a documentation pass is licensed to rewrite. Anchoring on any of its words would
// make the next rewrite look like this rail failing. The markers are HTML comments: invisible in
// every renderer, explicit to anyone editing, and stable across a rewrite that changes every
// sentence between them.
//
// **Why here and not in `docs.sh`.** `identity.md` documents `docs.sh` as the one declared recipe
// needing only `git`, `bash` and the POSIX text utilities, and treats every movement of that line as
// an argued event. Reaching `SUBCOMMANDS` from bash would mean either adding `node` to that recipe —
// moving a documented line as a side effect of a roster fix — or extracting the literal by text,
// which is a second parser of a JavaScript array. `tests.sh` already needs `node` and already imports
// real modules, so the derivation lives where a real import is free.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { SUBCOMMANDS } from "./portulan.mjs";

const CLI_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(CLI_DIR, "..");
const README = path.join(CLI_DIR, "README.md");

const ENTRY_POINT = "portulan.mjs";

// The eight, read from the field that carries them. `module` is authoritative and is deliberately
// nullable — an entry may be NAMED by `docs/vision.md` before the tree carries it, and while that
// holds the entry point lists it and refuses it. Such an entry classifies no file, so it is filtered
// rather than turned into a phantom `<name>.mjs`. Deriving `${name}.mjs` instead would agree with
// this today and silently disagree the first time either fact moved.
function subcommandModules() {
    return new Set(SUBCOMMANDS.map((s) => s.module).filter(Boolean));
}
const BEGIN = "<!-- roster:begin -->";
const END = "<!-- roster:end -->";

// Tracked files only, and the same pathspec `docs.sh`'s cli-table check uses, so the two rails
// answer about one directory rather than about two slightly different ones. `core.quotePath=false`
// for that check's stated reason: a C-quoted pathname would arrive transformed and silently drop out
// of the comparison, which is the one failure of this class that produces a false GREEN.
function trackedNonTestModules() {
    const out = execFileSync("git", ["-c", "core.quotePath=false", "ls-files", "cli/*.mjs"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
    });
    return out
        .split("\n")
        .filter(Boolean)
        .map((p) => p.replace(/^cli\//, ""))
        .filter((p) => !p.includes("/"))
        .filter((p) => !p.endsWith(".test.mjs"))
        .sort();
}

// Bare backticked identifiers only. A path or a filename inside the block — `../.portulan/verify/
// rule-carriers.sh` is one, and it sits inside these very markers — carries a `/` or a `.` and is
// deliberately not a roster member. Matching those would let a link label classify a file.
function rosterNames(markdown) {
    const from = markdown.indexOf(BEGIN);
    const to = markdown.indexOf(END);
    assert.notEqual(from, -1, `${README} carries no ${BEGIN} marker — the roster rail has no anchor`);
    assert.notEqual(to, -1, `${README} carries no ${END} marker — the roster rail has no anchor`);
    assert.ok(to > from, "the roster markers are inverted");

    const block = markdown.slice(from + BEGIN.length, to);
    const names = new Set();
    for (const [, name] of block.matchAll(/`([a-z][a-z0-9-]*)`/g)) names.add(`${name}.mjs`);
    return names;
}

// Read LAZILY, not at `describe` evaluation. Both of these reach outside the process — one shells
// to git, one reads a file — and at module-load time a failure in either takes the whole file down
// before a single case runs, surfacing as an opaque load error instead of the named refusal this
// suite is built to give. That is the same shape as a precondition that cannot report: the check
// does not fail closed, it fails *illegibly*. Inside a case, the identical failure is attributed to
// a test with a message that says what could not be done.
let cached = null;
function inputs() {
    if (cached) return cached;
    let onDisk, markdown;
    try {
        onDisk = trackedNonTestModules();
    } catch (err) {
        assert.fail(`could not enumerate cli/*.mjs with git — this check could not run: ${err.message}`);
    }
    try {
        markdown = fs.readFileSync(README, "utf8");
    } catch (err) {
        assert.fail(`could not read ${README} — this check could not run: ${err.message}`);
    }
    cached = { onDisk, markdown };
    return cached;
}

describe("the roster beside the eight is a partition of cli/, and nothing here is hand-counted", () => {

    // The precondition, for the reason every recipe in this repository states it: an empty
    // enumeration would make both comparisons below vacuously true, and a check that passes over
    // nothing is worse than no check. Either side coming back empty is a broken harness, never a
    // clean result.
    test("the enumeration ran and the markers parse", () => {
        const { onDisk, markdown } = inputs();
        assert.ok(onDisk.length > 0, "git listed no cli/*.mjs modules — refusing to compare nothing");
        // `rosterNames` asserts both markers are present and ordered; calling it is the check.
        // Deliberately NOT asserting it found a name: a directory holding only subcommands and the
        // entry point is a legitimate state with an empty roster, and an emptied block is caught by
        // the partition below anyway, since its files stop being classified.
        rosterNames(markdown);
    });

    test("every module in cli/ is classified exactly once", () => {
        const { onDisk, markdown } = inputs();
        const subcommands = subcommandModules();
        const roster = rosterNames(markdown);

        const classified = new Set([...subcommands, ...roster, ENTRY_POINT]);

        const unclassified = onDisk.filter((f) => !classified.has(f));
        assert.deepEqual(
            unclassified,
            [],
            `cli/${unclassified.join(", cli/")} is on disk and classified by nothing — ` +
                `name it between ${BEGIN} and ${END} in cli/README.md, or make it a subcommand`,
        );
    });

    test("every name in the roster names a file that exists", () => {
        const { onDisk, markdown } = inputs();
        const roster = [...rosterNames(markdown)].sort();
        const present = new Set(onDisk);

        const phantom = roster.filter((f) => !present.has(f));
        assert.deepEqual(
            phantom,
            [],
            `the roster names ${phantom.join(", ")}, which cli/ does not carry — a row can outlive what it names`,
        );
    });

    // The roster and the subcommand list are disjoint by construction: being off the eight is what
    // puts a tool in the roster at all. If a tool is ever promoted to a ninth subcommand — the
    // maintainer's call, never an implementer's — this is the assertion that requires the sentence
    // to be updated in the same change rather than a release later.
    test("the entry point is not also claimed by the roster", () => {
        const { markdown } = inputs();
        const roster = rosterNames(markdown);
        assert.ok(
            !roster.has(ENTRY_POINT),
            `the roster names ${ENTRY_POINT}, which is the entry point and is classified as such — ` +
                "naming it here would classify one file twice and still pass the partition",
        );
    });

    test("no tool is both a subcommand and a roster member", () => {
        const { markdown } = inputs();
        const subcommands = subcommandModules();
        const both = [...rosterNames(markdown)].filter((f) => subcommands.has(f)).sort();
        assert.deepEqual(both, [], `${both.join(", ")} is named as a subcommand and as beside the eight`);
    });
});
