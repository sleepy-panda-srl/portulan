#!/usr/bin/env node
// `upgrade` — migrate a workspace, in either residence.
//
// The eighth of the eight subcommands `docs/vision.md` names, and the last to be built. Row 7 of
// `docs/plan.md`: *"`upgrade` migrates a workspace in **either** residence."*
//
// ## What a migration is, and where it lives
//
// Not here. `spec/migrations/` is the contract — a directory of steps, each a module — because a
// migration is part of the **Workspace Definition** rather than part of a tool, and `spec/` ships in
// `package.json`'s `files` so it would reach an `npx` user if the package were published — publishing
// is Gated and has not happened, so there is no such user today, and whether there ever is remains
// open (#242). See `../.portulan/identity.md`. This file is the runner: it decides which
// steps a workspace owes, applies them, and grades the result with the real validator.
//
// **Two kinds of step**, by the maintainer's ruling of 2026-08-12: a `version` step migrates a
// Workspace Definition MAJOR, and a `repair` fixes something a rewriter owes a workspace it touched.
// Without the second kind this tool would be machinery with no subject — the train's only MAJOR
// migration is `1.0 → 2.0` and **nothing in this repository declares 1.0**.
//
// ## The three states a workspace can be in relative to this bundle, and why two of them are refusals
//
// `doctor` refuses a manifest whose MAJOR differs from the schema's — in **either direction** — and
// refuses a MINOR ahead of it. The direction matters here in a way it does not there:
//
// - **behind by a MAJOR** — the case this tool exists for. `doctor` cannot grade it, so the pre-state
//   gate below is skipped and the result is graded post-state only.
// - **ahead** (MAJOR or MINOR) — **exit 2**. This bundle is older than the workspace; nothing here
//   knows the contract it was written against, and the remedy is to upgrade the CLI. Branching on the
//   *fact* of `doctor`'s refusal rather than on the direction sent such a workspace into the plan,
//   where every step answered *not owed* and the run exited **0 — nothing owed**: a green rendered by
//   a tool that could not read the workspace. Caught at the session-open checkpoint.
// - **level, or behind by a MINOR** — gradeable, and graded before anything is planned.
//
// The same hole has a second mouth: a workspace behind by a MAJOR that **no step reaches** would also
// plan to nothing and exit 0. That is refused too, further down, for the same reason.
//
// ## Exit codes
//
// `0` succeeded — nothing owed, or applied and green · `1` a verdict — steps owed under `--check`, a
// red workspace before or after, **and a pointer that does not resolve** (`not-installed` or
// `ambiguous`, which is `discover.mjs`'s own mapping rather than a second opinion about it) · `2`
// could not run, including a step that **could not tell**, either direction this bundle cannot help
// with, and a `--write` aimed at an installed workspace.
//
// Zero dependencies, ESM, no build step — the session-0 ruling.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { inspect, schemaVersion } from "./doctor.mjs";
import { resolveGovernor } from "./discover.mjs";
// The guarded walk, not a fourth implementation of one. `vendor`'s `walk` already refuses a symlink
// anywhere under a workspace — rule 2 of the three a tool writing into somebody's tree owes — and
// three `collisions()` implementing one rule is already an open complaint against this repository
// (#169). Its errors are re-worded below so a reader is never told `vendor` failed.
import { walk } from "./vendor.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE = path.resolve(HERE, "..");
const MIGRATIONS = path.join(BUNDLE, "spec", "migrations");

/** Distinguishes one run's staging files from another's, alongside the pid. */
let stagingSeq = 0;

/** Everything that means `upgrade` could not run. Carries no verdict about a workspace. */
export class UpgradeError extends Error {}

/**
 * The Workspace Definition version **this bundle implements**, derived from the schema's `$id`.
 *
 * Derived rather than written down, and through `doctor`'s own exported reader, so this file is not a
 * second carrier of the current version. A literal here would be wrong the hour the schema moves —
 * which is the defect class this repository has repaired more often than any other.
 */
export function bundleSpec({ schemaPath } = {}) {
    const file = schemaPath ?? path.join(BUNDLE, "spec", "workspace.schema.json");
    // The THIRD site of the read-versus-parse rule, found by sweeping after Copilot named the second.
    // This one reads a file the bundle ships rather than one a user wrote, so a malformed schema is a
    // broken install rather than somebody's typo — which changes who the sentence is for, not whether
    // it should be accurate. Two carriers here were already one too many.
    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    } catch (cause) {
        throw new UpgradeError(`the Workspace Definition at ${file} could not be read — ${cause.code ?? cause.message}`);
    }
    let schema;
    try {
        schema = JSON.parse(text);
    } catch (cause) {
        throw new UpgradeError(`the Workspace Definition at ${file} does not parse as JSON — ${cause.message}. This bundle's own schema is unreadable, which is a broken install rather than a fault in any workspace`);
    }
    return schemaVersion(schema);
}

/**
 * The chain, in id order, read from the directory rather than from a list.
 *
 * There is no registry to keep in sync with the tree: a step is a file, and the filename is the
 * order. A hand-maintained list beside a directory is the second carrier this repository keeps
 * repairing out of its own design.
 */
export async function loadSteps({ dir = MIGRATIONS } = {}) {
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (cause) {
        throw new UpgradeError(`the migrations directory at ${dir} could not be read — ${cause.code ?? cause.message}`);
    }
    const steps = [];
    for (const name of names.filter((n) => n.endsWith(".mjs")).sort()) {
        const file = path.join(dir, name);
        let module;
        try {
            module = await import(pathToFileURL(file).href);
        } catch (cause) {
            throw new UpgradeError(`${file} could not be loaded — ${cause.message}`);
        }
        const step = module.step;
        if (step === null || typeof step !== "object") {
            throw new UpgradeError(`${file} exports no \`step\` object — every module in ${dir} is a migration step`);
        }
        if (step.id !== path.basename(name, ".mjs")) {
            // The id IS the order, and the order is the filename. A step whose id disagrees with its
            // file would sort by one and report as the other.
            throw new UpgradeError(`${file} declares id \`${step.id}\`, which is not its filename — the id is the chain's order`);
        }
        steps.push(step);
    }
    return steps;
}

/**
 * Read a workspace directory into the view `spec/migrations/README.md` promises a step.
 *
 * Read and parse stay two failures with two repairs: a `SyntaxError` carries no `.code`, and
 * reporting it under *could not be read* sends somebody with a malformed manifest to look at
 * permissions.
 */
export function readWorkspace(dir) {
    const root = path.resolve(dir);
    const file = path.join(root, "workspace.json");

    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    } catch (error) {
        // Only `ENOENT` means absent. An `EACCES` is a question that could not be answered, and
        // answering it *nothing there* is the fail-open.
        return {
            ok: false,
            code: 2,
            reason:
                error.code === "ENOENT"
                    ? `${file} does not exist — that is not a workspace directory`
                    : `${file} could not be read — ${error.code ?? error.message}`,
        };
    }

    let manifest;
    try {
        manifest = JSON.parse(text);
    } catch (error) {
        return { ok: false, code: 2, reason: `${file} does not parse as JSON — ${error.message}` };
    }

    let files;
    try {
        files = walk(root).map((entry) => entry.rel);
    } catch (error) {
        // **Framed, never rewritten.** `walk` is `vendor`'s and its refusals speak in `vendor`'s voice
        // — *"this refuses to copy through one"* — which is the wrong verb for a tool that is
        // migrating. The first attempt at this substituted the wording, and it was **inert**: the
        // pattern said `refusing to copy through` and the message says `refuses`. A fix that could not
        // fire, under a comment asserting it did — this repository's dominant defect class, committed
        // here in the change that cites it. Copilot's promoted note, round 2 on #231.
        //
        // Rewriting was the wrong shape anyway: matching another module's sentence makes this file a
        // second carrier of `vendor`'s wording, free to rot the next time that sentence is edited. So
        // the prefix says who declined and why, and the borrowed sentence is left exactly as its owner
        // wrote it.
        return { ok: false, code: 2, reason: `${root} could not be read for migration — ${error.message}` };
    }

    const cache = new Map();
    return {
        ok: true,
        ws: {
            dir: root,
            manifest,
            manifestText: text,
            list: () => files,
            // The READ sibling of the write guard. `list()` only ever yields paths `walk` enumerated
            // inside the workspace, so a step iterating it is safe — but `read` takes whatever a step
            // hands it, and the step contract does not constrain that. A tool that refused to WRITE
            // outside the workspace while reading anything on the disk would be guarding one half of
            // the same rule. Found by sweeping after Copilot caught the `restore` sibling.
            read: (rel) => {
                const at = inside(root, rel);
                if (at === null) throw new UpgradeError(`\`${rel}\` resolves outside ${root} — refusing to read there`);
                if (!cache.has(rel)) cache.set(rel, fs.readFileSync(at, "utf8"));
                return cache.get(rel);
            },
        },
    };
}

/**
 * Which workspace does this run act on?
 *
 * A governing kind is its own answer. A `pointer` is resolved through `cli/discover.mjs`, and the
 * resolver's **own `sentence`** travels back with the verdict — one carrier, so every surface that
 * reports a resolution prints the same words rather than four paraphrases of them.
 */
export async function resolveTarget(dir, options = {}) {
    const root = path.resolve(dir);
    const file = path.join(root, "workspace.json");
    // **Read and parse are two failures with two repairs, and this had them as one.** `readWorkspace`
    // twelve lines up already keeps them apart — a `SyntaxError` carries no `.code`, so a malformed
    // manifest fell through to the *could not be read* sentence and sent the reader to look at
    // permissions and paths instead of at their JSON. One rule, two sites, enforced at one: `0020`,
    // and the second site is inside the file whose own contract states the distinction.
    // Copilot's suppressed note, round 7 on #231.
    const fail = (sentence) => ({ state: "could-not-look", dir: null, resolution: null, sentence });

    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    } catch (error) {
        return fail(
            error.code === "ENOENT"
                ? `${file} does not exist — that is not a workspace directory`
                : `${file} could not be read — ${error.code ?? error.message}`,
        );
    }

    let manifest;
    try {
        manifest = JSON.parse(text);
    } catch (error) {
        return fail(`${file} does not parse as JSON — ${error.message}`);
    }
    if (manifest?.kind !== "pointer") {
        // **Not `discover`'s wording, deliberately, and the difference is the argument.** `discover`
        // answers *this repository's workspace resides here* because it is asked about a repository's
        // own `.portulan` — that is its question. This tool takes ANY workspace directory: `examples/`,
        // a feed-side portfolio, a path a user typed. Borrowing the sentence would have made a claim
        // about ownership from the mere absence of `kind: pointer`, which is a different fact from the
        // one that was checked. So it says what it actually established. Copilot, round 1 on #231.
        const kind = typeof manifest?.kind === "string" ? `\`${manifest.kind}\`` : "a governing";
        return {
            state: "resides-here",
            dir: root,
            resolution: null,
            sentence: `\`${root}\` carries ${kind} manifest, so it is the workspace this run acts on`,
        };
    }
    const resolution = resolveGovernor(manifest.governed_by, options);
    return {
        state: resolution.state,
        dir: resolution.state === "resolved" ? resolution.root : null,
        resolution,
        sentence: resolution.sentence,
    };
}

/**
 * Ask every step whether it is owed. Three answers, and the third is not a shorter plan.
 *
 * **A step that THROWS is `could not tell`, not a crash.** The three-valued answer exists precisely so
 * that "this step could not work out whether it applies" has somewhere to go other than a green — and
 * an unhandled exception routed around it entirely, taking the whole tool down instead of producing
 * the designed exit 2. A step is a module from `spec/migrations/`, so a bug in one, or an unexpected
 * read error inside it, must degrade to the answer the contract already has a word for.
 * Copilot's promoted note, round 6 on #231.
 */
export async function planFor(ws, ctx, steps) {
    const entries = [];
    let owed = 0;
    let unknown = 0;
    for (const step of steps) {
        let answer;
        try {
            answer = await step.owed(ws, ctx);
            // **The VALUE, not the presence of the key.** A first cut accepted any object carrying an
            // `owed` property, which let `{ owed: "yes" }` or `{ owed: undefined }` through: neither is
            // `true` and neither is `null`, so the arithmetic below counted them as **not owed** — a
            // false green produced by the very guard added to prevent one. Checking that a field exists
            // is not checking that its value is one this contract defines.
            // Copilot, round 8 on #231.
            if (answer === null || typeof answer !== "object" || ![true, false, null].includes(answer.owed)) {
                answer = { owed: null, because: `${step.id} returned no usable verdict from \`owed\` (${JSON.stringify(answer?.owed)})` };
            } else if (typeof answer.because !== "string" || answer.because === "") {
                // The reason is what a reader is given when the run refuses. A missing one is not
                // grounds to discard a good verdict, so the verdict stands and the sentence is named
                // as absent rather than printed as `undefined`.
                answer = { owed: answer.owed, because: `${step.id} gave no reason` };
            }
        } catch (error) {
            answer = { owed: null, because: `${step.id} threw while deciding whether it is owed — ${error.message}` };
        }
        entries.push({ step, owed: answer.owed, because: answer.because });
        if (answer.owed === null) unknown += 1;
        else if (answer.owed === true) owed += 1;
    }
    return { entries, owed, unknown };
}

/**
 * Resolve a step-supplied relative path inside `root`, or `null` if it escapes.
 *
 * **One carrier, and it has two callers because it has to.** `applyEdits` writes and `restore`
 * writes back, and a guard on the first alone leaves the second reachable with the same value — one
 * rule enforced at one of its two sites, which is `0020` exactly. That is not hypothetical here:
 * `applyEdits` got the guard first and `restore` did not, and Copilot found the sibling before this
 * session's own sweep did.
 *
 * `resolve`, never `join`: `path.join(root, "/etc/passwd")` CONCATENATES to `<root>/etc/passwd`,
 * which hides an absolute path from the check instead of exposing it. And resolution rather than
 * pattern-matching, because every interesting escape parses fine and only fails once resolved.
 */
export function inside(root, rel) {
    const resolved = path.resolve(root, rel);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
    return resolved;
}

/**
 * The other half of containment: the path on DISK, not the path as a string.
 *
 * `inside()` is lexical. A symlink at any **parent component** makes the write escape while the
 * string still resolves inside the root — `<root>/link/a.md` passes every character-level test and
 * lands wherever `link` points. `{ flag: "wx" }` guards only the final component. This is the rule
 * `cli/vendor.mjs` states as rule 2 and enforces by walking the chain, and `cli/skills-set.mjs`
 * spells the same walk; this file had inherited the rule and implemented only its lexical half.
 * Copilot, round 11 on #231.
 *
 * Components that do not exist are fine — they are about to be created, and nothing can be followed
 * through a path that is not there — so the walk stops at the first `ENOENT`. Anything else is a
 * question that could not be answered, and is refused rather than assumed absent: rule 3.
 *
 * The root itself is not checked, deliberately, and that is `vendor`'s boundary: **above the named
 * path, resolve — the caller named it, and on macOS `os.tmpdir()` runs through `/var`. At it and
 * below it, refuse.**
 *
 * Returns a reason to refuse, or `null` when the chain is clean.
 */
function linkOnPath(root, resolved) {
    const rel = path.relative(root, resolved);
    if (rel === "") return null;
    let at = root;
    for (const part of rel.split(path.sep)) {
        at = path.join(at, part);
        let stat;
        try {
            stat = fs.lstatSync(at);
        } catch (error) {
            if (error.code === "ENOENT") return null;
            return `${at} could not be examined — ${error.code ?? error.message}`;
        }
        if (stat.isSymbolicLink()) return `${at} is a symlink, and this refuses to write through one`;
    }
    return null;
}

/**
 * Remove directories this run created, deepest first, stopping at the first that will not go.
 *
 * **One carrier, two callers.** `applyEdits` needs it on every failure path between creating a
 * directory and recording the snapshot that would have owned it, and `restore` needs it when undoing
 * a file that did not exist. Two copies of this loop would be one rule at two sites — and the second
 * site is precisely where the first copy was missing.
 *
 * Stops rather than forces: a directory that will not `rmdir` is one that is not empty, which means
 * something else is in it and it was not ours to remove after all.
 *
 * **`ENOENT` is not that case, and stopping on it was a bug.** A directory already gone — removed out
 * of band, or by a `rm -rf` of a subtree — satisfies the goal rather than blocking it, and treating it
 * as an obstacle abandoned every parent above it while they may well have been empty. Absence means
 * *done*, not *stop*. Copilot's promoted note, round 6 on #231.
 */
function unwindDirs(dirs) {
    for (const made of [...dirs].reverse()) {
        try {
            fs.rmdirSync(made);
        } catch (error) {
            if (error.code === "ENOENT") continue;
            break;
        }
    }
}

/**
 * Write the edits, keeping the previous contents so a red verdict can be undone.
 *
 * Each file lands by write-temp-then-rename, so no file is ever half-written. **The mode is carried
 * across**: `rename(2)` replaces the inode, and `verify/index.sh` is executable — a repair that left
 * the rail unexecutable would have broken the thing it exists to fix.
 *
 * **A parent directory is created where an edit names one that does not exist**, and the directories
 * created are recorded so a rollback can remove them again. Neither step shipped today writes a new
 * file, so nothing exercised this in production — which is exactly why it was worth fixing rather than
 * leaving: a later step adding a nested file would have failed `ENOENT` on a perfectly valid edit.
 * Copilot's promoted note, round 2 on #231.
 */
export function applyEdits(dir, edits, options = {}) {
    // `write` is an injection point for the suite, the way `init` injects its reader and `skills-set`
    // injects its manifest. No production caller passes it. It exists because the window this guards —
    // `mkdir` succeeds, the write then fails — is a disk-full or permissions race that cannot be
    // staged honestly on a real filesystem, and a failure path with no test is how the orphan it
    // guards against got here in the first place.
    const write = options.write ?? fs.writeFileSync;
    const root = path.resolve(dir);
    const snapshots = [];
    for (const edit of edits) {
        // **A path built from somebody else's text is contained before it is opened.** A step's
        // `edit.file` is a value this tool did not author — an absolute path, or one climbing out
        // with `..`, would have this writing outside the workspace it was pointed at. Nothing in the
        // step contract prevents either, and a schema could not: the value is computed, not declared.
        //
        // This repository has already paid for the class once, at a persona's free-text `name`, where
        // `../../poison` had `doctor` read, grade and GREEN a file outside the tree. `cli/compile.mjs`
        // guards the same way. Copilot, round 4 on #231.
        const file = inside(root, edit.file);
        if (file === null) {
            return {
                ok: false,
                snapshots,
                reason: `\`${edit.file}\` resolves outside ${root} — refusing to write there`,
            };
        }
        const linked = linkOnPath(root, file);
        if (linked !== null) return { ok: false, snapshots, reason: linked };

        let previous = null;
        let mode = null;
        try {
            previous = fs.readFileSync(file, "utf8");
            mode = fs.lstatSync(file).mode;
        } catch (error) {
            if (error.code !== "ENOENT") {
                return { ok: false, snapshots, reason: `${file} could not be read before writing — ${error.code ?? error.message}` };
            }
        }

        // Shallowest first, so `unwindDirs` can take them in reverse. `lstat`, never `existsSync`:
        // the latter follows links and answers *false* for an unreadable path, which would turn "I
        // could not look" into "it is not there" — rule 3, at a third site.
        const wanted = [];
        for (let at = path.dirname(file); at.startsWith(root) && at !== root; at = path.dirname(at)) {
            try {
                fs.lstatSync(at);
                break;
            } catch (error) {
                if (error.code !== "ENOENT") {
                    return { ok: false, snapshots, reason: `${at} could not be examined — ${error.code ?? error.message}` };
                }
                wanted.unshift(at);
            }
        }

        // **What was actually made**, not what was wanted. The snapshot is pushed only after a
        // successful rename, so every failure between here and there has to clean up its own
        // directories or they are orphaned — created, unrecorded, and invisible to `restore`. That
        // is the leak Copilot's promoted note found in the fix that added them, one round earlier.
        const created = [];
        try {
            for (const dir of wanted) {
                try {
                    fs.mkdirSync(dir);
                    created.push(dir);
                } catch (error) {
                    // A directory created between the `lstat` probe above and this line satisfies the
                    // goal rather than defeating it — but only if what appeared is a DIRECTORY. An
                    // `EEXIST` from a file of that name is a real failure, and swallowing both would
                    // be the fail-open. Not recorded in `created`: this run did not make it, so this
                    // run does not get to remove it. Copilot's promoted note, round 6.
                    if (error.code !== "EEXIST" || !fs.lstatSync(dir).isDirectory()) throw error;
                }
            }
        } catch (error) {
            unwindDirs(created);
            return { ok: false, snapshots, reason: `${path.dirname(file)} could not be created — ${error.code ?? error.message}` };
        }

        // **Unique per edit, not a fixed suffix.** Two `upgrade --write` runs over one workspace —
        // concurrent CI invocations, or a human beside a pipeline — would otherwise race on the same
        // staging path and lose or corrupt an edit. Still in the same directory, so the `rename` stays
        // atomic. Copilot, round 6 on #231.
        const staging = `${file}.portulan-upgrade.${process.pid}.${stagingSeq++}`;
        try {
            // **Exclusive create.** The staging path is a path `walk` never saw — it does not exist
            // when the workspace is read — so the containment guard above says nothing about it. With
            // default flags a symlink planted there would be **followed**, writing outside the
            // workspace and defeating that guard entirely; a leftover file would be clobbered. `wx`
            // fails with `EEXIST` on anything already at the path, symlink included, which is the
            // fail-closed direction and rule 2 of the three a tool writing into somebody's tree owes.
            // Copilot, round 10 on #231.
            write(staging, edit.next, { flag: "wx" });
            if (mode !== null) fs.chmodSync(staging, mode);
            fs.renameSync(staging, file);
        } catch (error) {
            try {
                fs.rmSync(staging, { force: true });
            } catch {
                /* the staging file is the lesser problem; the write failure is what gets reported */
            }
            unwindDirs(created);
            return { ok: false, snapshots, reason: `${file} could not be written — ${error.code ?? error.message}` };
        }
        snapshots.push({ file: edit.file, previous, mode, created });
    }
    return { ok: true, snapshots };
}

/**
 * Put back what `applyEdits` replaced.
 *
 * **It reports what it did not restore rather than claiming the tree is clean.** "The workspace is
 * exactly as it was" is a promise a mid-restore `EACCES` breaks, and a rollback that lies about
 * having succeeded is worse than one that failed loudly.
 */
export function restore(dir, snapshots) {
    const root = path.resolve(dir);
    const restored = [];
    const failed = [];
    // **Reverse order — an unwind runs against the stack that made it.** Two edits landing in the same
    // newly-created directory record it as `created` on the FIRST of them only; forwards, that
    // snapshot's `rmdir` fails because the second file is still there, and the directory is left
    // behind. Backwards, the second file goes first and the directory is empty when its turn comes.
    // Found by sweeping this file for the sibling of the note that added the directories, rather than
    // by a round that raised it.
    for (const snapshot of [...snapshots].reverse()) {
        // The SIBLING of the guard in `applyEdits`, and it is here because it was missing.
        // `applyEdits` got containment first and this did not — one rule at one of its two sites,
        // which is `0020`, in the change whose own commit message was about sweeping for siblings.
        // Copilot found it; the sweep did not. A snapshot normally comes from `applyEdits` and is
        // therefore already contained, but this function is exported and takes them from a caller.
        const file = inside(root, snapshot.file);
        if (file === null || linkOnPath(root, file) !== null) {
            failed.push(snapshot.file);
            continue;
        }
        try {
            if (snapshot.previous === null) {
                fs.rmSync(file, { force: true });
                // And the directories this run had to create for it. Leaving them behind would make
                // "the workspace is exactly as it was" false in a second way — quieter than a stray
                // file, and still not true.
                unwindDirs(snapshot.created ?? []);
            } else {
                // The sibling: a rollback writes back to a path that existed when the run began, but
                // "existed then" is not "is a regular file now". Refusing to write through a link
                // here costs nothing and keeps the rule whole at both write sites.
                const at = fs.lstatSync(file, { throwIfNoEntry: false });
                if (at?.isSymbolicLink()) throw new UpgradeError(`${file} is a symlink — refusing to restore through it`);
                fs.writeFileSync(file, snapshot.previous);
                if (snapshot.mode !== null && snapshot.mode !== undefined) fs.chmodSync(file, snapshot.mode);
            }
            restored.push(snapshot.file);
        } catch {
            failed.push(snapshot.file);
        }
    }
    if (failed.length) {
        return {
            ok: false,
            restored,
            failed,
            reason: `${failed.length} file(s) could not be put back: ${failed.join(", ")}`,
        };
    }
    return { ok: true, restored, failed };
}

export function usage() {
    return [
        "portulan upgrade — migrate a workspace to this bundle's Workspace Definition",
        "",
        "  portulan upgrade [--check | --write] [--tree <path>] <workspace-dir>",
        "",
        "  (no flag)   print the steps this workspace owes and write nothing",
        "  --check     exit 1 if any step is owed — the rail a pipeline runs",
        "  --write     apply the chain, then grade the result with doctor",
        "  --tree      the value a 1.0 `repository` workspace needs and this will not guess",
        "",
        // Precisely which half is refused. The older wording — \"never inside the install\" — read as
        // *this tool does not touch an installed workspace*, and a bare or `--check` run DOES read one
        // to work out what it owes. Only writing is refused. Copilot's promoted note, round 3.
        "A pointer is resolved through the host's installed-plugin record; the installed workspace is",
        "read and reported on, and `--write` is refused there — migrate it at its own directory.",
        "",
        "Exit codes: 0 succeeded · 1 a red verdict · 2 could not run.",
    ].join("\n");
}

const KNOWN_FLAGS = new Set(["--check", "--write", "--help", "-h"]);

export async function run(argv = [], options = {}) {
    const stdout = options.stdout ?? process.stdout;
    const stderr = options.stderr ?? process.stderr;
    const say = (line) => stdout.write(`${line}\n`);
    const warn = (line) => stderr.write(`${line}\n`);
    const env = options.env ?? process.env;

    const positional = [];
    const flags = [];
    let tree = null;
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--tree") {
            // **Three refusals, matching the three parsers that already own this rule** —
            // `cli/init.mjs`, `cli/new.mjs` and `cli/vendor.mjs` each refuse a missing value, a value
            // that reads as another flag, and an empty one. This took only the first, so
            // `--tree --write <dir>` swallowed `--write` as the tree value and **silently dropped the
            // write**: a report where the user asked for a migration. A fourth parser inheriting half
            // a rule is the shape this pull request has now hit three times.
            // Copilot, round 12 on #231.
            const value = argv[i + 1];
            if (value === undefined) {
                warn("upgrade: `--tree` needs a value — it is the one thing this tool will not guess");
                return 2;
            }
            if (value.startsWith("-")) {
                warn(`upgrade: \`--tree\` needs a value and the next argument is \`${value}\` — refusing to read a flag as one`);
                return 2;
            }
            if (value.trim() === "") {
                warn("upgrade: `--tree` was given an empty value, and no option here has a meaningful empty value");
                return 2;
            }
            tree = value;
            i += 1;
            continue;
        }
        if (arg.startsWith("-")) {
            flags.push(arg);
            continue;
        }
        positional.push(arg);
    }

    // Refused rather than dropped. A silently-ignored `--wrote` is a user who believes they asked for
    // something and got a report instead — `discover`'s rule, for `discover`'s reason.
    const unknown = flags.filter((flag) => !KNOWN_FLAGS.has(flag));
    if (unknown.length) {
        warn(`upgrade: unknown flag \`${unknown[0]}\` — run \`portulan upgrade --help\``);
        return 2;
    }
    if (flags.includes("--help") || flags.includes("-h")) {
        say(usage());
        return 0;
    }

    const check = flags.includes("--check");
    const write = flags.includes("--write");
    if (check && write) {
        warn("upgrade: --check and --write are two questions; pass one");
        return 2;
    }
    if (positional.length !== 1) {
        warn(`upgrade: name exactly one workspace directory (given ${positional.length})`);
        return 2;
    }

    let spec;
    let steps;
    try {
        spec = bundleSpec();
        // Injected only by the suite, alongside `write` and `env`. The apply loop's guards against a
        // step returning an unusable plan cannot be reached from the two steps this bundle ships —
        // both are well-behaved — and a failure path with no test is how the defect those guards
        // exist for arrived in the first place.
        steps = options.steps ?? (await loadSteps());
    } catch (error) {
        warn(`upgrade: ${error.message}`);
        return 2;
    }

    // ---- which workspace, and in which residence
    const target = await resolveTarget(positional[0], { env });
    if (target.state === "could-not-look") {
        warn(`upgrade: ${target.sentence}`);
        return 2;
    }
    if (target.state === "not-installed" || target.state === "ambiguous") {
        warn(`upgrade: ${target.sentence}`);
        return 1;
    }
    if (target.state === "resolved") {
        say(`upgrade: ${target.sentence}`);
        if (write) {
            // A cache install is a **materialisation** whose identity is a version claim, not one of
            // proposal 0017's two residences. Writing here would leave a directory that no longer
            // matches the version the host's record names for it, and a reinstall would silently
            // revert it. The workspace itself is migrated at its own directory — the only act that
            // re-pins a feed.
            warn(
                `upgrade: \`${target.dir}\` is an installed workspace, pinned at the version the host's record names for it. ` +
                    "Refusing to migrate a copy: run this against the workspace's own directory and republish, then reinstall here",
            );
            return 2;
        }
    }

    const read = readWorkspace(target.dir);
    if (!read.ok) {
        warn(`upgrade: ${read.reason}`);
        return read.code;
    }
    const ws = read.ws;
    // The SHORTER of the two spellings. A relative path is what a reader wants for a workspace inside
    // the tree they are standing in, and turns into `../../../../…` for a target that is not — a
    // temp directory, or an install in the plugin cache. Neither is wrong; one is unreadable.
    const relative = path.relative(process.cwd(), ws.dir);
    const shown = relative && relative.length < ws.dir.length ? relative : ws.dir;

    // ---- which direction is this workspace off in
    const declared = /^([0-9]+)\.([0-9]+)$/.exec(ws.manifest?.portulan?.spec ?? "");
    if (!declared) {
        warn(`upgrade: ${shown} declares no readable \`portulan.spec\` — refusing to guess which contract it was written against`);
        return 2;
    }
    const major = Number(declared[1]);
    const minor = Number(declared[2]);
    const behindByMajor = major < spec.major;
    if (major > spec.major || (major === spec.major && minor > spec.minor)) {
        warn(
            `upgrade: ${shown} declares Workspace Definition ${major}.${minor} and this bundle implements ` +
                `${spec.major}.${spec.minor} — this bundle is OLDER than the workspace. Upgrade the CLI; nothing here ` +
                "knows the contract that workspace was written against",
        );
        return 2;
    }

    // ---- the pre-state gate, which can only ever apply to a gradeable workspace
    if (!behindByMajor) {
        let pre;
        try {
            pre = await inspect(ws.dir);
        } catch (error) {
            warn(`upgrade: doctor could not grade ${shown} — ${error.message}`);
            return 2;
        }
        const fails = pre.findings.filter((finding) => finding.severity === "fail");
        if (fails.length) {
            warn(
                `upgrade: doctor reports ${fails.length} failing check(s) on ${shown} at the version it already declares. ` +
                    "Refusing to migrate: a migration would layer a second problem on the first, and a red afterwards " +
                    "could not be told from one this run caused",
            );
            for (const finding of fails.slice(0, 10)) warn(`upgrade:   ${finding.check} — ${finding.message}`);
            return 1;
        }
    }

    // ---- the plan
    const ctx = { bundle: BUNDLE, spec, tree };
    const plan = await planFor(ws, ctx, steps);

    if (plan.unknown > 0) {
        for (const entry of plan.entries.filter((e) => e.owed === null)) {
            warn(`upgrade: ${entry.step.id} could not tell — ${entry.because}`);
        }
        warn("upgrade: refusing to report a workspace current while a step could not answer — nothing looked is never nothing wrong");
        return 2;
    }

    // The second mouth of the direction hole: a workspace behind by a MAJOR that no step reaches
    // would plan to nothing and exit 0, which is the same false green from the other end.
    if (behindByMajor && plan.owed === 0) {
        warn(
            `upgrade: ${shown} declares ${major}.${minor} and no migration in this chain reaches it — refusing to ` +
                `report it current when this bundle implements ${spec.major}.${spec.minor} and doctor will not grade it`,
        );
        return 2;
    }

    if (plan.owed === 0) {
        say(`upgrade: ${shown} owes nothing — it is current at ${major}.${minor}`);
        return 0;
    }

    for (const entry of plan.entries.filter((e) => e.owed === true)) {
        say(`upgrade: ${entry.step.id} (${entry.step.kind}) — ${entry.step.title}`);
        say(`upgrade:   ${entry.because}`);
    }

    // WHICH invocation to suggest depends on where the target came from. Telling the operator of a
    // resolved install to "run with --write" names the one command this tool then refuses with exit
    // 2 — advice and refusal disagreeing about the same act, which is the sibling of the refusal
    // itself. Caught at the pre-commit checkpoint, reproduced end to end on a real install.
    const advice =
        target.state === "resolved"
            ? "run this against the workspace's own directory and republish — an installed copy is not migrated in place"
            : "run with --write to apply them";

    if (check) {
        warn(`upgrade: ${shown} owes ${plan.owed} step(s) — ${advice}`);
        return 1;
    }
    if (!write) {
        say(`upgrade: ${plan.owed} step(s) owed. Nothing was written — ${advice}`);
        return 0;
    }

    // ---- apply, one step at a time, re-reading between them
    let snapshots = [];
    let current = ws;
    const undo = () => {
        const result = restore(current.dir, snapshots);
        if (!result.ok) {
            warn(`upgrade: the rollback was INCOMPLETE — put back ${result.restored.join(", ") || "nothing"}; NOT put back ${result.failed.join(", ")}`);
            return false;
        }
        return true;
    };

    for (const entry of plan.entries.filter((e) => e.owed === true)) {
        // **A step that throws mid-chain must not take the rollback with it.** `plan()` is a module's
        // code, and an exception here — after earlier steps have already written — would abort the
        // process with `undo()` never called, leaving a half-migrated workspace and no record of it.
        // Converted into the refusal the loop already knows how to unwind from. Copilot, round 6.
        let planned;
        try {
            planned = await entry.step.plan(current, ctx);
            // Same lesson as `planFor` above, at the second site: presence of `ok` is not a usable
            // plan. `{ ok: true }` with no `edits` array made `applyEdits` throw on `undefined` —
            // **bypassing the rollback entirely** and leaving a partially migrated workspace, which is
            // the exact outcome the try/catch around this call exists to prevent. `{ ok: false }` with
            // no `reason` printed `undefined` at the user. Copilot, round 8 on #231.
            if (planned === null || typeof planned !== "object" || typeof planned.ok !== "boolean") {
                planned = { ok: false, reason: `${entry.step.id} returned no plan` };
            } else if (planned.ok && !Array.isArray(planned.edits)) {
                planned = { ok: false, reason: `${entry.step.id} reported a plan with no \`edits\` array — refusing to apply a plan it did not describe` };
            } else if (!planned.ok && (typeof planned.reason !== "string" || planned.reason === "")) {
                planned = { ok: false, reason: `${entry.step.id} refused without giving a reason` };
            }
        } catch (error) {
            planned = { ok: false, reason: `${entry.step.id} threw while planning its edits — ${error.message}` };
        }
        if (!planned.ok) {
            if (!undo()) return 2;
            warn(`upgrade: ${entry.step.id} — ${planned.reason}`);
            if (snapshots.length) warn("upgrade: nothing was left behind — the steps that had already run were rolled back");
            return 2;
        }
        const applied = applyEdits(current.dir, planned.edits);
        snapshots = [...snapshots, ...applied.snapshots];
        if (!applied.ok) {
            if (!undo()) return 2;
            warn(`upgrade: ${entry.step.id} — ${applied.reason}`);
            return 2;
        }
        const again = readWorkspace(current.dir);
        if (!again.ok) {
            if (!undo()) return 2;
            warn(`upgrade: ${shown} could not be re-read after ${entry.step.id} — ${again.reason}`);
            return 2;
        }
        current = again.ws;
    }

    // ---- and grade what it produced, with the real validator
    let post;
    try {
        post = await inspect(current.dir);
    } catch (error) {
        if (!undo()) return 2;
        warn(`upgrade: doctor could not grade the migrated workspace — ${error.message}. Rolled back`);
        return 2;
    }
    const fails = post.findings.filter((finding) => finding.severity === "fail");
    if (fails.length) {
        if (!undo()) return 2;
        warn(
            behindByMajor
                ? `upgrade: the migrated workspace is red — ${fails.length} failing check(s). ${shown} declared ` +
                      `${major}.${minor}, which doctor refuses outright, so its pre-state could not be graded: these may be ` +
                      "faults it already carried rather than ones this run introduced. Rolled back — the workspace is as it was"
                : `upgrade: the migrated workspace is red — ${fails.length} failing check(s), where it was green before. ` +
                      "Rolled back — the workspace is as it was",
        );
        for (const finding of fails.slice(0, 10)) warn(`upgrade:   ${finding.check} — ${finding.message}`);
        return 1;
    }

    const written = [...new Set(snapshots.map((s) => s.file))];
    say(`upgrade: applied ${plan.owed} step(s) to ${shown} — ${written.join(", ")}. doctor is green`);
    return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = await run(process.argv.slice(2));
}
