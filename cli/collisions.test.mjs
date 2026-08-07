// The collision contract — one rule, three carriers, pinned together.
//
//   node --test "cli/**/*.test.mjs"
//
// Three tools in this CLI write files into a tree somebody else owns, and all three answer the same
// question first: **is something already at the path I am about to write?** `init.mjs`, `new.mjs` and
// `vendor.mjs` each export a `collisions()` that answers it, with three different signatures, three
// different return shapes and three different refusal vocabularies — because each was copied from the
// one before it and then grew.
//
// ## Why this suite exists rather than a fourth implementation
//
// A rule holds where it is enforced. Three enforcement sites are three chances to repair one and leave
// the others, which is the class [#91](https://github.com/sleepy-panda-works/portulan/issues/91) names
// and the standing ruling of 2026-07-27 forbids — *"never ship a change that corrects one wrong claim
// while knowingly leaving its neighbours"*. It is not hypothetical here: on
// [#164](https://github.com/sleepy-panda-works/portulan/pull/164) round 4 found a directory sitting at a
// leaf that `vendor`'s preflight passed and `writeFileSync` then threw `EISDIR` on, the shape had been
// copied from `new.mjs`, and the fix had to land in two files; round 12 then found the same collision
// reached from the source side, eight rounds later, in a rule the same change had written two rounds
// earlier.
//
// The repair this repository reaches for first is to leave **one** site — `cli/doctor.mjs` imports one
// frontmatter parser rather than minting a second, `cli/vendor.mjs` asks the real `doctor` for a verdict
// rather than forming a second opinion, and `#164`'s own `scan()` yields files and directories from one
// descent so the guards cannot come to differ. That repair is not available here without a shared module
// none of the three wants: the signatures differ because the callers differ — `init` writes a drafted
// map, `new` writes one artifact, `vendor` copies a workspace and carries an allow-list for the carve-out
// none of the others has.
//
// So this suite does the second-best thing, which `cli/doctor.test.mjs` already models where
// `--repo-root` and `--pack-root` are asserted together *"so a future divergence reds here rather than
// drifting"*: it names the behaviour all three owe and asserts it of each. **It was green on the day it
// landed and that is the point** — it establishes nothing new about the tree. What it converts is an
// agreement currently held by three independent accidents into one that goes red when it stops being
// held.
//
// ## What it establishes, and what it cannot
//
// It establishes that each carrier answers **the seven states below** identically — refusing six and
// permitting the one that is genuinely absent — measured against a real filesystem rather than argued
// from the source. **Across those seven the three diverge only in their sentences and in their internal
// shape, and this suite deliberately pins neither**: the vocabularies are written for three different
// readers, and a test that froze them would stop the refusals being improved. What is pinned is the
// answer.
//
// **The scoping in that sentence is load-bearing, and was bought the hard way.** An earlier draft of
// this header claimed the three agree full stop. They do not. **An eighth state divides them:** where
// the destination root is *itself* a symlink and the leaf below it is absent, `init` **permits** — its
// walk starts below the target and never lstats the root — while `new` and `vendor` **refuse**, their
// chains being inclusive of the root. Measured, not reasoned about. It is deliberately NOT a row in the
// contract below: adding it would land this suite red, and which reading of *at or below the named
// path* is right is a behaviour question for the maintainer, filed as the first measured exhibit on the
// `collisions()` unification issue. **An agreement is a property of the states somebody checked**, which
// is this suite's own subject turned on itself — it was found by the pre-commit checkpoint running the
// sibling-sweep step this same change ships.
//
// It also pins the **roster**, and the roster pins a NAME rather than a rule. A fourth module in `cli/`
// exporting something called `collisions` reds the last test in this file. What no matcher can see is a
// fourth implementation of the same rule under a different name — which is precisely the finding the
// proposal this suite belongs to arrives at: a rule has no token. The roster is the cheap half, and it
// is worth having because a copy is nearly always a copy in name too.
//
// It cannot establish that the three *sentences* are right, that any caller uses its carrier correctly,
// or that the allow-list `vendor` alone carries is sound — that one is `cli/vendor.test.mjs`'s, since a
// contract shared by three may only name what all three have.

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

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ONE exit handler for every scratch directory, not one each — ./new.test.mjs records why, and
// ./init.test.mjs records what ignoring it cost.
const SCRATCH = [];
// Sockets outlive their assertion on purpose — closing one unlinks the leaf it IS — so they are closed
// here, after every test has run and before the trees they sit in are removed.
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
        // `lstatSync` and a real-directory test BEFORE the chmod, and the reason is this suite's own
        // subject. `chmodSync` FOLLOWS symlinks, and in the symlink-on-the-chain case this very path IS
        // a symlink to `os.tmpdir()` — so the unguarded form reached outside the scratch tree and
        // chmod'd the system temp directory, which on a user-owned tmpdir would have succeeded. The one
        // rule these three carriers exist to enforce — never a call that resolves a link — broken in the
        // cleanup of the suite that pins it. Copilot, round 1 on #168.
        //
        // Only the EACCES case locks a directory and only that case needs unlocking before removal.
        // (`rmSync` recursive is safe here: it unlinks a symlink rather than descending through it.)
        const locked = path.join(dir, SEGMENT);
        try {
            if (fs.lstatSync(locked).isDirectory()) fs.chmodSync(locked, 0o755);
        } catch {
            /* absent, or already gone — nothing to unlock */
        }
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

// **A short prefix, deliberately, and `realpath` deliberately too.** The socket case binds at
// `<scratch>/slot/leaf.md`, and a unix socket path is capped near 104 bytes — so every byte spent on a
// descriptive prefix is a byte of headroom given away on a platform whose tmpdir is already long. With
// `portulan-collisions-` this measured **96 of 104** on macOS; `pcol-` measures **81**, which is the same
// suite with 23 bytes of slack instead of 8. The cost is that a stray scratch directory is less
// self-identifying, which is worth less than the suite running everywhere.
//
// `os.tmpdir()` is kept rather than hard-coding `/tmp`, on two grounds. It is the platform's and the
// operator's declared choice — CI images move it for disk and cleanup reasons — and, more to the point
// here, **`/tmp` is itself a symlink on macOS**: rooting a suite whose whole subject is symlink handling
// on a symlinked base is how a test starts passing for the wrong reason. `realpathSync` for the same
// reason, so the chain a carrier walks contains only the links this suite put there on purpose.
function scratch() {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "pcol-"));
    SCRATCH.push(dir);
    return dir;
}

// The leaf every case is about, one directory down, so the chain has a segment above the leaf to put a
// symlink on. Every carrier is asked about a path it would WRITE, which is the only shape any of them
// plans: all three walk a list of files.
const REL = "slot/leaf.md";
const SEGMENT = REL.split("/")[0];

/**
 * The three carriers, each reduced to the one question they share.
 *
 * The adapters exist because the signatures differ, and the differences are real rather than accidental
 * — `init` is handed the drafted file map it is about to write, `new` a list of absolute destinations
 * plus the root that bounds the walk, `vendor` a destination directory and the relative paths under it.
 * Each returns a different record shape, so the adapter reduces all three to a boolean: **did this
 * carrier report a collision at all**. Everything below the boolean is each tool's own and is not pinned
 * here.
 */
const CARRIERS = [
    { tool: "init.mjs", ask: (root, rel) => initCollisions(root, new Map([[rel, "contents"]])).length > 0 },
    { tool: "new.mjs", ask: (root, rel) => newCollisions([path.join(root, rel)], root).length > 0 },
    { tool: "vendor.mjs", ask: (root, rel) => vendorCollisions(root, [rel]).length > 0 },
];

/**
 * The states a destination can be in, and what every carrier owes for each.
 *
 * `arrange` may return a precondition failure as a string; a case that could not be set up **fails**
 * rather than passing, per ../.portulan/memory/verify-preconditions-fail-closed.md — a check that
 * silently stops checking where it matters is worse than none, and the EACCES case is precisely where a
 * root-run suite would otherwise report green having established nothing.
 */
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
        // #164 round 4: the exemption for an existing directory is right for the intermediate segments
        // and wrong at the leaf, and the write threw EISDIR mid-copy — the preflight's whole promise,
        // broken by the check that keeps it.
        arrange: (root) => fs.mkdirSync(path.join(root, REL)),
    },
    {
        what: "a SYMLINK at the leaf",
        refused: true,
        // Refused rather than resolved: deciding whether a link's target is "really" inside the intended
        // tree is a containment judgement with a bad failure mode, where refusing has none. `init` wrote
        // nine files outside a repository and reported success before this rule existed.
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
        // #164 round 13. `walk()` refuses a FIFO, a socket or a device node in the source and the
        // destination's allowed leaves were the half that did not, so a later read would BLOCK rather
        // than fail. A path this planner only ever writes files to is a collision whatever else is there.
        //
        // **A socket rather than a FIFO, and the reason is a decision this repository had already made.**
        // `cli/vendor.test.mjs` covers this rule with a stubbed `lstat` and says why in as many words:
        // not with `mkfifo`, "which needs a shell-out and is not portable to every runner this suite has
        // to pass on". The first draft here shelled out anyway — a recorded decision carried at one site
        // and not at the next, which is this suite's own subject, found by Copilot round 2 on #168.
        //
        // The stub route that file uses is not available to a contract shared by three: only `vendor`'s
        // signature takes an injectable `lstat`. A **unix domain socket** answers both problems at once —
        // `net` creates one with no shell and no external tool, and it is a *thing that is not a file* by
        // the same test a FIFO is. Measured: all three carriers refuse it, and `lstatSync` reports
        // `isFile: false, isDirectory: false, isSymbolicLink: false`, which is the shape the rule turns on.
        //
        // The one real constraint is the socket path's ~104-byte limit. Measured at **96 bytes** on macOS,
        // whose per-user tmpdir is a fixed-length shape, and ~60 bytes of headroom on a Linux runner where
        // `TMPDIR` is `/tmp`. If it ever binds too long the precondition says so with the byte count
        // rather than failing as a mystery.
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
            // `unref` so an open handle cannot keep the runner alive; closed at exit, because closing it
            // here would UNLINK the socket and remove the very leaf being asserted on.
            server.unref();
            servers.push(server);
        },
    },
    {
        what: "an UNREADABLE directory on the chain — a question that could not be answered",
        refused: true,
        // The only-ENOENT rule: an EACCES is not an absence, and answering it "nothing there" is
        // "nothing looked" reported as "nothing wrong". Three of #164's thirteen rounds were this rule
        // missing from one site while the same change stated it three times in its own header.
        //
        // `chmod` is the wrong lever where a stub is available — root ignores it — and only `vendor`'s
        // signature takes an injectable `lstat`, so a contract shared by three has to use the real
        // filesystem. It therefore CHECKS that the arrangement took, and fails loudly when it did not.
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

/** Every non-test `.mjs` under `cli/`, at any depth. */
function modules(dir = HERE, prefix = "") {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) out.push(...modules(path.join(dir, entry.name), rel));
        else if (entry.name.endsWith(".mjs") && !entry.name.endsWith(".test.mjs")) out.push(rel);
    }
    return out;
}

// **FIVE spellings have got past this matcher, each measured against it rather than imagined**, and the
// list grew twice because two separate reviewers went looking:
//   1-3. `export const collisions = …`, a bare declaration re-exported by `export { collisions }`, and a
//        module in a SUBDIRECTORY of `cli/` — found by the pre-commit checkpoint.
//   4-5. `export function* collisions()` — a GENERATOR, which `function\s+collisions` does not match —
//        and `export * from "./init.mjs"`, an aggregate re-export that exposes a fourth module's
//        binding without ever naming it. Found by the Fable 5 supervisor, getting past the widened
//        matcher that had just been written to close the first three.
// Both rounds are the same lesson and it is this suite's own: **a hole list is a claim like any other,
// and the only thing that checks it is somebody trying to defeat it.** The list below is therefore
// stated as what has been TRIED, never as what is covered.
const EXPORTS_COLLISIONS_DIRECTLY =
    /export\s+(?:async\s+)?(?:function\s*\*?|const|let|var|class)\s+collisions\b|export\s*\{[^}]*\bcollisions\b[^}]*\}/;
const STAR_EXPORT = /export\s*\*\s*from\s*["']([^"']+)["']/g;

/**
 * Whether a module exports a `collisions` binding, directly or through a star re-export.
 *
 * **The star case is RESOLVED rather than assumed, and the first cut assumed.** Treating every
 * `export * from …` as a carrier reds this suite for any barrel re-export that has nothing to do with
 * `collisions` — a false red, introduced in the very change that closed the false negative, which is the
 * over-correction this repository has already paid for once (a matcher that could not tell a persona
 * disclaiming *Prohibited* from one claiming it). Copilot found it on the merging head.
 *
 * A star export therefore counts only when the module it names transitively exports `collisions`.
 * `seen` bounds the walk, since a cycle of re-exports is a program that does not run but is a file set
 * that could still be written.
 */
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
        if (!target.startsWith(".")) continue; // a bare specifier is not a module under cli/
        const next = path.relative(HERE, path.resolve(path.dirname(path.join(HERE, rel)), target));
        if (!next.startsWith("..") && exportsCollisions(next, seen)) return true;
    }
    return false;
}

describe("the roster is pinned too", () => {
    test("exactly three modules under cli/ export a `collisions`, and this suite asserts all three", () => {
        // The half a behavioural contract cannot supply on its own. A fourth copy of this shape is how
        // the third came to differ from the first, and a copy nothing asserts is invisible to every test
        // above. Whoever adds one reds here and has two honest ways out: add it to CARRIERS, or call an
        // existing carrier instead — which is the repair this repository reaches for first.
        //
        // **What this cannot see, stated rather than left to be discovered.** A fourth implementation of
        // the same rule under a DIFFERENT NAME: no matcher reaches that — a rule has no token — and the
        // proposal this suite belongs to is largely about why. And, more modestly, any same-name
        // spelling nobody has thought to try yet: five have been found so far, three by one reviewer and
        // two by another *after* the matcher was widened for the first three. So this is a list of
        // attempts, not a proof of coverage. The roster is the cheap half, kept because a copied shape is
        // nearly always copied under its own name too.
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
