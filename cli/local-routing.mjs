#!/usr/bin/env node
// Verify the shipped operational local roles against their immutable acquired A/B record. No model.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
    AB_RECORD, AB_TASKS, EARNED_ROUTING, RailError, TASK_ROLES,
    currentScreen, loadPredicates, verifyAb, verifyAbRecord,
} from "../packs/tools/local-llm/runner/local-llm.mjs";

export async function deriveRouting(record) {
    const red = verifyAb(record, { predicates: await loadPredicates(), screen: currentScreen() });
    if (record?.fixture !== undefined) red.push("a synthetic fixture earns no routing");
    if (red.length) throw new RailError(red.join("\n"));
    const supported = (task) => {
        const local = record.turns.filter((t) => t.task === task && t.arm === "l");
        const host = record.turns.filter((t) => t.task === task && t.arm === "h");
        return local.every((t) => t.completed && t.ok) &&
            host.every((t) => t.completed && t.exit === 0 && !t.timedOut && t.output.trim() !== "") &&
            local.filter((t) => t.ok).length >= host.filter((t) => t.ok).length;
    };
    return Object.fromEntries(["code", "prose"].map((role) => [role, {
        model: record.arms.l.models[role],
        enabled: AB_TASKS.filter((task) => TASK_ROLES[task] === role).every(supported),
    }]));
}

export async function verifyRoutingRecord(repoRoot, routing = EARNED_ROUTING) {
    await verifyAbRecord(repoRoot);
    const bytes = fs.readFileSync(path.join(repoRoot, AB_RECORD));
    const expected = {
        record: AB_RECORD,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        roles: await deriveRouting(JSON.parse(bytes)),
    };
    if (JSON.stringify(routing) !== JSON.stringify(expected)) {
        throw new RailError("shipped EARNED_ROUTING differs from its acquired record's digest, models or supported roles");
    }
    return "acquired record digest and models match; shipped role support is rederived from its turns";
}

export async function run(argv = process.argv.slice(2)) {
    try {
        if (argv.length !== 0 && !(argv.length === 2 && argv[0] === "--repo-root")) throw new Error("usage: node cli/local-routing.mjs [--repo-root <dir>]");
        console.log(`local-routing: ${await verifyRoutingRecord(path.resolve(argv[1] ?? "."))}`);
        return 0;
    } catch (error) {
        console.error(`local-routing: ${error.message}`);
        return error instanceof RailError ? 1 : 2;
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) run().then((code) => process.exit(code));
