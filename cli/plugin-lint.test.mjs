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

    // ../.portulan/tasks/0008-a-declared-skills-path-sees-one-level-down.md. The declared root was
    // resolved exactly two ways — itself, or its immediate children — so the shape a pack actually
    // ships was reported as a skill directory with no SKILL.md. Its three acceptance criteria are the
    // three tests below, in order: resolve at depth, keep the real failure loud, and report the bound.
    test("a pack-shaped tree resolves skills nested below the declared root — and says the host will not", () => {
        const root = fixture({ skip: ["skills"] });
        write(root, "skills/rituals-demo/skills/greet/SKILL.md", SKILL("greet", "Greets. Use when greeting."));
        // The half this test was written for at milestone 6 is unchanged: the walk RESOLVES the skill
        // rather than failing `rituals-demo/` with `has no SKILL.md`, and it is counted.
        assert.equal(inspect(root).stats.skills, 1);
        assert.doesNotMatch(messages(inspect(root).findings), /has no SKILL\.md/);

        // **And it asserted zero failures until 2026-08-07, which was the false green.** Resolving is
        // this validator's; registering is the host's, and the host expands a declared root exactly one
        // level. Measured on Claude Code 2.1.224 against a local marketplace built from this
        // repository: `./packs/rituals/` registered 0 of the pack's 3 skills and
        // `./packs/rituals/checkpoints/skills/` registered all 3. So a skill at this depth is packaged,
        // counted, and inert on every install — and the test that said the shape was fine is the reason
        // it stayed that way for a milestone (#134).
        const text = messages(inspect(root).findings);
        assert.match(text, /sits more than 1 level below the declared root/);
        assert.match(text, /Declare skills\/rituals-demo\/skills\/ instead/);
    });

    test("a directory under the declared root holding no skill at any depth still fails", () => {
        const root = fixture();
        fs.mkdirSync(path.join(root, "skills", "hollow", "deeper"), { recursive: true });
        // Attributed to the immediate child rather than to every level of the branch, and still in
        // the words the one-level version used — depth must not buy silence.
        const text = messages(inspect(root).findings);
        assert.match(text, /hollow\/ has no SKILL\.md/);
        assert.doesNotMatch(text, /hollow\/deeper\/ has no SKILL\.md/);
    });

    test("a skill deeper than the bound is reported as unsearched rather than passed over", () => {
        const root = fixture({ skip: ["skills"] });
        write(root, "skills/a/b/c/d/SKILL.md", SKILL("d", "Too deep to reach."));
        const text = messages(inspect(root).findings);
        assert.match(text, /did not search/);
        assert.match(text, /a\/b\/c\//);
    });

    test("a skill at exactly the bound is found, and reported as out of the host's reach", () => {
        const root = fixture({ skip: ["skills"] });
        write(root, "skills/a/b/c/SKILL.md", SKILL("c", "At the limit. Use at the limit."));
        // Found, not truncated — the bound is what this test guards.
        assert.equal(inspect(root).stats.skills, 1);
        assert.doesNotMatch(messages(inspect(root).findings), /did not search/);
        // But three levels down is two past what the host loads, so it fails rather than passing.
        assert.match(messages(inspect(root).findings), /sits more than 1 level below the declared root/);
    });

    test("a skill exactly one level below the declared root is what the host loads, and passes clean", () => {
        // The positive control, and the reason the rail is a depth comparison rather than a ban on
        // nesting: this is the shape `./core/skills/` and `./plugin/skills/` already ship, and the two
        // of them account for exactly the 4 the host registered before the pack path was corrected.
        const root = fixture({ skip: ["skills"] });
        write(root, "skills/greet/SKILL.md", SKILL("greet", "Greets. Use when greeting."));
        assert.equal(fails(inspect(root).findings).length, 0, messages(inspect(root).findings));
        assert.equal(inspect(root).stats.skills, 1);
    });

    test("the `./` form — a declared root that IS one skill — is not reported as out of reach", () => {
        // Depth 0, not depth 2. The rail must not fire on the form packs use to point at a single
        // skill, which was measured working and is asserted elsewhere in this file.
        const root = fixture({ skip: ["skills"], plugin: { skills: ["./solo-reach/"] } });
        write(root, "solo-reach/SKILL.md", SKILL("solo-reach", "One skill at the declared path."));
        assert.doesNotMatch(messages(inspect(root).findings), /sits more than 1 level/);
    });

    test("the one-skill `./` form keeps working, and a root that is itself a skill stays one skill", () => {
        const root = fixture({ skip: ["skills"], plugin: { skills: ["./solo/"] } });
        write(root, "solo/SKILL.md", SKILL("solo", "One skill at the declared path."));
        // A subdirectory beside it must not turn one skill into two — the root's own SKILL.md is
        // checked before the expansion for exactly this.
        fs.mkdirSync(path.join(root, "solo", "reference"), { recursive: true });
        assert.equal(fails(inspect(root).findings).length, 0, messages(inspect(root).findings));
        assert.equal(inspect(root).stats.skills, 1);
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

    test("an agent stranded outside the loadable directory is reported", () => {
        // The failure this whole pull request is about, generalised past this repository: an agent
        // file its author believes is shipping, sitting where the platform will never load it.
        // `plugin/agents/` is the shape that bit here, and it is the natural one to reach for
        // because *skills* do load from custom declared paths — the asymmetry is the trap.
        const root = fixture();
        write(root, "plugin/agents/stranded.md", AGENT("stranded", "Believes it is loading."));
        const notes = inspect(root)
            .findings.filter((f) => f.severity === "note")
            .map((f) => f.message)
            .join("\n");
        assert.match(notes, /stranded/);
        // And the loadable ones are NOT reported. Asserting only that the stranded file is named
        // passes just as happily when *every* agent is named, which is what the first version of
        // this rule did — it reported the three agents at the location it exists to point people
        // toward. A test that cannot fail on the opposite answer is not testing the answer.
        assert.doesNotMatch(notes, /worker/);
    });

    test("a stranded agent is a note, not a failure", () => {
        // Same reasoning as the undeclared-SKILL.md report beside it: a `.md` under some other
        // `agents/` may legitimately be a fixture, an example, or another host's binding, and this
        // validator cannot tell which. Reporting beats both failing and skipping.
        const root = fixture();
        write(root, "packs/demo/agents/example.md", AGENT("example", "A pack's example binding."));
        assert.equal(fails(inspect(root).findings).length, 0, messages(inspect(root).findings));
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

    test("a filesystem error is not reported as 'this plugin ships no agents'", () => {
        // Round 2 of the same finding: the probe that replaced `existsSync` caught *every* error and
        // called it absent, so EACCES on the plugin root became the benign note. Only ENOENT means
        // absent. Everything else means the question could not be answered, and answering an
        // unanswerable question with the reassuring option is the whole defect class.
        const root = fixture();
        fs.chmodSync(root, 0o600); // parent loses +x, so lstat of any child gives EACCES
        try {
            const notes = inspect(root)
                .findings.filter((f) => f.severity === "note")
                .map((f) => f.message)
                .join("\n");
            assert.doesNotMatch(notes, /ships no agents/);
        } finally {
            fs.chmodSync(root, 0o755);
        }
    });

    test("a broken agents/ symlink is a failure, not 'this plugin ships no agents'", () => {
        // Found by review. `existsSync` **follows** the link, so a broken `agents` entry answered
        // "absent" and took the note branch — GREEN, `0 agent(s)`, exit 0, over a tree that plainly
        // contains an `agents` entry and cannot use it. Absent and unusable are different verdicts
        // and only one of them is benign; deciding between them with a dereferencing call is the
        // same short-input-set defect this whole session is about, in the code written to fix it.
        const root = fixture({ skip: ["agents"] });
        fs.symlinkSync("./nowhere", path.join(root, "agents"));
        assert.notEqual(fails(inspect(root).findings).length, 0, "a broken agents/ link passed");
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

// -------------------------------------------------------------- the one-way rule between the feeds

describe("a public marketplace entry may not point into a private feed", () => {
    // The reverse direction of the maintainer's #113 ruling. The feed points at the public repository;
    // the public repository must never point back. Two reasons, and the second is the one that makes it
    // a rail rather than a preference: a public entry sourced from `portulan-internal` is a **dead
    // pointer for every stranger** — the fetch 404s on a repository they cannot see — and it leaks the
    // private feed's internal structure into a manifest anyone can read. Preventive: no such entry
    // exists today, which is exactly when a rule is cheap.
    test("a `github` source naming the private feed is refused", async () => {
        const root = fixture({
            marketplace: {
                name: "demo-market",
                owner: { name: "Someone" },
                plugins: [
                    { name: "demo", source: "./", version: "0.1.0" },
                    { name: "premium", source: { source: "github", repo: "sleepy-panda-works/portulan-internal" } },
                ],
            },
        });
        const { findings } = await inspect(root);
        assert.match(messages(findings), /private feed/i);
    });

    test("a `git-subdir` source naming the private feed is refused too — the same rule, the other spelling", async () => {
        const root = fixture({
            marketplace: {
                name: "demo-market",
                owner: { name: "Someone" },
                plugins: [
                    { name: "demo", source: "./", version: "0.1.0" },
                    {
                        name: "premium",
                        source: { source: "git-subdir", url: "https://github.com/sleepy-panda-works/portulan-internal", path: "packs" },
                    },
                ],
            },
        });
        const { findings } = await inspect(root);
        assert.match(messages(findings), /private feed/i);
    });

    test("an ordinary off-tree source is still a note, not a failure", async () => {
        // The rule is narrow on purpose. Pointing at some other public repository is a real shape the
        // platform supports and this lint cannot resolve — it stays counted-and-reported, which is the
        // answer it already gave. Widening the refusal to every off-tree source would forbid a shape
        // nobody has ruled against.
        const root = fixture({
            marketplace: {
                name: "demo-market",
                owner: { name: "Someone" },
                plugins: [
                    { name: "demo", source: "./", version: "0.1.0" },
                    { name: "other", source: { source: "github", repo: "someone-else/public-thing" } },
                ],
            },
        });
        const { findings } = await inspect(root);
        assert.doesNotMatch(messages(findings), /private feed/i);
    });

    test("this repository's own marketplace carries no such pointer", async () => {
        const { findings } = await inspect(REPO);
        assert.doesNotMatch(messages(findings), /private feed/i);
    });
});

describe("the private-feed refusal matches a name, not a substring", () => {
    test("a public repo whose name merely CONTAINS the feed's is not refused", async () => {
        // Copilot, round 5 on #117. `target.includes(feed)` false-positives on an unrelated public
        // repository — the intent is to block a pointer TO the private feed by name, and a substring
        // match blocks anything whose name happens to contain it. A false red in a rail is how the
        // whole rail gets switched off.
        const root = fixture({
            marketplace: {
                name: "demo-market",
                owner: { name: "Someone" },
                plugins: [
                    { name: "demo", source: "./", version: "0.1.0" },
                    { name: "tools", source: { source: "github", repo: "someone-else/portulan-internal-tools" } },
                ],
            },
        });
        const { findings } = await inspect(root);
        assert.doesNotMatch(messages(findings), /private feed/i);
    });

    test("the real feed is still refused, by every spelling of its name", async () => {
        for (const source of [
            { source: "github", repo: "sleepy-panda-works/portulan-internal" },
            { source: "git-subdir", url: "https://github.com/sleepy-panda-works/portulan-internal", path: "packs" },
            { source: "url", url: "git@github.com:sleepy-panda-works/portulan-internal.git" },
        ]) {
            const root = fixture({
                marketplace: {
                    name: "demo-market",
                    owner: { name: "Someone" },
                    plugins: [{ name: "demo", source: "./", version: "0.1.0" }, { name: "premium", source }],
                },
            });
            const { findings } = await inspect(root);
            assert.match(messages(findings), /private feed/i, JSON.stringify(source));
        }
    });
});

describe("the private-feed refusal cannot be bypassed by case", () => {
    test("GitHub repo names are case-insensitive, so the rail must be too", async () => {
        // Copilot, round 6 on #117 — a bypass of the rail added one round earlier. `Sleepy-Panda-Works/
        // Portulan-Internal` resolves to the same repository and would have passed a case-sensitive
        // membership test. A rail that a different capitalisation walks through is not a rail, which is
        // why this went past the review loop's two-fix-round bound rather than to triage: the precedent
        // is #105, which did the same to close a genuine fail-open.
        for (const repo of [
            "Sleepy-Panda-Works/Portulan-Internal",
            "sleepy-panda-works/PORTULAN-INTERNAL",
            "SLEEPY-PANDA-WORKS/portulan-internal",
        ]) {
            const root = fixture({
                marketplace: {
                    name: "demo-market",
                    owner: { name: "Someone" },
                    plugins: [{ name: "demo", source: "./", version: "0.1.0" }, { name: "premium", source: { source: "github", repo } }],
                },
            });
            const { findings } = await inspect(root);
            assert.match(messages(findings), /private feed/i, repo);
        }
    });

    test("and the look-alike public repo still passes, in any case", async () => {
        const root = fixture({
            marketplace: {
                name: "demo-market",
                owner: { name: "Someone" },
                plugins: [
                    { name: "demo", source: "./", version: "0.1.0" },
                    { name: "tools", source: { source: "github", repo: "Someone-Else/Portulan-Internal-Tools" } },
                ],
            },
        });
        const { findings } = await inspect(root);
        assert.doesNotMatch(messages(findings), /private feed/i);
    });
});

describe("the private-feed rail names an owner as well as a repo", () => {
    test("an unrelated PUBLIC repo with the same name is a note, not a failure", async () => {
        // Copilot, round 8. Matching the repo-name segment alone refused `someone-else/portulan-internal`,
        // contradicting this rail's own stated narrowness — other public repositories stay counted and
        // reported. The feed is an owner AND a name, so the rail matches the pair.
        const root = fixture({
            marketplace: {
                name: "demo-market",
                owner: { name: "Someone" },
                plugins: [
                    { name: "demo", source: "./", version: "0.1.0" },
                    { name: "other", source: { source: "github", repo: "someone-else/portulan-internal" } },
                ],
            },
        });
        const { findings } = await inspect(root);
        assert.doesNotMatch(messages(findings), /private feed/i);
    });

    test("the real feed is still refused, in any case and by every spelling", async () => {
        for (const source of [
            { source: "github", repo: "Sleepy-Panda-Works/Portulan-Internal" },
            { source: "git-subdir", url: "https://github.com/sleepy-panda-works/portulan-internal", path: "packs" },
            { source: "url", url: "git@github.com:sleepy-panda-works/portulan-internal.git" },
        ]) {
            const root = fixture({
                marketplace: {
                    name: "demo-market",
                    owner: { name: "Someone" },
                    plugins: [{ name: "demo", source: "./", version: "0.1.0" }, { name: "premium", source }],
                },
            });
            const { findings } = await inspect(root);
            assert.match(messages(findings), /private feed/i, JSON.stringify(source));
        }
    });
});

// ---------------------------------------------------------------------------------------------
// `packs/` is itself a plugin payload, and the feed ships it as one.
//
// The private feed's `portulan-checkpoints` entry is a `git-subdir` source rooted at `packs/`, so a
// host installs the contents of that directory and reads a manifest from `packs/.claude-plugin/`.
// Until 2026-08-09 there was no manifest there at all: the payload declared nothing, registered
// nothing, and reported `Skills (0)` on every install — #134's own measurement, whose stated cause
// (a declared path one level too high) was a different trap from the real one (no declaration).
//
// These pin the payload rather than the fixture, because the defect was in the tree and no fixture
// would have caught it. They are deliberately narrow: this file's own suite covers the general rules.

describe("the packs/ payload the private feed ships", () => {
    const PAYLOAD = path.join(REPO, "packs");
    const manifestPath = path.join(PAYLOAD, ".claude-plugin", "plugin.json");

    test("declares a plugin manifest at all — the absence that registered nothing", () => {
        assert.equal(fs.existsSync(manifestPath), true, `${manifestPath} must exist: the feed installs this directory as a plugin`);
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        assert.equal(typeof manifest.name, "string");
        assert.ok(Array.isArray(manifest.skills) && manifest.skills.length > 0, "and it must declare where its skills are");
    });

    test("every SKILL.md in the payload is within ONE level of a declared root — the host's reach", () => {
        // The host expands a declared skills path exactly one level. A skill deeper than that is
        // packaged, counted by a validator, and inert on every install — which is how three skills
        // shipped for a milestone while the inventory said zero.
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        const roots = manifest.skills.map((s) => path.resolve(PAYLOAD, s));

        const found = [];
        const walk = (dir) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.name === ".claude-plugin") continue;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(full);
                else if (entry.name === "SKILL.md") found.push(path.dirname(full));
            }
        };
        walk(PAYLOAD);
        assert.ok(found.length > 0, "the payload must ship at least one skill, or this rail is vacuous");

        for (const skillDir of found) {
            const covering = roots.find((root) => {
                const rel = path.relative(root, skillDir);
                return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
            });
            assert.ok(covering, `${path.relative(PAYLOAD, skillDir)} is under no declared skills path`);
            const depth = path.relative(covering, skillDir).split(path.sep).length;
            assert.equal(depth, 1, `${path.relative(PAYLOAD, skillDir)} sits ${depth} levels below its declared root — the host reaches one`);
        }
    });

    test("the repository's own manifest declares the same skills from ITS root, not this one", () => {
        // Two manifests, two roots, and the paths differ by exactly the prefix the roots differ by.
        // Asserted so a later edit cannot quietly make one a copy of the other.
        const repoManifest = JSON.parse(fs.readFileSync(path.join(REPO, ".claude-plugin", "plugin.json"), "utf8"));
        const payloadManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        for (const declared of payloadManifest.skills) {
            const fromRepoRoot = `./${path.join("packs", declared)}/`.replace(/\/+$/, "/");
            assert.ok(
                repoManifest.skills.some((s) => path.resolve(REPO, s) === path.resolve(REPO, fromRepoRoot)),
                `the repository manifest should declare ${fromRepoRoot} for the payload's ${declared}`,
            );
        }
    });
});

// The RELAXATION's own forced reds. `--payload` makes a missing marketplace.json a counted note rather
// than a failure, and `../.portulan/gate-map.md` holds that relaxing a check is the case to scrutinise
// hardest — so the opt-in, its boundary, and its failure modes are asserted rather than described.
// Added at the pre-commit checkpoint, which observed that the mode had shipped with no test at all.

describe("payload roots — the opt-in relaxation", () => {
    const payloadTree = () => {
        const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "portulan-payload-"));
        // Registered with the suite's own scratch list, or every run leaves a directory behind — a
        // real leak, and the one thing in this file that grows without bound. The helper above does
        // this; this one was written beside it and did not. (Copilot, on the round reviewing it.)
        SCRATCH.push(root);
        fs.mkdirSync(path.join(root, ".claude-plugin"), { recursive: true });
        fs.writeFileSync(
            path.join(root, ".claude-plugin", "plugin.json"),
            JSON.stringify({ name: "a-payload", version: "0.1.0", skills: ["./skills/"] }),
        );
        fs.mkdirSync(path.join(root, "skills", "one"), { recursive: true });
        fs.writeFileSync(path.join(root, "skills", "one", "SKILL.md"), "---\nname: one\ndescription: A skill that exists so this tree is not empty.\n---\n\n# one\n");
        return root;
    };

    test("a missing marketplace.json is a counted note under --payload, and a FAILURE without it", async () => {
        const root = payloadTree();
        const relaxed = inspect(root, { payload: true });
        assert.equal(relaxed.findings.filter((f) => f.severity === "fail").length, 0, messages(relaxed.findings));
        // Read the findings directly: `messages()` surfaces failures only, so asserting the NOTE
        // through it passed vacuously in both directions — caught by the note test failing on an
        // empty string, which is the useful accident.
        const owed = (f) => f.some((x) => /none is owed/.test(x.message));
        assert.equal(owed(relaxed.findings), true, "the exemption must SAY it is one");
        assert.equal(relaxed.stats.unverifiable >= 1, true, "the gap is COUNTED, not merely worded");

        // The opt-in invariant: the same tree, unmarked, still fails. If this ever passes, the mode
        // stopped being an opt-in and became an inference from an absent file.
        const strict = inspect(root);
        assert.match(messages(strict.findings), /marketplace\.json is missing/);
        assert.equal(strict.findings.filter((f) => f.severity === "fail").length > 0, true);
    });

    test("a payload root that HAS a marketplace.json is still fully checked", async () => {
        const root = payloadTree();
        fs.writeFileSync(path.join(root, ".claude-plugin", "marketplace.json"), JSON.stringify({ name: "m" }));
        const { findings } = inspect(root, { payload: true });
        // Present-but-invalid must not ride the exemption: the note is for ABSENCE only.
        assert.equal(findings.some((f) => /none is owed/.test(f.message)), false);
        assert.equal(findings.filter((f) => f.severity === "fail").length > 0, true, messages(findings));
    });

    test("a DANGLING marketplace.json symlink is not an absence — unusable and absent differ", async () => {
        const root = payloadTree();
        fs.symlinkSync(path.join(root, "nowhere.json"), path.join(root, ".claude-plugin", "marketplace.json"));
        const { findings } = inspect(root, { payload: true });
        assert.equal(findings.some((f) => /none is owed/.test(f.message)), false, "a broken link is not `no marketplace`");
        assert.equal(findings.filter((f) => f.severity === "fail").length > 0, true, messages(findings));
    });

    test("an unknown option is could-not-run, never a verdict", async () => {
        assert.equal(await run(["--nonsense", REPO], { quiet: true }), 2);
    });
});

test("a marketplace.json that cannot be EXAMINED fails, payload or not — the third verdict", () => {
    // ENOENT is the only absence. An unreadable directory makes `lstatSync` answer EACCES, and the
    // first cut fell through to `manifest()`, whose `existsSync` also cannot stat it and calls the
    // file MISSING — the conflation this block exists to prevent, one branch further out.
    // (Copilot, final round on #188.) Skipped as root, where permissions do not bite.
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "portulan-unexaminable-"));
    SCRATCH.push(root);
    const meta = path.join(root, ".claude-plugin");
    fs.mkdirSync(meta, { recursive: true });
    fs.writeFileSync(path.join(meta, "plugin.json"), JSON.stringify({ name: "a-payload", version: "0.1.0" }));
    fs.writeFileSync(path.join(meta, "marketplace.json"), "{}");
    fs.chmodSync(meta, 0o000);
    try {
        if (fs.existsSync(path.join(meta, "marketplace.json"))) return; // running as root: the probe cannot bite
        for (const opts of [{ payload: true }, {}]) {
            const { findings } = inspect(root, opts);
            assert.equal(findings.some((f) => /could not be examined/.test(f.message)), true, JSON.stringify(opts));
            assert.equal(findings.some((f) => /none is owed/.test(f.message)), false, "an unusable file is not an absence");
        }
    } finally {
        fs.chmodSync(meta, 0o755);
    }
});

// ===============================================================================================
// compose — the workspace's `packs` array and plugin.json's `skills` are one fact
// ===============================================================================================
//
// Row 7 clause (b) asks for PARITY: a composed pack's skill invoked the way a core skill is, because
// the workspace composed it. Registration is a property of plugin.json alone — measured 2026-08-09
// on Claude Code 2.1.226 by deleting the `packs` key outright and reinstalling, which left the host's
// inventory identical — so until this check nothing made composition load-bearing.
//
// Written red first, both directions, and the tree's real manifests were forced red both ways before
// these existed: a check nobody has seen fail is a check nobody has seen work.

/** A plugin bundle that both composes a pack and registers it — the aligned state. */
function composed({ packs = ["rituals/checkpoints"], declare = true, governing = true } = {}) {
    const root = fixture({
        plugin: declare
            ? { skills: ["./skills/", "./packs/rituals/checkpoints/skills/"] }
            : { skills: ["./skills/"] },
    });
    write(
        root,
        "packs/rituals/checkpoints/skills/pre-commit/SKILL.md",
        SKILL("pre-commit", "Grades a finished diff. Use before committing full-lane work."),
    );
    write(root, "packs/rituals/checkpoints/pack.json", JSON.stringify({ name: "checkpoints", category: "rituals" }));
    if (governing) {
        write(root, ".portulan/workspace.json", JSON.stringify({ name: "demo", packs }, null, 2));
    }
    return root;
}

describe("compose — composition and registration are pinned to each other", () => {
    test("aligned is green: the workspace composes it and the manifest registers it", () => {
        const { findings } = inspect(composed());
        assert.equal(fails(findings).filter((f) => f.check === "compose").length, 0, messages(findings));
    });

    test("composed but undeclared fails — the skill ships, counts, and cannot be invoked", () => {
        const { findings } = inspect(composed({ declare: false }));
        const bad = fails(findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, messages(findings));
        assert.match(bad[0].message, /no plugin\.json `skills` path reaches it/);
        // The repair is in the message, at the depth the HOST expands — not the skill's own directory.
        assert.match(bad[0].message, /Declare \.\/packs\/rituals\/checkpoints\/skills\/$/);
    });

    test("declared but uncomposed fails — the host would load a layer nobody asked for", () => {
        const { findings } = inspect(composed({ packs: [] }));
        const bad = fails(findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, messages(findings));
        assert.match(bad[0].message, /belongs to no pack .* composes/);
    });

    test("an absent `packs` key is the same defect as an empty one — not an exemption", () => {
        const root = composed();
        const manifest = path.join(root, ".portulan", "workspace.json");
        const parsed = JSON.parse(fs.readFileSync(manifest, "utf8"));
        delete parsed.packs;
        fs.writeFileSync(manifest, JSON.stringify(parsed, null, 2));
        const bad = fails(inspect(root).findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, "a manifest composing nothing registers nothing from ./packs/");
    });

    test("a bundle with no governing workspace composes nothing, and that is not a finding", () => {
        const { findings } = inspect(composed({ governing: false, declare: false }));
        assert.equal(findings.filter((f) => f.check === "compose").length, 0);
    });

    test("a governing workspace that cannot be READ is not one that composes nothing", () => {
        const root = composed();
        fs.writeFileSync(path.join(root, ".portulan", "workspace.json"), "{ not json");
        const bad = fails(inspect(root).findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1);
        assert.match(bad[0].message, /this run establishes nothing about it/);
    });

    test("a composed pack missing from the bundle is a NOTE — `doctor` owns that verdict", () => {
        const { findings } = inspect(composed({ packs: ["rituals/checkpoints", "stacks/python"] }));
        const composeFindings = findings.filter((f) => f.check === "compose");
        assert.equal(fails(composeFindings).length, 0, messages(findings));
        assert.equal(composeFindings.length, 1);
        assert.equal(composeFindings[0].severity, "note");
        assert.match(composeFindings[0].message, /does not resolve under \.\/packs\//);
    });

    test("skills OUTSIDE ./packs/ are none of this check's business", () => {
        // `./skills/greet/` is core-shaped: registered, composed by nothing, and correct.
        const { findings } = inspect(composed());
        assert.equal(
            findings.some((f) => f.check === "compose" && /greet/.test(f.message)),
            false,
            "only the packs tree is subject to the composition rule",
        );
    });
});

test("compose refuses a composed pack that is a symlink out of the bundle", () => {
    // Lexical containment is not containment: `escapes()` alone passed a `packs/<name>` whose target
    // was anywhere on disk, and `statSync`/`readdirSync` follow it. Copilot, #195.
    const root = composed();
    const outside = scratch();
    write(outside, "skills/smuggled/SKILL.md", SKILL("smuggled", "Not part of this bundle at all."));
    const link = path.join(root, "packs", "rituals", "elsewhere");
    fs.rmSync(path.join(root, "packs", "rituals", "checkpoints"), { recursive: true, force: true });
    fs.symlinkSync(outside, link);
    const manifest = path.join(root, ".portulan", "workspace.json");
    fs.writeFileSync(manifest, JSON.stringify({ name: "demo", packs: ["rituals/elsewhere"] }, null, 2));

    const bad = fails(inspect(root).findings).filter((f) => f.check === "compose");
    assert.equal(bad.some((f) => /resolves outside \.\/packs\//.test(f.message)), true, messages(inspect(root).findings));
    // And it must say nothing was walked rather than going quiet — refusing is not the same as passing.
    assert.match(bad.find((f) => /resolves outside/.test(f.message)).message, /composition is unchecked for it/);
});

describe("compose fails closed on what it could not evaluate", () => {
    test("a `packs` entry naming a path outside ./packs/ is named, never skipped", () => {
        const root = composed({ packs: ["rituals/checkpoints", "../../etc"] });
        const bad = fails(inspect(root).findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, messages(inspect(root).findings));
        assert.match(bad[0].message, /nothing was walked for it, so composition is unchecked/);
    });

    test("a `packs` entry inside the bundle but OUTSIDE ./packs/ is refused, not walked", () => {
        // `../plugin` stays inside the plugin root and escapes `./packs/`. The first cut compared
        // against the root, so this passed the guard and was walked as though it were a composed
        // pack. Copilot, #195 round 2 — the hole the previous round's fix left one directory up.
        const root = composed({ packs: ["rituals/checkpoints", "../../plugin"] });
        write(root, "plugin/skills/smuggled/SKILL.md", SKILL("smuggled", "Not a pack, and not composed."));
        const bad = fails(inspect(root).findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, messages(inspect(root).findings));
        assert.match(bad[0].message, /names a path outside \.\/packs\//);
        // And it must not be mistaken for a pack that is merely missing — that is a note, not a failure.
        assert.equal(inspect(root).findings.some((f) => f.severity === "note" && /does not resolve under/.test(f.message)), false);
    });

    test("a `packs` entry that is not a non-empty string is named", () => {
        const root = composed({ packs: ["rituals/checkpoints", 42] });
        const bad = fails(inspect(root).findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, messages(inspect(root).findings));
        assert.match(bad[0].message, /not a non-empty string/);
    });

    test("a governing manifest that parses to an ARRAY fails closed — parsing is not reading", () => {
        const root = composed();
        fs.writeFileSync(path.join(root, ".portulan", "workspace.json"), JSON.stringify(["packs"]));
        const bad = fails(inspect(root).findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, messages(inspect(root).findings));
        assert.match(bad[0].message, /is not a JSON object \(an array\)/);
        assert.match(bad[0].message, /parity with the declared skills is unchecked/);
    });

    test("...and one that parses to a string fails the same way", () => {
        const root = composed();
        fs.writeFileSync(path.join(root, ".portulan", "workspace.json"), JSON.stringify("nope"));
        const bad = fails(inspect(root).findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, messages(inspect(root).findings));
        assert.match(bad[0].message, /is not a JSON object \(string\)/);
    });
});
