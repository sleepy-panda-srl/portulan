#!/usr/bin/env node
// Host plugin-cache discovery — reading a host's installed-plugin record so a POINTER can be
// resolved to the workspace it names.
//
// Row 7 of `../docs/plan.md` owns this, by the amendment of 2026-08-03: *"reading a host's
// installed-plugin record to resolve an installed workspace or pack, resolving a pointer's
// `governed_by` to the workspace it names (a cache hit, or the honest not installed here
// sentence)"*. The same amendment fixes where the answer is produced and where it is merely
// reported: **the boot is a skill, and real resolution stays the CLI's.** So this file resolves and
// `../plugin/skills/portulan/SKILL.md` reports what it says.
//
// ## What this closes, and what it deliberately leaves open
//
// [#134](https://github.com/sleepy-panda-works/portulan/issues/134)'s boot half: a workspace
// delivered by a private feed was invisible to `/portulan`, because the boot looked at exactly one
// path and nothing anywhere resolved `governed_by`. The pointer kind landed at Workspace Definition
// 2.7 with proposal `0017` and named the governing workspace; nothing dereferenced the name.
//
// **`--pack-root` is NOT wired to this file**, and that is a boundary rather than an oversight.
// Making a named root optional where discovery finds one is
// [#123](https://github.com/sleepy-panda-works/portulan/issues/123)'s half of the same amendment; it
// changes what `compile`, `doctor` and `index` already do with `packs`, and #117 established a
// property that a careless wiring would end — **a named root REPLACES the `tree`-derived one**, so
// *"this pack resolved from the feed"* cannot be satisfied by a copy lying in the local tree. The
// row states the direction discovery must take when that lands: it **adds a root only where none was
// named**, and never replaces one that was. Nothing here adds a root at all.
//
// ## Four states, because three of them are not "no"
//
// A resolver with two answers is the fail-open this repository keeps minting rules about
// (`../.portulan/memory/verify-preconditions-fail-closed.md`): *could not look* must never read as
// *nothing wrong*, and *two candidates* must never read as *this one*.
//
//   `resolved`       exactly one installed plugin carries a workspace manifest whose `name` is the
//                    one the pointer asks for. The root is the directory that manifest sits in.
//   `not-installed`  nothing on this host carries it — including the case where the host has no
//                    installed-plugin record at all, which is a host with nothing installed.
//   `ambiguous`      two or more distinct roots answer to the name. REFUSED, both named. Picking one
//                    would be booting on a workspace the project did not ask for while looking
//                    exactly like success, which is the failure the boot skill's step 2 exists for.
//   `could-not-look` the record is there and could not be read or parsed. Never reported as absence.
//
// ## What it matches on, and why that is the manifest rather than the plugin
//
// A pointer names a **workspace**, by the `name` the governing workspace's own manifest carries —
// `spec/workspace.schema.json` says so of `governed_by.workspace`, on the same slug definition, "so
// a pointer and its target cannot drift into different spellings of one identifier". A plugin name
// is a different identifier in a different namespace, and the two agreeing on this machine today is
// a coincidence of naming rather than a contract. So every candidate's `workspace.json` is read and
// its `name` compared. A cache hit is a hit on the manifest.
//
// ## Three limits, stated rather than left to be found
//
//  1. **Two candidate locations per plugin, named.** `<installPath>/workspace.json` and
//     `<installPath>/.portulan/workspace.json` — the payload that IS a workspace, and the payload
//     that is a repository carrying one. A recursive walk would find more and would be the matcher
//     clever enough to be wrong quietly that `../.portulan/gate-map.md` refuses elsewhere; a limit a
//     reader can measure is worth more here than reach.
//  2. **Nothing is fetched.** No network call, ever — not by this file and not by anything it is
//     wired into. A workspace that is not installed is not installed, and the row puts feed
//     authentication and discovery of the uninstalled explicitly out of scope.
//  3. **A resolved workspace is not a graded workspace.** This says where it is. Whether it is green
//     is `doctor`'s answer about THAT directory, and running it is the caller's business.
//
// ## It is also runnable, and that is a seam rather than a convenience
//
//   node cli/discover.mjs [--json] <workspace-dir>
//
// The boot skill has to get a DIRECTORY out of this, and the only other route was reading `doctor`'s
// prose — a sentence this very change rewrites, parsed by an agent, with no field to key on. So there
// is a surface, and `--json` is the machine-readable half of it.
//
// **This is not a ninth `portulan` subcommand.** `docs/vision.md` names eight and is human-owned;
// `plugin-lint` and `librarian` are the standing precedent for a tool that lives in `cli/`, runs as
// `node cli/<tool>.mjs`, and is deliberately absent from `./portulan.mjs`'s list. Whether this ever
// joins that list is the maintainer's call, exactly as theirs is.
//
// Exit codes are the three this repository uses everywhere: **0** resolved — **and also
// `resides-here`**, the answer for a manifest that is not a pointer at all · **1** a verdict that the
// workspace is not resolvable here (`not-installed`, `ambiguous`) · **2** could not run or could not
// look. The split matters at the one place it is read: *could not look* must never be spendable as
// *not installed*.
//
// **`state` is the field to key on, not the code.** Two states share exit 0 and no exit code can tell
// them apart — that is the cost of answering the question for both kinds of manifest rather than
// pushing the case analysis back onto the caller, and it is a cost rather than a defect. _(This
// paragraph said "**0** resolved" alone until #182 item 3: a sentence narrower than the code it
// described, committed in the same change that corrected that exact shape in eleven other carriers.
// Copilot, round 4 on #181.)_
//
// Zero dependencies, Node built-ins only, and every environment input injectable — the host config
// directory is read from `env`, so a test never depends on the machine it runs on.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** The plugin-record filename and its directory, both the host's rather than ours. */
export const RECORD = path.join("plugins", "installed_plugins.json");

/**
 * The record schema versions this reader claims to understand. Measured: `2` on Claude Code 2.1.226.
 *
 * Exported because it is a limit, and because refusing an unrecognised version is a **decision** rather
 * than an oversight. The file belongs to the host, not to us: a later version may move `installPath`,
 * rename it, or nest it, and a reader that parsed on regardless would report roots that are not roots —
 * a confident wrong answer, which is the class this module's four states exist to prevent. So an
 * unknown version is `unreadable`, which reaches a caller as **could-not-look** and never as
 * *not installed*.
 *
 * The cost is stated rather than hidden: on the day the host bumps to `3`, discovery stops here until
 * this set is widened by someone who has looked. That is the direction
 * `../.portulan/memory/a-checker-must-refuse-what-it-cannot-check.md` requires, and the opposite
 * failure — silently resolving against a shape nobody verified — is the one that cannot be noticed.
 *
 * _(Raised by the session building `--pack-root auto` on #183, which had the guard on its own reader and
 * flagged its absence here before the two modules were reconciled. Verified against the live record
 * rather than accepted: it carries `"version": 2`.)_
 */
export const RECORD_VERSIONS = new Set([2]);

/**
 * Where a candidate plugin payload may carry a workspace manifest, in the order tried.
 *
 * Exported because it is a limit, and a limit nobody can enumerate is a limit nobody can check —
 * the suite asserts this list rather than restating it.
 */
export const MANIFEST_AT = ["workspace.json", path.join(".portulan", "workspace.json")];

/**
 * The host's configuration directory.
 *
 * `CLAUDE_CONFIG_DIR` overrides it — that is the host's documented escape hatch and it is the reason
 * this takes an `env` at all rather than reading `process.env` at the point of use. An empty string
 * is treated as unset: an exported-but-blank variable is a shell accident, and honouring it would
 * point discovery at **the process's working directory**, since `path.resolve("")` is `cwd` and not
 * `/` — a plausible-looking answer to a question nobody asked, and worse than an obvious one because
 * it changes with where the tool was invoked from.
 *
 * _(This said "the filesystem root" until #182's round, which is wrong about `path.resolve` and was
 * contradicted by this function's own test one file away — the same two-carriers-one-fact shape this
 * change corrected in eleven other places, here in the docblock of the guard the fix cites as its
 * precedent. Copilot, on the round reviewing the records.)_
 */
export function configDir({ env = process.env, home = os.homedir() } = {}) {
    const named = env.CLAUDE_CONFIG_DIR;
    if (typeof named === "string" && named.trim() !== "") return path.resolve(named);
    return path.join(home, ".claude");
}

/** The installed-plugin record's path for a host. */
export function recordPath(options = {}) {
    return path.join(configDir(options), RECORD);
}

/**
 * Read the host's installed-plugin record.
 *
 * Returns `{ state, path, entries, detail }` where `state` is one of `read` · `absent` ·
 * `unreadable`. The three are kept apart at the source because collapsing them is exactly how a
 * resolver starts answering "not installed" to a question it never asked.
 *
 * `entries` is flat — the record maps `<plugin>@<marketplace>` to an ARRAY, one per install scope,
 * and a caller reasoning about roots wants the installs rather than the grouping. Malformed
 * individual entries are dropped rather than taking the whole read down: one plugin's bad record
 * should not blind discovery to every other plugin on the host.
 */
export function readInstalls(options = {}) {
    const file = recordPath(options);
    let raw;
    try {
        raw = fs.readFileSync(file, "utf8");
    } catch (cause) {
        // ENOENT is a host with nothing installed — or no host at all, which is CI. Every other
        // errno is a file that exists and would not open, which is a different fact and gets a
        // different word.
        if (cause.code === "ENOENT") return { state: "absent", path: file, entries: [], detail: null };
        return { state: "unreadable", path: file, entries: [], detail: cause.code ?? cause.message };
    }
    let record;
    try {
        record = JSON.parse(raw);
    } catch (cause) {
        return { state: "unreadable", path: file, entries: [], detail: `not JSON — ${cause.message}` };
    }
    // `Array.isArray` is checked on BOTH the record and its `plugins`, and the second was missing — the
    // sibling of a guard sitting one clause away. `typeof [] === "object"`, so `{"plugins": []}` read as
    // a healthy record with nothing installed, and a malformed file collapsed into `not-installed`:
    // *could not look* spent as absence, which is the one thing this file's four states exist to prevent.
    // Found by Copilot, round 2, in a function whose own docblock argues that the three read states are
    // kept apart at the source.
    if (record === null || typeof record !== "object" || Array.isArray(record) || typeof record.plugins !== "object" || record.plugins === null || Array.isArray(record.plugins)) {
        return { state: "unreadable", path: file, entries: [], detail: "no `plugins` object — this is not an installed-plugin record" };
    }
    // The version is checked BEFORE the entries are read, because it is the claim that makes reading them
    // meaningful: `installPath` means what it means in version 2, and this reader has only ever seen
    // version 2. Refused rather than parsed hopefully — see RECORD_VERSIONS for the argument and its cost.
    if (!RECORD_VERSIONS.has(record.version)) {
        return {
            state: "unreadable",
            path: file,
            entries: [],
            detail:
                `record version ${JSON.stringify(record.version)} is not one this reader understands ` +
                `(${[...RECORD_VERSIONS].join(", ")}) — refusing rather than reading a shape nobody has verified`,
        };
    }
    const entries = [];
    for (const [key, installs] of Object.entries(record.plugins)) {
        if (!Array.isArray(installs)) continue;
        // `<plugin>@<marketplace>`, split on the LAST `@` so a scoped plugin name keeps its own.
        const at = key.lastIndexOf("@");
        const plugin = at > 0 ? key.slice(0, at) : key;
        const marketplace = at > 0 ? key.slice(at + 1) : null;
        for (const install of installs) {
            if (install === null || typeof install !== "object") continue;
            if (typeof install.installPath !== "string" || install.installPath === "") continue;
            entries.push({
                key,
                plugin,
                marketplace,
                installPath: path.resolve(install.installPath),
                version: typeof install.version === "string" ? install.version : null,
                scope: typeof install.scope === "string" ? install.scope : null,
                gitCommitSha: typeof install.gitCommitSha === "string" ? install.gitCommitSha : null,
            });
        }
    }
    return { state: "read", path: file, entries, detail: null };
}

/**
 * Read a candidate manifest, returning `{ manifest, name, kind }` or `null`.
 *
 * Unreadable and unparseable are both `null` and both deliberate: a plugin payload carrying
 * something that is not a workspace manifest at one of the two named paths is simply not a
 * candidate, and a resolver that failed loudly on every unrelated `workspace.json` on the host would
 * be unusable. What it must never do is COUNT such a file as a match, and returning `null` is that.
 *
 * **`name` alone is not enough to say a file is a workspace manifest, and requiring only `name` was a
 * fail-open.** Found at the pre-commit checkpoint by building it rather than by reading this
 * function: a plugin payload carrying an Nx-style `workspace.json` — `{"version": 2, "name": "…",
 * "projects": {…}}`, no `portulan` key, no `kind` — resolved, exit 0, and the boot would have been
 * pointed at it. `workspace.json` is a common filename in the wider ecosystem, so that is an ordinary
 * file rather than a contrived one, and the docblock above already promised it was not a candidate.
 *
 * The gate is `portulan` **and** `name`, which is the Workspace Definition's required identity minus
 * `kind` — `kind` is read here for the pointer refusal and is not required, because a manifest
 * missing it is schema-invalid and that is `doctor`'s verdict about the directory rather than
 * discovery's. **This is deliberately not a second schema validator**: it is the cheapest test that
 * distinguishes *a Portulan workspace manifest* from *a file that happens to share the name*, and
 * conformance stays the one tool that owns it.
 */
function readCandidate(root) {
    for (const rel of MANIFEST_AT) {
        const file = path.join(root, rel);
        let parsed;
        try {
            parsed = JSON.parse(fs.readFileSync(file, "utf8"));
        } catch {
            continue;
        }
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) continue;
        if (typeof parsed.name !== "string") continue;
        // `portulan.spec`, not merely a `portulan` key. An empty object satisfied the first cut of this
        // gate, so a non-Portulan file could still qualify by carrying one — the same fail-open one
        // tightening later (Copilot, round 2). `spec` is what the Workspace Definition REQUIRES of the
        // block, so this keys on the contract rather than on a key's presence; the pattern is left to
        // `doctor`, which owns conformance.
        if (parsed.portulan === null || typeof parsed.portulan !== "object" || Array.isArray(parsed.portulan)) continue;
        if (typeof parsed.portulan.spec !== "string") continue;
        return { manifest: file, dir: path.dirname(file), name: parsed.name, kind: typeof parsed.kind === "string" ? parsed.kind : null };
    }
    return null;
}

/**
 * Resolve a pointer's `governed_by` against a host's plugin cache.
 *
 * `governedBy` is the manifest's own object — `{ workspace, feed }`. `feed`, where present,
 * CONSTRAINS: it names the marketplace the workspace ships through, and an install from a different
 * marketplace is not the thing the pointer asked for however well its name matches. That near miss
 * is reported rather than swallowed, because "the right name from the wrong feed" is a diagnosis a
 * reader needs and an absence sentence would hide.
 *
 * Returns a verdict carrying its own `sentence` — one carrier, so every surface that reports this
 * prints the same words rather than paraphrasing them into four slightly different claims.
 */
export function resolveGovernor(governedBy, options = {}) {
    // **Blank is unset on both, which is `configDir()`'s rule applied at a second site of the same
    // operation** — and blank-testing is the whole of it: the value that survives is the RAW one, never
    // a trimmed copy.
    //
    // The two halves are different classes and the difference is worth stating, because a fix that
    // flattened them would be claiming to close more than it does. `governed_by.feed` is
    // `type: string, minLength: 1` in the Workspace Definition and nothing more, so `"   "` **validates**
    // — it constrained every candidate to a marketplace of that name, matched nothing, and answered
    // `not-installed` about a workspace that is installed, which is the real defect and the class the
    // four verdicts exist to prevent. `governed_by.workspace` is a `slug`, so `"   "` is
    // **schema-invalid** and `doctor` refuses it before anything reaches here: that half is
    // defence-in-depth on this file's own runnable seam rather than a hole in the schema.
    //
    // **Not trimmed, deliberately, and the reason is a measurement.** Trimming only the wanted side makes
    // `" sleepy-panda "` in a pointer match `sleepy-panda` on disk while the same padding ON DISK still
    // misses — a new asymmetry, and discovery quietly repairing a manifest the slug pattern refuses,
    // which `readCandidate` above promises it is not doing. `configDir()` blank-tests and hands
    // `path.resolve` the raw string for the same reason; normalising identifiers is conformance's job and
    // conformance is `doctor`'s. Found at the pre-commit checkpoint, which built the padded case rather
    // than reading the diff — the first draft here trimmed, and turned a `resolved` into a
    // `not-installed`.
    //
    // Copilot, #181 rounds 3 and 4; filed as #182 item 1 at the bound and taken here on the maintainer's
    // grant of an extension, recorded in this pull request's own conversation.
    const named = (value) => (typeof value === "string" && value.trim() !== "" ? value : null);
    const wanted = {
        workspace: named(governedBy?.workspace),
        feed: named(governedBy?.feed),
    };
    const verdict = (state, extra) => ({
        state,
        wanted,
        root: null,
        manifest: null,
        plugin: null,
        marketplace: null,
        version: null,
        matches: [],
        nearMisses: [],
        record: null,
        ...extra,
    });

    if (wanted.workspace === null) {
        // A pointer with no `governed_by.workspace` is refused by `doctor` and by the schema before
        // anything reaches here. Guarded anyway: a resolver asked to find "undefined" must say what
        // it was asked rather than search for it.
        return verdict("could-not-look", {
            sentence: "this pointer names no governing workspace, so there is nothing to resolve — `governed_by.workspace` is required of a pointer",
        });
    }

    const installs = options.installs ?? readInstalls(options);
    const where = installs.path;
    if (installs.state === "unreadable") {
        return verdict("could-not-look", {
            record: where,
            sentence:
                `the host's installed-plugin record at \`${where}\` could not be read (${installs.detail}), so whether ` +
                `\`${wanted.workspace}\` is installed here is unknown — this is *could not look*, never *not installed*`,
        });
    }
    if (installs.state === "absent") {
        return verdict("not-installed", {
            record: where,
            sentence:
                `\`${wanted.workspace}\` is not installed here — this host has no installed-plugin record at ` +
                `\`${where}\`, so nothing is installed for it to be among. Nothing was fetched: discovery reads ` +
                "what is on disk and never the network",
        });
    }

    const matches = [];
    const nearMisses = [];
    for (const entry of installs.entries) {
        const found = readCandidate(entry.installPath);
        if (found === null || found.name !== wanted.workspace) continue;
        const candidate = { ...entry, manifest: found.manifest, root: found.dir, kind: found.kind };
        if (wanted.feed !== null && entry.marketplace !== wanted.feed) {
            nearMisses.push({ ...candidate, why: "feed" });
            continue;
        }
        if (found.kind === "pointer") {
            // A pointer resolving to a pointer is a chain, and the residence ruling permits none: a
            // repository is governed by exactly one workspace. Refused as a near miss rather than
            // silently skipped, because the reader needs to know the name WAS found.
            nearMisses.push({ ...candidate, why: "pointer" });
            continue;
        }
        matches.push(candidate);
    }

    // Distinct roots, because one workspace installed at two scopes is two record entries and one
    // directory, and refusing that would be refusing the ordinary case.
    const roots = [...new Set(matches.map((m) => m.root))];
    if (roots.length > 1) {
        return verdict("ambiguous", {
            record: where,
            matches,
            nearMisses,
            sentence:
                `\`${wanted.workspace}\` resolves to ${roots.length} installed workspaces here — ` +
                `${matches.map((m) => `\`${m.key}\` at \`${m.root}\``).join(", ")}. Refusing to pick one: booting on a ` +
                "workspace the repository did not ask for looks exactly like a boot and is not one",
        });
    }
    if (roots.length === 1) {
        const hit = matches[0];
        return verdict("resolved", {
            record: where,
            matches,
            nearMisses,
            root: hit.root,
            manifest: hit.manifest,
            plugin: hit.plugin,
            marketplace: hit.marketplace,
            version: hit.version,
            sentence:
                `\`${wanted.workspace}\` is installed here — \`${hit.key}\`` +
                (hit.version ? ` version ${hit.version}` : "") +
                `, its manifest at \`${hit.manifest}\`. That directory is the workspace this repository is governed by`,
        });
    }
    return verdict("not-installed", {
        record: where,
        nearMisses,
        sentence:
            `\`${wanted.workspace}\` is not installed here — nothing among the ${installs.entries.length} install(s) ` +
            `recorded at \`${where}\` carries a workspace manifest of that name` +
            (nearMisses.length
                ? `. ${nearMisses
                      .map((m) =>
                          m.why === "feed"
                              ? `\`${m.key}\` carries that name and ships through ${
                                    // `marketplace` is null wherever the record key carries no `@` — a shape
                                    // `readInstalls` tolerates on purpose, so the sentence has to survive it.
                                    // It printed "ships through `null`", which reads as a marketplace called
                                    // null rather than as one nobody recorded. Copilot, on the round that
                                    // reviewed the fix; the same class as the note beside it.
                                    m.marketplace === null ? "no marketplace the record names" : `\`${m.marketplace}\``
                                }, which is not the feed \`${wanted.feed}\` this pointer names`
                              : `\`${m.key}\` carries that name and is itself a pointer, and a repository is governed by exactly one workspace`,
                      )
                      .join("; ")}`
                : "") +
            ". Nothing was fetched: discovery reads what is on disk and never the network",
    });
}

// ===========================================================================================
// The command — the seam the boot skill reads
// ===========================================================================================

/**
 * Which exit code each verdict carries. Exported so the suite asserts the mapping rather than a literal.
 *
 * **This maps the RESOLVER's four states, and `run()` carries a fifth answer of its own.** A directory
 * whose manifest is not a pointer is answered `resides-here` and exits **0** without consulting this
 * table — so exit 0 does not identify a state, and `state` is the field a caller keys on. Said here
 * rather than left implicit, because a table named `EXIT` with four entries reads as the whole contract
 * (#182 item 3).
 */
export const EXIT = { resolved: 0, "not-installed": 1, ambiguous: 1, "could-not-look": 2 };

/**
 * Resolve the pointer at `<workspace-dir>/workspace.json` and print the answer.
 *
 * The argument is a **workspace directory**, the same thing `doctor` takes, so a caller holding one
 * path can hand it to either tool. A directory carrying a governing manifest is not an error and not
 * a resolution: it is answered as *this repository's workspace resides here*, exit 0, because the
 * question "where is the workspace that governs this" has a true answer for both kinds and a tool
 * that only understood one of them would push the case analysis back onto its caller.
 */
export function run(argv, options = {}) {
    const say = options.say ?? ((line) => process.stdout.write(`${line}\n`));
    const warn = options.warn ?? ((line) => process.stderr.write(`${line}\n`));
    const json = argv.includes("--json");
    const dirs = argv.filter((a) => !a.startsWith("-"));
    // An unknown flag is REFUSED rather than dropped, and this is the boot's contract rather than
    // tidiness: `--jsonn <ptr>` used to print prose and exit 0, so a typo — or a later rename of this
    // flag — silently degraded the machine-readable answer into the half the skill is told never to
    // read, with a success code on top. `./doctor.mjs` already guards leading-`-` arguments; found at
    // the pre-commit checkpoint by typing the typo rather than by reading the filter.
    const KNOWN = new Set(["--json", "--help", "-h"]);
    const unknown = argv.filter((a) => a.startsWith("-") && !KNOWN.has(a));
    if (unknown.length) {
        warn(`discover: unknown option ${unknown.map((f) => `\`${f}\``).join(", ")} — refusing rather than ignoring it, because a dropped flag here returns prose where a caller asked for JSON.`);
        warn("usage: node cli/discover.mjs [--json] <workspace-dir>");
        return 2;
    }
    if (argv.includes("--help") || argv.includes("-h")) {
        say("usage: node cli/discover.mjs [--json] <workspace-dir>");
        say("");
        say("Resolves a `kind: pointer` manifest's `governed_by` against the host's installed-plugin");
        say("record. Reads what is on disk; never the network.");
        say("Exit: 0 resolved — and also `resides-here`, a manifest that is not a pointer · 1 not");
        say("resolvable here (`not-installed`, `ambiguous`) · 2 could not run or could not look.");
        say("Key on `state`: two states share exit 0 and the code cannot tell them apart.");
        return 0;
    }
    if (dirs.length !== 1) {
        warn("usage: node cli/discover.mjs [--json] <workspace-dir>");
        return 2;
    }
    const manifestPath = path.join(path.resolve(dirs[0]), "workspace.json");
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (cause) {
        warn(`discover: no readable manifest at ${manifestPath} — ${cause.message}`);
        return 2;
    }
    if (manifest?.kind !== "pointer") {
        // Answered rather than refused, and the shape is the same object so a caller keys on `state`
        // either way. `resides-here` is not one of the resolver's four: those are answers about a
        // HOST, and this is an answer about the argument.
        const verdict = {
            state: "resides-here",
            root: path.dirname(manifestPath),
            manifest: manifestPath,
            wanted: null,
            sentence:
                `this manifest is \`kind: ${manifest?.kind ?? "unknown"}\`, not a pointer — the workspace governing this ` +
                `repository resides at \`${path.dirname(manifestPath)}\` and nothing needs resolving`,
        };
        say(json ? JSON.stringify(verdict, null, 2) : verdict.sentence);
        return 0;
    }
    const verdict = resolveGovernor(manifest.governed_by, options);
    say(json ? JSON.stringify(verdict, null, 2) : verdict.sentence);
    return EXIT[verdict.state] ?? 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = run(process.argv.slice(2));
}
