#!/usr/bin/env node
// Every prose statement of the current version agrees with `package.json`.
//
// Exit 0 green · 1 a finding · 2 could not run.

import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

export class CouldNotRun extends Error {}

// Each captures the version in group 1; a claim spelled any other way goes unseen until it gets a pattern here.
export const PATTERNS = [
    { id: "current-release", re: /\*\*Current release:\s*`([^`]+)`\*\*/g },
    { id: "newest-entry", re: /newest release entry is\s*`([^`]+)`/g },
    { id: "supported-current", re: /\|\s*`([^`]+)`\s*\|\s*Yes\s*—\s*the current release\s*\|/g },
];

export const MUST_CARRY = ["README.md", "SECURITY.md", ".portulan/products/portulan/product.md"];

// The record layer. These files preserve sentences that are no longer true, on purpose.
export const RECORD_PREFIXES = [
    "CHANGELOG.md",
    "changes/",
    "evals/releases/",
    "docs/plan.md",
    "docs/milestones/",
    ".portulan/handoffs/",
    ".portulan/proposals/",
    ".portulan/tasks/",
    ".portulan/memory/",
];

export const isRecord = (p) => RECORD_PREFIXES.some((r) => (r.endsWith("/") ? p.startsWith(r) : p === r));

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
        // From the index, like the prose: a version read from the worktree would grade staged prose against another tree.
        raw = execFileSync("git", ["-C", root, "show", ":package.json"], { encoding: "utf8" });
    } catch (e) {
        throw new CouldNotRun(`could not read package.json from the index: ${e.message}`);
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
            // The index, not the worktree: a reverted worktree copy would hide a staged drift the commit ships.
            text = execFileSync("git", ["-C", root, "show", `:${rel}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
        } catch (e) {
            // Not `continue`: skipping a file git just listed would report green over prose never read.
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

// URLs on both sides, since `import.meta.url` percent-encodes; the realpath covers a symlinked npm `bin`.
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

// `exitCode`, not `exit()`, so a pipe that has not drained is not cut short.
if (isMain()) process.exitCode = main(process.argv.slice(2));
