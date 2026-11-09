# Task 0033 — Markdown heading compatibility

**Lane:** full · **Opened:** 2026-11-09 · **Status:** approved for PR

**Goal.** Resolve [#475](https://github.com/sleepy-panda-srl/portulan/issues/475):
retain autolink text in anchors, decode character references, preserve ATX content,
and recognize top-level setext paragraphs indented one to three spaces.

**Acceptance criteria.**

- When a heading contains an autolink or reference, its rendered anchor shall
  resolve through section reads with the correct span and byte count.
- When decoding named or numeric references, the reader shall preserve literal
  code, escaped references and unknown names; decoded punctuation shall stay text.
- When an ATX title has closing hashes, the reader shall retain its content
  according to ASCII separator rules, including empty and escaped cases.
- When a top-level setext paragraph is indented one to three spaces, it shall
  enter the outline; ordered, loose, lazy and nested list continuations and
  four-space code shall stay outside it.

**Plan.** Fix the parser, update
its limit comment and generated roster, add a fragment, run all yielded recipes,
obtain fresh-context pre-commit review, seam-scan and finish one labeled PR.

**Session-open.** Independent `/root/checkpoint_475_open` returned
APPROVE-WITH-ADJUSTMENTS: cover all four shapes through observable reads; use the
complete semicolon-terminated named table; pin ATX empty/separated/escaped hashes;
test ordered, blank-separated and lazy list continuations; regenerate the roster
from its source. All adjustments are included. Row 12 stays open.

**Limits.** Headings within list containers and full CommonMark block parsing are
outside this repair. No live-host context-loading demonstration is claimed.
Character references and heading syntax follow
[CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/).

**Review repair.** Independent `/root/checkpoint_475_precommit` requested changes:
retain an outer list's indentation across nested items, count tab columns in list
markers, and distinguish paragraph item starts from headings. A new regression
failed before the repair; the list reader now preserves the outer container and
computes its padding in columns. The complete named-reference table was checked
independently against Python's HTML5 mapping. Whole-diff re-review follows.

A second independent pass found a deeper nested lazy continuation and two isolated
fixtures missing the new static module. Its full recipe run passed 30 recipes;
the test recipe exposed both missing copies. Container indentation now uses a
stack, with a pre-repair failing regression for the nested case. Both explicit
fixture dependency lists carry the new module. Whole-diff re-review follows.

**Pre-commit.** Independent `/root/checkpoint_475_precommit` returned
APPROVE-WITH-ADJUSTMENTS on staged tree `98d58a9707ad1d723a6b28243ed7035a6e51146c`:
record this evidence and grade that documentation-only fold. All 31 yielded
recipes passed independently, including 3,472 tests. All six added regressions
failed original code and passed the staged code in isolated copies. All 2,125
named mappings match the primary WHATWG table; exhaustive code/escape probes,
numeric boundaries and CRLF spans passed. Strict plugin validation exited zero
with existing icon and ignored-file warnings. The private seam scan passed,
including nine planted refusal controls. Source and staged bytes stayed unchanged.
Full CommonMark parsing, list-container headings, live-host loading and the
remaining row-12 demonstrations remain undemonstrated. Final fold review and the
finishing command follow; this records no milestone closure.
