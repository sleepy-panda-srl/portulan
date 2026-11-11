#!/usr/bin/env node
// `vendor` — materialise a workspace where it is needed, in either direction.
//
// Refuse an existing file, refuse any link at or below the destination or in the source, and treat only ENOENT as absent.
// Exit 0 done · 1 `doctor` red at an end · 2 could not run.

import fs from "node:fs";
import {createHash,randomUUID} from "node:crypto";
import {isInside} from "./inside.mjs";
import {atomicWrite,guardedRemove} from "./guidance-files.mjs";
import {assertNoSourceJournal,SOURCE_JOURNAL} from "./instructions-journal.mjs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { agentsMdGuidance, BOOT_CARD_UNIT, CompileError, compileGuidance, GENERATED_DIRS, guidanceUnits, ownedNestedFiles } from "./compile.mjs";
import { changesReadme, CHANGES_README, handoffIndexIgnore, withIgnoreLines } from "./form.mjs";
import { inspect } from "./doctor.mjs";
import { AUTO, namedWithAuto } from "./discover.mjs";
import { recipeSet } from "./recipe-set.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Everything that means `vendor` could not run. Carries no verdict about a workspace. */
export class VendorError extends Error {}

export const RESIDENCES = new Set(["in-repo", "feed-side"]);

export const LEAVE = new Set(["pointer", "nothing"]);

/** The Workspace Definition version written; 2.7 is the first with pointers. */
const SPEC = "2.7";

let SCHEMA_ERROR = null;
const SLUG = (() => {
    try {
        const file = path.join(HERE, "..", "spec", "workspace.schema.json");
        return new RegExp(JSON.parse(fs.readFileSync(file, "utf8")).$defs.slug.pattern);
    } catch (error) {
        SCHEMA_ERROR = error;
        return null;
    }
})();

const GOVERNING_KINDS = ["repository", "demo", "portfolio"];

const GENERATED = new Set(GENERATED_DIRS);

const isGenerated = (rel) => GENERATED.has(rel.split("/")[0]);

// ------------------------------------------------------------------------- the command line

const VALUED = new Set(["--into", "--residence", "--leave", "--host", "--kind", "--feed", "--pack-root", "--repo-root"]);

export function parseArgs(argv) {
    const out = {
        help: false,
        source: null,
        into: null,
        residence: null,
        switching: false,
        leave: null,
        host: null,
        kindOf: null,
        feed: null,
        dryRun: false,
        packRoots: [],
        discoverPacks: false,
        repoRoots: [],
        given: new Set(),
    };
    const positional = [];

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--help" || arg === "-h") {
            out.help = true;
            continue;
        }
        if (arg === "--switch") {
            out.switching = true;
            out.given.add("--switch");
            continue;
        }
        if (arg === "--dry-run") {
            out.dryRun = true;
            out.given.add("--dry-run");
            continue;
        }
        if (!arg.startsWith("-")) {
            positional.push(arg);
            continue;
        }
        if (!VALUED.has(arg)) {
            throw new VendorError(
                `unknown option \`${arg}\` — run \`portulan vendor --help\` for the ones this understands, ` +
                    `or \`node cli/vendor.mjs --help\` from a checkout`,
            );
        }
        const value = argv[i + 1];
        if (value === undefined || value.startsWith("-")) {
            throw new VendorError(`\`${arg}\` needs a value and the next argument is \`${value ?? "(nothing)"}\` — refusing to read a flag as one`);
        }
        if (value.trim() === "") {
            throw new VendorError(`\`${arg}\` was given an empty value, and no option here has a meaningful empty value`);
        }
        // Matched raw, so `./auto` still names a directory.
        if (arg === "--pack-root") {
            if (value === AUTO) out.discoverPacks = true;
            else out.packRoots.push(value);
        }
        else if (arg === "--repo-root") out.repoRoots.push(value);
        else out[{ "--into": "into", "--residence": "residence", "--leave": "leave", "--host": "host", "--kind": "kindOf", "--feed": "feed" }[arg]] = value;
        out.given.add(arg);
        i += 1;
    }

    if (positional.length > 1) {
        throw new VendorError(
            `${positional.length} source directories given (${positional.join(", ")}) — \`vendor\` materialises one workspace, ` +
                `and picking one of two would be choosing which one gets moved`,
        );
    }
    // Refused here, not left to `doctor`, so it reads as a command-line error rather than a verdict on the copy.
    const bothAsked = namedWithAuto(out.packRoots, out.discoverPacks === true);
    if (bothAsked) throw new VendorError(bothAsked);
    out.source = positional[0] ?? null;
    return out;
}

// ------------------------------------------------------------------------- the residence, and the two keys

/** Keyed on `tree` alone, never on `kind`: a manifest where the two disagree is `doctor`'s to report. */
export function residenceOf(manifest) {
    return manifest?.tree === undefined ? "feed-side" : "in-repo";
}

/** Changes exactly two keys, `kind` and `tree`, and keeps every other key in its order. */
export function retarget(manifest, residence, kindOf = null, tree = "../") {
    if (kindOf !== null && !GOVERNING_KINDS.includes(kindOf)) {
        throw new VendorError(
            `\`--kind ${kindOf}\` is not a kind a workspace can be materialised as — the three are ${GOVERNING_KINDS.join(", ")}. ` +
                `\`pointer\` is what a switch LEAVES BEHIND, never what it materialises: a pointer governs nothing, so ` +
                `materialising one would be a switch that moved a workspace to nowhere`,
        );
    }
    const out = {};
    for (const [key, value] of Object.entries(manifest)) {
        if (key === "tree") continue;
        out[key] = value;
    }
    if (residence === "in-repo") {
        out.kind = kindOf ?? "repository";
        out.tree = tree;
    } else {
        // A `demo` already declares no `tree`, so it moves feed-side as a demo.
        out.kind = kindOf ?? (manifest.kind === "demo" ? "demo" : "portfolio");
    }
    return out;
}

export function escapingSlots(manifest, dir) {
    const root = path.resolve(dir);
    const out = [];
    for (const [slot, value] of Object.entries(manifest?.slots ?? {})) {
        if (typeof value !== "string") continue;
        const resolved = path.resolve(root, value);
        if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) out.push({ slot, value, resolved });
    }
    return out;
}

// ------------------------------------------------------------------------- reading the source

/** Every ordinary file under `dir`, with its mode; throws a `VendorError` on a link, a special file, or anything unreadable. */
export function walk(dir) {
    return scan(dir).files;
}

/** Every directory under `dir`, empty ones included: a declared slot may be an empty directory. */
export function directories(dir) {
    return scan(dir).dirs;
}

function scan(dir) {
    const root = path.resolve(dir);
    const out = [];
    const dirs = [];
    const seen = (rel) => (rel === "" ? root : path.join(root, rel));

    const descend = (rel, depth) => {
        if (depth > 64) throw new VendorError(`\`${rel}\` is more than 64 directories deep — refusing to walk further rather than looping`);
        let entries;
        try {
            entries = fs.readdirSync(seen(rel));
        } catch (cause) {
            throw new VendorError(`${seen(rel)} could not be read — ${cause.code ?? cause.message}. Only a missing path means "nothing there"`);
        }
        for (const entry of entries.sort()) {
            const childRel = rel === "" ? entry : `${rel}/${entry}`;
            let stat;
            try {
                stat = fs.lstatSync(seen(childRel));
            } catch (cause) {
                if (cause.code === "ENOENT") continue;
                throw new VendorError(`${seen(childRel)} could not be examined — ${cause.code ?? cause.message}. An unanswerable question is not an absence`);
            }
            if (stat.isSymbolicLink()) {
                throw new VendorError(
                    `\`${childRel}\` is a symlink, and this refuses to copy through one. A resolved link materialises a file from ` +
                        `outside the workspace and records it as part of the workspace — the escape that cost \`init\` nine files ` +
                        `written into an unrelated directory, arriving here by the read path. Replace the link with a real file`,
                );
            }
            if (stat.isDirectory()) {
                dirs.push({ rel: childRel, mode: stat.mode & 0o777 });
                descend(childRel, depth + 1);
                continue;
            }
            if (!stat.isFile()) {
                throw new VendorError(`\`${childRel}\` is neither a file nor a directory, and this copies neither by guessing at it`);
            }
            out.push({ rel: childRel, mode: stat.mode & 0o777 });
        }
    };

    descend("", 0);
    return { files: out, dirs };
}

// ------------------------------------------------------------------------- writing into somebody's tree

/** The steps from `root` down to `target`, both included: a link above `root`, such as macOS's `/var`, is the user's own. */
function chain(target, root) {
    const steps = [];
    let at = path.resolve(target);
    const stop = path.resolve(root);
    for (let i = 0; i < 64; i += 1) {
        steps.push(at);
        if (at === stop) break;
        const up = path.dirname(at);
        if (up === at) break;
        at = up;
    }
    return steps.reverse();
}

/** Destination paths that cannot be written: already there, behind a link, or in a state that could not be read. */
export function collisions(destDir, rels, { lstat = fs.lstatSync, allow = new Set() } = {}) {
    const found = [];
    for (const rel of rels) {
        const target = path.join(destDir, rel);
        for (const step of chain(target, destDir)) {
            let stat;
            try {
                stat = lstat(step);
            } catch (cause) {
                // Nothing can exist below an absent path, so the rest of the chain is clear.
                if (cause.code === "ENOENT") break;
                found.push({ rel, path: step, why: `${step} could not be examined (${cause.code ?? cause.message})` });
                break;
            }
            if (stat.isSymbolicLink()) {
                found.push({ rel, path: step, why: `${step} is a symlink, and writing through it would leave the tree` });
                break;
            }
            if (step === target) {
                if (stat.isDirectory()) {
                    found.push({ rel, path: step, why: `${step} is a directory, and a file has to be written there` });
                    break;
                }
                // Before `allow`: the carve-out exempts replacing a file, never a FIFO, a socket or a device.
                if (!stat.isFile()) {
                    found.push({ rel, path: step, why: `${step} is neither a file nor a directory, and this reads and writes neither by guessing at it` });
                    break;
                }
                if (allow.has(rel)) break;
                found.push({ rel, path: step, why: "already exists" });
                break;
            }
            if (step !== target && !stat.isDirectory()) {
                found.push({ rel, path: step, why: `${step} is in the way and is not a directory` });
                break;
            }
        }
    }
    return found;
}

/** What a switch's destination may already hold: a pointer naming the incoming workspace, and its README. */
function carveOut(destDir, incomingName) {
    const manifestPath = path.join(destDir, "workspace.json");

    // `lstat` before any read: `readdirSync` and `readFileSync` follow links out of the named tree.
    for (const step of [destDir, manifestPath]) {
        let stat;
        try {
            stat = fs.lstatSync(step);
        } catch (cause) {
            if (cause.code === "ENOENT") return { allow: new Set(), pointer: null };
            throw new VendorError(`${step} could not be examined — ${cause.code ?? cause.message}. Only a missing path means "nothing there"`);
        }
        if (stat.isSymbolicLink()) {
            throw new VendorError(
                `${step} is a symlink, and this refuses to read a manifest through one as firmly as it refuses to write ` +
                    `through one. A manifest reached that way describes some other directory, so any verdict about this ` +
                    `destination drawn from it would be about somewhere else. Replace the link with a real directory`,
            );
        }
    }

    let entries;
    try {
        entries = fs.readdirSync(destDir);
    } catch (cause) {
        if (cause.code === "ENOENT") return { allow: new Set(), pointer: null };
        throw new VendorError(`${destDir} could not be read — ${cause.code ?? cause.message}. Only a missing path means "nothing there"`);
    }
    if (entries.length === 0) return { allow: new Set(), pointer: null };

    let manifest = null;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (cause) {
        if (cause.code !== "ENOENT") {
            throw new VendorError(
                `${manifestPath} could not be read as a manifest — ${cause.code ?? cause.message}. Refusing to write over a manifest ` +
                    `it cannot understand: a corrupt policy layer is the case where overwriting costs the most and this tool knows the least`,
            );
        }
    }
    if (manifest === null || manifest.kind !== "pointer") {
        return { allow: new Set(), pointer: null };
    }
    if (manifest.governed_by?.workspace !== incomingName) {
        // Quoted with `JSON.stringify` in both arms: the value comes from a manifest nobody validated.
        const declared = typeof manifest.governed_by?.workspace === "string" && manifest.governed_by.workspace.trim() !== "";
        throw new VendorError(
            declared
                ? `${destDir} carries a pointer naming ${JSON.stringify(manifest.governed_by.workspace)} as its governor, and the ` +
                      `workspace being moved in is \`${incomingName}\`. That is a foreign residence, not this switch's other half — ` +
                      `a repository is governed by exactly one workspace, and materialising over a pointer aimed somewhere else would ` +
                      `take governance from a workspace that never agreed to give it up`
                : `${destDir} carries a pointer whose governor is unusable (${JSON.stringify(manifest.governed_by?.workspace)}), and the ` +
                      `workspace being moved in is \`${incomingName}\`. That is a malformed pointer rather than a foreign residence, ` +
                      `and materialising over it would overwrite a manifest nobody can read as consent — fix or remove the pointer, ` +
                      `and run this again`,
        );
    }
    const extra = entries.filter((e) => e !== "workspace.json" && e !== "README.md").sort();
    if (extra.length) {
        throw new VendorError(
            `${destDir} holds ${extra.map((e) => `\`${e}\``).join(", ")} beside the pointer. A switch may land on a pointer — that ` +
                `is the old residence's own half — and on nothing else: those files are somebody's, and nothing here overwrites a ` +
                `file you wrote. Move them aside and run this again`,
        );
    }
    return { allow: new Set(entries), pointer: manifest };
}

// ------------------------------------------------------------------------- what a pointer says

function display(target) {
    const rel = path.relative(process.cwd(), target);
    return rel && !rel.startsWith("..") && rel.length < target.length ? rel : target;
}

function pointerName(residenceDir) {
    const base = path.basename(residenceDir);
    const source = base.startsWith(".") ? path.basename(path.dirname(residenceDir)) : base;
    const slug = String(source).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (slug === "" || !SLUG.test(slug)) {
        throw new VendorError(
            `\`${source}\` yields no usable name for the pointer left at ${display(residenceDir)} — a pointer is a manifest and its ` +
                `\`name\` has to be a slug. Rename the directory, or switch with \`--leave nothing\``,
        );
    }
    return slug;
}

function pointerManifest(residenceDir, governor, feed) {
    return {
        portulan: { spec: SPEC },
        name: pointerName(residenceDir),
        // Residence-agnostic: a pointer is left in a repository or in a retired feed slot.
        summary: `Governed by the \`${governor}\` workspace, which resides elsewhere. This directory holds a pointer and no policy layer of its own.`,
        kind: "pointer",
        governed_by: feed ? { workspace: governor, feed } : { workspace: governor },
    };
}

function pointerReadme(governor, feed, movedTo) {
    return `# This workspace lives elsewhere now

A **pointer**, not a workspace. It records one fact: the \`${governor}\` workspace governs here${feed ? `, and ships through the \`${feed}\` feed` : ""}.

\`portulan vendor --switch\` moved it to \`${movedTo}\` and left this behind. A repository is governed by
**exactly one** workspace — its own full workspace, or a pointer to the workspace that names it, never
both — so what is left here carries no slots, no verify recipes and no gate policy.

**Nothing here resolves the pointer for you.** Reading it and fetching it are different things, and only
the first is built: \`doctor\` reports the governor this names, and finding that workspace on this
machine is a separate question.

To move it back, run the switch in the other direction rather than deleting this and writing a workspace
by hand — the window between those two is a repository governed by nothing, which looks exactly like one
that never adopted Portulan.
`;
}

function arrivedReadme(name) {
    return `# ${name} — resident here

This repository carried a **pointer** until \`portulan vendor --switch\` materialised the \`${name}\`
workspace into it. The pointer's own README said this repository's workspace lived elsewhere; it does
not, and a false sentence left behind in somebody's tree is worse than no sentence at all.

Every file beside this one came from the workspace as it stood at the other residence — byte for byte,
except \`workspace.json\`, whose \`kind\` and \`tree\` are the two keys a residence actually changes.

**Compiled host enforcement did not come with it.** \`compile\` writes host settings from this
workspace's gate policy, and no copy of files produces them. Run \`portulan compile\` here.
`;
}

// ------------------------------------------------------------------------- the vendored standards file

/** `AGENTS.md` for a host that is not Claude Code, naming only what the manifest declares. */
export function agentsMd(manifest, host, kernel = null, guidance = null) {
    const card = guidance?.units.find((u) => u.name === BOOT_CARD_UNIT) ?? null;
    const lines = [
        `# AGENTS.md — ${manifest.name}`,
        "",
        `> ${manifest.summary ?? "A Portulan workspace, vendored as standards."}`,
        "",
        `Vendored by \`portulan vendor --host ${host}\` from the \`${manifest.name}\` workspace. This file and the`,
        "`.portulan/` directory beside it are the whole of it: no plugin, no marketplace, no second repository in",
        ...(card
            ? [
                  "the trust path. The card below is this team's boot, and the engine's kernel ends this file: an agent on",
                  "this host reads both, and opens a file the card names when that file's subject is the task.",
              ]
            : ["the trust path. An agent on this host reads the files named below and works this team's way."]),
        "",
    ];
    let cardText = null;
    if (card) {
        [cardText] = agentsMdGuidance({ ...guidance, units: [card] }, `.portulan/${manifest.slots.context}`).inline;
        lines.push(cardText.trimEnd(), "", "## The workspace's files, opened when the card or the task sends you to one", "");
    } else {
        lines.push("## Read these, in this order", "");
    }
    const GLOSS = {
        identity: "who this team is, the stack, and the glossary",
        principles: "the rules that are this team's rather than everyone's",
        gates: "which concrete actions are Auto, Propose, Gated or Prohibited",
        dod: "what *done* means here, beyond a green verify",
        constitution: "the team's ground truth, which outranks everything else here",
        context: "this team's guidance, one unit per file in its load tier; *Guidance* below carries the always tier and names the rest",
    };
    if (card) {
        GLOSS.context = guidance.units.length > 1
            ? "this team's guidance, one unit per file in its load tier: the card above is its boot, and *Guidance* below carries the rest of the always tier and names the others"
            : "this team's guidance: the card above is its boot";
    }
    const slots = Object.entries(manifest.slots ?? {});
    if (slots.length === 0) {
        lines.push("_This workspace declares no slots. There is nothing for an agent to read here yet._", "");
    } else {
        for (const [slot, value] of slots) {
            lines.push(`- **\`.portulan/${value}\`** — ${GLOSS[slot] ?? `the \`${slot}\` slot`}.`);
        }
        lines.push("");
    }

    const rest = guidance ? guidance.units.filter((u) => u !== card) : [];
    if (rest.length) {
        const { inline, pointers } = agentsMdGuidance({ ...guidance, units: rest }, `.portulan/${manifest.slots.context}`);
        lines.push("## Guidance", "");
        for (const body of inline) lines.push(body.trimEnd(), "");
        if (pointers.length) lines.push("Open each of these when it applies; each is one file:", "", ...pointers, "");
    }

    lines.push("## Verify — what *done* is checked against", "");
    // The workspace's own recipes only: a vendored host cannot resolve a pack, so a pack's recipe could not run there.
    const composed = (manifest.packs ?? []).length > 0;
    const set = recipeSet(manifest, { packs: [] });
    const recipes = set.ok ? set.recipes : [];
    if (!set.ok) {
        lines.push(
            "> **COULD NOT READ THIS WORKSPACE'S VERIFY RECIPES.** " + set.reason,
            ">",
            "> This is not the same as declaring none, and it is printed rather than swallowed: a vendored",
            "> workspace whose verify table is silently empty would say *done is checked against nothing*",
            "> when what is true is *nobody could read what done is checked against*.",
            "",
        );
    } else if (recipes.length === 0) {
        lines.push("_No recipes are declared._", "");
    } else {
        lines.push("| Recipe | Command |", "|---|---|");
        for (const recipe of recipes) {
            lines.push(`| \`${recipe.id}\`${recipe.id === manifest.verify?.default ? " (default)" : ""} | \`${recipe.run}\` |`);
        }
        lines.push(
            "",
            "Exit `0` green · `1` red · `2` **could not run**. The third is load-bearing: a recipe that could not",
            "execute must never look like one that ran and passed.",
            "",
        );
        if (composed) {
            lines.push(
                "**This table is the workspace's own recipes and deliberately excludes composed ones.** A pack may",
                "contribute verify recipes to the workspace it is composed into, and those recipes run from the pack's",
                "own files — which are not in this tree, because a vendored workspace has no pack in its trust path.",
                "Listing them here would print commands you cannot run. **The packs that contribute them are named in",
                "the section below**; the recipes themselves are not, because naming them would mean resolving the packs,",
                "which is the thing this artifact does not do.",
                "",
            );
        }
    }

    if (manifest.packs?.length) {
        lines.push(
            "## Packs this workspace composes",
            "",
            ...manifest.packs.map((p) => `- \`${p}\``),
            "",
            "**Their files are not here.** A pack resolves from a feed at a pinned version, and vendoring copies the",
            "workspace rather than resolving its packs — so anything above is a name this host cannot open yet.",
            "",
        );
    }

    lines.push(
        "## What this copy does NOT carry, said here rather than discovered",
        "",
        "- **Compiled host enforcement.** `portulan compile` turns the gate policy into a host's own settings and",
        "  hooks; copying files produces none of it. Until it is run, every tier above is a rule nothing checks.",
        "- **A resolved pointer.** Nothing here fetches anything.",
        ...(cardText?.includes("<plugin root>")
            ? ["- **The Portulan package.** The card's `<plugin root>` is where it is installed, which this copy is not."]
            : cardText?.includes("portulan finish")
              ? ["- **The Portulan package.** The card's `portulan finish` runs from it, and this copy does not carry it."]
              : []),
        "",
        "Run `portulan doctor .portulan` to see where this stands.",
        "",
    );

    if (kernel) {
        lines.push(
            "---",
            "",
            "# The engine kernel, inlined",
            "",
            "_Copied verbatim from `core/engine.md` in the Portulan package. A host without the plugin has no other",
            "route to it, and standards a host cannot read are not standards. Everything above is this team's; what",
            "follows is universal and identical in every workspace._",
            "",
            kernel.trim(),
            "",
        );
    } else {
        lines.push(
            "---",
            "",
            "_The engine kernel could not be read from this installation, so it is **not** inlined below. Everything",
            "above is still this team's layer; what is missing is the universal one. Read `core/engine.md` from the",
            "Portulan package — this file names the gap rather than closing it silently._",
            "",
        );
    }
    return lines.join("\n");
}

// ------------------------------------------------------------------------- the entry point

export function usage() {
    return [
        "portulan vendor — materialise a workspace where it is needed, in either direction",
        "",
        "  portulan vendor <workspace-dir> --into <dir> --residence <in-repo|feed-side> [options]",
        "  node cli/vendor.mjs <workspace-dir> --into <dir> --residence <r> [options]   (from a checkout)",
        "",
        "  --into <dir>          REQUIRED. The destination is the WORKSPACE directory itself —",
        "                        `<repo>/.portulan` in-repo, `<feed>/<name>` feed-side — the same",
        "                        shape `doctor <workspace-dir>` takes.",
        "  --residence <r>       REQUIRED: `in-repo` or `feed-side`. What the DESTINATION is. Never",
        "                        inferred from the path — the residence is the one question a tool",
        "                        may not answer for you, and the wrong guess is dual management.",
        "",
        "  One of these two says what you are doing. There is no default:",
        "  --host <id>           Vendor for a host that is not Claude Code: a self-contained",
        "                        AGENTS.md beside the workspace. The source keeps governing.",
        "                        Goes with `--residence in-repo` — the pair a host reads sits at",
        "                        the root of a tree, and a feed-side workspace ships as a plugin.",
        "  --switch              Change residence. The workspace is materialised at the new one, a",
        "                        pointer or nothing is left at the old, and `doctor` is green at both",
        "                        ends before the old residence is retired.",
        "",
        "  --leave <pointer|nothing>  What a switch leaves at the old residence. Default `pointer`.",
        "  --feed <name>         The feed the governing workspace ships through, recorded in the",
        "                        pointer. Only with `--switch --residence feed-side`.",
        "  --kind <k>            The materialised workspace's kind: repository, demo or portfolio.",
        "                        Defaults from the residence.",
        "  --pack-root <dir>     Where packs are looked up, so `doctor` can resolve composed ones.",
        "                        Repeatable. `auto` discovers it from the host's plugin cache;",
        "                        `./auto` still names a directory called `auto`.",
        "  --repo-root <dir>     Where the repositories this workspace names are checked out, so the",
        "                        cross-repository refusal has somewhere to look. Repeatable.",
        "  --dry-run             Print the plan and write nothing.",
        "",
        "Exit codes: 0 it did it · 1 `doctor` was not green at an end · 2 it could not run.",
    ].join("\n");
}

/** Refuses before the first byte, and orders every write so a handled failure leaves exactly one governing workspace. */
export async function run(argv, options = {}) {
    const say = options.say ?? ((line = "") => process.stdout.write(`${line}\n`));
    const warn = options.warn ?? ((line) => process.stderr.write(`${line}\n`));
    const fault = (step) => {
        if (options.faultAt === step) {
            const error = new Error(`injected I/O failure after \`${step}\``);
            error.code = "EIO";
            throw error;
        }
    };

    const undo = [];
    let pastTheFlip = false;

    try {
        if (SLUG === null) {
            throw new VendorError(`could not read spec/workspace.schema.json, which defines what a valid name is — ${SCHEMA_ERROR?.message}. Refusing to write a manifest it cannot check`);
        }

        const parsed = parseArgs(argv);
        if (parsed.help) {
            say(usage());
            return 0;
        }
        if (!parsed.source) {
            warn("vendor: no source workspace given — `vendor <workspace-dir> --into <dir> --residence <r>` materialises a workspace that exists.");
            warn(usage());
            return 2;
        }

        // ---- the flags, checked against each other before anything is read

        if (!parsed.into) throw new VendorError("no destination given — pass `--into <dir>`, the directory the workspace is materialised into");
        if (!parsed.residence) {
            throw new VendorError(
                "no residence given — pass `--residence in-repo` or `--residence feed-side`. It says what the DESTINATION is, and " +
                    "it is never inferred from the path: `init` holds the same rule for the same reason, which is that a repository " +
                    "is governed by exactly one workspace and the wrong guess is the dual management proposal 0017 refuses",
            );
        }
        if (!RESIDENCES.has(parsed.residence)) throw new VendorError(`\`${parsed.residence}\` is not a residence — the two are \`in-repo\` and \`feed-side\``);
        if (!parsed.switching && parsed.host === null) {
            throw new VendorError(
                "neither `--switch` nor `--host` was given, and this will not guess which you meant. `--host <id>` vendors a " +
                    "self-contained copy for a host and leaves the source governing; `--switch` changes which residence governs and " +
                    "retires the other. A plain copy of a governing workspace is how one repository ends up with two governors",
            );
        }
        if (parsed.host !== null && parsed.residence !== "in-repo") {
            throw new VendorError(
                "`--host` vendors the pair a host reads — `AGENTS.md` beside a `.portulan/` at the root of a tree — so it goes " +
                    "with `--residence in-repo`. A feed-side workspace is delivered as a plugin rather than read out of a directory, " +
                    "and the standards file this writes names `.portulan/` paths that would not exist there. Vendor it in-repo, or " +
                    "`--switch` it feed-side and install it",
            );
        }
        if (parsed.switching && parsed.host !== null) {
            throw new VendorError(
                "`--host` does nothing with `--switch` — a switch materialises the workspace as a residence, not as vendored " +
                    "standards for a foreign host. Refused rather than ignored: an option accepted and then dropped is one you will " +
                    "believe had an effect. Run the switch, then vendor for the host from the new residence",
            );
        }
        if (parsed.leave !== null && !parsed.switching) throw new VendorError("`--leave` only means something with `--switch` — there is no old residence to leave anything at");
        if (parsed.leave !== null && !LEAVE.has(parsed.leave)) throw new VendorError(`\`--leave ${parsed.leave}\` is not one of \`pointer\` or \`nothing\` — 0017's own two`);
        if (parsed.feed !== null && !(parsed.switching && parsed.residence === "feed-side")) {
            throw new VendorError("`--feed` records the feed a governing workspace ships through, in the pointer left behind. It only means something with `--switch --residence feed-side`");
        }
        const leave = parsed.leave ?? "pointer";

        // ---- the source

        const source = path.resolve(parsed.source);
        let sourceStat;
        try {
            sourceStat = fs.lstatSync(source);
        } catch (cause) {
            throw new VendorError(`\`${parsed.source}\` could not be examined — ${cause.code ?? cause.message}. \`vendor\` materialises a workspace that exists; it does not create one`);
        }
        if (sourceStat.isSymbolicLink()) throw new VendorError(`\`${parsed.source}\` is a symlink, and this refuses to read a workspace through one — a manifest reached that way describes some other directory`);
        if (!sourceStat.isDirectory()) throw new VendorError(`\`${parsed.source}\` is not a directory — the source is a workspace directory, the same shape \`doctor\` takes`);

        let manifest,manifestBytes;
        try {
            manifestBytes=fs.readFileSync(path.join(source,"workspace.json"));
            manifest = JSON.parse(manifestBytes);
        } catch (cause) {
            throw new VendorError(
                cause.code === "ENOENT"
                    ? `${display(source)} carries no \`workspace.json\`, so there is no workspace here to materialise. Point at a workspace directory — or run \`init\` if this repository has none`
                    : `${display(path.join(source, "workspace.json"))} could not be read — ${cause.code ?? cause.message}`,
            );
        }
        if (manifest?.kind === "pointer") {
            throw new VendorError(
                `${display(source)} holds a **pointer**, not a workspace — it names \`${manifest.governed_by?.workspace ?? "(nobody)"}\` as its ` +
                    `governor and carries no policy layer of its own. Materialising a pointer would produce a copy of a reference. ` +
                    `Point at the governing workspace itself`,
            );
        }
        if (typeof manifest?.name !== "string" || !SLUG.test(manifest.name)) {
            throw new VendorError(`${display(source)}'s manifest declares no usable \`name\` (${JSON.stringify(manifest?.name)}) — a pointer has to name its governor exactly, so an unusable name here has nowhere to land`);
        }

        const sourceResidence = residenceOf(manifest);
        const checkSourceRecovery=()=>{try{assertNoSourceJournal(source);if(typeof manifest.tree==="string")assertNoSourceJournal(path.resolve(source,manifest.tree));}catch(error){throw new VendorError(error.message);}};
        checkSourceRecovery();
        const dest = path.resolve(parsed.into);

        if (parsed.residence === "in-repo" && path.basename(dest) !== ".portulan") {
            throw new VendorError(
                `an in-repo residence is \`<repository>/.portulan\`, and \`--into ${parsed.into}\` ends in \`${path.basename(dest)}\`. ` +
                    `The boot searches exactly one path and is told not to search outward, so a workspace anywhere else in the ` +
                    `repository is one nothing boots — and \`tree: "../"\` would be a claim about the tree that is not true`,
            );
        }

        const escaping = escapingSlots(manifest, source);
        if (escaping.length) {
            throw new VendorError(
                `${escaping.map((e) => `\`${e.slot}\` is \`${e.value}\``).join(", ")} — ${escaping.length > 1 ? "those slots resolve" : "that slot resolves"} ` +
                    `outside ${display(source)}, and a workspace materialised elsewhere has different neighbours. The copy's slot would ` +
                    `dangle and \`doctor\` would red it on a path that does not resolve. Move what the slot names inside the workspace ` +
                    `first — this repository's own workspace is exactly this shape, which is why it is not the one the parity ` +
                    `demonstration moves`,
            );
        }

        let guidance = null;
        try {
            guidance = guidanceUnits(source, ".");
        } catch (error) {
            if (error instanceof CompileError) throw new VendorError(error.message);
            throw error;
        }

        // ---- the scope bound, refused in both its shapes

        const cards = [];
        if (manifest.slots?.repos) {
            try {
                for (const entry of fs.readdirSync(path.resolve(source, manifest.slots.repos))) {
                    if (entry.endsWith(".md") && entry !== "README.md") cards.push(entry.slice(0, -3));
                }
            } catch {
                /* a missing repos directory is already a `doctor` failure, and not this tool's verdict to render */
            }
        }
        cards.sort();
        if (parsed.switching && cards.length > 1) {
            throw new VendorError(
                `\`${manifest.name}\` names ${cards.length} repositories (${cards.join(", ")}), and this switches a workspace between ` +
                    `residences rather than moving one repository out of a portfolio. Both shapes are refused, not half-done: moving ` +
                    `the whole workspace in-repo cannot answer which of the ${cards.length} repositories hosts it and would leave the ` +
                    `others' pointers aimed at a retired residence; extracting one would edit another workspace's curated cards and ` +
                    `\`products\` entries, and nothing here edits a manifest it did not write. Split the workspace by hand first, or ` +
                    `vendor a copy with \`--host\``,
            );
        }
        if (parsed.switching && sourceResidence === parsed.residence) {
            throw new VendorError(
                `\`${manifest.name}\` already resides ${sourceResidence === "in-repo" ? "in a repository" : "feed-side"} and \`--residence ` +
                    `${parsed.residence}\` names the same one, so this is not a change of residence. \`--switch\` retires an old residence; ` +
                    `there is no old residence here. Drop \`--switch\` and pass \`--host\` if you meant a copy`,
            );
        }

        // ---- the destination

        const carve = parsed.switching ? carveOut(dest, manifest.name) : { allow: new Set(), pointer: null };
        const preserved=new Map(),priorStamps=new Map();
        const priorRoot=fs.existsSync(dest)?{real:fs.realpathSync(dest),stat:fs.statSync(dest)}:null;
        for(const rel of carve.allow){const stamp=fileStamp(dest,rel,priorRoot.real);if(!stamp)throw new VendorError(`${rel} changed during destination snapshot, or is a symlink or nonregular file`);const bytes=readStamped(dest,rel,stamp);priorStamps.set(rel,stamp);preserved.set(rel,bytes);}
        if(carve.pointer&&JSON.stringify(JSON.parse(preserved.get("workspace.json").toString("utf8")))!==JSON.stringify(carve.pointer))throw new VendorError("the destination pointer changed while its replacement was being authorized");
        const walked = walk(source);
        const sourceDirs = directories(source).map(entry=>{const at=fs.lstatSync(path.join(source,entry.rel));return {...entry,identity:{dev:at.dev,ino:at.ino}};});
        const journals=[...walked,...sourceDirs].filter(file=>file.rel.split("/").some(part=>part.toLowerCase()===SOURCE_JOURNAL));
        if(journals.length)throw new VendorError(`reserved source journal was inventoried: ${journals.map(file=>file.rel).join(", ")}; resume or review the source migration before vendoring`);
        checkSourceRecovery();
        const sourceReal=fs.realpathSync(source),sourceDirectory=fs.statSync(source),observed=new Map();
        if(parsed.switching)for(const file of walked) {
            const stamp=fileStamp(source,file.rel,sourceReal);
            if(stamp===null)throw new VendorError(`${file.rel} could not be inventoried safely before switching`);
            observed.set(file.rel,stamp);
        }
        if(parsed.switching && observed.get("workspace.json")?.at(-1)!==createHash("sha256").update(manifestBytes).digest("hex"))throw new VendorError("the source manifest changed while its inventory was being prepared");
        let nestedOwned;
        try { nestedOwned=ownedNestedFiles(source,"."); } catch(error) { if(error instanceof CompileError) throw new VendorError(error.message); throw error; }
        const files = walked.filter((f) => !isGenerated(f.rel) && !nestedOwned.has(f.rel));
        const unfinished=files.filter(f=>/\.portulan-(?:guidance(?:-claim)?|upgrade|retire)\./.test(path.basename(f.rel)));
        if(unfinished.length)throw new VendorError(`source recovery artifacts were retained: ${unfinished.map(f=>f.rel).join(", ")}; finish or review the source migration before vendoring`);
        const generated = walked.filter((f) => isGenerated(f.rel) || nestedOwned.has(f.rel)).map((f) => f.rel);
        const rels = files.map((f) => f.rel);
        const hostFile = parsed.host === null ? null : path.join(path.dirname(dest), "AGENTS.md");

        const synthesised = parsed.switching && carve.pointer && !rels.includes("README.md") ? ["README.md"] : [];
        if (synthesised.length && sourceDirs.some((d) => d.rel === "README.md")) {
            throw new VendorError(
                `${display(source)} holds a DIRECTORY named \`README.md\`, and this switch needs to write a file there — the ` +
                    `destination's pointer README is being replaced and the source carries no README to replace it with. ` +
                    `Rename that directory, or put a \`README.md\` file in the workspace so there is one to carry`,
            );
        }
        const clash = collisions(dest, [...rels, ...synthesised], { allow: carve.allow });
        if (hostFile !== null) clash.push(...collisions(path.dirname(dest), ["AGENTS.md"]));
        if (clash.length) {
            const byCause = new Map();
            for (const item of clash) {
                const key = item.why === "already exists" ? "already exists" : item.why;
                if (!byCause.has(key)) byCause.set(key, []);
                byCause.get(key).push(item.rel);
            }
            const summary = [...byCause]
                .map(([why, list]) => (list.length > 2 ? `${why} — blocking ${list.length} files, including \`${list[0]}\`` : `${why} — ${list.map((r) => `\`${r}\``).join(", ")}`))
                .join("; ");
            throw new VendorError(
                `refusing to write into ${display(dest)}: ${summary}. Nothing here overwrites a file you wrote, and nothing follows a ` +
                    `link out of the tree. Move or remove what is in the way, or materialise into a clean directory`,
            );
        }

        // ---- the plan

        const retargeted = retarget(manifest, parsed.residence, parsed.kindOf);
        const oldResidence = source;
        const oldTree=typeof manifest.tree==="string" && manifest.tree.trim() ? path.resolve(source,manifest.tree) : source;
        const repoDir = parsed.residence === "in-repo" ? path.dirname(dest) : oldTree;

        if (parsed.dryRun) {
            say(`vendor: ${parsed.switching ? "switch" : "vendor"} \`${manifest.name}\` — ${sourceResidence} → ${parsed.residence}`);
            say(`vendor:   from ${display(source)}`);
            say(`vendor:   into ${display(dest)}`);
            for (const file of files) say(`vendor:     ${file.rel}`);
            if (hostFile) say(`vendor:   and ${display(hostFile)}`);
            if (generated.length) say(`vendor:   NOT carried (compiled enforcement, keyed to the residence): ${generated.join(", ")}`);
            if (parsed.switching) {
                say(`vendor:   then ${leave === "pointer" ? `a pointer naming \`${manifest.name}\`` : "nothing"} at ${display(oldResidence)}, once doctor is green at both ends`);
            }
            say("vendor: --dry-run, so nothing was written.");
            return 0;
        }

        // ---- materialise, into a STAGING directory that is a residence nowhere

        const staging = path.join(path.dirname(dest), `.${path.basename(dest).replace(/^\.+/, "")}.vendoring`);
        // `lstatSync`, not `existsSync`, which answers false on EACCES.
        try {
            fs.lstatSync(staging);
            throw new VendorError(
                `${display(staging)} is already there — a previous run of this tool died before it could clear its staging directory. ` +
                    `Nothing was written. Check what is in it, then remove it and run this again`,
            );
        } catch (cause) {
            if (cause instanceof VendorError) throw cause;
            if (cause.code !== "ENOENT") {
                throw new VendorError(
                    `${display(staging)} could not be examined — ${cause.code ?? cause.message}. Only a missing path means "nothing there", ` +
                        `and this needs somewhere it knows is empty to stage a copy in`,
                );
            }
        }
        fs.mkdirSync(staging, { recursive: true });
        const stagingRoot={real:fs.realpathSync(staging),stat:fs.statSync(staging)},stagedOwned=new Map(),stagedDirs=new Map();
        undo.push(()=>cleanupPublications(staging,stagedOwned,new Map(),stagingRoot,true,stagedDirs));
        const stageWrite=(rel,bytes,mode=null)=>{
            const full=path.join(staging,rel);makeOwnedDirectories(staging,path.dirname(rel),stagedDirs);const fd=fs.openSync(full,"wx"),wanted=Buffer.from(bytes),at=fs.fstatSync(fd);
            stagedOwned.set(rel,[at.dev,at.ino,at.mode,createHash("sha256").update(Buffer.alloc(0)).digest("hex")]);
            try{fs.writeFileSync(fd,bytes);if(mode!==null)fs.fchmodSync(fd,mode);const done=fs.fstatSync(fd);stagedOwned.set(rel,[done.dev,done.ino,done.mode,createHash("sha256").update(wanted).digest("hex")]);}
            catch(error){const partial=fs.fstatSync(fd);stagedOwned.set(rel,[partial.dev,partial.ino,partial.mode,createHash("sha256").update(wanted.subarray(0,partial.size)).digest("hex")]);throw error;}
            finally{fs.closeSync(fd);}
        };

        for (const entry of sourceDirs) {
            if (isGenerated(entry.rel)) continue;
            const full = path.join(staging, entry.rel);
            makeOwnedDirectories(staging,entry.rel,stagedDirs);
            fs.chmodSync(full, entry.mode|0o700);
        }
        // Copied byte for byte: `# portulan:bundle-fallback` lines are not rewritten here; `portulan upgrade` re-derives them.
        for (const file of files) {
            if (file.rel === "workspace.json") continue;
            const full = path.join(staging, file.rel);
            stageWrite(file.rel,fs.readFileSync(path.join(source,file.rel)),file.mode);
        }
        if (parsed.switching && carve.pointer && !rels.includes("README.md")) {
            stageWrite("README.md",arrivedReadme(manifest.name));
        }
        stageWrite("workspace.json",`${JSON.stringify(retargeted,null,2)}\n`);
        const inputTimes=new Map([...stagedOwned.keys()].map(rel=>[rel,fs.lstatSync(path.join(staging,rel),{bigint:true}).ctimeNs]));
        try{guidance=guidanceUnits(staging,".");}catch(error){if(error instanceof CompileError)throw new VendorError(error.message);throw error;}
        if (hostFile !== null) {
            // Not required: a missing kernel is said in the file rather than refusing the run.
            let kernel = null;
            try {
                kernel = fs.readFileSync(path.join(HERE, "..", "core", "engine.md"), "utf8");
            } catch {
                kernel = null;
            }
            stageWrite("..AGENTS.md.vendoring",agentsMd(retargeted,parsed.host,kernel,guidance));
        }
        for(const entry of [...sourceDirs].reverse())if(!isGenerated(entry.rel))fs.chmodSync(path.join(staging,entry.rel),entry.mode);
        fault("materialise:files");
        const stagedNow=walk(staging);
        if(stagedNow.length!==stagedOwned.size||stagedNow.some(file=>!sameStamp(fileStamp(staging,file.rel,stagingRoot.real,stagedOwned.get(file.rel)),stagedOwned.get(file.rel))))throw new VendorError("staged material changed before publication; retained files need review");
        if([...inputTimes].some(([rel,time])=>fs.lstatSync(path.join(staging,rel),{bigint:true}).ctimeNs!==time))throw new VendorError("staged source changed while guidance was being validated");

        // ---- doctor the new residence, BEFORE it is one

        // No `--repo-root` yet: the old residence still governs, so the cross-repository check cannot pass before the flip.
        // Every `verdict` gets `env`: `doctor` discovers packs through it, and without it would read whatever machine it runs on.
        const roots = {
            ...(options.env ? { env: options.env } : {}),
            ...(parsed.packRoots.length ? { packRoots: parsed.packRoots.map((r) => path.resolve(r)) } : {}),
            ...(parsed.discoverPacks ? { discoverPacks: true } : {}),
        };
        const staged = await verdict(staging, roots);
        if (staged.length) {
            say(`vendor: RED at the new residence — nothing was moved, and \`${manifest.name}\` still resides ${sourceResidence === "in-repo" ? "in its repository" : "feed-side"}.`);
            for (const f of staged) say(`vendor:   ${f.check} ${f.message}`);
            say("vendor: the switch was refused before it began, which is the point of validating a copy before it is a residence.");
            const incomplete=await unwind(undo);if(incomplete.length)warn(`vendor: rollback incomplete; retained ${incomplete.join(", ")}`);
            return 1;
        }
        if([...inputTimes].some(([rel,time])=>fs.lstatSync(path.join(staging,rel),{bigint:true}).ctimeNs!==time))throw new VendorError("staged source changed after guidance validation");

        checkSourceRecovery();

        // ---- the one rename, and the sentence that precedes it

        // Printed before the window opens: after it, this process may not be alive to print.
        if (parsed.switching) {
            // Only the feed-side end sees two governors: visibility runs one way, out from the naming workspace.
            const visibleFrom = parsed.residence === "feed-side" ? dest : source;
            say(`vendor: materialising \`${manifest.name}\` at ${display(dest)}. For the next moment two workspaces govern ${path.basename(repoDir)};`);
            say(`vendor: if this run dies here, \`portulan doctor ${display(visibleFrom)} --repo-root ${display(path.dirname(repoDir))}\` says whether it did.`);
            // Conditional: before the new manifest lands, that path may hold the pointer, the only record of who governs.
            say(`vendor: ONLY if it reports two governors, remove ${display(path.join(dest, "workspace.json"))} — the manifest this run`);
            say("vendor: wrote — and the window closes. If it reports none, the window never opened: delete nothing.");
        }

        if(priorRoot && (fs.statSync(dest).dev!==priorRoot.stat.dev||fs.statSync(dest).ino!==priorRoot.stat.ino||[...priorStamps].some(([rel,stamp])=>!sameStamp(fileStamp(dest,rel,priorRoot.real,stamp),stamp))))throw new VendorError("the destination pointer changed during staging");
        const destWasAbsent=priorRoot===null,destOwned=new Map(),hostOwned=new Map(),hostPrevious=new Map(),destDirs=new Map(),hostDirs=new Map();
        const hostRoot=hostFile===null?null:path.dirname(hostFile),hostIdentity=hostRoot===null?null:{real:fs.realpathSync(hostRoot),stat:fs.statSync(hostRoot)};
        let destRoot=priorRoot;
        const oldBytes=new Map([...preserved].map(([rel,bytes])=>[rel,{bytes,mode:priorStamps.get(rel)[2]}]));
        undo.push(()=>{
            const failures=[];
            if(hostFile!==null && hostOwned.size)failures.push(...cleanupPublications(hostRoot,hostOwned,hostPrevious,hostIdentity,false,hostDirs));
            if(destRoot)failures.push(...cleanupPublications(dest,destOwned,oldBytes,destRoot,destWasAbsent,destDirs));
            return failures;
        });
        const publishHost=()=>{
            if(hostFile===null)return;
            const stamp=stagedOwned.get("..AGENTS.md.vendoring"),bytes=readStamped(staging,"..AGENTS.md.vendoring",stamp);
            atomicWrite(hostFile,bytes,{exclusive:true,mode:stamp[2],onPublish:id=>hostOwned.set(path.basename(hostFile),[id.dev,id.ino,stamp[2],stamp[3]])});
            guardedRemove(path.join(staging,"..AGENTS.md.vendoring"),{beforeDigest:stamp[3],identity:{dev:stamp[0],ino:stamp[1],mode:stamp[2]}});
            stagedOwned.delete("..AGENTS.md.vendoring");
        };
        if(destWasAbsent) {
            fs.mkdirSync(path.dirname(dest),{recursive:true});publishHost();
            destRoot={real:path.join(fs.realpathSync(path.dirname(dest)),path.basename(dest)),stat:stagingRoot.stat};
            for(const [rel,stamp]of stagedOwned)destOwned.set(rel,stamp);
            for(const [rel,stamp]of stagedDirs)destDirs.set(rel,stamp);
            fs.renameSync(staging,dest);
        } else {
            for(const entry of directories(staging)){makeOwnedDirectories(dest,entry.rel,destDirs);if(destDirs.has(entry.rel))fs.chmodSync(path.join(dest,entry.rel),entry.mode|0o700);}
            const publish=rel=>{
                const stamp=stagedOwned.get(rel),prior=priorStamps.get(rel),bytes=readStamped(staging,rel,stamp);
                atomicWrite(path.join(dest,rel),bytes,{exclusive:!prior,beforeDigest:prior?.[3],identity:prior?{dev:prior[0],ino:prior[1],mode:prior[2]}:undefined,mode:stamp[2],onPublish:id=>destOwned.set(rel,[id.dev,id.ino,stamp[2],stamp[3]])});
            };
            for(const rel of stagedOwned.keys())if(rel!=="workspace.json"&&rel!=="..AGENTS.md.vendoring")publish(rel);
            publishHost();publish("workspace.json");
            for(const entry of directories(staging).reverse())if(destDirs.has(entry.rel))fs.chmodSync(path.join(dest,entry.rel),entry.mode);
            const retained=cleanupPublications(staging,stagedOwned,new Map(),stagingRoot,true,stagedDirs);
            if(retained.length)throw new VendorError(`staging cleanup incomplete: ${retained.join(", ")}`);
        }
        fault("materialise:manifest");

        const records = [];
        const recordsLeft = [];
        if (hostFile !== null) {
            const hostRoot = path.dirname(dest);
            const readme = path.join(hostRoot, ...CHANGES_README.split("/"));
            const readmeBlocked = collisions(hostRoot, [CHANGES_README]);
            if (readmeBlocked.length) {
                recordsLeft.push(`\`${CHANGES_README}\` ${readmeBlocked[0].why === "already exists" ? "is the tree's own" : readmeBlocked[0].why}`);
            } else {
                makeOwnedDirectories(hostRoot,path.dirname(CHANGES_README),hostDirs);
                const bytes=changesReadme();
                atomicWrite(readme,bytes,{exclusive:true,onPublish:id=>hostOwned.set(CHANGES_README,[id.dev,id.ino,id.mode,createHash("sha256").update(bytes).digest("hex")])});
                records.push(CHANGES_README);
            }
            const index = retargeted.handoffs?.index?.path;
            const ignore = path.join(hostRoot, ".gitignore");
            const blocked = collisions(hostRoot, [".gitignore"]).filter((c) => c.why !== "already exists");
            if (typeof index === "string" && blocked.length) recordsLeft.push(`\`.gitignore\` ${blocked[0].why}`);
            if (typeof index === "string" && blocked.length === 0) {
                const rel = path.relative(hostRoot, path.resolve(dest, index)).split(path.sep).join("/");
                const prior=fileStamp(hostRoot,".gitignore",hostIdentity.real);
                let before=null;
                try {fs.lstatSync(ignore);if(!prior)throw new VendorError(".gitignore changed or is not an ordinary file");before=readStamped(hostRoot,".gitignore",prior);}
                catch(cause){if(cause.code!=="ENOENT")throw cause;}
                const next = withIgnoreLines(before, handoffIndexIgnore(rel, path.relative(hostRoot, dest).split(path.sep).join("/")));
                if (next !== (before ?? "")) {
                    if(prior)hostPrevious.set(".gitignore",{bytes:before,mode:prior[2]});
                    atomicWrite(ignore,next,{exclusive:!prior,beforeDigest:prior?.[3],identity:prior?{dev:prior[0],ino:prior[1],mode:prior[2]}:undefined,mode:prior?.[2],onPublish:id=>hostOwned.set(".gitignore",[id.dev,id.ino,id.mode,createHash("sha256").update(next).digest("hex")])});
                    records.push(".gitignore");
                }
            }
        }

        checkSourceRecovery();
        if (!parsed.switching) {
            say(`vendor: wrote ${files.length + (hostFile ? 1 : 0)} file(s) — the \`${manifest.name}\` workspace at ${display(dest)}${hostFile ? `, and ${display(hostFile)}` : ""}.`);
            if (records.length) say(`vendor: and the records the new form keeps, beside it: ${records.map((r) => `\`${r}\``).join(", ")}.`);
            if (recordsLeft.length) say(`vendor: left as they are: ${recordsLeft.join("; ")}.`);
            say(`vendor: the source at ${display(source)} is untouched and still governs. This is a rendering, not a move.`);
            say(`vendor: nothing compiled — run \`portulan compile\` there to turn the gate policy into host enforcement.`);
            return 0;
        }

        // ---- retire the old residence's MANIFEST, which is the act that transfers governance

        // Before the material: retiring the files first would leave a governing manifest over a workspace with holes.
        checkSourceRecovery();
        const oldManifest = path.join(oldResidence, "workspace.json");
        if(!sameStamp(fileStamp(source,"workspace.json",sourceReal,observed.get("workspace.json")),observed.get("workspace.json")))throw new VendorError("the source manifest changed during staging; the switch is refused");
        if (leave === "pointer") {
            const staged2 = `${oldManifest}.vendoring`;
            const stamp=observed.get("workspace.json");
            atomicWrite(oldManifest,`${JSON.stringify(pointerManifest(oldResidence,manifest.name,parsed.feed),null,2)}\n`,{stagingPath:staged2,beforeDigest:stamp[3],identity:{dev:stamp[0],ino:stamp[1],mode:stamp[2]},mode:stamp[2],onPublish:()=>{pastTheFlip=true;}});
        } else {
            const stamp=observed.get("workspace.json");
            guardedRemove(oldManifest,{beforeDigest:stamp[3],identity:{dev:stamp[0],ino:stamp[1],mode:stamp[2]},onRemove:()=>{pastTheFlip=true;}});
        }
        pastTheFlip = true;
        undo.length = 0;
        fault("retire:manifest");

        // ---- green at BOTH ends, which is the first moment the contract's check can be satisfied

        const bothRoots = { ...roots, ...(parsed.repoRoots.length ? { repoRoots: parsed.repoRoots.map((r) => path.resolve(r)) } : {}) };
        const newEnd = await verdict(dest, bothRoots);
        const oldEnd =
            leave === "pointer"
                ? await verdict(oldResidence, { ...(options.env ? { env: options.env } : {}) })
                : fs.existsSync(oldManifest)
                  ? [{ check: "residence", message: `a manifest still stands at ${display(oldManifest)}` }]
                  : [];
        if (newEnd.length || oldEnd.length) {
            say(`vendor: governance has moved to ${display(dest)}, and \`doctor\` is RED at ${newEnd.length ? "the new" : "the old"} end.`);
            for (const f of [...newEnd, ...oldEnd]) say(`vendor:   ${f.check} ${f.message}`);
            say(`vendor: the old residence's files were NOT removed — green at both ends comes before retirement, and it was not green.`);
            say(`vendor: the transfer completed, but validation failed. Preserve both ends and re-run \`doctor\` after fixing what is named above.`);
            return 1;
        }

        // ---- retire the old residence's material — only what this run can account for

        // Retire only unchanged files from the initial inventory, including compiled outputs.
        const moved = new Set([...rels, ...generated]);
        const leftovers = [];
        const retiredGenerated=[],generatedSet=new Set(generated);
        const retain=rel=>{if(!leftovers.includes(rel))leftovers.push(rel);};
        let keptResidence=false,retiredCount=0;
        let remaining = [];
        let unscannable = null;
        const sameResidence=()=>{try{const at=fs.statSync(source);return fs.realpathSync(source)===sourceReal && at.dev===sourceDirectory.dev && at.ino===sourceDirectory.ino;}catch{return false;}};
        try {
            if(!sameResidence())throw new VendorError("the old residence changed identity during switching");
            remaining = walk(oldResidence);
        } catch (cause) {
            // A failed scan is not an empty residence: under `--leave nothing` it would delete files this run cannot account for.
            unscannable = cause;
        }
        for (const file of remaining) {
            if (file.rel === "workspace.json") continue;
            if (!moved.has(file.rel)) {
                retain(file.rel);
                continue;
            }
            if(!retireObserved(oldResidence,file.rel,observed.get(file.rel),sourceReal)) {retain(file.rel);continue;}
            retiredCount++;if(generatedSet.has(file.rel))retiredGenerated.push(file.rel);
        }
        if(unscannable===null) {
            try {for(const file of walk(oldResidence))if(file.rel!=="workspace.json")retain(file.rel);}
            catch(cause){unscannable=cause;}
        }
        if(unscannable===null && !sameResidence())unscannable=new VendorError("the old residence changed identity during retirement");
        if (unscannable === null) pruneObservedDirectories(oldResidence,sourceDirs);
        if (leave === "pointer") {
            try {fs.writeFileSync(path.join(oldResidence,"README.md"),pointerReadme(manifest.name,parsed.feed,display(dest)),{flag:"wx"});}
            catch(cause){if(cause.code!=="EEXIST")throw cause;retain("README.md");}
        } else if (leftovers.length === 0 && unscannable === null) {
            try {fs.rmdirSync(oldResidence);}
            catch(cause) {
                if(cause.code!=="ENOENT") {
                    keptResidence=true;
                    try {for(const file of walk(oldResidence))retain(file.rel);}
                    catch(error){unscannable=error;}
                }
            }
        }
        fault("retire:material");

        say(`vendor: switched \`${manifest.name}\` — ${sourceResidence} → ${parsed.residence}.`);
        say(`vendor:   resides at ${display(dest)}, green.`);
        if (unscannable !== null) {
            say(`vendor:   the old residence at ${display(oldResidence)} could NOT be scanned — ${unscannable.message}`);
            say(retiredCount===0 ? "vendor:   so nothing there was removed. Its original manifest is retired or is a pointer," : "vendor:   cleanup stopped after some accounted-for files were retired; retained content needs review,");
            say("vendor:   and nothing here deletes files it could not account for. Clear it by hand when you can read it.");
        } else if (leave === "pointer") {
            say(`vendor:   a pointer at ${display(oldResidence)}, green.`);
        } else if (leftovers.length || keptResidence) {
            say(`vendor:   the original manifest at ${display(oldResidence)} is retired; remaining content was preserved for review.`);
        } else {
            say(`vendor:   nothing left at ${display(oldResidence)}.`);
        }
        if (leftovers.length) {
            say(`vendor: ${leftovers.length} file(s) at the old residence were not moved by this run and were left alone: ${leftovers.join(", ")}.`);
            say("vendor: nothing here deletes a file it cannot account for — they are yours to keep or remove.");
        }
        if (retiredGenerated.length) {
            say(`vendor: ${retiredGenerated.length} compiled artifact(s) did not travel and were retired with the old residence: ${retiredGenerated.join(", ")}.`);
            say("vendor: enforcement is keyed to the residence — where a settings file lands differs between the two — so a copy would name paths for the residence it left.");
        }
        if (sourceResidence === "in-repo" && !isInside(source,oldTree)) {
            say(`vendor: \`${display(path.join(oldTree,".claude","settings.json"))}\` and \`${display(path.join(oldTree,".claude","rules","portulan"))}\` — where they exist — lie outside the retired workspace. This switch left those paths and their recorded nested targets for you to review.`);
        }
        if (!parsed.repoRoots.length && cards.length) {
            say(`vendor: no --repo-root was given, so the cross-repository half of "green at both ends" reported rather than checked.`);
        }
        // Past the flip, so a compile refusal is reported and the switch still completes.
        let guidanceCompiled = false;
        if (parsed.residence === "in-repo") {
            try {
                guidanceCompiled = compileGuidance(dest).declared;
            } catch (error) {
                say(`vendor: the guidance was NOT compiled — ${error.message}. Until \`portulan compile\` runs clean there, a session boots through the slots.`);
            }
        }
        if (guidanceCompiled) {
            say(`vendor: compiled the guidance into ${display(path.join(repoDir, ".claude", "rules", "portulan"))}, which Claude Code loads there; host settings are not — run \`portulan compile\` against the new residence for them.`);
        } else {
            say(`vendor: nothing compiled — run \`portulan compile\` against the new residence.`);
        }
        if (parsed.residence === "in-repo") {
            say(`vendor: the repository's own records are not moved by a switch — \`portulan upgrade --write ${display(dest)}\` moves them to the new form, which doctor's \`form\` line reports.`);
        }
        return 0;
    } catch (error) {
        if (!pastTheFlip) {const incomplete=await unwind(undo);if(incomplete.length)warn(`vendor: rollback incomplete; retained ${incomplete.join(", ")}`);}
        const message = error instanceof VendorError ? error.message : `could not run — ${error.code === "EIO" ? error.message : (error.stack ?? error)}`;
        warn(`vendor: ${message}`);
        if (pastTheFlip) {
            warn("vendor: governance had already moved when this failed, so nothing was rolled back — undoing it would re-open the window in the other direction.");
            warn("vendor: run `doctor` at both ends to check the current governance and retained files.");
        }
        return 2;
    }
}

function makeOwnedDirectories(root,rel,created) {
    if(rel==="."||rel==="")return;
    let current="";
    for(const part of rel.split(path.sep)){current=path.join(current,part);const full=path.join(root,current);try{fs.mkdirSync(full);const at=fs.lstatSync(full);created.set(current,{dev:at.dev,ino:at.ino});}catch(error){if(error.code!=="EEXIST"||!fs.lstatSync(full).isDirectory()||fs.lstatSync(full).isSymbolicLink())throw error;}}
}
function cleanupPublications(root,published,previous,expectedRoot,removeRoot,created=new Map()) {
    if(!fs.existsSync(root))return [];
    if(expectedRoot){const at=fs.statSync(root);if(at.dev!==expectedRoot.stat.dev||at.ino!==expectedRoot.stat.ino||fs.realpathSync(root)!==expectedRoot.real)return [root];}
    const real=fs.realpathSync(root),failed=[],directoryModes=[];
    for(const [rel,id]of created){const full=path.join(root,rel);try{const at=fs.lstatSync(full);if(at.isDirectory()&&!at.isSymbolicLink()&&at.dev===id.dev&&at.ino===id.ino){directoryModes.push({full,id,mode:at.mode});if((at.mode&0o700)!==0o700)fs.chmodSync(full,at.mode|0o700);}}catch(error){if(error.code!=="ENOENT")failed.push(full);}}
    const order=[...published.keys()].sort((a,b)=>a==="workspace.json"?-1:b==="workspace.json"?1:0);
    for(const rel of order) {
        const stamp=published.get(rel),full=path.join(root,rel),prior=previous.get(rel);
        try {
            if(!sameStamp(fileStamp(root,rel,real,stamp),stamp)){failed.push(full);continue;}
            const options={beforeDigest:stamp[3],identity:{dev:stamp[0],ino:stamp[1],mode:stamp[2]}};
            if(prior)atomicWrite(full,prior.bytes,{...options,mode:prior.mode});else guardedRemove(full,options);
        }catch{failed.push(full);}
    }
    for(const [rel,id]of [...created].reverse()){const full=path.join(root,rel);try{const at=fs.lstatSync(full);if(!at.isDirectory()||at.isSymbolicLink()||at.dev!==id.dev||at.ino!==id.ino){failed.push(full);continue;}fs.rmdirSync(full);}catch(error){if(error.code!=="ENOENT")failed.push(full);}}
    for(const {full,id,mode}of directoryModes)try{const at=fs.lstatSync(full);if(at.isDirectory()&&!at.isSymbolicLink()&&at.dev===id.dev&&at.ino===id.ino)fs.chmodSync(full,mode);}catch(error){if(error.code!=="ENOENT")failed.push(full);}
    if(removeRoot){try{fs.rmdirSync(root);}catch(error){if(error.code!=="ENOENT")failed.push(root);}}
    return failed;
}

function fileStamp(root,rel,realRoot,expected=null) {
    try {
        const file=path.join(root,rel),at=fs.lstatSync(file);
        if(!at.isFile() || (expected && (at.dev!==expected[0] || at.ino!==expected[1] || at.mode!==expected[2])) || fs.realpathSync(file)!==path.join(realRoot,rel))return null;
        return [at.dev,at.ino,at.mode,createHash("sha256").update(fs.readFileSync(file)).digest("hex")];
    } catch {return null;}
}
function readStamped(root,rel,stamp) {
    const full=path.join(root,rel),fd=fs.openSync(full,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|fs.constants.O_NONBLOCK);
    try {const at=fs.fstatSync(fd),bytes=fs.readFileSync(fd);if(!at.isFile()||!sameStamp([at.dev,at.ino,at.mode,createHash("sha256").update(bytes).digest("hex")],stamp))throw new VendorError(`${rel} changed before publication`);return bytes;}
    finally{fs.closeSync(fd);}
}
const sameStamp=(left,right)=>Boolean(left && right && left.every((value,index)=>value===right[index]));
function retireObserved(root,rel,expected,realRoot) {
    if(!sameStamp(fileStamp(root,rel,realRoot,expected),expected))return false;
    const file=path.join(root,rel),claim=path.join(path.dirname(file),`.${path.basename(file)}.portulan-retire.${process.pid}.${randomUUID()}`);
    let made=false,moved=false,placeholder;
    try {
        const fd=fs.openSync(claim,"wx");made=true;const at=fs.fstatSync(fd);placeholder={dev:at.dev,ino:at.ino};fs.closeSync(fd);
        try{fs.renameSync(file,claim);moved=true;}catch(error){const held=fs.lstatSync(claim,{throwIfNoEntry:false});if(held&&(held.dev!==placeholder.dev||held.ino!==placeholder.ino)){moved=true;try{fs.linkSync(claim,file);fs.unlinkSync(claim);moved=false;made=false;}catch{throw new VendorError(`${rel} had an uncertain retirement; its data is preserved at ${claim}. Review both paths before cleanup`);}}throw error;}
        if(!sameStamp(fileStamp(root,path.relative(root,claim),realRoot,expected),expected)) {
            try {fs.linkSync(claim,file);fs.unlinkSync(claim);moved=false;made=false;}
            catch {throw new VendorError(`${rel} changed during retirement; its data is preserved at ${claim}. Review both paths before cleanup`);}
            return false;
        }
        fs.unlinkSync(claim);moved=false;made=false;return true;
    } catch(error){if(!moved&&["EACCES","EPERM","EROFS"].includes(error.code))return false;throw error;}
    finally {if(made&&!moved){const at=fs.lstatSync(claim,{throwIfNoEntry:false});if(at?.isFile()&&at.dev===placeholder.dev&&at.ino===placeholder.ino&&at.size===0)guardedRemove(claim,{before:Buffer.alloc(0),identity:placeholder});else if(at)throw new VendorError(`${rel} retirement staging changed; retained ${claim} for review`);}}
}

async function verdict(dir, roots) {
    try {
        const { findings } = await inspect(dir, roots);
        return findings.filter((f) => f.severity === "fail");
    } catch (error) {
        return [{ check: "doctor", message: `could not judge ${display(dir)} — ${error.message}` }];
    }
}

async function unwind(undo) {
    const failed=[];
    while(undo.length){try{const result=await undo.pop()();if(Array.isArray(result))failed.push(...result);}catch(error){failed.push(error.message);}}
    return failed;
}

function pruneObservedDirectories(root,observed) {
    for(const entry of [...observed].reverse())try{const full=path.join(root,entry.rel),at=fs.lstatSync(full);if(at.isDirectory()&&!at.isSymbolicLink()&&at.dev===entry.identity.dev&&at.ino===entry.identity.ino)fs.rmdirSync(full);}catch{}
}

// `?? ""`: `process.argv[1]` is absent when a non-script imports this, and `pathToFileURL(undefined)` throws.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = await run(process.argv.slice(2));
}
