// The session switches' texts: the cache-lifetime offer `init` and `upgrade` print, and the one line `doctor` reports on them.

export const LIFETIME_OFFER = Object.freeze({
    what:
        'five-minute cache writes: `"sessions": { "cache_lifetime": "5m" }` in the manifest, at Workspace Definition 2.11 or later, ' +
        "which `portulan compile` writes into .claude/settings.json as `promptCacheTtl`; unset, Claude Code writes for an hour on a " +
        "subscription within its usage limits and for five minutes on an API key, where this changes nothing",
    reason:
        "A five-minute cache write costs 1.25 times an uncached input token where an hour's costs 2. On Portulan's own tasks, run " +
        "straight through, five-minute writes cut the cost of a boot by 22 to 30% and of an edit by about 18% against an hour's " +
        "(measured 2026-09-24).",
    tradeOff:
        "A pause of over five minutes between two requests, while a person reads or a review or CI runs, writes the whole context " +
        "again at 1.25 times where an hour's lifetime reads it back at a small fraction of that; in a long session one such pause " +
        "can cost more than every write the shorter lifetime saved, so it suits sessions that work straight through.",
});

export const OFFER_ENDS = 'Declaring either lifetime ends this offer; on an API key "5m" is already the host\'s default.';

/** The offer's lines, unprefixed: each caller adds its own `init: ` or `upgrade: `. */
export function offerLines({ asking = false } = {}) {
    const { what, reason, tradeOff } = LIFETIME_OFFER;
    if (asking) return [`${what[0].toUpperCase()}${what.slice(1)}.`, `  ${reason}`, `  ${tradeOff}`];
    return [`offered, and not written — ${what}`, `  ${reason}`, `  ${tradeOff}`, `  ${OFFER_ENDS}`];
}

const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const figure = (v) => typeof v === "number" && Number.isFinite(v);

function headlessWords(headless) {
    const words = [];
    if (typeof headless.cache_lifetime === "string") words.push(headless.cache_lifetime);
    if (headless.git_instructions === false) words.push("without git instructions");
    if (headless.git_instructions === true) words.push("with git instructions");
    if (headless.exclude_dynamic_sections === true) words.push("with the per-machine sections in the first message");
    if (headless.exclude_dynamic_sections === false) words.push("with the per-machine sections in the system prompt");
    return words.length ? `headless runs ${words.join(", ")}` : "headless runs the host's defaults";
}

function multipliersWords(multipliers) {
    if (!plain(multipliers)) return null;
    const write = plain(multipliers.write) ? multipliers.write : {};
    const words = [];
    if (figure(multipliers.read)) words.push(`read ${multipliers.read}×`);
    // Only as a pair: a lone figure would not say which lifetime it prices.
    if (figure(write["5m"]) && figure(write["1h"])) words.push(`writes ${write["5m"]}×/${write["1h"]}×`);
    return words.length ? `multipliers declared, ${words.join(" and ")}` : "multipliers declared";
}

function horizonWords(horizon) {
    if (!plain(horizon)) return null;
    const { requests } = horizon;
    return figure(requests) ? `a horizon of ${requests} request${requests === 1 ? "" : "s"}` : "a horizon declared";
}

/** `doctor`'s line on the session switches: one line, since a session reads it again on every request; never throws. */
export function sessionsLine(manifest) {
    const workspace = plain(manifest) ? manifest : {};
    const sessions = plain(workspace.sessions) ? workspace.sessions : {};
    const spend = plain(workspace.spend) ? workspace.spend : {};
    const lifetime = typeof sessions.cache_lifetime === "string" ? sessions.cache_lifetime : null;

    const parts = [
        lifetime === null
            ? "cache lifetime the host's default, an hour on a subscription within its usage limits and five minutes on an API key"
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
    if (spend.restart === "block") parts.push("a turn's end held once at the restart threshold");
    if (lifetime === null && workspace.kind === "repository") {
        parts.push("`portulan upgrade` prints the five-minute lifetime's offer and its trade-off");
    }
    return parts.join("; ");
}
