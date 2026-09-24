# Definition of done — why conditions 5, 6 and 7 read as they do

> The reasons behind three conditions of [`../dod.md`](../dod.md), which states each condition and links
> here. Where the text below says *this file*, it means the definition of done as a whole. Only these
> three live here: the A/B arm removes these conditions and this file with them
> ([`../../evals/ab/arm.md`](../../evals/ab/arm.md), row 3), so a reason for any other condition stays in
> the definition itself.

## 5. The pre-commit scan is clean

_Why: this history **is** world-readable — the
repository was public 2026-07-27 → 2026-08-03, private after that, and is public again — and a
commit cannot be cleaned afterwards, only rewritten, which is worse and leaves its own trace.
**This clause has now survived visibility moving in both directions and relaxes on neither, and no
move of that setting may be read as relaxing it.** While the repository was private it bound
because clones from the first public window could not be recalled and the setting sat one Gated act
from moving back; it now binds for the plainest reason available — **every commit pushed is
world-readable the moment it lands**, so this scan is the last check before publication rather than
a check before some later one. A scan kept only while the repository happens to be public stops
exactly when it is cheapest to keep; a scan kept only while it is private has the argument
backwards. Visibility is a Gated setting that has moved three times. The clause binds at its
maximum now, and it has never bound less._

## 6. The plan reflects reality

_Why only the Status column: until 2026-09-23 this condition also required a Session log entry per
session in `docs/plan.md`, and every pull request open at once appended to that one section — all 15
of that day's pull requests that had another merge land while they were open conflicted there. The
entries restated what the commits already said. The log retired, a change's record became its commit,
and `docs.sh`'s `record` check now fails a Session log entry rather than requiring one._

## 7. The supervisor checkpoint passed

_Why the split is spelled out: this condition read "for
anything milestone-affecting", which is narrower than the gate map's own full-lane boundary and
narrower than the trigger now recorded beside it — a second, narrower carrier of one rule, which is
the shape condition 6 was repaired **out of** one change earlier, and the class
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md) names. The Dependabot arc ran checkpointless under the old wording with
nothing in this file to say it should not have._
