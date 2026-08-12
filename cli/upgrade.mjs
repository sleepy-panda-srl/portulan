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
// `package.json`'s `files` so it reaches an `npx` user. This file is the runner: it decides which
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
    let schema;
    try {
        schema = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (cause) {
        throw new UpgradeError(`the Workspace Definition at ${file} could not be read — ${cause.message}`);
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
            read: (rel) => {
                if (!cache.has(rel)) cache.set(rel, fs.readFileSync(path.join(root, rel), "utf8"));
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
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
        return {
            state: "could-not-look",
            dir: null,
            resolution: null,
            sentence:
                error.code === "ENOENT"
                    ? `${file} does not exist — that is not a workspace directory`
                    : `${file} could not be read — ${error.code ?? error.message}`,
        };
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

/** Ask every step whether it is owed. Three answers, and the third is not a shorter plan. */
export async function planFor(ws, ctx, steps) {
    const entries = [];
    let owed = 0;
    let unknown = 0;
    for (const step of steps) {
        const answer = await step.owed(ws, ctx);
        entries.push({ step, owed: answer.owed, because: answer.because });
        if (answer.owed === null) unknown += 1;
        else if (answer.owed === true) owed += 1;
    }
    return { entries, owed, unknown };
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
export function applyEdits(dir, edits) {
    const root = path.resolve(dir);
    const snapshots = [];
    for (const edit of edits) {
        const file = path.join(root, edit.file);
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

        // Deepest last, so a rollback can unwind in reverse. `lstat`, never `existsSync`: the latter
        // follows links and answers *false* for an unreadable path, which would turn "I could not
        // look" into "it is not there" — rule 3, at a third site.
        const created = [];
        for (let at = path.dirname(file); at.startsWith(root) && at !== root; at = path.dirname(at)) {
            try {
                fs.lstatSync(at);
                break;
            } catch (error) {
                if (error.code !== "ENOENT") {
                    return { ok: false, snapshots, reason: `${at} could not be examined — ${error.code ?? error.message}` };
                }
                created.unshift(at);
            }
        }
        try {
            for (const made of created) fs.mkdirSync(made);
        } catch (error) {
            return { ok: false, snapshots, reason: `${path.dirname(file)} could not be created — ${error.code ?? error.message}` };
        }

        const staging = `${file}.portulan-upgrade`;
        try {
            fs.writeFileSync(staging, edit.next);
            if (mode !== null) fs.chmodSync(staging, mode);
            fs.renameSync(staging, file);
        } catch (error) {
            try {
                fs.rmSync(staging, { force: true });
            } catch {
                /* the staging file is the lesser problem; the write failure is what gets reported */
            }
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
        const file = path.join(root, snapshot.file);
        try {
            if (snapshot.previous === null) {
                fs.rmSync(file, { force: true });
                // And the directories this run had to create for it, deepest first. Leaving them
                // behind would make "the workspace is exactly as it was" false in a second way —
                // quieter than a stray file, and still not true.
                for (const made of [...(snapshot.created ?? [])].reverse()) {
                    try {
                        fs.rmdirSync(made);
                    } catch {
                        break; // not empty, or not ours to remove: stop rather than force
                    }
                }
            } else {
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
        "A pointer is resolved through the host's installed-plugin record and reported; the workspace",
        "it names is migrated at its own directory, never inside the install.",
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
            if (argv[i + 1] === undefined) {
                warn("upgrade: `--tree` needs a value — it is the one thing this tool will not guess");
                return 2;
            }
            tree = argv[i + 1];
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
        steps = await loadSteps();
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
        const planned = await entry.step.plan(current, ctx);
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
