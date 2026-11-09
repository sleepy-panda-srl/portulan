# Acquired real-session ledger comparison

This capture was acquired from a real Claude Code 2.1.308 request on Portulan,
at source revision `627f3527b1163cbed857863e2ed664dc953aec7d`, on 2026-11-09.
It contains usage metadata, not conversation content. `capture.json` records
the host's own saved totals, independently deduplicated ledger totals, signed
ledger-minus-host differences and the emitted comparison line. This is acquired
evidence, separate from the generator-authored `ledger/` and `ledger-hybrid/` fixtures.

| Tokens | Saved host total | Ledger total | Ledger minus host |
|---|---:|---:|---:|
| Uncached input | 2 | 2 | 0 |
| Cache writes, both lifetimes | 77,208 | 77,208 | 0 |
| Cache reads | 0 | 0 | 0 |
| Output | 26 | 26 | 0 |

The selected transcript has one actual request, one usage record and no duplicate
blocks, subagents or compaction boundary. No cache-read agreement beyond zero is
demonstrated. The existing synthetic fixture exercises those broader cases.

## Acquisition and scope

A bounded `claude -p --tools '' --output-format json
--session-id <new-id>` request asked only for a fixed reply, using the installed
host's default model/effort, normal hooks, permissions and persistence. Built-in
tools were disabled with `--tools ''`; no tool call was recorded. It made
one genuine request and saved its transcript. The headless invocation did not
save a matching project summary, so its result-level usage was **not** substituted
for the host's saved totals.

An ordinary `claude --resume <same-id>` then loaded that session. Local `/exit`
saved a summary bearing the same full session identity and all four numeric
fields. No new model prompt was supplied; the retained usage records remained
identical. The host summary is keyed to the primary project, while the transcript
names the probe worktree. Both roots are represented in the replay. Selected
summary values and transcript bytes were checked stable after shutdown.

The actual ledger CLI was run against the real repository and its normal host
records with `--branch codex/519-real-ledger`. Its emitted comparison agrees with
the replay below after the disclosed identifier/path mapping. This records this
two-invocation lifecycle, not a claim that headless runs always save summaries,
that host counters are bills, or that all real sessions agree.

## Normalization and replay

Private originals include before/after config snapshots, raw result, completed
transcript before/after resume, terminal output, exact invocations and the actual
ledger output. Their byte hashes are in `capture.json`; hashes identify those
originals and do not independently prove their equality to the public capture.
The one-time normalizer is retained privately with them. A fresh checkpoint
compares retained fields against originals independently.

The deterministic mapping is:

- Retain every selected assistant usage record and relevant compaction boundary
  in original order. Retain timestamps, branch, model, effort and chain attribution.
- Keep only the four token counters plus the two cache-lifetime counters under
  `usage.cache_creation`. Drop conversation text, tool payloads and other fields.
- Map nonempty message, request, record and agent IDs to their field kind plus
  the full SHA-256 of the original UTF-8 identifier. Repeated IDs retain equality;
  distinct originals are checked for mapping collisions. The one session maps
  consistently to `real-session`, including the filename and `lastSessionId`.
- Map the worktree cwd to `/work/portulan-real-session` and the distinct host
  summary cwd to `/work/portulan-project`. Compute the transcript directory key
  from the mapped worktree path using the same `projectKey` function. No original
  local path or account configuration is included.
- Copy the four saved `lastTotal*` fields without conversion or zero filling.
  Independently deduplicate raw usage by message ID, taking each class's maximum
  per repeated message, then sum. Compare those totals to the ledger's result.

Replay offline with:

```sh
node cli/ledger.mjs --fixture cli/fixtures/ledger-real-session
```

The existing ledger recipe runs this replay with an empty host environment.
`cli/ledger.test.mjs` additionally pins both comparison vectors, every signed
difference and the printed line; the fixture format alone pins only differences
on its host side. No recipe opens the operator's records or calls a model.
