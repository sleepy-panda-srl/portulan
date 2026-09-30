// Is one path inside another? One predicate, one file, no dependencies.

import path from "node:path";

/** True when `child` is `parent` itself or lies under it. */
export function isInside(parent, child) {
    const rel = path.relative(parent, child);
    if (rel === "") return true;
    // Absolute when the two share no root, as two Windows drives do.
    if (path.isAbsolute(rel)) return false;
    // Not `startsWith("..")`: a name such as `..index.md` is an ordinary file, not a traversal.
    return rel !== ".." && !rel.startsWith(`..${path.sep}`);
}
