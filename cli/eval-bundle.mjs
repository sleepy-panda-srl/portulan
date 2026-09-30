#!/usr/bin/env node
// Cut a named-recipient evaluation bundle of Portulan from a commit.
//
// Exit 0 green · 1 the guard or a pinned roster refused · 2 could not run, a crash included.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Exit 2: the tool could not run, or could not judge honestly. */
export class CannotRun extends Error {}

/** Exit 1: the guard or a pinned roster found a breach. */
export class Refused extends Error {}

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
    "changes",
    "LICENSE",
];

export const EXCLUDED_TOP_LEVEL = {
    ".claude": "compiled host configuration for building THIS repository, not for running a copy of it",
    ".github": "CI, issue forms and review wiring — how this repository is run, not what it ships",
    ".gitignore": "a working-copy concern; the bundle is not a working copy of this repository",
    ".portulan": "the build record — handoffs, proposals, memory; the bundle ships the product, not the record",
    CODEOWNERS: "review routing for this repository's own pull requests",
    "CONTRIBUTING.md": "describes contribution to THIS repository; an evaluation copy is not a contribution surface",
    "SECURITY.md": "names the reporting channels for THIS repository — its Security tab and its maintainer; an evaluation copy has neither",
    docs: "vision, plan, milestones and pricing drafts — the company's record, not the product",
    evals: "this repository's own measurement of itself — the gate corpus attacks THIS workspace's gate policy, which no bundle ships, so the fixtures would arrive with nothing to grade. The reason changed 2026-08-24: it read `milestone-8 scaffolding; one README today, and the bundle should not imply more`, which stopped being true the moment the corpus landed. Same exclusion, and it is now a decision rather than an absence. `cli/goldens.mjs` DOES ship, the way `cli/compile.mjs` ships without `.portulan/gates.json`: the tool is product, the policy it reads is this team's",
    "package.json": "the npm publish surface — a copy is not published from, and its scripts and metadata describe this repository's release, not the bundle",
};

// Issuer machinery: a bundle carries the stamped license, never what stamps it.
export const SELF_EXCLUDED = ["cli/eval-bundle.mjs", "cli/eval-bundle.test.mjs", "cli/eval-license.template.md"];

export const TEMPLATE_PATH = "cli/eval-license.template.md";
const TEMPLATE_PLACEHOLDERS = ["{{name}}", "{{login}}", "{{date}}", "{{shortSha}}"];

export const APACHE_MANIFESTS = [
    ".claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "packs/.claude-plugin/plugin.json",
];

export const APACHE_NEEDLE = Buffer.from('"license": "Apache-2.0"');

// No GitHub login has a dot, and `.invalid` is reserved, so no one takes the fixture for a person.
export const CHECK_RECIPIENT = { name: "Verify Fixture (not a person)", login: "verify-fixture.invalid" };

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

export function payloadEntries(root, commit) {
    const raw = git(
        root,
        ["ls-tree", "-r", "-z", "--full-tree", commit, "--", ...PAYLOAD],
        `list the payload at ${commit.slice(0, 7)}`,
    );
    // Filtered here: an exclude pathspec given to `ls-tree` silently excludes nothing.
    const excluded = new Set(SELF_EXCLUDED);
    const entries = [];
    const selfExcludedPresent = [];
    for (const line of raw.split("\0")) {
        if (line === "") continue;
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

/** Containment is checked on the resolved path: `ls-tree` prints whatever a crafted tree carries, `..` included. */
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
        // chmod after the write: `writeFileSync`'s `mode` is masked by the umask, chmod(2) is not.
        fs.chmodSync(target, fileMode);
    }
}

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

function jsonAssertsApache(value) {
    if (Array.isArray(value)) return value.some(jsonAssertsApache);
    if (value === null || typeof value !== "object") return false;
    for (const [key, inner] of Object.entries(value)) {
        if (key === "license" && typeof inner === "string" && /apache/i.test(inner)) return true;
        if (jsonAssertsApache(inner)) return true;
    }
    return false;
}

/** A limit: an assertion in a non-JSON format, spelled other than APACHE_NEEDLE, is not found. */
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
    return [...found.entries()].map(([rel, how]) => ({ rel, how })).sort((a, b) => Buffer.compare(Buffer.from(a.rel, "utf8"), Buffer.from(b.rel, "utf8")));
}

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

export const EVAL_NOTICE = `Portulan
Copyright 2026 Sleepy Panda SRL

This product is developed by Sleepy Panda SRL (https://sleepypanda.ro).
This copy is an evaluation issue recorded in EVAL-LICENSE.md, and is licensed
under the Apache License, Version 2.0 — the same terms as the public repository
it was cut from.
`;

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

/** Reproducible from the commit plus the stamped parameters, unlike the tarball's hash: tar records mtimes. */
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
    // UTF-8 byte order, never JS string order (UTF-16 code units), so the digest re-derives outside Node.
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

export function writeStamp(cutDir, { name, login, date, fullSha }) {
    const stamp = {
        artifact: "portulan-eval",
        issued_to: { name, github: login },
        issued_on: date,
        issued_by: "Sleepy Panda SRL",
        source_commit: fullSha,
        license: "Apache-2.0",
        license_file: "LICENSE",
        issuance_record: "EVAL-LICENSE.md",
        content_digest: `sha256:${bundleDigest(cutDir)}`,
        content_digest_scope:
            "sha256 over 'UTF-8 bytes of relative path, NUL, lowercase sha256 hex of file bytes, LF' for every file in this bundle except this stamp, entries sorted by the UTF-8 bytes of the path",
    };
    fs.writeFileSync(path.join(cutDir, "EVAL-STAMP.json"), `${JSON.stringify(stamp, null, 2)}\n`);
}

export function nonApacheAssertions(dir) {
    const found = [];
    const scan = (rel, value) => {
        if (Array.isArray(value)) return value.forEach((v) => scan(rel, v));
        if (value === null || typeof value !== "object") return;
        for (const [key, inner] of Object.entries(value)) {
            // Any type is judged: npm's historic `license` form is an object.
            if (key === "license") {
                if (inner !== "Apache-2.0") {
                    const kind = Array.isArray(inner) ? "array" : inner === null ? "null" : typeof inner;
                    const saw = typeof inner === "string" ? inner : `${JSON.stringify(inner)} — ${kind}, not a string`;
                    found.push({ rel, saw });
                }
                scan(rel, inner);
            } else scan(rel, inner);
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

export function auditCut(cutDir) {
    const leaked = SELF_EXCLUDED.filter((rel) => fs.existsSync(path.join(cutDir, rel)));
    const wrong = nonApacheAssertions(cutDir);
    if (leaked.length === 0 && wrong.length === 0) return;
    const lines = [
        ...leaked.map((rel) => `${rel} — the self-exclusion FAILED; this issuer-machinery file must not be in a cut at all`),
        ...wrong.map(({ rel, saw }) =>
            APACHE_MANIFESTS.includes(rel)
                ? `${rel} — a known manifest declares \`${saw}\`, not Apache-2.0; the bundle carries the public tree's licence`
                : `${rel} — declares \`${saw}\`, not Apache-2.0. Change the field to Apache-2.0 or remove it; ` +
                  `rostering the file in APACHE_MANIFESTS does NOT clear this on its own, and belongs in the same ` +
                  `change only if the file is meant to declare. If neither is right, stop shipping it.`,
        ),
    ];
    throw new Refused(`REFUSING: the cut does not carry the licence it ships under:\n  ${lines.join("\n  ")}`);
}

export function cut(root, commit, { name, login, date }, cutDir) {
    const fullSha = git(root, ["rev-parse", "--verify", `${commit}^{commit}`], `resolve ${commit}`).trim();
    // First, so a commit that cannot supply its own terms is refused before any payload byte is written.
    const template = readTemplateAt(root, fullSha);
    assertPartition(root, fullSha);
    const { entries, selfExcludedPresent } = payloadEntries(root, fullSha);
    materialize(root, entries, cutDir);
    // Before the stamp, which asserts Apache-2.0 and is not in APACHE_MANIFESTS.
    assertCensus(cutDir);
    fs.writeFileSync(path.join(cutDir, "EVAL-LICENSE.md"), renderEvalLicense(template, { name, login, date, fullSha }));
    fs.writeFileSync(path.join(cutDir, "NOTICE"), EVAL_NOTICE);
    prependBanner(cutDir, { name, date, fullSha });
    writeStamp(cutDir, { name, login, date, fullSha });
    auditCut(cutDir);
    return { fullSha, fileCount: entries.length, selfExcludedPresent };
}

/** From date parts: `toLocaleDateString("en-CA")` prints YYYY-MM-DD only where node has full ICU data. */
export function localDate(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function usage() {
    return [
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
        const top = git(where, ["rev-parse", "--show-toplevel"], `find a git repository at ${where}`).trim();

        if (check) {
            if (name || login || commit || out || date) {
                throw new CannotRun("--check takes no stamping flags — it cuts the index for a fixture recipient and deletes the result");
            }
            const probeTree = git(top, ["write-tree"], "snapshot the index as a tree").trim();
            // Ident pinned: a CI checkout configures none, and `commit-tree` refuses to run without one.
            const probe = git(
                top,
                ["-c", "user.name=eval-bundle-check", "-c", "user.email=check@verify-fixture.invalid", "commit-tree", probeTree, "-p", "HEAD", "-m", "eval-bundle --check probe (unreferenced)"],
                "wrap the index snapshot as a probe commit",
            ).trim();
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
        // Only what naming a file needs: the GitHub login grammar would refuse the dotted fixture logins.
        if (/[/\\]|\.\./.test(login)) {
            throw new CannotRun(`--github ${JSON.stringify(login)} cannot name a file safely — path separators and dot-dot are refused`);
        }
        const outDir = path.resolve(where, out);
        const cutDir = path.join(outDir, "portulan-eval");
        const stampDate = date ?? localDate();
        const tarball = path.resolve(outDir, `portulan-eval-${login}-${stampDate}.tgz`);
        if (!tarball.startsWith(outDir + path.sep)) {
            throw new CannotRun(`the tarball name resolves outside --out — refusing to write beyond the requested directory`);
        }
        if (fs.existsSync(cutDir)) {
            throw new CannotRun(`${cutDir} already exists — refusing to cut into a directory that may hold a previous bundle`);
        }
        fs.mkdirSync(cutDir, { recursive: true });
        const result = cut(top, commit, { name, login, date: stampDate }, cutDir);

        // Issuance only: `--check`, and so the verify recipe, never needs tar.
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
