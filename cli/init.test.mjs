// Tests for `init` — the onboarding subcommand that drafts a workspace for a repository that has none.
//
// Written before the generator, per ../core/operating/verification.md: the failing test is the spec.
// Zero dependencies, node's own runner, same as ./doctor.test.mjs and ./index.test.mjs, and run by the
// same recipe.
//
//   node --test "cli/**/*.test.mjs"
//
// ## What this suite establishes, and what it cannot
//
// It establishes that `init` **asks** rather than defaults, that what it writes **validates** — the
// last group runs the real `doctor` against real directories on disk, in both residences, because a
// drafted workspace nothing validates is a drafted workspace nobody can trust — and that the two
// destructive shapes are refused: overwriting a residence that already exists, and emitting a manifest
// `doctor` would misread.
//
// It cannot establish that the draft is any GOOD. Whether an adopter reads `identity.md` and recognises
// their own team is a question for the milestone-7 demonstration ("a never-seen repo onboards to a
// validated workspace in one afternoon"), and no assertion here should be read as answering it. Nor
// does anything here exercise the session-end gate — but the REASON changed at milestone 7 and the old
// one is worth keeping visible. It used to be that the runner shipped in no artifact an adopter
// receives, so a test asserting the wire would have asserted a capability that did not exist. Since the
// runners moved into `cli/`, the capability exists and was demonstrated live. What is still true is
// narrower: `init` does not RUN `compile` over what it drafts, so a drafted workspace has the binding
// and no compiled hooks until its human compiles — which is what the drafted README now says, and what
// the group below asserts.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { InitError, SLUG, slugify, parseArgs, scan, draft, collisions, residenceAt, run } from "./init.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

// ONE exit handler for every scratch directory, not one each — the per-directory form exceeds node's
// default ten-listener limit partway through a suite this size and prints a MaxListenersExceededWarning.
// That reason is not mine: `./doctor.test.mjs` records it, having hit it first, along with the lesson
// that a defect in an exemplar becomes a defect in a family. This file proved the lesson from the other
// side — it was written without the handler at all, and its own docstring said the directories cleaned
// themselves up. **Measured when the note landed: 2375 leaked directories under `os.tmpdir()`.** A
// comment claiming a behaviour the code does not have is this repository's dominant defect class, and
// here it was in a file whose subject is checking claims. Found by review on the pull request.
const SCRATCH = [];
process.on("exit", () => {
    for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true, force: true });
});

/** A throwaway directory, removed when the process exits. Real files, because the demonstration is on real files. */
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

/** Collects what a run said, so a refusal can be asserted on its sentence and not only on its code. */
function harness() {
    const said = [];
    const warned = [];
    return { said, warned, options: { say: (l) => said.push(l), warn: (l) => warned.push(l) } };
}

const ok = (dir) => JSON.parse(fs.readFileSync(path.join(dir, ".portulan", "workspace.json"), "utf8"));

// ---------------------------------------------------------------- the residence question

describe("the residence question is asked, never answered by default", () => {
    // Row 7: "`init` asks where this repository's workspace resides — in the repository, or in a
    // workspace that names it — and writes a full workspace or a pointer accordingly." A default here
    // would be the tool deciding the one thing the row says it asks, and the wrong default is the
    // dual-management shape proposal 0017 exists to refuse.
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
    // `doctor`'s permit-list is `portulan`, `name`, `summary`, `kind`, `governed_by` (cli/doctor.mjs).
    // Anything else is the dual-management refusal. This is the one manifest shape where an extra key
    // is not a cosmetic defect but a red.
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
        // This case used to pass `--pack-root` alongside a pointer and assert the manifest came out
        // clean — which it did, by ignoring the flag. That is the accepted-but-ignored shape this
        // file's header claims not to have: an option a caller believes had an effect it never had.
        // Found by review on the pull request; the assertion moved from "harmless" to "refused".
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
        // `cycle` and `checkpoints` both have defaults, so their VALUES cannot distinguish a caller
        // who typed them from one who did not. Keying the check on the resolved value would make a
        // plain pointer run refuse itself over a choice the tool made.
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

// ---------------------------------------------------------------- #141's shape, made unemittable

describe("nothing init writes can produce the manifest doctor still mishandles", () => {
    // Issue #141: a pointer whose `governed_by.workspace` is present but empty or non-string is
    // refused by the cross-repository check as a CONFLICTING governor — a false red, and a confusing
    // one. `doctor`'s bug is `doctor`'s to fix; `init`'s obligation is that it can never be the tool
    // that produced the input. Refused at the boundary, with the schema's own slug definition.
    // Two refusals, and which one fires is itself the assertion. An EMPTY governor is caught at the
    // command line, where "you gave me nothing to work with" is the clearer sentence; a non-empty
    // governor that is not a slug reaches the schema's own definition. Sending an adopter to the
    // wrong one of those is a small cruelty, so the split is pinned rather than left to whichever
    // check happens to run first.
    for (const [bad, expected] of [
        ["", /empty/i],
        [" ", /empty/i],
        ["Acme Platform", /slug|lowercase/i],
        ["acme_platform", /slug|lowercase/i],
        // `-acme` used to sit here. It cannot reach the slug check from the command line any more —
        // a leading `-` is a missing value now, refused earlier and for a better reason — so it moved
        // to the answers-file case below, where it still reaches the slug branch and the coverage is
        // kept rather than quietly lost to a change in a different check.
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
        // Where `-acme` went when the command line stopped letting it through. The answers file has
        // no flag ambiguity, so the value arrives intact and the slug definition is what refuses it.
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
    // Proposal 0017: a repository is governed by exactly one workspace. Replacing a policy layer is
    // not onboarding — it is the switch, which `cli/vendor.mjs` carries since the maintainer widened
    // `vendor`'s gloss on 2026-08-03. So `init` refuses, says which residence it found, and names the
    // tool whose job the switch is, rather than writing over a team's gates, memory and DoD.
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
        // The dangerous reading of "is there a workspace here?" is that a parse failure means no. A
        // corrupt manifest is the case where overwriting costs the most and where the tool knows the
        // least, so it stops.
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
        // cli/doctor.mjs: "a `repository` workspace must declare `tree`". The constraint is doctor's
        // rather than the schema's — a conditional dependency the declared subset cannot express — so
        // nothing but this test stands between the draft and a red first run.
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
        // Parsing is not the bar, and believing it was cost this session a red demonstration. A
        // policy can parse cleanly and still be refused by a backend — a declared floor that no rule
        // reaches throws, and `doctor` surfaces it as a FAIL. The first draft here gated only
        // `gh pr merge`, which the floor backend cannot express, so a fresh workspace was red on its
        // very first run. Both backends are exercised, because the adopter meets both.
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
        // doctor FAILS a floor requiring a context no workflow job reports. A drafted floor naming
        // checks the adopter has not written yet would red their first run and teach them the tool
        // lies. The floor is drafted; its checks are theirs.
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
        // ../.portulan/memory/verify-preconditions-fail-closed.md: "nothing looked" is never "nothing
        // wrong". The adopter has not told us what green means for their repository, so the honest
        // exit is 2 — could not run — and never 0. A stub exiting 0 here would put a false green under
        // every downstream gate on the day the workspace was created.
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
        // The schema's siting rule: an index inside the series is counted as a member by the checks
        // that walk it. doctor refuses the siting, so a draft that got it wrong is a red first run.
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const manifest = ok(dir);
        assert.equal(manifest.handoffs.index.path.startsWith(manifest.slots.handoffs), false);
    });
});

// ---------------------------------------------------------------- the cycle, and opting out of it

describe("the checkpoint binding is drafted by default and can be deleted", () => {
    test("the pack the workspace names is composed by default", async () => {
        // Row 7 clause (a): out of the box, opt-OUT rather than opt-in. The pack is named BY THE
        // WORKSPACE — core names no pack — so this key is the whole of what clause (a) can bind here.
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        assert.deepEqual(ok(dir).packs, ["rituals/checkpoints"]);
    });

    test("`--no-cycle` leaves the workspace composing nothing, and still valid", async () => {
        // "the human still curates and may delete the binding outright, which is what makes it
        // opt-out" — row 7's own argument. A flag that produced an invalid workspace would make the
        // opt-out theoretical.
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
    // .portulan/dod.md condition 4: a document describing enforcement either has the enforcement or
    // names where it arrives. Two things the draft describes do not exist for an adopter today, and
    // both must say so in the file the adopter reads — not only in this repository's handoff.
    test("the session-end gate names where its runner arrives rather than implying one is wired", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const readme = fs.readFileSync(path.join(dir, ".portulan", "README.md"), "utf8");
        assert.match(readme, /session-end/i);
        // The README must still tell the adopter the gate is not ENFORCING yet — but the reason moved at
        // milestone 7 and so did the honest wording. It used to be that the runner shipped nowhere; now
        // it ships and `compile` wires it, and what is missing is that `init` has not run `compile`. So
        // this asserts the state, not the old cause.
        // Specific, not permissive. The first retarget of this assertion read
        // `/has not run it|until you run it|compile/i` — and that third alternative matches the word
        // `compile` ANYWHERE in the README, which by then appeared in several unrelated sentences. A
        // check that passes on a word rather than on a claim has stopped checking. Caught by review,
        // and it is the change this repository says to scrutinise hardest: I loosened a check while
        // retargeting it, which is how a green quietly starts meaning less.
        assert.match(readme, /session-end gate is wired by `compile`, and this draft has not run it/i);
    });

    test("the interactive interview is named as absent rather than implied", async () => {
        const h = harness();
        await run(["--help"], h.options);
        assert.match(h.said.join("\n"), /--answers/);
        assert.match(h.said.join("\n"), /interview/i);
    });

    test("nothing in the draft tells the adopter to run an unpublished command", async () => {
        // The package is not on the registry (#148 is open on its version), so a drafted file
        // instructing an adopter to run `npx @sleepy-panda-works/portulan …` would be a capability
        // claim that 404s. Whatever the draft says, it may not say that yet.
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
            e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
        for (const file of walk(path.join(dir, ".portulan"))) {
            assert.doesNotMatch(fs.readFileSync(file, "utf8"), /npx @sleepy-panda-works\/portulan/, `${path.basename(file)} promises an unpublished command`);
        }
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
        // The failure this guards is the one an onboarding tool is most likely to commit: emitting a
        // confident `make test` because most repositories have one. doctor lints repo-card build and
        // test claims against the tree, so an invented claim is a red the adopter did not cause — and
        // worse, a workspace that lies about them on the day it was created.
        const dir = scratch({ "notes.txt": "hello" });
        const observed = scan(dir);
        assert.deepEqual(observed.stack, []);
        assert.equal(observed.test, null);
        assert.equal(observed.build, null);
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
        // The flag is repeatable and accumulates into an array; an answers file may reasonably give
        // one string, and the value check accepts it as a string like every other key. Everything
        // downstream is array-shaped, so the string reached `packResolves` and died on `.some` —
        // turning a valid answers file into `could not run — roots.some is not a function`, a real
        // answer refused with a message about somebody else's bug. Found by review on the pull
        // request; this case reds against the un-normalised code.
        const dir = scratch();
        const answers = path.join(dir, "answers.json");
        fs.writeFileSync(answers, JSON.stringify({ residence: "in-repo", "pack-root": path.join(REPO, "packs") }));
        const h = harness();
        assert.equal(await run(["--answers", answers, dir], h.options), 0, h.warned.join("\n"));
        assert.deepEqual(ok(dir).packs, ["rituals/checkpoints"]);
    });

    test("an array `pack-root` still works, and an unresolvable one is still refused", async () => {
        // The other side of the normalisation: it must not turn the refusal into a pass.
        const dir = scratch();
        const answers = path.join(dir, "answers.json");
        fs.writeFileSync(answers, JSON.stringify({ residence: "in-repo", "pack-root": [os.tmpdir()] }));
        const h = harness();
        assert.equal(await run(["--answers", answers, dir], h.options), 2);
        assert.match(h.warned.join("\n"), /does not resolve/);
    });

    test("an unknown key in the answers file is refused rather than silently dropped", async () => {
        // The common case is a typo. A silently-ignored `residnce` leaves the tool asking for an
        // answer the adopter believes they gave — the same reasoning as the schema's
        // `additionalProperties: false`.
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
        // `--residence -h <dir>` consumed `-h` as the residence and then complained that `-h` is not
        // one — blaming the user for a token they typed as a flag, and eating the likeliest thing to
        // land there, which is a help request. `cli/doctor.mjs` already guarded on `-`; this file was
        // the outlier among its siblings. Found by review on the pull request.
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
        // The escape hatch the refusal points at has to exist, or the rule above is a wall.
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
    // The split is what makes every assertion above cheap and what keeps the refusals ahead of the
    // first byte on disk. A tool that decides while writing has no state in which it can still
    // refuse.
    test("draft returns a file set and touches nothing", () => {
        const dir = scratch();
        const files = draft({ residence: "in-repo", name: "acme", cycle: true, checkpoints: "rituals/checkpoints" }, scan(dir));
        assert.ok(files.has(".portulan/workspace.json"));
        assert.equal(fs.existsSync(path.join(dir, ".portulan")), false);
    });

    test("every path in the file set stays inside the target's .portulan/", () => {
        const files = draft({ residence: "in-repo", name: "acme", cycle: true, checkpoints: "rituals/checkpoints" }, scan(scratch()));
        for (const rel of files.keys()) {
            assert.equal(rel.startsWith(".portulan/"), true, `${rel} escapes the workspace directory`);
            assert.equal(rel.includes(".."), false, `${rel} climbs out of the target`);
        }
    });
});

// ---------------------------------------------------------------- what the pre-commit pass found

describe("nothing init writes over, and nothing it half-writes", () => {
    // Every case here was DEMONSTRATED against the first cut of this tool by the pre-commit
    // checkpoint. They are grouped because they share one root: the residence check answers "is this
    // repository governed?", and the tool was treating that as an answer to "is it safe to write
    // here?" — a different question with a different key.
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
        // Written first, a half-completed run leaves a `workspace.json` that the residence check then
        // reads as a governed repository — and the retry is refused with a sentence that is false.
        // The order is asserted rather than trusted, because it is invisible at every other altitude.
        const files = draft({ residence: "in-repo", name: "acme", cycle: true, checkpoints: "rituals/checkpoints" }, scan(scratch()));
        // `await`ed, and the await is the assertion's foundation rather than a formality. `run` is
        // async; it happens to reach the write loop with nothing suspended today, so an un-awaited
        // call observed the right order by accident. The moment `run` gains an `await` before
        // writing, the `finally` below would restore `fs.writeFileSync` first and this test would
        // observe an EMPTY list and pass — a regression guard that stops guarding exactly when the
        // code it guards changes shape. Found by review on the pull request.
        // `t.mock.method` rather than a hand-rolled patch-and-restore, so the substitution is SCOPED
        // to this test and restored by the runner even if an assertion throws first. The hand-rolled
        // form reassigned `fs.writeFileSync` globally: correct today, because tests within a file run
        // sequentially, but it makes this suite's correctness depend on a scheduling property no
        // assertion here states. Found by review on the pull request.
        const dir = scratch();
        const written = [];
        const real = fs.writeFileSync;
        t.mock.method(fs, "writeFileSync", (file, ...rest) => {
            written.push(String(file));
            return real(file, ...rest);
        });
        await run(["--residence", "in-repo", dir], harness().options);
        fs.writeFileSync.mock.restore();
        assert.equal(written.length, files.size, "every drafted file must have been observed — an empty list would pass the order check vacuously");
        const manifestAt = written.findIndex((f) => f.endsWith("workspace.json"));
        assert.equal(manifestAt, files.size - 1, "workspace.json must be the last file written, not the first");
    });

    test("a `.portulan` symlink cannot carry the draft out of the repository", async () => {
        // Demonstrated on the pull request against the first version of this check, which used
        // `existsSync`/`statSync` — both follow symlinks. `init` wrote NINE files into a directory
        // outside the repository and reported success. The tool that writes needs the containment
        // rule at least as much as the tools that read, and `doctor`/`plugin-lint` already have it.
        const dir = scratch();
        const outside = scratch();
        fs.symlinkSync(outside, path.join(dir, ".portulan"));
        const h = harness();
        assert.equal(await run(["--residence", "in-repo", dir], h.options), 2);
        assert.match(h.warned.join("\n"), /symlink/);
        assert.deepEqual(fs.readdirSync(outside), [], "not one byte may be written through the link");
    });

    test("a symlink NESTED inside .portulan is refused too, not just the root one", async () => {
        // The sibling of the case above: refusing only `.portulan` would leave `.portulan/verify`
        // as an unguarded route to exactly the same escape.
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
        // The other half of the escape above, and it was reachable while only the write side was
        // fixed: `residenceAt` ran first and followed the link, so `init` read a manifest OUTSIDE
        // the repository and announced "this repository already carries a `repository` workspace",
        // naming a workspace that is not in this repository at all. An out-of-repo read AND a
        // refusal that misdescribed what it found. Found by review on the pull request.
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
        // Only ENOENT means "nothing here". Every other error — EACCES above all — means the
        // question could not be answered, and answering "no residence" to an unanswerable question
        // is the fail-open this repository names most: "nothing looked" reported as "nothing wrong".
        // Found by review on the pull request, in both walkers at once.
        const dir = scratch();
        fs.mkdirSync(path.join(dir, ".portulan"));
        fs.chmodSync(path.join(dir, ".portulan"), 0o000);
        try {
            const seen = residenceAt(dir);
            // A root-run container can still stat through mode 0, in which case there is nothing to
            // assert — say so rather than pretending the case was exercised.
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
        // `existsSync` returns FALSE for a dangling link, so the old check would have walked straight
        // past this one and created the file at the link's target. `lstatSync` sees the link itself.
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
    // `--summary ""` passed straight through `??` into the manifest, where the schema's
    // `minLength: 1` made `doctor` RED on a workspace init had just reported writing successfully.
    // Demonstrated at the pre-commit checkpoint, in both residences.
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
        // Lecturing about a misspelt key while accepting `"cycle": "false"` checks the half that is
        // easy and lets the half that changes behaviour through: a non-empty string is truthy, so
        // the answer would compose the pack the adopter was switching off.
        const dir = scratch();
        const answers = path.join(dir, "answers.json");
        fs.writeFileSync(answers, JSON.stringify({ residence: "in-repo", cycle: "false" }));
        const h = harness();
        assert.equal(await run(["--answers", answers, dir], h.options), 2);
        assert.match(h.warned.join("\n"), /cycle/);
    });

    test("importing this module runs nothing and throws nothing", async () => {
        // `process.argv[1]` is absent when a module is imported by something that is not a script,
        // and `pathToFileURL(undefined)` throws at load — which this file's own header promises it
        // will not do. Every sibling tool carries the guard; this one did not.
        const { execFileSync } = await import("node:child_process");
        const out = execFileSync(process.execPath, ["-e", "import('./cli/init.mjs').then(() => console.log('ok'))"], {
            cwd: REPO,
            encoding: "utf8",
        });
        assert.match(out, /ok/);
    });
});

describe("init emits no hook, which is why its silence about the gate is honest", () => {
    // The interim rule the reviewing session asked for, as a regression guard rather than a repair:
    // **`init` never emits a hook whose target it cannot prove exists.** Today it satisfies that in
    // the strongest available way — it emits no hook at all — and the distinction matters, because a
    // hook whose target is missing **fails open** (measured, CLI 2.1.220). An absent gate that says
    // it is absent is honest; a present gate that silently passes everything is the worst outcome in
    // this whole design, and it is one `compile` run away from here.
    test("nothing init writes is a hook, a settings file, or a reference to a runner", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
            e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
        const written = walk(path.join(dir, ".portulan"));
        assert.equal(fs.existsSync(path.join(dir, ".claude")), false, "init writes no host settings — compiling is a separate, deliberate act");
        for (const file of written) {
            const text = fs.readFileSync(file, "utf8");
            assert.doesNotMatch(text, /"hooks"\s*:/, `${path.basename(file)} emits a hook`);
            // The runner MAY be named now — it ships in the package as of milestone 7, so naming it is
            // a true statement rather than a dangling reference. What must still be absent is an emitted
            // hook: `init` binds the ritual and does not compile, because compiling writes host settings
            // and a scaffold must not do that to somebody's machine unasked. The old spelling of this
            // assertion forbade the NAME, which was right only while the runner shipped nowhere.
            assert.doesNotMatch(text, /compile\/stop\.mjs|compile\/gate\.mjs/, `${path.basename(file)} names a runner at its pre-milestone-7 path`);
        }
    });

    test("if a hook is ever emitted, its target must be proven to exist at draft time", () => {
        // Stated as an executable expectation rather than a comment, so the rule outlives the session
        // that agreed to it. `draft` returns the whole file set, so any future hook emission is
        // visible here — and this assertion is what will fail when someone adds one.
        const files = draft({ residence: "in-repo", name: "acme", cycle: true, checkpoints: "rituals/checkpoints" }, scan(scratch()));
        for (const [rel, file] of files) {
            const targets = [...file.contents.matchAll(/\$\{CLAUDE_PROJECT_DIR\}\/([^"'\s]+)/g)].map((m) => m[1]);
            assert.deepEqual(targets, [], `${rel} names host-resolved path(s) ${targets.join(", ")} that init cannot prove exist`);
        }
    });
});

describe("every refusal names what the human can do next", () => {
    // A refusal that explains itself and stops has told the adopter they are stuck. Two of the four
    // did exactly that — the existing-residence one ended at "That subcommand is not built yet", and
    // the corrupt-manifest one merely justified itself. Caught by the reviewing session's rider.
    const refusalFor = async (seed, argv) => {
        const dir = scratch(seed);
        const h = harness();
        assert.equal(await run([...argv, dir], h.options), 2);
        return h.warned.join("\n");
    };

    test("an existing residence names the tool that changes residence, and why the order matters", async () => {
        // This asserted "run `doctor`" and "move the existing `.portulan/` aside", which was the best
        // advice available while the switch had no subcommand: a human doing it by hand needed to be
        // told the safe order. `cli/vendor.mjs` holds that order now, so the refusal points at the tool
        // rather than teaching the manual procedure — a refusal that sends a reader to a worse route
        // than the one that exists is a refusal that has gone stale.
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
    // dod.md condition 4, applied to the files an adopter receives rather than to this repository's
    // own. The pre-commit pass found `verify/README.md` claiming a Stop-gate and CI that a drafted
    // workspace has neither of, contradicting the README beside it.
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
        // The adopter's very next command is `doctor`. Saying "validation takes a location as an
        // argument" understates what happens when they do not give one.
        assert.match(await emitted("README.md"), /RED/);
    });

    test("the generated index is described in the future tense, because it does not exist yet", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const manifest = ok(dir);
        assert.equal(fs.existsSync(path.join(dir, ".portulan", manifest.handoffs.index.path)), false);
        assert.match(fs.readFileSync(path.join(dir, ".portulan", "README.md"), "utf8"), /does not exist yet/i);
    });

    test("the run itself says the pack is unresolved, not only the file it wrote", async () => {
        const dir = scratch();
        const h = harness();
        await run(["--residence", "in-repo", dir], h.options);
        assert.match(h.said.join("\n"), /RED until you name where it lives/);
        assert.match(h.said.join("\n"), /--pack-root/);
    });
});

// ---------------------------------------------------------------- the demonstration

describe("doctor is green on what init emits — the bar this session must clear", () => {
    // This is the group that matters. Everything above asserts what the draft CONTAINS; these two run
    // the real validator against real directories, which is the difference between a claim and a
    // demonstration (../core/operating/verification.md: compiles < tests pass < behaviour exercised).
    //
    // The in-repo run needs `--pack-root`: with `tree` declared, doctor derives `<tree>/packs` and a
    // fresh repository has no such directory, so a bound pack cannot resolve. Named rather than
    // discovered, exactly as milestone 6 established and issue #123 still records.
    // `CLAUDE_CONFIG_DIR` points at an EMPTY directory, and it is load-bearing for the pointer case
    // below rather than tidiness. Since milestone 7 `doctor` dereferences a `kind: pointer` manifest's
    // `governed_by` against the host's installed-plugin record (cli/discover.mjs), so an un-injected
    // run reads whatever the developer happens to have installed — and the drafted pointer names a
    // workspace by an arbitrary string. A fresh directory has no record, which is the state every
    // machine without an install is in, and is the one this suite should be grading against.
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
