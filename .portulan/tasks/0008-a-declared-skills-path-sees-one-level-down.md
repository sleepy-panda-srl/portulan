# Task — a declared skills path sees one level down, so a pack cannot ship skills

**Status. MET at milestone 6, session 0** — by the session that wrote the first pack, which is what the
last sentence below predicted would happen. `.claude-plugin/plugin.json` now declares `./packs/rituals/`
and the three skills of [`rituals/checkpoints`](../../packs/rituals/checkpoints/README.md) resolve at
`<root>/<pack>/skills/<skill>/SKILL.md` — the exact shape named as failing here.

**And *resolve* means resolve for the LINTER, which is narrower than this line reads — amended
2026-08-07.** The goal below is *"a pack can declare its skills under a single path and have them
resolve"*, and what was met is the declaring half: `plugin-lint` walks the declared root, finds the
three, and counts them. **A host registers none of them.** Measured 2026-08-07 on Claude Code 2.1.224,
unchanged from 2026-07-30 on 2.1.220: a pack installed from a feed reports `Skills (0)`, and the public
plugin's own count omits its pack's three. So a pack's skills are invoked by naming their path, and this
status was true of the tool that checks the packaging while being read as true of the platform —
[`../../cli/plugin-lint.mjs`](../../cli/plugin-lint.mjs)'s header now states the same boundary at the
count itself. Host parity is milestone 7's, with
[#134](https://github.com/sleepy-panda-works/portulan/issues/134); the task is not reopened, because
what it asked for was the resolution this tool does.

**Goal.** A pack can declare its skills under a single path and have them resolve. Today it cannot, and
the failure is silent until someone writes the first pack.

**The defect, measured.** `cli/plugin-lint.mjs` resolves a declared skills root two ways and no others:
`<root>/SKILL.md` (the point-at-one-skill form), or the **immediate child directories** of `<root>`. A
skill one level deeper — `<root>/<pack>/skills/<skill>/SKILL.md`, which is the natural shape for a pack
that carries more than skills — resolves `<root>/<pack>` as the skill directory and then **fails** with
`has no SKILL.md`. Read the skill-resolution walk in `cli/plugin-lint.mjs` (the block that expands a declared skills path — line numbers drift; search for the `has no SKILL.md` note it emits).

This blocks the pack manifest planned for milestone 6
([`../proposals/0013-the-architecture-is-extensible-the-product-is-not.md`](../proposals/0013-the-architecture-is-extensible-the-product-is-not.md)),
because carrying skills is most of what a pack is for.

**Acceptance criteria.**

- [x] When a declared skills path contains a skill at any supported nesting depth, the validator shall
      resolve and check it rather than failing the intermediate directory.
- [x] When a directory under a declared skills path is genuinely not a skill and contains none, the
      validator shall still say so — the fix must not turn the existing real failure into silence.
- [x] When the depth limit is reached, the validator shall report that it stopped rather than reporting
      green over what it did not look at. _(The `docs.sh` `map` hole and the `git ls-files` precondition
      are both this same lesson: a check that passes when it could not run is worse than no check.)_

**How each was met.** `expandDeclaredSkillRoot` in [`../../cli/plugin-lint.mjs`](../../cli/plugin-lint.mjs)
returns three lists rather than one — `found`, `barren`, `truncated` — which is the shape the three
criteria above ask for. Barren directories are attributed to the **immediate child** of the declared
root rather than to every level of a dead branch, so one defect stays one failure. The bound is
`MAX_DECLARED_SKILL_DEPTH = 3`, its own constant rather than `MAX_WALK_DEPTH`: one bounds a search of
something the manifest pointed at, the other a sweep of everything it did not.

**Deviation from the Verify line below, stated.** The fixture is built in a temp directory at run time
rather than committed under `cli/fixtures/`, which is the convention `cli/plugin-lint.test.mjs` already
documents in its header and the reason is in it: most of what this validator judges is a *tree shape*,
which a committed file cannot express, and `json.sh` parses every tracked `.json` so a committed
known-bad manifest could not stay malformed. Five tests, three of which were **demonstrated red against
the pre-fix validator** before the fix was believed.

**Verify.** A fixture under `cli/fixtures/` shaped like a pack — skills nested below the declared root —
which is **red now** with `has no SKILL.md` and green when the task is met, plus the existing
no-skill-in-here fixture staying red. Run by `.portulan/verify/tests.sh` and `plugin.sh`.

**Constraints.** The declared-path canonicalisation and symlink-escape refusal must not loosen. The
one-skill (`"./"`) form must keep working. Depth must stay bounded — an unbounded walk over a user's
workspace is its own defect.

**Context.** Found while planning milestones 6, 7 and 11 on 2026-07-27; not fixed in that pull request
because it is a code defect in a shipped checker and that one was a planning change.

**Lane.** full
