# 2026-09-09 — Both tiers are named and dated, and the phrase that was neither is retired

Off the milestone row. No row moves. One bullet in the Protocol, on the maintainer's ruling, closing
the residue [#409](https://github.com/sleepy-panda-srl/portulan/pull/409) left open for him.

## The question he was asked, and the answer

`docs/plan.md`'s Protocol read **`Implementer: Opus 4.8-class`**. The phrase landed in `c353a308`, this
repository's bootstrap commit of 2026-07-24 — itself signed `Claude Opus 4.8` — and stood unchanged
through **612 commits whose trailers read `Claude Opus 5`** — 786 if the id-form `claude-opus-5` is
counted too, and the two spellings do not overlap. So `-class` was doing one of two jobs and nobody had
said which: a **capability floor** ("at least this capable", satisfied by Opus 5 and correct as written), or
a **name** written when 4.8 was the implementer and never updated.

The two readings cost different things, which is why it was put to him rather than guessed. A floor
needs the word saying so, because `-class` carries the whole claim unmarked. A name needs replacing.

> **His ruling, 2026-09-09: "Implementer is now Opus 5 and supervisor is Fable 5.1."**

A name, then, and now current.

## Why this was his and not an implementer's

#409's first cut named Opus 5 in a sentence of its own, two lines under `Opus 4.8-class`, which made the
bullet name the implementer twice — the shape
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md) names. Copilot caught it. The
withdrawal was the right move and it had a cost, recorded there and paid here: **the doctrine went
silent on the implementer's current model** while the supervisor tier had a dated carrier and the
implementer tier had a July phrase. That asymmetry is what this closes.

Any wording that put `Opus 5` beside `Opus 4.8-class` had to state how the two related, and stating the
relation *was* the ruling — which is the whole reason an implementer could not write it.

## What the bullet says now

Both tiers named once each, both dated, in one carrier:

> As of **2026-09-09**: implementer **Opus 5**, supervisor **Fable 5.1**
> — the supervisor tier's rule being *strongest available model*, ALWAYS in a fresh context (subagent or
> separate session, never sharing the implementer's context). **This line is the one live carrier of both
> names**, each quoted from its own running context's system prompt rather than from the name a caller
> passed or from a commit trailer, which records the session's configured attribution and not the model
> that ran.

_(Twice wrong, and the second time is the better lesson. It first quoted the bullet **as drafted**,
before the pre-commit fold rewrote it — a quotation going stale when its subject moved. Re-copying fixed
that and left an **ellipsis**, which Copilot then read as still not verbatim, correctly: an excerpt
presented under prose claiming it matches the file. It is now generated from `docs/plan.md` by the
change that writes it, not transcribed, so it cannot disagree. A quotation is a figure like any other,
and the fix for a figure is to derive it.)_

**Both names are quoted, not inferred, and the distinction cost a correction.** The supervisor's line
was read by a fresh-context checkpoint from inside its own system prompt: *"You are powered by the model
named Fable 5.1. The exact model ID is `claude-fable-5-1`."* The implementer's is read the same way, from
this session's own: *"You are powered by the model named Opus 5."*

**And a commit trailer is not that.** The same checkpoint observed that its own system prompt — while
identifying it as Fable 5.1 — instructs it to end commit messages `Co-Authored-By: Claude Opus 5`. So a
trailer records **the session's configured attribution, not the model that produced the text**. That
qualifies a figure this change and #409 both lean on: 612 is a count of trailers, and a trailer is
evidence of how a session was configured. It is still the right illustration of how long the phrase
stood, and it is not evidence of which model ran. The candidate rail in the residue must therefore read
system prompts and never trailers — which is the opposite of the cheap implementation.

Three properties kept from #409 rather than re-argued: the **carrier/record distinction** (a record says
what was true on its day and never moves; a carrier is what a reader consults and moves when the fact
does), the rule that **earlier records keep the name they were signed with**, and the measurement
discipline — each name read from a system context rather than from the alias a caller passed, since the
Agent tool takes `fable` and the harness resolves the version.

[`0018`](../proposals/0018-a-verdict-from-the-context-that-did-the-work-is-not-a-verdict.md) needed **no
change**: its **live sentence** names no model and cites the Protocol, which is exactly the repair #409
made to it, working. (Its dated correction note quotes three model names, as a record does.)

## Residue

- **`-class` is gone as a spelling, and no rule replaced it.** The Protocol now pins a name for the
  implementer and states a rule plus a name for the supervisor. Whether the implementer tier should also
  carry a floor — *"at least this capable"* — is not answered here; his ruling named a model, and
  inventing a band around it would be the same overreach in the other direction.
- **Nothing checks either name.** A model name is not derivable from the tree, so no rail reads this
  line; it goes stale the next time the harness moves a model. Named in #409's handoff, still not built,
  and now twice as much surface: two names instead of one. The cheap candidate is unchanged — a session
  asking each context to quote its own system prompt and failing when the answer differs from this line.
- **Two of #409's residue items are still open**, and this closes only the ruling. Its out-of-tree note
  still says *"Fable 5 supervises ONLY"* — read today, unchanged, and not this diff's to edit — and
  *which resolved model signed each record between 2026-08-18 and 2026-09-02* remains undemonstrated,
  now for the sharper reason above: the trailers that would answer it record configuration.
- **One sentence changed rather than was kept.** #409's Copilot-driven *"the rule is what binds; the
  name is what happens to meet it today"* is folded into the em-dash form the same reviewer proposed;
  the three properties listed above are the ones carried verbatim.
- **The 612 figure is a measurement, not a tally kept by hand:**
  `git log c353a308..origin/main --grep="Claude Opus 5" --format=%H | wc -l`. It will drift the moment
  anything merges, which is why the sentence gives the command and treats the number as an illustration
  of the gap rather than a fact to maintain.
