// `form` — which form a consumer's records and boot are in, and the files that move them to the new one.
//
// Nothing here writes: callers write the texts it returns through their own guards.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { BOOT_CARD_LINE, BOOT_CARD_UNIT, GUIDANCE_RULES_DIR, leadsOfText } from "./compile.mjs";
import { CHANGE_SECTIONS, readChanges, renderChanges } from "./index.mjs";
import { instructionsState, shellWord, splitCommand } from "./instructions.mjs";
import { recipeSet } from "./recipe-set.mjs";

/** Anything that means the form could not be read. Carries no verdict. */
export class FormError extends Error {}

export const CHANGES_DIR = "changes";
export const CHANGES_README = `${CHANGES_DIR}/README.md`;

export const CHANGELOG = "CHANGELOG.md";

export const COMPILED_CARD = `${GUIDANCE_RULES_DIR}/${BOOT_CARD_UNIT}.md`;

const SESSION_LOG = /^(#{1,6})[ \t]+Session log[ \t]*#*[ \t]*$/;

const UNRELEASED = /^##[ \t]+\[?Unreleased\]?[ \t]*$/i;

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

// ------------------------------------------------------------------------- the new form's files, as texts

export function changesReadme() {
    return `# Changelog fragments

One file per entry for the next release, so two open changes never edit the same lines. Name each
\`<slug>.<section>.md\`, the section one of ${CHANGE_SECTIONS.slice(0, -1).join(", ")} or ${CHANGE_SECTIONS.at(-1)}, and write one top-level
bullet, with any link relative to this directory. \`portulan index --changes changes\` prints them grouped,
with their links moved up one directory, as the release cut pastes them under the new version in
\`../${CHANGELOG}\`. The cut then deletes them and keeps this file, so the directory stays tracked.

The entries \`portulan upgrade\` moved here from the changelog's Unreleased are named
\`<n>-<slug>.<section>.md\`, numbered in the changelog's order and padded to one width, since the cut reads
fragments by name: they print as the changelog held them, but for an entry that did not open \`- \`, whose
fragment does, and ahead of any fragment named by its slug.
`;
}

export function changelogPointer() {
    return [
        `Each entry for the next release is a file in [\`${CHANGES_DIR}/\`](${CHANGES_DIR}/), so two open changes never edit the`,
        `same lines; \`portulan index --changes ${CHANGES_DIR}\` prints them as the cut pastes them.`,
    ];
}

export function sessionLogPointer({ date, sha, file }) {
    return [
        `Retired ${date}: a change's record is its commit message, and \`git log --first-parent\` lists what`,
        `landed. The entries written until then are at \`git show ${sha}:${file}\`.`,
    ];
}

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

export function handoffIndexIgnore(rel, workspaceRel) {
    return [
        `# The handoff index is printed on demand (\`portulan index --handoffs ${workspaceRel}\`), never kept: a`,
        "# committed copy conflicts on every merge that adds a handoff, and carries nothing the series does not.",
        `/${rel}`,
    ];
}

export function withIgnoreLines(text, lines) {
    const have = new Set((text ?? "").split(/\r?\n/).map((l) => l.trim()));
    const patterns = lines.filter((l) => !l.startsWith("#"));
    if (patterns.every((l) => have.has(l))) return text ?? "";
    const base = text ?? "";
    const sep = base === "" ? "" : base.endsWith("\n\n") ? "" : base.endsWith("\n") ? "\n" : "\n\n";
    return `${base}${sep}${lines.join("\n")}\n`;
}

export const COMMENTS_RECIPE = "comments";

export function commentsRecipeOf(manifest) {
    const own = recipeSet(manifest, { packs: [] });
    const recipe = own.ok ? own.recipes.find((entry) => entry.id === COMMENTS_RECIPE) : undefined;
    if (!recipe) return null;
    return /(?:^|\/)verify\/comments\.sh'?$/.test(recipe.run) ? { drafted: true } : { drafted: false, run: recipe.run };
}

export function commentsRecipeEntry(workspaceRel) {
    const run = shellWord(workspaceRel === "." ? "./verify/comments.sh" : `./${workspaceRel}/verify/comments.sh`);
    return { id: COMMENTS_RECIPE, run, requires: ["bash", "git", "node"] };
}

export function commentsRecipe({ bundle, limit, toTree }) {
    const entry = JSON.stringify(`${bundle}/cli/index.mjs`);
    return `#!/usr/bin/env bash
# Comments rail: no more comment lines record a change's history than LIMIT. A comment is paid for on
# every read of its file, and a change's history goes in its commit message, so LIMIT is only lowered.
# Code not written here, vendored, is left out with \`--exclude <dir>/\` on the \`node\` line.
#
#   exit 0   green: the count is within LIMIT
#   exit 1   red: it is over, and the lines are listed
#   exit 2   could not run: git, node or the Portulan CLI is not reachable from here. NEVER a pass.

set -uo pipefail
cd -- "\$(dirname -- "\$0")"/${shellWord(toTree)} || exit 2

LIMIT=${limit}

for need in git node; do
    command -v "\$need" >/dev/null 2>&1 || {
        printf 'verify: %s is needed and is not on PATH, so the comments were NOT counted.\\n' "\$need" >&2
        exit 2
    }
done

if [ -n "\${PORTULAN_CLI:-}" ]; then
    cli=\$PORTULAN_CLI
elif command -v portulan >/dev/null 2>&1 &&
    entry=\$(node -e 'process.stdout.write(require("node:fs").realpathSync(process.argv[1]))' "\$(command -v portulan)") &&
    [ -f "\$(dirname -- "\$entry")/comments.mjs" ]; then
    cli=\$(dirname -- "\$entry")
elif [ -f ${entry} ]; then # portulan:bundle-fallback
    cli=\$(dirname -- ${entry}) # portulan:bundle-fallback
else
    printf 'verify: the Portulan CLI is not reachable, so the comments were NOT counted. Looked at\\n' >&2
    printf 'verify: $PORTULAN_CLI, a portulan on PATH holding comments.mjs, and the bundle this workspace was drafted from.\\n' >&2
    exit 2
fi
if [ ! -f "\$cli/comments.mjs" ]; then
    printf 'verify: %s holds no comments.mjs, so the comments were NOT counted.\\n' "\$cli" >&2
    exit 2
fi

node "\$cli/comments.mjs" --limit "\$LIMIT"
status=\$?
[ "\$status" -le 2 ] && exit "\$status"
printf 'verify: comments.mjs exited %s, which is no verdict, so the comments were NOT counted.\\n' "\$status" >&2
exit 2
`;
}

// ------------------------------------------------------------------------- git

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

/** The `.gitignore` lines that let git see the compiled guidance, none where it already can; `git` false where no git answered. */
export function claudeRulesUnignore(root, git = gitIn(root)) {
    if (git === null) return { lines: [], git: false };
    const ignored = (rel) => {
        const out = git("check-ignore", "-q", "--no-index", rel);
        if (out.status !== 0 && out.status !== 1) throw new FormError(`git check-ignore could not answer for ${rel} — ${out.stderr.trim() || `exit ${out.status}`}`);
        return out.status === 0;
    };
    if (!ignored(COMPILED_CARD)) return { lines: [], git: true };
    const lines = ["# `portulan compile` writes this repository's boot card and guidance to .claude/rules/portulan/, reviewed", "# like code; everything else the host keeps under .claude/ stays ignored."];
    // Git re-includes nothing below an excluded directory, and answers reliably for a file, not a directory: each level is probed with one.
    if (ignored(".claude/portulan-probe")) lines.push("!/.claude/", "/.claude/*");
    if (ignored(".claude/rules/portulan-probe") || lines.length > 2) lines.push("!/.claude/rules/", "/.claude/rules/*");
    lines.push("!/.claude/rules/portulan/", "!/.claude/rules/portulan/*");
    return { lines, git: true };
}

export function cardIgnored(root, git = gitIn(root)) {
    if (git === null) return false;
    return git("check-ignore", "-q", "--no-index", COMPILED_CARD).status === 0;
}

// ------------------------------------------------------------------------- which workspaces a step moving the form reads

export function notYetForm(ws, ctx) {
    const declared = ws.manifest?.portulan?.spec;
    const major = Number(String(declared).split(".")[0]);
    if (major === ctx?.spec?.major) return null;
    return `this workspace declares ${declared}, and a step moving the form reads ${ctx?.spec?.major}.x: a version step moves it first`;
}

// ------------------------------------------------------------------------- the Session log

/** Whether each of `lines` is fenced code, fence lines included; a fence closes on its character whatever length it opened with. */
export function fenced(lines) {
    let fence = null;
    return lines.map((line) => {
        const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
        if (!marker) return fence !== null;
        fence = fence === null ? marker[1][0] : marker[1][0] === fence ? null : fence;
        return true;
    });
}

export function sessionLogSections(text) {
    const lines = text.split("\n");
    const found = [];
    const code = fenced(lines);
    for (let i = 0; i < lines.length; i += 1) {
        if (code[i]) continue;
        const heading = SESSION_LOG.exec(lines[i]);
        if (!heading) continue;
        const level = heading[1].length;
        let end = i + 1;
        for (; end < lines.length; end += 1) {
            if (!code[end] && /^(#{1,6})[ \t]/.exec(lines[end]) && /^(#{1,6})/.exec(lines[end])[1].length <= level) break;
        }
        const body = lines.slice(i + 1, end);
        const first = body.find((l) => l.trim() !== "");
        found.push({ line: i + 1, start: i, end, entries: first !== undefined && !first.startsWith("Retired ") });
    }
    return found;
}

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

/** Every `.md` file under `root` on disk, never through a link; of the dot-directories, only the way down to `keep` is walked. */
export function markdownOnDisk(root, keep = null) {
    const out = [];
    const walk = (dir, rel, narrow) => {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (cause) {
            if (cause.code === "ENOENT" || cause.code === "ENOTDIR") return;
            throw new FormError(`${dir} could not be listed — ${cause.code ?? cause.message}`);
        }
        for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
            const r = rel ? `${rel}/${e.name}` : e.name;
            const toward = keep !== null && (r === keep || keep.startsWith(`${r}/`));
            if (narrow && !toward) continue;
            if (e.isDirectory()) {
                if (e.name === "node_modules" || e.name === ".git") continue;
                if (e.name.startsWith(".") && !toward) continue;
                walk(path.join(dir, e.name), r, r !== keep && (narrow || e.name.startsWith(".")));
            } else if (e.isFile() && e.name.endsWith(".md")) out.push(r);
        }
    };
    walk(root, "", false);
    return out;
}

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

// ------------------------------------------------------------------------- the changelog's Unreleased section, as fragments

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

/** Each relative link one directory deeper, as a fragment under `changes/` needs: `renderChanges` takes one `../` off again. */
function rerooted(text) {
    return text.replace(/\]\(([^)\s]*)/g, (whole, target) => (target === "" || /^(?:[a-z][a-z0-9+.-]*:|#|\/|<)/i.test(target) ? whole : `](../${target}`));
}

/** The Unreleased entries as fragments, and the changelog without them; null where it has no Unreleased heading. */
export function unreleasedFragments(text, taken = new Set()) {
    const lines = text.split("\n");
    const { start, end, code } = unreleasedSpan(lines);
    if (start === -1) return null;

    const entries = [];
    const kept = [];
    let section = "changed";
    for (let i = start + 1; i < end; i += 1) {
        const line = lines[i];
        if (code[i]) {
            kept.push({ line, heading: false });
            continue;
        }
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
            const body = [line.replace(/^[-*+][ \t]/, "- ")];
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

/** 1-based lines of the Unreleased entries not opening `- `, which the move rewrites, since the cut refuses any other opening. */
export function unreleasedRewrites(text) {
    const lines = text.split("\n");
    const { start, end, code } = unreleasedSpan(lines);
    const found = [];
    for (let i = start + 1; start !== -1 && i < end; i += 1) if (!code[i] && BULLET.test(lines[i]) && !lines[i].startsWith("- ")) found.push(i + 1);
    return found;
}

export function unreleasedCount(text) {
    const lines = text.split("\n");
    const { start, end, code } = unreleasedSpan(lines);
    if (start === -1) return null;
    let n = 0;
    for (let i = start + 1; i < end; i += 1) if (!code[i] && BULLET.test(lines[i])) n += 1;
    return n;
}

function unreleasedSpan(lines) {
    const code = fenced(lines);
    const start = lines.findIndex((l, i) => !code[i] && UNRELEASED.test(l));
    let end = start + 1;
    while (start !== -1 && end < lines.length && (code[end] || !/^##[ \t]/.test(lines[end]))) end += 1;
    return { start, end, code };
}

// ------------------------------------------------------------------------- the boot card

/** The card's section on reading and the cache: `compile` expands `READING_LINE` into the installed engine's rules. */
export const READING_TITLE = "Reading and the cache: Portulan's `core/operating/context.md`";
export const READING_LINE = "<!-- engine: operating/context.md#every-request-pays-for-what-the-session-has-read -->";

const HEAD_BEFORE_READING = /^(> Compiled by `portulan compile` from .+\. Each section names its file): an(\r?\n)> import is here in full; open any other file when its subject is your task\.$/m;

export const HEAD_BEFORE_READING_SHOWN =
    '"> Compiled by `portulan compile` from <the card>. Each section names its file: an" over ' +
    '"> import is here in full; open any other file when its subject is your task."';

export function carriesReading(card) {
    return card.split(/\r?\n/).includes(READING_LINE);
}

/** A card drafted before the reading section, rewritten as `draftCard` writes it now; null where it has the section or another head. */
export function withReading(card) {
    if (carriesReading(card)) return null;
    const head = HEAD_BEFORE_READING.exec(card);
    if (!head) return null;
    const [old, opening, eol] = head;
    const moved = [`${opening}, and an`, "> import is here in full.", "", `## ${READING_TITLE}`, "", READING_LINE].join(eol);
    return card.slice(0, head.index) + moved + card.slice(head.index + old.length);
}

function leadsFit(text, name) {
    if (text === null) return false;
    try {
        leadsOfText(text, name, "card");
        return true;
    } catch {
        return false;
    }
}

/** The boot card, `context/boot.md`: each fact imported, or written out by `compile`, from the file that holds it, never copied. */
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
        `> Compiled by \`portulan compile\` from ${shown("context/boot.md")}. Each section names its file, and an`,
        "> import is here in full.",
    ];
    const section = (title, ...body) => out.push("", `## ${title}`, "", ...body);
    const whole = (rel, why) => (inTree(rel) ? [imported(rel)] : [`Read ${shown(rel)} in full at boot: ${why}.`]);

    section(READING_TITLE, READING_LINE);

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
        'Close a change with `git add <new files> && node <plugin root>/cli/finish.mjs -m "<subject>" -m "<why>"` after writing its changelog entry, a one-bullet file `changes/<slug>.<section>.md`: it commits and pushes only when every verify recipe passes.',
        ...(slots.handoffs ? [`A session ending with work not committed and pushed leaves a dated handoff in ${shown(slots.handoffs)}.`] : []),
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

// ------------------------------------------------------------------------- which form a consumer is in

/** Why the handoff index at `rel` is kept, as `spec/migrations/0003` judges it: `{ kept: null }` where it is not, null where git cannot say. */
function indexKept(tree, rel, onDisk) {
    const git = gitIn(tree);
    const rule = git === null ? null : git("check-ignore", "-q", "--no-index", "--", rel);
    if (rule === null || (rule.status !== 0 && rule.status !== 1)) return null;
    if (rule.status === 1) return { kept: `is not git-ignored${onDisk ? ", and a copy is kept" : ""}` };
    const tracked = onDisk && git("ls-files", "--error-unmatch", "--", rel).status === 0;
    return { kept: tracked ? "is git-ignored and still tracked" : null };
}

/** Each piece of the form, read from disk as `doctor` reads: `new` or `today`, with `hand` where `upgrade` does not place it. */
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

    const logs = sessionLogsIn(tree, markdownOnDisk(tree, posix(path.relative(tree, wsDir)) || null));
    add("session-log", logs.length ? "today" : "new", logs.length ? `a Session log with entries in ${logs.map((l) => l.file).join(", ")}` : "no Session log with entries");

    const index = manifest?.handoffs?.index?.path;
    if (typeof index === "string") {
        const at = path.resolve(wsDir, index);
        const rel = posix(path.relative(tree, at));
        if (rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)) {
            const judged = indexKept(tree, rel, present(at));
            if (judged?.kept) add("handoff-index", "today", `the handoff index at ${index} ${judged.kept}`);
            else if (judged) add("handoff-index", "new", "the handoff index is printed on demand, not kept");
        }
    }

    if (manifest?.kind === "repository") {
        const context = manifest?.slots?.context;
        if (typeof context !== "string") {
            add("card", "today", "no boot card: `slots.context` is undeclared");
        } else {
            const source = readOrNull(path.resolve(wsDir, context, `${BOOT_CARD_UNIT}.md`));
            if (source === null) add("card", "new", "no boot card, by choice: `slots.context` holds no `boot` unit");
            else if (withReading(source) !== null) add("card", "today", "a boot card drafted before it carried the engine's rules on reading and the cache");
            else if (!carriesReading(source)) {
                pieces.push({ id: "card", state: "today", hand: true, text: `a boot card without the engine's rules on reading and the cache, whose head \`upgrade\` does not recognise: add a section holding the line \`${READING_LINE}\`` });
            } else if (readOrNull(path.join(tree, COMPILED_CARD)) !== null) add("card", "new", "a compiled boot card");
            else if ((readOrNull(path.join(tree, "AGENTS.md")) ?? "").split(/\r?\n/).includes(BOOT_CARD_LINE)) add("card", "new", "a boot card at the head of AGENTS.md, which this host reads");
            else add("card", "today", `a boot card not yet compiled to ${COMPILED_CARD}: run \`portulan compile\``);
        }
        const marked = instructionsState(tree, (rel) => readOrNull(path.join(tree, ...rel.split("/"))));
        if (marked.files.length) {
            const files = marked.files.join(" and ");
            const count = (n) => `${n} section${n === 1 ? "" : "s"}`;
            const gone = marked.gone.length ? `, and ${marked.gone.join(", ")}, named by a marker, ${marked.gone.length === 1 ? "is" : "are"} not there` : "";
            const pending = `${count(marked.pending)} of ${files} marked to move to on-read units${gone}`;
            if (marked.linked.length) {
                const one = marked.linked.length === 1;
                const links = `${marked.linked.join(" and ")} ${one ? "is a link" : "are links"}`;
                pieces.push({ id: "instructions", state: "today", hand: true, text: `${pending}, and ${links}, whose sections the split does not move: make ${one ? "it" : "each"} a file of its own, or take the marks out` });
            } else if (marked.pending) add("instructions", "today", pending);
            else add("instructions", "new", `${count(marked.moved)} of ${files} moved to on-read units${gone}`);
        }
        if (gitIn(tree) !== null) {
            const recipe = commentsRecipeOf(manifest);
            if (recipe?.drafted) add("comments", "new", "a `comments` recipe holding the comments that record a change's history");
            else if (recipe) pieces.push({ id: "comments", state: "today", hand: true, text: `the \`comments\` recipe runs ${recipe.run}, not a \`verify/comments.sh\`: rename it, so \`upgrade\` can draft the one that counts the comments recording a change's history` });
            else add("comments", "today", "no `comments` recipe: nothing counts the comments that record a change's history");
        }
    }
    return { tree, pieces };
}

/** `doctor`'s one line for the form: a report, never a verdict, since today's form boots as it did. */
export function formLine(workspaceDir, manifest, { over = false } = {}) {
    const { tree, pieces } = formOf(workspaceDir, manifest);
    if (tree === null) return "not reported: this workspace declares no tree, so no repository's records or boot are its own";
    const today = pieces.filter((p) => p.state === "today");
    if (today.length === 0) return `the new form: ${pieces.map((p) => p.text).join("; ")}`;
    const rel = path.relative(process.cwd(), path.resolve(workspaceDir));
    const shown = rel === "" ? "." : rel.startsWith("..") ? path.resolve(workspaceDir) : rel;
    const moves = today.some((p) => p.hand) ? "moves all but what is named to add by hand" : "moves it";
    const said = `today's form in ${today.length} of ${pieces.length}: ${today.map((p) => p.text).join("; ")} — `;
    if (over && today.some((p) => p.id === "instructions" && !p.hand)) {
        const rest = today.filter((p) => p.id !== "instructions");
        const after = rest.length === 0 ? "" : `, and \`portulan upgrade --write ${shellWord(shown)}\` ${rest.some((p) => p.hand) ? "moves the rest but what is named to add by hand" : "moves the rest"} once it runs`;
        return `${said}\`${splitCommand(shown)}\` moves the marked sections, since \`portulan upgrade\` does not run over a breached budget${after}, and until then it boots as it did`;
    }
    return `${said}\`portulan upgrade --write ${shellWord(shown)}\` ${moves}, and until then it boots as it did`;
}
