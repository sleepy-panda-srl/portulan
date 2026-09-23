# Handoff — 2026-09-23: a workspace's guidance compiles into the tier it declares

**What landed.** Proposal [`0036`](../proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md)'s
Claude Code compile targets, in two commits. First, Workspace Definition **2.10**: one optional slot,
`slots.context`, a directory of Markdown units, each naming in its frontmatter one of the four load tiers
of [`core/operating/context.md`](../../core/operating/context.md) (`tier`, with `paths` for `on-path` and a
one-line `description` for every tier but `always`), argued in [`spec/slots.md`](../../spec/slots.md) and
recorded in [`spec/README.md`](../../spec/README.md); `doctor` checks the slot's path and refuses it before
2.10, and `index` and `librarian` know the version. Second, [`cli/compile.mjs`](../../cli/compile.mjs)'s
section 3c: an `always` unit becomes an unscoped rule in `.claude/rules/portulan/`, an `on-path` unit a rule
scoped by `paths:`, an `on-invoke` unit a project skill in `.claude/skills/<unit>/`, and each `on-read` unit
one line in `.claude/rules/portulan/on-read.md`, naming the unit's file and its description and nothing else.
`--check` byte-compares every file against its unit, so the existing `compile` recipe reds a stale one.
The `AGENTS.md` that `vendor --host` writes carries the `always` units inline and every other unit as a
one-line pointer: a tier a host cannot express degrades to a pointer, never to nothing. `--matrix` and every
run say which tiers each host expresses and which units degrade; the table is `GUIDANCE_HOSTS`, exported.

**Decisions + why.** Four are the coordinator session's delegated call of 2026-09-23, taken on the
maintainer's delegation of design questions, with its reasons. *Option A over B and C: one pull request,
two commits, the key first*, the form #440 used for 2.9. Compiling only what 2.9 declares, B, would save
nothing, and the point of this piece is the home an adopter needs to move a large instruction file's sections
into on-path rules and on-read files from one source; the key in a pull request of its own, C, buys no review
a separate commit does not, and would cost a second branch or a merge-serialised wait. *`examples/`
untouched, with a fixture as row 12's on-path target*: [`spec/README.md`](../../spec/README.md) keeps the demo
on 2.4, six MINORs behind at 2.10, as compatibility evidence, and `doctor` would refuse the slot below 2.10,
so the target is the committed fixture [`cli/fixtures/guidance/`](../../cli/fixtures/guidance/), one unit per
tier, which the tests compile. *Ownership proven by a marker*: `compile` removes only what it can show it
wrote, and shows it with a file no host loads rather than a mark in each rule, so a rule written by hand is
never deleted and the proof costs no context; the call's final form, confirmed after Copilot's first round,
is a marker listing each rule it wrote. *Its other rulings*: the tier words are `0036`'s four exactly;
the on-read index is one level deep, a pointer per unit and nothing else; the MINOR is taken independently of
`0038`'s keys, and whichever merges second takes the next one; the `doctor.mjs` edit is its gate lines only;
no content moves in this workspace, because the curated layer is the maintainer's, so this repository
declares no guidance and its boot read-set, rails and vendored skeleton are unchanged; and `doctor`'s
degradation report stays the doctor-report change's, reading the tier table this one exports. This change's
own two: **a slot, not a key**, because the spec pairs content in a slot with machine configuration in a key,
as `slots.memory` and `memory` do, and 2.9's `context` is the machine half; and **frontmatter**, because every
host's own form is frontmatter, so one source maps onto each.

**What `compile` owns, and what it never touches.** It shows which rules in `.claude/rules/portulan/` are its
own with a marker, `.compiled`, written after the rules it lists and cut before any is removed, so a run
stopped part-way never leaves a name listed that it did not write, loaded by no host because Claude Code loads
only `.md` files as rules, and listing each rule it wrote. A listed rule no unit compiles to is removed and
named. A rule it does not list is the team's: named and left, red under `--check` until a human moves it, and
never replaced, so a unit that would compile onto one stops with exit 2. It stops with exit 2, under `--check`
too and before anything is written, where the directory holds Markdown files and no marker, where the marker
is not in the form it writes, and where any path it would write is a link or lies through one, even a link
that stays inside the repository. A workspace that owes no rule leaves an unmarked directory alone, and a
directory reached through a link is never listed or tidied. A compiled skill carries a comment naming its unit
as the line after its frontmatter, because `.claude/skills/` is shared: a skill without that line, or whose
line names another unit, is never replaced (exit 2, nothing written), only one carrying it is removed, and
text quoting it elsewhere grants nothing. The slot may not lie where `compile` writes, in `.claude/` or the
workspace's `compile/`, and no unit may be a link into either. It never writes `CLAUDE.md`, which adopters
write by hand. A workspace declaring guidance and no gate policy now compiles its guidance and says no
enforcement is compiled; one declaring neither still exits 2.

**The measure agrees.** [`cli/context.mjs`](../../cli/context.mjs), untouched, counts the fixture's compiled
`always` rule, its index and its skill's description as always-loaded and the `on-path` rule as scoped; a
case holds the two modules to that.

**Open.** `doctor`'s degradation report, reading `GUIDANCE_HOSTS`, is still to land: the doctor-report
change merged first and left it for after this one. That change rewrote the "What is machinery today"
paragraph of `context.md`, so this one adds only a paragraph under the four tiers and strikes the compile
targets from that paragraph's list still to land. `0036` names nested instruction files beside path-scoped rules as on-path, and only the rule form is
emitted here: the nested-file form is a gap left open. Persona frontmatter, row 12's other compile target,
is a later change, and so is any host beyond Claude Code and `AGENTS.md`. Row 12's second demonstration, a host loading the fixture's `on-path` rule when
`api/` is first touched and not before, needs a host session; the fixture is its target.

**How it was checked.** 57 new cases in [`cli/compile.test.mjs`](../../cli/compile.test.mjs) (431): the
vocabulary, every refusal the slot's contract names, each emitted form byte for byte, drift, removal, the
marker present, absent and forged, a rule and a skill written by hand, a skill quoting the mark or compiled
from another unit, a slot and a unit where `compile` writes, a run stopped before its marker or its removal,
links at and on the way to every target, inside the repository and out, `--matrix`, and that this repository
carries no compiled guidance. Three in [`cli/vendor.test.mjs`](../../cli/vendor.test.mjs) (73) and four in
[`cli/doctor.test.mjs`](../../cli/doctor.test.mjs) (260). As root, `doctor`'s 4, `index`'s 5 and `librarian`'s
1 permission cases fail, identically on `6e3aae6`; all 28 recipes ran green as a non-root user on a copy of
this tree.

**Copilot's rounds.** Review 5296505043 on `1c72010` found five things, all fixed in the third commit. The
directory marker trusted any file named `.compiled` and any Markdown beside it, so a rule added by hand after
the first compile would have been removed, which the coordinator's call meant never to happen: the marker now
lists each rule it wrote, is trusted only when it reads exactly as this compiler writes one, and grants
nothing else. Writes followed links, so a linked rule or directory could send guidance out of the repository:
every path is judged before anything is written. A quoted description could spell a line break and so write a
second pointer line: descriptions and globs refuse control characters. The schema's pairing sentence named the
wrong pair. The coordinator session confirmed the listing marker as its call's intent. Review 5296849633 on
`f931e19` found one more, fixed in the fourth commit: a rules or skills directory reached through a link that
stays inside the repository was still listed and tidied, so a removal could delete a file where the link
points. Every part of a path is now judged with `lstat`, so a link anywhere on it, inside the repository or
out, stops a write, and a directory reached through one is never listed. Review 5297009544 on `6e6201e` found
three, fixed in the fifth: a slot in `.claude/rules/portulan/` would have had its units overwritten by their
own output, and one in `.claude/` gave `AGENTS.md` pointers to files `vendor` does not carry, so a slot in
`.claude/` or the workspace's `compile/`, or a unit linked into either, now stops `compile` and
`vendor --host` with exit 2; and a skill quoting the mark anywhere was taken for compiled, so the mark now
counts only as the line after the frontmatter, naming this unit. Review 5297050727 on `bf9dd5d` found one
more, fixed in the sixth: the marker was written before its rules, so a run stopped between would have listed
a rule never written, and a file put there later would have been taken. The marker is now written after its
rules and cut before a removal, and a rule a stopped run left unlisted is taken back only when it is byte for
byte what its unit compiles to.

**Checkpoints.** Skipped by his instruction of 2026-09-23 12:38: no fresh-context runs unless he asks. The
coordinator session reviewed the diff before the commit; his review is on the pull request.

**Next action.** His review of the pull request. Then `0036`'s next items: the degradation report in
`doctor`, persona frontmatter, and the demonstration on the fixture.

**Recoverability.** Nothing is partial: `compile` writes no guidance in this repository, and a unit that
fails to parse stops the run before any file is written.
