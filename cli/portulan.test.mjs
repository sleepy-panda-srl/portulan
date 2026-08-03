// Tests for the `npx` entry point, written before it — the convention every tool in this directory
// but `stop-gate` follows.
//
// What these establish is **dispatch**, and only dispatch: that the right module is reached, that
// its arguments arrive unchanged, that its exit code comes back unchanged, and that every refusal
// exits 2 rather than 0. What they deliberately do NOT re-establish is anything `doctor`, `compile`
// or `index` already prove about themselves — those have their own suites, and asserting their
// behaviour here would make this file a second carrier of it.
//
// The loader is injected for exactly that reason. Dispatch is testable without running a validator,
// and a test that shelled out to the real tools would be measuring them again and would go red when
// their output changed rather than when this file broke.
//
// **Two cases deliberately break that rule, and both are at the bottom of this file with their
// reasons.** One imports the real modules to check they still export `run`; the other spawns this
// file through a SYMLINK. The second exists because the first cut of the entry point shipped a
// main-module guard that was false through npm's bin link — the packaged CLI did nothing and exited
// 0 — and **nothing in a suite built only on injection can see that**, since injection is precisely
// the path that skips the guard.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { run, usage, find, SUBCOMMANDS, VERSION } from "./portulan.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// A recorder standing in for the tool modules: it captures what it was handed and returns the code
// it was told to.
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
    // Split from the single equality this was, when row 7's `new` and `feedback` landed. The **property**
    // this test existed for is not "there are six" — it is that the human-owned list is authoritative and
    // its order is not an implementer's to rearrange. Asserted on the prefix, so it survived first the row
    // adding to the tail and then the constitution absorbing both additions. A test rewritten to
    // `deepEqual` the new eight would have kept passing while quietly giving up the thing it guarded.
    assert.deepEqual(
        SUBCOMMANDS.slice(0, 6).map((entry) => entry.name),
        ["init", "doctor", "compile", "vendor", "index", "upgrade"],
    );
});

test("the additions past the six are exactly the two row 7 names", () => {
    // These two reached the CLI licensed by row 7 naming them in its own ratified text, and the
    // maintainer folded both into `docs/vision.md` on 2026-08-03 — so the constitution now names all
    // eight and this assertion pins the ORDER of the tail rather than a licence argument. Anything
    // appearing here that neither document names is an implementer minting a subcommand into a
    // human-owned surface, which is what the next test refuses.
    assert.deepEqual(
        SUBCOMMANDS.slice(6).map((entry) => entry.name),
        ["new", "feedback"],
    );
});

test("an unbuilt subcommand's refusal names where it is ACTUALLY named", async () => {
    // The shipped tool told users `feedback` is named in docs/vision.md. That file contains the word
    // zero times — `feedback` comes from row 7 of docs/plan.md, which is this file's whole licence
    // argument for carrying eight rather than six. cli/README.md said it correctly while the code
    // contradicted it. Found at the pre-commit checkpoint, and it survived because **no test asserted
    // the string**; this is that test.
    // **This test's premise moved on 2026-08-03 and the tripwire is what said so.** It asserted that
    // `docs/vision.md` mentions `feedback` zero times — true when written, because the name was licensed
    // by row 7 alone — and the maintainer then folded both row-named subcommands into the constitution.
    // The assertion failed with the sentence written for exactly that case rather than cryptically,
    // which is the argument for spending a line on a premise check inside a test that depends on one.
    //
    // What it asserts now is the invariant underneath: an unbuilt subcommand's refusal names the
    // document that ACTUALLY names it, whichever that is.
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

test("plugin-lint and librarian are NOT subcommands — anything unnamed is the maintainer's call", () => {
    // This is a rule, not an omission, so it is asserted rather than left to be noticed. Both tools
    // exist in this directory and are invoked directly by verify recipes; adding either here would mint
    // a subcommand neither vision.md nor row 7 names.
    assert.equal(find("plugin-lint"), null);
    assert.equal(find("librarian"), null);
});

test("a built subcommand reaches its module and its arguments arrive unchanged", async () => {
    const h = harness({ code: 0 });
    const code = await run(["doctor", ".portulan", "--pack-root", "packs"], h.options);
    assert.equal(code, 0);
    assert.deepEqual(h.loaded, ["doctor.mjs"]);
    assert.deepEqual(h.argv(), [".portulan", "--pack-root", "packs"]);
});

test("the tool's exit code is returned unchanged, including its red", async () => {
    // 1 is a verdict about somebody's workspace. Re-mapping it here would put a second opinion
    // between the tool and its user, which is the whole reason this wrapper adds nothing.
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

test("an unbuilt subcommand exits 2 and names where it arrives — never 0", async () => {
    // `init` left this list at milestone 7, session 1, when it was built. The list is written out
    // rather than derived from `SUBCOMMANDS` on purpose: deriving it would make the assertion
    // vacuously true the moment a subcommand's `module` was set, and the whole point is that a
    // subcommand crossing from unbuilt to built is a change somebody looked at.
    for (const name of ["vendor", "upgrade", "feedback"]) {
        const h = harness();
        const code = await run([name], h.options);
        assert.equal(code, 2, `${name} must exit 2, not 0 — a silent success here is a fail-open`);
        assert.deepEqual(h.loaded, [], "an unbuilt subcommand must not try to load anything");
        assert.match(h.warned.join("\n"), /not built yet/);
        assert.match(h.warned.join("\n"), /milestone 7/);
    }
});

test("every unbuilt subcommand names where it arrives, per dod.md condition 4", () => {
    for (const entry of SUBCOMMANDS.filter((s) => !s.module)) {
        assert.ok(entry.arrives, `${entry.name} is unbuilt and must name where it arrives`);
    }
});

test("an unknown subcommand exits 2 and lists the six", async () => {
    const h = harness();
    const code = await run(["lint"], h.options);
    assert.equal(code, 2);
    assert.match(h.warned.join("\n"), /unknown subcommand `lint`/);
    assert.match(h.warned.join("\n"), /init, doctor, compile, vendor, index, upgrade/);
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

test("the usage screen lists all eight and marks the unbuilt ones", () => {
    const text = usage();
    for (const entry of SUBCOMMANDS) {
        assert.match(text, new RegExp(`\\b${entry.name}\\b`), `usage must list ${entry.name}`);
    }
    // One not-built marker per unbuilt subcommand — counted rather than merely present, so a
    // subcommand quietly losing its marker is a red. The expected number is derived from
    // `SUBCOMMANDS` rather than written as a literal: the literal was `3`, it became wrong the hour
    // `init` was built, and a figure that has to be edited by hand every time a subcommand ships is
    // a second carrier of how far this row has got. What is asserted is the invariant — one marker
    // each, and none for a built one — which is the part that must never drift.
    const unbuilt = SUBCOMMANDS.filter((entry) => !entry.module);
    assert.equal((text.match(/not built/g) ?? []).length, unbuilt.length);
    for (const entry of SUBCOMMANDS.filter((s) => s.module)) {
        const line = text.split("\n").find((l) => l.trim().startsWith(entry.name));
        // The `ok` first, because `find` returns undefined when the usage screen's formatting moves
        // and `doesNotMatch(undefined, …)` throws a TypeError — a failure that tells the next reader
        // about assert's argument checking rather than about the missing line. Found by review on the
        // pull request.
        assert.ok(line, `usage lists no line for the built subcommand \`${entry.name}\``);
        assert.doesNotMatch(line, /not built/, `${entry.name} is built and must not be marked otherwise`);
    }
    assert.match(text, /docs\/vision\.md names these eight/);
});

test("`init` really dispatches through the entry point, with the real loader", async () => {
    // Every other case here injects the loader, which is right — re-asserting what `doctor` or
    // `index` already prove would make this file a second carrier of it. But injection cannot show
    // that a subcommand is REACHABLE, only that the dispatcher would reach it if the module were
    // what the harness says. `cli/README.md` claims `init` is exercised through the entry point as
    // well as directly, and until this test existed that claim rested on the run-export check alone
    // — a softer thing than the sentence said. Found at the pre-commit checkpoint, in its minor set.
    //
    // Spawned rather than called, and that is forced rather than chosen: the dispatcher hands the
    // subcommand its argv and NOTHING else — no `say`, no `warn` — because adding anything would put
    // a second opinion between the tool and its user. So the subcommand writes to the real stdout,
    // and the only place to observe it is a real process. The constraint that made this test awkward
    // is the property the entry point exists to have.
    //
    // `init --help` proves dispatch without touching a filesystem: the text is `init`'s own.
    const { execFileSync } = await import("node:child_process");
    const text = execFileSync(process.execPath, [path.join(HERE, "portulan.mjs"), "init", "--help"], { encoding: "utf8" });
    assert.match(text, /--residence/, "the text must be init's own, not the entry point's usage screen");
    assert.doesNotMatch(text, /docs\/vision\.md names these eight/, "that line belongs to the entry point's own help, which is not what was asked for");
});

test("the real modules the manifest points at all export a run function", async () => {
    // The one test here that touches the real files. It imports them rather than running them: the
    // injected loader above makes every other case fast and hermetic, but nothing in those cases
    // would notice if `doctor.mjs` stopped exporting `run` — which is the single assumption this
    // entry point rests on.
    for (const entry of SUBCOMMANDS.filter((s) => s.module)) {
        const module = await import(`./${entry.module}`);
        assert.equal(typeof module.run, "function", `${entry.module} must export run`);
    }
});

// ---------------------------------------------------------------- the one case that runs the file
//
// Every test above imports `run` and injects a loader, which is right for dispatch and **blind to
// the only line that decides whether the published package works at all**: the main-module guard.
//
// npm installs a `bin` as a SYMLINK. Node realpaths the main module for `import.meta.url` while
// `process.argv[1]` keeps the link path, so a bare comparison of the two is false through the link
// and `run` never runs. That shipped in this file's first cut and was found by a pre-commit
// checkpoint that packed the tarball instead of reading the guard: through `node_modules/.bin`,
// `--version` printed nothing and exited 0, and `doctor <nonexistent>` exited **0** where a checkout
// exits 1. Every verdict became a silent success, on the route the README tells people to use.
//
// So this spawns the file through a symlink — the shape npm creates — rather than trusting the
// guard by reading it. A unit test cannot observe this: the bug lives in the branch a unit test
// bypasses by importing.
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

        // And the fail-open the bug actually caused: a red verdict must still be red through the
        // link. Asserted separately, because a version string printing is a weaker signal than a
        // non-zero exit surviving the same path.
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
    // The source, not just the value: a re-introduced literal would still pass the equality above
    // on the day it was written and drift the day after.
    const source = fs.readFileSync(path.join(HERE, "portulan.mjs"), "utf8");
    assert.ok(
        !new RegExp(`VERSION\\s*=\\s*["']${manifest.version.replace(/\./g, "\\.")}["']`).test(source),
        "VERSION is assigned a literal again — read it from package.json instead",
    );
});
