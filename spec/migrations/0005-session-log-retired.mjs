// A form step — a change's record is its commit message, and the Session log is retired to a pointer.

import { notYetForm, retireSessionLogs, sessionLogPointer, sessionLogSections } from "../../cli/form.mjs";

function logsIn(ws) {
    if (!ws.repository) return { skip: "this workspace declares no tree, so no repository holds a Session log" };
    const git = ws.repository.git;
    if (git === null) return { skip: "no git work tree answers here, and a retired log points at the commit that holds its entries" };
    const listed = git("ls-files", "-z", "--", "*.md");
    if (listed.status !== 0) return { unknown: `git ls-files could not list the tracked Markdown — ${listed.stderr.trim() || `exit ${listed.status}`}` };
    const files = [];
    for (const rel of listed.stdout.split("\0").filter(Boolean)) {
        let text;
        try {
            text = ws.repository.read(rel);
        } catch {
            // A link, or a path the disk cannot give: a link's target is read in its own right where git tracks it.
            continue;
        }
        if (text === null || !text.includes("Session log")) continue;
        if (sessionLogSections(text).some((s) => s.entries)) files.push({ rel, text });
    }
    return { git, files };
}

export const step = {
    id: "0005-session-log-retired",
    kind: "form",
    from: null,
    to: null,
    title: "the Session log is retired to a pointer at the commit that holds it",
    why:
        "A log every change appends to conflicts on every merge and repeats what the commit messages say. " +
        "Each `Session log` section with entries keeps its heading and two lines: the date it retired, and " +
        "`git show <sha>:<file>`, the last commit holding its entries.",

    owed(ws, ctx) {
        const behind = notYetForm(ws, ctx);
        if (behind) return { owed: false, because: behind };
        const found = logsIn(ws);
        if (found.skip) return { owed: false, because: found.skip };
        if (found.unknown) return { owed: null, because: found.unknown };
        if (found.files.length === 0) return { owed: false, because: "no tracked Markdown holds a Session log with entries" };
        return { owed: true, because: `a Session log with entries in ${found.files.map((f) => f.rel).join(", ")}` };
    },

    plan(ws, ctx) {
        const found = logsIn(ws);
        if (found.skip) return { ok: true, edits: [] };
        if (found.unknown) return { ok: false, reason: found.unknown };
        const { git } = found;
        // `git show <sha>:<path>` reads a path from the repository's top, and the tree may sit below it.
        const prefix = git("rev-parse", "--show-prefix");
        if (prefix.status !== 0) return { ok: false, reason: `git rev-parse could not name the tree's place in its repository — ${prefix.stderr.trim()}` };
        const edits = [];
        for (const { rel, text } of found.files) {
            const status = git("status", "--porcelain", "--", rel);
            if (status.status !== 0) return { ok: false, reason: `git status could not answer for ${rel} — ${status.stderr.trim() || `exit ${status.status}`}` };
            if (status.stdout.trim() !== "") {
                return { ok: false, reason: `${rel} has changes not committed, and its retired log would point at a commit that lacks them — commit or stash them, then upgrade` };
            }
            const sha = git("log", "-1", "--format=%h", "--", rel);
            if (sha.status !== 0 || sha.stdout.trim() === "") return { ok: false, reason: `git names no commit holding ${rel}, so its retired log would point at nothing` };
            const pointer = sessionLogPointer({ date: ctx.today, sha: sha.stdout.trim(), file: `${prefix.stdout.trim()}${rel}` });
            edits.push({ root: "tree", file: rel, next: retireSessionLogs(text, pointer) });
        }
        return { ok: true, edits };
    },
};
