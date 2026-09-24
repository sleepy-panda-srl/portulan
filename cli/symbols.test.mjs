// The outline's contract, on fixtures: what each construct prints, and every refusal.
//
//   node --test cli/symbols.test.mjs
//
// The fixtures hold the constructs a hand-written scanner gets wrong: braces inside strings, templates,
// nested templates and regular expressions; a `/` that divides, after `++`, a property named `default`
// or an object literal; statements with no semicolon; doc comments that attach and one a blank line
// detaches; a class's members, a suite's tests, a section inside a function; a shell function whose
// here-document carries a `}` at column zero, whose body holds a brace group, and whose strings,
// expansions and comments hold braces. Each outline is pinned whole, so a change to what a session is
// shown fails here first. `symbols.live.test.mjs` holds the same parser to every code file this
// repository tracks.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { CannotOutline, main, outlineJs, outlineSh, render } from "./symbols.mjs";

const JS = [
    "#!/usr/bin/env node",
    "// The fixture's header: what this file is.",
    "//",
    "// More prose.",
    "",
    'import fs from "node:fs";',
    "import { a,",
    '    b } from "./x.mjs";',
    "",
    "/** Doc for one. */",
    "export function one(a, { b = 1 } = {}) {",
    "    return `${a} ${`nested ${b} }`} {`;",
    "}",
    "",
    "// Detached comment.",
    "",
    "const re = /[{(]\\/}/g, other = 2;",
    "const { x, y: z, ...rest } = fs;",
    "",
    "// ===========================================================================================",
    "// 2. A section",
    "// ===========================================================================================",
    "",
    "export class Box extends Array {",
    "    static #count = 0;",
    "    /** Doc for size. */",
    "    get size() { return this.length; }",
    "    async *walk() {",
    '        yield "}";',
    "    }",
    "    field = () => {",
    "        return 1;",
    "    };",
    "}",
    "",
    "export default function () {",
    "    // ---- inner part",
    "    const x = 1 / 2 / 3;",
    "    return x;",
    "};",
    "",
    'describe("suite", () => {',
    "    const helper = () => 1;",
    '    test("one", () => {',
    "        const inner = 1;",
    "    });",
    '    it.skip("two", async () => {});',
    "});",
    "",
    'if (import.meta.url === "x") {',
    '    console.log("}");',
    "}",
    "export { one as uno };",
    "",
].join("\n");

const SH = [
    "#!/usr/bin/env bash",
    "# The fixture's header.",
    "set -eu",
    "",
    "pass() { printf 'ok\\n'; }",
    "",
    "# ---------------------------------------------------------------- 1. first",
    "# Doc for helper.",
    "helper() {",
    "    cat <<EOT",
    "}",
    "EOT",
    '    echo "}"',
    "}",
    "",
    "# 1a. A numbered part.",
    "function other {",
    "    :",
    "}",
    "",
    "# ---------------------------------------------------------------- 2. second",
    'echo "a << b"',
    "",
].join("\n");

const scratch = () => fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "portulan-symbols-"));

function run(args, cwd) {
    const out = [];
    const err = [];
    const code = main(["node", "symbols", ...args], { write: (s) => out.push(s) }, { write: (s) => err.push(s) }, cwd);
    return { code, out: out.join(""), err: err.join("") };
}

describe("a JavaScript outline", () => {
    test("names every construct once, with its span and its first line", () => {
        assert.deepEqual(render("fixture.mjs", outlineJs(JS)), [
            "fixture.mjs: 53 lines",
            "2-4 // The fixture's header: what this file is.",
            "6-8 import node:fs, ./x.mjs",
            "10-13 export function one(a, {b = 1} = {})",
            "17 const re = /[{(]\\/}/g, other = 2;",
            "18 const { x, y: z, ...rest } = fs;",
            "20-53 // § 2. A section",
            "24-34 export class Box extends Array",
            "  25 static #count = 0;",
            "  26-27 get size()",
            "  28-30 async *walk()",
            "  31-33 field = () => {",
            "36-40 export default function ()",
            "  37-40 // § inner part",
            '42-48 describe("suite", () => {',
            "  43 const helper = () => 1;",
            '  44-46 test("one", () => {',
            '  47 it.skip("two", async () => {});',
            '50-52 if (import.meta.url === "x")',
            "53 export { one as uno };",
        ]);
    });

    test("binds the names a declaration binds, destructured ones included", () => {
        const names = outlineJs(JS).entries.filter((e) => Array.isArray(e.name)).map((e) => e.name);
        assert.deepEqual(names, [["one"], ["re", "other"], ["x", "z", "rest"]]);
    });

    test("ends an import or a re-export at its source, wherever its lines break", () => {
        const src = [
            "import {",
            "    a,",
            '    "b-c" as b',
            "}",
            'from "./x.mjs"',
            "export { a }",
            'from "./y.mjs"',
            'import data from "./d.json"',
            'with { type: "json" }',
            "from(a)",
            "",
        ].join("\n");
        assert.deepEqual(render("m.mjs", outlineJs(src)).slice(1), ["1-5 import ./x.mjs", "6-7 export { a }", "8-9 import ./d.json", "10 from(a)"]);
    });

    test("names no class that has no name of its own", () => {
        const src = "export default class extends Base {\n    size() {}\n}\n";
        assert.deepEqual(outlineJs(src).entries.map((e) => [e.name, e.children.map((m) => m.name)]), [[null, ["size"]]]);
    });

    test("ends a statement where a line with no semicolon ends it", () => {
        const src = "const a = 1\nconst b = () => {\n}\nfoo()\nbar()\n    .baz()\n";
        assert.deepEqual(render("asi.mjs", outlineJs(src)).slice(1), ["1 const a = 1", "2-3 const b = () => {", "4 foo()", "5-6 bar()"]);
    });

    test("reads a `/` after a value as division, and after a keyword or a block as a regular expression", () => {
        const src = [
            "let value = 1;",
            "const ratio = value++ / 2;",
            "const half = options.default / 2;",
            "const nothing = {} / 2;",
            "if (ratio) {}",
            "/[}]/.test(String(half)) && run([nothing]);",
            "export default /[a{]/;",
            "",
        ].join("\n");
        assert.deepEqual(render("slash.mjs", outlineJs(src)).slice(1), [
            "1 let value = 1;",
            "2 const ratio = value++ / 2;",
            "3 const half = options.default / 2;",
            "4 const nothing = {} / 2;",
            "5 if (ratio)",
            "6 /[}]/.test(String(half)) && run([nothing]);",
            "7 export default /[a{]/;",
        ]);
    });

    test("refuses a source whose brackets it cannot match, naming the line", () => {
        assert.throws(() => outlineJs("function f() {\n  return [1, 2;\n}\n"), (error) => error instanceof CannotOutline && /line 2/.test(error.message));
        assert.throws(() => outlineJs("const s = `open ${x\n"), CannotOutline);
        assert.throws(() => outlineJs("const s = 'no end\n"), CannotOutline);
        assert.throws(() => outlineJs("const r = /no end"), CannotOutline);
    });
});

describe("a shell outline", () => {
    test("names its functions and its banners, and a here-document hides its lines", () => {
        assert.deepEqual(render("fixture.sh", outlineSh(SH)), [
            "fixture.sh: 22 lines",
            "2 # The fixture's header.",
            "5 pass()",
            "7-20 # § 1. first",
            "8-14 helper()",
            "16-20 # § 1a. A numbered part.",
            "17-19 other()",
            "21-22 # § 2. second",
        ]);
    });

    test("ends a function at the brace closing its body, whatever braces its words, strings and comments hold", () => {
        const src = [
            "f() { { echo hi; }",
            "  echo bye",
            "}",
            "g() {",
            "{",
            '  echo "a }',
            "}\" '}' ${x} {a,b} \\} # }",
            "}",
            "  echo g",
            "}",
            "",
        ].join("\n");
        assert.deepEqual(render("braces.sh", outlineSh(src)).slice(1), ["1-3 f()", "4-10 g()"]);
    });

    test("hides the body of every here-document a line opens, not only the first", () => {
        const src = ["f() {", "    cat <<A <<B", "a }", "A", "}", "B", "}", 'g() { x=$(cat <<< "$y"); }', ""].join("\n");
        assert.deepEqual(render("two.sh", outlineSh(src)).slice(1), ["1-7 f()", "8 g()"]);
    });

    test("refuses a here-document that never ends and a function that never closes", () => {
        assert.throws(() => outlineSh("cat <<EOT\nno end\n"), (error) => error instanceof CannotOutline && /line 1/.test(error.message));
        assert.throws(() => outlineSh("f() {\n  :\n"), (error) => error instanceof CannotOutline && /f\(\)/.test(error.message));
    });
});

describe("the command", () => {
    test("prints each file's outline, and exits 2 for a file it does not read", () => {
        const dir = scratch();
        fs.writeFileSync(path.join(dir, "a.mjs"), "export const A = 1;\n");
        fs.writeFileSync(path.join(dir, "notes.md"), "# Notes\n");
        assert.deepEqual(run(["a.mjs"], dir), { code: 0, out: "a.mjs: 1 lines\n1 export const A = 1;\n", err: "" });
        const md = run(["notes.md"], dir);
        assert.equal(md.code, 2);
        assert.match(md.err, /notes\.md is not JavaScript or shell; read it whole or by section/);
        const missing = run(["gone.mjs"], dir);
        assert.equal(missing.code, 2);
        assert.match(missing.err, /cannot read gone\.mjs: ENOENT/);
        fs.writeFileSync(path.join(dir, "broken.mjs"), "function f() {\n");
        assert.match(run(["broken.mjs"], dir).err, /broken\.mjs: an unclosed `\{` on line 1; read it as usual/);
    });

    test("finds a definition across the tracked code, members as Class.member, and exits 1 for none", () => {
        const dir = scratch();
        execFileSync("git", ["init", "-q"], { cwd: dir });
        fs.mkdirSync(path.join(dir, "lib"));
        fs.writeFileSync(path.join(dir, "lib", "a.mjs"), "export class Box {\n    size() {\n        return 1;\n    }\n}\n");
        fs.writeFileSync(path.join(dir, "tool"), "#!/bin/sh\nsize() {\n    :\n}\n");
        fs.writeFileSync(path.join(dir, "untracked.mjs"), "function size() {}\n");
        execFileSync("git", ["add", "lib/a.mjs", "tool"], { cwd: dir });
        assert.deepEqual(run(["--find", "size"], dir), { code: 0, out: "lib/a.mjs:2-4 size()\ntool:2-4 size()\n", err: "" });
        assert.equal(run(["--find", "Box.size"], dir).out, "lib/a.mjs:2-4 size()\n");
        assert.deepEqual(run(["--find", "nothing"], dir), { code: 1, out: "", err: "symbols: no definition of nothing in the tracked code\n" });
        assert.equal(run(["--find", "size"], scratch()).code, 2);
    });

    test("refuses to search when a tracked file cannot be read, and passes over one the work tree deleted", () => {
        const dir = scratch();
        execFileSync("git", ["init", "-q"], { cwd: dir });
        fs.writeFileSync(path.join(dir, "a.mjs"), "export function size() {}\n");
        fs.writeFileSync(path.join(dir, "gone.mjs"), "export function size() {}\n");
        fs.symlinkSync("loop.mjs", path.join(dir, "loop.mjs"));
        execFileSync("git", ["add", "a.mjs", "gone.mjs", "loop.mjs"], { cwd: dir });
        fs.rmSync(path.join(dir, "gone.mjs"));
        assert.deepEqual(run(["--find", "size"], dir), { code: 2, out: "", err: "symbols: could not outline — cannot read loop.mjs: ELOOP\n" });
        execFileSync("git", ["rm", "-q", "--cached", "loop.mjs"], { cwd: dir });
        assert.deepEqual(run(["--find", "size"], dir), { code: 0, out: "a.mjs:1 export function size()\n", err: "" });
    });

    test("prints its usage for --help, and exits 2 on none or an unknown option", () => {
        assert.equal(run(["--help"]).code, 0);
        assert.equal(run([]).code, 2);
        assert.match(run(["--bogus"]).err, /unknown option --bogus/);
        assert.equal(run(["--find"]).code, 2);
    });
});
