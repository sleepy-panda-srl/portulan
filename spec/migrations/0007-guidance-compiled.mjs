// A form step — the guidance the workspace declares is compiled into what the host loads.

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
