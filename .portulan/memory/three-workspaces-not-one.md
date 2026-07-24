**type:** decision
**scope:** workspace — anyone reading or extending the workspace layer
**provenance:** Milestone 1, session 3 — `.portulan/` was created as the first real workspace instance,
which made the three workspaces named in the plan collide by name for the first time.

This product has three distinct workspaces and they are not interchangeable: `.portulan/` is *this
repository's own* workspace (dogfooding; ships publicly with the repo at milestone 3);
[`../../examples/`](../../examples/) is a fictional demo workspace written to be read by strangers; and
the Sleepy Panda portfolio workspace covers every Sleepy Panda product and ships through the private feed
at milestone 6.

**Why it holds:** they answer different questions, and confusing them produces the two failure modes that
actually cost something — putting Sleepy Panda's real internal policy into the public demo, or writing
the demo as merely illustrative when it is the only complete worked example a prospective adopter will
ever read.

**When to apply:** whenever adding workspace content, before choosing where it goes. The test is who the
reader is: ourselves building this repository, a stranger evaluating the product, or Sleepy Panda across
all its products.

Related: [`readme-map-must-match-shape.md`](readme-map-must-match-shape.md).

**Retire when:** the Workspace Definition (milestone 2) names and distinguishes the three formally. The
schema then carries the distinction and this entry becomes redundant.
