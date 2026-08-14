#!/usr/bin/env node
// A change to a pack's `contributes` must move that pack's `portulan.version`.
//
// Ruled by the maintainer on `#265`, 2026-08-14, in three parts: **arm 3** — a rail rather than a
// convention; **a prose-only edit counts**, so a fragment whose `reason` alone changes owes the bump;
// and the field is **`pack.json`'s `portulan.version`**, not the packs plugin's bundle version.
//
// ## Why the field is the pack's own
//
// `packs/.claude-plugin/plugin.json` versions the *bundle*. Measured on `c93a819`: it reads `0.2.1`,
// `rituals/checkpoints` reads `0.2.1` and `tools/github` reads `0.1.0` — so the bundle agrees with one
// pack by coincidence and cannot track both, and two packs changing in one pull request would contend
// for a single field. `portulan.version` is per-pack, so it cannot contend. Tying the bundle to the pack
// manifests is arm 4 of the issue and is deliberately NOT here.
//
// ## Why the whole `contributes` block, not only `gates`
//
// The issue's title asks about gate fragments; arm 3's own text says *"touching a pack's `contributes`
// block"*, and arm 3 is what was ruled — confirmed by the maintainer when the two readings were put to
// him. Skills, personas and verify recipes reach every composing workspace by the same route a gate
// fragment does.
//
// ## THREE-DOT, and it is not a detail
//
// The comparison is `base...head` — from the **merge-base** to the head — never `base..head`.
// Demonstrated rather than asserted, and pinned in `./pack-version.test.mjs`: with a branch that changes
// `pack.json` while the base branch independently changes another file, two-dot reports BOTH files and
// three-dot reports only the branch's. A rail on two-dot would red a pull request because somebody else
// bumped a version upstream, and would read a `contributes` change the pull request never made.
//
// `git diff A...B` is exactly `git diff $(git merge-base A B) B`, so this resolves the merge-base once
// and reads each base manifest at that commit. No diff is parsed: the manifests are compared as VALUES,
// which is what makes a reformatting-only edit — whitespace, key order — correctly *not* a change.
//
// ## Exit codes, and the middle one is the point
//
//   0  every changed pack moved its version
//   1  a pack changed `contributes` and did not move `portulan.version`
//   2  could not run — no repository, no base ref, no merge-base, or a manifest that will not parse
//
// **2 is never 1.** A rail that cannot read its input must not report green, and must not report red
// either: a red verdict is a claim about the work, and "I could not look" is a claim about the check.
// That is `../.portulan/memory/verify-preconditions-fail-closed.md`'s rule and the doctrine `#208` is
// open about for the sibling scanner. It matters most here because `actions/checkout` is shallow by
// default — `../cli/librarian.mjs` calls that "not a theoretical clone; it is the *normal* one" — so a
// missing merge-base is the ordinary case on an unprepared runner, not an exotic one.
//
// ## What "moved" means, stated because the ruling's word was "moves"
//
// **Any change to the string counts, including absent → present.** It is deliberately NOT "the SemVer
// increased": this rail enforces the maintainer's word, and reading an ordering into it would be the
// rail deciding a policy it was not given — `0.2.0` → `0.1.0` is a different question, and a bad answer
// to it, but it is not this one. Absent → present has to count, or a pack red for having no version
// could never discharge that red. Present → absent is the `unversioned` red, from the head side.
//
// ## What this rail does NOT see, named rather than left to be discovered
//
// It compares the `contributes` **block**. Content the block merely *points at* — a skill's `SKILL.md`
// body, a persona file, the shell script a contributed verify recipe names — reaches every adopting
// workspace and can change without touching `pack.json` at all. Inline material is covered: gate
// fragments live in the manifest, and so do recipe objects. Pointed-at files are not. That is `#259`'s
// class — a rail narrower than the sentence around it — and it is stated here rather than closed,
// because widening it is a different change with a different argument. A rename, or a delete-plus-add
// under a new name, likewise passes as `deleted` + `added`.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Raised when the check cannot run, or cannot judge honestly. Always exit 2, never 1. */
export class CannotRun extends Error {}

const DEFAULT_BASE = "origin/main";

/**
 * Run git, or say why it could not.
 *
 * `stdio` pins stderr to a pipe so a failure's own message rides into the exception rather than
 * leaking to the terminal and leaving the thrown error to say only "command failed".
 */
function git(root, args, what) {
    try {
        return execFileSync("git", ["-C", root, ...args], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
    } catch (cause) {
        throw new CannotRun(`git could not ${what} — ${cause.stderr?.toString().trim() || cause.message}`);
    }
}

/**
 * The merge-base of `base` and `HEAD`, which IS the three-dot comparison point.
 *
 * **A shallow clone reaches this function by TWO different routes, and an earlier draft of these
 * messages knew about only one.** Measured on git, both shapes built as fixtures:
 *
 *   - `--depth 1` alone is also `--single-branch`, so `origin/main` is **not fetched at all** and the
 *     failure is an unknown ref. This is the common CI shape.
 *   - `--depth 1 --no-single-branch` fetches the ref and truncates its history, so the ref resolves and
 *     **no merge-base exists**.
 *
 * So both messages name `fetch-depth: 0` — a reader who lands on either one is most likely looking at a
 * shallow checkout — while staying distinguishable, because the *other* causes differ: an unknown ref
 * can also be a typo or an unfetched remote, and a missing merge-base can also be genuinely unrelated
 * histories. Naming only one of the two would send half of the readers to the wrong repair.
 */
// **`--end-of-options` on every call that takes the caller's ref**, because `base` is user-supplied —
// `PORTULAN_BASE_REF`, or `--base` — and git will otherwise read a value that starts with `-` as a FLAG.
// Measured on git 2.50.1: `git merge-base --is-ancestor HEAD` is parsed as the `--is-ancestor` option and
// exits 129, so the command silently stops being a merge-base lookup and becomes an ancestry test. With
// the guard it exits 128, refused as a ref, which is what a bad ref should do.
//
// `rev-parse` was already shielded by accident rather than by design: the `^{commit}` suffix makes
// `--help^{commit}` an unparseable revision rather than a flag. Guarded anyway, so the protection is
// stated instead of resting on a suffix somebody could reasonably remove.
//
// _(Copilot proposed `--` for both, and it is the wrong separator here: measured,
// `git rev-parse --verify -- HEAD^{commit}` exits **128** — `--` marks the start of PATHS for rev-parse,
// so the fix would have broken every call. Raised on #274, round 2; the concern was right and the
// mechanism was not.)_
const END = "--end-of-options";

export function mergeBase(root, base = DEFAULT_BASE) {
    const shallowHint =
        "`actions/checkout` is shallow by default — `../cli/librarian.mjs` calls that the normal clone rather than a " +
        "theoretical one — so the usual repair is `fetch-depth: 0` on the job running this check; see .github/workflows/verify.yml.";
    try {
        git(root, ["rev-parse", "--verify", END, `${base}^{commit}`], `resolve ${base}`);
    } catch (cause) {
        // The cause rides along. A bare `catch {}` here reported EVERY failure of this command as an
        // unknown ref — including a corrupt object store, a permissions failure, or a git that would not
        // start — so the message named the one cause it could think of and discarded the one git gave.
        // `git()` has already captured that stderr; throwing it away and substituting a guess is the
        // wrong-mechanism-in-a-user-facing-string class this repository keeps finding. Raised by Copilot
        // on #274, round 4 — and its round 6 caught that the FIX was half-done: the cause rode along
        // while the leading clause still asserted `is not in this repository`, so the sentence stated one
        // cause as fact and listed the alternatives underneath it. It now says what HAPPENED (could not
        // resolve) and ranks the causes as causes. The defect class named in this very comment, surviving
        // one round inside the repair for it.
        throw new CannotRun(
            `could not resolve base ref \`${base}\` — refusing to report a verdict against a ref nothing could read. ` +
                `The usual cause is a SHALLOW single-branch clone, which does not fetch it at all; a typo or an ` +
                `unfetched remote look the same from here, and so does a repository that cannot be read at all. ` +
                `${shallowHint} — git said: ${cause.message}`,
        );
    }
    try {
        return git(root, ["merge-base", END, base, "HEAD"], `find the merge-base of ${base} and HEAD`).trim();
    } catch (cause) {
        throw new CannotRun(
            `no merge-base between \`${base}\` and HEAD, though the ref itself resolved — a SHALLOW clone that fetched ` +
                `the ref and truncated its history looks exactly like this, as do genuinely unrelated histories. ` +
                `${shallowHint} — git said: ${cause.message}`,
        );
    }
}

/**
 * `--packs` as a repository-relative path, or a refusal.
 *
 * The flag is documented as *relative to the repository root* and, until #274's round 2, the parser took
 * that on trust. Measured: `path.join("/repo", "../../etc")` is `/etc`, so `--packs ../..` sent the
 * filesystem scan **outside the repository** — and the escape was invisible in the result, because
 * `git ls-tree` then refused the same path and the run ended at exit 2 for a reason that named the wrong
 * thing. Containment is checked after resolution rather than by pattern, since a `..` chain satisfies any
 * regex and still escapes; the same shape `../compile.mjs`'s `policyPath` uses for the same reason.
 *
 * An absolute path is refused outright rather than silently re-rooted: `path.join` turns `/etc` into
 * `<root>/etc`, which is *contained* and is not what the caller asked for, and a flag that quietly means
 * something else is worse than one that refuses.
 */
// **It returns the CANONICAL path, and the first draft returned the caller's spelling.** That was a
// correctness defect rather than untidiness, and it produced a false green. `--packs packs/../packs`
// validated fine — it resolves inside — and then the two halves of `compare` disagreed about what a pack
// is called: the filesystem scan joined the raw value (`packs/../packs/tools/github/pack.json`) while
// `git ls-tree` canonicalised its pathspec (`packs/tools/github/pack.json`). Measured: every pack was
// reported TWICE, once `added` from the uncanonical spelling and once `unchanged` from git's — and
// `added` is exempt, so a real unbumped change would have passed. Raised by Copilot on #274, round 3.
export function insideRepo(value) {
    if (path.isAbsolute(value)) {
        throw new CannotRun(
            `--packs ${value} is an absolute path — this flag names a directory RELATIVE to the repository root, and ` +
                `joining an absolute path would silently re-root it under the repository instead of refusing.`,
        );
    }
    // Normalised, then checked — a `..` chain satisfies any pattern and still escapes, so containment is
    // decided on the resolved form. Separators are forced to `/` because every downstream consumer is a
    // git pathspec or a repository-relative id, neither of which is a platform path.
    const canonical = path.normalize(value).split(path.sep).join("/").replace(/\/+$/, "");
    if (canonical === "" || canonical === "." || canonical === ".." || canonical.startsWith("../")) {
        throw new CannotRun(
            `--packs ${value} resolves to ${JSON.stringify(canonical)}, which is not a directory inside the repository — ` +
                `refusing to scan somewhere this check has no business reading.`,
        );
    }
    return canonical;
}

/**
 * Every pack manifest in the tree, as repository-relative paths, sorted so output is stable.
 *
 * **ENOENT is the only benign failure, and an earlier draft of this function treated every failure as
 * benign.** A bare `catch { return [] }` turns an unreadable `packs/` — wrong permissions, a broken
 * symlink, a mount that went away — into *the empty set*, and an empty set is a **green**. That is the
 * shape `../.portulan/memory/verify-preconditions-fail-closed.md` exists about: a recipe that enumerates
 * nothing and reports success has described the machine rather than the work. So the absent directory is
 * an answer (a workspace that composes nothing has no manifests to check) and everything else is a
 * refusal. Found by the session-open checkpoint, which asked what guards the enumeration.
 */
export function packManifests(root, packsDir = "packs") {
    const base = path.join(root, packsDir);
    const found = [];
    const read = (dir, what) => {
        try {
            return fs.readdirSync(dir, { withFileTypes: true });
        } catch (cause) {
            if (cause.code === "ENOENT") return null;
            throw new CannotRun(
                `cannot read ${what} at ${dir} — ${cause.code ?? cause.message}. Refusing to report an empty set of packs ` +
                    `as a clean one: an enumeration that could not run is not a finding that nothing changed.`,
            );
        }
    };
    const categories = read(base, `the packs directory`);
    if (categories === null) return [];
    for (const category of categories) {
        if (!category.isDirectory()) continue;
        const packs = read(path.join(base, category.name), `the pack category \`${category.name}\``);
        if (packs === null) continue;
        for (const pack of packs) {
            if (!pack.isDirectory()) continue;
            const rel = [packsDir, category.name, pack.name, "pack.json"].join("/");
            if (fs.existsSync(path.join(root, rel))) found.push(rel);
        }
    }
    return found.sort();
}

// **ABSENCE IS A FACT FROM THE LISTING, NEVER AN INFERENCE FROM A FAILED READ.** Both readers below got
// this wrong in the same way, one function apart from the `readdir` guard that got it right — a fix that
// missed its own siblings inside a single change, which is `0020`'s shape at its smallest. Demonstrated:
// `chmod 000` on a tracked `pack.json` made this report the pack **deleted** and exit **0**, so a
// permissions accident read as an intentional removal and the whole rail went quiet. Found by the
// pre-commit checkpoint, which attacked the readers after the enumeration guard was added rather than
// assuming the class had been swept.

/**
 * A manifest as it stood at `commit`, or `null` where it genuinely did not exist there.
 *
 * `present` is the caller's listing from `ls-tree` at that same commit, and it is what decides absence —
 * `git show` failing is then always a refusal, never a shrug. Matching on git's stderr would be the
 * other way to tell the two apart, and it would be a string comparison against another tool's prose.
 */
export function manifestAt(root, commit, rel, present) {
    if (!present) return null;
    const raw = git(root, ["show", `${commit}:${rel}`], `read ${rel} at ${commit.slice(0, 7)}`);
    try {
        return JSON.parse(raw);
    } catch (cause) {
        throw new CannotRun(
            `${rel} at ${commit.slice(0, 7)} is not valid JSON — ${cause.message}. Refusing a verdict on a manifest ` +
                `this check cannot read; \`json\` and \`doctor\` are the tools that judge manifest validity.`,
        );
    }
}

/**
 * The manifest in the working tree, or `null` where the pack has genuinely been deleted.
 *
 * **`lstat` decides whether the file is there; `readFileSync`'s ENOENT does not.** Third instance of one
 * class in this file, and the sharpest: a **dangling symlink** at `pack.json` makes `readFileSync` throw
 * ENOENT while the path itself plainly exists — measured, `lstat` succeeds and reports
 * `isSymbolicLink: true` — so an ENOENT-only carve-out reported a present-but-unreadable manifest as a
 * pack somebody deleted, at exit 0. The same shape as the `readdir` guard and the absent-vs-unreadable
 * repair before it, at a site both of those left alone.
 *
 * The lstat-first pattern is not invented here: `./control-chars.mjs`'s `bytesOf` already does exactly
 * this, for exactly this reason, down to the sentence — *"Refusing to report it clean: this is a fact
 * about the filesystem, not about the file."* Raised by Copilot on #274, round 7, which also supplied the
 * precedent.
 */
export function manifestHere(root, rel) {
    const file = path.join(root, rel);
    try {
        // `lstat`, not `stat`: `stat` follows the link and would throw ENOENT for the dangling case,
        // which is the very confusion this guard exists to end.
        fs.lstatSync(file);
    } catch (cause) {
        if (cause.code === "ENOENT") return null;
        throw new CannotRun(
            `cannot stat ${rel} — ${cause.code ?? cause.message}. Refusing to report it as removed: this is a fact ` +
                `about the filesystem, not about the pack.`,
        );
    }
    let raw;
    try {
        raw = fs.readFileSync(file, "utf8");
    } catch (cause) {
        // The path EXISTS — `lstat` just said so — so every failure here is the check unable to look:
        // a dangling symlink, EACCES, EISDIR, a symlink loop. None of them is a deletion.
        throw new CannotRun(
            `cannot read ${rel} — ${cause.code ?? cause.message}. The path exists, so this is not a removal: a ` +
                `dangling symlink, an unreadable mode or a directory in its place all land here.`,
        );
    }
    try {
        return JSON.parse(raw);
    } catch (cause) {
        throw new CannotRun(`${rel} is not valid JSON — ${cause.message}. Refusing a verdict on a manifest this check cannot read.`);
    }
}

/**
 * Deep value equality over parsed JSON, which is deliberately NOT a text comparison.
 *
 * Reformatting a manifest — reindenting, reordering keys — changes its bytes and changes nothing a
 * composing workspace yields, so it must not owe a version bump. Comparing values is what makes that
 * true, and it is why this reads the manifests rather than parsing `git diff`.
 */
export function sameValue(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
        // Order IS significant in an array: `contributes.gates` is an ordered list, and `composeFragments`
        // applies fragments in the order it finds them, so a reordering can change what a workspace yields.
        return a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
    }
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i]) && ka.every((k) => sameValue(a[k], b[k]));
}

/**
 * Judge one pack. Returns `{ rel, verdict, why }` with verdict `ok` | `unchanged` | `added` | `deleted`
 * | `stale` | `unversioned`.
 *
 * The two reds are told apart because they need different sentences: `stale` has a version and did not
 * move it, `unversioned` has no version to move.
 */
export function judge(rel, before, after) {
    if (after === null) return { rel, verdict: "deleted", why: "the pack was removed" };
    if (before === null) {
        // An added pack has no prior state to bump FROM, so no bump is owed. Whether a new pack must
        // declare a version at all is a Pack Definition question — `spec/pack.schema.json` currently
        // makes `portulan.version` optional — and annexing it here would be this rail deciding a schema
        // rule it was not given. Named in `#265` as a hole with a shape, left to the schema.
        return { rel, verdict: "added", why: "the pack is new — nothing to bump from" };
    }
    if (sameValue(before?.contributes, after?.contributes)) {
        return { rel, verdict: "unchanged", why: "`contributes` is unchanged" };
    }
    const was = before?.portulan?.version;
    const now = after?.portulan?.version;
    if (typeof now !== "string" || now === "") {
        return {
            rel,
            verdict: "unversioned",
            why:
                "`contributes` changed and this pack declares no `portulan.version` to move. The field is optional in " +
                "`spec/pack.schema.json`, and its own description calls it how independent versioning is expressed — " +
                "declare one, because a consumer pinning this pack has nothing else to pin on",
        };
    }
    if (now === was) {
        return {
            rel,
            verdict: "stale",
            why: `\`contributes\` changed and \`portulan.version\` stayed at \`${now}\`. A prose-only edit to a fragment's \`reason\` counts — it is the sentence the gate runner shows a human`,
        };
    }
    return { rel, verdict: "ok", why: `\`contributes\` changed and \`portulan.version\` moved \`${was ?? "(absent)"}\` → \`${now}\`` };
}

/**
 * Compare every pack in the tree against the merge-base.
 *
 * `packsNamed` says whether the caller *chose* `packsDir`, and it decides what an empty result means.
 * **A directory that is absent is an answer only when nobody named it.** The default `packs/` missing is
 * a workspace that composes nothing — green, correctly. But `--packs paks`, a typo, found nothing at head
 * and nothing at the merge-base and reported *"nothing to check"* at exit **0**: a false green, and a
 * bypass anyone experimenting locally could reach by accident. Measured. So a named directory that exists
 * in neither tree is a refusal, and the ENOENT carve-out in `packManifests` keeps its narrower job.
 * Raised by Copilot on #274, round 5 — on the `Copilot` login of the comments endpoint rather than the
 * `copilot-pull-request-reviewer[bot]` login of `/reviews`, which is the two-logins gotcha this
 * repository already records.
 */
export function compare(root, { base = DEFAULT_BASE, packsDir = "packs", packsNamed = false } = {}) {
    const at = mergeBase(root, base);
    // The union of what exists NOW and what existed at the merge-base — a pack deleted in this change
    // has no working-tree manifest and would otherwise never be looked at. It is green either way, but
    // being green by having been considered is not the same as being green by being invisible.
    const here = packManifests(root, packsDir);
    const there = git(root, ["ls-tree", "-r", "--name-only", at, "--", `${packsDir}/`], `list packs at ${at.slice(0, 7)}`)
        .split("\n")
        .filter((line) => line.endsWith("/pack.json"));
    if (packsNamed && here.length === 0 && there.length === 0 && !fs.existsSync(path.join(root, packsDir))) {
        throw new CannotRun(
            `--packs ${packsDir} names a directory that exists neither in the working tree nor at the merge-base. ` +
                `Refusing to report green having examined nothing: an empty set is a verdict about packs, and this is a ` +
                `verdict about the path you typed. (The DEFAULT \`packs/\` being absent is different — that is a ` +
                `workspace which composes nothing, and it passes.)`,
        );
    }
    const atBase = new Set(there);
    const all = [...new Set([...here, ...there])].sort();
    return {
        at,
        results: all.map((rel) => judge(rel, manifestAt(root, at, rel, atBase.has(rel)), manifestHere(root, rel))),
    };
}

function usage() {
    return [
        // NOT `portulan pack-version` — `./portulan.mjs` has eight subcommands and this is not one of
        // them (measured: it answers "unknown subcommand"), and its own header forbids minting a ninth.
        // The sibling checkers carry no `portulan <name>` banner either. This is the form the verify
        // recipe actually runs, which is the only invocation that exists.
        "pack-version — a change to a pack's `contributes` must move its `portulan.version`",
        "",
        "  node cli/pack-version.mjs [--base <ref>] [--packs <dir>] [<repository-root>]",
        "",
        "  --base    what to compare against; default `origin/main`. Compared THREE-DOT: the merge-base",
        "            of this ref and HEAD, which is what a pull request shows",
        "  --packs   the packs directory, relative to the repository root; default `packs`",
        "",
        "Ruled on #265: the whole `contributes` block, and a prose-only edit to a `reason` counts.",
        "",
        "Exit codes: 0 green · 1 a red verdict · 2 could not run.",
    ].join("\n");
}

export function run(argv = [], { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
    // Before every other argument decision, so asking for help cannot be outranked by a complaint about
    // the rest of the command line — the contract `./portulan.mjs` states.
    if (argv.includes("--help") || argv.includes("-h")) {
        stdout.write(`${usage()}\n`);
        return 0;
    }
    let base = DEFAULT_BASE;
    let packsDir = "packs";
    let packsNamed = false;
    let root = null;
    try {
        for (let i = 0; i < argv.length; i += 1) {
            if (argv[i] === "--base" || argv[i] === "--packs") {
                const which = argv[i];
                const value = argv[i + 1];
                i += 1;
                // A single leading `-` is refused too, not just `--`: `--base --packs` would otherwise
                // consume the next flag as a ref and fail later as an unreadable one. The three tools in
                // `cli/` that take a directory already read it this way; this aligns with them rather
                // than inventing. _(A draft used `--base -h` as the example, which never reaches here:
                // `--help` is answered before any other argument decision, so that spelling exits 0 on
                // the help path. Measured.)_
                if (value === undefined || value.startsWith("-")) throw new CannotRun(`${which} needs a value`);
                if (which === "--base") base = value;
                else {
                    packsDir = insideRepo(value);
                    packsNamed = true;
                }
            } else if (argv[i].startsWith("-")) {
                throw new CannotRun(`unknown argument ${JSON.stringify(argv[i])}`);
            } else if (root === null) {
                root = argv[i];
            } else {
                throw new CannotRun(`unexpected second repository root ${JSON.stringify(argv[i])}`);
            }
        }
        const where = path.resolve(root ?? cwd);
        // Resolved to the repository top level rather than trusting the argument: a caller invoking this
        // from a subdirectory would otherwise have every `packs/…` path resolved against the wrong root,
        // which is #131's class — paths against the author's layout.
        const top = git(where, ["rev-parse", "--show-toplevel"], `find a git repository at ${where}`).trim();

        const { at, results } = compare(top, { base, packsDir, packsNamed });
        const red = results.filter((r) => r.verdict === "stale" || r.verdict === "unversioned");
        const moved = results.filter((r) => r.verdict === "ok");

        stdout.write(`pack-version: comparing against \`${base}\` at merge-base ${at.slice(0, 7)} (three-dot)\n`);
        // Every pack is printed, not only the failures. A rail that prints only reds cannot be told from
        // one that examined nothing — the same reason `compile` prints its refusals on every run. The
        // `ok` rows carry their `why` too, so a green states WHICH version moved rather than leaving a
        // reader to diff the manifest to find out what the rail approved.
        for (const r of results) {
            stdout.write(`  ${r.verdict.padEnd(12)} ${r.rel}${r.verdict === "ok" ? ` — ${r.why}` : ""}\n`);
        }
        if (results.length === 0) stdout.write("  (no pack manifests here or at the merge-base — nothing to check)\n");

        if (red.length === 0) {
            stdout.write(`\nok  ${moved.length} pack(s) changed \`contributes\` and moved their version; ${results.length} examined\n`);
            return 0;
        }
        stderr.write("\n");
        for (const r of red) stderr.write(`RED  ${r.rel} — ${r.why}\n`);
        stderr.write(`\n${red.length} pack(s) changed \`contributes\` without moving \`portulan.version\` (#265).\n`);
        return 1;
    } catch (error) {
        if (error instanceof CannotRun) {
            stderr.write(`pack-version: ${error.message}\n`);
            return 2;
        }
        // **A CRASH IS A COULD-NOT-RUN, NOT A RED**, and this file's own header says so two screens up
        // while an earlier draft did the opposite: an uncaught throw left node exiting **1**, which the
        // recipe faithfully printed as *"RED — verify recipe failed"*. So a TypeError in this checker
        // accused the pull request of a policy breach it had not committed — the exact defect `#208` is
        // open about in the sibling scanner, shipped new in the change that cites it. Demonstrated by
        // the pre-commit checkpoint with an injected throw.
        //
        // The stack is printed rather than swallowed: a crash must stay loud, it just must not wear a
        // verdict it did not earn.
        stderr.write(`pack-version: CRASHED — ${error?.stack ?? error}\n`);
        stderr.write("pack-version: reporting could-not-run (2) rather than a red verdict — a defect in this checker is not a finding about the work.\n");
        return 2;
    }
}

function isMain() {
    return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}

if (isMain()) {
    process.exitCode = run(process.argv.slice(2));
}
