# Handoff — a round gets its definition, and three records get their errata

**Date:** 2026-07-30 · **Doctrine — no milestone row touched** · Branch
`a-review-round-gets-its-definition`

**State.** `a-review-loop-needs-a-bound.md` has built a four-rule bound on counting rounds since
2026-07-28 without ever defining one. It does now, on the maintainer's ruling of 2026-07-30: **a round is
a Copilot review this session answers with a push**, and a records-only correction counts. Applying it,
[#105](https://github.com/sleepy-panda-works/portulan/pull/105) received **four** — two past the bound —
and its three merged carriers, which had said two, three and two, are corrected: visibly-marked errata on
the handoff, the count fixed in the Session log. **The pull-request body is not yet corrected**; it is
outward and awaits his go-ahead. Nothing in `cli/` moved.

## The question was put before anything was edited, and that was the point

The disagreement was relayed with a count already measured — eight Copilot submissions on
`/pulls/105/reviews` — and an instruction to rule on the definition first. That ordering earned its keep
twice, and neither would have survived editing-first:

- **Eight is not the answer either.** The relay's own figure is the submission count, and submissions
  count *pushes*: `review_on_push: true` means every push draws one, including the one on the branch as
  opened, before any fix exists to answer with. A session that had gone straight to correcting the records
  would have written **eight** into three carriers and been wrong a fourth way, with the errata spent.
- **Neither written number was a misreading.** `git log -S` dates them: *two* entered at `e09a49a` at
  15:20 UTC, *three* at `384a17d` at 15:57, and the fourth fix push landed at 16:04. Each was a true
  snapshot of a count still moving. There was no error to find in the reading, which is why no amount of
  re-measurement would have settled it and only a definition could.

## Decisions + why — the reasons are the payload

- **A round is a push, not a submission — because rule 1 already said so and rule 4 inherited it.** Rule 1
  prices the currency explicitly: *"a push costs a whole round; a reply costs nothing."* Defining a round
  as a submission would have put rules 1 and 4 in different units inside one file. *Alternative
  considered and rejected on the merits:* **a round is a submission carrying a blocking inline thread.**
  It is the reading that would have made #105's records nearly right — two inline-bearing submissions,
  bound exactly met, minimal errata — and it is wrong, because it prices this repository's most productive
  channel at zero. The suppressed notes carried 14 of 19 findings on #85, 9 of 11 on #81, and on #105 the
  `tierRank` fail-open that let an invalid gate policy compile. A definition under which a session may push
  forever provided the findings arrive suppressed is a bound in name only.

- **A records-only correction spends a round** (his ruling, same day). `e09a49a` fixed nothing but a suite
  figure the reviewer had caught disagreeing with itself, and it counts. The alternative was an exemption
  for documentation pushes, which is a category a session gets to assign to its own commit — the bound
  would have been optional and the option would have been the implementer's.

- **Defining the term broke the file's own table, so the same change fixed it.** The headline measurement —
  110 rounds over 30 pull requests, **29% finding nothing at all** — cannot be in fix-rounds: a fix-round
  answers something by construction, so *"a round that found nothing"* is not expressible in the new units.
  The figures count submissions. **Established from the file's own text rather than by re-measuring** — its
  "Why it holds" already says those rounds were "pushes Copilot had nothing to say about" — so the table is
  **re-labelled, not re-counted**, and the retire threshold at the foot is marked as carrying the same
  submission units. **Left undone deliberately and named here:** nobody has re-derived that 30-pull-request
  corpus in fix-rounds, so the 2.0 retire threshold has never been evaluated in the units the rule now
  defines. Leaving it silent was the one thing not available — a file holding two carriers of *what a round
  is* is precisely the defect [#115](https://github.com/sleepy-panda-works/portulan/pull/115) shipped a fix
  for four days ago, in this same check's neighbourhood.

- **The root cause is rule 2, and that is the finding worth keeping.** *Records land last.* On #105 they
  landed **second**, at `0719f19`, before a single fix round had been pushed; they were patched at
  `e09a49a` and again at `384a17d`; and they still stopped one push short of the end. Three carriers
  disagreeing about one number is not a coincidence of three sessions' arithmetic — it is what writing a
  record mid-loop *is*: a claim about a total that has not happened yet. Had they landed after `c6b6a25`
  they would have been written once and all three would have said four. Rule 2 was justified until today by
  a wasted round on #63; it now has a demonstrated cost that is permanent rather than merely expensive, and
  the rule records it.

- **Errata names the breach and dates the definition** (his ruling). The count is corrected, the
  *"inside the loop's bound"* compliance claim is **withdrawn**, and the withdrawal says the breach is
  retrospective: no definition existed on 2026-07-29, so the session could not have known. **What it is
  still fairly faulted for is narrower and stated rather than softened** — it asserted compliance with a
  bound it had never established it could measure. Shape taken from the
  [2026-07-25 errata](2026-07-25-handoff-cadence.md): append-only, dated, original text untouched.

- **The siblings were looked for and deliberately not fixed, which is the reportable half.** His ruling of
  2026-07-27 sets a fix's scope by defect class rather than by the task's literal boundary, so the sweep
  ran: **four** merged records state Copilot round counts — two `docs/plan.md` entries of 2026-07-26, the
  tag-and-install handoff of that date, and `verify/README.md` on #64. **None is corrected.** All four
  predate the definition and three predate the rule, and this repository's own answer to *may a new rule
  bind an old record* is the two forward-only cutoffs in `docs.sh`: it may not, "without rewriting the
  record to suit the rule". **What made #105 different is not the definition but that its three carriers
  contradicted each other** — a defect on any reading of the word, and one that existed before this
  reading did. The cutoff is written into the rule rather than left implicit, because a *definition*
  reaches further than a rule does: it changes how a reader parses old text, so four silently uncorrected
  records would have become four records in unstated units.

- **The Session log entry was corrected in place, within its 10-line budget.** A merged entry dated after
  2026-07-28 is a pointer capped at ten lines and #105's was already at ten, so an errata block inside it
  was unavailable. The correction is the word, the count, and a pointer to where the errata lives; the
  reasoning sits in the handoff, which is the division of labour the budget exists to enforce. The
  budget counts lines and not characters — that line already ran to 145 — so nothing was displaced.

## The side measurement, recorded where counting happens

**The reviewer has two logins, and which one you get depends on the endpoint:**
`copilot-pull-request-reviewer[bot]` on `/pulls/N/reviews`, plain `Copilot` on `/pulls/N/comments`. A query
filtered on either returns **zero** from the other, which is how #105's count was first mis-measured as
zero. Recorded in the amended rule rather than only in the gate map, because the rule now defines a
countable thing and the trap belongs with the instructions for counting it.
[`copilot-review.yml`](../../.github/workflows/copilot-review.yml) already hard-codes both spellings, so
this is a hazard for hand-counting and not a defect. `.portulan/gate-map.md` knew both names existed, but
recorded the fact as a thread-*resolution* observation — who cleared the gate — which is why it did not
prevent a mis-count.

**Copilot challenged the mapping in round two, and the challenge is what produced the evidence.** It read
`copilot-review.yml`'s header — `copilot-pull-request-reviewer[bot]` "raising threads on #44" — as
contradicting the endpoint split, and proposed dropping the mapping for "both logins are observed". That
would have removed the only useful part: *which endpoint gives which*. Settled by measuring instead, across
ten pull requests spanning the whole history (#44, #49, #57, #63, #81, #85, #95, #105, #115, #119) — the
split holds every time, with no overlap in either direction, **including on #44 itself**. The header and the
gate map both name the *actor* by its review login, which is not a claim about `/comments`. **The finding
was wrong and still worth its round:** two carriers were loose enough to make a correct, measured statement
look false, and that near-contradiction is now resolved in the rule rather than left for the next counter to
re-derive.

## Open — the maintainer's, and outward

**PR #105's body still says two.** It is the third carrier and the only one outside the tree: correcting
it modifies public content on a merged pull request, so it is his to release rather than mine to take. The
proposed shape is a marked, dated errata block **appended** to the body with the original sentence left
standing — the same treatment the handoff got, since a merged body silently rewritten is the failure this
whole change is about. The text is drafted and ready to post via `./.portulan/tools/gh-bot`.

## For the next session

**The M6 close verifies this fix rather than naming the disagreement.** The Fable 5 verification of
2026-07-30 left two residue items for the close, and item 2 was conditional: *if still unreconciled by
close time, the close names it; if fixed, the close verifies the fix.* It is fixed in-tree — so the close
re-derives four from `/reviews`, `/comments` and `git log`, confirms the errata is append-only, and checks
whether the PR body was ever brought into line. **Item 1 is untouched by this change and still owed**: the
close's doctrine rewording must state what the first instance is *not* — nothing reads it, nothing
consolidates it — and must not be ticked on #109's interim wording.

**This branch spent both its rounds and stops there, which is the definition being observed rather than
just written.** Round one fixed a table still headed "rounds" beside a note claiming it had been
re-labelled; round two settled the login mapping by measuring ten pull requests. Both were pushes
answering Copilot, so both count — **`#119` is at rule 4's bound**, and anything further becomes an issue
rather than a third push. Under the definition this branch replaces, round two would have been free: its
findings arrived only in the suppressed channel.

**Next action.** Open the pull request for his review and merge; the PR-body errata needs his go-ahead
separately.

**Recoverability.** Documentation and one memory rule; nothing in `cli/`, no settings, nothing outward
taken. The verify recipes are green, so the tree can be committed or discarded whole. The one irreversible
act available here — editing a merged pull request's body — has deliberately not been taken.
