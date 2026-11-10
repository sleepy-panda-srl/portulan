// Exercise historical persona upgrade, ownership and rollback.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { boundAgent, personaDeclarations } from "./compile.mjs";

const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROLES = ["implementer", "reviewer", "librarian"];
const HISTORIC = path.join(ROOT, "cli/fixtures/persona-upgrade/v0.2.0");
const made = [];
process.on("exit", () => made.forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));
function bundle() {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "portulan-persona-upgrade-"))); made.push(root);
    const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
    const extra = ["spec/migrations/0011-persona-bindings-compiled.mjs", ...ROLES.map(role => `cli/fixtures/persona-upgrade/v0.2.0/${role}.md`), "cli/fixtures/persona-upgrade/v0.2.0/source.json"];
    for (const rel of new Set([...tracked, ...extra])) {
        const source = path.join(ROOT, rel); if (!fs.existsSync(source)) continue;
        const target = path.join(root, rel); fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target); fs.chmodSync(target, fs.statSync(source).mode & 0o777);
    }
    fs.mkdirSync(path.join(root, "host"));
    return root;
}
function historical(root) {
    const source = JSON.parse(fs.readFileSync(path.join(HISTORIC, "source.json")));
    assert.equal(source.commit, "78a30817a62d745307acedea6aae4fed6833d83c");
    for (const role of ROLES) {
        const bytes = fs.readFileSync(path.join(HISTORIC, role + ".md"));
        assert.equal(createHash("sha256").update(bytes).digest("hex"), source.files[`agents/${role}.md`].sha256);
        fs.writeFileSync(path.join(root, "agents", role + ".md"), bytes);
    }
}
const invoke = (root, mode, workspace = path.join(root, ".portulan")) => spawnSync(process.execPath, [path.join(root, "cli/upgrade.mjs"), mode, workspace], {
    encoding: "utf8", env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(root, "host") }, timeout: 30000,
});
const snapshot = root => ROLES.map(role => fs.existsSync(path.join(root, "agents", role + ".md")) ? fs.readFileSync(path.join(root, "agents", role + ".md")) : null);

test("v0.2.0 core bindings arrive through upgrade check/write/check without configuration", () => {
    const root = bundle(); historical(root);
    const before = snapshot(root), settings = fs.readFileSync(path.join(root, ".claude/settings.json"));
    fs.chmodSync(path.join(root, "agents/implementer.md"), 0o640);
    const check = invoke(root, "--check");
    assert.equal(check.status, 1, check.stderr || check.stdout);
    assert.match(check.stdout, /0011-persona-bindings-compiled/);
    assert.deepEqual(snapshot(root), before);
    const write = invoke(root, "--write");
    assert.equal(write.status, 0, write.stderr || write.stdout);
    for (const [i, role] of ROLES.entries()) {
        const source = fs.readFileSync(path.join(root, "core/personas", role + ".md"), "utf8");
        const expected = boundAgent(before[i].toString(), personaDeclarations(source).declared, `core/personas/${role}.md`, `agents/${role}.md`);
        assert.equal(fs.readFileSync(path.join(root, "agents", role + ".md"), "utf8"), expected);
    }
    assert.equal(fs.statSync(path.join(root, "agents/implementer.md")).mode & 0o777, 0o640);
    assert.deepEqual(fs.readFileSync(path.join(root, ".claude/settings.json")), settings);
    assert.equal(invoke(root, "--check").status, 0);
    const after = snapshot(root);
    assert.equal(invoke(root, "--write").status, 0);
    assert.deepEqual(snapshot(root), after);
});

test("absent bindings are not created and foreign core files are not selected", () => {
    const root = bundle(); historical(root);
    fs.rmSync(path.join(root, "agents/librarian.md"));
    const write = invoke(root, "--write");
    assert.equal(write.status, 0, write.stderr || write.stdout);
    assert.equal(fs.existsSync(path.join(root, "agents/librarian.md")), false);
    const foreign = bundle(); historical(foreign);
    const before = snapshot(foreign);
    const other = invoke(root, "--write", path.join(foreign, ".portulan"));
    assert.equal(other.status, 0, other.stderr || other.stdout);
    assert.deepEqual(snapshot(foreign), before);
});

test("a pack installed only in the host cache arrives through the actual upgrade command", () => {
    const root = bundle(), adopter = path.join(root, "adopter"), config = path.join(root, "host");
    fs.cpSync(path.join(ROOT, "cli/fixtures/personas"), adopter, { recursive: true });
    const installed = path.join(config, "plugins/cache/feed/carrier/0.1.0");
    fs.mkdirSync(path.join(installed, "packs/tools"), { recursive: true });
    fs.cpSync(path.join(ROOT, "packs/tools/local-llm"), path.join(installed, "packs/tools/local-llm"), { recursive: true });
    fs.writeFileSync(path.join(config, "plugins/installed_plugins.json"), JSON.stringify({ version: 2,
        plugins: { "carrier@feed": [{ scope: "user", installPath: installed, version: "0.1.0" }] } }));
    const workspace = path.join(adopter, "workspace"), binding = path.join(adopter, "agents/local-worker.md");
    const before = fs.readFileSync(binding, "utf8");
    const check = invoke(root, "--check", workspace);
    assert.equal(check.status, 1, check.stderr || check.stdout);
    assert.match(check.stdout, /0011-persona-bindings-compiled/);
    assert.equal(fs.readFileSync(binding, "utf8"), before);
    const write = invoke(root, "--write", workspace);
    assert.equal(write.status, 0, write.stderr || write.stdout);
    const source = fs.readFileSync(path.join(installed, "packs/tools/local-llm/personas/local-worker.md"), "utf8");
    assert.equal(fs.readFileSync(binding, "utf8"), boundAgent(before, personaDeclarations(source).declared, "tools/local-llm's personas/local-worker.md", "agents/local-worker.md"));
    assert.equal(invoke(root, "--check", workspace).status, 0);
    assert.equal(invoke(root, "--write", workspace).status, 0);
    assert.equal(fs.existsSync(path.join(adopter, ".claude/settings.json")), false);
});

test("handwritten owned keys and nonregular bindings refuse before any persona changes", () => {
    for (const kind of ["manual-key", "symlink"]) {
        const root = bundle(); historical(root);
        const file = path.join(root, "agents/reviewer.md");
        if (kind === "manual-key") fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("\n---\n", "\nmodel: sonnet\n---\n"));
        else {
            const target = path.join(root, "outside-binding.md"); fs.copyFileSync(file, target);
            fs.rmSync(file); fs.symlinkSync(target, file);
        }
        const before = snapshot(root), result = invoke(root, "--write");
        assert.equal(result.status, 2, result.stderr || result.stdout);
        assert.match(result.stderr, /0011-persona-bindings-compiled|persona|binding/i);
        assert.deepEqual(snapshot(root), before);
        if (kind === "symlink") assert.equal(fs.lstatSync(file).isSymbolicLink(), true);
    }
});

test("a staging collision restores earlier binding bytes and preserves the unowned collision", async (t) => {
    const root = bundle(); historical(root);
    const before = snapshot(root);
    fs.chmodSync(path.join(root, "agents/implementer.md"), 0o640);
    const { run } = await import(pathToFileURL(path.join(root, "cli/upgrade.mjs")).href);
    const collision = path.join(root, `agents/librarian.md.portulan-upgrade.${process.pid}.1`);
    fs.writeFileSync(collision, "unowned staging artifact");
    const targets = [], out = [], err = [];
    const previous = process.env.CLAUDE_CONFIG_DIR, rename = fs.renameSync;
    process.env.CLAUDE_CONFIG_DIR = path.join(root, "host");
    t.mock.method(fs, "renameSync", (from, to) => { if (to.startsWith(root + path.sep)) targets.push(to); return rename(from, to); });
    let status;
    try {
        status = await run(["--write", path.join(root, ".portulan")], {
            stdout: { write: value => out.push(value) }, stderr: { write: value => err.push(value) },
        });
    } finally {
        if (previous === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = previous;
    }
    assert.equal(status, 2);
    assert.ok(targets.includes(path.join(root, "agents/implementer.md")));
    assert.deepEqual(snapshot(root), before);
    assert.equal(fs.statSync(path.join(root, "agents/implementer.md")).mode & 0o777, 0o640);
    assert.match(err.join(""), /EEXIST/);
    assert.equal(fs.readFileSync(collision, "utf8"), "unowned staging artifact");
});
