#!/usr/bin/env node
// Portulan — the one entry point the `npx` package exposes.
//
// `docs/vision.md` names **eight** subcommands and is human-owned: `init` · `doctor` · `compile` ·
// `vendor` · `index` · `upgrade` · `new` · `feedback`. This is milestone 7's packaging clause.
//
// It named six until 2026-08-03. `new` and `feedback` arrived in the CLI first, licensed by row 7 of
// `docs/plan.md` naming them in its own ratified text, and the maintainer then folded both into the
// constitution — so the two-carrier state that licence created lasted one pull request and is gone. The
// history is worth one sentence rather than none: a subcommand may be licensed by the row before the
// constitution catches up, and when that happens this file says which document names it. Everything
// beyond these eight is still the maintainer's call.
//
// ## What it is NOT
//
// **Not a reimplementation.** `doctor`, `compile`, `index` and `init` each live in their own file and
// are exercised by their own suites; this dispatches to them and adds nothing to what they do. A
// wrapper that re-derived any part of their behaviour would be a second carrier of one fact, which is
// the class `0020` names — a rule enforced at two sites and repaired at one — so the dispatch imports each tool's
// exported `run` and returns its exit code untouched.
//
// **Not a home for the tools that are off the list.** Several tools live in `cli/` and are deliberately
// absent here. `docs/vision.md` names eight, it is human-owned, and whether any of the others ever joins
// that list is the maintainer's call and not an implementer's. Wiring one in would mint a ninth
// subcommand into a list this file does not own. They stay runnable exactly as they are today —
// `node cli/plugin-lint.mjs …` — and every verify recipe still invokes them that way.
//
// **The roster itself is `cli/README.md`'s and is cited rather than repeated here.** This paragraph
// said **two**, then **three**, and named a different three from the root `README.md`'s three while
// **four** were on disk — one rule with three carriers, obeyed at the narrowest, in the file whose own
// comments name that class. _(It also named the wrong ordinal once — *a seventh subcommand*, written
// when the list held six. A count in prose beside a list nothing derives it from is the drift this
// file's own suite catches for `SUBCOMMANDS.length` and cannot catch here.)_
//
// ## One of the eight is not built
//
// `upgrade` is milestone 7 work that has not landed. It is listed, and it exits **2 — could not
// run**, naming what is missing. The alternative shapes were both worse: hiding it makes the package
// look like a smaller tool and the row like it is further along than it is, and stubbing it to exit 0
// would be a fail-open in the one place a user is most likely to trust silence. "Nothing looked" is
// never "nothing wrong" — the same three-code discipline the verify recipes hold
// (`.portulan/memory/verify-preconditions-fail-closed.md`).
//
// _(`vendor` was one of three until milestone 7 session 3, and `feedback` one of two until session 6.
// The count is written out here and derived in the suite, which is the split that has held: the
// sentence explains, the assertion counts.)_
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

// ONE carrier for the version, read from the manifest that publishes it — and read in `manifest.mjs`
// rather than here, since milestone 7 session 6.
//
// It was written down twice — here and in `package.json` — which is this repository's dominant defect
// class committed in the file whose own comments name it. The read moved down a level when `feedback`
// needed the same value: importing it *from this file* made the subcommand circular with the entry
// point and hung the command line on an unsettled top-level await, which `manifest.mjs`'s header
// records in full. Re-exported here so this file's published surface is unchanged.
export { VERSION } from "./manifest.mjs";
import { VERSION } from "./manifest.mjs";

// The eight, in the order `docs/vision.md` lists them. `module` is the file that carries the
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
        module: "vendor.mjs",
        // BOTH directions, because the constitution now glosses both. It said "a self-contained
        // AGENTS.md + .portulan/ for any host" until 2026-08-03, when the maintainer widened the gloss
        // to cover materialising a workspace out of a repository as well as into one — which is what
        // settled the verb row 7 had deliberately left unassigned. A summary carrying only the older
        // half would be the narrower of two carriers of one fact, which is the shape a reader obeys.
        summary: "materialise a workspace where it is needed: into a host, or between residences",
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
        // One thing waiting for whoever builds this, recorded where they will be rather than in a
        // handoff they may not read: a workspace drafted since milestone 7 session 7 carries an
        // ABSOLUTE path in `verify/index.sh` — the bundle `init` ran from, the last of three CLI
        // locations — on two lines marked `# portulan:bundle-fallback`. A migration that rewrites a
        // workspace should re-derive them; one that does not leaves a rail exiting 2 on a machine
        // that is not the drafting one. `cli/init.mjs`'s `draftIndexRecipe` owns the marker and
        // `cli/vendor.mjs` carries the same note at its copy loop.
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
        // The state is printed per subcommand rather than as a footnote, because a reader scanning
        // this list is deciding what to type, and a footnote is read after that decision.
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
        // Derived, never a literal. A hard-coded count is wrong the hour a subcommand lands — which is
        // exactly what happened to a literal `3` in this file's own suite when `init` shipped.
        warn(`portulan: the ${SUBCOMMANDS.length} subcommands are ${SUBCOMMANDS.map((s) => s.name).join(", ")}. Run \`portulan --help\`.`);
        return 2;
    }

    if (!entry.module) {
        // WHERE the name comes from, not a blanket "docs/vision.md". All eight are in the constitution
        // as of 2026-08-03, so `namedIn` is unset on every entry today and the fallback is the whole
        // behaviour — but the field stays, because the state it exists for is real and recurred once
        // already: `feedback` was named by row 7 and by nothing else for one pull request, and the
        // shipped tool told users the constitution named something it did not. A test asserts the
        // sentence now, which is what that round was missing.
        warn(`portulan: \`${name}\` is named in ${entry.namedIn ?? "docs/vision.md"} and is not built yet — it arrives at ${entry.arrives}.`);
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
