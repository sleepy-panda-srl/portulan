**type:** decision
**scope:** workspace — the `portulan` repository
**provenance:** [`../../docs/plan.md`](../../docs/plan.md), locked decision 2 and the milestone-0 exit
criterion; verified against the live remote at the milestone-0 close and again in milestone 1, session 3.

`sleepy-panda-works/portulan` went **public on 2026-07-27**, on the maintainer's explicit direction —
the flip was always an authorization, not work, and the authorization was his to give. *(Amended
2026-07-27: the retire-when below fired and the rule inverted per its own clause — the successor rule
is what this entry now carries.)* **It was flipped back to private on 2026-08-03**, again on his
direction. *(Amended 2026-08-10; the ruling that authorised this amendment is the block below.)*

**The successor rule, as ruled 2026-08-10:** the window 2026-07-27 → 2026-08-03 **was** world-readable,
and every commit pushed inside it is permanently out — cloned, cached or indexed, and not recallable.
The repository is **private again**, and the pre-commit seam scan ([`../dod.md`](../dod.md), condition
5) binds **harder than it ever did while public**, not less: nothing client-derived may enter any
surface — files, messages, branches, PR text — even transiently. **Private again is not a licence to
relax it.** Three reasons, and any one of them is sufficient: the published window cannot be
unpublished; visibility is a live setting that has already moved twice; and a scan kept only while the
repository is public stops exactly when it is cheapest to keep.

**Why it holds:** the flip is one-way *in the sense that matters*, and the flip-back is the proof rather
than the refutation. Once a history is public it cannot be made private again in any sense that matters
— it may already be cloned, cached, or indexed. On 2026-08-03 the **setting** moved back; the
**exposure** did not. So visibility sits in the Gated tier ([`../gate-map.md`](../gate-map.md)) and the
default is the recoverable direction.

**When to apply:** before anything that would widen visibility — flipping the repository, forking it into
a public organisation, publishing a package that embeds its contents, or pasting its files anywhere
public. **And before assuming this repository is reachable — it is not.** Measure rather than recall:
`gh repo view sleepy-panda-works/portulan --json isPrivate,visibility,forkCount`, plus an
unauthenticated `GET`, which is the negative control.

**RULED — 2026-08-10. This block replaces the 2026-08-08 surfacing.** That consolidation pass measured
the contradiction and deliberately refused to pick a winner, on the grounds that a pass silently
resolving one *"would have made a policy decision wearing the clothes of housekeeping"*. The refusal was
correct, and it is what carried the question to the maintainer; he commissioned the resolution on
2026-08-10. This entry is that ruling landing — not a housekeeping pass. Measured the same day rather
than recalled: `private=true`, `visibility=private`, `forks=0`, `allow_forking=false`, and an
unauthenticated `GET /repos/{owner}/{repo}` returns **404** from both `api.github.com` and `github.com`.

- **The tense it asked about** — this record describes **a past window plus a standing posture**, never a
  state that tracks the current setting. The window is history; the posture is that the seam scan binds
  whichever way the setting points. Both are written above in those terms.
- **The Retire-when it asked about** — it still reads correctly, and the second flip is why. See below.

**Retire when:** it had read *"the public flip completes"* — that condition fired 2026-07-27 and
produced this successor per its own clause. The successor states a permanence no condition can
un-fire, and the 2026-08-03 flip-back **tested exactly that**: the setting reverted and the successor
did not, because what it asserts is about the published window rather than the current visibility.
Retire only by written supersession.
