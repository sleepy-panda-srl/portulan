#!/usr/bin/env node
// A code file's outline, one line per symbol, and a Markdown file's, one line per heading with its size.
//
// Exit 0 printed · 1 no definition for `--find`, or no heading for `<file>#<heading>` · 2 could not run.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const USAGE = "usage: node cli/symbols.mjs <file>... | <file.md>#<heading>... | --find <name>...";

/** Past this many characters a line's code is cut with `…`, so an outline stays one line per symbol. */
const WIDTH = 110;

export class CannotOutline extends Error {}

/** `js`, `sh`, `md`, or null for a file this does not read: by extension, then by a `#!` line. */
export function languageOf(file, firstLine = "") {
    const ext = path.extname(file);
    if ([".mjs", ".js", ".cjs"].includes(ext)) return "js";
    if ([".sh", ".bash"].includes(ext)) return "sh";
    if ([".md", ".markdown"].includes(ext)) return "md";
    if (ext !== "" || !firstLine.startsWith("#!")) return null;
    if (/\bnode\b/.test(firstLine)) return "js";
    if (/\b(ba|da|z)?sh\b/.test(firstLine)) return "sh";
    return null;
}

// ===========================================================================================
// 1. JavaScript: tokens, brackets, statements
// ===========================================================================================

const KEYWORDS_BEFORE_REGEX = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
    "throw", "case", "default", "do", "else", "yield", "await"]);
const TEST_CALLS = new Set(["describe", "test", "it", "suite", "before", "after", "beforeEach", "afterEach"]);
const NAME_START = /[A-Za-z_$\u0080-\uffff]/;
const NAME_PART = /[\w$\u0080-\uffff]/;

/** Whether a `/` opens a regular expression is a guess, and matching the brackets is what checks it. */
export function scanJs(src) {
    const tokens = [];
    const comments = [];
    const push = (type, value, start, end) => tokens.push({ type, value, start, end });
    const newline = src.indexOf("\n");
    scan(src, src.startsWith("#!") ? (newline === -1 ? src.length : newline) : 0, false, { push, comments });
    return { tokens, comments };
}

// A `/` divides after a value, as after the `}` of an object literal (a `{` where an expression goes); elsewhere it opens a regex.
function slashReader() {
    let prev = null;
    const braces = [];
    const expressionKeyword = (token) => token.type === "name" && !token.property && KEYWORDS_BEFORE_REGEX.has(token.value);
    return {
        note(type, value) {
            const token = { type, value, property: prev?.type === "punct" && (prev.value === "." || prev.value === "?.") };
            if (type === "punct" && value === "{") {
                braces.push(prev !== null && (prev.type === "punct" ? ![")", ";", "{", "}", "=>"].includes(prev.value)
                    : prev.type !== "name" || (expressionKeyword(prev) && prev.value !== "do" && prev.value !== "else")));
            }
            if (type === "punct" && value === "}") token.literal = braces.pop() === true;
            prev = token;
        },
        regexAllowed: () =>
            prev === null ||
            (prev.type === "punct" && (prev.value === "}" ? !prev.literal : ![")", "]", "++", "--"].includes(prev.value))) ||
            expressionKeyword(prev),
    };
}

// `nested` scans a `${}` to its closing brace and records nothing, so only the file's own level is tokenised.
function scan(src, i, nested, sink) {
    let depth = 0;
    const slash = slashReader();
    const out = {
        push: (type, value, start, end) => {
            slash.note(type, value);
            if (!nested) sink.push(type, value, start, end);
        },
        regexAllowed: slash.regexAllowed,
    };
    const n = src.length;
    while (i < n) {
        const c = src[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === "/" && src[i + 1] === "/") {
            const e = src.indexOf("\n", i);
            const end = e === -1 ? n : e;
            if (!nested) sink.comments.push({ start: i, end, block: false });
            i = end;
            continue;
        }
        if (c === "/" && src[i + 1] === "*") {
            const e = src.indexOf("*/", i + 2);
            if (e === -1) throw new CannotOutline(`an unterminated comment at offset ${i}`);
            if (!nested) sink.comments.push({ start: i, end: e + 2, block: true });
            i = e + 2;
            continue;
        }
        if (c === "'" || c === '"') {
            let j = i + 1;
            while (j < n && src[j] !== c) {
                if (src[j] === "\\") j++;
                else if (src[j] === "\n") throw new CannotOutline(`an unterminated string at offset ${i}`);
                j++;
            }
            if (j >= n) throw new CannotOutline(`an unterminated string at offset ${i}`);
            out.push("string", src.slice(i, j + 1), i, j + 1);
            i = j + 1;
            continue;
        }
        if (c === "`") {
            let j = i + 1;
            while (j < n && src[j] !== "`") {
                if (src[j] === "\\") j += 2;
                else if (src[j] === "$" && src[j + 1] === "{") j = scan(src, j + 2, true, sink);
                else j++;
            }
            if (j >= n) throw new CannotOutline(`an unterminated template at offset ${i}`);
            out.push("template", src.slice(i, j + 1), i, j + 1);
            i = j + 1;
            continue;
        }
        if (c === "/" && out.regexAllowed()) {
            let j = i + 1;
            let inClass = false;
            while (j < n && (inClass || src[j] !== "/")) {
                if (src[j] === "\\") j++;
                else if (src[j] === "[") inClass = true;
                else if (src[j] === "]") inClass = false;
                else if (src[j] === "\n") throw new CannotOutline(`an unterminated regular expression at offset ${i}`);
                j++;
            }
            if (j >= n) throw new CannotOutline(`an unterminated regular expression at offset ${i}`);
            j++;
            while (j < n && NAME_PART.test(src[j])) j++;
            out.push("regex", src.slice(i, j), i, j);
            i = j;
            continue;
        }
        if (NAME_START.test(c) || (c === "#" && NAME_START.test(src[i + 1] ?? ""))) {
            let j = i + 1;
            while (j < n && NAME_PART.test(src[j])) j++;
            out.push("name", src.slice(i, j), i, j);
            i = j;
            continue;
        }
        if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
            let j = i + 1;
            while (j < n && /[\w.]/.test(src[j])) j++;
            out.push("number", src.slice(i, j), i, j);
            i = j;
            continue;
        }
        if (c === "{") depth++;
        if (c === "}") {
            if (nested && depth === 0) return i + 1;
            depth--;
        }
        const three = src.slice(i, i + 3);
        const two = src.slice(i, i + 2);
        const op = ["...", "===", "!==", "**=", "<<=", ">>=", "&&=", "||=", "??="].includes(three) ? three
            : ["=>", "==", "!=", "&&", "||", "??", "?.", "++", "--", "+=", "-=", "*=", "/=", "%=", "<=", ">=", "**"].includes(two) ? two
            : c;
        out.push("punct", op, i, i + op.length);
        i += op.length;
    }
    if (nested) throw new CannotOutline("an unterminated template expression");
    return i;
}

/** Each bracket token's partner, by index, or a refusal naming the first one that has none. */
function matchBrackets(tokens, lineOf) {
    const match = new Map();
    const stack = [];
    const pairs = { ")": "(", "]": "[", "}": "{" };
    tokens.forEach((token, index) => {
        if (token.type !== "punct") return;
        if (token.value === "(" || token.value === "[" || token.value === "{") stack.push(index);
        else if (token.value in pairs) {
            const open = stack.pop();
            if (open === undefined) throw new CannotOutline(`an unmatched \`${token.value}\` on line ${lineOf(token.start)}`);
            if (tokens[open].value !== pairs[token.value]) {
                throw new CannotOutline(`a \`${token.value}\` on line ${lineOf(token.start)} closing the \`${tokens[open].value}\` of line ${lineOf(tokens[open].start)}`);
            }
            match.set(open, index);
            match.set(index, open);
        }
    });
    if (stack.length) throw new CannotOutline(`an unclosed \`${tokens[stack.at(-1)].value}\` on line ${lineOf(tokens[stack.at(-1)].start)}`);
    return match;
}

/** A source's line starts, and the 1-based line holding an offset. */
function lineIndex(src) {
    const starts = [0];
    for (let i = src.indexOf("\n"); i !== -1; i = src.indexOf("\n", i + 1)) starts.push(i + 1);
    const lineOf = (offset) => {
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (starts[mid] <= offset) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };
    const lines = src.endsWith("\n") ? starts.length - 1 : starts.length;
    return { lineOf, lines };
}

// The statement that starts at token `i` ends at the index this returns, never at or past `stop`.
function statementEnd(t, i, stop, match) {
    const at = (k) => (k < stop ? t[k] : undefined);
    const is = (k, value) => at(k)?.value === value && at(k)?.type !== "string";
    const skip = (k) => (match.has(k) && ["(", "[", "{"].includes(t[k].value) ? match.get(k) : k);
    const body = (k) => (is(k, "{") ? match.get(k) : statementEnd(t, k, stop, match));
    const head = t[i].value;
    if (is(i, ";")) return i;
    if (is(i, "{")) return match.get(i);
    let k = i;
    while (["export", "default", "async"].includes(at(k)?.value) && at(k).type === "name") k++;
    const keyword = at(k)?.type === "name" ? at(k).value : null;
    if (keyword === "function" || keyword === "class") {
        let j = k + 1;
        while (j < stop && !is(j, "{")) j = skip(j) + 1;
        if (j >= stop) return stop - 1;
        if (keyword === "class" || at(j - 1)?.value === ")") return match.get(j);
    }
    if (head === "if" || head === "while" || head === "with" || (head === "for" && !is(i + 1, "."))) {
        let j = i + 1;
        if (is(j, "await")) j++;
        if (!is(j, "(")) return simpleEnd(t, i, stop, match);
        let end = body(match.get(j) + 1);
        if (head === "if" && is(end + 1, "else")) end = body(end + 2);
        return end;
    }
    if (head === "do" && at(i).type === "name") {
        let end = body(i + 1);
        if (is(end + 1, "while") && is(end + 2, "(")) end = match.get(end + 2);
        return is(end + 1, ";") ? end + 1 : end;
    }
    if (head === "switch" && is(i + 1, "(") && is(match.get(i + 1) + 1, "{")) return match.get(match.get(i + 1) + 1);
    if (head === "try" && is(i + 1, "{")) {
        let end = match.get(i + 1);
        if (is(end + 1, "catch")) {
            let j = end + 2;
            if (is(j, "(")) j = match.get(j) + 1;
            if (is(j, "{")) end = match.get(j);
        }
        if (is(end + 1, "finally") && is(end + 2, "{")) end = match.get(end + 2);
        return end;
    }
    return simpleEnd(t, i, stop, match);
}

// Ends at `;` or where ASI would; an import, or an export of `{ … }` or `*`, runs on to its `from "…"` and any `with { … }`.
function simpleEnd(t, i, stop, match) {
    const clause = t[i].type === "name" && ((t[i].value === "import" && t[i + 1]?.value !== "(" && t[i + 1]?.value !== ".") ||
        (t[i].value === "export" && (t[i + 1]?.value === "{" || t[i + 1]?.value === "*")));
    let source = false;
    for (let k = i; k < stop;) {
        if (t[k].type === "punct" && t[k].value === ";") return k;
        if (t[k].type === "string") source = true;
        const last = t[k].type === "punct" && ["(", "[", "{"].includes(t[k].value) ? match.get(k) : k;
        const next = last + 1 < stop ? t[last + 1] : null;
        const continues = ["instanceof", "in", "of"].includes(next?.value) || (clause && next?.value === (source ? "with" : "from"));
        if (next?.type === "name" && !continues && next.line > t[last].endLine && endsValue(t[last])) return last;
        k = last + 1;
    }
    return stop - 1;
}

// Whether a statement may end on this token: never on an operator, or on a keyword awaiting its operand.
function endsValue(token) {
    if (token.type === "name") return !KEYWORDS_BEFORE_REGEX.has(token.value);
    return token.type !== "punct" || [")", "]", "}", "++", "--"].includes(token.value);
}

/** The statements between two token indexes, as [first, last] index pairs. */
function statements(t, from, stop, match) {
    const out = [];
    for (let i = from; i < stop;) {
        const last = statementEnd(t, i, stop, match);
        out.push([i, last]);
        i = last + 1;
    }
    return out;
}

// ===========================================================================================
// 2. JavaScript: what each statement is, and the line that names it
// ===========================================================================================

function oneLine(text) {
    return text.replace(/\s+/g, " ").replace(/([([{]) /g, "$1").replace(/ ([)\]}])/g, "$1").trim();
}

function cut(text) {
    return text.length > WIDTH ? `${text.slice(0, WIDTH - 1)}…` : text;
}

/** `{ lines, entries }`, with 1-based inclusive lines; throws `CannotOutline` where the brackets do not match. */
export function outlineJs(src) {
    const { tokens: t, comments } = scanJs(src);
    const { lineOf, lines } = lineIndex(src);
    for (const token of t) {
        token.line = lineOf(token.start);
        token.endLine = lineOf(token.end - 1);
    }
    for (const comment of comments) {
        comment.line = lineOf(comment.start);
        comment.endLine = lineOf(comment.end - 1);
        comment.text = src.slice(comment.start, comment.end);
    }
    const match = matchBrackets(t, lineOf);
    let p = 0;
    for (const comment of comments) {
        while (p < t.length && t[p].start < comment.start) p++;
        comment.trailing = p > 0 && t[p - 1].endLine === comment.line;
    }
    const srcLines = src.split("\n");
    const firstLineOf = (token) => srcLines[token.line - 1].slice(token.start - (src.lastIndexOf("\n", token.start - 1) + 1));

    // A comment block directly above a line (no blank line between, no banner in it) opens that span.
    const byEndLine = new Map(comments.map((c) => [c.endLine, c]));
    const docStart = (line) => {
        let start = line;
        for (let c = byEndLine.get(start - 1); c && !c.trailing && !isBanner(c.text); c = byEndLine.get(start - 1)) start = c.line;
        return start;
    };

    const signature = (first, last) => {
        const head = t[first];
        let k = first;
        while (k <= last && ["export", "default", "async", "static", "get", "set", "accessor"].includes(t[k].value) && t[k].type === "name") k++;
        if (t[k]?.value === "*") k++;
        const declares = t[k]?.type === "name" && ["function", "class"].includes(t[k].value);
        let stopAt = last + 1;
        if (declares || isMethod(t, k, last, match)) {
            for (let j = k; j <= last; j = (["(", "["].includes(t[j].value) && t[j].type === "punct" ? match.get(j) : j) + 1) {
                if (t[j].type === "punct" && t[j].value === "{") { stopAt = j; break; }
            }
        }
        const text = stopAt <= last
            ? oneLine(src.slice(head.start, t[stopAt].start))
            : firstLineOf(head).trim();
        return cut(text);
    };

    const nameOf = (first, last) => {
        let k = first;
        while (["export", "default", "async", "static", "get", "set", "accessor", "function", "class", "const", "let", "var"].includes(t[k]?.value) && t[k].type === "name") k++;
        if (t[k]?.value === "*") k = k + 1;
        // `class extends Base` has no name of its own; `extends` is the next word, not the class's name.
        if (t[k]?.value === "extends" && t[k - 1]?.value === "class") return null;
        return t[k]?.type === "name" && k <= last ? t[k].value : null;
    };

    const kindOf = (first) => {
        let k = first;
        while (["export", "default", "async"].includes(t[k]?.value) && t[k].type === "name") k++;
        return t[k]?.type === "name" ? t[k].value : null;
    };

    const entry = (first, last, extra = {}) => ({
        start: docStart(t[first].line),
        end: t[last].endLine,
        text: signature(first, last),
        name: null,
        children: [],
        ...extra,
    });

    const members = (open) => {
        const out = [];
        for (let i = open + 1; i < match.get(open);) {
            if (t[i].type === "punct" && t[i].value === ";") { i++; continue; }
            const last = memberEnd(t, i, match.get(open), match);
            out.push(entry(i, last, { name: memberName(t, i) }));
            i = last + 1;
        }
        return out;
    };

    const tests = (first, last) => {
        // Only a suite's callback is outlined, never a test's body: the first `{` an arrow or function opens in the call.
        if (!["describe", "suite"].includes(t[first].value)) return [];
        let call = first + 1;
        while (t[call]?.value === "." && t[call + 1]?.type === "name") call += 2;
        if (t[call]?.value !== "(" || call > last) return [];
        for (let j = call + 1; j < match.get(call); j++) {
            if (t[j].type === "punct" && t[j].value === "{" && (t[j - 1].value === "=>" || t[j - 1].value === ")")) {
                return statements(t, j + 1, match.get(j), match).flatMap(([a, b]) => {
                    if (isTestCall(t, a)) return [entry(a, b, { children: tests(a, b) })];
                    const kind = kindOf(a);
                    if (kind === "function" || kind === "const" || kind === "let" || kind === "var" || kind === "class") {
                        return [entry(a, b, { name: kind === "class" ? nameOf(a, b) : declaredNames(t, a, b, match) })];
                    }
                    return [];
                });
            }
            if (t[j].type === "punct" && ["(", "[", "{"].includes(t[j].value)) j = match.get(j);
        }
        return [];
    };

    const entries = [];
    const imports = [];
    for (const [first, last] of statements(t, 0, t.length, match)) {
        if (first === last && t[first].value === ";") continue;
        const kind = kindOf(first);
        if (t[first].value === "import" && t[first].type === "name" && t[first + 1]?.value !== "(" && t[first + 1]?.value !== ".") {
            imports.push([first, last]);
            continue;
        }
        if (kind === "class") {
            const open = firstBrace(t, first, last, match);
            entries.push(entry(first, last, { name: nameOf(first, last), children: open === -1 ? [] : members(open) }));
        } else if (kind === "function" || kind === "const" || kind === "let" || kind === "var") {
            entries.push(entry(first, last, { name: declaredNames(t, first, last, match) }));
        } else if (isTestCall(t, first)) {
            entries.push(entry(first, last, { children: tests(first, last) }));
        } else {
            entries.push(entry(first, last));
        }
    }

    // An import's module is its first string outside braces: `{ "a-b" as ab }` and `with { … }` hold strings too.
    const sourceOf = (first, last) => {
        for (let k = first; k <= last; k++) {
            if (t[k].type === "string") return [t[k].value.slice(1, -1)];
            if (t[k].type === "punct" && t[k].value === "{") k = match.get(k);
        }
        return [];
    };

    const runs = [];
    for (const [first, last] of imports) {
        const run = runs.at(-1);
        if (run && t[first].line <= t[run.last].endLine + 1) run.last = last;
        else runs.push({ first, last, from: [] });
        runs.at(-1).from.push(...sourceOf(first, last));
    }
    for (const run of runs) {
        entries.push({ start: docStart(t[run.first].line), end: t[run.last].endLine, text: cut(`import ${run.from.join(", ")}`), name: null, children: [] });
    }

    // The file's own comment before its first statement, when no statement claims it, names the file.
    const firstCode = entries.length ? Math.min(...entries.map((e) => e.start)) : lines + 1;
    const head = comments.filter((c) => c.endLine < firstCode);
    if (head.length) {
        const text = head.map((c) => c.text).join("\n").split("\n").map((line) => line.replace(/^\s*(\/\/+|\/\*+|\*\/|\*)\s?/, "").trim()).find((line) => line && !/^[-=*/]+$/.test(line));
        if (text) entries.push({ start: head[0].line, end: head.at(-1).endLine, text: cut(`// ${text}`), name: null, children: [], header: true });
    }

    const sections = banners(comments.filter((c) => !c.block).map((c) => ({ line: c.line, text: c.text.slice(2) })));
    return { lines, entries: place(order(entries), sections, lines, "//") };
}

// A comment line that opens or rules off a section, so no span's opening comment reaches past it.
function isBanner(text) {
    return /^\s*(\/\/|#)\s*([-=]{4,}|\d+[a-z]\.\s)/.test(text);
}

function isTestCall(t, i) {
    let k = i;
    if (t[k]?.type !== "name" || !TEST_CALLS.has(t[k].value)) return false;
    while (t[k + 1]?.value === "." && t[k + 2]?.type === "name") k += 2;
    return t[k + 1]?.value === "(";
}

function isMethod(t, k, last, match) {
    let j = k;
    if (t[j]?.value === "[" && t[j].type === "punct") j = match.get(j);
    return t[j + 1]?.value === "(" && t[j + 1].type === "punct" && t[match.get(j + 1) + 1]?.value === "{";
}

function firstBrace(t, first, last, match) {
    for (let j = first; j <= last; j++) {
        if (t[j].type !== "punct") continue;
        if (t[j].value === "{") return j;
        if (t[j].value === "(" || t[j].value === "[") j = match.get(j);
    }
    return -1;
}

// A class member ends at its body's `}` (a method, an accessor, a static block) or at its `;`.
function memberEnd(t, i, stop, match) {
    let k = i;
    while (k < stop && t[k].type === "name" && ["static", "async", "get", "set", "accessor"].includes(t[k].value) &&
        !(t[k + 1]?.value === "(" || t[k + 1]?.value === "=" || t[k + 1]?.value === ";")) k++;
    if (t[k]?.value === "{") return match.get(k);
    if (t[k]?.value === "*") k++;
    if (t[k]?.value === "[") k = match.get(k);
    if (t[k + 1]?.value === "(" && t[match.get(k + 1) + 1]?.value === "{") return match.get(match.get(k + 1) + 1);
    for (let j = k; j < stop; j++) {
        if (t[j].type === "punct" && t[j].value === ";") return j;
        if (t[j].type === "punct" && ["(", "[", "{"].includes(t[j].value)) j = match.get(j);
        if (j + 1 < stop && t[j + 1].line > t[j].endLine && t[j + 1].type === "name" && endsValue(t[j])) return j;
    }
    return stop - 1;
}

function memberName(t, i) {
    let k = i;
    while (t[k]?.type === "name" && ["static", "async", "get", "set", "accessor"].includes(t[k].value) &&
        !(t[k + 1]?.value === "(" || t[k + 1]?.value === "=" || t[k + 1]?.value === ";")) k++;
    if (t[k]?.value === "*") k++;
    return t[k]?.type === "name" ? t[k].value : null;
}

function declaredNames(t, first, last, match) {
    let k = first;
    while (["export", "default", "async"].includes(t[k]?.value) && t[k].type === "name") k++;
    if (t[k].value === "function") {
        const name = t[k + 1]?.value === "*" ? t[k + 2] : t[k + 1];
        return name?.type === "name" ? [name.value] : null;
    }
    const names = [];
    for (let j = k + 1; j <= last;) {
        if (t[j].type === "name") names.push(t[j].value);
        else if (t[j].type === "punct" && ["{", "["].includes(t[j].value)) names.push(...patternNames(t, j, match));
        else break;
        j = nextComma(t, j, last + 1, match);
        if (t[j]?.value !== ",") break;
        j++;
    }
    return names.length ? names : null;
}

function nextComma(t, j, stop, match) {
    for (; j < stop; j++) {
        if (t[j].type !== "punct") continue;
        if (t[j].value === "," || t[j].value === ";") return j;
        if (["(", "[", "{"].includes(t[j].value)) j = match.get(j);
    }
    return stop;
}

// The names a destructuring pattern binds: `{ a, b: c, d = 1, ...e }` binds a, c, d and e.
function patternNames(t, open, match) {
    const names = [];
    const close = match.get(open);
    for (let j = open + 1; j < close;) {
        const end = nextComma(t, j, close, match);
        let a = j;
        if (t[a]?.value === "...") a++;
        if (t[open].value === "{") {
            for (let c = a; c < end; c++) {
                if (t[c].type === "punct" && t[c].value === ":") { a = c + 1; break; }
                if (t[c].type === "punct" && ["(", "[", "{"].includes(t[c].value)) c = match.get(c);
            }
        }
        if (t[a]?.type === "name" && a < end) names.push(t[a].value);
        else if (t[a]?.type === "punct" && ["{", "["].includes(t[a].value)) names.push(...patternNames(t, a, match));
        j = end + 1;
    }
    return names;
}

// ===========================================================================================
// 3. Shell: functions and titled banners
// ===========================================================================================

const SH_FUNCTION = /^(\s*)(?:function\s+([A-Za-z_][\w:.-]*)\s*(?:\(\s*\))?|([A-Za-z_][\w:.-]*)\s*\(\s*\))\s*(\{.*)?$/;

// `<<` or `<<-` and a word unquoted into its delimiter; none inside quotes, after a comment or in `(( ))`, and `<<<` is a here-string.
function heredocs(text, line) {
    const arithmetic = [];
    for (let i = text.indexOf("(("); i !== -1; i = text.indexOf("((", i + 2)) {
        let depth = 0;
        let j = i;
        for (; j < text.length; j++) {
            if (text[j] === "(") depth++;
            else if (text[j] === ")" && --depth === 0) break;
        }
        arithmetic.push([i, j]);
    }
    const out = [];
    for (const operator of text.matchAll(/(?<!<)<<(?!<)(-?)[ \t]*/g)) {
        const before = text.slice(0, operator.index);
        if ((before.split('"').length - 1) % 2 === 1 || (before.split("'").length - 1) % 2 === 1) continue;
        if (/(^|[\s;&|()])#/.test(before) || arithmetic.some(([a, b]) => a < operator.index && operator.index < b)) continue;
        const start = operator.index + operator[0].length;
        let delimiter = "";
        let k = start;
        while (k < text.length && !/[\s|&;()<>]/.test(text[k])) {
            const c = text[k];
            if (c === "'" || c === '"') {
                let close = k + 1;
                while (close < text.length && text[close] !== c) close += c === '"' && text[close] === "\\" ? 2 : 1;
                if (close >= text.length) throw new CannotOutline(`an unclosed quote in the here-document delimiter on line ${line}`);
                delimiter += c === '"' ? text.slice(k + 1, close).replace(/\\(["\\$`])/g, "$1") : text.slice(k + 1, close);
                k = close + 1;
            } else if (c === "\\") {
                delimiter += text[k + 1] ?? "";
                k += 2;
            } else {
                delimiter += c;
                k++;
            }
        }
        if (k > start) out.push({ strip: operator[1] === "-", delimiter });
    }
    return out;
}

// Words after which another command may start: a brace or a keyword standing where a command does.
const SH_COMMAND_WORDS = new Set(["{", "}", "!", "then", "do", "else", "elif", "if", "while", "until", "time"]);

// A brace is a word of its own only where a command may start: never in `${x}`, `{a,b}`, quotes, `\}` or a comment.
function functionEnd(code, at, from, name, line) {
    const stack = [];
    let depth = 0;
    let command = true;
    let word = "";
    // True when the word just ended is the body's closing `}`; `next`, when given, says whether a command may follow.
    const endWord = (next) => {
        const brace = word !== "" && command && (word === "{" || word === "}");
        if (brace) depth += word === "{" ? 1 : -1;
        if (word !== "") command = command && SH_COMMAND_WORDS.has(word);
        if (next !== undefined) command = next;
        word = "";
        return brace && depth === 0;
    };
    for (let k = at; k < code.length; k++) {
        const text = code[k].text;
        let continued = false;
        for (let i = k === at ? from : 0; i < text.length; i++) {
            const c = text[i];
            const top = stack.at(-1);
            if (top === "'") { if (c === "'") stack.pop(); continue; }
            if (top === "$'" || top === "`") {
                if (c === "\\") i++;
                else if (c === top.at(-1)) stack.pop();
                continue;
            }
            if (top === '"' || top === "${") {
                if (c === "\\") i++;
                else if (c === (top === '"' ? '"' : "}")) stack.pop();
                else if (c === "$" && (text[i + 1] === "(" || text[i + 1] === "{")) stack.push(`$${text[++i]}`);
                else if (c === "`") stack.push("`");
                else if (top === "${" && (c === '"' || (c === "'" && !stack.includes('"')))) stack.push(c);
                continue;
            }
            // Code: the file's own level, or inside `$(…)`, where `)` closes the substitution.
            if (c === " " || c === "\t") { if (endWord() && !stack.length) return code[k].line; continue; }
            if (c === "#" && word === "") break;
            if (c === "\\") {
                if (i === text.length - 1) continued = true;
                else word += text[++i];
                word += "\\";
                continue;
            }
            if (c === "$" && (text[i + 1] === "(" || text[i + 1] === "{" || text[i + 1] === "'")) {
                stack.push(text[i + 1] === "(" ? "$(" : text[i + 1] === "{" ? "${" : "$'");
                word += c + text[++i];
                continue;
            }
            if (c === "'" || c === '"' || c === "`") { stack.push(c); word += c; continue; }
            if (c === ")" && top === "$(") { stack.pop(); word += c; continue; }
            if (";&|()".includes(c)) { if (endWord(true) && !stack.length) return code[k].line; continue; }
            if (c === "<" || c === ">") { if (endWord(false) && !stack.length) return code[k].line; continue; }
            word += c;
        }
        if (stack.length && stack.at(-1) !== "$(") continue;
        if (endWord(continued ? undefined : true) && !stack.length) return code[k].line;
    }
    throw new CannotOutline(`no closing brace for ${name}() on line ${line}`);
}

/** The outline of a shell script: its functions, its titled banners and the comment that opens it. */
export function outlineSh(src) {
    const srcLines = src.split("\n");
    const lines = src.endsWith("\n") ? srcLines.length - 1 : srcLines.length;
    const code = [];
    for (let i = 0; i < lines; i++) {
        code.push({ line: i + 1, text: srcLines[i] });
        if (/^\s*#/.test(srcLines[i])) continue;
        // Each body runs to its own delimiter's line, the next body starting after it.
        let j = i;
        for (const { strip, delimiter } of heredocs(srcLines[i], i + 1)) {
            j++;
            while (j < lines && (strip ? srcLines[j].replace(/^\t+/, "") : srcLines[j]) !== delimiter) j++;
            if (j >= lines) throw new CannotOutline(`an unterminated here-document on line ${i + 1}`);
        }
        i = j;
    }
    const entries = [];
    for (let k = 0; k < code.length; k++) {
        const { line, text } = code[k];
        const fn = text.match(SH_FUNCTION);
        if (!fn || /^\s*#/.test(text)) continue;
        const name = fn[2] ?? fn[3];
        let open = fn[4] ?? "";
        let at = k;
        if (!open && code[k + 1]?.text.trim().startsWith("{")) { at = k + 1; open = code[k + 1].text.trim(); }
        if (!open) continue;
        const end = functionEnd(code, at, code[at].text.length - open.length, name, line);
        let start = line;
        while (start > 1 && /^\s*#/.test(srcLines[start - 2]) && !srcLines[start - 2].startsWith("#!") && !isBanner(srcLines[start - 2])) start--;
        entries.push({ start, end, text: cut(oneLine(`${name}()`)), name: [name], children: [] });
    }
    const comments = code.filter((c) => /^\s*#/.test(c.text) && !c.text.startsWith("#!"));
    // The file's opening comment, up to its first line of code or the first span, names the file.
    const firstCode = code.find((c) => c.text.trim() !== "" && !/^\s*#/.test(c.text))?.line ?? lines + 1;
    const before = Math.min(firstCode, ...entries.map((e) => e.start));
    const head = comments.filter((c) => c.line < before);
    const text = head.map((c) => c.text.replace(/^\s*#\s?/, "").trim()).find((l) => l && !/^[-=]+$/.test(l));
    if (text) entries.push({ start: head[0].line, end: head.at(-1).line, text: cut(`# ${text}`), name: null, children: [], header: true });
    const numbered = comments.filter((c) => /^#\s+\d+[a-z]\.\s/.test(c.text)).map((c) => ({ line: c.line, title: c.text.replace(/^#\s+/, "") }));
    const sections = banners(comments.map((c) => ({ line: c.line, text: c.text.replace(/^\s*#/, "") })), numbered);
    return { lines, entries: place(order(entries), sections, lines, "#") };
}

// ===========================================================================================
// 4. Titled banners, the one structure both languages share
// ===========================================================================================

// A title on a rule of four or more `-` or `=`, or between two rules of eight or more; `sub` adds numbered parts (`4a.`).
function banners(commentLines, sub = []) {
    const at = new Map(commentLines.map((c) => [c.line, c.text.trim()]));
    const rule = (text) => /^[-=]{8,}$/.test(text ?? "");
    const found = [];
    for (const { line, text: raw } of commentLines) {
        const text = raw.trim();
        const inline = text.match(/^[-=]{4,}\s+(\S.*?)(?:\s+[-=]{4,})?$/) ?? text.match(/^(\S.*?)\s+[-=]{8,}$/);
        if (inline) found.push({ line, title: inline[1], level: 0 });
        else if (!rule(text) && text && rule(at.get(line - 1)) && rule(at.get(line + 1))) found.push({ line: line - 1, title: text, level: 0 });
    }
    return [...found, ...sub.map((s) => ({ ...s, level: 1 }))].sort((a, b) => a.line - b.line);
}

// A section nests in the innermost span holding it, and runs to the next section there or to that span's end.
function place(entries, sections, lines, mark) {
    const holder = (list, line) => {
        for (const e of list) if (!e.section && e.start < line && line <= e.end) return holder(e.children, line) ?? e;
        return null;
    };
    const groups = new Map();
    for (const section of sections) {
        const h = holder(entries, section.line);
        groups.set(h, [...(groups.get(h) ?? []), section]);
    }
    for (const [h, list] of groups) {
        const target = h ? h.children : entries;
        list.forEach((section, index) => {
            const next = list.slice(index + 1).find((s) => s.level <= section.level);
            target.push({ start: section.line, end: next ? next.line - 1 : h ? h.end : lines, text: cut(`${mark} § ${section.title}`), name: null, children: [], section: true });
        });
        order(target);
    }
    return entries;
}

function order(entries) {
    return entries.sort((a, b) => a.start - b.start || (b.section ? 1 : 0) - (a.section ? 1 : 0) || b.end - a.end);
}

// ===========================================================================================
// 5. Markdown: headings, and the section under each
// ===========================================================================================

// Headings as CommonMark reads them, outside fences, HTML comments and frontmatter; a setext heading in a list item is missed.

/** A heading's text as it reads rendered: a code span's content kept, links and images their text, and emphasis, tags and escapes gone. */
function plainText(title) {
    const inline = (text) =>
        text
            .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
            .replace(/!?\[([^\]]*)\]\[[^\]]*\]/g, "$1")
            .replace(/<[^>]*>/g, "")
            .replace(/\\([!-/:-@[-`{-~])/g, "$1")
            .replace(/(^|[^\p{L}\p{N}*_])[*_]+|[*_]+(?=[^\p{L}\p{N}*_]|$)/gu, "$1");
    let out = "";
    let at = 0;
    for (const span of title.matchAll(/(`+)(.+?)\1(?!`)/g)) {
        out += inline(title.slice(at, span.index)) + span[2].replace(/^ (.*) $/, "$1");
        at = span.index + span[0].length;
    }
    return out + inline(title.slice(at));
}

/** The anchor GitHub gives a heading. */
export function anchorOf(title) {
    return plainText(title).toLowerCase().replace(/[^\p{L}\p{M}\p{N}_\- ]/gu, "").replace(/ /g, "-");
}

const loose = (text) => plainText(text).replace(/\s+/g, " ").trim().toLowerCase();

// A line that opens a block other than a paragraph, so no `=` or `-` line under it makes it a heading.
const NOT_PARAGRAPH = /^(?: {4}|\t| {0,3}(?:>|[-*+](?:[ \t]|$)|\d{1,9}[.)](?:[ \t]|$)|<[A-Za-z/!?]|\|))/;
const RULE = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;

/** The outline of a Markdown file: `{lines, bytes, entries}`, an entry per heading, nested by level. */
export function outlineMd(src) {
    const srcLines = src.split("\n");
    const lines = src.endsWith("\n") ? srcLines.length - 1 : srcLines.length;
    const at = (i) => srcLines[i].replace(/\r$/, "");
    const offsets = [0];
    for (let i = 0; i < lines; i++) offsets.push(offsets[i] + Buffer.byteLength(srcLines[i]) + (i < srcLines.length - 1 ? 1 : 0));
    const found = [];
    let i = 0;
    if (lines > 0 && /^---[ \t]*$/.test(at(0))) {
        let close = 1;
        while (close < lines && !/^(?:---|\.\.\.)[ \t]*$/.test(at(close))) close++;
        if (close < lines) i = close + 1;
    }
    let fence = null;
    let comment = false;
    let para = null; // the line a paragraph opened at, at the margin, while it is open
    let above = "start"; // what the line above was: start, blank, heading, rule, para or other
    for (; i < lines; i++) {
        const line = at(i);
        if (fence) {
            if (fence.test(line)) {
                fence = null;
                above = "rule";
            }
            continue;
        }
        if (comment) {
            if (line.includes("-->")) {
                comment = false;
                above = "rule";
            }
            continue;
        }
        const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
        if (open && !(open[1][0] === "`" && open[2].includes("`"))) {
            fence = new RegExp(`^ {0,3}${open[1][0]}{${open[1].length},}[ \\t]*$`);
            para = null;
            continue;
        }
        if (/^ {0,3}<!--/.test(line)) {
            comment = !line.slice(line.indexOf("<!--") + 4).includes("-->");
            para = null;
            above = "rule";
            continue;
        }
        const atx = /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/.exec(line);
        if (atx) {
            found.push({ start: i + 1, level: atx[1].length, title: atx[2].replace(/(?:^|[ \t]+)#+[ \t]*$/, "").trim() });
            para = null;
            above = "heading";
            continue;
        }
        const underline = /^ {0,3}(=+|-+)[ \t]*$/.exec(line);
        if (underline && para !== null && above === "para") {
            const title = srcLines.slice(para - 1, i).map((l) => l.trim()).join(" ");
            found.push({ start: para, level: underline[1][0] === "=" ? 1 : 2, title });
            para = null;
            above = "heading";
            continue;
        }
        if (line.trim() === "") {
            para = null;
            above = "blank";
        } else if (RULE.test(line)) {
            para = null;
            above = "rule";
        } else if (NOT_PARAGRAPH.test(line)) {
            para = null;
            above = "other";
        } else if (above !== "para" && above !== "other") {
            // A paragraph a setext line may underline opens at the margin; one indented may sit in a list.
            para = /^\S/.test(line) ? i + 1 : null;
            above = para === null ? "other" : "para";
        }
    }
    const taken = new Map();
    const unique = (slug) => {
        let result = slug;
        while (taken.has(result)) {
            taken.set(slug, taken.get(slug) + 1);
            result = `${slug}-${taken.get(slug)}`;
        }
        taken.set(result, 0);
        return result;
    };
    const entries = [];
    const stack = [];
    found.forEach((h, k) => {
        const next = found.slice(k + 1).find((n) => n.level <= h.level);
        const end = next ? next.start - 1 : lines;
        const entry = {
            start: h.start,
            end,
            level: h.level,
            title: h.title,
            anchor: unique(anchorOf(h.title)),
            bytes: offsets[end] - offsets[h.start - 1],
            text: cut(`${"#".repeat(h.level)} ${h.title}`),
            name: null,
            children: [],
        };
        while (stack.length && stack.at(-1).level >= h.level) stack.pop();
        (stack.length ? stack.at(-1).children : entries).push(entry);
        stack.push(entry);
    });
    return { lines, bytes: offsets[lines], entries };
}

/** No heading answers a fragment: what `--find` finding no definition is to code, exit 1. */
export class NoSection extends CannotOutline {}

/** A fragment is a heading's anchor or its text, `Parent > Child` for a repeated one; `NoSection` when none answers. */
export function sectionOf(src, fragment) {
    const { entries } = outlineMd(src);
    const all = [];
    const walk = (list, chain) => {
        for (const e of list) {
            all.push({ e, chain });
            walk(e.children, [...chain, e]);
        }
    };
    walk(entries, []);
    let want = fragment.trim();
    try {
        want = decodeURIComponent(want);
    } catch {
        // not percent-encoded, so read as written
    }
    let hits = all.filter(({ e }) => e.anchor === want);
    if (hits.length === 0) hits = all.filter(({ e }) => loose(e.title) === loose(want));
    if (hits.length === 0 && want.includes(">")) {
        const parts = want.split(/\s*>\s*/).map(loose);
        hits = all.filter(({ e, chain }) => {
            if (loose(e.title) !== parts.at(-1)) return false;
            let k = 0;
            for (const a of chain) if (k < parts.length - 1 && loose(a.title) === parts[k]) k++;
            return k === parts.length - 1;
        });
    }
    if (hits.length === 0) throw new NoSection(`no heading answers #${fragment}`);
    if (hits.length > 1) throw new CannotOutline(`#${fragment} names ${hits.length} headings: ${hits.map(({ e }) => `#${e.anchor} (line ${e.start})`).join(", ")}`);
    const { e } = hits[0];
    const text = src.split("\n").slice(e.start - 1, e.end).join("\n");
    return { start: e.start, end: e.end, level: e.level, title: e.title, anchor: e.anchor, bytes: e.bytes, text };
}

// ===========================================================================================
// 6. Files, lookups, and the command line
// ===========================================================================================

/** The outline of one file, or `CannotOutline` saying why there is none; `shown` is the name it gives. */
export function outlineFile(file, shown = file, src = null) {
    try {
        src ??= fs.readFileSync(file, "utf8");
    } catch (error) {
        throw new CannotOutline(`cannot read ${shown}: ${error.code ?? error.message}`);
    }
    const language = languageOf(file, src.split("\n", 1)[0]);
    if (!language) throw new CannotOutline(`${shown} is not JavaScript, shell or Markdown; read it whole`);
    try {
        const outline = language === "js" ? outlineJs(src) : language === "sh" ? outlineSh(src) : outlineMd(src);
        check(outline);
        return outline;
    } catch (error) {
        if (error instanceof CannotOutline) throw new CannotOutline(`${shown}: ${error.message}; read it as usual`);
        throw error;
    }
}

// Spans nest in their parent, open before they close and never overlap; an outline breaking one is refused.
function check({ lines, entries }) {
    const walk = (list, lo, hi) => {
        let previous = null;
        for (const e of list) {
            if (!(e.start >= lo && e.start <= e.end && e.end <= hi)) throw new CannotOutline(`a span ${e.start}-${e.end} outside ${lo}-${hi}`);
            if (!e.section && previous && e.start <= previous.end) throw new CannotOutline(`spans ${previous.start}-${previous.end} and ${e.start}-${e.end} overlap`);
            if (!e.section) previous = e;
            walk(e.children, e.start, e.end);
        }
    };
    walk(entries, 1, Math.max(lines, 1));
}

const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** A heading's line carries its anchor, which names it in `<file>#<anchor>` where its text repeats. */
export function render(file, { lines, bytes, entries }) {
    const out = [`${file}: ${lines} line${lines === 1 ? "" : "s"}${bytes === undefined ? "" : `, ${grouped(bytes)} B`}`];
    const walk = (list, indent) => {
        for (const e of list) {
            const anchor = e.anchor === undefined ? "" : ` #${e.anchor}`;
            const size = e.bytes === undefined ? "" : ` (${grouped(e.bytes)} B)`;
            out.push(`${indent}${e.start === e.end ? e.start : `${e.start}-${e.end}`} ${e.text}${anchor}${size}`);
            walk(e.children, `${indent}  `);
        }
    };
    walk(entries, "");
    return out;
}

/** Tracked JavaScript and shell files, by extension or `#!`, as paths relative to `cwd`. */
export function trackedCode(cwd) {
    let listed;
    try {
        listed = execFileSync("git", ["ls-files", "-z"], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    } catch {
        throw new CannotOutline("--find reads the tracked code, and this is not a git work tree");
    }
    return listed.split("\0").filter(Boolean).filter((file) => {
        const language = languageOf(file);
        if (language) return language !== "md";
        if (path.extname(file) !== "") return false;
        let fd;
        try {
            fd = fs.openSync(path.join(cwd, file), "r");
            const head = Buffer.alloc(80);
            const n = fs.readSync(fd, head, 0, 80, 0);
            return languageOf(file, head.subarray(0, n).toString("utf8").split("\n")[0]) !== null;
        } catch (error) {
            if (error.code === "ENOENT" || error.code === "EISDIR") return false;
            throw new CannotOutline(`cannot read ${file}: ${error.code ?? error.message}`);
        } finally {
            if (fd !== undefined) fs.closeSync(fd);
        }
    });
}

/** Where a name is defined in the tracked code: `path:start-end text` lines, members as `Class.member` too. */
export function find(cwd, name) {
    const hits = [];
    for (const file of trackedCode(cwd)) {
        const full = path.join(cwd, file);
        let text;
        try {
            text = fs.readFileSync(full, "utf8");
        } catch (error) {
            // A path gone from the work tree holds no definition; one that cannot be read might, so it is refused.
            if (error.code === "ENOENT" || error.code === "EISDIR") continue;
            throw new CannotOutline(`cannot read ${file}: ${error.code ?? error.message}`);
        }
        if (!text.includes(name.split(".").at(-1))) continue;
        const { entries } = outlineFile(full, file, text);
        const walk = (list, owner) => {
            for (const e of list) {
                const names = Array.isArray(e.name) ? e.name : e.name ? [e.name] : [];
                if (names.includes(name) || (owner && names.some((n) => `${owner}.${n}` === name))) {
                    hits.push(`${file}:${e.start === e.end ? e.start : `${e.start}-${e.end}`} ${e.text}`);
                }
                walk(e.children, names[0] ?? null);
            }
        };
        walk(entries, null);
    }
    return hits;
}

/** Null for an argument naming a file; a path may hold `#`, so the file is the shortest prefix before a `#` that names one. */
function sectionArg(cwd, arg) {
    const isFile = (rel) => fs.statSync(path.resolve(cwd, rel), { throwIfNoEntry: false })?.isFile() ?? false;
    if (!arg.includes("#") || isFile(arg)) return null;
    let at = arg.indexOf("#");
    while (at !== -1 && !isFile(arg.slice(0, at))) at = arg.indexOf("#", at + 1);
    const file = at === -1 ? arg.slice(0, arg.indexOf("#")) : arg.slice(0, at);
    if (at === -1) throw new CannotOutline(`cannot read ${file}: ENOENT`);
    if (languageOf(file) !== "md") throw new CannotOutline(`${file} is not Markdown, and only a Markdown file is read by #heading`);
    let src;
    try {
        src = fs.readFileSync(path.resolve(cwd, file), "utf8");
    } catch (error) {
        throw new CannotOutline(`cannot read ${file}: ${error.code ?? error.message}`);
    }
    return { file, src, fragment: arg.slice(at + 1) };
}

export function main(argv, stdout, stderr, cwd = process.cwd()) {
    const args = argv.slice(2);
    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
        (args.length ? stdout : stderr).write(`symbols: ${USAGE}\n`);
        return args.length ? 0 : 2;
    }
    try {
        if (args[0] === "--find") {
            const names = args.slice(1);
            if (names.length === 0 || names.some((name) => name.startsWith("-"))) {
                stderr.write(`symbols: ${USAGE}\n`);
                return 2;
            }
            let missing = 0;
            for (const name of names) {
                const hits = find(cwd, name);
                if (hits.length === 0) {
                    stderr.write(`symbols: no definition of ${name} in the tracked code\n`);
                    missing++;
                }
                for (const hit of hits) stdout.write(`${hit}\n`);
            }
            return missing ? 1 : 0;
        }
        const option = args.find((arg) => arg.startsWith("-"));
        if (option) {
            stderr.write(`symbols: unknown option ${option}; ${USAGE}\n`);
            return 2;
        }
        const printed = [];
        let missing = 0;
        for (const arg of args) {
            const read = sectionArg(cwd, arg);
            if (read === null) {
                printed.push(render(arg, outlineFile(path.resolve(cwd, arg), arg)).join("\n"));
                continue;
            }
            try {
                const { start, end, bytes, text } = sectionOf(read.src, read.fragment);
                printed.push(`${read.file}:${start}-${end} (${grouped(bytes)} B)\n${text.replace(/\n$/, "")}`);
            } catch (error) {
                if (!(error instanceof NoSection)) throw new CannotOutline(`${read.file}: ${error.message}`);
                stderr.write(`symbols: ${read.file}: ${error.message}; outline it to see its headings\n`);
                missing++;
            }
        }
        if (printed.length) stdout.write(`${printed.join("\n\n")}\n`);
        return missing ? 1 : 0;
    } catch (error) {
        // An unexpected throw exits 2, never 1, which would send a session looking for code that exists.
        const why = error instanceof CannotOutline ? error.message : `unexpected ${error?.name ?? "error"}: ${String(error?.message ?? error).split("\n")[0]}`;
        stderr.write(`symbols: could not outline — ${why}\n`);
        return 2;
    }
}

// Node realpaths `import.meta.url` but not `process.argv[1]`, so run through a symlink this guard does not fire.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = main(process.argv, process.stdout, process.stderr);
}
