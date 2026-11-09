# Task 0034 — refuse unsupported import regions

**Lane:** full · **Opened:** 2026-11-09 · **Status:** approved for PR

**Goal.** Resolve [#471](https://github.com/sleepy-panda-srl/portulan/issues/471)
by the issue's explicit refusal route, preserving the proven reader's behavior.

**Acceptance criteria.**

- When an import candidate occurs in any region the issue identifies as
  unsupported, every shared-reader consumer shall refuse it by construct name.
- When syntax has no import or an unrelated import lies outside its affected
  region, the reader shall retain supported behavior, including email, code,
  comments, lists, fences and exact source offsets.
- When the compiler refuses direct or nested imports, normal, check and matrix
  modes shall change no output. Context shall report a typed could-not-run
  result naming the file and construct, including nested imported files.
- When instruction rewriting reads such imports, the same refusal shall apply.

**Plan.** Preflight original source inside `importSpans`, before its existing
masking and list classification. Name bounded unsupported regions rather than
claim complete Markdown or host-lexer parity. Add failing compiler/context
cases, preserve controls, update the spec's guarantee, run every yielded recipe,
obtain independent pre-commit review, seam-scan and finish one labeled PR.

**Session-open.** Independent `/root/checkpoint_471_open` returned
APPROVE-WITH-ADJUSTMENTS: inspect original source in the shared reader; bind
refusals to affected regions; separately exercise every construct and offsets;
test public boundaries and nested imports; update `spec/slots.md`. Included.
This branch starts at `9b47fa25` and has no dependency on open PR #597.
Row 12 stays open; no live-host parity demonstration is claimed.

**Focused evidence.** The compiler/context refusal regressions failed before
implementation. All 696 compiler, context and instruction tests now pass,
including all named issue shapes, no-import/unrelated-import controls, CRLF and
UTF-16 offsets, preservation of compiled artifacts, nested context reads and
instruction planning/writing refusal. The comment and task rails pass without
raising a budget. Independent full-recipe review follows.

**Review repair.** Independent `/root/checkpoint_471_precommit` ran all 31 recipes
green, including 3,471 tests, but requested changes for supported multiline
comment prefixes, repeated blockquote prefixes, and imports on nested items.
New compiler/context regressions failed before the repair. Preflight now skips
the supported comment prefix before classifying the remainder, tracks its offset,
recognizes repeated quote markers, and marks nested-item state without refusing
the item itself. Whole-diff re-review follows.

**Pre-commit.** Independent `/root/checkpoint_471_precommit` returned
APPROVE-WITH-ADJUSTMENTS over `482425ece208bb3cb9df70f7fbe39edb6ca54a2c`.
All 31 recipes and 3,472 tests passed independently; strict plugin validation and
private seam scans passed. Five isolated mutations demonstrated the regressions.
The two adjustments are folded: quote/list state tracks content indentation and
paragraph flow, including lists in outer item content; and HTML/fence regions
start at the visible suffix after a consumed comment prefix. Compiler/context
controls cover quoted blank/heading boundaries and hidden-prefix regions.
The source/test/record delta requires independent fold review before commit.
Complete CommonMark parsing, live-host parity and milestone closure remain
undemonstrated. The final finishing command reruns every recipe.

The first fold's independent review passed all 697 affected tests and four
recipes (docs, comments, compile, context), then required two further classifier adjustments: an unquoted/shallower
blank or outside fence ends quote-list context, and consecutive outer item
prefixes are consumed. New compiler/context controls failed before those fixes.
The next delta is graded against `812d71701f47b85117bcd52606efdf53db837d07`.

**Source-fold approval.** Independent review approved the source/test fold at
`0619bf80600bd3a7f4893954811e7ed5a7f74069`: 697 targeted tests and those four
recipes passed; new tests failed against the prior tree and separate probes
confirmed all four repaired defects. Both consumers passed supported-boundary
and named-refusal controls. The sole remaining adjustment corrects the recipe
count above and records this result, followed by a documentation-only check.
