# 2026-09-02 — The cap was keyed to an identity the host was free to rotate

Milestone 8, out-of-band, third of the day. No row moves. **This is the actual defect**; the two changes
before it repaired the wrong layer, and one of them repaired a problem that did not exist.

## What was measured, after three wrong diagnoses

The probe was never hanging on onboarding, and after `3924e563` the seed reached both locations and the
host merged it — `hasCompletedOnboarding=true`, 18 keys. Run in that same isolated environment,
`claude -p` returns in **0.6 seconds**. The arm's `Stop` hook returns in **0.1 seconds**.

What the probe left behind was **85,839 hook invocations and 6,985 distinct counter files**.

`counterFile()` keys the per-reason and per-session counters by `session_id`. **This host issues a new
session id per retry**, so each refusal opened a fresh counter, every consecutive count restarted at
zero, and neither `MAX_BLOCKS` nor `MAX_TOTAL_BLOCKS` was ever reached. Not a hang — a **livelock**, and
this module's own comment names the outcome: *a Stop-gate that cannot stop is not a gate, it is a hang.*

## The platform already answered this, and the answer was documented and never read

`stop_hook_active` appears in this file's own list of payload fields and is read nowhere. It is true
exactly when the stop being judged was provoked by a hook block, so it identifies the **retry chain**
without reference to any session id — the one identity the host cannot rotate underneath the gate.

`MAX_CHAIN_BLOCKS = 12`, counted in a file keyed to the **tree** rather than the session. Cleared on a
stop nothing provoked; incremented on one a hook provoked. It is set **above** `MAX_TOTAL_BLOCKS`
deliberately, so a session whose id is stable always meets the specific caps first and their messages,
not this one, are what a person normally reads. Reaching this bound is itself a finding about the host,
and the release message says so.

**And *"the tree"* meant `REPO` in the first cut, not the tree being judged.** `bumpChain` called
`chainFile()` without a root, so every session shared one file whatever `resolveSessionTree(payload.cwd)`
had resolved — and this gate answers about another worktree often enough to carry a branch for it. Two
arms, or an arm and this repository, contended on one chain: one tree's retries could spend another's
budget or release it early. **My own reproduction ran that way**, keyed to this worktree rather than to
the arm it was measuring. The docblock said *keyed to the tree* while the code keyed to a constant —
the same overclaim shape, in the sentence describing the fix for it. Copilot round 2.

**Deliberately the one piece of gate state two sessions in a worktree share.** The per-session counters
are keyed apart precisely so one session cannot disarm another's gate; this is keyed together precisely
so it can see a chain no session id survives. The tension is real and stated rather than smoothed over.

## Measured, not reasoned

- **The livelock terminates.** A fresh session id on every retry — the exact condition that produced the
  85,839 — releases at retry 14.
- **Ordinary sessions are untouched.** A stable session id still blocks three times and releases on the
  fourth, still naming *the cap of 3 consecutive refusals for `handoff`*.
- Three mutations fail the suite: removing the backstop (5 cases), setting it below the specific caps so
  it pre-empts them (3), and counting every stop rather than the provoked ones (3).

## What this does NOT do

**It does not discharge `acceptedUnder.reRunWhen`**, and no turn has yet completed. The livelock is
bounded now; whether a completed turn reports `met: true` is unmeasured, and the host's cached config
still reads `out_of_credits`.

**It bounds the loop rather than removing its cause.** The agent still retries under a rotating id and
still cannot accumulate a per-reason count; the specific caps remain blind on such a host. Making them
see it would mean keying them on something else, which is a larger question about what identity a
session *is* — put here rather than answered.

**No rail covers the livelock.** The bound is exercised by unit cases and by the reproduction above; no
recipe drives a real host through a rotating-id retry, because none can without spawning an agent.

## And the three wrong causal claims are the record worth keeping

Enumerated, because three carriers of this session carried three different counts of them and a reviewer
had to point that out:

1. **`stdio` — the child inherits the terminal** (#404). **False**, measured: `spawnSync` defaults to
   `pipe`, so the child always got a pipe that EOFs at once; only an explicit `"inherit"` hands over a
   terminal.
2. **The unseeded home and its first-run flow** (#404). Real on 2.1.215–2.1.226 and **not the cause
   here**: the probe still hung after the seed landed and the host merged it.
3. **The seed landing in the file the host stopped reading** (#405). A genuine defect on 2.1.251, worth
   fixing on its own, and **still not the cause**.

**And *"the whole cause"* was claimed twice** — in #404 and again in #405 — which is the error underneath
all three: a mechanism published on the strength of one symptom disappearing, with no measurement
isolating it. The symptom disappeared both times because a different turn was being watched. _(This
section said "three" while its own last sentence said "twice" and `docs/plan.md` said "two". Three claims,
two of them announced as final. Both numbers were right about different things and neither said which.)_
