// The required checks name their resolution root, and this is what makes that a rail.
//
// **Why this file exists.** A pre-commit checkpoint stripped all six `--pack-root packs` from the
// tree at once and everything stayed green: eleven recipes, 1535 tests, nothing red. The pins were
// shell prose. Removing the one in `doctor.sh` silently reverts `examples/` to green-by-not-looking —
// its declared packs reported *unverifiable* rather than graded — which is the exact fail-open class
// the change that added the pins was written to close. A containment nothing enforces is a comment.
//
// **What a pinned root buys, said once.** A named root REPLACES every other source, so a check that
// names one cannot consult the host's plugin cache whatever the unasked default becomes. That is what
// keeps a required check's verdict a statement about the TREE rather than about the machine running
// it — the property the 2026-08-09 narrowing was protecting, kept without the narrowing.
//
// **The limit, stated rather than discovered.** This reads the invocation lines as text. It cannot
// tell that the root is *correct*, only that one is named; and a caller that pins by building the
// argument list dynamically would pass while naming nothing. Both are out of reach of a text sweep,
// and a stronger check would need the recipes to report their own plan — which is worth doing when a
// second pinned caller wants it, not before.
//
// ## The second subject, added 2026-08-13 with the disposal: the SUITE's own hermeticity
//
// A pinned root keeps a required *check* off the host. Nothing kept the **suite** off it, and from the
// day the tools began consulting discovery on the unasked path that mattered: measured on the
// disposal's branch, **nine cases** across `compile.test.mjs` and `index.test.mjs` failed on a machine
// carrying an installed pack and passed on an empty host. A suite whose verdict depends on the
// developer's plugin inventory is worse than a red one, because the direction of the error is
// unpredictable — a fixture can start passing for a reason its author never wrote down.
//
// The containment is one line per test file — `process.env.CLAUDE_CONFIG_DIR` pointed at an empty
// directory that EXISTS, so discovery *answers* `absent` rather than being unable to look — and the
// sweep below is what stops the next test file omitting it.
//
// **Its limits, both of them measured rather than reasoned.** It reads the file as text, so it knows the
// line is present and not that it runs before the first case. And **its membership rule was wrong when
// first written**: it mapped `<module>.mjs` to `<module>.test.mjs`, which structurally cannot see a
// `.live.test.mjs` sibling, so `cli/upgrade.live.test.mjs` was reading the real machine while this
// header claimed otherwise. Membership is derived from the test file's own **imports** now. What the
// sweep buys is that a new test file reaching an in-closure module cannot be silently un-neutralised.
//
// _Its correctness was established by measurement rather than by argument: with the guards in place the
// full suite was run twice, against two different `CLAUDE_CONFIG_DIR` values, and the failure lists were
// byte-identical. That comparison is the real proof and it is not automated here — it costs two full
// suite runs, and a rail that nobody will wait for is a rail that gets switched off._

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Every invocation that MUST name a root, with the tool it invokes.
 *
 * A roster rather than a sweep, deliberately, and the difference is worth one sentence: a sweep would
 * ask "does every invocation of these tools pin?", which is false by design — `cli/`'s own tests and
 * an adopter's command line legitimately do not. The question here is narrower and is the one that
 * matters: **does every REQUIRED check pin?** That set is enumerated in policy, so it is enumerated
 * here, and a seventh required invocation added without a pin is caught by the count assertion below
 * rather than by this list silently not mentioning it.
 */
const PINNED = Object.freeze([
    { file: ".portulan/verify/doctor.sh", tool: "cli/doctor.mjs" },
    { file: ".portulan/verify/compile.sh", tool: "cli/compile.mjs" },
    { file: ".portulan/verify/index.sh", tool: "cli/index.mjs" },
    { file: ".portulan/verify/plugin.sh", tool: "cli/skills-set.mjs" },
    // Added 2026-08-24 with the recipe. `goldens.mjs` refuses discovery internally — it passes
    // `discovery: null` whatever the command line says — so this pin is the SECOND of two carriers
    // rather than the only one. Rostered anyway: the internal refusal is one edit from being relaxed,
    // and a roster that skips a check because its tool is currently well-behaved is a roster that
    // records today's implementation rather than the requirement.
    { file: ".portulan/verify/goldens.sh", tool: "cli/goldens.mjs" },
    // Added 2026-08-25 with milestone 8 clause (b). Both reach the policy through `goldens.mjs` and
    // so inherit its internal refusal of host discovery, and both are rostered for the reason the
    // entry above gives: an internal refusal is one edit from being relaxed.
    { file: ".portulan/verify/mutants.sh", tool: "cli/mutants.mjs" },
    { file: ".portulan/verify/fuzz-shell.sh", tool: "cli/fuzz-shell.mjs" },
    // Added 2026-08-25 with milestone 8 clause (d). `drills.mjs` reaches the yielded recipe SET rather
    // than the policy, and refuses host discovery internally the same way — it passes `discovery: null`
    // and `forced: false` whatever the command line says. Rostered for the reason the two entries above
    // give: an internal refusal is one edit from being relaxed, and this rail's whole subject is a check
    // that has quietly stopped checking.
    { file: ".portulan/verify/drills.sh", tool: "cli/drills.mjs" },
    // Added 2026-08-28 with milestone 8's OTel clause. `telemetry.mjs` reaches the yielded recipe set
    // for its `--audit-recipes` mode, through `recipe-set.mjs` directly rather than through `drills.mjs`,
    // and passes `discovery: null` and `forced: false` whatever the command line says. Rostered on the
    // same reasoning as the four entries above — an internal refusal is one edit from being relaxed —
    // and with the extra weight that this rail's answer is about which recipes can reach the NETWORK: a
    // recipe set resolved from the host rather than from the tree would grade a different set than the
    // one CI runs.
    { file: ".portulan/verify/telemetry.sh", tool: "cli/telemetry.mjs" },
    { file: ".github/workflows/verify.yml", tool: "cli/recipe-set.mjs" },
    { file: ".portulan/dod.md", tool: "cli/recipe-set.mjs" },
]);

const readLines = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8").split("\n");

/**
 * Lines that name a run of the tool, with whole-line `#` comments stripped first.
 *
 * **Described at its real width, because the first draft was not.** It said "a line that RUNS the
 * tool, never one that merely mentions it in prose", and the matcher does no such thing — it takes any
 * surviving line containing `node <tool>`. That is deliberate rather than sloppy: the sixth pinned
 * site is `.portulan/dod.md`, where the command sits **inside prose, in backticks**, and is a command
 * a reader copies. A matcher that excluded prose would exclude the one carrier most likely to be
 * copied wrong.
 *
 * What the stripping buys is narrower and real: a shell comment ABOVE an invocation, explaining it,
 * does not count as a second invocation. What it cannot do is tell a documented example from a live
 * one on the same line — which would matter if a file ever wrote "do not run `node cli/doctor.mjs`
 * without a root", and does not today. Raised as a promoted note by Copilot, round 2 on #236.
 */
function invocations(rel, tool) {
    return readLines(rel).filter((line) => line.replace(/^\s*#.*$/, "").includes(`node ${tool}`));
}

test("every required check names its resolution root", () => {
    const unpinned = [];
    for (const { file, tool } of PINNED) {
        const lines = invocations(file, tool);
        assert.ok(lines.length > 0, `${file} no longer invokes ${tool} — this roster is stale`);
        for (const line of lines) {
            if (!/--pack-root\s+\S/.test(line)) unpinned.push(`${file}: ${line.trim()}`);
        }
    }
    assert.deepEqual(
        unpinned,
        [],
        "a required check with no named root inherits the machine it runs on — see this file's header",
    );
});

test("the roster covers every verify recipe that invokes a root-taking tool", () => {
    // The count assertion the roster leans on. If a recipe grows an invocation of a tool that takes
    // `--pack-root`, this goes red and somebody has to decide whether it pins — rather than the
    // roster quietly not mentioning it, which is how a list stops being a rail.
    // EVERY tool that accepts `--pack-root`, not just the ones a recipe happens to call today. The
    // first cut listed five and omitted `init` and `vendor`, so a recipe invoking either would have
    // slipped past the sweep — this rail carrying the exact hole it exists to catch. Copilot, round 1
    // on #236. Derived rather than remembered: a tool takes a root if its source parses the flag.
    const takesRoot = fs
        .readdirSync(path.join(REPO, "cli"))
        .filter((f) => f.endsWith(".mjs") && !f.includes(".test."))
        // Quote-agnostic. The first derivation searched for the double-quoted spelling alone, so a
        // tool parsing `'--pack-root'` would have been missed — this rail carrying a NARROWER version
        // of the hole it had just been fixed for, two rounds running. Copilot, round 3 on #236.
        .filter((f) => /["']--pack-root["']/.test(fs.readFileSync(path.join(REPO, "cli", f), "utf8")))
        .map((f) => `cli/${f}`);
    assert.ok(takesRoot.length >= 5, `expected several root-taking tools, derived ${takesRoot.length}`);
    const found = [];
    for (const entry of fs.readdirSync(path.join(REPO, ".portulan", "verify"))) {
        if (!entry.endsWith(".sh")) continue;
        const rel = path.join(".portulan", "verify", entry);
        for (const tool of takesRoot) {
            if (invocations(rel, tool).length) found.push(`${rel}:${tool}`);
        }
    }
    const rostered = new Set(PINNED.map((p) => `${p.file}:${p.tool}`));
    assert.deepEqual(
        found.filter((f) => !rostered.has(f)),
        [],
        "a verify recipe invokes a root-taking tool and is not in this file's roster",
    );
});

/**
 * The block every test file in the closure must carry. Asserted as a substring, not re-spelled.
 *
 * **The cleanup line is part of it, and that is a round-2 finding rather than tidiness.** The guard
 * creates a temp directory per test file and nothing removed it: measured 2026-08-13, **18 leaked
 * directories per full suite run**, and four thousand accumulated in a single session of running the
 * suite. Copilot's suppressed notes named three files; the fix is at all eighteen, because three named
 * sites are the shape `../.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md`
 * exists against. Asserting the whole block is what stops the next file copying the two lines that
 * neutralise the host and dropping the one that tidies up.
 *
 * The path is captured in a `const` rather than re-read from `process.env` at exit: several suites
 * save, overwrite and restore that variable around a case, and a handler reading it at exit would
 * remove whatever happened to be there instead of what the guard made.
 */
const HERMETIC = [
    'const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));',
    "process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;",
    'process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));',
].join("\n");

/**
 * Does this source IMPORT that module — as a statement, not as a mention?
 *
 * **Bounded by the statement's semicolon, and that is the third spelling of this predicate rather than
 * the first.** Both earlier ones measured less than they claimed:
 *
 * 1. A bare substring test made **this file** a member of its own closure — it contains the literal
 *    `from "./recipe-set.mjs"` as the *data* for the severing case below, so the instrument counted its
 *    own test data as evidence.
 * 2. Anchoring to a single LINE fixed that and silently dropped `compile.test.mjs`, `doctor.test.mjs`
 *    and `index.test.mjs` — the three whose imports are **multi-line**, and the three that matter most.
 *    The sweep stayed green throughout, because those files were guarded anyway: a rail can lose its
 *    most important members and report nothing. Caught by the mutation harness, which removed a guard
 *    and found the sweep no longer noticed.
 *
 * `[^;]*?` is what makes both true at once: an import statement contains no semicolon before its `from`,
 * however many lines it spans, and a string literal mentioning one is always separated from any earlier
 * `import` by at least one semicolon.
 *
 * **A DYNAMIC import counts, and leaving it out was the same defect a third time.** `cli/new.test.mjs`
 * reaches `doctor` only through an awaited dynamic import, so a static-import predicate could not see it
 * — and that file **was** consulting the real machine, measured by a checkpoint that instrumented
 * `readInstalls` and found exactly one ambient consult across the whole suite. It is the pointer half,
 * which is reported and never graded, so no verdict moved today; it becomes the pack arm the moment a
 * scaffolded workspace declares packs. Static membership derived without its dynamic sibling is
 * `../.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md` inside the rail built
 * against it, for the third time in one change.
 *
 * **This paragraph deliberately does not SPELL a dynamic import**, and the omission is the point rather
 * than a style choice: writing the call with its specifier inline put this file back into its own
 * closure the moment the dynamic pattern was added, and the self-membership assertion below caught it
 * within a minute of being written. A predicate that reads source cannot tell prose from code, so prose
 * about it has to avoid the shapes it matches — which is a real cost of the design and is stated rather
 * than left for the next person to rediscover.
 */
function importsModule(src, mod) {
    const spec = mod.replace(/\./g, "\\.");
    const statically = new RegExp(`(?:^|\\n)\\s*import\\b[^;]*?from\\s+"\\./${spec}"`);
    // `import(` with the specifier attached, so a bare mention in prose or a string still does not count.
    const dynamically = new RegExp(`\\bimport\\s*\\(\\s*"\\./${spec}"`);
    return statically.test(src) || dynamically.test(src);
}

/**
 * Every test file whose subject can reach the host's plugin record, derived rather than listed.
 *
 * Two hops: a module that calls `discoverPackRoots` directly, plus a module that imports one of those.
 * `upgrade` and `vendor` are only in the set through the second hop — they never mention discovery and
 * acquired its behaviour through `doctor`'s `inspect`, which is exactly the reason this is derived. A
 * hand-written list would have held the five obvious files and missed those two.
 *
 * **The test side is derived from IMPORTS too, and mapping by filename was a real hole rather than a
 * stylistic choice.** It read `<module>.mjs` → `<module>.test.mjs`, which structurally cannot see a
 * `.live.test.mjs` sibling: `cli/upgrade.live.test.mjs` reached the host's record through the new
 * unasked arm — traced `upgrade.run` → `doctor`'s `inspect` → `resolutionRoots` → `readInstalls` — and
 * this sweep could never have flagged it, while the header above claimed it would. Found by the
 * pre-commit checkpoint, in the rail this change added **against that class**, which is
 * `../.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md` at its sharpest: the fix
 * landed at twelve sites and not at their `.live` siblings.
 */
function hermeticClosure(read = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8")) {
    const entries = fs.readdirSync(path.join(REPO, "cli")).filter((f) => f.endsWith(".mjs"));
    const modules = entries.filter((f) => !f.includes(".test."));
    const direct = modules.filter((f) => /discoverPackRoots\(/.test(read(`cli/${f}`)));
    const closure = new Set(direct);
    // Two passes rather than one: `librarian.mjs` reaches discovery through `index.mjs`, so a single
    // pass over `direct` would miss it.
    for (let hop = 0; hop < 2; hop += 1) {
        for (const f of modules) {
            const src = read(`cli/${f}`);
            for (const seen of [...closure]) {
                if (importsModule(src, seen)) closure.add(f);
            }
        }
    }
    return entries
        .filter((f) => f.endsWith(".test.mjs"))
        .filter((f) => {
            const src = read(`cli/${f}`);
            return [...closure].some((m) => importsModule(src, m));
        })
        .sort();
}

test("every test file whose tool can reach the host's plugin record neutralises it", () => {
    const closure = hermeticClosure();
    // **The floor is the MEASURED size, not a comfortable margin.** It was `>= 10`, which a derivation
    // missing its three most important members satisfied; raised to `>= 14`, which still left two members
    // free to drop in silence. A count assertion cannot tell a broad set from a broad-enough one, so it
    // is pinned at what the tree actually holds and the members whose absence a count could hide are
    // named — one per failure mode this predicate has actually had: multi-line imports, and a dynamic one.
    assert.ok(closure.length >= 17, `the closure shrank to ${closure.length}: ${closure.join(" ")} — see \`importsModule\``);
    for (const owed of ["compile.test.mjs", "doctor.test.mjs", "index.test.mjs", "upgrade.live.test.mjs", "new.test.mjs"]) {
        assert.ok(closure.includes(owed), `${owed} dropped out of the derived closure — see \`importsModule\``);
    }
    // **The instrument must not be its own evidence.** A substring predicate makes this file a member of
    // its own closure, because it holds `from "./recipe-set.mjs"` as the severing case's data — and the
    // guard check would then pass anyway, since the file also holds `HERMETIC` as a constant. So that
    // failure mode was unbindable by the sweep until this line: it is the only assertion that reds under
    // it. Measured by regressing the predicate to a substring match and watching this go red.
    assert.equal(closure.includes("pinned-roots.live.test.mjs"), false, "the sweep counted its own test data as an import");
    const unguarded = closure.filter((f) => !fs.readFileSync(path.join(REPO, "cli", f), "utf8").includes(HERMETIC));
    assert.deepEqual(
        unguarded,
        [],
        "a test file whose tool consults the plugin record reads the machine it runs on — see this file's header",
    );
});

test("the closure is derived from the imports, not from a list — shown by severing one", () => {
    // **The rail's own rail.** The sweep above passes trivially if `hermeticClosure` returns few files or
    // the wrong ones, and a derivation nobody has forced is a list with extra steps. So the derivation is
    // re-run against a substituted reader with one import removed, and the assertion is that the file
    // DROPS OUT — only possible if membership comes from the import graph.
    //
    // `stop-gate.mjs` is the subject because it reaches discovery by **exactly one** route
    // (`recipe-set.mjs`). The first draft of this case used `librarian.mjs` and asserted the wrong thing:
    // librarian imports `doctor.mjs` **and** `index.mjs`, both direct members, so severing one changed
    // nothing and the case failed for a reason that was about the fixture rather than the derivation.
    // Measured, not assumed — the route count of every second-hop member was listed before choosing.
    const real = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8");
    assert.ok(hermeticClosure(real).includes("stop-gate.test.mjs"), "the two-hop member is missing from the closure");

    const severed = (rel) => (rel === "cli/stop-gate.mjs" ? real(rel).replaceAll('from "./recipe-set.mjs"', 'from "./nothing.mjs"') : real(rel));
    assert.equal(
        hermeticClosure(severed).includes("stop-gate.test.mjs"),
        false,
        "membership must follow the imports; it did not change when the only route was removed",
    );
    // And the sever is a real one: a typo in the pattern would leave the source untouched and this case
    // would then be asserting nothing at all.
    assert.notEqual(severed("cli/stop-gate.mjs"), real("cli/stop-gate.mjs"), "the substitution changed nothing");
});
