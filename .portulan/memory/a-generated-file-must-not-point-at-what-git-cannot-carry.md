**type:** rule
**scope:** workspace — Portulan's generated artifacts and its verify recipes
**provenance:** `form=link` `href=https://github.com/sleepy-panda-works/portulan/pull/117`

**A generated file may not carry a relative link to a path git does not track — and a green from a
filesystem check is scoped to the filesystem it ran on.** Two halves of one incident, and neither is
useful without the other.

Milestone 6's scope index rendered each landed location as a markdown link whose label and target were both
`personas/supervisor/`. The offending form is **described rather than quoted**, and that is the second half
of the lesson: two drafts of this record reproduced the defect, the first by writing the link plainly and the
second by fencing it in backticks — `links` scans the raw text, so fencing exempts nothing. A record about an
unresolvable link cannot contain one. `docs.sh`'s `links` check passed on the author's machine,
where the generator had just created that directory, and **failed in CI on a clean checkout** — because the
location is deliberately **empty** and git records no empty directory. The repair is that the location is
**named** (inline code) rather than linked: a link asserts a resolvable target, while that path is a
*declaration* that may legitimately not exist yet.

**Why it is worse than an ordinary broken link.** It was in a *generated* file, so regenerating reproduced
it exactly; and it was a **local green**, so the author had positive evidence of correctness. Every check
that resolves a path against the working tree has this property: it answers a question about *this* disk,
and CI's disk is the one with only tracked files on it.

**The repair that was refused, and why.** Exempting the index's filename from the link walk would also have
turned CI green. It is the door this repository refuses every time it is offered — the same refusal
`memory.index.path`'s siting rule makes, "rather than teaching one filename to hide from a walk" — because
an exemption is available to every other record afterwards.

**How to apply.** When a generated line must reference a location that may not exist, name it as code. When
a filesystem-resolving check goes green locally before a push, the green covers tracked paths only: verify
in a clean clone, or remove the untracked thing and re-run — which is the control that reproduced this in
both directions.

**Retire when:** `links` resolves targets against `git ls-files` rather than against the working tree, at
which point a local run and a CI run answer the same question and the divergence is unavailable.
