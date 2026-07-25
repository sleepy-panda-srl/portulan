# Product — Fieldnotes

> The **product layer** for one product. This product declares **no affordances of its own** and
> inherits the workspace default at [`../../affordances.md`](../../affordances.md) — which is the point
> of it appearing in this demo: a workspace covering two products needs to show one of each.
> _(Fictional. See [`../../README.md`](../../README.md).)_

**Mission.** Tell a volunteer, in plain language, what their cooperative is required to record and by
when — and be right about it, in the version of the rules that applied in the season they are asking
about.

**What it is.** A static site: Astro over Markdown content, built and deployed on merge to Netlify. No
database, no runtime, no accounts. Two audiences — cooperative secretaries looking up an obligation, and
prospective customers evaluating [Combcount](../combcount/product.md).

**Why it exists.** Support is three people, and the same six questions arrived every week. Writing the
answers down was cheaper than answering them, and the answers turned out to be the strongest thing we
had to show a cooperative deciding whether to pay us.

**Why it has no affordances file of its own.** Nothing about working here departs from the workspace
default: one command, one review, protected `main`, prose read by a human. Writing a per-product file
that repeated the default would be a file that drifts from it — the second copy is always the one that
goes stale.

**Where the real risk sits, and it is not technical.** The compliance pages read as advice, and
volunteers act on them. A wrong date on a static page is a worse defect than most bugs in the service,
which is why changing public copy is in the Propose tier ([`../../gate-map.md`](../../gate-map.md)) and
why condition 6 of [`../../dod.md`](../../dod.md) exists.

**Stage, honestly.** Live, small, and under-tested in the way static sites usually are: the build is
checked, the prose is not, and the historical-rules-by-season structure is a convention held by whoever
last edited it rather than by anything mechanical.
