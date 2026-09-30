// `symbols` against this repository: tracked code and Markdown files outline, each declaration compiles alone, and heading links land.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import { languageOf, outlineFile, outlineMd, trackedCode } from "./symbols.mjs";

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

// A script parses no `import.meta`, top-level `await` or lone class member, so each span is adapted to parse alone.
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
        const privates = [...new Set(body.match(/#[A-Za-z_$][\w$]*/g) ?? [])].filter((name) => name !== own);
        new vm.Script(`(class extends Object {\n${privates.map((name) => `${name};`).join(" ")}\n${body}\n})`);
        return null;
    } catch (error) {
        return String(error.message).split("\n")[0];
    }
}

// Compiling misses a span that ends late or cuts a method chain short; the fixtures in `symbols.test.mjs` hold those.
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

// The outline's anchors must be GitHub's, or a link a session follows reads the wrong section.
test("every tracked Markdown file outlines, and every link to one of its headings finds it", () => {
    const docs = execFileSync("git", ["ls-files", "-z", "--", "*.md"], { cwd: REPO_ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
    assert.ok(docs.length > 100, `only ${docs.length} tracked Markdown files found`);
    const anchors = new Map();
    const anchorsOf = (file) => {
        if (!anchors.has(file)) {
            const all = new Set();
            const walk = (list) => list.forEach((e) => (all.add(e.anchor), walk(e.children)));
            walk(outlineMd(fs.readFileSync(file, "utf8")).entries);
            anchors.set(file, all);
        }
        return anchors.get(file);
    };
    const refused = [];
    const lost = [];
    let links = 0;
    for (const doc of docs) {
        const file = path.join(REPO_ROOT, doc);
        try {
            anchorsOf(file);
        } catch (error) {
            refused.push(`${doc}: ${error.message}`);
            continue;
        }
        for (const [, target, fragment] of fs.readFileSync(file, "utf8").matchAll(/\]\(([^)\s#]*\.md)#([^)\s]+)\)/g)) {
            const to = path.resolve(path.dirname(file), target);
            if (!to.startsWith(REPO_ROOT + path.sep) || !fs.existsSync(to)) continue;
            links++;
            if (!anchorsOf(to).has(decodeURIComponent(fragment))) lost.push(`${doc}: ${target}#${fragment}`);
        }
    }
    assert.deepEqual(refused, []);
    assert.ok(links > 40, `only ${links} links to a heading found`);
    assert.deepEqual(lost, []);
});
