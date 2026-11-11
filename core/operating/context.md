# Context

> Core doctrine — loaded on demand, which on this page's own terms is the on-read tier. What a host
> loads into every context is paid for again by every fresh context: each session, subagent, checkpoint
> and persona. So guidance sits in load tiers, the always tier is budgeted like memory, and a demotion
> is measured before and after. `loop.md` manages the window while a task runs; this page governs what
> the host loads into it, and when, then [what a change spends](#what-a-change-spends). _(Proposals
> [`0036`](../../.portulan/proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md) and
> [`0038`](../../.portulan/proposals/0038-what-a-change-spends-is-measured.md).)_

## Four load tiers

**Every piece of guidance sits in a load tier, and belongs in the latest tier that still reaches the
agent in time.** There are four:

- **Always**: loaded into every context, which covers project instruction files and their imports,
  unscoped rules, and skill and agent descriptions.
- **On-path**: loaded when the agent first touches a matching path, which covers nested instruction files
  and path-scoped rules.
- **On-invoke**: loaded when a skill, persona or ritual runs.
- **On-read**: loaded when the agent opens the file.

The always tier is paid for by every context, whether or not its task needs what the tier holds; a later
tier is paid for only by the contexts that reach it. *In time* is the limit: guidance that arrives after
the moment it applies has not reached the agent.

A workspace sets its own guidance in these tiers in `slots.context`, since Workspace Definition 2.10: one
unit per file, each declaring its tier, and `compile` emits each unit in its host's form of that tier.
_(See [`../../spec/slots.md`](../../spec/slots.md).)_

## One level of index

**One level of index only**: an always-tier line may point at content, and a pointer may not point at
another pointer. A **pointer** is a line the agent reads to decide whether to open something; a file a
procedure always reads is content loaded in that procedure's tier, not a pointer. So the kernel's map,
whose lines point at directories of content, is one level, and so is the boot's path to a memory record:
the boot always reads the memory index, and each index line is the one pointer to its record.

_(Motivated, not established, by arXiv 2607.17598, *Is Progressive Disclosure All You Need for
Long-Context Agents?* (He, Zhao, Wang and Chen, 2026), whose abstract finds that a second, deeper routing
level never helps and sometimes breaks accuracy. It measured long-document question answering, not
instruction files.)_

## The always tier is budgeted in tokens

**The budget is declared in the manifest and never defaulted**, as `context.always.budget.tokens`. A
breach is repaired by **demotion** to a later tier, by **merge** or by **retirement**, and never by
raising the budget in the change that breached it. The shape is memory's on purpose, its limit included:
a budget is a rail, not an aim, and the no-raise half is a rule no checker establishes, for the reason
[`memory.md`](memory.md) gives.

**Bytes per token are declared too**, as `context.ratio`, with the compile host whose measurement
domain the ratio describes. Calibration is deliberate, never repeated inside a recipe: no verify recipe
may make a network call, and a ratio that moved between runs would make one tree red on one run and green
on the next. The keys are argued in [`../../spec/slots.md`](../../spec/slots.md).

**On-demand provider count.** `portulan doctor --count-tokens MODEL_ID .portulan` sends the measured
Claude Code project always corpus to Anthropic using `ANTHROPIC_API_KEY` from the environment. Replace `MODEL_ID`
with a supported model; none is defaulted. The direct diagnostic also accepts
`node cli/context.mjs --workspace .portulan --count-tokens MODEL_ID`. Both send whole instructions,
imports and unscoped rules, but only extracted project skill, command and agent descriptions;
later-tier bodies and the measurement's personal/global/system/tool/plugin exclusions stay excluded.
Incomplete imports or invalid UTF-8 refuse before transport. Doctor validates the workspace and both
supported project-format budgets first; the request contains only the Claude Code corpus. Boot's
`--brief` line and the standalone context diagnostic also use that Claude Code domain. Count mode
summarizes validation failures without source values, and a separate `doctor --static` run
provides their details. The direct diagnostic validates its kind/tree/context domain, not the full schema.

The result is a **provider estimate**, including API framing and possibly system-added tokens;
actual host usage can differ. It reports provider/model, source bytes and an approximate effective
ratio, changes no manifest and does not override offline budget judgments. Assess the ratio manually
before declaring it for a compile host; `calibrated_by` remains that host's ID, never a provider/model
identifier. A ratio below the schema's minimum is reported as not declarable. An empty corpus makes
no request and supplies no ratio. Marius accepted “Provider count with stated limit” on 2026-11-09 for
[#506](https://github.com/sleepy-panda-srl/portulan/issues/506), qualifying proposal `0036`'s original
exact-host wording. The [provider guide](https://platform.claude.com/docs/en/build-with-claude/token-counting)
and [API contract](https://platform.claude.com/docs/en/api/messages/count_tokens) were checked that day.
This demonstrates a counting contract, not Claude Code's actual complete prompt.

Counting is unavailable with `--static` or in CI. The existing telemetry audit rejects literal
count-mode invocations in yielded recipe commands and their shell scripts; injected transports test
the contract offline. This is textual inspection of known modes, not arbitrary-shell prevention.

**A report by default, a rail by declaration.** A workspace is failed only against a budget it declared.

## Portulan budgets its own contribution

**Portulan budgets its own contribution by default, because it owns it.** That is the kernel, the boot
skill and the engine half of the boot read-set, skill and persona prompts, hook-injected text, and the
vendored `AGENTS.md` skeleton. The default is a rail in this repository, not a budget in any adopter's
manifest, so *never defaulted* holds. This is what lets every install benefit on upgrade without
configuring anything.

**The kernel, [`../engine.md`](../engine.md), is the core's source contribution to the always-loaded
layer**; `portulan vendor --host` inlines it verbatim into a vendored `AGENTS.md` beside the workspace's
own layer, for a host that cannot install the plugin. The **pack** layer is named in that file rather
than composed into it — a pack resolves from a feed at a pinned version and **vendoring resolves
nothing**, which is unchanged. Pack-cache discovery landed at milestone 7: the CLI reads the host's
record, a vendored file cannot. Nothing in this kernel is prose for its own sake: when a line stops being
load-bearing, it moves out of the kernel.

## A fresh context is priced where it is created

Whatever spawns one (a checkpoint, a persona, a ritual) states what it loads, and the compiled agent
carries that. **Reviewers keep the conventions they grade against**: the remedy for an expensive always
tier is a smaller always tier, never a blind reviewer.

## No optimisation may lower context or code quality

Prefer moving content to a later tier over deleting it, keep one source per fact, and measure before and
after. **A demotion states both figures.**

**What this does not ask for**: a defaulted workspace rail, lossy compression, a codebase vector index,
output-shortening tricks, or any change to a host. Portulan
compiles to what hosts load and does not change how they load it.

## Every request pays for what the session has read

Each tool call ends a request, and the next request sends the whole context again: the host's own prefix,
the always tier, and everything read and printed so far. The prompt cache makes the repeat cheaper, not
free. In Claude Code 2.1.281 the main conversation's cache lives an hour on a subscription within its
usage limits and five minutes on an API key or a cloud provider, a subagent's five minutes unless set
(its settings `promptCacheTtl` and `subagentPromptCacheTtl`, read in its program text on 2026-09-24).
So what a session adds, it pays for on every request after, and a task done in fewer requests re-sends
less. `compile` writes the lead of each rule below onto every boot card, Portulan's and each consumer's:

- **Send independent tool calls in one request.** Reads, searches and commands whose inputs do not wait
  on each other's output cost one request together and one each apart, and each request re-sends the
  context.
- **Read a file once; reuse what your context holds.** A second read of an unchanged file adds a second
  copy, paid for on every later request. After an Edit, do not read the file back to check it: the host
  refuses an edit it cannot apply, and says so.
- **Open a file only when the task needs it, and one of 300 lines or more only where it does:
  `node <plugin root>/cli/symbols.mjs <file>` outlines it, and `<file>#<heading>` prints one section.**
  The outline gives each part's lines, and a Markdown heading's anchor and size; it costs a line a part
  where a doctrine page or an instruction file runs to thousands of tokens and a task needs one section.
  A link to a heading names its section, so `<file>#<anchor>` reads what the link points at without an
  outline. A shorter file the task changes is read whole, as below. Read a section you will edit with the
  Read tool's `offset` and `limit`, which an Edit may follow. `<plugin root>` is where Portulan is
  installed, the directory whose `core/engine.md` the boot reads; in Portulan's own repository it is the
  repository, and `compile` writes the command as run from there.
- **Ask for only the output you need: a range, a count, the failures.** Output enters the context as a
  read does. A passing run needs its summary and a failing one the failing check and the fact to act on,
  as [`loop.md`](loop.md)'s compacted error does; `git diff --stat`, `grep -c` and a line range ask for
  less than a whole log, file or tree.
- **The prompt cache lasts five minutes or an hour: a longer pause, or a fresh subagent where one could
  be resumed, writes the whole context again.** A subagent's context is its own and starts with the
  host's prefix, so start one only where the reads it keeps out of this context cost more than that
  prefix, and resume one rather than start another; [`sessions.md`](sessions.md) holds both, and the
  lifetime a workspace declares. The cost table in the same program text prices a cache write above
  sending the tokens fresh and a cache read below it.
- **Code should speak for itself: a comment is paid for on every read of its file, so add one only when
  truly needed, concise, meaningful and valuable (less is more), and keep a change's history in its
  commit message.** Claude Code 2.1.281's system prompt tells a model to match the surrounding code's
  comment density, so what a file carries, the next change copies. Truly needed is what no name or
  structure can show, in a line: a host's behaviour at its version, an ordering or a safety constraint the
  code does not make obvious, a limit of the algorithm. A comment never carries a date, a proposal or
  milestone number, a review round or a reviewer's credit, a pull request or issue number, or a narration
  of what the code does; where the code needs one to be understood, rename or extract instead.
  `node <plugin root>/cli/comments.mjs` counts the comment lines that record a change's history, in code
  and in a Markdown file's HTML comments other than the lines a tool reads, and a workspace's `comments`
  recipe holds that count at a limit that only falls.

## Code is read by symbol

A session outlines a code file of 300 lines or more before it opens it, then reads the spans it needs: in
Claude Code, the Read tool with `offset` at a span's first line and `limit` its length. **A file under 300
lines that the task changes is read whole**, since most of it is context for the change and the saving is
smallest there, and so is any file whose outline cannot say where a change goes. A span read the host does
not cut is a full read of those lines, so an Edit may follow it: in Claude Code 2.1.281 a Read is marked
partial, and an Edit or a Write after it refused, only when the Read's token cap, 25,000 by default, cut it
(read in its program text on 2026-09-24). [`cli/symbols.mjs`](../../cli/symbols.mjs) prints the outline,
one line per symbol, and `--find <name>` locates a definition; it outlines Markdown by its headings, with
each section's anchor and size, the same way. It prints from the file as it is, so no map is committed to
go stale. Nothing checks that a session outlined first; what the rule saves is measured by rerunning a
task, never by a recipe, which may not read the host's usage records.

## What a handoff hands on

A handoff carries open state, decisions with their why, questions, the next action and what remains
unsafe. It links a fact's owning record instead of repeating the diff, measured figures or doctrine.
Its heading names the outcome; its filename already carries the date. Keep decisions and their why
when compressing: moving them and linking preserves them, dropping them does not.

A workspace may declare a per-handoff token cap and a cutoff at its explicit ratio. Only records dated
after that cutoff are bound; merged history is not rewritten. Compression or moving a fact to its
owning record repairs a breach, never splitting, retirement, a higher cap or a later cutoff in that
change. A correction counts toward the cap; if it would breach a merged record, put it in the correcting
session's handoff and name the corrected one. Review prevents backdating or moving a cutoff backward,
and advances it only with a tighter cap or lower ratio to exempt already merged history. The cutoff
day remains unbound because a date cannot separate morning merges from evening work.

The generated index may have its own token budget: a complete header and omission notice plus the
newest whole entry lines that fit. Omitted handoffs stay in the dated series, with no second index.
Both are on-read; neither belongs in the boot or always tier. The session-end gate checks existence
and a date, never length; the index recipe owns the upper cap. There is no aggregate series budget
and no minimum length. These are accepted proposal 0037's rules, implemented in Workspace Definition
2.15; the schema contract and history-dependent limits are in [`spec/slots.md`](../../spec/slots.md).

## What is machinery today, and what is not

As of Workspace Definition 2.9 a workspace can declare the budget and the ratio, and both are checked
for shape, by the schema and by `doctor`; the manifest key refuses a budget with no ratio to count it by.
**The always tier is measured and reported per project format.**
[`cli/context.mjs`](../../cli/context.mjs) measures Claude Code's project files and the root vendored
`AGENTS.md` in a workspace's `tree`. Doctor reports both without host-selection configuration. The
single declared cap is judged independently for each, never against their sum. A shared ratio is called
calibrated only where its declared calibration ID matches the reported format ID; a different or unknown
ID is explicitly extrapolated. The AGENTS measurement includes its
inline guidance and pointer text; pointer targets, at-sign expansion, personal, above-tree, nested
files and plugins are outside that domain. An absent optional root file is zero; a present root source
that is unreadable, nonregular, dangling or invalid UTF-8 is unmeasured, and an escaping AGENTS root
is unmeasured too. Without a budget that is a report; with one it cannot judge the declaration and
fails. Known excluded Claude imports and its ignored missing/depth-limited imports stay excluded.
Each host receives its verdict even when the other cannot be measured. These are project-file
estimates, not whole-host prompts. The boot closes with the Claude Code line. Split offers and priced
demotion levers describe that domain; the form report also recognizes a vendored AGENTS boot card and
requires its budget verdict to be resolved before applying an offered migration. Form reads check
canonical containment and regular-file status before opening project sources; its boot-unit source is
bounded to the workspace. Instruction-state advice checks ancestors too, while preserving valid local
links and supplied prospective readers. This repository's
`context` recipe holds the boot, description and owned prompt rails described below. **A boot can
read a card instead of the slots**: the `boot` unit of `slots.context` (Workspace Definition 2.10) is
compiled into every context, imports whole the files it needs, writes out the lead sentences of others,
and names the file behind each line, so the rest loads when a rule's path or the card sends a session to
it. **A team's own instruction file can be split the same way, section by section**: a line
`<!-- portulan: on-read -->` under a heading of `CLAUDE.md` or `.claude/CLAUDE.md` is the team's word that
the section may leave every context, and `portulan upgrade` moves it, byte for byte and proved to
reassemble, into an on-read unit whose index line names the heading and its size in whole KB. `doctor`, the
boot and `init` offer it where the file is over `0036`'s 8,000-token offer floor, and `doctor` and the boot
wherever a declared budget is breached, naming there the command that splits while `upgrade` will not run;
a section is never moved for its size alone. Claude Code 2.1.281 drops a comment standing on its own lines
before it loads an instruction file or rule (read in its program text on 2026-09-24), so the mark and the
marker left behind cost nothing. This repository's own card holds its boot under the 7,500-token line of
2026-09-23, railed at today's figure plus 2% by the same recipe. A pointer's repository is not measured,
because a pointer declares no tree. **A persona can declare what its context costs**: `model`, `effort`,
`omitClaudeMd` and `cacheLifetime`, refused when malformed and never defaulted, which `compile` writes into
the hand-written binding of a persona a composed pack ships, and the core personas when compiling this
engine's own declared tree, and byte-compares under `--check`, printing
each field a host cannot express, with the persona and the host, as its degradation report for personas.
The compiler and doctor select `agents/` in a plugin tree and `.claude/agents/` in an ordinary
project, using the same bounded marker classification. Existing bindings compile even without a gate
policy or guidance; missing adopter bindings remain unbound. Nonregular and unreadable inputs are
not treated as absence. The two composed product roles have real plugin bindings. The committed
four-tier fixture includes an on-invoke skill. An on-path unit can select a literal nested
`CLAUDE.md` instead of scoped rules. Its mark and portable ownership registry distinguish repairable
drift from human replacement and allow owned target retirement. The body refuses imports that could
change meaning at its destination. From a project-root Claude session, the nested file is loaded on
subtree access; starting within that subtree can load it at startup. An unimported nested file is
outside project-root budget accounting, while an explicit root import is included. The unit contract
and limits are in [the slot specification](../../spec/slots.md#slotscontext--the-guidance-a-host-loads-each-unit-in-its-tier).
The compile recipe checks the committed exemplars and their companion rules
without writing. These are file/discovery contracts, not evidence of host enablement, field honoring
or runtime savings. The acquired [native-child comparisons](../../evals/ab/personas/README.md)
observe the three named core roles, matching inherited parent/child models and
effective high/medium child effort. They do not isolate every compiled field or
host precedence rule. The core declarations choose
`model: inherit`, `omitClaudeMd: false` and `cacheLifetime: 5m`, subject to the host precedence described in
[`../personas/README.md`](../personas/README.md). **The librarian reports project always-tier headroom**
against a declared budget and puts conditional demotion drafts in its standing report
([#508](https://github.com/sleepy-panda-srl/portulan/issues/508)). It drafts only loaded,
matching, compiler-owned pure always units from the workspace, excluding boot
cards, at-sign text, imported sources, expansions, links and stale targets.
Compiler ownership needing regeneration is repaired before drafts are offered.
An ownership plan covering another tree or workspace directory is refused.
The human decides whether guidance can wait,
supplies its description, and recompiles and measures before/after when applying
the demotion. The pass changes no guidance, and its measurement keeps the same
Claude Code project domain and exclusions as `context`; other hosts and full-host
context remain outside it. **The tier matrix reports which tiers each host expresses.** The Stop-gate
now captures recipe failures while the command runs, so later success noise cannot displace an earlier
failure from the runner's tail. It keeps stdout/stderr line state separate, omits recognized passing,
skipped and expected-TODO reporter records, and relays recognized failures with
up to eight following indented detail lines per marker. An unrecognized diagnostic is explicitly
labeled as fallback; a nonzero exit with only passing lines says no failure diagnostic was identified.
The excerpt, executor diagnostics and clipping notices fit 4,096 bytes; the whole recipe problem fits
6,144 bytes, including bounded identity and error text. Full output requires an explicit verification
run. These are diagnostic excerpts, not a proof that arbitrary output was classified correctly.
The repository's `context` recipe also rails registered skill bodies (manual-only included), core and
composed persona charters and actual plugin bindings, deterministic native hook message profiles, and
vendored AGENTS.md profiles. The byte limits, inventories, fixed-input accounting and finite-profile
limits live in [the verify README](../../.portulan/verify/README.md#owned-prompt-profiles).
These checks cover repository growth, not arbitrary runtime payload size or whole-host context.
Row 12 of [`../../docs/plan.md`](../../docs/plan.md) remains in progress; remaining obligations are held
by the human gate rather than described as enforcement.

_(Provenance: proposal `0036`'s sealed incident, in which an adopting repository's always-loaded
instruction files measured 130k tokens per fresh context, cache writes were most of the spend, and every
subagent and checkpoint paid it again, because nothing measured, budgeted or demoted what the host
loads. Host facts from the Claude Code documentation on costs, prompt caching and memory, checked
2026-09-21.)_

## What a change spends

This is proposal [`0038`](../../.portulan/proposals/0038-what-a-change-spends-is-measured.md)'s second
part: the cost of re-reading and rebuilding what the first part loads. The rules below govern spend;
[`sessions.md`](sessions.md) applies them to session startup, cache lifetimes and host switches.

### Price a change from usage records

**A change is priced from the host's own usage records, numbers only**, attributed to its branch and
then its pull request: requests, tokens by class (uncached, written by lifetime, read and output), fresh
contexts opened, largest context, hit rate, cache rebuilds and their causes, and tokens per changed line.
Per-block duplicates count once. Where the host keeps totals of its own, the measurement states its
difference from them; unavailable records are not evidence of zero spend.

Token accounting uses usage fields, and local-worker accounting uses recognized receipt lines in
recorded Bash results; conversation text is not a pricing signal. The receipt-format limit and the
separate local figures belong to [the local-model rules](#a-local-model-runs-without-the-host-floor).
[`cli/ledger.mjs`](../../cli/ledger.mjs) reads locally, without a network call. A verify recipe never
opens host usage records: `doctor --static` validates without them, and ledger fixtures supply synthetic
records for verification.

### Restart at a computed threshold

**A restart comparison states its assumptions before advising a handoff.** Its
break-even context is `C* = F + (F × m_w + R) / (n × m_r)`: fresh context `F`,
write/read multipliers `m_w` and `m_r`, requests remaining `n`, and additional
resume expense `R` in uncached-input-token equivalents. The workspace declares
these in `spend`; undeclared multipliers and horizon use the stated general
figures. The horizon does not decrement automatically.

`spend.resume.tokens` includes handoff output, boot/state recovery and additional
rereads over that horizon, excluding the formula's existing fresh-context write
and baseline reads. These are weighted cost units: 2,000 output tokens at 5× cost
contribute 10,000 equivalents. The estimate is supplied, not predicted. An absent
estimate is unknown, distinct from an explicit zero. Its threshold is then only
a lower bound, and the report says to finish bounded work when that costs less.

[`cli/advisory.mjs`](../../cli/advisory.mjs) speaks once with a tool result or at
a prompt, again after a compaction, and shows the same assumptions on the status
line. A declared `restart: "block"` holds once only with an explicit horizon and
resume expense and finite, strictly positive estimated savings
`n × m_r × (C − F) − m_w × F − R`. Equality never holds. Existing block declarations
without both estimates become conditional reports without a hold. Nothing ends
the session automatically. [`spec/slots.md`](../../spec/slots.md#spend--the-figures-the-restart-threshold-is-computed-at)
gives the declaration contract. This refinement follows the bounded-run evidence
in [#503](https://github.com/sleepy-panda-srl/portulan/issues/503); proposal 0038 is
preserved as its dated decision record.

A delayed transcript batch retains its first usable crossing in the current
compaction generation, including that request's context, fresh context and price
assumptions. If later counts fall below threshold, the line identifies that
historical crossing and says the latest estimate does not favor restarting.
Status remains current; Stop uses only the latest comparison. Changed declared
prices, horizon or resume expense replay the transcript before selecting a
crossing under those assumptions. A controlled Claude Code trace and delayed
batch checks live in [`cli/fixtures/advisory-crossing/`](../../cli/fixtures/advisory-crossing/);
they do not promise a universal host transcript latency bound.

### Keep the prefix stable

`doctor` reports potential Claude Code cache risks from the declared tree's
`.claude/settings.json`, `.claude/settings.local.json` and `.mcp.json`. It checks
`opusplan` aliases and conditional Haiku plan upgrades, explicit project
`ENABLE_TOOL_SEARCH=false`, and `ToolSearch` permission denial. Local scalar/env
values override shared values; rejection and denial lists accumulate. MCP counts
distinguish eligible configured candidates from project-file approvals. Neither count
establishes trust, live activation or connectivity. User, managed, CLI and broader
model/MCP policies, the full MCP schema, experimental-beta disabling and other
selectors remain unassessed. Every assessment names its selectors and these
limits, including when no recognized risk is found. Unreadable or invalid project sources produce sanitized notes rather
than a cache-safe assurance. These reports change no validation verdict or settings.

The inspected behavior follows Claude Code's [model configuration](https://code.claude.com/docs/en/model-config#opusplan-model-setting),
[tool search](https://code.claude.com/docs/en/mcp#configure-tool-search) and
[project MCP rejection](https://code.claude.com/docs/en/settings-reference#disabledmcpjsonservers)
references, checked 2026-11-11. A detected setting is a potential risk, not a measured
cache miss or bill.

**Model and effort are chosen when a context is created**, and tool definitions are deferred wherever
the host can defer them. Content that varies per session — a git snapshot, a date, a fresh working
directory, a session ID — stays out of Portulan's own always tier and hook-injected text. It may leave
one session's cache intact while forfeiting the prefix that sessions in one directory share.

Portulan's repository makes changes to these static carriers reviewable through
its `cache-stability` recipe: loaded files, hook sources and commands, and gate
explanation inputs are compared with a committed full-content golden. Its lexical
inventory identifies suspicious literal forms; unchanged digests establish only
unchanged repository text. Runtime session values, arbitrary helper outputs and
the host's prefix remain outside that capture. The repository's
[recipe instructions](../../.portulan/verify/README.md#the-recipes) name the explicit
refresh command and the forced-red drill. This is its own rail, not an adopter's
automatically installed policy.

A hosted session whose system prompt names the session itself starts cold whatever a workspace compiles;
that is inferred from such a prompt, not documented. The [session-start rules](sessions.md#a-session-starts-warm-or-it-pays-the-prefix-again)
describe the host's warm-start conditions; a workspace cannot repair the host's prefix by compiling one
of its own.

### Routing is declared and earned

**The spawner states effort and how many contexts it may open, alongside what it loads**, extending
[the fresh-context declaration](#a-fresh-context-is-priced-where-it-is-created). Context count is a
declaration obligation; no context-count field is compiled today.

**A cheaper model or a lower effort for a role is earned by an A/B run before it is shipped.** A host
switch that changes the prefix meets the same evidence gate. The comparison must show reduced spend
without lost quality, and the shipped routing must be the routing its record supports. A cheaper
context that cannot do its role costs rework; a reviewer keeps the conventions it grades against.
Session switches retain their [specific guards](sessions.md#a-switch-that-changes-the-prefix-is-earned),
and local routing retains its screen-versus-comparison distinction below.
The three [core-persona records](../../evals/ab/personas/README.md) compare shipped
inheritance with a native medium-effort override on one concrete model. Both arms
pass the nine frozen cases; the shipped policy retains inheritance and undeclared
effort. Other parent models remain unmeasured. Plugin updates carry the baked
bindings; `upgrade` refreshes existing eligible bindings through the compiler's
ownership planner without creating foreign core adapters or changing settings.

### Budget what returns to the model

**What a tool, recipe or hook hands back to the model is budgeted: failures in full, passes as a count,
and nothing echoed on every turn.** This is [the loop's compact-error rule](loop.md#context-is-the-budget)
applied to every output the model reads, with failure evidence retained so the saving cannot lower
quality. The reading rules above govern how a session asks for bounded output.

`doctor --agent` returns one aggregate count line on green. `recipe-set --agent`
wraps every yielded workspace and pack command in a shared executor: one counted
green line, complete stdout and stderr on failure. Direct commands retain human
output. Required tests and the existing CI job exercise that interface. Prefix
stability is a separate claim: a text baseline cannot establish runtime cache
behavior. The remaining demonstrations stay in [row 13](../../docs/plan.md#milestones).

### A local model runs without the host floor

A model served on the machine itself costs nothing per token, so `0038`'s dollar arithmetic gives it no
restart threshold. What it does cost is time to prefill, memory for each context it holds, and recall that
still sags in a long context. And every turn it takes is a turn the parent session does not send again on
each request after. So a local model is called as a context firewall, and four rules hold it:

1. **A local worker runs without the host floor (`omitClaudeMd`) and under a hard input-byte ceiling.** It
   is given one bounded input: a symbol span from [`cli/symbols.mjs`](../../cli/symbols.mjs), a file under
   300 lines, a diff, or a log to compress, and never the parent session's instruction files. A prompt over
   the ceiling is refused before a socket opens. _Why: a host floor of 44k to 85k tokens is prefilled into
   a local model's cache on every cold context, where `0039` measured prompts of about 400 to 470 tokens
   prefilling in 0.85 to 1.88 seconds._
2. **Thinking effort is set explicitly at invocation**: low or off for a mechanical transform, bounded for
   prose or review, never left to the chat template's default. _Why: one template `0039` read sets
   reasoning effort to `xhigh` unless thinking is switched off, and under a 1,500-token cap that model
   returned no answer on any of three tasks, every token spent thinking; at low effort it passed both
   tasks it was rerun on._
3. **A local edit is kept only on its verify command's exit `0`.** The runner applies the edit and runs the
   command. On exit `0` one receipt line is all that enters the parent context (`0038` rule 5). On exit `1`
   after its retries, or at once on any other exit, which is no verdict, it restores the file's original
   bytes, and it does the same on SIGINT, SIGTERM and SIGHUP. **This is a rollback, not an atomic write**:
   the verify needs the edited file in place, so any other signal that ends the runner, SIGKILL and SIGQUIT
   among them, or a power loss between the edit and its verdict leaves the edit, and a transform with no
   receipt is unverified. _Why not atomic: a scratch worktree would judge the last commit plus the edit
   rather than the working copy plus the edit, would lack the untracked files a verify reads, and moving
   the edit back after exit `0` would not be atomic either (`0039` ruling 4)._
4. **Loopback is a rail, and routing follows the [declared-and-earned gate](#routing-is-declared-and-earned).**
   A local runner refuses an endpoint outside loopback
   (`127.0.0.1`, `localhost`, `[::1]`) unless leaving it is proposed and approved. A screen grades an
   installed model once per task against Portulan's own predicates, from
   [`cli/comments.mjs`](../../cli/comments.mjs), [`cli/doctor.mjs`](../../cli/doctor.mjs) and
   [`cli/skill-goldens.mjs`](../../cli/skill-goldens.mjs), and a model that fails it is not routed. Passing
   it earns nothing. For the local comparison, use the local model as routed against the host's model on the
   same tasks, `k` runs per cell, captured once and railed to its register in `evals/ab/`. _Why: an endpoint off the machine sends workspace context away under a local
   tool's name, and the screen takes one sample per task with no baseline arm, so a screen is not routing
   evidence (`0039` ruling 5)._

**What the runner holds today.** The [`tools/local-llm`](../../packs/tools/local-llm/README.md) pack's
runner holds rules 1 to 3 and rule 4's loopback rail for the calls it makes. It sends the model its own
short instructions and the input it was given, with the end of a red verify's output on a retry, and
nothing else. It refuses a prompt over its ceiling before a socket opens, names the effort on every chat
request, low unless set, requires a verify command for an edit and rolls back as rule 3 says, and refuses
a host off loopback and a redirect away from it. Which inputs it is given is the caller's: only their
bytes are checked. `--allow-remote` lifts the loopback rail on the caller's word, and the pack's
`local-llm-off-loopback` gate has no matcher, so approval to leave loopback is the human's. Its `eval`
subcommand is the screen. Its `runner-rails` recipe holds the loopback and ceiling refusals and the
rollback on a red or no-verdict verify offline, with no network call; the rollback on a signal is held by
the runner's tests. This repository composes the pack and registers its skill; the ledger reports local
receipts beside the host's tokens. `doctor` includes that branch-owned usage report by default,
with unavailable data reported as unmeasured; `--static` omits usage-record discovery for verification.
Receipts are recognized by their whole-line format in recorded Bash results: a matching echo can be
counted, and output omitted from the transcript is missed.
The [captured A/B](../../evals/ab/local-worker.md) supports code
at low effort (L5/H5), while shared prose is disabled because codify scored L0/H3, despite handoff's
L5/H5. Operational defaults and explicit roles require the measured model at low effort; explicit
model-only calls remain candidates. The record and register are regraded and byte-compared in CI,
with shipped routing rederived from their turns. The `local-worker` persona declares
`omitClaudeMd: true` and `effort: low`, and `compile` writes both into a workspace's binding against a
committed golden.

_(Provenance: proposal
[`0039`](../../.portulan/proposals/0039-a-local-model-runs-without-the-host-floor-and-under-a-thinking-cap.md)'s
measurement of two local models against three of this repository's tasks on 2026-10-27, and its rulings 4
and 5 of 2026-10-30.)_
