// Tests for `init` — the onboarding subcommand that drafts a workspace for a repository that has none.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { InitError, SLUG, slugify, parseArgs, scan, draft, collisions, residenceAt, run } from "./init.mjs";
import { compileGuidance } from "./compile.mjs";
import { LIFETIME_OFFER, OFFER_ENDS, offerLines } from "./sessions.mjs";

// `init` reads the host's installed-plugin record, so every case gets an empty host unless it passes `env:`.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

// One exit handler for every scratch directory: one each would pass node's default limit of ten listeners.
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

function scratch(seed = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-init-"));
    SCRATCH.push(dir);
    for (const [rel, contents] of Object.entries(seed)) {
        const full = path.join(dir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, contents);
    }
    return dir;
}

function harness() {
    const said = [];
    const warned = [];
    return { said, warned, options: { say: (l) => said.push(l), warn: (l) => warned.push(l) } };
}

const ok = (dir) => JSON.parse(fs.readFileSync(path.join(dir, ".portulan", "workspace.json"), "utf8"));

// ---------------------------------------------------------------- the residence question

describe("the residence question is asked, never answered by default", () => {
    test("no residence is a refusal that asks the question, not a default", async () => {
        const dir = scratch();
        const h = harness();
        const code = await run([dir], h.options);
        assert.equal(code, 2, "a missing residence must be could-not-run, never a guess");
        assert.match(h.warned.join("\n"), /--residence/);
        assert.match(h.warned.join("\n"), /in-repo|pointer/);
        assert.equal(fs.existsSync(path.join(dir, ".portulan")), false, "a refusal must write nothing");
    });

    test("an unrecognised residence is refused rather than coerced", async () => {
        const dir = scratch();
        const h = harness();
        assert.equal(await run(["--residence", "feed", dir], h.options), 2);
        assert.match(h.warned.join("\n"), /feed/);
    });

    test("`pointer` without a governor is refused — a pointer that names nothing governs nothing", async () => {
        const dir = scratch();
        const h = harness();
        assert.equal(await run(["--residence", "pointer", dir], h.options), 2);
        assert.match(h.warned.join("\n"), /--governed-by/);
    });
});

// ---------------------------------------------------------------- what a pointer may carry

describe("a pointer carries exactly what doctor permits and nothing else", () => {
    test("the manifest has only the five permitted keys", async () => {
        const dir = scratch();
        const h = harness();
        assert.equal(await run(["--residence", "pointer", "--governed-by", "acme-platform", dir], h.options), 0);
        const manifest = ok(dir);
        assert.deepEqual(Object.keys(manifest).sort(), ["governed_by", "kind", "name", "portulan", "summary"].sort());
        assert.equal(manifest.kind, "pointer");
        assert.equal(manifest.governed_by.workspace, "acme-platform");
        assert.equal(manifest.portulan.spec, "2.7", "the pointer kind arrived at 2.7 — an earlier spec cannot express it");
    });

    test("a pointer carries no slots, no verify and no packs", async () => {
        const dir = scratch();
        const h = harness();
        await run(["--residence", "pointer", "--governed-by", "acme-platform", dir], h.options);
        const manifest = ok(dir);
        assert.equal("slots" in manifest, false);
        assert.equal("verify" in manifest, false);
        assert.equal("packs" in manifest, false, "a pointer composes nothing — the governing workspace does");
    });

    test("options that mean nothing to a pointer are REFUSED, not quietly dropped", async () => {
        for (const argv of [
            ["--pack-root", REPO],
            ["--checkpoints", "rituals/other"],
            ["--no-cycle"],
        ]) {
            const dir = scratch();
            const h = harness();
            const code = await run(["--residence", "pointer", "--governed-by", "acme-platform", ...argv, dir], h.options);
            assert.equal(code, 2, `${argv[0]} must be refused with a pointer, not ignored`);
            assert.match(h.warned.join("\n"), /does nothing with `--residence pointer`/);
            assert.equal(fs.existsSync(path.join(dir, ".portulan")), false);
        }
    });

    test("options that mean nothing to an in-repo workspace are refused the same way", async () => {
        for (const argv of [["--feed", "acme-internal"], ["--governed-by", "acme-platform"]]) {
            const dir = scratch();
            const h = harness();
            assert.equal(await run(["--residence", "in-repo", ...argv, dir], h.options), 2, `${argv[0]} must be refused`);
            assert.match(h.warned.join("\n"), /does nothing with `--residence in-repo`/);
        }
    });

    test("a default never trips the refusal — only what somebody actually asked for", async () => {
        const dir = scratch();
        const h = harness();
        assert.equal(await run(["--residence", "pointer", "--governed-by", "acme-platform", dir], h.options), 0, h.warned.join("\n"));
    });

    test("an optional feed is carried when given and absent when not", async () => {
        const withFeed = scratch();
        const without = scratch();
        await run(["--residence", "pointer", "--governed-by", "acme-platform", "--feed", "acme-internal", withFeed], harness().options);
        await run(["--residence", "pointer", "--governed-by", "acme-platform", without], harness().options);
        assert.equal(ok(withFeed).governed_by.feed, "acme-internal");
        assert.equal("feed" in ok(without).governed_by, false, "absent is a legitimate state — a workspace checked out beside this one");
    });
});

// ---------------------------------------------------------------- slugs, refused at the boundary

describe("nothing init writes can produce the manifest doctor once mishandled", () => {
    for (const [bad, expected] of [
        ["", /empty/i],
        [" ", /empty/i],
        ["Acme Platform", /slug|lowercase/i],
        ["acme_platform", /slug|lowercase/i],
        ["acme-", /slug|lowercase/i],
        ["ACME", /slug|lowercase/i],
    ]) {
        test(`\`${bad}\` is refused as a governor, and by the check that can explain it`, async () => {
            const dir = scratch();
            const h = harness();
            assert.equal(await run(["--residence", "pointer", "--governed-by", bad, dir], h.options), 2);
            assert.match(h.warned.join("\n"), expected);
            assert.equal(fs.existsSync(path.join(dir, ".portulan")), false);
        });
    }

    test("a dash-leading governor still meets the slug check, via the answers file", async () => {
        // On the command line a leading `-` is a missing value, refused before the slug check.
        const dir = scratch();
        const answers = path.join(dir, "answers.json");
        fs.writeFileSync(answers, JSON.stringify({ residence: "pointer", "governed-by": "-acme" }));
        const h = harness();
        assert.equal(await run(["--answers", answers, dir], h.options), 2);
        assert.match(h.warned.join("\n"), /slug|lowercase/i);
    });

    test("the workspace name is held to the same definition", async () => {
        const dir = scratch();
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", "--name", "Acme Platform", dir], h.options), 2);
        assert.match(h.warned.join("\n"), /slug|lowercase/i);
    });

    test("a pack id is two slugs and a slash — anything else is refused rather than written", async () => {
        const dir = scratch();
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", "--checkpoints", "Rituals/Checkpoints", dir], h.options), 2);
        assert.match(h.warned.join("\n"), /pack/i);
    });

    test("SLUG is the schema's own pattern, not a second spelling of it", () => {
        const schema = JSON.parse(fs.readFileSync(path.join(REPO, "spec", "workspace.schema.json"), "utf8"));
        assert.equal(SLUG.source, new RegExp(schema.$defs.slug.pattern).source, "one definition of a slug, read from the contract that publishes it");
    });
});

// ---------------------------------------------------------------- the refusal that protects a workspace

describe("an existing residence is never overwritten", () => {
    test("a full workspace already present is a refusal naming the ruling", async () => {
        const dir = scratch({ ".portulan/workspace.json": '{"portulan":{"spec":"2.7"},"name":"acme","kind":"repository"}' });
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], h.options), 2);
        assert.match(h.warned.join("\n"), /exactly one workspace/);
        assert.equal(ok(dir).name, "acme", "the existing manifest must be byte-untouched");
    });

    test("a pointer already present is refused just as hard, and from the other direction", async () => {
        const dir = scratch({
            ".portulan/workspace.json": '{"portulan":{"spec":"2.7"},"name":"acme","kind":"pointer","governed_by":{"workspace":"acme-platform"}}',
        });
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], h.options), 2);
        assert.match(h.warned.join("\n"), /exactly one workspace/);
    });

    test("an unreadable manifest is could-not-run, never a licence to overwrite", async () => {
        const dir = scratch({ ".portulan/workspace.json": "{ not json" });
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], h.options), 2);
        assert.match(h.warned.join("\n"), /could not/i);
        assert.equal(fs.readFileSync(path.join(dir, ".portulan", "workspace.json"), "utf8"), "{ not json");
    });

    test("a `.portulan/` directory with no manifest is not a residence, and init proceeds", async () => {
        const dir = scratch({ ".portulan/notes.md": "# scratch\n" });
        assert.equal(await run(["--residence", "in-repo", dir], harness().options), 0);
        assert.equal(ok(dir).kind, "repository");
        assert.equal(fs.existsSync(path.join(dir, ".portulan", "notes.md")), true, "init adds; it does not clear the directory");
    });
});

// ---------------------------------------------------------------- the in-repo draft

describe("the in-repo draft carries what doctor requires of a repository workspace", () => {
    test("`tree` is declared, because a repository workspace without one is red", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", dir], harness().options), 0);
        assert.equal(ok(dir).tree, "../");
    });

    test("the three required slots resolve to files that exist", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const manifest = ok(dir);
        for (const slot of ["identity", "principles", "gates"]) {
            const target = path.join(dir, ".portulan", manifest.slots[slot]);
            assert.equal(fs.statSync(target).isFile(), true, `slots.${slot} must resolve to a real file`);
        }
    });

    test("the gate policy parses AND compiles on both backends", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const { parse, githubRuleset, claudeCode } = await import("./compile.mjs");
        const policy = JSON.parse(fs.readFileSync(path.join(dir, ".portulan", ok(dir).gates), "utf8"));
        const parsed = parse(policy);
        assert.ok(parsed.rules.length > 0, "a policy that gates nothing is refused by the compiler");

        const floor = githubRuleset(parsed);
        assert.ok(floor.compiled.length > 0, "a declared floor no rule reaches is refused outright, not merely reported");
        assert.ok(
            floor.artifact.value.rules.some((r) => r.type === "non_fast_forward"),
            "the drafted floor must actually protect the branch it names",
        );
        assert.ok(claudeCode(parsed).artifact, "the host backend must emit something for the drafted policy");
    });

    test("the floor claims no status check, because a fresh repository reports none", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const policy = JSON.parse(fs.readFileSync(path.join(dir, ".portulan", "gates.json"), "utf8"));
        assert.deepEqual(policy.floor.checks, []);
        assert.equal(policy.floor.branch, "main");
    });

    test("a verify default names a recipe that is declared", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const { verify } = ok(dir);
        assert.ok(verify.recipes.length >= 1);
        assert.ok(verify.recipes.some((r) => r.id === verify.default), "verify.default naming nothing is a cross-check failure");
    });

    test("the drafted recipe FAILS CLOSED — it cannot report green on a workspace nobody has finished", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const recipe = ok(dir).verify.recipes[0];
        const script = path.join(dir, ".portulan", "verify", path.basename(recipe.run));
        assert.equal(fs.statSync(script).mode & 0o111, 0o111, "a recipe that is not executable cannot run at all");
        let code = 0;
        try {
            execFileSync(script, { cwd: dir, stdio: "pipe" });
        } catch (error) {
            code = error.status;
        }
        assert.equal(code, 2, "the drafted recipe must be could-not-run until the adopter declares one");
    });

    test("the handoffs slot resolves to a directory that exists", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const manifest = ok(dir);
        assert.equal(manifest.slots.handoffs, "handoffs/");
        assert.equal(fs.statSync(path.join(dir, ".portulan", "handoffs")).isDirectory(), true);
    });

    test("the handoff index is sited OUTSIDE the series it indexes", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const manifest = ok(dir);
        assert.equal(manifest.handoffs.index.path.startsWith(manifest.slots.handoffs), false);
    });
});

// ---------------------------------------------------------------- the cycle, and opting out of it

describe("the checkpoint binding is drafted by default and can be deleted", () => {
    test("the pack the workspace names is composed by default", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        assert.deepEqual(ok(dir).packs, ["rituals/checkpoints"]);
    });

    test("`--no-cycle` leaves the workspace composing nothing, and still valid", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        assert.equal("packs" in ok(dir), false, "an empty packs array would read as composed-nothing-deliberately; absent is the truth");
    });

    test("a different pack can be named, because the choice is the workspace's", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", "--checkpoints", "rituals/house-style", dir], harness().options);
        assert.deepEqual(ok(dir).packs, ["rituals/house-style"]);
    });
});

// ---------------------------------------------------------------- claims the draft may not make

describe("the draft claims no capability it does not have", () => {
    test("the session-end gate names where its runner arrives rather than implying one is wired", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const readme = fs.readFileSync(path.join(dir, ".portulan", "README.md"), "utf8");
        assert.match(readme, /session-end/i);
        assert.match(readme, /session-end gate is wired by `compile`, and this draft has run only its guidance half/i);
    });

    test("the help says WHEN the interview runs, and when nothing is asked", async () => {
        const h = harness();
        await run(["--help"], h.options);
        const help = h.said.join("\n");
        assert.match(help, /--answers/);
        assert.match(help, /At a terminal, anything you have not answered is asked/);
        assert.match(help, /not a TTY nothing is asked/);
    });

    test("init still drafts a workspace once the npx prohibition is gone", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        assert.ok(fs.existsSync(path.join(dir, ".portulan", "workspace.json")), "init drafted no workspace");
    });
});

// ---------------------------------------------------------------- the scan

describe("the scan drafts what it observed and says what it could not determine", () => {
    test("a node repository is observed from its manifest, not guessed at", async () => {
        const dir = scratch({ "package.json": JSON.stringify({ name: "acme-api", scripts: { test: "node --test" } }) });
        const observed = scan(dir);
        assert.equal(observed.stack.includes("node"), true);
        assert.equal(observed.test, "node --test");
    });

    test("an unrecognised repository yields no claims at all, rather than a plausible default", async () => {
        const dir = scratch({ "notes.txt": "hello" });
        const observed = scan(dir);
        assert.deepEqual(observed.stack, []);
        assert.equal(observed.test, null);
        assert.equal(observed.build, null);
    });

    test("the comments are counted only where the draft uses the count, which a pointer's does not", () => {
        const dir = scratch({ "a.js": "// Added 2026-09-01.\nexport const a = 1;\n" });
        execFileSync("git", ["init", "-q", dir]);
        assert.equal(scan(dir).commentHistory, 1);
        assert.equal(scan(dir, { comments: false }).commentHistory, null);
    });

    test("what the scan could not determine is written down as unknown, not omitted", async () => {
        const dir = scratch({ "notes.txt": "hello" });
        await run(["--residence", "in-repo", dir], harness().options);
        const identity = fs.readFileSync(path.join(dir, ".portulan", "identity.md"), "utf8");
        assert.match(identity, /not determined|could not|unknown/i);
    });

    test("a name not given is derived from the directory and slugified", () => {
        assert.equal(slugify("Acme API"), "acme-api");
        assert.equal(slugify("acme_api__v2"), "acme-api-v2");
        assert.equal(slugify("---"), null, "a name that slugifies to nothing must be asked for, not invented");
    });
});

// ---------------------------------------------------------------- the answers file

describe("answers may come from a file, and flags win over it", () => {
    test("a file supplies what the flags do not", async () => {
        const dir = scratch();
        const answers = path.join(dir, "answers.json");
        fs.writeFileSync(answers, JSON.stringify({ residence: "pointer", "governed-by": "acme-platform", feed: "acme-internal" }));
        assert.equal(await run(["--answers", answers, dir], harness().options), 0);
        assert.equal(ok(dir).governed_by.feed, "acme-internal");
    });

    test("a flag overrides the same key in the file — the nearer answer wins", async () => {
        const dir = scratch();
        const answers = path.join(dir, "answers.json");
        fs.writeFileSync(answers, JSON.stringify({ residence: "pointer", "governed-by": "acme-platform" }));
        await run(["--answers", answers, "--governed-by", "acme-mobile", dir], harness().options);
        assert.equal(ok(dir).governed_by.workspace, "acme-mobile");
    });

    test("an unreadable or malformed answers file is could-not-run, never ignored", async () => {
        const dir = scratch();
        const answers = path.join(dir, "answers.json");
        fs.writeFileSync(answers, "{ not json");
        const h = harness();
        assert.equal(await run(["--answers", answers, "--residence", "in-repo", dir], h.options), 2);
        assert.match(h.warned.join("\n"), /answers/i);
    });

    test("a single-string `pack-root` in the answers file works, and is not a crash", async () => {
        const dir = scratch();
        const answers = path.join(dir, "answers.json");
        fs.writeFileSync(answers, JSON.stringify({ residence: "in-repo", "pack-root": path.join(REPO, "packs") }));
        const h = harness();
        assert.equal(await run(["--answers", answers, dir], h.options), 0, h.warned.join("\n"));
        assert.deepEqual(ok(dir).packs, ["rituals/checkpoints"]);
    });

    test("an array `pack-root` still works, and an unresolvable one is still refused", async () => {
        const dir = scratch();
        const answers = path.join(dir, "answers.json");
        fs.writeFileSync(answers, JSON.stringify({ residence: "in-repo", "pack-root": [os.tmpdir()] }));
        const h = harness();
        assert.equal(await run(["--answers", answers, dir], h.options), 2);
        assert.match(h.warned.join("\n"), /does not resolve/);
    });

    test("an unknown key in the answers file is refused rather than silently dropped", async () => {
        const dir = scratch();
        const answers = path.join(dir, "answers.json");
        fs.writeFileSync(answers, JSON.stringify({ residnce: "in-repo" }));
        const h = harness();
        assert.equal(await run(["--answers", answers, dir], h.options), 2);
        assert.match(h.warned.join("\n"), /residnce/);
    });
});

// ---------------------------------------------------------------- argument handling

describe("the command line refuses what it does not understand", () => {
    test("an unknown flag is could-not-run", async () => {
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", "--flavour", "vanilla", scratch()], h.options), 2);
        assert.match(h.warned.join("\n"), /--flavour/);
    });

    test("no target directory is could-not-run", async () => {
        const h = harness();
        assert.equal(await run(["--residence", "in-repo"], h.options), 2);
    });

    test("two target directories are refused rather than one being picked", async () => {
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", scratch(), scratch()], h.options), 2);
    });

    test("a target that does not exist is could-not-run, not created", async () => {
        const dir = path.join(scratch(), "nope");
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], h.options), 2);
        assert.equal(fs.existsSync(dir), false, "init drafts a workspace INTO a repository; it does not invent the repository");
    });

    test("`--help` succeeds — asking for help is a request, and it was answered", async () => {
        const h = harness();
        assert.equal(await run(["--help"], h.options), 0);
        assert.match(h.said.join("\n"), /--residence/);
    });

    test("parseArgs throws InitError rather than returning a half-parsed shape", () => {
        assert.throws(() => parseArgs(["--residence"]), InitError, "a flag with no value must not read the next flag as its value");
    });

    test("a SINGLE-dash flag is a missing value too, not a value", async () => {
        for (const argv of [
            ["--residence", "-h"],
            ["--name", "-h"],
            ["--governed-by", "-x"],
        ]) {
            const h = harness();
            assert.equal(await run([...argv, scratch()], h.options), 2);
            assert.match(h.warned.join("\n"), /needs a value/);
            assert.doesNotMatch(h.warned.join("\n"), /is not a residence/, "the refusal must name the real problem, not a value the user never gave");
        }
    });

    test("`--answers` remains the route for a value that really starts with a dash", async () => {
        const dir = scratch();
        const answers = path.join(dir, "answers.json");
        fs.writeFileSync(answers, JSON.stringify({ residence: "in-repo", summary: "-- a summary that leads with dashes --" }));
        const h = harness();
        assert.equal(await run(["--answers", answers, dir], h.options), 0, h.warned.join("\n"));
        assert.match(ok(dir).summary, /^-- a summary/);
    });
});

// ---------------------------------------------------------------- draft is a decision, not a write

describe("draft decides and returns; writing is a separate step", () => {
    test("draft returns a file set and touches nothing", () => {
        const dir = scratch();
        const files = draft({ residence: "in-repo", name: "acme", cycle: true, checkpoints: "rituals/checkpoints" }, scan(dir));
        assert.ok(files.has(".portulan/workspace.json"));
        assert.equal(fs.existsSync(path.join(dir, ".portulan")), false);
    });

    test("every path in the file set stays inside the target's .portulan/, but the two it drafts beside it", () => {
        const files = draft({ residence: "in-repo", name: "acme", cycle: true, checkpoints: "rituals/checkpoints" }, scan(scratch()));
        const beside = new Map([[".gitignore", "append"], ["changes/README.md", "ifAbsent"]]);
        for (const [rel, file] of files) {
            if (beside.has(rel)) {
                assert.ok(file[beside.get(rel)], `${rel} is drafted beside the workspace, and only by ${beside.get(rel)}, never over the repository's own`);
                continue;
            }
            assert.equal(rel.startsWith(".portulan/"), true, `${rel} escapes the workspace directory`);
            assert.equal(rel.includes(".."), false, `${rel} climbs out of the target`);
        }
    });

    test("a repository's own changes/README.md is left as it is, and its .gitignore is appended to", async () => {
        const dir = scratch({ "changes/README.md": "ours\n", ".gitignore": "node_modules/\n" });
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], h.options), 0);
        assert.equal(fs.readFileSync(path.join(dir, "changes", "README.md"), "utf8"), "ours\n");
        assert.match(h.said.join("\n"), /left the repository's own `changes\/README\.md` as it is/);
        assert.match(fs.readFileSync(path.join(dir, ".gitignore"), "utf8"), /^node_modules\/\n[\s\S]*^\/\.portulan\/handoffs-index\.md$/m);
    });
});

// ---------------------------------------------------------------- what init will not write, or claim

describe("nothing init writes over, and nothing it half-writes", () => {
    test("a hand-written file with no manifest beside it is not overwritten", async () => {
        const dir = scratch({ ".portulan/gate-map.md": "MY GATE MAP — hand-written, not a draft\n" });
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], h.options), 2);
        assert.match(h.warned.join("\n"), /gate-map\.md/);
        assert.match(fs.readFileSync(path.join(dir, ".portulan", "gate-map.md"), "utf8"), /hand-written/);
    });

    test("a path blocked by a file where a directory must go is refused BEFORE anything is written", async () => {
        const dir = scratch({ ".portulan/verify": "not a directory\n" });
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], h.options), 2);
        assert.match(h.warned.join("\n"), /verify/);
        assert.equal(fs.existsSync(path.join(dir, ".portulan", "workspace.json")), false, "a refusal must leave no torso behind");
    });

    test("the manifest is written LAST, so a failed run is retryable rather than wedged", async (t) => {
        const files = draft({ residence: "in-repo", name: "acme", cycle: true, checkpoints: "rituals/checkpoints" }, scan(scratch()));
        const dir = scratch();
        const written = [];
        const real = fs.writeFileSync;
        t.mock.method(fs, "writeFileSync", (file, ...rest) => {
            written.push(String(file));
            return real(file, ...rest);
        });
        await run(["--residence", "in-repo", dir], harness().options);
        fs.writeFileSync.mock.restore();
        // `compile` reads the manifest, so its writes follow it, and a failure there leaves a whole draft.
        const compiled = path.join(dir, ".claude", "rules", "portulan") + path.sep;
        const drafted = written.filter((f) => !f.startsWith(compiled));
        assert.equal(drafted.length, files.size, "every drafted file must have been observed — an empty list would pass the order check vacuously");
        const manifestAt = written.findIndex((f) => f.endsWith("workspace.json"));
        assert.equal(manifestAt, files.size - 1, "workspace.json must be the last drafted file written, not the first");
        assert.ok(written.slice(manifestAt + 1).every((f) => f.startsWith(compiled)), "after the manifest, only compile's guidance half writes");
    });

    test("a `.portulan` symlink cannot carry the draft out of the repository", async () => {
        const dir = scratch();
        const outside = scratch();
        fs.symlinkSync(outside, path.join(dir, ".portulan"));
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], h.options), 2);
        assert.match(h.warned.join("\n"), /symlink/);
        assert.deepEqual(fs.readdirSync(outside), [], "not one byte may be written through the link");
    });

    test("a symlink NESTED inside .portulan is refused too, not just the root one", async () => {
        const dir = scratch();
        const outside = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"));
        fs.symlinkSync(outside, path.join(dir, ".portulan", "verify"));
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], h.options), 2);
        assert.match(h.warned.join("\n"), /symlink/);
        assert.deepEqual(fs.readdirSync(outside), []);
    });

    test("a symlinked `.portulan` is never READ through either, not just never written through", async () => {
        const dir = scratch();
        const elsewhere = scratch();
        fs.mkdirSync(path.join(elsewhere, ".portulan"));
        fs.writeFileSync(
            path.join(elsewhere, ".portulan", "workspace.json"),
            '{"portulan":{"spec":"2.7"},"name":"someone-elses","kind":"repository"}',
        );
        fs.symlinkSync(path.join(elsewhere, ".portulan"), path.join(dir, ".portulan"));
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], h.options), 2);
        const said = h.warned.join("\n");
        assert.match(said, /symlink/);
        assert.doesNotMatch(said, /someone-elses/, "the refusal must not report a workspace it read from outside the repository");
        assert.doesNotMatch(said, /already carries/, "that sentence would be a claim about this repository drawn from another one");
    });

    test("an unreadable directory is could-not-run, never `no residence here`", async (t) => {
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"));
        fs.chmodSync(path.join(dir, ".portulan"), 0o000);
        try {
            const seen = residenceAt(dir);
            if (seen.state === "none") {
                t?.skip?.("this process can stat through a mode-000 directory; EACCES is unreachable here");
                return;
            }
            assert.equal(seen.state, "unreadable");
            const h = harness();
            assert.equal(await run(["--residence", "in-repo", dir], h.options), 2);
        } finally {
            fs.chmodSync(path.join(dir, ".portulan"), 0o755);
        }
    });

    test("residenceAt reports a symlink as a symlink rather than resolving through it", () => {
        const dir = scratch();
        const elsewhere = scratch();
        fs.symlinkSync(elsewhere, path.join(dir, ".portulan"));
        assert.equal(residenceAt(dir).state, "symlink");
        assert.equal(residenceAt(scratch()).state, "none");
    });

    test("a dangling symlink is refused rather than written over", () => {
        // `existsSync` is false for a dangling link; only `lstat` sees the link itself.
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"));
        fs.symlinkSync(path.join(dir, "nowhere"), path.join(dir, ".portulan", "identity.md"));
        const files = draft({ residence: "in-repo", name: "acme", cycle: true, checkpoints: "rituals/checkpoints" }, scan(dir));
        const found = collisions(dir, files);
        assert.ok(found.some((c) => c.rel === ".portulan/identity.md" && /symlink/.test(c.why)));
    });

    test("collisions reports the path AND the reason, so a refusal can be acted on", () => {
        const dir = scratch({ ".portulan/identity.md": "mine\n" });
        const files = draft({ residence: "in-repo", name: "acme", cycle: true, checkpoints: "rituals/checkpoints" }, scan(dir));
        const found = collisions(dir, files);
        assert.equal(found.length, 1);
        assert.equal(found[0].rel, ".portulan/identity.md");
        assert.match(found[0].why, /exists/);
    });
});

describe("an empty answer is given-but-invalid, never treated as unasked", () => {
    for (const flag of ["--summary", "--name", "--feed", "--checkpoints"]) {
        test(`\`${flag} ""\` is refused rather than written`, async () => {
            const dir = scratch();
            const h = harness();
            const argv = ["--residence", "pointer", "--governed-by", "acme-platform", flag, "", dir];
            assert.equal(await run(argv, h.options), 2);
            assert.match(h.warned.join("\n"), /empty/i);
            assert.equal(fs.existsSync(path.join(dir, ".portulan")), false);
        });
    }

    test("an answers file's VALUES are type-checked, not only its keys", async () => {
        const dir = scratch();
        const answers = path.join(dir, "answers.json");
        fs.writeFileSync(answers, JSON.stringify({ residence: "in-repo", cycle: "false" }));
        const h = harness();
        assert.equal(await run(["--answers", answers, dir], h.options), 2);
        assert.match(h.warned.join("\n"), /cycle/);
    });

    test("importing this module runs nothing and throws nothing", async () => {
        // `node -e` leaves `process.argv[1]` unset, which an unguarded entry check throws on at load.
        const { execFileSync } = await import("node:child_process");
        const out = execFileSync(process.execPath, ["-e", "import('./cli/init.mjs').then(() => console.log('ok'))"], {
            cwd: REPO,
            encoding: "utf8",
        });
        assert.match(out, /ok/);
    });
});

describe("init emits no hook, which is why its silence about the gate is honest", () => {
    // Claude Code 2.1.220 fails open on a hook whose target is missing.
    test("nothing init writes is a hook, a settings file, or a reference to a runner", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
            e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
        const written = [...walk(path.join(dir, ".portulan")), ...walk(path.join(dir, ".claude"))];
        assert.deepEqual(fs.readdirSync(path.join(dir, ".claude")), ["rules"], "init writes no host settings — compiling them is a separate, deliberate act");
        assert.deepEqual(fs.readdirSync(path.join(dir, ".claude", "rules")), ["portulan"]);
        for (const file of written) {
            const text = fs.readFileSync(file, "utf8");
            assert.doesNotMatch(text, /"hooks"\s*:/, `${path.basename(file)} emits a hook`);
            assert.doesNotMatch(text, /compile\/stop\.mjs|compile\/gate\.mjs/, `${path.basename(file)} names a runner at its pre-milestone-7 path`);
        }
    });

    test("if a hook is ever emitted, its target must be proven to exist at draft time", () => {
        const files = draft({ residence: "in-repo", name: "acme", cycle: true, checkpoints: "rituals/checkpoints" }, scan(scratch()));
        for (const [rel, file] of files) {
            const targets = [...(file.contents ?? file.append.join("\n")).matchAll(/\$\{CLAUDE_PROJECT_DIR\}\/([^"'\s]+)/g)].map((m) => m[1]);
            assert.deepEqual(targets, [], `${rel} names host-resolved path(s) ${targets.join(", ")} that init cannot prove exist`);
        }
    });
});

describe("every refusal names what the human can do next", () => {
    const refusalFor = async (seed, argv) => {
        const dir = scratch(seed);
        const h = harness();
        assert.equal(await run([...argv, dir], h.options), 2);
        return h.warned.join("\n");
    };

    test("an existing residence names the tool that changes residence, and why the order matters", async () => {
        const seed = { ".portulan/workspace.json": '{"portulan":{"spec":"2.7"},"name":"acme","kind":"repository"}' };
        const text = await refusalFor(seed, ["--residence", "pointer", "--governed-by", "acme-platform"]);
        assert.match(text, /vendor/);
        assert.match(text, /--switch/);
        assert.match(text, /governed by nothing/, "the reason the order matters must travel with the instruction");
    });

    test("a corrupt manifest says how to get out of it", async () => {
        const text = await refusalFor({ ".portulan/workspace.json": "{ not json" }, ["--residence", "in-repo"]);
        assert.match(text, /Repair the JSON|move it aside/i);
    });

    test("a collision and an unresolvable pack each offer a route", async () => {
        assert.match(await refusalFor({ ".portulan/identity.md": "mine\n" }, ["--residence", "in-repo"]), /Move or remove|clean directory/i);
        const dir = scratch();
        const h = harness();
        await run(["--residence", "in-repo", "--pack-root", os.tmpdir(), dir], h.options);
        assert.match(h.warned.join("\n"), /--no-cycle|--checkpoints|Pass a root/);
    });
});

describe("the draft does not overstate its own rails to the adopter", () => {
    const emitted = async (rel) => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        return fs.readFileSync(path.join(dir, ".portulan", rel), "utf8");
    };

    test("verify/README does not claim a Stop-gate or CI runs these recipes", async () => {
        const text = await emitted("verify/README.md");
        assert.doesNotMatch(text, /the Stop-gate runs/i);
        assert.doesNotMatch(text, /CI runs them all/i);
        assert.match(text, /Nothing runs them for you yet|no Stop-gate/i);
    });

    test("the README's rule count is derived from the policy it describes", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const rules = JSON.parse(fs.readFileSync(path.join(dir, ".portulan", "gates.json"), "utf8")).rules.length;
        assert.match(fs.readFileSync(path.join(dir, ".portulan", "README.md"), "utf8"), new RegExp(`${rules} starter rules`));
    });

    test("the pack's unresolved state is named as RED, not as merely unchecked", async () => {
        assert.match(await emitted("README.md"), /RED/);
    });

    test("the handoff index is not kept, and the README describes the records the draft wrote", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const manifest = ok(dir);
        assert.equal(fs.existsSync(path.join(dir, ".portulan", manifest.handoffs.index.path)), false);
        assert.match(fs.readFileSync(path.join(dir, ".gitignore"), "utf8"), new RegExp(`^/\\.portulan/${manifest.handoffs.index.path.replace(".", "\\.")}$`, "m"));
        const readme = fs.readFileSync(path.join(dir, ".portulan", "README.md"), "utf8");
        assert.match(readme, /index is printed on demand[\s\S]{0,80}is not kept/i);
        assert.match(readme, /`changes\/`/);
        assert.equal(fs.existsSync(path.join(dir, "changes", "README.md")), true, "the directory a release cut assembles is drafted with its rule");
        assert.equal(fs.existsSync(path.join(dir, ".portulan", "handoffs", "README.md")), true, "the handoff template is drafted in the slot");
        assert.match(readme, /exits\s+\*\*2/i, "the rail's honest first state on an adopter's CI belongs in the artifact that ships it");
    });

    test("on a host where nothing resolves it, the run says so and offers a root to name", async () => {
        const dir = scratch();
        const h = harness();
        await run(["--residence", "in-repo", dir], h.options);
        const said = h.said.join("\n");
        assert.match(said, /RED until you say where to look/);
        assert.match(said, /not the host's plugin cache, and not `packs\/` in the repository/);
        assert.match(said, /doctor --pack-root <dir>/);
        assert.doesNotMatch(said, /--pack-root auto/, "advice to ask for a discovery this run already made");
    });

    test("on a host that CARRIES the pack, the unasked run resolves it and advises the bare invocation", async () => {
        const config = scratch();
        const installPath = path.join(config, "plugins", "cache", "feed", "carrier", "0.1.0");
        const packDir = path.join(installPath, "rituals", "checkpoints");
        fs.mkdirSync(packDir, { recursive: true });
        fs.writeFileSync(
            path.join(packDir, "pack.json"),
            JSON.stringify({ portulan: { pack: "1.0", version: "0.1.0" }, name: "checkpoints", category: "rituals", summary: "x", doc: "README.md", contributes: {} }),
        );
        const record = path.join(config, "plugins", "installed_plugins.json");
        fs.mkdirSync(path.dirname(record), { recursive: true });
        fs.writeFileSync(record, JSON.stringify({ version: 2, plugins: { "carrier@feed": [{ scope: "user", installPath, version: "0.1.0" }] } }));

        const dir = scratch();
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], { ...h.options, env: { CLAUDE_CONFIG_DIR: config } }), 0);
        const said = h.said.join("\n");
        assert.match(said, /it resolved from this host's plugin cache/);
        assert.match(said, new RegExp(`doctor ${path.join(dir, ".portulan").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
        assert.match(said, /that root is this machine's, not the repository's/);
    });

    test("unasked with an UNREADABLE record, the derived root still answers and the advice names it", async () => {
        const config = scratch();
        const record = path.join(config, "plugins", "installed_plugins.json");
        fs.mkdirSync(path.dirname(record), { recursive: true });
        fs.writeFileSync(record, "{ not json");

        const dir = scratch();
        const packDir = path.join(dir, "packs", "rituals", "checkpoints");
        fs.mkdirSync(packDir, { recursive: true });
        fs.writeFileSync(
            path.join(packDir, "pack.json"),
            JSON.stringify({ portulan: { pack: "1.0", version: "0.1.0" }, name: "checkpoints", category: "rituals", summary: "x", doc: "README.md", contributes: {} }),
        );

        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], { ...h.options, env: { CLAUDE_CONFIG_DIR: config } }), 0, h.warned.join("\n"));
        const said = h.said.join("\n");
        assert.match(said, /it resolved from `packs\/` in this repository/);
        assert.doesNotMatch(said, /this host's plugin cache/, "the cache was unreadable and did not answer");
        assert.doesNotMatch(said, /that root is this machine's/);
    });

    test("the DRAFT is byte-identical on a host that carries the pack and one that does not", async () => {
        const config = scratch();
        const installPath = path.join(config, "plugins", "cache", "feed", "carrier", "0.1.0");
        const packDir = path.join(installPath, "rituals", "checkpoints");
        fs.mkdirSync(packDir, { recursive: true });
        fs.writeFileSync(
            path.join(packDir, "pack.json"),
            JSON.stringify({ portulan: { pack: "1.0", version: "0.1.0" }, name: "checkpoints", category: "rituals", summary: "x", doc: "README.md", contributes: {} }),
        );
        const record = path.join(config, "plugins", "installed_plugins.json");
        fs.mkdirSync(path.dirname(record), { recursive: true });
        fs.writeFileSync(record, JSON.stringify({ version: 2, plugins: { "carrier@feed": [{ scope: "user", installPath, version: "0.1.0" }] } }));

        // The workspace name comes from the directory, so both runs draft into one of the same name.
        const digest = async (env) => {
            const dir = path.join(scratch(), "same-name");
            fs.mkdirSync(dir, { recursive: true });
            assert.equal(await run(["--residence", "in-repo", dir], { ...harness().options, ...(env ? { env } : {}) }), 0);
            const root = path.join(dir, ".portulan");
            const walk = (at, rel = "") =>
                fs
                    .readdirSync(at, { withFileTypes: true })
                    .flatMap((e) =>
                        e.isDirectory()
                            ? walk(path.join(at, e.name), `${rel}${e.name}/`)
                            : [`${rel}${e.name} :: ${fs.readFileSync(path.join(at, e.name), "utf8")}`],
                    )
                    .sort();
            return walk(root).join("\n");
        };

        const carrying = await digest({ CLAUDE_CONFIG_DIR: config });
        const bare = await digest(null);
        assert.equal(carrying, bare, "the drafted files must not vary with what is installed on the host");
    });

    test("where a root WAS given and the pack resolved, the closing advice says so and prints THAT invocation", async () => {
        const feed = scratch();
        fs.mkdirSync(path.join(feed, "rituals", "checkpoints"), { recursive: true });
        fs.writeFileSync(
            path.join(feed, "rituals", "checkpoints", "pack.json"),
            JSON.stringify({ portulan: { pack: "1.0", version: "0.1.0" }, name: "checkpoints", category: "rituals", summary: "x", doc: "README.md", contributes: {} }),
        );
        const dir = scratch();
        const h = harness();
        await run(["--residence", "in-repo", "--pack-root", feed, dir], h.options);
        const said = h.said.join("\n");
        assert.match(said, /composes `rituals\/checkpoints`, and it resolved/);
        assert.match(said, new RegExp(`doctor --pack-root ${feed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
        assert.doesNotMatch(said, /RED until/, "the pack resolved, so nothing here is RED for want of a root");
    });
});

// ---------------------------------------------------------------- the demonstration

describe("doctor is green on what init emits — the bar this session must clear", () => {
    // `doctor` derives `<tree>/packs`, which a fresh repository lacks, so a composed pack needs `--pack-root`.
    const doctor = (args) => {
        const env = { ...process.env, CLAUDE_CONFIG_DIR: scratch() };
        try {
            return { code: 0, out: execFileSync(process.execPath, [path.join(REPO, "cli", "doctor.mjs"), ...args], { encoding: "utf8", stdio: "pipe", env }) };
        } catch (error) {
            return { code: error.status, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
        }
    };

    test("an in-repo draft validates, with the pack root named", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", dir], harness().options), 0);
        const result = doctor(["--pack-root", path.join(REPO, "packs"), path.join(dir, ".portulan")]);
        assert.equal(result.code, 0, `doctor was not green on a fresh draft:\n${result.out}`);
    });

    test("an in-repo draft declaring a cache lifetime validates, at the 2.11 that added the key", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--cache-lifetime", "5m", dir], harness().options), 0);
        const result = doctor(["--pack-root", path.join(REPO, "packs"), path.join(dir, ".portulan")]);
        assert.equal(result.code, 0, `doctor was not green on a draft declaring a lifetime:\n${result.out}`);
        assert.match(result.out, /note {2}sessions {3}cache lifetime 5m, compiled as `promptCacheTtl`/);
    });

    test("an in-repo draft that opted out of the cycle validates with no roots at all", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        const result = doctor([path.join(dir, ".portulan")]);
        assert.equal(result.code, 0, `doctor was not green on a cycle-free draft:\n${result.out}`);
    });

    test("a pointer draft validates", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "pointer", "--governed-by", "acme-platform", dir], harness().options), 0);
        const result = doctor([path.join(dir, ".portulan")]);
        assert.equal(result.code, 0, `doctor was not green on a pointer:\n${result.out}`);
    });
});

// ---------------------------------------------------------------- the interview

describe("the interview asks, and only where somebody is there to answer", () => {
    function scripted(answers, { interactive = true } = {}) {
        const asked = [];
        const said = [];
        return {
            asked,
            said,
            io: {
                interactive,
                say: (line) => said.push(line),
                async ask(question) {
                    asked.push(question);
                    return answers.length ? answers.shift() : null;
                },
            },
        };
    }

    test("a missing answer is asked for at a terminal, and the draft is written", async () => {
        const dir = scratch();
        const s = scripted(["in-repo", "", "", "none", "", "y"]);
        const code = await run([dir], { ...harness().options, io: s.io });
        assert.equal(code, 0, "an interviewed run that confirms must write");
        assert.match(s.asked.join("\n"), /residence/, "the one question init may not answer must be asked");
        assert.equal(ok(dir).kind, "repository");
    });

    test("nothing is asked where stdin or stdout is not a TTY — the refusal is the old one, unchanged", async () => {
        const dir = scratch();
        const s = scripted(["in-repo", "", "", "none", "", "y"], { interactive: false });
        const h = harness();
        const code = await run([dir], { ...h.options, io: s.io });
        assert.equal(code, 2, "a non-interactive run must refuse exactly as it did before the interview existed");
        assert.equal(s.asked.length, 0, "a headless host must never be prompted: the run would hang");
        assert.match(h.warned.join("\n"), /--residence/);
        assert.equal(fs.existsSync(path.join(dir, ".portulan")), false);
    });

    test("`--no-interview` forces the non-interactive path at a terminal", async () => {
        const dir = scratch();
        const s = scripted(["in-repo", "", "", "none", "", "y"]);
        const h = harness();
        assert.equal(await run(["--no-interview", dir], { ...h.options, io: s.io }), 2);
        assert.equal(s.asked.length, 0);
        assert.match(h.warned.join("\n"), /--residence/);
    });

    test("what the flags already answered is never asked again", async () => {
        const dir = scratch();
        const s = scripted(["none", "", "y"]);
        assert.equal(await run(["--residence", "in-repo", "--name", "acme", "--summary", "one line", dir], { ...harness().options, io: s.io }), 0);
        const questions = s.asked.join("\n");
        assert.doesNotMatch(questions, /residence/, "being asked to confirm a flag you just typed reads as not having listened");
        assert.doesNotMatch(questions, /workspace name/);
        assert.doesNotMatch(questions, /summary/);
        assert.equal(ok(dir).name, "acme");
    });

    test("a question offers the derived default where one exists, and an empty line accepts it", async () => {
        const dir = scratch();
        const s = scripted(["in-repo", "", "", "none", "", "y"]);
        assert.equal(await run([dir], { ...harness().options, io: s.io }), 0);
        const name = s.asked.find((q) => q.startsWith("workspace name"));
        assert.match(name, /\[.+\]/, "the name question must offer the directory-derived slug");
        assert.equal(ok(dir).name, slugify(path.basename(dir)), "an empty line must take the offered default");
    });

    test("residence and the governor offer no default — the two answers nothing can derive", async () => {
        const dir = scratch();
        const s = scripted(["pointer", "", "", "acme-platform", "none", "y"]);
        assert.equal(await run([dir], { ...harness().options, io: s.io }), 0);
        assert.equal(
            s.asked.find((q) => q.startsWith("residence")).includes("["),
            false,
            "a residence with a default would be the tool answering the question row 7 says it asks",
        );
        assert.equal(s.asked.find((q) => q.includes("governing")).includes("["), false);
        assert.equal(ok(dir).governed_by.workspace, "acme-platform");
    });

    test("the governor and the feed are asked only for a pointer", async () => {
        const dir = scratch();
        const s = scripted(["in-repo", "", "", "none", "", "y"]);
        assert.equal(await run([dir], { ...harness().options, io: s.io }), 0);
        assert.doesNotMatch(s.asked.join("\n"), /governing|feed/, "a workspace that lives here has no governor and no feed");
    });

    test("an answer the schema refuses is re-asked with the reason, and does not abort the run", async () => {
        const dir = scratch();
        const s = scripted(["feed-side", "in-repo", "Not A Slug", "acme", "", "none", "", "y"]);
        assert.equal(await run([dir], { ...harness().options, io: s.io }), 0, "a typo at a prompt must be re-asked, never fatal");
        assert.equal(s.asked.filter((q) => q.startsWith("residence")).length, 2);
        assert.equal(s.asked.filter((q) => q.startsWith("workspace name")).length, 2);
        const complaints = s.said.join("\n");
        assert.match(complaints, /is not a residence/);
        assert.match(complaints, /is not a slug/);
        assert.equal(ok(dir).name, "acme");
    });

    test("declining at the confirmation writes nothing, and exits 2", async () => {
        const dir = scratch();
        const s = scripted(["in-repo", "", "", "none", "", "n"]);
        const h = harness();
        assert.equal(await run([dir], { ...h.options, io: s.io }), 2, "0 must keep meaning `it wrote`");
        assert.equal(fs.existsSync(path.join(dir, ".portulan")), false, "a decline must leave the repository untouched");
        assert.match(h.warned.join("\n"), /declined/);
    });

    test("EOF at any prompt is not an empty answer — it stops the run with nothing written", async () => {
        const dir = scratch();
        const s = scripted([]);
        const h = harness();
        assert.equal(await run([dir], { ...h.options, io: s.io }), 2);
        assert.equal(fs.existsSync(path.join(dir, ".portulan")), false);
        assert.match(h.warned.join("\n"), /interview ended/);
    });

    test("the confirmation echoes every answer before a byte is written", async () => {
        const dir = scratch();
        const s = scripted(["in-repo", "acme", "one line", "none", "", "y"]);
        assert.equal(await run([dir], { ...harness().options, io: s.io }), 0);
        const echoed = s.said.join("\n");
        assert.match(echoed, /about to draft/);
        assert.match(echoed, /acme/);
        assert.match(echoed, /one line/);
    });

    test("an already-governed repository is refused before the questions, not after them", async () => {
        const dir = scratch({ ".portulan/workspace.json": JSON.stringify({ portulan: { spec: "2.7" }, name: "already", kind: "repository" }) });
        const s = scripted(["in-repo", "", "", "none", "", "y"]);
        const h = harness();
        assert.equal(await run([dir], { ...h.options, io: s.io }), 2);
        assert.equal(s.asked.length, 0, "the machine's question comes first");
        assert.match(h.warned.join("\n"), /already carries/);
    });

    test("`none` at the checkpoints prompt composes no packs", async () => {
        const dir = scratch();
        const s = scripted(["in-repo", "", "", "none", "", "y"]);
        assert.equal(await run([dir], { ...harness().options, io: s.io }), 0);
        assert.equal(ok(dir).packs, undefined, "opting out at the prompt must be the same answer as --no-cycle");
    });

    test("the lifetime is asked last, after the offer's reason and its trade-off, and a yes drafts it at 2.11", async () => {
        const dir = scratch();
        const s = scripted(["in-repo", "", "", "none", "y", "y"]);
        const h = harness();
        assert.equal(await run([dir], { ...h.options, io: s.io }), 0, h.warned.join("\n"));
        const question = s.asked.indexOf("Five-minute cache writes? [y/N]: ");
        assert.equal(question, s.asked.length - 2, "the question comes after every other one and before the confirmation");
        const said = s.said.join("\n");
        for (const text of [LIFETIME_OFFER.reason, LIFETIME_OFFER.tradeOff]) assert.ok(said.includes(text), "a yes is given knowing the reason and the trade-off");
        assert.match(said, /^ {2}cache {7}5m, as `sessions\.cache_lifetime` at Workspace Definition 2\.11$/m, "the confirmation echoes the answer");
        assert.equal(ok(dir).portulan.spec, "2.11");
        assert.deepEqual(ok(dir).sessions, { cache_lifetime: "5m" });
        assert.ok(h.said.some((l) => /run `portulan compile`, which writes it into \.claude\/settings\.json as `promptCacheTtl`/.test(l)));
    });

    test("anything but a yes leaves the host's default, and the report says so in one line, not the offer again", async () => {
        for (const answer of ["", "n", "5m"]) {
            const dir = scratch();
            const s = scripted(["in-repo", "", "", "none", answer, "y"]);
            const h = harness();
            assert.equal(await run([dir], { ...h.options, io: s.io }), 0, h.warned.join("\n"));
            assert.match(s.said.join("\n"), /^ {2}cache {7}\(none — the host's default lifetime\)$/m);
            assert.equal(ok(dir).portulan.spec, "2.10", `${JSON.stringify(answer)}: a manifest declaring nothing new stays at 2.10`);
            assert.equal(ok(dir).sessions, undefined);
            const lines = h.said.filter((l) => /cache lifetime|sessions\.cache_lifetime/.test(l));
            assert.equal(lines.length, 1, lines.join("\n"));
            assert.match(lines[0], /no cache lifetime declared, as you answered; `sessions\.cache_lifetime` declares one.*`--cache-lifetime` drafts it/);
            assert.ok(!h.said.some((l) => l.includes(OFFER_ENDS)), "the offer the person just declined is not printed again");
        }
    });

    test("a lifetime the flags gave is not asked again, and a pointer is never asked", async () => {
        const given = scratch();
        const s = scripted(["", "", "none", "y"]);
        assert.equal(await run(["--residence", "in-repo", "--cache-lifetime", "1h", given], { ...harness().options, io: s.io }), 0);
        assert.ok(!s.asked.some((q) => q.startsWith("Five-minute")), "being asked to confirm a flag you just typed reads as not having listened");
        assert.match(s.said.join("\n"), /^ {2}cache {7}1h, as `sessions\.cache_lifetime`/m);
        assert.deepEqual(ok(given).sessions, { cache_lifetime: "1h" });

        const pointer = scratch();
        const p = scripted(["pointer", "", "", "platform", "none", "y"]);
        assert.equal(await run([pointer], { ...harness().options, io: p.io }), 0);
        assert.ok(!p.asked.some((q) => q.startsWith("Five-minute")), "a pointer drafts no settings for a lifetime to reach");
        assert.ok(!p.said.join("\n").includes(LIFETIME_OFFER.reason));
    });

    test("EOF at the lifetime question is no answer, and nothing is written", async () => {
        const dir = scratch();
        const s = scripted(["in-repo", "", "", "none"]);
        const h = harness();
        assert.equal(await run([dir], { ...h.options, io: s.io }), 2);
        assert.equal(s.asked.at(-1), "Five-minute cache writes? [y/N]: ");
        assert.match(h.warned.join("\n"), /interview ended/);
        assert.equal(fs.existsSync(path.join(dir, ".portulan")), false);
    });
});

// ---------------------------------------------------------------- the records rail

describe("the drafted workspace carries the rail that holds its index current", () => {
    const railOf = (dir) => path.join(dir, ".portulan", "verify", "index.sh");
    const runRail = (dir, env = {}) => {
        try {
            return { code: 0, out: execFileSync("bash", [railOf(dir)], { cwd: dir, encoding: "utf8", stdio: "pipe", env: { ...process.env, ...env } }) };
        } catch (error) {
            return { code: error.status, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
        }
    };

    test("no index is kept, and day one is green: the series renders with no copy on disk", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        assert.equal(fs.existsSync(path.join(dir, ".portulan", "handoffs-index.md")), false);
        const result = runRail(dir);
        assert.equal(result.code, 0, `a freshly drafted workspace must be green on its own rail:\n${result.out}`);
    });

    test("the recipe is declared beside `workspace`, and the default does not move", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        const manifest = ok(dir);
        assert.deepEqual(manifest.verify.recipes.map((r) => r.id), ["workspace", "index"]);
        assert.equal(manifest.verify.default, "workspace", "the default is what runs at a session end, and that is not this");
        assert.deepEqual(manifest.verify.recipes[1].requires, ["bash", "node"]);
    });

    test("a copy kept and edited by hand is RED, and regenerating or deleting it returns the rail to green", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        const index = path.join(dir, ".portulan", "handoffs-index.md");
        const regenerate = () => execFileSync(process.execPath, [path.join(REPO, "cli", "index.mjs"), path.join(dir, ".portulan")], { stdio: "pipe" });
        fs.writeFileSync(index, "");
        regenerate();
        assert.equal(runRail(dir).code, 0, "a copy the tool wrote is current");
        fs.appendFileSync(index, "\n- 2026-08-11 · [a handoff nobody wrote](handoffs/x.md)\n");
        assert.equal(runRail(dir).code, 1, "a hand-edited generated file must be a verdict, not a note");
        regenerate();
        assert.equal(runRail(dir).code, 0, "regenerating must repair it");
        fs.rmSync(index);
        assert.equal(runRail(dir).code, 0, "a copy nobody keeps is compared with nothing");
    });

    test("a handoff that yields no index line is RED, with no copy kept", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        fs.writeFileSync(path.join(dir, ".portulan", "handoffs", "2026-08-11-a-session.md"), "# Handoff — a session\n");
        assert.equal(runRail(dir).code, 0, "a dated handoff with a heading renders");
        fs.writeFileSync(path.join(dir, ".portulan", "handoffs", "a-session.md"), "no heading\n");
        assert.equal(runRail(dir).code, 1, "an undated, untitled handoff has no line to render");
    });

    test("no reachable CLI is could-not-run, naming all three locations — never a pass", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        // The drafted fallback is this checkout's bundle, which exists, so the rail is rewritten to lose it.
        const rail = railOf(dir);
        fs.writeFileSync(rail, fs.readFileSync(rail, "utf8").replace(/elif \[ -f "[^"]*" \]/, 'elif [ -f "/nonexistent/cli/index.mjs" ]'));
        const result = runRail(dir, { PORTULAN_CLI: "", PATH: "/usr/bin:/bin" });
        assert.equal(result.code, 2, "a rail that cannot find its tool must never exit 0");
        assert.match(result.out, /NOT checked/);
        assert.match(result.out, /PORTULAN_CLI/);
    });

    test("an absent `node` is 2 as well, and not the shell's 127", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        const result = runRail(dir, { PATH: "/usr/bin:/bin" });
        assert.equal(result.code, 2);
        assert.match(result.out, /node is needed/);
    });

    test("`PORTULAN_CLI` is the first location consulted", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        assert.equal(runRail(dir, { PORTULAN_CLI: path.join(REPO, "cli") }).code, 0);
        const missing = runRail(dir, { PORTULAN_CLI: path.join(REPO, "nowhere") });
        assert.notEqual(missing.code, 0, "an explicit location that answers wrongly must not fall through to another");
    });
});

describe("the drafted rail maps an exec failure from the tool itself to could-not-run", () => {
    test("an entry point whose interpreter is missing is 2, not a verdict about the index", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        const fake = path.join(scratch(), "bin");
        fs.mkdirSync(fake, { recursive: true });
        fs.writeFileSync(path.join(fake, "portulan"), "#!/nonexistent/interpreter\n", { mode: 0o755 });
        try {
            execFileSync("bash", [path.join(dir, ".portulan", "verify", "index.sh")], {
                cwd: dir,
                encoding: "utf8",
                stdio: "pipe",
                env: { ...process.env, PORTULAN_CLI: "", PATH: `${fake}:/usr/bin:/bin` },
            });
            assert.fail("a rail that cannot execute its tool must not exit 0");
        } catch (error) {
            assert.equal(error.status, 2, `expected could-not-run, got ${error.status}`);
            assert.match(`${error.stdout ?? ""}${error.stderr ?? ""}`, /NOT checked/);
        }
    });
});

describe("the drafted rail's machine-local path stays findable", () => {
    test("both lines carrying the bundle path are marked", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        const rail = fs.readFileSync(path.join(dir, ".portulan", "verify", "index.sh"), "utf8");
        const marked = rail.split("\n").filter((line) => line.includes("portulan:bundle-fallback"));
        assert.equal(marked.length, 2, `expected both bundle-path lines marked, got:\n${marked.join("\n")}`);
        for (const line of marked) {
            assert.ok(line.includes(REPO), `a marked line must be one that actually carries the absolute path: ${line}`);
        }
        for (const rel of ["verify/README.md", "README.md", "workspace.json"]) {
            const text = fs.readFileSync(path.join(dir, ".portulan", rel), "utf8");
            assert.equal(text.includes(REPO), false, `${rel} carries the drafting machine's absolute path with no marker`);
        }
    });

    test("the marker's carriers cite it — the one that re-derives, and the one that copies it stale", () => {
        for (const rel of ["cli/vendor.mjs", "spec/migrations/0002-bundle-fallback-path.mjs"]) {
            const source = fs.readFileSync(path.join(REPO, rel), "utf8");
            assert.match(source, /portulan:bundle-fallback/, `${rel} must name the marker it re-derives or copies`);
        }
    });
});

describe("where git lists the tree, the drafted workspace holds its comments' history at the count it has", () => {
    const repository = (seed) => {
        const dir = scratch(seed);
        execFileSync("git", ["init", "-q"], { cwd: dir });
        return dir;
    };
    const railOf = (dir) => path.join(dir, ".portulan", "verify", "comments.sh");
    const runRail = (dir, env = { ...process.env, PORTULAN_CLI: path.join(REPO, "cli") }) => {
        try {
            return { code: 0, out: execFileSync(railOf(dir), { cwd: dir, encoding: "utf8", stdio: "pipe", env }) };
        } catch (error) {
            return { code: error.status, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
        }
    };

    test("the recipe is declared at the tree's count, green as drafted and red on one line more", async () => {
        const dir = repository({ "src/a.js": "// Added 2026-09-01: the first thing.\nexport const a = 1;\n" });
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        const manifest = ok(dir);
        assert.deepEqual(manifest.verify.recipes.map((r) => r.id), ["workspace", "index", "comments"]);
        assert.equal(manifest.verify.default, "workspace");
        assert.deepEqual(manifest.verify.recipes[2].requires, ["bash", "git", "node"]);
        assert.match(fs.readFileSync(railOf(dir), "utf8"), /^LIMIT=1$/m, "the drafted files add no line to the tree's one");
        const green = runRail(dir);
        assert.equal(green.code, 0, green.out);
        fs.appendFileSync(path.join(dir, "src", "a.js"), "// Fixed in PR #12.\n");
        const red = runRail(dir);
        assert.equal(red.code, 1, red.out);
        assert.match(red.out, /src\/a\.js: 1 date · 3 reference/);
    });

    test("a bundle whose source map is one comment line of 200,000 characters is counted like any file", async () => {
        const dir = repository({ "dist/bundle.js": `x();\n//# sourceMappingURL=data:application/json;base64,${"A".repeat(200_000)}\n` });
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        assert.deepEqual(ok(dir).verify.recipes.map((r) => r.id), ["workspace", "index", "comments"]);
        assert.match(fs.readFileSync(railOf(dir), "utf8"), /^LIMIT=0$/m);
        const green = runRail(dir);
        assert.equal(green.code, 0, green.out);
    });

    test("its two lines naming the bundle are marked, in the shape `0002` re-derives", async () => {
        const dir = repository();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        const marked = fs.readFileSync(railOf(dir), "utf8").split("\n").filter((line) => line.includes("portulan:bundle-fallback"));
        assert.equal(marked.length, 2);
        for (const line of marked) assert.equal([...line.matchAll(/"([^"]*)"/g)].filter((m) => m[1].endsWith("/cli/index.mjs")).length, 1, line);
    });

    test("a `portulan` on PATH holding no comments.mjs is passed over for the bundle; a PORTULAN_CLI holding none cannot run", async () => {
        const dir = repository();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        const bin = scratch({ portulan: "#!/bin/sh\nexit 0\n" });
        fs.chmodSync(path.join(bin, "portulan"), 0o755);
        const onPath = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` };
        delete onPath.PORTULAN_CLI;
        const bundle = runRail(dir, onPath);
        assert.equal(bundle.code, 0, bundle.out);
        fs.writeFileSync(path.join(bin, "comments.mjs"), "console.log('the copy on PATH');\n");
        assert.match(runRail(dir, onPath).out, /the copy on PATH/);
        const explicit = runRail(dir, { ...onPath, PORTULAN_CLI: scratch() });
        assert.equal(explicit.code, 2, explicit.out);
        assert.match(explicit.out, /holds no comments\.mjs/);
    });

    test("a tree git does not list gets no recipe, and is told `upgrade` offers one", async () => {
        const dir = scratch();
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], h.options), 0);
        assert.deepEqual(ok(dir).verify.recipes.map((r) => r.id), ["workspace", "index"]);
        assert.equal(fs.existsSync(railOf(dir)), false);
        assert.ok(h.said.some((line) => /drafted no `comments` recipe.*git could not list the files.*`portulan upgrade` offers one/.test(line)), h.said.join("\n"));
    });
});

test("init refuses a named root combined with `--pack-root auto`", async () => {
    const h = harness();
    const dir = scratch();
    assert.equal(await run(["--residence", "in-repo", "--pack-root", "auto", "--pack-root", dir, dir], h.options), 2);
    assert.match([...h.said, ...h.warned].join("\n"), /never both/);
});

test("init refuses the pair even with `--no-cycle`, where nothing resolves a pack", async () => {
    const h = harness();
    const dir = scratch();
    assert.equal(await run(["--residence", "in-repo", "--no-cycle", "--pack-root", "auto", "--pack-root", dir, dir], h.options), 2);
    assert.match([...h.said, ...h.warned].join("\n"), /never both/);
    assert.equal(fs.existsSync(path.join(dir, ".portulan")), false, "a refused command line writes nothing");
});

test("init on a fresh host: absent record is a verdict, unreadable is could-not-run", async () => {
    // Both exit 2, since `init` drafts in neither case, so only the sentence tells them apart.
    const withEnvVar = async (config, fn) => {
        const before = process.env.CLAUDE_CONFIG_DIR;
        process.env.CLAUDE_CONFIG_DIR = config;
        try { return await fn(); } finally {
            if (before === undefined) delete process.env.CLAUDE_CONFIG_DIR;
            else process.env.CLAUDE_CONFIG_DIR = before;
        }
    };

    const absent = scratch();
    const h1 = harness();
    assert.equal(await withEnvVar(absent, () => run(["--residence", "in-repo", "--pack-root", "auto", scratch()], h1.options)), 2);
    assert.match([...h1.said, ...h1.warned].join("\n"), /does not resolve/, "nothing installed is a verdict about the pack");

    const bad = scratch();
    fs.mkdirSync(path.join(bad, "plugins"), { recursive: true });
    fs.writeFileSync(path.join(bad, "plugins", "installed_plugins.json"), "{ not json");
    const h2 = harness();
    assert.equal(await withEnvVar(bad, () => run(["--residence", "in-repo", "--pack-root", "auto", scratch()], h2.options)), 2);
    assert.match([...h2.said, ...h2.warned].join("\n"), /Discovery could not look/, "an unreadable host is a fact about the host");
});

// ---------------------------------------------------------------- the boot card, compiled from the draft

describe("init drafts a boot card and compiles it", () => {
    test("the manifest is at 2.10 and declares the context slot; the card is compiled and current", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", dir], harness().options), 0);
        const manifest = ok(dir);
        assert.equal(manifest.portulan.spec, "2.10", "slots.context arrived at 2.10");
        assert.equal(manifest.slots.context, "context/");
        assert.equal(manifest.context, undefined, "a budget is offered, never written: the schema cannot say a ratio nobody measured");
        const card = fs.readFileSync(path.join(dir, ".claude", "rules", "portulan", "boot.md"), "utf8");
        assert.match(card, /^# Portulan boot card$/m);
        assert.match(card, /^@\.\.\/\.\.\/\.\.\/\.portulan\/identity\.md$/m, "the identity is imported whole, one source");
        assert.match(card, /^- \*\*Gated\*\*[^\n]*`merge-a-pull-request`/m, "the gates are written out from the policy");
        assert.match(card, /^1\. \*\*The verify recipe ran green in this working copy\.\*\*$/m, "the definition of done's leads are written out");
        assert.doesNotMatch(card, /<!-- (?:leads|gates):/, "no instruction line survives the compile");
        assert.equal(compileGuidance(dir, { check: true }).drifted, 0, "what init compiled is what compile would write");
    });

    test("a slot edited after init makes the card drift, which compile repairs", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", dir], harness().options), 0);
        const dod = path.join(dir, ".portulan", "dod.md");
        fs.writeFileSync(dod, fs.readFileSync(dod, "utf8").replace("**You could walk a reviewer through every line.**", "**A reviewer read every line.**"));
        assert.equal(compileGuidance(dir, { check: true }).drifted, 1);
        compileGuidance(dir);
        assert.match(fs.readFileSync(path.join(dir, ".claude", "rules", "portulan", "boot.md"), "utf8"), /^2\. \*\*A reviewer read every line\.\*\*$/m);
    });

    test("the offer is the larger of 8,000 tokens and the always tier, printed and not written", async () => {
        const dir = scratch();
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], h.options), 0);
        const line = h.said.find((l) => l.includes("A budget is yours to declare"));
        assert.ok(line, "the offer is said where the adopter reads it");
        assert.match(line, /always tier here is ~[\d,]+ tokens with the card/);
        assert.match(line, /offers the larger of 8,000 tokens and that, 8,000, as `context\.always\.budget\.tokens`/);
    });

    test("a large instruction file is offered the split, printed, and not one byte of it changed", async () => {
        const claude = `# Big\n\n## Loans\n\n${"Every loan is recorded at the desk. ".repeat(900)}\n`;
        const dir = scratch({ "CLAUDE.md": claude });
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], h.options), 0);
        assert.match(h.said.join("\n"), /init: CLAUDE\.md is ~10,\d{3} tokens in every context, and a line `<!-- portulan: on-read -->` under a heading moves that section/);
        assert.equal(fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8"), claude);
        const small = harness();
        assert.equal(await run(["--residence", "in-repo", scratch({ "CLAUDE.md": "# Small\n\n## Loans\n\nShort.\n" })], small.options), 0);
        assert.doesNotMatch(small.said.join("\n"), /portulan: on-read/);
    });

    test("a rule written by hand where the card goes is left alone, and the draft boots through its slots", async () => {
        const dir = scratch({ ".claude/rules/portulan/boot.md": "mine\n" });
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], h.options), 0, "the workspace is drafted whole either way");
        assert.equal(fs.readFileSync(path.join(dir, ".claude", "rules", "portulan", "boot.md"), "utf8"), "mine\n");
        assert.match(h.warned.join("\n"), /drafted and NOT compiled/);
        assert.ok(fs.existsSync(path.join(dir, ".portulan", "context", "boot.md")), "the card's source stays for a compile once the rule is cleared");
    });

    test("where .gitignore hides .claude/, the exceptions for the compiled rules join it, and git sees the card", async () => {
        const dir = scratch({ ".gitignore": ".claude/\n" });
        execFileSync("git", ["init", "-q", dir]);
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], h.options), 0);
        assert.equal(h.warned.some((l) => /git ignores/.test(l)), false, h.warned.join("\n"));
        const ignored = (rel) => {
            try {
                execFileSync("git", ["-C", dir, "check-ignore", "-q", rel]);
                return true;
            } catch {
                return false;
            }
        };
        assert.equal(ignored(".claude/rules/portulan/boot.md"), false, "the compiled card reaches review");
        assert.equal(ignored(".claude/settings.local.json"), true, "everything else under .claude/ stays ignored");
        assert.equal(ignored(".portulan/handoffs-index.md"), true, "the handoff index is not kept");
    });
});

// ---------------------------------------------------------------- the cache lifetime, offered and declared

describe("init offers the cache lifetime, and writes it only where it was chosen", () => {
    const KEYS = ["portulan", "name", "summary", "kind", "tree", "gates", "slots", "verify", "handoffs", "packs"];

    test("`--cache-lifetime` writes the key, and the manifest declares 2.11, the version that added it", async () => {
        for (const lifetime of ["5m", "1h"]) {
            const dir = scratch();
            const h = harness();
            assert.equal(await run(["--residence", "in-repo", "--cache-lifetime", lifetime, dir], h.options), 0, h.warned.join("\n"));
            const manifest = ok(dir);
            assert.equal(manifest.portulan.spec, "2.11", "a manifest declares the version its content needs");
            assert.deepEqual(manifest.sessions, { cache_lifetime: lifetime });
            assert.deepEqual(Object.keys(manifest), [...KEYS, "sessions"], "nothing else moves");
            assert.equal(fs.existsSync(path.join(dir, ".claude", "settings.json")), false, "init writes no host settings");
            const said = h.said.join("\n");
            assert.match(said, new RegExp(`declares a ${lifetime} cache lifetime, \`sessions\\.cache_lifetime\` at Workspace Definition 2\\.11 — run \`portulan compile\``));
            assert.ok(!said.includes(OFFER_ENDS), "a lifetime chosen is the offer answered");
        }
    });

    test("the answers file's `cache-lifetime` does the same, and the flag outranks it", async () => {
        const dir = scratch();
        const answers = path.join(scratch(), "answers.json");
        fs.writeFileSync(answers, JSON.stringify({ residence: "in-repo", "cache-lifetime": "1h" }));
        assert.equal(await run(["--answers", answers, dir], harness().options), 0);
        assert.deepEqual(ok(dir).sessions, { cache_lifetime: "1h" });
        assert.equal(ok(dir).portulan.spec, "2.11");

        const nearer = scratch();
        assert.equal(await run(["--answers", answers, "--cache-lifetime", "5m", nearer], harness().options), 0);
        assert.deepEqual(ok(nearer).sessions, { cache_lifetime: "5m" }, "the nearer answer wins");
    });

    test("with none chosen and nothing asked, the manifest is unchanged at 2.10, and the report prints the offer", async () => {
        const dir = scratch();
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", "--no-interview", dir], h.options), 0);
        const manifest = ok(dir);
        assert.equal(manifest.portulan.spec, "2.10");
        assert.equal(manifest.sessions, undefined);
        assert.deepEqual(Object.keys(manifest), KEYS);
        const observed = scan(scratch());
        const before = { residence: "in-repo", name: "consumer", cycle: true, checkpoints: "rituals/checkpoints", given: new Set(["residence"]), packRoots: [] };
        assert.equal(draft({ ...before, cacheLifetime: null }, observed).get(".portulan/workspace.json").contents, draft(before, observed).get(".portulan/workspace.json").contents);
        const at = h.said.findIndex((l) => l.includes("A budget is yours to declare"));
        assert.ok(at >= 0);
        assert.deepEqual(h.said.slice(at + 1, at + 1 + offerLines().length), offerLines().map((l) => `init: ${l}`));
        assert.ok(!h.said.some((l) => l.includes("spend.multipliers")), h.said.join("\n"));
    });

    test("a lifetime the host does not take is refused, by flag and by answers file, and nothing is written", async () => {
        for (const bad of ["30m", "5M", "1d"]) {
            const dir = scratch();
            const h = harness();
            assert.equal(await run(["--residence", "in-repo", "--cache-lifetime", bad, dir], h.options), 2, `${bad} must be refused`);
            assert.match(h.warned.join("\n"), new RegExp(`\`${bad}\` is not a cache lifetime — Claude Code takes \`5m\` and \`1h\``));
            assert.equal(fs.existsSync(path.join(dir, ".portulan")), false);
        }
        const dir = scratch();
        const answers = path.join(scratch(), "answers.json");
        fs.writeFileSync(answers, JSON.stringify({ residence: "in-repo", "cache-lifetime": "forever" }));
        const h = harness();
        assert.equal(await run(["--answers", answers, dir], h.options), 2);
        assert.match(h.warned.join("\n"), /`forever` is not a cache lifetime/);
        assert.equal(fs.existsSync(path.join(dir, ".portulan")), false);
    });

    test("a pointer refuses the lifetime, by flag and by answers file, with the reason a pointer has", async () => {
        const dir = scratch();
        const h = harness();
        assert.equal(await run(["--residence", "pointer", "--governed-by", "platform", "--cache-lifetime", "5m", dir], h.options), 2);
        const refusal = h.warned.join("\n");
        assert.match(refusal, /`--cache-lifetime` does nothing with `--residence pointer` — a pointer drafts no repository whose settings `compile` writes/);
        assert.doesNotMatch(refusal, /composes no packs/, "the packs' reason is not this option's");
        assert.equal(fs.existsSync(path.join(dir, ".portulan")), false);

        const answers = path.join(scratch(), "answers.json");
        fs.writeFileSync(answers, JSON.stringify({ residence: "pointer", "governed-by": "platform", "cache-lifetime": "5m", checkpoints: "rituals/other" }));
        const both = harness();
        assert.equal(await run(["--answers", answers, scratch()], both.options), 2);
        assert.match(both.warned.join("\n"), /`--checkpoints` and `--cache-lifetime` do nothing .* composes no packs, and a pointer drafts no repository/);
    });

    test("`compile` writes the drafted lifetime into the consumer's settings as `promptCacheTtl`", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--cache-lifetime", "5m", dir], harness().options), 0);
        const settings = path.join(dir, ".claude", "settings.json");
        assert.equal(fs.existsSync(settings), false, "init leaves the settings to compile");
        execFileSync(process.execPath, [path.join(REPO, "cli", "compile.mjs"), "--workspace", dir, "--pack-root", path.join(REPO, "packs")], { encoding: "utf8", stdio: "pipe" });
        const text = fs.readFileSync(settings, "utf8");
        assert.match(text, /"promptCacheTtl": "5m"/);
        assert.equal(JSON.parse(text).promptCacheTtl, "5m");
    });
});
