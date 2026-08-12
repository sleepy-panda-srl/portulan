// `upgrade` against real workspaces rather than against its own fixtures.
//
//   node --test "cli/**/*.test.mjs"
//
// `upgrade.test.mjs` builds `ws` views in memory, which is the honest way to force a step's branches
// red and is **also** the way a suite ends up agreeing with itself. This file is the other half, and
// it exists because this repository has measured seven instances of a harness inheriting the blind
// spot of the change it checks — and because this session found an eighth **by running the step over
// `.portulan`**: a handoff that documents the marker in a sentence was read as a malformed marked
// line, and `upgrade` refused the one workspace this repository owns. Every unit test passed. No
// fixture had ever written about itself.
//
// So the rule this file enforces on itself: **nothing here constructs a workspace by hand.** The
// drafts come from the real `init`, the bundle really goes away, and the rail is really run.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { run } from "./upgrade.mjs";
import { MARKER } from "../spec/migrations/0002-bundle-fallback-path.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

const scratches = [];
/**
 * A scratch directory, **realpathed** — and the realpath is load-bearing here, not tidiness.
 *
 * On macOS `os.tmpdir()` runs through `/var`, which is a symlink to `/private/var`. Node resolves
 * symlinks when it computes `import.meta.url` and does not when it hands over `process.argv[1]`, so
 * every tool in `cli/` that guards its entry point with the bare comparison — which is all of them
 * except `portulan.mjs`, and rightly, since nothing invokes them through a link in production —
 * sees the two disagree and **never runs**. Measured here: `node <tmpdir>/cli/init.mjs …` exited
 * **0**, printed nothing, and drafted nothing. A harness that had not realpathed would have read
 * that as `init` succeeding and then failed somewhere far away from the cause.
 */
function scratch() {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "portulan-upgrade-live-")));
    scratches.push(dir);
    return dir;
}
process.on("exit", () => {
    for (const dir of scratches) fs.rmSync(dir, { recursive: true, force: true });
});

function harness() {
    const out = [];
    const err = [];
    return { text: () => `${out.join("")}${err.join("")}`, options: { stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } } };
}

/**
 * A second bundle — the real `cli/` and `spec/`, at a path that is not this checkout.
 *
 * `cli/init.mjs` bakes `path.resolve(HERE, "..")` into the rail it drafts, so drafting FROM here
 * would bake this checkout and the repair would have nothing to do. The whole subject of the repair
 * is a workspace whose drafting bundle is somewhere else, and the only way to produce one is to
 * really draft it from somewhere else.
 */
function secondBundle() {
    const bundle = scratch();
    for (const dir of ["cli", "spec"]) fs.cpSync(path.join(REPO, dir), path.join(bundle, dir), { recursive: true });
    return bundle;
}

/** Run a drafted rail the way a pipeline would: no `portulan` on PATH, no `PORTULAN_CLI`. */
function runRail(repoDir) {
    const nodeDir = path.dirname(process.execPath);
    try {
        const out = execFileSync("bash", [path.join(repoDir, ".portulan", "verify", "index.sh")], {
            cwd: repoDir,
            encoding: "utf8",
            stdio: "pipe",
            env: { ...process.env, PORTULAN_CLI: "", PATH: `${nodeDir}:/usr/bin:/bin` },
        });
        return { code: 0, out };
    } catch (error) {
        return { code: error.status, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
    }
}

/** Draft a workspace with the REAL `init`, from `bundle`, into a fresh repository directory. */
function draft(bundle, args) {
    const repoDir = scratch();
    fs.mkdirSync(path.join(repoDir, ".git"));
    execFileSync("node", [path.join(bundle, "cli", "init.mjs"), ...args, repoDir], { encoding: "utf8", stdio: "pipe" });
    return repoDir;
}

// ===========================================================================================

describe("the workspaces this repository actually owns", () => {
    test("`.portulan` owes nothing — and a change that makes it owe something is visible here", async () => {
        const h = harness();
        assert.equal(await run([path.join(REPO, ".portulan")], h.options), 0, h.text());
        assert.match(h.text(), /owes nothing/);
    });

    test("`examples/` owes nothing, and is NOT restamped off 2.4", async () => {
        // `examples/` sitting four MINORs behind is deliberate compatibility evidence — `spec/README.md`
        // leans on it across every bump. A chain that restamped MINORs would eat it, so this asserts
        // both the verdict and the version.
        const before = fs.readFileSync(path.join(REPO, "examples", "workspace.json"), "utf8");
        const h = harness();
        assert.equal(await run([path.join(REPO, "examples"), "--check"], h.options), 0, h.text());
        assert.equal(JSON.parse(before).portulan.spec, "2.4");
        assert.equal(fs.readFileSync(path.join(REPO, "examples", "workspace.json"), "utf8"), before);
    });
});

describe("the repair, end to end, on a workspace that really travelled", () => {
    test("the drafted rail exits 2 when its bundle is gone, and renders a verdict after `upgrade --write`", async () => {
        const bundle = secondBundle();
        const repoDir = draft(bundle, ["--residence", "in-repo", "--no-cycle"]);
        const rail = path.join(repoDir, ".portulan", "verify", "index.sh");

        // 1. The draft really did bake the other bundle.
        const drafted = fs.readFileSync(rail, "utf8");
        assert.equal(drafted.split("\n").filter((l) => l.includes(MARKER)).length, 2, "init did not draft the marked lines");
        assert.ok(drafted.includes(bundle), "init baked a bundle that is not the one it ran from");

        // 2. The workspace travels: the drafting bundle is gone. This is what a clone, or a
        //    `vendor --switch` onto another machine, leaves behind.
        fs.rmSync(bundle, { recursive: true, force: true });

        const stale = runRail(repoDir);
        assert.equal(stale.code, 2, `a rail whose bundle is gone must be could-not-run, got ${stale.code}:\n${stale.out}`);
        assert.match(stale.out, /NOT checked/);

        // 3. `upgrade` sees it, and says so before it is asked to fix it.
        const checked = harness();
        assert.equal(await run([path.join(repoDir, ".portulan"), "--check"], checked.options), 1, checked.text());
        assert.match(checked.text(), /0002-bundle-fallback-path/);

        // 4. Repaired.
        const written = harness();
        assert.equal(await run([path.join(repoDir, ".portulan"), "--write"], written.options), 0, written.text());

        // 5. And the rail is a rail again — RUN, not read. This is the assertion the whole step
        //    exists for, and a string comparison on the script would not have made it.
        const repaired = runRail(repoDir);
        assert.notEqual(repaired.code, 2, `the repaired rail still could not run:\n${repaired.out}`);
        assert.equal(repaired.code, 0, `the repaired rail should be green on a freshly drafted workspace:\n${repaired.out}`);
    });

    test("running it twice changes nothing — idempotence on a real draft, not a fixture", async () => {
        const bundle = secondBundle();
        const repoDir = draft(bundle, ["--residence", "in-repo", "--no-cycle"]);
        fs.rmSync(bundle, { recursive: true, force: true });
        const rail = path.join(repoDir, ".portulan", "verify", "index.sh");

        assert.equal(await run([path.join(repoDir, ".portulan"), "--write"], harness().options), 0);
        const once = fs.readFileSync(rail, "utf8");
        const mode = fs.statSync(rail).mode;

        const second = harness();
        assert.equal(await run([path.join(repoDir, ".portulan"), "--write"], second.options), 0, second.text());
        assert.match(second.text(), /owes nothing/, "the second run found work to do");
        assert.equal(fs.readFileSync(rail, "utf8"), once, "the second run rewrote the rail");
        assert.equal(fs.statSync(rail).mode, mode);
    });
});

describe("either residence — the row's own words", () => {
    test("a real `init`-drafted pointer resolves to the workspace that governs it", async () => {
        const bundle = secondBundle();

        // The governing workspace, drafted for real, installed into a host record.
        const govRepo = draft(bundle, ["--residence", "in-repo", "--no-cycle", "--name", "acme-platform"]);
        const config = scratch();
        fs.mkdirSync(path.join(config, "plugins"), { recursive: true });
        fs.writeFileSync(
            path.join(config, "plugins", "installed_plugins.json"),
            `${JSON.stringify(
                { version: 2, plugins: { "acme-platform@acme-feed": [{ scope: "user", installPath: govRepo, version: "1.2.3" }] } },
                null,
                2,
            )}\n`,
        );

        // And the repository that points at it.
        const pointerRepo = draft(bundle, ["--residence", "pointer", "--governed-by", "acme-platform"]);

        const h = harness();
        const code = await run([path.join(pointerRepo, ".portulan")], { ...h.options, env: { CLAUDE_CONFIG_DIR: config } });
        assert.match(h.text(), /acme-platform/, h.text());
        assert.match(h.text(), /is installed here/, "the resolver's own sentence did not reach the reader");
        assert.notEqual(code, 2, `resolution should not be could-not-run:\n${h.text()}`);
    });

    test("the ADVICE for a resolved install does not name the command the tool then refuses", async () => {
        // Caught by mutation while folding the pre-commit adjustments: the fix for this had no test,
        // so reverting it stayed green. A resolved install that owes steps used to be told "run with
        // --write to apply them" — the exact invocation `--write` then refuses with exit 2. Advice
        // and refusal disagreeing about the same act is the sibling of the refusal itself.
        const bundle = secondBundle();
        const govRepo = draft(bundle, ["--residence", "in-repo", "--no-cycle", "--name", "acme-platform"]);
        fs.rmSync(bundle, { recursive: true, force: true }); // the install now owes the repair
        const config = scratch();
        fs.mkdirSync(path.join(config, "plugins"), { recursive: true });
        fs.writeFileSync(
            path.join(config, "plugins", "installed_plugins.json"),
            `${JSON.stringify(
                { version: 2, plugins: { "acme-platform@acme-feed": [{ scope: "user", installPath: govRepo, version: "1.2.3" }] } },
                null,
                2,
            )}\n`,
        );
        const pointerRepo = draft(secondBundle(), ["--residence", "pointer", "--governed-by", "acme-platform"]);

        const h = harness();
        await run([path.join(pointerRepo, ".portulan")], { ...h.options, env: { CLAUDE_CONFIG_DIR: config } });
        assert.match(h.text(), /0002-bundle-fallback-path/, `the install should owe the repair:\n${h.text()}`);
        assert.doesNotMatch(h.text(), /run with --write/, "it advised the one command it refuses");
        assert.match(h.text(), /own directory/i, "and it must say where the migration actually belongs");
    });

    test("`--write` against a pointer refuses to migrate the install, and touches nothing", async () => {
        const bundle = secondBundle();
        const govRepo = draft(bundle, ["--residence", "in-repo", "--no-cycle", "--name", "acme-platform"]);
        const config = scratch();
        fs.mkdirSync(path.join(config, "plugins"), { recursive: true });
        fs.writeFileSync(
            path.join(config, "plugins", "installed_plugins.json"),
            `${JSON.stringify(
                { version: 2, plugins: { "acme-platform@acme-feed": [{ scope: "user", installPath: govRepo, version: "1.2.3" }] } },
                null,
                2,
            )}\n`,
        );
        const pointerRepo = draft(bundle, ["--residence", "pointer", "--governed-by", "acme-platform"]);
        const manifest = path.join(govRepo, ".portulan", "workspace.json");
        const before = fs.readFileSync(manifest, "utf8");

        const h = harness();
        const code = await run([path.join(pointerRepo, ".portulan"), "--write"], { ...h.options, env: { CLAUDE_CONFIG_DIR: config } });
        assert.equal(code, 2, h.text());
        assert.match(h.text(), /installed workspace/i);
        assert.equal(fs.readFileSync(manifest, "utf8"), before, "it wrote into an installed workspace");
    });
});
