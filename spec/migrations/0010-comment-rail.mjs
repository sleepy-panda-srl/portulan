// A form step — a `comments` recipe holds the comment lines that record a change's history.
//
// `init` drafts the recipe where git lists the tree, at the count it finds there, so no workspace starts
// red. This step offers the same to a workspace drafted without one, and refuses where
// `verify/comments.sh` is already in the workspace undeclared, rather than write over it.

import path from "node:path";

import { historyCount } from "../../cli/comments.mjs";
import { COMMENTS_RECIPE, commentsRecipe, commentsRecipeEntry, declaresCommentsRecipe, notYetForm } from "../../cli/form.mjs";

const RECIPE_FILE = "verify/comments.sh";

const posix = (p) => p.split(path.sep).join("/");

export const step = {
    id: "0010-comment-rail",
    kind: "form",
    from: null,
    to: null,
    title: "a `comments` recipe holds the comment lines that record a change's history",
    why:
        "A comment is paid for on every read of its file, and a change's history belongs in its commit " +
        "message. `verify/comments.sh` counts the comment lines that record one, and holds them at the count " +
        "the tree has today, so it starts green and the count only falls. It is declared as the `comments` recipe.",

    owed(ws, ctx) {
        const behind = notYetForm(ws, ctx);
        if (behind) return { owed: false, because: behind };
        if (ws.manifest?.kind !== "repository") return { owed: false, because: `a \`${ws.manifest?.kind}\` workspace has no repository of its own to count` };
        if (!ws.repository) return { owed: false, because: "this workspace declares no tree to count" };
        if (ws.repository.git === null) return { owed: false, because: "no git work tree answers here, so no files are listed to count" };
        if (declaresCommentsRecipe(ws.manifest)) return { owed: false, because: "a `comments` recipe is declared" };
        return { owed: true, because: "no `comments` recipe counts the comment lines that record a change's history: one is drafted at the tree's count" };
    },

    plan(ws, ctx) {
        if (ws.list().includes(RECIPE_FILE)) {
            return { ok: false, reason: `\`${RECIPE_FILE}\` is in the workspace and no recipe declares it: declare it as \`${COMMENTS_RECIPE}\`, or rename it, then upgrade` };
        }
        const tree = ws.repository.dir;
        let limit;
        try {
            limit = historyCount(tree);
        } catch (error) {
            return { ok: false, reason: `the tree's comments could not be counted — ${error.message}` };
        }
        const entry = commentsRecipeEntry(posix(path.relative(tree, ws.dir)) || ".");
        const manifest = { ...ws.manifest, verify: { ...ws.manifest.verify, recipes: [...ws.manifest.verify.recipes, entry] } };
        const toTree = posix(path.relative(path.join(ws.dir, "verify"), tree));
        return {
            ok: true,
            edits: [
                { file: RECIPE_FILE, next: commentsRecipe({ bundle: ctx.bundle, limit, toTree }), mode: 0o755 },
                { file: "workspace.json", next: `${JSON.stringify(manifest, null, 2)}\n` },
            ],
        };
    },
};
