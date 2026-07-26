// Tests for `plugin-lint` — the packaging validator.
//
// Written before the validator, per ../core/operating/verification.md: the failing test is the spec.
// Zero dependencies, node's own runner, same as ./doctor.test.mjs — and run by the same recipe.
//
//   node --test "cli/**/*.test.mjs"
//
// Fixtures are built in temp directories at run time rather than committed under ./fixtures/. Two
// reasons, both forced by checks that already run here: a committed known-bad manifest must still be
// well-formed JSON (`json.sh` parses every tracked .json), which rules out the malformed-manifest
// cases outright; and most of what this validator judges is a *tree shape* — a path that resolves, a
// directory that contains a SKILL.md — which a single committed file cannot express.
//
// What it does NOT test, deliberately: that Claude Code accepts the plugin. That is the platform's
// contract and `claude plugin validate --strict` is its authority. See the header of ./plugin-lint.mjs.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PluginLintError, inspect, run, parseFrontmatter } from "./plugin-lint.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

// One exit handler for every scratch directory, not one per directory. The per-directory form
// exceeds node's default limit of ten listeners partway through this suite and prints a
// MaxListenersExceededWarning — noise that trains a reader to skim warnings from a test run, which
// is where a real listener leak would then hide. Found by review on the pull request.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

/** A throwaway directory, removed when the process exits. */
function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-plugin-"));
    SCRATCH.push(dir);
    return dir;
}

function write(root, rel, body) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
    return target;
}

const SKILL = (name, description) =>
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# Skill\n\nBody.\n`;

const AGENT = (name, description) =>
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# Agent\n\nBody.\n`;

/**
 * A minimal plugin tree that lints clean, so each test can break exactly one thing.
 * Overrides are applied to the two manifests before they are written.
 */
function fixture({ plugin = {}, marketplace = {}, skip = [] } = {}) {
    const root = scratch();
    const pluginJson = {
        name: "demo",
        version: "0.1.0",
        description: "A demo plugin.",
        skills: ["./skills/"],
        ...plugin,
    };
    const marketplaceJson = {
        name: "demo-market",
        owner: { name: "Someone" },
        plugins: [{ name: "demo", source: "./", version: "0.1.0" }],
        ...marketplace,
    };
    if (!skip.includes("plugin.json")) {
        write(root, ".claude-plugin/plugin.json", JSON.stringify(pluginJson, null, 2));
    }
    if (!skip.includes("marketplace.json")) {
        write(root, ".claude-plugin/marketplace.json", JSON.stringify(marketplaceJson, null, 2));
    }
    if (!skip.includes("skills")) {
        write(root, "skills/greet/SKILL.md", SKILL("greet", "Greets. Use when greeting."));
    }
    if (!skip.includes("agents")) {
        write(root, "agents/worker.md", AGENT("worker", "Does work. Delegate work to it."));
    }
    return root;
}

/** Every failing finding's message, joined — for asserting on what was reported. */
const fails = (findings) => findings.filter((f) => f.severity === "fail");
const messages = (findings) => fails(findings).map((f) => f.message).join("\n");

// ===========================================================================================

describe("a clean tree", () => {
    test("the fixture plugin lints green", () => {
        const { findings } = inspect(fixture());
        assert.equal(fails(findings).length, 0, messages(findings));
    });

    test("this repository lints green", () => {
        const { findings } = inspect(REPO);
        assert.equal(fails(findings).length, 0, messages(findings));
    });

    test("a relative root behaves like an absolute one", () => {
        // The defect this test was written from: every fixture here passes an absolute temp
        // directory, while the verify recipe calls `node cli/plugin-lint.mjs .`. The declared
        // skills resolved absolute and the walked ones stayed relative, so nothing matched and
        // every shipped skill was reported as undeclared. A suite that only ever exercises one
        // shape of an argument has not exercised the argument.
        const absolute = inspect(REPO);
        const cwd = process.cwd();
        try {
            process.chdir(REPO);
            const relative = inspect(".");
            assert.deepEqual(
                relative.findings.map((f) => `${f.severity} ${f.check}`).sort(),
                absolute.findings.map((f) => `${f.severity} ${f.check}`).sort(),
            );
        } finally {
            process.chdir(cwd);
        }
    });

    test("green means something was actually checked", () => {
        // A validator that resolves nothing and reports nothing is the fail-open this repository
        // has minted three rules about. Counts are asserted, not just the absence of failures.
        const { stats } = inspect(fixture());
        assert.ok(stats.skills >= 1, "no skills were checked");
        assert.ok(stats.agents >= 1, "no agents were checked");
        assert.ok(stats.paths >= 1, "no component paths were resolved");
    });
});

describe("the manifests", () => {
    test("a missing plugin.json is a failure, not a crash", () => {
        const { findings } = inspect(fixture({ skip: ["plugin.json"] }));
        assert.match(messages(findings), /plugin\.json/);
    });

    test("a missing marketplace.json is a failure", () => {
        const { findings } = inspect(fixture({ skip: ["marketplace.json"] }));
        assert.match(messages(findings), /marketplace\.json/);
    });

    test("a malformed plugin.json is a failure about the workspace, not exit 2", () => {
        const root = fixture();
        write(root, ".claude-plugin/plugin.json", "{ not json");
        const { findings } = inspect(root);
        assert.match(messages(findings), /parse|malformed/i);
    });

    test("a malformed marketplace.json is a failure", () => {
        const root = fixture();
        write(root, ".claude-plugin/marketplace.json", "[1,2,");
        const { findings } = inspect(root);
        assert.match(messages(findings), /parse|malformed/i);
    });

    test("a manifest that is valid JSON but not an object is a failure", () => {
        const root = fixture();
        write(root, ".claude-plugin/plugin.json", "[]");
        const { findings } = inspect(root);
        assert.match(messages(findings), /object/i);
    });
});

describe("plugin.json", () => {
    test("name is required", () => {
        const root = fixture({ plugin: { name: undefined } });
        assert.match(messages(inspect(root).findings), /name/);
    });

    test("name must be a slug", () => {
        const root = fixture({ plugin: { name: "Demo Plugin" } });
        assert.match(messages(inspect(root).findings), /name/);
    });

    test("name must be a string", () => {
        const root = fixture({ plugin: { name: 7 } });
        assert.match(messages(inspect(root).findings), /name/);
    });

    test("a version, when declared, must be semver-shaped", () => {
        const root = fixture({
            plugin: { version: "v0.1" },
            marketplace: { plugins: [{ name: "demo", source: "./", version: "v0.1" }] },
        });
        assert.match(messages(inspect(root).findings), /version/);
    });

    test("an absent version is not a failure", () => {
        // The platform falls back to the git commit SHA. Demanding a version would be this
        // validator legislating where the contract does not.
        const root = fixture({
            plugin: { version: undefined },
            marketplace: { plugins: [{ name: "demo", source: "./" }] },
        });
        assert.equal(fails(inspect(root).findings).length, 0, messages(inspect(root).findings));
    });
});

describe("marketplace.json", () => {
    test("owner is required", () => {
        const root = fixture({ marketplace: { owner: undefined } });
        assert.match(messages(inspect(root).findings), /owner/);
    });

    test("owner.name is required", () => {
        const root = fixture({ marketplace: { owner: { url: "https://example.invalid" } } });
        assert.match(messages(inspect(root).findings), /owner/);
    });

    test("plugins must be present", () => {
        const root = fixture({ marketplace: { plugins: undefined } });
        assert.match(messages(inspect(root).findings), /plugins/);
    });

    test("an empty plugins array is a failure", () => {
        // The whole point of the file. A repository that calls itself a marketplace and ships
        // nothing is the fail-open here: `claude plugin validate` reports it as a warning, which
        // is exactly the severity that gets ignored for a milestone.
        const root = fixture({ marketplace: { plugins: [] } });
        assert.match(messages(inspect(root).findings), /plugins/);
    });

    test("an entry needs a source", () => {
        const root = fixture({ marketplace: { plugins: [{ name: "demo" }] } });
        assert.match(messages(inspect(root).findings), /source/);
    });

    test("a relative source must start with ./", () => {
        const root = fixture({ marketplace: { plugins: [{ name: "demo", source: "skills" }] } });
        assert.match(messages(inspect(root).findings), /source/);
    });

    test("a source may not escape the marketplace root", () => {
        const root = fixture({ marketplace: { plugins: [{ name: "demo", source: "./../x" }] } });
        assert.match(messages(inspect(root).findings), /outside|escape/i);
    });

    test("a source that does not resolve is a failure", () => {
        const root = fixture({ marketplace: { plugins: [{ name: "demo", source: "./nowhere" }] } });
        assert.match(messages(inspect(root).findings), /nowhere/);
    });

    test("a non-string source is reported, not assumed", () => {
        // Object sources (github, url, git-subdir, npm) are legal and point outside this tree,
        // so they are noted as unverifiable rather than failed — never silently skipped.
        const root = fixture({
            marketplace: {
                plugins: [{ name: "demo", source: { source: "github", repo: "a/b" } }],
            },
        });
        const { findings, stats } = inspect(root);
        assert.equal(fails(findings).length, 0, messages(findings));
        assert.ok(stats.unverifiable >= 1, "an off-tree source should be counted unverifiable");
    });
});

describe("the two manifests must agree", () => {
    test("a root-source entry whose name differs from plugin.json is a failure", () => {
        const root = fixture({
            marketplace: { plugins: [{ name: "other", source: "./", version: "0.1.0" }] },
        });
        assert.match(messages(inspect(root).findings), /name/);
    });

    test("a root-source entry whose version differs from plugin.json is a failure", () => {
        const root = fixture({
            marketplace: { plugins: [{ name: "demo", source: "./", version: "9.9.9" }] },
        });
        assert.match(messages(inspect(root).findings), /version/);
    });

    test("an entry that declares no version does not have to agree about one", () => {
        const root = fixture({ marketplace: { plugins: [{ name: "demo", source: "./" }] } });
        assert.equal(fails(inspect(root).findings).length, 0);
    });
});

describe("component paths", () => {
    test("a component path must start with ./", () => {
        const root = fixture({ plugin: { skills: ["skills/"] } });
        assert.match(messages(inspect(root).findings), /skills/);
    });

    test("a component path may not escape the plugin root", () => {
        const root = fixture({ plugin: { skills: ["./../elsewhere/"] } });
        assert.match(messages(inspect(root).findings), /outside|escape/i);
    });

    test("a component path that does not resolve is a failure", () => {
        const root = fixture({ plugin: { skills: ["./no-such-dir/"] } });
        assert.match(messages(inspect(root).findings), /no-such-dir/);
    });

    test("an `agents` key is a failure whatever it names, because declaring one loads nothing", () => {
        // Measured 2026-07-26 against Claude Code v2.1.215, with a positive control: files at the
        // default ./agents/ and NO key register (`Agents (1)`); the same files named explicitly
        // register `Agents (0)`; a directory value refuses the whole plugin. So the key does not
        // merely fail to help — it suppresses the scan that works. A path that resolves is exactly
        // as dead as one that does not, which is why this fails on the key rather than on its value.
        const resolves = fixture({ plugin: { agents: ["./agents/worker.md"] } });
        assert.match(messages(inspect(resolves).findings), /agents/);
        const dangling = fixture({ plugin: { agents: ["./agents/ghost.md"] } });
        assert.match(messages(inspect(dangling).findings), /agents/);
    });

    test("a symlink out of the plugin root is a failure, not merely a lexical pass", () => {
        // The lexical containment check reads "./outside/" as inside the root; only canonicalising
        // the target catches that the files are somewhere else. A plugin's contract is that its
        // components live inside it, and this repository rejected a symlinked payload for its own
        // packaging — so the shape is one it actively considered, not a hypothetical.
        const root = fixture();
        const elsewhere = scratch();
        fs.mkdirSync(path.join(elsewhere, "smuggled"), { recursive: true });
        write(elsewhere, "smuggled/SKILL.md", SKILL("smuggled", "Not in the tree."));
        fs.symlinkSync(elsewhere, path.join(root, "outside"));
        write(
            root,
            ".claude-plugin/plugin.json",
            JSON.stringify({ name: "demo", version: "0.1.0", skills: ["./outside/"] }),
        );
        assert.match(messages(inspect(root).findings), /link out of the plugin root/);
    });

    test("a symlink that stays inside the plugin root is fine", () => {
        // The other half, so the check above cannot be satisfied by refusing every symlink: the
        // platform dereferences in-marketplace symlinks, and rejecting them would fail a layout it
        // supports.
        const root = fixture();
        fs.mkdirSync(path.join(root, "real", "greet"), { recursive: true });
        write(root, "real/greet/SKILL.md", SKILL("greet", "Greets."));
        fs.rmSync(path.join(root, "skills"), { recursive: true, force: true });
        fs.symlinkSync(path.join(root, "real"), path.join(root, "skills"));
        assert.equal(fails(inspect(root).findings).length, 0, messages(inspect(root).findings));
    });

    test("a string component path is accepted as well as an array", () => {
        const root = fixture({ plugin: { skills: "./skills/" } });
        assert.equal(fails(inspect(root).findings).length, 0, messages(inspect(root).findings));
    });
});

describe("the skills the plugin declares", () => {
    test("a declared skills directory containing no skill is a failure", () => {
        const root = fixture({ skip: ["skills"] });
        fs.mkdirSync(path.join(root, "skills"), { recursive: true });
        assert.match(messages(inspect(root).findings), /no skill/i);
    });

    test("a skill directory without SKILL.md is a failure", () => {
        const root = fixture();
        fs.mkdirSync(path.join(root, "skills", "hollow"), { recursive: true });
        assert.match(messages(inspect(root).findings), /hollow/);
    });

    test("a SKILL.md with no frontmatter is a failure", () => {
        const root = fixture();
        write(root, "skills/greet/SKILL.md", "# Greet\n\nNo frontmatter here.\n");
        assert.match(messages(inspect(root).findings), /frontmatter/i);
    });

    test("a SKILL.md whose frontmatter is never closed is a failure", () => {
        const root = fixture();
        write(root, "skills/greet/SKILL.md", "---\nname: greet\ndescription: x\n\n# Greet\n");
        assert.match(messages(inspect(root).findings), /frontmatter/i);
    });

    test("a SKILL.md with no description is a failure", () => {
        const root = fixture();
        write(root, "skills/greet/SKILL.md", "---\nname: greet\n---\n\nBody.\n");
        assert.match(messages(inspect(root).findings), /description/);
    });

    test("a SKILL.md with an empty description is a failure", () => {
        const root = fixture();
        write(root, "skills/greet/SKILL.md", '---\nname: greet\ndescription: ""\n---\n\nBody.\n');
        assert.match(messages(inspect(root).findings), /description/);
    });

    test("a SKILL.md with no name is a failure", () => {
        // Stricter than the platform, deliberately, and the reason is in plugin-lint.mjs beside the
        // call: without `name` the invocation name is inherited from the layout, and for a path
        // pointing straight at a skill that means the install directory — a version string that
        // changes on every marketplace update.
        const root = fixture();
        write(root, "skills/greet/SKILL.md", "---\ndescription: Greets.\n---\n\nBody.\n");
        assert.match(messages(inspect(root).findings), /name/);
    });

    test("a non-slug skill name is a failure", () => {
        const root = fixture();
        write(root, "skills/greet/SKILL.md", SKILL("Greet Loudly", "Greets."));
        assert.match(messages(inspect(root).findings), /name/);
    });

    test("a block-scalar description is accepted", () => {
        // The conservative half of the parse policy: a description written across lines is legal
        // YAML and common in long skill descriptions. Failing it would be a false red, and a false
        // red is what gets a whole recipe switched off (../.portulan/verify/README.md).
        const root = fixture();
        write(
            root,
            "skills/greet/SKILL.md",
            "---\nname: greet\ndescription: >-\n  Greets people warmly.\n  Use when greeting.\n---\n\nBody.\n",
        );
        assert.equal(fails(inspect(root).findings).length, 0, messages(inspect(root).findings));
    });

    test("a skill outside every declared path is not silently shipped", () => {
        // `skills` on a marketplace-root entry replaces the default scan, so a directory nobody
        // declared is a directory nobody ships — and the author will believe otherwise.
        const root = fixture();
        write(root, "extra/lonely/SKILL.md", SKILL("lonely", "Never declared."));
        const { findings } = inspect(root);
        assert.equal(fails(findings).length, 0, "an undeclared skill is a note, not a failure");
        assert.match(
            findings.map((f) => f.message).join("\n"),
            /lonely/,
            "an undeclared skill should still be reported",
        );
    });
});

describe("the agents nothing declares", () => {
    // Agents are found by convention rather than by declaration, and that is not a style choice:
    // the only form the host loads is `./agents/` with no `agents` key at all. So the coverage the
    // milestone-3 criterion asks for — "CI checks every declared skill and agent" — cannot be
    // reached through the manifest for agents, and is reached through the convention instead.
    // Without these tests the criterion degrades silently: the recipe printed `0 agent(s)` and
    // GREEN the moment the key came out.

    test("an agent file with no frontmatter is a failure", () => {
        const root = fixture();
        write(root, "agents/worker.md", "# Worker\n\nNo frontmatter.\n");
        assert.match(messages(inspect(root).findings), /frontmatter/i);
    });

    test("an agent file with no description is a failure", () => {
        const root = fixture();
        write(root, "agents/worker.md", "---\nname: worker\n---\n\nBody.\n");
        assert.match(messages(inspect(root).findings), /description/);
    });

    test("an agent file with no name is a failure", () => {
        const root = fixture();
        write(root, "agents/worker.md", "---\ndescription: Does work.\n---\n\nBody.\n");
        assert.match(messages(inspect(root).findings), /name/);
    });

    test("every agent in the directory is checked, not only the first", () => {
        const root = fixture();
        write(root, "agents/second.md", "---\nname: second\n---\n\nNo description.\n");
        assert.match(messages(inspect(root).findings), /second/);
    });

    test("an agents directory holding no agent is a failure", () => {
        const root = fixture({ skip: ["agents"] });
        fs.mkdirSync(path.join(root, "agents"), { recursive: true });
        assert.match(messages(inspect(root).findings), /no agent/i);
    });

    test("a plugin that ships no agents at all is not a failure", () => {
        // Generic validator, not a mirror of this repository: shipping no agents is legitimate.
        // The residual hole is named rather than hidden — deleting `agents/` outright degrades to
        // a note here, and the check that would bind it is the persona↔agent agreement lint in
        // ../.portulan/tasks/0005-lint-the-persona-agent-binding.md.
        const root = fixture({ skip: ["agents"] });
        assert.equal(fails(inspect(root).findings).length, 0, messages(inspect(root).findings));
        assert.equal(inspect(root).stats.agents, 0);
    });

    test("this repository's three personas are found and checked", () => {
        // The count is asserted against this tree on purpose. `0 agent(s)` read as GREEN once and
        // the personas had silently stopped shipping; a bare "no failures" assertion would have
        // agreed with it.
        assert.equal(inspect(REPO).stats.agents, 3);
    });

    test("this repository's agents/ is a real directory, not a symlink", () => {
        // A repository-anchored assertion rather than a rule in the lint, because the shape it
        // refuses is one the platform *accepts*: a symlinked `agents/` was built during this
        // session, loaded correctly through two of the three install paths, and passed every check
        // here. It was rejected on the maintainer's direction because the third path — a clone from
        // the remote — was never measured, which makes it an untested behaviour resting on a
        // platform quirk. Nothing stopped it coming back: one `ln -s` restored it and the whole
        // suite, the lint and the map check all stayed green. So the ruling is written where it
        // binds this tree and nowhere else. A generic refusal would be this repository encoding its
        // own risk appetite into a tool other plugins run.
        assert.equal(fs.lstatSync(path.join(REPO, "agents")).isSymbolicLink(), false);
    });

    test("an agent reached by a symlink is checked, not silently skipped", () => {
        // `readdirSync(…, { withFileTypes: true })` reports a symlink as neither a file nor a
        // directory, so the obvious `isFile()` filter drops it — and a dropped agent is exactly the
        // failure this whole session is about: present in the tree, absent from the count, nothing
        // saying so. Here the target is inside the root and broken, so it must be *reported*.
        const root = fixture();
        fs.symlinkSync("./nowhere.md", path.join(root, "agents", "linked.md"));
        assert.notEqual(fails(inspect(root).findings).length, 0, "a symlinked agent was skipped");
    });
});

describe("failing closed", () => {
    test("an unreadable SKILL.md is a failure, not an exit 2", () => {
        // doctor's own defect, tested here before it can be repeated: an unguarded read turned a
        // workspace already judged red into "could not run", discarding every finding so far.
        const root = fixture();
        const file = path.join(root, "skills", "greet", "SKILL.md");
        fs.chmodSync(file, 0o000);
        try {
            const { findings } = inspect(root);
            assert.match(messages(findings), /read|permission/i);
        } finally {
            fs.chmodSync(file, 0o644);
        }
    });

    test("one failure does not discard the findings around it", () => {
        const root = fixture({ plugin: { skills: ["./no-such-dir/"] } });
        write(root, "agents/worker.md", "# Worker\n\nNo frontmatter.\n");
        assert.equal(fails(inspect(root).findings).length >= 2, true, "both failures should survive");
    });

    test("a declared path that cannot be read is a verdict, not could-not-run", () => {
        // Review'd point, and the right one: a declared-but-unreadable component path must arrive as
        // a packaging failure (exit 1), never as exit 2 discarding the findings around it. The fix
        // was structural rather than another try/catch — `resolve()` now reads the path's kind once,
        // inside its own guard, so the loops below it have no second unguarded `statSync` to throw
        // from.
        const root = fixture({ plugin: { skills: ["./locked/inner/"] } });
        fs.mkdirSync(path.join(root, "locked", "inner"), { recursive: true });
        fs.chmodSync(path.join(root, "locked"), 0o000);
        try {
            const { findings } = inspect(root);
            assert.ok(fails(findings).length >= 1, "expected a failure, not a clean run");
            assert.match(messages(findings), /locked/);
        } finally {
            fs.chmodSync(path.join(root, "locked"), 0o755);
        }
    });

    test("that unreadable path is exit 1, not exit 2", async () => {
        const root = fixture({ plugin: { skills: ["./locked/inner/"] } });
        fs.mkdirSync(path.join(root, "locked", "inner"), { recursive: true });
        fs.chmodSync(path.join(root, "locked"), 0o000);
        try {
            assert.equal(await run([root], { quiet: true }), 1);
        } finally {
            fs.chmodSync(path.join(root, "locked"), 0o755);
        }
    });

    test("a root that does not exist is could-not-run, not a verdict", () => {
        assert.throws(() => inspect(path.join(scratch(), "absent")), PluginLintError);
    });
});

describe("exit codes", () => {
    test("no argument is exit 2 — a usage error is not a verdict", async () => {
        assert.equal(await run([], { quiet: true }), 2);
    });

    test("a clean tree is exit 0", async () => {
        assert.equal(await run([fixture()], { quiet: true }), 0);
    });

    test("a tree with a failure is exit 1", async () => {
        assert.equal(await run([fixture({ marketplace: { plugins: [] } })], { quiet: true }), 1);
    });

    test("a root that cannot be read is exit 2", async () => {
        assert.equal(await run([path.join(scratch(), "absent")], { quiet: true }), 2);
    });

    test("this repository is exit 0", async () => {
        assert.equal(await run([REPO], { quiet: true }), 0);
    });
});

describe("the frontmatter parser", () => {
    test("it reads a plain key", () => {
        assert.equal(parseFrontmatter("---\nname: a\n---\n").fields.name, "a");
    });

    test("it strips matching quotes", () => {
        assert.equal(parseFrontmatter('---\nname: "a"\n---\n').fields.name, "a");
        assert.equal(parseFrontmatter("---\nname: 'a'\n---\n").fields.name, "a");
    });

    test("it reports the absence of frontmatter rather than guessing", () => {
        assert.equal(parseFrontmatter("# Title\n").fields, null);
    });

    test("frontmatter must open on the first line", () => {
        assert.equal(parseFrontmatter("\n---\nname: a\n---\n").fields, null);
    });

    test("an unterminated block is reported", () => {
        const parsed = parseFrontmatter("---\nname: a\n");
        assert.equal(parsed.fields, null);
        assert.match(parsed.error, /clos/i);
    });

    test("it joins a folded block scalar", () => {
        const parsed = parseFrontmatter("---\ndescription: >-\n  one\n  two\n---\n");
        assert.equal(parsed.fields.description, "one two");
    });

    test("a colon inside a value does not truncate it", () => {
        assert.equal(
            parseFrontmatter("---\ndescription: Use when: a thing happens\n---\n").fields.description,
            "Use when: a thing happens",
        );
    });
});
