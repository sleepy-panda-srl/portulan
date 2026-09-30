#!/usr/bin/env node
// Grammar-aware fuzzing over this repository's two shell segmenters.
//
// Exit 0 green · 1 red · 2 could not run.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CompileError, matchesRule } from "./compile.mjs";
import { CouldNotRun, matcherPath, yieldedRules } from "./goldens.mjs";

/** Spellings generated per (position × payload) cell. */
export const DEFAULT_CASES = 48;

export const DEFAULT_SEED = 20260825;

/** A payload per recognition: a redirected write and a named one can answer differently in one position. */
export const PAYLOADS = {
    shell: { rule: "force-push-without-a-lease", tool: "Bash", what: "a gated force-push" },
    "write-redirect": { rule: "change-the-constitution", tool: "Bash", what: "a redirection into the constitution" },
    "write-named": { rule: "change-the-constitution", tool: "Bash", what: "a writer NAMING the constitution" },
};

/** mulberry32, a seeded 32-bit PRNG. */
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

/** 32-bit FNV-1a. */
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

/** No escapes inside `$'…'`: the matcher reads it as plain `'…'`, where bash would decode them. */
export function respell(word, rand) {
    switch (pick(rand, ["bare", "double", "single", "ansi-c", "escape-one", "split-quote"])) {
        case "double":
            return `"${word}"`;
        case "single":
            return `'${word}'`;
        case "ansi-c":
            return `$'${word}'`;
        case "escape-one": {
            const i = Math.floor(rand() * word.length);
            return `${word.slice(0, i)}\\${word.slice(i)}`;
        }
        case "split-quote": {
            const i = 1 + Math.floor(rand() * Math.max(1, word.length - 1));
            return `${word.slice(0, i)}"${word.slice(i)}"`;
        }
        default:
            return word;
    }
}

/** Spellings of `target` that a shell resolves to the same file. */
export function pathSpellings(target) {
    const parts = target.split("/");
    const head = parts.slice(0, -1).join("/");
    const tail = parts[parts.length - 1];
    return [
        target,
        `./${target}`,
        `${head}/./${tail}`,
        `${head}//${tail}`,
        // bash resolves `..` against the filesystem, so the ground test creates `sibling` first.
        `${head}/sibling/../${tail}`,
        `./${head}/./${tail}`,
        // A backslash-newline is a line continuation: both characters vanish and the word continues.
        `${head}/\\\n${tail}`,
    ];
}

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

export function writePayload(rand, kind, target = "docs/vision.md") {
    const spelling = pick(rand, pathSpellings(target));
    // Never requote a continuation: inside `'…'` a backslash-newline is two literal characters.
    const quoted = spelling.includes("\\\n") ? spelling : respell(spelling, rand);
    return pick(rand, WRITERS[kind])(quoted);
}

/** Only the arguments are respelt: the prefix is matched literally, and the gate map records that hole. */
export function shellPayload(rand, target = "git push --force") {
    const args = pick(rand, [[], ["origin", "main"], ["origin", "HEAD"], ["--repo", "o/r"], ["origin", "main", "--quiet"]]);
    return [target, ...args.map((a) => respell(a, rand))].join(" ");
}

// =============================================================================================
// The position axis — enumerated, recorded, and measured under bash
// =============================================================================================

/** Where the payload sits: bash executes it in a `command` ground and never in a `data` one. */
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
    { id: "leading-redirection-quoted-target", ground: "command", build: (p) => `2> "log file.txt" ${p}` },
    { id: "leading-redirection-single-quoted-target", ground: "command", build: (p) => `2> 'log file.txt' ${p}` },
    { id: "leading-redirection-escaped-space-target", ground: "command", build: (p) => `2> log\\ file.txt ${p}` },
    { id: "leading-redirection-escaped-quote-target", ground: "command", build: (p) => `2> "log \\"q\\" file.txt" ${p}` },
    // `shellWords` joins a backslash-CRLF; bash 3.2.57, 5.2.15 and 5.2.37 and zsh 5.9 split there.
    {
        id: "crlf-continuation-in-the-payload",
        ground: "data",
        groundByKind: { "write-redirect": "command" },
        // `>>` appends rather than truncates, so its ground differs from its siblings' and it is refused.
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
        // POSIX `'…'` has no escapes, so a payload holding `'` would close the wrapper early.
        carries: (p) => !p.includes("'"),
        build: (p) => `sh -c '${p}'`,
    },
    { id: "wrapper-after-separator", ground: "command", build: (p) => `ls && bash -c "${p}"` },
    { id: "wrapper-holding-separator", ground: "command", build: (p) => `bash -c "ls; ${p}"` },
    { id: "wrapper-holding-separator-after-separator", ground: "command", build: (p) => `ls && bash -c "x; ${p}"` },
    {
        id: "nested-wrapper",
        ground: "command",
        carries: (p) => !p.includes("'"),
        build: (p) => `bash -c "sh -c '${p}'"`,
    },
    { id: "single-quoted-echo", ground: "data", build: (p) => `echo '${p}'` },
    { id: "double-quoted-echo", ground: "data", build: (p) => `echo "${p}"` },
    { id: "heredoc-body", ground: "data", build: (p) => `cat <<'EOF'\n${p}\nEOF` },
    { id: "same-line-comment", ground: "data", build: (p) => `ls # ${p}` },
    { id: "comment-then-separator", ground: "data", build: (p) => `echo ok #; ${p}` },
    { id: "wrapper-holding-comment", ground: "data", build: (p) => `bash -c "echo ok #; ${p}"` },
];

/** The matcher's measured answer per cell; one that differs from ground truth names its `record`. */
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
        why: "A TRUE POSITIVE, and an earlier draft of this entry recorded it as a false red in all three of its carriers. A shell applies a redirection BEFORE it looks the command up, so although bash splits at the CRLF and the command never runs, the clobbering redirection on the surviving fragment still fires and truncates the target to ZERO BYTES. First measured on bash 3.2.57 and **re-measured 2026-08-25 on bash 5.2.15 and 5.2.37 as well**: a file holding 6 bytes before is 0 bytes after, on all three, for `echo \\<CRLF>ok > t`, `printf \\<CRLF>ok 1> t` and `cat \\<CRLF>src > t` alike. Widened here in the same pass as its `write-named` sibling, because one cell widened beside a narrow sibling is the class this production's own comment records. So the gated effect occurs, the matcher denying it is right, and `groundByKind` says so. The append shape is refused by `carries`, since `>>` does not truncate. Unlike its sibling this cell is NOT affected by `0031`: deleting BOTH carriers in a scratch clone leaves this answer `true` — **but the reason is narrower than an earlier draft claimed, and that draft was wrong about the mechanism.** It said the redirection is read off raw segment text; there is no raw-text path, `shellWrites` iterates `shellSegments` built from `shellWords`. What actually saves this cell is WHERE this production puts the pair: after the head, so the split leaves `> t` in a LATER segment whose `redirects` still name the target. **A CRLF after the `>` loses its target instead** — the operator takes the escaped `\r` and the path becomes an ordinary word — which is exactly why one of `./compile.test.mjs`'s two assertions fails on removal. So this survives for THIS production, not for every redirect spelling. Reported by Copilot, rounds 2 and 3 on #342. The deletion moves four surfaces, none of them this one: the `write-named` cell here, the `a-CRLF-continuation` goldens fixture, two assertions in `./compile.test.mjs`, and `mutants` refusing with exit 2 over the now-reddened corpus.",
    },
    "crlf-continuation-in-the-payload|write-named": {
        answer: true,
        record: "cli/compile.mjs, `shellWords` — a `\\r\\n` after a backslash is consumed as a PAIR, a decision taken 2026-07-28",
        why: "A FALSE RED, and the only one of the three. `shellWrites` reaches `shellSegments`, which reaches `shellWords`, which joins the pair — so the matcher sees a clean `cp /tmp/x docs/vision.md` and denies. bash splits, and the target is left byte-for-byte unchanged. **`cp` itself DOES run, and an earlier draft of this entry said it never does.** This production's `build` inserts the pair after the head, so the first fragment is `cp` carrying a malformed `\r` argument: it runs and fails (`missing destination file operand`). What never runs is the intended write — the target-bearing fragment is a separate command, and it is not found. Reported by Copilot, round 1 on #342. Fail-closed and worth one prompt. **The reachability claim is RETIRED**: `compile.mjs`'s comment used to say this spelling made the constitution 'reachable by editing the file on Windows', and it no longer does, and that comment now carries the measurement instead. Re-measured 2026-08-25 on bash 3.2.57, 5.2.15 and 5.2.37, plus zsh 5.9 and the measured host's `/bin/sh` (bash 3.2.57 in POSIX mode there — NOT the `dash`/`busybox` families, which were not measured), with a neutral target: none joins the pair, and the `cp` shape leaves its target byte-for-byte unchanged on all five. Two things bound that: no Windows-side bash was measured — git-bash, MSYS2, Cygwin, WSL — and no bash 4.x. **Still not repaired here, and for a narrower reason than the earlier draft gave.** That draft said only bash 3.2.57 was available, which stopped being true; what stands is that the repair direction is fail-OPEN on a gate matcher, so it is asked at `../.portulan/proposals/0031-a-continuation-no-shell-joins.md` and not taken.",
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

export const correctFor = (ground) => ground === "command";

/** How a payload shows its effect: a redirection truncates its target even when its command never runs. */
export const EFFECT = { shell: "ran", "write-redirect": "touched", "write-named": "ran" };

export const groundFor = (position, kind) => position.groundByKind?.[kind] ?? position.ground;

export const ruleKind = (kind) => (kind === "shell" ? "shell" : "write");

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

/** A finding as a case to paste into `evals/goldens/gates/<rule-id>.json`, expecting what the matcher did. */
export function asCase(position, kind, ruleId, command, actual, index) {
    return {
        id: `fuzz-${position.id}-${kind}-${index}`,
        class: correctFor(groundFor(position, kind)) === actual ? "holds" : "documented-hole",
        tool: PAYLOADS[kind].tool,
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

        for (const [kind, p] of Object.entries(PAYLOADS)) {
            if (!byId.has(p.rule)) {
                throw new CouldNotRun(
                    `the ${kind} payload targets \`${p.rule}\`, which the yielded policy does not declare. ` +
                        `Either the rule was renamed and this file was not, or half this fuzzer has nothing to attack`,
                );
            }
        }
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
                // Seeded per cell from its full identity, so one cell's budget never re-rolls another's.
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

// Compared as URLs so a space in the path still matches, and through realpath for a symlinked launch.
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
