# Handoff — 2026-09-23: the Copilot review is time-boxed to three minutes

**What landed.** [`copilot-review.yml`](https://github.com/sleepy-panda-srl/portulan/blob/74a2a315c8c2641736eea6d87be3c2fba83827a5/.github/workflows/copilot-review.yml) waits three minutes
for a Copilot round on the head instead of twenty, on the maintainer's ruling of 2026-09-23, verbatim:
*"The review from Copilot on each PR in Portulan needs to be time-boxed to 3 minutes. Anything that exceed
3 minutes need to be reported with whatever findings are available at that moment."* When the window
closes with no round, the check goes red and writes its report to the job summary as well as the log:
what landed on the awaited head, whether Copilot still holds the request, and Copilot's newest review on
the pull request. The two carriers of the old budget, *Merge discipline* in [`../gate-map.md`](../gate-map.md) and
[`../memory/a-review-is-awaited-not-just-resolved.md`](../memory/a-review-is-awaited-not-just-resolved.md),
say three minutes now.

**Why no proposal.** The gate map sends an idea that adds an axis, a mode or a surface to a proposal.
This changes an existing gate's window on the maintainer's ruling, the same shape as the 2026-07-28
amendment that set the twenty minutes. It relaxes nothing: a head with no round still ends red.

**Why red at the close, not green.** `copilot-reviewed` claims a round landed on the head, and green over
a head nobody reviewed is the false green of #286. Merging past the red stays his recorded act, per
proposal `0023`. The cost is named in the workflow's header: rounds here have landed 1m53s–3m47s after a
push, so some land after the window and need a re-run to turn green, to have their suppressed notes
promoted and to draw a derived verdict. On a superseded head nobody re-runs, so those notes stay in the
review body.

**The one re-request moved.** It fired halfway through the twenty minutes, when an ordinary round had long
since landed. Halfway through three minutes every ordinary round is still in flight, so a first attempt no
longer re-requests, and a re-run re-requests at its first look when the head has no round. What a
re-request does to a round still in flight is not measured.

**How it was tested, and what was not.** The await step was lifted out of the parsed YAML and run under
`bash -e -o pipefail` against a stub `gh`, with the window cut to 6s and the looks to 2s, in six cases: no
review anywhere, a request still held with an older round on another commit, a re-run, a round landing on
the third look, a refusal, and an unreadable API. Each ended in the branch it should; the re-run posted
one re-request at its first look; the green case's step outputs were unchanged; the final look landed on
the window's close. Nothing ran on GitHub: this pull request's own run is the first live one.

**Checkpoints.** Skipped by his instruction of 2026-09-23 12:38: no fresh-context runs unless he asks.
The coordinator session reviewed the diff before the commit; his review is on the pull request.

**Green in this container needs a non-root run.** As root, `tests` fails its permission cases, because a
chmod-000 fixture never denies root. The other recipes ran green as root, and `tests` ran green as a
non-root user on a copy of this tree.

**Next action.** His review of the pull request, and a Copilot request on it from the Reviewers menu,
since Copilot does not review a pull request an App opened (#161).
