// `portulan feedback` — the suite, written before the sender.
//
//   node --test "cli/**/*.test.mjs"
//
// The acceptance criteria are `.portulan/tasks/0012-a-feedback-pipe-points-out-of-the-seam.md`'s
// *Done when* list, and each group below cites the line it discharges. That is not bookkeeping: the
// task was written at the session-open checkpoint before any of this existed, so a test here that
// answers to nothing in that list is scope this session did not have graded.
//
// **What this file does NOT do is reach the network.** Every `gh` invocation arrives through an
// injected `exec`, because a suite that filed real issues to prove it can file issues would be a
// suite nobody could run twice. The one thing an injected `exec` cannot prove — that the bytes a user
// approved are the bytes GitHub received — is not proven here by comparison but held by construction:
// `preview` and `send` call the same `payload()`, and the test below asserts the printed body IS that
// call's return value rather than a second rendering that happens to match today.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
    FORMS,
    form,
    slug,
    scaffold,
    parseReport,
    payload,
    locateTerms,
    scan,
    run,
    COOLDOWN_SECONDS,
} from "./feedback.mjs";

// ===========================================================================================
// Harness
// ===========================================================================================

const AT = new Date("2026-08-10T09:15:00Z");

// One exit handler for all scratch directories rather than one each — the per-directory form exceeds
// node's default ten-listener limit and prints a MaxListenersExceededWarning (`./doctor.test.mjs`,
// which carries the same block for the same reason). This suite had no sweeper at all until now: it
// leaked 46 directories per run, the largest single share of the suite's 78.
//
// The per-directory `try` is not defensive habit: the unreadable-workspace case chmods the scratch
// ROOT ITSELF to `0o000` while it holds 2 entries, and restores it in `finally` — so a case dying
// before its `finally` leaves a directory `rmSync` cannot enter, as EACCES. `force: true` suppresses
// ENOENT, not EACCES. Naked, that throw aborts the loop inside an `exit` handler and abandons every
// directory after it: one locked case would cost the other 45. (The `0o500` `feedback/` case is
// deliberately not cited — it is empty when locked, and an empty readable directory still removes.)
//
// Which locks actually bite was measured, not assumed, because a hazard claimed where none exists
// is the same defect as one missed: an EMPTY directory still removes if it is READABLE, so only an
// unreadable one blocks while empty; a NON-EMPTY one additionally needs write and search. The errno
// follows readability, not position: an UNREADABLE root gives EACCES, while everything else — a
// locked child, or a readable-but-unwritable root — gives ENOTEMPTY.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) {
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch {
            /* a case died before restoring a mode — sweep what is left rather than abandoning it */
        }
    }
});

/** A workspace directory with a manifest, plus whatever extra files a case plants. */
function workspace(extra = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-feedback-"));
    SCRATCH.push(dir);
    fs.writeFileSync(
        path.join(dir, "workspace.json"),
        JSON.stringify({ portulan: { spec: "2.7" }, name: "acme-platform", kind: "repository" }, null, 2),
    );
    for (const [rel, contents] of Object.entries(extra)) {
        const at = path.join(dir, rel);
        fs.mkdirSync(path.dirname(at), { recursive: true });
        fs.writeFileSync(at, contents);
    }
    return dir;
}

/** Collects a run's output and its exit code, with every impure edge injected. */
function invoke(argv, options = {}) {
    const out = [];
    const err = [];
    const calls = [];
    const code = run(argv, {
        say: (line = "") => out.push(line),
        warn: (line = "") => err.push(line),
        now: () => AT,
        env: options.env ?? {},
        // Default: `gh` is present, authenticated, and files successfully.
        exec:
            options.exec ??
            ((cmd, args, spawn = {}) => {
                calls.push({ cmd, args, input: spawn.input });
                if (args[0] === "auth") return { status: 0, stdout: "", stderr: "" };
                return { status: 0, stdout: "https://github.com/sleepy-panda-srl/portulan/issues/999\n", stderr: "" };
            }),
        facts: options.facts ?? { platform: "darwin", release: "25.6.0", arch: "arm64", node: "v22.0.0" },
        ...options.extra,
    });
    return { code, out: out.join("\n"), err: err.join("\n"), calls };
}

/**
 * Draft a report and fill it the way a user would, so the later verbs have something real to read.
 * The title varies by kind because a report's filename is derived from it, and two kinds drafted into
 * one directory under one title collide — which is the tool behaving correctly and the harness not.
 */
function drafted(dir, kind = "feedback", fill = {}) {
    const title = kind === "feedback" ? "The boot said nothing" : `The ${kind} report`;
    const at = invoke(["draft", kind, "--title", title, "--into", dir]);
    assert.equal(at.code, 0, at.out + at.err);
    const file = path.join(dir, "feedback", `2026-08-10-${slug(title)}.md`);

    let text = fs.readFileSync(file, "utf8");
    for (const [label, value] of Object.entries(fill)) {
        // Replace the placeholder body of one `### <label>` section.
        const re = new RegExp(`(### ${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n\\n)([\\s\\S]*?)(?=\\n### |$)`);
        text = text.replace(re, `$1${value}\n\n`);
    }
    text = text.replace(/^- \[ \]/gm, "- [x]");
    fs.writeFileSync(file, text);
    return file;
}

/**
 * A report that has been read: drafted, filled, and previewed. `send` refuses anything else, so this
 * is the flow every send case has to go through — which is the mechanism, not a harness convenience.
 */
function previewed(dir, kind = "feedback", fill = {}, options = {}) {
    const file = drafted(dir, kind, fill);
    const seen = invoke(["preview", file], options);
    assert.equal(seen.code, 0, seen.out + seen.err);
    return file;
}

/** The three required-section fills for each kind, so a case can reach the payload. */
const FILLED = {
    feedback: {
        "What kind of feedback": "Something was confusing or hard to follow",
        "The feedback": "I could not tell what `.portulan/` was for.",
    },
    bug: {
        "What happened": "`doctor` reported green on a missing gates file.",
        "What you expected, and where Portulan says so": "`spec/slots.md` says every declared path resolves.",
    },
    improvement: {
        "The problem": "Nothing refuses a budget raise in the change that breached it.",
        "What you propose": "A rail that reds a raise landing beside the breach.",
        "How it would earn its place": "A verify recipe, forced red on the class.",
        "Which part of Portulan": "mechanism — cli/, spec/, the plugin: the code that checks and enforces",
    },
};

// ===========================================================================================
// The report is a file before it is a request — Done when 1, 2
// ===========================================================================================

describe("draft — the report is a file before it is a request", () => {
    test("writes <workspace>/feedback/<date>-<slug>.md with the form's sections and unticked acknowledgements", () => {
        const dir = workspace();
        const { code, out } = invoke(["draft", "feedback", "--title", "The boot said nothing", "--into", dir]);
        assert.equal(code, 0, out);

        const at = path.join(dir, "feedback", "2026-08-10-the-boot-said-nothing.md");
        assert.ok(fs.existsSync(at), `expected ${at}\n${out}`);
        const text = fs.readFileSync(at, "utf8");

        assert.match(text, /^---\n/);
        assert.match(text, /\nkind: feedback\n/);
        assert.match(text, /\ntitle: The boot said nothing\n/);
        assert.match(text, /\ncreated: 2026-08-10\n/);
        for (const section of form("feedback").sections.filter((s) => !s.filled)) {
            assert.ok(text.includes(`### ${section.label}`), `missing section: ${section.label}`);
        }
        // Unticked, because the acknowledgements are the user's to make and a scaffold that
        // pre-ticks them has made them on their behalf.
        assert.ok(text.includes("- [ ] "), "acknowledgements should scaffold unticked");
        assert.ok(!text.includes("- [x]"), "nothing should arrive pre-ticked");
    });

    test("refuses to write over an existing report", () => {
        const dir = workspace();
        assert.equal(invoke(["draft", "feedback", "--title", "Twice", "--into", dir]).code, 0);
        const second = invoke(["draft", "feedback", "--title", "Twice", "--into", dir]);
        assert.equal(second.code, 2);
        assert.match(second.err + second.out, /already exists/i);
    });

    test("an unknown kind, a missing title and an empty slug each exit 2 and name what is missing", () => {
        const dir = workspace();
        const unknown = invoke(["draft", "complaint", "--title", "x", "--into", dir]);
        assert.equal(unknown.code, 2);
        assert.match(unknown.err + unknown.out, /bug|improvement|feedback/);

        const untitled = invoke(["draft", "feedback", "--into", dir]);
        assert.equal(untitled.code, 2);
        assert.match(untitled.err + untitled.out, /title/i);

        const empty = invoke(["draft", "feedback", "--title", "!!! ???", "--into", dir]);
        assert.equal(empty.code, 2);
        assert.match(empty.err + empty.out, /slug|letters|digits/i);
    });

    test(
        "an unreadable workspace and an unreadable report are could-not-read, not absent",
        { skip: process.getuid?.() === 0 },
        () => {
            // The same rule the term list holds, at the two path probes `draft` makes. Both were
            // `existsSync`, which answers false for `EACCES` — so an unreadable workspace was reported
            // as *no workspace.json*, sending the reader to fix the wrong thing.
            // A place this tool cannot see into is not a place with no workspace in it.
            const outer = workspace();
            const nested = path.join(outer, "inner");
            fs.mkdirSync(nested);
            fs.copyFileSync(path.join(outer, "workspace.json"), path.join(nested, "workspace.json"));
            fs.chmodSync(outer, 0o000);
            try {
                const blind = invoke(["draft", "feedback", "--title", "Unreadable", "--into", nested]);
                assert.equal(blind.code, 2);
                assert.match(blind.err, /could not be read/);
                assert.doesNotMatch(blind.err, /does not look like a workspace/);
            } finally {
                fs.chmodSync(outer, 0o700);
            }

            // And a file at mode 0000 is still a file that is there — the collision probe asks whether
            // something is already at this path, never whether it can be read.
            const dir = workspace();
            const at = drafted(dir, "feedback", FILLED.feedback);
            fs.chmodSync(at, 0o000);
            try {
                const over = invoke(["draft", "feedback", "--title", "The boot said nothing", "--into", dir]);
                assert.equal(over.code, 2);
                assert.match(over.err, /already exists/);
            } finally {
                fs.chmodSync(at, 0o600);
            }
        },
    );

    test("--failed-recipe and --failed-exit are the only failure facts a draft carries", () => {
        const dir = workspace();
        const ok = invoke([
            "draft", "bug", "--title", "Red on green", "--into", dir,
            "--failed-recipe", "docs", "--failed-exit", "1",
        ]);
        assert.equal(ok.code, 0, ok.out + ok.err);
        const text = fs.readFileSync(path.join(dir, "feedback", "2026-08-10-red-on-green.md"), "utf8");
        assert.match(text, /\nfailed-recipe: docs\n/);
        assert.match(text, /\nfailed-exit: 1\n/);

        // A recipe id is a slug and an exit code is an integer — anything else is refused rather
        // than carried into a public issue unexamined.
        const bad = invoke([
            "draft", "bug", "--title", "Red on green two", "--into", dir,
            "--failed-recipe", "docs; rm -rf /", "--failed-exit", "1",
        ]);
        assert.equal(bad.code, 2);
        const worse = invoke([
            "draft", "bug", "--title", "Red on green three", "--into", dir,
            "--failed-recipe", "docs", "--failed-exit", "the output",
        ]);
        assert.equal(worse.code, 2);
    });

    test("every kind the map declares can be drafted, and nothing else can", () => {
        const dir = workspace();
        for (const declared of FORMS) {
            const made = invoke(["draft", declared.kind, "--title", `A ${declared.kind} report`, "--into", dir]);
            assert.equal(made.code, 0, `${declared.kind}: ${made.out}${made.err}`);
        }
        assert.equal(FORMS.length, 3, "three forms live under .github/ISSUE_TEMPLATE/");
    });
});

// ===========================================================================================
// The preview and the send are the same bytes — Done when 3, 4
// ===========================================================================================

describe("preview — the bytes the user sees", () => {
    test("prints the repository, the title and the body between markers, and the body IS payload()'s", () => {
        const dir = workspace();
        const file = drafted(dir, "feedback", FILLED.feedback);
        const { code, out } = invoke(["preview", file]);
        assert.equal(code, 0, out);

        const report = parseReport(fs.readFileSync(file, "utf8"));
        const built = payload(report, {
            spec: "2.7",
            facts: { platform: "darwin", release: "25.6.0", arch: "arm64", node: "v22.0.0" },
        });

        const body = between(out);
        assert.equal(body, built.body, "the previewed body must be the payload call's own bytes");
        assert.ok(out.includes(built.title), "the previewed title must be the payload call's own");
        assert.match(out, /sleepy-panda-srl\/portulan/);
    });

    test("the title carries the form's own prefix and the user's words, and no label is sent", () => {
        const dir = workspace();
        const file = drafted(dir, "feedback", FILLED.feedback);
        const { out } = invoke(["preview", file]);
        assert.ok(out.includes("[feedback] The boot said nothing"));
        // Proposal 0014: "No issue triage, labelling or routing from the client. The repository owns
        // its own labels." The prefix is the kind marker; a label the client sets is not.
        assert.match(out, /label/i);
        assert.match(out, /repository owns its own labels|no labels/i);
    });

    test("a required section left empty exits 2 and names the section", () => {
        const dir = workspace();
        const file = drafted(dir, "feedback", { "What kind of feedback": "Other" });
        const { code, err, out } = invoke(["preview", file]);
        assert.equal(code, 2);
        assert.match(err + out, /The feedback/);
    });

    test("an unticked required acknowledgement exits 2 — the CLI intake is not weaker than the web form", () => {
        const dir = workspace();
        const at = invoke(["draft", "feedback", "--title", "Unticked", "--into", dir]);
        assert.equal(at.code, 0);
        const file = path.join(dir, "feedback", "2026-08-10-unticked.md");
        let text = fs.readFileSync(file, "utf8");
        for (const [label, value] of Object.entries(FILLED.feedback)) {
            const re = new RegExp(`(### ${label}\\n\\n)([\\s\\S]*?)(?=\\n### |$)`);
            text = text.replace(re, `$1${value}\n\n`);
        }
        fs.writeFileSync(file, text); // acknowledgements left unticked
        const { code, err, out } = invoke(["preview", file]);
        assert.equal(code, 2);
        assert.match(err + out, /confidential|acknowledge/i);
    });

    test("a dropdown section holding none or two of the declared options exits 2 and lists them", () => {
        const dir = workspace();
        const none = drafted(dir, "feedback", { ...FILLED.feedback, "What kind of feedback": "Something else entirely" });
        const a = invoke(["preview", none]);
        assert.equal(a.code, 2);
        assert.match(a.err + a.out, /Something was confusing or hard to follow/);

        const two = drafted(dir, "improvement", {
            ...FILLED.improvement,
            "Which part of Portulan": "mechanism — cli/, spec/, the plugin: the code that checks and enforces\nnot sure",
        });
        const b = invoke(["preview", two]);
        assert.equal(b.code, 2);
    });

    test("an optional section left empty renders as GitHub renders one", () => {
        const dir = workspace();
        const file = drafted(dir, "feedback", FILLED.feedback);
        const { out } = invoke(["preview", file]);
        assert.match(between(out), /### What you were trying to do\n\n_No response_/);
    });
});

// ===========================================================================================
// Gated means per action — Done when 5, 6, 7, 8
// ===========================================================================================

describe("send — Gated, per action", () => {
    test("without --approve it exits 2 and prints the preview instead of filing", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        const { code, out, err, calls } = invoke(["send", file]);
        assert.equal(code, 2);
        assert.equal(calls.length, 0, "nothing may reach `gh` without approval");
        assert.ok(between(out).length > 0, "the refusal shows what would have been sent");
        assert.match(err, /--approve/);
        assert.match(err, /Gated/);
    });

    test("with --approve it files exactly the previewed bytes and records the URL back into the report", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        const seen = between(invoke(["preview", file]).out);

        const { code, out, calls } = invoke(["send", file, "--approve"]);
        assert.equal(code, 0, out);
        const create = calls.find((c) => c.args[0] === "issue");
        assert.ok(create, "expected a `gh issue create`");
        assert.deepEqual(create.args.slice(0, 2), ["issue", "create"]);
        assert.equal(create.input, seen, "the filed body must be the previewed body, byte for byte");
        // 0014: the repository owns its own labels.
        assert.ok(!create.args.includes("--label"), "the client sets no labels");

        const after = fs.readFileSync(file, "utf8");
        assert.match(after, /\nissue: https:\/\/github\.com\/sleepy-panda-srl\/portulan\/issues\/999\n/);
        assert.match(after, /\nsent: 2026-08-10T09:15:00\.000Z\n/);
        assert.match(out, /issues\/999/);
    });

    test("a report nobody previewed is refused — the approval is bound to bytes, not to an intention", () => {
        const dir = workspace();
        const file = drafted(dir, "feedback", FILLED.feedback); // deliberately NOT previewed
        const { code, err, calls } = invoke(["send", file, "--approve"]);
        assert.equal(code, 2);
        assert.equal(calls.length, 0, "nothing may be filed sight-unseen");
        assert.match(err, /not been previewed/i);
    });

    test("a report edited after its preview is refused, and the two digests are shown", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        fs.writeFileSync(
            file,
            fs.readFileSync(file, "utf8").replace("I could not tell", "I really could not tell"),
        );
        const { code, err, calls } = invoke(["send", file, "--approve"]);
        assert.equal(code, 2);
        assert.equal(calls.length, 0);
        assert.match(err, /changed since it was previewed/i);
        assert.match(err, /previewed [0-9a-f]{64}/);
        assert.match(err, /now\s+[0-9a-f]{64}/);
    });

    test("a machine fact changing between preview and send is caught too — the facts are in the payload", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        // Previewed without --host, sent with one: different bytes, so a different digest.
        const { code, err } = invoke(["send", file, "--approve", "--host", "Claude Code 2.1.226"]);
        assert.equal(code, 2);
        assert.match(err, /changed since it was previewed/i);
    });

    test("previewing twice replaces the stamp rather than stacking a second one", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        assert.equal(invoke(["preview", file]).code, 0);
        const text = fs.readFileSync(file, "utf8");
        assert.equal((text.match(/^previewed: /gm) ?? []).length, 1);
        assert.equal(invoke(["send", file, "--approve"]).code, 0, "the second preview is the one that counts");
    });

    test("a blanked title is refused rather than filed as a bare prefix", () => {
        // `draft` refuses an absent title, but the report is a file a human edits afterwards.
        const dir = workspace();
        const file = drafted(dir, "feedback", FILLED.feedback);
        fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/^title: .*$/m, "title:"));
        const { code, err } = invoke(["preview", file]);
        assert.equal(code, 2);
        assert.match(err, /`title:` is empty/);
    });

    test("a report that already carries an issue refuses a second send with 2 and the URL", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        assert.equal(invoke(["send", file, "--approve"]).code, 0);
        const again = invoke(["send", file, "--approve"]);
        assert.equal(again.code, 2);
        assert.equal(again.calls.length, 0);
        assert.match(again.err + again.out, /issues\/999/);
    });

    test("a send inside the cooldown of the previous send in the same directory exits 2", () => {
        const dir = workspace();
        const first = previewed(dir, "feedback", FILLED.feedback);
        assert.equal(invoke(["send", first, "--approve"]).code, 0);

        const second = previewed(dir, "bug", FILLED.bug);
        const soon = invoke(["send", second, "--approve"]);
        assert.equal(soon.code, 2);
        assert.equal(soon.calls.length, 0);
        assert.match(soon.err + soon.out, /cooldown|seconds/i);

        // Past the window, the same send goes through — the guard catches a loop, not a user.
        const out = [];
        const later = run(["send", second, "--approve"], {
            say: (l = "") => out.push(l),
            warn: (l = "") => out.push(l),
            now: () => new Date(AT.getTime() + (COOLDOWN_SECONDS + 1) * 1000),
            env: {},
            exec: (cmd, args) =>
                args[0] === "auth"
                    ? { status: 0, stdout: "", stderr: "" }
                    : { status: 0, stdout: "https://github.com/sleepy-panda-srl/portulan/issues/1000\n", stderr: "" },
            facts: { platform: "darwin", release: "25.6.0", arch: "arm64", node: "v22.0.0" },
        });
        assert.equal(later, 0, out.join("\n"));
    });

    test("gh absent, and gh present but unauthenticated, both exit 2 and route the user somewhere true", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        const missing = invoke(["send", file, "--approve"], {
            exec: () => ({ status: null, stdout: "", stderr: "", error: new Error("spawn gh ENOENT") }),
        });
        assert.equal(missing.code, 2);
        assert.match(missing.err, /issues\/new\/choose/);
        // NOT a `--body-file <the report>` suggestion: the report is not the payload, so following it
        // would publish frontmatter, guidance comments and raw sections nobody previewed — out of the
        // one verb whose subject is that they cannot be. Asserted, because it was shipped once.
        assert.doesNotMatch(missing.err, new RegExp(`--body-file\\s+${file.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&")}`));

        const dir2 = workspace();
        const unauth = invoke(["send", previewed(dir2, "feedback", FILLED.feedback), "--approve"], {
            exec: (cmd, args) =>
                args[0] === "auth"
                    ? { status: 1, stdout: "", stderr: "You are not logged into any GitHub hosts." }
                    : { status: 0, stdout: "", stderr: "" },
        });
        assert.equal(unauth.code, 2);
        assert.match(unauth.err + unauth.out, /gh auth login/);
    });

    test("a gh failure is could-not-run, and the report keeps no issue line", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        const { code } = invoke(["send", file, "--approve"], {
            exec: (cmd, args) =>
                args[0] === "auth"
                    ? { status: 0, stdout: "", stderr: "" }
                    : { status: 1, stdout: "", stderr: "HTTP 403" },
        });
        assert.equal(code, 2);
        assert.ok(!fs.readFileSync(file, "utf8").includes("issue: http"), "a failed send records no URL");
    });

    test("--repo is a named override, and the default is derived from the shipped package manifest", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        const { calls } = invoke(["send", file, "--approve", "--repo", "sleepy-panda-srl/scratch"]);
        const create = calls.find((c) => c.args[0] === "issue");
        assert.ok(create.args.includes("sleepy-panda-srl/scratch"));

        const other = workspace();
        const plain = invoke(["send", previewed(other, "feedback", FILLED.feedback), "--approve"]);
        const first = plain.calls.find((c) => c.args[0] === "issue");
        assert.ok(first.args.includes("sleepy-panda-srl/portulan"));
    });
});

// ===========================================================================================
// The seam scan — Done when 9, 10, 11, 12, 13
// ===========================================================================================

describe("the seam scan, and where fail-closed sits", () => {
    test("a hit exits 1, names the term and the section, and sends nothing", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", {
            ...FILLED.feedback,
            "The feedback": "The workspace at Northwind Foundry could not resolve its pack root.",
        });
        const terms = path.join(dir, "terms.txt");
        fs.writeFileSync(terms, "# one per line\nnorthwind\n\n");

        const { code, err, out, calls } = invoke(["send", file, "--approve", "--seam-terms", terms]);
        assert.equal(code, 1, "a scan that ran and refused is a verdict, not a could-not-run");
        assert.equal(calls.length, 0);
        assert.match(err + out, /northwind/i);
        assert.match(err + out, /The feedback/);
    });

    test("the title is scanned too, not only the body", () => {
        const dir = workspace();
        const at = invoke(["draft", "feedback", "--title", "Northwind bounced", "--into", dir]);
        assert.equal(at.code, 0);
        const file = path.join(dir, "feedback", "2026-08-10-northwind-bounced.md");
        let text = fs.readFileSync(file, "utf8");
        for (const [label, value] of Object.entries(FILLED.feedback)) {
            text = text.replace(new RegExp(`(### ${label}\\n\\n)([\\s\\S]*?)(?=\\n### |$)`), `$1${value}\n\n`);
        }
        fs.writeFileSync(file, text.replace(/^- \[ \]/gm, "- [x]"));

        const terms = path.join(dir, "terms.txt");
        fs.writeFileSync(terms, "northwind\n");
        assert.equal(invoke(["preview", file, "--seam-terms", terms]).code, 1);
    });

    test("the verdict names WHICH of the three locations answered", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);

        const flag = path.join(dir, "flag-terms.txt");
        fs.writeFileSync(flag, "zzzz\n");
        assert.match(invoke(["preview", file, "--seam-terms", flag]).out, /--seam-terms/);

        const viaEnv = path.join(dir, "env-terms.txt");
        fs.writeFileSync(viaEnv, "zzzz\n");
        assert.match(invoke(["preview", file], { env: { PORTULAN_SEAM_TERMS: viaEnv } }).out, /PORTULAN_SEAM_TERMS/);

        fs.writeFileSync(path.join(dir, "seam-terms.txt"), "zzzz\n");
        assert.match(invoke(["preview", file]).out, /seam-terms\.txt/);
    });

    test("the flag beats the environment variable, which beats the convention", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", { ...FILLED.feedback, "The feedback": "acme and zeta and iota" });
        fs.writeFileSync(path.join(dir, "seam-terms.txt"), "iota\n");
        const flag = path.join(dir, "flag.txt");
        fs.writeFileSync(flag, "acme\n");
        const viaEnv = path.join(dir, "env.txt");
        fs.writeFileSync(viaEnv, "zeta\n");

        const both = invoke(["preview", file, "--seam-terms", flag], { env: { PORTULAN_SEAM_TERMS: viaEnv } });
        assert.equal(both.code, 1);
        assert.match(both.err + both.out, /acme/);
        assert.ok(!/zeta/.test(both.err + both.out), "the environment variable must not be read when the flag is given");

        const envOnly = invoke(["preview", file], { env: { PORTULAN_SEAM_TERMS: viaEnv } });
        assert.match(envOnly.err + envOnly.out, /zeta/);
    });

    test("a list named by flag or env that cannot be read exits 2 — never a send", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        const absent = invoke(["send", file, "--approve", "--seam-terms", path.join(dir, "nope.txt")]);
        assert.equal(absent.code, 2);
        assert.equal(absent.calls.length, 0);
        assert.match(absent.err + absent.out, /nope\.txt/);

        const viaEnv = invoke(["send", file, "--approve"], { env: { PORTULAN_SEAM_TERMS: path.join(dir, "nope.txt") } });
        assert.equal(viaEnv.code, 2);
        assert.equal(viaEnv.calls.length, 0);
    });

    test("at the convention path only ENOENT means absent — an unreadable one exits 2", { skip: process.getuid?.() === 0 }, () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        const at = path.join(dir, "seam-terms.txt");
        fs.writeFileSync(at, "zzzz\n");
        fs.chmodSync(at, 0o000);
        try {
            const { code, err, out, calls } = invoke(["send", file, "--approve"]);
            assert.equal(code, 2, "EACCES is a declared list that cannot be read, not an absent one");
            assert.equal(calls.length, 0);
            assert.match(err + out, /seam-terms\.txt/);
        } finally {
            fs.chmodSync(at, 0o600);
        }
    });

    test("with no list anywhere, BOTH the preview and the send say nothing was scanned", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        const seen = invoke(["preview", file]);
        assert.equal(seen.code, 0);
        assert.match(seen.out, /nothing was scanned/i);

        const sent = invoke(["send", file, "--approve"]);
        assert.equal(sent.code, 0, sent.err);
        assert.match(sent.out, /nothing was scanned/i);
    });

    test("locateTerms and scan are the two halves, and scan is case-insensitive on substrings", () => {
        const dir = workspace();
        const at = path.join(dir, "terms.txt");
        fs.writeFileSync(at, "# a comment\nAcme-Widgets\n\n  \nzeta\n");
        const found = locateTerms({ flag: at, env: {}, workspaceDir: dir });
        assert.deepEqual(found.terms, ["acme-widgets", "zeta"]);
        assert.match(found.source, /--seam-terms/);

        const hits = scan([{ label: "The feedback", text: "we run ACME-WIDGETS here" }], found.terms);
        assert.deepEqual(hits, [{ term: "acme-widgets", section: "The feedback" }]);
        assert.deepEqual(scan([{ label: "x", text: "nothing to see" }], found.terms), []);
    });
});

// ===========================================================================================
// The payload carries what it says and nothing else — Done when 14, 15
// ===========================================================================================

describe("the payload is assembled from a closed list", () => {
    test("a workspace stuffed with identifying material yields a payload carrying none of it", () => {
        const dir = workspace({
            "repos/acme-core.md": "# acme-core\n\ngit@github.com:acme/acme-core.git\n",
            "memory/a-client-secret.md": "The Northwind tenant is at northwind.example.com\n",
            "gate-map.md": "# Gate map\n\nacme-internal-tracker.example.com\n",
        });
        fs.writeFileSync(
            path.join(dir, "workspace.json"),
            JSON.stringify({ portulan: { spec: "2.7" }, name: "acme-platform", kind: "repository", tree: "../" }),
        );
        const file = previewed(dir, "feedback", FILLED.feedback);
        const built = payload(parseReport(fs.readFileSync(file, "utf8")), {
            spec: "2.7",
            facts: { platform: "darwin", release: "25.6.0", arch: "arm64", node: "v22.0.0" },
        });
        const bytes = `${built.title}\n${built.body}`;
        for (const leak of ["acme", "northwind", "tracker", dir, "git@github.com", "repos/", "gate-map"]) {
            assert.ok(!bytes.toLowerCase().includes(leak.toLowerCase()), `payload leaked: ${leak}`);
        }
    });

    test("the environment block carries the five facts and the failure pair, and nothing derived from the tree", () => {
        const dir = workspace();
        const file = previewed(dir, "bug", FILLED.bug);
        let text = fs.readFileSync(file, "utf8");
        text = text.replace(/^---\n/, "---\nfailed-recipe: docs\nfailed-exit: 1\n");
        fs.writeFileSync(file, text);

        const built = payload(parseReport(text), {
            spec: "2.7",
            facts: { platform: "darwin", release: "25.6.0", arch: "arm64", node: "v22.0.0" },
        });
        assert.match(built.body, /Workspace Definition: 2\.7/);
        assert.match(built.body, /darwin 25\.6\.0 arm64/);
        assert.match(built.body, /v22\.0\.0/);
        assert.match(built.body, /docs.*exit 1|exit 1.*docs/);
        // `bug.yml` declares its own `Version or commit` field, so the environment block does not
        // repeat it — one fact, one place, inside a single payload.
        assert.match(built.body, /### Version or commit/);
        const block = built.body.slice(built.body.indexOf("### Environment"));
        assert.ok(!/Portulan: /.test(block), "the version belongs to the field that asks for it");
    });

    test("with nothing injected, every fact falls back to the real machine — none silently empty", () => {
        // The suite injects all four facts, which is right for determinism and is exactly why it could
        // not see that the un-injected `release` fell back to `""`: the shipped tool printed
        // `System: darwin arm64`, one fact short of what the block claims to carry, and no test failed.
        // Found by reading the demonstration's own output. So this case injects NOTHING and asserts the
        // shape rather than the values, which is the only assertion that can be made about a real
        // machine and the only one that would have caught it.
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        const built = payload(parseReport(fs.readFileSync(file, "utf8")), { spec: "2.7" });
        const block = built.body.slice(built.body.indexOf("### Environment"));
        assert.match(block, /\nRuntime: node v\d+\.\d+\.\d+/);
        assert.match(block, /\nSystem: \S+ \S+ \S+\n/, "platform, release and arch — three, none of them blank");
    });

    test("the host is named when given and honestly unknown when not", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        assert.match(invoke(["preview", file, "--host", "Claude Code 2.1.226"]).out, /Claude Code 2\.1\.226/);
        assert.match(invoke(["preview", file]).out, /not observable/i);
    });
});

// ===========================================================================================
// The map, the slug, and the shapes the other groups lean on
// ===========================================================================================

describe("the pieces", () => {
    test("slug is lowercase, hyphenated, and refuses to invent a name out of punctuation", () => {
        assert.equal(slug("The boot said nothing"), "the-boot-said-nothing");
        assert.equal(slug("  Two   spaces & an ampersand "), "two-spaces-an-ampersand");
        assert.equal(slug("!!! ???"), "");
    });

    test("every form declares a title prefix, at least one required section, and its acknowledgements", () => {
        for (const declared of FORMS) {
            assert.match(declared.titlePrefix, /^\[[a-z]+\] $/);
            assert.ok(declared.sections.some((s) => s.required), `${declared.kind} has no required section`);
            assert.ok(declared.acknowledgements.length >= 1, `${declared.kind} has no acknowledgements`);
            assert.ok(declared.acknowledgements.some((a) => a.required), `${declared.kind} acknowledges nothing`);
        }
    });

    test("scaffold round-trips through parseReport", () => {
        const text = scaffold("improvement", { title: "A rail for raises", created: "2026-08-10" });
        const parsed = parseReport(text);
        assert.equal(parsed.fields.kind, "improvement");
        assert.equal(parsed.fields.title, "A rail for raises");
        assert.deepEqual(
            parsed.sections.map((s) => s.label),
            form("improvement").sections.filter((s) => !s.filled).map((s) => s.label),
        );
        assert.equal(parsed.acknowledgements.length, form("improvement").acknowledgements.length);
        assert.ok(parsed.acknowledgements.every((a) => !a.ticked));
    });

    test("a report whose frontmatter names an unknown kind is could-not-run", () => {
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("kind: feedback", "kind: complaint"));
        assert.equal(invoke(["preview", file]).code, 2);
    });

    test("every write refuses in one line rather than in a stack trace", { skip: process.getuid?.() === 0 }, () => {
        // A bare `writeFileSync` on a read-only directory reached the top-level catch, which prints
        // `unanticipated failure` and a stack. The code was already 2, so this was never a fail-open —
        // it is the other half of that discipline: could-not-run has to say what could not run.
        const dir = workspace();
        fs.mkdirSync(path.join(dir, "feedback"));
        fs.chmodSync(path.join(dir, "feedback"), 0o500);
        try {
            const blocked = invoke(["draft", "feedback", "--title", "No room", "--into", dir]);
            assert.equal(blocked.code, 2);
            assert.match(blocked.err, /the report could not be written to .*No room|could not be written/);
            assert.doesNotMatch(blocked.err, /unanticipated failure/);
        } finally {
            fs.chmodSync(path.join(dir, "feedback"), 0o700);
        }
    });

    test("a send that files but cannot record the URL says so, and exits 1 rather than 0 or 2", (t) => {
        // The one write that cannot be a refusal: the issue exists by then. Reporting could-not-run
        // would deny a send that happened and send the reader back to repeat it — and the guard that
        // makes a second send a no-op is precisely what failed to land.
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        const real = fs.writeFileSync;
        t.mock.method(fs, "writeFileSync", (target, ...rest) => {
            if (target === file) {
                const error = new Error("EROFS: read-only file system");
                error.code = "EROFS";
                throw error;
            }
            return real(target, ...rest);
        });
        const { code, out, err } = invoke(["send", file, "--approve"]);
        assert.equal(code, 1, "the send happened; only the local record did not");
        assert.match(out, /FILED https:\/\/github\.com\/.*issues\/999/);
        assert.match(err, /could not be updated/);
        assert.match(err, /duplicate/);
        assert.match(err, /issue: https:\/\/github\.com\/.*issues\/999/, "it names the line to add by hand");
    });

    test("a title carrying a line break is refused at the door", () => {
        // The title is written verbatim into `title: …`, and frontmatter is one key per line. A break
        // would split it and everything after would read as another key, or as body. Refused beside the
        // failure pair, on the same door, for the same reason.
        const dir = workspace();
        for (const bad of ["Two\nlines", "Carriage\rreturn", "Both\r\nof them"]) {
            const { code, err } = invoke(["draft", "feedback", "--title", bad, "--into", dir]);
            assert.equal(code, 2, `expected a refusal for ${JSON.stringify(bad)}`);
            assert.match(err, /one line/);
        }
    });

    test("a symlink at the report path is something that is there, dangling or not", () => {
        // `statSync` follows links, so a DANGLING symlink threw ENOENT and read as *absent* — and the
        // write that followed would have resolved the link and landed outside the workspace, which is
        // how a scaffold leaves the tree it was meant to stay inside. `lstat` describes the link.
        const dir = workspace();
        fs.mkdirSync(path.join(dir, "feedback"));
        const outside = path.join(dir, "..", "escaped.md");
        fs.symlinkSync(outside, path.join(dir, "feedback", "2026-08-10-a-link.md"));
        try {
            const { code, err } = invoke(["draft", "feedback", "--title", "A link", "--into", dir]);
            assert.equal(code, 2);
            assert.match(err, /already exists/);
            assert.ok(!fs.existsSync(outside), "nothing may be written through the link");
        } finally {
            fs.rmSync(outside, { force: true });
        }
    });

    test("a report outside a workspace's feedback/ directory is could-not-run, never an unscanned send", () => {
        // The workspace — and therefore where the seam term list is looked for — is derived from the
        // report's path. Move the report and the derivation still yields *a* directory, one with no
        // term list in it, and the scan would say `nothing was scanned` about the wrong place while a
        // list sat in the workspace the report belongs to. That is a seam fail-open, so it is refused.
        const dir = workspace();
        const file = previewed(dir, "feedback", FILLED.feedback);
        fs.writeFileSync(path.join(dir, "seam-terms.txt"), "zzzz\n");

        const moved = path.join(dir, "elsewhere", path.basename(file));
        fs.mkdirSync(path.dirname(moved), { recursive: true });
        fs.copyFileSync(file, moved);

        const { code, err, calls } = invoke(["send", moved, "--approve"]);
        assert.equal(code, 2);
        assert.equal(calls.length, 0);
        assert.match(err, /feedback\/` directory|not inside a workspace/);

        // And a `feedback/` directory whose parent carries no manifest is refused for the same reason.
        const orphan = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-orphan-"));
        SCRATCH.push(orphan);
        fs.mkdirSync(path.join(orphan, "feedback"));
        const stray = path.join(orphan, "feedback", path.basename(file));
        fs.copyFileSync(file, stray);
        const second = invoke(["preview", stray]);
        assert.equal(second.code, 2);
        assert.match(second.err, /workspace\.json/);
    });

    test("--help exits 0 and a bare `feedback` exits 2", () => {
        assert.equal(invoke(["--help"]).code, 0);
        assert.equal(invoke([]).code, 2);
        assert.equal(invoke(["ship"]).code, 2);
    });
});

/**
 * The body between the preview's markers — the bytes the user is shown.
 *
 * **The opening marker is checked first, and that is the whole point.** Written as
 * `out.indexOf("\n", out.indexOf("--- body"))`, a missing marker gives `indexOf(-1)`, which JavaScript
 * treats as a search from 0 — so `start` is not `-1`, and the helper quietly returns unrelated output.
 * Every assertion that leans on this would keep passing while the preview's markers regressed: the
 * harness agreeing with the bug, in the helper that carries D3's own claim. Found by review.
 */
function between(out) {
    const opens = out.indexOf("--- body");
    const end = out.indexOf("--- end of body ---");
    if (opens === -1 || end === -1) return "";
    const start = out.indexOf("\n", opens);
    if (start === -1 || start > end) return "";
    return out.slice(start + 1, end - 1);
}
