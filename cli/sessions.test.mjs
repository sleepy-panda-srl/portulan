// `sessions` — the cache lifetime's offer, the multipliers' note, and `doctor`'s one line on the session switches.
//
//   node --test "cli/**/*.test.mjs"
//
// The texts, against the facts they state: the key in the offer is one the manifest takes and `compile`
// writes, the version it names is the one `sessions` arrived at, and the figures are the ones the ledger
// prices with. Then `doctor`'s line, switch by switch, on manifests built here. What `init`, `upgrade` and
// `doctor` do with them, on trees they really wrote, is in `init.test.mjs`, `upgrade.test.mjs` and
// `doctor.test.mjs`.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CACHE_LIFETIMES } from "./compile.mjs";
import { GENERAL_READ, WRITE_BY_LIFETIME } from "./ledger.mjs";
import { LIFETIME_OFFER, MULTIPLIERS_NOTE, OFFER_ENDS, offerLines, sessionsLine } from "./sessions.mjs";

// A HERMETIC HOST. `sessions` never asks the host where packs are installed, but this suite imports
// `./compile.mjs`, which can, so it neutralises the installed-plugin record the way every suite in that
// closure does. Swept by `pinned-roots.live.test.mjs`, whose header carries the argument.
const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The line `doctor` prints for a manifest that declares no switch, by kind. */
const DEFAULTS = "cache lifetime the host's default, an hour on a subscription and five minutes on an API key; git instructions the host's default; multipliers the general ones";
const TO_UPGRADE = "; `portulan upgrade` prints the five-minute lifetime's offer and its trade-off";

describe("the offer states what is true of the key it offers", () => {
    test("the key in the offer is JSON the manifest takes, at a lifetime `compile` writes", () => {
        // The code span is the one thing an adopter copies, so it is parsed rather than read: a typo in it
        // would be a manifest `doctor` refuses, handed over by the tool that offered it.
        const span = /`("sessions": \{[^`]*\})`/.exec(LIFETIME_OFFER.what);
        assert.ok(span, "the offer names the key in a code span");
        const declared = JSON.parse(`{${span[1]}}`);
        assert.deepEqual(declared, { sessions: { cache_lifetime: "5m" } });
        assert.ok(CACHE_LIFETIMES.includes(declared.sessions.cache_lifetime), "the offered lifetime is one `compile` writes");
    });

    test("the version it names is the one `sessions` arrived at, as the slot reference says", () => {
        const slots = fs.readFileSync(path.join(REPO, "spec", "slots.md"), "utf8");
        const section = slots.slice(slots.indexOf("## `sessions`"));
        const since = /Added at \*\*(\d+\.\d+)\*\*/.exec(section)?.[1];
        assert.ok(since, "spec/slots.md says when `sessions` was added");
        assert.match(LIFETIME_OFFER.what, new RegExp(`at Workspace Definition ${since.replace(".", "\\.")} or later`));
    });

    test("it names the command that writes the setting, the setting, and the host's two defaults", () => {
        assert.match(LIFETIME_OFFER.what, /`portulan compile` writes into \.claude\/settings\.json as `promptCacheTtl`/);
        assert.match(LIFETIME_OFFER.what, /unset, Claude Code writes for an hour on a subscription and for five minutes on an API key, where this changes nothing$/);
    });

    test("the multipliers it states are the ones the ledger prices a threshold with", () => {
        // A figure in prose beside a constant is two carriers of one fact; this pins the prose to the constant.
        assert.equal(WRITE_BY_LIFETIME["5m"], 1.25);
        assert.equal(WRITE_BY_LIFETIME["1h"], 2);
        assert.match(LIFETIME_OFFER.reason, /^A five-minute cache write costs 1\.25 times an uncached input token where an hour's costs 2\./);
        assert.match(LIFETIME_OFFER.tradeOff, /writes the whole context again at 1\.25 times/);
        assert.equal(GENERAL_READ, 0.1);
        assert.match(MULTIPLIERS_NOTE, /price a cache read at a tenth of an uncached input token, the general figure/);
    });

    test("the reason carries its measurement and its date, and the trade-off says who it suits", () => {
        assert.match(LIFETIME_OFFER.reason, /cut the cost of a boot by 22 to 30% and of an edit by about 18% against an hour's \(measured 2026-09-24\)\.$/);
        assert.match(LIFETIME_OFFER.tradeOff, /^A pause of over five minutes between two requests/);
        assert.match(LIFETIME_OFFER.tradeOff, /so it suits sessions that work straight through\.$/);
    });

    test("the multipliers' note names the key that declares them and asks nothing", () => {
        assert.match(MULTIPLIERS_NOTE, /until `spend\.multipliers` \(Workspace Definition 2\.12\) declares your model's own/);
        assert.doesNotMatch(MULTIPLIERS_NOTE, /\?/);
    });

    test("the texts are frozen, so no caller can reword the offer for everyone", () => {
        assert.ok(Object.isFrozen(LIFETIME_OFFER));
    });
});

describe("the offer as `init` and `upgrade` print it", () => {
    test("what, the reason, the trade-off, and the sentence that ends it, one line each", () => {
        const lines = offerLines();
        assert.deepEqual(lines, [
            `offered, and not written — ${LIFETIME_OFFER.what}`,
            `  ${LIFETIME_OFFER.reason}`,
            `  ${LIFETIME_OFFER.tradeOff}`,
            `  ${OFFER_ENDS}`,
        ]);
        assert.equal(OFFER_ENDS, 'Declare "1h" to keep an hour\'s lifetime and end this offer.');
        assert.ok(lines.every((l) => !l.includes("\n")), "a line a caller prefixes is one line");
    });

    test("before `init`'s question it is the same three texts, and nothing says it is not written", () => {
        const lines = offerLines({ asking: true });
        assert.equal(lines.length, 3);
        assert.match(lines[0], /^Five-minute cache writes: `"sessions"/);
        assert.ok(lines[0].endsWith("where this changes nothing."));
        assert.deepEqual(lines.slice(1), [`  ${LIFETIME_OFFER.reason}`, `  ${LIFETIME_OFFER.tradeOff}`]);
        assert.ok(lines.every((l) => !/not written|end this offer/.test(l)), "the answer is what ends it, and a yes writes it");
    });
});

describe("doctor's one line on the session switches", () => {
    test("nothing declared: the host's defaults and the general multipliers, and a repository is sent to the offer", () => {
        assert.equal(sessionsLine({ kind: "repository" }), `${DEFAULTS}${TO_UPGRADE}`);
        assert.ok(sessionsLine({ kind: "repository" }).length < 300, "the common case stays well under a long line");
    });

    test("a workspace that is no repository is not sent to `upgrade`, which prints the offer only to one", () => {
        for (const kind of ["demo", "portfolio"]) assert.equal(sessionsLine({ kind }), DEFAULTS);
    });

    test("a declared lifetime is named with the setting it compiles to, and ends the pointer to the offer", () => {
        for (const lifetime of CACHE_LIFETIMES) {
            const line = sessionsLine({ kind: "repository", sessions: { cache_lifetime: lifetime } });
            assert.ok(line.startsWith(`cache lifetime ${lifetime}, compiled as \`promptCacheTtl\`; `), line);
            assert.ok(!line.includes("portulan upgrade"), `${lifetime}: a declared lifetime is the offer answered`);
        }
    });

    test("the git switch says off, on, or the host's default", () => {
        const git = (value) => sessionsLine({ kind: "repository", sessions: { cache_lifetime: "1h", git_instructions: value } }).split("; ")[1];
        assert.equal(git(false), "git instructions off");
        assert.equal(git(true), "git instructions on");
        assert.equal(git(undefined), "git instructions the host's default");
    });

    test("headless is said only where declared, and only what it declares", () => {
        const headless = (declared) => sessionsLine({ kind: "repository", sessions: { cache_lifetime: "5m", headless: declared } }).split("; ")[2];
        assert.equal(headless({ cache_lifetime: "5m", git_instructions: false }), "headless runs 5m, without git instructions");
        assert.equal(headless({ exclude_dynamic_sections: true }), "headless runs with the per-machine sections in the first message");
        assert.equal(headless({ git_instructions: true, exclude_dynamic_sections: false }), "headless runs with git instructions, with the per-machine sections in the system prompt");
        assert.equal(headless({}), "headless runs the host's defaults");
        assert.ok(!sessionsLine({ kind: "repository", sessions: { cache_lifetime: "5m" } }).includes("headless"));
    });

    test("declared multipliers are named with their figures, and a horizon only where declared", () => {
        // `spend`'s shape at Workspace Definition 2.12: `{ multipliers: { read, write: { "5m", "1h" } }, horizon: { requests } }`.
        const spend = { multipliers: { read: 0.05, write: { "5m": 1.25, "1h": 2 } }, horizon: { requests: 30 } };
        const line = sessionsLine({ kind: "repository", sessions: { cache_lifetime: "5m" }, spend });
        assert.equal(line, "cache lifetime 5m, compiled as `promptCacheTtl`; git instructions the host's default; multipliers declared, read 0.05× and writes 1.25×/2×; a horizon of 30 requests");
        assert.ok(!sessionsLine({ kind: "repository", spend: { multipliers: spend.multipliers } }).includes("horizon"));
        assert.match(sessionsLine({ kind: "repository", spend: { horizon: { requests: 1 } } }), /; multipliers the general ones; a horizon of 1 request;/);
    });

    test("it never throws, and a manifest it cannot read is one declaring nothing", () => {
        for (const manifest of [undefined, null, "a manifest", [], { sessions: "on", spend: 3 }, { sessions: [], spend: { multipliers: [], horizon: "30" } }]) {
            assert.equal(sessionsLine(manifest), DEFAULTS, JSON.stringify(manifest));
        }
    });

    test("a figure that is not a number is left out rather than printed, and a write only prints beside its pair", () => {
        assert.match(sessionsLine({ spend: { multipliers: { read: "0.05", write: { "5m": null, "1h": 2 } } } }), /; multipliers declared$/);
        assert.match(sessionsLine({ spend: { multipliers: { read: 0.05, write: { "1h": 2 } } } }), /; multipliers declared, read 0\.05×$/);
        assert.match(sessionsLine({ spend: { multipliers: { read: 0.05, write: [1.25, 2] } } }), /; multipliers declared, read 0\.05×$/);
        assert.match(sessionsLine({ spend: { horizon: { requests: "30" } } }), /; a horizon declared$/);
    });

    test("it is one line, whatever is declared", () => {
        const everything = {
            kind: "repository",
            sessions: { git_instructions: false, headless: { cache_lifetime: "5m", git_instructions: false, exclude_dynamic_sections: true } },
            spend: { multipliers: { read: 0.025, write: { "5m": 1.25, "1h": 2 } }, horizon: { requests: 20 } },
        };
        const line = sessionsLine(everything);
        assert.ok(!line.includes("\n"));
        assert.match(line, /; multipliers declared, read 0\.025× and writes 1\.25×\/2×; a horizon of 20 requests; `portulan upgrade`/);
    });
});
