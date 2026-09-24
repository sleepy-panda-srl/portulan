// `form` — which form a consumer's records and boot are in, and the files that move them to the new one.
//
// Portulan moved its own records and boot on 2026-09-23 and 24: a change's why lives in its commit
// message, a changelog entry is a fragment under `changes/`, the handoff index is printed on demand
// rather than kept, the Session log is retired to a pointer, and the boot is a card the host loads into
// every context. This module carries the same to a repository that installs Portulan. `init` drafts it,
// `vendor` carries it, the steps in `../spec/migrations/` move an existing consumer to it, and `doctor`
// reports which form a consumer is in. They read one definition of the new form, here, so the four
// cannot disagree about it.
//
// **Today's form stays legitimate.** A consumer that declares no card boots as it did, through the boot
// skill's steps, and nothing here fails a consumer for being in today's form: `doctor` reports it, and
// `upgrade` moves it when asked.
//
// Nothing here writes. It reads a tree and returns texts, and its callers write them through their own
// guards: `init`'s refusal to overwrite, `vendor`'s staging, `upgrade`'s snapshots and rollback.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { BOOT_CARD_LINE, BOOT_CARD_UNIT, GUIDANCE_RULES_DIR, leadsOfText } from "./compile.mjs";
import { CHANGE_SECTIONS, readChanges, renderChanges } from "./index.mjs";

/** Anything that means the form could not be read. Carries no verdict. */
export class FormError extends Error {}

/** Where a consumer's changelog fragments live, relative to its tree, and the file that keeps the directory. */
export const CHANGES_DIR = "changes";
export const CHANGES_README = `${CHANGES_DIR}/README.md`;

/** The changelog, at the tree's root, where `init`, `upgrade` and a release cut look for it. */
export const CHANGELOG = "CHANGELOG.md";

/** Where the compiled card lands, relative to the tree: the rule `compile` writes for the `boot` unit. */
export const COMPILED_CARD = `${GUIDANCE_RULES_DIR}/${BOOT_CARD_UNIT}.md`;

/** A heading whose text is exactly `Session log`, at any level. */
const SESSION_LOG = /^(#{1,6})[ \t]+Session log[ \t]*#*[ \t]*$/;

/** The Unreleased heading of a changelog, bare or bracketed as Keep a Changelog writes it. */
const UNRELEASED = /^##[ \t]+\[?Unreleased\]?[ \t]*$/i;

/** A top-level bullet, in any of the three markers Markdown takes. */
const BULLET = /^[-*+][ \t]/;

const posix = (p) => p.split(path.sep).join("/");

/** Whether anything is at `file`, a link included: `lstat`, never `existsSync`, which follows one. */
function present(file) {
    try {
        fs.lstatSync(file);
        return true;
    } catch (cause) {
        if (cause.code === "ENOENT" || cause.code === "ENOTDIR") return false;
        throw new FormError(`${file} could not be examined — ${cause.code ?? cause.message}`);
    }
}

function readOrNull(file) {
    try {
        return fs.readFileSync(file, "utf8");
    } catch (cause) {
        if (cause.code === "ENOENT" || cause.code === "ENOTDIR") return null;
        throw new FormError(`${file} could not be read — ${cause.code ?? cause.message}`);
    }
}

// ===========================================================================================
// The files the new form holds, as texts
// ===========================================================================================

/** `changes/README.md`, as a consumer's copy says it: the rule for a fragment, and what the cut does. */
export function changesReadme() {
    return `# Changelog fragments

One file per entry for the next release, so two open changes never edit the same lines. Name each
\`<slug>.<section>.md\`, the section one of ${CHANGE_SECTIONS.slice(0, -1).join(", ")} or ${CHANGE_SECTIONS.at(-1)}, and write one top-level
bullet, with any link relative to this directory. \`portulan index --changes changes\` prints them grouped,
with their links moved up one directory, as the release cut pastes them under the new version in
\`../${CHANGELOG}\`. The cut then deletes them and keeps this file, so the directory stays tracked.

The entries \`portulan upgrade\` moved here from the changelog's Unreleased are named
\`<n>-<slug>.<section>.md\`, numbered in the changelog's order and padded to one width, since the cut reads
fragments by name: they print as the changelog held them, and ahead of any fragment named by its slug.
`;
}

/** What `## Unreleased` holds once its entries are fragments. */
export function changelogPointer() {
    return [
        `Each entry for the next release is a file in [\`${CHANGES_DIR}/\`](${CHANGES_DIR}/), so two open changes never edit the`,
        `same lines; \`portulan index --changes ${CHANGES_DIR}\` prints them as the cut pastes them.`,
    ];
}

/** What a Session log's section holds once it is retired: the two lines Portulan's own log holds. */
export function sessionLogPointer({ date, sha, file }) {
    return [
        `Retired ${date}: a change's record is its commit message, and \`git log --first-parent\` lists what`,
        `landed. The entries written until then are at \`git show ${sha}:${file}\`.`,
    ];
}

/** The handoff series' README, drafted from the engine's `core/templates/handoff.md`: open work only. */
export function handoffsReadme() {
    return `# Handoffs

A handoff carries work still open, so the next session starts from where things stand. Write one only
when a session ends with work not committed and pushed: committed work carries its why in its commit
message, and needs none. Name it \`YYYY-MM-DD-<slug>.md\`, keep only the parts that have something to say,
and five lines is a valid handoff. Drafted from the engine's \`core/templates/handoff.md\`.

**State.** Where things stand: what is committed, and what is in progress and uncommitted.

**Open questions.** What is undecided, and who decides it.

**Next action.** The single next step, concrete enough to start from cold.

**Recoverability.** Anything left in a partial state, and how to make it safe.
`;
}

/** The lines that keep a handoff index off the record, for an index at `rel` from the tree's root. */
export function handoffIndexIgnore(rel, workspaceRel) {
    return [
        `# The handoff index is printed on demand (\`portulan index --handoffs ${workspaceRel}\`), never kept: a`,
        "# committed copy conflicts on every merge that adds a handoff, and carries nothing the series does not.",
        `/${rel}`,
    ];
}

/**
 * `text` with `lines` appended as one block, unless each of them that is a pattern is already a line of it.
 * Returns the text unchanged when nothing is owed, so a caller can tell whether a write is.
 */
export function withIgnoreLines(text, lines) {
    const have = new Set((text ?? "").split(/\r?\n/).map((l) => l.trim()));
    const patterns = lines.filter((l) => !l.startsWith("#"));
    if (patterns.every((l) => have.has(l))) return text ?? "";
    const base = text ?? "";
    const sep = base === "" ? "" : base.endsWith("\n\n") ? "" : base.endsWith("\n") ? "\n" : "\n\n";
    return `${base}${sep}${lines.join("\n")}\n`;
}

// ===========================================================================================
// Git, where a piece needs it: whether a path is ignored, and which commit last held a file
// ===========================================================================================

/**
 * Run git in `root`. `null` where git is not installed or `root` is not inside a work tree, which a caller
 * turns into its own answer: a tree without git ignores nothing, and has no commit to point at.
 */
export function gitIn(root) {
    const run = (...args) => {
        const out = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
        if (out.error) return { status: null, stdout: "", stderr: String(out.error.code ?? out.error.message) };
        return { status: out.status, stdout: out.stdout, stderr: out.stderr };
    };
    const probe = run("rev-parse", "--is-inside-work-tree");
    if (probe.status !== 0 || probe.stdout.trim() !== "true") return null;
    return run;
}

/**
 * The `.gitignore` lines that let git see the compiled guidance, or none where it already can.
 *
 * A consumer's `.gitignore` often ignores `.claude/`, which is where a host keeps its local session
 * state, and the compiled card then never reaches review or a fresh checkout. Git re-includes nothing
 * below an excluded directory, so the lines re-include the directory and exclude its other entries again,
 * from the shallowest level that is excluded: everything else under `.claude/` stays ignored as it was.
 * Probed with `git check-ignore` on a file at each level, since a directory's own answer is not reliable.
 *
 * @returns {{ lines: string[], git: boolean }} `git` false where no git answered, and nothing is owed
 */
export function claudeRulesUnignore(root, git = gitIn(root)) {
    if (git === null) return { lines: [], git: false };
    const ignored = (rel) => {
        const out = git("check-ignore", "-q", "--no-index", rel);
        if (out.status !== 0 && out.status !== 1) throw new FormError(`git check-ignore could not answer for ${rel} — ${out.stderr.trim() || `exit ${out.status}`}`);
        return out.status === 0;
    };
    if (!ignored(COMPILED_CARD)) return { lines: [], git: true };
    const lines = ["# `portulan compile` writes this repository's boot card and guidance to .claude/rules/portulan/, reviewed", "# like code; everything else the host keeps under .claude/ stays ignored."];
    if (ignored(".claude/portulan-probe")) lines.push("!/.claude/", "/.claude/*");
    if (ignored(".claude/rules/portulan-probe") || lines.length > 2) lines.push("!/.claude/rules/", "/.claude/rules/*");
    lines.push("!/.claude/rules/portulan/", "!/.claude/rules/portulan/*");
    return { lines, git: true };
}

/** Whether git still ignores the compiled card under `text` as the tree's `.gitignore`: a check after writing. */
export function cardIgnored(root, git = gitIn(root)) {
    if (git === null) return false;
    return git("check-ignore", "-q", "--no-index", COMPILED_CARD).status === 0;
}

// ===========================================================================================
// Which workspaces a step that moves the form reads
// ===========================================================================================

/**
 * Why a step in `../spec/migrations/` that moves the form does not read this workspace yet, or null. It
 * reads a workspace at the bundle's MAJOR: one behind is moved by a version step first, and in the same
 * run the step is asked again once it has been, so a workspace no version step reaches stays refused.
 */
export function notYetForm(ws, ctx) {
    const declared = ws.manifest?.portulan?.spec;
    const major = Number(String(declared).split(".")[0]);
    if (major === ctx?.spec?.major) return null;
    return `this workspace declares ${declared}, and a step moving the form reads ${ctx?.spec?.major}.x: a version step moves it first`;
}

// ===========================================================================================
// The Session log
// ===========================================================================================

/**
 * The Session log sections in a Markdown text: each heading whose text is exactly `Session log`, the
 * section running to the next heading of its level or above, and whether it holds entries. A section
 * whose first line of text opens `Retired ` is the pointer a retirement leaves, and an empty one holds
 * nothing to retire. Fenced code is skipped, so a log quoted in a code block is not one.
 */
export function sessionLogSections(text) {
    const lines = text.split("\n");
    const found = [];
    let fence = null;
    for (let i = 0; i < lines.length; i += 1) {
        const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(lines[i]);
        if (marker) {
            fence = fence === null ? marker[1][0] : marker[1][0] === fence ? null : fence;
            continue;
        }
        if (fence !== null) continue;
        const heading = SESSION_LOG.exec(lines[i]);
        if (!heading) continue;
        const level = heading[1].length;
        let end = i + 1;
        let inner = null;
        for (; end < lines.length; end += 1) {
            const m = /^\s{0,3}(`{3,}|~{3,})/.exec(lines[end]);
            if (m) inner = inner === null ? m[1][0] : m[1][0] === inner ? null : inner;
            if (inner === null && /^(#{1,6})[ \t]/.exec(lines[end]) && /^(#{1,6})/.exec(lines[end])[1].length <= level) break;
        }
        const body = lines.slice(i + 1, end);
        const first = body.find((l) => l.trim() !== "");
        found.push({ line: i + 1, start: i, end, entries: first !== undefined && !first.startsWith("Retired ") });
    }
    return found;
}

/** `text` with each Session log that holds entries retired to the pointer, and nothing else changed. */
export function retireSessionLogs(text, pointer) {
    const sections = sessionLogSections(text).filter((s) => s.entries);
    if (sections.length === 0) return text;
    const lines = text.split("\n");
    for (const s of [...sections].reverse()) {
        const tail = s.end < lines.length ? [""] : lines.at(-1) === "" ? [""] : [];
        lines.splice(s.start + 1, s.end - s.start - 1, "", ...pointer, ...tail);
    }
    return lines.join("\n");
}

/**
 * The Markdown files of a tree as they sit on disk, for a reader that does not ask git: every `.md` file,
 * never through a link, skipping `.git`, `node_modules` and the dot-directories a host or a tool keeps,
 * though not the workspace's own. `doctor` reads these; `upgrade` reads git's tracked list instead.
 */
export function markdownOnDisk(root, keep = null) {
    const out = [];
    const walk = (dir, rel) => {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (cause) {
            if (cause.code === "ENOENT" || cause.code === "ENOTDIR") return;
            throw new FormError(`${dir} could not be listed — ${cause.code ?? cause.message}`);
        }
        for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
            const r = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) {
                if (e.name === "node_modules" || e.name === ".git") continue;
                if (e.name.startsWith(".") && r !== keep) continue;
                walk(path.join(dir, e.name), r);
            } else if (e.isFile() && e.name.endsWith(".md")) out.push(r);
        }
    };
    walk(root, "");
    return out;
}

/** Of `files` (paths relative to `root`), those holding a Session log with entries, each with its first line. */
export function sessionLogsIn(root, files) {
    const found = [];
    for (const rel of files) {
        const text = readOrNull(path.join(root, ...rel.split("/")));
        if (text === null || !text.includes("Session log")) continue;
        const logs = sessionLogSections(text).filter((s) => s.entries);
        if (logs.length) found.push({ file: rel, line: logs[0].line });
    }
    return found;
}

// ===========================================================================================
// The changelog's Unreleased section, as fragments
// ===========================================================================================

/** A fragment's slug from its bullet's first line: the first words, as a file name can hold them. */
function slugOf(bullet) {
    const words = bullet
        .split("\n")[0]
        .replace(/^[-*+][ \t]+/, "")
        .replace(/\]\([^)]*\)/g, "]")
        .replace(/[`*_[\]]/g, "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
    let slug = "";
    for (const w of words) {
        if (slug.length + w.length + 1 > 48) break;
        slug = slug ? `${slug}-${w}` : w;
    }
    return slug || "entry";
}

/**
 * Every relative link target in a bullet moved one directory down, as a fragment under `changes/` needs
 * it: `renderChanges` takes one `../` off each `](../`, so this adds one to each link a reader would
 * resolve from the changelog's directory. A URL, an anchor and a root path stay as they are.
 */
function rerooted(text) {
    return text.replace(/\]\(([^)\s]*)/g, (whole, target) => (target === "" || /^(?:[a-z][a-z0-9+.-]*:|#|\/|<)/i.test(target) ? whole : `](../${target}`));
}

/**
 * The entries under a changelog's Unreleased heading, each as the fragment that carries it, and the
 * changelog as it reads once they are gone.
 *
 * A top-level bullet with its indented lines is one entry, filed under the `### Section` above it, or
 * under `changed` where there is none. Prose that is not a bullet stays where it is, and a section heading
 * stays while anything is left under it. The fragments are named `<nn>-<slug>.<section>.md`, numbered in
 * the changelog's order, so the cut prints each section's entries in the order they were written, and
 * the move is proved before it is offered: the fragments, read and rendered as the cut renders them,
 * print each entry back as the changelog held it.
 *
 * @returns {null | { refused: string } | { fragments: Array<{ name: string, text: string }>, next: string }}
 * null where there is no Unreleased heading
 */
export function unreleasedFragments(text, taken = new Set()) {
    const lines = text.split("\n");
    const start = lines.findIndex((l) => UNRELEASED.test(l));
    if (start === -1) return null;
    let end = start + 1;
    while (end < lines.length && !/^##[ \t]/.test(lines[end])) end += 1;

    const entries = [];
    const kept = [];
    let section = "changed";
    for (let i = start + 1; i < end; i += 1) {
        const line = lines[i];
        const sub = /^###[ \t]+(.+?)[ \t]*$/.exec(line);
        if (sub) {
            const named = sub[1].toLowerCase();
            if (!CHANGE_SECTIONS.includes(named)) {
                return { refused: `${CHANGELOG} line ${i + 1}: \`${line}\` under Unreleased is none of ${CHANGE_SECTIONS.join(", ")}, so its entries have no fragment name — rename the heading or move them, then upgrade` };
            }
            section = named;
            kept.push({ line, heading: true });
            continue;
        }
        if (BULLET.test(line)) {
            const body = [`- ${line.replace(/^[-*+][ \t]+/, "")}`];
            let j = i + 1;
            while (j < end && (/^[ \t]+\S/.test(lines[j]) || (lines[j].trim() === "" && j + 1 < end && /^[ \t]+\S/.test(lines[j + 1])))) {
                body.push(lines[j]);
                j += 1;
            }
            entries.push({ section, text: body.join("\n").replace(/\s+$/, ""), original: [line, ...lines.slice(i + 1, j)].join("\n").replace(/\s+$/, "") });
            i = j - 1;
            continue;
        }
        kept.push({ line, heading: false });
    }
    if (entries.length === 0) return { fragments: [], next: text };

    const width = String(entries.length).length;
    const fragments = entries.map((e, n) => {
        let name = `${String(n + 1).padStart(width, "0")}-${slugOf(e.text)}.${e.section}.md`;
        for (let k = 2; taken.has(name); k += 1) name = `${String(n + 1).padStart(width, "0")}-${slugOf(e.text)}-${k}.${e.section}.md`;
        return { name, section: e.section, text: `${rerooted(e.text)}\n`, original: e };
    });

    // The proof: what the cut would print, section by section, is each entry as the changelog held it,
    // its marker aside, which a fragment always writes `- `. In the order the cut reads them, by name.
    const byName = [...fragments].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const printed = renderChanges(byName.map((f) => ({ name: f.name, section: f.section, text: f.text.replace(/\s+$/, "") })));
    for (const section of CHANGE_SECTIONS) {
        const want = entries.filter((e) => e.section === section).map((e) => e.text);
        if (want.length === 0) continue;
        const block = printed.split(/^### /m).find((b) => b.toLowerCase().startsWith(`${section}\n`));
        const got = (block ?? "").split("\n").slice(1).join("\n").trim();
        if (got !== want.join("\n\n")) {
            return { refused: `the Unreleased entries under ${section} would not print back as ${CHANGELOG} holds them once moved to fragments — move them by hand, then upgrade` };
        }
    }

    // What stays: prose, and a section heading only while something is left under it.
    const rest = [];
    for (let k = 0; k < kept.length; k += 1) {
        if (kept[k].heading) {
            const until = kept.findIndex((x, m) => m > k && x.heading);
            const under = kept.slice(k + 1, until === -1 ? kept.length : until);
            if (!under.some((x) => x.line.trim() !== "")) continue;
        }
        rest.push(kept[k].line);
    }
    while (rest.length && rest[0].trim() === "") rest.shift();
    while (rest.length && rest.at(-1).trim() === "") rest.pop();
    const body = ["", ...changelogPointer(), "", ...(rest.length ? [...rest, ""] : [])];
    const next = [...lines.slice(0, start + 1), ...body, ...lines.slice(end)].join("\n");
    return { fragments: fragments.map((f) => ({ name: f.name, text: f.text })), next };
}

/** How many entries a changelog holds under Unreleased, or null where it has no such heading. */
export function unreleasedCount(text) {
    const lines = text.split("\n");
    const start = lines.findIndex((l) => UNRELEASED.test(l));
    if (start === -1) return null;
    let n = 0;
    for (let i = start + 1; i < lines.length && !/^##[ \t]/.test(lines[i]); i += 1) if (BULLET.test(lines[i])) n += 1;
    return n;
}

// ===========================================================================================
// The boot card, drafted from the consumer's own workspace
// ===========================================================================================

/**
 * Whether a file's lead sentences can be written onto the card: its first list, every item opening with a
 * bold lead and none carrying a link, read by the reader `compile` writes them out with.
 */
function leadsFit(text, name) {
    if (text === null) return false;
    try {
        leadsOfText(text, name, "card");
        return true;
    } catch {
        return false;
    }
}

/**
 * A boot card for a workspace, drafted from its own files: `context/boot.md`, the always unit named `boot`.
 *
 * **Every fact on it comes from one source.** A file the boot read whole is imported whole, so the card
 * holds no copy: the identity, the memory index, the repo card where there is one. A file whose first list
 * carries bold leads gives the card those leads, written out by `compile` and byte-compared, with a line
 * saying when to read the rest: the principles, and the definition of done. One without them is imported
 * whole. The gate policy's gates are written out by tier from the policy by `compile`'s `gates` line. So
 * the card says no less than the boot it replaces, which read each of these files in full, and it moves
 * when they move: a change to any of them is drift until the card is recompiled.
 *
 * What the card cannot import is named with when to read it: a file outside the tree, which the host
 * would not load, and the gate map, whose conditions an act a gate names needs and a boot does not.
 *
 * @param {object} manifest the workspace's manifest, with `slots.context` not yet declared
 * @param {(rel: string) => string | null} read a workspace-relative file's text, or null where absent
 * @param {{ workspace: string, inTree: (rel: string) => boolean, repoCards?: string[] }} where the
 * workspace as the tree names it (`.portulan`), whether a workspace-relative path stays inside the tree,
 * and the names of the cards in the `repos` slot, less `.md`
 */
export function draftCard(manifest, read, { workspace, inTree, repoCards = [] }) {
    const slots = manifest.slots ?? {};
    const shown = (rel) => `\`${posix(path.posix.normalize(`${workspace}/${rel}`))}\``;
    const imported = (rel) => `@../${rel}`;
    const out = [
        "---",
        "tier: always",
        "---",
        "",
        BOOT_CARD_LINE,
        "",
        `> Compiled by \`portulan compile\` from ${shown("context/boot.md")}. Each section names its file: an`,
        "> import is here in full; open any other file when its subject is your task.",
    ];
    const section = (title, ...body) => out.push("", `## ${title}`, "", ...body);
    const whole = (rel, why) => (inTree(rel) ? [imported(rel)] : [`Read ${shown(rel)} in full at boot: ${why}.`]);

    if (slots.identity) section(`Identity: ${shown(slots.identity)}`, ...whole(slots.identity, "it lies outside this repository, where no import reaches"));
    if (slots.principles) {
        const fits = leadsFit(read(slots.principles), slots.principles);
        section(
            `Principles: ${shown(slots.principles)}`,
            ...(fits ? [`<!-- leads: ../${slots.principles} -->`, "", "Each has its reason there: read it before you set one aside."] : whole(slots.principles, "it lies outside this repository")),
        );
    }
    if (slots.constitution) {
        section(`Constitution: ${shown(slots.constitution)}`, ...whole(slots.constitution, "it lies outside this repository, where no import reaches"));
    }
    if (typeof manifest.gates === "string" || slots.gates) {
        const policy = typeof manifest.gates === "string" && read(manifest.gates) !== null ? manifest.gates : null;
        const body = [];
        if (policy) body.push(`<!-- gates: ../${policy} -->`, "");
        if (slots.gates) {
            body.push(
                policy
                    ? `**Open ${shown(slots.gates)} before an act a gate names**: it holds each gate's conditions, and where no layer enforces one, so you hold it yourself.`
                    : `Read ${shown(slots.gates)} in full at boot: this workspace declares no gate policy for the card to list.`,
            );
        }
        if (body.length === 0) body.push(`${shown(manifest.gates)} could not be read when this card was drafted: \`portulan doctor\` names why.`);
        section(`Gates: ${shown(policy ?? slots.gates ?? manifest.gates)}`, ...body);
    }
    if (slots.dod) {
        const fits = leadsFit(read(slots.dod), slots.dod);
        section(
            `Done: ${shown(slots.dod)}`,
            "On core's floor: a green verify, and nothing reported done that you could not explain.",
            ...(fits ? ["Read the file before you call work done.", "", `<!-- leads: ../${slots.dod} -->`] : ["", ...whole(slots.dod, "it lies outside this repository")]),
        );
    }
    if (slots.repos) {
        const only = repoCards.length === 1 ? `${slots.repos.replace(/\/?$/, "/")}${repoCards[0]}.md` : null;
        section(
            only ? `This repository: ${shown(only)}` : `This repository: its card in ${shown(slots.repos)}`,
            ...(only && inTree(only) ? [imported(only)] : [`Read the card in ${shown(slots.repos)} that names this repository before you build, test or run anything here.`]),
        );
    }
    section(
        "Records",
        "A change's why is its commit message, and its changelog entry a one-bullet file `changes/<slug>.<section>.md`.",
        `A session ending with work not committed and pushed leaves a dated handoff in ${shown(slots.handoffs ?? "handoffs/")}.`,
    );
    section(
        "What is enforced here, and what is not",
        `- **The verify recipes are real**: ${shown("workspace.json")} declares them, and a session's end runs`,
        "  the default; each exits 0 green, 1 red or 2 could not run, never a pass.",
        "- **Gates are enforced where `portulan compile` has written `.claude/settings.json`**; without it, you",
        "  hold every rule yourself.",
        ...(Array.isArray(manifest.packs) && manifest.packs.length
            ? ["- **A pack is resolved by a step of its own**: read the plugin's `skills/portulan/packs.md` before", "  you say what one delivers."]
            : []),
    );
    const index = manifest.memory?.index?.path;
    if (typeof index === "string" && read(index) !== null && inTree(index)) {
        section("Memory: the rules this team minted from its incidents", "Each record carries its provenance; open one when its title touches your task.", "", imported(index));
    }
    return `${out.join("\n")}\n`;
}

// ===========================================================================================
// Which form a consumer is in
// ===========================================================================================

/**
 * Each piece of the form, read from disk: `new`, `today`, or absent where it does not apply. A piece of a
 * repository's own, its changelog, Session log, handoff index and card, applies only where the workspace
 * declares a tree, and the card only to a `repository` workspace, as the steps in `../spec/migrations/`
 * that move them are owed only there.
 *
 * **Read without git, as `doctor` reads everything**, so a report may say less than `upgrade` knows: the
 * Session log is looked for in the tree's Markdown on disk rather than in git's tracked files, and the
 * handoff index counts as not kept where the root `.gitignore` names it, whatever a nested one or a
 * global exclude says. Where the two differ, `upgrade`, which asks git, is the one that moves anything.
 *
 * @returns {{ tree: string | null, pieces: Array<{ id: string, state: "new" | "today", text: string }> }}
 */
export function formOf(workspaceDir, manifest) {
    const pieces = [];
    const add = (id, state, text) => pieces.push({ id, state, text });
    const wsDir = path.resolve(workspaceDir);
    const tree = typeof manifest?.tree === "string" ? path.resolve(wsDir, manifest.tree) : null;
    if (tree === null) return { tree, pieces };

    const changelog = readOrNull(path.join(tree, CHANGELOG));
    const fragments = present(path.join(tree, CHANGES_README));
    if (changelog !== null || fragments) add("changes", fragments ? "new" : "today", fragments ? `changelog fragments in ${CHANGES_DIR}/` : `no ${CHANGES_README}`);
    const entries = changelog === null ? null : unreleasedCount(changelog);
    if (entries) add("changelog", "today", `${CHANGELOG} holds ${entries} entr${entries === 1 ? "y" : "ies"} under Unreleased`);
    else if (entries === 0) add("changelog", "new", `no entry under ${CHANGELOG}'s Unreleased`);

    const logs = sessionLogsIn(tree, markdownOnDisk(tree, posix(path.relative(tree, wsDir)).split("/")[0] || null));
    add("session-log", logs.length ? "today" : "new", logs.length ? `a Session log with entries in ${logs.map((l) => l.file).join(", ")}` : "no Session log with entries");

    const index = manifest?.handoffs?.index?.path;
    if (typeof index === "string") {
        const at = path.resolve(wsDir, index);
        const rel = posix(path.relative(tree, at));
        if (rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)) {
            const ignore = readOrNull(path.join(tree, ".gitignore"));
            const named = ignore !== null && ignore.split(/\r?\n/).some((line) => line.trim() === `/${rel}` || line.trim() === rel);
            add(
                "handoff-index",
                named ? "new" : "today",
                named ? "the handoff index is printed on demand, not kept" : `the handoff index at ${index} is not git-ignored${present(at) ? ", and a copy is kept" : ""}`,
            );
        }
    }

    if (manifest?.kind === "repository") {
        const context = manifest?.slots?.context;
        if (typeof context !== "string") {
            add("card", "today", "no boot card: `slots.context` is undeclared");
        } else {
            const source = readOrNull(path.resolve(wsDir, context, `${BOOT_CARD_UNIT}.md`));
            if (source === null) add("card", "new", "no boot card, by choice: `slots.context` holds no `boot` unit");
            else if (readOrNull(path.join(tree, COMPILED_CARD)) !== null) add("card", "new", "a compiled boot card");
            // A host that reads `AGENTS.md` boots from the card `vendor --host` writes at its head, and has
            // no rules for `compile` to write: there, the card is in the new form as it stands.
            else if ((readOrNull(path.join(tree, "AGENTS.md")) ?? "").split(/\r?\n/).includes(BOOT_CARD_LINE)) add("card", "new", "a boot card at the head of AGENTS.md, which this host reads");
            else add("card", "today", `a boot card not yet compiled to ${COMPILED_CARD}: run \`portulan compile\``);
        }
    }
    return { tree, pieces };
}

/** `doctor`'s one line for the form: a report, never a verdict, since today's form boots as it did. */
export function formLine(workspaceDir, manifest) {
    const { tree, pieces } = formOf(workspaceDir, manifest);
    if (tree === null) return "not reported: this workspace declares no tree, so no repository's records or boot are its own";
    const today = pieces.filter((p) => p.state === "today");
    if (today.length === 0) return `the new form: ${pieces.map((p) => p.text).join("; ")}`;
    // Relative where that is shorter to read, as `doctor` names a workspace, and absolute over a ladder of `../`.
    const rel = path.relative(process.cwd(), path.resolve(workspaceDir));
    const shown = rel === "" ? "." : rel.startsWith("..") ? path.resolve(workspaceDir) : rel;
    return (
        `today's form in ${today.length} of ${pieces.length}: ${today.map((p) => p.text).join("; ")} — ` +
        `\`portulan upgrade --write ${shown}\` moves it, and until then it boots as it did`
    );
}
