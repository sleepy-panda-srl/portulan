#!/usr/bin/env node
// The PreToolUse gate runner — the *explanation* half of the enforcement compiler.
//
// On Claude Code 2.1.220 a PreToolUse hook that crashes fails open, so the compiled permission rule is the gate.
// Any internal error exits 0 with no decision, so the permission rule governs unchanged.
// It covers what a permission pattern cannot: one level of `sh -c` wrapping, and a shell write to a path a `write:` rule protects.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { matchesRule, policyPath, packContributions, composeFragments, parse } from "./compile.mjs";

// `||` so an empty CLAUDE_PROJECT_DIR falls back to cwd, the directory the host runs a hook from.
const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const WORKSPACE_DIR = process.env.PORTULAN_WORKSPACE || ".portulan";
const POLICY = policyPath(PROJECT, WORKSPACE_DIR);

function stepAside() {
    process.exit(0);
}

// No `discovery` option: packs resolve from the manifest's `tree` alone, never from the host's plugin cache.
// Falls back to the declared policy when composing or `parse` fails: a broken pack cannot switch off the workspace's gates.
function yielded(declared) {
    try {
        const { contributions } = packContributions(PROJECT, WORKSPACE_DIR);
        const composed = composeFragments(declared, contributions).policy;
        parse(composed);
        return composed;
    } catch {
        return declared;
    }
}

/** The strongest gate the call matches, not the first listed: a `prohibited` match outranks any `gated` one. */
function decide(payload, policy) {
    const tool = payload.tool_name;
    const input = payload.tool_input ?? {};
    let gated = null;
    for (const rule of policy.rules ?? []) {
        if (rule.tier !== "gated" && rule.tier !== "prohibited") continue;
        if (!matchesRule(rule, tool, input)) continue;
        if (rule.tier === "prohibited") return rule;
        if (gated === null) gated = rule;
    }
    return gated;
}

async function main() {
    let raw = "";
    for await (const chunk of process.stdin) raw += chunk;

    let payload;
    let policy;
    try {
        payload = JSON.parse(raw);
        policy = JSON.parse(fs.readFileSync(POLICY, "utf8"));
    } catch {
        stepAside();
        return;
    }

    const rule = decide(payload, yielded(policy));
    if (!rule) stepAside();

    const decision = rule.tier === "prohibited" ? "deny" : "ask";
    process.stdout.write(
        `${JSON.stringify({
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: decision,
                permissionDecisionReason: `PORTULAN GATE \`${rule.id}\` (${rule.tier}) — ${rule.reason}`,
            },
        })}\n`,
    );
    process.exit(0);
}

main().catch(stepAside);
