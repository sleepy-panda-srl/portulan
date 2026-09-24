// Tests for `finish` — one call closes a change: the fragment, the commit, every recipe on it, the push.
//
// Zero dependencies, node's own runner, and run by the same recipe as every suite here:
//
//   node --test "cli/**/*.test.mjs"
//
// Every case builds a scratch repository cloned from a scratch bare origin, so a push lands beside it and
// nothing reaches a real remote. What the suite pins is the command's promise: a change closes only with
// every recipe green on the commit it made, and when anything is red, nothing is pushed and the commit it
// made is undone, its changes staged; it never pushes to the base branch, never skips a hook, never forces.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { finish, fragmentIn, parseArgs, run, treeRoots } from "./finish.mjs";

// A HERMETIC HOST: the recipe set's pack discovery reads the host's plugin cache, and nothing here may.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOL = path.join(REPO, "cli", "finish.mjs");

const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch() {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "portulan-finish-test-")));
    SCRATCH.push(dir);
    return dir;
}

// Git reads no configuration of this machine's: an identity of its own, no global or system file, no signing.
const HOME = scratch();
const ENV = {
    ...process.env,
    HOME,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: path.join(HOME, "gitconfig"),
    GIT_AUTHOR_NAME: "portulan-test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "portulan-test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
    PORTULAN_BASE_REF: "",
    PORTULAN_WORKSPACE: "",
};
fs.writeFileSync(ENV.GIT_CONFIG_GLOBAL, "[commit]\n\tgpgsign = false\n[init]\n\tdefaultBranch = main\n");

const git = (cwd, args) => execFileSync("git", args, { cwd, env: ENV, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const write = (root, rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
};

const GREEN = [{ id: "docs", run: "true" }];

/**
 * A clone on a working branch `feat`, its base `main` pushed to a bare origin whose HEAD is recorded.
 * `recipes` are the workspace's, the first its default; `fragments` says whether the tree keeps `changes/`.
 */
function clone({ recipes = GREEN, fragments = true, manifest = {}, files = {} } = {}) {
    const root = scratch();
    const origin = path.join(root, "origin.git");
    const work = path.join(root, "work");
    git(root, ["init", "-q", "--bare", origin]);
    // Set explicitly: `git init --bare` follows the host's init.defaultBranch, and `set-head -a` then fails
    // wherever that is not `main` (./stop-gate.test.mjs measured it on CI).
    git(root, ["--git-dir", origin, "symbolic-ref", "HEAD", "refs/heads/main"]);
    git(root, ["clone", "-q", origin, work]);
    write(work, ".portulan/workspace.json", JSON.stringify({ name: "fixture", ...manifest, verify: { default: recipes[0].id, recipes } }));
    if (fragments) write(work, "changes/README.md", "# Changelog fragments\n");
    for (const [rel, text] of Object.entries(files)) write(work, rel, text);
    write(work, "f.txt", "base\n");
    git(work, ["add", "-A"]);
    git(work, ["commit", "-q", "-m", "base"]);
    git(work, ["branch", "-M", "main"]);
    git(work, ["push", "-q", "origin", "main"]);
    git(work, ["remote", "set-head", "origin", "-a"]);
    git(work, ["checkout", "-q", "-b", "feat"]);
    return { work, origin };
}

/**
 * A change on `feat`: an edit and, unless told otherwise, its fragment, staged by name as a caller stages a
 * new file in the same call, since the command never stages an untracked one.
 */
function change(work, { fragment = true } = {}) {
    fs.appendFileSync(path.join(work, "f.txt"), "one\n");
    if (fragment) {
        write(work, "changes/one.added.md", "- **One.**\n");
        git(work, ["add", "--", "changes/one.added.md"]);
    }
}

/** A pack, `tools/thing` unless named, whose one recipe passes, as its `pack.json` and README spell it under `dir`. */
function packAt(dir, ref = "tools/thing") {
    const [category, name] = ref.split("/");
    write(dir, `${ref}/pack.json`, JSON.stringify({
        portulan: { pack: "1.0", version: "0.1.0" }, name, category, summary: "x", doc: "README.md",
        contributes: { verify: [{ id: "check", run: "true", requires: ["bash"] }] },
    }));
    write(dir, `${ref}/README.md`, `# ${name}\n`);
}

/** A host whose plugin record installs one plugin carrying these packs, as an installed Portulan carries its own. */
function hostWith(refs = ["tools/thing"]) {
    const host = scratch();
    const installPath = path.join(host, "plugins", "cache", "feed", "portulan", "0.1.0");
    for (const ref of refs) packAt(path.join(installPath, "packs"), ref);
    write(host, "plugins/installed_plugins.json", JSON.stringify({
        version: 2,
        plugins: { "portulan@feed": [{ scope: "user", installPath, version: "0.1.0", installedAt: "2026-09-24T00:00:00.000Z", gitCommitSha: "0".repeat(40) }] },
    }));
    return host;
}

function close(work, argv, { stdin } = {}) {
    let out = "";
    let err = "";
    const code = run(argv, { cwd: work, env: ENV, stdout: { write: (s) => (out += s) }, stderr: { write: (s) => (err += s) }, readStdin: () => stdin });
    return { code, out, err, first: out.split("\n")[0] };
}

const onOrigin = (origin, branch) => spawnSync("git", ["--git-dir", origin, "rev-parse", "--verify", "-q", `refs/heads/${branch}`], { env: ENV, encoding: "utf8" }).stdout.trim();

describe("a change closes in one call", () => {
    test("the fragment, the commit, every recipe on it and the push, reported in one line", () => {
        const { work, origin } = clone({ recipes: [{ id: "docs", run: "true" }, { id: "tests", run: "true" }] });
        change(work);
        const r = close(work, ["-m", "One", "-m", "Why one."]);
        assert.equal(r.code, 0, r.out);
        assert.equal(r.out.trim().split("\n").length, 1, "a closed change is one line");
        assert.match(r.first, /^finish: closed feat at [0-9a-f]{7,} — committed 2 file\(s\); fragment changes\/one\.added\.md; 2 recipe\(s\) green; pushed to origin\/feat$/);
        assert.equal(onOrigin(origin, "feat"), git(work, ["rev-parse", "HEAD"]), "the branch is on the remote at the commit");
        assert.equal(git(work, ["log", "-1", "--format=%B"]), "One\n\nWhy one.", "the paragraphs are the message, as git -m joins them");
        assert.equal(git(work, ["status", "--porcelain"]), "", "the tree is clean, so the Stop-gate owes no handoff");
        assert.equal(git(work, ["rev-parse", "--abbrev-ref", "@{u}"]), "origin/feat", "the first push sets the upstream");
    });

    test("a second call with nothing new says there is nothing to close", () => {
        const { work } = clone();
        change(work);
        assert.equal(close(work, ["-m", "One"]).code, 0);
        const r = close(work, []);
        assert.equal(r.code, 0);
        assert.equal(r.first, "finish: nothing to close — the tree is clean and feat matches origin/feat");
    });

    test("a commit made and not pushed is pushed without a new one", () => {
        const { work, origin } = clone();
        change(work);
        git(work, ["add", "-A"]);
        git(work, ["commit", "-q", "-m", "One"]);
        const r = close(work, []);
        assert.equal(r.code, 0, r.out);
        assert.match(r.first, /— nothing new to commit; fragment changes\/one\.added\.md; 1 recipe\(s\) green; pushed to origin\/feat$/);
        assert.equal(onOrigin(origin, "feat"), git(work, ["rev-parse", "HEAD"]));
    });

    test("the message can come whole from standard input, trailers and all", () => {
        const { work } = clone();
        change(work);
        const message = "One\n\nWhy one.\n\nSeam-scan: clean against the terms\n";
        assert.equal(close(work, ["-F", "-"], { stdin: message }).code, 0);
        assert.equal(git(work, ["log", "-1", "--format=%(trailers:key=Seam-scan,valueonly)"]), "clean against the terms");
    });

    test("the entry point exits with the code it reports", () => {
        const { work } = clone();
        change(work, { fragment: false });
        const r = spawnSync("node", [TOOL, "-m", "One"], { cwd: work, env: ENV, encoding: "utf8" });
        assert.equal(r.status, 1, r.stdout + r.stderr);
        assert.match(r.stdout, /^finish: stopped — this change carries no changelog fragment/);
    });
});

describe("the changelog fragment", () => {
    test("a change with none stops, and nothing is committed or pushed", () => {
        const { work, origin } = clone();
        change(work, { fragment: false });
        const before = git(work, ["rev-parse", "HEAD"]);
        const r = close(work, ["-m", "One"]);
        assert.equal(r.code, 1);
        assert.match(r.first, /no changelog fragment since origin\/main: write changes\/<slug>\.<section>\.md, one bullet, or pass --no-fragment "<why>"/);
        assert.equal(git(work, ["rev-parse", "HEAD"]), before);
        assert.equal(onOrigin(origin, "feat"), "");
        assert.equal(git(work, ["diff", "--cached", "--name-only"]), "", "nothing was staged either");
    });

    test("--no-fragment closes a change that owes none, and the line says why", () => {
        const { work } = clone();
        change(work, { fragment: false });
        const r = close(work, ["-m", "One", "--no-fragment", "a workflow-only change"]);
        assert.equal(r.code, 0, r.out);
        assert.match(r.first, /; no fragment: a workflow-only change; /);
    });

    test("a fragment committed earlier on the branch counts, and so does an edit to one", () => {
        const { work } = clone();
        change(work);
        git(work, ["add", "-A"]);
        git(work, ["commit", "-q", "-m", "One"]);
        fs.appendFileSync(path.join(work, "f.txt"), "two\n");
        assert.equal(close(work, ["-m", "Two"]).code, 0);
    });

    test("a tree that keeps no changes/ owes none", () => {
        const { work } = clone({ fragments: false });
        change(work, { fragment: false });
        const r = close(work, ["-m", "One"]);
        assert.equal(r.code, 0, r.out);
        assert.match(r.first, /; no fragment owed: this tree keeps no changes\/ directory; /);
    });

    test("only a well-named fragment the change added or edited counts", () => {
        assert.equal(fragmentIn([{ status: "A", path: "changes/one.added.md" }]), "changes/one.added.md");
        assert.equal(fragmentIn([{ status: "?", path: "changes/one.fixed.md" }]), "changes/one.fixed.md");
        assert.equal(fragmentIn([{ status: "D", path: "changes/one.added.md" }]), null, "a deletion, as a release cut makes, is not an entry");
        assert.equal(fragmentIn([{ status: "M", path: "changes/README.md" }]), null);
        assert.equal(fragmentIn([{ status: "A", path: "changes/One.added.md" }]), null);
        assert.equal(fragmentIn([{ status: "A", path: "changes/one.improved.md" }]), null);
        assert.equal(fragmentIn([{ status: "A", path: "changes/sub/one.added.md" }]), null);
        assert.equal(fragmentIn([{ status: "A", path: "docs/changes/one.added.md" }]), null);
    });

    test("the entry the change adds names it, ahead of an earlier one it extended", () => {
        const edited = { status: "M", path: "changes/an-earlier-change.changed.md" };
        assert.equal(fragmentIn([edited, { status: "A", path: "changes/this-change.added.md" }]), "changes/this-change.added.md");
        assert.equal(fragmentIn([edited]), edited.path, "an extension alone still counts");
    });
});

describe("what it stages", () => {
    test("a file nobody staged stops it, listed, and nothing is committed or pushed", () => {
        const { work, origin } = clone();
        change(work);
        write(work, "scratch-notes.txt", "notes\n");
        write(work, "token.json", "{}\n");
        fs.appendFileSync(path.join(work, ".git/info/exclude"), "ignored.log\n");
        write(work, "ignored.log", "an ignored file is no concern\n");
        const before = git(work, ["rev-parse", "HEAD"]);
        const r = close(work, ["-m", "One"]);
        assert.equal(r.code, 1);
        assert.match(r.first, /^finish: stopped — 2 untracked path\(s\) that nobody staged\. Stage by name the ones this change created, with `git add <paths> &&` before this command in the same call; leave any other where it is and list it in \.git\/info\/exclude, which is never committed, or ask whoever put it there\. Never delete a file this change did not create\. Nothing was committed or pushed\.$/);
        assert.deepEqual(r.out.trim().split("\n").slice(1), ["    scratch-notes.txt", "    token.json"]);
        assert.equal(git(work, ["rev-parse", "HEAD"]), before);
        assert.equal(onOrigin(origin, "feat"), "");
        assert.equal(git(work, ["ls-files", "--others", "--exclude-standard"]), "scratch-notes.txt\ntoken.json", "both stay untracked");

        fs.rmSync(path.join(work, "scratch-notes.txt"));
        fs.rmSync(path.join(work, "token.json"));
        const closed = close(work, ["-m", "One"]);
        assert.equal(closed.code, 0, closed.out);
        assert.match(closed.first, /— committed 2 file\(s\);/, "the tracked edit and the fragment staged by name");
        assert.equal(git(work, ["show", "--name-only", "--format=", "HEAD"]), "changes/one.added.md\nf.txt");
    });
});

describe("the packs it composes", () => {
    test("where the tree carries them, they resolve from the tree, as CI names it, beside an installed copy", () => {
        const files = {};
        const tree = scratch();
        packAt(tree);
        for (const rel of ["tools/thing/pack.json", "tools/thing/README.md"]) files[`packs/${rel}`] = fs.readFileSync(path.join(tree, rel), "utf8");
        const { work, origin } = clone({ manifest: { tree: "../", packs: ["tools/thing"] }, files });
        change(work);
        const env = { ...ENV, CLAUDE_CONFIG_DIR: hostWith() };
        const bare = spawnSync("node", [path.join(REPO, "cli", "recipe-set.mjs"), "--workspace", ".portulan", "--repo-root", "."], { cwd: work, env, encoding: "utf8" });
        assert.equal(bare.status, 2, "the bare set refuses the pack as shadowed: the case this guards");
        assert.match(bare.stderr, /SHADOWED/);
        const r = spawnSync("node", [TOOL, "-m", "One"], { cwd: work, env, encoding: "utf8" });
        assert.equal(r.status, 0, r.stdout + r.stderr);
        assert.match(r.stdout, /; 2 recipe\(s\) green; pushed to origin\/feat$/m);
        assert.equal(onOrigin(origin, "feat"), git(work, ["rev-parse", "HEAD"]));
    });

    test("a consumer's own pack beside a composed pack the plugin installs: both resolve, as the bare set resolves them", () => {
        const files = {};
        const tree = scratch();
        packAt(tree, "tools/mine");
        for (const rel of ["tools/mine/pack.json", "tools/mine/README.md"]) files[`packs/${rel}`] = fs.readFileSync(path.join(tree, rel), "utf8");
        const { work, origin } = clone({ manifest: { tree: "../", packs: ["tools/mine", "rituals/checkpoints"] }, files });
        change(work);
        const env = { ...ENV, CLAUDE_CONFIG_DIR: hostWith(["rituals/checkpoints"]) };
        const bare = spawnSync("node", [path.join(REPO, "cli", "recipe-set.mjs"), "--workspace", ".portulan", "--repo-root", "."], { cwd: work, env, encoding: "utf8" });
        assert.equal(bare.status, 0, bare.stderr);
        const r = spawnSync("node", [TOOL, "-m", "One"], { cwd: work, env, encoding: "utf8" });
        assert.equal(r.status, 0, r.stdout + r.stderr);
        assert.match(r.stdout, /; 3 recipe\(s\) green; pushed to origin\/feat$/m);
        assert.equal(onOrigin(origin, "feat"), git(work, ["rev-parse", "HEAD"]));
    });

    test("a packs/ directory that holds no pack hides none the plugin installs", () => {
        const { work, origin } = clone({ manifest: { tree: "../", packs: ["rituals/checkpoints"] }, files: { "packs/web-app/package.json": "{}\n" } });
        change(work);
        const r = spawnSync("node", [TOOL, "-m", "One"], { cwd: work, env: { ...ENV, CLAUDE_CONFIG_DIR: hostWith(["rituals/checkpoints"]) }, encoding: "utf8" });
        assert.equal(r.status, 0, r.stdout + r.stderr);
        assert.match(r.stdout, /; 2 recipe\(s\) green; pushed to origin\/feat$/m);
        assert.equal(onOrigin(origin, "feat"), git(work, ["rev-parse", "HEAD"]));
    });

    test("named as CI names it, --pack-root packs, a pack the tree lacks is refused, never found in an installed copy", () => {
        const files = {};
        const tree = scratch();
        packAt(tree);
        for (const rel of ["tools/thing/pack.json", "tools/thing/README.md"]) files[`packs/${rel}`] = fs.readFileSync(path.join(tree, rel), "utf8");
        const { work, origin } = clone({ manifest: { tree: "../", packs: ["tools/thing", "rituals/other"] }, files });
        change(work);
        const before = git(work, ["rev-parse", "HEAD"]);
        const r = spawnSync("node", [TOOL, "--pack-root", "packs", "-m", "One"], { cwd: work, env: { ...ENV, CLAUDE_CONFIG_DIR: hostWith(["tools/thing", "rituals/other"]) }, encoding: "utf8" });
        assert.equal(r.status, 2, r.stdout + r.stderr);
        assert.match(r.stdout, /^finish: could not run — the recipe set: .*rituals\/other.*Nothing was committed or pushed\.$/m);
        assert.equal(git(work, ["rev-parse", "HEAD"]), before);
        assert.equal(onOrigin(origin, "feat"), "");
    });

    test("the tree's pack root is named only where it carries every pack composed", () => {
        const dir = scratch();
        const workspaceDir = path.join(dir, ".portulan");
        assert.deepEqual(treeRoots({ workspaceDir, manifest: { tree: "../", packs: ["tools/thing"] } }), [], "no packs/ in the tree");
        packAt(path.join(dir, "packs"));
        assert.deepEqual(treeRoots({ workspaceDir, manifest: { tree: "../", packs: ["tools/thing"] } }), [path.join(dir, "packs")]);
        assert.deepEqual(treeRoots({ workspaceDir, manifest: { tree: "../", packs: ["tools/thing", "rituals/other"] } }), [], "one it lacks leaves the set resolving as it does bare");
        assert.deepEqual(treeRoots({ workspaceDir, manifest: { tree: "../" } }), [], "no packs composed");
        assert.deepEqual(treeRoots({ workspaceDir, manifest: { packs: ["tools/thing"] } }), [], "no tree declared");
    });
});

describe("a red stops it, and undoes its own commit", () => {
    test("a red recipe: named with its last lines, the commit undone and staged, nothing pushed", () => {
        const { work, origin } = clone({ recipes: [{ id: "docs", run: "true" }, { id: "tests", run: "echo 'one test failed' >&2; exit 1" }] });
        change(work);
        const before = git(work, ["rev-parse", "HEAD"]);
        const r = close(work, ["-m", "One"]);
        assert.equal(r.code, 1);
        assert.equal(r.first, "finish: stopped — 1 of 2 recipe(s) not green: tests. The commit is undone and its changes are staged. Nothing was pushed.");
        assert.match(r.out, /\ntests — RED \(exit 1\):\n {4}one test failed\n/);
        assert.equal(git(work, ["rev-parse", "HEAD"]), before, "the branch is back where it was");
        assert.deepEqual(git(work, ["diff", "--cached", "--name-only"]).split("\n").sort(), ["changes/one.added.md", "f.txt"]);
        assert.equal(onOrigin(origin, "feat"), "");
    });

    test("the recipes judge the commit itself, so a message a recipe refuses is caught before the push", () => {
        const seam = { id: "docs", run: "git log -1 --format=%B | grep -q '^Seam-scan: clean'" };
        const { work, origin } = clone({ recipes: [seam] });
        change(work);
        const refused = close(work, ["-m", "One"]);
        assert.equal(refused.code, 1);
        assert.match(refused.first, /recipe\(s\) not green: docs\. The commit is undone/);
        assert.equal(onOrigin(origin, "feat"), "");
        const r = close(work, ["-m", "One", "-m", "Seam-scan: clean against the terms"]);
        assert.equal(r.code, 0, r.out);
        assert.equal(git(work, ["rev-list", "--count", "origin/main..HEAD"]), "1", "one commit: the refused one left no trace");
    });

    test("a recipe that could not run is never a pass, and says so", () => {
        const { work } = clone({ recipes: [{ id: "docs", run: "echo 'node not found' >&2; exit 2" }] });
        change(work);
        const r = close(work, ["-m", "One"]);
        assert.equal(r.code, 2);
        assert.match(r.out, /\ndocs — could not run \(exit 2\):\n {4}node not found/);
    });

    test("a recipe whose output has nowhere to go could not run, and the commit is undone", () => {
        const { work, origin } = clone();
        change(work);
        const before = git(work, ["rev-parse", "HEAD"]);
        const r = spawnSync("node", [TOOL, "-m", "One"], { cwd: work, env: { ...ENV, TMPDIR: path.join(scratch(), "missing") }, encoding: "utf8" });
        assert.equal(r.status, 2, r.stdout + r.stderr);
        assert.equal(r.stderr, "", "a reason, not a stack trace");
        assert.match(r.stdout, /^finish: stopped — 1 of 1 recipe\(s\) not green: docs\. The commit is undone and its changes are staged\. Nothing was pushed\.\n/);
        assert.match(r.stdout, /\ndocs — could not run \(exit none\):\n {4}its output could not be kept in a temporary file — ENOENT/);
        assert.equal(git(work, ["rev-parse", "HEAD"]), before);
        assert.equal(onOrigin(origin, "feat"), "");
    });

    test("a recipe's last lines are its last, whichever stream wrote them", () => {
        const { work } = clone({ recipes: [{ id: "docs", run: "echo first >&2; echo second; echo third >&2; exit 1" }] });
        change(work);
        const r = close(work, ["-m", "One"]);
        assert.equal(r.code, 1);
        assert.match(r.out, /\ndocs — RED \(exit 1\):\n {4}first\n {4}second\n {4}third\n/);
    });

    test("every recipe runs, so one call reports every red", () => {
        const { work } = clone({ recipes: [{ id: "docs", run: "exit 1" }, { id: "json", run: "true" }, { id: "tests", run: "exit 1" }] });
        change(work);
        assert.match(close(work, ["-m", "One"]).first, /2 of 3 recipe\(s\) not green: docs, tests\./);
    });

    test("a hook that refuses the commit stops it, with the hook's words", () => {
        const { work, origin } = clone();
        change(work);
        write(work, ".git/hooks/pre-commit", "#!/bin/sh\necho 'lint: trailing space' >&2\nexit 1\n");
        fs.chmodSync(path.join(work, ".git/hooks/pre-commit"), 0o755);
        const r = close(work, ["-m", "One"]);
        assert.equal(r.code, 1);
        assert.match(r.first, /the commit was refused \(git exit 1\), so nothing was committed or pushed/);
        assert.match(r.out, /lint: trailing space/);
        assert.equal(onOrigin(origin, "feat"), "");
    });

    test("an undo that finds the branch moved under it leaves it where it is, and says so", () => {
        const { work, origin } = clone();
        change(work);
        const runOne = (recipe) => {
            git(work, ["commit", "-q", "--allow-empty", "-m", "moved while the recipes ran"]);
            return { id: recipe.id, outcome: "red", code: 1, output: "red\n" };
        };
        const r = finish(parseArgs(["-m", "One"], work), { cwd: work, env: ENV, runOne });
        assert.equal(r.code, 1);
        assert.match(r.lines[0], /^finish: stopped — 1 of 1 recipe\(s\) not green: docs\. The commit [0-9a-f]{7} could not be undone \(.+\) and stays, unpushed\. Nothing was pushed\.$/);
        assert.equal(git(work, ["log", "-1", "--format=%s"]), "moved while the recipes ran", "the compare-and-swap refused to move a branch it did not leave");
        assert.equal(git(work, ["log", "-1", "--skip=1", "--format=%s"]), "One");
        assert.equal(onOrigin(origin, "feat"), "");
    });

    test("a branch that moves while the recipes run is not pushed, since they judged the commit before it", () => {
        const { work, origin } = clone();
        change(work);
        const runOne = (recipe) => {
            git(work, ["commit", "-q", "--allow-empty", "-m", "not judged"]);
            return { id: recipe.id, outcome: "green" };
        };
        const r = finish(parseArgs(["-m", "One"], work), { cwd: work, env: ENV, runOne });
        assert.equal(r.code, 2);
        assert.match(r.lines[0], /^finish: not pushed — feat moved while the recipes ran, from [0-9a-f]{7} to [0-9a-f]{7}, so they did not judge what it holds; both commits stay, unpushed: run this again\.$/);
        assert.equal(onOrigin(origin, "feat"), "");
        assert.equal(git(work, ["log", "-1", "--format=%s"]), "not judged");
    });

    test("a push the remote refuses leaves the green commit and never forces", () => {
        const { work, origin } = clone();
        change(work);
        assert.equal(close(work, ["-m", "One"]).code, 0);
        // Someone else moves the remote branch.
        const other = path.join(path.dirname(work), "other");
        git(path.dirname(work), ["clone", "-q", "-b", "feat", origin, other]);
        write(other, "g.txt", "theirs\n");
        git(other, ["add", "-A"]);
        git(other, ["commit", "-q", "-m", "theirs"]);
        git(other, ["push", "-q", "origin", "feat"]);
        const theirs = onOrigin(origin, "feat");
        fs.appendFileSync(path.join(work, "f.txt"), "two\n");
        const r = close(work, ["-m", "Two"]);
        assert.equal(r.code, 2);
        assert.match(r.first, /^finish: not pushed — origin refused feat: ! \[rejected\] [0-9a-f]{40} -> feat \(fetch first\)\. The commit [0-9a-f]{7} is green and stays; if the remote moved, merge it in, never force/);
        assert.equal(onOrigin(origin, "feat"), theirs, "their commit is still the remote's");
    });
});

describe("what it refuses to do at all", () => {
    test("it never closes a change on the base branch", () => {
        const { work, origin } = clone();
        git(work, ["checkout", "-q", "main"]);
        change(work);
        const before = onOrigin(origin, "main");
        const r = close(work, ["-m", "One"]);
        assert.equal(r.code, 2);
        assert.match(r.first, /main would push to origin\/main, the branch changes merge into/);
        assert.equal(onOrigin(origin, "main"), before);
    });

    test("nor against a base that names no branch, since nothing then shows the push is not to it", () => {
        const { work, origin } = clone();
        git(work, ["checkout", "-q", "main"]);
        change(work);
        git(work, ["remote", "set-head", "origin", "-d"]);
        const sha = git(work, ["rev-parse", "origin/main"]);
        const r = close(work, ["-m", "One", "--base", sha]);
        assert.equal(r.code, 2);
        assert.equal(r.first, `finish: could not run — the base ${sha} names no branch, so nothing shows main is not the branch changes merge into: pass --base <remote>/<branch>`);
        assert.equal(onOrigin(origin, "main"), sha, "main is untouched");
    });

    test("a base from the environment that begins with a dash is refused before git reads it as a flag", () => {
        const { work } = clone();
        change(work);
        let out = "";
        const code = run(["-m", "One"], { cwd: work, env: { ...ENV, PORTULAN_BASE_REF: "--all" }, stdout: { write: (x) => (out += x) }, stderr: { write: () => {} } });
        assert.equal(code, 2);
        assert.equal(out.trim(), 'finish: could not run — the base "--all", from PORTULAN_BASE_REF, is not a ref: a ref never begins with a dash');
    });

    test("a base on another remote names its branch, as a fork's upstream does", () => {
        const { work, origin } = clone();
        git(work, ["remote", "add", "upstream", origin]);
        git(work, ["fetch", "-q", "upstream"]);
        change(work);
        const r = close(work, ["-m", "One", "--base", "upstream/main"]);
        assert.equal(r.code, 0, r.out);
        assert.match(r.first, /; pushed to origin\/feat$/);
    });

    test("nor on a detached HEAD", () => {
        const { work } = clone();
        git(work, ["checkout", "-q", "--detach"]);
        assert.match(close(work, ["-m", "One"]).first, /HEAD is detached/);
    });

    test("work to commit needs a message", () => {
        const { work } = clone();
        change(work);
        const r = close(work, []);
        assert.equal(r.code, 2);
        assert.match(r.first, /no message was given: pass -m <subject> or -F <file>/);
    });

    test("a base it cannot find is could-not-run, never a guess", () => {
        const { work } = clone();
        change(work);
        assert.match(close(work, ["-m", "One", "--base", "origin/nowhere"]).first, /the base "origin\/nowhere" is not a commit here/);
    });

    test("where the clone never recorded the remote's head, the remote is asked for it", () => {
        const { work } = clone();
        git(work, ["remote", "set-head", "origin", "-d"]);
        change(work);
        const r = close(work, ["-m", "One"]);
        assert.equal(r.code, 0, r.out);
    });
});

describe("arguments", () => {
    test("each value is refused missing, empty, or a flag where a value belongs", () => {
        assert.match(parseArgs(["-m"]).error, /-m needs a value/);
        assert.match(parseArgs(["-m", " "]).error, /empty value/);
        assert.match(parseArgs(["--base", "--workspace"]).error, /a flag rather than a value/);
        assert.match(parseArgs(["--push"]).error, /unknown argument "--push"/);
        assert.match(parseArgs(["-m", "a", "-F", "-"]).error, /pass one of them/);
        assert.match(parseArgs(["--pack-root", "no-such-directory"]).error, /is not a directory/);
    });

    test("a paragraph may open with a dash, as a message can", () => {
        assert.deepEqual(parseArgs(["-m", "- a list", "-m", "Subject"]).paragraphs, ["- a list", "Subject"]);
    });

    test("--help prints the usage and exits 0", () => {
        let out = "";
        assert.equal(run(["--help"], { stdout: { write: (s) => (out += s) } }), 0);
        assert.match(out, /^usage: node cli\/finish\.mjs -m <subject>/);
    });

    test("an unknown argument exits 2 with the usage on stderr", () => {
        let err = "";
        assert.equal(run(["--amend"], { stderr: { write: (s) => (err += s) }, stdout: { write: () => {} } }), 2);
        assert.match(err, /^finish: unknown argument "--amend"\nusage:/);
    });

    test("finish is callable without the entry point, for a runner of its own", () => {
        const { work } = clone();
        change(work);
        const calls = [];
        const result = finish({ ...parseArgs(["-m", "One"]) }, { cwd: work, env: ENV, runOne: (recipe) => (calls.push(recipe.id), { id: recipe.id, outcome: "green" }) });
        assert.equal(result.code, 0, result.lines.join("\n"));
        assert.deepEqual(calls, ["docs"]);
    });
});
