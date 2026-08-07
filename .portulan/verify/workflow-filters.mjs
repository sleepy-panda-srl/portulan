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
// `.github/workflows/copilot-review.yml` reads a pull request as `[.head.sha, (.draft|tostring),
// .user.login] | join("|")` and then guards on the first field being empty (the third field, the
// author, feeds the verdict step's self-approval skip). `.github/workflows/pr-labels.yml` —
// a **required** status check — decides that a policy declares no labels by `jq -er` producing no
// output. Both behaviours are jq's, both are load-bearing, and until this file nothing executed
// either of them.
//
// The regression harness that covers the first workflow stubs `gh`, so it asserts the *shape* the
// filters are assumed to produce — `Copilot||PENDING|7` for a review with a null `commit_id`,
// `|false` for a pull request with a null `head.sha` — with nothing anywhere proving that jq
// produces it. `../handoffs/2026-07-28-awaiting-a-review-is-not-a-failure.md` carried that as its
// one open follow-up rather than smuggling it in.
//
// **Provenance.** Two suppressed low-confidence Copilot comments on
// [#63](https://github.com/sleepy-panda-works/portulan/pull/63) claimed `join("|")` errors on a null
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
//   recipe a build (`../identity.md`). `jq -er '.labels[].name'` in `pr-labels.yml` is the real
//   `jq` binary, so that one is exact.
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
const WORKFLOWS = [".github/workflows/copilot-review.yml", ".github/workflows/pr-labels.yml"];
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
// **Added 2026-07-31 for [#142].** `copilot-review.yml` decides whether Copilot's suppressed
// low-confidence notes exist by running awk over the review body, and that decision is the only
// thing standing between the notes and oblivion. It was covered by nothing. Copilot renamed the
// section — `Comments suppressed due to low confidence (N)` became `Suppressed comments (N)` — the
// literal stopped matching, and the step reported "none" over a body that had one. The word this
// recipe's green is read as is *the workflows' programs are exercised*, and it was true only of the
// jq half.
//
// Everything below mirrors the jq machinery deliberately, down to the two-pass token audit: an
// extraction that silently covered three of four programs is the same fail-open in a new costume.
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
    // ---- copilot-review.yml: the pull request read ------------------------------------------
    {
        id: "pr-normal",
        anchor: ".head.sha",
        why: "the ordinary read — SHA, separator, draft flag, author",
        input: '{"head":{"sha":"6a05f59","ref":"topic"},"draft":false,"number":54,'
            + '"user":{"login":"marius-cetanas"}}',
        stdout: "6a05f59|false|marius-cetanas\n",
        status: 0,
    },
    {
        id: "pr-draft",
        anchor: ".head.sha",
        why: "a draft is `true` in the second field, which is the whole NOT APPLICABLE branch",
        input: '{"head":{"sha":"6a05f59"},"draft":true,"user":{"login":"marius-cetanas"}}',
        stdout: "6a05f59|true|marius-cetanas\n",
        status: 0,
    },
    {
        id: "pr-app-author",
        anchor: ".head.sha",
        why: "the exact third field the verdict step's self-approval skip compares against — the "
            + "platform refuses an App approving its own pull request, so this string is the whole "
            + "reason the field exists",
        input: '{"head":{"sha":"6a05f59"},"draft":false,"user":{"login":"portulan-agent[bot]"}}',
        stdout: "6a05f59|false|portulan-agent[bot]\n",
        status: 0,
    },
    {
        id: "pr-ghost-author",
        anchor: ".head.sha",
        why: "GitHub returns `user: null` for a deleted account. The author field goes EMPTY — not "
            + "an error — and an empty login can never equal the App's, so the verdict proceeds "
            + "rather than skipping or crashing",
        input: '{"head":{"sha":"6a05f59"},"draft":false,"user":null}',
        stdout: "6a05f59|false|\n",
        status: 0,
    },
    {
        id: "pr-null-head-sha",
        anchor: ".head.sha",
        why: "a null SHA leaves the first field EMPTY — not the string `null`, not an error. This is "
            + "the one the workflow's no-head-SHA guard rests on, and the shape the stubbed harness "
            + "asserts without executing",
        input: '{"head":{"sha":null},"draft":false}',
        stdout: "|false|\n",
        status: 0,
    },
    {
        id: "pr-null-head-object",
        anchor: ".head.sha",
        why: "and a null `head` object reaches the same guard by the same route — `.head.sha` on "
            + "null is null, not an error, so this does not fail the read either",
        input: '{"head":null,"draft":false}',
        stdout: "|false|\n",
        status: 0,
    },
    // ---- copilot-review.yml: the reviews read -------------------------------------------------
    {
        id: "reviews-normal",
        anchor: ".commit_id",
        why: "one line per review, in the order the API returns them — the loop's `last match wins` "
            + "rule for a re-reviewed SHA depends on that order",
        input: '[{"user":{"login":"copilot-pull-request-reviewer[bot]"},"commit_id":"6a05f59",'
            + '"state":"COMMENTED","id":1},'
            + '{"user":{"login":"portulan-agent[bot]"},"commit_id":"6a05f59","state":"COMMENTED",'
            + '"id":2}]',
        stdout: "copilot-pull-request-reviewer[bot]|6a05f59|COMMENTED|1\n"
            + "portulan-agent[bot]|6a05f59|COMMENTED|2\n",
        status: 0,
    },
    {
        id: "reviews-null-commit",
        anchor: ".commit_id",
        why: "the exact string the stubbed harness asserts: a null `commit_id` collapses to an empty "
            + "field, so the review can never match a head SHA and the await keeps waiting",
        input: '[{"user":{"login":"Copilot"},"commit_id":null,"state":"PENDING","id":7}]',
        stdout: "Copilot||PENDING|7\n",
        status: 0,
    },
    {
        id: "reviews-ghost-user",
        anchor: ".commit_id",
        why: "GitHub returns `user: null` for a deleted account. The login field goes empty and the "
            + "loop's `[ -n \"${login:-}\" ] || continue` skips the line — it does not error",
        input: '[{"user":null,"commit_id":"6a05f59","state":"COMMENTED","id":9}]',
        stdout: "|6a05f59|COMMENTED|9\n",
        status: 0,
    },
    {
        id: "reviews-empty",
        anchor: ".commit_id",
        why: "no reviews yet is the state every pull request starts in: no output at all, exit 0. "
            + "An empty read here must not look like a failed read",
        input: "[]",
        stdout: "",
        status: 0,
    },
    // ---- copilot-review.yml: the review body -------------------------------------------------
    {
        id: "body-text",
        anchor: ".body //",
        why: "a body is printed raw, newlines and all — the awk that slices the suppressed-notes "
            + "block reads these lines",
        input: '{"body":"first\\nsecond","id":7}',
        stdout: "first\nsecond\n",
        status: 0,
    },
    {
        id: "body-null",
        anchor: ".body //",
        why: "an empty review body — `portulan-agent[bot]`'s replies are submitted exactly this way "
            + "— is null in the API. The `// \"\"` turns it into an empty line, so the read succeeds "
            + "and the notes section reports none rather than COULD NOT READ",
        input: '{"body":null,"id":7}',
        stdout: "\n",
        status: 0,
    },
    {
        id: "body-absent",
        anchor: ".body //",
        why: "and an absent key takes the same alternative, which is what `//` is there for",
        input: '{"id":7}',
        stdout: "\n",
        status: 0,
    },
    // ---- copilot-review.yml: the round's inline-comment count ---------------------------------
    {
        id: "count-none",
        anchor: "arrays",
        why: "a clean round — zero inline comments — is the approve branch's whole predicate. `-e` "
            + "does not turn 0 into a failure: it fails on false and null, and 0 is neither",
        input: "[]",
        stdout: "0\n",
        status: 0,
    },
    {
        id: "count-two",
        anchor: "arrays",
        why: "inline comments suppress the verdict — threads and conversation resolution carry "
            + "findings, so any non-zero count takes the no-review branch",
        input: '[{"id":1,"path":"a.md"},{"id":2,"path":"b.md"}]',
        stdout: "2\n",
        status: 0,
    },
    {
        id: "count-error-object",
        anchor: "arrays",
        why: "an error body must not count its keys as findings: bare `length` over "
            + '`{"message":…}` would print 2 and read as two comments. `arrays` yields nothing '
            + "for a non-array, and `-e` turns no-output into exit 4 — the no-verdict path",
        input: '{"message":"Not Found","documentation_url":"x"}',
        stdout: "",
        status: 4,
    },
    {
        id: "count-null",
        anchor: "arrays",
        why: "and a null body takes the same refusal by the same route — no output, exit 4, no "
            + "verdict computed from a read that answered nothing",
        input: "null",
        stdout: "",
        status: 4,
    },
    // ---- copilot-review.yml: the requested-reviewers diagnostic --------------------------------
    {
        id: "requested-two",
        anchor: ".users[]",
        why: "the diagnostic line printed after a budget expires, space-joined",
        input: '{"users":[{"login":"Copilot"},{"login":"portulan-agent[bot]"}],"teams":[]}',
        stdout: "Copilot portulan-agent[bot]\n",
        status: 0,
    },
    {
        id: "requested-empty",
        anchor: ".users[]",
        why: "Copilot leaves this list once it submits, so empty is the ordinary case and must not "
            + "fail the read — the shell prints `Reviewers requested and still unanswered:` bare",
        input: '{"users":[],"teams":[]}',
        stdout: "\n",
        status: 0,
    },
    {
        id: "requested-null-login",
        anchor: ".users[]",
        why: "a null login inside the array joins as the empty string. THIS is the case the two "
            + "suppressed review comments predicted would error, and it does not",
        input: '{"users":[{"login":null}],"teams":[]}',
        stdout: "\n",
        status: 0,
    },
    {
        id: "requested-null-users",
        anchor: ".users[]",
        why: "and this is where null DOES break a filter — iteration, never `join`. `.users[]` over "
            + "null is a hard error, so `gh` exits non-zero and the shell's `if requested=$(…)` "
            + "simply skips the line. Diagnostic only, so failing closed costs nothing; it is here "
            + "because the difference between the two is the whole answer to the review comment",
        input: '{"users":null}',
        stdout: "",
        status: 5,
    },
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
];

// ------------------------------------------------------- the awk fixtures: real review bodies
//
// The inputs are markup Copilot actually emitted on this repository, read back from
// `/pulls/N/reviews` on 2026-07-31 and trimmed in the note text only — every `<details>`,
// `<summary>`, heading and blank line is as it arrived.
//
// **Four spellings, all of them live in the history**, found by the by-hand sweep #142 asked for.
// Two axes vary independently — the container and the phrase — which is why there are four and not
// two:
//
//   1. `<summary>Comments suppressed due to low confidence (N)</summary>` — #109, #129, #135, #137
//   2. `### Comments suppressed due to low confidence (N)` — #107, and the earliest heading form
//   3. `<summary>Suppressed comments (N)</summary>` — #137, #145
//   4. `### Suppressed comments (N)` inside `<summary>Review details</summary>` — #140, #144
//
// That is the whole of #142 twice over: the matcher was written for 1, was silently defeated by 3
// and 4, and 2 and 4 are not `<summary>` lines at all — so a repair scoped to summaries would have
// looked correct while reading nothing.
//
// **They interleave.** 4, 3 and 4 again arrived at 05:52, 06:04 and 06:12 on 2026-07-31, so none of
// them is "the current one" and a repair written against the newest would be the same mistake in a
// newer costume. The fixtures below therefore assert all four containers-and-phrases, and a fix
// that trades one literal for another passes some of these and fails the rest.
//
// A fixture writes down a *body*, never a program — the same rule the jq half states above. A body
// is evidence about the platform and it goes stale honestly (Copilot changes it and a fixture
// fails); a copied program goes stale silently, which is the defect this whole file exists against.
const BODY_V1 = "## Pull request overview\n\n<details>\n"
    + "<summary>Comments suppressed due to low confidence (2)</summary>\n"
    + "\n**core/engine.md:22**\n* a note\n</details>\n";
const BODY_V2 = "## Pull request overview\n\n<details>\n<summary>Suppressed comments (1)</summary>\n"
    + "\n**.portulan/gate-map.md:698**\n* a note\n</details>\n";
const BODY_V3 = "### 🟢 Ready to approve\n\n<details>\n<summary>Review details</summary>\n"
    + "\n### Suppressed comments (1)\n\n**docs/plan.md:1823**\n* a note\n"
    + "\n- **Files reviewed:** 3/3 changed files\n- **Comments generated:** 0 new\n</details>\n";
const BODY_BENIGN = "## Pull request overview\n\n<details>\n<summary>Show a summary per file</summary>\n"
    + "\n| File | Description |\n</details>\n";
const BODY_CHROME = "### 🟢 Ready to approve\n\n<details>\n<summary>Review details</summary>\n"
    + "\n- **Files reviewed:** 3/3 changed files\n- **Comments generated:** 0 new\n</details>\n";
const BODY_NONE = "## Pull request overview\n\nCopilot reviewed 15 files and generated no new comments.\n";
// THE ONE THAT SHIPPED A FALSE COUNT. Copilot quotes the source line each note is about, in a fenced
// block, and this repository's reviews quote SHELL — where a comment opens with `#` at column 0 and is
// indistinguishable, line-wise, from a markdown heading. Read back from `/pulls/167/reviews` on
// 2026-08-07: the verdict review for `d21a341` announced *"3 suppressed low-confidence note(s) are
// quoted below"* and quoted ONE, because note 1's snippet opened with `# A raw NUL shipped inside …`.
// Two notes lost, and the count matcher and the extractor disagreeing about one body — the exact drift
// the one-marker design exists to prevent, arriving through the input nobody had modelled.
//
// It is the column-0 anchor's blind spot rather than its failure: the anchor was chosen so an INDENTED
// `#` in quoted code cannot read as a heading, and this is that hazard one step out. The repair is a
// fence toggle in all three programs, so quoted code is not markup in any of them.
const BODY_FENCED_HASH = "## Pull request overview\n\n<details>\n<summary>Suppressed comments (3)</summary>\n"
    + "\n**.portulan/verify/control-chars.sh:10**\n* the precondition is unchecked\n"
    + "```\n# A raw NUL shipped inside ./workflow-filters.mjs would not be caught here\nset -eu\n```\n"
    + "\n**.portulan/verify/README.md:77**\n* the count is stated rather than derived\n"
    + "\n**cli/control-chars.mjs:11**\n* this header claims coverage the matcher lacks\n</details>\n";
const BODY_MOVED = "## Pull request overview\n\n<details>\n<summary>Review details</summary>\n"
    + "\nWe suppressed 1 remark.\n</details>\n";
// A heading whose `#` is followed by a TAB rather than a space, and one whose text simply begins
// with `t`. Both exist to hold the heading test to a POSIX character class: written as `[ \t]`, the
// escape sits inside a bracket expression, where POSIX says a backslash is LITERAL — so a
// conforming awk may read it as *space, backslash, or the letter t* and match `#thoughts` while
// missing a real tab. gawk and BSD awk both take it as a tab, which is why the first cut passed
// under both and was still implementation-dependent. Raised by Copilot on #147, in one thread and
// two suppressed notes; the notes were swept BY HAND, because the repair for #142 is in this same
// change and `main`'s matcher could not have surfaced them.
const BODY_TAB_HEADING = "## Pull request overview\n\n#\tSuppressed comments (1)\n"
    + "\n**a.md:1**\n* a note\n";
const BODY_T_HEADING = "## Pull request overview\n\n#thoughts on the diff\n\nNothing to report.\n";
// A note whose quoted code block contains an INDENTED `#` comment mentioning the word. This is not
// hypothetical: Copilot asked on #147 for the heading tests to tolerate leading whitespace, and the
// review body carrying that request had exactly this shape — a snippet of this workflow, quoted back
// at it, comment lines and all. Tolerating indentation would have matched quoted code as a section
// marker on the round that proposed it. The fixture pins the refusal so the next reader meets the
// measurement rather than the argument.
const BODY_INDENTED_HASH = "## Pull request overview\n\n<details>\n<summary>Review details</summary>\n"
    + "\n### Suppressed comments (1)\n\n**a.md:1**\n* a note quoting the workflow:\n```\n"
    + "                    # THE SECTION MARKER MOVES, and suppress is the word it keeps\n"
    + "                    SUPPRESS='suppress'\n```\n\n- **Files reviewed:** 1/1 changed files\n</details>\n";

const AWK_CASES = [
    // ---- copilot-review.yml: is the suppressed block there --------------------------------------
    {
        id: "present-v1-summary",
        anchor: 'print "yes"',
        why: "spelling 1, the one the old literal was written for — it must keep matching, because a "
            + "repair that trades one literal for another passes the newer cases and fails here",
        input: BODY_V1,
        stdout: "yes\n",
        status: 0,
    },
    {
        id: "present-v2-summary",
        anchor: 'print "yes"',
        why: "**the #142 regression itself.** `Suppressed comments (1)` does not contain the old "
            + "literal, so the step reported `Read, not assumed` over a body carrying a real note",
        input: BODY_V2,
        stdout: "yes\n",
        status: 0,
    },
    {
        id: "present-v3-heading",
        anchor: 'print "yes"',
        why: "**a heading rather than a summary**, and the reason the marker test is not scoped to "
            + "`<summary>`: here the section is a markdown HEADING nested inside a `Review details` "
            + "block. A summary-only repair would have looked right and read nothing. Not called "
            + "the current spelling, because the four interleave and none of them is",
        input: BODY_V3,
        stdout: "yes\n",
        status: 0,
    },
    {
        id: "present-tab-after-hash",
        anchor: 'print "yes"',
        why: "a heading separated from its `#` by a TAB. `[ \\t]` put the escape inside a bracket "
            + "expression, where POSIX makes a backslash literal — so this is the case that says "
            + "the class is a real blank class and not three characters that happen to include one",
        input: BODY_TAB_HEADING,
        stdout: "yes\n",
        status: 0,
    },
    {
        id: "present-t-word-not-a-heading",
        anchor: 'print "yes"',
        why: "and the other side of the same defect: `#thoughts` must NOT read as a heading with a "
            + "separator. **This pair does not discriminate on the awks we run** — gawk and BSD awk "
            + "both take `\\t` in a bracket as a tab, which is exactly why the old spelling passed "
            + "everywhere and was still wrong. What these two pin is the INTENDED behaviour, so an "
            + "awk that reads the backslash literally — the one this class exists for — reds here "
            + "instead of silently matching `#thoughts` and missing a tab",
        input: BODY_T_HEADING,
        stdout: "",
        status: 0,
    },
    {
        id: "present-chrome-only",
        anchor: 'print "yes"',
        why: "the heading form with NO suppressed section — `Review details` and the stats list "
            + "are on nearly every round, so matching them would report notes on every clean one",
        input: BODY_CHROME,
        stdout: "",
        status: 0,
    },
    // ---- copilot-review.yml: how many notes ------------------------------------------------------
    {
        id: "count-v1-summary",
        anchor: "RSTART+1",
        why: "the count rides in the marker's parenthesis in all three spellings, so it is read from "
            + "there rather than by counting note bodies — which no markup guarantees the shape of",
        input: BODY_V1,
        stdout: "2\n",
        status: 0,
    },
    {
        id: "count-v3-heading",
        anchor: "RSTART+1",
        why: "and the same read off a heading rather than a summary — the parenthesis is read the same "
            + "way whichever container carries the marker",
        input: BODY_V3,
        stdout: "1\n",
        status: 0,
    },
    {
        id: "count-absent",
        anchor: "RSTART+1",
        why: "no block, no count — and an empty count is one of the two things that routes the step "
            + "to `unparsable`, so it must be empty rather than `0`",
        input: BODY_NONE,
        stdout: "",
        status: 0,
    },
    // ---- copilot-review.yml: what the notes say --------------------------------------------------
    {
        id: "notes-fenced-hash-keeps-all-three",
        anchor: "f { print }",
        why: "**the false count that merged.** A quoted shell comment at column 0 inside the block read "
            + "as a heading and ended the extraction at note 1, so `d21a341`'s verdict review said "
            + "three and quoted one. All three anchors must survive, and the fenced line itself is "
            + "content that must still print",
        input: BODY_FENCED_HASH,
        stdout: "\n**.portulan/verify/control-chars.sh:10**\n* the precondition is unchecked\n"
            + "```\n# A raw NUL shipped inside ./workflow-filters.mjs would not be caught here\nset -eu\n```\n"
            + "\n**.portulan/verify/README.md:77**\n* the count is stated rather than derived\n"
            + "\n**cli/control-chars.mjs:11**\n* this header claims coverage the matcher lacks\n",
        status: 0,
    },
    {
        id: "count-fenced-hash-agrees-with-the-extractor",
        anchor: "RSTART+1",
        why: "the other half of the same body: the announced count and the quoted notes must come from "
            + "one reading. Three quoted and `3` announced, or the verdict review lies about its own "
            + "contents the way it did on a merged pull request",
        input: BODY_FENCED_HASH,
        stdout: "3\n",
        status: 0,
    },
    {
        id: "present-ignores-a-marker-inside-a-fence",
        anchor: 'print "yes"',
        why: "the other direction, so the fence rule is not a matcher that merely stopped terminating: "
            + "a body whose ONLY mention of the word sits in quoted code opens no block",
        input: "## Pull request overview\n\nNothing to report.\n\n```\n### Comments suppressed due to low confidence (9)\n```\n",
        stdout: "",
        status: 0,
    },
    {
        id: "notes-v2-summary",
        anchor: "f { print }",
        why: "the block's lines, from just after the marker to the closing tag — this is the text the "
            + "job summary prints and the verdict review quotes onto the pull request",
        input: BODY_V2,
        stdout: "\n**.portulan/gate-map.md:698**\n* a note\n",
        status: 0,
    },
    {
        id: "notes-v3-stops-at-stats",
        anchor: "f { print }",
        why: "**the heading form's boundary.** Spelling 4 puts `- **Files reviewed:** 3/3` after the "
            + "notes and inside the same `<details>`, so terminating only at `</details>` would "
            + "quote Copilot's own statistics onto the pull request as suppressed findings",
        input: BODY_V3,
        stdout: "\n**docs/plan.md:1823**\n* a note\n\n",
        status: 0,
    },
    {
        id: "notes-stops-at-next-heading",
        anchor: "f { print }",
        why: "and a heading after the block ends it too — a second section is not part of the notes, "
            + "however the markup nests it",
        input: BODY_V1 + "\n## Something after the block\n",
        stdout: "\n**core/engine.md:22**\n* a note\n",
        status: 0,
    },
    {
        id: "notes-survive-quoted-indented-hash",
        anchor: "f { print }",
        why: "**the refusal, pinned.** A note quoting this workflow back at itself — indented `#` "
            + "comment lines and all. The extractor must run past them to the stats list, because "
            + "an indented `#` is content, not a section. If the heading tests ever tolerate "
            + "leading whitespace, this fixture reds and says why before anything ships",
        input: BODY_INDENTED_HASH,
        stdout: "\n**a.md:1**\n* a note quoting the workflow:\n```\n"
            + "                    # THE SECTION MARKER MOVES, and suppress is the word it keeps\n"
            + "                    SUPPRESS='suppress'\n```\n\n",
        status: 0,
    },
    {
        id: "notes-absent",
        anchor: "f { print }",
        why: "no block, no notes. Empty here is the other half of the `unparsable` predicate",
        input: BODY_BENIGN,
        stdout: "",
        status: 0,
    },
    // ---- copilot-review.yml: is absence actually evidence -----------------------------------------
    {
        id: "anywhere-word-absent",
        anchor: 'print "the-word-is-here"',
        why: "**this is what licenses the word `none`.** The old branch said `absent, not merely "
            + "unfound` on the strength of the same literal that decided presence — a test that "
            + "cannot tell `nothing here` from `I no longer recognise it`. Absence is now the word "
            + "being missing from the WHOLE body, which is a fact about the body rather than about "
            + "the matcher",
        input: BODY_NONE,
        stdout: "",
        status: 0,
    },
    {
        id: "anywhere-word-present-marker-not",
        anchor: 'print "the-word-is-here"',
        why: "**the markup-moved signature**, and the case that would have caught #142 the day it "
            + "happened: the word is in the body, no marker matched, the two readings disagree. That "
            + "routes to `unparsable` — read it by hand — instead of to a silent zero",
        input: BODY_MOVED,
        stdout: "the-word-is-here\n",
        status: 0,
    },
    {
        id: "anywhere-chrome-only",
        anchor: 'print "the-word-is-here"',
        why: "the ordinary clean round under the heading form: `Review details`, a stats list, and the "
            + "word nowhere. It must stay silent, or `unparsable` would fire on nearly every round "
            + "and the verdict would never approve — the cost that keeps this trade honest",
        input: BODY_CHROME,
        stdout: "",
        status: 0,
    },
];

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
        // reported line, and the four programs in `copilot-review.yml` were reported at 334, 335,
        // 365 and 369 when they sit at 366, 368, 388 and 414. A diagnostic that sends a reader to
        // the wrong line is worse than one that gives none, because the wrong line looks like an
        // answer. Raised as a suppressed note by Copilot on #147 — correctly, and it understated it:
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
        // Same precondition as the jq half, and it is not a formality here either: the awk programs
        // are the thing #142 found unexercised, so an extraction that reached none of them must
        // refuse rather than print a clean report over a matcher nobody ran.
        if (awkAll.length === 0) {
            throw new CouldNotRun(
                `no awk program found in ${WORKFLOWS.join(", ")} — refusing to report green having `
                    + "run nothing. If the suppressed-notes matcher was removed, remove its fixtures too",
            );
        }

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
