# Task — a declared skills path sees one level down, so a pack cannot ship skills

**Goal.** A pack can declare its skills under a single path and have them resolve. Today it cannot, and
the failure is silent until someone writes the first pack.

**The defect, measured.** `cli/plugin-lint.mjs` resolves a declared skills root two ways and no others:
`<root>/SKILL.md` (the point-at-one-skill form), or the **immediate child directories** of `<root>`. A
skill one level deeper — `<root>/<pack>/skills/<skill>/SKILL.md`, which is the natural shape for a pack
that carries more than skills — resolves `<root>/<pack>` as the skill directory and then **fails** with
`has no SKILL.md`. Read at `cli/plugin-lint.mjs:428–462`.

This blocks the pack manifest planned for milestone 6
([`../proposals/0013-the-architecture-is-extensible-the-product-is-not.md`](../proposals/0013-the-architecture-is-extensible-the-product-is-not.md)),
because carrying skills is most of what a pack is for.

**Acceptance criteria.**

- [ ] When a declared skills path contains a skill at any supported nesting depth, the validator shall
      resolve and check it rather than failing the intermediate directory.
- [ ] When a directory under a declared skills path is genuinely not a skill and contains none, the
      validator shall still say so — the fix must not turn the existing real failure into silence.
- [ ] When the depth limit is reached, the validator shall report that it stopped rather than reporting
      green over what it did not look at. _(The `docs.sh` `map` hole and the `git ls-files` precondition
      are both this same lesson: a check that passes when it could not run is worse than no check.)_

**Verify.** A fixture under `cli/fixtures/` shaped like a pack — skills nested below the declared root —
which is **red now** with `has no SKILL.md` and green when the task is met, plus the existing
no-skill-in-here fixture staying red. Run by `.portulan/verify/tests.sh` and `plugin.sh`.

**Constraints.** The declared-path canonicalisation and symlink-escape refusal must not loosen. The
one-skill (`"./"`) form must keep working. Depth must stay bounded — an unbounded walk over a user's
workspace is its own defect.

**Context.** Found while planning milestones 6, 7 and 11 on 2026-07-27; not fixed in that pull request
because it is a code defect in a shipped checker and that one was a planning change.

**Lane.** full
