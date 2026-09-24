// A form step — the guidance the workspace declares is compiled into what the host loads.
//
// A card, or any unit in `slots.context`, reaches a session only once `portulan compile` has written it
// into `.claude/rules/portulan/`. This step writes compile's guidance half, through compile's own reader,
// planner and refusals, and never its settings half: `.claude/settings.json` stays the output of a
// `compile` a person runs. It follows `0006`, which drafts a card and leaves it uncompiled, and it is
// owed wherever the compiled rules differ from what compile would write, so a workspace whose card
// drifted is brought back to its slots by the same run.
//
// **What compile did not write, it leaves, and so does this step.** A rule written by hand where the card
// would go is a refusal of compile's, reported as this step's answer; one beside the compiled rules is
// left where it is, as `compile` leaves it, and named.

import { guidanceEdits } from "../../cli/compile.mjs";
import { notYetForm } from "../../cli/form.mjs";

export const step = {
    id: "0007-guidance-compiled",
    kind: "form",
    from: null,
    to: null,
    title: "the declared guidance is compiled into the rules the host loads",
    why:
        "A unit in `slots.context` reaches a session only as the rule `compile` writes for it. The rules are " +
        "written through compile's own planner, as `portulan compile` writes them, and never " +
        "`.claude/settings.json`.",

    owed(ws, ctx) {
        const behind = notYetForm(ws, ctx);
        if (behind) return { owed: false, because: behind };
        if (!ws.repository) return { owed: false, because: "this workspace declares no tree for compiled guidance to load in" };
        if (typeof ws.manifest?.slots?.context !== "string") return { owed: false, because: "`slots.context` is undeclared, so there is no guidance to compile" };
        const planned = guidanceEdits(ws.dir);
        const left = planned.left.length ? `; ${planned.left.join(", ")} ${planned.left.length === 1 ? "is" : "are"} not compile's, and left as \`compile\` leaves ${planned.left.length === 1 ? "it" : "them"}` : "";
        if (planned.edits.length === 0) return { owed: false, because: `the compiled guidance is what \`compile\` would write${left}` };
        return { owed: true, because: `${planned.edits.map((e) => e.file).join(", ")} ${planned.edits.length === 1 ? "differs" : "differ"} from what \`compile\` would write${left}` };
    },

    plan(ws) {
        return { ok: true, edits: guidanceEdits(ws.dir).edits.map((edit) => ({ root: "tree", file: edit.file, next: edit.next })) };
    },
};
