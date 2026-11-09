// On-demand provider counts preserve the measured corpus and remain outside offline verification.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { alwaysTier, countAlways, countLine, ContextError, run } from "./context.mjs";
import { run as doctor } from "./doctor.mjs";
import { auditRecipeSource, auditRecipes } from "./telemetry.mjs";

const made = [];
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
after(() => made.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));
const env = { ANTHROPIC_API_KEY: "fixture-secret" };
const model = "fixture-model";
const response = (input_tokens = 20) => new Response(JSON.stringify({ input_tokens }), { status: 200 });
function project(extra = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-count-project-"));
    made.push(root);
    const files = {
        ".portulan/workspace.json": JSON.stringify({ portulan: { spec: "2.0" }, name: "fixture", kind: "repository", tree: "../", slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md" }, verify: { default: "check", recipes: [{ id: "check", run: "./verify.sh" }] } }),
        ".portulan/identity.md": "# Fixture\n", ".portulan/principles.md": "# Principles\n", ".portulan/gate-map.md": "# Gates\n", ".portulan/verify.sh": "#!/bin/sh\nexit 0\n",
        "CLAUDE.md": "# Instructions\n\n@shared.md\n", "shared.md": "Retain the decision's reason.\n",
        ".claude/rules/always.md": "# Always\n\nUse the local verification recipe.\n",
        ".claude/rules/scoped.md": "---\npaths: [api/**]\n---\nLATER_RULE_BODY\n",
        ".claude/skills/review/SKILL.md": "---\nname: review\ndescription: Review a fixture.\n---\nLATER_SKILL_BODY\n",
        ".claude/commands/check.md": "---\ndescription: Check the fixture.\n---\nLATER_COMMAND_BODY\n",
        ".claude/agents/reviewer.md": "---\nname: reviewer\ndescription: Inspect a fixture.\n---\nLATER_AGENT_BODY\n",
        ".claude/skills/private/SKILL.md": "---\nname: private\ndescription: UNLISTED_DESCRIPTION\ndisable-model-invocation: true\n---\nUNLISTED_BODY\n",
        ...extra,
    };
    for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); }
    return { root, workspace: path.join(root, ".portulan") };
}

test("provider receives precisely the measured strings, including descriptions without their bodies", async () => {
    const { root, workspace } = project();
    let calls = 0;
    const result = await countAlways(workspace, { model, env, fetch: async (url, options) => {
        calls++;
        assert.equal(url, "https://api.anthropic.com/v1/messages/count_tokens");
        assert.equal(options.redirect, "error");
        assert.equal(options.method, "POST");
        assert.equal(options.headers["Content-Type"], "application/json");
        assert.equal(options.headers.Authorization, "Bearer fixture-secret");
        assert.equal(options.headers["anthropic-version"], "2026-10-21");
        const body = JSON.parse(options.body);
        assert.equal(body.model, model);
        assert.deepEqual(Object.keys(body).sort(), ["messages", "model"]);
        const texts = body.messages[0].content.map((block) => block.text);
        assert.ok(texts.includes("Review a fixture.") && texts.includes("Check the fixture.") && texts.includes("Inspect a fixture."));
        assert.equal(texts.some((text) => /LATER_|UNLISTED_/.test(text)), false);
        assert.deepEqual(texts, alwaysTier(root, { includeText: true }).entries.filter((entry) => entry.bytes).map((entry) => entry.text));
        assert.equal(texts.reduce((sum, text) => sum + Buffer.byteLength(text), 0), alwaysTier(root).entries.reduce((sum, entry) => sum + entry.bytes, 0));
        return response();
    } });
    assert.equal(calls, 1);
    assert.equal(result.tokens, 20);
    assert.equal(result.ratio, result.bytes / 20);
    assert.match(countLine(result), /provider estimate/);
    assert.match(countLine(result), /fixture-model/);
    assert.doesNotMatch(countLine(result), /fixture-secret/);
});

test("default and static doctor never count, while explicit doctor and context modes use injected transport", async () => {
    const { workspace } = project();
    let calls = 0;
    const countOptions = { env, fetch: async () => { calls++; return response(); } };
    assert.equal(await doctor(["--static", workspace], { quiet: true, countOptions }), 0);
    assert.equal(calls, 0);
    assert.equal(await doctor(["--static", "--count-tokens", model, workspace], { quiet: true, countOptions }), 2);
    assert.equal(calls, 0);
    assert.equal(await doctor(["--count-tokens", model, workspace], { quiet: true, countOptions }), 0);
    assert.equal(calls, 1);
    const lines = [];
    assert.equal(await run(["--workspace", workspace, "--count-tokens", model], (line) => lines.push(line), { countOptions }), 0);
    assert.equal(calls, 2);
    assert.match(lines.join("\n"), /provider estimate/);
    assert.equal(await run(["--workspace", workspace, "--brief", "--count-tokens", model], () => {}, { countOptions }), 2);
    assert.equal(calls, 2);
});

test("no-call failures cover model, key, CI, unmeasured roots, invalid UTF-8 and unresolved imports", async () => {
    const { workspace, root } = project();
    let calls = 0;
    const fetch = async () => { calls++; return response(); };
    for (const options of [{ model: "" }, { env: {} }, { env: { ...env, CI: "true" } }]) {
        await assert.rejects(countAlways(workspace, { model, env, fetch, ...options }), ContextError);
        assert.equal(calls, 0);
    }
    const manifestFile = path.join(workspace, "workspace.json");
    const original = fs.readFileSync(manifestFile);
    const manifest = JSON.parse(original); delete manifest.tree;
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));
    await assert.rejects(countAlways(workspace, { model, env, fetch }), /tree|repository/);
    assert.equal(calls, 0);
    fs.writeFileSync(manifestFile, original);
    fs.writeFileSync(path.join(root, "shared.md"), Buffer.from([0xff]));
    await assert.rejects(countAlways(workspace, { model, env, fetch }), /UTF-8/);
    assert.equal(calls, 0);
    fs.writeFileSync(path.join(root, "shared.md"), "@missing.md\n");
    await assert.rejects(countAlways(workspace, { model, env, fetch }), /import/);
    assert.equal(calls, 0);
});

test("empty measured corpus makes no provider request and offers no ratio", async () => {
    const { root, workspace } = project();
    fs.rmSync(path.join(root, "CLAUDE.md")); fs.rmSync(path.join(root, ".claude"), { recursive: true });
    let calls = 0;
    const result = await countAlways(workspace, { model, env: {}, fetch: async () => { calls++; return response(); } });
    assert.equal(calls, 0);
    assert.equal(result.bytes, 0); assert.equal(result.tokens, null); assert.equal(result.ratio, null);
    assert.match(countLine(result), /empty.*no request/);
});

test("BOM, Unicode, CRLF and imports of scoped rules keep their measured representation", async () => {
    const { root, workspace } = project({
        "CLAUDE.md": "\uFEFF# Bees 🐝\r\n\r\n@shared.md\r\n",
        ".claude/rules/scoped.md": "---\npaths: [api/**]\n---\nLATER_RULE_BODY\n\n@scoped-shared.md\n",
        ".claude/rules/scoped-shared.md": "# Shared\n\nAn always import.\n",
        "CLAUDE.local.md": "PERSONAL_CONTENT_NOT_SENT",
    });
    const before = fs.readFileSync(path.join(workspace, "workspace.json"));
    await countAlways(workspace, { model, env, fetch: async (_url, options) => {
        const text = JSON.parse(options.body).messages[0].content.map((block) => block.text).join("");
        assert.match(text, /\uFEFF# Bees 🐝\r\n/);
        assert.match(text, /An always import/);
        assert.doesNotMatch(text, /LATER_RULE_BODY|PERSONAL_CONTENT_NOT_SENT/);
        return response();
    } });
    assert.deepEqual(fs.readFileSync(path.join(workspace, "workspace.json")), before);
    assert.equal(alwaysTier(root).entries.some((entry) => Object.hasOwn(entry, "text")), false);
});

test("tiny corpus ratios are reported without inventing a declarable ratio or host calibration", async () => {
    const { workspace } = project();
    const result = await countAlways(workspace, { model, env, fetch: async () => response(1_000_000) });
    assert.match(countLine(result), /below the manifest's minimum; not declarable/);
    assert.doesNotMatch(countLine(result), /calibrated_by|true count|exact count/);
});

test("invalid doctor inputs and invalid workspaces cannot open transport", async () => {
    const { workspace } = project();
    let calls = 0;
    const options = { quiet: true, countOptions: { env, fetch: async () => { calls++; return response(); } } };
    for (const args of [["--count-tokens"], ["--count-tokens", model, "--count-tokens", model, workspace], ["--count-tokens", "bad model", workspace]]) {
        assert.equal(await doctor(args, options), 2);
        assert.equal(calls, 0);
    }
    fs.rmSync(path.join(workspace, "identity.md"));
    assert.equal(await doctor(["--count-tokens", model, workspace], options), 1);
    assert.equal(calls, 0);
});

test("transport and malformed counts fail with sanitized diagnostics", async () => {
    const { workspace } = project();
    for (const count of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "20", null]) {
        await assert.rejects(countAlways(workspace, { model, env, fetch: async () => response(count) }), /token count|input_tokens/);
    }
    for (const fetch of [async () => { throw new Error("fixture-secret LATER_SKILL_BODY"); }, async () => new Response("fixture-secret", { status: 403 }), async () => new Response("fixture-secret", { status: 200 }), async () => ({ ok: true, redirected: true, json: async () => ({ input_tokens: 20 }) })]) {
        await assert.rejects(countAlways(workspace, { model, env, fetch }), (error) => error instanceof ContextError && !/fixture-secret|LATER_SKILL_BODY/.test(error.message));
    }
});

test("timeout covers both request and stalled response-body consumption", async () => {
    const { workspace } = project();
    for (const stalledBody of [false, true]) {
        let signal;
        const fetch = async (_url, options) => { signal = options.signal; return stalledBody ? { ok: true, json: () => new Promise(() => {}) } : new Promise(() => {}); };
        await assert.rejects(countAlways(workspace, { model, env, fetch, timeoutMs: 15 }), /timed out/);
        assert.equal(signal.aborted, true);
    }
});

test("offline audit catches provider mode through direct, dispatcher and bare spellings", () => {
    for (const invocation of ["node cli/doctor.mjs", "node cli/portulan.mjs doctor", "portulan doctor", "npx @sleepy_panda_srl/portulan doctor", "npx @sleepy_panda_srl/portulan@0.3.0 doctor", "node cli/context.mjs"]) {
        const source = `${invocation} --static fixture; ${invocation} --count-tokens fixture-model fixture`;
        assert.ok(auditRecipeSource(source).some((hit) => hit.flag === "--count-tokens"), invocation);
    }
});

test("continued dispatcher commands cannot evade the offline audit", () => {
    for (const invocation of ["node cli/portulan.mjs", "portulan", "npx @sleepy_panda_srl/portulan@0.3.0"]) {
        for (const ending of ["\n", "\r\n"]) {
            const source = `${invocation} \\${ending} doctor --count-tokens fixture-model fixture`;
            assert.ok(auditRecipeSource(source).some((hit) => hit.flag === "--count-tokens"), source);
        }
    }
});

test("escaped newlines inside module, subcommand and flag tokens are joined", () => {
    for (const source of [
        "node cli/doc\\\ntor.mjs --count-tokens fixture-model fixture",
        "node cli/portulan.mjs doc\\\ntor --count-tokens fixture-model fixture",
        "portulan doc\\\ntor --count-tokens fixture-model fixture",
        "npx @sleepy_panda_srl/portulan@0.3.0 doc\\\ntor --count-tokens fixture-model fixture",
        "node cli/context.mjs --count-\\\ntokens fixture-model --workspace fixture",
    ]) assert.ok(auditRecipeSource(source).some((hit) => hit.flag === "--count-tokens"), source);
});

test("unsupported and missing workspace kinds cannot open transport", async () => {
    const { workspace } = project();
    const file = path.join(workspace, "workspace.json");
    const original = fs.readFileSync(file);
    let calls = 0;
    const fetch = async () => { calls++; return response(); };
    for (const kind of [undefined, null, "unknown-kind", "pointer", 7]) {
        const manifest = JSON.parse(original);
        if (kind === undefined) delete manifest.kind; else manifest.kind = kind;
        fs.writeFileSync(file, JSON.stringify(manifest));
        await assert.rejects(countAlways(workspace, { model, env, fetch }), ContextError);
        assert.equal(calls, 0);
    }
});

test("source excerpts stay out of count-mode diagnostics", async () => {
    const { workspace } = project();
    const file = path.join(workspace, "workspace.json");
    const original = fs.readFileSync(file);
    let calls = 0;
    const fetch = async () => { calls++; return response(); };
    for (const text of ['SOURCE_SENTINEL', '{"tree":"../", "kind":"repository", "SOURCE_SENTINEL"', JSON.stringify({ ...JSON.parse(original), tree: null }), JSON.stringify({ ...JSON.parse(original), context: { ratio: { bytes_per_token: "SOURCE_SENTINEL", calibrated_by: "claude-code" } } })]) {
        fs.writeFileSync(file, text);
        const lines = [];
        assert.equal(await run(["--workspace", workspace, "--count-tokens", model], (line) => lines.push(line), { countOptions: { env, fetch } }), 2);
        assert.doesNotMatch(lines.join("\n"), /SOURCE_SENTINEL/);
        assert.match(lines.join("\n"), /manifest|context|tree/);
        assert.equal(calls, 0);
    }
});

test("doctor count mode keeps parser and validator source values out of output", () => {
    const { workspace } = project();
    const file = path.join(workspace, "workspace.json");
    const original = JSON.parse(fs.readFileSync(file));
    for (const content of ["SOURCE_SENTINEL", JSON.stringify({ ...original, portulan: { spec: "SOURCE_SENTINEL" } })]) {
        fs.writeFileSync(file, content);
        const result = spawnSync(process.execPath, [fileURLToPath(new URL("./doctor.mjs", import.meta.url)), "--count-tokens", model, workspace], { encoding: "utf8" });
        assert.ok([1, 2].includes(result.status));
        assert.doesNotMatch(result.stdout + result.stderr, /SOURCE_SENTINEL/);
    }
});

test("offline audit detects both a manifest invocation and a referenced shell invocation", () => {
    const { root, workspace } = project();
    fs.mkdirSync(path.join(root, "cli")); fs.writeFileSync(path.join(root, "cli/doctor.mjs"), "");
    const manifestFile = path.join(workspace, "workspace.json"); const manifest = JSON.parse(fs.readFileSync(manifestFile));
    for (const shell of [false, true]) {
        const unsafe = "node cli/doctor.mjs --static fixture; node cli/doctor.mjs --count-tokens fixture-model fixture";
        manifest.verify.recipes[0].run = shell ? "./verify.sh" : unsafe;
        fs.writeFileSync(manifestFile, JSON.stringify(manifest));
        fs.writeFileSync(path.join(root, "verify.sh"), `#!/bin/sh\n${unsafe}\n`);
        const audited = auditRecipes({ workspaceDir: workspace, repoRoot: root });
        assert.equal(audited.ok, true);
        assert.ok(audited.findings.some((hit) => hit.flag === "--count-tokens"));
    }
});
