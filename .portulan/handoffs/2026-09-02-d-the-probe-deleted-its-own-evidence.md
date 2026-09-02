# 2026-09-02 — The probe deleted its own evidence, and counted a killed run's firings as this one's

Milestone 8, out-of-band, fourth of the day. No row moves. Two defects in `cli/ab.mjs`'s stop probe,
found by trying to diagnose a timeout and discovering there was nothing left to diagnose it with.

## The timeout that says nothing

After `4b64c762` the probe **ends** instead of sitting silent: `ETIMEDOUT` after five minutes, reported
as could-not-run rather than as `met: false`. That much is right and is what the last three changes bought.

But `ETIMEDOUT` alone cannot distinguish **the agent never reached a stop** from **the agent stopped
hundreds of times and was sent back**. Those are opposite defects — one is the credential or the host,
the other is a gate that will not let go — and telling them apart is what the last three sessions were
spent on. The datum that settles it is the receipt's line count, and `restore()` deletes the receipt
unconditionally, by design, so a probed arm is still the arm that was constructed.

**So after a refusal there is nothing on disk to say what happened.** It was recovered once today only
because an interrupted run happened to skip `finally`. Every refusal now reports the count and what it
means: zero points at the agent, a large number at the gate.

## And the count was wrong when it survived

**The receipt is never truncated.** The recorder only appends, and `restore()` runs in `finally` — which
an interrupted run never reaches. So a probe in an arm where an earlier probe was killed counts that
earlier run's firings too. Measured: an arm carrying a killed run's receipt reported **4,582 firings for
a stub that fired none**.

This is not only the new diagnostic's problem. **The success path counts the same file** — so `met: true`
would have published an inflated invocation count, in the one record row 8's close reads, and the
condition that inflates it is exactly the one this session kept creating by pressing Ctrl-C. Truncated at
probe start now.

## The last carrier of a false claim, removed

`ab.mjs` still said *"the seed below is the whole cause of the hang"* — #404's claim, wrong, and it
survived two further repairs because neither touched that line. The cause was the livelock in
`stop-gate.mjs`. Corrected, with the count of how many causal claims preceded the right one.

## What is still owed

**`acceptedUnder.reRunWhen` is not discharged.** No turn has completed. The host's cached config reads
`cachedExtraUsageDisabledReason: "out_of_credits"`, and the probe's five-minute budget elapsed without a
stop — but *why* is precisely what could not be read, which is why this change exists. The next refusal
will say.

**Nothing here was measured against a real host.** The counts are exercised with stand-in agents; no test
spawns `claude`, deliberately, since one would spend a real turn inside a verify recipe.

## Copilot round 1: the diagnostic shadowed the thing it was diagnosing

The helper was named `stops`, and `stops` was already bound at the top of `armStopProbe` to the compiled
Stop-hook **array** — the binding two lines use as `stops.length` and `stops[0]`. Inside the `try` the
name resolved to the helper, so a later edit reaching for `stops[0]` would have got `undefined` from a
zero-arity function rather than a hook, and silently: a function has a `.length` too, and it is `0`.

Renamed to `firingNote`. Not a stylistic tidy — the failure it prevents is the same shape as everything
else in this arc, a name that reads as one thing and resolves to another.
