// Tests for `control-chars` — the rail on bytes a reader cannot see.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

// One exit handler for every scratch directory: one each would pass node's ten-listener limit.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-chars-"));
    SCRATCH.push(dir);
    return dir;
}

function tree(files) {
    const dir = scratch();
    for (const [rel, body] of Object.entries(files)) {
        const target = path.join(dir, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, body);
    }
    return dir;
}

/** Control bytes are built, never literal: this file is itself in the tree the check scans. */
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
        assert.equal(isForbidden(0x0d), true);
    });

    test("DEL is forbidden too — outside C0, the same defect", () => {
        assert.equal(isForbidden(0x7f), true);
    });

    test("printable ASCII and every UTF-8 continuation byte are left alone", () => {
        for (let b = 0x20; b <= 0x7e; b += 1) assert.equal(isForbidden(b), false);
        for (let b = 0x80; b <= 0xff; b += 1) assert.equal(isForbidden(b), false);
    });

    // C1 is two bytes, `0xc2` then `0x80`-`0x9f`: `isForbidden` cannot see it, so the scan must.
    test("a C1 control character is found, named by code point, and located at its LEAD byte", () => {
        const found = scanBytes(Buffer.from([0x61, 0xc2, 0x9b, 0x62]));
        assert.equal(found.length, 1);
        assert.equal(found[0].offset, 1, "the lead byte, not the continuation");
        assert.equal(found[0].name, "U+009B CSI");
        assert.equal(found[0].column, 2);
        assert.equal(found[0].byte, 0xc2, "`byte` is the byte AT `offset` — the lead, not the continuation");
    });

    test("in every finding, `byte` is the byte at `offset` — both branches", () => {
        const buffer = Buffer.from([0x61, 0x07, 0x62, 0xc2, 0x9b, 0x63, 0x7f, 0xc2, 0x85]);
        const found = scanBytes(buffer);
        assert.equal(found.length, 4, "BEL, CSI, DEL, NEL — two from each branch");
        for (const f of found) {
            assert.equal(f.byte, buffer[f.offset], `finding ${f.name} at offset ${f.offset} disagrees with its own byte`);
        }
        assert.deepEqual(
            found.map((f) => f.name),
            ["BEL", "U+009B CSI", "DEL", "U+0085 NEL"],
            "and the names still identify the character, which for C1 comes from the continuation",
        );
    });

    test("every C1 is caught, and each is named", () => {
        for (let second = 0x80; second <= 0x9f; second += 1) {
            const found = scanBytes(Buffer.from([0xc2, second]));
            assert.equal(found.length, 1, `U+00${second.toString(16)} missed`);
            assert.match(found[0].name, /^U\+00[89A-F][0-9A-F] [A-Z0-9]+$/);
        }
    });

    test("a two-byte character that is not C1 is untouched", () => {
        assert.deepEqual(scanBytes(Buffer.from("café", "utf8")), [], "é is c3 a9");
        assert.deepEqual(scanBytes(Buffer.from([0xc2, 0xa0])), [], "c2 a0 is NBSP, outside C1");
        assert.deepEqual(scanBytes(Buffer.from([0xc2, 0xbf])), [], "c2 bf is an inverted question mark");
    });

    test("a continuation byte with no C1 lead is not a finding", () => {
        assert.deepEqual(scanBytes(Buffer.from([0xe2, 0x80, 0x94])), [], "an em dash carries 0x80 inside it");
    });

    test("a finding names the byte and never prints it", () => {
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
        const buffer = Buffer.from(`first\nsecond${NUL}\nthird\n`, "utf8");
        const found = scanBytes(buffer);
        assert.equal(found.length, 1);
        assert.equal(found[0].name, "NUL");
        assert.equal(found[0].offset, 12); // 0-based: `first\n` is 6 bytes, `second` is 6 more
        assert.equal(found[0].line, 2);
        assert.equal(found[0].column, 7);
    });


    test("the column counts BYTES, which is why it says so", () => {
        // An em dash is three bytes.
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
        const buffer = Buffer.from([0xff, 0x00, 0xfe]);
        assert.deepEqual(scanBytes(buffer).map((f) => f.offset), [1]);
    });
});

// ---------------------------------------------------------------- reading a path

describe("what the reader refuses, and what it lets past", () => {
    test("a tracked file deleted from the working tree is skipped, not an error", () => {
        assert.equal(bytesOf(path.join(scratch(), "gone.md")), null);
    });

    test("a symlink is read as its target's BYTES, never followed", () => {
        const dir = tree({ "real.md": `nul-free\n` });
        const link = path.join(dir, "link.md");
        fs.symlinkSync("real.md", link);
        assert.equal(bytesOf(link).toString("utf8"), "real.md");
    });

    test("a symlink target is not decoded on the way in", () => {
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
        const dir = tree({ "sub/a.md": "text\n" });
        assert.throws(() => bytesOf(path.join(dir, "sub")), ControlCharsError);
    });

    test("an unreadable file is exit 2, never a quiet pass", () => {
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
        const dir = tree({ "a.md": `clean\n`, "b.md": `x${NUL}y${NUL}z\n` });
        const result = inspect([path.join(dir, "a.md"), path.join(dir, "b.md")]);
        assert.equal(result.findings.length, 1);
        assert.equal(result.findings[0].count, 2);
        assert.equal(result.findings[0].first.name, "NUL");
        assert.equal(result.scanned, 2);
    });

    test("an EMPTY list is refused rather than reported green", () => {
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
        const dir = tree({ "a.md": "clean\n" });
        const result = inspect([path.join(dir, "a.md")], { exempt: new Set([path.join(dir, "moved.bin")]) });
        assert.equal(result.unusable.length, 1);
        assert.match(result.unusable[0].why, /not in the scanned set/);
    });

    test("an exemption over a file that was NEVER READ says so, and does not call it dead", () => {
        const dir = tree({ "a.md": "clean\n" });
        const gone = path.join(dir, "gone.bin");
        const result = inspect([path.join(dir, "a.md"), gone], { exempt: new Set([gone]) });
        assert.equal(result.unusable.length, 1);
        assert.match(result.unusable[0].why, /never read/);
        assert.doesNotMatch(result.unusable[0].why, /dead/);
        assert.equal(result.skipped, 1);
    });

    test("an exemption over a CLEAN file is DEAD — exit 2", () => {
        const dir = tree({ "a.md": "clean\n" });
        const file = path.join(dir, "a.md");
        const result = inspect([file], { exempt: new Set([file]) });
        assert.equal(result.unusable.length, 1);
        assert.match(result.unusable[0].why, /dead/);
    });

    test("a content sniff is NOT how a binary file gets past this check", () => {
        // Binary sniffs key on NUL, the byte this check exists to catch, so only an exemption lets one past.
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
        const dir = tree({ "bad.mjs": `const identity = "a${NUL}b";\n` });
        const lines = [];
        assert.equal(run([], path.join(dir, "bad.mjs"), (s) => lines.push(s)), 1);
        assert.match(messages(lines), /bad\.mjs/);
        assert.match(messages(lines), /line 1, byte column 20 \(byte offset 19, 0-based\)/);
        assert.match(messages(lines), /NUL/);
    });

    test("exit 2 for a stale exemption, which is a defect in the declaration and not a verdict", () => {
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
        // Without `-z`, git C-quotes a control byte whatever `core.quotePath` says: one line, but not the real name.
        assert.deepEqual(splitList("a.md\0b.md\0").paths, ["a.md", "b.md"]);
        assert.deepEqual(splitList("one\ntwo.md\0").paths, ["one\ntwo.md"]);
        assert.deepEqual(splitList("").paths, []);
        assert.deepEqual(splitList("a.md\0").undecodable, []);
    });

    test("a pathname that is not valid UTF-8 is returned undecodable, never quietly repaired", () => {
        const list = Buffer.concat([Buffer.from("ok.md"), Buffer.from([0x00, 0xff, 0xfe]), Buffer.from([0x00])]);
        const { paths, undecodable } = splitList(list);
        assert.deepEqual(paths, ["ok.md"]);
        assert.equal(undecodable.length, 1);
        assert.deepEqual([...undecodable[0]], [0xff, 0xfe]);
    });

    test("a name that legitimately CONTAINS U+FFFD is not mistaken for a broken decode", () => {
        assert.deepEqual(splitList("we�ird.md\0").paths, ["we�ird.md"]);
        assert.deepEqual(splitList("we�ird.md\0").undecodable, []);
    });

    test("an undecodable path is exit 2 — refused, never counted as skipped", () => {
        const dir = tree({ "a.md": "clean\n" });
        const list = Buffer.concat([Buffer.from(path.join(dir, "a.md")), Buffer.from([0x00, 0xff]), Buffer.from([0x00])]);
        const lines = [];
        assert.equal(run([], list, (s) => lines.push(s)), 2);
        assert.match(messages(lines), /not valid UTF-8/);
        assert.doesNotMatch(messages(lines), /tracked and not on disk/);
        assert.doesNotMatch(messages(lines), /carry no control character/);
    });

    test("the refusal escapes the bytes it names rather than echoing them", () => {
        const list = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from([0x00])]);
        const lines = [];
        assert.equal(run([], list, (s) => lines.push(s)), 2);
        assert.match(messages(lines), /\\xff\\xfe/);
    });

    test("a FILENAME's own control bytes are escaped, so the report cannot carry them", () => {
        const dir = scratch();
        const odd = path.join(dir, `we${ch(0x0a)}ird.md`);
        fs.writeFileSync(odd, `x${NUL}\n`);
        const lines = [];
        assert.equal(run([], odd, (s) => lines.push(s)), 1);
        const out = messages(lines);
        assert.match(out, /we\\x0aird\.md/);
        assert.equal(lines.length, 1);
        assert.doesNotMatch(out, /we\nird/);
    });

    test("a path in a REFUSAL is escaped too, not only one in a finding", () => {
        const dir = scratch();
        const odd = path.join(dir, `sub${ch(0x0a)}dir`);
        fs.mkdirSync(odd);
        assert.throws(
            () => inspect([odd]),
            (e) => e instanceof ControlCharsError && /sub\\x0adir/.test(e.message) && !/sub\ndir/.test(e.message),
        );
    });

    test("a literal backslash in the name is escaped, so the escape is unambiguous", () => {
        const list = Buffer.concat([Buffer.from("a\\xff"), Buffer.from([0xfe]), Buffer.from([0x00])]);
        const lines = [];
        assert.equal(run([], list, (s) => lines.push(s)), 2);
        assert.match(messages(lines), /a\\\\xff\\xfe/);
    });
});

// ---------------------------------------------------------------- a crash is not a verdict

describe("the entry block, spawned", () => {
    // A stat without `isSymbolicLink` makes `bytesOf` throw a TypeError; a filesystem error would already exit 2.
    const preload = () => {
        const dir = scratch();
        const file = path.join(dir, "break-lstat.mjs");
        fs.writeFileSync(
            file,
            'import fs from "node:fs";\n' +
                "const real = fs.lstatSync;\n" +
                "fs.lstatSync = (p, ...rest) => {\n" +
                "    const st = real(p, ...rest);\n" +
                "    return { isFile: () => st.isFile() };\n" +
                "};\n",
        );
        return pathToFileURL(file).href;
    };

    const spawnScanner = (list, importUrl) =>
        spawnSync(
            process.execPath,
            [...(importUrl ? ["--import", importUrl] : []), path.join(REPO, "cli", "control-chars.mjs")],
            { input: list, encoding: "utf8" },
        );

    const listOf = (...names) => names.map((n) => `${n}${NUL}`).join("");

    test("a crash is exit 2 — never 1, which is the code a FINDING owns", () => {
        const done = spawnScanner(listOf("cli/control-chars.mjs"), preload());
        assert.equal(
            done.status,
            2,
            `a crash must not borrow the finding's exit code. stderr:\n${done.stderr}`,
        );
    });

    test("the crash report names the SCANNER, and says no file was judged", () => {
        const done = spawnScanner(listOf("cli/control-chars.mjs"), preload());
        assert.match(done.stderr, /control-chars: could not run/);
        assert.match(done.stderr, /defect in the scanner, not a verdict about the tree/);
        assert.match(done.stderr, /no file was judged/);
        assert.doesNotMatch(done.stderr, /control character\(s\)/);
    });

    test("the stack still prints, because a crash is a defect somebody has to fix", () => {
        const done = spawnScanner(listOf("cli/control-chars.mjs"), preload());
        assert.match(done.stderr, /TypeError/);
        assert.match(done.stderr, /at bytesOf/, "the stack must survive, or a crash is unfixable from the report");
    });

    test("without the fault the same spawn is a real verdict, so the preload is what moved the code", () => {
        const done = spawnScanner(listOf("cli/control-chars.mjs"));
        assert.equal(done.status, 0, `the unbroken scanner must judge the tree: ${done.stderr}`);
        assert.doesNotMatch(done.stderr, /could not run/);
    });

    test("a real FINDING still exits 1, so the reservation did not swallow the verdict", () => {
        const dir = tree({ "bad.md": `x${ch(0x01)}y` });
        const done = spawnSync(process.execPath, [path.join(REPO, "cli", "control-chars.mjs")], {
            input: `bad.md${NUL}`,
            encoding: "utf8",
            cwd: dir,
        });
        assert.equal(done.status, 1, `a finding owns exit 1: ${done.stdout}${done.stderr}`);
        assert.match(done.stdout, /control character\(s\)/);
    });
});

// ---------------------------------------------------------------- this repository

describe("the live tree", () => {
    test("every tracked file, plus every new and not-ignored one, is free of control characters outside TAB and LF", () => {
        // No `encoding`: a decoded listing would turn a name that is not UTF-8 into one `bytesOf` cannot find.
        const listing = execFileSync(
            "git",
            ["-C", REPO, "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
            { maxBuffer: 32 * 1024 * 1024 },
        );
        const { paths, undecodable } = splitList(listing);
        assert.deepEqual(undecodable, [], "a scanned pathname — tracked, or new and not ignored — did not survive decoding; the scan would have skipped it");
        const files = paths.map((rel) => path.join(REPO, rel));
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
