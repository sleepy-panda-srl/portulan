// `upgrade` — the migration chain, and the two kinds of step.
//
//   node --test "cli/**/*.test.mjs"
//
// Written before the tool. Row 7 says the CLI ships `upgrade` and that it *"migrates a workspace in
// either residence"*; `spec/migrations/README.md` is the contract this file grades against.
//
// ## What this file must not become
//
// A suite that builds its own idea of a workspace and then agrees with itself. This repository has
// measured **seven** instances of a harness inheriting the blind spot of the change it checks, two of
// them in the session immediately before this one. So the split is deliberate:
//
// - **Here**: the step contract, the chain's arithmetic, the pre-state gate, the exit codes, and the
//   refusals — against `ws` views built in memory, which is the honest way to force a step's own
//   branches red.
// - **`upgrade.live.test.mjs`**: the same tool against workspaces the **real `init`** drafts and
//   against this repository's own two workspaces, because the repair's whole subject is a workspace
//   that travelled and no fixture written here has ever travelled anywhere.
//
// ## The one thing a green here cannot mean
//
// That `0001` was exercised on a real workspace. **Nothing in this tree declares Workspace Definition
// 1.0** — `.portulan` is 2.8, `examples/` is 2.4, the drifted fixture is 2.0 — so the version step is
// fixture-only, said here rather than left for a reader to infer from a passing suite.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bundleSpec, loadSteps, planFor, readWorkspace, resolveTarget, restore, run, UpgradeError } from "./upgrade.mjs";
import { inspect } from "./doctor.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const MARKER = "portulan:bundle-fallback";

const scratches = [];
function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-upgrade-"));
    scratches.push(dir);
    return dir;
}
process.on("exit", () => {
    for (const dir of scratches) fs.rmSync(dir, { recursive: true, force: true });
});

/** A harness that captures both streams, so a test can assert what a user was told. */
function harness() {
    const out = [];
    const err = [];
    return {
        out,
        err,
        text: () => `${out.join("")}${err.join("")}`,
        options: { stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } },
    };
}

/**
 * A `ws` view built in memory — the shape `spec/migrations/README.md` promises a step.
 *
 * In memory rather than on disk **on purpose**: a step's `owed` has branches that a real directory
 * makes expensive to reach (an unreadable file, a marked line of the wrong shape), and a branch that
 * is expensive to reach is a branch that ends up untested.
 */
function view(manifest, files = {}, dir = "/nowhere") {
    const text = `${JSON.stringify(manifest, null, 2)}\n`;
    return {
        dir,
        manifest,
        manifestText: text,
        list: () => Object.keys(files),
        read: (rel) => {
            if (!(rel in files)) throw new UpgradeError(`${rel} is not in this workspace`);
            if (files[rel] === null) throw new UpgradeError(`${rel} could not be read — EACCES`);
            return files[rel];
        },
    };
}

/** A governing manifest, minimal and legal, at whatever spec version a case needs. */
function manifest(spec, extra = {}) {
    return {
        portulan: { spec },
        name: "acme",
        kind: "repository",
        slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" },
        verify: { default: "workspace", recipes: [{ id: "workspace", run: "./verify/workspace.sh" }] },
        ...extra,
    };
}

/** A drafted rail's two marked lines, as `cli/init.mjs` writes them. */
function railWith(bundle) {
    return [
        "#!/usr/bin/env bash",
        'set -uo pipefail',
        `elif [ -f ${JSON.stringify(`${bundle}/cli/index.mjs`)} ]; then # ${MARKER}`,
        "    need_node",
        `    set -- node ${JSON.stringify(`${bundle}/cli/index.mjs`)} # ${MARKER}`,
        "fi",
        "",
    ].join("\n");
}

const steps = await loadSteps();
const stepById = (id) => steps.find((s) => s.id.startsWith(id));

// ===========================================================================================

describe("the step contract — every module in spec/migrations/ satisfies it", () => {
    test("the directory yields at least the two steps this session ships", () => {
        assert.ok(steps.length >= 2, `expected the chain to carry both steps, got ${steps.length}`);
    });

    test("ids are unique, and the order is the id order rather than the directory's", () => {
        const ids = steps.map((s) => s.id);
        assert.deepEqual(ids, [...ids].sort(), "the chain must be in id order");
        assert.equal(new Set(ids).size, ids.length, "two steps share an id");
    });

    test("every step declares a known kind, and only a version step carries from/to", () => {
        for (const step of steps) {
            assert.ok(["version", "repair"].includes(step.kind), `${step.id} declares kind \`${step.kind}\``);
            assert.equal(typeof step.title, "string");
            assert.equal(typeof step.why, "string");
            assert.equal(typeof step.owed, "function");
            assert.equal(typeof step.plan, "function");
            if (step.kind === "version") {
                assert.match(step.from, /^[0-9]+\.[0-9]+$/, `${step.id} is a version step with no \`from\``);
                assert.match(step.to, /^[0-9]+\.[0-9]+$/, `${step.id} is a version step with no \`to\``);
            } else {
                assert.equal(step.from, null, `${step.id} is a repair and must not claim a version range`);
                assert.equal(step.to, null);
            }
        }
    });

    test("no step reaches the pack train — the README's first stated limit", () => {
        // Two version trains exist. A step touching `portulan.pack` would be migrating a contract
        // this chain does not govern, and the failure would be silent.
        for (const step of steps) {
            const source = fs.readFileSync(path.join(REPO, "spec", "migrations", `${step.id}.mjs`), "utf8");
            assert.doesNotMatch(source, /portulan\s*\.\s*pack\b|"pack"\s*:/, `${step.id} reaches the Pack Definition`);
        }
    });
});

describe("the bundle's spec version is derived, never written down", () => {
    test("it comes from the schema's $id, so there is no second carrier of the current version", () => {
        const derived = bundleSpec();
        const id = JSON.parse(fs.readFileSync(path.join(REPO, "spec", "workspace.schema.json"), "utf8")).$id;
        assert.match(id, new RegExp(`/spec/${derived.major}\\.${derived.minor}/`));
    });

    test("no literal current version is spelled in the tool", () => {
        const source = fs.readFileSync(path.join(REPO, "cli", "upgrade.mjs"), "utf8");
        const { major, minor } = bundleSpec();
        // The version as a bare quoted string. `2.0` may legitimately appear as step 0001's target.
        assert.doesNotMatch(source, new RegExp(`["'\`]${major}\\.${minor}["'\`]`), "the current spec version is written down in upgrade.mjs");
    });
});

// ===========================================================================================
// Step 0001 — the version step
// ===========================================================================================

describe("0001 — a repository workspace declares its tree", () => {
    const step = () => stepById("0001");

    test("owed on a 1.0 manifest, and not owed once the manifest is 2.x", () => {
        assert.equal(step().owed(view(manifest("1.0"))).owed, true);
        assert.equal(step().owed(view(manifest("2.0", { tree: "../" }))).owed, false, "applying it twice must change nothing");
        assert.equal(step().owed(view(manifest("2.8", { tree: "../" }))).owed, false);
    });

    test("a demo or portfolio takes the version bump and nothing else", () => {
        const ws = view(manifest("1.0", { kind: "demo" }));
        const planned = step().plan(ws, { bundle: REPO, spec: bundleSpec(), tree: null });
        assert.equal(planned.ok, true, planned.reason);
        const next = JSON.parse(planned.edits.find((e) => e.file === "workspace.json").next);
        assert.equal(next.portulan.spec, "2.0");
        assert.equal("tree" in next, false, "a demo has no tree to declare and must not acquire one");
    });

    test("it REFUSES to guess a repository's tree rather than writing `../` hopefully", () => {
        // `/nowhere/..` is not a repository root, so there is nothing to derive from.
        const planned = step().plan(view(manifest("1.0")), { bundle: REPO, spec: bundleSpec(), tree: null });
        assert.equal(planned.ok, false);
        assert.match(planned.reason, /--tree/, "a refusal must name what the human can do next");
    });

    test("an explicit --tree is taken, and lands beside the bumped version", () => {
        const planned = step().plan(view(manifest("1.0")), { bundle: REPO, spec: bundleSpec(), tree: "../../" });
        assert.equal(planned.ok, true, planned.reason);
        const next = JSON.parse(planned.edits[0].next);
        assert.equal(next.tree, "../../");
        assert.equal(next.portulan.spec, "2.0");
    });

    test("`../` IS derived where the parent is verifiably a repository root — and a worktree's .git is a FILE", () => {
        // This repository is currently checked out as a worktree, where `.git` is a file rather than
        // a directory. A directory-only test would have been green in this suite and wrong for every
        // worktree user — which is this project's own recurring shape, so both are forced here.
        for (const kind of ["dir", "file"]) {
            const root = scratch();
            const wsDir = path.join(root, ".portulan");
            fs.mkdirSync(wsDir);
            if (kind === "dir") fs.mkdirSync(path.join(root, ".git"));
            else fs.writeFileSync(path.join(root, ".git"), "gitdir: /elsewhere\n");
            const planned = step().plan(view(manifest("1.0"), {}, wsDir), { bundle: REPO, spec: bundleSpec(), tree: null });
            assert.equal(planned.ok, true, `${kind}: ${planned.reason}`);
            assert.equal(JSON.parse(planned.edits[0].next).tree, "../");
        }
    });

    test("the manifest's other keys and its key order survive the bump", () => {
        const ws = view(manifest("1.0", { summary: "one line", packs: ["tools/github"] }));
        const planned = step().plan(ws, { bundle: REPO, spec: bundleSpec(), tree: "../" });
        const next = JSON.parse(planned.edits[0].next);
        assert.equal(next.summary, "one line");
        assert.deepEqual(next.packs, ["tools/github"]);
        assert.deepEqual(Object.keys(next).slice(0, 3), ["portulan", "name", "kind"], "re-assignment must not reorder the manifest");
    });
});

// ===========================================================================================
// Step 0002 — the repair
// ===========================================================================================

describe("0002 — the bundle path a rewriter owes", () => {
    const step = () => stepById("0002");
    const ctx = () => ({ bundle: REPO, spec: bundleSpec(), tree: null });

    test("owed when a marked line names another bundle", () => {
        const ws = view(manifest("2.8", { tree: "../" }), { "verify/index.sh": railWith("/somewhere/else") });
        assert.equal(step().owed(ws, ctx()).owed, true);
    });

    test("NOT owed when the marked lines already name this bundle — idempotence, asserted not assumed", () => {
        const ws = view(manifest("2.8", { tree: "../" }), { "verify/index.sh": railWith(REPO) });
        assert.equal(step().owed(ws, ctx()).owed, false);
    });

    test("not owed when nothing carries the marker at all — this repository's own state", () => {
        const ws = view(manifest("2.8", { tree: "../" }), { "verify/index.sh": "#!/usr/bin/env bash\nexit 0\n" });
        assert.equal(step().owed(ws, ctx()).owed, false);
    });

    test("a file that cannot be READ is `could not tell`, never `not owed`", () => {
        // The whole of *an empty set is two questions*. A read that failed must not answer the
        // question it could not look at.
        const ws = view(manifest("2.8", { tree: "../" }), { "verify/index.sh": null });
        const answer = step().owed(ws, ctx());
        assert.equal(answer.owed, null, "an unreadable file answered a question nobody could look at");
        assert.match(answer.because, /could not be read|EACCES/);
    });

    test("BOTH marked lines are rewritten, and nothing else in the file moves", () => {
        const before = railWith("/somewhere/else");
        const ws = view(manifest("2.8", { tree: "../" }), { "verify/index.sh": before });
        const planned = step().plan(ws, ctx());
        assert.equal(planned.ok, true, planned.reason);
        const after = planned.edits[0].next;
        assert.equal(after.split("\n").filter((l) => l.includes(MARKER)).length, 2);
        assert.equal(after.includes("/somewhere/else"), false, "a marked line kept the stale path");
        assert.equal(after.split("\n").filter((l) => l.includes(REPO)).length, 2);
        assert.equal(after.split("\n")[0], "#!/usr/bin/env bash", "an unmarked line was touched");
        assert.equal(after.split("\n").length, before.split("\n").length, "the rewrite changed the line count");
    });

    test("a marked line whose shape it does not recognise is REFUSED, not rewritten hopefully", () => {
        const rail = `set -- node /opt/whatever # ${MARKER}\n`;
        const ws = view(manifest("2.8", { tree: "../" }), { "verify/index.sh": rail });
        const planned = step().plan(ws, ctx());
        assert.equal(planned.ok, false, "an unrecognised marked line must not be rewritten by guesswork");
        assert.match(planned.reason, /verify\/index\.sh/);
    });

    test("it repairs a marked line WHEREVER it is, not only in verify/index.sh", () => {
        // The marker is the contract — `cli/init.mjs` says so in as many words. Keying on the
        // filename instead would be a second, narrower carrier of the same rule.
        const ws = view(manifest("2.8", { tree: "../" }), { "verify/other.sh": railWith("/somewhere/else") });
        assert.equal(step().owed(ws, ctx()).owed, true);
        assert.equal(step().plan(ws, ctx()).edits[0].file, "verify/other.sh");
    });

    test("a document that TALKS about the marker is not a marked line", () => {
        // Found by running this step against `.portulan` rather than against these fixtures: a
        // handoff documents the marker in a sentence, and the first cut refused the whole workspace
        // over it — exit 2, on the one workspace this repository owns. A token appears in prose.
        const prose = `Both lines now carry the token \`# ${MARKER}\` — a rewriter can find them.\n`;
        const ws = view(manifest("2.8", { tree: "../" }), { "handoffs/2026-08-11-a-handoff.md": prose });
        assert.equal(step().owed(ws, ctx()).owed, false, "a paragraph about the marker was read as a marked line");
        assert.deepEqual(step().plan(ws, ctx()).edits, [], "and nothing in it may be rewritten");
    });

    test("the scope is scripts, not `verify/index.sh` — the marker stays the carrier", () => {
        // Narrowing to a filename would make a second and narrower carrier of the rule the marker
        // exists to BE. A shebang is enough; so is a `.sh` name.
        const stale = railWith("/somewhere/else");
        for (const rel of ["verify/index.sh", "verify/other.sh", "tools/rail"]) {
            const ws = view(manifest("2.8", { tree: "../" }), { [rel]: stale });
            assert.equal(step().owed(ws, ctx()).owed, true, `${rel} carries a stale rail and was skipped`);
        }
    });

    test("a bundle path containing `$&` is spliced verbatim, not read as a replacement pattern", () => {
        // `String.prototype.replace` reads `$&`, `` $` ``, `$'` and `$$` in the replacement as
        // patterns. With a string replacer, a checkout under such a directory wrote a rail with the
        // OLD path spliced back in and the quoting broken — and `doctor` grades that green, because
        // it never runs shell. Found at the pre-commit checkpoint by building the path.
        for (const nasty of ["/tmp/a$&b", "/tmp/a$`b", "/tmp/a$'b", "/tmp/a$$b"]) {
            const ws = view(manifest("2.8", { tree: "../" }), { "verify/index.sh": railWith("/somewhere/else") });
            const planned = step().plan(ws, { bundle: nasty, spec: bundleSpec(), tree: null });
            assert.equal(planned.ok, true, planned.reason);
            const after = planned.edits[0].next;
            for (const line of after.split("\n").filter((l) => l.includes(MARKER))) {
                assert.ok(line.includes(`${nasty}/cli/index.mjs`), `${nasty}: the path was mangled — ${line}`);
            }
            assert.equal(after.includes("/somewhere/else"), false, `${nasty}: the stale path survived the rewrite`);
        }
    });

    test("a path that still resolves is re-pointed anyway — the README's second stated limit", () => {
        // Deterministic beats conditional: repairing only what is broken HERE makes the result
        // depend on which machine ran it.
        const other = scratch();
        fs.mkdirSync(path.join(other, "cli"), { recursive: true });
        fs.writeFileSync(path.join(other, "cli", "index.mjs"), "// a real, resolvable second checkout\n");
        const ws = view(manifest("2.8", { tree: "../" }), { "verify/index.sh": railWith(other) });
        assert.equal(step().owed(ws, ctx()).owed, true, "a resolvable foreign bundle is still not this one");
        assert.match(step().plan(ws, ctx()).edits[0].next, new RegExp(REPO.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    });
});

// ===========================================================================================
// The chain
// ===========================================================================================

describe("the plan, and what `could not tell` does to it", () => {
    const ctx = () => ({ bundle: REPO, spec: bundleSpec(), tree: null });

    test("a current workspace owes nothing", async () => {
        const planned = await planFor(view(manifest("2.8", { tree: "../" })), ctx(), steps);
        assert.equal(planned.owed, 0);
        assert.equal(planned.unknown, 0);
    });

    test("one unanswerable step makes the whole plan unknown rather than merely shorter", async () => {
        const ws = view(manifest("2.8", { tree: "../" }), { "verify/index.sh": null });
        const planned = await planFor(ws, ctx(), steps);
        assert.equal(planned.unknown, 1, "a step that could not tell was counted as `not owed`");
    });

    test("and the TOOL refuses on it — exit 2, never a green `owes nothing`", async () => {
        // The test above proves the arithmetic and NOT the tool's response to it: it calls
        // `planFor` directly, so deleting `run`'s guard left it green. Found by mutating the
        // guard rather than by reading the suite — one rule, two sites, covered at one.
        //
        // The route to `owed: null` here is a marked line of a shape `0002` does not recognise,
        // which is deterministic. A chmod-000 file would exercise the same branch and would stop
        // exercising it the moment anything ran this suite as root.
        const { major, minor } = bundleSpec();
        const root = scratch();
        fs.mkdirSync(path.join(root, ".git"));
        const dir = path.join(root, ".portulan");
        fs.mkdirSync(path.join(dir, "verify"), { recursive: true });
        for (const f of ["identity.md", "principles.md", "gate-map.md"]) fs.writeFileSync(path.join(dir, f), `# ${f}\n`);
        fs.writeFileSync(path.join(dir, "verify", "workspace.sh"), "#!/usr/bin/env bash\nexit 2\n", { mode: 0o755 });
        fs.writeFileSync(path.join(dir, "verify", "index.sh"), `set -- node /opt/whatever # ${MARKER}\n`, { mode: 0o755 });
        fs.writeFileSync(path.join(dir, "workspace.json"), `${JSON.stringify(manifest(`${major}.${minor}`, { tree: "../" }), null, 2)}\n`);

        for (const argv of [[dir], [dir, "--check"], [dir, "--write"]]) {
            const h = harness();
            assert.equal(await run(argv, h.options), 2, `${argv.join(" ")} must be could-not-run`);
            assert.match(h.text(), /could not tell/i);
        }
    });
});

describe("the pre-state gate — which direction the workspace is off in", () => {
    /** A workspace directory on disk, valid enough for `doctor` to reach a verdict. */
    function onDisk(spec, extra = {}) {
        const root = scratch();
        const dir = path.join(root, ".portulan");
        fs.mkdirSync(dir, { recursive: true });
        fs.mkdirSync(path.join(root, ".git"));
        for (const f of ["identity.md", "principles.md", "gate-map.md"]) fs.writeFileSync(path.join(dir, f), `# ${f}\n`);
        fs.mkdirSync(path.join(dir, "verify"), { recursive: true });
        fs.writeFileSync(path.join(dir, "verify", "workspace.sh"), "#!/usr/bin/env bash\nexit 2\n", { mode: 0o755 });
        fs.writeFileSync(path.join(dir, "workspace.json"), `${JSON.stringify(manifest(spec, extra), null, 2)}\n`);
        return dir;
    }

    test("a workspace from the FUTURE is could-not-run, never a green `nothing owed`", async () => {
        // The defect the session-open checkpoint caught. Branching on the FACT of doctor's throw
        // sent a 3.0 workspace into the plan, where every step answered `not owed`, and the run
        // exited 0 — a green rendered by a tool that could not read the workspace.
        for (const spec of ["3.0", "9.9"]) {
            const h = harness();
            assert.equal(await run([onDisk(spec, { tree: "../" })], h.options), 2, `${spec} must be could-not-run`);
            assert.match(h.text(), /older than|upgrade the CLI/i, `${spec}: the sentence must name the real remedy`);
        }
    });

    test("a MINOR ahead is could-not-run too — doctor refuses it for its own reason", async () => {
        const { major, minor } = bundleSpec();
        const h = harness();
        assert.equal(await run([onDisk(`${major}.${minor + 1}`, { tree: "../" })], h.options), 2);
        assert.match(h.text(), /older than|upgrade the CLI/i);
    });

    test("a workspace doctor already REDS is refused before anything is planned", async () => {
        // `repository` with no `tree` is a fail at the version it declares — not something a
        // migration should layer a second problem onto.
        const dir = onDisk(`${bundleSpec().major}.${bundleSpec().minor}`);
        const h = harness();
        assert.equal(await run([dir, "--write"], h.options), 1);
        assert.match(h.text(), /doctor/, "the refusal must name where the findings came from");
        assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "workspace.json"), "utf8")).portulan.spec, `${bundleSpec().major}.${bundleSpec().minor}`);
    });

    test("behind by a MAJOR that NO step reaches is could-not-run, not `nothing owed`", async () => {
        // The same false green from the other end. `0.9` is below this bundle, so the pre-state gate
        // is skipped and doctor will not grade it — and no step in the chain claims it, so the plan
        // is empty. Reporting that as `current` would be the exact defect adjustment 1 names,
        // reached by a workspace from the PAST instead of the future.
        const h = harness();
        assert.equal(await run([onDisk("0.9", { tree: "../" })], h.options), 2);
        assert.match(h.text(), /no migration in this chain reaches it/i);
    });

    test("a green current workspace is reported as owing nothing, exit 0", async () => {
        const h = harness();
        assert.equal(await run([onDisk(`${bundleSpec().major}.${bundleSpec().minor}`, { tree: "../" })], h.options), 0);
        assert.match(h.text(), /nothing|current|owes/i);
    });
});

describe("exit codes, which are the house three", () => {
    function drafted1_0() {
        const root = scratch();
        const dir = path.join(root, ".portulan");
        fs.mkdirSync(dir, { recursive: true });
        fs.mkdirSync(path.join(root, ".git"));
        for (const f of ["identity.md", "principles.md", "gate-map.md"]) fs.writeFileSync(path.join(dir, f), `# ${f}\n`);
        fs.mkdirSync(path.join(dir, "verify"), { recursive: true });
        fs.writeFileSync(path.join(dir, "verify", "workspace.sh"), "#!/usr/bin/env bash\nexit 2\n", { mode: 0o755 });
        fs.writeFileSync(path.join(dir, "workspace.json"), `${JSON.stringify(manifest("1.0"), null, 2)}\n`);
        return dir;
    }

    test("no flag prints the plan, writes nothing, and exits 0", async () => {
        const dir = drafted1_0();
        const h = harness();
        assert.equal(await run([dir], h.options), 0);
        assert.match(h.text(), /0001/);
        assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "workspace.json"), "utf8")).portulan.spec, "1.0", "a bare run wrote");
    });

    test("--check exits 1 when a step is owed, and 0 when none is", async () => {
        const dir = drafted1_0();
        assert.equal(await run([dir, "--check"], harness().options), 1);
        assert.equal(await run([dir, "--write"], harness().options), 0);
        assert.equal(await run([dir, "--check"], harness().options), 0, "--check must agree with what --write just did");
    });

    test("--check and --write together are two questions and are refused", async () => {
        const h = harness();
        assert.equal(await run([drafted1_0(), "--check", "--write"], h.options), 2);
        assert.match(h.text(), /one/i);
    });

    test("an unknown flag is refused rather than dropped", async () => {
        const h = harness();
        assert.equal(await run([drafted1_0(), "--wrote"], h.options), 2);
        assert.match(h.text(), /--wrote/);
    });

    test("--write migrates 1.0 to 2.0 and doctor, which REFUSED it beforehand, is green after", async () => {
        const dir = drafted1_0();
        await assert.rejects(() => inspect(dir), /MAJOR|migration/i, "doctor must refuse the pre-state — that refusal is why this tool exists");
        assert.equal(await run([dir, "--write"], harness().options), 0);
        const after = JSON.parse(fs.readFileSync(path.join(dir, "workspace.json"), "utf8"));
        assert.equal(after.portulan.spec, "2.0");
        assert.equal(after.tree, "../");
        const { findings } = await inspect(dir);
        assert.deepEqual(findings.filter((f) => f.severity === "fail"), [], "the migrated workspace must be green");
    });
});

describe("the repaired rail is still a rail", () => {
    test("the executable bit survives the rewrite — rename(2) replaces the inode", async () => {
        // A repair that left `verify/index.sh` unexecutable would have broken the thing it exists to
        // fix, and every assertion about the file's TEXT would still have passed. Behaviour, not
        // content: the file is run.
        const { major, minor } = bundleSpec();
        const root = scratch();
        fs.mkdirSync(path.join(root, ".git"));
        const dir = path.join(root, ".portulan");
        fs.mkdirSync(path.join(dir, "verify"), { recursive: true });
        for (const f of ["identity.md", "principles.md", "gate-map.md"]) fs.writeFileSync(path.join(dir, f), `# ${f}\n`);
        fs.writeFileSync(path.join(dir, "verify", "workspace.sh"), "#!/usr/bin/env bash\nexit 2\n", { mode: 0o755 });
        const rail = path.join(dir, "verify", "index.sh");
        fs.writeFileSync(rail, `#!/usr/bin/env bash\n${railWith("/somewhere/else").split("\n").slice(2).join("\n")}\nexit 0\n`, { mode: 0o755 });
        fs.writeFileSync(path.join(dir, "workspace.json"), `${JSON.stringify(manifest(`${major}.${minor}`, { tree: "../" }), null, 2)}\n`);

        const before = fs.statSync(rail).mode;
        assert.equal(await run([dir, "--write"], harness().options), 0);
        assert.equal(fs.statSync(rail).mode, before, "the repair changed the file's mode");
        assert.ok(fs.statSync(rail).mode & 0o111, "the repaired rail is no longer executable");
        assert.match(fs.readFileSync(rail, "utf8"), new RegExp(REPO.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    });
});

describe("rollback, and the arm where the rollback itself fails", () => {
    test("a red post-state restores every snapshot and leaves the workspace byte-identical", async () => {
        const root = scratch();
        const dir = path.join(root, ".portulan");
        fs.mkdirSync(dir, { recursive: true });
        // No `.git`, so `../` cannot be derived; an explicit --tree that doctor will REJECT is the
        // cleanest way to force a post-state red through the real validator.
        for (const f of ["identity.md", "principles.md", "gate-map.md"]) fs.writeFileSync(path.join(dir, f), `# ${f}\n`);
        fs.mkdirSync(path.join(dir, "verify"), { recursive: true });
        fs.writeFileSync(path.join(dir, "verify", "workspace.sh"), "#!/usr/bin/env bash\nexit 2\n", { mode: 0o755 });
        const file = path.join(dir, "workspace.json");
        fs.writeFileSync(file, `${JSON.stringify(manifest("1.0"), null, 2)}\n`);
        const before = fs.readFileSync(file, "utf8");

        const h = harness();
        const code = await run([dir, "--write", "--tree", "does/not/exist/"], h.options);
        assert.equal(code, 1);
        assert.equal(fs.readFileSync(file, "utf8"), before, "a red post-state must leave the workspace exactly as it was");
    });

    test("restore() reports what it did NOT restore rather than claiming the tree is clean", () => {
        // The promise "the workspace is exactly as it was" is one a mid-restore EACCES breaks.
        const dir = scratch();
        const good = path.join(dir, "a.txt");
        fs.writeFileSync(good, "new\n");
        const result = restore(dir, [
            { file: "a.txt", previous: "old\n" },
            { file: "nested/b.txt", previous: "old\n" }, // no such directory — the restore fails
        ]);
        assert.equal(result.ok, false);
        assert.deepEqual(result.restored, ["a.txt"]);
        assert.deepEqual(result.failed, ["nested/b.txt"]);
        assert.equal(fs.readFileSync(good, "utf8"), "old\n");
    });
});

describe("either residence", () => {
    /**
     * A host record with `name` installed at `root`, in the shape `cli/discover.mjs` actually reads.
     *
     * The record maps `<plugin>@<marketplace>` to an **array** — one entry per install scope — and
     * the path key is `installPath`. Written from `readInstalls` rather than from memory: a fixture
     * shaped by guesswork would have made every case here vacuously `not-installed`, which is the
     * failure this suite's own header is about.
     */
    function host(name, root) {
        const config = scratch();
        fs.mkdirSync(path.join(config, "plugins"), { recursive: true });
        fs.writeFileSync(
            path.join(config, "plugins", "installed_plugins.json"),
            `${JSON.stringify(
                { version: 2, plugins: { [`${name}@feed`]: [{ scope: "user", installPath: root, version: "1.2.3" }] } },
                null,
                2,
            )}\n`,
        );
        return config;
    }

    function governing(spec = "2.8") {
        const root = scratch();
        fs.mkdirSync(path.join(root, ".git"));
        const dir = path.join(root, ".portulan");
        fs.mkdirSync(dir, { recursive: true });
        for (const f of ["identity.md", "principles.md", "gate-map.md"]) fs.writeFileSync(path.join(dir, f), `# ${f}\n`);
        fs.mkdirSync(path.join(dir, "verify"), { recursive: true });
        fs.writeFileSync(path.join(dir, "verify", "workspace.sh"), "#!/usr/bin/env bash\nexit 2\n", { mode: 0o755 });
        fs.writeFileSync(path.join(dir, "workspace.json"), `${JSON.stringify(manifest(spec, { tree: "../", name: "acme-platform" }), null, 2)}\n`);
        return dir;
    }

    function pointerAt(name) {
        const dir = path.join(scratch(), ".portulan");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "workspace.json"),
            `${JSON.stringify({ portulan: { spec: "2.7" }, name: "acme", kind: "pointer", governed_by: { workspace: name } }, null, 2)}\n`,
        );
        return dir;
    }

    test("a governing workspace is its own target", async () => {
        const dir = governing();
        const target = await resolveTarget(dir, {});
        assert.equal(target.state, "resides-here");
        assert.equal(target.dir, dir);
    });

    test("the resides-here sentence claims no OWNERSHIP it did not check", async () => {
        // `discover` says "this repository's workspace resides here" because it is asked about a
        // repository's own `.portulan`. This tool takes any workspace directory — `examples/`, a
        // portfolio, a typed path — so borrowing that sentence would infer ownership from the mere
        // absence of `kind: pointer`, which is a different fact from the one checked.
        // Copilot, round 1 on #231.
        for (const kind of ["repository", "demo", "portfolio"]) {
            const dir = path.join(scratch(), ".portulan");
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, "workspace.json"), `${JSON.stringify(manifest("2.8", { kind, tree: "../" }), null, 2)}\n`);
            const target = await resolveTarget(dir, {});
            assert.equal(target.state, "resides-here");
            assert.doesNotMatch(target.sentence, /this repository's/i, `${kind}: the sentence claims the workspace belongs to a repository nobody asked about`);
            assert.ok(target.sentence.includes(dir), `${kind}: the sentence must name what it examined`);
        }
    });

    test("a pointer is resolved through discover, and the resolver's OWN sentence is what gets printed", async () => {
        const gov = governing();
        const config = host("acme-platform", path.dirname(gov));
        const h = harness();
        await run([pointerAt("acme-platform")], { ...h.options, env: { CLAUDE_CONFIG_DIR: config } });
        const target = await resolveTarget(pointerAt("acme-platform"), { env: { CLAUDE_CONFIG_DIR: config } });
        assert.equal(target.state, "resolved");
        assert.ok(h.text().includes(target.sentence), "the tool paraphrased the resolver instead of quoting it");
    });

    test("a pointer that resolves to nothing is a verdict, not a crash", async () => {
        const config = host("someone-else", scratch());
        const h = harness();
        assert.equal(await run([pointerAt("acme-platform")], { ...h.options, env: { CLAUDE_CONFIG_DIR: config } }), 1);
        assert.match(h.text(), /not installed/i);
    });

    test("--write REFUSES to write into a resolved install, and says why", async () => {
        // A cache install is a materialisation whose identity is a version claim, not one of the
        // two residences. Migrating it in place would leave a directory that no longer matches the
        // version the host's record names for it.
        const gov = governing();
        const config = host("acme-platform", path.dirname(gov));
        const before = fs.readFileSync(path.join(gov, "workspace.json"), "utf8");
        const h = harness();
        const code = await run([pointerAt("acme-platform"), "--write"], { ...h.options, env: { CLAUDE_CONFIG_DIR: config } });
        assert.equal(code, 2);
        assert.match(h.text(), /install|cache|pinned/i);
        assert.equal(fs.readFileSync(path.join(gov, "workspace.json"), "utf8"), before);
    });
});

describe("the three rules a tool writing into somebody's tree owes", () => {
    test("a symlink under the workspace is refused rather than resolved", async () => {
        const root = scratch();
        const dir = path.join(root, ".portulan");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "workspace.json"), `${JSON.stringify(manifest("1.0"), null, 2)}\n`);
        fs.symlinkSync(path.join(root, "elsewhere.md"), path.join(dir, "identity.md"));
        const h = harness();
        assert.equal(await run([dir, "--write"], h.options), 2);
        assert.match(h.text(), /symlink/i);
    });

    test("a missing workspace is could-not-run, and says which path it looked at", () => {
        const result = readWorkspace(path.join(scratch(), "absent"));
        assert.equal(result.ok, false);
        assert.match(result.reason, /workspace\.json/);
    });

    test("a manifest that does not parse is not overwritten — read and parse stay two failures", () => {
        const dir = scratch();
        fs.writeFileSync(path.join(dir, "workspace.json"), "{ not json");
        const result = readWorkspace(dir);
        assert.equal(result.ok, false);
        assert.match(result.reason, /parse/i, "a syntax error must not be reported as a read failure");
    });
});
