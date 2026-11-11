// Optional project import probes.
import fs from "node:fs";

// A denied read or a loop of links is not absence: hiding it could report less than the host loads.
const ABSENT = new Set(["ENOENT", "ENOTDIR", "ENAMETOOLONG", "ERR_INVALID_ARG_VALUE"]);
export const isAbsentImportError = (error) => ABSENT.has(error?.code);

export function importTargetIsFile(file) {
    try {
        return fs.statSync(file).isFile();
    } catch (error) {
        if (isAbsentImportError(error)) return false;
        throw error;
    }
}
