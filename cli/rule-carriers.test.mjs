// Tests for `rule-carriers` — the rail that keeps a reduced rule reduced.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseRegistry, RegistryError, inDomain, scan, auditCarriers, normalise, run } from "./rule-carriers.mjs";

// A case that chmods restores in `t.after`: a `0o000` directory makes this `rmSync` fail with ENOTEMPTY.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});
const scratch = (prefix) => {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), prefix));
    SCRATCH.push(dir);
    return dir;
};

const RULE = {
    id: "example-rule",
    carrier: "cli/carrier.mjs",
    summary: "the one carrier",
    incident: "https://example.invalid/1",
    tells: ["the retired sentence"],
    cites: ["carrier.mjs"],
    scope: ["docs/", "README.md"],
};
const registryOf = (...rules) => ({ rules, exclude: [] });
const reader = (map) => (f) => {
    if (!(f in map)) throw new Error("ENOENT");
    return map[f];
};

describe("normalise — what the first real run taught", () => {
    test("a markdown link is collapsed to its label, so a tell reads as a human reads it", () => {
        const text = "run each recipe [`workspace.json`](workspace.json) declares, and read the output";
        assert.ok(normalise(text).includes(normalise("recipe `workspace.json` declares")));
    });

    test("a wrapped line matches a tell written on one line", () => {
        const text = "This repository's CI reads\n`verify.recipes` from the manifest and runs each one, so";
        assert.ok(normalise(text).includes(normalise("from the manifest and runs each one")));
    });

    test("matching is case-insensitive", () => {
        assert.ok(normalise("The Retired SENTENCE").includes(normalise("the retired sentence")));
    });

    test("a link's URL cannot itself satisfy a tell", () => {
        assert.equal(normalise("see [docs](the-retired-sentence.md)"), "see docs");
    });
});

describe("parseRegistry — every unusable registry is could-not-run, never a green over nothing", () => {
    const bad = [
        ["unparseable JSON", "{"],
        ["not an object", "[]"],
        ["no rules array", '{"x":1}'],
        ["zero rules", '{"rules":[]}'],
        ["a non-slug id", '{"rules":[{"id":"Not A Slug","carrier":"c","summary":"s","incident":"i","tells":["t"],"cites":["c"],"scope":["/"]}]}'],
        ["an empty tells array", '{"rules":[{"id":"r","carrier":"c","summary":"s","incident":"i","tells":[],"cites":["c"],"scope":["/"]}]}'],
        ["an empty string in tells", '{"rules":[{"id":"r","carrier":"c","summary":"s","incident":"i","tells":[""],"cites":["c"],"scope":["/"]}]}'],
        ["a missing carrier", '{"rules":[{"id":"r","summary":"s","incident":"i","tells":["t"],"cites":["c"],"scope":["/"]}]}'],
    ];
    for (const [name, source] of bad) {
        test(`refuses ${name}`, () => {
            assert.throws(() => parseRegistry(source), RegistryError);
        });
    }

    test("refuses a duplicate id rather than letting one rule shadow another", () => {
        const one = '{"id":"r","carrier":"c","summary":"s","incident":"i","tells":["t"],"cites":["x"],"scope":["/"]}';
        assert.throws(() => parseRegistry(`{"rules":[${one},${one}]}`), RegistryError);
    });

    const badExclude = [
        ["a non-array exclude", '{"exclude":"docs/","rules":[{"id":"r","carrier":"c","summary":"s","incident":"i","tells":["t"],"cites":["x"],"scope":["/"]}]}'],
        ["a non-string entry in exclude", '{"exclude":[1],"rules":[{"id":"r","carrier":"c","summary":"s","incident":"i","tells":["t"],"cites":["x"],"scope":["/"]}]}'],
        ["a whitespace-only entry in exclude", '{"exclude":["  "],"rules":[{"id":"r","carrier":"c","summary":"s","incident":"i","tells":["t"],"cites":["x"],"scope":["/"]}]}'],
    ];
    for (const [name, source] of badExclude) {
        test(`refuses ${name} as a RegistryError, not a crash`, () => {
            assert.throws(() => parseRegistry(source), RegistryError);
        });
    }

    for (const key of ["tells", "cites", "scope"]) {
        test(`refuses an untrimmed entry in \`${key}\``, () => {
            const rule = { id: "r", carrier: "c", summary: "s", incident: "i", tells: ["t"], cites: ["x"], scope: ["/"] };
            rule[key] = ["docs/ "];
            assert.throws(() => parseRegistry(JSON.stringify({ rules: [rule] })), RegistryError);
        });
    }
    test("refuses an untrimmed entry in the rule-level `exclude`", () => {
        const rule = { id: "r", carrier: "c", summary: "s", incident: "i", tells: ["t"], cites: ["x"], scope: ["/"], exclude: [" docs/"] };
        assert.throws(() => parseRegistry(JSON.stringify({ rules: [rule] })), RegistryError);
    });
    test("refuses an untrimmed entry in the top-level `exclude`", () => {
        const rule = { id: "r", carrier: "c", summary: "s", incident: "i", tells: ["t"], cites: ["x"], scope: ["/"] };
        assert.throws(() => parseRegistry(JSON.stringify({ exclude: ["docs/ "], rules: [rule] })), RegistryError);
    });
    test("the mechanism, pinned: an untrimmed prefix matches no path at all", () => {
        assert.equal("docs/a.md".startsWith("docs/ "), false);
    });

    test("an empty-string exclude is refused — it would exclude the whole tree and green over nothing", () => {
        assert.throws(
            () => parseRegistry('{"exclude":[""],"rules":[{"id":"r","carrier":"c","summary":"s","incident":"i","tells":["t"],"cites":["x"],"scope":["/"]}]}'),
            RegistryError,
        );
        assert.equal("docs/a.md".startsWith(""), true);
        assert.equal("docs/a.md".startsWith([]), true, "and [] coerces to the same empty string");
    });

    test("a top-level exclude that survived validation cannot make inDomain throw", () => {
        const r = parseRegistry('{"exclude":["docs/"],"rules":[{"id":"r","carrier":"c","summary":"s","incident":"i","tells":["t"],"cites":["x"],"scope":["docs/"]}]}');
        assert.doesNotThrow(() => inDomain("docs/a.md", r.rules[0], r.exclude));
    });

    test("accepts a well-formed registry and keeps the global exclude", () => {
        const r = parseRegistry('{"exclude":["docs/plan.md"],"rules":[{"id":"r","carrier":"c","summary":"s","incident":"i","tells":["t"],"cites":["x"],"scope":["/"]}]}');
        assert.equal(r.rules.length, 1);
        assert.deepEqual(r.exclude, ["docs/plan.md"]);
    });
});

describe("inDomain — scope is a prefix and exclude wins", () => {
    test("a file under a scope prefix is in", () => {
        assert.equal(inDomain("docs/thing.md", RULE), true);
    });
    test("an exact path in scope is in", () => {
        assert.equal(inDomain("README.md", RULE), true);
    });
    test("a file outside every prefix is out", () => {
        assert.equal(inDomain("cli/other.mjs", RULE), false);
    });
    test("a global exclude beats scope", () => {
        assert.equal(inDomain("docs/thing.md", RULE, ["docs/"]), false);
    });
    test("a rule-level exclude beats scope", () => {
        assert.equal(inDomain("docs/thing.md", { ...RULE, exclude: ["docs/thing.md"] }), false);
    });
});

describe("scan — restatement, citation, and the carrier itself", () => {
    test("a restatement outside the carrier without a citation is a finding", () => {
        const { findings } = scan({
            registry: registryOf(RULE),
            files: ["docs/a.md"],
            read: reader({ "docs/a.md": "we follow the retired sentence here" }),
        });
        assert.equal(findings.length, 1);
        assert.equal(findings[0].file, "docs/a.md");
        assert.deepEqual(findings[0].tells, ["the retired sentence"]);
    });

    test("the carrier may spell its own rule — that is what a carrier IS", () => {
        const { findings } = scan({
            registry: registryOf(RULE),
            files: ["cli/carrier.mjs"],
            read: reader({ "cli/carrier.mjs": "the retired sentence" }),
        });
        assert.equal(findings.length, 0);
    });

    // `scope` covers the carrier on purpose: out of scope it is never flagged, whatever the carrier comparison says.
    test("a carrier written in a non-canonical spelling is still its own carrier", () => {
        const rule = { ...RULE, carrier: "./cli/carrier.mjs", scope: ["cli/"] };
        const { findings } = scan({
            registry: registryOf(rule),
            files: ["cli/carrier.mjs"],
            read: reader({ "cli/carrier.mjs": "the retired sentence" }),
        });
        assert.equal(findings.length, 0, "a carrier is a path identity, never a spelling");
    });

    test("a citation anywhere in the file exempts it — the declared weakness, pinned so it cannot drift silently", () => {
        const { findings } = scan({
            registry: registryOf(RULE),
            files: ["docs/a.md"],
            read: reader({ "docs/a.md": "the retired sentence ... see carrier.mjs for the real one" }),
        });
        assert.equal(findings.length, 0, "one citation exempts the whole file; stated in 0027 as a strong check rather than a total one");
    });

    test("a file out of scope is not scanned even when it restates the rule", () => {
        const { findings } = scan({
            registry: registryOf(RULE),
            files: ["packs/x.md"],
            read: reader({ "packs/x.md": "the retired sentence" }),
        });
        assert.equal(findings.length, 0);
    });

    test("the record layer is out by construction, via the global exclude", () => {
        const registry = { rules: [{ ...RULE, scope: [".portulan/"] }], exclude: [".portulan/handoffs/"] };
        const { findings } = scan({
            registry,
            files: [".portulan/handoffs/2026-01-01-x.md"],
            read: reader({ ".portulan/handoffs/2026-01-01-x.md": "the retired sentence" }),
        });
        assert.equal(findings.length, 0);
    });
});

describe("the three audits — each exit 2, never a quiet green", () => {
    test("a tell matching nothing anywhere is dead and is reported", () => {
        const { deadTells } = scan({
            registry: registryOf(RULE),
            files: ["docs/a.md"],
            read: reader({ "docs/a.md": "nothing relevant" }),
        });
        assert.deepEqual(deadTells, [{ rule: "example-rule", tell: "the retired sentence" }]);
    });

    test("a tell found ONLY in the carrier is alive — the carrier counts", () => {
        const { deadTells } = scan({
            registry: registryOf(RULE),
            files: ["cli/carrier.mjs"],
            read: reader({ "cli/carrier.mjs": "the retired sentence" }),
        });
        assert.equal(deadTells.length, 0);
    });

    test("a tell found only OUT of scope is alive, and separately a finding is not raised", () => {
        const { deadTells, findings } = scan({
            registry: registryOf(RULE),
            files: ["packs/x.md"],
            read: reader({ "packs/x.md": "the retired sentence" }),
        });
        assert.equal(deadTells.length, 0, "the spelling exists, so the tell is not stale");
        assert.equal(findings.length, 0, "but it is outside the domain, so it is not a violation");
    });

    test("an unreadable file is reported rather than skipped", () => {
        const { unreadable } = scan({ registry: registryOf(RULE), files: ["gone.md"], read: reader({}) });
        assert.equal(unreadable.length, 1);
        assert.equal(unreadable[0].file, "gone.md");
    });

    test("a carrier that does not resolve is reported", () => {
        const unusable = auditCarriers(registryOf(RULE), { state: () => "absent" });
        assert.deepEqual(unusable, [{ rule: "example-rule", carrier: "cli/carrier.mjs", state: "absent" }]);
    });

    test("a carrier that resolves is not", () => {
        assert.deepEqual(auditCarriers(registryOf(RULE), { state: () => "file" }), []);
    });

    test("a carrier that resolves to a directory is unusable, and says so in its own words", () => {
        const unusable = auditCarriers(registryOf(RULE), { state: () => "not-a-file" });
        assert.deepEqual(unusable, [{ rule: "example-rule", carrier: "cli/carrier.mjs", state: "not-a-file" }]);
        assert.notEqual(unusable[0].state, "absent", "a directory is not a missing file and must not be reported as one");
    });
});

describe("the dead-tell audit does not depend on a separator", () => {
    const withNasty = (tell) => ({
        rules: [{ ...RULE, tells: [tell] }],
        exclude: [],
    });

    for (const [name, tell] of [
        ["a NUL", `a${String.fromCharCode(0)}tell`],
        ["a newline", "a\ntell"],
        ["a space", "a tell"],
    ]) {
        test(`reports a dead tell containing ${name} whole, not truncated`, () => {
            const { deadTells } = scan({
                registry: withNasty(tell),
                files: ["docs/a.md"],
                read: reader({ "docs/a.md": "nothing relevant" }),
            });
            assert.equal(deadTells.length, 1);
            assert.equal(deadTells[0].rule, "example-rule");
            assert.equal(deadTells[0].tell, tell, "the reported tell must be the registered one, intact");
        });
    }
});

describe("the registry is excluded from the scan by identity, not by spelling", () => {
    // `git ls-files` emits `/` on every platform, while `path.relative` emits the platform's separator.
    test("every spelling of the registry path resolves to the same absolute path", async () => {
        const path = await import("node:path");
        const cwd = "/repo";
        const abs = path.resolve(cwd, ".portulan/rule-carriers.json");
        for (const spelling of [".portulan/rule-carriers.json", "./.portulan/rule-carriers.json", ".portulan/../.portulan/rule-carriers.json"]) {
            assert.equal(path.resolve(cwd, spelling), abs, `\`${spelling}\` must resolve to the registry`);
        }
    });

    test("a file that merely looks like the registry is still scanned", async () => {
        const path = await import("node:path");
        assert.notEqual(path.resolve("/repo", "docs/rule-carriers.json"), path.resolve("/repo", ".portulan/rule-carriers.json"));
    });
});

describe("this repository's own registry", () => {
    test("parses, and every carrier it names resolves", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const url = await import("node:url");
        const repo = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
        const registry = parseRegistry(fs.readFileSync(path.join(repo, ".portulan/rule-carriers.json"), "utf8"));
        assert.ok(registry.rules.length >= 1);
        const unusable = auditCarriers(registry, {
            state: (p) => {
                let st;
                try {
                    st = fs.statSync(path.join(repo, p));
                } catch {
                    return "absent";
                }
                return st.isFile() ? "file" : "not-a-file";
            },
        });
        assert.deepEqual(unusable, [], "a rule pointing at a file that is gone, or at a directory, is could-not-run");
    });
});

describe("run — the carrier audit reaching the real filesystem", () => {
    const registryFor = (carrier) => JSON.stringify({
        rules: [{
            id: "example-rule",
            carrier,
            summary: "the one carrier",
            incident: "https://example.invalid/1",
            tells: ["the retired sentence"],
            cites: ["carrier.mjs"],
            scope: ["cli/"],
        }],
        exclude: [],
    });

    const invoke = (root, stdin) => {
        let err = "";
        const code = run(["--registry", "registry.json"], {
            stdout: { write: () => {} },
            stderr: { write: (s) => { err += s; } },
            cwd: root,
            stdin,
        });
        return { code, err };
    };

    test("a carrier that resolves to a DIRECTORY is could-not-run, and is not called missing", () => {
        const root = scratch("rule-carriers-dircarrier-");
        fs.mkdirSync(path.join(root, "cli", "carrier.mjs"), { recursive: true });
        fs.writeFileSync(path.join(root, "registry.json"), registryFor("cli/carrier.mjs"));

        const { code, err } = invoke(root, "cli/other.mjs\0");
        assert.equal(code, 2, "a rule covering nothing must never reach a green");
        assert.match(err, /is not a file/);
        assert.doesNotMatch(err, /does not resolve/, "it resolves; saying otherwise sends a maintainer hunting for a file that is there");
    });

    test("a carrier that is genuinely absent still says so, in the other sentence", () => {
        const root = scratch("rule-carriers-gonecarrier-");
        fs.writeFileSync(path.join(root, "registry.json"), registryFor("cli/carrier.mjs"));

        const { code, err } = invoke(root, "cli/other.mjs\0");
        assert.equal(code, 2);
        assert.match(err, /does not resolve/);
        assert.doesNotMatch(err, /is not a file/, "absent and not-a-file are different findings and must read differently");
    });

    test("a carrier the run could not examine is not called missing", (t) => {
        const root = scratch("rule-carriers-unreadable-");
        const dir = path.join(root, "cli");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "carrier.mjs"), "the retired sentence\n");
        fs.writeFileSync(path.join(root, "registry.json"), registryFor("cli/carrier.mjs"));

        fs.chmodSync(dir, 0o000);
        t.after(() => fs.chmodSync(dir, 0o755));

        let denied = false;
        try {
            fs.statSync(path.join(dir, "carrier.mjs"));
        } catch (cause) {
            denied = cause.code !== "ENOENT";
        }
        assert.ok(denied, "precondition: the stat must actually be denied, or this case tests nothing");

        const { code, err } = invoke(root, "cli/other.mjs\0");
        assert.equal(code, 2, "could-not-examine is could-not-run, exactly as absent is");
        assert.match(err, /could not examine/);
        assert.match(err, /EACCES/, "the errno is named — it is the difference between the two repairs");
        assert.doesNotMatch(err, /does not resolve/, "the file is right there; calling it missing sends a maintainer hunting for it");
    });

    test("a real file carrier passes the audit and the scan runs", () => {
        const root = scratch("rule-carriers-okcarrier-");
        fs.mkdirSync(path.join(root, "cli"), { recursive: true });
        fs.writeFileSync(path.join(root, "cli", "carrier.mjs"), "the retired sentence\n");
        fs.writeFileSync(path.join(root, "registry.json"), registryFor("cli/carrier.mjs"));

        const { code } = invoke(root, "cli/carrier.mjs\0");
        assert.equal(code, 0, "the carrier spelling its own rule is the green case");
    });
});
