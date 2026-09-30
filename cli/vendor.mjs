#!/usr/bin/env node
// `vendor` — materialise a workspace where it is needed, in either direction.
//
// Refuse an existing file, refuse any link at or below the destination or in the source, and treat only ENOENT as absent.
// Exit 0 done · 1 `doctor` red at an end · 2 could not run.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { agentsMdGuidance, BOOT_CARD_UNIT, CompileError, compileGuidance, GENERATED_DIRS, guidanceUnits } from "./compile.mjs";
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

        let manifest;
        try {
            manifest = JSON.parse(fs.readFileSync(path.join(source, "workspace.json"), "utf8"));
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
        if (parsed.host !== null) {
            try {
                guidance = guidanceUnits(source, ".");
            } catch (error) {
                if (error instanceof CompileError) throw new VendorError(error.message);
                throw error;
            }
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
        const walked = walk(source);
        const sourceDirs = directories(source);
        const files = walked.filter((f) => !isGenerated(f.rel));
        const generated = walked.filter((f) => isGenerated(f.rel)).map((f) => f.rel);
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
        const repoDir = parsed.residence === "in-repo" ? path.dirname(dest) : path.dirname(source);

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
        undo.push(() => fs.rmSync(staging, { recursive: true, force: true }));

        for (const entry of sourceDirs) {
            if (isGenerated(entry.rel)) continue;
            const full = path.join(staging, entry.rel);
            fs.mkdirSync(full, { recursive: true });
            fs.chmodSync(full, entry.mode);
        }
        // Copied byte for byte: `# portulan:bundle-fallback` lines are not rewritten here; `portulan upgrade` re-derives them.
        for (const file of files) {
            if (file.rel === "workspace.json") continue;
            const full = path.join(staging, file.rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, fs.readFileSync(path.join(source, file.rel)));
            fs.chmodSync(full, file.mode);
        }
        if (parsed.switching && carve.pointer && !rels.includes("README.md")) {
            fs.writeFileSync(path.join(staging, "README.md"), arrivedReadme(manifest.name));
        }
        fs.writeFileSync(path.join(staging, "workspace.json"), `${JSON.stringify(retargeted, null, 2)}\n`);
        if (hostFile !== null) {
            // Not required: a missing kernel is said in the file rather than refusing the run.
            let kernel = null;
            try {
                kernel = fs.readFileSync(path.join(HERE, "..", "core", "engine.md"), "utf8");
            } catch {
                kernel = null;
            }
            fs.writeFileSync(path.join(staging, "..AGENTS.md.vendoring"), agentsMd(retargeted, parsed.host, kernel, guidance));
        }
        fault("materialise:files");

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
            await unwind(undo);
            return 1;
        }

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

        const preserved = new Map();
        for (const rel of carve.allow) preserved.set(rel, fs.readFileSync(path.join(dest, rel)));

        // Registered before the first byte moves; it reads `written` by reference, so it undoes exactly what happened.
        const written = [];
        const destWasAbsent = carve.allow.size === 0 && !fs.existsSync(dest);
        undo.push(() => {
            // The manifest first: removing it closes the window, so cleanup that throws after it leaves no governor.
            fs.rmSync(path.join(dest, "workspace.json"), { force: true });
            if (hostFile !== null) fs.rmSync(hostFile, { force: true });
            if (destWasAbsent) {
                fs.rmSync(dest, { recursive: true, force: true });
            } else {
                for (const rel of written) if (!preserved.has(rel)) fs.rmSync(path.join(dest, rel), { force: true });
                for (const [rel, bytes] of preserved) fs.writeFileSync(path.join(dest, rel), bytes);
                // Emptied directories too: one left behind makes the retry's `carveOut` refuse the destination.
                pruneEmpty(dest);
            }
        });

        if (destWasAbsent) {
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            if (hostFile !== null) fs.renameSync(path.join(staging, "..AGENTS.md.vendoring"), hostFile);
            fs.renameSync(staging, dest);
        } else {
            // Files first, manifest last: until the manifest lands, a directory of files is not a residence.
            for (const entry of directories(staging)) {
                fs.mkdirSync(path.join(dest, entry.rel), { recursive: true });
                fs.chmodSync(path.join(dest, entry.rel), entry.mode);
            }
            for (const file of walk(staging)) {
                if (file.rel === "workspace.json" || file.rel === "..AGENTS.md.vendoring") continue;
                const full = path.join(dest, file.rel);
                fs.mkdirSync(path.dirname(full), { recursive: true });
                fs.writeFileSync(full, fs.readFileSync(path.join(staging, file.rel)));
                fs.chmodSync(full, file.mode);
                written.push(file.rel);
            }
            if (hostFile !== null) fs.renameSync(path.join(staging, "..AGENTS.md.vendoring"), hostFile);
            fs.renameSync(path.join(staging, "workspace.json"), path.join(dest, "workspace.json"));
        }
        fs.rmSync(staging, { recursive: true, force: true });
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
                const made = fs.mkdirSync(path.dirname(readme), { recursive: true });
                undo.push(() => {
                    fs.rmSync(readme, { force: true });
                    if (made !== undefined) fs.rmSync(made, { recursive: true, force: true });
                });
                fs.writeFileSync(readme, changesReadme(), { flag: "wx" });
                records.push(CHANGES_README);
            }
            const index = retargeted.handoffs?.index?.path;
            const ignore = path.join(hostRoot, ".gitignore");
            const blocked = collisions(hostRoot, [".gitignore"]).filter((c) => c.why !== "already exists");
            if (typeof index === "string" && blocked.length) recordsLeft.push(`\`.gitignore\` ${blocked[0].why}`);
            if (typeof index === "string" && blocked.length === 0) {
                const rel = path.relative(hostRoot, path.resolve(dest, index)).split(path.sep).join("/");
                let before = null;
                try {
                    before = fs.readFileSync(ignore, "utf8");
                } catch (cause) {
                    if (cause.code !== "ENOENT") throw cause;
                }
                const next = withIgnoreLines(before, handoffIndexIgnore(rel, path.relative(hostRoot, dest).split(path.sep).join("/")));
                if (next !== (before ?? "")) {
                    undo.push(() => (before === null ? fs.rmSync(ignore, { force: true }) : fs.writeFileSync(ignore, before)));
                    fs.writeFileSync(ignore, next);
                    records.push(".gitignore");
                }
            }
        }

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
        const oldManifest = path.join(oldResidence, "workspace.json");
        if (leave === "pointer") {
            const staged2 = `${oldManifest}.vendoring`;
            // Registered before the write: a temp file left in the old residence would block a later run's cleanup.
            undo.push(() => fs.rmSync(staged2, { force: true }));
            fs.writeFileSync(staged2, `${JSON.stringify(pointerManifest(oldResidence, manifest.name, parsed.feed), null, 2)}\n`);
            fs.renameSync(staged2, oldManifest);
        } else {
            fs.rmSync(oldManifest, { force: true });
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
            say(`vendor: exactly one workspace governs ${path.basename(repoDir)}. Fix what is named above, then re-run \`doctor\` at both ends.`);
            return 1;
        }

        // ---- retire the old residence's material — only what this run can account for

        // Compile's output is deleted though never copied: it is reproducible, and left here it would enforce beside a pointer.
        const moved = new Set([...rels, ...generated]);
        const leftovers = [];
        let remaining = [];
        let unscannable = null;
        try {
            remaining = walk(oldResidence);
        } catch (cause) {
            // A failed scan is not an empty residence: under `--leave nothing` it would delete files this run cannot account for.
            unscannable = cause;
        }
        for (const file of remaining) {
            if (file.rel === "workspace.json") continue;
            if (leave === "pointer" && file.rel === "README.md" && !moved.has("README.md")) continue;
            if (!moved.has(file.rel)) {
                leftovers.push(file.rel);
                continue;
            }
            fs.rmSync(path.join(oldResidence, file.rel), { force: true });
        }
        if (unscannable === null) pruneEmpty(oldResidence);
        if (leave === "pointer") {
            fs.writeFileSync(path.join(oldResidence, "README.md"), pointerReadme(manifest.name, parsed.feed, display(dest)));
        } else if (leftovers.length === 0 && unscannable === null) {
            fs.rmSync(oldResidence, { recursive: true, force: true });
        }
        fault("retire:material");

        say(`vendor: switched \`${manifest.name}\` — ${sourceResidence} → ${parsed.residence}.`);
        say(`vendor:   resides at ${display(dest)}, green.`);
        if (unscannable !== null) {
            say(`vendor:   the old residence at ${display(oldResidence)} could NOT be scanned — ${unscannable.message}`);
            say("vendor:   so nothing there was removed. It no longer governs (its manifest is gone or is a pointer),");
            say("vendor:   and nothing here deletes files it could not account for. Clear it by hand when you can read it.");
        } else if (leave === "pointer") {
            say(`vendor:   a pointer at ${display(oldResidence)}, green.`);
        } else if (leftovers.length) {
            say(`vendor:   no workspace at ${display(oldResidence)} — its manifest is retired and it governs nothing.`);
        } else {
            say(`vendor:   nothing left at ${display(oldResidence)}.`);
        }
        if (leftovers.length) {
            say(`vendor: ${leftovers.length} file(s) at the old residence were not moved by this run and were left alone: ${leftovers.join(", ")}.`);
            say("vendor: nothing here deletes a file it cannot account for — they are yours to keep or remove.");
        }
        if (generated.length) {
            say(`vendor: ${generated.length} compiled artifact(s) did not travel and were retired with the old residence: ${generated.join(", ")}.`);
            say("vendor: enforcement is keyed to the residence — where a settings file lands differs between the two — so a copy would name paths for the residence it left.");
        }
        if (sourceResidence === "in-repo") {
            say(`vendor: \`${display(path.join(path.dirname(source), ".claude", "settings.json"))}\` and \`${display(path.join(path.dirname(source), ".claude", "rules", "portulan"))}\` — where they exist — were compiled from the workspace that has just moved, and nothing here writes outside ${display(source)}. They are yours to remove.`);
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
        if (!pastTheFlip) await unwind(undo);
        const message = error instanceof VendorError ? error.message : `could not run — ${error.code === "EIO" ? error.message : (error.stack ?? error)}`;
        warn(`vendor: ${message}`);
        if (pastTheFlip) {
            warn("vendor: governance had already moved when this failed, so nothing was rolled back — undoing it would re-open the window in the other direction.");
            warn("vendor: exactly one workspace governs. Run `doctor` at both ends to see where it stands.");
        }
        return 2;
    }
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
    while (undo.length) {
        const step = undo.pop();
        try {
            step();
        } catch {
            /* best effort: the message about the original failure is worth more than this one */
        }
    }
}

function pruneEmpty(root) {
    const walkDown = (dir) => {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) if (entry.isDirectory()) walkDown(path.join(dir, entry.name));
        if (dir !== root) {
            try {
                if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
            } catch {
                /* a directory that will not go is one somebody still has something in */
            }
        }
    };
    walkDown(path.resolve(root));
}

// `?? ""`: `process.argv[1]` is absent when a non-script imports this, and `pathToFileURL(undefined)` throws.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = await run(process.argv.slice(2));
}
