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

// A HERMETIC HOST. The tools consult the host's installed-plugin record on the UNASKED path as of
// 2026-08-13, so a suite that does not neutralise it reads the machine it runs on and a fixture's
// verdict moves with what somebody has installed. Swept by `pinned-roots.live.test.mjs`, whose header
// carries the argument and the limit. A case that wants a host passes `env:` explicitly, which wins.
process.env.CLAUDE_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));

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

describe("nothing init writes can produce the manifest doctor once mishandled", () => {
    // Issue #141: a pointer whose `governed_by.workspace` is present but empty or non-string is
    // WAS refused by the cross-repository check as a CONFLICTING governor — a false red, and a
    // confusing one. **Fixed in `doctor` on 2026-08-09**, which is why this block's name is past tense
    // now; these assertions are unchanged and still worth their place, because `init`'s obligation was
    // never that `doctor` be correct — it is that `init` can never be the tool that produced the input. Refused at the boundary, with the schema's own slug definition.
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

    test("the help says WHEN the interview runs, and when nothing is asked", async () => {
        // This test read "the interactive interview is named as absent rather than implied" and
        // asserted `/interview/i` against the help. When the interview shipped at milestone 7 session
        // 7 the help began saying the opposite and **the assertion still passed**, on the word
        // `--no-interview`. A check that passes on a word rather than on a claim has stopped checking
        // — the sibling of the defect the test directly above this one records, in the same file, and
        // it survived the change that made it wrong. Re-pointed at the two claims that matter.
        const h = harness();
        await run(["--help"], h.options);
        const help = h.said.join("\n");
        assert.match(help, /--answers/);
        assert.match(help, /At a terminal, anything you have not answered is asked/);
        assert.match(help, /not a TTY nothing is asked/);
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
        // is the fail-open: "nothing looked" reported as "nothing wrong".
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

    // This test read "the generated index is described in the future tense, because it does not exist
    // yet" until milestone 7 session 7, and it was the rail on a drafted README that told every adopter
    // the index "does not exist yet … this draft does not run it". The sentence went false the moment
    // the draft started writing it — in somebody else's tree, which `init`'s own header calls the worst
    // shape available. The test is turned around rather than deleted: the same pair, pinned the other
    // way, so the README cannot drift back into describing a state the draft no longer has.
    test("the generated index exists, and the README describes what was written rather than what is owed", async () => {
        const dir = scratch();
        await run(["--residence", "in-repo", dir], harness().options);
        const manifest = ok(dir);
        assert.equal(fs.existsSync(path.join(dir, ".portulan", manifest.handoffs.index.path)), true);
        const readme = fs.readFileSync(path.join(dir, ".portulan", "README.md"), "utf8");
        assert.doesNotMatch(readme, /index[\s\S]{0,80}does not exist yet/i, "a draft must not tell its adopter a file it just wrote is missing");
        assert.match(readme, /freshness rail/i);
        assert.match(readme, /exits\s+\*\*2/i, "the rail's honest first state on an adopter's CI belongs in the artifact that ships it");
    });

    test("on a host where nothing resolves it, the run says so and offers a root to name", async () => {
        // **Re-derived, and the change is which advice is honest.** This asserted `--pack-root auto` was
        // offered, on the ground that it "is the answer that needs no path". Since the disposal `auto` is
        // no longer an answer this branch can offer: the unasked run has ALREADY consulted discovery and
        // it found nothing, so printing `auto` would advise typing a flag whose answer the tool just
        // read — the same defect this branch was fixed for once, in the other direction. Naming a
        // directory is the only advice left that can change the outcome.
        //
        // `harness()` gives no host, and the module-scope hermetic guard means the ambient one is empty
        // too, so this is CI's arrangement.
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
        // The disposal at `init`. Two things are asserted and the second is the one with teeth: the run
        // prints `doctor <ws>` with no flag, and it warns that the root it used is the MACHINE's — an
        // adopter whose CI has nothing installed derives `<repo>/packs` alone and needs a pin there.
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
        // **Two properties the mutation harness proved nothing was binding.**
        //
        // 1. The unasked degrade keeps `<target>/packs` rather than emptying the set. `expandRoots`
        //    returned `roots: []` for a could-not-look on both arms; unasked, that discards a root it
        //    already had — the same *"a fallback that empties the set is worse than no fallback"* shape
        //    the previous session measured one function over.
        // 2. The advice names the residence that ACTUALLY answered. It said *"it resolved from this
        //    host's plugin cache"* for every unasked resolution, including this one, where the cache is
        //    unreadable and the pack came out of the repository. Found by writing this test, not by
        //    reading the branch.
        const config = scratch();
        const record = path.join(config, "plugins", "installed_plugins.json");
        fs.mkdirSync(path.dirname(record), { recursive: true });
        fs.writeFileSync(record, "{ not json");

        // The adopter already has the pack in their own tree — which is why an unreadable host record
        // must not be allowed to decide anything here.
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
        // And the CI warning is withheld: a pack in the tree travels with the tree.
        assert.doesNotMatch(said, /that root is this machine's/);
    });

    test("the DRAFT is byte-identical on a host that carries the pack and one that does not", async () => {
        // **`docs/vision.md`'s *no auto-generated curated context*, at the one tool that could break it.**
        // Discovery reaches the advice and the resolvability answer; it must never reach `draft()`. Hashed
        // over every drafted file rather than spot-checked, because the failure this guards against is a
        // single interpolated path in a single README.
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

        // The workspace NAME is derived from the directory, so both runs use the same one — otherwise
        // this would compare two drafts that legitimately differ and pass for the wrong reason.
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
        // The other half of the same sentence, and the one that was wrong. `init` verifies the pack
        // resolves before it drafts, so telling the adopter afterwards that "nothing resolves a pack
        // for you" contradicted a check this tool had already run. Found by running `init` against a
        // real never-seen repository, not by reading it.
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

// ---------------------------------------------------------------- the interview

// `docs/vision.md` glosses `init` as *interview + codebase scan → drafted workspace, human curates*.
// The scan shipped at session 1 and the substrate with it; this is the prompt loop, and every test
// here runs it with **no TTY in sight** — which is the property that made the substrate worth building
// first. The reader is injected, so the loop is as testable as the flags path it shares its validators
// with.
describe("the interview asks, and only where somebody is there to answer", () => {
    /** A reader with a queue of answers. Records the prompts, so an assertion can be about what was ASKED. */
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
        const s = scripted(["in-repo", "", "", "none", "y"]);
        const code = await run([dir], { ...harness().options, io: s.io });
        assert.equal(code, 0, "an interviewed run that confirms must write");
        assert.match(s.asked.join("\n"), /residence/, "the one question init may not answer must be asked");
        assert.equal(ok(dir).kind, "repository");
    });

    test("nothing is asked where stdin or stdout is not a TTY — the refusal is the old one, unchanged", async () => {
        const dir = scratch();
        const s = scripted(["in-repo", "", "", "none", "y"], { interactive: false });
        const h = harness();
        const code = await run([dir], { ...h.options, io: s.io });
        assert.equal(code, 2, "a non-interactive run must refuse exactly as it did before the interview existed");
        assert.equal(s.asked.length, 0, "a headless host must never be prompted: the run would hang");
        assert.match(h.warned.join("\n"), /--residence/);
        assert.equal(fs.existsSync(path.join(dir, ".portulan")), false);
    });

    test("`--no-interview` forces the non-interactive path at a terminal", async () => {
        const dir = scratch();
        const s = scripted(["in-repo", "", "", "none", "y"]);
        const h = harness();
        assert.equal(await run(["--no-interview", dir], { ...h.options, io: s.io }), 2);
        assert.equal(s.asked.length, 0);
        assert.match(h.warned.join("\n"), /--residence/);
    });

    test("what the flags already answered is never asked again", async () => {
        const dir = scratch();
        const s = scripted(["none", "y"]);
        assert.equal(await run(["--residence", "in-repo", "--name", "acme", "--summary", "one line", dir], { ...harness().options, io: s.io }), 0);
        const questions = s.asked.join("\n");
        assert.doesNotMatch(questions, /residence/, "being asked to confirm a flag you just typed reads as not having listened");
        assert.doesNotMatch(questions, /workspace name/);
        assert.doesNotMatch(questions, /summary/);
        assert.equal(ok(dir).name, "acme");
    });

    test("a question offers the derived default where one exists, and an empty line accepts it", async () => {
        const dir = scratch();
        const s = scripted(["in-repo", "", "", "none", "y"]);
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
        const s = scripted(["in-repo", "", "", "none", "y"]);
        assert.equal(await run([dir], { ...harness().options, io: s.io }), 0);
        assert.doesNotMatch(s.asked.join("\n"), /governing|feed/, "a workspace that lives here has no governor and no feed");
    });

    test("an answer the schema refuses is re-asked with the reason, and does not abort the run", async () => {
        const dir = scratch();
        const s = scripted(["feed-side", "in-repo", "Not A Slug", "acme", "", "none", "y"]);
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
        const s = scripted(["in-repo", "", "", "none", "n"]);
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
        const s = scripted(["in-repo", "acme", "one line", "none", "y"]);
        assert.equal(await run([dir], { ...harness().options, io: s.io }), 0);
        const echoed = s.said.join("\n");
        assert.match(echoed, /about to draft/);
        assert.match(echoed, /acme/);
        assert.match(echoed, /one line/);
    });

    test("an already-governed repository is refused before the questions, not after them", async () => {
        // Answering five questions and then being told the repository already has a workspace is the
        // shape of a tool that asks before it looks.
        const dir = scratch({ ".portulan/workspace.json": JSON.stringify({ portulan: { spec: "2.7" }, name: "already", kind: "repository" }) });
        const s = scripted(["in-repo", "", "", "none", "y"]);
        const h = harness();
        assert.equal(await run([dir], { ...h.options, io: s.io }), 2);
        assert.equal(s.asked.length, 0, "the machine's question comes first");
        assert.match(h.warned.join("\n"), /already carries/);
    });

    test("`none` at the checkpoints prompt composes no packs", async () => {
        const dir = scratch();
        const s = scripted(["in-repo", "", "", "none", "y"]);
        assert.equal(await run([dir], { ...harness().options, io: s.io }), 0);
        assert.equal(ok(dir).packs, undefined, "opting out at the prompt must be the same answer as --no-cycle");
    });
});

// ---------------------------------------------------------------- the records rail

// Row 7 clause (a)'s third records convention: "the handoff-index freshness rail where the workspace
// declares an index". The directory and the manifest's declaration landed at session 4; a generated
// index nothing compares is current until the first person forgets, which is the reminder this project
// trades for a rail wherever it can.
describe("the drafted workspace carries the rail that holds its index current", () => {
    const railOf = (dir) => path.join(dir, ".portulan", "verify", "index.sh");
    const runRail = (dir, env = {}) => {
        try {
            return { code: 0, out: execFileSync("bash", [railOf(dir)], { cwd: dir, encoding: "utf8", stdio: "pipe", env: { ...process.env, ...env } }) };
        } catch (error) {
            return { code: error.status, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
        }
    };

    test("the index is written by the draft, so day one is green rather than red about a missing file", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        assert.equal(fs.existsSync(path.join(dir, ".portulan", "handoffs-index.md")), true);
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

    test("an index edited by hand is RED, and regenerating returns it to green", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        const index = path.join(dir, ".portulan", "handoffs-index.md");
        fs.appendFileSync(index, "\n- 2026-08-11 · [a handoff nobody wrote](handoffs/x.md)\n");
        assert.equal(runRail(dir).code, 1, "a hand-edited generated file must be a verdict, not a note");
        execFileSync(process.execPath, [path.join(REPO, "cli", "index.mjs"), path.join(dir, ".portulan")], { stdio: "pipe" });
        assert.equal(runRail(dir).code, 0, "regenerating must repair it");
    });

    test("a handoff added without regenerating is RED — the rail is about the pair, not the file", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        fs.writeFileSync(path.join(dir, ".portulan", "handoffs", "2026-08-11-a-session.md"), "# Handoff — a session\n");
        assert.equal(runRail(dir).code, 1);
    });

    test("no reachable CLI is could-not-run, naming all three locations — never a pass", async () => {
        const dir = scratch();
        assert.equal(await run(["--residence", "in-repo", "--no-cycle", dir], harness().options), 0);
        // The drafted fallback is the bundle this ran from, which exists here — so the third location
        // is removed rather than mocked, which is the only way to reach the branch honestly.
        const rail = railOf(dir);
        fs.writeFileSync(rail, fs.readFileSync(rail, "utf8").replace(/elif \[ -f "[^"]*" \]/, 'elif [ -f "/nonexistent/cli/index.mjs" ]'));
        const result = runRail(dir, { PORTULAN_CLI: "", PATH: "/usr/bin:/bin" });
        assert.equal(result.code, 2, "a rail that cannot find its tool must never exit 0");
        assert.match(result.out, /NOT checked/);
        assert.match(result.out, /PORTULAN_CLI/);
    });

    test("an absent `node` is 2 as well, and not the shell's 127", async () => {
        // A recipe's contract is the three codes, and it owes them even when what is missing is the
        // interpreter that would have run it: unchecked, `node …` dies 127, which reads downstream as
        // a recipe that ran and rendered a verdict.
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

// Added on Copilot's round 1 of #227, one branch over from where `need_node` already guarded. The
// round named 127; a bad interpreter is **126** here, so the fix as suggested would have missed the
// very case that prompted it — measured while writing this test rather than reasoned about.
describe("the drafted rail maps an exec failure from the tool itself to could-not-run", () => {
    test("an entry point whose interpreter is missing is 2, not a verdict about the index", async () => {
        // `command -v portulan` finds an executable; a Node-based entry point whose interpreter is
        // gone dies 127 on exec. Unmapped, that reads downstream as this recipe having RUN.
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

// The marker is the whole of what makes the baked path findable by a rewriter, so it is asserted
// rather than trusted — and asserted at BOTH ends: the drafted file carries it, and the two sites
// that will one day have to re-derive it cite it by the same token. Dropping the marker while
// keeping the path is the silent half of this defect: `vendor` copies these files byte for byte,
// and a stale absolute path exits 2, which is fail-closed and therefore easy to never notice.
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
        // And nothing else in the drafted workspace may carry the path unmarked — the marker is only
        // a rail if it covers every site.
        for (const rel of ["verify/README.md", "README.md", "workspace.json"]) {
            const text = fs.readFileSync(path.join(dir, ".portulan", rel), "utf8");
            assert.equal(text.includes(REPO), false, `${rel} carries the drafting machine's absolute path with no marker`);
        }
    });

    test("the marker's carriers cite it — the one that re-derives, and the one that copies it stale", () => {
        // A note in the writer is read by whoever edits the writer. These are read by whoever moves
        // or migrates a workspace, which is when the path stops being true.
        //
        // **The set moved at milestone 7 session 9 and is not the same two.** It was `vendor.mjs`
        // and `portulan.mjs`, the latter because the `upgrade` entry carried a note for whoever
        // would one day build the re-deriver. That re-deriver now exists, so the note belongs where
        // the work is: `spec/migrations/0002-bundle-fallback-path.mjs` OWNS the re-derivation, and
        // `cli/vendor.mjs` still copies these files byte for byte and must point at the remedy.
        // Leaving `portulan.mjs` in this list would have held a shipped tool to a note written for
        // its absence.
        for (const rel of ["cli/vendor.mjs", "spec/migrations/0002-bundle-fallback-path.mjs"]) {
            const source = fs.readFileSync(path.join(REPO, rel), "utf8");
            assert.match(source, /portulan:bundle-fallback/, `${rel} must name the marker it re-derives or copies`);
        }
    });
});

test("init refuses a named root combined with `--pack-root auto`", async () => {
    const h = harness();
    const dir = scratch();
    assert.equal(await run(["--residence", "in-repo", "--pack-root", "auto", "--pack-root", dir, dir], h.options), 2);
    assert.match([...h.said, ...h.warned].join("\n"), /never both/);
});

test("init refuses the pair even with `--no-cycle`, where nothing resolves a pack", async () => {
    // Copilot, round 3 on #233: the refusal lived inside the branch that resolves a checkpoints pack,
    // so `--no-cycle` skipped it and one of the two flags was silently ignored — in the fifth of the
    // five tools whose refusal this change claims. It is validated on every path now.
    const h = harness();
    const dir = scratch();
    assert.equal(await run(["--residence", "in-repo", "--no-cycle", "--pack-root", "auto", "--pack-root", dir, dir], h.options), 2);
    assert.match([...h.said, ...h.warned].join("\n"), /never both/);
    assert.equal(fs.existsSync(path.join(dir, ".portulan")), false, "a refused command line writes nothing");
});

test("init on a fresh host: absent record is a verdict, unreadable is could-not-run", async () => {
    // Adjustment 8 of the pre-commit pass: `init` is the sixth consumer of this split and the records
    // did not mention it. On a host with NO record, `--pack-root auto` with the cycle now says the
    // pack does not resolve — a verdict — rather than the older "unknown rather than no". On a host
    // whose record will not parse, it is could-not-run. Both exit 2 here because `init` refuses to
    // draft either way; the DISCRIMINATOR is which sentence the adopter is given, since one sends
    // them to install a pack and the other to look at their host.
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
    // `Discovery could not look` and nothing broader. The first draft matched
    // `/could not read|unknown rather than no/`, which any other `init` failure could satisfy — the
    // SAME defect this session had just fixed in `index` and `skills-set` and written up as a lesson,
    // committed again two files away. Copilot, round 3 on #236. Measured: `init` forwards the
    // discovery diagnostic verbatim, so this phrase is present and is unique to it.
    assert.match([...h2.said, ...h2.warned].join("\n"), /Discovery could not look/, "an unreadable host is a fact about the host");
});
