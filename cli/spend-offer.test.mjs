// Init spend offers.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { run } from "./init.mjs";
import { projectKey } from "./ledger.mjs";
import { PRICE_DATE, PRICE_SOURCE, PRICE_READS, spendOffer, managedPricingFile } from "./spend-offer.mjs";

const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const dirs = [];
process.on("exit", () => dirs.forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));
function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-offer-"));
    dirs.push(dir);
    return dir;
}
function fixture(model = "claude-opus-5-5", pricing = undefined) {
    const target = scratch();
    const host = scratch();
    const projects = path.join(host, "projects");
    const logs = path.join(projects, projectKey(target));
    fs.mkdirSync(logs, { recursive: true });
    const record = (m, at = "2026-11-09T10:00:00Z", extra = {}) => ({ type: "assistant", cwd: target, timestamp: at, message: { id: at, model: m, usage: { input_tokens: 1 } }, ...extra });
    const file = path.join(logs, "main.jsonl");
    fs.writeFileSync(file, model === null ? "" : JSON.stringify(record(model)) + "\n");
    const managedFile = path.join(host, "managed-settings.json");
    fs.writeFileSync(managedFile, JSON.stringify({ modelPricing: pricing }));
    const said = [], warned = [], asked = [];
    const options = { say: l => said.push(l), warn: l => warned.push(l), spendHost: { projects, managedFile }, env: { CLAUDE_CONFIG_DIR: host } };
    const manifest = () => JSON.parse(fs.readFileSync(path.join(target, ".portulan/workspace.json"), "utf8"));
    return { target, host, file, projects, managedFile, record, said, warned, asked, options, manifest };
}
const flags = ["--residence", "in-repo", "--no-cycle", "--no-interview"];
const rates = { input: 4, output: 20, cacheRead: 0.12, cacheWrite: 5.6 };

test("init offers host override, dated table and general figures without declaring them", async () => {
    for (const [model, pricing, expected, source] of [
        ["claude-opus-5-5", { multiplier: 0.5, overrides: { "claude-opus-5-5": rates } }, '"read":0.03', /file-based.*modelPricing/],
        ["claude-opus-5-5", undefined, '"read":0.05', /2026-11-09/],
        ["unknown-model", undefined, '"read":0.1', /general/],
        [null, undefined, '"read":0.1', /no recorded model/],
    ]) {
        const f = fixture(model, pricing);
        assert.equal(await run([...flags, f.target], f.options), 0, f.warned.join("\n"));
        const output = f.said.join("\n");
        assert.ok(output.includes(expected), output);
        assert.match(output, source);
        assert.match(output, /spend.horizon.*20/);
        assert.equal(f.manifest().spend, undefined);
        assert.equal(f.manifest().portulan.spec, "2.10");
    }
});

test("recorded main model beats configuration, later sidechains and foreign cwd", async () => {
    const f = fixture();
    fs.mkdirSync(path.join(f.target, ".claude"));
    fs.writeFileSync(path.join(f.target, ".claude/settings.json"), JSON.stringify({ model: "claude-sonnet-4-6", modelPricing: { overrides: { "claude-opus-5-5": rates } } }));
    fs.appendFileSync(f.file, [f.record("claude-sonnet-4-6", "2026-11-09T11:00:00Z", { isSidechain: true }), f.record("claude-sonnet-4-6", "2026-11-09T12:00:00Z", { cwd: f.target + "-other" }), f.record("<synthetic>", "2026-11-09T13:00:00Z")].map(JSON.stringify).join("\n") + "\n{torn");
    assert.equal(await run([...flags, f.target], f.options), 0);
    assert.match(f.said.join("\n"), /last recorded model.*claude-opus-5-5/);
    assert.ok(f.said.join("\n").includes('"read":0.05'));
});

test("a host-valid but spend-unrepresentable override falls through with a reason", async () => {
    const f = fixture("claude-opus-5-5", { overrides: { "claude-opus-5-5": { ...rates, cacheRead: 0 } } });
    assert.equal(await run([...flags, f.target], f.options), 0);
    assert.match(f.said.join("\n"), /unrepresentable/);
    assert.ok(f.said.join("\n").includes('"read":0.05'));
});

test("explicit flags declare either spend key at 2.12 and the flag outranks answers", async () => {
    for (const selected of [["--horizon", "3"], ["--multipliers", '{"read":0.04,"write":{"5m":1.3,"1h":2.1}}']]) {
        const f = fixture();
        assert.equal(await run([...flags, ...selected, f.target], f.options), 0, f.warned.join("\n"));
        assert.equal(f.manifest().portulan.spec, "2.12");
        assert.deepEqual(Object.keys(f.manifest().spend), [selected[0] === "--horizon" ? "horizon" : "multipliers"]);
    }
    const f = fixture();
    const answers = path.join(f.host, "answers.json");
    fs.writeFileSync(answers, JSON.stringify({ residence: "in-repo", cycle: false, horizon: "8", multipliers: JSON.stringify({ read: 0.03, write: { "5m": 1.4, "1h": 1.4 } }) }));
    assert.equal(await run(["--answers", answers, "--horizon", "4", f.target], f.options), 0);
    assert.deepEqual(f.manifest().spend, { multipliers: { read: 0.03, write: { "5m": 1.4, "1h": 1.4 } }, horizon: { requests: 4 } });
});

test("interactive offer accepts each key independently and EOF writes nothing", async () => {
    for (const replies of [["y", "3", "y"], ["n", "none", "y"], ["y"], ["n", "3", "y"]]) {
        const f = fixture("claude-opus-5-5", { overrides: { "claude-opus-5-5": rates } });
        const remaining = [...replies];
        const io = { interactive: true, say: l => f.said.push(l), ask: async q => { f.asked.push(q); return q.startsWith("Declare an always-tier budget?") ? "n" : remaining.shift() ?? null; } };
        const code = await run(["--residence", "in-repo", "--name", "demo", "--summary", "Demo", "--no-cycle", "--cache-lifetime", "5m", "--handoff-budget", "none", f.target], { ...f.options, io });
        if (replies.length === 1) {
            assert.equal(code, 2);
            assert.equal(fs.existsSync(path.join(f.target, ".portulan")), false);
        } else {
            assert.equal(code, 0, f.warned.join("\n"));
            assert.equal(f.manifest().context?.always, undefined);
            const s = f.manifest().spend;
            assert.equal(s?.multipliers?.read, replies[0] === "y" ? 0.03 : undefined);
            assert.equal(s?.horizon?.requests, replies[1] === "3" ? 3 : undefined);
        }
    }
});

test("invalid declarations and pointer spend options refuse before writing", async () => {
    for (const given of [["--horizon", "0"], ["--horizon", "1.5"], ["--horizon", "1e3"], ["--multipliers", "{}"], ["--multipliers", "null"], ["--multipliers", "{bad"]]) {
        const f = fixture();
        assert.equal(await run([...flags, ...given, f.target], f.options), 2, given.join(" "));
        assert.equal(fs.existsSync(path.join(f.target, ".portulan")), false);
    }
    const f = fixture();
    assert.equal(await run(["--residence", "pointer", "--governed-by", "other", "--horizon", "3", f.target], f.options), 2);
    assert.equal(fs.existsSync(path.join(f.target, ".portulan")), false);
});

test("the dated explicit table and snapshot normalization do not guess aliases", () => {
    assert.equal(PRICE_DATE, "2026-11-09");
    assert.equal(PRICE_SOURCE, "https://platform.claude.com/docs/en/about-claude/pricing");
    assert.equal(Object.keys(PRICE_READS).length, 21);
    for (const [model, read] of [["claude-fable-5-2", 0.025], ["claude-opus-5-5-20260922", 0.05], ["claude-sonnet-4-6", 0.1], ["opus", 0.1], ["claude-opus-5-5-custom", 0.1]]) {
        const f = fixture(model);
        const o = spendOffer(f.target, f.options.spendHost);
        assert.equal(o.multipliers.read, read);
        assert.deepEqual(o.multipliers.write, { "5m": 1.25, "1h": 2 });
        assert.match(o.source, model === "opus" || model.endsWith("custom") ? /general/ : /table/);
    }
    assert.equal(managedPricingFile("darwin"), "/Library/Application Support/ClaudeCode/managed-settings.json");
    assert.equal(managedPricingFile("linux"), "/etc/claude-code/managed-settings.json");
    assert.equal(managedPricingFile("win32"), "C:\\Program Files\\ClaudeCode\\managed-settings.json");
});

test("exact override precedes supported canonical match, including custom model IDs", () => {
    for (const exact of [true, false]) {
        const f = fixture("claude-opus-5-5-20260922", { overrides: { "claude-opus-5-5": rates, ...(exact ? { "claude-opus-5-5-20260922": { ...rates, cacheRead: 0.08 } } : {}) } });
        assert.equal(spendOffer(f.target, f.options.spendHost).multipliers.read, exact ? 0.02 : 0.03);
    }
    const f = fixture("gateway-model", { overrides: { "gateway-model": rates } });
    assert.equal(spendOffer(f.target, f.options.spendHost).multipliers.read, 0.03);
});

test("invalid or missing host rates, unreadable settings and drop-ins disclose fallback", () => {
    for (const row of [{ ...rates, output: undefined }, { ...rates, output: 10001 }, { ...rates, input: 0 }, { ...rates, cacheWrite: 1 }, { ...rates, cacheRead: 5 }, { ...rates, input: "4" }]) {
        const f = fixture("claude-opus-5-5", { overrides: { "claude-opus-5-5": row } });
        const o = spendOffer(f.target, f.options.spendHost);
        assert.equal(o.multipliers.read, 0.05);
        assert.match(o.reason, /invalid|unrepresentable/);
    }
    const f = fixture("claude-opus-5-5", { overrides: { "claude-opus-5-5": rates } });
    fs.mkdirSync(path.join(f.host, "managed-settings.d"));
    fs.writeFileSync(path.join(f.host, "managed-settings.d/10-pricing.json"), "{}");
    let o = spendOffer(f.target, f.options.spendHost);
    assert.equal(o.multipliers.read, 0.05);
    assert.match(o.reason, /drop-ins are not resolved/);
    fs.rmSync(path.join(f.host, "managed-settings.d"), { recursive: true });
    fs.writeFileSync(f.managedFile, "{broken");
    o = spendOffer(f.target, f.options.spendHost);
    assert.equal(o.multipliers.read, 0.05);
    assert.match(o.reason, /invalid JSON/);
});

test("ambiguous, missing and unreadable latest model evidence reaches general figures", () => {
    const f = fixture();
    fs.appendFileSync(f.file, JSON.stringify(f.record("claude-fable-5-2")) + "\n");
    let o = spendOffer(f.target, f.options.spendHost);
    assert.equal(o.multipliers.read, 0.1);
    assert.match(o.reason, /conflicting latest/);
    fs.writeFileSync(f.file, JSON.stringify(f.record(null)) + "\n");
    o = spendOffer(f.target, f.options.spendHost);
    assert.equal(o.multipliers.read, 0.1);
    assert.match(o.reason, /no recorded model/);
    fs.rmSync(f.projects, { recursive: true });
    fs.writeFileSync(f.projects, "not a directory");
    o = spendOffer(f.target, f.options.spendHost);
    assert.equal(o.multipliers.read, 0.1);
    assert.match(o.reason, /could not be read/);
});

test("a later separate subagent transcript cannot supply the main model", () => {
    const f = fixture();
    const dir = path.join(path.dirname(f.file), "main/subagents");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "agent-sub.jsonl"), JSON.stringify(f.record("claude-fable-5-2", "2026-11-09T15:00:00Z")) + "\n");
    assert.equal(spendOffer(f.target, f.options.spendHost).multipliers.read, 0.05);
});

test("accepted declarations validate and compile into the consumer advisory commands", async () => {
    const f = fixture();
    const multipliers = '{"read":0.04,"write":{"5m":1.3,"1h":2.1}}';
    assert.equal(await run([...flags, "--multipliers", multipliers, "--horizon", "3", f.target], f.options), 0);
    const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const env = { ...process.env, CLAUDE_CONFIG_DIR: f.host };
    execFileSync(process.execPath, [path.join(repo, "cli/doctor.mjs"), "--static", "--pack-root", path.join(repo, "packs"), path.join(f.target, ".portulan")], { env, stdio: "pipe" });
    execFileSync(process.execPath, [path.join(repo, "cli/compile.mjs"), "--workspace", f.target, "--pack-root", path.join(repo, "packs")], { env, stdio: "pipe" });
    const settings = fs.readFileSync(path.join(f.target, ".claude/settings.json"), "utf8");
    assert.match(settings, /--read 0\.04 --write-5m 1\.3 --write-1h 2\.1 --horizon 3/);
});
