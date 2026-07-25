**type:** reference
**scope:** workspace — anyone adding workspace content to this repository
**provenance:** `form=link` `href=../proposals/0003-demote-three-workspaces-entry.md`
— demoted from `decision` and trimmed on 2026-07-25, when this entry's own retirement condition fired. It
had read *"Retire when: the Workspace Definition (milestone 2) names and distinguishes the three
formally"*, and milestone 2 did: `kind` is a required slot with exactly three values, argued in
[`../../spec/README.md`](../../spec/README.md) and validated by [`doctor`](../../cli/doctor.mjs). The
general half went upward into the spec; what is below is the half that cannot.

Which of *this repository's* directories is which workspace kind:

| Directory | `kind` | Ships |
|---|---|---|
| `.portulan/` | `repository` | publicly with the repo, at milestone 3 |
| [`../../examples/`](../../examples/) | `demo` | publicly — the worked example a stranger reads |
| the Sleepy Panda portfolio workspace | `portfolio` | privately, through the feed at milestone 6 |

**When to apply:** whenever adding workspace content, before choosing where it goes. The test is who the
reader is — ourselves building this repository, a stranger evaluating the product, or Sleepy Panda across
all its products.

**Why this half stayed while the rest went.** What the three kinds *are*, and the two failure modes that
make confusing them expensive, now live in [`../../spec/README.md`](../../spec/README.md); a second copy
here would have left two statements with nothing holding them in agreement, and the workspace copy is the
one nothing checks. This mapping is the opposite case — it is *our* specifics, and a spec naming customer
zero's directories would have absorbed exactly what [`../../docs/vision.md`](../../docs/vision.md) thesis
6 keeps with its owner. The general travels upward by generalizing; the specific stays put. That is the
ordinary shape of promotion, and this entry is now a small worked example of it rather than a statement of
it.

**Retire when:** this repository stops containing more than one workspace, or the mapping becomes
derivable — `doctor` reading every manifest in a tree and reporting the kinds it found would supersede
this table, at which point it should *move* into that report rather than be deleted.

_Related: [`readme-map-must-match-shape.md`](readme-map-must-match-shape.md). This is the first retirement
condition in this workspace to have fired and been acted on. The librarian's demotion pass (milestone 5)
mines exactly this signal and now has one real instance to learn its shape from — which was the strongest
argument for doing it by hand, once, rather than waiting for the tool._
