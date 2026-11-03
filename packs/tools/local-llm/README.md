# `tools/local-llm` — Hybrid local-model execution under Portulan's rails

A tool pack for **Hybrid AI Orchestration**, argued in Proposal [`0039`](../../../.portulan/proposals/0039-a-local-model-runs-without-the-host-floor-and-under-a-thinking-cap.md). It lets a frontier orchestrator session offload bounded code transformations, verify-gated red→green retries and a screen of a curated slot for duplicate files to a local OpenAI-compatible runtime (such as **LM Studio** on `http://127.0.0.1:1234/v1` or **Ollama** on `http://127.0.0.1:11434/v1`) at **zero API token cost** and with a **zero-floor prompt prefix**.

Composed through a workspace's `packs` array as `tools/local-llm`.

| Contributes | What |
|---|---|
| Skill | [`delegate-local`](skills/delegate-local/SKILL.md) — the pass a frontier session follows to hand a bounded edit or digest to the runner; its description names the precondition, a workspace composing this pack and a server answering on loopback |
| Persona | [`local-worker`](personas/local-worker.md) — a context-firewall worker operating with an omitted host floor (`omitClaudeMd`) and a hard input-byte ceiling |
| Verify | [`runner-rails`](verify/README.md) — offline verification of the runner's loopback-only guard, input-budget rail, rollback contract, and `dedup`'s refusals (zero network calls) |
| Gate | `local-llm-off-loopback` (`propose`) — marks leaving loopback (`127.0.0.1` / `localhost` / `[::1]`) as a decision requiring explicit approval |

The skill registers where a plugin manifest declares `skills/`, and this repository's manifests may
declare only the skills of packs its own workspace composes, as its `.portulan/workspace.json` composes
this one.

## Why this pack exists

Proposal [`0036`](../../../.portulan/proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md) budgets what a host loads into every fresh context, and Proposal [`0038`](../../../.portulan/proposals/0038-what-a-change-spends-is-measured.md) prices what a change spends across turns (`m_r × (F·T + g·T²/2)`). Together they expose two structural facts about hybrid local+cloud development:

1. **Parent-context turns are quadratic; surgical local calls are flat and free.** Every tool call in a frontier session re-reads the entire session history. Offloading a 10-file comment cleanup, a test-fixture draft, or a file summary to a local 27B–31B model (`qwen/qwen3.8-27b`, `google/gemma-4-31b`) keeps intermediate turns and raw file reads out of the frontier context window completely.
2. **Local models choke on the host floor (`F`), not on the task.** A cloud subagent inherits a 44k–85k token prefix (`F`) subsidized by provider prompt caching. On local hardware, pre-filling 85k tokens into a 30B model's KV cache takes tens of seconds before the first token appears, whereas a **surgical prompt of a few hundred tokens** (built using [`cli/symbols.mjs`](../../../cli/symbols.mjs) spans) pre-filled in 0.85–1.9 seconds in proposal 0039's measurement.

## What the runner enforces in code

[`runner/local-llm.mjs`](runner/local-llm.mjs) has **zero npm dependencies** (Node.js `>=20` built-in `fetch` and `node:child_process`) and enforces five rails:

1. **Loopback-only by default.** Only `127.0.0.1`, `localhost`, and `[::1]` are permitted unless `--allow-remote` is explicitly passed, and a redirect is refused rather than followed off the machine. A proxy listening on loopback that forwards elsewhere is not visible to it, which is what the `local-llm-off-loopback` gate fragment records.
2. **Zero-floor input budget (`--max-input-bytes`, default `32768`).** Refuses oversized prompts, and for `dedup` any file over the ceiling, before hitting the local server, directing the caller to scope with [`cli/symbols.mjs`](../../../cli/symbols.mjs) and `--lines` first. A value that is not a whole number is refused rather than read as no limit.
3. **Explicit thinking cap (`--effort low`).** Passes `reasoning_effort: "low"` and `enable_thinking: false` by default so models whose chat templates default to `'xhigh'` thinking do not exhaust `max_tokens` inside `<think>` blocks.
4. **Verify-gated transforms (`transform --file <path> --verify <cmd>`, `--verify` required).** Applies the local model's edit, runs the verify command, retries with the end of its output on exit `1`, and **restores the original file byte-for-byte** unless the command reaches exit `0`. Any exit other than `0` or `1` — `2`, a missing command, a signal — is no verdict: the file is restored at once and the runner exits `2`. SIGINT, SIGTERM and SIGHUP, whether they arrive during the model call or while the verify command runs, stop the verify, restore the file and exit `2`. **The limits:** this is a rollback, not an atomic write — any other signal that ends the runner (SIGKILL and SIGQUIT among them) or a power loss between the edit and its verdict leaves the edit in place, and since the verify runs in a process group of its own, such a signal leaves the verify running too, even one sent to the runner's whole group. Signal handling is POSIX's: on Windows no SIGTERM arrives, and stopping the verify stops only its shell.
5. **Role screening (`eval`).** Grades an installed local model against Portulan's own [`cli/comments.mjs`](../../../cli/comments.mjs), [`cli/doctor.mjs`](../../../cli/doctor.mjs), and [`cli/skill-goldens.mjs`](../../../cli/skill-goldens.mjs) predicates across `code`, `codify`, and `handoff` tasks. It takes **one sample per task and has no baseline arm**, so it is a screen, not the A/B run `0038` requires before a role is routed: a model that fails it is not routed, and passing it earns nothing. It needs `cli/` beside `packs/`, as the repository and the npm package carry it, exiting `2` where only `packs/` was installed. The A/B run is [*The A/B record*](#the-ab-record) below.

A receipt prints a figure the server did not report as `?`, never as `0`, and `time=` is the model's request time, summed over a transform's attempts like `in=` and `out=`: the runner does not stream, so it cannot see a first token.

## Screening a slot for duplicates

`dedup --dir <slot-dir> [--threshold 0.80] [--model <id>] [--max-input-bytes <per file>]` embeds every file directly in the directory whose name ends in `.md`, in any letter case, sorted by name, in one `POST /v1/embeddings` request to the loopback endpoint, with `text-embedding-nomic-embed-text-v1.5` (`PORTULAN_LOCAL_EMBED_MODEL`) unless `--model` names another; `--role` picks a chat model and is refused here. It prints each pair whose cosine similarity is at or above the threshold, highest first and ties in file-name order, one line each, `0.829 0036-….md 0038-….md`, and two lines on stderr: `dedup files=8 pairs=1 threshold=0.8`, followed by the shared receipt `OK mode=dedup model=… attempts=1 in=…t out=? time=…ms rate=? spend=$0.00`. The ledger reads the receipt as embedding work at $0.00; output tokens and rate are unreported, never zero.

- **A slot's `README.md` is left out**, in any letter case: it describes the slot rather than being one of its entries, and would rank against every entry it summarizes. Subdirectories, symbolic links and other files are left out too.
- **The ceiling is per file**, since the model embeds each input on its own, and it measures the file's text: its size on disk before it is read, and its UTF-8 bytes after. A file over it refuses the run with exit `1`, naming every such file with its size, and nothing is truncated. The request as a whole is not capped: a slot of `n` files sends at most `n` times the ceiling of file text, which JSON escaping can enlarge in the request body, to about six times for control characters. Raise `--max-input-bytes` only as far as the embedding model's context holds.
- **The threshold is a plain decimal from `-1` to `1`**, the range of a cosine; `-1` lists every pair. Anything else is exit `2`, as every malformed argument to the runner is, and never read as the default.
- **Exit `0` is a run, with pairs or with none**, since a candidate pair is for a human to judge, not a red. Exit `1` is a refusal before any request: an endpoint off loopback, or a file over the ceiling. Exit `2` is no server, a redirect, an HTTP error, a response that is not one finite vector of one length per file, or a directory with fewer than two entries to compare. A zero vector scores `0` against everything rather than `NaN`.

A score is a candidate, not a verdict: the runner neither merges nor edits a file.

## Delegating to it

The pass is the [`delegate-local`](skills/delegate-local/SKILL.md) skill: check the server with
`status`, scope the input with [`cli/symbols.mjs`](../../../cli/symbols.mjs) and `--lines`, choose the
supported role by task shape, gate every edit with `--verify`, and read only the receipt back.
The acquired [record](../../../evals/ab/local-worker.md) supports `code` at low effort; shared `prose`
is disabled because codify failed all five local turns. `summarize` defaults to that disabled role and
refuses. An explicit `--model` without `--role` is an operator-selected candidate, not automatic routing.

## The A/B record

The acquired [capture](../../../evals/ab/local-worker.json) and its generated
[register](../../../evals/ab/local-worker.md) record five turns per task and arm on 2026-11-03:
code L5/H5, codify L0/H3, handoff L5/H5. The [acquisition note](../../../evals/ab/local-worker-acquisition.md)
keeps the failed authentication acquisition and the authorized host-only replacement auditable.

The rule fixed before outcomes requires all five local turns to pass and all five host turns to
complete, with local passes at least host passes. A positive 5/5 tie qualifies; a 0/5 tie does not.
Both tasks must qualify for the shared prose role. Thus **code is enabled and prose is disabled**.
Operational defaults and explicit `--role` calls require the measured model at low effort; a model
override or environment variable cannot silently substitute another. Explicit `--model` without
`--role`, `eval` and `eval --ab` remain candidate paths and never enable routing by themselves.

`EARNED_ROUTING` embeds the capture's SHA-256, measured model IDs and support bits, so packs-only
installs need no root `evals/` directory at runtime. The repository's
[`cli/local-routing.mjs`](../../../cli/local-routing.mjs) regrades the record, reproduces its register,
and independently derives those bits and models before comparing them with the shipped table.
It is repository workshop tooling, excluded from npm like the earlier A/B instruments.

- **`eval --ab --k 5 --seed <s> --host-cmd "<command>" --host-model <id> --write` captures it.** Arm L
  is each task's model as routed (`code` to `--role code`; `codify` and `handoff` to `--role prose`)
  at `--effort low`, on loopback, with a sampling seed per turn derived from `--seed`. Arm H is the host
  agent, given the same prompt as one text, as the last argument of the command `--host-cmd` names, in
  an empty directory it removes afterwards. Both arms are graded by `eval`'s predicates, `k = 5` per
  (task, arm) cell, the k ruled for `evals/ab/baseline.md`. The record names both models, the host's
  version, the commit, the machine and the seed, and the sha256 fingerprints of the loaded runner source, the predicates and the
  prompts it was graded under, as the capture recorded them, since nothing can later verify the first; the register carries `baseline.md`'s limit: `k = 5` per cell supports a
  recorded rate and nothing else. The machine is the CPU model, the memory, the platform and
  architecture, and the Node version, and never the hostname.
- **Arm H consumes host-account usage and its prompts leave the machine**, fifteen host calls, so it crosses the loopback
  rail the rest of the runner holds and that `local-llm-off-loopback` records. Usage may be charged
  through an API account or covered by a subscription; this acquisition used Claude Max sign-in with
  Sonnet 5.5 and a configured total ceiling of $2.25, not an independently measured invoice amount. It runs only where
  `--host-cmd` names the host command; without it `--ab` refuses with exit `1`, the answer the runner
  gives any refused endpoint, before anything is contacted. **It runs under the operator's full
  environment and credentials**, which is how it reaches the host's account and also how anything the
  operator's configuration loads reaches arm H. A command carrying `--dangerously-skip-permissions` or
  `--permission-mode bypassPermissions` is refused with exit `2`, by the check `cli/ab-run.mjs` uses.
  Arm L runs first, at `$0.00`, so a local failure stops the capture before any host call.
  `--host-model` is recorded as declared: the runner does not observe the host's model.
- **The command is split on whitespace, with no shell**, so no argument of it can hold a space, and a
  quoted one arrives in pieces. Its version is read by running the whole command with `--version`
  appended, so a wrapper such as `env` reports the host it runs rather than itself; a host that read
  `--version` as prompt text would answer it as a turn, and the record would show that answer as its
  version.
- **Every turn is journalled before the next starts**, under the repository's git directory
  (`git rev-parse --git-path portulan/local-worker-journal`), where no commit and no `git status` sees
  it. SIGINT, SIGTERM or SIGHUP stops the running host turn, removes its directory, keeps the journal
  and exits `2`; the same command run again resumes, re-running only turns the journal lacks, and
  refuses with exit `2` a journal taken under other conditions (commit, tree, machine, seed, models,
  endpoint, host command, version and model, or any fingerprint), since its arm-H turns were paid
  for and removing it is the operator's act. A host that writes more than 16 MiB stops the capture with
  exit `2` and the turn is re-run on resume. **The limit:** SIGKILL, or a power loss, leaves the running
  host turn's directory behind and, since the host runs in a process group of its own, the host still
  running and billing a turn the journal will not hold; the journal still resumes, and that turn runs again. The journal is removed once the
  record is written, and a capture is refused where `evals/ab/local-worker.json` exists: a record is
  captured once, and removing it is the operator's deliberate act. The final record is created
  exclusively too: if another record appears during capture, it and its register are preserved,
  exit `2` leaves the current journal for recovery. This prevents overwrites; it is not a lock on
  concurrent journal writers or a crash-atomic publication. Different loaded runner bytes refuse
  journal resume even at the same commit and with both trees dirty.
- **`eval --verify` checks it without running a model**: the record's shape, its matrix total over `k`,
  every arm-L seed against `--seed`, every turn's model against the routing, **every completed turn
  regraded** by the predicates as they ship, the prompts' fingerprint, the cells re-folded from the
  turns, and the register byte-compared with a fresh render. A verdict that regrades differently is
  exit `1`, and the finding says whether the predicates moved since capture or the record no longer
  matches its own output: either way the figures would not hold under the screen that ships. A
  predicate file that changed while every verdict regrades the same is no finding. A missing record is
  exit `2`, and so is a payload with no `cli/` beside `packs/`, since nothing there can regrade. A
  record carrying the synthetic fixture's `fixture` field is exit `1` from `--verify` and `--write`
  alike: a synthetic fixture is not a capture.
  `eval --write` re-renders the register from the record, refusing one `--verify` would red.

The `ab-run` recipe runs the earlier baseline verifier, exact no-model `eval --verify`, and the
shipped-routing verifier on every pull request. A red or could-not-run result survives later greens;
exit `2` takes precedence over exit `1`. No model is rerun in CI. `k = 5` supports these recorded rates,
not general reliability, arbitrary task quality or independently observed host model identity.

Not for multi-file architectural planning, ambiguous requirements (`clarify`), or pre-merge verdicts (`reviewer`).
