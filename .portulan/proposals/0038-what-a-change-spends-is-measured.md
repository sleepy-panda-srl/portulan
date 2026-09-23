# Proposal 0038 — what a change spends is measured, and a session ends when continuing costs more than restarting

**Status. PROPOSED — drafted 2026-09-23; its five questions settled the same day**, the first by the maintainer and
the other four, at his direction, by the project's coordinator session with the drafting session, on his criterion
of better performance. Drafted on his directive of that day (*"create a token optimization system in Portulan that
will benefit Portulan and any user, model, customer of Portulan"*), from research into primary sources on prompt
caching, context engineering, host cost behaviour and cost observability, each finding tagged by the host it applies
to. It extends [`0036`](0036-what-a-host-loads-into-every-context-is-budgeted.md), accepted the same day, which
budgets what a host loads into every context, to what a change actually spends. It proposes a rule and an order of
work and builds nothing; the milestone row the first ruling asks for lands in this same change as row 13 of
[`../../docs/plan.md`](../../docs/plan.md). The rule itself is his to accept on this pull request.

**Pull request:** https://github.com/sleepy-panda-srl/portulan/pull/433

## Incident — the spend was in the turns, and nothing in Portulan could see it

**Public, and recorded by 0036.** 0036's incident measures the project that drafted it, and 0036 says of that
measurement that its own always-tier budget would not have caught it, since this repository's always tier is small:
*"shorter sessions that hand off to a fresh context sooner would have."* Nothing in Portulan measures what a session
spent, and nothing tells a session when to end.

**Public, and measured on this proposal's own drafting.** From the host's usage records of the session that drafted
it and of its four parallel research readers, deduplicated per message, numbers only, taken when the research
finished:

- The drafting session: 19 requests. **84.5k tokens of context before its first tool call**, the host's own floor in
  that environment; 202.7k at its largest; 2.52M tokens read from cache and 164k written, a 94% hit rate.
- The readers, each on a cheaper model than the session's: 100 requests between them, each starting at about 44k;
  14.35M read and 705k written.
- **The figure the host showed was not the spend.** Its summary of the four readers said 811.7k tokens, which are
  their final context sizes. They processed **15.05M** input-side tokens.
- **The record is not all final.** The readers' records carry output counts too small to be true (134 output tokens
  for a reader that wrote a 2,471-word file), so a measurement built on those records has to state its error against
  the host's own totals.

**Public, measured elsewhere on the same host**, in its issue tracker (`anthropics/claude-code`):

- #94177, *"Prompt-cache forensics from 30 real sessions: 68% of cache writes come from 36 events (TTL expiry,
  microcompact, resume)"*: 43% of cache-write tokens from one-hour TTL expiry, 14% from mid-history pruning, about 9%
  from resume or model switch, against 32% from ordinary turn growth.
- #56068, *"Parallel sub-agents inherit full parent context, causing excessive token consumption without cost
  warnings"*: four of them, each re-sending a ~120k prefix, spent ~425k tokens on a task a search could have done.
- #94013, *"Background subagents have no token, turn or time cap: three research agents consumed 1.7M tokens with no
  approval or visible cost"*.
- And a practitioner's published measurement: a week-long session of about 6,000 turns grew from under 40k to over
  900k tokens of context **at a 98.5% hit rate**. A hit rate is not a bound; the context size is.

**Sealed, and already stamped.** 0036's sealed incident, where cache writes were most of the cost and every subagent
paid the whole always tier again, is the fresh-context half of this rule. 0036's stamp is its record here.

## Why turns are the cost — arithmetic every host shares

Every request is billed in four classes: uncached input, cache writes, cache reads and output, thinking included. On
the API's price list of 2026-09-23 a cache read costs **between a fortieth and a tenth** of an uncached input token
depending on the model, a five-minute write costs 1.25× and a one-hour write 2×, and output five times input. A turn,
here, is an API request: every tool call re-reads everything before it. So a session that starts at `F` tokens and
grows by `g` a request reads about `m_r × (F·T + g·T²/2)` over `T` requests: **quadratic in requests**.

Continuing `n` more requests at context `C` costs about `n × m_r × C` in reads. Ending into a handoff costs one write
of the fresh context `F` at `m_w`, then `n × m_r × F`. Growth drops out, because with the same growth per request in
both arms the incremental writes cancel. Restarting wins past

```
C*  ≈  F × (1 + m_w / (n × m_r))
```

`F` is the whole fresh context: the host's floor, the always tier, the handoff, and what the new session re-reads to
orient itself. The handoff's own output moves `C*` up (a 2k-token handoff adds about 20k at the cheapest reads below),
and so do the re-orientation reads; a TTL expiry or an auto-compaction in the continuing arm moves it down. On Claude
Code the write multiplier is set by the billing bucket, not chosen, and sessions in one directory share a prefix, so a
restart may read its floor from cache: there `C*` is an upper bound.

Taking `F` at the floor measured above, 85k, with 20 requests still to go: reads at a tenth put `C*` near **138k** with
five-minute writes and **170k** with one-hour writes; reads at a twentieth with one-hour writes near **255k**; reads at
a fortieth near **425k**. The host's default auto-compaction on its 1M-token models fires at about **967k**, above
every one of them. The threshold is a function of the price vector, the fresh context and the horizon, so it is
computed, never written down.

Ending sooner protects quality as well as cost: recall sags in the middle of a long context (*Lost in the Middle*, Liu
et al., arXiv 2307.03172), degrades with distractors (Chroma's *Context Rot* report), and instruction-following
degrades from about 150 simultaneous instructions (*IFScale*, arXiv 2507.11538). What a restart could lose is carried
by the handoff, whose size is proposal `0037`'s.

## What exists, and the gap

- **What a context loads**, per 0036 (accepted): four tiers, an always-tier budget in tokens, a measurement at a
  declared bytes-per-token ratio, a `doctor` report, compile targets including each persona's `model`, `omitClaudeMd`
  and cache lifetime, and the Stop-gate relaying failing lines only. Its rule 4 prices a fresh context where it is
  created: the spawner states what it loads.
- **Telemetry**, per [`0034`](0034-one-spec-bump-carries-both-evals-and-telemetry.md) (accepted): an opt-in emitter
  with one signal, `review-loop` ([`../../cli/telemetry.mjs`](../../cli/telemetry.mjs)).
- **Doctrine on output**: [`../../core/operating/loop.md`](../../core/operating/loop.md) says *"Compact the error, not
  the transcript, back into context … noise left in the window is paid for again on every later turn."* No checker
  holds anything to it.
- **An A/B harness** in [`../../evals/ab/`](../../evals/ab/) that compares two arms on one corpus.
- **Verdicts in fresh contexts** by rule ([`0018`](0018-a-verdict-from-the-context-that-did-the-work-is-not-a-verdict.md)),
  and the supervisor's checkpoints on the strongest model ([`../../docs/plan.md`](../../docs/plan.md), *Protocol*).

**The gap:** 0036 prices one context's prefix; nothing prices **how many times** it is re-read (requests), **how many
times** it is rewritten (fresh contexts, TTL expiries, busts), or what the change came to in the end. A cache bust is
invisible. Nothing tells a session that continuing now costs more than restarting. A role can be moved to a cheaper
model with nothing checking the quality it keeps. And the one number a host shows, the hit rate, does not bound spend.

## Proposed rule

For `core/operating/context.md`, 0036's page, a second part, *What a change spends*. No new kernel line: 0036 already
adds `context` to the kernel's map.

1. **A change is priced by what it spent, from the host's own record.** Per change (a branch, then its pull request):
   requests, tokens by class (uncached, written by lifetime, read, output), fresh contexts opened, largest context,
   hit rate, cache rebuilds and their causes, and tokens per changed line. **Numbers only**: nothing reads or prints
   what a context said. Where the host keeps totals of its own, the measurement states its difference from them.
2. **Every request re-reads the context, so a session ends when continuing costs more than restarting.** The
   threshold is computed from the price multipliers, the fresh context and a horizon, as above. At it the session is
   told **once, where the agent is**: with its next tool result mid-stretch, or at its next prompt, to write its
   handoff and end; the human sees the same figure. The handoff carries what the restart needs.
3. **The prefix stays stable.** 0036 lists switching model or effort mid-session as a non-goal; here it becomes a
   rule, because a switch rewrites everything after it: **model and effort are chosen when a context is created**,
   and tool definitions are deferred wherever the host can defer them. Content that varies per session (a date, an
   id) stays out of the always tier and hook-injected text: it never busts a session, but it forfeits the prefix that
   sessions in one directory share.
4. **Routing is declared and earned.** Beyond what 0036 rule 4 has a spawner state, it states the **effort** and **how
   many contexts** it may open, and **a cheaper model or a lower effort for a role is earned by an A/B run, never
   assumed.**
5. **What a tool, recipe or hook hands back to the model is budgeted.** Failures in full, passes as a count, and
   nothing echoed on every turn. This is `loop.md`'s *compact the error* with a checker behind it, and it widens
   0036's Stop-gate demotion to every Portulan output a model reads.
6. **No lever may lower quality**, per 0036 rule 5, and each names its guard: the handoff for rule 2, the A/B run for
   rule 4, failures in full for rule 5.

## Enforcement — each piece is a rail, a measurement or a report

- **The ledger (measurement).** One module reads the host's local usage records: for Claude Code, the per-session
  transcript files, which carry each request's usage with its branch, working directory and timestamp. That format is
  **undocumented**: it is measured here on host version 2.1.280 and pinned by the fixture below, so a format change
  reds the fixture instead of silently moving the figures. The module deduplicates per message, since the host writes
  one record per content block (59 records for 24 requests, counted during drafting a few requests after the figures
  above), attributes by branch and working directory with worktrees included, and keeps subagent records apart. It is
  a **report and never a rail, and it never runs inside a recipe**: host records differ per machine, so a rail on them
  would be red on one machine and green on the next. Its correctness is railed by a fixture of synthetic records with
  known totals, the per-block duplicates included. Tokens by class are always exact; money appears only where the
  manifest declares prices.
- **`doctor` names the biggest lever (report).** Beside 0036's always-tier figure, where records exist: spend by class
  for the current branch and recent sessions, the dominant class, and the lever it maps to. Reads map to session
  length and tool output; writes to fresh contexts, TTL gaps and busts, each rebuild's cause inferred from the gap
  before it, a model change or an effort change; output to effort and model by role; uncached input to caching not
  engaged. It prints the counterfactual, such as what the reads would have been at the computed threshold. With no
  records it says so and reports the static figure alone.
- **The restart advisory (a report by default, a rail by declaration, through new compile targets).** For Claude
  Code, a non-blocking `Stop` hook's output never reaches the model, so the default goes where the agent is: one line,
  once, when the threshold is crossed, as `additionalContext` from a compiled **`PostToolUse` hook** mid-stretch
  (*finish the current step, then hand off*) or from a compiled **`UserPromptSubmit` hook** at the next prompt, each
  of which enters the context without an extra turn (the host's hooks reference and its context-window page, read
  2026-09-23). For the human, a compiled **status-line command** shows the same figure from the host's own last-call
  token counts, locally and at no token cost. Each reads the last request's usage from the transcript path in its
  input; the host writes the transcript asynchronously, so the figure may lag one request. Each prints the
  multipliers it assumed, or *undeclared* when the manifest declares none. **Where a workspace declares it**, crossing
  the threshold is instead a one-time Stop-gate block whose reason asks for the handoff: a block's reason reaches the
  model and the turn continues, as [`../../cli/stop-gate.mjs`](../../cli/stop-gate.mjs) already does. Portulan
  compiles none of these surfaces today.
- **Cache safety (a rail on Portulan, a report on workspaces).** This repository's recipes scan Portulan's compiled
  always-tier files and its hook text for dates, commit hashes, ids and absolute paths, against a committed golden.
  Rendering twice and comparing would prove determinism only, as [`../verify/README.md`](../verify/README.md) already
  says of `telemetry.sh`. `doctor` reports workspace settings that bust a cache inside a session; for Claude Code, a
  model setting that switches model when plan mode toggles, and tool search turned off while MCP servers are enabled.
- **Output budgets (a rail).** Portulan's recipes and `doctor` gain an agent mode that prints failures in full and
  passes as a count, and a green run in that mode is railed at one line.
- **Routing (compiled, gated by an A/B run).** Persona declarations gain effort beside 0036's `model`, compiled where
  the host accepts it and named in the degradation report where it does not. A persona set below the session's model
  or effort carries an A/B record in `evals/ab/` showing no loss on that persona's corpus. A ritual's declared count of
  contexts is compiled where the host has a cap (for Claude Code, its concurrent-subagent limit) and reported by the
  ledger either way.
- **Telemetry (opt-in).** A `spend` signal beside `review-loop`, emitting the ledger's per-change figures through
  0034's opt-in. Its names follow OpenTelemetry's GenAI usage attributes, which are still in development, so the
  mapping is kept in one table.

## What this does not ask for

A spend rail or a spend budget: spend is reported, and a budget on it would reward cutting corners on quality.
Predicting a change's cost before the work. Reading what any context said. Changing how a host caches or compacts,
including compiling the host's auto-compaction window, which is left to a later proposal if unattended runs show a
runaway the advisory does not catch. **A batch-price rule**: work nobody waits on is half price at the API's batch
endpoint, and that stacks with caching, but no Portulan ritual calls a model API today (its evals run through the
host), so a rule would have no instance and no owner; it waits for the first ritual that does. Lossy compression, a
codebase vector index or output-shortening tricks, as in 0036. The handoff's size budget, which is `0037`'s. A ninth
subcommand: the ledger is reached through `doctor`, as 0036's measurement is.

## What was ruled — five questions, 2026-09-23

Each question went to the maintainer with a recommendation. He ruled the first and sent the other four to the
project's coordinator session, to settle with the drafting session on one criterion, in one message:

> 1. New row.
> 2. Work with coordinator on this, on what delivers the better performance enhacement.
> 3. Work with coordinator on this.
> 4. Work with coordinator on this.
> 5. Work with coordinator on this.

1. **Where this sits in the milestone map** (asked: a new row 13, appended and run after row 12 and before row 9, or
   a wider row 12). **Ruled: a new row.** Row 13, *Spend economy*, is appended with nothing renumbered, the precedent
   rows 11 and 12 set, and runs after row 12 and before row 9: it reuses row 12's measurement and report, and row 9
   multiplies sessions, each of which runs up the re-read cost this row prices. It lands in this change, with its
   drafting rationale in [`../../docs/milestones/m13.md`](../../docs/milestones/m13.md).
2. **Prices** (asked: the general multipliers unless the manifest declares others, a dated per-host table in the
   engine, or the manifest alone). **Settled: the manifest declares the multipliers**, 0036's second ruling's pattern
   for bytes per token, so a team's contracted rates and its host's real prices are one declared value. `init` offers
   the declaration from the host's own exposed pricing where there is one (for Claude Code, its `modelPricing`
   setting), else from a dated per-host table in the engine, keyed by the model the host records, sourced from the
   vendor's price page and updated by release, else the general multipliers. The advisory prints which it used, and
   *undeclared* when the manifest carries none. Why: neither default performs on its own. At the general multipliers
   the threshold for the cheapest-read models lands at a third to two-fifths of the truth, and each premature restart
   costs a fresh write of `F`, a handoff and a re-orientation; erring the other way on a model whose reads cost a
   tenth costs about four times more in excess reads over 20 requests. The table is dated, sourced host knowledge,
   not a budget.
3. **The restart advisory** (asked: one line at the next prompt, a Stop-gate block, or the `doctor` report alone).
   **Settled: a report by default, a rail by declaration**, as *Enforcement* describes, with a horizon of 20 requests
   unless the manifest declares another. Why not a block by default: the threshold is an estimate, and a forced
   restart on a wrong estimate costs a fresh write of `F` and a handoff, while an ignored line costs nothing. That is
   0036's own line, *a defaulted rail is a non-goal; the default is the report*, applied once more.
4. **The ledger reads the host's records outside the repository** (asked: on every install, or only where a
   workspace opts in). **Settled: on by default for every install**, on demand through `doctor`, reading only the
   local usage records, numbers only, never a network call and never inside a recipe; the `spend` telemetry signal
   stays behind 0034's opt-in. Why: the goal is that a repository benefits by installing or upgrading, and a spend
   figure nobody has to configure is the measurement every other lever is judged by.
5. **A cheaper model or a lower effort for a role** (asked: an A/B record first, or declaration then measurement).
   **Settled: A/B first.** Portulan runs the comparison once for each persona it ships and ships the routing that
   comparison supports, so every install gets it on upgrade without running an eval; a workspace that routes its own
   personas cheaper carries its own record. Why: no optimisation may lower code quality, and an unverified cheaper
   route that degrades quality costs rework, which is spend too.

Neither the multipliers' fallback nor the horizon is a rail: they parameterize a report and an advisory, and no tree
turns red on them.

**Two coordination notes, not questions.** The manifest keys this adds (the multipliers, the horizon, the declared
block) ride the MINOR that 0036's key needs, which 0034 has commissioned as `2.9`; neither waits for the other. And
the handoff is `0037`'s: if it wants its session's spend recorded, the ledger supplies one line inside that budget.

## Order of work after acceptance — one change per pull request

After 0036's first four changes, which this reuses (its page, its manifest key, its measurement module, its `doctor`
report):

1. `context.md`'s second part.
2. The ledger module and its fixture rail.
3. `doctor`'s spend report and its biggest lever.
4. The manifest's multiplier, horizon and block keys, and `init`'s offer. The per-host multiplier table is its own
   change, made from a local session: it names models, which the operating rules of the sessions that drafted this
   keep out of anything they push.
5. The restart advisory: the compiled tool-result and prompt hooks, the status line, and the declared block.
6. The cache-safety rail and report.
7. The agent mode for recipes and `doctor`, railed at one line.
8. The A/B comparisons for the three personas that run in fresh contexts (implementer, reviewer, librarian), so the
   savings arrive with their evidence; then persona effort, the context count and the A/B gate, alongside 0036's
   persona frontmatter.
9. The `spend` telemetry signal, once 0034's slot is drafted.

Then adoption in the sealed repository, from a session rooted there: the ledger before and after its instruction file
is slimmed. That work is private and gates nothing here.

**Provenance.** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/429`, where 0036 records the
drafting spend this rule would have steered; corroborated by this proposal's own measurement above and by the host's
issues #94177, #56068 and #94013 in `anthropics/claude-code`. Host facts from the Claude Code documentation on prompt
caching, costs, sub-agents, hooks, the context window, model configuration and the status line, and the Claude API
documentation on pricing, prompt caching, batch processing and effort, read 2026-09-23. The sealed adopting repository
is 0036's stamp.

**Retire when.** A host reports what each change spent and tells a session when to end from its own prices, so that
Portulan's ledger would describe the host's mechanism instead of supplying one.

**Decision.** Marius Cetanas — pending. The rule is his to accept on this pull request.
