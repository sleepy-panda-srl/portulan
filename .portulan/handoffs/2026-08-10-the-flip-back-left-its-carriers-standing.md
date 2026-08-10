# Handoff — the flip back left its carriers standing

**No milestone row moves.** Doctrine work: `dod.md` condition 5, `principles.md`, `gate-map.md`, three
memory records and two proposals. It takes a fresh-context pre-commit checkpoint under
[`../gate-map.md`](../gate-map.md) → *Doctrine, tier and floor work takes a checkpoint even when no row
moves*, and it took a session-open one as well.

## What was wrong

`sleepy-panda-works/portulan` was flipped back to **private on 2026-08-03**. The tree kept saying it was
public. These were not stale sentences that drifted — **the flip minted them**, in the condition-4
sense: every one was true when written and went false at a single instant, without anyone touching a
file. _(The commissioning gives the time as 13:07Z. That is carried, not measured: GitHub exposes no
visibility-change event this session could read back, and a figure this handoff did not measure is
marked rather than adopted.)_

Measured 2026-08-10, not recalled: `private: true`, `visibility: private`, `forks: 0`,
`allow_forking: false`, and an unauthenticated `GET` returns **404** from both `api.github.com` and
`github.com`. The public window was **2026-07-27 → 2026-08-03**; it was world-readable and its clones
cannot be recalled.

The contradiction was already on the books twice — [`../../docs/plan.md`](../../docs/plan.md)'s Session
log for 2026-08-08 and the *SURFACED, NOT RESOLVED* block in
[`../memory/repo-is-private-until-flip-clearance.md`](../memory/repo-is-private-until-flip-clearance.md).
Both refused to pick a winner, correctly: a consolidation pass resolving it *"would have made a policy
decision wearing the clothes of housekeeping."* **The refusal is what carried the question to the
maintainer, and he commissioned this session.** So the memory record's edit is written as the ruling
arriving, with that provenance, and it answers the two questions the record explicitly left open — the
tense, and whether **Retire when** still reads correctly against a repository that has flipped twice.

## The instrument, because a count is only as good as the thing that produced it

The 2026-08-09 lesson was that **a grep over prose under-finds in code**: a phrase wrapped across a
newline is invisible to a line-oriented grep, and comment prefixes sit between the margin and the words.
So the census normalizes before it matches — strip leading `// # * -- ; > |` and `<!-- -->`, split on
blank lines, **join each block's lines with a single space**, and keep a char-offset→line map so every
hit still reports a real line. Eighteen variants, not one phrase. All 328 tracked files, not a directory
list.

**Raw: 711 hits · 121 files · 509 distinct sites**, over 328 tracked files. Bare `public`/`private`
accounted for 506 of those hits and were triaged through a self-reference filter. **103 sites** came
from the twelve high-signal variants, named here so the figure is auditable: `public since` ·
`is/are/was/were public` · `went public` · `made public` · `public repo(sitory)` · `public
marketplace|feed|catalog|registry` · `public tree|history|clone|url|…` · `a stranger can` ·
`world-readable` · `publicly <x>` · `open to the public/world` · `without/no/un-authenticated`. The
remaining six — `stranger`, `visibility`, `anyone can`, `in the open`, and the two bare words — are the
wide net, and they are where the triage does the work.

**It earned its keep.** The commissioning grep named three carriers. The instrument found the two that
mattered most and neither was on that list: [`../dod.md`](../dod.md) condition 5 — the seam scan's own
rationale, the single most load-bearing sentence in the set — and `docs/plan.md`'s locked decision 2 and
repo topology.

**And the instrument is not the triage, which is where this session's own defect was.** The pre-commit
checkpoint found a carrier still standing at `README.md:57` — *"developed in the open … Read, clone and
fork freely"*, the exact sibling of the `CONTRIBUTING.md` bullet this change had already reworked, and
`0020`'s rule broken inside the change enforcing it. **The instrument had flagged it** (variant `in the
open`); the self-reference filter that narrowed 506 bare hits down for review keyed on
*repo · tree · history · here · our* and **not on the product's own name**, so a sentence saying
*"Portulan is developed in the open"* fell out of the shortlist. A filter is an instrument too, and this
one was never adversarially tested. Recorded because the next census will inherit it otherwise.

It also caught a defect of a **different** class inside a block it was already editing:
[`../tools/README.md`](../tools/README.md) said the `contents: read` widening was *"ruled and not yet
applied"*, which had been false since **2026-07-29**, when the gate map four sections away recorded it
as applied and accepted. Two carriers of one fact drifting at the weaker one — three lines below the
sentence instructing the reader not to take the permission set from that paragraph.

## What moved: 29 carriers across 19 files

Twenty-nine present-tense claims about this repository's reachability, in nineteen files, fixed in one
stroke per [`../proposals/0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md).
A thirtieth edit is in the same set of files and is **not** of this class — `tools/README.md`'s *"ruled
and not yet applied"*, below — and is counted separately rather than folded into the headline figure.

## The rule applied: identity vs state

Not every *public* is a claim about reachability, and treating them alike would have been vandalism.
The test used throughout, stated once so the omissions are auditable:

- **State** — does the sentence answer *"is this reachable right now?"* Those move.
  `.portulan/README.md`'s column header is literally `Public?`; `README.md`'s section is literally
  `Status`.
- **Identity** — does it answer *"what kind of thing is this, by design?"* Those stay. The open-core
  **layer** (vs the private feed), the demo workspace's **kind**, the marketplace **tier**. A reversible
  setting does not redefine the product. So `docs/plan.md`'s locked decision 1, `README.md:40`,
  `examples/README.md:3`, `.claude-plugin/marketplace.json` are untouched, and the state is carried in
  the places that ask for state.

**Dated records are forward-only.** Handoffs, dated Session-log entries, `docs/milestones/mN.md`,
dated CHANGELOG releases, dated memory read-backs: past-tense statements true at their date are not
defects and none was rewritten. Where a **present-tense** clause sat inside a dated record, it took this
repository's own idiom — **append a dated bracket, leave the original words** ([`../../CHANGELOG.md`](../../CHANGELOG.md)
line 588 and `docs/plan.md`'s milestone-0 cell are the governing form). One site:
`docs/plan.md`'s 2026-07-28 entry on [#67](https://github.com/sleepy-panda-works/portulan/issues/67).

## The two arguments that could not be fixed by fixing an adjective

[`../gate-map.md`](../gate-map.md) and [`../tools/README.md`](../tools/README.md) both justified the
App's `contents: read` scope with *"it grants seeing what any stranger can already see in a public
repository."* **Truthing the adjective would have left a justification that no longer justifies.** There
is no stranger with that view; the grant is a real one.

The honest rework was already in the repository.
[`../proposals/0015`](../proposals/0015-the-librarian-files-as-the-agent.md) priced this exact case as
its own argument-against, **before it happened**: *"Visibility is a live setting, not a pinned one: if
this repository were ever made private again, `contents: read` would become a real grant that nobody
would revisit, because permissions are not re-derived from visibility."* That is what occurred on
2026-08-03. So both sites now record the cost as live and cite 0015's realized counterfactual, the
re-measure mandate stays the operative rail, and both end where 0015 ends: **the trade is the
maintainer's.** No permission change is proposed or implied — that is Gated and his alone.

`.github/workflows/copilot-review.yml` made the same prediction from the other side and **is vindicated
rather than falsified**: it declares `contents: read` for the checkout precisely because *"a repository
made private again would have a review gate that cannot fetch itself, discovered at the worst moment."*
The gate can fetch itself today because someone named a coupling while it was free. Same for
`cli/plugin-lint.mjs`, which refuses to pattern-match on *"private"* because *"visibility is a live
GitHub setting no file can read."* Both left alone, deliberately.

## What this did not touch

- **[`../../docs/vision.md`](../../docs/vision.md) — human-owned, and the compiled gate refuses agent
  edits.** Named for his re-read: **:54-55** (*"the repo doubles as the public Claude Code plugin
  marketplace"*) and **:72** (*"a fictional demo workspace (public, in `examples/`)"*). **:20** is past
  tense and reads correctly. The commissioning names :20 and :54 as his own redlines; **:72 is a third
  site it does not name**, which is the reason to list it here.

  **These are named, not judged.** By this change's own identity/state test both sites read as
  *identity* — the same tier and kind vocabulary left standing at `docs/plan.md` decisions 1 and 3,
  `README.md`'s `examples/` row and `examples/README.md:3` — so on the rule applied everywhere else,
  neither is a defect. They are surfaced because vision is the one file that **cannot carry a dated
  annotation from an agent**, so a reader who disagrees with the identity reading has no way to see the
  question was asked. The call is his; this handoff should not be read as recommending a change.
- **Row 7's Status-cell true-up** and **[#196](https://github.com/sleepy-panda-works/portulan/issues/196)'s
  citation repair** — other sessions own them.
- **One fact found in passing, of another class, named rather than folded in.**
  `sleepy-panda-works/portulan-workspace-template` **does not exist** (404), and
  [`../../docs/plan.md`](../../docs/plan.md) names it in decision 1 and the topology as though it does.
  Not a visibility carrier, so not fixed here.

  _(A second such fact — the repo card's recipe count — was named here and is now **moot**: #206 fixed
  it on `main` while this branch was open, and better than the note did. It said seven-and-eight; the
  truth is **eight declared beside `docs`, and ten run**, because CI runs the set the manifest *yields*
  and one recipe is composed from the `tools/github` pack. A note written against a moving tree is worth
  re-checking at the rebase, not just at the commit.)_

## Verification

**Ten recipes green, suite 1240** — the nine declared, plus `tools/github:actions-pinned` composed from
the pack, because CI runs the set the manifest **yields** rather than the list it declares. Re-run
independently by the pre-commit checkpoint rather than taken from this paragraph, and **re-run again
after the rebase**, which is where the count changed from nine.

**The rebase produced a thirtieth carrier, and it is the most instructive one here.** Rebasing onto
`43f1e54` picked up [#206](https://github.com/sleepy-panda-works/portulan/pull/206), which shipped
`cli/feedback.mjs` — and with it **a second copy of the acknowledgement sentence this change had just
rewritten** in `feedback.yml`. The census could not have seen it: the file did not exist when the census
ran. **#206's own rail caught it**, holding the shipped field map against the real issue forms, which is
the rail working exactly as designed. Fixed in this branch. The lesson is narrower than *sweep again*:
**a sweep is valid as of a tree, and a rebase is a new tree** — the recipes are the thing that re-derives
that, which is why they run after the rebase and not only before the commit.

Census re-run against the edited tree. After the `README.md:57` repair, the surviving instances of the
retired phrasings are all in one of two places: **dated handoffs**, which are history, and **the
corrections themselves**, which quote the sentence they retire.

**The install path is measured rather than derived**, because *"requires authentication"* was asserted
in four files off nothing but `private` + 404. A stranger's fetch, with the credential helper
explicitly disabled: `git -c credential.helper= ls-remote https://github.com/sleepy-panda-works/portulan`
→ `fatal: could not read Username for 'https://github.com'`. The same command **succeeds** with the
helper left on, which is the control: the first attempt this session ran passed only because macOS
supplied the maintainer's credentials from the keychain, and that near-miss is the reason the negative
control is written down.

Access posture re-measured and recorded as a second dated column in
[`../memory/who-may-commit-is-verified-not-assumed.md`](../memory/who-may-commit-is-verified-not-assumed.md):
**every access grant is exactly where it was on 2026-07-27; the one row that moved is the one nobody was
watching.** That record was built to catch a stray collaborator grant, and what actually went stale was
the setting the grants were being reasoned against.

Seam scan clean across changed files, commit message and branch name — run against the explicit term
list, after a first over-broad pass raised twenty matches that were all generic capitalised words.

## The review found the one thing the rule had not reached

Round 1 was empty. **Round 2, on the rebased head, promoted a suppressed note, and it was right.**
`README.md` said the repository is private and *"none of those paths is open to an outsider today"* — and
then, in the next sentence, sent bugs and proposals to the issue forms. **A private repository closes the
issue forms just as firmly as it closes the tree**, so the paragraph offered with one hand what it had
withdrawn with the other.

Worth recording precisely, because it is a *third* shape of this change's own class. The first was a
carrier the census's filter lost. The second was a carrier a rebase introduced. **This one is a carrier
the rule reached and the rewrite did not**: the identity/state test correctly classified *read, clone and
fork* as state, and the sentence beside it — the contribution channel — was left standing on the same
false premise because it did not contain the word *public*. **A sweep keyed on a word finds the word, not
the claim.** [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) was already right: its dated notice scopes
the whole section rather than one bullet, which is why the same defect is not there.

## What this leaves undemonstrated

- **That the triage of the 506 bare hits is complete.** The instrument is a committed, re-runnable
  script; the self-reference filter that narrowed its output is not, and `README.md:57` is the proof
  that its completeness was asserted rather than achieved. Coverage now rests on the instrument plus
  two adversarial manual sweeps, and that is a weaker claim than a rail.
- **That every site left standing is genuinely identity rather than state.** The test is stated and
  applied consistently, but it is a judgement, and nothing checks it.
- **The flip-back timestamp**, carried from the commissioning and not read from any log.
- **`main`'s branch protection**, unchanged in scope here and owed its own re-measurement.
