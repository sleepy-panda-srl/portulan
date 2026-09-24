# Handoff — compile follow-ups to the compile targets and the boot card

**State.** Six commits, each carrying its why: a `gates` key `compile` refuses stops it beside guidance
too; guidance a workspace with no gate policy stops declaring is tidied; the doctrine rule names the steps
the engine rail counts; `leadsOf` refuses a line with no indent straight under an item; a code span or a
comment in a list item's text hides no import, as the host reads it; and the refused key stops `compile`
and `goldens` beside a `gates.json` found by convention as well. Pre-commit checkpoint: skipped by his
instruction of 2026-09-23 12:38 (no fresh-context runs unless he asks); the coordinator session reviewed
the first five before the push and reviews the sixth, a Copilot fix, after it; his review is on the PR.

**Open questions.**
- A `workspace.json` that does not parse, compiled from the repository root beside a `gates.json` found
  by convention, is still read as declaring no guidance: `--check` calls every compiled rule and skill a
  stray, and a write removes them all, until the manifest parses and a compile writes them again.
  `resolveWorkspace` refuses such a manifest only when `--workspace` names the workspace directory, and
  `policyDeclaration` reads one as absent on purpose, so whether a manifest that does not parse stops
  `compile` outright is the maintainer's call, or the coordinator session's on his delegation.
- `leadsOf` still ends a list early, without a word, at a fence indented inside an item, and at an item
  of the same kind written with a tab after its marker, or a bare marker.
- `importSpans` still differs from the host. Outside lists it misses an import in a code span on a line a
  comment opens, and one straight after emphasis, an escape or a tag (`**x**@a.md`); it reads one the
  host does not in a code span split across two lines, in an HTML block or indented code, and under a
  fence indented four spaces or more. Inside lists it differs at the limits its comment names: a list in
  a block quote, and a paragraph after a nested list, a tag, an indented code block or an HTML block in an
  item.

**Next action.** The call on the unparsed manifest; the other two are fixes with a case each.
