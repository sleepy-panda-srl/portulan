#!/usr/bin/env node
// `upgrade` — migrate a workspace, in either residence.
//
// Exit 0 succeeded · 1 a step owed under `--check` or left by hand, a red workspace, an unresolved pointer · 2 could not run.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { inspect, schemaVersion } from "./doctor.mjs";
import { resolveGovernor } from "./discover.mjs";
import { gitIn } from "./form.mjs";
import { offerLines } from "./sessions.mjs";
import { walk } from "./vendor.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE = path.resolve(HERE, "..");
const MIGRATIONS = path.join(BUNDLE, "spec", "migrations");

let stagingSeq = 0;

/** Everything that means `upgrade` could not run. Carries no verdict about a workspace. */
export class UpgradeError extends Error {}

/** The Workspace Definition version this bundle implements, read from its schema's `$id`. */
export function bundleSpec({ schemaPath } = {}) {
    const file = schemaPath ?? path.join(BUNDLE, "spec", "workspace.schema.json");
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
            throw new UpgradeError(`${file} declares id \`${step.id}\`, which is not its filename — the id is the chain's order`);
        }
        steps.push(step);
    }
    return steps;
}

/** Read a workspace into the view a step is given, as `spec/migrations/README.md` defines it. */
export function readWorkspace(dir) {
    const root = path.resolve(dir);
    const file = path.join(root, "workspace.json");

    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    } catch (error) {
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
        return { ok: false, code: 2, reason: `${root} could not be read for migration — ${error.message}` };
    }

    const cache = new Map();
    return {
        ok: true,
        ws: {
            dir: root,
            manifest,
            manifestText: text,
            repository: repositoryView(root, manifest),
            list: () => files,
            read: (rel) => {
                const at = inside(root, rel);
                if (at === null) throw new UpgradeError(`\`${rel}\` resolves outside ${root} — refusing to read there`);
                if (!cache.has(rel)) cache.set(rel, fs.readFileSync(at, "utf8"));
                return cache.get(rel);
            },
        },
    };
}

/** The repository the manifest's `tree` names, as a step reads it; `null` where it names no directory. */
export function repositoryView(root, manifest) {
    if (typeof manifest?.tree !== "string") return null;
    const dir = path.resolve(root, manifest.tree);
    try {
        if (!fs.statSync(dir).isDirectory()) return null;
    } catch {
        return null;
    }
    const cache = new Map();
    let git;
    return {
        dir,
        read: (rel) => {
            const at = inside(dir, rel);
            if (at === null) throw new UpgradeError(`\`${rel}\` resolves outside ${dir} — refusing to read there`);
            const linked = linkOnPath(dir, at);
            if (linked !== null) throw new UpgradeError(linked.replace("write through", "read through"));
            if (!cache.has(rel)) {
                try {
                    cache.set(rel, fs.readFileSync(at, "utf8"));
                } catch (error) {
                    if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw new UpgradeError(`${at} could not be read — ${error.code ?? error.message}`);
                    cache.set(rel, null);
                }
            }
            return cache.get(rel);
        },
        names: (rel) => {
            const at = inside(dir, rel);
            if (at === null) throw new UpgradeError(`\`${rel}\` resolves outside ${dir} — refusing to list there`);
            const linked = linkOnPath(dir, at);
            if (linked !== null) throw new UpgradeError(linked.replace("write through", "list through"));
            try {
                return fs.readdirSync(at);
            } catch (error) {
                if (error.code === "ENOENT" || error.code === "ENOTDIR") return [];
                throw new UpgradeError(`${at} could not be listed — ${error.code ?? error.message}`);
            }
        },
        get git() {
            if (git === undefined) git = gitIn(dir);
            return git;
        },
    };
}

export async function resolveTarget(dir, options = {}) {
    const root = path.resolve(dir);
    const file = path.join(root, "workspace.json");
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

export async function planFor(ws, ctx, steps) {
    const entries = [];
    let owed = 0;
    let unknown = 0;
    for (const step of steps) {
        let answer;
        try {
            answer = await step.owed(ws, ctx);
            if (answer === null || typeof answer !== "object" || ![true, false, null].includes(answer.owed)) {
                answer = { owed: null, because: `${step.id} returned no usable verdict from \`owed\` (${JSON.stringify(answer?.owed)})` };
            } else if (typeof answer.because !== "string" || answer.because === "") {
                answer = { owed: answer.owed, hand: answer.hand, because: `${step.id} gave no reason` };
            }
        } catch (error) {
            answer = { owed: null, because: `${step.id} threw while deciding whether it is owed — ${error.message}` };
        }
        // `hand`: owed, and placed by a person rather than by the step, so `--write` reports it and runs on.
        entries.push({ step, owed: answer.owed, because: answer.because, hand: answer.owed === true && answer.hand === true });
        if (answer.owed === null) unknown += 1;
        else if (answer.owed === true) owed += 1;
    }
    return { entries, owed, unknown };
}

/** `rel` resolved inside `root`, or `null` if it escapes: `path.join` would pass an absolute `rel` as inside. */
export function inside(root, rel) {
    const resolved = path.resolve(root, rel);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
    return resolved;
}

/** A reason to refuse, or `null`; `root` itself is not checked, since macOS's `os.tmpdir()` runs through `/var`. */
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

/** `dirs` as created, shallowest first; one that will not go is not empty, and neither are its parents. */
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

export function applyEdits(dir, edits, options = {}) {
    const write = options.write ?? fs.writeFileSync;
    const workspaceRoot = path.resolve(dir);
    const treeRoot = typeof options.treeDir === "string" ? path.resolve(options.treeDir) : null;
    const snapshots = [];
    for (const edit of edits) {
        if (edit.root !== undefined && edit.root !== "workspace" && edit.root !== "tree") {
            return { ok: false, snapshots, reason: `an edit names root \`${edit.root}\`, which is neither the workspace nor the tree` };
        }
        if (edit.root === "tree" && treeRoot === null) {
            return { ok: false, snapshots, reason: `an edit to \`${edit.file}\` names the tree, and this workspace declares none` };
        }
        const root = edit.root === "tree" ? treeRoot : workspaceRoot;
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

        if (edit.next === null) {
            if (previous === null) continue;
            if (!fs.lstatSync(file).isFile()) return { ok: false, snapshots, reason: `${file} is not a regular file — refusing to delete it` };
            try {
                fs.rmSync(file);
            } catch (error) {
                return { ok: false, snapshots, reason: `${file} could not be deleted — ${error.code ?? error.message}` };
            }
            snapshots.push({ file: edit.file, root: edit.root, previous, mode, created: [], deleted: true });
            continue;
        }

        // `lstat`, not `existsSync`, which follows links and answers `false` for a path it could not read.
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

        // No snapshot owns these until the rename lands, so every failure before it unwinds them.
        const created = [];
        try {
            for (const dir of wanted) {
                try {
                    fs.mkdirSync(dir);
                    created.push(dir);
                } catch (error) {
                    // Made by another since the probe: fine if a directory, and not this run's to remove.
                    if (error.code !== "EEXIST" || !fs.lstatSync(dir).isDirectory()) throw error;
                }
            }
        } catch (error) {
            unwindDirs(created);
            return { ok: false, snapshots, reason: `${path.dirname(file)} could not be created — ${error.code ?? error.message}` };
        }

        // Unique per process and edit, and beside its file so the rename stays atomic.
        const staging = `${file}.portulan-upgrade.${process.pid}.${stagingSeq++}`;
        try {
            // `wx`: anything already at the staging path, a planted symlink included, fails rather than being followed.
            write(staging, edit.next, { flag: "wx" });
            const keep = mode ?? edit.mode ?? null;
            if (keep !== null) fs.chmodSync(staging, keep);
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
        snapshots.push({ file: edit.file, root: edit.root, previous, mode, created });
    }
    return { ok: true, snapshots };
}

export function restore(dir, snapshots, options = {}) {
    const workspaceRoot = path.resolve(dir);
    const treeRoot = typeof options.treeDir === "string" ? path.resolve(options.treeDir) : null;
    const restored = [];
    const failed = [];
    // Last edit first: a directory two edits share is recorded on the first, and empties only after the second.
    for (const snapshot of [...snapshots].reverse()) {
        // Contained again, as `restore` is exported and a snapshot may come from any caller.
        const root = snapshot.root === "tree" ? treeRoot : workspaceRoot;
        const file = root === null ? null : inside(root, snapshot.file);
        if (file === null || linkOnPath(root, file) !== null) {
            failed.push(snapshot.file);
            continue;
        }
        try {
            if (snapshot.previous === null) {
                fs.rmSync(file, { force: true });
                unwindDirs(snapshot.created ?? []);
            } else {
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
        "A pointer is resolved through the host's installed-plugin record; the installed workspace is",
        "read and reported on, and `--write` is refused there — migrate it at its own directory.",
        "",
        "Exit codes: 0 succeeded · 1 a red verdict, or a step owed by hand under --check or --write · 2 could not run.",
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
    const relative = path.relative(process.cwd(), ws.dir);
    const shown = relative && relative.length < ws.dir.length ? relative : ws.dir;

    const offerCacheLifetime = (manifest) => {
        if (check || target.state === "resolved") return;
        if (manifest?.kind !== "repository" || manifest?.sessions?.cache_lifetime !== undefined) return;
        for (const line of offerLines()) say(`upgrade: ${line}`);
    };

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
    const ctx = { bundle: BUNDLE, spec, tree, today: options.today ?? new Date().toISOString().slice(0, 10) };
    const plan = await planFor(ws, ctx, steps);

    if (plan.unknown > 0) {
        for (const entry of plan.entries.filter((e) => e.owed === null)) {
            warn(`upgrade: ${entry.step.id} could not tell — ${entry.because}`);
        }
        warn("upgrade: refusing to report a workspace current while a step could not answer — nothing looked is never nothing wrong");
        return 2;
    }

    if (behindByMajor && plan.owed === 0) {
        warn(
            `upgrade: ${shown} declares ${major}.${minor} and no migration in this chain reaches it — refusing to ` +
                `report it current when this bundle implements ${spec.major}.${spec.minor} and doctor will not grade it`,
        );
        return 2;
    }

    if (plan.owed === 0) {
        say(`upgrade: ${shown} owes nothing — it is current at ${major}.${minor}`);
        offerCacheLifetime(ws.manifest);
        return 0;
    }

    for (const entry of plan.entries.filter((e) => e.owed === true)) {
        say(`upgrade: ${entry.step.id} (${entry.step.kind}${entry.hand ? ", by hand" : ""}) — ${entry.step.title}`);
        say(`upgrade:   ${entry.because}`);
    }

    const byHandOwed = plan.entries.filter((entry) => entry.hand).length;
    const byHandNote = byHandOwed > 0 ? `, ${byHandOwed} of them by hand` : "";
    const advice =
        target.state === "resolved"
            ? "run this against the workspace's own directory and republish — an installed copy is not migrated in place"
            : byHandOwed === plan.owed
              ? "add what each names by hand, then upgrade again"
              : `run with --write to apply ${byHandOwed > 0 ? "the rest" : "them"}`;

    if (check) {
        warn(`upgrade: ${shown} owes ${plan.owed} step(s)${byHandNote} — ${advice}`);
        return 1;
    }
    if (!write) {
        say(`upgrade: ${plan.owed} step(s) owed${byHandNote}. Nothing was written — ${advice}`);
        offerCacheLifetime(ws.manifest);
        return 0;
    }

    // ---- apply, one step at a time, re-reading between them
    let snapshots = [];
    let current = ws;
    // A step may declare the tree but none moves it, so every snapshot was made in the latest one.
    let treeDir = ws.repository?.dir ?? null;
    const undo = () => {
        const result = restore(current.dir, snapshots, { treeDir });
        if (!result.ok) {
            warn(`upgrade: the rollback was INCOMPLETE — put back ${result.restored.join(", ") || "nothing"}; NOT put back ${result.failed.join(", ")}`);
            return false;
        }
        return true;
    };

    const applied = new Set();
    const byHand = new Map();
    const apply = async (entry) => {
        applied.add(entry.step.id);
        // A step's `plan` is foreign code: a throw becomes a refusal, so the rollback still runs.
        let planned;
        try {
            planned = await entry.step.plan(current, ctx);
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
        const edited = applyEdits(current.dir, planned.edits, { treeDir });
        snapshots = [...snapshots, ...edited.snapshots];
        if (!edited.ok) {
            if (!undo()) return 2;
            warn(`upgrade: ${entry.step.id} — ${edited.reason}`);
            return 2;
        }
        const again = readWorkspace(current.dir);
        if (!again.ok) {
            if (!undo()) return 2;
            warn(`upgrade: ${shown} could not be re-read after ${entry.step.id} — ${again.reason}`);
            return 2;
        }
        current = again.ws;
        treeDir = current.repository?.dir ?? treeDir;
        return null;
    };
    // A step can make an earlier one owed, so the chain is asked again until a pass applies nothing.
    for (let pass = 0; ; pass++) {
        let appliedNow = 0;
        for (const entry of plan.entries) {
            let asked = entry;
            if (applied.size > 0 || entry.owed !== true) {
                [asked] = (await planFor(current, ctx, [entry.step])).entries;
                if (asked.owed === null) {
                    if (!undo()) return 2;
                    warn(`upgrade: ${entry.step.id} could not tell, after the steps before it — ${asked.because}. Rolled back`);
                    return 2;
                }
            }
            byHand.delete(entry.step.id);
            if (asked.owed !== true) continue;
            if (asked.hand) {
                byHand.set(entry.step.id, asked.because);
                continue;
            }
            if (pass > 0 || entry.owed !== true) {
                say(`upgrade: ${entry.step.id} (${entry.step.kind}) — ${entry.step.title}`);
                say(`upgrade:   ${asked.because}`);
            }
            const refused = await apply(entry);
            if (refused !== null) return refused;
            appliedNow += 1;
        }
        if (appliedNow === 0) break;
        if (pass === plan.entries.length) {
            if (!undo()) return 2;
            warn(`upgrade: the steps did not settle — pass ${pass + 1} still applied ${appliedNow}, and a chain of ${plan.entries.length} settles in fewer. Rolled back`);
            return 2;
        }
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

    const named = (s) => {
        const at = s.root === "tree" ? path.relative(current.dir, path.resolve(treeDir, s.file)).split(path.sep).join("/") : s.file;
        return s.deleted ? `${at} (deleted)` : at;
    };
    const written = [...new Set(snapshots.map(named))];
    if (applied.size > 0) say(`upgrade: applied ${applied.size} step(s) to ${shown} — ${written.join(", ")}. doctor is green`);
    const left = plan.entries.filter((entry) => byHand.has(entry.step.id));
    for (const entry of left) warn(`upgrade: ${entry.step.id} is owed and not placed — ${byHand.get(entry.step.id)}`);
    offerCacheLifetime(current.manifest);
    return left.length > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = await run(process.argv.slice(2));
}
