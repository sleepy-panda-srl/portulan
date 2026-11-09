# Task 0028 — HTML block boundaries after a list

**Lane:** full · **Opened:** 2026-11-09 · **Status:** approved for PR

**Goal.** Resolve [#472](https://github.com/sleepy-panda-srl/portulan/issues/472):
recognize CommonMark type-1/type-6 HTML block starts immediately after a list
when compiling its leads.

**Acceptance criteria.**

- When an unindented type-1 or type-6 HTML block start follows the first list,
  compilation shall keep exactly that list's leads and omit subsequent items.
- When an inline tag, tag-name prefix, invalid delimiter or lowercase CDATA
  follows an item without a blank line, compilation shall retain its existing
  lazy-continuation refusal, name the line and write nothing.
- When a closed type-1 block ends a list before a code-span paragraph, the shared
  import reader shall stop treating that paragraph as raw list text.

**Plan.** Add failing tag-matrix and compiler tests; combine the existing
case-sensitive block predicate with case-insensitive type-1/type-6 tag matching
at both consumers; remove the obsolete limitation comment; add a changelog
fragment; run the focused suites and every yielded recipe, obtain independent
pre-commit review, seam-scan, then finish and open one labeled PR.

**Session-open.** Independent reviewer `/root/checkpoint_472_open` returned
APPROVE-WITH-ADJUSTMENTS: distinguish raw-tag adjacent self-closing syntax from
a space delimiter; reject prefixes, arbitrary slash continuations and non-ASCII
whitespace; use a closed single-line raw block for the import regression; pin
uppercase versus lowercase CDATA. All adjustments are included in the plan.

**Verify.** `node --test cli/compile.test.mjs cli/context.test.mjs`, then every
recipe yielded by `node cli/recipe-set.mjs --workspace .portulan --repo-root .
--pack-root packs`. The new regressions must fail before the compiler change.

**Evidence.** The new positive boundary and closed-block import regressions failed
before the implementation; negative cases retained their refusal. Afterwards all
640 tests in the compiler and context suites passed.

**Pre-commit.** Independent reviewer `/root/checkpoint_472_precommit` returned
APPROVE on 2026-11-09, with no required adjustments. Every yielded recipe passed
independently (31/31), including 3,430 tests across 65 files. Scratch probes checked
the full tag/delimiter matrix and invalid lookalikes; the new tests rejected
overbroad HTML matching, case-folded CDATA and a missed import-reader sibling fix.
The reviewer preserved the staged implementation byte for byte. Final seam scanning,
the finishing command and GitHub checks follow this checkpoint.

**Limits.** This repairs a boundary under row 12, without closing that milestone.
General HTML import parity remains [#471](https://github.com/sleepy-panda-srl/portulan/issues/471).
No live-host demonstration is claimed. The source is
[CommonMark 0.31.2, HTML blocks](https://spec.commonmark.org/0.31.2/#html-blocks).
