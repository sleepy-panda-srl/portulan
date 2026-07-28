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
// A **mode** is how often the development cycle stops for approval — `autonomous` never, `ship-gate`
// once at the ship step, `strict` at every push and the ship step. The doctrine is in
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
 * nobody: `readSessionMode` refuses to match an absent session id on either side, so it is ignored by
 * readers that have a session AND by readers that lack one — absence is not an identity. A mode set
 * outside a session therefore degrades to no override, even where the gate runner's own
 * `payload.session_id` is missing.
 */
function sessionId() {
    return process.env.CLAUDE_CODE_SESSION_ID ?? null;
}

/**
 * The workspace root: the nearest ancestor (start included) whose `.portulan/` resolves a gate
 * policy. The override record is keyed by this root, so the command must answer identically from
 * anywhere inside the tree — run from a subdirectory, a cwd default would look for the policy in
 * the wrong place AND key the record to a workspace that does not exist, so an override set at the
 * root would silently not be the one a subdirectory query reads. When no ancestor carries a
 * policy, the start directory is returned unchanged: the report then says "no readable policy"
 * about the place the caller actually stood, which is the honest answer.
 */
export function findRoot(start) {
    let dir = start;
    for (;;) {
        if (fs.existsSync(policyPath(dir))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) return start;
        dir = parent;
    }
}


export function run(argv, options = {}) {
    const say = (line = "") => {
        if (!options.quiet) process.stdout.write(`${line}\n`);
    };
    const root = options.root ?? process.cwd();
    const session = options.sessionId ?? sessionId();
    // Where the override record lives. `dir` is the same test seam the library functions take;
    // absent, the record is in the OS temp directory as always.
    const loc = { dir: options.dir, root, sessionId: session };

    try {
        let wanted = null;
        let clear = false;
        for (const arg of argv) {
            if (arg === "--clear") clear = true;
            else if (MODES.has(arg)) {
                // Two different modes in one invocation is a contradiction, and taking the last
                // would resolve it by position — silently, which is how a session meaning `strict`
                // ends up claiming `autonomous`. Refused instead. Repeating the same mode is inert.
                if (wanted !== null && wanted !== arg) {
                    throw new CompileError(`two modes given — \`${wanted}\` and then \`${arg}\`. A request that contradicts itself is refused, not resolved by position.`);
                }
                wanted = arg;
            } else throw new CompileError(`unknown argument ${JSON.stringify(arg)} — expected one of ${[...MODES].join(", ")}, or --clear`);
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
            // `sessionId` is passed, and leaving it out was a real defect for one review round. The
            // record is keyed by session AND tree, so `sessionModeFile({ root })` names the *unclaimed*
            // record — a different file. `--clear` deleted that one, found nothing, and reported
            // "override cleared" while this session's actual override sat untouched and still in force.
            // A tool that reports success for work it did not do is worse than one that fails: the
            // operator stops looking. Found by review on the pull request.
            try {
                fs.rmSync(sessionModeFile(loc), { force: true });
            } catch (error) {
                // `force: true` already tolerates a missing file, so reaching this catch means the
                // record exists and could not be removed — the override is STILL IN FORCE. Printing
                // "override cleared" here would be the exact lie this command's header promises not
                // to tell: success reported for work not done, and the operator stops looking.
                if (!options.quiet) {
                    process.stderr.write(`mode: could not remove the override at ${sessionModeFile(loc)} — ${error.code ?? error.message}. The override is still in force.\n`);
                }
                return 2;
            }
            const now = effectiveMode({ policy, ...loc });
            say(`mode: ${now.mode} (${now.source}) — override cleared`);
            return 0;
        }

        if (wanted) {
            writeSessionMode(wanted, { ...loc, policy });
            const now = effectiveMode({ policy, ...loc });
            say(`mode: ${now.mode} (${now.source})`);
            if (session === null) {
                // The unclaimed case explains itself and must speak alone: the record bound nobody,
                // so `now.mode !== wanted` here says nothing about strictness — printing the
                // not-stricter note too would hand the operator a false reason.
                say("  note: no CLAUDE_CODE_SESSION_ID in the environment — this override is unclaimed and binds nobody: a missing session id never matches, on either side of the comparison");
            } else if (now.mode !== wanted) {
                // Written but not in force: the request was not stricter than the default, so nothing
                // changed. Said out loud rather than reported as success, because a tool that answers
                // "done" to a request it did not enact is the fail-open this repository keeps finding.
                say(`  note: \`${wanted}\` is not stricter than the workspace default \`${declaredMode(policy)}\`, so nothing changed`);
            }
            say("  this session only; it does not affect other sessions, the policy, or the compiled artifact");
            return 0;
        }

        const now = effectiveMode({ policy, ...loc });
        const record = readSessionMode(loc);
        say(`mode: ${now.mode} (${now.source})`);
        // The default line must not crash the report it belongs to: a policy can be readable JSON
        // and still declare no usable mode, and that is a fact to print, not a reason to exit 2.
        let declared = "unknown — no readable policy";
        if (policy) {
            try {
                declared = declaredMode(policy);
            } catch {
                declared = "invalid — the policy declares no usable mode";
            }
        }
        say(`  workspace default   ${declared}`);
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
    process.exitCode = run(process.argv.slice(2), { root: findRoot(path.resolve(process.cwd())) });
}
