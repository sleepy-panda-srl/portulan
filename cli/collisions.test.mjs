// The collision contract: `init`, `new` and `vendor` answer each contracted state alike, and no fourth `collisions` exists.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collisions as initCollisions } from "./init.mjs";
import { collisions as newCollisions } from "./new.mjs";
import { collisions as vendorCollisions } from "./vendor.mjs";

// No host plugins reach this suite; `pinned-roots.live.test.mjs` requires these three lines verbatim.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const HERE = path.dirname(fileURLToPath(import.meta.url));

// One exit handler for every scratch directory: one each would pass node's ten-listener limit.
const SCRATCH = [];
const SERVERS = [];
process.on("exit", () => {
    for (const server of SERVERS) {
        try {
            server.close();
        } catch {
            /* already closed, or never listened */
        }
    }
    for (const dir of SCRATCH) {
        // `chmodSync` follows links, and in one case this path is a symlink to the temp directory: lstat first.
        const locked = path.join(dir, SEGMENT);
        try {
            if (fs.lstatSync(locked).isDirectory()) fs.chmodSync(locked, 0o755);
        } catch {
            /* absent, or already gone — nothing to unlock */
        }
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

// A short prefix for the ~104-byte socket path, realpath'd so the only links on a chain are this suite's own.
function scratch() {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "pcol-"));
    SCRATCH.push(dir);
    return dir;
}

// One directory down, so a case can put a symlink or a lock on the segment above the leaf.
const REL = "slot/leaf.md";
const SEGMENT = REL.split("/")[0];

const CARRIERS = [
    { tool: "init.mjs", ask: (root, rel) => initCollisions(root, new Map([[rel, "contents"]])).length > 0 },
    { tool: "new.mjs", ask: (root, rel) => newCollisions([path.join(root, rel)], root).length > 0 },
    { tool: "vendor.mjs", ask: (root, rel) => vendorCollisions(root, [rel]).length > 0 },
];

// Left out, as the carriers split on it: a symlinked root over an absent leaf, which only `init` permits.
const CONTRACT = [
    {
        what: "absent — the one state that is not a collision",
        refused: false,
        arrange: () => {},
    },
    {
        what: "an ordinary file already at the leaf",
        refused: true,
        arrange: (root) => fs.writeFileSync(path.join(root, REL), "someone else's file"),
    },
    {
        what: "a DIRECTORY at the leaf, where only a file was ever planned",
        refused: true,
        arrange: (root) => fs.mkdirSync(path.join(root, REL)),
    },
    {
        what: "a SYMLINK at the leaf",
        refused: true,
        arrange: (root) => fs.symlinkSync("/etc/hosts", path.join(root, REL)),
    },
    {
        what: "a SYMLINK on the chain above the leaf",
        refused: true,
        arrange: (root) => fs.symlinkSync(fs.realpathSync(os.tmpdir()), path.join(root, SEGMENT)),
        skipParent: true,
    },
    {
        what: "a SOCKET at the leaf — a thing that is not a file",
        refused: true,
        // A socket rather than a FIFO: `net` makes one without shelling out to `mkfifo`.
        arrange: async (root, servers) => {
            const at = path.join(root, REL);
            const server = net.createServer();
            try {
                await new Promise((resolve, reject) => {
                    server.once("error", reject);
                    server.listen(at, resolve);
                });
            } catch (cause) {
                return `could not bind a socket at ${at} (${cause.code ?? cause.message}); the path is ${Buffer.byteLength(at)} bytes and the limit is about 104`;
            }
            // `unref`, never closed here: closing a socket unlinks it, and it is the leaf under test.
            server.unref();
            servers.push(server);
        },
    },
    {
        what: "an UNREADABLE directory on the chain — a question that could not be answered",
        refused: true,
        arrange: (root) => {
            fs.mkdirSync(path.join(root, SEGMENT));
            fs.chmodSync(path.join(root, SEGMENT), 0o000);
            try {
                fs.lstatSync(path.join(root, REL));
            } catch (cause) {
                if (cause.code === "EACCES" || cause.code === "EPERM") return undefined;
                return `the locked directory raised ${cause.code} rather than EACCES`;
            }
            return "the locked directory is still readable — this suite is running as a user chmod does not bind (root?), so this case would report green having established nothing";
        },
        skipParent: true,
    },
];

describe("the collision contract — every carrier answers the same", () => {
    for (const { what, refused, arrange, skipParent } of CONTRACT) {
        for (const { tool, ask } of CARRIERS) {
            test(`${tool}: ${what}`, async () => {
                const root = scratch();
                if (!skipParent) fs.mkdirSync(path.join(root, SEGMENT), { recursive: true });
                const precondition = await arrange(root, SERVERS);
                assert.equal(precondition, undefined, `precondition: ${precondition}`);
                assert.equal(
                    ask(root, REL),
                    refused,
                    refused
                        ? `${tool} permitted a write into ${what} — the refusal has to stand ahead of the first byte`
                        : `${tool} refused a path that is genuinely absent`,
                );
            });
        }
    }
});

function modules(dir = HERE, prefix = "") {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) out.push(...modules(path.join(dir, entry.name), rel));
        else if (entry.name.endsWith(".mjs") && !entry.name.endsWith(".test.mjs")) out.push(rel);
    }
    return out;
}

const EXPORTS_COLLISIONS_DIRECTLY =
    /export\s+(?:async\s+)?(?:function\s*\*?|const|let|var|class)\s+collisions\b|export\s*\{[^}]*\bcollisions\b[^}]*\}/;
const STAR_EXPORT = /export\s*\*\s*from\s*["']([^"']+)["']/g;

function exportsCollisions(rel, seen = new Set()) {
    if (seen.has(rel)) return false;
    seen.add(rel);
    let src;
    try {
        src = fs.readFileSync(path.join(HERE, rel), "utf8");
    } catch {
        return false; // a star export naming something absent re-exports nothing
    }
    if (EXPORTS_COLLISIONS_DIRECTLY.test(src)) return true;
    for (const [, target] of src.matchAll(STAR_EXPORT)) {
        if (!target.startsWith(".")) continue;
        const next = path.relative(HERE, path.resolve(path.dirname(path.join(HERE, rel)), target));
        if (!next.startsWith("..") && exportsCollisions(next, seen)) return true;
    }
    return false;
}

describe("the roster is pinned too", () => {
    test("exactly three modules under cli/ export a `collisions`, and this suite asserts all three", () => {
        // A name matcher: a fourth copy of the rule under another name passes unseen.
        const found = modules()
            .filter((rel) => exportsCollisions(rel))
            .sort();
        assert.deepEqual(found, ["init.mjs", "new.mjs", "vendor.mjs"]);
        assert.deepEqual(
            CARRIERS.map((c) => c.tool).sort(),
            found,
            "a `collisions` exists under cli/ that this contract does not assert",
        );
    });
});
