**type:** decision
**scope:** workspace — the `portulan` repository
**provenance:** [`../../docs/plan.md`](../../docs/plan.md), locked decision 2 and the milestone-0 exit
criterion; verified against the live remote at the milestone-0 close and again in milestone 1, session 3.

`sleepy-panda-works/portulan` went **public on 2026-07-27**, on the maintainer's explicit direction —
the flip was always an authorization, not work, and the authorization was his to give. *(Amended
2026-07-27: the retire-when below fired and the rule inverted per its own clause — the successor rule
is what this entry now carries.)* **The successor rule:** history is public and permanent from here;
every commit is world-readable the moment it is pushed, so the pre-commit seam scan
([`../dod.md`](../dod.md), condition 5) binds harder than it ever did while private, and nothing
client-derived may enter any surface — files, messages, branches, PR text — even transiently.

**Why it holds:** the flip is one-way in practice. Once a history is public it cannot be made private
again in any sense that matters — it may already be cloned, cached, or indexed — so visibility sits in
the Gated tier ([`../gate-map.md`](../gate-map.md)) and the default is the recoverable direction.

**When to apply:** before anything that would widen visibility — flipping the repository, forking it into
a public organisation, publishing a package that embeds its contents, or pasting its files anywhere
public.

**SURFACED, NOT RESOLVED — 2026-08-08.** This record says the repository *"went public"* and reasons in
the present tense from that. **It is private.** Measured rather than recalled: `private=true`,
`visibility=private`, `forks=0`, and an unauthenticated `GET /repos/{owner}/{repo}` returns **404**. The
flip back happened 2026-08-03, and the window 2026-07-27 → 2026-08-03 was world-readable.

**The consolidation pass does not pick a winner here**, per its own rule: a pass that silently resolved
a contradiction would have made a policy decision wearing the clothes of housekeeping. So the
measurement is written down and the ruling is the maintainer's. What is worth saying is that the
substance below **strengthens** rather than weakens: a public window that has closed is still a window,
clones cannot be recalled, and *"once a history is public it cannot be made private again in any sense
that matters"* is exactly the sentence the flip-back does not undo. What needs his ruling is the tense —
whether this record now describes a state, a past window, or a standing posture — and whether the
**Retire when** below still reads correctly against a repository that has flipped twice.

**Retire when:** it had read *"the public flip completes"* — that condition fired 2026-07-27 and
produced this successor per its own clause. The successor states a permanence no condition can
un-fire; retire only by written supersession.
