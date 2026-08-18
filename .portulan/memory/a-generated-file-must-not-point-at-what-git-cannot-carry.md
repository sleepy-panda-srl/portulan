**type:** rule
**scope:** workspace — Portulan's generated artifacts and its verify recipes
**provenance:** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/117`

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

**How to apply.** When a generated line must reference a location that may not exist, name it as code —
that half is unchanged and is the half that still binds, because it is about what a *generated artifact*
may assert, not about who catches it.

**NARROWED 2026-07-30 — the second half is discharged, and the first is not.** The retirement condition
below was met: `links` now resolves against `git ls-files --cached`, so a local run and a CI run answer
the same question and *this repository's* divergence is gone
([#121](https://github.com/sleepy-panda-srl/portulan/issues/121)). What is deliberately **not** retired
is the rule in the first line. Three reasons, and the third is the one that decides it: a generated file
pointing at what git cannot carry is still wrong in a repository whose checks are weaker or absent —
`vendor` mode ships `.portulan/` to hosts with no recipes at all; the naming repair stands on its own
argument, that a link asserts a resolvable target while a declared location may legitimately not exist
yet, which no check makes true or false; and a rule retired because its *detector* improved is a rule
retired for the wrong reason — the incident can still occur, it is now merely caught. Retiring on
detection would leave the doctrine claiming this cannot happen, which is the overclaim shape this
workspace's principles forbid.

**The withdrawn advice, struck rather than deleted.** ~~When a filesystem-resolving check goes green
locally before a push, verify in a clean clone or remove the untracked thing and re-run.~~ That was the
control while the divergence existed; it is no longer the way this is caught here, and repeating it would
teach a ritual that the rail has replaced. It stays visible because the reasoning behind a discarded
control is the part a later reader cannot reconstruct.

**Retire when:** a generated file cannot express a relative link at all — i.e. generation emits code spans
for every path it did not itself verify as tracked — at which point the rule is unbreakable rather than
obeyed. `cli/index.test.mjs` asserts this for the scope index only; the other generated series are held to
it by review.
