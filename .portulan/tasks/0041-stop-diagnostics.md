# Preserve failure diagnostics in the Stop relay

**Lane:** full · **Opened:** 2026-11-10 · **Status:** verified

**Goal.** Repair [#613](https://github.com/sleepy-panda-srl/portulan/issues/613), the Stop diagnostic
demotion required by proposal 0036 and independently found missing at M12 closure. The merged baseline
is `2db7fcdecfe78112b2fe8b8b5e1309b41ee7b7e8`. This item neither closes M12 nor changes retry policy.

**Acceptance criteria.**

- When a red recipe emits a recognized failure before success noise, Stop shall retain that failure
  and bounded detail, including when later output exceeds the runner's 64 KiB tail.
- When recognized passing lines contain error or FAIL in test names, they shall remain omitted;
  unrecognized fallback shall be labeled, and success-only nonzero output shall identify no diagnostic.
- When output is chunked, interleaved across callback streams, Unicode, unterminated or oversized,
  the diagnostic excerpt shall fit 4,096 UTF-8 bytes and the whole recipe problem shall fit 6,144.
- When execution times out, is interrupted or cannot spawn, its diagnostics shall have reserved space;
  a green execution shall still return no recipe problem. Existing retry and cleanup checks shall pass.

**Plan.** Red-first real/injected executor tests; stream a bounded line collector through the existing
runner callback without changing shared execution semantics. Prioritize recognized failures and eight
indented detail lines per marker; keep a separate labeled fallback. Reserve executor diagnostics and
an explicit verification instruction. Update the stale machinery claim, regenerate the hook-source
golden and CLI roster, run all yielded recipes, strict plugin validation and the private seam scan.

**Session-open.** Fresh-context GPT-6 Astra Extra High, 2026-11-09 22:22 UTC:
APPROVE-WITH-ADJUSTMENTS. Folded all four: same-fixture byte/line measurements; repository/TAP failure
and successful-name precedence, success-only refusal and reserved runner reasons; separate stream and
UTF-8 boundaries; truthful matrix/Stop status while other M12 obligations remain open.

**Evidence.** The first focused pass on unchanged implementation failed eight of nine tests; green
execution was the control. Focused checks cover diagnostics, Stop behavior and recipe process cleanup.
Two additional compiler-location and oversized-executor regressions also failed before their repairs.
In the same cwd, import the baseline and current `cli/stop-gate.mjs` and
call `runStopRecipe` with id `diagnostic`, timeout 10 and this command:

```bash
printf 'FAIL-critical\n  expected budget <= 200\n' >&2
for ((i=1;i<=30;i++)); do printf 'PASS-%s padding-padding-padding\n' "$i"; done
exit 1
```

Count the rendered problem and its segment after the first newline as UTF-8 bytes. The same recipe
identity and root give 885 → 177 whole-message bytes and 795 → 87 excerpt bytes. Failure lines:
0 → 1; success lines: 25 → 0. The excerpt drops 708 bytes (89%) while restoring the failure and its
detail. The independent 4,000-success-line regression exceeds 64 KiB and retains the stderr failure.

**Pre-commit revision.** The first fresh review returned REQUEST-CHANGES, 2026-11-09 22:36 UTC.
Its three findings were reproduced before repair: a partial stdout success swallowed a stderr failure;
passing TAP headings and zero-fail/spec summaries displaced real errors; cleanup reasons displaced a
structured interruption and a spawn reason was duplicated as child output. Stop now requests separate
streams, skips neutral/passing reporter records, reserves structured execution causes first and removes
the runner-appended suffix from an unobserved raw-output fallback. Sixteen diagnostic checks pass,
including actual reporter runs with 130 passes before a true assertion, a real test-owned group denied
cleanup, and Bash unavailable. Their nested node:test invocation unsets NODE_TEST_CONTEXT so it runs
the invented tests rather than passing through the parent runner's recursion guard.

The second review returned REQUEST-CHANGES, 2026-11-09 22:43 UTC: passing suite/skip names and expected
TODO failures still looked red, and a broad YAML-prefix filter swallowed ordinary command errors.
Real TAP/spec mixtures now prove pass, skip, TODO (including an expected assertion) and a subsequent
genuine failure. Neutral metadata uses exact delimiters and narrow values. Expected diagnostic blocks
end at their delimiter before a following indented real error. Nineteen diagnostic checks pass; these
new boundaries were also observed red first.

**Final pre-commit.** Fresh-context GPT-6 Astra Extra High: APPROVE, 2026-11-09 22:49:15 UTC,
base `2db7fcdecfe78112b2fe8b8b5e1309b41ee7b7e8`, reviewed staged SHA-256
`1caa2d7b8a625ae0a23081df51d4c82af1bd9753a726d2bffecf17edd80da644`. All 32 yielded recipes,
125 focused tests and 19 diagnostic checks passed independently. Thirteen disposable mutants triggered
their regressions and passed after restoration. The original byte/line figures reproduced exactly.
Strict plugin validation passed with its existing missing-icon advisory; the private seam scan was
clean. No adjustments remained; ordinary verdict bookkeeping was explicitly cleared. Native Windows,
arbitrary-log understanding and the other M12 exit obligations remain undemonstrated.

**Limits.** Marker recognition is a bounded heuristic, not arbitrary-log understanding. Each stream
retains at most 1,024 raw bytes per line; larger lines are marked clipped. First recognized failures
take precedence; excess diagnostic lines are counted as omitted. Separate bounded fallback cannot
crowd out failures. Full output is available by running verification explicitly, not from a persistent
hook log. The recipe text ceiling does not cover unrelated handoff text. Other M12 closure findings,
including full own-footprint rails and successful provider counting, remain outstanding.
