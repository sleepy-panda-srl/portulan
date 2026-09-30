// A form step — a changelog entry is a fragment under `changes/`.

import { CHANGELOG, CHANGES_DIR, CHANGES_README, changesReadme, notYetForm, unreleasedCount, unreleasedFragments, unreleasedRewrites } from "../../cli/form.mjs";

function rewritten(changelog) {
    const lines = unreleasedRewrites(changelog);
    if (lines.length === 0) return "";
    if (lines.length === 1) return ` (the one at line ${lines[0]} does not open \`- \`, which its fragment does, as the release cut accepts no other opening)`;
    return ` (those at lines ${lines.slice(0, -1).join(", ")} and ${lines.at(-1)} do not open \`- \`, which their fragments do, as the release cut accepts no other opening)`;
}

export const step = {
    id: "0004-changelog-fragments",
    kind: "form",
    from: null,
    to: null,
    title: "a changelog entry is a fragment under `changes/`",
    why:
        "Two open changes that each add a bullet under Unreleased conflict on merge; a file per entry never " +
        "does. Each entry moves to `changes/<nn>-<slug>.<section>.md`, proved to print back as the changelog " +
        "held it but for an entry that does not open `- `, whose fragment does and which the step names by its " +
        "line, and `portulan index --changes changes` prints them as the cut pastes them.",

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
        if (entries) owed.push(`${entries} entr${entries === 1 ? "y" : "ies"} under ${CHANGELOG}'s Unreleased${rewritten(changelog)}`);
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
