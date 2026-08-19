#!/usr/bin/env node
// Portulan — every prose statement of the CURRENT version agrees with `package.json`.
//
// ## The defect this exists for
//
// `README.md` and `.portulan/products/portulan/product.md` both said the newest release entry was
// `0.2.0` while `package.json`, both plugin manifests and the registry said `0.1.0`. They were fixed
// together — and then, one release later, the SAME PAIR drifted again: `README.md` still read
// "Current release: `0.1.0`" inside the change that cut `0.1.1`. Twice, with the pairing already
// written down in `docs/plan.md` both times.
//
// **A sibling list in prose is not a rail.** This is the rail.
//
// It matters more than a tidy number because `README.md` is in `package.json`'s `files`, and npm
// FREEZES a README per published version: a wrong current-version sentence that reaches a publish
// cannot be corrected by any edit to `main`, only by cutting another release. That is exactly what
// `0.1.1` was for.
//
// ## Why the record layer is excluded, which is the whole design
//
// This repository writes about its own defects, so the retired sentences are QUOTED in the files that
// record fixing them: `CHANGELOG.md` carries *"The newest release entry is `0.2.0`"* inside the entry
// explaining that it was retired, and two handoffs plus `docs/plan.md` do the same. A matcher over
// everything reds on the repository's own account of the repair — the failure mode #286 measured,
// where both arms it proposed died on this repository's own review corpus.
//
// So the scan is scoped to LIVE prose and the record layer is excluded BY PATH. The exclusion is not
// a convenience: a dated record is supposed to preserve a sentence that is no longer true, and a rail
// that forbids that would forbid the record.
//
// ## What it cannot do, stated rather than discovered
//
// A current-version claim spelled a NEW way, in any file, is invisible to it. There is no way to tell
// "this prose asserts the current version" from "this prose mentions a version" without a matcher, and
// a matcher only knows the spellings it was given. The accepted practice for that residual is #286's,
// ruled by the maintainer: **a new spelling gets a pattern here and a fixture first.**
//
// The half that IS closed beyond drift: every file in MUST_CARRY has to produce at least one match, so
// deleting or rewording a known carrier reds instead of silently shrinking the rail's reach.
//
// Three further residuals, named because an unstated limit is the one a reader assumes away:
//   · A live claim placed UNDER an excluded prefix is invisible. `.portulan/memory/` in particular
//     holds doctrine-shaped notes rather than only dated records, so a current-version sentence
//     written there would not be checked.
//   · An UNTRACKED carrier is invisible: enumeration is `git ls-files`, deliberately, because a rail
//     that reads the working tree grades files no commit will ever contain.
//   · A NON-MARKDOWN carrier is invisible: the pathspec is `*.md`.
//
// Exit 0 green · 1 a finding · 2 could not run.

import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

/** Raised when a precondition fails. Always exit 2 — never a finding about the prose. */
export class CouldNotRun extends Error {}

// The spellings that assert a current version. Each must capture the version in group 1.
export const PATTERNS = [
    { id: "current-release", re: /\*\*Current release:\s*`([^`]+)`\*\*/g },
    { id: "newest-entry", re: /newest release entry is\s*`([^`]+)`/g },
    { id: "supported-current", re: /\|\s*`([^`]+)`\s*\|\s*Yes\s*—\s*the current release\s*\|/g },
];

// Files that MUST carry at least one claim. Losing one is a finding: it means a carrier was deleted
// or reworded, which is how this rail would otherwise quietly stop covering what it was built for.
export const MUST_CARRY = ["README.md", "SECURITY.md", ".portulan/products/portulan/product.md"];

// The record layer. These files preserve sentences that are no longer true, on purpose.
export const RECORD_PREFIXES = [
    "CHANGELOG.md",
    "docs/plan.md",
    "docs/milestones/",
    ".portulan/handoffs/",
    ".portulan/proposals/",
    ".portulan/tasks/",
    ".portulan/memory/",
];

export const isRecord = (p) => RECORD_PREFIXES.some((r) => (r.endsWith("/") ? p.startsWith(r) : p === r));

/** Every tracked Markdown file that is not part of the record layer. Derived, never a written list. */
export function liveProseFiles(root) {
    let out;
    try {
        out = execFileSync("git", ["-C", root, "ls-files", "-z", "--", "*.md"], { encoding: "utf8" });
    } catch (e) {
        throw new CouldNotRun(`could not enumerate tracked files: ${e.message}`);
    }
    const all = out.split("\0").filter(Boolean);
    if (all.length === 0) throw new CouldNotRun("git listed no Markdown files — refusing to report green over an empty scan");
    return all.filter((p) => !isRecord(p));
}

export function declaredVersion(root) {
    let raw;
    try {
        raw = readFileSync(join(root, "package.json"), "utf8");
    } catch (e) {
        throw new CouldNotRun(`could not read package.json: ${e.message}`);
    }
    let v;
    try {
        v = JSON.parse(raw).version;
    } catch (e) {
        throw new CouldNotRun(`package.json is not valid JSON: ${e.message}`);
    }
    if (typeof v !== "string" || !v.trim()) throw new CouldNotRun("package.json declares no version string");
    return v;
}

/** Every current-version claim in one file's text, with the line it sits on. */
export function claimsIn(text) {
    const found = [];
    for (const { id, re } of PATTERNS) {
        // A fresh RegExp per call: a `g` regex carries lastIndex, and a shared one skips matches.
        const rx = new RegExp(re.source, re.flags);
        let m;
        while ((m = rx.exec(text)) !== null) {
            found.push({ pattern: id, version: m[1], line: text.slice(0, m.index).split("\n").length });
        }
    }
    return found;
}

export function inspect(root) {
    const version = declaredVersion(root);
    const files = liveProseFiles(root);
    const findings = [];
    const carried = new Set();
    let claimCount = 0;

    for (const rel of files) {
        let text;
        try {
            // The INDEX, not the working tree — `pack-identity` reads the same way and for the same
            // reason. Enumerating from the index and then reading the worktree lets a staged drift
            // with a reverted worktree copy report green while the commit ships the drift.
            text = execFileSync("git", ["-C", root, "show", `:${rel}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
        } catch (e) {
            // NOT `continue`. `git ls-files` just named this path, so failing to read its blob means
            // the rail could not examine live prose it is responsible for — and skipping it would
            // report GREEN over a file never looked at. That is this session's defect class exactly,
            // and it was sitting inside the rail built against it. Could-not-run, never a green.
            throw new CouldNotRun(`could not read ${rel} from the index: ${e.message}`);
        }
        for (const c of claimsIn(text)) {
            claimCount++;
            carried.add(rel);
            if (c.version !== version)
                findings.push(`${rel}:${c.line} states the current version as \`${c.version}\`, but package.json declares \`${version}\` (${c.pattern})`);
        }
    }

    for (const rel of MUST_CARRY) {
        if (!carried.has(rel))
            findings.push(`${rel} carries no current-version claim this rail recognises — it was deleted or reworded, and the rail's reach shrank silently. Add a pattern in cli/version-carriers.mjs with a fixture, or restore the sentence.`);
    }

    return { version, filesScanned: files.length, claimCount, findings };
}

export function main(argv, stdout = process.stdout, stderr = process.stderr) {
    const root = argv[0] ?? ".";
    let r;
    try {
        r = inspect(root);
    } catch (e) {
        if (e instanceof CouldNotRun) {
            stderr.write(`version-carriers: could not run — ${e.message}\n`);
            return 2;
        }
        stderr.write(`version-carriers: could not run — unexpected failure: ${e.message}\n`);
        return 2;
    }
    if (r.findings.length) {
        for (const f of r.findings) stderr.write(`version-carriers: ${f}\n`);
        return 1;
    }
    stdout.write(`ok  version-carriers — ${r.claimCount} current-version claim(s) across ${r.filesScanned} live prose file(s) all read \`${r.version}\`\n`);
    return 0;
}

// The entry guard, in the ONE form `cli/rule-carriers.mjs` designates after this repository got it
// wrong twice. `file://${argv[1]}` is NOT that form: `import.meta.url` percent-encodes, this working
// copy lives under a path with spaces, and the comparison failed — so the tool exited 0 having run
// nothing. **A green that is the tool never starting**, shipped inside the rail built against exactly
// that. The realpath fallback covers the symlink case an npm `bin` produces, in a `try` because a
// missing path must answer no rather than throw.
function isMain() {
    const invoked = process.argv[1];
    if (!invoked) return false;
    if (import.meta.url === pathToFileURL(invoked).href) return true;
    try {
        return import.meta.url === pathToFileURL(realpathSync(invoked)).href;
    } catch {
        return false;
    }
}

// `process.exitCode` rather than `process.exit`, which `cli/control-chars.mjs:540` settled for this
// repository: exiting outright can truncate a pipe that has not drained. It matters more here than
// stylistically — a truncated `ok` line IS exit 0 with no output, which is the precise shape of the
// false green this file's entry guard was fixed for. The same defect, one door along.
if (isMain()) process.exitCode = main(process.argv.slice(2));
