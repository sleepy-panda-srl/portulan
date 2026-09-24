// A form step — the handoff index is printed on demand, and not kept.
//
// Portulan stopped keeping its own handoff index on 2026-09-23: a committed copy conflicted on every
// merge that added a handoff, and carried nothing the series does not. `portulan index --handoffs`
// prints it on demand, and `index --check` still renders the series with no copy on disk, so the rail
// keeps its subject. This step moves a consumer the same way: a kept copy is deleted, and its path is
// git-ignored so none is committed again. The declaration stays, since it names where a copy would go.
//
// **Owed by git's answer, never by the disk's alone.** A copy on disk that git ignores and does not
// track is one machine's own, written by `index --write` for a reader there, and it is left alone: the
// step is owed where the path is not ignored, or where a copy is still tracked.

import path from "node:path";

import { handoffIndexIgnore, notYetForm, withIgnoreLines } from "../../cli/form.mjs";

const posix = (p) => p.split(path.sep).join("/");

/** Where the index sits in the tree, or why this step has nothing to decide here. */
function located(ws) {
    const declared = ws.manifest?.handoffs?.index?.path;
    if (typeof declared !== "string") return { skip: "this workspace declares no handoff index" };
    if (!ws.repository) return { skip: "this workspace declares no tree, so no repository's git keeps a copy" };
    const rel = path.relative(ws.repository.dir, path.resolve(ws.dir, declared));
    if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return { skip: `the index at \`${declared}\` lies outside the tree` };
    const git = ws.repository.git;
    if (git === null) return { skip: "no git work tree answers here, so no copy is committed to stop keeping" };
    return { rel: posix(rel), workspace: posix(path.relative(ws.repository.dir, ws.dir)) || ".", git };
}

/** Whether git ignores the index's path by the rules alone, tracked or not; null where git cannot say. */
function ignoredBy(at) {
    const out = at.git("check-ignore", "-q", "--no-index", "--", at.rel);
    if (out.status === 0) return { ignored: true };
    if (out.status === 1) return { ignored: false };
    return { ignored: null, why: `git check-ignore could not answer for ${at.rel} — ${out.stderr.trim() || `exit ${out.status}`}` };
}

export const step = {
    id: "0003-handoff-index-not-kept",
    kind: "form",
    from: null,
    to: null,
    title: "the handoff index is printed on demand, and not kept",
    why:
        "A committed handoff index conflicts on every merge that adds a handoff, and carries nothing the " +
        "series does not: `portulan index --handoffs` prints it. The copy is deleted, so commit the deletion, " +
        "and its path is git-ignored so none is committed again.",

    owed(ws, ctx) {
        const behind = notYetForm(ws, ctx);
        if (behind) return { owed: false, because: behind };
        const at = located(ws);
        if (at.skip) return { owed: false, because: at.skip };
        const rule = ignoredBy(at);
        if (rule.ignored === null) return { owed: null, because: rule.why };
        const kept = ws.repository.read(at.rel) !== null;
        if (!rule.ignored) return { owed: true, because: `\`${at.rel}\` is not git-ignored${kept ? ", and a copy is kept" : ""}` };
        const tracked = at.git("ls-files", "--error-unmatch", "--", at.rel).status === 0;
        if (kept && tracked) return { owed: true, because: `\`${at.rel}\` is git-ignored and still tracked, so the committed copy conflicts on every merge that adds a handoff` };
        return { owed: false, because: `\`${at.rel}\` is git-ignored${kept ? ", and the copy on disk is this machine's own" : ", and no copy is kept"}` };
    },

    plan(ws) {
        const at = located(ws);
        if (at.skip) return { ok: true, edits: [] };
        const rule = ignoredBy(at);
        if (rule.ignored === null) return { ok: false, reason: rule.why };
        const edits = [];
        if (ws.repository.read(at.rel) !== null) edits.push({ root: "tree", file: at.rel, next: null });
        if (!rule.ignored) {
            const before = ws.repository.read(".gitignore");
            edits.push({ root: "tree", file: ".gitignore", next: withIgnoreLines(before, handoffIndexIgnore(at.rel, at.workspace)) });
        }
        return { ok: true, edits };
    },
};
