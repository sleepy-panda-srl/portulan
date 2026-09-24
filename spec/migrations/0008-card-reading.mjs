// A form step — the card carries the engine's rules on reading and the cache.
//
// Since 2026-09-24 the card `init` drafts opens with a section `compile` writes out from the Portulan a
// consumer installed, `core/operating/context.md`: how what a session reads, prints and waits through is
// paid for on every request after it, the rules Portulan's own card carries. This step moves a card
// drafted before that to the form `init` drafts now, and `0007` compiles it, the chain being asked again
// after a pass that applied a step.
//
// **Owed wherever the card lacks the section, and placed only where the card is as it was drafted**: its
// head still the two lines `init` and `0006` wrote before the section. A card under any other head is owed
// the section by hand, reported with the head this step looks for and the line to add while `upgrade`
// applies the rest of the chain: a guess at where the section goes would edit a card nobody drafted for
// it, a skip would leave a workspace that never learns the rules exist, and a refusal would undo every
// other step with it.

import path from "node:path";

import { BOOT_CARD_UNIT } from "../../cli/compile.mjs";
import { carriesReading, HEAD_BEFORE_READING_SHOWN, notYetForm, READING_LINE, withReading } from "../../cli/form.mjs";

/** The card's source, or the answer `owed` gives where there is none to read. */
function cardOf(ws) {
    const context = ws.manifest?.slots?.context;
    if (typeof context !== "string") return { answer: { owed: false, because: "`slots.context` is undeclared, so there is no card; `0006` drafts one with the section" } };
    const rel = path.posix.join(context, `${BOOT_CARD_UNIT}.md`);
    try {
        return { rel, card: ws.read(rel) };
    } catch (error) {
        if (error?.code === "ENOENT") return { answer: { owed: false, because: "`slots.context` holds no `boot` unit, so there is no card to carry the section" } };
        return { answer: { owed: null, because: `${rel} could not be read: ${error.message}` } };
    }
}

/** Why a card under a head this step does not know gets no section from it, and what to add by hand. */
const unplaced = (rel) =>
    `${rel} does not carry the engine's rules on reading and the cache, and its head is not one \`init\` drafted ` +
    `before 2026-09-24, ${HEAD_BEFORE_READING_SHOWN}, so this step does not guess where they go: add a section ` +
    `holding the line \`${READING_LINE}\` to the card, then upgrade again`;

export const step = {
    id: "0008-card-reading",
    kind: "form",
    from: null,
    to: null,
    title: "the card carries the engine's rules on reading and the cache",
    why:
        "The card `init` drafts opens with the rules of Portulan's `core/operating/context.md` on what a " +
        "session's reads, output and pauses cost on every request after them, written out by `compile`. A card " +
        "drafted before them gets the section and `0007` compiles it; one under any other head is reported with " +
        "the line to add by hand, and the rest of the chain runs.",

    owed(ws, ctx) {
        const behind = notYetForm(ws, ctx);
        if (behind) return { owed: false, because: behind };
        if (ws.manifest?.kind !== "repository") return { owed: false, because: `a \`${ws.manifest?.kind}\` workspace has no repository of its own whose host would load a card` };
        const { rel, card, answer } = cardOf(ws);
        if (answer) return answer;
        if (carriesReading(card)) return { owed: false, because: `${rel} carries the engine's rules on reading and the cache` };
        if (withReading(card) === null) return { owed: true, hand: true, because: unplaced(rel) };
        return { owed: true, because: `${rel} was drafted before the card carried the engine's rules on reading and the cache: they go under its head, and \`0007\` then compiles it` };
    },

    plan(ws) {
        const { rel, card, answer } = cardOf(ws);
        if (answer) return { ok: false, reason: answer.because };
        const next = withReading(card);
        if (next === null) return { ok: false, reason: unplaced(rel) };
        return { ok: true, edits: [{ file: rel, next }] };
    },
};
