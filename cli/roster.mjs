#!/usr/bin/env node
// The cli roster: `cli/README.md`, rendered from the files it lists and never edited by hand.
//
//   node cli/roster.mjs            print the page
//   node cli/roster.mjs --write    write it to cli/README.md
//   node cli/roster.mjs --check    exit 1 when cli/README.md is not exactly what this renders
//
// Exit 0 printed, written or current · 1 out of date (`--check` only) · 2 could not run: not a git
// repository, or a listed file with no header to quote.
//
// Each file's header comment is its full account, and the page quotes the first paragraph of it: the
// leading `//` lines, or a leading `/** */` block, up to the first blank comment line. A Markdown file
// is quoted by its H1. Where the code already says what a file is for, the page reads it there rather
// than restating it: the subcommands and their summaries from `SUBCOMMANDS` in ./portulan.mjs, the hook
// runners from `HOOK_RUNNERS` in ./compile.mjs, and what does not ship from `EXCLUDED` in ./payload.mjs,
// whose reasons stay there. So what a row quotes cannot change without the page changing, and
// ./cli-roster.live.test.mjs, which the `tests` recipe runs, is red until the page is written again.
//
// Tracked files only, the enumeration `docs.sh`'s `cli table` check reads, so a scratch file is never
// listed and a new file is listed once it is added: `git add` it, then `--write`. That check reads the
// rows this renders, one per file, which is why every file keeps a row of its own.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { HOOK_RUNNERS } from "./compile.mjs";
import { EXCLUDED } from "./payload.mjs";
import { SUBCOMMANDS } from "./portulan.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const ENTRY_POINT = "portulan.mjs";
const FIXTURES = "fixtures/";

export const README = path.join(HERE, "README.md");

class CannotRun extends Error {}

/**
 * The tracked `cli/*.mjs` and `cli/*.md` files directly in `cli/`, this page aside, and whether
 * `cli/fixtures/` holds anything tracked. `core.quotePath=false` for `docs.sh`'s reason: a C-quoted
 * name would keep its quotes and drop out of the page without a word.
 */
export function trackedFiles(root = ROOT) {
    let out;
    try {
        out = execFileSync("git", ["-c", "core.quotePath=false", "ls-files", "--", "cli/*.mjs", "cli/*.md", "cli/fixtures"], {
            cwd: root,
            encoding: "utf8",
            maxBuffer: 64 * 1024 * 1024,
            stdio: ["ignore", "pipe", "pipe"],
        });
    } catch (error) {
        throw new CannotRun(`git could not list cli/ in ${root}: ${String(error.stderr || error.message).trim()}`);
    }
    const files = [];
    let fixtures = false;
    for (const line of out.split("\n")) {
        if (!line.startsWith("cli/")) continue;
        const name = line.slice("cli/".length);
        if (name.startsWith(FIXTURES)) fixtures = true;
        else if (!name.includes("/") && name !== "README.md") files.push(name);
    }
    if (!files.length) throw new CannotRun(`git lists no file in ${path.join(root, "cli")}; refusing to render an empty roster`);
    return { files: files.sort(), fixtures };
}

/** The first paragraph of a module's header comment, joined into one line; "" when it has none. */
export function headerOf(source) {
    const lines = source.split("\n");
    let i = lines[0]?.startsWith("#!") ? 1 : 0;
    const para = [];
    if (lines[i]?.startsWith("//")) {
        for (; i < lines.length && lines[i].startsWith("//"); i++) {
            const text = lines[i].slice(2).trim();
            if (!text) break;
            para.push(text);
        }
    } else if (lines[i]?.trim().startsWith("/**")) {
        const opening = lines[i].trim().slice(3).trim();
        if (opening) para.push(opening);
        for (i++; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith("*/")) break;
            const text = line.replace(/^\*/, "").trim();
            if (!text) break;
            para.push(text);
        }
    }
    return para.join(" ");
}

/** A Markdown file's H1, without its `# `; "" when its first heading is not one. */
export function titleOf(source) {
    const heading = source.split("\n").find((line) => /^#{1,6} /.test(line));
    return heading?.startsWith("# ") ? heading.slice(2).trim() : "";
}

const cell = (text) => text.replaceAll("|", "\\|");
const row = (name, text) => `| [\`${name}\`](${name}) | ${cell(text)} |`;

/** The page, as the bytes `--write` puts in cli/README.md. */
export function render(root = ROOT) {
    const { files, fixtures } = trackedFiles(root);
    const read = (name) => {
        try {
            return fs.readFileSync(path.join(root, "cli", name), "utf8");
        } catch (error) {
            throw new CannotRun(`could not read cli/${name}: ${error.message}`);
        }
    };
    const summary = (name) => {
        const text = name.endsWith(".md") ? titleOf(read(name)) : headerOf(read(name));
        if (!text) {
            throw new CannotRun(
                name.endsWith(".md")
                    ? `cli/${name} has no H1 to quote; give it one`
                    : `cli/${name} opens with no header comment to quote; its first lines say what it is`,
            );
        }
        if (EXCLUDED[name] === undefined) return text;
        return `${/[.!?]$/.test(text) ? text : `${text}.`} Not shipped.`;
    };

    const present = new Set(files);
    const subcommands = SUBCOMMANDS.filter((s) => s.module && present.has(s.module));
    const placed = new Set([ENTRY_POINT, ...subcommands.map((s) => s.module), ...HOOK_RUNNERS]);
    const tests = files.filter((f) => f.endsWith(".test.mjs"));
    const tools = files.filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs") && !placed.has(f));
    const others = files.filter((f) => !f.endsWith(".mjs"));

    const out = [
        "# cli/",
        "",
        "<!-- Generated by `node cli/roster.mjs --write` from the files it lists: never edit it by hand. The",
        "     `tests` recipe is red while it differs from that render (cli-roster.live.test.mjs). -->",
        "",
        "The command line of the npm package. `portulan <subcommand>` reaches each subcommand through",
        "`package.json`'s `bin`, [`portulan.mjs`](portulan.mjs); every tool here also runs from a clone as",
        "`node cli/<file>.mjs`. A subcommand's line is its `portulan --help` summary, and every other line is the",
        "first paragraph of its file's header comment. The header is each file's full account: read it before",
        "changing the file. The groups come from the code: `SUBCOMMANDS` in [`portulan.mjs`](portulan.mjs),",
        "`HOOK_RUNNERS` in [`compile.mjs`](compile.mjs), and `EXCLUDED` in [`payload.mjs`](payload.mjs), which",
        "says why each file marked *Not shipped* stays home.",
        "",
        "A tool belongs here when it works on any workspace or plugin root. This repository's own recipes live",
        "in [`../.portulan/verify/`](../.portulan/verify/), and its operator tooling in",
        "[`../.portulan/tools/`](../.portulan/tools/).",
        "",
        "## What is here today",
        "",
        "### The entry point and its subcommands",
        "",
        "| File | What it is |",
        "|---|---|",
    ];
    if (present.has(ENTRY_POINT)) out.push(row(ENTRY_POINT, summary(ENTRY_POINT)));
    for (const s of subcommands) out.push(row(s.module, `\`portulan ${s.name}\`: ${s.summary}.`));

    const group = (heading, lead, names, text = summary) => {
        if (!names.length) return;
        out.push("", `### ${heading}`, "", lead, "", "| File | What it is |", "|---|---|");
        for (const name of names) out.push(row(name, text(name)));
    };
    group(
        "Hook runners",
        "Run by the hooks `compile` writes into a host's settings, never by a person.",
        HOOK_RUNNERS.filter((f) => present.has(f)),
    );
    group("Tools and modules", "Run as `node cli/<file>.mjs`, or imported by the files above.", tools);
    group("Tests", 'Node\'s own runner: `node --test "cli/**/*.test.mjs"`, which the `tests` recipe runs.', tests);

    const rest = [...others];
    if (fixtures) rest.push(FIXTURES);
    group("Other files", "What the tools and suites read.", rest, (name) =>
        name === FIXTURES ? "The fixtures the suites build on; each suite names the ones it reads. Not shipped." : summary(name),
    );
    return `${out.join("\n")}\n`;
}

export function run(argv, stdout = process.stdout, stderr = process.stderr) {
    const write = argv.includes("--write");
    const check = argv.includes("--check");
    const unknown = argv.filter((a) => a !== "--write" && a !== "--check");
    if (unknown.length || (write && check)) {
        stderr.write("usage: node cli/roster.mjs [--write | --check]\n");
        return 2;
    }
    let page;
    try {
        page = render();
    } catch (error) {
        if (error instanceof CannotRun) {
            stderr.write(`roster: could not run: ${error.message}\n`);
            return 2;
        }
        throw error;
    }
    if (write) {
        fs.writeFileSync(README, page);
        stdout.write(`roster: wrote cli/README.md\n`);
        return 0;
    }
    if (!check) {
        stdout.write(page);
        return 0;
    }
    let current = null;
    try {
        current = fs.readFileSync(README, "utf8");
    } catch {
        // Absent is out of date, the same verdict as a stale page.
    }
    if (current === page) {
        stdout.write("ok  roster: cli/README.md is what the files render\n");
        return 0;
    }
    stderr.write("roster: cli/README.md is not what the files render: run `node cli/roster.mjs --write`\n");
    return 1;
}

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

// `process.exitCode` rather than `process.exit`, so a pipe that has not drained is not cut short.
if (isMain()) process.exitCode = run(process.argv.slice(2));

export { CannotRun };
