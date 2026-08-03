#!/usr/bin/env node
// `init` — the subcommand that drafts a workspace for a repository that has none.
//
// `docs/plan.md` row 7: *"`init` asks where this repository's workspace resides — in the repository,
// or in a workspace that names it — and writes a full workspace or a pointer accordingly."* That verb
// is the design. This tool has **no default residence**: the one thing the row says it asks is the one
// thing it may not decide, and the wrong guess is the dual-management shape
// `../.portulan/proposals/0017-one-repository-one-governing-workspace.md` exists to refuse.
//
// ## What it writes, and what it refuses to write
//
// It drafts. `docs/vision.md` carries *"No auto-generated curated context. `init` drafts; humans
// accept"* as a binding non-goal, so every file here is a starting point with the questions left
// visible in it — never a filled-in workspace that reads as finished. The two hard refusals:
//
// **It never overwrites a residence.** A repository already carrying a workspace or a pointer is
// governed, and replacing that is not onboarding — it is the switch, which `cli/vendor.mjs` carries as
// of 2026-08-03, when the maintainer widened `vendor`'s gloss and settled the verb he had deliberately
// left unassigned on 2026-07-31. So `init` stops, says which residence it found, and names the tool
// whose job the switch is.
//
// **It refuses rather than emitting a manifest a validator would misread.** A governor or a name that
// is not a slug is caught here, at the boundary, because `doctor`'s cross-repository check still
// mis-reports an empty governor as a *conflicting* one
// ([#141](https://github.com/sleepy-panda-works/portulan/issues/141)). That bug is `doctor`'s to fix;
// what this tool owes is that it can never be the thing that produced the input.
//
// ## Two capabilities this draft deliberately does not claim
//
// **The session-end gate is drafted as a binding, not as a wire — and the reason has CHANGED, so the
// paragraph is rewritten rather than left standing.** It used to be that `cli/compile.mjs` emitted a
// `Stop` hook naming `.portulan/compile/stop.mjs`, which was customer zero's own file and shipped in no
// published artifact, so a drafted workspace's compiled hook would have pointed at a file the adopter
// does not have — a gate existing only as a sentence, since a missing hook **fails open** (measured,
// CLI 2.1.220). That was the state the maintainer's 2026-07-31 ruling waited on: decide the runner's
// residence when there is a concrete mechanism to point at.
//
// **The mechanism now exists.** Both runners live in `cli/`, ship in the published package, and
// `compile` emits a path that resolves from a checkout and from a project-local install. What `init`
// still does not do is *run* `compile` over what it drafts — so a drafted workspace has the binding and
// no compiled hooks until its human runs `compile` themselves, which is the honest remaining gap and is
// what `cli/init.test.mjs` asserts.
//
// **The drafted README said the opposite for one pull request.** It told every adopter the runner "is not
// shipped in any artifact you have received" and that "nothing here compiles to a working Stop hook" —
// true before the runners moved, false the moment they did, and it survived a fourteen-carrier sweep
// because it describes the mechanism without naming the files the sweep was grepping for. The worst
// shape available: a false claim emitted into somebody else's tree, telling them a rail they now have is
// one they do not.
//
// **There is no interactive interview yet.** `docs/vision.md` glosses `init` as *interview + codebase
// scan*; what ships here is the non-interactive substrate — flags and `--answers` — because a prompt
// loop cannot be run by CI, by a test, or by a headless host, and the substrate is what an interview
// would drive. Whether the gloss is satisfied by asking through flags is the maintainer's call at
// milestone 7's close. Named here rather than left for a reader to discover.
//
// ## Exit codes
//
// `0` it wrote · `2` it could not run. There is deliberately **no 1**: this tool renders no verdict
// about anybody's workspace, so it has no red to report. `compile` documents the same asymmetry from
// the other side — writing never returns 1, because a run that rewrites an artifact has nothing to
// disagree with.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Every refusal in this file. Carrying a class rather than a string lets `run` map all of them to 2. */
export class InitError extends Error {}

// ONE definition of a slug, read from the contract that publishes it rather than written out again.
//
// A second copy here would be free to drift from `spec/workspace.schema.json`, and this tool's whole
// job at the boundary is to refuse exactly what that schema refuses. The read works in both layouts —
// from a checkout `spec/` is one level up from `cli/`, and the published package keeps that shape
// because `files` ships both under the package root.
//
// Unreadable is not fatal at import time, because a module that throws while loading gives the entry
// point nothing better than a stack trace. It becomes a could-not-run inside `run`, which is where a
// user can be told what is missing.
let SCHEMA_ERROR = null;
export const SLUG = (() => {
    try {
        const file = path.join(HERE, "..", "spec", "workspace.schema.json");
        return new RegExp(JSON.parse(fs.readFileSync(file, "utf8")).$defs.slug.pattern);
    } catch (error) {
        SCHEMA_ERROR = error;
        return null;
    }
})();

/** The Workspace Definition this tool writes against. A pointer needs 2.7 — the version that added it. */
const SPEC = "2.7";

/** The gate-policy spec `cli/compile.mjs` reads. Checked by its own suite, not guessed at here. */
const GATE_POLICY_SPEC = "2.2";

const RESIDENCES = new Set(["in-repo", "pointer"]);

/** The pack composed by default when the cycle is scaffolded. The workspace names it; core names none. */
const DEFAULT_CHECKPOINTS = "rituals/checkpoints";

// Every key an answers file may carry, and the flag each corresponds to. Declared as data because the
// file reader and the flag parser must agree about what an answer IS — two lists is how a `residnce`
// gets silently dropped and the tool then asks for something the adopter believes they supplied.
const ANSWER_KEYS = new Set(["residence", "name", "summary", "governed-by", "feed", "checkpoints", "cycle", "pack-root"]);

/**
 * A directory name, or any string, reduced to the schema's slug shape.
 *
 * Returns `null` rather than a fallback when nothing survives: a workspace called `workspace` because
 * the directory was `---` is a name nobody chose, and `init` asks instead.
 */
export function slugify(text) {
    const slug = String(text ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug === "" ? null : slug;
}

// ------------------------------------------------------------------------- the command line

/**
 * Splits argv into flags and the single target directory.
 *
 * Throws rather than returning a half-parsed shape: a flag whose value is missing must not silently
 * consume the next flag, which is the parsing bug that turns `--name --residence in-repo` into a
 * workspace named `--residence`.
 */
export function parseArgs(argv) {
    const flags = {};
    const targets = [];
    let help = false;

    const VALUED = new Set(["--residence", "--name", "--summary", "--governed-by", "--feed", "--checkpoints", "--answers", "--pack-root"]);

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--help" || arg === "-h") {
            help = true;
        } else if (arg === "--no-cycle") {
            flags.cycle = false;
        } else if (VALUED.has(arg)) {
            const value = argv[i + 1];
            // ANY leading `-` is a missing value, not `--` only. `cli/doctor.mjs` already guards this
            // way and `init` was the outlier: `init --residence -h <dir>` consumed `-h` as the
            // residence and then complained that `-h` is not one, which blames the user for a token
            // they typed as a flag. A help request is the likeliest thing to land here, and it was
            // the likeliest thing to be eaten. Found by review on the pull request.
            //
            // A value that genuinely begins with `-` is not lost: `--answers` carries it, where the
            // shape is a JSON string and nothing has to guess where a flag ends.
            if (value === undefined || value.startsWith("-")) {
                throw new InitError(
                    `\`${arg}\` needs a value and the next argument is \`${value ?? "(nothing)"}\` — refusing to read a ` +
                        `flag as one. If the value really does start with \`-\`, pass it through \`--answers\`, where it ` +
                        `is a JSON string and nothing has to guess.`,
                );
            }
            // An EMPTY value is given-but-invalid, and it is refused here for every flag rather than
            // per-field. `--summary ""` used to pass straight through `??` into the manifest, where
            // the schema's `minLength: 1` made `doctor` red on a workspace `init` had just reported
            // writing successfully — the one outcome this tool exists to make impossible. No flag
            // here has a meaningful empty value, so one rule covers all of them.
            if (value.trim() === "") {
                throw new InitError(
                    `\`${arg}\` was given an empty value. Every answer this tool writes into a manifest has to be ` +
                        `non-empty — an empty one validates nowhere — so it is refused rather than treated as unasked.`,
                );
            }
            const key = arg.slice(2);
            if (key === "pack-root") (flags["pack-root"] ??= []).push(value);
            else flags[key] = value;
            i++;
        } else if (arg.startsWith("-")) {
            // #155: this said "run `init --help`", which is not a command anybody can run. The tool is
            // genuinely reachable two ways and the honest string differs per invocation, so both are
            // named rather than one being derived — deriving it would mean the entry point telling the
            // subcommand what name it was invoked under, and that entry point deliberately passes argv
            // and nothing else, so the tool behaves identically either way. A better sentence is not
            // worth trading that property for. The same fix is applied to `usage()` below.
            throw new InitError(
                `unknown option \`${arg}\` — run \`portulan init --help\` for the ones this understands, ` +
                    `or \`node cli/init.mjs --help\` from a checkout`,
            );
        } else {
            targets.push(arg);
        }
    }

    if (targets.length > 1) {
        throw new InitError(
            `${targets.length} target directories given (${targets.join(", ")}) — \`init\` drafts one workspace for one ` +
                `repository, and picking one of two would be choosing which repository gets governed`,
        );
    }

    return { help, flags, target: targets[0] ?? null };
}

/**
 * Merges an `--answers` file under the flags, and refuses anything it does not recognise.
 *
 * The nearer answer wins: a flag typed on the command line overrides the same key in the file, which
 * is the resolution cascade's own direction — more specific beats more general.
 */
export function resolveAnswers(flags) {
    let fromFile = {};
    if (flags.answers) {
        let raw;
        try {
            raw = fs.readFileSync(flags.answers, "utf8");
        } catch (error) {
            throw new InitError(`could not read the answers file \`${flags.answers}\` — ${error.message}`);
        }
        try {
            fromFile = JSON.parse(raw);
        } catch (error) {
            throw new InitError(`the answers file \`${flags.answers}\` is not valid JSON — ${error.message}`);
        }
        if (!fromFile || typeof fromFile !== "object" || Array.isArray(fromFile)) {
            throw new InitError(`the answers file \`${flags.answers}\` must hold a JSON object of answers`);
        }
        // Refused rather than ignored, on the schema's own `additionalProperties: false` reasoning: the
        // common case is a typo, and a silently-dropped answer leaves the tool asking for something the
        // adopter believes they gave.
        const unknown = Object.keys(fromFile).filter((key) => !ANSWER_KEYS.has(key));
        if (unknown.length) {
            throw new InitError(
                `the answers file carries ${unknown.map((k) => `\`${k}\``).join(", ")}, which is not an answer this tool asks for ` +
                    `(it asks: ${[...ANSWER_KEYS].join(", ")}). A misspelt key is an answer nobody receives.`,
            );
        }
        // The VALUES are checked too, not only the keys. Lecturing about a misspelt key while
        // accepting `"cycle": "false"` — a truthy string that composes the pack the adopter was
        // trying to switch off — checks the half that is easy to check and lets the half that
        // changes behaviour through.
        for (const [key, value] of Object.entries(fromFile)) {
            const expected = key === "cycle" ? "boolean" : "string";
            const actual = Array.isArray(value) ? "array" : typeof value;
            const arrayOk = key === "pack-root" && Array.isArray(value) && value.every((v) => typeof v === "string" && v.trim() !== "");
            if (arrayOk) continue;
            if (actual !== expected) {
                throw new InitError(
                    `the answers file gives \`${key}\` as ${actual === "array" ? "an array" : `a ${actual}`} (${JSON.stringify(value)}), ` +
                        `and this tool reads it as ${expected === "boolean" ? "a boolean" : "a string"}. \`"cycle": "false"\` is a ` +
                        `non-empty string, which is true — the answer would do the opposite of what it reads as.`,
                );
            }
            if (expected === "string" && value.trim() === "") {
                throw new InitError(`the answers file gives \`${key}\` as an empty string, which validates nowhere — refused rather than read as unasked`);
            }
        }
    }

    const merged = { ...fromFile };
    for (const [key, value] of Object.entries(flags)) {
        if (key === "answers") continue;
        merged[key] = value;
    }

    // WHICH keys were actually supplied, kept apart from what they resolved to. `cycle` and
    // `checkpoints` have defaults, so their values cannot tell a caller who typed them from a caller
    // who did not — and the residence check below must refuse only what somebody asked for. A
    // default that triggered a refusal would be the tool objecting to its own choice.
    const given = new Set(Object.keys(merged));

    return {
        given,
        residence: merged.residence ?? null,
        name: merged.name ?? null,
        summary: merged.summary ?? null,
        governedBy: merged["governed-by"] ?? null,
        feed: merged.feed ?? null,
        checkpoints: merged.checkpoints ?? DEFAULT_CHECKPOINTS,
        cycle: merged.cycle !== false,
        // NORMALISED to an array, because the two sources disagree about shape. The flag is
        // repeatable and accumulates into one; an answers file may reasonably give a single string,
        // which the value check above accepts as a string like every other key. Everything
        // downstream — `.length`, `.map`, `packResolves`'s `.some` — is array-shaped, so a string
        // reaching here turned a perfectly valid answers file into `roots.some is not a function`:
        // a real answer, refused with a message about somebody else's bug. Found by review on the
        // pull request. Normalising here rather than at each use keeps one shape after this line.
        packRoots: [merged["pack-root"] ?? []].flat(),
    };
}

/** Everything that must be true before a single byte is written. Each refusal names what to type. */
export function validateAnswers(answers) {
    if (!answers.residence) {
        throw new InitError(
            "no residence given — `init` asks where this repository's workspace lives and will not choose for you. " +
                "Pass `--residence in-repo` to write a full workspace into this repository, or `--residence pointer` " +
                "with `--governed-by <workspace>` to record that another workspace governs it. A repository is " +
                "governed by exactly one workspace, so this answer is the one that cannot be defaulted.",
        );
    }
    if (!RESIDENCES.has(answers.residence)) {
        throw new InitError(`\`${answers.residence}\` is not a residence — the two are \`in-repo\` and \`pointer\``);
    }
    if (answers.name !== null && !SLUG.test(answers.name)) {
        throw new InitError(
            `the workspace name \`${answers.name}\` is not a slug — lowercase letters, digits and single hyphens ` +
                `(${SLUG.source}). A workspace ships as a plugin through a feed, so its name is an identifier rather than a title.`,
        );
    }
    // ACCEPTED-BUT-IGNORED is refused, because this file's header claims it refuses what it cannot
    // act on and that claim has to be true. `--feed` and `--governed-by` mean nothing to a full
    // workspace; `--pack-root`, `--checkpoints` and `--no-cycle` mean nothing to a pointer, which
    // composes nothing. Silently dropping them lets a caller — or an answers file nobody re-reads —
    // believe an option had an effect it never had, which is the same defect as `--summary ""`
    // reaching a manifest: an answer accepted and then not honoured. Found by review on the pull
    // request. Keyed on what was GIVEN, never on the resolved value, so a default never trips it.
    const misplaced = {
        "in-repo": ["feed", "governed-by"],
        pointer: ["pack-root", "checkpoints", "cycle"],
    }[answers.residence].filter((key) => answers.given.has(key));
    if (misplaced.length) {
        const spelling = (key) => (key === "cycle" ? "`--no-cycle`" : `\`--${key}\``);
        throw new InitError(
            `${misplaced.map(spelling).join(" and ")} ${misplaced.length > 1 ? "do" : "does"} nothing with ` +
                `\`--residence ${answers.residence}\` — ${
                    answers.residence === "pointer"
                        ? "a pointer holds no policy of its own, so it composes no packs"
                        : "a workspace that lives here has no governor and no feed to be delivered from"
                }. Refused rather than ignored: an option accepted and then dropped is one you will believe had an effect.`,
        );
    }

    if (answers.residence === "pointer") {
        // Absent and invalid are different answers and take different refusals: telling an adopter
        // who typed a malformed governor to pass the flag they just passed sends them to the wrong
        // place. The EMPTY spelling never reaches here — the command line refuses it earlier, where
        // the clearer sentence lives — so this branch is the omission and the one below is the
        // malformation. Both matter because an empty or non-string governor is exactly the value
        // `doctor` still mis-reports as a *conflicting* one (#141).
        if (answers.governedBy === null) {
            throw new InitError(
                "a pointer must name the workspace that governs this repository — pass `--governed-by <workspace>`. " +
                    "A pointer that names nothing governs nothing, and is indistinguishable from a repository that " +
                    "never adopted Portulan.",
            );
        }
        if (!SLUG.test(answers.governedBy)) {
            throw new InitError(
                `the governing workspace \`${answers.governedBy}\` is not a slug — lowercase letters, digits and single ` +
                    `hyphens (${SLUG.source}). It must be spelled exactly as that workspace's own \`name\`, or the pointer ` +
                    `and its target have drifted into two identifiers.`,
            );
        }
    }
    if (answers.residence === "in-repo" && answers.cycle) {
        const parts = String(answers.checkpoints).split("/");
        if (parts.length !== 2 || !parts.every((part) => SLUG.test(part))) {
            throw new InitError(
                `\`${answers.checkpoints}\` is not a pack id — a pack is \`<category>/<name>\`, each a slug, as ` +
                    `\`spec/pack.schema.json\` defines it. Composing an id nothing can resolve would put a red in the ` +
                    `adopter's first run for a reason they did not cause.`,
            );
        }
    }
}

// ------------------------------------------------------------------------- the codebase scan

/**
 * Reads what the repository actually says about itself. **Observations only.**
 *
 * The failure an onboarding tool is most likely to commit is the confident default: emitting
 * `make test` because most repositories have one. `doctor` lints repo-card build and test claims
 * against the tree, so an invented claim is a red the adopter did not cause — and, worse, a workspace
 * that lies about them on the day it was created. Every field here is either read out of a file that
 * exists or left `null`, and `null` is written into the draft as *not determined* rather than dropped.
 */
export function scan(dir) {
    const observed = { stack: [], build: null, test: null, run: null, name: null, vcs: null, evidence: [] };
    const has = (rel) => fs.existsSync(path.join(dir, rel));
    const read = (rel) => {
        try {
            return fs.readFileSync(path.join(dir, rel), "utf8");
        } catch {
            return null;
        }
    };

    if (has(".git")) {
        observed.vcs = "git";
        observed.evidence.push(".git/");
    }

    if (has("package.json")) {
        observed.stack.push("node");
        observed.evidence.push("package.json");
        let manifest = null;
        try {
            manifest = JSON.parse(read("package.json"));
        } catch {
            // A package.json that does not parse is evidence of node and evidence of nothing else. It
            // is not this tool's business to fix it, and reading scripts out of a guess would be the
            // invented claim this whole function exists to avoid.
        }
        if (manifest && typeof manifest === "object") {
            if (typeof manifest.name === "string") observed.name = manifest.name;
            const scripts = manifest.scripts ?? {};
            if (typeof scripts.test === "string") observed.test = scripts.test;
            if (typeof scripts.build === "string") observed.build = scripts.build;
            if (typeof scripts.start === "string") observed.run = scripts.start;
        }
    }

    const makefile = read("Makefile") ?? read("makefile");
    if (makefile !== null) {
        observed.stack.push("make");
        observed.evidence.push("Makefile");
        // A target that exists is an observation; `make test` on a Makefile with no `test:` target is
        // a guess, and would fail for the adopter the first time they ran it.
        for (const [target, key] of [["test", "test"], ["build", "build"], ["run", "run"]]) {
            if (observed[key] === null && new RegExp(`^${target}\\s*:`, "m").test(makefile)) observed[key] = `make ${target}`;
        }
    }

    for (const [file, stack] of [["pyproject.toml", "python"], ["Cargo.toml", "rust"], ["go.mod", "go"]]) {
        if (has(file)) {
            observed.stack.push(stack);
            observed.evidence.push(file);
        }
    }

    return observed;
}

// ------------------------------------------------------------------------- the draft

/**
 * Decides the whole file set and returns it. **Writes nothing.**
 *
 * The split from writing is what keeps every refusal ahead of the first byte on disk: a tool that
 * decides while writing has no state left in which it can still refuse. It also makes the shape
 * testable without a filesystem, which is why almost every assertion in the suite is cheap.
 *
 * @returns {Map<string, {contents: string, mode?: number}>} keyed by path relative to the target
 */
export function draft(answers, observed) {
    return answers.residence === "pointer" ? draftPointer(answers) : draftWorkspace(answers, observed);
}

function json(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}

function draftPointer(answers) {
    const files = new Map();

    // Exactly the five keys `doctor` permits a pointer, and no others. Anything more is not a
    // cosmetic defect here — it is the dual-management refusal, and the adopter's first run is red.
    const manifest = {
        portulan: { spec: SPEC },
        name: answers.name ?? "workspace",
        summary: answers.summary ?? `This repository is governed by the \`${answers.governedBy}\` workspace.`,
        kind: "pointer",
        governed_by: answers.feed ? { workspace: answers.governedBy, feed: answers.feed } : { workspace: answers.governedBy },
    };
    files.set(".portulan/workspace.json", { contents: json(manifest) });

    files.set(".portulan/README.md", {
        contents: `# This repository's workspace lives elsewhere

This directory holds a **pointer**, not a workspace. It records one fact: the \`${answers.governedBy}\`
workspace governs this repository${answers.feed ? `, and ships through the \`${answers.feed}\` feed` : ""}.

A repository is governed by **exactly one** workspace — it carries its own full workspace, or a pointer
to the workspace that names it, never both. Two policy layers for one repository is not redundancy; it
is an agent booting on the wrong gates and looking exactly like success.

## What you get here, and what you do not

Every Portulan feature keys to a workspace **slot**, never to a residence, so nothing is lost by
governing this repository from elsewhere. One step is real and is named rather than claimed away:
**a host does not discover the governing workspace on its own.** The workspace has to be installed
before anything boots against it, and no tool here fetches it — reading this pointer and resolving it
are different things, and only the first is built.

## Moving back

If this repository should carry its own workspace instead, that is a **switch**, not a re-run of
\`init\`: the workspace is materialised in the new residence, a pointer or nothing is left in the old
one, and validation is green at both ends *before* the old residence is retired.

From this repository's root, with the \`${answers.governedBy}\` workspace checked out somewhere you can
name — nothing here fetches it:

\`\`\`
portulan vendor <path to the ${answers.governedBy} workspace> --into .portulan --residence in-repo --switch
\`\`\`

Run that rather than deleting this file and writing a workspace by hand — the window between those two
acts is a repository governed by nothing, which looks identical to a repository that never adopted
Portulan.

## Curate this

\`init\` drafted this file. The \`summary\` in \`workspace.json\` is a placeholder; make it say what
this repository is, in the one line an agent reads before loading anything else.
`,
    });

    return files;
}

function draftWorkspace(answers, observed) {
    const files = new Map();
    const name = answers.name ?? "workspace";

    const manifest = {
        portulan: { spec: SPEC },
        name,
        summary: answers.summary ?? `The ${name} workspace — drafted by \`init\`, and not yet curated.`,
        kind: "repository",
        // A `repository` workspace must declare `tree`: it is the policy layer of a repository that is
        // present, so it has an answer, and without one every repo-card and gate-map claim silently
        // degrades from checked to unverifiable. The constraint is `doctor`'s rather than the schema's,
        // which makes it exactly the kind a generator forgets.
        tree: "../",
        gates: "gates.json",
        slots: {
            identity: "identity.md",
            principles: "principles.md",
            gates: "gate-map.md",
            dod: "dod.md",
            handoffs: "handoffs/",
        },
        verify: {
            default: "workspace",
            recipes: [
                {
                    id: "workspace",
                    run: "./.portulan/verify/workspace.sh",
                    requires: ["bash"],
                    doc: "verify/README.md",
                },
            ],
        },
        // Sited OUTSIDE the series it indexes: an index living in `handoffs/` would be counted as a
        // handoff by everything that walks the directory.
        handoffs: { index: { path: "handoffs-index.md" } },
    };
    if (answers.cycle) manifest.packs = [answers.checkpoints];

    files.set(".portulan/workspace.json", { contents: json(manifest) });
    files.set(".portulan/gates.json", { contents: json(draftPolicy()) });
    files.set(".portulan/README.md", { contents: draftReadme(answers, observed, name) });
    files.set(".portulan/identity.md", { contents: draftIdentity(observed, name) });
    files.set(".portulan/principles.md", { contents: draftPrinciples(name) });
    files.set(".portulan/gate-map.md", { contents: draftGateMap() });
    files.set(".portulan/dod.md", { contents: draftDod() });
    files.set(".portulan/verify/README.md", { contents: draftVerifyReadme() });
    files.set(".portulan/verify/workspace.sh", { contents: draftRecipe(), mode: 0o755 });
    // A Map of files cannot express an empty directory and git does not track one, so the slot's
    // directory is created by a file that says why it is there.
    files.set(".portulan/handoffs/.gitkeep", {
        contents: "# The handoff series. One dated record per session; filenames lead with YYYY-MM-DD.\n",
    });

    return files;
}

function draftPolicy() {
    return {
        portulan: { spec: GATE_POLICY_SPEC },
        why: "gate-map.md",
        // A floor is drafted with no required checks, deliberately. `doctor` FAILS a floor requiring a
        // status check no workflow job in the tree reports — so a draft naming the checks this
        // repository has not written yet would put a red in the adopter's first run and teach them the
        // tool guesses. The branch is the answer nearly every repository shares; the checks are theirs.
        floor: {
            branch: "main",
            checks: [],
            reviews: 0,
            resolve_conversations: true,
        },
        rules: [
            // The two rules below are the ones the FLOOR backend can actually compile — a policy
            // whose floor no rule reaches is refused outright, so a starter policy that declared a
            // floor and gated only `gh pr merge` would put a hard red in the adopter's very first
            // run. Found by running the real validator against a real draft rather than by reading
            // the compiler. They are also the right two to start with: both destroy a ref rather
            // than adding one, which is the property that puts them above the line.
            {
                id: "force-push-without-a-lease",
                tier: "gated",
                action: { shell: "git push --force" },
                reason: "A bare force-push to a shared remote can silently discard commits that arrived since you last fetched, and that is the one part of pushing which is not recoverable in a working copy. Use `--force-with-lease`, which refuses the push if the remote moved.",
            },
            {
                id: "delete-a-remote-branch",
                tier: "gated",
                action: { shell: "git push --delete" },
                reason: "Deleting a branch on a shared remote destroys a ref rather than adding one. It is the single push spelling whose damage outlives the working copy.",
            },
            {
                id: "merge-a-pull-request",
                tier: "gated",
                action: { shell: "gh pr merge" },
                reason: "An agent never decides for itself that a change is ready to land. A commit enters the repository's record here, and that decision is a human's.",
            },
            {
                id: "edit-the-workspace",
                tier: "propose",
                action: { write: ".portulan/" },
                reason: "This workspace is the layer that decides gates, lanes and the bar for done. Changing it by pull request is what keeps an agent from widening its own permissions in the same change it uses them.",
            },
            {
                id: "edit-on-a-working-branch",
                tier: "auto",
                action: { write: "./" },
                reason: "Creating and editing files on a working branch is unattended. What makes it safe is the gate on landing, not the edit.",
            },
        ],
    };
}

function draftReadme(answers, observed, name) {
    const bound = answers.cycle
        ? `This workspace composes the \`${answers.checkpoints}\` pack, which carries the three checkpoint
skills — session-open, pre-commit, milestone-close — and the supervisor persona that staffs them.`
        : `This workspace composes no packs: \`init\` was run with \`--no-cycle\`. The checkpoint ritual is
the one most teams want first; add it to \`packs\` in \`workspace.json\` when you do.`;

    return `# ${name} — a drafted workspace

\`init\` wrote every file in this directory. **None of it is finished**, and that is deliberate: agents
may draft this layer and may never own it. Read each file, delete what does not describe your team, and
replace the placeholders. A workspace you have not curated is a workspace that makes an agent work
*generically* — which is the one thing it exists to prevent.

## Where to start

1. **\`identity.md\`** — who you are, your stack, your glossary. It is the first thing an agent reads
   after the kernel, and the scan below could only observe so much.
2. **\`principles.md\`** — the handful of rules that are yours rather than everyone's. Placeholders
   until you write them.
3. **\`verify/workspace.sh\`** — **this exits 2 (could not run) until you edit it.** It cannot report
   green, because nobody has told it what green means for this repository. That is the honest state, not
   a bug: "nothing looked" must never read as "nothing wrong."
4. **\`gate-map.md\` and \`gates.json\`** — ${draftPolicy().rules.length} starter rules and a platform
   floor with no required checks. Add your checks once your CI reports them; a floor requiring a check
   no job reports blocks every pull request.

## The cycle this drafts

${bound}

**What is bound and what is not, stated plainly** — because a workspace that overstates its own rails
is worse than one with fewer of them.

- **The pack is named, and nothing resolves it.** Naming a pack and finding it on this machine are
  different things, and only the first is built. **Until you supply a location, validation is RED**,
  not merely unverified: \`doctor\` fails a declared pack it cannot resolve rather than passing over
  it. Run it with the root named — \`doctor --pack-root <dir> .portulan\` — or run \`init\` with
  \`--no-cycle\` and compose the pack later, once you know where it lives.
- **The records conventions are drafted** — a \`handoffs/\` directory in the \`handoffs\` slot, and the
  manifest declares where a generated index goes. **That index does not exist yet**: it is generated
  from the series by the \`index\` tool, and this draft does not run it, so the file appears the first
  time you do. The freshness rail is what a verify recipe of yours would compare it against.
- **The session-end gate is wired by \`compile\`, and this draft has not run it.** The runner that
  enforces "a handoff dated today exists" before a session ends **does** ship in the package you have —
  it is \`cli/stop-gate.mjs\` — and \`portulan compile\` emits a \`Stop\` hook naming it. What this
  draft does is bind the ritual and the records conventions; running \`compile\` is the step that turns
  them into enforcement, and it is yours to run because compiling writes host settings and that is not
  a thing a scaffold should do to your machine unasked. **Until you run it**, treat the session-end
  handoff as a practice your team holds rather than a rail — a rule nothing checks is worth exactly
  what you can remember about it.

## What the scan observed

${observed.evidence.length ? observed.evidence.map((e) => `- \`${e}\``).join("\n") : "- Nothing it recognised. Every claim in `identity.md` is yours to write."}

Only what is listed above was read. Anything \`identity.md\` marks *not determined* was left blank
rather than guessed at — an invented build command is worse than an absent one, because the workspace
then disagrees with the repository on the day it was created.
`;
}

function draftIdentity(observed, name) {
    const unknown = "_Not determined by the scan — fill this in._";
    const row = (label, value) => `| ${label} | ${value ? `\`${value}\`` : unknown} |`;

    return `# Identity — ${name}

> Who this team is, what it builds with, and what its words mean. The first thing an agent reads after
> the kernel, so keep it short and keep it true. \`init\` drafted this from what it could observe; every
> line marked *not determined* was left blank rather than guessed at.

## The team

${unknown} — how many people, what they own, how they work.

## The stack

${observed.stack.length ? observed.stack.map((s) => `- \`${s}\``).join("\n") : unknown}

## Commands

| What | Command |
|---|---|
${row("Build", observed.build)}
${row("Test", observed.test)}
${row("Run", observed.run)}

${
    observed.build || observed.test || observed.run
        ? "These were read out of files in this repository, not inferred. Correct them if they are stale."
        : "The scan found no command written down anywhere it looked. Write them here; anything else would be a guess."
}

## Glossary

${unknown} — the words your team uses that a newcomer would misread. This section earns its place the
first time an agent gets one wrong.

## Write the limit, not the aspiration

Where something is not true yet, say so here rather than describing the intended state. A document that
claims a capability the tree does not have is the defect this section exists to prevent.
`;
}

function draftPrinciples(name) {
    return `# Principles — ${name}

> The rules that are **yours** rather than everyone's. Core already carries the universal ones; this
> file is what makes an agent work *this* team's way. \`init\` cannot draft these — they are the part
> no scan can observe and no generator should invent.

Three questions worth answering here, in your own words:

1. **What do you refuse to trade away?** Every team has one — a latency budget, a review depth, a
   dependency policy, an accessibility floor. Name it, and say what it costs, because a principle with
   no cost is a preference.
2. **What has gone wrong more than once?** The rule that would have caught it belongs here, with a link
   to the incident. A rule with no provenance cannot be retired later, because nobody can tell whether
   the thing it guards against can still happen.
3. **Where does this team differ from the obvious default?** That difference is the whole reason this
   file exists rather than a link to someone's style guide.

_Delete this list once you have replaced it. A workspace whose principles slot still holds the prompt
is a workspace nobody has curated._
`;
}

function draftGateMap() {
    return `# Gate map

> The **policy** half of the engine's autonomy model. Core defines the tiers — Auto, Propose, Gated,
> Prohibited — as universal mechanism; this file binds *your* concrete actions to them, because which
> action is dangerous is a property of a team, not of an engine.
>
> **\`gates.json\` is the policy; this file is the rationale.** Where they disagree, the JSON wins — it
> is the one that compiles.

## The tiers, bound

### Auto — the agent acts unattended

Recoverable, reversible, and it puts nothing in front of anyone.

- \`edit-on-a-working-branch\` — create and edit files on a working branch.

### Propose — the agent drafts; a human decides

- \`edit-the-workspace\` — anything under \`.portulan/\`, including this file and the policy beside it.

### Gated — the agent asks first, every time

- \`force-push-without-a-lease\` — a bare \`--force\` can discard commits that arrived since you fetched.
  \`--force-with-lease\` is the spelling that refuses when the remote moved.
- \`delete-a-remote-branch\` — destroys a ref rather than adding one.
- \`merge-a-pull-request\` — a change enters the record here, and that decision is a human's.

### Prohibited — no role acts here

Nothing yet. Add what must never happen regardless of who asks.

## The platform floor

Branch protection on \`main\`, with conversation resolution required and **no required status checks
declared yet**. Add your checks to \`floor.checks\` in \`gates.json\` once your CI reports them — a floor
requiring a check no job reports blocks every pull request, which is why \`init\` declared none.

The two Gated ref rules above are what this floor compiles from: they become \`non_fast_forward\` and
\`deletion\` on \`refs/heads/main\`. Note the coarseness in the honest direction — \`non_fast_forward\`
blocks **every** force-push, including \`--force-with-lease\`, which the policy above classifies Auto. A
ref rule gates a ref and cannot read a command's flags.

Until \`floor.checks\` is declared, \`edit-the-workspace\` and every other Propose rule compiles to
nothing in this backend: requiring a pull request while requiring nothing green of it reads as a floor
and is not one.

The floor is the layer indifferent to how a command was spelled. Everything above depends on a host
honouring a permission rule; this does not.

## The triage threshold

${"_Not set._"} Where does small work stop needing ceremony? Answer it here, in a sentence a person can
apply without asking. Left unset, every rule above applies to a one-line fix, and a ritual that cannot
scale down gets switched off wholesale rather than tuned.
`;
}

function draftDod() {
    return `# Definition of done

> Core supplies the floor: green verify, and never report done on what you could not explain. A
> workspace may **extend** that floor and may never lower it. These are the additional conditions for
> work here — each one you add should carry the reason it exists, or nobody can tell later whether it
> still earns its place.

A change is done when **all** of the following hold.

1. **The verify recipe ran green in this working copy.** Not "should pass" — run it and read the
   output. _Why: this is the only condition whose evidence is a machine's rather than a person's._
2. **You could walk a reviewer through every line.** _Why: core's bar, and the one most often skipped
   when a diff is mostly prose — prose reviews as "fine" far more easily than code does._

_Add yours below. Two are enough to start; a list nobody can hold in their head is a list that gets
skimmed. Each condition should be checkable by someone who was not in the room._
`;
}

function draftVerifyReadme() {
    return `# verify/

The executable half of *done*. \`workspace.json\` declares the recipes and names the default.

**Nothing runs them for you yet, and that is worth knowing before you trust a green.** In this
repository there is no Stop-gate wired — see \`../README.md\` — and \`init\` writes no CI workflow, so
these recipes run when a person runs them. The design is that the default recipe is what a session-end
gate and a pull-request check both call; both of those are things you wire, and until you do, a recipe
is a command in a file.

| Recipe | What it checks |
|---|---|
| \`workspace\` | **Nothing yet — it exits 2.** Replace it with the command that tells you this repository is healthy. |

## The three exit codes, and why the middle one is not enough

- **0 — green.** Everything this recipe checks passed.
- **1 — red.** Something it checks failed. A verdict about the repository.
- **2 — could not run.** A precondition was missing: a tool absent, a file unreadable, nothing to
  check. **This is not a pass.** A recipe that returns 0 because it found nothing to look at reports
  "nothing wrong" when the truth is "nothing looked", and every gate downstream believes it.

The drafted recipe exits 2 for exactly that reason. It is not broken; it is honest about not yet
knowing what green means here.
`;
}

function draftRecipe() {
    return `#!/usr/bin/env bash
# Workspace verify recipe — REPLACE THIS.
#
# This is a draft. It runs nothing and exits 2 (could not run), because nobody has yet told it what
# "green" means for this repository. That is deliberate and it is not a placeholder to be deleted: a
# stub exiting 0 would report "nothing wrong" when the truth is "nothing looked", and the Stop-gate,
# CI, and every human reading a green check would believe it.
#
# Replace the body with the command that actually verifies this repository — the test suite, the
# linter, the build, whatever your team already trusts — and keep the three codes:
#
#   exit 0   green: everything this checks passed
#   exit 1   red: something it checks failed
#   exit 2   could not run: a precondition was missing. Never a pass.

set -uo pipefail

printf 'verify: this workspace has not declared what green means yet.\\n' >&2
printf 'verify: edit .portulan/verify/workspace.sh — see .portulan/verify/README.md\\n' >&2
exit 2
`;
}

// ------------------------------------------------------------------------- writing

/**
 * The residence already present in a target, if any.
 *
 * An unreadable manifest returns `unreadable` rather than `none`, and the distinction is the whole
 * point: reading a parse failure as "no workspace here" would make a corrupt manifest the one case
 * where this tool overwrites — the case where it knows least and where overwriting costs most.
 */
export function residenceAt(target) {
    // The path to the manifest is walked with `lstatSync` BEFORE anything is read, and that order is
    // the whole of it. This function used `existsSync`/`readFileSync`, which follow symlinks — so a
    // repository with a `.portulan` symlink pointing at somebody else's workspace made `init` read a
    // manifest OUTSIDE the target and announce *"this repository already carries a `repository`
    // workspace"*, naming a workspace that is not in this repository at all. Two failures in one
    // sentence: an out-of-repo read, and a refusal that misdescribed what it found.
    //
    // It also ran ahead of the symlink-aware collision check, so the containment guarantee that check
    // exists to give was reachable only when this function happened not to fire first. A guarantee
    // that depends on which check runs first is not a guarantee. Found by review on the pull request,
    // as the follow-up to the escape it is the other half of.
    let here = target;
    for (const segment of [".portulan", "workspace.json"]) {
        here = path.join(here, segment);
        let stat;
        try {
            stat = fs.lstatSync(here);
        } catch (error) {
            // ONLY `ENOENT` means "nothing here". Every other error — EACCES above all — means the
            // question could not be answered, and answering "no residence" to a question that could
            // not be answered is the fail-open this repository names more often than any other:
            // "nothing looked" reported as "nothing wrong". A permission error here would have let
            // `init` proceed to write into a directory it could not even stat.
            if (error.code === "ENOENT") return { state: "none" };
            // `kind` is carried because the two ways of being unreadable need DIFFERENT sentences.
            // Telling somebody with a permissions problem to "repair the JSON" is a refusal that
            // misdescribes what it found — the defect the read-side symlink fix was about, arriving
            // one round later in the message rather than in the check.
            return { state: "unreadable", kind: "io", why: error.message };
        }
        if (stat.isSymbolicLink()) return { state: "symlink", where: path.relative(target, here) };
    }
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(here, "utf8"));
    } catch (error) {
        return { state: "unreadable", kind: "parse", why: error.message };
    }
    return { state: "present", kind: parsed?.kind ?? "unknown", name: parsed?.name ?? null };
}

function packResolves(roots, packId) {
    return roots.some((root) => fs.existsSync(path.join(root, packId, "pack.json")));
}

/**
 * Every path in the draft that cannot be written without destroying or being blocked by something.
 *
 * The residence check above keys on the MANIFEST, which is right for "is this repository governed?"
 * and wrong for "is it safe to write here?". A `.portulan/` holding a hand-written `gate-map.md` and
 * no manifest is not a residence — and the first version of this tool silently replaced that file.
 * The two questions are separate and both have to be asked.
 *
 * Blocked ancestors are the same check from the other side: a `verify` that is a *file* makes
 * `verify/README.md` unwritable, and finding that out halfway through the write loop is how a run
 * leaves a torso behind.
 */
export function collisions(target, files) {
    const found = [];
    for (const rel of files.keys()) {
        // Walked from the target DOWN, one segment at a time, with `lstatSync` — never `statSync`,
        // and never `existsSync`. Both of those FOLLOW symlinks, which is how the first version of
        // this check let a `.portulan` symlink carry the whole drafted workspace out of the
        // repository: `init` wrote nine files somewhere else entirely and reported success.
        // Demonstrated on the pull request. `doctor` and `plugin-lint` already treat a symlink escape
        // as significant; this is the same rule arriving at the tool that WRITES, where it matters
        // more than at the tools that read.
        //
        // A symlink anywhere on the chain is a collision rather than something to resolve and permit.
        // Resolving it would mean deciding whether the destination is "really" inside the repository,
        // which is a containment judgement with a bad failure mode; refusing is a judgement with none.
        const segments = rel.split("/");
        let here = target;
        for (let i = 0; i < segments.length; i++) {
            here = path.join(here, segments[i]);
            let stat;
            try {
                stat = fs.lstatSync(here);
            } catch (error) {
                if (error.code === "ENOENT") {
                    // Absent — and nothing below an absent directory can exist either, so this path
                    // is clear and the walk stops.
                    break;
                }
                // Anything else — EACCES above all — means this path's state is UNKNOWN, and an
                // unknown is not a clear. Declaring it clear would let the write loop start on the
                // strength of a question nobody could answer, which is precisely the guarantee this
                // function exists to give. Reported as a collision so the run refuses.
                found.push({ rel, why: `\`${path.relative(target, here)}\` could not be examined (${error.code})` });
                break;
            }
            const where = path.relative(target, here);
            if (stat.isSymbolicLink()) {
                found.push({ rel, why: `\`${where}\` is a symlink, and writing through it would leave the repository` });
                break;
            }
            if (i === segments.length - 1) {
                found.push({ rel, why: "already exists" });
                break;
            }
            if (!stat.isDirectory()) {
                found.push({ rel, why: `\`${where}\` is in the way and is not a directory` });
                break;
            }
        }
    }
    return found;
}

// ------------------------------------------------------------------------- the entry point

export function usage() {
    return [
        "portulan init — draft a workspace for a repository that has none",
        "",
        // Both spellings, for #155's reason: the tool is reachable through the entry point and from a
        // checkout, and a usage line naming only one of them is wrong for whoever arrived the other way.
        "  portulan init [options] <repository-directory>",
        "  node cli/init.mjs [options] <repository-directory>      (from a checkout)",
        "",
        "  --residence <in-repo|pointer>  REQUIRED. Where this repository's workspace lives:",
        "                                 in the repository, or in a workspace that names it.",
        "                                 There is no default — this is the question init asks.",
        "  --governed-by <workspace>      Required with `pointer`: the governing workspace's name.",
        "  --feed <name>                  Optional, pointer only: the feed it ships through.",
        "  --name <slug>                  The workspace's name. Defaults to the directory's.",
        "  --summary <text>               One line an agent reads before loading anything else.",
        "  --checkpoints <category/name>  The checkpoint pack to compose. Default: " + DEFAULT_CHECKPOINTS + ".",
        "  --no-cycle                     Compose no packs. The binding is opt-out, not opt-in.",
        "  --pack-root <dir>              Where packs are looked up, so the composed one can be",
        "                                 confirmed to exist. Named, never discovered. Repeatable.",
        "  --answers <file>               A JSON object of answers. Flags override its keys.",
        "",
        "Exit codes: 0 it wrote · 2 it could not run. There is no 1: init renders no verdict.",
        "",
        "There is no interactive interview yet — the answers arrive as flags or as `--answers`.",
        "The substrate an interview would drive is what ships today; the prompt loop does not.",
    ].join("\n");
}

export async function run(argv, options = {}) {
    const say = options.say ?? ((line) => process.stdout.write(`${line}\n`));
    const warn = options.warn ?? ((line) => process.stderr.write(`${line}\n`));

    try {
        if (SLUG === null) {
            throw new InitError(
                `could not read spec/workspace.schema.json, which defines what a valid name is — ${SCHEMA_ERROR?.message}. ` +
                    `Refusing to write a manifest it cannot check.`,
            );
        }

        const parsed = parseArgs(argv);
        if (parsed.help) {
            say(usage());
            return 0;
        }

        if (!parsed.target) {
            throw new InitError("no target directory given — `init <repository-directory>` drafts a workspace into a repository");
        }

        const target = path.resolve(parsed.target);
        let stat;
        try {
            stat = fs.statSync(target);
        } catch (error) {
            throw new InitError(
                `\`${parsed.target}\` does not exist — ${error.message}. \`init\` drafts a workspace INTO a repository; ` +
                    `it does not create the repository.`,
            );
        }
        if (!stat.isDirectory()) throw new InitError(`\`${parsed.target}\` is not a directory`);

        const answers = resolveAnswers(parsed.flags);
        if (answers.name === null) answers.name = slugify(path.basename(target));
        if (answers.name === null) {
            throw new InitError(
                `the directory name \`${path.basename(target)}\` yields no usable workspace name — pass \`--name <slug>\`. ` +
                    `A workspace called something nobody chose is worse than being asked.`,
            );
        }
        validateAnswers(answers);

        // Before a byte: is this repository already governed? A repository is governed by exactly one
        // workspace, so finding one here is a refusal rather than a prompt to replace it.
        const existing = residenceAt(target);
        if (existing.state === "symlink") {
            // Handled here rather than left to the collision check below, so the containment refusal
            // does not depend on which check happens to run first — and so nothing outside the
            // repository was read in order to produce it.
            throw new InitError(
                `\`${existing.where}\` is a symlink, and \`init\` will not follow one out of the repository — not to write ` +
                    `through it, and not to read a workspace manifest through it either. A manifest reached that way ` +
                    `describes some other directory, so any verdict about "this repository" drawn from it would be about ` +
                    `somewhere else. Replace the link with a real directory, or draft into a repository that has none.`,
            );
        }
        if (existing.state === "unreadable") {
            const at = path.join(parsed.target, ".portulan");
            throw new InitError(
                existing.kind === "io"
                    ? `could not examine \`${at}\` — ${existing.why}. Refusing rather than treating it as empty: ` +
                      `a directory this tool cannot look into is a question it could not answer, and "nothing looked" ` +
                      `must never be recorded as "nothing there". Fix the permissions and run this again.`
                    : `could not read the workspace manifest already at \`${path.join(at, "workspace.json")}\` — ` +
                      `${existing.why}. Refusing to write over a manifest it cannot understand: a corrupt policy layer ` +
                      `is the case where overwriting costs the most and this tool knows the least. Repair the JSON and ` +
                      `run \`doctor\` on it, or — if it was never a workspace you meant to keep — move it aside and run ` +
                      `this again.`,
            );
        }
        if (existing.state === "present") {
            const what = existing.kind === "pointer" ? "a pointer to another workspace" : `a \`${existing.kind}\` workspace`;
            throw new InitError(
                `this repository already carries ${what}${existing.name ? ` (\`${existing.name}\`)` : ""} — a repository is ` +
                    `governed by exactly one workspace, and \`init\` will not replace one. Moving between residences is a ` +
                    `switch, not a re-run: the workspace is materialised in the new residence, a pointer or nothing is left ` +
                    `in the old, and validation is green at both ends before the old one is retired. \`vendor\` is the ` +
                    `subcommand that does it — \`portulan vendor <the workspace> --into <where it should live> --residence ` +
                    `<in-repo|feed-side> --switch\` — and it holds that ordering so you do not have to. Doing it by hand the ` +
                    `other way round leaves a window in which this repository is governed by nothing, which looks exactly ` +
                    `like one that never adopted Portulan.`,
            );
        }

        if (answers.residence === "in-repo" && answers.cycle && answers.packRoots.length) {
            if (!packResolves(answers.packRoots, answers.checkpoints)) {
                throw new InitError(
                    `the pack \`${answers.checkpoints}\` does not resolve under ${answers.packRoots.map((r) => `\`${r}\``).join(", ")} ` +
                        `— refusing to compose a pack that is not there. Pass a root that carries it, name a different pack ` +
                        `with \`--checkpoints\`, or run with \`--no-cycle\` and compose it later.`,
                );
            }
        }

        const files = draft(answers, scan(target));

        // The second safety question, and it is not the one above. "Is this repository governed?"
        // keys on the manifest; "may I write here?" keys on every path the draft touches. A
        // `.portulan/` with a hand-written file and no manifest answers no to the first and must
        // still stop the second.
        const clash = collisions(target, files);
        if (clash.length) {
            // Grouped by CAUSE, not listed per path. One symlinked `.portulan` blocks every drafted
            // file, and naming it ten times buries the single fact the reader needs under nine
            // copies of it — a refusal nobody finishes reading is a refusal that failed to explain.
            const byCause = new Map();
            for (const { rel, why } of clash) (byCause.get(why) ?? byCause.set(why, []).get(why)).push(rel);
            const summary = [...byCause]
                .map(([why, rels]) =>
                    rels.length > 2
                        ? `${why} — blocking ${rels.length} drafted files, including \`${rels[0]}\``
                        : `${why} — ${rels.map((r) => `\`${r}\``).join(", ")}`,
                )
                .join("; ");
            throw new InitError(
                `refusing to write into \`${path.join(parsed.target, ".portulan")}\`: ${summary}. \`init\` drafts a ` +
                    `workspace where there is none; it does not merge into one somebody has started, and it does not ` +
                    `follow a link out of the repository. Move or remove what is in the way, or draft into a clean ` +
                    `directory and copy across what you want to keep.`,
            );
        }

        // Every refusal is ahead of this line, so a run that reaches here has nothing left to
        // discover — but I/O can still fail for reasons no check can see, and the ORDER decides what
        // a failure leaves behind. `workspace.json` is written LAST: written first, a half-completed
        // run leaves a torso that the residence check above then reads as a governed repository,
        // and the retry is refused with a sentence that is false. Last, the same failure leaves
        // files and no manifest — which the collision check reports plainly and a person can clear.
        const manifest = ".portulan/workspace.json";
        for (const [rel, file] of [...files].filter(([rel]) => rel !== manifest).concat([[manifest, files.get(manifest)]])) {
            const full = path.join(target, rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, file.contents);
            if (file.mode !== undefined) fs.chmodSync(full, file.mode);
        }

        say(`init: drafted ${files.size} file(s) into ${path.join(parsed.target, ".portulan")}`);
        if (answers.residence === "pointer") {
            say(`init: this repository is recorded as governed by \`${answers.governedBy}\`. Nothing was fetched.`);
        } else {
            say("init: every file is a DRAFT. Read .portulan/README.md before trusting any of it.");
            say("init: the verify recipe exits 2 until you say what green means here — that is deliberate.");
            if (answers.cycle) {
                // Said at the surface rather than only in a file, because the alternative is that the
                // adopter's very next command is `doctor`, it is RED on a pack nothing can find, and
                // the tool that put it there said nothing about it.
                say(
                    `init: this workspace composes \`${answers.checkpoints}\` and nothing resolves a pack for you, so ` +
                        `validation is RED until you name where it lives:`,
                );
                say(`init:   doctor --pack-root <dir> ${path.join(parsed.target, ".portulan")}`);
                say("init: or re-draft with --no-cycle and compose it once you know.");
            }
        }
        return 0;
    } catch (error) {
        if (error instanceof InitError) {
            warn(`init: ${error.message}`);
            return 2;
        }
        warn(`init: could not run — ${error.message}`);
        return 2;
    }
}

// The `?? ""` is not decoration and every sibling tool here carries it: `process.argv[1]` is absent
// when this module is imported by something that is not a script — `node -e "import('./init.mjs')"`,
// which is how a suite or a REPL reaches it — and `pathToFileURL(undefined)` throws at module load.
// This file argued two hundred lines up that an unreadable schema must not throw while loading,
// because the entry point can only turn that into a stack trace; it then omitted the guard that makes
// the same promise here. Found at the pre-commit checkpoint.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = await run(process.argv.slice(2));
}
