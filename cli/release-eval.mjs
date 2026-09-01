#!/usr/bin/env node
// Portulan — the eval result a release carries.
//
// Milestone 8's ninth clause: *a release carries an eval result*. `../docs/plan.md`'s Protocol →
// Versioning has carried the obligation since the plan was locked — *"from milestone 8, releases carry
// an eval result"* — and the maintainer's ruling of 2026-08-24 made it bind row 8's close. The
// legislative history is `../docs/milestones/m08.md`; the criterion itself is the row, and this file
// deliberately restates neither.
//
// ## The three things the amendment left open, and what this module settles
//
// The 2026-08-24 amendment named what it did **not** settle: *"what an eval result attached to a
// release consists of, where it is carried (the changelog entry, the release body, a file in the
// payload), and whether a release with no eval result is refused by a rail or by a person. Those are
// this row's remaining work, not this amendment's content."*
//
//  1. **What it consists of.** The verdict every recipe the workspace YIELDS returned, measured by
//     running them, plus the identity of the A/B baseline the release ships against. Not a summary
//     anybody types.
//  2. **Where it is carried.** One file per version, `evals/releases/<version>.md`, rendered from
//     `evals/releases/<version>.json`. `CHANGELOG.md` and the release body CITE it and restate no
//     figure — a rule with two carriers is obeyed at the narrower one.
//  3. **Rail or person — it is BOTH, and the split is the honest answer.** A rail reaches the tree: a
//     governed version with no record, a record that disagrees with its capture, a record listing a red
//     rail. A rail reaches **no tag and no published release body** — `../.portulan/gate-map.md` keeps
//     `tag-a-release` and `publish-a-release` Gated, and those happen outside any tree a check can
//     read. Answering "a rail" flat would have claimed a reach this has not got. The split is the shape
//     the drill calendar already uses for its own two halves.
//
// ## The subject is EVERY governed release, not the tree's current cut state — two wrong designs first
//
// The obvious cut-detector is `CHANGELOG.md`'s **top** heading: rename `## Unreleased` to a version and
// the tree is a cut. **It never fires.** The cut commit RE-SEEDS the accumulator — `b410c020` renamed
// the heading to `## 0.1.2 — 2026-08-20` and put a fresh `## Unreleased` back above it in the same
// commit, which `CHANGELOG.md`'s own header requires so the tagged tree contains its own entry. So the
// top heading is `Unreleased` on every commit including the cut, and a rail keyed to it would have
// reported *no cut in this tree* on precisely the tree it was built to grade.
//
// The second design keyed off `package.json`'s `version` alone — what actually moves at a cut, and what
// `./version-carriers.mjs` grades the prose against. It fires, and it **protects one release at a
// time**: once `0.1.4` is declared, `0.1.3`'s record can be deleted or corrupted and nothing reds. A
// rail over a record layer that only ever grades the newest record is not a rail over the record layer.
//
// So the subject is **every version `CHANGELOG.md` records**, from `FIRST_GOVERNED_VERSION` onward,
// permanently — plus one cut-integrity check that holds between cuts as well as at one: the newest
// version heading must be the version `package.json` declares. Both findings were the second opinion's,
// caught before a line of the rail was written and recorded here rather than in a later repair.

// ## What this cannot reach, and the one surface that can
//
// The heading rename happens *"in a change merged before the tag is created"* — `CHANGELOG.md`'s own
// header — and that ordering is human-owned prose in a file that says of its neighbouring rule *"nothing
// checks this"*. A maintainer who tags a commit whose accumulator was never renamed produces a release
// no tree state ever flagged. No in-tree rail can see that, because the act is a tag.
//
// `../.github/workflows/publish-github-packages.yml` fires on `release: published` and checks out the
// tag — the one mechanical surface at the release act itself — and it runs `--tagged` below against that
// checkout. That is the half a rail can reach at the moment a person acts; the rest stays Gated and is
// carried in `../.portulan/gate-map.md`.
//
// ## Read the WORKTREE, where `./version-carriers.mjs` reads the index — and the difference is the point
//
// That module reads `package.json` and the prose it compares **both** from the git index, because
// comparing worktree prose against an index version compares two trees. Its recorded residual is that an
// **unstaged** cut is therefore invisible to it: run against a fully-edited worktree it reported a green
// about a tree that no longer existed.
//
// This module reads the worktree, uniformly, both the version and the record. `../.portulan/dod.md`
// condition 1 asks that every recipe ran green *in this working copy*, and there is no cross-tree
// comparison here to protect — the record and the version are read from one tree either way. Inheriting
// the index read would have inherited that residual for nothing.
//
// ## `0.1.0`–`0.1.2` are out of scope, by the Protocol's own words
//
// *"**From milestone 8**, releases carry an eval result."* Three releases predate the clause and carry
// none. `FIRST_GOVERNED_VERSION` is the boundary, and it is a **historical constant** rather than a
// hand-maintained figure of a moving subject: which releases predate a ruling cannot change. The
// distinction matters because this repository deletes hand-maintained figures on sight, and the reason
// it does is that their subject moves. This one's does not.
//
// Exit 0 green · 1 a finding · 2 could not run.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { recipeSet, resolverFor } from "./recipe-set.mjs";

/** Raised when a precondition fails. Always exit 2 — never a finding about a release. */
export class CouldNotRun extends Error {}

/** Where a version's record lives. Both halves, because one carrier is a pair here as it is for the baseline. */
export const RECORD_DIR = "evals/releases";
export const snapshotPath = (version) => `${RECORD_DIR}/${version}.json`;
export const registerPath = (version) => `${RECORD_DIR}/${version}.md`;

/**
 * The first release the clause governs.
 *
 * `../docs/plan.md`'s Protocol → Versioning: *"from milestone 8, releases carry an eval result"*.
 * `v0.1.0`, `v0.1.1` and `v0.1.2` were cut before that clause had an owner — it belonged to no row
 * until 2026-08-24 — so they carry no record and this rail does not invent one for them. A retro-fitted
 * record would be a capture nobody ran, which is the one thing an eval result may not be.
 */
export const FIRST_GOVERNED_VERSION = "0.1.3";

/**
 * This module's own recipe id, excluded from every capture it writes.
 *
 * **The capture cannot be accurate about itself and the exclusion is the only honest resolution.**
 * `release-eval` is a yielded recipe, so its verdict would enter the record it lives inside: captured
 * before the record is written it is red, because the governed version has no record; captured after,
 * the capture is stale the moment the register is rendered from it. Every ordering is wrong. So its row
 * is excluded and the exclusion is PRINTED in the register — a dropped row that says nothing is how a
 * record starts implying a green nobody measured.
 */
export const SELF = "release-eval";

/** `X.Y.Z` and nothing else. A prerelease or a build tag is could-not-run rather than a guess at ordering. */
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Compare two `X.Y.Z` versions. Throws `CouldNotRun` on anything else.
 *
 * Deliberately not a general semver comparator: this repository ships `X.Y.Z` and nothing more, and a
 * partial implementation that silently mis-orders a prerelease would decide whether a release is
 * governed. Refusing is the answer that cannot be quietly wrong.
 */
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

/** Whether the clause governs this version. */
export function isGoverned(version) {
    return compareVersions(version, FIRST_GOVERNED_VERSION) >= 0;
}

/** `package.json`'s version, from the worktree. See the header for why not the index. */
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

/**
 * Every version `CHANGELOG.md` records, newest first.
 *
 * **This is the released set, and it is the rail's subject.** `../CHANGELOG.md` carries one `## X.Y.Z —
 * DATE` heading per release and one `## Unreleased` accumulator that is re-seeded at every cut, so the
 * version headings are the releases and the accumulator is never one. A heading is matched only in
 * column 0 at depth 2, because the entries below quote their own retired headings — and **fenced
 * regions are skipped**, because a worked example of a cut belongs in one and would otherwise enter the
 * released set as a phantom release. A version-shaped heading that is not `X.Y.Z` is refused rather than
 * skipped, so the subject list cannot decide by omission what `compareVersions` refuses out loud.
 */
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
        // **Fenced regions are skipped**, because a column-0 fence is exactly where this file would show
        // a reader what a cut looks like — and a worked example naming `## 9.9.9` would enter the
        // released set as a phantom, producing a false red on both the cut-integrity arm and the
        // missing-record arm. Latent today; the docstring above claimed a robustness the fence broke.
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
        // **A version-shaped heading this cannot order is REFUSED, never skipped.** `compareVersions`
        // refuses a prerelease loudly on the ground that a partial ordering would silently decide whether
        // a release is governed — and the subject-list builder was dropping `## 0.1.3-rc.1` without a
        // word, which decides the same thing by omission. The two halves now agree.
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

/** The commit this capture was taken at, and whether the tree was clean when it was. */
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

/**
 * The recipe set this workspace yields, pinned.
 *
 * The root is **named**, so it replaces every other source and this answer is about the tree rather than
 * about the machine — the same reason `./drills.mjs`'s recipe and `./goldens.mjs`'s pin theirs.
 */
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

/**
 * The A/B baseline this release ships against — its IDENTITY, never its figures.
 *
 * **Restating the cells here would be the defect this whole module is arranged against.** The figures
 * have a carrier — `evals/ab/baseline.json`, and `evals/ab/baseline.md` rendered from it and
 * byte-compared by the `ab-run` recipe — and a second copy of them in a per-release record is a
 * hand-maintained figure of a moving subject wearing a machine-written costume. What a release record
 * owes its reader is *which* baseline it shipped against and where to read it, so that is what this
 * returns: path, capture date, the commit it was taken at, and whether that tree was clean.
 *
 * Returns `null` where no baseline is committed, which a release may legitimately be in — and the
 * register then says so rather than rendering a hole.
 */
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
    // **Read through, and coerce nothing.** A first cut mapped a missing field to `null`, which the
    // renderer then printed as `<undated>` / `<uncommitted>` — so a baseline whose capture lacked those
    // fields produced a perfectly well-formed register naming a placeholder, and the derived probe below
    // saw no hole because a fallback had filled it. Reading through means an absent field arrives as
    // `undefined`, renders as `undefined`, and is refused before anything is written. Fail closed.
    return {
        snapshot,
        register: "evals/ab/baseline.md",
        captured: snap?.captured,
        commit: snap?.source?.commit,
        clean: snap?.source?.clean,
    };
}

/**
 * The limitations, DERIVED from the capture rather than fixed.
 *
 * 6d round 2's finding, and it is this milestone's signature defect: a limitation asserted flat about a
 * field the capture may or may not hold is a false sentence waiting for its first counterexample. That
 * block asserted *"the model is not recorded"* while the harness had just begun recording one.
 */
export function limitationsFor(snap) {
    const out = [
        "**A green says this record agrees with its own capture — never that the release is good.** Every " +
            "line below is what the recipes returned at one commit, and a recipe's own green establishes only what " +
            "that recipe's documentation says it establishes.",
        // No `??` here either — the fallback survived one round of removing them, in the block whose
        // subject is claims a capture never made, so a null-commit record printed `null` in its table and
        // `<commit>` in its limitations. `verifyShape` refuses such a capture before this is reached.
        `**The recipes were not run at the tag.** They ran at \`${snap?.source?.commit}\`, and this record is ` +
            "committed *in* the cut change — so the tagged tree is this commit plus the cut itself. A record cannot be " +
            "captured at a commit that does not exist yet, and printing the one it was captured at is the only honest form.",
        `**\`${SELF}\` is excluded from the rows above**, because a capture cannot be accurate about the record it is inside. ` +
            "Its verdict for this release is the rail's own run on the pull request that carries this file.",
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

/** The register, rendered from the capture. The one place a release's eval result is written for a reader. */
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
        // No `??` fallbacks: a missing field must render as a hole the derived check refuses, never as a
        // placeholder that reads like a measurement. `clean` is the exception by nature — it renders as a
        // branch — and is therefore checked by name in `verifyShape`.
        L.push(
            `[\`${snap.abBaseline.register}\`](../../${snap.abBaseline.register}), rendered from ` +
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

/**
 * The shape check, DERIVED from the renderer — and it runs before any render a caller trusts.
 *
 * 6d rounds 3, 4, 6 and 7 arrived at this shape over five rounds and it is adopted rather than
 * re-derived: report rather than throw; check **before** rendering rather than after; check what is
 * dereferenced rather than what is typed; and derive the list from the renderer instead of hand-writing
 * another function's reads, because a hand-written one goes stale the moment the renderer reads one more
 * thing.
 *
 * **The derived check is blind to anything the renderer supplies a value for**, and that is the whole of
 * its limit rather than "one boolean". A first cut of this module claimed exactly one blind spot and had
 * three: `abBaseline.captured` and `abBaseline.commit` were read through `??` fallbacks, so absence
 * printed `<undated>` and `<uncommitted>` — placeholders that read like measurements — and
 * `abBaseline.clean: null` was *explicitly permitted* by the check whose message said its absence must
 * not publish an unmeasured claim, then rendered as `**not clean**`. Caught by a fresh context deleting
 * every field the renderer reads, one at a time, which is the only way this class is ever found.
 *
 * So there are **three** rules, and the third was itself a second round of this same defect. (1) The
 * renderer supplies no fallback, so absence renders as a hole. (2) Every field that renders as a
 * **branch** rather than a value is checked here by name, because no hole appears for those — only the
 * meaning is invented. (3) **No leaf may be `null` and no string leaf may be blank**, because a
 * present-degenerate value is neither absent nor a branch: `${null}` renders the four characters `null`
 * and `""` renders nothing at all, so the document comes out well-formed and the probe below — which
 * looks for `undefined` and `NaN` — sees a clean page. Six of these passed a check that had just been
 * hardened against exactly this class and whose comment claimed two rules were the whole of it.
 *
 * Rule 3 is **structural rather than a list of fields**: it walks the capture's own leaves. A
 * hand-written roster of "fields that must be non-empty" is the defect this file has now met at three
 * depths, and it would go stale the moment the renderer read one more.
 */
/** `YYYY-MM-DD`. A capture that stamps itself from anything else cannot be reproduced, and it is printed. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Every leaf of the capture, as a dotted path — the subject of rule 3 above.
 *
 * `abBaseline: null` is the one legitimate null and is skipped by the caller rather than exempted here,
 * because an exemption inside a total walk is how a second one gets added later without argument.
 */
function leafPaths(value, prefix = []) {
    if (value === null || typeof value !== "object") return [[prefix, value]];
    return Object.entries(value).flatMap(([k, v]) => leafPaths(v, [...prefix, k]));
}

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
    // **The booleans, explicitly** — the derived check's one blind spot, measured rather than reasoned.
    if (snap?.source !== undefined && snap?.source !== null && typeof snap.source.clean !== "boolean") {
        red.push("the record's `source.clean` is not a boolean — it renders as a branch, so its absence would publish a claim about the tree that the capture never made");
    }
    // **`null` was permitted here and it renders as `**not clean**`** — a claim about the baseline's tree
    // that the capture never made, published by the check whose own message said absence must not do
    // that. Permitting the third state defeated the check in the same line that stated it. Strict.
    if (snap?.abBaseline !== null && snap?.abBaseline !== undefined && typeof snap.abBaseline.clean !== "boolean") {
        red.push("the record's `abBaseline.clean` is not a boolean — it renders as a branch, so anything else would assert a dirty baseline tree the capture never recorded");
    }
    if (snap?.abBaseline === undefined) {
        red.push("the record has no `abBaseline` — `null` is how *no baseline* is recorded, and an absent field renders as one without ever having been measured");
    }
    if (typeof snap?.captured === "string" && !ISO_DATE.test(snap.captured.trim())) {
        red.push(`the record's \`captured\` is ${JSON.stringify(snap.captured)}, which is not a \`YYYY-MM-DD\` date — it is printed as one`);
    }

    // **Rule 3: no leaf is `null`, no string leaf is blank.** A present-degenerate value renders as a
    // value, so neither the fallback rule nor the branch checks nor the probe below can see it: `null`
    // prints the text `null` into a table cell and `""` prints nothing, and the register comes out
    // looking measured. Structural rather than a field list, for the reason the docblock gives.
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

    // **The list above is not the check; this is.** Render, and refuse a document that came out carrying
    // `undefined` or `NaN`. Anything the renderer reads and the capture lacks reds here without anybody
    // listing it, including reads added later.
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

/**
 * The rail's verdict over one record.
 *
 * **Totality against the LIVE recipe set is deliberately not checked**, and the reason is that a record
 * is a historical fact. A recipe added after `0.1.3` was cut does not make `0.1.3`'s record wrong; it
 * makes it a record of an earlier tree, which is what it is for. Totality is a **capture-time** property
 * — `--capture` runs whatever the workspace yields at that moment — and the register prints how many
 * that was. A verify-time totality check would turn every past release red on the commit that adds a
 * rail.
 */
export function verifyRecord(snap, { version, keyedBy = "the file it is named for" }) {
    const red = verifyShape(snap);
    if (red.length > 0) return red;
    if (snap.version !== version) {
        // The source of `version` is named rather than assumed: `--verify` keys every release but the
        // newest from `CHANGELOG.md`, so a message hard-coding *package.json declares* would have been
        // false for all of them — a diagnostic pointing at the wrong file is a diagnostic that sends the
        // next reader to the wrong place.
        red.push(`the record declares version \`${snap.version}\` where ${keyedBy} says \`${version}\` — a record keyed to another release cannot answer for this one`);
    }
    for (const r of snap.recipes) {
        if (r.exit !== 0) {
            red.push(`the record shows \`${r.id}\` at exit ${r.exit} — a release may not carry an eval result that records a rail it did not pass`);
        }
    }
    // **EXACTLY `SELF`, never merely including it.** Requiring presence let a red rail be *relocated*:
    // move `tests` out of `recipes` into `excluded` with any reason string and the record is green, the
    // register prints a smaller denominator and a principled-looking exclusion, and the recipe's own
    // headline — *no record shows a rail at a non-zero exit* — is satisfied by not recording it. A
    // verdict laundered into the exclusion list is worse than a red, because it reads as rigour.
    // `--capture` only ever writes `SELF`, so requiring exactly that costs nothing. Found by a
    // fresh-context reviewer attacking the record layer rather than the code.
    const excludedIds = snap.excluded.map((e) => e.id).sort();
    if (excludedIds.length !== 1 || excludedIds[0] !== SELF) {
        red.push(
            `the record excludes ${excludedIds.length === 0 ? "nothing" : `\`${excludedIds.join("`, `")}\``} where the only ` +
                `admissible exclusion is \`${SELF}\` — anything else is a verdict moved out of the graded set`,
        );
    }
    return red;
}

/** Run every yielded recipe except this module's own, and return the rows. */
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
  node cli/release-eval.mjs --tagged <X.Y.Z> [--repo-root <dir>]

  --capture  RUN every recipe this workspace yields and write ${RECORD_DIR}/<version>.json and .md
             for the version package.json declares. Spends real time — it is the whole recipe set.
  --write    re-render a register from its committed capture. Runs no recipe.
  --verify   the recipe's mode. EVERY governed release CHANGELOG.md records has a record; each
             record's shape; no recorded red; each register byte-compared through this module's own
             renderer; no record for a release that was never cut; and the newest heading agrees
             with package.json.
  --tagged   the release act's mode, for a checkout OF THE TAG: does this tree carry a record for
             the version being published. \`.github/workflows/publish-github-packages.yml\` runs it.

Every governed release stays under the rail permanently, not only the newest: a rail that graded one
record at a time would let an older one be deleted in silence. Releases before ${FIRST_GOVERNED_VERSION}
predate the clause and are not graded.

Exit 0 green · 1 a finding · 2 could not run.`;

const MODES = ["--capture", "--write", "--verify", "--tagged"];

function parse(argv) {
    const out = { mode: null, root: ".", date: null, version: null };
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
            // `--tagged` names the version being published; the others take it optionally.
            if (a === "--tagged") out.version = need("the `X.Y.Z` version being published");
            continue;
        }
        switch (a) {
            case "--repo-root":
                out.root = need("a directory");
                break;
            case "--date": {
                // Validated here rather than trusted: `--date banana` satisfied the parser and the shape
                // check alike, and the usage below promises `YYYY-MM-DD`. The front door was the one
                // reachable route into the degenerate-value class.
                const v = need("a YYYY-MM-DD date");
                if (!ISO_DATE.test(v)) throw new CouldNotRun(`\`--date\` takes a \`YYYY-MM-DD\` date, not \`${v}\``);
                out.date = v;
                break;
            }
            case "--version":
                out.version = need("an `X.Y.Z` version");
                break;
            case "--help":
            case "-h":
                out.mode = "help";
                break;
            default:
                throw new CouldNotRun(`unknown argument \`${a}\``);
        }
    }
    if (out.mode === null) throw new CouldNotRun(`pass one of ${MODES.join(", ")}`);
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
        // **The governance refusal runs FIRST, before any git or workspace read.** It sat after
        // `sourceOf()`, which throws on a tree that is not a git repository — so on the one fixture that
        // exercised it the refusal was never reached, and the case guarding it passed on a
        // `could not read HEAD` it had accidentally allowed through an alternation. A precondition that
        // needs nothing should be checked before the ones that need something.
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
        // **The date is an argument, never `new Date()`.** A capture that stamps itself from the clock
        // cannot be reproduced, and this record is byte-compared.
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
    //
    // **The one surface a check reaches at the moment a person publishes.** It reads the tag's own
    // checkout and asks only its own question — does the tree being published carry a record for the
    // version being published — because everything else about that tree was already graded on the pull
    // request that made it.
    if (parsed.mode === "tagged") {
        // **The argument is the TAG's version, and reading it from `package.json` instead was a hole that
        // made this check green in every reachable variant of the one case it exists for.** Its motivating
        // scenario is a tag created from a tree whose `## Unreleased` accumulator was never renamed — and
        // in that tree `package.json` still declares the PREVIOUS version, so a step that asked
        // `--tagged $(package.json version)` asked about `0.1.2`, got *predates the clause*, and published.
        // The tag is the only thing in that scenario that names what is being released.
        const tagged = parsed.version.replace(/^v/, "");
        let taggedGoverned;
        try {
            taggedGoverned = isGoverned(tagged);
        } catch (e) {
            stderr.write(`release-eval: ${e.message}\n`);
            return 2;
        }
        // **A disagreement is a FINDING, not a note.** It is the scenario itself: the tag says one release
        // and the payload declares another, so one of the two was never moved. Reporting it and continuing
        // would publish the thing this check exists to stop.
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

    // **Cut integrity, and it holds between cuts as well as at one.** The newest heading is the last
    // release cut, and `package.json` is bumped in the same change that renames it — so a disagreement
    // means one of the two moved alone.
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

    // **Everything ON DISK is graded, in both extensions, governed or not.** Three holes closed here,
    // all found by a fresh context attacking the record layer rather than the code:
    //
    //   * a record for a version the clause does NOT govern was ungraded entirely — `--capture` refuses
    //     to write one, so nothing could have produced it honestly, and a hand-written
    //     `evals/releases/0.1.2.json` full of garbage beside a register reading *"all 25 recipes green"*
    //     was green. A version this rail declines to demand a record for is not a version it permits an
    //     unexamined record for;
    //   * the sweep enumerated `.json` only, so a fabricated `<version>.md` with no capture beside it
    //     was invisible — and the register is the reader-facing half, the one place a release's eval
    //     result is written for a reader;
    //   * a record for a version `CHANGELOG.md` never cut sits in the tree looking exactly like evidence.
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
        if (governedReleases.includes(v)) continue; // already graded above
        red.push(`${RECORD_DIR}/${v}.* is present but was not graded — this is a bug in the rail, not in the tree`);
    }
    // A register with no capture beside it: the reader-facing half standing alone.
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

/** Read one version's capture. `snap: null` is *no record*; `couldNotRun` is *a record nothing could read*. */
function readRecord(root, version) {
    const abs = path.join(root, snapshotPath(version));
    if (!existsSync(abs)) return { snap: null };
    try {
        return { snap: JSON.parse(readFileSync(abs, "utf8")) };
    } catch (e) {
        return { couldNotRun: `${snapshotPath(version)} is not valid JSON: ${e.message}` };
    }
}

/** One record's full verdict: its contents, and its register byte-compared. */
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
