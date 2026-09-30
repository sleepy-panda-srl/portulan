// The constitution is cited by its sections, not by its words, and this holds every citation to it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VISION = "docs/vision.md";
const SELF = "cli/vision-sections.live.test.mjs";

const key = (label) => label.replace(/\s+/g, " ").trim().toLowerCase();

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

// A code span's `§` is blanked as an example, a line at a time; lines then join past their comment leaders.
function citations(text) {
    const flat = text
        .split("\n")
        .map((line) => {
            const parts = line.split("`");
            return parts.map((part, i) => (i % 2 && i < parts.length - 1 && part.includes("§") ? " " : part)).join("`");
        })
        .join("\n")
        .replace(/\r?\n[ \t]*(?:\/\/+[ \t]?|\*[ \t]|#+[ \t]|>[ \t]?)?/g, " ");
    const found = [];
    for (const m of flat.matchAll(/([\w./-]*)`?\)?\s*§\s*(?:thesis\s+(\d+)|\*([^*]+)\*|(?=(.{0,40})))/g)) {
        if (!/(^|\/)vision\.md$/.test(m[1])) {
            if (!m[1].endsWith(".md") && (m[2] || m[3])) found.push({ kind: "unreadable", text: m[0].trim().slice(0, 40) });
        } else if (m[2]) found.push({ kind: "thesis", n: Number(m[2]) });
        else if (m[3]) found.push({ kind: "label", label: m[3] });
        else found.push({ kind: "unreadable", text: m[4] });
    }
    for (const m of flat.matchAll(/(?<!§\s*)\bthesis\s+(\d+)\b/gi)) found.push({ kind: "thesis", n: Number(m[1]) });
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
    assert.deepEqual(problems(c, "vision.md § thesis 3"), ["thesis 3, of 2"], "a § thesis is one citation, not two");
    assert.deepEqual(problems(c, "`plan.md` § thesis 3"), [], "another file's thesis");
    assert.deepEqual(problems(c, "const s = `see vision.md § *Gone*"), ["§ *Gone*, no such section"], "an unclosed backtick opens no span");
    assert.deepEqual(problems(c, "20-53 // § 2. A section, then vision.md § *Gone*"), ["§ *Gone*, no such section"], "an outline's § cites nothing");
});

// Paths are compared as git's bytes, held in `latin1` strings, which keep one character per byte.
function linkReaches(root, tracked, at) {
    let real;
    try {
        real = fs.realpathSync(at, { encoding: "buffer" }).toString("latin1");
    } catch {
        return false;
    }
    const rel = path.relative(root, real).split(path.sep).join("/");
    if (rel === ".." || rel.startsWith("../") || path.isAbsolute(rel)) return false;
    return tracked.has(rel) || [...tracked].some((name) => name.startsWith(rel ? `${rel}/` : ""));
}

test("a tracked link counts as read only when it leads to something tracked in the working tree", (t) => {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "vision-sections-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, "sub"));
    for (const file of ["real.md", "sub/inner.md", "untracked.md"]) fs.writeFileSync(path.join(root, file), "");
    const links = { file: "real.md", folder: "sub", itself: ".", up: "..", dangling: "nowhere.md", untracked: "untracked.md", loop: "loop" };
    for (const [link, target] of Object.entries(links)) fs.symlinkSync(target, path.join(root, link));
    const tracked = new Set(["real.md", "sub/inner.md", ...Object.keys(links)]);
    assert.deepEqual(Object.keys(links).filter((link) => linkReaches(root, tracked, path.join(root, link))), ["file", "folder", "itself"]);
});

// Raw bytes via `-z`: git C-quotes a name with a control character, and a non-UTF-8 name would not decode back.
function scanned() {
    const exclude = JSON.parse(fs.readFileSync(path.join(REPO, ".portulan/rule-carriers.json"), "utf8")).exclude;
    assert.ok(Array.isArray(exclude) && exclude.length > 0, "rule-carriers.json carries no exclude list to read the record layer from");
    const listing = execFileSync("git", ["ls-files", "-z"], { cwd: REPO });
    const files = [];
    for (let start = 0, end; (end = listing.indexOf(0, start)) !== -1; start = end + 1) {
        const raw = listing.subarray(start, end);
        files.push({ raw, name: raw.toString("utf8") });
    }
    const visions = files.map((f) => f.name).filter((name) => /(^|\/)vision\.md$/.test(name));
    assert.deepEqual(visions, [VISION], "another tracked vision.md would make a citation of `vision.md` name either");
    return {
        files: files.filter(({ name }) => name !== VISION && name !== SELF && !exclude.some((p) => name === p || name.startsWith(p))),
        tracked: new Set(files.map(({ raw }) => raw.toString("latin1"))),
    };
}

test("every section this repository cites is one the constitution has", () => {
    const constitution = sections(fs.readFileSync(path.join(REPO, VISION), "utf8"));
    assert.ok(constitution.theses > 0, `${VISION}'s theses no longer read as one numbered list from 1`);
    assert.ok(constitution.labels.size > constitution.theses, `${VISION} yields almost no sections: the reader no longer understands it`);
    assert.deepEqual(constitution.duplicates, [], "two sections share a name, so a citation of it names neither");

    const found = [];
    let sectioned = 0;
    const { files, tracked } = scanned();
    const root = fs.realpathSync(REPO, { encoding: "buffer" }).toString("latin1");
    for (const { raw, name } of files) {
        const at = Buffer.concat([Buffer.from(REPO + path.sep), raw]);
        let stat;
        try {
            stat = fs.lstatSync(at);
        } catch {
            found.push(`${name}: tracked but not in the working tree, so nothing read it`);
            continue;
        }
        if (stat.isSymbolicLink() && !linkReaches(root, tracked, at)) found.push(`${name}: a link to nothing tracked here, so nothing read it`);
        // A link is read where it leads, and a directory here is a submodule, another repository's.
        if (!stat.isFile()) continue;
        const text = fs.readFileSync(at);
        if (text.includes(0)) continue;
        const utf8 = text.toString("utf8");
        sectioned += citations(utf8).filter((c) => c.kind === "label").length;
        for (const p of problems(constitution, utf8)) found.push(`${name}: ${p}`);
    }
    assert.ok(sectioned > 0, "no file cites a section as `vision.md § *…*`: the scan or the convention is gone");
    assert.deepEqual(found, []);
});
