#!/usr/bin/env node
// Every file `npm pack` emits is byte-identical to the tracked blob it came from.
//
// The rail [#149](https://github.com/sleepy-panda-srl/portulan/issues/149) asked for, in the form that
// can actually run on every pull request. `.portulan/identity.md` states the property — **the `npx`
// path IS an install, and it installs the SAME BYTES** — and until 2026-08-18 nothing checked it: the
// figure was re-measured by hand three times (72 files, then 114, then 73) and was wrong in the tree
// twice between those measurements.
//
// ## Why this compares against the TREE and not against the registry
//
// The measurement taken at the first publish compared the published tarball to a fresh `npm pack`, and
// they hashed the same. That is the stronger claim and it is recorded on #149 — but it is the wrong
// shape for a recipe: it needs the network, it needs a published version to exist, and it cannot run
// before the first publish or on a machine offline. A recipe that cannot run is a recipe that stops
// being run.
//
// What this checks instead needs neither: `npm pack --dry-run --json` lists what the package would
// contain, and every one of those paths must be byte-identical to its STAGED blob, `git show :<path>`
// — the index rather than HEAD, for the reason the comment on `blobAt` gives. That is the
// property the registry comparison DEPENDS on — if the packed bytes match the tree, and the published
// tarball matches a fresh pack, then the published bytes are the tree's. This rail owns the first half,
// which is the half that can drift silently on any commit; the second half is a hand measurement taken
// at each publish, which is what #149 asked for and what its comment records.
//
// ## Exit codes, per ../.portulan/memory/verify-preconditions-fail-closed.md
//
//   0  every packed file matches its staged blob
//   1  a finding: at least one packed file differs from what is staged, or is not tracked at all
//   2  could not run: `npm pack` unusable, not a git repository, or HEAD unreadable
//
// The 2 matters more here than in most recipes. `npm pack` shells out to npm, which can be absent,
// offline-hostile, or a different major version — and a rail that reports "the bytes differ" when what
// happened is "npm did not run" sends someone hunting a drift that does not exist.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

class CannotRun extends Error {}

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024, ...opts });

/**
 * What the package would contain, as repo-relative paths.
 *
 * **Exported because `./payload.mjs` classifies exactly this roster**, and two enumerations of *what
 * npm would pack* is the second-carrier defect this repository keeps paying for. That rail asks which
 * files ship; this one asks whether each is byte-identical to its source. One question about
 * membership, asked once, answered here.
 */
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
    // The SHAPE is checked, not assumed. `files` is npm's JSON, and a changed schema or an odd entry
    // would otherwise yield `undefined` paths that crash further down — surfacing as an uncaught
    // exception the runner reads as a red FINDING about the package. npm's output is an input like any
    // other; a roster this tool cannot read is could-not-run.
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

// The blob is read from the INDEX (`git show :<path>`), not from HEAD, and the difference is the whole
// usability of this rail. `npm pack` reads the WORKING TREE, so comparing it to HEAD makes the recipe red
// for any uncommitted edit — and `.portulan/dod.md` requires every recipe green BEFORE a commit, which a
// check that can only pass after one contradicts. The index is what is about to become the commit, so
// staged work compares clean and unstaged work is correctly still a difference. In CI the distinction
// vanishes: `actions/checkout` leaves the index matching HEAD, so this reads exactly as HEAD there.
/** The staged blob for a path, or null when the path is not tracked. */
function blobAt(root, rel) {
    try {
        return run("git", ["show", `:${rel}`], { cwd: root, stdio: ["ignore", "pipe", "ignore"] });
    } catch {
        return null;
    }
}

// Every path npm reports is checked for CONTAINMENT before it is used, by RESOLUTION rather than by
// pattern — the shape `cli/eval-bundle.mjs` was hardened to on #280, for the same reason: a pattern
// test answers a question about a string, and what matters is where the filesystem actually goes.
// `rel` arrives from `npm pack`'s JSON, so it is not this tool's to trust: an absolute path, a `..`
// escape or an embedded NUL would send both `git show` and the read outside the repository, and the
// rail would then compare the wrong bytes and report GREEN. Refused as could-not-run, never as a
// finding — a path this tool will not resolve supports no verdict about the package.
//
// Symlinks are refused for the same reason and separately from containment: `readFileSync` follows
// them, so a link whose target sits outside the tree reads bytes git never carried while `git show`
// reads the link itself. `lstat` is what distinguishes them, and `realpath` alone would not.
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
        // `package.json` is the one path npm may rewrite on pack — it normalises fields. Compared like
        // every other file rather than exempted: the 2026-08-13 measurement asserted all 114 identical
        // "package.json included, with no exemption", and an exemption added here would quietly retire
        // that claim.
        const abs = containedPath(root, rel);
        const blob = blobAt(root, rel);
        if (blob === null) untracked.push(rel);
        // Read with `fs`, not by shelling out. `cat` would be an undeclared dependency this recipe's
        // `requires` does not list, and it takes its argument as an OPTION when a filename begins with
        // `-` — so a file named `-n` would silently be read as a flag rather than compared.
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
        // An unexpected throw is COULD-NOT-RUN, never a finding. Rethrowing would exit non-contractually
        // — node's own code, typically 1 — and the runner would read a crash in this rail as a verdict
        // about the package's bytes. `1` is reserved for a finding; this repository has a commit by that
        // name. The diagnostic names the rail so the exit is traceable to the thing that broke.
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

// The same guard `pack-version.mjs` uses. A bare path comparison is FALSE when npm installs a bin as a
// symlink — node realpaths the main module for `import.meta.url` while `process.argv[1]` keeps the link.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = main(process.argv, process.stdout, process.stderr);
}
export { main };
