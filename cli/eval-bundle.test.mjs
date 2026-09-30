// The evaluation-bundle cutter, driven on this repository AND on real fixture repositories.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    run,
    cut,
    payloadEntries,
    materialize,
    assertPartition,
    assertCensus,
    auditCut,
    bundleDigest,
    filesCarrying,
    localDate,
    readTemplateAt,
    renderEvalLicense,
    TEMPLATE_PATH,
    PAYLOAD,
    EXCLUDED_TOP_LEVEL,
    SELF_EXCLUDED,
    APACHE_MANIFESTS,
    APACHE_NEEDLE,
    EVAL_NOTICE,
    CannotRun,
    Refused,
} from "./eval-bundle.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(HERE);
const RUNNER = path.join(HERE, "eval-bundle.mjs");

// One exit handler for every scratch directory: one each would pass node's default listener limit and warn.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-evalbundle-"));
    SCRATCH.push(dir);
    return dir;
}

const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function sink() {
    let text = "";
    return {
        write(chunk) {
            text += chunk;
            return true;
        },
        toString: () => text,
    };
}

// A dot makes the login impossible on GitHub, so nothing in a public tree reads it as a person.
const FIXTURE = { name: "Example Evaluator (test fixture)", login: "example-evaluator.invalid", date: "2026-01-15" };

/** The index of `root` as an unreferenced commit, so a cut reads files the working tree has and HEAD lacks. */
function probeCommit(root) {
    const tree = git(root, "write-tree").trim();
    return git(root, "-c", "user.name=suite", "-c", "user.email=suite@verify-fixture.invalid", "commit-tree", tree, "-p", "HEAD", "-m", "suite probe").trim();
}

function walkFiles(dir, sub = "") {
    const out = [];
    for (const entry of fs.readdirSync(path.join(dir, sub), { withFileTypes: true })) {
        const rel = sub === "" ? entry.name : `${sub}/${entry.name}`;
        if (entry.isDirectory()) out.push(...walkFiles(dir, rel));
        else out.push(rel);
    }
    return out.sort();
}

describe("the pinned rosters, measured with this suite's own instruments", () => {
    test("PAYLOAD ∪ EXCLUDED_TOP_LEVEL partitions the top-level tracked set at HEAD, disjointly", () => {
        const actual = git(REPO, "ls-tree", "--name-only", "--full-tree", "HEAD").split("\n").filter(Boolean).sort();
        const classified = [...PAYLOAD, ...Object.keys(EXCLUDED_TOP_LEVEL)].sort();
        assert.deepEqual(
            classified,
            actual,
            "the payload partition in cli/eval-bundle.mjs no longer matches the tree — classify the new path into PAYLOAD or EXCLUDED_TOP_LEVEL (with its reason), or remove the stale entry",
        );
        const overlap = PAYLOAD.filter((p) => p in EXCLUDED_TOP_LEVEL);
        assert.deepEqual(overlap, [], "a path ships or it does not — never both");
    });

    test("the payload files carrying the machine-read assertion at HEAD are exactly APACHE_MANIFESTS", () => {
        // `git grep` exits 1 on no match, which throws here: the right failure for a census that found nothing.
        const byteForm = git(REPO, "grep", "-l", "--fixed-strings", APACHE_NEEDLE.toString(), "HEAD", "--", ...PAYLOAD)
            .split("\n")
            .filter(Boolean)
            .map((line) => line.replace(/^HEAD:/, ""));
        // The byte form misses Apache in other whitespace or spelling, so the manifests are also walked as JSON.
        const assertsApache = (value) => {
            if (Array.isArray(value)) return value.some(assertsApache);
            if (value === null || typeof value !== "object") return false;
            return Object.entries(value).some(
                ([k, v]) => (k === "license" && typeof v === "string" && /apache/i.test(v)) || assertsApache(v),
            );
        };
        const parsed = git(REPO, "ls-tree", "-r", "--name-only", "HEAD", "--", ...PAYLOAD)
            .split("\n")
            .filter((rel) => rel.endsWith(".json"))
            .filter((rel) => {
                try {
                    return assertsApache(JSON.parse(git(REPO, "show", `HEAD:${rel}`)));
                } catch {
                    return false;
                }
            });
        const hits = [...new Set([...byteForm, ...parsed])].filter((rel) => !SELF_EXCLUDED.includes(rel)).sort();
        assert.deepEqual(
            hits,
            [...APACHE_MANIFESTS].sort(),
            "a payload file's machine-read Apache assertions have drifted from APACHE_MANIFESTS — reconcile the roster in cli/eval-bundle.mjs, or stop shipping the file",
        );
    });

    test("every declaring manifest and self-excluded path is inside the payload roster", () => {
        for (const rel of [...APACHE_MANIFESTS, ...SELF_EXCLUDED]) {
            const top = rel.split("/")[0];
            assert.ok(PAYLOAD.includes(top), `${rel} is rostered under ${top}, which is not a payload entry — a declaration or exclusion outside the payload is dead configuration`);
        }
    });
});

describe("a full issuance cut of this repository", () => {
    const out = scratch();
    const stdout = sink();
    const probeSha = probeCommit(REPO);
    const code = run(["--to", FIXTURE.name, "--github", FIXTURE.login, "--commit", probeSha, "--out", out, "--date", FIXTURE.date, REPO], { stdout, stderr: sink() });
    const cutDir = path.join(out, "portulan-eval");

    test("exits 0 and the cut exists", () => {
        assert.equal(code, 0, stdout.toString());
        assert.ok(fs.existsSync(cutDir));
    });

    test("EVAL-LICENSE.md is the COMMIT's template rendered — verified with this suite's own read", () => {
        const text = fs.readFileSync(path.join(cutDir, "EVAL-LICENSE.md"), "utf8");
        const independent = git(REPO, "show", `${probeSha}:${TEMPLATE_PATH}`)
            .replaceAll("{{name}}", FIXTURE.name)
            .replaceAll("{{login}}", FIXTURE.login)
            .replaceAll("{{date}}", FIXTURE.date)
            .replaceAll("{{shortSha}}", probeSha.slice(0, 7));
        assert.equal(text, independent);
        for (const needle of [FIXTURE.name, `github.com/${FIXTURE.login}`, FIXTURE.date, probeSha.slice(0, 7)]) {
            assert.ok(text.includes(needle), `the license does not carry ${needle}`);
        }
        assert.ok(!text.includes("{{"), "an unfilled placeholder survived into the stamped license");
    });

    test("NOTICE is the evaluation-issue NOTICE", () => {
        assert.equal(fs.readFileSync(path.join(cutDir, "NOTICE"), "utf8"), EVAL_NOTICE);
    });

    test("every declaring manifest still reads Apache-2.0 after the cut — nothing rewrites licence metadata", () => {
        for (const rel of APACHE_MANIFESTS) {
            const manifest = JSON.parse(fs.readFileSync(path.join(cutDir, rel), "utf8"));
            const declared = [];
            if ("license" in manifest) declared.push([manifest.license, rel]);
            for (const [i, plugin] of (manifest.plugins ?? []).entries()) {
                if ("license" in plugin) declared.push([plugin.license, `${rel} plugins[${i}]`]);
            }
            assert.ok(declared.length > 0, `${rel} is in APACHE_MANIFESTS and declares no license field at all`);
            for (const [value, where] of declared) assert.equal(value, "Apache-2.0", where);
        }
    });

    test("LICENSE ships, so the README's own License link resolves inside the bundle", () => {
        const text = fs.readFileSync(path.join(cutDir, "LICENSE"), "utf8");
        assert.match(text, /Apache License/, "the shipped LICENSE is not the Apache text");
    });

    test("README opens with the banner, and its own License section is left exactly as the tree wrote it", () => {
        const text = fs.readFileSync(path.join(cutDir, "README.md"), "utf8");
        assert.ok(text.startsWith("> **EVALUATION COPY — issued to"), "the banner is not the first thing an evaluee reads");
        assert.ok(text.includes(FIXTURE.name) && text.includes(FIXTURE.date), "the banner is not stamped");
        assert.ok(text.includes("EVAL-LICENSE.md"), "the banner does not point at the copy's issuance record");
        assert.ok(text.includes("[Apache-2.0](LICENSE)"), "the README's own License section was altered; the cut must not touch it");
    });

    test("EVAL-STAMP.json carries the recipient, the commit, and a digest that recomputes", () => {
        const stamp = JSON.parse(fs.readFileSync(path.join(cutDir, "EVAL-STAMP.json"), "utf8"));
        assert.equal(stamp.artifact, "portulan-eval");
        assert.deepEqual(stamp.issued_to, { name: FIXTURE.name, github: FIXTURE.login });
        assert.equal(stamp.issued_on, FIXTURE.date);
        assert.equal(stamp.source_commit, probeSha);
        assert.ok(!("term_days" in stamp), "the stamp asserts a term nothing tracks or enforces");
        assert.equal(stamp.license, "Apache-2.0");
        assert.equal(stamp.license_file, "LICENSE");
        assert.equal(stamp.issuance_record, "EVAL-LICENSE.md");
        assert.ok(fs.existsSync(path.join(cutDir, stamp.license_file)), "license_file names a file the bundle does not contain");
        assert.ok(fs.existsSync(path.join(cutDir, stamp.issuance_record)), "issuance_record names a file the bundle does not contain");
        assert.equal(stamp.content_digest, `sha256:${bundleDigest(cutDir)}`, "the digest in the stamp does not recompute from the cut");
    });

    test("what must be absent is absent — the excluded top level and the issuer machinery", () => {
        for (const name of [...Object.keys(EXCLUDED_TOP_LEVEL), ...SELF_EXCLUDED]) {
            assert.ok(!fs.existsSync(path.join(cutDir, name)), `${name} is in the cut and must not be`);
        }
    });

    test("the machine-read assertion survives the cut — the declaring manifests, plus the stamp", () => {
        // The cut writes the stamp, licence included, after `assertCensus` ran, so the census never sees it.
        assert.deepEqual(filesCarrying(cutDir, APACHE_NEEDLE).sort(), [...APACHE_MANIFESTS, "EVAL-STAMP.json"].sort());
    });

    test("the tarball exists and the printed sha256 is the tarball's", () => {
        const tarball = path.join(out, `portulan-eval-${FIXTURE.login}-${FIXTURE.date}.tgz`);
        assert.ok(fs.existsSync(tarball));
        const printed = stdout.toString().match(/sha256:([0-9a-f]{64})\s+\S*portulan-eval-.*\.tgz/);
        assert.ok(printed, `no tarball hash in:\n${stdout.toString()}`);
        const actual = crypto.createHash("sha256").update(fs.readFileSync(tarball)).digest("hex");
        assert.equal(printed[1], actual, "the printed hash is not the delivered bytes' — the ledger would record a lie");
    });

    test("the content digest is reproducible: a second cut of the same commit carries the same digest", () => {
        const again = scratch();
        const code2 = run(["--to", FIXTURE.name, "--github", FIXTURE.login, "--commit", probeSha, "--out", again, "--date", FIXTURE.date, REPO], { stdout: sink(), stderr: sink() });
        assert.equal(code2, 0);
        const first = JSON.parse(fs.readFileSync(path.join(cutDir, "EVAL-STAMP.json"), "utf8")).content_digest;
        const second = JSON.parse(fs.readFileSync(path.join(again, "portulan-eval", "EVAL-STAMP.json"), "utf8")).content_digest;
        // Not asserted for the tarballs: tar embeds mtimes, so two cuts of one content differ.
        assert.equal(first, second);
    });

    test("plumbing == archive: the materialised payload is byte-identical to git archive, modes included", (t) => {
        try {
            execFileSync("tar", ["--version"], { stdio: ["ignore", "ignore", "ignore"] });
        } catch {
            t.skip("no tar on this machine — the plumbing==archive equivalence is unexercised here; every other test still runs");
            return;
        }
        const viaArchive = scratch();
        const tarFile = path.join(viaArchive, "payload.tar");
        execFileSync("git", ["-C", REPO, "archive", "-o", tarFile, "HEAD", "--", ...PAYLOAD], { stdio: ["ignore", "ignore", "pipe"] });
        execFileSync("tar", ["-xf", tarFile, "-C", viaArchive], { stdio: ["ignore", "ignore", "pipe"] });
        fs.rmSync(tarFile);
        // `git archive` has no self-exclusion, so the excluded files are dropped from its side first.
        for (const rel of SELF_EXCLUDED) fs.rmSync(path.join(viaArchive, rel), { force: true });

        const viaPlumbing = scratch();
        const { entries } = payloadEntries(REPO, "HEAD");
        materialize(REPO, entries, viaPlumbing);

        assert.deepEqual(walkFiles(viaPlumbing), walkFiles(viaArchive), "the two transports materialise different file sets");
        for (const rel of walkFiles(viaPlumbing)) {
            const ours = path.join(viaPlumbing, rel);
            const theirs = path.join(viaArchive, rel);
            assert.ok(fs.readFileSync(ours).equals(fs.readFileSync(theirs)), `${rel} differs between plumbing and archive`);
            assert.equal(fs.statSync(ours).mode & 0o100, fs.statSync(theirs).mode & 0o100, `${rel} differs in executable bit`);
        }
    });
});

describe("the guard, fed cuts built to deserve refusal", () => {
    function freshCut() {
        const dir = path.join(scratch(), "portulan-eval");
        fs.mkdirSync(dir);
        cut(REPO, probeCommit(REPO), FIXTURE, dir);
        return dir;
    }

    test("a manifest declaring a non-Apache licence is refused, named, with the value it saw", () => {
        const dir = freshCut();
        fs.writeFileSync(path.join(dir, "spec", "planted.json"), `{"license": "LicenseRef-Something-Else"}\n`);
        assert.throws(() => auditCut(dir), (error) => {
            assert.ok(error instanceof Refused);
            assert.match(error.message, /spec\/planted\.json/);
            assert.match(error.message, /LicenseRef-Something-Else/);
            assert.match(error.message, /Change the field to Apache-2\.0 or remove it/);
            assert.match(error.message, /does NOT clear this on its own/);
            return true;
        });
    });

    test("a KNOWN manifest drifting off Apache gets its own diagnosis, not the unknown-file one", () => {
        const dir = freshCut();
        const rel = APACHE_MANIFESTS[0];
        const manifest = JSON.parse(fs.readFileSync(path.join(dir, rel), "utf8"));
        manifest.license = "LicenseRef-Portulan-Eval";
        fs.writeFileSync(path.join(dir, rel), `${JSON.stringify(manifest, null, 2)}\n`);
        assert.throws(() => auditCut(dir), (error) => {
            assert.match(error.message, new RegExp(`${rel.replace(/[./]/g, "\\$&")} — a known manifest declares`));
            assert.match(error.message, /the bundle carries the public tree's licence/);
            return true;
        });
    });

    test("a self-excluded file appearing in a cut is diagnosed as a failed filter, and carries no needle to catch it", () => {
        const dir = freshCut();
        fs.mkdirSync(path.join(dir, "cli"), { recursive: true });
        fs.writeFileSync(path.join(dir, "cli", "eval-bundle.mjs"), "// planted, and deliberately mentioning no licence at all\n");
        assert.throws(() => auditCut(dir), (error) => {
            assert.match(error.message, /cli\/eval-bundle\.mjs — the self-exclusion FAILED/);
            return true;
        });
    });

    test("a license key at depth is refused — plugins[] is not the only nesting a manifest can grow", () => {
        const dir = freshCut();
        fs.writeFileSync(path.join(dir, "spec", "nested.json"), `{"components": [{"license":"MIT"}]}\n`);
        assert.throws(() => auditCut(dir), /spec\/nested\.json — declares `MIT`/);
    });

    test("an Apache value in another wording is refused — Apache-2.0 is the value, not a family", () => {
        const dir = freshCut();
        fs.writeFileSync(path.join(dir, "spec", "worded.json"), `{"license": "Apache License 2.0"}\n`);
        assert.throws(() => auditCut(dir), /spec\/worded\.json — declares `Apache License 2\.0`/);
    });

    test("a non-string license value is refused too — the key is judged whatever its type", () => {
        for (const [name, literal] of [
            ["obj", '{"license": {"type": "MIT", "url": "https://example.invalid"}}'],
            ["arr", '{"license": ["MIT"]}'],
            ["num", '{"license": 42}'],
            ["nul", '{"license": null}'],
        ]) {
            const dir = freshCut();
            fs.writeFileSync(path.join(dir, "spec", `${name}.json`), `${literal}\n`);
            assert.throws(() => auditCut(dir), new RegExp(`spec/${name}\\.json — declares .*not a string`), `${name} slipped past the guard`);
        }
    });

    test("a clean cut passes the inverted guard", () => {
        const dir = freshCut();
        auditCut(dir);
    });

    test("a broken .json passes — a file no parser reads is not machine-readable JSON", () => {
        const dir = freshCut();
        fs.writeFileSync(path.join(dir, "spec", "broken.json"), "{ this is not json, and mentions Apache only in prose\n");
        auditCut(dir);
    });
});

describe("fixture repositories — the filter exercised positively, and every refusal reached", () => {
    /** A repository with every PAYLOAD and EXCLUDED_TOP_LEVEL entry, so each refusal below is one mutation from green. */
    function fixtureRepo() {
        const root = scratch();
        git(root, "init", "-q", "-b", "main");
        git(root, "config", "user.email", "t@example.com");
        git(root, "config", "user.name", "t");
        const file = (rel, text) => {
            fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
            fs.writeFileSync(path.join(root, rel), text);
        };
        const TOP_LEVEL_FILES = new Set(["NOTICE", "LICENSE"]);
        for (const top of PAYLOAD) {
            if (top.includes(".md") || TOP_LEVEL_FILES.has(top)) continue;
            file(`${top}/keep.txt`, `${top}\n`);
        }
        for (const top of Object.keys(EXCLUDED_TOP_LEVEL)) {
            // Neutral content: a `.gitignore` holding its own name would ignore itself and go untracked.
            if (/[.]md$|^[.](git)?ignore$|^CODEOWNERS$|^package[.]json$/.test(top)) file(top, "# fixture\n");
            else file(`${top}/keep.txt`, `${top}\n`);
        }
        file("README.md", "# Fixture\n\nBody.\n\n## License\n\n[Apache-2.0](LICENSE) © nobody.\n");
        file("NOTICE", "fixture notice\n");
        file("LICENSE", "Apache License\nVersion 2.0, January 2004\n");
        file("CHANGELOG.md", "# Changelog\n");
        const asserting = `{\n  ${APACHE_NEEDLE.toString()}\n}\n`;
        for (const rel of APACHE_MANIFESTS) file(rel, asserting);
        for (const rel of SELF_EXCLUDED) file(rel, `// planted at ${rel}\n`);
        file("cli/sibling.mjs", "// stays\n");
        file(TEMPLATE_PATH, "# Fixture Eval License\nTERMS-V1 · to {{name}} ({{login}}) on {{date}} from {{shortSha}}\n");
        git(root, "add", "-A");
        git(root, "commit", "-qm", "fixture");
        return root;
    }

    test("the baseline fixture cuts green — so each red below is its own mutation's", () => {
        const root = fixtureRepo();
        const dir = path.join(scratch(), "portulan-eval");
        fs.mkdirSync(dir);
        const result = cut(root, "HEAD", FIXTURE, dir);
        assert.deepEqual(result.selfExcludedPresent.sort(), [...SELF_EXCLUDED].sort(), "the filter did not report what it removed");
        for (const rel of SELF_EXCLUDED) assert.ok(!fs.existsSync(path.join(dir, rel)), `${rel} survived the filter`);
        assert.ok(fs.existsSync(path.join(dir, "cli", "sibling.mjs")), "the filter removed a sibling it had no business touching");
    });

    test("payloadEntries reports the exclusion as exercised — present in the tree, absent from the entries", () => {
        const root = fixtureRepo();
        const { entries, selfExcludedPresent } = payloadEntries(root, "HEAD");
        assert.deepEqual(selfExcludedPresent.sort(), [...SELF_EXCLUDED].sort());
        const paths = entries.map((e) => e.path);
        for (const rel of SELF_EXCLUDED) assert.ok(!paths.includes(rel));
        assert.ok(paths.includes("cli/sibling.mjs"));
    });

    test("an unclassified top-level entry is refused with the classify-it menu", () => {
        const root = fixtureRepo();
        fs.mkdirSync(path.join(root, "surprise"));
        fs.writeFileSync(path.join(root, "surprise", "keep.txt"), "x\n");
        git(root, "add", "-A");
        git(root, "commit", "-qm", "surprise");
        assert.throws(() => assertPartition(root, "HEAD"), (error) => {
            assert.ok(error instanceof Refused);
            assert.match(error.message, /surprise is tracked at top level and classified by neither roster/);
            assert.match(error.message, /add it to PAYLOAD .*or to EXCLUDED_TOP_LEVEL/);
            return true;
        });
    });

    test("a classified entry that vanished is refused as stale", () => {
        const root = fixtureRepo();
        git(root, "rm", "-qr", "evals");
        git(root, "commit", "-qm", "drop");
        assert.throws(() => assertPartition(root, "HEAD"), /evals is classified .*and no longer tracked/);
    });

    test("a new asserting manifest in the payload is refused by the census with the menu", () => {
        const root = fixtureRepo();
        fs.writeFileSync(path.join(root, "spec", "extra.json"), `{\n  ${APACHE_NEEDLE.toString()}\n}\n`);
        git(root, "add", "-A");
        git(root, "commit", "-qm", "extra");
        const dir = scratch();
        const { entries } = payloadEntries(root, "HEAD");
        materialize(root, entries, dir);
        assert.throws(() => assertCensus(dir), (error) => {
            assert.match(error.message, /spec\/extra\.json carries a machine-read Apache assertion and is not in APACHE_MANIFESTS/);
            return true;
        });
    });

    test("a declaring manifest that stopped asserting is refused, not silently skipped", () => {
        const root = fixtureRepo();
        fs.writeFileSync(path.join(root, APACHE_MANIFESTS[0]), "{}\n");
        git(root, "add", "-A");
        git(root, "commit", "-qm", "quiet");
        const dir = scratch();
        const { entries } = payloadEntries(root, "HEAD");
        materialize(root, entries, dir);
        assert.throws(() => assertCensus(dir), /no longer carries the assertion — it must, or the entry is stale/);
    });

    test("a symlink in the payload is a refusal by name, never followed and never dropped", () => {
        const root = fixtureRepo();
        fs.symlinkSync("../README.md", path.join(root, "core", "link.md"));
        git(root, "add", "-A");
        git(root, "commit", "-qm", "symlink");
        assert.throws(() => payloadEntries(root, "HEAD"), (error) => {
            assert.ok(error instanceof CannotRun);
            assert.match(error.message, /core\/link\.md with mode 120000/);
            return true;
        });
    });

    test("a listing entry that resolves outside the cut is refused at the write site", () => {
        // No porcelain writes a `..` tree entry but a crafted tree can, so the listing goes to `materialize` directly.
        const root = fixtureRepo();
        const oid = execFileSync("git", ["-C", root, "hash-object", "-w", "--stdin"], { input: "escape\n", encoding: "utf8" }).trim();
        const dir = scratch();
        for (const rel of ["../escape.txt", "a/../../escape.txt"]) {
            assert.throws(() => materialize(root, [{ mode: "100644", oid, path: rel }], dir), (error) => {
                assert.ok(error instanceof CannotRun);
                assert.match(error.message, /resolves outside the cut directory/);
                return true;
            });
            assert.ok(!fs.existsSync(path.join(dir, "..", "escape.txt")), "the refusal came after the write");
        }
        materialize(root, [{ mode: "100644", oid, path: "a/../b.txt" }], dir);
        assert.ok(fs.existsSync(path.join(dir, "b.txt")));
    });

    test("THE PIN: cutting an old commit stamps the OLD template, whatever the tree says now", () => {
        const root = fixtureRepo();
        const oldSha = git(root, "rev-parse", "HEAD").trim();
        fs.writeFileSync(path.join(root, TEMPLATE_PATH), "# Fixture Eval License\nTERMS-V2 · to {{name}} ({{login}}) on {{date}} from {{shortSha}}\n");
        git(root, "add", "-A");
        git(root, "commit", "-qm", "terms v2");
        const dir = path.join(scratch(), "portulan-eval");
        fs.mkdirSync(dir);
        cut(root, oldSha, FIXTURE, dir);
        const stamped = fs.readFileSync(path.join(dir, "EVAL-LICENSE.md"), "utf8");
        assert.ok(stamped.includes("TERMS-V1"), "the old commit's terms did not survive its own cut");
        assert.ok(!stamped.includes("TERMS-V2"), "a later template edit drifted under an old commit's stamp — the exact drift the ruling forbids");
        const stamp = JSON.parse(fs.readFileSync(path.join(dir, "EVAL-STAMP.json"), "utf8"));
        assert.equal(stamp.source_commit, oldSha, "the stamp does not pin the sha the terms came from");
    });

    test("a commit that cannot supply its own terms is refused, naming the one-sha rule", () => {
        const root = fixtureRepo();
        git(root, "rm", "-q", TEMPLATE_PATH);
        git(root, "commit", "-qm", "template gone");
        const dir = path.join(scratch(), "portulan-eval");
        fs.mkdirSync(dir);
        assert.throws(() => cut(root, "HEAD", FIXTURE, dir), (error) => {
            assert.ok(error instanceof CannotRun);
            assert.match(error.message, /terms ship FROM the payload commit/);
            assert.match(error.message, /falling back to the working tree's copy/);
            return true;
        });
    });

    test("a template that lost a stamp field is refused, never improvised around", () => {
        const root = fixtureRepo();
        fs.writeFileSync(path.join(root, TEMPLATE_PATH), "# Fixture Eval License\nto {{name}} ({{login}}) from {{shortSha}} — no date field\n");
        git(root, "add", "-A");
        git(root, "commit", "-qm", "dateless");
        const dir = path.join(scratch(), "portulan-eval");
        fs.mkdirSync(dir);
        assert.throws(() => cut(root, "HEAD", FIXTURE, dir), /does not carry the \{\{date\}\} placeholder/);
    });
});

describe("round-2 mechanics — the digest's byte order, the umask, the locale", () => {
    test("bundleDigest orders by UTF-8 bytes, pinned against this suite's own re-implementation", () => {
        // JS strings order these two by UTF-16 code unit, and UTF-8 bytes order them the other way round.
        const a = "\u{10000}b.txt";
        const b = "｡a.txt";
        assert.notDeepEqual(
            [a, b].sort(),
            [a, b].sort((x, y) => Buffer.compare(Buffer.from(x, "utf8"), Buffer.from(y, "utf8"))),
            "the fixture names no longer diverge between string order and byte order — replace them",
        );
        const dir = scratch();
        fs.writeFileSync(path.join(dir, a), "alpha\n");
        fs.writeFileSync(path.join(dir, b), "beta\n");
        const independent = crypto.createHash("sha256");
        for (const rel of [b, a]) {
            const fileHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, rel))).digest("hex");
            independent.update(Buffer.concat([Buffer.from(rel, "utf8"), Buffer.from([0]), Buffer.from(fileHash, "utf8"), Buffer.from("\n")]));
        }
        assert.equal(bundleDigest(dir), independent.digest("hex"));
    });

    test("the executable bit survives a hostile umask — chmod holds the mode, not open(2)", () => {
        const root = scratch();
        git(root, "init", "-q", "-b", "main");
        const oid = execFileSync("git", ["-C", root, "hash-object", "-w", "--stdin"], { input: "#!/bin/sh\n", encoding: "utf8" }).trim();
        const dir = scratch();
        const previous = process.umask(0o111);
        try {
            materialize(root, [{ mode: "100755", oid, path: "bin.sh" }], dir);
        } finally {
            process.umask(previous);
        }
        assert.equal(fs.statSync(path.join(dir, "bin.sh")).mode & 0o755, 0o755, "the umask stripped what the tool promised to preserve");
    });

    test("localDate is YYYY-MM-DD from date parts, not from a locale that needs full ICU", () => {
        assert.match(localDate(), /^\d{4}-\d{2}-\d{2}$/);
        assert.equal(localDate(new Date(2026, 0, 5)), "2026-01-05", "single-digit month and day are zero-padded");
    });
});

describe("the command line", () => {
    test("--help answers before any other argument decision", () => {
        const stdout = sink();
        assert.equal(run(["--help", "--to"], { stdout, stderr: sink() }), 0);
        assert.match(stdout.toString(), /eval-bundle — cut a named-recipient evaluation bundle/);
    });

    test("--check refuses stamping flags — a check must not look like an issuance", () => {
        const stderr = sink();
        assert.equal(run(["--check", "--to", "x"], { stdout: sink(), stderr, cwd: REPO }), 2);
        assert.match(stderr.toString(), /--check takes no stamping flags/);
    });

    test("a --github that could walk the filesystem is refused by content, before anything is read", () => {
        // The login names the tarball: a lone dot is harmless, but separators and `..` could walk the filesystem.
        for (const hostile of ["../../outside", "a/b", "a\\b", "x..y"]) {
            const stderr = sink();
            assert.equal(run(["--to", "x", "--github", hostile, "--commit", "HEAD", "--out", scratch(), REPO], { stdout: sink(), stderr }), 2, hostile);
            assert.match(stderr.toString(), /cannot name a file safely/);
        }
    });

    test("an issuance cut without its required flags is could-not-run naming the flag", () => {
        const stderr = sink();
        assert.equal(run(["--to", "x", "--github", "y", "--out", scratch()], { stdout: sink(), stderr, cwd: REPO }), 2);
        assert.match(stderr.toString(), /--commit is required/);
    });

    test("a malformed --date is refused before anything is read", () => {
        const stderr = sink();
        assert.equal(run(["--to", "x", "--github", "y", "--commit", "HEAD", "--out", scratch(), "--date", "15-01-2026"], { stdout: sink(), stderr, cwd: REPO }), 2);
        assert.match(stderr.toString(), /--date wants YYYY-MM-DD/);
    });

    test("an existing cut directory is refused rather than overwritten", () => {
        const out = scratch();
        fs.mkdirSync(path.join(out, "portulan-eval"));
        const stderr = sink();
        assert.equal(run(["--to", FIXTURE.name, "--github", FIXTURE.login, "--commit", "HEAD", "--out", out, REPO], { stdout: sink(), stderr }), 2);
        assert.match(stderr.toString(), /already exists/);
    });

    test("a directory that is not a repository is could-not-run, not a red", () => {
        const stderr = sink();
        assert.equal(run(["--check", scratch()], { stdout: sink(), stderr }), 2);
        assert.match(stderr.toString(), /git could not find a git repository/);
    });

    test("--check, spawned as the recipe spawns it, is green on this repository and says what it proved", () => {
        const result = execFileSync(process.execPath, [RUNNER, "--check", REPO], { encoding: "utf8" });
        assert.match(result, /partition: \d+ payload \+ \d+ excluded/);
        assert.match(result, /census: machine-read Apache assertions ==/);
        assert.match(result, /self-exclusion: (exercised|vacuous)/);
        assert.match(result, /ok {2}eval-bundle — a clean evaluation bundle cuts from the index/);
        assert.match(result, /terms: EVAL-LICENSE\.md rendered from cli\/eval-license\.template\.md AT the probe/);
    });

    test("--check leaves no scratch behind — measured on the whole tmpdir name set, not a prefix", () => {
        // A private tmpdir, so another process writing to a shared one cannot pass for a leak.
        const privateTmp = scratch();
        execFileSync(process.execPath, [RUNNER, "--check", REPO], { encoding: "utf8", env: { ...process.env, TMPDIR: privateTmp } });
        assert.deepEqual(fs.readdirSync(privateTmp), [], "--check left scratch behind in its tmpdir");
    });
});
