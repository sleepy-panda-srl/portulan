# Derive init's cutoff from eligible handoffs

**Lane:** full · **Opened:** 2026-11-11 · **Status:** verified

**Goal.** Repair [#639](https://github.com/sleepy-panda-srl/portulan/issues/639), the second M12
closure blocker, after the confirmation repair merged in #637. An unrelated text file shall not
exempt new handoffs from their accepted cap.

**Acceptance criteria.**

- When a record cap is accepted, init shall choose the later of its UTC write day and the newest
  eligible handoff, sharing membership, file type and date rules with the actual index.
- When the series is genuinely absent it shall supply no historic date. Linked, unreadable or
  non-directory boundaries, invalid or over-future selected dates and nonregular selected entries
  shall refuse without writes. Unrelated files shall not advance the cutoff or be opened as bodies.
- When a new 742-token record follows adoption with a 100-token cap and future nonrecord clutter,
  the actual index shall fail. Compressing only that record shall restore green without changing
  the manifest or clutter. Valid historical, today and tomorrow records remain preserved.
- When terminal or unattended adoption is requested, cancellation, EOF, no-default and index-only choices shall
  retain their contracts, as shall the merged confirmation-time guards.

**Session-open.** Independent GPT-6 Astra Extra High returned APPROVE-WITH-ADJUSTMENTS on `6b31c0e5`.
All four groups are incorporated: a shared metadata-only traversal with body checks retained near
index reads; ownership rooted at the target including the workspace parent and true absence only;
trusted record-only/combined cutoff consent distinct from unavailable always projection; and separate
tomorrow-maximum and 742/100 red-to-compression-green fixtures. README exclusion is checked through
the selector/index, preserving init's existing template-collision refusal.

**Verify.** Red-first handoff and init controls, actual terminal adoption, focused Node 20/22/26
checks sequentially, all yielded recipes, strict plugin roots, private publication scan and fresh
pre-commit. No schema, cap, default or milestone-state change is included.

**Limits.** Metadata inspection is a synchronous observation, not a transaction against concurrent
external writers. Index retains ownership of body, heading and token judgments. M12 remains open
for the requested fresh post-merge closure review, followed by a report before further work.

**Implementation evidence.** Before repair, 11 of the first 19 eligibility cases failed and eight
positive/refusal controls passed. All 446 focused index, init and handoff checks now pass on Node
22.23.4 with zero skips. The real terminal accepts the record policy with an accepted or declined
always cap while ignoring future text clutter. Actual index rejects 742 tokens at 100, then passes
after compression alone, preserving the manifest and clutter bytes. A tomorrow maximum has a separate
fixture. Invalid dates/types, disappearing entries and unreadable series refuse without writes;
historical body reads are excluded from cutoff inspection. The FIFO control refuses a selected
Markdown FIFO and accepts the same FIFO as unrelated text within bounded child deadlines.

**Pre-commit corrections.** The independent checkpoint returned REQUEST-CHANGES on staged tree
`99f44d6e4954de93a99e39f915074f7d4715e0fd`: one acceptance bullet lacked an EARS trigger and three
test doubles used direct filesystem replacement instead of scoped Node mocks. The first pass had
30 green recipes and two red, while all 446 focused checks on each supported Node, both strict roots,
32 independent CLI outcomes, 26 real terminal cases and nine red/restoration mutations passed.
The bullet and mocks are corrected.

**Final pre-commit.** Independent GPT-6 Astra Extra High returned APPROVE with no remaining
adjustments on staged tree `1d37f01bcd2e921e9930ec36c9f898e0a7c022e9`. All 32 recipes were rerun
green, including 4,504 tests with zero skips. All 446 focused checks passed on each of Node
20.20.2, 22.23.4 and 26.13.0; both strict plugin roots passed. The reviewer repeated 32 CLI cases,
26 real terminal cases, nine implementation mutations and two authoring-rail red/restorations.
Thirteen publication surfaces passed the private scan. The source freeze was explicitly released
for normal finish. The observation does not establish transaction safety against concurrent writers,
historical merge truth, host calibration, runtime loading or crash rollback. M12 closure stays separate.
