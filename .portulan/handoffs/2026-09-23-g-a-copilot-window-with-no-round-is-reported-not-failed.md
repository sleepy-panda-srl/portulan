# Handoff — 2026-09-23: a Copilot window with no round is reported, not failed

**What landed.** When [`copilot-review.yml`](../../.github/workflows/copilot-review.yml)'s three-minute
window closes without a round, the step now ends with a warning and exits 0, on the maintainer's ruling of
2026-09-23 14:07 UTC, given on #432's red run, verbatim: *"This shouldn't be an error and it shouldn't
cause the CI to fail."* The report is unchanged in substance and still goes to the log and the job
summary, under a `::warning::` annotation instead of `::error::`. It reverses his 13:39 call of red at the
close. An API unreadable at the last look now ends the same way, with a warning whose report says at how
many of the window's looks it was unreadable: that is the coordinator session's delegated call, recorded
as such so that it can be reversed. The step fails only on its own errors, an event with no pull request
number or a pull request reported with no head commit. Nothing downstream reads the warning as a round,
because `round=green` is written only by a round, so the notes promotion and the derived verdict still run
only on one.

**Copilot's three findings on #431 are fixed with it.** Its round landed after the merge, with no inline
comment and three fixes in its overview. The newest review's link sat inside the job summary's code fence,
where it cannot be clicked: the report now names the review, and the link is printed apart, on its own
line in the log and as a Markdown link under the fence. A re-run's one re-request fired at its first look
even when that look could not read the API: it now waits for the first look that read the pull request,
its reviews and their bodies, still once. And the wording that said the check fails at the close, in the
header, the gate map and the awaited-review memory record, now says it warns.

**Why no proposal.** The gate map sends an idea that adds an axis, a mode or a surface to a proposal. This
changes an existing gate's conclusion on the maintainer's ruling, the same shape as the 2026-07-28
amendment and #431. It does retire exit (2) of proposal `0023`, whose procedure was merging past a red.
The gate map paragraph that carries that procedure records the retirement; `0023` itself is not edited.

**What it costs, stated in the workflow's header.** Past three minutes the awaited half of *Merge
discipline* is a report. A merge after the close meets a green check, so the incident the rule was written
for, a merge landing before the round, is possible again past the window, by his choice, with the warning
as its notice. A GitHub API outage no longer blocks a merge either: the check says it could not look, and
warns. A renamed Copilot login now shows as a warning on every pull request, not a permanent red.

**Also changed.** The step is named *A Copilot round is awaited on the current head commit*, since it now
passes without one. `walk_unread` is reset on every look, so the report's note that an older round may
exist describes the last look rather than any earlier one.

**How it was tested, and what was not.** The await step was lifted out of the parsed YAML and run under
`bash -e` against a stub `gh`, with the window cut to 6s and the looks to 2s, in eleven cases, each against
#431's step and this one. On a re-run: a first look that could not read the pull request and then no round
now posts one re-request at the second look, where #431's posted at the first; a first look that could not
read and then a round now posts none; a failed reviews read, and a walk cut short by an unreadable body,
each defer the re-request to the next complete look. No round, a held request, no request, a refusal and
an API unreadable at every look all exit 0 with a warning and no step outputs; the last posts nothing and
reports the API unreadable at 4 of 4 looks. A round on the third look produces byte-identical outputs and
summary. Nothing ran on GitHub: this pull request's own run is the first live one, and it ends either on
the round, if one lands inside three minutes, or with the warning at the close.

**Checkpoints.** Skipped by his instruction of 2026-09-23 12:38: no fresh-context runs unless he asks.
The coordinator session reviewed the diff before the commit; his review is on the pull request.

**Green in this container needs a non-root run**, as the previous handoffs record: `tests` ran as a
non-root user on a copy of this tree, and every other recipe ran as root.

**Next action.** His review of the pull request, and a Copilot request on it from the Reviewers menu.
