// Tests for the payload-classification rail.
//
// **Every red class is forced** — the seven `findings()` classes below, and both directions of the
// dynamic-import register. `../.portulan/memory/a-checkers-coverage-is-measured-not-named.md`
// binds: a rail whose failure paths are never run is a rail nobody has seen work, and this one exists
// because three modules shipped for three sessions under a green. The green case is measured live
// against this repository — the only tree whose classification this rail is about — and the findings
// are forced through `findings()`, which takes a report and so can be handed the exact state each
// branch is for. **It is not pure** — an earlier draft of this sentence said so and was wrong: the
// `EXCLUDED` arm asks the filesystem about non-`.mjs` entries, which is why every synthetic report
// below carries a real `root`.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// **The host's plugin record is neutralised before the tool is imported.** `./payload.mjs` imports
// `./compile.mjs`, which puts this file inside `./pinned-roots.live.test.mjs`'s derived closure: without
// this, a case here would read whatever packs happen to be installed on the machine it runs on. The
// sweep compares this block as LITERAL TEXT and derives membership from imports rather than from what a
// module currently does — an internal refusal is one edit from being relaxed. Copied from the sibling
// rather than re-spelled, which is what that file's own header says goes wrong otherwise.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import { ACCOUNTED_DYNAMIC_IMPORTS, CannotRun, EXCLUDED, PRODUCT, UNRULED, classify, dynamicImportRegister, edgesOf, findings, hasDynamicImport, run } from "./payload.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** A report shaped like `classify`'s, so a branch can be handed exactly the state it is for. */
function report(over = {}) {
    const shipped = ["portulan.mjs", ...UNRULED.modules, ...Object.keys(PRODUCT)];
    return {
        root: REPO,
        shipped,
        tracked: [...shipped, ...Object.keys(EXCLUDED).filter((n) => n.endsWith(".mjs"))],
        classes: new Map(
            shipped.map((n) => [n, n === "portulan.mjs" ? "bin" : n in PRODUCT ? "product" : "unruled"]),
        ),
        reachable: new Set(["portulan.mjs"]),
        dangling: [],
        missingRoots: [],
        ...over,
    };
}

describe("payload — the live classification", () => {
    test("every shipped cli module is classified, and the roster is not empty", () => {
        const r = classify(REPO);
        assert.ok(r.shipped.length > 0, "the payload carries no cli modules — a green over an empty roster");
        const unclassified = [...r.classes].filter(([, c]) => c === null).map(([n]) => n);
        assert.deepEqual(unclassified, [], "a shipped module is classified by nothing");
    });

    test("the classes partition the shipped set — every module has exactly one", () => {
        const r = classify(REPO);
        assert.equal(r.classes.size, r.shipped.length);
        for (const c of r.classes.values()) {
            assert.ok(["bin", "subcommand", "imported", "hook-runner", "product", "unruled"].includes(c), `unknown class ${c}`);
        }
    });

    test("the live tree is green — no findings at all", () => {
        assert.deepEqual(findings(classify(REPO)), []);
    });

    test("EXCLUDED and the payload are disjoint, measured against what npm packs", () => {
        const r = classify(REPO);
        for (const name of Object.keys(EXCLUDED)) {
            assert.ok(!r.shipped.includes(name), `cli/${name} is EXCLUDED and the payload carries it`);
        }
    });

    test("every UNRULED module actually ships and is actually unreachable", () => {
        const r = classify(REPO);
        for (const name of UNRULED.modules) {
            assert.ok(r.shipped.includes(name), `cli/${name} is UNRULED but does not ship`);
            assert.ok(!r.reachable.has(name), `cli/${name} is UNRULED but is reachable`);
        }
    });
});

describe("payload — every red is forced", () => {
    test("a shipped module classified by nothing is a finding, and names the module", () => {
        const r = report();
        r.shipped = [...r.shipped, "workshop-thing.mjs"];
        r.classes.set("workshop-thing.mjs", null);
        r.tracked = [...r.tracked, "workshop-thing.mjs"];
        const red = findings(r);
        assert.equal(red.length, 1);
        assert.match(red[0], /workshop-thing\.mjs SHIPS and is classified by nothing/);
    });

    test("the unclassified finding REFUSES the escape hatch by name — UNRULED is frozen", () => {
        const r = report();
        r.shipped = [...r.shipped, "workshop-thing.mjs"];
        r.classes.set("workshop-thing.mjs", null);
        r.tracked = [...r.tracked, "workshop-thing.mjs"];
        assert.match(findings(r)[0], /may NOT be added to UNRULED, which is frozen/);
    });

    test("an UNRULED module that became reachable is a finding — the class is stale, not the module", () => {
        const r = report({ reachable: new Set(["portulan.mjs", "goldens.mjs"]) });
        const red = findings(r);
        assert.equal(red.length, 1);
        assert.match(red[0], /goldens\.mjs is UNRULED but is now reachable/);
    });

    test("an UNRULED module the payload stopped carrying is caught TWICE, from both directions", () => {
        // Deliberately asserted as two rather than narrowed to one: a module that leaves the payload
        // while staying tracked is both a stale UNRULED entry and an unexplained absence, and the rail
        // saying so twice is the totality working rather than a duplicate to be tidied away.
        const r = report();
        r.shipped = r.shipped.filter((n) => n !== "telemetry.mjs");
        r.classes.delete("telemetry.mjs");
        const red = findings(r);
        assert.equal(red.length, 2);
        assert.ok(red.some((f) => /telemetry\.mjs is UNRULED but the payload no longer carries it/.test(f)));
        assert.ok(red.some((f) => /telemetry\.mjs is tracked and does NOT ship/.test(f)));
    });

    test("an EXCLUDED module the payload carries is a finding — npm's answer wins", () => {
        const r = report();
        r.shipped = [...r.shipped, "ab.mjs"];
        r.classes.set("ab.mjs", "imported");
        const red = findings(r);
        assert.equal(red.length, 1);
        assert.match(red[0], /ab\.mjs is EXCLUDED .* but the payload CARRIES it/);
    });

    test("an EXCLUDED entry naming a file the tree does not carry is a stale declaration", () => {
        const r = report();
        r.tracked = r.tracked.filter((n) => n !== "ab-run.mjs");
        const red = findings(r);
        assert.equal(red.length, 1);
        assert.match(red[0], /EXCLUDED names cli\/ab-run\.mjs, which the tree does not carry/);
    });

    test("a tracked module that silently does not ship is a finding — absence needs a reason too", () => {
        const r = report();
        r.tracked = [...r.tracked, "quietly-dropped.mjs"];
        const red = findings(r);
        assert.equal(red.length, 1);
        assert.match(red[0], /quietly-dropped\.mjs is tracked and does NOT ship, and no EXCLUDED entry says why/);
    });

    test("an import the payload cannot satisfy is a finding — the install would raise", () => {
        const r = report({ dangling: [{ from: "portulan.mjs", to: "ab.mjs" }] });
        const red = findings(r);
        assert.equal(red.length, 1);
        assert.match(red[0], /ERR_MODULE_NOT_FOUND/);
    });

    test("a ROOT the payload does not carry is a finding — a silently dropped seed is a fail-open", () => {
        // The defect: seeds were filtered to what ships, so excluding the `bin` by accident would have
        // left the rail green over the remainder while the installed package exposed an entry point
        // resolving to nothing. Each root kind is asserted, because the repair differs per kind.
        for (const [kind, phrase] of [["the `bin` target", "portulan.mjs"], ["a `SUBCOMMANDS` module", "doctor.mjs"], ["a compiled-hook runner", "gate.mjs"]]) {
            const r = report({ missingRoots: [{ kind, name: phrase }] });
            const red = findings(r);
            assert.ok(red.some((f) => f.includes(phrase) && f.includes(kind)), `${kind} missing produced no finding`);
            assert.ok(red.some((f) => /resolving to nothing/.test(f)));
        }
    });

    test("a string `bin` seeds the same root as a map — npm allows both spellings", () => {
        // `Object.values("cli/portulan.mjs")` is a list of CHARACTERS, so the string form would have
        // seeded no root and mis-classified the entry point. No live defect — this repository's `bin`
        // is a map — but a rail that reads a manifest should read the manifest's schema.
        const asString = (v) => (typeof v === "string" ? [v] : Object.values(v));
        assert.deepEqual(asString("cli/portulan.mjs"), ["cli/portulan.mjs"]);
        assert.deepEqual(asString({ portulan: "cli/portulan.mjs" }), ["cli/portulan.mjs"]);
    });

    test("the live tree has no missing roots", () => {
        assert.deepEqual(classify(REPO).missingRoots, []);
    });

    test("a test file is not a finding — the suite never ships and needs no exclusion entry", () => {
        const r = report();
        r.tracked = [...r.tracked, "something.test.mjs"];
        assert.deepEqual(findings(r), []);
    });
});

describe("payload — PRODUCT is a ruling, and the rail checks it is a live one", () => {
    test("every PRODUCT module ships and is unreachable — an entry that needs no ruling is redundant", () => {
        const r = classify(REPO);
        for (const name of Object.keys(PRODUCT)) {
            assert.ok(r.shipped.includes(name), `cli/${name} is ruled PRODUCT but does not ship`);
            assert.ok(!r.reachable.has(name), `cli/${name} is ruled PRODUCT but classifies as imported anyway`);
            assert.equal(r.classes.get(name), "product");
        }
    });

    test("every PRODUCT entry carries a ground — a disposition nobody can read is not reviewable", () => {
        for (const [n, why] of Object.entries(PRODUCT)) {
            assert.ok(why.trim().length > 40, `cli/${n}'s ruling is too thin to review`);
        }
    });

    test("a PRODUCT ruling whose subject stopped shipping is a finding", () => {
        const r = report();
        const victim = Object.keys(PRODUCT)[0];
        r.shipped = r.shipped.filter((n) => n !== victim);
        r.classes.delete(victim);
        assert.ok(findings(r).some((f) => new RegExp(`PRODUCT rules cli/${victim}`).test(f)));
    });

    test("a PRODUCT module that became reachable is a redundant entry, and says so", () => {
        const r = report({ reachable: new Set(["portulan.mjs", ...Object.keys(PRODUCT)]) });
        assert.ok(findings(r).some((f) => /is in PRODUCT but is now reachable/.test(f)));
    });

    test("UNRULED growing by one is a finding — the freeze is a number the RAIL checks", () => {
        // Forced at the pre-commit checkpoint before this assertion existed: a fourteenth name produced
        // no finding at all, while the class comment claimed the rail asserted the enumeration. The
        // overstated enforcer is the defect; this is the check that makes the sentence true.
        UNRULED.modules.push("a-module-that-did-not-ask.mjs");
        try {
            assert.ok(findings(report()).some((f) => /UNRULED holds 14 module\(s\) and is frozen at 13/.test(f)));
        } finally {
            UNRULED.modules.pop();
        }
    });

    test("one module in two registers is a finding — impossible before PRODUCT, silent until forced", () => {
        PRODUCT[UNRULED.modules[0]] = "a ruling that forgot to delete the entry it superseded";
        try {
            assert.ok(findings(report()).some((f) => /is in BOTH PRODUCT and UNRULED/.test(f)));
        } finally {
            delete PRODUCT[UNRULED.modules[0]];
        }
    });

    test("the three registers are pairwise disjoint in the tree as it stands", () => {
        const P = Object.keys(PRODUCT), U = UNRULED.modules, E = Object.keys(EXCLUDED);
        assert.deepEqual(P.filter((n) => U.includes(n)), []);
        assert.deepEqual(P.filter((n) => E.includes(n)), []);
        assert.deepEqual(U.filter((n) => E.includes(n)), []);
    });
});

describe("payload — the edge forms the walk must see", () => {
    test("a plain import is an edge", () => {
        assert.ok(edgesOf('import { x } from "./a.mjs";').has("a.mjs"));
    });

    test("a RE-EXPORT is an edge — carried on the grammar, not on a live example", () => {
        // `portulan.mjs` both re-exports and plain-imports `manifest.mjs`, so this form catches nothing
        // the plain one misses TODAY. An earlier draft of this suite said it did; the pre-commit
        // checkpoint measured that false. The form is here because a module reachable only this way is
        // one edit away and would arrive silently.
        assert.ok(edgesOf('export { VERSION } from "./manifest.mjs";').has("manifest.mjs"));
    });

    test("a side-effect import is an edge", () => {
        assert.ok(edgesOf('import "./b.mjs";').has("b.mjs"));
    });

    test("a multi-line import is an edge — the real files wrap", () => {
        assert.ok(edgesOf('import {\n  a,\n  b,\n} from "./c.mjs";').has("c.mjs"));
    });

    test("a node builtin and a bare specifier are not cli edges", () => {
        const e = edgesOf('import fs from "node:fs";\nimport x from "pkg";');
        assert.equal(e.size, 0);
    });

    test("manifest.mjs classifies as imported in the real tree, by whichever edge reaches it first", () => {
        const r = classify(REPO);
        assert.equal(r.classes.get("manifest.mjs"), "imported");
    });
});

describe("payload — dynamic imports are refused, never walked past", () => {
    test("a dynamic import is detected", () => {
        assert.ok(hasDynamicImport('const m = await import(url);'));
    });

    test("a dynamic import inside a comment is not", () => {
        assert.ok(!hasDynamicImport('// mentions import( in prose\n * and import( again'));
    });

    test("`.import(` on an object is not a dynamic import", () => {
        assert.ok(!hasDynamicImport("registry.import(thing);"));
    });

    test("every accounted site ships AND actually carries a dynamic import — both halves", () => {
        const r = classify(REPO);
        const { stale } = dynamicImportRegister(r);
        for (const name of Object.keys(ACCOUNTED_DYNAMIC_IMPORTS)) {
            assert.ok(r.shipped.includes(name), `${name} is accounted for but does not ship`);
        }
        assert.deepEqual(stale, [], "an accounted entry outlived the import it explains");
    });

    test("the live tree has no unaccounted dynamic import", () => {
        assert.deepEqual(dynamicImportRegister(classify(REPO)).unaccounted, []);
    });

    test("an UNACCOUNTED dynamic import is a finding — forced by dropping an entry from the register", () => {
        const r = classify(REPO);
        const saved = ACCOUNTED_DYNAMIC_IMPORTS["upgrade.mjs"];
        delete ACCOUNTED_DYNAMIC_IMPORTS["upgrade.mjs"];
        try {
            assert.ok(dynamicImportRegister(r).unaccounted.includes("upgrade.mjs"));
        } finally {
            ACCOUNTED_DYNAMIC_IMPORTS["upgrade.mjs"] = saved;
        }
    });

    test("a STALE register entry is its own finding, not the unaccounted one wearing its words", () => {
        // The two are opposite defects. Reported through one message path they render a contradiction —
        // "carries no dynamic import" inside a sentence beginning "carries a dynamic `import(`" — which
        // is what the pre-commit checkpoint forced and read back.
        const r = classify(REPO);
        ACCOUNTED_DYNAMIC_IMPORTS["manifest.mjs"] = "a register entry with no import behind it";
        try {
            const { stale, unaccounted } = dynamicImportRegister(r);
            assert.ok(stale.includes("manifest.mjs"));
            assert.ok(!unaccounted.includes("manifest.mjs"));
        } finally {
            delete ACCOUNTED_DYNAMIC_IMPORTS["manifest.mjs"];
        }
    });
});

describe("payload — the frozen class is frozen", () => {
    test("UNRULED carries its issue, so the way back is in the record", () => {
        assert.equal(typeof UNRULED.issue, "number");
        assert.ok(UNRULED.issue > 0);
    });

    test("UNRULED holds exactly its frozen count, and the rail reads the same number", () => {
        assert.equal(UNRULED.modules.length, UNRULED.frozenAt);
        assert.equal(UNRULED.frozenAt, 13);
    });

    test("UNRULED names no module that EXCLUDED also names — the classes are disjoint", () => {
        for (const n of UNRULED.modules) assert.ok(!(n in EXCLUDED), `${n} is both UNRULED and EXCLUDED`);
    });

    test("every EXCLUDED entry carries a non-empty reason — an unreadable roster is not reviewable", () => {
        for (const [n, why] of Object.entries(EXCLUDED)) {
            assert.equal(typeof why, "string");
            assert.ok(why.trim().length > 20, `cli/${n}'s exclusion reason is too thin to review`);
        }
    });

    test("this rail excludes ITSELF — its subject is this repository's publish surface", () => {
        assert.ok("payload.mjs" in EXCLUDED);
    });
});

describe("payload — could-not-run is exit 2, from every call that can refuse", () => {
    // **Three leaks, all found by review rather than by the earlier checkpoint**, whose could-not-run
    // cases all tripped this file's own `package.json` read first and never reached the calls below.
    // `../.portulan/memory/verify-preconditions-fail-closed.md` is the contract: a rail that dies on
    // "npm did not run" reports nothing, and nothing is not a verdict.
    const sink = () => {
        const lines = [];
        return { write: (l) => lines.push(l), lines };
    };

    test("a root with no package.json refuses rather than answering", () => {
        const out = sink(), err = sink();
        assert.equal(run([path.join(REPO, "does-not-exist")], out, err), 2);
        assert.match(err.lines.join(""), /could not run/);
    });

    test("`packedPaths` failing is translated — its CannotRun is a DIFFERENT class than this file's", () => {
        // The defect: `pack-identity.mjs` declares its own `CannotRun`, so `instanceof` is false across
        // the two modules and `run()`'s handler missed it entirely — the rail crashed where it contracts
        // exit 2. Asserted on the class boundary rather than by breaking npm, which a suite must not do.
        assert.equal(typeof CannotRun, "function");
        const theirs = class CannotRun extends Error {};
        assert.ok(!(new theirs("x") instanceof CannotRun), "the two CannotRun classes are not interchangeable");
    });

    test("`dynamicImportRegister` refuses an unreadable module instead of throwing raw", () => {
        const bogus = { root: path.join(REPO, "no-such-tree"), shipped: ["portulan.mjs"] };
        assert.throws(() => dynamicImportRegister(bogus), (e) => e instanceof CannotRun && /could not be read/.test(e.message));
    });

    test("run() converts a register refusal to exit 2, not only a classify refusal", () => {
        const out = sink(), err = sink();
        assert.equal(run([path.join(REPO, "still-not-a-tree")], out, err), 2);
        assert.equal(out.lines.length, 0, "a refusal printed a verdict on stdout");
    });
});
