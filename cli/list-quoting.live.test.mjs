// Every recipe that enumerates the tree reads the pathname git actually carries.
//
// Either flag, not always `-z`: raw bytes could collide with the `\001` sentinel in `docs.sh`'s links `awk`.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERIFY = path.join(REPO, ".portulan", "verify");

// Keyed by the code, never a line number, which drifts and would exempt whatever moved into its place.
const EXEMPT = Object.freeze([
    { file: "docs.sh", contains: "git ls-files --stage --", why: "reads the mode field via cut -c1-6; the pathname never reaches a comparison" },
]);

// Matched as text: a flag list built in a variable goes unseen, and an unbalanced `'` misleads the stripping.
const INVOKES = /(?:^|[\s(=!])git(?:\s+-c\s+\S+)*\s+ls-files/;

const stripped = (line) => (/^\s*#/.test(line) ? "" : line.replace(/'[^']*'/g, " "));

const invocations = () => {
    const found = [];
    for (const name of fs.readdirSync(VERIFY).filter((f) => f.endsWith(".sh")).sort()) {
        const lines = fs.readFileSync(path.join(VERIFY, name), "utf8").split("\n");
        lines.forEach((line, i) => {
            const bare = stripped(line);
            if (INVOKES.test(bare)) found.push({ file: name, line: i + 1, text: line.trim(), bare });
        });
    }
    return found;
};

test("every recipe enumerating the tree reads the pathname git carries, not a quoted spelling of it", () => {
    const offenders = [];
    for (const inv of invocations()) {
        if (EXEMPT.some((e) => e.file === inv.file && inv.bare.includes(e.contains))) continue;
        const raw = /\s-z(?:\s|$)/.test(inv.bare);
        const unquoted = /-c\s+core\.quotePath=false/.test(inv.bare);
        if (!raw && !unquoted) offenders.push(`${inv.file}:${inv.line}  ${inv.text}`);
    }
    assert.deepEqual(
        offenders,
        [],
        "each must carry `-z` (raw bytes) or `-c core.quotePath=false` (non-ASCII unquoted); see this file's header for why either, and why not always the stronger one",
    );
});

test("the sweep is looking at something — and at the invocations, not at the prose that mentions them", () => {
    const found = invocations();
    assert.ok(found.length >= 9, `expected at least 9 real invocations across the recipes, found ${found.length}`);
    assert.ok(found.some((i) => i.file === "json.sh"), "json.sh enumerates the tree and must appear");
    assert.ok(
        !found.some((i) => /^printf/.test(i.text)),
        "a `git ls-files` inside a printf string is prose and must not be counted as an invocation",
    );
    const proseLines = fs
        .readFileSync(path.join(VERIFY, "json.sh"), "utf8")
        .split("\n")
        .filter((l) => /^\s*printf .*ls-files/.test(l));
    assert.equal(proseLines.length, 1, "json.sh should carry exactly one printed ls-files mention");
    assert.equal(stripped(proseLines[0]).includes("ls-files"), false, "and the stripper should blank it");
});

test("the exemption roster is honest — every entry still matches something", () => {
    const all = invocations();
    for (const e of EXEMPT) {
        assert.ok(
            all.some((i) => i.file === e.file && i.bare.includes(e.contains)),
            `exempt entry matches nothing and should be removed: ${e.file} — ${e.contains}`,
        );
    }
});
