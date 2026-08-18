#!/usr/bin/env node
// `control-chars` — the rail on bytes a reader cannot see.
//
//   git ls-files --cached --others --exclude-standard -z | node cli/control-chars.mjs [--exempt <path>]...
//
// Exit 0 every scanned file is clean · 1 one is not · 2 could not run.
//
// **1 is RESERVED for a finding**, which is a promise the entry block at the foot of this file keeps
// rather than a description of what node does by default: an uncaught error would otherwise leave node
// to exit 1, and the recipe reads 1 as *a scanned file carries a control character* — a judged verdict
// about a tree, from a run that judged nothing (#208). **Scanned, not tracked**: the listing is
// `--cached --others --exclude-standard`, so it is the tracked set PLUS everything new and not ignored,
// which is the point — a byte is caught before it is committed. This line said "tracked" when #208 wrote
// it, adding a fresh carrier to the narrowing #170 already had on the roster; swept here with the rest.
//
// ## Why this exists
//
// A raw NUL shipped inside `../.portulan/verify/workflow-filters.mjs` as the separator in a template
// literal, where the escape `\u0000` was meant. A reviewer caught it; nothing in this repository did, and
// the reason is the part that matters (issue #68):
//
//   * `file` classified the source as *binary data*.
//   * `grep -n "identity = "` against the line that plainly contains that text exited **1** — a silent
//     false negative. `docs.sh` — the DEFAULT recipe, the one a Stop-gate runs when nothing more
//     specific applies — is built out of `grep` throughout, so the tool most likely to have shown the
//     byte is the tool the byte silences. (Named rather than counted, and that took two goes: the
//     first draft said *every* recipe in that directory was built out of `grep`, and FIVE invoke it
//     zero times — two of them carrying the word only in comments, which is why the number was three
//     for three days; the correction then asserted `seventeen invocations`, a figure taken from a word
//     count that included comments. A number nothing regenerates is a claim that rots — #77. Copilot
//     found the first, in three carriers; I found the second auditing my own fix.)
//   * `git` rendered the diff as text only because the byte sat past its first 8000 bytes. A few
//     hundred lines earlier and the whole instrument would have arrived in review as `Binary files
//     differ` — a file nobody could read, in a pull request that looked complete.
//
// It then reproduced twice more while being fixed. Three tools noticed across the whole incident and
// none of them was ours, which is `a-mandate-nothing-checks-is-already-broken.md` with the mandate
// left implicit: nobody had ever written down that a tracked file may not carry one.
//
// ## What counts, and the one thing that does not
//
// Every byte in the C0 range — `0x00`–`0x1F` — except **TAB** and **LF**, plus **DEL** (`0x7F`),
// plus every **C1** control character, `U+0080`–`U+009F`.
// DEL is not in C0 and is the same defect: invisible, and printed by `cat -v` as `^?`.
//
// **C1 was the half this could not see until #207**, and the gap was not theoretical: a planted U+009B
// (CSI — the byte that opens a terminal escape sequence) left the recipe green, measured at the
// retrospective pass over #167. C1 arrives as TWO UTF-8 bytes, `0xc2` then `0x80`–`0x9f`, so a per-byte
// C0 test cannot reach it however carefully it is written.
//
// **Format characters are deliberately still out** — zero-width space, the bidi marks, word joiner,
// BOM (`U+200B`–`U+200F`, `U+2060`–`U+206F`, `U+FEFF`). They are a different question, not a smaller
// one: unlike C1 they appear legitimately in prose, so a rail over them needs an exemption mechanism far
// busier than the named-path list below, and that is a proposal rather than an addition here.
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
// AUDITED, because an exemption nobody checks is the allow-list defect this project has already paid
// for once (`cli/vendor.mjs`, round 13 of #164 — the carve-out permitted a thing that was not a file).
// Three outcomes, each exit 2 and none a quiet pass:
//
//   * an exempted path that is not in the list at all is **stale**;
//   * an exempted path that is tracked and not on disk was **never read**, so this run cannot say
//     whether the exemption is live — which is a different fact from either of the others and was
//     reported as *dead* until Copilot separated them;
//   * an exempted path carrying no control character is **dead**, because an exemption that is not
//     load-bearing is one nobody will notice has stopped being true.
//
// **One limit, stated rather than left to be found:** an exemption is matched by the path as the file
// list spells it, and `--exempt` values arrive through `argv` already decoded. So a pathname that is
// not valid UTF-8 cannot be exempted — but it cannot be scanned either; `splitList` refuses the whole
// run over it at exit 2, so there is no silent gap here, only a repository this tool would decline to
// judge until the name is changed.
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
 * The C1 mnemonics, `0x80`–`0x9f`, indexed from `0x80`.
 *
 * C1 is the half this check could not see until #207. These are control characters by every definition
 * that matters here — invisible, semantically active in terminals (`CSI` opens an escape sequence), and
 * unreachable by the byte test above, because in UTF-8 they arrive as **two** bytes, `0xc2` followed by
 * `0x80`–`0x9f`, and neither of those is in C0.
 *
 * Measured at the retrospective pass over #167: a planted U+009B left this recipe green.
 */
const C1_NAMES = [
    "PAD", "HOP", "BPH", "NBH", "IND", "NEL", "SSA", "ESA",
    "HTS", "HTJ", "VTS", "PLD", "PLU", "RI", "SS2", "SS3",
    "DCS", "PU1", "PU2", "STS", "CCH", "MW", "SPA", "EPA",
    "SOS", "SGCI", "SCI", "CSI", "ST", "OSC", "PM", "APC",
];

const C1_LEAD = 0xc2;

/**
 * Is a C1 control character encoded at `i`? Two bytes, `0xc2` then `0x80`–`0x9f`.
 *
 * **This is the one place the scan looks at more than one byte, and it stays a byte test rather than
 * becoming a decode.** Decoding is refused for the reason the header gives — U+FFFD both hides bytes and
 * invents characters — and it is not needed: `0xc2` is a two-byte lead whose only continuations are
 * `0x80`–`0xbf`, so this sequence is unambiguous without decoding anything around it.
 */
const isC1At = (buffer, i) => buffer[i] === C1_LEAD && buffer[i + 1] >= 0x80 && buffer[i + 1] <= 0x9f;

/** `0x9b` → `U+009B CSI`. The code point, never the character — `nameOf`'s rule on the other range. */
export const nameOfC1 = (second) => `U+00${second.toString(16).toUpperCase()} ${C1_NAMES[second - 0x80]}`;

/**
 * Bytes rendered for a message, with everything outside printable ASCII as `\xNN` — **never raw**.
 *
 * `nameOf`'s rule, applied to a run of bytes instead of to one. It lives beside it because it is the
 * same rule and was learned the same way.
 */
const escapeBytes = (buffer) =>
    [...buffer]
        .map((b) => {
            // The backslash is escaped FIRST, and that is the whole reason this is not a one-liner: a
            // filename literally containing the characters `\`, `x`, `f`, `f` would otherwise render
            // exactly like the byte `0xff`, so the message meant to remove an ambiguity would carry
            // one. `\\` is unambiguous and reads correctly beside the `\xNN` escapes.
            if (b === 0x5c) return "\\\\";
            return b >= 0x20 && b < DEL ? String.fromCharCode(b) : `\\x${b.toString(16).padStart(2, "0")}`;
        })
        .join("");

/**
 * A pathname as it may be PRINTED. **Every message in this file that names a path goes through here.**
 *
 * Git tracks a filename of any bytes but NUL and `/` — measured, not assumed: a file named
 * `we<LF>ird.md` is trackable, and `git ls-files -z` emits that newline raw. So a report interpolating
 * a filename directly could **print the very bytes this check exists to catch** into a CI log, and a
 * newline in a name would break the one-line-per-file contract every consumer of this output reads by.
 *
 * That is `nameOf`'s own argument turned on the other half of the line: *a check whose output can carry
 * the thing it checks for is a check that can silence its own next run.* The escaping shipped for the
 * undecodable-path case in round 3 and was not applied to the six places that name an ordinary path —
 * a fix missing its siblings, the third time in this pull request. Copilot, #167, suppressed channel.
 */
const displayPath = (file) => escapeBytes(Buffer.from(file, "utf8"));

/**
 * Every forbidden byte in a buffer, as `{ offset, byte, name, line, column }`.
 *
 * **`offset` is 0-based; `line` and `column` are 1-based.** The three are not on one scale and saying
 * so is not pedantry — `offset` is an index into the buffer, so it is 0-based by construction, while
 * a line number that started at 0 would disagree with every editor and every other message in this
 * repository. Copilot found the mismatch stated the other way on #167 round 1, in a test NAME, which
 * is where a reader looks for the contract.
 *
 * **`column` counts BYTES**, likewise stated rather than left to be discovered: a line holding a
 * three-byte em dash has a byte column larger than its character column, and this check's own subject
 * is claims that outrun their measurement — the distinction the `plan` rail already makes about
 * `awk`'s `length()`.
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
            continue;
        }
        // C1, and reported at the LEAD byte: that is where the character starts, and an offset pointing
        // at the continuation would send a reader one byte past the thing they are looking for. `i` is
        // not advanced — the continuation is `0x80`–`0x9f`, which no other branch here matches, so there
        // is nothing to skip and the line counting stays a single rule.
        //
        // `byte` is the byte AT `offset`, which for C1 is the lead `0xc2` — not the continuation that
        // says which C1 this is. The first draft put the continuation here and left `offset` on the
        // lead, so one record answered "where" and "what" about two different bytes: a reader seeking
        // `byte` at `offset` would not find it. Nothing consumes the field today — the locator prints
        // `name`, `line`, `column` and `offset` — so this is latent rather than a live wrong message,
        // and that is exactly why it is worth fixing now: an unread field is where an untrue one
        // survives. `name` already carries which character it is, via the continuation, so nothing is
        // lost. The C0 branch above sets `byte` to the byte at its own offset; both branches now mean
        // the same thing by the same key. Copilot, #251 round 1.
        if (isC1At(buffer, i)) {
            found.push({ offset: i, byte: buffer[i], name: nameOfC1(buffer[i + 1]), line, column: i - lineStart + 1 });
        }
    }
    return found;
}

/**
 * The bytes git tracks for one path, or `null` when the path is not on disk.
 *
 * **A symlink is read as its target's BYTES, not through it.** Those bytes are the blob git stores, and
 * they are the thing this check is asked about; following the link would scan a file that may not be in
 * the repository at all, and a dangling one would be an error about the wrong thing. Bytes rather than
 * the string `readlinkSync` hands back by default — see the branch below for what that default cost.
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
            `cannot stat ${displayPath(file)} — ${cause.code ?? cause.message}. ` +
                "Refusing to report it clean: this is a fact about the filesystem, not about the file",
        );
    }

    if (stat.isSymbolicLink()) {
        try {
            // `"buffer"`, not the default string. `readlinkSync` decodes as UTF-8 by default, so a
            // target git stores as raw bytes came back U+FFFD-substituted and was re-encoded into
            // DIFFERENT bytes — which both breaks this function's own "never decodes" promise and can
            // hide a control byte sitting in the target. That is the identical defect `splitList`
            // was just repaired for, two functions below, in the same push that repaired it: a fix
            // arriving without its sibling, which is the class `0020` names. Copilot found it in the
            // suppressed channel on the very next round.
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

/**
 * Scan a list of paths.
 *
 * Returns `{ findings, unusable, scanned, skipped, exempted }`. A finding is
 * `{ file, count, first }` — one per offending file rather than one per byte, because a genuinely
 * binary asset holds thousands and a report that prints them all is a report nobody reads. The count
 * is stated beside the first, so nothing is dropped in silence.
 *
 * `unusable` holds the exemptions this run could not show to be doing their job, each with its own
 * `why`. It was called `stale` while it carried two cases and gained a third — *not read* — which is
 * not staleness at all, so the name went with the meaning rather than after it.
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
    // Listed and NOT READ — tracked, absent from the working tree. Kept apart from `carrying` because
    // the audit below must not read one as the other; see there.
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

    // The audit, in three directions rather than two. An exemption naming nothing in the list is stale
    // and one over a clean file is dead — but between them sits a third case the first draft collapsed
    // into the second: a file that is tracked, absent from the working tree, and therefore NEVER READ.
    // `seen` had it, `carrying` did not, so it was reported *carries no control character, so the
    // exemption is dead* — a specific claim about a file nothing opened, which would send the
    // maintainer to delete an exemption that is still load-bearing. That is this check's own subject
    // and #92's class exactly: a verdict about something never examined. Copilot, suppressed channel.
    //
    // It stays exit 2 rather than passing quietly: an exemption nothing could verify is not a verified
    // exemption, which is `a-checker-must-refuse-what-it-cannot-check.md`.
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

/**
 * The NUL-separated list `git ls-files -z` writes, split at the BYTE level.
 *
 * Returns `{ paths, undecodable }`. A trailing separator yields no empty entry.
 *
 * **The split and the decode are two different fail-opens, and only the first was closed.** `-z` was
 * chosen so a filename could not reach this scanner mis-SPELLED — git C-quotes a control character in
 * the line-based form regardless of `core.quotePath`, so the alternative delivers `"we\nird.md"` as one
 * printable line rather than two, and the loss is the name and not the split (#209, measured; an earlier
 * version of this sentence said "could not be mis-split", which named a failure git already prevents) —
 * but the list was then decoded
 * whole with `readFileSync(0, "utf8")`, and git allows a pathname to be **any bytes except NUL and
 * `/`**. Node replaces an invalid sequence with U+FFFD, so such a name arrived here as a *different
 * string*, `bytesOf` looked for that string, got `ENOENT`, and the file was counted as *tracked and
 * not on disk* — **skipped, and the run reported green over a file nothing had read**, with a
 * plausible sentence in the summary saying so. A silent skip is the exact failure this whole check
 * exists to catch, one layer up: `grep` went quiet on the NUL, and this went quiet on the name.
 * Copilot found it on #167 in both channels at once — the thread on the production read, the
 * suppressed note on the same decode in the live-tree test.
 *
 * So the bytes are split as bytes, and each chunk is kept only if it **round-trips** through UTF-8.
 * Anything else is returned as `undecodable` for the caller to refuse over — never repaired, never
 * dropped. `a-checker-must-refuse-what-it-cannot-check.md`: a path this tool cannot represent is one
 * it would look for under a different name.
 */
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
            // The round trip is the test, not a regex for U+FFFD: a filename may legitimately CONTAIN
            // U+FFFD, and rejecting that would be a false red on a name git stores exactly as given.
            // Re-encoding answers the only question that matters — did anything change on the way in.
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
            // Only a MISSING value is refused. The first draft also rejected anything starting with
            // `--`, copied from `./index.mjs`'s `--pack-root` — and here that guard blocks a path git
            // can perfectly well track, in the one mechanism this whole check rests on: a file named
            // `--asset.bin` could never be exempted, with no workaround. It buys nothing either, and
            // that is the deciding half rather than the rarity: the mistake it was aimed at — a
            // forgotten value, `--exempt --other` — is already caught by the exemption AUDIT, which
            // says `--exempt --other is not in the scanned set` and exits 2. A guard whose only job is
            // already done elsewhere, at the cost of a capability, is one to delete. Copilot, #167,
            // suppressed channel.
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

    // Refused before anything is scanned, and refused rather than skipped. Exit 2 is the honest code:
    // the tree may be perfectly clean, and this run cannot say so — which is the difference between a
    // verdict and a failure to reach one.
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

    // The stale-exemption audit is a defect in the declaration rather than a verdict about a file, so
    // it exits 2 — the same code, and the same reasoning, as a stale entry in `index.sh`'s WORKSPACES.
    if (result.unusable.length) {
        for (const s of result.unusable) say(`  ✗ --exempt ${displayPath(s.file)} ${s.why}`);
        return 2;
    }

    // The locator leads with line and byte column — 1-based, the numbers an editor shows — and gives
    // the buffer offset after them, saying it is 0-based. The first draft printed `byte 19 (line 1,
    // byte column 20)` and named neither base, so the two numbers looked like a contradiction about
    // the same position. A message that has to be decoded is the failure this whole check is about,
    // one layer up. Copilot, round 1 on #167, which found the same mismatch in a test name.
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
        // **No encoding.** `readFileSync(0, "utf8")` decoded the whole list before anything could
        // check it, which is where the U+FFFD substitution happened — see `splitList`. The bytes
        // arrive as bytes and the decode is per path, with a round trip deciding.
        stdin = fs.readFileSync(0);
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
    //
    // **1 is reserved for a finding, so everything unhandled is 2** (#208). An uncaught error here used
    // to leave node to exit **1**, which `../.portulan/verify/control-chars.sh` reads as this tool's
    // documented "a scanned file carries a control character" — a judged verdict about a tree, produced
    // by a run that judged nothing. The direction was always safe; the SENTENCE was false, which is the
    // shape this file's own recipe cites `compile.sh` for. The stack still prints, because a crash is a
    // defect in this tool and hiding it would trade one wrong report for another.
    //
    // **The test that binds this forces the crash from OUTSIDE the module** — a `node --import` preload
    // that makes `fs.lstatSync` return a stat-shaped object with no `isSymbolicLink`, so the TypeError
    // lands in `bytesOf`'s one unwrapped call: the `try` there covers the `lstatSync` CALL, and
    // `stat.isSymbolicLink()` sits outside it. That is deliberate — it keeps the fault injection out of
    // the shipped code, where a test-only `main()` export or an env-gated throw would both have added a
    // surface whose only caller is this block. **The coupling is worth knowing before it bites:** if a
    // later change wraps `stat.isSymbolicLink()` inside that `try`, the preload stops producing an
    // uncaught error and the test goes red for a reason that has nothing to do with this arm. The repair
    // then is a NEW fault seam, never a revert of the wrapping.
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
