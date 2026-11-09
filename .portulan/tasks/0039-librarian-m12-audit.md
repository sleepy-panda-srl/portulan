# Audit the librarian's milestone-relevant findings

**Lane:** full · **Opened:** 2026-11-09 · **Status:** verified

**Goal.** Audit [#483](https://github.com/sleepy-panda-srl/portulan/issues/483) for row 12, under the
maintainer's instruction to address milestone-relevant findings in one PR and leave the recurring
report open. This is an audit of the report's claims, not authorization to decide every advisory nag.

**Acceptance criteria.**

- When a supported leading Decision/Status outcome is stated, rationale mentioning the old word
  pending shall not reopen it; the parser shall recognize the recorded RULED form consistently.
- When an outcome-shaped declaration is pending, negated, future, quoted, a template or alternatives,
  it shall remain pending even beside a separate closed status in either order.
- When the audited 0001–0040 corpus is compared, only 0003, 0023, 0036, 0037 and 0038 shall become
  settled; every other classification and every proposal source shall remain unchanged.
- When the actual librarian CLI is run on the same tree/date and controlled host state, its proposal
  summary shall reflect that exact change. Neither #483 nor row 12 shall be closed by this PR.

**Plan.** Red-first declaration and live-corpus tests; anchor explicit outcomes to the marker's leading
text or a bounded owner—outcome prefix. Preserve unresolved outcome-shaped declarations; do not infer
a verdict from a narrative word. Run the actual CLI before/after, audit the report categories, then
all yielded recipes, strict plugin validation, private seam scan and a fresh pre-commit checkpoint.

**Session-open.** Fresh-context Sleepy Panda Codex: APPROVE-WITH-ADJUSTMENTS, including the refinement.
Folded: anchored formats instead of an arbitrary paragraph token; false-settlement and conflict tests;
consistent RULED support, including 0023 and compatibility with 0024/0025; exact five-record transition
and unchanged sources; controlled, dated evidence. Proposal 0003 has no explicit because delimiter at
its verdict: splitting on a word inside the later rationale would only work accidentally.

**Controlled evidence.** Baseline `fe05002a`, as-of 2026-11-09. Both actual CLI runs use
`CLAUDE_CONFIG_DIR=/private/tmp/portulan-483-empty-host` and an absent host record, so resolution uses
this tree's packs. The bare host run was refused for installed-versus-derived pack shadowing; this
measurement does not claim a host-independent result. The command is
`node cli/librarian.mjs --as-of 2026-11-09 --report <outside-tree-path> .portulan`.
Before: 40 proposals, 15 pending, 13 overdue. After: 40 proposals, 10 pending, 9 overdue. Only 0003,
0023, 0036, 0037 and 0038 settle. The scheduled issue snapshot says 14 overdue because it precedes
later proposal-source commits; it is not the controlled baseline. No generated report is committed.

**Audit dispositions.**

| Report category | Disposition for this milestone |
|---|---|
| Accepted context proposals 0036/0037 reported pending | Parser defect fixed here, with the same-class 0003/0038 and explicit RULED 0023 cases; no human decision rewritten. |
| Handoff series and its index | The remaining row-12 cap/window demonstration is addressed by [PR 609](https://github.com/sleepy-panda-srl/portulan/pull/609), independently verified; it must merge before closure review. This PR adds no second implementation. |
| Always-tier headroom/demotion | The report mechanism landed in [#508](https://github.com/sleepy-panda-srl/portulan/issues/508). This workspace declares no ratio or always budget; the absence is reported, and no calibration is invented. |
| Store/index/consolidation | The memory index is current and within its declared budget. Historical per-record overages are notes under the existing cutoff, not new reds; rewriting curated rules or changing policy is outside this M12 audit. Same-incident groups remain curation questions. |
| Staleness and sealed stamps | Controlled pass reports zero stale records and zero sealed stamps due; no milestone repair follows. |
| Incident mining and recurring review paths | Advisory prompts to inspect/codify, not evidence that a new rule is owed. Branch-freshness/local-model incidents belong to their own work. The scheduled review corpus was not rerun; its path counts alone establish no M12 defect. |
| Other unresolved proposals | Remain reported for their owners; this audit neither accepts them nor treats every nag as milestone work. |

**Limits.** This is a report classifier, never consent or an authorization gate. It recognizes supported
first-line declarations and owner prefixes up to 160 characters. Unsupported formats need human reading;
the parser proves neither a decision's truth nor the authority of its author. The recurring issue stays
open and its next scheduled pass derives a fresh body; its historical snapshot is not overwritten here.

**Pre-commit.** Independent fresh-context Sleepy Panda Codex: APPROVE, 2026-11-09. The initial
REQUEST-CHANGES identified false settlement of alternatives and modifier forms, and same-line rationale
reopening a clear outcome. These were repaired and their regressions forced red in disposable copies.
All 32 yielded recipes independently passed on the final frozen stage, including the complete suite and
process-control checks. Strict plugin validation passed with the existing missing-icon warning.
The reviewer exercised 574 declaration/conflict/source checks, reproduced 40/15/13 → 40/10/9, confirmed
exactly the five intended transitions and all 40 sources byte-identical, and checked outward text and
the staged diff against the private seam. Scheduled run `6887160d` preceded proposal 0036's subsequent
source commit `90a3e540`, explaining the snapshot discrepancy. No remaining adjustment. Unsupported
prose, decision truth/authority, host-independent resolution and a refreshed review corpus remain
undemonstrated. Signed: independent fresh-context Sleepy Panda Codex checkpoint. Row 12 stays open.
