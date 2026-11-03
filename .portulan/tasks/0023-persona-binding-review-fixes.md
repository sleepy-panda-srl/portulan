# Task 0023 — contain and uniquely own persona bindings

**Lane:** full · **Opened:** 2026-11-03 · **Status:** implemented; verification before push

The maintainer requested the three review fixes on [PR #559](https://github.com/sleepy-panda-srl/portulan/pull/559).

**Acceptance criteria.**

- When a binding resolves outside the real declared tree through a parent link, compile and check
  shall refuse before writing any artifact or changing the external file; contained links remain usable.
- When composed personas name one binding, compile and check shall refuse with both sources before
  emission, including identical declarations, a converged first owner, no fields and unbound owners.
- When omitClaudeMd is not unquoted true or false, persona validation and compiled-block parsing shall
  reject it, including constructor, __proto__ and toString; valid booleans retain their meaning.

## Plan

Merge current main without rewriting remote history. Validate binding real paths before planning
writes; register destination ownership before shortcut paths; share an explicit boolean reader across
both parsing sites. Cover whole-compiler no-write refusals and doctor/parser cases, retain ordinary
and contained-link convergence, and update the contract/changelog. Run targeted red/green tests,
all yielded recipes, independent pre-commit and private scans, then push the existing PR branch.

Fresh session-open, Codex, 2026-11-03: **APPROVE-WITH-ADJUSTMENTS**. Folded the second boolean lookup
and destination ownership before no-fields, unbound and converged shortcuts. New regressions first
failed against the prior implementation. Final verification and independent verdict are in the commit.
No milestone or autonomy-policy change. A live host honouring emitted frontmatter remains untested.
