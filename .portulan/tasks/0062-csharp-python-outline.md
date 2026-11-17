# Task 0062 — C# and Python symbol spans

**Lane:** full · **Opened:** 2026-11-17 · **Status:** implemented; review pending

Addresses [#567](https://github.com/sleepy-panda-srl/portulan/issues/567), without
closing a roadmap row. A Node-only lexical scanner extends existing symbol output.

**Acceptance criteria.**

- When a C# file is outlined, namespaces, types and members shall receive complete
  inclusive line ranges, including nested types, attributes, properties, expression
  bodies and regions; accessors and local functions shall remain inside members.
- When a Python file is outlined, classes and functions shall retain decorators,
  complete logical headers and bodies through dedent, including nested definitions.
- When a returned range is passed to the runner parser, it shall select the expected
  original-source declaration; single lines shall print `N-N`.
- When a language or lexical structure cannot be outlined, refusal shall suggest
  bounded declaration search and shall never suggest reading the whole file.
- When `--find` searches tracked code, the new languages shall participate with
  existing immediate-owner semantics and untracked definitions shall stay excluded.

**Plan and opening review.** Fresh session-open APPROVE-WITH-ADJUSTMENTS folded:
enumerate member coverage; test initializer/literal boundaries; retain Python
statement occupancy and indentation; demonstrate actual range consumption; keep
live JavaScript/shell compilation and document the new languages' lexical limits.
Multiple field declarators share one span with name aliases, and same-line siblings
retain source offsets. Conditional C# source explicitly refuses pending preprocessing.

Independent reviews requested corrections for compound operators swallowing members,
tuple-return delegate names, generic/comparison field aliases, Python annotation
colons, raw interpolation and indentation spellings leaking across suites. Each
counterexample received a failing regression before its correction. Full regrade
is required on the repaired tree; the initial sandboxed suite could not exercise
localhost, process inspection and npm packing and supplied no clean full verdict.
The escalated recheck exposed two copied-engine fixtures missing the new scanner
module, plus sibling conditional-initializer, function-pointer and format-text
cases. Both fixture dependency lists and the shared lexical rules were corrected.
Later probes corrected verbatim prefixes and narrowed directive handling; Python
BOMs and escaped C# identifiers now preserve consistent spans and lookup names.

**Verification.** Red-first fixtures, targeted symbol checks, the yielded recipe set,
strict plugin validation, and independent adversarial reviews precede the commit,
remote checkpoint, green CI and authorized merge.
