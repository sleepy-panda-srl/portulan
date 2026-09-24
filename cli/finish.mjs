#!/usr/bin/env node
// The finishing command — one call closes a change: its recipes, its changelog fragment, its commit, its push.
//
//   node cli/finish.mjs -m <subject> [-m <paragraph>]... [options]
//   node cli/finish.mjs -F <file | -> [options]
//
// The end of a change was a run of small requests — the recipes, the fragment, `git add`, `git commit`,
// `git push`, a look at the status — and every one of them sent the whole context again. This is one call.
// In order, it:
//
//   1. finds the branch, the remote it pushes to and the base it merges into, and refuses a detached HEAD,
//      the base branch itself, and a base that names no branch, since nothing could be compared with it: a
//      change closes on a working branch and never pushes to its base;
//   2. confirms the change carries a changelog fragment, `changes/<slug>.<section>.md`, added or edited
//      since the base, where the tree keeps them; `--no-fragment <why>` closes a change that owes none;
//   3. stages the changes to files git already tracks, beside whatever is staged, and commits them with the
//      message given, the repository's hooks included: never `--amend`, never `--no-verify`. It never stages
//      a file nobody named: an untracked one stops it, listed, so a new file is staged by name in the same
//      call (`git add <paths> && node cli/finish.mjs …`), and a scan of what is staged covers what it commits;
//   4. runs every recipe the workspace yields, as CI runs them, on that commit;
//   5. pushes the commit the recipes judged, by name and only while the branch still holds it, never with
//      `--force` in any spelling — or, where a recipe is not green, pushes nothing, undoes its own commit and
//      prints which recipe went red, with the last lines it wrote, in the order it wrote them.
//
// **The recipes judge the commit, not the tree before it**, because a recipe may read the commit: `docs`
// checks the newest commit's message for its `Seam-scan:` line. Run before committing, it would judge the
// commit before this one, and a missing trailer would first go red in CI. So the commit comes first, and a
// red undoes it: the branch is moved back over a commit this call made and no remote has seen, with a
// compare-and-swap that refuses if anything else moved it, and the commit's changes are left staged. That
// is not an amend: nothing published is rewritten, and a message the recipes refused could not be mended by
// a second commit on top of it.
//
// **It satisfies the Stop-gate rather than stepping round it** (`./stop-gate.mjs`): the default recipe is
// one of the set, and a closed change leaves the tree clean and the branch pushed, which owes no handoff.
// Every recipe runs, not only the default, because done is every recipe green (the workspace's definition of
// done says so here) and CI runs them all; no recipe declares the paths it checks, so no smaller set could
// be read off the change. They took 43 s on this repository on 2026-09-24.
//
// What it prints is budgeted (`0038`, rule 5): one line when the change closes, and when it stops, one line
// saying why and nothing committed or pushed, then each recipe that was not green with its last 25 lines,
// the Stop-gate's measure. Passes are a count.
//
// Exit 0 closed, or nothing to close · 1 red: a recipe, the fragment, an untracked file, or a hook that
// refused the commit · 2 could not run: an argument, git, the base, the recipe set, a recipe that could not
// run, or a push the remote refused. A recipe that could not run is never read as a pass.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { AUTO, discoverPackRoots, namedWithAuto } from "./discover.mjs";
import { packRoots, resolvePack } from "./compile.mjs";
import { CHANGES_DIR, CHANGES_README } from "./form.mjs";
import { CHANGE_NAME } from "./index.mjs";
import { recipeSet, resolverFor } from "./recipe-set.mjs";

/** How long one recipe may run: `./drills.mjs`'s rail timeout, since both run the whole recipe set. */
export const RECIPE_TIMEOUT_MS = 10 * 60 * 1000;

/** How many of a failing recipe's last lines are printed: the Stop-gate's measure. */
export const TAIL_LINES = 25;

const GIT_TIMEOUT_MS = 2 * 60 * 1000;

/** A recipe's exit codes that are not a verdict about the tree, as `./stop-gate.mjs` reads them. */
const CANNOT_RUN = new Set([2, 126, 127]);

const USAGE = [
    "usage: node cli/finish.mjs -m <subject> [-m <paragraph>]... [options]",
    "       node cli/finish.mjs -F <file | -> [options]",
    "",
    "  -m <text>            a paragraph of the commit message, the first its subject, as git takes -m",
    "  -F <file | ->        the whole commit message, from a file or from standard input",
    "  --no-fragment <why>  the change owes no changelog fragment, and why",
    "  --base <ref>         the branch the change merges into; else PORTULAN_BASE_REF, else the remote's HEAD",
    "  --workspace <dir>    the workspace whose recipes run; else PORTULAN_WORKSPACE, else .portulan at the root",
    "  --pack-root <dir>    where composed packs resolve, repeatable, or auto, as recipe-set takes it",
    "",
    "Commits the changes to tracked files and whatever is staged; an untracked file stops it, so stage a new one",
    "by name in the same call: git add <paths> && node cli/finish.mjs ...",
    "Runs every recipe on the commit it makes, then pushes; on a red it undoes that commit and pushes nothing.",
    "exit 0 closed · 1 red: a recipe, the fragment, an untracked file or a commit hook · 2 could not run or push",
].join("\n");

const TAKES_VALUE = new Set(["-m", "-F", "--no-fragment", "--base", "--workspace", "--pack-root"]);

/**
 * The options, or `{ error }`. Every value is refused when missing or empty, and every value but a message
 * paragraph and a reason when it looks like a flag: `recipe-set`'s three refusals, since a flag taken for a
 * value names a directory nobody asked for.
 */
export function parseArgs(argv, cwd = process.cwd()) {
    const options = { paragraphs: [], file: null, noFragment: null, base: null, workspace: null, named: [], forced: false, help: false };
    for (let i = 0; i < argv.length; i += 1) {
        const flag = argv[i];
        if (flag === "--help" || flag === "-h") {
            options.help = true;
            continue;
        }
        if (!TAKES_VALUE.has(flag)) return { error: `unknown argument ${JSON.stringify(flag)}` };
        const value = argv[i + 1];
        i += 1;
        if (value === undefined) return { error: `${flag} needs a value` };
        if (value.trim() === "") return { error: `${flag} was given an empty value` };
        const prose = flag === "-m" || flag === "--no-fragment";
        if (!prose && value !== "-" && value.startsWith("-")) return { error: `${flag} was given ${JSON.stringify(value)}, which is a flag rather than a value` };
        if (flag === "-m") options.paragraphs.push(value);
        else if (flag === "-F") {
            if (options.file !== null) return { error: "-F was given twice" };
            options.file = value;
        } else if (flag === "--no-fragment") options.noFragment = value.trim();
        else if (flag === "--base") options.base = value;
        else if (flag === "--workspace") options.workspace = path.resolve(cwd, value);
        else if (value === AUTO) options.forced = true;
        else {
            let stat = null;
            try {
                stat = fs.statSync(path.resolve(cwd, value));
            } catch {
                // Reported below as not a directory.
            }
            if (!stat?.isDirectory()) return { error: `--pack-root ${JSON.stringify(value)} is not a directory` };
            options.named.push(path.resolve(cwd, value));
        }
    }
    if (options.file !== null && options.paragraphs.length > 0) return { error: "-m and -F both give the message; pass one of them" };
    const both = namedWithAuto(options.named, options.forced);
    if (both) return { error: both };
    return options;
}

/** The commit message the options give, or null where they give none; `{ error }` where the file cannot be read. */
export function messageOf(options, readStdin = () => fs.readFileSync(0, "utf8")) {
    if (options.file === null) return options.paragraphs.length ? options.paragraphs.join("\n\n") : null;
    let text;
    try {
        text = options.file === "-" ? readStdin() : fs.readFileSync(options.file, "utf8");
    } catch (error) {
        return { error: `the message file ${options.file} could not be read — ${error.code ?? error.message}` };
    }
    return text.trim() === "" ? { error: `the message in ${options.file === "-" ? "standard input" : options.file} is empty` } : text;
}

function gitAt(cwd, env) {
    return (args, { input, timeout = GIT_TIMEOUT_MS } = {}) => {
        const r = spawnSync("git", args, { cwd, env, input, encoding: "utf8", timeout, maxBuffer: 64 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
        return { status: r.error ? null : r.status, out: (r.stdout ?? "").trim(), raw: r.stdout ?? "", err: `${r.stderr ?? ""}${r.error ? r.error.message : ""}`.trim() };
    };
}

const tail = (text, lines = TAIL_LINES) => text.trim().split("\n").slice(-lines).join("\n");

const lastLine = (text) => tail(text, 1) || "no output";

/** Why git refused a push: its `! [rejected]` line, which names the ref and the reason, not a `hint:` after it. */
const refusalOf = (text) => text.split("\n").map((line) => line.trim().replace(/\s+/g, " ")).find((line) => line.startsWith("! ")) ?? lastLine(text);

/**
 * The branch this change merges into: `--base`, else `PORTULAN_BASE_REF` as the recipes read it, else the
 * remote's own recorded default head — never a branch picked by name, `./stop-gate.mjs`'s rule — asked of
 * the remote where the clone never recorded one. `{ ref, sha, name }`, where `name` is the branch the base
 * is on this remote or locally, or `{ why }`.
 */
export function findBase(git, { remote, remotes = [remote], given, env }) {
    const asked = given ?? (env.PORTULAN_BASE_REF || null);
    let full;
    if (asked !== null) {
        const from = given === null ? ", from PORTULAN_BASE_REF," : "";
        // A ref never begins with a dash, and refusing one here spares every git call below an option it would
        // read as a flag: `--end-of-options` is not honoured by every git's `rev-parse --symbolic-full-name`,
        // which echoes it back as though it were the name (git 2.43, measured).
        if (asked.startsWith("-")) return { why: `the base ${JSON.stringify(asked)}${from} is not a ref: a ref never begins with a dash` };
        const sha = git(["rev-parse", "--verify", "-q", `${asked}^{commit}`]);
        if (sha.status !== 0 || sha.out === "") return { why: `the base ${JSON.stringify(asked)}${from} is not a commit here` };
        full = git(["rev-parse", "--symbolic-full-name", asked]).out;
        return { ref: asked, sha: sha.out, name: branchOn(full, remotes) };
    }
    full = git(["symbolic-ref", "-q", `refs/remotes/${remote}/HEAD`]).out;
    if (full === "") {
        const listed = git(["ls-remote", "--symref", remote, "HEAD"], { timeout: 30_000 });
        const head = listed.status === 0 ? /^ref: refs\/heads\/(\S+)\tHEAD$/m.exec(listed.raw) : null;
        if (head === null) return { why: `${remote} has no default head recorded here and did not name one when asked — pass --base <ref>` };
        full = `refs/remotes/${remote}/${head[1]}`;
    }
    const ref = full.replace(/^refs\/remotes\//, "");
    const sha = git(["rev-parse", "--verify", "-q", `${full}^{commit}`]);
    if (sha.status !== 0) return { why: `the base ${ref} is not fetched here — fetch it, or pass --base <ref>` };
    return { ref, sha: sha.out, name: branchOn(full, remotes) };
}

/** The branch a full ref names, locally or on one of `remotes`, or null for anything else: a commit, a tag. */
function branchOn(full, remotes) {
    if (full.startsWith("refs/heads/")) return full.slice("refs/heads/".length);
    const on = [...remotes].sort((a, b) => b.length - a.length).find((r) => full.startsWith(`refs/remotes/${r}/`));
    return on === undefined ? null : full.slice(`refs/remotes/${on}/`.length);
}

/** The paths this change touched since `mergeBase`, committed or not, with their status: `A`, `M`, `D` or `?` for untracked. */
export function changedPaths(git, mergeBase) {
    const out = [];
    const fields = git(["diff", "--name-status", "--no-renames", "-z", mergeBase, "--"]).raw.split("\0");
    for (let i = 0; i + 1 < fields.length; i += 2) if (fields[i] !== "") out.push({ status: fields[i][0], path: fields[i + 1] });
    for (const p of git(["ls-files", "--others", "--exclude-standard", "-z"]).raw.split("\0")) if (p !== "") out.push({ status: "?", path: p });
    return out;
}

/**
 * The changelog fragment among a change's paths — one it added or edited, never one it deleted — or null.
 * One it added names the change better than an earlier entry it extended, so an added one is preferred.
 */
export function fragmentIn(paths) {
    const fragments = paths.filter(({ status, path: p }) => status !== "D" && p.startsWith(`${CHANGES_DIR}/`) && CHANGE_NAME.test(p.slice(CHANGES_DIR.length + 1)));
    return (fragments.find(({ status }) => status === "A" || status === "?") ?? fragments[0])?.path ?? null;
}

/**
 * The pack roots to resolve with where the caller named none: the tree's own, when it carries every pack
 * the workspace composes, so a host with the Portulan plugin installed, carrying the same packs twice, does
 * not make the set refuse them as shadowed before anything is committed. Otherwise none, and the set
 * resolves as `recipe-set`, `doctor` and the Stop-gate do bare: the tree's packs beside the installed ones,
 * which is where a consumer's composed packs live — `init` declares a tree for every consumer, and a
 * `packs/` of the consumer's own beside it must not hide them. Where CI names the tree's root, the caller
 * names it too, `--pack-root packs` as this repository's card spells it, and a pack the tree lacks is then
 * refused as CI refuses it.
 */
export function treeRoots({ workspaceDir, manifest }) {
    const declared = Array.isArray(manifest?.packs) ? manifest.packs : [];
    const roots = packRoots(workspaceDir, manifest).filter((dir) => fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory());
    if (declared.length === 0 || roots.length === 0) return [];
    return declared.every((ref) => resolvePack(String(ref), roots)?.dir) ? roots : [];
}

/** The recipes the workspace yields with its packs composed, as CI reads them, or `{ why }`. */
export function recipesOf({ root, workspaceDir, named, forced }) {
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(workspaceDir, "workspace.json"), "utf8"));
    } catch (error) {
        return { why: `the workspace manifest in ${path.relative(root, workspaceDir) || "."} could not be read — ${error.code ?? error.message} — so nothing names the recipes to run` };
    }
    let resolve;
    try {
        const roots = named.length === 0 && !forced ? treeRoots({ workspaceDir, manifest }) : named;
        resolve = resolverFor({ workspaceDir, manifest, repoRoot: root, named: roots, discovery: () => discoverPackRoots(), forced });
    } catch (error) {
        return { why: error.message };
    }
    const set = recipeSet(manifest, { resolve });
    return set.ok ? { recipes: set.recipes } : { why: set.reason };
}

/**
 * Run one recipe as CI and the Stop-gate do: its `run` through `bash -c`, from the repository root. Its
 * stderr is made its stdout before it starts, one pipe this process reads whole, so its lines keep the order
 * it wrote them in and its last lines are its last. No file stands between: a write a full disk refused
 * would reach the recipe as its own failure, and its exit would read as a verdict on the tree.
 */
export function runRecipe(recipe, { root, env }) {
    const r = spawnSync("bash", ["-c", `exec 2>&1\n${recipe.run}`], { cwd: root, env, encoding: "utf8", timeout: RECIPE_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    const code = r.error ? null : r.status;
    const output = `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? `\n${r.error.message}` : ""}`;
    if (code === 0) return { id: recipe.id, outcome: "green" };
    const cannot = code === null || CANNOT_RUN.has(code);
    return { id: recipe.id, outcome: cannot ? "could not run" : "red", code, output };
}

/**
 * Close the change the working tree at `cwd` holds. Returns `{ code, lines }`: the exit code and what to
 * print, the first line always the one that says what happened.
 */
export function finish(options, { cwd = process.cwd(), env = process.env, readStdin, runOne = runRecipe } = {}) {
    const stop = (code, ...lines) => ({ code, lines: [`finish: ${lines[0]}`, ...lines.slice(1)] });
    const message = messageOf(options, readStdin);
    if (message?.error) return stop(2, `could not run — ${message.error}`);

    const quiet = { ...env, GIT_TERMINAL_PROMPT: "0" };
    const top = gitAt(cwd, quiet)(["rev-parse", "--show-toplevel"]);
    if (top.status !== 0) return stop(2, `could not run — ${cwd} is not inside a git work tree`);
    const root = top.out;
    const git = gitAt(root, quiet);

    const branch = git(["symbolic-ref", "-q", "--short", "HEAD"]).out;
    if (branch === "") return stop(2, "could not run — HEAD is detached: a change closes on a branch");
    const parent = git(["rev-parse", "--verify", "-q", "HEAD^{commit}"]).out;
    if (parent === "") return stop(2, `could not run — ${branch} has no commit yet, so there is no base to close a change against`);

    const configured = git(["config", "--get", `branch.${branch}.remote`]).out;
    const remotes = git(["remote"]).out.split("\n").filter(Boolean);
    const remote = configured !== "" && configured !== "." ? configured : remotes.includes("origin") ? "origin" : remotes.length === 1 ? remotes[0] : null;
    if (remote === null) return stop(2, `could not run — no remote to push to: ${remotes.length ? `name one with \`git branch --set-upstream-to\`, among ${remotes.join(", ")}` : "the repository has none"}`);
    const merge = remote === configured ? git(["config", "--get", `branch.${branch}.merge`]).out : "";
    const target = merge.startsWith("refs/heads/") ? merge.slice("refs/heads/".length) : branch;

    const base = findBase(git, { remote, remotes, given: options.base, env });
    if (base.why) return stop(2, `could not run — ${base.why}`);
    // A base that names no branch, a commit or a tag, leaves nothing to compare the push against.
    if (base.name === null) {
        return stop(2, `could not run — the base ${base.ref} names no branch, so nothing shows ${branch} is not the branch changes merge into: pass --base <remote>/<branch>`);
    }
    // The base's branch, and the remote's own default head where it is recorded: a working branch is neither.
    const recorded = branchOn(git(["symbolic-ref", "-q", `refs/remotes/${remote}/HEAD`]).out, [remote]);
    const guarded = [base.name, recorded].filter((name) => name !== null);
    if (guarded.includes(target) || guarded.includes(branch)) {
        return stop(2, `could not run — ${branch} would push to ${remote}/${target}, the branch changes merge into: close a change from a working branch`);
    }
    const forkPoint = git(["merge-base", base.sha, "HEAD"]).out;
    if (forkPoint === "") return stop(2, `could not run — HEAD shares no history with ${base.ref} here; a shallow clone may need \`git fetch --unshallow\``);

    const dirty = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]).raw !== "";
    const tracking = git(["rev-parse", "--verify", "-q", `refs/remotes/${remote}/${target}^{commit}`]).out;
    const upstream = merge !== "" && tracking !== "";
    const unpushed = upstream ? Number(git(["rev-list", "--count", `${tracking}..HEAD`]).out) : Number(git(["rev-list", "--count", `${forkPoint}..HEAD`]).out);
    if (!dirty && unpushed === 0) {
        return stop(0, upstream ? `nothing to close — the tree is clean and ${branch} matches ${remote}/${target}` : `nothing to close — the tree is clean and ${branch} is at ${base.ref}`);
    }

    // A file nobody named is never committed: it could be anything, and no scan of what was staged read it. Nor
    // is it to be ignored through the tracked .gitignore, which `git add -u` would commit with its name in it,
    // nor deleted, which git cannot undo: the way out named is .git/info/exclude, which is never committed.
    const untracked = git(["ls-files", "--others", "--exclude-standard", "-z", "--", "."]).raw.split("\0").filter(Boolean);
    if (untracked.length) {
        const shown = untracked.slice(0, TAIL_LINES).map((p) => `    ${p}`);
        if (untracked.length > TAIL_LINES) shown.push(`    and ${untracked.length - TAIL_LINES} more`);
        return stop(
            1,
            `stopped — ${untracked.length} untracked path(s) that nobody staged. Stage by name the ones this change created, with ` +
                "`git add <paths> &&` before this command in the same call; leave any other where it is and list it in " +
                ".git/info/exclude, which is never committed, or ask whoever put it there. Never delete a file this change did " +
                "not create. Nothing was committed or pushed.",
            ...shown,
        );
    }

    let fragment = "no fragment owed: this tree keeps no changes/ directory";
    if (fs.existsSync(path.join(root, CHANGES_README))) {
        const found = fragmentIn(changedPaths(git, forkPoint));
        if (found !== null) fragment = `fragment ${found}`;
        else if (options.noFragment !== null) fragment = `no fragment: ${options.noFragment}`;
        else {
            return stop(
                1,
                `stopped — this change carries no changelog fragment since ${base.ref}: write ${CHANGES_DIR}/<slug>.<section>.md, one bullet, ` +
                    `or pass --no-fragment "<why>" where the change owes none. Nothing was committed or pushed.`,
            );
        }
    }

    const workspaceDir = options.workspace ?? path.resolve(root, env.PORTULAN_WORKSPACE || ".portulan");
    const set = recipesOf({ root, workspaceDir, named: options.named, forced: options.forced });
    if (set.why) return stop(2, `could not run — the recipe set: ${set.why}. Nothing was committed or pushed.`);

    let made = null;
    if (dirty) {
        if (message === null) return stop(2, "could not run — the tree holds work to commit and no message was given: pass -m <subject> or -F <file>");
        const staged = git(["add", "-u", "--", "."]);
        if (staged.status !== 0) return stop(2, `could not run — \`git add\` failed: ${lastLine(staged.err)}`);
        const committed = git(["commit", "-q", "-F", "-"], { input: message });
        if (committed.status !== 0) {
            // Git exits 1 where a hook refused the commit, a verdict on the change; 128 where it could not commit at all.
            return stop(committed.status === 1 ? 1 : 2, `stopped — the commit was refused (git exit ${committed.status ?? "none"}), so nothing was committed or pushed; the changes are staged`, tail(`${committed.raw}\n${committed.err}`));
        }
        made = git(["rev-parse", "HEAD"]).out;
    }

    const undo = (why) => {
        if (made === null) return "";
        const moved = git(["update-ref", "-m", `finish: ${why}`, "HEAD", parent, made]);
        return moved.status === 0
            ? " The commit is undone and its changes are staged."
            : ` The commit ${made.slice(0, 7)} could not be undone (${lastLine(moved.err)}) and stays, unpushed.`;
    };

    // What the recipes judge, and so the one commit this call may push.
    const judged = git(["rev-parse", "--verify", "-q", "HEAD^{commit}"]).out;
    const recipeEnv = { ...env, PORTULAN_BASE_REF: base.ref };
    // A runner that throws judged nothing: the recipe could not run, and the commit is undone as for any
    // recipe that could not run, never left standing by an error nothing caught.
    const results = set.recipes.map((recipe) => {
        try {
            return runOne(recipe, { root, env: recipeEnv });
        } catch (error) {
            return { id: recipe.id, outcome: "could not run", code: null, output: error.message };
        }
    });
    const failed = results.filter((r) => r.outcome !== "green");
    if (failed.length) {
        const code = failed.some((r) => r.outcome === "red") ? 1 : 2;
        const named = failed.map((r) => r.id).join(", ");
        return stop(
            code,
            `stopped — ${failed.length} of ${results.length} recipe(s) not green: ${named}.${undo(`${named} not green`)} Nothing was pushed.`,
            ...failed.flatMap((r) => [`${r.id} — ${r.outcome === "red" ? "RED" : "could not run"} (exit ${r.code ?? "none"}):`, tail(r.output).replace(/^/gm, "    ")]),
        );
    }

    // The commit judged is pushed by name, and only while the branch still holds it: a branch that moved
    // while the recipes ran holds something they did not judge.
    const now = git(["rev-parse", "--verify", "-q", `refs/heads/${branch}^{commit}`]).out;
    if (now !== judged) {
        return stop(
            2,
            `not pushed — ${branch} moved while the recipes ran, from ${judged.slice(0, 7)} to ${now.slice(0, 7) || "nowhere"}, so they did not judge ` +
                "what it holds; both commits stay, unpushed: run this again.",
        );
    }
    const pushed = git(["push", remote, `${judged}:refs/heads/${target}`]);
    if (pushed.status !== 0) {
        return stop(
            2,
            `not pushed — ${remote} refused ${branch}: ${refusalOf(pushed.err)}. ${made ? `The commit ${made.slice(0, 7)} is green and stays` : "The branch is green"}; ` +
                "if the remote moved, merge it in, never force, and run this again.",
        );
    }
    if (!upstream) {
        git(["config", `branch.${branch}.remote`, remote]);
        git(["config", `branch.${branch}.merge`, `refs/heads/${target}`]);
    }
    const head = git(["rev-parse", "--short", judged]).out;
    const files = made === null ? 0 : git(["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", made]).raw.split("\0").filter(Boolean).length;
    const left = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]).raw.split("\0").filter(Boolean).length;
    return stop(
        0,
        `closed ${branch} at ${head} — ${made ? `committed ${files} file(s)` : "nothing new to commit"}; ${fragment}; ${results.length} recipe(s) green; pushed to ${remote}/${target}` +
            (left ? `; ${left} path(s) changed while the recipes ran and are not committed` : ""),
    );
}

export function run(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd(), env = process.env, readStdin } = {}) {
    const options = parseArgs(argv, cwd);
    if (options.error) {
        stderr.write(`finish: ${options.error}\n${USAGE}\n`);
        return 2;
    }
    if (options.help) {
        stdout.write(`${USAGE}\n`);
        return 0;
    }
    const { code, lines } = finish(options, { cwd, env, readStdin });
    stdout.write(`${lines.join("\n")}\n`);
    return code;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = run();
}
