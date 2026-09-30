// Tests for `librarian` — the scheduled pass over the curated layer.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspect as inspectIndex } from "./index.mjs";

// Hermetic host: the tools read its installed-plugin record unasked; a case that wants a host passes `env:`.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
import {
    LibrarianError,
    parseArgs,
    daysBetween,
    sealedStamp,
    retireWhen,
    proposalPending,
    passWorkspace,
    renderReport,
    run,
} from "./librarian.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// One exit handler for every scratch directory: one per directory passes node's default of ten listeners.
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

function tree(dir, files) {
    for (const [rel, body] of Object.entries(files)) {
        const target = path.join(dir, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, body);
    }
    return dir;
}

// `--date` sets the author date, which the tool reads because a rebase rewrites only committer dates.
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

// Only the slots every fixture creates: the pass refuses a declared slot with no directory behind it.
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
        assert.match(renderReport([result], { asOf: "2026-06-15" }), /not yet committed/);
    });

    test("a STAGED record is uncommitted too — tracking is the wrong question", () => {
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

    test("a memory BUDGET that is not a positive integer is refused too, not printed as a percentage", () => {
        const budgets = [
            ["memory.index.budget.lines", (v) => ({ index: { path: "memory-index.md", budget: { lines: v } } })],
            ["memory.store.budget.kilobytes", (v) => ({ index: { path: "memory-index.md" }, store: { budget: { kilobytes: v } } })],
            ["memory.store.budget.record_kilobytes", (v) => ({ index: { path: "memory-index.md" }, store: { budget: { record_kilobytes: v } } })],
        ];
        for (const [where, memory] of budgets) {
            for (const bad of [0, -1, 1.5, "8", null]) {
                const dir = repo(
                    { ".portulan/memory/r.md": [linked(), "2026-01-01"] },
                    { workspace: MANIFEST({ librarian: { staleness: STALENESS }, memory: memory(bad) }) },
                );
                assert.throws(
                    () => passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" }),
                    LibrarianError,
                    `${where}: ${JSON.stringify(bad)} must be refused`,
                );
            }
        }
    });

    test("a budget refusal names the manifest path a reader can grep for", () => {
        const dir = repo(
            { ".portulan/memory/r.md": [linked(), "2026-01-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS }, memory: { index: { path: "memory-index.md" }, store: { budget: { record_kilobytes: 0 } } } }) },
        );
        assert.throws(
            () => passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" }),
            /memory\.store\.budget\.record_kilobytes is 0.*switch the rail off/s,
        );
    });

    test("a manifest declaring a spec this tool does not implement is refused", () => {
        const dir = repo(
            { ".portulan/memory/r.md": [linked(), "2026-01-01"] },
            { workspace: { ...MANIFEST({ librarian: { staleness: STALENESS } }), portulan: { spec: "9.9" } } },
        );
        assert.throws(() => passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" }), LibrarianError);
    });

    test("…and the version the shipped schema declares is implemented", () => {
        const { $id } = JSON.parse(fs.readFileSync(path.resolve(HERE, "..", "spec", "workspace.schema.json"), "utf8"));
        const spec = $id.match(/\/spec\/(\d+\.\d+)\//)[1];
        const dir = repo(
            { ".portulan/memory/r.md": [linked(), "2026-01-01"] },
            { workspace: { ...MANIFEST({ librarian: { staleness: STALENESS } }), portulan: { spec } } },
        );
        assert.doesNotThrow(() => passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" }));
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

describe("renderReport", () => {
    const passOf = (files, extra = {}) => {
        const dir = repo(files, { workspace: MANIFEST({ librarian: { staleness: STALENESS }, ...extra }) });
        return { dir, result: passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" }) };
    };

    test("is a report headed for the pass, and not a handoff: a pass leaves no open work", () => {
        const { result } = passOf({ ".portulan/memory/r.md": [linked(), "2026-06-01"] });
        const text = renderReport([result], { asOf: "2026-06-15" });
        assert.match(text, /^# The librarian's scheduled pass$/m);
        assert.doesNotMatch(text, /Handoff —|Session log/);
        assert.match(text, /\*\*Date:\*\* 2026-06-15/);
    });

    test("names the records a forward-only cap leaves unbound, as the index recipe reports them", () => {
        const memory = { index: { path: "memory-index.md" }, store: { budget: { record_kilobytes: 1, cutoff: "2026-06-10" } } };
        const { result } = passOf(
            { ".portulan/memory/old.md": [linked("x".repeat(3000)).replace("**scope:**", "**dated:** 2026-06-01\n**scope:**"), "2026-06-01"] },
            { memory },
        );
        const store = renderReport([result], { asOf: "2026-06-15" }).split("\n").find((l) => l.startsWith("**Store.**"));
        assert.match(store, /1 record\(s\) dated on or before the cutoff \(2026-06-10\) are over the per-record cap of 1 KB: reported, never railed/);
    });

    test("the per-record distance NAMES the record it measured", () => {
        const memory = { index: { path: "memory-index.md" }, store: { budget: { record_kilobytes: 8 } } };
        const { result } = passOf(
            {
                ".portulan/memory/small.md": [linked("A short one."), "2026-06-01"],
                ".portulan/memory/big.md": [linked("x".repeat(3000)), "2026-06-01"],
            },
            { memory },
        );
        const text = renderReport([result], { asOf: "2026-06-15" });
        assert.match(text, /Largest record: [\d.]+ of 8 KB \(\d+%\) — `big\.md`/);
        assert.doesNotMatch(text, /no records yet/);
    });

    test("a store whose records are ALL zero bytes still reports that it has records", () => {
        const memory = { index: { path: "memory-index.md" }, store: { budget: { record_kilobytes: 8 } } };
        const { result } = passOf({ ".portulan/memory/empty.md": ["", "2026-06-01"] }, { memory });
        const text = renderReport([result], { asOf: "2026-06-15" });
        assert.equal(result.counts.records, 1);
        assert.match(text, /Largest record: 0 of 8 KB \(0%\) — `empty\.md`/);
        assert.doesNotMatch(text, /no records yet/);
    });

    test("an EMPTY store says so, which is the only case that line may claim", () => {
        const memory = { index: { path: "memory-index.md" }, store: { budget: { record_kilobytes: 8 } } };
        // A non-record file, because an absent store directory is refused rather than reported empty.
        const { result } = passOf({ ".portulan/memory/.keep": ["", "2026-06-01"] }, { memory });
        const text = renderReport([result], { asOf: "2026-06-15" });
        assert.equal(result.counts.records, 0);
        assert.match(text, /Largest record: .*no records yet/);
    });

    test("states the pass date on every claim, so a stale record reads as of when it ran", () => {
        const { result } = passOf({ ".portulan/memory/r.md": [linked(), "2026-06-01"] });
        const text = renderReport([result], { asOf: "2026-06-15" });
        assert.match(text, /as of 2026-06-15/i);
    });

    test("reports an unfired threshold as unfired rather than omitting the section", () => {
        const { result } = passOf({ ".portulan/memory/r.md": [linked(), "2026-06-01"] });
        const text = renderReport([result], { asOf: "2026-06-15" });
        assert.match(text, /nothing/i);
        assert.match(text, /sealed/i, "the sealed section is present even at zero seals");
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
        const dir = repo(
            { ".portulan/memory/old.md": [linked(), "2026-01-01"] },
            { workspace: MANIFEST({ librarian: { staleness: STALENESS } }) },
        );
        const out = say();
        assert.equal(run(["--as-of", "2026-06-15", path.join(dir, ".portulan")], out), 0);
        assert.match(out.lines.join("\n"), /1 stale/i);
    });

    test("the summary says so when it regenerated an index", () => {
        const m = MANIFEST({ librarian: { staleness: STALENESS }, memory: { index: { path: "memory-index.md" } } });
        m.slots.handoffs = "handoffs/";
        const dir = repo(
            { ".portulan/memory/r.md": [linked(), "2026-06-01"], ".portulan/handoffs/2026-06-01-x.md": ["x\n", "2026-06-01"] },
            { workspace: m },
        );
        const out = say();
        assert.equal(run(["--as-of", "2026-06-15", "--write", path.join(dir, ".portulan")], out), 0);
        const printed = out.lines.join("\n");
        assert.match(printed, /index drift found/);
        assert.match(printed, /regenerated scratch's index/);
        assert.ok(
            printed.indexOf("index drift found") < printed.indexOf("regenerated scratch's index"),
            "the claim of a repair must come after the repair, not before it",
        );
    });

    test("a workspace with no proposals slot does not crash the summary", () => {
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
        const dir = repo({ ".portulan/memory/r.md": [linked(), "2026-06-01"] }, { workspace: MANIFEST() });
        const out = say();
        assert.equal(run(["--wrtie", path.join(dir, ".portulan")], out), 2);
        assert.match(out.lines.join("\n"), /unknown option/);
    });

    test("a value-bearing flag with no value is refused rather than swallowing a flag", () => {
        assert.throws(() => parseArgs(["--as-of"]), LibrarianError);
        assert.throws(() => parseArgs(["--report"]), LibrarianError);
        assert.throws(() => parseArgs(["--report", "--write", "a"]), LibrarianError);
        assert.throws(() => parseArgs(["--since", "--write", "a"]), LibrarianError);
    });

    test("the Session log's flag is retired with the log, and refused as unknown", () => {
        assert.throws(() => parseArgs(["--log", "docs/plan.md", "a"]), /unknown option "--log"/);
    });

    test("and where the grammar cannot help, the empty workspace list does", () => {
        const out = say();
        assert.equal(run(["--report", ".portulan"], out), 2);
        assert.match(out.lines.join("\n"), /usage/);
    });

    test("the flags it does understand still parse, in any order", () => {
        assert.deepEqual(
            parseArgs(["--as-of", "2026-06-15", "--write", "--report", "/tmp/r.md", "--since", "2026-06-08", "--reviews", "r.json", "a", "b"]),
            { asOf: "2026-06-15", since: "2026-06-08", reportPath: "/tmp/r.md", reviewsPath: "r.json", write: true, dirs: ["a", "b"] },
        );
        assert.deepEqual(parseArgs(["a", "--write"]), {
            asOf: undefined,
            since: undefined,
            reportPath: undefined,
            reviewsPath: undefined,
            write: true,
            dirs: ["a"],
        });
    });

    test("`--reviews` needs a value, and a flag is not one", () => {
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

describe("the live workspaces", () => {
    const REPO_ROOT = path.resolve(HERE, "..");
    // CI checks out at depth 1, and the pass refuses a shallow repository.
    const shallow = execFileSync("git", ["-C", REPO_ROOT, "rev-parse", "--is-shallow-repository"], {
        encoding: "utf8",
    }).trim() === "true";

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
        assert.equal(storeOf(".portulan", "memory").filter((s) => sealedStamp(s) !== null).length, 0);
    });

    test("every live sealed stamp carries a date the pass can nag against", () => {
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

    test("a window its scheduler names with `--since` outranks the newest pass record", () => {
        const dir = repo(
            {
                ".portulan/memory/a-fact.md": [linked(), "2026-06-01"],
                ".portulan/handoffs/2026-03-01-librarian-pass.md": [pass("The librarian's scheduled pass"), "2026-03-01"],
                ".portulan/handoffs/2026-05-01-earlier.md": [pass("Earlier"), "2026-05-01"],
                ".portulan/handoffs/2026-06-10-this-week.md": [pass("This week"), "2026-06-10"],
            },
            { workspace: WITH_HANDOFFS({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15", since: "2026-06-08" });
        assert.equal(result.mining.incidents.since, "2026-06-08");
        assert.deepEqual(result.mining.incidents.candidates.map((c) => c.file), ["2026-06-10-this-week.md"]);
        assert.throws(() => passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15", since: "last week" }), LibrarianError);
    });

    test("an incident dated the same day as the last pass is inside the window, not lost to it", () => {
        const dir = repo(
            {
                ".portulan/memory/a-fact.md": [linked(), "2026-06-01"],
                ".portulan/handoffs/2026-03-01-librarian-pass.md": [pass("The librarian's scheduled pass"), "2026-03-01"],
                ".portulan/handoffs/2026-03-01-same-afternoon.md": [pass("Same afternoon"), "2026-03-01"],
            },
            { workspace: WITH_HANDOFFS({ librarian: { staleness: STALENESS } }) },
        );
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" });
        assert.deepEqual(result.mining.incidents.candidates.map((c) => c.file), ["2026-03-01-same-afternoon.md"]);
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
        const dir = repo({ ".portulan/memory/a-fact.md": [linked(), "2026-06-01"] }, { workspace: MANIFEST({ tree: "../", librarian: { staleness: STALENESS } }) });
        const reviews = [comment(1, "cli/doctor.mjs", 111), comment(2, "cli/doctor.mjs", 222)];
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15", reviews });
        assert.deepEqual(result.mining.reviews.paths, []);
        assert.equal(result.mining.reviews.replies, 2);
        assert.equal(result.mining.reviews.findings, 0);
    });

    test("a path the tree no longer holds is dropped, and the drop is counted", () => {
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

    test("a write pass writes no handoff, puts its report where it is told, and leaves a tree the recipe passes", () => {
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
                ".portulan/handoffs-index.md": ["", "2026-06-01"],
            },
            { workspace: m },
        );
        const report = path.join(scratch(), "report.md");

        const out = say();
        assert.equal(run(["--as-of", "2026-06-15", "--write", "--report", report, path.join(dir, ".portulan")], out), 0);

        assert.deepEqual(fs.readdirSync(path.join(dir, ".portulan/handoffs")), ["2026-06-01-x.md"], "the pass wrote no handoff");
        assert.match(fs.readFileSync(report, "utf8"), /^# The librarian's scheduled pass/);
        assert.deepEqual(inspectIndex(path.join(dir, ".portulan")).findings.map((f) => f.message), []);
    });

    test("a pass that could not write its report does not regenerate an index either", () => {
        // The report path is a directory, which no write can replace, as root or not.
        const m = MANIFEST({ librarian: { staleness: STALENESS }, memory: { index: { path: "memory-index.md" } } });
        const dir = repo({ ".portulan/memory/r.md": [linked(), "2026-06-01"] }, { workspace: m });
        const out = say();
        assert.equal(run(["--as-of", "2026-06-15", "--write", "--report", scratch(), path.join(dir, ".portulan")], out), 2);
        assert.match(out.lines.join("\n"), /cannot write the report/);
        assert.equal(fs.existsSync(path.join(dir, ".portulan/memory-index.md")), false);
    });

    test("a report named inside the tree is refused, and nothing is written or regenerated", () => {
        // A write through a dangling link creates the file it names, so those are refused too.
        const m = MANIFEST({ tree: "../", librarian: { staleness: STALENESS }, memory: { index: { path: "memory-index.md" } } });
        const dir = repo({ ".portulan/memory/r.md": [linked(), "2026-06-01"] }, { workspace: m });
        const outside = scratch();
        fs.symlinkSync(dir, path.join(outside, "into-tree"));
        fs.symlinkSync(path.join(dir, "new-report.md"), path.join(outside, "dangling.md"));
        fs.symlinkSync("dangling.md", path.join(outside, "chain.md"));
        fs.symlinkSync(path.join(dir, ".portulan/memory/new"), path.join(outside, "dangling-dir"));
        const reports = [
            path.join(dir, ".portulan/memory/zz.md"),
            path.join(dir, "report.md"),
            path.join(outside, "into-tree", "report.md"),
            path.join(outside, "dangling.md"),
            path.join(outside, "chain.md"),
            path.join(outside, "dangling-dir", "report.md"),
        ];
        for (const report of reports) {
            const out = say();
            assert.equal(run(["--as-of", "2026-06-15", "--write", "--report", report, path.join(dir, ".portulan")], out), 2, report);
            assert.match(out.lines.join("\n"), /refusing to write the report inside/);
            assert.equal(fs.existsSync(report), false, report);
        }
        assert.equal(fs.existsSync(path.join(dir, "new-report.md")), false, "nothing was written through a dangling link");
        assert.equal(fs.existsSync(path.join(dir, ".portulan/memory/new")), false, "nor a directory made through one");
        assert.equal(fs.existsSync(path.join(dir, ".portulan/memory-index.md")), false, "and no index was regenerated");
    });

    test("a report named at a hard link into the tree replaces the link, never the tree's file", () => {
        // A hard link has no path to resolve, so containment sees only its outside name.
        const m = MANIFEST({ tree: "../", librarian: { staleness: STALENESS } });
        const dir = repo({ ".portulan/memory/r.md": [linked(), "2026-06-01"] }, { workspace: m });
        fs.writeFileSync(path.join(dir, "notes.md"), "the tree's copy\n");
        const report = path.join(scratch(), "report.md");
        fs.linkSync(path.join(dir, "notes.md"), report);
        const out = say();
        assert.equal(run(["--as-of", "2026-06-15", "--report", report, path.join(dir, ".portulan")], out), 0);
        assert.equal(fs.readFileSync(path.join(dir, "notes.md"), "utf8"), "the tree's copy\n");
        assert.equal(fs.statSync(path.join(dir, "notes.md")).nlink, 1, "the outside name no longer shares the file");
        assert.match(fs.readFileSync(report, "utf8"), /^# The librarian's scheduled pass/);
        assert.deepEqual(fs.readdirSync(path.dirname(report)), ["report.md"], "and no temporary file is left");
    });

    test("a workspace whose pass failed still keeps the report out of the tree it declares", () => {
        const m = { ...MANIFEST({ tree: "../" }), portulan: { spec: "9.9" } };
        const dir = repo({ ".portulan/memory/r.md": [linked(), "2026-06-01"] }, { workspace: m });
        const report = path.join(dir, "report.md");
        const out = say();
        assert.equal(run(["--as-of", "2026-06-15", "--report", report, path.join(dir, ".portulan")], out), 2);
        assert.match(out.lines.join("\n"), /refusing to write the report inside/);
        assert.equal(fs.existsSync(report), false);
    });
});

describe("the report never claims an index is current when none is declared", () => {
    const say = () => {
        const lines = [];
        const fn = (s) => lines.push(s);
        fn.lines = lines;
        return fn;
    };

    test("a workspace with only a HANDOFF index says nothing about a store index", () => {
        const m = MANIFEST({ librarian: { staleness: STALENESS }, handoffs: { index: { path: "handoffs-index.md" } } });
        m.slots.handoffs = "handoffs/";
        const dir = repo(
            {
                ".portulan/memory/r.md": [linked(), "2026-06-01"],
                ".portulan/handoffs/2026-06-01-x.md": ["# Handoff — x\n\nBody.\n", "2026-06-01"],
            },
            { workspace: m },
        );
        run(["--as-of", "2026-06-15", "--write", path.join(dir, ".portulan")], say());
        const record = renderReport([passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" })], { asOf: "2026-06-15" });
        const store = record.split("\n").find((l) => l.startsWith("**Store.**"));
        assert.match(store, /Index: none declared/);
    });

    test("a workspace with only a STORE index says nothing about a handoff index", () => {
        const m = MANIFEST({ librarian: { staleness: STALENESS }, memory: { index: { path: "memory-index.md" } } });
        m.slots.handoffs = "handoffs/";
        const dir = repo(
            {
                ".portulan/memory/r.md": [linked(), "2026-06-01"],
                ".portulan/handoffs/2026-06-01-x.md": ["# Handoff — x\n\nBody.\n", "2026-06-01"],
            },
            { workspace: m },
        );
        run(["--as-of", "2026-06-15", "--write", path.join(dir, ".portulan")], say());
        const record = renderReport([passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" })], { asOf: "2026-06-15" });
        const series = record.split("\n").find((l) => l.startsWith("**Handoff series.**"));
        assert.match(series, /Index: none declared/);
        assert.doesNotMatch(series, /Index: current/);
    });
});

describe("a review corpus of the wrong shape is refused, never half-read", () => {
    // gh 2.96.0: `--paginate` emits one flat array, and `--slurp` an array of pages, the shape refused here.
    test("an array of pages is refused rather than read as an array of comments", () => {
        const dir = repo({ ".portulan/memory/a-fact.md": [linked(), "2026-06-01"] }, { workspace: MANIFEST({ tree: "../", librarian: { staleness: STALENESS } }) });
        const slurped = [[{ pull_request_url: "x/1", path: "a.md", in_reply_to_id: null }]];
        assert.throws(
            () => passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15", reviews: slurped }),
            (e) => {
                assert.ok(e instanceof LibrarianError);
                assert.match(e.message, /not a review comment/i);
                return true;
            },
        );
    });

    test("an element with no `pull_request_url` is refused, not counted against an empty key", () => {
        const dir = repo({ ".portulan/memory/a-fact.md": [linked(), "2026-06-01"] }, { workspace: MANIFEST({ tree: "../", librarian: { staleness: STALENESS } }) });
        assert.throws(
            () => passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15", reviews: [{ path: "a.md" }] }),
            LibrarianError,
        );
    });

    test("the real shape still passes, so the refusal is not a blanket one", () => {
        const dir = repo(
            { ".portulan/memory/a-fact.md": [linked(), "2026-06-01"], "a.md": ["x\n", "2026-06-01"] },
            { workspace: MANIFEST({ tree: "../", librarian: { staleness: STALENESS } }) },
        );
        const real = [
            { pull_request_url: "https://api.github.com/repos/o/r/pulls/1", path: "a.md", in_reply_to_id: null },
            { pull_request_url: "https://api.github.com/repos/o/r/pulls/2", path: "a.md", in_reply_to_id: null },
        ];
        const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15", reviews: real });
        assert.deepEqual(result.mining.reviews.paths.map((p) => p.path), ["a.md"]);
    });
});

describe("headroom is measured from what the store renders now", () => {
    test("a record added and not reindexed RAISES the reported pressure, never lowers it", () => {
        const m = MANIFEST({
            librarian: { staleness: STALENESS },
            memory: { index: { path: "memory-index.md", budget: { lines: 20 } } },
        });
        const dir = repo({ ".portulan/memory/a-first.md": [linked(), "2026-06-01"] }, { workspace: m });
        const before = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" }).consolidation.headroom.index;

        tree(dir, { ".portulan/memory/b-second.md": linked() });
        const after = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15" }).consolidation.headroom.index;

        assert.ok(after.actual > before.actual, `pressure must rise with the store: ${before.actual} → ${after.actual}`);
    });
});

describe("a reviewed path is only ever probed inside the tree", () => {
    const comment = (pull, filePath) => ({
        pull_request_url: `https://api.github.com/repos/o/r/pulls/${pull}`,
        path: filePath,
        in_reply_to_id: null,
    });

    for (const escape of ["../../../../etc/hosts", "/etc/hosts", "kept/../../outside.md"]) {
        test(`a path escaping the tree (${escape}) is dropped, never probed as in-tree`, () => {
            const dir = repo(
                { ".portulan/memory/a-fact.md": [linked(), "2026-06-01"], "kept.md": ["x\n", "2026-06-01"] },
                { workspace: MANIFEST({ tree: "../", librarian: { staleness: STALENESS } }) },
            );
            const reviews = [comment(1, escape), comment(2, escape), comment(1, "kept.md"), comment(2, "kept.md")];
            const result = passWorkspace(path.join(dir, ".portulan"), { asOf: "2026-06-15", reviews });
            assert.deepEqual(result.mining.reviews.paths.map((p) => p.path), ["kept.md"]);
            assert.equal(result.mining.reviews.gone, 1);
        });
    }
});
