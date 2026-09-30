#!/usr/bin/env node
// The OTel emitter: the review-loop figures as OTLP/HTTP JSON, sent only when a committed config opts in.
//
//   node cli/telemetry.mjs --config <file> [--repo-root <dir>] [--render | --check <file> | --write <file> | --export]
//   node cli/telemetry.mjs --audit-recipes [--workspace <dir>] [--repo-root <dir>] [--pack-root <dir>]...
//
// Exit 0 done · 1 a verdict (golden drift, export while opted out, a recipe reaching the network) · 2 could not run.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { meter, validateSnapshot } from "./review-meter.mjs";
import { VERSION } from "./manifest.mjs";
import { recipeSet, resolverFor } from "./recipe-set.mjs";
import { isInside } from "./inside.mjs";

// ---------------------------------------------------------------------------------------------
// The offline audit: no verify recipe may reach the network
// ---------------------------------------------------------------------------------------------

/** Every mode in cli/ that can reach the network; a new one is unrailed until it has a row here. */
export const NETWORK_MODES = Object.freeze([
    { module: "cli/review-meter.mjs", flag: "--fetch", what: "fetches review data from GitHub" },
    { module: "cli/telemetry.mjs", flag: "--export", what: "posts an OTLP payload to a collector" },
    { module: "cli/feedback.mjs", flag: "--approve", what: "files a GitHub issue with `gh issue create`" },
]);

/** Whole-line comments only: a trailing `#` may sit inside a quote. */
export const stripShellComments = (source) =>
    source
        .split("\n")
        .filter((line) => !/^\s*#/.test(line))
        .join("\n");

const shellTokens = (body) => body.split(/\s+/).map((t) => t.replace(/^[("'`]+/, "").replace(/[)"'`;]+$/, "")).filter(Boolean);

const tokenNamesModule = (token, module) => token === module || token.endsWith(`/${module}`);

const tokenIsFlag = (token, flag) => token === flag || token.startsWith(`${flag}=`);

export function auditRecipeSource(source) {
    const tokens = shellTokens(stripShellComments(source));
    return NETWORK_MODES.filter((m) => tokens.some((t) => tokenNamesModule(t, m.module)) && tokens.some((t) => tokenIsFlag(t, m.flag)));
}

export function auditRecipes({ workspaceDir, repoRoot, packRoots = [] }) {
    const workspace = path.resolve(repoRoot, workspaceDir);
    if (!isInside(path.resolve(repoRoot), workspace)) {
        return { ok: false, why: `the workspace at ${workspace} resolves outside the repository at ${repoRoot}; this audit grades the pinned tree and will not read past it` };
    }
    const roots = packRoots.map((r) => path.resolve(repoRoot, r));
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(workspace, "workspace.json"), "utf8"));
    } catch (cause) {
        return { ok: false, why: `the workspace manifest at ${workspace} could not be read — ${cause.message}` };
    }
    let set;
    try {
        set = recipeSet(manifest, { resolve: resolverFor({ workspaceDir: workspace, manifest, repoRoot, named: roots, discovery: null, forced: false }) });
    } catch (cause) {
        return { ok: false, why: cause.message };
    }
    if (!set.ok) return { ok: false, why: set.reason };
    const recipes = set.recipes ?? [];
    if (recipes.length === 0) {
        return { ok: false, why: "the workspace yielded NO recipes — an empty set makes this audit vacuously green, which is the one answer it may never give" };
    }

    const findings = [];
    const read = [];
    for (const r of recipes) {
        const script = String(r.run ?? "")
            .split(/\s+/)
            .find((t) => t.endsWith(".sh"));
        if (!script) {
            return { ok: false, why: `recipe ${JSON.stringify(r.id)} has no readable script in its run line (${JSON.stringify(r.run ?? null)}); this audit cannot grade what it cannot read` };
        }
        const file = path.resolve(repoRoot, script);
        if (!isInside(path.resolve(repoRoot), file)) {
            return { ok: false, why: `recipe ${JSON.stringify(r.id)} names ${script}, which resolves outside the repository at ${repoRoot}; this audit grades the tree and will not read past it` };
        }
        let source;
        try {
            source = fs.readFileSync(file, "utf8");
        } catch (cause) {
            return { ok: false, why: `recipe ${JSON.stringify(r.id)} names ${script}, which could not be read — ${cause.message}` };
        }
        read.push(r.id);
        for (const hit of auditRecipeSource(source)) findings.push({ recipe: r.id, script, ...hit });
    }
    return { ok: true, examined: read, findings };
}

// ---------------------------------------------------------------------------------------------
// The config — read, validated, and never guessed at
// ---------------------------------------------------------------------------------------------

/** The config document's own version, so a future shape change is a refusal rather than a misread. */
export const CONFIG_SPEC = "1";

/** The config's problems; empty means usable. */
export function validateConfig(config) {
    const problems = [];
    if (config === null || typeof config !== "object" || Array.isArray(config)) {
        return ["the config is not a JSON object"];
    }
    const spec = config.portulan?.telemetry;
    if (spec !== CONFIG_SPEC) {
        problems.push(`portulan.telemetry must be ${JSON.stringify(CONFIG_SPEC)}, not ${JSON.stringify(spec ?? null)}`);
    }
    if (typeof config.enabled !== "boolean") {
        problems.push(`enabled must be a boolean — absent is not false, because a gate you can reach by omission is not a gate (got ${JSON.stringify(config.enabled ?? null)})`);
    }
    if (typeof config.service?.name !== "string" || config.service.name.length === 0) {
        problems.push("service.name must be a non-empty string — it becomes the `service.name` resource attribute");
    }
    if (config.service?.namespace !== undefined && typeof config.service.namespace !== "string") {
        problems.push("service.namespace, where present, must be a string");
    }
    if (!Array.isArray(config.signals) || config.signals.length === 0) {
        problems.push("signals must be a non-empty array — an emitter with no signal is a tool that exits 0 having done nothing");
    } else {
        for (const s of config.signals) {
            if (!Object.prototype.hasOwnProperty.call(PRODUCERS, s)) {
                problems.push(`signals names ${JSON.stringify(s)}, which no producer answers to — known: ${Object.keys(PRODUCERS).join(", ")}`);
            }
        }
    }
    for (const banned of ["headers", "endpoint", "token", "apiKey", "api_key"]) {
        if (config[banned] !== undefined || config.exporter?.[banned] !== undefined) {
            problems.push(
                `${banned} may not be set in a committed config — transport and secrets come from the ` +
                    "OTEL_EXPORTER_OTLP_* environment, so a token never enters this repository",
            );
        }
    }
    return problems;
}

// ---------------------------------------------------------------------------------------------
// The producer registry — the closed payload, as code
// ---------------------------------------------------------------------------------------------

/** The payload's allow-list: a producer builds its rows from named figures and never spreads a snapshot into them. */
export const PRODUCERS = {
    "review-loop": {
        input: "evals/review-loop/snapshot.json",
        scope: "portulan/review-loop",
        /** OTLP's timeUnixNano is when a figure applies, so the capture stamp, which also keeps the golden byte-stable. */
        capturedAt: (snapshot) => snapshot.captured ?? null,
        validate: (snapshot) => validateSnapshot(snapshot),
        rows(snapshot) {
            const m = meter(snapshot);
            return [
                { name: "portulan.review.pull_requests", unit: "{pull_request}", description: "Merged pull requests in the metered window.", value: m.pullRequests },
                { name: "portulan.review.submissions", unit: "{submission}", description: "Reviews the reviewer submitted across the window. Submission units, never fix-rounds.", value: m.submissions },
                { name: "portulan.review.submissions_per_pull_request", unit: "1", description: "The figure a-review-loop-needs-a-bound.md bounds the loop on.", value: m.submissionsPerPullRequest },
                { name: "portulan.review.submissions_no_inline", unit: "{submission}", description: "Submissions raising no inline comment.", value: m.noInline },
                { name: "portulan.review.no_inline_rate", unit: "1", description: "An UPPER BOUND on the found-nothing rate; a submission carrying only suppressed notes counts in it.", value: m.noInlineRate },
                { name: "portulan.review.pushes", unit: "{push}", description: "Distinct heads the reviewer saw — a floor on pushes, not a count of them.", value: m.pushes },
                { name: "portulan.review.pushes_per_submission", unit: "1", description: "The criterion's literal pushes-per-round figure, in submission units.", value: m.pushesPerSubmission },
            ];
        },
        attributes: (snapshot) => ({
            "portulan.window.merged": snapshot.window?.merged ?? 0,
            "portulan.window.captured": snapshot.captured ?? "",
            "portulan.units": "submission",
        }),
        /** The payload's one identifier, the repository's; nothing naming a person, such as a login, may join it. */
        resource: (snapshot) => ({ "portulan.repository": snapshot.repository ?? "" }),
    },
};

/** Every attribute key a payload may carry; the suite fails a rendered key outside it. */
export const EMITTED_ATTRIBUTE_KEYS = Object.freeze([
    "service.name",
    "service.namespace",
    "telemetry.sdk.name",
    "telemetry.sdk.language",
    "telemetry.sdk.version",
    "portulan.repository",
    "portulan.window.merged",
    "portulan.window.captured",
    "portulan.units",
]);

export const REQUIRED_ATTRIBUTE_KEYS = Object.freeze(EMITTED_ATTRIBUTE_KEYS.filter((k) => k !== "service.namespace"));

// ---------------------------------------------------------------------------------------------
// OTLP/HTTP JSON — the wire shape, written by hand
// ---------------------------------------------------------------------------------------------

export function anyValue(v) {
    if (typeof v === "string") return { stringValue: v };
    if (typeof v === "boolean") return { boolValue: v };
    // Past 2^53 a number may not be the integer meant, so it goes out as a double rather than as a wrong int64.
    if (Number.isSafeInteger(v)) return { intValue: String(v) };
    if (typeof v === "number" && Number.isFinite(v)) return { doubleValue: v };
    throw new Error(`no OTLP encoding for ${JSON.stringify(v)}`);
}

const kv = (attrs) => Object.entries(attrs).map(([key, value]) => ({ key, value: anyValue(value) }));

/** Gauges, not Sums: a Sum owes a start time, and the snapshot records no window start. */
export function renderPayload({ config, signals, version = VERSION }) {
    const resource = { "service.name": config.service.name, "telemetry.sdk.name": "portulan", "telemetry.sdk.language": "nodejs", "telemetry.sdk.version": version };
    if (config.service.namespace !== undefined) resource["service.namespace"] = config.service.namespace;
    for (const s of signals) Object.assign(resource, s.resource ?? {});

    const scopeMetrics = [];
    for (const s of signals) {
        const timeUnixNano = String(BigInt(Date.parse(s.capturedAt)) * 1000000n);
        const attributes = kv(s.attributes);
        const metrics = s.rows
            .filter((r) => r.value !== null && Number.isFinite(r.value))
            .map((r) => ({
                name: r.name,
                unit: r.unit,
                description: r.description,
                gauge: { dataPoints: [{ timeUnixNano, attributes, ...(Number.isSafeInteger(r.value) ? { asInt: String(r.value) } : { asDouble: r.value }) }] },
            }));
        scopeMetrics.push({ scope: { name: s.scope, version }, metrics });
    }
    return { resourceMetrics: [{ resource: { attributes: kv(resource) }, scopeMetrics }] };
}

/** The bytes on the wire and in the golden are the same bytes, produced here and nowhere else. */
export const serialize = (payload) => `${JSON.stringify(payload, null, 2)}\n`;

// ---------------------------------------------------------------------------------------------
// Transport — the ONE mode that reaches the network
// ---------------------------------------------------------------------------------------------

/** A URL safe to print: origin and path, since userinfo and a query may carry credentials. */
export function safeEndpoint(href) {
    try {
        const u = new URL(href);
        u.username = "";
        u.password = "";
        u.search = "";
        u.hash = "";
        return u.href;
    } catch {
        return "<withheld: not a parsable URL>";
    }
}

/** Endpoint and headers only: the OTLP protocol, timeout, compression, certificate and client-key variables go unread. */
export function transportFromEnv(env) {
    const specific = env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
    const base = env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const named = typeof specific === "string" && specific.length > 0 ? "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT" : "OTEL_EXPORTER_OTLP_ENDPOINT";
    const raw = named === "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT" ? specific : base;
    if (typeof raw !== "string" || raw.length === 0) {
        return { ok: false, why: "neither OTEL_EXPORTER_OTLP_METRICS_ENDPOINT nor OTEL_EXPORTER_OTLP_ENDPOINT is set" };
    }
    let url;
    try {
        url = new URL(named === "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT" ? raw : raw.endsWith("/") ? `${raw}v1/metrics` : `${raw}/v1/metrics`);
    } catch {
        return { ok: false, why: `${named} is not a parsable URL — its value is withheld, since an endpoint may carry credentials` };
    }
    const headerSource = env.OTEL_EXPORTER_OTLP_METRICS_HEADERS ?? env.OTEL_EXPORTER_OTLP_HEADERS ?? "";
    const headers = { "content-type": "application/json" };
    for (const pair of headerSource.split(",")) {
        const at = pair.indexOf("=");
        if (at > 0) headers[pair.slice(0, at).trim().toLowerCase()] = pair.slice(at + 1).trim();
    }
    return { ok: true, url: url.href, headers, from: named };
}

/** The real send; the suite injects its own, since it runs inside a verify recipe, which may not reach the network. */
export async function postJson(url, headers, body) {
    const res = await fetch(url, { method: "POST", headers, body });
    return { status: res.status, ok: res.ok, text: await res.text().catch(() => "") };
}

/** Refuses a config that is untracked, staged and never committed, or changed since HEAD. */
export function consentIsCommitted(configPath, repoRoot, spawn = spawnSync) {
    const parent = path.resolve(repoRoot);
    const child = path.resolve(parent, configPath);
    if (!isInside(parent, child)) {
        return { ok: false, why: `${configPath} is outside the repository at ${repoRoot}, so nothing can establish that it is committed` };
    }
    // Git pathspecs and HEAD:<path> want forward slashes, whatever separator path.relative gives.
    const rel = path.relative(parent, child).split(path.sep).join("/");
    const git = (args) => spawn("git", ["-C", parent, ...args], { encoding: "utf8" });

    // Asked first, since `git show HEAD:<path>` also exits 128 for a path staged but never committed.
    const repo = git(["rev-parse", "--git-dir"]);
    if (repo.error) return { ok: false, why: `git could not be run to establish whether the consent is committed — ${repo.error.message}` };
    if (repo.status !== 0) {
        return { ok: false, why: `${parent} is not a git repository, so nothing there can be committed — ${(repo.stderr || "").trim() || "git rev-parse --git-dir failed"}` };
    }

    const tracked = git(["ls-files", "--error-unmatch", "--", rel]);
    if (tracked.error) return { ok: false, why: `git could not be run to establish whether the consent is committed — ${tracked.error.message}` };
    if (tracked.status !== 0) {
        return { ok: false, why: `${rel} is not tracked by git, so it is one working copy's opinion rather than the team's committed consent` };
    }

    const head = git(["show", `HEAD:${rel}`]);
    if (head.error) return { ok: false, why: `git could not read ${rel} at HEAD — ${head.error.message}` };
    if (head.status !== 0) {
        return { ok: false, why: `${rel} is tracked but does not exist at HEAD, so the consent it states has been staged and never committed` };
    }

    // `git diff`, not a byte compare: under core.autocrlf a committed file checks out as CRLF over an LF blob.
    const diff = git(["diff", "--quiet", "HEAD", "--", rel]);
    if (diff.error) return { ok: false, why: `git could not compare ${rel} against HEAD — ${diff.error.message}` };
    if (diff.status === 1) {
        return { ok: false, why: `${rel} differs from HEAD — an edited consent is not a committed one. Commit it, or run --render to see what WOULD be sent` };
    }
    if (diff.status !== 0) {
        return { ok: false, why: `git could not compare ${rel} against HEAD — it exited ${diff.status}: ${(diff.stderr || "").trim()}` };
    }
    return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// The command line
// ---------------------------------------------------------------------------------------------

const USAGE = [
    "usage: node cli/telemetry.mjs --config <file> [--repo-root <dir>] [--render | --check <file> | --write <file> | --export]",
    "",
    "  --config <file>   the committed opt-in config; the ONLY gate on emission",
    "  --render          print the OTLP/HTTP JSON payload and open no socket (the default)",
    "  --check <file>    byte-compare the payload against a committed golden",
    "  --write <file>    rewrite that golden",
    "  --export          the ONE mode that reaches the network; refuses unless the config opts in",
    "                    AND is committed. Transport comes from the OTLP environment, signal-specific",
    "                    first: OTEL_EXPORTER_OTLP_METRICS_ENDPOINT (used as given) else",
    "                    OTEL_EXPORTER_OTLP_ENDPOINT (a base, +/v1/metrics); and",
    "                    OTEL_EXPORTER_OTLP_METRICS_HEADERS replacing OTEL_EXPORTER_OTLP_HEADERS",
    "  --audit-recipes   assert that no recipe the workspace YIELDS can reach a network mode;",
    "                    takes --workspace and --pack-root, and needs no --config",
    "",
    "exit 0 the thing asked for happened · 1 a verdict (golden drift, or export while opted out)",
    "       · 2 could not run (config or snapshot missing, unreadable, or malformed)",
].join("\n");

export const PATH_OPTIONS = Object.freeze(["config", "check", "write", "workspace"]);

/** Resolves each path option against the repository root; an absolute one stays as given. */
export function pinPaths(opts) {
    const root = path.resolve(opts.repoRoot);
    const pinned = { ...opts, repoRoot: root, packRoots: opts.packRoots.map((r) => path.resolve(root, r)) };
    for (const key of PATH_OPTIONS) {
        if (typeof pinned[key] === "string" && pinned[key].length > 0) pinned[key] = path.resolve(root, pinned[key]);
    }
    return pinned;
}

function parseArgs(argv) {
    const opts = { config: null, repoRoot: ".", render: false, check: null, write: null, export: false, audit: false, workspace: ".portulan", packRoots: [], help: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        const next = () => {
            const v = argv[i + 1];
            if (v === undefined) throw new Error(`${a} needs a value`);
            i += 1;
            return v;
        };
        if (a === "--config") opts.config = next();
        else if (a === "--repo-root") opts.repoRoot = next();
        else if (a === "--render") opts.render = true;
        else if (a === "--check") opts.check = next();
        else if (a === "--write") opts.write = next();
        else if (a === "--export") opts.export = true;
        else if (a === "--audit-recipes") opts.audit = true;
        else if (a === "--workspace") opts.workspace = next();
        else if (a === "--pack-root") opts.packRoots.push(next());
        else if (a === "--help" || a === "-h") opts.help = true;
        else throw new Error(`unrecognised argument ${JSON.stringify(a)}`);
    }
    return opts;
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

export async function run(argv = process.argv.slice(2), io = console, { env = process.env, post = postJson } = {}) {
    let opts;
    try {
        opts = parseArgs(argv);
    } catch (e) {
        io.error(`telemetry: ${e.message}`);
        io.error(USAGE);
        return 2;
    }
    if (opts.help) {
        io.log(USAGE);
        return 0;
    }
    opts = pinPaths(opts);
    if (opts.audit) {
        const res = auditRecipes({ workspaceDir: opts.workspace, repoRoot: opts.repoRoot, packRoots: opts.packRoots });
        if (!res.ok) {
            io.error(`telemetry: the offline audit could not run — ${res.why}`);
            return 2;
        }
        if (res.findings.length > 0) {
            io.error(`telemetry: ${res.findings.length} verify recipe(s) can reach the network:`);
            for (const f of res.findings) io.error(`  - ${f.recipe} (${f.script}) invokes ${f.module} ${f.flag}, which ${f.what}`);
            io.error("A verify recipe may not make a network call: spec/slots.md and .portulan/verify/README.md");
            io.error("both prohibit it, because a rail that moves with the network goes red about the world");
            io.error("rather than about the tree.");
            return 1;
        }
        io.log(`telemetry: ${res.examined.length} yielded recipe(s) examined; none reaches a network mode`);
        io.log(`  Modes railed: ${NETWORK_MODES.map((m) => `${m.module} ${m.flag}`).join(", ")}.`);
        io.log("  A network mode with no row here is UNRAILED, and nothing can audit that a row was added.");
        return 0;
    }

    if (!opts.config) {
        io.error("telemetry: --config <file> is required — the committed config is the only gate on emission,");
        io.error("and a run that inferred one would be an emitter deciding its own consent.");
        return 2;
    }
    const modes = [opts.render, opts.check !== null, opts.write !== null, opts.export].filter(Boolean).length;
    if (modes > 1) {
        io.error("telemetry: --render, --check, --write and --export ask for different things; pick one");
        return 2;
    }

    // ---- the config
    const configPath = opts.config;
    let config;
    try {
        config = readJson(configPath);
    } catch (e) {
        io.error(`telemetry: cannot read ${configPath} — ${e.message}`);
        io.error("This is could-not-run, NOT opted out: a config that will not parse may well say `enabled: true`.");
        return 2;
    }
    const problems = validateConfig(config);
    if (problems.length > 0) {
        io.error(`telemetry: ${configPath} is not a usable opt-in config:`);
        for (const p of problems) io.error(`  - ${p}`);
        io.error("This is could-not-run, NOT opted out — a malformed config states no decision either way.");
        return 2;
    }

    // ---- the signals
    const signals = [];
    for (const name of config.signals) {
        const producer = PRODUCERS[name];
        const input = path.resolve(opts.repoRoot, producer.input);
        let snapshot;
        try {
            snapshot = readJson(input);
        } catch (e) {
            io.error(`telemetry: signal ${JSON.stringify(name)} cannot read its input ${input} — ${e.message}`);
            return 2;
        }
        const problems = producer.validate?.(snapshot) ?? [];
        if (problems.length > 0) {
            io.error(`telemetry: signal ${JSON.stringify(name)} cannot be metered from ${input}:`);
            for (const p of problems) io.error(`  - ${p}`);
            io.error("A malformed input would render a payload with defaulted metadata rather than none,");
            io.error("and the payload is the thing that leaves the machine.");
            return 2;
        }
        const capturedAt = producer.capturedAt(snapshot);
        if (typeof capturedAt !== "string" || Number.isNaN(Date.parse(capturedAt))) {
            io.error(`telemetry: signal ${JSON.stringify(name)} has no parsable capture stamp (${JSON.stringify(capturedAt)});`);
            io.error("OTLP needs the instant the measurement is ABOUT, and a clock read here would be a different figure.");
            return 2;
        }
        signals.push({ name, scope: producer.scope, capturedAt, rows: producer.rows(snapshot), attributes: producer.attributes(snapshot), resource: producer.resource?.(snapshot) ?? {} });
    }

    let body;
    try {
        body = serialize(renderPayload({ config, signals }));
    } catch (e) {
        io.error(`telemetry: the payload could not be encoded — ${e.message}`);
        return 2;
    }

    const emitted = signals.reduce((n, s) => n + s.rows.filter((r) => r.value !== null && Number.isFinite(r.value)).length, 0);

    // ---- --write
    if (opts.write !== null) {
        fs.mkdirSync(path.dirname(opts.write), { recursive: true });
        fs.writeFileSync(opts.write, body);
        io.log(`telemetry: wrote ${opts.write} — ${emitted} metric(s) over ${signals.length} signal(s)`);
        return 0;
    }

    // ---- --check
    if (opts.check !== null) {
        let onDisk;
        try {
            onDisk = fs.readFileSync(opts.check, "utf8");
        } catch (e) {
            io.error(`telemetry: cannot read ${opts.check} — ${e.message}`);
            io.error("The golden is generated; run with --write to create it.");
            return 2;
        }
        if (onDisk !== body) {
            io.error(`telemetry: ${opts.check} is out of date against the payload this config renders`);
            io.error("It is generated and byte-compared. Regenerate it with --write; do not edit it by hand.");
            return 1;
        }
        io.log(`telemetry: ${opts.check} is byte-identical to the rendered payload (${emitted} metric(s))`);
        return 0;
    }

    // ---- --export, the one mode that reaches the network
    if (opts.export) {
        // Never silent: an opted-out emitter and one that never started would look alike.
        if (config.enabled !== true) {
            io.error(`telemetry: ${configPath} says enabled: false, so nothing was sent.`);
            io.error("This is a verdict, not a failure: the config was read and it opts out. Emission is");
            io.error("the maintainer's Gated act — the committed config is the standing consent, and this");
            io.error("workspace has not given it. Use --render to see exactly what WOULD be sent.");
            return 1;
        }
        const committed = consentIsCommitted(configPath, opts.repoRoot);
        if (!committed.ok) {
            io.error(`telemetry: --export cannot run — ${committed.why}.`);
            io.error("The ruling of 2026-08-28 is that the COMMITTED config is the standing consent, so a");
            io.error("config that is not committed states nobody's decision. This is could-not-run, not a refusal.");
            return 2;
        }
        const t = transportFromEnv(env);
        if (!t.ok) {
            io.error(`telemetry: --export cannot run — ${t.why}.`);
            io.error("Transport comes from the OpenTelemetry standard environment; nothing is committed here.");
            return 2;
        }
        let res;
        try {
            res = await post(t.url, t.headers, body);
        } catch (e) {
            io.error(`telemetry: the export failed — ${e.message}`);
            io.error("Nothing is queued and nothing is retried: a queue that flushes itself later is a send");
            io.error("nobody attended, which is what the Gated tier exists to prevent.");
            return 2;
        }
        if (!res.ok) {
            io.error(`telemetry: the collector answered ${res.status}${res.text ? ` — ${res.text.slice(0, 200)}` : ""}`);
            return 1;
        }
        io.log(`telemetry: exported ${emitted} metric(s) to ${safeEndpoint(t.url)} — ${res.status}`);
        return 0;
    }

    // ---- --render, the default
    io.log(body);
    io.log(`telemetry: rendered ${emitted} metric(s) over ${signals.length} signal(s); nothing was sent.`);
    io.log(`  This workspace's config says enabled: ${config.enabled}. --export is the only mode that`);
    io.log("  reaches the network, and it refuses unless the committed config opts in.");
    io.log("  Every figure is a Gauge stamped with the instant it is ABOUT, not the instant it was sent;");
    io.log("  a stale snapshot therefore exports a stale timestamp, labelled as such rather than hidden.");
    return 0;
}

// As file URLs, since `import.meta.url` percent-encodes a space; through realpath too, for an npm `bin` symlink.
function isMain() {
    const invoked = process.argv[1];
    if (!invoked) return false;
    if (import.meta.url === pathToFileURL(invoked).href) return true;
    try {
        return import.meta.url === pathToFileURL(fs.realpathSync(invoked)).href;
    } catch {
        return false;
    }
}

// `process.exitCode` rather than `process.exit`, so a pipe that has not drained is not cut short.
if (isMain()) {
    run(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    });
}

