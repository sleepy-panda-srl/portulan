**type:** rule
**scope:** workspace — every session working in this repository
**provenance:** `form=link` `href=https://github.com/sleepy-panda-works/portulan/pull/5`
— the maintainer's ruling, Marius Cetanas, 2026-07-25, taken after milestone 1 session 3 produced the
first handoff and the question was raised whether one is warranted per session or only when useful.

Every session ends with a dated handoff in [`../handoffs/`](../handoffs/). Short is fine; absent is not;
an exception is a last resort rather than a judgement call.

**Why it holds:** a discretionary version of this rule — *write one when it's needed* — is prose that
cannot be turned into a rail, because no gate can evaluate whether skipping was warranted. Only a binary
rule compiles into machinery. The failure modes are also asymmetric: an unnecessary handoff costs five
lines, while a skipped one loses decisions-and-why permanently, and nobody notices until a later session
re-litigates a settled decision. The no-ceremony-that-can't-scale-down non-goal is satisfied *inside* the
artifact — a handoff may be five lines — not by omitting it.

**When to apply:** at every session close, without asking whether this session earned one. Uniformity is
also what makes the series machine-consumable: correspondence between the Session log and the handoff
series is checkable, and a complete series is what the librarian can mine.

**Applies forward only, and the boundary is a cutoff rather than a list:** the series begins with the
sessions that close *after* this rule landed on `main`. Everything earlier — the bootstrap session, both
earlier milestone-1 sessions, and the constitution session — has no handoff and is not backfilled,
because a handoff written after the fact fabricates a contemporaneous artifact from a session nobody is
still in, and would add nothing: the *why* is precisely what a later writer cannot reconstruct. Those
sessions' record stays in the pull-request descriptions and the Session log. Stating the boundary as a
date rather than naming sessions is deliberate — an enumerated exemption is a checker's bug waiting to
happen, and the first draft of this entry named two sessions when four lacked handoffs.

**A gate enforces this since milestone 4.** [`../compile/stop.mjs`](../compile/stop.mjs) blocks the end of
a session that changed something and has no handoff dated today. It checks **existence and a date, never
length or shape** — which is the whole reason the rule was written in that checkable form. Two limits
kept honest: it releases after three consecutive refusals **of this reason** — the missing handoff keeps
its own count, cleared only by a handoff appearing, so it no longer rides to the ceiling of nine on the
strength of a green recipe (the asymmetry the maintainer named on 2026-07-27, removed in milestone 4
session 1) — and it judges "changed something" by the working tree and
the branch, so a session whose work was all conversation owes nothing. The librarian that mines a
complete series is milestone 5. Related:
[`readme-map-must-match-shape.md`](readme-map-must-match-shape.md) — the same preference for a rail over
a reminder, in that case already built.

**Retire when:** the handoff stops being the place decisions-and-why are recorded — for instance if a
later mechanism captures rationale automatically and verifiably, at which point this rule should move
rather than simply be dropped.
