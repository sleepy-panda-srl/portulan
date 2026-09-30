// Tests for `doctor` — the Workspace Definition validator.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run as compileRun } from "./compile.mjs";
import { run as contextRun } from "./context.mjs";

// `doctor` reads the host's installed-plugin record, so every case gets an empty host unless it passes `env:`.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

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
    BINDING_OK,
} from "./doctor.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const FIXTURES = path.join(HERE, "fixtures");
const SCHEMA = JSON.parse(
    fs.readFileSync(path.join(REPO, "spec", "workspace.schema.json"), "utf8"),
);

// Spread rather than `$ref`-ed: a `$ref` may carry only annotations beside it, and `$defs` is not one.
const provenanceSchema = { $defs: SCHEMA.$defs, ...SCHEMA.$defs.provenance };

// One exit handler for every scratch directory: one each would pass node's default limit of ten listeners.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) {
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch {
            /* a case died before restoring a mode — sweep what is left rather than abandoning it */
        }
    }
});

function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-doctor-"));
    SCRATCH.push(dir);
    return dir;
}

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

const wellFormed = () => ({
    portulan: { spec: "2.0" },
    name: "fixture",
    kind: "repository",
    tree: "./",
    slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" },
    verify: { default: "docs", recipes: [{ id: "docs", run: "./verify.sh" }] },
});

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

    test("refuses a schema using a keyword outside the subset", () => {
        assert.throws(() => compileSchema({ type: "string", maxLength: 4 }), (error) => {
            assert.ok(error instanceof DoctorError);
            assert.match(error.message, /maxLength/);
            assert.match(error.message, /subset/i);
            return true;
        });
    });

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
        assert.equal(errors.length, 2, errors.map((e) => `${e.pointer} ${e.message}`).join("\n"));
        assert.match(errors[0].message, /enum/);
        assert.equal(errors[0].pointer, "/kind");

        // `kind` discriminates the top-level `oneOf`'s two forms, so a value in neither fails both.
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

    test("`additionalProperties: false` with no `properties` forbids every property", () => {
        const schema = { type: "object", additionalProperties: false };
        assert.deepEqual(validate(schema, {}), []);
        const errors = validate(schema, { anything: 1 });
        assert.equal(errors.length, 1);
        assert.match(errors[0].message, /anything/);
    });
});

describe("a budget or a threshold that is not a positive integer", () => {
    const KEYS = [
        ["librarian.staleness.record_days", (m, v) => ((m.librarian = { staleness: { record_days: v } }), m)],
        ["librarian.staleness.sealed_days", (m, v) => ((m.librarian = { staleness: { sealed_days: v } }), m)],
        ["memory.index.budget.lines", (m, v) => ((m.memory = { index: { path: "memory-index.md", budget: { lines: v } } }), m)],
        ["memory.store.budget.kilobytes", (m, v) => ((m.memory = { store: { budget: { kilobytes: v } } }), m)],
        ["memory.store.budget.record_kilobytes", (m, v) => ((m.memory = { store: { budget: { record_kilobytes: v } } }), m)],
        ["context.always.budget.tokens", (m, v) => ((m.portulan = { spec: "2.9" }), (m.context = { always: { budget: { tokens: v } }, ratio: { bytes_per_token: 3, calibrated_by: "claude-code" } }), m)],
    ];

    for (const [name, set] of KEYS) {
        // The subset can say `number` but neither `integer` nor `minimum`: the schema refuses only a string.
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

describe("the always tier's ratio, and the budget that needs it", () => {
    // `bytes_per_token` may be fractional, since 2.99 is real, but not below 1, which is tokens per byte inverted.
    const withRatio = (ratio) => ({ ...wellFormed(), portulan: { spec: "2.9" }, context: { ratio } });

    for (const spec of ["2.0", "2.8"]) {
        test(`\`context\` in a manifest declaring ${spec} is a failure that names 2.9`, async () => {
            const m = { ...withRatio({ bytes_per_token: 3, calibrated_by: "claude-code" }), portulan: { spec } };
            const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
            const { findings } = await inspect(dir, { schema: SCHEMA });
            const hit = severities(findings, "fail").find((f) => /`context` is Workspace Definition 2\.9's/.test(f.message));
            assert.ok(hit, `expected the version gate to refuse \`context\` under ${spec}`);
            assert.match(hit.message, new RegExp(`declares ${spec.replace(".", "\\.")}`));
        });
    }

    for (const bad of [0, -1, 0.33]) {
        test(`bytes_per_token ${bad} is a failure that says why`, async () => {
            const m = withRatio({ bytes_per_token: bad, calibrated_by: "claude-code" });
            const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
            const { findings } = await inspect(dir, { schema: SCHEMA });
            const hit = severities(findings, "fail").find((f) => /bytes_per_token/.test(f.message));
            assert.ok(hit, `expected a failure for bytes_per_token ${bad}`);
            assert.match(hit.message, /inverted/);
        });
    }

    test("a budget that is not a positive integer is refused without claiming a consumer", async () => {
        const m = withRatio({ bytes_per_token: 3, calibrated_by: "claude-code" });
        m.context.always = { budget: { tokens: 0 } };
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const hit = severities(findings, "fail").find((f) => /context\.always\.budget\.tokens/.test(f.message));
        assert.ok(hit, "expected a failure naming context.always.budget.tokens");
        assert.doesNotMatch(hit.message, /exit 2|consuming tool/);
    });

    for (const good of [1, 2.99]) {
        test(`bytes_per_token ${good} passes`, async () => {
            const m = withRatio({ bytes_per_token: good, calibrated_by: "claude-code" });
            const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
            const { findings } = await inspect(dir, { schema: SCHEMA });
            assert.deepEqual(severities(findings, "fail"), []);
        });
    }

    test("a budget with no ratio is refused by the schema", () => {
        const errors = validate(SCHEMA, { ...wellFormed(), context: { always: { budget: { tokens: 8000 } } } });
        assert.ok(errors.some((e) => e.pointer === "/context" && /`ratio`/.test(e.message)), JSON.stringify(errors));
    });

    test("a ratio with no calibrating host is refused by the schema", () => {
        const errors = validate(SCHEMA, withRatio({ bytes_per_token: 2.99 }));
        assert.ok(errors.some((e) => e.pointer === "/context/ratio" && /`calibrated_by`/.test(e.message)), JSON.stringify(errors));
    });
});

describe("what every context loads is reported, and failed only against a declared budget", () => {
    const budgeted = (tokens) => ({
        ...wellFormed(),
        portulan: { spec: "2.9" },
        context: { always: { budget: { tokens } }, ratio: { bytes_per_token: 3, calibrated_by: "claude-code" } },
    });
    const noTree = (m) => {
        const copy = { ...m, kind: "demo" };
        delete copy.tree;
        return copy;
    };
    // 3,000 bytes: 1,000 tokens at the ratio above.
    const instructions = "Always run the recipe before you say done.\n".repeat(70).slice(0, 3000);
    const only = (findings) => {
        const hits = checks(findings, "context");
        assert.equal(hits.length, 1, `expected one context finding, got ${JSON.stringify(hits)}`);
        return hits[0];
    };

    test("with no budget declared it is a note: the size, the largest file and what it is, and init's offer", async () => {
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(wellFormed()), "CLAUDE.md": instructions });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const hit = only(findings);
        assert.equal(hit.severity, "report");
        assert.match(hit.message, /^Claude Code: this repository's always tier is ~1,003 tokens, 3,000 B at 2\.99 bytes per token/);
        assert.match(hit.message, /the largest: CLAUDE\.md ~1,003 \(instructions\)/);
        assert.match(hit.message, /budget: undeclared \(context\.always\.budget\.tokens\) — a report, not a rail; init would offer/);
        assert.deepEqual(severities(findings, "fail"), []);
    });

    test("a declared budget exceeded is a failure naming the repair, and a demotion returns it green", async () => {
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(budgeted(800)), "CLAUDE.md": instructions });
        const over = only((await inspect(dir, { schema: SCHEMA })).findings);
        assert.equal(over.severity, "fail");
        assert.match(over.message, /over the 800 declared by 200 — repair by demotion to a later tier, by a merge or by a retirement, never by raising the budget in this change$/);

        fs.rmSync(path.join(dir, "CLAUDE.md"));
        tree(dir, { ".claude/rules/done.md": `---\npaths: src/**\n---\n\n${instructions}` });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const within = only(findings);
        assert.equal(within.severity, "report");
        assert.match(within.message, /1 path-scoped rule sits on-path/);
        assert.match(within.message, /budget: the always tier is ~0 tokens of the 800 declared$/);
        assert.deepEqual(severities(findings, "fail"), []);
    });

    test("a declared budget it cannot judge is a failure, never a pass over nothing measured", async () => {
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(noTree(budgeted(8000))) });
        const hit = only((await inspect(dir, { schema: SCHEMA })).findings);
        assert.equal(hit.severity, "fail");
        assert.match(hit.message, /^Claude Code: the declared budget cannot be judged — this workspace declares no tree/);
    });

    test("with no budget declared, a tier it could not measure is said and moves no exit code", async () => {
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(noTree(wellFormed())) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const hit = only(findings);
        assert.equal(hit.severity, "report");
        assert.match(hit.message, /^Claude Code: the always tier is not measured — this workspace declares no tree/);
        assert.deepEqual(severities(findings, "fail"), []);
    });

    test("the line is the one the boot closes with", async () => {
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(budgeted(5000)),
            "CLAUDE.md": `${instructions}\nSee @notes.md\n`,
            "notes.md": "Notes the instructions import.\n",
            ".claude/rules/style.md": "Keep lines short.\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const lines = [];
        assert.equal(contextRun(["--workspace", dir, "--brief"], (line) => lines.push(line)), 0);
        assert.deepEqual(lines, [only(findings).message]);
    });

    test("a pointer is not measured, and the report says so among the checks that did not run", async () => {
        const m = { portulan: { spec: "2.7" }, name: "fixture", kind: "pointer", governed_by: { workspace: "elsewhere" } };
        const dir = tree(scratch(), { "workspace.json": JSON.stringify(m) });
        const { findings } = await inspect(dir, { schema: SCHEMA, env: { CLAUDE_CONFIG_DIR: scratch() } });
        assert.deepEqual(checks(findings, "context"), []);
        assert.match(text(checks(findings, "residence")), /the always tier's report/);
    });
});

describe("which form a consumer's records and boot are in is reported, and never failed", () => {
    const only = (findings) => {
        const hits = checks(findings, "form");
        assert.equal(hits.length, 1, `expected one form finding, got ${JSON.stringify(hits)}`);
        return hits[0];
    };

    test("today's form is a report naming each piece and the command that moves it", async () => {
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify(wellFormed()),
            "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n\n- An entry.\n",
            "notes.md": "# Notes\n\n## Session log\n\n- 2026-09-20: a thing.\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        const hit = only(findings);
        assert.equal(hit.severity, "report");
        assert.match(
            hit.message,
            /^today's form in 4 of 4: no changes\/README\.md; CHANGELOG\.md holds 1 entry under Unreleased; a Session log with entries in notes\.md; no boot card: `slots\.context` is undeclared — `portulan upgrade --write .+` moves it, and until then it boots as it did$/,
        );
        assert.deepEqual(severities(findings, "fail"), []);
    });

    test("over a declared budget, marked sections are named with the command that moves them, since `upgrade` does not run", async () => {
        const context = { always: { budget: { tokens: 5 } }, ratio: { bytes_per_token: 3, calibrated_by: "claude-code" } };
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify({ ...wellFormed(), portulan: { spec: "2.9" }, context }),
            "CLAUDE.md": "# Desk\n\n## Loans\n<!-- portulan: on-read -->\n\nA loan lasts three weeks.\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.equal(checks(findings, "context")[0].severity, "fail", "the budget is breached");
        const hit = only(findings);
        assert.equal(hit.severity, "report");
        assert.match(
            hit.message,
            /1 section of CLAUDE\.md marked to move to on-read units — `node <plugin root>\/cli\/instructions\.mjs --workspace \S+ --write` moves the marked sections, since `portulan upgrade` does not run over a breached budget, and `portulan upgrade --write \S+` moves the rest once it runs, and until then it boots as it did$/,
        );
    });

    test("the new form says so, and a declared slot with no card is a choice, not a piece owed", async () => {
        const dir = tree(scratch(), {
            ...minimalFiles,
            "workspace.json": JSON.stringify({ ...wellFormed(), portulan: { spec: "2.10" }, slots: { ...wellFormed().slots, context: "context/" } }),
            "context/a.md": "---\ntier: always\n---\n\nA.\n",
            "changes/README.md": "# Changelog fragments\n",
        });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.equal(
            only(findings).message,
            "the new form: changelog fragments in changes/; no Session log with entries; no boot card, by choice: `slots.context` holds no `boot` unit",
        );
        assert.deepEqual(severities(findings, "fail"), []);
    });

    test("a workspace with no tree is not reported on, and says why", async () => {
        const m = { ...wellFormed(), kind: "demo" };
        delete m.tree;
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
        assert.match(only((await inspect(dir, { schema: SCHEMA })).findings).message, /^not reported: this workspace declares no tree/);
    });
});

describe("the guidance slot, which compile reads", () => {
    const withGuidance = (spec) => ({ ...wellFormed(), portulan: { spec }, slots: { ...wellFormed().slots, context: "context/" } });
    const unit = "---\ntier: always\n---\n\nA.\n";

    for (const spec of ["2.0", "2.9"]) {
        test(`\`slots.context\` in a manifest declaring ${spec} is a failure that names 2.10`, async () => {
            const dir = tree(scratch(), { ...minimalFiles, "context/a.md": unit, "workspace.json": JSON.stringify(withGuidance(spec)) });
            const { findings } = await inspect(dir, { schema: SCHEMA });
            const hit = severities(findings, "fail").find((f) => /`slots\.context` is Workspace Definition 2\.10's/.test(f.message));
            assert.ok(hit, `expected the version gate to refuse \`slots.context\` under ${spec}`);
            assert.match(hit.message, new RegExp(`declares ${spec.replace(".", "\\.")}`));
        });
    }

    test("declared at 2.10 over a directory that is there, it passes", async () => {
        const dir = tree(scratch(), { ...minimalFiles, "context/a.md": unit, "workspace.json": JSON.stringify(withGuidance("2.10")) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.deepEqual(severities(findings, "fail"), []);
    });

    test("declared over a directory that is not there, it fails as every directory slot does", async () => {
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(withGuidance("2.10")) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.ok(severities(findings, "fail").some((f) => /slots\.context/.test(f.message)), JSON.stringify(findings));
    });
});

describe("the memory cap's cutoff", () => {
    const withCutoff = (spec, budget) =>
        tree(scratch(), {
            ...minimalFiles,
            "memory/r.md": "x\n",
            "workspace.json": JSON.stringify({
                ...wellFormed(),
                portulan: { spec },
                slots: { ...wellFormed().slots, memory: "memory/" },
                memory: { store: { budget } },
            }),
        });

    test("declared at 2.11 beside `record_kilobytes`, it passes", async () => {
        const { findings } = await inspect(withCutoff("2.11", { record_kilobytes: 2, cutoff: "2026-09-24" }), { schema: SCHEMA });
        assert.deepEqual(severities(findings, "fail"), []);
    });

    test("in a manifest declaring 2.10 it is a failure that names 2.11", async () => {
        const { findings } = await inspect(withCutoff("2.10", { record_kilobytes: 2, cutoff: "2026-09-24" }), { schema: SCHEMA });
        assert.ok(
            severities(findings, "fail").some((f) => /`memory\.store\.budget\.cutoff` is Workspace Definition 2\.11's/.test(f.message)),
            JSON.stringify(findings),
        );
    });

    for (const bad of ["2026-02-30", "2026-13-01"]) {
        test(`${bad} passes the pattern and is refused as no real day`, async () => {
            const { findings } = await inspect(withCutoff("2.11", { record_kilobytes: 2, cutoff: bad }), { schema: SCHEMA });
            assert.ok(severities(findings, "fail").some((f) => /not a real day/.test(f.message)), JSON.stringify(findings));
        });
    }

    test("with no `record_kilobytes` beside it, it is refused as configuring nothing", async () => {
        const { findings } = await inspect(withCutoff("2.11", { kilobytes: 200, cutoff: "2026-09-24" }), { schema: SCHEMA });
        assert.ok(severities(findings, "fail").some((f) => /configures nothing/.test(f.message)), JSON.stringify(findings));
    });
});

describe("the session switches, which compile and the runners read", () => {
    const withSessions = (spec, sessions) => ({ ...wellFormed(), portulan: { spec }, sessions });
    const declared = { git_instructions: false, cache_lifetime: "1h", headless: { cache_lifetime: "5m", exclude_dynamic_sections: true } };

    for (const spec of ["2.0", "2.10"]) {
        test(`\`sessions\` in a manifest declaring ${spec} is a failure that names 2.11`, async () => {
            const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(withSessions(spec, declared)) });
            const { findings } = await inspect(dir, { schema: SCHEMA });
            const hit = severities(findings, "fail").find((f) => /`sessions` is Workspace Definition 2\.11's/.test(f.message));
            assert.ok(hit, `expected the version gate to refuse \`sessions\` under ${spec}`);
            assert.match(hit.message, new RegExp(`declares ${spec.replace(".", "\\.")}`));
        });
    }

    test("declared at 2.11, every switch passes", async () => {
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(withSessions("2.11", declared)) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.deepEqual(severities(findings, "fail"), []);
    });

    for (const [what, sessions, pointer] of [
        ["a lifetime the host does not take", { cache_lifetime: "30m" }, /\/sessions\/cache_lifetime/],
        ["a switch spelled as a string", { git_instructions: "false" }, /\/sessions\/git_instructions/],
        ["an unknown switch", { headless: { model: "any" } }, /\/sessions\/headless/],
    ]) {
        test(`${what} is refused by the schema`, async () => {
            const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(withSessions("2.11", sessions)) });
            const { findings } = await inspect(dir, { schema: SCHEMA });
            assert.ok(severities(findings, "fail").some((f) => pointer.test(f.message)), JSON.stringify(findings));
        });
    }
});

describe("the declared multipliers and horizon, which compile and the ledger read", () => {
    const write = { "5m": 1.25, "1h": 2 };
    const declared = { multipliers: { read: 0.05, write }, horizon: { requests: 30 } };
    const inspected = async (spec, spend) => {
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify({ ...wellFormed(), portulan: { spec }, spend }) });
        return (await inspect(dir, { schema: SCHEMA })).findings;
    };

    for (const spec of ["2.0", "2.11"]) {
        test(`\`spend\` in a manifest declaring ${spec} is a failure that names 2.12`, async () => {
            const hit = severities(await inspected(spec, declared), "fail").find((f) => /`spend` is Workspace Definition 2\.12's/.test(f.message));
            assert.ok(hit, `expected the version gate to refuse \`spend\` under ${spec}`);
            assert.match(hit.message, new RegExp(`declares ${spec.replace(".", "\\.")}`));
        });
    }

    for (const [what, spend] of [
        ["both halves", declared],
        ["the multipliers alone", { multipliers: declared.multipliers }],
        ["the horizon alone", { horizon: { requests: 1 } }],
        ["every figure at its bound", { multipliers: { read: 1, write: { "5m": 1, "1h": 1 } } }],
    ]) {
        test(`declared at 2.12, ${what} passes`, async () => {
            assert.deepEqual(severities(await inspected("2.12", spend), "fail"), []);
        });
    }

    for (const [what, spend, said] of [
        ["a read of 0", { multipliers: { read: 0, write } }, /^spend\.multipliers\.read is 0, and it must be a finite number above 0 and at most 1/],
        ["a negative read", { multipliers: { read: -0.1, write } }, /^spend\.multipliers\.read is -0\.1/],
        ["a read above 1", { multipliers: { read: 1.5, write } }, /^spend\.multipliers\.read is 1\.5/],
        ["a five-minute write under 1", { multipliers: { read: 0.1, write: { ...write, "5m": 0.5 } } }, /^spend\.multipliers\.write\["5m"\] is 0\.5, and it must be a finite number of at least 1/],
        ["a one-hour write under 1", { multipliers: { read: 0.1, write: { ...write, "1h": 0 } } }, /^spend\.multipliers\.write\["1h"\] is 0/],
        ["a horizon of 0", { horizon: { requests: 0 } }, /^spend\.horizon\.requests is 0, which is not a positive integer/],
        ["a negative horizon", { horizon: { requests: -3 } }, /^spend\.horizon\.requests is -3/],
        ["a fractional horizon, which the subset cannot refuse", { horizon: { requests: 2.5 } }, /^spend\.horizon\.requests is 2\.5/],
        ["a write the read divides past the largest number", { multipliers: { read: Number.MIN_VALUE, write: { ...write, "1h": Number.MAX_VALUE } } }, /^spend\.multipliers\.write\["1h"\] divided by spend\.multipliers\.read overflows, so no finite restart threshold/],
    ]) {
        test(`${what} is refused by hand, and says why`, async () => {
            const fails = severities(await inspected("2.12", spend), "fail");
            assert.ok(fails.some((f) => f.check === "schema" && said.test(f.message)), JSON.stringify(fails));
        });
    }

    test("`spend.restart` in a manifest declaring 2.12 is a failure that names 2.13, and the rest of `spend` passes there", async () => {
        const fails = severities(await inspected("2.12", { ...declared, restart: "block" }), "fail");
        assert.deepEqual(
            fails.map((f) => f.message),
            ["`spend.restart` is Workspace Definition 2.13's, and this manifest declares 2.12, whose validator refuses it as an unknown key. Declare 2.13, or remove the key"],
        );
    });

    for (const restart of ["advise", "block"]) {
        test(`declared at 2.13, a restart of "${restart}" passes, alone or beside the figures`, async () => {
            assert.deepEqual(severities(await inspected("2.13", { restart }), "fail"), []);
            assert.deepEqual(severities(await inspected("2.13", { ...declared, restart }), "fail"), []);
        });
    }

    for (const [what, spend, pointer] of [
        ["a restart it does not take", { restart: "stop" }, /^\/spend\/restart — value "stop" is not one of the permitted values \(enum: "advise", "block"\)/],
        ["a restart spelled as a boolean", { restart: true }, /^\/spend\/restart — expected type `string`/],
        ["multipliers with no write", { multipliers: { read: 0.1 } }, /^\/spend\/multipliers — required property `write` is missing/],
        ["a write for one lifetime only", { multipliers: { read: 0.1, write: { "5m": 1.25 } } }, /^\/spend\/multipliers\/write — required property `1h` is missing/],
        ["a horizon with no requests", { horizon: {} }, /^\/spend\/horizon — required property `requests` is missing/],
        ["an unknown key", { price: 1 }, /^\/spend\/price — unexpected property/],
        ["a figure spelled as a string", { multipliers: { read: "0.1", write } }, /^\/spend\/multipliers\/read — expected type `number`/],
    ]) {
        test(`${what} is refused by the schema`, async () => {
            const fails = severities(await inspected(spend.restart === undefined ? "2.12" : "2.13", spend), "fail");
            assert.ok(fails.some((f) => pointer.test(f.message)), JSON.stringify(fails));
        });
    }
});

describe("where every session switch stands is one line, reported and never failed", () => {
    const DEFAULTS = "cache lifetime the host's default, an hour on a subscription within its usage limits and five minutes on an API key; git instructions the host's default; multipliers the general ones";
    const line = async (manifest) => {
        const { findings } = await inspect(tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(manifest) }), { schema: SCHEMA });
        const hits = checks(findings, "sessions");
        assert.equal(hits.length, 1, `expected one sessions finding, got ${JSON.stringify(hits)}`);
        assert.equal(hits[0].severity, "report");
        assert.deepEqual(severities(findings, "fail"), []);
        return hits[0].message;
    };

    test("a manifest declaring nothing: the host's defaults, and a repository is told what prints the offer", async () => {
        assert.equal(await line(wellFormed()), `${DEFAULTS}; \`portulan upgrade\` prints the five-minute lifetime's offer and its trade-off`);
    });

    test("a declared lifetime is named with the setting it compiles to, and nothing is offered", async () => {
        assert.equal(
            await line({ ...wellFormed(), portulan: { spec: "2.11" }, sessions: { cache_lifetime: "5m" } }),
            "cache lifetime 5m, compiled as `promptCacheTtl`; git instructions the host's default; multipliers the general ones",
        );
    });

    test("the git switch, declared off, says so and leaves the lifetime the host's", async () => {
        assert.equal(
            await line({ ...wellFormed(), portulan: { spec: "2.11" }, sessions: { git_instructions: false } }),
            "cache lifetime the host's default, an hour on a subscription within its usage limits and five minutes on an API key; git instructions off; multipliers the general ones; `portulan upgrade` prints the five-minute lifetime's offer and its trade-off",
        );
    });

    test("headless is said where declared, and only what it declares", async () => {
        const sessions = { git_instructions: true, cache_lifetime: "1h", headless: { cache_lifetime: "5m", exclude_dynamic_sections: true } };
        assert.equal(
            await line({ ...wellFormed(), portulan: { spec: "2.11" }, sessions }),
            "cache lifetime 1h, compiled as `promptCacheTtl`; git instructions on; headless runs 5m, with the per-machine sections in the first message; multipliers the general ones",
        );
    });

    test("a workspace that is no repository is not sent to `upgrade`", async () => {
        const demo = { ...wellFormed(), kind: "demo" };
        delete demo.tree;
        assert.equal(await line(demo), DEFAULTS);
    });

    test("a declared block, Workspace Definition 2.13's `spend.restart`, is said, and an advice as the default", async () => {
        const at = (restart) => line({ ...wellFormed(), portulan: { spec: "2.13" }, sessions: { cache_lifetime: "5m" }, spend: { restart } });
        assert.equal(await at("block"), "cache lifetime 5m, compiled as `promptCacheTtl`; git instructions the host's default; multipliers the general ones; a turn's end held once at the restart threshold");
        assert.equal(await at("advise"), "cache lifetime 5m, compiled as `promptCacheTtl`; git instructions the host's default; multipliers the general ones");
    });

    test("declared multipliers and a horizon, Workspace Definition 2.12's `spend`, are said with their figures", async () => {
        const spend = { multipliers: { read: 0.05, write: { "5m": 1.25, "1h": 2 } }, horizon: { requests: 30 } };
        assert.equal(
            await line({ ...wellFormed(), portulan: { spec: "2.12" }, sessions: { cache_lifetime: "5m" }, spend }),
            "cache lifetime 5m, compiled as `promptCacheTtl`; git instructions the host's default; multipliers declared, read 0.05× and writes 1.25×/2×; a horizon of 30 requests",
        );
    });

    test("a pointer is given no line: it declares no switch, and the governing workspace's checks do not run here", async () => {
        const dir = tree(scratch(), { "workspace.json": JSON.stringify({ portulan: { spec: "2.7" }, name: "fixture", kind: "pointer", governed_by: { workspace: "elsewhere" } }) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.deepEqual(checks(findings, "sessions"), []);
    });
});

describe("the schema declares which Workspace Definition version it implements", () => {
    test("the shipped schema carries it in `$id`", () => {
        assert.deepEqual(schemaVersion(SCHEMA), { major: 2, minor: 13 });
    });

    test("a schema whose `$id` does not carry one is refused", () => {
        assert.throws(() => schemaVersion({ $id: "https://portulan.dev/spec/workspace.schema.json" }), DoctorError);
        assert.throws(() => schemaVersion({}), DoctorError);
    });

    const at = (spec) => tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify({ ...wellFormed(), portulan: { spec } }) });
    const here = schemaVersion(SCHEMA);

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
    const cases = fs
        .readdirSync(path.join(FIXTURES, "manifests"))
        .filter((f) => f.endsWith(".json") && f !== "valid.json");

    test("there are known-bad manifests to run", () => {
        assert.ok(cases.length >= 6, `expected several bad manifests, found ${cases.length}`);
    });

    for (const file of cases) {
        test(file, () => {
            const body = fs.readFileSync(path.join(FIXTURES, "manifests", file), "utf8");
            // `json.sh` parses every tracked .json, so a known-bad fixture is bad against the schema only.
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
            "memory/decided.md":
                "**type:** decision\n**provenance:** `form=link` `href=https://example.test/2`\n\nA decision.\n",
        });
        const { findings, stats } = await inspect(dir, { schema: SCHEMA });
        assert.equal(stats.rules, 2);
        assert.equal(stats.sealed, 1);
        assert.match(text(checks(findings, "provenance")), /1 of 2|1\/2|50/);
    });

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
            assert.equal(stats.records, 2);
            const expected =
                fs.statSync(path.join(dir, "memory", "readable.md")).size +
                fs.statSync(path.join(dir, "memory", "locked.md")).size;
            assert.equal(stats.bytes, expected, "count and size must agree on what a record is");
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

// ------------------------------------------------- the per-host degradation report

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
        const dir = scratch();
        tree(dir, { ...minimalFiles, "workspace.json": JSON.stringify(wellFormed()) });
        const { findings } = await inspect(dir);
        assert.equal(checks(findings, "enforcement").length, 0);
    });

    test("a policy the compiler refuses is a finding, not a crash and not a silent pass", async () => {
        const dir = withGates(gated([{ id: "bad", tier: "occasionally", action: { shell: "x" }, reason: "nope" }]));
        fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify(manifest()));
        const { findings } = await inspect(dir);
        assert.equal(severities(checks(findings, "enforcement"), "fail").length, 1, "a policy that cannot compile is the workspace's defect");
        assert.match(text(checks(findings, "enforcement")), /occasionally/);
    });

    test("a policy that PARSES but that a backend refuses is a finding too, not a crash", async () => {
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
        // A required context no job reports blocks every pull request, and `enforce_admins` lets no one past it.
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
        // On the cross-check's own sentence: an unpinned-check note also names `workspace-verify`.
        assert.match(
            text(checks(findings, "enforcement")),
            /prose does not name it/,
            "the policy declares a context the prose does not carry, and that must be said",
        );
    });

    test("the cross-check reads the gate map itself, not an array another check emptied", async () => {
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
        });
        assert.equal(await run([dir], { quiet: true }), 1);
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.match(text(severities(checks(findings, "paths"), "fail")), /gate-map\.md/);
    });

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
        // `none` claims nothing, so two of the three lines are unverifiable.
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

    // GitHub reports a job's check context as its `name:` when it has one, and as its id otherwise.
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

    test("1 when the manifest is absent or malformed", async () => {
        const absent = tree(scratch(), minimalFiles);
        assert.equal(await run([absent], { quiet: true }), 1);

        const malformed = tree(scratch(), { ...minimalFiles, "workspace.json": '{ "name": "x", }' });
        assert.equal(await run([malformed], { quiet: true }), 1);
    });

    test("2 on a bad invocation", async () => {
        assert.equal(await run([], { quiet: true }), 2);
    });

    test("2 when the manifest names a Workspace Definition this validator does not implement", async () => {
        const build = (spec) => {
            const m = wellFormed();
            m.portulan.spec = spec;
            return tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
        };
        assert.equal(await run([build("9.9")], { quiet: true }), 2, "a MAJOR ahead");
        assert.equal(await run([build("2.14")], { quiet: true }), 2, "a MINOR ahead");
        assert.equal(await run([build("2.0")], { quiet: true }), 0, "the current version");
    });

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

    test("2, never 1, when something unanticipated throws", async () => {
        const poison = { get kind() { throw new Error("unanticipated"); } };
        assert.equal(await run([path.join(REPO, ".portulan")], { quiet: true, schema: poison }), 2);
    });
});

describe("a `handoffs` object with no index configures nothing", () => {
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
        const { LibrarianError, passWorkspace } = await import("./librarian.mjs");
        const m = wellFormed();
        m.slots.memory = "memory/";
        m.librarian = { staleness: { record_days: 0 } };
        const dir = tree(scratch(), { ...minimalFiles, "memory/r.md": "x\n", "workspace.json": JSON.stringify(m) });
        assert.throws(() => passWorkspace(dir, { asOf: "2026-06-15" }), LibrarianError);
    });
});

// ---------------------------------------------------------------- packs

const PACK_SCHEMA = JSON.parse(fs.readFileSync(path.join(REPO, "spec", "pack.schema.json"), "utf8"));

const packManifest = (over = {}) => ({
    portulan: { pack: "1.0" },
    name: "checkpoints",
    category: "rituals",
    contributes: { personas: ["personas/supervisor.md"] },
    ...over,
});

// All five parts of the persona contract, since `doctor` validates every persona a pack declares.
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
            // `auto` is not in the fragment tier enum: a pack's gates can only tighten.
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

    test("a declared pack on a workspace with no tree is REPORTED, never failed", async () => {
        const manifest = { ...wellFormed(), kind: "portfolio", packs: ["rituals/absent"] };
        delete manifest.tree;
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(manifest) });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.equal(severities(checks(findings, "packs"), "fail").length, 0, text(findings));
        assert.match(text(checks(findings, "packs")), /no packs root to search/);
        assert.match(text(checks(findings, "packs")), /none is derivable from the manifest/);
    });

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

    // A synthetic validator at 1.5: the shipped Pack Definition is 1.0, so no earlier minor exists yet.
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
        assert.deepEqual(schemaVersion(SCHEMA), { major: 2, minor: 13 });
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

// ------------------------------------------- the union: a workspace composing from BOTH residences

describe("`--pack-root auto` unions the discovered roots with the tree-derived one", () => {
    const packAt = (root, id, summary) => {
        const [category, name] = id.split("/");
        return tree(root, {
            [`${category}/${name}/pack.json`]: JSON.stringify({
                portulan: { pack: "1.0", version: "0.1.0" },
                name,
                category,
                summary,
                doc: "README.md",
                contributes: {},
            }),
            [`${category}/${name}/README.md`]: "",
        });
    };

    const hostCarrying = (build) => {
        const config = scratch();
        const installPath = path.join(config, "plugins", "cache", "feed", "pack-plugin", "0.1.0");
        fs.mkdirSync(path.join(installPath, "packs"), { recursive: true });
        build(path.join(installPath, "packs"));
        const record = path.join(config, "plugins", "installed_plugins.json");
        fs.mkdirSync(path.dirname(record), { recursive: true });
        fs.writeFileSync(record, JSON.stringify({
            version: 2,
            plugins: { "pack-plugin@feed": [{ scope: "user", installPath, version: "0.1.0" }] },
        }));
        return { env: { CLAUDE_CONFIG_DIR: config }, cache: path.join(installPath, "packs") };
    };

    const composingFromBoth = () => {
        const repo = scratch();
        packAt(path.join(repo, "packs"), "tools/mine", "the adopter's own pack");
        const m = wellFormed();
        m.packs = ["rituals/checkpoints", "tools/mine"];
        m.tree = "../";
        const dir = tree(path.join(repo, ".portulan"), { ...minimalFiles, "workspace.json": JSON.stringify(m) });
        return dir;
    };

    test("a SHADOWED pack is reported, and the report says what differs (#264)", async () => {
        const repo = scratch();
        packAt(path.join(repo, "packs"), "rituals/checkpoints", "the tree's own copy");
        const treeManifest = path.join(repo, "packs", "rituals", "checkpoints", "pack.json");
        const t = JSON.parse(fs.readFileSync(treeManifest, "utf8"));
        t.portulan.version = "9.9.9";
        // The fragments must differ too, or the report's fragment half has nothing to find.
        t.contributes = { gates: [{ id: "only-in-the-tree", tier: "prohibited", action: { shell: "git push --mirror" }, reason: "tree only" }] };
        fs.writeFileSync(treeManifest, JSON.stringify(t, null, 2));

        const host = hostCarrying((packs) => packAt(packs, "rituals/checkpoints", "the installed copy"));
        const m = wellFormed();
        m.packs = ["rituals/checkpoints"];
        m.tree = "../";
        const dir = tree(path.join(repo, ".portulan"), { ...minimalFiles, "workspace.json": JSON.stringify(m) });

        const found = await inspect(dir, { schema: SCHEMA, ...host });
        const packs = text(checks(found.findings, "packs"));
        assert.match(packs, /is SHADOWED/, "the shadow itself");
        assert.match(packs, /the tree-derived root also carries it at/,
            "and where the shadowed copy lives — the tree-DERIVED root, since `workspace.tree` can point outside the repository");
        assert.match(packs, /version .* against the tree's 9\.9\.9/, "the version half of the difference");
        assert.match(packs, /gate fragments that differ once parsed/, "and the FRAGMENT half — the clause the default fixture cannot reach");
        assert.doesNotMatch(packs, /could not be compared/, "both copies were readable");
        assert.match(packs, /REFUSES this rather than picking/, "what compile now does about it");
        assert.match(packs, /--pack-root packs/, "and the root to name to proceed");
        assert.equal(severities(checks(found.findings, "packs"), "fail").length, 0,
            "a report about the machine, never a verdict about the repository");
    });

    test("fragments differing OUTSIDE id/tier/action still count as differing", async () => {
        const gates = (reason) => ({ gates: [{ id: "x", tier: "gated", action: { shell: "git push --mirror" }, reason }] });
        const repo = scratch();
        packAt(path.join(repo, "packs"), "rituals/checkpoints", "the tree's own copy");
        const treeManifest = path.join(repo, "packs", "rituals", "checkpoints", "pack.json");
        const t = JSON.parse(fs.readFileSync(treeManifest, "utf8"));
        t.contributes = gates("the tree's reason");
        fs.writeFileSync(treeManifest, JSON.stringify(t, null, 2));

        const host = hostCarrying((packs) => {
            packAt(packs, "rituals/checkpoints", "the installed copy");
            const cached = path.join(packs, "rituals", "checkpoints", "pack.json");
            const c = JSON.parse(fs.readFileSync(cached, "utf8"));
            c.portulan.version = t.portulan.version;
            c.contributes = gates("the cache's reason");
            fs.writeFileSync(cached, JSON.stringify(c, null, 2));
        });
        const m = wellFormed();
        m.packs = ["rituals/checkpoints"];
        m.tree = "../";
        const dir = tree(path.join(repo, ".portulan"), { ...minimalFiles, "workspace.json": JSON.stringify(m) });

        const packs = text(checks((await inspect(dir, { schema: SCHEMA, ...host })).findings, "packs"));
        assert.match(packs, /gate fragments that differ once parsed/,
            "a difference outside id/tier/action must still be reported");
        assert.doesNotMatch(packs, /the two agree today/, "and must not claim they agree");
    });

    test("a shadowed copy that cannot be read is reported as could-not-compare, not as silence", async () => {
        const repo = scratch();
        packAt(path.join(repo, "packs"), "rituals/checkpoints", "the tree's own copy");
        fs.writeFileSync(path.join(repo, "packs", "rituals", "checkpoints", "pack.json"), "{ not json");
        const host = hostCarrying((packs) => packAt(packs, "rituals/checkpoints", "the installed copy"));
        const m = wellFormed();
        m.packs = ["rituals/checkpoints"];
        m.tree = "../";
        const dir = tree(path.join(repo, ".portulan"), { ...minimalFiles, "workspace.json": JSON.stringify(m) });

        const found = await inspect(dir, { schema: SCHEMA, ...host });
        assert.match(text(checks(found.findings, "packs")), /could not be read .*so what differs could not be compared/,
            "a shadow we cannot read is not a shadow we may call harmless");
    });

    test("the arrangements, and BOTH resolve with no flag at all since the disposal", async () => {
        const host = hostCarrying((packs) => packAt(packs, "rituals/checkpoints", "from the cache"));
        const dir = composingFromBoth();

        const derived = await inspect(dir, { schema: SCHEMA, ...host });
        assert.equal(severities(checks(derived.findings, "packs"), "fail").length, 0, text(derived.findings));
        assert.equal(derived.stats.packs, 2, "both packs are graded with no flag");
        assert.match(text(checks(derived.findings, "packs")), /resolution root union — discovered in the host plugin cache unasked/);
        assert.match(text(checks(derived.findings, "packs")), /`rituals\/checkpoints` resolves from the discovered root/);

        const union = await inspect(dir, { schema: SCHEMA, ...host, discoverPacks: true });
        assert.equal(severities(checks(union.findings, "packs"), "fail").length, 0, text(union.findings));
        assert.equal(union.stats.packs, 2);

        const packs = text(checks(union.findings, "packs"));
        assert.match(packs, /`rituals\/checkpoints` resolves from the discovered root/);
        assert.match(packs, /`tools\/mine` resolves from the tree-derived root/);
    });

    test("order is load-bearing: where both roots carry the pack, the DISCOVERED copy wins", async () => {
        const host = hostCarrying((packs) => packAt(packs, "rituals/checkpoints", "from the cache"));
        const repo = scratch();
        packAt(path.join(repo, "packs"), "rituals/checkpoints", "from the local tree");
        const m = wellFormed();
        m.packs = ["rituals/checkpoints"];
        m.tree = "../";
        const dir = tree(path.join(repo, ".portulan"), { ...minimalFiles, "workspace.json": JSON.stringify(m) });

        const union = await inspect(dir, { schema: SCHEMA, ...host, discoverPacks: true });
        assert.equal(severities(checks(union.findings, "packs"), "fail").length, 0, text(union.findings));
        assert.match(text(checks(union.findings, "packs")), /resolves from the discovered root/);
        assert.doesNotMatch(text(checks(union.findings, "packs")), /resolves from the tree-derived root/);
    });

    test("origin is stated ONLY under the union — the other arrangements already said it", async () => {
        const dir = composingFromBoth();
        const derived = await inspect(dir, { schema: SCHEMA });
        assert.doesNotMatch(text(checks(derived.findings, "packs")), /from the (discovered|tree-derived) root/);
    });

    test("asking for a named root and `auto` together is refused BEFORE a workspace is read", async () => {
        const dir = composingFromBoth();
        // No workspace here: a parse-time refusal never reads it, and a later one would exit 1.
        const absent = path.join(scratch(), "not-a-workspace");
        assert.equal(await run(["--pack-root", "auto", "--pack-root", dir, absent], { quiet: true }), 2);
        assert.equal(await run([absent], { quiet: true }), 1);
    });

    test("`auto` against an unreadable record is exit 2, never a green over a host nobody read", async () => {
        const config = scratch();
        const record = path.join(config, "plugins", "installed_plugins.json");
        fs.mkdirSync(path.dirname(record), { recursive: true });
        fs.writeFileSync(record, "{ not json");
        const dir = composingFromBoth();
        assert.equal(await run(["--pack-root", "auto", dir], { quiet: true, env: { CLAUDE_CONFIG_DIR: config } }), 2);
        assert.equal(await run(["--pack-root", "auto", dir], { quiet: true, env: { CLAUDE_CONFIG_DIR: scratch() } }), 1);
    });

    test("a malformed host record cannot reach an unasked run's verdict — and IS reported", async () => {
        const config = scratch();
        const record = path.join(config, "plugins", "installed_plugins.json");
        fs.mkdirSync(path.dirname(record), { recursive: true });
        fs.writeFileSync(record, "{ not json");
        const dir = composingFromBoth();
        const derived = await inspect(dir, { schema: SCHEMA, env: { CLAUDE_CONFIG_DIR: config } });
        assert.match(text(checks(derived.findings, "packs")), /resolution root derived/);
        // Not `could not be read`, which the unresolvable-pack sentence also carries.
        assert.match(text(checks(derived.findings, "packs")), /Discovery could not look/);
        assert.equal(await run([dir], { quiet: true, env: { CLAUDE_CONFIG_DIR: config } }), 1);
    });

    test("the note-vs-fail keying is on ORIGIN, not on how many roots there are", async () => {
        const host = hostCarrying((packs) => packAt(packs, "rituals/checkpoints", "from the cache"));
        const repo = scratch();
        const noTree = wellFormed();
        noTree.packs = ["rituals/checkpoints", "tools/absent"];
        delete noTree.tree;
        const dir = tree(path.join(repo, ".portulan"), { ...minimalFiles, "workspace.json": JSON.stringify(noTree) });

        const got = await inspect(dir, { schema: SCHEMA, ...host });
        assert.equal(got.stats.packs, 1, text(got.findings));
        assert.equal(severities(checks(got.findings, "packs"), "fail").length, 0, text(got.findings));
        assert.match(text(checks(got.findings, "packs")), /`tools\/absent` was looked for under 1 discovered root\(s\) and is not there/);
        assert.doesNotMatch(text(checks(got.findings, "packs")), /`tools\/absent` cannot be resolved — there is no packs root to search/);
        assert.ok(got.stats.unverifiable >= 1, "a discovered-only miss is unverifiable, not nothing");

        const withTree = wellFormed();
        withTree.packs = ["rituals/checkpoints", "tools/absent"];
        withTree.tree = "../";
        const claimedDir = tree(path.join(scratch(), ".portulan"), { ...minimalFiles, "workspace.json": JSON.stringify(withTree) });
        const claimed = await inspect(claimedDir, { schema: SCHEMA, ...host });
        assert.equal(severities(checks(claimed.findings, "packs"), "fail").length, 1, text(claimed.findings));
        assert.match(text(checks(claimed.findings, "packs")), /`tools\/absent` does not resolve/);
    });
});

describe("--pack-root fails closed in doctor too, not only in index", () => {
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
    const pointer = (extra = {}) => ({
        portulan: { spec: "2.7" },
        name: "tipar-api",
        kind: "pointer",
        governed_by: { workspace: "sleepy-panda", feed: "portulan-internal" },
        ...extra,
    });

    // Pointers resolve against the host, so each inspect gets an empty one, spread last so nothing overrides it.
    const emptyHost = () => ({ env: { CLAUDE_CONFIG_DIR: scratch() } });

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
        const dir = tree(scratch(), { "workspace.json": JSON.stringify(pointer()) });
        const { findings } = await inspect(dir, { schema: SCHEMA, ...emptyHost() });
        assert.equal(severities(findings, "fail").length, 0, text(findings));
        const notes = text(checks(findings, "residence"));
        assert.match(notes, /governed by `sleepy-panda`/);
        assert.match(notes, /portulan-internal/);
        assert.match(notes, /did not run here/);
    });

    test("`summary` is on the pointer's permit-list, and the list is railed rather than described", async () => {
        const dir = tree(scratch(), {
            "workspace.json": JSON.stringify(pointer({ summary: "Governed by the Sleepy Panda SRL portfolio workspace." })),
        });
        const { findings } = await inspect(dir, { schema: SCHEMA, ...emptyHost() });
        assert.equal(severities(findings, "fail").length, 0, text(findings));

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

    // ---- the pointer's name, dereferenced

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
        assert.match(notes, /to grade it/);
        assert.doesNotMatch(notes, /the roots are named rather than found/);
    });

    test("a pointer whose governor is NOT installed gets the honest sentence, and stays green", async () => {
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
        const dir = tree(scratch(), { "workspace.json": JSON.stringify(pointer()) });
        const { findings } = await inspect(dir, { schema: SCHEMA, discover: () => ({ nonsense: 1, other: 2 }) });
        const residence = text(checks(findings, "residence"));
        assert.match(residence, /supplied no sentence/);
        assert.match(residence, /no `state` at all/);
        assert.match(residence, /`nonsense`, `other`/, "and it names what it actually received");
        assert.doesNotMatch(residence, /undefined/, "the word the fix exists to remove");
        assert.equal(severities(findings, "fail").length, 0, text(findings));

        const empty = await inspect(dir, { schema: SCHEMA, discover: () => ({}) });
        assert.match(text(checks(empty.findings, "residence")), /keys: none/);

        const wrongType = await inspect(dir, { schema: SCHEMA, discover: () => ({ state: 123 }) });
        const said = text(checks(wrongType.findings, "residence"));
        assert.match(said, /a `state` that is not a string \(`number`\)/);
        assert.doesNotMatch(said, /no `state` at all/);
    });

    test("NO discovery outcome moves this tool's verdict — all four leave a compliant pointer green", async () => {
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
        const m = pointer();
        delete m.governed_by;
        assert.notEqual(validate(SCHEMA, m).length, 0, "a pointer with no governor must not validate");

        const w = wellFormed();
        delete w.verify;
        assert.notEqual(validate(SCHEMA, w).length, 0, "a governing workspace with no verify must not validate");

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
        // A symlink, since identity is judged on the real path and a lexical compare would miss it.
        fs.symlinkSync(repo, path.join(root, "itself"), "dir");
        const { findings } = await inspect(dir, { schema: SCHEMA, repoRoots: [root] });
        assert.equal(severities(checks(findings, "residence"), "fail").length, 0, text(findings));
        assert.match(text(checks(findings, "residence")), /resolves to this manifest itself/);

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
        const dir = tree(scratch(), { ...minimalFiles, "workspace.json": JSON.stringify(wellFormed()) });
        for (const flag of ["--repo-root", "--pack-root"]) {
            assert.equal(await run([flag, path.join(dir, "workspace.json"), dir], { quiet: true }), 2, `${flag}: a FILE is not a root`);
            assert.equal(await run([flag, path.join(dir, "nope"), dir], { quiet: true }), 2, `${flag}: a missing root is not a root`);
            assert.equal(await run([flag, dir], { quiet: true }), 2, `${flag}: a flag with no workspace left is not a workspace`);
            assert.notEqual(await run([flag, dir, dir], { quiet: true }), 2, `${flag}: a directory is accepted`);
        }
    });

    test("a manifest at a named root with an unrecognised kind is reported, never refused", async () => {
        const dir = portfolio(["tipar-api", "lantern"]);
        const root = checkouts({
            "tipar-api": { portulan: { spec: "2.7" }, name: "tipar-api" },
            lantern: { portulan: { spec: "2.7" }, name: "lantern", kind: "something-else" },
        });
        const { findings } = await inspect(dir, { schema: SCHEMA, repoRoots: [root] });
        assert.equal(severities(checks(findings, "residence"), "fail").length, 0, text(findings));
        assert.match(text(checks(findings, "residence")), /no recognisable `kind`/);
        assert.doesNotMatch(text(findings), /kind: "undefined"/);

        const governing = checkouts({ "tipar-api": { ...wellFormed(), name: "tipar-api" } });
        const { findings: refused } = await inspect(dir, { schema: SCHEMA, repoRoots: [governing] });
        assert.equal(severities(checks(refused, "residence"), "fail").length, 1, text(refused));
    });

    test("a pointer at a named root that names no governor is reported, never refused", async () => {
        const dir = portfolio(["tipar-api"]);
        const root = checkouts({ "tipar-api": { portulan: { spec: "2.7" }, name: "tipar-api", kind: "pointer" } });
        const { findings } = await inspect(dir, { schema: SCHEMA, repoRoots: [root] });
        assert.equal(severities(checks(findings, "residence"), "fail").length, 0, text(findings));
        assert.match(text(checks(findings, "residence")), /names no usable governing workspace/);
        assert.doesNotMatch(text(findings), /undefined/);
    });

    test("a pointer whose governor is PRESENT but unusable is reported too — the third gap of one class", async () => {
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
            assert.match(residence, /`governed_by.workspace` is /);
            assert.doesNotMatch(residence, /as its governor/);
        }

        // A padded slug is still a declared name, so it stays a conflict: nothing here trims it.
        const dir = portfolio(["tipar-api"]);
        const root = checkouts({
            "tipar-api": { portulan: { spec: "2.7" }, name: "tipar-api", kind: "pointer", governed_by: { workspace: "  sleepy-panda  " } },
        });
        const { findings } = await inspect(dir, { schema: SCHEMA, repoRoots: [root] });
        assert.equal(severities(checks(findings, "residence"), "fail").length, 1, text(findings));
        assert.match(text(checks(findings, "residence")), /"  sleepy-panda  "/);
    });
});

// ---------------------------------------------------------------- what a pack ships

describe("a pack's skills and personas are validated, not counted", () => {
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
        const { dir, root } = withPack({ skills: ["skills/"] }, { "skills/my-check/SKILL.md": goodSkill });
        const locked = path.join(root, "rituals/fixture/skills");
        fs.chmodSync(locked, 0o000);
        try {
            const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
            assert.match(text(checks(findings, "packs")), /could not|unreadable|EACCES/i);
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

describe("a composed persona is matched to the host binding that would carry it", () => {
    const persona = (name) =>
        [
            "---", `name: ${name}`, "description: A role.", "tools: Read, Grep", "---", "",
            `# Persona — ${name}`, "", "## Charter", "It reviews.", "", "## Autonomy reach", "Propose.", "",
            "## Memory scope", "`personas/x/`.", "", "## Read / write posture", "Reads in parallel.", "",
        ].join("\n");

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
            // Root reads through mode bits, so this asserts only where the read actually failed.
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

    const scoreOf = (manifest, files = { "affordances.md": withLimits }) => {
        const dir = scratch();
        tree(dir, files);
        return legibility(manifest, dir);
    };

    // Counted at `fs.readFileSync`: no figure `legibility` returns shows how often a document was read.
    const readsOf = (t, manifest, files) => {
        const real = fs.readFileSync;
        const hits = [];
        t.mock.method(fs, "readFileSync", (p, ...rest) => {
            if (String(p).endsWith("affordances.md")) hits.push(String(p));
            return real(p, ...rest);
        });
        scoreOf(manifest, files);
        return hits;
    };

    test("one inherited affordances document is read once, not once per product", (t) => {
        const m = full();
        m.affordances = "affordances.md";
        m.products = [
            { id: "a", name: "A", product: "product.md" },
            { id: "b", name: "B", product: "product.md" },
            { id: "c", name: "C", product: "product.md" },
        ];
        assert.equal(readsOf(t, m, { "affordances.md": withLimits }).length, 1, "three products, one document, one read");
    });

    test("an unreadable inherited document counts once — the counter is of documents, not products", (t) => {
        const m = full();
        m.affordances = "affordances.md";
        m.products = [
            { id: "a", name: "A", product: "product.md" },
            { id: "b", name: "B", product: "product.md" },
            { id: "c", name: "C", product: "product.md" },
        ];
        assert.equal(readsOf(t, m, {}).length, 1, "three products, one missing document, one attempt");
    });

    test("distinct documents are still each read — dedup is by `rel`, not a cap of one", (t) => {
        const m = full();
        m.products = [
            { id: "a", name: "A", product: "product.md", affordances: "affordances.md" },
            { id: "b", name: "B", product: "product.md", affordances: "other-affordances.md" },
        ];
        const hits = readsOf(t, m, { "affordances.md": withLimits, "other-affordances.md": withLimits });
        assert.equal(hits.length, 2, "two products naming two documents are two reads");
        assert.equal(new Set(hits).size, 2, "and two distinct paths, not one read twice");
    });

    test("a workspace declaring everything scores every applicable dimension", () => {
        const score = scoreOf(full());
        assert.equal(score.met, score.applicable, JSON.stringify(score.dimensions.filter((d) => !d.met), null, 2));
        assert.equal(score.applicable, 7);
    });

    test("each dimension is independently lost, and no other moves with it", () => {
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
        const dir = scratch();
        tree(dir, { ...minimalFiles, "workspace.json": JSON.stringify(wellFormed()), "verify.sh": "#!/bin/sh\n" });
        const { findings } = await inspect(dir, { schema: SCHEMA });
        assert.equal(findings.filter((f) => f.severity === "fail").length, 0, text(findings));
        assert.ok(legibility(wellFormed(), dir).met < legibility(full(), dir).applicable);
    });

    test("the two workspaces this repository ships score differently, and both are green", () => {
        const own = legibility(JSON.parse(fs.readFileSync(path.join(REPO, ".portulan", "workspace.json"), "utf8")), path.join(REPO, ".portulan"));
        const demo = legibility(JSON.parse(fs.readFileSync(path.join(REPO, "examples", "workspace.json"), "utf8")), path.join(REPO, "examples"));
        assert.equal(own.met, own.applicable, "customer zero should meet every dimension it asks of others");
        assert.ok(demo.met < demo.applicable, "the demo declares no gate policy and no handoff series");
        assert.deepEqual(demo.dimensions.filter((d) => d.applicable && !d.met).map((d) => d.id), ["gates", "handoffs"]);
    });
});

describe("a persona's name is a pack's free text, so the binding read is contained", () => {
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
        // `path.join("agents", "../../poison.md")` is `../poison.md`: the read aims one level above the tree.
        const { dir, root } = poison("../../poison");
        const outside = path.resolve(dir, "..", "poison.md");
        for (const present of [false, true]) {
            if (present) fs.writeFileSync(outside, "---\nname: ../../poison\ndescription: x\ntools: Read\n---\n");
            try {
                const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
                const said = text(checks(findings, "bindings"));
                assert.match(said, /leaves this workspace's tree/, present ? "with the target present" : "with the target absent");
                assert.ok(!said.includes(`— ${BINDING_OK}`), "an escaping key must never be reported as a successful binding");
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
        const { dir, root } = poison("my-role");
        fs.mkdirSync(path.join(dir, "agents"), { recursive: true });
        fs.writeFileSync(path.join(dir, "agents", "my-role.md"), "---\nname: my-role\ndescription: x\ntools: Read\n---\n");
        const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [root] });
        assert.ok(text(checks(findings, "bindings")).includes(`— ${BINDING_OK}`), "an ordinary binding must still report success");
    });
});

describe("every legibility dimension can actually vary", () => {
    test("no dimension is a guaranteed point on a manifest the schema already requires", () => {
        const schemaRequired = new Set(SCHEMA.oneOf?.[0]?.required ?? []);
        const ids = legibility({ verify: { recipes: [] }, slots: {} }, scratch()).dimensions.map((d) => d.id);
        for (const id of ids) {
            assert.equal(schemaRequired.has(id), false, `\`${id}\` is required by the schema, so it can never be absent and measures nothing`);
        }
        assert.equal(ids.length, 7, "seven is what the can-it-vary rule leaves; the count is derived here rather than trusted in prose");
    });
});

// ===========================================================================================
// An explicit `--help`, and an unknown flag that is refused rather than swallowed
// ===========================================================================================
describe("--help is a request that succeeded", () => {
    test("`--help` exits 0, prints to stdout, and names only flags this tool takes", async (t) => {
        const out = [];
        t.mock.method(process.stdout, "write", (chunk) => (out.push(String(chunk)), true));
        const code = await run(["--help"]);
        t.mock.restoreAll();
        assert.equal(code, 0, "asking for help succeeded");
        const said = out.join("");
        assert.match(said, /^portulan doctor — validate a workspace/, "the identity line agrees with `portulan --help`'s summary");
        assert.match(said, /Exit codes: 0 succeeded · 1 a red verdict · 2 could not run/);
        for (const flag of said.match(/^\s+(--[a-z-]+)/gm)?.map((s) => s.trim()) ?? []) {
            // Hand-restored: `t.mock.method` would last the whole test, and this substitution lasts one flag.
            const err = [];
            const w = process.stderr.write.bind(process.stderr);
            process.stderr.write = (chunk) => (err.push(String(chunk)), true);
            try {
                await run([flag, "--", "/nonexistent-workspace"]);
            } finally {
                process.stderr.write = w;
            }
            assert.doesNotMatch(
                err.join(""),
                /unknown argument/,
                `the help screen names \`${flag}\`, which this tool's own parser refuses as unknown`,
            );
        }
    });

    test("`-h` is the same request", async () => {
        assert.equal(await run(["-h"], { quiet: true }), 0);
    });

    test("an unknown flag is refused loudly rather than swallowed and graded", async (t) => {
        const out = [];
        t.mock.method(process.stderr, "write", (chunk) => (out.push(String(chunk)), true));
        const code = await run(["--repo-rot", "/nonexistent"]);
        t.mock.restoreAll();
        assert.equal(code, 2, "a flag this tool does not take is could-not-run, never a verdict");
        const said = out.join("");
        assert.match(said, /unknown argument/);
        assert.match(said, /--repo-rot/, "the refusal names the argument it refused");
        assert.match(said, /portulan doctor --help/);
        assert.match(said, /node cli\/doctor\.mjs --help/);
        assert.doesNotMatch(said, /nonexistent\/workspace\.json/, "the bad path must never be read as a workspace");
    });
});

// ===========================================================================================
// The enforcement report reads the policy the workspace YIELDS, not the one it declares
// ===========================================================================================
describe("the enforcement report counts composed gates", () => {
    const enforcement = async () => {
        const { findings } = await inspect(path.join(REPO, ".portulan"), { schema: SCHEMA, packRoots: [path.join(REPO, "packs")] });
        return text(checks(findings, "enforcement"));
    };

    test("`doctor` and `compile --matrix` agree on how many gates no backend compiles", async (t) => {
        const said = await enforcement();
        const mine = said.match(/(\d+) gate\(s\) no backend compiles/)?.[1];
        assert.ok(mine, "the uncovered-gate line is printed");

        const out = [];
        t.mock.method(process.stdout, "write", (chunk) => (out.push(String(chunk)), true));
        compileRun(["--matrix", "--pack-root", path.join(REPO, "packs")]);
        t.mock.restoreAll();
        const theirs = out.join("").match(/(\d+) GATE\(S\) no backend compiles/)?.[1];
        assert.equal(mine, theirs, "two readers of one policy must not answer the same question differently");
    });

    test("composed rules are attributed BY NAME to the pack that contributes them", async () => {
        const said = await enforcement();
        assert.match(said, /composed from its packs rather than declared in/);
        assert.match(said, /`commit-without-the-hooks` \(rituals\/checkpoints\)/, "the rule and its pack are named");
        assert.match(said, /of the \d+ rule\(s\) this workspace yields/, "the subject is the yield, not the uncovered gates");
    });

    test("the sentence says YIELDS, never DECLARES — the word that made it wrong", async () => {
        const said = await enforcement();
        assert.doesNotMatch(said, /declared policy that nothing enforces/);
    });
});

test("an unresolved pack makes the totals INCOMPLETE, never a claim about gates it could not read", async () => {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "portulan-unresolvedpack-"));
    SCRATCH.push(dir);
    for (const [rel, body] of Object.entries(minimalFiles)) fs.writeFileSync(path.join(dir, rel), body);
    fs.writeFileSync(path.join(dir, "verify.sh"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    fs.writeFileSync(
        path.join(dir, "gates.json"),
        JSON.stringify({
            portulan: { spec: "2.2" },
            why: "gate-map.md",
            rules: [{ id: "a-gated-thing", tier: "gated", action: { shell: "true" }, reason: "so the policy has a rule to count." }],
        }),
    );
    fs.writeFileSync(
        path.join(dir, "workspace.json"),
        JSON.stringify({ ...wellFormed(), gates: "gates.json", packs: ["tools/github", "no/such-pack"] }),
    );
    const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [path.join(REPO, "packs")] });
    const said = text(checks(findings, "enforcement"));
    assert.match(said, /did not resolve, so whether they contribute gates could not be seen/);
    assert.match(said, /totals above may be incomplete/);
    assert.doesNotMatch(said, /gate\(s\) (were )?missed/, "it must never claim to know what an unreadable manifest held");
});

test("a workspace composing a pack that contributes NO gates says nothing about enforcement", async () => {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "portulan-nogatefrag-"));
    SCRATCH.push(dir);
    for (const [rel, body] of Object.entries(minimalFiles)) fs.writeFileSync(path.join(dir, rel), body);
    fs.writeFileSync(path.join(dir, "verify.sh"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    // `tools/github` contributes verify recipes and no gates.
    fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify({ ...wellFormed(), packs: ["tools/github"] }));
    const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [path.join(REPO, "packs")] });
    assert.ok(checks(findings, "packs").length > 0, "the packs section ran — otherwise the assertion below proves nothing");
    assert.equal(checks(findings, "enforcement").length, 0, "no gate fragments composed, so nothing to say about enforcement");
});

test("the no-policy note says its count is a FLOOR when a declared pack did not resolve", async () => {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "portulan-partialcompose-"));
    SCRATCH.push(dir);
    for (const [rel, body] of Object.entries(minimalFiles)) fs.writeFileSync(path.join(dir, rel), body);
    fs.writeFileSync(path.join(dir, "verify.sh"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    // `rituals/checkpoints` resolves and contributes gates; `no/such-pack` does not resolve.
    fs.writeFileSync(
        path.join(dir, "workspace.json"),
        JSON.stringify({ ...wellFormed(), slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" }, packs: ["rituals/checkpoints", "no/such-pack"] }),
    );
    const { findings } = await inspect(dir, { schema: SCHEMA, packRoots: [path.join(REPO, "packs")] });
    const said = text(checks(findings, "enforcement"));
    assert.match(said, /from the packs that resolved/, "the subject is the resolved set, not 'its packs'");
    assert.match(said, /this count is a floor rather than a total/);
});

test("a workspace composing gates with no policy to join is reported, never failed", async () => {
    const { findings } = await inspect(path.join(REPO, "examples"), { schema: SCHEMA, packRoots: [path.join(REPO, "packs")] });
    const said = text(checks(findings, "enforcement"));
    assert.match(said, /composes \d+ gate rule\(s\) from the packs that resolved and declares no `gates` policy/);
    assert.equal(severities(checks(findings, "enforcement"), "fail").length, 0, "reported, because a required recipe grades this workspace");
});
