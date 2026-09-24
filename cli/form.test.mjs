// `form` — the one definition of a consumer's new form, which `init`, `vendor`, `upgrade` and `doctor` read.
//
//   node --test "cli/**/*.test.mjs"
//
// The pieces, each against texts and trees built here: what a retired Session log keeps, how the
// changelog's Unreleased entries become fragments and are proved to print back, which `.gitignore` lines
// let git see the compiled card, what a drafted card imports and what it names, and what `doctor`'s
// report reads from disk. What the tools do with them, on trees `init` really drafted, is in
// `init.test.mjs`, `vendor.test.mjs` and `upgrade.test.mjs`.

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
    claudeRulesUnignore,
    cardIgnored,
    changesReadme,
    draftCard,
    formLine,
    formOf,
    gitIn,
    handoffIndexIgnore,
    markdownOnDisk,
    notYetForm,
    retireSessionLogs,
    sessionLogPointer,
    sessionLogSections,
    sessionLogsIn,
    unreleasedCount,
    unreleasedFragments,
    withIgnoreLines,
} from "./form.mjs";
import { renderChanges } from "./index.mjs";

// A HERMETIC HOST. `form` never asks the host where packs are installed, but it imports `./compile.mjs`
// and `./index.mjs`, which can, so this suite neutralises the installed-plugin record the way every suite
// in that closure does. Swept by `pinned-roots.live.test.mjs`, whose header carries the argument.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const made = [];
after(() => {
    for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

/** A directory holding each of `files` at its path. */
function tree(files = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-form-"));
    made.push(dir);
    for (const [rel, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), text);
    }
    return dir;
}

/** `tree`, as a git work tree with nothing committed. */
function repo(files = {}) {
    const dir = tree(files);
    execFileSync("git", ["-C", dir, "init", "-q"]);
    return dir;
}

const POINTER = sessionLogPointer({ date: "2026-09-24", sha: "abc1234", file: "docs/notes.md" });

describe("the Session log", () => {
    test("a section with entries is found to the next heading of its level, and a retired or empty one holds none", () => {
        const text = "# A\n\n## Session log\n\n- one\n\n### Nested\n\n- two\n\n## Next\n\n### Session log\n\nRetired 2026-09-01: a pointer.\n\n## Session log\n\n## End\n";
        assert.deepEqual(
            sessionLogSections(text).map((s) => [s.line, s.entries]),
            [
                [3, true],
                [13, false],
                [17, false],
            ],
        );
    });

    test("a log quoted in fenced code is not one", () => {
        assert.deepEqual(sessionLogSections("# A\n\n```md\n## Session log\n\n- quoted\n```\n"), []);
        assert.deepEqual(sessionLogSections("# A\n\n~~~\n## Session log\n~~~\n\n## Session log\n\n- real\n").map((s) => s.line), [7]);
    });

    test("retiring keeps the heading and two lines, and every other line as it was; a second retirement changes nothing", () => {
        const text = "# Notes\n\nIntro.\n\n## Session log\n\n- 2026-09-20: a thing.\n- 2026-09-21: another.\n\n## Later\n\nStays.\n";
        const once = retireSessionLogs(text, POINTER);
        assert.equal(once, `# Notes\n\nIntro.\n\n## Session log\n\n${POINTER.join("\n")}\n\n## Later\n\nStays.\n`);
        assert.equal(retireSessionLogs(once, POINTER), once);
    });

    test("a log closing the file keeps the file's last newline, and a file without one gains none", () => {
        assert.equal(retireSessionLogs("## Session log\n\n- a\n", POINTER), `## Session log\n\n${POINTER.join("\n")}\n`);
        assert.equal(retireSessionLogs("## Session log\n\n- a", POINTER), `## Session log\n\n${POINTER.join("\n")}`);
    });

    test("the pointer names the commit and the file as `git show` reads them", () => {
        assert.match(POINTER[1], /`git show abc1234:docs\/notes\.md`\.$/);
        assert.match(POINTER[0], /^Retired 2026-09-24: /, "the first line opens `Retired `, which is how a second run knows it");
    });

    test("on disk: every Markdown file, never inside .git, node_modules or a dot-directory other than the workspace's", () => {
        const root = tree({
            "a.md": "## Session log\n\n- a\n",
            "docs/b.md": "# B\n",
            ".portulan/c.md": "## Session log\n\n- c\n",
            ".claude/d.md": "## Session log\n\n- d\n",
            "node_modules/e.md": "## Session log\n\n- e\n",
            "f.txt": "## Session log\n\n- f\n",
        });
        const files = markdownOnDisk(root, ".portulan");
        assert.deepEqual(files, [".portulan/c.md", "a.md", "docs/b.md"]);
        assert.deepEqual(sessionLogsIn(root, files), [
            { file: ".portulan/c.md", line: 1 },
            { file: "a.md", line: 1 },
        ]);
    });
});

describe("the changelog's Unreleased entries, as fragments", () => {
    const changelog = (...unreleased) => ["# Changelog", "", "## [Unreleased]", "", ...unreleased, "", "## [0.1.0] - 2026-09-01", "", "- First.", ""].join("\n");

    test("each bullet, with its indented lines, is a fragment under the section above it, numbered in the changelog's order", () => {
        const moved = unreleasedFragments(changelog("### Fixed", "", "- A fix", "  over two lines.", "", "### Added", "", "* Starred.", "+ Plussed."));
        assert.deepEqual(
            moved.fragments.map((f) => f.name),
            ["1-a-fix.fixed.md", "2-starred.added.md", "3-plussed.added.md"],
        );
        assert.equal(moved.fragments[0].text, "- A fix\n  over two lines.\n");
        assert.equal(moved.fragments[1].text, "- Starred.\n", "a fragment writes its bullet `- `, whichever marker the changelog used");
    });

    test("the changelog keeps the pointer, the prose that was no entry, and every released section as it was", () => {
        const text = changelog("Prose that is no entry.", "", "### Added", "", "- One.");
        const { next } = unreleasedFragments(text);
        assert.equal(
            next,
            [
                "# Changelog",
                "",
                "## [Unreleased]",
                "",
                "Each entry for the next release is a file in [`changes/`](changes/), so two open changes never edit the",
                "same lines; `portulan index --changes changes` prints them as the cut pastes them.",
                "",
                "Prose that is no entry.",
                "",
                "## [0.1.0] - 2026-09-01",
                "",
                "- First.",
                "",
            ].join("\n"),
        );
        assert.equal(unreleasedCount(next), 0);
        assert.equal(unreleasedCount(text), 1);
    });

    test("a relative link moves down one directory, and the cut moves it back; a URL, an anchor and a root path stay", () => {
        const moved = unreleasedFragments(changelog("- See [the guide](docs/guide.md), [the site](https://example.invalid/x), [below](#x) and [root](/r.md)."));
        assert.equal(moved.fragments[0].text, "- See [the guide](../docs/guide.md), [the site](https://example.invalid/x), [below](#x) and [root](/r.md).\n");
        assert.equal(
            renderChanges([{ section: "changed", text: moved.fragments[0].text.trimEnd() }]),
            "### Changed\n\n- See [the guide](docs/guide.md), [the site](https://example.invalid/x), [below](#x) and [root](/r.md).",
        );
    });

    test("an entry under no section heading is a change, and a name already taken is not reused", () => {
        const moved = unreleasedFragments(changelog("- One thing."), new Set(["1-one-thing.changed.md"]));
        assert.deepEqual(moved.fragments.map((f) => f.name), ["1-one-thing-2.changed.md"]);
    });

    test("a heading that names none of the six sections is refused, naming its line", () => {
        const moved = unreleasedFragments(changelog("### Misc", "", "- A thing."));
        assert.match(moved.refused, /^CHANGELOG\.md line 5: `### Misc` under Unreleased is none of added, changed, deprecated, removed, fixed, security/);
    });

    test("a link that already climbs out gains one more `../`, and prints back as the changelog held it", () => {
        const moved = unreleasedFragments(changelog("### Added", "", "- See [up](../x.md) here."));
        assert.equal(moved.refused, undefined);
        assert.equal(moved.fragments[0].text, "- See [up](../../x.md) here.\n");
    });

    test("ten entries or more are numbered to one width, so the cut, which reads them by name, prints them in order", () => {
        const moved = unreleasedFragments(changelog(...Array.from({ length: 10 }, (_, n) => `- Entry ${n + 1}.`)));
        assert.deepEqual([moved.fragments[0].name, moved.fragments[9].name], ["01-entry-1.changed.md", "10-entry-10.changed.md"]);
        const sorted = [...moved.fragments].sort((a, b) => (a.name < b.name ? -1 : 1)).map((f) => f.text);
        assert.deepEqual(sorted, moved.fragments.map((f) => f.text));
    });

    test("no Unreleased heading is null, and one with no entries changes nothing", () => {
        assert.equal(unreleasedFragments("# Changelog\n\n## [0.1.0]\n\n- First.\n"), null);
        assert.equal(unreleasedCount("# Changelog\n"), null);
        const empty = changelog("Nothing yet.");
        assert.deepEqual(unreleasedFragments(empty), { fragments: [], next: empty });
    });

    test("changes/README.md names the six sections and the command that prints them", () => {
        assert.match(changesReadme(), /the section one of added, changed, deprecated, removed, fixed or security/);
        assert.match(changesReadme(), /`portulan index --changes changes`/);
    });
});

describe(".gitignore lines", () => {
    test("appended as one block, once: a second pass changes nothing", () => {
        const lines = handoffIndexIgnore(".portulan/handoffs-index.md", ".portulan");
        assert.equal(lines.at(-1), "/.portulan/handoffs-index.md");
        const once = withIgnoreLines("node_modules/\n", lines);
        assert.equal(once, `node_modules/\n\n${lines.join("\n")}\n`);
        assert.equal(withIgnoreLines(once, lines), once);
        assert.equal(withIgnoreLines(null, lines), `${lines.join("\n")}\n`);
        assert.equal(withIgnoreLines("a", ["b"]), "a\n\nb\n");
    });

    test("a tree ignoring `.claude/` is given the exceptions that let git see the card, and nothing else under it", () => {
        const root = repo({ ".gitignore": ".claude/\n" });
        const git = gitIn(root);
        assert.equal(cardIgnored(root, git), true);
        const { lines } = claudeRulesUnignore(root, git);
        assert.deepEqual(lines.filter((l) => !l.startsWith("#")), ["!/.claude/", "/.claude/*", "!/.claude/rules/", "/.claude/rules/*", "!/.claude/rules/portulan/", "!/.claude/rules/portulan/*"]);
        fs.writeFileSync(path.join(root, ".gitignore"), withIgnoreLines(".claude/\n", lines));
        assert.equal(cardIgnored(root, git), false);
        const ignored = (rel) => git("check-ignore", "-q", "--no-index", rel).status === 0;
        assert.equal(ignored(".claude/settings.local.json"), true, "the host's own state stays ignored");
        assert.equal(ignored(".claude/rules/other.md"), true);
        assert.deepEqual(claudeRulesUnignore(root, git).lines, [], "a second pass owes nothing");
    });

    test("a tree ignoring only the host's local files owes nothing, and a tree without git owes nothing", () => {
        const root = repo({ ".gitignore": ".claude/settings.local.json\n" });
        assert.deepEqual(claudeRulesUnignore(root), { lines: [], git: true });
        assert.deepEqual(claudeRulesUnignore(tree({ ".gitignore": ".claude/\n" })), { lines: [], git: false });
    });
});

describe("which workspaces a step moving the form reads", () => {
    const ctx = { spec: { major: 2 } };
    test("one at the bundle's MAJOR, and none behind it, which a version step moves first", () => {
        assert.equal(notYetForm({ manifest: { portulan: { spec: "2.4" } } }, ctx), null);
        assert.match(notYetForm({ manifest: { portulan: { spec: "1.0" } } }, ctx), /declares 1\.0, and a step moving the form reads 2\.x: a version step moves it first/);
    });
});

describe("the drafted card", () => {
    const manifest = {
        kind: "repository",
        slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md", dod: "dod.md", repos: "repos/", handoffs: "handoffs/" },
        gates: "gates.json",
        memory: { index: { path: "memory-index.md" } },
    };
    const files = {
        "principles.md": "# Principles\n\n1. **Ship small.** Why.\n2. **Say what is enforced.** Why.\n",
        "dod.md": "# Done\n\nProse, and no list.\n",
        "gates.json": "{}",
        "memory-index.md": "- a\n",
    };
    const read = (rel) => files[rel] ?? null;
    const inside = () => true;

    test("a file read whole at boot is imported whole; one whose first list has bold leads gives the card its leads", () => {
        const card = draftCard(manifest, read, { workspace: ".portulan", inTree: inside, repoCards: ["app"] });
        assert.match(card, /^---\ntier: always\n---\n\n# Portulan boot card\n/);
        assert.match(card, /## Identity: `\.portulan\/identity\.md`\n\n@\.\.\/identity\.md\n/);
        assert.match(card, /## Principles: `\.portulan\/principles\.md`\n\n<!-- leads: \.\.\/principles\.md -->\n/);
        assert.match(card, /## Done: `\.portulan\/dod\.md`\n\nOn core's floor[^\n]*\n\n@\.\.\/dod\.md\n/, "no list with leads: imported whole");
        assert.match(card, /<!-- gates: \.\.\/gates\.json -->\n\n\*\*Open `\.portulan\/gate-map\.md` before an act a gate names\*\*/);
        assert.match(card, /## This repository: `\.portulan\/repos\/app\.md`\n\n@\.\.\/repos\/app\.md\n/);
        assert.match(card, /## Memory: [^\n]*\n\nEach record carries its provenance[^\n]*\n\n@\.\.\/memory-index\.md\n$/);
        assert.doesNotMatch(card, /Packs are named/, "no packs, no packs line");
    });

    test("a file outside the tree, which no import reaches, is named with when to read it", () => {
        const card = draftCard({ ...manifest, slots: { ...manifest.slots, identity: "../team/identity.md" } }, read, {
            workspace: ".portulan",
            inTree: (rel) => !rel.startsWith(".."),
        });
        assert.match(card, /## Identity: `team\/identity\.md`\n\nRead `team\/identity\.md` in full at boot: it lies outside this repository, where no import reaches\.\n/);
    });

    test("with no gate policy, the gate map is read in full; with packs, the card says where they are described", () => {
        const card = draftCard({ ...manifest, gates: undefined, packs: ["team-rules"] }, read, { workspace: ".portulan", inTree: inside });
        assert.doesNotMatch(card, /<!-- gates:/);
        assert.match(card, /Read `\.portulan\/gate-map\.md` in full at boot: this workspace declares no gate policy for the card to list\./);
        assert.match(card, /\*\*A pack is resolved by a step of its own\*\*: read the plugin's `skills\/portulan\/packs\.md` before\n  you say what one delivers\./);
        assert.match(card, /## This repository: its card in `\.portulan\/repos\/`\n\nRead the card in `\.portulan\/repos\/` that names this repository/);
    });
});

describe("which form a consumer is in, read from disk", () => {
    const manifest = (more = {}) => ({ kind: "repository", tree: "../", slots: {}, ...more });

    test("no tree, no pieces, and the report says why", () => {
        const ws = tree();
        assert.deepEqual(formOf(ws, { kind: "demo" }), { tree: null, pieces: [] });
        assert.match(formLine(ws, { kind: "demo" }), /^not reported: this workspace declares no tree/);
    });

    test("a handoff index counts as not kept where the root .gitignore names it, with its slash or without", () => {
        for (const line of ["/.portulan/handoffs-index.md", ".portulan/handoffs-index.md"]) {
            const root = tree({ ".gitignore": `${line}\n`, ".portulan/handoffs-index.md": "" });
            const pieces = formOf(path.join(root, ".portulan"), manifest({ handoffs: { index: { path: "handoffs-index.md" } } })).pieces;
            assert.deepEqual(pieces.find((p) => p.id === "handoff-index"), { id: "handoff-index", state: "new", text: "the handoff index is printed on demand, not kept" });
        }
        const kept = tree({ ".portulan/handoffs-index.md": "" });
        const piece = formOf(path.join(kept, ".portulan"), manifest({ handoffs: { index: { path: "handoffs-index.md" } } })).pieces.find((p) => p.id === "handoff-index");
        assert.equal(piece.state, "today");
        assert.match(piece.text, /is not git-ignored, and a copy is kept$/);
    });

    test("a card drafted and not compiled is today's, and compiled it is the new form", () => {
        const root = tree({ ".portulan/context/boot.md": "---\ntier: always\n---\n\n# Portulan boot card\n" });
        const ws = path.join(root, ".portulan");
        const m = manifest({ slots: { context: "context/" } });
        assert.match(formOf(ws, m).pieces.find((p) => p.id === "card").text, /not yet compiled to \.claude\/rules\/portulan\/boot\.md: run `portulan compile`/);
        fs.mkdirSync(path.join(root, ".claude", "rules", "portulan"), { recursive: true });
        fs.writeFileSync(path.join(root, ".claude", "rules", "portulan", "boot.md"), "# Portulan boot card\n");
        assert.equal(formLine(ws, m), "the new form: no Session log with entries; a compiled boot card");
    });

    test("only a repository workspace has a card piece, and a changelog piece needs a changelog or fragments", () => {
        const root = tree();
        const ids = (m) => formOf(path.join(root, ".portulan"), m).pieces.map((p) => p.id);
        assert.deepEqual(ids(manifest({ kind: "portfolio" })), ["session-log"]);
        assert.deepEqual(ids(manifest()), ["session-log", "card"]);
    });
});
