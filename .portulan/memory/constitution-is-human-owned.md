**type:** rule
**scope:** workspace — every agent working in this repository
**provenance:** `form=link` `href=../../docs/vision.md`
— the constitution's own header, locked 24 July 2026 ([`../../docs/vision.md`](../../docs/vision.md)),
restated as a prohibition in [`../gate-map.md`](../gate-map.md). _This rule has no incident behind it,
and the stamp says so by pointing at a document rather than at a pull request: it was legislated, not
learned. The two-form field asks where a rule came from in a shape a machine can check and a reader can
follow, and for a constitutional rule that is the constitution. The `href` is deliberately repeated as a
Markdown link above, because `doctor` validates a link's shape and never resolves it — the `links` check
in [`../verify/docs.sh`](../verify/docs.sh) is what confirms this one points at something real._

No agent edits `docs/vision.md` — not with approval, not as a proposal that rewrites it in place. An
agent that believes the constitution is wrong raises the question with the maintainer and stops.

**Why it holds:** every other change in this repository is graded against that file. An agent able to
edit the standard it is judged by can launder any other change past its own grader. That is why this is a
prohibition rather than a Gated action: Gated actions are ones a human can meaningfully approve one at a
time, and an edit to the grading standard is not one of them.

**When to apply:** any time the constitution appears to contradict reality — which will happen, and is
the normal case rather than the alarming one. The correct move is a question to the maintainer and, where
the answer changes the build, a plan amendment. Never a quiet reinterpretation.

**Retire when:** never, while `vision.md` remains the grading standard. If it is ever demoted to a
non-binding document, this rule retires with it.
