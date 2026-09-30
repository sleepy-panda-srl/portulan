#!/usr/bin/env node
// A change to a pack's `contributes` must move that pack's `portulan.version`.
//
// Exit 0 every changed pack moved its version · 1 one did not · 2 could not run.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Raised when the check cannot run, or cannot judge honestly. Always exit 2, never 1. */
export class CannotRun extends Error {}

const DEFAULT_BASE = "origin/main";

function git(root, args, what) {
    try {
        return execFileSync("git", ["-C", root, ...args], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
    } catch (cause) {
        throw new CannotRun(`git could not ${what} — ${cause.stderr?.toString().trim() || cause.message}`);
    }
}

// `base` is user-supplied; `--end-of-options` keeps a leading `-` from reading as a flag (`--` means paths).
const END = "--end-of-options";

/** The merge-base of `base` and HEAD: comparing from it, never from `base`, leaves upstream changes out. */
export function mergeBase(root, base = DEFAULT_BASE) {
    const shallowHint =
        "`actions/checkout` is shallow by default — `../cli/librarian.mjs` calls that the normal clone rather than a " +
        "theoretical one — so the usual repair is `fetch-depth: 0` on the job running this check; see .github/workflows/verify.yml.";
    try {
        git(root, ["rev-parse", "--verify", END, `${base}^{commit}`], `resolve ${base}`);
    } catch (cause) {
        throw new CannotRun(
            `could not resolve base ref \`${base}\` — refusing to report a verdict against a ref nothing could read. ` +
                `The usual cause is a SHALLOW single-branch clone, which does not fetch it at all; a typo or an ` +
                `unfetched remote look the same from here, and so does a repository that cannot be read at all. ` +
                `${shallowHint} — git said: ${cause.message}`,
        );
    }
    try {
        return git(root, ["merge-base", END, base, "HEAD"], `find the merge-base of ${base} and HEAD`).trim();
    } catch (cause) {
        throw new CannotRun(
            `no merge-base between \`${base}\` and HEAD, though the ref itself resolved — a SHALLOW clone that fetched ` +
                `the ref and truncated its history looks exactly like this, as do genuinely unrelated histories. ` +
                `${shallowHint} — git said: ${cause.message}`,
        );
    }
}

/** `lstat`, because `existsSync` follows a symlink and answers false for a dangling one. */
function presentOnDisk(file) {
    try {
        fs.lstatSync(file);
        return true;
    } catch {
        return false;
    }
}

/** `--packs`, canonical and repository-relative, so the disk scan and `git ls-tree` spell a pack alike. */
export function insideRepo(value) {
    if (path.isAbsolute(value)) {
        throw new CannotRun(
            `--packs ${value} is an absolute path — this flag names a directory RELATIVE to the repository root, and ` +
                `joining an absolute path would silently re-root it under the repository instead of refusing.`,
        );
    }
    const canonical = path.normalize(value).split(path.sep).join("/").replace(/\/+$/, "");
    if (canonical === "" || canonical === "." || canonical === ".." || canonical.startsWith("../")) {
        throw new CannotRun(
            `--packs ${value} resolves to ${JSON.stringify(canonical)}, which is not a directory inside the repository — ` +
                `refusing to scan somewhere this check has no business reading.`,
        );
    }
    return canonical;
}

export function packManifests(root, packsDir = "packs") {
    const base = path.join(root, packsDir);
    const found = [];
    const read = (dir, what) => {
        try {
            return fs.readdirSync(dir, { withFileTypes: true });
        } catch (cause) {
            if (cause.code === "ENOENT") return null;
            throw new CannotRun(
                `cannot read ${what} at ${dir} — ${cause.code ?? cause.message}. Refusing to report an empty set of packs ` +
                    `as a clean one: an enumeration that could not run is not a finding that nothing changed.`,
            );
        }
    };
    const categories = read(base, `the packs directory`);
    if (categories === null) return [];
    for (const category of categories) {
        if (!category.isDirectory()) continue;
        const packs = read(path.join(base, category.name), `the pack category \`${category.name}\``);
        if (packs === null) continue;
        for (const pack of packs) {
            if (!pack.isDirectory()) continue;
            const rel = [packsDir, category.name, pack.name, "pack.json"].join("/");
            if (presentOnDisk(path.join(root, rel))) found.push(rel);
        }
    }
    return found.sort();
}

/** A manifest at `commit`, or `null` where the caller's `ls-tree` listing lacks it; a failed read throws. */
export function manifestAt(root, commit, rel, present) {
    if (!present) return null;
    const raw = git(root, ["show", `${commit}:${rel}`], `read ${rel} at ${commit.slice(0, 7)}`);
    try {
        return JSON.parse(raw);
    } catch (cause) {
        throw new CannotRun(
            `${rel} at ${commit.slice(0, 7)} is not valid JSON — ${cause.message}. Refusing a verdict on a manifest ` +
                `this check cannot read; \`json\` and \`doctor\` are the tools that judge manifest validity.`,
        );
    }
}

export function manifestHere(root, rel) {
    const file = path.join(root, rel);
    try {
        // `lstat`, not `stat`: a dangling symlink is there and unreadable, never a deleted pack.
        fs.lstatSync(file);
    } catch (cause) {
        if (cause.code === "ENOENT") return null;
        throw new CannotRun(
            `cannot stat ${rel} — ${cause.code ?? cause.message}. Refusing to report it as removed: this is a fact ` +
                `about the filesystem, not about the pack.`,
        );
    }
    let raw;
    try {
        raw = fs.readFileSync(file, "utf8");
    } catch (cause) {
        throw new CannotRun(
            `cannot read ${rel} — ${cause.code ?? cause.message}. The path exists, so this is not a removal: a ` +
                `dangling symlink, an unreadable mode or a directory in its place all land here.`,
        );
    }
    try {
        return JSON.parse(raw);
    } catch (cause) {
        throw new CannotRun(`${rel} is not valid JSON — ${cause.message}. Refusing a verdict on a manifest this check cannot read.`);
    }
}

/** Deep equality over parsed JSON, so a reformatted manifest is not a changed one. */
export function sameValue(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
        // Order is significant: gate fragments apply in the order they are listed.
        return a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
    }
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i]) && ka.every((k) => sameValue(a[k], b[k]));
}

export function judge(rel, before, after) {
    if (after === null) return { rel, verdict: "deleted", why: "the pack was removed" };
    if (before === null) {
        return { rel, verdict: "added", why: "the pack is new — nothing to bump from" };
    }
    // The block alone: a file it points at, such as a skill's `SKILL.md`, can change unseen.
    if (sameValue(before?.contributes, after?.contributes)) {
        return { rel, verdict: "unchanged", why: "`contributes` is unchanged" };
    }
    const was = before?.portulan?.version;
    const now = after?.portulan?.version;
    if (typeof now !== "string" || now === "") {
        return {
            rel,
            verdict: "unversioned",
            why:
                "`contributes` changed and this pack declares no `portulan.version` to move. The field is optional in " +
                "`spec/pack.schema.json`, and its own description calls it how independent versioning is expressed — " +
                "declare one, because a consumer pinning this pack has nothing else to pin on",
        };
    }
    if (now === was) {
        return {
            rel,
            verdict: "stale",
            why: `\`contributes\` changed and \`portulan.version\` stayed at \`${now}\`. A prose-only edit to a fragment's \`reason\` counts — it is the sentence the gate runner shows a human`,
        };
    }
    return { rel, verdict: "ok", why: `\`contributes\` changed and \`portulan.version\` moved \`${was ?? "(absent)"}\` → \`${now}\`` };
}

/** Every pack against the merge-base; a `packsDir` the caller named that neither tree holds is refused. */
export function compare(root, { base = DEFAULT_BASE, packsDir = "packs", packsNamed = false } = {}) {
    const at = mergeBase(root, base);
    const here = packManifests(root, packsDir);
    const there = git(root, ["ls-tree", "-r", "--name-only", at, "--", `${packsDir}/`], `list packs at ${at.slice(0, 7)}`)
        .split("\n")
        .filter((line) => line.endsWith("/pack.json"));
    if (packsNamed && here.length === 0 && there.length === 0 && !presentOnDisk(path.join(root, packsDir))) {
        throw new CannotRun(
            `--packs ${packsDir} names a directory that exists neither in the working tree nor at the merge-base. ` +
                `Refusing to report green having examined nothing: an empty set is a verdict about packs, and this is a ` +
                `verdict about the path you typed. (The DEFAULT \`packs/\` being absent is different — that is a ` +
                `workspace which composes nothing, and it passes.)`,
        );
    }
    const atBase = new Set(there);
    const all = [...new Set([...here, ...there])].sort();
    return {
        at,
        results: all.map((rel) => judge(rel, manifestAt(root, at, rel, atBase.has(rel)), manifestHere(root, rel))),
    };
}

function usage() {
    return [
        "pack-version — a change to a pack's `contributes` must move its `portulan.version`",
        "",
        "  node cli/pack-version.mjs [--base <ref>] [--packs <dir>] [<repository-root>]",
        "",
        "  --base    what to compare against; default `origin/main`. Compared THREE-DOT: the merge-base",
        "            of this ref and HEAD, which is what a pull request shows",
        "  --packs   the packs directory, relative to the repository root; default `packs`",
        "",
        "Ruled on #265: the whole `contributes` block, and a prose-only edit to a `reason` counts.",
        "",
        "Exit codes: 0 green · 1 a red verdict · 2 could not run.",
    ].join("\n");
}

export function run(argv = [], { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
    // First, so a request for help is never outranked by a complaint about the other arguments.
    if (argv.includes("--help") || argv.includes("-h")) {
        stdout.write(`${usage()}\n`);
        return 0;
    }
    let base = DEFAULT_BASE;
    let packsDir = "packs";
    let packsNamed = false;
    let root = null;
    try {
        for (let i = 0; i < argv.length; i += 1) {
            if (argv[i] === "--base" || argv[i] === "--packs") {
                const which = argv[i];
                const value = argv[i + 1];
                i += 1;
                if (value === undefined || value.startsWith("-")) throw new CannotRun(`${which} needs a value`);
                if (which === "--base") base = value;
                else {
                    packsDir = insideRepo(value);
                    packsNamed = true;
                }
            } else if (argv[i].startsWith("-")) {
                throw new CannotRun(`unknown argument ${JSON.stringify(argv[i])}`);
            } else if (root === null) {
                root = argv[i];
            } else {
                throw new CannotRun(`unexpected second repository root ${JSON.stringify(argv[i])}`);
            }
        }
        const where = path.resolve(root ?? cwd);
        const top = git(where, ["rev-parse", "--show-toplevel"], `find a git repository at ${where}`).trim();

        const { at, results } = compare(top, { base, packsDir, packsNamed });
        const red = results.filter((r) => r.verdict === "stale" || r.verdict === "unversioned");
        const moved = results.filter((r) => r.verdict === "ok");

        stdout.write(`pack-version: comparing against \`${base}\` at merge-base ${at.slice(0, 7)} (three-dot)\n`);
        // Every pack is printed, green included, so a green shows what was examined.
        for (const r of results) {
            stdout.write(`  ${r.verdict.padEnd(12)} ${r.rel}${r.verdict === "ok" ? ` — ${r.why}` : ""}\n`);
        }
        if (results.length === 0) stdout.write("  (no pack manifests here or at the merge-base — nothing to check)\n");

        if (red.length === 0) {
            stdout.write(`\nok  ${moved.length} pack(s) changed \`contributes\` and moved their version; ${results.length} examined\n`);
            return 0;
        }
        stderr.write("\n");
        for (const r of red) stderr.write(`RED  ${r.rel} — ${r.why}\n`);
        stderr.write(`\n${red.length} pack(s) changed \`contributes\` without moving \`portulan.version\` (#265).\n`);
        return 1;
    } catch (error) {
        if (error instanceof CannotRun) {
            stderr.write(`pack-version: ${error.message}\n`);
            return 2;
        }
        stderr.write(`pack-version: CRASHED — ${error?.stack ?? error}\n`);
        stderr.write("pack-version: reporting could-not-run (2) rather than a red verdict — a defect in this checker is not a finding about the work.\n");
        return 2;
    }
}

function isMain() {
    return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}

if (isMain()) {
    process.exitCode = run(process.argv.slice(2));
}
