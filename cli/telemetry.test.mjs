// Tests for the OTel emitter: its consent gate, closed payload, offline audit and transport.

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

// Hermetic: the offline audit reaches recipe-set.mjs, which reads the host's installed-plugin record.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

import {
    CONFIG_SPEC,
    EMITTED_ATTRIBUTE_KEYS,
    REQUIRED_ATTRIBUTE_KEYS,
    NETWORK_MODES,
    PATH_OPTIONS,
    pinPaths,
    PRODUCERS,
    anyValue,
    auditRecipeSource,
    auditRecipes,
    consentIsCommitted,
    renderPayload,
    safeEndpoint,
    serialize,
    stripShellComments,
    transportFromEnv,
    validateConfig,
    run,
} from "./telemetry.mjs";

const TOOL = fileURLToPath(new URL("./telemetry.mjs", import.meta.url));
const REPO = fileURLToPath(new URL("..", import.meta.url));

// Awaited, or `finally` removes the directory while an async body still uses it.
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
    const res = consentIsCommitted("evals/telemetry/nope.json", REPO, (_c, args) => (args.includes("rev-parse") ? { status: 0, stdout: ".git\n", stderr: "" } : { status: 1, stdout: "", stderr: "" }));
    assert.equal(res.ok, false);
    assert.ok(res.why.includes("not tracked by git"), res.why);
});

test("a config that DIFFERS from HEAD is not consent — against a REAL repository", () =>
    withTemp(async (dir) => {
        const repo = await committedConsent(dir, false);
        const cfg = join(repo, "evals/telemetry/config.json");
        writeFileSync(cfg, `${readFileSync(cfg, "utf8")}\n`);
        const res = consentIsCommitted(cfg, repo);
        assert.equal(res.ok, false);
        assert.ok(res.why.includes("differs from HEAD"), res.why);
    }));

test("a config identical to HEAD in a REAL repository IS consent", () =>
    withTemp(async (dir) => {
        const repo = await committedConsent(dir, true);
        assert.deepEqual(consentIsCommitted(join(repo, "evals/telemetry/config.json"), repo), { ok: true });
    }));

test("the path handed to git is POSIX-separated, whatever the platform", () =>
    withTemp((dir) => {
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
        writeFileSync(join(dir, "config.json"), "{}");
        const res = consentIsCommitted(join(dir, "config.json"), dir);
        assert.equal(res.ok, false);
        assert.ok(/not a (git )?repository/i.test(res.why), res.why);
        assert.ok(!res.why.includes("is not tracked by git"), `git failing must not be reported as untracked: ${res.why}`);
    }));

test("a genuinely untracked file in a REAL repository still reports `untracked`", () =>
    withTemp((dir) => {
        spawnSync("git", ["-C", dir, "init", "-q"], { encoding: "utf8" });
        writeFileSync(join(dir, "config.json"), "{}");
        const res = consentIsCommitted(join(dir, "config.json"), dir);
        assert.equal(res.ok, false);
        assert.ok(res.why.includes("is not tracked by git"), res.why);
    }));

test("a config whose NAME begins with `..` is inside the repository, not outside it", () =>
    withTemp((dir) => {
        const cfg = join(dir, "..telemetry.json");
        writeFileSync(cfg, "same\n");
        const spawn = (_c, args) => (args.includes("rev-parse") ? { status: 0, stdout: ".git\n", stderr: "" } : args.includes("ls-files") ? { status: 0, stdout: "", stderr: "" } : { status: 0, stdout: "same\n", stderr: "" });
        assert.deepEqual(consentIsCommitted(cfg, dir, spawn), { ok: true });
    }));

test("--audit-recipes pins the workspace directory with --repo-root, not the cwd", () => {
    const res = auditRecipes({ workspaceDir: ".portulan", repoRoot: REPO, packRoots: [join(REPO, "packs")] });
    assert.equal(res.ok, true, res.why);
    assert.ok(res.examined.length > 1);
});

test("a MALFORMED snapshot is refused, never rendered with defaulted metadata", async () =>
    withTemp(async (dir) => {
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
    const unemitted = REQUIRED_ATTRIBUTE_KEYS.filter((k) => !keys.has(k));
    assert.deepEqual(unemitted, [], `the pin names required keys nothing emits: ${unemitted.join(", ")}`);
});

test("a config with NO service.namespace is valid, and its payload is still within the closed list", () => {
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
    assert.ok(payload.resourceMetrics[0].scopeMetrics[0].metrics[0].gauge, "the point type is Gauge");
    assert.equal(dp.startTimeUnixNano, undefined, "a Gauge owes no start instant");
});

test("the OTLP AnyValue map encodes each scalar kind, and refuses what it has no encoding for", () => {
    assert.deepEqual(anyValue("x"), { stringValue: "x" });
    assert.deepEqual(anyValue(true), { boolValue: true });
    assert.deepEqual(anyValue(3), { intValue: "3" });
    assert.deepEqual(anyValue(1.5), { doubleValue: 1.5 });
    assert.deepEqual(anyValue(Number.MAX_SAFE_INTEGER), { intValue: "9007199254740991" });
    assert.deepEqual(anyValue(2 ** 53), { doubleValue: 2 ** 53 });
    assert.throws(() => anyValue(Number.NaN), /no OTLP encoding/);
    assert.throws(() => anyValue({}), /no OTLP encoding/);
});

// -------------------------------------------- the producer seam, against a producer we did not ship

test("the emitter honours a producer document it did not ship", () => {
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
    const source = ["# Refreshing is `node cli/review-meter.mjs --fetch`, run by a person.", "node cli/review-meter.mjs --snapshot s.json --check"].join("\n");
    assert.deepEqual(auditRecipeSource(source), []);
});

test("an invocation spread across CONTINUED lines is caught", () => {
    const source = ["node cli/telemetry.mjs \\", "    --config evals/telemetry/config.json \\", "    --export"].join("\n");
    const hits = auditRecipeSource(source);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].flag, "--export");
});

test("the module WITHOUT its network flag is not a finding", () => {
    assert.deepEqual(auditRecipeSource("node cli/review-meter.mjs --snapshot s.json --check"), []);
});

test("a network mode is caught however its PATH is spelled", () => {
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
    assert.deepEqual(auditRecipeSource("node cli/telemetry.mjs --exporter foo"), []);
});

test("a recipe whose script resolves OUTSIDE the tree is could-not-run, never a pass", () =>
    withTemp((dir) => {
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
    assert.equal(auditRecipeSource("node cli/feedback.mjs send report.md --approve").length, 1);
    assert.equal(auditRecipeSource("node ./cli/feedback.mjs send report.md --approve").length, 1);
    assert.deepEqual(auditRecipeSource("node cli/feedback.mjs preview report.md"), []);
});

test("every module in cli/ that can reach the network has a row in NETWORK_MODES", () => {
    // A limit: a module reaching the network other than by `fetch` or `gh` is not derived.
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
        mkdirSync(join(dir, ".portulan"), { recursive: true });
        writeFileSync(join(dir, ".portulan", "workspace.json"), JSON.stringify({ portulan: { spec: "2.8" }, name: "empty", kind: "repository", tree: "../", slots: {}, verify: { default: "none", recipes: [] } }));
        const res = auditRecipes({ workspaceDir: join(dir, ".portulan"), repoRoot: dir });
        assert.equal(res.ok, false);
        // Either refusal counts: `recipeSet`'s own, or this module's empty-set guard behind it.
        assert.ok(/no verify recipes|yielded NO recipes/.test(res.why), res.why);
    }));

test("an unreadable workspace manifest is could-not-run, never an audit that found nothing", () =>
    withTemp((dir) => {
        const res = auditRecipes({ workspaceDir: join(dir, "nowhere"), repoRoot: dir });
        assert.equal(res.ok, false);
        assert.ok(res.why.includes("could not be read"), res.why);
    }));

test("--pack-root is pinned by --repo-root too, so the answer does not move with the cwd", () => {
    const relative = auditRecipes({ workspaceDir: ".portulan", repoRoot: REPO, packRoots: ["packs"] });
    const absolute = auditRecipes({ workspaceDir: join(REPO, ".portulan"), repoRoot: REPO, packRoots: [join(REPO, "packs")] });
    assert.equal(relative.ok, true, relative.why);
    assert.deepEqual(relative.examined, absolute.examined, "the relative and absolute spellings must yield the same set");
    assert.ok(relative.examined.some((id) => id.includes(":")), "the composed pack's recipe must be in it — otherwise the pack root resolved to nothing and this case proves nothing");
});

test("the --export help text names every transport variable the code actually reads", () => {
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
        assert.equal(code, 2);
        assert.equal(seen.length, 0, "nothing may be sent on an uncommitted consent");
        assert.ok(r.stderr().includes("outside the repository"), r.stderr());
        assert.ok(!r.stderr().includes("SECRET"), "a header value must never be printed");
    }));

test("with the consent COMMITTED, --export sends the serializer's exact bytes", async () =>
    withTemp(async (dir) => {
        // `post` is injected: `tests.sh` runs this suite, and a verify recipe may not reach the network.
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
        assert.ok(r.stdout().includes("http://localhost:4318/v1/metrics"), "the endpoint's origin and path ARE printed — that is the point of printing it");
    }));

test("an EDITED consent refuses even where the file is tracked", async () =>
    withTemp(async (dir) => {
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
        writeFileSync(cfg, JSON.stringify(configOf({ enabled: true })));

        const r = recorder();
        const code = await run(["--config", cfg, "--repo-root", dir, "--export"], r.io, {
            env: { OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318" },
            post: () => assert.fail("an edited consent may send nothing"),
        });
        assert.equal(code, 2);
        assert.ok(r.stderr().includes("differs from HEAD"), r.stderr());
    }));

test("a logged endpoint carries no credentials and no query", () => {
    assert.equal(safeEndpoint("https://u:p@collector.example/v1/metrics?token=abc#frag"), "https://collector.example/v1/metrics");
    assert.equal(safeEndpoint("http://localhost:4318/v1/metrics"), "http://localhost:4318/v1/metrics");
    assert.equal(safeEndpoint("not a url"), "<withheld: not a parsable URL>");
});

test("the not-a-URL refusal names the variable and never the value", () => {
    const why = transportFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "h ttp://user:hunter2@host?token=SECRET" }).why;
    assert.ok(why.includes("OTEL_EXPORTER_OTLP_ENDPOINT"), why);
    for (const secret of ["hunter2", "SECRET", "user"]) {
        assert.ok(!why.includes(secret), `the refusal echoed part of the endpoint: ${why}`);
    }
});

test("a successful export logs no credential from the endpoint", async () =>
    withTemp(async (dir) => {
        const repo = await committedConsent(dir, true);
        const r = recorder();
        const code = await run(["--config", join(repo, "evals/telemetry/config.json"), "--repo-root", repo, "--export"], r.io, {
            env: { OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: "https://tenant:hunter2@collector.example/v1/metrics?apikey=SECRET" },
            post: async () => ({ ok: true, status: 200, text: "" }),
        });
        assert.equal(code, 0, r.stderr());
        const all = `${r.stdout()}\n${r.stderr()}`;
        for (const secret of ["hunter2", "SECRET", "apikey"]) {
            assert.ok(!all.includes(secret), `a secret reached the log: ${secret}`);
        }
        assert.ok(all.includes("https://collector.example/v1/metrics"), "the origin and path are still reported");
    }));

test("a collector answering non-2xx is a verdict, and the send really happened", async () =>
    withTemp(async (dir) => {
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

test("every path option is pinned by --repo-root, in one operation", () => {
    const pinned = pinPaths({ repoRoot: REPO, config: "a.json", check: "b.json", write: "c.json", workspace: ".portulan", packRoots: ["packs"] });
    for (const key of PATH_OPTIONS) {
        assert.ok(pinned[key].startsWith(REPO), `${key} was not pinned: ${pinned[key]}`);
    }
    assert.ok(pinned.packRoots[0].startsWith(REPO), "pack roots are pinned too");
    assert.equal(pinPaths({ repoRoot: REPO, config: "/abs/x.json", check: null, write: null, workspace: ".portulan", packRoots: [] }).config, "/abs/x.json");
});

test("no path-taking option escapes PATH_OPTIONS — derived from the parser, not remembered", () => {
    const source = readFileSync(TOOL, "utf8");
    const flags = [...source.matchAll(/a === "--([a-z-]+)"\) opts\.([A-Za-z]+)(?:\.push)? ?(?:=|\() ?next\(\)/g)].map((m) => ({ flag: m[1], key: m[2] }));
    assert.ok(flags.length >= 4, `expected several value-taking flags, found ${flags.length}`);
    const pathish = flags.filter((f) => /config|check|write|workspace|root|file|path|out/.test(f.flag));
    assert.ok(flags.some((f) => f.flag === "pack-root"), "the derivation must see --pack-root, which is written as a .push()");
    // `packRoots`, an array, is pinned by `pinPaths` itself rather than through PATH_OPTIONS.
    const unpinned = pathish.filter((f) => f.key !== "repoRoot" && f.key !== "packRoots" && !PATH_OPTIONS.includes(f.key));
    assert.deepEqual(unpinned.map((f) => f.flag), [], `path-taking flag(s) not in PATH_OPTIONS: ${unpinned.map((f) => f.flag).join(", ")}`);
});

test("two modes at once is refused rather than one silently winning", async () =>
    withTemp(async (dir) => {
        const cfg = join(dir, "config.json");
        writeFileSync(cfg, JSON.stringify(configOf()));
        const r = recorder();
        assert.equal(await run(["--config", cfg, "--render", "--export"], r.io, { env: {} }), 2);
        assert.ok(r.stderr().includes("pick one"), r.stderr());
    }));

test("the committed payload matches the committed snapshot and config", async () => {
    const r = recorder();
    assert.equal(
        await run(["--config", join(REPO, "evals/telemetry/config.json"), "--repo-root", REPO, "--check", join(REPO, "evals/telemetry/review-loop.otlp.json")], r.io, { env: {} }),
        0,
        r.stderr(),
    );
});

test("every carrier of the consent refusals names all three states", () => {
    const carriers = [
        "evals/README.md",
        "cli/telemetry.mjs",
        ".portulan/gate-map/gated.md",
        ".portulan/gates.json",
    ];
    for (const c of carriers) {
        const text = readFileSync(join(REPO, c), "utf8");
        assert.ok(/untracked/i.test(text), `${c} does not describe the consent refusals at all`);
        assert.ok(
            /absent from `?HEAD`?|staged and never committed/i.test(text),
            `${c} describes the consent refusals and omits the staged-but-uncommitted state`,
        );
    }
});

test("this workspace ships OPTED OUT", () => {
    const cfg = JSON.parse(readFileSync(join(REPO, "evals/telemetry/config.json"), "utf8"));
    assert.equal(cfg.enabled, false, "enabling emission is the maintainer's Gated act and shows up here");
});

// --------------------------------------------------------------------------------- the entry guard

test("the entry guard survives a path containing a SPACE — and here silence is the failure", () =>
    withTemp((dir) => {
        const spaced = join(dir, "a directory with spaces");
        mkdirSync(spaced);
        const cfg = join(spaced, "config.json");
        writeFileSync(cfg, JSON.stringify(configOf()));
        const out = spawnSync(process.execPath, [TOOL, "--config", cfg, "--repo-root", REPO, "--render"], { encoding: "utf8" });
        assert.equal(out.status, 0, out.stderr);
        assert.ok(out.stdout.includes("resourceMetrics"), `ran nothing: ${JSON.stringify(out.stdout.slice(0, 200))}`);
    }));

test("the tool spawns nothing except on the --export consent check", () => {
    const source = readFileSync(TOOL, "utf8");
    // `spawnSync` is never called by name, only passed as a default parameter, so that is what is counted.
    assert.equal((source.match(/from "node:child_process"/g) ?? []).length, 1, "child_process is imported once");
    assert.equal((source.match(/spawn = spawnSync/g) ?? []).length, 1, "exactly one injection point, and it is the consent check");
    assert.equal((source.match(/\bfetch\(/g) ?? []).length, 1, "exactly one fetch site, and it is postJson");
});

test("serialize is the one place bytes are made, so the golden and the wire agree", () => {
    assert.equal(serialize({ a: 1 }), '{\n  "a": 1\n}\n');
});
