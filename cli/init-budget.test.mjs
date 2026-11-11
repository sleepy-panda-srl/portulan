// The init interview's declared always-tier choice.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { run } from "./init.mjs";
import { alwaysTier, tokensOf } from "./context.mjs";

const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
const roots = [];
const observed = new Map();
process.on("exit", () => roots.forEach(root => fs.rmSync(root, { recursive: true, force: true })));
const ratio = { bytes_per_token: 4, calibrated_by: "fixture-4" };
const flags = ["--residence", "in-repo", "--name", "fixture", "--summary", "A fixture.", "--no-cycle", "--cache-lifetime", "5m", "--multipliers", '{"read":0.1,"write":{"5m":1.25,"1h":2}}', "--horizon", "1"];
function fixture(seed = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-init-budget-")); roots.push(root);
    for (const [rel, text] of Object.entries(seed)) {
        const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text);
    }
    return root;
}
function snapshot(root) {
    const files = [];
    const walk = rel => {
        for (const item of fs.readdirSync(path.join(root, rel), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
            const file = path.join(rel, item.name);
            if (item.isSymbolicLink()) files.push([file, "link", fs.readlinkSync(path.join(root, file))]);
            else if (item.isDirectory()) { files.push([file, "directory"]); walk(file); }
            else if(item.isFile())files.push([file,fs.readFileSync(path.join(root,file)).toString("base64")]);
            else files.push([file,"special",fs.lstatSync(path.join(root,file)).mode]);
        }
    }; walk(""); return files;
}
async function interview(root, { decision = "y", ratios = [JSON.stringify(ratio)], accept = "y", final = "y", handoffs = "none", beforeFinal } = {}) {
    const before = snapshot(root), questions = [], lines = [];
    observed.set(root, ["claude-code", "agents-md"].map(host => { try { return alwaysTier(root, { host }).entries.reduce((sum, entry) => sum + entry.bytes, 0); } catch { return null; } }));
    const code = await run([...flags, "--handoff-budget", handoffs, root], {
        say: line => lines.push(line), warn: line => lines.push(line),
        io: { interactive: true, say: line => lines.push(line), ask: async question => {
            questions.push(question); assert.deepEqual(snapshot(root), before, question);
            if (question.startsWith("Declare an always-tier budget?")) return decision;
            if (question.startsWith("Measured ratio JSON")) return ratios.shift() ?? null;
            if (question.startsWith("Accept ")) return accept;
            if (question.startsWith("Write these files?")) { beforeFinal?.(); return final; }
            assert.fail(`unexpected prompt: ${question}`);
        } },
    });
    return { code, questions, lines, before };
}
const manifest = root => JSON.parse(fs.readFileSync(path.join(root, ".portulan/workspace.json")));
function oracle(root, policy) {
    const counts = ["claude-code", "agents-md"].map(host => tokensOf(alwaysTier(root, { host }).entries.reduce((sum, entry) => sum + entry.bytes, 0), policy.context.ratio.bytes_per_token));
    const prior = (observed.get(root) ?? []).filter(bytes => bytes !== null).map(bytes => tokensOf(bytes, policy.context.ratio.bytes_per_token));
    assert.equal(policy.context.always.budget.tokens, Math.max(8000, ...counts, ...prior));
}
for (const [name, seed] of [
    ["small floor", {}],
    ["Claude plus new imports", { "CLAUDE.md": "@.portulan/dod.md\n@.gitignore\n" + "x".repeat(40000), ".gitignore": "existing\n" }],
    ["larger root AGENTS", { "CLAUDE.md": "x".repeat(36000), "AGENTS.md": "y".repeat(60000) }],
    ["project descriptions", { ".claude/agents/helper.md": "---\nname: helper\ndescription: " + "z".repeat(40000) + "\ntools: Read\n---\n" }],
]) test(`accepted budget is independently within both resulting domains: ${name}`, async () => {
    const root = fixture(seed), found = await interview(root);
    assert.equal(found.code, 0, found.lines.join("\n"));
    const policy = manifest(root);
    assert.deepEqual(policy.context.ratio, ratio);
    oracle(root, policy);
    const confirmation = found.questions.findIndex(q => q.startsWith("Write these files?"));
    assert.ok(found.questions.findIndex(q => q.startsWith("Accept ")) < confirmation);
    assert.match(found.lines.join("\n"), /projected|Projected/);
});
for (const decision of ["", "n"]) test(`declining (${JSON.stringify(decision)}) does not declare an always budget`, async () => {
    const root = fixture(), found = await interview(root, { decision });
    assert.equal(found.code, 0, found.lines.join("\n"));
    assert.equal(manifest(root).context, undefined);
    assert.ok(found.questions.some(q => q.startsWith("Declare an always-tier budget?")));
    assert.ok(!found.questions.some(q => q.startsWith("Measured ratio JSON")));
});
test("a supplied handoff ratio is reused, and declining leaves it intact", async () => {
    for (const decision of ["y", "n"]) {
        const root = fixture(), found = await interview(root, { decision, handoffs: JSON.stringify({ record_tokens: 3000, ratio }) });
        assert.equal(found.code, 0, found.lines.join("\n"));
        assert.deepEqual(manifest(root).context.ratio, ratio);
        assert.equal(manifest(root).handoffs.series.budget.record_tokens, 3000);
        assert.ok(!found.questions.some(q => q.startsWith("Measured ratio JSON")));
        if (decision === "y") oracle(root, manifest(root));
        else assert.equal(manifest(root).context.always, undefined);
    }
});
test("invalid ratios and calibration references are reasked before confirmation", async () => {
    const root = fixture(), found = await interview(root, { ratios: ['{"bytes_per_token":0,"calibrated_by":"valid"}', '{"bytes_per_token":4,"calibrated_by":"not a slug"}', JSON.stringify(ratio)] });
    assert.equal(found.code, 0, found.lines.join("\n"));
    assert.equal(found.questions.filter(q => q.startsWith("Measured ratio JSON")).length, 3);
    oracle(root, manifest(root));
});
for (const choices of [{ decision: null }, { ratios: [] }, { accept: null }, { final: null }, { final: "n" }, { final: "" }]) test(`ending the interview writes nothing: ${JSON.stringify(choices)}`, async () => {
    const root = fixture({ "sentinel.txt": "preserve" }), found = await interview(root, choices);
    assert.equal(found.code, 2);
    assert.deepEqual(snapshot(root), found.before);
});
test("an unmeasurable format does not invent an offer or block onboarding", async () => {
    const root = fixture({ "AGENTS.md": Buffer.from([255]) }), found = await interview(root);
    assert.equal(found.code, 0, found.lines.join("\n"));
    assert.equal(manifest(root).context, undefined);
    assert.match(found.lines.join("\n"), /AGENTS.*unavailable|AGENTS.*could not|agents-md.*unavailable/);
});
test("aliases deduplicate, ifAbsent imports stay owned, and append imports use their written bytes", async () => {
    const root = fixture({ "CLAUDE.md": "@owned.md\n@alias.md\n@changes/README.md\n@.gitignore\n", "owned.md": "k".repeat(40000), "changes/README.md": "q".repeat(10000), ".gitignore": "existing\n" });
    fs.symlinkSync("owned.md", path.join(root, "alias.md"));
    const found = await interview(root);
    assert.equal(found.code, 0, found.lines.join("\n"));
    oracle(root, manifest(root));
    assert.equal(fs.readFileSync(path.join(root, "changes/README.md"), "utf8"), "q".repeat(10000));
});
test("an existing unmanaged rule remains unchanged when guidance cannot compile", async () => {
    const root = fixture({ ".claude/rules/portulan/boot.md": "Unmanaged.\n" }), found = await interview(root);
    assert.equal(found.code, 0, found.lines.join("\n"));
    assert.equal(manifest(root).context, undefined);
    assert.equal(fs.readFileSync(path.join(root, ".claude/rules/portulan/boot.md"), "utf8"), "Unmanaged.\n");
    assert.match(found.lines.join("\n"), /NOT compiled/);
});
test("an absolute owned import with an uncertain projection withholds the cap", async () => {
    const root = fixture({ "source.md": "x".repeat(40000) });
    fs.writeFileSync(path.join(root, "CLAUDE.md"), `@${path.join(root, "source.md")}\n`);
    const found = await interview(root);
    assert.equal(found.code, 0, found.lines.join("\n"));
    assert.equal(manifest(root).context, undefined);
    assert.match(found.lines.join("\n"), /offer unavailable/);
});

const CLI = fileURLToPath(new URL("./init.mjs", import.meta.url));
test("the actual unattended CLI leaves the always cap undeclared", () => {
    const root = fixture(), result = spawnSync(process.execPath, [CLI, ...flags, "--handoff-budget", "none", "--no-interview", root], { encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(manifest(root).context, undefined);
    assert.doesNotMatch(result.stdout, /exact count measured/);
});
test("the actual terminal CLI accepts the offer before any target write", async t => {
    const available = spawnSync("python3", ["--version"], { encoding: "utf8" });
    if (available.error?.code === "ENOENT") { t.skip("python3 is unavailable for the terminal control"); return; }
    const root = fixture({ "AGENTS.md": "x".repeat(40000) }), before = snapshot(root);
    const command = [process.execPath, CLI, ...flags, "--handoff-budget", "none", root];
    const bridge = `import os, pty, select, sys
pid, fd = pty.fork()
if pid == 0: os.execv(sys.argv[1], sys.argv[1:])
try:
    while True:
        ready, _, _ = select.select([fd, 0], [], [])
        if fd in ready:
            try: data = os.read(fd, 65536)
            except OSError: break
            if not data: break
            os.write(1, data)
        if 0 in ready:
            data = os.read(0, 65536)
            if not data: break
            os.write(fd, data)
finally:
    os.close(fd)
_, status = os.waitpid(pid, 0)
sys.exit(os.waitstatus_to_exitcode(status))
`;
    let transcript = "", step = 0;
    const status = await new Promise((resolve, reject) => {
        const child = spawn("python3", ["-u", "-c", bridge, ...command], { stdio: ["pipe", "pipe", "pipe"] });
        const deadline = setTimeout(() => { child.kill(); reject(new Error(`terminal stalled at ${step}: ${transcript}`)); }, 15000);
        const prompts = ["Declare an always-tier budget? [y/N]: ", "Measured ratio JSON {bytes_per_token, calibrated_by}: ", /Accept [\d,]+ tokens at 4 B\/token \(fixture-4\)\? \[y\/N\]: /, "Write these files? [y/N]: "];
        const answers = ["y", JSON.stringify(ratio), "y", "y"];
        const receive = data => {
            transcript += data.toString();
            const prompt = prompts[step];
            if (step < prompts.length && (typeof prompt === "string" ? transcript.includes(prompt) : prompt.test(transcript))) {
                try { assert.deepEqual(snapshot(root), before); }
                catch (error) { child.kill(); clearTimeout(deadline); reject(error); return; }
                child.stdin.write(answers[step++] + "\n");
            }
        };
        child.stdout.on("data", receive); child.stderr.on("data", receive);
        child.on("error", error => { clearTimeout(deadline); reject(error); });
        child.on("exit", code => { clearTimeout(deadline); resolve(code); });
    });
    assert.equal(status, 0, transcript); assert.equal(step, 4, transcript);
    oracle(root, manifest(root));
});

test("declining the final budget confirmation does not retain its proposed ratio", async () => {
    for (const accept of ["n", ""]) {
        const root = fixture(), found = await interview(root, { accept });
        assert.equal(found.code, 0, found.lines.join("\n"));
        assert.equal(manifest(root).context, undefined);
    }
});

test("a manifest import counts the exact accepted declaration", async () => {
    const root = fixture({ "CLAUDE.md": "@.portulan/workspace.json\n" + "x".repeat(40000) }), found = await interview(root);
    assert.equal(found.code, 0, found.lines.join("\n")); oracle(root, manifest(root));
    const checked = spawnSync(process.execPath, [fileURLToPath(new URL("./doctor.mjs", import.meta.url)), "--static", "--pack-root", path.resolve(path.dirname(CLI), "../packs"), path.join(root, ".portulan")], { encoding: "utf8", timeout: 5000 });
    assert.equal(checked.status, 0, checked.stdout + checked.stderr);
});
test("Git ignore imports use the same prepared draft as the writer", async () => {
    const root = fixture({ "CLAUDE.md": "@.gitignore\n" + "x".repeat(40000), ".gitignore": ".claude/\n" });
    execFileSync("git", ["init", "-q", root]);
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n")); oracle(root, manifest(root));
});
test("an existing context unit and its leads and import dependencies contribute", async () => {
    const root = fixture({ "CLAUDE.md": "x".repeat(40000), ".portulan/context/adopter.md": "---\ntier: always\n---\n\n<!-- leads: ../../adopter.md -->\n\n@../../adopter.md\n" + "y".repeat(22000), "adopter.md": "# Rules\n\n- **Keep evidence.** Record observations.\n" });
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n")); oracle(root, manifest(root));
});
for (const rel of ["future.md", ".claude/agents/future.md", ".claude/rules/future.md"]) test(`a newly resolvable link contributes at ${rel}`, async () => {
    const root = fixture({ "CLAUDE.md": (rel === "future.md" ? "@future.md\n" : "") + "x".repeat(40000) });
    const link = path.join(root, rel); fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(path.relative(path.dirname(link), path.join(root, ".portulan/dod.md")), link);
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n")); oracle(root, manifest(root));
});
test("a future absolute owned import cannot silently disappear from the offer", async () => {
    const root = fixture(); fs.writeFileSync(path.join(root, "CLAUDE.md"), `@${path.join(root, ".portulan/dod.md")}\n` + "x".repeat(40000));
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n"));
    if (manifest(root).context?.always) oracle(root, manifest(root));
    else assert.match(found.lines.join("\n"), /offer unavailable/);
});
const marker = "`portulan compile` wrote the rules listed below from slots.context; it rewrites and removes only these.\nold.md\n";
test("valid ownership can remove stale load without lowering the offer below today's load", async () => {
    const root = fixture({ ".claude/rules/portulan/.compiled": marker, ".claude/rules/portulan/old.md": "x".repeat(120000) }), found = await interview(root);
    assert.equal(found.code, 0, found.lines.join("\n")); oracle(root, manifest(root));
    assert.equal(manifest(root).context.always.budget.tokens, 30000);
    assert.equal(fs.existsSync(path.join(root, ".claude/rules/portulan/old.md")), false);
});
for (const parent of [".claude", ".claude/rules", ".claude/rules/portulan"]) test(`a compiler parent alias is represented or explicitly unmeasurable: ${parent}`, async () => {
    const root = fixture({ "CLAUDE.md": "x".repeat(40000) });
    fs.mkdirSync(path.join(root, "backing")); fs.mkdirSync(path.dirname(path.join(root, parent)), { recursive: true }); fs.symlinkSync(path.join(root, "backing"), path.join(root, parent));
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n"));
    assert.equal(manifest(root).context, undefined); assert.match(found.lines.join("\n"), /offer unavailable/);
});
for (const kind of ["parent-file", "output-directory", "invalid-marker"]) test(`compiler state cannot be omitted: ${kind}`, async () => {
    const root = fixture({ "CLAUDE.md": "x".repeat(40000) }), at = path.join(root, ".claude/rules/portulan");
    fs.mkdirSync(path.dirname(at), { recursive: true });
    if (kind === "parent-file") fs.writeFileSync(at, "file");
    else if (kind === "output-directory") fs.mkdirSync(path.join(at, "boot.md"), { recursive: true });
    else { fs.mkdirSync(at); fs.writeFileSync(path.join(at, ".compiled"), "unrecognized"); }
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n"));
    assert.equal(manifest(root).context, undefined); assert.match(found.lines.join("\n"), /offer unavailable/);
});
test("unimported preserved bytes need no text decoder", async () => {
    const root = fixture({ "changes/README.md": Buffer.from([255]) }), found = await interview(root);
    assert.equal(found.code, 0, found.lines.join("\n")); oracle(root, manifest(root));
    assert.deepEqual(fs.readFileSync(path.join(root, "changes/README.md")), Buffer.from([255]));
});
test("a target-local TMPDIR permits zero transient destination mutations before consent", async t => {
    const root = fixture(); fs.mkdirSync(path.join(root, "tmp")); const before = snapshot(root), writes = [];
    const previous = process.env.TMPDIR; process.env.TMPDIR = path.join(root, "tmp");
    for (const method of ["mkdtempSync", "mkdirSync", "writeFileSync", "symlinkSync", "rmSync", "rmdirSync", "unlinkSync"]) {
        const original = fs[method];
        t.mock.method(fs, method, (...args) => { const file = method === "symlinkSync" ? args[1] : args[0]; if (typeof file === "string") {
                let current = path.resolve(file), tail = "";
                for (;;) {
                    try { current = path.join(fs.realpathSync(current), tail); break; }
                    catch { const parent = path.dirname(current); if (parent === current) break; tail = path.join(path.basename(current), tail); current = parent; }
                }
                if (current.startsWith(fs.realpathSync(root) + path.sep)) writes.push([method, file]);
            } return original.apply(fs, args); });
    }
    try { const found = await interview(root, { decision: "n", final: "n" }); assert.equal(found.code, 2); }
    finally { if (previous === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previous; t.mock.restoreAll(); }
    assert.deepEqual(snapshot(root), before); assert.deepEqual(writes, []);
});
for (const rel of ["Makefile", "package.json", ".gitignore", "nested/.gitignore"]) test(`a FIFO cannot block pre-consent preparation: ${rel}`, t => {
    const root = fixture(), file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true });
    execFileSync("git", ["init", "-q", root]);
    const made = spawnSync("mkfifo", [file]); if (made.error?.code === "ENOENT") { t.skip("mkfifo unavailable"); return; } assert.equal(made.status, 0);
    const source = `import {run} from ${JSON.stringify(new URL("./init.mjs", import.meta.url).href)}; const code=await run(${JSON.stringify([...flags, "--handoff-budget", "none", root])},{io:{interactive:true,say:()=>{},ask:async()=>"n"}});process.exit(code);`;
    const checked = spawnSync(process.execPath, ["--input-type=module", "-e", source], { encoding: "utf8", timeout: 5000, killSignal: "SIGKILL", detached: true });
    if (Number.isInteger(checked.pid) && checked.pid > 0) { try { process.kill(-checked.pid, "SIGKILL"); } catch {} }
    assert.equal(checked.status, 2, checked.error?.message ?? checked.stdout + checked.stderr);
    assert.equal(fs.existsSync(path.join(root, ".portulan")), false);
});
test("the self-counting cap converges across a decimal-width boundary", async () => {
    const calibration = fixture({ "CLAUDE.md": "@.portulan/workspace.json\n" });
    const written = spawnSync(process.execPath, [CLI, ...flags, "--handoff-budget", "none", "--no-interview", calibration], { encoding: "utf8", timeout: 10000 });
    assert.equal(written.status, 0, written.stderr);
    const sample = manifest(calibration); sample.context = { ratio, always: { budget: { tokens: 9999 } } };
    fs.writeFileSync(path.join(calibration, ".portulan/workspace.json"), JSON.stringify(sample, null, 2) + "\n");
    const bytes = alwaysTier(calibration).entries.reduce((sum, entry) => sum + entry.bytes, 0);
    const root = fixture({ "CLAUDE.md": "@.portulan/workspace.json\n" + "x".repeat(40001 - bytes) });
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n")); oracle(root, manifest(root));
    assert.equal(manifest(root).context.always.budget.tokens, 10001);
});
test("a disabled owned skill still affects compiler state and its replacement description", async () => {
    const root = fixture({ "CLAUDE.md": "x".repeat(40000), ".portulan/context/release.md": "---\ntier: on-invoke\ndescription: " + "y".repeat(1000) + "\n---\n\nRelease.\n", ".claude/skills/release/SKILL.md": "---\nname: release\ndescription: Old.\ndisable-model-invocation: true\n---\n\n<!-- compiled by `portulan compile` from .portulan/context/release.md; edit that file, then recompile -->\n\nOld body.\n" });
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n")); oracle(root, manifest(root));
    assert.doesNotMatch(fs.readFileSync(path.join(root, ".claude/skills/release/SKILL.md"), "utf8"), /disable-model-invocation/);
});
test("a non-always import needs an existence probe, never the target's contents", async t => {
    const root = fixture({ ".portulan/context/release.md": "---\ntier: on-invoke\ndescription: Release.\n---\n\n@../../resource.md\n", "resource.md": Buffer.from([255]) });
    const original = fs.readFileSync, opened = [];
    t.mock.method(fs, "readFileSync", (file, ...args) => {
        if (typeof file === "string" && path.resolve(file) === path.join(root, "resource.md")) {
            const caller = new Error().stack.split("\n")[3] ?? "";
            if (!caller.includes("init-budget.test.mjs")) opened.push(file);
        }
        return original.call(fs, file, ...args);
    });
    let found; try { found = await interview(root); } finally { t.mock.restoreAll(); }
    assert.equal(found.code, 0, found.lines.join("\n")); assert.equal(manifest(root).context, undefined);
    assert.match(found.lines.join("\n"), /offer unavailable/); assert.deepEqual(opened, []);
});
test("an unreadable guidance unit cannot hang onboarding after the cap is withheld", t => {
    const root = fixture(), fifo = path.join(root, ".portulan/fifo");
    fs.mkdirSync(path.join(root, ".portulan/context"), { recursive: true });
    const made = spawnSync("mkfifo", [fifo]); if (made.error?.code === "ENOENT") { t.skip("mkfifo unavailable"); return; } assert.equal(made.status, 0);
    fs.symlinkSync("../fifo", path.join(root, ".portulan/context/unit.md"));
    const source = `import {run} from ${JSON.stringify(new URL("./init.mjs", import.meta.url).href)};const code=await run(${JSON.stringify([...flags, "--handoff-budget", "none", root])},{io:{interactive:true,say:()=>{},ask:async q=>q.startsWith("Write these files?")?"y":"n"}});process.exit(code);`;
    const checked = spawnSync(process.execPath, ["--input-type=module", "-e", source], { encoding: "utf8", timeout: 5000, killSignal: "SIGKILL", detached: true });
    if (Number.isInteger(checked.pid) && checked.pid > 0) { try { process.kill(-checked.pid, "SIGKILL"); } catch {} }
    assert.equal(checked.status, 0, checked.error?.message ?? checked.stdout + checked.stderr);
    assert.match(checked.stderr, /NOT compiled/); assert.equal(manifest(root).context, undefined);
});

for (const future of [false, true]) test(`relative imports can leave and re-enter the same named project: ${future}`, async () => {
    const root = fixture(future ? {} : { "policy.md": "p".repeat(40000) });
    fs.writeFileSync(path.join(root, "CLAUDE.md"), `@../${path.basename(root)}/${future ? ".portulan/dod.md" : "policy.md"}\n` + "x".repeat(40000));
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n")); oracle(root, manifest(root));
});
test("an ancestor alias returning to future project inputs is not silently excluded", async () => {
    const root = fixture(), alias = path.join(path.dirname(root), path.basename(root) + "-return");
    fs.symlinkSync(root, alias);
    try {
        fs.writeFileSync(path.join(root, "CLAUDE.md"), `@../${path.basename(alias)}/.portulan/dod.md\n` + "x".repeat(40000));
        const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n"));
        if (manifest(root).context?.always) oracle(root, manifest(root)); else assert.match(found.lines.join("\n"), /offer unavailable/);
    } finally { fs.rmSync(alias); }
});
test("known missing external inputs remain exclusions", async () => {
    const outside = fixture(), root = fixture({ "CLAUDE.md": `@${path.join(outside, "missing.md")}\n` });
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n")); oracle(root, manifest(root));
});
for (const into of ["AGENTS.md", "CLAUDE.md", "policy.md"]) test(`an uncertain multiply linked append target cannot bind a cap: ${into}`, async () => {
    const root = fixture({ ".gitignore": "x".repeat(60001), ...(into === "policy.md" ? { "CLAUDE.md": "@policy.md\n" + "y".repeat(40000) } : {}) });
    fs.linkSync(path.join(root, ".gitignore"), path.join(root, into));
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n"));
    assert.equal(manifest(root).context, undefined); assert.match(found.lines.join("\n"), /offer unavailable/);
});
test("a multiply linked compiler write target cannot bind an uncertain cap", async () => {
    const root = fixture({ "CLAUDE.md": "@second.md\n" + "x".repeat(40000), ".claude/rules/portulan/.compiled": marker.replace("old.md", "boot.md"), ".claude/rules/portulan/boot.md": "Old.\n" });
    fs.linkSync(path.join(root, ".claude/rules/portulan/boot.md"), path.join(root, "second.md"));
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n"));
    assert.equal(manifest(root).context, undefined); assert.match(found.lines.join("\n"), /offer unavailable/);
});
test("ordinary multiply linked inputs that are not rewritten remain measurable", async () => {
    const root = fixture({ "CLAUDE.md": "@policy.md\n@second.md\n", "policy.md": "x".repeat(40000) });
    fs.linkSync(path.join(root, "policy.md"), path.join(root, "second.md"));
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n")); oracle(root, manifest(root));
});
for (const existing of [false, true]) test(`an append edit made at confirmation is preserved before refusing the stale plan: ${existing}`, async () => {
    const root = fixture(existing ? { ".gitignore": "original\n" } : {});
    const found = await interview(root, { beforeFinal: () => fs.appendFileSync(path.join(root, ".gitignore"), "adopter-edit\n") });
    assert.equal(found.code, 2, found.lines.join("\n"));
    assert.equal(fs.readFileSync(path.join(root, ".gitignore"), "utf8"), (existing ? "original\n" : "") + "adopter-edit\n");
    assert.equal(fs.existsSync(path.join(root, ".portulan")), false);
});
for (const interactive of [false, true]) test(`byte-oriented ignore content is preserved when appending: ${interactive}`, async () => {
    const original = Buffer.from([255, 10]), root = fixture({ ".gitignore": original }); execFileSync("git", ["init", "-q", root]);
    if (interactive) { const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n")); oracle(root, manifest(root)); }
    else { const done = spawnSync(process.execPath, [CLI, ...flags, "--handoff-budget", "none", "--no-interview", root], { encoding: "utf8", timeout: 10000 }); assert.equal(done.status, 0, done.stdout + done.stderr); }
    assert.deepEqual(fs.readFileSync(path.join(root, ".gitignore")).subarray(0, original.length), original);
});
for (const boundary of ["foreign-unit", "generated-alias"]) test(`compiler source boundaries cannot disappear: ${boundary}`, async () => {
    const root = fixture({ "CLAUDE.md": "x".repeat(40000) }); fs.mkdirSync(path.join(root, ".portulan/context"), { recursive: true });
    if (boundary === "foreign-unit") {
        const outside = fixture({ "unit.md": "---\ntier: always\n---\n\nOutside.\n" }); fs.symlinkSync(path.join(outside, "unit.md"), path.join(root, ".portulan/context/external.md"));
    } else fs.symlinkSync("context", path.join(root, ".portulan/compile"));
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n"));
    assert.equal(manifest(root).context, undefined); assert.match(found.lines.join("\n"), /offer unavailable/);
});
test("observable compiler output write permissions remain part of the projection", async () => {
    const root = fixture({ "CLAUDE.md": "x".repeat(40000) }), dir = path.join(root, ".claude/rules/portulan"); fs.mkdirSync(dir, { recursive: true });
    const originalMode = fs.statSync(dir).mode & 0o777; fs.chmodSync(dir, 0o555);
    let writable = true; try { fs.accessSync(dir, fs.constants.W_OK); } catch { writable = false; }
    try {
        const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n"));
        if (writable) oracle(root, manifest(root));
        else { assert.equal(manifest(root).context, undefined); assert.match(found.lines.join("\n"), /offer unavailable/); }
    } finally { fs.chmodSync(dir, originalMode); }
});
for (const tier of ["on-path", "on-invoke", "on-read"]) test(`a ${tier} existence probe includes an alias to future draft data`, async () => {
    const header = `---\ntier: ${tier}\ndescription: Work.\n${tier === "on-path" ? 'paths: ["api/**"]\n' : ""}---\n\n@../../future.md\n`;
    const root = fixture({ "CLAUDE.md": "x".repeat(40000), ".portulan/context/work.md": header }); fs.symlinkSync(".portulan/dod.md", path.join(root, "future.md"));
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n"));
    assert.equal(manifest(root).context, undefined); assert.match(found.lines.join("\n"), /offer unavailable/);
});
test("pre-consent Git reads do not execute a configured filesystem monitor", async () => {
    const root = fixture({ "tracked.txt": "tracked\n", "monitor.sh": '#!/bin/sh\n: > "$(dirname "$0")/monitor-marker"\nprintf "token\\0"\n' });
    execFileSync("git", ["init", "-q", root]); execFileSync("git", ["-C", root, "add", "tracked.txt"]); fs.chmodSync(path.join(root, "monitor.sh"), 0o755);
    execFileSync("git", ["-C", root, "config", "core.fsmonitor", path.join(root, "monitor.sh")]);
    execFileSync("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
    assert.equal(fs.existsSync(path.join(root, "monitor-marker")), true, "the control must actually invoke the monitor"); fs.rmSync(path.join(root, "monitor-marker"));
    const before = snapshot(root), found = await interview(root, { decision: "n", final: "n" });
    assert.equal(found.code, 2); assert.deepEqual(snapshot(root), before); assert.equal(fs.existsSync(path.join(root, "monitor-marker")), false);
});
for (const kind of ["instructions-first", "equal-depth", "unscoped-first", "scoped-aliases"]) test(`projected imports share the counter's alias traversal: ${kind}`, async () => {
    const root = fixture({ "CLAUDE.md": "x".repeat(40000) });
    const add = (rel, text) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
    const link = (rel, to) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.symlinkSync(to, file); };
    if (kind === "scoped-aliases") {
        add("common.md", '---\npaths: ["src/**"]\n---\n@own.txt\n');
        link(".claude/rules/a/rule.md", "../../../common.md"); link(".claude/rules/z/rule.md", "../../../common.md");
        add(".claude/rules/a/own.txt", "small"); link(".claude/rules/z/own.txt", "../../../.portulan/dod.md");
    } else {
        add("common.md", "@own.md\n"); link("a/shared.md", "../common.md"); link("b/shared.md", "../common.md");
        link("a/own.md", "../.portulan/dod.md"); add("b/own.md", "small");
        if (kind === "unscoped-first") {
            add(".claude/rules/a-scoped.md", '---\npaths: ["src/**"]\n---\n@../../b/shared.md\n');
            add(".claude/rules/z-unscoped.md", "@../../a/shared.md\n");
        } else {
            add("a/indirect.md", "@shared.md\n");
            add("CLAUDE.md", `@a/${kind === "equal-depth" ? "shared" : "indirect"}.md\n` + "x".repeat(40000));
            add(".claude/rules/general.md", "@../../b/shared.md\n");
        }
    }
    const found = await interview(root); assert.equal(found.code, 0, found.lines.join("\n")); oracle(root, manifest(root));
    const checked = spawnSync(process.execPath, [fileURLToPath(new URL("./doctor.mjs", import.meta.url)), "--static", path.join(root, ".portulan")], { encoding: "utf8", timeout: 10000 });
    assert.equal(checked.status, 0, checked.stdout + checked.stderr);
});
for (const state of ["new", "owned", "move", "human", "parent-alias"]) test(`nested instruction projection preserves ${state} state`, async () => {
    const source = '---\ntier: on-path\ntarget: api/CLAUDE.md\ndescription: API guidance.\n---\n\nNested API guidance.\n';
    const root = fixture({"CLAUDE.md":"@api/CLAUDE.md\n"+"x".repeat(40000),".portulan/context/api.md":source});
    if(state==="owned"||state==="move") {
        fs.writeFileSync(path.join(root,".portulan/workspace.json"),JSON.stringify({portulan:{spec:"2.15"},name:"fixture",kind:"repository",tree:"../",slots:{context:"context/"}}));
        const {compileGuidance}=await import("./compile.mjs");compileGuidance(root);fs.rmSync(path.join(root,".portulan/workspace.json"));
        if(state==="move") fs.writeFileSync(path.join(root,".portulan/context/api.md"),source.replace("api/CLAUDE.md","service/CLAUDE.md"));
    }
    if(state==="human") {fs.mkdirSync(path.join(root,"api"));fs.writeFileSync(path.join(root,"api/CLAUDE.md"),"Human.\n");}
    if(state==="parent-alias") {fs.mkdirSync(path.join(root,"backing"));fs.symlinkSync("backing",path.join(root,"api"));}
    const found=await interview(root);assert.equal(found.code,0,found.lines.join("\n"));
    if(state==="human"||state==="parent-alias") {assert.equal(manifest(root).context,undefined);assert.match(found.lines.join("\n"),/offer unavailable/);}
    else oracle(root,manifest(root));
});

for(const permission of ["file","directory"]) test(`nested init offer agrees with atomic-emitter ${permission} permissions`,async()=>{
    const source='---\ntier: on-path\ntarget: api/CLAUDE.md\ndescription: API guidance.\n---\n\nOriginal.\n';
    const root=fixture({"CLAUDE.md":"@api/CLAUDE.md\n"+"x".repeat(40000),".portulan/context/api.md":source});
    fs.writeFileSync(path.join(root,".portulan/workspace.json"),JSON.stringify({portulan:{spec:"2.15"},name:"fixture",kind:"repository",tree:"../",slots:{context:"context/"}}));
    const {compileGuidance}=await import("./compile.mjs");compileGuidance(root);fs.rmSync(path.join(root,".portulan/workspace.json"));
    fs.writeFileSync(path.join(root,".portulan/context/api.md"),source+"Fresh guidance.\n");
    const at=path.join(root,permission==="file"?"api/CLAUDE.md":"api"),saved=fs.statSync(at).mode;fs.chmodSync(at,permission==="file"?0o444:0o555);
    try {
        const found=await interview(root);assert.equal(found.code,0,found.lines.join("\n"));
        if(permission==="file"){oracle(root,manifest(root));assert.match(fs.readFileSync(path.join(root,"api/CLAUDE.md"),"utf8"),/Fresh guidance/);}
        else {assert.equal(manifest(root).context,undefined);assert.match(found.lines.join("\n"),/offer unavailable/);}
    } finally {fs.chmodSync(at,saved);}
});

test("interactive init withholds a cap for an unsupported special guidance source",async()=>{
    const source='---\ntier: on-path\ntarget: api/CLAUDE.md\ndescription: API.\n---\n\nOriginal.\n',root=fixture({"CLAUDE.md":"@api/CLAUDE.md\n"+"x".repeat(40000),".portulan/context/api.md":source});
    fs.writeFileSync(path.join(root,".portulan/workspace.json"),JSON.stringify({portulan:{spec:"2.15"},name:"fixture",kind:"repository",tree:"../",slots:{context:"context/"}}));const {compileGuidance}=await import("./compile.mjs");compileGuidance(root);fs.rmSync(path.join(root,".portulan/workspace.json"));fs.writeFileSync(path.join(root,".portulan/context/api.md"),source+"Fresh source.\n");assert.equal(spawnSync("mkfifo",[path.join(root,".portulan/context/future.md")]).status,0);
    const found=await interview(root);assert.equal(found.code,0,found.lines.join("\n"));assert.equal(manifest(root).context,undefined);assert.match(found.lines.join("\n"),/offer unavailable/);assert.doesNotMatch(fs.readFileSync(path.join(root,"api/CLAUDE.md"),"utf8"),/Fresh source/);
});
test("interactive init ignores ordinary child directories in the context slot",async()=>{
    const source='---\ntier: on-path\ntarget: api/CLAUDE.md\ndescription: API.\n---\n\nOriginal.\n',root=fixture({"CLAUDE.md":"@api/CLAUDE.md\n"+"x".repeat(40000),".portulan/context/api.md":source});
    fs.writeFileSync(path.join(root,".portulan/workspace.json"),JSON.stringify({portulan:{spec:"2.15"},name:"fixture",kind:"repository",tree:"../",slots:{context:"context/"}}));const {compileGuidance}=await import("./compile.mjs");compileGuidance(root);fs.rmSync(path.join(root,".portulan/workspace.json"));fs.mkdirSync(path.join(root,".portulan/context/future.md"));fs.writeFileSync(path.join(root,".portulan/context/api.md"),source+"Fresh source.\n");const found=await interview(root);assert.equal(found.code,0,found.lines.join("\n"));assert.ok(manifest(root).context,found.lines.join("\n"));oracle(root,manifest(root));assert.match(fs.readFileSync(path.join(root,"api/CLAUDE.md"),"utf8"),/Fresh source/);
});
