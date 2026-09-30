#!/usr/bin/env node
// Portulan — the eval result a release carries.
//
// Exit 0 green · 1 a finding · 2 could not run.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { recipeSet, resolverFor } from "./recipe-set.mjs";

/** A failed precondition: always exit 2, never a finding about a release. */
export class CouldNotRun extends Error {}

export const RECORD_DIR = "evals/releases";
export const snapshotPath = (version) => `${RECORD_DIR}/${version}.json`;
export const registerPath = (version) => `${RECORD_DIR}/${version}.md`;

export const FIRST_GOVERNED_VERSION = "0.1.3";

// The payload does not carry `evals/ab/`, so from this version a register cites it at the release's tag.
// Earlier registers keep rendering the relative link npm froze into their tarballs.
export const PINNED_FROM = "0.2.0";
export const REPOSITORY = "https://github.com/sleepy-panda-srl/portulan";

export const SELF = "release-eval";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** Throws `CouldNotRun` on anything but `X.Y.Z` rather than guess where a prerelease falls. */
export function compareVersions(a, b) {
    const pa = SEMVER.exec(a);
    const pb = SEMVER.exec(b);
    if (!pa) throw new CouldNotRun(`\`${a}\` is not an \`X.Y.Z\` version — this rail does not order prereleases or build tags`);
    if (!pb) throw new CouldNotRun(`\`${b}\` is not an \`X.Y.Z\` version — this rail does not order prereleases or build tags`);
    for (let i = 1; i <= 3; i += 1) {
        const d = Number(pa[i]) - Number(pb[i]);
        if (d !== 0) return d < 0 ? -1 : 1;
    }
    return 0;
}

export function isGoverned(version) {
    return compareVersions(version, FIRST_GOVERNED_VERSION) >= 0;
}

/** Read from the worktree, not the index, so an unstaged cut is graded too. */
export function declaredVersion(root) {
    let raw;
    try {
        raw = readFileSync(path.join(root, "package.json"), "utf8");
    } catch (e) {
        throw new CouldNotRun(`could not read package.json: ${e.message}`);
    }
    let v;
    try {
        v = JSON.parse(raw).version;
    } catch (e) {
        throw new CouldNotRun(`package.json is not valid JSON: ${e.message}`);
    }
    if (typeof v !== "string" || !v.trim()) throw new CouldNotRun("package.json declares no version string");
    return v.trim();
}

/** Every `## X.Y.Z` heading in file order, which is newest first. */
export function changelogVersions(root) {
    let text;
    try {
        text = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
    } catch (e) {
        throw new CouldNotRun(`could not read CHANGELOG.md: ${e.message}`);
    }
    const out = [];
    let fenced = false;
    for (const line of text.split("\n")) {
        // A fence may hold a worked example of a cut, and its heading is no release.
        if (/^(```|~~~)/.test(line)) {
            fenced = !fenced;
            continue;
        }
        if (fenced) continue;
        const m = /^## (\d+\.\d+\.\d+)(?:\s|$)/.exec(line);
        if (m) {
            out.push(m[1]);
            continue;
        }
        if (/^## \d/.test(line)) {
            throw new CouldNotRun(
                `CHANGELOG.md carries the release heading ${JSON.stringify(line.trim())}, which is not \`## X.Y.Z\` — this rail ` +
                    "does not order prereleases or build tags, and skipping one would decide by omission whether it is governed",
            );
        }
    }
    if (out.length === 0) throw new CouldNotRun("CHANGELOG.md records no `## X.Y.Z` release heading — refusing to report green over a file nothing could be read from");
    return out;
}

export function sourceOf(root) {
    let commit;
    try {
        commit = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    } catch (e) {
        throw new CouldNotRun(`could not read HEAD: ${e.message}`);
    }
    let clean;
    try {
        clean = execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" }).trim() === "";
    } catch (e) {
        throw new CouldNotRun(`could not read the working tree's state: ${e.message}`);
    }
    return { commit, clean };
}

/** A named pack root wins outright over discovery, so the set depends on the tree, never on the machine. */
export function yieldedRecipes({ root, workspace = ".portulan", packRoot = "packs" }) {
    const workspaceDir = path.join(root, workspace);
    let manifest;
    try {
        manifest = JSON.parse(readFileSync(path.join(workspaceDir, "workspace.json"), "utf8"));
    } catch (e) {
        throw new CouldNotRun(`could not read the workspace manifest: ${e.message}`);
    }
    let resolve;
    try {
        resolve = resolverFor({ workspaceDir, manifest, repoRoot: root, named: [path.join(root, packRoot)] });
    } catch (e) {
        throw new CouldNotRun(`could not resolve this workspace's pack roots: ${e.message}`);
    }
    const set = recipeSet(manifest, { resolve });
    if (!set.ok) throw new CouldNotRun(`the workspace yields no readable recipe set: ${set.refusal ?? set.couldNotRun ?? "no reason given"}`);
    return set.recipes.map((r) => ({ id: r.id, run: r.run }));
}

/** The A/B baseline's identity alone, since its figures have their own carrier; `null` when none is committed. */
export function abBaselineIdentity(root) {
    const snapshot = "evals/ab/baseline.json";
    const abs = path.join(root, snapshot);
    if (!existsSync(abs)) return null;
    let snap;
    try {
        snap = JSON.parse(readFileSync(abs, "utf8"));
    } catch (e) {
        throw new CouldNotRun(`the A/B baseline at ${snapshot} is not valid JSON: ${e.message}`);
    }
    // No fallbacks: an absent field stays `undefined` so that `verifyShape` refuses it.
    return {
        snapshot,
        register: "evals/ab/baseline.md",
        captured: snap?.captured,
        commit: snap?.source?.commit,
        clean: snap?.source?.clean,
    };
}

export function limitationsFor(snap) {
    const out = [
        "**A green says this record agrees with its own capture — never that the release is good.** Every " +
            "line below is what the recipes returned at one commit, and a recipe's own green establishes only what " +
            "that recipe's documentation says it establishes.",
        `**The recipes were not run at the tag.** They ran at \`${snap?.source?.commit}\`, and this record is ` +
            "committed *in* the cut change — so the tagged tree is this commit plus whatever that change still adds " +
            "after the capture, the record itself at minimum. A record cannot be captured at a commit that does not " +
            "exist yet, and printing the one it was captured at is the only honest form.",
        `**\`${SELF}\` is excluded from the rows above**, because a capture cannot be accurate about the record it is inside. ` +
            "Its verdict for this release is the rail's own run on the pull request that carries this file.",
        "**This record measures the Portulan repository's own build**, at the commit named above — never the workspace, " +
            "project or package this release is installed into. Nothing here has looked at your tree.",
    ];
    out.push(
        snap?.source?.clean === true
            ? "**The tree was clean at capture**, so the commit named above is what was measured."
            : "**The tree was NOT clean at capture** — the diff of the cut change is the only record of what was uncommitted, " +
                  "which is weaker than a sha and is printed rather than hidden.",
    );
    out.push(
        snap?.abBaseline === null || snap?.abBaseline === undefined
            ? "**No A/B baseline is committed in this tree**, so this release ships against none. That is a state, not a hole."
            : "**The A/B baseline's figures are NOT restated here.** This record names which baseline the release ships " +
                  "against; the figures and everything that may not be concluded from them live in that register alone.",
    );
    return out;
}

/** No fallbacks, here or in `limitationsFor`: a missing field must render as a hole that `verifyShape` refuses. */
export function renderRegister(snap) {
    const L = [];
    L.push(`# Eval result — Portulan ${snap.version}`);
    L.push("");
    L.push(
        "> **Generated. Do not edit.** Rendered from " +
            `[\`${snapshotPath(snap.version)}\`](${path.basename(snapshotPath(snap.version))}) by ` +
            "[`cli/release-eval.mjs`](../../cli/release-eval.mjs) and byte-compared by the `release-eval` verify recipe. " +
            "This is the eval result milestone 8 requires a release to carry — `docs/plan.md`, Protocol → Versioning.",
    );
    L.push("");
    L.push("## What this release was measured at");
    L.push("");
    L.push("| | |");
    L.push("|---|---|");
    L.push(`| Version | \`${snap.version}\` |`);
    L.push(`| Captured | ${snap.captured} |`);
    L.push(`| Commit | \`${snap.source.commit}\` |`);
    L.push(`| Tree at capture | ${snap.source.clean ? "clean" : "**not clean**"} |`);
    L.push(`| Node | \`${snap.host.node}\` |`);
    L.push(`| Platform | \`${snap.host.platform}\` |`);
    L.push("");
    L.push("## The rails, and what each returned");
    L.push("");
    L.push(
        `${snap.recipes.length} of the ${snap.recipes.length + snap.excluded.length} recipes this workspace yielded at capture. ` +
            "The set is derived from [`cli/recipe-set.mjs`](../../cli/recipe-set.mjs) and never listed by hand.",
    );
    L.push("");
    L.push("| Recipe | Verdict |");
    L.push("|---|---|");
    for (const r of snap.recipes) {
        L.push(`| \`${r.id}\` | ${r.exit === 0 ? "green" : `**exit ${r.exit}**`} |`);
    }
    L.push("");
    for (const e of snap.excluded) {
        L.push(`**\`${e.id}\` is excluded**, and the reason is printed rather than the row silently dropped: ${e.why}`);
        L.push("");
    }
    L.push("## The A/B baseline this release ships against");
    L.push("");
    if (snap.abBaseline === null) {
        L.push("None is committed in this tree.");
    } else {
        const pinned = SEMVER.test(String(snap.version)) && compareVersions(snap.version, PINNED_FROM) >= 0;
        const href = pinned ? `${REPOSITORY}/blob/v${snap.version}/${snap.abBaseline.register}` : `../../${snap.abBaseline.register}`;
        L.push(
            `[\`${snap.abBaseline.register}\`](${href}), rendered from ` +
                `\`${snap.abBaseline.snapshot}\` — captured ${snap.abBaseline.captured} at ` +
                `\`${snap.abBaseline.commit}\`, over a tree that was ` +
                `${snap.abBaseline.clean === true ? "clean" : "**not clean**"}.`,
        );
        L.push("");
        L.push("**Its figures are not repeated here.** They have one carrier and this is not it.");
    }
    L.push("");
    L.push("## What this record does not establish");
    L.push("");
    for (const line of limitationsFor(snap)) L.push(`- ${line}`);
    L.push("");
    return L.join("\n");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A full SHA-1 or SHA-256 name: an abbreviated one can become ambiguous. */
const OBJECT_NAME = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

function leafPaths(value, prefix = []) {
    if (value === null || typeof value !== "object") return [[prefix, value]];
    return Object.entries(value).flatMap(([k, v]) => leafPaths(v, [...prefix, k]));
}

/** Every reason this capture cannot be rendered truthfully; empty when it can. */
export function verifyShape(snap) {
    const red = [];
    if (snap?.portulan?.releaseEval !== "1") red.push("the record does not declare `portulan.releaseEval: \"1\"` — this is not a release eval capture");
    if (typeof snap?.version !== "string" || !SEMVER.test(snap.version)) {
        red.push(`the record's \`version\` is ${JSON.stringify(snap?.version)}, which is not an \`X.Y.Z\` release`);
    }
    if (typeof snap?.captured !== "string" || snap.captured === "") red.push("the record carries no `captured` date");
    if (!Array.isArray(snap?.recipes)) red.push("the record's `recipes` is not an array — the verdicts cannot be read");
    else {
        if (snap.recipes.length === 0) red.push("the record lists no recipes at all — a release measured by nothing is not a release with an eval result");
        for (const r of snap.recipes) {
            if (typeof r?.id !== "string" || r.id === "") red.push("a recipe row carries no id");
            else if (!Number.isInteger(r?.exit)) red.push(`the row for \`${r.id}\` carries no integer \`exit\` — the register cannot print a verdict from it`);
        }
    }
    if (!Array.isArray(snap?.excluded)) red.push("the record's `excluded` is not an array — an exclusion that is not printed is a dropped row");
    else {
        for (const e of snap.excluded) {
            if (typeof e?.id !== "string" || e.id === "") red.push("an exclusion carries no id");
            if (typeof e?.why !== "string" || e.why === "") red.push(`the exclusion of \`${e?.id ?? "?"}\` carries no reason — the register would print a dropped row with no account of it`);
        }
    }
    for (const field of ["source", "host"]) {
        if (snap?.[field] === undefined || snap[field] === null) red.push(`the record has no \`${field}\`, which the register prints among the release's conditions`);
    }
    if (snap?.host !== undefined && snap?.host !== null) {
        for (const k of ["node", "platform"]) {
            if (typeof snap.host[k] !== "string") {
                red.push(`the record's \`host.${k}\` is ${JSON.stringify(snap.host[k])}, not a string — the register prints it as one of the conditions the release was measured under`);
            }
        }
    }
    if (snap?.source !== undefined && snap?.source !== null && typeof snap.source.clean !== "boolean") {
        red.push("the record's `source.clean` is not a boolean — it renders as a branch, so its absence would publish a claim about the tree that the capture never made");
    }
    if (snap?.abBaseline !== null && snap?.abBaseline !== undefined && typeof snap.abBaseline.clean !== "boolean") {
        red.push("the record's `abBaseline.clean` is not a boolean — it renders as a branch, so anything else would assert a dirty baseline tree the capture never recorded");
    }
    if (snap?.abBaseline === undefined) {
        red.push("the record has no `abBaseline` — `null` is how *no baseline* is recorded, and an absent field renders as one without ever having been measured");
    }
    const commitFields = [
        ["source.commit", snap?.source, "the record's central claim is that it was measured at a named commit"],
        ["abBaseline.commit", snap?.abBaseline, "a baseline cited by a name nothing can resolve is cited by nothing"],
    ];
    for (const [label, holder, why] of commitFields) {
        if (holder === undefined || holder === null) continue;
        const value = holder.commit;
        if (typeof value !== "string" || !OBJECT_NAME.test(value)) {
            red.push(`the record's \`${label}\` is ${JSON.stringify(value)}, which is not a full object name — ${why}`);
        }
    }
    // Not trimmed: the value is printed as is, so it is checked as is.
    if (typeof snap?.captured === "string" && !ISO_DATE.test(snap.captured)) {
        red.push(`the record's \`captured\` is ${JSON.stringify(snap.captured)}, which is not a \`YYYY-MM-DD\` date — it is printed as one`);
    }

    if (snap !== null && typeof snap === "object") {
        const skip = snap.abBaseline === null ? "abBaseline" : null;
        for (const [pathParts, leaf] of leafPaths(snap)) {
            const dotted = pathParts.join(".");
            if (skip !== null && pathParts[0] === skip) continue;
            if (leaf === null) {
                red.push(`the record's \`${dotted}\` is \`null\` — it renders as the text \`null\` in a document that otherwise reads as measured`);
            } else if (typeof leaf === "string" && leaf.trim() === "") {
                red.push(`the record's \`${dotted}\` is blank — it renders as nothing at all, which is a hole no probe can see`);
            }
        }
    }

    if (red.length > 0) return red;

    let rendered;
    try {
        rendered = renderRegister(snap);
    } catch (cause) {
        red.push(`the register cannot be rendered from this record — ${cause.message}`);
        return red;
    }
    for (const hole of ["undefined", "NaN"]) {
        if (rendered.includes(hole)) {
            red.push(`the register rendered from this record contains \`${hole}\` — a field the renderer reads is missing, and a published document with a hole in it is worse than a refusal`);
        }
    }
    return red;
}

/** Checks a record against its own capture, never the live recipe set: a recipe added later does not make it wrong. */
export function verifyRecord(snap, { version, keyedBy = "the file it is named for" }) {
    const red = verifyShape(snap);
    if (red.length > 0) return red;
    if (snap.version !== version) {
        red.push(`the record declares version \`${snap.version}\` where ${keyedBy} says \`${version}\` — a record keyed to another release cannot answer for this one`);
    }
    for (const r of snap.recipes) {
        if (r.exit !== 0) {
            red.push(`the record shows \`${r.id}\` at exit ${r.exit} — a release may not carry an eval result that records a rail it did not pass`);
        }
    }
    const excludedIds = snap.excluded.map((e) => e.id).sort();
    if (excludedIds.length !== 1 || excludedIds[0] !== SELF) {
        red.push(
            `the record excludes ${excludedIds.length === 0 ? "nothing" : `\`${excludedIds.join("`, `")}\``} where the only ` +
                `admissible exclusion is \`${SELF}\` — anything else is a verdict moved out of the graded set`,
        );
    }
    return red;
}

function measure(root, recipes, { stdout }) {
    const rows = [];
    for (const r of recipes) {
        if (r.id === SELF) continue;
        stdout.write(`release-eval: running ${r.id}\n`);
        let exit = 0;
        try {
            execFileSync("bash", ["-c", r.run], { cwd: root, stdio: "ignore" });
        } catch (e) {
            exit = typeof e.status === "number" ? e.status : 2;
        }
        rows.push({ id: r.id, exit });
    }
    return rows;
}

const USAGE = `portulan-release-eval — the eval result a release carries.

  node cli/release-eval.mjs --capture [--repo-root <dir>] [--date <YYYY-MM-DD>]
  node cli/release-eval.mjs --write   [--repo-root <dir>] [--version <X.Y.Z>]
  node cli/release-eval.mjs --verify  [--repo-root <dir>]
  node cli/release-eval.mjs --tagged <tag>   [--repo-root <dir>]

  --capture  RUN every recipe this workspace yields and write ${RECORD_DIR}/<version>.json and .md
             for the version package.json declares. Spends real time — it is the whole recipe set.
  --write    re-render a register from its committed capture. Runs no recipe. \`--version\` names
             which record, and belongs to this mode alone: it is refused elsewhere rather than
             ignored, because it once shared a slot with the tag and silently overrode it.
  --verify   the recipe's mode. EVERY governed release CHANGELOG.md records has a record; each
             record's shape; no recorded red; each register byte-compared through this module's own
             renderer; no record for a release that was never cut; and the newest heading agrees
             with package.json.
  --tagged   the release act's mode, for a checkout OF THE TAG: does this tree carry a record for
             the version being published, and does the payload declare the version the tag names.
             Takes the TAG (\`v0.1.3\` or \`0.1.3\`). \`.github/workflows/publish-github-packages.yml\`
             runs it.

Every governed release stays under the rail permanently, not only the newest: a rail that graded one
record at a time would let an older one be deleted in silence. Releases before ${FIRST_GOVERNED_VERSION}
predate the clause and are not graded.

Exit 0 green · 1 a finding · 2 could not run.`;

const MODES = ["--capture", "--write", "--verify", "--tagged"];

function parse(argv) {
    const out = { mode: null, root: ".", date: null, version: null, tagged: null };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        const need = (what) => {
            const v = argv[i + 1];
            if (v === undefined || v.startsWith("--")) throw new CouldNotRun(`\`${a}\` needs ${what}`);
            i += 1;
            return v;
        };
        if (MODES.includes(a)) {
            if (out.mode !== null) throw new CouldNotRun(`pass exactly one of ${MODES.join(", ")}`);
            out.mode = a.slice(2);
            if (a === "--tagged") {
                // Validated here, before the tag reaches a record path.
                const t = need("the tag being published, for example `v0.1.3`");
                if (!SEMVER.test(t.replace(/^v/, ""))) throw new CouldNotRun(`\`--tagged\` takes a tag naming an \`X.Y.Z\` version, not \`${t}\``);
                out.tagged = t;
            }
            continue;
        }
        switch (a) {
            case "--repo-root":
                out.root = need("a directory");
                break;
            case "--date": {
                const v = need("a YYYY-MM-DD date");
                if (!ISO_DATE.test(v)) throw new CouldNotRun(`\`--date\` takes a \`YYYY-MM-DD\` date, not \`${v}\``);
                out.date = v;
                break;
            }
            case "--version": {
                // Validated here because it becomes a path segment, and `X.Y.Z` admits no `/` or `..`.
                const v = need("an `X.Y.Z` version");
                if (!SEMVER.test(v)) throw new CouldNotRun(`\`--version\` takes an \`X.Y.Z\` version, not \`${v}\` — it names a record file, so anything else is a path rather than a version`);
                out.version = v;
                break;
            }
            case "--help":
            case "-h":
                out.mode = "help";
                break;
            default:
                throw new CouldNotRun(`unknown argument \`${a}\``);
        }
    }
    if (out.mode === null) throw new CouldNotRun(`pass one of ${MODES.join(", ")}`);
    if (out.version !== null && out.mode !== "write") {
        throw new CouldNotRun("`--version` names which committed record `--write` re-renders, and means nothing in any other mode — refusing rather than ignoring it");
    }
    return out;
}

export function run(argv = [], { stdout = process.stdout, stderr = process.stderr } = {}) {
    let parsed;
    try {
        parsed = parse(argv);
    } catch (e) {
        stderr.write(`release-eval: ${e.message}\n\n${USAGE}\n`);
        return 2;
    }
    if (parsed.mode === "help") {
        stdout.write(`${USAGE}\n`);
        return 0;
    }
    const root = path.resolve(parsed.root);

    let version;
    try {
        version = declaredVersion(root);
    } catch (e) {
        stderr.write(`release-eval: ${e.message}\n`);
        return 2;
    }

    let governed;
    try {
        governed = isGoverned(version);
    } catch (e) {
        stderr.write(`release-eval: ${e.message}\n`);
        return 2;
    }

    if (parsed.mode === "capture") {
        // Before any git or workspace read, so this refusal is reached outside a repository too.
        if (!governed) {
            stderr.write(
                `release-eval: package.json declares \`${version}\`, which predates \`${FIRST_GOVERNED_VERSION}\` — ` +
                    "the clause binds *from milestone 8*, and capturing a record for a release it does not govern would " +
                    "manufacture history\n",
            );
            return 2;
        }
        let source;
        let recipes;
        let ab;
        try {
            source = sourceOf(root);
            recipes = yieldedRecipes({ root });
            ab = abBaselineIdentity(root);
        } catch (e) {
            stderr.write(`release-eval: ${e.message}\n`);
            return 2;
        }
        // Never the clock: the record is byte-compared, so its date must be reproducible.
        const captured = parsed.date ?? execFileSync("git", ["-C", root, "log", "-1", "--format=%cs"], { encoding: "utf8" }).trim();
        const rows = measure(root, recipes, { stdout });
        const snap = {
            portulan: { releaseEval: "1" },
            version,
            captured,
            source,
            host: { node: process.version, platform: process.platform },
            recipes: rows,
            excluded: [
                {
                    id: SELF,
                    why:
                        "a capture cannot be accurate about the record it is inside — captured before the record is written it " +
                        "is red for the record's absence, and captured after it is stale the moment the register is rendered. " +
                        "Its verdict for this release is the rail's own run on the pull request carrying this file.",
                },
            ],
            abBaseline: ab,
        };
        const shape = verifyShape(snap);
        if (shape.length > 0) {
            for (const line of shape) stderr.write(`release-eval: ${line}\n`);
            stderr.write("release-eval: refusing to write a record that cannot be read back\n");
            return 2;
        }
        mkdirSync(path.join(root, RECORD_DIR), { recursive: true });
        writeFileSync(path.join(root, snapshotPath(version)), `${JSON.stringify(snap, null, 4)}\n`);
        writeFileSync(path.join(root, registerPath(version)), renderRegister(snap));
        stdout.write(`release-eval: wrote ${snapshotPath(version)} and ${registerPath(version)}\n`);
        const red = verifyRecord(snap, { version });
        for (const line of red) stdout.write(`release-eval: ${line}\n`);
        return red.length > 0 ? 1 : 0;
    }

    if (parsed.mode === "write") {
        const target = parsed.version ?? version;
        const read = readRecord(root, target);
        if (read.couldNotRun !== undefined) {
            stderr.write(`release-eval: ${read.couldNotRun}\n`);
            return 2;
        }
        if (read.snap === null) {
            stderr.write(`release-eval: there is no ${snapshotPath(target)} to render from\n`);
            return 2;
        }
        const shape = verifyShape(read.snap);
        if (shape.length > 0) {
            for (const line of shape) stderr.write(`release-eval: ${line}\n`);
            stderr.write("release-eval: refusing to render a register from a capture it could not read\n");
            return 2;
        }
        writeFileSync(path.join(root, registerPath(target)), renderRegister(read.snap));
        stdout.write(`release-eval: re-rendered ${registerPath(target)}\n`);
        return 0;
    }

    // ---------------------------------------------------------------- `--tagged`, the release act
    if (parsed.mode === "tagged") {
        // The tag's version, never package.json's: a tag cut from an un-bumped tree still names what it releases.
        const tagged = parsed.tagged.replace(/^v/, "");
        let taggedGoverned;
        try {
            taggedGoverned = isGoverned(tagged);
        } catch (e) {
            stderr.write(`release-eval: ${e.message}\n`);
            return 2;
        }
        if (tagged !== version) {
            stdout.write(
                `release-eval: the tag names \`${tagged}\` while this tree's package.json declares \`${version}\` — one of the ` +
                    "two was never moved, and a release whose payload disagrees with its tag is exactly the cut this check " +
                    "exists to refuse.\n",
            );
            return 1;
        }
        if (!taggedGoverned) {
            stdout.write(
                `release-eval: \`${tagged}\` predates \`${FIRST_GOVERNED_VERSION}\` — the clause binds *from ` +
                    "milestone 8*, so a republish of it is not asked for a record it never had.\n",
            );
            return 0;
        }
        const read = readRecord(root, tagged);
        if (read.couldNotRun !== undefined) {
            stderr.write(`release-eval: ${read.couldNotRun}\n`);
            return 2;
        }
        if (read.snap === null) {
            stdout.write(
                `release-eval: the tree tagged \`${tagged}\` carries no ${snapshotPath(tagged)}. From ` +
                    "milestone 8 a release carries an eval result, and this is the only check that sees the tagged tree — " +
                    "the pull request's rail grades a tree, this grades the release.\n",
            );
            return 1;
        }
        const red = gradeOne(root, tagged, read.snap, "the tag");
        for (const line of red) stdout.write(`release-eval: ${line}\n`);
        if (red.length > 0) return 1;
        stdout.write(`release-eval: the tree tagged \`${tagged}\` carries its own eval result, and it agrees with its capture.\n`);
        return 0;
    }

    // ---------------------------------------------------------------- `--verify`, the recipe's mode
    let released;
    try {
        released = changelogVersions(root);
    } catch (e) {
        stderr.write(`release-eval: ${e.message}\n`);
        return 2;
    }
    const red = [];

    if (released[0] !== version) {
        red.push(
            `CHANGELOG.md's newest release heading is \`${released[0]}\` where package.json declares \`${version}\` — one ` +
                "of the two moved without the other, and a cut moves them together",
        );
    }

    let governedReleases;
    try {
        governedReleases = released.filter((v) => isGoverned(v));
    } catch (e) {
        stderr.write(`release-eval: ${e.message}\n`);
        return 2;
    }

    for (const v of governedReleases) {
        const read = readRecord(root, v);
        if (read.couldNotRun !== undefined) {
            stderr.write(`release-eval: ${read.couldNotRun}\n`);
            return 2;
        }
        if (read.snap === null) {
            red.push(
                `\`${v}\` is a release from milestone 8 onward and there is no ${snapshotPath(v)}. Run ` +
                    "`node cli/release-eval.mjs --capture` in the change that cuts it",
            );
            continue;
        }
        red.push(...gradeOne(root, v, read.snap, v === version ? "package.json" : "CHANGELOG.md"));
    }

    let present;
    try {
        present = existsSync(path.join(root, RECORD_DIR))
            ? [...new Set(readdirSync(path.join(root, RECORD_DIR)).flatMap((f) => (f.endsWith(".json") ? [f.slice(0, -5)] : f.endsWith(".md") ? [f.slice(0, -3)] : [])))]
            : [];
    } catch (e) {
        stderr.write(`release-eval: could not enumerate ${RECORD_DIR}: ${e.message}\n`);
        return 2;
    }
    for (const v of present.sort()) {
        // `README.md` and anything else not named for a version is prose, not a record.
        if (!SEMVER.test(v)) continue;
        if (!released.includes(v)) {
            red.push(`${RECORD_DIR}/${v}.* records a release CHANGELOG.md never cut — a record for a release that does not exist reads as evidence and is not`);
            continue;
        }
        if (!isGoverned(v)) {
            red.push(
                `${RECORD_DIR}/${v}.* exists for a release that predates \`${FIRST_GOVERNED_VERSION}\` — nothing here writes ` +
                    "one, so it was written by hand, and an unexamined record reads as evidence exactly like a real one",
            );
            continue;
        }
        if (governedReleases.includes(v)) continue;
        red.push(`${RECORD_DIR}/${v}.* is present but was not graded — this is a bug in the rail, not in the tree`);
    }
    for (const v of governedReleases) {
        if (existsSync(path.join(root, registerPath(v))) && !existsSync(path.join(root, snapshotPath(v)))) {
            red.push(`${registerPath(v)} stands with no capture beside it — the register is what a reader reads, and nothing holds it to anything`);
        }
    }

    if (red.length > 0) {
        for (const line of red) stdout.write(`release-eval: ${line}\n`);
        return 1;
    }
    stdout.write(
        governedReleases.length === 0
            ? `release-eval: no release from \`${FIRST_GOVERNED_VERSION}\` onward has been cut yet — the clause binds *from ` +
                  `milestone 8* and the ${released.length} release(s) recorded predate it. CHANGELOG.md's newest heading agrees ` +
                  "with package.json. Nothing else to check, and that is a state rather than a green over a record set.\n"
            : `release-eval: ${governedReleases.length} governed release(s) — ${governedReleases.join(", ")} — each carry an ` +
                  "eval result whose register is byte-identical to what its capture renders, with no recorded red.\n",
    );
    stdout.write(
        "release-eval: this is the IN-TREE half. Whether a published release body cites its record is not reachable from " +
            "here — `tag-a-release` and `publish-a-release` are Gated. `--tagged` reaches the tagged tree at the release " +
            "act, from .github/workflows/publish-github-packages.yml; the rest is .portulan/gate-map.md's.\n",
    );
    return 0;
}

/** `snap: null` is no record; `couldNotRun` is a record nothing could read. */
function readRecord(root, version) {
    const abs = path.join(root, snapshotPath(version));
    if (!existsSync(abs)) return { snap: null };
    try {
        return { snap: JSON.parse(readFileSync(abs, "utf8")) };
    } catch (e) {
        return { couldNotRun: `${snapshotPath(version)} is not valid JSON: ${e.message}` };
    }
}

function gradeOne(root, version, snap, keyedBy = "CHANGELOG.md") {
    const red = verifyRecord(snap, { version, keyedBy });
    if (red.length > 0) return red;
    let onDisk;
    try {
        onDisk = readFileSync(path.join(root, registerPath(version)), "utf8");
    } catch (e) {
        return [`${registerPath(version)} could not be read (${e.message}) — the capture has no register beside it`];
    }
    if (onDisk !== renderRegister(snap)) {
        return [
            `${registerPath(version)} is not what ${snapshotPath(version)} renders — the published document has drifted ` +
                `from its own capture. Re-render with \`node cli/release-eval.mjs --write --version ${version}\``,
        ];
    }
    return [];
}

function isMain() {
    return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMain()) process.exit(run(process.argv.slice(2)));
