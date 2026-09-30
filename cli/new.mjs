#!/usr/bin/env node
// `portulan new`: scaffold a skill, persona, pack, workspace, gate policy or repo card, never into `core/`.
//
// Exit 0 wrote · 2 could not run; never 1, since it renders no verdict on a workspace.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.resolve(HERE, "..", "core");

export class NewError extends Error {}

export const KINDS = new Set(["skill", "persona", "pack", "workspace", "gate-policy", "repo-card"]);

/** `$defs/slug`, as both schemas hold it. */
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const JSON_KINDS = new Set(["pack", "workspace", "gate-policy"]);

export function template(kind) {
    return path.join(CORE, "templates", `${kind}.md`);
}

/** After the first `---`, not the last: the skill template's skeleton opens with frontmatter of its own. */
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

export function collisions(paths, root = null) {
    const found = [];
    for (const target of paths) {
        for (const step of chain(target, root)) {
            let stat;
            try {
                stat = fs.lstatSync(step);
            } catch (cause) {
                if (cause.code === "ENOENT") continue;
                found.push({ path: step, why: "unreadable", detail: cause.code ?? cause.message });
                break;
            }
            if (stat.isSymbolicLink()) {
                found.push({ path: step, why: "symlink" });
                break;
            }
            if (step === target) {
                if (stat.isDirectory()) found.push({ path: step, why: "directory" });
                else found.push({ path: step, why: "exists" });
            }
        }
    }
    return found;
}

/** `root` down to `target`, both included; links above `root` are the user's own, as macOS `/var` is. */
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

function display(target) {
    const rel = path.relative(process.cwd(), target);
    return rel && !rel.startsWith("..") && rel.length < target.length ? rel : target;
}

export function intoCore(resolved) {
    // Case-folded: a volume may ignore case and `realpathSync` keeps it, so a genuine `CORE/` is refused too.
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

/** Every file a kind writes, planned whole so the collision check sees each path before the first byte. */
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

function workspaceFiles(root, name, wkind, body, governedBy = null) {
    if (wkind === "pointer") {
        // 2.7 added the pointer kind; a writer declares the version its output needs, not the newest.
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
        // The version this output needs, not the newest.
        portulan: { spec: "2.7" },
        name,
        summary: `{One line: whose workspace this is and what it governs.}`,
        kind: wkind,
        slots: { identity: "identity.md", principles: "principles.md", gates: "gate-map.md", repos: "repos/" },
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

        // The manifest last, so a failure mid-loop leaves nothing a later run reads as finished.
        const ordered = [...files].sort((a, b) => Number(manifestish(a.path)) - Number(manifestish(b.path)));
        for (const file of ordered) {
            fs.mkdirSync(path.dirname(file.path), { recursive: true });
            fs.writeFileSync(file.path, file.contents);
        }

        say(`new: wrote ${files.length} file(s) for the ${parsed.kind} \`${parsed.name}\``);
        for (const file of files) say(`  ${display(file.path)}`);
        say("");
        say(`It is a draft — the placeholders in \`{braces}\` are yours to fill. Then: portulan doctor <workspace-dir>`);
        for (const line of wiring(parsed.kind, parsed.name, parsed.category, into)) say(line);
        return 0;
    } catch (error) {
        say(`new: ${error instanceof NewError ? error.message : `unanticipated failure — ${error.stack ?? error}`}`);
        return 2;
    }
}

const manifestish = (p) => /(?:workspace|pack)\.json$/.test(p);

/** Said rather than done: nothing here edits a manifest it did not write in the same run. */
function wiring(kind, name, category, target) {
    switch (kind) {
        case "gate-policy":
            return ["", `Nothing reads it yet: add \`"gates": "${name}.json"\` to the workspace's \`workspace.json\`, then \`portulan compile\`.`];
        case "skill": {
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

/** The realpath of the nearest existing ancestor, with the part not created yet appended. */
function realOrSelf(target) {
    let head = path.resolve(target);
    const tail = [];
    for (let i = 0; i < 64; i += 1) {
        try {
            return tail.length ? path.join(fs.realpathSync(head), ...tail) : fs.realpathSync(head);
        } catch (cause) {
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

function firstLink(target) {
    try {
        return fs.lstatSync(target).isSymbolicLink() ? target : null;
    } catch (cause) {
        if (cause.code === "ENOENT") return null;
        throw new NewError(`${display(target)} could not be read — ${cause.code ?? cause.message}. Only a missing path means "nothing there", so nothing was written`);
    }
}

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
