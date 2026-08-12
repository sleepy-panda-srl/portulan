// Workspace Definition 1.0 → 2.0 — a `repository` workspace declares its `tree`.
//
// The only MAJOR migration this train has, and `../README.md` records why it was taken while it cost
// nothing: `tree` began optional, and optional was a hole — deleting one manifest line degraded the
// whole claims-lint class from *checked* to *reported*, GREEN, exit 0.
//
// **This step has no subject in this repository and none in any tree we have seen.** Nothing here
// declares 1.0. It is exercised against a fixture, which `../README.md` says out loud rather than
// leaving a passing suite to imply otherwise.

import fs from "node:fs";
import path from "node:path";

/** The version this step migrates FROM, as a MAJOR. One place, so the two readers below agree. */
const FROM_MAJOR = 1;

/**
 * Is `dir` a repository root? `.git` is the evidence, and it is **a file as often as a directory**.
 *
 * A worktree's `.git` is a FILE containing `gitdir: …`, and so is a submodule's. A directory-only
 * test passes every suite written on an ordinary clone and is wrong for every worktree user — the
 * shape this project keeps paying for, so it is guarded here rather than discovered. The repository
 * this step ships from is itself checked out as a worktree today.
 *
 * Three answers, not two: `yes`, `no`, and **`unknown`** — because only `ENOENT` means absent, and an
 * `EACCES` is a question nobody answered.
 */
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

        // Only a `repository` needs `tree`. A `demo` or `portfolio` describes repositories that are
        // not beside it, and giving one a tree would be inventing a claim the workspace never made.
        if (next.kind === "repository" && typeof next.tree !== "string") {
            if (typeof ctx.tree === "string" && ctx.tree !== "") {
                next.tree = ctx.tree;
            } else {
                // Derived only where it is derivable, and refused otherwise. A hopeful `../` is a
                // claim about somebody's layout made by a tool that did not look — and `tree` is
                // precisely the slot whose wrongness turns a check class into a lie rather than an
                // error.
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
