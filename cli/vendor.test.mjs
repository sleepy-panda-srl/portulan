// Tests for `vendor` — a workspace materialised where it is needed, and the residence switch in both directions.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspect } from "./doctor.mjs";
import { READING_LINE } from "./form.mjs";
import { VendorError, RESIDENCES, parseArgs, residenceOf, retarget, walk, directories, escapingSlots, collisions, agentsMd, run } from "./vendor.mjs";

// The tools read the host's plugin record, so every case gets an empty host unless it passes `env:`.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const HERE = path.dirname(fileURLToPath(import.meta.url));

// One exit handler for every scratch directory: one each would pass node's default limit of ten listeners.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-vendor-"));
    SCRATCH.push(dir);
    return dir;
}

/** Collects what a run said, so a refusal can be asserted on its sentence and not only on its code. */
function harness() {
    const said = [];
    const warned = [];
    return { said, warned, options: { say: (l) => said.push(l), warn: (l) => warned.push(l) } };
}

const text = (h) => [...h.said, ...h.warned].join("\n");

function write(dir, rel, contents, mode) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
    if (mode !== undefined) fs.chmodSync(full, mode);
    return full;
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

/** A whole `doctor`-green workspace, not a manifest stub, so a copy that drops any other file is caught. */
function seedWorkspace(dir, { name = "acme", kind = "repository", tree = "../", card = "acme-app", extra = {} } = {}) {
    const manifest = {
        portulan: { spec: "2.7" },
        name,
        summary: `The ${name} workspace.`,
        kind,
        ...(tree === null ? {} : { tree }),
        // `repos` is declared only with a card: a declared slot with no directory fails `doctor`'s `paths` check.
        slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md", ...(card ? { repos: "repos/" } : {}) },
        verify: {
            default: "workspace",
            recipes: [{ id: "workspace", run: "./verify/workspace.sh", requires: ["bash"], doc: "verify/README.md" }],
        },
        ...extra,
    };
    write(dir, "workspace.json", json(manifest));
    write(dir, "identity.md", `# Identity — ${name}\n\n> Who this team is.\n`);
    write(dir, "principles.md", `# Principles — ${name}\n\n> What this team refuses to trade away.\n`);
    write(dir, "gate-map.md", `# Gate map — ${name}\n\n> Actions bound to tiers.\n`);
    write(dir, "verify/README.md", "# Verify\n\n| id | what |\n|---|---|\n| `workspace` | nothing yet |\n");
    write(dir, "verify/workspace.sh", "#!/usr/bin/env bash\nexit 2\n", 0o755);
    if (card) write(dir, `repos/${card}.md`, `# ${card}\n\n> The card for ${card}.\n`);
    return manifest;
}

function inRepo(root, repoName = "acme-app", opts = {}) {
    const repo = path.join(root, repoName);
    const ws = path.join(repo, ".portulan");
    fs.mkdirSync(ws, { recursive: true });
    seedWorkspace(ws, opts);
    return ws;
}

function pointerRepo(root, repoName = "acme-app", governor = "acme") {
    const ws = path.join(root, repoName, ".portulan");
    fs.mkdirSync(ws, { recursive: true });
    write(ws, "workspace.json", json({ portulan: { spec: "2.7" }, name: repoName, summary: "Governed elsewhere.", kind: "pointer", governed_by: { workspace: governor } }));
    write(ws, "README.md", "# This repository's workspace lives elsewhere\n");
    return ws;
}

const readManifest = (dir) => JSON.parse(fs.readFileSync(path.join(dir, "workspace.json"), "utf8"));
const exists = (p) => fs.existsSync(p);

async function green(dir, options = {}) {
    // Pointers resolve against the host, so each call gets an empty one, set last so a caller's `env` cannot undo it.
    const { env: callerEnv, ...rest } = options;
    const { findings } = await inspect(dir, { ...rest, env: { ...callerEnv, CLAUDE_CONFIG_DIR: scratch() } });
    return findings.filter((f) => f.severity === "fail");
}

function governors(repoDir, feedWorkspaceDirs = []) {
    let count = 0;
    const manifest = path.join(repoDir, ".portulan", "workspace.json");
    if (exists(manifest)) {
        try {
            if (JSON.parse(fs.readFileSync(manifest, "utf8")).kind !== "pointer") count += 1;
        } catch {
            // Counted as absent: the tool never leaves an unreadable manifest.
        }
    }
    for (const ws of feedWorkspaceDirs) {
        const m = path.join(ws, "workspace.json");
        if (!exists(m)) continue;
        let parsed;
        try {
            parsed = JSON.parse(fs.readFileSync(m, "utf8"));
        } catch {
            continue;
        }
        if (parsed.kind === "pointer") continue;
        const reposSlot = parsed.slots?.repos;
        if (!reposSlot) continue;
        try {
            if (fs.readdirSync(path.resolve(ws, reposSlot)).includes(`${path.basename(repoDir)}.md`)) count += 1;
        } catch {
            /* no cards directory is no cards */
        }
    }
    return count;
}

// ------------------------------------------------------------------ the command line

describe("parseArgs", () => {
    test("reads the source, the destination and the residence", () => {
        const p = parseArgs(["/src/ws", "--into", "/dst/ws", "--residence", "in-repo"]);
        assert.equal(p.source, "/src/ws");
        assert.equal(p.into, "/dst/ws");
        assert.equal(p.residence, "in-repo");
    });

    test("a value beginning with `-` is a missing value, not a value", () => {
        assert.throws(() => parseArgs(["/src", "--into", "-h"]), (e) => e instanceof VendorError && /needs a value/.test(e.message));
    });

    test("an empty value is refused for every flag", () => {
        assert.throws(() => parseArgs(["/src", "--into", ""]), (e) => e instanceof VendorError && /empty/.test(e.message));
    });

    test("an unknown option names both ways this tool is reachable", () => {
        assert.throws(
            () => parseArgs(["/src", "--nope", "x"]),
            (e) => e instanceof VendorError && /portulan vendor --help/.test(e.message) && /node cli\/vendor\.mjs --help/.test(e.message),
        );
    });

    test("`--pack-root` and `--repo-root` are repeatable and stay separate lists", () => {
        const p = parseArgs(["/src", "--pack-root", "/a", "--pack-root", "/b", "--repo-root", "/c"]);
        assert.deepEqual(p.packRoots, ["/a", "/b"]);
        assert.deepEqual(p.repoRoots, ["/c"]);
    });

    test("more than one source is refused rather than one of them chosen", () => {
        assert.throws(() => parseArgs(["/a", "/b"]), (e) => e instanceof VendorError && /one workspace/.test(e.message));
    });
});

// ------------------------------------------------------------------ the residence, and the two keys that differ

describe("the residence transformation", () => {
    test("residenceOf keys on `tree`, which is the one thing keyed to location", () => {
        assert.equal(residenceOf({ kind: "repository", tree: "../" }), "in-repo");
        assert.equal(residenceOf({ kind: "portfolio" }), "feed-side");
        assert.equal(residenceOf({ kind: "demo" }), "feed-side");
    });

    test("retarget changes exactly two keys and copies the rest untouched", () => {
        const source = { portulan: { spec: "2.7" }, name: "acme", kind: "repository", tree: "../", slots: { identity: "identity.md" }, verify: { default: "x", recipes: [] }, packs: ["rituals/checkpoints"] };
        const feed = retarget(source, "feed-side");
        assert.equal(feed.kind, "portfolio");
        assert.equal("tree" in feed, false);
        assert.deepEqual(feed.slots, source.slots);
        assert.deepEqual(feed.packs, source.packs);
        assert.deepEqual(Object.keys(source).filter((k) => k !== "tree" && k !== "kind"), Object.keys(feed).filter((k) => k !== "kind"));

        const back = retarget(feed, "in-repo");
        assert.equal(back.kind, "repository");
        assert.equal(back.tree, "../");
    });

    test("a `demo` workspace keeps its kind when it moves feed-side", () => {
        assert.equal(retarget({ kind: "demo" }, "feed-side").kind, "demo");
    });

    test("`--kind` overrides the default and refuses `pointer`", () => {
        assert.equal(retarget({ kind: "repository", tree: "../" }, "feed-side", "demo").kind, "demo");
        assert.throws(() => retarget({ kind: "repository" }, "feed-side", "pointer"), (e) => e instanceof VendorError && /pointer/.test(e.message));
    });
});

// ------------------------------------------------------------------ the three rules a writing tool carries

describe("the three refusals `init` and `new` paid for", () => {
    test("an existing file at the destination is refused, not overwritten", async () => {
        const root = scratch();
        const src = path.join(root, "src");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null });
        const dst = path.join(root, "repo", ".portulan");
        write(dst, "identity.md", "# Hand-written. Not yours to replace.\n");

        const h = harness();
        assert.equal(await run([src, "--into", dst, "--residence", "in-repo", "--host", "generic"], h.options), 2);
        assert.match(text(h), /already exist/);
        assert.equal(fs.readFileSync(path.join(dst, "identity.md"), "utf8"), "# Hand-written. Not yours to replace.\n");
    });

    test("a DIRECTORY where a file must be written is refused upfront, not thrown at mid-copy", async () => {
        const root = scratch();
        const src = path.join(root, "src");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null, card: null });
        const dst = path.join(root, "repo", ".portulan");
        fs.mkdirSync(path.join(dst, "identity.md"), { recursive: true });

        const h = harness();
        assert.equal(await run([src, "--into", dst, "--residence", "in-repo", "--host", "generic"], h.options), 2);
        assert.match(text(h), /is a directory, and a file has to be written there/);
        assert.equal(exists(path.join(dst, "workspace.json")), false);
        assert.equal(exists(path.join(root, "repo", "AGENTS.md")), false);
    });

    test("a symlink AT the named destination is refused rather than followed", async () => {
        const root = scratch();
        const src = path.join(root, "src");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null });
        const elsewhere = path.join(root, "elsewhere");
        fs.mkdirSync(elsewhere, { recursive: true });
        const dst = path.join(root, "repo", ".portulan");
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.symlinkSync(elsewhere, dst);

        const h = harness();
        assert.equal(await run([src, "--into", dst, "--residence", "in-repo", "--host", "generic"], h.options), 2);
        assert.match(text(h), /symlink/);
        assert.deepEqual(fs.readdirSync(elsewhere), []);
    });

    test("a symlink BELOW the named destination is refused too", async () => {
        const root = scratch();
        const src = path.join(root, "src");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null });
        const elsewhere = path.join(root, "elsewhere");
        fs.mkdirSync(elsewhere, { recursive: true });
        const dst = path.join(root, "repo", ".portulan");
        fs.mkdirSync(dst, { recursive: true });
        fs.symlinkSync(elsewhere, path.join(dst, "verify"));

        const h = harness();
        assert.equal(await run([src, "--into", dst, "--residence", "in-repo", "--host", "generic"], h.options), 2);
        assert.match(text(h), /symlink/);
        assert.deepEqual(fs.readdirSync(elsewhere), []);
    });

    test("a symlink ABOVE the named destination is resolved, not refused", () => {
        // On macOS `os.tmpdir()` is under `/var`, a link to `/private/var`, so a link above the path must not be refused.
        const root = scratch();
        const real = path.join(root, "real");
        fs.mkdirSync(path.join(real, "repo"), { recursive: true });
        const link = path.join(root, "link");
        fs.symlinkSync(real, link);
        assert.deepEqual(collisions(path.join(link, "repo", ".portulan"), ["workspace.json"]), []);
    });

    test("an unreadable staging path is refused, not treated as clear", async (t) => {
        const root = scratch();
        const src = path.join(root, "feed", "acme");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null, card: null });
        const dst = path.join(root, "repo", ".portulan");
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        const staging = path.join(path.dirname(dst), ".portulan.vendoring");

        const h = harness();
        const original = fs.lstatSync;
        t.mock.method(fs, "lstatSync", (target, ...rest) => {
            if (String(target) === staging) {
                const error = new Error("permission denied");
                error.code = "EACCES";
                throw error;
            }
            return original(target, ...rest);
        });
        assert.equal(await run([src, "--into", dst, "--residence", "in-repo", "--host", "generic"], h.options), 2);
        assert.match(text(h), /could not be examined/);
        assert.match(text(h), /EACCES/);
        assert.equal(exists(dst), false, "an unanswerable question wrote nothing");
    });

    test("a leaf that is neither a file nor a directory is refused, even where the carve-out allows the path", () => {
        // A stub, not `mkfifo`, which needs a shell-out and is not on every runner.
        const fifo = { isSymbolicLink: () => false, isDirectory: () => false, isFile: () => false };
        const found = collisions("/dest", ["README.md"], {
            allow: new Set(["README.md"]),
            lstat: (p) => (String(p) === path.join("/dest", "README.md") ? fifo : { isSymbolicLink: () => false, isDirectory: () => true, isFile: () => false }),
        });
        assert.equal(found.length, 1, "the allow-list must not exempt a thing that is not a file");
        assert.match(found[0].why, /neither a file nor a directory/);
    });

    test("an lstat failure that is not ENOENT is a collision, never an absence", () => {
        // A stub, not chmod: root ignores modes, and CI often runs as root.
        const failing = () => {
            const error = new Error("permission denied");
            error.code = "EACCES";
            throw error;
        };
        const found = collisions("/wherever/.portulan", ["workspace.json"], { lstat: failing });
        assert.equal(found.length, 1);
        assert.match(found[0].why, /EACCES/);
    });

    test("a symlinked SWITCH destination is refused before its manifest is read", async () => {
        const root = scratch();
        const src = path.join(root, "feed", "acme");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { name: "acme", kind: "portfolio", tree: null, card: "acme-app" });
        const elsewhere = pointerRepo(root, "somebody-elses-repo", "acme");
        const dst = path.join(root, "acme-app", ".portulan");
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.symlinkSync(elsewhere, dst);

        const h = harness();
        assert.equal(await run([src, "--into", dst, "--residence", "in-repo", "--switch"], h.options), 2);
        assert.match(text(h), /symlink/);
        assert.doesNotMatch(text(h), /somebody-elses-repo/);
        assert.equal(readManifest(elsewhere).kind, "pointer");
        assert.deepEqual(fs.readdirSync(elsewhere).sort(), ["README.md", "workspace.json"]);
    });

    test("a symlink inside the SOURCE is refused — the read path, not only the write path", async () => {
        const root = scratch();
        const src = path.join(root, "src");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null });
        write(root, "secret/key.txt", "not part of any workspace\n");
        fs.symlinkSync(path.join(root, "secret"), path.join(src, "leak"));

        const h = harness();
        assert.equal(await run([src, "--into", path.join(root, "repo", ".portulan"), "--residence", "in-repo", "--host", "generic"], h.options), 2);
        assert.match(text(h), /symlink/);
        assert.equal(exists(path.join(root, "repo", ".portulan", "leak")), false);
    });

    test("walk refuses a symlink and reports every ordinary file with its mode", () => {
        const root = scratch();
        seedWorkspace(root, { kind: "portfolio", tree: null });
        const files = walk(root);
        assert.ok(files.some((f) => f.rel === "verify/workspace.sh" && (f.mode & 0o111) !== 0));
        assert.ok(files.some((f) => f.rel === "repos/acme-app.md"));
        fs.symlinkSync(root, path.join(root, "loop"));
        assert.throws(() => walk(root), (e) => e instanceof VendorError && /symlink/.test(e.message));
    });
});

// ------------------------------------------------------------------ what cannot be materialised elsewhere

describe("slots that escape the workspace directory", () => {
    test("are refused, because a copy of them dangles", async () => {
        const root = scratch();
        const src = path.join(root, "repo", ".portulan");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { extra: { slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md", repos: "repos/", constitution: "../docs/vision.md" } } });
        write(path.join(root, "repo"), "docs/vision.md", "# Constitution\n");

        const escaping = escapingSlots(readManifest(src), src);
        assert.equal(escaping.length, 1);
        assert.equal(escaping[0].slot, "constitution");

        const h = harness();
        assert.equal(await run([src, "--into", path.join(root, "feed", "acme"), "--residence", "feed-side", "--switch"], h.options), 2);
        assert.match(text(h), /constitution/);
        assert.match(text(h), /outside/);
        assert.equal(exists(path.join(root, "feed", "acme", "workspace.json")), false);
    });
});

// ------------------------------------------------------------------ the scope bound

describe("the scope bound, refused in both its shapes", () => {
    test("a workspace naming more than one repository will not switch", async () => {
        const root = scratch();
        const src = path.join(root, "feed", "sleepy");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { name: "sleepy", kind: "portfolio", tree: null, card: "one" });
        write(src, "repos/two.md", "# two\n");

        for (const argv of [
            [src, "--into", path.join(root, "one", ".portulan"), "--residence", "in-repo", "--switch"],
            [src, "--into", path.join(root, "elsewhere", "sleepy"), "--residence", "feed-side", "--switch"],
        ]) {
            const h = harness();
            assert.equal(await run(argv, h.options), 2);
            assert.match(text(h), /2 repositor/);
            assert.match(text(h), /one, two/);
        }
    });

    test("a switch whose source and destination residences match is refused as not a switch", async () => {
        const root = scratch();
        const src = inRepo(root);
        const h = harness();
        assert.equal(await run([src, "--into", path.join(root, "other", ".portulan"), "--residence", "in-repo", "--switch"], h.options), 2);
        assert.match(text(h), /not a change of residence/);
    });

    test("neither `--switch` nor `--host` is refused rather than guessed at", async () => {
        const root = scratch();
        const src = inRepo(root);
        const h = harness();
        assert.equal(await run([src, "--into", path.join(root, "feed", "acme"), "--residence", "feed-side"], h.options), 2);
        assert.match(text(h), /--switch/);
        assert.match(text(h), /--host/);
    });

    test("options that do nothing are refused rather than accepted and dropped", async () => {
        const root = scratch();
        const src = inRepo(root);
        const h = harness();
        assert.equal(await run([src, "--into", path.join(root, "feed", "acme"), "--residence", "feed-side", "--switch", "--host", "generic"], h.options), 2);
        assert.match(text(h), /--host/);
    });
});

// ------------------------------------------------------------------ job one: vendor into a host

describe("vendoring into a host", () => {
    test("writes a self-contained AGENTS.md + .portulan/, and `doctor` is green on it", async () => {
        const root = scratch();
        const src = path.join(root, "feed", "acme");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null, card: null });
        const host = path.join(root, "host");
        fs.mkdirSync(host, { recursive: true });

        const h = harness();
        assert.equal(await run([src, "--into", path.join(host, ".portulan"), "--residence", "in-repo", "--host", "generic"], h.options), 0);

        assert.ok(exists(path.join(host, "AGENTS.md")), "AGENTS.md lands beside the workspace, at the host root");
        assert.deepEqual(await green(path.join(host, ".portulan")), []);
        assert.equal(readManifest(path.join(host, ".portulan")).kind, "repository");
        assert.equal(readManifest(path.join(host, ".portulan")).tree, "../");
        assert.deepEqual(await green(src), []);
    });

    test("AGENTS.md names only what the manifest actually declares", async () => {
        const manifest = { portulan: { spec: "2.7" }, name: "acme", summary: "One line.", kind: "repository", tree: "../", slots: { identity: "identity.md", gates: "gate-map.md" }, verify: { default: "workspace", recipes: [{ id: "workspace", run: "./verify/workspace.sh" }] } };
        const md = agentsMd(manifest, "generic");
        assert.match(md, /identity\.md/);
        assert.match(md, /gate-map\.md/);
        assert.doesNotMatch(md, /principles\.md/);
        assert.match(md, /workspace/);
        // It names what no copy carries: compiled enforcement, which is `compile`'s output.
        assert.match(md, /compile/);
        // Given no kernel, it says the kernel is not inlined.
        assert.match(md, /not\*\* inlined/);
    });

    test("the engine kernel is inlined, because `core/engine.md` says the CLI composes it", () => {
        const manifest = { portulan: { spec: "2.7" }, name: "acme", kind: "repository", tree: "../", slots: { identity: "identity.md" }, verify: { default: "w", recipes: [] }, packs: ["rituals/checkpoints"] };
        const md = agentsMd(manifest, "generic", fs.readFileSync(path.join(HERE, "..", "core", "engine.md"), "utf8"));
        assert.match(md, /Resolution cascade/, "the kernel's own headings are present, so it is really inlined");
        assert.match(md, /core < pack < workspace/);
        assert.match(md, /rituals\/checkpoints/);
        assert.match(md, /Their files are not here/, "the pack layer is named as NOT composed");
    });

    test("AGENTS.md inherits the guidance's tiers: always inline, the rest as one-line pointers", async () => {
        const root = scratch();
        const src = path.join(root, "feed", "acme");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null, card: null, extra: { portulan: { spec: "2.10" } } });
        const manifest = readManifest(src);
        manifest.slots.context = "context/";
        write(src, "workspace.json", json(manifest));
        write(src, "context/conventions.md", "---\ntier: always\n---\n\n# Conventions\n\nTest first.\n");
        write(src, "context/api.md", '---\ntier: on-path\npaths: ["api/**"]\ndescription: Handlers.\n---\n\n# API\n\nValidate.\n');
        const host = path.join(root, "host");
        fs.mkdirSync(host, { recursive: true });
        assert.equal(await run([src, "--into", path.join(host, ".portulan"), "--residence", "in-repo", "--host", "generic"], harness().options), 0);
        const md = fs.readFileSync(path.join(host, "AGENTS.md"), "utf8");
        assert.match(md, /## Guidance\n\n# Conventions\n\nTest first\.\n/);
        assert.match(md, /^- `\.portulan\/context\/api\.md`: when you work on `api\/\*\*`\. Handlers\.$/m);
        assert.doesNotMatch(md, /Validate\./, "an on-path unit's guidance is pointed at, not inlined");
        assert.deepEqual(await green(path.join(host, ".portulan")), []);
    });

    test("an always unit's import rides in AGENTS.md as a pointer to the vendored file, and one leaving the workspace stops the vendoring", async () => {
        const root = scratch();
        const src = path.join(root, "feed", "acme");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null, card: null, extra: { portulan: { spec: "2.10" } } });
        const manifest = readManifest(src);
        manifest.slots.context = "context/";
        write(src, "workspace.json", json(manifest));
        write(src, "context/boot.md", "---\ntier: always\n---\n\n# Portulan boot card\n\nWho we are:\n\n@../identity.md\n");
        const host = path.join(root, "host");
        fs.mkdirSync(host, { recursive: true });
        assert.equal(await run([src, "--into", path.join(host, ".portulan"), "--residence", "in-repo", "--host", "generic"], harness().options), 0);
        const md = fs.readFileSync(path.join(host, "AGENTS.md"), "utf8");
        assert.match(md, /# Portulan boot card\n\nWho we are:\n\n- `\.portulan\/identity\.md`: read it in full — a host that follows imports loads it here\.\n/);
        assert.ok(exists(path.join(host, ".portulan", "identity.md")), "the file the pointer names is in the vendored tree");

        write(root, "feed/outside.md", "Outside.\n");
        write(src, "context/boot.md", "---\ntier: always\n---\n\n# Portulan boot card\n\n@../../outside.md\n");
        const again = path.join(root, "again");
        fs.mkdirSync(again, { recursive: true });
        const h = harness();
        assert.equal(await run([src, "--into", path.join(again, ".portulan"), "--residence", "in-repo", "--host", "generic"], h.options), 2);
        assert.match(text(h), /`@\.\.\/\.\.\/outside\.md` \(in context\/boot\.md\) leaves .+, the tree compiled here/);
        assert.ok(!exists(path.join(again, "AGENTS.md")));
        assert.ok(!exists(path.join(again, ".portulan")));
    });

    test("a unit `compile` would refuse stops the vendoring before anything is written", async () => {
        const root = scratch();
        const src = path.join(root, "feed", "acme");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null, card: null, extra: { portulan: { spec: "2.10" } } });
        const manifest = readManifest(src);
        manifest.slots.context = "context/";
        write(src, "workspace.json", json(manifest));
        write(src, "context/bad.md", "---\ntier: sometimes\n---\n\nA.\n");
        const host = path.join(root, "host");
        fs.mkdirSync(host, { recursive: true });
        const h = harness();
        assert.equal(await run([src, "--into", path.join(host, ".portulan"), "--residence", "in-repo", "--host", "generic"], h.options), 2);
        assert.match(text(h), /context\/bad\.md: `tier` is "sometimes"/);
        assert.ok(!exists(path.join(host, "AGENTS.md")));
        assert.ok(!exists(path.join(host, ".portulan")));
    });

    test("a slot in .claude/, which the copy never carries, stops the vendoring before anything is written", async () => {
        const root = scratch();
        const src = path.join(root, "feed", "acme");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null, card: null, extra: { portulan: { spec: "2.10" } } });
        const manifest = readManifest(src);
        manifest.slots.context = ".claude/context/";
        write(src, "workspace.json", json(manifest));
        write(src, ".claude/context/api.md", '---\ntier: on-path\npaths: ["api/**"]\ndescription: Handlers.\n---\n\nValidate.\n');
        const host = path.join(root, "host");
        fs.mkdirSync(host, { recursive: true });
        const h = harness();
        assert.equal(await run([src, "--into", path.join(host, ".portulan"), "--residence", "in-repo", "--host", "generic"], h.options), 2);
        assert.match(text(h), /lies in a directory `compile` writes into/);
        assert.ok(!exists(path.join(host, "AGENTS.md")));
        assert.ok(!exists(path.join(host, ".portulan")));
    });

    test("the vendored tree really carries the kernel, end to end", async () => {
        const root = scratch();
        const src = path.join(root, "feed", "acme");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null, card: null });
        const host = path.join(root, "host");
        fs.mkdirSync(host, { recursive: true });
        assert.equal(await run([src, "--into", path.join(host, ".portulan"), "--residence", "in-repo", "--host", "generic"], harness().options), 0);
        assert.match(fs.readFileSync(path.join(host, "AGENTS.md"), "utf8"), /Resolution cascade/);
    });

    test("a failure after AGENTS.md moves leaves no AGENTS.md behind", async (t) => {
        const root = scratch();
        const src = path.join(root, "feed", "acme");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null, card: null });
        const host = path.join(root, "host");
        fs.mkdirSync(host, { recursive: true });

        const h = harness();
        const original = fs.renameSync;
        t.mock.method(fs, "renameSync", (from, to, ...rest) => {
            if (String(to) === path.join(host, ".portulan")) {
                const error = new Error("cross-device link not permitted");
                error.code = "EXDEV";
                throw error;
            }
            return original(from, to, ...rest);
        });
        assert.equal(await run([src, "--into", path.join(host, ".portulan"), "--residence", "in-repo", "--host", "generic"], h.options), 2);
        assert.equal(exists(path.join(host, "AGENTS.md")), false, "a failed vendoring must leave no artifact");
        assert.equal(exists(path.join(host, ".portulan")), false);
        assert.deepEqual(fs.readdirSync(host), [], "and no staging directory either");
    });

    test("refuses `--host` feed-side, because the standards file it writes would name paths that do not exist", async () => {
        const root = scratch();
        const src = path.join(root, "repo", ".portulan");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { card: null });
        const h = harness();
        assert.equal(await run([src, "--into", path.join(root, "feed", "acme"), "--residence", "feed-side", "--host", "generic"], h.options), 2);
        assert.match(text(h), /--residence in-repo/);
        assert.equal(exists(path.join(root, "feed")), false, "a refusal writes nothing");
    });

    test("refuses a host tree that already carries a residence", async () => {
        const root = scratch();
        const src = path.join(root, "feed", "acme");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null, card: null });
        const host = path.join(root, "host");
        pointerRepo(root, "host", "somebody-else");

        const h = harness();
        assert.equal(await run([src, "--into", path.join(host, ".portulan"), "--residence", "in-repo", "--host", "generic"], h.options), 2);
        assert.match(text(h), /already exist/);
    });
});

// ------------------------------------------------------------------ job two: the switch, both directions

describe("an empty declared slot directory", () => {
    const withEmptySlot = (dir, name = "acme", kind = "portfolio") => {
        const manifest = {
            portulan: { spec: "2.7" },
            name,
            summary: "A workspace with a slot nobody has filled yet.",
            kind,
            slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md", memory: "memory/" },
            verify: { default: "workspace", recipes: [{ id: "workspace", run: "./verify/workspace.sh", requires: ["bash"], doc: "identity.md" }] },
            memory: { index: { path: "memory-index.md" } },
        };
        write(dir, "workspace.json", json(manifest));
        for (const f of ["identity.md", "principles.md", "gate-map.md", "memory-index.md"]) write(dir, f, `# ${f}\n`);
        write(dir, "verify/workspace.sh", "#!/usr/bin/env bash\nexit 0\n", 0o755);
        fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
        return dir;
    };

    test("`directories` reports it, where `walk` cannot", () => {
        const root = scratch();
        withEmptySlot(root);
        assert.equal(walk(root).some((f) => f.rel.startsWith("memory/")), false, "there is no file to find — that is the whole problem");
        assert.ok(directories(root).some((d) => d.rel === "memory"), "the directory itself has to be carried");
    });

    test("survives the switch in both directions, and both ends stay green", async () => {
        const root = scratch();
        const feed = path.join(root, "feed", "acme");
        fs.mkdirSync(feed, { recursive: true });
        withEmptySlot(feed);
        assert.deepEqual(await green(feed), [], "the fixture must be green at its source, or this test proves nothing");

        const dst = pointerRepo(root, "acme-app", "acme");
        assert.equal(await run([feed, "--into", dst, "--residence", "in-repo", "--switch"], harness().options), 0);
        assert.ok(fs.statSync(path.join(dst, "memory")).isDirectory(), "the empty slot arrived");
        assert.deepEqual(await green(dst), []);

        // The return leg lands on an existing destination, the other copy path.
        const back = path.join(root, "feed2", "acme");
        assert.equal(await run([dst, "--into", back, "--residence", "feed-side", "--switch", "--leave", "nothing"], harness().options), 0);
        assert.ok(fs.statSync(path.join(back, "memory")).isDirectory(), "and survived the way home");
        assert.deepEqual(await green(back), []);
    });

    test("vendoring into a host carries it too", async () => {
        const root = scratch();
        const src = path.join(root, "feed", "acme");
        fs.mkdirSync(src, { recursive: true });
        withEmptySlot(src);
        const host = path.join(root, "host");
        fs.mkdirSync(host, { recursive: true });
        assert.equal(await run([src, "--into", path.join(host, ".portulan"), "--residence", "in-repo", "--host", "generic"], harness().options), 0);
        assert.ok(fs.statSync(path.join(host, ".portulan", "memory")).isDirectory());
        assert.deepEqual(await green(path.join(host, ".portulan")), []);
    });
});

describe("the switch, in-repo → feed-side", () => {
    test("materialises feed-side, leaves a pointer, and both ends are green", async () => {
        const root = scratch();
        const src = inRepo(root, "acme-app");
        const repo = path.dirname(src);
        const feed = path.join(root, "feed", "acme");

        const h = harness();
        assert.equal(await run([src, "--into", feed, "--residence", "feed-side", "--switch", "--repo-root", root], h.options), 0);

        const moved = readManifest(feed);
        assert.equal(moved.kind, "portfolio");
        assert.equal("tree" in moved, false);
        assert.ok(exists(path.join(feed, "verify", "workspace.sh")));
        assert.ok(exists(path.join(feed, "repos", "acme-app.md")));

        const left = readManifest(src);
        assert.equal(left.kind, "pointer");
        assert.equal(left.governed_by.workspace, "acme");

        // `repoRoots` is what lets `doctor`'s cross-repository check look at anything.
        assert.deepEqual(await green(feed, { repoRoots: [root] }), []);
        assert.deepEqual(await green(src), []);
        assert.equal(governors(repo, [feed]), 1);

        assert.equal(exists(path.join(src, "identity.md")), false);
        assert.equal(exists(path.join(src, "verify")), false);
    });

    test("the executable bit survives the move", async () => {
        const root = scratch();
        const src = inRepo(root, "acme-app");
        assert.equal(await run([src, "--into", path.join(root, "feed", "acme"), "--residence", "feed-side", "--switch"], harness().options), 0);
        assert.notEqual(fs.statSync(path.join(root, "feed", "acme", "verify", "workspace.sh")).mode & 0o111, 0);
    });

    test("a file the old residence holds that the switch did not move is left and named", async () => {
        const root = scratch();
        const src = inRepo(root, "acme-app");
        // A file landing after the walk cannot be staged from here, so this holds only what `--leave pointer` leaves.
        const h = harness();
        assert.equal(await run([src, "--into", path.join(root, "feed", "acme"), "--residence", "feed-side", "--switch", "--leave", "pointer"], h.options), 0);
        assert.deepEqual(fs.readdirSync(src).sort(), ["README.md", "workspace.json"]);
    });

    test("compiled enforcement does not travel, and is retired with the residence that produced it", async () => {
        const root = scratch();
        const src = inRepo(root, "acme-app");
        write(src, ".claude/settings.json", '{"hooks":{}}\n');
        write(src, "compile/github-ruleset.json", '{"name":"x"}\n');
        const feed = path.join(root, "feed", "acme");

        const h = harness();
        assert.equal(await run([src, "--into", feed, "--residence", "feed-side", "--switch"], h.options), 0);
        assert.equal(exists(path.join(feed, ".claude", "settings.json")), false, "the settings did not travel");
        assert.equal(exists(path.join(feed, "compile", "github-ruleset.json")), false, "nor did the ruleset");
        assert.equal(exists(path.join(src, ".claude")), false);
        assert.equal(exists(path.join(src, "compile")), false);
        assert.match(text(h), /compiled artifact/);
        assert.match(text(h), /nothing here writes outside/);
    });

    test("`--leave nothing` does NOT delete an old residence it could not scan", async (t) => {
        const root = scratch();
        const src = inRepo(root, "acme-app");
        const feed = path.join(root, "feed", "acme");
        const keep = path.join(src, "hand-written.md");
        fs.writeFileSync(keep, "# mine\n");

        const h = harness();
        const original = fs.readdirSync;
        // Keyed on state, not a call count: once the new manifest exists, every read of the source is the retire scan.
        t.mock.method(fs, "readdirSync", (target, ...rest) => {
            if (String(target) === src && fs.existsSync(path.join(feed, "workspace.json"))) {
                const error = new Error("permission denied");
                error.code = "EACCES";
                throw error;
            }
            return original(target, ...rest);
        });
        assert.equal(await run([src, "--into", feed, "--residence", "feed-side", "--switch", "--leave", "nothing"], h.options), 0);

        assert.ok(exists(keep), "a file the run could not account for must survive");
        assert.match(text(h), /could NOT be scanned/);
        assert.match(text(h), /nothing there was removed/);
        assert.equal(exists(path.join(src, "workspace.json")), false);
        assert.equal(governors(path.dirname(src), [feed]), 1);
    });

    test("`--leave nothing` removes the old residence entirely", async () => {
        const root = scratch();
        const src = inRepo(root, "acme-app");
        const feed = path.join(root, "feed", "acme");

        const h = harness();
        assert.equal(await run([src, "--into", feed, "--residence", "feed-side", "--switch", "--leave", "nothing", "--repo-root", root], h.options), 0);
        assert.equal(exists(src), false);
        assert.deepEqual(await green(feed, { repoRoots: [root] }), []);
        assert.equal(governors(path.dirname(src), [feed]), 1);
    });
});

describe("the switch, feed-side → in-repo", () => {
    test("materialises in-repo over the pointer, and retires the feed slot", async () => {
        const root = scratch();
        const feed = path.join(root, "feed", "acme");
        fs.mkdirSync(feed, { recursive: true });
        seedWorkspace(feed, { name: "acme", kind: "portfolio", tree: null, card: "acme-app" });
        const dst = pointerRepo(root, "acme-app", "acme");
        const repo = path.dirname(dst);

        const h = harness();
        assert.equal(await run([feed, "--into", dst, "--residence", "in-repo", "--switch", "--repo-root", root], h.options), 0);

        const landed = readManifest(dst);
        assert.equal(landed.kind, "repository");
        assert.equal(landed.tree, "../");
        assert.ok(exists(path.join(dst, "verify", "workspace.sh")));
        assert.deepEqual(await green(dst), []);

        const retired = readManifest(feed);
        assert.equal(retired.kind, "pointer");
        assert.equal(retired.governed_by.workspace, "acme");
        assert.deepEqual(await green(feed), []);
        assert.equal(governors(repo, [feed]), 1);

        assert.doesNotMatch(fs.readFileSync(path.join(dst, "README.md"), "utf8"), /lives elsewhere/);
    });

    test("a symlinked pointer README is refused — the file the switch SYNTHESISES, not one it copies", async () => {
        const root = scratch();
        const feed = path.join(root, "feed", "acme");
        fs.mkdirSync(feed, { recursive: true });
        seedWorkspace(feed, { name: "acme", kind: "portfolio", tree: null, card: "acme-app" });
        assert.equal(walk(feed).some((f) => f.rel === "README.md"), false, "the source must carry none, or nothing is synthesised");

        const dst = pointerRepo(root, "acme-app", "acme");
        const outside = path.join(root, "outside.md");
        fs.writeFileSync(outside, "# not yours to write\n");
        fs.rmSync(path.join(dst, "README.md"));
        fs.symlinkSync(outside, path.join(dst, "README.md"));

        const h = harness();
        assert.equal(await run([feed, "--into", dst, "--residence", "in-repo", "--switch"], h.options), 2);
        assert.match(text(h), /symlink/);
        assert.equal(fs.readFileSync(outside, "utf8"), "# not yours to write\n", "nothing was written through the link");
        assert.equal(readManifest(dst).kind, "pointer", "and the switch did not begin");
    });

    test("a SOURCE directory named README.md is refused before the write that would throw on it", async () => {
        const root = scratch();
        const feed = path.join(root, "feed", "acme");
        fs.mkdirSync(feed, { recursive: true });
        seedWorkspace(feed, { name: "acme", kind: "portfolio", tree: null, card: "acme-app" });
        fs.mkdirSync(path.join(feed, "README.md"), { recursive: true });
        write(feed, "README.md/notes.md", "# inside a directory called README.md\n");
        const dst = pointerRepo(root, "acme-app", "acme");

        const h = harness();
        assert.equal(await run([feed, "--into", dst, "--residence", "in-repo", "--switch"], h.options), 2);
        assert.match(text(h), /DIRECTORY named/);
        assert.doesNotMatch(text(h), /unanticipated/, "a known shape must not surface as an unanticipated failure");
        assert.equal(readManifest(dst).kind, "pointer", "and nothing began");
    });

    test("a destination pointer naming a DIFFERENT governor is a foreign residence and is refused", async () => {
        const root = scratch();
        const feed = path.join(root, "feed", "acme");
        fs.mkdirSync(feed, { recursive: true });
        seedWorkspace(feed, { name: "acme", kind: "portfolio", tree: null });
        const dst = pointerRepo(root, "acme-app", "somebody-else");

        const h = harness();
        assert.equal(await run([feed, "--into", dst, "--residence", "in-repo", "--switch"], h.options), 2);
        assert.match(text(h), /somebody-else/);
        assert.equal(readManifest(dst).kind, "pointer");
    });

    test("a destination holding anything beyond a pointer is refused", async () => {
        const root = scratch();
        const feed = path.join(root, "feed", "acme");
        fs.mkdirSync(feed, { recursive: true });
        seedWorkspace(feed, { name: "acme", kind: "portfolio", tree: null });
        const dst = pointerRepo(root, "acme-app", "acme");
        write(dst, "notes.md", "# mine\n");

        const h = harness();
        assert.equal(await run([feed, "--into", dst, "--residence", "in-repo", "--switch"], h.options), 2);
        assert.match(text(h), /notes\.md/);
    });
});

// ------------------------------------------------------------------ the ordering, forced rather than read

// No POSIX call changes two manifests at once, so between the two renames two workspaces govern: the window.
describe("the ordering, and what a failure at each step leaves behind", () => {
    const faults = ["materialise:files", "materialise:manifest", "retire:manifest", "retire:material"];

    for (const at of faults) {
        test(`in-repo → feed-side: a failure after \`${at}\` leaves exactly one governor`, async () => {
            const root = scratch();
            const src = inRepo(root, "acme-app");
            const repo = path.dirname(src);
            const feed = path.join(root, "feed", "acme");

            const h = harness();
            const code = await run([src, "--into", feed, "--residence", "feed-side", "--switch"], { ...h.options, faultAt: at });
            assert.equal(code, 2);
            assert.equal(governors(repo, [feed]), 1, `two coordinates, one governor, after a failure at ${at}`);
        });

        test(`feed-side → in-repo: a failure after \`${at}\` leaves exactly one governor`, async () => {
            const root = scratch();
            const feed = path.join(root, "feed", "acme");
            fs.mkdirSync(feed, { recursive: true });
            seedWorkspace(feed, { name: "acme", kind: "portfolio", tree: null, card: "acme-app" });
            const dst = pointerRepo(root, "acme-app", "acme");

            const h = harness();
            const code = await run([feed, "--into", dst, "--residence", "in-repo", "--switch"], { ...h.options, faultAt: at });
            assert.equal(code, 2);
            assert.equal(governors(path.dirname(dst), [feed]), 1, `two coordinates, one governor, after a failure at ${at}`);
        });
    }

    test("the manifest is written LAST, so a half-materialised destination is not a residence", async () => {
        const root = scratch();
        const src = inRepo(root, "acme-app");
        const feed = path.join(root, "feed", "acme");
        await run([src, "--into", feed, "--residence", "feed-side", "--switch"], { ...harness().options, faultAt: "materialise:files" });
        assert.equal(exists(path.join(feed, "workspace.json")), false, "no manifest, so not a residence");
        assert.equal(readManifest(src).kind, "repository", "the old residence still governs, untouched");
    });

    test("the manifest is retired FIRST, so cleanup can fail without minting a second governor", async () => {
        const root = scratch();
        const src = inRepo(root, "acme-app");
        const feed = path.join(root, "feed", "acme");
        await run([src, "--into", feed, "--residence", "feed-side", "--switch"], { ...harness().options, faultAt: "retire:manifest" });
        assert.equal(readManifest(src).kind, "pointer", "governance has already moved");
        assert.equal(governors(path.dirname(src), [feed]), 1);
    });

    test("a failed manifest retirement leaves no `.vendoring` temp file behind", async (t) => {
        const root = scratch();
        const src = inRepo(root, "acme-app");
        const feed = path.join(root, "feed", "acme");

        const h = harness();
        const original = fs.renameSync;
        t.mock.method(fs, "renameSync", (from, to, ...rest) => {
            if (String(to) === path.join(src, "workspace.json")) {
                const error = new Error("cross-device link not permitted");
                error.code = "EXDEV";
                throw error;
            }
            return original(from, to, ...rest);
        });
        assert.equal(await run([src, "--into", feed, "--residence", "feed-side", "--switch"], h.options), 2);
        assert.equal(exists(path.join(src, "workspace.json.vendoring")), false, "no temp file survives a failed retirement");
        assert.equal(readManifest(src).kind, "repository");
        assert.equal(governors(path.dirname(src), [feed]), 1);
    });

    test("a rolled-back switch does not wedge its own retry", async () => {
        const root = scratch();
        const feed = path.join(root, "feed", "acme");
        fs.mkdirSync(feed, { recursive: true });
        seedWorkspace(feed, { name: "acme", kind: "portfolio", tree: null, card: "acme-app" });
        const dst = pointerRepo(root, "acme-app", "acme");
        const before = fs.readdirSync(dst).sort();

        const h = harness();
        assert.equal(await run([feed, "--into", dst, "--residence", "in-repo", "--switch"], { ...h.options, faultAt: "materialise:manifest" }), 2);
        assert.deepEqual(fs.readdirSync(dst).sort(), before, "the destination is restored entry for entry, not only file for file");

        const again = harness();
        assert.equal(await run([feed, "--into", dst, "--residence", "in-repo", "--switch"], again.options), 0);
        assert.deepEqual(await green(dst), []);
    });

    test("a red `doctor` at the new residence rolls back and never opens the window", async () => {
        // Forced by a `verify.default` naming no recipe: with no `tree`, an unresolvable pack is only unverifiable.
        const root = scratch();
        const src = inRepo(root, "acme-app", { extra: { verify: { default: "nope", recipes: [{ id: "workspace", run: "./verify/workspace.sh", requires: ["bash"], doc: "verify/README.md" }] } } });
        const feed = path.join(root, "feed", "acme");

        const h = harness();
        assert.equal(await run([src, "--into", feed, "--residence", "feed-side", "--switch"], h.options), 1);
        assert.match(text(h), /nope/);
        assert.equal(readManifest(src).kind, "repository", "the old residence still governs");
        assert.equal(exists(path.join(feed, "workspace.json")), false, "nothing governs from the new one");
        assert.equal(governors(path.dirname(src), [feed]), 1);
    });

    test("the recovery sentence points at the end that can actually SEE two governors", async () => {
        const root = scratch();
        const src = inRepo(root, "acme-app");
        const feed = path.join(root, "feed", "acme");

        const a = harness();
        await run([src, "--into", feed, "--residence", "feed-side", "--switch"], { ...a.options, faultAt: "materialise:manifest" });
        assert.match(text(a), new RegExp(`doctor ${feed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), "feed-side destination: the naming workspace is `dest`");

        const feed2 = path.join(root, "feed2", "acme");
        fs.mkdirSync(feed2, { recursive: true });
        seedWorkspace(feed2, { name: "acme", kind: "portfolio", tree: null, card: "other-app" });
        const dst = pointerRepo(root, "other-app", "acme");
        const b = harness();
        await run([feed2, "--into", dst, "--residence", "in-repo", "--switch"], { ...b.options, faultAt: "materialise:manifest" });
        assert.match(text(b), new RegExp(`doctor ${feed2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), "in-repo destination: the naming workspace is the `source` being moved out of");

        // Built afresh: the rollbacks above removed their destinations.
        const both = scratch();
        const repo = inRepo(both, "acme-app");
        const naming = path.join(both, "feed", "acme");
        fs.mkdirSync(naming, { recursive: true });
        seedWorkspace(naming, { name: "acme", kind: "portfolio", tree: null, card: "acme-app" });
        const fromNaming = await green(naming, { repoRoots: [both] });
        assert.ok(fromNaming.some((f) => /governed by exactly one workspace/.test(f.message)), `the feed-side end must REFUSE two governors; got ${JSON.stringify(fromNaming)}`);
        assert.deepEqual(await green(repo, { repoRoots: [both] }), [], "the in-repo end sees only itself — visibility is one-way");
    });

    test("the recovery sentence is printed BEFORE the window opens, and names the `--repo-root` form", async () => {
        const root = scratch();
        const src = inRepo(root, "acme-app");
        const feed = path.join(root, "feed", "acme");
        const h = harness();
        await run([src, "--into", feed, "--residence", "feed-side", "--switch"], { ...h.options, faultAt: "materialise:manifest" });
        assert.match(text(h), /--repo-root/);
        assert.match(text(h), /ONLY if it reports two governors/);
        assert.match(text(h), /delete nothing/);
    });
});

// ------------------------------------------------------------------ the rest of the surface

describe("the surface", () => {
    test("`--dry-run` prints the plan and writes nothing", async () => {
        const root = scratch();
        const src = inRepo(root, "acme-app");
        const feed = path.join(root, "feed", "acme");
        const h = harness();
        assert.equal(await run([src, "--into", feed, "--residence", "feed-side", "--switch", "--dry-run"], h.options), 0);
        assert.equal(exists(feed), false);
        assert.equal(readManifest(src).kind, "repository");
        assert.match(text(h), /identity\.md/);
    });

    test("`--help` exits 0 and names the two jobs", async () => {
        const h = harness();
        assert.equal(await run(["--help"], h.options), 0);
        assert.match(text(h), /--switch/);
        assert.match(text(h), /--host/);
    });

    test("no arguments is could-not-run, never a silent success", async () => {
        const h = harness();
        assert.equal(await run([], h.options), 2);
    });

    test("a source that is not a workspace is could-not-run and says which file is missing", async () => {
        const root = scratch();
        fs.mkdirSync(path.join(root, "empty"), { recursive: true });
        const h = harness();
        assert.equal(await run([path.join(root, "empty"), "--into", path.join(root, "x"), "--residence", "feed-side", "--switch"], h.options), 2);
        assert.match(text(h), /workspace\.json/);
    });

    test("the entry point dispatches `vendor` and returns its code untouched", async () => {
        const { run: dispatch, find } = await import("./portulan.mjs");
        assert.equal(find("vendor").module, "vendor.mjs");
        const h = harness();
        assert.equal(await dispatch(["vendor", "--help"], h.options), 0);
    });
});

// ------------------------------------------------------------------ parity, exercised rather than asserted

describe("parity across residences", () => {
    test("the same workspace, both residences, the same operations, no functionality difference", async () => {
        const root = scratch();
        const src = inRepo(root, "acme-app");
        const repo = path.dirname(src);
        const feed = path.join(root, "feed", "acme");

        const before = await inspect(src, {});
        assert.equal(await run([src, "--into", feed, "--residence", "feed-side", "--switch", "--repo-root", root], harness().options), 0);
        const after = await inspect(feed, { repoRoots: [root] });

        assert.deepEqual(before.findings.filter((f) => f.severity === "fail"), []);
        assert.deepEqual(after.findings.filter((f) => f.severity === "fail"), []);
        assert.deepEqual(Object.keys(before.workspace.slots), Object.keys(after.workspace.slots));
        assert.deepEqual(before.workspace.verify.recipes.map((r) => r.id), after.workspace.verify.recipes.map((r) => r.id));
        assert.equal(before.workspace.verify.default, after.workspace.verify.default);

        assert.equal(await run([feed, "--into", src, "--residence", "in-repo", "--switch", "--repo-root", root], harness().options), 0);
        const returned = await inspect(src, {});
        assert.deepEqual(returned.findings.filter((f) => f.severity === "fail"), []);
        assert.deepEqual(Object.keys(returned.workspace.slots), Object.keys(before.workspace.slots));
        assert.equal(returned.workspace.kind, "repository");
        assert.equal(returned.workspace.tree, "../");
        assert.equal(governors(repo, [feed]), 1);
    });
});

test("`env` reaches `doctor` through `verdict`, at BOTH ends of the switch", async () => {
    const packInHost = () => {
        const config = scratch();
        const installPath = path.join(config, "plugins", "cache", "feed", "carrier", "0.1.0");
        const packDir = path.join(installPath, "rituals", "checkpoints");
        fs.mkdirSync(packDir, { recursive: true });
        write(packDir, "pack.json", json({ portulan: { pack: "1.0", version: "0.1.0" }, name: "checkpoints", category: "rituals", summary: "x", doc: "README.md", contributes: {} }));
        write(packDir, "README.md", "# x\n");
        const record = path.join(config, "plugins", "installed_plugins.json");
        fs.mkdirSync(path.dirname(record), { recursive: true });
        write(path.dirname(record), "installed_plugins.json", json({ version: 2, plugins: { "carrier@feed": [{ scope: "user", installPath, version: "0.1.0" }] } }));
        return { CLAUDE_CONFIG_DIR: config };
    };

    // A source workspace composing a pack that exists in NO tree — so only a host can answer for it.
    const stage = (env) => {
        const root = scratch();
        const src = inRepo(root, "acme-app", { extra: { packs: ["rituals/checkpoints"] } });
        const h = harness();
        // `--into` must end in `.portulan` for an in-repo residence, or the tool refuses before discovery matters.
        return run([src, "--into", path.join(root, "vendored", ".portulan"), "--residence", "in-repo", "--host", "generic"], { ...h.options, ...(env ? { env } : {}) }).then((code) => ({ code, said: text(h) }));
    };

    const carrying = await stage(packInHost());
    assert.equal(carrying.code, 0, carrying.said);

    // The control: an empty host cannot answer for the pack, so `doctor` fails it.
    const empty = await stage({ CLAUDE_CONFIG_DIR: scratch() });
    assert.equal(empty.code, 1, empty.said);
    assert.match(empty.said, /rituals\/checkpoints/);
});

test("vendor refuses a named root combined with `--pack-root auto`", async () => {
    const h = harness();
    const src = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "vendor-bothroots-"));
    SCRATCH.push(src);
    assert.equal(await run([src, "--host", "generic", "--pack-root", "auto", "--pack-root", src], h.options), 2);
    assert.match(text(h), /never both/);
});

// ------------------------------------------------------------------ the new form, carried

describe("the new form, carried by vendor", () => {
    function carded(root, extra = {}) {
        const src = path.join(root, "feed", "acme");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null, card: null, extra: { portulan: { spec: "2.10" }, ...extra } });
        const manifest = readManifest(src);
        manifest.slots.context = "context/";
        write(src, "workspace.json", json(manifest));
        write(src, "context/boot.md", `---\ntier: always\n---\n\n# Portulan boot card\n\n## Reading\n\n${READING_LINE}\n\n## Identity\n\n@../identity.md\n`);
        return src;
    }

    test("with a card, AGENTS.md leads with it, and the slots follow as files to open", async () => {
        const root = scratch();
        const src = carded(root);
        const host = path.join(root, "host");
        fs.mkdirSync(host, { recursive: true });
        assert.equal(await run([src, "--into", path.join(host, ".portulan"), "--residence", "in-repo", "--host", "generic"], harness().options), 0);
        const md = fs.readFileSync(path.join(host, "AGENTS.md"), "utf8");
        const card = md.indexOf("# Portulan boot card");
        const files = md.indexOf("## The workspace's files, opened when the card or the task sends you to one");
        assert.ok(card !== -1 && files > card, "the card comes first, and the slots after it");
        assert.doesNotMatch(md, /## Read these, in this order/, "a carded boot reads no slot in order");
        assert.doesNotMatch(md, /## Guidance/, "the card is not carried twice");
        assert.match(md, /^- \*\*`\.portulan\/context\/`\*\* — this team's guidance: the card above is its boot\.$/m);
        assert.deepEqual(await green(path.join(host, ".portulan")), []);
        const { findings } = await inspect(path.join(host, ".portulan"), { env: { CLAUDE_CONFIG_DIR: scratch() } });
        const form = findings.find((f) => f.check === "form");
        assert.match(form.message, /a boot card at the head of AGENTS\.md, which this host reads/, "a host that reads AGENTS.md boots from the card there, with no rules to compile");
        assert.doesNotMatch(form.message, /upgrade --write/);
    });

    test("a card carrying the engine's rules says the package their command runs from is not in this copy", async () => {
        const root = scratch();
        const src = carded(root);
        const host = path.join(root, "host");
        fs.mkdirSync(host, { recursive: true });
        const h = harness();
        assert.equal(await run([src, "--into", path.join(host, ".portulan"), "--residence", "in-repo", "--host", "generic"], h.options), 0, text(h));
        const md = fs.readFileSync(path.join(host, "AGENTS.md"), "utf8");
        assert.match(md, /`node <plugin root>\/cli\/symbols\.mjs <file>`/);
        assert.match(md, /^- \*\*The Portulan package\.\*\* The card's `<plugin root>` is where it is installed, which this copy is not\.$/m);
    });

    test("without a card, the slots are read in order, as before", () => {
        const manifest = { portulan: { spec: "2.7" }, name: "acme", kind: "repository", tree: "../", slots: { identity: "identity.md" }, verify: { default: "w", recipes: [] } };
        assert.match(agentsMd(manifest, "generic"), /## Read these, in this order/);
        assert.doesNotMatch(agentsMd(manifest, "generic"), /The Portulan package/, "no card, no command from the package, nothing said of it");
    });

    test("the host's tree gets the fragments directory and the index's ignore line, and keeps its own", async () => {
        const root = scratch();
        const src = carded(root, { handoffs: { index: { path: "handoffs-index.md" } } });
        write(src, "handoffs/.gitkeep", "");
        const manifest = readManifest(src);
        manifest.slots.handoffs = "handoffs/";
        write(src, "workspace.json", json(manifest));

        const host = path.join(root, "host");
        write(host, ".gitignore", "dist/\n");
        const h = harness();
        assert.equal(await run([src, "--into", path.join(host, ".portulan"), "--residence", "in-repo", "--host", "generic"], h.options), 0, text(h));
        assert.match(fs.readFileSync(path.join(host, "changes", "README.md"), "utf8"), /^# Changelog fragments$/m);
        assert.match(fs.readFileSync(path.join(host, ".gitignore"), "utf8"), /^dist\/\n\n# The handoff index is printed on demand[\s\S]*^\/\.portulan\/handoffs-index\.md$/m);
        assert.match(text(h), /the records the new form keeps, beside it: `changes\/README\.md`, `\.gitignore`/);

        const second = path.join(root, "second");
        write(second, "changes/README.md", "ours\n");
        const h2 = harness();
        assert.equal(await run([src, "--into", path.join(second, ".portulan"), "--residence", "in-repo", "--host", "generic"], h2.options), 0, text(h2));
        assert.equal(fs.readFileSync(path.join(second, "changes", "README.md"), "utf8"), "ours\n");
        assert.match(text(h2), /left as they are: `changes\/README\.md` is the tree's own/);
    });

    test("a switch into a repository compiles the card where it arrives, and settings stay a person's to compile", async () => {
        const root = scratch();
        const feed = carded(root);
        const manifest = readManifest(feed);
        manifest.slots.repos = "repos/";
        write(feed, "workspace.json", json(manifest));
        write(feed, "repos/acme-app.md", "# acme-app\n\n> The card for acme-app.\n");
        const dst = pointerRepo(root, "acme-app", "acme");
        const repo = path.dirname(dst);
        const h = harness();
        assert.equal(await run([feed, "--into", dst, "--residence", "in-repo", "--switch", "--repo-root", root], h.options), 0, text(h));
        const rule = path.join(repo, ".claude", "rules", "portulan", "boot.md");
        assert.match(fs.readFileSync(rule, "utf8"), /^# Portulan boot card$/m);
        assert.match(fs.readFileSync(rule, "utf8"), /^@\.\.\/\.\.\/\.\.\/\.portulan\/identity\.md$/m, "the import is rebased to the compiled rule");
        assert.equal(exists(path.join(repo, ".claude", "settings.json")), false);
        assert.match(text(h), /compiled the guidance into .+, which Claude Code loads there; host settings are not/);
        assert.match(text(h), /the repository's own records are not moved by a switch — `portulan upgrade --write .+` moves them to the new form/);
    });
});
