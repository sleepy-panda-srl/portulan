// Handoff budget tests.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { inspect, IndexError } from "./index.mjs";
import { inspect as doctor } from "./doctor.mjs";
import { run as context } from "./context.mjs";
import { run as init } from "./init.mjs";
import { handoffOffer } from "./handoff-policy.mjs";

const roots = [];
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
after(() => roots.forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));
const today = "2026-11-09";
const ratio = { bytes_per_token: 2, calibrated_by: "fixture-provider-count" };
function fixture({ cap = 60, window = 230, indexed = true, declared = true } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-handoff-budget-"));
    roots.push(dir);
    const manifest = {
        portulan: { spec: "2.14" }, name: "fixture", kind: "demo",
        slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md", handoffs: "handoffs/" },
        verify: { default: "docs", recipes: [{ id: "docs", run: "./verify.sh" }] },
    };
    if (indexed || declared) manifest.handoffs = {};
    if (indexed) manifest.handoffs.index = { path: "handoffs-index.md", ...(window === null ? {} : { budget: { tokens: window } }) };
    if (declared && cap !== null) manifest.handoffs.series = { budget: { record_tokens: cap, cutoff: "2026-11-07" } };
    if (declared || indexed && window !== null) manifest.context = { ratio: { ...ratio } };
    fs.mkdirSync(path.join(dir, "handoffs"));
    for (const name of ["identity.md", "principles.md", "gate-map.md", "verify.sh"]) fs.writeFileSync(path.join(dir, name), "Fixture.\n");
    const save = () => fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify(manifest));
    save();
    const add = (file, body) => fs.writeFileSync(path.join(dir, "handoffs", file), body);
    return { dir, manifest, save, add };
}
const judge = dir => inspect(dir, { today });
const failures = dir => judge(dir).findings.filter(f => f.series === "handoffs");

test("after-cutoff cap is red; compression alone returns green and corrections count", () => {
    const f = fixture();
    f.add("2026-11-08-open.md", "# Open\n" + "é".repeat(100));
    f.add("2026-11-09-other.md", "# Other\n" + "x".repeat(160));
    assert.equal(failures(f.dir).filter(x => x.check === "budget").length, 2);
    const message = failures(f.dir).map(x => x.message).join("\n");
    assert.match(message, /tokens.*60|60.*tokens/);
    assert.match(message, /compress/i);
    f.add("2026-11-08-open.md", "# Open\n\nDecision and why: see the task.\n");
    f.add("2026-11-09-other.md", "# Other\n\nNext action: review.\n");
    assert.deepEqual(failures(f.dir), []);
    fs.appendFileSync(path.join(f.dir, "handoffs/2026-11-08-open.md"), "\nCorrection: " + "x".repeat(120));
    assert.equal(failures(f.dir).filter(x => x.check === "budget").length, 1);
});

test("the cutoff day and historical overages are reported, never failed", () => {
    const f = fixture();
    f.add("2026-11-07-old.md", "# Old\n" + "x".repeat(250));
    assert.deepEqual(failures(f.dir), []);
    assert.match(judge(f.dir).notes.map(n => n.message).join("\n"), /cutoff|historical|unbound/i);
});

test("dates are checked without an index, while no H1 remains allowed", () => {
    const f = fixture({ indexed: false, declared: false });
    f.add("2026-11-09-valid.md", "No heading required without an index.\n");
    assert.deepEqual(failures(f.dir), []);
    f.add("undated.md", "No heading.\n");
    f.add("2026-02-30-unreal.md", "# Unreal\n");
    f.add("2026-11-11-future.md", "# Future\n");
    f.add("2026-11-10-margin.md", "No heading.\n");
    assert.equal(failures(f.dir).filter(x => x.check === "date").length, 3);
    assert.equal(failures(f.dir).filter(x => x.check === "title").length, 0);
});

test("direct index calls refuse malformed declarations and absent ratios", () => {
    for (const mutate of [
        m => m.handoffs.series.budget.record_tokens = 0,
        m => m.handoffs.series.budget.record_tokens = 1.5,
        m => m.handoffs.index.budget.tokens = -1,
        m => delete m.handoffs.series.budget.cutoff,
        m => m.handoffs.series.budget.cutoff = "2026-02-30",
        m => delete m.context,
        m => m.context.ratio.bytes_per_token = 0,
        m => m.context.ratio.calibrated_by = "",
        m => m.handoffs.series.budget.record_token = 10,
        m => m.handoffs.index.budget = null,
        m => m.portulan.spec = "2.13",
    ]) {
        const f = fixture(); mutate(f.manifest); f.save();
        assert.throws(() => judge(f.dir), IndexError);
    }
});

test("the complete contiguous newest window stays within budget as the series grows", () => {
    const f = fixture({ cap: null, window: 235 });
    for (let n = 0; n < 105; n++) {
        f.add(`2026-11-09-${String(n).padStart(3, "0")}.md`, `# Décision ${n}\n`);
        const result = judge(f.dir);
        assert.deepEqual(result.findings, []);
        const text = result.series.handoffs.expected;
        assert.ok(Math.round(Buffer.byteLength(text) / ratio.bytes_per_token) <= 235);
        assert.match(text, /omitted|not listed/i);
        if (n > 3) {
            assert.match(text, new RegExp(`Décision ${n}`));
            assert.doesNotMatch(text, /\[Décision 0\]/);
        }
    }
});

test("window overhead, empty series and an oversized newest line are handled", () => {
    const f = fixture({ cap: null, window: 1 });
    assert.throws(() => judge(f.dir), /at least|minimum|small/i);
    f.manifest.handoffs.index.budget.tokens = 235; f.save();
    assert.deepEqual(failures(f.dir), []);
    f.add("2026-11-09-z.md", "# " + "é".repeat(600) + "\n");
    f.add("2026-11-08-a.md", "# Older\n");
    const text = judge(f.dir).series.handoffs.expected;
    assert.doesNotMatch(text, /\[Older\]/);
    assert.match(text, /2.*omitted|omitted.*2|2.*not listed/);
});

test("an undeclared window preserves full-series rendering", () => {
    const f = fixture({ cap: null, window: null, declared: false });
    for (let n = 0; n < 20; n++) f.add(`2026-11-09-${n}.md`, `# Entry ${n}\n`);
    assert.equal(judge(f.dir).series.handoffs.expected.match(/^- /gm).length, 20);
});

test("minimum overhead and first-entry boundary include long Unicode names and nested paths", () => {
    const f = fixture({ cap: null, window: 1 });
    f.manifest.name = "Décision".repeat(24);
    f.manifest.handoffs.index.path = "indexes/nested/handoffs-index.md";
    f.add("2026-11-09-a-long-filename-for-the-current-open-decision.md", "# Décision et pourquoi\n");
    f.save();
    let minimum;
    assert.throws(() => judge(f.dir), error => {
        minimum = Number(error.message.match(/at least (\d+)/)?.[1]);
        return minimum > 1;
    });
    f.manifest.handoffs.index.budget.tokens = minimum; f.save();
    assert.doesNotMatch(judge(f.dir).series.handoffs.expected, /^- /m);
    for (let budget = minimum + 1; budget < minimum + 200; budget++) {
        f.manifest.handoffs.index.budget.tokens = budget; f.save();
        const text = judge(f.dir).series.handoffs.expected;
        assert.ok(Math.round(Buffer.byteLength(text) / ratio.bytes_per_token) <= budget);
        if (/^- /m.test(text)) {
            f.manifest.handoffs.index.budget.tokens = budget - 1; f.save();
            assert.doesNotMatch(judge(f.dir).series.handoffs.expected, /^- /m);
            return;
        }
    }
    assert.fail("the newest whole entry should fit within 200 extra tokens");
});

test("doctor gates new keys and reports a handoff series without a tree", async () => {
    const f = fixture(); f.add("2026-11-08-a.md", "# A\n");
    const result = await doctor(f.dir);
    assert.deepEqual(result.findings.filter(f => f.severity === "fail"), []);
    assert.match(result.findings.map(f => f.message).join("\n"), /handoffs.*median|median.*handoff/i);
    f.manifest.portulan.spec = "2.13"; f.save();
    assert.match((await doctor(f.dir)).findings.filter(f => f.severity === "fail").map(f => f.message).join("\n"), /2\.14/);
});

test("context reports a series with no tree or index using the declared estimate", () => {
    const f = fixture({ indexed: false, declared: false });
    f.add("2026-11-09-a.md", "No index or heading.\n");
    const out = [];
    assert.equal(context(["--workspace", f.dir], line => out.push(line)), 0);
    assert.match(out.join("\n"), /handoffs.*median|median.*handoff/i);
    assert.match(out.join("\n"), /index.*undeclared/i);
    assert.match(out.join("\n"), /2\.99/);
});

test("init accepts either offered budget independently with its supplied ratio", async () => {
    for (const budget of [{ record_tokens: 3000 }, { index_tokens: 3000 }, { record_tokens: 3000, index_tokens: 3000 }]) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-handoff-init-")); roots.push(dir);
        const lines = [];
        const code = await init(["--residence", "in-repo", "--no-cycle", "--no-interview", "--handoff-budget", JSON.stringify({ ...budget, ratio }), dir], { say: line => lines.push(line), warn: line => lines.push(line) });
        assert.equal(code, 0, lines.join("\n"));
        const manifest = JSON.parse(fs.readFileSync(path.join(dir, ".portulan/workspace.json")));
        assert.equal(manifest.portulan.spec, "2.14");
        assert.deepEqual(manifest.context.ratio, ratio);
        assert.equal(manifest.handoffs.series?.budget.record_tokens, budget.record_tokens);
        assert.equal(manifest.handoffs.index.budget?.tokens, budget.index_tokens);
        if (budget.record_tokens) assert.equal(manifest.handoffs.series.budget.cutoff, new Date().toISOString().slice(0, 10));
    }
    assert.equal(handoffOffer("none"), null);
    assert.throws(() => handoffOffer({ record_tokens: 3000 }), /ratio/);
    assert.throws(() => handoffOffer({ record_tokens: 3000, ratio, typo: 1 }), /typo/);
    assert.equal(handoffOffer({ record_tokens: 3000, ratio }, { today, newest: "2026-11-10" }).handoffs.series.budget.cutoff, "2026-11-10");
});

test("actual index CLI demonstrates red, compression green and a growing bounded window", () => {
    const f = fixture();
    const date = new Date().toISOString().slice(0, 10);
    f.manifest.handoffs.series.budget.cutoff = "2026-01-01"; f.save();
    const settings = fs.readFileSync(path.join(f.dir, "workspace.json"));
    f.add(`${date}-open.md`, "# Open\n" + "x".repeat(200));
    const cli = (...args) => spawnSync(process.execPath, [fileURLToPath(new URL("./index.mjs", import.meta.url)), ...args, f.dir], { encoding: "utf8" });
    const red = cli("--check");
    assert.equal(red.status, 1, red.stdout + red.stderr);
    assert.match(red.stdout, /over by/);
    f.add(`${date}-open.md`, "# Open\n\nNext action: review.\n");
    assert.equal(cli("--check").status, 0);
    for (let count = 1; count <= 105; count++) {
        f.add(`${date}-${String(count).padStart(3, "0")}.md`, `# Next ${count}\n`);
        if (![1, 9, 99, 105].includes(count)) continue;
        const out = cli("--handoffs");
        assert.equal(out.status, 0, out.stdout + out.stderr);
        assert.ok(Math.round(Buffer.byteLength(out.stdout) / ratio.bytes_per_token) <= 230);
    }
    assert.deepEqual(fs.readFileSync(path.join(f.dir, "workspace.json")), settings, "settings never raised or moved");
});
