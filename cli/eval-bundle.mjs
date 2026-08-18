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
//      state nor secrets can ride along — minus the SELF_EXCLUDED entries below.
//   2. Renders EVAL-LICENSE.md from the template AT THAT SAME COMMIT (`cli/eval-license.template.md`,
//      read with `git show`, never from the invoking working tree), stamped to the named recipient
//      (name, GitHub login, date). The supervisor's ruling of 2026-08-17, binding: payload and
//      terms pin to ONE sha in EVAL-STAMP.json's `source_commit`, so issued copies keep their
//      issued wording and a later template edit cannot drift under an already-stamped bundle.
//   3. Replaces NOTICE with the evaluation-issue NOTICE.
//   4. Prepends the evaluation banner to README.md. Nothing else about the README is touched, and
//      `LICENSE` ships: the bundle is the public tree's bytes under the public tree's licence, so
//      the README's own `## License` section is already correct and its link now resolves. That
//      retires one of the thirteen dead relative links this tool used to create, for free.
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
// INVERTED on the maintainer's ruling of 2026-08-18 (issue 284): the guard refuses a machine-read
// `license` field that is NOT Apache-2.0, plus any SELF_EXCLUDED path that leaked into the cut.
// It used to refuse the presence of Apache, which was right while a bundle was a differently-
// licensed copy and became false the moment the source tree went public — the same bytes cannot
// be Apache-2.0 in the repository and proprietary in a tarball. The named residual limit is the
// mirror of the old one: a machine-read assertion in a NON-JSON format would not be read, and
// today the payload carries no machine-read format but JSON. What also survives, named rather than
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
// This file, its test suite and the license template are payload paths (`cli/` ships) and are
// excluded from the cut by a CODE-LEVEL filter — never a git pathspec, whose exclude form matches
// nothing silently. Issuer machinery is not part of what an evaluee receives — a bundle carries
// the STAMPED license, never the stamp press — and this file and the suite additionally carry the
// guard's own needle bytes, so a cut containing either could never pass its own guard. That last
// fact is also the backstop: if the filter ever fails on those two, the guard refuses the bundle,
// and its diagnosis for a SELF_EXCLUDED offender says "the self-exclusion failed" rather than
// misreporting a licensing breach. The template carries no needle, so its exclusion rests on the
// filter alone — which the test suite exercises positively against a fixture repository that
// plants files at exactly these paths. `--check` states on every run whether the exclusion was
// exercised (the paths exist at the commit being cut) or vacuous, so a green cannot quietly rest
// on the vacuous case.
//
// ## Two hashes, because they answer different questions
//
// The tarball's sha256 identifies THE DELIVERED BYTES and is what an issuance ledger records; it
// is NOT reproducible from the commit — tar embeds mtimes and ordering, measured as two different
// hashes over byte-identical content. The CONTENT DIGEST in EVAL-STAMP.json is reproducible from
// the commit PLUS the stamped parameters, never from the commit alone: recipient, login and date
// are baked into the license, the banner and the README section, so two recipients' digests
// differ by design — and the stamp records every parameter a re-derivation needs. sha256 over
// `UTF-8 path bytes NUL sha256(file bytes) hex LF` lines for every file in the cut except the
// stamp itself, entries sorted by the UTF-8 bytes of the path — encodings named so the digest is
// re-derivable outside Node. Re-cutting with a stamp's own recorded parameters and matching its
// digest is how a bundle in the wild is tied to a commit; the tar hash is how a specific
// delivery is recognised.
//
// ## The template in a public tree — routed, RULED (supervisor, 2026-08-17), and now arrived
//
// The repository is public, so `cli/eval-license.template.md` is world-readable Apache-licensed
// text. That relicenses nothing already issued — each bundle carries its own stamped instrument —
// and the binding condition the sections above implement is what makes that so: terms ship FROM the
// payload commit, one sha for both. **What the ruling routed to the flip was a read of the
// template's own wording, and the maintainer settled it on 2026-08-17:** the bundle's files are
// Apache-2.0, the same terms as the public repository, so the template's "non-public materials"
// and no-redistribution clauses were withdrawn rather than left standing over world-readable
// material. The NOTICE, the patched README section and the banner were trued with it — a bundle
// must not contradict its own instrument. The mechanism is unchanged: it stamps whatever the
// payload commit carries. The `--check` recipient is a fixture and says so in its own name, so no reader of
// a public tree can mistake it for a person.
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
    "LICENSE",
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
    docs: "vision, plan, milestones and pricing drafts — the company's record, not the product",
    evals: "milestone-8 scaffolding; one README today, and the bundle should not imply more",
    "package.json": "the npm publish surface — a copy is not published from, and its scripts and metadata describe this repository's release, not the bundle",
};

// Excluded from the cut by the code-level filter in `payloadEntries`. See the header for why, and
// for which backstop covers a failed filter. The template is issuer machinery like the other two —
// an evaluee receives the STAMPED license, never the stamp press — though unlike them it carries
// no guard needle, so its exclusion rests on the filter alone.
export const SELF_EXCLUDED = ["cli/eval-bundle.mjs", "cli/eval-bundle.test.mjs", "cli/eval-license.template.md"];

// Where the evaluation-license template lives, read FROM THE PAYLOAD COMMIT — never from the
// invoking working tree. The supervisor's ruling of 2026-08-17, binding: EVAL-STAMP.json's
// `source_commit` pins payload and terms together as ONE sha, so issued copies keep their issued
// wording, the ledger cites one commit for both, and a later edit to this template cannot drift
// underneath an already-stamped bundle.
export const TEMPLATE_PATH = "cli/eval-license.template.md";
const TEMPLATE_PLACEHOLDERS = ["{{name}}", "{{login}}", "{{date}}", "{{shortSha}}"];

// Every machine-read license assertion in the payload. These MUST assert Apache-2.0 in a cut —
// the bundle is the public tree's own bytes and carries the public tree's licence. The census in
// `--check` keeps this enumeration equal to what the tree actually carries, in both directions.
export const APACHE_MANIFESTS = [
    ".claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "packs/.claude-plugin/plugin.json",
];

// The census detector: the machine-read assertion, exactly as every manifest in this tree spells
// it. It is no longer a refusal trigger — the guard below refuses the ABSENCE of Apache, not its
// presence — so the accidental backstop this literal used to give SELF_EXCLUDED is gone, and
// `auditCut` now checks those paths directly instead of relying on a side effect.
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
        const fileMode = mode === "100755" ? 0o755 : 0o644;
        fs.writeFileSync(target, bytes);
        // `chmod` AFTER the write, never `writeFileSync`'s `mode` option: the option feeds
        // open(2), which the process umask masks — an umask of 0o111 would silently strip the
        // executable bit and break the preserved-mode promise on exactly the environments nobody
        // tests. chmod(2) is not umask-subject. Raised by Copilot on the porting pull request.
        fs.chmodSync(target, fileMode);
    }
}

/**
 * Every file under `dir` whose bytes contain `needle`, sorted by the UTF-8 bytes of the relative
 * path — the one ordering rule this file uses, `bundleDigest`'s included, because two sort rules
 * in one tool is the two-definitions defect wearing a comparator. Reading bytes, never decoding —
 * the same rule `./control-chars.mjs` holds and for the same reason.
 */
export function filesCarrying(dir, needle) {
    const found = [];
    const walk = (sub) => {
        for (const entry of fs.readdirSync(path.join(dir, sub), { withFileTypes: true })) {
            const rel = sub === "" ? entry.name : `${sub}/${entry.name}`;
            if (entry.isDirectory()) walk(rel);
            else if (fs.readFileSync(path.join(dir, rel)).includes(needle)) found.push(rel);
        }
    };
    walk("");
    return found.sort((a, b) => Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8")));
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
    // The same UTF-8-byte ordering as everything else in this file — swept when `filesCarrying`'s
    // comparator was corrected, per 0020, rather than left for a later round to find.
    return [...found.entries()].map(([rel, how]) => ({ rel, how })).sort((a, b) => Buffer.compare(Buffer.from(a.rel, "utf8"), Buffer.from(b.rel, "utf8")));
}

/**
 * The census, run on the freshly materialised cut: the files carrying the machine-read assertion
 * must be exactly APACHE_MANIFESTS. Anything extra is a declaring manifest this tool does not know
 * about — refused with the menu, so the next bundle cannot quietly ship an unreviewed licence
 * claim. Anything missing is a rostered file that stopped asserting Apache — refused too, because
 * a roster naming files that declare nothing reads as coverage it does not have. It runs before
 * the stamp is written, which is why EVAL-STAMP.json is not in the roster despite declaring
 * Apache-2.0 itself; the guard is what reads the finished cut.
 */
export function assertCensus(cutDir) {
    const carrying = apacheAssertions(cutDir).map((o) => o.rel);
    const expected = [...APACHE_MANIFESTS].sort((a, b) => Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8")));
    if (JSON.stringify(carrying) === JSON.stringify(expected)) return;
    const extra = carrying.filter((f) => !expected.includes(f));
    const gone = expected.filter((f) => !carrying.includes(f));
    const problems = [
        ...extra.map(
            (f) =>
                `${f} carries a machine-read Apache assertion and is not in APACHE_MANIFESTS — add it there (the ` +
                `bundle carries the public tree's licence) or to the exclusion rosters (it must not ship), in cli/eval-bundle.mjs`,
        ),
        ...gone.map((f) => `${f} is in APACHE_MANIFESTS and no longer carries the assertion — it must, or the entry is stale`),
    ];
    throw new Refused(`the license census no longer matches APACHE_MANIFESTS:\n  ${problems.join("\n  ")}`);
}

/**
 * The evaluation-license template AT a commit — read with `git show`, NEVER from the invoking
 * working tree. The supervisor's ruling of 2026-08-17, binding: the payload commit is the terms
 * commit, so `source_commit` pins both as one sha and a later template edit cannot drift under
 * an already-stamped bundle. A commit that does not carry the template cannot be cut, and the
 * refusal says why rather than falling back to any other copy — a fallback would be exactly the
 * working-tree read the ruling forbids. The template is validated before use: all four
 * placeholders must be present, because a template that lost one would stamp an incomplete
 * license and the cut must refuse, not improvise.
 */
export function readTemplateAt(root, fullSha) {
    let template;
    try {
        template = git(root, ["show", `${fullSha}:${TEMPLATE_PATH}`], `read ${TEMPLATE_PATH} at ${fullSha.slice(0, 7)}`);
    } catch (cause) {
        throw new CannotRun(
            `${TEMPLATE_PATH} is not in commit ${fullSha.slice(0, 7)} — evaluation terms ship FROM the payload ` +
                `commit, so EVAL-STAMP.json's source_commit pins payload and terms as one sha. Cut from a commit ` +
                `that carries the template; falling back to the working tree's copy is exactly the drift this ` +
                `refusal exists to prevent. (${cause.message})`,
        );
    }
    for (const placeholder of TEMPLATE_PLACEHOLDERS) {
        if (!template.includes(placeholder)) {
            throw new CannotRun(
                `${TEMPLATE_PATH} at ${fullSha.slice(0, 7)} does not carry the ${placeholder} placeholder — a ` +
                    `template that lost a stamp field would issue an incomplete license; refusing to improvise one.`,
            );
        }
    }
    return template;
}

/** The stamped per-copy license: the commit's template, rendered. Refuses any unfilled placeholder. */
export function renderEvalLicense(template, { name, login, date, fullSha }) {
    const rendered = template
        .replaceAll("{{name}}", name)
        .replaceAll("{{login}}", login)
        .replaceAll("{{date}}", date)
        .replaceAll("{{shortSha}}", fullSha.slice(0, 7));
    const leftover = rendered.match(/\{\{[a-zA-Z]+\}\}/);
    if (leftover) {
        throw new CannotRun(`the license template carries a placeholder this tool does not fill: ${leftover[0]} — ` +
            `extend renderEvalLicense in cli/eval-bundle.mjs or fix the template at the commit being cut.`);
    }
    return rendered;
}

/** The evaluation-issue NOTICE. Ported verbatim from the install-verified original. */
export const EVAL_NOTICE = `Portulan
Copyright 2026 Sleepy Panda SRL

This product is developed by Sleepy Panda Works (https://sleepypanda.ro).
This copy is an evaluation issue recorded in EVAL-LICENSE.md, and is licensed
under the Apache License, Version 2.0 — the same terms as the public repository
it was cut from.
`;

/**
 * Prepend the evaluation banner. Reworded from the pre-port original in one place, and the delta
 * is deliberate: the original said the License section below "describes the public repository",
 * which stopped being true the moment `patchReadmeLicense` started rewriting that section. A
 * banner describing the bundle must describe the bundle it is in.
 */
export function prependBanner(cutDir, { name, date, fullSha }) {
    const file = path.join(cutDir, "README.md");
    const banner =
        `> **EVALUATION COPY — issued to ${name}, ${date}.** This bundle is recorded in\n` +
        `> [\`EVAL-LICENSE.md\`](EVAL-LICENSE.md) and licensed under the **same Apache-2.0 terms as the public\n` +
        `> repository** — the License section below says the same. It was cut from commit \`${fullSha.slice(0, 7)}\` of the\n` +
        `> source repository; relative links into \`docs/\` and other paths the bundle excludes resolve only\n` +
        `> there. If you pass Portulan on, point at the repository rather than this snapshot.\n\n`;
    fs.writeFileSync(file, banner + fs.readFileSync(file, "utf8"));
}

/**
 * The reproducible identity of the cut: sha256 over `UTF-8 path bytes NUL sha256(bytes) hex LF`
 * for every file except EVAL-STAMP.json itself (which must carry the digest and so cannot be
 * under it), entries sorted by the UTF-8 bytes of the path. A property of the content —
 * re-derivable from the commit plus the stamped
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
    // Sorted by the UTF-8 BYTES of the path, and hashed as those bytes — never by JS string
    // order, which compares UTF-16 code units and disagrees with byte order for non-ASCII names
    // (every payload path is ASCII today, where the two agree; the digest must be re-derivable
    // outside Node regardless). Raised by Copilot on the porting pull request, in two notes —
    // the ordering and the stamp's self-description — repaired together because they are one
    // definition with two carriers.
    const encoded = files.map((rel) => ({ rel, bytes: Buffer.from(rel, "utf8") })).sort((a, b) => Buffer.compare(a.bytes, b.bytes));
    for (const { rel, bytes } of encoded) {
        const fileHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(cutDir, rel))).digest("hex");
        digest.update(bytes);
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
        license: "Apache-2.0",
        license_file: "EVAL-LICENSE.md",
        content_digest: `sha256:${bundleDigest(cutDir)}`,
        content_digest_scope:
            "sha256 over 'UTF-8 bytes of relative path, NUL, lowercase sha256 hex of file bytes, LF' for every file in this bundle except this stamp, entries sorted by the UTF-8 bytes of the path",
    };
    fs.writeFileSync(path.join(cutDir, "EVAL-STAMP.json"), `${JSON.stringify(stamp, null, 2)}\n`);
}

/**
 * Every machine-read `license` field in the cut whose value is NOT Apache-2.0, as `{ rel, saw }`.
 * The walk is the census walk's mirror: parse each `.json`, descend to every depth, and read every
 * `license` key bound to a string. An unparseable `.json` is skipped for the same reason the census
 * skips it — a file no JSON parser reads is not machine-readable as JSON.
 */
export function nonApacheAssertions(dir) {
    const found = [];
    const scan = (rel, value) => {
        if (Array.isArray(value)) return value.forEach((v) => scan(rel, v));
        if (value === null || typeof value !== "object") return;
        for (const [key, inner] of Object.entries(value)) {
            if (key === "license" && typeof inner === "string" && inner !== "Apache-2.0") found.push({ rel, saw: inner });
            else scan(rel, inner);
        }
    };
    const walk = (sub) => {
        for (const entry of fs.readdirSync(path.join(dir, sub), { withFileTypes: true })) {
            const rel = sub === "" ? entry.name : `${sub}/${entry.name}`;
            if (entry.isDirectory()) {
                walk(rel);
                continue;
            }
            if (!rel.endsWith(".json")) continue;
            let parsed;
            try {
                parsed = JSON.parse(fs.readFileSync(path.join(dir, rel), "utf8"));
            } catch {
                continue;
            }
            scan(rel, parsed);
        }
    };
    walk("");
    return found.sort((a, b) => Buffer.compare(Buffer.from(a.rel, "utf8"), Buffer.from(b.rel, "utf8")));
}

/**
 * The guard, INVERTED on the maintainer's ruling of 2026-08-18 (issue 284). The bundle is cut from
 * tracked blobs of a public Apache-2.0 tree, so its files carry Apache-2.0 and a machine-read field
 * saying anything else is the defect — it under-reports a permissive licence as proprietary, which
 * is the direction that actually costs an evaluee's tooling something. What the rail is for is
 * unchanged: SOMETHING holds machine-read licence metadata to a stated intent, and a bundle cannot
 * silently mislicense itself.
 *
 * It also checks the SELF_EXCLUDED paths DIRECTLY. That used to ride on a side effect — those files
 * carry the needle, so a cut containing them failed the old presence-guard — and inverting the guard
 * would have dropped the backstop silently. Checked rather than inherited, and diagnosed as its own
 * failure, because telling an operator the wrong story sends them to the wrong repair.
 */
export function auditCut(cutDir) {
    const leaked = SELF_EXCLUDED.filter((rel) => fs.existsSync(path.join(cutDir, rel)));
    const wrong = nonApacheAssertions(cutDir);
    if (leaked.length === 0 && wrong.length === 0) return;
    const lines = [
        ...leaked.map((rel) => `${rel} — the self-exclusion FAILED; this issuer-machinery file must not be in a cut at all`),
        ...wrong.map(({ rel, saw }) =>
            APACHE_MANIFESTS.includes(rel)
                ? `${rel} — a known manifest declares \`${saw}\`, not Apache-2.0; the bundle carries the public tree's licence`
                : `${rel} — declares \`${saw}\`, not Apache-2.0; add it to APACHE_MANIFESTS if it should assert, or stop shipping it`,
        ),
    ];
    throw new Refused(`REFUSING: the cut does not carry the licence it ships under:\n  ${lines.join("\n  ")}`);
}

/**
 * One whole cut: materialise, verify both rosters, transform, stamp, guard. Returns what the
 * caller needs to report. Everything before the transforms is read-only against the repository;
 * everything after happens inside `cutDir`.
 */
export function cut(root, commit, { name, login, date }, cutDir) {
    const fullSha = git(root, ["rev-parse", "--verify", `${commit}^{commit}`], `resolve ${commit}`).trim();
    // The template is read FIRST, from the same sha the payload will come from — a commit that
    // cannot supply its own terms is refused before a single payload byte is written.
    const template = readTemplateAt(root, fullSha);
    assertPartition(root, fullSha);
    const { entries, selfExcludedPresent } = payloadEntries(root, fullSha);
    materialize(root, entries, cutDir);
    assertCensus(cutDir);
    fs.writeFileSync(path.join(cutDir, "EVAL-LICENSE.md"), renderEvalLicense(template, { name, login, date, fullSha }));
    fs.writeFileSync(path.join(cutDir, "NOTICE"), EVAL_NOTICE);
    prependBanner(cutDir, { name, date, fullSha });
    writeStamp(cutDir, { name, login, date, fullSha });
    auditCut(cutDir);
    return { fullSha, fileCount: entries.length, selfExcludedPresent };
}

/**
 * Today in the machine's local calendar, as YYYY-MM-DD — what the pre-port script's date(1)
 * printed. Formatted from date PARTS, never through a locale: `toLocaleDateString("en-CA")`
 * happens to print this shape only where full ICU data is present, and a small-ICU node falls
 * back to another locale's order — the tool would then violate its own `--date wants YYYY-MM-DD`
 * contract. Raised by Copilot on the porting pull request.
 */
export function localDate(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
        "  --check     cut the INDEX (as an unreferenced probe commit) to a scratch directory with a",
        "              fixture recipient, verify every invariant, delete the scratch — what",
        "              .portulan/verify/eval-bundle.sh runs; judges what is about to ship",
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
                throw new CannotRun("--check takes no stamping flags — it cuts the index for a fixture recipient and deletes the result");
            }
            // --check cuts a PROBE COMMIT of the index — `write-tree` + `commit-tree`, an
            // unreferenced commit object no branch ever points at — rather than HEAD. Two reasons,
            // both load-bearing. First, a pre-commit gate should judge what is ABOUT to ship: the
            // old HEAD-read carried a named limit ("an uncommitted manifest edit is invisible
            // until committed"), and the probe narrows it to unstaged edits only. Second, the
            // terms-from-the-commit rule (the supervisor's ruling above) must hold for --check
            // exactly as for issuance — no working-tree fallback anywhere — and a staged template
            // is IN the probe, so the strict read needs no bootstrap exception in the very change
            // that lands the template. In CI the checkout's index IS the merge commit, so the
            // probe judges precisely what a green would vouch for. The ident is pinned because a
            // CI checkout configures none, and commit-tree refuses an empty ident.
            const probeTree = git(top, ["write-tree"], "snapshot the index as a tree").trim();
            const probe = git(
                top,
                ["-c", "user.name=eval-bundle-check", "-c", "user.email=check@verify-fixture.invalid", "commit-tree", probeTree, "-p", "HEAD", "-m", "eval-bundle --check probe (unreferenced)"],
                "wrap the index snapshot as a probe commit",
            ).trim();
            // The scratch is cleaned in `finally`, unconditionally — this repository has already
            // paid for verify machinery that leaked scratch directories on every run (the incident
            // proposal 0029 records), and a cleanup that only runs on success re-buys it.
            const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-eval-check-"));
            try {
                const cutDir = path.join(scratch, "portulan-eval");
                fs.mkdirSync(cutDir);
                const result = cut(top, probe, { ...CHECK_RECIPIENT, date: localDate() }, cutDir);
                const exercised = result.selfExcludedPresent.length > 0;
                stdout.write(`eval-bundle --check: cut the INDEX as probe ${result.fullSha.slice(0, 7)} (parent HEAD) for ${CHECK_RECIPIENT.name} — ${result.fileCount} file(s)\n`);
                stdout.write(`  terms: EVAL-LICENSE.md rendered from ${TEMPLATE_PATH} AT the probe — payload and terms are one sha\n`);
                stdout.write(`  partition: ${PAYLOAD.length} payload + ${Object.keys(EXCLUDED_TOP_LEVEL).length} excluded top-level entries — matches the tree\n`);
                stdout.write(`  census: machine-read Apache assertions == the ${APACHE_MANIFESTS.length} declaring manifest(s), unchanged by the cut\n`);
                stdout.write(
                    exercised
                        ? `  self-exclusion: exercised — ${result.selfExcludedPresent.join(", ")} present in the index and filtered out of the cut\n`
                        : `  self-exclusion: vacuous in this index (the cutter is not in it) — the filter is exercised positively in cli/eval-bundle.test.mjs\n`,
                );
                stdout.write(`  guard: every machine-read license field reads Apache-2.0 and no issuer machinery leaked; content digest sha256:${bundleDigest(cutDir).slice(0, 12)}…\n`);
                stdout.write("ok  eval-bundle — a clean evaluation bundle cuts from the index\n");
            } finally {
                fs.rmSync(scratch, { recursive: true, force: true });
            }
            return 0;
        }

        for (const [flag, value] of [["--to", name], ["--github", login], ["--commit", commit], ["--out", out]]) {
            if (!value) throw new CannotRun(`${flag} is required for an issuance cut (or pass --check); see --help`);
        }
        // `--github` names the tarball, so it is held to what can name a file safely — path
        // separators and dot-dot are refused by CONTENT, and the tarball path is then re-checked
        // by RESOLUTION below, the same belt-and-resolution pair the materialiser wears. Not the
        // full GitHub login grammar on purpose: the suite's own fixture logins carry a dot
        // (`.invalid`, so they cannot be mistaken for people), and a grammar check would refuse
        // the fixtures while adding nothing the two real checks miss. `--to` reaches file
        // CONTENT only, never a path, so it takes no such check. Raised by Copilot on the
        // porting pull request — the write-site containment class, at its second site.
        if (/[/\\]|\.\./.test(login)) {
            throw new CannotRun(`--github ${JSON.stringify(login)} cannot name a file safely — path separators and dot-dot are refused`);
        }
        const outDir = path.resolve(where, out);
        const cutDir = path.join(outDir, "portulan-eval");
        const stampDate = date ?? localDate();
        // The ONE computation of the tarball path — validated here, written to below. A second
        // spelling at the write site would be a second definition of where the archive goes.
        const tarball = path.resolve(outDir, `portulan-eval-${login}-${stampDate}.tgz`);
        if (!tarball.startsWith(outDir + path.sep)) {
            throw new CannotRun(`the tarball name resolves outside --out — refusing to write beyond the requested directory`);
        }
        if (fs.existsSync(cutDir)) {
            throw new CannotRun(`${cutDir} already exists — refusing to cut into a directory that may hold a previous bundle`);
        }
        fs.mkdirSync(cutDir, { recursive: true });
        const result = cut(top, commit, { name, login, date: stampDate }, cutDir);

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
