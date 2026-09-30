// `upgrade` against real workspaces, drafted by the real `init`, never against hand-built fixtures.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { run } from "./upgrade.mjs";
import { MARKER } from "../spec/migrations/0002-bundle-fallback-path.mjs";

// The tools read the host's installed-plugin record, so every case gets an empty host unless it passes `env:`.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

const scratches = [];
// Realpathed: macOS's tmpdir runs through a symlink, and there a tool's entry guard fails and it silently exits 0.
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

// `init` bakes its bundle's path into the rail it drafts, so a travelled workspace needs a bundle elsewhere.
function secondBundle() {
    const bundle = scratch();
    for (const dir of ["cli", "spec"]) fs.cpSync(path.join(REPO, dir), path.join(bundle, dir), { recursive: true });
    return bundle;
}

// No `portulan` on PATH and no `PORTULAN_CLI`, as in a pipeline: either would rescue a rail whose bundle is gone.
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

function draft(bundle, args) {
    const repoDir = scratch();
    fs.mkdirSync(path.join(repoDir, ".git"));
    execFileSync("node", [path.join(bundle, "cli", "init.mjs"), ...args, repoDir], { encoding: "utf8", stdio: "pipe" });
    return repoDir;
}


describe("the workspaces this repository actually owns", () => {
    test("`.portulan` owes nothing — and a change that makes it owe something is visible here", async () => {
        const h = harness();
        assert.equal(await run([path.join(REPO, ".portulan")], h.options), 0, h.text());
        assert.match(h.text(), /owes nothing/);
    });

    test("`examples/` owes nothing, and is NOT restamped off 2.4", async () => {
        // `examples/` stays on 2.4 on purpose, the demonstration that an old workspace survives each spec bump.
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

        const drafted = fs.readFileSync(rail, "utf8");
        assert.equal(drafted.split("\n").filter((l) => l.includes(MARKER)).length, 2, "init did not draft the marked lines");
        assert.ok(drafted.includes(bundle), "init baked a bundle that is not the one it ran from");

        fs.rmSync(bundle, { recursive: true, force: true });

        const stale = runRail(repoDir);
        assert.equal(stale.code, 2, `a rail whose bundle is gone must be could-not-run, got ${stale.code}:\n${stale.out}`);
        assert.match(stale.out, /NOT checked/);

        const checked = harness();
        assert.equal(await run([path.join(repoDir, ".portulan"), "--check"], checked.options), 1, checked.text());
        assert.match(checked.text(), /0002-bundle-fallback-path/);

        const written = harness();
        assert.equal(await run([path.join(repoDir, ".portulan"), "--write"], written.options), 0, written.text());

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

        const h = harness();
        const code = await run([path.join(pointerRepo, ".portulan")], { ...h.options, env: { CLAUDE_CONFIG_DIR: config } });
        assert.match(h.text(), /acme-platform/, h.text());
        assert.match(h.text(), /is installed here/, "the resolver's own sentence did not reach the reader");
        assert.notEqual(code, 2, `resolution should not be could-not-run:\n${h.text()}`);
    });

    test("the ADVICE for a resolved install does not name the command the tool then refuses", async () => {
        const bundle = secondBundle();
        const govRepo = draft(bundle, ["--residence", "in-repo", "--no-cycle", "--name", "acme-platform"]);
        fs.rmSync(bundle, { recursive: true, force: true });
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
