#!/usr/bin/env node
// `doctor` — the Workspace Definition validator.
//
//   node cli/doctor.mjs <workspace-dir> [<workspace-dir> ...]
//
// Exit 0 every workspace validates · 1 at least one does not · 2 could not run.
//
// The third code is the one that carries weight here. A verdict ABOUT a workspace — a missing
// manifest, a slot pointing nowhere, a rule with no provenance — is exit 1: the tool ran and
// judged. Exit 2 means the tool could not judge at all: no arguments, an unreadable schema, an
// unanticipated throw. Borrowing 1 for the last of those would claim a judgement nobody made,
// which is the laundering already fixed once in ../.portulan/tools/gh-bot-token.mjs.
//
// Zero dependencies and no install step, deliberately — ../.portulan/identity.md places doctor at
// milestone 2 as "zero-dependency JavaScript on Node, run from the repository", absorbed by the
// TypeScript CLI at milestone 7. Nothing here touches the network: a check that fails for reasons
// unrelated to the change under test is worse than no check (../.portulan/verify/README.md).
//
// What it does NOT do is written next to what it does, in ../spec/slots.md and in ../cli/README.md.
// The short list: it never runs a verify recipe, never dereferences a link, never judges whether a
// sealed stamp is true, and never scores agent-legibility.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SCHEMA = path.resolve(HERE, "..", "spec", "workspace.schema.json");

/** Raised when `doctor` cannot run at all. Always exit 2, never 1. */
export class DoctorError extends Error {
    constructor(message) {
        super(message);
        this.name = "DoctorError";
    }
}

// ===========================================================================================
// 1. The schema subset
// ===========================================================================================
//
// spec/README.md names the exact JSON Schema subset this validator implements, on the reasoning
// that a validator carried rather than depended on must be small enough to implement completely
// and honestly. The list below IS that sentence, in a form that fails.
//
// Everything outside it is refused rather than ignored — which is the point. A validator that
// skips the keywords it does not know reports conformance it never checked: the author wrote a
// constraint, the machine agreed, and nothing enforced it. That is the same fail-open shape this
// repository has now minted three rules about (../.portulan/memory/verify-preconditions-fail-closed.md),
// and a validator is exactly where a fourth would hide.

// Each supported keyword, with what a well-formed VALUE for it looks like. Knowing the name is not
// enough: `pattern: "["` and `enum: "repository"` are both inside the subset by name and neither can
// be honoured, and without this table they surface at instance-validation time as a raw SyntaxError
// or TypeError — an "unanticipated failure" (exit 2) naming no keyword and no location, from a defect
// that is squarely in the schema. Refusing at compile time is the same rule one level finer: the unit
// this validator must refuse is a constraint it cannot apply, not merely a word it does not know.
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isCount = (v) => typeof v === "number" && Number.isInteger(v) && v >= 0;
const regexCompiles = (v) => {
    if (typeof v !== "string") return false;
    try { new RegExp(v); return true; } catch { return false; }
};

const SUPPORTED = {
    $schema: (v) => typeof v === "string",
    $id: (v) => typeof v === "string",
    $defs: isObject,
    $ref: (v) => typeof v === "string",
    title: (v) => typeof v === "string",
    description: (v) => typeof v === "string",
    // Constrained to the names `check` can actually test. `type: "integer"` would otherwise be
    // accepted here and then match nothing, failing every instance — loud, but for the wrong reason.
    type: (v) => ["object", "array", "string", "number", "boolean", "null"].includes(v),
    properties: isObject,
    required: (v) => Array.isArray(v) && v.every((n) => typeof n === "string"),
    additionalProperties: (v) => v === false,
    items: isObject,
    enum: (v) => Array.isArray(v) && v.length > 0,
    pattern: regexCompiles,
    minLength: isCount,
    minItems: isCount,
    uniqueItems: (v) => typeof v === "boolean",
    oneOf: (v) => Array.isArray(v) && v.length > 0 && v.every(isObject),
};

const SHAPE = {
    $defs: "an object", properties: "an object", items: "a schema object",
    required: "an array of strings", enum: "a non-empty array",
    oneOf: "a non-empty array of schema objects",
    pattern: "a string that compiles as a regular expression",
    minLength: "a non-negative integer", minItems: "a non-negative integer",
    uniqueItems: "a boolean",
    type: "one of object, array, string, number, boolean, null",
    additionalProperties:
        "literal false — only that form is in the subset, and a schema-valued form would let unknown " +
        "keys through a check this validator does not implement",
};

// Siblings a `$ref` may carry. Annotations only: they describe, they never constrain, so they
// cannot silently narrow what the ref resolves to. Used where a field reuses a shared definition
// and still deserves its own prose — `name` and `verify.default` both do with `$defs/slug`.
const REF_SIBLINGS = new Set(["$ref", "title", "description"]);

/**
 * Walk a schema and refuse anything outside the subset. Returns the schema unchanged; the value
 * is the walk, not the result.
 */
export function compileSchema(schema, where = "#") {
    if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
        throw new DoctorError(`schema at ${where} is not an object`);
    }

    const keys = Object.keys(schema);

    for (const key of keys) {
        if (!(key in SUPPORTED)) {
            throw new DoctorError(
                `schema at ${where} uses \`${key}\`, which is outside the subset this validator ` +
                    `implements (see spec/README.md). A schema change reaching outside that list ` +
                    `is a change to doctor too, and the two land together.`,
            );
        }
        if (!SUPPORTED[key](schema[key])) {
            throw new DoctorError(
                `schema at ${where} has \`${key}: ${JSON.stringify(schema[key])}\`, which is not ` +
                    `${SHAPE[key] ?? "a usable value for that keyword"}. The keyword is in the subset; ` +
                    `this value cannot be applied, and a constraint that cannot be applied is refused ` +
                    `rather than carried to instance validation, where it would surface as a stack ` +
                    `trace naming neither the keyword nor where it lives.`,
            );
        }
    }

    if ("$ref" in schema) {
        const stray = keys.filter((k) => !REF_SIBLINGS.has(k));
        if (stray.length) {
            throw new DoctorError(
                `schema at ${where} carries \`$ref\` alongside ${stray.map((k) => `\`${k}\``).join(", ")}. ` +
                    `Only \`title\` and \`description\` may accompany a $ref — they are annotations and ` +
                    `never affect validation; anything else would be a constraint this validator ignores.`,
            );
        }
        if (typeof schema.$ref !== "string" || !schema.$ref.startsWith("#/$defs/")) {
            throw new DoctorError(
                `schema at ${where} has \`$ref: ${JSON.stringify(schema.$ref)}\`; only local ` +
                    `\`#/$defs/…\` references are supported.`,
            );
        }
    }

    for (const [name, sub] of Object.entries(schema.$defs ?? {})) {
        compileSchema(sub, `${where}/$defs/${name}`);
    }
    for (const [name, sub] of Object.entries(schema.properties ?? {})) {
        compileSchema(sub, `${where}/properties/${name}`);
    }
    if (schema.items) compileSchema(schema.items, `${where}/items`);
    if (schema.oneOf) schema.oneOf.forEach((sub, i) => compileSchema(sub, `${where}/oneOf/${i}`));

    return schema;
}

const typeOf = (v) =>
    v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" ? "number" : typeof v;

/**
 * Validate an instance against a schema written in the subset.
 * Returns `[{ pointer, message }]` — empty when the instance conforms.
 */
export function validate(schema, instance) {
    compileSchema(schema);
    const errors = [];
    check(schema, instance, "", schema, errors);
    return errors;
}

function resolveRef(root, ref) {
    const name = ref.slice("#/$defs/".length);
    const target = root.$defs?.[name];
    if (!target) throw new DoctorError(`schema references \`${ref}\`, which is not defined`);
    return target;
}

function check(schema, value, pointer, root, errors) {
    const add = (message) => errors.push({ pointer, message });

    if (schema.$ref) {
        check(resolveRef(root, schema.$ref), value, pointer, root, errors);
        return;
    }

    if (schema.type) {
        const actual = typeOf(value);
        const ok = schema.type === "number" ? actual === "number" : actual === schema.type;
        if (!ok) {
            add(`expected type \`${schema.type}\`, found \`${actual}\``);
            return; // Every other keyword here would be reporting the same fault again.
        }
    }

    if (schema.enum && !schema.enum.some((allowed) => allowed === value)) {
        add(`value ${JSON.stringify(value)} is not one of the permitted values (enum: ${schema.enum.map((v) => JSON.stringify(v)).join(", ")})`);
    }

    if (typeof value === "string") {
        if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
            add(`value ${JSON.stringify(value)} does not match the required pattern \`${schema.pattern}\``);
        }
        if (schema.minLength !== undefined && value.length < schema.minLength) {
            add(`value is shorter than the required minLength of ${schema.minLength}`);
        }
    }

    if (Array.isArray(value)) {
        if (schema.minItems !== undefined && value.length < schema.minItems) {
            add(`array has ${value.length} item(s), fewer than the required minItems of ${schema.minItems}`);
        }
        if (schema.uniqueItems) {
            const seen = new Set();
            value.forEach((item, i) => {
                const key = JSON.stringify(item);
                if (seen.has(key)) errors.push({ pointer: `${pointer}/${i}`, message: `duplicate entry ${key} violates uniqueItems` });
                seen.add(key);
            });
        }
        if (schema.items) {
            value.forEach((item, i) => check(schema.items, item, `${pointer}/${i}`, root, errors));
        }
    }

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        for (const name of schema.required ?? []) {
            if (!(name in value)) add(`required property \`${name}\` is missing`);
        }
        if (schema.additionalProperties === false) {
            // `properties` may legitimately be absent, and then this forbids EVERY property — the
            // 2020-12 semantics. Treating a missing `properties` as "nothing to check" would make a
            // supported spelling silently mean the opposite of what it says, which is the failure
            // ../.portulan/memory/a-checker-must-refuse-what-it-cannot-check.md is about.
            const declared = schema.properties ?? {};
            for (const name of Object.keys(value)) {
                if (!(name in declared)) {
                    errors.push({
                        pointer: `${pointer}/${name}`,
                        message: `unexpected property \`${name}\` — the schema sets additionalProperties: false, so an unknown key is rejected rather than ignored (the common case is a typo in a slot name)`,
                    });
                }
            }
        }
        for (const [name, sub] of Object.entries(schema.properties ?? {})) {
            if (name in value) check(sub, value[name], `${pointer}/${name}`, root, errors);
        }
    }

    if (schema.oneOf) {
        const matched = schema.oneOf.filter((sub) => {
            const trial = [];
            check(sub, value, pointer, root, trial);
            return trial.length === 0;
        });
        if (matched.length !== 1) {
            const why = schema.oneOf
                .map((sub, i) => {
                    const trial = [];
                    check(sub, value, pointer, root, trial);
                    return `  form ${i + 1}: ${trial.map((e) => e.message).join("; ") || "matched"}`;
                })
                .join("\n");
            add(`value matches ${matched.length} of the ${schema.oneOf.length} permitted forms, not exactly one (oneOf):\n${why}`);
        }
    }
}

// ===========================================================================================
// 2. Provenance, parsed out of a Markdown record
// ===========================================================================================
//
// The Workspace Definition puts provenance on a rule rather than in the manifest: a rule lives in
// Markdown, so a manifest key would describe a workspace's POLICY about provenance while leaving
// every actual rule unchecked (spec/slots.md). So the schema defines the shape and the records
// carry instances — one definition, two carriers — and this is the parser between them.
//
// The accepted syntax is deliberately narrow: backticked `key=value` tokens on the `**provenance:**`
// paragraph, keys drawn from the five the schema names. Narrow because the alternative is false
// reds — the live records carry annotation prose after the stamp ("— the milestone-2 pull request,
// where…"), and a parser that treated every backtick in that prose as a field would fail records
// that are perfectly correct.

const PROVENANCE_KEYS = ["form", "href", "owner", "date", "shape"];
const PROVENANCE_TOKEN = new RegExp("`(" + PROVENANCE_KEYS.join("|") + ")=([^`]*)`", "g");

/**
 * Pull the provenance stamp out of a record.
 * Returns `{ present, fields, raw }`; `fields` is null when the record carries prose provenance
 * — which is a finding for a rule and a note for anything else, not a parse failure.
 */
export function parseProvenance(source) {
    const lines = source.split("\n");
    const start = lines.findIndex((l) => /^\s*\*\*provenance:\*\*/i.test(l));
    if (start === -1) return { present: false, fields: null, raw: "" };

    // The stamp may wrap, so the unit is the paragraph, not the line.
    let end = start;
    while (end + 1 < lines.length && lines[end + 1].trim() !== "") end += 1;
    const raw = lines.slice(start, end + 1).join(" ");

    // First occurrence wins. The stamp leads the paragraph and annotation prose follows it, so a
    // later `form=…` inside that prose is somebody writing *about* provenance, not declaring it —
    // and last-wins would let a sentence mentioning the other form turn a correct record red. A
    // false red is the failure that gets a whole check switched off, so the tie breaks toward the
    // stamp. The residual limit is stated in ../core/templates/memory-entry.md rather than left to
    // be discovered: a backticked `key=value` using one of these five keys is reserved syntax
    // wherever it appears in the paragraph.
    const fields = {};
    for (const [, key, value] of raw.matchAll(PROVENANCE_TOKEN)) {
        if (!(key in fields)) fields[key] = value.trim();
    }
    return { present: true, fields: Object.keys(fields).length ? fields : null, raw };
}

const recordType = (source) => (source.match(/^\s*\*\*type:\*\*\s*(\S+)/im)?.[1] ?? "").toLowerCase();

// The retirement condition is a template field, not a schema one (core/templates/memory-entry.md):
// the line a demotion pass retires by. Anchored to the bolded field at line start, so prose that
// merely discusses retiring never matches — the same false-red caution parseProvenance takes with
// backticked tokens, for the same reason: a false red is what gets a whole check switched off.
const RETIRE_WHEN = /^\s*\*\*retire when:\*\*/im;

// ===========================================================================================
// 3. Claims against the tree
// ===========================================================================================
//
// The milestone-2 criterion asks for this "the way the `map` check already holds the root README
// to the repo's shape" — so a claim that is verifiable and wrong FAILS, exactly as `map` does.
//
// Three things make that safe to do. First, the lint reads only what parses confidently as a path:
// a code span or link target containing `/`, never absolute. `build: none — no build step yet`
// claims nothing and is treated as claiming nothing. Prose outside the two parsed sections is
// **left alone** — not failed and not reported — because reporting every ordinary sentence in a
// repo card would bury the findings that matter.
//
// Second, FAIL is reserved for a claim that is unambiguous. A build/test/run candidate that is a
// single path-shaped token is a claim a file exists; a candidate that is a command merely contains
// tokens that might be paths, output paths, flag values or globs, and those are reported rather
// than failed. A false red is the outcome that gets a whole recipe switched off
// (../.portulan/verify/README.md), and an ambitious parser is the shortest route to one — which
// this check learned by producing them.
//
// Second, the tree is DECLARED rather than guessed. A workspace that makes claims about the
// repository containing it says so with the `tree` slot; one that describes repositories not
// present beside it — a demo, or a portfolio spanning many — omits it, and its claims are reported
// **unverifiable**. Never silently skipped: a check class that disappears without saying so is the
// fail-open this repository keeps re-finding.

const CODE_SPAN = /`([^`]+)`/g;
const LINK_TARGET = /\]\(([^)]+)\)/g;

/** Path-shaped claims in a repo card: the build/test/run lines, and the layout. */
function repoCardClaims(source) {
    const lines = source.split("\n");
    const claims = [];

    const section = (headingPattern) => {
        const start = lines.findIndex((l) => headingPattern.test(l));
        if (start === -1) return null;
        let end = start;
        while (end + 1 < lines.length && lines[end + 1].trim() !== "") end += 1;
        return lines.slice(start, end + 1);
    };

    // Absolute paths are excluded because they resolve against the HOST rather than the tree:
    // `/usr/bin/env` inside a command would otherwise be checked, found, and counted as a passing
    // claim about a repository it has nothing to do with.
    const isPathish = (token) =>
        token.includes("/") &&
        !token.startsWith("/") &&
        !/^(https?|mailto):/.test(token) &&
        !token.includes(" ");

    const build = section(/^\s*\*\*Build\s*\/\s*test\s*\/\s*run\.?\*\*/i);
    if (build) {
        for (const line of build) {
            const entry = line.match(/^\s*[-*]\s*(\w[\w -]*):\s*(.+)$/);
            if (!entry) continue;
            const [, key, rest] = entry;
            const spans = [...rest.matchAll(CODE_SPAN)].map((m) => m[1].trim());
            const candidate = spans[0] ?? rest.trim().split(/\s+/)[0];
            if (!candidate) continue;
            if (/^none\b/i.test(candidate)) continue; // an explicit no-claim

            // Severity turns on whether the candidate IS a path or merely CONTAINS one, and that
            // split is the whole design of this branch.
            //
            // A candidate that is a single path-shaped token — `./verify.sh` — is unambiguously a
            // claim that a file exists, and absent it is a **failure**. That is the shape customer
            // zero's card uses and the shape the milestone-2 close demonstrated red.
            //
            // A candidate that is a command — `dotnet run --project src/App` — contains tokens that
            // may be an input path, an output path not built yet, a flag value, a `sed` expression, a
            // glob, an npm script name, or an SSH remote. Nothing here can tell those apart, so every
            // extracted token is **reported, never failed**. An earlier version failed them and bought
            // false reds on `go test ./...`, `cc -o bin/app src/main.c`, and `--project=src/App` with
            // the directory present — on exactly the input `../core/templates/repo-card.md` tells
            // adopters to write. Tightening the pattern cannot fix it: `bin/app` and `test/unit` are
            // clean-looking paths. A false red gets a whole recipe switched off; a missed check does
            // not, and this repository has ranked those two twice.
            //
            // What both branches guarantee is that nothing is **silent**. Before this, a
            // command-shaped line was tested whole, rejected for containing a space, and dropped:
            // not checked, not counted, not reported.
            const tokens = candidate.split(/\s+/);
            const targets = tokens.filter(isPathish);
            if (tokens.length === 1 && targets.length === 1) {
                claims.push({ what: `${key}: \`${candidate}\``, target: candidate, severity: "fail" });
            } else if (targets.length) {
                for (const target of new Set(targets)) {
                    claims.push({
                        what: `${key}: \`${target}\`, taken from \`${candidate}\``,
                        target,
                        severity: "report",
                    });
                }
            } else {
                claims.push({ what: `${key}: \`${candidate}\``, target: null });
            }
        }
    }

    const layout = section(/^\s*\*\*Layout\.?\*\*/i);
    if (layout) {
        const body = layout.join(" ");
        const tokens = [
            ...[...body.matchAll(CODE_SPAN)].map((m) => m[1].trim()),
            ...[...body.matchAll(LINK_TARGET)].map((m) => m[1].trim()),
        ];
        for (const token of new Set(tokens)) {
            if (isPathish(token)) claims.push({ what: `layout: \`${token}\``, target: token });
        }
    }

    return claims;
}

/**
 * The status-check contexts a gate map claims `main` requires — every one named in the row, not just
 * the first. A repository may require several, and reading only the first silently exempts the rest:
 * the third real workspace requires two, and the one that was ignored was the one that was wrong.
 */
function requiredCheckClaims(source) {
    for (const line of source.split("\n")) {
        if (!/^\s*\|/.test(line)) continue;
        const cells = line.split("|").map((c) => c.trim());
        if (!/required status check/i.test(cells[1] ?? "")) continue;
        const tokens = [...cells.slice(2).join(" ").matchAll(/`([^`]+)`/g)].map((m) => m[1]);
        if (tokens.length) return [...new Set(tokens)];
    }
    return [];
}

/**
 * The status-check contexts a workflow file will report, as `{ id, context }`.
 *
 * The context is the job's `name:` when it sets one, and the job id otherwise — that is what branch
 * protection pins, and the distinction is invisible until a job has both. It surfaced on the third
 * real workspace: a job id `example-job` carrying `name: Example Job`, where the ruleset requires
 * `Example Job` and this function previously returned only `example-job`, so a gate map claiming the
 * id passed a check that should have failed. Customer zero could never have shown it, because its
 * workflow deliberately sets no `name:` precisely so the two coincide.
 *
 * A regex rather than a YAML parse, because a parser is a dependency and this reads one shape from one
 * well-known file. Stated as a limit rather than left to be discovered: unusual-but-valid YAML — flow
 * mappings, quoted or multi-line keys, `name` given as an expression — is not recognised.
 */
function workflowJobs(source) {
    const lines = source.split("\n");
    const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
    if (start === -1) return [];
    const jobs = [];
    for (const line of lines.slice(start + 1)) {
        if (/^\S/.test(line) && line.trim() !== "") break; // back to top level
        const id = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
        if (id) {
            jobs.push({ id: id[1], context: id[1] });
            continue;
        }
        // `name:` at the job's own level, not inside a step (steps are deeper and start with `- `).
        const name = line.match(/^ {4}name:\s*(.+?)\s*$/);
        if (name && jobs.length) {
            const value = name[1].replace(/^["']|["']$/g, "");
            if (value && !value.includes("${{")) jobs[jobs.length - 1].context = value;
        }
    }
    return jobs;
}

// ===========================================================================================
// 4. Inspecting one workspace
// ===========================================================================================

const PATH_SLOTS = {
    identity: "file", principles: "file", gates: "file", dod: "file",
    constitution: "either",
    memory: "dir", repos: "dir", tasks: "dir", handoffs: "dir", proposals: "dir",
};

/**
 * The Workspace Definition version a schema implements, read from its `$id`.
 *
 * Carried in the identifier rather than parsed out of `title`, because a machine fact read from a
 * human sentence drifts the first time somebody rewords the sentence. Absent is a hard stop: a
 * validator that cannot tell which version of the contract it implements cannot honestly say a
 * manifest conforms to it.
 */
export function schemaVersion(schema) {
    const match = /\/spec\/([0-9]+)\.([0-9]+)\//.exec(schema.$id ?? "");
    if (!match) {
        throw new DoctorError(
            "the schema's `$id` does not carry a `/spec/MAJOR.MINOR/` segment, so `doctor` cannot " +
                "tell which Workspace Definition version it implements",
        );
    }
    return { major: Number(match[1]), minor: Number(match[2]) };
}

function loadSchema({ schema, schemaPath }) {
    if (schema) return schema;
    const file = schemaPath ?? DEFAULT_SCHEMA;
    let source;
    try {
        source = fs.readFileSync(file, "utf8");
    } catch (cause) {
        throw new DoctorError(`could not read the schema at ${file}: ${cause.message}`);
    }
    try {
        return JSON.parse(source);
    } catch (cause) {
        throw new DoctorError(`the schema at ${file} is not valid JSON: ${cause.message}`);
    }
}

/**
 * Inspect one workspace directory.
 * Returns `{ dir, workspace, findings, stats }`. A finding is `{ severity, check, message }`,
 * where severity is `fail` (exit 1) or `report` (worth reading, not a verdict).
 */
export async function inspect(workspaceDir, options = {}) {
    const schema = loadSchema(options);
    const dir = path.resolve(workspaceDir);
    const findings = [];
    // `unretirable` counts records stating no `Retire when:` condition — retirable by a human
    // re-reading them, never by the condition-driven pass, which is the sense that matters here.
    const stats = { records: 0, rules: 0, sealed: 0, linked: 0, claims: 0, unverifiable: 0, bytes: 0, unretirable: 0, unassessed: 0 };
    const fail = (check, message) => findings.push({ severity: "fail", check, message });
    const report = (check, message) => findings.push({ severity: "report", check, message });

    // ---- the manifest itself
    const manifestPath = path.join(dir, "workspace.json");
    let workspace;
    try {
        workspace = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (cause) {
        // A verdict about the workspace, not an environment failure: exit 1, not 2.
        fail("schema", `no readable manifest at ${path.relative(process.cwd(), manifestPath)} — ${cause.message}`);
        return { dir, workspace: null, findings, stats };
    }

    // Which contract is this manifest written against? Checked BEFORE conformance, because grading
    // a manifest against a definition it was not written for produces confident nonsense: an
    // optional slot added in a later MINOR would come back as an unexpected property, and the
    // report would blame the author for using the spec correctly.
    //
    // Both mismatches are exit 2 rather than 1. "This workspace is wrong" and "I do not implement
    // the contract it names" are different statements, and only the first is a verdict `doctor` is
    // entitled to make — see ../.portulan/memory/a-checker-must-refuse-what-it-cannot-check.md.
    const here = schemaVersion(schema);
    const declared = /^([0-9]+)\.([0-9]+)$/.exec(workspace?.portulan?.spec ?? "");
    if (declared) {
        const [major, minor] = [Number(declared[1]), Number(declared[2])];
        if (major !== here.major) {
            throw new DoctorError(
                `${path.relative(process.cwd(), dir)} declares Workspace Definition ${major}.${minor}; ` +
                    `this schema is ${here.major}.${here.minor}. A MAJOR difference means a migration ` +
                    `exists and this validator is not the one to run.`,
            );
        }
        if (minor > here.minor) {
            throw new DoctorError(
                `${path.relative(process.cwd(), dir)} declares Workspace Definition ${major}.${minor}, ` +
                    `which is ahead of the ${here.major}.${here.minor} this schema implements. Refusing ` +
                    `rather than grading it against an older contract and reporting the difference as errors.`,
            );
        }
        if (minor < here.minor) {
            report(
                "schema",
                `written against Workspace Definition ${major}.${minor}; this schema is ` +
                    `${here.major}.${here.minor}. Still valid — MINOR is additive — but slots added since ` +
                    `${major}.${minor} will simply be absent`,
            );
        }
    }

    const errors = validate(schema, workspace);
    for (const e of errors) {
        fail("schema", `${e.pointer || "/"} — ${e.message}`);
    }
    if (errors.length) {
        // The later checks read the manifest's shape. Running them on a manifest that failed the
        // schema would produce noise at best and a crash at worst — so they are skipped, and the
        // skip is said out loud rather than left to look like a pass.
        report("schema", "path, cross-field, claims and provenance checks were skipped: the manifest must conform first");
        return { dir, workspace, findings, stats };
    }

    // ---- path slots
    // Containment is judged between REAL paths on both sides. Resolving only the target would
    // report a false escape wherever the workspace's own path runs through a symlink — on macOS
    // `/tmp` is one, which is where the tests build their scratch workspaces.
    let realDir = dir;
    try {
        realDir = fs.realpathSync(dir);
    } catch { /* the manifest read below reports a workspace that is not there */ }
    const inside = (target) => {
        const rel = path.relative(realDir, target);
        return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
    };

    const resolvePath = (value, kind, label) => {
        const target = path.resolve(dir, value);
        let stat = null;
        try {
            stat = fs.statSync(target);
        } catch {
            fail("paths", `${label} points at \`${value}\`, which does not exist`);
            return;
        }
        if (kind === "file" && !stat.isFile()) fail("paths", `${label} points at \`${value}\`, which is not a file`);
        if (kind === "dir" && !stat.isDirectory()) fail("paths", `${label} points at \`${value}\`, which is not a directory`);
        // Containment is tested on the REAL path, so a symlink out of the workspace is seen for
        // what it is. `realpathSync` is only safe after the stat above proved the target exists.
        let real = target;
        try {
            real = fs.realpathSync(target);
        } catch { /* keep the lexical path; the stat already succeeded, so this is unusual */ }
        if (!inside(real)) {
            // Reported, never failed. A workspace embedded in a larger repository may legitimately
            // reach for a shared document, and failing would make the tool wrong about a case it
            // cannot see. Two slots are *expected* to escape and are noted as unremarkable rather
            // than flagged: `constitution`, because a product's constitution normally lives with
            // the product, and `tree`, which names the repository the workspace sits inside and
            // would be pointing at the wrong thing if it did not escape.
            const ordinary = {
                "slots.constitution": "a constitution usually lives with the product",
                tree: "a workspace usually sits inside the tree it describes",
            }[label];
            report(
                "paths",
                `${label} resolves outside the workspace directory (\`${value}\`)` +
                    (ordinary
                        ? ` — ordinary here: ${ordinary}`
                        : " — only `constitution` and `tree` ordinarily do, and neither is required to"),
            );
        }
    };

    for (const [name, kind] of Object.entries(PATH_SLOTS)) {
        if (workspace.slots?.[name]) resolvePath(workspace.slots[name], kind, `slots.${name}`);
    }
    if (workspace.affordances) resolvePath(workspace.affordances, "file", "affordances");
    if (workspace.tree) resolvePath(workspace.tree, "dir", "tree");
    // Added with the `gates` key in Workspace Definition 2.1. It shipped for one checkpoint without
    // this line while ../spec/slots.md already promised "What `doctor` checks: that the path
    // resolves" — a manifest naming a policy file that did not exist validated GREEN. Caught at the
    // pre-commit checkpoint, and it is exactly the shape of
    // ../.portulan/memory/a-mandate-nothing-checks-is-already-broken.md: the mandate was written in
    // the same change as the key, and nothing looked.
    if (workspace.gates) resolvePath(workspace.gates, "file", "gates");
    (workspace.products ?? []).forEach((product, i) => {
        resolvePath(product.product, "file", `products[${i}].product`);
        if (product.affordances) resolvePath(product.affordances, "file", `products[${i}].affordances`);
    });
    (workspace.verify?.recipes ?? []).forEach((recipe, i) => {
        if (recipe.doc) resolvePath(recipe.doc, "file", `verify.recipes[${i}].doc`);
    });

    // ---- cross-field
    const ids = (workspace.verify?.recipes ?? []).map((r) => r.id);
    if (!ids.includes(workspace.verify?.default)) {
        fail("cross", `verify.default names \`${workspace.verify?.default}\`, which is not among the declared recipes (${ids.join(", ") || "none"})`);
    }

    // Uniqueness is `verify.default`'s missing sibling. The schema's `uniqueItems` compares whole
    // objects, so two recipes sharing an id and differing anywhere else pass it — and then naming
    // that id resolves to whichever the reader happens to look at first.
    const duplicates = (list, what) => {
        const seen = new Set();
        for (const id of list) {
            if (seen.has(id)) fail("cross", `two ${what} share the id \`${id}\`, so naming it resolves to either`);
            seen.add(id);
        }
    };
    duplicates(ids, "verify recipes");
    duplicates((workspace.products ?? []).map((p) => p.id), "products");

    const cardNames = new Set();
    if (workspace.slots?.repos) {
        const reposDir = path.resolve(dir, workspace.slots.repos);
        try {
            for (const entry of fs.readdirSync(reposDir)) {
                if (entry.endsWith(".md") && entry !== "README.md") cardNames.add(entry.slice(0, -3));
            }
        } catch { /* the missing directory is already a `paths` failure */ }
    }

    (workspace.products ?? []).forEach((product, i) => {
        for (const name of product.repos ?? []) {
            // Exact basename, never a substring: `portulan` must not be satisfied by
            // `portulan-internal.md`.
            if (!cardNames.has(name)) {
                fail("cross", `products[${i}].repos names \`${name}\`, for which there is no card in the repos slot`);
            }
        }
        if (!product.affordances && !workspace.affordances) {
            report("cross", `products[${i}] (\`${product.id}\`) has neither its own affordances nor an inherited workspace-level default`);
        }
    });

    // Proposal 0005, accepted 2026-07-25 and applied here. A `repository` workspace is the policy layer
    // of a repository that is present, so it always has an answer; `demo` and `portfolio` describe
    // repositories that are not beside them and genuinely do not.
    //
    // This constraint cannot live in the schema: a conditional dependency between two keys needs `if`/
    // `then` or `dependentRequired`, and neither is in the subset spec/README.md declares. So it is here,
    // and spec/slots.md states it as a rule the schema does not carry. That asymmetry is a real cost —
    // a constraint invisible to anyone reading the schema alone — and it is stated rather than hidden.
    if (workspace.kind === "repository" && !workspace.tree) {
        fail(
            "cross",
            "a `repository` workspace must declare `tree` — it is the policy layer of a repository that " +
                "is present, so it has an answer, and without one every repo-card and gate-map claim " +
                "silently degrades from checked to unverifiable",
        );
    }

    if (workspace.packs?.length) {
        report("cross", `${workspace.packs.length} pack(s) declared — a declaration only: the plugin machinery exists as of milestone 3, but resolving a pack to an installed one still needs the feed (milestone 6)`);
    }

    // ---- claims against the tree
    const treeRoot = workspace.tree ? path.resolve(dir, workspace.tree) : null;
    const claimTargets = [];

    if (workspace.slots?.repos) {
        const reposDir = path.resolve(dir, workspace.slots.repos);
        for (const name of [...cardNames].sort()) {
            const card = path.join(reposDir, `${name}.md`);
            let source;
            try {
                source = fs.readFileSync(card, "utf8");
            } catch (cause) {
                // Was a bare `continue`: an unreadable card dropped every claim it makes, silently,
                // and the run stayed green. A card that cannot be read is not a card with no claims.
                fail("claims", `repos/${name}.md could not be read, so its claims went unchecked — ${cause.message}`);
                continue;
            }
            for (const claim of repoCardClaims(source)) {
                claimTargets.push({ where: `repos/${name}.md`, ...claim, base: reposDir });
            }
        }
    }

    // The gate map's claim is extracted OUTSIDE the tree branch on purpose. Reading it only when a
    // tree exists is how a check class disappears without saying so — a no-`tree` workspace whose
    // gate map named a status check nothing reports used to produce no mention of it at all, while
    // spec/slots.md promised those claims were "counted and reported unverifiable, never skipped
    // silently". Found at the pre-commit checkpoint, in the paragraph that made the promise.
    let claimedChecks = [];
    let gatesRead = false;
    // Captured immediately after parsing and never reassigned. `claimedChecks` is emptied later when
    // there are no workflows to compare against, and keying the "names no check" report off the
    // mutated array made it fire for a gate map that had named one — two contradictory findings from
    // the same run.
    let namedAnyCheck = false;
    if (workspace.slots?.gates) {
        try {
            claimedChecks = requiredCheckClaims(fs.readFileSync(path.resolve(dir, workspace.slots.gates), "utf8"));
            gatesRead = true;
            namedAnyCheck = claimedChecks.length > 0;
        } catch {
            // Unreadable is already a `paths` failure; it must not also become an exit-2 crash,
            // which would trade a verdict this run had already reached for "could not run".
        }
    }

    if (treeRoot) {
        for (const claim of claimTargets) {
            if (claim.target === null) {
                stats.unverifiable += 1;
                report("claims", `${claim.where} states ${claim.what}, which contains nothing path-shaped to check — counted as unverifiable rather than passed over`);
                continue;
            }
            // A token pulled out of a command is never a *checked* claim, whether or not it happens to
            // resolve. Counting it in `stats.claims` when it resolved and in `unverifiable` when it did
            // not would make the accounting depend on incidental filesystem state and would overstate
            // what was verified — `docker run -v $(pwd)/state:/state` is not a claim about the tree
            // because `state` exists. It is unverifiable either way; only the finding differs.
            const checkable = claim.severity !== "report";
            if (checkable) stats.claims += 1;
            else stats.unverifiable += 1;

            // Two bases, because a card legitimately mixes them: `.portulan/` is written from the
            // repository root while `../../core/` is written from the card. A claim that resolves
            // under either is a claim that points at something real, which is what the lint is for.
            const resolved = [path.resolve(treeRoot, claim.target), path.resolve(claim.base, claim.target)];
            if (!resolved.some((p) => fs.existsSync(p))) {
                const message = `${claim.where} claims ${claim.what}, which exists nowhere in the tree`;
                if (checkable) {
                    fail("claims", message);
                } else {
                    report("claims", `${message} — reported rather than failed: a token pulled out of a command may be an output path, a flag value or a glob, and this cannot tell those from a broken one`);
                }
            }
        }

        if (claimedChecks.length) {
            const workflows = path.join(treeRoot, ".github", "workflows");
            let jobs = [];
            let found = false;
            try {
                for (const entry of fs.readdirSync(workflows)) {
                    if (!/\.ya?ml$/.test(entry)) continue;
                    found = true;
                    jobs.push(...workflowJobs(fs.readFileSync(path.join(workflows, entry), "utf8")));
                }
            } catch { /* handled below */ }

            const contexts = jobs.map((j) => j.context);
            // A job whose id is claimed but whose reported context differs is the interesting failure,
            // and it deserves its own message: "no job declares that" would send the reader hunting for
            // a missing job when the job is right there under a display name.
            if (!found) {
                stats.unverifiable += claimedChecks.length;
                report("claims", `the gate map requires ${claimedChecks.length} status check(s) — ${claimedChecks.map((c) => `\`${c}\``).join(", ")} — and there are no workflows in the tree to report them — unverifiable`);
                claimedChecks = [];
            }
            for (const claimedCheck of claimedChecks) {
                stats.claims += 1;
                const shadowed = jobs.find((j) => j.id === claimedCheck && j.context !== claimedCheck);
                if (shadowed) {
                    fail(
                        "claims",
                        `the gate map requires the status check \`${claimedCheck}\`, which is a job **id**; that job sets \`name: ${shadowed.context}\`, and the name is what branch protection pins. The claim names something no check will ever report`,
                    );
                } else if (!contexts.includes(claimedCheck)) {
                    fail("claims", `the gate map requires the status check \`${claimedCheck}\`, which no workflow job in the tree reports (found: ${contexts.join(", ") || "none"})`);
                } else {
                    report("claims", `the gate map's required status check \`${claimedCheck}\` is reported by a workflow job in the tree — in-tree only: whether branch protection actually requires it, and the app it is pinned to, are live settings doctor does not fetch`);
                }
            }
        }
    } else {
        stats.unverifiable += claimTargets.length;
        report(
            "claims",
            `${claimTargets.length} repo-card claim(s) unverifiable: this workspace declares no \`tree\`, so it describes repositories that are not present beside it. Reported rather than skipped — a check class that disappears quietly is worse than one that says it could not run`,
        );
        if (claimedChecks.length) {
            stats.unverifiable += claimedChecks.length;
            report(
                "claims",
                `the gate map requires ${claimedChecks.map((c) => `\`${c}\``).join(", ")}, and with no \`tree\` there is nothing to check against — unverifiable`,
            );
        }
    }

    // Finding no claim is a result, not an absence, and it has to say so. `doctor` recognises the
    // required-check claim by one convention — a table row whose first cell reads "required status
    // check" — and no template defines that label (see spec/slots.md). A gate map wording the row
    // differently produced **nothing at all**: no finding, no count, and a reader with a GREEN in
    // front of them had no way to tell "this workspace requires no check" from "I did not recognise
    // your table". Reported since the review that measured it.
    if (gatesRead && !namedAnyCheck) {
        report(
            "claims",
            "the gate map names no required status check — either this workspace requires none, or its floor table does not use the row label `Required status check` that this check recognises (spec/slots.md). Nothing was compared against the tree",
        );
    }

    // ---- provenance, and the store's own growth
    if (workspace.slots?.memory) {
        const memoryDir = path.resolve(dir, workspace.slots.memory);
        let entries = [];
        try {
            entries = fs.readdirSync(memoryDir).filter((f) => f.endsWith(".md") && f !== "README.md").sort();
        } catch { /* the missing directory is already a `paths` failure */ }

        for (const entry of entries) {
            // A record that is present and unreadable is a defect in the WORKSPACE — exit 1, reported
            // alongside everything else already found. Letting the read throw made it exit 2 and
            // discarded every finding the run had reached, which is the gates-file defect over again
            // one function down: the same shape, missed in the same change that fixed it.
            let source;
            try {
                source = fs.readFileSync(path.join(memoryDir, entry), "utf8");
            } catch (cause) {
                stats.records += 1;
                // The unreadable record still occupies the store, and it is already counted in
                // `records` — so it is sized from stat, or `record(s)` and `KB` would disagree
                // about what a record is. Its content is still never assessed: this run is
                // already red on the read failure, and only the accounting stays consistent.
                try { stats.bytes += fs.statSync(path.join(memoryDir, entry)).size; } catch { /* unstattable: its size stays unknown */ }
                stats.unassessed += 1;
                fail("provenance", `${entry} could not be read — ${cause.message}`);
                continue;
            }
            const type = recordType(source);
            const { present, fields } = parseProvenance(source);
            stats.records += 1;
            stats.bytes += Buffer.byteLength(source);
            const isRule = type === "rule";
            if (isRule) stats.rules += 1;

            // Growth control rather than provenance: the retirement pass demotes a record by the
            // condition its own `Retire when:` line states, so a record stating none is one no
            // condition will ever demote. Reported, never failed — no rule mandates the field, and
            // doctor does not enforce what nobody legislated. Checked ahead of the provenance
            // branches below, so a record with a provenance defect is still assessed for this.
            if (!RETIRE_WHEN.test(source)) {
                stats.unretirable += 1;
                report(
                    "retirement",
                    `${entry} states no retirement condition — no \`**Retire when:**\` line (core/templates/memory-entry.md). A record no condition can demote leaves the store only by someone re-reading it`,
                );
            }

            if (!present) {
                const message = `${entry} carries no provenance line at all`;
                isRule ? fail("provenance", message) : report("provenance", message);
                continue;
            }
            if (!fields) {
                // Prose provenance. Mandatory only on a rule: thesis 4, proposal 0002 as adopted,
                // dod.md condition 3 and the task's own criterion are all rule-scoped, and having
                // doctor bind types nobody legislated for would be tooling enforcing a rule the
                // constitution does not state — backwards for this product.
                const message = `${entry} (${type || "untyped"}) carries prose provenance rather than a link or a sealed stamp`;
                isRule ? fail("provenance", message) : report("provenance", message);
                continue;
            }
            const shapeErrors = validate({ $defs: schema.$defs, ...schema.$defs.provenance }, fields);
            if (shapeErrors.length) {
                const message = `${entry}: ${shapeErrors.map((e) => e.message).join("; ")}`;
                isRule ? fail("provenance", message) : report("provenance", message);
                continue;
            }
            if (isRule) fields.form === "sealed" ? (stats.sealed += 1) : (stats.linked += 1);
        }
    }

    // Always emitted, including for zero records. A workspace with no memory yet is valid — the
    // minimality rule is explicit that a day-one workspace must pass — but "checked nothing" and
    // "checked everything and found nothing wrong" print identically unless one of them says so.
    const proportion = stats.rules ? `${stats.sealed} of ${stats.rules}` : "0 of 0";
    report(
        "provenance",
        `${stats.records} memory record(s), ${stats.rules} of them rules; sealed proportion ${proportion}` +
            (stats.rules && stats.sealed === stats.rules
                ? " — every rule is sealed, which means this workspace has opted out of retirement altogether"
                : "") +
            ". The form is checked, never the truth: a fabricated stamp passes exactly as a real one does",
    );

    // The store's growth, always emitted for the same reason the line above is: a store quietly
    // growing and a store quietly fine print identically unless something says which. Size and
    // count are what doctor can honestly see — it reads the tree and never git, and in a fresh
    // clone every file's mtime is checkout time, so an age report from here would be fabrication.
    // Staleness is the librarian's (milestone 5), which may legitimately ask git.
    report(
        "retirement",
        stats.records
            ? `the store holds ${stats.records} record(s), ${(stats.bytes / 1024).toFixed(1)} KB — ` +
              (stats.unretirable
                  ? `${stats.unretirable} with no retirement condition`
                  : stats.unassessed
                    ? "every readable record states a retirement condition"
                    : "every record states a retirement condition") +
              (stats.unassessed
                  ? `; ${stats.unassessed} unreadable and never assessed`
                  : "") +
              ". Size and count only: ages live in git, which doctor does not read, so staleness is the librarian's (milestone 5)"
            : "no memory records — nothing measured, nothing awaiting retirement",
    );

    return { dir, workspace, findings, stats };
}

// ===========================================================================================
// 5. The command
// ===========================================================================================

const ICON = { fail: "FAIL ", report: "note " };

/** Relative when that is shorter to read, absolute when the relative form is a ladder of `../`. */
function display(target) {
    const rel = path.relative(process.cwd(), path.resolve(target));
    return rel === "" ? "." : rel.startsWith("..") ? path.resolve(target) : rel;
}

/** Run against one or more workspace directories. Returns the exit code; never throws. */
export async function run(argv, options = {}) {
    const say = options.quiet ? () => {} : (line = "") => process.stdout.write(`${line}\n`);
    try {
        const dirs = argv.filter((a) => !a.startsWith("-"));
        if (dirs.length === 0) {
            if (!options.quiet) {
                process.stderr.write("usage: node cli/doctor.mjs <workspace-dir> [<workspace-dir> ...]\n");
            }
            return 2;
        }

        let failed = 0;
        for (const dir of dirs) {
            const { findings, stats } = await inspect(dir, options);
            const bad = findings.filter((f) => f.severity === "fail");
            say(display(dir));
            for (const f of findings) say(`  ${ICON[f.severity]} ${f.check.padEnd(10)} ${f.message}`);
            say(
                `  ${bad.length ? "RED" : "GREEN"} — ${bad.length} failure(s), ` +
                    `${findings.length - bad.length} note(s), ${stats.claims} claim(s) checked` +
                    (stats.unverifiable ? `, ${stats.unverifiable} unverifiable` : ""),
            );
            say();
            if (bad.length) failed += 1;
        }
        return failed ? 1 : 0;
    } catch (error) {
        // Anything reaching here means doctor could not judge — including a defect in doctor
        // itself. Exit 2. Reporting 1 would assert a verdict about the workspace that was
        // never reached, and reporting 0 would be the fail-open this whole tool exists against.
        if (!options.quiet) {
            process.stderr.write(`doctor: ${error instanceof DoctorError ? error.message : `unanticipated failure — ${error.stack ?? error}`}\n`);
        }
        return 2;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = await run(process.argv.slice(2));
}
