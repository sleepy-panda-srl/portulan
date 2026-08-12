// Tests for `doctor` — the Workspace Definition validator.
//
// Written before the validator, per the constitution's verification-first doctrine
// (../core/operating/verification.md: the failing test is the spec). Zero dependencies:
// node's own test runner, which needs no install step and so does not turn this repository
// into one that has a build.
//
//   node --test "cli/**/*.test.mjs"
//
// Quoted and recursive, and both matter. Node 26 rejects a bare directory, so `node --test cli/` fails
// to resolve `cli` as a module and produces a red that looks exactly like a real one — which cost this
// file's author a transcript. Run it through ../.portulan/verify/tests.sh in practice: a glob matching
// nothing exits 0, so that recipe counts the files first.
//
// Two rules govern the fixtures, and both were forced by the checks that already run here
// rather than chosen (see ./fixtures/README.md):
//
//   * a known-bad manifest is WELL-FORMED JSON that violates the schema — `json.sh` parses
//     every tracked .json file, so a fixture that does not parse would make CI permanently red;
//   * fixture Markdown carries no relative links — `docs.sh` link-checks every tracked .md.
//
// Cases that need a malformed file or a broken tree build one in a temp directory at run time.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    DoctorError,
    compileSchema,
    validate,
    inspect,
    run,
    parseProvenance,
    schemaVersion,
    packSchemaVersion,
    legibility,
} from "./doctor.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const FIXTURES = path.join(HERE, "fixtures");
const SCHEMA = JSON.parse(
    fs.readFileSync(path.join(REPO, "spec", "workspace.schema.json"), "utf8"),
);

// `$defs/provenance` as a schema in its own right, which is how `doctor` uses it: the definition
// lives in the manifest schema, the instances live in Markdown records. Spread rather than
// `$ref`-ed, because a `$ref` may carry only annotations as siblings — including `$defs` would be
// a constraint-bearing sibling by the back door.
const provenanceSchema = { $defs: SCHEMA.$defs, ...SCHEMA.$defs.provenance };

// One exit handler for all scratch directories rather than one each — the per-directory form
// exceeds node's default ten-listener limit partway through this suite and prints a
// MaxListenersExceededWarning. Found by review on ../.portulan/handoffs/2026-07-26-plugin-and-public-marketplace.md's
// pull request, in the *new* suite; this file had the same defect first and the new one inherited
// it by being modelled on it, which is how a defect in an exemplar becomes a defect in a family.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

/** A throwaway directory, removed when the process exits. */
function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-doctor-"));
    SCRATCH.push(dir);
    return dir;
}

/** Write a tree described as { "relative/path": "contents" }. */
function tree(dir, files) {
    for (const [rel, body] of Object.entries(files)) {
        const target = path.join(dir, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, body);
    }
    return dir;
}

const severities = (findings, severity) => findings.filter((f) => f.severity === severity);
const checks = (findings, check) => findings.filter((f) => f.check === check);
const text = (findings) => findings.map((f) => f.message).join("\n");

// A manifest that satisfies every required key, for tests that mutate one thing at a time.
// `tree` is here because `kind: repository` requires it as of spec 2.0 (proposal 0005) — adding the
// check turned eight of these tests red at once, which is the cheapest possible confirmation that the
// constraint binds every repository workspace rather than only the one it was written against.
const wellFormed = () => ({
    portulan: { spec: "2.0" },
    name: "fixture",
    kind: "repository",
    tree: "./",
    slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" },
    verify: { default: "docs", recipes: [{ id: "docs", run: "./verify.sh" }] },
});

// The files those three required slots point at. Markdown, no relative links — see the header.
const minimalFiles = {
    "identity.md": "# Identity\n\nA fixture team.\n",
    "principles.md": "# Principles\n\nWrite the limit, not the aspiration.\n",
    "gate-map.md": "# Gate map\n\nEverything is Gated.\n",
};

// ---------------------------------------------------------------- the schema subset

describe("the schema validator implements exactly the declared subset", () => {
    test("compiles the real Workspace Definition schema", () => {
        assert.doesNotThrow(() => compileSchema(SCHEMA));
    });

    // The canonical validator fail-open: a keyword the validator does not implement is a
    // constraint the author wrote and nothing enforces. spec/README.md names the subset and
    // says a schema reaching outside it is a change to `doctor` too — this is that sentence
    // as machinery.
    test("refuses a schema using a keyword outside the subset", () => {
        assert.throws(() => compileSchema({ type: "string", maxLength: 4 }), (error) => {
            assert.ok(error instanceof DoctorError);
            // The message has to name the keyword: "your schema is invalid" sends the reader to
            // the wrong file when the actual answer is "doctor does not implement this yet".
            assert.match(error.message, /maxLength/);
            assert.match(error.message, /subset/i);
            return true;
        });
    });

    // Knowing a keyword's NAME is not enough: `pattern: "["` and `enum: "repository"` are both inside
    // the subset by name and neither can be applied. Before this, they reached instance validation and
    // surfaced as a raw SyntaxError or TypeError — exit 2, "unanticipated failure", naming neither the
    // keyword nor where it lives, from a defect squarely in the schema.
    test("refuses a supported keyword carrying a value it cannot apply", () => {
        const cases = [
            [{ type: "string", pattern: "[" }, /pattern/],
            [{ enum: "repository" }, /enum/],
            [{ type: "object", required: "name" }, /required/],
            [{ type: "string", minLength: -1 }, /minLength/],
            [{ type: "array", uniqueItems: "yes" }, /uniqueItems/],
            [{ type: "integer" }, /type/],
            [{ oneOf: [] }, /oneOf/],
        ];
        for (const [schema, naming] of cases) {
            assert.throws(() => compileSchema(schema), (error) => {
                assert.ok(error instanceof DoctorError, `${JSON.stringify(schema)} threw ${error.constructor.name}`);
                assert.match(error.message, naming);
                return true;
            }, `expected ${JSON.stringify(schema)} to be refused at compile time`);
        }
    });

    test("refuses `additionalProperties` with any value but literal false", () => {
        assert.throws(
            () => compileSchema({ type: "object", additionalProperties: true }),
            DoctorError,
        );
        assert.throws(
            () => compileSchema({ type: "object", additionalProperties: { type: "string" } }),
            DoctorError,
        );
    });

    test("refuses a `$ref` carrying a sibling that is not an annotation", () => {
        const base = { $defs: { s: { type: "string" } } };
        assert.doesNotThrow(() =>
            compileSchema({ ...base, properties: { a: { $ref: "#/$defs/s", description: "ok" } } }),
        );
        assert.throws(
            () => compileSchema({ ...base, properties: { a: { $ref: "#/$defs/s", minLength: 2 } } }),
            DoctorError,
        );
    });

    test("refuses a `$ref` that is not a local #/$defs/ pointer", () => {
        assert.throws(
            () => compileSchema({ properties: { a: { $ref: "https://example.test/s.json" } } }),
            DoctorError,
        );
    });

    test("reports the violated constraint and where it was violated", () => {
        const errors = validate(SCHEMA, { ...wellFormed(), kind: "example" });
        // Length first, so an unexpected empty result is an assertion failure naming the count rather
        // than a TypeError from indexing `errors[0]`. Copilot, round 1 on #135.
        assert.equal(errors.length, 2, errors.map((e) => `${e.pointer} ${e.message}`).join("\n"));
        assert.match(errors[0].message, /enum/);
        assert.equal(errors[0].pointer, "/kind");

        // The count above was `1` until 2.7, and the second error is the measured cost of
        // the top-level `oneOf` that arrived with the pointer kind. It is not noise and it is not
        // located vaguely: `kind` discriminates the two forms, so a value in neither enum fails BOTH,
        // and the extra error says exactly that — this manifest is neither a governing workspace nor a
        // pointer. The precise one still comes first and still carries `/kind`, which is the property
        // this test exists to hold. The blast radius is exactly this case: an unknown KEY, a `#fragment`
        // slot and a bad path still produce one error each, because the forms constrain only `kind`,
        // `slots`, `verify` and `governed_by`.
        assert.equal(errors[1].pointer, "");
        assert.match(errors[1].message, /not exactly one \(oneOf\)/);
    });

    test("rejects an unknown key rather than ignoring it", () => {
        const errors = validate(SCHEMA, { ...wellFormed(), principals: "principles.md" });
        assert.equal(errors.length, 1);
        assert.match(errors[0].message, /principals/);
    });

    test("rejects a slot addressed by #fragment", () => {
        const m = wellFormed();
        m.slots.identity = "identity.md#who";
        const errors = validate(SCHEMA, m);
        assert.equal(errors.length, 1);
        assert.equal(errors[0].pointer, "/slots/identity");
    });

    test("rejects an absolute path and a URL in a path slot", () => {
        for (const bad of ["/etc/identity.md", "https://example.test/identity.md"]) {
            const m = wellFormed();
            m.slots.identity = bad;
            assert.equal(validate(SCHEMA, m).length, 1, `expected ${bad} to be rejected`);
        }
    });

    test("accepts `../` — escaping is legal and visible in the value", () => {
        const m = wellFormed();
        m.slots.constitution = "../docs/vision.md";
        assert.deepEqual(validate(SCHEMA, m), []);
    });

    test("requires a directory slot to end in `/` and a file slot not to", () => {
        const dirAsFile = wellFormed();
        dirAsFile.slots.memory = "memory";
        assert.equal(validate(SCHEMA, dirAsFile).length, 1);

        const fileAsDir = wellFormed();
        fileAsDir.slots.identity = "identity.md/";
        assert.equal(validate(SCHEMA, fileAsDir).length, 1);
    });

    test("rejects a `verify.default` that no recipe id could ever match", () => {
        const m = wellFormed();
        m.verify.default = "Docs Recipe";
        const errors = validate(SCHEMA, m);
        assert.equal(errors.length, 1);
        assert.equal(errors[0].pointer, "/verify/default");
    });

    test("rejects an empty recipe list", () => {
        const m = wellFormed();
        m.verify.recipes = [];
        assert.equal(validate(SCHEMA, m).length, 1);
    });

    test("rejects duplicate pack names", () => {
        const m = wellFormed();
        m.packs = ["stacks/node", "stacks/node"];
        assert.equal(validate(SCHEMA, m).length, 1);
    });

    // `additionalProperties: false` with no sibling `properties` forbids EVERY property. Reading a
    // missing `properties` as "nothing to check" would make a supported spelling mean the opposite
    // of what it says — silently, which is the whole failure class.
    test("`additionalProperties: false` with no `properties` forbids every property", () => {
        const schema = { type: "object", additionalProperties: false };
        assert.deepEqual(validate(schema, {}), []);
        const errors = validate(schema, { anything: 1 });
        assert.equal(errors.length, 1);
        assert.match(errors[0].message, /anything/);
    });
});

describe("a budget or a threshold that is not a positive integer", () => {
    // The declared keyword subset has no `minimum` and cannot say `integer`, so `type: "number"` is the
    // strongest thing the schema can express and every value below would validate against it. The
    // consuming tools refuse them with exit 2 — but only when they RUN, and `librarian` runs unattended
    // on a cron, so a `0` would pass CI green and fail at 06:00 on a Monday with nobody watching. A
    // policy defect that surfaces only in an unattended run is the worst place for one. Raised by
    // Copilot on #81, in the suppressed half of the round, about the librarian's thresholds; the memory
    // budgets were missing the same check and are a sibling of the same class, so they are covered here
    // in the same stroke.
    const KEYS = [
        ["librarian.staleness.record_days", (m, v) => ((m.librarian = { staleness: { record_days: v } }), m)],
        ["librarian.staleness.sealed_days", (m, v) => ((m.librarian = { staleness: { sealed_days: v } }), m)],
        // `memory-index.md` rather than a name nothing writes: `doctor` validates that
        // `memory.index.path` resolves, so a fixture pointing at a file the tree does not contain
        // adds an unrelated FAIL beside the one under test and dulls the signal. The `find` below is
        // already scoped to the positive-integer message, so it was precise either way — but a
        // fixture that is red for two reasons is one a later reader cannot trust at a glance.
        ["memory.index.budget.lines", (m, v) => ((m.memory = { index: { path: "memory-index.md", budget: { lines: v } } }), m)],
        ["memory.store.budget.kilobytes", (m, v) => ((m.memory = { store: { budget: { kilobytes: v } } }), m)],
        // The per-record cap of Workspace Definition 2.8 is the fourth budget the subset can only type
        // as `number`, so it arrives with the same refusal as its three siblings rather than inheriting
        // the hole they were repaired for — the sibling rule of `.portulan/proposals/0020`, applied to
        // the check that exists because of it.
        ["memory.store.budget.record_kilobytes", (m, v) => ((m.memory = { store: { budget: { record_kilobytes: v } } }), m)],
    ];

    for (const [name, set] of KEYS) {
        // A string is refused by the SCHEMA — `type: "number"` is one thing the subset can say — so it
        // is asserted as a failure without demanding this check's wording. The three the schema cannot
        // see are the reason this check exists, and they get the message too.
        for (const bad of [0, -1, 1.5]) {
            test(`${name}: ${JSON.stringify(bad)} is a failure, not a green`, async () => {
                const m = set(wellFormed(), bad);
                m.slots.memory = "memory/";
                const dir = tree(scratch(), { ...minimalFiles, "memory/r.md": "x\n", "memory-index.md": "i\n", "workspace.json": JSON.stringify(m) });
                const { findings } = await inspect(dir, { schema: SCHEMA });
                const hit = severities(findings, "fail").find((f) => /positive integer/.test(f.message));
                assert.ok(hit, `expected a positive-integer failure for ${name}`);
                assert.match(hit.message, new RegExp(name.split(".").pop()));
            });
        }

        test(`${name}: a string is refused too, by the schema`, async () => {
            const m = set(wellFormed(), "90");
            m.slots.memory = "memory/";
            const dir = tree(scratch(), { ...minimalFiles, "memory/r.md": "x\n", "memory-index.md": "i\n", "workspace.json": JSON.stringify(m) });
            const { findings } = await inspect(dir, { schema: SCHEMA });
            assert.ok(severities(findings, "fail").some((f) => f.message.includes(name.split(".").pop())));
        });

        test(`${name}: a positive integer passes`, async () => {
            const m = set(wellFormed(), 90);
            m.slots.memory = "memory/";
            const dir = tree(scratch(), { ...minimalFiles, "memory/r.md": "x\n", "memory-index.md": "i\n", "workspace.json": JSON.stringify(m) });
            const { findings } = await inspect(dir, { schema: SCHEMA });
            const bad = severities(findings, "fail").filter((f) => /positive integer/.test(f.message));
            assert.deepEqual(bad, []);
        });
    }
});

describe("the schema declares which Workspace Definition version it implements", () => {
    test("the shipped schema carries it in `$id`", () => {
        assert.deepEqual(schemaVersion(SCHEMA), { major: 2, minor: 8 });
    });

    test("a schema whose `$id` does not carry one is refused", () => {
        assert.throws(() => schemaVersion({ $id: "https://portulan.dev/spec/workspace.schema.json" }), DoctorError);
        assert.throws(() => schemaVersion({}), DoctorError);
    });

    // A version refusal names the remedy that is actually REACHABLE, and which one that is depends
    // on the DIRECTION. Added at milestone 7 session 9 when `upgrade` gave the behind-arm a remedy
    // to name at all — and pinned because the pre-commit checkpoint INVERTED the two arms and every
    // one of the 259 tests across this suite and `upgrade`'s stayed green. A rail nobody has seen
    // fail is a rail nobody has seen work.
    const at = (spec) => tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify({ ...wellFormed(), portulan: { spec } }) });
    const here = schemaVersion(SCHEMA);

    /**
     * The rejection, captured ONCE and asserted directly.
     *
     * A first cut ran `inspect` twice — through `assert.rejects(...).then(() => null).catch(e => e)`
     * for the type and again for the message — which did double work and left `error` always `null`
     * on the success path, so the line reading `assert.equal(error, null)` looked tautological to
     * anyone reading it. In a suite whose subject is tests that cannot fail for the reason they
     * exist, an assertion that *reads* as vacuous is barely better than one that is.
     * Copilot, round 9 on #231.
     */
    const refusal = async (spec) => {
        const error = await inspect(at(spec), { schema: SCHEMA }).then(() => null, (e) => e);
        assert.ok(error instanceof DoctorError, `doctor must refuse a manifest declaring ${spec}`);
        return error.message;
    };

    test("a workspace BEHIND by a MAJOR is sent to `portulan upgrade`", async () => {
        const message = await refusal("1.0");
        assert.match(message, /portulan upgrade/, "the behind-arm must name the tool that migrates it");
        assert.doesNotMatch(message, /upgrade the CLI/, "a workspace behind this bundle is not fixed by upgrading the CLI");
    });

    test("a workspace AHEAD by a MAJOR is sent to upgrade the CLI, never to `portulan upgrade`", async () => {
        const message = await refusal(`${here.major + 1}.0`);
        assert.match(message, /upgrade the CLI/, "the ahead-arm must say the validator is the old thing");
        assert.doesNotMatch(message, /portulan upgrade/, "`portulan upgrade` cannot migrate a workspace this bundle does not understand");
    });

    test("a MINOR ahead names the same remedy as its MAJOR sibling — 0020, one rule, two arms", async () => {
        const message = await refusal(`${here.major}.${here.minor + 1}`);
        assert.match(message, /upgrade the CLI/, "the MINOR-ahead refusal stopped at `Refusing` while its sibling named the fix");
    });
});

// -------------------------------------------------------------- the committed fixtures

describe("the committed known-bad manifests each fail, and name why", () => {
    // "A validator that goes green on first contact with a manifest written to satisfy it has
    // demonstrated nothing" — .portulan/tasks/0002-workspace-definition-v1.md.
    const cases = fs
        .readdirSync(path.join(FIXTURES, "manifests"))
        .filter((f) => f.endsWith(".json") && f !== "valid.json");

    test("there are known-bad manifests to run", () => {
        // An empty glob is a suite that passes having tested nothing.
        assert.ok(cases.length >= 6, `expected several bad manifests, found ${cases.length}`);
    });

    for (const file of cases) {
        test(file, () => {
            const body = fs.readFileSync(path.join(FIXTURES, "manifests", file), "utf8");
            // Well-formed JSON, so `json.sh` stays green — the fixture is bad against the
            // SCHEMA, not against the parser.
            const instance = JSON.parse(body);
            const errors = validate(SCHEMA, instance);
            assert.ok(errors.length > 0, `${file} was expected to violate the schema`);
            for (const e of errors) {
                assert.ok(e.pointer !== undefined && e.message, "every error names where and what");
            }
        });
    }

    test("valid.json passes, so the suite is not merely rejecting everything", () => {
        const instance = JSON.parse(
            fs.readFileSync(path.join(FIXTURES, "manifests", "valid.json"), "utf8"),
        );
        assert.deepEqual(validate(SCHEMA, instance), []);
        // Schema-valid is not the whole of valid, and a fixture called `valid` that satisfies only
        // half the rules is a trap for whoever debugs against it. The cross-field rules are not
        // expressible in the schema subset, so they are asserted here rather than assumed: this one
        // was schema-valid and NOT doctor-valid for as long as spec 2.0 existed, which a reviewer
        // caught and this suite did not.
        if (instance.kind === "repository") {
            assert.ok(instance.tree, "a `repository` manifest must declare `tree` under spec 2.0");
        }
        assert.ok(
            instance.verify.recipes.some((r) => r.id === instance.verify.default),
            "`verify.default` must name a declared recipe",
        );
    });
});

// ------------------------------------------------------------------------- path slots

describe("path slots resolve, and escapes are reported rather than failed", () => {
    test("a slot naming a target that does not exist is a failure", async () => {
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify({ ...wellFormed(), slots: { ...wellFormed().slots, dod: "dod.md" } }),
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "paths"), "fail");
        assert.equal(failures.length, 1);
        assert.match(text(failures), /dod\.md/);
    });

    test("the top-level `gates` path is resolved like any other — a policy file that does not exist fails", async () => {
        // Regression. `gates` shipped for one checkpoint with `../spec/slots.md` already promising
        // "What `doctor` checks: that the path resolves", and nothing resolving it — so a manifest
        // naming a policy file that was not there validated GREEN. A mandate nothing checks is
        // already broken; this is the check.
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify({ ...wellFormed(), gates: "no-such-policy.json" }),
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "paths"), "fail");
        assert.equal(failures.length, 1);
        assert.match(text(failures), /no-such-policy\.json/);
    });

    test("a present `gates` policy resolves cleanly", async () => {
        const dir = tree(scratch(), {
            ...minimalFiles,
            "gates.json": JSON.stringify({ portulan: { spec: "2.1" }, rules: [] }),
            "workspace.json": JSON.stringify({ ...wellFormed(), gates: "gates.json" }),
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(findings, "paths"), "fail").length, 0);
    });

    test("a directory slot pointing at a file fails, and the reverse too", async () => {
        const m = wellFormed();
        m.slots.memory = "memory/";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "memory": "not a directory\n",
            "workspace.json": JSON.stringify(m),
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(findings, "paths"), "fail").length, 1);
    });

    test("an escaping slot is reported, never failed — and must still exist", async () => {
        const root = scratch();
        tree(root, { "shared/vision.md": "# Vision\n" });
        const m = wellFormed();
        m.slots.constitution = "../shared/vision.md";
        const dir = tree(path.join(root, "ws"), { ...minimalFiles, "workspace.json": JSON.stringify(m) });

        const ok = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(ok.findings, "fail").length, 0);
        assert.match(text(severities(ok.findings, "report")), /outside the workspace/i);

        // Escaping is permitted; being absent is not.
        const m2 = wellFormed();
        m2.slots.constitution = "../shared/missing.md";
        fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify(m2));
        const bad = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(bad.findings, "paths"), "fail").length, 1);
    });

    test("escape is detected by resolving, not by a `../` prefix", async () => {
        const root = scratch();
        tree(root, { "outside.md": "# Outside\n" });
        const m = wellFormed();
        // Never starts with `../`, still leaves the workspace.
        m.slots.constitution = "sub/../../outside.md";
        const dir = tree(path.join(root, "ws"), {
            ...minimalFiles,
            "sub/.keep": "",
            "workspace.json": JSON.stringify(m),
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.match(text(severities(findings, "report")), /outside the workspace/i);
    });

    test("`constitution` may be a directory", async () => {
        const m = wellFormed();
        m.slots.constitution = "docs/";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "docs/vision.md": "# Vision\n",
            "workspace.json": JSON.stringify(m),
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(findings, "paths"), "fail").length, 0);
    });
});

// ---------------------------------------------------------------------- cross-field

describe("cross-field checks", () => {
    test("`verify.default` must name a recipe that exists", async () => {
        const m = wellFormed();
        m.verify.default = "missing";
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "cross"), "fail");
        assert.equal(failures.length, 1);
        assert.match(text(failures), /missing/);
    });

    test("a recipe `doc` that is present must resolve; absent is fine", async () => {
        const m = wellFormed();
        m.verify.recipes[0].doc = "verify/README.md";
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
        const missing = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(missing.findings, "paths"), "fail").length, 1);

        delete m.verify.recipes[0].doc;
        fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify(m));
        const fine = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(fine.findings, "fail").length, 0);
    });

    test("`products[].repos` names cards by basename, and does not match on a substring", async () => {
        const m = wellFormed();
        m.slots.repos = "repos/";
        m.products = [{ id: "p", product: "products/p.md", repos: ["portulan"] }];
        const dir = tree(scratch(), {
            ...minimalFiles,
            "products/p.md": "# P\n",
            // A substring match would accept this card for the name `portulan`.
            "repos/portulan-internal.md": "# Repo\n",
            "workspace.json": JSON.stringify(m),
        });
        const bad = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(bad.findings, "cross"), "fail").length, 1);

        fs.writeFileSync(path.join(dir, "repos", "portulan.md"), "# Repo\n");
        const good = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(good.findings, "cross"), "fail").length, 0);
    });

    test("a product with neither its own nor an inherited affordances is reported, not failed", async () => {
        const m = wellFormed();
        m.products = [{ id: "p", product: "products/p.md" }];
        const dir = tree(scratch(), {
            ...minimalFiles,
            "products/p.md": "# P\n",
            "workspace.json": JSON.stringify(m),
        });
        const bare = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(bare.findings, "fail").length, 0);
        assert.match(text(severities(bare.findings, "report")), /affordances/i);

        // A workspace-level default satisfies it by inheritance.
        m.affordances = "affordances.md";
        fs.writeFileSync(path.join(dir, "affordances.md"), "# Affordances\n");
        fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify(m));
        const inherited = await inspect(dir, { schema: SCHEMA });
        assert.equal(checks(inherited.findings, "cross").filter((f) => /affordances/i.test(f.message)).length, 0);
    });
});

// ---------------------------------------------------------------------- provenance

describe("provenance is parsed into the two forms the constitution names", () => {
    test("a link stamp parses, annotation prose and all", () => {
        const parsed = parseProvenance(
            "**provenance:** `form=link` `href=https://example.test/pull/8#c1`\n" +
                "— the pull request where the incident happened.\n",
        );
        assert.deepEqual(parsed.fields, { form: "link", href: "https://example.test/pull/8#c1" });
    });

    test("a sealed stamp parses, including a `shape` containing spaces", () => {
        const parsed = parseProvenance(
            "**provenance:** `form=sealed` `owner=A Team` `date=2026-07-25` " +
                "`shape=an empty list read as a pass; the obvious guard checks output, not exit status`\n",
        );
        assert.equal(parsed.fields.form, "sealed");
        assert.equal(parsed.fields.date, "2026-07-25");
        assert.match(parsed.fields.shape, /obvious guard/);
    });

    test("prose provenance parses as neither form", () => {
        const parsed = parseProvenance("**provenance:** Milestone 1, session 3 — a supervisor found it.\n");
        assert.equal(parsed.fields, null);
    });

    test("a record carrying both forms' keys fails, rather than passing twice", () => {
        const parsed = parseProvenance(
            "**provenance:** `form=link` `href=https://example.test/1` `owner=A` `date=2026-07-25` `shape=x`\n",
        );
        const errors = validate(provenanceSchema, parsed.fields);
        assert.ok(errors.length > 0);
    });

    // The template invites annotation prose after the stamp. Last-token-wins made that invitation
    // a trap: a correct `form=link` record whose prose *discusses* the sealed form went red.
    test("a token inside the annotation prose does not overwrite the stamp", () => {
        const parsed = parseProvenance(
            "**provenance:** `form=link` `href=https://example.test/1`\n" +
                "— contrast with a `form=sealed` stamp, which travels without the episode.\n",
        );
        assert.deepEqual(parsed.fields, { form: "link", href: "https://example.test/1" });
        assert.deepEqual(validate(provenanceSchema, parsed.fields), []);
    });

    test("duplicate recipe ids and product ids are caught", async () => {
        const m = wellFormed();
        m.verify.recipes = [
            { id: "docs", run: "./a.sh" },
            { id: "docs", run: "./b.sh" },
        ];
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(findings, "cross"), "fail").length, 1);
        assert.match(text(checks(findings, "cross")), /share the id/);
    });

    // Workspace Definition 2.3. Both are conditional dependencies, and `dependentRequired` is not in
    // the subset — so neither is expressible in the schema and both are checked here, exactly as the
    // `repository`/`tree` pair above is.
    test("`memory` without a `slots.memory` store is refused", async () => {
        const m = wellFormed();
        m.memory = { index: { path: "memory-index.md" } };
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "cross"), "fail");
        assert.equal(failures.length, 1);
        assert.match(text(failures), /slots\.memory/);
    });

    test("an index sited inside the store it indexes is refused", async () => {
        // Sited there it is counted as a record by this validator's own retirement and provenance
        // walks — so the report about the store would include a file the store does not hold. The
        // repair is a siting rule and not an exemption by filename, because an exemption is a door
        // any record could walk through.
        const m = wellFormed();
        m.slots.memory = "memory/";
        m.memory = { index: { path: "memory/INDEX.md" } };
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "memory/INDEX.md": "# Memory index\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "cross"), "fail");
        assert.equal(failures.length, 1);
        assert.match(text(failures), /inside slots\.memory/);
    });

    // Workspace Definition 2.5. The handoff series gets the same two conditional dependencies, and
    // they are tested rather than assumed to follow from the memory pair: the two checks share an
    // argument and not a line of code, and the second copy of a containment rule is exactly what
    // drifted last time (`isInside` exists because two copies of it carried one fail-open).
    test("`handoffs` without a `slots.handoffs` series is refused", async () => {
        const m = wellFormed();
        m.handoffs = { index: { path: "handoffs-index.md" } };
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "cross"), "fail");
        assert.equal(failures.length, 1);
        assert.match(text(failures), /slots\.handoffs/);
    });

    test("a handoff index sited inside the series it indexes is refused", async () => {
        // A different walk swallows it here than in the store's case, and the message says which: a
        // Markdown file in `slots.handoffs` is either counted as a handoff by `docs.sh`'s date
        // correspondence — inflating one side of a count the Session log is held to — or failed by
        // the same check for carrying no date.
        const m = wellFormed();
        m.slots.handoffs = "handoffs/";
        m.handoffs = { index: { path: "handoffs/INDEX.md" } };
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "handoffs/INDEX.md": "# Handoff index\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "cross"), "fail");
        assert.equal(failures.length, 1);
        assert.match(text(failures), /inside slots\.handoffs/);
    });

    // Workspace Definition 2.6. The scopes layer gets the same two conditional dependencies as the
    // other two series, for the third time and on the same terms: the argument is shared, the code is
    // not, and `index` refusing them is not `doctor` refusing them — a manifest checked at one carrier
    // is checked at the narrower one, which is the class `0020` names.
    test("`personas` without a `slots.personas` layer is refused", async () => {
        const m = wellFormed();
        m.personas = { index: { path: "personas-index.md" } };
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "cross"), "fail");
        assert.equal(failures.length, 1);
        assert.match(text(failures), /slots\.personas/);
    });

    test("a scope index sited inside the layer it indexes is refused", async () => {
        // The walk that swallows it here is the orphan sweep: `index` reports any directory under the
        // layer that no composed persona declares, and a generated file sited there would be examined
        // by the very check that exists to tell an arrived location from an invented one.
        const m = wellFormed();
        m.slots.personas = "personas/";
        m.personas = { index: { path: "personas/INDEX.md" } };
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "personas/INDEX.md": "# Persona memory scopes\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "cross"), "fail");
        assert.equal(failures.length, 1);
        assert.match(text(failures), /inside slots\.personas/);
    });

    test("a handoff index named `..something` inside the series is refused too", async () => {
        const m = wellFormed();
        m.slots.handoffs = "handoffs/";
        m.handoffs = { index: { path: "handoffs/..index.md" } };
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "handoffs/..index.md": "# Handoff index\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.match(text(severities(checks(findings, "cross"), "fail")), /inside slots\.handoffs/);
    });

    test("an index named `..something` inside the store is refused too", async () => {
        // Copilot, #72. The containment test read a leading `..` in a FILENAME as a traversal, so a
        // file plainly inside the store was judged outside it — and this walk then counted it as a
        // record. Both copies of the rule carried it; there is one copy now, imported.
        const m = wellFormed();
        m.slots.memory = "memory/";
        m.memory = { index: { path: "memory/..index.md" } };
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "memory/..index.md": "# Memory index\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.match(text(severities(checks(findings, "cross"), "fail")), /inside slots\.memory/);
    });

    test("an index beside the store is fine, and its path must resolve", async () => {
        const m = wellFormed();
        m.slots.memory = "memory/";
        m.memory = { index: { path: "memory-index.md" } };
        const files = {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "memory/a-fact.md": "**type:** rule\n**provenance:** `form=link` `href=https://example.invalid/1`\n\n**Retire when:** never.\n",
        };
        const missing = tree(scratch(), files);
        const absent = await inspect(missing, { schema: SCHEMA });
        assert.match(text(severities(checks(absent.findings, "paths"), "fail")), /memory\.index\.path/);

        const present = tree(scratch(), { ...files, "memory-index.md": "# Memory index\n" });
        const { findings } = await inspect(present, { schema: SCHEMA });
        assert.equal(severities(checks(findings, "cross"), "fail").length, 0);
        assert.equal(severities(checks(findings, "paths"), "fail").length, 0);
    });

    test("a link href containing whitespace is rejected", () => {
        const parsed = parseProvenance("**provenance:** `form=link` `href=two words`\n");
        const errors = validate(provenanceSchema, parsed.fields);
        assert.ok(errors.length > 0);
    });

    test("every two-form entry already in this repository parses and validates", () => {
        // Byte-for-byte against real records rather than fixtures written to suit the parser.
        const dir = path.join(REPO, ".portulan", "memory");
        const live = fs
            .readdirSync(dir)
            .map((f) => parseProvenance(fs.readFileSync(path.join(dir, f), "utf8")))
            .filter((p) => p.fields);
        assert.ok(live.length >= 2, `expected the existing two-form entries, found ${live.length}`);
        for (const p of live) {
            assert.deepEqual(
                validate(provenanceSchema, p.fields),
                [],
            );
        }
    });

    test("a rule with neither form fails; the same line on a decision is only reported", async () => {
        const m = wellFormed();
        m.slots.memory = "memory/";
        const files = {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "memory/prose-rule.md":
                "**type:** rule\n**scope:** workspace\n**provenance:** Someone remembered it.\n\nA rule.\n",
        };
        const dir = tree(scratch(), files);
        const asRule = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(asRule.findings, "provenance"), "fail").length, 1);

        fs.writeFileSync(
            path.join(dir, "memory", "prose-rule.md"),
            "**type:** decision\n**scope:** workspace\n**provenance:** Someone remembered it.\n\nA decision.\n",
        );
        const asDecision = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(asDecision.findings, "provenance"), "fail").length, 0);
        assert.equal(severities(checks(asDecision.findings, "provenance"), "report").length >= 1, true);
    });

    test("the sealed proportion is reported, over rules only", async () => {
        const m = wellFormed();
        m.slots.memory = "memory/";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "memory/linked.md":
                "**type:** rule\n**provenance:** `form=link` `href=https://example.test/1`\n\nA rule.\n",
            "memory/sealed.md":
                "**type:** rule\n**provenance:** `form=sealed` `owner=A` `date=2026-07-25` `shape=inputs, wrong outcome, why the guard misses`\n\nA rule.\n",
            // A decision must not move the denominator.
            "memory/decided.md":
                "**type:** decision\n**provenance:** `form=link` `href=https://example.test/2`\n\nA decision.\n",
        });
        const { findings, stats } = await inspect(dir, { schema: SCHEMA });
        assert.equal(stats.rules, 2);
        assert.equal(stats.sealed, 1);
        assert.match(text(checks(findings, "provenance")), /1 of 2|1\/2|50/);
    });

    // An unreadable record is a defect in the WORKSPACE, so it is exit 1 reported beside everything
    // else — not exit 2, which would discard every finding the run had already reached. The identical
    // shape was fixed for the gates file in the same change that left this one.
    test("an unreadable memory record fails the workspace; it does not abort the run", async () => {
        const m = wellFormed();
        m.slots.memory = "memory/";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "memory/readable.md": "**type:** rule\n**provenance:** `form=link` `href=https://example.test/1`\n\nA rule.\n",
            "memory/locked.md": "**type:** rule\n**provenance:** `form=link` `href=https://example.test/2`\n\nA rule.\n",
        });
        fs.chmodSync(path.join(dir, "memory", "locked.md"), 0o000);
        try {
            assert.equal(await run([dir], { quiet: true }), 1, "a workspace defect is exit 1, not 2");
            const { findings, stats } = await inspect(dir, { schema: SCHEMA });
            assert.match(text(severities(checks(findings, "provenance"), "fail")), /locked\.md/);
            // The readable one was still counted: the run continued rather than aborting.
            assert.equal(stats.records, 2);
            // And the unreadable one is still SIZED (from stat): it is counted in `records`, so
            // leaving it out of `bytes` would have the two totals disagree about what a record is.
            const expected =
                fs.statSync(path.join(dir, "memory", "readable.md")).size +
                fs.statSync(path.join(dir, "memory", "locked.md")).size;
            assert.equal(stats.bytes, expected, "count and size must agree on what a record is");
            // And the summary must not claim assessment it never performed: the unreadable record
            // is counted as unassessed, and the retirement report says so instead of asserting
            // that every record states a condition.
            assert.equal(stats.unassessed, 1);
            const retirement = text(severities(checks(findings, "retirement"), "report"));
            assert.match(retirement, /1 unreadable and never assessed/);
            assert.doesNotMatch(retirement, /every record states a retirement condition/);
        } finally {
            fs.chmodSync(path.join(dir, "memory", "locked.md"), 0o644);
        }
    });

    test("a workspace with no memory slot says it checked nothing, rather than passing quietly", async () => {
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(wellFormed()) });
        const { findings, stats } = await inspect(dir, { schema: SCHEMA });
        assert.equal(stats.rules, 0);
        assert.match(text(checks(findings, "provenance")), /0 /);
    });
});

// -------------------------------------------------------------------- retirement

describe("the store reports its own growth", () => {
    test("a record stating no retirement condition is noted by name; one stating it is not", async () => {
        const m = wellFormed();
        m.slots.memory = "memory/";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "memory/never-dies.md":
                "**type:** reference\n**provenance:** `form=link` `href=https://example.test/1`\n\nA fact.\n",
            "memory/dies-on-time.md":
                "**type:** rule\n**provenance:** `form=link` `href=https://example.test/2`\n\nA rule.\n\n**Retire when:** the generated client is deleted.\n",
        });
        const { findings, stats } = await inspect(dir, { schema: SCHEMA });
        const notes = checks(findings, "retirement");
        assert.equal(severities(notes, "fail").length, 0, "retirement is reported, never failed — nothing legislates the field");
        assert.match(text(notes), /never-dies\.md/);
        assert.doesNotMatch(text(notes), /dies-on-time\.md/);
        assert.equal(stats.unretirable, 1);
    });

    test("prose that merely mentions retiring is not a retirement condition", async () => {
        const m = wellFormed();
        m.slots.memory = "memory/";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "memory/talks-about-it.md":
                "**type:** decision\n**provenance:** `form=link` `href=https://example.test/3`\n\nWe retire when the quarter ends, someone said once.\n",
        });
        const { stats } = await inspect(dir, { schema: SCHEMA });
        assert.equal(stats.unretirable, 1, "an unbolded mention must not count as the field");
    });

    test("the summary is always emitted, carries the store's size, and is zero-safe", async () => {
        const m = wellFormed();
        m.slots.memory = "memory/";
        const sized = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "memory/one.md":
                "**type:** rule\n**provenance:** `form=link` `href=https://example.test/1`\n\nA rule.\n\n**Retire when:** it stops being true.\n",
        });
        const withRecords = await inspect(sized, { schema: SCHEMA });
        assert.match(text(checks(withRecords.findings, "retirement")), /1 record\(s\), 0\.\d KB/);
        assert.ok(withRecords.stats.bytes > 0);

        const empty = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(wellFormed()) });
        const without = await inspect(empty, { schema: SCHEMA });
        assert.match(text(checks(without.findings, "retirement")), /no memory records/);
    });

    test("every live record in this repository states a retirement condition", () => {
        // Byte-for-byte against the real stores, like the two-form parse test above: customer zero
        // holding itself to the bar the note only reports — for this repository, the suite is the rail.
        for (const store of [path.join(REPO, ".portulan", "memory"), path.join(REPO, "examples", "memory")]) {
            for (const f of fs.readdirSync(store).filter((n) => n.endsWith(".md") && n !== "README.md")) {
                assert.match(
                    fs.readFileSync(path.join(store, f), "utf8"),
                    /^\s*\*\*retire when:\*\*/im,
                    `${f} states no retirement condition — add a **Retire when:** line or retire the record now`,
                );
            }
        }
    });
});

// -------------------------------------------------------------------- the claims lint

// ------------------------------------------------- the per-host degradation report
//
// `docs/vision.md` promises that "the enforcement backends are per-host with an honest degradation
// report". The compiler's per-rule accounting is that report's data — every rule ends as compiled or
// refused-with-a-reason, per backend — so this reads it rather than re-deriving it. Two
// implementations of one accounting is the drift this repository keeps finding.
//
// Report severity, never failure, for the same reason `retirement` is: nothing legislates a coverage
// floor, and `doctor` does not enforce what nobody legislated. What it must never do is print a
// green that reads as "everything is enforced" when three gates are enforced by nothing.

describe("the enforcement backends report their own degradation", () => {
    const gated = (rules) => ({
        portulan: { spec: "2.2" },
        why: "gate-map.md",
        rules,
    });

    const withGates = (policy, extra = {}) => {
        const dir = scratch();
        tree(dir, {
            ...minimalFiles,
            "gates.json": JSON.stringify(policy, null, 2),
            ...extra,
        });
        return dir;
    };

    const manifest = () => ({ ...wellFormed(), portulan: { spec: "2.2" }, gates: "gates.json" });

    test("a workspace declaring a gate policy gets a per-backend line, always", async () => {
        const dir = withGates(gated([
            { id: "push-force", tier: "gated", action: { shell: "git push --force" }, reason: "no lease on a shared remote" },
        ]));
        fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify(manifest()));
        const { findings } = await inspect(dir);
        const lines = text(checks(findings, "enforcement"));
        assert.match(lines, /Claude Code/);
        assert.match(lines, /GitHub repository ruleset/);
    });

    test("it names the GATES no backend compiles, and does not pad the count with `auto` rules", async () => {
        // Reporting eight where three are real is how a report gets skimmed. An `auto` rule compiled
        // by no backend is the system working; a `gated` one is a gate that exists only as a sentence.
        const dir = withGates(gated([
            { id: "push-force", tier: "gated", action: { shell: "git push --force" }, reason: "no lease on a shared remote" },
            { id: "spend-money", tier: "gated", action: { none: "no tool-level surface reaches a registrar or a payment page" }, reason: "money is gated" },
            { id: "read-the-tree", tier: "auto", action: { read: "./" }, reason: "reading is unattended" },
        ]));
        fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify(manifest()));
        const { findings } = await inspect(dir);
        const lines = text(checks(findings, "enforcement"));
        assert.match(lines, /spend-money/, "a gate nothing compiles must be named");
        assert.doesNotMatch(lines, /read-the-tree/, "an unattended rule is not a degradation");
    });

    test("the report never fails a workspace — nothing legislates a coverage floor", async () => {
        const dir = withGates(gated([
            { id: "spend-money", tier: "gated", action: { none: "no tool-level surface reaches a registrar" }, reason: "money is gated" },
            { id: "push-force", tier: "gated", action: { shell: "git push --force" }, reason: "no lease" },
        ]));
        fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify(manifest()));
        const { findings } = await inspect(dir);
        assert.equal(severities(checks(findings, "enforcement"), "fail").length, 0);
    });

    test("a workspace declaring no gate policy gets no enforcement findings at all", async () => {
        // Not a silent skip and not a fabricated note: a workspace with no `gates` key has not
        // declared a policy, so there is nothing to report degradation about.
        const dir = scratch();
        tree(dir, { ...minimalFiles, "workspace.json": JSON.stringify(wellFormed()) });
        const { findings } = await inspect(dir);
        assert.equal(checks(findings, "enforcement").length, 0);
    });

    test("a policy the compiler refuses is a finding, not a crash and not a silent pass", async () => {
        // The M2 lesson, one tool over: an unguarded read turned a workspace already judged red into
        // exit 2, trading a verdict for "could not run". A malformed gate policy must be reported
        // where every other finding is, with the run's other verdicts intact.
        const dir = withGates(gated([{ id: "bad", tier: "occasionally", action: { shell: "x" }, reason: "nope" }]));
        fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify(manifest()));
        const { findings } = await inspect(dir);
        assert.equal(severities(checks(findings, "enforcement"), "fail").length, 1, "a policy that cannot compile is the workspace's defect");
        assert.match(text(checks(findings, "enforcement")), /occasionally/);
    });

    test("a policy that PARSES but that a backend refuses is a finding too, not a crash", async () => {
        // The narrower sibling of the test above, and the one that was actually broken: the parse
        // was guarded and the backends were not, so a policy `parse()` accepts and a backend refuses
        // — a declared floor no rule reaches, or gate rules that all compile to nothing — threw out
        // of `inspect`, exited 2, and discarded every verdict the run had already reached. That is
        // the milestone-2 gates-file defect, in the file whose adjacent comment cites it. Found at
        // the pre-commit checkpoint.
        const dir = withGates({
            portulan: { spec: "2.2" },
            why: "gate-map.md",
            floor: { branch: "main", checks: [{ context: "workspace-verify" }], reviews: 0, resolve_conversations: true },
            rules: [{ id: "read-the-tree", tier: "auto", action: { read: "./" }, reason: "reading is unattended" }],
        });
        fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify(manifest()));
        const { findings } = await inspect(dir);
        assert.equal(severities(checks(findings, "enforcement"), "fail").length, 1);
        assert.match(text(checks(findings, "enforcement")), /enforces nothing/);
        assert.ok(findings.length > 1, "the run's other verdicts must survive");
    });

    test("a floor context no workflow job reports FAILS — the costliest typo the tree can catch", async () => {
        // A required context that never reports blocks every pull request, and `enforce_admins`
        // leaves nobody able to force past it: proposal 0004's lesson, which cost a three-step
        // rename to work around. This is the one enforcement check that is a failure rather than a
        // note, because the claim is about the tree and the tree can answer it.
        const dir = withGates(
            {
                portulan: { spec: "2.2" },
                why: "gate-map.md",
                floor: { branch: "main", checks: [{ context: "never-reported" }], reviews: 0, resolve_conversations: true },
                rules: [{ id: "open-a-pull-request", tier: "propose", action: { shell: "gh pr create" }, reason: "by pull request" }],
            },
            { ".github/workflows/verify.yml": "jobs:\n  workspace-verify:\n    steps: []\n" },
        );
        fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify(manifest()));
        const { findings } = await inspect(dir);
        const failures = severities(checks(findings, "enforcement"), "fail");
        assert.equal(failures.length, 1);
        assert.match(failures[0].message, /never-reported/);
    });

    test("a gate map naming NO check still gets the cross-check — the worst divergence, not the exempt one", async () => {
        // Found by review, round 2. The cross-check was gated on the prose having named at least one
        // context, so a gate map whose required-check row is missing or written in a shape this tool
        // does not recognise skipped it entirely — and that is not the mild case, it is the extreme
        // one: the policy declares two required checks and the prose carries none. The generic "names
        // no required status check" note fires, but it says nothing was compared against the *tree*
        // and says nothing at all about the policy declaring checks the prose omits.
        //
        // A check that quietly does not run in its own worst case is this repository's recurring
        // defect (`a-checker-must-refuse-what-it-cannot-check.md`), and the guard here was an
        // optimisation that read as a precondition.
        const dir = withGates(
            {
                portulan: { spec: "2.2" },
                why: "gate-map.md",
                floor: { branch: "main", checks: [{ context: "workspace-verify" }], reviews: 0, resolve_conversations: true },
                rules: [{ id: "open-a-pull-request", tier: "propose", action: { shell: "gh pr create" }, reason: "by pull request" }],
            },
            {
                "gate-map.md": "# Gate map\n\nEverything is Gated. This file names no required check at all.\n",
                ".github/workflows/verify.yml": "jobs:\n  workspace-verify:\n    steps: []\n",
            },
        );
        fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify(manifest()));
        const { findings } = await inspect(dir);
        // Asserted on the cross-check's OWN sentence, not on the context name: an unpinned-check note
        // also mentions `workspace-verify`, so a looser assertion passed before the fix and proved
        // nothing. Caught by running the test red first and finding it green.
        assert.match(
            text(checks(findings, "enforcement")),
            /prose does not name it/,
            "the policy declares a context the prose does not carry, and that must be said",
        );
    });

    test("the cross-check reads the gate map itself, not an array another check emptied", async () => {
        // Found by review. `claimedChecks` is cleared when there are no workflows to compare it
        // against — so with a tree carrying none, the cross-check saw an empty prose list and
        // reported that the prose names nothing, about a gate map that names it plainly. A false
        // report, and the SECOND consumer of that array to be caught reading it after the mutation:
        // the first fix introduced a separate `namedAnyCheck` flag for one consumer instead of
        // making the array safe to read, so the next consumer inherited the trap.
        const dir = withGates(
            {
                portulan: { spec: "2.2" },
                why: "gate-map.md",
                floor: { branch: "main", checks: [{ context: "workspace-verify" }], reviews: 0, resolve_conversations: true },
                rules: [{ id: "open-a-pull-request", tier: "propose", action: { shell: "gh pr create" }, reason: "by pull request" }],
            },
            { "gate-map.md": "# Gate map\n\n| Setting | Value |\n|---|---|\n| Required status check | `workspace-verify` |\n" },
        );
        fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify(manifest()));
        const { findings } = await inspect(dir);
        assert.doesNotMatch(
            text(checks(findings, "enforcement")),
            /prose does not name it/,
            "the gate map names this context; only the workflow comparison was unavailable",
        );
    });

    test("a floor context with no app pin is reported — any app reporting that name satisfies it", async () => {
        const dir = withGates(
            {
                portulan: { spec: "2.2" },
                why: "gate-map.md",
                floor: { branch: "main", checks: [{ context: "workspace-verify" }], reviews: 0, resolve_conversations: true },
                rules: [{ id: "open-a-pull-request", tier: "propose", action: { shell: "gh pr create" }, reason: "by pull request" }],
            },
            { ".github/workflows/verify.yml": "jobs:\n  workspace-verify:\n    steps: []\n" },
        );
        fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify(manifest()));
        const { findings } = await inspect(dir);
        assert.match(text(checks(findings, "enforcement")), /integration_id|app/i);
    });

    test("the floor and the gate map are cross-checked — two carriers of one fact must agree", async () => {
        // The gate map's platform-floor table and the policy's `floor` now both state which checks
        // `main` requires. Where a fact has two in-tree carriers, the drift is not hypothetical: this
        // and the prose half is the half no other check here reads for content.
        const dir = withGates(
            {
                portulan: { spec: "2.2" },
                why: "gate-map.md",
                floor: { branch: "main", checks: [{ context: "workspace-verify" }, { context: "pr-labeled" }], reviews: 0, resolve_conversations: true },
                rules: [{ id: "open-a-pull-request", tier: "propose", action: { shell: "gh pr create" }, reason: "by pull request" }],
            },
            {
                "gate-map.md": "# Gate map\n\n| Setting | Value |\n|---|---|\n| Required status check | `workspace-verify` |\n",
                ".github/workflows/verify.yml": "jobs:\n  workspace-verify:\n    steps: []\n  pr-labeled:\n    steps: []\n",
            },
        );
        fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify(manifest()));
        const { findings } = await inspect(dir);
        assert.match(text(checks(findings, "enforcement")), /pr-labeled/, "the context the prose omits must be named");
    });
});

describe("workspace claims are linted against the tree", () => {
    test("a repo card claiming a path the tree lacks is a failure", async () => {
        const dir = path.join(FIXTURES, "drifted-workspace");
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "claims"), "fail");
        assert.ok(failures.length >= 1, "the drifted card should fail the claims lint");
        assert.match(text(failures), /does-not-exist/);
    });

    test("customer zero's own card passes the lint", async () => {
        const { findings } = await inspect(path.join(REPO, ".portulan"), { schema: SCHEMA });
        assert.deepEqual(severities(checks(findings, "claims"), "fail"), []);
    });

    // Was a bare `continue`: an unreadable card dropped every claim it makes and the run stayed green.
    // A card that cannot be read is not a card with no claims.
    test("an unreadable repo card fails rather than dropping its claims", async () => {
        const m = wellFormed();
        m.tree = "./";
        m.slots.repos = "repos/";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "repos/app.md": "# Repo\n\n**Layout.** `nowhere/` the code\n",
        });
        fs.chmodSync(path.join(dir, "repos", "app.md"), 0o000);
        try {
            const { findings } = await inspect(dir, { schema: SCHEMA });
            const failures = severities(checks(findings, "claims"), "fail");
            assert.equal(failures.length, 1);
            assert.match(text(failures), /could not be read/);
        } finally {
            fs.chmodSync(path.join(dir, "repos", "app.md"), 0o644);
        }
    });

    // Proposal 0005, accepted 2026-07-25. A `repository` workspace IS the policy layer of a repository
    // that is present, so it has no honest reason to omit `tree` — and while it could, deleting one
    // manifest line degraded the whole claims-lint class to notes, GREEN, exit 0. The escape narrows
    // from "omit a line" to "lie about what you are", which is better and is not a fix.
    test("a `repository` workspace must declare `tree`", async () => {
        const m = wellFormed();
        m.kind = "repository";
        delete m.tree;
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "cross"), "fail");
        assert.equal(failures.length, 1);
        assert.match(text(failures), /tree/);
        assert.equal(await run([dir], { quiet: true }), 1);
    });

    test("`demo` and `portfolio` may omit `tree` — they describe repositories not present", async () => {
        for (const kind of ["demo", "portfolio"]) {
            const m = wellFormed();
            m.kind = kind;
            delete m.tree;
            const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
            const { findings } = await inspect(dir, { schema: SCHEMA });
            assert.deepEqual(severities(findings, "fail"), [], `${kind} must not be failed for omitting tree`);
        }
    });

    test("a workspace that declares no tree reports its claims unverifiable, never skips them", async () => {
        const m = wellFormed();
        m.kind = "demo";
        m.slots.repos = "repos/";
        delete m.tree;
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "repos/app.md": "# Repo\n\n**Build / test / run.**\n- test: `npm test`\n\n**Layout.** `src/` the code\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(findings, "claims"), "fail").length, 0);
        assert.match(text(checks(findings, "claims")), /unverifiable/i);
    });

    // Every finding in this block came from the pre-commit checkpoint rather than from this suite.
    // The gate-map half of the lint was extracted only inside the `tree` branch, so a workspace
    // without a tree produced no mention of its required-check claim at all — while spec/slots.md
    // promised those claims were "counted and reported unverifiable, never skipped silently".
    test("a gate-map claim is reported unverifiable when there is no tree, not dropped", async () => {
        const m = wellFormed();
        m.kind = "demo";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "gate-map.md":
                "# Gate map\n\n| Setting | Value |\n|---|---|\n| Required status check | `never-reported` |\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(findings, "claims"), "fail").length, 0);
        assert.match(text(checks(findings, "claims")), /never-reported/);
        assert.match(text(checks(findings, "claims")), /unverifiable/i);
    });

    test("a missing gates file is a paths failure, never an exit-2 crash", async () => {
        const m = wellFormed();
        m.tree = "./";
        const dir = tree(scratch(), {
            "identity.md": minimalFiles["identity.md"],
            "principles.md": minimalFiles["principles.md"],
            "workspace.json": JSON.stringify(m),
            // gate-map.md deliberately absent
        });
        // A verdict the run had already reached must not be traded for "could not run".
        assert.equal(await run([dir], { quiet: true }), 1);
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.match(text(severities(checks(findings, "paths"), "fail")), /gate-map\.md/);
    });

    // Found by the third real workspace's own onboarding session, forcing each claim check red rather
    // than reading its green. A build/test/run line written as a real command — `dotnet run --project
    // src/…` — was taken as one candidate, rejected for containing a space, and then **silently
    // dropped**: not checked, not counted, not reported. Invisible on customer zero, whose card writes
    // bare paths rather than commands, which is exactly how it survived to the third real workspace.
    // A candidate that IS a single path is an unambiguous claim: fail when it is absent. This is the
    // shape customer zero's card uses and the one the milestone-2 close demonstrated red.
    test("a build/test/run line that is a bare path fails when the path is absent", async () => {
        const m = wellFormed();
        m.tree = "./";
        m.slots.repos = "repos/";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "repos/app.md": "# Repo\n\n**Build / test / run.**\n- test: `./scripts/check.sh`\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(findings, "claims"), "fail").length, 1);

        tree(dir, { "scripts/check.sh": "#!/bin/sh\n" });
        const fixed = await inspect(dir, { schema: SCHEMA });
        assert.deepEqual(severities(checks(fixed.findings, "claims"), "fail"), []);
    });

    // A candidate that is a COMMAND merely contains tokens that might be paths — or output paths, or
    // flag values, or globs. Reported, never failed. An earlier version failed them and produced a
    // false red on every one of the cases below, all of which a reviewer constructed and all of which
    // are the shape core/templates/repo-card.md tells adopters to write.
    test("a path pulled out of a command is reported, never failed", async () => {
        const m = wellFormed();
        m.tree = "./";
        m.slots.repos = "repos/";
        const commands = [
            "go test ./...",
            "dotnet build --project=src/App",
            "git clone git@github.com:acme/app.git",
            "cc -o bin/app src/main.c",
            "sed s/dev/prod/ config.tmpl",
            "npm run test/unit",
            "docker run -v /var/run/docker.sock:/x ghcr.io/acme/app",
            "/usr/bin/env node scripts/run.mjs",
        ];
        for (const command of commands) {
            const dir = tree(scratch(), {
                ...minimalFiles,
                "workspace.json": JSON.stringify(m),
                "repos/app.md": `# Repo\n\n**Build / test / run.**\n- test: \`${command}\`\n`,
            });
            const { findings } = await inspect(dir, { schema: SCHEMA });
            assert.deepEqual(
                severities(checks(findings, "claims"), "fail"),
                [],
                `\`${command}\` must not produce a failure`,
            );
        }
    });

    // A command token is unverifiable whether or not it happens to resolve. Counting it as *checked*
    // when the path exists would make the accounting depend on incidental filesystem state and
    // overstate what was verified.
    test("a command token is unverifiable whether or not it resolves", async () => {
        const m = wellFormed();
        m.tree = "./";
        m.slots.repos = "repos/";
        const build = (present) => {
            const dir = tree(scratch(), {
                ...minimalFiles,
                "workspace.json": JSON.stringify(m),
                "repos/app.md": "# Repo\n\n**Build / test / run.**\n- run: `node --dir src/app main.js`\n",
            });
            if (present) fs.mkdirSync(path.join(dir, "src", "app"), { recursive: true });
            return dir;
        };
        const absent = await inspect(build(false), { schema: SCHEMA });
        const exists = await inspect(build(true), { schema: SCHEMA });

        assert.equal(absent.stats.claims, 0, "a command token is never a checked claim");
        assert.equal(exists.stats.claims, 0, "…and that does not change when it resolves");
        assert.equal(absent.stats.unverifiable, exists.stats.unverifiable);
        assert.deepEqual(severities(checks(exists.findings, "claims"), "fail"), []);
        assert.deepEqual(severities(checks(absent.findings, "claims"), "fail"), []);
    });

    // Absolute tokens resolve against the HOST, so `/usr/bin/env` would otherwise be found and
    // counted as a passing claim about a repository it has nothing to do with.
    test("an absolute token is never treated as a claim about the tree", async () => {
        const m = wellFormed();
        m.tree = "./";
        m.slots.repos = "repos/";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "repos/app.md": "# Repo\n\n**Build / test / run.**\n- run: `/usr/bin/env node app.mjs`\n",
        });
        const { findings, stats } = await inspect(dir, { schema: SCHEMA });
        assert.deepEqual(severities(checks(findings, "claims"), "fail"), []);
        assert.equal(stats.claims, 0, "an absolute path is not a checked claim");
    });

    // The gate map's row label is a convention no template defines. A workspace wording it
    // differently used to produce nothing at all — no finding, no count — so a GREEN could not be
    // told apart from "I did not recognise your table".
    test("a gate map whose floor row is worded differently says so", async () => {
        const m = wellFormed();
        m.tree = "./";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "gate-map.md":
                "# Gate map\n\n| Setting | Value |\n|---|---|\n| Required check | `something` |\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.deepEqual(severities(checks(findings, "claims"), "fail"), []);
        assert.match(text(checks(findings, "claims")), /names no required status check/);
    });

    // The silent half of the same defect: a line with no path-shaped token in it must be COUNTED and
    // SAID, not dropped. "Nothing to check here" and "I did not look" print identically otherwise.
    test("a build/test/run line with no checkable path is reported, never dropped", async () => {
        const m = wellFormed();
        m.tree = "./";
        m.slots.repos = "repos/";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "repos/app.md":
                "# Repo\n\n**Build / test / run.**\n" +
                "- build: `dotnet build App.slnx --configuration Release`\n" +
                "- test: `npm test`\n" +
                "- run: none — nothing to start\n",
        });
        const { findings, stats } = await inspect(dir, { schema: SCHEMA });
        assert.deepEqual(severities(checks(findings, "claims"), "fail"), []);
        // `none` claims nothing; the other two are unverifiable and must be visible as such.
        assert.equal(stats.unverifiable, 2);
        assert.match(text(checks(findings, "claims")), /App\.slnx/);
        assert.match(text(checks(findings, "claims")), /npm test/);
    });

    test("a bare command word is not treated as a path claim", async () => {
        const m = wellFormed();
        m.tree = "./";
        m.slots.repos = "repos/";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "repos/app.md": "# Repo\n\n**Build / test / run.**\n- build: none — nothing to build\n- test: `npm test`\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(findings, "claims"), "fail").length, 0);
    });

    test("the gate map's required-check claim is checked against the workflows in the tree", async () => {
        const { findings } = await inspect(path.join(REPO, ".portulan"), { schema: SCHEMA });
        assert.deepEqual(severities(checks(findings, "claims"), "fail"), []);
        assert.match(text(checks(findings, "claims")), /workspace-verify/);
    });

    // Found on the third real workspace, which is what a third instance is for. A job's reported
    // context is its `name:` when it has one and its id otherwise — so a gate map naming the ID of a
    // job that carries a display name is naming something no check will ever report, and this lint
    // used to pass it. Customer zero could not have surfaced it: its workflow deliberately sets no
    // `name:` so that the two coincide.
    test("a gate map naming a job id shadowed by a display name fails, and says why", async () => {
        const m = wellFormed();
        m.tree = "./";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "gate-map.md":
                "# Gate map\n\n| Setting | Value |\n|---|---|\n| Required status check | `example-job` |\n",
            ".github/workflows/ci.yml":
                "name: ci\njobs:\n  example-job:\n    name: Example Job\n    runs-on: ubuntu-latest\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "claims"), "fail");
        assert.equal(failures.length, 1);
        assert.match(text(failures), /job \*\*id\*\*/);
        assert.match(text(failures), /Example Job/);
    });

    // Also from the third workspace: it requires two checks, and reading only the first silently
    // exempted the second — which was the one that was wrong.
    test("every check named in the row is linted, not just the first", async () => {
        const m = wellFormed();
        m.tree = "./";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "gate-map.md":
                "# Gate map\n\n| Setting | Value |\n|---|---|\n" +
                "| Required status checks | `gates` and `not-a-real-job` |\n",
            ".github/workflows/ci.yml": "name: ci\njobs:\n  gates:\n    runs-on: ubuntu-latest\n",
        });
        const { findings, stats } = await inspect(dir, { schema: SCHEMA });
        assert.equal(stats.claims, 2, "both claims counted");
        const failures = severities(checks(findings, "claims"), "fail");
        assert.equal(failures.length, 1);
        assert.match(text(failures), /not-a-real-job/);
    });

    test("claiming the display name itself passes", async () => {
        const m = wellFormed();
        m.tree = "./";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "gate-map.md":
                "# Gate map\n\n| Setting | Value |\n|---|---|\n| Required status check | `Example Job` |\n",
            ".github/workflows/ci.yml":
                "name: ci\njobs:\n  example-job:\n    name: Example Job\n    runs-on: ubuntu-latest\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.deepEqual(severities(checks(findings, "claims"), "fail"), []);
    });

    test("a gate map naming a required check no workflow reports is a failure", async () => {
        const m = wellFormed();
        m.tree = "./";
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(m),
            "gate-map.md":
                "# Gate map\n\n## The platform floor\n\n| Setting | Value |\n|---|---|\n" +
                "| Required status check | `never-reported` — the workspace's recipes |\n",
            ".github/workflows/verify.yml": "name: verify\njobs:\n  something-else:\n    runs-on: ubuntu-latest\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "claims"), "fail");
        assert.equal(failures.length, 1);
        assert.match(text(failures), /never-reported/);
    });
});

// ---------------------------------------------------------- the two real workspaces

describe("the workspaces this milestone owes", () => {
    test("this repository's own workspace validates", async () => {
        const { findings } = await inspect(path.join(REPO, ".portulan"), { schema: SCHEMA });
        assert.deepEqual(
            severities(findings, "fail").map((f) => `${f.check}: ${f.message}`),
            [],
        );
    });

    test("the demo workspace validates, and covers more than one product", async () => {
        const dir = path.join(REPO, "examples");
        const { findings, workspace } = await inspect(dir, { schema: SCHEMA });
        assert.deepEqual(
            severities(findings, "fail").map((f) => `${f.check}: ${f.message}`),
            [],
        );
        assert.equal(workspace.kind, "demo");
        assert.ok(
            workspace.products.length >= 2,
            "the demo exists to exercise portfolio-awareness with an instance",
        );
    });

    test("the demo is a differently-shaped instance: affordances resolve down the cascade", async () => {
        const dir = path.join(REPO, "examples");
        const { workspace } = await inspect(dir, { schema: SCHEMA });
        assert.ok(workspace.affordances, "a workspace-level default is what makes inheritance real");
        assert.ok(
            workspace.products.some((p) => p.affordances),
            "and one product must override it",
        );
        assert.ok(
            workspace.products.some((p) => !p.affordances),
            "and one must inherit, or the cascade is untested",
        );
    });
});

// ------------------------------------------------------------------- the exit codes

describe("exit codes: 0 validates, 1 does not, 2 could not run", () => {
    test("0 against the two real workspaces", async () => {
        assert.equal(await run([path.join(REPO, ".portulan"), path.join(REPO, "examples")], { quiet: true }), 0);
    });

    test("1 when a workspace does not validate", async () => {
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify({ ...wellFormed(), kind: "example" }),
        });
        assert.equal(await run([dir], { quiet: true }), 1);
    });

    // A missing or unparseable manifest is a verdict ABOUT the workspace, not an environment
    // failure — so it is 1. Exit 2 is reserved for "this tool could not run at all", which is
    // what keeps `could not run` from being mistaken for `ran and failed`.
    test("1 when the manifest is absent or malformed", async () => {
        const absent = tree(scratch(), minimalFiles);
        assert.equal(await run([absent], { quiet: true }), 1);

        const malformed = tree(scratch(), { ...minimalFiles, "workspace.json": '{ "name": "x", }' });
        assert.equal(await run([malformed], { quiet: true }), 1);
    });

    test("2 on a bad invocation", async () => {
        assert.equal(await run([], { quiet: true }), 2);
    });

    // "This workspace is wrong" and "I do not implement the contract it names" are different
    // statements, and only the first is a verdict doctor is entitled to make. Before this existed,
    // a manifest declaring a Workspace Definition version that has never shipped validated GREEN.
    test("2 when the manifest names a Workspace Definition this validator does not implement", async () => {
        const build = (spec) => {
            const m = wellFormed();
            m.portulan.spec = spec;
            return tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
        };
        assert.equal(await run([build("9.9")], { quiet: true }), 2, "a MAJOR ahead");
        assert.equal(await run([build("2.9")], { quiet: true }), 2, "a MINOR ahead");
        assert.equal(await run([build("2.0")], { quiet: true }), 0, "the current version");
    });

    // "MINOR is additive, so an older manifest stays valid" is the versioning rule's whole promise.
    // There is no 2.x older than 2.0 yet, so the older side is supplied by a synthetic schema one
    // MINOR ahead — which tests the comparison rather than waiting for a version to exist.
    test("an older MINOR still validates, and says it is older", async () => {
        const ahead = { ...SCHEMA, $id: "https://portulan.dev/spec/2.1/workspace.schema.json" };
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(wellFormed()) });
        const { findings } = await inspect(dir, { schema: ahead });
        assert.equal(severities(findings, "fail").length, 0);
        assert.match(text(checks(findings, "schema")), /2\.0/);
        assert.match(text(checks(findings, "schema")), /additive/);
    });

    test("2 when the schema itself cannot be read", async () => {
        assert.equal(
            await run([path.join(REPO, ".portulan")], { quiet: true, schemaPath: "/nonexistent/schema.json" }),
            2,
        );
    });

    // Borrowing exit 1 for an internal error would claim a judgement that was never made —
    // the same laundering already fixed once in .portulan/tools/gh-bot-token.mjs.
    test("2, never 1, when something unanticipated throws", async () => {
        const poison = { get kind() { throw new Error("unanticipated"); } };
        assert.equal(await run([path.join(REPO, ".portulan")], { quiet: true, schema: poison }), 2);
    });
});

describe("a `handoffs` object with no index configures nothing", () => {
    // Copilot, #85 round one. `memory` tolerates an object with no `index` — a workspace may rail its
    // store's size and generate nothing — but `handoffs` has one key and no budget, so `handoffs: {}`
    // is a no-op that reads as configured to anyone who greps for it. Unlike the two conditional
    // requirements around it, this one IS expressible in the declared subset, so the schema carries it.
    test("`handoffs: {}` is refused by the schema, not tolerated", async () => {
        const m = wellFormed();
        m.slots.handoffs = "handoffs/";
        m.handoffs = {};
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m), "handoffs/2026-01-01-a.md": "# A\n" });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "schema"), "fail");
        assert.ok(failures.length >= 1);
        assert.match(text(failures), /index/);
    });
});

describe("the positive-integer failure message says only what is true of this tree", () => {
    // #84, and the rider that came with the ruling to fold it in: a corrected failure message is a
    // claim like any other, so something has to bind what it now asserts. The old sentence said a
    // non-positive value "reads as *undeclared* to the tool that consumes it" — true of nothing here,
    // since both consumers refuse it outright. This pins the repair from both sides, because a
    // message is the one artifact a reader has the least room to check.
    test("it does not claim a consumer reads the value as undeclared", async () => {
        const m = wellFormed();
        m.slots.memory = "memory/";
        m.librarian = { staleness: { record_days: 0 } };
        const dir = tree(scratch(), { ...minimalFiles, "memory/r.md": "x\n", "workspace.json": JSON.stringify(m) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const hit = severities(findings, "fail").find((f) => /positive integer/.test(f.message));
        assert.ok(hit);
        assert.doesNotMatch(hit.message, /undeclared/i);
        assert.doesNotMatch(hit.message, /switch(es)? the rail off/i);
    });

    test("and the behaviour it DOES assert is the one the consumers have", async () => {
        // The message's remaining claim is that the consuming tool refuses such a value rather than
        // reading it as absent. Asserted against the consumer itself, so the message and the code
        // cannot drift apart the way the old sentence had already drifted from them.
        const { LibrarianError, passWorkspace } = await import("./librarian.mjs");
        const m = wellFormed();
        m.slots.memory = "memory/";
        m.librarian = { staleness: { record_days: 0 } };
        const dir = tree(scratch(), { ...minimalFiles, "memory/r.md": "x\n", "workspace.json": JSON.stringify(m) });
        assert.throws(() => passWorkspace(dir, { asOf: "2026-06-15" }), LibrarianError);
    });
});

// ---------------------------------------------------------------- packs

// Milestone 6. This slot reported a COUNT for four milestones and said so — "a declaration only" —
// because there was no format to validate a pack against and nowhere to resolve a name. Both now
// exist, and the tests below are the difference between resolving and counting.

const PACK_SCHEMA = JSON.parse(fs.readFileSync(path.join(REPO, "spec", "pack.schema.json"), "utf8"));

const packManifest = (over = {}) => ({
    portulan: { pack: "1.0" },
    name: "checkpoints",
    category: "rituals",
    contributes: { personas: ["personas/supervisor.md"] },
    ...over,
});

// The persona file the manifest above declares. It did not exist in these fixtures until milestone 7,
// because until then `doctor` counted `contributes.personas` and opened nothing — so a fixture could
// declare a persona it did not ship and stay green. Opening the key made that dishonest rather than
// merely incomplete, and the fixture now carries what a real pack must: all five parts of the contract.
const PACK_PERSONA = [
    "---", "name: supervisor", "description: Grades work in a fresh context.", "tools: Read, Grep", "---", "",
    "# Persona — supervisor", "", "## Charter", "It grades; it does not implement.", "",
    "## Autonomy reach", "Acts in Auto to read. Prohibited is not a reach and does not appear here.", "",
    "## Memory scope", "`personas/supervisor/` in the adopting workspace.", "",
    "## Read / write posture", "Reads in parallel; writes only its verdict.", "",
].join("\n");

describe("the packs a workspace declares", () => {
    test("the shipped Pack Definition compiles under the declared subset", () => {
        assert.doesNotThrow(() => compileSchema(PACK_SCHEMA));
    });

    test("a declared pack that resolves and validates is reported with what it contributes", async () => {
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify({ ...wellFormed(), packs: ["rituals/checkpoints"] }),
            "packs/rituals/checkpoints/pack.json": JSON.stringify(packManifest()),
            "packs/rituals/checkpoints/personas/supervisor.md": PACK_PERSONA,
        });
        const { findings, stats } = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(findings, "packs"), "fail").length, 0, text(findings));
        assert.equal(stats.packs, 1);
        assert.match(text(checks(findings, "packs")), /resolves to .*checkpoints/);
        assert.match(text(checks(findings, "packs")), /1 persona/);
    });

    test("a pack manifest that violates the Pack Definition fails, naming the violation", async () => {
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify({ ...wellFormed(), packs: ["rituals/checkpoints"] }),
            // `auto` is not in the fragment tier enum — the half of tighten-only that shape enforces.
            "packs/rituals/checkpoints/pack.json": JSON.stringify(
                packManifest({
                    contributes: { gates: [{ id: "x", tier: "auto", action: { shell: "s" }, reason: "r" }] },
                }),
            ),
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "packs"), "fail");
        assert.ok(failures.length > 0, "an auto fragment must not validate");
        assert.match(text(failures), /not one of the permitted values/);
    });

    test("a declared pack that does not resolve is a FAILURE where a root exists", async () => {
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify({ ...wellFormed(), packs: ["rituals/absent"] }),
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.match(text(severities(checks(findings, "packs"), "fail")), /does not resolve/);
    });

    // The `tree` precedent: with nowhere to search, the claim is unverifiable rather than wrong.
    test("a declared pack on a workspace with no tree is REPORTED, never failed", async () => {
        const manifest = { ...wellFormed(), kind: "portfolio", packs: ["rituals/absent"] };
        delete manifest.tree;
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(manifest) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(findings, "packs"), "fail").length, 0, text(findings));
        // The WORDING moved when discovery landed: "no roots to search" now has more than one cause —
        // no `tree`, or `--pack-root auto` finding nothing on a workspace that HAS one — so the sentence
        // names the cause it actually had instead of asserting the first. The severity is the rule here,
        // and it is unchanged: reported, never failed.
        assert.match(text(checks(findings, "packs")), /no packs root to search/);
        assert.match(text(checks(findings, "packs")), /none is derivable from the manifest/);
    });

    // Normative in spec/pack.schema.json, and for one pre-commit checkpoint implemented nowhere while
    // `doctor` printed "validates against Pack Definition 99.0" — a conformance claim about a contract
    // it had never seen. DoD condition 4, inside the change that introduced the sentence.
    test("a pack declaring a version AHEAD of this doctor is refused rather than graded", async () => {
        for (const ahead of ["99.0", "1.9", "2.0"]) {
            const dir = tree(scratch(), {
                ...minimalFiles,
                "workspace.json": JSON.stringify({ ...wellFormed(), packs: ["rituals/checkpoints"] }),
                "packs/rituals/checkpoints/pack.json": JSON.stringify(packManifest({ portulan: { pack: ahead } })),
            });
            const { findings, stats } = await inspect(dir, { schema: SCHEMA });
            const failures = severities(checks(findings, "packs"), "fail");
            assert.ok(failures.length > 0, `Pack Definition ${ahead} must be refused`);
            assert.match(text(failures), /Refusing to grade it/);
            assert.equal(stats.packs, 0, "a refused pack is not counted as validated");
        }
    });

    // Written against a SYNTHETIC schema one minor ahead, because the shipped Pack Definition is 1.0
    // and there is no earlier minor to name yet. An earlier draft asserted this with `1.0` — the
    // current version — so it proved only that the current version is graded, under a name claiming
    // more. Found by review; the fix is to make the test do what its name says rather than rename it
    // down, since MINOR-behind-still-graded is a real rule that will matter at the first pack bump.
    test("a pack declaring an EARLIER minor on the same major is still graded", async () => {
        const ahead = { ...PACK_SCHEMA, $id: "https://portulan.dev/spec/pack/1.5/pack.schema.json" };
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify({ ...wellFormed(), packs: ["rituals/checkpoints"] }),
            "packs/rituals/checkpoints/pack.json": JSON.stringify(packManifest({ portulan: { pack: "1.0" } })),
            "packs/rituals/checkpoints/personas/supervisor.md": PACK_PERSONA,
        });
        const { findings, stats } = await inspect(dir, { schema: SCHEMA, packSchema: ahead });
        assert.equal(severities(checks(findings, "packs"), "fail").length, 0, text(findings));
        assert.equal(stats.packs, 1, "1.0 against a 1.5 validator must still be graded");
    });

    test("a pack whose `contributes.gates` is not an array is refused with a diagnostic", async () => {
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify({ ...wellFormed(), packs: ["rituals/checkpoints"] }),
            "packs/rituals/checkpoints/pack.json": JSON.stringify(
                packManifest({ contributes: { gates: "not-an-array" } }),
            ),
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.match(text(severities(checks(findings, "packs"), "fail")), /expected type `array`/);
    });

    test("the two version trains are read by different functions and do not collide", () => {
        assert.deepEqual(packSchemaVersion(PACK_SCHEMA), { major: 1, minor: 0 });
        assert.deepEqual(schemaVersion(SCHEMA), { major: 2, minor: 8 });
        // The workspace reader must not accept the pack `$id` as a workspace version.
        assert.throws(() => schemaVersion({ $id: "https://portulan.dev/spec/pack/1.0/pack.schema.json" }));
    });

    test("this repository's own declared pack resolves and validates", async () => {
        const { findings } = await inspect(path.join(REPO, ".portulan"), { schema: SCHEMA });
        assert.equal(severities(checks(findings, "packs"), "fail").length, 0, text(findings));
        assert.match(text(checks(findings, "packs")), /rituals\/checkpoints/);
    });
});

// -------------------------------------------------------------- a pack root named on the command line

describe("--pack-root names a resolution root outside the workspace's tree", () => {
    // Adjustment 6 of the milestone-6 session-open checkpoint. `inspect` has read `options.packRoots`
    // since session 0 and no caller set it — so the from-a-feed path existed in the resolver and had no
    // way in from a command line. `doctor` matters most of the three, because it is the tool that
    // validates a resolved pack against the Pack Definition rather than merely finding it.
    test("a pack in a named root resolves and is validated", async () => {
        const feed = tree(scratch(), {
            "rituals/checkpoints/pack.json": JSON.stringify({
                portulan: { pack: "1.0", version: "0.1.0" },
                name: "checkpoints",
                category: "rituals",
                summary: "A ritual pack living outside the workspace's tree.",
                doc: "README.md",
                contributes: {},
            }),
            "rituals/checkpoints/README.md": "# checkpoints\n",
        });
        const m = wellFormed();
        m.packs = ["rituals/checkpoints"];
        delete m.tree;
        m.kind = "demo";
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });

        const withRoot = await inspect(dir, { schema: SCHEMA, packRoots: [feed] });
        assert.equal(severities(checks(withRoot.findings, "packs"), "fail").length, 0, text(withRoot.findings));
        assert.equal(withRoot.stats.packs, 1);

        // The negative control: the same workspace without the root cannot resolve it.
        const without = await inspect(dir, { schema: SCHEMA });
        assert.equal(without.stats.packs, 0);
    });

    test("run() passes the flag through, and refuses a root that is not there", async () => {
        const m = wellFormed();
        m.packs = ["rituals/checkpoints"];
        m.kind = "demo";
        delete m.tree;
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
        assert.equal(await run(["--pack-root", path.join(dir, "nope"), dir], { quiet: true }), 2);
        assert.equal(await run(["--pack-root", dir], { quiet: true }), 2, "a flag with no workspace left is not a workspace");
    });
});

describe("--pack-root fails closed in doctor too, not only in index", () => {
    // Copilot, round 7 on #117 — the SIBLING class, and the maintainer's ruling of 2026-07-27 names it:
    // "never ship a change that corrects one wrong claim while knowingly leaving its neighbours." The
    // file-vs-directory check was added to `index` for a round-6 finding and not to the other two tools
    // that take the same flag. Three carriers, one fix.
    test("a root that is a FILE is refused", async () => {
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(wellFormed()) });
        assert.equal(await run(["--pack-root", path.join(dir, "workspace.json"), dir], { quiet: true }), 2);
    });

    test("a root that does not exist is still refused", async () => {
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(wellFormed()) });
        assert.equal(await run(["--pack-root", path.join(dir, "nope"), dir], { quiet: true }), 2);
    });

    test("a directory is accepted", async () => {
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(wellFormed()) });
        assert.notEqual(await run(["--pack-root", dir, dir], { quiet: true }), 2);
    });
});

// ---------------------------------------------------- residence: one repository, one workspace

describe("a repository is governed by exactly one workspace", () => {
    // The maintainer's ruling of 2026-07-30, recorded in ../.portulan/proposals/0017 and railed here.
    // Every one of these was forced RED before its refusal was believed, per proposal 0007 — and the
    // green controls are not decoration: the first draft of this feature made every COMPLIANT pointer
    // red, because `verify.default` is checked unconditionally and a pointer declares no recipes. A
    // suite with only the reds would have shipped that.

    /** A thin manifest that names its governor and carries no policy layer — identity keys and an optional `summary` are the whole permit-list, which is what `extra` adds to below. */
    const pointer = (extra = {}) => ({
        portulan: { spec: "2.7" },
        name: "tipar-api",
        kind: "pointer",
        governed_by: { workspace: "sleepy-panda", feed: "portulan-internal" },
        ...extra,
    });

    /**
     * A host with nothing installed, injected into every inspect of a pointer below.
     *
     * Since milestone 7 `doctor` dereferences `governed_by` against the host's installed-plugin
     * record (./discover.mjs), so an un-injected run reads the machine the suite is on — and this
     * project's own maintainer has the governing workspace of these very fixtures installed. Without
     * this the suite would print one sentence on his laptop and another in CI, which is the class of
     * test that stops meaning anything without ever going red.
     *
     * `emptyHost()` is a fresh directory per call: no record file, so the resolver's `absent` branch
     * answers, which is the state every machine without an install is in.
     *
     * It is spread LAST at every call site (`{ schema: SCHEMA, ...emptyHost() }`), which is what makes
     * the injection hold. `cli/vendor.test.mjs`'s `green()` is hardened against the ordering instead —
     * it takes caller options and merges them, so there the ordering is a promise the helper makes and
     * a caller could otherwise defeat. Here the ordering is visible in each line, so the sibling sweep
     * for that finding (Copilot, round 1) leaves this shape alone deliberately rather than by omission.
     */
    const emptyHost = () => ({ env: { CLAUDE_CONFIG_DIR: scratch() } });

    /** A portfolio workspace with cards for the repositories it covers. */
    const portfolio = (cards) => {
        const m = wellFormed();
        m.name = "sleepy-panda";
        m.kind = "portfolio";
        delete m.tree;
        m.slots.repos = "repos/";
        const files = { ...minimalFiles, "workspace.json": JSON.stringify(m) };
        for (const card of cards) files[`repos/${card}.md`] = `# ${card}\n\nA card.\n`;
        return tree(scratch(), files);
    };

    /** `<root>/<repo>/.portulan/workspace.json`, the layout `--repo-root` looks under. */
    const checkouts = (manifests) =>
        tree(
            scratch(),
            Object.fromEntries(
                Object.entries(manifests).map(([repo, m]) => [`${repo}/.portulan/workspace.json`, JSON.stringify(m)]),
            ),
        );

    test("a pointer carrying governing slots is refused, in the ruling's own words", async () => {
        const m = pointer({
            slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" },
            verify: { default: "docs", recipes: [{ id: "docs", run: "./verify.sh" }] },
        });
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
        const { findings } = await inspect(dir, { schema: SCHEMA, ...emptyHost() });
        const failures = severities(checks(findings, "residence"), "fail");
        assert.equal(failures.length, 1, text(findings));
        assert.match(text(failures), /governed by exactly one workspace/);
        // The keys are NAMED. A refusal that says "carries too much" sends the reader looking.
        assert.match(text(failures), /`slots`, `verify`/);
    });

    test("a governing workspace that also points is refused, from the other side", async () => {
        const m = wellFormed();
        m.governed_by = { workspace: "sleepy-panda" };
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const failures = severities(checks(findings, "residence"), "fail");
        assert.equal(failures.length, 1, text(findings));
        assert.match(text(failures), /governed by exactly one workspace/);
    });

    test("a bare, compliant pointer is GREEN — and says what it did not check", async () => {
        // The control that matters most. `verify.default` is checked unconditionally against a recipe
        // list, so a pointer taking the ordinary path fails a check about a slot it CORRECTLY does not
        // carry: green because the manifest is right, red because the validator did not know that.
        const dir = tree(scratch(), { "workspace.json": JSON.stringify(pointer()) });
        const { findings } = await inspect(dir, { schema: SCHEMA, ...emptyHost() });
        assert.equal(severities(findings, "fail").length, 0, text(findings));
        const notes = text(checks(findings, "residence"));
        assert.match(notes, /governed by `sleepy-panda`/);
        assert.match(notes, /portulan-internal/);
        // Skipped is SAID, never silent — the standing rule about a check that disappears.
        assert.match(notes, /did not run here/);
    });

    test("`summary` is on the pointer's permit-list, and the list is railed rather than described", async () => {
        // The pre-commit checkpoint found `slots.md` claiming a pointer carries "nothing but
        // `governed_by`" while `POINTER_KEYS` deliberately admits `summary` — prose overstating its own
        // mechanism by one key. The prose is corrected; this is the half that stops it drifting back,
        // because nothing held the permit-list before and a future tightening would have broken no test.
        const dir = tree(scratch(), {
            "workspace.json": JSON.stringify(pointer({ summary: "Governed by the Sleepy Panda portfolio workspace." })),
        });
        const { findings } = await inspect(dir, { schema: SCHEMA, ...emptyHost() });
        assert.equal(severities(findings, "fail").length, 0, text(findings));

        // And the negative half: a key that is NOT on the list is still refused, so the exemption is the
        // list rather than a general softening.
        const bad = tree(scratch(), {
            "workspace.json": JSON.stringify(pointer({ packs: ["rituals/checkpoints"] })),
        });
        const { findings: refused } = await inspect(bad, { schema: SCHEMA, ...emptyHost() });
        assert.equal(severities(checks(refused, "residence"), "fail").length, 1, text(refused));
        assert.match(text(checks(refused, "residence")), /`packs`/);
    });

    test("a pointer with no feed names its governor and does not invent a delivery", async () => {
        const m = pointer();
        m.governed_by = { workspace: "sleepy-panda" };
        const dir = tree(scratch(), { "workspace.json": JSON.stringify(m) });
        const { findings } = await inspect(dir, { schema: SCHEMA, ...emptyHost() });
        assert.equal(severities(findings, "fail").length, 0, text(findings));
        assert.doesNotMatch(text(checks(findings, "residence")), /delivered through/);
    });

    // ---- the pointer's name, dereferenced — milestone 7's discovery
    //
    // Until this landed, `doctor` on a pointer printed *"Nothing was fetched … the roots are named
    // rather than found (milestone 7)"* and the boot skill instructed *"Do not fetch it … nothing
    // here discovers one."* Both were true, and both were the whole of issue #134's open half: the
    // repository said which workspace governs it and nothing anywhere turned that name into a
    // directory. These four tests are the four answers a resolver is allowed to give.
    //
    // Every one injects its host. The negative control is the one to keep: an absent record must read
    // as *not installed*, and an unreadable one must not.

    /** A host carrying one installed plugin whose payload IS a workspace of the given name. */
    const hostWith = (name, { plugin = "sleepy-panda", marketplace = "portulan-internal", version = "0.5.0" } = {}) => {
        const config = scratch();
        const installPath = path.join(config, "plugins", "cache", marketplace, plugin, version);
        fs.mkdirSync(installPath, { recursive: true });
        fs.writeFileSync(
            path.join(installPath, "workspace.json"),
            JSON.stringify({ portulan: { spec: "2.7" }, name, kind: "portfolio" }),
        );
        const record = path.join(config, "plugins", "installed_plugins.json");
        fs.mkdirSync(path.dirname(record), { recursive: true });
        fs.writeFileSync(
            record,
            JSON.stringify({ version: 2, plugins: { [`${plugin}@${marketplace}`]: [{ scope: "user", installPath, version }] } }),
        );
        return { config, installPath, env: { CLAUDE_CONFIG_DIR: config } };
    };

    test("a pointer whose governor IS installed resolves to the directory, and names it", async () => {
        // #134's acceptance criterion at the `doctor` layer: the boot reports what this says.
        const host = hostWith("sleepy-panda");
        const dir = tree(scratch(), { "workspace.json": JSON.stringify(pointer()) });
        const { findings, governor } = await inspect(dir, { schema: SCHEMA, env: host.env });
        assert.equal(severities(findings, "fail").length, 0, text(findings));
        assert.equal(governor.state, "resolved");
        assert.equal(governor.root, host.installPath);
        const notes = text(checks(findings, "residence"));
        assert.match(notes, /is installed here/);
        assert.match(notes, /sleepy-panda@portulan-internal/);
        assert.match(notes, /version 0\.5\.0/);
        // The root is actionable, and what to run against it is said rather than left to be guessed.
        assert.match(notes, /to grade it/);
        // The sentence this replaced must be gone: a document denying a capability that exists is the
        // same defect as one claiming a capability that does not.
        assert.doesNotMatch(notes, /the roots are named rather than found/);
    });

    test("a pointer whose governor is NOT installed gets the honest sentence, and stays green", async () => {
        // A pointer is correct while its governor is uninstalled — a fresh clone is in exactly that
        // state, and so is every CI run. Failing here would red an honest manifest.
        const dir = tree(scratch(), { "workspace.json": JSON.stringify(pointer()) });
        const { findings, governor } = await inspect(dir, { schema: SCHEMA, ...emptyHost() });
        assert.equal(severities(findings, "fail").length, 0, text(findings));
        assert.equal(governor.state, "not-installed");
        const notes = text(checks(findings, "residence"));
        assert.match(notes, /is not installed here/);
        assert.match(notes, /never the network/);
        assert.doesNotMatch(notes, /to grade it/);
    });

    test("the wrong feed is not a hit, and the near miss is reported rather than swallowed", async () => {
        const host = hostWith("sleepy-panda", { marketplace: "some-public-feed" });
        const dir = tree(scratch(), { "workspace.json": JSON.stringify(pointer()) });
        const { findings, governor } = await inspect(dir, { schema: SCHEMA, env: host.env });
        assert.equal(governor.state, "not-installed");
        assert.match(text(checks(findings, "residence")), /which is not the feed `portulan-internal` this pointer names/);
    });

    test("an unreadable installed-plugin record is could-not-look, never absence", async () => {
        const config = scratch();
        const record = path.join(config, "plugins", "installed_plugins.json");
        fs.mkdirSync(path.dirname(record), { recursive: true });
        fs.writeFileSync(record, "{ not json");
        const dir = tree(scratch(), { "workspace.json": JSON.stringify(pointer()) });
        const { findings, governor } = await inspect(dir, { schema: SCHEMA, env: { CLAUDE_CONFIG_DIR: config } });
        assert.equal(governor.state, "could-not-look");
        assert.equal(severities(findings, "fail").length, 0, text(findings));
        assert.match(text(checks(findings, "residence")), /never \*not installed\*/);
    });

    test("the resolver is injectable, so a surface can be tested without a host at all", async () => {
        // The seam the boot skill's own demonstration uses. It also pins that `doctor` prints the
        // resolver's OWN sentence rather than paraphrasing it into a second carrier.
        const dir = tree(scratch(), { "workspace.json": JSON.stringify(pointer()) });
        let asked = null;
        const { findings } = await inspect(dir, {
            schema: SCHEMA,
            discover: (governedBy) => {
                asked = governedBy;
                return { state: "ambiguous", sentence: "a sentence only the resolver could have written" };
            },
        });
        assert.deepEqual(asked, { workspace: "sleepy-panda", feed: "portulan-internal" });
        assert.match(text(checks(findings, "residence")), /a sentence only the resolver could have written/);
    });

    test("an ASYNC resolver is awaited — the injection point may not silently yield a Promise", async () => {
        // `inspect` is `async` and `options.discover` is an injection point, so a hook that returns a
        // promise must work. Before it was awaited, `governor.state` came back `undefined` and the
        // report described a Promise rather than a host — a silent wrong answer rather than a crash.
        // Today's resolver is synchronous and `await` on a plain value is a no-op, which is why the
        // sync cases above still pass unchanged. (Copilot, round 2.)
        const dir = tree(scratch(), { "workspace.json": JSON.stringify(pointer()) });
        const { findings } = await inspect(dir, {
            schema: SCHEMA,
            discover: async () => ({ state: "not-installed", sentence: "answered from a promise" }),
        });
        assert.equal(severities(findings, "fail").length, 0, text(findings));
        assert.match(text(checks(findings, "residence")), /answered from a promise/);
        assert.doesNotMatch(text(checks(findings, "residence")), /supplied no sentence/);
    });

    test("a verdict with no `state` is named by its shape, never printed as the word `undefined`", async () => {
        // #182 item 2. The fallback exists because a resolver returning no sentence is a defect in the
        // resolver — and the fallback had that same defect itself, interpolating `undefined` into the
        // one sentence whose job is to say a resolver misbehaved.
        const dir = tree(scratch(), { "workspace.json": JSON.stringify(pointer()) });
        const { findings } = await inspect(dir, { schema: SCHEMA, discover: () => ({ nonsense: 1, other: 2 }) });
        const residence = text(checks(findings, "residence"));
        assert.match(residence, /supplied no sentence/);
        assert.match(residence, /no `state` at all/);
        assert.match(residence, /`nonsense`, `other`/, "and it names what it actually received");
        assert.doesNotMatch(residence, /undefined/, "the word the fix exists to remove");
        // Still green: no discovery outcome moves this tool's verdict, and a malformed resolver is a
        // defect in the resolver rather than in the workspace being graded.
        assert.equal(severities(findings, "fail").length, 0, text(findings));

        // An empty object has no keys to name, and says so rather than printing an empty list.
        const empty = await inspect(dir, { schema: SCHEMA, discover: () => ({}) });
        assert.match(text(checks(empty.findings, "residence")), /keys: none/);

        // And a `state` that is PRESENT but not a string is its own shape: calling that "no `state` at
        // all" while listing `state` among the keys is the same class of wrong one revision later.
        // Found at the pre-commit checkpoint by feeding it `{state: 123}` rather than by reading it.
        const wrongType = await inspect(dir, { schema: SCHEMA, discover: () => ({ state: 123 }) });
        const said = text(checks(wrongType.findings, "residence"));
        assert.match(said, /a `state` that is not a string \(`number`\)/);
        assert.doesNotMatch(said, /no `state` at all/);
    });

    test("NO discovery outcome moves this tool's verdict — all four leave a compliant pointer green", async () => {
        // The invariant, asserted rather than trusted to the three cases above happening to agree.
        // `doctor`'s exit code is a statement about a WORKSPACE; letting a host's install state move
        // it would make the verdict a fact about somebody's laptop — and CI, where nothing is ever
        // installed, would then disagree with every developer machine. Named at the session-open
        // checkpoint, where the plan's word for the two-candidate case was "refuse", which reads as a
        // failure and is not one.
        const dir = tree(scratch(), { "workspace.json": JSON.stringify(pointer()) });
        for (const state of ["resolved", "not-installed", "ambiguous", "could-not-look"]) {
            const { findings } = await inspect(dir, {
                schema: SCHEMA,
                discover: () => ({ state, root: state === "resolved" ? dir : null, sentence: `state: ${state}` }),
            });
            assert.equal(severities(findings, "fail").length, 0, `${state} must not fail: ${text(findings)}`);
            assert.match(text(checks(findings, "residence")), new RegExp(`state: ${state}`));
        }
    });

    test("the schema requires `governed_by` of a pointer and `slots`/`verify` of a workspace", async () => {
        // The requirement stayed IN the schema at 2.7 rather than moving into `doctor` — the `oneOf`
        // carries it per form. Checked here so the split cannot rot into a doctor-only rule.
        const m = pointer();
        delete m.governed_by;
        assert.notEqual(validate(SCHEMA, m).length, 0, "a pointer with no governor must not validate");

        const w = wellFormed();
        delete w.verify;
        assert.notEqual(validate(SCHEMA, w).length, 0, "a governing workspace with no verify must not validate");

        // And the MINOR property, stated as a test rather than as a sentence: every shape valid before
        // 2.7 is valid at 2.7. `examples/` is the second instance and is still on 2.4.
        assert.equal(validate(SCHEMA, wellFormed()).length, 0);
        assert.equal(validate(SCHEMA, pointer()).length, 0);
    });

    test("a named repository carrying its own full workspace is refused", async () => {
        const dir = portfolio(["tipar-api", "lantern"]);
        const root = checkouts({
            "tipar-api": { ...wellFormed(), name: "tipar-api", tree: "../" },
            lantern: pointer({ name: "lantern" }),
        });
        const { findings } = await inspect(dir, { schema: SCHEMA, repoRoots: [root] });
        const failures = severities(checks(findings, "residence"), "fail");
        assert.equal(failures.length, 1, text(findings));
        assert.match(text(failures), /tipar-api/);
        assert.match(text(failures), /governed by exactly one workspace/);
        // The compliant sibling is reported green in the same run, so the red is the card and not the run.
        assert.match(text(checks(findings, "residence")), /`lantern` carries a pointer naming this workspace/);
    });

    test("a named repository pointing at a THIRD workspace is refused", async () => {
        const dir = portfolio(["tipar-api"]);
        const root = checkouts({ "tipar-api": pointer({ governed_by: { workspace: "some-other-portfolio" } }) });
        const { findings } = await inspect(dir, { schema: SCHEMA, repoRoots: [root] });
        const failures = severities(checks(findings, "residence"), "fail");
        assert.equal(failures.length, 1, text(findings));
        assert.match(text(failures), /some-other-portfolio/);
    });

    test("a workspace that names its OWN repository is not two managers", async () => {
        // Customer zero's shape: `.portulan/` names the card `portulan`, so a root holding the Portulan
        // checkout finds this very manifest. One workspace seen from outside is not two workspaces, and
        // the first draft of this check refused the arrangement the ruling PERMITS. Caught at the
        // session-open checkpoint, adjustment 2.
        // Built the way a repository really sits: the workspace is `<repo>/.portulan/`, and the root
        // holds the REPO. Comparison is on the real path, so the symlink is the point rather than a
        // convenience — a lexical compare would miss the identity and print the false red.
        const m = wellFormed();
        m.name = "sleepy-panda";
        m.slots.repos = "repos/";
        m.tree = "../";
        const repo = tree(scratch(), {
            ".portulan/workspace.json": JSON.stringify(m),
            ".portulan/identity.md": "# Identity\n",
            ".portulan/principles.md": "# Principles\n",
            ".portulan/gate-map.md": "# Gate map\n",
            ".portulan/repos/itself.md": "# itself\n\nA card naming this very repository.\n",
        });
        const dir = path.join(repo, ".portulan");
        const root = scratch();
        fs.symlinkSync(repo, path.join(root, "itself"), "dir");
        const { findings } = await inspect(dir, { schema: SCHEMA, repoRoots: [root] });
        assert.equal(severities(checks(findings, "residence"), "fail").length, 0, text(findings));
        assert.match(text(checks(findings, "residence")), /resolves to this manifest itself/);

        // The negative control: a genuine second workspace at the same name is still refused, so the
        // exemption is identity and not a hole any manifest at that path could walk through.
        const other = checkouts({ itself: { ...wellFormed(), name: "a-second-workspace" } });
        const second = await inspect(dir, { schema: SCHEMA, repoRoots: [other] });
        assert.equal(severities(checks(second.findings, "residence"), "fail").length, 1, text(second.findings));
    });

    test("with no --repo-root, the un-run check says so rather than passing quietly", async () => {
        const dir = portfolio(["tipar-api"]);
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(findings, "residence"), "fail").length, 0);
        assert.match(text(checks(findings, "residence")), /was not checked/);
        assert.match(text(checks(findings, "residence")), /1 repository /);
    });

    test("a named repository with no manifest is reported, never failed", async () => {
        // Not governed by Portulan at all, and not checked out where this run could see it, are two
        // different facts and this check distinguishes neither. Saying so beats guessing.
        const dir = portfolio(["tipar-api"]);
        const { findings } = await inspect(dir, { schema: SCHEMA, repoRoots: [scratch()] });
        assert.equal(severities(checks(findings, "residence"), "fail").length, 0, text(findings));
        assert.match(text(checks(findings, "residence")), /carries no manifest under any named root/);
    });

    test("an unreadable manifest at a named root is reported, never failed", async () => {
        const dir = portfolio(["tipar-api"]);
        const root = tree(scratch(), { "tipar-api/.portulan/workspace.json": "{ not json" });
        const { findings } = await inspect(dir, { schema: SCHEMA, repoRoots: [root] });
        assert.equal(severities(checks(findings, "residence"), "fail").length, 0, text(findings));
        assert.match(text(checks(findings, "residence")), /could not be read/);
    });

    test("--repo-root fails closed on the same two inputs --pack-root does", async () => {
        // The sibling class, and the ruling of 2026-07-27: never fix one carrier and leave its
        // neighbours. The first draft of this comment claimed both flags ran through one helper while
        // `--pack-root` still carried its own copy — a comment asserting a refactor nobody had done,
        // caught by Copilot on round 1. They share `directoryRoot` now, so the claim is true; the two
        // flags below are asserted TOGETHER so a future divergence reds here rather than drifting.
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(wellFormed()) });
        for (const flag of ["--repo-root", "--pack-root"]) {
            assert.equal(await run([flag, path.join(dir, "workspace.json"), dir], { quiet: true }), 2, `${flag}: a FILE is not a root`);
            assert.equal(await run([flag, path.join(dir, "nope"), dir], { quiet: true }), 2, `${flag}: a missing root is not a root`);
            assert.equal(await run([flag, dir], { quiet: true }), 2, `${flag}: a flag with no workspace left is not a workspace`);
            assert.notEqual(await run([flag, dir, dir], { quiet: true }), 2, `${flag}: a directory is accepted`);
        }
    });

    test("a manifest at a named root with an unrecognised kind is reported, never refused", async () => {
        // The sibling of the missing-governor case below, and it SURVIVED that fix — a manifest with no
        // `kind`, or a kind this validator does not know, fell into the governing branch and was refused
        // as `kind: "undefined"`. Copilot, round 4 on #135, one round after round 1 fixed its twin. Both
        // follow from one fact: a manifest at a named root is read, never validated, so this check
        // refuses only what a manifest clearly DECLARES.
        const dir = portfolio(["tipar-api", "lantern"]);
        const root = checkouts({
            "tipar-api": { portulan: { spec: "2.7" }, name: "tipar-api" },
            lantern: { portulan: { spec: "2.7" }, name: "lantern", kind: "something-else" },
        });
        const { findings } = await inspect(dir, { schema: SCHEMA, repoRoots: [root] });
        assert.equal(severities(checks(findings, "residence"), "fail").length, 0, text(findings));
        assert.match(text(checks(findings, "residence")), /no recognisable `kind`/);
        assert.doesNotMatch(text(findings), /kind: "undefined"/);

        // The negative control: a kind this validator DOES know is still refused, so the report is for
        // shapes doctor cannot read rather than an escape any manifest can take.
        const governing = checkouts({ "tipar-api": { ...wellFormed(), name: "tipar-api" } });
        const { findings: refused } = await inspect(dir, { schema: SCHEMA, repoRoots: [governing] });
        assert.equal(severities(checks(refused, "residence"), "fail").length, 1, text(refused));
    });

    test("a pointer at a named root that names no governor is reported, never refused", async () => {
        // A manifest at a named root is read, never validated — it is somebody else's workspace. So a
        // malformed pointer there must not be compared against this workspace's name, which produced
        // "names `undefined` as its governor": a conflicting-governor refusal for a manifest that names
        // no governor at all. Copilot, round 1 on #135.
        const dir = portfolio(["tipar-api"]);
        const root = checkouts({ "tipar-api": { portulan: { spec: "2.7" }, name: "tipar-api", kind: "pointer" } });
        const { findings } = await inspect(dir, { schema: SCHEMA, repoRoots: [root] });
        assert.equal(severities(checks(findings, "residence"), "fail").length, 0, text(findings));
        // The phrasing widened to "no USABLE governing workspace" when #141 extended this branch from
        // absent to invalid; the assertion's intent — the report branch fires and nothing is refused —
        // is unchanged.
        assert.match(text(checks(findings, "residence")), /names no usable governing workspace/);
        assert.doesNotMatch(text(findings), /undefined/);
    });

    test("a pointer whose governor is PRESENT but unusable is reported too — the third gap of one class", async () => {
        // #141. The guard asked `=== undefined`, which catches ABSENT and not INVALID, so `""`, `null`
        // and a non-string fell through to the conflicting-governor branch and were refused for naming
        // a governor they do not name — a false red about somebody else's manifest, in the block whose
        // own rule is *read, never validated*. Third gap of this class in this one block; the first two
        // were a missing `governed_by.workspace` and an unrecognised `kind`.
        for (const governor of ["", "   ", null, 7, {}, []]) {
            const dir = portfolio(["tipar-api"]);
            const root = checkouts({
                "tipar-api": { portulan: { spec: "2.7" }, name: "tipar-api", kind: "pointer", governed_by: { workspace: governor } },
            });
            const { findings } = await inspect(dir, { schema: SCHEMA, repoRoots: [root] });
            const residence = text(checks(findings, "residence"));
            assert.equal(
                severities(checks(findings, "residence"), "fail").length,
                0,
                `governor ${JSON.stringify(governor)} must not be refused: ${text(findings)}`,
            );
            assert.match(residence, /names no usable governing workspace/, JSON.stringify(governor));
            // It names WHAT it received rather than leaving a reader to guess, and never prints the
            // conflicting-governor sentence, which is the false red this closes.
            assert.match(residence, /`governed_by.workspace` is /);
            assert.doesNotMatch(residence, /as its governor/);
        }

        // The BOUNDARY, pinned rather than left in a comment: a padded slug is still a name the
        // manifest DECLARES, so it stays a conflict. Judging its legality would be validating somebody
        // else's workspace, which this block forbids — and a "helpful" two-sided trim would silently
        // flip this red to green. A first draft at `cli/discover.mjs` went exactly that way once.
        const dir = portfolio(["tipar-api"]);
        const root = checkouts({
            "tipar-api": { portulan: { spec: "2.7" }, name: "tipar-api", kind: "pointer", governed_by: { workspace: "  sleepy-panda  " } },
        });
        const { findings } = await inspect(dir, { schema: SCHEMA, repoRoots: [root] });
        assert.equal(severities(checks(findings, "residence"), "fail").length, 1, text(findings));
        // And the padding is visible in the refusal rather than hidden inside backticks.
        assert.match(text(checks(findings, "residence")), /"  sleepy-panda  "/);
    });
});

// ---------------------------------------------------------------- what a pack ships (milestone 7)

// Row 7's validation half, under the maintainer's ruling of 2026-08-03 on
// https://github.com/sleepy-panda-works/portulan/issues/150: the **broad** reading. `doctor` validates a
// skill's frontmatter, a persona against its five-part contract, a pack against its schema, and the
// persona↔agent binding — and it does so for **a pack's** skills and personas, not only for what `new`
// scaffolds. Seven carriers promised that split ("row 6 declares, row 7 validates") and the row's own
// sentence was narrower than all seven; the ruling made the carriers right rather than re-pointing them.
//
// **Why these tests open real files rather than asserting on a manifest.** Until this landed, `doctor`
// counted `contributes.skills` into a report line and opened nothing — and spec/pack.schema.json said in
// as many words that an escaping value there "is still inert" *because* nothing opened it. Opening it is
// what makes containment this tool's problem, so the containment case is here beside the contract cases.

describe("a pack's skills and personas are validated, not counted", () => {
    /** A workspace declaring one pack, plus a packs root holding it. Returns both directories. */
    function withPack(contributes, files) {
        const dir = scratch();
        tree(dir, {
            ...minimalFiles,
            "workspace.json": JSON.stringify({ ...wellFormed(), packs: ["rituals/fixture"] }),
        });
        const root = scratch();
        tree(root, {
            "rituals/fixture/pack.json": JSON.stringify({
                portulan: { pack: "1.0" },
                name: "fixture",
                category: "rituals",
                contributes,
            }),
            ...Object.fromEntries(Object.entries(files).map(([k, v]) => [`rituals/fixture/${k}`, v])),
        });
        return { dir, root };
    }

    const goodSkill = "---\nname: my-check\ndescription: Does a thing, when a rail goes red.\n---\n\n# Skill\n";
    const goodPersona = [
        "---", "name: my-role", "description: A role.", "tools: Read, Grep", "---", "",
        "# Persona — my role", "", "## Charter", "It reviews.", "", "## Autonomy reach", "Propose.", "",
        "## Memory scope", "`personas/my-role/`.", "", "## Read / write posture", "Reads in parallel.", "",
    ].join("\n");

    test("a skill with no frontmatter is a failure, not a count", async () => {
        const { dir, root } = withPack({ skills: ["skills/"] }, { "skills/my-check/SKILL.md": "# no frontmatter here\n" });
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.equal(severities(checks(findings, "packs"), "fail").length, 1, text(findings));
        assert.match(text(findings), /frontmatter/i);
    });

    test("a skill whose name is not kebab-case is a failure", async () => {
        const { dir, root } = withPack({ skills: ["skills/"] }, { "skills/my-check/SKILL.md": "---\nname: My Check\ndescription: x\n---\n" });
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.match(text(checks(findings, "packs")), /kebab|slug|lowercase/i);
    });

    test("a skill with an empty description is a failure — the description IS the trigger", async () => {
        const { dir, root } = withPack({ skills: ["skills/"] }, { "skills/my-check/SKILL.md": "---\nname: my-check\ndescription:\n---\n" });
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.equal(severities(checks(findings, "packs"), "fail").length, 1, text(findings));
    });

    test("a well-formed skill passes and is reported as opened, not merely counted", async () => {
        const { dir, root } = withPack({ skills: ["skills/"] }, { "skills/my-check/SKILL.md": goodSkill });
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.equal(severities(checks(findings, "packs"), "fail").length, 0, text(findings));
        assert.match(text(checks(findings, "packs")), /1 skill\b|validates/);
    });

    test("a persona missing any one of the five parts fails, and the failure NAMES the part", async () => {
        // Named individually so a reader learns which part is absent. "does not meet the contract" sends
        // somebody to read five sections looking for the one that is missing.
        for (const [part, pattern] of [
            ["## Charter", /charter/i],
            ["## Autonomy reach", /autonomy/i],
            ["## Memory scope", /memory scope/i],
            ["## Read / write posture", /posture/i],
        ]) {
            const stripped = goodPersona.split(part)[0];
            const { dir, root } = withPack({ personas: ["personas/my-role.md"] }, { "personas/my-role.md": stripped });
            const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
            assert.equal(severities(checks(findings, "packs"), "fail").length >= 1, true, `${part}: ${text(findings)}`);
            assert.match(text(checks(findings, "packs")), pattern, `the failure for a missing ${part} does not name it`);
        }
    });

    test("a persona with no `tools:` allow-list fails — default-deny is the first part", async () => {
        const { dir, root } = withPack({ personas: ["personas/my-role.md"] }, { "personas/my-role.md": goodPersona.replace("tools: Read, Grep\n", "") });
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.match(text(checks(findings, "packs")), /tools/i);
    });

    test("a persona claiming Prohibited as its reach fails — no role may act in that tier", async () => {
        // core/personas/README.md fixes this, and until now nothing checked it. It is the clause a
        // template cannot hold: prose telling an author not to claim it is not a rule, it is advice.
        const { dir, root } = withPack(
            { personas: ["personas/my-role.md"] },
            { "personas/my-role.md": goodPersona.replace("Propose.", "Prohibited.") },
        );
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.equal(severities(checks(findings, "packs"), "fail").length, 1, text(findings));
        assert.match(text(checks(findings, "packs")), /Prohibited/);
    });

    test("a well-formed persona passes", async () => {
        const { dir, root } = withPack({ personas: ["personas/my-role.md"] }, { "personas/my-role.md": goodPersona });
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.equal(severities(checks(findings, "packs"), "fail").length, 0, text(findings));
    });

    test("a skills root escaping the pack is refused after resolution, never followed", async () => {
        // spec/pack.schema.json's `$defs/filePath` bars only the LEADING `../` form and says so; `a/../../x`
        // matches the pattern and still escapes. The pattern was never the guard — and while nothing opened
        // this key, an escaping value was inert. Opening it is what makes containment this tool's problem.
        const { dir, root } = withPack({ skills: ["skills/"] }, { "skills/keep": "" });
        const outside = scratch();
        tree(outside, { "elsewhere/SKILL.md": "---\nname: x\ndescription: y\n---\n" });
        fs.rmSync(path.join(root, "rituals/fixture/skills"), { recursive: true, force: true });
        fs.symlinkSync(path.join(outside, "elsewhere"), path.join(root, "rituals/fixture/skills"));
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.equal(severities(checks(findings, "packs"), "fail").length, 1, text(findings));
        assert.match(text(checks(findings, "packs")), /outside|escape|symlink|contain/i);
    });

    test("an unreadable skill root is could-not-read, never reported as barren", async () => {
        // Only ENOENT means absent. A walk that reports "no skills here" over a directory it could not
        // open is "nothing looked" recorded as "nothing wrong" — #108's shape, in a new walker.
        const { dir, root } = withPack({ skills: ["skills/"] }, { "skills/my-check/SKILL.md": goodSkill });
        const locked = path.join(root, "rituals/fixture/skills");
        fs.chmodSync(locked, 0o000);
        try {
            const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
            assert.match(text(checks(findings, "packs")), /could not|unreadable|EACCES/i);
            // Asserted against the SUMMARY line specifically, not against every message. The first
            // spelling of this was `doesNotMatch(text(findings), /no skills/)` and it failed against the
            // explanatory message, which quotes the phrase in order to refuse it — an assertion that
            // cannot tell a claim from a quotation of the claim.
            const summary = checks(findings, "packs").map((f) => f.message).find((m) => /contributes/.test(m));
            assert.ok(summary, "no summary line was reported at all");
            assert.match(summary, /UNREAD/, "the summary counted skills without saying a root went unread");
        } finally {
            fs.chmodSync(locked, 0o755);
        }
    });
});

describe("an unreadable directory NESTED under a skills root is not counted as zero", () => {
    test("the root reports UNREAD however deep the unreadable directory sits", async () => {
        // Copilot, round 1 on #156. Its stated mechanism was `found += null` producing NaN; measured,
        // `null` coerces to 0, so the count was not corrupted — it was quietly *understated*, which is
        // worse, because an understated count looks like a root with fewer skills rather than like a
        // walk that failed. The top-level fix propagated `null`; the recursive call swallowed it.
        const dir = scratch();
        tree(dir, { ...minimalFiles, "workspace.json": JSON.stringify({ ...wellFormed(), packs: ["rituals/fixture"] }) });
        const root = scratch();
        tree(root, {
            "rituals/fixture/pack.json": JSON.stringify({
                portulan: { pack: "1.0" },
                name: "fixture",
                category: "rituals",
                contributes: { skills: ["skills/"] },
            }),
            "rituals/fixture/skills/nested/deeper/SKILL.md": "---\nname: x\ndescription: y\n---\n",
        });
        const locked = path.join(root, "rituals/fixture/skills/nested");
        fs.chmodSync(locked, 0o000);
        try {
            const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
            const summary = checks(findings, "packs").map((f) => f.message).find((m) => /contributes/.test(m));
            assert.ok(summary, "no summary line at all");
            assert.match(summary, /UNREAD/, `a nested unreadable directory was counted as zero: ${summary}`);
        } finally {
            fs.chmodSync(locked, 0o755);
        }
    });
});

describe("a symlinked directory under a skills root is reported, never silently skipped", () => {
    test("`Dirent.isDirectory()` is false for a link, so the obvious walk skips it", async () => {
        // Copilot, round 3 on #156. A symlinked directory has isDirectory() === false and
        // isSymbolicLink() === true, so `if (!isDirectory()) continue` skips it with no finding at all —
        // hiding whatever sits behind it. A silent skip is a false green of this walk's own kind.
        const dir = scratch();
        tree(dir, { ...minimalFiles, "workspace.json": JSON.stringify({ ...wellFormed(), packs: ["rituals/fixture"] }) });
        const root = scratch();
        tree(root, {
            "rituals/fixture/pack.json": JSON.stringify({
                portulan: { pack: "1.0" },
                name: "fixture",
                category: "rituals",
                contributes: { skills: ["skills/"] },
            }),
            "rituals/fixture/skills/.keep": "",
        });
        const outside = scratch();
        tree(outside, { "hidden/SKILL.md": "---\nname: hidden\ndescription: behind a link\n---\n" });
        fs.symlinkSync(path.join(outside, "hidden"), path.join(root, "rituals/fixture/skills/linked"));
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.equal(severities(checks(findings, "packs"), "fail").length, 1, text(findings));
        assert.match(text(checks(findings, "packs")), /symlinked directory/i);
    });
});

// ---------------------------------------------------------------- the persona ↔ agent binding

// Row 7's fourth validation — "a skill's frontmatter, a persona against its five-part contract, a pack
// against its schema, and the persona↔agent binding nothing checks today". The first three landed at
// session 2; this is the one that was still owed.
describe("a composed persona is matched to the host binding that would carry it", () => {
    const persona = (name) =>
        [
            "---", `name: ${name}`, "description: A role.", "tools: Read, Grep", "---", "",
            `# Persona — ${name}`, "", "## Charter", "It reviews.", "", "## Autonomy reach", "Propose.", "",
            "## Memory scope", "`personas/x/`.", "", "## Read / write posture", "Reads in parallel.", "",
        ].join("\n");

    /** A workspace composing one pack that contributes one persona, plus whatever sits in `agents/`. */
    function withPersona(agents = {}, { tree: treeDecl = "./", personaName = "my-role" } = {}) {
        const dir = scratch();
        const manifest = { ...wellFormed(), packs: ["rituals/fixture"] };
        if (treeDecl === null) {
            delete manifest.tree;
            manifest.kind = "demo";
        } else {
            manifest.tree = treeDecl;
        }
        tree(dir, { ...minimalFiles, "workspace.json": JSON.stringify(manifest), ...agents });
        const root = scratch();
        tree(root, {
            "rituals/fixture/pack.json": JSON.stringify({
                portulan: { pack: "1.0" },
                name: "fixture",
                category: "rituals",
                contributes: { personas: ["personas/one.md"] },
            }),
            "rituals/fixture/personas/one.md": persona(personaName),
        });
        return { dir, root };
    }

    const bindingsOf = (findings) => checks(findings, "bindings");

    test("a binding that agrees is reported as the pair it is", async () => {
        const { dir, root } = withPersona({ "agents/my-role.md": "---\nname: my-role\ndescription: A role here.\ntools: Read\n---\n" });
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.equal(severities(bindingsOf(findings), "fail").length, 0, text(findings));
        assert.match(text(bindingsOf(findings)), /agents\/my-role\.md/);
    });

    test("no binding is a REPORT, not a failure — and it names the path that would carry one", async () => {
        // A persona without a host binding is unbound rather than wrong: an adopter may be on a host
        // with no agent layer at all, and this repository's own supervisor is deliberately unbound
        // because its ritual's mechanism is a fresh context rather than a subagent.
        const { dir, root } = withPersona();
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.equal(severities(bindingsOf(findings), "fail").length, 0, text(findings));
        assert.match(text(bindingsOf(findings)), /no host binding at `agents\/my-role\.md`/);
        assert.match(text(bindingsOf(findings)), /reported, not failed/);
    });

    test("a binding whose frontmatter names another persona FAILS — the host keys on that field", async () => {
        const { dir, root } = withPersona({ "agents/my-role.md": "---\nname: someone-else\ndescription: x\ntools: Read\n---\n" });
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.equal(severities(bindingsOf(findings), "fail").length, 1, text(findings));
        assert.match(text(bindingsOf(findings)), /binds a persona nobody named/);
    });

    test("a binding with no `tools:` allow-list FAILS — the firewall's first part, gone", async () => {
        const { dir, root } = withPersona({ "agents/my-role.md": "---\nname: my-role\ndescription: x\n---\n" });
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.equal(severities(bindingsOf(findings), "fail").length, 1, text(findings));
        assert.match(text(bindingsOf(findings)), /every tool the host has/);
    });

    test("a binding with no frontmatter at all FAILS — it registers as nothing", async () => {
        const { dir, root } = withPersona({ "agents/my-role.md": "# just a heading\n" });
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.equal(severities(bindingsOf(findings), "fail").length, 1, text(findings));
        assert.match(text(bindingsOf(findings)), /frontmatter/);
    });

    test("a workspace with no `tree` is unverifiable, not unbound", async () => {
        // The same answer every other claim gets without a tree, and for the same reason: there is
        // nowhere for `agents/` to be, which is not the same as having looked and found nothing.
        const { dir, root } = withPersona({}, { tree: null });
        const { findings, stats } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.equal(severities(bindingsOf(findings), "fail").length, 0, text(findings));
        assert.match(text(bindingsOf(findings)), /Unverifiable, not unbound/);
        assert.ok(stats.unverifiable > 0, "an unverifiable binding must be counted with the other unverifiable claims");
    });

    test("a binding that cannot be READ is reported as unread, never as absent", async () => {
        const { dir, root } = withPersona({ "agents/my-role.md": "---\nname: my-role\ntools: Read\n---\n" });
        const file = path.join(dir, "agents", "my-role.md");
        fs.chmodSync(file, 0o000);
        try {
            const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
            // Root ignores the mode bits, so the assertion is conditional on the read actually failing
            // — the alternative is a test that passes for the wrong reason in a container.
            const said = text(bindingsOf(findings));
            if (/could not be read/.test(said)) assert.match(said, /Unread, not absent/);
        } finally {
            fs.chmodSync(file, 0o644);
        }
    });

    test("a persona declaring no `name` is keyed by its filename, and the report says so", async () => {
        const nameless = [
            "---", "description: A role.", "tools: Read", "---", "", "# Persona", "", "## Charter", "x", "",
            "## Autonomy reach", "Propose.", "", "## Memory scope", "x", "", "## Read / write posture", "x", "",
        ].join("\n");
        const dir = scratch();
        tree(dir, { ...minimalFiles, "workspace.json": JSON.stringify({ ...wellFormed(), packs: ["rituals/fixture"] }) });
        const root = scratch();
        tree(root, {
            "rituals/fixture/pack.json": JSON.stringify({
                portulan: { pack: "1.0" }, name: "fixture", category: "rituals",
                contributes: { personas: ["personas/one.md"] },
            }),
            "rituals/fixture/personas/one.md": nameless,
        });
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.match(text(bindingsOf(findings)), /agents\/one\.md/);
        assert.match(text(bindingsOf(findings)), /keyed by filename/);
    });
});

// ---------------------------------------------------------------- agent legibility

// Row 7's 2026-07-28 amendment: "`doctor` scores agent legibility — the audit vision.md's influence
// map calls the unclaimed niche, reading the `affordances` slot that is its input."
describe("agent legibility is scored, reported, and never graded", () => {
    const full = () => ({
        ...wellFormed(),
        gates: "gates.json",
        slots: { ...wellFormed().slots, dod: "dod.md", memory: "memory/", handoffs: "handoffs/" },
        verify: { default: "docs", recipes: [{ id: "docs", run: "./verify.sh", requires: ["bash"] }] },
        memory: { index: { path: "memory-index.md" } },
        handoffs: { index: { path: "handoffs-index.md" } },
        products: [{ id: "one", name: "One", product: "product.md", affordances: "affordances.md" }],
    });
    const withLimits = "# Affordances\n\n## What an agent can rely on here\n\nA thing.\n\n## What an agent must not assume\n\nAnother thing.\n";

    /** Score a manifest against a directory holding whatever affordances documents it names. */
    const scoreOf = (manifest, files = { "affordances.md": withLimits }) => {
        const dir = scratch();
        tree(dir, files);
        return legibility(manifest, dir);
    };

    test("a workspace declaring everything scores every applicable dimension", () => {
        const score = scoreOf(full());
        assert.equal(score.met, score.applicable, JSON.stringify(score.dimensions.filter((d) => !d.met), null, 2));
        assert.equal(score.applicable, 7);
    });

    test("each dimension is independently lost, and no other moves with it", () => {
        // Eight assertions rather than one summed figure: a score that only ever moves as a total is a
        // score nobody can act on, and a dimension quietly coupled to another is a measurement of one
        // thing reported as two.
        const drop = [
            ["requires", (m) => delete m.verify.recipes[0].requires],
            ["gates", (m) => delete m.gates],
            ["dod", (m) => delete m.slots.dod],
            ["memory", (m) => delete m.memory],
            ["handoffs", (m) => delete m.slots.handoffs],
            ["affordances", (m) => delete m.products[0].affordances],
        ];
        for (const [id, mutate] of drop) {
            const manifest = full();
            mutate(manifest);
            const score = scoreOf(manifest);
            const dimension = score.dimensions.find((d) => d.id === id);
            assert.equal(dimension.met, false, `${id} should have been lost`);
            const others = score.dimensions.filter((d) => d.id !== id && d.applicable && !d.met).map((d) => d.id);
            assert.deepEqual(others, [], `dropping ${id} also moved ${others.join(", ")}`);
        }
    });

    test("an affordances document listing only strengths loses the limits dimension", () => {
        const score = scoreOf(full(), { "affordances.md": "# Affordances\n\n## What an agent can rely on here\n\nEverything is wonderful.\n" });
        assert.equal(score.dimensions.find((d) => d.id === "limits").met, false);
        assert.equal(score.dimensions.find((d) => d.id === "affordances").met, true, "declaring one and stating limits in it are two facts");
    });

    test("a workspace-level default counts for a product that declares none", () => {
        // `examples/` ships exactly this shape, and a score contradicting `doctor`'s own note about it
        // in the same run would be the defect this dimension exists to avoid.
        const manifest = full();
        delete manifest.products[0].affordances;
        manifest.affordances = "affordances.md";
        assert.equal(scoreOf(manifest).dimensions.find((d) => d.id === "affordances").met, true);
    });

    test("an unreadable affordances document loses the limits dimension rather than passing it", () => {
        const manifest = full();
        const score = scoreOf(manifest, {});
        assert.equal(score.dimensions.find((d) => d.id === "limits").met, false, "a document nobody could open has not been found to state its limits");
    });

    test("dimensions that do not apply leave the denominator instead of counting as failures", () => {
        const manifest = full();
        delete manifest.products;
        const score = scoreOf(manifest);
        assert.equal(score.applicable, 5, "no products means nothing to declare affordances for");
        assert.equal(score.met, 5);
        assert.deepEqual(score.dimensions.filter((d) => !d.applicable).map((d) => d.id), ["affordances", "limits"]);
    });

    test("the score is printed on every run, and names what it missed", async () => {
        const dir = scratch();
        tree(dir, { ...minimalFiles, "workspace.json": JSON.stringify(wellFormed()), "verify.sh": "#!/bin/sh\n" });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const line = text(checks(findings, "legibility"));
        assert.match(line, /agent legibility \d+ of \d+/);
        assert.match(line, /missing:/);
        assert.match(line, /moves no exit code/);
    });

    test("a low score moves NO exit code — a measurement is not a verdict", async () => {
        // The whole design: a score that could fail a workspace would make `doctor`'s verdict a
        // function of how much affordance prose somebody wrote.
        const dir = scratch();
        tree(dir, { ...minimalFiles, "workspace.json": JSON.stringify(wellFormed()), "verify.sh": "#!/bin/sh\n" });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.equal(findings.filter((f) => f.severity === "fail").length, 0, text(findings));
        assert.ok(legibility(wellFormed(), dir).met < legibility(full(), dir).applicable);
    });

    test("the two workspaces this repository ships score differently, and both are green", () => {
        // The in-tree demonstration: a score that cannot tell two real workspaces apart is a score
        // measuring nothing. Read from the manifests on disk rather than from fixtures.
        const own = legibility(JSON.parse(fs.readFileSync(path.join(REPO, ".portulan", "workspace.json"), "utf8")), path.join(REPO, ".portulan"));
        const demo = legibility(JSON.parse(fs.readFileSync(path.join(REPO, "examples", "workspace.json"), "utf8")), path.join(REPO, "examples"));
        assert.equal(own.met, own.applicable, "customer zero should meet every dimension it asks of others");
        assert.ok(demo.met < demo.applicable, "the demo declares no gate policy and no handoff series");
        assert.deepEqual(demo.dimensions.filter((d) => d.applicable && !d.met).map((d) => d.id), ["gates", "handoffs"]);
    });
});

// Added at the pre-commit checkpoint, which executed the hole rather than reading past it.
describe("a persona's name is a pack's free text, so the binding read is contained", () => {
    /** A pack whose persona declares whatever name it likes — which is what the contract permits. */
    function poison(name) {
        const dir = scratch();
        tree(dir, { ...minimalFiles, "workspace.json": JSON.stringify({ ...wellFormed(), packs: ["rituals/fixture"] }) });
        const root = scratch();
        tree(root, {
            "rituals/fixture/pack.json": JSON.stringify({
                portulan: { pack: "1.0" }, name: "fixture", category: "rituals",
                contributes: { personas: ["personas/one.md"] },
            }),
            "rituals/fixture/personas/one.md": [
                "---", `name: ${name}`, "description: A role.", "tools: Read", "---", "", "# Persona", "",
                "## Charter", "x", "", "## Autonomy reach", "Propose.", "", "## Memory scope", "x", "",
                "## Read / write posture", "x", "",
            ].join("\n"),
        });
        return { dir, root };
    }

    test("a name that traverses upward is refused, not opened and greened", async () => {
        // Measured before the guard: a persona named `../../poison` had `doctor` read
        // `<tree>/../poison.md`, validate it, and print "names and tool grant agree" — a green over a
        // file no host would ever load, with that file's own `name:` echoed into the report.
        // `path.join("agents", "../../poison.md")` is `../poison.md`, so the read this aims at is one
        // level above the tree. Asserted BOTH ways — with the target present and absent — because the
        // first cut only refused it when the file existed, which makes the refusal depend on whether
        // the attacker got there first.
        const { dir, root } = poison("../../poison");
        const outside = path.resolve(dir, "..", "poison.md");
        for (const present of [false, true]) {
            if (present) fs.writeFileSync(outside, "---\nname: ../../poison\ndescription: x\ntools: Read\n---\n");
            try {
                const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
                const said = text(checks(findings, "bindings"));
                assert.match(said, /leaves this workspace's tree/, present ? "with the target present" : "with the target absent");
                assert.doesNotMatch(said, /names and tool grant agree/);
                assert.doesNotMatch(said, /no host binding/, "an escaping key must never be reported as merely unbound");
            } finally {
                fs.rmSync(outside, { force: true });
            }
        }
    });

    test("a binding that is a symlink out of the tree is refused — the test is on the REAL path", async () => {
        const { dir, root } = poison("my-role");
        const outside = scratch();
        fs.writeFileSync(path.join(outside, "elsewhere.md"), "---\nname: my-role\ndescription: x\ntools: Read\n---\n");
        fs.mkdirSync(path.join(dir, "agents"), { recursive: true });
        fs.symlinkSync(path.join(outside, "elsewhere.md"), path.join(dir, "agents", "my-role.md"));
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.match(text(checks(findings, "bindings")), /OUTSIDE this workspace's tree/, "a link inside the tree pointing out of it passes any check on the spelling");
    });

    test("an ordinary name still resolves to an ordinary binding", async () => {
        // The guard must not swallow the case it exists to protect.
        const { dir, root } = poison("my-role");
        fs.mkdirSync(path.join(dir, "agents"), { recursive: true });
        fs.writeFileSync(path.join(dir, "agents", "my-role.md"), "---\nname: my-role\ndescription: x\ntools: Read\n---\n");
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.match(text(checks(findings, "bindings")), /agree/);
    });
});

// Added at the pre-commit checkpoint: the dimension it measured and found constant.
describe("every legibility dimension can actually vary", () => {
    test("no dimension is a guaranteed point on a manifest the schema already requires", () => {
        // `verify` was scored for exactly one checkpoint. The schema's first `oneOf` form requires it
        // of every non-pointer workspace, a pointer never reaches the score, and a manifest that fails
        // the schema returns earlier still — so it was a constant +1 dressed as a measurement.
        const schemaRequired = new Set(SCHEMA.oneOf?.[0]?.required ?? []);
        const ids = legibility({ verify: { recipes: [] }, slots: {} }, scratch()).dimensions.map((d) => d.id);
        for (const id of ids) {
            assert.equal(schemaRequired.has(id), false, `\`${id}\` is required by the schema, so it can never be absent and measures nothing`);
        }
        assert.equal(ids.length, 7, "seven is what the can-it-vary rule leaves; the count is derived here rather than trusted in prose");
    });
});
