// A form step — a changelog entry is a fragment under `changes/`.
//
// Portulan moved its own changelog on 2026-09-23: two open changes that each add a bullet under
// Unreleased conflict on merge, and a file per entry never does. `portulan index --changes changes`
// prints the fragments as a release cut pastes them. This step moves a consumer the same way: each entry
// under `CHANGELOG.md`'s Unreleased heading becomes a fragment, the heading keeps a two-line pointer, and
// `changes/README.md` keeps the rule and the directory.
//
// **The move is proved before it is offered.** The fragments are rendered as the cut renders them, and
// each section must print back exactly as the changelog held it, or the step refuses and names the
// section: a move that changed a word would be a record rewritten by a tool. A `### heading` under
// Unreleased that names none of the six sections has no fragment name, and is refused the same way.

import { CHANGELOG, CHANGES_DIR, CHANGES_README, changesReadme, notYetForm, unreleasedCount, unreleasedFragments } from "../../cli/form.mjs";

export const step = {
    id: "0004-changelog-fragments",
    kind: "form",
    from: null,
    to: null,
    title: "a changelog entry is a fragment under `changes/`",
    why:
        "Two open changes that each add a bullet under Unreleased conflict on merge; a file per entry never " +
        "does. Each entry moves to `changes/<nn>-<slug>.<section>.md`, proved to print back as the changelog " +
        "held it, and `portulan index --changes changes` prints them as the cut pastes them.",

    owed(ws, ctx) {
        const behind = notYetForm(ws, ctx);
        if (behind) return { owed: false, because: behind };
        if (!ws.repository) return { owed: false, because: "this workspace declares no tree, so no changelog sits beside it" };
        const changelog = ws.repository.read(CHANGELOG);
        const readme = ws.repository.read(CHANGES_README) !== null;
        if (changelog === null) {
            return { owed: false, because: readme ? `${CHANGES_README} is here, and no ${CHANGELOG} yet` : `no ${CHANGELOG} here for fragments to feed` };
        }
        const entries = unreleasedCount(changelog) ?? 0;
        const owed = [];
        if (!readme) owed.push(`no ${CHANGES_README}`);
        if (entries) owed.push(`${entries} entr${entries === 1 ? "y" : "ies"} under ${CHANGELOG}'s Unreleased`);
        if (owed.length === 0) return { owed: false, because: `the changelog's entries are fragments in ${CHANGES_DIR}/` };
        return { owed: true, because: owed.join(", and ") };
    },

    plan(ws) {
        const edits = [];
        if (ws.repository.read(CHANGES_README) === null) edits.push({ root: "tree", file: CHANGES_README, next: changesReadme() });
        const changelog = ws.repository.read(CHANGELOG);
        const moved = changelog === null ? null : unreleasedFragments(changelog, new Set(ws.repository.names(CHANGES_DIR)));
        if (moved?.refused) return { ok: false, reason: moved.refused };
        if (moved && moved.fragments.length) {
            for (const fragment of moved.fragments) edits.push({ root: "tree", file: `${CHANGES_DIR}/${fragment.name}`, next: fragment.text });
            edits.push({ root: "tree", file: CHANGELOG, next: moved.next });
        }
        return { ok: true, edits };
    },
};
