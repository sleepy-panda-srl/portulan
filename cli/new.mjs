#!/usr/bin/env node
// `new` — scaffold a skill · persona · pack · workspace · gate-policy · repo-card from a core template,
// into the user's OWN layer, never into `core/`.
//
// Milestone 7, row 7 of docs/plan.md. Zero dependencies, ESM, no build step (the session-0 ruling).
//
// ## The one property this tool states in the imperative
//
// **Never into `core/`.** Row 7 says it, and it is the reason this tool exists at all rather than being
// advice: the cascade runs core < pack < workspace < repo card < task, and a team that answers "where do
// I put my own skill?" by editing `core/` has merged their specifics into the layer that ships to
// everybody. Thesis 6 of the constitution — storage follows ownership.
//
// The refusal is **resolution-based, not pattern-based**, because every interesting escape parses fine:
// `packs/../core` matches any path rule you could write, and a symlinked destination matches nothing at
// all until you follow it. So the check resolves first and compares after — the same conclusion
// `spec/pack.schema.json`'s `$defs/filePath` reaches from the other side, and the one `cli/compile.mjs`
// already acts on for its policy path.
//
// ## Two exit codes, deliberately
//
// **0 wrote · 2 could not run.** There is no exit 1, for the same reason `init` has none: this tool
// renders no verdict about anybody's workspace, so it has no red to report. `doctor` is what says
// whether what landed is any good, and conflating "I could not write this" with "what I wrote is wrong"
// would make a caller unable to tell a missing template from a bad scaffold.
//
// ## What it refuses, ahead of the first byte
//
// A file it would overwrite — **any** file, never only a manifest. Session 1 shipped a residence check
// keyed on `workspace.json` and treated it as an answer to *is it safe to write here?*; a hand-written
// `gate-map.md` was silently overwritten. Two questions, one key: that was the whole defect. Here there
// is only one question and it is asked about every path.
//
// A symlink anywhere on the destination chain — resolved links are how a write leaves the tree it was
// meant to stay inside, measured on `init` at nine files written into an unrelated directory and
// reported as success.
//
// And an `lstat` failure that is **not** `ENOENT`, because only `ENOENT` means absent. `EACCES` means
// the question could not be answered, and answering *nothing there* to an unanswerable question is
// "nothing looked" recorded as "nothing wrong".

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.resolve(HERE, "..", "core");

/** Raised for anything that means `new` could not run. Carries no verdict about a workspace. */
export class NewError extends Error {}

/**
 * The six kinds row 7 names. A Set rather than an array so membership is the question asked, and
 * exported so the suite compares against the row rather than against a count that passes while a name
 * is wrong.
 */
export const KINDS = new Set(["skill", "persona", "pack", "workspace", "gate-policy", "repo-card"]);

/** A lowercase hyphenated identifier — the same shape `$defs/slug` fixes in both schemas. */
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Kinds whose artifact is JSON, extracted from the template's first fenced `json` block. */
const JSON_KINDS = new Set(["pack", "workspace", "gate-policy"]);

/** Where a kind's core template lives. One place, so a missing template is one failure and not six. */
export function template(kind) {
    return path.join(CORE, "templates", `${kind}.md`);
}

/**
 * The skeleton inside a template — everything after the first standalone `---`, or, for the JSON kinds,
 * the first fenced ```json block after it.
 *
 * The separator is the first `---` at column 0 rather than the last, which matters for the skill
 * template specifically: its skeleton BEGINS with YAML frontmatter, so the file legitimately contains
 * two `---` lines in a row and taking the last one would swallow the frontmatter the skeleton exists to
 * provide.
 */
export function skeleton(kind, source) {
    const lines = source.split("\n");
    const at = lines.findIndex((line) => line.trimEnd() === "---");
    if (at === -1) throw new NewError(`the core template for \`${kind}\` has no \`---\` separator — it cannot be read as a skeleton`);
    const body = lines.slice(at + 1).join("\n");
    if (!JSON_KINDS.has(kind)) return `${body.trim()}\n`;

    const open = body.indexOf("```json");
    if (open === -1) throw new NewError(`the core template for \`${kind}\` carries no fenced \`json\` block, and \`${kind}\` scaffolds JSON`);
    const start = body.indexOf("\n", open) + 1;
    const close = body.indexOf("```", start);
    if (close === -1) throw new NewError(`the core template for \`${kind}\` has an unterminated \`json\` block`);
    return `${body.slice(start, close).trim()}\n`;
}

/**
 * Where a scaffold lands, as a pure function of kind, name and target.
 *
 * A repo card resolves through the workspace's **declared** `repos` slot rather than through a
 * convention, because deriving a path a manifest does not declare is the tool inventing a slot — and a
 * workspace that disagrees with its own manifest on the day it was scaffolded is exactly the drift the
 * claims lint exists to catch.
 */
export function destination(kind, name, target) {
    switch (kind) {
        case "skill":
            return path.join(target, "skills", name, "SKILL.md");
        case "persona":
            return path.join(target, "personas", `${name}.md`);
        case "gate-policy":
            return path.join(target, `${name}.json`);
        case "repo-card": {
            const slot = declaredSlot(target, "repos");
            // The slot value is the WORKSPACE's, not this tool's, and a `..` in it escapes:
            // `path.join("/ws/sub", "../../evil")` is `/evil`, measured. (An *absolute* slot does not
            // escape `join` — that is `resolve`'s behaviour, not `join`'s — so only the `..` half of the
            // review that found this was right, and the fix is written against what was measured rather
            // than against what was reported.) Checked after resolution, like every other containment
            // question here. Copilot, round 3 on #156.
            const landing = path.resolve(target, slot, `${name}.md`);
            const root = path.resolve(target);
            if (landing !== root && !landing.startsWith(`${root}${path.sep}`)) {
                throw new NewError(
                    `this workspace's \`repos\` slot is \`${slot}\`, which resolves to ${landing} — outside the workspace at ${display(root)}. ` +
                        `Refusing: a scaffold that follows a slot out of its own workspace writes wherever the manifest points, and a manifest is ` +
                        `exactly the thing a reader assumes has been checked`,
                );
            }
            return landing;
        }
        default:
            throw new NewError(`\`${kind}\` writes more than one file — use \`plan\` rather than \`destination\``);
    }
}

/** Reads one slot out of a workspace manifest, refusing rather than guessing when it is not declared. */
function declaredSlot(workspaceDir, slot) {
    const manifestPath = path.join(workspaceDir, "workspace.json");
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (cause) {
        if (cause.code === "ENOENT") {
            throw new NewError(
                `${display(workspaceDir)} carries no \`workspace.json\`, so there is no manifest to read a \`${slot}\` slot from. ` +
                    `Point \`--into\` at a workspace directory, or run \`init\` if this repository has no workspace yet`,
            );
        }
        throw new NewError(`${display(workspaceDir)}/workspace.json could not be read — ${cause.code ?? cause.message}`);
    }
    const declared = manifest?.slots?.[slot];
    if (typeof declared !== "string" || !declared.trim()) {
        throw new NewError(
            `this workspace declares no \`${slot}\` slot, so there is nowhere for a ${slot === "repos" ? "repo card" : slot} to land. ` +
                `Add \`"slots": { "${slot}": "${slot}/" }\` to its \`workspace.json\` first — scaffolding into a path the manifest does not declare ` +
                `would leave the workspace disagreeing with itself on the day it was written`,
        );
    }
    return declared;
}

/**
 * Which of the destination paths already exist, and which sit behind a symlink.
 *
 * `lstatSync`, never `existsSync`/`statSync` — both of those follow links, which is how `init` wrote
 * nine files outside a repository and reported success. A symlink is reported as its own state rather
 * than resolved and permitted: deciding whether a link's target is "really" inside the intended tree is
 * a containment judgement with a bad failure mode, where refusing has none.
 *
 * An existing **directory** is not a collision. This tool writes files into directories a user may
 * legitimately have created; refusing an empty directory would make `new` unusable in the ordinary case
 * and teach nobody anything.
 */
export function collisions(paths, root = null) {
    const found = [];
    for (const target of paths) {
        for (const step of chain(target, root)) {
            let stat;
            try {
                stat = fs.lstatSync(step);
            } catch (cause) {
                // Only ENOENT means absent. Anything else means the question could not be answered, and
                // an unanswerable question must not be answered "no".
                if (cause.code === "ENOENT") continue;
                found.push({ path: step, why: "unreadable", detail: cause.code ?? cause.message });
                break;
            }
            if (stat.isSymbolicLink()) {
                found.push({ path: step, why: "symlink" });
                break;
            }
            // A DIRECTORY at the leaf is a collision too, and the paragraph above says the opposite —
            // rightly, about the *intermediate* segments, and wrongly here: every path this plans is a
            // file, so a directory sitting at one is something already there. Preflight passed and
            // `writeFileSync` then threw `EISDIR` mid-loop, which is the ordering this whole function
            // exists to prevent. Found by Copilot on #164 against the copy of this shape in
            // `cli/vendor.mjs`; fixed in both, because a defect and its source are the same defect.
            if (step === target) {
                if (stat.isDirectory()) found.push({ path: step, why: "directory" });
                else found.push({ path: step, why: "exists" });
            }
        }
    }
    return found;
}

/**
 * The path steps from `root` down to `target`, inclusive of both — or every step to the filesystem root
 * when no root is given.
 *
 * **Where the boundary sits is the whole rule, and getting it wrong was found by running rather than by
 * reading.** The first cut walked to the filesystem root and refused any symlink anywhere on the chain.
 * On macOS `os.tmpdir()` resolves under `/var`, and `/var` is a symlink to `/private/var` — so every
 * scratch directory in this suite was refused, and by extension so was every user whose destination sat
 * under a symlinked mount, a home directory on a linked volume, or `/tmp`.
 *
 * The reason it was wrong is not that the check was too strict; it is that it asked about the wrong
 * paths. A symlink among the **ancestors of the directory the user named** is a fact about their
 * filesystem, and the user named that path — resolving it is not an escape, it is obeying them. A
 * symlink **at or below** the named path is different: those are the segments this tool derives and
 * creates, and a link there is precisely how `init` wrote nine files into an unrelated directory and
 * reported success (session 1, rounds 4 and 6, the write path and then the read path).
 *
 * So the boundary is the named destination. Above it, resolve. At it and below it, refuse.
 */
function chain(target, root = null) {
    const steps = [];
    let at = target;
    const stop = root === null ? null : path.resolve(root);
    for (let i = 0; i < 64; i += 1) {
        steps.push(at);
        if (stop !== null && at === stop) break;
        const up = path.dirname(at);
        if (up === at) break;
        at = up;
    }
    return steps.reverse();
}

/** A path as a reader would recognise it — relative to cwd when that is shorter, absolute otherwise. */
function display(target) {
    const rel = path.relative(process.cwd(), target);
    return rel && !rel.startsWith("..") && rel.length < target.length ? rel : target;
}

/**
 * Is this destination inside a `core/` — this checkout's or anybody's?
 *
 * The rule is about the LAYER, not about this repository: a vendored or installed copy of core is still
 * core, and a scaffold landing there is still an edit to a file the project ships. So two questions are
 * asked — is it inside THIS checkout's core, and does the resolved path contain a `core` directory that
 * looks like one (it holds `engine.md` or `templates/`).
 */
export function intoCore(resolved) {
    // **Compared case-INSENSITIVELY, because the filesystem may not care and `realpathSync` does not
    // canonicalise case.** Measured by the pre-commit checkpoint on macOS: `--into <repo>/CORE/templates/x`
    // exited 0 and created a directory inside the shipped `core/`. A case-sensitive compare is not a
    // compare at all on a case-insensitive volume, which is the default on macOS and common on Windows.
    //
    // The cost, stated rather than discovered: on a case-SENSITIVE filesystem a directory genuinely named
    // `CORE` — distinct from `core` — is also refused. That is a conservative refusal, and the asymmetry
    // is the whole argument: refusing costs the user one corrected path, permitting costs an edit to a
    // layer this project ships and the property row 7 states in the imperative.
    const fold = (p) => p.toLowerCase();
    const ours = path.resolve(CORE);
    if (fold(resolved) === fold(ours) || fold(resolved).startsWith(fold(`${ours}${path.sep}`))) return ours;
    const parts = resolved.split(path.sep);
    for (let i = parts.length; i > 0; i -= 1) {
        if (fold(parts[i - 1]) !== "core") continue;
        const candidate = parts.slice(0, i).join(path.sep) || path.sep;
        if (fs.existsSync(path.join(candidate, "engine.md")) || fs.existsSync(path.join(candidate, "templates"))) return candidate;
    }
    return null;
}

/**
 * Parse the command line.
 *
 * A value beginning with **any** leading `-` is a missing value, not a value — session 1's round 9,
 * where `--residence -h` was consumed as the residence and the user was then blamed for a token they
 * typed as a flag. `-h` is the likeliest thing to land there and it is a help request.
 *
 * An empty string is refused for every flag, because none of them has a meaningful empty value and an
 * empty one reached a manifest once already, failing `minLength: 1` on the run that reported success.
 */
export function parseArgs(argv) {
    const out = { kind: null, name: null, into: null, category: null, kindOf: null, governedBy: null, help: false, given: new Set() };
    const positional = [];
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--help" || arg === "-h") {
            out.help = true;
            continue;
        }
        if (!arg.startsWith("-")) {
            positional.push(arg);
            continue;
        }
        const flag = arg;
        const key = { "--into": "into", "--category": "category", "--kind": "kindOf", "--governed-by": "governedBy" }[flag];
        if (!key) {
            throw new NewError(
                `unknown option \`${flag}\` — run \`portulan new --help\` for the ones this understands, ` +
                    `or \`node cli/new.mjs --help\` from a checkout`,
            );
        }
        const value = argv[i + 1];
        if (value === undefined || value.startsWith("-")) {
            throw new NewError(`${flag} needs a value${value === undefined ? "" : ` — \`${value}\` reads as another flag`}`);
        }
        if (value === "") throw new NewError(`${flag} was given an empty value, and no option here has a meaningful empty value`);
        out[key] = value;
        out.given.add(flag);
        i += 1;
    }
    out.kind = positional[0] ?? null;
    out.name = positional[1] ?? null;
    return out;
}

function usage() {
    return [
        "portulan new <kind> <name> [options]",
        "",
        "  kinds:",
        "    skill        a procedure loaded on demand, into a pack you own",
        "    persona      a role with a five-part contract, into a pack you own",
        "    pack         the cascade's middle layer — skills, personas, recipes, gate fragments",
        "    workspace    a workspace authored by hand (use `init` to onboard a repository)",
        "    gate-policy  actions bound to tiers, compiled into host enforcement",
        "    repo-card    the per-repository layer, into a workspace's declared `repos` slot",
        "",
        "  --into <dir>       where it lands. Never inside `core/`.",
        "  --category <c>     stacks | tools | rituals   (packs only)",
        "  --kind <k>         repository | demo | portfolio | pointer   (workspaces only)",
        "  --governed-by <ws> the governing workspace's name   (required with --kind pointer)",
        "",
        "  Exit 0 wrote · 2 could not run. There is no exit 1: this tool renders no verdict",
        "  about a workspace, so it has no red to report. Run `doctor` for that.",
    ].join("\n");
}

/**
 * What a kind writes: a list of `{ path, contents }`. Multi-file kinds are planned in one place so the
 * collision check sees **every** path before the first byte is written — a partial write that wedges its
 * own retry is what session 1 shipped when the manifest went out first.
 */
export function plan(parsed) {
    const { kind, name } = parsed;
    const into = path.resolve(parsed.into ?? process.cwd());
    const body = skeleton(kind, fs.readFileSync(template(kind), "utf8"));

    if (kind === "pack") {
        const category = parsed.category;
        if (!category) throw new NewError("`pack` needs `--category` — stacks, tools or rituals. It is spelled as the directory that holds the pack, so the `category/name` reference and the tree agree by construction");
        if (!["stacks", "tools", "rituals"].includes(category)) {
            throw new NewError(`\`--category ${category}\` is not one of stacks, tools or rituals`);
        }
        const root = path.join(into, category, name);
        return [
            { path: path.join(root, "pack.json"), contents: fill(body, { name, category }) },
            { path: path.join(root, "README.md"), contents: packReadme(name, category) },
            { path: path.join(root, "skills", ".gitkeep"), contents: "" },
            { path: path.join(root, "personas", ".gitkeep"), contents: "" },
        ];
    }

    if (kind === "workspace") {
        const root = path.join(into, name);
        const wkind = parsed.kindOf ?? "portfolio";
        if (!["repository", "demo", "portfolio", "pointer"].includes(wkind)) {
            throw new NewError(`\`--kind ${wkind}\` is not one of repository, demo, portfolio or pointer`);
        }
        if (wkind === "pointer" && !parsed.governedBy) {
            throw new NewError(
                "`--kind pointer` needs `--governed-by <workspace-name>`. A pointer's whole content is the name of the workspace that " +
                    "governs this repository — one repository is governed by exactly one workspace — so a pointer that names nobody is a " +
                    "manifest `doctor` refuses. If you are onboarding a repository rather than hand-authoring, use `portulan init`, which " +
                    "asks the residence question instead of taking it as a flag",
            );
        }
        if (wkind !== "pointer" && parsed.governedBy) {
            throw new NewError(`\`--governed-by\` is only meaningful with \`--kind pointer\` — a ${wkind} workspace governs, it is not governed`);
        }
        return workspaceFiles(root, name, wkind, body, parsed.governedBy);
    }

    return [{ path: destination(kind, name, into), contents: fill(body, { name }) }];
}

/** Substitutes the placeholders a scaffold can honestly know. Everything else stays in `{braces}`. */
function fill(body, values) {
    let out = body;
    if (values.name !== undefined) out = out.replaceAll("{kebab-case-name}", values.name);
    if (values.category !== undefined) out = out.replaceAll("{stacks | tools | rituals}", values.category);
    return out;
}

function packReadme(name, category) {
    return [
        `# Pack — ${name}`,
        "",
        `A \`${category}\` pack. **Written by its author, not by the scaffold** — this file is where this`,
        "pack's content, rationale and honest limits go, and a pack whose README still says this sentence",
        "has not been finished.",
        "",
        "## What it contributes",
        "",
        "{Skills, personas, verify recipes, gate fragments — and for each, why an adopter would want it.}",
        "",
        "## Honest limits",
        "",
        "{What this pack does not cover, and the neighbouring pack it is easy to confuse with. Required:",
        "a pack that lists only what it does reads as covering everything.}",
        "",
    ].join("\n");
}

/**
 * A workspace scaffold that is **green under `doctor` on the run after it is written**.
 *
 * That is a deliberate departure from what `init` does, and the reason is that the two tools are in
 * different situations rather than that one of them is wrong. `init` composes a checkpoints pack by
 * default because row 7 clause (a) says the cycle arrives opt-**out**, and nothing discovers a pack — so
 * its draft is red until a root is named, loudly and on purpose. `new workspace` composes no pack: it is
 * for a workspace somebody is authoring by hand, where a red first run would be a red the author did not
 * cause and cannot act on.
 *
 * `portfolio` is the default kind for the same reason. A `repository` workspace must declare `tree`, and
 * a scaffold that guesses which tree it governs would be a claim about the filesystem that the scaffold
 * cannot check — the claims lint would then grade a repository nobody chose.
 */
function workspaceFiles(root, name, wkind, body, governedBy = null) {
    // A POINTER carries `governed_by` and NONE of the governing keys — no slots, no verify, no gates.
    // The Workspace Definition requires the first and `doctor` refuses the second, so a pointer built
    // from the governing shape is red on the run after it is written. Copilot's suppressed notes on #156
    // caught it, twice on one file: the scaffolder always wrote the governing shape while the help screen
    // advertised `pointer` as a supported kind. That is this session's own recurring defect for the third
    // time — a scaffold failing the validation that lives beside it — so it is fixed rather than triaged.
    if (wkind === "pointer") {
        // 2.7, not the newest definition: a writer declares the version its OUTPUT needs, and a pointer
        // needs 2.7 — the version that added the kind. Nothing scaffolded here declares a key from a
        // later MINOR, so claiming one would narrow the manifest against adopter tooling pinned at 2.7
        // for a contract it does not use. Same rule as `cli/init.mjs`'s and `cli/vendor.mjs`'s `SPEC`,
        // and as the `GATE_POLICY_SPEC = "2.2"` beside them.
        const manifest = { portulan: { spec: "2.7" }, name, kind: "pointer", governed_by: { workspace: governedBy } };
        return [
            { path: path.join(root, "workspace.json"), contents: `${JSON.stringify(manifest, null, 2)}\n` },
            {
                path: path.join(root, "README.md"),
                contents: [
                    `# Pointer — ${name}`,
                    "",
                    `This repository is governed by the \`${governedBy}\` workspace, which lives elsewhere. **One repository is`,
                    "governed by exactly one workspace**, so this file is a pointer and not a second one: it carries no slots,",
                    "no verify recipes and no gate policy, because those belong to the governing workspace.",
                    "",
                    "Nothing here resolves the pointer for you — reading it is not fetching it. `doctor` reports the governor",
                    "it names; finding that workspace on this machine is a separate question.",
                    "",
                ].join("\n"),
            },
        ];
    }

    const manifest = {
        // The version this output NEEDS, not the newest one — see the pointer branch above.
        portulan: { spec: "2.7" },
        name,
        summary: `{One line: whose workspace this is and what it governs.}`,
        kind: wkind,
        // `repos` is declared and its directory scaffolded so the six kinds compose end-to-end from
        // `new` alone: without it, `new repo-card --into <a workspace new just wrote>` exits 2 because
        // the manifest declares nowhere for a card to land. A tool whose own output cannot host its own
        // next command is a tool with a seam in the middle of it.
        slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md", repos: "repos/" },
        // The schema requires a `verify` block on every workspace that is not a pointer, so this is not
        // optional and a scaffold omitting it is red on the run after it is written. What it must NOT be
        // is a stub exiting 0: the author has not said what green means here yet, and a false green under
        // every gate from the day the workspace was created is the worst artifact this tool could emit.
        // Exit 2 — could not run — is the honest state, and it is the same answer `init` reached.
        verify: {
            default: "unset",
            recipes: [{ id: "unset", run: "./verify/unset.sh", requires: ["bash"], doc: "verify/README.md" }],
        },
    };
    if (wkind === "repository") manifest.tree = "../";

    return [
        { path: path.join(root, "verify", "unset.sh"), contents: unsetRecipe(name) },
        { path: path.join(root, "verify", "README.md"), contents: verifyReadme(name) },
        { path: path.join(root, "workspace.json"), contents: `${JSON.stringify(manifest, null, 2)}\n` },
        { path: path.join(root, "identity.md"), contents: slotFile("Identity", name, "Who this team is, the stack, and the glossary. The first thing an agent reads after the kernel.") },
        { path: path.join(root, "principles.md"), contents: slotFile("Principles", name, "This team's own binding principles — what makes an agent work THIS team's way rather than generically.") },
        { path: path.join(root, "gate-map.md"), contents: slotFile("Gate map", name, "Concrete actions bound to Auto / Propose / Gated / Prohibited, plus the triage threshold. Run `new gate-policy` for the machine-readable half that compiles.") },
        { path: path.join(root, "repos", "README.md"), contents: `# Repo cards — ${name}\n\n> One card per repository this workspace covers. Run \`portulan new repo-card <name> --into <this directory's parent>\`.\n` },
        { path: path.join(root, "README.md"), contents: workspaceReadme(name, wkind, body) },
    ];
}

/**
 * The recipe a scaffolded workspace starts with: one that **exits 2**, meaning *could not run*.
 *
 * It is deliberately not a stub exiting 0. A verify recipe is what decides what *done* means for a
 * workspace, the Stop-gate runs the default, and a recipe returning green before anybody has said what
 * green means would put a false pass under every gate the workspace has — on day one, in the artifact
 * meant to welcome the author. The three-code discipline exists exactly for this: a recipe that cannot
 * run must never be indistinguishable from one that ran and passed.
 */
function unsetRecipe(name) {
    return [
        "#!/usr/bin/env bash",
        `# The starting verify recipe for the \`${name}\` workspace. It exits 2 on purpose.`,
        "#",
        "# Exit 0 green · 1 red · 2 could not run. This one is 2 — *could not run* — because nobody has",
        "# said yet what green means for this workspace. Replace the body with the real check (your test",
        "# suite, your linter, whatever your team already trusts) and this becomes an ordinary recipe.",
        "#",
        "# Do not make it `exit 0` to quiet it. A recipe that passes without checking anything is a false",
        "# green under every gate that reads it, including the Stop-gate that blocks \"done\" on a red.",
        "set -uo pipefail",
        "",
        'echo "verify: this workspace has not declared what green means yet." >&2',
        'echo "        Edit ./verify/unset.sh — see ./verify/README.md." >&2',
        "exit 2",
        "",
    ].join("\n");
}

function verifyReadme(name) {
    return [
        `# Verify — ${name}`,
        "",
        "> What each recipe checks, what it deliberately does not, and the incident behind it. A recipe",
        "> whose limits are unwritten gets trusted for more than it covers.",
        "",
        "## The three exit codes, and why the third one exists",
        "",
        "`0` green · `1` red · `2` **could not run**. The third is the load-bearing one: a recipe that",
        "could not execute — a missing tool, an unreadable tree — must never look like one that ran and",
        "passed. Enumerating what you are about to check is a **precondition**, not part of the check, so",
        "an empty enumeration is exit 2 rather than a confident pass over nothing.",
        "",
        "## Recipes",
        "",
        "| id | what it checks | known limits |",
        "|---|---|---|",
        "| `unset` | **Nothing yet.** It exits 2 by design, until this team says what green means. | Everything. Replace it. |",
        "",
    ].join("\n");
}

function slotFile(title, name, gloss) {
    return [`# ${title} — ${name}`, "", `> ${gloss}`, "", "{Written by this team. A scaffold cannot know it, and a generated answer here would be", "the auto-generated curated context the constitution names as a non-goal.}", ""].join("\n");
}

function workspaceReadme(name, wkind, body) {
    return [
        `# Workspace — ${name}`,
        "",
        `A \`${wkind}\` workspace, scaffolded by \`portulan new workspace\`. **It is a draft: you curate it.**`,
        "",
        "## What it is, and is not, on the day it was written",
        "",
        "Three slots exist and each says what belongs in it rather than claiming content: `identity.md`,",
        "`principles.md`, `gate-map.md`. `doctor` is green on this workspace, and that green means the",
        "manifest conforms and every declared path resolves — **not** that anything in it is true about",
        "your team yet.",
        "",
        "**No gate policy compiles yet.** `gate-map.md` is prose; run `portulan new gate-policy gates`",
        "and add `\"gates\": \"gates.json\"` to the manifest to make it enforcement.",
        "",
        "**One verify recipe is declared and it exits 2** — *could not run*. The schema requires a",
        "`verify` block, and a recipe is what decides what *done* means here, so the choice was between an",
        "honest \"nobody has said yet\" and a stub exiting 0 that would put a false green under every gate",
        "from the day this was created. Replace `verify/unset.sh` with your real check.",
        "",
        "## The template this came from",
        "",
        "[`core/templates/workspace.md`](../../core/templates/workspace.md) carries the per-key rationale,",
        "including the two constraints a scaffold cannot enforce for you: a slot must be a whole file, and",
        "one repository is governed by exactly one workspace.",
        "",
        `<!-- skeleton bytes: ${body.length} -->`,
        "",
    ].join("\n");
}

export function run(argv, options = {}) {
    const say = options.say ?? ((line = "") => process.stdout.write(`${line}\n`));
    try {
        const parsed = parseArgs(argv);
        if (parsed.help || !parsed.kind) {
            say(usage());
            return parsed.help ? 0 : 2;
        }
        if (!KINDS.has(parsed.kind)) {
            say(`new: \`${parsed.kind}\` is not a kind this scaffolds. The six are: ${[...KINDS].sort().join(" · ")}`);
            return 2;
        }
        if (!parsed.name) {
            say(`new: \`${parsed.kind}\` needs a name — \`portulan new ${parsed.kind} <name>\``);
            return 2;
        }
        if (!SLUG.test(parsed.name)) {
            say(
                `new: \`${parsed.name}\` is not a slug. Names here are lowercase, digits and single hyphens ` +
                    `(\`my-skill\`), because the same shape is what both schemas' \`$defs/slug\` accepts and a name ` +
                    `that fails validation after it is written is a scaffold that reds its own workspace`,
            );
            return 2;
        }

        const into = path.resolve(parsed.into ?? process.cwd());

        // Refused before the template is even read: the destination is the question, and a `core/` answer
        // is refused whether it was reached by name, by `..`, or by a link.
        const linkAt = firstLink(into);
        if (linkAt) {
            say(
                `new: ${display(linkAt)} is a symlink, and this refuses to write through one. A resolved link is how a ` +
                    `scaffold leaves the tree it was meant to stay inside. Point \`--into\` at a real directory`,
            );
            return 2;
        }
        const core = intoCore(realOrSelf(into));
        if (core) {
            // Phrased against the RESOLVED destination rather than the argument as typed, because the two
            // differ in exactly the cases worth naming — `packs/../core` and a link — and a refusal that
            // echoes the argument back tells the reader nothing they did not already type.
            const resolved = realOrSelf(into);
            say(
                `new: that destination resolves to ${resolved === core ? `\`${core}\`` : `${resolved}, inside \`${core}\``}, ` +
                    `which is the \`core/\` layer this project ships. Your own skills, personas and packs belong in a layer you own — ` +
                    `a pack of your own, or your workspace — because core and packs never absorb a team's specifics ` +
                    `(the constitution's sixth thesis: storage follows ownership). Point \`--into\` somewhere you own`,
            );
            return 2;
        }

        const files = plan({ ...parsed, into });
        const clash = collisions(files.map((f) => f.path), into);
        if (clash.length) {
            for (const group of groupByCause(clash)) say(`new: ${group}`);
            return 2;
        }

        // The manifest is written LAST for the multi-file kinds, so an I/O failure mid-loop cannot leave a
        // torso that a later run reads as a finished artifact — session 1's partial write, which wedged
        // its own retry and refused it with a sentence that was false.
        const ordered = [...files].sort((a, b) => Number(manifestish(a.path)) - Number(manifestish(b.path)));
        for (const file of ordered) {
            fs.mkdirSync(path.dirname(file.path), { recursive: true });
            fs.writeFileSync(file.path, file.contents);
        }

        say(`new: wrote ${files.length} file(s) for the ${parsed.kind} \`${parsed.name}\``);
        for (const file of files) say(`  ${display(file.path)}`);
        say("");
        say(`It is a draft — the placeholders in \`{braces}\` are yours to fill. Then: portulan doctor <workspace-dir>`);
        // What a scaffold CANNOT do for you, said at the moment it matters rather than in a README nobody
        // opens next. This tool never edits a file it did not write — a manifest is a curated layer, and
        // a generator that rewrites one is the generator that eventually rewrites the wrong one — so the
        // wiring step is the author's, and leaving it unsaid would produce a file nothing reads.
        for (const line of wiring(parsed.kind, parsed.name, parsed.category, into)) say(line);
        return 0;
    } catch (error) {
        say(`new: ${error instanceof NewError ? error.message : `unanticipated failure — ${error.stack ?? error}`}`);
        return 2;
    }
}

const manifestish = (p) => /(?:workspace|pack)\.json$/.test(p);

/**
 * The step a scaffold cannot take for the author: declaring the thing it just wrote.
 *
 * Nothing here edits a manifest the tool did not write in the same run. That is deliberate and it is the
 * same rule `init` settled — a manifest is part of the curated layer, and a generator that edits one is
 * the generator that eventually edits the wrong one. The cost of that rule is a file nothing references,
 * so the cost is paid out loud, here, at the moment the file lands.
 */
function wiring(kind, name, category, target) {
    switch (kind) {
        case "gate-policy":
            return ["", `Nothing reads it yet: add \`"gates": "${name}.json"\` to the workspace's \`workspace.json\`, then \`portulan compile\`.`];
        case "skill": {
            // **Say only what was actually checked.** The previous version read whether a `pack.json`
            // EXISTED and then made a claim about what it DECLARES — which is the same defect one level
            // down: a pack declaring `contributes.skills: ["parts/"]` was told `skills/` is "already
            // declared", and a skill landing under a declared root was told nothing declares it. Found
            // by review, inside the fix for that exact class.
            let roots = null;
            try {
                roots = JSON.parse(fs.readFileSync(path.join(target ?? ".", "pack.json"), "utf8"))?.contributes?.skills ?? [];
            } catch {
                roots = null;
            }
            if (roots === null) {
                return ["", "No readable `pack.json` in that directory, so nothing declares this skill yet — put it inside a pack, or add a `contributes.skills` root to the pack that should ship it."];
            }
            if (roots.some((r) => String(r).replace(/\/+$/, "") === "skills")) {
                return ["", "The pack declares `skills/` in `contributes.skills`, which is where this landed — no manifest edit needed."];
            }
            return ["", `That pack declares ${roots.length} skills root(s) and none of them is \`skills/\`, so nothing declares this skill yet — add a root that covers it, or move the skill.`];
        }
        case "persona":
            return ["", `Nothing reads it yet: add \`"personas/${name}.md"\` to the pack manifest's \`contributes.personas\`.`];
        case "pack":
            return ["", `Nothing composes it yet: add \`"${category}/${name}"\` to an adopting workspace's \`packs\` array.`];
        case "repo-card":
            return ["", "It sits in the workspace's declared `repos` slot, so `doctor` will lint its claims against the tree on the next run."];
        default:
            return [];
    }
}

/**
 * The destination as the filesystem actually sees it, **including when it does not exist yet**.
 *
 * The first cut was `try { realpathSync(t) } catch { return path.resolve(t) }` — and the catch is not
 * the rare branch, it is the **ordinary** one: a scaffolding tool's destination usually does not exist.
 * So whenever the leaf was new, this returned an unresolved path and the `core/` check graded a string
 * the filesystem had never confirmed. Measured by the pre-commit checkpoint: a symlink whose target is
 * `core/`, plus a leaf one level below it, wrote into the shipped `core/` and exited 0. The file header
 * two hundred lines up promised "the check resolves first and compares after"; it did, only when the
 * destination already existed, which is the case that matters least.
 *
 * So: realpath the nearest **existing** ancestor and re-append the unresolved tail. That resolves every
 * link on the part of the path that exists — which is the only part a link can be on.
 */
function realOrSelf(target) {
    let head = path.resolve(target);
    const tail = [];
    for (let i = 0; i < 64; i += 1) {
        try {
            return tail.length ? path.join(fs.realpathSync(head), ...tail) : fs.realpathSync(head);
        } catch (cause) {
            // Only ENOENT means "not there yet, keep walking up". Anything else means the question could
            // not be answered, and an unanswerable question must not be answered "fine".
            if (cause.code !== "ENOENT") {
                throw new NewError(
                    `${display(head)} could not be resolved — ${cause.code ?? cause.message}. Refusing rather than grading a path nothing confirmed`,
                );
            }
            const up = path.dirname(head);
            if (up === head) return path.resolve(target);
            tail.unshift(path.basename(head));
            head = up;
        }
    }
    return path.resolve(target);
}

/**
 * Is the destination the user named itself a symlink?
 *
 * Only the named path is asked about here, not its ancestors — see `chain` for why that boundary is the
 * rule rather than a convenience. A user who points `--into` at a link is refused rather than followed,
 * because deciding whether a link's target is "really" where they meant is a containment judgement with
 * a bad failure mode, where refusing has none and costs one `realpath` of typing.
 */
function firstLink(target) {
    try {
        return fs.lstatSync(target).isSymbolicLink() ? target : null;
    } catch (cause) {
        // Only ENOENT means absent — a destination that does not exist yet is the ordinary case here.
        if (cause.code === "ENOENT") return null;
        throw new NewError(`${display(target)} could not be read — ${cause.code ?? cause.message}. Only a missing path means "nothing there", so nothing was written`);
    }
}

/**
 * One line per cause, not one per path. Session 1 learned this the hard way: a single symlinked
 * directory made the refusal name the same cause ten times, and a refusal nobody finishes reading is a
 * refusal that failed to explain.
 */
function groupByCause(clash) {
    const by = new Map();
    for (const item of clash) {
        const key = item.why === "unreadable" ? `unreadable (${item.detail})` : item.why;
        if (!by.has(key)) by.set(key, []);
        by.get(key).push(display(item.path));
    }
    const said = [];
    for (const [why, paths] of by) {
        if (why === "exists") {
            said.push(
                `${paths.length} file(s) already exist and nothing here overwrites a file you wrote: ${paths.join(", ")}. ` +
                    `Move or delete them and run again`,
            );
        } else if (why === "directory") {
            said.push(`${paths.join(", ")} ${paths.length === 1 ? "is a directory" : "are directories"} where a file has to be written. Move or remove ${paths.length === 1 ? "it" : "them"} and run again`);
        } else if (why === "symlink") {
            said.push(`${paths.join(", ")} ${paths.length === 1 ? "is a symlink" : "are symlinks"} — refused rather than followed, because a resolved link is how a write leaves its tree`);
        } else {
            said.push(`${paths.join(", ")} could not be read — ${why}. Only a missing path means "nothing there"; this question went unanswered, so nothing was written`);
        }
    }
    return said;
}

if (import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1] ?? ".")).href) {
    process.exitCode = run(process.argv.slice(2));
}
