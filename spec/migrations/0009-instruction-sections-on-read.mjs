// A form step — each section a team marks in its own instruction file moves to an on-read unit.
//
// Claude Code loads a repository's `CLAUDE.md` and `.claude/CLAUDE.md` whole into every context, so a section
// only one kind of task needs is paid for by every session, subagent and checkpoint. A team marks such a
// section with a line `<!-- portulan: on-read -->` under its heading, and this step moves it, heading and all
// and byte for byte, into an on-read unit of `slots.context`, leaving a marker where it was; `0007` compiles
// the unit's line into the index every context loads, naming the section and its size. The split is
// `cli/instructions.mjs`'s, and proved before it is offered: the file must reassemble from its units byte for
// byte and each clause land once, or the step refuses, and nothing is written. That command line puts every
// section back, with `--join`, and says of each unit whether it was edited since.
//
// **Owed only where a team marked a section**: which guidance may leave every context is the team's word, and
// a size says nothing about it (`0036`, rule 5). A mark the split refuses (a section importing a file, one
// marked inside another, a mark under no heading) keeps the step owed and refused, as a changelog `0004`
// cannot prove is, until the team moves the import or the mark.

import { ESTIMATED_BYTES_PER_TOKEN, alwaysTier, declaredContext, tokensOf } from "../../cli/context.mjs";
import { notYetForm } from "../../cli/form.mjs";
import { INSTRUCTION_FILES, contextDir, grouped, marksOf, planSplit, splitLines } from "../../cli/instructions.mjs";

/** The split of the workspace's repository, planned through the view `upgrade` gives a step. */
function splitOf(ws) {
    const tree = ws.repository.dir;
    const context = contextDir(tree, ws.dir, ws.manifest);
    const taken = context === null ? [] : ws.repository.names(context).filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3));
    return planSplit({ tree, context, taken, read: ws.repository.read });
}

export const step = {
    id: "0009-instruction-sections-on-read",
    kind: "form",
    from: null,
    to: null,
    title: "each section a team marks in its instruction file moves to an on-read unit",
    why:
        "`CLAUDE.md` and `.claude/CLAUDE.md` load whole into every context. A section marked " +
        "`<!-- portulan: on-read -->` moves, byte for byte, to an on-read unit of `slots.context`, proved to " +
        "reassemble, and every context loads one index line for it. " +
        "`node <plugin root>/cli/instructions.mjs --workspace <dir> --join --write` puts it back.",

    owed(ws, ctx) {
        const behind = notYetForm(ws, ctx);
        if (behind) return { owed: false, because: behind };
        if (!ws.repository) return { owed: false, because: "this workspace declares no tree, so there is no instruction file of its own" };
        const marked = INSTRUCTION_FILES.filter((rel) => marksOf(ws.repository.read(rel) ?? "").marks.length > 0);
        if (marked.length === 0) return { owed: false, because: "no section of CLAUDE.md or .claude/CLAUDE.md is marked `<!-- portulan: on-read -->`" };
        if (typeof ws.manifest?.slots?.context !== "string") {
            return { owed: false, because: `${marked.join(" and ")} marks a section, and \`slots.context\` is undeclared: \`0006\` declares it, and this step is asked again then` };
        }
        const split = splitOf(ws);
        if (split.refusals.length) return { owed: true, because: `a marked section cannot move — ${split.refusals.join("; ")}` };
        const ratio = declaredContext(ws.manifest).ratio ?? ESTIMATED_BYTES_PER_TOKEN;
        const before = alwaysTier(ws.repository.dir).entries.reduce((n, e) => n + e.bytes, 0);
        const after = before - split.files.reduce((n, f) => n + f.removed, 0) + split.index;
        return {
            owed: true,
            because: `${splitLines(split).join("; ")}; the always tier goes from ~${grouped(tokensOf(before, ratio))} to ~${grouped(tokensOf(after, ratio))} tokens`,
        };
    },

    plan(ws) {
        const split = splitOf(ws);
        if (split.refusals.length) return { ok: false, reason: `a marked section cannot move, so none is moved — ${split.refusals.join("; ")}` };
        return {
            ok: true,
            edits: [
                ...split.files.map((f) => ({ root: "tree", file: f.rel, next: f.after })),
                ...split.units.map((u) => ({ root: "tree", file: u.source, next: u.text })),
            ],
        };
    },
};
