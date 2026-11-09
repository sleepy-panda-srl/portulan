// Bounded streaming failure excerpts for the Stop recipe relay.
import { StringDecoder } from "node:string_decoder";

export const STOP_DIAGNOSTIC_BYTES = 4096;
export const STOP_RECIPE_BYTES = 6144;
const LINE_BYTES = 1024;
const SUCCESS = /^(?:PASS(?:\b|[-_])|GREEN\b|ok\b|[✔✓▶﹣]|TAP version \d+\b|\d+\.\.\d+(?:\s|$))|^#\s*Subtest:|^(?:#|ℹ)\s*(?:(?:pass|tests|suites|duration_ms|skipped|todo)\b|(?:fail|cancelled)\s+0\b)/i;
const FAILURE = /^(?:#\s*)?(?:FAIL(?:ED|URE|URES)?(?:\b|[-_])|RED\b|ERROR\b|ERR_[A-Z_]+\b|(?:Assertion|Type|Syntax|Range|Reference|Eval)?Error\b|not ok\b|[✗✖×])|^(?:#|ℹ)\s*(?:fail|cancelled)\s+[1-9]\d*\b|(?:^|\s)(?:error:|command not found\b|permission denied\b|No such file or directory\b)|^(?:verify|tests):.*(?:failed|failing|could not|cannot|refused|missing)/i;

export function clipDiagnostic(value, limit) {
    const text = String(value);
    if (Buffer.byteLength(text) <= limit) return text;
    const notice = " [clipped]";
    const decoder = new StringDecoder("utf8");
    return decoder.write(Buffer.from(text).subarray(0, limit - Buffer.byteLength(notice))) + notice;
}

function lines() {
    const kept = [];
    let bytes = 0, omitted = 0;
    return {
        add(line) {
            const size = Buffer.byteLength(line) + 1;
            if (bytes + size <= 2800) { kept.push(line); bytes += size; }
            else omitted++;
        },
        get present() { return kept.length > 0; },
        text: () => kept.join("\n") + (omitted ? `\n[${omitted} diagnostic lines omitted]` : ""),
    };
}

export function stopDiagnostics() {
    const failures = lines(), fallback = lines();
    const streams = new Map();
    let observed = false;
    function flush(state) {
        const decoder = new StringDecoder("utf8");
        const text = decoder.write(Buffer.concat(state.chunks)) + (state.clipped ? " [line clipped]" : decoder.end());
        const line = text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
        const trimmed = line.trim();
        state.chunks = []; state.bytes = 0; state.clipped = false;
        if (!trimmed) return;
        const indent = line.length - line.trimStart().length;
        if (state.todoIndent !== null) {
            if (indent === state.todoIndent + 2 && trimmed === state.todoEnd) { state.todoIndent = null; return; }
            if (indent > state.todoIndent) return;
            state.todoIndent = null;
        }
        const tapExpected = /^(?:ok|not ok)\s+\d+\b.*(?<!\\)#\s*(?:TODO|SKIP)\b/i.test(trimmed);
        if (tapExpected || /^⚠.*#\s*TODO\b/i.test(trimmed)) {
            state.todoIndent = indent; state.todoEnd = tapExpected ? "..." : "}"; state.context = 0; state.location = null;
            return;
        }
        if (/^(?:---|\.\.\.)$|^duration_ms:\s*\d+(?:\.\d+)?$|^type:\s*['"](?:test|suite)['"]$/.test(trimmed)) return;
        if (trimmed === "✖ failing tests:") { state.context = 0; state.location = null; return; }
        if (/^test at .+:\d+(?::\d+)?$/.test(trimmed)) { state.location = line; return; }
        if (SUCCESS.test(trimmed)) { state.context = 0; state.location = null; return; }
        if (FAILURE.test(trimmed)) {
            if (state.location) failures.add(state.location);
            state.location = null;
            failures.add(line); state.context = 8;
        }
        else if (state.context && /^\s|^#\s/.test(line)) { failures.add(line); state.context--; }
        else {
            if (state.location) fallback.add(state.location);
            state.location = null;
            fallback.add(line); state.context = 0;
        }
    }
    function add(name, chunk) {
        observed = true;
        name = name === "stderr" ? "stderr" : "stdout";
        if (!streams.has(name)) streams.set(name, { chunks: [], bytes: 0, clipped: false, context: 0, todoIndent: null, location: null });
        const state = streams.get(name);
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        let start = 0;
        while (start < buffer.length) {
            const newline = buffer.indexOf(10, start);
            const end = newline < 0 ? buffer.length : newline;
            const size = Math.min(LINE_BYTES - state.bytes, end - start);
            if (size) { state.chunks.push(Buffer.from(buffer.subarray(start, start + size))); state.bytes += size; }
            if (end - start > size) state.clipped = true;
            if (newline < 0) break;
            flush(state);
            start = newline + 1;
        }
    }
    return {
        add,
        finish(result) {
            const raw = Array.isArray(result.diagnostics) ? result.diagnostics : [];
            if (!observed && result.output) {
                const suffix = raw.length ? `\n${raw.join("\n")}` : "";
                const output = suffix && result.output.endsWith(suffix) ? result.output.slice(0, -suffix.length) : result.output;
                if (output) add("stdout", output);
            }
            for (const state of streams.values()) if (state.bytes || state.clipped) flush(state);
            for (const state of streams.values()) if (state.location) fallback.add(state.location);
            const structured = [
                ...(result.interrupted ? [`interrupted by ${clipDiagnostic(result.interrupted, 64)}`] : []),
                ...(result.timedOut ? ["recipe time limit reached"] : []),
            ];
            const reasons = [...structured, ...raw.filter(reason => !structured.includes(reason))];
            const runner = reasons.length
                ? `executor: ${reasons.slice(0, 3).map(reason => clipDiagnostic(reason, 192)).join("; ")}${reasons.length > 3 ? ` [${reasons.length - 3} executor reasons omitted]` : ""}\n` : "";
            const body = failures.present ? failures.text() : fallback.present
                ? `unrecognized output (no failure marker identified):\n${fallback.text()}` : "no failure diagnostic identified";
            return clipDiagnostic(`${runner}${body}\nRun verification explicitly for complete output.`, STOP_DIAGNOSTIC_BYTES);
        },
    };
}
