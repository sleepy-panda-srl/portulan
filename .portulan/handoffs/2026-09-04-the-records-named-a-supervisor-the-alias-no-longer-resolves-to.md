# 2026-09-04 — The records named a supervisor the alias no longer resolves to, and the citation named two homes with nothing in either

Off the milestone row. No row moves. A two-sentence currency fix that turned out to carry a broken
citation, and a much larger sweep that was asked for and is deliberately **not** done.

## What was asked, and why the answer is one sentence rather than a hundred and sixty-two

The instruction was to sweep the records to say **Fable 5.1**. Counted at `6e8a5ed0` with
`git grep -o Fable -- '*.md' '*.mjs' '*.json' '*.yml'`: **162 occurrences on 158 lines**, counted by line:
`docs/plan.md` 72, the handoff series 59, four task files 9, seven across the milestone files, one memory
record and one test comment — plus nine proposals, of which one is the live sentence this change
repairs.

**The Session log entries and the signed Status verdicts are not rewritten**, and the reason is the
Protocol's own words. A milestone closes with *"the supervisor, the date, and the verdict in one
clause"*. Re-attributing a signed verdict to a model that did not give it does not make the record
current; it makes it **false**. `evals/goldens/skills/codify.json` and `clarify.json` already carry the
neighbouring rule for merged records — *not an implementer's to rewrite* — and it holds here for the
stronger reason that these particular records exist to say **who checked**.

**The other categories were checked rather than assumed, and they are records too.** The nine proposals
name Fable in Decision lines and provenance; the four task files name it in checkpoint sections; the
memory entry names it in a provenance stamp; the test comment quotes a historical string. A pre-commit
checkpoint swept the tree independently for a **live** carrier — a present-tense rule, a legend, a
template, a persona, a pack, a gate-map sentence — and found exactly one, which is the one this change
touches.

**And for part of the window neither answer is verifiable.** Commit trailers carry the id `claude-fable-5` on **22 commits, 2026-07-29 to
2026-08-18**, and the `Claude Fable 5` name-form from 2026-07-25 to the same day; the tree does not
record when the alias began resolving to 5.1. _(An earlier draft said "through August", overstating by
thirteen days, and rested it on handoff `2026-08-18-the-brief-was-wrong-about-its-own-mechanism.md` —
which records `claude-fable-5` as the **implementer's** context in a session that ran the roles the wrong
way round, and so is evidence about the wrong tier.)_ For late-August sessions, leaving a signed record as signed is the only move that fabricates
nothing.

## The one live carrier, and the two things wrong with it

`.portulan/proposals/0018` — accepted doctrine — said:

> That Opus 5 implements and Fable 5 supervises is customer zero's instantiation, recorded in
> `docs/plan.md`'s protocol and in `identity.md`.

**Wrong on the citation, in both halves.** Measured at `6e8a5ed0`: `identity.md` names **no model at
all**, and the Protocol named only the implementer's band (*Opus 4.8-class*) with *"strongest available
model"* for the supervisor. So one cited carrier did not exist and the other held half the fact. That is
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)'s class arriving as a
**citation** rather than as an enforcement site, and it is the more interesting of the two defects: a
fact claimed to have two homes, with nobody having opened either.

**Stale on the supervisor's name.** The checkpoint subagents this repository runs are requested by the
**alias** `fable` — the Agent tool's `model` parameter accepts `sonnet | opus | haiku | fable` and
nothing else — and the resolved model, asked to quote its own system context, answers *"You are powered
by the model named Fable 5.1. The exact model ID is claude-fable-5-1."* Confirmed independently by the
pre-commit supervisor from inside its own context.

**What is NOT claimed:** that `claude-fable-5` has stopped resolving. A session can request a model by
id; only the checkpoint subagent is requested by alias. Whether that id still works was **not measured**
— a probe failed to authenticate — so no carrier here says it does not. An earlier draft of this handoff
was titled *"a supervisor nobody can request"*, which asserted exactly that.

## The repair

The **Protocol** now carries the instantiation, dated, in two sentences: which models fill the two tiers,
and that earlier records keep the name they were signed with. `0018` names **no model** and cites the
Protocol, with the correction preserved as a dated note rather than applied silently — this file is a
merged record, and the note is how a live doctrinal sentence changes without the original disappearing.
`identity.md` is left naming no model, deliberately: a workspace's identity slot answers *who and with
what*, and the model line belongs beside the two-tier protocol that reads it.

## Residue, and one question for the maintainer

- **`Opus 4.8-class` is left standing, and calling it a "capability band" is being generous.** The line
  landed in `c353a308` (2026-07-24), whose own trailer is `Claude Opus 4.8`; Opus 5 has signed **610**
  commits since — `git log c353a308..6e8a5ed0 --grep="Claude Opus 5" --format=%H | wc -l`, the command
  given because an earlier draft of this bullet printed **216**, a number nobody ran. It reads as a band and was written as a pin. The instruction covered the supervisor and
  the sentence is the maintainer's, so it is left — **but the Protocol bullet now names the implementer
  twice, which is the shape `0020` names.** *His ruling wanted: delete it, or keep it as a band and say
  so.*
- **Nothing checks the new line.** It goes stale the next time the harness moves a model, and no rail can
  read it — a model name is not derivable from the tree. A recorded limit is not a managed one
  ([`a-recorded-limit-is-not-a-managed-limit`](../memory/a-recorded-limit-is-not-a-managed-limit.md)).
  The cheap candidate — a session asking its supervisor to quote its system context, as this one did, and
  redding when the answer differs from the Protocol — is **named and not built**.
- **This branch is off `main`, not stacked on #408, and it WILL conflict with it.** Measured:
  `git merge-tree --write-tree` exits **1**, conflicting in `docs/plan.md` and
  `.portulan/handoffs-index.md` — both branches append a Session log entry at the tail and both
  regenerate the index. The resolution is mechanical, and its two halves are carried in two places: **regenerate, never
  hand-merge** is stated in the index file's own generated header, and *keep both entries* is the
  maintainer's out-of-tree branch-conventions memory. _(An earlier draft attributed both to
  [`a-branch-syncs-with-main-before-it-merges`](../memory/a-branch-syncs-with-main-before-it-merges.md),
  which names neither — a wrong pointer, in the change whose subject is a wrong pointer. A 2026-09-01
  Session log entry makes the same loose citation; a precedent for it is not a licence.)_

  _(Two drafts of this bullet were wrong, in opposite directions, and the second is the instructive one.
  The first predicted a clean rebase **without running the merge at all**. The second nearly retracted a
  supervisor's correct finding on a run of `git merge-tree HEAD …` that exited 0 — because the work was
  **staged and not committed**, so `HEAD` was still `origin/main` and the command had merged two
  branches neither of which held this change. Committing the index to a scratch object with
  `git commit-tree $(git write-tree)` and merging **that** gives exit 1. `merge-tree` reads a commit; an
  index is not one. Same shape as this repository's standing rule to re-measure the package on a clean
  checkout rather than in a working tree — a measurement taken against the wrong object reports
  confidently about something nobody asked.)_
- **Out of tree, and left standing:** the maintainer's own memory file
  `portulan-supervised-build.md` states *"Fable 5 supervises ONLY"* as a present-tense rule. Not this
  diff's to change; named so it is not missed.
- **Undemonstrated:** which resolved model signed each record between 2026-08-18 and 2026-09-02.
