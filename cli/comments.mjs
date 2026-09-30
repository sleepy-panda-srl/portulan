#!/usr/bin/env node
// `comments` — the comments in a tree that record a change's history instead of what the code cannot show.
//
//   node cli/comments.mjs [--root <dir>] [--limit <count>] [--bytes <count>] [--list] [--exclude <path prefix>]...
//
// Exit 0 within the limit and the rail given · 1 over one · 2 could not run.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { ENGINE_LINE, GATES_LINE, LEADS_LINE } from "./compile.mjs";
import { NOTE_PERCENT, railFor } from "./context.mjs";

export class CommentsError extends Error {}

const EXTENSIONS = new Map([
    ...[".js", ".mjs", ".cjs", ".jsx", ".ts", ".mts", ".cts", ".tsx", ".jsonc"].map((ext) => [ext, "js"]),
    ...[".sh", ".bash"].map((ext) => [ext, "shell"]),
    ...[".yml", ".yaml"].map((ext) => [ext, "yaml"]),
    [".json", "json"],
    [".md", "markdown"],
]);

export function languageOf(file, firstLine = "") {
    const language = EXTENSIONS.get(path.extname(file).toLowerCase());
    if (language) return language;
    if (path.extname(file)) return null;
    if (/^#!.*\b(ba|da|k|z)?sh\b/.test(firstLine)) return "shell";
    if (/^#!.*\bnode\b/.test(firstLine)) return "js";
    return null;
}

function lineStarts(source) {
    const starts = [0];
    for (let i = source.indexOf("\n"); i !== -1; i = source.indexOf("\n", i + 1)) starts.push(i + 1);
    return starts;
}

function lineAt(starts, offset) {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
        const mid = (low + high + 1) >> 1;
        if (starts[mid] <= offset) low = mid;
        else high = mid - 1;
    }
    return low;
}

/** One entry per source line comments span: its line number, their text, and the bytes deleting them frees. */
function spansToComments(source, spans, markers) {
    const starts = lineStarts(source);
    const comments = new Map();
    for (const [from, to] of spans) {
        for (let index = lineAt(starts, from); index < starts.length && starts[index] < to; index++) {
            const lineEnd = index + 1 < starts.length ? starts[index + 1] - 1 : source.length;
            const start = Math.max(from, starts[index]);
            const end = Math.min(to, lineEnd);
            const raw = source.slice(start, end);
            const alone = !source.slice(starts[index], start).trim() && !source.slice(end, lineEnd).trim();
            const bytes = alone ? Buffer.byteLength(source.slice(starts[index], lineEnd + 1)) : Buffer.byteLength(raw);
            const text = markers(raw).trim();
            const seen = comments.get(index);
            if (seen) comments.set(index, { ...seen, text: [seen.text, text].filter(Boolean).join(" "), bytes: seen.bytes + bytes });
            else comments.set(index, { line: index + 1, text, bytes });
        }
    }
    return [...comments.values()].sort((a, b) => a.line - b.line);
}

const JS_MARKERS = (raw) => raw.replace(/^\s*(\/\/+|\/\*+|\*(?!\/))/, "").replace(/\*+\/\s*$/, "");
const HASH_MARKERS = (raw) => raw.replace(/^\s*(#+|\/\/+)/, "");
const HTML_MARKERS = (raw) => raw.replace(/^\s*<!--/, "").replace(/-->\s*$/, "");

const REGEX_AFTER_WORD = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);
const REGEX_AFTER_PUNCTUATOR = new Set([..."(,=:[!&|?{};+-*%<>~^}"]);
const WORD_START = /[\p{L}_$#]/u;
const WORD_PART = /[\p{L}\p{N}_$]/u;

function skipQuoted(source, i, quote) {
    for (let j = i + 1; j < source.length; j++) {
        if (source[j] === "\\") j++;
        else if (source[j] === quote || source[j] === "\n") return j + 1;
    }
    return source.length;
}

function skipRegex(source, i) {
    let inClass = false;
    for (let j = i + 1; j < source.length; j++) {
        const c = source[j];
        if (c === "\\") j++;
        else if (c === "\n") return j;
        else if (c === "[") inClass = true;
        else if (c === "]") inClass = false;
        else if (c === "/" && !inClass) {
            let k = j + 1;
            while (k < source.length && /[a-z]/i.test(source[k])) k++;
            return k;
        }
    }
    return source.length;
}

/** From inside a template literal: the offset after its closing backtick, or after the `${` that interrupts it. */
function skipTemplate(source, i) {
    for (let j = i; j < source.length; j++) {
        if (source[j] === "\\") j++;
        else if (source[j] === "`") return { end: j + 1, open: false };
        else if (source[j] === "$" && source[j + 1] === "{") return { end: j + 2, open: true };
    }
    return { end: source.length, open: false };
}

export function jsComments(source) {
    const spans = [];
    const resumeAt = [];
    let depth = 0;
    let last = "";
    let i = source.startsWith("#!") ? source.indexOf("\n") : 0;
    if (i === -1) return [];
    const enterTemplate = (from) => {
        const { end, open } = skipTemplate(source, from);
        if (open) {
            resumeAt.push(depth);
            depth++;
            last = "{";
        } else last = "value";
        return end;
    };
    while (i < source.length) {
        const c = source[i];
        const next = source[i + 1];
        if (/\s/.test(c)) i++;
        else if (c === "/" && next === "/") {
            const end = source.indexOf("\n", i);
            spans.push([i, end === -1 ? source.length : end]);
            i = end === -1 ? source.length : end;
        } else if (c === "/" && next === "*") {
            const close = source.indexOf("*/", i + 2);
            const end = close === -1 ? source.length : close + 2;
            spans.push([i, end]);
            i = end;
        } else if (c === "'" || c === '"') {
            i = skipQuoted(source, i, c);
            last = "value";
        } else if (c === "`") i = enterTemplate(i + 1);
        else if (c === "/") {
            const regex = last === "" || REGEX_AFTER_PUNCTUATOR.has(last) || REGEX_AFTER_WORD.has(last);
            i = regex ? skipRegex(source, i) : i + 1;
            last = regex ? "value" : "/";
        } else if (c === "{") {
            depth++;
            last = c;
            i++;
        } else if (c === "}") {
            depth--;
            i++;
            if (resumeAt.length && resumeAt.at(-1) === depth) {
                resumeAt.pop();
                i = enterTemplate(i);
            } else last = c;
        } else if (WORD_START.test(c) || /\d/.test(c)) {
            let j = i + 1;
            while (j < source.length && (WORD_PART.test(source[j]) || (/\d/.test(c) && source[j] === "."))) j++;
            const word = source.slice(i, j);
            last = REGEX_AFTER_WORD.has(word) ? word : "value";
            i = j;
        } else if ((c === "+" || c === "-") && next === c) {
            last = "value";
            i += 2;
        } else {
            last = c === ")" || c === "]" ? "value" : c;
            i++;
        }
    }
    return spansToComments(source, spans, JS_MARKERS);
}

const SHELL_WORD_BREAK = new Set([..." \t\n;&|()<>"]);
const PROGRAM_FLAGS = new Set(["-e", "-c", "-p", "--eval", "--print"]);
const PROGRAMS = new Set(["awk", "gawk", "mawk", "nawk", "node", "python", "python3", "perl", "ruby", "jq", "sed", "bash", "sh", "zsh", "dash", "ksh"]);
const WRAPPERS = new Set(["command", "exec", "env"]);
const RESERVED = new Set(["if", "then", "else", "elif", "do", "while", "until", "!", "{", "time"]);
const ASSIGNMENT = /^[A-Za-z_]\w*=/;
const HEREDOC = /^<<(-?)\s*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([A-Za-z_][\w.-]*))/;

const unquoted = (word) => word.replace(/["'\\]/g, "");

function takesProgram(words, before) {
    if (PROGRAM_FLAGS.has(unquoted(before))) return true;
    let at = 0;
    while (ASSIGNMENT.test(words[at] ?? "")) at++;
    while (WRAPPERS.has(words[at])) {
        at++;
        while (/^-|^[A-Za-z_]\w*=/.test(words[at] ?? "")) at++;
    }
    return at < words.length && PROGRAMS.has(path.posix.basename(unquoted(words[at])));
}

/** A program quoted across lines, as awk, jq or `node -e` take one: each later line opening `#` or `//`. */
function embeddedComments(source, from, to) {
    const spans = [];
    for (let at = source.indexOf("\n", from); at !== -1 && at < to; at = source.indexOf("\n", at + 1)) {
        const lineEnd = Math.min(to, source.indexOf("\n", at + 1) === -1 ? source.length : source.indexOf("\n", at + 1));
        const marker = /^[ \t]*(#|\/\/)/.exec(source.slice(at + 1, lineEnd));
        if (marker) spans.push([at + 1 + marker[0].length - marker[1].length, lineEnd]);
    }
    return spans;
}

/** From `((`, the offset after the `))` closing it on the same line: `<<` inside is a shift, not a heredoc. */
function arithmeticEnd(source, i) {
    let depth = 0;
    for (let j = i; j < source.length && source[j] !== "\n"; j++) {
        if (source[j] === "(") depth++;
        else if (source[j] === ")" && --depth === 0) return j + 1;
    }
    return null;
}

export function shellComments(source) {
    const spans = [];
    const heredocs = [];
    const skipHeredocBodies = (from) => {
        let at = from;
        for (const { word, tabs } of heredocs.splice(0)) {
            while (at < source.length) {
                const end = source.indexOf("\n", at);
                const lineEnd = end === -1 ? source.length : end;
                const text = source.slice(at, lineEnd);
                at = lineEnd + 1;
                if ((tabs ? text.replace(/^\t+/, "") : text) === word) break;
            }
        }
        return at;
    };
    const doubleQuoted = (i) => {
        let j = i + 1;
        while (j < source.length && source[j] !== '"') {
            if (source[j] === "\\") j += 2;
            else if (source[j] === "`") j = lex(j + 1, "`");
            else if (source[j] === "$" && source[j + 1] === "(" && source[j + 2] !== "(") j = lex(j + 2, ")");
            else j++;
        }
        return j + 1;
    };
    /** Shell from `from` to its closing `)` or backtick, or the end: the offset after the close. */
    function lex(from, closer) {
        const words = [];
        let start = -1;
        let depth = 0;
        const endWord = (at) => {
            if (start !== -1 && (words.length || !RESERVED.has(source.slice(start, at)))) words.push(source.slice(start, at));
            start = -1;
        };
        let i = from;
        while (i < source.length) {
            const c = source[i];
            const arithmetic = c === "(" && source[i + 1] === "(" ? arithmeticEnd(source, i) : null;
            if (c === closer && (closer === "`" || depth === 0)) return i + 1;
            if (c === "\n") {
                endWord(i);
                words.length = 0;
                i = heredocs.length ? skipHeredocBodies(i + 1) : i + 1;
            } else if (c === "\\") {
                if (source[i + 1] !== "\n" && start === -1) start = i;
                i += 2;
            } else if (c === "#" && (i === from || SHELL_WORD_BREAK.has(source[i - 1]))) {
                const end = source.indexOf("\n", i);
                spans.push([i, end === -1 ? source.length : end]);
                i = end === -1 ? source.length : end;
            } else if (c === "'") {
                const close = source.indexOf("'", i + 1);
                const end = close === -1 ? source.length : close;
                const before = start === -1 ? (words.at(-1) ?? "") : source.slice(start, i).replace(/=$/, "");
                if (takesProgram(words, before)) spans.push(...embeddedComments(source, i + 1, end));
                if (start === -1) start = i;
                i = end + 1;
            } else if (arithmetic !== null) i = arithmetic;
            else if (source.startsWith("<<<", i)) {
                endWord(i);
                i += 3;
            } else if (source.startsWith("<<", i)) {
                endWord(i);
                const lineEnd = source.indexOf("\n", i);
                const heredoc = HEREDOC.exec(source.slice(i, lineEnd === -1 ? source.length : lineEnd));
                if (heredoc) {
                    heredocs.push({ word: heredoc[2] ?? heredoc[3] ?? heredoc[4], tabs: heredoc[1] === "-" });
                    i += heredoc[0].length;
                } else i += 2;
            } else if (SHELL_WORD_BREAK.has(c)) {
                endWord(i);
                if (c === "(") depth++;
                else if (c === ")" && depth > 0) depth--;
                const redirect = c === "&" && (/[<>]/.test(source[i - 1]) || source[i + 1] === ">");
                if (!" \t<>".includes(c) && !redirect) words.length = 0;
                i++;
            } else {
                if (start === -1) start = i;
                if (c === '"') i = doubleQuoted(i);
                else if (c === "$" && source[i + 1] === "(" && source[i + 2] !== "(") i = lex(i + 2, ")");
                else if (c === "`" || (c === "$" && source[i + 1] === "'")) {
                    const quote = c === "$" ? "'" : c;
                    let j = c === "$" ? i + 2 : i + 1;
                    while (j < source.length && source[j] !== quote) j += source[j] === "\\" ? 2 : 1;
                    i = j + 1;
                } else i++;
            }
        }
        return source.length;
    }
    const from = source.startsWith("#!") ? source.indexOf("\n") : 0;
    if (from === -1) return [];
    lex(from, null);
    return spansToComments(source, spans, HASH_MARKERS);
}

const BLOCK_SCALAR = /^(\s*)(?:-\s+)?(?:([\w.-]+)\s*:\s*)?[|>][-+0-9]*\s*(?:#.*)?$/;

/** A YAML file's comments, and the shell comments of each `run:` block, by their lines in the file. */
export function yamlComments(source) {
    const lines = source.split("\n");
    const comments = [];
    let quote = null;
    for (let index = 0; index < lines.length; index++) {
        const text = lines[index];
        const inScalar = quote !== null;
        const { hash, open } = yamlCommentAt(text, quote);
        quote = open;
        if (hash !== -1) {
            const raw = text.slice(hash);
            const alone = !text.slice(0, hash).trim();
            comments.push({ line: index + 1, text: HASH_MARKERS(raw).trim(), bytes: Buffer.byteLength(alone ? `${text}\n` : raw) });
        }
        if (inScalar) continue;
        const block = BLOCK_SCALAR.exec(text);
        if (!block) continue;
        const indent = block[1].length + (block[2] && /^\s*-\s/.test(text) ? text.slice(block[1].length).search(/[^-\s]/) : 0);
        let end = index + 1;
        while (end < lines.length && (!lines[end].trim() || lines[end].search(/\S/) > indent)) end++;
        if (block[2] === "run") {
            const body = lines.slice(index + 1, end);
            const margin = Math.min(...body.filter((l) => l.trim()).map((l) => l.search(/\S/)));
            const script = body.map((l) => l.slice(Number.isFinite(margin) ? margin : 0)).join("\n");
            for (const comment of shellComments(script)) {
                comments.push({ ...comment, line: comment.line + index + 1, bytes: comment.bytes + (Number.isFinite(margin) ? margin : 0) });
            }
        }
        index = end - 1;
    }
    return comments;
}

/** Where a quoted scalar opens that can run on to later lines: a quote inside a plain scalar cannot. */
const SCALAR_START = /(?:^\s*(?:-\s+)*|:\s+)$/;

function yamlCommentAt(text, carried) {
    let quote = carried;
    let carries = carried !== null;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quote) {
            if (c === "\\" && quote === '"') i++;
            else if (c === "'" && quote === "'" && text[i + 1] === "'") i++;
            else if (c === quote) quote = null;
        } else if (c === "'" || c === '"') {
            if (i === 0 || /[\s:[{,-]/.test(text[i - 1])) {
                quote = c;
                carries = SCALAR_START.test(text.slice(0, i));
            }
        } else if (c === "#" && (i === 0 || /\s/.test(text[i - 1]))) return { hash: i, open: null };
    }
    return { hash: -1, open: quote !== null && carries ? quote : null };
}

const COMMENT_KEY = /^(\/\/|\$comment|_(?:\w+_)?(?:comments?|notes?))$/;

function keyOf(quoted) {
    try {
        return JSON.parse(quoted);
    } catch {
        return null;
    }
}

/** The strings a JSON file keeps under a comment key, such as `$comment` or `_comment`, one entry per line. */
export function jsonComments(source) {
    const spans = [];
    const containers = [];
    let key = null;
    let expectingKey = false;
    let inComment = 0;
    for (let i = 0; i < source.length; i++) {
        const c = source[i];
        if (c === '"') {
            const end = skipQuoted(source, i, '"');
            if (expectingKey) {
                key = keyOf(source.slice(i, end));
                expectingKey = false;
            } else if (inComment) spans.push([i + 1, end - 1]);
            i = end - 1;
        } else if (c === "{" || c === "[") {
            const comment = inComment > 0 || (containers.at(-1) === "{" && COMMENT_KEY.test(key ?? ""));
            containers.push(c);
            if (comment) inComment++;
            expectingKey = c === "{";
        } else if (c === "}" || c === "]") {
            containers.pop();
            if (inComment) inComment--;
        } else if (c === ",") expectingKey = containers.at(-1) === "{";
        else if (c === ":" && containers.at(-1) === "{" && COMMENT_KEY.test(key ?? "") && !inComment) {
            const value = /^\s*"/.exec(source.slice(i + 1));
            if (value) {
                const start = i + 1 + value[0].length - 1;
                const end = skipQuoted(source, start, '"');
                spans.push([start + 1, end - 1]);
                i = end - 1;
            }
        }
    }
    return spansToComments(source, spans, (raw) => raw);
}

/** A line a tool reads: any `<!-- portulan: … -->`, or one `compile` expands, as `<!-- leads: ../dod.md -->`. */
const PORTULAN_LINE = /^\s*<!--\s*portulan:\s[^\n]*?\s*-->\s*$/;
const toolReads = (line) => PORTULAN_LINE.test(line) || [LEADS_LINE, ENGINE_LINE, GATES_LINE].some((form) => form.test(line.replace(/\r$/, "")));

const FENCE_OPEN = /^ {0,3}(`{3,}(?!.*`)|~{3,})/;

function backtickString(text, from, length) {
    for (let at = text.indexOf("`", from); at !== -1; at = text.indexOf("`", at)) {
        const start = at;
        while (text[at] === "`") at++;
        if (at - start === length) return start;
    }
    return -1;
}

/** A line with its code spans blanked, and the backtick string of one it leaves open to a later line. */
function blankCodeSpans(line, open, later) {
    let visible = line;
    let from = 0;
    const blank = (start, end) => (visible = visible.slice(0, start) + " ".repeat(end - start) + visible.slice(end));
    if (open) {
        const close = backtickString(line, 0, open.length);
        if (close === -1) return { visible: " ".repeat(line.length), open };
        from = close + open.length;
        blank(0, from);
    }
    for (let at = line.indexOf("`", from); at !== -1; at = line.indexOf("`", from)) {
        let end = at;
        while (line[end] === "`") end++;
        const close = backtickString(line, end, end - at);
        if (close !== -1) {
            from = close + end - at;
            blank(at, from);
        } else if (later().some((text) => backtickString(text, 0, end - at) !== -1)) {
            blank(at, line.length);
            return { visible, open: line.slice(at, end) };
        } else from = end;
    }
    return { visible, open: null };
}

/** A Markdown file's HTML comments, outside fenced code and code spans, and other than a tool's directives. */
export function markdownComments(source) {
    const spans = [];
    const lines = source.split("\n");
    const paragraphAfter = (index) => {
        let end = index + 1;
        while (end < lines.length && lines[end].trim() && !FENCE_OPEN.test(lines[end])) end++;
        return lines.slice(index + 1, end);
    };
    let fence = null;
    let open = -1;
    let code = null;
    let offset = 0;
    for (const [index, line] of lines.entries()) {
        const lineStart = offset;
        offset += line.length + 1;
        if (open === -1) {
            if (fence) {
                if (fence.test(line)) fence = null;
                continue;
            }
            const opening = FENCE_OPEN.exec(line)?.[1];
            if (opening) {
                fence = new RegExp(`^ {0,3}${opening[0]}{${opening.length},}[ \\t\\r]*$`);
                code = null;
                continue;
            }
        }
        let visible = line;
        if (open === -1) ({ visible, open: code } = blankCodeSpans(line, code, () => paragraphAfter(index)));
        else code = null;
        let from = 0;
        while (from <= visible.length) {
            if (open === -1) {
                const start = visible.indexOf("<!--", from);
                if (start === -1) break;
                open = lineStart + start;
                from = start + 4;
            }
            const close = visible.indexOf("-->", from);
            if (close === -1) break;
            if (!toolReads(line)) spans.push([open, lineStart + close + 3]);
            open = -1;
            from = close + 3;
        }
    }
    if (open !== -1) spans.push([open, source.length]);
    return spansToComments(source, spans, HTML_MARKERS);
}

export const LEXERS = { js: jsComments, shell: shellComments, yaml: yamlComments, json: jsonComments, markdown: markdownComments };

export function commentsOf(source, language) {
    return LEXERS[language](source);
}

const NUMBER_WORD = "(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten)";
const CREDITED = "(?:[Rr]aised|[Ff]ound|[Cc]aught|[Ff]lagged|[Rr]eported|[Ss]potted|[Ss]urfaced)";

/**
 * What marks a comment as a change's history, by kind. A `prose` pattern skips text in backticks, which
 * quotes a value rather than dating or citing the code: a date there is an example, as in `2026-02-30`.
 */
export const KINDS = [
    {
        kind: "date",
        prose: /(?<!\b(?:[Vv]ersion|api-version|compatibility_date)["'\s:=]{0,4})\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:\b|(?=T\d))/gu,
    },
    {
        kind: "plan",
        raw: /\b(?:[Pp]roposals?\s+`?\d{2,4}\b|[Mm]ilestones?[\s-]+\d+\b|rows?\s+\d+\s+clause\b|clause\s+\([a-z]\))/gu,
    },
    {
        kind: "review",
        raw: new RegExp(
            [
                `\\bCopilot(?:'s)?\\b[^.;:]{0,40}?\\brounds?\\s+${NUMBER_WORD}\\b`,
                `\\brounds?\\s+\\d+\\s+(?:on|of)\\s+#\\d{2,}`,
                `#\\d{2,},?\\s+rounds?\\s+${NUMBER_WORD}\\b`,
                `\\b${CREDITED}\\s+(?:by|in)\\s+(?:a\\s+|the\\s+)?(?:Copilot|review)\\b`,
                `\\bCopilot(?:'s)?\\s+(?:${CREDITED.toLowerCase()}|round|rounds|note|notes|finding|findings|named|promoted|proposed|pointed)\\b`,
                `\\(Copilot\\b[^)]{0,40}?\\bround\\b|\\bCopilot,\\s+(?:on\\s+)?the\\s+round|\\bCopilot's\\s+\\w+\\s+notes?\\b`,
                `\\b[Rr]ounds?\\s+\\d+(?:'s\\b|\\s+(?:found|fixed|raised|removed|made|said|then|had)\\b)`,
                `\\bsession\\s+\\d+'s\\s+round\\s+\\d+\\b`,
            ].join("|"),
            "gu",
        ),
    },
    {
        kind: "reference",
        prose: /(?<![\w$&{#/])#\d{2,}\b|\b(?:PR|[Pp]ull [Rr]equest|[Ii]ssue)s?\s+#?\d{2,}\b|github\.com\/[\w.-]+\/[\w.-]+\/(?:pull|issues)\/\d+\b/gu,
        raw: /`#\d{2,}`/gu,
    },
];

const blankCode = (text) => text.replace(/(`+)[^`]*?\1/g, (span) => " ".repeat(span.length));

/** Comments grouped into blocks of consecutive lines, so a citation wrapped across two lines is still one. */
function blocksOf(comments) {
    const blocks = [];
    for (const comment of comments) {
        const last = blocks.at(-1);
        if (last && last.at(-1).line === comment.line - 1) last.push(comment);
        else blocks.push([comment]);
    }
    return blocks;
}

/** The comment lines that record history, each with the kinds that mark it. */
export function historyOf(comments) {
    const kinds = new Map();
    for (const block of blocksOf(comments)) {
        const starts = [];
        let raw = "";
        for (const comment of block) {
            starts.push(raw.length);
            raw += `${comment.text} `;
        }
        const texts = { prose: blankCode(raw), raw };
        for (const { kind, ...patterns } of KINDS) {
            for (const [reads, pattern] of Object.entries(patterns)) {
                for (const match of texts[reads].matchAll(pattern)) {
                    const last = lineAt(starts, match.index + match[0].length - 1);
                    for (let at = lineAt(starts, match.index); at <= last; at++) {
                        if (!kinds.has(block[at])) kinds.set(block[at], new Set());
                        kinds.get(block[at]).add(kind);
                    }
                }
            }
        }
    }
    return comments.filter((comment) => kinds.has(comment)).map((comment) => ({ ...comment, kinds: [...kinds.get(comment)] }));
}

function trackedFiles(root) {
    try {
        const out = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
            cwd: root,
            encoding: "utf8",
            maxBuffer: 256 * 1024 * 1024,
            stdio: ["ignore", "pipe", "pipe"],
        });
        return [...new Set(out.split("\0").filter(Boolean))].sort();
    } catch (error) {
        throw new CommentsError(`git could not list the files in ${root}: ${String(error.stderr || error.message).trim()}`);
    }
}

function underLink(root, file, linked) {
    for (let at = file.indexOf("/"); at !== -1; at = file.indexOf("/", at + 1)) {
        const dir = file.slice(0, at);
        if (!linked.has(dir)) linked.set(dir, fs.lstatSync(path.join(root, dir)).isSymbolicLink());
        if (linked.get(dir)) return true;
    }
    return false;
}

function readSource(root, file, linked) {
    const full = path.join(root, file);
    try {
        if (underLink(root, file, linked) || !fs.lstatSync(full).isFile()) return null;
        return fs.readFileSync(full, "utf8");
    } catch (error) {
        if (error.code === "ENOENT") return null;
        throw new CommentsError(`${file} could not be read: ${error.code ?? error.message}`);
    }
}

/** Every file the tree holds in a language this reads, with its comments and the ones recording history. */
export function scan(root, { exclude = [] } = {}) {
    const files = trackedFiles(root);
    const unused = exclude.filter((prefix) => !files.some((file) => file.startsWith(prefix)));
    if (unused.length) throw new CommentsError(`--exclude ${unused.join(", ")} names no file in the tree: remove it`);
    const read = [];
    const linked = new Map();
    for (const file of files) {
        if (exclude.some((prefix) => file.startsWith(prefix))) continue;
        const guess = languageOf(file);
        if (guess === null && path.extname(file)) continue;
        const source = readSource(root, file, linked);
        if (source === null) continue;
        const language = guess ?? languageOf(file, source.slice(0, source.indexOf("\n") >>> 0));
        if (!language) continue;
        const comments = commentsOf(source, language);
        read.push({ file, language, comments, history: historyOf(comments) });
    }
    return read;
}

const sum = (items, pick) => items.reduce((total, item) => total + pick(item), 0);
const figure = (n) => n.toLocaleString("en-US");

export const historyCount = (root) => sum(scan(root), (entry) => entry.history.length);

function directoryTable(read) {
    const directories = new Map();
    for (const entry of read) {
        if (!entry.comments.length) continue;
        const dir = path.posix.dirname(entry.file);
        const row = directories.get(dir) ?? { comments: 0, bytes: 0, history: 0, historyBytes: 0 };
        row.comments += entry.comments.length;
        row.bytes += sum(entry.comments, (c) => c.bytes);
        row.history += entry.history.length;
        row.historyBytes += sum(entry.history, (c) => c.bytes);
        directories.set(dir, row);
    }
    return [
        "  by directory: comment lines recording history of all comment lines, and their bytes",
        ...[...directories]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dir, row]) => `    ${dir}/  ${figure(row.history)} of ${figure(row.comments)} lines · ${figure(row.historyBytes)} of ${figure(row.bytes)} B`),
    ];
}

const RULE_AT = "the rule: core/operating/context.md, on every boot card";

function verdicts({ count, limit, bytes, byteRail }) {
    const lines = [];
    let code = 0;
    if (limit !== null) {
        if (count > limit) {
            code = 1;
            lines.push(`RED: ${figure(count)} is over the limit of ${figure(limit)}: take the history out of the comments listed, into the commit message; ${RULE_AT}.`);
        } else {
            const lower = count < limit ? `; lower the limit to ${figure(count)}, so none comes back` : "";
            lines.push(`green: ${figure(count)} is within the limit of ${figure(limit)}${lower}`);
        }
    }
    if (byteRail !== null) {
        if (bytes > byteRail) {
            code = 1;
            lines.push(`RED: ${figure(bytes)} comment bytes are over the rail of ${figure(byteRail)}: cut the comments that are not truly needed, or raise the rail with its reason; ${RULE_AT}.`);
        } else {
            const lower = (byteRail - bytes) * 100 > byteRail * NOTE_PERCENT ? `; more than ${NOTE_PERCENT}% under it, so lower the rail to ${figure(railFor(bytes))}` : "";
            lines.push(`green: ${figure(bytes)} comment bytes are within the rail of ${figure(byteRail)}${lower}`);
        }
    }
    return { code, lines };
}

export function report(read, { limit = null, bytes: byteRail = null, list = false } = {}) {
    const all = read.flatMap((entry) => entry.comments);
    const history = read.flatMap((entry) => entry.history);
    const count = history.length;
    const bytes = sum(all, (c) => c.bytes);
    const out = [
        `comments: ${figure(count)} of ${figure(all.length)} comment lines in the ${figure(read.length)} files read record a change's history ` +
            `(${figure(sum(history, (c) => c.bytes))} of ${figure(bytes)} comment bytes)`,
    ];
    if (list || (limit !== null && count > limit)) {
        for (const entry of read) {
            if (entry.history.length) out.push(`  ${entry.file}: ${entry.history.map((c) => `${c.line} ${c.kinds.join("+")}`).join(" · ")}`);
        }
    }
    out.push(`  by kind: ${KINDS.map(({ kind }) => `${kind} ${figure(history.filter((c) => c.kinds.includes(kind)).length)}`).join(" · ")}`);
    if (list) out.push(...directoryTable(read));
    const { code, lines } = verdicts({ count, limit, bytes, byteRail });
    return { code, text: [...out, ...lines].join("\n") };
}

const USAGE = "usage: node cli/comments.mjs [--root <dir>] [--limit <count>] [--bytes <count>] [--list] [--exclude <path prefix>]...";

export function parseArgs(argv) {
    const options = { root: process.cwd(), limit: null, bytes: null, list: false, exclude: [] };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const count = /^\d+$/.test(argv[i + 1] ?? "");
        if (arg === "--list") options.list = true;
        else if (arg === "--root" && argv[i + 1] !== undefined) options.root = argv[++i];
        else if (arg === "--exclude" && argv[i + 1]) options.exclude.push(argv[++i]);
        else if (arg === "--limit" && count) options.limit = Number(argv[++i]);
        else if (arg === "--bytes" && count) options.bytes = Number(argv[++i]);
        else throw new CommentsError(`${USAGE} (not ${JSON.stringify(arg)})`);
    }
    return options;
}

export function run(argv, stdout = process.stdout, stderr = process.stderr) {
    try {
        const options = parseArgs(argv);
        const { code, text } = report(scan(options.root, options), options);
        stdout.write(`${text}\n`);
        return code;
    } catch (error) {
        stderr.write(`comments: could not run: ${error.message}\n`);
        return 2;
    }
}

function isMain() {
    const invoked = process.argv[1];
    if (!invoked) return false;
    try {
        return import.meta.url === pathToFileURL(fs.realpathSync(invoked)).href;
    } catch {
        return false;
    }
}

if (isMain()) process.exitCode = run(process.argv.slice(2));
