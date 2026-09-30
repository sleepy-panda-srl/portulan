#!/usr/bin/env node
// `control-chars` — the rail on bytes a reader cannot see.
//
//   git ls-files --cached --others --exclude-standard -z | node cli/control-chars.mjs [--exempt <path>]...
//
// Exit 0 every scanned file is clean · 1 one is not · 2 could not run.

import fs from "node:fs";
import { pathToFileURL } from "node:url";

/** Raised when the scan cannot run, or cannot judge honestly. Always exit 2, never 1. */
export class ControlCharsError extends Error {
    constructor(message) {
        super(message);
        this.name = "ControlCharsError";
    }
}

const TAB = 0x09;
const LF = 0x0a;
const DEL = 0x7f;

/** C0 mnemonics, so a finding names its byte rather than printing the defect into the report. */
const NAMES = [
    "NUL", "SOH", "STX", "ETX", "EOT", "ENQ", "ACK", "BEL",
    "BS", "TAB", "LF", "VT", "FF", "CR", "SO", "SI",
    "DLE", "DC1", "DC2", "DC3", "DC4", "NAK", "SYN", "ETB",
    "CAN", "EM", "SUB", "ESC", "FS", "GS", "RS", "US",
];

export const nameOf = (byte) => (byte === DEL ? "DEL" : (NAMES[byte] ?? `0x${byte.toString(16).padStart(2, "0")}`));

export const isForbidden = (byte) => byte !== TAB && byte !== LF && (byte < 0x20 || byte === DEL);

const C1_NAMES = [
    "PAD", "HOP", "BPH", "NBH", "IND", "NEL", "SSA", "ESA",
    "HTS", "HTJ", "VTS", "PLD", "PLU", "RI", "SS2", "SS3",
    "DCS", "PU1", "PU2", "STS", "CCH", "MW", "SPA", "EPA",
    "SOS", "SGCI", "SCI", "CSI", "ST", "OSC", "PM", "APC",
];

const C1_LEAD = 0xc2;

/** `0xc2` never occurs mid-sequence in UTF-8, so a C1 control is found without decoding. */
const isC1At = (buffer, i) => buffer[i] === C1_LEAD && buffer[i + 1] >= 0x80 && buffer[i + 1] <= 0x9f;

export const nameOfC1 = (second) => `U+00${second.toString(16).toUpperCase()} ${C1_NAMES[second - 0x80]}`;

const escapeBytes = (buffer) =>
    [...buffer]
        .map((b) => {
            // A backslash is doubled, so a name holding the text `\xff` cannot read as the byte `0xff`.
            if (b === 0x5c) return "\\\\";
            return b >= 0x20 && b < DEL ? String.fromCharCode(b) : `\\x${b.toString(16).padStart(2, "0")}`;
        })
        .join("");

/** Every path a message names goes through here: git allows any byte but NUL and `/` in a name. */
const displayPath = (file) => escapeBytes(Buffer.from(file, "utf8"));

/** Each forbidden byte: `offset` is 0-based, `line` and `column` 1-based, and `column` counts bytes. */
export function scanBytes(buffer) {
    const found = [];
    let line = 1;
    let lineStart = 0;
    for (let i = 0; i < buffer.length; i += 1) {
        const byte = buffer[i];
        if (byte === LF) {
            line += 1;
            lineStart = i + 1;
            continue;
        }
        if (isForbidden(byte)) {
            found.push({ offset: i, byte, name: nameOf(byte), line, column: i - lineStart + 1 });
            continue;
        }
        if (isC1At(buffer, i)) {
            found.push({ offset: i, byte: buffer[i], name: nameOfC1(buffer[i + 1]), line, column: i - lineStart + 1 });
        }
    }
    return found;
}

/** The bytes git stores for a path (a symlink's target path, not its target), or `null` when not on disk. */
export function bytesOf(file) {
    let stat;
    try {
        stat = fs.lstatSync(file);
    } catch (cause) {
        if (cause.code === "ENOENT") return null;
        throw new ControlCharsError(
            `cannot stat ${displayPath(file)} — ${cause.code ?? cause.message}. ` +
                "Refusing to report it clean: this is a fact about the filesystem, not about the file",
        );
    }

    if (stat.isSymbolicLink()) {
        try {
            // `"buffer"`: the default decodes as UTF-8 and alters a target that is not valid UTF-8.
            return fs.readlinkSync(file, "buffer");
        } catch (cause) {
            throw new ControlCharsError(`cannot read the symlink ${displayPath(file)} — ${cause.code ?? cause.message}`);
        }
    }

    if (!stat.isFile()) {
        throw new ControlCharsError(
            `${displayPath(file)} is neither a regular file nor a symlink, and this reads neither by guessing at it`,
        );
    }

    try {
        return fs.readFileSync(file);
    } catch (cause) {
        throw new ControlCharsError(
            `cannot read ${displayPath(file)} — ${cause.code ?? cause.message}. ` +
                "Refusing to report it clean: this is a fact about the filesystem, not about the file",
        );
    }
}

export function inspect(files, { exempt = new Set() } = {}) {
    if (files.length === 0) {
        throw new ControlCharsError(
            "no files to scan — refusing to report green having examined nothing. " +
                "The list arrives on stdin; an empty one means the enumeration failed, not that the tree is empty",
        );
    }

    const findings = [];
    const seen = new Set();
    const carrying = new Set();
    const unread = new Set();
    let scanned = 0;
    let skipped = 0;

    for (const file of files) {
        seen.add(file);
        const buffer = bytesOf(file);
        if (buffer === null) {
            skipped += 1;
            unread.add(file);
            continue;
        }
        scanned += 1;
        const bad = scanBytes(buffer);
        if (bad.length === 0) continue;
        carrying.add(file);
        if (exempt.has(file)) continue;
        findings.push({ file, count: bad.length, first: bad[0] });
    }

    const unusable = [];
    for (const file of exempt) {
        if (!seen.has(file)) unusable.push({ file, why: "is not in the scanned set" });
        else if (unread.has(file)) {
            unusable.push({
                file,
                why: "is tracked and not on disk, so it was never read — this run cannot say whether the exemption is still live",
            });
        } else if (!carrying.has(file)) {
            unusable.push({ file, why: "carries no control character, so the exemption is dead" });
        }
    }

    return { findings, unusable, scanned, skipped, exempted: exempt.size };
}

// ===========================================================================================
// The command
// ===========================================================================================

/** `git ls-files -z` output, split as bytes; a name that fails a UTF-8 round trip is `undecodable`. */
export function splitList(input) {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
    const paths = [];
    const undecodable = [];
    let start = 0;
    for (let i = 0; i <= buffer.length; i += 1) {
        if (i !== buffer.length && buffer[i] !== 0x00) continue;
        if (i > start) {
            const chunk = buffer.subarray(start, i);
            const text = chunk.toString("utf8");
            // A round trip rather than a U+FFFD test: a filename may itself contain U+FFFD.
            if (Buffer.from(text, "utf8").equals(chunk)) paths.push(text);
            else undecodable.push(chunk);
        }
        start = i + 1;
    }
    return { paths, undecodable };
}

export function run(argv, stdin, say = (line) => process.stdout.write(`${line}\n`)) {
    const exempt = new Set();
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === "--exempt") {
            const file = argv[i + 1];
            i += 1;
            // Only a missing value is refused: a path git tracks may start with `--`.
            if (file === undefined) {
                say("  ✗ --exempt needs a path");
                return 2;
            }
            exempt.add(file);
        } else {
            say(`  ✗ unknown argument ${JSON.stringify(argv[i])} — this reads its file list from stdin`);
            return 2;
        }
    }

    const { paths, undecodable } = splitList(stdin);
    if (undecodable.length) {
        for (const chunk of undecodable) {
            say(`  ✗ the file list carries a pathname that is not valid UTF-8: ${escapeBytes(chunk)}`);
        }
        say(
            `  ✗ refusing to scan ${paths.length} file(s), beside ${undecodable.length} pathname(s) this tool cannot name. ` +
                "A path that does not survive decoding is one it would look for under a different name, find " +
                "absent, and count as skipped — a green over a file nothing read",
        );
        return 2;
    }

    let result;
    try {
        result = inspect(paths, { exempt });
    } catch (error) {
        if (!(error instanceof ControlCharsError)) throw error;
        say(`  ✗ ${error.message}`);
        return 2;
    }

    if (result.unusable.length) {
        for (const s of result.unusable) say(`  ✗ --exempt ${displayPath(s.file)} ${s.why}`);
        return 2;
    }

    for (const f of result.findings) {
        say(
            `  ✗ ${displayPath(f.file)}: ${f.count} control character(s) — first at line ${f.first.line}, ` +
                `byte column ${f.first.column} (byte offset ${f.first.offset}, 0-based): ${f.first.name}`,
        );
    }

    if (result.findings.length) return 1;

    say(
        `  ok ${result.scanned} file(s) carry no control character outside TAB and LF` +
            (result.skipped ? `; ${result.skipped} tracked and not on disk` : "") +
            (result.exempted ? `; ${result.exempted} exempted by declaration` : ""),
    );
    return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    let stdin;
    try {
        // Bytes, not text: decoding here would turn a name that is not valid UTF-8 into another name.
        stdin = fs.readFileSync(0);
    } catch (cause) {
        process.stderr.write(
            `control-chars: cannot read the file list from stdin — ${cause.code ?? cause.message}\n` +
                "usage: git ls-files --cached --others --exclude-standard -z | " +
                "node cli/control-chars.mjs [--exempt <path>]...\n",
        );
        process.exitCode = 2;
        stdin = null;
    }
    // `exitCode`, not `exit()`, so stdout drains; anything uncaught exits 2, because 1 means a finding.
    if (stdin !== null) {
        try {
            process.exitCode = run(process.argv.slice(2), stdin);
        } catch (cause) {
            process.stderr.write(
                `control-chars: could not run — ${cause?.stack ?? cause}\n` +
                    "This is a defect in the scanner, not a verdict about the tree: no file was judged.\n",
            );
            process.exitCode = 2;
        }
    }
}
