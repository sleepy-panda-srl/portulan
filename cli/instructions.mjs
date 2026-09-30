#!/usr/bin/env node
// `instructions` — the sections a team marks in its own instruction file, moved to on-read units and proved.
//
//   node cli/instructions.mjs --workspace <dir>                   what would move, proved; nothing written
//   node cli/instructions.mjs --workspace <dir> --write           move it, then compile the index
//   node cli/instructions.mjs --workspace <dir> --join [--write]  put every moved section back
//
// Claude Code 2.1.281 removes each block-level `<!-- … -->` from an instruction file or rule it loads, so a mark or marker costs no context.
//
// Exit 0 printed or written · 2 could not: a refused mark, a split that does not reassemble, a failed read or write. There is no 1.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { BOOT_CARD_UNIT, CompileError, GUIDANCE_RULES_DIR, ON_READ_INDEX, claudeCodeGuidance, guidanceEdits, importPath, importSpans, parseUnit } from "./compile.mjs";
import { isInside } from "./inside.mjs";
import { outlineMd } from "./symbols.mjs";

/** The project instruction files Claude Code loads whole into every context. */
export const INSTRUCTION_FILES = ["CLAUDE.md", ".claude/CLAUDE.md"];

/** The team's word that the section whose heading sits directly above this line moves to an on-read unit. */
export const ON_READ_MARK = "<!-- portulan: on-read -->";

/** The mark as a line may carry it: indented less than a code block is, and with space after it. */
const MARK = /^ {0,3}<!-- portulan: on-read -->[ \t]*$/;

const MOVED = /^ {0,3}<!-- portulan: on-read (.+?) ([0-9a-f]{8}) -->[ \t]*$/;
export const movedMark = (source, digest) => `<!-- portulan: on-read ${source} ${digest} -->`;

/** Only the section the join puts back, each line without its `\r`: an edited description or a checkout's line ends is no edit. */
export const unitDigest = (text) => createHash("sha256").update(unitBody(text).map(bare).join("\n"), "utf8").digest("hex").slice(0, 8);

const RESERVED = new Set([BOOT_CARD_UNIT, path.basename(ON_READ_INDEX, ".md")]);

export class InstructionsError extends Error {}

const posix = (p) => p.split(path.sep).join("/");
const bare = (line) => line.replace(/\r$/, "");
const blank = (line) => bare(line).trim() === "";
export const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ===========================================================================================
// § A file's lines, the ones Markdown does not read as text, and its sections
// ===========================================================================================

/** The lines a mark cannot sit on, as `outlineMd` reads them: the frontmatter, fenced blocks and multi-line HTML comments. */
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

/** Lines are 0-based; a mark's `heading` is null where no heading sits directly above it. */
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

function headingAbove(lines, headings, at) {
    let above = at - 1;
    while (above >= 0 && blank(lines[above])) above -= 1;
    const h = headings.findLast((entry) => entry.start - 1 <= above);
    if (h === undefined) return null;
    const atx = /^ {0,3}#{1,6}(?:[ \t]|$)/.test(bare(lines[h.start - 1]));
    if (h.start - 1 === above) return atx ? h : null;
    // An ATX heading has no underline: a `---` under one is a rule, and a mark under that is under no heading.
    if (atx) return null;
    const underline = lines.findIndex((line, i) => i > h.start - 1 && UNDERLINE.test(bare(line)));
    return underline === above && lines.slice(h.start - 1, above).every((line) => !blank(line)) ? h : null;
}

/** Keyed by 0-based line; an import into a home directory, which this cannot see, counts as loading. */
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

const importsWithin = (imports, first, last) => [...imports].filter(([line]) => line >= first && line <= last).flatMap(([, found]) => found);

/** The imports `compile` refuses in a unit that is not `always`. */
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

/** Each sentence, and each part of one between a dash, a colon or a semicolon, of 12 characters or more, block by block. */
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

function tally(clauses) {
    const counts = new Map();
    for (const c of clauses) counts.set(c, (counts.get(c) ?? 0) + 1);
    return counts;
}

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

function draftUnit(description, body, eol, ended) {
    const head = ["---", "tier: on-read", `description: ${JSON.stringify(description)}`, "---", ""].map((l) => (eol === "\r\n" ? `${l}\r` : l));
    return `${[...head, ...body].join("\n")}${ended ? "\n" : ""}`;
}

function draftedBody(text) {
    const lines = text.split("\n");
    const close = lines.findIndex((line, at) => at > 0 && bare(line) === "---");
    return lines.slice(close + 2, text.endsWith("\n") ? -1 : undefined);
}

function takenWith(lines, at, limit) {
    return at > 0 && blank(lines[at - 1]) && at + 1 <= limit && blank(lines[at + 1]) ? [at, at + 1] : [at];
}

/** Proved, with nothing written: `context` is `contextDir`'s answer, and `read` gives null for an absent file. */
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
        const link = linkRefusal(tree, rel);
        if (link !== null) {
            refusals.push(link);
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
            const unitText = draftUnit(title, body, eol, last < lines.length - 1);
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

        // Cut from the bottom, so each earlier cut's lines are where the outline said.
        const next = [...lines];
        for (const cut of [...cuts].sort((a, b) => b.start - a.start)) {
            next.splice(cut.start, cut.last - cut.start + 1, `${movedMark(cut.source, cut.digest)}${lines[cut.last].endsWith("\r") ? "\r" : ""}`);
        }
        const after = next.join("\n");

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

function sectionDepth(text) {
    let depth = 0;
    let level = outlineMd(text).entries;
    while (level.length === 1 && (level[0].children ?? []).length > 0) {
        depth += 1;
        level = level[0].children;
    }
    return depth;
}

/** A unit in the slot that cannot be read counts no line, since `compile` refuses it. */
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

function unitBody(text) {
    const lines = text.split("\n");
    const close = lines.findIndex((line, at) => at > 0 && bare(line) === "---");
    const rest = lines.slice(close + 1);
    while (rest.length && blank(rest[0])) rest.shift();
    while (rest.length && blank(rest[rest.length - 1])) rest.pop();
    return rest;
}

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
            // The join removes the unit it puts back, so a marker written by hand must not reach a file outside the slot's top.
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
            if (unit.tier !== "on-read") {
                refusals.push(
                    `${source} is \`tier: ${unit.tier}\`${unit.paths ? " with `paths`" : ""} now, and the split made it \`on-read\`: ` +
                        `re-tier it to on-read to put it back, or delete the marker at line ${line + 1} of ${rel} to keep it`,
                );
                continue;
            }
            // Where every line of the unit ends the other way from its marker, a checkout turned them all, and each takes the marker's.
            const ends = lines[line].endsWith("\r") ? "\r" : "";
            const held = unitBody(unitText);
            const turned = line < lines.length - 1 && held.every((l) => l.endsWith("\r") !== (ends === "\r"));
            const body = held.map((l, i, all) => (i === all.length - 1 || turned ? `${bare(l)}${ends}` : l));
            const loads = [...importLines(body.join("\n"), from).values()].flat();
            if (loads.length) {
                refusals.push(`${source} imports ${loads.join(", ")}, which would load into every context from ${rel}: move the import out of the unit first`);
                continue;
            }
            const bytes = Buffer.byteLength(body.join("\n"), "utf8") + (line < lines.length - 1 ? 1 : 0);
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

export function joinLine(unit, rel) {
    const where = unit.heading === null ? rel : `${rel} under "${unit.heading}"`;
    const how = unit.edited ? "as it stands now, edited since the move" : "as the move left it";
    const described = unit.description === unit.heading ? "" : `; its description, "${unit.description}", is not kept, since ${rel} names a section by its heading`;
    return `${unit.source}: ${grouped(unit.bytes)} B go back into ${where}, ${how}${described}`;
}

// ===========================================================================================
// § What `doctor`, the boot and `form` read
// ===========================================================================================

export function movableSections(text, from) {
    const imports = importLines(text, from);
    return sectionsOf(text)
        .sections.filter((s) => importsWithin(imports, s.start - 1, s.end - 1).length === 0)
        .map((s) => ({ title: s.title, bytes: s.bytes }))
        .sort((a, b) => b.bytes - a.bytes);
}

export function instructionsState(tree, read) {
    const state = { pending: 0, moved: 0, gone: [], files: [], linked: [] };
    const readThrough = instructionReader(tree, read);
    for (const rel of INSTRUCTION_FILES) {
        const text = readThrough(rel);
        if (text === null) continue;
        const { marks, moved } = marksOf(text);
        if (marks.length === 0 && moved.length === 0) continue;
        state.files.push(rel);
        state.pending += marks.length;
        state.moved += moved.length;
        if (marks.length && linkRefusal(tree, rel) !== null) state.linked.push(rel);
        for (const { source } of moved) if (read(source) === null) state.gone.push(source);
    }
    return state;
}

export function linkRefusal(tree, rel) {
    const at = path.join(tree, ...rel.split("/"));
    if (!fs.lstatSync(at, { throwIfNoEntry: false })?.isSymbolicLink()) return null;
    return `${rel} is a link, to ${posix(path.relative(fs.realpathSync(tree), fs.realpathSync(at)))}, and another host may load that file whole: the split moves sections of a file of its own — make ${rel} one to split it`;
}

/** `read`, but through an instruction file's link that stays in the repository, so the split sees the marks it refuses. */
export function instructionReader(tree, read) {
    return (rel) => {
        const at = path.join(tree, ...rel.split("/"));
        if (!INSTRUCTION_FILES.includes(rel) || !fs.lstatSync(at, { throwIfNoEntry: false })?.isSymbolicLink()) return read(rel);
        let to;
        try {
            to = fs.realpathSync(at);
        } catch (error) {
            if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
            throw new InstructionsError(`${rel} could not be followed — ${error.code ?? error.message}`);
        }
        if (!isInside(fs.realpathSync(tree), to)) return null;
        try {
            return fs.readFileSync(to, "utf8");
        } catch (error) {
            throw new InstructionsError(`${rel} could not be read — ${error.code ?? error.message}`);
        }
    };
}

export function splitLines(split) {
    return [
        ...split.units.map((u) => `"${u.title}" in ${u.from} → ${u.source}, ${grouped(u.bytes)} B`),
        ...split.files.map(
            ({ rel, clauses: c }) => `${rel} reassembles from its units byte for byte, and of its ${grouped(c.clauses)} clauses ${grouped(c.kept)} stay and ${grouped(c.moved)} move, none missing and none doubled`,
        ),
    ];
}

/** A file that cannot be read is left to the measurement that reads it, which says so. */
export function splitOffers(tree, { ratio, floor, over = false }) {
    const offers = [];
    for (const rel of INSTRUCTION_FILES) {
        const from = path.join(tree, ...rel.split("/"));
        let text;
        try {
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

/** Over a declared budget `upgrade` will not run, so there the sentence names the command that moves a section. */
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

export function splitCommand(workspace = null) {
    return `node <plugin root>/cli/instructions.mjs --workspace ${workspace === null ? "<dir>" : shellWord(workspace)} --write`;
}

export const shellWord = (word) => (/^[\w./-]+$/.test(word) ? word : `'${word.replaceAll("'", "'\\''")}'`);

export function contextDir(tree, workspaceDir, manifest) {
    const declared = manifest?.slots?.context;
    if (typeof declared !== "string") return null;
    const dir = path.resolve(workspaceDir, declared);
    if (!isInside(workspaceDir, dir) || !isInside(tree, dir) || path.resolve(tree) === dir) {
        throw new InstructionsError(`\`slots.context\` (${declared}) lies outside the workspace or its repository`);
    }
    return `${posix(path.relative(tree, dir))}/`;
}

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
        // A slot declared and not yet made takes its first unit from this split.
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
    // Loaded here, not at the top: `./context.mjs` and `./upgrade.mjs` reach this module, so a static edge would close a cycle.
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
    const offer =
        options.join || declared.budget !== null
            ? ""
            : `. A budget is yours to declare: 0036 offers the larger of ${grouped(context.OFFER_FLOOR_TOKENS)} tokens and that, ` +
              `${grouped(Math.max(context.OFFER_FLOOR_TOKENS, context.tokensOf(now, ratio)))}, as \`context.always.budget.tokens\``;
    say(`instructions: written, and the index compiled: the always tier is ${grouped(now)} B (${tokens(now)})${offer}`);
    return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    // Not awaited at the top level: `run` imports `./context.mjs`, whose import of this module would then wait on itself.
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
