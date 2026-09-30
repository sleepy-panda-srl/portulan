#!/usr/bin/env node
// Every file `npm pack` emits is byte-identical to the tracked blob it came from.
//
// Exit 0 every packed file matches its staged blob · 1 one differs or is untracked · 2 could not run.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

class CannotRun extends Error {}

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024, ...opts });

/** The paths `npm pack` would ship, relative to `root`. */
export function packedPaths(root) {
    let out;
    try {
        out = run("npm", ["pack", "--dry-run", "--json"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] }).toString("utf8");
    } catch (error) {
        throw new CannotRun(`\`npm pack --dry-run --json\` did not run: ${error.message.split("\n")[0]}`);
    }
    let parsed;
    try {
        parsed = JSON.parse(out);
    } catch {
        throw new CannotRun("`npm pack --dry-run --json` printed something that is not JSON");
    }
    const files = parsed?.[0]?.files;
    if (!Array.isArray(files) || files.length === 0) throw new CannotRun("`npm pack` reported no files — refusing to report a green over an empty roster");
    const paths = [];
    for (const [i, entry] of files.entries()) {
        const rel = entry?.path;
        if (typeof rel !== "string" || rel.length === 0) {
            throw new CannotRun(`\`npm pack\` reported an entry at index ${i} with no usable \`path\` — its JSON shape is not what this rail reads`);
        }
        paths.push(rel);
    }
    return paths;
}

/** The staged blob, not HEAD's, so staged work compares clean before its commit; null when the path is not tracked. */
function blobAt(root, rel) {
    try {
        return run("git", ["show", `:${rel}`], { cwd: root, stdio: ["ignore", "pipe", "ignore"] });
    } catch {
        return null;
    }
}

function containedPath(root, rel) {
    if (rel.includes("\0")) throw new CannotRun(`npm reported a path containing NUL — refusing to resolve it`);
    if (path.isAbsolute(rel)) throw new CannotRun(`npm reported an absolute path (${rel}); packed paths are repo-relative`);
    const resolved = path.resolve(root, rel);
    const base = path.resolve(root);
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
        throw new CannotRun(`npm reported a path that resolves outside the repository: ${rel}`);
    }
    let stat;
    try {
        stat = fs.lstatSync(resolved);
    } catch (error) {
        throw new CannotRun(`packed path ${rel} could not be stat'd: ${error.message.split("\n")[0]}`);
    }
    if (stat.isSymbolicLink()) throw new CannotRun(`packed path ${rel} is a symlink; its target is not what git carries`);
    if (!stat.isFile()) throw new CannotRun(`packed path ${rel} is not a regular file`);
    return resolved;
}

export function compare(root) {
    try {
        run("git", ["rev-parse", "--verify", "HEAD"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] });
    } catch {
        throw new CannotRun("not a git repository, or HEAD does not resolve");
    }
    const packed = packedPaths(root);
    const untracked = [];
    const differing = [];
    for (const rel of packed) {
        // `package.json` too, though npm may normalise it on pack: the same-bytes claim takes no exemption.
        const abs = containedPath(root, rel);
        const blob = blobAt(root, rel);
        if (blob === null) untracked.push(rel);
        else if (!blob.equals(fs.readFileSync(abs))) differing.push(rel);
    }
    return { packed, untracked, differing };
}

function main(argv, stdout, stderr) {
    const root = argv[2] ?? process.cwd();
    let result;
    try {
        result = compare(root);
    } catch (error) {
        if (error instanceof CannotRun) {
            stderr.write(`pack-identity: could not run — ${error.message}\n`);
            return 2;
        }
        // Rethrown, a crash would exit 1, which reads as a finding.
        stderr.write(`pack-identity: could not run — unexpected ${error?.name ?? "error"}: ${String(error?.message ?? error).split("\n")[0]}\n`);
        return 2;
    }
    const { packed, untracked, differing } = result;
    if (untracked.length === 0 && differing.length === 0) {
        stdout.write(`ok  pack-identity — all ${packed.length} packed file(s) are byte-identical to their staged blob\n`);
        return 0;
    }
    for (const rel of untracked) stderr.write(`pack-identity: ${rel} would ship but is NOT TRACKED — the package would carry a byte nobody reviewed\n`);
    for (const rel of differing) stderr.write(`pack-identity: ${rel} differs from \`git show :${rel}\` — the package would not install the tree's bytes\n`);
    stderr.write(`pack-identity: ${untracked.length + differing.length} of ${packed.length} packed file(s) failed; .portulan/identity.md's same-bytes claim does not hold\n`);
    return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = main(process.argv, process.stdout, process.stderr);
}
export { main };
