// The outline against THIS repository: every tracked code file outlines, and each span is whole.
//
//   node --test cli/symbols.live.test.mjs
//
// A session reads a span in place of the file, so a span that stops one line short hides the line that
// mattered, and nothing in the outline would show it. The fixtures in `symbols.test.mjs` pin each
// construct; this holds the parser to the code sessions actually read. **Every tracked JavaScript or
// shell file must outline**, since a refusal there sends every session back to whole reads of it; and
// **every span it prints must compile on its own**, checked by node's own parser for JavaScript and by
// `bash -n` for a shell function: each declaration, statement and test, and each class member inside a
// class of its own. A span that ends early is then a syntax error here rather than a silent loss in a
// session, bar a method chain cut before its last call, which the fixtures' continuation case holds. A
// span that ends late still compiles; the fixtures' statement ends are what hold that. Sections, the
// file's header, its imports and its export lists are not code a session edits alone, and are skipped.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import { languageOf, outlineFile, trackedCode } from "./symbols.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = trackedCode(REPO_ROOT);

test("the tracked code is found, and every file of it outlines", () => {
    assert.ok(FILES.length > 100, `only ${FILES.length} tracked code files found`);
    assert.ok(FILES.includes("cli/symbols.mjs") && FILES.includes(".portulan/verify/docs.sh"));
    const refused = [];
    for (const file of FILES) {
        try {
            outlineFile(path.join(REPO_ROOT, file), file);
        } catch (error) {
            refused.push(error.message);
        }
    }
    assert.deepEqual(refused, []);
});

// The first line of the error a span raises on its own, or null when it compiles. JavaScript is wrapped so
// `await` and a bare declaration both parse; `import.meta` parses only in a module, so it is renamed, and
// `export` is taken off the one line that opens with it. A class member parses only in a class body, one
// that declares the private names the member uses and does not declare itself.
function compileError(language, text, member, own) {
    try {
        if (language !== "js") {
            execFileSync("bash", ["-n"], { input: text, stdio: ["pipe", "ignore", "pipe"] });
            return null;
        }
        const body = text.replace(/\bimport\.meta\b/g, "importMeta").replace(/^(\s*)export\s+(default\s+)?/m, "$1");
        if (!member) {
            new vm.Script(`(async function () {\n${body}\n})`);
            return null;
        }
        const privates = [...new Set(body.match(/#[A-Za-z_$][\w$]*/g))].filter((name) => name !== own);
        new vm.Script(`(class extends Object {\n${privates.map((name) => `${name};`).join(" ")}\n${body}\n})`);
        return null;
    } catch (error) {
        return String(error.message).split("\n")[0];
    }
}

test("every span compiles on its own", () => {
    const broken = [];
    for (const file of FILES) {
        const src = fs.readFileSync(path.join(REPO_ROOT, file), "utf8").split("\n");
        const language = languageOf(file, src[0]);
        const walk = (list, inClass) => {
            for (const e of list) {
                const code = !e.section && !e.header && !/^(import |export\s*[{*])/.test(e.text);
                const error = code && compileError(language, src.slice(e.start - 1, e.end).join("\n"), inClass, e.name);
                if (error) broken.push(`${file}:${e.start}-${e.end} ${e.text}: ${error}`);
                walk(e.children, /^(export\s+)?(default\s+)?class\b/.test(e.text));
            }
        };
        walk(outlineFile(path.join(REPO_ROOT, file), file).entries, false);
    }
    assert.deepEqual(broken, []);
});
