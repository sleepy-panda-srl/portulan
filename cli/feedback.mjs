#!/usr/bin/env node
// `portulan feedback` — file an issue from a report you previewed, seam-scanned before it leaves the
// machine, under the Gated tier. Milestone 7's inbound half; proposal
// `../.portulan/proposals/0014-a-feedback-pipe-points-out-of-the-seam.md` is the design.
//
// ## The sentence the whole file follows from
//
// **A feedback sender is a pipe from a private workspace into a record it does not control.** An issue
// tracker's history is permanent and its visibility is the *repository's* to change — this one was
// public from 2026-07-27 to 2026-08-03 and is private again today, which is exactly why "it is public"
// is the wrong thing to reason from: what a sender may safely include cannot depend on a setting
// somebody else can flip back. The workspace it sends *from* may be a company's — repo names, paths,
// product identifiers, gate maps, memory. `docs/plan.md` → Protocol → The seam exists because this
// project treats that leakage as unacceptable in the other direction, and this tool points at the same
// wall pointing out.
//
// Two consequences, and they are the two things that would be hard to add later:
//
// 1. **The payload is assembled from a closed list**, never filtered after the fact. Nothing here reads
//    the workspace's name, its repo cards, its gate map, its memory, a git remote, a branch, or any
//    path. The one thing it reads out of the workspace is `portulan.spec`, a version number. A filter
//    is a list of what to remove and is wrong the day something new arrives; a closed list is a list of
//    what to include and is wrong only when somebody widens it on purpose.
// 2. **This product never carries seam terms.** They are client-confidential by definition. The tool is
//    *told where a list is* and reads it; it ships none, and a term list has no place in this
//    repository.
//
// ## Gated means per action, and the refusal lives in the tool
//
// `send` without `--approve` prints the payload and exits 2. The approval cannot be inherited from an
// earlier `draft` or `preview`, because `core/operating/autonomy.md`'s Gated tier is per action — and a
// queue that flushes itself when the network returns is a silent send with extra steps, which is why
// nothing here auto-sends, retries in the background, or treats an unsent draft as anything but a file.
//
// The refusal is **in the tool** rather than in a host's permission table on purpose. A `Bash(...)`
// matcher in `.portulan/gates.json` would cover one spelling of at least three (`portulan feedback
// send`, `npx portulan feedback send`, `node cli/feedback.mjs send`) and would suggest coverage it does
// not have. A refusal the tool itself makes holds on every host, including the hosts with no hook
// system at all — which is the platform-floor direction this project prefers everywhere else.
//
// ## Exit codes
//
// `0` the verb succeeded · `1` **a verdict was rendered and it was no** — today that is exactly one
// thing, a seam hit · `2` could not run: a report that is not ready, an approval that was not given, a
// term list that was named and could not be read, a missing `gh`. The split matters at the one place it
// is easy to get wrong: an unreadable term list is **not** a clean scan, and a report missing a required
// answer is not a judgement about anybody's workspace.
//
// ## What is deliberately not here
//
// No OAuth device flow — the user's existing `gh` login and nothing else. No relay: proposal `0014`'s
// Q5(b) is a hosted service and `docs/vision.md` permits exactly one by name, so it is constitutional
// and unbuilt. No telemetry, no crash reporter, no attachments, no screenshots, no log bundles — every
// one is an unbounded channel through the wall this file is about. And **no labels**: `0014` rules that
// the repository owns its own labels, so the form's title prefix is what marks the kind.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// `manifest.mjs` and not `portulan.mjs`: importing the entry point from a subcommand it dispatches to
// is a cycle, and it hung `portulan feedback --help` at exit 13. The header there is the record.
import { VERSION, REPOSITORY } from "./manifest.mjs";

export class FeedbackError extends Error {}

/**
 * The window a second send has to clear. Proposal `0014` asks for "a short cooldown [to catch] a loop"
 * beside the re-send no-op: the no-op stops the same report going twice, and this stops a script
 * filing twenty different ones. Short enough that a person filing two real reports in a sitting waits
 * once and understands why.
 */
export const COOLDOWN_SECONDS = 60;

// ===========================================================================================
// The forms
// ===========================================================================================
//
// THE ONE CARRIER, and it is a carrier because the alternative does not exist. The forms live at
// `.github/ISSUE_TEMPLATE/*.yml` and `package.json`'s `files` does not ship them, so a published
// package cannot read them; parsing YAML would need a dependency this CLI is ruled not to have, and
// generating this map would need a build step it is ruled not to have either. So the map is written
// here and `feedback.live.test.mjs` reads the real forms and fails when the two disagree — `0020`'s
// repair where a single carrier is impossible: one carrier plus a rail on the pair.
//
// `filled` marks a section this tool answers rather than the user: `version` is the Portulan version,
// `environment` is the structured block. A fact claimed by a `filled` section is left out of the
// environment block, so a payload never states the same thing twice.
export const FORMS = [
    {
        kind: "bug",
        file: "bug.yml",
        titlePrefix: "[bug] ",
        acknowledgementsLabel: "Before you file",
        sections: [
            { id: "what", label: "What happened", required: true },
            { id: "expected", label: "What you expected, and where Portulan says so", required: true },
            { id: "reproduce", label: "How to reproduce", required: false, render: "shell" },
            { id: "version", label: "Version or commit", required: false, filled: "version" },
            { id: "environment", label: "Environment", required: false, filled: "environment" },
        ],
        acknowledgements: [
            { text: "I searched existing issues and this is not already reported.", required: true },
            {
                text:
                    "I understand that Portulan does not accept outside pull requests, and that this report is " +
                    "the contribution — not a lesser path to one.",
                required: true,
            },
        ],
    },
    {
        kind: "improvement",
        file: "improvement.yml",
        titlePrefix: "[improvement] ",
        acknowledgementsLabel: "Before you file",
        sections: [
            { id: "problem", label: "The problem", required: true },
            { id: "proposal", label: "What you propose", required: true },
            { id: "enforcement", label: "How it would earn its place", required: true },
            { id: "cost", label: "What it costs, and what it would break", required: false },
            {
                id: "area",
                label: "Which part of Portulan",
                required: true,
                options: [
                    "doctrine — core/: the loop, autonomy, verification, memory, evolution, safety",
                    "mechanism — cli/, spec/, the plugin: the code that checks and enforces",
                    "workspace — .portulan/: the policy layer and the gate map",
                    "packaging — the plugin, the marketplace, install and boot",
                    "documentation — README, the plan, the examples",
                    "not sure",
                ],
            },
            { id: "environment", label: "Environment", required: false, filled: "environment" },
        ],
        acknowledgements: [
            { text: "I searched existing issues and proposals, and this is not already open.", required: true },
            { text: "I have read `docs/vision.md` and this does not contradict a stated non-goal.", required: false },
        ],
    },
    {
        kind: "feedback",
        file: "feedback.yml",
        titlePrefix: "[feedback] ",
        acknowledgementsLabel: "Before you file",
        sections: [
            {
                id: "kind",
                label: "What kind of feedback",
                required: true,
                options: [
                    "Something was confusing or hard to follow",
                    "Something did not survive contact with my repository",
                    "I expected to find something and did not",
                    "A disagreement with a decision or a non-goal",
                    "Something worked well and is worth keeping",
                    "Other",
                ],
            },
            { id: "feedback", label: "The feedback", required: true },
            { id: "context", label: "What you were trying to do", required: false },
            { id: "environment", label: "Environment", required: false, filled: "environment" },
        ],
        acknowledgements: [
            {
                text:
                    "I understand this is a public issue and I have not included anything confidential — my own, " +
                    "my employer's, or anyone else's.",
                required: true,
            },
        ],
    },
];

export function form(kind) {
    return FORMS.find((entry) => entry.kind === kind) ?? null;
}

/** The repository issues are filed into — `manifest.mjs` derives it from the `bugs.url` we publish. */
export function defaultRepository() {
    return REPOSITORY;
}

// ===========================================================================================
// The report file
// ===========================================================================================

/**
 * A filename slug, and it returns "" rather than inventing one. A title of punctuation has no name in
 * it, and a report called `2026-08-10-.md` is a file nobody can find again.
 */
export function slug(title) {
    return String(title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/** The scaffolded report — a file the user edits, which is the whole point of the file-first design. */
export function scaffold(kind, { title, created, failedRecipe, failedExit } = {}) {
    const declared = form(kind);
    if (!declared) throw new FeedbackError(`\`${kind}\` is not a form. The three are: ${FORMS.map((f) => f.kind).join(" · ")}`);

    const front = ["---", `kind: ${kind}`, `title: ${title}`, `created: ${created}`];
    if (failedRecipe !== undefined) front.push(`failed-recipe: ${failedRecipe}`);
    if (failedExit !== undefined) front.push(`failed-exit: ${failedExit}`);
    front.push("---");

    const parts = [
        front.join("\n"),
        "<!-- Fill the sections below, tick the acknowledgements, then:\n" +
            "       portulan feedback preview <this file>\n" +
            "       portulan feedback send <this file> --approve\n" +
            "     Everything inside an HTML comment is stripped before anything is sent. -->",
    ];

    for (const section of declared.sections) {
        if (section.filled) continue; // this tool answers it; a user editing it would be edited over
        parts.push(`### ${section.label}`);
        const guidance = section.options
            ? "<!-- Keep exactly ONE of the lines below and delete the rest. -->\n" + section.options.join("\n")
            : `<!-- ${section.required ? "Required." : "Optional — leave it empty and it files as _No response_."} -->`;
        parts.push(guidance);
    }

    parts.push(`### ${declared.acknowledgementsLabel}`);
    parts.push(declared.acknowledgements.map((ack) => `- [ ] ${ack.text}`).join("\n"));

    return `${parts.join("\n\n")}\n`;
}

/**
 * Read a report back. Frontmatter through `plugin-lint.mjs`'s reader would drag a 74 KB module in for
 * four `key: value` lines, so this reads the block directly — and the block it reads is the block this
 * file wrote, which is the case that makes a local reader honest rather than lazy.
 *
 * @returns {{fields: Record<string,string>, sections: Array<{label: string, text: string}>,
 *            acknowledgements: Array<{text: string, ticked: boolean}>}}
 */
export function parseReport(text) {
    const lines = text.split(/\r?\n/);
    if (lines[0]?.trim() !== "---") throw new FeedbackError("the report has no frontmatter block");
    const close = lines.indexOf("---", 1);
    if (close === -1) throw new FeedbackError("the report's frontmatter block is never closed");

    const fields = {};
    for (const line of lines.slice(1, close)) {
        const match = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
        if (match) fields[match[1]] = match[2].trim();
    }

    const declared = form(fields.kind);
    if (!declared) {
        throw new FeedbackError(
            `the report's \`kind\` is \`${fields.kind ?? "(absent)"}\`, which is not a form. The three are: ` +
                FORMS.map((f) => f.kind).join(" · "),
        );
    }

    const sections = [];
    const acknowledgements = [];
    let current = null;
    for (const line of lines.slice(close + 1)) {
        const heading = /^###\s+(.*)$/.exec(line);
        if (heading) {
            current = { label: heading[1].trim(), lines: [] };
            if (current.label === declared.acknowledgementsLabel) current.acks = true;
            else sections.push(current);
            continue;
        }
        if (!current) continue;
        if (current.acks) {
            const box = /^-\s+\[([ xX])\]\s+(.*)$/.exec(line);
            if (box) acknowledgements.push({ text: box[2].trim(), ticked: box[1] !== " " });
            continue;
        }
        current.lines.push(line);
    }

    for (const section of sections) {
        section.text = stripComments(section.lines.join("\n")).trim();
        delete section.lines;
    }
    return { fields, sections, acknowledgements };
}

/** HTML comments carry this tool's guidance to the author; none of it belongs in a public issue. */
function stripComments(text) {
    return text.replace(/<!--[\s\S]*?-->/g, "");
}

// ===========================================================================================
// The payload
// ===========================================================================================

/**
 * The bytes that would be filed. `preview` and `send` both call this, which is *why* the demonstration
 * holds: the previewed body is not compared with the sent body, it **is** the sent body. Two renderers
 * that agree today are two carriers of one fact.
 *
 * `parts` is the same content split by section, so the seam scan runs over exactly what would leave the
 * machine rather than over a reconstruction of it.
 *
 * @returns {{repo: string|null, title: string, body: string, parts: Array<{label: string, text: string}>}}
 */
export function payload(report, context = {}) {
    const declared = form(report.fields.kind);
    if (!declared) throw new FeedbackError(`\`${report.fields.kind}\` is not a form`);

    const title = `${declared.titlePrefix}${report.fields.title ?? ""}`;
    const claimed = new Set(declared.sections.filter((s) => s.filled).map((s) => s.filled));
    const parts = [{ label: "the title", text: title }];

    for (const section of declared.sections) {
        let value;
        if (section.filled === "version") value = VERSION;
        else if (section.filled === "environment") value = environmentBlock(report, context, claimed);
        else value = report.sections.find((s) => s.label === section.label)?.text ?? "";

        if (value && section.render === "shell") value = `\`\`\`shell\n${value}\n\`\`\``;
        parts.push({ label: section.label, text: value || "_No response_" });
    }

    const ticks = declared.acknowledgements
        .map((ack) => {
            const said = report.acknowledgements.find((a) => a.text === ack.text);
            return `- [${said?.ticked ? "X" : " "}] ${ack.text}`;
        })
        .join("\n");
    parts.push({ label: declared.acknowledgementsLabel, text: ticks });

    const body = parts
        .filter((part) => part.label !== "the title")
        .map((part) => `### ${part.label}\n\n${part.text}`)
        .join("\n\n");

    return { repo: context.repo ?? defaultRepository(), title, body, parts };
}

/**
 * Proposal `0014`'s second part: "Portulan version, spec version, host and version, OS and
 * architecture. If the report was started from a failure, the failing recipe's **id and exit code**."
 * Not the recipe's *output*, which carries paths and file contents.
 *
 * `claimed` holds what another field on this form already asks for, so nothing is said twice.
 */
function environmentBlock(report, context, claimed = new Set()) {
    const facts = context.facts ?? {};
    const lines = [];
    if (!claimed.has("version")) lines.push(`Portulan: ${VERSION}`);
    lines.push(`Workspace Definition: ${context.spec ?? "unknown"}`);
    lines.push(
        `Host: ${context.host ?? "not observable from the command line — re-run with --host to name it"}`,
    );
    lines.push(`Runtime: node ${facts.node ?? process.version}`);
    // Every fact defaults to the real machine. `?? ""` on the release was a real defect and it was
    // invisible in the suite, which injects all four: the shipped tool printed `System: darwin arm64`
    // — a line silently one fact short of what this block says it carries. Caught by running the
    // demonstration rather than by reading the code, which is where this class keeps being caught.
    lines.push(`System: ${facts.platform ?? process.platform} ${facts.release ?? os.release()} ${facts.arch ?? process.arch}`);
    if (report.fields["failed-recipe"]) {
        lines.push(`Failing recipe: ${report.fields["failed-recipe"]}, exit ${report.fields["failed-exit"] ?? "unrecorded"}`);
    }
    return lines.join("\n");
}

// ===========================================================================================
// The seam
// ===========================================================================================

/**
 * Find the term list, and be exact about which of the three locations answered — a scan whose source a
 * reader cannot name is a scan they cannot check.
 *
 * **Only `ENOENT` means absent, and only at the convention path.** `existsSync` answers false for
 * `EACCES`, which is how #166's layer at mode `0400` skipped every location it declared while reporting
 * green. A named list that cannot be read is could-not-run, always.
 *
 * @returns {{source: string|null, terms: string[]|null}} `source: null` means no list is configured.
 */
export function locateTerms({ flag, env = {}, workspaceDir } = {}) {
    if (flag) return { source: `--seam-terms ${flag}`, terms: read(flag, `--seam-terms ${flag}`) };

    const named = env.PORTULAN_SEAM_TERMS;
    if (named) return { source: `PORTULAN_SEAM_TERMS (${named})`, terms: read(named, `PORTULAN_SEAM_TERMS (${named})`) };

    if (!workspaceDir) return { source: null, terms: null };
    const at = path.join(workspaceDir, "seam-terms.txt");
    try {
        return { source: at, terms: parseTerms(fs.readFileSync(at, "utf8")) };
    } catch (error) {
        if (error.code === "ENOENT") return { source: null, terms: null };
        throw new FeedbackError(`the term list at ${at} could not be read — ${error.code ?? error.message}`);
    }

    function read(at, described) {
        try {
            return parseTerms(fs.readFileSync(at, "utf8"));
        } catch (error) {
            throw new FeedbackError(`the term list named by ${described} could not be read — ${error.code ?? error.message}`);
        }
    }
}

function parseTerms(text) {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => line.toLowerCase());
}

/**
 * The digest of a payload, and the reason `preview` is not optional.
 *
 * Row 7's demonstration is *"a send whose exact payload the user saw first"*, and for one draft of this
 * tool that was a property of the **flow** rather than of the mechanism: `send --approve` on a report
 * nobody had previewed filed sight-unseen, and a report edited between the preview and the send filed
 * bytes that differed from the ones that were read. Both printed the payload in the same breath, which
 * is not the same as having been seen — nobody is reading a terminal between two lines of one command.
 *
 * So `preview` stamps this digest into the report and `send` refuses unless it matches. The approval is
 * then bound to bytes rather than to an intention, and *the user saw it first* is structural. It covers
 * the machine facts too, since they are in the payload: preview with `--host X` and send without, and
 * the digest differs, because the bytes do.
 *
 * **Only `preview` stamps.** A `send` that refused for want of approval also printed the payload, and
 * stamping there would let a refusal manufacture the approval-eligibility it just declined to grant.
 */
export function digest(built) {
    return crypto.createHash("sha256").update(`${built.title}\n${built.body}`, "utf8").digest("hex");
}

/**
 * Case-insensitive substring, over the payload's own parts. Substring rather than word-boundary
 * because the terms that matter here are names and identifiers that turn up glued to other text —
 * a host, a path fragment, a ticket prefix — and a scan that missed those would be the reassuring kind.
 *
 * The hit names the term and the section and never quotes the surrounding text: this output goes to a
 * terminal and often to a log, and echoing the context would leak the thing the scan just caught.
 */
export function scan(parts, terms) {
    const hits = [];
    for (const part of parts) {
        const haystack = String(part.text).toLowerCase();
        for (const term of terms) {
            if (haystack.includes(term)) hits.push({ term, section: part.label });
        }
    }
    return hits;
}

// ===========================================================================================
// The verbs
// ===========================================================================================

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function usage() {
    return [
        "portulan feedback — file an issue from a report you previewed",
        "",
        "  portulan feedback draft <kind> --title <text> [--into <workspace-dir>]",
        "                              [--failed-recipe <id> --failed-exit <n>]",
        "  portulan feedback preview <report> [--seam-terms <file>] [--host <name>]",
        "  portulan feedback send <report> --approve [--seam-terms <file>] [--host <name>] [--repo <owner/name>]",
        "",
        `  kinds: ${FORMS.map((f) => f.kind).join(" · ")}`,
        "",
        "The report is a file before it is a request: `draft` writes one into the workspace's",
        "`feedback/` directory, you edit it, `preview` shows the exact bytes, and `send` files them",
        "through your own `gh` login. Approval is per send and is never inherited — and `send` refuses",
        "any report whose payload does not match the one `preview` last showed you, so the bytes you",
        "approved are the bytes that leave.",
        "",
        "The seam term list is yours and this tool ships none. It is looked for at --seam-terms, then",
        "$PORTULAN_SEAM_TERMS, then <workspace-dir>/seam-terms.txt. A hit refuses the send (exit 1); a",
        "list that is named and unreadable refuses it too (exit 2); no list at all is reported in the",
        "preview rather than passed over in silence.",
        "",
        "Exit codes: 0 succeeded · 1 the scan refused it · 2 could not run.",
    ].join("\n");
}

export function parseArgs(argv) {
    const parsed = { rest: [], flags: {} };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--help" || arg === "-h") parsed.flags.help = true;
        else if (arg === "--approve") parsed.flags.approve = true;
        else if (arg.startsWith("--")) {
            const key = arg.slice(2);
            const value = argv[i + 1];
            if (value === undefined || value.startsWith("--")) throw new FeedbackError(`\`--${key}\` needs a value`);
            parsed.flags[key] = value;
            i += 1;
        } else parsed.rest.push(arg);
    }
    return parsed;
}

export function run(argv, options = {}) {
    const say = options.say ?? ((line = "") => process.stdout.write(`${line}\n`));
    const warn = options.warn ?? ((line = "") => process.stderr.write(`${line}\n`));
    const now = options.now ?? (() => new Date());
    const env = options.env ?? process.env;
    const exec =
        options.exec ??
        ((cmd, args, spawn = {}) => {
            const result = spawnSync(cmd, args, { input: spawn.input, encoding: "utf8" });
            return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error };
        });

    try {
        const parsed = parseArgs(argv);
        const [verb, ...rest] = parsed.rest;
        if (parsed.flags.help) {
            say(usage());
            return 0;
        }
        if (!verb) {
            warn("feedback: no verb. Run `portulan feedback --help`.");
            return 2;
        }

        if (verb === "draft") return draft(rest, parsed.flags, { say, warn, now });
        if (verb === "preview" || verb === "send") {
            return report(verb, rest, parsed.flags, { say, warn, now, env, exec, facts: options.facts });
        }

        warn(`feedback: \`${verb}\` is not a verb. The three are: draft · preview · send.`);
        return 2;
    } catch (error) {
        warn(`feedback: ${error instanceof FeedbackError ? error.message : `unanticipated failure — ${error.stack ?? error}`}`);
        return 2;
    }
}

function draft(rest, flags, { say, warn, now }) {
    const [kind] = rest;
    if (!kind) {
        warn(`feedback: draft needs a kind. The three are: ${FORMS.map((f) => f.kind).join(" · ")}`);
        return 2;
    }
    if (!form(kind)) {
        warn(`feedback: \`${kind}\` is not a form. The three are: ${FORMS.map((f) => f.kind).join(" · ")}`);
        return 2;
    }
    const title = flags.title;
    if (!title) {
        warn("feedback: draft needs a --title. It becomes the issue's title and the report's filename.");
        return 2;
    }
    const name = slug(title);
    if (!name) {
        warn(`feedback: \`${title}\` yields no slug — a title needs letters or digits, since it names the file too.`);
        return 2;
    }

    // The failure pair is validated at the door rather than on the way out. A recipe id that is not a
    // slug, or an exit code that is not an integer, means somebody is passing something other than the
    // two facts `0014` allows — and this is the one place a report picks up anything it was not typed.
    const failedRecipe = flags["failed-recipe"];
    const failedExit = flags["failed-exit"];
    if (failedRecipe !== undefined && !SLUG.test(failedRecipe)) {
        warn(`feedback: \`${failedRecipe}\` is not a recipe id. Ids here are lowercase, digits and single hyphens.`);
        return 2;
    }
    if (failedExit !== undefined && !/^-?\d+$/.test(failedExit)) {
        warn(`feedback: \`${failedExit}\` is not an exit code. Only the recipe's id and its integer code travel — never its output.`);
        return 2;
    }
    if ((failedRecipe === undefined) !== (failedExit === undefined)) {
        warn("feedback: --failed-recipe and --failed-exit are one fact and travel together.");
        return 2;
    }

    const workspaceDir = path.resolve(flags.into ?? ".portulan");
    if (!fs.existsSync(path.join(workspaceDir, "workspace.json"))) {
        warn(`feedback: ${workspaceDir} does not look like a workspace — no workspace.json. Point --into at one.`);
        return 2;
    }

    const created = now().toISOString().slice(0, 10);
    const at = path.join(workspaceDir, "feedback", `${created}-${name}.md`);
    if (fs.existsSync(at)) {
        warn(`feedback: ${at} already exists. A report is a file you edit — open that one, or pick another title.`);
        return 2;
    }

    fs.mkdirSync(path.dirname(at), { recursive: true });
    fs.writeFileSync(at, scaffold(kind, { title, created, failedRecipe, failedExit }));

    say(`feedback: wrote ${at}`);
    say("");
    say("Edit it, tick the acknowledgements, then:");
    say(`  portulan feedback preview ${at}`);
    say(`  portulan feedback send ${at} --approve`);
    return 0;
}

function report(verb, rest, flags, { say, warn, now, env, exec, facts }) {
    const [target] = rest;
    if (!target) {
        warn(`feedback: ${verb} needs a report file — the one \`draft\` wrote.`);
        return 2;
    }
    const at = path.resolve(target);
    let text;
    try {
        text = fs.readFileSync(at, "utf8");
    } catch (error) {
        warn(`feedback: ${at} could not be read — ${error.code ?? error.message}`);
        return 2;
    }

    const parsed = parseReport(text);

    // Already filed. Refused before anything else, because the answer is the same whatever the rest of
    // the report says and because a duplicate is the failure a user notices in public.
    if (parsed.fields.issue) {
        warn(`feedback: this report was already filed — ${parsed.fields.issue}. Draft a new one to say something new.`);
        return 2;
    }

    const workspaceDir = path.dirname(path.dirname(at));
    const context = {
        spec: readSpec(workspaceDir),
        host: flags.host,
        repo: flags.repo ?? defaultRepository(),
        facts,
    };

    const declared = form(parsed.fields.kind);
    const problems = validate(parsed, declared);
    if (problems.length) {
        for (const problem of problems) warn(`feedback: ${problem}`);
        return 2;
    }

    const built = payload(parsed, context);
    if (!built.repo) {
        warn("feedback: no repository to file into — package.json carries no `bugs.url`. Pass --repo <owner/name>.");
        return 2;
    }

    const found = locateTerms({ flag: flags["seam-terms"], env, workspaceDir });
    let coverage;
    if (found.terms === null) {
        coverage =
            "seam: no term list configured — NOTHING WAS SCANNED. Looked at --seam-terms, " +
            "$PORTULAN_SEAM_TERMS, and " + path.join(workspaceDir, "seam-terms.txt") + ".";
    } else {
        const hits = scan(built.parts, found.terms);
        if (hits.length) {
            warn(`feedback: the seam scan refused this send — ${found.source}`);
            for (const hit of hits) warn(`feedback:   \`${hit.term}\` appears in ${hit.section}`);
            warn("feedback: nothing was sent. Edit the report and run it again.");
            return 1;
        }
        coverage = `seam: clean against ${found.terms.length} term(s) from ${found.source}.`;
    }

    say(`portulan feedback — the payload, exactly as it would be filed`);
    say(`repository: ${built.repo}`);
    say(`title: ${built.title}`);
    say("labels: none — the repository owns its own labels (proposal 0014); the title prefix marks the kind");
    say(`--- body (${Buffer.byteLength(built.body, "utf8")} bytes) ---`);
    say(built.body);
    say("--- end of body ---");
    say(coverage);

    const seen = digest(built);
    if (verb === "preview") {
        fs.writeFileSync(at, stamp(text, { previewed: seen }, ["previewed"]));
        say(`previewed: ${seen}`);
        return 0;
    }

    if (!flags.approve) {
        say("");
        warn("feedback: nothing was sent. Sending is Gated — per action, never inherited from a draft or a preview.");
        warn(`feedback: re-run with --approve when the bytes above are the bytes you mean to publish.`);
        return 2;
    }

    // The approval is bound to bytes, not to an intention. See `digest` for why this is a refusal
    // rather than a warning: without it, "the exact payload the user saw first" is a habit.
    if (!parsed.fields.previewed) {
        warn("feedback: this report has not been previewed, so there are no bytes you have approved.");
        warn(`feedback: run \`portulan feedback preview ${at}\` and read them, then send.`);
        return 2;
    }
    if (parsed.fields.previewed !== seen) {
        warn("feedback: the payload has changed since it was previewed — the report, or a fact about this machine.");
        warn(`feedback:   previewed ${parsed.fields.previewed}`);
        warn(`feedback:   now       ${seen}`);
        warn("feedback: nothing was sent. Preview again and read what changed.");
        return 2;
    }

    const recent = lastSend(workspaceDir, at);
    if (recent && (now().getTime() - recent.at) / 1000 < COOLDOWN_SECONDS) {
        warn(
            `feedback: a report was filed from this directory ${Math.round((now().getTime() - recent.at) / 1000)}s ago ` +
                `(${recent.issue}). Wait out the ${COOLDOWN_SECONDS}s cooldown — it catches a loop, not a person.`,
        );
        return 2;
    }

    const auth = exec("gh", ["auth", "status"]);
    if (auth.error || auth.status === null) {
        warn("feedback: `gh` was not found. This sender files under your own GitHub identity and operates no service of its own.");
        warn(`feedback: install it, or file this by hand: gh issue create --repo ${built.repo} --title '${built.title}' --body-file ${at}`);
        return 2;
    }
    if (auth.status !== 0) {
        warn("feedback: `gh` is installed but not logged in. Run `gh auth login`, then run this again.");
        return 2;
    }

    const created = exec("gh", ["issue", "create", "--repo", built.repo, "--title", built.title, "--body-file", "-"], {
        input: built.body,
    });
    if (created.error || created.status !== 0) {
        warn(`feedback: \`gh issue create\` failed — ${(created.stderr || created.error?.message || "").trim() || `exit ${created.status}`}`);
        warn(`feedback: nothing was recorded. The report is still at ${at}.`);
        return 2;
    }

    const url = (created.stdout.match(/https:\/\/\S+/g) ?? []).pop();
    if (!url) {
        warn("feedback: `gh` succeeded and printed no issue URL — refusing to record a send this cannot name.");
        return 2;
    }

    fs.writeFileSync(at, stamp(text, { issue: url, sent: now().toISOString() }));
    say("");
    say(`feedback: filed ${url}`);
    say(`feedback: recorded in ${at} — a second send of this report is refused.`);
    return 0;
}

/** Every reason this report is not ready, in one pass — a user fixing one at a time is a user we lost. */
function validate(parsed, declared) {
    const problems = [];
    // `draft` refuses an absent or unsluggable title, but a report is a file a human edits and the
    // frontmatter is part of it. Without this, a blanked `title:` files as a bare `[feedback] ` — a
    // public issue with no subject, from the one verb where the artifact is permanent.
    if (!(parsed.fields.title ?? "").trim()) {
        problems.push("`title:` is empty, and the issue's title is the form's prefix plus that line.");
    }
    for (const section of declared.sections) {
        if (section.filled) continue;
        const text = parsed.sections.find((s) => s.label === section.label)?.text ?? "";
        if (section.options) {
            const chosen = text.split("\n").map((line) => line.trim()).filter(Boolean);
            if (chosen.length !== 1 || !section.options.includes(chosen[0])) {
                problems.push(
                    `\`${section.label}\` must hold exactly one of these lines and nothing else:\n` +
                        section.options.map((option) => `           ${option}`).join("\n"),
                );
            }
            continue;
        }
        if (section.required && !text) problems.push(`\`${section.label}\` is required and is empty.`);
    }
    for (const ack of declared.acknowledgements) {
        if (!ack.required) continue;
        const said = parsed.acknowledgements.find((a) => a.text === ack.text);
        if (!said) problems.push(`the acknowledgement "${ack.text}" is missing from the report.`);
        else if (!said.ticked) problems.push(`the acknowledgement "${ack.text}" is not ticked.`);
    }
    return problems;
}

/**
 * The workspace's spec version, and the ONE thing this tool reads out of a workspace. Soft rather than
 * fail-closed on purpose: it is a line in an environment block, not a gate, and refusing to send a
 * report because a manifest was unreadable would put the seam's discipline behind a decoration.
 */
function readSpec(workspaceDir) {
    try {
        return JSON.parse(fs.readFileSync(path.join(workspaceDir, "workspace.json"), "utf8")).portulan?.spec ?? "unknown";
    } catch {
        return "unknown";
    }
}

/** The most recent recorded send in this directory, for the cooldown. */
function lastSend(workspaceDir, except) {
    const dir = path.join(workspaceDir, "feedback");
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch {
        return null;
    }
    let latest = null;
    for (const name of names) {
        const at = path.join(dir, name);
        if (at === except || !name.endsWith(".md")) continue;
        let fields;
        try {
            fields = parseReport(fs.readFileSync(at, "utf8")).fields;
        } catch {
            continue;
        }
        if (!fields.sent) continue;
        const when = Date.parse(fields.sent);
        if (Number.isNaN(when)) continue;
        if (!latest || when > latest.at) latest = { at: when, issue: fields.issue ?? at };
    }
    return latest;
}

/**
 * Record something in the report's own frontmatter — the local artifact `0014` asks for.
 *
 * `replacing` names keys to drop first, so a second `preview` updates its digest rather than stacking
 * a second `previewed:` line that `parseReport` would silently resolve to the last one.
 */
function stamp(text, additions, replacing = []) {
    const lines = text.split(/\r?\n/);
    const close = lines.indexOf("---", 1);
    if (close === -1) throw new FeedbackError("the report's frontmatter block is never closed");

    // Scoped to the frontmatter. Filtering the whole file would delete a body line that happened to
    // begin `previewed:` — a tool editing prose it was not asked to edit, which is worse than the
    // duplicate key it would be preventing.
    const front = lines.slice(1, close).filter((line) => {
        const key = /^([A-Za-z_][\w-]*)\s*:/.exec(line)?.[1];
        return !(key && replacing.includes(key));
    });
    const added = Object.entries(additions).map(([key, value]) => `${key}: ${value}`);
    return [lines[0], ...front, ...added, ...lines.slice(close)].join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = run(process.argv.slice(2));
}
