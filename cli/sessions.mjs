// The session switches' texts: the five-minute cache lifetime `init` offers and `upgrade` prints, and the
// one line `doctor` reports on every session switch a manifest declares.
//
// Workspace Definition 2.11 added `sessions`, and `compile` writes its `cache_lifetime` into a repository's
// `.claude/settings.json` as Claude Code's `promptCacheTtl` (`../core/operating/sessions.md`). Nothing told a
// repository outside this one that the key exists. Unset, Claude Code writes the cache for an hour on a
// subscription and for five minutes on an API key, and a cache test on 2026-09-24 measured Portulan's own
// tasks, run straight through: five-minute writes cut a boot's cost by 22 to 30% and an edit's by about 18%
// against one-hour writes, and no run paused five minutes. So `init` offers the lifetime, `upgrade` prints
// the offer until the manifest declares one, and `doctor` says where every switch stands. Proposal `0038`,
// item 4 of its order of work, *`init`'s offer* (`../.portulan/proposals/0038-what-a-change-spends-is-measured.md`).
//
// **The offer is the five-minute lifetime and nothing else**, as decided for this change on 2026-09-24.
// Dropping the git instructions removes what a session that commits needs (`sessions.md`), and `headless`
// is read only by Portulan's own runners, which the package does not ship (`../spec/slots.md`). The
// multipliers are a note and not a question: `0038` has `init` offer them from the host's pricing or a dated
// per-host table, and that table is its own change, made from a local session because it names models. The
// trade-off is printed beside the reason, because five minutes is the dearer lifetime for a session that
// pauses.
//
// **Offered, never written by the offer.** `init` writes the key where a person chose it, by a flag, an
// answers file or a yes at its question, and never writes `.claude/settings.json`: `compile` is that file's
// one writer. `upgrade` prints the offer and writes nothing for it.
//
// Texts only: nothing here reads a disk or writes one. The one line `doctor` prints reads the manifest it
// is handed, which `doctor` has already held to the schema, and still never throws, since a report that
// crashed would take the rest of `doctor`'s findings with it.

/** The cache lifetime on offer, in three parts: what it is, why, and what it costs a session that pauses. */
export const LIFETIME_OFFER = Object.freeze({
    what:
        'five-minute cache writes: `"sessions": { "cache_lifetime": "5m" }` in the manifest, at Workspace Definition 2.11 or later, ' +
        "which `portulan compile` writes into .claude/settings.json as `promptCacheTtl`; unset, Claude Code writes for an hour on a " +
        "subscription and for five minutes on an API key, where this changes nothing",
    reason:
        "A five-minute cache write costs 1.25 times an uncached input token where an hour's costs 2. On Portulan's own tasks, run " +
        "straight through, five-minute writes cut the cost of a boot by 22 to 30% and of an edit by about 18% against an hour's " +
        "(measured 2026-09-24).",
    tradeOff:
        "A pause of over five minutes between two requests, while a person reads or a review or CI runs, writes the whole context " +
        "again at 1.25 times where an hour's lifetime reads it back at a small fraction of that; in a long session one such pause " +
        "can cost more than every write the shorter lifetime saved, so it suits sessions that work straight through.",
});

/** The sentence that closes the offer: declaring either lifetime is what stops `upgrade` printing it. */
export const OFFER_ENDS = 'Declare "1h" to keep an hour\'s lifetime and end this offer.';

/**
 * What `init` says of the multipliers, and asks nothing about: `0038`'s ruling 2 has the manifest declare
 * them, and the key that does, `spend.multipliers`, arrives at 2.12. The tenth is `./ledger.mjs`'s
 * `GENERAL_READ`.
 */
export const MULTIPLIERS_NOTE =
    "The restart advisory and the ledger price a cache read at a tenth of an uncached input token, the general figure, until " +
    "`spend.multipliers` (Workspace Definition 2.12) declares your model's own; a model's reads cost between a fortieth and a " +
    "tenth, and the tenth puts the restart line early, the cheaper way to err.";

/**
 * The offer as `init` and `upgrade` print it, one line each, unprefixed: each caller adds its own `init: ` or
 * `upgrade: `, as it does to every line it prints, and the lines after the first are indented under it.
 *
 * `asking` is `init`'s question: the same three texts before the prompt, with no word that nothing is
 * written and no closing sentence, since the answer is what ends the offer.
 */
export function offerLines({ asking = false } = {}) {
    const { what, reason, tradeOff } = LIFETIME_OFFER;
    if (asking) return [`${what[0].toUpperCase()}${what.slice(1)}.`, `  ${reason}`, `  ${tradeOff}`];
    return [`offered, and not written — ${what}`, `  ${reason}`, `  ${tradeOff}`, `  ${OFFER_ENDS}`];
}

const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const figure = (v) => typeof v === "number" && Number.isFinite(v);

/** What a declared `headless` object declares, switch by switch, and nothing it leaves to the host. */
function headlessWords(headless) {
    const words = [];
    if (typeof headless.cache_lifetime === "string") words.push(headless.cache_lifetime);
    if (headless.git_instructions === false) words.push("without git instructions");
    if (headless.git_instructions === true) words.push("with git instructions");
    if (headless.exclude_dynamic_sections === true) words.push("with the per-machine sections in the first message");
    if (headless.exclude_dynamic_sections === false) words.push("with the per-machine sections in the system prompt");
    return words.length ? `headless runs ${words.join(", ")}` : "headless runs the host's defaults";
}

/**
 * The declared multipliers in `doctor`'s words, or null where the manifest declares none. `spend` is
 * Workspace Definition 2.12's key, and its multipliers are `{ read, write: { "5m", "1h" } }`: the writes are
 * printed as the pair `5m/1h`, in the order the schema lists them, and only as a pair, since a lone figure
 * after the slash would not say which lifetime it prices. Read defensively: `doctor`'s own checks hold each
 * figure to its range, this line says what is declared, and a figure that is not a number is left out
 * rather than printed.
 */
function multipliersWords(multipliers) {
    if (!plain(multipliers)) return null;
    const write = plain(multipliers.write) ? multipliers.write : {};
    const words = [];
    if (figure(multipliers.read)) words.push(`read ${multipliers.read}×`);
    if (figure(write["5m"]) && figure(write["1h"])) words.push(`writes ${write["5m"]}×/${write["1h"]}×`);
    return words.length ? `multipliers declared, ${words.join(" and ")}` : "multipliers declared";
}

/** The declared horizon, `spend.horizon.requests`, in `doctor`'s words, or null where none is declared. */
function horizonWords(horizon) {
    if (!plain(horizon)) return null;
    const { requests } = horizon;
    return figure(requests) ? `a horizon of ${requests} request${requests === 1 ? "" : "s"}` : "a horizon declared";
}

/**
 * `doctor`'s one line on the session switches: the cache lifetime, the git instructions, the headless runs
 * where declared, the multipliers, and the horizon where declared. **One line**, because a session that runs
 * `doctor` reads its output, and every line of it is read again on every later request.
 *
 * Where a `repository` workspace leaves the lifetime to the host, the line ends by naming where the offer is
 * printed, since `doctor` is where a person looks and `upgrade` is what prints the offer with its
 * trade-off. Never throws: a manifest it cannot read reads as one declaring nothing.
 */
export function sessionsLine(manifest) {
    const workspace = plain(manifest) ? manifest : {};
    const sessions = plain(workspace.sessions) ? workspace.sessions : {};
    const spend = plain(workspace.spend) ? workspace.spend : {};
    const lifetime = typeof sessions.cache_lifetime === "string" ? sessions.cache_lifetime : null;

    const parts = [
        lifetime === null
            ? "cache lifetime the host's default, an hour on a subscription and five minutes on an API key"
            : `cache lifetime ${lifetime}, compiled as \`promptCacheTtl\``,
        sessions.git_instructions === false
            ? "git instructions off"
            : sessions.git_instructions === true
              ? "git instructions on"
              : "git instructions the host's default",
    ];
    if (plain(sessions.headless)) parts.push(headlessWords(sessions.headless));
    parts.push(multipliersWords(spend.multipliers) ?? "multipliers the general ones");
    const horizon = horizonWords(spend.horizon);
    if (horizon !== null) parts.push(horizon);
    if (lifetime === null && workspace.kind === "repository") {
        parts.push("`portulan upgrade` prints the five-minute lifetime's offer and its trade-off");
    }
    return parts.join("; ");
}
