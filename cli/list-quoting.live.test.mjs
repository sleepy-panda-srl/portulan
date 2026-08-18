// Every recipe that enumerates the tree reads the pathname git actually carries.
//
// **Why this file exists.** #209 reported that `docs.sh` and `json.sh` "split file lists on newlines"
// and would "mis-split" a tracked filename containing one. Measured, that does not happen: without
// `-z`, git **C-quotes** a pathname holding a byte outside printable ASCII, and it C-quotes a control
// character **regardless of `core.quotePath`**. `we<LF>ird.md` comes back as the single line
// `"we\nird.md"` — quotes and backslash-n included. One line. Nothing splits.
//
// The real defect is one layer along and strictly wider: the quoted form **is not the path**. A
// consumer that compares, strips or opens it is working on a spelling the tree does not carry. That
// reaches ordinary filenames, not only exotic ones — `café.mjs` is enough — which is why this is a rail
// and not a note.
//
// **Both directions were live in this tree when the rail was written**, measured rather than argued:
//
//   - `doctor.sh`, `index.sh`, `plugin.sh` — a `$`-anchored `sed` cannot strip a suffix that now ends
//     in a quote, so `present` carried a spelling matching no declared workspace and the recipe
//     refused a legal tree. **A false red.**
//   - `docs.sh`'s cli-table enumeration — a quoted path keeps its `cli/` prefix *inside* the quote, so
//     `sed 's|^cli/||'` misses it and `grep -v '/'` then discards it as a subdirectory entry. The file
//     left the pipeline as nothing at all and the table check passed over a file it never saw.
//     **A false green, and the only one this class produced here** — which is why it outranked the
//     rest of the sweep despite being the least conspicuous line in it.
//
// **The two remedies are not interchangeable, and the rail accepts either because they fail
// differently rather than because they are equivalent.** `-z` emits raw bytes, so nothing is
// transformed at all; it is the only sound choice for a consumer that must see every byte, and it is
// what `control-chars.sh`, `json.sh` and `rule-carriers.sh` take. `core.quotePath=false` unquotes
// **non-ASCII only** — a control character is still quoted — so it closes the reachable case and leaves
// the exotic one loud rather than silent. `docs.sh` cannot take `-z` for its enumeration: the `\001`
// sentinel in its links `awk` is safe *precisely because* the line-based form can never deliver that
// byte raw, and switching to `-z` would arm a collision the current shape forbids. That is a real
// constraint discovered by reading the code, not a preference — and it is why this rail asks for
// "one of two" instead of mandating the stronger one everywhere.
//
// **Its limits, stated rather than left to be found.** It reads the recipes as text: it knows an
// invocation carries a flag, not that the flag is honoured downstream, and a caller that built its
// argument list in a variable would pass while naming nothing. It strips whole-line `#` comments and
// single-quoted runs before matching, so a `git ls-files` inside `printf '…'` is correctly read as
// prose — but that stripping is naive about an unbalanced quote, which no recipe here has.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERIFY = path.join(REPO, ".portulan", "verify");

/**
 * Invocations exempt from the rule, with the reason each is exempt.
 *
 * **Keyed by the code, never by a line number**, because a line number drifts and would silently
 * exempt whatever moved into its place. One entry, and it earns it: `in_the_way` pipes `--stage`
 * output through `cut -c1-6`, which takes the MODE field and never the pathname, so no spelling of the
 * path can reach a comparison. Quoting is genuinely irrelevant there rather than merely harmless.
 */
const EXEMPT = Object.freeze([
    { file: "docs.sh", contains: "git ls-files --stage --", why: "reads the mode field via cut -c1-6; the pathname never reaches a comparison" },
]);

/** A line invokes git if `git`, optionally with `-c <setting>` pairs, is followed by `ls-files`. */
const INVOKES = /(?:^|[\s(=!])git(?:\s+-c\s+\S+)*\s+ls-files/;

/** Whole-line `#` comments dropped, then single-quoted runs blanked so a quoted mention is prose. */
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
    // The control the header's limits paragraph earns. A matcher that found nothing would make the
    // assertion above vacuously green, which is the shape this whole repository refuses; and one that
    // counted `printf 'verify: git ls-files failed …'` would be reporting on prose. Both are bound.
    const found = invocations();
    assert.ok(found.length >= 9, `expected at least 9 real invocations across the recipes, found ${found.length}`);
    assert.ok(found.some((i) => i.file === "json.sh"), "json.sh enumerates the tree and must appear");
    assert.ok(
        !found.some((i) => /^printf/.test(i.text)),
        "a `git ls-files` inside a printf string is prose and must not be counted as an invocation",
    );
    // Every recipe that fails to enumerate says so on stderr, so each of those prose lines exists and
    // is the exact thing the stripper must discard — a control on the stripper, not on the recipes.
    const proseLines = fs
        .readFileSync(path.join(VERIFY, "json.sh"), "utf8")
        .split("\n")
        .filter((l) => /^\s*printf .*ls-files/.test(l));
    assert.equal(proseLines.length, 1, "json.sh should carry exactly one printed ls-files mention");
    assert.equal(stripped(proseLines[0]).includes("ls-files"), false, "and the stripper should blank it");
});

test("the exemption roster is honest — every entry still matches something", () => {
    // A stale exemption is worse than none: it reads as a considered decision while covering nothing,
    // and the next reader trusts it. If `in_the_way` is rewritten, this reds and the entry gets
    // re-judged rather than quietly outliving the code it was written about.
    const all = invocations();
    for (const e of EXEMPT) {
        assert.ok(
            all.some((i) => i.file === e.file && i.bare.includes(e.contains)),
            `exempt entry matches nothing and should be removed: ${e.file} — ${e.contains}`,
        );
    }
});
