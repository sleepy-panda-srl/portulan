#!/usr/bin/env node
// `vendor` — materialise a workspace where it is needed, in either direction.
//
// `docs/vision.md`: *"vendor (materialise a workspace where it is needed: a self-contained AGENTS.md +
// .portulan/ into any host, and the reverse — out of a repository and into a feed-side workspace that
// names it)"*. The maintainer widened that gloss on 2026-08-03, which is what settled the verb row 7 had
// deliberately left unassigned — so this tool carries **the residence switch in both directions**.
//
// ## Two jobs, which are one operation with a direction
//
// **Into a host.** A self-contained `AGENTS.md` + `.portulan/` for a host that is not Claude Code — the
// vendored-standards delivery tier. The source keeps governing; this is a rendering, not a move.
//
// **The residence switch.** Feed-side ↔ in-repo, under the contract
// `../.portulan/proposals/0017-one-repository-one-governing-workspace.md` sets and row 7 states as law:
// the workspace is materialised in the new residence, a pointer or nothing is left in the old, and
// `doctor` is green at both ends before the old residence is retired.
//
// ## The invariant, and the window that cannot be closed
//
// **One repository is governed by exactly one workspace.** `doctor` keys governance on exactly two
// coordinates: a non-pointer `workspace.json` in the repository, and a feed-side workspace whose
// `repos/` slot carries a card naming it. A switch has to move both, they live in two directories, and
// no POSIX primitive changes both at once — so *some* intermediate state is unavoidable. Writing the new
// manifest first gives a moment with **two** governors; the reverse gives a moment with **zero**.
//
// 0017's switch contract numbers materialise **before** pointer-or-nothing and argues why: a window in
// which a repository is governed by nothing looks identical to a repository that never adopted Portulan.
// This tool obeys that ordering, and the second reason is the one worth stating here — the two-governor
// state is exactly what `doctor`'s residence refusals **detect and refuse out loud** (given
// `--repo-root`, without which the cross-repository check reports that it did not run), while zero
// governors is silent. Loud beats silent when neither can be avoided.
//
// What is guaranteed, precisely:
//
// - **Every handled failure leaves exactly one governor.** A red `doctor`, a caught I/O error, a refusal
//   — all of them roll back to the state before the flip, or, past the flip, stop forward with the new
//   residence governing. Never zero, never two.
// - **The window is one `rename(2)` wide.** Everything materialises into a staging directory that is not
//   a residence anywhere anybody looks, and is validated there; only a rename puts it in place.
// - **Rollback is possible only before the flip.** Past it, governance has moved and undoing it would
//   re-open the window in the other direction. So past the flip this tool goes forward and reports.
// - **An unhandled crash inside that one rename leaves two governors**, which `doctor --repo-root`
//   refuses by name. The recovery sentence is printed *before* the window opens, not after. Closing this
//   properly needs the mechanism 0017 defers under *Retire when* — a host that resolves a pointer and
//   has nowhere to put a second workspace — and that is a contract change, not an implementer's.
//
// ## The three rules a tool that writes into somebody's tree carries
//
// `cli/init.mjs` and `cli/new.mjs` paid for these and a third writer inherits them — missing a sibling
// is issue #91's class and it has bitten every session of this milestone:
//
// 1. **Refuse an existing file rather than overwriting it** — any file, never only a manifest.
// 2. **Refuse a symlink at or below the named destination** rather than resolving through it. Above the
//    named path, resolve: the user named that path, and on macOS `os.tmpdir()` runs through `/var`.
//    Guarded on the READ side too — copying through a link materialises a file from outside the
//    workspace and records it as part of one.
// 3. **Only `ENOENT` means absent.** An `EACCES` is a question that could not be answered, and answering
//    it *nothing there* is the fail-open this repository names more often than any other.
//
// ## Exit codes
//
// `0` it did it · `1` a red verdict — `doctor` was not green at an end · `2` it could not run. Unlike
// `init` and `new`, this tool **does** have a 1: it runs the real validator and reports its verdict, and
// collapsing "the workspace I wrote is invalid" into "I could not run" would leave a caller unable to
// tell a bad workspace from a missing flag.
//
// Zero dependencies, ESM, no build step — the session-0 ruling.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { inspect } from "./doctor.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Everything that means `vendor` could not run. Carries no verdict about a workspace. */
export class VendorError extends Error {}

/** The two residences. Named, never inferred from a path — `init`'s rule, and for `init`'s reason. */
export const RESIDENCES = new Set(["in-repo", "feed-side"]);

/** What a switch may leave behind, in 0017's own words: "a pointer, or nothing". */
export const LEAVE = new Set(["pointer", "nothing"]);

/** The Workspace Definition this tool writes against. A pointer needs 2.7 — the version that added it. */
const SPEC = "2.7";

// ONE definition of a slug, read from the contract that publishes it rather than written out again —
// the same read `cli/init.mjs` does, for the same reason: a second copy here is free to drift from
// `spec/workspace.schema.json`, and this tool's job at the boundary is to refuse what that refuses.
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

/** The governing kinds, in the order a reader would meet them. `pointer` is not one — it governs nothing. */
const GOVERNING_KINDS = ["repository", "demo", "portfolio"];

/**
 * Top-level entries inside a workspace directory that `cli/compile.mjs` OWNS and this never carries.
 *
 * They are compiled enforcement, and **enforcement is keyed to the residence** — measured this session
 * when `compile` was taught the feed-side shape: an in-repo workspace's Claude settings land at the
 * repository root, a feed-side workspace's land inside the workspace, because that is what ships. So a
 * copy of them at a new residence is a settings file naming paths for the residence it left, sitting
 * where nothing reads it and nothing sweeps it — a document claiming enforcement that nothing carries,
 * emitted into somebody else's tree, which is this milestone's own most expensive recurring defect.
 *
 * Excluded and **named**, never dropped quietly, and `compile` is the one tool that may delete them
 * because it says so itself: a generated file is reproducible by definition.
 */
const GENERATED = new Set(["compile", ".claude"]);

const isGenerated = (rel) => GENERATED.has(rel.split("/")[0]);

// ------------------------------------------------------------------------- the command line

const VALUED = new Set(["--into", "--residence", "--leave", "--host", "--kind", "--feed", "--pack-root", "--repo-root"]);

/**
 * Splits argv into flags and the single source workspace directory.
 *
 * A value beginning with **any** leading `-` is a missing value, not a value — `init`'s round 9, where
 * `--residence -h` was consumed as the residence and the user was then blamed for a token they typed as
 * a flag. An empty string is refused for every flag, because none of them has a meaningful empty value
 * and an empty one reached a manifest once already, failing `minLength: 1` on a run that reported
 * success.
 */
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
            // #155: both spellings, because the tool is genuinely reachable two ways and a usage line
            // naming only one of them is wrong for whoever arrived the other way.
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
        if (arg === "--pack-root") out.packRoots.push(value);
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
    out.source = positional[0] ?? null;
    return out;
}

// ------------------------------------------------------------------------- the residence, and the two keys

/**
 * Which residence a manifest describes.
 *
 * Keyed on **`tree`**, which proposal 0017 names as the one thing keyed to location — *"every feature
 * keys to a workspace SLOT, never to a residence… The one thing that IS keyed to location is `tree`"*.
 * Deliberately not keyed on `kind`: a manifest whose `kind` and `tree` disagree is a defect `doctor`
 * reports where it runs, and a second verdict about it from here would be a second carrier of that rule.
 */
export function residenceOf(manifest) {
    return manifest?.tree === undefined ? "feed-side" : "in-repo";
}

/**
 * The same workspace, retargeted at the other residence — **exactly two keys change**.
 *
 * 0017's parity argument made executable: *"one artifact in two residences, differing in reach and
 * delivery, never in content-kind"*. If this function ever has to touch a third key, that claim is
 * wrong and it is a finding rather than a patch. Key ORDER is preserved for everything else so the
 * materialised manifest diffs against its source as the two-line change it actually is.
 */
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
        // A `demo` workspace is already a feed-side shape — it declares no `tree` — so rewriting it to
        // `portfolio` would change what the workspace IS in order to move it, which is not a move.
        out.kind = kindOf ?? (manifest.kind === "demo" ? "demo" : "portfolio");
    }
    return out;
}

/**
 * Slots whose value resolves **outside** the workspace directory.
 *
 * A slot pointing outside resolves against the workspace's neighbours, and a workspace materialised
 * somewhere else has different neighbours — so the copy's slot dangles and `doctor` reds it on a path
 * that does not resolve. Customer zero is exactly this shape (`"constitution": "../docs/vision.md"`),
 * which is why this repository's own workspace is not the subject of the parity demonstration.
 * Refused ahead of writing rather than produced and then graded.
 */
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

/**
 * Every ordinary file under a workspace directory, with its mode — and a refusal for anything else.
 *
 * `lstatSync`, never `statSync`/`existsSync`: both follow links. A symlink anywhere under the source is
 * refused rather than resolved, because copying through one materialises a file from **outside** the
 * workspace and records it as part of the workspace. That is the write-path escape `init` shipped,
 * arriving by the read path — the sibling nobody guarded (#91).
 */
export function walk(dir) {
    return scan(dir).files;
}

/**
 * Every DIRECTORY under a workspace directory, including the empty ones.
 *
 * A copy driven only by `walk()` silently drops an empty directory, because a directory reaches the
 * destination as a side effect of a file landing inside it. That is not a cosmetic loss: the Workspace
 * Definition lets a declared slot be a directory, `doctor` requires the directory to exist, and an empty
 * `memory/` or `proposals/` is the ordinary state of a workspace that has not earned a record yet. So a
 * workspace GREEN at its source became a copy `doctor` refuses — measured, not reasoned about.
 *
 * The staging validation is what turned that into a refusal rather than a corruption: the switch was
 * declined and nothing moved. It is still a defect — a valid workspace could not be moved at all, and
 * the only way an adopter could act on the refusal was to put a file into every empty directory they
 * own. Copilot's suppressed notes, round 8 on #164.
 */
export function directories(dir) {
    return scan(dir).dirs;
}

/** One descent, two answers, so the guards below cannot come to differ between them. */
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
                // Only ENOENT means absent, and here even that is a surprise: the entry was just listed.
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

/**
 * The path steps from `root` down to `target`, inclusive of both.
 *
 * **The boundary is the named destination, and it was found by running rather than reading** — the same
 * finding `cli/new.mjs` records. A check that walked to the filesystem root refused every scratch
 * directory in the suites, because on macOS `os.tmpdir()` resolves under `/var` and `/var` is a symlink.
 * A symlink among the ancestors of the path the user named is a fact about their filesystem and they
 * named it; a symlink **at or below** it is a segment this tool derives, and a link there is precisely
 * how a write leaves the tree it was meant to stay inside.
 */
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

/**
 * Which destination paths cannot be written — because something is already there, because a link is on
 * the chain, or because the question could not be answered at all.
 *
 * An existing **directory** is not a collision: this writes files into directories a user may
 * legitimately have created. `allow` carries the narrow carve-out a switch needs — see `carveOut`.
 *
 * `lstat` is injectable because the third rule is the one that cannot otherwise be forced: `chmod`
 * refusals are ignored by root, and CI often runs as root, so a suite that reached for `chmod` would
 * assert the rule on a developer's laptop and silently skip it where it matters.
 */
export function collisions(destDir, rels, { lstat = fs.lstatSync, allow = new Set() } = {}) {
    const found = [];
    for (const rel of rels) {
        const target = path.join(destDir, rel);
        for (const step of chain(target, destDir)) {
            let stat;
            try {
                stat = lstat(step);
            } catch (cause) {
                // Only ENOENT means absent — and nothing below an absent directory can exist either, so
                // the walk stops clear. Anything else means this path's state is UNKNOWN, and an unknown
                // is not a clear: declaring it one would let the write loop start on the strength of a
                // question nobody could answer.
                if (cause.code === "ENOENT") break;
                found.push({ rel, path: step, why: `${step} could not be examined (${cause.code ?? cause.message})` });
                break;
            }
            if (stat.isSymbolicLink()) {
                found.push({ rel, path: step, why: `${step} is a symlink, and writing through it would leave the tree` });
                break;
            }
            if (step === target) {
                // A DIRECTORY at the exact path a file must be written is a collision, and this said it
                // was not. The exemption for existing directories is right for the *intermediate*
                // segments — a user may legitimately have created them — and wrong at the leaf, where
                // `walk()` only ever yields files: preflight passed, and the write phase then threw
                // `EISDIR` mid-copy, so the promise that every refusal stands ahead of the first byte
                // was broken by the check that exists to keep it. Copilot's suppressed note, round 4.
                if (stat.isDirectory()) {
                    found.push({ rel, path: step, why: `${step} is a directory, and a file has to be written there` });
                    break;
                }
                // Not a regular file — a FIFO, a socket, a device node. `walk()` already refuses these
                // in the SOURCE ("copies neither by guessing at it"); the destination's ALLOWED leaves
                // were the half that did not, so the carve-out could permit a FIFO named `README.md`
                // and the later read would block rather than fail. Checked before `allow` is consulted,
                // for the same reason the symlink test is: an exemption is about replacing a file, and
                // this is not one. Copilot's suppressed notes, round 13 on #164.
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

/**
 * What a switch's destination is allowed to already contain, and nothing else.
 *
 * The feed-side → in-repo direction lands **on top of the pointer that is the old residence's in-repo
 * half** — `init --residence pointer` writes exactly `workspace.json` and `README.md` there — so rule 1
 * as written would refuse the switch's own ordinary case. The carve-out is deliberately narrow: the
 * manifest must be a **pointer**, and it must name the workspace being moved in. A pointer naming
 * somebody else is a foreign residence and refuses; a third file is somebody's and refuses.
 */
function carveOut(destDir, incomingName) {
    const manifestPath = path.join(destDir, "workspace.json");

    // **`lstat` BEFORE any read, and this is the whole of it.** `readdirSync` and `readFileSync` follow
    // symlinks, so without this the carve-out read a manifest *outside* the named tree and could then
    // refuse — or permit — on the strength of a workspace that is not in this repository at all. The
    // symlink-aware collision check below would still stop the write, which is why nothing escaped; but
    // a containment guarantee that depends on which check happens to run first is not a guarantee, and
    // a refusal drawn from a foreign manifest misdescribes what it found.
    //
    // `cli/init.mjs` shipped exactly this and its `residenceAt` records the fix in the same words. I
    // copied the tool and not the lesson. Copilot, round 5 on #164 — issue #91's class again, and the
    // fourth time this milestone.
    for (const step of [destDir, manifestPath]) {
        let stat;
        try {
            stat = fs.lstatSync(step);
        } catch (cause) {
            // Only ENOENT means absent, and an absent destination has nothing to carve out.
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
        throw new VendorError(
            `${destDir} carries a pointer naming \`${manifest.governed_by?.workspace ?? "(nobody)"}\` as its governor, and the ` +
                `workspace being moved in is \`${incomingName}\`. That is a foreign residence, not this switch's other half — ` +
                `a repository is governed by exactly one workspace, and materialising over a pointer aimed somewhere else would ` +
                `take governance from a workspace that never agreed to give it up`,
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

/** A path as a reader would recognise it — relative to cwd when that is shorter, absolute otherwise. */
function display(target) {
    const rel = path.relative(process.cwd(), target);
    return rel && !rel.startsWith("..") && rel.length < target.length ? rel : target;
}

/**
 * The pointer's own `name`.
 *
 * A residence directory is usually `.portulan`, whose basename would name every pointer in the world
 * `portulan`. So a dot-led residence is named after the **repository** that holds it, and a feed slot
 * after itself. Refused rather than defaulted when nothing survives slugification — a pointer called
 * something nobody chose is worse than being asked.
 */
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
        // Residence-AGNOSTIC, because this function leaves pointers at both ends. It said "This
        // repository is governed by…", which is true of the pointer left in a repository and false of
        // the one left in a retired feed slot — a directory that is not a repository residence at all.
        // A manifest carrying a sentence about somewhere it is not is the same defect one layer down
        // from the prose this session spent a sweep on. Copilot's suppressed notes, round 5 on #164.
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

/** What lands where a pointer used to be, once the workspace itself has arrived. */
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

/**
 * `AGENTS.md` — the standards plane for a host that is not Claude Code.
 *
 * **It names only what the manifest actually declares.** A vendored standards file listing slots the
 * workspace does not carry is `.portulan/dod.md` condition 4's defect — a document describing a
 * capability the tree does not have — emitted into somebody else's repository, which is the worst shape
 * available for it. So every line below is generated from a key that is present.
 *
 * **Core's kernel is inlined; the workspace's own files are named; packs are neither.**
 * `../core/engine.md` says the CLI *"composes it with the pack and workspace layers into a vendored
 * `AGENTS.md` for any host"*, and two thirds of that is what happens: the kernel is embedded because it
 * ships in this package and a host with no plugin has no other way to it, the workspace's slots are
 * pointed at because they travel in the `.portulan/` beside this file, and a pack resolves from a feed
 * at a pinned version — which vendoring does not do. That third is named in the artifact rather than
 * quietly implied by the word "self-contained".
 */
export function agentsMd(manifest, host, kernel = null) {
    const lines = [
        `# AGENTS.md — ${manifest.name}`,
        "",
        `> ${manifest.summary ?? "A Portulan workspace, vendored as standards."}`,
        "",
        `Vendored by \`portulan vendor --host ${host}\` from the \`${manifest.name}\` workspace. This file and the`,
        "`.portulan/` directory beside it are the whole of it: no plugin, no marketplace, no second repository in",
        "the trust path. An agent on this host reads the files named below and works this team's way.",
        "",
        "## Read these, in this order",
        "",
    ];
    const GLOSS = {
        identity: "who this team is, the stack, and the glossary",
        principles: "the rules that are this team's rather than everyone's",
        gates: "which concrete actions are Auto, Propose, Gated or Prohibited",
        dod: "what *done* means here, beyond a green verify",
        constitution: "the team's ground truth, which outranks everything else here",
    };
    const slots = Object.entries(manifest.slots ?? {});
    if (slots.length === 0) {
        lines.push("_This workspace declares no slots. There is nothing for an agent to read here yet._", "");
    } else {
        for (const [slot, value] of slots) {
            lines.push(`- **\`.portulan/${value}\`** — ${GLOSS[slot] ?? `the \`${slot}\` slot`}.`);
        }
        lines.push("");
    }

    lines.push("## Verify — what *done* is checked against", "");
    const recipes = manifest.verify?.recipes ?? [];
    if (recipes.length === 0) {
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
        "                        Named, never discovered. Repeatable.",
        "  --repo-root <dir>     Where the repositories this workspace names are checked out, so the",
        "                        cross-repository refusal has somewhere to look. Repeatable.",
        "  --dry-run             Print the plan and write nothing.",
        "",
        "Exit codes: 0 it did it · 1 `doctor` was not green at an end · 2 it could not run.",
    ].join("\n");
}

/**
 * The whole operation. Every refusal is ahead of the first byte; every write is ordered so that a
 * handled failure at any point leaves exactly one governing workspace.
 *
 * `options.faultAt` throws after a named step. It is a **fault-injection seam and it is deliberate**:
 * the property this tool exists to protect is what a *failure partway* leaves behind, and an ordering
 * nothing can interrupt is an ordering nobody has checked. Reading the code establishes the writes are
 * in the intended order; only forcing the stop establishes what sits on disk between two of them.
 */
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

    /** Undo steps, newest first. Registered only while a rollback is still the right answer. */
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
            // `agentsMd()` writes `.portulan/<slot>` paths and tells the reader to run
            // `portulan doctor .portulan`, which is true by construction for an in-repo destination —
            // that branch already refuses any basename but `.portulan`, on the boot-path rule. Vendored
            // feed-side, the workspace directory is whatever the caller named, and the standards file
            // would point at paths that do not exist: a document describing a tree it is not in,
            // emitted into somebody else's repository, which is `dod.md` condition 4 and the shape this
            // change has already swept fourteen carriers of.
            //
            // Refused rather than parameterised, and the reason is not effort. Vendoring for a host is
            // the AAIF pair — `AGENTS.md` beside `.portulan/`, at the root an agent reads from — and a
            // feed-side workspace ships as a plugin instead. Naming a residence that has no host to
            // stand in is a question, not a configuration. Copilot's suppressed notes, round 11 on #164.
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

        // The boot skill searches exactly `${CLAUDE_PROJECT_DIR}/.portulan/workspace.json` and is told
        // not to search outward (0017, "Parity, and where it is keyed"). An in-repo residence anywhere
        // else is a workspace nothing boots, and `tree: "../"` would be wrong for it besides.
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

        // **Every path this run will write, not merely every path it will copy.** When a switch lands on
        // a pointer whose source carries no `README.md`, one is SYNTHESISED — and the preflight was
        // built from the source's file list, so that leaf was never lstat'd at all. A symlink there was
        // followed by the write, which is the containment rule refused by the one path the check could
        // not see. The carve-out still permits replacing an ordinary pointer README; what it may not do
        // is exempt a link, and `collisions` tests for a symlink before it consults `allow`.
        // Copilot, round 9 on #164.
        const synthesised = parsed.switching && carve.pointer && !rels.includes("README.md") ? ["README.md"] : [];
        // Round 4 established that a directory where a file must be written is refused up front. That
        // was the DESTINATION; this is the source, and it reaches the same collision from the other end:
        // a source directory named `README.md` yields no `README.md` in the file list, so the switch
        // decides to synthesise one, `directories()` faithfully creates the directory in staging, and the
        // write throws `EISDIR` — recovered, since the undo is registered first, but reported as an
        // unanticipated failure rather than as the plain fact it is. Copilot's suppressed notes, round 12.
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
            // Grouped by CAUSE, not listed per path: one symlinked directory blocks every file, and
            // naming it twenty times buries the single fact the reader needs under nineteen copies of
            // it. A refusal nobody finishes reading is a refusal that failed to explain.
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
        //
        // 0017 defines a `.portulan/` with files and no manifest as **not a residence**, which is what
        // makes a partial copy safe. Staging goes further: the copy is validated somewhere nothing looks
        // for a workspace at all, so a destination that would not have been green never becomes a second
        // governor for even one rename. Only a rename puts it in place.

        const staging = path.join(path.dirname(dest), `.${path.basename(dest).replace(/^\.+/, "")}.vendoring`);
        // `lstatSync`, not `existsSync` — which answers **false** on `EACCES` and so reported "clear" for
        // a path whose state nobody could read, letting the run proceed into `mkdirSync` and fail later
        // with an error about the wrong thing. This file states the only-`ENOENT` rule three times in its
        // own header and broke it here, in the one call that was written as a convenience rather than as
        // a check. Copilot's suppressed notes, round 10 on #164 — the fifth appearance of a guard that
        // was carried everywhere except one place.
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

        // DIRECTORIES first, and all of them — including the ones with nothing in them. A copy driven
        // only by the file list creates a directory as a side effect of a file landing in it, so an
        // empty declared slot never arrives, and `doctor` refuses the copy for a path that does not
        // exist. `memory/` and `proposals/` are empty in every workspace that has not earned a record
        // yet, which is most of them on the day they are switched.
        for (const entry of sourceDirs) {
            if (isGenerated(entry.rel)) continue;
            const full = path.join(staging, entry.rel);
            fs.mkdirSync(full, { recursive: true });
            fs.chmodSync(full, entry.mode);
        }
        for (const file of files) {
            if (file.rel === "workspace.json") continue;
            const full = path.join(staging, file.rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, fs.readFileSync(path.join(source, file.rel)));
            fs.chmodSync(full, file.mode);
        }
        // The README the pointer left behind said this repository's workspace lived elsewhere. It does
        // not any more, and a false sentence left in somebody's tree is this milestone's own recurring
        // defect — the one that shipped a claim about a rail into every adopter's drafted README.
        if (parsed.switching && carve.pointer && !rels.includes("README.md")) {
            fs.writeFileSync(path.join(staging, "README.md"), arrivedReadme(manifest.name));
        }
        fs.writeFileSync(path.join(staging, "workspace.json"), `${JSON.stringify(retargeted, null, 2)}\n`);
        if (hostFile !== null) {
            // Read rather than required: an installation missing its own kernel is a broken install and
            // that is a different problem, but refusing to vendor over it would help nobody. The
            // artifact says which of the two it is, so a reader never has to guess whether the absence
            // is deliberate.
            let kernel = null;
            try {
                kernel = fs.readFileSync(path.join(HERE, "..", "core", "engine.md"), "utf8");
            } catch {
                kernel = null;
            }
            fs.writeFileSync(path.join(staging, "..AGENTS.md.vendoring"), agentsMd(retargeted, parsed.host, kernel));
        }
        fault("materialise:files");

        // ---- doctor the new residence, BEFORE it is one
        //
        // Standalone: the cross-repository refusal cannot pass here by construction, because at this
        // moment the old residence still governs — that pair IS the two-governor red. The both-ends
        // check with `--repo-root` runs after the flip, which is the first moment it can be satisfied.

        const roots = {
            ...(parsed.packRoots.length ? { packRoots: parsed.packRoots.map((r) => path.resolve(r)) } : {}),
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
        //
        // Printed BEFORE the window opens rather than after, because after is exactly when this process
        // may not be here to print anything.

        if (parsed.switching) {
            // WHICH end to point `doctor` at is not a matter of taste, and this line had it INVERTED.
            // The cross-repository refusal runs from the **naming** workspace outward — 0017 says
            // visibility is one-way — so the only end that can see two governors is the FEED-SIDE one,
            // the workspace carrying the card that names the repository. Which end that is flips with
            // the direction: materialising feed-side, it is `dest`; materialising in-repo, the feed-side
            // workspace is the `source` this switch is moving out of. Pointing at the in-repo end sends
            // a reader to a run that finds only itself and reports nothing.
            //
            // Copilot's suppressed note found this and prescribed "always `dest`", which is right for one
            // direction and wrong for the other for the same reason the original was wrong.
            const visibleFrom = parsed.residence === "feed-side" ? dest : source;
            say(`vendor: materialising \`${manifest.name}\` at ${display(dest)}. For the next moment two workspaces govern ${path.basename(repoDir)};`);
            say(`vendor: if this run dies here, \`portulan doctor ${display(visibleFrom)} --repo-root ${display(path.dirname(repoDir))}\` says whether it did.`);
            // **Conditional, and the condition is load-bearing.** This said "removing <dest>/workspace.json
            // reverts it", full stop — an instruction that is only correct once the new manifest has
            // actually landed. Before that moment the file at that path is either absent or, switching
            // feed-side → in-repo, still the POINTER: deleting it there destroys the one record saying who
            // governs and leaves governance unreportable from the repository, which is the silent state
            // 0017 calls out by name. A recovery instruction is read exactly once, by someone with no time
            // to check it. Copilot's suppressed note, round 3 on #164.
            say(`vendor: ONLY if it reports two governors, remove ${display(path.join(dest, "workspace.json"))} — the manifest this run`);
            say("vendor: wrote — and the window closes. If it reports none, the window never opened: delete nothing.");
        }

        const preserved = new Map();
        for (const rel of carve.allow) preserved.set(rel, fs.readFileSync(path.join(dest, rel)));

        // **The undo is registered BEFORE the first byte moves, never after the last one.** Registering
        // it afterwards leaves every failure *between* the writes uncovered — and the gap was real: with
        // `--host`, `AGENTS.md` was renamed into place first and a failure in the very next rename rolled
        // back the staging directory while leaving the file behind, so a run that reported could-not-run
        // had still vendored half of something. Copilot, round 1 on #164. The closures below read
        // `written` by reference, so they cover exactly as much as has actually happened when they run.
        const written = [];
        const landed = carve.allow.size === 0 && !fs.existsSync(dest);
        undo.push(() => {
            // The manifest FIRST, always: it is what closes the window. Everything after it is cleanup,
            // and cleanup that throws must not leave a governor standing.
            fs.rmSync(path.join(dest, "workspace.json"), { force: true });
            if (hostFile !== null) fs.rmSync(hostFile, { force: true });
            if (landed) {
                // The destination did not exist before this run, so removing it restores the world.
                fs.rmSync(dest, { recursive: true, force: true });
            } else {
                for (const rel of written) if (!preserved.has(rel)) fs.rmSync(path.join(dest, rel), { force: true });
                for (const [rel, bytes] of preserved) fs.writeFileSync(path.join(dest, rel), bytes);
                // The DIRECTORIES the partial write created, too. Removing the files and leaving
                // `verify/` behind restores the destination's contents and not its shape — and the next
                // run's `carveOut` refuses it for holding something beside the pointer, so a rollback
                // that reported success wedges the retry it exists to make possible. That is `init`'s
                // partial write with the failure moved one layer out, and it is what "rolled back"
                // has to mean: entry for entry, not merely byte for byte. Copilot, round 6 on #164.
                pruneEmpty(dest);
            }
        });

        if (landed) {
            // The destination does not exist: one atomic rename puts the whole workspace there, and
            // there is no half-populated state at all.
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            if (hostFile !== null) fs.renameSync(path.join(staging, "..AGENTS.md.vendoring"), hostFile);
            fs.renameSync(staging, dest);
        } else {
            // The destination exists — the switch's own feed-side → in-repo case, landing on the
            // pointer that is the old residence's in-repo half. Files first, manifest LAST: until the
            // manifest lands this is a directory of files, which 0017 says is not a residence.
            // Directories first here too, for the reason above and one more: the second leg of a
            // round trip lands on an existing destination, so this is the path a workspace takes home.
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

        if (!parsed.switching) {
            say(`vendor: wrote ${files.length + (hostFile ? 1 : 0)} file(s) — the \`${manifest.name}\` workspace at ${display(dest)}${hostFile ? `, and ${display(hostFile)}` : ""}.`);
            say(`vendor: the source at ${display(source)} is untouched and still governs. This is a rendering, not a move.`);
            say(`vendor: nothing compiled — run \`portulan compile\` there to turn the gate policy into host enforcement.`);
            return 0;
        }

        // ---- retire the old residence's MANIFEST, which is the act that transfers governance
        //
        // First, and by rename where there is something to rename: everything after this is cleanup,
        // and cleanup that fails must not be able to mint a second governor. The reverse order — files
        // first — would leave a governing manifest over a workspace with holes in it.

        const oldManifest = path.join(oldResidence, "workspace.json");
        if (leave === "pointer") {
            const staged2 = `${oldManifest}.vendoring`;
            // Registered BEFORE the write, for the same reason the destination's undo is — and this is
            // the SIBLING of the leak round 1 fixed one function over, missed in the fix for it, which
            // is issue #91's class exactly. A failure in the rename below leaves this temp file in a
            // residence a later run will walk, where it reads as an unaccounted leftover and blocks the
            // very cleanup it came from. Copilot's suppressed notes, round 2 on #164.
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
        const oldEnd = leave === "pointer" ? await verdict(oldResidence, {}) : fs.existsSync(oldManifest) ? [{ check: "residence", message: `a manifest still stands at ${display(oldManifest)}` }] : [];
        if (newEnd.length || oldEnd.length) {
            // Past the flip. Rolling back would re-open the window in the other direction, so this goes
            // forward and reports: exactly one workspace governs, and it is the new one. The old
            // residence's material is NOT retired, which is the contract's own ordering doing its job.
            say(`vendor: governance has moved to ${display(dest)}, and \`doctor\` is RED at ${newEnd.length ? "the new" : "the old"} end.`);
            for (const f of [...newEnd, ...oldEnd]) say(`vendor:   ${f.check} ${f.message}`);
            say(`vendor: the old residence's files were NOT removed — green at both ends comes before retirement, and it was not green.`);
            say(`vendor: exactly one workspace governs ${path.basename(repoDir)}. Fix what is named above, then re-run \`doctor\` at both ends.`);
            return 1;
        }

        // ---- retire the old residence's material — only what this run can account for

        // `compile`'s own artifacts are retired with the residence that produced them. They are the one
        // class this deletes without having copied it, and the licence is `compile`'s own sentence:
        // deleting a generated file the compiler wrote is reproducible by definition. Leaving them
        // would be leaving compiled enforcement beside a pointer.
        const moved = new Set([...rels, ...generated]);
        const leftovers = [];
        let remaining = [];
        let unscannable = null;
        try {
            remaining = walk(oldResidence);
        } catch (cause) {
            // **A scan that failed is not an empty old residence.** Swallowing it made `leftovers` empty,
            // which under `--leave nothing` reached `rmSync(oldResidence, {recursive: true})` and deleted
            // files this run could not account for — the exact opposite of the sentence two lines up, in
            // the branch where being wrong is unrecoverable. Copilot, round 1 on #164, and it is this
            // repository's own fail-open shape: a question that could not be answered, answered *nothing
            // there*. Governance has already moved, so stopping here is safe; deleting was never safe.
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
            // The switch itself is complete — governance moved when the manifest did — and only the
            // cleanup is unfinished. Said as its own line rather than folded into the success sentence,
            // because "switched" and "and the old residence is tidy" are two different claims.
            say(`vendor:   the old residence at ${display(oldResidence)} could NOT be scanned — ${unscannable.message}`);
            say("vendor:   so nothing there was removed. It no longer governs (its manifest is gone or is a pointer),");
            say("vendor:   and nothing here deletes files it could not account for. Clear it by hand when you can read it.");
        } else if (leave === "pointer") {
            say(`vendor:   a pointer at ${display(oldResidence)}, green.`);
        } else if (leftovers.length) {
            // NOT "nothing left", which is what this said while the next line listed what was left.
            // `--leave nothing` is an instruction about the *residence*, and it was honoured — the
            // manifest is gone and nothing governs from there. It is not a promise about the directory,
            // because this never deletes a file it cannot account for. Two claims, and only one of them
            // is true here. Copilot's suppressed notes on #164.
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
            // Outside the workspace directory, so outside what this tool writes. Named rather than
            // reached for: a tool that starts deleting beyond the directory it was given is the tool
            // that eventually deletes the wrong thing.
            say(`vendor: \`${display(path.join(path.dirname(source), ".claude", "settings.json"))}\` — if it exists — was compiled from the policy that has just moved, and nothing here writes outside ${display(source)}. It is yours to remove.`);
        }
        if (!parsed.repoRoots.length && cards.length) {
            // A check that vanishes without a word is the fail-open this repository has recorded more
            // than any other. `doctor` says this where it runs; this says it where the switch happened.
            say(`vendor: no --repo-root was given, so the cross-repository half of "green at both ends" reported rather than checked.`);
        }
        say(`vendor: nothing compiled — run \`portulan compile\` against the new residence.`);
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

/** The failing findings the real validator returns — never a second opinion about what valid means. */
async function verdict(dir, roots) {
    try {
        const { findings } = await inspect(dir, roots);
        return findings.filter((f) => f.severity === "fail");
    } catch (error) {
        return [{ check: "doctor", message: `could not judge ${display(dir)} — ${error.message}` }];
    }
}

/** Runs the undo steps newest-first, and never lets a failed undo mask the failure that caused it. */
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

/** Removes directories this run emptied, bottom-up, and never one that still holds something. */
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

// The `?? ""` is not decoration and every sibling tool here carries it: `process.argv[1]` is absent when
// this module is imported by something that is not a script, and `pathToFileURL(undefined)` throws at
// module load.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = await run(process.argv.slice(2));
}
