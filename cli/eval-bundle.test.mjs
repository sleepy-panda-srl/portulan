// The evaluation-bundle cutter, driven on this repository AND on real fixture repositories.
//
// Written with the port (the pre-port bash script had no suite at all — reviewability was the
// point of bringing it into the tree). What each group pins, and why it is a real property:
//
//   - The PARTITION and the CENSUS are asserted with this file's OWN instruments — `git ls-tree`
//     and `git grep` — never through the module's helpers, because a pin that asks the subject to
//     measure itself tests agreement, not truth.
//   - The SELF-EXCLUSION is exercised POSITIVELY on a fixture that plants files at exactly the
//     excluded paths. At this repository's own HEAD the exclusion can be vacuous (the cutter is
//     not in HEAD until the first commit that contains it), and an absence assertion that passes
//     because the thing was never there demonstrates nothing — the session-open checkpoint's
//     adjustment 2, folded here.
//   - PLUMBING == ARCHIVE: the materialised tree is compared byte-for-byte (modes included)
//     against `git archive | tar -x`, because the port swapped the transport and equivalence is a
//     claim to demonstrate, not to assert. tar is used HERE, in the suite — the verify recipe
//     deliberately needs none.
//   - Every REFUSAL is reached on a fixture built to deserve it, and the message is asserted —
//     a refusal that names the wrong repair is this repository's recurring defect class.

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

// One exit handler for every scratch directory rather than one each — ./pack-version.test.mjs
// carries the reason.
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

/** A writable sink for run()'s streams. */
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

// The stamping fixture for issuance-path tests. The login is impossible as a GitHub login (dot)
// and the name says what it is, so nothing in a public tree can read it as a person.
const FIXTURE = { name: "Example Evaluator (test fixture)", login: "example-evaluator.invalid", date: "2026-01-15" };

/**
 * The index of `root` wrapped as an unreferenced probe commit — the same move `--check` makes,
 * and what lets this suite cut THIS repository strictly from a commit even in the window where
 * the working tree carries files HEAD does not (the template landed exactly that way). Ident
 * pinned for environments that configure none.
 */
function probeCommit(root) {
    const tree = git(root, "write-tree").trim();
    return git(root, "-c", "user.name=suite", "-c", "user.email=suite@verify-fixture.invalid", "commit-tree", tree, "-p", "HEAD", "-m", "suite probe").trim();
}

/** Walk every file under a directory, relative paths sorted. */
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
        // One message for the whole partition, carrying the menu — the same sentence a maintainer
        // sees from --check, because the first reader of this red is somebody who just added a
        // top-level directory for unrelated reasons.
        assert.deepEqual(
            classified,
            actual,
            "the payload partition in cli/eval-bundle.mjs no longer matches the tree — classify the new path into PAYLOAD or EXCLUDED_TOP_LEVEL (with its reason), or remove the stale entry",
        );
        const overlap = PAYLOAD.filter((p) => p in EXCLUDED_TOP_LEVEL);
        assert.deepEqual(overlap, [], "a path ships or it does not — never both");
    });

    test("the payload files carrying the machine-read assertion at HEAD are exactly APACHE_MANIFESTS", () => {
        // `git grep` against HEAD, limited to the payload minus the self-excluded pair — the
        // independent instrument for the census the cutter re-runs on every cut. `HEAD:` prefixes
        // are stripped; exit 1 (no match) would surface as a throw and fail loudly, which is the
        // right failure for a census that found nothing.
        const hits = git(REPO, "grep", "-l", "--fixed-strings", APACHE_NEEDLE.toString(), "HEAD", "--", ...PAYLOAD)
            .split("\n")
            .filter(Boolean)
            .map((line) => line.replace(/^HEAD:/, ""))
            .filter((rel) => !SELF_EXCLUDED.includes(rel))
            .sort();
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
    // One cut, shared by the assertions below — cutting is the expensive step and every assertion
    // here reads the same artifact. The commit is an index probe, so the suite exercises the
    // strict terms-from-the-commit read on the REAL repository whether or not HEAD carries the
    // template yet.
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
        // The suite's own instrument: its own `git show` of the template at the probe, its own
        // substitution — never the module's render, which would test agreement with itself.
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

    // The inversion of #284, in executable form: the cut no longer rewrites licence metadata, so
    // every declaring manifest must come through the cut still saying what the public tree says.
    test("every declaring manifest still reads Apache-2.0 after the cut — nothing rewrites licence metadata", () => {
        for (const rel of APACHE_MANIFESTS) {
            const manifest = JSON.parse(fs.readFileSync(path.join(cutDir, rel), "utf8"));
            if (manifest.license) assert.equal(manifest.license, "Apache-2.0", rel);
            for (const plugin of manifest.plugins ?? []) {
                if (plugin.license) assert.equal(plugin.license, "Apache-2.0", `${rel} plugins[]`);
            }
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
        // The section is no longer rewritten, and its LICENSE link now resolves because LICENSE ships.
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
        assert.equal(stamp.content_digest, `sha256:${bundleDigest(cutDir)}`, "the digest in the stamp does not recompute from the cut");
    });

    test("what must be absent is absent — the excluded top level, the license file, and the cutter", () => {
        for (const name of [...Object.keys(EXCLUDED_TOP_LEVEL), ...SELF_EXCLUDED]) {
            assert.ok(!fs.existsSync(path.join(cutDir, name)), `${name} is in the cut and must not be`);
        }
    });

    // Inverted with the guard (#284). This read "no file in the cut carries the machine-read
    // assertion" while a bundle was a differently-licensed copy; the cut now preserves the public
    // tree's licence, so the assertion must SURVIVE in exactly the declaring manifests.
    test("the machine-read assertion survives the cut — the declaring manifests, plus the stamp", () => {
        // EVAL-STAMP.json is written BY the cut and now records `"license": "Apache-2.0"` itself, so
        // it joins the list here while `assertCensus` (which runs before the stamp exists) does not
        // see it. That the stamp agrees with the payload is the point rather than an artefact: the
        // guard reads it too, so a stamp that disagreed with what it stamps would be refused.
        assert.deepEqual(filesCarrying(cutDir, APACHE_NEEDLE).sort(), [...APACHE_MANIFESTS, "EVAL-STAMP.json"].sort());
    });

    test("the tarball exists and the printed sha256 is the tarball's", () => {
        const tarball = path.join(out, `portulan-eval-${FIXTURE.login}-${FIXTURE.date}.tgz`);
        assert.ok(fs.existsSync(tarball));
        const printed = stdout.toString().match(/sha256:([0-9a-f]{64})\s+\S*portulan-eval-.*\.tgz/);
        assert.ok(printed, `no tarball hash in:\n${stdout.toString()}`);
        // Recomputed with node's own crypto — the suite must not re-import a shasum/sha256sum
        // platform split the port exists to have removed.
        const actual = crypto.createHash("sha256").update(fs.readFileSync(tarball)).digest("hex");
        assert.equal(printed[1], actual, "the printed hash is not the delivered bytes' — the ledger would record a lie");
    });

    test("the content digest is reproducible: a second cut of the same commit carries the same digest", () => {
        const again = scratch();
        const code2 = run(["--to", FIXTURE.name, "--github", FIXTURE.login, "--commit", probeSha, "--out", again, "--date", FIXTURE.date, REPO], { stdout: sink(), stderr: sink() });
        assert.equal(code2, 0);
        const first = JSON.parse(fs.readFileSync(path.join(cutDir, "EVAL-STAMP.json"), "utf8")).content_digest;
        const second = JSON.parse(fs.readFileSync(path.join(again, "portulan-eval", "EVAL-STAMP.json"), "utf8")).content_digest;
        // Deliberately NOT asserted for the tarballs: tar embeds mtimes, so two honest tarballs of
        // one content differ. The digest is the identity that survives that; the stamp says so.
        assert.equal(first, second);
    });

    test("plumbing == archive: the materialised payload is byte-identical to git archive, modes included", (t) => {
        // The one test in cli/ that shells a non-git binary, and it SKIPS BY NAME when tar is
        // absent rather than failing: a missing tar is a fact about the machine, not about the
        // transport equivalence, and reporting it as a red would be could-not-look wearing a
        // verdict — the pre-commit checkpoint measured exactly that (4 fails, tests.sh RED) on a
        // tarless PATH. Everywhere this repository actually runs — the maintainer's machine and
        // ubuntu-latest — tar exists and this test runs; the skip line names the gap when not.
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
        // The archive route has no self-exclusion, so at a HEAD that contains the cutter the
        // archive side carries the two extra files — dropped here so the comparison asks about
        // the transport, which is the property that changed in the port.
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
    // A small real cut to mutate — reusing the module against this repository, then planting.
    function freshCut() {
        const dir = path.join(scratch(), "portulan-eval");
        fs.mkdirSync(dir);
        cut(REPO, probeCommit(REPO), FIXTURE, dir);
        return dir;
    }

    // INVERTED with the guard (#284): the refusal is a licence field that is NOT Apache-2.0, and a
    // self-excluded path is checked directly rather than riding on the old needle side effect.
    test("a manifest declaring a non-Apache licence is refused, named, with the value it saw", () => {
        const dir = freshCut();
        fs.writeFileSync(path.join(dir, "spec", "planted.json"), `{"license": "LicenseRef-Something-Else"}\n`);
        assert.throws(() => auditCut(dir), (error) => {
            assert.ok(error instanceof Refused);
            assert.match(error.message, /spec\/planted\.json/);
            assert.match(error.message, /LicenseRef-Something-Else/);
            // The menu must name the repair that actually clears the refusal. Rostering alone does not:
            // the census would then expect an Apache assertion this file still does not make.
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

    // The backstop that used to be accidental. Under the old presence-guard these files tripped it
    // because they carry the needle; the inverted guard would not have noticed, so it checks the
    // paths directly and diagnoses a leak as a failed filter rather than a licensing breach.
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

    // The fail-open Copilot found on #288: the walk read only STRING values, so a licence field of
    // any other JSON type was a declaration the guard never judged. npm's own historic form is an
    // object, so this is a shape real manifests take rather than a contrived one.
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
    /**
     * A repository with the full top-level shape the partition demands — every PAYLOAD and
     * EXCLUDED_TOP_LEVEL entry present — so `cut` runs end to end on it and each refusal below is
     * reached by ONE mutation from a green baseline, never by an accident of a thin fixture.
     */
    function fixtureRepo() {
        const root = scratch();
        git(root, "init", "-q", "-b", "main");
        git(root, "config", "user.email", "t@example.com");
        git(root, "config", "user.name", "t");
        const file = (rel, text) => {
            fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
            fs.writeFileSync(path.join(root, rel), text);
        };
        for (const top of PAYLOAD) {
            if (top.includes(".md") || top === "NOTICE") continue;
            file(`${top}/keep.txt`, `${top}\n`);
        }
        for (const top of Object.keys(EXCLUDED_TOP_LEVEL)) {
            // Neutral content on purpose: a fixture `.gitignore` whose body was its own name
            // ignored ITSELF, went untracked, and the partition correctly called it stale — a
            // fixture defect wearing a rail's message.
            if (/[.]md$|^[.]gitignore$|^LICENSE$|^CODEOWNERS$|^package[.]json$/.test(top)) file(top, "# fixture\n");
            else file(`${top}/keep.txt`, `${top}\n`);
        }
        file("README.md", "# Fixture\n\nBody.\n\n## License\n\n[Apache-2.0](LICENSE) © nobody.\n");
        file("NOTICE", "fixture notice\n");
        file("CHANGELOG.md", "# Changelog\n");
        // The three census files, each asserting Apache the way the real manifests do — built by
        // concatenation so the needle appears here exactly once, in the import above.
        const asserting = `{\n  ${APACHE_NEEDLE.toString()}\n}\n`;
        for (const rel of APACHE_MANIFESTS) file(rel, asserting);
        // Files at exactly the self-excluded paths, plus a sibling that must survive — the
        // POSITIVE exercise of the filter.
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
        // `materialize` takes the listing as input, so the hostile path is fed directly — git
        // will not CREATE a `..` tree entry through any porcelain, but a crafted tree carries
        // one and `ls-tree` faithfully prints it, so the boundary belongs to the writer. The
        // blob is real; only the path is hostile. Raised by Copilot on the porting pull request.
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
        // The benign shape stays writable: `a/../b` RESOLVES inside, and resolution — not a
        // pattern — is the rule, so it lands at `b` rather than being refused for its spelling.
        materialize(root, [{ mode: "100644", oid, path: "a/../b.txt" }], dir);
        assert.ok(fs.existsSync(path.join(dir, "b.txt")));
    });

    // Two tests stood here and are RETIRED with `patchReadmeLicense` (#284): one proving the
    // section was spliced in place when the heading sat at byte 0, one proving a README without
    // exactly one `## License` heading was could-not-run. The cut no longer touches that section —
    // the bundle ships the public tree's licence, so the tree's own wording is already correct and
    // its `LICENSE` link now resolves. The replacement guarantee is asserted positively above, in
    // "README opens with the banner, and its own License section is left exactly as the tree wrote it".

    // The supervisor's ruling of 2026-08-17: terms ship FROM the payload commit, one sha for
    // both. The three tests below are the ruling's own demonstrations — the pin holding, the
    // refusal when a commit cannot supply its terms, and the refusal when the terms lost a field.
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
        // Two names whose JS-string order and UTF-8-byte order DISAGREE — U+10000 is one
        // supplementary character (UTF-16: surrogate 0xD800…; UTF-8: F0 90 80 80) and U+FF61 is
        // a BMP character above it in code units (0xFF61) and below it in bytes (EF BD A1). The
        // guard assertion proves the fixture exercises the divergence; without it, an ASCII-only
        // fixture would pin nothing.
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
        // The suite's OWN expression of the stamp's scope sentence — an independent instrument,
        // so the digest definition is re-derivable outside the module that mints it.
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
        // The write-site containment class at its second site: the login names the tarball. The
        // fixture logins' dot survives on purpose — only separators and dot-dot are path-capable.
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
        // The instrument proposal 0029 records: diff the entire tmpdir listing, which knows no
        // naming conventions and therefore cannot miss one. The child gets a PRIVATE tmpdir so the
        // whole-set diff is sound — on a shared /tmp, an unrelated process writing mid-test would
        // be indistinguishable from a leak, and a rail that flakes is a rail somebody switches off.
        const privateTmp = scratch();
        execFileSync(process.execPath, [RUNNER, "--check", REPO], { encoding: "utf8", env: { ...process.env, TMPDIR: privateTmp } });
        assert.deepEqual(fs.readdirSync(privateTmp), [], "--check left scratch behind in its tmpdir");
    });
});
