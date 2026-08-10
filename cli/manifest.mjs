// The two facts every tool here needs out of `package.json`, read once and in a module that imports
// nothing of ours.
//
// ## Why this is its own file, which is the part worth reading
//
// `VERSION` lived in `portulan.mjs` because that is where it was first needed, and it was right there:
// one carrier, read from the manifest that publishes it rather than written down twice.
//
// Then `feedback.mjs` needed the same value and imported it from `portulan.mjs` — still one carrier,
// and **it hung the command line**. `portulan.mjs` ends in `process.exitCode = await run(…)`, `run`
// dynamically imports the subcommand, and the subcommand statically imported `portulan.mjs` back. Node
// cannot finish evaluating a module that is waiting on a module waiting on it: `portulan feedback
// --help` printed nothing and exited **13**, `Detected unsettled top-level await`.
//
// Nothing in the suite could see it. Every dispatch case injects the loader — correctly, since
// re-asserting what each tool proves itself would make the entry point's suite a second carrier of it
// — and an injected loader never imports the real module, so the cycle does not exist under test. It
// was found by the one case that spawns the real binary, written in the same change for exactly this
// reason. **A harness you write to check your own change inherits your change's blind spot**, for the
// third recorded time in this repository.
//
// So the shared read moved down here, where it has no dependencies to be circular with. `portulan.mjs`
// re-exports `VERSION` so its published surface is unchanged.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The manifest, in both layouts that matter: from a checkout it is one level above `cli/`, and the
 * published package keeps that shape because `files` ships `cli/` under the package root.
 *
 * Falls back rather than throwing. A version string and a repository name are not worth taking the
 * command line down for — and the callers that need the repository to be real say so themselves
 * rather than inheriting a crash from here.
 */
const manifest = (() => {
    try {
        const at = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
        return JSON.parse(fs.readFileSync(at, "utf8"));
    } catch {
        return {};
    }
})();

export const VERSION = manifest.version ?? "unknown";

/**
 * The repository issues are filed into, derived from the `bugs.url` the manifest already publishes
 * rather than minted as a second constant — `portulan feedback` would otherwise carry a copy that
 * nothing holds to this one.
 *
 * `null` when the manifest carries no usable URL, which the sender turns into a refusal naming
 * `--repo`; guessing a repository to file a public issue into is the one wrong answer here.
 */
export const REPOSITORY = (() => {
    const match = /github\.com\/([^/]+\/[^/]+?)(?:\/issues)?\/?$/.exec(manifest.bugs?.url ?? "");
    return match ? match[1] : null;
})();
