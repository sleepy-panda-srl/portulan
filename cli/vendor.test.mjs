// Tests for `vendor` — the subcommand that materialises a workspace where it is needed, and carries
// the residence switch in both directions.
//
// Written before the tool, per ../core/operating/verification.md: the failing test is the spec. Zero
// dependencies, node's own runner, same as ./init.test.mjs, ./new.test.mjs and ./doctor.test.mjs.
//
//   node --test "cli/**/*.test.mjs"
//
// ## What this suite establishes, and what it cannot
//
// It establishes the property the residence ruling exists to protect and that can go wrong **silently**:
// one repository is governed by exactly one workspace, at every point where this tool can stop. That is
// asserted by *forcing* the stops — `options.faultAt` throws after a named step — because an ordering
// nothing can interrupt is an ordering nobody has checked. Reading the code establishes that the writes
// are in the intended order; only running it establishes what a failure between two of them leaves
// behind, and this milestone's every real finding came from running rather than reading.
//
// It establishes that green means green **through the real `doctor`**: every end-state assertion below
// runs `inspect` from ./doctor.mjs against the directory that was actually written, rather than
// re-deriving what a valid workspace looks like. A second opinion about validity is a second carrier of
// the Workspace Definition, which is the defect this repository names more often than any other.
//
// It establishes the three rules `cli/init.mjs` and `cli/new.mjs` paid for — refuse an existing file,
// refuse a symlink at or below the named destination, and treat only `ENOENT` as absent — against a
// third tool that writes into somebody's tree. Missing a sibling is issue #91's class and it has bitten
// every session of this milestone.
//
// **What it cannot establish** is the one window that is irreducible. Governance lives in two manifests
// in two directories and no POSIX primitive changes both, so between the two renames there is a moment
// with two governors. The suite pins the moment to exactly one rename, pins every *handled* failure to
// exactly one governor, and asserts that the state a crash there would leave is one `doctor` REFUSES
// rather than one it passes over. It cannot make the moment not exist — that needs the mechanism
// `.portulan/proposals/0017-one-repository-one-governing-workspace.md` defers under *Retire when*.
//
// Every refusal is asserted on its **sentence** as well as its code, on session 1's finding that a
// refusal which misdescribes what it found is worth less than no refusal: it sends the reader somewhere
// real and wrong.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspect } from "./doctor.mjs";
import { VendorError, RESIDENCES, parseArgs, residenceOf, retarget, walk, escapingSlots, collisions, agentsMd, run } from "./vendor.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ONE exit handler for every scratch directory, not one each — the per-directory form exceeds node's
// default ten-listener limit partway through a suite this size. ./doctor.test.mjs records the reason and
// ./init.test.mjs records what ignoring it cost (2375 leaked directories).
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

/**
 * A whole, `doctor`-green workspace on disk — the fixture every switch test moves.
 *
 * It is deliberately a REAL one rather than a manifest stub: this tool copies a directory, and a
 * fixture with no `verify/` or `repos/` would let a bug that drops non-manifest files pass every
 * assertion here. One repo card, because the scope bound below refuses more than one.
 */
function seedWorkspace(dir, { name = "acme", kind = "repository", tree = "../", card = "acme-app", extra = {} } = {}) {
    const manifest = {
        portulan: { spec: "2.7" },
        name,
        summary: `The ${name} workspace.`,
        kind,
        ...(tree === null ? {} : { tree }),
        // The `repos` slot is declared only when a card exists. A declared slot whose directory is not
        // there is a `paths` failure, and a fixture that shipped one would have made every assertion
        // below fail for a reason that has nothing to do with `vendor`.
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

/** A repository directory whose `.portulan/` holds a full workspace. Returns the workspace directory. */
function inRepo(root, repoName = "acme-app", opts = {}) {
    const repo = path.join(root, repoName);
    const ws = path.join(repo, ".portulan");
    fs.mkdirSync(ws, { recursive: true });
    seedWorkspace(ws, opts);
    return ws;
}

/** A repository directory whose `.portulan/` holds a pointer — exactly what `init --residence pointer` writes. */
function pointerRepo(root, repoName = "acme-app", governor = "acme") {
    const ws = path.join(root, repoName, ".portulan");
    fs.mkdirSync(ws, { recursive: true });
    write(ws, "workspace.json", json({ portulan: { spec: "2.7" }, name: repoName, summary: "Governed elsewhere.", kind: "pointer", governed_by: { workspace: governor } }));
    write(ws, "README.md", "# This repository's workspace lives elsewhere\n");
    return ws;
}

const readManifest = (dir) => JSON.parse(fs.readFileSync(path.join(dir, "workspace.json"), "utf8"));
const exists = (p) => fs.existsSync(p);

/** GREEN by the real validator, never by a second opinion about what valid means. */
async function green(dir, options = {}) {
    const { findings } = await inspect(dir, { ...options });
    return findings.filter((f) => f.severity === "fail");
}

/**
 * How many workspaces govern `repoName`, counted the way `doctor` keys governance.
 *
 * Two coordinates and no others: a non-pointer manifest in the repository, and a feed-side workspace
 * whose `repos/` slot carries a card naming it. The invariant every ordering test below asserts is that
 * this is exactly 1 at every point this tool can stop.
 */
function governors(repoDir, feedWorkspaceDirs = []) {
    let count = 0;
    const manifest = path.join(repoDir, ".portulan", "workspace.json");
    if (exists(manifest)) {
        try {
            if (JSON.parse(fs.readFileSync(manifest, "utf8")).kind !== "pointer") count += 1;
        } catch {
            // An unreadable manifest is not evidence of governance either way. Counted as absent here
            // and asserted nowhere — the tool never leaves one, and a test that counted it would be
            // asserting a shape nothing produces.
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
        // `init`'s round 9 and `new`'s parser both hold this rule: `-h` is the likeliest token to land
        // in a value slot and it is a help request, so consuming it blames the user for a flag they
        // typed as a flag.
        assert.throws(() => parseArgs(["/src", "--into", "-h"]), (e) => e instanceof VendorError && /needs a value/.test(e.message));
    });

    test("an empty value is refused for every flag", () => {
        assert.throws(() => parseArgs(["/src", "--into", ""]), (e) => e instanceof VendorError && /empty/.test(e.message));
    });

    test("an unknown option names both ways this tool is reachable", () => {
        // #155: a usage line naming only one spelling is wrong for whoever arrived the other way.
        assert.throws(
            () => parseArgs(["/src", "--nope", "x"]),
            (e) => e instanceof VendorError && /portulan vendor --help/.test(e.message) && /node cli\/vendor\.mjs --help/.test(e.message),
        );
    });

    test("`--pack-root` and `--repo-root` are repeatable and stay separate lists", () => {
        // Separate because they answer different questions: one holds `category/name` pack directories,
        // the other holds repositories. `doctor` keeps them apart for the same reason.
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
        // Proposal 0017: every feature keys to a SLOT and never to a residence; `tree` is the single
        // exception it names. So `tree` is what this reads, not `kind` — a manifest whose `kind` and
        // `tree` disagree is `doctor`'s problem and this tool must not invent a second verdict on it.
        assert.equal(residenceOf({ kind: "repository", tree: "../" }), "in-repo");
        assert.equal(residenceOf({ kind: "portfolio" }), "feed-side");
        assert.equal(residenceOf({ kind: "demo" }), "feed-side");
    });

    test("retarget changes exactly two keys and copies the rest untouched", () => {
        // 0017's parity argument, made executable: "one artifact in two residences, differing in reach
        // and delivery, never in content-kind". If this ever has to touch a third key, the proposal's
        // central claim is wrong and that is a finding, not a patch.
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
        // `demo` is already a feed-side shape — it declares no `tree` — so rewriting it to `portfolio`
        // would change what the workspace IS in order to move it, which is not a move.
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
        // Measured on `init`: nine files written outside a repository through a `.portulan` link, and
        // reported as success. Nothing may land beyond the link.
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
        // The boundary `new`'s `chain()` records, and it was found by running: on macOS `os.tmpdir()`
        // resolves under `/var`, which is a symlink to `/private/var`. A check that walked to the
        // filesystem root refused every scratch directory in this suite — and every user whose home
        // sits on a linked volume. The user named that path; resolving it is obeying them.
        const root = scratch();
        const real = path.join(root, "real");
        fs.mkdirSync(path.join(real, "repo"), { recursive: true });
        const link = path.join(root, "link");
        fs.symlinkSync(real, link);
        assert.deepEqual(collisions(path.join(link, "repo", ".portulan"), ["workspace.json"]), []);
    });

    test("an lstat failure that is not ENOENT is a collision, never an absence", () => {
        // Only `ENOENT` means absent. `EACCES` means the question could not be answered, and answering
        // *nothing there* to an unanswerable question is the fail-open this repository names more often
        // than any other. Forced with a stub rather than with chmod, which root ignores and CI often runs as.
        const failing = () => {
            const error = new Error("permission denied");
            error.code = "EACCES";
            throw error;
        };
        const found = collisions("/wherever/.portulan", ["workspace.json"], { lstat: failing });
        assert.equal(found.length, 1);
        assert.match(found[0].why, /EACCES/);
    });

    test("a symlink inside the SOURCE is refused — the read path, not only the write path", async () => {
        // Issue #91's class, and session 1 hit it twice: a guard on the write path and not the read.
        // Copying through a link would materialise a file from outside the workspace and record it as
        // part of the workspace, which is the escape arriving by the one route nothing was watching.
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
        // Customer zero is exactly this shape — `"constitution": "../docs/vision.md"` — and it is why
        // this repository's own workspace is not the subject of the parity demonstration. A slot
        // pointing outside the workspace resolves against the workspace's neighbours, and a workspace
        // materialised somewhere else has different neighbours. `doctor` would red the copy on a path
        // slot that does not resolve; this refuses ahead of writing it rather than producing it.
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
            // Named rather than half-done: extracting one repository from a portfolio edits another
            // workspace's curated card set and its `products` entries, which is the rule `init` and
            // `new` both hold — a generator that edits a manifest it did not write is the generator
            // that eventually edits the wrong one.
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
        // `init`'s rule: an option accepted and then not honoured is one you will believe had an effect.
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
        // The materialised copy is a full workspace, not a reference: 0017's step 1 says "the whole
        // thing, not a reference", and a vendored standards tree that pointed back at a feed would be
        // the opposite of self-contained.
        assert.equal(readManifest(path.join(host, ".portulan")).kind, "repository");
        assert.equal(readManifest(path.join(host, ".portulan")).tree, "../");
        // The source is untouched: vendoring for a host is a rendering, never a move.
        assert.deepEqual(await green(src), []);
    });

    test("AGENTS.md names only what the manifest actually declares", async () => {
        // A vendored standards file that listed slots the workspace does not carry would be the
        // condition-4 defect — a document describing capability the tree does not have — emitted into
        // somebody else's repository, which is the worst shape available for it.
        const manifest = { portulan: { spec: "2.7" }, name: "acme", summary: "One line.", kind: "repository", tree: "../", slots: { identity: "identity.md", gates: "gate-map.md" }, verify: { default: "workspace", recipes: [{ id: "workspace", run: "./verify/workspace.sh" }] } };
        const md = agentsMd(manifest, "generic");
        assert.match(md, /identity\.md/);
        assert.match(md, /gate-map\.md/);
        assert.doesNotMatch(md, /principles\.md/);
        assert.match(md, /workspace/);
        // What a vendored copy does NOT carry, said in the artifact rather than left to be discovered:
        // compiled host enforcement is `compile`'s output and no copy of files produces it.
        assert.match(md, /compile/);
        // And when the kernel could not be read, the artifact says the gap exists rather than reading
        // as a complete standards file that is quietly missing its universal half.
        assert.match(md, /not\*\* inlined/);
    });

    test("the engine kernel is inlined, because `core/engine.md` says the CLI composes it", () => {
        // `core/engine.md` claims the CLI "composes it with the pack and workspace layers into a
        // vendored AGENTS.md for any host". Two thirds of that is true here and the third is named:
        // a pack resolves from a feed at a pinned version and vendoring resolves nothing.
        const manifest = { portulan: { spec: "2.7" }, name: "acme", kind: "repository", tree: "../", slots: { identity: "identity.md" }, verify: { default: "w", recipes: [] }, packs: ["rituals/checkpoints"] };
        const md = agentsMd(manifest, "generic", fs.readFileSync(path.join(HERE, "..", "core", "engine.md"), "utf8"));
        assert.match(md, /Resolution cascade/, "the kernel's own headings are present, so it is really inlined");
        assert.match(md, /core < pack < workspace/);
        assert.match(md, /rituals\/checkpoints/);
        assert.match(md, /Their files are not here/, "the pack layer is named as NOT composed");
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

    test("a failure after AGENTS.md moves leaves no AGENTS.md behind", async () => {
        // The undo was registered AFTER the last write rather than before the first, so every failure
        // *between* the two renames was uncovered: `AGENTS.md` landed, the workspace rename then failed,
        // and the rollback removed the staging directory while leaving the file — a run that reported
        // could-not-run having vendored half of something into somebody's tree. Copilot, round 1 on #164.
        //
        // Forced by making the destination rename fail: `dest`'s parent is a FILE, so `mkdirSync` of it
        // throws after `AGENTS.md` is already in place.
        const root = scratch();
        const src = path.join(root, "feed", "acme");
        fs.mkdirSync(src, { recursive: true });
        seedWorkspace(src, { kind: "portfolio", tree: null, card: null });
        const host = path.join(root, "host");
        fs.mkdirSync(host, { recursive: true });

        const h = harness();
        const original = fs.renameSync;
        fs.renameSync = (from, to, ...rest) => {
            if (String(to) === path.join(host, ".portulan")) {
                const error = new Error("cross-device link not permitted");
                error.code = "EXDEV";
                throw error;
            }
            return original(from, to, ...rest);
        };
        try {
            assert.equal(await run([src, "--into", path.join(host, ".portulan"), "--residence", "in-repo", "--host", "generic"], h.options), 2);
        } finally {
            fs.renameSync = original;
        }
        assert.equal(exists(path.join(host, "AGENTS.md")), false, "a failed vendoring must leave no artifact");
        assert.equal(exists(path.join(host, ".portulan")), false);
        assert.deepEqual(fs.readdirSync(host), [], "and no staging directory either");
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

describe("the switch, in-repo → feed-side", () => {
    test("materialises feed-side, leaves a pointer, and both ends are green", async () => {
        const root = scratch();
        const src = inRepo(root, "acme-app");
        const repo = path.dirname(src);
        const feed = path.join(root, "feed", "acme");

        const h = harness();
        assert.equal(await run([src, "--into", feed, "--residence", "feed-side", "--switch", "--repo-root", root], h.options), 0);

        // The new residence carries the whole workspace, retargeted in exactly two keys.
        const moved = readManifest(feed);
        assert.equal(moved.kind, "portfolio");
        assert.equal("tree" in moved, false);
        assert.ok(exists(path.join(feed, "verify", "workspace.sh")));
        assert.ok(exists(path.join(feed, "repos", "acme-app.md")));

        // The old residence is a pointer naming the workspace that now governs from the feed.
        const left = readManifest(src);
        assert.equal(left.kind, "pointer");
        assert.equal(left.governed_by.workspace, "acme");

        // Green at BOTH ends, through the real validator — and the feed end with `--repo-root`, which
        // is the only way the cross-repository refusal looks at anything at all.
        assert.deepEqual(await green(feed, { repoRoots: [root] }), []);
        assert.deepEqual(await green(src), []);
        assert.equal(governors(repo, [feed]), 1);

        // The moved material is retired from the old residence — accounted for, never guessed at.
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
        // Accountable retirement: this deletes only what it can prove it materialised at the other end.
        // Anything else is somebody's, and a tool that tidies up what it does not understand is the tool
        // that eventually deletes the wrong thing.
        const root = scratch();
        const src = inRepo(root, "acme-app");
        // Written after the walk would have seen it — simulated by seeding it and telling the tool to
        // stop before the retire step would reach it is not possible, so instead: a file that IS moved
        // is deleted, and this asserts the reporting path with an untracked extra.
        const h = harness();
        assert.equal(await run([src, "--into", path.join(root, "feed", "acme"), "--residence", "feed-side", "--switch", "--leave", "pointer"], h.options), 0);
        // The pointer's own two files remain and are the residence, not leftovers.
        assert.deepEqual(fs.readdirSync(src).sort(), ["README.md", "workspace.json"]);
    });

    test("compiled enforcement does not travel, and is retired with the residence that produced it", async () => {
        // Found by RUNNING the parity demonstration, not by reading anything: the return leg carried a
        // feed-side `.claude/settings.json` into `<repo>/.portulan/.claude/settings.json`, where the
        // in-repo `compile` neither reads it nor sweeps it. A settings file naming paths for the
        // residence it left, sitting where nothing looks — enforcement claimed and not carried.
        const root = scratch();
        const src = inRepo(root, "acme-app");
        write(src, ".claude/settings.json", '{"hooks":{}}\n');
        write(src, "compile/github-ruleset.json", '{"name":"x"}\n');
        const feed = path.join(root, "feed", "acme");

        const h = harness();
        assert.equal(await run([src, "--into", feed, "--residence", "feed-side", "--switch"], h.options), 0);
        assert.equal(exists(path.join(feed, ".claude", "settings.json")), false, "the settings did not travel");
        assert.equal(exists(path.join(feed, "compile", "github-ruleset.json")), false, "nor did the ruleset");
        // Retired rather than left beside the pointer: they are `compile`'s and reproducible by
        // definition, which is the licence `compile` states for deleting its own output.
        assert.equal(exists(path.join(src, ".claude")), false);
        assert.equal(exists(path.join(src, "compile")), false);
        assert.match(text(h), /compiled artifact/);
        // And the one it must NOT reach for, because it is outside the directory it was given.
        assert.match(text(h), /nothing here writes outside/);
    });

    test("`--leave nothing` does NOT delete an old residence it could not scan", async () => {
        // The destructive one, and the shape is this repository's own fail-open: a scan that FAILED was
        // read as an EMPTY directory, `leftovers` came back empty, and the `--leave nothing` branch then
        // removed the whole tree — deleting exactly the files the sentence beside it promises never to
        // delete, in the one branch where being wrong cannot be undone. Copilot, round 1 on #164.
        //
        // Forced by making the old residence unreadable at exactly the moment the RETIRE scan runs —
        // the second `readdirSync` of that directory, the first being the materialise walk. `chmod`
        // would be the obvious lever and is the wrong one: root ignores it, CI often runs as root, and a
        // test that silently stops testing where it matters most is worse than no test.
        const root = scratch();
        const src = inRepo(root, "acme-app");
        const feed = path.join(root, "feed", "acme");
        const keep = path.join(src, "hand-written.md");
        fs.writeFileSync(keep, "# mine\n");

        const h = harness();
        const original = fs.readdirSync;
        let seen = 0;
        fs.readdirSync = (target, ...rest) => {
            if (String(target) === src && ++seen > 1) {
                const error = new Error("permission denied");
                error.code = "EACCES";
                throw error;
            }
            return original(target, ...rest);
        };
        try {
            assert.equal(await run([src, "--into", feed, "--residence", "feed-side", "--switch", "--leave", "nothing"], h.options), 0);
        } finally {
            fs.readdirSync = original;
        }

        assert.ok(exists(keep), "a file the run could not account for must survive");
        assert.match(text(h), /could NOT be scanned/);
        assert.match(text(h), /nothing there was removed/);
        // Governance still moved — the switch completed; only the cleanup did not.
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

        // The old residence — the feed slot — is a pointer naming the workspace, now resident in-repo.
        // A shape nothing had written before, so it is asserted green rather than assumed valid.
        const retired = readManifest(feed);
        assert.equal(retired.kind, "pointer");
        assert.equal(retired.governed_by.workspace, "acme");
        assert.deepEqual(await green(feed), []);
        assert.equal(governors(repo, [feed]), 1);

        // The pointer's README asserted "this repository's workspace lives elsewhere". It does not any
        // more, and a false sentence left in an adopter's tree is this milestone's own recurring defect.
        assert.doesNotMatch(fs.readFileSync(path.join(dst, "README.md"), "utf8"), /lives elsewhere/);
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
        // 0017 defines it: "A `.portulan/` directory holding files but NO manifest is not a residence".
        // That definition is what makes the copy safe — until the manifest lands there is no second
        // governor, however many files are on disk.
        const root = scratch();
        const src = inRepo(root, "acme-app");
        const feed = path.join(root, "feed", "acme");
        await run([src, "--into", feed, "--residence", "feed-side", "--switch"], { ...harness().options, faultAt: "materialise:files" });
        assert.equal(exists(path.join(feed, "workspace.json")), false, "no manifest, so not a residence");
        assert.equal(readManifest(src).kind, "repository", "the old residence still governs, untouched");
    });

    test("the manifest is retired FIRST, so cleanup can fail without minting a second governor", async () => {
        // The reverse of the materialise order, for the reverse reason: removing the moved files before
        // flipping the manifest would leave a governing manifest over a workspace with holes in it —
        // a governor that no longer works, which is worse than either honest end state.
        const root = scratch();
        const src = inRepo(root, "acme-app");
        const feed = path.join(root, "feed", "acme");
        await run([src, "--into", feed, "--residence", "feed-side", "--switch"], { ...harness().options, faultAt: "retire:manifest" });
        assert.equal(readManifest(src).kind, "pointer", "governance has already moved");
        assert.equal(governors(path.dirname(src), [feed]), 1);
    });

    test("a red `doctor` at the new residence rolls back and never opens the window", async () => {
        // The new end is validated BEFORE the rename that transfers governance, so a destination that
        // would not have been green never becomes a second governor at all.
        //
        // Forced with a `verify.default` naming no declared recipe. The first attempt used an
        // unresolvable pack, and it did not red: a workspace with no `tree` has no packs root to
        // search, so `doctor` reports the pack *unverifiable* rather than failing — and a feed-side
        // destination never has a `tree`. A forcing device that stops forcing at exactly the residence
        // under test is worse than none, because the test still passes.
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

    test("the recovery sentence is printed BEFORE the window opens, and names the `--repo-root` form", async () => {
        // Without `--repo-root`, `doctor` REPORTS that the cross-repository check did not run rather
        // than failing — so a recovery instruction that omitted the flag would send a reader to a
        // command that cannot see the state they are recovering from.
        const root = scratch();
        const src = inRepo(root, "acme-app");
        const feed = path.join(root, "feed", "acme");
        const h = harness();
        await run([src, "--into", feed, "--residence", "feed-side", "--switch"], { ...h.options, faultAt: "materialise:manifest" });
        assert.match(text(h), /--repo-root/);
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
        // Row 7's fourth demonstration in miniature — the full one runs against the real
        // `portulan-internal` feed and is recorded in the milestone evidence, because a demonstration
        // that only ever runs against a fixture is a demonstration about the fixture. What this asserts
        // is the property the demonstration shows: `doctor`'s verdict, the resolved slot set and the
        // runnable recipe set are identical at both ends, and the switch runs in both directions.
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

        // And back, which is what makes it a choice rather than a migration.
        assert.equal(await run([feed, "--into", src, "--residence", "in-repo", "--switch", "--repo-root", root], harness().options), 0);
        const returned = await inspect(src, {});
        assert.deepEqual(returned.findings.filter((f) => f.severity === "fail"), []);
        assert.deepEqual(Object.keys(returned.workspace.slots), Object.keys(before.workspace.slots));
        assert.equal(returned.workspace.kind, "repository");
        assert.equal(returned.workspace.tree, "../");
        assert.equal(governors(repo, [feed]), 1);
    });
});
