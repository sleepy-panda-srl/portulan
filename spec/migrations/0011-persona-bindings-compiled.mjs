// Refresh existing persona context fields through the compiler's ownership planner.
import { personaEdits } from "../../cli/compile.mjs";
import { notYetForm } from "../../cli/form.mjs";

export const step = {
    id: "0011-persona-bindings-compiled", kind: "form", from: null, to: null,
    title: "existing eligible persona bindings carry the shipped context declarations",
    why: "The shipped persona route and its A/B evidence must arrive on upgrade. Refresh existing compiler-owned context fields; never create a binding, widen core source selection, or write gate settings.",
    owed(ws, ctx) {
        const behind = notYetForm(ws, ctx);
        if (behind) return { owed: false, because: behind };
        if (!ws.repository) return { owed: false, because: "no declared repository tree holds persona bindings" };
        const planned = personaEdits(ws.dir);
        return {
            owed: planned.edits.length > 0,
            because: planned.edits.length ? `${planned.edits.map(edit => edit.file).join(", ")} differ from their persona declarations` :
                planned.compared ? "existing eligible persona bindings agree with their declarations" : "no existing eligible binding is selected; missing or foreign core bindings are not installed",
        };
    },
    plan(ws) {
        return { ok: true, edits: personaEdits(ws.dir).edits.map(edit => ({ root: "tree", ...edit })) };
    },
};
