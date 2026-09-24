// `cli/README.md` is exactly what ./roster.mjs renders from this directory, and the render keeps its shape.
//
//   node --test "cli/**/*.test.mjs"
//
// The page is generated from each file's header and from the rosters in code, as ./roster.mjs says, so
// the byte comparison below is the rail: a file added, removed or re-described without a new render is
// red here, and `node cli/roster.mjs --write` is the repair. A page nobody writes by hand cannot drift
// from the files it lists, which is what the hand-kept roster and its counts kept doing (#204).
//
// **Why here and not in `docs.sh`.** `docs.sh` needs only `git`, `bash` and the POSIX text utilities,
// and the render imports real modules. `docs.sh`'s `cli table` check still holds the page's rows to the
// tracked files in both directions without node, on every Stop, and the shape cases below keep the page
// in the one-row-per-file form that check reads.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { HOOK_RUNNERS } from "./compile.mjs";
import { SUBCOMMANDS } from "./portulan.mjs";
import { CannotRun, README, headerOf, render, run, titleOf, trackedFiles } from "./roster.mjs";

// A HERMETIC HOST, the three-line block `pinned-roots.live.test.mjs` sweeps for. The render reads only
// constants from `./compile.mjs`, but that module can reach the host's installed-plugin record, and the
// guard belongs to every test file whose imports reach one.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

// `docs.sh`'s extraction, one subject per row, anchored at the start of the line.
const rowsOf = (page) =>
    page
        .split("\n")
        .map((line) => /^\| \[`([^`]*)`\]/.exec(line)?.[1])
        .filter(Boolean);

// Built in a temporary repository rather than in this one, so a case about a missing header does not
// depend on some file here keeping or losing one.
function scratchRepo(files) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "roster-"));
    fs.mkdirSync(path.join(root, "cli"));
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(root, "cli", name), body);
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    return root;
}

describe("cli/README.md is the render, never a hand edit", () => {
    test("the committed page is byte for byte what the files render", () => {
        const page = render();
        const committed = fs.readFileSync(README, "utf8");
        assert.ok(
            committed === page,
            "cli/README.md is not what the files in cli/ render: run `node cli/roster.mjs --write` and commit the result",
        );
    });

    test("--check agrees, and a bad argument could not run", () => {
        const sink = { write() {} };
        assert.equal(run(["--check"], sink, sink), 0);
        assert.equal(run(["--bogus"], sink, sink), 2);
        assert.equal(run(["--write", "--check"], sink, sink), 2);
    });
});

describe("the render keeps the shape docs.sh reads", () => {
    test("every tracked file has exactly one row, and fixtures/ has one", () => {
        const { files, fixtures } = trackedFiles();
        assert.ok(files.length > 0, "git listed nothing in cli/: refusing to compare nothing");
        const rows = rowsOf(render());
        const expected = [...files, ...(fixtures ? ["fixtures/"] : [])].sort();
        assert.deepEqual([...rows].sort(), expected);
        assert.equal(new Set(rows).size, rows.length, "a file has two rows");
    });

    test("the subcommands and the hook runners sit in their groups, in the code's order", () => {
        const page = render();
        const section = (heading) => {
            const from = page.indexOf(`### ${heading}`);
            assert.notEqual(from, -1, `the page has no "${heading}" group`);
            const to = page.indexOf("\n### ", from + 1);
            return rowsOf(page.slice(from, to === -1 ? undefined : to));
        };
        const built = SUBCOMMANDS.map((s) => s.module).filter(Boolean);
        assert.deepEqual(section("The entry point and its subcommands"), ["portulan.mjs", ...built]);
        assert.deepEqual(section("Hook runners"), HOOK_RUNNERS);
    });
});

describe("what a row quotes", () => {
    test("the first paragraph of a // header, after a shebang", () => {
        const source = "#!/usr/bin/env node\n// One line,\n// and its second.\n//\n// Not this one.\nimport x from 'y';\n";
        assert.equal(headerOf(source), "One line, and its second.");
    });

    test("the first paragraph of a leading /** */ block", () => {
        assert.equal(headerOf("/**\n * The set.\n *\n * Not this.\n */\n"), "The set.");
        assert.equal(headerOf("/** Inline opening.\n * continued.\n */\n"), "Inline opening. continued.");
    });

    test("nothing, when the file opens with code or a blank comment line", () => {
        assert.equal(headerOf("import x from 'y';\n// late comment\n"), "");
        assert.equal(headerOf("//\n// after a blank\n"), "");
    });

    test("a Markdown file's H1, and nothing when its first heading is not one", () => {
        assert.equal(titleOf("# The title\n\nBody.\n"), "The title");
        assert.equal(titleOf("## Not a title\n# Late\n"), "");
    });
});

describe("the render refuses what it cannot quote", () => {
    test("a module with no header is could-not-run, naming it", () => {
        const root = scratchRepo({ "a.mjs": "// A tool.\n", "b.mjs": "export const b = 1;\n" });
        try {
            assert.throws(() => render(root), (error) => error instanceof CannotRun && /cli\/b\.mjs/.test(error.message));
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    test("a tracked module with a header gets its row, and an untracked one does not", () => {
        const root = scratchRepo({ "a.mjs": "// A tool.\n" });
        try {
            fs.writeFileSync(path.join(root, "cli", "scratch.mjs"), "// Not added.\n");
            const rows = rowsOf(render(root));
            assert.deepEqual(rows, ["a.mjs"]);
            assert.match(render(root), /\| \[`a\.mjs`\]\(a\.mjs\) \| A tool\. \|/);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    test("an empty cli/ is could-not-run, not an empty page", () => {
        const root = scratchRepo({});
        try {
            assert.throws(() => trackedFiles(root), CannotRun);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
