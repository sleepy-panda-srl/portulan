#!/usr/bin/env node
// Grammar-aware fuzzing over this repository's two shell segmenters.
//
// Milestone 8, clause (b), second half. The first half — mutation testing over both matchers — is
// ./mutants.mjs, and the two are separate because a surviving mutant and a grammar bypass are
// different verdicts with different repairs.
//
// ## Why a grammar, and not a string mutator
//
// A mutator that flips bytes in `git push --force origin main` has no idea whether the string it
// produced is still a command bash would run. It can therefore report neither a bypass nor a false
// red — only a difference, which somebody then has to adjudicate by hand. That is the review round
// this clause exists to replace.
//
// This generator instead COMPOSES a command from a grammar, and so knows by construction where the
// payload it embedded ended up:
//
//   - a **command position** — bash executes the payload. The matcher must answer `true`.
//   - a **data position** — bash never executes it. The matcher must answer `false`.
//
// That is an exact oracle rather than a statistical one, and it is what makes the word
// *grammar-aware* mean something here.
//
// **The declared ground truth is measured, not asserted.** ./fuzz-shell.ground.test.mjs runs every
// production under real bash with a NEUTRAL payload — `printf ok`, never a gated command — and fails
// if a production's declared position disagrees with what bash actually did. Every path spelling is
// verified the same way, by writing to a throwaway file in a temp directory. A hole list is a claim
// like any other; so is a grammar.
//
// ## Two axes, and only one of them is fuzzed
//
// **Positions are ENUMERATED and RECORDED.** There are few of them, each has a name a reader can
// argue with, and each carries the matcher's answer in `EXPECT`. Where that answer is not the one
// ground truth demands, the entry names the record that documents the divergence — an entry in
// `../.portulan/gate-map.md`'s honest-holes list, or, for one case, a decision recorded in
// `./compile.mjs` itself. Both directions are red, exactly as `documented-hole` is in ./goldens.mjs:
// a recorded escape that starts being caught is good news the record must absorb.
//
// **Spellings are FUZZED.** Within one position the generator writes the same semantic command many
// different ways — quoting form per word, backslash escapes, line continuations, `$'…'`, and for the
// write payload the path spellings a shell resolves to one file (`./`, `//`, `/./`, `/../`, quoted,
// escaped). The invariant is exact and it is the one the segmenters exist to provide: **every
// spelling of one command in one position must get the same answer.** A spelling that answers
// differently from its cell is the finding, and it is the shape three of #336's ten review rounds
// had: a reader narrower than a shell word.
//
// ## Deterministic, bounded, and reproducible
//
// A verify recipe whose verdict moves between runs is not a rail. The generator draws from a seeded
// PRNG written into this file — no dependency, no `Math.random` — and the recipe pins the seed. The
// seed is printed on EVERY run, green included, so a green is as reproducible as a red. `--seed` and
// `--cases` exist for a session hunting deeper than the pinned budget.
//
// ## What it never does
//
// **It executes nothing.** The payloads are `git push --force origin main` and a constitution write,
// by design; there is no code path from this module to a subprocess and ./fuzz-shell.test.mjs asserts
// it imports no process-spawning API. The bash measurement lives in the ground-truth test, uses a
// neutral payload, and is a separate file for exactly that reason.
//
// Exit 0 green · 1 red · 2 could not run.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CompileError, matchesRule } from "./compile.mjs";
import { CouldNotRun, matcherPath, yieldedRules } from "./goldens.mjs";

/** The pinned budget: spellings generated per (position × payload) cell. */
export const DEFAULT_CASES = 48;

/** The pinned seed. Changing it changes what is generated, so it is a reviewed edit like any other. */
export const DEFAULT_SEED = 20260825;

/**
 * The payloads: one per matcher, and TWO for the write matcher because it has two recognitions.
 *
 * `./compile.mjs`'s `shellWrites` docblock puts it plainly — *"Two recognitions, both by table: a
 * `>`/`>>` redirection into the path, and a file-writing command that names it"* — and measurement
 * showed the two do not answer alike everywhere: in the `same-line-comment` position the redirection
 * is caught and the named argument is not, because there the segment's head is `ls`. Folded into one
 * payload that cell would answer two ways and the fuzzer's invariant would have to be weakened to
 * admit it. Split, every cell is exact.
 *
 * Every rule named here must exist in the yielded policy or the run refuses — a fuzzer that skipped a
 * payload whose rule it could not find would report a clean sweep of the part it managed to run.
 */
export const PAYLOADS = {
    shell: { rule: "force-push-without-a-lease", tool: "Bash", what: "a gated force-push" },
    "write-redirect": { rule: "edit-the-constitution", tool: "Bash", what: "a redirection into the constitution" },
    "write-named": { rule: "edit-the-constitution", tool: "Bash", what: "a writer NAMING the constitution" },
};

/**
 * mulberry32 — a small, fast, well-distributed 32-bit PRNG.
 *
 * Written out rather than imported because this repository installs nothing, and reached for rather
 * than `Math.random` because a fuzzer whose corpus changes every run cannot be a required check: a
 * red nobody can reproduce is a red nobody fixes.
 */
export function prng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const pick = (rand, xs) => xs[Math.floor(rand() * xs.length) % xs.length];

/**
 * FNV-1a over a string, for deriving one cell's seed from its full identity.
 *
 * **The first cut mixed in `position.id.length` and `kind.length` instead**, which made every cell
 * whose id happened to be the same length share one stream — most of the grammar did, measured on
 * 2026-08-25 — while the comment beside it claimed each cell had its own. A claim broader than the code
 * it describes is this repository's signature defect and this session had already met it three times
 * in other people's code before writing one of its own. The cells stayed correct (each still drew its
 * full budget) and the spelling space collapsed onto far fewer distinct streams than the budget
 * implies, which is a quiet loss of exactly the diversity this axis exists for. Reported by Copilot,
 * round 1 on #338.
 */
export function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

// =============================================================================================
// The spelling axis — many ways to write one command
// =============================================================================================

/**
 * Quote or escape one word without changing what a shell makes of it.
 *
 * `$'…'` reaches `shellWords` with its `$` dropped and is then read as a single-quoted run, so no
 * ANSI-C escape sequence is generated inside one: `$'\x41'` is `A` to bash and `\x41` to the matcher,
 * which would be a generator that lies about its own ground truth rather than a finding.
 */
export function respell(word, rand) {
    switch (pick(rand, ["bare", "double", "single", "ansi-c", "escape-one", "split-quote"])) {
        case "double":
            return `"${word}"`;
        case "single":
            return `'${word}'`;
        case "ansi-c":
            return `$'${word}'`;
        case "escape-one": {
            // A backslash before an ordinary character is that character. Chosen at a position rather
            // than always the first, so the generator explores the word rather than one index of it.
            const i = Math.floor(rand() * word.length);
            return `${word.slice(0, i)}\\${word.slice(i)}`;
        }
        case "split-quote": {
            // `do"cs"/vision.md` — one word, two quoting regimes. Bash concatenates adjacent quoted
            // and unquoted runs into a single word, which is the property being tested.
            const i = 1 + Math.floor(rand() * Math.max(1, word.length - 1));
            return `${word.slice(0, i)}"${word.slice(i)}"`;
        }
        default:
            return word;
    }
}

/**
 * Spellings of `docs/vision.md` that a shell resolves to the same file.
 *
 * Every one of these must reach the constitution's write gate. They are the "two path spellings" the
 * 2026-07-28 amendment names among the eight bypasses #60 shipped with, generalised: `normalisePath`
 * exists for exactly this list and `./fuzz-shell.ground.test.mjs` writes each one to a throwaway file
 * under a temp directory to prove bash agrees.
 */
export function pathSpellings(target) {
    const parts = target.split("/");
    const head = parts.slice(0, -1).join("/");
    const tail = parts[parts.length - 1];
    return [
        target,
        `./${target}`,
        `${head}/./${tail}`,
        `${head}//${tail}`,
        // **A `..` hop names the file only where the directory it hops through EXISTS**, because bash
        // resolves `..` against the real filesystem while `normalisePath` resolves it lexically. That
        // difference is fail-CLOSED and deliberate — the matcher answers `true` for a hop through a
        // directory that is not there, which is a false red on a command bash would refuse anyway —
        // and ./fuzz-shell.ground.test.mjs creates `sibling` before it measures this spelling, so
        // the claim being measured is the one the list actually makes. Found by that measurement:
        // the first spelling here hopped through a directory nothing created and bash refused it.
        `${head}/sibling/../${tail}`,
        `./${head}/./${tail}`,
        // A backslash-newline is a line continuation: both characters vanish and the word continues.
        `${head}/\\\n${tail}`,
    ];
}

/**
 * The writer shapes, split by which of `shellWrites`' TWO recognitions they reach.
 *
 * **The split is structural, not cosmetic, and measurement is what forced it.** That function's own
 * docblock says *"Two recognitions, both by table: a `>`/`>>` redirection into the path, and a
 * file-writing command that names it"* — and the two do not answer alike in every position, because a
 * redirection is read off the whole segment while a named argument needs the segment's HEAD to be a
 * writer. In the `same-line-comment` position they diverge outright: `ls # echo ok > docs/vision.md`
 * is caught, `ls # cp /tmp/x docs/vision.md` is not, because there the head is `ls`. Keyed as one
 * payload the cell would answer two ways and the invariant would have to be weakened to admit it;
 * keyed as two, each cell is exact and the divergence becomes a recorded fact.
 */
export const WRITERS = {
    "write-redirect": [(p) => `echo ok > ${p}`, (p) => `echo ok >> ${p}`, (p) => `cat /tmp/x > ${p}`, (p) => `printf ok 1> ${p}`],
    "write-named": [
        (p) => `cp /tmp/x ${p}`,
        (p) => `mv /tmp/x ${p}`,
        (p) => `tee ${p}`,
        (p) => `dd if=/tmp/x of=${p}`,
        (p) => `sed -i s/a/b/ ${p}`,
        (p) => `install -m 644 /tmp/x ${p}`,
        (p) => `truncate -s 0 ${p}`,
    ],
};

/** One spelling of the write payload: a writer shape, a path spelling, and quoting over both. */
export function writePayload(rand, kind, target = "docs/vision.md") {
    const spelling = pick(rand, pathSpellings(target));
    // A line continuation must not be quoted — inside `"…"` a backslash-newline is still a
    // continuation, but inside `'…'` it is two literal characters and the word stops being the path.
    // Generating that would be the generator lying about its own ground truth.
    const quoted = spelling.includes("\\\n") ? spelling : respell(spelling, rand);
    return pick(rand, WRITERS[kind])(quoted);
}

/**
 * One spelling of the shell payload.
 *
 * **The gated prefix stays literal, and that is a property of the ORACLE rather than a convenience.**
 * `git push --force` is a command *prefix* and both the compiled permission rule and this matcher
 * compare it literally, so `"git" push --force …` is a spelling no layer claims to catch — hole 1's
 * "spellings neither layer sees". Generating it would produce a finding the gate map already answers.
 * Only the arguments after the prefix are respelt.
 */
export function shellPayload(rand, target = "git push --force") {
    const args = pick(rand, [[], ["origin", "main"], ["origin", "HEAD"], ["--repo", "o/r"], ["origin", "main", "--quiet"]]);
    return [target, ...args.map((a) => respell(a, rand))].join(" ");
}

// =============================================================================================
// The position axis — enumerated, recorded, and measured under bash
// =============================================================================================

/**
 * Where the payload sits, and whether bash runs it there.
 *
 * `bashSafe: false` marks a production ./fuzz-shell.ground.test.mjs must not execute even with a
 * neutral payload — `sudo` would prompt for a password on a developer's machine and hang a test
 * suite. Its ground truth is argued in `why` instead of measured, and saying which of the two a
 * production got is the point of the flag.
 */
export const POSITIONS = [
    { id: "bare", ground: "command", build: (p) => p },
    { id: "after-semicolon", ground: "command", build: (p) => `ls; ${p}` },
    { id: "after-andand", ground: "command", build: (p) => `ls && ${p}` },
    { id: "after-oror", ground: "command", build: (p) => `false || ${p}` },
    { id: "after-amp", ground: "command", build: (p) => `ls & ${p}` },
    { id: "after-newline", ground: "command", build: (p) => `ls\n${p}` },
    { id: "before-semicolon", ground: "command", build: (p) => `${p}; ls` },
    { id: "brace-group", ground: "command", build: (p) => `{ ${p}; }` },
    { id: "subshell", ground: "command", build: (p) => `( ${p} )` },
    { id: "then-branch", ground: "command", build: (p) => `if true; then ${p}; fi` },
    { id: "do-branch", ground: "command", build: (p) => `for i in 1; do ${p}; done` },
    { id: "assignment-prefix", ground: "command", build: (p) => `FOO=bar ${p}` },
    { id: "env-prefix", ground: "command", build: (p) => `env ${p}` },
    { id: "nice-prefix", ground: "command", build: (p) => `nice ${p}` },
    {
        id: "sudo-prefix",
        ground: "command",
        bashSafe: false,
        why: "sudo would prompt for a password and hang the suite. Its ground truth is the definition of the command: sudo runs its argument list.",
        build: (p) => `sudo ${p}`,
    },
    { id: "leading-redirection", ground: "command", build: (p) => `2> /dev/null ${p}` },
    // ------------------------------------------------------------------------------------------
    // **The redirection-TARGET family — session-open adjustment 4, and the class #336 met three
    // times.** A shell word may hold spaces when it is quoted or escaped, and `LEADING_REDIRECTION`
    // must consume the whole word or the command behind it escapes ungated. That defect shipped
    // twice on #336 and was fixed twice at the spelling that was quoted, until the suite stopped
    // asserting spellings and asserted the rule against `shellWords`. These productions put the same
    // rule in front of the generator, so a fourth sibling reds here rather than in a review.
    //
    // Every one is a COMMAND position: bash redirects stderr to a file and then runs the payload.
    { id: "leading-redirection-quoted-target", ground: "command", build: (p) => `2> "log file.txt" ${p}` },
    { id: "leading-redirection-single-quoted-target", ground: "command", build: (p) => `2> 'log file.txt' ${p}` },
    { id: "leading-redirection-escaped-space-target", ground: "command", build: (p) => `2> log\\ file.txt ${p}` },
    { id: "leading-redirection-escaped-quote-target", ground: "command", build: (p) => `2> "log \\"q\\" file.txt" ${p}` },
    // ------------------------------------------------------------------------------------------
    // **A CRLF continuation, which is NOT a continuation.** `shellWords` consumes `\r\n` after a
    // backslash as a pair and joins the word; **five shells do not, and split the command instead** —
    // `bash 3.2.57(1)` (arm64-apple-darwin25), `bash 5.2.15(1)` (aarch64-unknown-linux-gnu) and
    // `bash 5.2.37(1)` (x86_64-pc-linux-gnu), plus `zsh 5.9` and `/bin/sh`. The three bash builds are
    // named in full rather than as "bash 5", which would be a claim about a series from two 5.2
    // patchlevels; no bash 4.x was measured, and neither was any Windows-side bash — git-bash, MSYS2,
    // Cygwin or WSL — which is the platform the retired reachability claim named. Widened 2026-08-25
    // from "three shells on this machine", which was the true width until two containers were run.
    //
    // **What follows from that is NOT one answer, and an earlier draft of this very comment said it
    // was.** It read "the matcher answers `true` anyway: a FALSE RED", which is right for one payload
    // and wrong for another:
    //
    //   - `shell` — nothing gated runs. The matcher answers `false`. Correct.
    //   - `write-named` — `cp` never runs and the target is untouched. The matcher answers `true`.
    //     A false red, fail-closed, and the only one of the three.
    //   - `write-redirect` — a shell applies a redirection BEFORE it looks the command up, so the
    //     clobbering redirection on the surviving fragment still fires and TRUNCATES the target to
    //     zero bytes. The matcher answering `true` is a **true positive**. Measured.
    //
    // So the ground truth here is a property of the payload rather than of the position, which is why
    // `groundByKind` exists and why this is the only production that uses it. `exitsNonZero` is
    // declared because the fragment left over by the split is run as a command and is not found.
    //
    // _The stale sentence survived the correction of the three cells below it — one carrier fixed and
    // its sibling left, in the block whose subject is that class. Reported by Copilot, round 2 on #341._
    {
        id: "crlf-continuation-in-the-payload",
        ground: "data",
        // **The one production whose ground truth is not a property of the position.** bash splits at
        // the CRLF, so a writer command never runs and a gated command never runs — data. But a
        // CLOBBERING redirection is applied before the command is looked up, so it fires anyway and
        // truncates its target to zero bytes. That is the gated effect occurring, and calling it data
        // would record a destroyed file as an untouched one — which an earlier draft of this entry did,
        // in all three of its carriers, until the pre-commit checkpoint measured it.
        groundByKind: { "write-redirect": "command" },
        // `>>` appends and therefore does NOT truncate, so it is the one redirect shape whose ground
        // truth differs from its siblings'. Refused rather than folded in: a cell whose ground truth
        // varies with the spelling is a cell whose invariant cannot hold. Measured — `echo \<CRLF>ok >> t`
        // leaves `t` byte-for-byte unchanged while `> t` and `1> t` leave it empty. Re-measured
        // 2026-08-25 on bash 5.2.15 and 5.2.37 as well as 3.2.57: identical on all three, so the
        // refusal is right on **both bash 5.2 builds measured** and not only on the shell it was
        // written against. Named as builds rather than as "bash 5", which would be the series
        // inference this production's own comment refuses eight lines up.
        carries: (p, kind) => kind !== "write-redirect" || !p.includes(">>"),
        exitsNonZero: true,
        why: "bash splits at the CRLF, so the fragment after it is run as a command and is not found — a non-zero exit is the measurement rather than a failure of it. A clobbering redirection on that fragment still fires, which is why `write-redirect` overrides the ground.",
        build: (p) => p.replace(" ", " \\\r\n"),
    },
    { id: "after-heredoc", ground: "command", build: (p) => `cat <<'EOF'\nbody\nEOF\n${p}` },
    { id: "after-comment-line", ground: "command", build: (p) => `# a note\n${p}` },
    { id: "command-substitution", ground: "command", build: (p) => `echo $(${p})` },
    { id: "quoted-command-substitution", ground: "command", build: (p) => `echo "$(${p})"` },
    { id: "wrapper", ground: "command", build: (p) => `bash -c "${p}"` },
    {
        id: "wrapper-single-quoted",
        ground: "command",
        // **A single-quoted wrapper cannot carry a payload holding a `'`**, and this predicate is
        // here because bash said so. POSIX gives `'…'` no escapes, so `sh -c 'cp /tmp/x $'docs/vision.md''`
        // closes the wrapper at the payload's own quote and the inner shell then reads
        // `cp /tmp/x $docs/vision.md` — which writes `/vision.md`, NOT the constitution. The cell
        // records `true` and bash would not have touched the file: a generator composing a command it
        // no longer has ground truth for, which is the one failure this whole design is arranged
        // against. Measured by ./fuzz-shell.ground.test.mjs's wrapper-respelling case, added at the
        // pre-commit checkpoint after it named this composition as argued-but-unmeasured.
        carries: (p) => !p.includes("'"),
        build: (p) => `sh -c '${p}'`,
    },
    { id: "wrapper-after-separator", ground: "command", build: (p) => `ls && bash -c "${p}"` },
    { id: "wrapper-holding-separator", ground: "command", build: (p) => `bash -c "ls; ${p}"` },
    { id: "wrapper-holding-separator-after-separator", ground: "command", build: (p) => `ls && bash -c "x; ${p}"` },
    {
        id: "nested-wrapper",
        ground: "command",
        // The same limit, for the same reason: the inner wrapper here is single-quoted too.
        carries: (p) => !p.includes("'"),
        build: (p) => `bash -c "sh -c '${p}'"`,
    },
    { id: "single-quoted-echo", ground: "data", build: (p) => `echo '${p}'` },
    { id: "double-quoted-echo", ground: "data", build: (p) => `echo "${p}"` },
    { id: "heredoc-body", ground: "data", build: (p) => `cat <<'EOF'\n${p}\nEOF` },
    { id: "same-line-comment", ground: "data", build: (p) => `ls # ${p}` },
    { id: "comment-then-separator", ground: "data", build: (p) => `echo ok #; ${p}` },
    // Added at the pre-commit checkpoint. Its differential of the staged matcher against HEAD's found
    // that the 2026-08-25 widening inherits the `#` decision one level INTO a wrapper — a new false
    // red, and the only new false-red class the repair produced. `comment-then-separator` pins the
    // top-level spelling and could not see the composed one, which is the "two claims that each held
    // and did not compose" shape this whole session is about, met once more in the fix for it.
    { id: "wrapper-holding-comment", ground: "data", build: (p) => `bash -c "echo ok #; ${p}"` },
];

/**
 * What the matcher answers for each cell, and the record that licenses a disagreement with ground
 * truth.
 *
 * **Every entry here was MEASURED against the shipped matcher before it was written, and one round of
 * writing it from the armchair was thrown away first.** Milestone 8 session 0's founding result is
 * ten hand-written expectations refuted on the corpus's first run; an expectation table is a claim
 * like any other and this one is not exempt.
 *
 * `answer` is what `matchesRule` returns. `record` is required whenever `answer` disagrees with what
 * the production's `ground` demands, and it may cite either the gate map's honest-holes list or a
 * decision recorded in `./compile.mjs` — the false red on `#` is the second kind, argued at
 * `commandSegments` and declined on a Copilot review of #60, and it appears in no hole list because
 * it is a choice rather than a gap.
 */
export const EXPECT = {
    "leading-redirection-quoted-target|shell": { answer: true },
    "leading-redirection-quoted-target|write-redirect": { answer: true },
    "leading-redirection-quoted-target|write-named": { answer: true },
    "leading-redirection-single-quoted-target|shell": { answer: true },
    "leading-redirection-single-quoted-target|write-redirect": { answer: true },
    "leading-redirection-single-quoted-target|write-named": { answer: true },
    "leading-redirection-escaped-space-target|shell": { answer: true },
    "leading-redirection-escaped-space-target|write-redirect": { answer: true },
    "leading-redirection-escaped-space-target|write-named": { answer: true },
    "leading-redirection-escaped-quote-target|shell": { answer: true },
    "leading-redirection-escaped-quote-target|write-redirect": { answer: true },
    "leading-redirection-escaped-quote-target|write-named": { answer: true },
    "crlf-continuation-in-the-payload|shell": {
        answer: false,
        why: "Correct, and NOT by the mechanism an earlier draft of this entry claimed. That draft said `commandSegments` \"splits at the newline, which is what bash does too\" — measured false: `commandSegments` consumes the pair exactly as `shellWords` does (compile.mjs, `The same CRLF pair, in the other reader`) and does not split. What actually happens is that the segment keeps its RAW source text, so the literal prefix compare meets `git \\\\<CRLF>push --force …` and fails. Right answer, wrong reason, which `a-stated-enforcer-must-be-the-real-one` counts as the same defect one size down. Found by the pre-commit checkpoint.",
    },
    "crlf-continuation-in-the-payload|write-redirect": {
        answer: true,
        why: "A TRUE POSITIVE, and an earlier draft of this entry recorded it as a false red in all three of its carriers. A shell applies a redirection BEFORE it looks the command up, so although bash splits at the CRLF and the command never runs, the clobbering redirection on the surviving fragment still fires and truncates the target to ZERO BYTES. First measured on bash 3.2.57 and **re-measured 2026-08-25 on bash 5.2.15 and 5.2.37 as well**: a file holding 6 bytes before is 0 bytes after, on all three, for `echo \\<CRLF>ok > t`, `printf \\<CRLF>ok 1> t` and `cat \\<CRLF>src > t` alike. Widened here in the same pass as its `write-named` sibling, because one cell widened beside a narrow sibling is the class this production's own comment records. So the gated effect occurs, the matcher denying it is right, and `groundByKind` says so. The append shape is refused by `carries`, since `>>` does not truncate. Unlike its sibling this cell is NOT affected by `0031`: removing the pair branch leaves this answer `true`, because the redirection is read off the raw segment text rather than off a joined word — measured as a differential against a copy with the branch deleted.",
    },
    "crlf-continuation-in-the-payload|write-named": {
        answer: true,
        record: "cli/compile.mjs, `shellWords` — a `\\r\\n` after a backslash is consumed as a PAIR, a decision taken 2026-07-28",
        why: "A FALSE RED, and the only one of the three. `shellWrites` reaches `shellSegments`, which reaches `shellWords`, which joins the pair — so the matcher sees a clean `cp /tmp/x docs/vision.md` and denies. bash splits, `cp` never runs, and the target is left byte-for-byte unchanged. Fail-closed and worth one prompt. **The reachability `compile.mjs`'s comment used to claim for this spelling — the constitution 'reachable by editing the file on Windows' — is RETIRED**, and that comment now carries the measurement instead. Re-measured 2026-08-25 on bash 3.2.57, 5.2.15 and 5.2.37, plus zsh 5.9 and sh, with a neutral target: none joins the pair, and the `cp` shape leaves its target byte-for-byte unchanged on all five. Two things bound that: no Windows-side bash was measured — git-bash, MSYS2, Cygwin, WSL — and no bash 4.x. **Still not repaired here, and for a narrower reason than the earlier draft gave.** That draft said only bash 3.2.57 was available, which stopped being true; what stands is that the repair direction is fail-OPEN on a gate matcher, so it is asked at `../.portulan/proposals/0031-a-continuation-no-shell-joins.md` and not taken.",
    },
    // ============================== shell
    "bare|shell": { answer: true },
    "after-semicolon|shell": { answer: true },
    "after-andand|shell": { answer: true },
    "after-oror|shell": { answer: true },
    "after-amp|shell": { answer: true },
    "after-newline|shell": { answer: true },
    "before-semicolon|shell": { answer: true },
    "brace-group|shell": {
        answer: false,
        record: ".portulan/gate-map.md honest holes, entry 2 — leaders",
        why: "A brace group. `commandSegments` reads a list of separators, not a grammar, so `{` occupies the head position. Caught on both write payloads, which reach `shellSegments` and its SEGMENT_LEADERS table — the two-segmenter asymmetry the gate corpus already records.",
    },
    "subshell|shell": { answer: true },
    "then-branch|shell": {
        answer: false,
        record: ".portulan/gate-map.md honest holes, entry 2 — leaders",
        why: "The `then` leader, on the segmenter with no leader table.",
    },
    "do-branch|shell": {
        answer: false,
        record: ".portulan/gate-map.md honest holes, entry 2 — leaders",
        why: "The `do` leader, same half of the same hole.",
    },
    "assignment-prefix|shell": {
        answer: false,
        record: ".portulan/gate-map.md honest holes, entry 2 — leaders",
        why: "An assignment occupies the head position. `commandSegments` does not read ASSIGNMENT; `shellSegments` does.",
    },
    "env-prefix|shell": {
        answer: false,
        record: ".portulan/gate-map.md honest holes, entry 2 — leaders",
        why: "A command prefix, open BY DECISION on the shell matcher: a named table of prefixes has no natural edge — `nice`, `time`, `nohup`, `timeout`, `command`, `stdbuf`, `doas` — and one omission buys the false confidence a hole list exists to deny.",
    },
    "nice-prefix|shell": {
        answer: false,
        record: ".portulan/gate-map.md honest holes, entry 2 — leaders",
        why: "The same decision at a second prefix, so the record is not read as being about `env` alone.",
    },
    "sudo-prefix|shell": {
        answer: false,
        record: ".portulan/gate-map.md honest holes, entry 2 — leaders",
        why: "The same decision at the prefix a reader is likeliest to reach for.",
    },
    "leading-redirection|shell": { answer: true },
    "after-heredoc|shell": { answer: true },
    "after-comment-line|shell": { answer: true },
    "command-substitution|shell": { answer: true },
    "quoted-command-substitution|shell": {
        answer: false,
        record: ".portulan/gate-map.md honest holes, entry 1 — spellings neither layer sees",
        why: "`\"$(…)\"` is a command bash runs, and `commandSegments` steps over the parentheses inside a quoted run so nothing splits. The BARE `$(…)` form is CAUGHT, because `(` and `)` are in OPERATOR — one concept, two spellings, opposite answers, which is why this table is keyed on the spelling and never on the idea.",
    },
    "wrapper|shell": { answer: true },
    "wrapper-single-quoted|shell": { answer: true },
    "wrapper-after-separator|shell": { answer: true },
    "wrapper-holding-separator|shell": { answer: true },
    "wrapper-holding-separator-after-separator|shell": { answer: true },
    "nested-wrapper|shell": {
        answer: false,
        record: ".portulan/gate-map.md honest holes, entry 1 — the hook peels ONE wrapper",
        why: "Two wrappers. The documented and asserted limit of the unwrap budget, held deliberately: an earlier draft of the segment composition peeled twice and the suite caught it.",
    },
    "single-quoted-echo|shell": { answer: false },
    "double-quoted-echo|shell": { answer: false },
    "heredoc-body|shell": { answer: false },
    "wrapper-holding-comment|shell": {
        answer: true,
        record: "cli/compile.mjs, `commandSegments` — `#` does not start a comment, a decision declined on Copilot review of #60",
        why: "A FALSE RED on data, and one the 2026-08-25 segment repair INHERITED rather than introduced: reading a spelling's segments carries the declined `#` decision one level into a wrapper. The pre-commit checkpoint's differential of the staged matcher against HEAD's measured this as the only new false-red class the repair produced, and `comment-then-separator` could not see it — that entry pins the top-level spelling alone.",
    },
    "same-line-comment|shell": { answer: false },
    "comment-then-separator|shell": {
        answer: true,
        record: "cli/compile.mjs, `commandSegments` — `#` does not start a comment, a decision declined on Copilot review of #60",
        why: "A FALSE RED on data. `#` is not read as a comment, so the `;` behind it splits and the segment after it is a gated command. Taken deliberately: deciding where a comment BEGINS is the part that goes wrong, and getting it wrong turns `echo \"a#b\"; git push --force …` — a real gated command — into a false GREEN.",
    },
    // ============================== write-redirect
    "bare|write-redirect": { answer: true },
    "after-semicolon|write-redirect": { answer: true },
    "after-andand|write-redirect": { answer: true },
    "after-oror|write-redirect": { answer: true },
    "after-amp|write-redirect": { answer: true },
    "after-newline|write-redirect": { answer: true },
    "before-semicolon|write-redirect": { answer: true },
    "brace-group|write-redirect": { answer: true },
    "subshell|write-redirect": { answer: true },
    "then-branch|write-redirect": { answer: true },
    "do-branch|write-redirect": { answer: true },
    "assignment-prefix|write-redirect": { answer: true },
    "env-prefix|write-redirect": { answer: true },
    "nice-prefix|write-redirect": { answer: true },
    "sudo-prefix|write-redirect": { answer: true },
    "leading-redirection|write-redirect": { answer: true },
    "after-heredoc|write-redirect": { answer: true },
    "after-comment-line|write-redirect": { answer: true },
    "command-substitution|write-redirect": { answer: true },
    "quoted-command-substitution|write-redirect": {
        answer: false,
        record: ".portulan/gate-map.md honest holes, entry 1 — spellings neither layer sees",
        why: "The same quote-loop step-over, reached through the write branch.",
    },
    "wrapper|write-redirect": { answer: true },
    "wrapper-single-quoted|write-redirect": { answer: true },
    "wrapper-after-separator|write-redirect": { answer: true },
    "wrapper-holding-separator|write-redirect": { answer: true },
    "wrapper-holding-separator-after-separator|write-redirect": { answer: true },
    "nested-wrapper|write-redirect": {
        answer: false,
        record: ".portulan/gate-map.md honest holes, entry 1 — the hook peels ONE wrapper",
        why: "The same limit, reached through the write branch.",
    },
    "single-quoted-echo|write-redirect": { answer: false },
    "double-quoted-echo|write-redirect": { answer: false },
    "heredoc-body|write-redirect": { answer: false },
    "wrapper-holding-comment|write-redirect": {
        answer: true,
        record: "cli/compile.mjs, `commandSegments` — `#` does not start a comment, a decision declined on Copilot review of #60",
        why: "The same inherited false red, reached through the redirection recognition.",
    },
    "same-line-comment|write-redirect": {
        answer: true,
        record: "cli/compile.mjs, `commandSegments` — `#` does not start a comment, a decision declined on Copilot review of #60",
        why: "A FALSE RED on data, and only on this payload: a redirection is read off the whole segment, so `ls # echo ok > docs/vision.md` is caught while `ls # cp /tmp/x docs/vision.md` is not — there the head is `ls`, which writes nothing. The divergence between the write matchers two recognitions, measured rather than reasoned.",
    },
    "comment-then-separator|write-redirect": {
        answer: true,
        record: "cli/compile.mjs, `commandSegments` — `#` does not start a comment, a decision declined on Copilot review of #60",
        why: "The same declined decision, reached through the redirection recognition.",
    },
    // ============================== write-named
    "bare|write-named": { answer: true },
    "after-semicolon|write-named": { answer: true },
    "after-andand|write-named": { answer: true },
    "after-oror|write-named": { answer: true },
    "after-amp|write-named": { answer: true },
    "after-newline|write-named": { answer: true },
    "before-semicolon|write-named": { answer: true },
    "brace-group|write-named": { answer: true },
    "subshell|write-named": { answer: true },
    "then-branch|write-named": { answer: true },
    "do-branch|write-named": { answer: true },
    "assignment-prefix|write-named": { answer: true },
    "env-prefix|write-named": { answer: true },
    "nice-prefix|write-named": { answer: true },
    "sudo-prefix|write-named": { answer: true },
    "leading-redirection|write-named": { answer: true },
    "after-heredoc|write-named": { answer: true },
    "after-comment-line|write-named": { answer: true },
    "command-substitution|write-named": { answer: true },
    "quoted-command-substitution|write-named": {
        answer: false,
        record: ".portulan/gate-map.md honest holes, entry 1 — spellings neither layer sees",
        why: "The same step-over, at the other write recognition.",
    },
    "wrapper|write-named": { answer: true },
    "wrapper-single-quoted|write-named": { answer: true },
    "wrapper-after-separator|write-named": { answer: true },
    "wrapper-holding-separator|write-named": { answer: true },
    "wrapper-holding-separator-after-separator|write-named": { answer: true },
    "nested-wrapper|write-named": {
        answer: false,
        record: ".portulan/gate-map.md honest holes, entry 1 — the hook peels ONE wrapper",
        why: "The same limit, at the other write recognition.",
    },
    "single-quoted-echo|write-named": { answer: false },
    "double-quoted-echo|write-named": { answer: false },
    "heredoc-body|write-named": { answer: false },
    "wrapper-holding-comment|write-named": {
        answer: true,
        record: "cli/compile.mjs, `commandSegments` — `#` does not start a comment, a decision declined on Copilot review of #60",
        why: "The same inherited false red, reached through the named-argument recognition. Caught here where the uncomposed `same-line-comment` case is NOT, because inside the wrapper the payload leads its own segment and its head is the writer rather than `ls`.",
    },
    "same-line-comment|write-named": { answer: false },
    "comment-then-separator|write-named": {
        answer: true,
        record: "cli/compile.mjs, `commandSegments` — `#` does not start a comment, a decision declined on Copilot review of #60",
        why: "The same declined decision, reached through the named-argument recognition.",
    },
};

/** The answer ground truth demands, before any record is consulted. */
export const correctFor = (ground) => ground === "command";

/**
 * What "the payload took effect" MEANS, per payload kind.
 *
 * **A redirection is not a command, and conflating the two hid a true positive as a false red.** A
 * shell applies a redirection BEFORE it looks the command up, so a `>` whose command never runs still
 * truncates its target to zero bytes. For a `write-redirect` payload the gated effect is therefore
 * *the target was written*, not *the command ran* — and measuring it as the latter reports a
 * destroyed file as an untouched one. Measured on bash 3.2.57: a split `printf … 1> target` leaves
 * the target at **0 bytes** where it held content before.
 */
export const EFFECT = { shell: "ran", "write-redirect": "touched", "write-named": "ran" };

/**
 * The ground truth for one cell, which is not always a property of the position alone.
 *
 * Most productions put the payload somewhere bash either runs or does not, whatever the payload is.
 * One does not: a CRLF splits the command, and what survives depends on the payload's SHAPE — a
 * clobbering redirection still fires and destroys the target, while a writer command simply never
 * runs. A single `ground` field cannot say that, so a production may override it per kind. The
 * override is rare by design and every use of it is argued in the production's own `why`.
 */
export const groundFor = (position, kind) => position.groundByKind?.[kind] ?? position.ground;

/**
 * The ACTION kind a payload kind reaches.
 *
 * Three payload kinds, two action kinds: the write matcher's two recognitions are separate payloads
 * here (see `WRITERS`) and one rule kind there. Anything that hands a payload kind to a consumer
 * expecting an action kind is a bug, and one shipped — see `asCase`.
 */
export const ruleKind = (kind) => (kind === "shell" ? "shell" : "write");

/**
 * Generate one case: a spelling of one payload in one position.
 *
 * **A position may REFUSE a payload it cannot carry, and the refusal is a redraw rather than a
 * skip.** A single-quoted wrapper holding a `'`-quoted word is not the command it looks like, so
 * emitting one would give the fuzzer an exact answer about a string whose ground truth it no longer
 * knows. Bounded, and a budget that runs out throws rather than returning something unchecked: a
 * generator that quietly gave up would thin the spelling space in exactly the cell whose quoting is
 * hardest, which is the cell that most needs the coverage.
 */
export function generate(position, kind, rand) {
    const carries = position.carries ?? (() => true);
    for (let attempt = 0; attempt < 64; attempt += 1) {
        const payload = kind === "shell" ? shellPayload(rand) : writePayload(rand, kind);
        if (carries(payload, kind)) return { command: position.build(payload), payload };
    }
    throw new CouldNotRun(
        `position \`${position.id}\` refused 64 consecutive ${kind} payloads. Its \`carries\` predicate and the ` +
            `spelling generator disagree about what it can hold — one of the two is wrong, and a thinned cell is ` +
            `not an answer`,
    );
}

/**
 * A finding, rendered as a corpus case ready to paste into evals/goldens/gates/<rule-id>.json.
 *
 * `../evals/README.md` records that clause (a)'s fixture format is clause (b)'s output shape, so a
 * bypass found here becomes a permanent regression pin by paste rather than by retyping. The `expect`
 * written is what the MATCHER ACTUALLY DID — a fixture records behaviour, and the repair belongs in
 * the matcher or in the record, never in a fixture that asserts what somebody wished had happened.
 */
export function asCase(position, kind, ruleId, command, actual, index) {
    return {
        id: `fuzz-${position.id}-${kind}-${index}`,
        class: correctFor(groundFor(position, kind)) === actual ? "holds" : "documented-hole",
        tool: PAYLOADS[kind].tool,
        // **The RULE kind, not the payload kind.** `matcherPath` reads an action kind — `shell` /
        // `write` / `read` — and this passed it `write-redirect` and `write-named`, which it knows
        // nothing about, so it fell through to `no-branch` and two of the three payloads emitted a
        // case `goldens` would refuse as a mislabel. The paste-ready promise this module and
        // `../evals/README.md` both make was therefore FALSE for the write matcher, which is
        // `../.portulan/dod.md` condition 4 rather than a preference. Reported by Copilot on #338;
        // it survived a drill that printed a finding, because the drill exercised the shell payload —
        // a check written alongside a change inheriting the change's blind spot, for the fifth time
        // in two sessions.
        path: matcherPath(ruleKind(kind), PAYLOADS[kind].tool),
        expect: actual,
        why: `Generated by cli/fuzz-shell.mjs: ${PAYLOADS[kind].what} in the \`${position.id}\` position, which is a ${groundFor(position, kind)} position for this payload. REVIEW THIS BEFORE COMMITTING IT — a generated case records what the matcher did, not what it should do.`,
        ...(correctFor(groundFor(position, kind)) === actual ? {} : { hole: "UNRECORDED — name the record this belongs to, or repair the matcher" }),
        input: { command },
        _rule: ruleId,
    };
}

function usage() {
    return [
        "usage: node cli/fuzz-shell.mjs [--check] [--workspace <dir>] [--pack-root <dir>] [--seed <n>] [--cases <n>]",
        "",
        "  Generates spellings of one gated command and one constitution write in every position the",
        "  grammar knows, and holds both segmenters to the answer recorded for that position.",
        "",
        `  --seed defaults to ${DEFAULT_SEED} and --cases to ${DEFAULT_CASES} spellings per cell.`,
        "  Both are printed on every run, green included, so a green is as reproducible as a red.",
        "",
        "  Exit 0 green · 1 red · 2 could not run.",
    ].join("\n");
}

export function run(argv = [], { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
    const say = (line = "") => stdout.write(`${line}\n`);
    if (argv.includes("--help") || argv.includes("-h")) {
        say(usage());
        return 0;
    }
    let named = cwd;
    let packRoots = null;
    let seed = DEFAULT_SEED;
    let cases = DEFAULT_CASES;
    try {
        for (let i = 0; i < argv.length; i += 1) {
            if (argv[i] === "--check") continue;
            if (argv[i] === "--workspace") {
                named = argv[i + 1];
                i += 1;
                if (named === undefined) throw new CouldNotRun("--workspace needs a directory");
            } else if (argv[i] === "--seed" || argv[i] === "--cases") {
                const flag = argv[i];
                const raw = argv[i + 1];
                i += 1;
                // Refused rather than coerced. `Number("12abc")` is NaN and `Number("")` is 0, and a
                // fuzzer silently running zero cases is the false green this whole file is against.
                if (raw === undefined || !/^[0-9]+$/.test(raw)) throw new CouldNotRun(`${flag} needs a non-negative integer, not ${JSON.stringify(raw)}`);
                const value = Number(raw);
                if (flag === "--cases" && value === 0) throw new CouldNotRun("--cases 0 would generate nothing and report green having tested nothing");
                if (flag === "--seed") seed = value;
                else cases = value;
            } else if (argv[i] === "--pack-root") {
                const root = argv[i + 1];
                i += 1;
                if (root === undefined || root.startsWith("-")) throw new CouldNotRun("--pack-root needs a directory");
                let stat = null;
                try {
                    stat = fs.statSync(root);
                } catch (cause) {
                    throw new CouldNotRun(`--pack-root ${root} cannot be read — ${cause.code ?? cause.message}`);
                }
                if (!stat.isDirectory()) throw new CouldNotRun(`--pack-root ${root} is not a directory`);
                (packRoots ??= []).push(path.resolve(root));
            } else throw new CouldNotRun(`unknown argument ${JSON.stringify(argv[i])}`);
        }

        const { rules, unresolved } = yieldedRules(named, { packRoots });
        for (const u of unresolved) say(`pack    ${u.name} UNRESOLVED — ${u.why}; its gate fragments are not in this run`);
        const byId = new Map(rules.map((r) => [r.id, r]));

        // **A payload whose rule is absent is could-not-run, never a skip.** A fuzzer that quietly
        // ran one of its two matchers would print a green about half the subject the clause names —
        // ../.portulan/memory/a-checker-must-refuse-what-it-cannot-check.md.
        for (const [kind, p] of Object.entries(PAYLOADS)) {
            if (!byId.has(p.rule)) {
                throw new CouldNotRun(
                    `the ${kind} payload targets \`${p.rule}\`, which the yielded policy does not declare. ` +
                        `Either the rule was renamed and this file was not, or half this fuzzer has nothing to attack`,
                );
            }
        }
        // The table must be total over the grammar, in both directions, and this is checked before a
        // case is generated: a position with no recorded answer would otherwise be silently skipped,
        // and a recorded answer for a position nobody generates is a claim about nothing.
        const keys = new Set(Object.keys(EXPECT));
        const missing = [];
        for (const position of POSITIONS) {
            for (const kind of Object.keys(PAYLOADS)) {
                const key = `${position.id}|${kind}`;
                if (!keys.has(key)) missing.push(key);
                keys.delete(key);
            }
        }
        if (missing.length) throw new CouldNotRun(`EXPECT records no answer for ${missing.join(", ")} — every position × payload cell must be recorded`);
        if (keys.size) throw new CouldNotRun(`EXPECT records ${[...keys].join(", ")}, which POSITIONS does not generate — a recorded answer for a cell nobody produces is a claim about nothing`);
        for (const [key, e] of Object.entries(EXPECT)) {
            const position = POSITIONS.find((p) => p.id === key.split("|")[0]);
            const kind = key.split("|")[1];
            const ground = groundFor(position, kind);
            if (e.answer !== correctFor(ground) && (typeof e.record !== "string" || e.record.trim() === "")) {
                throw new CouldNotRun(
                    `EXPECT[${key}] records ${e.answer} where a ${ground} position demands ${correctFor(ground)} for this payload, ` +
                        `and names no \`record\`. A divergence nobody documented is a hole nobody knows about`,
                );
            }
        }

        say(`fuzz-shell: seed ${seed} · ${cases} spelling(s) per cell · ${POSITIONS.length} position(s) × ${Object.keys(PAYLOADS).length} payload(s)`);

        const findings = [];
        let generated = 0;
        const drift = new Map();
        for (const position of POSITIONS) {
            for (const [kind, p] of Object.entries(PAYLOADS)) {
                const expected = EXPECT[`${position.id}|${kind}`];
                const rule = byId.get(p.rule);
                // Per cell, and derived from the cell's FULL identity. Two properties, both wanted:
                // one cell's budget cannot shift another cell's stream — a case-count change would
                // otherwise re-roll every later cell and turn one edit into a new corpus — and no two
                // cells share a stream, so the spelling space is explored once per cell rather than
                // once per id length. See `hash` for what the first cut got wrong.
                const rand = prng(seed ^ hash(`${position.id}|${kind}`));
                for (let i = 0; i < cases; i += 1) {
                    const { command } = generate(position, kind, rand);
                    generated += 1;
                    const actual = matchesRule(rule, p.tool, { command });
                    if (actual === expected.answer) continue;
                    const key = `${position.id}|${kind}`;
                    if (drift.has(key)) continue; // one finding per cell; the rest are the same defect
                    drift.set(key, true);
                    findings.push({ position, kind, rule: p.rule, command, actual, expected: expected.answer, index: i });
                }
            }
        }

        say(`fuzz-shell: ${generated} generated command(s) over ${Object.keys(EXPECT).length} recorded cell(s)`);

        if (findings.length) {
            for (const f of findings) {
                const groundWanted = correctFor(groundFor(f.position, f.kind));
                const headline =
                    f.actual === groundWanted
                        ? `the recorded divergence at \`${f.position.id}\` (${f.kind}) has CLOSED — the matcher now answers ${f.actual}, which is what a ${groundFor(f.position, f.kind)} position demands for this payload. That is good news and the record must absorb it: update EXPECT, and update the record it cites`
                        : f.actual
                          ? `FALSE RED: a spelling in the \`${f.position.id}\` (${f.kind}) cell answers true where the cell records ${f.expected}. Bash does not run the payload here`
                          : `GATE BYPASS: a spelling in the \`${f.position.id}\` (${f.kind}) cell answers false where the cell records ${f.expected}. Bash DOES run the payload here`;
                stderr.write(`fuzz-shell: ${headline}\n`);
                stderr.write(`           seed ${seed}, case ${f.index}\n`);
                stderr.write(`           as a corpus case for evals/goldens/gates/${f.rule}.json:\n`);
                const { _rule, ...body } = asCase(f.position, f.kind, f.rule, f.command, f.actual, f.index);
                for (const line of JSON.stringify(body, null, 2).split("\n")) stderr.write(`             ${line}\n`);
            }
            stderr.write(`RED — ${findings.length} cell(s) disagree with the recorded grammar\n`);
            return 1;
        }
        say("GREEN — every generated spelling answered as its position records, on both matchers");
        say("fuzz-shell: this holds the SEGMENTERS to a grammar; what a gate should cover is a policy question, not this rail's");
        return 0;
    } catch (error) {
        if (error instanceof CouldNotRun || error instanceof CompileError) {
            stderr.write(`fuzz-shell: ${error.message}\n`);
            return 2;
        }
        stderr.write(`fuzz-shell: could not finish fuzzing — ${error?.stack ?? error}\n`);
        return 2;
    }
}

// The entry guard, in the ONE form `./rule-carriers.mjs` designates — see ./goldens.mjs for why it is
// copied rather than re-derived.
function isMain() {
    const invoked = process.argv[1];
    if (!invoked) return false;
    if (import.meta.url === pathToFileURL(invoked).href) return true;
    try {
        return import.meta.url === pathToFileURL(fs.realpathSync(invoked)).href;
    } catch {
        return false;
    }
}

if (isMain()) process.exitCode = run(process.argv.slice(2));
