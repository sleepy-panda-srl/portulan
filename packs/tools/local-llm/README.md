# `tools/local-llm` — Hybrid local-model execution under Portulan's rails

A tool pack for **Hybrid AI Orchestration**, argued in Proposal [`0039`](../../../.portulan/proposals/0039-a-local-model-runs-without-the-host-floor-and-under-a-thinking-cap.md). It lets a frontier orchestrator session offload bounded code transformations, verify-gated red→green retries and a screen of a curated slot for duplicate files to a local OpenAI-compatible runtime (such as **LM Studio** on `http://127.0.0.1:1234/v1` or **Ollama** on `http://127.0.0.1:11434/v1`) with **no API tokens for the local model's own work** and a **zero-floor prompt prefix**. Each call to it is still a parent request, which re-reads the parent's context like any other (fact 1 below).

For hybrid development, compose `tools/local-llm` through the governing workspace's
`packs` array using [the adoption steps](#adopting-it-in-a-workspace).

| Contributes | What |
|---|---|
| Skill | [`delegate-local`](skills/delegate-local/SKILL.md) — bounded local work on loopback; propose composition first, or follow an explicit operator instruction for a one-off under the same rails |
| Persona | [`local-worker`](personas/local-worker.md) — a context-firewall worker operating with an omitted host floor (`omitClaudeMd`) and a hard input-byte ceiling |
| Verify | [`runner-rails`](verify/README.md) — offline verification of the runner's loopback-only guard, input-budget rail, rollback contract, and `dedup`'s refusals (zero network calls) |
| Gate | `local-llm-off-loopback` (`propose`) — marks leaving loopback (`127.0.0.1` / `localhost` / `[::1]`) as a decision requiring explicit approval |

The skill registers where a plugin manifest declares `skills/`, and this repository's manifests may
declare only the skills of packs its own workspace composes, as its `.portulan/workspace.json` composes
this one.

## Adopting it in a workspace

Requires Node.js 20 or newer, a loopback OpenAI-compatible server, and the earned
code model `qwen/qwen3.8-27b` installed in that server. Composition adds the pack's
restrictions and recipes; it does not by itself register host skills, create a
persona binding or make CI execute the recipes. See [pack delivery](../../../plugin/skills/portulan/packs.md).

1. **Named edit — identify the governing manifest and verified source.** The commands
   below assume an in-repository governing `.portulan/workspace.json` with `tree: "../"`.
   If the repository carries a `kind: "pointer"` manifest, follow `governed_by` to
   its owner and use that feed's edit/delivery procedure; never add governing keys
   to the pointer or draft a second workspace. See [workspace residence](../../../spec/slots.md#pointer--a-repository-whose-workspace-resides-elsewhere).
   Choose a full checkout or installed CLI payload with `cli/` beside `packs/`,
   verify its intended snapshot as described below, then set these absolute paths
   from the consumer repository's root:

   ```bash
   PORTULAN_ROOT=/absolute/path/to/verified/portulan
   WORKSPACE_DIR="$PWD/.portulan"
   LOCAL_RUNNER="$PORTULAN_ROOT/packs/tools/local-llm/runner/local-llm.mjs"
   PORTULAN_PACK_ARGS=(--pack-root "$PORTULAN_ROOT/packs")
   ```

   **Named edit — preserve every existing pack root.** Named roots replace derived
   and automatically discovered roots. If existing packs come from another feed,
   append its resolution root, repeating for each root, and retain the same array
   on every command below:

   ```bash
   PORTULAN_PACK_ARGS+=(--pack-root /absolute/path/to/other/feed/root)
   ```

   In a packs-only plugin, the runner is instead
   `<plugin root>/tools/local-llm/runner/local-llm.mjs`; that payload has no `cli/`.
   Use a separately verified full CLI/source root for compilation and outlining.
   Set `LOCAL_RUNNER` to that payload's runner and replace the public entry in
   `PORTULAN_PACK_ARGS` with its actual root, preserving other feed roots; do not
   let the CLI's bundled pack silently shadow the selected installed copy.

2. **Named edit — append `"tools/local-llm"` to the governing manifest's `packs`
   array, preserving other entries.** Apply the workspace's own gate for that
   persistent change. If composition is not authorized, propose it first. An
   explicit operator instruction may authorize a one-off runner invocation under
   the same scope, loopback, earned-role, input, verification and rollback rails;
   it does not compose the pack or install its restrictions/recipes.

3. **Commands — inspect resolution, compile, and check drift.** Inspect doctor's
   full report for **every** composed pack's selected path, then inspect `--matrix`
   for intended outputs and gates. `PORTULAN_AGENT=0` keeps the full doctor report
   even where an agent-mode environment default would condense a green result.
   Resolve missing or unintended pack paths before writing. A green `--check` alone is
   not proof of complete resolution; [#424](https://github.com/sleepy-panda-srl/portulan/issues/424)
   owns that mechanism.

   ```bash
   PORTULAN_AGENT=0 node "$PORTULAN_ROOT/cli/doctor.mjs" --static "${PORTULAN_PACK_ARGS[@]}" "$WORKSPACE_DIR"
   node "$PORTULAN_ROOT/cli/compile.mjs" --workspace "$WORKSPACE_DIR" "${PORTULAN_PACK_ARGS[@]}" --matrix
   node "$PORTULAN_ROOT/cli/compile.mjs" --workspace "$WORKSPACE_DIR" "${PORTULAN_PACK_ARGS[@]}"
   node "$PORTULAN_ROOT/cli/compile.mjs" --workspace "$WORKSPACE_DIR" "${PORTULAN_PACK_ARGS[@]}" --check
   ```

   **Named edits — host registration and CI.** Use the host/plugin's supported
   skill registration and any declared persona binding. For an existing plugin
   manifest owned by this workspace, `cli/skills-set.mjs` derives its pack portion
   with `--write` and verifies it with `--check`, using the explicit workspace,
   plugin root and resolution roots described in [pack delivery](../../../plugin/skills/portulan/packs.md).
   It creates no plugin manifest; packs outside that plugin root register through
   their own installed plugin. Do not edit installed manifests to add consumer policy.
   Ensure its CI calls `cli/recipe-set.mjs` rather than assuming composition runs
   the new `tools/local-llm:runner-rails` recipe automatically.

4. **Command — check the endpoint and model inventory.** Start the local server,
   then run:

   ```bash
   node "$LOCAL_RUNNER" status
   ```

   Require exit `0` and confirm the list includes the earned code model. Status
   proves endpoint/model-list availability, not model quality or a successful
   transform. On exit `1` or `2`, keep the work in the parent. See the skill for
   another loopback port; do not authorize a remote endpoint implicitly.

5. **Named edits and command — choose one complete span and prepare its prompt.**
   Set `TARGET_FILE` to the actual file, outline it, then set `TARGET_LINES` to a
   printed complete member/function range (`start-end`, including `N-N`).

   ```bash
   TARGET_FILE=path/to/File.cs
   node "$PORTULAN_ROOT/cli/symbols.mjs" "$TARGET_FILE"
   ```

   **Named edits:** set `TARGET_LINES` to the selected range; set `PROJECT_VERIFY`
   to the project's relevant behavioral tests and style checks; write
   `local-prompt.txt` with one observable change and the required replacement form.
   For .NET, a verifier can use `dotnet test path/to/Tests.csproj --no-restore`
   after restore assets exist; choose checks for the actual project, not just
   syntax. See [choosing checks](#choosing-checks).

6. **Command — run the earned code role at low effort, then read its verdict.**

   ```bash
   node "$LOCAL_RUNNER" transform --role code --effort low \
     --file "$TARGET_FILE" --lines "$TARGET_LINES" \
     --verify "$PROJECT_VERIFY" --prompt-file local-prompt.txt --progress
   ```

   Wait for exit and read the receipt plus retry tails. Exit `0` keeps the verified
   edit; `1` or `2` returns to the parent under the rollback contract below. Shared
   `prose` remains disabled. An operator-selected `--model` without `--role` is a
   candidate evaluation path, not earned routing or a way to enable prose.

## Verifying an upgrade

First record the intended full source commit (or verified release artifact), plugin
selector, marketplace, installation scope, enabled state and relevant configuration.
Locate the runner actually invoked and the adapters/hook commands actually loaded,
using the host's installed-plugin inventory and generated settings. Record those
absolute paths; multiple copies can differ at the same version. Compare against
expected bytes **from the chosen snapshot**, not merely a checkout's reported HEAD:

```bash
PORTULAN_SOURCE=/absolute/path/to/source/checkout
PORTULAN_COMMIT=full-reviewed-commit-sha
set -o pipefail
git -C "$PORTULAN_SOURCE" rev-parse "$PORTULAN_COMMIT^{commit}"
git -C "$PORTULAN_SOURCE" show "$PORTULAN_COMMIT:packs/tools/local-llm/runner/local-llm.mjs" | cmp - "$LOCAL_RUNNER"
```

Require each comparison to exit `0`; `pipefail` keeps a failed source read from
being hidden by a downstream comparison.

Repeat the `git show … | cmp - <executed-path>` comparison for the **actual**
adapter/hook modules and their local imports: for example `cli/compile.mjs`,
`cli/advisory.mjs` and `cli/ledger.mjs` when those are the targets in use. Map source
paths to the installed layout; a packs-only root omits the source path's `packs/`
prefix and has no CLI. For a release artifact, compare with its verified extracted
files in that layout. Recompile with the intended roots and inspect/check the
generated binding/settings too. An updater's success message or matching version
string alone proves none of these byte comparisons.

Supported recovery commands below were checked with Claude Code 2.1.325 and Codex
CLI 0.165.0 on 2026-11-17. Check the installed host's help when versions differ.
Perform removals only for the recorded installation and preserve its configuration:

Claude's uninstall/reinstall flow below applies to `user`, `project` or `local`
scope. A `managed` installation follows its delivery owner's update/recovery
procedure; the host's uninstall/install commands do not accept that scope.

- **Claude Code:** run `claude plugin marketplace update portulan`, then
  `claude plugin update portulan@portulan --scope <recorded-scope>`, and restart.
  If same-version files remain stale, use
  `claude plugin uninstall portulan@portulan --scope <recorded-scope> --keep-data`
  followed by `claude plugin install portulan@portulan --scope <recorded-scope>`.
  Substitute the recorded selector/marketplace. `--keep-data` preserves the plugin
  data directory, not every setting; restore recorded configuration and enabled
  state explicitly with the host's supported controls.
- **Codex:** run `codex plugin marketplace upgrade <recorded-marketplace>`.
  If the installed copy still differs, use `codex plugin remove <recorded-selector>`
  then `codex plugin add <recorded-selector>`. Restore recorded configuration and
  the plugin's enabled setting through the host's plugin controls; the CLI's
  `--enable`/`--disable` flags are feature flags, not plugin enabled-state switches.
  Start a fresh session.
- **Checkout or package CLI:** point the invocation at the chosen clean checkout
  or reinstall the verified package artifact using its package manager, then
  recompile with the intended roots. Do not treat a dirty checkout as snapshot proof.

After recovery, resolve loaded paths again and repeat the byte comparisons and
compile check. Never hand-edit plugin caches or invent a version bump to force a
refresh. [#424](https://github.com/sleepy-panda-srl/portulan/issues/424) owns stale/
missing pack resolution and shadow detection;
[#273](https://github.com/sleepy-panda-srl/portulan/issues/273) owns bundle/per-pack
versioning. These steps document consumer adoption and recovery, not those mechanisms.

## Why this pack exists

Proposal [`0036`](../../../.portulan/proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md) budgets what a host loads into every fresh context, and Proposal [`0038`](../../../.portulan/proposals/0038-what-a-change-spends-is-measured.md) prices what a change spends across turns (`m_r × (F·T + g·T²/2)`). Together they expose two structural facts about hybrid local+cloud development:

1. **Parent-context turns are quadratic, and a separately issued local call is one of them.** Local tokens alone prove no parent savings. [When a call pays](#when-a-call-pays) keeps the cost model, observed miss rate and batching limits.
2. **Local models choke on the host floor (`F`), not on the task.** A cloud subagent inherits a 44k–85k token prefix (`F`) subsidized by provider prompt caching. On local hardware, pre-filling 85k tokens into a 30B model's KV cache takes tens of seconds before the first token appears, whereas a **surgical prompt of a few hundred tokens** (built using [`cli/symbols.mjs`](../../../cli/symbols.mjs) spans) pre-filled in 0.85–1.9 seconds in proposal 0039's measurement.

## What the runner enforces in code

[`runner/local-llm.mjs`](runner/local-llm.mjs) has **zero npm dependencies** (Node.js `>=20` built-in HTTP, `fetch` and `node:child_process`) and enforces these rails:

1. **Loopback-only by default.** Only `127.0.0.1`, `localhost`, and `[::1]` are permitted unless `--allow-remote` is explicitly passed, and a redirect is refused rather than followed off the machine. A proxy listening on loopback that forwards elsewhere is not visible to it, which is what the `local-llm-off-loopback` gate fragment records.
2. **Zero-floor input budget (`--max-input-bytes`, default `32768`).** Refuses oversized prompts (including `--prompt-file` and `--context` / `--context-file` slices), and for `dedup` any file over the ceiling, before hitting the local server, directing the caller to scope with [`cli/symbols.mjs`](../../../cli/symbols.mjs) and `--lines` first. A value that is not a whole number is refused rather than read as no limit.
3. **Explicit thinking request (`--effort low`).** Passes `reasoning_effort: "low"` and `enable_thinking: false` by default. Backend/template support determines their effect; sending these fields is not a hard reasoning-token cap or a guarantee against output-budget exhaustion. The [current original-span pair](evidence/thinking/report.md) verified both arms with zero reported reasoning, with and without `/no_think`, on its recorded runtime and task.
4. **Verify-gated transforms (`transform --file <path> --verify <cmd>`, `--verify` required).** Applies the local model's edit, runs the verify command, retries with the end of its output on exit `1`, and **restores the original file byte-for-byte** unless the command reaches exit `0`.
   - **Prompt files (`--prompt-file <path>` or `-` for stdin):** Passes long specs and special characters without shell quoting; cannot be combined with `--prompt`.
   - **Read-only reference context (`--context <a>-<b>`, `--context-file <path>[:a-b]`):** Repeatable flags that include read-only lines beside the target span, e.g. `transform --file src.mjs --lines 80-95 --context 1-25 --verify "node --test" --prompt-file spec.txt`.
   - **Insertion mode (`--insert-after <line>`, `--insert-before <line>`, `--seam-blank-lines <n>`):** Supplies the anchor as read-only context, splices only the new block, and sets seam blank lines to the file's usual run or `<n>`.
   Any exit other than `0` or `1` — `2`, a missing command, a signal — is no verdict: the file is restored at once and the runner exits `2`. SIGINT, SIGTERM and SIGHUP, whether they arrive during the model call or while the verify command runs, stop the verify, restore the file and exit `2`. **The limits:** this is a rollback, not an atomic write — any other signal that ends the runner (SIGKILL and SIGQUIT among them) or a power loss between the edit and its verdict leaves the edit in place, and since the verify runs in a process group of its own, such a signal leaves the verify running too, even one sent to the runner's whole group. Signal handling is POSIX's: on Windows no SIGTERM arrives, and stopping the verify stops only its shell.
5. **Advisory endpoint serialisation (`--no-lock` to opt out).** Chat completions serialise per normalized endpoint URL via an `O_EXCL` lockfile in the OS temp directory (`portulan-local-llm-<hash>.lock`) holding PID and start time, recovering locks left by dead processes. Waiting happens before the generation request and its 15-minute deadline start; any wait prints to stderr and appears in the receipt as `queued=<ms>ms`. Pass `--no-lock` for servers configured with parallel slots.
6. **Durable metadata-only request lifecycle & orphan reconciliation.** Requests record a bounded metadata-only start and terminal entry (`requestId`, `phase`, `elapsedMs`, `signal`/`reason`, `rollback`, `providerCancellation`, unreported token subsets preserved as `null` without estimation) under `PORTULAN_LOCAL_LLM_STATE_DIR` (default `os.tmpdir()`, outside committed evidence). `SIGINT`/`SIGTERM`/`SIGHUP` across generation, verification, or read-only modes emits a `CANCELLED` receipt to stderr, records rollback (`restored` vs `not_applicable`), and releases only the caller's own endpoint lock; `SIGKILL`/crash start records are reconciled as `orphaned` when their PID is no longer alive (via `beginLifecycle` / `reconcileLifecycleRecords` / `local-llm.mjs lifecycle`).
7. **Role screening (`eval`).** Grades an installed local model against Portulan's own [`cli/comments.mjs`](../../../cli/comments.mjs), [`cli/doctor.mjs`](../../../cli/doctor.mjs), and [`cli/skill-goldens.mjs`](../../../cli/skill-goldens.mjs) predicates across `code`, `codify`, and `handoff` tasks, and on a fourth task, `read`, that screens find-and-quote reading: eight calls, each one pointed question about one of two synthetic numbered fixtures in [`screen/read/`](screen/read/), graded with no judgement (the exact set of cited lines, a value and its line, or `ABSENT` citing no line), three of them traps whose item is not in the file; it passes only when all eight are right, and needs no `cli/` predicate. `eval --task <name>` runs one task. It takes **one sample per task and has no baseline arm**, so it is a screen, not the A/B run `0038` requires before a role is routed: a model that fails it is not routed, and passing it earns nothing. Its first three tasks need `cli/` beside `packs/`, as the repository and the npm package carry it, exiting `2` where only `packs/` was installed. `read` stays in the default task set, by the fourth ruling on [proposal 0042](../../../.portulan/proposals/0042-find-and-quote-reading-earns-its-place-by-its-own-record.md). It is outside the local-worker A/B record: its prompts and grader are kept apart from the fingerprinted ones, so that record still verifies, and no routing rests on the screen. Reading is earned, if at all, by [a record of its own](#the-reading-record). The A/B run is [*The A/B record*](#the-ab-record) below.

Default loopback `/chat/completions` calls use a finite 15-minute deadline over the
connection, headers and complete response body, with a 256-KiB response limit.
This avoids Node fetch's five-minute header wait for non-streaming thinking models.
`localhost` is pinned to 127.0.0.1 without DNS; `[::1]` remains available. Redirects
are refused. Explicit injected fetches, authorized remote calls and embeddings
retain their existing transport behavior and response capacity. A caller injecting
its own transport can explicitly use the exported `localModelFetch`; the default
repair cannot change a transport hidden inside an injection.

## Generation controls and diagnostics

A response ending with `finish_reason: length` is incomplete and is rejected before
a replacement or verifier can run. The error prints the path of a private temporary
`response.json` containing the returned raw message (including any reasoning), usage,
request ID, model and requested output budget; it includes no prompt. The directory
is owner-only and the file is mode `0600`. It is separate from metadata-only lifecycle
records. If saving fails, refusal and rollback still apply and the error says no
diagnostic was saved. Inspect it locally and remove it when finished; it is raw model
output, not an accepted replacement or committed evidence.
Workspaces may enforce stronger completion or
slice limits without changing earned routing or model profiles. The code extractor
accepts valid whitespace/language fences, preserves inline backticks, and rejects
an unfinished fence. Provenance: owner Marius, November 5, 2026; local thinking
generations were interrupted by a client deadline and valid generated fences were
misparsed. These repairs change transport/completion handling, not model quality.

A receipt prints `reasoning=` as a subset of `out=` and `cached-in=` as a subset
of `in=`; neither is added to its parent. Counts must be safe nonnegative integers
and subsets cannot exceed their reported parent. Missing, invalid or unverifiable
counts print `?`; reported zero stays zero. Transform attempts sum each measurement
once, with an unknown attempt making that sum unknown. `time=` is summed model
request time: the runner does not stream, so it cannot see a first token. The ledger
accepts both historical and extended receipts and continues counting parent totals.
Update runner and ledger together: older strict receipt readers do not understand
the added fields.

`chat`, `summarize` and `transform` accept `--max-tokens <n>` (default `4096`), a positive
safe integer sent as `max_tokens` and recorded as `max-tokens=<n>` in the receipt.
The exported calls accept `maxTokens` too. This requests a combined output budget;
backend behavior still determines how it binds. A stricter owner profile remains
authoritative; this flag grants no permission to change its cap or effort.
Transform receipts use a wrapper's reported effective budget when available, falling
back to the requested budget for older injected replies; differing or invalid reported
retry budgets print `max-tokens=?` rather than claiming a single known cap.

`chat` and `summarize` accept `--number-lines` with `--file`: each line of the file, and of any
`--context` or `--context-file` block, is sent prefixed with its own number in that file and a tab,
under a label naming the file and the range, so a reply can cite lines without a hand-made numbered
copy. Under `--lines a-b` line `a` is numbered `a`. The numbers count against `--max-input-bytes`,
the receipt ends `line-numbers=on spend=$0.00`, and the ledger reads it. It does not open
`summarize`'s refusal, and `transform` refuses it, since a transform's reply replaces lines and
numbered input invites numbered output. Without `--file` it is refused with exit `2`.

`--progress` reports request ID, queued/generation phase and elapsed time to stderr
on phase entry and every ten seconds while waiting, across all three prompt modes.
The response remains nonstreaming and bounded: `tokens=?` is honest until final
usage arrives, and no first-token timing is measured. The timer stops on completion,
failure or cancellation. Without the flag, no progress lines are printed.
Abort stops heartbeats immediately and late replies are refused even when an injected
transport ignores its signal. Settlement still depends on that injected implementation;
provider cancellation is never inferred.

On `length`, the diagnostic distinguishes a measured all-reasoning response from
other combined-budget exhaustion. A short input does not cap thinking. Inspect the
backend's actual thinking controls and the task contract before another request;
do not silently lower a pinned profile, retry identical work, or accept truncated
output. An advertised reasoning-budget parameter needs a binding runtime test,
not just a short successful response. Provenance: the November 6 Q06 investigation
on [#578](https://github.com/sleepy-panda-srl/portulan/issues/578#issuecomment-6695966000),
with accounting on [#571](https://github.com/sleepy-panda-srl/portulan/issues/571).

## Screening a slot for duplicates

`dedup --dir <slot-dir> [--threshold 0.80] [--model <id>] [--max-input-bytes <per file>]` embeds every file directly in the directory whose name ends in `.md`, in any letter case, sorted by name, in one `POST /v1/embeddings` request to the loopback endpoint, with `text-embedding-nomic-embed-text-v1.5` (`PORTULAN_LOCAL_EMBED_MODEL`) unless `--model` names another; `--role` picks a chat model and is refused here. It prints each pair whose cosine similarity is at or above the threshold, highest first and ties in file-name order, one line each, `0.829 0036-….md 0038-….md`, and two lines on stderr: `dedup files=8 pairs=1 threshold=0.8`, followed by the shared receipt `OK mode=dedup model=… attempts=1 in=…t out=? time=…ms rate=? reasoning=? cached-in=? spend=$0.00`. The ledger reads the receipt as embedding work at $0.00; output tokens and rate are unreported, never zero.

- **A slot's `README.md` is left out**, in any letter case: it describes the slot rather than being one of its entries, and would rank against every entry it summarizes. Subdirectories, symbolic links and other files are left out too.
- **The ceiling is per file**, since the model embeds each input on its own, and it measures the file's text: its size on disk before it is read, and its UTF-8 bytes after. A file over it refuses the run with exit `1`, naming every such file with its size, and nothing is truncated. The request as a whole is not capped: a slot of `n` files sends at most `n` times the ceiling of file text, which JSON escaping can enlarge in the request body, to about six times for control characters. Raise `--max-input-bytes` only as far as the embedding model's context holds.
- **The threshold is a plain decimal from `-1` to `1`**, the range of a cosine; `-1` lists every pair. Anything else is exit `2`, as every malformed argument to the runner is, and never read as the default.
- **Exit `0` is a run, with pairs or with none**, since a candidate pair is for a human to judge, not a red. Exit `1` is a refusal before any request: an endpoint off loopback, or a file over the ceiling. Exit `2` is no server, a redirect, an HTTP error, a response that is not one finite vector of one length per file, or a directory with fewer than two entries to compare. A zero vector scores `0` against everything rather than `NaN`.

A score is a candidate, not a verdict: the runner neither merges nor edits a file.

## Delegating to it

The pass is the [`delegate-local`](skills/delegate-local/SKILL.md) skill: check the server with
`status`, scope the input with [`cli/symbols.mjs`](../../../cli/symbols.mjs) and `--lines`, choose the
supported role by task shape, and gate every edit with `--verify`.
When `attempts` is greater than one, also read stderr: each earlier failed attempt
is labeled with its number and phase, followed by the same bounded verification tail
the model saw (at most 1,500 characters plus a truncation marker). Expectation misses
and silent red exits have explicit diagnostics. A first-attempt pass prints no extra
feedback; successful stdout remains one receipt. The API exposes `retryFailures`
beside the result. Use these tails to fix the next prompt's style rules or API contract.
Displayed feedback and error continuation lines are indented so quoted receipts stay
diagnostic prose. The API and model retain the raw bounded retry feedback.
The acquired [record](../../../evals/ab/local-worker.md) supports `code` at low effort; shared `prose`
is disabled because codify failed all five local turns. `summarize` defaults to that disabled role and
refuses. An explicit `--model` without `--role` is an operator-selected candidate, not automatic routing.
[Find-and-quote reading](#find-and-quote) is a supported use of `code`, earned on [a record of its own](#the-reading-record).
Use the [sizing and wording guidance](#sizing-and-wording-a-call) before choosing a complete function
or test group; specify one observable change, prefer serial calls, and return only the selected replacement. On truncated output inspect the diagnostic and task contract; on transport
failure inspect the transport; on verifier failure inspect code. For reasoning-only
exhaustion, investigate backend/profile/task behavior before selecting another span.
Do not lower an operator-pinned
model/effort or bypass verification. This advice reduces failures, does not guarantee completion.

## Find and quote

A pointed question about one file or one log, answered with line numbers, which the caller confirms
by reading only those lines: `chat --role code --file <path> --number-lines --prompt-file <question>`.
It is a **supported use of the `code` role, earned on [the reading record](#the-reading-record)**: on
the eight screen questions arm L passed all five turns and arm H five, a positive tie, which qualifies.
The [A/B record](#the-ab-record) measured `code` on a transform, not on reading, and the screen's
`read` task passing earns nothing. The record supports that recorded rate and nothing wider, so use it
only on these rails:

- **One file or one log per call**, under the input ceiling; a longer one in parts with `--lines`,
  whose numbers stay the file's own.
- **One question, ending "Give line numbers. If the file does not contain it, say so."**
- **Check before relying on it:** read only the cited lines, or grep the one number in a log. If they
  do not show what the answer said, the answer was wrong: read that part yourself.
- **Not for tracing a function, deciding anything, or comparing files.** Those stay in the parent, and
  so do prose digests and librarian drafts.

When it pays is under [When a call pays](#when-a-call-pays).

## Sizing and wording a call

The skill's [sizing pass](skills/delegate-local/SKILL.md#sizing-and-wording-a-call)
uses about 20 generated new lines as a conservative first scope for an uncalibrated
Qwen low/4,096 task, not a current capacity limit. The [reported history](evidence/sizing/history.md)
separates the older low/4,096, owner-pinned xhigh/thinking/8,192 and later repairs.
The [fresh report and receipts](evidence/sizing/report.md) retain successes, failures,
parent-rejected semantics and one separately preregistered diagnostic. The largest
fixture-verified replacement was 61 physical lines; no universal maximum was found.

Numbered steps, enforced style, wrapped examples and literal syntax each have a
reported case in that history. Supply exact APIs and input/output fixtures too.
A complete helper signature does not establish an input shape, and a green finite
fixture corpus can miss valid-input semantics. Parent review and project-required
behavior/style checks remain necessary. C# documentation comments were reported as
syntax-gated code; this does not enable shared prose.

For a sizing attempt, `--retries 1` allows at most two generations. Count receipt
attempts, including across separate calls, and return the task shape to the parent
after two failed generations. The runner's unchanged default is two retries, hence
three generations; the skill names the smaller explicit cap. Never repeat identical
exhaustion or lower an operator-pinned profile automatically. The pilot and its
parent-directed diagnostic are distinct finite acquisitions, not routine retries.

## When a call pays

Each call is itself one parent request: the parent writes the instruction, waits and reads the receipt,
and that request re-reads the whole context like any other. In 0038's `m_r × (F·T + g·T²/2)`, a call that
replaces one parent Edit leaves `T` as it was and lowers `g` only by the output it saves, the difference
between writing the instruction and writing the code. A miss, a call that keeps nothing or a kept edit the
parent then touches up, adds a whole request. So:

- **Keep an edit the parent can write in one short Edit in the parent.** Delegate only where one call
  replaces more parent work than the request it costs.
- **Whether a call pays turns on its miss rate and the context's size.** With `s` the output a kept call
  saves, priced at 0038's five times input, and `c` a miss's re-read of the context `C` at the tenth of
  input that `cli/ledger.mjs` takes for a cache read, a call pays only while its miss rate stays under
  `s / (s + c)`, and under less once a miss's own output is counted. One run in
  [#583](https://github.com/sleepy-panda-srl/portulan/issues/583) measured a 20% miss rate at a median `C`
  of 236k. The output a kept call saved, derived from the parent's output on the edits it wrote itself, was
  250–650 tokens and is overstated, since the parent kept its larger edits. That puts break-even at 5–12%,
  a net loss, from one run, one local model and one parent model, and the verdict rests on the tenth: at
  0038's fortieth, break-even is 17–35%.
- **Where a call should pay is reasoning, not measurement:** a red→green loop the parent would otherwise
  iterate, a batch of calls inside one tool request, and a long mechanical replacement the parent would
  otherwise write out.
- **A reading call pays when what it keeps out of the parent outweighs the request it costs.** A
  find-and-quote call (the [skill](skills/delegate-local/SKILL.md)'s reading use) puts the question,
  the answer and the few lines read to check it, `q`, into the parent's context in place of the file,
  `R`. The call is one more request re-reading `C`; the saving is `R − q` on every later request that
  would have re-read the file, `T′` of them, so it pays while `(R − q) × T′` exceeds `C`. It pays on a
  file the parent only consults and would otherwise carry for several turns, and not on a short file or
  one the parent must then read or edit anyway. A wrong answer the check catches costs one more read of a
  few lines; a wrong answer acted on unchecked is the risk, which is why the check is a rail of the use
  and not advice. This is the reason, not a measurement: no run has measured a reading call's saving.
  The one trial so far, in a consumer workspace and reported on
  [#678](https://github.com/sleepy-panda-srl/portulan/issues/678), asked ten questions with one sample
  each: `--role code` answered 9 of 10, wrong on working a weighted pick through by hand, and both
  absent-item traps right. That is a screen, not a rate.

## Choosing checks

`transform --precheck "<cheap command>" --verify "<full command>"` runs the precheck
after each candidate is written and before full verification. Exit `1` supplies retry
feedback and skips the full verifier for that attempt. Exit `0` proceeds to the required
full verifier; it cannot accept an edit by itself. An unavailable command, signal or
other exit is no verdict: stop, restore the original target bytes and exit `2`, saving
the candidate reply when possible. Exhausted red checks also restore the target and
exit `1`. Failure tails name `precheck` or `verification` so callers can distinguish them.
Checks are shell commands; rollback restores the target, not their other side effects.

Choose a fast check that rejects likely defects, and keep a full verifier that proves
the requested behavior. Syntax alone cannot establish that tests pass or style is valid.
These are command examples, not measured timings or installed prerequisites:

| Stack | Fast check example | What still needs verification |
|---|---|---|
| .NET | `dotnet build path/to/App.csproj --no-restore -v q -nologo` | Relevant tests and configured style rules; restore assets must already exist. |
| Python | `python -m py_compile path/to/module.py`; with pycodestyle installed, add `pycodestyle --select=E303 path/to/module.py` for excess blank lines. | Behavioral tests and the project's full lint rules; compilation alone misses blank-line defects. |
| Node | `node --check path/to/module.mjs` | Relevant tests and lint; syntax is not behavior. |

`--preflight` is separate: it runs the full `--verify` once on the untouched target
before generation. A green or red baseline proceeds; a no-verdict baseline stops
without a model call. Use `--verify-expect <regex>` when an empty test filter could
exit `0`; the full verifier must also print a matching result. It does not apply to
the precheck. Without `--precheck`, the existing full-verification loop is unchanged.

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

- **`read` has no cell in this record**, and never will: by the maintainer's rulings on
  [proposal 0042](../../../.portulan/proposals/0042-find-and-quote-reading-earns-its-place-by-its-own-record.md) reading is earned on
  [a record of its own](#the-reading-record), and this record is not recaptured or reshaped for it.

## The reading record

Find-and-quote reading is earned on `evals/ab/local-reader.json` and its generated register
`local-reader.md`, by the rulings on [proposal 0042](../../../.portulan/proposals/0042-find-and-quote-reading-earns-its-place-by-its-own-record.md), and
**both are captured** (2026-11-20, the maintainer's step): arm L `qwen/qwen3.8-27b` passed 5 of 5
turns and arm H `claude-sonnet-5-5` 5 of 5, [as the register shows](../../../evals/ab/local-reader.md).
That qualifies, so `EARNED_ROUTING` carries `reading: { role: "code", model: "qwen/qwen3.8-27b" }` and
`cli/local-routing.mjs` ends with `reading: earned`. Where the record is absent, `eval --verify` ends
with `evals/ab/local-reader.json is not captured, so reading earns nothing` and stays green, while
`cli/local-routing.mjs` is exit `1` on a shipped `reading` entry that no record derives; a
`local-reader.md` with no record beside it is exit `1`.

- **`eval --ab --task read --k 5 --seed <s> --host-cmd "<command>" --host-model <id> --write`
  captures it**, beside the local-worker record and without touching it. One task, two arms, `k = 5`
  turns each. **A turn is one pass of the eight screen questions**, each its own call, graded by
  `gradeReadAnswer()`; it passes only when all eight are right, does not complete where any of its host
  calls does not, and asks all eight either way. Arm L is `--role code` (`qwen/qwen3.8-27b`) at
  `--effort low` on loopback, each turn's eight calls sharing a seed derived from `--seed`, and runs
  first. Arm H is **forty paid host calls whose prompts leave the machine**, each the question's two
  messages joined, under every refusal, rail and journal rule of the worker capture above; its journal
  is `portulan/local-reader-journal`, journalled per turn, so a turn interrupted between its questions
  re-runs all eight on resume. Any other `--task` is refused with exit `2`.
- **`eval --verify` checks it when it exists**, with no model: its shape, every arm-L seed, every
  completed question regraded by the grader as it ships, the sha256 fingerprints of the questions'
  prompts, the questions and answer key, and the fixtures (a grader that moved while every verdict
  regrades the same is no finding), each turn folded from its eight questions, the cells folded from
  the turns, and the register byte-compared. `eval --write` re-renders its register too.
- **Reading is earned only from a record that qualifies** under the local-worker rule: all five local
  turns pass, all five host turns complete with an answer to every question, and local passes are at
  least host passes; a tie at zero earns nothing. `cli/local-routing.mjs` derives the `reading` entry
  from the record and compares it with the shipped `EARNED_ROUTING`, so the entry can ship only with a
  qualifying record, and the change that commits one is the one that calls the use supported.

The `ab-run` recipe runs the earlier baseline verifier, exact no-model `eval --verify` (both records),
and the shipped-routing verifier on every pull request. A red or could-not-run result survives later greens;
exit `2` takes precedence over exit `1`. No model is rerun in CI. `k = 5` supports these recorded rates,
not general reliability, arbitrary task quality or independently observed host model identity.

Not for multi-file architectural planning, ambiguous requirements (`clarify`), or pre-merge verdicts (`reviewer`).
