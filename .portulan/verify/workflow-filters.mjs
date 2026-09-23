#!/usr/bin/env node
// Portulan workspace — every jq program a workflow runs, executed against fixtures.
//
// `./workflow-filters.sh` is the recipe; this is the instrument it wraps, the same split as
// `./compile.sh` and `../../cli/compile.mjs`. It lifts every jq program out of the workflow files'
// parsed `run:` scalars, runs each one through the real `jq` binary against fixtures, and compares
// stdout **byte for byte** and the exit status.
//
// ## Why it exists: two merge gates branch on what jq prints for null
//
// `.github/workflows/copilot-review.yml`, removed on 2026-09-23, read a pull request as
// `[.head.sha, (.draft|tostring), .user.login] | join("|")` and then guarded on the first field being
// empty (the third field, the author, fed the verdict step's self-approval skip).
// `.github/workflows/pr-labels.yml` — a **required** status check — decides that a policy declares no
// labels by `jq -er` producing no output. Both behaviours are jq's, both were load-bearing, and until
// this file nothing executed either of them. It now covers `pr-labels.yml` and `copilot-request.yml`.
//
// The regression harness that covers the first workflow stubs `gh`, so it asserts the *shape* the
// filters are assumed to produce — `Copilot||PENDING|7` for a review with a null `commit_id`,
// `|false` for a pull request with a null `head.sha` — with nothing anywhere proving that jq
// produces it. `../handoffs/2026-07-28-awaiting-a-review-is-not-a-failure.md` carried that as its
// one open follow-up rather than smuggling it in.
//
// **Provenance.** Two suppressed low-confidence Copilot comments on
// [#63](https://github.com/sleepy-panda-srl/portulan/pull/63) claimed `join("|")` errors on a null
// element and asked for a coalesce. The claim is **wrong** — jq renders null as the empty string in
// `join` and errors only on arrays and objects (jq 1.7.1) — and it was refused with that evidence on
// the pull request. The gap it pointed at was real: the refusal rested on a measurement taken once,
// in a terminal, by hand. This file is that measurement made durable, which is the outcome the
// suppressed half of a review is supposed to have (`../memory/verify-preconditions-fail-closed.md`
// records what it costs when it does not).
//
// ## The programs are never written down here
//
// A copy of a filter is a second carrier of one fact, and it keeps passing while the original
// drifts — this repository's signature defect, and precisely the failure this file exists to close
// rather than a shape to repeat. So a fixture names an **anchor**: a selector saying which program
// it answers for. The program itself is read out of the workflow, and if an anchor stops matching,
// nothing quietly passes — see the coverage rules below.
//
// ## What it proves, and what it does not
//
// - **It runs `jq`. The workflows do not.** `gh api --jq` evaluates the filter with **gojq**, a
//   re-implementation bundled inside `gh`. So what is established here is the behaviour of these
//   programs under jq 1.7.x, which is the binary the maintainer and every contributor has on the
//   path and the one CI installs nothing to get. A gojq divergence on these programs is **not**
//   covered, and covering it would mean installing a second interpreter — which would make this
//   recipe a build (`../identity.md`). A program a workflow hands to `jq` itself rather than to
//   `gh api --jq`, such as `jq -er '.labels[].name'` in `pr-labels.yml`, is exact.
// - **`--jq` is modelled as `jq -r`**, because `gh` prints string results raw. Read off this
//   repository's own run logs rather than assumed: the log line `found:
//   copilot-pull-request-reviewer[bot] reviewed d4db12b (COMMENTED)` on #63 carries an unquoted
//   login, and the shell around it compares `"$commit" = "$head"` against a bare SHA.
// - **It does not run the workflows.** The shell around these programs — the `IFS='|' read`, the
//   guards it feeds — is exercised by the lab harness recorded on #63, and by the live runs on that
//   pull request. This file owns exactly one link in that chain: what jq hands the shell.
//
// ## How the file is read, and why not with a YAML library
//
// There is none to import: no dependencies, no package manager, nothing installed before it runs
// (`../identity.md`). So this reads the **one construct it needs** — a block scalar under a `run:`
// key — and refuses anything else rather than approximating it.
//
// It is not a text slice, and the difference is measured rather than stylistic: #63's handoff
// records a multi-line string whose continuation lines sat at column 0 passing all thirteen lab
// cases *while the workflow itself no longer parsed*, because the harness had been fed a
// hand-sliced copy of the block instead of one YAML had delimited. A column-0 line ends a block
// scalar, so here it would truncate the script and take the programs after it out of coverage —
// which the audit below turns into exit 2 rather than a quieter green.
//
// **The parse decides and a raw scan audits it**, which is `./doctor.sh`'s ordering for
// `./doctor.sh`'s reason: discovery that decides can re-introduce the fail-open it was avoided for.
// Every jq token in the raw file must have been seen inside a parsed scalar; a token this reader
// never reached — in a `run:` spelling it does not handle, in another key, or past a truncation —
// is a disagreement between two readings of one file, and disagreement is *could not run*.
//
// Exit 0 green · 1 red · 2 could not run.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Thrown for every "could not run" — a missing file, a `run:` spelling this reader does not
// handle, a fixture table that no longer lines up with the tree. Never for a program that ran and
// produced the wrong bytes, which is the only thing here that is a verdict about the repository.
class CouldNotRun extends Error {}

// The workflow files whose jq programs are covered. Named rather than discovered, because a scan
// finding nothing would run nothing and report green — and audited against the directory below,
// because naming opens the mirror hole: a workflow *added* to the tree and not added here would be
// covered by nothing, and nothing would say so. Both halves are `./doctor.sh`'s, whose README
// paragraph explains the ordering at length.
const WORKFLOWS = [
    ".github/workflows/copilot-request.yml",
    ".github/workflows/pr-labels.yml",
];
const WORKFLOW_DIR = ".github/workflows";

// A jq token: the `jq` command or `gh`'s `--jq` flag, as a word. Used for the audit — it answers
// *how many jq programs are in this text*, never *what they are*.
const JQ_TOKEN = /(?:^|[\s(|;&])(?:--jq|jq)(?=[\s'"]|$)/g;

// A jq invocation this reader can act on: the token, any flags before the program, and the program
// as a single-quoted string. Every jq program in this repository's workflows is written this way;
// one that is not is caught by the audit rather than skipped, because the token is still there.
const JQ_CALL = /(?:^|[\s(|;&])(--jq|jq)((?:\s+-[^\s'"]+)*)\s+'([^']*)'/g;

// --------------------------------------------------------------------------------- and awk
//
// **Added 2026-07-31 for [#142].** `copilot-review.yml` decided whether Copilot's suppressed
// low-confidence notes existed by running awk over the review body, and that decision was the only
// thing standing between the notes and oblivion. It was covered by nothing. Copilot renamed the
// section — `Comments suppressed due to low confidence (N)` became `Suppressed comments (N)` — the
// literal stopped matching, and the step reported "none" over a body that had one. The word this
// recipe's green is read as is *the workflows' programs are exercised*, and it was true only of the
// jq half.
//
// Everything below mirrors the jq machinery deliberately, down to the two-pass token audit: an
// extraction that silently covered three of four programs is the same fail-open in a new costume.
//
// **The matcher it was added for left with `copilot-review.yml` on 2026-09-23**, and with it every
// awk fixture. No workflow runs awk today. The machinery stays, because the audit is what turns an
// awk program a workflow adds later into a refusal instead of a program nothing exercises.
const AWK_TOKEN = /(?:^|[\s(|;&])awk(?=[\s'"]|$)/g;

// An awk invocation this reader can act on: the token, its `-v NAME="$SHELL_VAR"` bindings, and the
// program as a single-quoted string. `[^']*` spans newlines, which is what makes the multi-line
// programs readable; the shell's line-continuations are joined before this runs, exactly as the
// shell joins them.
const AWK_CALL = /(?:^|[\s(|;&])awk((?:\s+-v\s+[A-Za-z_]\w*="\$[A-Za-z_]\w*")*)\s+'([^']*)'/g;

// One `-v` binding, and the plain single-quoted shell assignment a binding resolves through.
const AWK_BINDING = /-v\s+([A-Za-z_]\w*)="\$([A-Za-z_]\w*)"/g;
const SHELL_ASSIGN = /^([A-Za-z_]\w*)='([^']*)'\s*$/;

// ---------------------------------------------------------------------------------- the fixtures
//
// Each case names the program it answers for by `anchor` — a fragment that must appear in exactly
// one program across every covered workflow — and asserts the exact bytes jq writes to stdout and
// the exit status the surrounding shell branches on. `status` is stated on every case rather than
// defaulted, because for three of these the status *is* the finding.
//
// Every program carries at least one null-bearing or empty fixture and at least one ordinary one.
// The ordinary ones are not filler: they are what makes a red here readable, since a program that
// broke only on null and a program that broke on everything would otherwise look identical.
const CASES = [
    // ---- pr-labels.yml: the declared set ------------------------------------------------------
    {
        id: "declared-normal",
        anchor: ".labels[].name",
        why: "the declared label names, one per line, for the `comm` that follows",
        input: '{"labels":[{"name":"bug","description":"d"},{"name":"doctrine","description":"d"}]}',
        stdout: "bug\ndoctrine\n",
        status: 0,
    },
    {
        id: "declared-empty",
        anchor: ".labels[].name",
        why: "`-e` is the load-bearing flag: a policy declaring an EMPTY label set produces no "
            + "output and exit 4, which is what makes the workflow's `refusing to report green` "
            + "branch fire. Without `-e` this would be exit 0 and every pull request would be "
            + "judged against nothing",
        input: '{"labels":[]}',
        stdout: "",
        status: 4,
    },
    {
        id: "declared-null",
        anchor: ".labels[].name",
        why: "a policy whose `labels` key is null fails the same guard by the other route — an "
            + "iteration error, exit 5. Both are non-zero, which is all the workflow asks",
        input: '{"labels":null}',
        stdout: "",
        status: 5,
    },
    // ---- pr-labels.yml: the labels the pull request carries -----------------------------------
    {
        id: "carried-two",
        anchor: ".labels[]?.name",
        why: "the labels actually on the pull request, read from the API rather than the payload",
        input: '{"labels":[{"name":"bug"},{"name":"record"}],"number":46}',
        stdout: "bug\nrecord\n",
        status: 0,
    },
    {
        id: "carried-empty",
        anchor: ".labels[]?.name",
        why: "an unlabelled pull request is a successful read of nothing — exit 0, no output — so "
            + "the check reaches its own RED with the right sentence instead of `could not read`",
        input: '{"labels":[],"number":46}',
        stdout: "",
        status: 0,
    },
    {
        id: "carried-null",
        anchor: ".labels[]?.name",
        why: "and this is what the `?` buys, against `.users[]` two programs up: over a null the "
            + "optional form yields nothing and exits 0, where the plain form is a hard error. Two "
            + "spellings of one idea live in this repository's workflows and they do NOT agree",
        input: '{"labels":null,"number":46}',
        stdout: "",
        status: 0,
    },
    // ---- pr-labels.yml: the job-summary formatter ----------------------------------------------
    {
        id: "summary-covers",
        anchor: "usually:",
        why: "the declared-labels table written to the job summary, with the `covers` hint",
        input: '{"labels":[{"name":"bug","description":"A defect","covers":["a","b"]}]}',
        stdout: "- `bug` — A defect _(usually: a, b)_\n",
        status: 0,
    },
    {
        id: "summary-empty-covers",
        anchor: "usually:",
        why: "an empty `covers` drops the hint rather than printing an empty parenthesis",
        input: '{"labels":[{"name":"bug","description":"A defect","covers":[]}]}',
        stdout: "- `bug` — A defect\n",
        status: 0,
    },
    {
        id: "summary-null-covers",
        anchor: "usually:",
        why: "and a null `covers` takes the same branch, because `length` of null is 0 rather than "
            + "an error. This one is cosmetic — it writes a job summary and gates nothing — and it "
            + "is covered because the recipe's coverage rule admits no exceptions, which is the "
            + "property that makes an uncovered program impossible to miss",
        input: '{"labels":[{"name":"bug","description":"A defect","covers":null}]}',
        stdout: "- `bug` — A defect\n",
        status: 0,
    },
    // ---- copilot-request.yml: the pull request, read before asking -----------------------------
    //
    // Over REST, with the job's own token: head, state and draft flag on one line, which the shell
    // splits on `|`. REST spells the state in lower case.
    {
        id: "request-pr-open",
        anchor: ".state, (.draft | tostring)",
        why: "an open pull request that is not a draft: the head the shell compares with the event's, "
            + "the state it requires to be `open`, and the draft flag as a word",
        input: '{"head":{"sha":"h2"},"state":"open","draft":false}',
        stdout: "h2|open|false\n",
        status: 0,
    },
    {
        id: "request-pr-draft",
        anchor: ".state, (.draft | tostring)",
        why: "a draft prints `true`, and the job asks nothing for it",
        input: '{"head":{"sha":"h2"},"state":"open","draft":true}',
        stdout: "h2|open|true\n",
        status: 0,
    },
    {
        id: "request-pr-no-head",
        anchor: ".state, (.draft | tostring)",
        why: "an answer without the pull request's fields prints an empty head and state, because "
            + "`join` renders null as the empty string, and the word `null`. The shell reads the "
            + "empty head as unreadable and looks again, which is the answer it gives a failed read",
        input: '{"message":"Not Found","status":"404"}',
        stdout: "||null\n",
        status: 0,
    },
    {
        id: "request-pr-not-an-object",
        anchor: ".state, (.draft | tostring)",
        why: "an answer that is JSON but not an object is an error, exit 5, which `gh` passes on as "
            + "a failed read: the same unreadable branch",
        input: '"a string"',
        stdout: "",
        status: 5,
    },
    // ---- copilot-request.yml: the review requests, judged -------------------------------------
    //
    // Over GraphQL, with the job's own token. `gh` exits non-zero on any GraphQL error and then
    // prints the whole answer unfiltered, so the job keeps the answer in a file and this program
    // judges it: `ok`, then `hidden` or `shown`, then the Bots' logins; `refused`; or `unread`.
    // GraphQL's `Bot.login` carries no `[bot]` suffix, which is why the shell's login set has both.
    {
        id: "request-verdict-team-hidden",
        anchor: 'then "hidden" else "shown"',
        why: "the team `CODEOWNERS` requests is a reviewer the job may not see: GitHub answers the "
            + "rest, nulls that node and adds a FORBIDDEN error whose path ends in "
            + "`requestedReviewer`. That error is tolerated, the answer is marked `hidden`, the null "
            + "is dropped, and Copilot's login is printed. This is how #443's refusal is read; that "
            + "run's log kept only the message, so the shape is inferred",
        input: '{"data":{"repository":{"pullRequest":{"reviewRequests":{"nodes":[{"requestedReviewer":'
            + 'null},{"requestedReviewer":{"__typename":"Bot","login":"copilot-pull-request-reviewer"}}]}}}},'
            + '"errors":[{"type":"FORBIDDEN","path":["repository","pullRequest","reviewRequests","nodes",0,'
            + '"requestedReviewer"],"message":"Resource not accessible by integration"}]}',
        stdout: "ok hidden copilot-pull-request-reviewer\n",
        status: 0,
    },
    {
        id: "request-verdict-all-shown",
        anchor: 'then "hidden" else "shown"',
        why: "with no hidden reviewer the answer is `shown`, which is what lets a request the reads "
            + "after it do not find go red: every reviewer was seen, and none is Copilot",
        input: '{"data":{"repository":{"pullRequest":{"reviewRequests":{"nodes":[{"requestedReviewer":'
            + '{"__typename":"Bot","login":"copilot-pull-request-reviewer"}}]}}}}}',
        stdout: "ok shown copilot-pull-request-reviewer\n",
        status: 0,
    },
    {
        id: "request-verdict-null-reviewer-hidden",
        anchor: 'then "hidden" else "shown"',
        why: "a reviewer GitHub answers as null with no error beside it is hidden too, because it may "
            + "be Copilot's request as much as a refused one may",
        input: '{"data":{"repository":{"pullRequest":{"reviewRequests":{"nodes":[{"requestedReviewer":'
            + 'null}]}}}}}',
        stdout: "ok hidden \n",
        status: 0,
    },
    {
        id: "request-verdict-nothing-on-order",
        anchor: 'then "hidden" else "shown"',
        why: "a person holding a request prints no login, because only a Bot's is selected, and no "
            + "request at all prints none either: `ok shown` and nothing after it, which the shell "
            + "reads as nothing on order, so it asks",
        input: '{"data":{"repository":{"pullRequest":{"reviewRequests":{"nodes":[{"requestedReviewer":'
            + '{"__typename":"User"}}]}}}}}',
        stdout: "ok shown \n",
        status: 0,
    },
    {
        id: "request-verdict-refused",
        anchor: 'then "hidden" else "shown"',
        why: "a FORBIDDEN error anywhere but on a reviewer is the job token's own refusal, and "
            + "`refused` sends the job red at once, with the answer printed",
        input: '{"data":{"repository":{"pullRequest":null}},"errors":[{"type":"FORBIDDEN","path":'
            + '["repository","pullRequest"],"message":"Resource not accessible by integration"}]}',
        stdout: "refused\n",
        status: 0,
    },
    {
        id: "request-verdict-refused-without-path",
        anchor: 'then "hidden" else "shown"',
        why: "and a FORBIDDEN error with no path at all is the same refusal, not a hidden reviewer",
        input: '{"data":null,"errors":[{"type":"FORBIDDEN","message":"Resource not accessible by integration"}]}',
        stdout: "refused\n",
        status: 0,
    },
    {
        id: "request-verdict-other-error",
        anchor: 'then "hidden" else "shown"',
        why: "any other error, such as GitHub's answer to a query that timed out, is `unread`, and "
            + "the next look repeats the read",
        input: '{"data":null,"errors":[{"message":"Something went wrong while executing your query. '
            + 'This may be the result of a timeout, or it could be a GitHub bug."}]}',
        stdout: "unread\n",
        status: 0,
    },
    {
        id: "request-verdict-no-pull-request",
        anchor: 'then "hidden" else "shown"',
        why: "a pull request GitHub could not resolve is `unread` rather than an empty list, so it "
            + "is never taken for nothing on order",
        input: '{"data":{"repository":{"pullRequest":null}},"errors":[{"type":"NOT_FOUND","path":'
            + '["repository","pullRequest"],"message":"Could not resolve to a PullRequest with the number of 7."}]}',
        stdout: "unread\n",
        status: 0,
    },
    {
        id: "request-verdict-no-list",
        anchor: 'then "hidden" else "shown"',
        why: "an answer that carries the pull request but no list of review requests is `unread`, so "
            + "it is never taken for every reviewer shown and none of them Copilot",
        input: '{"data":{"repository":{"pullRequest":{"reviewRequests":null}}}}',
        stdout: "unread\n",
        status: 0,
    },
    {
        id: "request-verdict-not-graphql",
        anchor: 'then "hidden" else "shown"',
        why: "an object with neither `data` nor `errors`, as an HTTP error body is, is `unread`",
        input: '{"message":"Server Error"}',
        stdout: "unread\n",
        status: 0,
    },
    {
        id: "request-verdict-not-an-object",
        anchor: 'then "hidden" else "shown"',
        why: "an answer that is JSON but not an object is `unread` too: the type test comes first "
            + "and `or` stops there, so `has` never sees a string",
        input: '"a string"',
        stdout: "unread\n",
        status: 0,
    },
    {
        id: "request-verdict-empty",
        anchor: 'then "hidden" else "shown"',
        why: "an empty answer, which a failed connection leaves in the file, prints nothing and "
            + "exits 0; the shell counts anything but `ok` and `refused` as unread",
        input: "",
        stdout: "",
        status: 0,
    },
];

// ------------------------------------------------------------------------------ the awk fixtures
//
// None, since 2026-09-23. They were real review bodies Copilot emitted on this repository, asserting
// the suppressed-notes matcher and the round classifier in `copilot-review.yml`, and they left with
// that workflow. A fixture added here binds to a program by `anchor` exactly as the jq half does.
const AWK_CASES = [];

// --------------------------------------------------------------------------------- reading a file

// Every `run:` value in a workflow, as the shell would receive it — each line dedented, and
// carrying the file line it came from so a finding cites the program rather than the step.
//
// Only the constructs this repository's workflows actually use are handled — a literal block scalar
// (`|`, `|-`, `|+`) and a single-line value. A folded scalar re-wraps lines, which changes the shell
// text materially, so it is refused rather than guessed at; anything else this reader walks past is
// caught by the token audit in `jqPrograms`, not skipped.
function runValues(text, file) {
    const lines = text.split("\n");
    const values = [];
    for (let i = 0; i < lines.length; i += 1) {
        const key = /^(\s*)run:(.*)$/.exec(lines[i]);
        if (!key) continue;
        const keyIndent = key[1].length;
        const rest = key[2].trim();
        const at = `${file}:${i + 1}`;

        if (rest.startsWith(">")) {
            throw new CouldNotRun(
                `${at} is a folded \`run:\` scalar, which re-wraps the shell text — this reader `
                    + "handles literal block scalars and one-liners, and refuses to guess at the rest",
            );
        }
        if (!rest.startsWith("|")) {
            // A one-line `run:`. Quotes are the value's, not the shell's, so they come off.
            const bare = /^(['"])(.*)\1$/.exec(rest);
            values.push({ at, body: [{ n: i + 1, text: bare ? bare[2] : rest }] });
            continue;
        }

        const body = [];
        let blockIndent = null;
        let j = i + 1;
        for (; j < lines.length; j += 1) {
            if (lines[j].trim() === "") {
                body.push({ n: j + 1, text: "" });
                continue;
            }
            const indent = lines[j].length - lines[j].trimStart().length;
            // A line at or left of the key's indent ENDS the scalar — the rule that turned a
            // column-0 continuation line into a broken workflow that a sliced harness still passed.
            if (indent <= keyIndent) break;
            if (blockIndent === null) blockIndent = indent;
            if (indent < blockIndent) {
                throw new CouldNotRun(
                    `${file}:${j + 1} is indented less than the block scalar opened at ${at}, `
                        + "which YAML rejects — this file does not parse, so nothing here can be run",
                );
            }
            body.push({ n: j + 1, text: lines[j].slice(blockIndent) });
        }
        if (blockIndent === null) throw new CouldNotRun(`${at} opens an empty block scalar`);
        values.push({ at, body });
        i = j - 1;
    }
    return values;
}

// Every jq program in one workflow file, with the flags it runs under.
//
// The two passes are deliberate and their order is the point: the parsed `run:` values decide what
// is covered, and a scan of the raw file cross-checks the count. They can only disagree when this
// reader failed to reach something — a truncated scalar, a spelling it does not handle, a jq call
// outside a `run:` — and a reader that quietly covered less than the file contains is the exact
// fail-open the recipes have minted five rules about.
function jqPrograms(file, text) {
    const code = (line) => !/^\s*#/.test(line);
    const count = (line) => (line.match(JQ_TOKEN) ?? []).length;

    const programs = [];
    let seen = 0;
    for (const value of runValues(text, file)) {
        for (const { n, text: line } of value.body) {
            if (!code(line)) continue;
            const tokens = count(line);
            if (tokens === 0) continue;
            seen += tokens;
            let matches = 0;
            for (const call of line.matchAll(JQ_CALL)) {
                matches += 1;
                const [, spelling, flagText, filter] = call;
                // `gh`'s `--jq` prints string results raw, which is `jq -r`. The tail of the line is
                // checked for stray flags because they would sit AFTER the program and this reader
                // only looks before it — better to refuse than to run a program under the wrong
                // flags and report on it.
                const tail = line.slice(call.index + call[0].length);
                if (/(?:^|\s)-\S/.test(tail)) {
                    throw new CouldNotRun(
                        `${file}:${n} — a jq invocation carries a flag after its program `
                            + `(\`${tail.trim()}\`); this reader takes flags from before it only`,
                    );
                }
                const flags = spelling === "--jq" ? ["-r"] : flagText.trim().split(/\s+/).filter(Boolean);
                programs.push({ file, at: `${file}:${n}`, spelling, flags, filter });
            }
            if (matches < tokens) {
                throw new CouldNotRun(
                    `${file}:${n} — ${tokens} jq invocation(s) on the line and ${matches} readable; `
                        + `a program not written as a single-quoted argument cannot be run here: ${line.trim()}`,
                );
            }
        }
    }

    const raw = text.split("\n").filter(code).reduce((total, line) => total + count(line), 0);
    if (raw !== seen) {
        throw new CouldNotRun(
            `${file}: ${raw} jq token(s) in the file and ${seen} inside a parsed \`run:\` scalar. `
                + "The two readings disagree, so this recipe cannot say it covered the file — check "
                + "for a block scalar ended early by a column-0 line, or a jq call outside a `run:`",
        );
    }
    return programs;
}

// Every awk program in one workflow file, with its `-v` bindings resolved to the values the shell
// would pass.
//
// Two things differ from `jqPrograms` and both are forced by awk's shape here. The programs are
// **multi-line**, so a `run:` value is rejoined into the text the shell receives — line
// continuations included, exactly as the shell joins them — and matched as one string rather than
// line by line. And the programs take **variables**: `-v m="$SUPPRESS"` means the matcher itself
// lives in a shell assignment, so this reader resolves that assignment out of the same block. A
// fixture that hardcoded `m` would be asserting about a value the workflow no longer uses, which is
// the copied-carrier defect one level down.
function awkPrograms(file, text) {
    const values = runValues(text, file);

    // Resolved per `run:` value, not per file: two steps may each set a variable of one name, and
    // reaching across them would silently run a program under a neighbour's value.
    const programs = [];
    let seen = 0;
    for (const value of values) {
        const code = value.body.filter(({ text: line }) => !/^\s*#/.test(line));
        const assigns = new Map();
        for (const { text: line } of code) {
            const assign = SHELL_ASSIGN.exec(line.trim());
            if (assign) assigns.set(assign[1], assign[2]);
        }

        // The shell's own join — with the NEWLINE KEPT and only the backslash dropped, which is the
        // difference between a report that cites the right line and one that does not.
        //
        // The first cut collapsed `\` + newline into a single space, the way the shell does. That is
        // faithful to the shell and wrong for this reader, because the line of a match is recovered
        // by counting newlines before it: every collapsed continuation shifted every later program's
        // reported line, and the four programs in `copilot-review.yml` (removed 2026-09-23) were
        // reported at 334, 335, 365 and 369 when they sat at 366, 368, 388 and 414. A diagnostic that
        // sends a reader to the wrong line is worse than one that gives none, because the wrong line
        // looks like an answer. Raised as a suppressed note by Copilot on #147 — correctly, and it understated it:
        // the note predicted a shift for *later* calls, and in fact all four were wrong.
        //
        // Dropping the backslash and keeping the newline preserves the count exactly, and AWK_CALL
        // still matches across it: the continuation only ever sits between the `-v` bindings and the
        // quoted program, where the pattern already allows any whitespace. It never falls inside a
        // single-quoted program — and if it ever did, the token audit below is what says so, since a
        // corrupted program stops matching AWK_CALL and the two counts disagree.
        const joined = code.map(({ text: line }) => line).join("\n").replace(/\\\n/g, "\n");
        const tokens = (joined.match(AWK_TOKEN) ?? []).length;
        if (tokens === 0) continue;
        seen += tokens;

        let matches = 0;
        for (const call of joined.matchAll(AWK_CALL)) {
            matches += 1;
            const [, bindingText, program] = call;
            const vars = [];
            for (const binding of bindingText.matchAll(AWK_BINDING)) {
                const [, name, shellVar] = binding;
                if (!assigns.has(shellVar)) {
                    throw new CouldNotRun(
                        `${value.at} — an awk program binds \`-v ${name}="$${shellVar}"\` and this `
                            + `\`run:\` block never assigns \`${shellVar}\` as a single-quoted `
                            + "literal; this reader will not guess the value a matcher runs under",
                    );
                }
                vars.push({ name, value: assigns.get(shellVar) });
            }
            // Line number of the call, recovered from the pre-join text so a red cites the file.
            const before = joined.slice(0, call.index);
            const at = code[Math.min(before.split("\n").length - 1, code.length - 1)]?.n ?? value.at;
            programs.push({ file, at: `${file}:${at}`, vars, program });
        }
        if (matches < tokens) {
            throw new CouldNotRun(
                `${value.at} — ${tokens} awk invocation(s) in the block and ${matches} readable; an `
                    + "awk program not written as a single-quoted argument cannot be run here",
            );
        }
    }

    const raw = text
        .split("\n")
        .filter((line) => !/^\s*#/.test(line))
        .reduce((total, line) => total + (line.match(AWK_TOKEN) ?? []).length, 0);
    if (raw !== seen) {
        throw new CouldNotRun(
            `${file}: ${raw} awk token(s) in the file and ${seen} inside a parsed \`run:\` scalar. `
                + "The two readings disagree, so this recipe cannot say it covered the file",
        );
    }
    return programs;
}

// ------------------------------------------------------------------------------------- the checks

function read(file) {
    try {
        return fs.readFileSync(file, "utf8");
    } catch (error) {
        throw new CouldNotRun(`cannot read ${file} — ${error.message}`);
    }
}

// The mirror half of the named list: a workflow carrying a jq program that is not covered here.
// Reported as could-not-run rather than as a pass, because "this recipe covered the workflows" is
// the sentence its green is read as.
function auditForUncoveredWorkflows() {
    let entries;
    try {
        entries = fs.readdirSync(WORKFLOW_DIR);
    } catch (error) {
        throw new CouldNotRun(`cannot enumerate ${WORKFLOW_DIR} — ${error.message}`);
    }
    const strays = [];
    for (const entry of entries.sort()) {
        if (!/\.ya?ml$/.test(entry)) continue;
        const file = path.posix.join(WORKFLOW_DIR, entry);
        if (WORKFLOWS.includes(file)) continue;
        const lines = read(file).split("\n").filter((line) => !/^\s*#/.test(line));
        const count = (pattern) =>
            lines.reduce((total, line) => total + (line.match(pattern) ?? []).length, 0);
        const jq = count(JQ_TOKEN);
        const awk = count(AWK_TOKEN);
        if (jq > 0 || awk > 0) {
            const what = [jq > 0 ? `${jq} jq` : null, awk > 0 ? `${awk} awk` : null]
                .filter(Boolean)
                .join(" + ");
            strays.push(`${file} (${what} token(s))`);
        }
    }
    if (strays.length) {
        throw new CouldNotRun(
            `a workflow runs jq or awk and is not covered by this recipe: ${strays.join(", ")} — add `
                + "it to WORKFLOWS with fixtures, or this recipe's green means less than it says",
        );
    }
}

// Anchors bind a fixture to a program, and the binding is checked in both directions. An anchor
// matching nothing means the program changed shape and the fixture now describes a filter that is
// not there; a program no anchor names is a filter running in CI that nothing exercises. Neither is
// a verdict about the workflows, and neither may pass: both are exit 2, which is `./doctor.sh`'s
// answer to the same disagreement.
//
// What an anchor must select is one **distinct** program, not one call site. Two workflows running
// the identical filter is a thing that will happen — `.head.sha` is not an exotic thing to want —
// and requiring exactly one *site* would answer that with an exit 2 no anchor could ever satisfy,
// which is a rail that traps the change rather than catching it. So identical programs bind to the
// same fixtures and each site is exercised; two *different* programs under one anchor stays exit 2,
// because there the fixture would be asserting about a filter nobody chose for it.
function bind(programs) {
    const bound = new Map(programs.map((program) => [program, []]));
    // NUL as an ESCAPE, never as a literal byte. It is the right separator — neither a flag nor a jq
    // program can contain one, so no two distinct programs can collide into a single identity — and
    // the raw byte shipped here once, caught by a Copilot round on #64. It is invisible in every
    // sense that matters: `file` called this source *binary data*, and `grep -n "identity = "` on
    // this very line exited 1 — a **silent false negative**, in a repository whose recipes are built
    // out of grep. Git rendered the diff as text only because the byte sat past the first 8000,
    // which is luck rather than safety: a few hundred lines earlier and the whole instrument would
    // have arrived in review as `Binary files differ`.
    const identity = (program) => `${program.flags.join(" ")}\u0000${program.filter}`;
    for (const testCase of CASES) {
        const hits = programs.filter((program) => program.filter.includes(testCase.anchor));
        const distinct = new Set(hits.map(identity));
        if (distinct.size !== 1) {
            throw new CouldNotRun(
                `fixture \`${testCase.id}\` anchors on \`${testCase.anchor}\`, which matches `
                    + `${distinct.size} distinct jq program(s) of the ${programs.length} in the `
                    + "workflows rather than exactly one — "
                    + (distinct.size === 0
                        ? "the workflow changed and this fixture table did not"
                        : `the anchor no longer says which: ${[...hits.map((h) => h.at)].join(", ")}`),
            );
        }
        for (const hit of hits) bound.get(hit).push(testCase);
    }
    const orphans = [...bound].filter(([, cases]) => cases.length === 0);
    if (orphans.length) {
        throw new CouldNotRun(
            "jq program(s) with no fixture: "
                + orphans.map(([program]) => `${program.at} \`${program.filter}\``).join("; ")
                + " — a filter this recipe does not exercise must not be reported as covered",
        );
    }
    return bound;
}

// The awk half of `bind`, on the same rules and for the same reasons: an anchor selecting no
// program means the workflow moved and the fixture table did not; a program no anchor names is a
// matcher running in CI that nothing exercises, which is precisely how #142 survived.
function bindAwk(programs) {
    const bound = new Map(programs.map((program) => [program, []]));
    const identity = (program) =>
        `${program.vars.map((v) => `${v.name}=${v.value}`).join(" ")}\u0000${program.program}`;
    for (const testCase of AWK_CASES) {
        const hits = programs.filter((program) => program.program.includes(testCase.anchor));
        const distinct = new Set(hits.map(identity));
        if (distinct.size !== 1) {
            throw new CouldNotRun(
                `awk fixture \`${testCase.id}\` anchors on \`${testCase.anchor}\`, which matches `
                    + `${distinct.size} distinct awk program(s) of the ${programs.length} in the `
                    + "workflows rather than exactly one — "
                    + (distinct.size === 0
                        ? "the workflow changed and this fixture table did not"
                        : `the anchor no longer says which: ${[...hits.map((h) => h.at)].join(", ")}`),
            );
        }
        for (const hit of hits) bound.get(hit).push(testCase);
    }
    const orphans = [...bound].filter(([, cases]) => cases.length === 0);
    if (orphans.length) {
        throw new CouldNotRun(
            "awk program(s) with no fixture: "
                + orphans.map(([program]) => program.at).join("; ")
                + " — a matcher this recipe does not exercise must not be reported as covered",
        );
    }
    return bound;
}

// Byte comparison and the same three refusals as `runCase`. The program and its variables come from
// the workflow; only the body and the expectation are the fixture's.
function runAwkCase(program, testCase) {
    const args = [];
    for (const { name, value } of program.vars) args.push("-v", `${name}=${value}`);
    args.push(program.program);
    const result = spawnSync("awk", args, { input: testCase.input });
    if (result.error) {
        throw new CouldNotRun(
            result.error.code === "ENOENT"
                ? "awk is not on the path — this recipe cannot answer for a matcher it never ran"
                : `awk could not be run — ${result.error.message}`,
        );
    }
    if (result.status === null) {
        throw new CouldNotRun(`awk was killed by ${result.signal} on fixture \`${testCase.id}\``);
    }
    const faults = [];
    const expected = Buffer.from(testCase.stdout, "utf8");
    if (!result.stdout.equals(expected)) {
        faults.push(
            `stdout ${JSON.stringify(result.stdout.toString("utf8"))}, `
                + `expected ${JSON.stringify(testCase.stdout)}`,
        );
    }
    if (result.status !== testCase.status) {
        faults.push(`exit ${result.status}, expected ${testCase.status}`);
    }
    return faults;
}

// Which awk answered, for the same reason `jqVersion` names its binary: BSD awk and gawk are not
// the same program, and this repository's CI and its maintainer's laptop do not run the same one.
function awkVersion() {
    // `awk --version` is gawk's; BSD awk answers `-W version` and writes to stderr. Both are tried
    // and whatever comes back is reported verbatim rather than parsed into a shape.
    for (const args of [["--version"], ["-W", "version"]]) {
        const result = spawnSync("awk", args, { encoding: "utf8" });
        if (result.error?.code === "ENOENT") break;
        const text = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
        if (text) return text.split("\n")[0];
    }
    const probe = spawnSync("awk", ["BEGIN { print 1 }"], { encoding: "utf8" });
    if (probe.error || probe.status !== 0) {
        throw new CouldNotRun("awk is not on the path — this recipe cannot answer for a matcher it never ran");
    }
    return "an awk that reports no version";
}

// Which jq answered is part of the result, not trivia: the claim this recipe settles is about a
// named interpreter's behaviour, and the next person to read a red needs to know whether the binary
// moved under it. Doubles as the honest ENOENT check for a direct `node …workflow-filters.mjs` run,
// where the recipe's own `command -v` guard has not run.
function jqVersion() {
    const result = spawnSync("jq", ["--version"], { encoding: "utf8" });
    if (result.error || result.status !== 0) {
        throw new CouldNotRun(
            result.error?.code === "ENOENT"
                ? "jq is not on the path — this recipe cannot answer for a filter it never ran"
                : `jq --version failed — ${result.error?.message ?? `exit ${result.status}`}`,
        );
    }
    return result.stdout.trim();
}

// No `encoding` — stdout comes back as a Buffer and is compared as bytes.
//
// It read `encoding: "utf8"` first, which decodes before comparing, and a Copilot round on #64 said
// so: the header two screens up promised a byte-for-byte comparison and the code delivered a string
// one. For valid UTF-8 the two agree, so nothing was passing that should have failed — but the
// promise was still wider than the code, and a decode step is exactly where a difference goes
// missing (two invalid sequences both become U+FFFD and compare equal). Fixed in the direction that
// keeps the promise rather than by trimming the promise, because what this recipe asserts about
// **jq's output** is the whole of its value.
function runCase(program, testCase) {
    const result = spawnSync("jq", [...program.flags, program.filter], { input: testCase.input });
    if (result.error) {
        throw new CouldNotRun(
            result.error.code === "ENOENT"
                ? "jq is not on the path — this recipe cannot answer for a filter it never ran"
                : `jq could not be run — ${result.error.message}`,
        );
    }
    if (result.status === null) {
        throw new CouldNotRun(`jq was killed by ${result.signal} on fixture \`${testCase.id}\``);
    }
    const faults = [];
    const expected = Buffer.from(testCase.stdout, "utf8");
    if (!result.stdout.equals(expected)) {
        // Decoded for the message only. The verdict above is the bytes; this is what a person reads.
        faults.push(
            `stdout ${JSON.stringify(result.stdout.toString("utf8"))}, `
                + `expected ${JSON.stringify(testCase.stdout)}`,
        );
    }
    if (result.status !== testCase.status) {
        faults.push(`exit ${result.status}, expected ${testCase.status}`);
    }
    return faults;
}

export function run() {
    const say = (line = "") => process.stdout.write(`${line}\n`);
    try {
        auditForUncoveredWorkflows();

        const programs = [];
        for (const file of WORKFLOWS) {
            programs.push(...jqPrograms(file, read(file)));
        }
        // The count is a precondition, not a formality: an extraction that found nothing would run
        // nothing and print a clean report, which is the shape `../memory/
        // verify-preconditions-fail-closed.md` was minted for.
        if (programs.length === 0) {
            throw new CouldNotRun(
                `no jq program found in ${WORKFLOWS.join(", ")} — refusing to report green having run nothing`,
            );
        }

        const awkAll = [];
        for (const file of WORKFLOWS) {
            awkAll.push(...awkPrograms(file, read(file)));
        }
        // No count precondition here, unlike the jq half, since 2026-09-23: no workflow runs awk, so
        // none found is the true answer. It cannot hide a program: `awkPrograms` refuses a file whose
        // raw awk tokens its parse did not reach, and `bindAwk` refuses a fixture that binds to nothing.

        const bound = bind(programs);
        const boundAwk = bindAwk(awkAll);
        say(
            `filters: ${programs.length} jq program(s) in ${WORKFLOWS.length} workflow file(s), `
                + `${CASES.length} fixture(s), run through ${jqVersion()}`,
        );
        say(
            `         ${awkAll.length} awk program(s), ${AWK_CASES.length} fixture(s), `
                + `run through ${awkVersion()}`,
        );

        let failed = 0;
        for (const [program, cases] of bound) {
            say();
            // Printed as the workflow spells it, then as this recipe runs it. Collapsing the two
            // would have the report claim the file says `jq -r` where it says `gh api --jq`, and
            // the gap between those two is where the gojq limit lives.
            say(
                program.spelling === "--jq"
                    ? `${program.at}  gh api --jq '${program.filter}'   → run here as: jq -r`
                    : `${program.at}  jq ${program.flags.join(" ")} '${program.filter}'`,
            );
            for (const testCase of cases) {
                const faults = runCase(program, testCase);
                if (faults.length === 0) {
                    say(`  ok    ${testCase.id} — ${testCase.why}`);
                } else {
                    failed += 1;
                    say(`  FAIL  ${testCase.id} — ${testCase.why}`);
                    for (const fault of faults) say(`        ${fault}`);
                    say(`        input ${testCase.input}`);
                }
            }
        }

        for (const [program, cases] of boundAwk) {
            say();
            // The program as one line, so a red names the matcher rather than a step. The `-v`
            // bindings are printed with their RESOLVED values: what a reader needs to know on a red
            // is what the matcher was, and in this workflow the matcher is the variable.
            const vars = program.vars.map((v) => `-v ${v.name}='${v.value}'`).join(" ");
            say(`${program.at}  awk ${vars} '${program.program.replace(/\s*\n\s*/g, " ").trim()}'`);
            for (const testCase of cases) {
                const faults = runAwkCase(program, testCase);
                if (faults.length === 0) {
                    say(`  ok    ${testCase.id} — ${testCase.why}`);
                } else {
                    failed += 1;
                    say(`  FAIL  ${testCase.id} — ${testCase.why}`);
                    for (const fault of faults) say(`        ${fault}`);
                    say(`        input ${JSON.stringify(testCase.input)}`);
                }
            }
        }

        say();
        const total = CASES.length + AWK_CASES.length;
        say(
            failed === 0
                ? "GREEN — verify recipe passed."
                : `RED — ${failed} of ${total} fixture(s) failed; "done" is blocked.`,
        );
        return failed === 0 ? 0 : 1;
    } catch (error) {
        if (error instanceof CouldNotRun) {
            process.stderr.write(`verify: ${error.message}\n`);
            return 2;
        }
        process.stderr.write(`verify: unanticipated failure — ${error.stack ?? error}\n`);
        return 2;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = run();
}
