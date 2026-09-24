// Tests for `comments`: each language's comments found exactly, and the four kinds of history told from the rest.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
    historyCount,
    historyOf,
    jsComments,
    jsonComments,
    languageOf,
    markdownComments,
    report,
    run,
    scan,
    shellComments,
    yamlComments,
} from "./comments.mjs";

// The check imports `./context.mjs`, whose closure can read the host's plugin record: point it at none.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function repository(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-comments-"));
    SCRATCH.push(dir);
    execFileSync("git", ["init", "-q", dir]);
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), body);
    }
    return dir;
}

const texts = (comments) => comments.map((c) => [c.line, c.text]);

function capture(argv) {
    let out = "";
    let err = "";
    const code = run(argv, { write: (s) => (out += s) }, { write: (s) => (err += s) });
    return { code, out, err };
}

describe("languageOf", () => {
    test("reads the extension, and the shebang of a file with none", () => {
        assert.equal(languageOf("cli/a.mjs"), "js");
        assert.equal(languageOf("src/a.tsx"), "js");
        assert.equal(languageOf("a.jsonc"), "js");
        assert.equal(languageOf("verify/a.sh"), "shell");
        assert.equal(languageOf(".github/workflows/a.yml"), "yaml");
        assert.equal(languageOf("a.json"), "json");
        assert.equal(languageOf("README.md"), "markdown");
        assert.equal(languageOf("a.py"), null);
        assert.equal(languageOf("tools/gh-bot", "#!/usr/bin/env bash"), "shell");
        assert.equal(languageOf("tools/run", "#!/usr/bin/env node"), "js");
        assert.equal(languageOf("LICENSE", "Apache License"), null);
    });
});

describe("jsComments", () => {
    test("line, block and trailing comments, each line with its text", () => {
        const source = ["#!/usr/bin/env node", "// one", "const a = 1; // two", "/**", " * three", " */", "f(); /* four */ g();"].join("\n");
        assert.deepEqual(texts(jsComments(source)), [
            [2, "one"],
            [3, "two"],
            [4, ""],
            [5, "three"],
            [6, ""],
            [7, "four"],
        ]);
    });

    test("a comment alone on its line frees the whole line, a trailing one only itself", () => {
        const [alone, trailing] = jsComments("  // alone\nx(); // end\n");
        assert.equal(alone.bytes, Buffer.byteLength("  // alone\n"));
        assert.equal(trailing.bytes, Buffer.byteLength("// end"));
    });

    test("strings, templates and regular expressions holding comment markers are not comments", () => {
        const source = [
            'const url = "https://example.com"; const s = \'/* no */\';',
            "const t = `// no ${ a /* yes */ } still // no ${ `// nested no` }`;",
            "const r = /\\/\\/ no/g, q = x.replace(/[/*]/, '');",
            "const d = a / b; // yes",
            "if (ok) return /re/.test(s); // yes",
        ].join("\n");
        assert.deepEqual(texts(jsComments(source)), [
            [2, "yes"],
            [4, "yes"],
            [5, "yes"],
        ]);
    });
});

describe("shellComments", () => {
    test("full-line and trailing comments; a hash inside quotes, $# or ${#x} is not one", () => {
        const source = ["#!/usr/bin/env bash", "# one", 'echo "a # b" \'c # d\' $# ${#x} # two', "x=a#b"].join("\n");
        assert.deepEqual(texts(shellComments(source)), [
            [2, "one"],
            [3, "two"],
        ]);
    });

    test("heredoc bodies are data; a here-string and a shift open none", () => {
        const source = [
            "cat <<'EOF'",
            "# data",
            "EOF",
            "cat <<-END",
            "\t# data",
            "\tEND",
            'read -r a <<<"$v" # one',
            "n=$((1 << 2)) # two",
            "# three",
            "m=$(( a << b )); (( c <<= d )) # four",
            "# five",
        ].join("\n");
        assert.deepEqual(texts(shellComments(source)), [
            [7, "one"],
            [8, "two"],
            [9, "three"],
            [10, "four"],
            [11, "five"],
        ]);
    });

    test("an ANSI-C string runs to its closing quote, across lines too", () => {
        const source = ["a=$'it\\'s # no' # one", "b=$'x", "# no'", "# two"].join("\n");
        assert.deepEqual(texts(shellComments(source)), [
            [1, "one"],
            [4, "two"],
        ]);
    });

    test("a program quoted across lines keeps its own comments", () => {
        const source = ["awk '", "  # awk", "  { print }", "' f", "node -e '", "// node", "x()'"].join("\n");
        assert.deepEqual(texts(shellComments(source)), [
            [2, "awk"],
            [6, "node"],
        ]);
    });
});

describe("yamlComments", () => {
    test("comments outside scalars, and a run block read as shell at the file's lines", () => {
        const source = [
            "# one",
            "name: 'a # b' # two",
            "steps:",
            "  - run: |",
            "      # three",
            "      echo \"# no\"",
            "    name: after",
            "  - body: |",
            "      # a heading, not a comment",
            "# four",
        ].join("\n");
        assert.deepEqual(texts(yamlComments(source)), [
            [1, "one"],
            [2, "two"],
            [5, "three"],
            [10, "four"],
        ]);
    });
});

describe("jsonComments", () => {
    test("the strings under a comment key, each at its line; other keys are data", () => {
        const source = [
            "{",
            '  "$comment": "one",',
            '  "_comment": [',
            '    "two",',
            '    "three"',
            "  ],",
            '  "comment": "data",',
            '  "a": { "_note": "four", "_accepted_note": "five", "_notes_seen": "data", "_footnote": "data" }',
            "}",
        ].join("\n");
        assert.deepEqual(texts(jsonComments(source)), [
            [2, "one"],
            [4, "two"],
            [5, "three"],
            [8, "four"],
            [8, "five"],
        ]);
    });
});

describe("markdownComments", () => {
    test("HTML comments, across lines too, and none inside a fence or a code span", () => {
        const source = ["<!-- one -->", "text `<!-- no -->` <!-- two", "three -->", "```", "<!-- no -->", "```"].join("\n");
        assert.deepEqual(texts(markdownComments(source)), [
            [1, "one"],
            [2, "two"],
            [3, "three"],
        ]);
    });

    test("a fence closes on a line ending in a carriage return", () => {
        assert.deepEqual(texts(markdownComments(["```js\r", "<!-- no -->\r", "```\r", "<!-- one -->\r"].join("\n"))), [[4, "one"]]);
    });
});

describe("a line a tool reads", () => {
    test("is no comment to this check, whatever it holds", () => {
        const source = [
            "<!-- portulan: on-read identity 1a2b3c4d -->",
            "<!-- engine: operating/context.md#every-request-pays-for-what-the-session-has-read -->",
            "<!-- leads: ../handoffs/2026-09-24-follow-ups.md -->",
            "<!-- gates: ../gates.json -->",
            "<!-- Kept by hand since 2026-09-24. -->",
            "<!-- portulan: any form a later tool reads, in as many words as it takes -->",
            "<!-- updated: 2026-09-24, PR #12 -->",
        ].join("\n");
        assert.deepEqual(texts(markdownComments(source)), [
            [5, "Kept by hand since 2026-09-24."],
            [7, "updated: 2026-09-24, PR #12"],
        ]);
    });
});

describe("historyOf", () => {
    const flagged = (...lines) => historyOf(jsComments(lines.map((l) => `// ${l}`).join("\n"))).map((c) => [c.line, c.kinds]);

    test("each kind of history", () => {
        assert.deepEqual(flagged("Added 2026-09-24."), [[1, ["date"]]]);
        assert.deepEqual(flagged("Proposal 0038, rule 2."), [[1, ["plan"]]]);
        assert.deepEqual(flagged("proposal `0036`'s sealed incident"), [[1, ["plan"]]]);
        assert.deepEqual(flagged("with milestone 8 clause (d)."), [[1, ["plan"]]]);
        assert.deepEqual(flagged("Copilot, round 1."), [[1, ["review"]]]);
        assert.deepEqual(flagged("Found by review on this pull request."), [[1, ["review"]]]);
        assert.deepEqual(flagged("with milestone-8's close"), [[1, ["plan"]]]);
        assert.deepEqual(flagged("see #343"), [[1, ["reference"]]]);
        assert.deepEqual(flagged("issue 68 and PR 12"), [[1, ["reference"]]]);
        assert.deepEqual(flagged("https://github.com/o/r/pull/222"), [[1, ["reference"]]]);
        assert.deepEqual(flagged("Raised by Copilot, round 1 on #343."), [[1, ["review", "reference"]]]);
        assert.deepEqual(flagged("at 2026-08-27T17:19:20Z"), [[1, ["date"]]]);
        assert.deepEqual(flagged("`#265`'s ruling"), [[1, ["reference"]]]);
    });

    test("a review round or a credit to the reviewer, with no pull request named", () => {
        for (const line of [
            "the guard round 6 had removed on purpose",
            "Round 2's repair made it strict.",
            "as session 1's round 9 showed",
            'round 3 found `"[^"]*"` too narrow',
            "(Copilot, final round.)",
            "Copilot, on the round reviewing it.",
            "Copilot's suppressed notes named three files",
        ]) {
            assert.deepEqual(flagged(line), [[1, ["review"]]], line);
        }
    });

    test("a sentence opening with a round marks its own line, not the one before", () => {
        assert.deepEqual(flagged("The guard holds.", "Round 3 made it strict."), [[2, ["review"]]]);
    });

    test("a citation wrapped across two lines marks both", () => {
        assert.deepEqual(flagged("as the", "Proposal", "0038 says"), [
            [2, ["plan"]],
            [3, ["plan"]],
        ]);
    });

    test("a host fact at its version, a constraint, and a value in backticks carry no history", () => {
        assert.deepEqual(
            flagged(
                "Claude Code 2.1.281 drops block-level HTML comments before loading.",
                "`process.exitCode`, so a pipe that has not drained is not cut short.",
                "Date.parse rolls `2026-02-31` into March.",
                "round 2 decimal places; colour #fff, step #2; the $# count; Issue 1: none",
                "whether it ships is the maintainer's call; the reviewer's second round of an interview",
                "GitHub's REST API version 2022-11-28 names the header `X-GitHub-Api-Version`.",
                "`repos/{owner}/{repo}/issues/8/comments` is the endpoint.",
                "Copilot's reviewer login is `copilot-pull-request-reviewer[bot]`.",
                "Round 2 decimal places.",
                "Requests a review from Copilot.",
                "(Copilot)",
                "a proposal is drafted before its number is taken",
            ),
            [],
        );
    });
});

test("a comment line of 200,000 characters is read like any other", () => {
    const source = `const a = 1; //# sourceMappingURL=data:${"A".repeat(200_000)} see #12\n`;
    assert.deepEqual(historyOf(jsComments(source)).map((c) => c.kinds), [["reference"]]);
});

describe("report", () => {
    const read = [{ file: "a.mjs", comments: jsComments("// Added 2026-09-24\n// fine\n"), history: [] }];
    read[0].history = historyOf(read[0].comments);

    test("with no limit it reports and is green", () => {
        const { code, text } = report(read);
        assert.equal(code, 0);
        assert.match(text, /^comments: 1 of 2 comment lines in the 1 files read record a change's history/);
    });

    test("over the limit it is red and lists each line; under it, it names the lower limit", () => {
        const over = report(read, { limit: 0 });
        assert.equal(over.code, 1);
        assert.match(over.text, /a\.mjs: 1 date/);
        assert.match(over.text, /RED: 1 is over the limit of 0: .*; the rule: core\/operating\/context\.md, on every boot card\.$/m);
        const under = report(read, { limit: 3 });
        assert.equal(under.code, 0);
        assert.match(under.text, /green: 1 is within the limit of 3; lower the limit to 1/);
        assert.doesNotMatch(under.text, /a\.mjs:/);
    });

    test("the byte rail holds every comment's bytes, and names a lower rail past 5% of headroom", () => {
        const bytes = read[0].comments.reduce((total, c) => total + c.bytes, 0);
        const over = report(read, { bytes: bytes - 1 });
        assert.equal(over.code, 1);
        assert.match(over.text, /RED: .* comment bytes are over the rail of .*; the rule: core\/operating\/context\.md, on every boot card\.$/m);
        assert.match(report(read, { bytes }).text, new RegExp(`green: ${bytes} comment bytes are within the rail of ${bytes}$`));
        assert.match(report(read, { bytes: bytes * 2 }).text, new RegExp(`lower the rail to ${Math.ceil(bytes * 1.02)}$`));
    });
});

describe("run, over a repository", () => {
    test("reads tracked and new files, skips excluded ones, and holds the limit", () => {
        const dir = repository({ "a.mjs": "// Proposal 0038.\n", "vendor/b.mjs": "// see #12\n", "c.py": "# see #13\n" });
        assert.equal(capture(["--root", dir, "--limit", "1", "--exclude", "vendor/"]).code, 0);
        const red = capture(["--root", dir, "--limit", "1"]);
        assert.equal(red.code, 1);
        assert.match(red.out, /vendor\/b\.mjs: 1 reference/);
    });

    test("could not run: no repository, a bad flag, an exclusion naming nothing", () => {
        const bare = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-comments-"));
        SCRATCH.push(bare);
        assert.equal(capture(["--root", bare]).code, 2);
        assert.equal(capture(["--limit", "many"]).code, 2);
        const dir = repository({ "a.mjs": "x();\n" });
        const stale = capture(["--root", dir, "--exclude", "gone/"]);
        assert.equal(stale.code, 2);
        assert.match(stale.err, /--exclude gone\/ names no file/);
    });

    test("--list gives every line recording history and the table by directory", () => {
        const dir = repository({ "cli/a.mjs": "// 2026-09-24\nx(); // fine\n" });
        const { code, out } = capture(["--root", dir, "--list"]);
        assert.equal(code, 0);
        assert.match(out, /cli\/a\.mjs: 1 date/);
        assert.match(out, /cli\/ {2}1 of 2 lines/);
    });
});

test("scan reads the files git lists, and nothing through a link", () => {
    const dir = repository({ "a.sh": "# 2026-09-24\n" });
    fs.symlinkSync(path.join(dir, "a.sh"), path.join(dir, "link.sh"));
    assert.deepEqual(scan(dir).map((entry) => entry.file), ["a.sh"]);
});

test("historyCount is the count a run holds at its limit", () => {
    const dir = repository({ "a.mjs": "// Proposal 0038.\n// fine\n", "b.sh": "# see #12\n" });
    assert.equal(historyCount(dir), 2);
    assert.equal(capture(["--root", dir, "--limit", "2"]).code, 0);
    assert.equal(capture(["--root", dir, "--limit", "1"]).code, 1);
});
