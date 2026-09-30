// Tests for host plugin-cache discovery.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { configDir, recordPath, readInstalls, resolveGovernor, run, EXIT, MANIFEST_AT, RECORD, RECORD_VERSIONS, AUTO, isPackRoot, discoverPackRoots, resolutionRoots } from "./discover.mjs";

// Hermetic: a case that wants a host passes `env:` explicitly, which wins.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const SCRATCH = [];

test.after(() => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch() {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "portulan-discover-"));
    SCRATCH.push(dir);
    return dir;
}

function write(file, contents) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof contents === "string" ? contents : JSON.stringify(contents, null, 2));
}

function host(plugins, { record = true } = {}) {
    const dir = scratch();
    const entries = {};
    for (const [key, spec] of Object.entries(plugins)) {
        const version = spec.version ?? "0.1.0";
        const [plugin, marketplace] = [key.slice(0, key.lastIndexOf("@")), key.slice(key.lastIndexOf("@") + 1)];
        const installPath = path.join(dir, "plugins", "cache", marketplace, plugin, version);
        fs.mkdirSync(installPath, { recursive: true });
        if (spec.manifest !== undefined) write(path.join(installPath, spec.at ?? "workspace.json"), spec.manifest);
        for (const name of spec.packs ?? []) {
            const base = spec.shape === "flat" ? installPath : path.join(installPath, "packs");
            const packDir = path.join(base, ...name.split("/"));
            fs.mkdirSync(packDir, { recursive: true });
            write(path.join(packDir, "pack.json"), { name: name.split("/")[1], category: name.split("/")[0] });
        }
        entries[key] = [{ scope: "user", installPath, version, installedAt: "2026-08-09T00:00:00.000Z", gitCommitSha: "0".repeat(40) }];
        if (spec.second) {
            const other = path.join(dir, "plugins", "cache", marketplace, plugin, spec.second.version ?? "0.2.0");
            fs.mkdirSync(other, { recursive: true });
            if (spec.second.manifest !== undefined) write(path.join(other, "workspace.json"), spec.second.manifest);
            entries[key].push({ scope: "project", installPath: other, version: spec.second.version ?? "0.2.0" });
        }
    }
    if (record) write(path.join(dir, RECORD), { version: 2, plugins: entries });
    return { dir, env: { CLAUDE_CONFIG_DIR: dir } };
}

const governing = (name, extra = {}) => ({ portulan: { spec: "2.7" }, name, kind: "portfolio", ...extra });

// ---------------------------------------------------------------- 1. the config directory

test("configDir honours CLAUDE_CONFIG_DIR", () => {
    assert.equal(configDir({ env: { CLAUDE_CONFIG_DIR: "/somewhere/else" }, home: "/home/x" }), path.resolve("/somewhere/else"));
});

test("configDir falls back to the home directory when the override is unset", () => {
    assert.equal(configDir({ env: {}, home: "/home/x" }), path.join("/home/x", ".claude"));
});

test("configDir treats a blank override as unset, rather than as the filesystem root", () => {
    assert.equal(configDir({ env: { CLAUDE_CONFIG_DIR: "" }, home: "/home/x" }), path.join("/home/x", ".claude"));
    assert.equal(configDir({ env: { CLAUDE_CONFIG_DIR: "   " }, home: "/home/x" }), path.join("/home/x", ".claude"));
});

test("recordPath names the host's record under the config directory", () => {
    const { dir, env } = host({});
    assert.equal(recordPath({ env }), path.join(dir, RECORD));
});

// -------------------------------------------------------------------- 2. the record reader

test("readInstalls flattens the record's per-scope arrays into installs", () => {
    const { env } = host({ "sleepy-panda@portulan-internal": { version: "0.5.0", manifest: governing("sleepy-panda") } });
    const installs = readInstalls({ env });
    assert.equal(installs.state, "read");
    assert.equal(installs.entries.length, 1);
    assert.equal(installs.entries[0].plugin, "sleepy-panda");
    assert.equal(installs.entries[0].marketplace, "portulan-internal");
    assert.equal(installs.entries[0].version, "0.5.0");
});

test("readInstalls calls a missing record absent, not unreadable", () => {
    const { env } = host({}, { record: false });
    const installs = readInstalls({ env });
    assert.equal(installs.state, "absent");
    assert.deepEqual(installs.entries, []);
});

test("readInstalls calls unparseable and non-record files unreadable", () => {
    const { dir, env } = host({}, { record: false });
    write(path.join(dir, RECORD), "{ not json");
    assert.equal(readInstalls({ env }).state, "unreadable");
    write(path.join(dir, RECORD), { version: 2 });
    const noPlugins = readInstalls({ env });
    assert.equal(noPlugins.state, "unreadable");
    assert.match(noPlugins.detail, /not an installed-plugin record/);
});

test("an unrecognised record version is could-not-look, never a hopeful parse", () => {
    const { dir, env } = host({ "sleepy-panda@feed": { manifest: governing("sleepy-panda") } });
    const record = JSON.parse(fs.readFileSync(path.join(dir, RECORD), "utf8"));

    for (const version of [3, "2", null, undefined]) {
        const bumped = { ...record, version };
        if (version === undefined) delete bumped.version;
        write(path.join(dir, RECORD), bumped);
        const installs = readInstalls({ env });
        assert.equal(installs.state, "unreadable", `version ${JSON.stringify(version)} must not be read`);
        assert.match(installs.detail, /not one this reader understands/);
        assert.equal(resolveGovernor({ workspace: "sleepy-panda" }, { env }).state, "could-not-look");
    }

    write(path.join(dir, RECORD), record);
    assert.equal(readInstalls({ env }).state, "read");
});

test("the record versions this reader claims are enumerated, not implied", () => {
    assert.deepEqual([...RECORD_VERSIONS], [2]);
});

test("a `plugins` ARRAY is unreadable, not an empty host — the collapse that spent a look as an absence", () => {
    const { dir, env } = host({}, { record: false });
    write(path.join(dir, RECORD), { version: 2, plugins: [] });
    assert.equal(readInstalls({ env }).state, "unreadable");
    assert.equal(resolveGovernor({ workspace: "sleepy-panda" }, { env }).state, "could-not-look");

    write(path.join(dir, RECORD), { version: 2, plugins: {} });
    assert.equal(readInstalls({ env }).state, "read");
    assert.equal(resolveGovernor({ workspace: "sleepy-panda" }, { env }).state, "not-installed");
});

test("readInstalls drops a malformed entry and keeps every other plugin", () => {
    const { dir, env } = host({ "sleepy-panda@portulan-internal": { manifest: governing("sleepy-panda") } });
    const record = JSON.parse(fs.readFileSync(path.join(dir, RECORD), "utf8"));
    record.plugins["broken@feed"] = [{ scope: "user" }, null, { installPath: "" }];
    record.plugins["also-broken@feed"] = "not an array";
    write(path.join(dir, RECORD), record);
    const installs = readInstalls({ env });
    assert.equal(installs.state, "read");
    assert.equal(installs.entries.length, 1);
    assert.equal(installs.entries[0].plugin, "sleepy-panda");
});

// ------------------------------------------------------------------------- 3. the verdicts

test("a workspace installed under the pointer's name and feed resolves", () => {
    const { env } = host({ "sleepy-panda@portulan-internal": { version: "0.5.0", manifest: governing("sleepy-panda") } });
    const verdict = resolveGovernor({ workspace: "sleepy-panda", feed: "portulan-internal" }, { env });
    assert.equal(verdict.state, "resolved");
    assert.equal(verdict.plugin, "sleepy-panda");
    assert.equal(verdict.marketplace, "portulan-internal");
    assert.equal(verdict.version, "0.5.0");
    assert.equal(fs.existsSync(path.join(verdict.root, "workspace.json")), true);
    assert.match(verdict.sentence, /is installed here/);
});

test("a pointer with no feed resolves against any marketplace", () => {
    const { env } = host({ "sleepy-panda@somewhere": { manifest: governing("sleepy-panda") } });
    assert.equal(resolveGovernor({ workspace: "sleepy-panda" }, { env }).state, "resolved");
});

test("a host with nothing installed is not-installed, and says the record was absent", () => {
    const { env } = host({}, { record: false });
    const verdict = resolveGovernor({ workspace: "sleepy-panda" }, { env });
    assert.equal(verdict.state, "not-installed");
    assert.match(verdict.sentence, /no installed-plugin record/);
    assert.match(verdict.sentence, /never the network/);
});

test("a host with other plugins and not this one is not-installed", () => {
    const { env } = host({ "something-else@a-feed": { manifest: governing("something-else") }, "no-workspace@a-feed": {} });
    const verdict = resolveGovernor({ workspace: "sleepy-panda", feed: "a-feed" }, { env });
    assert.equal(verdict.state, "not-installed");
    assert.match(verdict.sentence, /is not installed here/);
});

test("an unreadable record is could-not-look and is never reported as absence", () => {
    const { dir, env } = host({}, { record: false });
    write(path.join(dir, RECORD), "{ not json");
    const verdict = resolveGovernor({ workspace: "sleepy-panda" }, { env });
    assert.equal(verdict.state, "could-not-look");
    assert.match(verdict.sentence, /never \*not installed\*/);
});

test("a pointer naming no workspace is could-not-look rather than a search", () => {
    const { env } = host({});
    assert.equal(resolveGovernor({}, { env }).state, "could-not-look");
    assert.equal(resolveGovernor(undefined, { env }).state, "could-not-look");
    assert.equal(resolveGovernor({ workspace: 7 }, { env }).state, "could-not-look");
});

test("a BLANK feed is unconstrained — the confident wrong answer, closed", () => {
    const { env } = host({ "sleepy-panda@portulan-internal": { manifest: governing("sleepy-panda") } });
    for (const feed of ["", "   ", "\t\n "]) {
        const verdict = resolveGovernor({ workspace: "sleepy-panda", feed }, { env });
        assert.equal(verdict.state, "resolved", `a blank feed ${JSON.stringify(feed)} must not constrain`);
        assert.equal(verdict.wanted.feed, null, "and it is reported as unset rather than as padding");
    }
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "another-feed" }, { env }).state, "not-installed");
});

test("a BLANK workspace is could-not-look, never a search for the empty string", () => {
    const { env } = host({ "sleepy-panda@portulan-internal": { manifest: governing("sleepy-panda") } });
    for (const workspace of ["", "   "]) {
        const verdict = resolveGovernor({ workspace }, { env });
        assert.equal(verdict.state, "could-not-look", `a blank workspace ${JSON.stringify(workspace)} is not a search`);
        assert.match(verdict.sentence, /names no governing workspace/);
    }
});

test("blank is unset, and that is NOT normalisation — a padded name still misses, both sides", () => {
    const { env } = host({ "sleepy-panda@portulan-internal": { manifest: governing("sleepy-panda") } });
    const padded = resolveGovernor({ workspace: "  sleepy-panda  ", feed: "portulan-internal" }, { env });
    assert.equal(padded.state, "not-installed", "a padded request is a different name, not a tidied one");
    assert.equal(padded.wanted.workspace, "  sleepy-panda  ", "and the raw value is what is reported back");

    const onDisk = host({ "sleepy-panda@portulan-internal": { manifest: governing("  sleepy-panda  ") } });
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "portulan-internal" }, { env: onDisk.env }).state, "not-installed");

    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: " portulan-internal " }, { env }).state, "not-installed");
});

// --------------------------------------------------------------------------- 4. the limits

test("the candidate locations are exactly two, both named", () => {
    assert.deepEqual(MANIFEST_AT, ["workspace.json", path.join(".portulan", "workspace.json")]);
});

test("a plugin whose payload is a repository resolves from its .portulan/ directory", () => {
    const { env } = host({ "panda@feed": { at: path.join(".portulan", "workspace.json"), manifest: governing("sleepy-panda") } });
    const verdict = resolveGovernor({ workspace: "sleepy-panda", feed: "feed" }, { env });
    assert.equal(verdict.state, "resolved");
    assert.equal(path.basename(verdict.root), ".portulan");
});

test("a manifest deeper than the two named locations is not found — the limit, asserted", () => {
    const { env } = host({ "panda@feed": { at: path.join("nested", "deeper", "workspace.json"), manifest: governing("sleepy-panda") } });
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "feed" }, { env }).state, "not-installed");
});

test("the match is on the manifest's name, never on the plugin's", () => {
    const { env } = host({ "panda@feed": { manifest: governing("sleepy-panda") } });
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "feed" }, { env }).state, "resolved");
    assert.equal(resolveGovernor({ workspace: "panda", feed: "feed" }, { env }).state, "not-installed");
});

test("the feed constrains — the right name from the wrong feed is a near miss, and it is said", () => {
    const { env } = host({ "sleepy-panda@a-public-feed": { manifest: governing("sleepy-panda") } });
    const verdict = resolveGovernor({ workspace: "sleepy-panda", feed: "portulan-internal" }, { env });
    assert.equal(verdict.state, "not-installed");
    assert.equal(verdict.nearMisses.length, 1);
    assert.equal(verdict.nearMisses[0].why, "feed");
    assert.match(verdict.sentence, /which is not the feed `portulan-internal` this pointer names/);
});

test("a near miss whose record key carries no marketplace does not print `null`", () => {
    const { dir, env } = host({ "sleepy-panda@feed": { manifest: governing("sleepy-panda") } });
    const record = JSON.parse(fs.readFileSync(path.join(dir, RECORD), "utf8"));
    record.plugins["no-at-sign"] = record.plugins["sleepy-panda@feed"];
    delete record.plugins["sleepy-panda@feed"];
    write(path.join(dir, RECORD), record);
    const verdict = resolveGovernor({ workspace: "sleepy-panda", feed: "portulan-internal" }, { env });
    assert.equal(verdict.state, "not-installed");
    assert.equal(verdict.nearMisses[0].why, "feed");
    assert.match(verdict.sentence, /no marketplace the record names/);
    assert.doesNotMatch(verdict.sentence, /`null`/);
});

test("a pointer that names a pointer is refused, and the refusal names the reason", () => {
    const { env } = host({ "panda@feed": { manifest: { portulan: { spec: "2.7" }, name: "sleepy-panda", kind: "pointer", governed_by: { workspace: "elsewhere" } } } });
    const verdict = resolveGovernor({ workspace: "sleepy-panda", feed: "feed" }, { env });
    assert.equal(verdict.state, "not-installed");
    assert.equal(verdict.nearMisses[0].why, "pointer");
    assert.match(verdict.sentence, /governed by exactly one workspace/);
});

test("two installed workspaces answering to one name are refused, not ranked", () => {
    const { env } = host({
        "sleepy-panda@portulan-internal": { manifest: governing("sleepy-panda") },
        "panda-again@portulan-internal": { manifest: governing("sleepy-panda") },
    });
    const verdict = resolveGovernor({ workspace: "sleepy-panda", feed: "portulan-internal" }, { env });
    assert.equal(verdict.state, "ambiguous");
    assert.equal(verdict.root, null);
    assert.equal(verdict.matches.length, 2);
    assert.match(verdict.sentence, /Refusing to pick one/);
});

test("one workspace installed at two scopes but one root resolves — distinct roots is the test", () => {
    const { dir, env } = host({ "sleepy-panda@portulan-internal": { manifest: governing("sleepy-panda") } });
    const record = JSON.parse(fs.readFileSync(path.join(dir, RECORD), "utf8"));
    record.plugins["sleepy-panda@portulan-internal"].push({ ...record.plugins["sleepy-panda@portulan-internal"][0], scope: "project" });
    write(path.join(dir, RECORD), record);
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "portulan-internal" }, { env }).state, "resolved");

    const two = host({ "sleepy-panda@portulan-internal": { manifest: governing("sleepy-panda"), second: { manifest: governing("sleepy-panda") } } });
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "portulan-internal" }, { env: two.env }).state, "ambiguous");
});

test("a payload carrying no manifest, or one with no name, is not a candidate", () => {
    const { env } = host({ "empty@feed": {}, "nameless@feed": { manifest: { portulan: { spec: "2.7" }, kind: "portfolio" } } });
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "feed" }, { env }).state, "not-installed");
});

test("a file that merely SHARES the name is not a workspace manifest — the fail-open, closed", () => {
    const { env } = host({ "impostor@feed": { manifest: { version: 2, name: "sleepy-panda", projects: { app: "apps/app" } } } });
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "feed" }, { env }).state, "not-installed");

    const real = host({ "genuine@feed": { manifest: { portulan: { spec: "2.7" }, name: "sleepy-panda", kind: "portfolio" } } });
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "feed" }, { env: real.env }).state, "resolved");

    const scalar = host({ "scalar@feed": { manifest: { portulan: "2.7", name: "sleepy-panda", kind: "portfolio" } } });
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "feed" }, { env: scalar.env }).state, "not-installed");

    const bare = host({ "bare@feed": { manifest: { portulan: {}, name: "sleepy-panda", kind: "portfolio" } } });
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "feed" }, { env: bare.env }).state, "not-installed");
});

test("an unparseable manifest in a payload costs that candidate and nothing else", () => {
    const { dir, env } = host({ "sleepy-panda@feed": { manifest: governing("sleepy-panda") }, "junk@feed": {} });
    const record = JSON.parse(fs.readFileSync(path.join(dir, RECORD), "utf8"));
    write(path.join(record.plugins["junk@feed"][0].installPath, "workspace.json"), "{ not json");
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "feed" }, { env }).state, "resolved");
});

test("an install whose payload directory is gone does not take the resolution down", () => {
    const { dir, env } = host({ "sleepy-panda@feed": { manifest: governing("sleepy-panda") }, "removed@feed": { manifest: governing("removed") } });
    const record = JSON.parse(fs.readFileSync(path.join(dir, RECORD), "utf8"));
    fs.rmSync(record.plugins["removed@feed"][0].installPath, { recursive: true, force: true });
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "feed" }, { env }).state, "resolved");
});

// --------------------------------------- 5. the command, which is the seam the boot skill reads

function harness() {
    const said = [];
    const warned = [];
    return { said, warned, options: { say: (l) => said.push(l), warn: (l) => warned.push(l) } };
}

function pointerAt(governedBy) {
    const dir = scratch();
    write(path.join(dir, "workspace.json"), { portulan: { spec: "2.7" }, name: "tipar-api", kind: "pointer", governed_by: governedBy });
    return dir;
}

test("the exit-code map keeps could-not-look out of the not-installed bucket", () => {
    assert.deepEqual(EXIT, { resolved: 0, "not-installed": 1, ambiguous: 1, "could-not-look": 2 });
});

test("--json prints a verdict with the root a boot can act on", () => {
    const { env } = host({ "sleepy-panda@portulan-internal": { version: "0.5.0", manifest: governing("sleepy-panda") } });
    const h = harness();
    const code = run(["--json", pointerAt({ workspace: "sleepy-panda", feed: "portulan-internal" })], { ...h.options, env });
    assert.equal(code, 0);
    const verdict = JSON.parse(h.said.join("\n"));
    assert.equal(verdict.state, "resolved");
    assert.equal(fs.existsSync(path.join(verdict.root, "workspace.json")), true);
    assert.equal(verdict.version, "0.5.0");
    assert.equal(verdict.marketplace, "portulan-internal");
});

test("without --json it prints the resolver's own sentence, and only that", () => {
    const { env } = host({ "sleepy-panda@portulan-internal": { manifest: governing("sleepy-panda") } });
    const h = harness();
    run([pointerAt({ workspace: "sleepy-panda", feed: "portulan-internal" })], { ...h.options, env });
    assert.equal(h.said.length, 1);
    assert.match(h.said[0], /is installed here/);
});

test("not installed exits 1 and an unreadable record exits 2 — the two are never one code", () => {
    const absent = host({}, { record: false });
    const h1 = harness();
    assert.equal(run([pointerAt({ workspace: "sleepy-panda" })], { ...h1.options, env: absent.env }), 1);

    const broken = host({}, { record: false });
    write(path.join(broken.dir, RECORD), "{ not json");
    const h2 = harness();
    assert.equal(run([pointerAt({ workspace: "sleepy-panda" })], { ...h2.options, env: broken.env }), 2);
});

test("two candidates exit 1 and name both, rather than picking", () => {
    const { env } = host({
        "a@portulan-internal": { manifest: governing("sleepy-panda") },
        "b@portulan-internal": { manifest: governing("sleepy-panda") },
    });
    const h = harness();
    assert.equal(run(["--json", pointerAt({ workspace: "sleepy-panda", feed: "portulan-internal" })], { ...h.options, env }), 1);
    const verdict = JSON.parse(h.said.join("\n"));
    assert.equal(verdict.state, "ambiguous");
    assert.equal(verdict.root, null);
    assert.equal(verdict.matches.length, 2);
});

test("a governing manifest is answered, not refused — one tool for either kind", () => {
    const dir = scratch();
    write(path.join(dir, "workspace.json"), governing("sleepy-panda"));
    const h = harness();
    assert.equal(run(["--json", dir], h.options), 0);
    const verdict = JSON.parse(h.said.join("\n"));
    assert.equal(verdict.state, "resides-here");
    assert.equal(verdict.root, dir);
});

test("no argument, too many, and an unreadable manifest are all could-not-run", () => {
    assert.equal(run([], harness().options), 2);
    assert.equal(run([scratch(), scratch()], harness().options), 2);
    assert.equal(run([scratch()], harness().options), 2);
});

test("every could-not-run says so on STDERR and prints no verdict on stdout", () => {
    for (const argv of [[], [scratch(), scratch()], [scratch()]]) {
        const h = harness();
        assert.equal(run(argv, h.options), 2);
        assert.deepEqual(h.said, [], `stdout must be empty for ${JSON.stringify(argv)}`);
        assert.ok(h.warned.length > 0, "and stderr must say why");
    }
});

test("an unknown option is refused, not dropped — a typo must not return prose with exit 0", () => {
    const { env } = host({ "sleepy-panda@portulan-internal": { manifest: governing("sleepy-panda") } });
    const h = harness();
    assert.equal(run(["--jsonn", pointerAt({ workspace: "sleepy-panda", feed: "portulan-internal" })], { ...h.options, env }), 2);
    assert.deepEqual(h.said, []);
    assert.match(h.warned.join("\n"), /unknown option `--jsonn`/);
});

test("--help is a request that succeeded, and states the exit contract the code actually has", () => {
    const h = harness();
    assert.equal(run(["--help"], h.options), 0);
    const help = h.said.join("\n");
    assert.match(help, /never the network/);
    assert.match(help, /resides-here/);
    assert.match(help, /Key on `state`/);
});

// ------------------------------------------------------------------- Pack-resolution roots

test("a repository-shaped plugin contributes `<installPath>/packs`", () => {
    const h = host({ "engine@feed": { packs: ["rituals/checkpoints"] } });
    const got = discoverPackRoots({ env: h.env });
    assert.equal(got.ok, true);
    assert.equal(got.roots.length, 1);
    assert.ok(got.roots[0].endsWith(path.join("engine", "0.1.0", "packs")), got.roots[0]);
});

test("a FLAT plugin contributes its install root — the shape this project's own feed ships", () => {
    const h = host({ "portulan-checkpoints@portulan-internal": { packs: ["rituals/checkpoints"], shape: "flat" } });
    const got = discoverPackRoots({ env: h.env });
    assert.equal(got.roots.length, 1);
    assert.ok(got.roots[0].endsWith(path.join("portulan-checkpoints", "0.1.0")), got.roots[0]);
});

test("`isPackRoot` tests for a pack.json, not for a directory named `packs`", () => {
    const h = host({ "hollow@feed": {} });
    const installPath = path.join(h.dir, "plugins", "cache", "feed", "hollow", "0.1.0");
    fs.mkdirSync(path.join(installPath, "packs", "rituals", "checkpoints"), { recursive: true });
    assert.equal(isPackRoot(path.join(installPath, "packs")), false);
    assert.deepEqual(discoverPackRoots({ env: h.env }).roots, []);
});

test("an ABSENT record is `ok: true` with no roots — nothing installed is an answer", () => {
    const h = host({}, { record: false });
    const got = discoverPackRoots({ env: h.env });
    assert.equal(got.ok, true, "absent is an answer, not a failure to look");
    assert.deepEqual(got.roots, []);
    assert.match(got.why, /nothing installed/);
});

test("an UNREADABLE record is `ok: false` — the distinction the absent case used to swallow", () => {
    const dir = scratch();
    write(path.join(dir, RECORD), "{ not json");
    const got = discoverPackRoots({ env: { CLAUDE_CONFIG_DIR: dir } });
    assert.equal(got.ok, false);
    assert.deepEqual(got.roots, []);
    assert.match(got.why, /not the same as finding nothing installed/);
});

test("asked-for discovery that could not look is COULD-NOT-RUN, not an empty plan", () => {
    const got = resolutionRoots({ derived: ["/derived"], forced: true, discovery: { ok: false, why: "record will not parse" } });
    assert.deepEqual(got.roots, []);
    assert.equal(got.couldNotRun, "record will not parse");
});

test("but an ABSENT record under `auto` keeps the derived root, and unions with nothing", () => {
    const got = resolutionRoots({ derived: ["/derived"], forced: true, discovery: { ok: true, roots: [], why: "nothing installed" } });
    assert.deepEqual(got.roots, ["/derived"]);
    assert.equal(got.couldNotRun, null);
    assert.equal(got.source, "union");
});

test("precedence: named wins, and the named branch never consults discovery", () => {
    let called = 0;
    const got = resolutionRoots({ named: ["/named"], derived: ["/derived"], discovery: () => (called += 1, { ok: true, roots: ["/discovered"] }) });
    assert.deepEqual(got.roots, ["/named"]);
    assert.equal(got.source, "named");
    assert.equal(got.refusal, null);
    assert.equal(called, 0, "a named root is never silently overridden, so there is nothing to override it with");
});

test("asking for a named root AND `auto` is refused, and the roots are empty so a caller fails closed", () => {
    let called = 0;
    const got = resolutionRoots({ named: ["/named"], derived: ["/derived"], discovery: () => (called += 1, { ok: true, roots: ["/discovered"] }), forced: true });
    assert.deepEqual(got.roots, []);
    assert.match(got.refusal, /never both/);
    assert.equal(called, 0, "a refused combination must not read the host on its way to refusing");
});

test("an explicitly EMPTY named set beside `auto` is refused, exactly as a non-empty one is", () => {
    const got = resolutionRoots({ named: [], namedGiven: true, derived: ["/derived"], forced: true, discovery: { ok: true, roots: ["/d"] } });
    assert.deepEqual(got.roots, []);
    assert.match(got.refusal, /never both/);
});

test("an explicitly EMPTY named set means search nowhere, and is not a fall-through to derived", () => {
    const got = resolutionRoots({ named: [], namedGiven: true, derived: ["/derived"] });
    assert.deepEqual(got.roots, []);
    assert.equal(got.source, "named");
});

test("unasked, a wired thunk IS consulted and unions — discovered first", () => {
    let called = 0;
    const got = resolutionRoots({ named: [], derived: ["/derived"], discovery: () => (called += 1, { ok: true, roots: ["/x"] }), forced: false });
    assert.equal(called, 1, "a wired thunk is consulted on the unasked path");
    assert.equal(got.source, "union");
    // Order, not membership: `resolvePack` takes the first root holding the pack.
    assert.deepEqual(got.roots, ["/x", "/derived"]);
    assert.deepEqual(got.origins, [
        { root: "/x", origin: "discovered" },
        { root: "/derived", origin: "derived" },
    ]);
});

test("unasked with NO thunk wired, the host is never read and the derived root stands alone", () => {
    const got = resolutionRoots({ named: [], derived: ["/derived"] });
    assert.equal(got.source, "derived");
    assert.deepEqual(got.roots, ["/derived"]);
    assert.match(got.why, /pass `--pack-root auto`/);
});

test("unasked and the record could not be read: derived-only, the diagnostic REPORTED, never exit 2", () => {
    const got = resolutionRoots({ named: [], derived: ["/derived"], discovery: { ok: false, why: "the record is not JSON" } });
    assert.deepEqual(got.roots, ["/derived"], "the derived root survives; an empty set is not a neutral element");
    assert.equal(got.couldNotRun, null, "nobody asked, so this is not a could-not-run");
    assert.match(got.why, /could not look/);
    assert.match(got.why, /the record is not JSON/, "discovery's own sentence, not a paraphrase of it");
});

test("ASKED and the record could not be read is still exit 2 — the other half of the pair", () => {
    const got = resolutionRoots({ named: [], derived: ["/derived"], discovery: { ok: false, why: "the record is not JSON" }, forced: true });
    assert.deepEqual(got.roots, [], "an asked-for discovery that could not look resolves nothing");
    assert.match(got.couldNotRun, /the record is not JSON/);
});

test("unasked where nothing is derived: a discovered root still answers, and none is still none", () => {
    let called = 0;
    const found = resolutionRoots({ named: [], derived: [], discovery: () => (called += 1, { ok: true, roots: ["/d"] }) });
    assert.equal(called, 1);
    assert.equal(found.source, "union");
    assert.deepEqual(found.origins, [{ root: "/d", origin: "discovered" }]);

    const hermetic = resolutionRoots({ named: [], derived: [] });
    assert.equal(hermetic.source, "none");
    assert.match(hermetic.why, /none is derivable from the manifest/);
    assert.match(hermetic.why, /discovery was not asked for/);
});

test("unasked, a discovery that found nothing and has NO sentence does not print `null`", () => {
    for (const derived of [["/derived"], []]) {
        const got = resolutionRoots({ named: [], derived, discovery: { ok: true, roots: [], why: null } });
        assert.doesNotMatch(got.why, /null/, `derived=${JSON.stringify(derived)}: ${got.why}`);
        assert.match(got.why, /discovery was consulted and found no root$/, "the lead survives; only the dangling suffix goes");
    }
    const spoken = resolutionRoots({ named: [], derived: ["/derived"], discovery: { ok: true, roots: [], why: "no record — nothing installed" } });
    assert.match(spoken.why, /found no root — no record — nothing installed/);
});

test("unasked, discovery answering `nothing installed` keeps its own sentence rather than a bare zero", () => {
    const got = resolutionRoots({ named: [], derived: ["/derived"], discovery: { ok: true, roots: [], why: "no record — nothing installed" } });
    assert.equal(got.source, "derived");
    assert.match(got.why, /no record — nothing installed/);
});

test("`--pack-root auto` UNIONS with the derived root, discovered first", () => {
    const got = resolutionRoots({ named: [], derived: ["/derived"], discovery: { ok: true, roots: ["/discovered"] }, forced: true });
    assert.deepEqual(got.roots, ["/discovered", "/derived"]);
    assert.equal(got.source, "union");
    assert.deepEqual(got.origins, [
        { root: "/discovered", origin: "discovered" },
        { root: "/derived", origin: "derived" },
    ]);
});

test("`auto` finding nothing still searches the derived root, and says both counts", () => {
    const got = resolutionRoots({ named: [], derived: ["/derived"], discovery: { ok: true, roots: [] }, forced: true });
    assert.deepEqual(got.roots, ["/derived"]);
    assert.equal(got.source, "union");
    assert.match(got.why, /0 root\(s\)/);
    assert.deepEqual(got.origins, [{ root: "/derived", origin: "derived" }]);
});

test("origin is stated on every branch, so a caller need not know which one produced the plan", () => {
    assert.deepEqual(resolutionRoots({ named: ["/n"] }).origins, [{ root: "/n", origin: "named" }]);
    assert.deepEqual(resolutionRoots({ derived: ["/d"] }).origins, [{ root: "/d", origin: "derived" }]);
    assert.deepEqual(resolutionRoots({}).origins, []);
});

test("forced discovery that could not RUN is `none`, and carries the reason", () => {
    const got = resolutionRoots({ named: [], derived: ["/derived"], discovery: { ok: false, roots: [], why: "could not read the record" }, forced: true });
    assert.deepEqual(got.roots, []);
    assert.equal(got.source, "none");
    assert.equal(got.why, "could not read the record");
});

test("the keyword is the literal `auto`, so `./auto` stays a directory", () => {
    assert.equal(AUTO, "auto");
    assert.notEqual(AUTO, path.resolve("./auto"));
});

test("`forced` with NO discovery wired is could-not-run, not an empty plan", () => {
    const missing = resolutionRoots({ derived: ["/derived"], forced: true });
    assert.deepEqual(missing.roots, []);
    assert.match(missing.couldNotRun, /did not run/);

    const nulled = resolutionRoots({ derived: ["/derived"], forced: true, discovery: () => null });
    assert.match(nulled.couldNotRun, /did not run/);

    const ran = resolutionRoots({ derived: ["/derived"], forced: true, discovery: { ok: true, roots: [] } });
    assert.equal(ran.couldNotRun, null);
    assert.deepEqual(ran.roots, ["/derived"]);
});
