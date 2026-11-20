# Proposal 0043 — a prose use earns its place by a record of its own

**Status. DRAFT — prepared 2026-11-20 for Marius Cetanas. Not accepted; nothing here is ruled.**
Extends [`0039`](0039-a-local-model-runs-without-the-host-floor-and-under-a-thinking-cap.md) clause 4
(loopback is a rail; routing is earned) and the pattern of
[`0042`](0042-find-and-quote-reading-earns-its-place-by-its-own-record.md) (a use is earned on a record
of its own) to the second local model, the one behind `--role prose`.

**Pull request:** https://github.com/sleepy-panda-srl/portulan/pull/684

---

## Incident — the second local model carries no work

The maintainer, 2026-11-20, in a consumer workspace: "The local LLMs that I have: Gemma 4 and Qwen3.8
should be used, both of them, not just one."

Today only one is used. The pack routes two roles: `code` (`qwen/qwen3.8-27b`), which the
[captured record](../../evals/ab/local-worker.md) supports for a verify-gated transform and, since
0042, for find-and-quote reading; and `prose` (`google/gemma-4-31b`), which is disabled. `summarize`
defaults to `prose` and refuses, and the skill keeps every digest and draft in the parent session.

## What exists, and the gap

- **The record measured `prose` on two tasks.** `codify` (draft a proposal from memory entries): arm L
  0 of 5, arm H 3 of 5. `handoff` (compress a session into a handoff of at most 800 bytes with
  `## Did`, `## Open` and `## Next`, keeping every named token): arm L 5 of 5, arm H 5 of 5.
- **The rule frozen before those outcomes** ([acquisition note](../../evals/ab/local-worker-acquisition.md),
  "Rule frozen before outcomes") says: "The shared prose role requires **both** codify and handoff."
  One task failed, so the whole role is off, and the task that passed carries no work.
- **A use can already be earned on its own.** 0042 gave reading a record of its own
  (`evals/ab/local-reader.json`), a rule fixed before its outcomes, and an entry in `EARNED_ROUTING`
  that [`cli/local-routing.mjs`](../../cli/local-routing.mjs) derives from that record and nothing else.

**The gap:** there is no way for one prose use to be supported while another is not. And the handoff
cell cannot simply be switched on: doing so after seeing which cell passed would change a rule that was
fixed before the outcomes, which is the thing that rule exists to prevent.

## Proposed rule

1. **A use of the prose model is earned on a record of its own**, as reading was: its own task, its own
   grader with no judgement in it, `k = 5` per arm, and the qualifying rule fixed before outcomes (all
   five local turns pass, all five host turns complete, local passes at least host passes; a tie at
   zero earns nothing).
2. **The shared `prose` role stays disabled.** `--role prose` and a bare `summarize` keep refusing. A
   supported use is reached by naming the use, not the role, so nothing that was not measured rides in
   with it.
3. **Hand-off drafts are the first use to earn.** The existing handoff cell (5 of 5 against 5 of 5) is
   evidence that the capture is worth making. It is not the earning record: that record is captured
   fresh, under this proposal's rule.
4. **A supported prose use stays behind a check the caller runs.** For a hand-off draft that check is
   the one the grader makes: the size limit, the three sections, every named token present. A draft
   that fails it is discarded and the parent writes the handoff.
5. **`codify` stays unsupported** until a record says otherwise; nothing here re-runs it.

## Enforcement — the record, and what would capture it

- **A record per use**, beside the two that exist and touching neither: for hand-off drafts,
  `evals/ab/local-handoff.json` with its generated register, captured by `eval --ab --task handoff`
  under the refusals, rails and journal rules the other captures apply. A turn is one call, so arm H is
  **five paid host calls**.
- **`eval --verify` covers it when it exists** and reports it as not captured when it does not; an
  absent record earns nothing and is not a failure.
- **`EARNED_ROUTING` gains an entry for the use** only from a qualifying record, derived by
  `cli/local-routing.mjs`, as for reading.
- **The command** for a supported use names it (for example `summarize --use handoff`), sends the
  use's own prompt shape, and refuses anything else on the prose model.

**What is built today, and what is not.** The `handoff` task, its prompt, its required tokens and its
grader exist in the runner and its screen. Nothing else in this section exists: no record per prose
use, no capture path for one, no `--use`, no routing entry. They would arrive in the change that
follows the maintainer's rulings, as 0042's did.

## Questions for the maintainer

1. **Hand-off drafts: a record of their own (five paid host calls), or switch them on from the cell
   already captured?** This draft proposes a record of their own, because the existing rule was fixed
   before the outcomes and tied the two tasks together.
2. **Which further uses of the prose model should get a screen, so they can be earned later?**
   Candidates, each needing a fixture and a grader with no judgement in it before any capture: a first
   pass over changed wording that flags a string for a language review; sorting a failed check run
   into "seen before" or "new" from its log; saying whether a change touches text a person reads; a
   digest of a long log that quotes its lines.
3. **Should a supported prose use be named on the command line** (`summarize --use handoff`), keeping
   `--role prose` refused, as proposed, or should `--role prose` come back once any one use is earned?

---

**Provenance.** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/blob/b67e0095/evals/ab/local-worker.md` —
the captured record: `codify` L0/H3, `handoff` L5/H5.

**Retire when.** The maintainer rules on the three questions: the use is earned or declined, and the
skill says which.

**Decision.** Pending: Marius Cetanas.
