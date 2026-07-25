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

/** A throwaway directory, removed when the process exits. */
function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-doctor-"));
    process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
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
        assert.equal(errors.length, 1);
        assert.match(errors[0].message, /enum/);
        assert.equal(errors[0].pointer, "/kind");
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

describe("the schema declares which Workspace Definition version it implements", () => {
    test("the shipped schema carries it in `$id`", () => {
        assert.deepEqual(schemaVersion(SCHEMA), { major: 2, minor: 0 });
    });

    test("a schema whose `$id` does not carry one is refused", () => {
        assert.throws(() => schemaVersion({ $id: "https://portulan.dev/spec/workspace.schema.json" }), DoctorError);
        assert.throws(() => schemaVersion({}), DoctorError);
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

// -------------------------------------------------------------------- the claims lint

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
