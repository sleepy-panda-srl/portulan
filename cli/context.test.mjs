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
    ESTIMATED_BYTES_PER_TOKEN,
    OFFER_FLOOR_TOKENS,
    REQUIRED_SLOTS,
    STEPS,
    alwaysTier,
    importsOf,
    measure,
    pluginDescriptions,
    railFor,
    run,
    tokensOf,
} from "./context.mjs";

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
            ["boot skill", "kernel", "manifest", "identity", "principles", "constitution", "gates", "dod", "repo card", "memory index"],
        );
        for (const e of result.boot.entries) assert.equal(e.bytes, fs.statSync(e.file).size, e.label);
        const manifest = result.boot.entries.find((e) => e.label === "manifest").bytes;
        assert.equal(result.figures.records, result.figures.boot - manifest);
        assert.equal(result.figures.engine, fs.statSync(path.join(bundleRoot, "plugin/skills/portulan/SKILL.md")).size + fs.statSync(path.join(bundleRoot, "core/engine.md")).size);
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
});

describe("the always tier", () => {
    test("instruction files and their imports count once each, within the host's five hops", () => {
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
            ["CLAUDE.md", ".claude/CLAUDE.md", "docs/d1.md", "docs/d2.md", "docs/d3.md", "docs/d4.md", "docs/d5.md"],
        );
        assert.deepEqual(always.tooDeep, ["@d6.md (in docs/d5.md)"]);
        assert.deepEqual(always.missing, ["@missing.md (in CLAUDE.md)"]);
        assert.deepEqual(always.outside, ["@~/home.md. (in CLAUDE.md)"]);
    });

    test("a trailing full stop is not part of the path it ends", () => {
        const root = tree({ "CLAUDE.md": "See @docs/a.md.\n", "docs/a.md": "a\n" });
        assert.deepEqual(alwaysTier(root).entries.map((e) => path.relative(root, e.file)), ["CLAUDE.md", "docs/a.md"]);
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
        assert.equal(result.boot.card.selected, "portulan");
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
        const known = new Set(["SKILL.md", "rationale.md", ...STEPS.map((s) => path.basename(s.rel))]);
        const unknown = fs.readdirSync(path.join(REPO, "plugin/skills/portulan")).filter((name) => !known.has(name));
        assert.deepEqual(unknown, [], "a boot that reads a new file of the skill needs it in STEPS in context.mjs; one it reads on demand, here");
    });
});
