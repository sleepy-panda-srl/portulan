// The agent identity's wrapper refuses the endpoints it is not for.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test, before, after } from "node:test";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRAPPER = path.join(REPO, ".portulan", "tools", "gh-bot");

const REFUSED = /PULL REQUEST CONVERSATION/;
const REACHED_THE_TOKEN = /PORTULAN_BOT_APP_ID is not set/;

let stub;

before(() => {
    stub = fs.mkdtempSync(path.join(os.tmpdir(), "gh-bot-stub-"));
    // Lets the wrapper past its `gh` check, and exits 97 so a call that reaches it is never a success.
    fs.writeFileSync(path.join(stub, "gh"), "#!/bin/sh\nexit 97\n", { mode: 0o755 });
});

after(() => fs.rmSync(stub, { recursive: true, force: true }));

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
    // A GET is refused as a PATCH is: the guard gates the endpoint, not the verb.
    for (const args of [
        ["api", "repos/o/r/rulesets"],
        ["api", "-X", "PATCH", "repos/o/r/rulesets/1"],
        ["api", "--method", "PATCH", "repos/o/r/rulesets/1"],
        ["api", "/repos/o/r/rulesets"],
        ["api", "repos/o/r/branches/main/protection"],
        ["api", "repos/o/r/collaborators"],
        ["api", "repos/o/r/actions/permissions"],
        // Under `pulls/` yet Gated, so the allowlist is not "anything under pulls".
        ["api", "repos/o/r/pulls/1/merge"],
        // Not a GitHub route (it answers 404): a review by id is `pulls/<n>/reviews/<id>`, admitted below.
        ["api", "repos/o/r/pulls/reviews/123"],
    ]) {
        test(`refuses \`${args.join(" ")}\``, () => {
            const { status, stderr } = run(...args);
            assert.equal(status, 2, "a refusal is exit 2 — the same contract as the verify recipes");
            assert.match(stderr, REFUSED);
            assert.doesNotMatch(stderr, REACHED_THE_TOKEN, "a refused call must not mint a credential first");
        });
    }

    for (const args of [
        ["api", "repos/o/r/issues/8/comments"],
        ["api", "repos/o/r/issues/comments/5102913529"],
        ["api", "-X", "DELETE", "repos/o/r/issues/comments/5102913529"],
        ["api", "repos/o/r/pulls/42/comments"],
        ["api", "repos/o/r/pulls/42/comments/123/replies"],
        ["api", "repos/o/r/pulls/42/reviews"],
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
        // Both `-f` and `-H` take a value, so a scan that skips only one flag's value still fails here.
        const { stderr } = run("api", "-f", "body=see repos/o/r/rulesets", "-H", "X-Test: repos/o/r/rulesets",
            "repos/o/r/issues/8/comments");
        assert.doesNotMatch(stderr, REFUSED);
    });

    test("an endpoint the scan cannot identify is refused rather than admitted", () => {
        for (const args of [["api"], ["api", "--help"], ["api", "-X", "PATCH"]]) {
            const { status, stderr } = run(...args);
            assert.equal(status, 2, `\`${args.join(" ")}\` should be refused`);
            assert.match(stderr, REFUSED);
        }
    });

    test("the refusal names the endpoint once, and says so when it found none", () => {
        const named = run("api", "repos/o/r/rulesets").stderr;
        assert.equal(named.match(/repos\/o\/r\/rulesets/g)?.length, 1, "the endpoint is echoed exactly once");
        assert.match(named, /`repos\/o\/r\/rulesets`/);
        assert.match(run("api", "--help").stderr, /<no endpoint found in these arguments>/);
    });

    test("the refusal names where the action does belong", () => {
        const { stderr } = run("api", "repos/o/r/rulesets");
        assert.match(stderr, /gate-map\.md/, "the refusal points at the gate map");
        assert.match(stderr, /gh api/, "and names the sanctioned route");
        assert.match(stderr, /administration/, "and says what actually refuses this identity");
    });

    test("the subcommand refusals still hold", () => {
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
