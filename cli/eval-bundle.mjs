#!/usr/bin/env node
// Cut a named-recipient evaluation bundle of Portulan from a commit.
//
// Ported into the tree on the maintainer's ruling of 2026-08-17 — "this tool should live in the
// public tree as a reviewable product machinery" — from a script that lived beside the private
// issuance ledger. The LEDGER STAYS OUTSIDE THIS REPOSITORY, permanently: it records who received
// which bundle, and recipient data never enters this tree, its tests, or its pull requests. This
// file carries the mechanism only; stamping is parameter-driven. A copy with no ledger entry is
// not sent — issuance is recorded in a private ledger kept outside this repository, the same
// outside-the-repository arrangement `.portulan/dod.md` condition 5 states for the seam-term list.
//
// ## What a cut does
//
//   1. Materialises the PAYLOAD roster at a named commit — tracked blobs only, so neither local
//      state nor secrets can ride along — minus the SELF_EXCLUDED pair below.
//   2. Writes EVAL-LICENSE.md, stamped to the named recipient (name, GitHub login, date).
//   3. Replaces NOTICE with the evaluation-issue NOTICE.
//   4. Patches every machine-read `"license"` field (PATCHED_MANIFESTS) to `LicenseRef-Portulan-Eval`.
//   5. Rewrites README.md's own `## License` section and prepends the evaluation banner. The
//      section is patched rather than merely disclaimed from sixty lines above: an issued bundle
//      whose README says "Apache-2.0" with a link to a LICENSE file the roster deliberately drops
//      would contradict its own terms in the one file an evaluee actually opens. (The banner alone
//      was the shape of the first, pre-port issue; the section patch is this port's correction,
//      found at the session-open checkpoint.)
//   6. Writes EVAL-STAMP.json, carrying the recipient, the source commit, and a reproducible
//      content digest (see below).
//   7. Runs the guard over the finished cut, with TWO detectors: the canonical byte form
//      `"license": "Apache-2.0"` searched in every file, and every `.json` parsed with any
//      `license` key at any depth flagged when its string value mentions Apache — one spelling is
//      not a category, and the byte form alone passed `"license":"Apache-2.0"` (no space) at the
//      pre-commit checkpoint. ANY survivor refuses the bundle — a bundle asserting Apache
//      anywhere would undermine the per-copy terms. Exit 1, every offender named with its
//      detector and its own diagnosis.
//   8. Issuance only: tars the cut and prints two hashes (see "Two hashes" below).
//
// ## What the guard's category is, and what it is not — stated so the sentence cannot overclaim
//
// The guard refuses the MACHINE-READ assertion, detected as above. Prose mentions of Apache
// survive on purpose — the banner, the NOTICE and the patched License section themselves explain
// the relationship to the public license, and refusing the word would refuse the explanation.
// The named residual limit: a machine-read assertion in a NON-JSON format, spelled other than
// the byte form, would survive — today the payload carries no machine-read format but JSON, and
// the census keeps every known assertion enumerated. What also survives, named rather than
// discovered by the first evaluee: README.md carries relative links into trees the roster
// excludes (`docs/`, `.portulan/`, `.github/`, `.claude/`, `CONTRIBUTING.md` — measured on a cut:
// thirteen link instances over ten targets), and those links resolve only in the source
// repository. The banner says so. The `links` verify recipe resolves against THIS repository's
// tracked set, so nothing in this tree will ever fail on a bundle-dead link — a known limit of
// the cut, not of the recipe.
//
// ## Why blobs come through git plumbing rather than `git archive | tar -x`
//
// The pre-port script piped `git archive` into tar. A verify recipe below runs this tool on every
// pull request, and a recipe that needs a toolchain is a recipe that stops being run
// (`.portulan/verify/README.md`) — so the cut reads `ls-tree` + `cat-file` and hashes in node,
// and the recipe's dependency floor stays exactly `bash · git · node`. The only tar invocation
// lives on the issuance path, which no recipe runs; a machine without tar refuses issuance with a
// named message and can still run every check. Equivalence with the archive route is asserted in
// the test suite (materialised tree byte-identical to `git archive | tar -x`, modes included),
// not assumed. The payload carries only 100644 and 100755 blobs today — measured, and pinned by
// the materialiser refusing any other mode by name (a symlink's target can point outside the cut,
// and a bundle is exactly the artifact that must not reach outside itself). That refusal is a
// FOURTH refusal beside the three roster refusals below, and it sits at could-not-run rather
// than red: a payload this tool will not materialise supports no verdict about licensing.
//
// ## The three rosters are pinned, in both directions
//
// PAYLOAD ∪ EXCLUDED must equal the commit's top-level tracked entries exactly, and the census of
// machine-read Apache assertions inside the payload must equal PATCHED_MANIFESTS exactly. Both are
// enforced live by `--check` (and so by CI on every pull request): a new top-level path, or a new
// manifest asserting Apache, fails with a message naming the repair menu — classify the path,
// patch-list the manifest, or exclude it — rather than silently thinning or silently mislicensing
// the next bundle. Proposal 0029's shape, taken for its honesty half: the lists are enumerations,
// the guard is the category, and the census is what keeps enumeration and category equal.
//
// ## The self-exclusion, and which backstop covers it
//
// This file and its test suite are payload paths (`cli/` ships) and are excluded from the cut by a
// CODE-LEVEL filter — never a git pathspec, whose exclude form matches nothing silently. Two
// reasons, either sufficient: issuer machinery is not part of what an evaluee receives, and both
// files necessarily carry the guard's own needle bytes, so a cut containing them could never pass
// its own guard. That last fact is also the backstop: if the filter ever fails, the guard refuses
// the bundle, and its diagnosis for a SELF_EXCLUDED offender says "the self-exclusion failed"
// rather than misreporting a licensing breach. `--check` states on every run whether the
// exclusion was exercised (the paths exist at the commit being cut) or vacuous (they do not —
// true until the first commit that contains this file), so a green cannot quietly rest on the
// vacuous case; the test suite exercises the filter positively against a fixture repository that
// plants files at exactly these paths.
//
// ## Two hashes, because they answer different questions
//
// The tarball's sha256 identifies THE DELIVERED BYTES and is what an issuance ledger records; it
// is NOT reproducible from the commit — tar embeds mtimes and ordering, measured as two different
// hashes over byte-identical content. The CONTENT DIGEST in EVAL-STAMP.json is reproducible from
// the commit PLUS the stamped parameters, never from the commit alone: recipient, login and date
// are baked into the license, the banner and the README section, so two recipients' digests
// differ by design — and the stamp records every parameter a re-derivation needs. sha256 over
// `path NUL sha256(bytes) LF` lines for every file in the cut except the stamp itself, paths
// sorted bytewise. Re-cutting with a stamp's own recorded parameters and matching its digest is
// how a bundle in the wild is tied to a commit; the tar hash is how a specific delivery is
// recognised.
//
// ## Routed to the maintainer, not resolved here (session-open checkpoint, adjustment 8)
//
// When this repository goes public, the evaluation-license template below becomes world-readable
// Apache-licensed text. That relicenses nothing already issued — each bundle carries its own
// stamped instrument — but whether counsel reads this wording before the flip is the
// maintainer's call, alongside the flip's other legal gates. The `--check` recipient is a
// fixture and says so in its own name, so no reader of a public tree can mistake it for a person.
//
// ## Exit codes
//
//   0  green — the cut (or check) completed and the guard found nothing
//   1  red — the guard found a surviving assertion, or a pinned roster no longer matches the tree
//   2  could not run — no repository, unreadable commit, missing tar at issuance, or a crash
//
// A crash is a could-not-run, never a red: a defect in this tool is not a finding about the work.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Raised when the tool cannot run or cannot judge honestly. Always exit 2, never 1. */
export class CannotRun extends Error {}

/** Raised when the guard or a pinned roster finds a real breach. Always exit 1. */
export class Refused extends Error {}

// The shippable payload, in the pre-port script's order. Directories are cut recursively;
// `README.md`, `NOTICE` and `CHANGELOG.md` ship because an evaluee needs the front door, the
// attribution, and the release record.
export const PAYLOAD = [
    "cli",
    "core",
    "spec",
    "packs",
    "plugin",
    "agents",
    "examples",
    ".claude-plugin",
    "README.md",
    "NOTICE",
    "CHANGELOG.md",
];

// Every top-level tracked entry that deliberately does NOT ship, each with its reason — the
// roster is reviewable because the reasons are. `--check` refuses when PAYLOAD and this list stop
// partitioning the tree, so a new top-level entry must be classified here before a bundle cuts.
export const EXCLUDED_TOP_LEVEL = {
    ".claude": "compiled host configuration for building THIS repository, not for running a copy of it",
    ".github": "CI, issue forms and review wiring — how this repository is run, not what it ships",
    ".gitignore": "a working-copy concern; the bundle is not a working copy of this repository",
    ".portulan": "the build record — handoffs, proposals, memory; the bundle ships the product, not the record",
    CODEOWNERS: "review routing for this repository's own pull requests",
    "CONTRIBUTING.md": "describes contribution to THIS repository; an evaluation copy is not a contribution surface",
    LICENSE: "the Apache-2.0 text — replaced by the stamped EVAL-LICENSE.md, which is the copy's instrument",
    docs: "vision, plan, milestones and pricing drafts — the company's record, not the product",
    evals: "milestone-8 scaffolding; one README today, and the bundle should not imply more",
    "package.json": "the npm publish surface, and a machine-read `\"license\": \"Apache-2.0\"` the bundle must not carry",
};

// Excluded from the cut by the code-level filter in `payloadEntries`. See the header for why, and
// for which backstop covers a failed filter.
export const SELF_EXCLUDED = ["cli/eval-bundle.mjs", "cli/eval-bundle.test.mjs"];

// Every machine-read license assertion in the payload, patched to `LicenseRef-Portulan-Eval`.
// The census in `--check` keeps this enumeration equal to what the tree actually carries.
export const PATCHED_MANIFESTS = [
    ".claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "packs/.claude-plugin/plugin.json",
];

export const EVAL_LICENSE_ID = "LicenseRef-Portulan-Eval";

// The guard's needle: the machine-read assertion, exactly as every manifest in this tree spells
// it. This literal is why this file is SELF_EXCLUDED — a cut containing it could not pass its own
// guard, which is the backstop the header describes.
export const APACHE_NEEDLE = Buffer.from('"license": "Apache-2.0"');

// The `--check` recipient. The dot makes the login impossible as a GitHub login (GitHub allows
// letters, digits and hyphens only) and `.invalid` is the reserved-name convention — so when this
// tree is public, no reader can take the fixture for a person, which is the session-open
// checkpoint's adjustment 8.
export const CHECK_RECIPIENT = { name: "Verify Fixture (not a person)", login: "verify-fixture.invalid" };

/**
 * Run git, or say why it could not. `stdio` pins stderr to a pipe so a failure's own message
 * rides into the exception — the same shape as `./pack-version.mjs`, for the same reason.
 * `encoding: null` where the caller says so, because a blob is bytes and decoding invents U+FFFD.
 */
function git(root, args, what, { binary = false } = {}) {
    try {
        return execFileSync("git", ["-C", root, ...args], {
            encoding: binary ? null : "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            maxBuffer: 64 * 1024 * 1024,
        });
    } catch (cause) {
        throw new CannotRun(`git could not ${what} — ${cause.stderr?.toString().trim() || cause.message}`);
    }
}

/**
 * The payload's blob entries at `commit`: `{ mode, oid, path }`, self-exclusion applied, plus the
 * list of self-excluded paths that were actually present — the caller reports whether the filter
 * was exercised or vacuous, so a green never quietly rests on the vacuous case.
 *
 * Any mode other than 100644/100755 is a refusal by name. The payload carries none today
 * (measured: 138 × 100644, 4 × 100755); a symlink or a gitlink arriving in the payload is a
 * decision about what a bundle may contain, and this tool must not make it by silently following
 * or silently dropping one.
 */
export function payloadEntries(root, commit) {
    const raw = git(
        root,
        ["ls-tree", "-r", "-z", "--full-tree", commit, "--", ...PAYLOAD],
        `list the payload at ${commit.slice(0, 7)}`,
    );
    const excluded = new Set(SELF_EXCLUDED);
    const entries = [];
    const selfExcludedPresent = [];
    for (const line of raw.split("\0")) {
        if (line === "") continue;
        // `<mode> <type> <oid>\t<path>` — the tab is the one separator a path cannot contain here.
        const tab = line.indexOf("\t");
        const [mode, type, oid] = line.slice(0, tab).split(" ");
        const rel = line.slice(tab + 1);
        if (excluded.has(rel)) {
            selfExcludedPresent.push(rel);
            continue;
        }
        if (type !== "blob" || (mode !== "100644" && mode !== "100755")) {
            throw new CannotRun(
                `the payload at ${commit.slice(0, 7)} carries ${rel} with mode ${mode} (${type}) — this tool ` +
                    `materialises plain and executable blobs only. A symlink can point outside the cut and a ` +
                    `gitlink is another repository; whether either belongs in a bundle is a roster decision, ` +
                    `not one to take by silently following or dropping it.`,
            );
        }
        entries.push({ mode, oid, path: rel });
    }
    if (entries.length === 0) {
        throw new CannotRun(
            `the payload roster matched nothing at ${commit.slice(0, 7)} — refusing to cut an empty bundle.`,
        );
    }
    return { entries, selfExcludedPresent };
}

/**
 * PAYLOAD ∪ EXCLUDED_TOP_LEVEL must equal the commit's top-level tracked entries, disjointly.
 * Returns nothing on success; throws Refused naming every unclassified, misclassified or vanished
 * entry with the repair menu. This is the roster-drift rail: a new top-level path fails every
 * pull request until somebody decides whether it ships.
 */
export function assertPartition(root, commit) {
    const actual = git(root, ["ls-tree", "-z", "--name-only", "--full-tree", commit], `list top level at ${commit.slice(0, 7)}`)
        .split("\0")
        .filter(Boolean);
    const payload = new Set(PAYLOAD);
    const excluded = new Set(Object.keys(EXCLUDED_TOP_LEVEL));
    const problems = [];
    for (const name of PAYLOAD) {
        if (excluded.has(name)) problems.push(`${name} is in both PAYLOAD and EXCLUDED_TOP_LEVEL — a path ships or it does not`);
    }
    for (const name of actual) {
        if (!payload.has(name) && !excluded.has(name)) {
            problems.push(
                `${name} is tracked at top level and classified by neither roster — add it to PAYLOAD (it ships in ` +
                    `evaluation bundles) or to EXCLUDED_TOP_LEVEL with its reason (it does not), in cli/eval-bundle.mjs`,
            );
        }
    }
    const present = new Set(actual);
    for (const name of [...payload, ...excluded]) {
        if (!present.has(name)) {
            problems.push(`${name} is classified in cli/eval-bundle.mjs and no longer tracked at top level — remove the stale entry`);
        }
    }
    if (problems.length > 0) {
        throw new Refused(`the payload partition no longer matches the tree:\n  ${problems.join("\n  ")}`);
    }
}

/**
 * Write the payload blobs under `dir`, executable bit preserved.
 *
 * Containment is decided on the RESOLVED path, never by pattern — a `..` chain satisfies any
 * regex and still escapes, the shape `./new.mjs` and `./pack-version.mjs` already refuse by
 * resolution for the same reason. git refuses to CREATE a tree entry named `..`, but `ls-tree`
 * faithfully prints what a crafted tree carries, and this tool can be pointed at an arbitrary
 * repository — so the write site holds the boundary rather than trusting the listing. Raised by
 * Copilot on the pull request that ported this tool; agreed and held here.
 */
export function materialize(root, entries, dir) {
    const base = path.resolve(dir);
    for (const { mode, oid, path: rel } of entries) {
        const target = path.resolve(base, rel);
        if (!target.startsWith(base + path.sep)) {
            throw new CannotRun(
                `the payload listing carries ${JSON.stringify(rel)}, which resolves outside the cut directory — ` +
                    `refusing to write beyond the bundle. A tree entry that escapes its own tree is crafted, not tracked.`,
            );
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const bytes = git(root, ["cat-file", "blob", oid], `read ${rel}`, { binary: true });
        fs.writeFileSync(target, bytes, { mode: mode === "100755" ? 0o755 : 0o644 });
    }
}

/**
 * Every file under `dir` (relative, sorted bytewise) whose bytes contain `needle`. Reading bytes,
 * never decoding — the same rule `./control-chars.mjs` holds and for the same reason.
 */
export function filesCarrying(dir, needle) {
    const found = [];
    const walk = (sub) => {
        for (const entry of fs.readdirSync(path.join(dir, sub), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
            const rel = sub === "" ? entry.name : `${sub}/${entry.name}`;
            if (entry.isDirectory()) walk(rel);
            else if (fs.readFileSync(path.join(dir, rel)).includes(needle)) found.push(rel);
        }
    };
    walk("");
    return found.sort();
}

/** Does a parsed JSON value, anywhere in its depth, bind a `license` key to an Apache-ish string? */
function jsonAssertsApache(value) {
    if (Array.isArray(value)) return value.some(jsonAssertsApache);
    if (value === null || typeof value !== "object") return false;
    for (const [key, inner] of Object.entries(value)) {
        if (key === "license" && typeof inner === "string" && /apache/i.test(inner)) return true;
        if (jsonAssertsApache(inner)) return true;
    }
    return false;
}

/**
 * Every file in the cut asserting Apache machine-readably, as `{ rel, how }`, sorted by path.
 *
 * TWO detectors, because one spelling is not a category (proposal 0029, learned on this guard
 * itself — the byte form alone passed `"license":"Apache-2.0"`, no space, at the pre-commit
 * checkpoint): the byte-form needle over EVERY file, and a parsed-JSON walk flagging any `license`
 * key at any depth whose string value mentions Apache. A `.json` file that does not parse gets the
 * byte detector only, and that is the honest scope rather than a hole: a file no JSON parser
 * reads is not machine-readable as JSON, and `cli/fixtures/` is licensed to be broken on purpose.
 * The named residual limit: a machine-read assertion in a NON-JSON format in a spelling other
 * than the byte form would survive — today the payload carries no such format, and the census
 * keeps every known assertion enumerated.
 */
export function apacheAssertions(dir) {
    const found = new Map();
    const note = (rel, how) => found.set(rel, found.has(rel) ? `${found.get(rel)} and ${how}` : how);
    const walk = (sub) => {
        for (const entry of fs.readdirSync(path.join(dir, sub), { withFileTypes: true })) {
            const rel = sub === "" ? entry.name : `${sub}/${entry.name}`;
            if (entry.isDirectory()) {
                walk(rel);
                continue;
            }
            const bytes = fs.readFileSync(path.join(dir, rel));
            if (bytes.includes(APACHE_NEEDLE)) note(rel, "the byte form");
            if (rel.endsWith(".json")) {
                let parsed;
                try {
                    parsed = JSON.parse(bytes.toString("utf8"));
                } catch {
                    continue;
                }
                if (jsonAssertsApache(parsed)) note(rel, "a parsed `license` field");
            }
        }
    };
    walk("");
    return [...found.entries()].map(([rel, how]) => ({ rel, how })).sort((a, b) => (a.rel < b.rel ? -1 : 1));
}

/**
 * The pre-patch census: inside the freshly materialised cut, the files carrying the machine-read
 * assertion must be exactly PATCHED_MANIFESTS. Anything extra is a manifest this tool does not
 * know about — refused with the menu, so the next bundle cannot quietly mislicense it. Anything
 * missing is a patch target that stopped asserting Apache — stale, and refused too, because a
 * patch list that patches nothing reads as coverage.
 */
export function assertCensus(cutDir) {
    const carrying = apacheAssertions(cutDir).map((o) => o.rel);
    const expected = [...PATCHED_MANIFESTS].sort();
    if (JSON.stringify(carrying) === JSON.stringify(expected)) return;
    const extra = carrying.filter((f) => !expected.includes(f));
    const gone = expected.filter((f) => !carrying.includes(f));
    const problems = [
        ...extra.map(
            (f) =>
                `${f} carries a machine-read Apache assertion and is not in PATCHED_MANIFESTS — add it there (it must be ` +
                `patched) or to the exclusion rosters (it must not ship), in cli/eval-bundle.mjs`,
        ),
        ...gone.map((f) => `${f} is in PATCHED_MANIFESTS and no longer carries the assertion — remove the stale entry`),
    ];
    throw new Refused(`the license census no longer matches PATCHED_MANIFESTS:\n  ${problems.join("\n  ")}`);
}

/** The stamped per-copy license. Text ported verbatim from the install-verified original. */
export function evalLicenseText({ name, login, date, fullSha }) {
    return `# Portulan Evaluation License

Copyright © 2026 Sleepy Panda SRL. All rights reserved.

This copy of Portulan is licensed, not sold — and this copy is **not** distributed under
the Apache-2.0 license that public Portulan materials reference. It is provided to the
named recipient only, for evaluation.

- **Issued to:** ${name} (github.com/${login})
- **Issued on:** ${date}, from commit \`${fullSha.slice(0, 7)}\`
- **Issued by:** Sleepy Panda SRL (sleepypanda.ro)
- **Term:** 90 days from issue unless extended in writing; revocable at any time.

**Permitted:** installing and running this copy on machines you control; reading and
modifying it for your own evaluation; giving the issuer feedback about it.

**Not permitted without prior written permission from Sleepy Panda SRL:** redistributing,
publishing, or sublicensing this copy or any part of it, in any form; using it to provide
services to third parties; production or commercial use; removing this file or its
issued-to stamp.

**Quiet about the materials, free about the experience.** The bundle and its contents are
non-public materials of Sleepy Panda SRL: showing or passing the materials themselves to
others requires permission, while describing your experience — what Portulan is like to
use, what worked, what did not — is welcome anywhere.

**Your work stays yours.** Workspaces, rules, and records you create with this copy during
evaluation are yours; nothing in your repositories is claimed. Feedback you choose to give
may be used by Sleepy Panda SRL without restriction or obligation.

**No warranty.** This software is provided "as is", without warranty of any kind. To the
maximum extent permitted by law, Sleepy Panda SRL is not liable for damages arising from
its use.

When the term ends or the license is revoked, stop using this copy and delete it. What
using it taught you, you keep.
`;
}

/** The evaluation-issue NOTICE. Ported verbatim from the install-verified original. */
export const EVAL_NOTICE = `Portulan
Copyright 2026 Sleepy Panda SRL

This product is developed by Sleepy Panda Works (https://sleepypanda.ro).
This copy is an evaluation issue governed by EVAL-LICENSE.md; public releases
of Portulan are licensed under the Apache License, Version 2.0.
`;

/**
 * Patch every machine-read `"license"` field in the named manifests. The write mirrors the
 * pre-port script exactly: parsed, patched, re-serialised at two spaces with a trailing newline —
 * which is also how every manifest in this tree is formatted.
 */
export function patchManifests(cutDir) {
    for (const rel of PATCHED_MANIFESTS) {
        const file = path.join(cutDir, rel);
        const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
        if (manifest.license) manifest.license = EVAL_LICENSE_ID;
        if (Array.isArray(manifest.plugins)) {
            for (const plugin of manifest.plugins) if (plugin.license) plugin.license = EVAL_LICENSE_ID;
        }
        fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
    }
}

/**
 * Rewrite the cut README's own `## License` section — the human-read half of the swap, and the
 * session-open checkpoint's adjustment 1: a banner sixty lines up does not repair a section that
 * asserts Apache and links a LICENSE file the roster drops. Exactly one `## License` heading must
 * exist; zero or two is the source README having moved, and the cut refuses rather than guessing
 * which section is the one that lies about the copy's terms.
 */
export function patchReadmeLicense(cutDir, fullSha) {
    const file = path.join(cutDir, "README.md");
    const text = fs.readFileSync(file, "utf8");
    const headings = text.split("\n").filter((line) => line === "## License").length;
    if (headings !== 1) {
        throw new CannotRun(
            `README.md carries ${headings} \`## License\` heading(s) and this tool patches exactly one — the source ` +
                `README has changed shape; update patchReadmeLicense in cli/eval-bundle.mjs to match it.`,
        );
    }
    const start = text.indexOf("\n## License\n");
    const afterHeading = start + "\n## License\n".length;
    const next = text.indexOf("\n## ", afterHeading);
    const replacement =
        `\nThis copy is an evaluation issue governed by [\`EVAL-LICENSE.md\`](EVAL-LICENSE.md) — issued to the\n` +
        `named recipient it records, not distributed under Apache-2.0. Public releases of Portulan are\n` +
        `licensed under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0);\n` +
        `the repository this bundle was cut from (commit \`${fullSha.slice(0, 7)}\`) carries that license. © 2026 Sleepy Panda SRL.\n`;
    fs.writeFileSync(file, text.slice(0, afterHeading) + replacement + (next === -1 ? "" : text.slice(next)));
}

/**
 * Prepend the evaluation banner. Reworded from the pre-port original in one place, and the delta
 * is deliberate: the original said the License section below "describes the public repository",
 * which stopped being true the moment `patchReadmeLicense` started rewriting that section. A
 * banner describing the bundle must describe the bundle it is in.
 */
export function prependBanner(cutDir, { name, date, fullSha }) {
    const file = path.join(cutDir, "README.md");
    const banner =
        `> **EVALUATION COPY — issued to ${name}, ${date}.** This bundle is governed by\n` +
        `> [\`EVAL-LICENSE.md\`](EVAL-LICENSE.md), **not** by the Apache-2.0 terms public Portulan materials\n` +
        `> reference — the License section below says the same. It was cut from commit \`${fullSha.slice(0, 7)}\` of the\n` +
        `> source repository; relative links into \`docs/\` and other paths the bundle excludes resolve only\n` +
        `> there. Do not redistribute.\n\n`;
    fs.writeFileSync(file, banner + fs.readFileSync(file, "utf8"));
}

/**
 * The reproducible identity of the cut: sha256 over `path NUL sha256(bytes) LF` for every file
 * except EVAL-STAMP.json itself (which must carry the digest and so cannot be under it), paths
 * sorted bytewise. A property of the content — re-derivable from the commit plus the stamped
 * parameters the stamp itself records, never from the commit alone, since the stamping bakes the
 * recipient into three files — where the tarball's hash is a property of one delivery. Both
 * matter; they answer different questions, and the stamp says which is which.
 */
export function bundleDigest(cutDir) {
    const digest = crypto.createHash("sha256");
    const files = [];
    const walk = (sub) => {
        for (const entry of fs.readdirSync(path.join(cutDir, sub), { withFileTypes: true })) {
            const rel = sub === "" ? entry.name : `${sub}/${entry.name}`;
            if (entry.isDirectory()) walk(rel);
            else if (rel !== "EVAL-STAMP.json") files.push(rel);
        }
    };
    walk("");
    for (const rel of files.sort()) {
        const fileHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(cutDir, rel))).digest("hex");
        digest.update(rel);
        digest.update(Buffer.from([0]));
        digest.update(fileHash);
        digest.update("\n");
    }
    return digest.digest("hex");
}

/** EVAL-STAMP.json — the machine-read half of the stamp. */
export function writeStamp(cutDir, { name, login, date, fullSha }) {
    const stamp = {
        artifact: "portulan-eval",
        issued_to: { name, github: login },
        issued_on: date,
        issued_by: "Sleepy Panda SRL",
        source_commit: fullSha,
        term_days: 90,
        license: EVAL_LICENSE_ID,
        license_file: "EVAL-LICENSE.md",
        content_digest: `sha256:${bundleDigest(cutDir)}`,
        content_digest_scope:
            "sha256 over 'path NUL sha256(file bytes) LF' for every file in this bundle except this stamp, paths sorted bytewise",
    };
    fs.writeFileSync(path.join(cutDir, "EVAL-STAMP.json"), `${JSON.stringify(stamp, null, 2)}\n`);
}

/**
 * The guard. Refuses the finished cut if ANY file still carries the machine-read assertion, each
 * offender with its own diagnosis — a SELF_EXCLUDED path in the cut is a failed filter, not a
 * licensing breach, and telling an operator the wrong story sends them to the wrong repair.
 */
export function auditCut(cutDir) {
    const offenders = apacheAssertions(cutDir);
    if (offenders.length === 0) return;
    const lines = offenders.map(({ rel, how }) => {
        if (SELF_EXCLUDED.includes(rel)) return `${rel} (${how}) — the self-exclusion FAILED; this issuer-machinery file must not be in a cut at all`;
        if (PATCHED_MANIFESTS.includes(rel)) return `${rel} (${how}) — the manifest patch FAILED to reach this file`;
        return `${rel} (${how}) — a machine-read Apache assertion this tool does not know about; add the file to PATCHED_MANIFESTS or stop shipping it`;
    });
    throw new Refused(`REFUSING: a machine-read Apache assertion survived in the cut:\n  ${lines.join("\n  ")}`);
}

/**
 * One whole cut: materialise, verify both rosters, transform, stamp, guard. Returns what the
 * caller needs to report. Everything before the transforms is read-only against the repository;
 * everything after happens inside `cutDir`.
 */
export function cut(root, commit, { name, login, date }, cutDir) {
    const fullSha = git(root, ["rev-parse", "--verify", `${commit}^{commit}`], `resolve ${commit}`).trim();
    assertPartition(root, fullSha);
    const { entries, selfExcludedPresent } = payloadEntries(root, fullSha);
    materialize(root, entries, cutDir);
    assertCensus(cutDir);
    fs.writeFileSync(path.join(cutDir, "EVAL-LICENSE.md"), evalLicenseText({ name, login, date, fullSha }));
    fs.writeFileSync(path.join(cutDir, "NOTICE"), EVAL_NOTICE);
    patchManifests(cutDir);
    patchReadmeLicense(cutDir, fullSha);
    prependBanner(cutDir, { name, date, fullSha });
    writeStamp(cutDir, { name, login, date, fullSha });
    auditCut(cutDir);
    return { fullSha, fileCount: entries.length, selfExcludedPresent };
}

/** Today in the machine's local calendar, as YYYY-MM-DD — what the pre-port script's date(1) printed. */
function localDate() {
    return new Date().toLocaleDateString("en-CA");
}

function usage() {
    return [
        // Deliberately NOT a `portulan` subcommand — docs/vision.md names eight and is human-owned;
        // this sits beside `plugin-lint` and `pack-version` and joins that list only if the
        // maintainer says so. The forms below are the only invocations that exist.
        "eval-bundle — cut a named-recipient evaluation bundle of Portulan from a commit",
        "",
        "  node cli/eval-bundle.mjs --to <name> --github <login> --commit <ref> --out <dir> [--date YYYY-MM-DD] [<repository-root>]",
        "  node cli/eval-bundle.mjs --check [<repository-root>]",
        "",
        "  --to        the recipient's name, exactly as the issuance ledger will record it",
        "  --github    the recipient's GitHub login",
        "  --commit    the commit to cut from — named explicitly; issuance cuts from a main commit",
        "  --out       where to write portulan-eval/ and the tarball",
        "  --date      the issue date; defaults to today. Stamped into the license, the banner and the stamp",
        "  --check     cut from HEAD to a scratch directory with a fixture recipient, verify every",
        "              invariant, delete the scratch — what .portulan/verify/eval-bundle.sh runs",
        "",
        "After an issuance cut: record the issue in the private ledger BEFORE sending. A copy with",
        "no ledger entry is not sent. The ledger, and all recipient data, live outside this repository.",
        "",
        "Exit codes: 0 green · 1 the guard or a pinned roster refused · 2 could not run.",
    ].join("\n");
}

export function run(argv = [], { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
    if (argv.includes("--help") || argv.includes("-h")) {
        stdout.write(`${usage()}\n`);
        return 0;
    }
    try {
        let check = false;
        let name = null;
        let login = null;
        let commit = null;
        let out = null;
        let date = null;
        let root = null;
        const takesValue = { "--to": (v) => (name = v), "--github": (v) => (login = v), "--commit": (v) => (commit = v), "--out": (v) => (out = v), "--date": (v) => (date = v) };
        for (let i = 0; i < argv.length; i += 1) {
            if (argv[i] === "--check") check = true;
            else if (takesValue[argv[i]]) {
                const value = argv[i + 1];
                if (value === undefined || value.startsWith("-")) throw new CannotRun(`${argv[i]} needs a value`);
                takesValue[argv[i]](value);
                i += 1;
            } else if (argv[i].startsWith("-")) throw new CannotRun(`unknown argument ${JSON.stringify(argv[i])}`);
            else if (root === null) root = argv[i];
            else throw new CannotRun(`unexpected second repository root ${JSON.stringify(argv[i])}`);
        }
        if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new CannotRun(`--date wants YYYY-MM-DD, got ${JSON.stringify(date)}`);

        const where = path.resolve(root ?? cwd);
        // Resolved to the repository top level rather than trusting the argument — #131's class,
        // the same guard `./pack-version.mjs` states.
        const top = git(where, ["rev-parse", "--show-toplevel"], `find a git repository at ${where}`).trim();

        if (check) {
            if (name || login || commit || out || date) {
                throw new CannotRun("--check takes no stamping flags — it cuts HEAD for a fixture recipient and deletes the result");
            }
            // The scratch is cleaned in `finally`, unconditionally — this repository has already
            // paid for verify machinery that leaked scratch directories on every run (the incident
            // proposal 0029 records), and a cleanup that only runs on success re-buys it.
            const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-eval-check-"));
            try {
                const cutDir = path.join(scratch, "portulan-eval");
                fs.mkdirSync(cutDir);
                const result = cut(top, "HEAD", { ...CHECK_RECIPIENT, date: localDate() }, cutDir);
                const exercised = result.selfExcludedPresent.length > 0;
                stdout.write(`eval-bundle --check: cut HEAD (${result.fullSha.slice(0, 7)}) for ${CHECK_RECIPIENT.name} — ${result.fileCount} file(s)\n`);
                stdout.write(`  partition: ${PAYLOAD.length} payload + ${Object.keys(EXCLUDED_TOP_LEVEL).length} excluded top-level entries — matches the tree\n`);
                stdout.write(`  census: machine-read Apache assertions == the ${PATCHED_MANIFESTS.length} patched manifest(s), all patched to ${EVAL_LICENSE_ID}\n`);
                stdout.write(
                    exercised
                        ? `  self-exclusion: exercised — ${result.selfExcludedPresent.join(", ")} present at HEAD and filtered out of the cut\n`
                        : `  self-exclusion: vacuous at this commit (the cutter is not in it yet) — the filter is exercised positively in cli/eval-bundle.test.mjs\n`,
                );
                stdout.write(`  guard: no machine-read Apache assertion survives; content digest sha256:${bundleDigest(cutDir).slice(0, 12)}…\n`);
                stdout.write("ok  eval-bundle — a clean evaluation bundle cuts from HEAD\n");
            } finally {
                fs.rmSync(scratch, { recursive: true, force: true });
            }
            return 0;
        }

        for (const [flag, value] of [["--to", name], ["--github", login], ["--commit", commit], ["--out", out]]) {
            if (!value) throw new CannotRun(`${flag} is required for an issuance cut (or pass --check); see --help`);
        }
        const outDir = path.resolve(where, out);
        const cutDir = path.join(outDir, "portulan-eval");
        if (fs.existsSync(cutDir)) {
            throw new CannotRun(`${cutDir} already exists — refusing to cut into a directory that may hold a previous bundle`);
        }
        fs.mkdirSync(cutDir, { recursive: true });
        const stampDate = date ?? localDate();
        const result = cut(top, commit, { name, login, date: stampDate }, cutDir);

        const tarball = path.join(outDir, `portulan-eval-${login}-${stampDate}.tgz`);
        // tar is issuance-only on purpose: the recipe path above never reaches here, so the verify
        // set's dependency floor stays bash · git · node. A machine without tar can run every
        // check and cannot issue, which is the right way round.
        const tar = spawnSync("tar", ["-czf", tarball, "-C", outDir, "portulan-eval"], { stdio: ["ignore", "ignore", "pipe"] });
        if (tar.error || tar.status !== 0) {
            throw new CannotRun(
                `tar could not write ${tarball} — ${tar.error?.code === "ENOENT" ? "no tar on this machine; the cut directory is complete and can be archived by hand" : tar.stderr?.toString().trim() || `exit ${tar.status}`}`,
            );
        }
        const tarSha = crypto.createHash("sha256").update(fs.readFileSync(tarball)).digest("hex");
        const stamp = JSON.parse(fs.readFileSync(path.join(cutDir, "EVAL-STAMP.json"), "utf8"));

        stdout.write(`cut ${result.fileCount} file(s) from ${result.fullSha.slice(0, 7)} for ${name} (github.com/${login}), issued ${stampDate}\n`);
        stdout.write(`  ${stamp.content_digest}  content digest — reproducible from the commit and this tool\n`);
        stdout.write(`  sha256:${tarSha}  ${tarball} — identifies these delivered bytes; tar output is not reproducible\n`);
        stdout.write(`Bundle ready. Record the issue in the private ledger BEFORE sending — a copy with no ledger entry is not sent.\n`);
        return 0;
    } catch (error) {
        if (error instanceof Refused) {
            stderr.write(`eval-bundle: ${error.message}\n`);
            return 1;
        }
        if (error instanceof CannotRun) {
            stderr.write(`eval-bundle: ${error.message}\n`);
            return 2;
        }
        // A crash is a could-not-run, never a red — `./pack-version.mjs` states the contract and
        // the reason; a defect in this tool is not a finding about the work.
        stderr.write(`eval-bundle: CRASHED — ${error?.stack ?? error}\n`);
        stderr.write("eval-bundle: reporting could-not-run (2) rather than a verdict — a defect in this tool is not a finding about the work.\n");
        return 2;
    }
}

function isMain() {
    return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}

if (isMain()) {
    process.exitCode = run(process.argv.slice(2));
}
