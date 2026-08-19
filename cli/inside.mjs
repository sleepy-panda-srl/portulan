// Is one path inside another? One predicate, one file, no dependencies.
//
// **It lives alone because two large modules need it and must not import each other.** It began in
// `./index.mjs`, which `./doctor.mjs` imports; when `./compile.mjs` needed it too, importing it from
// there would have closed a cycle — `index.mjs` already imports `resolvePack`/`rootPlan` from
// `compile.mjs`. This repository has paid for a cycle once already: `../docs/plan.md`'s session log
// records **an import cycle exiting 13 in silence**, and three modules (`./plugin-lint.mjs:1369`,
// `./skills-set.mjs:48` and `:114`) carry comments explaining that they chose their import direction
// to avoid making one. Copying the predicate instead was the other option and is the one its own
// docblock forbids: two copies of this rule drifted into the identical defect before either shipped.
//
// So the rule keeps one implementation and gains no edges. `./index.mjs` re-exports it, so every
// existing importer is untouched.
//
// Found by Copilot on the change that closed #264, which had reached for the `index.mjs` export.

import path from "node:path";

/**
 * Is `child` inside `parent`?
 *
 * **The obvious spelling — `!path.relative(parent, child).startsWith("..")` — is wrong, and it fails
 * OPEN.** A name beginning with `..` is an ordinary filename, not a traversal: `path.relative` of
 * `memory/..index.md` against `memory/` is `..index.md`, which `startsWith("..")` calls *outside*.
 * Measured end to end before this was written — an index declared at `memory/..index.md` was written
 * into the store, reported `ok`, and `doctor` then counted it as a second record. That is the ninth
 * fail-open found in this repository's scaffolding, and the first one written by the change that
 * cites the class; `recordedOrigin` in `./compile.mjs` was the second, which is why this moved here.
 *
 * Only `..` exactly, or `..` followed by a separator, means outside. An absolute result means the two
 * paths share no root and cannot contain one another. A path is inside itself.
 */
export function isInside(parent, child) {
    const rel = path.relative(parent, child);
    if (rel === "") return true;
    if (path.isAbsolute(rel)) return false;
    return rel !== ".." && !rel.startsWith(`..${path.sep}`);
}
