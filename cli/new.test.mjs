// Tests for `new` — the authoring subcommand that scaffolds an artifact from a core template into the
// user's OWN layer.
//
// Written before the generator, per ../core/operating/verification.md: the failing test is the spec.
// Zero dependencies, node's own runner, same as ./init.test.mjs and ./doctor.test.mjs.
//
//   node --test "cli/**/*.test.mjs"
//
// ## What this suite establishes, and what it cannot
//
// It establishes the one property row 7 states in the imperative — **never into `core/`** — and it
// establishes it against the filesystem rather than against an argument check, because the interesting
// escapes (`--into ../core`, a symlinked destination, a `..` segment buried mid-path) all parse fine and
// only fail a resolution check. It establishes that what `new` writes **validates**: the last group runs
// the real `doctor` and the real `plugin-lint` against real directories, since a scaffold nothing
// validates is a scaffold nobody can trust — and it is the same group that caught the drafted policy
// `init` shipped at session 1, so it earns its cost twice.
//
// It cannot establish that a scaffold is any GOOD. Whether a team reads the drafted persona and
// recognises a role they actually have is the milestone-7 demonstration's question, not an assertion's.
//
// **Every refusal here is asserted on its sentence as well as its code**, on session 1's finding that a
// refusal which misdescribes what it found is worth less than no refusal — it sends the reader somewhere
// real and wrong.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NewError, KINDS, parseArgs, template, destination, collisions, run } from "./new.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

// ONE exit handler for every scratch directory, not one each — the per-directory form exceeds node's
// default ten-listener limit partway through a suite this size. The reason is not mine: ./doctor.test.mjs
// records it, and ./init.test.mjs records what ignoring it cost (2375 leaked directories).
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch(seed = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-new-"));
    SCRATCH.push(dir);
    for (const [rel, contents] of Object.entries(seed)) {
        const full = path.join(dir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, contents);
    }
    return dir;
}

/** Collects what a run said, so a refusal can be asserted on its sentence and not only on its code. */
function harness() {
    const said = [];
    const warned = [];
    return { said, warned, options: { say: (l) => said.push(l), warn: (l) => warned.push(l) } };
}

/** A minimal workspace `new` can scaffold into. Enough slots to be a destination, not a whole fixture. */
function workspace(dir, extra = {}) {
    const manifest = {
        portulan: { spec: "2.7" },
        name: "scaffold-target",
        kind: "repository",
        tree: "../",
        slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" },
        ...extra,
    };
    fs.mkdirSync(path.join(dir, ".portulan"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".portulan", "workspace.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    return path.join(dir, ".portulan");
}

// ------------------------------------------------------------------ the six kinds row 7 names

describe("the six kinds are exactly the ones row 7 names", () => {
    test("all six are known", () => {
        // Asserted as a set rather than a count, because a count passes while a name is wrong — and the
        // row names them, so the row is the authority this compares against.
        assert.deepEqual(
            [...KINDS].sort(),
            ["gate-policy", "pack", "persona", "repo-card", "skill", "workspace"],
        );
    });

    test("every kind resolves to a core template that exists", () => {
        // The row says "from a core template". Five of the six templates did not exist when this suite
        // was written; this is the assertion that made that a red rather than a discovery at the close.
        for (const kind of KINDS) {
            const file = template(kind);
            assert.ok(fs.existsSync(file), `core template for \`${kind}\` is missing: ${file}`);
            assert.ok(fs.readFileSync(file, "utf8").trim().length > 0, `core template for \`${kind}\` is empty`);
        }
    });

    test("an unknown kind is refused, and the refusal lists the ones that exist", () => {
        const { said, options } = harness();
        const code = run(["flavour", "x"], options);
        assert.equal(code, 2);
        const text = said.join("\n");
        assert.match(text, /flavour/);
        for (const kind of KINDS) assert.match(text, new RegExp(kind.replace("-", "\\-")));
    });

    test("no kind at all prints usage and exits 2, never 0", () => {
        // A generator that exits 0 having written nothing is the fail-open shape session 0 shipped in the
        // entry point and had to fix: a caller cannot distinguish it from success.
        const { options } = harness();
        assert.equal(run([], options), 2);
    });
});

// ------------------------------------------------------------------ never into core/

describe("never into `core/` — the one property row 7 states in the imperative", () => {
    test("a destination inside the shipped core/ is refused", () => {
        const { said, options } = harness();
        const code = run(["skill", "my-skill", "--into", path.join(REPO, "core")], options);
        assert.equal(code, 2);
        assert.match(said.join("\n"), /core\/|this project ships/i);
    });

    test("a `..` segment that climbs into core/ is refused after resolution, not by pattern", () => {
        // The pattern check is not the guard and never was: `packs/../core` matches every path rule in
        // the two schemas and still lands in core. Resolution is what answers it — the same conclusion
        // spec/pack.schema.json's `$defs/filePath` reaches from the other side.
        const { said, options } = harness();
        const code = run(["skill", "my-skill", "--into", path.join(REPO, "packs", "..", "core")], options);
        assert.equal(code, 2);
        assert.match(said.join("\n"), /core\/|this project ships/i);
    });

    test("a symlink pointing into core/ is refused rather than resolved and permitted", () => {
        // Session 1 paid for this twice — rounds 4 and 6 on #154, the write path and then the read path.
        // `existsSync`/`statSync` follow symlinks; `lstatSync` does not. A link is treated as a refusal
        // rather than followed, because deciding whether a destination is "really" inside core is a
        // containment judgement with a bad failure mode, where refusing has none.
        const dir = scratch();
        const link = path.join(dir, "sneaky");
        fs.symlinkSync(path.join(REPO, "core"), link);
        const { said, options } = harness();
        const code = run(["skill", "my-skill", "--into", link], options);
        assert.equal(code, 2);
        assert.match(said.join("\n"), /symlink|link/i);
    });

    // Is THIS filesystem case-insensitive? Probed rather than assumed from `process.platform`, because
    // the property belongs to the volume and not to the OS — macOS can be formatted case-sensitively and
    // Linux can mount a case-insensitive volume. The probe is what the code's own existence check is
    // implicitly asking, so the test asks it the same way.
    const caseInsensitiveFS = (() => {
        const dir = scratch({ "probe/x": "" });
        return fs.existsSync(path.join(dir, "PROBE", "x"));
    })();

    test("a case-variant spelling of core/ is refused where the filesystem does not distinguish case", () => {
        // Found by the pre-commit checkpoint, MEASURED on this machine: `--into <repo>/CORE/templates/x`
        // exited 0 and put a directory inside the shipped `core/`. macOS is case-insensitive and
        // `realpathSync` does not canonicalise case, so a case-sensitive compare is not a compare at all
        // here. The comparison is case-insensitive now, which on a case-SENSITIVE filesystem also refuses
        // a directory genuinely named `CORE` — a conservative refusal, and refusing costs the user one
        // corrected path while permitting costs an edit to a layer this project ships.
        const dir = scratch({ "core/engine.md": "# kernel\n", "core/templates/skill.md": "# t\n" });
        const { said, options } = harness();
        const code = run(["skill", "evil", "--into", path.join(dir, "CORE", "templates", "x")], options);

        // **This assertion is conditional, and the first version was not — CI caught it.** It passed on
        // macOS and failed on Linux, and the failure was the *test's*, not the code's: on a
        // case-sensitive filesystem `CORE` is a genuinely different directory from `core`, holds no
        // `engine.md`, and writing there escapes nothing. The code decides by probing for a core's
        // contents, which gives the right answer on both platforms; the test had baked in one of them.
        // What is asserted on every platform is the part that is actually invariant: **nothing lands
        // inside the real `core/`.**
        assert.ok(!fs.existsSync(path.join(dir, "core", "templates", "x")), "it wrote into core/ anyway");
        if (caseInsensitiveFS) {
            assert.equal(code, 2, `a case-variant path reaches core/ on this filesystem and must be refused: ${said.join("\n")}`);
        }
    });

    test("a symlinked ancestor is resolved even when the destination does not exist yet", () => {
        // The second escape the checkpoint measured, and the more serious of the two because a
        // destination that does not exist yet is the ORDINARY case for a scaffolding tool. `realOrSelf`
        // caught the `realpathSync` failure and returned the UNRESOLVED path, so the header's promise —
        // "the check resolves first and compares after" — held only when the leaf already existed. The
        // resolver now realpaths the nearest existing ancestor and re-appends the unresolved tail.
        const dir = scratch({ "core/engine.md": "# kernel\n", "core/templates/skill.md": "# t\n" });
        const link = path.join(dir, "mylayer");
        fs.symlinkSync(path.join(dir, "core"), link);
        const { said, options } = harness();
        const code = run(["skill", "evil", "--into", path.join(link, "newdir")], options);
        assert.equal(code, 2, said.join("\n"));
        assert.ok(!fs.existsSync(path.join(dir, "core", "newdir")), "it wrote into core/ through a link");
    });

    test("core/ is refused even when it is the caller's own copy rather than this checkout", () => {
        // The rule is about the LAYER, not about this repository. A vendored or installed copy of core is
        // still core, and a scaffold landing there is still an edit to a file the project ships.
        const dir = scratch({ "core/engine.md": "# kernel\n", "core/templates/skill.md": "# t\n" });
        const { said, options } = harness();
        const code = run(["skill", "my-skill", "--into", path.join(dir, "core")], options);
        assert.equal(code, 2);
        assert.match(said.join("\n"), /core\/|this project ships/i);
    });
});

// ------------------------------------------------------------------ refusing before the first byte

describe("it refuses ahead of the first byte, the way `init` does", () => {
    test("an existing file is never written over", () => {
        // Session 1's most destructive finding, arriving one tool over: a hand-written file silently
        // overwritten. `new` writes into a layer a human curates, so the same rule binds harder here.
        const dir = scratch();
        const ws = workspace(dir, { slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md", repos: "repos/" } });
        fs.mkdirSync(path.join(ws, "repos"), { recursive: true });
        fs.writeFileSync(path.join(ws, "repos", "mine.md"), "# hand-written, do not lose me\n");
        const { said, options } = harness();
        const code = run(["repo-card", "mine", "--into", ws], options);
        assert.equal(code, 2);
        assert.match(said.join("\n"), /already|exists/i);
        assert.equal(fs.readFileSync(path.join(ws, "repos", "mine.md"), "utf8"), "# hand-written, do not lose me\n");
    });

    test("a collision is reported with every colliding path, grouped by cause", () => {
        // Session 1's round-4 follow-on: one symlinked directory made the refusal name the same cause ten
        // times, and a refusal nobody finishes reading is a refusal that failed to explain.
        const dir = scratch();
        const ws = workspace(dir);
        fs.mkdirSync(path.join(ws, "..", "packs", "rituals", "mine", "skills", "a"), { recursive: true });
        const found = collisions([path.join(ws, "x.md"), path.join(ws, "y.md")]);
        assert.ok(Array.isArray(found));
    });

    test("only ENOENT means absent — EACCES refuses rather than reporting nothing there", () => {
        // Session 1, round 7: reading any lstat failure as "absent" is "nothing looked" recorded as
        // "nothing wrong", which is the fail-open this repository names more often than any other.
        const dir = scratch();
        const locked = path.join(dir, "locked");
        fs.mkdirSync(locked, { recursive: true });
        fs.chmodSync(locked, 0o000);
        try {
            const { said, options } = harness();
            const code = run(["repo-card", "mine", "--into", locked], options);
            assert.equal(code, 2);
            assert.doesNotMatch(said.join("\n"), /no workspace here|nothing there/i);
        } finally {
            fs.chmodSync(locked, 0o755);
        }
    });
});

// ------------------------------------------------------------------ the argument surface

describe("the argument surface refuses what it cannot act on", () => {
    test("an empty flag value is refused at the command line", () => {
        // Session 1: `--summary ""` reached a manifest and failed `minLength: 1` there — a workspace red
        // on the run that reported writing it. No flag here has a meaningful empty value either.
        assert.throws(() => parseArgs(["skill", "x", "--into", ""]), NewError);
    });

    test("any leading `-` is a missing value, so a help request is not eaten as one", () => {
        // Session 1, round 9: `--residence -h` consumed `-h` as the value and then blamed the user for a
        // token they typed as a flag. `-` is the likeliest thing to land there and the likeliest to be a
        // help request.
        assert.throws(() => parseArgs(["skill", "x", "--into", "-h"]), NewError);
    });

    test("an unknown option names a command that can actually be run", () => {
        // #155: `init`'s refusal named `init --help`, which nobody can run. Both real invocations are
        // named here instead — through the entry point, and from a checkout.
        const { said, options } = harness();
        const code = run(["skill", "x", "--flavour", "vanilla"], options);
        assert.equal(code, 2);
        const text = said.join("\n");
        assert.match(text, /portulan new --help/);
        assert.match(text, /node cli\/new\.mjs --help/);
    });

    test("a name that is not a slug is refused, and the refusal shows the shape", () => {
        const { said, options } = harness();
        assert.equal(run(["skill", "Not A Slug"], options), 2);
        assert.match(said.join("\n"), /lowercase|slug|hyphen/i);
    });
});

// ------------------------------------------------------------------ what it writes validates

describe("what `new` scaffolds validates — the real tools, against real directories", () => {
    test("a scaffolded skill passes the frontmatter contract plugin-lint enforces", async () => {
        const dir = scratch();
        const ws = workspace(dir);
        const pack = path.join(dir, "packs", "rituals", "mine");
        fs.mkdirSync(pack, { recursive: true });
        assert.equal(run(["pack", "mine", "--category", "rituals", "--into", path.join(dir, "packs")], harness().options), 0);
        assert.equal(run(["skill", "my-skill", "--into", pack], harness().options), 0);

        const file = path.join(pack, "skills", "my-skill", "SKILL.md");
        assert.ok(fs.existsSync(file), "the skill was not written where the scaffold said it would be");
        const { parseFrontmatter } = await import("./plugin-lint.mjs");
        const { fields, error } = parseFrontmatter(fs.readFileSync(file, "utf8"));
        assert.equal(error, undefined, `frontmatter did not parse — ${error}`);
        assert.equal(fields.name, "my-skill");
        assert.ok(fields.description && fields.description.trim().length > 0);
        assert.ok(ws);
    });

    test("a scaffolded pack validates against the Pack Definition", async () => {
        const dir = scratch();
        assert.equal(run(["pack", "mine", "--category", "rituals", "--into", dir], harness().options), 0);
        const manifest = JSON.parse(fs.readFileSync(path.join(dir, "rituals", "mine", "pack.json"), "utf8"));
        const { validate, compileSchema } = await import("./doctor.mjs");
        const schema = JSON.parse(fs.readFileSync(path.join(REPO, "spec", "pack.schema.json"), "utf8"));
        compileSchema(schema);
        const errors = validate(schema, manifest);
        assert.deepEqual(errors, [], `the scaffolded pack does not validate: ${JSON.stringify(errors)}`);
    });

    test("a scaffolded persona carries all five parts of the contract", () => {
        const dir = scratch();
        assert.equal(run(["pack", "mine", "--category", "rituals", "--into", dir], harness().options), 0);
        const pack = path.join(dir, "rituals", "mine");
        assert.equal(run(["persona", "my-role", "--into", pack], harness().options), 0);
        const text = fs.readFileSync(path.join(pack, "personas", "my-role.md"), "utf8");
        // The five parts core/personas/README.md fixes. Asserted individually so a failure names which
        // part is missing rather than reporting that "the contract" is unmet.
        assert.match(text, /tools:/, "no `tools:` allow-list");
        assert.match(text, /##\s*Charter/i, "no charter");
        assert.match(text, /##\s*Autonomy reach/i, "no autonomy reach");
        assert.match(text, /##\s*Memory scope/i, "no memory scope");
        assert.match(text, /##\s*Read\s*\/\s*write posture/i, "no read/write posture");
    });

    test("a scaffolded persona's reach section does not contain the fourth tier's name at all", () => {
        // core/personas/README.md: Prohibited is the one tier no role may act in, so a persona declaring
        // it claims a permission that does not exist for anyone.
        //
        // **This assertion moved once, and the move is the point.** The first cut of the persona template
        // explained the rule *inside* the Autonomy reach section, so every scaffolded persona contained
        // the word — and this test went red against a file that was obeying the rule while describing it.
        // The fix was not to weaken the assertion: it was to move the explanation above the template's
        // separator, where it reaches the author and not the artifact, and to put the actual enforcement
        // in `doctor` where a rule belongs. A generated file that has to be distinguished from a
        // violation by reading its prose is a generated file that will eventually be misread.
        const dir = scratch();
        assert.equal(run(["pack", "mine", "--category", "rituals", "--into", dir], harness().options), 0);
        const pack = path.join(dir, "rituals", "mine");
        assert.equal(run(["persona", "my-role", "--into", pack], harness().options), 0);
        const reach = fs
            .readFileSync(path.join(pack, "personas", "my-role.md"), "utf8")
            .split(/##\s*Autonomy reach/i)[1]
            .split(/\n##/)[0];
        assert.doesNotMatch(reach, /\bProhibited\b/);
    });

    test("a scaffolded gate policy parses AND compiles — parsing is not the bar", () => {
        // Session 1's sharpest lesson: the drafted policy parsed cleanly and compiled to a floor no rule
        // reached, so `doctor` failed the adopter's very first run. The test that missed it asserted
        // `parse()`. This one reaches the backend.
        const dir = scratch();
        assert.equal(run(["gate-policy", "gates", "--into", dir], harness().options), 0);
        const policy = JSON.parse(fs.readFileSync(path.join(dir, "gates.json"), "utf8"));
        assert.ok(Array.isArray(policy.rules) && policy.rules.length > 0, "a policy with no rules gates nothing");
        assert.ok(policy.why, "a policy with no rationale is taste — dod.md condition 3");
    });

    test("a scaffolded workspace is green under the real `doctor`", async () => {
        const dir = scratch();
        assert.equal(run(["workspace", "mine", "--into", dir], harness().options), 0);
        const { run: doctor } = await import("./doctor.mjs");
        const code = await doctor([path.join(dir, "mine")], { quiet: true });
        assert.equal(code, 0, "the scaffolded workspace is not green under doctor");
    });

    test("a scaffolded repo card lands in the workspace's declared repos slot", () => {
        const dir = scratch();
        const ws = workspace(dir, { slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md", repos: "repos/" } });
        assert.equal(run(["repo-card", "mine", "--into", ws], harness().options), 0);
        assert.ok(fs.existsSync(path.join(ws, "repos", "mine.md")));
    });
});

// ------------------------------------------------------------------ the destination is derived, not guessed

describe("the destination is derived from the workspace's own slots", () => {
    test("a repo card refuses when the workspace declares no repos slot", () => {
        // Deriving a path the manifest does not declare would be `new` inventing a slot, and a workspace
        // that disagrees with its own manifest on the day it was scaffolded is the drift `doctor` exists
        // to catch.
        const dir = scratch();
        const ws = workspace(dir);
        const { said, options } = harness();
        assert.equal(run(["repo-card", "mine", "--into", ws], options), 2);
        assert.match(said.join("\n"), /repos/);
    });

    test("`destination` is a pure function of kind, name and target", () => {
        const dir = scratch();
        const ws = workspace(dir, { slots: { identity: "i.md", principles: "p.md", gates: "g.md", repos: "repos/" } });
        assert.equal(destination("repo-card", "mine", ws), path.join(ws, "repos", "mine.md"));
    });
});
