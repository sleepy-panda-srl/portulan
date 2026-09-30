#!/usr/bin/env node
// Portulan — the one entry point the `npx` package exposes.
//
// Exit codes are the subcommand's own; else 0 for `--help` or `--version`, and 2 for no arguments or a subcommand that cannot run.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// A subcommand imports VERSION from ./manifest.mjs: importing it from here would cycle through this file's top-level await and exit 13.
export { VERSION } from "./manifest.mjs";
import { VERSION } from "./manifest.mjs";

// In `docs/vision.md`'s order. An unbuilt entry sets `module: null` and `arrives`, and `namedIn` where another document names it.
export const SUBCOMMANDS = [
    {
        name: "init",
        module: "init.mjs",
        summary: "draft a workspace for a repository that has none",
    },
    {
        name: "doctor",
        module: "doctor.mjs",
        summary: "validate a workspace against the Workspace Definition",
    },
    {
        name: "compile",
        module: "compile.mjs",
        summary: "compile a workspace's gate policy into host enforcement",
    },
    {
        name: "vendor",
        module: "vendor.mjs",
        summary: "materialise a workspace where it is needed: into a host, or between residences",
    },
    {
        name: "index",
        module: "index.mjs",
        summary: "regenerate the memory, handoff and scope indexes",
    },
    {
        name: "upgrade",
        module: "upgrade.mjs",
        summary: "migrate a workspace: the Workspace Definition steps it owes, and the repairs a rewriter owes it",
    },
    {
        name: "new",
        module: "new.mjs",
        summary: "scaffold a skill, persona, pack, workspace, gate policy or repo card from a core template",
    },
    {
        name: "feedback",
        module: "feedback.mjs",
        summary: "file an issue from a report you previewed, seam-scanned before it leaves the machine",
    },
];

export function find(name) {
    return SUBCOMMANDS.find((entry) => entry.name === name) ?? null;
}

export function usage() {
    const width = Math.max(...SUBCOMMANDS.map((entry) => entry.name.length));
    const lines = [
        `portulan ${VERSION} — the agentic-engineering framework's command line`,
        "",
        "  portulan <subcommand> [options]",
        "",
    ];
    for (const entry of SUBCOMMANDS) {
        const state = entry.module ? "" : `  (not built — arrives at ${entry.arrives})`;
        lines.push(`  ${entry.name.padEnd(width)}  ${entry.summary}${state}`);
    }
    lines.push(
        "",
        "Exit codes: 0 succeeded · 1 a red verdict · 2 could not run.",
        "",
        "Other tools live in cli/ and are deliberately not here — docs/vision.md names these eight",
        "subcommands and is human-owned, so a ninth is the maintainer's call. cli/README.md lists them.",
    );
    return lines.join("\n");
}

export async function run(argv, options = {}) {
    const say = options.say ?? ((line) => process.stdout.write(`${line}\n`));
    const warn = options.warn ?? ((line) => process.stderr.write(`${line}\n`));
    const load = options.load ?? ((file) => import(pathToFileURL(path.join(HERE, file)).href));

    const [name, ...rest] = argv;

    if (name === undefined || name === "--help" || name === "-h" || name === "help") {
        say(usage());
        return name === undefined ? 2 : 0;
    }

    if (name === "--version" || name === "-v" || name === "version") {
        say(VERSION);
        return 0;
    }

    const entry = find(name);
    if (!entry) {
        warn(`portulan: unknown subcommand \`${name}\`.`);
        warn(`portulan: the ${SUBCOMMANDS.length} subcommands are ${SUBCOMMANDS.map((s) => s.name).join(", ")}. Run \`portulan --help\`.`);
        return 2;
    }

    if (!entry.module) {
        warn(`portulan: \`${name}\` is named in ${entry.namedIn ?? "docs/vision.md"} and is not built yet — it arrives at ${entry.arrives}.`);
        warn("portulan: refusing to exit 0 on a subcommand that did nothing.");
        return 2;
    }

    // Imported on demand: a module that fails to load takes down only its own subcommand, and `--help` loads none.
    let module;
    try {
        module = await load(entry.module);
    } catch (error) {
        warn(`portulan: could not load \`${name}\` from ${entry.module} — ${error.message}`);
        return 2;
    }

    if (typeof module.run !== "function") {
        warn(`portulan: ${entry.module} does not export a \`run\` function — refusing to guess at its entry point.`);
        return 2;
    }

    return await module.run(rest);
}

// npm installs a bin as a symlink, and Node realpaths `import.meta.url` but not `argv[1]`; `import.meta.main` needs a newer Node than `engines`.
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

if (isMain()) {
    process.exitCode = await run(process.argv.slice(2));
}
