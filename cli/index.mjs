#!/usr/bin/env node
// `index` — the memory index generator, and the rail on what memory may cost.
//
//   node cli/index.mjs [--check] [--pack-root <dir>|auto]... <workspace-dir> [<workspace-dir> ...]
//   node cli/index.mjs --handoffs <workspace-dir> [<workspace-dir> ...]
//   node cli/index.mjs [--check] --changes <dir>
//
// Exit 0 every index current and within budget · 1 a red verdict · 2 could not run.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { resolvePack, rootPlan, shadowedCopy } from "./compile.mjs";
import { AUTO, discoverPackRoots, namedWithAuto } from "./discover.mjs";

/** Raised when `index` cannot run, or cannot judge honestly. Always exit 2, never 1. */
export class IndexError extends Error {
    constructor(message) {
        super(message);
        this.name = "IndexError";
    }
}

const KNOWN_SPECS = new Set(["2.0", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "2.11", "2.12", "2.13"]);

// `doctor` skips the same name, so the two count the same records.
const NOT_A_RECORD = new Set(["README.md"]);

const KB = 1024;

import { isInside } from "./inside.mjs";
export { isInside };

// ---------------------------------------------------------------- titles

/** A record's declared `**type:**`, lowercased, or `""` when it declares none. */
export const recordType = (source) => (source.match(/^\s*\*\*type:\*\*\s*(\S+)/im)?.[1] ?? "").toLowerCase();

/** `a-review-loop-needs-a-bound.md` → `A review loop needs a bound`. */
export function titleOf(filename) {
    const stem = filename.replace(/\.md$/i, "");
    const words = stem.split("-").filter(Boolean).join(" ");
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The record's H1, or null; only its first non-blank line is read, so a `#` line inside a fence is never taken for one. */
export function headingOf(source) {
    const first = source.split("\n").find((line) => line.trim() !== "");
    return first?.match(/^#[ \t]+(.+?)[ \t]*$/)?.[1] ?? null;
}

/** A handoff's date, the leading `YYYY-MM-DD` of its filename where that names a real day, else null. */
export function dateOf(filename) {
    const m = filename.match(/^(\d{4})-(\d{2})-(\d{2})-/);
    return m ? realDay(m[1], m[2], m[3]) : null;
}

function realDay(y, mo, d) {
    const at = new Date(0);
    // Not `Date.UTC`, which reads a year from 0 to 99 as 1900 to 1999.
    at.setUTCFullYear(Number(y), Number(mo) - 1, Number(d));
    const iso = `${y}-${mo}-${d}`;
    return at.toISOString().slice(0, 10) === iso ? iso : null;
}

/** A record's `**dated:**` day, the day its text last changed, or null where the line is absent or names no real day. */
export function recordDate(source) {
    const m = source.match(/^\s*\*\*dated:\*\*[ \t]*(\d{4})-(\d{2})-(\d{2})[ \t]*$/im);
    return m ? realDay(m[1], m[2], m[3]) : null;
}

// Without case or punctuation, which a record's filename does not carry.
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

// ---------------------------------------------------------------- reading the store

/** The `.md` files of a series, sorted; a directory it cannot read is an `IndexError`, never an empty series. */
function listSeries(seriesDir, slot, what) {
    let names;
    try {
        names = fs.readdirSync(seriesDir);
    } catch (cause) {
        throw new IndexError(
            `cannot read the ${what} at ${slot} — ${cause.code ?? cause.message}. ` +
                "Refusing to render an index of nothing: an empty index compares equal to an empty committed one and would pass",
        );
    }
    return names.filter((n) => n.endsWith(".md") && !NOT_A_RECORD.has(n)).sort();
}

/** A workspace's memory store, `{ records, bytes }`; anything it cannot read is an `IndexError`, never a record left out. */
export function readStore(dir, workspace) {
    const slot = workspace?.slots?.memory;
    if (!slot) {
        throw new IndexError(
            "the manifest declares a `memory` budget but no `slots.memory` store — there is nothing to index. " +
                "The declared JSON Schema subset has no `dependentRequired` (spec/README.md), so this is checked here and by `doctor`",
        );
    }

    const storeDir = path.resolve(dir, slot);
    const files = listSeries(storeDir, slot, "memory store");
    const records = [];
    let bytes = 0;

    for (const file of files) {
        let source;
        try {
            source = fs.readFileSync(path.join(storeDir, file), "utf8");
        } catch (cause) {
            throw new IndexError(`cannot read the record ${path.join(slot, file)} — ${cause.code ?? cause.message}`);
        }
        const recordBytes = Buffer.byteLength(source);
        bytes += recordBytes;
        records.push({
            file,
            title: titleOf(file),
            bytes: recordBytes,
            type: recordType(source) || "untyped",
            heading: headingOf(source),
            dated: recordDate(source),
        });
    }

    return { records, bytes };
}

/** A workspace's handoff series, `{ records, bytes }`, newest first; a record's `date` or `heading` is null where it has none. */
export function readHandoffs(dir, workspace) {
    const slot = workspace?.slots?.handoffs;
    if (!slot) {
        throw new IndexError(
            "the manifest declares a `handoffs` index but no `slots.handoffs` series — there is nothing to index. " +
                "The declared JSON Schema subset has no `dependentRequired` (spec/README.md), so this is checked here and by `doctor`",
        );
    }

    const seriesDir = path.resolve(dir, slot);
    // `readdirSync` follows a link, so a link on the series path is refused before it is listed.
    refuseLinks(dir, slot, seriesDir, "a handoff series is read where its path says");
    const files = listSeries(seriesDir, slot, "handoff series").reverse();
    const records = [];
    let bytes = 0;

    for (const file of files) {
        let source;
        try {
            const stat = fs.lstatSync(path.join(seriesDir, file));
            if (stat.isSymbolicLink() || !stat.isFile()) {
                throw new IndexError(`${path.join(slot, file)} is not a regular file: a handoff is a file of its own, never a link or a directory`);
            }
            source = fs.readFileSync(path.join(seriesDir, file), "utf8");
        } catch (cause) {
            if (cause instanceof IndexError) throw cause;
            throw new IndexError(`cannot read the handoff ${path.join(slot, file)} — ${cause.code ?? cause.message}`);
        }
        bytes += Buffer.byteLength(source);
        records.push({ file, date: dateOf(file), heading: headingOf(source) });
    }

    return { records, bytes };
}

/** The `## Memory scope` section of a persona file, normalized, or `null` if it carries none. */
export function memoryScopeOf(source) {
    const m = source.match(/^##[ \t]+Memory scope[ \t]*$([\s\S]*?)(?=^##[ \t]|$(?![\s\S]))/im);
    if (!m) return null;
    // Asides and line breaks dropped, so a rewrapped scope keeps its digest; an aside may hold a link's `)`.
    const body = m[1].replace(/_\([\s\S]*?\)_/g, " ").replace(/\s+/g, " ").trim();
    return body || null;
}

const SENTENCE_BUDGET = 120;
const firstSentence = (scope) => {
    const sentence = (scope.match(/^([\s\S]*?\.)(\s|$)/) ?? [null, scope])[1].trim();
    if (sentence.length <= SENTENCE_BUDGET) return sentence;
    const clipped = sentence.slice(0, SENTENCE_BUDGET);
    const atWord = clipped.lastIndexOf(" ");
    return `${(atWord > 40 ? clipped.slice(0, atWord) : clipped).trimEnd()}…`;
};

const scopeDigest = (scope) => crypto.createHash("sha256").update(scope, "utf8").digest("hex").slice(0, 8);

/** Every path in a pack with `memory` as a segment, matched before its type, so a link named `memory` counts; no link is followed. */
function packRecords(packDir, rel = "", out = []) {
    let entries;
    try {
        entries = fs.readdirSync(path.join(packDir, rel), { withFileTypes: true });
    } catch (cause) {
        throw new IndexError(
            `cannot read the pack directory ${path.join(packDir, rel)} — ${cause.code ?? cause.message}. ` +
                "Refusing to report that a pack carries no records of its own when it could not be enumerated",
        );
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const child = rel ? path.posix.join(rel, e.name) : e.name;
        if (/(^|\/)memory(\/|$)/.test(child)) {
            out.push(child);
            continue;
        }
        if (e.isDirectory()) packRecords(packDir, child, out);
    }
    return out;
}

/** The memory scopes a workspace's composed packs declare; defects are returned, and only what leaves no index to render throws. */
export function readScopes(dir, workspace, options = {}) {
    const slot = workspace?.slots?.personas;
    if (!slot) {
        throw new IndexError(
            "the manifest declares a `personas` index but no `slots.personas` layer — there is nowhere for a scope to land. " +
                "The declared JSON Schema subset has no `dependentRequired` (spec/README.md), so this is checked here and by `doctor`",
        );
    }

    const declared = Array.isArray(workspace?.packs) ? workspace.packs : [];
    // `packRoots`, when given, is the whole root set: an empty one searches nowhere, not the derived root.
    const plan = rootPlan(dir, workspace, {
        named: options.packRoots ?? [],
        namedGiven: options.packRoots !== undefined && options.packRoots !== null,
        discovery: options.discovery ?? (() => discoverPackRoots()),
        forced: options.discoverPacks === true,
    });
    if (plan.refusal) throw new IndexError(plan.refusal);
    if (plan.couldNotRun) throw new IndexError(plan.couldNotRun);
    const roots = plan.roots;
    const originOf = new Map((plan.origins ?? []).map((o) => [o.root, o.origin]));
    const posixSlot = slot.split(path.sep).join(path.posix.sep).replace(/\/$/, "");

    const scopes = [];
    const unresolved = [];
    const carrying = [];
    const broken = [];

    for (const name of declared) {
        const found = resolvePack(name, roots);
        if (!found.dir) {
            unresolved.push(found);
            continue;
        }
        if (!(options.discoverPacks === true) && plan.source !== "named") {
            const originAt = (r) => (plan.origins ?? []).find((o) => path.resolve(o.root) === path.resolve(r))?.origin;
            const behind = shadowedCopy(name, originAt(found.root), roots, originAt);
            if (behind) {
                const repoRoot = typeof workspace?.tree === "string" && workspace.tree.trim() ? path.resolve(dir, workspace.tree) : null;
                const behindShown = repoRoot ? path.relative(repoRoot, behind.root) : behind.root;
                throw new IndexError(
                    `\`${name}\` is SHADOWED — it resolved under ${found.root}, a root discovered on this host, ` +
                        `while the root ${behindShown} also carries it. This index digests the ` +
                        `answering copy's memory scope, so which root answered decides what a committed file says. ` +
                        "Refusing to pick: name the root — `--pack-root packs` for the tree, which is what " +
                        "`verify/index.sh` checks, or `--pack-root auto` for the installed copy.",
                );
            }
        }

        let manifest;
        try {
            manifest = JSON.parse(fs.readFileSync(found.manifest, "utf8"));
        } catch (cause) {
            throw new IndexError(
                `cannot read the pack manifest for \`${found.name}\` at ${found.manifest} — ${cause.code ?? cause.message}. ` +
                    "Refusing to render a scope index over a pack whose declaration could not be read",
            );
        }

        for (const rel of packRecords(found.dir)) carrying.push({ pack: found.name, file: rel });

        const personas = manifest?.contributes?.personas;
        if (personas !== undefined && !Array.isArray(personas)) {
            throw new IndexError(
                `the pack manifest for \`${found.name}\` declares \`contributes.personas\` as ${typeof personas} rather than an array. ` +
                    "Refusing rather than reading past it — run `doctor` to validate the pack against the Pack Definition",
            );
        }

        for (const rel of personas ?? []) {
            if (typeof rel !== "string" || !rel.trim()) {
                throw new IndexError(
                    `pack \`${found.name}\` declares a persona entry that is not a string path — ${JSON.stringify(rel)}. ` +
                        "Refusing rather than resolving it — run `doctor` to validate the pack against the Pack Definition",
                );
            }
            // Contained lexically and canonically: `path.resolve` is textual, and `readFileSync` follows a link out of the pack.
            const file = path.resolve(found.dir, rel);
            let real = file;
            let realPackDir = found.dir;
            try {
                realPackDir = fs.realpathSync(found.dir);
                real = fs.realpathSync(file);
            } catch { /* unresolvable: the lexical check still applies, and the read reports it */ }
            if (!isInside(found.dir, file) || !isInside(realPackDir, real)) {
                throw new IndexError(
                    `pack \`${found.name}\` declares the persona ${JSON.stringify(rel)}, which resolves outside the pack ` +
                        "directory. A pack may only contribute files it ships — refusing to read it",
                );
            }
            let source;
            try {
                source = fs.readFileSync(file, "utf8");
            } catch (cause) {
                throw new IndexError(
                    `pack \`${found.name}\` declares the persona ${rel}, which cannot be read — ${cause.code ?? cause.message}. ` +
                        "Refusing to render an index that would silently omit a declared persona",
                );
            }

            const persona = path.posix.basename(rel.split(path.sep).join(path.posix.sep), ".md");
            const scope = memoryScopeOf(source);
            if (scope === null) {
                broken.push({ pack: found.name, persona, file: rel });
                continue;
            }
            // Returned, never rendered: an index naming the root that answered would differ from host to host.
            const origin = plan.source === "union" ? originOf.get(found.root) ?? null : null;
            scopes.push({ persona, pack: found.name, location: `${posixSlot}/${persona}/`, scope, origin });
        }
    }

    scopes.sort((a, b) => `${a.pack}/${a.persona}`.localeCompare(`${b.pack}/${b.persona}`));
    return { scopes, unresolved, carrying, broken };
}

// ---------------------------------------------------------------- rendering

/** The memory index as text. */
export function render(workspace, store) {
    const indexPath = workspace?.memory?.index?.path;
    const lineBudget = workspace?.memory?.index?.budget?.lines;
    const slot = workspace.slots.memory;

    const posix = (p) => p.split(path.sep).join(path.posix.sep);
    const from = path.posix.dirname(posix(indexPath));

    const header = [
        `# Memory index — ${workspace.name}`,
        "",
        `> Generated from \`${slot}\` by \`node cli/index.mjs\`. Do not edit by hand: it is regenerated`,
        `> and byte-compared, so a hand-edit survives exactly until the next run.`,
        `> ${store.records.length} record(s)` + (lineBudget ? ` · budget ${lineBudget} lines.` : "."),
        "",
    ];

    const entries = store.records.map((r) => {
        const href = path.posix.relative(from, path.posix.join(posix(slot), r.file));
        return `- [${r.title}](${href}) — ${r.type}`;
    });

    return [...header, ...entries].join("\n") + "\n";
}

export function renderHandoffIndex(workspace, series) {
    const indexPath = workspace?.handoffs?.index?.path;
    const slot = workspace.slots.handoffs;

    const posix = (p) => p.split(path.sep).join(path.posix.sep);
    const from = path.posix.dirname(posix(indexPath));

    const header = [
        `# Handoff index — ${workspace.name}`,
        "",
        `> Generated from \`${slot}\` by \`node cli/index.mjs\`. Do not edit by hand: it is regenerated`,
        `> and byte-compared, so a hand-edit survives exactly until the next run.`,
        `> ${series.records.length} handoff(s), newest first. No budget: the series is append-only, so`,
        `> the only remedy a budget could ask for is one this project rules out.`,
        "",
    ];

    const entries = series.records.map((r) => {
        const href = path.posix.relative(from, path.posix.join(posix(slot), r.file));
        return `- ${r.date} · [${r.heading}](${href})`;
    });

    return [...header, ...entries].join("\n") + "\n";
}

export function renderScopeIndex(workspace, series) {
    const header = [
        `# Persona memory scopes — ${workspace.name}`,
        "",
        "> Generated from the packs this workspace composes by `node cli/index.mjs`. Do not edit by hand:",
        "> it is regenerated and byte-compared, so a hand-edit survives exactly until the next run.",
        `> ${series.scopes.length} declared scope(s). **Owned and populated only by this workspace.**`,
        "> Each location is empty until earned — the pack declares the scope and carries none of its",
        "> contents. Nothing reads these locations: `doctor` checks a persona against its five-part",
        "> contract as of milestone 7, which is not a check of what is in them.",
        "",
    ];

    // Named, never linked: git carries no empty directory, so a fresh clone has no location to link to.
    const entries = series.scopes.map((s) =>
        `- \`${s.persona}\` · ${s.pack} · \`${s.location}\` · scope \`${scopeDigest(s.scope)}\` — ${firstSentence(s.scope)}`,
    );

    return [...header, ...entries].join("\n") + "\n";
}

const lineCount = (text) => text.split("\n").length - (text.endsWith("\n") ? 1 : 0);

// ---------------------------------------------------------------- the verdict

/** Judge one workspace's indexes: a finding is a red (exit 1), a note never is, and an `IndexError` means it could not judge (exit 2). */
export function inspect(dir, { write = false, packRoots: extraRoots, discoverPacks = false, today = new Date().toISOString().slice(0, 10) } = {}) {
    const manifestPath = path.join(dir, "workspace.json");
    let workspace;
    try {
        workspace = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (cause) {
        throw new IndexError(`cannot read ${manifestPath} — ${cause.message}`);
    }

    const spec = workspace?.portulan?.spec;
    if (!KNOWN_SPECS.has(String(spec))) {
        throw new IndexError(
            `${dir} declares Workspace Definition ${JSON.stringify(spec)}, which this tool does not implement ` +
                `(knows: ${[...KNOWN_SPECS].join(", ")}). Refusing rather than indexing a manifest it may misread`,
        );
    }

    const findings = [];
    const fail = (series, check, message) => findings.push({ severity: "fail", series, check, message });
    const notes = [];
    const note = (series, message) => notes.push({ series, message });

    const remedyFlags = [
        ...(Array.isArray(extraRoots) ? extraRoots.map((r) => ` --pack-root ${r}`) : []),
        ...(discoverPacks ? [" --pack-root auto"] : []),
    ].join("");

    const memory = judgeMemory(dir, workspace, { write, fail, note, today, remedyFlags });
    const handoffs = judgeHandoffs(dir, workspace, { write, fail, remedyFlags });
    const scopes = judgeScopes(dir, workspace, { write, fail, packRoots: extraRoots, discoverPacks, remedyFlags });

    return {
        dir,
        declared: memory.declared || handoffs.declared || scopes.declared,
        series: { memory, handoffs, scopes },
        findings,
        notes,
    };
}

/** Refuse an index sited inside the series it indexes, and return its resolved path. */
function siteOutside(dir, declaredPath, slot, word) {
    const indexPath = path.resolve(dir, declaredPath);
    if (slot && isInside(path.resolve(dir, slot), indexPath)) {
        throw new IndexError(
            `${declaredPath} sits inside the ${word} it indexes (${slot}) — a walk over that directory ` +
                `would count the index as one of its members. Site the index beside the ${word}, not in it`,
        );
    }
    // Here, not where the index is compared, which a judge skips when a record cannot be rendered.
    refuseLinks(dir, declaredPath, indexPath);
    return indexPath;
}

/** Refuse a link in the components the declared path adds; a workspace may itself sit under one, as macOS's `/var` is. */
function refuseLinks(dir, declaredPath, indexPath, rule = "a kept index is a file of its own where its path says") {
    let probe = path.resolve(dir);
    while (!isInside(probe, indexPath)) probe = path.dirname(probe);
    for (const part of path.relative(probe, indexPath).split(path.sep)) {
        probe = path.join(probe, part);
        let stat;
        try {
            stat = fs.lstatSync(probe);
        } catch (cause) {
            if (cause.code === "ENOENT") return;
            throw new IndexError(`cannot look for the index at ${declaredPath} — ${cause.code ?? cause.message}`);
        }
        if (stat.isSymbolicLink()) {
            throw new IndexError(
                `${declaredPath} leads through a link at ${path.relative(path.resolve(dir), probe)}, and ${rule} — ` +
                    "nothing was read or written through it. Replace the link with what it points at",
            );
        }
    }
}

/** Write when asked, then byte-compare; returns whether a copy is kept. An absent index is a red, any other failed read or write an `IndexError`. */
function compareOrWrite({ dir, declaredPath, indexPath, expected, write, series, source, fail, remedyFlags = "", optional = false }) {
    if (optional) {
        try {
            fs.lstatSync(indexPath);
        } catch (cause) {
            if (cause.code === "ENOENT") return false;
            throw new IndexError(`cannot look for the index at ${declaredPath} — ${cause.code ?? cause.message}`);
        }
    }
    if (write) {
        try {
            fs.mkdirSync(path.dirname(indexPath), { recursive: true });
            fs.writeFileSync(indexPath, expected);
        } catch (cause) {
            throw new IndexError(
                `cannot write the index at ${declaredPath} — ${cause.code ?? cause.message}. ` +
                    `Refusing rather than reporting a verdict about the ${source}: this is a fact about the filesystem, ` +
                    `not about the ${source}`,
            );
        }
    }

    let actual = null;
    try {
        actual = fs.readFileSync(indexPath);
    } catch (cause) {
        if (cause.code !== "ENOENT") {
            throw new IndexError(
                `cannot read the index at ${declaredPath} — ${cause.code ?? cause.message}. ` +
                    `Refusing rather than reporting it absent: this is a fact about the filesystem, ` +
                    `not about the ${source}`,
            );
        }
    }

    if (actual === null) {
        fail(series, "index", `${declaredPath} is declared and absent — run \`node cli/index.mjs${remedyFlags} ${dir}\` to generate it`);
    } else if (!actual.equals(Buffer.from(expected, "utf8"))) {
        fail(series, "index", `${declaredPath} is out of date against the ${source} — run \`node cli/index.mjs${remedyFlags} ${dir}\` to regenerate it`);
    }
    return true;
}

function judgeMemory(dir, workspace, { write, fail, note, today, remedyFlags = "" }) {
    const memory = workspace.memory;
    if (!memory) return { declared: false, path: null, expected: null, budgets: 0 };

    const declaredPath = memory.index?.path;
    if (!declaredPath) {
        const store = readStore(dir, workspace);
        return { declared: true, path: null, expected: null, budgets: budgetFindings(memory, store, null, { fail, note, today }) };
    }

    const indexPath = siteOutside(dir, declaredPath, workspace.slots?.memory, "store");
    const store = readStore(dir, workspace);

    let broken = 0;
    for (const r of store.records) {
        if (r.heading && normalize(r.heading) !== normalize(r.title)) {
            broken += 1;
            fail(
                "memory",
                "title",
                `${path.join(workspace.slots.memory, r.file)} carries the heading "${r.heading}", which is not its filename's title ` +
                    `"${r.title}". A record may hold two carriers of its name; it may not hold two answers — ` +
                    "rename the file or reword the heading",
            );
        }
    }
    if (broken) return { declared: true, path: indexPath, expected: null, budgets: 0 };

    const expected = render(workspace, store);
    // Written even over budget: consolidating the store starts from the index.
    compareOrWrite({ dir, declaredPath, indexPath, expected, write, series: "memory", source: "store", fail, remedyFlags });
    const budgets = budgetFindings(memory, store, expected, { fail, note, today });

    return { declared: true, path: indexPath, expected, budgets };
}

function judgeHandoffs(dir, workspace, { write, fail, remedyFlags = "" }) {
    const declaredPath = workspace.handoffs?.index?.path;
    if (!declaredPath) return { declared: false, path: null, expected: null };

    const indexPath = siteOutside(dir, declaredPath, workspace.slots?.handoffs, "series");
    const series = readHandoffs(dir, workspace);

    let broken = 0;
    for (const r of series.records) {
        const where = path.join(workspace.slots.handoffs, r.file);
        if (r.date === null) {
            broken += 1;
            fail(
                "handoffs",
                "date",
                `${where} does not lead with a valid YYYY-MM-DD date, so the index has no date to put on its line. ` +
                    "core/operating/loop.md fixes the form as `YYYY-MM-DD-{slug}.md` — rename the file",
            );
        }
        if (r.heading === null) {
            broken += 1;
            fail(
                "handoffs",
                "title",
                `${where} carries no \`# \` heading on its first non-blank line, so the index has no title to put on its line. ` +
                    "A handoff's title is its H1 — the filename leads with a date and would render as one. Give it a heading",
            );
        }
    }
    if (broken) return { declared: true, path: indexPath, expected: null, count: series.records.length };

    const expected = renderHandoffIndex(workspace, series);
    // Kept only where a copy is on disk; without one, the series is rendered and nothing written or compared.
    const kept = compareOrWrite({ dir, declaredPath, indexPath, expected, write, series: "handoffs", source: "series", fail, remedyFlags, optional: true });

    return { declared: true, path: indexPath, expected, count: series.records.length, kept };
}

function judgeScopes(dir, workspace, { write, fail, packRoots: extraRoots, discoverPacks, remedyFlags = "" }) {
    const declaredPath = workspace.personas?.index?.path;
    if (!declaredPath) return { declared: false, path: null, expected: null };

    const slot = workspace.slots?.personas;
    const indexPath = siteOutside(dir, declaredPath, slot, "layer");
    const series = readScopes(dir, workspace, { packRoots: extraRoots, discoverPacks });

    for (const p of series.unresolved) {
        fail(
            "scopes",
            "pack",
            `\`${p.name}\` is declared in \`packs\` and does not resolve — ${p.why}. ` +
                "A scope cannot land from a pack that is not there; resolve the pack or stop declaring it",
        );
    }
    for (const b of series.broken) {
        fail(
            "scopes",
            "scope",
            `pack \`${b.pack}\` contributes the persona \`${b.persona}\` (${b.file}), which carries no \`## Memory scope\` ` +
                "section — the fourth part of the five-part persona contract (core/personas/README.md). " +
                "There is nothing to land, and this generator will not invent a scope for it",
        );
    }
    for (const c of series.carrying) {
        fail(
            "scopes",
            "contents",
            `pack \`${c.pack}\` carries ${c.file}, which is a memory record. A pack declares a scope and carries ` +
                "**none** of its contents: the store belongs to the adopter's layer (docs/vision.md thesis 6 — " +
                "storage follows ownership). Delete it from the pack",
        );
    }

    if (series.unresolved.length || series.broken.length || series.carrying.length) {
        return { declared: true, path: indexPath, expected: null };
    }

    // An absent layer or location is a fresh clone's state: git carries no empty directory.
    if (slot) {
        const layer = path.resolve(dir, slot);
        const declared = new Set(series.scopes.map((s) => s.persona));
        let present = null;
        try {
            present = fs.readdirSync(layer, { withFileTypes: true });
        } catch (cause) {
            if (cause.code !== "ENOENT") {
                throw new IndexError(
                    `cannot read the persona layer at ${slot} — ${cause.code ?? cause.message}. ` +
                        "Refusing to report that no location is orphaned when the layer could not be enumerated",
                );
            }
        }
        // The read decides absence: `existsSync` is false on EACCES too, and would pass a location nothing could read.
        for (const s of series.scopes) {
            const location = path.resolve(dir, s.location);
            try {
                fs.readdirSync(location);
            } catch (cause) {
                if (cause.code === "ENOENT") continue;
                throw new IndexError(
                    `the persona memory location ${s.location} cannot be read — ${cause.code ?? cause.message}. ` +
                        "Refusing to report it empty: empty is this feature's success state, so an unreadable " +
                        "location reported as empty would read as the design working",
                );
            }
        }

        for (const e of present ?? []) {
            if (e.isDirectory() && declared.has(e.name)) continue;
            const where = path.posix.join(slot.replace(/\/$/, ""), e.name) + (e.isDirectory() ? "/" : "");
            fail(
                "scopes",
                "orphan",
                `${where} is under the persona layer and no composed pack declares it. ` +
                    "This layer holds one directory per declared scope and nothing else — what is not declared is " +
                    "something somebody made, which is exactly what this sweep exists to tell apart from a scope " +
                    "that arrived. Remove it, or compose the pack that declares it",
            );
        }
    }

    const expected = renderScopeIndex(workspace, series);
    compareOrWrite({ dir, declaredPath, indexPath, expected, write, series: "scopes", source: "packs this workspace composes", fail, remedyFlags });

    // After the index, so no location is made for a scope it does not record.
    if (write) {
        for (const s of series.scopes) {
            const location = path.resolve(dir, s.location);
            try {
                fs.mkdirSync(location, { recursive: true });
            } catch (cause) {
                throw new IndexError(
                    `cannot create the persona memory location at ${s.location} — ${cause.code ?? cause.message}. ` +
                        "Refusing rather than reporting a verdict about a landing that did not happen",
                );
            }
        }
    }

    return { declared: true, path: indexPath, expected };
}

const positive = (v) => typeof v === "number" && Number.isInteger(v) && v > 0;

function budgetNumber(value, where) {
    if (value === undefined) return undefined;
    if (!positive(value)) {
        throw new IndexError(
            `${where} is ${JSON.stringify(value)}, which is not a positive integer. A budget that is zero, ` +
                "negative or non-numeric would read as undeclared and switch the rail off in the key that exists to switch it on",
        );
    }
    return value;
}

/** The budget checks, each skipped where undeclared; returns how many were judged, which alone licenses `within budget`. */
function budgetFindings(memory, store, expected, { fail, note, today }) {
    const lines = budgetNumber(memory.index?.budget?.lines, "memory.index.budget.lines");
    const columns = budgetNumber(memory.index?.budget?.columns, "memory.index.budget.columns");
    const kilobytes = budgetNumber(memory.store?.budget?.kilobytes, "memory.store.budget.kilobytes");
    const recordKilobytes = budgetNumber(memory.store?.budget?.record_kilobytes, "memory.store.budget.record_kilobytes");
    const cutoff = budgetDay(memory.store?.budget?.cutoff, "memory.store.budget.cutoff");
    if (cutoff !== undefined && recordKilobytes === undefined) {
        throw new IndexError(
            "memory.store.budget.cutoff is declared with no `record_kilobytes` beside it. A cutoff says which " +
                "records the per-record cap binds, so alone it configures nothing while reading as configured",
        );
    }

    let judged = 0;

    if (expected !== null && lines) {
        judged += 1;
        const count = lineCount(expected);
        if (count > lines) {
            fail(
                "memory",
                "budget",
                `the index is ${count} lines against a budget of ${lines} — over by ${count - lines}. ` +
                    "Consolidate the store: on THIS axis the moves are MERGE two records that are one fact, or RETIRE " +
                    "one whose condition has fired. Compressing a record does not remove its line, and SPLITTING one " +
                    "adds a line — it spends this budget to buy room under `memory.store.budget.record_kilobytes`. Raising the budget in " +
                    "the change that broke it is the one repair core/operating/memory.md rules out",
            );
        }
    }

    if (expected !== null && columns) {
        judged += 1;
        for (const line of expected.split("\n")) {
            if (line.length > columns) {
                fail(
                    "memory",
                    "budget",
                    `an index line is ${line.length} columns against a cap of ${columns}: ${JSON.stringify(line.slice(0, 60) + "…")}. ` +
                        "Shorten the record's filename — the cap exists so one long line cannot absorb what the line budget counts",
                );
                break;
            }
        }
    }

    if (kilobytes) {
        judged += 1;
        const kb = store.bytes / KB;
        if (kb > kilobytes) {
            // Bytes beside the rounded figure: 1025 bytes prints as 1.0 KB, which reads as within a 1 KB budget.
            fail(
                "memory",
                "budget",
                `the store is ${kb.toFixed(1)} KB (${store.bytes} bytes) against a budget of ${kilobytes} KB (${kilobytes * KB} bytes). ` +
                    "This is the axis the index cannot see: record count can hold still while the store grows",
            );
        }
    }

    if (recordKilobytes) {
        judged += 1;
        const cap = recordKilobytes * KB;
        // A day past today (UTC), for an author in a time zone ahead of it.
        const latest = cutoff === undefined ? undefined : nextDay(today);
        const unbound = [];
        for (const record of store.records) {
            if (cutoff !== undefined) {
                if (record.dated === null) {
                    fail(
                        "memory",
                        "date",
                        `the record ${record.file} carries no \`**dated:** YYYY-MM-DD\` line naming a real day, so the per-record cap ` +
                            `cannot tell whether its cutoff (${cutoff}) binds it. Add one: the day the record's text last changed`,
                    );
                    continue;
                }
                if (record.dated > latest) {
                    fail(
                        "memory",
                        "date",
                        `the record ${record.file} is dated ${record.dated}, more than a day after ${today} (UTC). A record is dated ` +
                            "the day its text last changed, and a later date would carry it past a cutoff that binds it. Correct the date",
                    );
                    continue;
                }
                if (record.dated <= cutoff) {
                    if (record.bytes > cap) unbound.push(record);
                    continue;
                }
            }
            if (record.bytes > cap) {
                fail(
                    "memory",
                    "budget",
                    `the record ${record.file} is ${(record.bytes / KB).toFixed(1)} KB (${record.bytes} bytes) against a per-record cap of ` +
                        `${recordKilobytes} KB (${cap} bytes) — over by ${record.bytes - cap}. ` +
                        "Repair it where it is: SPLIT it if it holds more than one fact (which spends `memory.index.budget.lines`, " +
                        "the axis with the headroom), COMPRESS it, or DEMOTE its narrative to the provenance layer; never cut a why. " +
                        (cutoff === undefined
                            ? "Raising the cap in the change that broke it is the one repair core/operating/memory.md rules out"
                            : "Raising the cap, or moving the cutoff, in the change that broke it is the repair core/operating/memory.md rules out"),
                );
            }
        }
        if (unbound.length) {
            note(
                "memory",
                `${unbound.length} record(s) dated on or before the cutoff (${cutoff}) are over the per-record cap of ${recordKilobytes} KB: ` +
                    "reported, never railed. Each meets the cap in the change that next rewrites it",
            );
        }
    }

    return judged;
}

function nextDay(iso) {
    const at = new Date(`${iso}T00:00:00Z`);
    at.setUTCDate(at.getUTCDate() + 1);
    return at.toISOString().slice(0, 10);
}

function budgetDay(value, where) {
    if (value === undefined) return undefined;
    const m = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
    const day = m ? realDay(m[1], m[2], m[3]) : null;
    if (!day) {
        throw new IndexError(
            `${where} is ${JSON.stringify(value)}, which is not a real day written YYYY-MM-DD. A cutoff that cannot be read ` +
                "would bind every record or none, and either would be a verdict the manifest never declared",
        );
    }
    return day;
}

// ---------------------------------------------------------------- changelog fragments

// `docs.sh` refuses the same fragments in bash, so a change to this rule is made there too.
export const CHANGE_SECTIONS = ["added", "changed", "deprecated", "removed", "fixed", "security"];
export const CHANGE_NAME = new RegExp(`^[a-z0-9][a-z0-9-]*\\.(${CHANGE_SECTIONS.join("|")})\\.md$`);

/** Every fragment in `dir` in name order, and what is wrong with any that cannot be pasted; a missing directory holds none. */
export function readChanges(dir) {
    // `readdirSync` follows a link, so the directory itself is refused when it is one.
    let entries = null;
    try {
        if (!fs.lstatSync(dir).isSymbolicLink()) entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (cause) {
        if (cause.code === "ENOENT") return { fragments: [], problems: [] };
        throw new IndexError(`cannot read ${dir} — ${cause.code ?? cause.message}`);
    }
    if (entries === null) {
        throw new IndexError(`${dir} is a link, and fragments are read where they are written — replace it with the directory it points at`);
    }
    const fragments = [];
    const problems = [];
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
        if (!entry.isFile()) {
            // Before the README is skipped, so a README that is a link or a directory is refused too.
            problems.push({ name: entry.name, message: "is not a regular file: a fragment is a file of its own, never a link or a directory" });
            continue;
        }
        if (NOT_A_RECORD.has(entry.name)) continue;
        const match = CHANGE_NAME.exec(entry.name);
        if (!match) {
            problems.push({
                name: entry.name,
                message: `is not a fragment: name it <slug>.<section>.md, the section one of ${CHANGE_SECTIONS.join(", ")}`,
            });
            continue;
        }
        let text;
        try {
            text = fs.readFileSync(path.join(dir, entry.name), "utf8").replace(/\s+$/, "");
        } catch (cause) {
            throw new IndexError(`cannot read ${path.join(dir, entry.name)} — ${cause.code ?? cause.message}`);
        }
        const lines = text.split("\n");
        if (!lines[0].startsWith("- ") || lines.filter((line) => /^\S/.test(line)).length !== 1) {
            problems.push({
                name: entry.name,
                message: "is not one top-level bullet: its first line opens `- `, and every later line is indented or blank",
            });
            continue;
        }
        fragments.push({ name: entry.name, section: match[1], text });
    }
    return { fragments, problems };
}

/** The fragments as the cut pastes them into `CHANGELOG.md`, one directory above `changes/`, so each `](../` loses its `../`. */
export function renderChanges(fragments) {
    const out = [];
    for (const section of CHANGE_SECTIONS) {
        const these = fragments.filter((f) => f.section === section);
        if (these.length === 0) continue;
        out.push(`### ${section[0].toUpperCase()}${section.slice(1)}`, "");
        for (const f of these) out.push(f.text.replaceAll("](../", "]("), "");
    }
    return out.join("\n").trimEnd();
}

function runChanges(dir, check, say) {
    let read;
    try {
        read = readChanges(dir);
    } catch (error) {
        if (!(error instanceof IndexError)) throw error;
        say(`  ✗ ${error.message}`);
        return 2;
    }
    for (const p of read.problems) say(`  ✗ ${path.join(dir, p.name)} ${p.message}`);
    if (read.problems.length) return 1;
    if (read.fragments.length === 0) say(`  · ${dir}: no change fragments`);
    else if (check) say(`  ok ${dir}: ${read.fragments.length} change fragment(s), each one bullet`);
    else say(renderChanges(read.fragments));
    return 0;
}

// ---------------------------------------------------------------- the command

function usage() {
    return [
        "portulan index — regenerate the memory, handoff and scope indexes",
        "",
        "  portulan index [--check] [--pack-root <dir>|auto]... <workspace-dir> [<workspace-dir> ...]",
        "",
        "  portulan index --handoffs <workspace-dir> [<workspace-dir> ...]",
        "  portulan index [--check] --changes <dir>",
        "",
        "  --check       write nothing; exit 1 if any index kept on disk is out of date against its store,",
        "                or a handoff yields no index line. A handoff index with no copy on disk is not kept:",
        "                it is rendered, and nothing is written or compared",
        "  --handoffs    print each workspace's handoff index, whether or not one is kept and however stale a",
        "                kept copy is; exit 1 only when a handoff yields no index line, reported instead",
        "  --pack-root   where declared packs are resolved from; `auto` discovers the host's plugin cache.",
        "                A named root REPLACES every other source. A directory actually named `auto` is `./auto`",
        "  --changes     print the changelog fragments in <dir> grouped by section, as the release cut pastes",
        "                them; each is <slug>.<section>.md holding one top-level bullet. With --check, print",
        "                only the verdict",
        "",
        "What is WRITTEN never records which root answered: an index whose bytes carried that would",
        "regenerate differently on two machines, and `--check` byte-compares every index kept on disk.",
        "",
        "Exit codes: 0 succeeded · 1 a red verdict · 2 could not run.",
    ].join("\n");
}

export function run(argv, say = console.log) {
    // First, so a request for help is never outranked by a complaint about the other arguments.
    if (argv.includes("--help") || argv.includes("-h")) {
        say(usage());
        return 0;
    }
    let check = false;
    const dirs = [];
    const roots = [];
    let discoverPacks = false;
    let changes = null;
    let printHandoffs = false;
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === "--check") check = true;
        else if (argv[i] === "--handoffs") printHandoffs = true;
        else if (argv[i] === "--changes") {
            changes = argv[i + 1];
            i += 1;
            if (changes === undefined || changes.startsWith("-")) {
                say("  ✗ --changes needs the directory the changelog fragments live in — `changes` in this repository");
                return 2;
            }
        } else if (argv[i] === "--pack-root") {
            const dir = argv[i + 1];
            i += 1;
            if (dir === undefined || dir.startsWith("-")) {
                say("  ✗ --pack-root needs a directory, or `auto` to discover one from the host plugin cache. A directory actually named `auto` is `./auto`");
                return 2;
            }
            if (dir === AUTO) discoverPacks = true;
            else roots.push(path.resolve(dir));
        } else if (argv[i].startsWith("-")) {
            say(`  ✗ unknown argument \`${argv[i]}\` — run \`portulan index --help\` or \`node cli/index.mjs --help\` for the flags this tool takes`);
            return 2;
        } else dirs.push(argv[i]);
    }

    if (changes !== null) {
        if (dirs.length || roots.length || discoverPacks || printHandoffs) {
            say("  ✗ --changes prints changelog fragments and judges no workspace — run it on its own");
            return 2;
        }
        return runChanges(changes, check, say);
    }

    if (dirs.length === 0) {
        say("usage: node cli/index.mjs [--check] [--pack-root <dir>|auto]... <workspace-dir> [<workspace-dir> ...]");
        return 2;
    }

    // Refused here too: `rootPlan` runs only for a workspace declaring a scope index, and one without would take both.
    const bothAsked = namedWithAuto(roots, discoverPacks);
    if (bothAsked) {
        say(`  ✗ ${bothAsked}`);
        return 2;
    }

    for (const root of roots) {
        let stat = null;
        try {
            stat = fs.statSync(root);
        } catch (cause) {
            say(`  ✗ --pack-root ${root} cannot be read — ${cause.code ?? cause.message}. Refusing to report a pack unresolvable against a root nothing looked in`);
            return 2;
        }
        if (!stat.isDirectory()) {
            say(`  ✗ --pack-root ${root} is not a directory — a resolution root is a directory packs are looked up under`);
            return 2;
        }
    }

    let worst = 0;
    for (const dir of dirs) {
        let result;
        try {
            result = inspect(dir, { write: !check && !printHandoffs, packRoots: roots.length ? roots : undefined, discoverPacks });
        } catch (error) {
            if (!(error instanceof IndexError)) throw error;
            say(`  ✗ ${dir}: ${error.message}`);
            worst = 2;
            continue;
        }

        if (printHandoffs) {
            // A stale kept copy does not stop the print; a handoff that yields no line does.
            const broken = result.findings.filter((f) => f.series === "handoffs" && f.check !== "index");
            for (const f of broken) say(`  ✗ ${dir}: ${f.message}`);
            if (broken.length && worst < 1) worst = 1;
            else if (!result.series.handoffs.declared) say(`  · ${dir}: declares no handoff index`);
            else if (!broken.length) say(result.series.handoffs.expected.trimEnd());
            continue;
        }
        if (!result.declared) {
            say(`  · ${dir}: declares no index`);
            continue;
        }
        for (const f of result.findings) say(`  ✗ ${dir}: ${f.message}`);
        for (const n of result.notes) say(`  · ${dir}: ${n.message}`);
        if (result.findings.length && worst < 1) worst = 1;
        if (!result.findings.length) {
            const state = check ? "current" : "written";
            const parts = [];
            if (result.series.memory.declared) {
                const memory = result.series.memory;
                if (memory.path === null) {
                    parts.push(memory.budgets ? "no store index declared; store within budget" : "no store index declared");
                } else {
                    parts.push(memory.budgets ? `store index ${state}, within budget` : `store index ${state}`);
                }
            }
            if (result.series.handoffs.declared) {
                const { kept, count } = result.series.handoffs;
                parts.push(kept ? `handoff index ${state}` : `handoff index renders, ${count} handoff(s), none kept on disk`);
            }
            if (result.series.scopes.declared) parts.push(`scope index ${state}`);
            say(`  ok ${dir}: ${parts.join("; ")}`);
        }
    }

    return worst;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exit(run(process.argv.slice(2)));
}
