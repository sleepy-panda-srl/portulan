import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseUnit } from "../compile.mjs";
import { alwaysTier, tokensOf } from "../context.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const FIXTURE = path.join(HERE, "context-budget/project");
const UNIT = ".portulan/context/incidents.md";
const DESCRIPTION = "Investigating duplicate loans, returns and reservations.";
const digest = (text) => createHash("sha256").update(text).digest("hex");
// Keep line endings: parseUnit's body is normalized.
const bodyOf = (text) => text.slice(text.match(/^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)[0].length);

const demote = ({ unitFile }) => fs.writeFileSync(
    unitFile,
    fs.readFileSync(unitFile, "utf8").replace(/^tier: always$/m, `tier: on-read\ndescription: ${DESCRIPTION}`),
);

export function demonstrateBudget({ fixtureDir = FIXTURE, repair = demote } = {}) {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-budget-demo-"));
    try {
        const project = path.join(scratch, "project");
        const host = path.join(scratch, "empty-host");
        fs.cpSync(fixtureDir, project, { recursive: true });
        fs.mkdirSync(host);
        const env = { ...process.env, CLAUDE_CONFIG_DIR: host };
        const manifestFile = path.join(project, ".portulan/workspace.json");
        const unitFile = path.join(project, UNIT);
        const originalManifest = fs.readFileSync(manifestFile);
        const manifest = JSON.parse(originalManifest.toString("utf8"));
        const { tokens: budgetTokens } = manifest.context.always.budget;
        const ratio = manifest.context.ratio.bytes_per_token;
        const originalText = fs.readFileSync(unitFile, "utf8");
        const original = parseUnit("incidents", originalText);
        const originalBody = bodyOf(originalText);
        assert.equal(original.tier, "always", "the demonstration must start before demotion");

        const commands = {
            compile: ["--workspace", ".", "--pack-root", path.join(REPO, "packs")],
            context: ["--workspace", ".portulan", "--brief"],
            doctor: ["--static", "--pack-root", path.join(REPO, "packs"), ".portulan"],
        };
        const execute = (script) => {
            const result = spawnSync(process.execPath, [path.join(REPO, `cli/${script}.mjs`), ...commands[script]], {
                cwd: project, env, encoding: "utf8", maxBuffer: 4 * 1024 * 1024,
            });
            if (result.error || result.signal || ![0, 1].includes(result.status)) {
                const error = new Error(`${script} could not run (exit ${result.status ?? "none"}): ${result.error?.message ?? result.stderr}`);
                error.exitCode = 2;
                throw error;
            }
            return result;
        };
        const observe = (expected) => {
            const compiled = execute("compile");
            assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
            const context = execute("context");
            const doctor = execute("doctor");
            const doctorFailureChecks = [...doctor.stdout.matchAll(/^\s*FAIL\s+(\S+)/gm)].map((match) => match[1]);
            assert.equal(context.status, expected, context.stdout + context.stderr);
            assert.equal(doctor.status, expected, doctor.stdout + doctor.stderr);
            assert.deepEqual(doctorFailureChecks, expected === 1 ? ["context"] : [], "only the declared budget may cause the red");
            const entries = alwaysTier(project).entries;
            const alwaysBytes = entries.reduce((total, entry) => total + entry.bytes, 0);
            return {
                tier: parseUnit("incidents", fs.readFileSync(unitFile, "utf8")).tier,
                budgetTokens,
                alwaysBytes,
                estimatedTokens: tokensOf(alwaysBytes, ratio),
                alwaysFiles: entries.map((entry) => path.relative(project, entry.file).split(path.sep).join("/")).sort(),
                compileExit: compiled.status,
                contextExit: context.status,
                doctorExit: doctor.status,
                doctorFailureChecks,
            };
        };

        const before = observe(1);
        assert.ok(before.estimatedTokens > budgetTokens, "the original always tier must exceed its cap");
        repair({ project, manifestFile, unitFile });
        assert.deepEqual(fs.readFileSync(manifestFile), originalManifest, "the manifest changed: a raise is not a demotion repair");
        const movedText = fs.readFileSync(unitFile, "utf8");
        const moved = parseUnit("incidents", movedText);
        assert.equal(moved.tier, "on-read", "the repair must demote the unit to on-read");
        assert.equal(bodyOf(movedText), originalBody, "the guidance body changed during demotion");
        const after = observe(0);
        assert.deepEqual(fs.readFileSync(manifestFile), originalManifest, "the manifest changed during compilation");
        assert.equal(bodyOf(fs.readFileSync(unitFile, "utf8")), originalBody, "the guidance body changed during compilation");
        assert.ok(after.alwaysBytes < before.alwaysBytes, "the always tier must shrink");
        assert.ok(after.estimatedTokens <= budgetTokens, "the same cap must hold after demotion");
        assert.equal(fs.existsSync(path.join(project, ".claude/rules/portulan/incidents.md")), false, "the old always target must be removed");
        const index = fs.readFileSync(path.join(project, ".claude/rules/portulan/on-read.md"), "utf8");
        assert.ok(index.includes(UNIT) && index.includes(moved.description), "the retained guidance must be reachable from its index");
        return {
            format: 1,
            fixture: "invented-catalog-project",
            commandWorkingDirectory: "<scratch-project>",
            ratio: { bytesPerToken: ratio, declaredBy: manifest.context.ratio.calibrated_by, evidence: "synthetic estimate; no host calibration or exact token count" },
            commands: Object.fromEntries(Object.entries(commands).map(([name, args]) => [name, ["node", `<repo>/cli/${name}.mjs`, ...args.map((arg) => arg === path.join(REPO, "packs") ? "<repo>/packs" : arg)]])),
            manifestSha256: digest(originalManifest),
            guidanceBodySha256: digest(originalBody),
            manifestUnchanged: true,
            guidanceBodyUnchanged: true,
            before,
            after,
        };
    } finally {
        fs.rmSync(scratch, { recursive: true, force: true });
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    if (process.argv.length !== 2) {
        process.stderr.write("usage: node cli/fixtures/generate-context-budget.mjs\n");
        process.exitCode = 2;
    } else {
        try {
            process.stdout.write(`${JSON.stringify(demonstrateBudget(), null, 2)}\n`);
        } catch (error) {
            process.stderr.write(`context-budget demonstration: ${error.message}\n`);
            process.exitCode = error.exitCode ?? 1;
        }
    }
}
