#!/usr/bin/env node
// Portulan workspace — every jq and awk program the workflows run, executed against fixtures.
// Exit 0 green · 1 red · 2 could not run.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

class CouldNotRun extends Error {}

const WORKFLOWS = [
    ".github/workflows/copilot-request.yml",
    ".github/workflows/pr-labels.yml",
];
const WORKFLOW_DIR = ".github/workflows";

// The `jq` command or gh's `--jq` flag, as a word.
const JQ_TOKEN = /(?:^|[\s(|;&])(?:--jq|jq)(?=[\s'"]|$)/g;

// A jq call this reader can run: the token, flags before the program, and the program in single quotes.
const JQ_CALL = /(?:^|[\s(|;&])(--jq|jq)((?:\s+-[^\s'"]+)*)\s+'([^']*)'/g;

// --------------------------------------------------------------------------------- and awk
const AWK_TOKEN = /(?:^|[\s(|;&])awk(?=[\s'"]|$)/g;

// An awk call: its `-v NAME="$VAR"` bindings, then the program in single quotes, which may span lines.
const AWK_CALL = /(?:^|[\s(|;&])awk((?:\s+-v\s+[A-Za-z_]\w*="\$[A-Za-z_]\w*")*)\s+'([^']*)'/g;

// One `-v` binding, and the plain single-quoted shell assignment a binding resolves through.
const AWK_BINDING = /-v\s+([A-Za-z_]\w*)="\$([A-Za-z_]\w*)"/g;
const SHELL_ASSIGN = /^([A-Za-z_]\w*)='([^']*)'\s*$/;

// ---------------------------------------------------------------------------------- the fixtures
// A case names its program by `anchor`, never a copy of it, and asserts jq's exact stdout and exit status.
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
    // GraphQL's `Bot.login` carries no `[bot]` suffix.
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
// None: no workflow runs awk. The awk half stays so a program added later is refused until it has a case.
const AWK_CASES = [];

// --------------------------------------------------------------------------------- reading a file

// Reads literal block scalars and one-line values only; the token audit in `jqPrograms` catches anything else.
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
            // Quotes are YAML's, not the shell's, so they come off.
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

// The parse decides what is covered and a raw token count audits it: a program the parse missed is could-not-run.
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
                const tail = line.slice(call.index + call[0].length);
                if (/(?:^|\s)-\S/.test(tail)) {
                    throw new CouldNotRun(
                        `${file}:${n} — a jq invocation carries a flag after its program `
                            + `(\`${tail.trim()}\`); this reader takes flags from before it only`,
                    );
                }
                // gh's `--jq` prints strings raw, like `jq -r`, but runs gojq: a gojq divergence is not covered.
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

function awkPrograms(file, text) {
    const values = runValues(text, file);

    const programs = [];
    let seen = 0;
    for (const value of values) {
        const code = value.body.filter(({ text: line }) => !/^\s*#/.test(line));
        // Per `run:` value, not per file: two steps may give one variable name different values.
        const assigns = new Map();
        for (const { text: line } of code) {
            const assign = SHELL_ASSIGN.exec(line.trim());
            if (assign) assigns.set(assign[1], assign[2]);
        }

        // A continuation loses only its backslash: keeping its newline keeps the line numbers below right.
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
            const before = joined.slice(0, call.index);
            const callLine = code[Math.min(before.split("\n").length - 1, code.length - 1)]?.n ?? value.at;
            programs.push({ file, at: `${file}:${callLine}`, vars, program });
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

// An anchor selects one distinct program, not one site: identical programs in several workflows share its cases.
function bind(programs) {
    const bound = new Map(programs.map((program) => [program, []]));
    // No flag or program contains NUL, so two distinct programs never share an identity.
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

function awkVersion() {
    // `--version` is gawk's; BSD awk answers `-W version`, on stderr.
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

// No `encoding`: stdout stays a Buffer and is compared byte for byte.
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
        if (programs.length === 0) {
            throw new CouldNotRun(
                `no jq program found in ${WORKFLOWS.join(", ")} — refusing to report green having run nothing`,
            );
        }

        const awkAll = [];
        for (const file of WORKFLOWS) {
            awkAll.push(...awkPrograms(file, read(file)));
        }
        // No count precondition, unlike jq: none found is the true answer, and `awkPrograms` refuses any it missed.

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
