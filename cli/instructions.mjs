#!/usr/bin/env node
// `instructions` — the sections a team marks in its own instruction file, moved to on-read units and proved.
//
//   node cli/instructions.mjs --workspace <dir>                   what would move, proved; nothing written
//   node cli/instructions.mjs --workspace <dir> --write           move it, then compile the index
//   node cli/instructions.mjs --workspace <dir> --join [--write]  put every moved section back
//
// Claude Code loads a repository's `CLAUDE.md` and `.claude/CLAUDE.md` whole into every context, and the load
// tiers of `../core/operating/context.md` reached only the guidance a workspace keeps in `slots.context`. So a
// repository that installs Portulan kept paying for its own instruction file on every request, however large,
// and that file can be most of what every request carries: proposal `0036`'s sealed incident measured one at
// 130k tokens. This moves the sections a team marks into `on-read` units of that slot, where `compile` gives
// each one line of the index every context loads, and the section itself loads when a session opens it.
// `portulan upgrade` reaches it through the form step `0009`, `doctor` and `init` propose it, and this command
// line is the reverse, and the way in where a declared budget already breached keeps `upgrade` from running.
//
// ## The team's word, in its own file
//
// **A section moves when the line under its heading is `<!-- portulan: on-read -->`**, alone on its line, and
// nothing else moves one: which guidance may leave every context is the team's to say (`0036`, rule 5), and a
// size says nothing about it. A moved section leaves `<!-- portulan: on-read <unit> <digest> -->` where it was,
// so the file says where its text went, the join knows where to put it back, and the digest, the first 8 hex
// digits of the SHA-256 of the section the unit holds, tells the join which one was edited since. Claude Code
// drops both comments before it loads the file: an instruction file or rule is lexed as Markdown and each
// block-level `<!-- … -->` is removed (read in the program text of Claude Code 2.1.281, 2026-09-24), so neither
// costs a context anything. `./context.mjs` measures bytes on disk and counts them all the same.
//
// ## Moved whole, and proved before anything is written
//
// A marked section moves with its heading and everything under it, byte for byte, into a unit named by its
// heading, whose `description` is the heading itself, so the index line names the section as the file did and
// paraphrases nothing; `compile` adds its size in whole KB. The text is not rewritten: a relative link in it
// still reads from the repository root, as it did in `CLAUDE.md`, which is where a session reads paths from,
// and a link rendered from the unit's own directory misses. **The split is proved or it is refused**: the file
// with each new marker replaced by its unit's body must equal the file as it was, less the marks, byte for
// byte, and the only lines the marks take with them are the marks and a blank line each. The plan also counts
// clauses, read as the checkers of 2026-09-23 read them, into those kept in the file, moved to a unit, missing
// and doubled.
//
// A section is refused, and nothing written, where moving it would change what loads: one holding an import
// that loads from the file (an on-read unit's import loads nothing, so the file would leave every context
// without a word), one marked inside another marked section, a mark under no heading, or a unit `compile`
// would refuse.
//
// ## What it does not move
//
// Only the project instruction files. A path-scoped rule is on-path already; the files it imports load into
// every context, and the context line names them among the largest. A team's own unscoped rules and the files
// an instruction file imports are always-tier files this does not split, and neither is an instruction file
// that is a link, since the file it names may be one another host loads whole. And once moved, a unit is the
// team's: one frontmatter line makes it `on-path` with `paths:`, `on-invoke`, or `always` again, and the join
// then refuses it rather than undo that tier without a word. A unit edited since the move goes back as it
// stands, and the join says so, unit by unit; and the join removes only a unit at the top of `slots.context`,
// where the split makes them, whatever else a marker written by hand names.
//
// ## Exit codes
//
// `0` printed, or written · `2` could not: a mark refused, a split that does not reassemble, a manifest, file
// or unit that could not be read, a write that failed and was rolled back. There is no 1: a marked section is
// the team's request, not a verdict about the repository, and `doctor` is where a budget is judged.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { BOOT_CARD_UNIT, CompileError, GUIDANCE_RULES_DIR, ON_READ_INDEX, claudeCodeGuidance, guidanceEdits, importPath, importSpans, parseUnit } from "./compile.mjs";
import { isInside } from "./inside.mjs";
import { outlineMd } from "./symbols.mjs";

/** The project instruction files Claude Code loads whole into every context, relative to the repository. */
export const INSTRUCTION_FILES = ["CLAUDE.md", ".claude/CLAUDE.md"];

/** The team's word that the section whose heading sits directly above this line moves to an on-read unit. */
export const ON_READ_MARK = "<!-- portulan: on-read -->";

/** The mark as a line may carry it: indented less than a code block is, and with space after it. */
const MARK = /^ {0,3}<!-- portulan: on-read -->[ \t]*$/;

/** Where a moved section was: the unit holding it, as a reader of the repository types the path, and its digest. */
const MOVED = /^ {0,3}<!-- portulan: on-read (.+?) ([0-9a-f]{8}) -->[ \t]*$/;
export const movedMark = (source, digest) => `<!-- portulan: on-read ${source} ${digest} -->`;

/**
 * A unit's digest: the first 8 hex digits of the SHA-256 of the section it holds, the lines under its frontmatter
 * that the join puts back, each read without its `\r`. A description edited, or line ends a checkout rewrote, is
 * no edit to the section.
 */
export const unitDigest = (text) => createHash("sha256").update(unitBody(text).map(bare).join("\n"), "utf8").digest("hex").slice(0, 8);

/** Names a unit may not take: the boot card's, and the index `compile` writes beside the rules. */
const RESERVED = new Set([BOOT_CARD_UNIT, path.basename(ON_READ_INDEX, ".md")]);

/** Anything that means the split could not be planned, read or written. Carries no verdict. */
export class InstructionsError extends Error {}

const posix = (p) => p.split(path.sep).join("/");
const bare = (line) => line.replace(/\r$/, "");
const blank = (line) => bare(line).trim() === "";
/** A count with its thousands grouped, as the context line prints its figures. */
export const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ===========================================================================================
// § A file's lines, the ones Markdown does not read as text, and its sections
// ===========================================================================================

/**
 * The lines of `text` a mark or a marker cannot sit on, read as `outlineMd` reads them: the frontmatter, every
 * line of a fenced block, fences included, and every line of an HTML comment running over more than one.
 * `lines` are `text.split("\n")`, each still carrying a `\r` where the file has one.
 */
function unread(lines) {
    const out = new Set();
    let i = 0;
    if (lines.length && /^---[ \t]*$/.test(bare(lines[0]))) {
        let close = 1;
        while (close < lines.length && !/^(?:---|\.\.\.)[ \t]*$/.test(bare(lines[close]))) close += 1;
        if (close < lines.length) for (; i <= close; i += 1) out.add(i);
    }
    let fence = null;
    let comment = false;
    for (; i < lines.length; i += 1) {
        const line = bare(lines[i]);
        if (fence !== null || comment) {
            out.add(i);
            if (fence !== null && fence.test(line)) fence = null;
            else if (comment && line.includes("-->")) comment = false;
            continue;
        }
        const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
        if (open && !(open[1][0] === "`" && open[2].includes("`"))) {
            fence = new RegExp(`^ {0,3}${open[1][0]}{${open[1].length},}[ \\t]*$`);
            out.add(i);
        } else if (/^ {0,3}<!--/.test(line) && !line.slice(line.indexOf("<!--") + 4).includes("-->")) {
            comment = true;
            out.add(i);
        }
    }
    return out;
}

/**
 * Every heading of `text` with the lines its section spans, from `outlineMd` in `./symbols.mjs`, the reader a
 * session opens a section with, so the split and the read agree on what a section is. Flattened in document
 * order, each carrying the titles of the headings above it.
 *
 * @returns {Array<{ start: number, end: number, level: number, title: string, bytes: number, parents: string[], children: object[] }>}
 */
function headingsOf(text) {
    const out = [];
    const walk = (entries, parents) => {
        for (const entry of entries) {
            out.push({ ...entry, parents });
            walk(entry.children ?? [], [...parents, entry.title]);
        }
    };
    walk(outlineMd(text).entries, []);
    return out;
}

/**
 * The sections a proposal names: the file's top-level headings, or, where one heading holds the whole file
 * as its title, the headings under it. The text above the first of them is the file's own opening, and is
 * never a section.
 */
export function sectionsOf(text) {
    let level = outlineMd(text).entries;
    let title = null;
    while (level.length === 1 && (level[0].children ?? []).length > 0) {
        title = level[0];
        level = level[0].children;
    }
    return { title, sections: level };
}

// ===========================================================================================
// § Marks and markers
// ===========================================================================================

/**
 * The marks and markers in one instruction file.
 *
 * @returns {{ marks: Array<{ line: number, heading: object | null }>, moved: Array<{ line: number, source: string, digest: string }> }}
 *   `line` is 0-based; a mark's `heading` is the section it moves, or null where no heading sits directly above it
 */
export function marksOf(text) {
    const lines = text.split("\n");
    const skip = unread(lines);
    const headings = headingsOf(text);
    const marks = [];
    const moved = [];
    for (const [at, line] of lines.entries()) {
        if (skip.has(at)) continue;
        const shown = bare(line);
        if (MARK.test(shown)) {
            marks.push({ line: at, heading: headingAbove(lines, headings, at) });
            continue;
        }
        const marker = MOVED.exec(shown);
        // Only a path this split could have written: relative, inside the repository, and a Markdown file.
        if (marker && marker[1].endsWith(".md") && !marker[1].startsWith("/") && !marker[1].includes("\\") && !marker[1].split("/").includes("..")) {
            moved.push({ line: at, source: marker[1], digest: marker[2] });
        }
    }
    return { marks, moved };
}

const UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;

/**
 * The heading a mark on line `at` sits directly under, with only blank lines between: an ATX heading's line,
 * or the underline of a setext heading, whose title may run over more than one line. Null where there is none.
 */
function headingAbove(lines, headings, at) {
    let above = at - 1;
    while (above >= 0 && blank(lines[above])) above -= 1;
    const h = headings.findLast((entry) => entry.start - 1 <= above);
    if (h === undefined) return null;
    if (h.start - 1 === above) return /^ {0,3}#{1,6}(?:[ \t]|$)/.test(bare(lines[above])) ? h : null;
    const underline = lines.findIndex((line, i) => i > h.start - 1 && UNDERLINE.test(bare(line)));
    return underline === above && lines.slice(h.start - 1, above).every((line) => !blank(line)) ? h : null;
}

/**
 * The imports in `text` the host could load from the file at `from`, by the 0-based line each sits on: every
 * import token naming a file that is there, from that file's directory or as an absolute path, and every one
 * into a home directory, which this cannot see and so counts as loading (a checker refuses what it cannot
 * check). Read by compile's own import reader over the whole text, so a section's imports are the ones the
 * host finds there when it reads the file.
 *
 * @returns {Map<number, string[]>}
 */
function importLines(text, from) {
    const starts = [0];
    for (const line of text.split("\n")) starts.push(starts.at(-1) + line.length + 1);
    const out = new Map();
    for (const { target, index } of importSpans(text)) {
        const bare = importPath(target);
        if (bare === null) continue;
        if (!bare.startsWith("~") && !fs.statSync(path.resolve(path.dirname(from), bare), { throwIfNoEntry: false })?.isFile()) continue;
        const line = starts.findLastIndex((start) => start <= index);
        out.set(line, [...(out.get(line) ?? []), `@${target}`]);
    }
    return out;
}

/** The imports among `importLines`' that sit on lines `first` to `last`, both 0-based and included. */
const importsWithin = (imports, first, last) => [...imports].filter(([line]) => line >= first && line <= last).flatMap(([, found]) => found);

/**
 * The imports `compile` refuses in a unit that is not `always`, as it reads them: a path, neither a home nor an
 * absolute one, naming a file from the unit's own directory.
 */
function strayImports(body, unitFile) {
    const out = [];
    for (const { target } of importSpans(body)) {
        const bare = importPath(target);
        if (bare === null || bare.startsWith("~") || path.isAbsolute(bare)) continue;
        if (fs.statSync(path.resolve(path.dirname(unitFile), bare), { throwIfNoEntry: false })?.isFile()) out.push(`@${target}`);
    }
    return out;
}

// ===========================================================================================
// § The clauses a proof counts
// ===========================================================================================

/**
 * The clauses of `text`, as the moved-content checkers of 2026-09-23 read them: each sentence, and each part
 * of one between a dash, a colon or a semicolon, of 12 characters or more. A block (a paragraph, a heading, a
 * list item, a table row, a line of code) is read on its own, so no clause runs across the line where a
 * section was cut. Marks and markers are not clauses: they are the team's word and the split's, and the host
 * drops both.
 */
export function clausesOf(text) {
    const blocks = [];
    let current = [];
    const flush = () => {
        if (current.length) blocks.push(current.join(" "));
        current = [];
    };
    const lines = text.split("\n");
    const skip = unread(lines);
    for (const [at, raw] of lines.entries()) {
        const line = bare(raw);
        if (line.trim() === "" || MARK.test(line) || MOVED.test(line) || /^ {0,3}(=+|-+)[ \t]*$/.test(line)) {
            flush();
            continue;
        }
        if (skip.has(at) || /^ {0,3}#{1,6}(?:[ \t]|$)/.test(line) || /^\s*\|/.test(line)) {
            flush();
            blocks.push(line.replace(/^ {0,3}#{1,6}[ \t]*/, ""));
            continue;
        }
        if (/^\s*(?:[-*+]|\d{1,9}[.)])[ \t]/.test(line)) flush();
        current.push(line.replace(/^\s*(?:>\s?)+/, "").replace(/^\s*(?:[-*+]|\d{1,9}[.)])[ \t]+/, "").trim());
    }
    flush();
    const out = [];
    for (const block of blocks) {
        const text = block
            .replace(/\s+/g, " ")
            .trim()
            .replace(/([.?!:;])((?:\*\*|\*|_|\)|")*)\s+(?=[A-Z*_`(["|$])/g, "$1$2\n")
            .replaceAll(" | ", "\n");
        for (const sentence of text.split("\n")) {
            for (const part of sentence.split(/ — |: |; |\)_ /)) {
                const clause = part.replace(/^[ .,;:|]+|[ .,;:|]+$/g, "");
                if (clause.length >= 12) out.push(clause);
            }
        }
    }
    return out;
}

/** How many times each clause occurs. */
function tally(clauses) {
    const counts = new Map();
    for (const c of clauses) counts.set(c, (counts.get(c) ?? 0) + 1);
    return counts;
}

/**
 * Where each clause of `before` landed: in `kept`, in `moved`, in neither, or once too often. Counted with
 * multiplicity, so a sentence the file held twice is two clauses.
 */
export function landed(before, kept, moved) {
    const o = tally(before);
    const k = tally(kept);
    const u = tally(moved);
    const result = { clauses: before.length, kept: 0, moved: 0, missing: 0, doubled: 0 };
    for (const [clause, n] of o) {
        const inKept = Math.min(n, k.get(clause) ?? 0);
        const inMoved = Math.min(n - inKept, u.get(clause) ?? 0);
        result.kept += inKept;
        result.moved += inMoved;
        result.missing += n - inKept - inMoved;
        result.doubled += Math.max(0, (k.get(clause) ?? 0) + (u.get(clause) ?? 0) - n);
    }
    for (const [clause, n] of [...k, ...u]) if (!o.has(clause)) result.doubled += n;
    return result;
}

// ===========================================================================================
// § The split
// ===========================================================================================

/** A unit's name from its heading: a slug, never one taken or reserved, suffixed until it is free. */
export function unitName(title, taken) {
    let base = title
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    if (base.length > 48) base = base.slice(0, 48).replace(/-+$/, "");
    if (base === "") base = "section";
    let name = base;
    for (let n = 2; taken.has(name) || RESERVED.has(name); n += 1) name = `${base}-${n}`;
    taken.add(name);
    return name;
}

/** A drafted unit: frontmatter naming the tier and the heading, a blank line, the section as it stood. */
function draftUnit(description, body, eol) {
    const head = ["---", "tier: on-read", `description: ${JSON.stringify(description)}`, "---", ""].map((l) => (eol === "\r\n" ? `${l}\r` : l));
    return `${[...head, ...body].join("\n")}\n`;
}

/** The section a drafted unit holds, exactly as `draftUnit` was given it. */
function draftedBody(text) {
    const lines = text.split("\n");
    const close = lines.findIndex((line, at) => at > 0 && bare(line) === "---");
    return lines.slice(close + 2, -1);
}

/**
 * The lines a mark takes with it: the mark, and the blank line after it where one is also above it, so the
 * section closes up as if the mark had never been written.
 */
function takenWith(lines, at, limit) {
    return at > 0 && blank(lines[at - 1]) && at + 1 <= limit && blank(lines[at + 1]) ? [at, at + 1] : [at];
}

/**
 * What the marked sections of a repository's instruction files would become, proved, with nothing written.
 *
 * @param {{ tree: string, context: string | null, taken: Iterable<string>, read: (rel: string) => string | null }} where
 *   the repository's root; `slots.context`'s directory relative to it (`.portulan/context/`), or null where
 *   none is declared; the unit names already in it; and a reader of a file in the repository, null where absent
 * @returns {{ files: object[], units: object[], refusals: string[], marked: number, index: number }} with
 *   `index` the bytes the index `compile` writes adds to the always tier once the units are in the slot
 */
export function planSplit({ tree, context, taken, read }) {
    const present = [...taken];
    // A name a marker still gives is taken even where its unit is gone, so no new unit answers an old marker.
    const markers = INSTRUCTION_FILES.flatMap((rel) => marksOf(read(rel) ?? "").moved.map((m) => path.posix.basename(m.source, ".md")));
    const names = new Set([...present, ...markers].map((n) => n.toLowerCase()));
    const files = [];
    const units = [];
    const refusals = [];
    let marked = 0;
    for (const rel of INSTRUCTION_FILES) {
        const text = read(rel);
        if (text === null) continue;
        const { marks, moved } = marksOf(text);
        if (marks.length === 0) continue;
        marked += marks.length;
        const refused = refusals.length;
        const from = path.join(tree, ...rel.split("/"));
        // Read through a link, a split would write through it: a CLAUDE.md linked to AGENTS.md would move out of
        // that file sections another host loads whole from it.
        if (fs.lstatSync(from, { throwIfNoEntry: false })?.isSymbolicLink()) {
            refusals.push(`${rel} is a link, to ${posix(path.relative(tree, fs.realpathSync(from)))}, and another host may load that file whole: the split moves sections of a file of its own — make ${rel} one to split it`);
            continue;
        }
        const lines = text.split("\n");
        const eol = text.includes("\r\n") ? "\r\n" : "\n";
        const count = text.endsWith("\n") ? lines.length - 1 : lines.length;
        const at = (line) => `line ${line + 1} of ${rel}`;

        for (const mark of marks.filter((m) => m.heading === null)) {
            refusals.push(`${at(mark.line)} is a mark under no heading: a mark sits directly under the heading of the section it moves, with only blank lines between`);
        }
        const chosen = marks.filter((m) => m.heading !== null);
        for (const inner of chosen) {
            const outer = chosen.find((m) => m !== inner && m.heading.start < inner.heading.start && inner.heading.start <= m.heading.end);
            if (outer) refusals.push(`the section "${inner.heading.title}" (${at(inner.heading.start - 1)}) is marked inside the marked section "${outer.heading.title}": mark one of them`);
        }
        if (context === null) {
            refusals.push(`${rel} has a marked section, and the workspace declares no \`slots.context\` for its unit to go in — declare it, or run \`portulan upgrade\`, which drafts it`);
            continue;
        }

        const imports = importLines(text, from);
        const depth = sectionDepth(text);
        const cuts = [];
        for (const mark of chosen) {
            const h = mark.heading;
            const start = h.start - 1;
            const end = Math.min(h.end, count) - 1;
            let last = end;
            while (last > start && (blank(lines[last]) || last === mark.line)) last -= 1;
            last = Math.max(last, mark.line);
            const dropped = takenWith(lines, mark.line, last);
            const body = lines.slice(start, last + 1).filter((_, i) => !dropped.includes(start + i));
            const title = [...h.parents.slice(depth), h.title].join(" > ");
            const loads = importsWithin(imports, start, last);
            if (loads.length) {
                refusals.push(
                    `the section "${h.title}" (${at(start)}) imports ${loads.join(", ")}, which loads into every context from ${rel}; ` +
                        "an on-read unit's import loads nothing, so the file would leave every context without a word — move the import out of the section, or unmark it",
                );
                continue;
            }
            const nested = moved.find((m) => m.line >= start && m.line <= last);
            if (nested) {
                refusals.push(`the section "${h.title}" (${at(start)}) holds the marker of a section moved before it, ${nested.source}: join that back first, or mark the sections around it`);
                continue;
            }
            const name = unitName(h.title, names);
            const source = `${context}${name}.md`;
            const unitText = draftUnit(title, body, eol);
            try {
                const unit = parseUnit(name, unitText, source);
                const stray = strayImports(unit.body, path.join(tree, ...source.split("/")));
                if (stray.length) throw new InstructionsError(`${stray.join(", ")} names a file from the unit's own directory, and \`compile\` refuses an import in an on-read unit`);
                units.push({ name, source, text: unitText, title, from: rel, bytes: unit.bytes, unit });
                cuts.push({ start, last, dropped, source, body, digest: unitDigest(unitText) });
            } catch (error) {
                refusals.push(`the section "${h.title}" (${at(start)}) would make a unit \`compile\` refuses — ${error.message}`);
            }
        }
        if (refusals.length > refused) continue;

        // Cut from the bottom, so each earlier cut's lines are where the outline said. A marker ends as the
        // section's last line did, which at the end of a file may be with no line end at all.
        const next = [...lines];
        for (const cut of [...cuts].sort((a, b) => b.start - a.start)) {
            next.splice(cut.start, cut.last - cut.start + 1, `${movedMark(cut.source, cut.digest)}${lines[cut.last].endsWith("\r") ? "\r" : ""}`);
        }
        const after = next.join("\n");

        // The proof: each new marker replaced by its unit's body gives back the file less its marks, and the
        // marks took nothing with them but themselves and a blank line each.
        const dropped = new Set(cuts.flatMap((c) => c.dropped));
        const onlyMarks = [...dropped].every((i) => MARK.test(bare(lines[i])) || blank(lines[i]));
        const target = lines.filter((_, i) => !dropped.has(i)).join("\n");
        const bySource = new Map(units.filter((u) => u.from === rel).map((u) => [u.source, draftedBody(u.text)]));
        const reassembled = next
            .flatMap((line) => {
                const marker = MOVED.exec(bare(line));
                return marker && bySource.has(marker[1]) ? bySource.get(marker[1]) : [line];
            })
            .join("\n");
        const exact = onlyMarks && reassembled === target;
        const clauses = landed(
            clausesOf(target),
            clausesOf(after),
            units.filter((u) => u.from === rel).flatMap((u) => clausesOf(draftedBody(u.text).join("\n"))),
        );
        files.push({ rel, before: text, after, exact, clauses, removed: Buffer.byteLength(text, "utf8") - Buffer.byteLength(after, "utf8") });
        if (!exact) refusals.push(`${rel} does not reassemble from its split byte for byte, so nothing of it was moved — this is a defect in the split, not in the file`);
        else if (clauses.missing || clauses.doubled) {
            refusals.push(`${rel}'s clauses do not land once each (${clauses.missing} missing, ${clauses.doubled} doubled), so nothing of it was moved — this is a defect in the split, not in the file`);
        }
    }
    return { files, units, refusals, marked, index: units.length === 0 ? 0 : indexGrowth(units, { context, present, read }) };
}

/** How many levels of lone title headings a file opens with, which a unit's description does not repeat. */
function sectionDepth(text) {
    let depth = 0;
    let level = outlineMd(text).entries;
    while (level.length === 1 && (level[0].children ?? []).length > 0) {
        depth += 1;
        level = level[0].children;
    }
    return depth;
}

/**
 * The bytes the index adds to the always tier once `units` are in the slot: the index `compile` writes for
 * every on-read unit then, less the one on disk, which the always tier counts as it stands, stale or not. A
 * unit already in the slot that cannot be read counts no line, since `compile` refuses it, and the write too.
 */
function indexGrowth(units, { context, present, read }) {
    const onRead = present.flatMap((name) => {
        const source = `${context}${name}.md`;
        try {
            const unit = parseUnit(name, read(source) ?? "", source);
            return unit.tier === "on-read" ? [unit] : [];
        } catch (error) {
            if (error instanceof CompileError || error instanceof InstructionsError) return [];
            throw error;
        }
    });
    const index = claudeCodeGuidance({ units: [...onRead, ...units.map((u) => u.unit)] }).files.find((f) => f.unit === null);
    return Buffer.byteLength(index.text, "utf8") - Buffer.byteLength(read(`${GUIDANCE_RULES_DIR}/${ON_READ_INDEX}`) ?? "", "utf8");
}

// ===========================================================================================
// § The join
// ===========================================================================================

/** A unit's guidance as it stands on disk: the lines under its frontmatter, less the blank lines around them. */
function unitBody(text) {
    const lines = text.split("\n");
    const close = lines.findIndex((line, at) => at > 0 && bare(line) === "---");
    const rest = lines.slice(close + 1);
    while (rest.length && blank(rest[0])) rest.shift();
    while (rest.length && blank(rest[rest.length - 1])) rest.pop();
    return rest;
}

/**
 * Every moved section put back where its marker is, in the line ends it had, and its unit removed, with
 * nothing written. A unit goes back as it stands now, and each says whether it was edited since the move, by
 * its marker's digest, and where its description is no longer its heading's, since the file names a section by
 * its heading alone. A unit that is gone, one not at the top of `slots.context` (`context`, as `planSplit`
 * takes it), one importing a file, and one no longer on-read are refused rather than dropped, removed or
 * undone.
 *
 * @returns {{ files: object[], units: object[], refusals: string[] }}
 */
export function planJoin({ tree, context, read }) {
    const files = [];
    const units = [];
    const refusals = [];
    for (const rel of INSTRUCTION_FILES) {
        const text = read(rel);
        if (text === null) continue;
        const { moved } = marksOf(text);
        if (moved.length === 0) continue;
        const refused = refusals.length;
        const from = path.join(tree, ...rel.split("/"));
        const lines = text.split("\n");
        const back = new Map();
        for (const { line, source, digest } of moved) {
            if (units.some((u) => u.source === source) || back.has(source)) {
                refusals.push(`${source} is named by two markers, line ${line + 1} of ${rel} among them: which one it goes back to is not the join's to guess`);
                continue;
            }
            // The join removes the unit it puts back, so it reads only where the split writes one, at the top
            // of the slot, where `compile` reads a unit: a marker written by hand must not remove a file kept
            // anywhere else.
            if (context === null || !source.startsWith(context) || source.slice(context.length).includes("/")) {
                refusals.push(
                    `line ${line + 1} of ${rel} names ${source}, ${context === null ? "and the workspace declares no `slots.context`" : `which is not at the top of \`slots.context\` (${context})`}, ` +
                        "where the split makes every unit: put the section back by hand, or delete the marker",
                );
                continue;
            }
            const unitText = read(source);
            if (unitText === null) {
                refusals.push(`line ${line + 1} of ${rel} names ${source}, which is not there: restore it, or delete the marker to leave the section retired`);
                continue;
            }
            let unit;
            try {
                unit = parseUnit(path.posix.basename(source, ".md"), unitText, source);
            } catch (error) {
                refusals.push(`${source} could not be read as a unit — ${error.message}`);
                continue;
            }
            // The split made an on-read unit, and a tier the team chose since is theirs: put back into the file,
            // the unit would load in every context and its compiled rule or skill would be removed, unsaid.
            if (unit.tier !== "on-read") {
                refusals.push(
                    `${source} is \`tier: ${unit.tier}\`${unit.paths ? " with `paths`" : ""} now, and the split made it \`on-read\`: ` +
                        `re-tier it to on-read to put it back, or delete the marker at line ${line + 1} of ${rel} to keep it`,
                );
                continue;
            }
            // Each line goes back with the line end its unit holds it with, as the move wrote it, and the
            // last with its marker's, which the split gave the section's last line, as it gave the unit's.
            // Where every line of the unit ends the other way from that marker, a checkout or an editor
            // turned them all, and each takes the marker's.
            const ends = lines[line].endsWith("\r") ? "\r" : "";
            const held = unitBody(unitText);
            const turned = line < lines.length - 1 && held.every((l) => l.endsWith("\r") !== (ends === "\r"));
            const body = held.map((l, i, all) => (i === all.length - 1 || turned ? `${bare(l)}${ends}` : l));
            const loads = [...importLines(body.join("\n"), from).values()].flat();
            if (loads.length) {
                refusals.push(`${source} imports ${loads.join(", ")}, which would load into every context from ${rel}: move the import out of the unit first`);
                continue;
            }
            const bytes = Buffer.byteLength(`${body.join("\n")}\n`, "utf8");
            back.set(source, { source, body, edited: unitDigest(unitText) !== digest, description: unit.description, bytes });
        }
        if (refusals.length > refused) continue;
        const next = [];
        for (const line of lines) {
            const marker = MOVED.exec(bare(line));
            const unit = marker ? back.get(marker[1]) : undefined;
            if (unit === undefined) {
                next.push(line);
                continue;
            }
            unit.at = next.length;
            next.push(...unit.body);
        }
        const after = next.join("\n");
        // The heading each section lands under, as a split of the joined file would describe it.
        const headings = headingsOf(after);
        const depth = sectionDepth(after);
        for (const unit of back.values()) {
            const h = headings.find((entry) => entry.start - 1 === unit.at);
            unit.heading = h === undefined ? null : [...h.parents.slice(depth), h.title].join(" > ");
        }
        const clauses = landed(
            [...clausesOf(text), ...[...back.values()].flatMap((u) => clausesOf(u.body.join("\n")))],
            clausesOf(after),
            [],
        );
        if (clauses.missing || clauses.doubled) {
            refusals.push(`${rel}'s join does not carry every clause once (${clauses.missing} missing, ${clauses.doubled} doubled), so nothing was put back`);
            continue;
        }
        files.push({ rel, before: text, after, clauses, units: [...back.values()] });
        units.push(...back.values());
    }
    return { files, units, refusals };
}

/** What the join says of one unit it puts back: the bytes of its section, where they go, and what changed since the move. */
export function joinLine(unit, rel) {
    const where = unit.heading === null ? rel : `${rel} under "${unit.heading}"`;
    const how = unit.edited ? "as it stands now, edited since the move" : "as the move left it";
    const described = unit.description === unit.heading ? "" : `; its description, "${unit.description}", is not kept, since ${rel} names a section by its heading`;
    return `${unit.source}: ${grouped(unit.bytes)} B go back into ${where}, ${how}${described}`;
}

// ===========================================================================================
// § What `doctor`, the boot and `form` read
// ===========================================================================================

/**
 * The largest sections of one instruction file that a mark could move, by size: the file's top-level sections,
 * less any holding an import that loads from it.
 *
 * @returns {Array<{ title: string, bytes: number }>}
 */
export function movableSections(text, from) {
    const imports = importLines(text, from);
    return sectionsOf(text)
        .sections.filter((s) => importsWithin(imports, s.start - 1, s.end - 1).length === 0)
        .map((s) => ({ title: s.title, bytes: s.bytes }))
        .sort((a, b) => b.bytes - a.bytes);
}

/**
 * The marks waiting in a repository's instruction files, the sections already moved, and each marker naming a
 * unit that is not there.
 *
 * @returns {{ pending: number, moved: number, gone: string[], files: string[] }}
 */
export function instructionsState(tree, read) {
    const state = { pending: 0, moved: 0, gone: [], files: [] };
    for (const rel of INSTRUCTION_FILES) {
        const text = read(rel);
        if (text === null) continue;
        const { marks, moved } = marksOf(text);
        if (marks.length === 0 && moved.length === 0) continue;
        state.files.push(rel);
        state.pending += marks.length;
        state.moved += moved.length;
        for (const { source } of moved) if (read(source) === null) state.gone.push(source);
    }
    return state;
}

/**
 * What a split that was not refused says of itself: a line for each section, where it goes and its size, and
 * one for each file's proof. The command line prints them a line each, and `upgrade` joins them as the reason
 * its step is owed.
 */
export function splitLines(split) {
    return [
        ...split.units.map((u) => `"${u.title}" in ${u.from} → ${u.source}, ${grouped(u.bytes)} B`),
        ...split.files.map(
            ({ rel, clauses: c }) => `${rel} reassembles from its units byte for byte, and of its ${grouped(c.clauses)} clauses ${grouped(c.kept)} stay and ${grouped(c.moved)} move, none missing and none doubled`,
        ),
    ];
}

/**
 * The instruction files large enough to offer the split to, each with the sections a mark could move, largest
 * first: a file over `floor` tokens, `0036`'s offer floor, or any file where the tier is `over` a declared
 * budget. A file that cannot be read is left to the measurement that reads it, which says so, and a link is
 * left out, since the split refuses one.
 *
 * @returns {Array<{ rel: string, tokens: number, sections: Array<{ title: string, tokens: number }> }>}
 */
export function splitOffers(tree, { ratio, floor, over = false }) {
    const offers = [];
    for (const rel of INSTRUCTION_FILES) {
        const from = path.join(tree, ...rel.split("/"));
        let text;
        try {
            // A link out of the repository loads what it points at, but that file is not this repository's
            // to split, as `./context.mjs` does not count it.
            if (!isInside(fs.realpathSync(tree), fs.realpathSync(from)) || fs.lstatSync(from).isSymbolicLink()) continue;
            text = fs.readFileSync(from, "utf8");
        } catch {
            continue;
        }
        const tokens = Math.round(Buffer.byteLength(text, "utf8") / ratio);
        if (tokens <= floor && !over) continue;
        const sections = movableSections(text, from).map((s) => ({ title: s.title, tokens: Math.round(s.bytes / ratio) }));
        if (sections.length) offers.push({ rel, tokens, sections });
    }
    return offers;
}

/**
 * The offers as one sentence, null where there is none: the same for `doctor`'s line, the boot's and `init`'s
 * report, naming each file and the largest sections of them all. Over a declared budget `doctor` fails and
 * `upgrade` will not run, so there the sentence names the command that moves a marked section all the same.
 */
export function offerText(offers, { over = false, workspace = null } = {}, shown = 3) {
    if (offers.length === 0) return null;
    const two = offers.length > 1;
    const named = offers
        .flatMap((o) => o.sections.map((s) => ({ ...s, rel: o.rel })))
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, shown)
        .map((s) => `"${s.title}"${two ? ` (${s.rel})` : ""} ~${grouped(s.tokens)}`);
    const listed = named.length === 1 ? named[0] : `${named.slice(0, -1).join(", ")} and ${named.at(-1)}`;
    const files = offers.map((o, i) => (i === 0 ? `${o.rel} is ~${grouped(o.tokens)} tokens in every context` : `${o.rel} ~${grouped(o.tokens)}`)).join(" and ");
    const command = over ? splitCommand(workspace) : "portulan upgrade --write";
    return (
        `${files}, and a line \`${ON_READ_MARK}\` under a heading moves that section to an on-read unit at the next \`${command}\`: ` +
        `${two ? "their" : "its"} largest ${named.length === 1 ? "is" : "are"} ${listed} tokens`
    );
}

/**
 * The command that moves a workspace's marked sections where `upgrade` will not run, with `workspace` as a shell
 * reads it from where the command is given.
 */
export function splitCommand(workspace = null) {
    return `node <plugin root>/cli/instructions.mjs --workspace ${workspace === null ? "<dir>" : shellWord(workspace)} --write`;
}

/** A path as a shell reads it as one word: quoted where it holds anything but a path's plain characters. */
export const shellWord = (word) => (/^[\w./-]+$/.test(word) ? word : `'${word.replaceAll("'", "'\\''")}'`);

/**
 * `slots.context`'s directory relative to the repository at `tree`, as a reader of it types the path, with a
 * trailing `/`; null where the manifest declares none. Refused where it lies outside the workspace or the
 * repository, as `compile` refuses it.
 */
export function contextDir(tree, workspaceDir, manifest) {
    const declared = manifest?.slots?.context;
    if (typeof declared !== "string") return null;
    const dir = path.resolve(workspaceDir, declared);
    if (!isInside(workspaceDir, dir) || !isInside(tree, dir) || path.resolve(tree) === dir) {
        throw new InstructionsError(`\`slots.context\` (${declared}) lies outside the workspace or its repository`);
    }
    return `${posix(path.relative(tree, dir))}/`;
}

/** A reader of a file in the repository at `tree`, null where it is absent; a link out of it is refused. */
export function treeReader(tree) {
    const real = fs.realpathSync(tree);
    return (rel) => {
        const at = path.resolve(tree, ...rel.split("/"));
        if (!isInside(tree, at)) throw new InstructionsError(`${rel} resolves outside the repository`);
        let text;
        try {
            if (!isInside(real, fs.realpathSync(at))) throw new InstructionsError(`${rel} is a link out of the repository, which this does not read`);
            text = fs.readFileSync(at, "utf8");
        } catch (error) {
            if (error instanceof InstructionsError) throw error;
            if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
            throw new InstructionsError(`${rel} could not be read — ${error.code ?? error.message}`);
        }
        return text;
    };
}

// ===========================================================================================
// § The command line
// ===========================================================================================

function parseArgs(argv) {
    const options = { workspace: null, write: false, join: false };
    for (let i = 0; i < argv.length; i += 1) {
        const flag = argv[i];
        if (flag === "--write" || flag === "--join") {
            const key = flag.slice(2);
            if (options[key]) throw new InstructionsError(`${flag} is given twice`);
            options[key] = true;
        } else if (flag === "--workspace") {
            const value = argv[i + 1];
            i += 1;
            if (value === undefined) throw new InstructionsError("--workspace needs a value");
            options.workspace = value;
        } else {
            throw new InstructionsError(`unknown argument ${JSON.stringify(flag)}`);
        }
    }
    if (options.workspace === null) throw new InstructionsError("--workspace <dir> is required: the directory holding workspace.json");
    return options;
}

/** The workspace, its repository and its guidance slot, as the split reads them. */
function locate(workspaceDir) {
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(workspaceDir, "workspace.json"), "utf8"));
    } catch (error) {
        throw new InstructionsError(`${path.join(workspaceDir, "workspace.json")} could not be read as a manifest — ${error.code ?? error.message}`);
    }
    if (typeof manifest?.tree !== "string") throw new InstructionsError("the workspace declares no `tree`, so there is no repository whose instruction file it could split");
    const tree = path.resolve(workspaceDir, manifest.tree);
    if (!fs.statSync(tree, { throwIfNoEntry: false })?.isDirectory()) throw new InstructionsError(`tree (${manifest.tree}) names no directory`);
    const context = contextDir(tree, workspaceDir, manifest);
    let taken = [];
    try {
        if (context !== null) taken = fs.readdirSync(path.join(tree, context)).filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3));
    } catch (error) {
        // A slot declared and not yet made takes its first unit from this split; anything else is unread.
        if (error.code !== "ENOENT") throw new InstructionsError(`\`slots.context\` (${manifest.slots.context}) could not be listed — ${error.code ?? error.message}`);
    }
    return { manifest, tree, context, taken };
}

// `write` is the suite's, as `applyEdits` takes it: a write failing partway cannot be staged on a real disk.
export async function run(argv, say = (line) => process.stdout.write(`${line}\n`), { cwd = process.cwd(), write } = {}) {
    let options;
    let where;
    try {
        options = parseArgs(argv);
        where = locate(path.resolve(cwd, options.workspace));
    } catch (error) {
        if (!(error instanceof InstructionsError)) throw error;
        say(`instructions: ${error.message}`);
        return 2;
    }
    const workspaceDir = path.resolve(cwd, options.workspace);
    const read = treeReader(where.tree);
    // Loaded here and not at the top: `./context.mjs` imports this module for the context line, and `upgrade`
    // reaches it through a migration step, so a static edge to either would close a cycle.
    const context = await import("./context.mjs");
    const { applyEdits, restore } = await import("./upgrade.mjs");
    let declared;
    try {
        declared = context.declaredContext(where.manifest);
    } catch (error) {
        if (!(error instanceof context.ContextError)) throw error;
        say(`instructions: ${error.message}`);
        return 2;
    }
    const ratio = declared.ratio ?? context.ESTIMATED_BYTES_PER_TOKEN;
    const tokens = (bytes) => `~${grouped(context.tokensOf(bytes, ratio))} tokens`;
    const alwaysBytes = () => context.alwaysTier(where.tree).entries.reduce((n, e) => n + e.bytes, 0);

    let edits;
    try {
        if (options.join) {
            const joined = planJoin({ tree: where.tree, context: where.context, read });
            for (const r of joined.refusals) say(`instructions: refused — ${r}`);
            if (joined.refusals.length) return 2;
            if (joined.files.length === 0) {
                say("instructions: no section of CLAUDE.md or .claude/CLAUDE.md is moved, so there is nothing to join");
                return 0;
            }
            for (const f of joined.files) {
                for (const unit of f.units) say(`instructions: ${joinLine(unit, f.rel)}`);
                const n = f.units.length;
                say(`instructions: ${f.rel} takes back ${n} section${n === 1 ? "" : "s"}, and each of the ${grouped(f.clauses.clauses)} clauses lands once, none missing and none doubled`);
            }
            edits = [
                ...joined.files.map((f) => ({ root: "tree", file: f.rel, next: f.after })),
                ...joined.units.map((u) => ({ root: "tree", file: u.source, next: null })),
            ];
        } else {
            const split = planSplit({ tree: where.tree, context: where.context, taken: where.taken, read });
            for (const r of split.refusals) say(`instructions: refused — ${r}`);
            if (split.refusals.length) return 2;
            if (split.marked === 0) {
                say(`instructions: no section of CLAUDE.md or .claude/CLAUDE.md is marked — a line \`${ON_READ_MARK}\` under a heading marks its section`);
                return 0;
            }
            for (const line of splitLines(split)) say(`instructions: ${line}`);
            const before = alwaysBytes();
            const after = before - split.files.reduce((n, f) => n + f.removed, 0) + split.index;
            say(`instructions: the always tier goes from ${grouped(before)} B (${tokens(before)}) to ${grouped(after)} B (${tokens(after)}) at ${ratio} bytes per token, markers counted, which the host drops`);
            edits = [
                ...split.files.map((f) => ({ root: "tree", file: f.rel, next: f.after })),
                ...split.units.map((u) => ({ root: "tree", file: u.source, next: u.text })),
            ];
        }
    } catch (error) {
        if (!(error instanceof InstructionsError || error instanceof context.ContextError)) throw error;
        say(`instructions: ${error.message}`);
        return 2;
    }
    if (!options.write) {
        say("instructions: nothing was written — run with --write to apply it");
        return 0;
    }

    const applied = applyEdits(workspaceDir, edits, { treeDir: where.tree, write });
    const undo = (why) => {
        const back = restore(workspaceDir, applied.snapshots, { treeDir: where.tree });
        say(`instructions: ${why}; ${back.ok ? "rolled back, nothing is changed" : `the rollback was INCOMPLETE — not put back: ${back.failed.join(", ")}`}`);
        return 2;
    };
    if (!applied.ok) return undo(`the write failed — ${applied.reason}`);
    // The index goes through the same writes, as `upgrade`'s `0007` writes it, so a rollback takes it too.
    let compiled;
    try {
        compiled = guidanceEdits(workspaceDir).edits.map((edit) => ({ root: "tree", file: edit.file, next: edit.next }));
    } catch (error) {
        return undo(`\`compile\` refused the guidance — ${error.message}`);
    }
    const indexed = applyEdits(workspaceDir, compiled, { treeDir: where.tree, write });
    applied.snapshots.push(...indexed.snapshots);
    if (!indexed.ok) return undo(`the index could not be written — ${indexed.reason}`);
    let now;
    try {
        now = alwaysBytes();
    } catch (error) {
        if (!(error instanceof context.ContextError)) throw error;
        say(`instructions: written, and the index compiled; the always tier could not be measured after it — ${error.message}`);
        return 0;
    }
    // A budget already declared is the team's figure, and the split does not offer another.
    const offer =
        options.join || declared.budget !== null
            ? ""
            : `. A budget is yours to declare: 0036 offers the larger of ${grouped(context.OFFER_FLOOR_TOKENS)} tokens and that, ` +
              `${grouped(Math.max(context.OFFER_FLOOR_TOKENS, context.tokensOf(now, ratio)))}, as \`context.always.budget.tokens\``;
    say(`instructions: written, and the index compiled: the always tier is ${grouped(now)} B (${tokens(now)})${offer}`);
    return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    // Not awaited at the top level: `run` loads `./context.mjs`, which imports this module, and a module still
    // suspended in a top-level await leaves that import waiting on itself, so the command would print nothing.
    run(process.argv.slice(2)).then(
        (code) => {
            process.exitCode = code;
        },
        (cause) => {
            process.stderr.write(`instructions: could not run — ${cause?.stack ?? cause}\nThis is a defect in the tool, not a verdict about the repository: nothing was judged.\n`);
            process.exitCode = 2;
        },
    );
}
