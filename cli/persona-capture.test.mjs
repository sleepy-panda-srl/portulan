// Force acquired persona, routing and packaging rails red.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { CAPTURE, CAPTURE_SHA256, ROLES, bindingContract, verifyCapture, verifyData, register, summarize } from "./persona-routing.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const digest = value => createHash("sha256").update(value).digest("hex");
const inputs = () => ({ capture: load(CAPTURE), records: Object.fromEntries(ROLES.map(role => [role, load(`evals/ab/personas/${role}.json`)])) });

test("all three acquired role records regrade and match their registers and shipped routing", () => {
    const { capture, records } = inputs();
    assert.equal(digest(fs.readFileSync(path.join(ROOT, CAPTURE))), CAPTURE_SHA256);
    assert.equal(verifyCapture(ROOT).qualityChildren, 18);
    for (const role of ROLES) {
        assert.equal(records[role].summary.arms.a.passed, 3);
        assert.deepEqual(records[role].summary, summarize(records[role]));
        assert.equal(fs.readFileSync(path.join(ROOT, `evals/ab/personas/${role}.md`), "utf8"), register(records[role]));
    }
    assert.equal(verifyData(capture, records).requests, capture.accounting.requests);
});

test("incomplete coverage, effort/model drift, reused contexts and omitted overhead refuse", () => {
    const mutations = [
        ({ records }) => records.reviewer.turns.pop(),
        ({ records }) => { records.implementer.turns[0].effort = "medium"; },
        ({ records }) => { records.librarian.turns[0].usage.child[0].model = "other-model"; },
        ({ records }) => { records.reviewer.turns[1].context = records.reviewer.turns[0].context; },
        ({ records }) => { records.reviewer.turns[1].childContext = records.reviewer.turns[0].childContext; },
        ({ capture }) => capture.preflights.shift(),
        ({ capture }) => { capture.accounting.requests--; },
        ({ capture }) => { capture.order.reverse(); },
        ({ capture }) => { capture.decodeRepair.reruns = 1; },
        ({ records }) => { records.implementer.turns[0].instrumentSha256 = "0".repeat(64); },
        ({ capture }) => { capture.taskSha256["reviewer-clean"] = "0".repeat(64); },
        ({ records }) => { records.librarian.turns[0].answerPresentationSha256 = "0".repeat(64); },
        ({ capture }) => { capture.publication.normalizedAnswers = []; },
        ({ records }) => { const turn = records.implementer.turns[0]; delete turn.regraded; turn.grade.ok = true; },
        ({ records }) => { records.reviewer.turns[0].invocation.model = "inherit"; },
        ({ records }) => { records.librarian.turns[0].usage.child[0].output = -1; },
        ({ records }) => {
            const turn = records.implementer.turns.find(turn => turn.usage.parent.length > 1);
            turn.usage.parent.reverse();
            records.implementer.summary = summarize(records.implementer);
        },
        ({ records }) => {
            const turn = records.reviewer.turns.find(turn => turn.arm === "a"); turn.answer = "{}"; turn.grade.ok = false;
            turn.answerRawSha256 = turn.answerPresentationSha256 = digest(turn.answer); turn.answerNormalized = false;
        },
    ];
    for (const mutate of mutations) {
        const value = inputs(); mutate(value);
        assert.throws(() => verifyData(value.capture, value.records), undefined, mutate.toString());
    }
});

test("the immutable capture and source routing rails reject byte drift; missing data is unavailable", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "persona-capture-red-"));
    try {
        fs.mkdirSync(path.join(root, "evals/ab"), { recursive: true });
        fs.cpSync(path.join(ROOT, "evals/ab/personas"), path.join(root, "evals/ab/personas"), { recursive: true });
        for (const folder of ["core/personas", "agents"]) {
            fs.mkdirSync(path.join(root, folder), { recursive: true });
            for (const role of ROLES) fs.copyFileSync(path.join(ROOT, folder, role + ".md"), path.join(root, folder, role + ".md"));
        }
        assert.equal(verifyCapture(root).qualityChildren, 18);
        const bindingFile = path.join(root, "agents/librarian.md"), binding = fs.readFileSync(bindingFile, "utf8");
        const invoke = () => spawnSync(process.execPath, [path.join(ROOT, "cli/persona-routing.mjs"), "--repo-root", root], { encoding: "utf8", timeout: 15000 });
        fs.writeFileSync(bindingFile, binding.replace(/^description:.*$/m, "description: A valid replacement."));
        const green = invoke(); assert.equal(green.status, 0, green.stderr);
        for (const code of [0, 31, 127, 128, 133, 159, 0x2028, 0x2029]) {
            for (const scalar of ["before" + String.fromCharCode(code) + "after", '"before\\u' + code.toString(16).padStart(4, "0") + 'after"']) {
                fs.writeFileSync(bindingFile, binding.replace(/^description:.*$/m, "description: " + scalar));
                const red = invoke(); assert.equal(red.status, 1, `description code ${code}: ${red.stderr}`);
                assert.match(red.stderr, /description/);
            }
        }
        fs.writeFileSync(bindingFile, binding);
        fs.appendFileSync(path.join(root, CAPTURE), " ");
        assert.throws(() => verifyCapture(root), /acquisition digest/);
        const { capture } = inputs();
        fs.writeFileSync(path.join(root, CAPTURE), fs.readFileSync(path.join(ROOT, CAPTURE)));
        fs.appendFileSync(path.join(root, "core/personas/reviewer.md"), "drift\n");
        assert.throws(() => verifyCapture(root), /source differs/);
        assert.equal(capture.routing.effort, null);
        fs.rmSync(path.join(root, CAPTURE));
        const missing = spawnSync(process.execPath, [path.join(ROOT, "cli/persona-routing.mjs"), "--repo-root", root], { encoding: "utf8" });
        assert.equal(missing.status, 2, missing.stderr);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("npm carries the acquired evidence and runnable offline checker, excluding live instruments", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "persona-payload-"));
    try {
        const packed = spawnSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", root], { cwd: ROOT, encoding: "utf8", timeout: 30000,
            env: { ...process.env, npm_config_cache: path.join(root, "cache") } });
        assert.equal(packed.status, 0, packed.stderr);
        const entry = JSON.parse(packed.stdout)[0], files = new Set(entry.files.map(file => file.path));
        for (const file of [CAPTURE, "cli/persona-routing.mjs", "evals/ab/personas/grader.mjs", ...ROLES.map(role => `evals/ab/personas/${role}.json`)]) assert.ok(files.has(file), file);
        for (const file of ["cli/acquire-personas.mjs", "cli/normalize-personas.mjs"]) assert.equal(files.has(file), false, file);
        const unpacked = spawnSync("tar", ["-xzf", path.join(root, entry.filename), "-C", root], { encoding: "utf8" });
        assert.equal(unpacked.status, 0, unpacked.stderr);
        const check = spawnSync(process.execPath, [path.join(root, "package/cli/persona-routing.mjs"), "--repo-root", path.join(root, "package")], { encoding: "utf8", timeout: 30000 });
        assert.equal(check.status, 0, check.stderr);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("binding compatibility permits one valid description change and preserves every other byte", () => {
    const original = fs.readFileSync(path.join(ROOT, "evals/ab/personas/bindings/librarian.txt"), "utf8");
    const description = /^description:.*$/m;
    for (const replacement of ["description: Short routing description.", 'description: "Quoted description."', "description: 'Single quoted description.'"]) {
        assert.equal(bindingContract(original.replace(description, replacement)), bindingContract(original));
    }
    for (const replacement of ["", "description:", 'description: ""', "description: ''", "description: >\n  multiline", "description: |\n  multiline", "description: first\n  continued", 'description: "unclosed', "description: [one, two]", "description: first\ndescription: second", 'description: "escaped\\nnewline"']) {
        assert.throws(() => bindingContract(original.replace(description, replacement)), /description/);
    }
    assert.throws(() => bindingContract(original.replace("\n---\n", "\n")), /unclosed/);
    for (const mutation of [original + "body drift\n", original.replace("tools: Read", "tools: Bash"), original.replace('model: "inherit"', 'model: "other"'), original.replace("omitClaudeMd: false", "omitClaudeMd: true"), original.replace("cacheTtl: 5m", "cacheTtl: 1h"), original.replace('model: "inherit"', 'model: "inherit"\neffort: medium')]) {
        assert.notEqual(bindingContract(mutation), bindingContract(original));
    }
    assert.equal(bindingContract(fs.readFileSync(path.join(ROOT, "agents/librarian.md"), "utf8")), bindingContract(original));
});
