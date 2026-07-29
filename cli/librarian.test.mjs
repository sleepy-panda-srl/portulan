// Tests for `librarian` — the scheduled pass over the curated layer.
//
// Written before the tool, per ../core/operating/verification.md: the failing test is the spec.
// Zero dependencies, node's own runner, same as ./index.test.mjs and ./doctor.test.mjs, and run by
// the same recipe.
//
//   node --test "cli/**/*.test.mjs"
//
// The suite uses REAL git repositories in scratch directories rather than an injected clock or an
// injected `git`. The whole point of this tool is that it reads history — `doctor` reads the tree and
// says so — and a fake history proves nothing about the one call this tool exists to make. `git init`
// costs a few milliseconds; the fidelity is worth it. The one thing that IS injected is the pass date
// (`asOf`), because a test asserting "90 days stale" against the wall clock would start failing on a
// date nobody chose.
//
// What this suite CANNOT establish: that a nag is worth sending. It checks that the pass dates records
// from git rather than from the filesystem, that each threshold fires at its own boundary and not
// before, that a store it cannot date is refused rather than reported on, and that the record it writes
// satisfies the rails the repository already has for a session record. Whether a maintainer is glad to
// receive it is not a property any assertion here can hold.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspect as inspectIndex } from "./index.mjs";
import {
    LibrarianError,
    parseArgs,
    daysBetween,
    sealedStamp,
    retireWhen,
    proposalPending,
    passWorkspace,
    renderRecord,
    renderLogEntry,
    run,
} from "./librarian.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// One exit handler for every scratch directory — the per-directory form exceeds node's default ten
// listeners partway through a suite this size, which ./doctor.test.mjs learned in review and
// ./index.test.mjs inherited.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-librarian-"));
    SCRATCH.push(dir);
    return dir;
}

const git = (cwd, ...args) =>
    execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        env: {
            ...process.env,
            GIT_AUTHOR_NAME: "Test",
            GIT_AUTHOR_EMAIL: "test@example.invalid",
            GIT_COMMITTER_NAME: "Test",
            GIT_COMMITTER_EMAIL: "test@example.invalid",
        },
    });

/** Write a tree described as { "relative/path": "contents" }. */
function tree(dir, files) {
    for (const [rel, body] of Object.entries(files)) {
        const target = path.join(dir, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, body);
    }
    return dir;
}

/**
 * A scratch git repository whose files carry chosen AUTHOR dates.
 *
 * `files` maps a path to `[contents, "YYYY-MM-DD"]`. Each date becomes its own commit, oldest first,
 * so `git log -1 --format=%as -- <path>` returns exactly the date the test asked for. Author date
 * rather than committer date throughout, and the tool matches: this repository rebases constantly,
 * which rewrites every committer date and leaves author dates alone, so committer date would report
 * "everything was touched on the day of the last rebase".
 */
function repo(files, { workspace = null, at = ".portulan" } = {}) {
    const dir = scratch();
    git(dir, "init", "-q", "-b", "main");
    if (workspace) tree(dir, { [`${at}/workspace.json`]: JSON.stringify(workspace, null, 2) });

    const byDate = new Map();
    for (const [rel, [body, date]] of Object.entries(files)) {
        if (!byDate.has(date)) byDate.set(date, {});
        byDate.get(date)[rel] = body;
    }
    const dates = [...byDate.keys()].sort();
    // The manifest rides the first commit so it is dated too; a workspace whose own manifest git has
    // never seen is a different test, below.
    let first = true;
    for (const date of dates) {
        tree(dir, byDate.get(date));
        git(dir, "add", "-A");
        git(dir, "commit", "-q", "--date", `${date}T12:00:00Z`, "-m", `records of ${date}`);
        first = false;
    }
    if (first && workspace) {
        git(dir, "add", "-A");
        git(dir, "commit", "-q", "--date", "2026-01-01T12:00:00Z", "-m", "manifest only");
    }
    return dir;
}

// Only the slots a test actually populates. A declared slot with no directory behind it is a
// `doctor` failure — it validates that every declared path resolves — and this pass refuses it too
// rather than reading an absent store as an empty one, which is the enumeration fail-open
// ../.portulan/memory/verify-preconditions-fail-closed.md was minted from. Declaring slots the
// fixture does not create would therefore have every test in this file failing for that one reason.
const MANIFEST = (extra = {}) => ({
    portulan: { spec: "2.4" },
    name: "scratch",
    kind: "repository",
    slots: { memory: "memory/" },
    ...extra,
});

const WITH_PROPOSALS = (extra = {}) => {
    const m = MANIFEST(extra);
    return { ...m, slots: { ...m.slots, proposals: "proposals/" } };
};

const STALENESS = { record_days: 90, sealed_days: 180, proposal_days: 30 };

const linked = (fact = "A rule.") =>
    `**type:** rule\n**scope:** workspace\n**provenance:** \`form=link\` \`href=../handoffs/x.md\`\n\n${fact}\n\n**Retire when:** the thing is deleted.\n`;

const sealed = (owner = "Marius Cetanas", date = "2026-01-01") =>
    `**type:** rule\n**scope:** workspace\n**provenance:** \`form=sealed\` \`owner=${owner}\` \`date=${date}\` \`shape=the obvious guard misses\`\n\nA sealed rule.\n\n**Retire when:** the owner says it cannot recur.\n`;

// ===========================================================================================
// The pure parts
// ===========================================================================================

describe("daysBetween", () => {
    test("counts whole days between two ISO dates", () => {
        assert.equal(daysBetween("2026-01-01", "2026-01-01"), 0);
        assert.equal(daysBetween("2026-01-01", "2026-01-02"), 1);
        assert.equal(daysBetween("2026-01-01", "2026-04-01"), 90);
    });

    test("crosses a leap day without drifting", () => {
        assert.equal(daysBetween("2024-02-28", "2024-03-01"), 2);
    });

    test("is negative when the record is dated after the pass", () => {
        // A record dated in the future is a clock or a fabricated date, not a stale record. The pass
        // must not silently read it as "0 days old" — the sign is the signal.
        assert.equal(daysBetween("2026-02-01", "2026-01-01"), -31);
    });

    test("refuses a date it cannot parse rather than returning NaN", () => {
        assert.throws(() => daysBetween("last Tuesday", "2026-01-01"), LibrarianError);
        assert.throws(() => daysBetween("2026-01-01", "2026-13-45"), LibrarianError);
    });
});

describe("sealedStamp", () => {
    test("reads owner and date off a sealed rule", () => {
        assert.deepEqual(sealedStamp(sealed("Ada", "2025-06-01")), { owner: "Ada", date: "2025-06-01" });
    });

    test("returns null for a linked rule — there is nobody to nag", () => {
        assert.equal(sealedStamp(linked()), null);
    });

    test("returns null for a record with no provenance at all", () => {
        assert.equal(sealedStamp("**type:** rule\n\nNothing.\n"), null);
    });

    test("a sealed stamp missing its date is refused, not skipped", () => {
        // Skipping it would drop the one record that most needs the nag, silently. `doctor` fails a
        // malformed stamp on a rule; this pass cannot date one, so it refuses to judge the store.
        const source = "**type:** rule\n**provenance:** `form=sealed` `owner=Ada` `shape=x`\n\nA rule.\n";
        assert.throws(() => sealedStamp(source), LibrarianError);
    });

    test("only `type: rule` seals are nagged — thesis 4 is rule-scoped", () => {
        const decision = sealed().replace("**type:** rule", "**type:** decision");
        assert.equal(sealedStamp(decision), null);
    });
});

describe("retireWhen", () => {
    test("returns the condition verbatim, minus the field label", () => {
        assert.equal(retireWhen(linked()), "the thing is deleted.");
    });

    test("returns null when no condition is stated", () => {
        assert.equal(retireWhen("**type:** rule\n\nA rule with no exit.\n"), null);
    });

    test("prose that merely discusses retiring is not a condition", () => {
        // The same anchoring `doctor` uses: the bolded field at line start, never a mention.
        assert.equal(retireWhen("**type:** rule\n\nWe should retire when bored.\n"), null);
    });

    test("a condition wrapping onto a second line is carried whole", () => {
        const source = "**type:** rule\n\n**Retire when:** the generated client is deleted\nand nothing imports it.\n";
        assert.equal(retireWhen(source), "the generated client is deleted and nothing imports it.");
    });
});

describe("proposalPending", () => {
    test("a decision of `pending` is pending", () => {
        assert.equal(proposalPending("**Decision.** Marius Cetanas — pending.\n"), true);
    });

    test("accepted, rejected and revised are settled", () => {
        assert.equal(proposalPending("**Decision.** Marius Cetanas — accepted, on 2026-07-25 — because.\n"), false);
        assert.equal(proposalPending("**Decision.** M — rejected, on 2026-07-25 — because.\n"), false);
        assert.equal(proposalPending("**Decision.** M — revised, on 2026-07-25 — because.\n"), false);
    });

    test("a proposal with no decision line at all is pending — absence is not consent", () => {
        assert.equal(proposalPending("# Proposal 0001 — a thing\n\nBody.\n"), true);
    });

    test("the template's own placeholder is pending, not accepted", () => {
        assert.equal(proposalPending("**Decision.** {human owner} — accepted | rejected | revised, on {date}.\n"), true);
    });
});

// ===========================================================================================
// The pass — dating from git
// ===========================================================================================

describe("passWorkspace — the age half of the store report", () => {
    test("dates each record from git, not from the filesystem", () => {
        const dir = repo(
            {
                ".portulan/memory/old-rule.md": [linked(), "2026-01-01"],
                ".portulan/memory/new-rule.md": [linked(), "2026-06-01"],
            },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        // Touch the file so its mtime is now: a pass reading the filesystem would call it fresh.
        fs.utimesSync(path.join(dir, ".portulan/memory/old-rule.md"), new Date(), new Date());

        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        const ages = Object.fromEntries(result.records.map((r) => [r.file, r.lastTouched]));
        assert.equal(ages["old-rule.md"], "2026-01-01");
        assert.equal(ages["new-rule.md"], "2026-06-01");
    });

    test("flags a record older than record_days and leaves the rest alone", () => {
        const dir = repo(
            {
                ".portulan/memory/old-rule.md": [linked(), "2026-01-01"],
                ".portulan/memory/new-rule.md": [linked(), "2026-06-01"],
            },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.deepEqual(
            result.stale.map((r) => r.file),
            ["old-rule.md"],
        );
    });

    test("the threshold fires ON the boundary, not a day early", () => {
        const dir = repo(
            { ".portulan/memory/r.md": [linked(), "2026-01-01"] },
            { workspace: MANIFEST({ librarian: { staleness: { record_days: 90 } } }) },
        );
        const at89 = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-03-31" });
        const at90 = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-04-01" });
        assert.equal(at89.stale.length, 0, "89 days is not stale");
        assert.equal(at90.stale.length, 1, "90 days is stale");
    });

    test("an undeclared record_days reports ages and flags nothing", () => {
        const dir = repo(
            { ".portulan/memory/ancient.md": [linked(), "2020-01-01"] },
            { workspace: MANIFEST({ librarian: { staleness: {} } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.records.length, 1);
        assert.equal(result.records[0].lastTouched, "2020-01-01");
        assert.equal(result.stale.length, 0, "nothing declared, nothing flagged");
    });

    test("the store's README is not a record here either", () => {
        const dir = repo(
            {
                ".portulan/memory/r.md": [linked(), "2026-06-01"],
                ".portulan/memory/README.md": ["# The store\n", "2020-01-01"],
            },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.deepEqual(
            result.records.map((r) => r.file),
            ["r.md"],
        );
    });
});

describe("passWorkspace — the sealed-stamp re-validation nag", () => {
    test("nags the owner named on the stamp once the interval has passed", () => {
        const dir = repo(
            { ".portulan/memory/s.md": [sealed("Ada", "2025-06-01"), "2026-06-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.seals.length, 1);
        assert.equal(result.seals[0].owner, "Ada");
        assert.equal(result.seals[0].due, true);
    });

    test("dates the nag from the STAMP, not from the file's last commit", () => {
        // The stamp's date is when the incident was sealed; the file's date is when someone last
        // edited the prose. Re-validation is owed on the incident, so a typo fix must not reset it.
        const dir = repo(
            { ".portulan/memory/s.md": [sealed("Ada", "2025-06-01"), "2026-06-14"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.seals[0].due, true, "a fresh commit does not re-validate a stale seal");
    });

    test("a seal inside its interval is listed and not due", () => {
        const dir = repo(
            { ".portulan/memory/s.md": [sealed("Ada", "2026-06-01"), "2026-06-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.seals.length, 1);
        assert.equal(result.seals[0].due, false);
    });

    test("a store with no sealed rules reports zero rather than staying silent", () => {
        // The live `.portulan/memory/` has none. "Nothing to nag" and "did not look" must not print
        // the same way — the argument `doctor`'s always-emitted store line already makes.
        const dir = repo(
            { ".portulan/memory/r.md": [linked(), "2026-06-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.deepEqual(result.seals, []);
        assert.equal(result.counts.sealed, 0);
        assert.equal(result.counts.rules, 1);
    });
});

describe("passWorkspace — proposal nagging", () => {
    const proposal = (decision) => `# Proposal 0001 — a thing\n\nBody.\n\n**Decision.** Marius Cetanas — ${decision}\n`;

    test("nags a pending proposal past the interval, dated from git", () => {
        const dir = repo(
            {
                ".portulan/proposals/0001-a.md": [proposal("pending."), "2026-01-01"],
                ".portulan/proposals/0002-b.md": [proposal("accepted, on 2026-06-01 — because."), "2026-01-01"],
                ".portulan/proposals/0003-c.md": [proposal("pending."), "2026-06-10"],
                ".portulan/memory/r.md": [linked(), "2026-06-01"],
            },
            { workspace: WITH_PROPOSALS({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.deepEqual(
            result.proposals.filter((p) => p.due).map((p) => p.file),
            ["0001-a.md"],
        );
        assert.equal(result.proposals.length, 3, "settled proposals are still counted, just not due");
    });

    test("a workspace with no proposals slot skips the pass without failing", () => {
        const dir = repo(
            { ".portulan/memory/r.md": [linked(), "2026-06-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.proposals, null, "null is `not asked`, which is not the same as `none pending`");
    });
});

describe("passWorkspace — demotion drafts", () => {
    test("drafts a candidate carrying its condition verbatim and its evidence", () => {
        const dir = repo(
            { ".portulan/memory/old.md": [linked(), "2026-01-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.drafts.length, 1);
        assert.equal(result.drafts[0].condition, "the thing is deleted.");
        assert.equal(result.drafts[0].lastTouched, "2026-01-01");
    });

    test("a record stating no condition is a draft of a different kind, and is separated", () => {
        const dir = repo(
            {
                ".portulan/memory/no-exit.md": ["**type:** rule\n**provenance:** `form=link` `href=x`\n\nA rule.\n", "2026-01-01"],
            },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.drafts.length, 1);
        assert.equal(result.drafts[0].condition, null);
        assert.match(result.drafts[0].recommendation, /state a retirement condition/i);
    });

    test("the draft never claims the condition fired", () => {
        // The librarian cannot evaluate a condition — vision thesis 4 says so in as many words. A
        // draft that asserted otherwise would be the tool exceeding its own charter in the artifact
        // the maintainer reads.
        const dir = repo(
            { ".portulan/memory/old.md": [linked(), "2026-01-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.doesNotMatch(result.drafts[0].recommendation, /\b(has fired|no longer applies|retire it)\b/i);
        assert.match(result.drafts[0].recommendation, /judge|decide|cannot/i);
    });

    test("a fresh record is not drafted for demotion", () => {
        const dir = repo(
            { ".portulan/memory/new.md": [linked(), "2026-06-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.deepEqual(result.drafts, []);
    });
});

// ===========================================================================================
// Refusing what it cannot check
// ===========================================================================================

describe("passWorkspace — refusals", () => {
    test("a shallow repository is refused, never reported on", () => {
        // In a shallow clone `git log -1 -- <path>` returns nothing for a file whose only commit was
        // truncated away, so every record would read as undated and every threshold would fire or
        // none would. Either way the verdict describes the checkout, not the store. This is the
        // false-red generator ../.portulan/verify/README.md holds to be worse than no check at all.
        const dir = repo(
            { ".portulan/memory/r.md": [linked(), "2026-01-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        fs.writeFileSync(path.join(dir, ".git", "shallow"), "");
        assert.throws(() => passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" }), (e) => {
            assert.ok(e instanceof LibrarianError);
            assert.match(e.message, /shallow/i);
            return true;
        });
    });

    test("a directory git has never seen is refused", () => {
        const dir = scratch();
        tree(dir, {
            ".portulan/workspace.json": JSON.stringify(MANIFEST({ librarian: { staleness: STALENESS } })),
            ".portulan/memory/r.md": linked(),
        });
        assert.throws(() => passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" }), (e) => {
            assert.ok(e instanceof LibrarianError);
            assert.match(e.message, /git/i);
            return true;
        });
    });

    test("an uncommitted record is undated and never stale, and the count says so", () => {
        // This is not the fail-open it looks like, and the distinction cost an hour: a file git has
        // never seen is not *undatable*, it is NEW. Nothing in the history this pass reads is older
        // than a file's absence from that history, so age 0 is the precise answer rather than a
        // guess. The first draft refused instead — and the first thing it refused was a proposal
        // this session had written and not yet committed, which turned `tests.sh` red on a correct
        // tree and made a verify recipe depend on git history. That is the one thing the split
        // between this pass and the recipes exists to prevent.
        const dir = repo(
            { ".portulan/memory/r.md": [linked(), "2026-01-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        fs.writeFileSync(path.join(dir, ".portulan/memory/uncommitted.md"), linked());

        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        const fresh = result.records.find((r) => r.file === "uncommitted.md");
        assert.equal(fresh.lastTouched, null, "reported as undated, never as a date git did not give");
        assert.equal(fresh.days, 0);
        assert.equal(result.counts.uncommitted, 1);
        assert.deepEqual(
            result.stale.map((r) => r.file),
            ["r.md"],
            "the uncommitted record is not stale; the genuinely old one still is",
        );
        assert.match(renderRecord([result], { asOf: "2026-06-15" }), /not yet committed/);
    });

    test("a STAGED record is uncommitted too — tracking is the wrong question", () => {
        // The state between the two the fix above separated, and it broke the fix: `git add` makes a
        // file tracked while leaving it with no commit, so a test on *tracking* refuses exactly the
        // session that staged its work before running the pass. `HEAD` is the question that has one
        // answer for all three states. Found by running the pass against a staged tree, minutes after
        // the untracked case was fixed by running it against an unstaged one.
        const dir = repo(
            { ".portulan/memory/r.md": [linked(), "2026-01-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        fs.writeFileSync(path.join(dir, ".portulan/memory/staged.md"), linked());
        git(dir, "add", "-A");

        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.records.find((r) => r.file === "staged.md").lastTouched, null);
        assert.equal(result.counts.uncommitted, 1);
    });

    test("a threshold that is not a positive integer is refused, not read as absent", () => {
        for (const bad of [0, -1, 1.5, "90", null]) {
            const dir = repo(
                { ".portulan/memory/r.md": [linked(), "2026-01-01"] },
                { workspace: MANIFEST({ librarian: { staleness: { record_days: bad } } }) },
            );
            assert.throws(
                () => passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" }),
                LibrarianError,
                `record_days: ${JSON.stringify(bad)} must be refused`,
            );
        }
    });

    test("a manifest declaring a spec this tool does not implement is refused", () => {
        const dir = repo(
            { ".portulan/memory/r.md": [linked(), "2026-01-01"] },
            { workspace: { ...MANIFEST({ librarian: { staleness: STALENESS } }), portulan: { spec: "9.9" } } },
        );
        assert.throws(() => passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" }), LibrarianError);
    });

    test("a `librarian` object with no `slots.memory` to read is refused", () => {
        const dir = repo(
            { ".portulan/other/r.md": [linked(), "2026-01-01"] },
            { workspace: { ...MANIFEST({ librarian: { staleness: STALENESS } }), slots: { proposals: "proposals/" } } },
        );
        assert.throws(() => passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" }), LibrarianError);
    });

    test("a workspace declaring no `librarian` object is skipped, not failed", () => {
        const dir = repo({ ".portulan/memory/r.md": [linked(), "2026-01-01"] }, { workspace: MANIFEST() });
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.declared, false);
    });
});

// ===========================================================================================
// The record the pass writes
// ===========================================================================================

describe("renderRecord", () => {
    const passOf = (files, extra = {}) => {
        const dir = repo(files, { workspace: MANIFEST({ librarian: { staleness: STALENESS }, ...extra }) });
        return { dir, result: passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" }) };
    };

    test("is a handoff in the shape the repository's own rail enumerates", () => {
        const { result } = passOf({ ".portulan/memory/r.md": [linked(), "2026-06-01"] });
        const text = renderRecord([result], { asOf: "2026-06-15" });
        assert.match(text, /^# Handoff — /m);
        assert.match(text, /\*\*Date:\*\* 2026-06-15/);
    });

    test("states the pass date on every claim, so a stale record reads as of when it ran", () => {
        const { result } = passOf({ ".portulan/memory/r.md": [linked(), "2026-06-01"] });
        const text = renderRecord([result], { asOf: "2026-06-15" });
        assert.match(text, /as of 2026-06-15/i);
    });

    test("reports an unfired threshold as unfired rather than omitting the section", () => {
        const { result } = passOf({ ".portulan/memory/r.md": [linked(), "2026-06-01"] });
        const text = renderRecord([result], { asOf: "2026-06-15" });
        assert.match(text, /nothing/i);
        assert.match(text, /sealed/i, "the sealed section is present even at zero seals");
    });

    test("carries no unindented dated bullet — issue #79's parser reads one as a new log entry", () => {
        const { result } = passOf({ ".portulan/memory/r.md": [linked(), "2026-06-01"] });
        const text = renderRecord([result], { asOf: "2026-06-15" });
        for (const line of text.split("\n")) {
            assert.doesNotMatch(line, /^- 2[0-9]{3}-/, `unindented dated bullet: ${line}`);
        }
    });
});

describe("renderLogEntry", () => {
    const entryOf = () => {
        const dir = repo(
            { ".portulan/memory/r.md": [linked(), "2026-06-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        return renderLogEntry([result], { asOf: "2026-06-15", handoff: "2026-06-15-librarian-pass.md" });
    };

    test("opens with the shape the record check enumerates entries by", () => {
        assert.match(entryOf(), /^- 2026-06-15 · /);
    });

    test("is within the ten-line budget that binds every entry dated after the cutoff", () => {
        const lines = entryOf().replace(/\n+$/, "").split("\n").length;
        assert.ok(lines <= 10, `entry is ${lines} lines`);
    });

    test("carries a seam attestation the record check can read", () => {
        // The exact grep `.portulan/verify/docs.sh` runs, including the `[[:space:]]+` fix: the words
        // adjacent, `clean` within 120 characters containing no full stop.
        const joined = entryOf().replace(/\n/g, " ");
        assert.match(joined, /seam\s+scan[^.]{0,120}clean/i);
    });

    test("links the handoff it was written beside", () => {
        assert.match(entryOf(), /2026-06-15-librarian-pass\.md/);
    });

    test("has exactly one unindented dated bullet — its own opening line", () => {
        const opens = entryOf().split("\n").filter((l) => /^- 2[0-9]{3}-/.test(l));
        assert.equal(opens.length, 1);
    });
});

// ===========================================================================================
// The command
// ===========================================================================================

describe("run", () => {
    const say = () => {
        const lines = [];
        const fn = (s) => lines.push(s);
        fn.lines = lines;
        return fn;
    };

    test("with no arguments it explains itself and exits 2", () => {
        const out = say();
        assert.equal(run([], out), 2);
        assert.match(out.lines.join("\n"), /usage/i);
    });

    test("a pass over a healthy workspace exits 0", () => {
        const dir = repo(
            { ".portulan/memory/r.md": [linked(), "2026-06-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        assert.equal(run(["--as-of", "2026-06-15", path.join(dir, ".portulan")], say()), 0);
    });

    test("a pass WITH findings still exits 0 — this tool renders no verdict", () => {
        // The distinction from `doctor`, `index` and `compile`, and it is deliberate: those are
        // checkers and 1 means red. A nag is not a failure, and a workflow that treated it as one
        // would turn every stale record into a broken build.
        const dir = repo(
            { ".portulan/memory/old.md": [linked(), "2026-01-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const out = say();
        assert.equal(run(["--as-of", "2026-06-15", path.join(dir, ".portulan")], out), 0);
        assert.match(out.lines.join("\n"), /1 stale/i);
    });

    test("the summary says so when it regenerated an index", () => {
        // The round-three fix renamed `drifted` to `regenerated` and missed this one site, so the
        // branch became dead: the summary could never say it had regenerated anything. Found by
        // Copilot on #81 in round four — a loose end in the fix rather than new feedback on old code,
        // which is why it was finished rather than filed. A rename with no test on the renamed branch
        // is how a field goes quietly unread.
        const m = MANIFEST({ librarian: { staleness: STALENESS }, memory: { index: { path: "memory-index.md" } } });
        m.slots.handoffs = "handoffs/";
        const dir = repo(
            { ".portulan/memory/r.md": [linked(), "2026-06-01"], ".portulan/handoffs/2026-06-01-x.md": ["x\n", "2026-06-01"] },
            { workspace: m },
        );
        const out = say();
        assert.equal(run(["--as-of", "2026-06-15", "--write", path.join(dir, ".portulan")], out), 0);
        assert.match(out.lines.join("\n"), /index regenerated/);
    });

    test("a workspace with no proposals slot does not crash the summary", () => {
        // Copilot read `result.proposals?.filter(...).length ?? 0` as throwing when `proposals` is
        // null. It does not: optional chaining short-circuits the WHOLE member chain, so the
        // expression is `undefined` and `?? 0` catches it. Measured rather than argued, and asserted
        // here so the next reader does not have to re-derive it — `examples` declares no
        // `slots.proposals` and takes this path on every real run.
        const dir = repo({ ".portulan/memory/r.md": [linked(), "2026-06-01"] }, { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) });
        const out = say();
        assert.equal(run(["--as-of", "2026-06-15", path.join(dir, ".portulan")], out), 0);
        assert.match(out.lines.join("\n"), /0 proposal\(s\) nagged/);
    });

    test("a refusal exits 2 and names what it could not do", () => {
        const dir = scratch();
        const out = say();
        assert.equal(run(["--as-of", "2026-06-15", path.join(dir, "nowhere")], out), 2);
        assert.match(out.lines.join("\n"), /✗/);
    });

    test("an unknown option is refused, not dropped", () => {
        // Dropping it is the fail-open Copilot found on #81: `--wrtie` produced a run that reported
        // everything it found and wrote nothing, with a success message over work that did not happen.
        const dir = repo({ ".portulan/memory/r.md": [linked(), "2026-06-01"] }, { workspace: MANIFEST() });
        const out = say();
        assert.equal(run(["--wrtie", path.join(dir, ".portulan")], out), 2);
        assert.match(out.lines.join("\n"), /unknown option/);
    });

    test("a value-bearing flag with no value is refused rather than swallowing a flag", () => {
        assert.throws(() => parseArgs(["--as-of"]), LibrarianError);
        assert.throws(() => parseArgs(["--log"]), LibrarianError);
        assert.throws(() => parseArgs(["--log", "--write", "a"]), LibrarianError);
    });

    test("and where the grammar cannot help, the empty workspace list does", () => {
        // `--log .portulan` is not detectable at parse time — `.portulan` is a perfectly good value,
        // and any `--flag value` grammar consumes it. What catches the caller who meant it as a
        // workspace is the check one layer up: no workspaces left, so nothing is examined and the run
        // says so and exits 2 rather than reporting a green over an empty list. Asserted because it is
        // the *only* thing standing between that typo and a pass that examined nothing.
        const out = say();
        assert.equal(run(["--log", ".portulan"], out), 2);
        assert.match(out.lines.join("\n"), /usage/);
    });

    test("the flags it does understand still parse, in any order", () => {
        assert.deepEqual(parseArgs(["--as-of", "2026-06-15", "--write", "--log", "docs/plan.md", "--reviews", "r.json", "a", "b"]), {
            asOf: "2026-06-15",
            logPath: "docs/plan.md",
            reviewsPath: "r.json",
            write: true,
            dirs: ["a", "b"],
        });
        assert.deepEqual(parseArgs(["a", "--write"]), {
            asOf: undefined,
            logPath: undefined,
            reviewsPath: undefined,
            write: true,
            dirs: ["a"],
        });
    });

    test("`--reviews` needs a value, and a flag is not one", () => {
        // The same trap `--log` was measured to have: without this, `--reviews --write` sets the path
        // to `--write` and drops the mode, and the pass then reports *not asked* about a corpus it was
        // handed — a fail-open with a flag in front of it.
        assert.throws(() => parseArgs(["--reviews"]), LibrarianError);
        assert.throws(() => parseArgs(["--reviews", "--write", "a"]), LibrarianError);
    });

    test("`--as-of` must be a date, not a word", () => {
        const dir = repo({ ".portulan/memory/r.md": [linked(), "2026-06-01"] }, { workspace: MANIFEST() });
        assert.equal(run(["--as-of", "today", path.join(dir, ".portulan")], say()), 2);
    });

    test("one refused workspace does not hide the others' findings", () => {
        const good = repo(
            { ".portulan/memory/old.md": [linked(), "2026-01-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const out = say();
        const code = run(["--as-of", "2026-06-15", path.join(good, ".portulan"), path.join(good, "nowhere")], out);
        assert.equal(code, 2, "the run could not do what it was asked");
        assert.match(out.lines.join("\n"), /1 stale/i, "and still reported what it could");
    });
});

// ===========================================================================================
// The live workspaces
// ===========================================================================================
//
// The suite is the rail here, in the way ./index.test.mjs binds both live indexes: this repository's
// own store must stay passable by the tool that will run against it weekly, and the demo workspace
// must keep the one sealed record the nag exists for.

// ===========================================================================================
// The live workspaces
// ===========================================================================================
//
// **These must run in a SHALLOW checkout**, and the first draft did not — which made this suite red
// in CI on the pull request that introduced it. `.github/workflows/verify.yml` checks out with
// `actions/checkout`'s default depth of 1, `passWorkspace` refuses a shallow repository outright, and
// `tests.sh` is a verify recipe. So the suite would have failed `workspace-verify` — required by the
// floor — on this change and on every change after it, over a store that was perfectly fine.
//
// That is this file's own rule turned on itself: *a check that reads history is a false-red generator
// in a shallow CI checkout*, which is exactly why the staleness pass is a scheduled job and not a
// recipe. Writing the rule down did not stop the suite from breaking it.
//
// So the live bindings are split by what they need. What can be established from the **tree** is
// asserted from the tree, with no git at all — the demo workspace's one sealed rule is a fact about
// four files. What genuinely needs history asserts the honest outcome for the checkout it is in:
// the pass where history exists, the refusal where it does not. Skipping in CI was the other option
// and is worse — a binding that stops binding exactly where nobody is watching.

describe("the live workspaces", () => {
    const REPO_ROOT = path.resolve(HERE, "..");
    const shallow = execFileSync("git", ["-C", REPO_ROOT, "rev-parse", "--is-shallow-repository"], {
        encoding: "utf8",
    }).trim() === "true";

    /** Every record in a live store, read without asking git anything. */
    const storeOf = (workspaceDir, slot) => {
        const dir = path.join(REPO_ROOT, workspaceDir, slot);
        return fs
            .readdirSync(dir)
            .filter((f) => f.endsWith(".md") && f !== "README.md")
            .map((f) => fs.readFileSync(path.join(dir, f), "utf8"));
    };

    test("the demo workspace keeps exactly one sealed rule — the nag's only live subject", () => {
        assert.equal(storeOf("examples", "memory").filter((s) => sealedStamp(s) !== null).length, 1);
    });

    test("this repository has no sealed rules, so the nag's live subject is elsewhere", () => {
        // Not a defect and not an aspiration: every rule here links a public incident, so retirement
        // in this store can rest on evidence rather than on asking anyone. It is asserted because the
        // day it changes is the day the sealed proportion `doctor` reports starts mattering here.
        assert.equal(storeOf(".portulan", "memory").filter((s) => sealedStamp(s) !== null).length, 0);
    });

    test("every live sealed stamp carries a date the pass can nag against", () => {
        // `sealedStamp` throws on a sealed rule with no `date=`. Binding both stores to that here
        // means a future sealed record lands with the field the nag needs, or this goes red.
        for (const dir of [".portulan", "examples"]) {
            for (const source of storeOf(dir, "memory")) assert.doesNotThrow(() => sealedStamp(source));
        }
    });

    test(
        shallow
            ? "in a shallow checkout the pass refuses this repository rather than reporting on it"
            : "this repository's workspace declares a librarian and can be passed",
        () => {
            const run = () => passWorkspace(path.join(REPO_ROOT, ".portulan"), { asOf: today() });
            if (shallow) {
                assert.throws(run, (e) => {
                    assert.ok(e instanceof LibrarianError);
                    assert.match(e.message, /shallow/i);
                    return true;
                });
                return;
            }
            const result = run();
            assert.equal(result.declared, true);
            assert.ok(result.records.length > 0);
            assert.equal(result.counts.sealed, 0);
        },
    );
});

function today() {
    return new Date().toISOString().slice(0, 10);
}

// ===========================================================================================
// The handoff series — reported, never railed
// ===========================================================================================

const WITH_HANDOFFS = (extra = {}) => {
    const m = MANIFEST(extra);
    return { ...m, slots: { ...m.slots, handoffs: "handoffs/" } };
};

const pass = (name, body = "What happened.") => `# Handoff — ${name}\n\n${body}\n`;

describe("passWorkspace — the handoff series", () => {
    test("reports count, oldest and size, and drafts nothing", () => {
        // The row that added this clause bars a budget on the series and gives the reason: a handoff
        // series is append-only, so consolidation — the one remedy a budget may ask for — would mean
        // deleting the record the series exists to keep. A staleness THRESHOLD has the same problem
        // one layer down: `record_days` drafts a demotion, and a demotion draft against an
        // append-only series recommends exactly that deletion, weekly, forever.
        const dir = repo(
            {
                ".portulan/memory/a-fact.md": [linked(), "2026-06-01"],
                ".portulan/handoffs/2026-01-10-old.md": [pass("Old"), "2026-01-10"],
                ".portulan/handoffs/2026-06-01-new.md": [pass("New"), "2026-06-01"],
            },
            { workspace: WITH_HANDOFFS({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.handoffs.declared, true);
        assert.equal(result.handoffs.count, 2);
        assert.equal(result.handoffs.oldest.file, "2026-01-10-old.md");
        assert.equal(result.handoffs.oldest.days, 156);
        assert.ok(result.handoffs.bytes > 0);
        // The store's own drafts are untouched by the series: nothing here adds to them.
        assert.deepEqual(result.drafts.map((d) => d.file), []);
    });

    test("a handoff older than record_days is not stale, because the threshold does not reach here", () => {
        const dir = repo(
            {
                ".portulan/memory/a-fact.md": [linked(), "2026-06-01"],
                ".portulan/handoffs/2020-01-01-ancient.md": [pass("Ancient"), "2020-01-01"],
            },
            { workspace: WITH_HANDOFFS({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.stale.length, 0);
        assert.equal(result.drafts.length, 0);
        assert.equal(result.handoffs.oldest.file, "2020-01-01-ancient.md");
    });

    test("a workspace with no handoffs slot reports *not declared*, not *empty*", () => {
        const dir = repo({ ".portulan/memory/a-fact.md": [linked(), "2026-06-01"] }, { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) });
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.handoffs.declared, false);
        assert.equal(result.handoffs.count, null);
    });
});

// ===========================================================================================
// Mining
// ===========================================================================================

describe("passWorkspace — mining incidents", () => {
    test("counts the whole series and lists only what the window holds", () => {
        // The ratio is the trend and never becomes noise; the LIST is scoped, because a list of every
        // uncodified incident is the same 25 lines every week for a series that only grows.
        const dir = repo(
            {
                ".portulan/memory/a-fact.md": [
                    "**type:** rule\n**scope:** workspace\n**provenance:** `form=link` `href=../handoffs/2026-01-10-old.md`\n\nA rule.\n\n**Retire when:** never.\n",
                    "2026-06-01",
                ],
                ".portulan/handoffs/2026-01-10-old.md": [pass("Old"), "2026-01-10"],
                ".portulan/handoffs/2026-06-01-recent.md": [pass("Recent"), "2026-06-01"],
            },
            { workspace: WITH_HANDOFFS({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.mining.incidents.total, 2);
        assert.equal(result.mining.incidents.linked, 1);
        assert.deepEqual(result.mining.incidents.candidates.map((c) => c.file), ["2026-06-01-recent.md"]);
    });

    test("the window is everything after the newest pass record, once one exists", () => {
        const dir = repo(
            {
                ".portulan/memory/a-fact.md": [linked(), "2026-06-01"],
                ".portulan/handoffs/2026-01-10-before.md": [pass("Before"), "2026-01-10"],
                ".portulan/handoffs/2026-03-01-librarian-pass.md": [pass("The librarian's scheduled pass"), "2026-03-01"],
                ".portulan/handoffs/2026-06-01-after.md": [pass("After"), "2026-06-01"],
            },
            { workspace: WITH_HANDOFFS({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.mining.incidents.since, "2026-03-01");
        assert.deepEqual(result.mining.incidents.candidates.map((c) => c.file), ["2026-06-01-after.md"]);
    });

    test("a linked incident inside the window is not a candidate", () => {
        const dir = repo(
            {
                ".portulan/memory/a-fact.md": [
                    "**type:** rule\n**scope:** workspace\n**provenance:** `form=link` `href=../handoffs/2026-06-01-recent.md`\n\nA rule.\n\n**Retire when:** never.\n",
                    "2026-06-02",
                ],
                ".portulan/handoffs/2026-06-01-recent.md": [pass("Recent"), "2026-06-01"],
            },
            { workspace: WITH_HANDOFFS({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.deepEqual(result.mining.incidents.candidates, []);
    });

    test("a proposal linking an incident counts as codified too", () => {
        // Measured on the real tree before it was written: a rule minted by one session took its
        // provenance from the PROPOSAL that session filed rather than from the handoff, so a query
        // that read only memory records called that incident uncodified. The finding it produces is
        // still real — nothing points back to the session — but it is a different finding, and the
        // candidate's wording says which.
        const dir = repo(
            {
                ".portulan/memory/a-fact.md": [linked(), "2026-06-01"],
                ".portulan/proposals/0001-a-thing.md": [
                    "# 0001 — A thing\n\nSee `../handoffs/2026-06-01-recent.md`.\n\n**Decision.** pending\n",
                    "2026-06-02",
                ],
                ".portulan/handoffs/2026-06-01-recent.md": [pass("Recent"), "2026-06-01"],
            },
            {
                workspace: (() => {
                    const m = WITH_HANDOFFS({ librarian: { staleness: STALENESS } });
                    return { ...m, slots: { ...m.slots, proposals: "proposals/" } };
                })(),
            },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.mining.incidents.linked, 1);
        assert.deepEqual(result.mining.incidents.candidates, []);
    });
});

describe("passWorkspace — mining pull-request reviews", () => {
    const comment = (pull, filePath, replyTo = null, at = "2026-06-10T00:00:00Z") => ({
        pull_request_url: `https://api.github.com/repos/o/r/pulls/${pull}`,
        path: filePath,
        in_reply_to_id: replyTo,
        created_at: at,
    });

    test("null is *not asked*, which is not *none recurring*", () => {
        const dir = repo({ ".portulan/memory/a-fact.md": [linked(), "2026-06-01"] }, { workspace: MANIFEST({ tree: "../", librarian: { staleness: STALENESS } }) });
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.mining.reviews, null);
    });

    test("a path drawing comments on two distinct pull requests recurs; one does not", () => {
        // Two is not a tuning knob, it is what *recurring* means — `core/skills/codify/SKILL.md`
        // triggers on "a pattern, not a one-off". A threshold here would be policy, and policy is
        // declared in the manifest; this is a definition, so it is not.
        const dir = repo(
            {
                ".portulan/memory/a-fact.md": [linked(), "2026-06-01"],
                "cli/doctor.mjs": ["// a file the tree really holds\n", "2026-06-01"],
                "docs/plan.md": ["# Plan\n", "2026-06-01"],
            },
            { workspace: MANIFEST({ tree: "../", librarian: { staleness: STALENESS } }) },
        );
        const reviews = [comment(1, "cli/doctor.mjs"), comment(2, "cli/doctor.mjs"), comment(3, "docs/plan.md")];
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15", reviews });
        assert.deepEqual(result.mining.reviews.paths.map((p) => [p.path, p.pulls]), [["cli/doctor.mjs", 2]]);
        assert.equal(result.mining.reviews.gone, 0);
    });

    test("two comments on ONE pull request are one occurrence, not a pattern", () => {
        const dir = repo({ ".portulan/memory/a-fact.md": [linked(), "2026-06-01"] }, { workspace: MANIFEST({ tree: "../", librarian: { staleness: STALENESS } }) });
        const reviews = [comment(1, "cli/doctor.mjs"), comment(1, "cli/doctor.mjs")];
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15", reviews });
        assert.deepEqual(result.mining.reviews.paths, []);
    });

    test("a reply is not a finding — only the comment that opens a thread is one", () => {
        // Measured on this repository rather than argued, and the partition is exact: of 376 inline
        // review comments, all 189 from the reviewer open a thread and all 187 replies — 162 the
        // agent identity's, 25 the maintainer's — carry `in_reply_to_id`. So *a finding is a thread
        // opener* separates them with no list of logins to maintain, which matters because the
        // reviewer here is itself a bot: excluding bots would have excluded the findings.
        //
        // Counting replies would also invert the signal. Every reply we write is one more comment on
        // a path we were answering a question about, so the harder a finding was argued, the more it
        // would look like a place reviewers keep finding things.
        const dir = repo({ ".portulan/memory/a-fact.md": [linked(), "2026-06-01"] }, { workspace: MANIFEST({ tree: "../", librarian: { staleness: STALENESS } }) });
        const reviews = [comment(1, "cli/doctor.mjs", 111), comment(2, "cli/doctor.mjs", 222)];
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15", reviews });
        assert.deepEqual(result.mining.reviews.paths, []);
        assert.equal(result.mining.reviews.replies, 2);
        assert.equal(result.mining.reviews.findings, 0);
    });

    test("a path the tree no longer holds is dropped, and the drop is counted", () => {
        // Found by running the pass against this repository's real review corpus rather than by
        // reading the code: `cli/mode.mjs` came back with findings on two pull requests, and that file
        // does not exist — the mode axis was ruled dead and both its pull requests closed unmerged.
        // A weekly nag pointing at a deleted file is a nag nobody can act on, and it never stops,
        // because review history is append-only. The count is reported rather than the drop being
        // silent: *we ignored some* and *there were none* must not print the same way.
        const dir = repo(
            { ".portulan/memory/a-fact.md": [linked(), "2026-06-01"], "kept.md": ["x\n", "2026-06-01"] },
            { workspace: MANIFEST({ tree: "../", librarian: { staleness: STALENESS } }) },
        );
        const reviews = [
            comment(1, "kept.md"),
            comment(2, "kept.md"),
            comment(1, "deleted.md"),
            comment(2, "deleted.md"),
        ];
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15", reviews });
        assert.deepEqual(result.mining.reviews.paths.map((p) => p.path), ["kept.md"]);
        assert.equal(result.mining.reviews.gone, 1);
    });

    test("a workspace that makes no claims about a tree is not asked about its reviews", () => {
        const dir = repo({ ".portulan/memory/a-fact.md": [linked(), "2026-06-01"] }, { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) });
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15", reviews: [comment(1, "a"), comment(2, "a")] });
        assert.equal(result.mining.reviews, null);
    });

    test("review data that is not an array is refused, never read as absent", () => {
        const dir = repo({ ".portulan/memory/a-fact.md": [linked(), "2026-06-01"] }, { workspace: MANIFEST({ tree: "../", librarian: { staleness: STALENESS } }) });
        assert.throws(() => passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15", reviews: { message: "Not Found" } }), LibrarianError);
    });
});

// ===========================================================================================
// Consolidation
// ===========================================================================================

describe("passWorkspace — scheduled consolidation", () => {
    const withHref = (href, fact = "A rule.") =>
        `**type:** rule\n**scope:** workspace\n**provenance:** \`form=link\` \`href=${href}\`\n\n${fact}\n\n**Retire when:** never.\n`;

    test("two records citing one incident are raised as a question, never as a merge", () => {
        // `core/skills/consolidate/SKILL.md` step 2 merges records that are one MECHANISM. Sharing an
        // incident is not that: measured on this repository, all three shared-incident groups are
        // deliberately distinct facts, because one incident teaches several mechanisms. So the pass
        // asks and does not conclude.
        const dir = repo(
            {
                ".portulan/memory/a-first.md": [withHref("../handoffs/2026-01-10-old.md"), "2026-06-01"],
                ".portulan/memory/b-second.md": [withHref("../handoffs/2026-01-10-old.md"), "2026-06-01"],
                ".portulan/memory/c-alone.md": [withHref("../handoffs/2026-02-02-other.md"), "2026-06-01"],
            },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.consolidation.shared.length, 1);
        assert.deepEqual(result.consolidation.shared[0].files, ["a-first.md", "b-second.md"]);
        assert.match(result.consolidation.shared[0].question, /one mechanism/i);
    });

    test("headroom is reported as a distance, so pressure is visible before the rail fires", () => {
        const dir = repo(
            { ".portulan/memory/a-first.md": [linked(), "2026-06-01"] },
            {
                workspace: MANIFEST({
                    librarian: { staleness: STALENESS },
                    memory: { index: { path: "memory-index.md", budget: { lines: 10 } }, store: { budget: { kilobytes: 1 } } },
                }),
            },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.consolidation.headroom.store.budget, 1);
        assert.ok(result.consolidation.headroom.store.percent > 0);
        assert.equal(result.consolidation.headroom.index.budget, 10);
    });

    test("an undeclared budget has no headroom to report, and says so rather than reporting zero", () => {
        const dir = repo({ ".portulan/memory/a-first.md": [linked(), "2026-06-01"] }, { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) });
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.equal(result.consolidation.headroom.store, null);
        assert.equal(result.consolidation.headroom.index, null);
    });
});

// ===========================================================================================
// The ordering the pass cannot get wrong
// ===========================================================================================

describe("a pass leaves the tree it just wrote to green", () => {
    const say = () => {
        const lines = [];
        const fn = (s) => lines.push(s);
        fn.lines = lines;
        return fn;
    };

    test("the handoff index covers the handoff the pass itself writes", () => {
        // **This is the fail-open the session-open checkpoint found, and it would have arrived on the
        // first real run.** A pass is a session, so it ends by writing a dated handoff INTO
        // `slots.handoffs` — a member of the series the handoff index covers. Regenerate that index
        // during the pass, as the memory index used to be, and it is stale in the very commit the pass
        // pushes: `index.sh` reds the pull request, `workspace-verify` fails, and the pull request
        // this milestone's criterion is demonstrated by cannot merge. Nobody is watching at 06:00 on
        // a Monday.
        //
        // The assertion is deliberately end-to-end rather than a check that some function was called
        // in some order: what has to be true is that the TREE the pass leaves behind passes the recipe
        // that guards it.
        const m = MANIFEST({
            librarian: { staleness: STALENESS },
            memory: { index: { path: "memory-index.md" } },
            handoffs: { index: { path: "handoffs-index.md" } },
        });
        m.slots.handoffs = "handoffs/";
        const dir = repo(
            {
                ".portulan/memory/r.md": [linked(), "2026-06-01"],
                ".portulan/handoffs/2026-06-01-x.md": ["# Handoff — x\n\nBody.\n", "2026-06-01"],
            },
            { workspace: m },
        );

        const out = say();
        assert.equal(run(["--as-of", "2026-06-15", "--write", path.join(dir, ".portulan")], out), 0);

        // The record the pass wrote is really in the series...
        const written = path.join(dir, ".portulan/handoffs/2026-06-15-librarian-pass.md");
        assert.ok(fs.existsSync(written), "the pass wrote its own handoff");

        // ...and the index the recipe checks already knows about it.
        const verdict = inspectIndex(path.join(dir, ".portulan"));
        assert.deepEqual(
            verdict.findings.map((f) => f.message),
            [],
            "the tree a pass leaves behind must pass `index.sh` — otherwise the pull request it files cannot merge",
        );
        assert.match(fs.readFileSync(path.join(dir, ".portulan/handoffs-index.md"), "utf8"), /2026-06-15-librarian-pass\.md/);
    });

    test("a pass that could not write its record does not regenerate an index either", () => {
        // An index regenerated over a series missing the handoff that belongs in it is *current about
        // the wrong tree* — worse than stale, because it is confidently wrong and the recipe agrees
        // with it.
        const m = MANIFEST({ librarian: { staleness: STALENESS }, memory: { index: { path: "memory-index.md" } } });
        m.slots.handoffs = "handoffs/";
        const dir = repo(
            {
                ".portulan/memory/r.md": [linked(), "2026-06-01"],
                ".portulan/handoffs/2026-06-01-x.md": ["# Handoff — x\n\nBody.\n", "2026-06-01"],
            },
            { workspace: m },
        );
        // Make the series unwritable so the record cannot land.
        fs.chmodSync(path.join(dir, ".portulan/handoffs"), 0o500);
        try {
            const out = say();
            assert.equal(run(["--as-of", "2026-06-15", "--write", path.join(dir, ".portulan")], out), 2);
            assert.equal(fs.existsSync(path.join(dir, ".portulan/memory-index.md")), false);
        } finally {
            fs.chmodSync(path.join(dir, ".portulan/handoffs"), 0o700);
        }
    });
});
