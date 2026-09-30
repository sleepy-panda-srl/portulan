// The two facts every tool here needs out of `package.json`, read once and in a module that imports nothing of ours.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const manifest = (() => {
    try {
        const at = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
        return JSON.parse(fs.readFileSync(at, "utf8"));
    } catch {
        return {};
    }
})();

export const VERSION = manifest.version ?? "unknown";

/** The repository issues are filed into, as `owner/name` from `bugs.url`; null, never a guess, when that names none. */
export const REPOSITORY = (() => {
    const match = /github\.com\/([^/]+\/[^/]+?)(?:\/issues)?\/?$/.exec(manifest.bugs?.url ?? "");
    return match ? match[1] : null;
})();
