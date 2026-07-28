// The agent identity's wrapper refuses the endpoints it is not for.
//
// ## Why this suite lives under `cli/` when its subject does not
//
// `../.portulan/tools/gh-bot` is customer-zero operator tooling and says so in its own README —
// "Nothing here is part of the Portulan product; it is how customer zero is run." This file is in
// `cli/` anyway, because `../.portulan/verify/tests.sh` runs exactly `cli/**/*.test.mjs`, and that
// recipe's stated design is that "a new suite joins this recipe by existing rather than by being
// named here". The alternatives were both worse: widening the recipe to a second tree for one
// script, or leaving the guard unchecked. `compile.test.mjs` already ends in a "customer zero"
// section asserting against `.portulan/` and `.github/` from here, so the seam is one this
// repository has already crossed deliberately. Named rather than left for a reader to notice.
//
// ## What makes this testable offline, and why that is the design rather than a convenience
//
// The endpoint guard runs BEFORE the token is minted. So a refused call never mints a credential —
// asserted below, because "refused" and "refused after minting an installation token" are different
// security properties — and the refusal path needs no key, no network, and no App. What the suite
// therefore cannot cover is the admitted path end to end; it asserts only that an admitted endpoint
// reaches the token minter, which is the last thing observable without credentials. Stated instead
// of glossed: this suite proves the guard's SHAPE, and `.portulan/tools/README.md` carries the live
// measurement of what the token can actually reach.
//
// `gh` is stubbed onto PATH so the wrapper's own dependency check passes on a machine without it —
// otherwise this suite would pass by never reaching the code it is about, on exactly the CI runner
// where nobody would look.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test, before, after } from "node:test";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRAPPER = path.join(REPO, ".portulan", "tools", "gh-bot");

/** The guard's sentence, and the token minter's. Which one appears says which layer answered. */
const REFUSED = /PULL REQUEST CONVERSATION/;
const REACHED_THE_TOKEN = /PORTULAN_BOT_APP_ID is not set/;

let stub;

before(() => {
    stub = fs.mkdtempSync(path.join(os.tmpdir(), "gh-bot-stub-"));
    // Exits non-zero: nothing here should reach it, and a stub that succeeds would let a guard
    // failure look like a passing call rather than a red.
    fs.writeFileSync(path.join(stub, "gh"), "#!/bin/sh\nexit 97\n", { mode: 0o755 });
});

after(() => fs.rmSync(stub, { recursive: true, force: true }));

/** Run the wrapper with no credentials and a stubbed `gh`. Returns `{ status, stderr }`. */
function run(...args) {
    const env = { ...process.env, PATH: `${stub}${path.delimiter}${process.env.PATH}` };
    delete env.PORTULAN_BOT_APP_ID;
    delete env.PORTULAN_BOT_PRIVATE_KEY;
    try {
        execFileSync("bash", [WRAPPER, ...args], { env, encoding: "utf8", stdio: "pipe" });
        return { status: 0, stderr: "" };
    } catch (error) {
        return { status: error.status, stderr: `${error.stderr ?? ""}` };
    }
}

describe("gh-bot — the endpoint allowlist", () => {
    // The reported bypass, in the two spellings that matter. The PATCH is the settings change the
    // removed `gh api` gate existed to stop, and the GET is the one that actually SUCCEEDED before
    // this guard existed — a ruleset read rides on the App's `metadata` permission, measured
    // 2026-07-28. Both are refused here for the same reason, which is the point: the guard gates the
    // endpoint, not the verb, so it does not depend on reading a method flag correctly.
    //
    // The GET is refused even though plain `gh api` may now perform it unattended. That is not drift:
    // this wrapper bounds a token the repository mints, and narrower than the policy is the safe
    // direction for it. See ../.portulan/gate-map.md, hole 6.
    for (const args of [
        ["api", "repos/o/r/rulesets"],
        ["api", "-X", "PATCH", "repos/o/r/rulesets/1"],
        ["api", "--method", "PATCH", "repos/o/r/rulesets/1"],
        ["api", "/repos/o/r/rulesets"],
        ["api", "repos/o/r/branches/main/protection"],
        ["api", "repos/o/r/collaborators"],
        ["api", "repos/o/r/actions/permissions"],
        // A merge is `merge-a-pull-request`, Gated, and lives under `pulls/` — so it is the case
        // that proves the allowlist is not simply "anything under pulls".
        ["api", "repos/o/r/pulls/1/merge"],
        // Not a GitHub route at all — measured 404 on 2026-07-28. It was ADMITTED until then, which
        // is the quieter half of the same defect: an allowlist entry for a surface that does not
        // exist reads as a considered decision and cannot be reviewed as one.
        ["api", "repos/o/r/pulls/reviews/123"],
    ]) {
        test(`refuses \`${args.join(" ")}\``, () => {
            const { status, stderr } = run(...args);
            assert.equal(status, 2, "a refusal is exit 2 — the same contract as the verify recipes");
            assert.match(stderr, REFUSED);
            assert.doesNotMatch(stderr, REACHED_THE_TOKEN, "a refused call must not mint a credential first");
        });
    }

    // The conversation the identity exists for. If any of these regress to a refusal, an agent hits
    // a dead end and reaches for plain `gh` — posting as the maintainer, which is the exact failure
    // the whole gh-bot mechanism exists to prevent. That makes these the load-bearing half of this
    // suite, not the happy path.
    for (const args of [
        ["api", "repos/o/r/issues/8/comments"],
        ["api", "repos/o/r/issues/comments/5102913529"],
        ["api", "-X", "DELETE", "repos/o/r/issues/comments/5102913529"],
        ["api", "repos/o/r/pulls/42/comments"],
        ["api", "repos/o/r/pulls/42/comments/123/replies"],
        ["api", "repos/o/r/pulls/42/reviews"],
        // A review BY ID and that review's comments. Both were refused until 2026-07-28 while
        // `pulls/reviews/<id>` — which GitHub answers 404 for — was admitted. Measured both ways
        // against the live API before the pattern was changed: `…/pulls/61/reviews/4796335478`
        // answers 200, `…/pulls/reviews/4796335478` answers `Not Found`.
        ["api", "repos/o/r/pulls/42/reviews/123"],
        ["api", "repos/o/r/pulls/42/reviews/123/comments"],
        ["api", "repos/o/r/pulls/comments/123"],
        ["api", "graphql"],
        ["api", "/installation/repositories"],
    ]) {
        test(`admits \`${args.join(" ")}\``, () => {
            const { stderr } = run(...args);
            assert.doesNotMatch(stderr, REFUSED);
            assert.match(stderr, REACHED_THE_TOKEN, "an admitted endpoint reaches the token minter");
        });
    }

    test("a body containing a path does not shift the scan onto it", () => {
        // `-f body=…` consumes the next argument. Without that, the scan would walk past the real
        // endpoint's flag and read the body as the endpoint — which fails in BOTH directions: a
        // body mentioning a settings path would refuse a legitimate comment, and a body mentioning
        // an issue path would admit a settings call. Two flags, so a single-flag fix does not pass.
        const { stderr } = run("api", "-f", "body=see repos/o/r/rulesets", "-H", "X-Test: repos/o/r/rulesets",
            "repos/o/r/issues/8/comments");
        assert.doesNotMatch(stderr, REFUSED);
    });

    test("an endpoint the scan cannot identify is refused rather than admitted", () => {
        // "Could not tell" resolving to "allow" is the fail-open this repository keeps finding.
        for (const args of [["api"], ["api", "--help"], ["api", "-X", "PATCH"]]) {
            const { status, stderr } = run(...args);
            assert.equal(status, 2, `\`${args.join(" ")}\` should be refused`);
            assert.match(stderr, REFUSED);
        }
    });

    test("the refusal names the endpoint once, and says so when it found none", () => {
        // The first draft built this line from `${endpoint:+…}${endpoint:-…}`, which prints the value
        // twice when it is set — the `:-` arm falls through to the value rather than to nothing. Found
        // by reading the message instead of only asserting that a refusal fired, which is the same
        // difference between a check that ran and a check that judged.
        const named = run("api", "repos/o/r/rulesets").stderr;
        assert.equal(named.match(/repos\/o\/r\/rulesets/g)?.length, 1, "the endpoint is echoed exactly once");
        assert.match(named, /`repos\/o\/r\/rulesets`/);
        assert.match(run("api", "--help").stderr, /<no endpoint found in these arguments>/);
    });

    test("the refusal names where the action does belong", () => {
        // A refusal that only says no sends an agent looking for another spelling. Both the
        // subcommand refusals above this guard and this one are written to name the sanctioned route
        // instead — here, the maintainer's own `gh api`. It used to add "which prompts"; that stopped
        // being true on 2026-07-28 when the gate came off, and a refusal that mis-describes the route
        // it recommends is worse than one that just points.
        const { stderr } = run("api", "repos/o/r/rulesets");
        assert.match(stderr, /gate-map\.md/, "the refusal points at the gate map");
        assert.match(stderr, /gh api/, "and names the sanctioned route");
        assert.match(stderr, /administration/, "and says what actually refuses this identity");
    });

    test("the subcommand refusals still hold", () => {
        // The `api` arm was added beside these, and a `case` is order-sensitive to overlap. Cheap
        // to assert, and the failure it catches is silent.
        for (const [args, why] of [
            [["pr", "merge", "1"], /use the API form/],
            [["repo", "edit"], /not for the agent identity/],
            [["secret", "list"], /not for the agent identity/],
        ]) {
            const { status, stderr } = run(...args);
            assert.equal(status, 2);
            assert.match(stderr, why);
        }
    });
});

describe("gh-bot — the wrapper spelling stays uncovered", () => {
    test("no rule in the policy claims to cover the wrapper spelling", () => {
        // The honest direction of this whole change. Every shell gate compiles to a literal prefix
        // match, and `./.portulan/tools/gh-bot …` matches none of them — so if a later edit adds the
        // wrapper spelling to a rule target, that is a real policy decision and this test should be
        // read and updated rather than deleted. Asserted so the gate map's claim that this spelling is
        // uncovered stays true of the policy rather than of the day it was written.
        //
        // This also pinned `gh api` as a live rule target until 2026-07-28, when reaching settings
        // through `gh api` stopped being Gated and the rule was removed. The assertion went with it:
        // hole 6 never rested on that one rule existing, only on the prefix matching every shell gate
        // here shares. Checking the prefix property directly is what that assertion was reaching for.
        const policy = JSON.parse(fs.readFileSync(path.join(REPO, ".portulan", "gates.json"), "utf8"));
        const targets = policy.rules.map((r) => r.action?.shell).filter(Boolean);
        assert.ok(targets.length > 0, "the policy still declares shell gates for this to be true of");
        assert.ok(
            !targets.some((t) => t.includes("gh-bot")),
            "no rule targets the wrapper — if one now does, the gate map's `honest holes` section must stop saying it does not",
        );
        const wrapper = "./.portulan/tools/gh-bot api repos/o/r/rulesets";
        assert.ok(
            !targets.some((t) => wrapper === t || wrapper.startsWith(`${t} `)),
            "no shell target prefix-matches the wrapper spelling — which is what makes hole 6 a hole",
        );
    });
});
