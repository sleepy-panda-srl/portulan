// Required checks name their resolution root, and every suite whose imports reach the host's plugin record empties it.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The required checks' invocations: a roster, not a sweep, as other callers legitimately name no root. */
const PINNED = Object.freeze([
    { file: ".portulan/verify/doctor.sh", tool: "cli/doctor.mjs" },
    { file: ".portulan/verify/compile.sh", tool: "cli/compile.mjs" },
    { file: ".portulan/verify/index.sh", tool: "cli/index.mjs" },
    { file: ".portulan/verify/plugin.sh", tool: "cli/skills-set.mjs" },
    { file: ".portulan/verify/goldens.sh", tool: "cli/goldens.mjs" },
    { file: ".portulan/verify/mutants.sh", tool: "cli/mutants.mjs" },
    { file: ".portulan/verify/fuzz-shell.sh", tool: "cli/fuzz-shell.mjs" },
    { file: ".portulan/verify/drills.sh", tool: "cli/drills.mjs" },
    { file: ".portulan/verify/telemetry.sh", tool: "cli/telemetry.mjs" },
    { file: ".portulan/verify/context.sh", tool: "cli/init.mjs" },
    { file: ".github/workflows/verify.yml", tool: "cli/recipe-set.mjs" },
    { file: ".portulan/dod.md", tool: "cli/recipe-set.mjs" },
]);

const readLines = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8").split("\n");

/** Lines naming `node <tool>` outside whole-line `#` comments; prose counts, since `.portulan/dod.md` carries one. */
function invocations(rel, tool) {
    return readLines(rel).filter((line) => line.replace(/^\s*#.*$/, "").includes(`node ${tool}`));
}

test("every required check names its resolution root", () => {
    const unpinned = [];
    for (const { file, tool } of PINNED) {
        const lines = invocations(file, tool);
        assert.ok(lines.length > 0, `${file} no longer invokes ${tool} — this roster is stale`);
        for (const line of lines) {
            if (!/--pack-root\s+\S/.test(line)) unpinned.push(`${file}: ${line.trim()}`);
        }
    }
    assert.deepEqual(
        unpinned,
        [],
        "a required check with no named root inherits the machine it runs on — see this file's header",
    );
});

test("the roster covers every verify recipe that invokes a root-taking tool", () => {
    const takesRoot = fs
        .readdirSync(path.join(REPO, "cli"))
        .filter((f) => f.endsWith(".mjs") && !f.includes(".test."))
        .filter((f) => /["']--pack-root["']/.test(fs.readFileSync(path.join(REPO, "cli", f), "utf8")))
        .map((f) => `cli/${f}`);
    assert.ok(takesRoot.length >= 5, `expected several root-taking tools, derived ${takesRoot.length}`);
    const found = [];
    for (const entry of fs.readdirSync(path.join(REPO, ".portulan", "verify"))) {
        if (!entry.endsWith(".sh")) continue;
        const rel = path.join(".portulan", "verify", entry);
        for (const tool of takesRoot) {
            if (invocations(rel, tool).length) found.push(`${rel}:${tool}`);
        }
    }
    const rostered = new Set(PINNED.map((p) => `${p.file}:${p.tool}`));
    assert.deepEqual(
        found.filter((f) => !rostered.has(f)),
        [],
        "a verify recipe invokes a root-taking tool and is not in this file's roster",
    );
});

/** Verbatim in every suite of the closure; exit reads the `const`, as suites swap `CLAUDE_CONFIG_DIR` around a case. */
const HERMETIC = [
    'const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));',
    "process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;",
    'process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));',
].join("\n");

/** A static import has no semicolon before its `from`, so `[^;]*?` spans a multi-line one but never a later mention. */
function importsModule(src, mod) {
    const spec = mod.replace(/\./g, "\\.");
    const statically = new RegExp(`(?:^|\\n)\\s*import\\b[^;]*?from\\s+"\\./${spec}"`);
    // `import(` with the specifier attached, so a bare mention in prose or a string still does not count.
    const dynamically = new RegExp(`\\bimport\\s*\\(\\s*"\\./${spec}"`);
    return statically.test(src) || dynamically.test(src);
}

/** Test files importing a module at most two imports away from a caller of `discoverPackRoots`. */
function hermeticClosure(read = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8")) {
    const entries = fs.readdirSync(path.join(REPO, "cli")).filter((f) => f.endsWith(".mjs"));
    const modules = entries.filter((f) => !f.includes(".test."));
    const direct = modules.filter((f) => /discoverPackRoots\(/.test(read(`cli/${f}`)));
    const closure = new Set(direct);
    for (let hop = 0; hop < 2; hop += 1) {
        for (const f of modules) {
            const src = read(`cli/${f}`);
            for (const seen of [...closure]) {
                if (importsModule(src, seen)) closure.add(f);
            }
        }
    }
    return entries
        .filter((f) => f.endsWith(".test.mjs"))
        .filter((f) => {
            const src = read(`cli/${f}`);
            return [...closure].some((m) => importsModule(src, m));
        })
        .sort();
}

test("every test file whose tool can reach the host's plugin record neutralises it", () => {
    const closure = hermeticClosure();
    // A count cannot name a lost member, so one per shape a predicate can miss is owed: multi-line, `.live`, dynamic.
    assert.ok(closure.length >= 17, `the closure shrank to ${closure.length}: ${closure.join(" ")} — see \`importsModule\``);
    for (const owed of ["compile.test.mjs", "doctor.test.mjs", "index.test.mjs", "upgrade.live.test.mjs", "new.test.mjs"]) {
        assert.ok(closure.includes(owed), `${owed} dropped out of the derived closure — see \`importsModule\``);
    }
    assert.equal(closure.includes("pinned-roots.live.test.mjs"), false, "the sweep counted its own test data as an import");
    const unguarded = closure.filter((f) => !fs.readFileSync(path.join(REPO, "cli", f), "utf8").includes(HERMETIC));
    assert.deepEqual(
        unguarded,
        [],
        "a test file whose tool consults the plugin record reads the machine it runs on — see this file's header",
    );
});

test("the closure is derived from the imports, not from a list — shown by severing one", () => {
    // `stop-gate.mjs` reaches discovery by one route only, `recipe-set.mjs`, so severing it must drop its suite.
    const real = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8");
    assert.ok(hermeticClosure(real).includes("stop-gate.test.mjs"), "the two-hop member is missing from the closure");

    const severed = (rel) => (rel === "cli/stop-gate.mjs" ? real(rel).replaceAll('from "./recipe-set.mjs"', 'from "./nothing.mjs"') : real(rel));
    assert.equal(
        hermeticClosure(severed).includes("stop-gate.test.mjs"),
        false,
        "membership must follow the imports; it did not change when the only route was removed",
    );
    assert.notEqual(severed("cli/stop-gate.mjs"), real("cli/stop-gate.mjs"), "the substitution changed nothing");
});
