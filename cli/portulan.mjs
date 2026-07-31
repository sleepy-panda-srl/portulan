#!/usr/bin/env node
// Portulan — the one entry point the `npx` package exposes.
//
// `docs/vision.md` names six subcommands and is human-owned: `init` · `doctor` · `compile` ·
// `vendor` · `index` · `upgrade`. This file is the surface that makes them one command instead of
// six file paths, and it is milestone 7's packaging clause.
//
// ## What it is NOT
//
// **Not a reimplementation.** `doctor`, `compile`, `index` and `init` each live in their own file and
// are exercised by their own suites; this dispatches to them and adds nothing to what they do. A
// wrapper that re-derived any part of their behaviour would be a second carrier of one fact, which is
// the defect this repository names more often than any other — so the dispatch imports each tool's
// exported `run` and returns its exit code untouched.
//
// **Not a home for the two tools that are off the list.** `plugin-lint` and `librarian` exist in
// `cli/` and are deliberately absent here. `docs/vision.md` names six, it is human-owned, and
// `cli/README.md` records that whether either of them ever joins the six is the maintainer's call
// and not an implementer's. Wiring one in would mint a seventh subcommand into a list this file
// does not own. They stay runnable exactly as they are today — `node cli/plugin-lint.mjs …` — and
// every verify recipe still invokes them that way.
//
// ## Two of the six are not built
//
// `vendor` and `upgrade` are milestone 7 work that has not landed. They are listed, and
// they exit **2 — could not run**, naming what is missing. The alternative shapes were both worse:
// hiding them makes the package look like a four-command tool and the row like it is further along
// than it is, and stubbing them to exit 0 would be a fail-open in the one place a user is most
// likely to trust silence. "Nothing looked" is never "nothing wrong" — the same three-code
// discipline the verify recipes hold (`.portulan/memory/verify-preconditions-fail-closed.md`).
//
// ## Exit codes, which are the tools' own
//
// `0` the subcommand succeeded · `1` it rendered a red verdict · `2` it could not run — including
// an unknown subcommand, an unbuilt one, and being invoked with **no arguments at all**, because
// none of those is a verdict about anybody's workspace. An **explicit** `--help` exits 0: asking for
// help is a request, and it succeeded.
//
// Zero dependencies and no build step, which is a ruling rather than an accident: the maintainer
// settled on 2026-07-31 that this ships as plain ESM on Node, against `.portulan/identity.md`'s
// older "TypeScript on Node" line, so that the repository stays checkable by cloning it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ONE carrier for the version, read from the manifest that publishes it.
//
// It was written down twice — here and in `package.json` — which is this repository's dominant
// defect class committed in the file whose own comments name it. Read rather than duplicated, and
// the read works in both layouts: from a checkout `package.json` is one level up from `cli/`, and
// the published package keeps that shape because `files` ships `cli/` under the package root.
//
// Falls back rather than throwing: a version string is not worth taking the command line down for.
export const VERSION = (() => {
    try {
        const manifest = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
        return JSON.parse(fs.readFileSync(manifest, "utf8")).version ?? "unknown";
    } catch {
        return "unknown";
    }
})();

// The six, in the order `docs/vision.md` lists them. `module` is the file that carries the
// subcommand's `run`; `null` means the subcommand exists in the vision and not yet in the tree.
//
// `arrives` is not decoration. Condition 4 of `.portulan/dod.md` is that a document describing
// capability either has the capability or names where it arrives, and a help screen listing a verb
// that does nothing is exactly that document.
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
        module: null,
        arrives: "milestone 7, a later session",
        summary: "write a self-contained AGENTS.md + .portulan/ for any host",
    },
    {
        name: "index",
        module: "index.mjs",
        summary: "regenerate the memory, handoff and scope indexes",
    },
    {
        name: "upgrade",
        module: null,
        arrives: "milestone 7, a later session",
        summary: "migrate a workspace to a newer Workspace Definition",
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
        // The state is printed per subcommand rather than as a footnote, because a reader scanning
        // this list is deciding what to type, and a footnote is read after that decision.
        const state = entry.module ? "" : `  (not built — arrives at ${entry.arrives})`;
        lines.push(`  ${entry.name.padEnd(width)}  ${entry.summary}${state}`);
    }
    lines.push(
        "",
        "Exit codes: 0 succeeded · 1 a red verdict · 2 could not run.",
        "",
        "`plugin-lint` and `librarian` are deliberately not here: docs/vision.md names six",
        "subcommands and is human-owned, so adding a seventh is the maintainer's call.",
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
        // The split is the point: a bare `portulan` was asked to do something and did nothing, which
        // is could-not-run; an explicit `--help` asked for the help screen and got it, which is
        // success. Written out because the two look alike in a shell and a reader scripting against
        // this will meet both. _(These lines previously argued that explicit `--help` should exit 2
        // as well — an argument the code never implemented and the tests contradict. Corrected in
        // the direction of the behaviour, which is the conventional one.)_
        return name === undefined ? 2 : 0;
    }

    if (name === "--version" || name === "-v" || name === "version") {
        say(VERSION);
        return 0;
    }

    const entry = find(name);
    if (!entry) {
        warn(`portulan: unknown subcommand \`${name}\`.`);
        warn(`portulan: the six are ${SUBCOMMANDS.map((s) => s.name).join(", ")}. Run \`portulan --help\`.`);
        return 2;
    }

    if (!entry.module) {
        warn(`portulan: \`${name}\` is named in docs/vision.md and is not built yet — it arrives at ${entry.arrives}.`);
        warn("portulan: refusing to exit 0 on a subcommand that did nothing.");
        return 2;
    }

    // Loaded on demand, never at startup. Two reasons and both are measured elsewhere in this
    // repository: a tool that fails to parse takes down only its own subcommand rather than the
    // whole command line, and the built modules together are large enough that eagerly importing
    // them would make `portulan --help` pay for `doctor`.
    let module;
    try {
        module = await load(entry.module);
    } catch (error) {
        warn(`portulan: could not load \`${name}\` from ${entry.module} — ${error.message}`);
        return 2;
    }

    if (typeof module.run !== "function") {
        // A guard rather than an assumption. Every built tool exports `run` today; if one stops, the
        // failure must name itself here instead of surfacing as `module.run is not a function`.
        warn(`portulan: ${entry.module} does not export a \`run\` function — refusing to guess at its entry point.`);
        return 2;
    }

    // The tool's own exit code, returned unchanged. Re-mapping it here would put a second opinion
    // about a workspace between the tool and its user.
    return await module.run(rest);
}

// THE MAIN-MODULE GUARD RESOLVES SYMLINKS, and this file is the one in the repository that must.
//
// Every other tool here guards with a bare `pathToFileURL(process.argv[1])` comparison and is right
// to: nothing ever invokes them through a link. This one is a `bin`, and **npm installs a bin as a
// symlink** — `node_modules/.bin/portulan` → `cli/portulan.mjs`. Node realpaths the main module for
// `import.meta.url` while `process.argv[1]` keeps the link path, so the bare comparison is FALSE
// through the link and `run` never executes.
//
// Measured on the staged tree before this line existed, by packing the package and installing the
// tarball: through `node_modules/.bin/portulan`, `--version` printed nothing and exited 0, and
// `doctor <nonexistent>` exited **0** where the same command exits 1 from a checkout. **Every
// verdict became a silent success** — "nothing looked" reported as "nothing wrong", at the one
// surface a user reaches by the documented route. Found by the pre-commit checkpoint, which
// installed the tarball rather than reading the guard.
//
// `realpathSync` rather than `import.meta.main`, which needs a newer Node than `engines` asks for.
// Wrapped, because `argv[1]` may be absent or unreadable and a guard that throws would be a worse
// failure than the one it prevents — falling back to the unresolved path leaves the old behaviour
// rather than crashing.
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
