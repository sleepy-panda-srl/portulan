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

import { configDir, recordPath, readInstalls, resolveGovernor, run, EXIT, MANIFEST_AT, RECORD, RECORD_VERSIONS, AUTO, isPackRoot, discoverPackRoots, resolutionRoots } from "./discover.mjs";

// A HERMETIC HOST. The tools consult the host's installed-plugin record on the UNASKED path as of
// 2026-08-13, so a suite that does not neutralise it reads the machine it runs on and a fixture's
// verdict moves with what somebody has installed. Swept by `pinned-roots.live.test.mjs`, whose header
// carries the argument and the limit. A case that wants a host passes `env:` explicitly, which wins.
process.env.CLAUDE_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));

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
        // `packs` and `shape` are the pack-root half's additions to this builder rather than a second
        // one. **The shapes are measured, not invented:** a plugin that IS a repository checkout keeps
        // its packs under `packs/`, and one that ships a pack family directly keeps the CATEGORIES at
        // the install root — which is what `portulan-checkpoints@portulan-internal` actually is. A
        // fixture that knew only the first is how discovery came to find neither plugin the private
        // feed ships, with a green suite throughout.
        for (const name of spec.packs ?? []) {
            const base = spec.shape === "flat" ? installPath : path.join(installPath, "packs");
            const packDir = path.join(base, ...name.split("/"));
            fs.mkdirSync(packDir, { recursive: true });
            // WITH a pack.json, because `isPackRoot` tests for that file rather than for a directory
            // named `packs` — a fixture making the directory alone would pass a probe the real thing fails.
            write(path.join(packDir, "pack.json"), { name: name.split("/")[1], category: name.split("/")[0] });
        }
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

test("an unrecognised record version is could-not-look, never a hopeful parse", () => {
    // The record belongs to the HOST. A later version may move or rename `installPath`, and a reader
    // that parsed on regardless would report roots that are not roots — a confident wrong answer, which
    // is what the four states exist to prevent. Raised by the #183 session, which had this guard on its
    // own reader; verified against the live record, which carries version 2.
    const { dir, env } = host({ "sleepy-panda@feed": { manifest: governing("sleepy-panda") } });
    const record = JSON.parse(fs.readFileSync(path.join(dir, RECORD), "utf8"));

    for (const version of [3, "2", null, undefined]) {
        const bumped = { ...record, version };
        if (version === undefined) delete bumped.version;
        write(path.join(dir, RECORD), bumped);
        const installs = readInstalls({ env });
        assert.equal(installs.state, "unreadable", `version ${JSON.stringify(version)} must not be read`);
        assert.match(installs.detail, /not one this reader understands/);
        // And it reaches the caller as could-not-look rather than as an absence.
        assert.equal(resolveGovernor({ workspace: "sleepy-panda" }, { env }).state, "could-not-look");
    }

    // The negative control: the version it does understand still reads, so this is a guard rather than
    // a reader that stopped working.
    write(path.join(dir, RECORD), record);
    assert.equal(readInstalls({ env }).state, "read");
});

test("the record versions this reader claims are enumerated, not implied", () => {
    assert.deepEqual([...RECORD_VERSIONS], [2]);
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

test("a BLANK feed is unconstrained — the confident wrong answer, closed", () => {
    // The Definition puts `minLength: 1` on `feed` and nothing else, so `"   "` validates. Until #182
    // item 1 it constrained every candidate to a marketplace of that name, matched nothing, and
    // answered `not-installed` about a workspace that IS installed. Reproduced on the packaged path
    // against a real `claude plugin install` before the fix, not only here.
    const { env } = host({ "sleepy-panda@portulan-internal": { manifest: governing("sleepy-panda") } });
    for (const feed of ["", "   ", "\t\n "]) {
        const verdict = resolveGovernor({ workspace: "sleepy-panda", feed }, { env });
        assert.equal(verdict.state, "resolved", `a blank feed ${JSON.stringify(feed)} must not constrain`);
        assert.equal(verdict.wanted.feed, null, "and it is reported as unset rather than as padding");
    }
    // The negative control, so this is blank-is-unset rather than a feed that stopped constraining:
    // a feed naming something real still bites.
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "another-feed" }, { env }).state, "not-installed");
});

test("a BLANK workspace is could-not-look, never a search for the empty string", () => {
    // `""` is a string, so the old guard passed it through and the resolver went looking for a
    // workspace named nothing — reaching `not-installed`, which is a verdict about a host rather than
    // about a pointer that never named anything.
    const { env } = host({ "sleepy-panda@portulan-internal": { manifest: governing("sleepy-panda") } });
    for (const workspace of ["", "   "]) {
        const verdict = resolveGovernor({ workspace }, { env });
        assert.equal(verdict.state, "could-not-look", `a blank workspace ${JSON.stringify(workspace)} is not a search`);
        assert.match(verdict.sentence, /names no governing workspace/);
    }
});

test("blank is unset, and that is NOT normalisation — a padded name still misses, both sides", () => {
    // The negative control for the two above, and it exists because the first draft of that fix
    // trimmed the value instead of only testing it. Trimming the wanted side turns `"  x  "` in a
    // pointer into a match for `x` on disk while the same padding ON DISK still misses — a new
    // asymmetry, and discovery quietly repairing a manifest the slug pattern refuses. Found at the
    // pre-commit checkpoint by building the case rather than reading the diff.
    const { env } = host({ "sleepy-panda@portulan-internal": { manifest: governing("sleepy-panda") } });
    const padded = resolveGovernor({ workspace: "  sleepy-panda  ", feed: "portulan-internal" }, { env });
    assert.equal(padded.state, "not-installed", "a padded request is a different name, not a tidied one");
    assert.equal(padded.wanted.workspace, "  sleepy-panda  ", "and the raw value is what is reported back");

    // The symmetric half: padding ON DISK misses too, so neither side is quietly repaired.
    const onDisk = host({ "sleepy-panda@portulan-internal": { manifest: governing("  sleepy-panda  ") } });
    assert.equal(resolveGovernor({ workspace: "sleepy-panda", feed: "portulan-internal" }, { env: onDisk.env }).state, "not-installed");

    // And a padded FEED still constrains rather than being tidied into a match.
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

test("a near miss whose record key carries no marketplace does not print `null`", () => {
    // `readInstalls` tolerates a key with no `@` on purpose, so `marketplace` is null there — and the
    // feed near-miss sentence has to survive it. It read "ships through `null`", which names a
    // marketplace called null rather than one nobody recorded. Copilot, on the round reviewing the fix.
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

test("--help is a request that succeeded, and states the exit contract the code actually has", () => {
    const h = harness();
    assert.equal(run(["--help"], h.options), 0);
    const help = h.said.join("\n");
    assert.match(help, /never the network/);
    // "0 resolved" alone was narrower than `run()` from the commit that introduced it — a governing
    // manifest answers `resides-here` and also exits 0. #182 item 3, and the shape this very pull
    // request corrected in eleven other carriers before committing it in a file of its own.
    assert.match(help, /resides-here/);
    assert.match(help, /Key on `state`/);
});

// ===========================================================================================
// Pack-resolution roots — the second half of row 7's discovery clause (#123)
// ===========================================================================================

test("a repository-shaped plugin contributes `<installPath>/packs`", () => {
    const h = host({ "engine@feed": { packs: ["rituals/checkpoints"] } });
    const got = discoverPackRoots({ env: h.env });
    assert.equal(got.ok, true);
    assert.equal(got.roots.length, 1);
    assert.ok(got.roots[0].endsWith(path.join("engine", "0.1.0", "packs")), got.roots[0]);
});

test("a FLAT plugin contributes its install root — the shape this project's own feed ships", () => {
    // The regression that would return the shipped defect: probing only for a directory named `packs`
    // found nothing on the one machine and the one feed this was built for.
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
    // This case asserted `ok: false` until 2026-08-13, pinning the very collapse the function's
    // docblock says it preserves against: `readInstalls` keeps `absent` apart from `unreadable`, and
    // `discoverPackRoots` then mapped both to could-not-look. A host with NO record is a host with
    // nothing installed — which is every CI runner — and reporting that as could-not-look made
    // `--pack-root auto` return the empty set, which `doctor` reports as *unverifiable* and exits 0.
    // Rewritten rather than deleted, because the property it was reaching for is real and now lives
    // in the case below.
    const h = host({}, { record: false });
    const got = discoverPackRoots({ env: h.env });
    assert.equal(got.ok, true, "absent is an answer, not a failure to look");
    assert.deepEqual(got.roots, []);
    assert.match(got.why, /nothing installed/);
});

test("an UNREADABLE record is `ok: false` — the distinction the absent case used to swallow", () => {
    // The half that was always true, now on its own subject: a record that IS there and will not parse
    // is could-not-look, and must never be spendable as *nothing installed*.
    const dir = scratch();
    write(path.join(dir, RECORD), "{ not json");
    const got = discoverPackRoots({ env: { CLAUDE_CONFIG_DIR: dir } });
    assert.equal(got.ok, false);
    assert.deepEqual(got.roots, []);
    assert.match(got.why, /not the same as finding nothing installed/);
});

test("asked-for discovery that could not look is COULD-NOT-RUN, not an empty plan", () => {
    // The consequence of the line above, at the resolver. An empty plan reads as *unverifiable* and
    // exits 0 — a green over a host nobody could read — and it discards the tree-derived root on the
    // way, so a pack that resolves perfectly well locally stops being looked at too.
    const got = resolutionRoots({ derived: ["/derived"], forced: true, discovery: { ok: false, why: "record will not parse" } });
    assert.deepEqual(got.roots, []);
    assert.equal(got.couldNotRun, "record will not parse");
});

test("but an ABSENT record under `auto` keeps the derived root, and unions with nothing", () => {
    // The other half of the same fix: *looked, found nothing* is a union with the empty set, which
    // leaves the tree-derived root standing rather than throwing it away.
    const got = resolutionRoots({ derived: ["/derived"], forced: true, discovery: { ok: true, roots: [], why: "nothing installed" } });
    assert.deepEqual(got.roots, ["/derived"]);
    assert.equal(got.couldNotRun, null);
    assert.equal(got.source, "union");
});

test("precedence: named wins, and the named branch never consults discovery", () => {
    // This case used to pass `forced: true` alongside the named root, which is the combination the
    // 2026-08-12 change REFUSES. The property it exists for — a named root is never silently
    // overridden, and nothing consults the host to decide that — is unchanged, so the case keeps its
    // assertions and drops the arrangement that is now an error in its own right.
    let called = 0;
    const got = resolutionRoots({ named: ["/named"], derived: ["/derived"], discovery: () => (called += 1, { ok: true, roots: ["/discovered"] }) });
    assert.deepEqual(got.roots, ["/named"]);
    assert.equal(got.source, "named");
    assert.equal(got.refusal, null);
    assert.equal(called, 0, "a named root is never silently overridden, so there is nothing to override it with");
});

test("asking for a named root AND `auto` is refused, and the roots are empty so a caller fails closed", () => {
    // The refusal exists because the alternative was a SILENT drop, and this change's whole claim is
    // "never silently". Roots are empty rather than one of the two sets, so a caller that ignores
    // `refusal` resolves nothing instead of resolving against half of what it asked for.
    let called = 0;
    const got = resolutionRoots({ named: ["/named"], derived: ["/derived"], discovery: () => (called += 1, { ok: true, roots: ["/discovered"] }), forced: true });
    assert.deepEqual(got.roots, []);
    assert.match(got.refusal, /never both/);
    assert.equal(called, 0, "a refused combination must not read the host on its way to refusing");
});

test("an explicitly EMPTY named set beside `auto` is refused, exactly as a non-empty one is", () => {
    // The case the first cut reached by passing a one-element array holding a SENTINEL STRING into
    // the shared predicate — a fake root in a predicate about roots, with a refusal that spoke of "a
    // named root" for a set that had none. Copilot, round 1 on #233. The predicate now takes the
    // boolean a resolver holds or the array a parser holds, and this is the assertion that keeps the
    // empty case inside it.
    const got = resolutionRoots({ named: [], namedGiven: true, derived: ["/derived"], forced: true, discovery: { ok: true, roots: ["/d"] } });
    assert.deepEqual(got.roots, []);
    assert.match(got.refusal, /never both/);
});

test("an explicitly EMPTY named set means search nowhere, and is not a fall-through to derived", () => {
    // `packRoots: []` is an API caller saying *search nowhere*; `named.length` alone cannot tell that
    // from *no roots were named*. Two tools disagreed about this once, which is why `namedGiven` is a
    // parameter rather than an inference.
    const got = resolutionRoots({ named: [], namedGiven: true, derived: ["/derived"] });
    assert.deepEqual(got.roots, []);
    assert.equal(got.source, "named");
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The unasked arm. **Two cases here pinned the behaviour the 2026-08-13 disposal reverses, and both
// are REWRITTEN into the property they were reaching for rather than deleted** — session 12's lesson
// about a case that "pinned the collapse itself". They asserted a spy at zero calls with a thunk
// wired, which was the narrowing; what they were actually protecting is that a caller which wires NO
// thunk stays hermetic, and that is now a case of its own and still forceable red.
// ─────────────────────────────────────────────────────────────────────────────────────────────

test("unasked, a wired thunk IS consulted and unions — discovered first", () => {
    // The disposal, at the layer that implements it. Measured before it landed: on the workspace `init`
    // drafts by default plus one pack of the adopter's own, `doctor` exited 1 with no flag and 0 under
    // `auto` — so `--pack-root` was not "optional where discovery finds a root", it was mandatory.
    let called = 0;
    const got = resolutionRoots({ named: [], derived: ["/derived"], discovery: () => (called += 1, { ok: true, roots: ["/x"] }), forced: false });
    assert.equal(called, 1, "a wired thunk is consulted on the unasked path");
    assert.equal(got.source, "union");
    // Order, not membership. `resolvePack` is first-match-wins, so discovered-first is what keeps the
    // unasked union's answers a superset of the old `auto`'s — and one order in BOTH arms is what stops
    // the flag changing the meaning of resolution rather than its inputs.
    assert.deepEqual(got.roots, ["/x", "/derived"]);
    assert.deepEqual(got.origins, [
        { root: "/x", origin: "discovered" },
        { root: "/derived", origin: "derived" },
    ]);
});

test("unasked with NO thunk wired, the host is never read and the derived root stands alone", () => {
    // What the two replaced cases were protecting, kept as its own property. The switch is the thunk's
    // PRESENCE, not a flag — so an API caller that wires none keeps the behaviour this function had
    // before the disposal, on every arm. `compile --check`'s host-independence is delivered by the
    // pinned root in `.portulan/verify/compile.sh` (railed in `pinned-roots.live.test.mjs`), and this
    // is the second, narrower guarantee underneath it.
    const got = resolutionRoots({ named: [], derived: ["/derived"] });
    assert.equal(got.source, "derived");
    assert.deepEqual(got.roots, ["/derived"]);
    assert.match(got.why, /pass `--pack-root auto`/);
});

test("unasked and the record could not be read: derived-only, the diagnostic REPORTED, never exit 2", () => {
    // **The asymmetry with `forced`, and the reason the two arms are two.** Asked-and-could-not-look is
    // could-not-run (exit 2, ruled 2026-08-13); unasked-and-could-not-look degrades, because nobody
    // asked and the readability of a host's record cannot be a precondition for grading a repository.
    // Silent it must not be: the diagnostic rides in `why`. Asserted as a PAIR with the case below, so
    // reusing the `forced` branch as the unasked default — the deadliest implementation of this change,
    // since it would make every CI runner exit 2 or go green on an empty set — cannot pass both.
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
    // The arm that had no root at all. `examples/workspace.json` is the live instance — it declares
    // `packs` and no `tree`, so this is the branch that grades it, and `doctor`'s note-vs-fail keying on
    // ORIGIN is what keeps that workspace green either way. See `doctor.test.mjs`.
    let called = 0;
    const found = resolutionRoots({ named: [], derived: [], discovery: () => (called += 1, { ok: true, roots: ["/d"] }) });
    assert.equal(called, 1);
    assert.equal(found.source, "union");
    assert.deepEqual(found.origins, [{ root: "/d", origin: "discovered" }]);

    // And with no thunk, unchanged: the stem of this sentence is asserted by `doctor.test.mjs`'s
    // "a declared pack on a workspace with no tree is REPORTED, never failed" too, which is why the
    // implementation keeps it one string and varies only the tail.
    const hermetic = resolutionRoots({ named: [], derived: [] });
    assert.equal(hermetic.source, "none");
    assert.match(hermetic.why, /none is derivable from the manifest/);
    assert.match(hermetic.why, /discovery was not asked for/);
});

test("unasked, a discovery that found nothing and has NO sentence does not print `null`", () => {
    // **`found.why` is optional, and this is its ordinary case rather than an edge.**
    // `discoverPackRoots` returns `why: null` whenever the record READ fine — a host with plugins
    // installed, none of which carries packs, which is most hosts. Appending it unguarded rendered
    // "discovery was consulted and found no root — null" into `plan.why`, and from there into `doctor`'s
    // resolution-root note and every unresolved-pack line.
    //
    // The `union` helper one screen up already guards exactly this (`found.roots.length === 0 &&
    // found.why`); the unasked arm did not. One operation, two sites, correct at one — raised by
    // Copilot, round 1 on #237. Asserted on `null` rather than on the rendered sentence, because a
    // matcher for the word "null" would also match a diagnostic that legitimately contained it.
    for (const derived of [["/derived"], []]) {
        const got = resolutionRoots({ named: [], derived, discovery: { ok: true, roots: [], why: null } });
        assert.doesNotMatch(got.why, /null/, `derived=${JSON.stringify(derived)}: ${got.why}`);
        assert.match(got.why, /discovery was consulted and found no root$/, "the lead survives; only the dangling suffix goes");
    }
    // The control, and it is what stops the fix from being "drop the suffix": where discovery DOES have
    // a sentence, it still rides through.
    const spoken = resolutionRoots({ named: [], derived: ["/derived"], discovery: { ok: true, roots: [], why: "no record — nothing installed" } });
    assert.match(spoken.why, /found no root — no record — nothing installed/);
});

test("unasked, discovery answering `nothing installed` keeps its own sentence rather than a bare zero", () => {
    // "0 root(s)" cannot tell a host with no record from a host whose record lists nothing relevant, and
    // those are different facts about the machine. The same reasoning as the `forced` arm's, and the
    // reason both arms build their plan through one `union` helper.
    const got = resolutionRoots({ named: [], derived: ["/derived"], discovery: { ok: true, roots: [], why: "no record — nothing installed" } });
    assert.equal(got.source, "derived");
    assert.match(got.why, /no record — nothing installed/);
});

test("`--pack-root auto` UNIONS with the derived root, discovered first", () => {
    // Replaces the case that pinned the opposite — "auto finding NOTHING yields the empty set, never
    // the derived root" — which was the rule until 2026-08-12. What changed it: the workspace `init`
    // drafts by default, plus one pack of the adopter's own, had NO green invocation that did not name
    // a host cache path by hand. Order is asserted, not membership: `resolvePack` is first-match-wins,
    // so discovered-first is what keeps every result the old `auto` gave as a subset of this one.
    const got = resolutionRoots({ named: [], derived: ["/derived"], discovery: { ok: true, roots: ["/discovered"] }, forced: true });
    assert.deepEqual(got.roots, ["/discovered", "/derived"]);
    assert.equal(got.source, "union");
    assert.deepEqual(got.origins, [
        { root: "/discovered", origin: "discovered" },
        { root: "/derived", origin: "derived" },
    ]);
});

test("`auto` finding nothing still searches the derived root, and says both counts", () => {
    // The half of the replaced rule that reversed outright. Under it this returned the empty set on
    // #117's ground; that ground now rests on the NAMED branch, which is untouched.
    const got = resolutionRoots({ named: [], derived: ["/derived"], discovery: { ok: true, roots: [] }, forced: true });
    assert.deepEqual(got.roots, ["/derived"]);
    assert.equal(got.source, "union");
    assert.match(got.why, /0 root\(s\)/);
    assert.deepEqual(got.origins, [{ root: "/derived", origin: "derived" }]);
});

test("origin is stated on every branch, so a caller need not know which one produced the plan", () => {
    // A negative control on the union: the other branches must carry `origins` too, or a consumer
    // starts asking `source` before it dares read the field, which is the case analysis this shape
    // exists to remove.
    assert.deepEqual(resolutionRoots({ named: ["/n"] }).origins, [{ root: "/n", origin: "named" }]);
    assert.deepEqual(resolutionRoots({ derived: ["/d"] }).origins, [{ root: "/d", origin: "derived" }]);
    assert.deepEqual(resolutionRoots({}).origins, []);
});

test("forced discovery that could not RUN is `none`, and carries the reason", () => {
    // Load-bearing in a way it was not before the union: *could not look* must not quietly become a
    // derived-only green. The union is over what discovery FOUND, and a discovery that could not look
    // found nothing to union with — so this branch returns the empty set while the one above it, where
    // discovery ran and found nothing, returns the derived root.
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
    // Copilot, round 4 on #236. The sibling of the unreadable-record case, one line above it: this
    // branch's own `why` says *discovery was requested and did not run*, and it returned a bare empty
    // plan — which a caller treating an empty root set as "nothing to check" spends as exit 0. Both
    // arms of "asked and could not" now carry `couldNotRun`.
    const missing = resolutionRoots({ derived: ["/derived"], forced: true });
    assert.deepEqual(missing.roots, []);
    assert.match(missing.couldNotRun, /did not run/);

    const nulled = resolutionRoots({ derived: ["/derived"], forced: true, discovery: () => null });
    assert.match(nulled.couldNotRun, /did not run/);

    // The control: a discovery that RAN and found nothing is not could-not-run — it unions with the
    // derived root, which is the whole point of the absent fix.
    const ran = resolutionRoots({ derived: ["/derived"], forced: true, discovery: { ok: true, roots: [] } });
    assert.equal(ran.couldNotRun, null);
    assert.deepEqual(ran.roots, ["/derived"]);
});
