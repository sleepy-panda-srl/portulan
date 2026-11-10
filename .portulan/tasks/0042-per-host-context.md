# Measure each supported project guidance format

**Lane:** full · **Opened:** 2026-11-10 · **Status:** verified

**Goal.** Repair [#615](https://github.com/sleepy-panda-srl/portulan/issues/615), the per-host doctor
finding from M12's independent closure review. The base is `2db7fcdecfe78112b2fe8b8b5e1309b41ee7b7e8`.
The two existing guidance formats define project-file domains, not whole runtime prompts.

**Acceptance criteria.**

- When doctor reads a repository workspace, it shall automatically report Claude Code and root
  vendored AGENTS.md separately, with actual bytes and their largest contributor.
- When one always budget is declared, each host shall be judged independently; their sum shall not
  cause a breach. Either host alone shall become red and return green by demotion with the same cap
  and original body preserved on demand.
- When a root file is absent, its domain shall be zero. When a present root source is unreadable,
  nonregular, dangling or invalid UTF-8, its domain shall be unmeasured; a declared budget shall then
  be unjudged and fail. The other host shall still receive its independent result.
- When measuring AGENTS.md, pointer targets, at-sign expansion and outside bodies shall not be read.
  A shared ratio shall be labeled as extrapolated for each reported format whose ID differs from the
  declared calibration ID; AGENTS shall receive no Claude init/split offer.
- When optional provider counting is requested, both applicable budgets shall be validated before a
  request, whose corpus shall remain Claude-specific. Static mode shall make no provider request;
  agent green shall remain one line and red shall preserve both host reports.

**Plan.** Red-first actual vendor/doctor and independent-domain tests. Reuse registered format labels,
preserve default context/boot/provider APIs, add strict root/source handling and automatic doctor
enumeration, scope advice, update doctrine/spec/help, then run every yielded recipe and strict plugin
validation. Stage the new test before regenerating the CLI roster. Fresh pre-commit and private seam
scan precede commit and PR; this work leaves row 12 in progress.

**Session-open.** Fresh-context supervisor: APPROVE-WITH-ADJUSTMENTS. Folded all four: actual vendor
bytes/top contributor and unchanged pointed-to-body count; independent caps with shared-ratio
qualification; absent versus uncertain roots and explicit intentional exclusions; honest host-specific
advice and provider/brief domains; pointer handling, compact agent output and bounded offline claims.
The existing form report already recognizes an AGENTS boot card, so it remains shared and names the
AGENTS budget precondition before an offered migration. The priced lever report is explicitly Claude.

**Evidence.** Six initial integration tests failed on the unchanged base. The actual vendor command
`node cli/vendor.mjs cli/fixtures/guidance --into <scratch>/.portulan --residence in-repo --host codex --pack-root packs`
produces a 4,605-byte AGENTS.md. Actual `doctor --static --pack-root packs <scratch>/.portulan` now reports
4,605 B (~1,540 tokens at the undeclared 2.99 estimate), then 11,000 B (~3,679) and 22,000 B (~7,358)
when only that file grows; each exits 0 without a declared budget. Claude's zero-byte line stays fixed.
The budget fixture declares 1,000 tokens at 3 B/token: two 2,100-byte hosts each pass although their
sum is 1,400 estimated tokens. Each separately becomes red at 3,300 B and returns green after its
unchanged body moves behind an on-demand pointer; the manifest remains byte-identical.

**Pre-commit revision.** Fresh independent supervisor: REQUEST-CHANGES, 2026-11-09 23:48 UTC.
Two findings were reproduced red first: form advice reopened rejected FIFOs/outside roots (including
an escaping ancestor), and calibration wording assumed Claude. Form's project reads now resolve within
the tree and require regular UTF-8 files; its boot-unit reads stay within the workspace. Shared
instruction-state, split-advice and instruction-file readers reject nonregular sources before I/O and
preserve the provided reader for prospective files. Valid local links retain card/marker reporting.
Read spies record canonical opens and assert after the report, so an implementation cannot mask their
assertions as an expected unreadable result. Removing either the AGENTS or instruction containment
guard now fails the disposable controls; both pass after restoration. Matching, nonmatching and
unknown calibration IDs label both formats correctly without a schema change. The seven focused
context/doctor/provider/lever/form/instruction suites passed 520 checks; the second independent
checkpoint is recorded below.

**Final pre-commit.** Independent fresh-context supervisor: APPROVE-WITH-ADJUSTMENTS,
2026-11-10 00:05 UTC, base `2db7fcdecfe78112b2fe8b8b5e1309b41ee7b7e8`, reviewed staged SHA-256
`f9034635f88cf152ecac27b3d445dd589bfb08caad8b6756409ef0e2ccabb379`. Both remaining prose adjustments
were folded: the field table/criterion describe matching and nonmatching calibration IDs, and this
verdict is recorded. The reviewer cleared those edits with docs and seam checks. All 32 yielded
recipes passed, including 3,643 tests on Node 22.23.4; 520 focused checks passed on Node 20.0.0.
Eight deliberate regressions tripped their expected controls, including the previously surviving
outside-read case. Actual vendor, both budget demotions, FIFO termination, outside ancestors and
provider preflight reproduced independently. Strict plugin validation passed with its existing
missing-icon advisory; seam scan clean. Whole-host loading, production calibration, live provider
behavior, concurrent malicious filesystem swaps and the other M12 criteria remain undemonstrated.

**Limits.** AGENTS is the root vendored format, not a discovery adapter for every host that can read
that filename. Ancestor/personal/plugin/nested files and pointer bodies are excluded. A declared ratio
calibrates the named host; its use on another format is an extrapolated estimate. Claude's intentionally
excluded external imports and ignored missing/depth-limited imports are not failures to measure the
defined domain. An escaping AGENTS root is uncertain, not an empty domain. The new measurer's direct
file-read guard and injected transports check its offline boundary; doctor --static still performs its
existing plugin/pointer discovery. No live provider call, production calibration, native host loading,
complete footprint rail, compiler binding repair or milestone closure is established here.
