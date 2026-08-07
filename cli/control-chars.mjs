#!/usr/bin/env node
// `control-chars` — the rail on bytes a reader cannot see.
//
//   git ls-files --cached --others --exclude-standard -z | node cli/control-chars.mjs [--exempt <path>]...
//
// Exit 0 every scanned file is clean · 1 one is not · 2 could not run.
//
// ## Why this exists
//
// A raw NUL shipped inside `../.portulan/verify/workflow-filters.mjs` as the separator in a template
// literal, where the escape `\^@` was meant. A reviewer caught it; nothing in this repository did, and
// the reason is the part that matters (issue #68):
//
//   * `file` classified the source as *binary data*.
//   * `grep -n "identity = "` against the line that plainly contains that text exited **1** — a silent
//     false negative. Every recipe in `../.portulan/verify/` is built out of `grep`, so the one tool
//     that would have shown it is the tool the byte silences.
//   * `git` rendered the diff as text only because the byte sat past its first 8000 bytes. A few
//     hundred lines earlier and a 660-line instrument would have arrived in review as `Binary files
//     differ` — a file nobody could read, in a pull request that looked complete.
//
// It then reproduced twice more while being fixed. Three tools noticed across the whole incident and
// none of them was ours, which is `a-mandate-nothing-checks-is-already-broken.md` with the mandate
// left implicit: nobody had ever written down that a tracked file may not carry one.
//
// ## What counts, and the one thing that does not
//
// Every byte in the C0 range — `0x00`–`0x1F` — except **TAB** and **LF**, plus **DEL** (`0x7F`).
// DEL is not in C0 and is the same defect: invisible, and printed by `cat -v` as `^?`.
//
// **CR is refused**, which is a decision rather than an oversight. No tracked file in this repository
// carries one, so the rail costs nothing today and stops CRLF arriving unnoticed in a tree that is
// uniformly LF. A repository that wants CRLF wants it declared, not discovered.
//
// ## Bytes, never text
//
// The scan reads a `Buffer` and never decodes it. Decoding invalid UTF-8 yields U+FFFD, which both
// hides bytes and invents a character that was not there — and this is the one check in the repository
// whose entire subject is what the bytes actually are. It is exact rather than approximate for a reason
// the encoding gives for free: no C0 byte and no `0x7F` ever appears inside a multi-byte UTF-8
// sequence, whose continuation bytes are all `>= 0x80`. So a byte scan and a character scan agree here,
// and only the byte scan can be trusted to.
//
// ## Why the exemption is a NAMED PATH and never a content sniff
//
// Issue #68 offers two scopes: tracked text files — `git ls-files` plus a binary test — or an allow-list
// of extensions. **The binary test is refused, and the incident is why:** every binary sniff in general
// use is keyed on NUL, which is exactly the byte that motivated this check. `file` called the defective
// source *binary data*; git's own heuristic reads the first 8000 bytes for a NUL. A check that skipped
// what those call binary would have skipped the one file it exists to catch — a fail-open by
// construction, in the shape `a-checkers-coverage-is-measured-not-named.md` describes.
//
// An extension allow-list is refused for the reason this repository always refuses one: it is a door
// every future file type walks through in silence.
//
// What is left is a declaration. `--exempt <path>` names ONE path, is repeatable, and the workspace's
// recipe supplies it — so a binary asset arriving in this tree costs one reviewable line rather than a
// permanently red gate, and it costs it in a pull request where somebody sees it. The declaration is
// AUDITED in both directions, because an exemption nobody checks is the allow-list defect this project
// has already paid for once (`cli/vendor.mjs`, round 13 of #164 — the carve-out permitted a thing that
// was not a file):
//
//   * an exempted path that was not scanned is **stale** — exit 2, never a quiet pass;
//   * an exempted path carrying no control character is **dead** — exit 2, because an exemption that is
//     not load-bearing is one nobody will notice has stopped being true.
//
// Zero dependencies, no network, no install step — same constraints as ./doctor.mjs and ./index.mjs.
// It is not one of the eight subcommands `../docs/vision.md` names, and is not wired behind the entry
// point, for the same reason `./plugin-lint.mjs` is not: whether it joins them is the maintainer's call.

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

/**
 * The C0 mnemonics, so a finding names the byte rather than printing it.
 *
 * Printing the character would reproduce the defect inside the report — the incident did exactly that
 * twice while being fixed, once in the README paragraph describing it and once in the shell command
 * carrying the commit message. A check whose output can carry the thing it checks for is a check that
 * can silence its own next run.
 */
const NAMES = [
    "NUL", "SOH", "STX", "ETX", "EOT", "ENQ", "ACK", "BEL",
    "BS", "TAB", "LF", "VT", "FF", "CR", "SO", "SI",
    "DLE", "DC1", "DC2", "DC3", "DC4", "NAK", "SYN", "ETB",
    "CAN", "EM", "SUB", "ESC", "FS", "GS", "RS", "US",
];

/** `0x00` → `NUL`, `0x7f` → `DEL`. Never the character itself. */
export const nameOf = (byte) => (byte === DEL ? "DEL" : (NAMES[byte] ?? `0x${byte.toString(16).padStart(2, "0")}`));

/** Is this byte one a tracked file may not carry? TAB and LF are the whole allowance. */
export const isForbidden = (byte) => byte !== TAB && byte !== LF && (byte < 0x20 || byte === DEL);

/**
 * Every forbidden byte in a buffer, as `{ offset, byte, name, line, column }`.
 *
 * `line` and `column` are 1-based, and **`column` counts BYTES**, which is stated rather than left to
 * be discovered: a line holding a three-byte em dash has a byte column larger than its character
 * column, and this check's own subject is claims that outrun their measurement (the `plan` rail makes
 * the same distinction about `awk`'s `length()`). The byte offset is the figure that is unambiguous,
 * and it is what an editor's go-to-byte takes.
 */
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
        }
    }
    return found;
}

/**
 * The bytes git tracks for one path, or `null` when the path is not on disk.
 *
 * **A symlink is read as its target STRING, not through it.** That string is the blob git stores, and
 * it is the thing this check is asked about; following the link would scan a file that may not be in
 * the repository at all, and a dangling one would be an error about the wrong thing.
 *
 * Only `ENOENT` is `null` — a file tracked in the index and deleted from the working tree, which is an
 * ordinary state and the one `../.portulan/verify/json.sh` already skips. Every other errno means the
 * process could not look, and *could not look* reported as *looked and found nothing* is the failure
 * `a-checker-must-refuse-what-it-cannot-check.md` is about.
 *
 * Anything that is neither a regular file nor a symlink — a FIFO, a socket, a device node, a directory
 * — is refused rather than guessed at, which is `./vendor.mjs`'s rule in `./vendor.mjs`'s words: this
 * reads neither by guessing at it.
 */
export function bytesOf(file) {
    let stat;
    try {
        stat = fs.lstatSync(file);
    } catch (cause) {
        if (cause.code === "ENOENT") return null;
        throw new ControlCharsError(
            `cannot stat ${file} — ${cause.code ?? cause.message}. ` +
                "Refusing to report it clean: this is a fact about the filesystem, not about the file",
        );
    }

    if (stat.isSymbolicLink()) {
        try {
            return Buffer.from(fs.readlinkSync(file), "utf8");
        } catch (cause) {
            throw new ControlCharsError(`cannot read the symlink ${file} — ${cause.code ?? cause.message}`);
        }
    }

    if (!stat.isFile()) {
        throw new ControlCharsError(
            `${file} is neither a regular file nor a symlink, and this reads neither by guessing at it`,
        );
    }

    try {
        return fs.readFileSync(file);
    } catch (cause) {
        throw new ControlCharsError(
            `cannot read ${file} — ${cause.code ?? cause.message}. ` +
                "Refusing to report it clean: this is a fact about the filesystem, not about the file",
        );
    }
}

/**
 * Scan a list of paths.
 *
 * Returns `{ findings, stale, scanned, skipped, exempted }`. A finding is
 * `{ file, count, first }` — one per offending file rather than one per byte, because a genuinely
 * binary asset holds thousands and a report that prints them all is a report nobody reads. The count
 * is stated beside the first, so nothing is dropped in silence.
 *
 * **An empty list is refused.** Zero files scanned and a green report is the enumeration fail-open this
 * repository has fixed five times (`verify-preconditions-fail-closed.md`), and it is the failure this
 * check is most exposed to: its whole input arrives through a pipe.
 */
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
    let scanned = 0;
    let skipped = 0;

    for (const file of files) {
        seen.add(file);
        const buffer = bytesOf(file);
        if (buffer === null) {
            skipped += 1;
            continue;
        }
        scanned += 1;
        const bad = scanBytes(buffer);
        if (bad.length === 0) continue;
        carrying.add(file);
        if (exempt.has(file)) continue;
        findings.push({ file, count: bad.length, first: bad[0] });
    }

    // The audit, in both directions. An exemption that names nothing scanned is stale; one that names a
    // clean file is dead. Either way the declaration and the tree disagree, and a check that walks past
    // that is a check whose exemptions accumulate — see this file's header.
    const stale = [];
    for (const file of exempt) {
        if (!seen.has(file)) stale.push({ file, why: "is not in the scanned set" });
        else if (!carrying.has(file)) stale.push({ file, why: "carries no control character, so the exemption is dead" });
    }

    return { findings, stale, scanned, skipped, exempted: exempt.size };
}

// ===========================================================================================
// The command
// ===========================================================================================

/** The NUL-separated list `git ls-files -z` writes, as paths. A trailing separator yields no empty entry. */
export const splitList = (text) => text.split("\0").filter((s) => s !== "");

export function run(argv, stdin, say = (line) => process.stdout.write(`${line}\n`)) {
    const exempt = new Set();
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === "--exempt") {
            const file = argv[i + 1];
            i += 1;
            if (file === undefined || file.startsWith("--")) {
                say("  ✗ --exempt needs a path");
                return 2;
            }
            exempt.add(file);
        } else {
            say(`  ✗ unknown argument ${JSON.stringify(argv[i])} — this reads its file list from stdin`);
            return 2;
        }
    }

    let result;
    try {
        result = inspect(splitList(stdin), { exempt });
    } catch (error) {
        if (!(error instanceof ControlCharsError)) throw error;
        say(`  ✗ ${error.message}`);
        return 2;
    }

    // The stale-exemption audit is a defect in the declaration rather than a verdict about a file, so
    // it exits 2 — the same code, and the same reasoning, as a stale entry in `index.sh`'s WORKSPACES.
    if (result.stale.length) {
        for (const s of result.stale) say(`  ✗ --exempt ${s.file} ${s.why}`);
        return 2;
    }

    for (const f of result.findings) {
        say(
            `  ✗ ${f.file}: ${f.count} control character(s) — first at byte ${f.first.offset} ` +
                `(line ${f.first.line}, byte column ${f.first.column}): ${f.first.name}`,
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
        stdin = fs.readFileSync(0, "utf8");
    } catch (cause) {
        // A terminal with nothing piped into it, most often. Refused with the usage line rather than
        // an empty list, which `inspect` would refuse anyway — but as "the enumeration failed", which
        // is a diagnosis of the wrong thing.
        process.stderr.write(
            `control-chars: cannot read the file list from stdin — ${cause.code ?? cause.message}\n` +
                "usage: git ls-files --cached --others --exclude-standard -z | " +
                "node cli/control-chars.mjs [--exempt <path>]...\n",
        );
        process.exitCode = 2;
        stdin = null;
    }
    // `process.exitCode` rather than `process.exit`: this writes its findings to stdout, and exiting
    // outright can truncate a pipe that has not drained. `./plugin-lint.mjs` settled that already.
    if (stdin !== null) process.exitCode = run(process.argv.slice(2), stdin);
}
