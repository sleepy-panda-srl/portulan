// `instructions`: the sections a team marks in its own instruction file, moved to on-read units and proved.
// The marks, the split and its proof, what it refuses, the join, the offer `doctor` and `init` print, and the
// invented consumer of `fixtures/consumer/`, split by the command line and measured.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileGuidance } from "./compile.mjs";
import { alwaysTier } from "./context.mjs";
import {
    ON_READ_MARK,
    clausesOf,
    instructionsState,
    joinLine,
    landed,
    marksOf,
    movedMark,
    offerText,
    planJoin,
    planSplit,
    run,
    splitCommand,
    splitOffers,
    treeReader,
    unitDigest,
    unitName,
} from "./instructions.mjs";

const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const FIXTURE = path.join(HERE, "fixtures", "consumer", "instructions.md");
const SLOT = ".portulan/context/";

const scratches = [];
function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-instructions-"));
    scratches.push(dir);
    return dir;
}
process.on("exit", () => {
    for (const dir of scratches) fs.rmSync(dir, { recursive: true, force: true });
});

/** A repository holding `files`, and its split planned as the command line plans it. */
function split(files, { context = SLOT, taken = [] } = {}) {
    const tree = scratch();
    for (const [rel, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(tree, rel)), { recursive: true });
        fs.writeFileSync(path.join(tree, rel), text);
    }
    const read = treeReader(tree);
    return { tree, read, ...planSplit({ tree, context, taken, read }) };
}

/** `text` with a mark on the line under each heading named. */
const mark = (text, ...headings) => text.split("\n").flatMap((line) => (headings.includes(line) ? [line, ON_READ_MARK] : [line])).join("\n");

const FILE = [
    "# Reading room",
    "",
    "The service lends books. Every change is reviewed.",
    "",
    "## Build",
    "",
    ON_READ_MARK,
    "",
    "Run the build with `make`. It takes two minutes on a laptop.",
    "",
    "- Fetch every dependency before the first build.",
    "",
    "## Style",
    "",
    "Keep every line under a hundred characters.",
    "",
    "## Release",
    ON_READ_MARK,
    "Tag the release on the main branch. Publish the notes after it.",
    "",
    "### Rolling back",
    "",
    "Revert the tag first. Then tell the desk staff.",
    "",
].join("\n");

describe("a mark is the team's word, directly under the heading of the section it moves", () => {
    test("under an ATX heading, and under a setext heading of two lines, a mark names its section; under a paragraph, none", () => {
        const text = ["# Title", ON_READ_MARK, "", "A two-line", "setext title", "---", "", ON_READ_MARK, "", "Body.", "", "A paragraph.", ON_READ_MARK, ""].join("\n");
        const { marks } = marksOf(text);
        assert.deepEqual(
            marks.map((m) => [m.line, m.heading?.title ?? null]),
            [
                [1, "Title"],
                [7, "A two-line setext title"],
                [12, null],
            ],
        );
    });

    test("a mark may be indented less than a code block is and carry space after it; indented as one, it is code", () => {
        assert.equal(marksOf(`## A\n   ${ON_READ_MARK} \t\n\nText.\n`).marks[0].heading.title, "A");
        assert.deepEqual(marksOf(`## A\n\n    ${ON_READ_MARK}\n\nText.\n`).marks, []);
    });

    test("a mark in a fenced block, or in a comment running over lines, is text and marks nothing", () => {
        const text = ["## Kept", "```", ON_READ_MARK, "```", "", "## Also kept", "<!--", ON_READ_MARK.slice(0, -4), "-->", ""].join("\n");
        assert.deepEqual(marksOf(text).marks, []);
        const planned = split({ "CLAUDE.md": text });
        assert.equal(planned.marked, 0);
        assert.deepEqual(planned.refusals, []);
    });
});

describe("the split moves each marked section whole, and proves it before anything is written", () => {
    test("a section leaves a marker and becomes an on-read unit named and described by its heading; the file reassembles byte for byte", () => {
        const planned = split({ "CLAUDE.md": FILE });
        assert.deepEqual(planned.refusals, []);
        assert.deepEqual(
            planned.units.map((u) => [u.source, u.title]),
            [
                [".portulan/context/build.md", "Build"],
                [".portulan/context/release.md", "Release"],
            ],
        );
        const [file] = planned.files;
        const [build, release] = planned.units.map((u) => movedMark(u.source, unitDigest(u.text)));
        assert.equal(file.after, ["# Reading room", "", "The service lends books. Every change is reviewed.", "", build, "", "## Style", "", "Keep every line under a hundred characters.", "", release, ""].join("\n"));
        assert.equal(
            planned.units[0].text,
            ["---", "tier: on-read", 'description: "Build"', "---", "", "## Build", "", "Run the build with `make`. It takes two minutes on a laptop.", "", "- Fetch every dependency before the first build.", ""].join("\n"),
            "the mark and one blank line beside it are all that leave with it",
        );
        assert.match(planned.units[1].text, /\n---\n\n## Release\nTag the release on the main branch\. Publish the notes after it\.\n\n### Rolling back\n\nRevert the tag first\. Then tell the desk staff\.\n$/);
        assert.equal(file.exact, true);
        assert.deepEqual(file.clauses, { clauses: 12, kept: 4, moved: 8, missing: 0, doubled: 0 });
        assert.equal(file.removed, Buffer.byteLength(FILE) - Buffer.byteLength(file.after));
        assert.equal(planned.units[0].bytes, Buffer.byteLength(planned.units[0].text), "a unit's size is its file's");
    });

    test("a title holding the whole file is left out of a description, and a nested section names the heading above it", () => {
        const planned = split({ "CLAUDE.md": mark(FILE.replace(ON_READ_MARK, "x").replace(`## Release\n${ON_READ_MARK}\n`, "## Release\n"), "### Rolling back") });
        assert.deepEqual(planned.refusals, []);
        assert.deepEqual(planned.units.map((u) => [u.name, u.title]), [["rolling-back", "Release > Rolling back"]]);
    });

    test("a file with CRLF line ends splits with them kept, in the file and in the unit", () => {
        const crlf = FILE.replaceAll("\n", "\r\n");
        const planned = split({ "CLAUDE.md": crlf });
        assert.deepEqual(planned.refusals, []);
        assert.equal(planned.files[0].exact, true);
        assert.ok(!/[^\r]\n/.test(planned.files[0].after) && !/[^\r]\n/.test(planned.units[0].text), "every line ends CRLF");
        assert.equal(planned.files[0].after, split({ "CLAUDE.md": FILE }).files[0].after.replaceAll("\n", "\r\n"));
    });

    test("a marker's digest is the section's the unit holds: its description and its line ends are no edit to it", () => {
        const unit = '---\ntier: on-read\ndescription: "A"\n---\n\n## A\n\nText.\n';
        assert.match(unitDigest(unit), /^[0-9a-f]{8}$/);
        assert.equal(unitDigest(unit.replaceAll("\n", "\r\n")), unitDigest(unit));
        assert.equal(unitDigest(`\uFEFF${unit}`), unitDigest(unit));
        assert.equal(unitDigest(unit.replace('"A"', '"A, and what it is for"')), unitDigest(unit));
        assert.notEqual(unitDigest(unit.replace("Text.", "Text!")), unitDigest(unit));
    });

    test("a slot whose path holds a space takes the split, and its markers read back", () => {
        const planned = split({ "CLAUDE.md": FILE }, { context: "docs/team notes/" });
        assert.deepEqual(planned.refusals, []);
        assert.equal(planned.files[0].exact, true);
        assert.deepEqual(marksOf(planned.files[0].after).moved.map((m) => m.source), ["docs/team notes/build.md", "docs/team notes/release.md"]);
    });

    test("a unit's name takes none already in the slot, nor the boot card's or the index's", () => {
        const taken = new Set(["build"]);
        assert.equal(unitName("Build", taken), "build-2");
        assert.equal(unitName("Boot", new Set()), "boot-2");
        assert.equal(unitName("On read", new Set()), "on-read-2");
        assert.equal(unitName("Café & Überblick!", new Set()), "cafe-uberblick");
        assert.equal(unitName("¿?", new Set()), "section");
        assert.deepEqual(split({ "CLAUDE.md": FILE }, { taken: ["build"] }).units.map((u) => u.name), ["build-2", "release"]);
    });

    test("a name a marker still gives is taken, though its unit is gone, and a marker naming a path out of the repository is none", () => {
        const withMarker = FILE.replace("## Build", `${movedMark(".portulan/context/build.md", "0123abcd")}\n\n## Build`);
        assert.deepEqual(split({ "CLAUDE.md": withMarker }).units.map((u) => u.name), ["build-2", "release"]);
        assert.deepEqual(marksOf(`${movedMark("../outside.md", "0123abcd")}\n${movedMark("/abs.md", "0123abcd")}\n${movedMark("notes.txt", "0123abcd")}\n`).moved, []);
        assert.deepEqual(marksOf("<!-- portulan: on-read .portulan/context/build.md -->\n").moved, [], "a marker the split did not write, with no digest, is text");
    });

    test(".claude/CLAUDE.md is split as CLAUDE.md is, from its own place", () => {
        const planned = split({ ".claude/CLAUDE.md": FILE });
        assert.deepEqual(planned.refusals, []);
        assert.deepEqual(planned.files.map((f) => f.rel), [".claude/CLAUDE.md"]);
        assert.deepEqual(planned.units.map((u) => u.from), [".claude/CLAUDE.md", ".claude/CLAUDE.md"]);
    });
});

describe("a mark is refused, and nothing moves, where moving it would change what loads", () => {
    test("a section importing a file refuses, since an on-read unit's import loads nothing; an `@` naming no file is text", () => {
        const importing = FILE.replace("Run the build", "@docs/build.md\n\nRun the build");
        const refused = split({ "CLAUDE.md": importing, "docs/build.md": "# Build\n" });
        assert.equal(refused.files.length, 0);
        assert.match(refused.refusals.join("\n"), /the section "Build" \(line 5 of CLAUDE\.md\) imports @docs\/build\.md, which loads into every context from CLAUDE\.md/);
        assert.deepEqual(split({ "CLAUDE.md": importing }).refusals, [], "no file there, so nothing loads and nothing changes");
        assert.match(split({ "CLAUDE.md": FILE.replace("Run the build", "@~/.team/build.md\n\nRun the build") }).refusals.join("\n"), /imports @~\/\.team\/build\.md/, "a home import is one this cannot see, so it counts as loading");
    });

    test("a mark inside another marked section, a mark under no heading, and a section holding an earlier marker are each refused", () => {
        assert.match(split({ "CLAUDE.md": mark(FILE, "### Rolling back") }).refusals.join("\n"), /the section "Rolling back" \(line 21 of CLAUDE\.md\) is marked inside the marked section "Release"/);
        assert.match(split({ "CLAUDE.md": FILE.replace("Keep every line", `Keep it short.\n${ON_READ_MARK}\nKeep every line`) }).refusals.join("\n"), /line 16 of CLAUDE\.md is a mark under no heading/);
        assert.match(split({ "CLAUDE.md": FILE.replace("Revert the tag", `${movedMark(".portulan/context/older.md", "0123abcd")}\n\nRevert the tag`) }).refusals.join("\n"), /holds the marker of a section moved before it, \.portulan\/context\/older\.md/);
    });

    test("an instruction file that is a link is refused, and not offered, since another host may load the file it names whole", () => {
        const tree = scratch();
        fs.writeFileSync(path.join(tree, "AGENTS.md"), FILE);
        fs.symlinkSync("AGENTS.md", path.join(tree, "CLAUDE.md"));
        const planned = planSplit({ tree, context: SLOT, taken: [], read: treeReader(tree) });
        assert.deepEqual([planned.units, planned.files], [[], []]);
        assert.match(planned.refusals.join("\n"), /^CLAUDE\.md is a link, to AGENTS\.md, and another host may load that file whole: the split moves sections of a file of its own — make CLAUDE\.md one to split it$/);
        assert.deepEqual(splitOffers(tree, { ratio: 3, floor: 0 }), []);
        assert.equal(splitOffers(split({ "CLAUDE.md": FILE }).tree, { ratio: 3, floor: 0 }).length, 1, "the same file, not a link, is offered");
    });

    test("with no `slots.context`, there is nowhere for a unit to go, and the split says so", () => {
        const planned = split({ "CLAUDE.md": FILE }, { context: null });
        assert.equal(planned.units.length, 0);
        assert.match(planned.refusals.join("\n"), /CLAUDE\.md has a marked section, and the workspace declares no `slots\.context`/);
    });
});

describe("the join puts each moved section back where its marker is", () => {
    /** The file split, then the units as `edit` leaves them, planned for the join. */
    const joinAfter = (edit = (u) => u.text, file = FILE) => {
        const planned = split({ "CLAUDE.md": file });
        const back = split({ "CLAUDE.md": planned.files[0].after, ...Object.fromEntries(planned.units.map((u) => [u.source, edit(u)]).filter(([, text]) => text !== null)) });
        return { planned, back, joined: planJoin({ tree: back.tree, context: SLOT, read: back.read }) };
    };
    /** The bytes of the section a unit holds, as the join puts it back: the unit less its frontmatter. */
    const section = (text) => Buffer.byteLength(text.slice(text.indexOf("\n---\n\n") + 6));

    test("a join after a split gives back the file less its marks, each unit is removed, and each says it goes back as the move left it", () => {
        const { planned, joined } = joinAfter();
        assert.deepEqual(joined.refusals, []);
        assert.deepEqual(joined.units.map((u) => u.source), [".portulan/context/build.md", ".portulan/context/release.md"]);
        assert.equal(joined.files[0].after, FILE.replace(`${ON_READ_MARK}\n\n`, "").replace(`${ON_READ_MARK}\n`, ""));
        assert.deepEqual({ ...joined.files[0].clauses, clauses: undefined }, { clauses: undefined, kept: 12, moved: 0, missing: 0, doubled: 0 });
        assert.equal(joinLine(joined.units[0], "CLAUDE.md"), `.portulan/context/build.md: ${section(planned.units[0].text)} B go back into CLAUDE.md under "Build", as the move left it`);
    });

    test("a unit edited since goes back as it stands and says so, and a description the file cannot keep is named, and is no edit", () => {
        const edits = { build: (t) => t.replace("two minutes", "three minutes"), release: (t) => t.replace('description: "Release"', 'description: "Tagging a release, and rolling one back"') };
        const edited = (u) => edits[u.name](u.text);
        const { planned, joined } = joinAfter(edited);
        assert.deepEqual(joined.refusals, []);
        assert.match(joined.files[0].after, /It takes three minutes on a laptop\./);
        assert.deepEqual(
            joined.units.map((u) => joinLine(u, "CLAUDE.md")),
            [
                `.portulan/context/build.md: ${section(edited(planned.units[0]))} B go back into CLAUDE.md under "Build", as it stands now, edited since the move`,
                `.portulan/context/release.md: ${section(planned.units[1].text)} B go back into CLAUDE.md under "Release", as the move left it; ` +
                    'its description, "Tagging a release, and rolling one back", is not kept, since CLAUDE.md names a section by its heading',
            ],
        );
    });

    test("a section goes back in the line ends it had: as its unit holds them, or its marker's where a checkout turned them all", () => {
        const lf = joinAfter((u) => u.text.replaceAll("\n", "\r\n"));
        assert.equal(lf.joined.files[0].after, FILE.replace(`${ON_READ_MARK}\n\n`, "").replace(`${ON_READ_MARK}\n`, ""), "a unit a checkout made CRLF goes back into an LF file as LF lines");
        assert.match(joinLine(lf.joined.units[0], "CLAUDE.md"), /, as the move left it$/, "and is no edit");
        // A CRLF file whose marked section ends it with no line end: the marker ends as that line did, and so
        // does the section put back.
        const crlf = FILE.replaceAll("\n", "\r\n").replace(/\r\n$/, "");
        const unended = joinAfter(undefined, crlf);
        assert.match(unended.planned.files[0].after, / -->$/, "the marker takes no line end the section's last line did not have");
        assert.equal(unended.joined.files[0].after, crlf.replace(`${ON_READ_MARK}\r\n\r\n`, "").replace(`${ON_READ_MARK}\r\n`, ""));
        // A CRLF file whose Build section alone is LF: that section goes back LF, as the move took it.
        const lines = FILE.split("\n");
        const [build, style] = [lines.indexOf("## Build"), lines.indexOf("## Style")];
        const mixed = lines.map((l, i) => (i === lines.length - 1 || (i >= build && i < style) ? l : `${l}\r`)).join("\n");
        const both = joinAfter(undefined, mixed);
        assert.equal(both.joined.files[0].after, mixed.replace(`${ON_READ_MARK}\n\n`, "").replace(`${ON_READ_MARK}\r\n`, ""));
        // An LF file whose Build section is CRLF but for its last line, as a block pasted from elsewhere: no
        // checkout turned it, and it goes back as it was.
        const fetch = lines.indexOf("- Fetch every dependency before the first build.");
        const pasted = lines.map((l, i) => (i >= build && i < fetch ? `${l}\r` : l)).join("\n");
        const kept = joinAfter(undefined, pasted);
        assert.equal(kept.joined.files[0].after, pasted.replace(`${ON_READ_MARK}\r\n\r\n`, "").replace(`${ON_READ_MARK}\n`, ""));
    });

    test("a unit a byte-order mark opens goes back with none of its frontmatter, and is no edit", () => {
        const { joined } = joinAfter((u) => `\uFEFF${u.text}`);
        assert.deepEqual(joined.refusals, []);
        assert.equal(joined.files[0].after, FILE.replace(`${ON_READ_MARK}\n\n`, "").replace(`${ON_READ_MARK}\n`, ""));
        assert.match(joinLine(joined.units[0], "CLAUDE.md"), /, as the move left it$/);
    });

    test("a marker naming a file outside `slots.context`, or below its top, is refused, and the file is left where it is", () => {
        const planned = split({ "CLAUDE.md": FILE });
        const [build, release] = planned.units;
        const elsewhere = planned.files[0].after.replace(build.source, "docs/build.md");
        const back = split({ "CLAUDE.md": elsewhere, "docs/build.md": build.text, [release.source]: release.text });
        const joined = planJoin({ tree: back.tree, context: SLOT, read: back.read });
        assert.deepEqual(joined.files, []);
        assert.match(joined.refusals.join("\n"), /^line 5 of CLAUDE\.md names docs\/build\.md, which is not at the top of `slots\.context` \(\.portulan\/context\/\), where the split makes every unit: put the section back by hand, or delete the marker$/);
        assert.match(planJoin({ tree: back.tree, context: null, read: back.read }).refusals.join("\n"), /names docs\/build\.md, and the workspace declares no `slots\.context`/);
        // A file below the slot is no unit `compile` reads, whatever tier its frontmatter names.
        const below = `${SLOT}notes/build.md`;
        const nested = split({ "CLAUDE.md": planned.files[0].after.replace(build.source, below), [below]: build.text, [release.source]: release.text });
        const kept = planJoin({ tree: nested.tree, context: SLOT, read: nested.read });
        assert.deepEqual(kept.files, []);
        assert.match(kept.refusals.join("\n"), /^line 5 of CLAUDE\.md names \.portulan\/context\/notes\/build\.md, which is not at the top of `slots\.context`/);
    });

    test("a unit re-tiered since, one gone, and one now importing a file are refused, and nothing goes back", () => {
        const refused = (edit) => joinAfter(edit).joined;
        const onPath = refused((u) => (u.name === "build" ? u.text.replace("tier: on-read", 'tier: on-path\npaths: ["src/**"]') : u.text));
        assert.deepEqual(onPath.files, []);
        assert.match(
            onPath.refusals.join("\n"),
            /^\.portulan\/context\/build\.md is `tier: on-path` with `paths` now, and the split made it `on-read`: re-tier it to on-read to put it back, or delete the marker at line 5 of CLAUDE\.md to keep it$/,
        );
        const always = refused((u) => (u.name === "build" ? u.text.replace("tier: on-read", "tier: always").replace(/description: .*\n/, "") : u.text));
        assert.match(always.refusals.join("\n"), /^\.portulan\/context\/build\.md is `tier: always` now, and the split made it `on-read`/);
        const gone = refused((u) => (u.name === "build" ? null : u.text));
        assert.match(gone.refusals.join("\n"), /line 5 of CLAUDE\.md names \.portulan\/context\/build\.md, which is not there: restore it, or delete the marker/);
        const planned = split({ "CLAUDE.md": FILE });
        const [build, release] = planned.units;
        const importing = split({ "CLAUDE.md": planned.files[0].after, [build.source]: build.text.replace("## Build\n", "## Build\n\n@docs/a.md\n"), [release.source]: release.text, "docs/a.md": "a\n" });
        assert.match(planJoin({ tree: importing.tree, context: SLOT, read: importing.read }).refusals.join("\n"), /\.portulan\/context\/build\.md imports @docs\/a\.md, which would load into every context from CLAUDE\.md/);
    });
});

describe("clauses: where each one landed", () => {
    test("a sentence held twice is two clauses, and one written once too often is doubled", () => {
        const before = clausesOf("One sentence that repeats. One sentence that repeats.\n\nAnother sentence here.");
        assert.equal(before.length, 3);
        assert.deepEqual(landed(before, ["One sentence that repeats"], ["One sentence that repeats", "Another sentence here"]), { clauses: 3, kept: 1, moved: 2, missing: 0, doubled: 0 });
        assert.deepEqual(landed(before, [], ["Another sentence here", "Another sentence here"]), { clauses: 3, kept: 0, moved: 1, missing: 2, doubled: 1 });
        assert.deepEqual(clausesOf(`## A heading of some length\n${ON_READ_MARK}\n| a cell of some length | another cell here |`), ["A heading of some length", "a cell of some length", "another cell here"]);
    });
});

describe("the offer `doctor`, the boot and `init` print, and the state `form` reports", () => {
    const big = ["# Big", "", "## Loans", "", "Every loan is recorded at the desk. ".repeat(900), "", "## Rooms", "", "Rooms are booked a week ahead. ".repeat(300), "", "## Imported", "", "@docs/a.md", ""].join("\n");

    test("a file over the floor is offered, its largest movable sections first, and one importing a file is not among them", () => {
        const { tree } = split({ "CLAUDE.md": big, "docs/a.md": "a\n" });
        const [offer] = splitOffers(tree, { ratio: 3, floor: 8000 });
        assert.equal(offer.rel, "CLAUDE.md");
        assert.deepEqual(offer.sections.map((s) => s.title), ["Loans", "Rooms"]);
        assert.equal(
            offerText([offer]),
            `CLAUDE.md is ~${Math.round(Buffer.byteLength(big) / 3).toLocaleString("en-US")} tokens in every context, and a line \`${ON_READ_MARK}\` under a heading moves that section to an on-read unit at the next \`portulan upgrade --write\`: its largest are "Loans" ~${Math.round(offer.sections[0].tokens).toLocaleString("en-US")} and "Rooms" ~${offer.sections[1].tokens.toLocaleString("en-US")} tokens`,
        );
        assert.equal(offerText([]), null);
        assert.deepEqual(splitOffers(tree, { ratio: 3, floor: 20000 }), [], "under the floor, nothing is offered");
        const [over] = splitOffers(tree, { ratio: 3, floor: 20000, over: true });
        assert.ok(over, "over a declared budget, it is offered all the same");
        assert.match(offerText([over], { over: true, workspace: ".portulan" }), /at the next `node <plugin root>\/cli\/instructions\.mjs --workspace \.portulan --write`: its largest are/, "and by the command that runs where `upgrade` will not");
        assert.equal(splitCommand("tools/team notes"), "node <plugin root>/cli/instructions.mjs --workspace 'tools/team notes' --write", "a path a shell would split is quoted");
    });

    test("two files over the floor are one sentence, naming both and the largest sections of the two", () => {
        const { tree } = split({ "CLAUDE.md": big, ".claude/CLAUDE.md": big.replace("## Loans", "## Fines").replace("## Rooms", "## Events") });
        const offers = splitOffers(tree, { ratio: 3, floor: 8000 });
        assert.deepEqual(offers.map((o) => o.rel), ["CLAUDE.md", ".claude/CLAUDE.md"]);
        assert.match(
            offerText(offers),
            /^CLAUDE\.md is ~[\d,]+ tokens in every context and \.claude\/CLAUDE\.md ~[\d,]+, and a line `<!-- portulan: on-read -->` under a heading moves that section to an on-read unit at the next `portulan upgrade --write`: their largest are "Loans" \(CLAUDE\.md\) ~[\d,]+, "Fines" \(\.claude\/CLAUDE\.md\) ~[\d,]+ and "Rooms" \(CLAUDE\.md\) ~[\d,]+ tokens$/,
        );
    });

    test("the state names the marks waiting, the sections moved, and a marker naming a unit that is gone", () => {
        const planned = split({ "CLAUDE.md": FILE });
        assert.deepEqual(instructionsState(planned.tree, planned.read), { pending: 2, moved: 0, gone: [], files: ["CLAUDE.md"] });
        const moved = split({ "CLAUDE.md": planned.files[0].after, [planned.units[1].source]: planned.units[1].text });
        assert.deepEqual(instructionsState(moved.tree, moved.read), { pending: 0, moved: 2, gone: [".portulan/context/build.md"], files: ["CLAUDE.md"] });
    });
});

// ===========================================================================================
// The invented consumer, split by the command line and measured
// ===========================================================================================

const git = (repo, ...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" });
const MARKED = ["## Catalogue records", "## Room bookings", "## Releases"];

/** A consumer drafted by the real `init`, its instruction file the fixture with three sections marked, committed. */
function consumer() {
    const repo = scratch();
    git(repo, "init", "-q");
    git(repo, "config", "user.email", "fixture@example.invalid");
    git(repo, "config", "user.name", "Fixture");
    execFileSync(process.execPath, [path.join(REPO, "cli", "init.mjs"), "--residence", "in-repo", "--no-interview", "--no-cycle", repo], { stdio: "pipe" });
    fs.writeFileSync(path.join(repo, "CLAUDE.md"), mark(fs.readFileSync(FIXTURE, "utf8"), ...MARKED));
    git(repo, "add", "-A");
    git(repo, "commit", "-qm", "a consumer with three sections marked");
    return { repo, ws: path.join(repo, ".portulan") };
}

async function cli(argv, options = {}) {
    const out = [];
    const code = await run(argv, (line) => out.push(line), { cwd: REPO, ...options });
    return { code, text: out.join("\n") };
}

const alwaysBytes = (repo) => alwaysTier(repo).entries.reduce((n, e) => n + e.bytes, 0);

describe("the invented consumer of fixtures/consumer/, split and measured", () => {
    test("the fixture is its own: no heading of it is marked, it holds no import, and every mark this suite adds lands under a heading", () => {
        const text = fs.readFileSync(FIXTURE, "utf8");
        assert.deepEqual(marksOf(text), { marks: [], moved: [] });
        assert.equal(/(?:^|\s)@\S/.test(text), false);
        for (const heading of MARKED) assert.ok(text.split("\n").includes(heading), heading);
    });

    test("without --write the plan prints each move, the proof and both figures, and writes nothing", async () => {
        const { repo, ws } = consumer();
        const { code, text } = await cli(["--workspace", ws]);
        assert.equal(code, 0, text);
        assert.match(text, /"Catalogue records" in CLAUDE\.md → \.portulan\/context\/catalogue-records\.md, 5,872 B/);
        assert.match(text, /CLAUDE\.md reassembles from its units byte for byte, and of its 140 clauses 60 stay and 80 move, none missing and none doubled/);
        assert.match(text, /the always tier goes from [\d,]+ B \(~[\d,]+ tokens\) to [\d,]+ B \(~[\d,]+ tokens\) at 2\.99 bytes per token/);
        assert.match(text, /nothing was written/);
        assert.equal(git(repo, "status", "--porcelain"), "");
    });

    test("--write moves three sections, compiles one index line each, and the always tier falls by what the plan said", async () => {
        const { repo, ws } = consumer();
        const before = alwaysBytes(repo);
        const claude = fs.readFileSync(path.join(repo, "CLAUDE.md"), "utf8");
        const { code, text } = await cli(["--workspace", ws, "--write"]);
        assert.equal(code, 0, text);
        const planned = /to ([\d,]+) B \(~/.exec(text)[1].replaceAll(",", "");
        const after = alwaysBytes(repo);
        assert.equal(after, Number(planned), "the figure the plan printed is the one measured after");

        // The fixture's figures, held: the instruction file before and after, the units, the index.
        const now = fs.readFileSync(path.join(repo, "CLAUDE.md"), "utf8");
        const units = ["catalogue-records", "room-bookings", "releases"].map((n) => fs.readFileSync(path.join(ws, "context", `${n}.md`), "utf8"));
        const index = fs.readFileSync(path.join(repo, ".claude", "rules", "portulan", "on-read.md"), "utf8");
        assert.deepEqual(
            { claude: Buffer.byteLength(claude), now: Buffer.byteLength(now), units: units.map((u) => Buffer.byteLength(u)), index: Buffer.byteLength(index) },
            FIGURES,
        );
        assert.equal(before - after, FIGURES.claude - FIGURES.now - FIGURES.index);
        assert.equal(index.split("\n").length, 4);
        assert.equal(index, "- `.portulan/context/catalogue-records.md` (~6 KB): Catalogue records\n- `.portulan/context/releases.md` (~1 KB): Releases\n- `.portulan/context/room-bookings.md` (~2 KB): Room bookings\n");
        assert.equal(compileGuidance(ws, { check: true }).drifted, 0, "the index is what `compile` writes");
        assert.match(text, /0036 offers the larger of 8,000 tokens and that/);
    });

    test("after a split where a budget is declared, the write offers none", async () => {
        const { ws } = consumer();
        const manifest = JSON.parse(fs.readFileSync(path.join(ws, "workspace.json"), "utf8"));
        manifest.context = { always: { budget: { tokens: 20000 } }, ratio: { bytes_per_token: 2.99, calibrated_by: "a-host" } };
        fs.writeFileSync(path.join(ws, "workspace.json"), `${JSON.stringify(manifest, null, 2)}\n`);
        const { code, text } = await cli(["--workspace", ws, "--write"]);
        assert.equal(code, 0, text);
        assert.match(text, /^instructions: written, and the index compiled: the always tier is [\d,]+ B \(~[\d,]+ tokens\)$/m);
        assert.doesNotMatch(text, /A budget is yours to declare/);
    });

    test("with an on-read unit in the slot already, its index line stale, the figure the plan printed is still the one measured after", async () => {
        const { repo, ws } = consumer();
        const glossary = path.join(ws, "context", "glossary.md");
        fs.writeFileSync(glossary, '---\ntier: on-read\ndescription: "Glossary"\n---\n\n# Glossary\n\nA shelfmark names where a copy stands.\n');
        compileGuidance(ws);
        fs.writeFileSync(glossary, fs.readFileSync(glossary, "utf8").replace('"Glossary"', '"Glossary of the catalogue"'));
        const { code, text } = await cli(["--workspace", ws, "--write"]);
        assert.equal(code, 0, text);
        assert.equal(alwaysBytes(repo), Number(/to ([\d,]+) B \(~/.exec(text)[1].replaceAll(",", "")), "the index counted once, as `compile` rewrites it");
    });

    test("a write of the index failing partway rolls the split back with it, and nothing is changed", async () => {
        const { repo, ws } = consumer();
        // The index is written, then the marker listing it fails.
        const write = (file, data, options) => {
            if (/\.compiled\.portulan-upgrade\./.test(file)) throw Object.assign(new Error("denied"), { code: "EACCES" });
            return fs.writeFileSync(file, data, options);
        };
        const { code, text } = await cli(["--workspace", ws, "--write"], { write });
        assert.equal(code, 2, text);
        assert.match(text, /^instructions: the index could not be written — .+ could not be written — EACCES; rolled back, nothing is changed$/m);
        assert.equal(git(repo, "status", "--porcelain", "--untracked-files=all"), "");
    });

    test("--join --write puts every section back: CLAUDE.md is the fixture again, and the units and the index are gone", async () => {
        const { repo, ws } = consumer();
        assert.equal((await cli(["--workspace", ws, "--write"])).code, 0);
        const { code, text } = await cli(["--workspace", ws, "--join", "--write"]);
        assert.equal(code, 0, text);
        assert.match(text, /^instructions: \.portulan\/context\/catalogue-records\.md: 5,816 B go back into CLAUDE\.md under "Catalogue records", as the move left it$/m);
        assert.match(text, /CLAUDE\.md takes back 3 sections, and each of the 140 clauses lands once/);
        assert.equal(fs.readFileSync(path.join(repo, "CLAUDE.md"), "utf8"), fs.readFileSync(FIXTURE, "utf8"), "marked directly under each heading, the marks were all that left");
        assert.deepEqual(fs.readdirSync(path.join(ws, "context")), ["boot.md"]);
        assert.equal(fs.existsSync(path.join(repo, ".claude", "rules", "portulan", "on-read.md")), false);
    });

    test("the command line runs as a process of its own, as a consumer runs it, and prints the plan", () => {
        const { repo, ws } = consumer();
        const out = execFileSync(process.execPath, [path.join(REPO, "cli", "instructions.mjs"), "--workspace", ws], { encoding: "utf8" });
        assert.match(out, /^instructions: "Catalogue records" in CLAUDE\.md → \.portulan\/context\/catalogue-records\.md, 5,872 B$/m);
        assert.match(out, /nothing was written/);
        assert.equal(git(repo, "status", "--porcelain"), "");
    });

    test("a refused mark exits 2 and writes nothing, and an unknown flag or no workspace is could not run", async () => {
        const { repo, ws } = consumer();
        fs.writeFileSync(path.join(repo, "CLAUDE.md"), mark(fs.readFileSync(path.join(repo, "CLAUDE.md"), "utf8"), "### Holdings and copies"));
        const { code, text } = await cli(["--workspace", ws, "--write"]);
        assert.equal(code, 2);
        assert.match(text, /is marked inside the marked section "Catalogue records"/);
        assert.equal(git(repo, "status", "--porcelain"), " M CLAUDE.md\n");
        assert.equal((await cli(["--workspace", ws, "--split"])).code, 2);
        assert.equal((await cli([])).code, 2);
    });
});

/** The fixture's figures in bytes, held here so a change to the fixture or the split is a change seen. */
const FIGURES = { claude: 15_866, now: 7_049, units: [5_872, 1_883, 1_348], index: 184 };
