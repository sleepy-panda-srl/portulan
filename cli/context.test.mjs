// Tests for `context` — what a boot reads and what the host loads into every context, measured.
//
// Zero dependencies, node's own runner, and run by the same recipe as every suite here:
//
//   node --test "cli/**/*.test.mjs"
//
// Every case but the last group builds its workspace, bundle and repository in a temporary
// directory, so no figure asserted here moves when a file in this repository is edited. What the
// suite pins is which files count, in what order, and the exit code each refusal owes. The figures
// themselves are the recipe's to rail, over the real tree.

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    ENGINE,
    ESTIMATED_BYTES_PER_TOKEN,
    OFFER_FLOOR_TOKENS,
    REQUIRED_SLOTS,
    STEPS,
    alwaysLine,
    alwaysTier,
    importsOf,
    measure,
    pluginDescriptions,
    railFor,
    run,
    tokensOf,
} from "./context.mjs";
import { fenced } from "./form.mjs";

// A HERMETIC HOST. `context` never asks the host where packs are installed, but it imports
// `./skills-set.mjs`, which can, so this suite neutralises the installed-plugin record the way every
// suite in that closure does. Swept by `pinned-roots.live.test.mjs`, whose header carries the argument.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const MODULE = path.join(HERE, "context.mjs");

const made = [];
after(() => {
    for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

/** A directory holding exactly `files`, each path relative to it. */
function tree(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-context-"));
    made.push(dir);
    for (const [rel, content] of Object.entries(files)) {
        const file = path.join(dir, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
    }
    return dir;
}

const skill = (description, extra = "") => `---\nname: s\ndescription: ${description}\n${extra}---\n\n# Body\n\nNot listed.\n`;

/** A bundle carrying the engine half, the skill's step files and a plugin manifest, as this repository does. */
function bundle({ engine = true, plugin = true } = {}) {
    const files = {};
    if (engine) {
        files["plugin/skills/portulan/SKILL.md"] = skill("Boot the engine.");
        files["plugin/skills/portulan/steps.md"] = "# Steps 1 to 5\n\nThe boot in full.\n";
        files["plugin/skills/portulan/pointer-manifest.md"] = "# Step 2a\n\nResolve the pointer.\n";
        files["plugin/skills/portulan/packs.md"] = "# Step 3a\n\nRead the packs key, and only the key.\n";
        files["core/engine.md"] = "# Portulan engine\n\nThe kernel.\n";
    }
    if (plugin) {
        files[".claude-plugin/plugin.json"] = JSON.stringify({ name: "p", skills: ["./plugin/skills/"] });
        files["agents/implementer.md"] = skill("Implements.");
    }
    return tree(files);
}

/** A repository with a workspace in `.portulan/`, the residence `init` drafts. */
function repository({ manifest = {}, files = {}, cards = ["app"] } = {}) {
    const base = {
        portulan: { spec: "2.8" },
        name: "fixture",
        kind: "repository",
        tree: "../",
        slots: {
            identity: "identity.md",
            principles: "principles.md",
            constitution: "../docs/vision.md",
            gates: "gate-map.md",
            dod: "dod.md",
            memory: "memory/",
            repos: "repos/",
            tasks: "tasks/",
        },
        memory: { index: { path: "memory-index.md" } },
        ...manifest,
    };
    const all = {
        ".portulan/workspace.json": JSON.stringify(base, null, 2),
        ".portulan/identity.md": "identity\n",
        ".portulan/principles.md": "principles\n",
        "docs/vision.md": "vision\n",
        ".portulan/gate-map.md": "gates\n",
        ".portulan/dod.md": "dod\n",
        ".portulan/memory-index.md": "- [a](memory/a.md)\n",
        ...Object.fromEntries(cards.map((c) => [`.portulan/repos/${c}.md`, `# Repo — ${c}\n`])),
        ...files,
    };
    return tree(all);
}

/** Run the module in-process, as the recipe would from the repository root. */
function measured(root, argv = [], { bundleRoot = bundle() } = {}) {
    const lines = [];
    const code = run(["--workspace", ".portulan", ...argv], (line) => lines.push(line), { bundleRoot, cwd: root });
    return { code, out: lines.join("\n") };
}

describe("how a rail is set, and how bytes become tokens", () => {
    test("a rail is today's figure plus 2%, rounded up, in integers", () => {
        assert.equal(railFor(95_602), 97_515);
        assert.equal(railFor(102_448), 104_497);
        assert.equal(railFor(37_997), 38_757);
        assert.equal(railFor(20_710), 21_125);
        assert.equal(railFor(3_386), 3_454);
        assert.equal(railFor(100), 102);
        assert.equal(railFor(1), 2);
    });

    test("tokens are bytes over the ratio, rounded", () => {
        assert.equal(tokensOf(2_990, ESTIMATED_BYTES_PER_TOKEN), 1_000);
        assert.equal(tokensOf(10, 4), 3);
    });
});

describe("the boot read-set", () => {
    test("counts the engine half, the manifest, the slots, the card and the memory index, in the boot's order", () => {
        const root = repository();
        const bundleRoot = bundle();
        const result = measure(path.join(root, ".portulan"), { bundleRoot });
        assert.deepEqual(
            result.boot.entries.map((e) => e.label),
            ["boot skill", "boot steps", "kernel", "manifest", "identity", "principles", "constitution", "gates", "dod", "repo card", "memory index"],
        );
        for (const e of result.boot.entries) assert.equal(e.bytes, fs.statSync(e.file).size, e.label);
        const manifest = result.boot.entries.find((e) => e.label === "manifest").bytes;
        assert.equal(result.figures.records, result.figures.boot - manifest);
        const size = (rel) => fs.statSync(path.join(bundleRoot, rel)).size;
        assert.equal(result.figures.engine, size("plugin/skills/portulan/SKILL.md") + size("plugin/skills/portulan/steps.md") + size("core/engine.md"));
    });

    test("a boot whose card is loaded reads the skill, and has the always tier the card sits in", () => {
        const root = repository({
            manifest: { packs: ["rituals/checkpoints"] },
            files: {
                ".claude/rules/portulan/boot.md": "# Portulan boot card\n\nThe card.\n\n@../../../core/engine.md\n",
                "core/engine.md": "# Portulan engine\n\nThe kernel, in this tree.\n",
            },
        });
        const bundleRoot = bundle();
        const result = measure(path.join(root, ".portulan"), { bundleRoot });
        assert.equal(result.boot.carded, path.join(root, ".claude", "rules", "portulan", "boot.md"));
        assert.deepEqual(
            result.boot.entries.map((e) => [e.label, path.relative(e.bundle ? bundleRoot : root, e.file)]),
            [
                ["boot skill", path.join("plugin", "skills", "portulan", "SKILL.md")],
                ["rule", path.join(".claude", "rules", "portulan", "boot.md")],
                ["import, depth 1", path.join("core", "engine.md")],
            ],
        );
        assert.equal(result.figures.boot, result.figures.always + fs.statSync(path.join(bundleRoot, "plugin/skills/portulan/SKILL.md")).size);
        assert.equal(result.figures.records, null, "a carded boot reads no manifest, so there is no subtotal without it");
        assert.match(
            result.boot.notCounted[0],
            /^what the card replaces, each opened when the card or an on-path rule sends a session to it: the manifest, `identity`, `principles`, `constitution`, `gates`, `dod`, this repository's card, the memory index, the packs step$/,
        );
        const { code, out } = measured(root, [], { bundleRoot });
        assert.equal(code, 0, out);
        assert.match(out, /boot read-set — carded: \.claude\/rules\/portulan\/boot\.md is this repository's boot card, .+ reads the skill and stops: the card carries the kernel and stands in for the slots$/m);
        assert.doesNotMatch(out, /without manifest/);
    });

    test("a card that does not carry the kernel has the boot read the plugin's, as the router says", () => {
        const root = repository({ files: { ".claude/rules/portulan/boot.md": "# Portulan boot card\n\nThe card.\n" } });
        const bundleRoot = bundle();
        const result = measure(path.join(root, ".portulan"), { bundleRoot });
        assert.deepEqual(result.boot.entries.map((e) => e.label), ["boot skill", "rule", "kernel"]);
        const size = (rel) => fs.statSync(path.join(bundleRoot, rel)).size;
        assert.equal(result.figures.boot, result.figures.always + size("plugin/skills/portulan/SKILL.md") + size("core/engine.md"));
        const { code, out } = measured(root, [], { bundleRoot });
        assert.equal(code, 0, out);
        assert.match(out, /reads the skill and the plugin's kernel, which nothing in context carries, and the card stands in for the slots/);
    });

    test("this repository's card, in the list of what waits, is the one the boot selects, not a file beside it", () => {
        const root = repository({
            cards: ["app", "other"],
            files: { ".claude/rules/portulan/boot.md": "# Portulan boot card\n\n@../../../.portulan/repos/other.md\n" },
        });
        const waits = (repo) => measure(path.join(root, ".portulan"), { bundleRoot: bundle(), repo }).boot.notCounted[0];
        assert.match(waits("app"), /, this repository's card, /);
        assert.doesNotMatch(waits("other"), /this repository's card/);
        assert.match(waits(null), /, this repository's card, /, "with two cards and none named, no card is selected, so none is loaded");
    });

    test("a file the card imports is counted where it loads, and not listed as one opened on demand", () => {
        const root = repository({
            files: {
                ".claude/rules/portulan/boot.md":
                    "# Portulan boot card\n\n@../../../.portulan/identity.md\n\n@../../../.portulan/repos/app.md\n\n@../../../.portulan/memory-index.md\n",
            },
        });
        const result = measure(path.join(root, ".portulan"), { bundleRoot: bundle() });
        assert.deepEqual(
            result.boot.entries.filter((e) => e.label.startsWith("import")).map((e) => path.relative(root, e.file)),
            [path.join(".portulan", "identity.md"), path.join(".portulan", "repos", "app.md"), path.join(".portulan", "memory-index.md")],
        );
        assert.match(result.boot.notCounted[0], /: the manifest, `principles`, `constitution`, `gates`, `dod`$/);
    });

    test("a rule is the card by its first line, and by nothing else", () => {
        const root = repository({ files: { ".claude/rules/notes.md": "Notes.\n\n# Portulan boot card\n" } });
        const result = measure(path.join(root, ".portulan"), { bundleRoot: bundle() });
        assert.equal(result.boot.carded, null);
        assert.ok(result.boot.entries.some((e) => e.label === "identity"), "a rule that only mentions the line is no card, so the slots are read");
    });

    test("prints the subtotal without the manifest before the total with it", () => {
        const { code, out } = measured(repository());
        assert.equal(code, 0);
        assert.ok(out.indexOf("without manifest") < out.indexOf(" total "), out);
        assert.match(out, /the figure the 2026-09-23 records measured, which left the manifest out/);
    });

    test("says what it leaves out, derived from what the manifest declares", () => {
        const root = repository({ manifest: { packs: ["rituals/checkpoints"] }, cards: ["app", "web"] });
        const { out } = measured(root, ["--repo", "app"]);
        assert.match(out, /memory records \(the index points at each\)/);
        assert.match(out, /1 other repo card/);
        assert.match(out, /tasks \(tasks\/\)/);
        assert.match(out, /1 pack's files \(the boot reads the key\)/);
    });

    test("an optional slot left undeclared is simply not read", () => {
        const root = repository();
        const manifest = JSON.parse(fs.readFileSync(path.join(root, ".portulan/workspace.json"), "utf8"));
        delete manifest.slots.constitution;
        fs.writeFileSync(path.join(root, ".portulan/workspace.json"), JSON.stringify(manifest));
        const result = measure(path.join(root, ".portulan"), { bundleRoot: bundle() });
        assert.ok(!result.boot.entries.some((e) => e.label === "constitution"));
    });

    test("a slot naming a file that is not there cannot be measured — exit 2", () => {
        const root = repository();
        fs.rmSync(path.join(root, ".portulan/dod.md"));
        const { code, out } = measured(root);
        assert.equal(code, 2);
        assert.match(out, /slot `dod` \(dod\.md\) is not on disk/);
    });

    test("a manifest that does not parse cannot be measured — exit 2", () => {
        const root = repository();
        fs.writeFileSync(path.join(root, ".portulan/workspace.json"), "{ not json");
        assert.equal(measured(root).code, 2);
    });

    test("slots that are not an object, or lack one the definition requires, are refused, never read as none — exit 2", () => {
        for (const slots of [null, [], "identity.md", { identity: "identity.md", principles: "principles.md" }]) {
            const root = repository();
            const manifest = JSON.parse(fs.readFileSync(path.join(root, ".portulan/workspace.json"), "utf8"));
            manifest.slots = slots;
            fs.writeFileSync(path.join(root, ".portulan/workspace.json"), JSON.stringify(manifest));
            const { code, out } = measured(root);
            assert.equal(code, 2, JSON.stringify(slots));
            assert.match(out, /✗ slot/, JSON.stringify(slots));
        }
    });

    test("a tree that names no directory is refused, never measured as an empty always tier — exit 2", () => {
        for (const treeValue of ["../nowhere/", 7]) {
            const { code, out } = measured(repository({ manifest: { tree: treeValue } }));
            assert.equal(code, 2, String(treeValue));
            assert.match(out, /✗ tree/, String(treeValue));
        }
    });
});

describe("the skill's step files", () => {
    test("the packs step counts where the manifest names a pack, last, as the bundle's and not the engine's", () => {
        const bundleRoot = bundle();
        const result = measure(path.join(repository({ manifest: { packs: ["rituals/checkpoints"] } }), ".portulan"), { bundleRoot });
        const step = result.boot.entries.at(-1);
        assert.equal(step.label, "packs step");
        assert.equal(step.bytes, fs.statSync(path.join(bundleRoot, "plugin/skills/portulan/packs.md")).size);
        assert.equal(result.figures.boot, result.figures.workspace + result.figures.engine + step.bytes);
        const none = measure(path.join(repository(), ".portulan"), { bundleRoot });
        assert.ok(!none.boot.entries.some((e) => e.label === "packs step"));
        assert.equal(none.figures.engine, result.figures.engine);
    });

    test("every step file is railed, whether or not it applies in the workspace measured", () => {
        const bundleRoot = bundle();
        const result = measure(path.join(repository(), ".portulan"), { bundleRoot });
        const all = STEPS.reduce((total, s) => total + fs.statSync(path.join(bundleRoot, s.rel)).size, 0);
        assert.equal(result.figures.steps, all);
        const { code, out } = measured(repository(), ["--rail", "steps=1"], { bundleRoot });
        assert.equal(code, 1);
        assert.match(out, /✗ rail steps: .* over its rail of 1 B/);
    });

    test("a pointer is not measured as a workspace — exit 2, saying why and what to measure instead", () => {
        const { code, out } = measured(repository({ manifest: { kind: "pointer" } }));
        assert.equal(code, 2);
        assert.match(out, /a pointer's workspace is resolved from the host's install records, which a recipe must not read/);
        assert.match(out, /measure the workspace `node cli\/discover\.mjs --json` resolves it to/);
    });

    test("a manifest of no governing kind is a defect, never measured as a workspace — exit 2", () => {
        for (const kind of [undefined, "workspace"]) {
            const { code, out } = measured(repository({ manifest: { kind } }));
            assert.equal(code, 2, String(kind));
            assert.match(out, /none of repository, demo, portfolio or pointer — a defect `doctor` reports, and a boot reads no slot of it/);
        }
    });
});

describe("the card naming this repository", () => {
    test("the only card is the one", () => {
        const result = measure(path.join(repository(), ".portulan"), { bundleRoot: bundle() });
        assert.equal(result.boot.card.selected, "app");
    });

    test("with several and none named, none is counted, and the report says why", () => {
        const { code, out } = measured(repository({ cards: ["app", "web"] }));
        assert.equal(code, 0);
        assert.match(out, /2 cards and none named with --repo, so none is counted/);
    });

    test("a boot rail over an unselected card cannot be judged — exit 2, never a green over less", () => {
        const { code, out } = measured(repository({ cards: ["app", "web"] }), ["--rail", "boot=999999"]);
        assert.equal(code, 2);
        assert.match(out, /rail boot cannot be judged/);
    });

    test("--repo selects a card, and one naming none is refused", () => {
        const root = repository({ cards: ["app", "web"] });
        const result = measure(path.join(root, ".portulan"), { bundleRoot: bundle(), repo: "web" });
        assert.equal(result.boot.card.selected, "web");
        const { code, out } = measured(root, ["--repo", "api"]);
        assert.equal(code, 2);
        assert.match(out, /--repo api names no card/);
    });
});

describe("the engine half", () => {
    test("a bundle without the boot skill is reported, and the workspace half still measured", () => {
        const { code, out } = measured(repository(), [], { bundleRoot: bundle({ engine: false }) });
        assert.equal(code, 0);
        assert.match(out, /plugin\/skills\/portulan\/SKILL\.md is not in this bundle/);
        assert.match(out, /workspace half/);
    });

    test("a rail over an engine or step files this bundle does not carry cannot be judged — exit 2", () => {
        for (const name of ["engine", "steps"]) {
            const { code, out } = measured(repository(), ["--rail", `${name}=999999`], { bundleRoot: bundle({ engine: false }) });
            assert.equal(code, 2, name);
            assert.match(out, new RegExp(`rail ${name} cannot be judged: .* not in this bundle`));
        }
    });
});

describe("imports, as the host reads them", () => {
    test("an import is `@` at a word's start, outside code", () => {
        const text = [
            "See @docs/a.md and @b.md.",
            "Mail me at someone@example.com — not an import.",
            "Inline `@docs/code.md` is code.",
            "```",
            "@docs/fenced.md",
            "```",
            "~~~~",
            "@docs/tilde.md",
            "~~~",
            "still fenced @docs/still.md",
            "~~~~",
            "@after.md",
        ].join("\n");
        assert.deepEqual(importsOf(text), ["docs/a.md", "b.md.", "after.md"]);
    });

    // Read in Claude Code 2.1.281: a token runs to the next space no `\` escapes, is cut at `#`, reads `\ `
    // as a space, and is no import unless it opens as a path can.
    test("an import's path is cut at `#`, reads an escaped space as a space, and opens as a path can", () => {
        assert.deepEqual(importsOf("@docs/my\\ file.md and @docs/a.md#part, not @#tag or @(x)\n"), ["docs/my file.md", "docs/a.md"]);
        const root = tree({ "CLAUDE.md": "@docs/my\\ file.md\n\n@docs/a.md#part\n", "docs/my file.md": "m\n", "docs/a.md": "a\n" });
        const always = alwaysTier(root);
        assert.deepEqual(always.entries.map((e) => path.relative(root, e.file)), ["CLAUDE.md", path.join("docs", "my file.md"), path.join("docs", "a.md")]);
        assert.deepEqual(always.missing, []);
    });

    // Found in the coordinator session's review of #452 after its push, and read in the lexer Claude Code
    // 2.1.281 bundles: a list item's text reaches the host whole, so a code span or a comment in it hides no
    // import, in a loose list as in a tight one, while in a paragraph both still do.
    test("in a list item's text a code span or a comment hides no import, and the file it names is counted", () => {
        const text = [
            "Run `cat @docs/para.md now` in a paragraph.",
            "",
            "- Run `cat @docs/tight.md now`, and <!-- @docs/comment.md --> this.",
            "- Open `@docs/after-backtick.md`, whose `@` follows the backtick.",
            "",
            "1. A loose list: `cat @docs/loose.md now`.",
            "",
            "   ```",
            "   @docs/fenced.md",
            "   ```",
            "",
            "2. Last.",
        ].join("\n");
        assert.deepEqual(importsOf(text), ["docs/tight.md", "docs/comment.md", "docs/loose.md"]);
        const root = tree({ "CLAUDE.md": "- Load `cat @docs/a.md now`.\n", "docs/a.md": "a\n" });
        const always = alwaysTier(root);
        assert.deepEqual(always.entries.map((e) => path.relative(root, e.file)), ["CLAUDE.md", path.join("docs", "a.md")]);
        assert.deepEqual(always.missing, []);
    });
});

describe("the always tier", () => {
    test("instruction files and their imports count once each, and a file five imports down is not loaded", () => {
        const chain = {};
        for (let i = 1; i <= 6; i += 1) chain[`docs/d${i}.md`] = i < 6 ? `@d${i + 1}.md\n` : "deepest\n";
        const root = tree({
            "CLAUDE.md": "Read @docs/d1.md and @docs/d1.md again, `@docs/code.md`, @missing.md and @~/home.md.\n",
            ".claude/CLAUDE.md": "@../CLAUDE.md\n",
            ...chain,
        });
        const always = alwaysTier(root);
        assert.deepEqual(
            always.entries.map((e) => path.relative(root, e.file)),
            ["CLAUDE.md", ".claude/CLAUDE.md", "docs/d1.md", "docs/d2.md", "docs/d3.md", "docs/d4.md"],
        );
        assert.deepEqual(always.tooDeep, ["@d5.md (in docs/d4.md)"]);
        assert.deepEqual(always.missing, ["@missing.md (in CLAUDE.md)"]);
        assert.deepEqual(always.outside, ["@~/home.md. (in CLAUDE.md)"]);
    });

    // Read in Claude Code 2.1.281: the import's path runs to the next space, and nothing trims it.
    test("a closing full stop is part of the path the host reads, so that import names no file", () => {
        const root = tree({ "CLAUDE.md": "See @docs/a.md.\n", "docs/a.md": "a\n" });
        const always = alwaysTier(root);
        assert.deepEqual(always.entries.map((e) => path.relative(root, e.file)), ["CLAUDE.md"]);
        assert.deepEqual(always.missing, ["@docs/a.md. (in CLAUDE.md)"]);
    });

    // Read in Claude Code 2.1.281 and seen on a fixture: a path-scoped rule waits for its path, and what it
    // imports does not, because an imported file carries no `paths:` of its own.
    test("a rule's imports load with it, and a path-scoped rule's load everywhere while the rule waits for its path", () => {
        const root = tree({
            ".claude/rules/team.md": "# Team\n\n@../../docs/kernel.md\n",
            ".claude/rules/api.md": '---\npaths:\n  - "api/**"\n---\n\n@../../docs/api-notes.md\n',
            "docs/kernel.md": "kernel\n",
            "docs/api-notes.md": "notes\n\n@more.md\n",
            "docs/more.md": "more\n",
        });
        const always = alwaysTier(root);
        assert.deepEqual(
            always.entries.map((e) => [e.label, path.relative(root, e.file)]),
            [
                ["rule", path.join(".claude", "rules", "team.md")],
                ["import, depth 1", path.join("docs", "kernel.md")],
                ["import, depth 1, of a path-scoped rule", path.join("docs", "api-notes.md")],
                ["import, depth 2, of a path-scoped rule", path.join("docs", "more.md")],
            ],
        );
        assert.equal(always.scoped, 1, "the scoped rule itself is on-path, and not counted");
        assert.equal(always.card, null);
    });

    test("a path in an HTML comment is not an import, as the host strips comments before it reads one", () => {
        const root = tree({ "CLAUDE.md": "<!-- @docs/a.md -->\n<!--\n@docs/b.md\n-->\n@docs/c.md\n", "docs/a.md": "a\n", "docs/b.md": "b\n", "docs/c.md": "c\n" });
        assert.deepEqual(alwaysTier(root).entries.map((e) => path.relative(root, e.file)), ["CLAUDE.md", path.join("docs", "c.md")]);
    });

    test("an import outside the repository is named and not measured", () => {
        const outsideDir = tree({ "shared.md": "shared\n" });
        const root = tree({ "CLAUDE.md": `@${path.join(outsideDir, "shared.md")}\n` });
        const always = alwaysTier(root);
        assert.equal(always.entries.length, 1);
        assert.equal(always.outside.length, 1);
    });

    test("a link out of the repository is named and never read, wherever the host would meet it", () => {
        const away = tree({ "secret.md": "not this repository's\n", "skills/s/SKILL.md": skill("Elsewhere."), "agent.md": skill("Elsewhere.") });
        const root = tree({ "CLAUDE.md": "@docs/link.md\n", ".claude/rules/.keep": "", ".claude/agents/.keep": "" });
        fs.mkdirSync(path.join(root, "docs"));
        fs.symlinkSync(path.join(away, "secret.md"), path.join(root, "docs/link.md"));
        fs.symlinkSync(path.join(away, "secret.md"), path.join(root, ".claude/rules/linked.md"));
        fs.symlinkSync(path.join(away, "skills"), path.join(root, ".claude/skills"));
        fs.symlinkSync(path.join(away, "agent.md"), path.join(root, ".claude/agents/linked.md"));
        const always = alwaysTier(root);
        assert.deepEqual(always.entries.map((e) => path.relative(root, e.file)), ["CLAUDE.md"]);
        assert.deepEqual(always.outside, [
            "@docs/link.md (in CLAUDE.md)",
            ".claude/rules/linked.md (a link out of the repository)",
            ".claude/skills (a link out of the repository)",
            ".claude/agents/linked.md (a link out of the repository)",
        ]);

        const linkedRoot = tree({});
        fs.symlinkSync(path.join(away, "secret.md"), path.join(linkedRoot, "CLAUDE.md"));
        const linked = alwaysTier(linkedRoot);
        assert.deepEqual(linked.entries, []);
        assert.deepEqual(linked.outside, ["CLAUDE.md (a link out of the repository)"]);
    });

    test("a file the host would load and this cannot read is refused, never read as absent — exit 2", () => {
        const root = repository();
        fs.symlinkSync("CLAUDE.md", path.join(root, "CLAUDE.md"));
        const { code, out } = measured(root);
        assert.equal(code, 2);
        assert.match(out, /CLAUDE\.md could not be read \(ELOOP\)/);
    });

    test("an unscoped rule counts; a rule `paths:` scopes is on-path", () => {
        const root = tree({
            ".claude/rules/general.md": "Always.\n",
            ".claude/rules/web/scoped.md": "---\npaths:\n  - \"web/**\"\n---\n\nOnly there.\n",
        });
        const always = alwaysTier(root);
        assert.deepEqual(always.entries.map((e) => e.label), ["rule"]);
        assert.equal(always.scoped, 1);
    });

    test("a description counts its bytes, and not the body the host loads on invoke", () => {
        const root = tree({
            ".claude/skills/listed/SKILL.md": skill("Twelve bytes"),
            ".claude/skills/hidden/SKILL.md": skill("Never listed", "disable-model-invocation: true\n"),
            ".claude/commands/deploy.md": "Deploy the service.\nTwo lines.\n\nNot this paragraph.\n",
            ".claude/agents/reviewer.md": skill("Reviews."),
        });
        const always = alwaysTier(root);
        assert.deepEqual(
            always.entries.map((e) => [e.label, e.bytes]),
            [
                ["skill description", 12],
                ["command description", Buffer.byteLength("Deploy the service. Two lines.")],
                ["agent description", 8],
            ],
        );
        assert.equal(always.unlisted, 1);
    });

    test("a workspace with no tree has no always tier to report", () => {
        const root = repository();
        const manifest = JSON.parse(fs.readFileSync(path.join(root, ".portulan/workspace.json"), "utf8"));
        delete manifest.tree;
        fs.writeFileSync(path.join(root, ".portulan/workspace.json"), JSON.stringify(manifest));
        const { code, out } = measured(root);
        assert.equal(code, 0);
        assert.match(out, /this workspace declares no tree/);
    });
});

describe("the plugin's descriptions", () => {
    test("found the way the host finds them: declared roots one level down, the default skills/, agents by convention", () => {
        const root = tree({
            ".claude-plugin/plugin.json": JSON.stringify({ name: "p", skills: ["./group/", "./single/"] }),
            "group/one/SKILL.md": skill("One."),
            "group/nested/two/SKILL.md": skill("Too deep for the host."),
            "single/SKILL.md": skill("Single."),
            "skills/default/SKILL.md": skill("Default."),
            "agents/a.md": skill("Agent."),
        });
        const plugin = pluginDescriptions(root);
        assert.deepEqual(
            plugin.entries.map((e) => path.relative(root, e.file)),
            ["group/one/SKILL.md", "single/SKILL.md", "skills/default/SKILL.md", "agents/a.md"],
        );
        assert.equal(plugin.skills, 3);
        assert.equal(plugin.agents, 1);
    });

    test("a skills root or an agent that resolves out of the bundle is a defect in the plugin — exit 2", () => {
        const away = tree({ "skills/x/SKILL.md": skill("Elsewhere."), "agent.md": skill("Elsewhere.") });
        const escaping = bundle();
        fs.writeFileSync(path.join(escaping, ".claude-plugin/plugin.json"), JSON.stringify({ name: "p", skills: [path.relative(escaping, path.join(away, "skills"))] }));
        const linked = bundle();
        fs.symlinkSync(path.join(away, "agent.md"), path.join(linked, "agents/linked.md"));
        for (const bundleRoot of [escaping, linked]) {
            const { code, out } = measured(repository(), [], { bundleRoot });
            assert.equal(code, 2);
            assert.match(out, /resolves out of the bundle/);
        }
    });

    test("a bundle that is not the plugin says so, and a rail over it cannot be judged — exit 2", () => {
        assert.ok(pluginDescriptions(bundle({ plugin: false })).unavailable);
        const { code } = measured(repository(), ["--rail", "descriptions=999"], { bundleRoot: bundle({ plugin: false }) });
        assert.equal(code, 2);
    });
});

describe("a budget is a rail only where it is declared", () => {
    const context = (tokens, ratio = 3) => ({ context: { always: { budget: { tokens } }, ratio: { bytes_per_token: ratio, calibrated_by: "a-host" } } });

    test("undeclared, it is a report with the offer init would make", () => {
        const { code, out } = measured(repository({ files: { "CLAUDE.md": "x".repeat(30_000) } }));
        assert.equal(code, 0);
        const offer = Math.max(OFFER_FLOOR_TOKENS, tokensOf(30_000, ESTIMATED_BYTES_PER_TOKEN));
        assert.match(out, new RegExp(`budget: undeclared .* ${offer.toLocaleString("en-US")} tokens`));
        assert.match(out, /proposal 0036's estimate/);
    });

    test("declared and within, it is ok, at the declared ratio", () => {
        const { code, out } = measured(repository({ manifest: context(100), files: { "CLAUDE.md": "x".repeat(30) } }));
        assert.equal(code, 0);
        assert.match(out, /ratio: 3 bytes per token, declared, calibrated by a-host/);
        assert.match(out, /ok budget: the always tier is ~10 tokens of the 100 declared/);
    });

    test("declared and exceeded, it is red, and names the repair", () => {
        const { code, out } = measured(repository({ manifest: context(5), files: { "CLAUDE.md": "x".repeat(30) } }));
        assert.equal(code, 1);
        assert.match(out, /over the 5 declared by 5 — repair by demotion .* never by raising the budget/);
    });

    test("the plugin's descriptions are not the workspace's to budget", () => {
        const { code } = measured(repository({ manifest: context(1), files: {} }));
        assert.equal(code, 0);
    });

    test("a malformed key is refused, never read as absent — exit 2", () => {
        const ratio = { bytes_per_token: 3, calibrated_by: "a-host" };
        for (const manifest of [
            { context: { always: { budget: { tokens: 100 } } } },
            { context: {} },
            context(100, 0.5),
            context(1.5),
            context(0),
            { context: [] },
            { context: { always: { budget: "disabled" }, ratio } },
            { context: { always: 5, ratio } },
            { context: { always: { budget: {} }, ratio } },
            { context: { alwyas: { budget: { tokens: 100 } }, ratio } },
            { context: { always: { budget: { tokens: 100, soft: true } }, ratio } },
            { context: { ratio: "3" } },
            { context: { ratio: { bytes_per_token: 3 } } },
            { context: { ratio: { bytes_per_token: 3, calibrated_by: 7 } } },
        ]) {
            const { code, out } = measured(repository({ manifest }));
            assert.equal(code, 2, JSON.stringify(manifest));
            assert.match(out, /✗ (the manifest's `context`|context)/, JSON.stringify(manifest));
        }
    });

    test("a budget with no tree to measure it against cannot be judged — exit 2", () => {
        const root = repository({ manifest: context(100) });
        const manifest = JSON.parse(fs.readFileSync(path.join(root, ".portulan/workspace.json"), "utf8"));
        delete manifest.tree;
        fs.writeFileSync(path.join(root, ".portulan/workspace.json"), JSON.stringify(manifest));
        assert.equal(measured(root).code, 2);
    });
});

describe("over a budget, a card importing the identity whole is told it can become an on-demand read", () => {
    const context = (tokens) => ({ context: { always: { budget: { tokens } }, ratio: { bytes_per_token: 3, calibrated_by: "a-host" } } });
    const carded = (manifest) =>
        repository({ manifest, files: { ".portulan/identity.md": "i".repeat(300), ".claude/rules/portulan/boot.md": "# Portulan boot card\n\n@../../../.portulan/identity.md\n" } });
    /** `alwaysLine` on the repository's workspace, as `doctor` calls it with the manifest it read. */
    const lineOf = (root) => {
        const ws = path.join(root, ".portulan");
        return alwaysLine(ws, JSON.parse(fs.readFileSync(path.join(ws, "workspace.json"), "utf8")), { bundleRoot: bundle() });
    };
    const hint = /the tier imports \.portulan\/identity\.md whole, ~100 tokens: one demotion is to make it an on-demand read, as Portulan's own card does/;

    test("over the budget, the line names the import and the demotion", () => {
        const line = lineOf(carded(context(50)));
        assert.equal(line.verdict, "over", line.line);
        assert.match(line.line, hint);
    });

    test("within it, or over it with no identity imported, nothing is suggested", () => {
        assert.doesNotMatch(lineOf(carded(context(1_000))).line, /on-demand read/);
        const root = repository({ manifest: context(5), files: { "CLAUDE.md": "x".repeat(30) } });
        const line = lineOf(root);
        assert.equal(line.verdict, "over", line.line);
        assert.doesNotMatch(line.line, /on-demand read/);
    });
});

describe("--brief: the line `doctor` reports and the boot closes with", () => {
    const context = (tokens, ratio = 3) => ({ context: { always: { budget: { tokens } }, ratio: { bytes_per_token: ratio, calibrated_by: "a-host" } } });
    const brief = (root, argv = [], options) => {
        const { code, out } = measured(root, ["--brief", ...argv], options);
        assert.equal(out.split("\n").length, 1, `one line, not ${JSON.stringify(out)}`);
        return { code, out };
    };
    /** A manifest with its tree removed, the shape of a demo or a portfolio. */
    const treeless = (root) => {
        const file = path.join(root, ".portulan/workspace.json");
        const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
        delete manifest.tree;
        fs.writeFileSync(file, JSON.stringify(manifest));
        return root;
    };

    test("names the tier's size, its three largest files largest first and what each is, and what sits on-path", () => {
        const { code, out } = brief(
            repository({
                files: {
                    "CLAUDE.md": `${"x".repeat(2_990)}\n@docs/a.md @~/mine.md\n`,
                    "docs/a.md": "a".repeat(598),
                    ".claude/rules/style.md": "s".repeat(299),
                    ".claude/rules/api.md": "---\npaths: src/api/**\n---\n\nScoped.\n",
                    ".claude/skills/s/SKILL.md": skill("Tiny."),
                },
            }),
        );
        assert.equal(code, 0);
        assert.match(out, /^Claude Code: this repository's always tier is ~1,309 tokens, 3,915 B at 2\.99 bytes per token, proposal 0036's estimate: none is declared; /);
        assert.match(out, /; the largest: CLAUDE\.md ~1,008 \(instructions\), docs\/a\.md ~200 \(import, depth 1\), \.claude\/rules\/style\.md ~100 \(rule\), of 4 files; /);
        assert.match(out, /; 1 path-scoped rule sits on-path; 1 import or link out of the repository loads and is not counted; /);
        assert.match(out, /; the Portulan plugin's descriptions add ~\d+ tokens wherever it is enabled/);
        assert.match(out, /; budget: undeclared \(context\.always\.budget\.tokens\) — a report, not a rail; init would offer the larger of 8,000 tokens and today's load: 8,000 tokens$/);
    });

    test("an empty tier is said, not left blank, and so is none on-path and none out of the repository", () => {
        assert.match(
            brief(repository()).out,
            /; nothing in it: no CLAUDE\.md, \.claude\/CLAUDE\.md, unscoped rule, or project skill, command or agent; no path-scoped rule sits on-path; no import or link out of the repository loads; /,
        );
        const { out } = brief(
            repository({
                files: {
                    "CLAUDE.md": "@a.md @b.md @~/one.md @~/two.md\n",
                    "a.md": "a\n",
                    "b.md": "b\n",
                    ".claude/rules/one.md": "---\npaths: src/**\n---\n\nOne.\n",
                    ".claude/rules/two.md": "---\npaths: docs/**\n---\n\nTwo.\n",
                },
            }),
        );
        assert.match(out, /; 2 path-scoped rules sit on-path; 2 imports or links out of the repository load and are not counted; /);
    });

    test("the line does not move with the directory it is run from", () => {
        const root = repository({ files: { "CLAUDE.md": "x".repeat(300), ".claude/rules/r.md": "r\n" } });
        const bundleRoot = bundle();
        const here = brief(root, [], { bundleRoot }).out;
        const lines = [];
        assert.equal(run(["--workspace", path.join(root, ".portulan"), "--brief"], (line) => lines.push(line), { bundleRoot, cwd: bundle() }), 0);
        assert.deepEqual(lines, [here]);
    });

    test("a declared budget is judged as the full report judges it: over is exit 1, within is 0", () => {
        const over = repository({ manifest: context(5), files: { "CLAUDE.md": "x".repeat(30) } });
        const { code, out } = brief(over);
        assert.equal(code, 1);
        assert.match(out, /3 bytes per token, declared, calibrated by a-host/);
        const clause = "budget: the always tier is ~10 tokens, over the 5 declared by 5 — repair by demotion to a later tier, by a merge or by a retirement, never by raising the budget in this change";
        assert.ok(out.endsWith(`; ${clause}`), out);
        assert.ok(measured(over).out.includes(`✗ ${clause}`), "the full report judges the same budget in the same words");

        const within = brief(repository({ manifest: context(100), files: { "CLAUDE.md": "x".repeat(30) } }));
        assert.equal(within.code, 0);
        assert.match(within.out, /; budget: the always tier is ~10 tokens of the 100 declared$/);
    });

    test("what it cannot measure is said; only a declared budget makes that exit 2, never a pass", () => {
        const plain = brief(treeless(repository()));
        assert.equal(plain.code, 0);
        assert.match(plain.out, /^Claude Code: the always tier is not measured — this workspace declares no tree/);

        const declared = brief(treeless(repository({ manifest: context(100) })));
        assert.equal(declared.code, 2);
        assert.match(declared.out, /^Claude Code: the declared budget cannot be judged — this workspace declares no tree/);

        const looped = repository({ manifest: context(100) });
        fs.symlinkSync("CLAUDE.md", path.join(looped, "CLAUDE.md"));
        const unread = brief(looped);
        assert.equal(unread.code, 2);
        assert.match(unread.out, /cannot be judged — CLAUDE\.md could not be read \(ELOOP\)$/);
        assert.ok(!unread.out.includes(looped), "in the repository's own paths, as the rest of the line is");
    });

    test("an error gives its paths from the repository or the plugin, never from where either sits", () => {
        const lost = repository({ manifest: { ...context(100), tree: "loop/" } });
        fs.symlinkSync("loop", path.join(lost, ".portulan/loop"));
        const unread = brief(lost);
        assert.equal(unread.code, 2);
        assert.match(unread.out, /cannot be judged — the repository could not be read \(ELOOP\)$/);
        assert.ok(!unread.out.includes(lost), unread.out);

        const bundleRoot = bundle();
        fs.mkdirSync(path.join(bundleRoot, "plugin/skills/looped"));
        fs.symlinkSync("SKILL.md", path.join(bundleRoot, "plugin/skills/looped/SKILL.md"));
        const { out } = brief(repository(), [], { bundleRoot });
        assert.match(out, /; the Portulan plugin's descriptions are not measured — plugin\/skills\/looped\/SKILL\.md could not be read \(ELOOP\); /);
        assert.ok(!out.includes(bundleRoot), out);
    });

    test("a file's name cannot break the line: a control character in it is escaped, never printed", () => {
        const escaped = (code) => "\\" + "u" + code.toString(16).padStart(4, "0");
        const name = `.claude/rules/a${String.fromCharCode(10)}b${String.fromCharCode(27)}[2J.md`;
        const { out } = brief(repository({ files: { "CLAUDE.md": "x".repeat(900), [name]: "r".repeat(598) } }));
        assert.ok(out.includes(`, .claude/rules/a${escaped(10)}b${escaped(27)}[2J.md ~200 (rule); `), out);
    });

    test("a malformed key withholds the figure, and is a verdict only where it declares a budget", () => {
        const ratio = brief(repository({ manifest: { context: { ratio: { bytes_per_token: 0.5, calibrated_by: "a-host" } } } }));
        assert.equal(ratio.code, 0);
        assert.match(ratio.out, /not measured — context\.ratio\.bytes_per_token is 0\.5/);
        const budget = brief(repository({ manifest: context(0) }));
        assert.equal(budget.code, 2);
        assert.match(budget.out, /cannot be judged — context\.always\.budget\.tokens is 0/);
    });

    test("a pointer is said, never measured", () => {
        const root = tree({ ".portulan/workspace.json": JSON.stringify({ portulan: { spec: "2.7" }, name: "p", kind: "pointer", governed_by: { workspace: "w" } }) });
        const { code, out } = brief(root);
        assert.equal(code, 0);
        assert.match(out, /not measured — the manifest is a pointer, which declares no tree/);
    });

    test("nothing in it waits on the boot read-set, so a slot naming nothing withholds no figure", () => {
        const root = repository({ files: { "CLAUDE.md": "x".repeat(30) } });
        fs.rmSync(path.join(root, ".portulan/dod.md"));
        assert.equal(measured(root).code, 2);
        const { code, out } = brief(root);
        assert.equal(code, 0);
        assert.match(out, /the largest: CLAUDE\.md ~10 \(instructions\)/);
    });

    test("a plugin it cannot read withholds no figure of the repository's", () => {
        const bundleRoot = bundle();
        fs.writeFileSync(path.join(bundleRoot, ".claude-plugin/plugin.json"), "{ not json");
        const { code, out } = brief(repository({ files: { "CLAUDE.md": "x".repeat(30) } }), [], { bundleRoot });
        assert.equal(code, 0);
        assert.match(
            out,
            /the largest: CLAUDE\.md ~10 \(instructions\); no path-scoped rule sits on-path; no import or link out of the repository loads; the Portulan plugin's descriptions are not measured — the plugin manifest does not parse/,
        );
    });

    test("a rail, a card or itself twice is refused, never taken and dropped — exit 2", () => {
        const root = repository();
        for (const argv of [["--rail", "boot=100"], ["--repo", "app"], ["--brief"]]) {
            const { code, out } = measured(root, ["--brief", ...argv]);
            assert.equal(code, 2, argv.join(" "));
            assert.match(out, /✗ --brief/, argv.join(" "));
        }
    });
});

describe("rails", () => {
    test("a figure over its rail is red, and names the repair", () => {
        const { code, out } = measured(repository(), ["--rail", "engine=1"]);
        assert.equal(code, 1);
        assert.match(out, /✗ rail engine: .* over its rail of 1 B by .* never by raising the rail in this change/);
    });

    test("headroom past 5% is reported with the figure to lower the rail to", () => {
        const root = repository();
        const figure = measure(path.join(root, ".portulan"), { bundleRoot: bundle() }).figures.boot;
        const { code, out } = measured(root, ["--rail", `boot=${figure * 2}`]);
        assert.equal(code, 0);
        assert.match(out, new RegExp(`note rail boot: .* lower it to ${railFor(figure).toLocaleString("en-US")} B`));
    });

    test("an argument this tool does not know is refused — exit 2", () => {
        const root = repository();
        for (const argv of [
            ["--rail", "nope=1"],
            ["--rail", "boot=abc"],
            ["--rail", "boot=0"],
            ["--rail", "boot=9007199254740993"],
            ["--rail", `boot=${"9".repeat(400)}`],
            ["--rail", "boot=5", "--rail", "boot=6"],
            ["--frobnicate"],
            ["--repo"],
        ]) {
            assert.equal(measured(root, argv).code, 2, argv.join(" "));
        }
        assert.equal(run([], () => {}), 2);
    });

    test("the command line returns what run returns", () => {
        const root = repository();
        const ok = spawnSync(process.execPath, [MODULE, "--workspace", ".portulan"], { cwd: root, encoding: "utf8" });
        assert.equal(ok.status, 0, ok.stdout + ok.stderr);
        const red = spawnSync(process.execPath, [MODULE, "--workspace", ".portulan", "--rail", "engine=1"], { cwd: root, encoding: "utf8" });
        assert.equal(red.status, 1, red.stdout + red.stderr);
    });
});

describe("this repository", () => {
    test("the listing is the files on disk — the figures are the recipe's to rail", () => {
        const result = measure(path.join(REPO, ".portulan"));
        assert.deepEqual(result.boot.engineMissing, []);
        assert.notEqual(result.figures.steps, null);
        assert.equal(result.boot.carded, path.join(REPO, ".claude/rules/portulan/boot.md"), "this repository's boot is its card");
        assert.equal(result.figures.boot, result.figures.always + fs.statSync(path.join(REPO, "plugin/skills/portulan/SKILL.md")).size);
        for (const e of result.boot.entries) assert.equal(e.bytes, fs.statSync(e.file).size, e.label);
        assert.equal(result.plugin.unavailable, undefined);
        const demo = measure(path.join(REPO, "examples"), { repo: "combcount" });
        assert.equal(demo.always, null);
        assert.equal(demo.figures.engine, result.figures.engine);
    });

    test("the slots this refuses a workspace without are the ones the schema requires", () => {
        const schema = JSON.parse(fs.readFileSync(path.join(REPO, "spec/workspace.schema.json"), "utf8"));
        assert.deepEqual(REQUIRED_SLOTS, schema.properties.slots.required);
    });

    test("every file of the boot skill is the skill, a step file counted here, or its on-read rationale", () => {
        const known = new Set(["rationale.md", ...ENGINE.filter((e) => e.rel.startsWith("plugin/")).map((e) => path.basename(e.rel)), ...STEPS.map((s) => path.basename(s.rel))]);
        const unknown = fs.readdirSync(path.join(REPO, "plugin/skills/portulan")).filter((name) => !known.has(name));
        assert.deepEqual(unknown, [], "a boot that reads a new file of the skill needs it in STEPS in context.mjs; one it reads on demand, here");
    });

    // Each word of a `node` command in the Markdown `text` that carries a path and is not one double-quoted
    // word, as `<line> <word>`. Both directories reach the shell as text, so an unquoted one with a space in
    // its path is two words there: `node` finds no module, or the CLI refuses the rest (Copilot, #446). A
    // path the reader fills in, such as `<workspace-dir>`, is one word only when quoted too, and a quote
    // that does not close is as bad as none (Copilot, #461).
    const unquotedPaths = (text) => {
        const PATH = /\$\{CLAUDE_(?:PLUGIN_ROOT|PROJECT_DIR)[^}]*\}|<[\w-]+>/;
        const found = [];
        // A fence is the one `form` reads Markdown by: backticks or tildes, closed by the same character.
        const lines = text.split("\n");
        const inFence = fenced(lines);
        lines.forEach((line, i) => {
            const code = inFence[i] ? [line] : [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
            // A command starts at `node` after the span's start and any indentation, a `$ ` prompt, a
            // separator, or the `)` that closes a `case` pattern.
            for (const span of code) {
                for (const [, command] of span.matchAll(/(?:^\s*|\$\s+|[;&|()]\s*)(node\s[^;&|)]*)/g)) {
                    for (const [word] of command.matchAll(/(?:"[^"]*"|'[^']*'|[^\s"'])+/g)) {
                        if (PATH.test(word) && !/^"[^"]*"$/.test(word)) found.push(`${i + 1} ${word}`);
                    }
                }
            }
        });
        return found;
    };

    test("every command the boot skill gives passes each path as one double-quoted word", () => {
        const dir = path.join(REPO, "plugin/skills/portulan");
        const unquoted = fs.readdirSync(dir).filter((n) => n.endsWith(".md"))
            .flatMap((name) => unquotedPaths(fs.readFileSync(path.join(dir, name), "utf8")).map((hit) => `${name}:${hit}`));
        assert.deepEqual(unquoted, []);
    });

    test("that check flags each way a path misses its quotes, and passes a quoted one or a path read, not run", () => {
        // A check that finds nothing in the skill proves nothing on its own, so each case it names is here
        // (Copilot, #465).
        const fixture = [
            '`node "${CLAUDE_PLUGIN_ROOT}/cli/doctor.mjs" "<workspace-dir>"`',
            "`node ${CLAUDE_PLUGIN_ROOT}/cli/doctor.mjs`",
            '`node "${CLAUDE_PLUGIN_ROOT}/cli/doctor.mjs`',
            '`node "${CLAUDE_PLUGIN_ROOT}"/cli/doctor.mjs`',
            "`node '${CLAUDE_PLUGIN_ROOT}/cli/doctor.mjs'`",
            "`cd x && node ${CLAUDE_PROJECT_DIR}/y.mjs`",
            "`$ node <workspace-dir>`",
            '`case "$x" in a) node ${CLAUDE_PLUGIN_ROOT}/x.mjs ;; esac`',
            "Read `${CLAUDE_PLUGIN_ROOT}/core/engine.md` in full.",
            "```",
            "node ${CLAUDE_PLUGIN_ROOT}/cli/discover.mjs",
            "```",
            "~~~sh",
            "node ${CLAUDE_PROJECT_DIR}/z.mjs",
            "  node <workspace-dir>",
            "~~~",
        ].join("\n");
        assert.deepEqual(unquotedPaths(fixture), [
            "2 ${CLAUDE_PLUGIN_ROOT}/cli/doctor.mjs",
            "3 ${CLAUDE_PLUGIN_ROOT}/cli/doctor.mjs",
            '4 "${CLAUDE_PLUGIN_ROOT}"/cli/doctor.mjs',
            "5 '${CLAUDE_PLUGIN_ROOT}/cli/doctor.mjs'",
            "6 ${CLAUDE_PROJECT_DIR}/y.mjs",
            "7 <workspace-dir>",
            "8 ${CLAUDE_PLUGIN_ROOT}/x.mjs",
            "11 ${CLAUDE_PLUGIN_ROOT}/cli/discover.mjs",
            "14 ${CLAUDE_PROJECT_DIR}/z.mjs",
            "15 <workspace-dir>",
        ]);
    });
});
