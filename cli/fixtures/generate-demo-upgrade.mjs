import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bootReadSet } from "../context.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
export const INPUTS = JSON.parse(fs.readFileSync(path.join(HERE, "demo-upgrade/inputs.json"), "utf8"));
const BEFORE = "43038826f31e85ec02e36e5cdea20376ac1b58cf";
const AFTER = "78a30817a62d745307acedea6aae4fed6833d83c";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const slash = (file) => file.split(path.sep).join("/");

function materialize(files, root) {
    const seen = new Set();
    for (const entry of files) {
        assert.ok(!path.isAbsolute(entry.path) && !entry.path.split("/").includes("..") && !seen.has(entry.path), "invalid snapshot path");
        seen.add(entry.path);
        const bytes = Buffer.from(entry.text, "utf8");
        assert.equal(bytes.length, entry.bytes, "snapshot byte length drift");
        assert.equal(digest(bytes), entry.sha256, "snapshot digest drift");
        const file = path.join(root, entry.path);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, bytes);
    }
}

function inventory(root, prefix = "") {
    return fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en")).flatMap((entry) => {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) return inventory(root, rel);
        assert.ok(entry.isFile(), "snapshot contains a link or special file");
        const bytes = fs.readFileSync(path.join(root, rel));
        return [{ path: rel, bytes: bytes.length, sha256: digest(bytes) }];
    });
}

const expected = (files) => files.map(({ path: rel, bytes, sha256 }) => ({ path: rel, bytes, sha256 })).sort((a, b) => a.path.localeCompare(b.path, "en"));
const sorted = (rows) => rows.sort((a, b) => a.path.localeCompare(b.path, "en"));

export function replaceBundle({ bundleDir, after }) {
    fs.rmSync(bundleDir, { recursive: true });
    materialize(after.files, bundleDir);
}

export function demonstrateUpgrade({ inputs = INPUTS, replace = replaceBundle, repo = "combcount" } = {}) {
    assert.equal(inputs.before.commit, BEFORE, "wrong before release");
    assert.equal(inputs.after.commit, AFTER, "wrong after release");
    assert.deepEqual(inputs.workspace.commits, [BEFORE, AFTER], "workspace release provenance drift");
    assert.equal(repo, "combcount", "this demonstration selects the fictional Combcount project");
    const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "portulan-demo-upgrade-")));
    try {
        const project = path.join(scratch, repo);
        const workspaceDir = path.join(project, ".portulan");
        const bundleDir = path.join(scratch, "installed-boot-inputs");
        const host = path.join(scratch, "empty-host");
        fs.mkdirSync(host);
        materialize(inputs.workspace.files, workspaceDir);
        materialize(inputs.before.files, bundleDir);
        const original = inventory(workspaceDir);
        assert.deepEqual(sorted(original), expected(inputs.workspace.files), "workspace snapshot mismatch");
        const manifest = JSON.parse(fs.readFileSync(path.join(workspaceDir, "workspace.json"), "utf8"));
        assert.equal(manifest.kind, "demo");
        assert.equal(manifest.tree, undefined);
        const workspaceReads = ["workspace.json", ...["identity", "principles", "constitution", "gates", "dod"].flatMap((slot) => manifest.slots[slot] ? [manifest.slots[slot]] : []), path.posix.join(manifest.slots.repos, `${repo}.md`), manifest.memory.index.path];
        const roster = (files) => {
            const entries = sorted(files.map(([domain, rel]) => {
                const bytes = fs.readFileSync(path.join(domain === "bundle" ? bundleDir : workspaceDir, rel));
                return { path: `${domain}/${rel}`, bytes: bytes.length, sha256: digest(bytes) };
            }));
            return { bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0), entries };
        };
        const before = roster([
            ...["plugin/skills/portulan/SKILL.md", "core/engine.md"].map((rel) => ["bundle", rel]),
            ...workspaceReads.map((rel) => ["workspace", rel]),
        ]);
        replace({ bundleDir, workspaceDir, after: inputs.after });
        assert.deepEqual(sorted(inventory(bundleDir)), expected(inputs.after.files), "bundle replacement did not install the pinned after snapshot");
        assert.deepEqual(sorted(inventory(workspaceDir)), sorted(original), "workspace changed during bundle replacement");
        const readSet = bootReadSet(workspaceDir, manifest, { bundleRoot: bundleDir, repo });
        assert.deepEqual(readSet.engineMissing, []);
        assert.equal(readSet.card.selected, repo);
        const after = roster(readSet.entries.map((entry) => [entry.bundle ? "bundle" : "workspace", slash(path.relative(entry.bundle ? bundleDir : workspaceDir, entry.file))]));
        assert.deepEqual(after.entries.filter((entry) => entry.path.startsWith("workspace/")), before.entries.filter((entry) => entry.path.startsWith("workspace/")), "workspace read selection changed");
        assert.ok(after.bytes < before.bytes, "bundle replacement must reduce the boot read-set");
        const argv = ["--write", workspaceDir];
        const migration = spawnSync(process.execPath, [path.join(ROOT, "cli/upgrade.mjs"), ...argv], {
            cwd: project, encoding: "utf8", env: { ...process.env, CLAUDE_CONFIG_DIR: host }, maxBuffer: 1024 * 1024,
        });
        assert.equal(migration.error, undefined, migration.error?.message);
        assert.equal(migration.signal, null);
        assert.equal(migration.status, 0, migration.stdout + migration.stderr);
        assert.match(migration.stdout, /owes nothing.*current at 2\.4/);
        assert.deepEqual(sorted(inventory(workspaceDir)), sorted(original), "workspace changed during migration");
        const normalize = (text) => text.replaceAll(workspaceDir, "<project>/.portulan").replaceAll(project, "<project>").replaceAll(ROOT, "<repo>");
        return {
            format: 1,
            interpretation: "2026-11-09 human ruling: bundle-upgrade evidence; workspace migration separate",
            measurement: "diagnostic boot read-set bytes; explicit Combcount card and declared memory index; no host timing or exact tokens",
            operation: "replace pinned boot inputs at the same bundle path; no host installer exercised",
            releases: { before: { tag: inputs.before.tag, commit: BEFORE }, after: { tag: inputs.after.tag, commit: AFTER } },
            workspace: { source: "examples/", kind: manifest.kind, spec: manifest.portulan.spec, repo, files: sorted(original) },
            before,
            after,
            savedBytes: before.bytes - after.bytes,
            workspaceUnchanged: true,
            migration: {
                argv: ["node", "<repo>/cli/upgrade.mjs", "--write", "<project>/.portulan"],
                host: "empty CLAUDE_CONFIG_DIR; demo declares no tree",
                exit: migration.status, stdout: normalize(migration.stdout), stderr: normalize(migration.stderr),
                effect: "no applicable workspace migration owed at 2.4; no measured boot reduction attributed to this command",
            },
        };
    } finally {
        fs.rmSync(scratch, { recursive: true, force: true });
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    try {
        assert.equal(process.argv.length, 2, "usage: node cli/fixtures/generate-demo-upgrade.mjs");
        process.stdout.write(`${JSON.stringify(demonstrateUpgrade(), null, 2)}\n`);
    } catch (error) {
        process.stderr.write(`demo-upgrade demonstration: ${error.message}\n`);
        process.exitCode = 1;
    }
}
