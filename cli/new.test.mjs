// Tests for `new`: scaffolds that validate, written into the user's own layer and never into `core/`.

import { test, describe } from "node:test";

// The first gate-policy spec with a `floor`, per `spec/slots.md`.
const FLOOR_MIN_SPEC = "2.2";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NewError, KINDS, parseArgs, template, destination, collisions, run } from "./new.mjs";

// No host plugins reach this suite; `pinned-roots.live.test.mjs` requires these three lines verbatim.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

// One exit handler for every scratch directory: one each would pass node's ten-listener limit.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) {
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch {
            /* a dying case can leave a directory unreadable, and `force` suppresses ENOENT, not EACCES */
        }
    }
});

function scratch(seed = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-new-"));
    SCRATCH.push(dir);
    for (const [rel, contents] of Object.entries(seed)) {
        const full = path.join(dir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, contents);
    }
    return dir;
}

function harness() {
    const said = [];
    const warned = [];
    return { said, warned, options: { say: (l) => said.push(l), warn: (l) => warned.push(l) } };
}

function workspace(dir, extra = {}) {
    const manifest = {
        portulan: { spec: "2.7" },
        name: "scaffold-target",
        kind: "repository",
        tree: "../",
        slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" },
        ...extra,
    };
    fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    return path.join(dir, ".portulan");
}

// ------------------------------------------------------------------ the six kinds

describe("the six kinds are exactly the ones row 7 names", () => {
    test("all six are known", () => {
        assert.deepEqual(
            [...KINDS].sort(),
            ["gate-policy", "pack", "persona", "repo-card", "skill", "workspace"],
        );
    });

    test("every kind resolves to a core template that exists", () => {
        for (const kind of KINDS) {
            const file = template(kind);
            assert.ok(fs.existsSync(file), `core template for \`${kind}\` is missing: ${file}`);
            assert.ok(fs.readFileSync(file, "utf8").trim().length > 0, `core template for \`${kind}\` is empty`);
        }
    });

    test("an unknown kind is refused, and the refusal lists the ones that exist", () => {
        const { said, options } = harness();
        const code = run(["flavour", "x"], options);
        assert.equal(code, 2);
        const text = said.join("\n");
        assert.match(text, /flavour/);
        for (const kind of KINDS) assert.match(text, new RegExp(kind.replace("-", "\\-")));
    });

    test("no kind at all prints usage and exits 2, never 0", () => {
        const { options } = harness();
        assert.equal(run([], options), 2);
    });
});

// ------------------------------------------------------------------ never into core/

describe("never into `core/` — the one property row 7 states in the imperative", () => {
    test("a destination inside the shipped core/ is refused", () => {
        const { said, options } = harness();
        const code = run(["skill", "my-skill", "--into", path.join(REPO, "core")], options);
        assert.equal(code, 2);
        assert.match(said.join("\n"), /core\/|this project ships/i);
    });

    test("a `..` segment that climbs into core/ is refused after resolution, not by pattern", () => {
        const { said, options } = harness();
        const code = run(["skill", "my-skill", "--into", path.join(REPO, "packs", "..", "core")], options);
        assert.equal(code, 2);
        assert.match(said.join("\n"), /core\/|this project ships/i);
    });

    test("a symlink pointing into core/ is refused rather than resolved and permitted", () => {
        const dir = scratch();
        const link = path.join(dir, "sneaky");
        fs.symlinkSync(path.join(REPO, "core"), link);
        const { said, options } = harness();
        const code = run(["skill", "my-skill", "--into", link], options);
        assert.equal(code, 2);
        assert.match(said.join("\n"), /symlink|link/i);
    });

    // Probed, not read from `process.platform`: case sensitivity belongs to the volume, not the OS.
    const caseInsensitiveFS = (() => {
        const dir = scratch({ "probe/x": "" });
        return fs.existsSync(path.join(dir, "PROBE", "x"));
    })();

    test("a case-variant spelling of core/ is refused where the filesystem does not distinguish case", () => {
        const dir = scratch({ "core/engine.md": "# kernel\n", "core/templates/skill.md": "# t\n" });
        const { said, options } = harness();
        const code = run(["skill", "evil", "--into", path.join(dir, "CORE", "templates", "x")], options);

        // A case-sensitive volume keeps `CORE/` apart from `core/`, so only the exit code is conditional.
        assert.ok(!fs.existsSync(path.join(dir, "core", "templates", "x")), "it wrote into core/ anyway");
        if (caseInsensitiveFS) {
            assert.equal(code, 2, `a case-variant path reaches core/ on this filesystem and must be refused: ${said.join("\n")}`);
        }
    });

    test("a symlinked ancestor is resolved even when the destination does not exist yet", () => {
        const dir = scratch({ "core/engine.md": "# kernel\n", "core/templates/skill.md": "# t\n" });
        const link = path.join(dir, "mylayer");
        fs.symlinkSync(path.join(dir, "core"), link);
        const { said, options } = harness();
        const code = run(["skill", "evil", "--into", path.join(link, "newdir")], options);
        assert.equal(code, 2, said.join("\n"));
        assert.ok(!fs.existsSync(path.join(dir, "core", "newdir")), "it wrote into core/ through a link");
    });

    test("core/ is refused even when it is the caller's own copy rather than this checkout", () => {
        const dir = scratch({ "core/engine.md": "# kernel\n", "core/templates/skill.md": "# t\n" });
        const { said, options } = harness();
        const code = run(["skill", "my-skill", "--into", path.join(dir, "core")], options);
        assert.equal(code, 2);
        assert.match(said.join("\n"), /core\/|this project ships/i);
    });
});

// ------------------------------------------------------------------ refusing before the first byte

describe("it refuses ahead of the first byte, the way `init` does", () => {
    test("an existing file is never written over", () => {
        const dir = scratch();
        const ws = workspace(dir, { slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md", repos: "repos/" } });
        fs.mkdirSync(path.join(ws, "repos"), { recursive: true });
        fs.writeFileSync(path.join(ws, "repos", "mine.md"), "# hand-written, do not lose me\n");
        const { said, options } = harness();
        const code = run(["repo-card", "mine", "--into", ws], options);
        assert.equal(code, 2);
        assert.match(said.join("\n"), /already|exists/i);
        assert.equal(fs.readFileSync(path.join(ws, "repos", "mine.md"), "utf8"), "# hand-written, do not lose me\n");
    });

    test("a collision is reported with every colliding path, grouped by cause", () => {
        const dir = scratch();
        const ws = workspace(dir);
        fs.mkdirSync(path.join(ws, "..", "packs", "rituals", "mine", "skills", "a"), { recursive: true });
        const found = collisions([path.join(ws, "x.md"), path.join(ws, "y.md")]);
        assert.ok(Array.isArray(found));
    });

    test("only ENOENT means absent — EACCES refuses rather than reporting nothing there", () => {
        const dir = scratch();
        const locked = path.join(dir, "locked");
        fs.mkdirSync(locked, { recursive: true });
        fs.chmodSync(locked, 0o000);
        try {
            const { said, options } = harness();
            const code = run(["repo-card", "mine", "--into", locked], options);
            assert.equal(code, 2);
            assert.doesNotMatch(said.join("\n"), /no workspace here|nothing there/i);
        } finally {
            fs.chmodSync(locked, 0o755);
        }
    });
});

// ------------------------------------------------------------------ the argument surface

describe("the argument surface refuses what it cannot act on", () => {
    test("an empty flag value is refused at the command line", () => {
        assert.throws(() => parseArgs(["skill", "x", "--into", ""]), NewError);
    });

    test("any leading `-` is a missing value, so a help request is not eaten as one", () => {
        assert.throws(() => parseArgs(["skill", "x", "--into", "-h"]), NewError);
    });

    test("an unknown option names a command that can actually be run", () => {
        const { said, options } = harness();
        const code = run(["skill", "x", "--flavour", "vanilla"], options);
        assert.equal(code, 2);
        const text = said.join("\n");
        assert.match(text, /portulan new --help/);
        assert.match(text, /node cli\/new\.mjs --help/);
    });

    test("a name that is not a slug is refused, and the refusal shows the shape", () => {
        const { said, options } = harness();
        assert.equal(run(["skill", "Not A Slug"], options), 2);
        assert.match(said.join("\n"), /lowercase|slug|hyphen/i);
    });
});

// ------------------------------------------------------------------ what it writes validates

describe("what `new` scaffolds validates — the real tools, against real directories", () => {
    test("a scaffolded skill passes the frontmatter contract plugin-lint enforces", async () => {
        const dir = scratch();
        const ws = workspace(dir);
        const pack = path.join(dir, "packs", "rituals", "mine");
        fs.mkdirSync(pack, { recursive: true });
        assert.equal(run(["pack", "mine", "--category", "rituals", "--into", path.join(dir, "packs")], harness().options), 0);
        assert.equal(run(["skill", "my-skill", "--into", pack], harness().options), 0);

        const file = path.join(pack, "skills", "my-skill", "SKILL.md");
        assert.ok(fs.existsSync(file), "the skill was not written where the scaffold said it would be");
        const { parseFrontmatter } = await import("./plugin-lint.mjs");
        const { fields, error } = parseFrontmatter(fs.readFileSync(file, "utf8"));
        assert.equal(error, undefined, `frontmatter did not parse — ${error}`);
        assert.equal(fields.name, "my-skill");
        assert.ok(fields.description && fields.description.trim().length > 0);
        assert.ok(ws);
    });

    test("a scaffolded pack validates against the Pack Definition", async () => {
        const dir = scratch();
        assert.equal(run(["pack", "mine", "--category", "rituals", "--into", dir], harness().options), 0);
        const manifest = JSON.parse(fs.readFileSync(path.join(dir, "rituals", "mine", "pack.json"), "utf8"));
        const { validate, compileSchema } = await import("./doctor.mjs");
        const schema = JSON.parse(fs.readFileSync(path.join(REPO, "spec", "pack.schema.json"), "utf8"));
        compileSchema(schema);
        const errors = validate(schema, manifest);
        assert.deepEqual(errors, [], `the scaffolded pack does not validate: ${JSON.stringify(errors)}`);
    });

    test("a scaffolded persona carries all five parts of the contract", () => {
        const dir = scratch();
        assert.equal(run(["pack", "mine", "--category", "rituals", "--into", dir], harness().options), 0);
        const pack = path.join(dir, "rituals", "mine");
        assert.equal(run(["persona", "my-role", "--into", pack], harness().options), 0);
        const text = fs.readFileSync(path.join(pack, "personas", "my-role.md"), "utf8");
        assert.match(text, /tools:/, "no `tools:` allow-list");
        assert.match(text, /##\s*Charter/i, "no charter");
        assert.match(text, /##\s*Autonomy reach/i, "no autonomy reach");
        assert.match(text, /##\s*Memory scope/i, "no memory scope");
        assert.match(text, /##\s*Read\s*\/\s*write posture/i, "no read/write posture");
    });

    test("a scaffolded persona's reach section does not contain the fourth tier's name at all", () => {
        const dir = scratch();
        assert.equal(run(["pack", "mine", "--category", "rituals", "--into", dir], harness().options), 0);
        const pack = path.join(dir, "rituals", "mine");
        assert.equal(run(["persona", "my-role", "--into", pack], harness().options), 0);
        const reach = fs
            .readFileSync(path.join(pack, "personas", "my-role.md"), "utf8")
            .split(/##\s*Autonomy reach/i)[1]
            .split(/\n##/)[0];
        assert.doesNotMatch(reach, /\bProhibited\b/);
    });

    test("a scaffolded gate policy parses AND compiles — parsing is not the bar", async () => {
        const dir = scratch();
        assert.equal(run(["gate-policy", "gates", "--into", dir], harness().options), 0);
        const policy = JSON.parse(fs.readFileSync(path.join(dir, "gates.json"), "utf8"));
        assert.ok(Array.isArray(policy.rules) && policy.rules.length > 0, "a policy with no rules gates nothing");
        assert.ok(policy.why, "a policy with no rationale is taste — dod.md condition 3");

        const ws = scratch();
        fs.mkdirSync(path.join(ws, ".portulan"), { recursive: true });
        fs.writeFileSync(
            path.join(ws, ".portulan", "workspace.json"),
            JSON.stringify({ portulan: { spec: "2.7" }, name: "w", kind: "repository", tree: "../", gates: "gates.json" }),
        );
        let filled = fs.readFileSync(path.join(dir, "gates.json"), "utf8").replace('"{default branch}"', '"main"');
        let n = 0;
        filled = filled
            .replace(/"\{rule-id\}"/g, () => `"scaffold-placeholder-${++n}"`)
            .replace(/"\{[^"]*\}"/g, '"Filled by the adopter — a placeholder is a sentence they write."');
        assert.doesNotMatch(filled, /\{[a-z]/i, "every placeholder was filled, so a refusal below is the skeleton's");
        fs.writeFileSync(path.join(ws, ".portulan", "gates.json"), filled);

        const { run: compile } = await import("./compile.mjs");
        assert.equal(compile(["--workspace", ws], { quiet: true }), 0, "the next step `new` names must succeed on what `new` just wrote");

        const ruleset = JSON.parse(fs.readFileSync(path.join(ws, ".portulan", "compile", "github-ruleset.json"), "utf8"));
        assert.deepEqual(
            ruleset.rules.map((r) => r.type).sort(),
            ["deletion", "non_fast_forward"],
            "both scaffold ref rules must reach the floor, not just whichever one survives",
        );
    });

    test("the scaffolded policy declares a gate-policy spec the compiler implements", async () => {
        const dir = scratch();
        assert.equal(run(["gate-policy", "gates", "--into", dir], harness().options), 0);
        const policy = JSON.parse(fs.readFileSync(path.join(dir, "gates.json"), "utf8"));
        const { KNOWN_GATE_POLICY_SPECS } = await import("./compile.mjs");
        assert.equal(typeof policy.portulan?.spec, "string", "`portulan.spec` is a string-valued contract");
        assert.ok(
            KNOWN_GATE_POLICY_SPECS.has(policy.portulan.spec),
            `the skeleton declares spec ${JSON.stringify(policy.portulan?.spec)}, which compile does not implement`,
        );
        assert.equal(policy.portulan.gates, undefined, "`portulan.gates` is not a key anything reads");

        const { GATE_POLICY_SPEC } = await import("./init.mjs");
        assert.equal(
            policy.portulan.spec,
            GATE_POLICY_SPEC,
            "the two policy-generating carriers must declare the same gate-policy spec",
        );
        assert.equal(policy.portulan.spec, FLOOR_MIN_SPEC, "a skeleton that emits a `floor` must declare a spec that has one");
    });

    test("the scaffolded floor declares exactly the four keys the compiler reads", async () => {
        const dir = scratch();
        assert.equal(run(["gate-policy", "gates", "--into", dir], harness().options), 0);
        const policy = JSON.parse(fs.readFileSync(path.join(dir, "gates.json"), "utf8"));
        assert.deepEqual(
            Object.keys(policy.floor).sort(),
            ["branch", "checks", "resolve_conversations", "reviews"],
            "a key the compiler does not read is a key that silently does nothing",
        );
    });

    test("a scaffolded workspace is green under the real `doctor`", async () => {
        const dir = scratch();
        assert.equal(run(["workspace", "mine", "--into", dir], harness().options), 0);
        const { run: doctor } = await import("./doctor.mjs");
        const code = await doctor([path.join(dir, "mine")], { quiet: true });
        assert.equal(code, 0, "the scaffolded workspace is not green under doctor");
    });

    test("a scaffolded repo card lands in the workspace's declared repos slot", () => {
        const dir = scratch();
        const ws = workspace(dir, { slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md", repos: "repos/" } });
        assert.equal(run(["repo-card", "mine", "--into", ws], harness().options), 0);
        assert.ok(fs.existsSync(path.join(ws, "repos", "mine.md")));
    });
});

// ------------------------------------------------------------------ the destination is derived, not guessed

describe("the destination is derived from the workspace's own slots", () => {
    test("a repo card refuses when the workspace declares no repos slot", () => {
        const dir = scratch();
        const ws = workspace(dir);
        const { said, options } = harness();
        assert.equal(run(["repo-card", "mine", "--into", ws], options), 2);
        assert.match(said.join("\n"), /repos/);
    });

    test("`destination` is a pure function of kind, name and target", () => {
        const dir = scratch();
        const ws = workspace(dir, { slots: { identity: "i.md", principles: "p.md", gates: "g.md", repos: "repos/" } });
        assert.equal(destination("repo-card", "mine", ws), path.join(ws, "repos", "mine.md"));
    });
});

describe("a scaffolded pointer is a pointer, not a governing workspace with a label", () => {
    test("`--kind pointer --governed-by` is green under the real doctor", async () => {
        const dir = scratch();
        assert.equal(run(["workspace", "ptr", "--kind", "pointer", "--governed-by", "sleepy-panda", "--into", dir], harness().options), 0);
        const manifest = JSON.parse(fs.readFileSync(path.join(dir, "ptr", "workspace.json"), "utf8"));
        assert.equal(manifest.kind, "pointer");
        assert.equal(manifest.governed_by.workspace, "sleepy-panda");
        assert.equal(manifest.slots, undefined, "a pointer carrying slots is refused by doctor");
        assert.equal(manifest.verify, undefined, "a pointer carrying verify is refused by doctor");
        const { run: doctor } = await import("./doctor.mjs");
        assert.equal(await doctor([path.join(dir, "ptr")], { quiet: true }), 0);
    });

    test("a pointer naming nobody is refused, and so is a governor that claims a governor", () => {
        const dir = scratch();
        const a = harness();
        assert.equal(run(["workspace", "p", "--kind", "pointer", "--into", dir], a.options), 2);
        assert.match(a.said.join("\n"), /--governed-by/);
        const b = harness();
        assert.equal(run(["workspace", "q", "--governed-by", "x", "--into", dir], b.options), 2);
        assert.match(b.said.join("\n"), /only meaningful with/);
    });
});

describe("a slot value cannot walk a scaffold out of its own workspace", () => {
    test("a `repos` slot containing `..` is refused after resolution", () => {
        const dir = scratch();
        const ws = workspace(dir, {
            slots: { identity: "i.md", principles: "p.md", gates: "g.md", repos: "../../escaped/" },
        });
        const { said, options } = harness();
        assert.equal(run(["repo-card", "mine", "--into", ws], options), 2);
        assert.match(said.join("\n"), /outside the workspace/i);
        assert.ok(!fs.existsSync(path.join(dir, "..", "escaped")), "it wrote outside the workspace anyway");
    });
});

describe("a directory where a file must be written", () => {
    test("is refused upfront rather than thrown at mid-write", () => {
        const dir = scratch();
        fs.mkdirSync(path.join(dir, "personas", "reviewer.md"), { recursive: true });
        const h = harness();
        assert.equal(run(["persona", "reviewer", "--into", dir], h.options), 2);
        assert.match(h.said.join("\n"), /is a directory where a file has to be written/);
        const dir2 = scratch();
        fs.mkdirSync(path.join(dir2, "personas"), { recursive: true });
        fs.writeFileSync(path.join(dir2, "personas", "reviewer.md"), "mine\n");
        const h2 = harness();
        assert.equal(run(["persona", "reviewer", "--into", dir2], h2.options), 2);
        assert.match(h2.said.join("\n"), /already exist/);
    });
});
