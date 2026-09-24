// The constitution is cited by its sections, not by its words, and this holds every citation to it.
//
//   node --test "cli/**/*.test.mjs"
//
// Code, tests and the spec used to quote `docs/vision.md` word for word, so no sentence there could be
// shortened without leaving a false quote somewhere else. A citation now names the section instead:
// `vision.md § thesis 4`, or `vision.md § *Delivery tiers*` for a heading, a bold lead or an influence
// map school. This suite holds every such name, and every "thesis N", to the file as it stands. It
// checks that the section exists and never that any words match, so the text under a section is free to
// change and a renamed lead or a renumbered thesis goes red where it is cited. Case and spacing are not
// part of a name: two sections that differ only in them count as duplicates, so a citation can never
// match the wrong one. A rename that changes only case therefore stays green, and one that changes a
// word or a punctuation mark goes red.
//
// **The record layer is out.** A handoff, proposal or milestone file cites a thesis by the number it
// had on the record's day, and records are forward-only. `.portulan/rule-carriers.json`'s `exclude` is
// the one list of those paths and is read rather than copied. `.portulan/tasks/` is not on it and is
// scanned: an open task is a live carrier a session acts on, and a done one keeps the words it quotes,
// which this never checks, while every section it names must still exist.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VISION = "docs/vision.md";
const SELF = "cli/vision-sections.live.test.mjs";

const key = (label) => label.replace(/\s+/g, " ").trim().toLowerCase();

// What a citation can name: every `##` heading without its parenthetical aside, the bold lead that
// opens a paragraph or a list item, and the first cell of each table row under the header. The theses
// are the one numbered list, and their numbers must run 1..n, or a gap would pass every citation of
// the numbers either side of it.
function sections(markdown) {
    const labels = new Map();
    const duplicates = [];
    const theses = [];
    const add = (label) => {
        const k = key(label);
        if (labels.has(k)) duplicates.push(label);
        else labels.set(k, label);
    };
    const lines = markdown.split("\n");
    lines.forEach((line, i) => {
        const opensBlock = i === 0 || lines[i - 1].trim() === "";
        let m;
        if ((m = /^##\s+(.+?)\s*$/.exec(line))) return add(m[1].replace(/\s*\([^)]*\)$/, ""));
        if ((m = /^(\d+)\.\s/.exec(line))) theses.push(Number(m[1]));
        if ((m = /^(?:[-*]\s+|\d+\.\s+)\*\*(.+?)\*\*/.exec(line)) || (opensBlock && (m = /^\*\*(.+?)\*\*/.exec(line)))) {
            return add(m[1].replace(/[\s.:,;]+$/, ""));
        }
        const header = /^\|/.test(lines[i + 1] ?? "") && /^\|[\s:|-]+\|$/.test(lines[i + 1]);
        if ((m = /^\|\s*([^|]+?)\s*\|/.exec(line)) && !/^\|[\s:|-]+\|$/.test(line) && !header) add(m[1]);
    });
    const gap = theses.findIndex((n, i) => n !== i + 1);
    return { labels, duplicates, theses: gap === -1 ? theses.length : 0 };
}

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

// Line breaks and comment leaders (`//`, `* `, `#`, `>`) are joined to a space first, so a citation that
// wraps inside a comment or a paragraph reads as one. A `§` names the file it follows: after another
// `.md` it is that file's business, and after `vision.md` it must name a thesis or an italic label. A
// `§` after no file at all, or one this cannot parse, is reported: a citation nothing checks is never a
// pass. A `§` inside a code span is an example of the form, not a citation, and is dropped first, a
// line at a time, since a backtick pairs with the next one on its line.
function citations(text) {
    const flat = text
        .split("\n")
        .map((line) => line.split("`").map((part, i) => (i % 2 && part.includes("§") ? " " : part)).join("`"))
        .join("\n")
        .replace(/\r?\n[ \t]*(?:\/\/+[ \t]?|\*[ \t]|#+[ \t]|>[ \t]?)?/g, " ");
    const found = [];
    for (const m of flat.matchAll(/([\w./-]*)`?\)?\s*§\s*(?:thesis\s+(\d+)|\*([^*]+)\*|(.{0,40}))/g)) {
        if (!m[1].endsWith(".md")) found.push({ kind: "unreadable", text: m[0].trim().slice(0, 40) });
        else if (!/(^|\/)vision\.md$/.test(m[1])) continue;
        else if (m[2]) found.push({ kind: "thesis", n: Number(m[2]) });
        else if (m[3]) found.push({ kind: "label", label: m[3] });
        else found.push({ kind: "unreadable", text: m[4] });
    }
    for (const m of flat.matchAll(/\bthesis\s+(\d+)\b/gi)) found.push({ kind: "thesis", n: Number(m[1]) });
    for (const m of flat.matchAll(new RegExp(`\\b(${ORDINALS.join("|")})\\s+thesis\\b`, "gi"))) {
        found.push({ kind: "thesis", n: ORDINALS.indexOf(m[1].toLowerCase()) + 1 });
    }
    return found;
}

function problems(constitution, text) {
    const { labels, theses } = constitution;
    return citations(text).flatMap((c) => {
        if (c.kind === "thesis" && !(c.n >= 1 && c.n <= theses)) return [`thesis ${c.n}, of ${theses}`];
        if (c.kind === "label" && !labels.has(key(c.label))) return [`§ *${c.label}*, no such section`];
        if (c.kind === "unreadable") return [`a § that names no section: "${c.text}"`];
        return [];
    });
}

const SAMPLE = [
    "# Title",
    "",
    "Opening, with **bold mid-line**.",
    "",
    "**A lead.** Its paragraph wraps onto",
    "**a bold line** that opens no block.",
    "",
    "## The list (an aside)",
    "",
    "1. **First.** One.",
    "2. **Second** two.",
    "- **Item:** three.",
    "",
    "| School | Adopted |",
    "|---|---|",
    "| Someone / else | This |",
].join("\n");

test("the reader finds headings, leads, schools and the numbered theses, and nothing else", () => {
    const { labels, duplicates, theses } = sections(SAMPLE);
    assert.deepEqual([...labels.values()].sort(), ["A lead", "First", "Item", "Second", "Someone / else", "The list"]);
    assert.deepEqual(duplicates, []);
    assert.equal(theses, 2);
    assert.equal(sections("1. a\n3. b\n").theses, 0, "a gap in the numbering leaves no thesis citable");
});

test("a citation passes only when the section exists, and an unreadable one is a problem", () => {
    const c = sections(SAMPLE);
    assert.deepEqual(problems(c, "see `docs/vision.md` § *Item* and vision.md § thesis 2, the second thesis"), []);
    assert.deepEqual(problems(c, "// ../docs/vision.md § *Someone\n// / else* wraps"), []);
    assert.deepEqual(problems(c, "(../docs/vision.md) § *item*"), [], "case is not a section");
    assert.deepEqual(problems(c, "vision.md § *Gone*"), ["§ *Gone*, no such section"]);
    assert.deepEqual(problems(c, "thesis 3 and the seventh thesis"), ["thesis 3, of 2", "thesis 7, of 2"]);
    assert.deepEqual(problems(c, "vision.md § Item, unmarked"), ['a § that names no section: "Item, unmarked"']);
    assert.deepEqual(problems(c, "the lead (§ *Item*)"), ['a § that names no section: "§ *Item*"'], "a § after no file");
    assert.deepEqual(problems(c, "the form is `vision.md § *Gone*`, as an example"), [], "a code span is an example");
    assert.deepEqual(problems(c, "`.portulan/gate-map.md` § Anything at all"), [], "another file's section");
});

function scanned() {
    const exclude = JSON.parse(fs.readFileSync(path.join(REPO, ".portulan/rule-carriers.json"), "utf8")).exclude;
    assert.ok(Array.isArray(exclude) && exclude.length > 0, "rule-carriers.json carries no exclude list to read the record layer from");
    const files = execFileSync("git", ["-c", "core.quotePath=false", "ls-files"], { cwd: REPO, encoding: "utf8" })
        .split("\n")
        .filter(Boolean);
    return files.filter((f) => f !== VISION && f !== SELF && !exclude.some((p) => f === p || f.startsWith(p)));
}

test("every section this repository cites is one the constitution has", () => {
    const constitution = sections(fs.readFileSync(path.join(REPO, VISION), "utf8"));
    assert.ok(constitution.theses > 0, `${VISION}'s theses no longer read as one numbered list from 1`);
    assert.ok(constitution.labels.size > constitution.theses, `${VISION} yields almost no sections: the reader no longer understands it`);
    assert.deepEqual(constitution.duplicates, [], "two sections share a name, so a citation of it names neither");

    const found = [];
    let sectioned = 0;
    for (const file of scanned()) {
        const text = fs.readFileSync(path.join(REPO, file));
        if (text.includes(0)) continue;
        const utf8 = text.toString("utf8");
        sectioned += citations(utf8).filter((c) => c.kind === "label").length;
        for (const p of problems(constitution, utf8)) found.push(`${file}: ${p}`);
    }
    assert.ok(sectioned > 0, "no file cites a section as `vision.md § *…*`: the scan or the convention is gone");
    assert.deepEqual(found, []);
});
