# Handoff — the instrument that could not see the thing it was asked about

**Session:** 2026-08-19, closing the release arc that began the previous day.
Verbatim scope: *"do the follow-up PR"*, then *"run the loop to empty then merge it"*.
**No milestone row moves.**
[#300](https://github.com/sleepy-panda-srl/portulan/pull/300), merged as `27b22e9` + `a2c0f91`.

## State

`main` = `a2c0f91`. Suite **1725**, fourteen recipes green on the merged tree. The release arc is
closed: `v0.1.0` and `v0.1.1` tagged and released, npmjs at **0.1.1**, GitHub Packages carrying
`@sleepy-panda-srl/portulan@0.1.1` and now **public**.

## Decisions + why

- **The hedge was replaced rather than left standing.** `0.1.1` shipped the packages workflow saying
  *"which of the two actually governs is UNVERIFIED until this workflow first fires"*. It fired twice.
  A sentence that has stopped being the best available answer does not get to stay, which is the same
  rule the release itself was cut under.
- **The `--access public` flag is KEPT although it was measured inert here** — it is required on npmjs,
  where the same tree also publishes, and it costs nothing. What changed is the claim about it, not
  the code. A flag correct on one registry and inert on another beats one absent from both.
- **The sidebar absence is recorded as an observable, not explained.** Cache, anonymous suppression,
  or a linkage rule — not established, so not claimed.

## The finding worth carrying

**An instrument was structurally incapable of answering the question it was pointed at, and looked
like it worked.**

The maintainer's original ask was to fill the repository's **Packages** sidebar. Every check run
against it was `curl` plus `grep`. GitHub ships that heading as a **loading skeleton which hydration
removes** — so the raw bytes contain the word *Packages* and the rendered page contains no block at
all. A grep reports the heading present and concludes the **opposite of the truth**.

The answer only appeared once the page was rendered with its JavaScript, signed out, twice: the
sidebar carries About, Topics, Resources, Releases (2), Contributors (3), Languages, and **no Packages
block** — while the package's own page serves 200 anonymously and the API reports it public.

**So the ask is not satisfied even though every artifact is correct**, and that is stated in the
CHANGELOG rather than quietly rounded up to success.

This is the same shape as three other instruments this arc: a duplicate `env:` key that silently
deleted a credential while every parser stayed happy; `grep -c ✔` reporting 1972 where the suite is
1714; and a thread-audit keyed on *did `portulan-agent` comment* when the promoted-note bot **is**
`portulan-agent`, so three unanswered findings read as answered. **Four instruments, one class: the
check could not see its subject and said so in the language of success.**

## Instruments and rounds

- **Pre-commit (Fable 5, fresh context): APPROVE-WITH-ADJUSTMENTS**, one blocking and three optional,
  all four folded. The blocking one was that the entry's own *"still unmeasured"* sentence had by then
  been measured — the checkpoint did the rendering the implementer had not.
- **The report earned its keep on the path it was missing from.** Finding 2: the visibility report sat
  below the idempotent early `exit 0`, so a re-run printed no visibility line. **The path somebody
  takes to CHECK ON a package was the one path with the check switched off.** It now runs on both.
- **Copilot: two rounds, two findings, round two empty.** Both were mine, and one was created by the
  checkpoint's own punctuation fix: moving a period out of a quoted string to make two carriers
  agree left no period between the quote and the next sentence. **A punctuation repair producing the
  next punctuation defect, twice in one arc, found by a reader both times.**
- Rounds landed on branch heads `53a8693` and `df324ba`; the rebase-merge renamed those to `27b22e9`
  and `a2c0f91` on `main`.
- **A fifth instance, caught by the maintainer AFTER the merge, in `bfd75cf`.** Removing the
  idempotent `exit 0` so the report would run on both paths left the line above it still saying
  *"nothing to do."* — true while the exit stood, false in the same commit that made the step
  continue, and now announcing "nothing to do" immediately before doing the one thing a re-run is
  fired to do. **A neighbour's claim invalidated by a change that did not touch it**, which is the
  sibling shape of the four instruments above: nothing looks at the sentence next to the line you
  edited, and no rail here compares prose to the code beside it.

## Open questions

- **Should the deleted self-corrective notes return to the files?** Raised twice, undecided, his. The
  record carries them either way; what has no home today is a place an *editor* meets them before
  changing the file.
- **A current-version rail** — every prose statement of a current version agreeing with
  `package.json`. Named in three records now and still unbuilt.
- **Why the sidebar block is absent** to a logged-out visitor.

## Next action

Nothing is owed by this arc. The next release exercises the both-paths visibility report, which has
been changed and not yet run.

## Recoverability

Nothing partial. Both tags, both releases and both registries are live and verified. A background task
the maintainer started, `task_0dd5e85f`, duplicated work already merged in `27b22e9`; it could not be
withdrawn because it had already begun.

_**And it did what this paragraph predicted, so the prediction is replaced by what happened.** That
session landed `0eca786`: it found the work already on `main` **at `git push`** — after reading the
file, designing the change, writing it, and running fourteen recipes and 1725 tests against a tree
that no longer existed — and its own record names the guard as `git fetch` before READING, not before
pushing. It also carried a handoff and a Session-log entry of its own for this same date, which is why
this branch rebased through three conflicts in `docs/plan.md`: two sessions appending to one append-only
log. **Both records are kept**; neither was chosen over the other, and 2026-08-19 now carries two
handoffs and two log entries, which is what the correspondence rail asks for._
