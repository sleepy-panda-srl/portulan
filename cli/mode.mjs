#!/usr/bin/env node
// `mode` — read, or tighten, this session's autonomy mode.
//
//   node cli/mode.mjs              what mode is in force, and where it came from
//   node cli/mode.mjs strict       tighten THIS session to strict
//   node cli/mode.mjs --clear      drop this session's override, back to the workspace default
//
// Exit 0 said something true · 1 refused the change · 2 could not run.
//
// ## What this does and does not touch
//
// A **mode** is how often the development cycle stops for approval — `auto` never, `gated` once at
// the ship step, `strict` at every push and the ship step. The doctrine is in
// ../core/operating/autonomy.md and the policy in ../.portulan/gates.json.
//
// This command changes **one session's** mode and nothing else. It does not edit the policy, does not
// touch the compiled artifact, and is invisible to every other session — including another session in
// another worktree of the same repository. The record lives in the OS temp directory, keyed by the
// working tree and carrying the session that claimed it, exactly like the Stop-gate's counter.
//
// ## Tighten-only
//
// It refuses to loosen, and the refusal is not a preference. The compiled `permissions` rules — the
// only layer that cannot fail open — were emitted at the WORKSPACE default. A session claiming to be
// looser would still meet every prompt its mode promised to remove, so the mode would be announcing an
// enforcement posture the host does not have. Loosening is a change to `mode` in the gate policy: a
// `.portulan/` edit, which is Propose, which is a pull request somebody reads.
//
// Zero dependencies, no network — same constraints as ./compile.mjs, whose definitions this uses so
// that the tool and the runtime gate can never disagree about what a mode means.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CompileError, MODES, declaredMode, effectiveMode, policyPath, readSessionMode, sessionModeFile, writeSessionMode } from "./compile.mjs";

/**
 * The session this command belongs to.
 *
 * `CLAUDE_CODE_SESSION_ID` is measured rather than assumed — it is present in the environment of a
 * Bash tool call on CLI 2.1.220, which is what makes a plain command able to claim an override at all.
 * When it is absent the override is written unclaimed (`session: null`), and an unclaimed record binds
 * nobody: the gate runner compares it against its own session id and ignores a mismatch. So a mode set
 * outside a session degrades to no override rather than to somebody else's.
 */
function sessionId() {
    return process.env.CLAUDE_CODE_SESSION_ID ?? null;
}

export function run(argv, options = {}) {
    const say = (line = "") => {
        if (!options.quiet) process.stdout.write(`${line}\n`);
    };
    const root = options.root ?? process.cwd();
    const session = options.sessionId ?? sessionId();

    try {
        let wanted = null;
        let clear = false;
        for (const arg of argv) {
            if (arg === "--clear") clear = true;
            else if (MODES.has(arg)) wanted = arg;
            else throw new CompileError(`unknown argument ${JSON.stringify(arg)} — expected one of ${[...MODES].join(", ")}, or --clear`);
        }
        if (wanted && clear) throw new CompileError("--clear and a mode are contradictory — pick one");

        let policy = null;
        try {
            policy = JSON.parse(fs.readFileSync(policyPath(root), "utf8"));
        } catch {
            // No readable policy means no declared default to compare against. Reporting is still
            // useful; tightening is not, because there is no floor to tighten from.
            if (wanted) throw new CompileError(`cannot read the gate policy at ${policyPath(root)} — refusing to set a mode against a policy it cannot read`);
        }

        if (clear) {
            try {
                fs.rmSync(sessionModeFile({ root }), { force: true });
            } catch {
                // Already gone, or unwritable. Either way this session now resolves to the default,
                // which is the state --clear was asking for.
            }
            const now = effectiveMode({ policy, root, sessionId: session });
            say(`mode: ${now.mode} (${now.source}) — override cleared`);
            return 0;
        }

        if (wanted) {
            writeSessionMode(wanted, { root, sessionId: session, policy });
            const now = effectiveMode({ policy, root, sessionId: session });
            say(`mode: ${now.mode} (${now.source})`);
            if (now.mode !== wanted) {
                // Written but not in force: the request was not stricter than the default, so nothing
                // changed. Said out loud rather than reported as success, because a tool that answers
                // "done" to a request it did not enact is the fail-open this repository keeps finding.
                say(`  note: \`${wanted}\` is not stricter than the workspace default \`${declaredMode(policy)}\`, so nothing changed`);
            }
            if (session === null) {
                say("  note: no CLAUDE_CODE_SESSION_ID in the environment — this override is unclaimed and the gate runner will ignore it");
            }
            say("  this session only; it does not affect other sessions, the policy, or the compiled artifact");
            return 0;
        }

        const now = effectiveMode({ policy, root, sessionId: session });
        const record = readSessionMode({ root, sessionId: session });
        say(`mode: ${now.mode} (${now.source})`);
        say(`  workspace default   ${policy ? declaredMode(policy) : "unknown — no readable policy"}`);
        say(`  session override    ${record ? `${record.mode}, set ${record.at}` : "none"}`);
        say(`  precedence          session override > workspace default; overrides may tighten, never loosen`);
        say(`  unaffected by mode  the Prohibited tier, and every rule with a scalar tier — settings, deletions, releases, spending`);
        return 0;
    } catch (error) {
        if (!options.quiet) {
            process.stderr.write(`mode: ${error instanceof CompileError ? error.message : `unanticipated failure — ${error.stack ?? error}`}\n`);
        }
        return error instanceof CompileError ? 1 : 2;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = run(process.argv.slice(2), { root: path.resolve(process.cwd()) });
}
