/**
 * `rule-carriers` — the rail that keeps a reduced rule reduced.
 *
 * Proposal `.portulan/proposals/0027-a-reduced-rule-stays-reduced.md`. A rule an incident has reduced
 * to ONE carrier is registered with the spellings its other carriers used; those spellings may then
 * appear only in the carrier, or beside a citation of it.
 *
 * ## What this is NOT
 *
 * It is not a solution to `0020`'s class, and describing it as one would be the capability claim
 * `.portulan/memory/a-stated-enforcer-must-be-the-real-one.md` forbids. `0020` proved no rail can find
 * *this patch's rule's other carriers*, because a rule has no token and the sibling set is exactly what
 * nobody enumerated. That holds. **This operates only after an incident has enumerated a set** — at
 * which point the rule does have a token, namely the spellings actually found — and its job is to stop
 * the reduction being undone. Measured need: on 2026-08-10 one branch removed a hand-maintained count
 * and roster while another re-armed them, and a handoff on `main` is titled
 * *the-correction-merged-and-the-next-pull-request-put-it-back*.
 *
 * A rule nobody registered is covered by nothing, and nothing says so. That is stated in the proposal
 * and repeated here because this file is where a reader checks whether the claim matches the code.
 *
 * ## Scope is a PREFIX, deliberately, and the record layer is out by construction
 *
 * `scope` entries are path prefixes, not globs. A glob language would be a second thing to get wrong,
 * and prefixes are what the domain actually needs: doctrine lives in directories. `exclude` entries are
 * prefixes too and win over `scope`.
 *
 * The record layer — handoffs, proposals, milestone files, the Session log, the changelog — is excluded
 * because it legitimately quotes retired sentences forever: `0004` keeps its own minting words under a
 * dated supersession note, and records here are forward-only. A rail over them would be red on arrival
 * and permanently, which is what `a-superlative-is-a-count-nobody-ran.md` refused a grep over.
 *
 * ## Exit codes — the three-code discipline every recipe here holds
 *
 *   0  no registered spelling appears outside its carrier without a citation
 *   1  at least one does
 *   2  could not run — the registry is unusable, or its own audit fails
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Thrown for every exit-2 condition. Carries the sentence the wrapper prints. */
export class RegistryError extends Error {}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Validate the registry BEFORE it is used, so an unusable rule is could-not-run rather than a rule
 * that quietly covers nothing. The same direction `recipe-set.mjs` takes: the emitter validates
 * before it emits, because "declared" is what a gate treats as "enforced".
 */
export function parseRegistry(source, { where = "registry" } = {}) {
    let raw;
    try {
        raw = JSON.parse(source);
    } catch (cause) {
        throw new RegistryError(`${where} does not parse as JSON — ${cause.message}`);
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new RegistryError(`${where} must be a JSON object`);
    }
    if (!Array.isArray(raw.rules)) {
        throw new RegistryError(`${where} declares no \`rules\` array — could-not-run rather than a set covering nothing`);
    }
    if (raw.rules.length === 0) {
        throw new RegistryError(`${where} declares zero rules — refusing to report green over an empty registry`);
    }

    const seen = new Set();
    const rules = raw.rules.map((rule, i) => {
        const at = `${where} rule ${i}`;
        if (!rule || typeof rule !== "object" || Array.isArray(rule)) throw new RegistryError(`${at} is not an object`);
        const { id, carrier, summary, incident, tells, cites, scope, exclude } = rule;

        if (typeof id !== "string" || !SLUG.test(id)) {
            throw new RegistryError(`${at} has an \`id\` that is not a slug: ${JSON.stringify(id)}`);
        }
        if (seen.has(id)) throw new RegistryError(`${where} declares the rule \`${id}\` more than once`);
        seen.add(id);

        for (const [key, value] of [["carrier", carrier], ["summary", summary], ["incident", incident]]) {
            if (typeof value !== "string" || value.trim() === "") {
                throw new RegistryError(`${at} (\`${id}\`) has no usable \`${key}\``);
            }
        }
        for (const [key, value] of [["tells", tells], ["cites", cites], ["scope", scope]]) {
            if (!Array.isArray(value) || value.length === 0) {
                throw new RegistryError(`${at} (\`${id}\`) has no usable \`${key}\` — a non-empty array is required`);
            }
            for (const entry of value) {
                if (typeof entry !== "string" || entry.trim() === "") {
                    throw new RegistryError(`${at} (\`${id}\`) has an empty entry in \`${key}\``);
                }
                // Untrimmed is refused rather than silently trimmed, matching `cli/compile.mjs`, which
                // does the same for a rule's action and a required context. It matters most for `scope`
                // and `exclude`, which are compared with `startsWith`: a trailing space makes a prefix
                // that can never match any path, so the entry silently covers nothing and the registry
                // still reports green. Refusing is predictable; repairing quietly is not.
                if (entry !== entry.trim()) {
                    throw new RegistryError(
                        `${at} (\`${id}\`) has an untrimmed entry in \`${key}\`: ${JSON.stringify(entry)} — ` +
                            "leading or trailing whitespace silently changes what it matches",
                    );
                }
            }
        }
        if (exclude !== undefined) {
            if (!Array.isArray(exclude) || exclude.some((e) => typeof e !== "string" || e.trim() === "")) {
                throw new RegistryError(`${at} (\`${id}\`) has an unusable \`exclude\``);
            }
            // The rule-level `exclude` needs the untrimmed check too. It did not have one: the check was
            // added to `tells`, `cites`, `scope` and the top-level `exclude` and missed this fourth site
            // — one rule, four enforcement points, repaired at three. The suite caught it, which is the
            // only reason it is not shipping as the defect this whole change is about.
            for (const entry of exclude) {
                if (entry !== entry.trim()) {
                    throw new RegistryError(
                        `${at} (\`${id}\`) has an untrimmed entry in \`exclude\`: ${JSON.stringify(entry)} — ` +
                            "leading or trailing whitespace silently changes what it matches",
                    );
                }
            }
        }
        return {
            id,
            carrier,
            summary,
            incident,
            tells: [...tells],
            cites: [...cites],
            scope: [...scope],
            exclude: exclude ? [...exclude] : [],
        };
    });

    // The top-level `exclude` is validated exactly as a rule's is. It was not, and the gap was not
    // cosmetic: a non-string entry reaches `inDomain`, where `p.startsWith` throws a bare TypeError —
    // so a REGISTRY DEFECT would have surfaced as a stack trace instead of the exit-2 verdict this
    // repository's three-code discipline requires. `could not run` has to be a verdict, not a crash.
    if (raw.exclude !== undefined) {
        if (!Array.isArray(raw.exclude)) {
            throw new RegistryError(`${where} has an \`exclude\` that is not an array`);
        }
        for (const entry of raw.exclude) {
            if (typeof entry !== "string" || entry.trim() === "") {
                throw new RegistryError(`${where} has an unusable entry in \`exclude\`: ${JSON.stringify(entry)}`);
            }
            if (entry !== entry.trim()) {
                throw new RegistryError(
                    `${where} has an untrimmed entry in \`exclude\`: ${JSON.stringify(entry)} — ` +
                        "leading or trailing whitespace silently changes what it matches",
                );
            }
        }
    }

    return { rules, exclude: Array.isArray(raw.exclude) ? [...raw.exclude] : [] };
}

/** A file is in a rule's domain when a scope prefix matches and no exclude prefix does. */
export function inDomain(file, rule, globalExclude = []) {
    // `rule.exclude` is normalised to an array by `parseRegistry`, but this function is exported and a
    // caller can hand it a rule object built by hand — which the suite does, and which threw. An
    // exported predicate that only works on one caller's normalisation is a trap for the next reader.
    const ruleExclude = Array.isArray(rule.exclude) ? rule.exclude : [];
    const scope = Array.isArray(rule.scope) ? rule.scope : [];
    const excluded = [...globalExclude, ...ruleExclude].some((p) => file === p || file.startsWith(p));
    if (excluded) return false;
    return scope.some((p) => file === p || file.startsWith(p));
}

/**
 * Normalise before matching, and this is the part the first run taught rather than the design.
 *
 * Four of the first registry's seven tells matched NOTHING at the commit whose carriers they were
 * copied from, and the dead-tell audit caught all four. Two causes, both already written down in this
 * repository as traps and both walked into anyway:
 *
 *   1. **A markdown link's URL sits inside the phrase.** `.portulan/dod.md` reads
 *      "run each recipe [`workspace.json`](workspace.json) declares" — the literal text carries the
 *      whole link, so a tell spelled the way a human reads the sentence matches nothing. Links are
 *      collapsed to their label first, which is the repair `#211` recorded and this file now applies.
 *   2. **Prose wraps.** `spec/slots.md` breaks "This repository's CI reads / `verify.recipes` from the
 *      manifest" across a newline, so any tell spanning that break fails on a raw `includes`.
 *
 *   3. **Emphasis and code spans sit INSIDE the phrase.** The record documenting the sweep wrote
 *      "every verify recipe the workspace **declares**" — the bold markers fall between the words, so
 *      the tell went dead the moment the live carrier was fixed and only the record still quoted it.
 *
 * Three variants of ONE trap — markup between the words of a sentence — each found by running this
 * instrument rather than reading it, and the third found by forcing the audit red. So both haystack
 * and needle are flattened: links to labels, emphasis and code markers dropped, every whitespace run
 * to one space, lowercased. A tell is then written the way a human READS the sentence, which is the
 * only way anyone will ever write one.
 *
 * Liveness is measured over the whole tracked set INCLUDING the record layer, deliberately. After a
 * successful sweep a retired spelling survives only in the handoff and proposal that recorded it —
 * that is the steady state, not a defect — so records are what keep a correct tell alive. A tell that
 * matches nothing even there was never a real spelling.
 */
export function normalise(text) {
    return text
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[*_`]/g, "")
        .replace(/\s+/g, " ")
        .toLowerCase();
}

const lower = normalise;

/**
 * The scan. `read(file)` returns the file's text; a file that cannot be read is reported rather than
 * skipped, because a check class that disappears quietly is worse than one that says it could not run.
 */
export function scan({ registry, files, read }) {
    const findings = [];
    const unreadable = [];
    const tellSeen = new Map(); // `${ruleId}\u0000${tell}` -> boolean, for the dead-tell audit

    for (const rule of registry.rules) {
        for (const tell of rule.tells) tellSeen.set(`${rule.id}\u0000${tell}`, false);
    }

    for (const file of files) {
        let text;
        try {
            text = read(file);
        } catch (cause) {
            unreadable.push({ file, message: cause.message });
            continue;
        }
        const hay = lower(text);

        for (const rule of registry.rules) {
            // The carrier is where the rule LIVES; its own spellings are the point of it.
            const isCarrier = file === rule.carrier;

            const hits = rule.tells.filter((t) => hay.includes(lower(t)));
            for (const t of hits) tellSeen.set(`${rule.id}\u0000${t}`, true);

            if (isCarrier || hits.length === 0) continue;
            if (!inDomain(file, rule, registry.exclude)) continue;

            const cited = rule.cites.some((c) => hay.includes(lower(c)));
            if (cited) continue;

            findings.push({ rule: rule.id, file, tells: hits, carrier: rule.carrier });
        }
    }

    const deadTells = [];
    for (const [key, found] of tellSeen) {
        if (found) continue;
        const [ruleId, tell] = key.split("\u0000");
        deadTells.push({ rule: ruleId, tell });
    }

    return { findings, deadTells, unreadable };
}

/** The carrier must exist. A rule pointing at a file that is gone is could-not-run, never green. */
export function auditCarriers(registry, { exists }) {
    const absent = [];
    for (const rule of registry.rules) {
        if (!exists(rule.carrier)) absent.push({ rule: rule.id, carrier: rule.carrier });
    }
    return absent;
}

function readList(stdin) {
    const parts = stdin.split("\0").filter((p) => p !== "");
    return parts;
}

export function run(argv = [], { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd(), stdin } = {}) {
    let registryPath = ".portulan/rule-carriers.json";
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--registry") {
            registryPath = argv[++i];
            if (registryPath === undefined) {
                stderr.write("rule-carriers: --registry needs a path\n");
                return 2;
            }
        } else {
            stderr.write(`rule-carriers: unknown argument \`${argv[i]}\`\n`);
            return 2;
        }
    }

    let registry;
    try {
        const abs = path.resolve(cwd, registryPath);
        registry = parseRegistry(fs.readFileSync(abs, "utf8"), { where: registryPath });
    } catch (cause) {
        stderr.write(`rule-carriers: ${cause instanceof RegistryError ? cause.message : `cannot read ${registryPath} — ${cause.message}`}\n`);
        return 2;
    }

    const absent = auditCarriers(registry, { exists: (p) => fs.existsSync(path.resolve(cwd, p)) });
    if (absent.length > 0) {
        for (const a of absent) {
            stderr.write(`rule-carriers: rule \`${a.rule}\` names a carrier that does not resolve: ${a.carrier}\n`);
        }
        return 2;
    }

    const all = readList(stdin ?? "");
    if (all.length === 0) {
        stderr.write("rule-carriers: the file list on stdin is empty — refusing to report green over nothing\n");
        return 2;
    }

    // THE REGISTRY IS NOT A CARRIER, and leaving it in the scanned set defeated the dead-tell audit
    // outright: every tell is spelled in the registry, so every tell found ITSELF and read as alive.
    // The audit reported green over a tell that matches nothing else in the tree — found by forcing
    // it red, not by reading it, and it passed the first demonstration only because the registry was
    // untracked in that scratch worktree.
    // Compared as RESOLVED ABSOLUTE paths, not as strings. `git ls-files -z` always emits `/`, while
    // `path.relative` emits the platform separator — so on Windows the two spellings never matched, the
    // registry was scanned after all, and the self-satisfied dead-tell audit came straight back. A
    // string comparison between a git path and a platform path is a defect wherever it appears.
    const registryAbs = path.resolve(cwd, registryPath);
    const files = all.filter((f) => path.resolve(cwd, f) !== registryAbs);

    const { findings, deadTells, unreadable } = scan({
        registry,
        files,
        read: (f) => fs.readFileSync(path.resolve(cwd, f), "utf8"),
    });

    if (unreadable.length > 0) {
        for (const u of unreadable) stderr.write(`rule-carriers: cannot read ${u.file} — ${u.message}\n`);
        return 2;
    }

    if (deadTells.length > 0) {
        for (const d of deadTells) {
            stderr.write(
                `rule-carriers: rule \`${d.rule}\` registers a tell that matches nothing in the tree: ${JSON.stringify(d.tell)}\n` +
                    "  Either the rule was rewritten and the registry was not, or the tell was wrong when it was written.\n",
            );
        }
        return 2;
    }

    if (findings.length > 0) {
        for (const f of findings) {
            stdout.write(
                `${f.file}: carries rule \`${f.rule}\` (${f.tells.map((t) => JSON.stringify(t)).join(", ")}) ` +
                    `without citing ${f.carrier}\n`,
            );
        }
        stdout.write(
            `\n${findings.length} carrier(s) restate a registered rule instead of citing it. ` +
                "Point the sentence at the carrier, or add the citation.\n",
        );
        return 1;
    }

    stdout.write(`rule-carriers: ${registry.rules.length} registered rule(s), ${files.length} file(s) examined, no restatement\n`);
    return 0;
}

// `fileURLToPath`, never `new URL(...).pathname`: this repository's own working copy lives under
// "Sleepy Panda Projects", and a URL pathname percent-encodes the spaces, so the comparison silently
// failed and the tool exited 0 having run nothing. Found by RUNNING it — reading it looked right.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => {
        process.exitCode = run(process.argv.slice(2), { stdin: Buffer.concat(chunks).toString("utf8") });
    });
}
