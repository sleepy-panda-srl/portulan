# Proposal 0039 — a local model runs without the host floor and under a thinking cap, and its routing is earned like any other

**Status. DRAFT — prepared 2026-10-27 for Marius Cetanas.** Extends [`0036`](0036-what-a-host-loads-into-every-context-is-budgeted.md) (what a host loads into every context is budgeted) and [`0038`](0038-what-a-change-spends-is-measured.md) (what a change spends is measured) to hybrid local-model execution: offloading bounded transforms, research digests, and librarian passes to a local loopback model (`127.0.0.1`) so the parent frontier session does not pay quadratic re-read spend (`m_r × (F·T + g·T²/2)`) on work a verify recipe can gate locally. It proposes a rule, a composable tool pack ([`../../packs/tools/local-llm/README.md`](../../packs/tools/local-llm/README.md)), and milestone row 14 of [`../../docs/plan.md`](../../docs/plan.md) ([`../../docs/milestones/m14.md`](../../docs/milestones/m14.md)).

**Pull request:** https://github.com/sleepy-panda-srl/portulan/pull/546

---

## Incident — two failure modes when a local model is called like a cloud one

**Public, measured on [`0038`](0038-what-a-change-spends-is-measured.md)'s own drafting.** Four parallel research readers spawned as host subagents processed **15.05M input-side tokens across 100 requests**, each starting at a ~44k-token host floor (`F`), while the host's summary reported only their final context sizes (811.7k tokens). And across PRs [#499](https://github.com/sleepy-panda-srl/portulan/pull/499) and [#500](https://github.com/sleepy-panda-srl/portulan/pull/500), cleaning history comments across 47 CLI modules and suites required repeated frontier turns over files whose post-edit verification ([`../../cli/comments.mjs`](../../cli/comments.mjs) and `node --test`) is completely deterministic.

**Public, measured live on Apple M5 Max (128 GB unified memory, LM Studio 1234) on 2026-10-27.** Two local 8-bit MLX models — `qwen/qwen3.8-27b` (29.53 GB) and `google/gemma-4-31b` (33.80 GB) — alongside `text-embedding-nomic-embed-text-v1.5` (84.11 MB) were benchmarked against three real Portulan tasks graded by [`../../cli/comments.mjs`](../../cli/comments.mjs), [`../../cli/doctor.mjs`](../../cli/doctor.mjs) (`parseProvenance`), and [`../../cli/skill-goldens.mjs`](../../cli/skill-goldens.mjs) (`fieldBlock`):

1. **Unbounded default thinking starves output.** `Qwen3.8-27B-MLX-8bit/chat_template.jinja` defaults `reasoning_effort` to `'xhigh'` whenever `enable_thinking` is not explicitly `false`:
   ```jinja
   {%- if enable_thinking is undefined or enable_thinking is true %}
       {%- set resolved_reasoning_effort = reasoning_effort|default('xhigh') %}
   ```
   Under a standard `max_tokens: 1500` cap with default template settings, `qwen/qwen3.8-27b` spent **95.4 s on Task 1**, **94.4 s on Task 2**, and **64.1 s on Task 3** (~16.1 tok/s) emitting only `<think>` tokens until truncation—returning **0 bytes of answer** (`0/3` passed). Switching the same model to `reasoning_effort: "low"` cut Task 1 to **30.9 s** (`504` output tokens, **PASS**) and Task 2 to **51.8 s** (`833` output tokens, **PASS**).
2. **Task-shape specialization between the two local models is sharp and measurable.**
   - On Task 1 (code refactor + [`../../cli/comments.mjs`](../../cli/comments.mjs) 0-history rail + 5 unit assertions), controlled `qwen/qwen3.8-27b` finished in **30.9 s** (`16.8 tok/s`, `TTFT = 903 ms`, **PASS**) vs. `google/gemma-4-31b` in **80.5 s** (`13.4 tok/s`, `TTFT = 1376 ms`, **PASS**)—Qwen was **2.6× faster** on code.
   - On Task 3 (compressing a session log under [`0037`](0037-a-handoff-is-budgeted-where-it-is-written.md)'s strict 800-byte cap with 7 required tokens), `google/gemma-4-31b` hit **488 bytes** with 0 missing tokens (**PASS**, `3/3` across all tasks), whereas `qwen/qwen3.8-27b` preserved all 7 tokens but landed at **814 bytes** (14 bytes over the 800-byte cap, **FAIL** without a retry).
3. **The host floor (`F`) is a local latency wall.** On a cloud API, an 85k-token prefix `F` is amortized by provider prompt caching at `0.1×`–`0.025×` read pricing. On a local 30B model, dollar spend is `$0.00`, but an 85k-token prefix must be pre-filled into the local KV cache on cold contexts and consumes gigabytes of unified memory per concurrent subagent. Conversely, a zero-floor surgical prompt (~400–470 tokens, scoped via [`../../cli/symbols.mjs`](../../cli/symbols.mjs)) pre-fills in **0.85–1.88 seconds** (`TTFT = 858–1886 ms`).

---

## Why local models change `0038`'s arithmetic — and where they do not

In [`0038`](0038-what-a-change-spends-is-measured.md), continuing $n$ more requests at context $C$ costs $n \times m_r \times C$, and restarting wins past:

$$C^* \approx F \times \left(1 + \frac{m_w}{n \cdot m_r}\right)$$

For a local loopback model:
- **Monetary multipliers (`m_r`, `m_w`, `m_o`) are zero**, so a naive substitution gives $0/0$ (`NaN`) or an infinite dollar threshold.
- **Time and quality are not zero.** Recall still sags in the middle of a long context (*Lost in the Middle*, arXiv 2307.03172), instruction-following still degrades past ~150 simultaneous instructions (*IFScale*, arXiv 2507.11538), and local prompt processing scales with context bytes.
- Even more importantly, **every turn offloaded to a local worker removes $\Delta g$ bytes from the parent frontier session's context growth $g$**. Because parent spend is quadratic in turns ($m_r \times (F \cdot T + g \cdot T^2 / 2)$), keeping a 10-turn red→green edit loop or a 4-file research read out of the parent window saves those tokens on **every remaining turn of the parent session**.

---

## What exists, and the gap

- **Context tiers and symbol outlining ([`0036`](0036-what-a-host-loads-into-every-context-is-budgeted.md)):** [`../../cli/symbols.mjs`](../../cli/symbols.mjs) already outlines code by symbol and Markdown by heading so a caller can extract an exact line range (`offset` and `limit`) without reading whole files.
- **Persona frontmatter & earned routing ([`0036`](0036-what-a-host-loads-into-every-context-is-budgeted.md), [`0038`](0038-what-a-change-spends-is-measured.md)):** `compile` is slated to emit each persona's `model`, `effort`, `omitClaudeMd`, and cache lifetime, and `0038` Rule 4 requires that *"a cheaper model or a lower effort for a role is earned by an A/B run, never assumed."*
- **Composable packs ([`../../spec/pack.schema.json`](../../spec/pack.schema.json)):** A pack can contribute skills, personas, verify recipes, and tighten-only gate fragments without adding dependencies to `core/` or `cli/`.

**The gap:**
1. Nothing in Portulan provides a zero-dependency local model runner that enforces **loopback containment**, **an input-byte ceiling**, **explicit thinking/effort control**, and **atomic rollback when a verify recipe is red**.
2. [`0038`](0038-what-a-change-spends-is-measured.md)'s multiplier contract does not state how a zero-price (`local`) tier interacts with `spend.restart` or how a local worker's saved turns are reported.

---

## Proposed rule

For [`../../core/operating/context.md`](../../core/operating/context.md), under *What a change spends* (`0038`'s section), four clauses governing local and hybrid execution:

1. **A local worker runs without the host floor (`omitClaudeMd`) and under a hard input-byte ceiling.** A local model is called as a context firewall for bounded inputs (a symbol span from `cli/symbols.mjs`, a single file under 300 lines, a diff, or a session log to compress)—never with the parent session's always-loaded instruction floor. A call exceeding the declared input-byte ceiling is refused before network I/O.
2. **Thinking effort on a local model is set explicitly at invocation (`low` or `false` for mechanical transforms, bounded for prose/review), never left to a template's default.** A local model whose template defaults to unbounded reasoning (`xhigh`) will exhaust `max_tokens` inside `<think>` and return zero output bytes.
3. **Every local file write is gated by a verify recipe inside an atomic rollback transaction.** When a local worker edits a file, the runner executes the attached verify command (`--verify <cmd>`). On exit `0`, only a one-line receipt enters the parent context (`0038` Rule 5). On exit `1` after the retry cap (or exit `2` immediately), the runner restores the file's original bytes before returning the compacted failure to the parent loop.
4. **Loopback is a rail; routing is earned.** A local runner refuses any endpoint outside loopback (`127.0.0.1`, `localhost`, `[::1]`) unless explicitly overridden under a proposed/gated action. Assigning a persona or skill to a local model requires empirical grading against Portulan's predicates (`local-llm.mjs eval` reusing `cli/comments.mjs`, `cli/doctor.mjs`, and `cli/skill-goldens.mjs`), matching `0038` Rule 4.

---

## Enforcement — each piece is a rail, a measurement, or a report

- **The `tools/local-llm` pack (machinery, zero npm dependencies).** Ships [`../../packs/tools/local-llm/runner/local-llm.mjs`](../../packs/tools/local-llm/runner/local-llm.mjs), the [`delegate-local`](../../packs/tools/local-llm/skills/delegate-local/SKILL.md) skill, the [`local-worker`](../../packs/tools/local-llm/personas/local-worker.md) persona, the `local-llm-off-loopback` gate fragment, and the `tools/local-llm:runner-rails` offline verify recipe.
- **Offline verify recipe (`tools/local-llm:runner-rails`).** Obeys Portulan's standing prohibition on network calls inside verify recipes: runs four forced-red drills in-process (non-loopback refusal, oversized-prompt refusal, atomic file rollback on red verify, and single-line pass receipt) and exits `0`, `1`, or `2`.
- **Pack-owned role evaluation (`local-llm.mjs eval`).** Keeps `cli/ab-run.mjs` pure for host-level CLI agents while importing `jsComments` / `historyOf` from [`../../cli/comments.mjs`](../../cli/comments.mjs), `parseProvenance` from [`../../cli/doctor.mjs`](../../cli/doctor.mjs), and `fieldBlock` from [`../../cli/skill-goldens.mjs`](../../cli/skill-goldens.mjs) to grade any local model on `code`, `codify`, and `handoff` workloads.

---

## What was ruled

1. **Where `tools/local-llm` resides (`2026-10-27`):** **Settled — directly in `sleepy-panda-srl/portulan` (`packs/tools/local-llm/`).** The runner uses only Node.js built-ins and its verify recipe (`--verify-offline`) makes zero network calls.
2. **How local model grading integrates (`2026-10-27`):** **Settled — Option A.** Keep `cli/ab-run.mjs` focused on host-level CLI agents, and ship an `eval` subcommand inside `packs/tools/local-llm/runner/local-llm.mjs` that imports Portulan's grading predicates directly from `cli/comments.mjs`, `cli/doctor.mjs`, and `cli/skill-goldens.mjs`.

---

**Provenance.** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/433` (Proposal `0038`'s 15.05M-token research-reader measurement) and live measurement on Apple M5 Max / LM Studio (`qwen/qwen3.8-27b` and `google/gemma-4-31b` chat template inspection and task grading, 2026-10-27).

**Retire when.** Host runtimes natively route bounded subagent turns and verify-gated file transforms to local loopback models with zero host-floor inheritance and automatic verify rollback.

**Decision.** Marius Cetanas — accepted in principle on 2026-10-27 (rulings 1 and 2 above).
