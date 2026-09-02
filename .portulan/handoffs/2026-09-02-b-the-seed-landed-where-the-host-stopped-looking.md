# 2026-09-02 — The seed landed where the host stopped looking

Milestone 8, out-of-band, second of the day. No row moves. This is the repair the earlier one
([`2026-09-02-the-probe-hung-on-an-unseeded-home.md`](2026-09-02-the-probe-hung-on-an-unseeded-home.md))
should have been: the probe **still hung** after that change merged as `ca39daa2`.

## What the hung probe's own leftovers said

`seedOperator` wrote `$HOME/.claude.json` and it was still sitting there afterwards, untouched, carrying
exactly its three keys. The host meanwhile had created **`$CLAUDE_CONFIG_DIR/.claude.json` itself**,
carrying `firstStartVersion: "2.1.251"`, `migrationVersion: 13` — and **no `hasCompletedOnboarding`**.

So with `CLAUDE_CONFIG_DIR` set, this host reads and writes the config-dir copy and never consults
`$HOME`'s. The onboarding flow ran, `-p` had nobody to answer it, and the hang survived the repair meant
to end it. **Diagnosed from artefacts on disk rather than from a rerun**, which is the only evidence
available when the failure is silence.

## The repair that had gone stale

`$HOME/.claude.json` alone was **measured sufficient on 2.1.215–2.1.226** — session 6d's measurement, and
correct when it was taken. The host is now **2.1.251**. `../repos/portulan.md` already carries the
standing instruction this fell to: *re-measure host behaviour at the next upgrade.* Nobody did, and the
earlier change moved that stale repair from one module to another without re-measuring it.

**Both locations are written now, and deliberately not one chosen by version.** A version test here would
be a hand-maintained figure of a subject that has already moved once, inside a file that cannot see the
host it is about to spawn. Seeding a location the host ignores costs a few bytes in a directory thrown
away after the turn; seeding the wrong one costs a ten-minute hang and, last time, a published repair
with the wrong cause. The targets are **derived from `isolatedEnv`** rather than re-typed — two
hand-written copies of one layout is how these drifted apart to begin with.

## What I got wrong, again, and it is the same shape

The earlier change said the seed was *"the whole cause of the hang"*. **It was necessary and
insufficient**, and I said it with more confidence than one hang's disappearance could support — having
just been corrected for exactly that on the same change, where I published a false mechanism in six
carriers. The hang had not disappeared; it had moved out of the first turn I happened to watch.

## What is still owed

**`acceptedUnder.reRunWhen` is not discharged and this does not discharge it.** No turn has completed.
Two things stand between here and an answer, and only one is a defect:

- The account reads `cachedExtraUsageDisabledReason: "out_of_credits"` in the host's own cached config,
  and an earlier attempt returned `401 OAuth access token is invalid`. Whether a real turn can be bought
  at all is the maintainer's question, not a measurable one from inside a session that holds no
  credential.
- Whether the seed is **now** sufficient is unmeasured. It is verified to land where `isolatedEnv` sends
  the turn; that the host is satisfied by it on 2.1.251 is the thing only a completed turn can show.

**No rail covers any of this.** `--stop-probe` spawns a real agent, so nothing in the recipe set runs it;
the four mutations checked here are over `seedOperator`'s own behaviour, not over the host's reading of
it.
