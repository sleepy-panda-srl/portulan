// A repair — the bundle path a rewriter owes a workspace it touches.
//
// Since milestone 7 session 7, `cli/init.mjs` drafts `verify/index.sh` with a third CLI location baked
// in: the bundle `init` ran from, as an ABSOLUTE path that git cannot carry anywhere. It is a
// deliberate convenience for the person who ran `init`, and it is true on exactly one machine.
//
// **The failure is quiet, which is why it needs a tool rather than a reminder.** `vendor --switch`
// copies these files byte for byte into another residence; a clone lands on a machine that never had
// that bundle. The rail then exits **2 — could not run**, which is the fail-closed direction and is
// therefore easy to never notice: nothing goes red, the index simply stops being checked.
//
// **The marker is the contract.** `cli/init.mjs` writes `# portulan:bundle-fallback` on both lines
// carrying the path precisely so a rewriter can FIND them rather than having to notice a comment, and
// `cli/init.test.mjs` asserts the marker survives edits to the recipe. This step is the rewriter that
// note was written for.

import path from "node:path";
import { fileURLToPath } from "node:url";

/** The token `cli/init.mjs` writes. One spelling, exported so a reader can grep for the pair. */
export const MARKER = "portulan:bundle-fallback";

/** The entry point a marked line points at, relative to a bundle root. */
const ENTRY = ["cli", "index.mjs"];

/**
 * Is this file one the marker could be *marking*, as opposed to one that talks about the marker?
 *
 * **Found by running this step against this repository rather than against its own fixtures.** The
 * marker is a token, and a token appears in prose: `.portulan/handoffs/2026-08-11-…md` documents the
 * marker in a sentence, and the first cut of this step read that paragraph as a marked line of a
 * shape it did not recognise and refused to migrate the workspace at all — exit 2, on the one
 * workspace this repository actually owns. Every unit test passed, because no fixture here had ever
 * written about itself.
 *
 * What a repair fixes is a **runnable fallback**, so the scope is scripts: a shell shebang, or a
 * `.sh` name. That is narrower than "any file carrying the token" and it is the honest reading of
 * what `cli/init.mjs` writes — it is deliberately NOT narrowed to `verify/index.sh`, because keying
 * on the filename would make a second and narrower carrier of the rule the marker exists to be.
 */
function couldCarryTheRail(rel, text) {
    if (rel.endsWith(".sh")) return true;
    const first = text.slice(0, text.indexOf("\n") + 1 || undefined);
    return first.startsWith("#!") && /\b(?:ba|da|k|z)?sh\b/.test(first);
}

/** This bundle, derived from where this module sits rather than passed in and trusted. */
const OWN_BUNDLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** What a marked line should name, for a given bundle root. */
function entryFor(bundle) {
    return `${bundle}/${ENTRY.join("/")}`;
}

/**
 * The one JSON string literal on a marked line that names a CLI entry point.
 *
 * Returns `null` when the line is not the shape `init` writes — which is a **refusal**, never a
 * best-effort rewrite. A marked line this step does not recognise is somebody's edit, and rewriting
 * around it by pattern would be exactly the guesswork `../README.md` says a repair may not do.
 */
function quotedEntry(line) {
    const matches = [...line.matchAll(/"((?:[^"\\]|\\.)*)"/g)].filter((m) => m[1].endsWith(`/${ENTRY.join("/")}`));
    return matches.length === 1 ? matches[0] : null;
}

/**
 * Every marked line in `text`, paired with the entry path it names — or a reason it is unreadable.
 *
 * **`quoted` is the DECODED path, not the source text between the quotes.** The regex captures what
 * is written in the file, which is still JSON-escaped: `init` emits `JSON.stringify(...)`, so a
 * bundle at `C:\Users\x` appears as `"C:\\Users\\x/cli/index.mjs"`. Comparing that raw capture to an
 * unescaped `want` never matches, and the step reports itself **perpetually owed** — rewriting the
 * same file on every run, forever.
 *
 * Invisible on POSIX, where an ordinary path contains nothing JSON escapes, which is why every test
 * and every live run here passed over it. Copilot's promoted note, round 4 on #231.
 *
 * A literal that will not decode is treated as unreadable rather than guessed at, which is the same
 * refusal an unrecognised marked line already gets.
 */
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
        hits.push({ n, quoted: decoded, whole: found[0] });
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
                // *An empty set is two questions.* A file that could not be read has not answered
                // anything, and reporting `not owed` here is "nothing looked" recorded as "nothing
                // wrong" — in a step whose entire subject is a failure that is already silent.
                return { owed: null, because: `${rel} could not be read — ${error.code ?? error.message}, so whether it carries a stale bundle path is unknown` };
            }
            if (!text.includes(MARKER) || !couldCarryTheRail(rel, text)) continue;
            const found = marked(text);
            if (!found.ok) {
                return { owed: null, because: `${rel} line ${found.line} carries the marker in a shape this step does not recognise` };
            }
            if (found.hits.some((h) => h.quoted !== want)) any = true;
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
            // The same two conditions as `owed`, and they are spelled the same way on purpose: a
            // scope that differed between asking and doing is `0020`'s class, and it would show up
            // as a step reporting itself owed and then planning no edit.
            if (!text.includes(MARKER) || !couldCarryTheRail(rel, text)) continue;
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
            if (!found.hits.some((h) => h.quoted !== want)) continue;

            // Rewritten by SPLICING the one recognised literal, never by a replace over the line: a
            // line may legitimately carry other quoted text, and a blanket substitution would edit it.
            const lines = [...found.lines];
            for (const hit of found.hits) {
                // A **function** replacer, not a string one. `String.prototype.replace` reads `$&`,
                // `` $` ``, `$'` and `$$` in the REPLACEMENT as patterns, so a checkout under a
                // directory whose name contains one of them spliced the old path back in with broken
                // quoting — producing a corrupted rail that `doctor` then grades GREEN, because
                // `doctor` never runs shell. A function replacer is inserted verbatim.
                // Found at the pre-commit checkpoint, by building the path rather than reading the line.
                lines[hit.n] = lines[hit.n].replace(hit.whole, () => JSON.stringify(want));
            }
            edits.push({ file: rel, next: lines.join("\n") });
        }
        return { ok: true, edits };
    },
};
