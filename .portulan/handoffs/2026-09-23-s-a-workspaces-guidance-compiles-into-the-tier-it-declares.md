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
never deleted and the proof costs no context. *Its other rulings*: the tier words are `0036`'s four exactly;
the on-read index is one level deep, a pointer per unit and nothing else; the MINOR is taken independently of
`0038`'s keys, and whichever merges second takes the next one; the `doctor.mjs` edit is its gate lines only;
no content moves in this workspace, because the curated layer is the maintainer's, so this repository
declares no guidance and its boot read-set, rails and vendored skeleton are unchanged; and `doctor`'s
degradation report stays the doctor-report change's, reading the tier table this one exports. This change's
own two: **a slot, not a key**, because the spec pairs content in a slot with machine configuration in a key,
as `slots.memory` and `memory` do, and 2.9's `context` is the machine half; and **frontmatter**, because every
host's own form is frontmatter, so one source maps onto each.

**What `compile` owns, and what it never touches.** It owns `.claude/rules/portulan/` and proves it with a
marker, `.compiled`, written before the first rule and loaded by no host, because Claude Code loads only
`.md` files as rules. Where the marker is, a rule no unit compiles to is removed and named; where the
directory holds Markdown files without it, `compile` stops with exit 2, under `--check` too, and touches none
of them; anything else there is named and left, red under `--check` until a human moves it. A workspace that
owes no rule leaves an unmarked directory alone. A compiled skill carries a comment naming its unit, because
`.claude/skills/` is shared: a skill without that comment is never replaced (exit 2, nothing written), and
only a marked one is removed. It never writes `CLAUDE.md`, which adopters write by hand. A workspace
declaring guidance and no gate policy now compiles its guidance and says no enforcement is compiled; one
declaring neither still exits 2.

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

**How it was checked.** 44 new cases in [`cli/compile.test.mjs`](../../cli/compile.test.mjs) (418): the
vocabulary, every refusal the slot's contract names, each emitted form byte for byte, drift, removal, the
marker present and absent, a hand-written skill, `--matrix`, and that this repository carries no compiled
guidance. Two in
[`cli/vendor.test.mjs`](../../cli/vendor.test.mjs) (72) and four in
[`cli/doctor.test.mjs`](../../cli/doctor.test.mjs) (254). As root, `doctor`'s 4, `index`'s 5 and
`librarian`'s 1 permission cases fail, identically on `457b0b6`; all 28 recipes ran green as a non-root
user on a copy of this tree.

**Checkpoints.** Skipped by his instruction of 2026-09-23 12:38: no fresh-context runs unless he asks. The
coordinator session reviewed the diff before the commit; his review is on the pull request.

**Next action.** His review of the pull request. Then `0036`'s next items: the degradation report in
`doctor`, persona frontmatter, and the demonstration on the fixture.

**Recoverability.** Nothing is partial: `compile` writes no guidance in this repository, and a unit that
fails to parse stops the run before any file is written.
