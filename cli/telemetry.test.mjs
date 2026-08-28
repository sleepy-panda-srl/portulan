// The OTel emitter's suite. Every case here exists because something in this repository has already
// been wrong in that exact way, or because a supervisor named the way it would be.
//
// The traps, each traceable to a measurement rather than to a guess:
//   * the entry guard must survive a path containing a space — four modules here have shipped the
//     broken spelling, and for an EMITTER the failure is invisible: a tool that never started sends
//     nothing, and a tool correctly opted out also sends nothing
//   * `--export` must never open a real socket from inside this suite, because `.portulan/verify/
//     tests.sh` runs it and a network call inside a verify recipe is prohibited outright. The
//     transport is injected in every case that exercises the send
//   * the emitted attribute vocabulary is CLOSED and the maintainer widened it exactly once; a key
//     the pin does not know is a red, in both directions, or the closed list is a reminder
//   * opted-out and could-not-read are different answers and must not collapse
//   * the offline audit must fail CLOSED — an empty recipe set is could-not-run, never a green
//   * the producer seam is asserted against a producer this module did not ship, because a generic
//     shape with exactly one implementation is a capability claim nothing checks

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// A HERMETIC HOST, the three-line block `pinned-roots.live.test.mjs` sweeps for — asserted WHOLE, so
// that copying the two lines which neutralise the host and dropping the one that tidies up is caught.
// This suite reaches `recipe-set.mjs` through the offline audit, which consults the host's
// installed-plugin record on the unasked path, so without it a verdict would move with what somebody
// has installed.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import {
    CONFIG_SPEC,
    EMITTED_ATTRIBUTE_KEYS,
    REQUIRED_ATTRIBUTE_KEYS,
    NETWORK_MODES,
    PRODUCERS,
    anyValue,
    auditRecipeSource,
    auditRecipes,
    consentIsCommitted,
    renderPayload,
    serialize,
    stripShellComments,
    transportFromEnv,
    validateConfig,
    run,
} from "./telemetry.mjs";

const TOOL = fileURLToPath(new URL("./telemetry.mjs", import.meta.url));
const REPO = fileURLToPath(new URL("..", import.meta.url));

// **`await`, and it is not a style choice.** A synchronous try/finally around an async body runs the
// `finally` the moment the promise is CREATED, so the temp directory is deleted while the case is
// still using it — and three cases here failed that way before this line grew its `await`. A helper
// that tidies up before the test has run is a false red today and, with the assertions one line
// different, a false green.
const withTemp = async (fn) => {
    const dir = mkdtempSync(join(tmpdir(), "telemetry-"));
    try {
        return await fn(dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
};

const configOf = (over = {}) => ({
    portulan: { telemetry: CONFIG_SPEC },
    enabled: false,
    service: { name: "portulan", namespace: "sleepy-panda-srl" },
    signals: ["review-loop"],
    ...over,
});

/**
 * A temporary git repository whose telemetry consent is really COMMITTED.
 *
 * Shared rather than copied, because three cases need it and the one that was written without it
 * silently never reached its subject.
 */
const committedConsent = async (dir, enabled) => {
    const git = (...args) => {
        const out = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
        assert.equal(out.status, 0, `git ${args.join(" ")}: ${out.stderr}`);
    };
    git("init", "-q");
    git("config", "user.email", "drill@example.invalid");
    git("config", "user.name", "Drill");
    mkdirSync(join(dir, "evals/review-loop"), { recursive: true });
    mkdirSync(join(dir, "evals/telemetry"), { recursive: true });
    writeFileSync(join(dir, "evals/review-loop/snapshot.json"), readFileSync(join(REPO, "evals/review-loop/snapshot.json"), "utf8"));
    writeFileSync(join(dir, "evals/telemetry/config.json"), JSON.stringify(configOf({ enabled })));
    git("add", "-A");
    git("commit", "-qm", "consent");
    return dir;
};

/** An io that records, so a case can assert the MESSAGE and not only the code. */
const recorder = () => {
    const out = [];
    const err = [];
    return { io: { log: (s) => out.push(String(s)), error: (s) => err.push(String(s)) }, out, err, stdout: () => out.join("\n"), stderr: () => err.join("\n") };
};

// ------------------------------------------------------------------------------- the config gate

test("an absent `enabled` is REFUSED, not read as false", () => {
    const problems = validateConfig({ ...configOf(), enabled: undefined });
    assert.ok(
        problems.some((p) => p.includes("absent is not false")),
        `a gate reachable by omission is not a gate: ${JSON.stringify(problems)}`,
    );
});

test("a committed config may not carry a secret, and the refusal names the field", () => {
    for (const banned of ["headers", "endpoint", "token"]) {
        const problems = validateConfig({ ...configOf(), [banned]: "authorization=Bearer x" });
        assert.ok(
            problems.some((p) => p.startsWith(`${banned} may not be set`)),
            `${banned} must be refused in a committed config: ${JSON.stringify(problems)}`,
        );
    }
});

test("a signal no producer answers to is refused, and the known set is named", () => {
    const problems = validateConfig({ ...configOf(), signals: ["not-a-rail"] });
    assert.ok(problems.some((p) => p.includes("no producer answers to")));
    assert.ok(problems.some((p) => p.includes("review-loop")), "the refusal must say what IS known");
});

test("an empty signal list is refused — an emitter with no signal exits 0 having done nothing", () => {
    assert.ok(validateConfig({ ...configOf(), signals: [] }).some((p) => p.includes("non-empty array")));
});

test("a config at the wrong spec is refused rather than read on today's terms", () => {
    assert.ok(validateConfig({ ...configOf(), portulan: { telemetry: "99" } }).some((p) => p.includes("portulan.telemetry must be")));
});

test("a valid config produces NO problems — the refusals are not refusing everything", () => {
    // Every case above asserts a refusal, and a validator that refused its own well-formed input
    // would satisfy all of them. This is the case that keeps them meaningful.
    assert.deepEqual(validateConfig(configOf()), []);
});

// ------------------------------------------------------- opted out is not could-not-run

test("--export on an opted-out config is a VERDICT (1), and its message says so", async () =>
    withTemp(async (dir) => {
        const cfg = join(dir, "config.json");
        writeFileSync(cfg, JSON.stringify(configOf()));
        const r = recorder();
        const code = await run(["--config", cfg, "--repo-root", REPO, "--export"], r.io, { env: {}, post: () => assert.fail("nothing may be sent while opted out") });
        assert.equal(code, 1);
        assert.ok(r.stderr().includes("enabled: false"), r.stderr());
        assert.ok(r.stderr().includes("This is a verdict, not a failure"), "opted out must not read as a malfunction");
    }));

test("a MALFORMED config is could-not-run (2) and explicitly not opted out", async () =>
    withTemp(async (dir) => {
        // The seam defect one level up: a config whose author meant `true` and typed it wrong must
        // never be reported as a decision to stay silent.
        const cfg = join(dir, "config.json");
        writeFileSync(cfg, JSON.stringify({ ...configOf(), enabled: "yes" }));
        const r = recorder();
        const code = await run(["--config", cfg, "--repo-root", REPO, "--export"], r.io, { env: {}, post: () => assert.fail("nothing may be sent") });
        assert.equal(code, 2);
        assert.ok(r.stderr().includes("NOT opted out"), r.stderr());
    }));

test("a MISSING config is could-not-run (2), and its message is distinct from the malformed one", async () => {
    const r = recorder();
    const code = await run(["--config", join(tmpdir(), "telemetry-nope-does-not-exist.json"), "--render"], r.io, { env: {} });
    assert.equal(code, 2);
    assert.ok(r.stderr().includes("cannot read"), r.stderr());
    assert.ok(r.stderr().includes("may well say `enabled: true`"), "an unreadable config states no decision either way");
});

test("--config is required — an inferred config would be an emitter deciding its own consent", async () => {
    const r = recorder();
    assert.equal(await run(["--render"], r.io, { env: {} }), 2);
    assert.ok(r.stderr().includes("--config <file> is required"), r.stderr());
});

// ------------------------------------------------------------------- the consent must be COMMITTED

test("an UNTRACKED config is not consent — could-not-run, with the reason", () => {
    // The stub answers `rev-parse --git-dir` first: repository-ness is established once, up front, so
    // that a later non-zero status is that command's own domain answer rather than an ambiguity.
    const res = consentIsCommitted("evals/telemetry/nope.json", REPO, (_c, args) => (args.includes("rev-parse") ? { status: 0, stdout: ".git\n", stderr: "" } : { status: 1, stdout: "", stderr: "" }));
    assert.equal(res.ok, false);
    assert.ok(res.why.includes("not tracked by git"), res.why);
});

test("a config that DIFFERS from HEAD is not consent — an edited consent is not a committed one", () =>
    withTemp((dir) => {
        const cfg = join(dir, "config.json");
        writeFileSync(cfg, "on disk\n");
        const spawn = (_cmd, args) => (args.includes("rev-parse") ? { status: 0, stdout: ".git\n", stderr: "" } : args.includes("ls-files") ? { status: 0, stdout: "", stderr: "" } : { status: 0, stdout: "at HEAD\n", stderr: "" });
        const res = consentIsCommitted(cfg, dir, spawn);
        assert.equal(res.ok, false);
        assert.ok(res.why.includes("differs from HEAD"), res.why);
    }));

test("the path handed to git is POSIX-separated, whatever the platform", () =>
    withTemp((dir) => {
        // Copilot round 9 on #362. `path.relative` yields `\\` on Windows and git's pathspec and
        // `HEAD:<path>` syntax both want `/`, so a committed config would be refused as untracked there.
        // Asserted by capturing what actually reaches git rather than by branching on the platform —
        // a case that only runs its assertion on Windows asserts nothing on the machine running it.
        const seen = [];
        const spawn = (_c, args) => {
            seen.push(args);
            return args.includes("rev-parse") ? { status: 0, stdout: ".git\n", stderr: "" } : { status: 0, stdout: "x\n", stderr: "" };
        };
        mkdirSync(join(dir, "evals", "telemetry"), { recursive: true });
        const cfg = join(dir, "evals", "telemetry", "config.json");
        writeFileSync(cfg, "x\n");
        consentIsCommitted(cfg, dir, spawn);
        const paths = seen.flat().filter((a) => a.includes("config.json"));
        assert.ok(paths.length >= 2, `git was handed the path fewer times than expected: ${JSON.stringify(seen)}`);
        for (const p of paths) {
            assert.ok(!p.includes("\\"), `a backslash reached git: ${JSON.stringify(p)}`);
            assert.ok(p.includes("evals/telemetry/config.json"), `not POSIX-separated: ${JSON.stringify(p)}`);
        }
    }));

test("a config OUTSIDE the repository can never be established as committed", () => {
    const res = consentIsCommitted("/etc/telemetry.json", REPO, () => assert.fail("git must not be consulted about a path outside the tree"));
    assert.equal(res.ok, false);
    assert.ok(res.why.includes("outside the repository"), res.why);
});

test("a STAGED but uncommitted consent is refused as staged — not as `not a repository`", () =>
    withTemp((dir) => {
        // **Copilot round 7 on #362, and this is a regression the round-4 fix introduced.** That repair
        // distinguished git-failed from untracked by treating exit 128 as "not a repository" — true of
        // `ls-files`, FALSE of `show`, which also exits 128 for a path tracked in the index and absent
        // from HEAD. So the *does not exist at HEAD* branch became unreachable and this case reported
        // "not a repository": the single case the gate exists for, since staging is how an agent would
        // manufacture consent one step short of a commit.
        const g = (...a) => spawnSync("git", ["-C", dir, ...a], { encoding: "utf8" });
        g("init", "-q");
        g("config", "user.email", "drill@example.invalid");
        g("config", "user.name", "Drill");
        writeFileSync(join(dir, "seed"), "x");
        g("add", "seed");
        g("commit", "-qm", "seed");
        writeFileSync(join(dir, "config.json"), "{}");
        g("add", "config.json");
        const res = consentIsCommitted("config.json", dir);
        assert.equal(res.ok, false);
        assert.ok(res.why.includes("staged and never committed"), res.why);
        assert.ok(!/not a git repository/i.test(res.why), `a staged file must not report as a broken repository: ${res.why}`);
    }));

test("a relative --config is resolved against --repo-root, not the caller's cwd", () =>
    withTemp((dir) => {
        // Third instance of the root/cwd split in this one file — workspaceDir (round 1), packRoots
        // (round 6), and the config path here. An in-repo config was classed "outside the repository"
        // whenever the tool ran from anywhere else.
        const g = (...a) => spawnSync("git", ["-C", dir, ...a], { encoding: "utf8" });
        g("init", "-q");
        writeFileSync(join(dir, "config.json"), "{}");
        const res = consentIsCommitted("config.json", dir);
        assert.equal(res.ok, false);
        assert.ok(res.why.includes("is not tracked by git"), `the relative path must resolve inside the repo, not outside it: ${res.why}`);
        assert.ok(!res.why.includes("outside the repository"), res.why);
    }));

test("a directory that is NOT a repository is could-not-run, not `untracked`", () =>
    withTemp((dir) => {
        // Copilot round 4 on #362, through the suppressed channel. Both answers refuse, so no export
        // ever escaped — but reporting *"is not tracked by git, so it is one working copy's opinion"*
        // for a directory that is not a repository sends a reader to look at the wrong thing. That is
        // could-not-run wearing a verdict's words, in the module whose own docblock spends a paragraph
        // keeping those two apart. Git distinguishes them with exit 128; nothing here was reading it.
        writeFileSync(join(dir, "config.json"), "{}");
        const res = consentIsCommitted(join(dir, "config.json"), dir);
        assert.equal(res.ok, false);
        assert.ok(/not a (git )?repository/i.test(res.why), res.why);
        assert.ok(!res.why.includes("is not tracked by git"), `git failing must not be reported as untracked: ${res.why}`);
    }));

test("a genuinely untracked file in a REAL repository still reports `untracked`", () =>
    withTemp((dir) => {
        // The other side of the same split, without which the case above could be satisfied by making
        // every answer say "not a repository".
        spawnSync("git", ["-C", dir, "init", "-q"], { encoding: "utf8" });
        writeFileSync(join(dir, "config.json"), "{}");
        const res = consentIsCommitted(join(dir, "config.json"), dir);
        assert.equal(res.ok, false);
        assert.ok(res.why.includes("is not tracked by git"), res.why);
    }));

test("a tracked config byte-identical to HEAD IS consent", () =>
    withTemp((dir) => {
        const cfg = join(dir, "config.json");
        writeFileSync(cfg, "same\n");
        const spawn = (_cmd, args) => (args.includes("rev-parse") ? { status: 0, stdout: ".git\n", stderr: "" } : args.includes("ls-files") ? { status: 0, stdout: "", stderr: "" } : { status: 0, stdout: "same\n", stderr: "" });
        assert.deepEqual(consentIsCommitted(cfg, dir, spawn), { ok: true });
    }));

test("a config whose NAME begins with `..` is inside the repository, not outside it", () =>
    withTemp((dir) => {
        // Copilot round 1 on #362. The first spelling of this guard was `rel.startsWith("..")`, which
        // calls `..telemetry.json` a traversal — the exact defect `./inside.mjs` was extracted to end,
        // and its EIGHTH site. It failed CLOSED here (refusing a valid config), which is the safe
        // direction and still the wrong answer.
        const cfg = join(dir, "..telemetry.json");
        writeFileSync(cfg, "same\n");
        const spawn = (_c, args) => (args.includes("rev-parse") ? { status: 0, stdout: ".git\n", stderr: "" } : args.includes("ls-files") ? { status: 0, stdout: "", stderr: "" } : { status: 0, stdout: "same\n", stderr: "" });
        assert.deepEqual(consentIsCommitted(cfg, dir, spawn), { ok: true });
    }));

test("--audit-recipes pins the workspace directory with --repo-root, not the cwd", () => {
    // Copilot round 1 on #362: the manifest was resolved against the CURRENT WORKING DIRECTORY, so a
    // run from outside the tree that named --repo-root correctly still looked beside the caller. The
    // relative form must answer identically from anywhere, which is what pinning means.
    const res = auditRecipes({ workspaceDir: ".portulan", repoRoot: REPO, packRoots: [join(REPO, "packs")] });
    assert.equal(res.ok, true, res.why);
    assert.ok(res.examined.length > 1);
});

test("a MALFORMED snapshot is refused, never rendered with defaulted metadata", async () =>
    withTemp(async (dir) => {
        // Copilot round 1 on #362, through the suppressed channel. `meter()` reads a non-array
        // `pullRequests` as `[]` and this producer defaults `repository` and `window.merged`, so a
        // broken input rendered a payload carrying WRONG metadata instead of refusing — a fail-open in
        // the one direction that matters, since the payload is what leaves the machine.
        mkdirSync(join(dir, "evals/review-loop"), { recursive: true });
        writeFileSync(join(dir, "evals/review-loop/snapshot.json"), JSON.stringify({ portulan: { reviewSnapshot: "1" }, repository: "x/y", captured: "2026-08-26T00:00:00Z", window: { merged: 3, pool: 9, poolSaturated: false }, pullRequests: "not an array" }));
        const cfg = join(dir, "config.json");
        writeFileSync(cfg, JSON.stringify(configOf()));
        const r = recorder();
        const code = await run(["--config", cfg, "--repo-root", dir, "--render"], r.io, { env: {} });
        assert.equal(code, 2, r.stdout());
        assert.ok(r.stderr().includes("cannot be metered from"), r.stderr());
        assert.ok(!r.stdout().includes("resourceMetrics"), "no payload may be rendered from an input that did not validate");
    }));

// ------------------------------------------------------------------------- the closed payload

test("every attribute key the payload emits is one the pin knows", () => {
    const snapshot = JSON.parse(readFileSync(join(REPO, "evals/review-loop/snapshot.json"), "utf8"));
    const p = PRODUCERS["review-loop"];
    const payload = renderPayload({
        config: configOf(),
        signals: [{ name: "review-loop", scope: p.scope, capturedAt: p.capturedAt(snapshot), rows: p.rows(snapshot), attributes: p.attributes(snapshot), resource: p.resource(snapshot) }],
    });
    const rm = payload.resourceMetrics[0];
    const keys = new Set(rm.resource.attributes.map((a) => a.key));
    for (const sm of rm.scopeMetrics) for (const m of sm.metrics) for (const dp of m.gauge.dataPoints) for (const a of dp.attributes) keys.add(a.key);

    const unknown = [...keys].filter((k) => !EMITTED_ATTRIBUTE_KEYS.includes(k));
    assert.deepEqual(unknown, [], `an emission carried a key the closed list does not know: ${unknown.join(", ")}`);
    // The other direction, which is the half that catches a DELETED carrier rather than an added one:
    // a pin listing keys nothing emits would grow stale silently, exactly as a hand-maintained roster
    // does. `version-carriers.mjs` calls this its MUST_CARRY half.
    //
    // **Against the FLOOR, not the allow-list.** This asserted every allow-listed key was present,
    // which made an optional key indistinguishable from a mandatory one and was green only because
    // this workspace declares a `service.namespace`. Copilot round 2 on #362.
    const unemitted = REQUIRED_ATTRIBUTE_KEYS.filter((k) => !keys.has(k));
    assert.deepEqual(unemitted, [], `the pin names required keys nothing emits: ${unemitted.join(", ")}`);
});

test("a config with NO service.namespace is valid, and its payload is still within the closed list", () => {
    // Copilot round 2 on #362. `service.namespace` is optional in the config and optional in
    // OpenTelemetry's own semantic conventions; the pin treated it as mandatory and passed only because
    // this workspace declares one. The legal config is the case that was missing.
    const config = { ...configOf(), service: { name: "portulan" } };
    assert.deepEqual(validateConfig(config), [], "a namespace-less config is legal");
    const snapshot = JSON.parse(readFileSync(join(REPO, "evals/review-loop/snapshot.json"), "utf8"));
    const p = PRODUCERS["review-loop"];
    const payload = renderPayload({
        config,
        signals: [{ name: "review-loop", scope: p.scope, capturedAt: p.capturedAt(snapshot), rows: p.rows(snapshot), attributes: p.attributes(snapshot), resource: p.resource(snapshot) }],
    });
    const rm = payload.resourceMetrics[0];
    const keys = new Set(rm.resource.attributes.map((a) => a.key));
    for (const sm of rm.scopeMetrics) for (const m of sm.metrics) for (const dp of m.gauge.dataPoints) for (const a of dp.attributes) keys.add(a.key);
    assert.ok(!keys.has("service.namespace"), "no namespace declared, so none is emitted");
    assert.deepEqual([...keys].filter((k) => !EMITTED_ATTRIBUTE_KEYS.includes(k)), [], "still inside the allow-list");
    assert.deepEqual(REQUIRED_ATTRIBUTE_KEYS.filter((k) => !keys.has(k)), [], "and still carries every required key");
});

test("no reviewer LOGIN reaches the payload — an identifier about a person is outside anything ruled", () => {
    const snapshot = JSON.parse(readFileSync(join(REPO, "evals/review-loop/snapshot.json"), "utf8"));
    const logins = new Set((snapshot.pullRequests ?? []).flatMap((pr) => (pr.submissions ?? []).map((s) => s.login)));
    assert.ok(logins.size > 0, "the fixture must actually contain a login, or this case proves nothing");
    const body = readFileSync(join(REPO, "evals/telemetry/review-loop.otlp.json"), "utf8");
    for (const login of logins) assert.ok(!body.includes(login), `the payload leaked a login: ${login}`);
});

test("no commit SHA and no per-pull-request detail reaches the payload", () => {
    const snapshot = JSON.parse(readFileSync(join(REPO, "evals/review-loop/snapshot.json"), "utf8"));
    const heads = (snapshot.pullRequests ?? []).flatMap((pr) => (pr.submissions ?? []).map((s) => s.head)).filter(Boolean);
    assert.ok(heads.length > 0, "the fixture must contain heads, or this case proves nothing");
    const body = readFileSync(join(REPO, "evals/telemetry/review-loop.otlp.json"), "utf8");
    for (const head of heads.slice(0, 20)) assert.ok(!body.includes(head), `the payload leaked a head: ${head}`);
});

test("a null figure is DROPPED, never encoded as zero", () => {
    // An unmeasured ratio is not a ratio of zero. `review-meter.mjs` returns null precisely so nobody
    // reads an empty corpus as a measured zero, and encoding it here would undo that a layer down.
    const payload = renderPayload({
        config: configOf(),
        signals: [{ name: "x", scope: "s", capturedAt: "2026-08-26T00:00:00Z", rows: [{ name: "a", unit: "1", description: "", value: null }, { name: "b", unit: "1", description: "", value: 2 }], attributes: {}, resource: {} }],
    });
    const names = payload.resourceMetrics[0].scopeMetrics[0].metrics.map((m) => m.name);
    assert.deepEqual(names, ["b"]);
});

test("a metric value past the safe-integer range is emitted as a double, not a false intValue", () => {
    const payload = renderPayload({
        config: configOf(),
        signals: [{ name: "x", scope: "s", capturedAt: "2026-01-01T00:00:00Z", rows: [{ name: "big", unit: "1", description: "", value: 2 ** 53 }, { name: "safe", unit: "1", description: "", value: 7 }], attributes: {}, resource: {} }],
    });
    const [big, safe] = payload.resourceMetrics[0].scopeMetrics[0].metrics;
    assert.equal(big.gauge.dataPoints[0].asInt, undefined, "an unsafe integer must not claim an exact int64");
    assert.equal(big.gauge.dataPoints[0].asDouble, 2 ** 53);
    assert.equal(safe.gauge.dataPoints[0].asInt, "7");
});

test("the timestamp is the instant the measurement is ABOUT, not a clock read", () => {
    const capturedAt = "2026-08-26T11:14:20.052Z";
    const payload = renderPayload({
        config: configOf(),
        signals: [{ name: "x", scope: "s", capturedAt, rows: [{ name: "a", unit: "1", description: "", value: 1 }], attributes: {}, resource: {} }],
    });
    const dp = payload.resourceMetrics[0].scopeMetrics[0].metrics[0].gauge.dataPoints[0];
    assert.equal(dp.timeUnixNano, String(BigInt(Date.parse(capturedAt)) * 1000000n));
    // Gauge, not Sum: these are snapshot statistics over a window, and a Sum would owe an
    // aggregationTemporality and a start instant the snapshot does not record.
    assert.ok(payload.resourceMetrics[0].scopeMetrics[0].metrics[0].gauge, "the point type is Gauge");
    assert.equal(dp.startTimeUnixNano, undefined, "a Gauge owes no start instant");
});

test("the OTLP AnyValue map encodes each scalar kind, and refuses what it has no encoding for", () => {
    assert.deepEqual(anyValue("x"), { stringValue: "x" });
    assert.deepEqual(anyValue(true), { boolValue: true });
    assert.deepEqual(anyValue(3), { intValue: "3" });
    assert.deepEqual(anyValue(1.5), { doubleValue: 1.5 });
    // Copilot round 11 on #362. OTLP's intValue is an int64 and a JS number stops being an exact
    // integer past 2^53, so `Number.isInteger` would emit a precise-looking integer that is not the
    // number anybody meant. Beyond the safe range `asDouble` is the honest encoding — approximate and
    // labelled approximate. Not reachable with today's producer; fixed because `anyValue` is exported.
    assert.deepEqual(anyValue(Number.MAX_SAFE_INTEGER), { intValue: "9007199254740991" });
    assert.deepEqual(anyValue(2 ** 53), { doubleValue: 2 ** 53 });
    assert.throws(() => anyValue(Number.NaN), /no OTLP encoding/);
    assert.throws(() => anyValue({}), /no OTLP encoding/);
});

// --------------------------------------------------- the producer seam, against a producer we did
// --------------------------------------------------- not ship

test("the emitter honours a producer document it did not ship", () => {
    // **The genericity claim, checked rather than asserted.** The design says a second rail joins by
    // writing a producer document; a shape with exactly one implementation is a capability claim that
    // `.portulan/dod.md` condition 4 would otherwise leave unbacked, and `spec/slots.md`'s "splitting
    // on speculation" hazard one layer down from the schema slot this session cut.
    const synthetic = {
        name: "a-rail-that-does-not-exist",
        scope: "portulan/synthetic",
        capturedAt: "2026-01-02T03:04:05.000Z",
        rows: [{ name: "portulan.synthetic.count", unit: "{thing}", description: "A rail this module has never heard of.", value: 42 }],
        attributes: { "portulan.units": "submission" },
        resource: { "portulan.repository": "someone-else/their-repo" },
    };
    const payload = renderPayload({ config: configOf(), signals: [synthetic] });
    const sm = payload.resourceMetrics[0].scopeMetrics[0];
    assert.equal(sm.scope.name, "portulan/synthetic");
    assert.equal(sm.metrics[0].name, "portulan.synthetic.count");
    assert.equal(sm.metrics[0].gauge.dataPoints[0].asInt, "42");
    assert.ok(payload.resourceMetrics[0].resource.attributes.some((a) => a.key === "portulan.repository" && a.value.stringValue === "someone-else/their-repo"));
});

test("two signals render into two scopes in one payload", () => {
    const s = (name) => ({ name, scope: `portulan/${name}`, capturedAt: "2026-01-01T00:00:00Z", rows: [{ name: `portulan.${name}.n`, unit: "1", description: "", value: 1 }], attributes: {}, resource: {} });
    const payload = renderPayload({ config: configOf(), signals: [s("one"), s("two")] });
    assert.deepEqual(
        payload.resourceMetrics[0].scopeMetrics.map((x) => x.scope.name),
        ["portulan/one", "portulan/two"],
    );
});

// ------------------------------------------------------------------------------ the offline audit

test("a shell COMMENT naming a network mode is not an invocation", () => {
    // `.portulan/verify/review-loop.sh` documents `node cli/review-meter.mjs --fetch` in a comment. A
    // matcher that could not tell prose from a command would red on the sentence explaining the rule
    // it enforces — `version-carriers.mjs` records that exact failure for its own record layer.
    const source = ["# Refreshing is `node cli/review-meter.mjs --fetch`, run by a person.", "node cli/review-meter.mjs --snapshot s.json --check"].join("\n");
    assert.deepEqual(auditRecipeSource(source), []);
});

test("an invocation spread across CONTINUED lines is caught", () => {
    // The spelling a real recipe uses. A same-line matcher would miss it, and every recipe here
    // spreads its command over several lines.
    const source = ["node cli/telemetry.mjs \\", "    --config evals/telemetry/config.json \\", "    --export"].join("\n");
    const hits = auditRecipeSource(source);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].flag, "--export");
});

test("the module WITHOUT its network flag is not a finding", () => {
    // `review-loop.sh` legitimately runs review-meter in its snapshot-reading mode. A rail banning the
    // module rather than the mode would forbid an existing green recipe.
    assert.deepEqual(auditRecipeSource("node cli/review-meter.mjs --snapshot s.json --check"), []);
});

test("a network mode is caught however its PATH is spelled", () => {
    // Copilot round 3 on #362. The matcher compared the body against the literal `cli/telemetry.mjs`,
    // so `node ./cli/review-meter.mjs --fetch` — same file, same effect, one prefix different — walked
    // past an enforcement rail. Seven of the eight bypasses that produced clauses (a) and (b) of this
    // milestone were exactly this: path and grammar spellings a matcher had not been given.
    for (const src of [
        "node ./cli/review-meter.mjs --fetch",
        "node cli/review-meter.mjs --fetch",
        "node /somewhere/absolute/cli/review-meter.mjs --fetch",
        'bash -c "node ./cli/review-meter.mjs --fetch"',
    ]) {
        assert.equal(auditRecipeSource(src).length, 1, `not caught: ${src}`);
    }
});

test("a network flag is caught in both spellings a shell writes it", () => {
    assert.equal(auditRecipeSource("node cli/telemetry.mjs --export").length, 1);
    assert.equal(auditRecipeSource("node cli/telemetry.mjs --export=1").length, 1);
    // And a flag that merely starts the same is NOT a match — `--exporter` is not `--export`.
    assert.deepEqual(auditRecipeSource("node cli/telemetry.mjs --exporter foo"), []);
});

test("a recipe whose script resolves OUTSIDE the tree is could-not-run, never a pass", () =>
    withTemp((dir) => {
        // Copilot round 3 on #362. `path.resolve` follows `bash ../../outside.sh` straight out of the
        // repository, and the audit would then grade a file the pinned root does not cover — which both
        // ends the property the pin buys and offers a bypass. `isInside` was already imported into the
        // module for the consent check and this call site did not use it.
        mkdirSync(join(dir, ".portulan"), { recursive: true });
        writeFileSync(
            join(dir, ".portulan", "workspace.json"),
            JSON.stringify({
                portulan: { spec: "2.8" },
                name: "escapee",
                kind: "repository",
                tree: "../",
                slots: {},
                verify: { default: "out", recipes: [{ id: "out", run: "bash ../../outside.sh", requires: ["bash"] }] },
            }),
        );
        const res = auditRecipes({ workspaceDir: join(dir, ".portulan"), repoRoot: dir });
        assert.equal(res.ok, false);
        assert.ok(res.why.includes("outside the repository"), res.why);
    }));

test("stripShellComments removes whole-line comments only, and says nothing about trailing ones", () => {
    assert.equal(stripShellComments("# gone\nkept\n   # also gone"), "kept");
});

test("the audit catches feedback's network path too — the class, not this session's two modules", () => {
    // Copilot round 10 on #362. `cli/feedback.mjs` files a GitHub issue through `gh issue create`,
    // gated on `--approve`, and was network-capable before either of the other two rows existed. The
    // table claimed to rail *the class* and enumerated two of three — a set drawn by its author and
    // reported as complete, which is the census shape this milestone's session 4 named.
    assert.equal(auditRecipeSource("node cli/feedback.mjs send report.md --approve").length, 1);
    assert.equal(auditRecipeSource("node ./cli/feedback.mjs send report.md --approve").length, 1);
    // Preview is the non-network mode and must not be a finding.
    assert.deepEqual(auditRecipeSource("node cli/feedback.mjs preview report.md"), []);
});

test("every module in cli/ that can reach the network has a row in NETWORK_MODES", () => {
    // The half that makes the table a rail rather than a list: derived from the tree, so a new
    // network-capable module reddens instead of being quietly uncovered. `gh` and `fetch` are the only
    // two ways out of this process, and both are greppable.
    const derived = fs
        .readdirSync(join(REPO, "cli"))
        .filter((f) => f.endsWith(".mjs") && !f.includes(".test."))
        .filter((f) => {
            const src = readFileSync(join(REPO, "cli", f), "utf8");
            return /\bfetch\(/.test(src) || /spawnSync\(\s*"gh"|exec\(\s*"gh"|\["gh"/.test(src) || /\bgh\(\[/.test(src);
        })
        .map((f) => `cli/${f}`);
    const rostered = new Set(NETWORK_MODES.map((m) => m.module));
    const missing = derived.filter((m) => !rostered.has(m));
    assert.deepEqual(missing, [], `network-capable module(s) with no NETWORK_MODES row: ${missing.join(", ")}`);
});

test("a --workspace resolving OUTSIDE the pinned root is could-not-run", () =>
    withTemp((dir) => {
        // Copilot round 10 on #362. Resolving against `repoRoot` does not keep it there: `../../..`, or
        // an absolute path anywhere, would grade a manifest outside the tree the audit claims to answer
        // about. Round 3 closed this for a recipe's SCRIPT and left the MANIFEST open — the same fix
        // owed at two sites and taken at one.
        mkdirSync(join(dir, "repo"), { recursive: true });
        const res = auditRecipes({ workspaceDir: "../..", repoRoot: join(dir, "repo") });
        assert.equal(res.ok, false);
        assert.ok(res.why.includes("resolves outside the repository"), res.why);
    }));

test("every network mode in the table names a module that exists", () => {
    for (const m of NETWORK_MODES) {
        assert.ok(readFileSync(join(REPO, m.module), "utf8").includes(m.flag), `${m.module} does not carry ${m.flag} — the table names a mode that is not there`);
    }
});

test("the audit refuses an EMPTY recipe set rather than passing vacuously", () =>
    withTemp((dir) => {
        // *No recipe reaches the network* is satisfied by no recipes. A rail whose green can be
        // produced by an enumeration coming back empty is the fail-open
        // `.portulan/memory/verify-preconditions-fail-closed.md` was written about.
        mkdirSync(join(dir, ".portulan"), { recursive: true });
        writeFileSync(join(dir, ".portulan", "workspace.json"), JSON.stringify({ portulan: { spec: "2.8" }, name: "empty", kind: "repository", tree: "../", slots: {}, verify: { default: "none", recipes: [] } }));
        const res = auditRecipes({ workspaceDir: join(dir, ".portulan"), repoRoot: dir });
        assert.equal(res.ok, false);
        // The refusal arrives from `recipeSet` itself — upstream of this module's own empty guard,
        // which is defence in depth rather than the only wall. Asserted on the property (it refused,
        // and said why) rather than on one carrier's exact wording, so moving the refusal between the
        // two layers does not silently break this case.
        assert.ok(/no verify recipes|yielded NO recipes/.test(res.why), res.why);
    }));

test("an unreadable workspace manifest is could-not-run, never an audit that found nothing", () =>
    withTemp((dir) => {
        const res = auditRecipes({ workspaceDir: join(dir, "nowhere"), repoRoot: dir });
        assert.equal(res.ok, false);
        assert.ok(res.why.includes("could not be read"), res.why);
    }));

test("--pack-root is pinned by --repo-root too, so the answer does not move with the cwd", () => {
    // Copilot round 6 on #362. Round 1 pinned `workspaceDir` and left `packRoots` resolving against the
    // caller's cwd — so the yielded recipe SET, and therefore this audit's whole answer, depended on
    // where the tool was invoked from. `0020`'s class: the fix applied at the site it was found and not
    // at its sibling, inside the change that made it.
    //
    // Asserted by comparing the RELATIVE spelling against the absolute one. A case that only ran from
    // the repository root would pass either way, which is how the defect survived round 1.
    const relative = auditRecipes({ workspaceDir: ".portulan", repoRoot: REPO, packRoots: ["packs"] });
    const absolute = auditRecipes({ workspaceDir: join(REPO, ".portulan"), repoRoot: REPO, packRoots: [join(REPO, "packs")] });
    assert.equal(relative.ok, true, relative.why);
    assert.deepEqual(relative.examined, absolute.examined, "the relative and absolute spellings must yield the same set");
    assert.ok(relative.examined.some((id) => id.includes(":")), "the composed pack's recipe must be in it — otherwise the pack root resolved to nothing and this case proves nothing");
});

test("the --export help text names every transport variable the code actually reads", () => {
    // Copilot round 6 on #362, and it is the round-5 fix's own loose end: the usage string still said
    // `_ENDPOINT / _HEADERS` after the code learned the metrics-specific variables and gave them
    // precedence. A help screen that under-describes the code sends an adopter who configured the
    // standard way looking for a bug that is not there — dod.md condition 4, in the tool's own output.
    const usage = (() => {
        const r = recorder();
        run(["--help"], r.io, { env: {} });
        return r.stdout();
    })();
    for (const v of ["OTEL_EXPORTER_OTLP_METRICS_ENDPOINT", "OTEL_EXPORTER_OTLP_ENDPOINT", "OTEL_EXPORTER_OTLP_METRICS_HEADERS", "OTEL_EXPORTER_OTLP_HEADERS"]) {
        assert.ok(usage.includes(v), `--help does not mention ${v}, which transportFromEnv reads`);
    }
});

test("this repository's own yielded recipes are all offline, and the set is not empty", () => {
    const res = auditRecipes({ workspaceDir: join(REPO, ".portulan"), repoRoot: REPO, packRoots: [join(REPO, "packs")] });
    assert.equal(res.ok, true, res.why);
    assert.ok(res.examined.length > 1, "a one-recipe set would make this green nearly vacuous");
    assert.deepEqual(res.findings, []);
});

// ------------------------------------------------------------------------------------ transport

test("transport comes from the OTel standard environment, and an unset endpoint is a refusal", () => {
    assert.equal(transportFromEnv({}).ok, false);
    assert.ok(transportFromEnv({}).why.includes("OTEL_EXPORTER_OTLP_ENDPOINT"));
});

test("the BASE endpoint gains the OTLP metrics path exactly once, with or without a trailing slash", () => {
    assert.equal(transportFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318" }).url, "http://localhost:4318/v1/metrics");
    assert.equal(transportFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318/" }).url, "http://localhost:4318/v1/metrics");
});

test("the METRICS-specific endpoint is used as given — no path is appended to it", () => {
    // Copilot round 5 on #362, through the suppressed channel. The specification distinguishes a BASE
    // endpoint, to which the signal path is appended, from the signal-specific one, which is the full
    // URL. Appending to both gave `/v1/metrics/v1/metrics` to anyone configured the standard way, and
    // left them no escape hatch — while this module's docblock claimed to read the variables "exactly
    // as the specification defines them". A conformance claim is a claim like any other.
    assert.equal(transportFromEnv({ OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: "http://c:4318/v1/metrics" }).url, "http://c:4318/v1/metrics");
    assert.equal(transportFromEnv({ OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: "http://c/custom/sink" }).url, "http://c/custom/sink");
});

test("the metrics-specific endpoint WINS over the base, and the refusal names both", () => {
    assert.equal(
        transportFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://base:1", OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: "http://specific:2/m" }).url,
        "http://specific:2/m",
    );
    const none = transportFromEnv({});
    assert.equal(none.ok, false);
    assert.ok(none.why.includes("OTEL_EXPORTER_OTLP_METRICS_ENDPOINT") && none.why.includes("OTEL_EXPORTER_OTLP_ENDPOINT"), none.why);
});

test("metrics-specific headers REPLACE the general ones rather than merging", () => {
    // The specification's rule, and the behaviour somebody configuring one tenant's credentials for
    // metrics alone is relying on. Merging would silently send the general list too.
    const t = transportFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://c:4318", OTEL_EXPORTER_OTLP_HEADERS: "authorization=general", OTEL_EXPORTER_OTLP_METRICS_HEADERS: "authorization=specific" });
    assert.equal(t.headers.authorization, "specific");
    assert.equal(Object.keys(t.headers).length, 2, "content-type and the one replaced header, nothing carried over");
});

test("a non-URL endpoint is a refusal rather than a request to nowhere", () => {
    assert.equal(transportFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "not a url" }).ok, false);
});

test("OTEL_EXPORTER_OTLP_HEADERS is parsed on the specification's key=value,key=value form", () => {
    const t = transportFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://x:4318", OTEL_EXPORTER_OTLP_HEADERS: "authorization=Bearer abc,x-tenant=nine" });
    assert.equal(t.headers.authorization, "Bearer abc");
    assert.equal(t.headers["x-tenant"], "nine");
    assert.equal(t.headers["content-type"], "application/json");
});

test("--export on an UNCOMMITTED consent sends nothing, and never prints the headers", async () =>
    withTemp(async (dir) => {
        // The transport is INJECTED. `.portulan/verify/tests.sh` runs this suite, so a real socket
        // here would be the network call inside a verify recipe that this module's own audit forbids.
        const cfg = join(dir, "config.json");
        writeFileSync(cfg, JSON.stringify(configOf({ enabled: true })));
        const seen = [];
        const r = recorder();
        const code = await run(["--config", cfg, "--repo-root", REPO, "--export"], r.io, {
            env: { OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318", OTEL_EXPORTER_OTLP_HEADERS: "authorization=Bearer SECRET" },
            post: async (url, headers, body) => {
                seen.push({ url, headers, body });
                return { ok: true, status: 200, text: "" };
            },
        });
        // The committed-consent check runs against the real repository, where this temp config is not
        // tracked — so the send is refused before any transport is reached. That refusal IS the
        // property: an uncommitted consent is nobody's decision.
        assert.equal(code, 2);
        assert.equal(seen.length, 0, "nothing may be sent on an uncommitted consent");
        assert.ok(r.stderr().includes("outside the repository"), r.stderr());
        assert.ok(!r.stderr().includes("SECRET"), "a header value must never be printed");
    }));

test("with the consent COMMITTED, --export sends the serializer's exact bytes", async () =>
    withTemp(async (dir) => {
        // **The whole path, end to end, with the transport injected.** A real socket here would be a
        // network call inside a verify recipe — `.portulan/verify/tests.sh` runs this suite — which is
        // the thing this module's own audit forbids. So the consent is made real (a git repository
        // with the config committed) while the send is faked, which is the only split that exercises
        // the gate without breaking the rule the gate protects.
        const git = (...args) => {
            const out = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
            assert.equal(out.status, 0, `git ${args.join(" ")}: ${out.stderr}`);
        };
        git("init", "-q");
        git("config", "user.email", "drill@example.invalid");
        git("config", "user.name", "Drill");
        mkdirSync(join(dir, "evals/review-loop"), { recursive: true });
        mkdirSync(join(dir, "evals/telemetry"), { recursive: true });
        writeFileSync(join(dir, "evals/review-loop/snapshot.json"), readFileSync(join(REPO, "evals/review-loop/snapshot.json"), "utf8"));
        const cfg = join(dir, "evals/telemetry/config.json");
        writeFileSync(cfg, JSON.stringify(configOf({ enabled: true })));
        git("add", "-A");
        git("commit", "-qm", "consent");

        const seen = [];
        const r = recorder();
        const code = await run(["--config", cfg, "--repo-root", dir, "--export"], r.io, {
            env: { OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318", OTEL_EXPORTER_OTLP_HEADERS: "authorization=Bearer SECRET" },
            post: async (url, headers, body) => {
                seen.push({ url, headers, body });
                return { ok: true, status: 200, text: "" };
            },
        });
        assert.equal(code, 0, r.stderr());
        assert.equal(seen.length, 1);
        assert.equal(seen[0].url, "http://localhost:4318/v1/metrics");
        assert.equal(seen[0].headers.authorization, "Bearer SECRET");
        assert.equal(seen[0].body, readFileSync(join(REPO, "evals/telemetry/review-loop.otlp.json"), "utf8"), "the wire bytes ARE the golden's bytes");
        assert.ok(!r.stdout().includes("SECRET") && !r.stderr().includes("SECRET"), "a header value must never be printed");
        assert.ok(r.stdout().includes("http://localhost:4318/v1/metrics"), "the endpoint IS printed — only the headers are withheld");
    }));

test("an EDITED consent refuses even where the file is tracked", async () =>
    withTemp(async (dir) => {
        // The half that makes the ruling a rail: an agent may not flip `enabled: true` in a working
        // copy and export on nobody's decision.
        const git = (...args) => spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
        git("init", "-q");
        git("config", "user.email", "drill@example.invalid");
        git("config", "user.name", "Drill");
        mkdirSync(join(dir, "evals/review-loop"), { recursive: true });
        mkdirSync(join(dir, "evals/telemetry"), { recursive: true });
        writeFileSync(join(dir, "evals/review-loop/snapshot.json"), readFileSync(join(REPO, "evals/review-loop/snapshot.json"), "utf8"));
        const cfg = join(dir, "evals/telemetry/config.json");
        writeFileSync(cfg, JSON.stringify(configOf({ enabled: false })));
        git("add", "-A");
        git("commit", "-qm", "consent withheld");
        // The edit an agent would make.
        writeFileSync(cfg, JSON.stringify(configOf({ enabled: true })));

        const r = recorder();
        const code = await run(["--config", cfg, "--repo-root", dir, "--export"], r.io, {
            env: { OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318" },
            post: () => assert.fail("an edited consent may send nothing"),
        });
        assert.equal(code, 2);
        assert.ok(r.stderr().includes("differs from HEAD"), r.stderr());
    }));

test("a collector answering non-2xx is a verdict, and the send really happened", async () =>
    withTemp(async (dir) => {
        // **This case shipped as a false green and the pre-commit checkpoint caught it — the fourth in
        // this session and the only one in the arm that matters.** It pointed `--repo-root` at a bare
        // temp directory where `evals/review-loop/snapshot.json` does not exist, so the run exited 2 at
        // the signal read: it never validated consent, never built a payload, and never called the
        // injected `post`. `assert.notEqual(code, 0)` held for an unrelated reason, and the `!res.ok`
        // branch in `telemetry.mjs` was covered by nothing at all. An assertion that holds for a reason
        // other than its subject keeps passing after the code it names is deleted — which is the whole
        // argument for asserting the MESSAGE and the side effect rather than only the code.
        const repo = await committedConsent(dir, true);
        const seen = [];
        const r = recorder();
        const code = await run(["--config", join(repo, "evals/telemetry/config.json"), "--repo-root", repo, "--export"], r.io, {
            env: { OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318" },
            post: async (url, headers, body) => {
                seen.push({ url, headers, body });
                return { ok: false, status: 503, text: "collector down" };
            },
        });
        assert.equal(code, 1, r.stderr());
        assert.equal(seen.length, 1, "the send must actually have been attempted — otherwise this case proves nothing");
        assert.ok(r.stderr().includes("503"), r.stderr());
    }));

// ------------------------------------------------------------------------- render, check, write

test("--render opens no socket and says nothing was sent", async () =>
    withTemp(async (dir) => {
        const cfg = join(dir, "config.json");
        writeFileSync(cfg, JSON.stringify(configOf()));
        const r = recorder();
        const code = await run(["--config", cfg, "--repo-root", REPO, "--render"], r.io, { env: {}, post: () => assert.fail("--render must not send") });
        assert.equal(code, 0);
        assert.ok(r.stdout().includes("nothing was sent"), r.stdout().slice(0, 400));
        assert.ok(r.stdout().includes("resourceMetrics"), "the payload itself is printed");
    }));

test("--check reds when the golden drifts, and its message forbids a hand-edit", async () =>
    withTemp(async (dir) => {
        const cfg = join(dir, "config.json");
        writeFileSync(cfg, JSON.stringify(configOf()));
        const golden = join(dir, "golden.json");
        writeFileSync(golden, "{}\n");
        const r = recorder();
        assert.equal(await run(["--config", cfg, "--repo-root", REPO, "--check", golden], r.io, { env: {} }), 1);
        assert.ok(r.stderr().includes("do not edit it by hand"), r.stderr());
    }));

test("--check on a MISSING golden is could-not-run, not drift", async () =>
    withTemp(async (dir) => {
        const cfg = join(dir, "config.json");
        writeFileSync(cfg, JSON.stringify(configOf()));
        const r = recorder();
        assert.equal(await run(["--config", cfg, "--repo-root", REPO, "--check", join(dir, "absent.json")], r.io, { env: {} }), 2);
    }));

test("--write then --check is green, and the bytes are the serializer's own", async () =>
    withTemp(async (dir) => {
        const cfg = join(dir, "config.json");
        writeFileSync(cfg, JSON.stringify(configOf()));
        const golden = join(dir, "golden.json");
        assert.equal(await run(["--config", cfg, "--repo-root", REPO, "--write", golden], recorder().io, { env: {} }), 0);
        assert.equal(await run(["--config", cfg, "--repo-root", REPO, "--check", golden], recorder().io, { env: {} }), 0);
        assert.ok(readFileSync(golden, "utf8").endsWith("}\n"), "the golden is the serializer's exact bytes");
    }));

test("two modes at once is refused rather than one silently winning", async () =>
    withTemp(async (dir) => {
        const cfg = join(dir, "config.json");
        writeFileSync(cfg, JSON.stringify(configOf()));
        const r = recorder();
        assert.equal(await run(["--config", cfg, "--render", "--export"], r.io, { env: {} }), 2);
        assert.ok(r.stderr().includes("pick one"), r.stderr());
    }));

test("the committed payload matches the committed snapshot and config", async () => {
    // The rail's own subject, asserted here too so a broken renderer fails the suite and not only the
    // recipe — `review-meter.test.mjs` keeps the same belt and braces over its register.
    const r = recorder();
    assert.equal(
        await run(["--config", join(REPO, "evals/telemetry/config.json"), "--repo-root", REPO, "--check", join(REPO, "evals/telemetry/review-loop.otlp.json")], r.io, { env: {} }),
        0,
        r.stderr(),
    );
});

test("this workspace ships OPTED OUT", () => {
    // Not a lock on the value — he may opt in, and this case then says so out loud in the diff that
    // does it, which is the point. What it forbids is the flag moving unnoticed.
    const cfg = JSON.parse(readFileSync(join(REPO, "evals/telemetry/config.json"), "utf8"));
    assert.equal(cfg.enabled, false, "enabling emission is the maintainer's Gated act and shows up here");
});

// --------------------------------------------------------------------------------- the entry guard

test("the entry guard survives a path containing a SPACE — and here silence is the failure", () =>
    withTemp((dir) => {
        // For every other tool here a never-starting binary is a bad day. For an emitter it is
        // invisible: a tool that never started sends nothing, and a correctly opted-out emitter also
        // sends nothing. `file://${argv[1]}` percent-encodes nothing while `import.meta.url` encodes
        // the space, so the comparison fails and the tool exits 0 having run nothing.
        const spaced = join(dir, "a directory with spaces");
        mkdirSync(spaced);
        const cfg = join(spaced, "config.json");
        writeFileSync(cfg, JSON.stringify(configOf()));
        const out = spawnSync(process.execPath, [TOOL, "--config", cfg, "--repo-root", REPO, "--render"], { encoding: "utf8" });
        assert.equal(out.status, 0, out.stderr);
        assert.ok(out.stdout.includes("resourceMetrics"), `ran nothing: ${JSON.stringify(out.stdout.slice(0, 200))}`);
    }));

test("the tool spawns nothing except on the --export consent check", () => {
    // `--render` and `--check` are what a verify recipe runs, and they must be answerable on a machine
    // with no git, no token and no network. The one spawn site is the committed-consent check, which
    // only the export arm reaches — the shape `goldens.test.mjs` asserts for its own corpus.
    const source = readFileSync(TOOL, "utf8");
    // `spawnSync` is INJECTED as a default parameter rather than called directly, so counting call
    // sites finds none. What the property actually is: the symbol enters this module once, and is
    // handed to exactly one function. Counting `spawnSync(` would have asserted zero and passed for
    // the wrong reason — an assertion that holds for a reason other than its subject keeps passing
    // after the code it names is deleted.
    assert.equal((source.match(/from "node:child_process"/g) ?? []).length, 1, "child_process is imported once");
    assert.equal((source.match(/spawn = spawnSync/g) ?? []).length, 1, "exactly one injection point, and it is the consent check");
    assert.equal((source.match(/\bfetch\(/g) ?? []).length, 1, "exactly one fetch site, and it is postJson");
});

test("serialize is the one place bytes are made, so the golden and the wire agree", () => {
    assert.equal(serialize({ a: 1 }), '{\n  "a": 1\n}\n');
});
