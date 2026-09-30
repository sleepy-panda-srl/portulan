#!/usr/bin/env node
// Mutation-test this repository's two gate matchers against the corpus that claims to cover them.
//
// Exit 0 green · 1 red · 2 could not run.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CompileError } from "./compile.mjs";
import { CouldNotRun, partition, readCorpus, yieldedRules } from "./goldens.mjs";

export const SUBJECT = "cli/compile.mjs";

/** Every function and table `matchesRule` can reach, listed by hand rather than derived. */
export const REGION = [
    "matchesRule",
    "matchesPath",
    "shellWrites",
    "shellSegments",
    "commandSegments",
    "shellWords",
    "spellings",
    "stripHeredocs",
    "stripLeadingRedirections",
    "REDIRECTION_TARGET",
    "LEADING_REDIRECTION",
    "namesTarget",
    "normalisePath",
    "ancestors",
    "writesWhatItNames",
    "FILE_WRITERS",
    "IN_PLACE_EDITORS",
    "COMMAND_PREFIXES",
    "SEGMENT_LEADERS",
    "OPERATOR",
    "ASSIGNMENT",
    "WRITE_TOOLS",
    "READ_TOOLS",
];

export const OUTCOMES = ["killed", "survives"];

/** Record `survives` only for a mutant equivalent outright or under the yielded policy: a fixture can kill any other. */
export const OPERATORS = [
    // ---------------------------------------------------------------------------------- matchesRule
    {
        id: "matchesRule-shell-drops-exact-match",
        member: "matchesRule",
        find: "action.shell.endsWith(\"/\") ? s.startsWith(action.shell) : s === action.shell || s.startsWith(`${action.shell} `)",
        replace: "action.shell.endsWith(\"/\") ? s.startsWith(action.shell) : s.startsWith(`${action.shell} `)",
        outcome: "killed",
        why: "A command spelled EXACTLY as its target — `git commit` with no arguments — stops matching.",
    },
    {
        id: "matchesRule-shell-drops-word-boundary",
        member: "matchesRule",
        find: "s === action.shell || s.startsWith(`${action.shell} `)",
        replace: "s === action.shell || s.startsWith(action.shell)",
        outcome: "killed",
        why: "The whitespace boundary is what stops `git push` covering `git pushall`. Removing it is a false red on an unrelated command.",
    },
    {
        id: "matchesRule-shell-drops-segment-arm",
        member: "matchesRule",
        find: "return spellings(input.command).some(reach) || commandSegments(input.command).some((seg) => spellings(seg).some(reach));",
        replace: "return spellings(input.command).some(reach);",
        outcome: "killed",
        why: "Reopens hole 2 wholesale: a gated command behind any separator reaches nothing.",
    },
    {
        id: "matchesRule-inserts-a-no-op",
        member: "matchesRule",
        find: "const action = rule?.action ?? {};",
        replace: "const action = rule?.action ?? {};\n    void action;",
        outcome: "survives",
        why: "EQUIVALENT: a no-op statement. Present as the table's own control — an operator that changes the source and not the behaviour must survive, or the harness is reporting kills it did not make.",
    },
    {
        id: "matchesRule-shell-stops-segmenting-a-spelling",
        member: "matchesRule",
        find: "const reach = (s) => hit(s) || commandSegments(s).some(hit);",
        replace: "const reach = (s) => hit(s);",
        outcome: "killed",
        why: "Reverts the 2026-08-25 repair and reopens the live bypass it closed: `bash -c \"ls; git push --force origin main\"` — one wrapper, one separator, every Gated shell action.",
    },
    {
        id: "matchesRule-write-drops-bash-branch",
        member: "matchesRule",
        find: "        if (tool === \"Bash\") {\n            // Whole line and per segment, exactly as the `shell` branch above",
        replace: "        if (false && tool === \"Bash\") {\n            // Whole line and per segment, exactly as the `shell` branch above",
        outcome: "killed",
        why: "Reopens the constitution's shell half entirely — `echo x >> docs/vision.md` gated by neither layer.",
    },
    {
        id: "matchesRule-write-drops-segment-arm",
        member: "matchesRule",
        find: "                spellings(input.command).some(writes) ||\n                commandSegments(input.command).some((seg) => spellings(seg).some(writes))",
        replace: "                spellings(input.command).some(writes)",
        outcome: "killed",
        why: "The four write-gate holes #71 closed reopen; each is reachable only through this second arm.",
    },
    {
        id: "matchesRule-read-accepts-any-tool",
        member: "matchesRule",
        find: "if (typeof action.read === \"string\" && READ_TOOLS.includes(tool)) {",
        replace: "if (typeof action.read === \"string\") {",
        outcome: "survives",
        why: "EQUIVALENT UNDER THE YIELDED POLICY: the one `read:` rule declared is `read-anything-in-the-repository`, whose target is `./` — hole 8, `matchesPath` answers false for every input whatever the tool. No fixture can distinguish this, and none should be invented to; the mutant becomes killable the day a `read:` rule with a real target is declared.",
    },
    // ---------------------------------------------------------------------------------- matchesPath
    {
        id: "matchesPath-subtree-becomes-tail",
        member: "matchesPath",
        find: "return clean.endsWith(\"/\") ? normalised.includes(`/${clean}`) : normalised.endsWith(`/${clean}`);",
        replace: "return normalised.endsWith(`/${clean}`);",
        outcome: "killed",
        why: "A subtree target stops covering its subtree: `core/` no longer matches `core/engine.md`.",
    },
    {
        id: "matchesPath-tail-becomes-substring",
        member: "matchesPath",
        find: "clean.endsWith(\"/\") ? normalised.includes(`/${clean}`) : normalised.endsWith(`/${clean}`)",
        replace: "normalised.includes(`/${clean}`)",
        outcome: "killed",
        why: "An exact target starts matching any path CONTAINING it — `docs/vision.md.bak` becomes the constitution.",
    },
    {
        id: "matchesPath-admits-the-empty-target",
        member: "matchesPath",
        find: "if (clean === \"\" || clean === \"/\") return false;",
        replace: "if (clean === \"/\") return false;",
        outcome: "killed",
        why: "CLOSES hole 8 — a `./` target would start matching. The documented-hole cases must go red, which is the good-news direction the corpus exists to catch.",
    },
    {
        id: "matchesPath-drops-the-empty-candidate-guard",
        member: "matchesPath",
        find: "if (typeof candidate !== \"string\" || candidate === \"\") return false;",
        replace: "if (typeof candidate !== \"string\") return false;",
        outcome: "survives",
        why: "EQUIVALENT: with `candidate` empty, `\"\".endsWith(`/${clean}`)` is false for every non-empty `clean`, and `clean` is guarded non-empty two lines down. The guard is a readability rail, not a behavioural one.",
    },
    {
        id: "matchesPath-stops-stripping-a-leading-dot-slash",
        member: "matchesPath",
        // The second line keeps the anchor unique: `neverMatches` repeats the first.
        find: "const clean = String(target ?? \"\").replace(/^\\.\\//, \"\").replace(/^\\/+/, \"\");\n    if (clean === \"\" || clean === \"/\") return false;",
        replace: "const clean = String(target ?? \"\").replace(/^\\/+/, \"\");\n    if (clean === \"\" || clean === \"/\") return false;",
        outcome: "killed",
        why: "A target written `./docs/vision.md` stops matching; and `./` stops reducing to empty, which moves hole 8.",
    },
    // ---------------------------------------------------------------------------------- shellWrites
    {
        id: "shellWrites-drops-redirection-recognition",
        member: "shellWrites",
        find: "if (segment.redirects.some((word) => namesTarget(word, target))) return true;",
        replace: "",
        outcome: "killed",
        why: "`echo x > docs/vision.md` stops being a write. The plainest spelling the shell half exists for.",
    },
    {
        id: "shellWrites-drops-the-writer-table",
        member: "shellWrites",
        find: "if (writesWhatItNames(segment) && segment.args.some((word) => namesTarget(word, target, true))) return true;",
        replace: "",
        outcome: "killed",
        why: "`cp /tmp/x docs/vision.md` stops being a write.",
    },
    {
        id: "shellWrites-drops-ancestors",
        member: "shellWrites",
        find: "segment.args.some((word) => namesTarget(word, target, true))",
        replace: "segment.args.some((word) => namesTarget(word, target, false))",
        outcome: "killed",
        why: "`rm -rf docs` stops reaching a rule protecting `docs/vision.md` — destroying the container stops counting.",
    },
    // -------------------------------------------------------------------------------- shellSegments
    {
        id: "shellSegments-forgets-write-redirections",
        member: "shellSegments",
        find: "            if (word.text.includes(\">\")) pending = \"written\";",
        replace: "            if (false) pending = \"written\";",
        outcome: "killed",
        why: "Redirection targets stop being collected, so the first arm of `shellWrites` sees nothing.",
    },
    {
        id: "shellSegments-treats-read-redirection-as-a-separator",
        member: "shellSegments",
        find: "            else if (word.text.includes(\"<\")) pending = \"read\";",
        replace: "            else if (false) pending = \"read\";",
        outcome: "killed",
        why: "`tee < /tmp/in docs/vision.md` loses its head and its argument — the case that docblock says goes red if the branch is removed.",
    },
    {
        id: "shellSegments-stops-skipping-segment-leaders",
        member: "shellSegments",
        find: "if (ASSIGNMENT.test(word.text) || COMMAND_PREFIXES.has(bare) || SEGMENT_LEADERS.has(bare)) continue;",
        replace: "if (ASSIGNMENT.test(word.text) || COMMAND_PREFIXES.has(bare)) continue;",
        outcome: "killed",
        why: "`{ cp … ; }` and `if …; then cp …` hide the writer behind the leader — hole 2's write half reopens.",
    },
    {
        id: "shellSegments-stops-skipping-command-prefixes",
        member: "shellSegments",
        find: "if (ASSIGNMENT.test(word.text) || COMMAND_PREFIXES.has(bare) || SEGMENT_LEADERS.has(bare)) continue;\n            current.head = bare;",
        replace: "if (ASSIGNMENT.test(word.text) || SEGMENT_LEADERS.has(bare)) continue;\n            current.head = bare;",
        outcome: "killed",
        why: "`sudo cp /tmp/x docs/vision.md` takes `sudo` as its head, which is not a writer.",
    },
    {
        id: "shellSegments-stops-skipping-assignments",
        member: "shellSegments",
        find: "if (ASSIGNMENT.test(word.text) || COMMAND_PREFIXES.has(bare) || SEGMENT_LEADERS.has(bare)) continue;\n            current.head = bare;\n            continue;",
        replace: "if (COMMAND_PREFIXES.has(bare) || SEGMENT_LEADERS.has(bare)) continue;\n            current.head = bare;\n            continue;",
        outcome: "killed",
        why: "`FOO=bar cp /tmp/x docs/vision.md` takes `FOO=bar` as its head.",
    },
    // ------------------------------------------------------------------------------- commandSegments
    {
        id: "commandSegments-forgets-quoting",
        member: "commandSegments",
        find: "        if (quote) {",
        replace: "        if (false && quote) {",
        outcome: "killed",
        why: "A separator inside a quoted string starts splitting, so `echo \"git push --force\"` becomes a gated command — a false red on data.",
    },
    {
        id: "commandSegments-forgets-escapes-inside-quotes",
        member: "commandSegments",
        find: "            escaped = i;\n            continue;",
        replace: "            escaped = -1;\n            continue;",
        outcome: "killed",
        why: "The escape-aware split the pre-commit checkpoint added on #336 reverts: `echo \\>| git push --force origin main` stops splitting at a real pipe.",
    },
    {
        id: "commandSegments-splits-redirection-operators",
        member: "commandSegments",
        find: "if (c === \"&\" && (opBefore || command[i + 1] === \">\")) continue;",
        replace: "if (false) continue;",
        outcome: "killed",
        why: "`2>&1 git push --force …` breaks into pieces at the `&` before the redirection can be stripped — the #71 regression.",
    },
    {
        id: "commandSegments-drops-heredoc-stripping",
        member: "commandSegments",
        find: "const command = stripHeredocs(String(raw ?? \"\"));",
        replace: "const command = String(raw ?? \"\");",
        outcome: "killed",
        why: "A heredoc BODY is read as command text again, so its lines become segments — the false red that made this repository's own commit message ungatable.",
    },
    {
        id: "commandSegments-declares-a-dead-local",
        member: "commandSegments",
        find: "let quote = null;",
        replace: "let quote = null;\n    let unusedByDesign = 0;\n    void unusedByDesign;",
        outcome: "survives",
        why: "EQUIVALENT: an unread local, declared and immediately voided. A second control alongside `matchesRule-inserts-a-no-op`, at a different member, because a harness that only ever reports kills is indistinguishable from one that reports kills wrongly. _(This `why` described a `String(x).toString()` substitution until the pre-commit checkpoint read it — the text of an EARLIER draft of this operator, left behind when the anchor moved. A `survives` record whose proof describes a different mutant is a wrong record even where the verdict is right, and it is this session's own signature defect in its own record layer.)_",
    },
    // ----------------------------------------------------------------------------------- shellWords
    {
        id: "shellWords-forgets-ansi-c-quoting",
        member: "shellWords",
        find: "if (c === \"$\" && (command[i + 1] === \"'\" || command[i + 1] === '\"')) continue;",
        replace: "if (false && (command[i + 1] === \"'\" || command[i + 1] === '\"')) continue;",
        outcome: "killed",
        why: "`cp /tmp/x $'docs/vision.md'` glues the `$` onto the word and the path stops being recognised — the Copilot finding from #60.",
    },
    {
        id: "shellWords-stops-emitting-operator-words",
        member: "shellWords",
        find: "words.push({ text: run, op: true });",
        replace: "words.push({ text: run, op: false });",
        outcome: "killed",
        why: "Operators become ordinary words, so redirection targets are never collected and segments never close.",
    },
    // ------------------------------------------------------------------------------------ spellings
    {
        id: "spellings-stops-unwrapping",
        member: "spellings",
        find: "    if (wrapper) {",
        replace: "    if (false && wrapper) {",
        outcome: "killed",
        why: "`sh -c \"git push --force origin main\"` reaches nothing — the one level of unwrapping that is the hook's whole reach past a literal prefix.",
    },
    {
        id: "spellings-stops-stripping-the-wrapper-quotes",
        member: "spellings",
        find: "        if ((quote === '\"' || quote === \"'\") && inner.endsWith(quote) && inner.length > 1) {",
        replace: "        if (false && inner.endsWith(quote) && inner.length > 1) {",
        outcome: "killed",
        why: "The unwrapped command keeps its quotes, so the prefix compare fails on the leading quote character.",
    },
    // --------------------------------------------------------------------------------- stripHeredocs
    {
        id: "stripHeredocs-swallows-an-unterminated-opener",
        member: "stripHeredocs",
        find: "    if (delimiter !== null) out.push(...held);",
        replace: "",
        outcome: "killed",
        why: "The fail-open Copilot found on #60 returns: `echo \"not a heredoc <<EOF\"` swallows every later line, hiding a gated command on any of them.",
    },
    {
        id: "stripHeredocs-forgets-the-quoted-delimiter-form",
        member: "stripHeredocs",
        find: "const opened = /<<-?\\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\\1/.exec(line);",
        replace: "const opened = /<<-?\\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(line);",
        outcome: "killed",
        why: "`<<'EOF'` stops being recognised as an opener — and with capture group 2 now undefined the delimiter never matches, so the body is read as commands.",
    },
    // --------------------------------------------------------------- stripLeadingRedirections + regexes
    {
        id: "stripLeadingRedirections-strips-only-once",
        member: "stripLeadingRedirections",
        find: "    for (;;) {\n        const shorter = text.replace(LEADING_REDIRECTION, \"\");",
        replace: "    for (let once = 0; once < 1; once += 1) {\n        const shorter = text.replace(LEADING_REDIRECTION, \"\");",
        outcome: "killed",
        why: "Two stacked redirections — `> a 2> b git push --force …` — leave the second in front of the command.",
    },
    {
        id: "REDIRECTION_TARGET-narrows-to-non-whitespace",
        member: "REDIRECTION_TARGET",
        find: "const REDIRECTION_TARGET = String.raw`(?:\"(?:\\\\[\\s\\S]|[^\"\\\\])*\"|'[^']*'|\\\\[\\s\\S]|[^\\s])+`;",
        replace: "const REDIRECTION_TARGET = String.raw`[^\\s]+`;",
        outcome: "killed",
        why: "The exact round-1 defect on #336: `> \"foo bar\" git push --force …` strips `> \"foo` and leaves the command behind it ungated.",
    },
    {
        id: "LEADING_REDIRECTION-forgets-the-clobber-form",
        member: "LEADING_REDIRECTION",
        find: "^\\d*(?:&>>|&>|>>|>&|>\\||<&|<>|<|>)\\s*",
        replace: "^\\d*(?:&>>|&>|>>|>&|<&|<>|<|>)\\s*",
        outcome: "killed",
        why: "`>| f git push --force …` stops stripping — one of the two spellings #71's own table never named.",
    },
    // ---------------------------------------------------------------------------------- namesTarget
    {
        id: "namesTarget-forgets-the-equals-form",
        member: "namesTarget",
        find: "const candidates = eq > 0 ? [word, word.slice(eq + 1)] : [word];",
        replace: "const candidates = [word];",
        outcome: "killed",
        why: "`dd of=docs/vision.md` stops naming the target.",
    },
    {
        id: "namesTarget-stops-rooting-a-relative-word",
        member: "namesTarget",
        find: "const rooted = clean.startsWith(\"/\") ? clean : `/${clean}`;",
        replace: "const rooted = clean;",
        outcome: "killed",
        why: "A relative word loses the leading separator the tail comparison needs, so `cp /tmp/x docs/vision.md` stops matching.",
    },
    // --------------------------------------------------------------------------------- normalisePath
    {
        id: "normalisePath-keeps-dot-segments",
        member: "normalisePath",
        find: "        if (part === \"\" || part === \".\") continue;",
        replace: "        if (part === \"\") continue;",
        outcome: "killed",
        why: "`docs/./vision.md` stops being the constitution — a live escape for one review round.",
    },
    {
        id: "normalisePath-keeps-empty-segments",
        member: "normalisePath",
        find: "if (part === \"\" || part === \".\") continue;\n        if (part === \"..\"",
        replace: "if (part === \".\") continue;\n        if (part === \"..\"",
        outcome: "killed",
        why: "`docs//vision.md` stops being the constitution — the other half of the same escape.",
    },
    {
        id: "normalisePath-stops-resolving-dotdot",
        member: "normalisePath",
        find: "        if (part === \"..\" && out.length && out[out.length - 1] !== \"..\") out.pop();\n        else out.push(part);",
        replace: "        out.push(part);",
        outcome: "killed",
        why: "`foo/../docs/vision.md` stops being the constitution.",
    },
    // ------------------------------------------------------------------------------------ ancestors
    {
        id: "ancestors-includes-the-file-itself",
        member: "ancestors",
        find: "return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join(\"/\"));",
        replace: "return parts.map((_, i) => parts.slice(0, i + 1).join(\"/\"));",
        outcome: "survives",
        why: "EQUIVALENT AT THE CALL SITE: the extra entry is the target's own full path, and `namesTarget` already tests that path in the branch above the ancestor one — so the added candidate can only ever repeat a `true` the first branch has already returned. Recorded rather than deleted because the equivalence is a property of the CALLER, not of `ancestors`, and a reader of this function alone would expect a kill.",
    },
    // ----------------------------------------------------------------------------- writesWhatItNames
    {
        id: "writesWhatItNames-drops-the-writer-table",
        member: "writesWhatItNames",
        find: "    if (FILE_WRITERS.has(head)) return true;",
        replace: "",
        outcome: "killed",
        why: "Nothing in the writer table writes any more.",
    },
    {
        id: "writesWhatItNames-drops-the-in-place-flag-check",
        member: "writesWhatItNames",
        find: "return IN_PLACE_EDITORS.has(head) && args.some((a) => /^--in-place(=|$)/.test(a) || /^-[a-zA-Z]*i/.test(a));",
        replace: "return IN_PLACE_EDITORS.has(head);",
        outcome: "killed",
        why: "`sed -n '1,5p' docs/vision.md` — a READ this policy declares Auto — starts being gated as a write.",
    },
    // --------------------------------------------------------------------------------- the tables
    {
        id: "FILE_WRITERS-loses-cp",
        member: "FILE_WRITERS",
        find: "new Set([\"cp\", \"mv\", \"ln\", \"rm\", \"tee\", \"dd\", \"install\", \"truncate\", \"shred\", \"patch\"])",
        replace: "new Set([\"mv\", \"ln\", \"rm\", \"tee\", \"dd\", \"install\", \"truncate\", \"shred\", \"patch\"])",
        outcome: "killed",
        why: "One entry removed from a recognition table. If the corpus does not notice, the table is prose.",
    },
    {
        id: "IN_PLACE_EDITORS-loses-sed",
        member: "IN_PLACE_EDITORS",
        find: "export const IN_PLACE_EDITORS = new Set([\"sed\", \"gsed\", \"perl\", \"ruby\"]);",
        replace: "export const IN_PLACE_EDITORS = new Set([\"gsed\", \"perl\", \"ruby\"]);",
        outcome: "killed",
        why: "`sed -i … docs/vision.md` stops being a write.",
    },
    {
        id: "COMMAND_PREFIXES-loses-sudo",
        member: "COMMAND_PREFIXES",
        find: "new Set([\"sudo\", \"env\", \"command\", \"builtin\", \"exec\", \"nohup\", \"nice\", \"time\"])",
        replace: "new Set([\"env\", \"command\", \"builtin\", \"exec\", \"nohup\", \"nice\", \"time\"])",
        outcome: "killed",
        why: "`sudo cp /tmp/x docs/vision.md` takes `sudo` as its head.",
    },
    {
        id: "SEGMENT_LEADERS-loses-then",
        member: "SEGMENT_LEADERS",
        find: "new Set([\"{\", \"}\", \"!\", \"then\", \"else\", \"elif\", \"do\", \"done\", \"fi\", \"esac\"])",
        replace: "new Set([\"{\", \"}\", \"!\", \"else\", \"elif\", \"do\", \"done\", \"fi\", \"esac\"])",
        outcome: "killed",
        why: "`if true; then cp /tmp/x docs/vision.md; fi` takes `then` as its head — and this is the asymmetry the corpus records between the two segmenters, so it must be the WRITE path that notices.",
    },
    {
        id: "OPERATOR-loses-the-newline",
        member: "OPERATOR",
        find: "const OPERATOR = /[|&;<>()\\n\\r]/;",
        replace: "const OPERATOR = /[|&;<>()\\r]/;",
        outcome: "killed",
        why: "The plainest spelling there is, and the one the first hole list missed: a two-line script folds into one segment whose head is the first command.",
    },
    {
        id: "WRITE_TOOLS-loses-Write",
        member: "WRITE_TOOLS",
        find: 'export const WRITE_TOOLS = ["Edit", "Write", "NotebookEdit"];',
        replace: 'export const WRITE_TOOLS = ["Edit", "NotebookEdit"];',
        outcome: "killed",
        why: "The `Write` tool stops reaching any `write:` rule, so the constitution is editable through the plainest tool there is.",
    },
    {
        id: "WRITE_TOOLS-loses-NotebookEdit",
        member: "WRITE_TOOLS",
        find: 'export const WRITE_TOOLS = ["Edit", "Write", "NotebookEdit"];\nexport const READ_TOOLS = ["Read"];',
        replace: 'export const WRITE_TOOLS = ["Edit", "Write"];\nexport const READ_TOOLS = ["Read"];',
        outcome: "killed",
        why: "The third write tool, which the corpus did not exercise AT ALL until this operator was added — twenty-one write-rule fixtures across five files and not one `NotebookEdit` among them. Found by widening REGION at the pre-commit checkpoint, which is the coverage floor earning its place.",
    },
    {
        id: "matchesRule-write-drops-the-notebook-path-fallback",
        member: "matchesRule",
        find: "return matchesPath(input.file_path ?? input.notebook_path, action.write);",
        replace: "return matchesPath(input.file_path, action.write);",
        outcome: "killed",
        why: "`NotebookEdit` carries `notebook_path` rather than `file_path`, so without the fallback the tool is in the table and its payload reaches nothing — a gate that looks whole from the outside. Untested until the same widening.",
    },
    {
        id: "READ_TOOLS-loses-Read",
        member: "READ_TOOLS",
        find: 'export const READ_TOOLS = ["Read"];',
        replace: "export const READ_TOOLS = [];",
        outcome: "survives",
        why: "EQUIVALENT UNDER THE YIELDED POLICY, by the same argument as `matchesRule-read-accepts-any-tool`: the one `read:` rule declared is `read-anything-in-the-repository`, whose `./` target reduces to the empty string and is refused — hole 8 — so the branch answers false whether it is reached or not. No fixture can distinguish this and none should be invented to; it becomes killable the day a `read:` rule with a real target is declared.",
    },
    {
        id: "ASSIGNMENT-requires-two-characters",
        member: "ASSIGNMENT",
        find: "const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;",
        replace: "const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]+=/;",
        outcome: "killed",
        why: "A single-letter assignment — `A=1 cp /tmp/x docs/vision.md` — stops being recognised as one.",
    },
];

export function mutate(source, op) {
    let count = 0;
    let at = 0;
    for (;;) {
        const i = source.indexOf(op.find, at);
        if (i === -1) break;
        count += 1;
        at = i + 1;
    }
    if (count === 0) {
        throw new CouldNotRun(
            `operator \`${op.id}\` does not place: its anchor is absent from ${SUBJECT}. The subject moved and this ` +
                `operator did not — re-anchor it or retire it, but do not let it be skipped`,
        );
    }
    if (count > 1) {
        throw new CouldNotRun(
            `operator \`${op.id}\` places ${count} times in ${SUBJECT} and an operator must be exactly one edit. ` +
                `Lengthen its anchor until it is unique`,
        );
    }
    return source.replace(op.find, () => op.replace);
}

/** Only `from "./….mjs"` imports are rewritten, and a mutant's `import.meta.url` names its temp directory. */
export function absolutiseImports(source, cliDir) {
    return source.replace(/from "\.\/([A-Za-z0-9._-]+\.mjs)"/g, (_, name) => `from "${pathToFileURL(path.join(cliDir, name)).href}"`);
}

export function runCorpus(matchesRule, byId, corpus) {
    for (const { where, doc } of corpus) {
        const rule = byId.get(doc.rule);
        // `run` refuses such a corpus first; this arm answers a direct caller.
        if (!rule) {
            throw new CouldNotRun(
                `${where} attacks \`${doc.rule}\`, which the yielded policy does not declare — its cases cannot be ` +
                    `graded, and a census that skipped them would report on a kill-set smaller than the one it names`,
            );
        }
        for (const c of doc.cases) {
            let actual;
            try {
                actual = matchesRule(rule, c.tool, c.input);
            } catch (error) {
                // `matchesRule` never throws, so a mutant that throws is killed.
                return { agreed: false, at: `${where} → ${c.id}`, how: `threw ${error?.name ?? "an error"}` };
            }
            if (actual !== c.expect) {
                return { agreed: false, at: `${where} → ${c.id}`, how: `answered ${actual}, corpus records ${c.expect}` };
            }
        }
    }
    return { agreed: true };
}

/** A fresh directory per mutant: ESM caches a module by its URL and never forgets one. */
async function importMutant(source, cliDir, op) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-mutant-"));
    const file = path.join(dir, "compile.mjs");
    try {
        fs.writeFileSync(file, absolutiseImports(source, cliDir), "utf8");
        try {
            return { module: await import(pathToFileURL(file).href), dir };
        } catch (cause) {
            throw new CouldNotRun(
                `operator \`${op.id}\` produced a module that will not import — ${cause?.message ?? cause}. ` +
                    `A mutant that cannot load tests nothing; fix the substitution`,
            );
        }
    } catch (error) {
        fs.rmSync(dir, { recursive: true, force: true });
        throw error;
    }
}

export function census(operators = OPERATORS) {
    const counts = new Map(REGION.map((m) => [m, 0]));
    const stray = [];
    for (const op of operators) {
        if (!counts.has(op.member)) stray.push(op);
        else counts.set(op.member, counts.get(op.member) + 1);
    }
    return { counts, stray, uncovered: REGION.filter((m) => counts.get(m) === 0) };
}

function usage() {
    return [
        "usage: node cli/mutants.mjs [--check] [--workspace <dir>] [--pack-root <dir>] [--only <operator-id>]",
        "",
        "  Mutates cli/compile.mjs's matcher region, one declared operator at a time, and grades each",
        "  mutant against evals/goldens/gates/ — the corpus that claims to cover those matchers.",
        "",
        "  --check is the default and the only mode; the flag is accepted so the recipe reads",
        "  like its siblings. --only narrows to one operator, for a session hunting a single survivor.",
        "",
        "  Exit 0 green · 1 red · 2 could not run.",
    ].join("\n");
}

export async function run(argv = [], { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
    const say = (line = "") => stdout.write(`${line}\n`);
    if (argv.includes("--help") || argv.includes("-h")) {
        say(usage());
        return 0;
    }
    let named = cwd;
    let packRoots = null;
    let only = null;
    const dirs = [];
    try {
        for (let i = 0; i < argv.length; i += 1) {
            if (argv[i] === "--check") continue;
            if (argv[i] === "--workspace") {
                named = argv[i + 1];
                i += 1;
                if (named === undefined) throw new CouldNotRun("--workspace needs a directory");
            } else if (argv[i] === "--only") {
                only = argv[i + 1];
                i += 1;
                if (only === undefined || only.startsWith("-")) throw new CouldNotRun("--only needs an operator id");
            } else if (argv[i] === "--pack-root") {
                const root = argv[i + 1];
                i += 1;
                if (root === undefined || root.startsWith("-")) throw new CouldNotRun("--pack-root needs a directory");
                let stat = null;
                try {
                    stat = fs.statSync(root);
                } catch (cause) {
                    throw new CouldNotRun(`--pack-root ${root} cannot be read — ${cause.code ?? cause.message}`);
                }
                if (!stat.isDirectory()) throw new CouldNotRun(`--pack-root ${root} is not a directory`);
                (packRoots ??= []).push(path.resolve(root));
            } else throw new CouldNotRun(`unknown argument ${JSON.stringify(argv[i])}`);
        }

        const { counts, stray, uncovered } = census();
        if (stray.length) {
            throw new CouldNotRun(
                `operator(s) ${stray.map((o) => `\`${o.id}\``).join(", ")} name a region member that REGION does not list. ` +
                    `Add the member to REGION or correct the operator — an operator outside the census is coverage nobody counts`,
            );
        }
        // Every operator, even under `--only`: it narrows what runs, not what must be well formed.
        for (const op of OPERATORS) {
            if (!OUTCOMES.includes(op.outcome)) {
                throw new CouldNotRun(`operator \`${op.id}\` records outcome ${JSON.stringify(op.outcome)} — one of ${OUTCOMES.join(" / ")}`);
            }
            if (typeof op.why !== "string" || op.why.trim() === "") {
                throw new CouldNotRun(`operator \`${op.id}\` carries no \`why\` — a mutation nobody can read is not reviewable`);
            }
        }

        const { workspaceRoot, rules, unresolved } = yieldedRules(named, { packRoots });
        const corpus = readCorpus(workspaceRoot);
        for (const u of unresolved) say(`pack    ${u.name} UNRESOLVED — ${u.why}; its gate fragments are not in this census`);

        const cliDir = path.join(workspaceRoot, "cli");
        const subject = path.join(workspaceRoot, SUBJECT);
        let source;
        try {
            source = fs.readFileSync(subject, "utf8");
        } catch (cause) {
            throw new CouldNotRun(`${SUBJECT} cannot be read at ${subject} — ${cause.code ?? cause.message}`);
        }

        const { matchable, exempt } = partition(rules);
        const byId = new Map(matchable.map((r) => [r.id, r]));

        const ungradable = corpus
            .filter(({ doc }) => !byId.has(doc.rule))
            .map(({ where, doc }) => {
                const why = exempt.some((e) => e.id === doc.rule)
                    ? "declares no matchable action, so there is nothing for a mutant to change"
                    : "is not declared by the yielded policy at all";
                return `${where} attacks \`${doc.rule}\`, which ${why}`;
            });
        if (ungradable.length) {
            throw new CouldNotRun(
                `${ungradable.length} fixture file(s) cannot be graded, so the kill-set is smaller than it looks:\n           ` +
                    `${ungradable.join("\n           ")}\n           ` +
                    `Fix the corpus (the \`goldens\` recipe grades that) before reading a census over it`,
            );
        }

        const { matchesRule } = await import(pathToFileURL(subject).href);
        const baseline = runCorpus(matchesRule, byId, corpus);
        if (!baseline.agreed) {
            throw new CouldNotRun(
                `the corpus does not agree with the UNMUTATED matcher at ${baseline.at} (${baseline.how}). ` +
                    `A mutation census over a red corpus measures nothing — run the \`goldens\` recipe and fix that first`,
            );
        }

        const selected = only === null ? OPERATORS : OPERATORS.filter((op) => op.id === only);
        if (only !== null && selected.length === 0) {
            throw new CouldNotRun(`no operator with id \`${only}\` — see the OPERATORS table in cli/mutants.mjs`);
        }

        const findings = [];
        let killed = 0;
        let survived = 0;
        for (const op of selected) {
            const mutated = mutate(source, op);
            if (mutated === source) {
                throw new CouldNotRun(
                    `operator \`${op.id}\` placed but changed nothing — its \`find\` and \`replace\` are the same text. ` +
                        `A no-op operator is an operator that reports coverage it does not provide`,
                );
            }
            const { module, dir } = await importMutant(mutated, cliDir, op);
            dirs.push(dir);
            const result = runCorpus(module.matchesRule, byId, corpus);
            const actual = result.agreed ? "survives" : "killed";
            if (actual === "killed") killed += 1;
            else survived += 1;
            if (actual === op.outcome) continue;
            findings.push({
                where: op.id,
                what:
                    op.outcome === "killed"
                        ? `is recorded KILLED and SURVIVED. The corpus no longer notices this mutation, so its coverage of ` +
                          `\`${op.member}\` has weakened. ${op.why} Add the case that kills it to evals/goldens/gates/ — ` +
                          `\`matchesRule\` is a pure function of (rule, tool, input) and a fixture is exactly that triple, ` +
                          `so a non-equivalent mutant is always killable by one`
                        : `is recorded SURVIVES and was KILLED at ${result.at} (${result.how}). That is good news and the ` +
                          `record must absorb it: the equivalence claimed for this operator no longer holds — either the ` +
                          `matcher changed or the claim was wrong. Re-read the \`why\` and change the outcome to \`killed\`. ` +
                          `A record that still describes a gap somebody closed is as wrong as one that hides a gap somebody opened`,
            });
        }

        say(`mutants: ${selected.length} operator(s) over ${corpus.length} fixture file(s) — ${killed} killed, ${survived} survived`);
        say(`mutants: by matcher-region member —`);
        for (const member of REGION) say(`           ${String(counts.get(member)).padStart(2)}  ${member}`);
        if (uncovered.length) {
            findings.push({
                where: "the operator table",
                what:
                    `leaves ${uncovered.length} matcher-region member(s) with no operator at all — ` +
                    `${uncovered.map((m) => `\`${m}\``).join(", ")}. Every member either carries an operator or REGION ` +
                    `should not list it; an unmutated member is a part of the matcher this census makes no claim about`,
            });
        }

        if (findings.length) {
            for (const f of findings) stderr.write(`mutants: ${f.where}\n           ${f.what}\n`);
            stderr.write(`RED — ${findings.length} finding(s) in the mutation census\n`);
            return 1;
        }
        say("GREEN — every mutant met its recorded outcome, and every matcher-region member carries one");
        say("mutants: this measures whether the corpus NOTICES a broken matcher — not whether its attacks are realistic");
        return 0;
    } catch (error) {
        if (error instanceof CouldNotRun || error instanceof CompileError) {
            stderr.write(`mutants: ${error.message}\n`);
            return 2;
        }
        stderr.write(`mutants: could not finish the census — ${error?.stack ?? error}\n`);
        return 2;
    } finally {
        for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
    }
}

// URLs on both sides, since `import.meta.url` percent-encodes; the realpath covers a symlinked `bin`.
function isMain() {
    const invoked = process.argv[1];
    if (!invoked) return false;
    if (import.meta.url === pathToFileURL(invoked).href) return true;
    try {
        return import.meta.url === pathToFileURL(fs.realpathSync(invoked)).href;
    } catch {
        return false;
    }
}

if (isMain()) process.exitCode = await run(process.argv.slice(2));
