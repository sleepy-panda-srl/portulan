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
// The short list: it never runs a verify recipe, never dereferences a link, and never judges whether a
// sealed stamp is true.
//
// **It DOES score agent legibility, since milestone 7 session 7** — this line read "and never scores
// agent-legibility" until then, which was the honest state from milestone 2 until row 7's 2026-07-28
// amendment was built. The score reads the `affordances` slot and six manifest keys beside it, prints
// one line, and **moves no exit code**: a measurement is not a verdict, and one that could fail a
// workspace would make this tool's judgement a function of how much prose somebody wrote. See section
// 3b for the dimensions and for why each of them can vary.
//
// **One name IS dereferenced, as of milestone 7: a pointer's `governed_by`.** It is resolved against
// the host's installed-plugin record by ./discover.mjs — on disk, never over the network, and the
// line above stays literally true because that is not a link. The result is REPORTED and never
// graded: a pointer whose governor is not installed is a correct pointer, and this tool says where
// the workspace is rather than passing judgement on it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The enforcement compiler, imported rather than reimplemented. `doctor` reports what each backend
// covers, and the only way that report can be true is for it to ask the backends themselves — a
// second copy of the accounting would drift, and a *coverage claim* that drifts does not look wrong,
// it looks like enforcement that quietly stopped covering something. Same reasoning that has
// ./gate.mjs import the matcher instead of writing a second one. Zero
// dependencies on both sides, so nothing is added to what this tool needs to run.
import { parse, backends, resolvePack, rootPlan, packContributions, composeFragments } from "./compile.mjs";
// The containment test the memory-index siting rule turns on, imported for the reason directly
// above: the copy that used to live here drifted into the identical fail-open as the original.
import { isInside, recordType } from "./index.mjs";
// One frontmatter parser for this repository, not two. `plugin-lint` minted it and has the tests that
// pin its edges — an unterminated block, a block that is not first, a value with a colon in it — and a
// second implementation here would be a second carrier of one contract — the class that proposal
// `0020` names (../.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md), and what
// ../core/operating/evolution.md prescribes leaving one site for.
// `AGENT_DIR` for the same reason, and it is the stronger case of the two: it is not a convention this
// tool is free to choose but a MEASUREMENT of where one host looks — with a positive control, recorded
// at its declaration. A copy here would be this tool's opinion about somebody else's loader.
import { parseFrontmatter, AGENT_DIR } from "./plugin-lint.mjs";
// Host plugin-cache discovery, which is where a pointer's `governed_by` stops being a name and
// becomes a directory. Imported rather than reimplemented for the reason above, and kept in its own
// file for a second one: the boot skill's whole instruction is to report what THIS resolver said, so
// there must be exactly one thing that says it.
import { resolveGovernor, AUTO, discoverPackRoots, namedWithAuto } from "./discover.mjs";
import { composedId } from "./recipe-set.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SCHEMA = path.resolve(HERE, "..", "spec", "workspace.schema.json");
// The Pack Definition is a SEPARATE contract on its own version train — see spec/README.md. A pack
// and a workspace are different artifacts, and one number governing both would make a bump in
// either mean a change in the other.
const DEFAULT_PACK_SCHEMA = path.resolve(HERE, "..", "spec", "pack.schema.json");

/**
 * The tail of `doctor`'s binding-success line, exported so the suite keys on ONE carrier.
 *
 * Two tests guard this sentence: one asserts it IS printed for an ordinary binding, the other that it is
 * NOT printed for a name that traverses out of the tree — a path-traversal case where a green would mean
 * `doctor` had opened a file the pack chose. Held as two literals, a reword satisfies the negative
 * assertion **for the wrong reason**: the string is gone, nothing prints it, the test passes, and it
 * would go on passing with the traversal guard deleted. Measured at milestone 7's close, where exactly
 * that happened. Kept here beside the other module constants rather than beside its use, because the
 * first attempt put it between `validatePersona`'s docblock and `validatePersona` — a doc comment
 * attaches to the next symbol, so that silently reassigned it. (Copilot, round 1 on #240.)
 */
export const BINDING_OK = "names match and a tool grant is declared";

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

// A record's declared `**type:**` — imported from ./index.mjs rather than spelled again here. Three
// tools ask this of the same records and all three carried their own regex, which is half of what #74
// is about; the direction of the import is set by ./index.mjs already being this module's dependency
// for `isInside`, so putting the one carrier there keeps the graph acyclic.

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
 * The five parts `core/personas/README.md` fixes, each with the pattern that finds it and the word a
 * failure must use so a reader learns **which** part is missing rather than that "the contract" is unmet.
 *
 * The `tools:` allow-list is frontmatter and the other four are sections, which is why the first entry
 * is matched differently — it is a field, not a heading, and a persona that writes it as a heading has
 * not declared a tool grant a host can read.
 */
const PERSONA_PARTS = [
    { part: "a `tools:` allow-list", find: (fields) => typeof fields?.tools === "string" && fields.tools.trim().length > 0 },
    { part: "a Charter section", find: (_f, body) => /^##\s+Charter\b/im.test(body) },
    { part: "an Autonomy reach section", find: (_f, body) => /^##\s+Autonomy reach\b/im.test(body) },
    { part: "a Memory scope section", find: (_f, body) => /^##\s+Memory scope\b/im.test(body) },
    { part: "a Read / write posture section", find: (_f, body) => /^##\s+Read\s*\/\s*write posture\b/im.test(body) },
];

/**
 * How deep a declared skills root is walked, and it is a bound rather than a recursion.
 *
 * **Three, matching `cli/plugin-lint.mjs`'s `MAX_DECLARED_SKILL_DEPTH`.** The first cut here was 1 and
 * cited `.portulan/tasks/0008-a-declared-skills-path-sees-one-level-down.md` as fixing it — which that
 * task does not do: it fixes plugin-lint's bound, in a different tool, at 3. Two walkers over the same
 * declared key disagreeing about how deep a skill may sit is the sibling-divergence class this
 * repository already has a rule for, so the number is shared rather than independently chosen, and the
 * task is cited for the *shape* it fixes rather than for a number it never gave this tool.
 *
 * **The bound reports when it stops.** That sentence was in this comment before it was true — the walk
 * returned silently at the limit, so a pack whose only skill sat below it was reported as a root with
 * nothing in it, and a skill with a bad name and an empty description passed. Found by the pre-commit
 * checkpoint. Task 0008's own acceptance criterion is that a validator reaching the limit says so
 * rather than reporting an absence it did not establish.
 */
const SKILL_DEPTH = 3;

/**
 * Open and validate what a pack contributes: its skills' frontmatter and its personas' five-part
 * contract. Returns what was actually opened, so the caller's report line can say *opened* rather than
 * *declared* — the distinction the whole check exists to make. `bindable` carries the key each opened
 * persona would be bound by on a host; the caller owns that check, because it needs the tree.
 *
 * **Containment is checked after resolution, never by pattern.** `spec/pack.schema.json` bars only the
 * leading `../` form and says so in its own text; `a/../../x` matches it and still escapes, and a symlink
 * matches nothing until it is followed. `cli/index.mjs` already models the answer for personas —
 * `realpathSync` on both the pack directory and the file, compared after resolution — and this is that
 * rule applied to the half of the manifest nothing had opened.
 */
export function validateContributions(packDir, contributes, { fail, report, pack }) {
    let realPack;
    try {
        realPack = fs.realpathSync(packDir);
    } catch (cause) {
        fail("packs", `\`${pack}\` resolved to a directory that cannot be realpathed — ${cause.code ?? cause.message}`);
        // The SAME shape as the success path, `unreadableRoots` included. A caller reading a property
        // this branch omits gets `undefined`, which is falsy — so the report line silently prints the
        // clean wording over a pack nothing could open. Raised by Copilot, round 1 on #227.
        return { skills: 0, personas: 0, unreadableRoots: 0, bindable: [] };
    }

    // Three answers, not two. `null` meant "could not resolve" and was reported to the reader as "is not
    // there" — which is only true for ENOENT. An EACCES is a question that could not be ANSWERED, and
    // answering it "absent" is the fail-open — "nothing looked" reported as "nothing wrong" — arriving
    // inside the function added to prevent one. Copilot, round 1 on #156; the same class as session 1's
    // round 7, one tool over.
    const inside = (target) => {
        let real;
        try {
            real = fs.realpathSync(target);
        } catch (cause) {
            return cause.code === "ENOENT" ? { state: "absent" } : { state: "unreadable", detail: cause.code ?? cause.message };
        }
        return real === realPack || real.startsWith(`${realPack}${path.sep}`)
            ? { state: "inside", real }
            : { state: "outside" };
    };

    let skills = 0;
    let unreadableRoots = 0;
    for (const rel of contributes.skills ?? []) {
        const root = path.join(packDir, rel);
        const contained = inside(root);
        if (contained.state === "outside") {
            fail(
                "packs",
                `\`${pack}\` declares the skills root \`${rel}\`, which resolves outside the pack. A pack reaching into the adopter's tree ` +
                    `is the one direction the cascade does not run, and the path pattern bars only the leading \`../\` form — this is the check after resolution`,
            );
            continue;
        }
        if (contained.state === "absent") {
            fail("packs", `\`${pack}\` declares the skills root \`${rel}\`, which is not there`);
            continue;
        }
        if (contained.state === "unreadable") {
            fail(
                "packs",
                `\`${pack}\`'s skills root \`${rel}\` could not be resolved — ${contained.detail}. Reported as unreadable rather than absent: ` +
                    `only a missing path means "nothing there", and this question went unanswered`,
            );
            unreadableRoots += 1;
            continue;
        }
        const found = walkSkills(contained.real, { fail, report, pack, rel });
        // `null` means the walk could not look, which is NOT zero. Summing it as zero would put "0
        // skill(s)" in the report line over a root nothing opened — the same "nothing looked recorded as
        // nothing wrong" the walker itself refuses, arriving one layer out in the sentence a reader
        // actually reads. Found by the test written for the walker, which is the argument for testing the
        // report line and not only the finding.
        if (found === null) unreadableRoots += 1;
        else skills += found;
    }

    let personas = 0;
    // What each opened persona would be BOUND by on a host, collected here because this is the one
    // place the file is read. The caller matches them against `agents/` once the tree is known — the
    // check needs a repository, and this function is given a pack.
    const bindable = [];
    for (const rel of contributes.personas ?? []) {
        const file = path.join(packDir, rel);
        const contained = inside(file);
        if (contained.state === "outside") {
            fail("packs", `\`${pack}\` declares the persona \`${rel}\`, which resolves outside the pack`);
            continue;
        }
        if (contained.state === "absent") {
            fail("packs", `\`${pack}\` declares the persona \`${rel}\`, which is not there`);
            continue;
        }
        if (contained.state === "unreadable") {
            fail("packs", `\`${pack}\`'s persona \`${rel}\` could not be resolved — ${contained.detail}. Only a missing path means absent`);
            continue;
        }
        let text;
        try {
            text = fs.readFileSync(contained.real, "utf8");
        } catch (cause) {
            fail("packs", `\`${pack}\`'s persona \`${rel}\` could not be read — ${cause.code ?? cause.message}. Only a missing file means absent`);
            continue;
        }
        const declared = validatePersona(text, { fail, pack, rel });
        personas += 1;
        // The key is the declared `name`, and the file's basename where it declares none. Two sources
        // rather than one because the contract's five parts do not include a name — a persona missing
        // it is not thereby unbindable, and `new persona` writes `personas/<name>.md`, so the basename
        // is the author's own answer to the same question. Which one answered is printed, since a
        // binding resolved by filename is a weaker fact than one resolved by declaration.
        const basename = path.basename(rel, ".md");
        bindable.push({
            rel,
            key: declared?.name ?? basename,
            keyedBy: declared?.name ? "declaration" : "filename",
        });
    }

    return { skills, personas, unreadableRoots, bindable };
}

/**
 * One persona against the five-part contract, plus the tier no role may claim.
 *
 * **What this checks is PRESENCE, and that is narrower than "validated".** Four of the five parts are
 * matched as headings, so a persona whose Charter, Autonomy reach, Memory scope and Read/write posture
 * sections are all empty passes; and `tools:` is satisfied by any non-empty value, so `tools: []` passes.
 * Both measured at the pre-commit checkpoint. The distinction matters because `core/operating/memory.md`
 * frames this milestone as where a declared memory scope stops being prose a checker can read but not
 * honour — a heading check reads it and does not honour it, and the sentence saying so belongs beside the
 * check rather than only in the milestone's record.
 *
 * **Returns the name the persona declares, or `null` where it declares none** — the key the binding
 * check below resolves a host agent file by. It is returned rather than re-parsed at the call site
 * because the frontmatter has already been read here, and two parses of one block are two chances to
 * disagree about what it said.
 */
export function validatePersona(text, { fail, pack, rel }) {
    const { fields, error } = parseFrontmatter(text);
    if (!fields) {
        fail("packs", `\`${pack}\`'s persona \`${rel}\` has no usable frontmatter${error ? ` — ${error}` : ""}, so it declares no \`tools:\` allow-list`);
        return null;
    }
    for (const { part, find } of PERSONA_PARTS) {
        if (!find(fields, text)) {
            fail("packs", `\`${pack}\`'s persona \`${rel}\` is missing ${part} — the five-part contract core/personas/README.md fixes`);
        }
    }
    // Prohibited is the one tier no role may act in, so a persona declaring it as a reach claims a
    // permission that does not exist for anyone.
    //
    // **The first cut of this check flagged the word anywhere in the reach section, and its first run
    // false-redded this repository's own `checkpoints` supervisor** — whose reach section says
    // *"**Prohibited is not a reach** and does not appear here"*. That file is obeying the rule by
    // explaining it, and the checker could not tell disclaiming from claiming. A false red is the failure
    // that gets a whole recipe switched off (`.portulan/memory/` records `json.sh` costing exactly that),
    // so the matcher is narrowed to an affirmative mention.
    //
    // **The limit, restated after the pre-commit checkpoint measured it WIDER than the first wording
    // admitted.** This is a prose heuristic and prose defeats it. The splitter breaks on sentence
    // punctuation and blank lines, so a *block* — a bullet list, which is the ordinary way a reach
    // section is written — counts as one unit: a negation **anywhere in the same block** suppresses the
    // finding, not merely one in the same sentence. Both of these pass:
    //
    //     - Acts in Prohibited
    //     - This role does not merge
    //
    //     Reach is Prohibited, and there is no ceiling above it
    //
    // The structural fix is a declared reach *field* the way `tools:` is a field — a persona-contract
    // change, and not an implementer's to make. Named at this width so the gap is visible instead of
    // assumed covered, which is the rule `core/operating/verification.md` legislates.
    const reach = text.split(/^##\s+Autonomy reach\b.*$/im)[1]?.split(/^##\s/m)[0];
    if (reach && claimsProhibited(reach)) {
        fail(
            "packs",
            `\`${pack}\`'s persona \`${rel}\` names Prohibited in its Autonomy reach without disclaiming it. Prohibited is the one tier no ` +
                `role may act in — a persona claiming it claims a permission nobody has (core/personas/README.md)`,
        );
    }
    return { name: typeof fields.name === "string" && fields.name.trim() ? fields.name.trim() : null };
}

/** Walk one declared skills root to the fixed depth, validating each `SKILL.md` frontmatter. */
function walkSkills(root, { fail, report, pack, rel }, depth = 0) {
    let found = 0;
    const own = path.join(root, "SKILL.md");
    // `lstat`, not `existsSync` — the latter FOLLOWS links, and a `SKILL.md` symlinked out of the pack
    // under a contained root was opened, validated and counted as the pack's own. Containment covered the
    // declared root and not the files found beneath it, which is the half-guarantee shape session 1 paid
    // for twice. Found by the pre-commit checkpoint.
    let ownStat = null;
    try {
        ownStat = fs.lstatSync(own);
    } catch (cause) {
        if (cause.code !== "ENOENT") {
            fail("packs", `\`${pack}\`'s \`${path.join(rel, "SKILL.md")}\` could not be examined — ${cause.code ?? cause.message}`);
        }
    }
    if (ownStat?.isSymbolicLink()) {
        fail(
            "packs",
            `\`${pack}\`'s \`${path.join(rel, "SKILL.md")}\` is a symlink. It is refused rather than followed: a link under a contained root ` +
                `is how a pack ships a file it does not contain, and containment that checks only the declared root is not containment`,
        );
    } else if (ownStat?.isFile()) {
        validateSkill(own, { fail, pack, rel: path.join(rel, "SKILL.md") });
        found += 1;
    }
    if (depth >= SKILL_DEPTH) {
        // Reported, never silent. Only when there is something below to miss: announcing a stop over an
        // empty directory would be noise, and a note nobody can act on trains a reader to skip the ones
        // they can.
        let below = [];
        try {
            below = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory());
        } catch {
            below = [];
        }
        if (below.length) {
            report(
                "packs",
                `\`${pack}\`'s skills root \`${rel}\` has ${below.length} ${below.length === 1 ? "directory" : "directories"} below the ${SKILL_DEPTH}-level walk bound, ${below.length === 1 ? "which was" : "which were"} NOT looked at. ` +
                    `A skill down there is neither validated nor counted — said out loud because a walk that stops quietly is a green over what it never opened`,
            );
        }
        return found;
    }

    let entries;
    try {
        entries = fs.readdirSync(root, { withFileTypes: true });
    } catch (cause) {
        // Only ENOENT means absent. Anything else and the walk could not look, which must never be
        // reported as a root with no skills in it — #108's shape, arriving in a new walker.
        if (cause.code === "ENOENT") {
            fail("packs", `\`${pack}\` declares the skills root \`${rel}\`, which is not there`);
            return found;
        }
        fail(
            "packs",
            `\`${pack}\`'s skills root \`${rel}\` could not be read — ${cause.code ?? cause.message}. ` +
                `Reported as unreadable rather than as empty: a walk that says "no skills here" over a directory it never opened is a green over nothing`,
        );
        return null;
    }
    for (const entry of entries) {
        // A symlinked directory has `isDirectory() === false` and `isSymbolicLink() === true`, so the
        // obvious `if (!isDirectory()) continue` SKIPS it — silently, with no finding, hiding whatever
        // skills sit behind it. That is a false green of the walk's own kind, and it is reported rather
        // than followed for the same reason the `SKILL.md` link is: following it is how a pack ships
        // content it does not contain. Copilot, round 3 on #156.
        if (entry.isSymbolicLink()) {
            fail(
                "packs",
                `\`${pack}\`'s skills root \`${rel}\` contains \`${entry.name}\`, a symlinked directory. It is refused rather than followed or ` +
                    `skipped — following it lets a pack ship skills it does not contain, and skipping it silently would hide whatever is behind it`,
            );
            continue;
        }
        if (!entry.isDirectory()) continue;
        const child = walkSkills(path.join(root, entry.name), { fail, report, pack, rel: path.join(rel, entry.name) }, depth + 1);
        // A child that could not be read returns `null`, and `found += null` would add ZERO — not NaN,
        // which is what the review that found this proposed; `null` coerces to 0 in numeric addition,
        // measured. The conclusion was right and the mechanism was not, and the real defect is the worse
        // of the two: an unreadable subdirectory would be silently counted as *no skills here*, which is
        // exactly the "nothing looked recorded as nothing wrong" this walk was changed to stop — surviving
        // one level down from the fix. Propagated instead, so the root reports UNREAD however deep the
        // unreadable directory sits.
        if (child === null) return null;
        found += child;
    }
    return found;
}

/** One skill's frontmatter: the `name` and `description` that ARE the contract a host reads. */
export function validateSkill(file, { fail, pack, rel }) {
    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    } catch (cause) {
        fail("packs", `\`${pack}\`'s skill \`${rel}\` could not be read — ${cause.code ?? cause.message}`);
        return;
    }
    const { fields, error } = parseFrontmatter(text);
    if (!fields) {
        fail("packs", `\`${pack}\`'s skill \`${rel}\` has no usable frontmatter${error ? ` — ${error}` : ""}. For a skill the block IS the contract, not decoration`);
        return;
    }
    if (typeof fields.name !== "string" || !SLUG_PATTERN.test(fields.name)) {
        fail(
            "packs",
            `\`${pack}\`'s skill \`${rel}\` has \`name: ${fields.name ?? "(absent)"}\`, which is not kebab-case. ` +
                `The name is required here although the platform treats it as optional, so a skill's invocation name comes from the skill rather than from where it sits`,
        );
    }
    if (typeof fields.description !== "string" || !fields.description.trim()) {
        fail(
            "packs",
            `\`${pack}\`'s skill \`${rel}\` has an empty \`description\`. It is the only line a host reads before deciding whether to load the body, ` +
                `so it carries the trigger — an empty one produces a skill that is never selected`,
        );
    }
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Does this reach section CLAIM Prohibited, as opposed to disclaiming it?
 *
 * Sentence-scoped, because the two readings sit in the same section and differ only by a negation. A
 * sentence mentioning the tier alongside `not` / `never` / `no role` / `nobody` / `cannot` is the
 * disclaimer every well-written persona contains — this repository's own supervisor is one — and
 * flagging it made a correct file red on the check's first run.
 */
function claimsProhibited(reach) {
    for (const sentence of reach.split(/(?<=[.!?])\s+|\n{2,}/)) {
        if (!/\bProhibited\b/.test(sentence)) continue;
        if (/\b(?:not|never|no|nobody|none|cannot|can't|doesn't|does not|isn't|is not)\b/i.test(sentence)) continue;
        return true;
    }
    return false;
}

/**
 * The Pack Definition version a schema implements, read from its `$id` — the same argument as
 * `schemaVersion` below, on the other version train. Separate rather than shared because the two
 * `$id` shapes differ deliberately (`/spec/2.5/` and `/spec/pack/1.0/`), and a single regex loose
 * enough to read both would read `/spec/pack/1.0/` as Workspace Definition version 1.0.
 */
export function packSchemaVersion(schema) {
    const match = /\/spec\/pack\/([0-9]+)\.([0-9]+)\//.exec(schema.$id ?? "");
    if (!match) {
        throw new DoctorError(
            "the pack schema's `$id` does not carry a `/spec/pack/MAJOR.MINOR/` segment, so `doctor` " +
                "cannot tell which Pack Definition version it implements",
        );
    }
    return { major: Number(match[1]), minor: Number(match[2]) };
}

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

function loadPackSchema({ packSchema, packSchemaPath }) {
    if (packSchema) return packSchema;
    return loadSchema({ schemaPath: packSchemaPath ?? DEFAULT_PACK_SCHEMA });
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

// ===========================================================================================
// 3b. Agent legibility
// ===========================================================================================
//
// Row 7's 2026-07-28 amendment: `doctor` scores agent legibility — the audit `docs/vision.md`'s
// influence map calls the **unclaimed niche**, "repo affordances scored by doctor".
//
// **It moves no exit code, and that is the design rather than a shortfall.** A score is a
// measurement; `doctor`'s exit codes are verdicts about conformance. A score that could fail a
// workspace would make the verdict a function of how much affordance prose somebody wrote, and
// every incentive it created would point at writing more of it.
//
// **Every carrier of the amendment says the `affordances` slot "is its input", and this reads six
// keys besides.** That is a reading, stated rather than taken in silence: the constitution's own
// gloss is *"repo affordances scored by doctor"* — the repository's affordances, of which the slot
// is the written half — and a score confined to the slot could not tell two workspaces apart at
// all. **The slot is the named input, not the only one.**
//
// What each dimension has in common is the property that makes a score honest: every one is
// **optional in the Workspace Definition**, so it can genuinely be absent, and none of them
// duplicates a check that already fails. A dimension that cannot vary measures nothing, and a
// dimension that restates a hard failure is a second carrier of one fact.
//
// **Three candidates were dropped by that rule, and they are named because two of them were in this
// session's own plan.** *A declared `tree`* and *a repo card for every repository the products name*
// were both listed in task 0013's acceptance list; each is already a hard failure — `tree` for any
// `kind: repository`, the cards through the `cross` check — so scoring them would have been a
// guaranteed point for every workspace that got far enough to be scored, and a second carrier of a
// verdict the tool already renders. *Executable verification* was the third, and it survived one
// checkpoint before being measured: see `legibility` itself. **Seven dimensions is what the rule
// leaves**, and the number is derived by the suite rather than trusted here.

/**
 * The headings that state limits, and it is a FORM check.
 *
 * A named table rather than a matcher clever enough to be wrong quietly — the same shape and the
 * same reason as `PERSONA_PARTS` above and as the writer table in `cli/compile.mjs`. What it
 * establishes is that a limits section is **present**, never that what it says is true or complete:
 * a heading with an empty body passes. `.portulan/products/portulan/affordances.md` states the rule
 * this scores in its own words — *"a legibility report that lists only strengths is marketing"* — and
 * a form check is the most a reader of the tree can hold anybody to.
 */
const LIMIT_HEADINGS = [
    /^#{2,3}\s+What an agent must not assume\b/im,
    /^#{2,3}\s+.*\bmust not\b/im,
    /^#{2,3}\s+.*\bdo(es)? not\b/im,
    /^#{2,3}\s+(Honest )?[Ll]imits\b/im,
    /^#{2,3}\s+.*\bnot (guaranteed|checked|enforced)\b/im,
];

/**
 * Score one workspace's agent legibility.
 *
 * Returns `{ met, applicable, dimensions }`, where a dimension is
 * `{ id, title, met, applicable, why }`. **Inapplicable dimensions leave the denominator** rather
 * than counting as failures: a workspace with no products has nothing to declare affordances for,
 * and scoring it down for that would be grading it against a standard it is not under.
 *
 * Reads the tree only through paths the manifest declares, so it fetches nothing and infers nothing.
 */
export function legibility(workspace, dir) {
    const dimensions = [];
    const add = (id, title, met, why, applicable = true) => dimensions.push({ id, title, met, applicable, why });

    // **`verify` itself is deliberately NOT a dimension**, and the reason is the rule this list is
    // built on. The schema's first `oneOf` form requires `slots` and `verify` of every workspace that
    // is not a pointer, a pointer returns long before this line, and a manifest that fails the schema
    // returns earlier still — so *does this workspace declare executable verification* is a question
    // whose answer is always yes by the time anything here could ask it. It was scored for exactly one
    // pre-commit checkpoint, which measured it and found a dimension that could not vary: a constant
    // +1 dressed as a measurement, in a list whose whole claim is that every entry can genuinely be
    // absent. What a recipe DECLARES about itself still varies, which is the dimension below.
    const recipes = workspace.verify?.recipes ?? [];
    add(
        "requires",
        "recipes that declare what they need",
        recipes.every((r) => Array.isArray(r.requires) && r.requires.length > 0),
        "`could not run` stays distinguishable from `ran and failed`, which is what stops a missing tool reading as a pass",
        recipes.length > 0,
    );
    add(
        "gates",
        "a gate policy a machine reads",
        typeof workspace.gates === "string" && workspace.gates.length > 0,
        "the prose gate map argues the tiers; the policy beside it is the half something can compile into enforcement",
    );
    add("dod", "a stated bar for done", Boolean(workspace.slots?.dod), "an agent can tell finished from working, without inferring it from the tests that happen to exist");
    add(
        "memory",
        "a memory store with a generated index",
        Boolean(workspace.slots?.memory) && Boolean(workspace.memory?.index),
        "recall is a file an agent reads, not a directory it walks and summarises differently each time",
    );
    add(
        "handoffs",
        "a handoff series with a generated index",
        Boolean(workspace.slots?.handoffs) && Boolean(workspace.handoffs?.index),
        "why a decision was taken survives the session that took it, and is reachable without reading the series",
    );

    // The slot the amendment names, read for both of its dimensions in one pass.
    //
    // **Per DOCUMENT, not per product**, and the distinction is the whole of #228 item 1. `products`
    // resolve `product.affordances ?? workspace.affordances`, so N products inheriting one
    // workspace-level default all name the same `rel` — which was read N times, and, when it could not
    // be read, counted N times. `unreadable` was therefore a count of **products**, under a name that
    // says documents, and both dimensions below are about documents.
    //
    // Nothing read the magnitude — `limits` asks only `unreadable === 0`, so no verdict moved — which
    // is exactly why it is worth fixing now rather than after something starts reading it. A count
    // wrong about its own unit, in the tool whose subject is claims being checkable.
    //
    // Triaged out of [#227](https://github.com/sleepy-panda-srl/portulan/pull/227) at the two-fix-round
    // bound and **dropped on 2026-08-12 for scope, not on merits** — "nothing here opens
    // cli/doctor.mjs" — which is the disposition this change reverses now that something does.
    const products = workspace.products ?? [];
    const docs = [];
    const seen = new Set();
    let unreadable = 0;
    for (const product of products) {
        const rel = product.affordances ?? workspace.affordances;
        if (!rel || seen.has(rel)) continue;
        seen.add(rel);
        try {
            docs.push({ rel, text: fs.readFileSync(path.resolve(dir, rel), "utf8") });
        } catch {
            // Counted, never skipped: a document that could not be read has not been found to state
            // its limits, and treating it as absent and as present are both claims nothing established.
            unreadable += 1;
        }
    }
    add(
        "affordances",
        "affordances declared for every product",
        products.length > 0 && products.every((p) => p.affordances || workspace.affordances),
        "what an agent may rely on is written down per product — its own slot, or the workspace-level default it inherits",
        products.length > 0,
    );
    add(
        "limits",
        "affordances that state limits, not only strengths",
        docs.length > 0 && unreadable === 0 && docs.every((d) => LIMIT_HEADINGS.some((h) => h.test(d.text))),
        "a legibility document listing only what works is marketing; the half an agent needs is what it must not assume",
        docs.length > 0 || unreadable > 0,
    );

    const applicable = dimensions.filter((d) => d.applicable);
    return { met: applicable.filter((d) => d.met).length, applicable: applicable.length, dimensions };
}

/**
 * Inspect one workspace directory.
 * Returns `{ dir, workspace, findings, stats }`. A finding is `{ severity, check, message }`,
 * where severity is `fail` (exit 1) or `report` (worth reading, not a verdict).
 */
export async function inspect(workspaceDir, options = {}) {
    const schema = loadSchema(options);
    const packSchema = loadPackSchema(options);
    const dir = path.resolve(workspaceDir);
    const findings = [];
    // `unretirable` counts records stating no `Retire when:` condition — retirable by a human
    // re-reading them, never by the condition-driven pass, which is the sense that matters here.
    const stats = { records: 0, rules: 0, sealed: 0, linked: 0, claims: 0, unverifiable: 0, bytes: 0, unretirable: 0, unassessed: 0, packs: 0 };
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
                    `exists and this validator is not the one to run — ` +
                    // Named since milestone 7 session 9. This sentence said a migration exists and
                    // stopped there, which is a refusal that describes a remedy nobody could reach:
                    // the tool did not exist when it was written. It reads the direction too, since
                    // a workspace AHEAD of this bundle is not one `upgrade` can help with.
                    (major > here.major
                        ? "and this validator is OLDER than that workspace, so upgrade the CLI rather than the workspace."
                        : "run `portulan upgrade <workspace-dir>` to see what it owes, and `--write` to apply it."),
            );
        }
        if (minor > here.minor) {
            throw new DoctorError(
                `${path.relative(process.cwd(), dir)} declares Workspace Definition ${major}.${minor}, ` +
                    `which is ahead of the ${here.major}.${here.minor} this schema implements. Refusing ` +
                    `rather than grading it against an older contract and reporting the difference as errors — ` +
                    // The MAJOR arm above names its remedy and this one stopped at "Refusing", which is
                    // one rule enforced at two sites and repaired at one — `0020`, ten lines apart, in
                    // the change that repaired the other site. Caught at the pre-commit checkpoint.
                    "and this validator is OLDER than that workspace, so upgrade the CLI rather than the workspace.",
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

    // ---- residence: exactly one workspace governs a repository
    //
    // The maintainer's ruling of 2026-07-30, recorded in ../.portulan/proposals/0017. Two of its three
    // refusals are here, where a single manifest is enough to see the fault; the third needs to look
    // outside this directory and is below, with the repo cards.
    //
    // These are `doctor`'s and not the schema's ON PURPOSE, and the reason is mechanical rather than
    // stylistic: the schema's own failures return above at "the manifest must conform first", so a
    // shape refused by the schema is a shape whose refusal never prints the sentence it exists to
    // print. The rule is a sentence a human has to read — the whole point is that the reader learns
    // *why* two workspaces are one too many — so the schema permits the shape and this refuses it.
    const GOVERNS =
        "a repository is governed by exactly one workspace — it carries its own full workspace, or a " +
        "pointer to the workspace that names it, never both";
    // Everything a pointer may carry. `summary` is here because one line an agent reads before loading
    // anything else costs nothing and is the difference between "governed elsewhere" and a bare name.
    const POINTER_KEYS = new Set(["portulan", "name", "summary", "kind", "governed_by"]);
    // Read off the schema rather than written out again. The cross-repository check below needs to tell a
    // kind it UNDERSTANDS from one it does not, and a second hand-maintained copy of that list is the
    // defect class this whole change is partly about — one fact, two carriers, only one of them checked.
    // Derived, so a fifth kind joins both at once or neither.
    const KNOWN_KINDS = new Set(schema.properties?.kind?.enum ?? []);

    if (workspace.kind === "pointer") {
        const carried = Object.keys(workspace).filter((key) => !POINTER_KEYS.has(key)).sort();
        if (carried.length) {
            fail(
                "residence",
                `this manifest declares \`kind: "pointer"\` and also carries ` +
                    `${carried.map((k) => `\`${k}\``).join(", ")} — ${GOVERNS}. A pointer names its ` +
                    "governor and holds no policy of its own; the moment it holds any of it there are " +
                    "two policy layers for one repository and nothing holding them in agreement",
            );
        }
        // A pointer is not a small workspace, it is a different object: no slots to resolve, no
        // recipes, no products, no packs, no store, no cards. Every check below reads one of those, so
        // running them here would grade the absence of things a pointer correctly does not have —
        // `verify.default` alone would fail every compliant pointer, naming a recipe list that is empty
        // because the manifest is right. Skipped, and SAID, on the standing rule that a check which
        // disappears without a word is worse than one that admits what it could not reach.
        // Blank reads as absent HERE too, because the resolver one file away now treats it that way and
        // two carriers of one fact are this repository's signature defect. Reporting *"delivered through
        // `   `"* while `resolveGovernor` ignores that value is a report describing a constraint the tool
        // does not apply — worse than either behaviour alone, since a reader would go looking for the
        // marketplace it names. Found by Copilot on the round that reviewed the fix, and by the
        // pre-commit checkpoint independently, both of them at the site the fix did not reach.
        const rawFeed = workspace.governed_by?.feed;
        const feed = typeof rawFeed === "string" && rawFeed.trim() !== "" ? rawFeed : undefined;
        report(
            "residence",
            `governed by \`${workspace.governed_by?.workspace}\`` +
                (feed ? `, delivered through \`${feed}\`` : "") +
                " — no workspace resides here, and this manifest says so rather than improvising one",
        );
        // ---- and now the name is dereferenced, which it was not until milestone 7's discovery
        //
        // This report said *"Nothing was fetched: resolving a pointer to the workspace it names is
        // discovery, and the roots are named rather than found (milestone 7)"*. Discovery has landed
        // (./discover.mjs), so the sentence became a document denying a capability that exists —
        // condition 4 of ../.portulan/dod.md pointing the other way, which this repository has now
        // corrected often enough to expect.
        //
        // **Nothing is fetched is still true and is still said**, by the resolver's own sentence: the
        // host's installed-plugin record is read from disk and no network call is made anywhere in
        // this path. What changed is that a name on disk is now looked up, not that anything is
        // downloaded.
        //
        // The verdict is REPORTED and never graded, and that boundary is load-bearing rather than
        // cautious. `not-installed` is not a defect in this manifest — a pointer is correct while its
        // governor is uninstalled, which is the ordinary state of a fresh clone — so failing here
        // would red every honest pointer on every machine that had not run an install yet, including
        // CI, where nothing is ever installed. What the reader gets instead is the root, and what to
        // run against it.
        // `await`ed, though today's resolver is synchronous and `await` on a plain value is a no-op.
        // `options.discover` is an injection point, `inspect` is already `async`, and a hook that ever
        // returns a promise would otherwise yield `governor.state === undefined` — a report about a
        // Promise rather than about a host. One keyword now against a class of silent wrong answer
        // later (Copilot, round 2).
        const resolve = options.discover ?? ((governedBy) => resolveGovernor(governedBy, options));
        const governor = await resolve(workspace.governed_by);
        // The resolver owns the sentence — one carrier, so every surface reporting this prints the same
        // words rather than four paraphrases. The fallback names what the resolver answered rather than
        // inventing prose: a resolver returning no sentence is a defect in the resolver, and a report
        // that hid it behind something still looking like a report would be the worse failure.
        //
        // **The fallback had that defect itself, in the line that claimed to prevent it** (#182 item 2).
        // It interpolated `governor.state` directly, so a verdict object carrying no `state` printed the
        // literal word `undefined` inside the one sentence whose whole job is to say a resolver
        // misbehaved. It now distinguishes three shapes — a state, a state that is not a string, and no
        // state at all — because "no `state` at all" said of `{state: 123}` is the same class of wrong
        // one revision later, which is what the pre-commit checkpoint found by feeding it that value.
        //
        // Deliberately NOT changed: a resolver that throws, or returns `null` or `undefined`, still
        // propagates to this tool's top-level catch and exits **2** — *could not run*, which is what that
        // catch's own header says of anything reaching it, a defect in `doctor` included. Measured four
        // ways through `run()` before any of this was written, and three of the four were already right.
        // And the reachability is worth recording so nobody prices this above what it is: `options.discover`
        // is a test seam, every `resolveGovernor` return path sets `sentence`, so no shipped path reaches
        // the fallback at all. It is the most marginal of #182's three items.
        const answered = () => {
            if (typeof governor.state === "string") return `\`${governor.state}\``;
            if ("state" in governor) return `a \`state\` that is not a string (\`${typeof governor.state}\`)`;
            const keys = Object.keys(governor);
            return `no \`state\` at all (keys: ${keys.length ? keys.map((k) => `\`${k}\``).join(", ") : "none"})`;
        };
        report("residence", governor.sentence ?? `the pointer resolver answered ${answered()} and supplied no sentence`);
        if (governor.state === "resolved") {
            report(
                "residence",
                `run \`doctor ${display(governor.root)}\` to grade it — this run judged the pointer and not ` +
                    "the workspace it names, and a green pointer is not a statement that its governor is green",
            );
        }
        report(
            "residence",
            "the governing-workspace checks did not run here — path slots, cross-field, packs, claims, " +
                "enforcement, provenance and the store reports all read a policy layer this manifest " +
                "correctly does not carry. They run where the workspace resides, and a green pointer is " +
                "not a statement that the workspace it names is green",
        );
        return { dir, workspace, findings, stats, governor };
    }

    if (workspace.governed_by) {
        fail(
            "residence",
            `this manifest declares \`kind: "${workspace.kind}"\` — a governing workspace — and also a ` +
                `\`governed_by\` pointer at \`${workspace.governed_by.workspace}\`, and ${GOVERNS}. This ` +
                "is the refusal above from the other side: a workspace that carries the policy layer AND " +
                "names another as its governor is the dual management the ruling refuses",
        );
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
    // Added with the `memory` object in Workspace Definition 2.3, in the same change as the key —
    // because the `gates` line above records what happens when it is not: a manifest naming a file
    // that does not exist, validating GREEN, for one whole checkpoint.
    if (workspace.memory?.index?.path) resolvePath(workspace.memory.index.path, "file", "memory.index.path");
    (workspace.products ?? []).forEach((product, i) => {
        resolvePath(product.product, "file", `products[${i}].product`);
        if (product.affordances) resolvePath(product.affordances, "file", `products[${i}].affordances`);
    });
    // Reads `verify.recipes` directly, and that is deliberate now that `cli/recipe-set.mjs` is the one
    // carrier of the RUNNABLE set. This is not a reader of that set: it validates the workspace's own
    // DECLARATION — that each declared recipe's `doc` resolves — which is a claim about this manifest,
    // not about what CI will run. A composed recipe's `doc` resolves from its own pack root and is that
    // pack's to validate. The same distinction governs the `verify.default` cross-check below. Both are
    // exempt from the undeclared-reader sweep in `cli/recipe-set.live.test.mjs` for this reason, and
    // the exemption is named there too so the two cannot drift apart.
    (workspace.verify?.recipes ?? []).forEach((recipe, i) => {
        if (recipe.doc) resolvePath(recipe.doc, "file", `verify.recipes[${i}].doc`);
    });

    // ---- cross-field
    //
    // Scoped to the workspace's OWN recipes on purpose, and it stays that way now that a pack's
    // recipes compose into the runnable set. `verify.default` is a bare slug (`$defs/slug`) and a
    // composed id is `<category>/<name>:<id>`, so a composed recipe can never be named here — widening
    // this check to the composed union would accept nothing new and would quietly suggest that naming
    // a pack's recipe as the default is a thing a manifest may do. Row 7 forbids exactly that: a
    // composed recipe may never become the workspace's `verify.default`.
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

    // The residence ruling's third refusal, and the only one that has to look outside this directory:
    // a repository this workspace NAMES must not carry a governing workspace of its own. Visibility is
    // the whole difficulty — a portfolio workspace declares no `tree`, so it has no path to the
    // repositories it covers — and it is bought the way the packs resolver buys its own, with named
    // roots rather than discovery. `--repo-root` is to repo cards what `--pack-root` is to packs.
    //
    // What this does NOT do, stated because the asymmetry is real: the refusal runs from the naming
    // workspace outward. A repository carrying a full workspace cannot see a portfolio that claims it,
    // and nothing here changes that.
    const repoRoots = options.repoRoots ?? [];
    if (cardNames.size) {
        if (repoRoots.length === 0) {
            report(
                "residence",
                `governance of the ${cardNames.size} repositor${cardNames.size === 1 ? "y" : "ies"} this ` +
                    "workspace names was not checked — no `--repo-root` was given, so nothing looked for " +
                    "a workspace on that side. " +
                    "Reported rather than passed over: the roots are named, never discovered, so silence " +
                    "here would be indistinguishable from a clean result",
            );
        } else {
            for (const name of [...cardNames].sort()) {
                let found = null;
                for (const root of repoRoots) {
                    const candidate = path.join(root, name, ".portulan", "workspace.json");
                    if (fs.existsSync(candidate)) {
                        found = candidate;
                        break;
                    }
                }
                if (!found) {
                    report(
                        "residence",
                        `\`${name}\` carries no manifest under any named root — either it is not governed ` +
                            "by Portulan at all, or it is not checked out where this run could see it. " +
                            "Those two are not distinguished here, and neither is a failure",
                    );
                    continue;
                }
                // A workspace that names its own repository finds ITSELF at the root — one manager seen
                // twice, not two managers. Customer zero is exactly this shape: `.portulan/` names the
                // card `portulan`, so the first run of this check against a root holding the Portulan
                // checkout would have refused the very arrangement the ruling permits. Compared on the
                // REAL path, because the root is commonly reached through a symlink and a lexical
                // comparison would miss the identity and print a false red.
                let identical = false;
                try {
                    identical = fs.realpathSync(found) === fs.realpathSync(manifestPath);
                } catch { /* one of them moved mid-run; fall through and grade what is there */ }
                if (identical) {
                    report(
                        "residence",
                        `\`${name}\` resolves to this manifest itself — one workspace seen from outside, ` +
                            "which is a workspace governing its own repository and is the arrangement the " +
                            "ruling permits rather than the one it refuses",
                    );
                    continue;
                }
                let other;
                try {
                    other = JSON.parse(fs.readFileSync(found, "utf8"));
                } catch (cause) {
                    report(
                        "residence",
                        `\`${name}\` has a manifest at ${display(found)} that could not be read — ` +
                            `${cause.message}. Reported, not failed: an unreadable file is not evidence of ` +
                            "double governance, and refusing on it would make this check wrong about a " +
                            "repository nobody looked into",
                    );
                    continue;
                }
                // A manifest at a named root is READ, never validated — `doctor` grades one workspace per
                // run and this is somebody else's. Everything below follows from that one fact, and it
                // took two rounds to apply it consistently: this check refuses only what a manifest
                // clearly DECLARES, and reports every shape it merely fails to understand. A refusal
                // built on a field this run never validated would be a verdict about a workspace nobody
                // graded.
                //
                // The first miss was a pointer with no `governed_by.workspace`, refused for "naming
                // `undefined`" — a conflicting-governor verdict about a manifest naming no governor at
                // all. The second was its sibling one field over, and it survived the fix to the first:
                // a manifest with a MISSING or unrecognised `kind` fell into the governing branch and was
                // refused as `kind: "undefined"`. Both found by Copilot on #135, rounds 1 and 4, which is
                // the sibling class the 2026-07-27 ruling names — found here in the very change that
                // quotes that ruling twice.
                if (!KNOWN_KINDS.has(other.kind)) {
                    report(
                        "residence",
                        `\`${name}\` has a manifest at ${display(found)} declaring no recognisable ` +
                            `\`kind\` (${JSON.stringify(other.kind)}). That is a defect in that manifest ` +
                            "and `doctor` says so where it runs; it is not evidence about governance, so " +
                            "nothing is refused here",
                    );
                } else if (other.kind !== "pointer") {
                    fail(
                        "residence",
                        `\`${name}\` is named by this workspace and carries its own \`kind: ` +
                            `"${other.kind}"\` workspace at ${display(found)}, and ${GOVERNS}. One of the ` +
                            "two has to become a pointer, and which one is the customer's choice — both " +
                            "residences carry full functionality, so nothing is lost either way",
                    );
                } else if (typeof other.governed_by?.workspace !== "string" || other.governed_by.workspace.trim() === "") {
                    // The question is **is this a usable governor name**, not *is the key present* — the
                    // third gap of this same class in this one block, and the one the first two fixes
                    // left. `=== undefined` catches ABSENT and not INVALID, so `""`, `null` and a
                    // non-string fell through to the conflicting-governor branch below and were refused
                    // for naming a governor they do not name: a **false red** about somebody else's
                    // manifest, in the block whose own rule is *read, never validated*.
                    //
                    // Blank counts as no name, which is the rule `cli/discover.mjs` now enforces at the
                    // other site of this same operation. **Non-blank string**, deliberately, not *usable
                    // slug*: a padded or otherwise illegal name is still a name the manifest DECLARES, and
                    // judging its legality would be validating somebody else's workspace — the one thing
                    // this block forbids. So `"  sleepy-panda  "` stays a conflict rather than becoming
                    // "no name", and a test pins that boundary. The schema would refuse `""` through `$defs/slug`, but the schema
                    // never runs here, and that is the whole point of read-not-validated.
                    // ([#141](https://github.com/sleepy-panda-srl/portulan/issues/141), found by Copilot
                    // on #135 and filed rather than fixed there.)
                    const named = other.governed_by?.workspace;
                    report(
                        "residence",
                        `\`${name}\` carries a pointer at ${display(found)} that names no usable governing ` +
                            `workspace${named === undefined ? "" : ` (\`governed_by.workspace\` is ${JSON.stringify(named)})`}. ` +
                            "That is a defect in that manifest and `doctor` says so where it " +
                            "runs; it is not evidence about governance, so nothing is refused here",
                    );
                } else if (other.governed_by.workspace !== workspace.name) {
                    fail(
                        "residence",
                        `\`${name}\` is named by this workspace (\`${workspace.name}\`) but its pointer ` +
                            `names ${JSON.stringify(other.governed_by.workspace)} as its governor, and ${GOVERNS} — ` +
                            "two workspaces both believing they govern one repository is that failure with " +
                            "the second copy moved one directory away",
                    );
                } else {
                    report(
                        "residence",
                        `\`${name}\` carries a pointer naming this workspace — governed here, once`,
                    );
                }
            }
        }
    }

    // Every persona a composed pack contributes, with the key a host would bind it by. Declared out
    // here rather than inside the branch below so the binding check has one shape to read: a workspace
    // composing no packs contributes no personas, which is an empty list and not a missing one.
    const composedPersonas = [];

    // The roots the packs section resolved, carried to the enforcement section so the two read ONE
    // resolution rather than each running `rootPlan`. Two calls would be two answers whenever
    // discovery is in play — the host's plugin record can change between them, and more to the point a
    // second call is a second carrier of the precedence rule this file already imports rather than
    // respells. `null` means the packs section never ran, which is not the same as "it ran and found
    // nothing": the enforcement section keys on that difference below.
    let resolvedPackRoots = null;
    let packsUnresolved = 0;

    if (workspace.packs?.length) {
        // Resolution, not a count. Until milestone 6 this reported how many packs were declared and
        // said so — "a declaration only" — because there was no format to validate one against and
        // nowhere to resolve a name. Both now exist. What is still NOT demonstrated here is resolution
        // from a FEED: the roots below are the tree this workspace already declares, and an adopter
        // installing a pack from a private marketplace resolves inside the installed plugin instead.
        // The resolver takes its roots as an argument for exactly that reason — the second case is the
        // same code path, not a parallel one — but this repository has not yet run it.
        // Through the SHARED precedence rule rather than a third spelling of it — see `rootPlan`.
        // `options.packRoots` keeps the meaning `compile`'s `packContributions` gives it — the FINAL
        // root set, replacing the derived one, so an explicitly empty array means search nowhere. The
        // three tools disagreed about this once and `../cli/compile.mjs`'s `namedRootsOption` records
        // what that cost; aligned here before a caller finds it the same way.
        // Built through `rootPlan` on EVERY path, including the named one. It used to short-circuit
        // here with a plan literal, which is how `options.packRoots` came to silently ignore
        // `discoverPacks`: a caller asking for both got one of them and no word about the other.
        // `namedGiven` is what lets the shared rule keep this option's meaning — the FINAL root set,
        // so an explicitly empty array still means search nowhere.
        const plan = rootPlan(dir, workspace, {
            named: options.packRoots ?? [],
            namedGiven: options.packRoots !== undefined && options.packRoots !== null,
            // `options` carries the injected env — the same one the pointer resolver above is given.
            // Without it this reader consulted the MACHINE the suite runs on, so the end-to-end pack
            // cases could not build a host and the file header's "every environment input injectable"
            // was true of one of its two readers.
            discovery: () => discoverPackRoots(options),
            forced: options.discoverPacks === true,
        });
        if (plan.refusal) throw new DoctorError(plan.refusal);
        // Asked-for discovery that could not look is could-not-run, never a green over an unread host.
        if (plan.couldNotRun) throw new DoctorError(plan.couldNotRun);
        const roots = plan.roots;
        resolvedPackRoots = roots;
        // Which root answered, for each root that could answer. A union's whole contract is that a
        // tree-derived resolution is visible rather than silent, and a lookup is how a per-pack line
        // says so without re-deriving the first-match rule.
        const originOf = new Map((plan.origins ?? []).map((o) => [o.root, o.origin]));
        // **A MISS is a failure only where somebody CLAIMED a root**, and since 2026-08-13 that is a
        // question about origin rather than about count. A named root is the caller's claim; a root
        // derived from `tree` is the workspace's own claim; a **discovered** root is neither — it is a
        // fact about the machine, and this tool must not turn a fact about the machine into a verdict
        // about the repository. Keyed on `roots.length` alone, it did exactly that: measured
        // 2026-08-13, `doctor examples` exited **0** and `doctor --pack-root auto examples` exited
        // **1**, because `examples` derives no root and `tools/github` is not in this host's cache. The
        // count key let host state flip a workspace's verdict, and making discovery the unasked default
        // would have moved that flip onto the bare invocation — red on a laptop, green in CI.
        //
        // So: **discovery may flip a note to resolved, and may never turn a MISS into a FAIL.** A hit is
        // a different matter and is graded whatever its origin — a resolved-but-invalid copy fails with
        // its origin named, below, because that is a claim the pack's own files make about themselves.
        const claimed = roots.filter((root) => originOf.get(root) !== "discovered");
        report("packs", `resolution root ${plan.source} — ${plan.why}`);
        for (const name of workspace.packs) {
            const found = resolvePack(name, roots);
            if (!found.dir) {
                // A workspace with no `tree` has no root of its own to search, so its declared packs are
                // *unverifiable* rather than *wrong* — the same answer `tree`'s absence already gives
                // every other claim needing a tree. Where a claimed root exists, resolution was claimed
                // and a miss is a failure.
                if (claimed.length === 0) {
                    // Counted, never skipped: the pack was not graded, and `stats.unverifiable`'s
                    // contract at the head of this file is that a check class which disappears without
                    // saying so is the defect. A discovered-only miss is exactly that class.
                    stats.unverifiable += 1;
                    // Two causes, two sentences. The claimed set is empty either because there was no
                    // root at all — no `tree`, or discovery finding nothing — or because every root
                    // there IS was discovered, which is a real search that nobody asked for and whose
                    // failure is therefore nobody's claim. Saying "there is no packs root to search"
                    // about the second is false: there was one, and it was looked in.
                    const why = roots.length
                        ? `\`${name}\` was looked for under ${roots.length} discovered root(s) and is not there — reported rather than failed, because a root discovered on this host is not a claim this workspace made: ${plan.why}`
                        : `\`${name}\` cannot be resolved — there is no packs root to search: ${plan.why}`;
                    report("packs", why);
                } else {
                    fail("packs", `\`${name}\` does not resolve — ${found.why}`);
                }
                // Counted, not inspected: an unresolved pack's manifest is unreadable, so this tool
                // cannot know whether it would have contributed gates. The enforcement section says
                // only that — never that gates were missed, which would claim knowledge of a file it
                // could not open.
                packsUnresolved += 1;
                continue;
            }
            let manifest;
            try {
                manifest = JSON.parse(fs.readFileSync(found.manifest, "utf8"));
            } catch (cause) {
                fail("packs", `\`${name}\` resolves to ${path.relative(dir, found.manifest)} but its manifest is unreadable — ${cause.message}`);
                continue;
            }
            // Refuse before grading, exactly as the workspace train does: a manifest written against a
            // contract this validator does not implement produces confident nonsense — a key added in a
            // later MINOR comes back as an unexpected property and the report blames the author for
            // using the spec correctly. This sentence is normative in spec/pack.schema.json, and for one
            // pre-commit checkpoint it was normative there and implemented nowhere, while `doctor`
            // printed "validates against Pack Definition 99.0" — a conformance claim about a contract it
            // had never seen.
            const declaredPack = /^([0-9]+)\.([0-9]+)$/.exec(manifest?.portulan?.pack ?? "");
            if (declaredPack) {
                const [major, minor] = [Number(declaredPack[1]), Number(declaredPack[2])];
                const here = packSchemaVersion(packSchema);
                if (major !== here.major || minor > here.minor) {
                    fail(
                        "packs",
                        `\`${name}\` declares Pack Definition ${major}.${minor}; this \`doctor\` implements ` +
                            `${here.major}.${here.minor}. Refusing to grade it rather than reporting against a ` +
                            `contract it was not written for.`,
                    );
                    continue;
                }
            }

            const errors = validate(packSchema, manifest);
            if (errors.length) {
                for (const e of errors) {
                    fail("packs", `\`${name}\` manifest${e.pointer ? ` at \`${e.pointer}\`` : ""}: ${e.message}`);
                }
                continue;
            }
            stats.packs += 1;
            const c = manifest.contributes ?? {};

            // Milestone 7, the maintainer's ruling of 2026-08-03 on #150: the artifacts a pack ships are
            // OPENED and validated, not counted. Until this landed, `doctor` counted these paths into the
            // line below and read none of them — which is why spec/pack.schema.json could say an escaping
            // `contributes.skills` value was "still inert". It is not inert once something opens it, so
            // the containment check arrives in the same change as the opening.
            const opened = validateContributions(found.dir, c, { fail, report, pack: name });
            for (const one of opened.bindable) composedPersonas.push({ pack: name, ...one });

            const parts = [
                c.skills?.length
                    ? `${opened.skills} skill(s) in ${c.skills.length} root(s)` +
                      (opened.unreadableRoots ? `, ${opened.unreadableRoots} root(s) UNREAD — that count is over what was opened, not over what was declared` : "")
                    : null,
                c.personas?.length ? `${opened.personas} of ${c.personas.length} persona(s) opened` : null,
                // Merged as of milestone 7's composition amendment. This said "declared and not
                // merged" while that was true, and became false the hour `cli/recipe-set.mjs` landed
                // — a code carrier of the same fact the schema note carries, which is why both moved
                // in one change. The ids are printed rather than counted: the namespace is what makes
                // a collision impossible, so a reader should be able to see it.
                c.verify?.length
                    ? `${c.verify.length} recipe(s) composed as ${c.verify.map((r) => `\`${composedId(name, r.id)}\``).join(", ")}`
                    : null,
                c.gates?.length ? `${c.gates.length} gate fragment(s)` : null,
            ].filter(Boolean);
            // Stated only where the set is a union, because that is the only arrangement in which a
            // reader cannot tell the origin from the invocation they typed. Adding it everywhere would
            // put a sentence on every line that says nothing the command did not already say.
            const origin = plan.source === "union" ? originOf.get(found.root) ?? null : null;
            const from =
                origin === "discovered"
                    ? " from the discovered root"
                    : origin === "derived"
                      ? " from the tree-derived root"
                      : "";
            report(
                "packs",
                `\`${name}\` resolves${from} to ${path.relative(dir, found.dir)} and validates against Pack Definition ${manifest.portulan.pack} — contributes ${parts.length ? parts.join(", ") : "nothing"}`,
            );

            // **A SHADOWED pack is reported, and the report says WHAT DIFFERS** (#264). Resolution is
            // first-match-wins and discovered roots come first, so where the host carries a copy of a
            // pack the tree also carries, the installed one answers and nothing said so. Silence about
            // the shadowed copy is the part that makes the failure unreproducible: the compiled artifact
            // moves, the rail reds, and the deciding input is a directory outside the repository.
            //
            // A REPORT, never a verdict — an installed pack shadowing a tree copy is a fact about the
            // machine, and this tool must not turn a fact about the machine into a verdict about the
            // repository (the boundary this file already states for discovered roots).
            if (origin === "discovered") {
                const shadowed = resolvePack(name, roots.filter((r) => originOf.get(r) !== "discovered"));
                if (shadowed.dir) {
                    let other = null;
                    try {
                        other = JSON.parse(fs.readFileSync(shadowed.manifest, "utf8"));
                    } catch (cause) {
                        // Could-not-compare, in so many words. A shadow we cannot read is not a shadow
                        // we can call harmless, and saying nothing here would be the silence this whole
                        // report exists to end.
                        report(
                            "packs",
                            `\`${name}\` is SHADOWED — the tree-derived root also carries it at ${path.relative(dir, shadowed.dir)}, and that copy could not be read (${cause.message}), so what differs could not be compared`,
                        );
                    }
                    if (other) {
                        const mineV = manifest?.portulan?.version ?? "no version";
                        const treeV = other?.portulan?.version ?? "no version";
                        // **The WHOLE fragment, not a projection of it** — the message says the
                        // fragments are not byte-identical, so that is what must be compared. The first
                        // draft compared `[id, tier, action]` and claimed byte-identity, which would
                        // read "the two agree today" over a copy differing in `reason` or any field a
                        // later Pack Definition adds. `composeFragments` pushes the whole fragment, so
                        // any difference is one the compiled policy can carry. Copilot.
                        const frag = (m) => JSON.stringify(m?.contributes?.gates ?? []);
                        const differs = [];
                        if (mineV !== treeV) differs.push(`version ${mineV} against the tree's ${treeV}`);
                        if (frag(manifest) !== frag(other)) differs.push("gate fragments that are not byte-identical");
                        report(
                            "packs",
                            `\`${name}\` is SHADOWED — the installed copy answered and the tree-derived root also carries it at ` +
                                `${path.relative(dir, shadowed.dir)}; ${differs.length ? `they differ by ${differs.join(" and ")}` : "the two agree today"}. ` +
                                "An unpinned `compile` reads the installed one while `verify/compile.sh` reads the tree — pin with `--pack-root packs` to emit what the rail checks",
                        );
                    }
                }
            }
        }
    }

    // Workspace Definition 2.3's and 2.4's conditional constraints, here for the same reason the
    // `repository`/`tree` pair above is: `dependentRequired` is not in the subset spec/README.md
    // declares, so the schema cannot carry any of them and ../spec/slots.md says so.
    //
    // The count went one → three in a single MINOR at 2.3 and three → five at 2.4. That is the
    // thing to watch rather than absorb quietly: every one of them is a rule the schema states
    // nowhere, so a workspace validated by some other tool against the published schema alone would
    // pass shapes this validator refuses. `../spec/README.md` carries the running count for exactly
    // that reason.
    if (workspace.librarian && !workspace.slots?.memory) {
        fail(
            "cross",
            "`librarian` declares a scheduled pass with no `slots.memory` store to age — the object " +
                "configures a store rather than replacing one, and a pass over nothing reports that " +
                "nothing is stale, which is indistinguishable from a healthy store",
        );
    }

    // Every number the schema can only type as `number`, checked here for the constraint the declared
    // subset cannot express. Without this, `record_days: 0` — or `-1`, or `"90"` — passes CI green and
    // fails at 06:00 on a Monday, when `cli/librarian.mjs` refuses it with exit 2 and nobody is
    // watching. A policy defect that only surfaces in an unattended run is the worst place for one, and
    // this is a `doctor` failure rather than a `librarian` one because it is a fact about the manifest.
    // Raised by Copilot on #81, suppressed half. The memory budgets are checked the same way, and were
    // missing it too — a sibling of the same class, fixed in the same stroke rather than left for the
    // next round to find.
    //
    // **The message stated a downstream behaviour this tree does not have**, and that is issue #84,
    // fixed here. It said a zero or negative value *reads as undeclared to the tool that consumes it* —
    // which was true of nothing: both consumers, `cli/index.mjs`'s `budgetNumber` and
    // `cli/librarian.mjs`'s `threshold`, refuse such a value outright with exit 2. What the sentence
    // described was the hazard those refusals exist to prevent, written in the present tense as though
    // it survived them. ../.portulan/dod.md condition 4 refuses a claim of a capability that does not
    // exist; this was the same error pointed the other way, a claim of a *defect* that does not exist,
    // inside a failure message — where a reader has the least room to check it.
    const positive = (v) => typeof v === "number" && Number.isInteger(v) && v > 0;
    for (const [where, value] of [
        ["memory.index.budget.lines", workspace.memory?.index?.budget?.lines],
        ["memory.index.budget.columns", workspace.memory?.index?.budget?.columns],
        ["memory.store.budget.kilobytes", workspace.memory?.store?.budget?.kilobytes],
        ["memory.store.budget.record_kilobytes", workspace.memory?.store?.budget?.record_kilobytes],
        ["librarian.staleness.record_days", workspace.librarian?.staleness?.record_days],
        ["librarian.staleness.sealed_days", workspace.librarian?.staleness?.sealed_days],
        ["librarian.staleness.proposal_days", workspace.librarian?.staleness?.proposal_days],
    ]) {
        if (value !== undefined && !positive(value)) {
            fail(
                "schema",
                `${where} is ${JSON.stringify(value)}, which is not a positive integer. The declared keyword ` +
                    "subset has no `minimum` and cannot say `integer`, so this is checked here — and it is " +
                    "checked at pull-request time so a policy defect does not first surface in an unattended " +
                    "run, where the consuming tool refuses it with exit 2 and nobody is watching",
            );
        }
    }

    if (workspace.librarian?.staleness?.proposal_days !== undefined && !workspace.slots?.proposals) {
        fail(
            "cross",
            "`librarian.staleness.proposal_days` nags about proposals in a workspace that declares no " +
                "`slots.proposals` — a threshold nothing can ever cross. The pass reports *not asked* " +
                "here, which is not the same answer as *none pending*, and a policy that can never fire " +
                "reads as configured to anyone who greps for it",
        );
    }

    if (workspace.memory && !workspace.slots?.memory) {
        fail(
            "cross",
            "`memory` declares an index and budgets with no `slots.memory` store to index — the object " +
                "configures a store rather than replacing one, and an index of nothing renders empty, " +
                "compares equal to an empty committed file, and passes",
        );
    }

    // An index inside the store it indexes is counted as a record by the retirement and provenance
    // walks below — sized into the KB figure and reported for stating no retirement condition. The
    // repair is a siting rule rather than an exemption by filename: teaching one name to hide from a
    // walk is a door any record could use, which is the fail-open class this repository has now found
    // eight of in its own scaffolding — and then this check turned out to be the ninth, in the very
    // containment test that was supposed to be the door-less alternative. See `isInside`.
    if (workspace.memory?.index?.path && workspace.slots?.memory) {
        const storeDir = path.resolve(dir, workspace.slots.memory);
        const indexPath = path.resolve(dir, workspace.memory.index.path);
        // Imported rather than restated. This check and `index`'s had two copies of one containment
        // rule and both carried the same fail-open: `!path.relative(…).startsWith("..")` calls a file
        // named `..index.md` *outside* the directory it sits in, because a leading `..` in a filename
        // is not a traversal. Measured — such an index was written into the store, and this walk then
        // counted it as a record. Same reasoning as `parse`/`backends` from ./compile.mjs above: a
        // rule with two copies drifts, and these two drifted identically before either shipped.
        if (isInside(storeDir, indexPath)) {
            fail(
                "cross",
                `memory.index.path (\`${workspace.memory.index.path}\`) sits inside slots.memory ` +
                    `(\`${workspace.slots.memory}\`), where this validator counts it as a record. ` +
                    "Site the generated index beside the store, not in it",
            );
        }
    }

    // The handoff series gets both of the memory index's conditional requirements, added at 2.5, and
    // gets them here rather than in a second copy of the reasoning: they are the same two rules about
    // the same kind of object. What differs is only which walk would swallow a badly-sited index —
    // `doctor`'s store report there, `docs.sh`'s date correspondence here.
    if (workspace.handoffs && !workspace.slots?.handoffs) {
        fail(
            "cross",
            "`handoffs` declares an index with no `slots.handoffs` series to index — the object " +
                "configures a series rather than replacing one, and an index of nothing renders empty, " +
                "compares equal to an empty committed file, and passes",
        );
    }

    if (workspace.handoffs?.index?.path && workspace.slots?.handoffs) {
        const seriesDir = path.resolve(dir, workspace.slots.handoffs);
        const indexPath = path.resolve(dir, workspace.handoffs.index.path);
        if (isInside(seriesDir, indexPath)) {
            fail(
                "cross",
                `handoffs.index.path (\`${workspace.handoffs.index.path}\`) sits inside slots.handoffs ` +
                    `(\`${workspace.slots.handoffs}\`). A Markdown file there is either counted as a handoff by ` +
                    "the `record` check's date correspondence, or failed by it for carrying no date. " +
                    "Site the generated index beside the series, not in it",
            );
        }
    }

    // The scopes layer, at 2.6, gets the same pair for the third time. What differs is only which walk
    // would swallow a badly-sited index: the store report there, `docs.sh`'s date correspondence for the
    // handoffs, and here `index`'s orphan sweep — a generated file inside the layer would be read by the
    // one check whose whole job is telling an arrived location from a directory somebody made.
    if (workspace.personas && !workspace.slots?.personas) {
        fail(
            "cross",
            "`personas` declares an index with no `slots.personas` layer to index — the object " +
                "configures a layer rather than replacing one, and a scope with nowhere to land is a " +
                "declaration nothing can honour",
        );
    }

    if (workspace.personas?.index?.path && workspace.slots?.personas) {
        const layerDir = path.resolve(dir, workspace.slots.personas);
        const indexPath = path.resolve(dir, workspace.personas.index.path);
        if (isInside(layerDir, indexPath)) {
            fail(
                "cross",
                `personas.index.path (\`${workspace.personas.index.path}\`) sits inside slots.personas ` +
                    `(\`${workspace.slots.personas}\`), where \`index\`'s orphan sweep would examine it as an ` +
                    "undeclared persona location. Site the generated index beside the layer, not in it",
            );
        }
    }

    // ---- claims against the tree
    const treeRoot = workspace.tree ? path.resolve(dir, workspace.tree) : null;
    const claimTargets = [];

    // ---- persona ↔ agent bindings
    //
    // Row 7's fourth validation, and the one that was still owed after milestone 7 session 2 built the
    // other three. A persona is host-agnostic — its `tools:` are capability classes — and a **binding**
    // is the file that translates one into a host's own vocabulary. `core/personas/README.md` records
    // that the translation is **lossy**: of three charters exactly one survives it. So this check grades
    // agreement and never equivalence, and there are exactly two things it can honestly hold.
    //
    // **Absence is reported, never failed**, for the same reason a pointer's `governed_by` is reported
    // and never graded: whether a binding file exists is deployment state, and a persona with no binding
    // is a legitimate choice — an adopter may be on a host with no agent layer at all. This repository is
    // the exhibit rather than the embarrassment: the `checkpoints` supervisor is deliberately unbound,
    // because that pack's own `self-certify-a-checkpoint` gate makes a **fresh context** the mechanism,
    // and a subagent binding inside the implementer's session is precisely what it refuses.
    //
    // **A binding that contradicts its persona is failed**, because that one is wrong on every host: the
    // loader keys on frontmatter `name`, so a mismatch binds a persona nobody named, and a binding with
    // no `tools:` hands the role the host's whole toolbox — the context firewall's first part, gone.
    if (composedPersonas.length) {
        if (!treeRoot) {
            // The same answer every other claim gets without a tree, and it is counted with them: a
            // workspace that declares no repository has nowhere for `agents/` to be, which is not the
            // same as having looked and found nothing.
            stats.unverifiable += composedPersonas.length;
            report(
                "bindings",
                `${composedPersonas.length} composed persona(s) could not be matched to a host binding — this workspace declares no \`tree\`, ` +
                    `so there is no repository to look in. Unverifiable, not unbound`,
            );
        }
        // BOTH sides are resolved before they are compared, which is the half a first cut got wrong.
        // Comparing a realpathed file against an unresolved root fails wherever the root itself sits
        // under a link — every macOS temporary directory does, `/var` being a link to `/private/var` —
        // so the guard below refused perfectly ordinary bindings until this line existed. That is the
        // rule `validateContributions` already applies to a pack directory, applied to a tree.
        let realTree = treeRoot;
        try {
            if (treeRoot) realTree = fs.realpathSync(treeRoot);
        } catch {
            // An unresolvable tree is already reported by the claims checks; keeping the declared path
            // here means the containment test still runs, on the stricter of the two spellings.
        }
        for (const persona of treeRoot ? composedPersonas : []) {
            const rel = path.join(AGENT_DIR, `${persona.key}.md`);
            const where = `\`${persona.pack}\`'s \`${persona.rel}\``;
            const keyed = persona.keyedBy === "declaration" ? "" : " (keyed by filename — the persona declares no `name`)";
            const file = path.join(treeRoot, rel);

            // **The key is a pack's free text, so it is contained before it is opened.** A persona's
            // `name` is unconstrained — the five-part contract does not include it and the Pack
            // Definition does not reach persona markdown — so a pack declaring `name: ../../poison`
            // aims this read anywhere on the machine. Before this guard it read the file, validated
            // it, and printed *names and tool grant agree*: a green over something no host would ever
            // load as an agent, with the outside file's own `name:` echoed into the report.
            //
            // Resolved and then compared, never matched as a pattern — the rule `validateContributions`
            // already applies to a pack's own paths, and the same one `plugin-lint` applies to a
            // symlinked `agents/` entry. A symlink is why the test is on the REAL path: a link inside
            // the tree pointing out of it passes any check on the spelling.
            // The LEXICAL test comes first, and it is not redundant with the resolved one below.
            // `path.join("agents", "../../poison.md")` is `../poison.md`, so a traversing name aims
            // outside the tree whether or not anything is there — and where nothing is, the resolved
            // test never runs and this check fell through to its *unbound* sentence, which named the
            // escaping path as "the one location a host loads agents from". A refusal that depends on
            // whether the attacker's file happens to exist is not a refusal.
            if (!isInside(treeRoot, path.resolve(treeRoot, rel))) {
                fail(
                    "bindings",
                    `${where} keys its host binding to \`${persona.key}\`, which leaves this workspace's tree — \`${rel}\`. A persona's name is the ` +
                        "pack's own free text and this path is built from it, so a name that traverses is a pack choosing which file this validator opens",
                );
                continue;
            }

            let real = null;
            try {
                real = fs.realpathSync(file);
            } catch (cause) {
                if (cause.code !== "ENOENT") {
                    report("bindings", `${where}'s binding at \`${rel}\` could not be resolved — ${cause.code ?? cause.message}. Unread, not absent`);
                    continue;
                }
                // ENOENT is the ordinary unbound case and falls through to the read below, which
                // renders the one sentence this check has for it.
            }
            if (real !== null && !isInside(realTree, real)) {
                fail(
                    "bindings",
                    `${where} resolves to a host binding OUTSIDE this workspace's tree — \`${rel}\` reaches \`${real}\`. A persona's name is the pack's ` +
                        "own text and this key is built from it, so a name that traverses upward would have this validator open and grade a file the " +
                        "host could never load",
                );
                continue;
            }
            let text;
            try {
                text = fs.readFileSync(file, "utf8");
            } catch (cause) {
                if (cause.code === "ENOENT") {
                    report(
                        "bindings",
                        `${where} has no host binding at \`${rel}\`${keyed} — reported, not failed: a persona without one is unbound rather than wrong, ` +
                            "and this is the one location a Claude Code host loads agents from",
                    );
                } else {
                    // `existsSync` would answer *false* here and this would print as an absence. The
                    // distinction is the same one `validateContributions` carries: only a missing file
                    // means absent, and a question that could not be answered is not an answer.
                    report("bindings", `${where}'s binding at \`${rel}\` could not be read — ${cause.code ?? cause.message}. Unread, not absent`);
                }
                continue;
            }
            const { fields, error } = parseFrontmatter(text);
            if (!fields) {
                fail(
                    "bindings",
                    `${where} is bound by \`${rel}\`, which has no usable frontmatter${error ? ` — ${error}` : ""}. A host reads the binding's ` +
                        "`name`, `description` and `tools` from that block; without it the file registers as nothing",
                );
                continue;
            }
            const bound = typeof fields.name === "string" ? fields.name.trim() : "";
            if (bound !== persona.key) {
                fail(
                    "bindings",
                    `${where} is bound by \`${rel}\`, whose frontmatter declares \`name: ${bound || "(none)"}\` — the host keys on that field and not on ` +
                        `the filename, so this file binds a persona nobody named. Expected \`${persona.key}\``,
                );
                continue;
            }
            if (!(typeof fields.tools === "string" && fields.tools.trim())) {
                fail(
                    "bindings",
                    `${where} is bound by \`${rel}\`, which declares no \`tools:\` allow-list. The first of the five parts is a default-deny surface, ` +
                        "and a binding that omits it grants the role every tool the host has",
                );
                continue;
            }
            // *Declared*, not *agrees*: the check above establishes only that `tools:` is a non-empty
            // string. Nothing here compares it against the persona's own contract — the persona's
            // `tools:` never reaches `bindable` — and by design, since `../docs/milestones/m07.md`
            // holds that a binding may licitly grant less, or other, than the persona describes. The
            // previous wording said the two *agree*, which reported a grant of `Read, Write, Bash` to a
            // persona whose contract is *does not write* as though it had been checked. Found by
            // milestone 7's close pass, forcing exactly that case green.
            report("bindings", `${where} is bound by \`${rel}\`${keyed} — ${BINDING_OK}`);
        }
    }

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
    // The same list, captured before anything mutates it. `claimedChecks` is emptied further down
    // when there are no workflows to compare against, and the floor cross-check read it afterwards —
    // reporting that the gate map named nothing, about a gate map that named it plainly. That is the
    // SECOND consumer caught reading this array after the mutation; the first fix added a separate
    // flag for one consumer instead of making the array safe to read, so the next consumer inherited
    // the trap. Found by review on the pull request. Snapshot rather than flag this time, so a third
    // consumer inherits something true instead of something to remember.
    let declaredChecksInProse = [];
    let gatesRead = false;
    // What the tree's workflows actually report, filled in once a tree is available. `null` means
    // no tree was declared, which is a different thing from a tree with no workflows in it.
    let workflowContexts = null;
    // Captured immediately after parsing and never reassigned. `claimedChecks` is emptied later when
    // there are no workflows to compare against, and keying the "names no check" report off the
    // mutated array made it fire for a gate map that had named one — two contradictory findings from
    // the same run.
    let namedAnyCheck = false;
    if (workspace.slots?.gates) {
        try {
            claimedChecks = requiredCheckClaims(fs.readFileSync(path.resolve(dir, workspace.slots.gates), "utf8"));
            declaredChecksInProse = [...claimedChecks];
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

        // Read once and shared by two consumers: the gate map's prose claim about required checks,
        // and — since the floor backend arrived — the gate policy's `floor.checks`. It was nested
        // inside the first consumer's `if`, which would have left the second silently unable to
        // check anything whenever the prose named nothing.
        const workflows = path.join(treeRoot, ".github", "workflows");
        let jobs = [];
        let found = false;
        try {
            for (const entry of fs.readdirSync(workflows)) {
                if (!/\.ya?ml$/.test(entry)) continue;
                found = true;
                jobs.push(...workflowJobs(fs.readFileSync(path.join(workflows, entry), "utf8")));
            }
        } catch { /* handled by each consumer */ }
        const contexts = jobs.map((j) => j.context);
        workflowContexts = { contexts, found };

        if (claimedChecks.length) {
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

    // ---- the per-host degradation report
    //
    // `../docs/vision.md`: "the enforcement backends are per-host with an honest degradation
    // report." The compiler's accounting IS that report's data — every rule ends as compiled or
    // refused-with-a-reason, per backend — so this reads the backends rather than re-deriving what
    // they cover. Two implementations of one accounting is the drift this repository keeps finding,
    // and it is the reason `./gate.mjs` imports the matcher instead of copying it.
    //
    // Reported, never failed, with one exception below: nothing legislates a coverage floor, and
    // `doctor` does not enforce what nobody legislated — the same reasoning that made `retirement`
    // report-only. What it must not do is print a green that reads as "everything is enforced".
    if (workspace.gates) {
        const policyFile = path.resolve(dir, workspace.gates);
        let parsed = null;
        let columns = null;
        let composed = null;
        try {
            // **Composed before the policy is parsed**, which is the order `compile` uses and for its
            // reason: a pack's fragment is then validated by exactly the code that validates a
            // hand-written rule, rather than by a second, laxer path. Through `compile.mjs`'s own
            // `packContributions` + `composeFragments` — this file already imports four functions from
            // there and mints none of them, because the last thing a policy needs is a second opinion
            // about what it contains.
            //
            // Why this reads the composed set at all: until 2026-08-13 it read `gates.json` alone, so
            // its report described a policy the workspace does not have. Measured on `d5a5eb7`, this
            // section printed `Claude Code: 10 of 23 rule(s) compiled → .claude/settings.json` while
            // that file carried **eleven** rules' compilation, the eleventh being a composed one — an
            // arrow naming an artifact beside a number that is not that artifact's. `../.portulan/dod.md`
            // condition 1 had already been rewritten from *declares* to **yields** for the recipe set,
            // for the identical reason; this is that word applied to the gate policy.
            const composition = packContributions(dir, ".", { packRoots: resolvedPackRoots ?? [] });
            composed = composeFragments(JSON.parse(fs.readFileSync(policyFile, "utf8")), composition.contributions);
            parsed = parse(composed.policy);
            // Inside the SAME guard as the parse, which it was not for one checkpoint. A policy can
            // parse cleanly and still be refused by a backend — a declared floor no rule reaches, or
            // gate rules that all compile to nothing — and with `backends()` outside the try, that
            // threw out of `inspect`, exited 2, and discarded every verdict this run had already
            // reached. Trading a verdict for "could not run" is the milestone-2 gates-file defect,
            // and it was sitting three lines under a comment naming it. Found at the pre-commit
            // checkpoint.
            columns = backends(parsed, { source: workspace.gates });
        } catch (cause) {
            // A defect in the WORKSPACE's own policy, reported where every other finding is.
            fail("enforcement", `${workspace.gates} — ${cause.message}`);
            parsed = null;
        }

        if (parsed) {
            for (const column of columns) {
                report(
                    "enforcement",
                    `${column.label}: ${column.compiled.length} of ${parsed.rules.length} rule(s) compiled, ${column.refused.length} refused` +
                        (column.artifact ? ` → ${column.artifact.path}` : " → no artifact (this backend compiled nothing here)"),
                );
            }

            // The honest signal, split by tier because the halves mean opposite things. An `auto`
            // rule compiled by nothing is the system working; a `gated` or `prohibited` one is a
            // gate that exists only as a sentence, which is what this product is against.
            const uncovered = parsed.rules.filter(
                (rule) =>
                    (rule.tier === "gated" || rule.tier === "prohibited") &&
                    columns.every((c) => !c.compiled.some((x) => x.id === rule.id)),
            );
            // "policy this workspace yields" rather than "declared policy": the count now includes
            // composed rows, so *declared* would be the word that made this sentence wrong.
            report(
                "enforcement",
                uncovered.length
                    ? `${uncovered.length} gate(s) no backend compiles — policy this workspace yields that nothing enforces: ${uncovered.map((r) => `\`${r.id}\``).join(", ")}. Each is a prompt-level habit until a backend reaches it`
                    : "every gate this workspace yields is compiled by at least one backend — which says the policy is reachable, never that a host honours what was emitted",
            );

            // Declared from composed, kept legible. A reader who cannot tell which rows came from a
            // pack cannot tell which half to go and change, and the composed half lives in a file this
            // workspace does not own.
            if (composed.added?.length) {
                // Its own subject and its own members. "N of those" read as the uncovered gates named on
                // the line above — of which only one is composed — while the real antecedent was the
                // whole yield two lines up. And a count alone does not tell a reader which file to
                // change: with two gate-contributing packs, "composed from this workspace's packs" names
                // neither. `composed.added` already carries `{ pack, id }`, so the members are printed.
                const members = composed.added.map((a) => `\`${a.id}\` (${a.pack})`).join(", ");
                report(
                    "enforcement",
                    `${composed.added.length} of the ${parsed.rules.length} rule(s) this workspace yields are composed from its packs rather than declared in \`${workspace.gates}\` — ${members}; change them in the pack that contributes them`,
                );
            }

            // What this tool can KNOW, and no more. An unresolved pack's manifest is unreadable, so
            // whether it would have contributed gates is not a fact in reach — the sentence says the
            // totals may be incomplete, never that gates were missed. Severity is the packs section's
            // to set and it has already set it above, origin-keyed; this line does not re-litigate it.
            if (packsUnresolved) {
                report(
                    "enforcement",
                    `${packsUnresolved} declared pack(s) did not resolve, so whether they contribute gates could not be seen — the totals above may be incomplete`,
                );
            }

            // ---- the floor's declared contexts, against the tree and against the prose
            for (const check of parsed.floor?.checks ?? []) {
                if (check.integration_id === undefined) {
                    report(
                        "enforcement",
                        `the floor requires the status check \`${check.context}\` with no \`integration_id\` — an unpinned context is satisfiable by any GitHub App reporting that name, which the branch-protection UI does not surface`,
                    );
                }
                if (workflowContexts === null) {
                    stats.unverifiable += 1;
                    report("enforcement", `the floor requires the status check \`${check.context}\` and this workspace declares no tree to check it against — unverifiable`);
                    continue;
                }
                if (!workflowContexts.found) {
                    stats.unverifiable += 1;
                    report("enforcement", `the floor requires the status check \`${check.context}\` and there are no workflows in the tree to report it — unverifiable`);
                    continue;
                }
                stats.claims += 1;
                // The one enforcement FAILURE, and it earns the severity: a required context that
                // never reports blocks every pull request, and `enforce_admins` leaves nobody able
                // to force past it. That is proposal 0004's lesson, which cost a three-step rename
                // to work around after the fact — the highest-priced typo this tree can catch.
                if (!workflowContexts.contexts.includes(check.context)) {
                    fail(
                        "enforcement",
                        `the floor requires the status check \`${check.context}\`, which no workflow job in the tree reports (found: ${workflowContexts.contexts.join(", ") || "none"}). Importing this ruleset would block every pull request on a check that never arrives`,
                    );
                }
            }

            // Two in-tree carriers of one fact: the gate map's platform-floor table and the policy's
            // `floor`. Reported rather than failed — the prose row is a human summary and may
            // legitimately be shaped differently — but never left silent, because two files stating
            // one policy is this repository's signature defect, and the prose half is the half no
            // other check here reads for content.
            // NOT gated on the prose having named a check. It was for one round, which exempted the
            // worst divergence there is: a policy declaring required checks beside a gate-map row that
            // is missing or written in a shape `requiredCheckClaims` does not recognise. The generic
            // "names no required status check" note fires there, but it reports that nothing was
            // compared against the *tree* and says nothing about the policy carrying checks the prose
            // does not. A check that quietly skips its own extreme case is
            // `a-checker-must-refuse-what-it-cannot-check.md` again. Found by review, round 2.
            if (parsed.floor && gatesRead) {
                const declared = parsed.floor.checks.map((c) => c.context);
                const missingFromProse = declared.filter((c) => !declaredChecksInProse.includes(c));
                const missingFromPolicy = declaredChecksInProse.filter((c) => !declared.includes(c));
                if (missingFromProse.length || missingFromPolicy.length) {
                    report(
                        "enforcement",
                        "the gate policy's `floor` and the gate map's required-check row disagree" +
                            (missingFromProse.length ? `; the policy declares ${missingFromProse.map((c) => `\`${c}\``).join(", ")} and the prose does not name it` : "") +
                            (missingFromPolicy.length ? `; the prose names ${missingFromPolicy.map((c) => `\`${c}\``).join(", ")} and the policy does not declare it` : "") +
                            ". Where they disagree the policy wins, because it is the one that compiles",
                    );
                }
            }
        }
    } else if (workspace.packs?.length) {
        // **The edge one door down, named rather than left to be found.** This section is guarded on
        // the workspace declaring a `gates` slot, and composition does not care whether it does: a
        // workspace can compose a pack that contributes gates while declaring no policy of its own,
        // and then the guard above skips — silence, over a policy that has gate rules in it. That is
        // the same shape as the divergence this whole change repairs, displaced by one condition.
        //
        // Measured on `d5a5eb7`: `examples/` is exactly this workspace — it composes
        // `rituals/checkpoints`, which contributes two gate fragments, and declares no `gates` and
        // carries no `gates.json`. `compile --workspace examples --check` exits **2** there
        // (could-not-run: nothing to compose *into*), while `doctor` said nothing at all.
        //
        // **Report, never fail**, and the severity is not a preference: `../.portulan/verify/doctor.sh`
        // grades `examples` on every run as part of a required check, so a failure here would turn the
        // repository's own verify red over a workspace that is behaving as designed. It is also keyed
        // on contributions being non-empty rather than on `packs` being non-empty, so a workspace
        // composing packs that contribute no gates keeps producing zero enforcement findings — which
        // is what `./doctor.test.mjs`'s no-gates case pins.
        try {
            const { contributions } = packContributions(dir, ".", { packRoots: resolvedPackRoots ?? [] });
            const fragments = contributions.reduce((n, c) => n + (c.fragments?.length ?? 0), 0);
            if (fragments) {
                // `fragments` counts RESOLVED packs only — `packContributions` cannot read a manifest it
                // could not find — so where a declared pack did not resolve this number is a floor and
                // not a total. Saying "composes N from its packs" without that caveat implies the count
                // covers every declared pack, which is the same overstatement this whole change repairs
                // one branch up: a number claiming more than it measured. The gates-slot branch already
                // carried the caveat and this one did not. (Copilot, round 1 on #241.)
                const incomplete = packsUnresolved
                    ? `, and ${packsUnresolved} declared pack(s) did not resolve, so this count is a floor rather than a total`
                    : "";
                report(
                    "enforcement",
                    `this workspace composes ${fragments} gate rule(s) from the packs that resolved and declares no \`gates\` policy for them to join, so nothing here compiles them — \`compile\` exits 2 on this shape rather than emitting a partial policy${incomplete}`,
                );
            }
        } catch (cause) {
            // A composition this tool cannot even read is the packs section's finding, not this one's;
            // saying it twice would be one defect wearing two severities.
            report("enforcement", `the composed gate contributions could not be read — ${cause.message}`);
        }
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
    // Staleness is ./librarian.mjs's, the scheduled pass, which may legitimately ask git — and which
    // is not a verify recipe precisely so that asking is safe. Built at milestone 5.
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
              ". Size and count only: ages live in git, which doctor does not read, so staleness belongs to `cli/librarian.mjs` — the scheduled pass, which may ask git and does"
            : "no memory records — nothing measured, nothing awaiting retirement",
    );

    // Always emitted, for the third time on this page and for the same reason: a workspace nobody
    // scored and a workspace that scored well print identically unless one of them says which.
    const score = legibility(workspace, dir);
    const missed = score.dimensions.filter((d) => d.applicable && !d.met);
    const skipped = score.dimensions.filter((d) => !d.applicable);
    report(
        "legibility",
        `agent legibility ${score.met} of ${score.applicable}` +
            (missed.length ? ` — missing: ${missed.map((d) => `${d.title} (${d.why})`).join("; ")}` : " — every dimension met") +
            (skipped.length ? `. Not applicable here: ${skipped.map((d) => d.title).join(", ")}` : "") +
            ". Scored from what the manifest declares and the affordances documents it reaches; it moves no exit code, " +
            "because a score that could fail a workspace would make the verdict a function of how much prose somebody wrote",
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
/**
 * The help screen. An explicit `--help` exits **0** and prints to stdout — `./portulan.mjs` states that
 * contract ("asking for help is a request, and it succeeded") and five sibling tools already keep it;
 * this tool did not, and what a user saw instead was the no-arguments usage line on **stderr** at exit
 * 2, which is the could-not-run fallback rather than an answered question. Added at milestone 7's
 * follow-up, with `compile` and `index`, after the close pass found three nonconformers where its own
 * handoff had said two.
 *
 * `../.portulan/dod.md` condition 4 binds this text: every flag below exists in the parser above it.
 */
function usage() {
    return [
        "portulan doctor — validate a workspace against the Workspace Definition",
        "",
        "  portulan doctor [--pack-root <dir>|auto]... [--repo-root <dir>]... <workspace-dir> [<workspace-dir> ...]",
        "",
        "  --pack-root   where declared packs are resolved from; `auto` discovers the host's plugin cache.",
        "                A named root REPLACES every other source. A directory actually named `auto` is `./auto`",
        "  --repo-root   where the repositories this workspace's cards NAME are checked out, so their",
        "                claims can be checked against a tree rather than taken on trust",
        "",
        "Reports are notes unless something is wrong: a note moves no exit code. Discovery may turn an",
        "unresolved pack into a resolved one and never a miss into a failure, so a verdict about the",
        "repository does not become a function of what this machine happens to have installed.",
        "",
        "Exit codes: 0 succeeded · 1 a red verdict · 2 could not run.",
    ].join("\n");
}

export async function run(argv, options = {}) {
    const say = options.quiet ? () => {} : (line = "") => process.stdout.write(`${line}\n`);
    // **Before every other argument decision**, so asking for help cannot be outranked by a
    // complaint about the rest of the command line. `./portulan.mjs` states the contract: an
    // explicit `--help` exits 0, because asking for help is a request and it succeeded.
    if (argv.includes("--help") || argv.includes("-h")) {
        say(usage());
        return 0;
    }
    try {
        // `--pack-root <dir>`, repeatable: resolution roots that REPLACE the one derived from `tree`
        // rather than being searched ahead of it. `inspect` has read `options.packRoots` since session 0
        // and no caller set it, so the path shaped for an adopter resolving from an installed feed had no
        // way in from a command line. Replacement rather than precedence so that "it resolved from the
        // feed" cannot be satisfied by a copy in the local tree at all — the three tools disagreed about
        // this once, and `../cli/compile.mjs`'s `namedRootsOption` carries what that cost.
        //
        // **A PACK root IS discovered by default as of 2026-08-13, and the boundary moved rather than
        // being dropped.** `./discover.mjs` reads the host's installed-plugin record, and this tool uses
        // it for two things: dereferencing a POINTER's `governed_by`, and resolving pack roots (#123).
        //
        // This passage read *"discovered only when asked … what is deliberately not taken is a DEFAULT"*,
        // and defended it as a boundary. Row 7's clause is that discovery makes `--pack-root` **optional
        // where discovery finds a root**, and it was not: measured on the workspace `init` drafts by
        // default plus one pack of the adopter's own, `doctor` exited **1** with no flag and **0** under
        // `auto`. The maintainer ruled a behaviour change rather than a row amendment; a fresh supervisor
        // graded that sound from `../docs/vision.md`, which defines this tool as a **per-host capability
        // report** — answering about the host is what it is for.
        //
        // **The boundary it replaces, sharpened, is: a verdict about the *repository* must not depend on
        // the machine.** Three things hold it, and none of them is the absence of a default:
        //
        // 1. **The pins.** Six required invocations name their root, a named root REPLACES every other
        //    source, and `./pinned-roots.live.test.mjs` reds if one drops it or a seventh joins unpinned.
        // 2. **The note-vs-fail keying below is on ORIGIN**, so a root nobody claimed can turn an
        //    unresolved pack from a note into a resolution, and never into a failure.
        // 3. **Never silently.** The `resolution root` note names the source, and each pack's line names
        //    which root answered and whether it was discovered or derived.
        //
        // The row's own direction is unchanged and is what the arms above implement: **add a root where
        // none was named; never replace one that was.**
        //
        // `--repo-root <dir>`, repeatable, is its sibling and is deliberately shaped the same way: the
        // directories under which the repositories a workspace's cards NAME are checked out, so the
        // residence ruling's third refusal has somewhere to look. Named rather than discovered for the
        // same reason the pack roots are — a host's plugin cache holds installed plugins, and a
        // developer's checkouts are not in it, so there is nothing there to find. The two lists are
        // separate because they answer different questions and a single `--root` would make a packs
        // root and a checkout root interchangeable, which they are not: one holds `category/name` pack
        // directories, the other holds repositories.
        const namedRoots = [];
        let discoverPacks = false;
        const repoRoots = [];
        const dirs = [];
        // ONE validator for both flags, and it is one because a reviewer caught the comment claiming so
        // while `--pack-root` still carried its own copy (Copilot, round 1 on #135). Two inputs have to
        // fail closed here and each has a real incident behind it: a root that is **not there** is a
        // filesystem fact rather than a pack that failed to resolve, and reporting it as the latter sends
        // a reader to the one file that is not at fault; and existence is not enough, because
        // `existsSync` is true for a FILE, so one was accepted and every later resolution failure was
        // misattributed to the workspace. Three tools take `--pack-root` and only `index` had the
        // directory check — the sibling class the 2026-07-27 ruling names, found by Copilot on #117 round
        // 7, one round after the same defect was fixed in `index` alone. `what` keeps each flag's message
        // specific: sharing the check must not cost the reader the sentence that says what a root is FOR.
        const directoryRoot = (flag, value, what) => {
            if (value === undefined || value.startsWith("-")) throw new DoctorError(`${flag} needs a directory${what.keyword ?? ""}`);
            let stat = null;
            try {
                stat = fs.statSync(value);
            } catch (cause) {
                throw new DoctorError(
                    `${flag} ${value} cannot be read — ${cause.code ?? cause.message}. Refusing to report ${what.unresolvable} against a root nothing looked in`,
                );
            }
            if (!stat.isDirectory()) {
                throw new DoctorError(`${flag} ${value} is not a directory — a resolution root is a directory ${what.holds} are looked up under`);
            }
            return path.resolve(value);
        };
        // `keyword` is PACK_ROOT's alone: `auto` discovers a plugin cache, and there is no such thing
        // for a repository checkout, so offering it on `--repo-root` would advertise a refused value.
        const PACK_ROOT = {
            unresolvable: "a pack unresolvable",
            holds: "packs",
            keyword: ", or `auto` to discover one from the host plugin cache. A directory actually named `auto` is `./auto`",
        };
        const REPO_ROOT = { unresolvable: "a repository ungoverned", holds: "repositories" };
        for (let i = 0; i < argv.length; i += 1) {
            if (argv[i] === "--repo-root") {
                repoRoots.push(directoryRoot("--repo-root", argv[i + 1], REPO_ROOT));
                i += 1;
            } else if (argv[i] === "--pack-root") {
                // The keyword, on the raw argument and before `directoryRoot` resolves anything.
                if (argv[i + 1] === AUTO) discoverPacks = true;
                else namedRoots.push(directoryRoot("--pack-root", argv[i + 1], PACK_ROOT));
                i += 1;
            } else if (!argv[i].startsWith("-")) dirs.push(argv[i]);
            else {
                // **Refused loudly, where it used to be swallowed.** This arm read `else if
                // (!startsWith("-")) dirs.push(...)` with no `else` at all, so any `-`-prefixed
                // argument this parser did not recognise was silently discarded. Measured on
                // `d5a5eb7`: `doctor --repo-rot /nonexistent` dropped the misspelled flag and graded
                // `/nonexistent` **as a workspace**, red for a reason that had nothing to do with what
                // was asked. A typo in a flag is could-not-run, never a verdict — and #155's lesson is
                // that the refusal names both real invocations, because a user who typed one of them
                // cannot act on advice about the other.
                throw new DoctorError(
                    `unknown argument \`${argv[i]}\` — run \`portulan doctor --help\` or \`node cli/doctor.mjs --help\` for the flags this tool takes`,
                );
            }
        }
        // Refused at PARSE time, which is where an exit 2 belongs: before a workspace is read, so the
        // refusal cannot be mistaken for a verdict about one. `resolutionRoots` refuses the same
        // combination for callers that never parsed anything; both ask the same exported predicate.
        const bothAsked = namedWithAuto(namedRoots, discoverPacks);
        if (bothAsked) throw new DoctorError(bothAsked);
        if (dirs.length === 0) {
            if (!options.quiet) {
                process.stderr.write("usage: node cli/doctor.mjs [--pack-root <dir>|auto]... [--repo-root <dir>]... <workspace-dir> [<workspace-dir> ...]\n");
            }
            return 2;
        }

        let failed = 0;
        for (const dir of dirs) {
            const roots = {
                ...(namedRoots.length ? { packRoots: namedRoots } : {}),
                ...(discoverPacks ? { discoverPacks } : {}),
                ...(repoRoots.length ? { repoRoots } : {}),
            };
            const { findings, stats } = await inspect(dir, { ...options, ...roots });
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
