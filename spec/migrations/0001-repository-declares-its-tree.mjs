// Workspace Definition 1.0 → 2.0 — a `repository` workspace declares its `tree`.

import fs from "node:fs";
import path from "node:path";

const FROM_MAJOR = 1;

/** `.git` is a file in a worktree or a submodule, and only ENOENT means it is absent. */
function repositoryRoot(dir) {
    try {
        fs.lstatSync(path.join(dir, ".git"));
        return "yes";
    } catch (error) {
        if (error.code === "ENOENT") return "no";
        return "unknown";
    }
}

export const step = {
    id: "0001-repository-declares-its-tree",
    kind: "version",
    from: "1.0",
    to: "2.0",
    title: "a `repository` workspace declares its `tree`",
    why:
        "`tree` is where the repository a workspace makes claims ABOUT begins. Absent, `doctor` reports " +
        "every repo-card build/test/run and layout claim as unverifiable instead of checking it — a whole " +
        "check class disabled by a missing line, green, exit 0.",

    owed(ws) {
        const declared = ws.manifest?.portulan?.spec;
        if (typeof declared !== "string") {
            return { owed: null, because: "this manifest declares no `portulan.spec`, so which contract it was written against cannot be read" };
        }
        const parsed = /^([0-9]+)\.([0-9]+)$/.exec(declared);
        if (!parsed) {
            return { owed: null, because: `\`portulan.spec\` is \`${declared}\`, which is not MAJOR.MINOR — refusing to guess which side of 2.0 that is` };
        }
        const major = Number(parsed[1]);
        if (major === FROM_MAJOR) return { owed: true, because: `this workspace declares ${declared}` };
        return { owed: false, because: `this workspace declares ${declared}, which is past ${FROM_MAJOR}.x` };
    },

    plan(ws, ctx) {
        const next = { ...ws.manifest, portulan: { ...ws.manifest.portulan, spec: this.to } };

        if (next.kind === "repository" && typeof next.tree !== "string") {
            if (typeof ctx.tree === "string" && ctx.tree !== "") {
                next.tree = ctx.tree;
            } else {
                const parent = path.resolve(ws.dir, "..");
                const verdict = repositoryRoot(parent);
                if (verdict === "yes") {
                    next.tree = "../";
                } else if (verdict === "unknown") {
                    return {
                        ok: false,
                        reason:
                            `${parent} could not be examined, so whether it is the repository root is unknown. ` +
                            "Pass `--tree <path>` to say where this workspace's repository begins",
                    };
                } else {
                    return {
                        ok: false,
                        reason:
                            `a \`repository\` workspace must declare \`tree\`, and ${parent} is not a repository root, ` +
                            "so `../` cannot be derived. Pass `--tree <path>` — refusing to guess at somebody's layout",
                    };
                }
            }
        }

        return { ok: true, edits: [{ file: "workspace.json", next: `${JSON.stringify(next, null, 2)}\n` }] };
    },
};
