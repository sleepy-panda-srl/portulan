// A form step — the card carries the engine's rules on reading and the cache.

import path from "node:path";

import { BOOT_CARD_UNIT } from "../../cli/compile.mjs";
import { carriesReading, HEAD_BEFORE_READING_SHOWN, notYetForm, READING_LINE, withReading } from "../../cli/form.mjs";

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
