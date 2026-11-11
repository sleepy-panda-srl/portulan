// Tests for the `npx` entry point: dispatch through an injected loader, its refusals, and its version.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { run, usage, find, SUBCOMMANDS, VERSION } from "./portulan.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function harness({ code = 0, throws = null, noRun = false } = {}) {
    const said = [];
    const warned = [];
    const loaded = [];
    let received = null;
    const options = {
        say: (line) => said.push(line),
        warn: (line) => warned.push(line),
        load: async (file) => {
            loaded.push(file);
            if (throws) throw new Error(throws);
            if (noRun) return {};
            return {
                run: async (argv) => {
                    received = argv;
                    return code;
                },
            };
        },
    };
    return { options, said, warned, loaded, argv: () => received };
}

test("docs/vision.md's six lead the list, in its order and unaltered", () => {
    assert.deepEqual(
        SUBCOMMANDS.slice(0, 6).map((entry) => entry.name),
        ["init", "doctor", "compile", "vendor", "index", "upgrade"],
    );
});

test("the additions past the constitution's original six are exactly the three it was amended to name", () => {
    assert.deepEqual(
        SUBCOMMANDS.slice(6).map((entry) => entry.name),
        ["new", "feedback", "finish"],
    );
});

test("docs/vision.md's delivery tiers name every subcommand, in the list's order", () => {
    const vision = fs.readFileSync(path.join(HERE, "..", "docs", "vision.md"), "utf8");
    const tier = /\(2\) `npx` CLI:([\s\S]*?)\(3\) vendored standards mode/.exec(vision)?.[1];
    assert.ok(tier, "docs/vision.md no longer carries the `npx` CLI tier this test reads");
    const at = SUBCOMMANDS.map((entry) => tier.indexOf(`\`${entry.name}\``));
    assert.ok(!at.includes(-1), `docs/vision.md does not name ${SUBCOMMANDS.filter((_, i) => at[i] === -1).map((s) => s.name).join(", ")}`);
    assert.deepEqual(at, [...at].sort((a, b) => a - b));
});

test("an unbuilt subcommand's refusal names where it is ACTUALLY named", async () => {
    const vision = fs.readFileSync(path.join(HERE, "..", "docs", "vision.md"), "utf8");
    for (const entry of SUBCOMMANDS.filter((e) => !e.module)) {
        const expected = entry.namedIn ?? "docs/vision.md";
        if (!entry.namedIn) {
            assert.match(vision, new RegExp(`\\b${entry.name}\\b`), `${entry.name} claims docs/vision.md names it, and that file does not`);
        }
        const h = harness({ noRun: true });
        await run([entry.name], h.options);
        assert.match(h.warned.join("\n"), new RegExp(expected.replace(/[/.]/g, "\\$&")), `${entry.name}'s refusal must name ${expected}`);
    }
});

test("the tools that are not subcommands stay out — anything unnamed is the maintainer's call", () => {
    for (const name of ["plugin-lint", "librarian", "discover", "control-chars"]) {
        assert.equal(find(name), null, `${name} is a tool in cli/, not a subcommand`);
    }
    for (const name of ["gate", "stop-gate"]) {
        assert.equal(find(name), null, `${name} is a compiled-hook runner, not a subcommand`);
    }
});

test("a built subcommand reaches its module and its arguments arrive unchanged", async () => {
    const h = harness({ code: 0 });
    const code = await run(["doctor", ".portulan", "--pack-root", "packs"], h.options);
    assert.equal(code, 0);
    assert.deepEqual(h.loaded, ["doctor.mjs"]);
    assert.deepEqual(h.argv(), [".portulan", "--pack-root", "packs"]);
});

test("the tool's exit code is returned unchanged, including its red", async () => {
    for (const code of [0, 1, 2]) {
        const h = harness({ code });
        assert.equal(await run(["compile", "--check"], h.options), code);
    }
});

test("each built subcommand loads its own module and no other", async () => {
    for (const [name, file] of [["doctor", "doctor.mjs"], ["compile", "compile.mjs"], ["index", "index.mjs"]]) {
        const h = harness();
        await run([name], h.options);
        assert.deepEqual(h.loaded, [file], `${name} must load exactly ${file}`);
    }
});

test("modules are loaded lazily — help imports nothing", async () => {
    const h = harness();
    await run(["--help"], h.options);
    assert.deepEqual(h.loaded, [], "the help screen must not pay for doctor");
});

test("NOTHING is unbuilt any more — the list emptied at milestone 7 session 9", () => {
    assert.deepEqual(
        SUBCOMMANDS.filter((entry) => !entry.module).map((entry) => entry.name),
        [],
        "a subcommand is unbuilt again — give it `arrives`, and restore a case that exercises its refusal for real",
    );
});

test("the refusal for an unbuilt subcommand still works, exercised on a synthetic entry", async () => {
    // Safe to mutate: node:test runs a file's tests in sequence, and `finally` restores the list.
    SUBCOMMANDS.push({ name: "zzz-not-built", module: null, arrives: "a later milestone", summary: "a synthetic entry" });
    try {
        const h = harness();
        const code = await run(["zzz-not-built"], h.options);
        assert.equal(code, 2, "a silent success here is a fail-open");
        assert.deepEqual(h.loaded, [], "an unbuilt subcommand must not try to load anything");
        assert.match(h.warned.join("\n"), /not built yet/);
        assert.match(h.warned.join("\n"), /a later milestone/);
    } finally {
        SUBCOMMANDS.pop();
    }
});

test("every unbuilt subcommand names where it arrives, per dod.md condition 4", () => {
    // Empty while every subcommand is built; it binds again once one is listed ahead of its module.
    for (const entry of SUBCOMMANDS.filter((s) => !s.module)) {
        assert.ok(entry.arrives, `${entry.name} is unbuilt and must name where it arrives`);
    }
});

test("an unknown subcommand exits 2 and lists every one", async () => {
    const h = harness();
    const code = await run(["lint"], h.options);
    assert.equal(code, 2);
    assert.match(h.warned.join("\n"), /unknown subcommand `lint`/);
    assert.match(h.warned.join("\n"), /the 9 subcommands are init, doctor, compile, vendor, index, upgrade, new, feedback, finish\./);
});

test("no subcommand at all prints usage and exits 2", async () => {
    const h = harness();
    const code = await run([], h.options);
    assert.equal(code, 2, "running nothing is could-not-run, not success");
    assert.match(h.said.join("\n"), /portulan <subcommand>/);
});

test("an explicit --help exits 0, because asking for help is a request that succeeded", async () => {
    for (const flag of ["--help", "-h", "help"]) {
        const h = harness();
        assert.equal(await run([flag], h.options), 0, `${flag} must exit 0`);
    }
});

test("--version prints the version and exits 0", async () => {
    for (const flag of ["--version", "-v", "version"]) {
        const h = harness();
        assert.equal(await run([flag], h.options), 0);
        assert.deepEqual(h.said, [VERSION]);
    }
});

test("a module that will not load exits 2 and says which file", async () => {
    const h = harness({ throws: "Unexpected token" });
    const code = await run(["doctor"], h.options);
    assert.equal(code, 2);
    assert.match(h.warned.join("\n"), /could not load `doctor` from doctor\.mjs/);
});

test("a module without a run export is refused rather than crashed into", async () => {
    const h = harness({ noRun: true });
    const code = await run(["index"], h.options);
    assert.equal(code, 2);
    assert.match(h.warned.join("\n"), /does not export a `run` function/);
});

test("the usage screen lists every subcommand and marks the unbuilt ones", () => {
    const text = usage();
    for (const entry of SUBCOMMANDS) {
        assert.match(text, new RegExp(`\\b${entry.name}\\b`), `usage must list ${entry.name}`);
    }
    const unbuilt = SUBCOMMANDS.filter((entry) => !entry.module);
    assert.equal((text.match(/not built/g) ?? []).length, unbuilt.length);
    for (const entry of SUBCOMMANDS.filter((s) => s.module)) {
        const line = text.split("\n").find((l) => l.trim().startsWith(entry.name));
        // Before doesNotMatch, which throws a TypeError on undefined instead of naming the missing line.
        assert.ok(line, `usage lists no line for the built subcommand \`${entry.name}\``);
        assert.doesNotMatch(line, /not built/, `${entry.name} is built and must not be marked otherwise`);
    }
    assert.match(text, /docs\/vision\.md names these subcommands/);
    assert.doesNotMatch(text, /\beight\b|\bninth\b/, "a count written into the help goes stale when the list moves");
});

test("`init` really dispatches through the entry point, with the real loader", async () => {
    // Spawned: the dispatcher hands a subcommand only its argv, so its output reaches only the real stdout.
    const { execFileSync } = await import("node:child_process");
    const text = execFileSync(process.execPath, [path.join(HERE, "portulan.mjs"), "init", "--help"], { encoding: "utf8" });
    assert.match(text, /--residence/, "the text must be init's own, not the entry point's usage screen");
    assert.doesNotMatch(text, /docs\/vision\.md names these subcommands/, "that line belongs to the entry point's own help, which is not what was asked for");
});

test("`feedback` really dispatches through the entry point, with the real loader", async () => {
    const { execFileSync } = await import("node:child_process");
    const text = execFileSync(process.execPath, [path.join(HERE, "portulan.mjs"), "feedback", "--help"], { encoding: "utf8" });
    assert.match(text, /--seam-terms/, "the text must be feedback's own, not the entry point's usage screen");
    assert.doesNotMatch(text, /docs\/vision\.md names these subcommands/);
});

test("`finish` reaches finish.mjs with its arguments unchanged, and its exit code comes back", async () => {
    for (const code of [0, 1, 2]) {
        const h = harness({ code });
        assert.equal(await run(["finish", "-m", "Subject", "--no-fragment", "why"], h.options), code);
        assert.deepEqual(h.loaded, ["finish.mjs"]);
        assert.deepEqual(h.argv(), ["-m", "Subject", "--no-fragment", "why"]);
    }
});

test("`finish` really dispatches through the entry point, with the real loader", () => {
    const entry = path.join(HERE, "portulan.mjs");
    const help = spawnSync(process.execPath, [entry, "finish", "--help"], { encoding: "utf8" });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /--no-fragment/, "the text must be finish's own, not the entry point's usage screen");
    assert.match(help.stdout, /portulan finish/, "the usage names the spelling an installed package answers to");
    assert.doesNotMatch(help.stdout, /docs\/vision\.md names these subcommands/);
    const direct = spawnSync(process.execPath, [path.join(HERE, "finish.mjs"), "--help"], { encoding: "utf8" });
    assert.equal(help.stdout, direct.stdout, "both spellings print the same usage");
    const refused = spawnSync(process.execPath, [entry, "finish", "--amend"], { encoding: "utf8" });
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /^finish: unknown argument "--amend"/);
});

test("the real modules the manifest points at all export a run function", async () => {
    for (const entry of SUBCOMMANDS.filter((s) => s.module)) {
        const module = await import(`./${entry.module}`);
        assert.equal(typeof module.run, "function", `${entry.module} must export run`);
    }
});

// ---------------------------------------------------------------- the published package
// npm installs a bin as a symlink: node realpaths `import.meta.url` but `argv[1]` keeps the link path.
test("the entry point runs when invoked through a symlink, which is how npm installs a bin", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-bin-"));
    try {
        const link = path.join(dir, "portulan");
        fs.symlinkSync(path.join(HERE, "portulan.mjs"), link);

        const version = spawnSync(process.execPath, [link, "--version"], { encoding: "utf8" });
        assert.equal(version.status, 0);
        assert.equal(
            version.stdout.trim(),
            VERSION,
            "the guard did not fire through the link — the installed CLI would do nothing and exit 0",
        );

        const missing = spawnSync(process.execPath, [link, "doctor", path.join(dir, "nope")], {
            encoding: "utf8",
        });
        assert.notEqual(missing.status, 0, "a failing subcommand must not become a success through the link");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("VERSION has ONE carrier — it is read from package.json, never written down twice", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(HERE, "..", "package.json"), "utf8"));
    assert.equal(VERSION, manifest.version);
    assert.notEqual(VERSION, "unknown", "the manifest read failed, so the version is a fallback rather than a fact");
    const source = fs.readFileSync(path.join(HERE, "portulan.mjs"), "utf8");
    assert.ok(
        !new RegExp(`VERSION\\s*=\\s*["']${manifest.version.replace(/\./g, "\\.")}["']`).test(source),
        "VERSION is assigned a literal again — read it from package.json instead",
    );
});

test("the two version fields nothing else checks agree with plugin.json", () => {
    const read = (...p) => JSON.parse(fs.readFileSync(path.join(HERE, "..", ...p), "utf8"));
    const pkg = read("package.json");
    const plugin = read(".claude-plugin", "plugin.json");
    const marketplace = read(".claude-plugin", "marketplace.json");

    assert.equal(
        pkg.version,
        plugin.version,
        `package.json says ${pkg.version} and .claude-plugin/plugin.json says ${plugin.version} — ` +
            "one repository ships under both, so one release cannot carry two numbers",
    );
    assert.equal(
        marketplace.version,
        plugin.version,
        `.claude-plugin/marketplace.json says ${marketplace.version} at its top level and ` +
            `plugin.json says ${plugin.version} — this field is checked by nothing else`,
    );
});

// No tag check: a release cut renames `## Unreleased` to its version before the tag exists.
test("package.json names the newest release in CHANGELOG.md — the maintainer's 2026-08-07 reading", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(HERE, "..", "package.json"), "utf8"));
    const changelog = fs.readFileSync(path.join(HERE, "..", "CHANGELOG.md"), "utf8");

    const headings = [...changelog.matchAll(/^## (\d+\.\d+\.\d+)\b/gm)].map((m) => m[1]);
    assert.ok(
        headings.length > 0,
        "CHANGELOG.md carries no `## <version>` release heading — this assertion has nothing to read, " +
            "which is a could-not-run wearing a green and the reason the count is checked first",
    );

    assert.equal(
        pkg.version,
        headings[0],
        `package.json says ${pkg.version} and the newest CHANGELOG.md release is ${headings[0]}. ` +
            "The manifest states the repository's CURRENT version — the maintainer's ruling of " +
            "2026-08-07 — so the two move together at a cut: rename `## Unreleased` to the new number " +
            "in the same change that bumps this manifest",
    );
});
