# Handoff — the librarian mines and consolidates, and the checkpoint found the work it would have lost

**Date:** 2026-07-29 · **Milestone 5 (Memory lifecycle & librarian), session 2 of 1–2** · Branch
`m5-the-librarian-mines-and-consolidates` · [#85](https://github.com/sleepy-panda-works/portulan/pull/85)

**State.** The row's three remaining clauses, in one pull request: the handoff-series index
([#82](https://github.com/sleepy-panda-works/portulan/issues/82)), mining over both corpora, and
scheduled consolidation. Spec 2.4 → **2.5**, additive: a top-level `handoffs` object with `index.path`
and nothing else. Suite 584 → **635**; all eight recipes green, each exit code read. Folded in on the
maintainer's rulings and the PR #43 sibling rule: [#84](https://github.com/sleepy-panda-works/portulan/issues/84),
[#83](https://github.com/sleepy-panda-works/portulan/issues/83), and
[#77](https://github.com/sleepy-panda-works/portulan/issues/77)'s class in two files.

## The prescribed grep found nothing, and that is the finding

[`a-doctrine-promise-belongs-in-the-row-it-names.md`](../memory/a-doctrine-promise-belongs-in-the-row-it-names.md)
requires searching `core/` and this workspace's memory for the milestone number **before** the row is
trusted. It changed the row at milestone 4 and again at milestone 5 session 1. Run here over `core/`,
`.portulan/memory/`, `.portulan/tasks/`, `.portulan/proposals/`, `spec/`, `cli/`, `agents/` and
`plugin/`, it found **every promise already named by the row** — so no amendment was proposed, and the
session-open checkpoint re-ran it independently and agreed.

Recorded because a session that ran the grep and found nothing owes that sentence as much as one that
found something. Two near-misses were named and ruled non-promises rather than left to be re-found:
[`a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
and [`a-mechanical-revert-is-not-a-narrative-revert.md`](../memory/a-mechanical-revert-is-not-a-narrative-revert.md)
name milestone 5 in their **`Retire when:`** lines — a forecast of when a condition might fire, not a
doctrine sentence promising a capability at this row.

## What the session-open checkpoint changed, and it changed the claim rather than the query

The plan's mining signal was *a handoff no memory record links* — an incident that produced no rule.
The checkpoint measured it instead of reading it: **25 of 35 handoffs fire**, immediately and forever,
since the pass is stateless and the series only grows. And it found a **proven false positive**:
`2026-07-28-the-librarian-goes-on-a-cron.md` is unlinked, yet that session minted
[`a-scheduled-agent-needs-its-own-identity.md`](../memory/a-scheduled-agent-needs-its-own-identity.md),
whose provenance cites the **proposal** that session filed rather than the session. The link graph is
not the incident graph.

The repair is the one worth keeping: **the claim narrowed, the query did not change.** The pass does not
say an incident taught no rule. It says **nothing in the curated layer points back at this incident** —
which is true of that handoff too, and is what thesis 4 actually asks for, since a rule whose incident
cannot be traced can never be retired on evidence. Read wide it is a query with a known false positive;
read narrow it has none. Alongside it: the **ratio is always stated with its denominator** and the
**list is windowed** to the last pass, because a list nobody can finish is how a whole report gets
skimmed.

## Decisions, and why

- **Mining yields candidates, not proposals** — the maintainer's ruling, put to him rather than
  resolved here, because the row says "into draft proposals" and
  [`a-doctrine-promise-belongs-in-the-row-it-names.md`](../memory/a-doctrine-promise-belongs-in-the-row-it-names.md)
  holds that such a choice "is not an implementer's". There is a mechanical reason under the principled
  one and it is not recoverable by trying harder: [`../verify/docs.sh`](../verify/docs.sh)'s `proposal`
  check requires every proposal to name the pull request that filed it, and this pass writes its files
  *before* that pull request exists and has no update path by design. A generated stub would red the
  librarian's own pull request on the recipe that shipped one session earlier. Five doctrine sentences
  were reworded in the same change to say *candidates* precisely.

- **A finding is a comment that OPENS a thread.** Measured, and the partition is exact: of 376 inline
  review comments, all **189** from the reviewer open threads and all **187** replies — 162 the agent
  identity's, 25 the maintainer's — carry `in_reply_to_id`. Filtering by login was the obvious spelling
  and is wrong in the worst direction here, because **the reviewer is itself a bot**: excluding bots
  excludes the findings. Counting replies would have inverted the signal outright — every reply is one
  more comment on a path we were answering about, so the harder a finding was argued the more it would
  read as a place reviewers keep finding things.

- **Two distinct pull requests is what *recurring* means**, so mining needs no threshold in the
  manifest. A tuning knob would be policy and policy is declared; a definition is not a knob. This is
  why 2.5's diff really is `handoffs` and nothing else.

- **No budget on the handoff series, and the absence is enforced rather than explained.** Consolidation
  is a budget's only permitted remedy and the series is append-only, so every remedy such a budget could
  ask for is barred — a rail built to be broken. Measured at the pre-commit checkpoint: `handoffs.index`
  has one key and the schema sets `additionalProperties: false`, so declaring a budget there is a
  `doctor` **RED**. A workspace cannot quietly acquire it.

- **Ages for both series; a threshold for only one.** `record_days` exists to draft a demotion, and a
  demotion draft against an append-only series recommends deleting the record the series exists to
  keep — weekly, forever. So the handoff series is reported and never railed.

- **`examples/` stays at 2.4** while `.portulan` moves to 2.5. It declares no handoff series, MINOR is
  additive, and `doctor`'s older-manifest note now fires on a **live** workspace — turning a documented
  promise into a demonstration this repository had only ever covered with fixtures. Both prior bumps
  moved it, so this is a change of practice, flagged in the pull request rather than left to read as an
  oversight.

- **The consolidation pass concludes nothing it cannot.** Records citing one incident are a **question**,
  because `consolidate/SKILL.md` step 2 merges records that are one *mechanism* — and all three of this
  repository's shared-incident groups are deliberately distinct facts, one incident having taught
  several. Steps 3 and 4 are named as un-automated *in the report*, because a pass that omitted them
  would read as having found nothing.

## The fail-open the checkpoint found, closed structurally

**A pass is a session, so it writes a dated handoff into the series the handoff index covers.** An index
regenerated during the pass is stale in the commit the pass pushes: `index.sh` reds it,
`workspace-verify` fails, and the pull request this milestone is demonstrated by cannot merge —
unattended, on the first real run, on the one artifact the row names.

The repair is a rule with no exceptions in it: **the pass reads, the command writes, and nothing
regenerates an index until every record the pass wrote is on disk.** That also makes an earlier fix
structural instead of ordered-by-hand — #81 round three caught `inspect` in write mode reporting
"current" about an index it had just regenerated; with no write on that path there is no ordering left
to get wrong. Forced red before it was believed, and the assertion is end-to-end on purpose: what has to
be true is that *the tree the pass leaves behind passes the recipe that guards it*.

## What the pre-commit checkpoint found

**APPROVE-WITH-ADJUSTMENTS**, five required, all folded in. Three were carriers this change had moved
everywhere except where they are printed: [`../verify/index.sh`](../verify/index.sh)'s header and its
**running banner** still said *the memory index* and *the two reds* while the tool beneath reported two
series and four repairs — the same fact carried twice, drifting at the weaker carrier, in the file whose
banner prints on every CI run, in the change whose own commit message names that class.

[`../../core/personas/librarian.md`](../../core/personas/librarian.md) had been made to contradict
itself: a new paragraph said the whole charter now runs unasked, while the charter above it says the
persona mines into **draft proposals**. The charter is not wrong — a persona with a window can read an
incident and write the argument. The paragraph was. Rewritten to say which subjects a machine on a cron
carries alone and how deeply, so the persona/tool distinction the page already draws does the work.

**And the window boundary lost work permanently.** `mineIncidents` used a strict `>` against the last
pass's date, so a handoff written on the afternoon of a pass day fell outside that window — the pass had
not seen it — **and outside every later one**, because `since` only moves forward. It would have
survived nowhere but the ratio. `>=` costs one repeat at a date boundary and never drops a day.

## The measurement the demonstration was waiting on

`librarian.yml` needs an App-raised `labeled` event to re-run `pr-labeled`, which runs at `opened`
before a label can exist. Whether an App can label was unmeasured, and whether an App-raised event
starts a run was unmeasured with it.

Both are measured now, and the second came free: the maintainer added a label to a **closed** pull
request with the App token — it succeeded, and no run started, which is **inconclusive rather than
negative**, since a closed pull request with a deleted head branch gives Actions no merge ref to build.
So this session's own pull request was opened **deliberately unlabelled**, and the sequence ran live:
`pr-labeled` **FAILURE** on `opened`, then the App added the label, then `pr-labeled` **SUCCESS** on the
App-raised `labeled` event. The librarian's filing sequence is measured end to end **before** either
secret existed, and the maintainer's one-click fallback is not needed.

## The review loop, under the bound

**Three rounds, nine findings, all nine real** — and **six came through the suppressed channel**, which
`copilot-reviewed` passes regardless of and which has no Resolve control. Third consecutive pull request
where that half carried the majority, and on this one it twice carried the evidence that a finding
**generalised to a second site**. Standing argument for [#66](https://github.com/sleepy-panda-works/portulan/issues/66).

**Round one — four threads and one note, and two of them were one defect.** `index.declared` means
*some* index is declared, and both report sites branched on it, so a workspace declaring only one of the
two indexes had `current` printed about an index that does not exist. The thread carried the handoff
site and the suppressed note carried the store site; neither alone shows it generalises. It is the
sentence [`../../cli/index.mjs`](../../cli/index.mjs)'s `run` was fixed for on #72, ported to `run` by
this change and not to the record the pass files. Also: `compareOrWrite`'s refusal hard-coded *not about
memory*, naming the wrong subject for the handoff series; and `handoffs: {}` validated, a no-op object
that reads as configured — `index` is required now, and unlike the two conditional requirements beside
it this one **is** expressible in the declared subset, so the schema carries it rather than `doctor`.

**Round two — one thread whose mechanism does not hold and whose hazard does.** The claim was that
`gh api --paginate` needs `--slurp` to emit one JSON array. Measured on gh 2.96.0 over this
repository's four pages: plain `--paginate` gives **one flat array of 385 objects** and `--slurp` gives
**four nested arrays** — so the suggested remedy is what would break the parser. What was real is what
the pass did with such a corpus: every inner array counted as a finding, then got skipped for having no
path, and the report said *no path has drawn findings on two or more distinct pull requests* over a
corpus it had entirely misread. Measured before it was fixed. Refusing on **shape** closes that whatever
any `gh` emits, which is the version this check should be written against.

Its three notes were one defect at three sites: the pass record, the log entry and the run summary all
asserted an index **had been** regenerated, while the regeneration is the last thing the command does
and can fail — and the record cannot know the outcome when it writes it, because it *has* to be written
first, being itself a member of an indexed series. All three now state what is true at that moment. The
test asserts the **ordering** rather than the wording, so the next rename cannot quietly re-invert it.

**Round four — no threads, three notes, and the session shipped a fresh instance of the class it spent
the day fixing.** Two of them found that this handoff said the suite was **623** while the Session log
entry for the same session said **626** — one number, two carriers, disagreeing with each other and
both stale against a tree measuring **629**. Written minutes apart, by the session whose diff corrects
three other instances of exactly this, in the two files that *are* the record. Both now read 629,
measured rather than remembered.

The lesson is not *check your numbers*, which is advice nothing enforces. It is that **a figure copied
into a record at the moment of writing is stale from that moment**, and this repository has two records
per session that both want it. The carriers cannot be collapsed — a handoff and a log entry are read by
different people at different times — so what would actually hold is a check that reads the suite's own
output, which is milestone 8's telemetry clause and is named there rather than invented here. The third
note was the triaged `EACCES` one, re-raised verbatim, which is what
[`../memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md) says a triaged
note does until the code changes.

**Round three — no threads, two notes, both real, and this is where the bound bit.** Both fix-rounds
were spent, so [`../memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md)
rule 4 applied and they were triaged in a comment rather than pushed. The maintainer then ruled that one
of them rides the records push: `indexLines`'s comment claimed returning zero *understates* the
headroom when it overstates it — **a sentence this change itself wrote**, and the same class as
[`c479b0a`](https://github.com/sleepy-panda-works/portulan/commit/c479b0a), in the same file, one
milestone apart. The transferable half is smaller than the fix: **a comment asserting a *direction* —
over or under, more or less — is the kind that is easy to write backwards and that no check here can
catch.** The other note is pre-existing and stays an issue: `compareOrWrite` reads every failure to
open the index as *declared and absent*, so `EACCES` becomes an actionable drift verdict about a file
nothing could read.

## Open questions

- **The handoff-series budget is the maintainer's**, and the row sends it to this pull request in as
  many words: the series has an index and no rail — should it have one on some other axis, or stay
  unrailed? Recorded as deferred in [`../../spec/slots.md`](../../spec/slots.md) and
  [`../verify/README.md`](../verify/README.md) rather than settled by inference.
- **`CHANGELOG.md` line 22 says milestone 4 "is open"**, false since 2026-07-28. Untouched here — the
  file's own header says it is written in the change that cuts a release, and this session cuts none —
  and worth an issue so the eventual cut does not inherit it. Issues are the maintainer's to open.
- **Mining reads the smaller review channel.** These are *inline* comments; the low-confidence notes
  collapsed into review bodies carry no path and cannot be seen from here — and on #81 that channel
  produced nine of eleven findings, eight real, while on this pull request it produced six of nine.
  [#66](https://github.com/sleepy-panda-works/portulan/issues/66) is now also an argument about what a
  scheduled pass can measure at all.
- **Two issues are owed and are the maintainer's to open**, triaged in #85 rather than pushed: the
  `EACCES`-reads-as-absent refusal in `compareOrWrite`, and — recorded even though its fix rode this
  session — the `indexLines` comment class, since what recurred is the class rather than the line.

## The demonstration ran, and milestone 5 closed

[#85](https://github.com/sleepy-panda-works/portulan/pull/85) merged as `4ccb672`. `librarian.yml` was
then dispatched against `main` and **filed [#86](https://github.com/sleepy-panda-works/portulan/pull/86)
end to end**: authored by `app/portulan-agent`, branch `librarian/2026-07-29`, labelled `workspace` by
the App, and — the platform fact the whole session-1 design turns on — **`workspace-verify` and
`pr-labeled` both *ran* and reported** on its head, which a pull request opened by `GITHUB_TOKEN` never
gets. `MERGEABLE`. Its diff is exactly what a pass should write: the dated pass record, one Session log
entry, and the handoff index regenerated **to include the record the pass had just written** — the
ordering fix, unattended, on the real path.

**The close checkpoint verified it in a way this session could not have.** It recomputed the pass
independently on the same tree and corpus and found **all three files byte-identical** to what the
workflow produced — the strongest honesty check a derived record admits, and a stronger claim than
*the recipes are green*.

**Verdict: CLOSE**, and the fidelity note is in the row. What it names as undemonstrated is worth
carrying forward: the **cron event has never fired** — #86 came from `workflow_dispatch`, and the first
natural run is 2026-08-03; every staleness threshold is unfired against a four-day-old store, so the
nags were measured only under forced one-day thresholds; mining reads the smaller review channel; and
consolidation's steps 3 and 4 stay human. **#86 is filed, not merged** — that gate is the maintainer's.

## Next action

The post-M5 reconciliation the maintainer deferred: a handoff-series budget, amendment blocks →
pointers, and the per-agent-memory note in `core/operating/memory.md`. Then milestone 6.

## Recoverability

Everything is on one branch. Nothing outward happened beyond the branch push, this pull request, and
the label the maintainer added to it and to #55 — #55's was removed, leaving it exactly as it was. No
App permission was changed by this session and no workflow has run. The forced observations ran on a
scratch copy under the session scratchpad, holding no repository state.
