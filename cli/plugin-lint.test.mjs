// Tests for `plugin-lint` — the packaging validator.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PluginLintError, inspect, run, parseFrontmatter } from "./plugin-lint.mjs";

// Hermetic host: the tools read its installed-plugin record unasked; a case that wants a host passes `env:`.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

// One exit handler for every scratch directory: one per directory passes node's default of ten listeners.
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

// Fixtures are built at run time: `json.sh` parses every tracked .json, so a malformed one cannot be committed.
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

const fails = (findings) => findings.filter((f) => f.severity === "fail");
const messages = (findings) => fails(findings).map((f) => f.message).join("\n");

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
        // The host falls back to the git commit SHA when no version is declared.
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
        // Stricter than `claude plugin validate`, which only warns on an empty plugins array.
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
        // Claude Code 2.1.215: an `agents` key suppresses the ./agents/ scan, so a resolving path loads nothing.
        const resolves = fixture({ plugin: { agents: ["./agents/worker.md"] } });
        assert.match(messages(inspect(resolves).findings), /agents/);
        const dangling = fixture({ plugin: { agents: ["./agents/ghost.md"] } });
        assert.match(messages(inspect(dangling).findings), /agents/);
    });

    test("a symlink out of the plugin root is a failure, not merely a lexical pass", () => {
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
        // The host dereferences in-marketplace symlinks, so refusing them would fail a supported layout.
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

    test("a pack-shaped tree resolves skills nested below the declared root — and says the host will not", () => {
        const root = fixture({ skip: ["skills"] });
        write(root, "skills/rituals-demo/skills/greet/SKILL.md", SKILL("greet", "Greets. Use when greeting."));
        assert.equal(inspect(root).stats.skills, 1);
        assert.doesNotMatch(messages(inspect(root).findings), /has no SKILL\.md/);

        // Claude Code 2.1.224 expands a declared skills root one level, so a deeper skill ships inert.
        const text = messages(inspect(root).findings);
        assert.match(text, /sits more than 1 level below the declared root/);
        assert.match(text, /Declare skills\/rituals-demo\/skills\/ instead/);
    });

    test("a directory under the declared root holding no skill at any depth still fails", () => {
        const root = fixture();
        fs.mkdirSync(path.join(root, "skills", "hollow", "deeper"), { recursive: true });
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

        assert.doesNotMatch(text, /a\/ has no SKILL\.md/);
        assert.match(text, /did not finish and find nothing/);
    });

    test("an UNREADABLE branch says so, and is never reported as barren", () => {
        const root = fixture({ skip: ["skills"] });
        write(root, "skills/reachable/SKILL.md", SKILL("reachable", "Findable. Use when findable."));
        const dark = path.join(root, "skills", "locked");
        fs.mkdirSync(dark, { recursive: true });
        fs.chmodSync(dark, 0o000);
        try {
            let probed;
            try {
                probed = fs.readdirSync(dark).length >= 0;
            } catch {
                probed = false;
            }
            assert.ok(
                !probed || process.getuid?.() === 0,
                "a non-root run must not be able to read a 0o000 directory — the probe did not bite",
            );
            if (probed) return; // running as root: the branch under test is unreachable here

            const text = messages(inspect(root).findings);
            assert.match(text, /locked\/ could not be read/, text);
            assert.match(text, /could-not-look is not nothing-there/);
            assert.doesNotMatch(text, /locked\/ has no SKILL\.md/);
            assert.doesNotMatch(text, /locked\/ has subdirectories this validator did not search/);
            assert.equal(inspect(root).stats.skills, 1);
        } finally {
            fs.chmodSync(dark, 0o755);
        }
    });

    test("a skill at exactly the bound is found, and reported as out of the host's reach", () => {
        const root = fixture({ skip: ["skills"] });
        write(root, "skills/a/b/c/SKILL.md", SKILL("c", "At the limit. Use at the limit."));
        assert.equal(inspect(root).stats.skills, 1);
        assert.doesNotMatch(messages(inspect(root).findings), /did not search/);
        assert.match(messages(inspect(root).findings), /sits more than 1 level below the declared root/);
    });

    test("a skill exactly one level below the declared root is what the host loads, and passes clean", () => {
        const root = fixture({ skip: ["skills"] });
        write(root, "skills/greet/SKILL.md", SKILL("greet", "Greets. Use when greeting."));
        assert.equal(fails(inspect(root).findings).length, 0, messages(inspect(root).findings));
        assert.equal(inspect(root).stats.skills, 1);
    });

    test("the `./` form — a declared root that IS one skill — is not reported as out of reach", () => {
        const root = fixture({ skip: ["skills"], plugin: { skills: ["./solo-reach/"] } });
        write(root, "solo-reach/SKILL.md", SKILL("solo-reach", "One skill at the declared path."));
        assert.doesNotMatch(messages(inspect(root).findings), /sits more than 1 level/);
    });

    test("the one-skill `./` form keeps working, and a root that is itself a skill stays one skill", () => {
        const root = fixture({ skip: ["skills"], plugin: { skills: ["./solo/"] } });
        write(root, "solo/SKILL.md", SKILL("solo", "One skill at the declared path."));
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
        // Stricter than the host: with no `name`, a `./`-form skill takes its versioned install directory's name.
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
        const root = fixture();
        write(
            root,
            "skills/greet/SKILL.md",
            "---\nname: greet\ndescription: >-\n  Greets people warmly.\n  Use when greeting.\n---\n\nBody.\n",
        );
        assert.equal(fails(inspect(root).findings).length, 0, messages(inspect(root).findings));
    });

    test("a skill outside every declared path is not silently shipped", () => {
        // `skills` on a marketplace-root entry replaces the default scan, so an undeclared skill ships nothing.
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
        const root = fixture({ skip: ["agents"] });
        assert.equal(fails(inspect(root).findings).length, 0, messages(inspect(root).findings));
        assert.equal(inspect(root).stats.agents, 0);
    });

    test("this repository's three personas are found and checked", () => {
        assert.equal(inspect(REPO).stats.agents, 3);
    });

    test("an agent stranded outside the loadable directory is reported", () => {
        const root = fixture();
        write(root, "plugin/agents/stranded.md", AGENT("stranded", "Believes it is loading."));
        const notes = inspect(root)
            .findings.filter((f) => f.severity === "note")
            .map((f) => f.message)
            .join("\n");
        assert.match(notes, /stranded/);
        assert.doesNotMatch(notes, /worker/);
    });

    test("a stranded agent is a note, not a failure", () => {
        const root = fixture();
        write(root, "packs/demo/agents/example.md", AGENT("example", "A pack's example binding."));
        assert.equal(fails(inspect(root).findings).length, 0, messages(inspect(root).findings));
    });

    test("this repository's agents/ is a real directory, not a symlink", () => {
        // This tree's rule, not the lint's: the host accepts a symlinked agents/, so other plugins may ship one.
        assert.equal(fs.lstatSync(path.join(REPO, "agents")).isSymbolicLink(), false);
    });

    test("a filesystem error is not reported as 'this plugin ships no agents'", () => {
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
        const root = fixture({ skip: ["agents"] });
        fs.symlinkSync("./nowhere", path.join(root, "agents"));
        assert.notEqual(fails(inspect(root).findings).length, 0, "a broken agents/ link passed");
    });

    test("an agent reached by a symlink is checked, not silently skipped", () => {
        // A `Dirent` for a symlink is neither a file nor a directory, so an `isFile()` filter drops it.
        const root = fixture();
        fs.symlinkSync("./nowhere.md", path.join(root, "agents", "linked.md"));
        assert.notEqual(fails(inspect(root).findings).length, 0, "a symlinked agent was skipped");
    });
});

describe("failing closed", () => {
    test("an unreadable SKILL.md is a failure, not an exit 2", () => {
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
    test("a `github` source naming the private feed is refused", async () => {
        const root = fixture({
            marketplace: {
                name: "demo-market",
                owner: { name: "Someone" },
                plugins: [
                    { name: "demo", source: "./", version: "0.1.0" },
                    { name: "premium", source: { source: "github", repo: "sleepy-panda-srl/portulan-internal" } },
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
                        source: { source: "git-subdir", url: "https://github.com/sleepy-panda-srl/portulan-internal", path: "packs" },
                    },
                ],
            },
        });
        const { findings } = await inspect(root);
        assert.match(messages(findings), /private feed/i);
    });

    test("an ordinary off-tree source is still a note, not a failure", async () => {
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
            { source: "github", repo: "sleepy-panda-srl/portulan-internal" },
            { source: "git-subdir", url: "https://github.com/sleepy-panda-srl/portulan-internal", path: "packs" },
            { source: "url", url: "git@github.com:sleepy-panda-srl/portulan-internal.git" },
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
        for (const repo of [
            "Sleepy-Panda-Srl/Portulan-Internal",
            "sleepy-panda-srl/PORTULAN-INTERNAL",
            "SLEEPY-PANDA-SRL/portulan-internal",
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
            { source: "github", repo: "Sleepy-Panda-Srl/Portulan-Internal" },
            { source: "git-subdir", url: "https://github.com/sleepy-panda-srl/portulan-internal", path: "packs" },
            { source: "url", url: "git@github.com:sleepy-panda-srl/portulan-internal.git" },
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

// ------------------------------------------------------------- `packs/` is itself a plugin payload

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

describe("payload roots — the opt-in relaxation", () => {
    const payloadTree = () => {
        const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "portulan-payload-"));
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
        // `messages()` holds failures only, so a note is read from the findings themselves.
        const owed = (f) => f.some((x) => /none is owed/.test(x.message));
        assert.equal(owed(relaxed.findings), true, "the exemption must SAY it is one");
        assert.equal(relaxed.stats.unverifiable >= 1, true, "the gap is COUNTED, not merely worded");

        const strict = inspect(root);
        assert.match(messages(strict.findings), /marketplace\.json is missing/);
        assert.equal(strict.findings.filter((f) => f.severity === "fail").length > 0, true);
    });

    test("a payload root that HAS a marketplace.json is still fully checked", async () => {
        const root = payloadTree();
        fs.writeFileSync(path.join(root, ".claude-plugin", "marketplace.json"), JSON.stringify({ name: "m" }));
        const { findings } = inspect(root, { payload: true });
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
// Claude Code 2.1.226 registers from plugin.json alone: deleting the `packs` key left its inventory unchanged.

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
        const { findings } = inspect(composed());
        assert.equal(
            findings.some((f) => f.check === "compose" && /greet/.test(f.message)),
            false,
            "only the packs tree is subject to the composition rule",
        );
    });

    // ---- the DECLARATION side: what each composed pack's pack.json nominates ----------------------

    function nominating({ declare = true, skills = ["skills/"], populate = true } = {}) {
        const root = fixture({
            plugin: declare
                ? { skills: ["./skills/", "./packs/rituals/checkpoints/skills/"] }
                : { skills: ["./skills/"] },
        });
        if (populate) {
            write(
                root,
                "packs/rituals/checkpoints/skills/pre-commit/SKILL.md",
                SKILL("pre-commit", "Grades a finished diff. Use before committing full-lane work."),
            );
        }
        write(
            root,
            "packs/rituals/checkpoints/pack.json",
            JSON.stringify({ name: "checkpoints", category: "rituals", contributes: { skills } }),
        );
        write(root, ".portulan/workspace.json", JSON.stringify({ name: "demo", packs: ["rituals/checkpoints"] }, null, 2));
        return root;
    }

    test("a nominated root the manifest declares is green", () => {
        const { findings } = inspect(nominating());
        assert.equal(fails(findings).filter((f) => f.check === "compose").length, 0, messages(findings));
    });

    test("a nominated root the manifest does not declare fails, and names the root to declare", () => {
        const bad = fails(inspect(nominating({ declare: false })).findings).filter((f) => f.check === "compose");
        const nominated = bad.filter((f) => /nominates/.test(f.message));
        assert.equal(nominated.length, 1, messages(inspect(nominating({ declare: false })).findings));
        assert.match(nominated[0].message, /Declare \.\/packs\/rituals\/checkpoints\/skills\/$/);
    });

    test("a nominated root that does not EXIST fails — the walk finds nothing and would have been silent", () => {
        const root = nominating({ declare: false, populate: false });
        const bad = fails(inspect(root).findings).filter((f) => f.check === "compose" && /nominates/.test(f.message));
        assert.equal(bad.length, 1, messages(inspect(root).findings));
    });

    test("a nominated root that exists and holds no skill is a NOTE — there is nothing to register", () => {
        const root = nominating({ declare: false, populate: false });
        fs.mkdirSync(path.join(root, "packs", "rituals", "checkpoints", "skills"), { recursive: true });
        const composeFindings = inspect(root).findings.filter((f) => f.check === "compose" && /nominates/.test(f.message));
        assert.equal(composeFindings.length, 1);
        assert.equal(composeFindings[0].severity, "note", messages(inspect(root).findings));
    });

    test("a pack with NO pack.json is skipped — this check does not invent a second answer to `what is a pack`", () => {
        const root = composed();
        fs.rmSync(path.join(root, "packs", "rituals", "checkpoints", "pack.json"));
        const bad = fails(inspect(root).findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 0, messages(inspect(root).findings));
    });

    test("a pack.json that will not PARSE says so, and does not blame the read", () => {
        const root = composed();
        fs.writeFileSync(path.join(root, "packs", "rituals", "checkpoints", "pack.json"), "{ not json");
        const bad = fails(inspect(root).findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, messages(inspect(root).findings));
        assert.match(bad[0].message, /pack\.json does not parse as JSON/);
        assert.doesNotMatch(bad[0].message, /could not be read/);
    });

    test("`contributes.skills` of the wrong type is could-not-run for the whole declaration side", () => {
        const root = nominating({ skills: "skills/" });
        const bad = fails(inspect(root).findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, messages(inspect(root).findings));
        assert.match(bad[0].message, /registrable set could not be derived/);
    });

    test("a manifest naming each skill individually satisfies the nomination — that registers them too", () => {
        const root = fixture({ plugin: { skills: ["./skills/", "./packs/rituals/checkpoints/skills/pre-commit/"] } });
        write(
            root,
            "packs/rituals/checkpoints/skills/pre-commit/SKILL.md",
            SKILL("pre-commit", "Grades a finished diff. Use before committing full-lane work."),
        );
        write(
            root,
            "packs/rituals/checkpoints/pack.json",
            JSON.stringify({ name: "checkpoints", category: "rituals", contributes: { skills: ["skills/"] } }),
        );
        write(root, ".portulan/workspace.json", JSON.stringify({ name: "demo", packs: ["rituals/checkpoints"] }, null, 2));
        const bad = fails(inspect(root).findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 0, messages(inspect(root).findings));
    });
});

test("compose refuses a composed pack that is a symlink out of the bundle", () => {
    const root = composed();
    const outside = scratch();
    write(outside, "skills/smuggled/SKILL.md", SKILL("smuggled", "Not part of this bundle at all."));
    const link = path.join(root, "packs", "rituals", "elsewhere");
    fs.rmSync(path.join(root, "packs", "rituals", "checkpoints"), { recursive: true, force: true });
    fs.symlinkSync(outside, link);
    const manifest = path.join(root, ".portulan", "workspace.json");
    fs.writeFileSync(manifest, JSON.stringify({ name: "demo", packs: ["rituals/elsewhere"] }, null, 2));

    const { findings } = inspect(root);
    const bad = fails(findings).filter((f) => f.check === "compose");
    assert.equal(bad.some((f) => /resolves outside \.\/packs\//.test(f.message)), true, messages(findings));
    assert.match(bad.find((f) => /resolves outside/.test(f.message)).message, /composition is unchecked for it/);
});

describe("compose fails closed on what it could not evaluate", () => {
    test("a `packs` entry naming a path outside ./packs/ is named, never skipped", () => {
        const root = composed({ packs: ["rituals/checkpoints", "../../etc"] });
        const { findings } = inspect(root);
        const bad = fails(findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, messages(findings));
        assert.match(bad[0].message, /nothing was walked for it, so composition is unchecked/);
    });

    test("a `packs` entry inside the bundle but OUTSIDE ./packs/ is refused, not walked", () => {
        const root = composed({ packs: ["rituals/checkpoints", "../../plugin"] });
        write(root, "plugin/skills/smuggled/SKILL.md", SKILL("smuggled", "Not a pack, and not composed."));
        const { findings } = inspect(root);
        const bad = fails(findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, messages(findings));
        assert.match(bad[0].message, /names a path outside \.\/packs\//);
        assert.equal(findings.some((f) => f.severity === "note" && /does not resolve under/.test(f.message)), false);
    });

    test("a `packs` entry that is not a non-empty string is named", () => {
        const root = composed({ packs: ["rituals/checkpoints", 42] });
        const { findings } = inspect(root);
        const bad = fails(findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, messages(findings));
        assert.match(bad[0].message, /not a non-empty string/);
    });

    test("a governing manifest that parses to an ARRAY fails closed — parsing is not reading", () => {
        const root = composed();
        fs.writeFileSync(path.join(root, ".portulan", "workspace.json"), JSON.stringify(["packs"]));
        const { findings } = inspect(root);
        const bad = fails(findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, messages(findings));
        assert.match(bad[0].message, /is not a JSON object \(an array\)/);
        assert.match(bad[0].message, /parity with the declared skills is unchecked/);
    });

    test("a governing manifest that parses to JSON `null` fails closed — the sentinel collision", () => {
        const root = composed();
        fs.writeFileSync(path.join(root, ".portulan", "workspace.json"), "null");
        const { findings } = inspect(root);
        const bad = fails(findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, messages(findings));
        assert.match(bad[0].message, /is not a JSON object \(null\)/);
    });

    test("a `packs` of null is reported as null, not as an object", () => {
        const root = composed();
        fs.writeFileSync(path.join(root, ".portulan", "workspace.json"), JSON.stringify({ name: "demo", packs: null }, null, 2));
        const { findings } = inspect(root);
        const bad = fails(findings).filter((f) => f.check === "compose");
        assert.equal(bad.some((f) => /declares `packs` as null rather than an array/.test(f.message)), true, messages(findings));
    });

    test("...and one that parses to a string fails the same way", () => {
        const root = composed();
        fs.writeFileSync(path.join(root, ".portulan", "workspace.json"), JSON.stringify("nope"));
        const { findings } = inspect(root);
        const bad = fails(findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 1, messages(findings));
        assert.match(bad[0].message, /is not a JSON object \(string\)/);
    });
});

test("a `packs` value that is not an array fails closed — present is not absent", () => {
    const root = composed();
    const manifest = path.join(root, ".portulan", "workspace.json");
    fs.writeFileSync(manifest, JSON.stringify({ name: "demo", packs: "rituals/checkpoints" }, null, 2));
    const { findings } = inspect(root);
    const bad = fails(findings).filter((f) => f.check === "compose");
    assert.equal(bad.some((f) => /declares `packs` as string rather than an array/.test(f.message)), true, messages(findings));
});

test("a composed pack that exists but is a FILE is a NOTE — seen, and doctor's verdict", () => {
    const root = composed({ packs: ["rituals/checkpoints", "rituals/afile"] });
    write(root, "packs/rituals/afile", "not a pack\n");
    const { findings } = inspect(root);
    const compose = findings.filter((f) => f.check === "compose");
    assert.equal(fails(compose).length, 0, messages(findings));
    assert.equal(compose.length, 1);
    assert.equal(compose[0].severity, "note");
    assert.match(compose[0].message, /is not a directory/);
    assert.match(compose[0].message, /`doctor` owns that verdict/);
});

describe("compose cannot go quiet on what the walk could not see", () => {
    test("a SYMLINKED SKILL.md in a composed, undeclared pack is named — the walks disagreed", () => {
        const root = composed({ declare: false });
        const real = path.join(root, "skills", "greet", "SKILL.md");
        const link = path.join(root, "packs", "rituals", "checkpoints", "skills", "linked");
        fs.mkdirSync(link, { recursive: true });
        fs.symlinkSync(real, path.join(link, "SKILL.md"));
        const { findings } = inspect(root);
        const bad = fails(findings).filter((f) => f.check === "compose");
        assert.equal(bad.some((f) => /SKILL\.md that is a SYMLINK/.test(f.message)), true, messages(findings));
        assert.match(bad.find((f) => /SYMLINK/.test(f.message)).message, /Composition is unchecked below that point/);
    });

    test("a composed pack dir that is a symlink INSIDE ./packs/ does not read as undeclared", () => {
        const root = composed();
        const realDir = path.join(root, "packs", "rituals", "checkpoints");
        const alias = path.join(root, "packs", "rituals", "alias");
        fs.symlinkSync(realDir, alias);
        const manifest = path.join(root, ".portulan", "workspace.json");
        fs.writeFileSync(manifest, JSON.stringify({ name: "demo", packs: ["rituals/alias"] }, null, 2));
        const { findings } = inspect(root);
        const bad = fails(findings).filter((f) => f.check === "compose");
        assert.equal(bad.length, 0, messages(findings));
    });

    test("an UNREADABLE subtree under a composed pack is named, not swallowed", () => {
        const root = composed({ declare: false });
        const dark = path.join(root, "packs", "rituals", "checkpoints", "skills");
        fs.chmodSync(dark, 0o000);
        try {
            if (fs.readdirSync(dark).length >= 0) return; // running as root: the probe cannot bite
        } catch {
            const bad = fails(inspect(root).findings).filter((f) => f.check === "compose");
            assert.equal(bad.some((f) => /could not be read/.test(f.message)), true);
            assert.match(bad.find((f) => /could not be read/.test(f.message)).message, /Composition is unchecked below that point/);
        } finally {
            fs.chmodSync(dark, 0o755);
        }
    });
});

// ---------------------------------------------------------------- the persona ↔ binding correspondence

describe("a shipped persona and its host binding must correspond", () => {
    const PERSONA = (name) =>
        ["---", `name: ${name}`, "description: A role.", "tools: [read]", "---", "", `# Persona — ${name}`, "", "## Charter", "It does one thing.", ""].join("\n");

    function withPersonas(personas, agents) {
        const root = fixture({ skip: ["agents"] });
        for (const name of personas) write(root, `core/personas/${name}.md`, PERSONA(name));
        write(root, "core/personas/README.md", "# core/personas/\n\nThe contract.\n");
        for (const [file, name] of Object.entries(agents)) write(root, `agents/${file}.md`, AGENT(name, "Does work. Delegate work to it."));
        return root;
    }

    const fails = (findings) => findings.filter((f) => f.severity === "fail");
    const said = (findings) => findings.map((f) => f.message).join("\n");

    test("a persona bound by a matching agent file is clean", () => {
        const { findings } = inspect(withPersonas(["worker"], { worker: "worker" }));
        assert.equal(fails(findings).length, 0, said(findings));
    });

    test("a persona with no binding FAILS — doctrine the host never registers", () => {
        const { findings } = inspect(withPersonas(["worker", "unbound"], { worker: "worker" }));
        assert.equal(fails(findings).length, 1, said(findings));
        assert.match(said(findings), /core\/personas\/unbound\.md has no binding/);
    });

    test("a binding naming no persona FAILS — a host file that outlived its charter", () => {
        const { findings } = inspect(withPersonas(["worker"], { worker: "worker", ghost: "ghost" }));
        assert.equal(fails(findings).length, 1, said(findings));
        assert.match(said(findings), /agents\/ghost\.md binds no persona/);
    });

    test("a binding whose declared name is not its filename FAILS — the host keys on the field", () => {
        const { findings } = inspect(withPersonas(["worker"], { worker: "someone-else" }));
        assert.match(said(findings), /disagree about which role this file registers/);
    });

    test("a plugin shipping no core personas is untouched by this check", () => {
        const { findings } = inspect(fixture());
        assert.equal(fails(findings).length, 0, said(findings));
    });

    test("this repository's own three personas are each bound", () => {
        const { findings } = inspect(REPO);
        assert.equal(fails(findings).filter((f) => /persona|binds no/.test(f.message)).length, 0, said(findings));
    });
});

describe("an unreadable agents directory is not evidence that personas are unbound", () => {
    const PERSONA = (name) =>
        ["---", `name: ${name}`, "description: A role.", "tools: [read]", "---", "", `# Persona — ${name}`, "", "## Charter", "It does one thing.", ""].join("\n");
    const fails = (findings) => findings.filter((f) => f.severity === "fail");
    const said = (findings) => findings.map((f) => f.message).join("\n");

    test("a directory that cannot be listed yields ONE unanswered question, not a failure per persona", () => {
        const root = fixture({ skip: ["agents"] });
        write(root, "core/personas/worker.md", PERSONA("worker"));
        write(root, "core/personas/second.md", PERSONA("second"));
        write(root, "agents/worker.md", AGENT("worker", "Does work. Delegate work to it."));
        const dir = path.join(root, "agents");
        fs.chmodSync(dir, 0o000);
        try {
            const { findings } = inspect(root);
            // Root ignores mode bits, so this asserts only where the read actually failed.
            if (/could not be read|could not be examined/.test(said(findings))) {
                assert.match(said(findings), /correspondence went unchecked/);
                assert.equal(
                    fails(findings).filter((f) => /has no binding/.test(f.message)).length,
                    0,
                    "an empty binding set from an unread directory must not be reported as personas with nothing bound",
                );
            }
        } finally {
            fs.chmodSync(dir, 0o755);
        }
    });

    test("an ABSENT agents directory still fails every unbound persona — absence is an answer", () => {
        const root = fixture({ skip: ["agents"] });
        write(root, "core/personas/worker.md", PERSONA("worker"));
        const { findings } = inspect(root);
        assert.equal(fails(findings).length, 1, said(findings));
        assert.match(said(findings), /has no binding/);
        assert.doesNotMatch(said(findings), /went unchecked/);
    });
});
