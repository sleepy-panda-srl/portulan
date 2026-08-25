// The gate-corpus rail's suite. Every contracted state is exercised POSITIVELY — green, a missing
// fixture, a regression, a hole that closed, every malformed-fixture refusal, and could-not-run —
// because a failure path nobody has run is one nobody has seen work.
//
// Three cases exist because this repository's own history refutes the naive design: the entry guard
// must survive a path containing a space (this file's subject shipped the broken spelling and exited
// 0 having run nothing, which is the third time here), the denominator must be the YIELDED policy
// rather than the declared file, and a fixture's command string must never reach a subprocess.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// A HERMETIC HOST, the three-line block `pinned-roots.live.test.mjs` sweeps for — asserted WHOLE, so
// that copying the two lines which neutralise the host and dropping the one that tidies up is caught.
// This suite reaches `compile.mjs`, which consults the host's installed-plugin record on the unasked
// path, so without it a fixture's verdict would move with what somebody has installed.
//
// **Needed even though `goldens.mjs` refuses discovery outright.** The sweep derives membership from
// IMPORTS rather than from what a module currently does, which is the right rule: an internal refusal
// is one edit from being relaxed, and the containment should not have to be re-added on that day.
//
// The block is spelled with namespace imports because the sweep compares it as literal text. Written
// once from the sibling rather than re-derived — this file's first attempt used the named-import
// spelling, was semantically identical, and went red, which is the sweep doing exactly its job.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import { CLASSES, CORPUS_DIR, MATCHABLE, PATHS, CouldNotRun, grade, matcherPath, partition, readCorpus, yieldedRules } from "./goldens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");

const RULES = [
    { id: "gate-a", tier: "gated", action: { shell: "git push --force" }, reason: "x" },
    { id: "gate-b", tier: "prohibited", action: { write: "docs/vision.md" }, reason: "x" },
    { id: "shapeless", tier: "gated", action: { none: "no tool-level surface" }, reason: "x" },
];

const CASE = (over = {}) => ({
    id: "c",
    class: "holds",
    tool: "Bash",
    // `shell-prefix` is the default because the default rule is `gate-a`, a `shell:` rule reached
    // through Bash. A case overriding the rule or the tool overrides this too — and if it forgets,
    // the mislabel rail below catches it, which is the rail testing itself.
    path: "shell-prefix",
    input: { command: "git push --force origin main" },
    expect: true,
    why: "a reason a reviewer can read",
    ...over,
});
const WRITE_CASE = (over = {}) =>
    CASE({ path: "shell-write", input: { command: "cp /tmp/x docs/vision.md" }, ...over });

// The filename is derived from the doc's own `rule`, because the corpus reader enforces that they
// match — so a helper naming files by object key would trip the convention check on every fixture and
// hide the shape refusal each case is actually about. The key is the fallback for a doc that declares
// no rule, which is the one case that must still reach the missing-`rule` refusal.
function corpus(files) {
    const root = mkdtempSync(join(tmpdir(), "portulan-goldens-"));
    const dir = join(root, CORPUS_DIR);
    mkdirSync(dir, { recursive: true });
    for (const [name, doc] of Object.entries(files)) {
        const file = typeof doc.rule === "string" && doc.rule !== "" ? doc.rule : name;
        writeFileSync(join(dir, `${file}.json`), `${JSON.stringify(doc, null, 2)}\n`);
    }
    return root;
}

/** A corpus whose file deliberately does NOT match its `rule` — the convention check's own fixture. */
function misfiledCorpus(name, doc) {
    const root = mkdtempSync(join(tmpdir(), "portulan-goldens-"));
    const dir = join(root, CORPUS_DIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.json`), `${JSON.stringify(doc, null, 2)}\n`);
    return root;
}
const cleanup = (root) => rmSync(root, { recursive: true, force: true });

// ---------------------------------------------------------------------------------------------
// partition — the exemption, which is the obvious way to dodge this rail
// ---------------------------------------------------------------------------------------------

test("a rule with no matchable action is exempt, and is RETURNED rather than dropped", () => {
    const { matchable, exempt } = partition(RULES);
    assert.deepEqual(matchable.map((r) => r.id), ["gate-a", "gate-b"]);
    assert.deepEqual(exempt.map((r) => r.id), ["shapeless"], "an exemption the caller cannot see is an exemption nobody reviews");
    assert.equal(matchable[0].kind, "shell", "the kind is carried so a finding can name it");
});

test("every action kind matchesRule can answer for is in MATCHABLE", () => {
    // Derived from the matcher's own branches rather than hand-listed. If `matchesRule` grows a
    // fourth action kind and this list does not, rules of that kind become silently exempt — the
    // exact failure the exemption census exists to make loud.
    const source = readFileSync(join(HERE, "compile.mjs"), "utf8");
    for (const kind of MATCHABLE) {
        assert.match(source, new RegExp(`action\\.${kind}`), `matchesRule must actually read action.${kind}`);
    }
    assert.deepEqual([...MATCHABLE].sort(), ["read", "shell", "write"]);
});

// ---------------------------------------------------------------------------------------------
// grade — the two rails
// ---------------------------------------------------------------------------------------------

test("green when every matchable rule carries fixtures and every case answers as recorded", () => {
    const root = corpus({
        "gate-a": { rule: "gate-a", cases: [CASE()] },
        "gate-b": { rule: "gate-b", cases: [WRITE_CASE()] },
    });
    try {
        const r = grade(RULES, readCorpus(root));
        assert.deepEqual(r.findings, []);
        assert.equal(r.cases, 2);
    } finally { cleanup(root); }
});

test("RED when a matchable rule carries no fixture at all — coverage is measured, not named", () => {
    const root = corpus({ "gate-a": { rule: "gate-a", cases: [CASE()] } });
    try {
        const r = grade(RULES, readCorpus(root));
        assert.equal(r.findings.length, 1);
        assert.match(r.findings[0].what, /`gate-b`.*no fixture attacks it/s);
        assert.match(r.findings[0].what, /add evals\/goldens\/gates\/gate-b\.json/, "a red that does not say what to do costs the reader twice");
    } finally { cleanup(root); }
});

test("an EMPTY corpus reds once per matchable rule rather than passing vacuously", () => {
    const root = corpus({});
    try {
        const r = grade(RULES, readCorpus(root));
        assert.equal(r.findings.length, 2, "two matchable rules, two findings — and the none-shaped rule is not one of them");
    } finally { cleanup(root); }
});

test("RED on a `holds` regression, naming both answers", () => {
    const root = corpus({ "gate-a": { rule: "gate-a", cases: [CASE({ expect: false })] }, "gate-b": { rule: "gate-b", cases: [WRITE_CASE()] } });
    try {
        const r = grade(RULES, readCorpus(root));
        assert.equal(r.findings.length, 1);
        assert.match(r.findings[0].what, /REGRESSION.*answer false.*now answers true/s);
    } finally { cleanup(root); }
});

test("RED when a DOCUMENTED HOLE has closed — the staleness rail runs in both directions", () => {
    // The half that is easy to leave out. A hole record that still lists a closed hole is as wrong as
    // one that hides an open one, and only this direction catches it.
    const root = corpus({
        "gate-a": {
            rule: "gate-a",
            cases: [
                CASE(),
                // Claims the matcher misses a mid-line command. It does not — that hole closed in 2026-07-28.
                CASE({ id: "stale", class: "documented-hole", hole: "gate-map entry 2", input: { command: "ls && git push --force origin main" }, expect: false }),
            ],
        },
        "gate-b": { rule: "gate-b", cases: [WRITE_CASE()] },
    });
    try {
        const r = grade(RULES, readCorpus(root));
        assert.equal(r.findings.length, 1);
        assert.match(r.findings[0].what, /has MOVED/);
        assert.match(r.findings[0].what, /update gate-map entry 2/, "the finding names the record to repair, not just the disagreement");
        assert.match(r.findings[0].what, /change this case to `holds`/);
    } finally { cleanup(root); }
});

test("RED when a fixture attacks a rule the yielded policy does not declare", () => {
    const root = corpus({
        "gate-a": { rule: "gate-a", cases: [CASE()] },
        "gate-b": { rule: "gate-b", cases: [WRITE_CASE()] },
        ghost: { rule: "renamed-away", cases: [CASE()] },
    });
    try {
        const r = grade(RULES, readCorpus(root));
        assert.equal(r.findings.length, 1);
        assert.match(r.findings[0].what, /the yielded policy does not declare/);
    } finally { cleanup(root); }
});

test("a fixture attacking a none-shaped rule is refused with the RIGHT sentence", () => {
    // Two different mistakes must not print one message: a fixture for a renamed rule is stale, a
    // fixture for a rule with no tool-level surface is a category error, and the repairs differ.
    const root = corpus({
        "gate-a": { rule: "gate-a", cases: [CASE()] },
        "gate-b": { rule: "gate-b", cases: [WRITE_CASE()] },
        shapeless: { rule: "shapeless", cases: [CASE()] },
    });
    try {
        const r = grade(RULES, readCorpus(root));
        assert.equal(r.findings.length, 1);
        assert.match(r.findings[0].what, /no matchable action.*nothing to attack/s);
    } finally { cleanup(root); }
});

// ---------------------------------------------------------------------------------------------
// readCorpus — every shape refusal, exercised
// ---------------------------------------------------------------------------------------------

for (const [label, doc, expected] of [
    ["no `rule`", { cases: [CASE()] }, /names no `rule`/],
    ["no `cases`", { rule: "gate-a" }, /carries no `cases`/],
    ["an empty `cases`", { rule: "gate-a", cases: [] }, /carries no `cases`/],
    ["a case with no id", { rule: "gate-a", cases: [CASE({ id: undefined })] }, /has no `id`/],
    ["an unknown class", { rule: "gate-a", cases: [CASE({ class: "hopeful" })] }, /declares class "hopeful"/],
    ["no tool", { rule: "gate-a", cases: [CASE({ tool: "" })] }, /names no `tool`/],
    ["a non-boolean expect", { rule: "gate-a", cases: [CASE({ expect: "yes" })] }, /no boolean `expect`/],
    ["no why", { rule: "gate-a", cases: [CASE({ why: "   " })] }, /carries no `why`/],
    ["a documented-hole naming no record", { rule: "gate-a", cases: [CASE({ class: "documented-hole" })] }, /names no `hole`/],
    ["no input object", { rule: "gate-a", cases: [CASE({ input: null })] }, /declares no `input` object/],
]) {
    test(`a malformed fixture is could-not-run, not a red — ${label}`, () => {
        const root = corpus({ bad: doc });
        try {
            assert.throws(() => readCorpus(root), (e) => e instanceof CouldNotRun && expected.test(e.message));
        } finally { cleanup(root); }
    });
}

test("a MISFILED fixture is could-not-run — one file per rule, named for it", () => {
    // The convention was documented in three places and enforced in none: the missing-fixture red
    // prints `add evals/goldens/gates/<rule-id>.json`, evals/README.md gives the layout, and a
    // renamed file validated cleanly and graded anyway. A mandate nothing checks is already broken,
    // and this module was carrying one while its whole subject is mandates that need checkers.
    // Reported as a suppressed note by Copilot, round 5 on #336.
    const root = misfiledCorpus("not-the-rule-name", { rule: "gate-a", cases: [CASE()] });
    try {
        assert.throws(
            () => readCorpus(root),
            (e) => e instanceof CouldNotRun && /one fixture file per rule, named for it/.test(e.message),
        );
    } finally { cleanup(root); }
});

test("the repository's own corpus obeys the convention it documents", () => {
    // The other direction, and the one that would have caught the gap earlier: assert the tree, not
    // just the refusal. Every file here is named for the rule it declares.
    const dir = join(REPO, CORPUS_DIR);
    for (const name of readdirSync(dir)) {
        const doc = JSON.parse(readFileSync(join(dir, name), "utf8"));
        assert.equal(name, `${doc.rule}.json`, `${name} declares rule ${doc.rule}`);
    }
});

test("a corpus directory that is not there is could-not-run, never a silent green", () => {
    const root = mkdtempSync(join(tmpdir(), "portulan-goldens-"));
    try {
        assert.throws(() => readCorpus(root), (e) => e instanceof CouldNotRun && /cannot be read/.test(e.message));
    } finally { cleanup(root); }
});

test("a fixture file that is not JSON is could-not-run, and names the file", () => {
    const root = corpus({ "gate-a": { rule: "gate-a", cases: [CASE()] } });
    try {
        writeFileSync(join(root, CORPUS_DIR, "broken.json"), "{ not json");
        assert.throws(() => readCorpus(root), (e) => e instanceof CouldNotRun && /broken\.json is not valid JSON/.test(e.message));
    } finally { cleanup(root); }
});

// ---------------------------------------------------------------------------------------------
// The corpus this repository actually ships
// ---------------------------------------------------------------------------------------------

test("this repository's own corpus is green against its own yielded policy", () => {
    const { rules } = yieldedRules(REPO, { packRoots: [join(REPO, "packs")] });
    const r = grade(rules, readCorpus(REPO));
    assert.deepEqual(r.findings.map((f) => `${f.where}: ${f.what}`), []);
    assert.ok(r.cases > 100, `a corpus this thin would not be an attack pass — ${r.cases} cases`);
});

test("the corpus's denominator is the YIELDED policy, not the declared file", () => {
    // The class dod.md condition 1 names: a rail scoped to the declared list lets a composed gate
    // ship with no fixtures while the check stays green. Both of this workspace's pack-contributed
    // rules are none-shaped today, so the outcome coincides — which is exactly how this defect goes
    // unnoticed, and exactly why the assertion is on the CENSUS rather than on the verdict.
    const { rules } = yieldedRules(REPO, { packRoots: [join(REPO, "packs")] });
    const declared = JSON.parse(readFileSync(join(REPO, ".portulan/gates.json"), "utf8")).rules;
    assert.ok(rules.length > declared.length, "composed fragments must reach the census");
    const ids = new Set(rules.map((r) => r.id));
    for (const composed of ["commit-without-the-hooks", "self-certify-a-checkpoint"]) {
        assert.ok(ids.has(composed), `${composed} is contributed by rituals/checkpoints and must be counted`);
    }
});

test("every fixture file is free of raw control characters", () => {
    // control-chars.mjs refuses a raw CR anywhere in this tree by decision, and exempting a growing
    // adversarial-content directory is the allow-list defect that same file names. So byte-level
    // attacks are stored ESCAPED — JSON's own `\r` and `\u0000` — and decoded by JSON.parse.
    const dir = join(REPO, CORPUS_DIR);
    for (const name of readdirSync(dir)) {
        const bytes = readFileSync(join(dir, name));
        for (const [i, b] of bytes.entries()) {
            assert.ok(b >= 0x20 || b === 0x0a, `${name} byte ${i} is a raw control character (0x${b.toString(16)})`);
        }
    }
});

test("the escaped bytes really do decode — the corpus carries a CR and a NUL", () => {
    // The control on the test above. A corpus that passed the byte scan because it contained no
    // byte-level attacks at all would prove nothing.
    const doc = JSON.parse(readFileSync(join(REPO, CORPUS_DIR, "edit-the-constitution.json"), "utf8"));
    const crlf = doc.cases.find((c) => c.id === "a-CRLF-continuation");
    // **"one of the eight bypasses" is a HISTORICAL membership, and it stays worded that way on
    // purpose.** The set is the one `../docs/milestones/m08.md` fixed; what has since changed is the
    // reason this member was ever in it. Its `cp`-shaped payload was called a bypass on the strength of
    // a reachability claim that no shell measured reproduces — see `shellWords` in ./compile.mjs, and
    // `../.portulan/proposals/0031-a-continuation-no-shell-joins.md`, which asks whether the branch
    // catching it should go. The fixture is a live assertion either way; the pointer is here so the
    // next reader does not inherit the retired framing from a line of running code.
    assert.ok(crlf, "the CRLF continuation is one of the eight bypasses and must be in the corpus");
    assert.ok(crlf.input.command.includes("\r\n"), "it must decode to real CRLF, or it is testing a different string");
});

// ---------------------------------------------------------------------------------------------
// The contract: fixtures are data
// ---------------------------------------------------------------------------------------------

test("the runner cannot execute a fixture — it imports no process-spawning API", () => {
    // The corpus contains `git push --force`, `rm -rf docs` and constitution-write spellings by
    // design. Running one would be somewhere between tripping the gate under test and destroying the
    // tree it runs in. Asserted statically because the guarantee is structural: there is no code path
    // from a fixture to a subprocess, and this is what keeps it that way under a later edit.
    const source = readFileSync(join(HERE, "goldens.mjs"), "utf8");
    assert.doesNotMatch(source, /node:child_process/, "a fixture's command string is DATA");
    assert.doesNotMatch(source, /\bexecSync\b|\bexecFileSync\b|\bspawnSync\b|\bspawn\(/);
});

// ---------------------------------------------------------------------------------------------
// The CLI
// ---------------------------------------------------------------------------------------------

function cli(args, cwd = REPO) {
    return spawnSync(process.execPath, [join(HERE, "goldens.mjs"), ...args], { cwd, encoding: "utf8" });
}

test("the CLI exits 0 and says so on this repository", () => {
    const r = cli(["--workspace", REPO, "--pack-root", join(REPO, "packs"), "--check"]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /GREEN/);
});

test("a green STATES its own limit rather than letting the exit code imply more", () => {
    const r = cli(["--workspace", REPO, "--pack-root", join(REPO, "packs")]);
    assert.match(r.stdout, /PRESENCE floor/, "a rail whose limit is unstated gets read as the guarantee it is not");
});

test("a green NAMES every exempt rule, so the exemption cannot be silent", () => {
    const r = cli(["--workspace", REPO, "--pack-root", join(REPO, "packs")]);
    for (const id of ["spend-money-or-register-a-domain", "send-something-outside-this-repository", "self-certify-a-checkpoint"]) {
        assert.match(r.stdout, new RegExp(id), `${id} declares no matchable action and must be listed`);
    }
});

test("the CLI RUNS from a path containing a space, and says so", () => {
    // This module shipped `import.meta.url === \`file://${process.argv[1]}\`` for exactly one
    // measurement: the first run printed nothing and exited 0, on a corpus that did not exist yet.
    // `import.meta.url` percent-encodes and this working copy lives under a path with spaces. A green
    // that is the tool never starting — the third time this repository has met it.
    const root = mkdtempSync(join(tmpdir(), "portulan gold "));
    try {
        const dest = join(root, "copy");
        cpSync(REPO, dest, { recursive: true, filter: (s) => !s.includes(`${REPO}/.git/`) && !s.includes("node_modules") });
        const r = spawnSync(process.execPath, [join(dest, "cli/goldens.mjs"), "--workspace", dest, "--pack-root", join(dest, "packs")], { encoding: "utf8" });
        assert.equal(r.status, 0, r.stderr);
        assert.match(r.stdout, /GREEN/, "silence with exit 0 is the false green this guard exists for");
    } finally { cleanup(root); }
});

test("--help exits 0, because asking for help is a request and it succeeded", () => {
    const r = cli(["--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /usage: node cli\/goldens\.mjs/);
});

test("an unknown argument is could-not-run, not a red", () => {
    const r = cli(["--nonsense"]);
    assert.equal(r.status, 2, "exit 1 would report a corpus finding about a command line");
    assert.match(r.stderr, /unknown argument/);
});

test("--pack-root pointing at a FILE is could-not-run, never a misleading green", () => {
    // The third carrier of one rule, found by Copilot on #117: a file-valued root made resolution
    // fail and produced a green that had simply ignored the intended root, and a green is what a
    // session acts on.
    const r = cli(["--pack-root", join(REPO, "package.json")]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /is not a directory/);
});

// Three fallback states, three sentences — because "workspace.json declares none" was printed for all
// three and is FALSE for two of them: a manifest that does not exist declared nothing, and a manifest
// whose named policy was refused declared one and was overruled. Both send a reader to audit the one
// file that is not at fault. `compile.mjs` had already learned this at `undeclaredPolicyMessage`; this
// module copied that call site's shape and not its discipline. Copilot, round 8 on #336.
for (const [label, build, expected] of [
    [
        "no workspace.json at all",
        (root) => mkdirSync(join(root, ".portulan"), { recursive: true }),
        /there is no \.portulan\/workspace\.json, so nothing here has been authored as a workspace yet/,
    ],
    [
        "a manifest with no `gates` key",
        (root) => {
            mkdirSync(join(root, ".portulan"), { recursive: true });
            writeFileSync(join(root, ".portulan/workspace.json"), JSON.stringify({ name: "x" }, null, 2));
        },
        /declares no `gates` key, which is a legitimate shape/,
    ],
]) {
    test(`a workspace with no gate policy is could-not-run, and the message names WHICH — ${label}`, () => {
        const root = mkdtempSync(join(tmpdir(), "portulan-goldens-"));
        try {
            build(root);
            const r = cli(["--workspace", root]);
            assert.equal(r.status, 2, r.stderr);
            assert.match(r.stderr, /no gate policy/);
            assert.match(r.stderr, expected);
            // The control: the one sentence that must NOT be printed for a missing manifest.
            if (label.startsWith("no workspace.json")) {
                assert.doesNotMatch(r.stderr, /declares no `gates` key/, "a file that does not exist declared nothing");
            }
        } finally { cleanup(root); }
    });
}

test("a red exits 1 and prints every finding on stderr", () => {
    const root = mkdtempSync(join(tmpdir(), "portulan-goldens-"));
    try {
        cpSync(join(REPO, ".portulan"), join(root, ".portulan"), { recursive: true });
        cpSync(join(REPO, "packs"), join(root, "packs"), { recursive: true });
        mkdirSync(join(root, CORPUS_DIR), { recursive: true });
        // Named for the rule it declares, because the reader now enforces that — the fixture for a RED
        // must not accidentally be a fixture for a could-not-run.
        writeFileSync(join(root, CORPUS_DIR, "tag-a-release.json"), `${JSON.stringify({ rule: "tag-a-release", cases: [CASE({ input: { command: "git tag v1" } })] }, null, 2)}\n`);
        const r = spawnSync(process.execPath, [join(HERE, "goldens.mjs"), "--workspace", root, "--pack-root", join(root, "packs")], { encoding: "utf8" });
        assert.equal(r.status, 1, r.stderr);
        assert.match(r.stderr, /RED — \d+ finding\(s\)/);
        assert.match(r.stderr, /no fixture attacks it/);
    } finally { cleanup(root); }
});


// ---------------------------------------------------------------------------------------------
// The matcher-path field — session-open adjustment 3, derived rather than declared
// ---------------------------------------------------------------------------------------------

for (const [kind, tool, expected] of [
    ["shell", "Bash", "shell-prefix"],
    ["shell", "Write", "no-branch"],
    ["write", "Write", "matchesPath"],
    ["write", "Edit", "matchesPath"],
    ["write", "NotebookEdit", "matchesPath"],
    ["write", "Bash", "shell-write"],
    ["write", "Read", "no-branch"],
    ["read", "Read", "matchesPath"],
    ["read", "Bash", "no-branch"],
    ["read", "Write", "no-branch"],
]) {
    test(`the matcher path is derived: a ${kind}: rule through ${tool} takes ${expected}`, () => {
        assert.equal(matcherPath(kind, tool), expected);
        assert.ok(PATHS.includes(expected), "every derived value is in the declared vocabulary");
    });
}

test("`no-branch` is a real answer, not a fallthrough for anything unrecognised", () => {
    // It names a combination the matcher has no code for. If an unknown kind quietly answered
    // `no-branch` too, a rule of a NEW action kind would look deliberately unreachable rather than
    // uncovered — which is the same silence the exemption census exists to break.
    assert.equal(matcherPath("read", "Bash"), "no-branch", "a real combination with no branch");
    for (const kind of MATCHABLE) {
        assert.notEqual(matcherPath(kind, "Bash"), undefined);
    }
});

test("a MISLABELLED path is a finding, and the message says it is a mislabel", () => {
    // The field would be decoration if nothing checked it, and a decoration on 212 cases is a
    // second carrier that goes wrong. This is what makes it a record rather than a comment.
    const root = corpus({
        "gate-a": { rule: "gate-a", cases: [CASE({ path: "shell-write" })] },
        "gate-b": { rule: "gate-b", cases: [WRITE_CASE()] },
    });
    try {
        const r = grade(RULES, readCorpus(root));
        assert.equal(r.findings.length, 1);
        assert.match(r.findings[0].what, /declares path `shell-write`.*takes `shell-prefix`/s);
        assert.match(r.findings[0].what, /mislabel rather than a disagreement/);
    } finally { cleanup(root); }
});

test("a mislabelled case is NOT also graded — one defect, one finding", () => {
    // A mislabel plus a wrong `expect` would otherwise print two findings for one broken case, and
    // the second would send a reader to debug a matcher that is behaving.
    const root = corpus({
        "gate-a": { rule: "gate-a", cases: [CASE({ path: "no-branch", expect: false })] },
        "gate-b": { rule: "gate-b", cases: [WRITE_CASE()] },
    });
    try {
        const r = grade(RULES, readCorpus(root));
        assert.equal(r.findings.length, 1, "the mislabel is reported and the grading is skipped");
        assert.doesNotMatch(r.findings[0].what, /REGRESSION/);
    } finally { cleanup(root); }
});

test("the per-path census counts every case, and prints a path at ZERO", () => {
    // A corpus can carry 200 cases and exercise one branch of four. The total says nothing about
    // that; this line is the one that does, which is why it prints the zeroes too.
    const root = corpus({
        "gate-a": { rule: "gate-a", cases: [CASE()] },
        "gate-b": { rule: "gate-b", cases: [WRITE_CASE()] },
    });
    try {
        const r = grade(RULES, readCorpus(root));
        assert.equal(r.byPath.get("shell-prefix"), 1);
        assert.equal(r.byPath.get("shell-write"), 1);
        assert.equal(r.byPath.get("matchesPath"), undefined, "absent here, printed as 0 by the CLI");
    } finally { cleanup(root); }
});

test("this repository's corpus exercises EVERY matcher path, not just the cheap one", () => {
    const { rules } = yieldedRules(REPO, { packRoots: [join(REPO, "packs")] });
    const r = grade(rules, readCorpus(REPO));
    for (const p of PATHS) {
        assert.ok((r.byPath.get(p) ?? 0) > 0, `no case exercises ${p} — the corpus has a blind branch`);
    }
});

test("the two segmenters disagree about one leader, and the corpus records BOTH answers", () => {
    // The asymmetry the path field exists for. A `then` leader is CAUGHT on the write path, because
    // `shellSegments` knows SEGMENT_LEADERS, and ESCAPES on the shell path, because `commandSegments`
    // does not. Without the field a reader meets two cases that look like a contradiction.
    const constitution = JSON.parse(readFileSync(join(REPO, CORPUS_DIR, "edit-the-constitution.json"), "utf8"));
    const force = JSON.parse(readFileSync(join(REPO, CORPUS_DIR, "force-push-without-a-lease.json"), "utf8"));
    const caught = constitution.cases.find((c) => c.id === "a-then-branch-leader");
    const escapes = force.cases.find((c) => c.id === "a-then-branch-still-escapes");
    assert.equal(caught.path, "shell-write");
    assert.equal(caught.expect, true);
    assert.equal(escapes.path, "shell-prefix");
    assert.equal(escapes.expect, false);
    assert.equal(escapes.class, "documented-hole", "the escaping half is a hole and must name one");
});

test("an UNEXPECTED throw is could-not-run, never a red", () => {
    // The first draft rethrew, so a ReferenceError from a typo crashed the process, node exited 1,
    // and the recipe faithfully printed "RED — verify recipe failed" about a corpus nothing had
    // finished grading. Measured on this module, not reasoned about.
    const root = mkdtempSync(join(tmpdir(), "portulan-goldens-"));
    try {
        // A directory where a fixture file must be: readdirSync lists it, readFileSync raises EISDIR,
        // which is neither of the two errors `run` translates.
        cpSync(join(REPO, ".portulan"), join(root, ".portulan"), { recursive: true });
        cpSync(join(REPO, "packs"), join(root, "packs"), { recursive: true });
        mkdirSync(join(root, CORPUS_DIR, "not-a-file.json"), { recursive: true });
        const r = spawnSync(process.execPath, [join(HERE, "goldens.mjs"), "--workspace", root, "--pack-root", join(root, "packs")], { encoding: "utf8" });
        assert.equal(r.status, 2, `exit 1 would read as a corpus finding — got ${r.status}: ${r.stderr}`);
        assert.match(r.stderr, /goldens: /);
    } finally { cleanup(root); }
});

test("a case with no path, or an unknown one, is could-not-run", () => {
    for (const bad of [undefined, "", "matchesrule", "shell"]) {
        const root = corpus({ "gate-a": { rule: "gate-a", cases: [CASE({ path: bad })] } });
        try {
            assert.throws(
                () => readCorpus(root),
                (e) => e instanceof CouldNotRun && /declares path/.test(e.message),
                `path ${JSON.stringify(bad)} must be refused`,
            );
        } finally { cleanup(root); }
    }
});

test("the classes are exactly two, and a third would need its own argument", () => {
    assert.deepEqual(CLASSES, ["holds", "documented-hole"]);
});

test("the recipe declares this runner and the manifest yields it", () => {
    const manifest = JSON.parse(readFileSync(join(REPO, ".portulan/workspace.json"), "utf8"));
    const recipe = manifest.verify.recipes.find((r) => r.id === "goldens");
    assert.ok(recipe, "a recipe nothing declares is a check CI never runs");
    assert.equal(recipe.run, "./.portulan/verify/goldens.sh");
    assert.deepEqual(recipe.requires, ["bash", "node"], "no git — this recipe reads the working tree, never the index");
    const set = execFileSync(process.execPath, [join(HERE, "recipe-set.mjs"), "--workspace", join(REPO, ".portulan"), "--repo-root", REPO, "--pack-root", join(REPO, "packs")], { encoding: "utf8" });
    assert.match(set, /^goldens\t/m, "declared and runnable are two lists; this asserts the second");
});
