// A repair — the bundle path a rewriter owes a workspace it touches.

import path from "node:path";
import { fileURLToPath } from "node:url";

/** The token `cli/init.mjs` writes on each line that carries the bundle path. */
export const MARKER = "portulan:bundle-fallback";

const ENTRY = ["cli", "index.mjs"];

/** A script, by name or shebang: prose that mentions the marker marks nothing. */
function couldCarryTheRail(rel, text) {
    if (rel.endsWith(".sh")) return true;
    const first = text.slice(0, text.indexOf("\n") + 1 || undefined);
    return first.startsWith("#!") && /\b(?:ba|da|k|z)?sh\b/.test(first);
}

function isMarkedScript(rel, text) {
    return text.includes(MARKER) && couldCarryTheRail(rel, text);
}

const OWN_BUNDLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function entryFor(bundle) {
    return `${bundle}/${ENTRY.join("/")}`;
}

function quotedEntry(line) {
    const matches = [...line.matchAll(/"((?:[^"\\]|\\.)*)"/g)].filter((m) => m[1].endsWith(`/${ENTRY.join("/")}`));
    return matches.length === 1 ? matches[0] : null;
}

/** Each marked line's entry path, JSON-decoded, since the raw capture keeps the escapes `init` wrote. */
function marked(text) {
    const lines = text.split("\n");
    const hits = [];
    for (const [n, line] of lines.entries()) {
        if (!line.includes(MARKER)) continue;
        const found = quotedEntry(line);
        if (found === null) return { ok: false, line: n + 1, text: line };
        let decoded;
        try {
            decoded = JSON.parse(found[0]);
        } catch {
            return { ok: false, line: n + 1, text: line };
        }
        hits.push({ n, entry: decoded, whole: found[0] });
    }
    return { ok: true, lines, hits };
}

export const step = {
    id: "0002-bundle-fallback-path",
    kind: "repair",
    from: null,
    to: null,
    title: "a drafted rail's bundle path is re-derived for the bundle running this",
    why:
        "`init` bakes the bundle it ran from into `verify/index.sh` as an absolute path on two lines " +
        "marked `# portulan:bundle-fallback`. A workspace is not fixed where it was drafted: the path " +
        "travels to machines it was never true on, and the rail then exits 2 rather than failing loudly.",

    owed(ws, ctx = {}) {
        const want = entryFor(ctx.bundle ?? OWN_BUNDLE);
        let any = false;
        for (const rel of ws.list()) {
            let text;
            try {
                text = ws.read(rel);
            } catch (error) {
                return { owed: null, because: `${rel} could not be read — ${error.code ?? error.message}, so whether it carries a stale bundle path is unknown` };
            }
            if (!isMarkedScript(rel, text)) continue;
            const found = marked(text);
            if (!found.ok) {
                return { owed: null, because: `${rel} line ${found.line} carries the marker in a shape this step does not recognise` };
            }
            if (found.hits.some((h) => h.entry !== want)) any = true;
        }
        return any
            ? { owed: true, because: `a marked line names a bundle other than ${want}` }
            : { owed: false, because: `no marked line names a bundle other than ${want}` };
    },

    plan(ws, ctx = {}) {
        const bundle = ctx.bundle ?? OWN_BUNDLE;
        const want = entryFor(bundle);
        const edits = [];
        for (const rel of ws.list()) {
            let text;
            try {
                text = ws.read(rel);
            } catch (error) {
                return { ok: false, reason: `${rel} could not be read — ${error.code ?? error.message}` };
            }
            if (!isMarkedScript(rel, text)) continue;
            const found = marked(text);
            if (!found.ok) {
                return {
                    ok: false,
                    reason:
                        `${rel} line ${found.line} carries \`${MARKER}\` but is not the shape \`init\` writes — ` +
                        "expected exactly one quoted path ending `/cli/index.mjs`. Refusing to rewrite a line it " +
                        `cannot read rather than guessing: ${found.text.trim()}`,
                };
            }
            if (!found.hits.some((h) => h.entry !== want)) continue;

            const lines = [...found.lines];
            for (const hit of found.hits) {
                // A function replacer: a string one reads `$&`, `` $` ``, `$'` and `$$` in the path as patterns.
                lines[hit.n] = lines[hit.n].replace(hit.whole, () => JSON.stringify(want));
            }
            edits.push({ file: rel, next: lines.join("\n") });
        }
        return { ok: true, edits };
    },
};
