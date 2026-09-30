#!/usr/bin/env node
// `init` — the subcommand that drafts a workspace for a repository that has none.
//
// Before any write it refuses a residence already there, a file in the way and a link on a drafted path, treating only ENOENT as absent.
// Exit 0 wrote · 2 refused, declined or could not run; never 1, since it renders no verdict on a workspace.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { AUTO, discoverPackRoots, namedWithAuto } from "./discover.mjs";
import { historyCount } from "./comments.mjs";
import { CACHE_LIFETIMES, compileGuidance } from "./compile.mjs";
import { alwaysTier, ESTIMATED_BYTES_PER_TOKEN, OFFER_FLOOR_TOKENS, tokensOf } from "./context.mjs";
import { cardIgnored, changesReadme, claudeRulesUnignore, commentsRecipe, commentsRecipeEntry, COMPILED_CARD, draftCard, handoffIndexIgnore, handoffsReadme, withIgnoreLines } from "./form.mjs";
import { offerText, splitOffers } from "./instructions.mjs";
import { offerLines } from "./sessions.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** A refusal, thrown only before the first write: `run` exits 2 on it. */
export class InitError extends Error {}

// The schema's `$defs/slug`; unreadable, it is null for `run` to refuse, since a throw at import leaves only a stack trace.
let SCHEMA_ERROR = null;
export const SLUG = (() => {
    try {
        const file = path.join(HERE, "..", "spec", "workspace.schema.json");
        return new RegExp(JSON.parse(fs.readFileSync(file, "utf8")).$defs.slug.pattern);
    } catch (error) {
        SCHEMA_ERROR = error;
        return null;
    }
})();

/** A pointer's Workspace Definition: 2.7 is the first with pointers. */
const SPEC = "2.7";

/** 2.10 is the first with `slots.context`, which holds the drafted boot card. */
const WORKSPACE_SPEC = "2.10";

/** Declared only with a cache lifetime: 2.11 is the first with `sessions`, which `doctor` refuses under an earlier one. */
const SESSIONS_SPEC = "2.11";

export const GATE_POLICY_SPEC = "2.2";

const RESIDENCES = new Set(["in-repo", "pointer"]);

const DEFAULT_CHECKPOINTS = "rituals/checkpoints";

const ANSWER_KEYS = new Set(["residence", "name", "summary", "governed-by", "feed", "checkpoints", "cycle", "pack-root", "cache-lifetime"]);

/** `text` as a slug, or null where nothing survives: `init` asks rather than name a workspace nobody chose. */
export function slugify(text) {
    const slug = String(text ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug === "" ? null : slug;
}

// ------------------------------------------------------------------------- the command line

export function parseArgs(argv) {
    const flags = {};
    const targets = [];
    let help = false;

    const VALUED = new Set(["--residence", "--name", "--summary", "--governed-by", "--feed", "--checkpoints", "--answers", "--pack-root", "--cache-lifetime"]);

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--help" || arg === "-h") {
            help = true;
        } else if (arg === "--no-cycle") {
            flags.cycle = false;
        } else if (arg === "--no-interview") {
            flags.noInterview = true;
        } else if (VALUED.has(arg)) {
            const value = argv[i + 1];
            if (value === undefined || value.startsWith("-")) {
                throw new InitError(
                    `\`${arg}\` needs a value and the next argument is \`${value ?? "(nothing)"}\` — refusing to read a ` +
                        `flag as one. If the value really does start with \`-\`, pass it through \`--answers\`, where it ` +
                        `is a JSON string and nothing has to guess.`,
                );
            }
            if (value.trim() === "") {
                throw new InitError(
                    `\`${arg}\` was given an empty value. Every answer this tool writes into a manifest has to be ` +
                        `non-empty — an empty one validates nowhere — so it is refused rather than treated as unasked.`,
                );
            }
            const key = arg.slice(2);
            if (key === "pack-root") (flags["pack-root"] ??= []).push(value);
            else flags[key] = value;
            i++;
        } else if (arg.startsWith("-")) {
            throw new InitError(
                `unknown option \`${arg}\` — run \`portulan init --help\` for the ones this understands, ` +
                    `or \`node cli/init.mjs --help\` from a checkout`,
            );
        } else {
            targets.push(arg);
        }
    }

    if (targets.length > 1) {
        throw new InitError(
            `${targets.length} target directories given (${targets.join(", ")}) — \`init\` drafts one workspace for one ` +
                `repository, and picking one of two would be choosing which repository gets governed`,
        );
    }

    return { help, flags, target: targets[0] ?? null };
}

export function resolveAnswers(flags) {
    let fromFile = {};
    if (flags.answers) {
        let raw;
        try {
            raw = fs.readFileSync(flags.answers, "utf8");
        } catch (error) {
            throw new InitError(`could not read the answers file \`${flags.answers}\` — ${error.message}`);
        }
        try {
            fromFile = JSON.parse(raw);
        } catch (error) {
            throw new InitError(`the answers file \`${flags.answers}\` is not valid JSON — ${error.message}`);
        }
        if (!fromFile || typeof fromFile !== "object" || Array.isArray(fromFile)) {
            throw new InitError(`the answers file \`${flags.answers}\` must hold a JSON object of answers`);
        }
        const unknown = Object.keys(fromFile).filter((key) => !ANSWER_KEYS.has(key));
        if (unknown.length) {
            throw new InitError(
                `the answers file carries ${unknown.map((k) => `\`${k}\``).join(", ")}, which is not an answer this tool asks for ` +
                    `(it asks: ${[...ANSWER_KEYS].join(", ")}). A misspelt key is an answer nobody receives.`,
            );
        }
        for (const [key, value] of Object.entries(fromFile)) {
            const expected = key === "cycle" ? "boolean" : "string";
            const actual = Array.isArray(value) ? "array" : typeof value;
            const arrayOk = key === "pack-root" && Array.isArray(value) && value.every((v) => typeof v === "string" && v.trim() !== "");
            if (arrayOk) continue;
            if (actual !== expected) {
                throw new InitError(
                    `the answers file gives \`${key}\` as ${actual === "array" ? "an array" : `a ${actual}`} (${JSON.stringify(value)}), ` +
                        `and this tool reads it as ${expected === "boolean" ? "a boolean" : "a string"}. \`"cycle": "false"\` is a ` +
                        `non-empty string, which is true — the answer would do the opposite of what it reads as.`,
                );
            }
            if (expected === "string" && value.trim() === "") {
                throw new InitError(`the answers file gives \`${key}\` as an empty string, which validates nowhere — refused rather than read as unasked`);
            }
        }
    }

    const merged = { ...fromFile };
    for (const [key, value] of Object.entries(flags)) {
        if (key === "answers" || key === "noInterview") continue;
        merged[key] = value;
    }

    const given = new Set(Object.keys(merged));

    return {
        given,
        residence: merged.residence ?? null,
        name: merged.name ?? null,
        summary: merged.summary ?? null,
        governedBy: merged["governed-by"] ?? null,
        feed: merged.feed ?? null,
        checkpoints: merged.checkpoints ?? DEFAULT_CHECKPOINTS,
        cycle: merged.cycle !== false,
        // An answers file may give a string, the repeatable flag an array.
        packRoots: [merged["pack-root"] ?? []].flat(),
        cacheLifetime: merged["cache-lifetime"] ?? null,
    };
}

export function validateAnswers(answers) {
    const bothAsked = namedWithAuto(
        (answers.packRoots ?? []).filter((r) => r !== AUTO),
        (answers.packRoots ?? []).includes(AUTO),
    );
    if (bothAsked) throw new InitError(bothAsked);
    if (!answers.residence) {
        throw new InitError(
            "no residence given — `init` asks where this repository's workspace lives and will not choose for you. " +
                "Pass `--residence in-repo` to write a full workspace into this repository, or `--residence pointer` " +
                "with `--governed-by <workspace>` to record that another workspace governs it. A repository is " +
                "governed by exactly one workspace, so this answer is the one that cannot be defaulted.",
        );
    }
    if (!RESIDENCES.has(answers.residence)) {
        throw new InitError(`\`${answers.residence}\` is not a residence — the two are \`in-repo\` and \`pointer\``);
    }
    if (answers.name !== null && !SLUG.test(answers.name)) {
        throw new InitError(
            `the workspace name \`${answers.name}\` is not a slug — lowercase letters, digits and single hyphens ` +
                `(${SLUG.source}). A workspace ships as a plugin through a feed, so its name is an identifier rather than a title.`,
        );
    }
    const misplaced = {
        "in-repo": ["feed", "governed-by"],
        pointer: ["pack-root", "checkpoints", "cycle", "cache-lifetime"],
    }[answers.residence].filter((key) => answers.given.has(key));
    if (misplaced.length) {
        const spelling = (key) => (key === "cycle" ? "`--no-cycle`" : `\`--${key}\``);
        const why =
            answers.residence === "pointer"
                ? [
                      misplaced.some((key) => key !== "cache-lifetime") && "a pointer holds no policy of its own, so it composes no packs",
                      misplaced.includes("cache-lifetime") && "a pointer drafts no repository whose settings `compile` writes, so a cache lifetime would reach no session",
                  ].filter(Boolean)
                : ["a workspace that lives here has no governor and no feed to be delivered from"];
        throw new InitError(
            `${misplaced.map(spelling).join(" and ")} ${misplaced.length > 1 ? "do" : "does"} nothing with ` +
                `\`--residence ${answers.residence}\` — ${why.join(", and ")}. ` +
                "Refused rather than ignored: an option accepted and then dropped is one you will believe had an effect.",
        );
    }
    const lifetime = answers.cacheLifetime ?? null;
    if (lifetime !== null && !CACHE_LIFETIMES.includes(lifetime)) {
        throw new InitError(
            `\`${lifetime}\` is not a cache lifetime — Claude Code takes ${CACHE_LIFETIMES.map((v) => `\`${v}\``).join(" and ")}, ` +
                "which `compile` writes into .claude/settings.json as `promptCacheTtl`. Leave it out to keep the host's default.",
        );
    }

    if (answers.residence === "pointer") {
        if (answers.governedBy === null) {
            throw new InitError(
                "a pointer must name the workspace that governs this repository — pass `--governed-by <workspace>`. " +
                    "A pointer that names nothing governs nothing, and is indistinguishable from a repository that " +
                    "never adopted Portulan.",
            );
        }
        if (!SLUG.test(answers.governedBy)) {
            throw new InitError(
                `the governing workspace \`${answers.governedBy}\` is not a slug — lowercase letters, digits and single ` +
                    `hyphens (${SLUG.source}). It must be spelled exactly as that workspace's own \`name\`, or the pointer ` +
                    `and its target have drifted into two identifiers.`,
            );
        }
    }
    if (answers.residence === "in-repo" && answers.cycle) {
        const parts = String(answers.checkpoints).split("/");
        if (parts.length !== 2 || !parts.every((part) => SLUG.test(part))) {
            throw new InitError(
                `\`${answers.checkpoints}\` is not a pack id — a pack is \`<category>/<name>\`, each a slug, as ` +
                    `\`spec/pack.schema.json\` defines it. Composing an id nothing can resolve would put a red in the ` +
                    `adopter's first run for a reason they did not cause.`,
            );
        }
    }
}

// ------------------------------------------------------------------------- the codebase scan

/** What the repository says of itself, observed only: a field nothing states stays null, never a likely default. */
export function scan(dir, { comments = true } = {}) {
    const observed = { stack: [], build: null, test: null, run: null, name: null, vcs: null, evidence: [], commentHistory: null, uncounted: null };
    const has = (rel) => fs.existsSync(path.join(dir, rel));
    const read = (rel) => {
        try {
            return fs.readFileSync(path.join(dir, rel), "utf8");
        } catch {
            return null;
        }
    };

    if (has(".git")) {
        observed.vcs = "git";
        observed.evidence.push(".git/");
    }

    if (has("package.json")) {
        observed.stack.push("node");
        observed.evidence.push("package.json");
        let manifest = null;
        try {
            manifest = JSON.parse(read("package.json"));
        } catch {
            // Unparsed, it is evidence of node and of nothing else.
        }
        if (manifest && typeof manifest === "object") {
            if (typeof manifest.name === "string") observed.name = manifest.name;
            const scripts = manifest.scripts ?? {};
            if (typeof scripts.test === "string") observed.test = scripts.test;
            if (typeof scripts.build === "string") observed.build = scripts.build;
            if (typeof scripts.start === "string") observed.run = scripts.start;
        }
    }

    const makefile = read("Makefile") ?? read("makefile");
    if (makefile !== null) {
        observed.stack.push("make");
        observed.evidence.push("Makefile");
        for (const [target, key] of [["test", "test"], ["build", "build"], ["run", "run"]]) {
            if (observed[key] === null && new RegExp(`^${target}\\s*:`, "m").test(makefile)) observed[key] = `make ${target}`;
        }
    }

    for (const [file, stack] of [["pyproject.toml", "python"], ["Cargo.toml", "rust"], ["go.mod", "go"]]) {
        if (has(file)) {
            observed.stack.push(stack);
            observed.evidence.push(file);
        }
    }

    if (comments) {
        try {
            observed.commentHistory = historyCount(dir);
        } catch (error) {
            observed.uncounted = error.message;
        }
    }

    return observed;
}

// ------------------------------------------------------------------------- the draft

/** Every drafted file, by path from the target: its `contents` and `mode`, `ifAbsent` to leave one already there, or `append` lines. */
export function draft(answers, observed) {
    return answers.residence === "pointer" ? draftPointer(answers) : draftWorkspace(answers, observed);
}

function json(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}

function draftPointer(answers) {
    const files = new Map();

    // Exactly the keys `doctor` permits a pointer: any other is its dual-management refusal.
    const manifest = {
        portulan: { spec: SPEC },
        name: answers.name ?? "workspace",
        summary: answers.summary ?? `This repository is governed by the \`${answers.governedBy}\` workspace.`,
        kind: "pointer",
        governed_by: answers.feed ? { workspace: answers.governedBy, feed: answers.feed } : { workspace: answers.governedBy },
    };
    files.set(".portulan/workspace.json", { contents: json(manifest) });

    files.set(".portulan/README.md", {
        contents: `# This repository's workspace lives elsewhere

This directory holds a **pointer**, not a workspace. It records one fact: the \`${answers.governedBy}\`
workspace governs this repository${answers.feed ? `, and ships through the \`${answers.feed}\` feed` : ""}.

A repository is governed by **exactly one** workspace — it carries its own full workspace, or a pointer
to the workspace that names it, never both. Two policy layers for one repository is not redundancy; it
is an agent booting on the wrong gates and looking exactly like success.

## What you get here, and what you do not

Every Portulan feature keys to a workspace **slot**, never to a residence, so nothing is lost by
governing this repository from elsewhere. One step is real and is named rather than claimed away:
**the governing workspace has to be installed before anything boots against it**, and no tool here
fetches it. What *is* built is the step after that — a host's installed-plugin record is read from
disk and this pointer's \`governed_by\` is resolved against it, so once the workspace is installed
the boot loads it and reports it exactly as it would an in-repo one. Run
\`node <portulan>/cli/discover.mjs --json .portulan\` to see which of the four answers this machine
gives: resolved, not installed here, ambiguous, or could not look.

## Moving back

If this repository should carry its own workspace instead, that is a **switch**, not a re-run of
\`init\`: the workspace is materialised in the new residence, a pointer or nothing is left in the old
one, and validation is green at both ends *before* the old residence is retired.

From this repository's root, with the \`${answers.governedBy}\` workspace checked out somewhere you can
name — nothing here fetches it:

\`\`\`
portulan vendor <path to the ${answers.governedBy} workspace> --into .portulan --residence in-repo --switch
\`\`\`

Run that rather than deleting this file and writing a workspace by hand — the window between those two
acts is a repository governed by nothing, which looks identical to a repository that never adopted
Portulan.

## Curate this

\`init\` drafted this file. The \`summary\` in \`workspace.json\` is a placeholder; make it say what
this repository is, in the one line an agent reads before loading anything else.
`,
    });

    return files;
}

function draftWorkspace(answers, observed) {
    const files = new Map();
    const name = answers.name ?? "workspace";
    const lifetime = answers.cacheLifetime ?? null;

    const manifest = {
        portulan: { spec: lifetime === null ? WORKSPACE_SPEC : SESSIONS_SPEC },
        name,
        summary: answers.summary ?? `The ${name} workspace — drafted by \`init\`, and not yet curated.`,
        kind: "repository",
        // `doctor`, not the schema, requires `tree` of a `repository` workspace.
        tree: "../",
        gates: "gates.json",
        slots: {
            identity: "identity.md",
            principles: "principles.md",
            gates: "gate-map.md",
            dod: "dod.md",
            handoffs: "handoffs/",
            context: "context/",
        },
        verify: {
            default: "workspace",
            recipes: [
                {
                    id: "workspace",
                    run: "./.portulan/verify/workspace.sh",
                    requires: ["bash"],
                    doc: "verify/README.md",
                },
                {
                    id: "index",
                    run: "./.portulan/verify/index.sh",
                    requires: ["bash", "node"],
                    doc: "verify/README.md",
                },
                ...(observed.commentHistory === null ? [] : [{ ...commentsRecipeEntry(".portulan"), doc: "verify/README.md" }]),
            ],
        },
        // Outside `handoffs/`, where whatever walks the series would count it as a handoff.
        handoffs: { index: { path: "handoffs-index.md" } },
    };
    if (answers.cycle) manifest.packs = [answers.checkpoints];
    if (lifetime !== null) manifest.sessions = { cache_lifetime: lifetime };
    const commented = observed.commentHistory !== null;

    files.set(".portulan/workspace.json", { contents: json(manifest) });
    files.set(".portulan/gates.json", { contents: json(draftPolicy()) });
    files.set(".portulan/README.md", { contents: draftReadme(answers, observed, name, commented) });
    files.set(".portulan/identity.md", { contents: draftIdentity(observed, name) });
    files.set(".portulan/principles.md", { contents: draftPrinciples(name) });
    files.set(".portulan/gate-map.md", { contents: draftGateMap() });
    files.set(".portulan/dod.md", { contents: draftDod() });
    files.set(".portulan/verify/README.md", { contents: draftVerifyReadme(commented) });
    files.set(".portulan/verify/workspace.sh", { contents: draftRecipe(), mode: 0o755 });
    files.set(".portulan/verify/index.sh", { contents: draftIndexRecipe(), mode: 0o755 });
    if (commented) {
        const bundle = path.resolve(HERE, "..");
        files.set(".portulan/verify/comments.sh", { contents: commentsRecipe({ bundle, limit: observed.commentHistory, toTree: "../.." }), mode: 0o755 });
    }
    files.set(".portulan/handoffs/README.md", { contents: handoffsReadme() });
    files.set(".gitignore", { append: handoffIndexIgnore(`.portulan/${manifest.handoffs.index.path}`, ".portulan") });
    files.set("changes/README.md", { contents: changesReadme(), ifAbsent: true });

    const read = (rel) => files.get(`.portulan/${rel}`)?.contents ?? null;
    files.set(".portulan/context/boot.md", { contents: draftCard(manifest, read, { workspace: ".portulan", inTree: (rel) => !path.posix.normalize(rel).startsWith("..") }) });

    return files;
}

function draftPolicy() {
    return {
        portulan: { spec: GATE_POLICY_SPEC },
        why: "gate-map.md",
        // No required checks: `doctor` fails a floor requiring one that no workflow in the tree reports.
        floor: {
            branch: "main",
            checks: [],
            reviews: 0,
            resolve_conversations: true,
        },
        rules: [
            // Rules the floor backend compiles: `compile` refuses a policy whose floor no rule reaches.
            {
                id: "force-push-without-a-lease",
                tier: "gated",
                action: { shell: "git push --force" },
                reason: "A bare force-push to a shared remote can silently discard commits that arrived since you last fetched, and that is the one part of pushing which is not recoverable in a working copy. Use `--force-with-lease`, which refuses the push if the remote moved.",
            },
            {
                id: "delete-a-remote-branch",
                tier: "gated",
                action: { shell: "git push --delete" },
                reason: "Deleting a branch on a shared remote destroys a ref rather than adding one. It is the single push spelling whose damage outlives the working copy. SHARED is the operative word. Two conditions, both required: you created the branch, AND deleting the ref destroys no work that exists nowhere else. A branch somebody else pushed stays gated however the second comes out — they may be relying on it. Test the second against the REMOTE ref and fail closed: `git fetch origin <branch>:refs/remotes/origin/<branch> && git cherry origin/<default-branch> origin/<branch>` must exit 0 and show zero `+` lines, because an unknown ref exits 128 and prints nothing, which reads as zero. The base is the branch the work was destined for — your default branch, whatever it is named — and NOT any branch you happen to pick: a wrong base answers no-unique-work about a question nobody asked. `git branch --merged` lies wherever you rebase-merge. Any `+` line, any error, or any doubt about either condition: gated.",
            },
            {
                id: "merge-a-pull-request",
                tier: "gated",
                action: { shell: "gh pr merge" },
                reason: "An agent never decides for itself that a change is ready to land. A commit enters the repository's record here, and that decision is a human's.",
            },
            {
                id: "edit-the-workspace",
                tier: "propose",
                action: { write: ".portulan/" },
                reason: "This workspace is the layer that decides gates, lanes and the bar for done. Changing it by pull request is what keeps an agent from widening its own permissions in the same change it uses them.",
            },
            {
                id: "edit-on-a-working-branch",
                tier: "auto",
                action: { write: "./" },
                reason: "Creating and editing files on a working branch is unattended. What makes it safe is the gate on landing, not the edit.",
            },
        ],
    };
}

function draftReadme(answers, observed, name, commented) {
    const bound = answers.cycle
        ? `This workspace composes the \`${answers.checkpoints}\` pack, which carries the three checkpoint
skills — session-open, pre-commit, milestone-close — and the supervisor persona that staffs them.`
        : `This workspace composes no packs: \`init\` was run with \`--no-cycle\`. The checkpoint ritual is
the one most teams want first; add it to \`packs\` in \`workspace.json\` when you do.`;

    return `# ${name} — a drafted workspace

\`init\` wrote every file in this directory. **None of it is finished**, and that is deliberate: agents
may draft this layer and may never own it. Read each file, delete what does not describe your team, and
replace the placeholders. A workspace you have not curated is a workspace that makes an agent work
*generically* — which is the one thing it exists to prevent.

## Where to start

1. **\`identity.md\`** — who you are, your stack, your glossary. The boot card imports it whole, so
   every context here carries it: keep it short and keep it true. Where something is not true yet, say
   so rather than describing the intended state, since a file claiming a capability the tree does not
   have is the defect this one exists to prevent. Correct the commands the scan read when they go stale.
   The glossary earns its place the first time an agent misreads one of your words, and the scan below
   could only observe so much.
2. **\`principles.md\`** — the handful of rules that are yours rather than everyone's. Placeholders
   until you write them.
3. **\`verify/workspace.sh\`** — **this exits 2 (could not run) until you edit it.** It cannot report
   green, because nobody has told it what green means for this repository. That is the honest state, not
   a bug: "nothing looked" must never read as "nothing wrong."
4. **\`gate-map.md\` and \`gates.json\`** — ${draftPolicy().rules.length} starter rules and a platform
   floor with no required checks. Add your checks once your CI reports them; a floor requiring a check
   no job reports blocks every pull request.

## The cycle this drafts

${bound}

**What is bound and what is not, stated plainly** — because a workspace that overstates its own rails
is worse than one with fewer of them.

- **The pack is named; resolving it is a separate step.** Naming a pack and finding it on this machine
  are different things. **Until the root resolves, validation is RED**, not merely unverified:
  \`doctor\` fails a declared pack it cannot resolve rather than passing over it. Three ways out —
  \`doctor --pack-root auto .portulan\`, which finds it in this host's installed plugins;
  \`doctor --pack-root <dir> .portulan\` if you would rather name the location; or \`init --no-cycle\`
  to compose the pack later, once you know where it lives.
- **The records conventions are drafted, and a rail holds them from the first day.** A change's why is
  its commit message. A changelog entry is a file of one bullet in \`changes/\` beside this directory,
  which \`changes/README.md\` explains and \`portulan index --changes changes\` prints as a release cut
  pastes it. A handoff, in the \`handoffs\` slot, is written only for work a session leaves open, from
  the template in \`handoffs/README.md\`. The handoff index is printed on demand by \`portulan index
  --handoffs .portulan\` and is not kept: its path is git-ignored, so no copy goes stale on a merge.
  \`verify/index.sh\`, declared beside \`workspace\`, renders the series and goes red when a handoff
  yields no index line, or when a copy someone keeps has drifted. It is **not** the default recipe: the
  default is what runs at every session end, and that slot belongs to the one that says whether this
  repository works.
- **The rail needs the CLI, and may not find it here.** It looks at \`$PORTULAN_CLI\`, then
  \`portulan\` on your \`PATH\`, then the bundle this workspace was drafted from — an absolute path on
  the machine that ran \`init\`, which git cannot carry to anybody else. Where none answers it exits
  **2 — could not run**, never 0. On CI that is the state to expect until the CLI is installed there,
  and it is said here rather than left to be met as an amber pipeline.${commented ? `
- **A change's history goes in its commit message, not in a comment**, which is paid for on every read
  of its file. \`verify/comments.sh\` counts the comment lines that record one, by a date, a proposal or
  milestone number, a review round, or a pull request or issue number, and holds them at the
  ${observed.commentHistory} \`init\` found: lower its \`LIMIT\` as they leave. It finds the CLI as the records rail does, but takes a
  \`portulan\` on your \`PATH\` only where it holds \`comments.mjs\`.` : ""}
- **The session-end gate is wired by \`compile\`, and this draft has run only its guidance half.** The
  runner that asks for a dated handoff when a session ends with work not committed and pushed **does**
  ship in the package you have — it is \`cli/stop-gate.mjs\` — and \`portulan compile\` emits a
  \`Stop\` hook naming it into \`.claude/settings.json\`, beside the gate policy's permission rules.
  Running that is yours, because it writes host settings and that is not a thing a scaffold should do
  to your machine unasked. **Until you run it**, treat the session-end handoff as a practice your team
  holds rather than a rail — a rule nothing checks is worth exactly what you can remember about it.

## The boot card

\`context/boot.md\` is this workspace's boot: an always unit that \`portulan compile\` wrote into
\`.claude/rules/portulan/boot.md\`, which Claude Code loads into every context here, so a session opens
no slot to boot. \`init\` drafted it from the files above. It imports \`identity.md\` whole, and
\`compile\` writes out the lead sentences of \`principles.md\` and \`dod.md\` and the gates of
\`gates.json\` onto it, so it says what they say. **Run \`portulan compile\` after you edit any of
them**: until you do, \`portulan compile --check\` reports the card drifted. Commit the compiled rules
with the files they come from. To boot as before, reading each slot at boot, delete
\`context/boot.md\` and compile again.

## What the scan observed

${observed.evidence.length ? observed.evidence.map((e) => `- \`${e}\``).join("\n") : "- Nothing it recognised. Every claim in `identity.md` is yours to write."}

Only what is listed above was read. Anything \`identity.md\` marks *not determined* was left blank
rather than guessed at — an invented build command is worse than an absent one, because the workspace
then disagrees with the repository on the day it was created.
`;
}

function draftIdentity(observed, name) {
    const unknown = "_Not determined by the scan — fill this in._";
    const row = (label, value) => `| ${label} | ${value ? `\`${value}\`` : unknown} |`;

    return `# Identity — ${name}

## The team

${unknown} — how many people, what they own, how they work.

## The stack

${observed.stack.length ? observed.stack.map((s) => `- \`${s}\``).join("\n") : unknown}

## Commands

| What | Command |
|---|---|
${row("Build", observed.build)}
${row("Test", observed.test)}
${row("Run", observed.run)}

${
    observed.build || observed.test || observed.run
        ? "Read out of files in this repository, not inferred."
        : "The scan found no command written down anywhere it looked. Write them here; anything else would be a guess."
}

## Glossary

${unknown} — the words your team uses that a newcomer would misread.
`;
}

function draftPrinciples(name) {
    return `# Principles — ${name}

> The rules that are **yours** rather than everyone's. Core already carries the universal ones; this
> file is what makes an agent work *this* team's way. \`init\` cannot draft these — they are the part
> no scan can observe and no generator should invent.

Three questions worth answering here, in your own words:

1. **What do you refuse to trade away?** Every team has one — a latency budget, a review depth, a
   dependency policy, an accessibility floor. Name it, and say what it costs, because a principle with
   no cost is a preference.
2. **What has gone wrong more than once?** The rule that would have caught it belongs here, with a link
   to the incident. A rule with no provenance cannot be retired later, because nobody can tell whether
   the thing it guards against can still happen.
3. **Where does this team differ from the obvious default?** That difference is the whole reason this
   file exists rather than a link to someone's style guide.

_Delete this list once you have replaced it. A workspace whose principles slot still holds the prompt
is a workspace nobody has curated._
`;
}

function draftGateMap() {
    return `# Gate map

> The **policy** half of the engine's autonomy model. Core defines the tiers — Auto, Propose, Gated,
> Prohibited — as universal mechanism; this file binds *your* concrete actions to them, because which
> action is dangerous is a property of a team, not of an engine.
>
> **\`gates.json\` is the policy; this file is the rationale.** Where they disagree, the JSON wins — it
> is the one that compiles.

## The tiers, bound

### Auto — the agent acts unattended

Recoverable, reversible, and it puts nothing in front of anyone.

- \`edit-on-a-working-branch\` — create and edit files on a working branch.

### Propose — the agent drafts; a human decides

- \`edit-the-workspace\` — anything under \`.portulan/\`, including this file and the policy beside it.

### Gated — the agent asks first, every time

- \`force-push-without-a-lease\` — a bare \`--force\` can discard commits that arrived since you fetched.
  \`--force-with-lease\` is the spelling that refuses when the remote moved.
- \`delete-a-remote-branch\` — destroys a ref rather than adding one.
- \`merge-a-pull-request\` — a change enters the record here, and that decision is a human's.

### Prohibited — no role acts here

Nothing yet. Add what must never happen regardless of who asks.

## The platform floor

Branch protection on \`main\`, with conversation resolution required and **no required status checks
declared yet**. Add your checks to \`floor.checks\` in \`gates.json\` once your CI reports them — a floor
requiring a check no job reports blocks every pull request, which is why \`init\` declared none.

The two Gated ref rules above are what this floor compiles from: they become \`non_fast_forward\` and
\`deletion\` on \`refs/heads/main\`. Note the coarseness in the honest direction — \`non_fast_forward\`
blocks **every** force-push, including \`--force-with-lease\`, which the policy above classifies Auto. A
ref rule gates a ref and cannot read a command's flags.

Until \`floor.checks\` is declared, \`edit-the-workspace\` and every other Propose rule compiles to
nothing in this backend: requiring a pull request while requiring nothing green of it reads as a floor
and is not one.

The floor is the layer indifferent to how a command was spelled. Everything above depends on a host
honouring a permission rule; this does not.

## The triage threshold

${"_Not set._"} Where does small work stop needing ceremony? Answer it here, in a sentence a person can
apply without asking. Left unset, every rule above applies to a one-line fix, and a ritual that cannot
scale down gets switched off wholesale rather than tuned.
`;
}

function draftDod() {
    return `# Definition of done

> Core supplies the floor: green verify, and never report done on what you could not explain. A
> workspace may **extend** that floor and may never lower it. These are the additional conditions for
> work here — each one you add should carry the reason it exists, or nobody can tell later whether it
> still earns its place.

A change is done when **all** of the following hold.

1. **The verify recipe ran green in this working copy.** Not "should pass" — run it and read the
   output. _Why: this is the only condition whose evidence is a machine's rather than a person's._
2. **You could walk a reviewer through every line.** _Why: core's bar, and the one most often skipped
   when a diff is mostly prose — prose reviews as "fine" far more easily than code does._

_Add yours below. Two are enough to start; a list nobody can hold in their head is a list that gets
skimmed. Each condition should be checkable by someone who was not in the room._
`;
}

function draftVerifyReadme(commented) {
    return `# verify/

The executable half of *done*. \`workspace.json\` declares the recipes and names the default.

**Nothing runs them for you yet, and that is worth knowing before you trust a green.** In this
repository there is no Stop-gate wired — see \`../README.md\` — and \`init\` writes no CI workflow, so
these recipes run when a person runs them. The design is that the default recipe is what a session-end
gate and a pull-request check both call; both of those are things you wire, and until you do, a recipe
is a command in a file.

| Recipe | What it checks |
|---|---|
| \`workspace\` | **Nothing yet — it exits 2.** Replace it with the command that tells you this repository is healthy. This one is the **default**: it is what runs at a session end. |
| \`index\` | The handoff series renders an index line for every handoff, and a copy of the index kept on disk matches it byte for byte; none is kept as drafted. Finished as drafted — it checks a real thing today. |${commented ? `
| \`comments\` | No more comment lines record a change's history than its \`LIMIT\`, the count \`init\` found. Lower it as they leave. It needs git, and finds the CLI as \`index\` does, but takes a \`portulan\` on \`PATH\` only where it holds \`comments.mjs\`. |` : ""}

## The three exit codes, and why the middle one is not enough

- **0 — green.** Everything this recipe checks passed.
- **1 — red.** Something it checks failed. A verdict about the repository.
- **2 — could not run.** A precondition was missing: a tool absent, a file unreadable, nothing to
  check. **This is not a pass.** A recipe that returns 0 because it found nothing to look at reports
  "nothing wrong" when the truth is "nothing looked", and every gate downstream believes it.

\`workspace\` exits 2 for exactly that reason. It is not broken; it is honest about not yet knowing
what green means here.

**\`index\` has an expected 2 of its own, and it is worth knowing before you meet it.** The recipe needs
the Portulan CLI, and looks for it in three places: \`$PORTULAN_CLI\`, then \`portulan\` on \`PATH\`,
then the bundle this workspace was drafted from — the last being an absolute path on the machine that
ran \`init\`, which git cannot carry to a clone or to a CI runner. Where none of the three answers, and
where \`node\` itself is absent, the recipe exits **2** and names what it looked for. That is the state
to expect on CI until the CLI is installed there; it is not a red, and it is not a pass either.

**Repairing is yours, and the rail deliberately does not do it.** A check that repaired what it found
would report green on a repository nobody had corrected. A handoff that yields no index line needs its
title or date fixed; a kept copy that drifted needs the index tool run again, or the copy deleted.

**One thing the three locations cannot establish, said rather than left implicit.** The second of them
is *whatever \`portulan\` is on your \`PATH\`* — and nothing here can tell that it is this tool rather
than another program of the same name. Where that matters to you, set \`$PORTULAN_CLI\` to a checkout
you chose: an explicit path is the one location that answers a question about identity rather than about
availability, and a location that holds no \`index.mjs\` exits **2** rather than being read as a drifted
index.
`;
}

function draftRecipe() {
    return `#!/usr/bin/env bash
# Workspace verify recipe — REPLACE THIS.
#
# This is a draft. It runs nothing and exits 2 (could not run), because nobody has yet told it what
# "green" means for this repository. That is deliberate and it is not a placeholder to be deleted: a
# stub exiting 0 would report "nothing wrong" when the truth is "nothing looked", and the Stop-gate,
# CI, and every human reading a green check would believe it.
#
# Replace the body with the command that actually verifies this repository — the test suite, the
# linter, the build, whatever your team already trusts — and keep the three codes:
#
#   exit 0   green: everything this checks passed
#   exit 1   red: something it checks failed
#   exit 2   could not run: a precondition was missing. Never a pass.

set -uo pipefail

printf 'verify: this workspace has not declared what green means yet.\\n' >&2
printf 'verify: edit .portulan/verify/workspace.sh — see .portulan/verify/README.md\\n' >&2
exit 2
`;
}

/** The records rail; its `portulan:bundle-fallback` lines hold a machine-local path, which `spec/migrations/0002` re-derives. */
function draftIndexRecipe() {
    const bundle = path.resolve(HERE, "..");
    return `#!/usr/bin/env bash
# Records rail — the handoff series is rendered as its index, in memory.
#
# The index is not kept: \`index --handoffs\` prints it. This recipe renders it, so a handoff that yields
# no index line is a RED, and a copy someone keeps on disk is compared byte for byte, so one edited by
# hand or left behind when a handoff was added is a RED too. Nothing here writes.
#
#   exit 0   green: every handoff yields a line, and any kept copy matches
#   exit 1   red: one does not — fix the handoff, or regenerate or delete the copy
#   exit 2   could not run: the Portulan CLI is not reachable from here. NEVER a pass.

set -uo pipefail
cd "\$(dirname "\$0")/../.." || exit 2

# Three locations, in order. An explicit path wins, then an installed CLI, then the bundle this
# workspace was drafted from — which is an absolute path on the machine that ran \`init\` and is NOT
# portable: a clone of this repository elsewhere will not find it, and should set PORTULAN_CLI or
# install the CLI instead.
# Two of the three locations are node scripts, so node is their precondition and not their business.
# An absent interpreter must exit 2 like any other missing tool: unchecked, \`node …\` dies **127**,
# which is the shell's code for "not found" and reads to every reader downstream as a recipe that ran
# and rendered a verdict. A recipe's own contract is the three codes, and it owes them even when what
# is missing is the thing that would have run it.
need_node() {
    command -v node >/dev/null 2>&1 && return 0
    printf 'verify: node is needed to run the index tool and is not on PATH, so the index was NOT checked.\\n' >&2
    exit 2
}

if [ -n "\${PORTULAN_CLI:-}" ]; then
    # An explicit location that does not hold the tool is COULD NOT RUN, not red. Without this test
    # \`node .../index.mjs\` dies 1, and 1 is this recipe's code for "the index drifted — regenerate
    # it": a pointer typed wrongly would send somebody to repair a file that was never wrong.
    if [ ! -f "\${PORTULAN_CLI}/index.mjs" ]; then
        printf 'verify: PORTULAN_CLI is set to %s, which holds no index.mjs — the index was NOT checked.\\n' "\${PORTULAN_CLI}" >&2
        exit 2
    fi
    need_node
    set -- node "\${PORTULAN_CLI}/index.mjs"
elif command -v portulan >/dev/null 2>&1; then
    set -- portulan index
elif [ -f ${JSON.stringify(`${bundle}/cli/index.mjs`)} ]; then # portulan:bundle-fallback
    need_node
    set -- node ${JSON.stringify(`${bundle}/cli/index.mjs`)} # portulan:bundle-fallback
else
    printf 'verify: the Portulan CLI is not reachable, so the index was NOT checked.\\n' >&2
    printf 'verify: looked at \$PORTULAN_CLI/index.mjs, portulan on PATH, and the bundle this\\n' >&2
    printf 'verify: workspace was drafted from. Set PORTULAN_CLI to a checkout, or install the CLI.\\n' >&2
    exit 2
fi

"\$@" --check .portulan
code=\$?

# 126 and 127 are the shell's two ways of saying it never ran the program — "found but not
# executable" and "not found" — and both can arrive here even though \`command -v portulan\` answered:
# a Node-based entry point whose interpreter is gone dies on exec, before any of this tool's own
# codes exist. Left unmapped, either reads downstream as this recipe having RUN and rendered a
# verdict about the index, which is the laundering \`need_node\` prevents on the branches it guards.
# The index tool itself only ever exits 0, 1 or 2, so neither code is ambiguous here.
if [ "\$code" -eq 126 ] || [ "\$code" -eq 127 ]; then
    printf 'verify: the index tool could not be executed (%s) — the index was NOT checked.\\n' "\$code" >&2
    exit 2
fi
exit "\$code"
`;
}

/** After the write, so a failed compile only warns; the guidance half only, since `.claude/settings.json` comes from a `compile` a person runs. */
function reportCard(target, say, warn) {
    try {
        compileGuidance(target);
        say(`init: compiled the boot card into ${COMPILED_CARD}, which Claude Code loads into every context here`);
    } catch (error) {
        warn(`init: the boot card was drafted and NOT compiled — ${error.message}. Until \`portulan compile\` runs clean, a session here boots through the slots, as before`);
        return;
    }
    if (cardIgnored(target)) {
        warn(`init: git ignores ${COMPILED_CARD}, so the card would reach no review and no fresh checkout — add an exception for it to .gitignore`);
    }
    let bytes;
    try {
        bytes = alwaysTier(target).entries.reduce((n, e) => n + e.bytes, 0);
    } catch (error) {
        warn(`init: the always tier could not be measured — ${error.message}`);
        return;
    }
    const tokens = tokensOf(bytes, ESTIMATED_BYTES_PER_TOKEN);
    say(
        `init: the always tier here is ~${tokens.toLocaleString("en-US")} tokens with the card, at 0036's estimate of ${ESTIMATED_BYTES_PER_TOKEN} bytes a token. ` +
            `A budget is yours to declare: 0036 offers the larger of ${OFFER_FLOOR_TOKENS.toLocaleString("en-US")} tokens and that, ` +
            `${Math.max(OFFER_FLOOR_TOKENS, tokens).toLocaleString("en-US")}, as \`context.always.budget.tokens\`, beside a \`context.ratio\` Claude Code's exact count measured here`,
    );
    const offer = offerText(splitOffers(target, { ratio: ESTIMATED_BYTES_PER_TOKEN, floor: OFFER_FLOOR_TOKENS }));
    if (offer !== null) say(`init: ${offer}`);
}

function reportLifetime(answers, say) {
    const lifetime = answers.cacheLifetime ?? null;
    if (lifetime !== null) {
        say(
            `init: the manifest declares a ${lifetime} cache lifetime, \`sessions.cache_lifetime\` at Workspace Definition ${SESSIONS_SPEC} — ` +
                "run `portulan compile`, which writes it into .claude/settings.json as `promptCacheTtl`",
        );
    } else if (answers.lifetimeDeclined) {
        say(
            `init: no cache lifetime declared, as you answered; \`sessions.cache_lifetime\` declares one, ${CACHE_LIFETIMES.map((v) => `"${v}"`).join(" or ")} ` +
                `at Workspace Definition ${SESSIONS_SPEC}, and \`--cache-lifetime\` drafts it`,
        );
    } else {
        for (const line of offerLines()) say(`init: ${line}`);
    }
}

// ------------------------------------------------------------------------- writing

export function residenceAt(target) {
    // `lstat` down the path before any read: `readFileSync` follows a `.portulan` link out of the repository.
    let here = target;
    for (const segment of [".portulan", "workspace.json"]) {
        here = path.join(here, segment);
        let stat;
        try {
            stat = fs.lstatSync(here);
        } catch (error) {
            if (error.code === "ENOENT") return { state: "none" };
            return { state: "unreadable", kind: "io", why: error.message };
        }
        if (stat.isSymbolicLink()) return { state: "symlink", where: path.relative(target, here) };
    }
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(here, "utf8"));
    } catch (error) {
        return { state: "unreadable", kind: "parse", why: error.message };
    }
    return { state: "present", kind: parsed?.kind ?? "unknown", name: parsed?.name ?? null };
}

/** The first of `roots` carrying `packId`, or null: first match wins, as in `resolvePack`. */
function packResolvedAt(roots, packId) {
    return roots.find((root) => fs.existsSync(path.join(root, packId, "pack.json"))) ?? null;
}

/** The roots a composed pack is checked against, predicting the `doctor` run after the draft; `why` is set only where discovery could not look. */
function expandRoots(roots, target, env) {
    const named = roots.filter((root) => root !== AUTO);
    const forced = roots.includes(AUTO);
    const derived = path.join(target, "packs");
    const refusal = namedWithAuto(named, forced);
    if (refusal) return { roots: [], why: null, refusal, asked: true };
    if (named.length) return { roots: named, why: null, refusal: null, asked: true };
    const found = discoverPackRoots({ env });
    if (!found.ok) return { roots: forced ? [] : [derived], why: found.why, refusal: null, asked: forced };
    return { roots: [...found.roots, derived], why: null, refusal: null, asked: forced };
}

export function collisions(target, files) {
    const found = [];
    for (const rel of files.keys()) {
        const segments = rel.split("/");
        let here = target;
        for (let i = 0; i < segments.length; i++) {
            here = path.join(here, segments[i]);
            let stat;
            try {
                stat = fs.lstatSync(here);
            } catch (error) {
                if (error.code === "ENOENT") {
                    // Nothing can exist below an absent path, so the rest of the chain is clear.
                    break;
                }
                found.push({ rel, why: `\`${path.relative(target, here)}\` could not be examined (${error.code})` });
                break;
            }
            const where = path.relative(target, here);
            if (stat.isSymbolicLink()) {
                found.push({ rel, why: `\`${where}\` is a symlink, and writing through it would leave the repository` });
                break;
            }
            if (i === segments.length - 1) {
                if (files.get(rel)?.append === undefined && !files.get(rel)?.ifAbsent) found.push({ rel, why: "already exists" });
                else if (!stat.isFile()) found.push({ rel, why: `\`${where}\` is in the way and is not a file` });
                break;
            }
            if (!stat.isDirectory()) {
                found.push({ rel, why: `\`${where}\` is in the way and is not a directory` });
                break;
            }
        }
    }
    return found;
}

// ------------------------------------------------------------------------- the interview

export function refuseIfGoverned(existing, spelling) {
    if (existing.state === "symlink") {
        throw new InitError(
            `\`${existing.where}\` is a symlink, and \`init\` will not follow one out of the repository — not to write ` +
                `through it, and not to read a workspace manifest through it either. A manifest reached that way ` +
                `describes some other directory, so any verdict about "this repository" drawn from it would be about ` +
                `somewhere else. Replace the link with a real directory, or draft into a repository that has none.`,
        );
    }
    if (existing.state === "unreadable") {
        const at = path.join(spelling, ".portulan");
        throw new InitError(
            existing.kind === "io"
                ? `could not examine \`${at}\` — ${existing.why}. Refusing rather than treating it as empty: ` +
                  `a directory this tool cannot look into is a question it could not answer, and "nothing looked" ` +
                  `must never be recorded as "nothing there". Fix the permissions and run this again.`
                : `could not read the workspace manifest already at \`${path.join(at, "workspace.json")}\` — ` +
                  `${existing.why}. Refusing to write over a manifest it cannot understand: a corrupt policy layer ` +
                  `is the case where overwriting costs the most and this tool knows the least. Repair the JSON and ` +
                  `run \`doctor\` on it, or — if it was never a workspace you meant to keep — move it aside and run ` +
                  `this again.`,
        );
    }
    if (existing.state === "present") {
        const what = existing.kind === "pointer" ? "a pointer to another workspace" : `a \`${existing.kind}\` workspace`;
        throw new InitError(
            `this repository already carries ${what}${existing.name ? ` (\`${existing.name}\`)` : ""} — a repository is ` +
                `governed by exactly one workspace, and \`init\` will not replace one. Moving between residences is a ` +
                `switch, not a re-run: the workspace is materialised in the new residence, a pointer or nothing is left ` +
                `in the old, and validation is green at both ends before the old one is retired. \`vendor\` is the ` +
                `subcommand that does it — \`portulan vendor <the workspace> --into <where it should live> --residence ` +
                `<in-repo|feed-side> --switch\` — and it holds that ordering so you do not have to. Doing it by hand the ` +
                `other way round leaves a window in which this repository is governed by nothing, which looks exactly ` +
                `like one that never adopted Portulan.`,
        );
    }
}

function terminal() {
    return {
        interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
        async ask(question) {
            const readline = await import("node:readline/promises");
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            try {
                return await rl.question(question);
            } catch {
                // A closed stdin rejects rather than returning: no answer is coming, which the caller refuses.
                return null;
            } finally {
                rl.close();
            }
        },
        say(line) {
            process.stdout.write(`${line}\n`);
        },
    };
}

/** Asks for what the flags and the answers file did not give, and fills `answers` in place. */
export async function interview(answers, { io, target, derivedName }) {
    const ask = async (prompt, { fallback = null, validate = () => null } = {}) => {
        for (;;) {
            const raw = await io.ask(fallback === null ? `${prompt}: ` : `${prompt} [${fallback}]: `);
            if (raw === null) throw new InitError("no answer — the interview ended before it finished, and nothing was written");
            const value = raw.trim() === "" ? fallback : raw.trim();
            if (value === null || value === "") {
                io.say("  that one has no default, so it needs an answer.");
                continue;
            }
            const why = validate(value);
            if (why === null) return value;
            io.say(`  ${why}`);
        }
    };

    io.say("");
    io.say(`init: drafting a workspace for ${target}`);
    io.say("init: every answer becomes a DRAFT you curate afterwards. Nothing is written until you say so.");
    io.say("");

    if (!answers.residence) {
        io.say("Where does this repository's workspace live?");
        io.say("  in-repo   a full workspace in this repository");
        io.say("  pointer   this repository is governed by a workspace that names it");
        answers.residence = await ask("residence", {
            validate: (v) => (RESIDENCES.has(v) ? null : `\`${v}\` is not a residence — the two are \`in-repo\` and \`pointer\`.`),
        });
        answers.given.add("residence");
    }

    if (answers.name === null) {
        answers.name = await ask("workspace name", {
            fallback: derivedName,
            validate: (v) => (SLUG.test(v) ? null : `\`${v}\` is not a slug — lowercase letters, digits and single hyphens (${SLUG.source}).`),
        });
        answers.given.add("name");
    }

    if (answers.summary === null) {
        answers.summary = await ask("one-line summary", { fallback: `The ${answers.name} workspace — drafted by \`init\`, and not yet curated.` });
        answers.given.add("summary");
    }

    if (answers.residence === "pointer") {
        if (answers.governedBy === null) {
            answers.governedBy = await ask("the governing workspace's name", {
                validate: (v) => (SLUG.test(v) ? null : `\`${v}\` is not a slug — it must be spelled exactly as that workspace's own \`name\`.`),
            });
            answers.given.add("governed-by");
        }
        if (answers.feed === null) {
            const feed = await ask("the feed it ships through", { fallback: "none" });
            if (feed !== "none") {
                answers.feed = feed;
                answers.given.add("feed");
            }
        }
    } else if (!answers.given.has("checkpoints") && !answers.given.has("cycle")) {
        io.say("");
        io.say("The supervised cycle composes a checkpoints pack, so full-lane work gets a fresh-context");
        io.say("verdict at session-open, pre-commit and milestone-close. It is opt-out.");
        const pack = await ask("checkpoints pack (`none` to compose nothing)", { fallback: DEFAULT_CHECKPOINTS });
        if (pack === "none") {
            answers.cycle = false;
        } else {
            answers.checkpoints = pack;
            answers.given.add("checkpoints");
        }
    }

    if (answers.residence === "in-repo" && !answers.given.has("cache-lifetime")) {
        io.say("");
        for (const line of offerLines({ asking: true })) io.say(line);
        const lifetime = await io.ask("Five-minute cache writes? [y/N]: ");
        if (lifetime === null) throw new InitError("no answer — the interview ended before it finished, and nothing was written");
        if (/^y(es)?$/i.test(lifetime.trim())) {
            answers.cacheLifetime = "5m";
            answers.given.add("cache-lifetime");
        } else {
            answers.lifetimeDeclined = true;
        }
    }

    io.say("");
    io.say("init: about to draft");
    io.say(`  residence   ${answers.residence}`);
    io.say(`  name        ${answers.name}`);
    io.say(`  summary     ${answers.summary}`);
    if (answers.residence === "pointer") {
        io.say(`  governed by ${answers.governedBy}`);
        io.say(`  feed        ${answers.feed ?? "(none)"}`);
    } else {
        io.say(`  cycle       ${answers.cycle ? answers.checkpoints : "(none — composing no packs)"}`);
        io.say(
            `  cache       ${
                answers.cacheLifetime ? `${answers.cacheLifetime}, as \`sessions.cache_lifetime\` at Workspace Definition ${SESSIONS_SPEC}` : "(none — the host's default lifetime)"
            }`,
        );
    }
    io.say("");
    const confirm = await io.ask("Write these files? [y/N]: ");
    if (confirm === null || !/^y(es)?$/i.test(confirm.trim())) {
        throw new InitError("nothing written — you declined at the confirmation. Run this again when the answers are right.");
    }
}

// ------------------------------------------------------------------------- the entry point

export function usage() {
    return [
        "portulan init — draft a workspace for a repository that has none",
        "",
        "  portulan init [options] <repository-directory>",
        "  node cli/init.mjs [options] <repository-directory>      (from a checkout)",
        "",
        "  --residence <in-repo|pointer>  REQUIRED. Where this repository's workspace lives:",
        "                                 in the repository, or in a workspace that names it.",
        "                                 There is no default — this is the question init asks.",
        "  --governed-by <workspace>      Required with `pointer`: the governing workspace's name.",
        "  --feed <name>                  Optional, pointer only: the feed it ships through.",
        "  --name <slug>                  The workspace's name. Defaults to the directory's.",
        "  --summary <text>               One line an agent reads before loading anything else.",
        "  --checkpoints <category/name>  The checkpoint pack to compose. Default: " + DEFAULT_CHECKPOINTS + ".",
        "  --no-cycle                     Compose no packs. The binding is opt-out, not opt-in.",
        "  --pack-root <dir>              Where packs are looked up, so the composed one can be",
        "                                 confirmed to exist. Repeatable. `auto` discovers it from",
        "                                 the host's plugin cache; `./auto` names a directory.",
        "  --cache-lifetime <5m|1h>       In-repo only: declare `sessions.cache_lifetime`, which",
        "                                 `compile` writes as Claude Code's `promptCacheTtl`. Unset,",
        "                                 the host's default stands and five minutes is offered.",
        "  --answers <file>               A JSON object of answers. Flags override its keys.",
        "  --no-interview                 Never ask, even at a terminal: refuse instead, naming the flag.",
        "",
        "Exit codes: 0 it wrote · 2 it wrote nothing. There is no 1: init renders no verdict.",
        "",
        "At a terminal, anything you have not answered is asked, and nothing is written until you",
        "confirm. Where stdin or stdout is not a TTY nothing is asked — the answers arrive as flags",
        "or as `--answers`, and a missing one is refused with the flag that supplies it.",
    ].join("\n");
}

export async function run(argv, options = {}) {
    const say = options.say ?? ((line) => process.stdout.write(`${line}\n`));
    const warn = options.warn ?? ((line) => process.stderr.write(`${line}\n`));

    try {
        if (SLUG === null) {
            throw new InitError(
                `could not read spec/workspace.schema.json, which defines what a valid name is — ${SCHEMA_ERROR?.message}. ` +
                    `Refusing to write a manifest it cannot check.`,
            );
        }

        const parsed = parseArgs(argv);
        if (parsed.help) {
            say(usage());
            return 0;
        }

        if (!parsed.target) {
            throw new InitError("no target directory given — `init <repository-directory>` drafts a workspace into a repository");
        }

        const target = path.resolve(parsed.target);
        let stat;
        try {
            stat = fs.statSync(target);
        } catch (error) {
            throw new InitError(
                `\`${parsed.target}\` does not exist — ${error.message}. \`init\` drafts a workspace INTO a repository; ` +
                    `it does not create the repository.`,
            );
        }
        if (!stat.isDirectory()) throw new InitError(`\`${parsed.target}\` is not a directory`);

        const answers = resolveAnswers(parsed.flags);
        const derivedName = slugify(path.basename(target));

        const io = options.io ?? terminal();
        const interviewing = io.interactive && !parsed.flags.noInterview;
        if (interviewing) {
            // Asked before the questions too, so nobody answers them to be told the repository is already governed.
            refuseIfGoverned(residenceAt(target), parsed.target);
            await interview(answers, { io, target, derivedName });
        }

        if (answers.name === null) answers.name = derivedName;
        if (answers.name === null) {
            throw new InitError(
                `the directory name \`${path.basename(target)}\` yields no usable workspace name — pass \`--name <slug>\`. ` +
                    `A workspace called something nobody chose is worse than being asked.`,
            );
        }
        validateAnswers(answers);

        refuseIfGoverned(residenceAt(target), parsed.target);

        let packAdvice = null;
        if (answers.residence === "in-repo" && answers.cycle) {
            const expanded = expandRoots(answers.packRoots, target, options.env);
            if (expanded.refusal) throw new InitError(expanded.refusal);
            const resolvedAt = packResolvedAt(expanded.roots, answers.checkpoints);
            const resolved = resolvedAt !== null;
            if (expanded.asked) {
                if (expanded.why) {
                    throw new InitError(
                        `\`--pack-root auto\` could not read this host's plugin record, so whether \`${answers.checkpoints}\` ` +
                            `is installed is unknown rather than no — ${expanded.why}. Name a root explicitly, or run with ` +
                            `\`--no-cycle\` and compose the pack later.`,
                    );
                }
                if (!resolved) {
                    throw new InitError(
                        `the pack \`${answers.checkpoints}\` does not resolve under ${answers.packRoots.map((r) => `\`${r}\``).join(", ")} ` +
                            `— refusing to compose a pack that is not there. Pass a root that carries it, name a different pack ` +
                            `with \`--checkpoints\`, or run with \`--no-cycle\` and compose it later.`,
                    );
                }
            }
            // Unasked, an unresolved pack is advice, never a refusal: whether files are written must not depend on the host.
            packAdvice = { resolved, why: expanded.why, inTree: resolvedAt !== null && resolvedAt === path.join(target, "packs") };
        }

        const observed = scan(target, { comments: answers.residence !== "pointer" });
        const files = draft(answers, observed);

        if (files.has(".gitignore")) {
            const { lines } = claudeRulesUnignore(target);
            if (lines.length) files.get(".gitignore").append.push("", ...lines);
        }

        const clash = collisions(target, files);
        if (clash.length) {
            const byCause = new Map();
            for (const { rel, why } of clash) (byCause.get(why) ?? byCause.set(why, []).get(why)).push(rel);
            const summary = [...byCause]
                .map(([why, rels]) =>
                    rels.length > 2
                        ? `${why} — blocking ${rels.length} drafted files, including \`${rels[0]}\``
                        : `${why} — ${rels.map((r) => `\`${r}\``).join(", ")}`,
                )
                .join("; ");
            throw new InitError(
                `refusing to write into \`${path.join(parsed.target, ".portulan")}\`: ${summary}. \`init\` drafts a ` +
                    `workspace where there is none; it does not merge into one somebody has started, and it does not ` +
                    `follow a link out of the repository. Move or remove what is in the way, or draft into a clean ` +
                    `directory and copy across what you want to keep.`,
            );
        }

        // The manifest last: a run failing midway leaves no torso that `residenceAt` would read as a governed repository.
        const manifest = ".portulan/workspace.json";
        const left = [];
        for (const [rel, file] of [...files].filter(([rel]) => rel !== manifest).concat([[manifest, files.get(manifest)]])) {
            const full = path.join(target, rel);
            if (file.ifAbsent && fs.lstatSync(full, { throwIfNoEntry: false }) !== undefined) {
                left.push(rel);
                continue;
            }
            fs.mkdirSync(path.dirname(full), { recursive: true });
            if (file.append !== undefined) {
                let before = null;
                try {
                    before = fs.readFileSync(full, "utf8");
                } catch (error) {
                    if (error.code !== "ENOENT") throw error;
                }
                fs.writeFileSync(full, withIgnoreLines(before, file.append));
                continue;
            }
            fs.writeFileSync(full, file.contents);
            if (file.mode !== undefined) fs.chmodSync(full, file.mode);
        }

        const inWorkspace = [...files.keys()].filter((rel) => rel.startsWith(".portulan/")).length;
        const beside = [...files.keys()].filter((rel) => !rel.startsWith(".portulan/") && !left.includes(rel));
        say(
            `init: drafted ${inWorkspace} file(s) into ${path.join(parsed.target, ".portulan")}` +
                (beside.length ? `, and ${beside.map((r) => `\`${r}\``).join(", ")} beside it` : ""),
        );
        for (const rel of left) say(`init: left the repository's own \`${rel}\` as it is`);
        if (answers.residence !== "pointer") {
            reportCard(target, say, warn);
            reportLifetime(answers, say);
        }
        if (answers.residence === "pointer") {
            say(`init: this repository is recorded as governed by \`${answers.governedBy}\`. Nothing was fetched.`);
        } else {
            say("init: every file is a DRAFT. Read .portulan/README.md before trusting any of it.");
            say("init: the verify recipe exits 2 until you say what green means here — that is deliberate.");
            if (observed.commentHistory === null) say(`init: drafted no \`comments\` recipe, since its count could not be taken: ${observed.uncounted}; \`portulan upgrade\` offers one once it can be.`);
            if (answers.cycle) {
                const workspaceArg = path.join(parsed.target, ".portulan");
                if (answers.packRoots.length) {
                    const rootArgs = answers.packRoots.map((r) => `--pack-root ${r}`).join(" ");
                    say(`init: this workspace composes \`${answers.checkpoints}\`, and it resolved — validate with:`);
                    say(`init:   doctor ${rootArgs} ${workspaceArg}`);
                } else if (packAdvice?.resolved) {
                    const where = packAdvice.inTree ? "from `packs/` in this repository" : "from this host's plugin cache";
                    say(`init: this workspace composes \`${answers.checkpoints}\`, and it resolved ${where} — validate with:`);
                    say(`init:   doctor ${workspaceArg}`);
                    if (!packAdvice.inTree) {
                        say("init: that root is this machine's, not the repository's — pin `--pack-root <dir>` in CI.");
                    }
                } else if (packAdvice?.why) {
                    say(
                        `init: this workspace composes \`${answers.checkpoints}\` and this host's plugin record ` +
                            `could not be read, so whether it is installed is unknown rather than no:`,
                    );
                    say(`init:   ${packAdvice.why}`);
                    say(`init:   doctor --pack-root <dir> ${workspaceArg}     (naming where the pack lives)`);
                } else {
                    say(
                        `init: this workspace composes \`${answers.checkpoints}\` and nothing here resolves it — ` +
                            `not the host's plugin cache, and not \`packs/\` in the repository — so validation is RED until you say where to look:`,
                    );
                    say(`init:   doctor --pack-root <dir> ${workspaceArg}`);
                    say("init: or re-draft with --no-cycle and compose it once you know.");
                }
            }
        }
        return 0;
    } catch (error) {
        if (error instanceof InitError) {
            warn(`init: ${error.message}`);
            return 2;
        }
        warn(`init: could not run — ${error.message}`);
        return 2;
    }
}

// `?? ""`: `process.argv[1]` is absent when a non-script imports this, and `pathToFileURL(undefined)` throws.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = await run(process.argv.slice(2));
}
