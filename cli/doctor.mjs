#!/usr/bin/env node
// `doctor` — the Workspace Definition validator.
//
//   node cli/doctor.mjs [--pack-root <dir>|auto]... [--repo-root <dir>]... <workspace-dir>...
//
// Exit 0 every workspace validates · 1 at least one does not · 2 could not run.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
    parse,
    backends,
    resolvePack,
    rootPlan,
    packContributions,
    composeFragments,
    packDifferences,
    shadowedCopy,
} from "./compile.mjs";
import { isInside, recordType } from "./index.mjs";
import { parseFrontmatter, AGENT_DIR } from "./plugin-lint.mjs";
import { resolveGovernor, AUTO, discoverPackRoots, namedWithAuto } from "./discover.mjs";
import { composedId } from "./recipe-set.mjs";
import { alwaysLine } from "./context.mjs";
import { formLine } from "./form.mjs";
import { sessionsLine } from "./sessions.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SCHEMA = path.resolve(HERE, "..", "spec", "workspace.schema.json");
const DEFAULT_PACK_SCHEMA = path.resolve(HERE, "..", "spec", "pack.schema.json");

/** The binding-success line's tail, one constant so a test asserting its absence cannot pass on a reword. */
export const BINDING_OK = "names match and a tool grant is declared";

/** Raised when `doctor` cannot run at all. Always exit 2, never 1. */
export class DoctorError extends Error {
    constructor(message) {
        super(message);
        this.name = "DoctorError";
    }
}

// ---------------------------------------------------------------- the schema subset

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
    // No "integer": `check` cannot test it, so it would fail every instance.
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

const REF_SIBLINGS = new Set(["$ref", "title", "description"]);

/** Throws a DoctorError for any keyword or value outside the subset; returns the schema unchanged. */
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

/** The instance's faults as `[{ pointer, message }]`, empty where it conforms. */
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
            return;
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
            // With no `properties` this forbids every key, as JSON Schema 2020-12 does.
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

// ---------------------------------------------------------------- provenance

const PROVENANCE_KEYS = ["form", "href", "owner", "date", "shape"];
const PROVENANCE_TOKEN = new RegExp("`(" + PROVENANCE_KEYS.join("|") + ")=([^`]*)`", "g");

/** A record's provenance stamp as `{ present, fields, raw }`, `fields` null where the provenance is prose. */
export function parseProvenance(source) {
    const lines = source.split("\n");
    const start = lines.findIndex((l) => /^\s*\*\*provenance:\*\*/i.test(l));
    if (start === -1) return { present: false, fields: null, raw: "" };

    let end = start;
    while (end + 1 < lines.length && lines[end + 1].trim() !== "") end += 1;
    const raw = lines.slice(start, end + 1).join(" ");

    // First occurrence wins: prose after the stamp may mention another `key=value`.
    const fields = {};
    for (const [, key, value] of raw.matchAll(PROVENANCE_TOKEN)) {
        if (!(key in fields)) fields[key] = value.trim();
    }
    return { present: true, fields: Object.keys(fields).length ? fields : null, raw };
}

/** A record's `**Retire when:**` line, anchored at a line's start so prose about retiring never matches. */
export const RETIRE_WHEN = /^\s*\*\*retire when:\*\*/im;

// ---------------------------------------------------------------- claims against the tree

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

    // Not absolute: `/usr/bin/env` resolves on the host, not in the tree.
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
            if (/^none\b/i.test(candidate)) continue;

            // A lone path is a claim; a command's tokens may be outputs, flags or globs, so they are only reported.
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
 * Each workflow job as `{ id, context }`, the context being its `name:` where set, as branch protection pins it.
 * A regex, not a YAML parser: flow mappings, quoted or multi-line keys and `name` expressions go unrecognised.
 */
function workflowJobs(source) {
    const lines = source.split("\n");
    const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
    if (start === -1) return [];
    const jobs = [];
    for (const line of lines.slice(start + 1)) {
        if (/^\S/.test(line) && line.trim() !== "") break;
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

// ---------------------------------------------------------------- inspecting one workspace

const PATH_SLOTS = {
    identity: "file", principles: "file", gates: "file", dod: "file",
    constitution: "either",
    memory: "dir", repos: "dir", tasks: "dir", handoffs: "dir", proposals: "dir", context: "dir",
};

const PERSONA_PARTS = [
    { part: "a `tools:` allow-list", find: (fields) => typeof fields?.tools === "string" && fields.tools.trim().length > 0 },
    { part: "a Charter section", find: (_f, body) => /^##\s+Charter\b/im.test(body) },
    { part: "an Autonomy reach section", find: (_f, body) => /^##\s+Autonomy reach\b/im.test(body) },
    { part: "a Memory scope section", find: (_f, body) => /^##\s+Memory scope\b/im.test(body) },
    { part: "a Read / write posture section", find: (_f, body) => /^##\s+Read\s*\/\s*write posture\b/im.test(body) },
];

/** How deep a declared skills root is walked; kept equal to `MAX_DECLARED_SKILL_DEPTH` in ./plugin-lint.mjs. */
const SKILL_DEPTH = 3;

/** Opens and validates a pack's skills and personas, counting what was opened; `bindable` holds each persona's host key. */
export function validateContributions(packDir, contributes, { fail, report, pack }) {
    let realPack;
    try {
        realPack = fs.realpathSync(packDir);
    } catch (cause) {
        fail("packs", `\`${pack}\` resolved to a directory that cannot be realpathed — ${cause.code ?? cause.message}`);
        return { skills: 0, personas: 0, unreadableRoots: 0, bindable: [] };
    }

    // Contained after realpath, never by pattern: `a/../../x` and a symlink both pass one. Only ENOENT is absent.
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
        if (found === null) unreadableRoots += 1;
        else skills += found;
    }

    let personas = 0;
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
 * One persona against the five-part contract, by presence only: an empty section or `tools: []` passes.
 * Returns `{ name }`, `name` null where none is declared, or null where there is no frontmatter.
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

/** Walks a declared skills root to `SKILL_DEPTH`, validating each `SKILL.md`: the count, or null where a directory went unread. */
function walkSkills(root, { fail, report, pack, rel }, depth = 0) {
    let found = 0;
    const own = path.join(root, "SKILL.md");
    // `lstat`, since `existsSync` follows a link and would count a `SKILL.md` linked in from outside the pack.
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
        // A symlinked directory's Dirent is not `isDirectory()`, so the check below would skip it in silence.
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
        // Propagated: `found += null` adds 0, which would count an unread directory as empty.
        if (child === null) return null;
        found += child;
    }
    return found;
}

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
 * Whether a reach section claims Prohibited: a sentence naming it with no negation, so a disclaimer passes.
 * A prose heuristic: a bullet block splits as one sentence, so a negation anywhere in it hides a claim.
 */
function claimsProhibited(reach) {
    for (const sentence of reach.split(/(?<=[.!?])\s+|\n{2,}/)) {
        if (!/\bProhibited\b/.test(sentence)) continue;
        if (/\b(?:not|never|no|nobody|none|cannot|can't|doesn't|does not|isn't|is not)\b/i.test(sentence)) continue;
        return true;
    }
    return false;
}

/** The Pack Definition version in a pack schema's `$id` (`/spec/pack/1.0/`) as `{ major, minor }`; a DoctorError without one. */
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

/** The Workspace Definition version in a schema's `$id` (`/spec/2.5/`) as `{ major, minor }`; a DoctorError without one. */
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

// ---------------------------------------------------------------- agent legibility

/** Headings that mark a limits section: a form check, so an empty section passes. */
const LIMIT_HEADINGS = [
    /^#{2,3}\s+What an agent must not assume\b/im,
    /^#{2,3}\s+.*\bmust not\b/im,
    /^#{2,3}\s+.*\bdo(es)? not\b/im,
    /^#{2,3}\s+(Honest )?[Ll]imits\b/im,
    /^#{2,3}\s+.*\bnot (guaranteed|checked|enforced)\b/im,
];

/**
 * Scores agent legibility as `{ met, applicable, dimensions }`; an inapplicable dimension leaves the denominator.
 * A dimension must be optional in the Workspace Definition and must not restate a check that already fails.
 */
export function legibility(workspace, dir) {
    const dimensions = [];
    const add = (id, title, met, why, applicable = true) => dimensions.push({ id, title, met, applicable, why });

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
 * Inspects one workspace: `{ dir, workspace, findings, stats }`, with `governor` for a pointer. A finding is
 * `{ severity, check, message }`, and only a `fail` is a verdict; a DoctorError means it could not judge.
 */
export async function inspect(workspaceDir, options = {}) {
    const schema = loadSchema(options);
    const packSchema = loadPackSchema(options);
    const dir = path.resolve(workspaceDir);
    const findings = [];
    const stats = { records: 0, rules: 0, sealed: 0, linked: 0, claims: 0, unverifiable: 0, bytes: 0, unretirable: 0, unassessed: 0, packs: 0 };
    const fail = (check, message) => findings.push({ severity: "fail", check, message });
    const report = (check, message) => findings.push({ severity: "report", check, message });

    // ---------------------------------------------------------------- the manifest itself
    const manifestPath = path.join(dir, "workspace.json");
    let workspace;
    try {
        workspace = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (cause) {
        // A verdict about the workspace, not an environment failure: exit 1, not 2.
        fail("schema", `no readable manifest at ${path.relative(process.cwd(), manifestPath)} — ${cause.message}`);
        return { dir, workspace: null, findings, stats };
    }

    // Before conformance: graded against a contract it was not written for, a correct manifest would read as wrong.
    const here = schemaVersion(schema);
    const declared = /^([0-9]+)\.([0-9]+)$/.exec(workspace?.portulan?.spec ?? "");
    if (declared) {
        const [major, minor] = [Number(declared[1]), Number(declared[2])];
        if (major !== here.major) {
            throw new DoctorError(
                `${path.relative(process.cwd(), dir)} declares Workspace Definition ${major}.${minor}; ` +
                    `this schema is ${here.major}.${here.minor}. A MAJOR difference means a migration ` +
                    `exists and this validator is not the one to run — ` +
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
        // A key newer than the declared MINOR is refused only for keys born gated, from 2.9: refusing an older
        // key now would fail a manifest that passes today.
        for (const [key, since, value] of [
            ["context", 9, workspace.context],
            ["slots.context", 10, workspace.slots?.context],
            ["memory.store.budget.cutoff", 11, workspace.memory?.store?.budget?.cutoff],
            ["sessions", 11, workspace.sessions],
            ["spend", 12, workspace.spend],
            ["spend.restart", 13, workspace.spend?.restart],
        ]) {
            if (major === 2 && minor < since && value !== undefined) {
                fail(
                    "schema",
                    `\`${key}\` is Workspace Definition 2.${since}'s, and this manifest declares ${major}.${minor}, ` +
                        `whose validator refuses it as an unknown key. Declare 2.${since}, or remove the key`,
                );
            }
        }
    }

    const errors = validate(schema, workspace);
    for (const e of errors) {
        fail("schema", `${e.pointer || "/"} — ${e.message}`);
    }
    if (errors.length) {
        report("schema", "path, cross-field, claims and provenance checks were skipped: the manifest must conform first");
        return { dir, workspace, findings, stats };
    }

    // ---------------------------------------------------------------- residence
    const GOVERNS =
        "a repository is governed by exactly one workspace — it carries its own full workspace, or a " +
        "pointer to the workspace that names it, never both";
    const POINTER_KEYS = new Set(["portulan", "name", "summary", "kind", "governed_by"]);
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
        // A blank `feed` reads as absent, as `resolveGovernor` reads it.
        const rawFeed = workspace.governed_by?.feed;
        const feed = typeof rawFeed === "string" && rawFeed.trim() !== "" ? rawFeed : undefined;
        report(
            "residence",
            `governed by \`${workspace.governed_by?.workspace}\`` +
                (feed ? `, delivered through \`${feed}\`` : "") +
                " — no workspace resides here, and this manifest says so rather than improvising one",
        );
        // ---------------------------------------------------------------- the pointer's governor
        // Reported, never failed: an uninstalled governor is the ordinary state of a fresh clone and of CI.
        // Awaited although `resolveGovernor` is synchronous, since an injected `discover` may return a promise.
        const resolve = options.discover ?? ((governedBy) => resolveGovernor(governedBy, options));
        const governor = await resolve(workspace.governed_by);
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
                "enforcement, provenance, the store reports, the legibility score and the always tier's " +
                "report all read a policy layer this manifest " +
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

    // ---------------------------------------------------------------- path slots
    // Both sides realpathed, or a workspace reached through a symlink (macOS `/tmp`) would seem to escape itself.
    let realDir = dir;
    try {
        realDir = fs.realpathSync(dir);
    } catch { /* the manifest read above reports a workspace that is not there */ }
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
        let real = target;
        try {
            real = fs.realpathSync(target);
        } catch { /* keep the lexical path; the stat already succeeded, so this is unusual */ }
        if (!inside(real)) {
            // Reported, never failed: a workspace inside a larger repository may share a document outside it.
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
    if (workspace.gates) resolvePath(workspace.gates, "file", "gates");
    if (workspace.memory?.index?.path) resolvePath(workspace.memory.index.path, "file", "memory.index.path");
    (workspace.products ?? []).forEach((product, i) => {
        resolvePath(product.product, "file", `products[${i}].product`);
        if (product.affordances) resolvePath(product.affordances, "file", `products[${i}].affordances`);
    });
    (workspace.verify?.recipes ?? []).forEach((recipe, i) => {
        if (recipe.doc) resolvePath(recipe.doc, "file", `verify.recipes[${i}].doc`);
    });

    // ---------------------------------------------------------------- cross-field
    // Own recipes only: a composed recipe may never be the workspace's `verify.default`.
    const ids = (workspace.verify?.recipes ?? []).map((r) => r.id);
    if (!ids.includes(workspace.verify?.default)) {
        fail("cross", `verify.default names \`${workspace.verify?.default}\`, which is not among the declared recipes (${ids.join(", ") || "none"})`);
    }

    // `uniqueItems` compares whole objects, so two entries sharing only an id pass the schema.
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
            if (!cardNames.has(name)) {
                fail("cross", `products[${i}].repos names \`${name}\`, for which there is no card in the repos slot`);
            }
        }
        if (!product.affordances && !workspace.affordances) {
            report("cross", `products[${i}] (\`${product.id}\`) has neither its own affordances nor an inherited workspace-level default`);
        }
    });

    // Constraints between keys live here: the subset has no `if`/`then` or `dependentRequired`.
    if (workspace.kind === "repository" && !workspace.tree) {
        fail(
            "cross",
            "a `repository` workspace must declare `tree` — it is the policy layer of a repository that " +
                "is present, so it has an answer, and without one every repo-card and gate-map claim " +
                "silently degrades from checked to unverifiable",
        );
    }

    // Checked from the naming side only: a repository carrying a full workspace cannot see a portfolio naming it.
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
                // A workspace naming its own repository finds itself here, compared on real paths: roots are often links.
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
                // Somebody else's manifest, read and never validated: only what it clearly declares is refused.
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
                    // Blank is no name, as in `resolveGovernor`; a non-blank name counts even if illegal, since
                    // judging it would be validating somebody else's manifest.
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

    const composedPersonas = [];

    let resolvedPackRoots = null;
    let packsUnresolved = 0;

    if (workspace.packs?.length) {
        // `packRoots`, when given, is the final root set, as `compile` reads it: an empty array searches nowhere.
        const plan = rootPlan(dir, workspace, {
            named: options.packRoots ?? [],
            namedGiven: options.packRoots !== undefined && options.packRoots !== null,
            discovery: () => discoverPackRoots(options),
            forced: options.discoverPacks === true,
        });
        if (plan.refusal) throw new DoctorError(plan.refusal);
        if (plan.couldNotRun) throw new DoctorError(plan.couldNotRun);
        const roots = plan.roots;
        resolvedPackRoots = roots;
        const originOf = new Map((plan.origins ?? []).map((o) => [o.root, o.origin]));
        // A miss fails only under a root somebody claimed: discovery may resolve a pack, never fail one.
        const claimed = roots.filter((root) => originOf.get(root) !== "discovered");
        report("packs", `resolution root ${plan.source} — ${plan.why}`);
        for (const name of workspace.packs) {
            const found = resolvePack(name, roots);
            if (!found.dir) {
                if (claimed.length === 0) {
                    stats.unverifiable += 1;
                    const why = roots.length
                        ? `\`${name}\` was looked for under ${roots.length} discovered root(s) and is not there — reported rather than failed, because a root discovered on this host is not a claim this workspace made: ${plan.why}`
                        : `\`${name}\` cannot be resolved — there is no packs root to search: ${plan.why}`;
                    report("packs", why);
                } else {
                    fail("packs", `\`${name}\` does not resolve — ${found.why}`);
                }
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

            const opened = validateContributions(found.dir, c, { fail, report, pack: name });
            for (const one of opened.bindable) composedPersonas.push({ pack: name, ...one });

            const parts = [
                c.skills?.length
                    ? `${opened.skills} skill(s) in ${c.skills.length} root(s)` +
                      (opened.unreadableRoots ? `, ${opened.unreadableRoots} root(s) UNREAD — that count is over what was opened, not over what was declared` : "")
                    : null,
                c.personas?.length ? `${opened.personas} of ${c.personas.length} persona(s) opened` : null,
                c.verify?.length
                    ? `${c.verify.length} recipe(s) composed as ${c.verify.map((r) => `\`${composedId(name, r.id)}\``).join(", ")}`
                    : null,
                c.gates?.length ? `${c.gates.length} gate fragment(s)` : null,
            ].filter(Boolean);
            // Named only for a union, the one plan whose origin the invocation does not show.
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

            // First match wins and discovered roots come first, so an installed copy can shadow the tree's.
            {
                const shadowed = shadowedCopy(name, origin, roots, (r) => originOf.get(r)) ?? { dir: null };
                if (shadowed.dir) {
                    let other = null;
                    try {
                        other = JSON.parse(fs.readFileSync(shadowed.manifest, "utf8"));
                    } catch (cause) {
                        report(
                            "packs",
                            `\`${name}\` is SHADOWED — the tree-derived root also carries it at ${path.relative(dir, shadowed.dir)}, and that copy could not be read (${cause.message}), so what differs could not be compared`,
                        );
                    }
                    if (other) {
                        const differs = packDifferences(manifest, other);
                        report(
                            "packs",
                            `\`${name}\` is SHADOWED — the installed copy answered and the tree-derived root also carries it at ` +
                                `${path.relative(dir, shadowed.dir)}; ${differs.length ? `they differ by ${differs.join(" and ")}` : "the two agree today"}. ` +
                                "An unpinned `compile` or `recipe-set` REFUSES this rather than picking, and so does `index` for a workspace declaring a scope index — name the root: `--pack-root packs` for the tree, which is what the recipes check",
                        );
                    }
                }
            }
        }
    }

    if (workspace.librarian && !workspace.slots?.memory) {
        fail(
            "cross",
            "`librarian` declares a scheduled pass with no `slots.memory` store to age — the object " +
                "configures a store rather than replacing one, and a pass over nothing reports that " +
                "nothing is stale, which is indistinguishable from a healthy store",
        );
    }

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

    const alwaysTokens = workspace.context?.always?.budget?.tokens;
    if (alwaysTokens !== undefined && !positive(alwaysTokens)) {
        fail(
            "schema",
            `context.always.budget.tokens is ${JSON.stringify(alwaysTokens)}, which is not a positive integer. ` +
                "The declared keyword subset has no `minimum` and cannot say `integer`, so this is checked here",
        );
    }

    // Not an integer: 2.99 bytes per token is a real figure.
    const bytesPerToken = workspace.context?.ratio?.bytes_per_token;
    if (bytesPerToken !== undefined && !(Number.isFinite(bytesPerToken) && bytesPerToken >= 1)) {
        fail(
            "schema",
            `context.ratio.bytes_per_token is ${String(bytesPerToken)}, and it must be a finite number of at least 1. ` +
                "A token covers at least one byte, so a smaller figure is tokens per byte entered inverted. The " +
                "declared keyword subset has no `minimum`, so this is checked here",
        );
    }

    const cutoff = workspace.memory?.store?.budget?.cutoff;
    if (cutoff !== undefined) {
        const m = typeof cutoff === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(cutoff) : null;
        const at = new Date(0);
        if (m) at.setUTCFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (!m || at.toISOString().slice(0, 10) !== cutoff) {
            fail(
                "schema",
                `memory.store.budget.cutoff is ${JSON.stringify(cutoff)}, which is not a real day written YYYY-MM-DD. ` +
                    "The declared keyword subset's pattern admits a day that does not exist, so this is checked here",
            );
        }
        if (workspace.memory?.store?.budget?.record_kilobytes === undefined) {
            fail(
                "cross",
                "`memory.store.budget.cutoff` is declared with no `record_kilobytes` beside it. A cutoff says which " +
                    "records the per-record cap binds, so alone it configures nothing while reading as configured",
            );
        }
    }

    // Held to the bounds of `readSpend` and `overflowingWrite` in ./ledger.mjs, so what passes here, the ledger takes.
    const readMultiplier = workspace.spend?.multipliers?.read;
    if (readMultiplier !== undefined && !(Number.isFinite(readMultiplier) && readMultiplier > 0 && readMultiplier <= 1)) {
        fail(
            "schema",
            `spend.multipliers.read is ${String(readMultiplier)}, and it must be a finite number above 0 and at most 1. A token ` +
                "read from cache costs something, and never more than the same token sent uncached. The declared keyword subset " +
                "has neither `minimum` nor `maximum`, so this is checked here",
        );
    }
    for (const lifetime of ["5m", "1h"]) {
        const writeMultiplier = workspace.spend?.multipliers?.write?.[lifetime];
        if (writeMultiplier !== undefined && !(Number.isFinite(writeMultiplier) && writeMultiplier >= 1)) {
            fail(
                "schema",
                `spend.multipliers.write["${lifetime}"] is ${String(writeMultiplier)}, and it must be a finite number of at least 1. ` +
                    "Writing a token to the cache costs at least what sending it uncached does. The declared keyword subset " +
                    "has no `minimum`, so this is checked here",
            );
        }
    }
    if (Number.isFinite(readMultiplier) && readMultiplier > 0) {
        for (const lifetime of ["5m", "1h"]) {
            const writeMultiplier = workspace.spend?.multipliers?.write?.[lifetime];
            if (Number.isFinite(writeMultiplier) && !Number.isFinite(writeMultiplier / readMultiplier)) {
                fail(
                    "schema",
                    `spend.multipliers.write["${lifetime}"] divided by spend.multipliers.read overflows, so no finite restart ` +
                        "threshold can be computed from them. No keyword in the declared subset relates two figures, so this is " +
                        "checked here",
                );
            }
        }
    }
    const horizonRequests = workspace.spend?.horizon?.requests;
    if (horizonRequests !== undefined && !positive(horizonRequests)) {
        fail(
            "schema",
            `spend.horizon.requests is ${JSON.stringify(horizonRequests)}, which is not a positive integer. ` +
                "The declared keyword subset has no `minimum` and cannot say `integer`, so this is checked here",
        );
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

    if (workspace.memory?.index?.path && workspace.slots?.memory) {
        const storeDir = path.resolve(dir, workspace.slots.memory);
        const indexPath = path.resolve(dir, workspace.memory.index.path);
        if (isInside(storeDir, indexPath)) {
            fail(
                "cross",
                `memory.index.path (\`${workspace.memory.index.path}\`) sits inside slots.memory ` +
                    `(\`${workspace.slots.memory}\`), where this validator counts it as a record. ` +
                    "Site the generated index beside the store, not in it",
            );
        }
    }

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

    // ---------------------------------------------------------------- claims against the tree
    const treeRoot = workspace.tree ? path.resolve(dir, workspace.tree) : null;
    const claimTargets = [];

    // ---------------------------------------------------------------- persona ↔ agent bindings
    if (composedPersonas.length) {
        if (!treeRoot) {
            stats.unverifiable += composedPersonas.length;
            report(
                "bindings",
                `${composedPersonas.length} composed persona(s) could not be matched to a host binding — this workspace declares no \`tree\`, ` +
                    `so there is no repository to look in. Unverifiable, not unbound`,
            );
        }
        // Both sides realpathed: a tree under a link (macOS `/var`) would otherwise refuse ordinary bindings.
        let realTree = treeRoot;
        try {
            if (treeRoot) realTree = fs.realpathSync(treeRoot);
        } catch {
            // Already reported by the claims checks; the declared path keeps the containment test running.
        }
        for (const persona of treeRoot ? composedPersonas : []) {
            const rel = path.join(AGENT_DIR, `${persona.key}.md`);
            const where = `\`${persona.pack}\`'s \`${persona.rel}\``;
            const keyed = persona.keyedBy === "declaration" ? "" : " (keyed by filename — the persona declares no `name`)";
            const file = path.join(treeRoot, rel);

            // The key is a pack's free text, so it is contained before it is opened: lexically here, since the
            // realpath test below is skipped where nothing exists.
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
                // ENOENT falls through to the read below, which reports the persona unbound.
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
            // Declared, not compared: a binding may grant less, or other, than its persona describes.
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
                fail("claims", `repos/${name}.md could not be read, so its claims went unchecked — ${cause.message}`);
                continue;
            }
            for (const claim of repoCardClaims(source)) {
                claimTargets.push({ where: `repos/${name}.md`, ...claim, base: reposDir });
            }
        }
    }

    let claimedChecks = [];
    // A snapshot: `claimedChecks` is emptied below where there are no workflows to compare it with.
    let declaredChecksInProse = [];
    let gatesRead = false;
    // Null without a tree, which differs from a tree with no workflows.
    let workflowContexts = null;
    let namedAnyCheck = false;
    if (workspace.slots?.gates) {
        try {
            claimedChecks = requiredCheckClaims(fs.readFileSync(path.resolve(dir, workspace.slots.gates), "utf8"));
            declaredChecksInProse = [...claimedChecks];
            gatesRead = true;
            namedAnyCheck = claimedChecks.length > 0;
        } catch {
            // Already a `paths` failure; a throw here would trade the verdicts reached for exit 2.
        }
    }

    if (treeRoot) {
        for (const claim of claimTargets) {
            if (claim.target === null) {
                stats.unverifiable += 1;
                report("claims", `${claim.where} states ${claim.what}, which contains nothing path-shaped to check — counted as unverifiable rather than passed over`);
                continue;
            }
            const checkable = claim.severity !== "report";
            if (checkable) stats.claims += 1;
            else stats.unverifiable += 1;

            // Two bases: a card writes some paths from the repository root and some from itself.
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

    if (gatesRead && !namedAnyCheck) {
        report(
            "claims",
            "the gate map names no required status check — either this workspace requires none, or its floor table does not use the row label `Required status check` that this check recognises (spec/slots.md). Nothing was compared against the tree",
        );
    }

    // ---------------------------------------------------------------- the per-host degradation report
    // Coverage is reported, never failed: nothing legislates a minimum.
    if (workspace.gates) {
        const policyFile = path.resolve(dir, workspace.gates);
        let parsed = null;
        let columns = null;
        let composed = null;
        try {
            // Composed before parsing, as `compile` does, so a pack's fragment is validated as a hand-written rule is.
            const composition = packContributions(dir, ".", { packRoots: resolvedPackRoots ?? [] });
            composed = composeFragments(JSON.parse(fs.readFileSync(policyFile, "utf8")), composition.contributions);
            parsed = parse(composed.policy);
            // In the guard: a backend may refuse a policy that parses, and an unguarded throw discards every verdict.
            columns = backends(parsed, { source: workspace.gates });
        } catch (cause) {
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

            // Gated and prohibited rules only: an `auto` rule compiled by nothing is the system working.
            const uncovered = parsed.rules.filter(
                (rule) =>
                    (rule.tier === "gated" || rule.tier === "prohibited") &&
                    columns.every((c) => !c.compiled.some((x) => x.id === rule.id)),
            );
            report(
                "enforcement",
                uncovered.length
                    ? `${uncovered.length} gate(s) no backend compiles — policy this workspace yields that nothing enforces: ${uncovered.map((r) => `\`${r.id}\``).join(", ")}. Each is a prompt-level habit until a backend reaches it`
                    : "every gate this workspace yields is compiled by at least one backend — which says the policy is reachable, never that a host honours what was emitted",
            );

            if (composed.added?.length) {
                const members = composed.added.map((a) => `\`${a.id}\` (${a.pack})`).join(", ");
                report(
                    "enforcement",
                    `${composed.added.length} of the ${parsed.rules.length} rule(s) this workspace yields are composed from its packs rather than declared in \`${workspace.gates}\` — ${members}; change them in the pack that contributes them`,
                );
            }

            if (packsUnresolved) {
                report(
                    "enforcement",
                    `${packsUnresolved} declared pack(s) did not resolve, so whether they contribute gates could not be seen — the totals above may be incomplete`,
                );
            }

            // ---------------------------------------------------------------- the floor's declared contexts
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
                // Failed, not reported: a required context that never reports blocks every pull request.
                if (!workflowContexts.contexts.includes(check.context)) {
                    fail(
                        "enforcement",
                        `the floor requires the status check \`${check.context}\`, which no workflow job in the tree reports (found: ${workflowContexts.contexts.join(", ") || "none"}). Importing this ruleset would block every pull request on a check that never arrives`,
                    );
                }
            }

            // Not gated on the prose naming a check: a missing or unrecognised row is the widest divergence.
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
        // Reported, never failed: gate fragments composed with no `gates` policy are a valid shape, only uncompiled.
        try {
            const { contributions } = packContributions(dir, ".", { packRoots: resolvedPackRoots ?? [] });
            const fragments = contributions.reduce((n, c) => n + (c.fragments?.length ?? 0), 0);
            if (fragments) {
                const incomplete = packsUnresolved
                    ? `, and ${packsUnresolved} declared pack(s) did not resolve, so this count is a floor rather than a total`
                    : "";
                report(
                    "enforcement",
                    `this workspace composes ${fragments} gate rule(s) from the packs that resolved and declares no \`gates\` policy for them to join, so nothing here compiles them — \`compile\` exits 2 on this shape rather than emitting a partial policy${incomplete}`,
                );
            }
        } catch (cause) {
            // The packs section owns that failure; failing it here too would count one defect twice.
            report("enforcement", `the composed gate contributions could not be read — ${cause.message}`);
        }
    }

    // ---------------------------------------------------------------- provenance and the store's growth
    if (workspace.slots?.memory) {
        const memoryDir = path.resolve(dir, workspace.slots.memory);
        let entries = [];
        try {
            entries = fs.readdirSync(memoryDir).filter((f) => f.endsWith(".md") && f !== "README.md").sort();
        } catch { /* the missing directory is already a `paths` failure */ }

        for (const entry of entries) {
            let source;
            try {
                source = fs.readFileSync(path.join(memoryDir, entry), "utf8");
            } catch (cause) {
                stats.records += 1;
                // Sized from stat, so the record and KB counts agree; its content is never assessed.
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

            // Ahead of the provenance branches below, which `continue`, so every readable record is assessed.
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

    const proportion = stats.rules ? `${stats.sealed} of ${stats.rules}` : "0 of 0";
    report(
        "provenance",
        `${stats.records} memory record(s), ${stats.rules} of them rules; sealed proportion ${proportion}` +
            (stats.rules && stats.sealed === stats.rules
                ? " — every rule is sealed, which means this workspace has opted out of retirement altogether"
                : "") +
            ". The form is checked, never the truth: a fabricated stamp passes exactly as a real one does",
    );

    // Size and count only: in a fresh clone every file's mtime is the checkout's, so no age is read here.
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

    const always = alwaysLine(dir, workspace);
    (always.verdict === "over" || always.verdict === "unjudged" ? fail : report)("context", always.line);

    // Never a verdict: failing it would turn red every workspace drafted before the new form.
    let form;
    try {
        form = formLine(dir, workspace, { over: always.verdict === "over" });
    } catch (error) {
        form = `not read — ${error.message}`;
    }
    report("form", form);

    let sessions;
    try {
        sessions = sessionsLine(workspace);
    } catch (error) {
        sessions = `not read — ${error.message}`;
    }
    report("sessions", sessions);

    return { dir, workspace, findings, stats };
}

// ---------------------------------------------------------------- the command

const ICON = { fail: "FAIL ", report: "note " };

function display(target) {
    const rel = path.relative(process.cwd(), path.resolve(target));
    return rel === "" ? "." : rel.startsWith("..") ? path.resolve(target) : rel;
}

/** The help screen: every flag it names must be one `run` parses. */
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

/** Runs against each workspace directory and returns the exit code; never throws. */
export async function run(argv, options = {}) {
    const say = options.quiet ? () => {} : (line = "") => process.stdout.write(`${line}\n`);
    // Before any other argument is judged, so help is never outranked by a complaint about the rest.
    if (argv.includes("--help") || argv.includes("-h")) {
        say(usage());
        return 0;
    }
    try {
        const namedRoots = [];
        let discoverPacks = false;
        const repoRoots = [];
        const dirs = [];
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
                if (argv[i + 1] === AUTO) discoverPacks = true;
                else namedRoots.push(directoryRoot("--pack-root", argv[i + 1], PACK_ROOT));
                i += 1;
            } else if (!argv[i].startsWith("-")) dirs.push(argv[i]);
            else {
                throw new DoctorError(
                    `unknown argument \`${argv[i]}\` — run \`portulan doctor --help\` or \`node cli/doctor.mjs --help\` for the flags this tool takes`,
                );
            }
        }
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
        // Anything reaching here could not be judged, a defect in doctor included: 2, never a verdict.
        if (!options.quiet) {
            process.stderr.write(`doctor: ${error instanceof DoctorError ? error.message : `unanticipated failure — ${error.stack ?? error}`}\n`);
        }
        return 2;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = await run(process.argv.slice(2));
}
