// The sender's field map, against the real issue forms rather than against a fixture.
//
//   node --test "cli/**/*.test.mjs"
//
// `feedback.mjs` has to carry the shape of `.github/ISSUE_TEMPLATE/*.yml` — `package.json`'s `files`
// does not ship those forms, so a published package cannot read them; parsing YAML at runtime would
// need a dependency this CLI is ruled not to have, and generating the map would need a build step it is
// ruled not to have either. That leaves **one fact with two carriers**, which is the defect this
// repository names more often than any other, so it gets `0020`'s repair for the case where a single
// carrier is impossible: one carrier, and a rail on the pair.
//
// This is the rail. It runs in this repository's own CI, which is the only place the forms can change.
//
// **It parses YAML with a reader written here**, which is a smaller claim than it sounds: it is a
// reader for these three files, in this repository, exercised by these assertions on every run — not a
// general parser. What makes that safe rather than convenient is the precondition below: if the reader
// stops understanding a form and returns nothing, the test **fails** instead of passing vacuously. A
// rail that goes quiet when its instrument breaks is the false green this project keeps paying for.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FORMS } from "./feedback.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES = path.join(REPO, ".github", "ISSUE_TEMPLATE");

// ===========================================================================================
// A reader for these three files
// ===========================================================================================

/** The column a line's content starts at, or Infinity for a blank one. */
function indent(line) {
    if (!line.trim()) return Infinity;
    return line.length - line.trimStart().length;
}

/**
 * Read a scalar that may be folded (`>`) or literal (`|`) across the lines that follow it, the way
 * GitHub reads these forms: continuation lines are the ones indented past the key, joined with single
 * spaces. `at` is the column the key itself starts at.
 */
function scalar(lines, i, at, inline) {
    if (!/^[|>][+-]?$/.test(inline)) return { value: unquote(inline), next: i + 1 };
    const collected = [];
    let j = i + 1;
    for (; j < lines.length; j += 1) {
        if (indent(lines[j]) === Infinity) continue;
        if (indent(lines[j]) <= at) break;
        collected.push(lines[j].trim());
    }
    return { value: collected.join(" ").trim(), next: j };
}

function unquote(value) {
    const trimmed = value.trim();
    if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

/**
 * @returns {{title: string, labels: string[], fields: Array<{type, id, label, required, options, render}>,
 *            checkboxes: {label: string, options: Array<{text: string, required: boolean}>}|null}}
 */
function readForm(text) {
    const lines = text.split(/\r?\n/);
    const out = { title: null, labels: [], fields: [], checkboxes: null };
    let item = null;

    const flush = () => {
        if (!item || !item.id || item.type === "markdown") return;
        if (item.type === "checkboxes") out.checkboxes = { label: item.label, options: item.checkboxOptions };
        else out.fields.push(item);
        item = null;
    };

    for (let i = 0; i < lines.length; ) {
        const line = lines[i];
        const at = indent(line);
        const trimmed = line.trim();

        if (at === 0) {
            const top = /^([a-z_]+):\s*(.*)$/.exec(trimmed);
            if (top?.[1] === "title") out.title = unquote(top[2]);
            else if (top?.[1] === "labels") out.labels = [...top[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
            i += 1;
            continue;
        }

        const start = /^-\s+type:\s*(\S+)$/.exec(trimmed);
        if (start && at === 2) {
            flush();
            item = { type: start[1], id: null, label: null, required: false, options: null, render: null, checkboxOptions: [] };
            i += 1;
            continue;
        }
        if (!item) {
            i += 1;
            continue;
        }

        const idLine = /^id:\s*(\S+)$/.exec(trimmed);
        if (idLine && at === 4) {
            item.id = idLine[1];
            i += 1;
            continue;
        }
        const labelLine = /^label:\s*(.*)$/.exec(trimmed);
        if (labelLine && at === 6) {
            const read = scalar(lines, i, at, labelLine[1]);
            item.label = read.value;
            i = read.next;
            continue;
        }
        const renderLine = /^render:\s*(\S+)$/.exec(trimmed);
        if (renderLine && at === 6) {
            item.render = renderLine[1];
            i += 1;
            continue;
        }
        const requiredLine = /^required:\s*(true|false)$/.exec(trimmed);
        if (requiredLine && at === 6) {
            item.required = requiredLine[1] === "true";
            i += 1;
            continue;
        }
        if (trimmed === "options:" && at === 6) {
            if (item.type === "dropdown") {
                item.options = [];
                let j = i + 1;
                for (; j < lines.length && indent(lines[j]) === 8 && lines[j].trim().startsWith("- "); j += 1) {
                    item.options.push(unquote(lines[j].trim().slice(2)));
                }
                i = j;
            } else i += 1;
            continue;
        }
        // A checkbox option: `- label: …` at column 8, with its own `required:` at column 10.
        const boxLabel = /^-\s+label:\s*(.*)$/.exec(trimmed);
        if (boxLabel && at === 8 && item.type === "checkboxes") {
            const read = scalar(lines, i, at + 2, boxLabel[1]);
            item.checkboxOptions.push({ text: read.value, required: false });
            i = read.next;
            continue;
        }
        const boxRequired = /^required:\s*(true|false)$/.exec(trimmed);
        if (boxRequired && at === 10 && item.type === "checkboxes" && item.checkboxOptions.length) {
            item.checkboxOptions.at(-1).required = boxRequired[1] === "true";
            i += 1;
            continue;
        }
        i += 1;
    }
    flush();
    return out;
}

// ===========================================================================================
// The rail
// ===========================================================================================

describe("the shipped field map against the real issue forms", () => {
    test("the reader understands every form — a rail whose instrument broke must go red, not quiet", () => {
        for (const declared of FORMS) {
            const read = readForm(fs.readFileSync(path.join(TEMPLATES, declared.file), "utf8"));
            assert.ok(read.title, `${declared.file}: no title read`);
            assert.ok(read.fields.length >= 2, `${declared.file}: read ${read.fields.length} field(s)`);
            assert.ok(read.checkboxes, `${declared.file}: no acknowledgements block read`);
            assert.ok(read.checkboxes.options.length >= 1, `${declared.file}: no acknowledgement options read`);
        }
    });

    test("the directory's forms and the map's forms are the same set", () => {
        const onDisk = fs
            .readdirSync(TEMPLATES)
            .filter((name) => name.endsWith(".yml") && name !== "config.yml")
            .sort();
        assert.deepEqual(onDisk, FORMS.map((f) => f.file).sort());
    });

    for (const declared of FORMS) {
        test(`${declared.file} — title prefix, sections, requiredness, options and acknowledgements all agree`, () => {
            const read = readForm(fs.readFileSync(path.join(TEMPLATES, declared.file), "utf8"));

            assert.equal(declared.titlePrefix, read.title, "the title prefix the sender applies is the form's own");

            assert.deepEqual(
                declared.sections.map((s) => s.id),
                read.fields.map((f) => f.id),
                "the sender's sections must be the form's fields, in the form's order",
            );

            for (const [i, section] of declared.sections.entries()) {
                const field = read.fields[i];
                assert.equal(section.label, field.label, `${section.id}: label`);
                assert.equal(Boolean(section.required), field.required, `${section.id}: required`);
                assert.equal(section.render ?? null, field.render, `${section.id}: render`);
                assert.deepEqual(section.options ?? null, field.options, `${section.id}: dropdown options`);
            }

            assert.equal(declared.acknowledgementsLabel, read.checkboxes.label);
            assert.deepEqual(
                declared.acknowledgements,
                read.checkboxes.options.map((option) => ({ text: option.text, required: option.required })),
                "the acknowledgements the sender asks for are the form's own, verbatim and in order",
            );
        });
    }

    test("a form that declares a label the sender never sets is not a gap the sender has to close", () => {
        // Every form declares `labels:`, and the sender deliberately sends none — proposal 0014:
        // "No issue triage, labelling or routing from the client. The repository owns its own labels."
        // Asserted so a later reader meets the decision instead of the omission.
        for (const declared of FORMS) {
            const read = readForm(fs.readFileSync(path.join(TEMPLATES, declared.file), "utf8"));
            assert.deepEqual(read.labels, [declared.kind], `${declared.file}: the form labels itself`);
            assert.ok(!("labels" in declared), "the sender's map carries no labels, because the sender sends none");
        }
    });
});
