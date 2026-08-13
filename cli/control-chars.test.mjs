// Tests for `control-chars` — the rail on bytes a reader cannot see.
//
// Zero dependencies, node's own runner, same as ./index.test.mjs and ./plugin-lint.test.mjs, and run
// by the same recipe.
//
//   node --test "cli/**/*.test.mjs"
//
// The fixtures build their forbidden bytes with `String.fromCharCode` and `Buffer.from([…])` rather
// than by carrying them literally. That is not fastidiousness: issue #68 records the byte reproducing
// twice more while it was being fixed — once in the README paragraph describing it, once in the shell
// command carrying the commit message — and a suite that carried one literally would be a tracked file
// this very check must go red on. The check would then be red on its own tests, which is the shape a
// rail gets switched off for.
//
// What this suite CANNOT establish: that the tree is clean. That is the recipe's job over the real
// `git ls-files` output, and the last group here binds it — this repository's own files, scanned.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    ControlCharsError,
    bytesOf,
    inspect,
    isForbidden,
    nameOf,
    run,
    scanBytes,
    splitList,
} from "./control-chars.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

// One exit handler for every scratch directory — the per-directory form exceeds node's default ten
// listeners partway through a suite this size, which ./doctor.test.mjs learned in review.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-chars-"));
    SCRATCH.push(dir);
    return dir;
}

/** Write `{ "relative/path": <string|Buffer> }` and return the directory. */
function tree(files) {
    const dir = scratch();
    for (const [rel, body] of Object.entries(files)) {
        const target = path.join(dir, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, body);
    }
    return dir;
}

/** The byte, never written literally in this file. */
const ch = (code) => String.fromCharCode(code);
const NUL = ch(0x00);

const messages = (lines) => lines.join("\n");

// ---------------------------------------------------------------- what counts

describe("what a tracked file may not carry", () => {
    test("TAB and LF are the whole allowance", () => {
        assert.equal(isForbidden(0x09), false);
        assert.equal(isForbidden(0x0a), false);
    });

    test("every other C0 byte is forbidden, NUL first", () => {
        for (let b = 0x00; b <= 0x1f; b += 1) {
            if (b === 0x09 || b === 0x0a) continue;
            assert.equal(isForbidden(b), true, `0x${b.toString(16)} should be forbidden`);
        }
    });

    test("CR is refused, and that is a decision rather than an oversight", () => {
        // No tracked file in this repository carries one, so the rail costs nothing today and stops
        // CRLF arriving unnoticed in a tree that is uniformly LF. Asserted so the decision cannot be
        // relaxed by accident — a repository that wants CRLF wants it declared, not discovered.
        assert.equal(isForbidden(0x0d), true);
    });

    test("DEL is forbidden too — outside C0, the same defect", () => {
        assert.equal(isForbidden(0x7f), true);
    });

    test("printable ASCII and every UTF-8 continuation byte are left alone", () => {
        for (let b = 0x20; b <= 0x7e; b += 1) assert.equal(isForbidden(b), false);
        // No C0 byte and no 0x7f ever appears inside a multi-byte UTF-8 sequence — its bytes are all
        // >= 0x80 — which is what makes a byte scan and a character scan agree here.
        for (let b = 0x80; b <= 0xff; b += 1) assert.equal(isForbidden(b), false);
    });

    // #207. C1 is two UTF-8 bytes, `0xc2` then `0x80`-`0x9f`, so `isForbidden` cannot reach it by
    // construction and the assertion directly above stays true. The scan is what had to learn it.
    //
    // **Asserted through the byte scanner, never through `grep -P`**: on this host `grep` is ugrep
    // 7.5.0, and `grep -clP '\xc2[\x80-\x9f]'` MISSES a planted U+009B — exit 1, nothing printed.
    // Measured against the planted file before this rail was written, which is why the rail does not
    // use it. An instrument keyed on a tool that cannot see the class would rail nothing.
    test("a C1 control character is found, named by code point, and located at its LEAD byte", () => {
        const found = scanBytes(Buffer.from([0x61, 0xc2, 0x9b, 0x62]));
        assert.equal(found.length, 1);
        assert.equal(found[0].offset, 1, "the lead byte, not the continuation");
        assert.equal(found[0].name, "U+009B CSI");
        assert.equal(found[0].column, 2);
    });

    test("every C1 is caught, and each is named", () => {
        for (let second = 0x80; second <= 0x9f; second += 1) {
            const found = scanBytes(Buffer.from([0xc2, second]));
            assert.equal(found.length, 1, `U+00${second.toString(16)} missed`);
            assert.match(found[0].name, /^U\+00[89A-F][0-9A-F] [A-Z0-9]+$/);
        }
    });

    // The negative controls: `0xc2` is also the lead of legitimate two-byte characters, and a bare
    // `0x80`-`0x9f` with no lead is a continuation byte of some other sequence. Neither is C1, and a
    // check that flagged them would red every accented character in the tree.
    test("a two-byte character that is not C1 is untouched", () => {
        assert.deepEqual(scanBytes(Buffer.from("café", "utf8")), [], "é is c3 a9");
        assert.deepEqual(scanBytes(Buffer.from([0xc2, 0xa0])), [], "c2 a0 is NBSP, outside C1");
        assert.deepEqual(scanBytes(Buffer.from([0xc2, 0xbf])), [], "c2 bf is an inverted question mark");
    });

    test("a continuation byte with no C1 lead is not a finding", () => {
        assert.deepEqual(scanBytes(Buffer.from([0xe2, 0x80, 0x94])), [], "an em dash carries 0x80 inside it");
    });

    test("a finding names the byte and never prints it", () => {
        // A report that carried the character would reproduce the defect inside the report, and a
        // check whose own output can silence its next run is not a rail.
        assert.equal(nameOf(0x00), "NUL");
        assert.equal(nameOf(0x0d), "CR");
        assert.equal(nameOf(0x1b), "ESC");
        assert.equal(nameOf(0x7f), "DEL");
        for (const name of [nameOf(0x00), nameOf(0x1b), nameOf(0x7f)]) {
            assert.match(name, /^[A-Z0-9]+$/);
        }
    });
});

// ---------------------------------------------------------------- locating one

describe("where the byte is", () => {
    test("reports a 0-based byte offset with a 1-based line and byte column", () => {
        // The three are not on one scale, and the name says which is which. It read "1-based" of all
        // three while asserting an offset of 12 — a 0-based index — which Copilot caught on round 1:
        // a test name is where a reader looks for the contract, so a wrong one is the contract being
        // wrong. `offset` is an index into the buffer and cannot be anything but 0-based; a line
        // number starting at 0 would disagree with every editor.
        const buffer = Buffer.from(`first\nsecond${NUL}\nthird\n`, "utf8");
        const found = scanBytes(buffer);
        assert.equal(found.length, 1);
        assert.equal(found[0].name, "NUL");
        assert.equal(found[0].offset, 12); // 0-based: `first\n` is 6 bytes, `second` is 6 more
        assert.equal(found[0].line, 2);
        assert.equal(found[0].column, 7);
    });


    test("the column counts BYTES, which is why it says so", () => {
        // An em dash is three bytes. A column named `characters` would print a number the reader
        // cannot reproduce, inside the check whose subject is claims that outrun their measurement —
        // the distinction `docs.sh`'s `plan` rail already makes about `awk`'s `length()`.
        const buffer = Buffer.from(`—${NUL}`, "utf8");
        assert.equal(scanBytes(buffer)[0].column, 4);
    });

    test("a clean buffer yields nothing, including one that is empty", () => {
        assert.deepEqual(scanBytes(Buffer.from("ordinary\ttext\n", "utf8")), []);
        assert.deepEqual(scanBytes(Buffer.alloc(0)), []);
    });

    test("every occurrence is counted, not only the first", () => {
        const buffer = Buffer.from([0x61, 0x00, 0x62, 0x1b, 0x0a, 0x63, 0x7f]);
        const found = scanBytes(buffer);
        assert.deepEqual(found.map((f) => f.name), ["NUL", "ESC", "DEL"]);
        assert.deepEqual(found.map((f) => f.line), [1, 1, 2]);
    });

    test("the scan never decodes, so an invalid UTF-8 byte cannot become U+FFFD", () => {
        // Decoding would both hide bytes and invent a character that was not there. `0xff` is not
        // valid UTF-8 and is not a control character; it must pass, and the NUL beside it must not.
        const buffer = Buffer.from([0xff, 0x00, 0xfe]);
        assert.deepEqual(scanBytes(buffer).map((f) => f.offset), [1]);
    });
});

// ---------------------------------------------------------------- reading a path

describe("what the reader refuses, and what it lets past", () => {
    test("a tracked file deleted from the working tree is skipped, not an error", () => {
        // The ordinary state `json.sh` already skips: present in the index, absent on disk.
        assert.equal(bytesOf(path.join(scratch(), "gone.md")), null);
    });

    test("a symlink is read as its target's BYTES, never followed", () => {
        // The target path is the blob git stores, and it is what this check is asked about. Following
        // the link would scan a file that may not be in the repository at all.
        const dir = tree({ "real.md": `nul-free\n` });
        const link = path.join(dir, "link.md");
        fs.symlinkSync("real.md", link);
        assert.equal(bytesOf(link).toString("utf8"), "real.md");
    });

    test("a symlink target is not decoded on the way in", () => {
        // `readlinkSync` returns a STRING by default, so a target git stores as raw bytes came back
        // U+FFFD-substituted and was re-encoded into DIFFERENT bytes — breaking this module's own
        // "never decodes" promise and able to hide a control byte in the target. The identical defect
        // `splitList` had just been repaired for, two functions below, in the same push. Copilot,
        // suppressed channel on #167.
        const dir = scratch();
        const link = path.join(dir, "odd.md");
        // A target whose bytes are not valid UTF-8. Built as a Buffer so nothing in this file decodes it.
        fs.symlinkSync(Buffer.from([0x74, 0xff, 0x2e, 0x6d, 0x64]), link);
        assert.deepEqual([...bytesOf(link)], [0x74, 0xff, 0x2e, 0x6d, 0x64]);
    });

    test("a control byte inside a symlink target is a finding, not a decode casualty", () => {
        const dir = scratch();
        const link = path.join(dir, "sneaky.md");
        fs.symlinkSync(Buffer.from([0x61, 0x0d, 0x62]), link);
        assert.deepEqual(scanBytes(bytesOf(link)).map((f) => f.name), ["CR"]);
    });

    test("a dangling symlink is its target string too, rather than an error about the wrong thing", () => {
        const dir = scratch();
        const link = path.join(dir, "dangling.md");
        fs.symlinkSync("nowhere.md", link);
        assert.equal(bytesOf(link).toString("utf8"), "nowhere.md");
    });

    test("anything that is neither a regular file nor a symlink is refused", () => {
        // `vendor.mjs`'s rule in `vendor.mjs`'s words — this reads neither by guessing at it. Round 13
        // of #164 is what an exemption that skipped this check permitted.
        const dir = tree({ "sub/a.md": "text\n" });
        assert.throws(() => bytesOf(path.join(dir, "sub")), ControlCharsError);
    });

    test("an unreadable file is exit 2, never a quiet pass", () => {
        // Could not look, reported as looked and found nothing, is the failure
        // `a-checker-must-refuse-what-it-cannot-check.md` is about — and only ENOENT means absent.
        const dir = tree({ "locked.md": "text\n" });
        const locked = path.join(dir, "locked.md");
        fs.chmodSync(locked, 0o000);
        try {
            assert.throws(() => bytesOf(locked), (e) => e instanceof ControlCharsError && /EACCES/.test(e.message));
        } finally {
            fs.chmodSync(locked, 0o644);
        }
    });
});

// ---------------------------------------------------------------- the sweep

describe("scanning a list", () => {
    test("one line per offending file, carrying the count and the first", () => {
        // One per byte would print thousands for a genuinely binary asset, and a report nobody reads
        // is a report. The count rides beside the first so nothing is dropped in silence.
        const dir = tree({ "a.md": `clean\n`, "b.md": `x${NUL}y${NUL}z\n` });
        const result = inspect([path.join(dir, "a.md"), path.join(dir, "b.md")]);
        assert.equal(result.findings.length, 1);
        assert.equal(result.findings[0].count, 2);
        assert.equal(result.findings[0].first.name, "NUL");
        assert.equal(result.scanned, 2);
    });

    test("an EMPTY list is refused rather than reported green", () => {
        // The enumeration fail-open this repository has fixed five times, and the one this check is
        // most exposed to: its whole input arrives through a pipe.
        assert.throws(() => inspect([]), ControlCharsError);
    });

    test("a file tracked and not on disk counts as skipped, never as clean", () => {
        const dir = tree({ "a.md": "clean\n" });
        const result = inspect([path.join(dir, "a.md"), path.join(dir, "gone.md")]);
        assert.equal(result.scanned, 1);
        assert.equal(result.skipped, 1);
    });
});

// ---------------------------------------------------------------- the exemption

describe("the exemption is a named path, and it is audited both ways", () => {
    test("an exempted path carrying control characters is not a finding", () => {
        const dir = tree({ "asset.bin": Buffer.from([0x00, 0x01, 0x02]) });
        const file = path.join(dir, "asset.bin");
        assert.equal(inspect([file], { exempt: new Set([file]) }).findings.length, 0);
    });

    test("an exemption naming nothing scanned is STALE — exit 2", () => {
        // The allow-list defect this project has already paid for once: a carve-out for a thing that
        // is not there. An exemption nobody audits is one that outlives its reason.
        const dir = tree({ "a.md": "clean\n" });
        const result = inspect([path.join(dir, "a.md")], { exempt: new Set([path.join(dir, "moved.bin")]) });
        assert.equal(result.unusable.length, 1);
        assert.match(result.unusable[0].why, /not in the scanned set/);
    });

    test("an exemption over a file that was NEVER READ says so, and does not call it dead", () => {
        // The third case, which the first draft collapsed into the second. A tracked file absent from
        // the working tree lands in `seen` and never in `carrying`, so it was reported *carries no
        // control character, so the exemption is dead* — a specific claim about a file nothing opened,
        // which would send the maintainer to delete an exemption that is still load-bearing. This
        // check's own subject, and #92's class: a verdict about something never examined. Copilot,
        // suppressed channel on #167.
        const dir = tree({ "a.md": "clean\n" });
        const gone = path.join(dir, "gone.bin");
        const result = inspect([path.join(dir, "a.md"), gone], { exempt: new Set([gone]) });
        assert.equal(result.unusable.length, 1);
        assert.match(result.unusable[0].why, /never read/);
        assert.doesNotMatch(result.unusable[0].why, /dead/);
        assert.equal(result.skipped, 1);
    });

    test("an exemption over a CLEAN file is DEAD — exit 2", () => {
        // An exemption that is not load-bearing is one nobody will notice has stopped being true, and
        // it is the door the next binary-shaped file walks through.
        const dir = tree({ "a.md": "clean\n" });
        const file = path.join(dir, "a.md");
        const result = inspect([file], { exempt: new Set([file]) });
        assert.equal(result.unusable.length, 1);
        assert.match(result.unusable[0].why, /dead/);
    });

    test("a content sniff is NOT how a binary file gets past this check", () => {
        // Issue #68's first question, settled. Every binary sniff in general use is keyed on NUL —
        // `file` called the defective source *binary data*, and git reads the first 8000 bytes for
        // one. A check that skipped what those call binary would skip the file it exists to catch.
        // So a NUL-bearing file is a finding until something NAMES it, and nothing here infers it.
        const dir = tree({ "looks-binary.mjs": Buffer.from(`const identity = "a${NUL}b";\n`, "utf8") });
        const file = path.join(dir, "looks-binary.mjs");
        assert.equal(inspect([file]).findings.length, 1);
    });
});

// ---------------------------------------------------------------- the command

describe("run", () => {
    test("exit 0 and a line saying how many files were scanned", () => {
        const dir = tree({ "a.md": "clean\n", "b.md": "also clean\n" });
        const lines = [];
        const code = run([], [path.join(dir, "a.md"), path.join(dir, "b.md")].join("\0"), (s) => lines.push(s));
        assert.equal(code, 0);
        assert.match(messages(lines), /2 file\(s\) carry no control character/);
    });

    test("exit 1 naming the file, the locator and the byte — with the base of each number", () => {
        // The first draft printed `byte 19 (line 1, byte column 20)` and named neither base, so two
        // numbers about one position read as a contradiction. A message that has to be decoded is this
        // check's own subject one layer up, so the format is asserted rather than left to a reader.
        const dir = tree({ "bad.mjs": `const identity = "a${NUL}b";\n` });
        const lines = [];
        assert.equal(run([], path.join(dir, "bad.mjs"), (s) => lines.push(s)), 1);
        assert.match(messages(lines), /bad\.mjs/);
        assert.match(messages(lines), /line 1, byte column 20 \(byte offset 19, 0-based\)/);
        assert.match(messages(lines), /NUL/);
    });

    test("exit 2 for a stale exemption, which is a defect in the declaration and not a verdict", () => {
        // The same code, and the same reasoning, as a stale entry in `index.sh`'s WORKSPACES.
        const dir = tree({ "a.md": "clean\n" });
        const lines = [];
        const code = run(["--exempt", path.join(dir, "moved.bin")], path.join(dir, "a.md"), (s) => lines.push(s));
        assert.equal(code, 2);
        assert.match(messages(lines), /--exempt/);
    });

    test("exit 2 for an empty list rather than a green over nothing", () => {
        const lines = [];
        assert.equal(run([], "", (s) => lines.push(s)), 2);
        assert.match(messages(lines), /refusing to report green/i);
    });

    test("exit 2 for `--exempt` with no path, and for an argument it does not know", () => {
        assert.equal(run(["--exempt"], "x", () => {}), 2);
        assert.equal(run(["somefile.md"], "x", () => {}), 2);
    });

    test("a path beginning with `-` can be exempted — git tracks those", () => {
        // The first draft rejected any value starting with `--`, which made a file git can perfectly
        // well track impossible to exempt, in the one mechanism this check rests on. The mistake that
        // guard was aimed at — a forgotten value — is already caught by the audit, and better: it
        // names the path and says it is not in the scanned set. Copilot, #167, suppressed channel.
        const dir = tree({ "--asset.bin": Buffer.from([0x00, 0x01]) });
        const asset = path.join(dir, "--asset.bin");
        const lines = [];
        assert.equal(run(["--exempt", asset], asset, (s) => lines.push(s)), 0);
        assert.match(messages(lines), /1 exempted by declaration/);
    });

    test("a forgotten `--exempt` value is still caught, by the audit rather than by the parser", () => {
        const dir = tree({ "a.md": "clean\n" });
        const lines = [];
        assert.equal(run(["--exempt", "--other"], path.join(dir, "a.md"), (s) => lines.push(s)), 2);
        assert.match(messages(lines), /--other is not in the scanned set/);
    });

    test("an exempted binary asset is green, and the summary says one was exempted", () => {
        const dir = tree({ "a.md": "clean\n", "asset.bin": Buffer.from([0x00, 0x01]) });
        const asset = path.join(dir, "asset.bin");
        const lines = [];
        const code = run(["--exempt", asset], [path.join(dir, "a.md"), asset].join("\0"), (s) => lines.push(s));
        assert.equal(code, 0);
        assert.match(messages(lines), /1 exempted by declaration/);
    });

    test("the list is NUL-separated, so a filename cannot be split by its own bytes", () => {
        // `git ls-files -z`. The `\n`-separated form the other recipes use would mis-split a filename
        // containing a newline — and this is the one check in the repository that must not be the tool
        // that trusts invisible bytes in the input it was given to police.
        assert.deepEqual(splitList("a.md\0b.md\0").paths, ["a.md", "b.md"]);
        assert.deepEqual(splitList("one\ntwo.md\0").paths, ["one\ntwo.md"]);
        assert.deepEqual(splitList("").paths, []);
        assert.deepEqual(splitList("a.md\0").undecodable, []);
    });

    test("a pathname that is not valid UTF-8 is returned undecodable, never quietly repaired", () => {
        // The split and the decode were two different fail-opens and only the first was closed. Git
        // allows a pathname to be any bytes except NUL and `/`; decoding the list whole turned such a
        // name into a DIFFERENT string, which `bytesOf` then failed to find. Copilot, #167.
        const list = Buffer.concat([Buffer.from("ok.md"), Buffer.from([0x00, 0xff, 0xfe]), Buffer.from([0x00])]);
        const { paths, undecodable } = splitList(list);
        assert.deepEqual(paths, ["ok.md"]);
        assert.equal(undecodable.length, 1);
        assert.deepEqual([...undecodable[0]], [0xff, 0xfe]);
    });

    test("a name that legitimately CONTAINS U+FFFD is not mistaken for a broken decode", () => {
        // The test is a round trip, not a search for U+FFFD: git stores that name exactly as given, and
        // rejecting it would be a false red on a file that is fine — which is what gets a check
        // switched off.
        assert.deepEqual(splitList("we�ird.md\0").paths, ["we�ird.md"]);
        assert.deepEqual(splitList("we�ird.md\0").undecodable, []);
    });

    test("an undecodable path is exit 2 — refused, never counted as skipped", () => {
        // The fail-open in full: the name decoded to something else, the read came back ENOENT, and the
        // run reported green with `1 tracked and not on disk` in the summary. A plausible sentence over
        // a file nothing read is worse than no sentence.
        const dir = tree({ "a.md": "clean\n" });
        const list = Buffer.concat([Buffer.from(path.join(dir, "a.md")), Buffer.from([0x00, 0xff]), Buffer.from([0x00])]);
        const lines = [];
        assert.equal(run([], list, (s) => lines.push(s)), 2);
        assert.match(messages(lines), /not valid UTF-8/);
        assert.doesNotMatch(messages(lines), /tracked and not on disk/);
        assert.doesNotMatch(messages(lines), /carry no control character/);
    });

    test("the refusal escapes the bytes it names rather than echoing them", () => {
        // `nameOf`'s rule applied to a filename: a report that echoes raw bytes can carry the thing
        // this check exists to catch, and would silence whatever reads the report next.
        const list = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from([0x00])]);
        const lines = [];
        assert.equal(run([], list, (s) => lines.push(s)), 2);
        assert.match(messages(lines), /\\xff\\xfe/);
    });

    test("a FILENAME's own control bytes are escaped, so the report cannot carry them", () => {
        // Measured, not assumed: git tracks `we<LF>ird.md`, and `git ls-files -z` emits that newline
        // raw. Interpolating the name directly would print the very bytes this check exists to catch
        // into a CI log, and would break the one-line-per-file contract every consumer reads by. It is
        // `nameOf`'s argument applied to the other half of the line — a check whose output can carry
        // the thing it checks for is one that can silence its own next run. Copilot, #167.
        const dir = scratch();
        const odd = path.join(dir, `we${ch(0x0a)}ird.md`);
        fs.writeFileSync(odd, `x${NUL}\n`);
        const lines = [];
        assert.equal(run([], odd, (s) => lines.push(s)), 1);
        const out = messages(lines);
        assert.match(out, /we\\x0aird\.md/);
        // One line out, whatever the name contained.
        assert.equal(lines.length, 1);
        assert.doesNotMatch(out, /we\nird/);
    });

    test("a path in a REFUSAL is escaped too, not only one in a finding", () => {
        // Six places named a path and only one escaped it. The refusals are the messages a reader
        // meets when something is already wrong, which is the worst moment to hand them a broken line.
        const dir = scratch();
        const odd = path.join(dir, `sub${ch(0x0a)}dir`);
        fs.mkdirSync(odd);
        assert.throws(
            () => inspect([odd]),
            (e) => e instanceof ControlCharsError && /sub\\x0adir/.test(e.message) && !/sub\ndir/.test(e.message),
        );
    });

    test("a literal backslash in the name is escaped, so the escape is unambiguous", () => {
        // Without this, a filename containing the characters `\`, `x`, `f`, `f` renders exactly like
        // the byte 0xff — and the message written to remove an ambiguity would carry one instead.
        const list = Buffer.concat([Buffer.from("a\\xff"), Buffer.from([0xfe]), Buffer.from([0x00])]);
        const lines = [];
        assert.equal(run([], list, (s) => lines.push(s)), 2);
        assert.match(messages(lines), /a\\\\xff\\xfe/);
    });
});

// ---------------------------------------------------------------- this repository

describe("the live tree", () => {
    test("every tracked file is free of control characters outside TAB and LF", () => {
        // Customer zero held to its own rail, the way ./index.test.mjs binds the live indexes. The
        // recipe checks this too; the suite checks it as well so a byte smuggled in by an edit is red
        // in both places rather than only in CI.
        // **Raw bytes, no encoding** — the sibling of the production fail-open, in the test that binds
        // the live tree. Decoding the listing as UTF-8 would turn a pathname git allows into a
        // different string, which `bytesOf` would then miss as ENOENT and count as skipped: this test
        // would pass while quietly not scanning the one file it was most important to scan. Copilot
        // raised it here in the suppressed channel and on the production read in a thread, the same
        // defect from both sides. `undecodable` is asserted empty rather than assumed.
        const listing = execFileSync(
            "git",
            ["-C", REPO, "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
            { maxBuffer: 32 * 1024 * 1024 },
        );
        const { paths, undecodable } = splitList(listing);
        assert.deepEqual(undecodable, [], "a tracked pathname did not survive decoding — the scan would have skipped it");
        const files = paths.map((rel) => path.join(REPO, rel));
        // A KNOWN PATH rather than a count. `files.length > 100` was a magic number that would fail on
        // an unrelated change to the repository's size, and a hard-coded figure is a claim that rots —
        // #77's lesson, which this very change applies to a stale line count in `verify/README.md`.
        // What the assertion actually needs is that the enumeration REACHED the tree, which is the
        // fail-open this repository has fixed five times; a known tracked file proves that, where a
        // number only correlates with it. `inspect` refuses an empty list on its own account.
        // Copilot, #167, suppressed channel.
        assert.ok(
            files.includes(path.join(REPO, "cli", "control-chars.mjs")),
            "the enumeration did not reach the tree — this module's own file is missing from it",
        );
        const result = inspect(files);
        assert.deepEqual(
            result.findings.map((f) => `${f.file}: ${f.first.name} at byte ${f.first.offset}`),
            [],
        );
    });
});
