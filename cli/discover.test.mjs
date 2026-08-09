// Tests for host plugin-cache discovery.
//
// Every case builds a whole fake host in a temp directory and points `CLAUDE_CONFIG_DIR` at it, so
// nothing here reads the machine the suite runs on. That is not only hygiene: discovery's entire
// subject is a live host, and a suite that consulted the real one would be green on the author's
// laptop and meaningless anywhere else — the property `../.portulan/identity.md` calls the reason
// this project has no build step.
//
// What these establish, in the order the file runs them:
//
//   1. the config directory, including the two ways `CLAUDE_CONFIG_DIR` can be present and mean
//      nothing;
//   2. the record reader's three states, and that a malformed entry costs its own plugin and no
//      other;
//   3. the four verdicts, each with the sentence a reader gets;
//   4. the limits, asserted rather than only written down — the candidate list is two named paths,
//      a feed constrains rather than ranks, a pointer target is refused, and two roots are refused
//      instead of ranked.
//
// The last group is the one that matters most. Every entry in it is a place where a resolver could
// be helpful and wrong, and this repository's standing position is that a limit a reader can measure
// beats a matcher clever enough to be wrong quietly.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { configDir, recordPath, readInstalls, resolveGovernor, run, EXIT, MANIFEST_AT, RECORD } from "./discover.mjs";

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

/**
 * Build a host: `plugins/installed_plugins.json` plus each install's payload.
 *
 * `plugins` maps `<plugin>@<marketplace>` to `{ version, at, manifest }` — `at` is the payload path
 * the manifest is written to, defaulting to the plugin root, and `manifest` is the workspace manifest
 * itself. A plugin with no `manifest` gets a payload directory and nothing in it, which is the
 * ordinary case for every plugin on a host that is not a workspace.
 */
function host(plugins, { record = true } = {}) {
    const dir = scratch();
    const entries = {};
    for (const [key, spec] of Object.entries(plugins)) {
        const version = spec.version ?? "0.1.0";
        const [plugin, marketplace] = [key.slice(0, key.lastIndexOf("@")), key.slice(key.lastIndexOf("@") + 1)];
        const installPath = path.join(dir, "plugins", "cache", marketplace, plugin, version);
        fs.mkdirSync(installPath, { recursive: true });
        if (spec.manifest !== undefined) write(path.join(installPath, spec.at ?? "workspace.json"), spec.manifest);
        entries[key] = [{ scope: "user", installPath, version, installedAt: "2026-08-09T00:00:00.000Z", gitCommitSha: "0".repeat(40) }];
        if (spec.second) {
            // A second install of the SAME plugin, at another scope and another root — the shape
            // that produces two candidates without any second plugin existing.
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
    // An exported-but-empty variable is a shell accident. Honouring it would point discovery at
    // `path.resolve("")` — the process's working directory — which is a plausible-looking answer to
    // a question nobody asked.
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

test("a `plugins` ARRAY is unreadable, not an empty host — the collapse that spent a look as an absence", () => {
    // `typeof [] === "object"`, so the first cut read `{"plugins": []}` as a healthy record with
    // nothing installed and answered `not-installed`. That is *could not look* spent as absence, in
    // the function whose docblock argues the three read states are kept apart at the source. The
    // top-level guard one clause away already had `Array.isArray`; this is its sibling.
    // (Copilot, round 2.)
    const { dir, env } = host({}, { record: false });
    write(path.join(dir, RECORD), { version: 2, plugins: [] });
    assert.equal(readInstalls({ env }).state, "unreadable");
    assert.equal(resolveGovernor({ workspace: "sleepy-panda" }, { env }).state, "could-not-look");

    // The negative control: an EMPTY object is a genuine host with nothing installed, and must stay
    // readable — otherwise the fix would turn every fresh host into a could-not-look.
    write(path.join(dir, RECORD), { version: 2, plugins: {} });
    assert.equal(readInstalls({ env }).state, "read");
    assert.equal(resolveGovernor({ workspace: "sleepy-panda" }, { env }).state, "not-installed");
});

test("readInstalls drops a malformed entry and keeps every other plugin", () => {
    // One plugin's bad record must not blind discovery to the rest of the host: the alternative is a
    // resolver that answers "could not look" for a workspace sitting right there.
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
    // `feed` is optional in the schema — a workspace checked out beside the repository has none —
    // so its absence must not be a filter that matches nothing.
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
    // The plugin is `panda`; the workspace it carries is `sleepy-panda`. A resolver matching plugin
    // names would answer the wrong question confidently.
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
    // The record carries an entry per scope. Two entries pointing at ONE directory is the ordinary
    // case and must not read as ambiguity; two directories is the case that must.
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
    // `workspace.json` is a common filename in the wider ecosystem. Until the pre-commit checkpoint
    // built this, `name` alone was the whole test, so an Nx-style file resolved and the boot would
    // have been pointed at it — with `state: resolved` and exit 0. The gate is now `portulan` AND
    // `name`, the Workspace Definition's identity minus `kind`.
    const { env } = host({ "impostor@feed": { manifest: { version: 2, name: "sleepy-panda", projects: { app: "apps/app" } } } });
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "feed" }, { env }).state, "not-installed");

    // And the negative control, so the gate is the `portulan` key rather than a general tightening
    // that would refuse real manifests: the same file with the key resolves.
    const real = host({ "genuine@feed": { manifest: { portulan: { spec: "2.7" }, name: "sleepy-panda", kind: "portfolio" } } });
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "feed" }, { env: real.env }).state, "resolved");

    // A `portulan` key that is not an object does not qualify either — a string there is a different
    // file's schema, not a Workspace Definition version block.
    const scalar = host({ "scalar@feed": { manifest: { portulan: "2.7", name: "sleepy-panda", kind: "portfolio" } } });
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "feed" }, { env: scalar.env }).state, "not-installed");

    // And an EMPTY `portulan` object does not qualify — the same fail-open one tightening later, since a
    // non-Portulan file can carry a bare key as easily as a name. The gate is `portulan.spec`, which is
    // what the Definition REQUIRES of the block, so it keys on the contract rather than on a key's
    // presence. Its *pattern* stays `doctor`'s: this is not a second schema validator. (Copilot, round 2.)
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

// ------------------------------------------------------------ 5. the command, which is the seam
//
// The boot skill reads THIS, so its contract is a contract: a stable field to key on, and an exit
// code that keeps *could not look* out of the same bucket as *not installed*. The prose sentence is a
// courtesy to a human; `--json` is the half a boot depends on.

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
    // The boot skill is told to read `state` from stdout. When there is no verdict there must be no
    // stdout at all — a caller parsing empty output fails loudly, where a caller handed prose it did
    // not ask for parses something. The skill's own table carries the row for this.
    for (const argv of [[], [scratch(), scratch()], [scratch()]]) {
        const h = harness();
        assert.equal(run(argv, h.options), 2);
        assert.deepEqual(h.said, [], `stdout must be empty for ${JSON.stringify(argv)}`);
        assert.ok(h.warned.length > 0, "and stderr must say why");
    }
});

test("an unknown option is refused, not dropped — a typo must not return prose with exit 0", () => {
    // `--jsonn` printed the human sentence and exited 0 until the pre-commit checkpoint typed it.
    const { env } = host({ "sleepy-panda@portulan-internal": { manifest: governing("sleepy-panda") } });
    const h = harness();
    assert.equal(run(["--jsonn", pointerAt({ workspace: "sleepy-panda", feed: "portulan-internal" })], { ...h.options, env }), 2);
    assert.deepEqual(h.said, []);
    assert.match(h.warned.join("\n"), /unknown option `--jsonn`/);
});

test("--help is a request that succeeded", () => {
    const h = harness();
    assert.equal(run(["--help"], h.options), 0);
    assert.match(h.said.join("\n"), /never the network/);
});
