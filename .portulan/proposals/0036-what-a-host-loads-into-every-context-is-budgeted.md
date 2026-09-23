# Proposal 0036 — what a host loads into every context is budgeted, like memory

**Status. ACCEPTED — drafted and accepted 2026-09-23, with revisions; its five open questions ruled by
the maintainer the same day.** Drafted on his directive of that day (*"Deliver token & cache
optimizations"*), from the kickoff of 2026-09-21 that carries the measured baseline below. It proposes a
rule and an order of work and builds nothing. His rulings are recorded under *What the maintainer ruled*,
and the milestone row the first of them asks for landed with it as row 12 of
[`../../docs/plan.md`](../../docs/plan.md). The acceptance and its revisions are recorded under *Decision*.

**Pull request:** https://github.com/sleepy-panda-srl/portulan/pull/429

## Incident — every fresh context paid for the whole always tier, and nothing in Portulan could see it

**Sealed.** An adopting repository, measured 2026-09-21 on Claude Code 2.1.275. It stays in its owner's
layer; the stamp under *Provenance* is its record here.

- A fresh session's first turn carried **130.1k tokens of instruction files**: the project's instruction
  file (380,405 bytes, 3,932 lines) and the host's auto-memory index (8,495 bytes). Beside them sat 14.7k
  of MCP tools, 12.5k of system tools, 9.9k of skills and 4.1k of system prompt. Three sections of the
  instruction file were 91% of it, and its prose ran at about **2.99 bytes per token**.
- A fresh session's first request **wrote 159,631 tokens** to the prompt cache. A fresh subagent's first
  request wrote **124,544**, because a subagent receives the project instruction file by default.
- Over the project's first one to two minutes, across two threads: input 1.4k, output 3.9k, cache write
  263.5k, cache read 1.4M. Priced as the kickoff priced them (output at 5× input, cache writes at 2× for
  the one-hour cache, reads at 0.025×), cache writes were about **90%** of the cost, reads about 6% and
  output about 3%. With reads at 0.1× input instead, writes are still about **77%**, and output about 3%.
- The documents its sessions were sent to: a decision log of 398 KB, where one default read is about
  125k tokens, a principles document of 421 KB and a plan of 170 KB.
- **Portulan's own share there.** Each boot read the 22.8 KB boot skill plus identity, principles, gate
  map and definition of done (49.8 KB). The handoff series was 101 files and 1.2 MB, with no budget. The
  memory store was budgeted and under half used: **the one layer Portulan budgets was the one that was
  fine.**

**Public: this repository, customer zero, has the same shape.** Measured 2026-09-23 at `4303882`:

- [`../../docs/plan.md`](../../docs/plan.md) is **452,764 bytes**, and its own header says *"each session
  boots by reading it"*.
- The boot skill's read-set here is the kernel, identity, principles, constitution, gate map, definition
  of done, repo card and memory index, plus the boot skill itself: **213,002 bytes**, of which the gate
  map is **65%**.
- On the demo workspace, with its `combcount` repo card, the same read-set is **41,156 bytes**, and
  **55%** of it is the boot skill. On a small adopter, Portulan's own procedure is the largest thing a
  boot loads.
- The plugin puts seven skill descriptions and three agent descriptions, **3,386 bytes**, into every
  session of every project where it is enabled.
- The Stop-gate relays the **last 25 lines** of a red recipe's output, stdout then stderr, with no byte
  cap ([`../../cli/stop-gate.mjs`](../../cli/stop-gate.mjs)). On this tree `docs.sh` prints 18 lines, 16
  of them `ok`, so a refusal over one failing check carries every passing check with it. The gate refuses
  at most three consecutive times per reason and nine times in all, and each refusal is an extra model turn.
  [`../../core/operating/loop.md`](../../core/operating/loop.md) already says *"Compact the error, not the
  transcript, back into context"*, and Portulan's own hook does not.

**Public, and measured on this proposal itself.** The project that drafted it, in this repository, which has
no root instruction file, used **110.3M tokens** for a change of +328/−2 lines: 106.5M cache reads, 3M cache
writes and 0.7M output, by the host's usage report of 2026-09-23. The drafting thread alone was 93M. Turns
drove the cost: every turn re-reads the whole conversation, and each fresh-context checkpoint started over.
An always-tier budget would not have caught it, since this repository's always tier is small; shorter
sessions that hand off to a fresh context sooner would have.

**Portulan's method multiplies the cost.** Its checkpoints run in fresh contexts by rule
([`../gate-map.md`](../gate-map.md), *Supervised-build checkpoints*). Its three agents in
[`../../agents/`](../../agents/) set no `model` and no `omitClaudeMd`, so every spawn pays the full always
tier. And per the host's documentation, checked 2026-09-21, the prompt cache is scoped per working
directory, worktrees included, so each desktop session writes its own. In the sealed incident that was a
124k-token cache write for every subagent.

## What exists, and the gap

What Portulan budgets today is real and narrow:

- **Memory.** The index by lines and columns, the store by kilobytes and per record: declared in the
  manifest, never defaulted, and railed by the `index` recipe. Its doctrine repairs a breach by
  consolidation, never by a raise in the same change
  ([`../../core/operating/memory.md`](../../core/operating/memory.md)), and that half is a rule no checker
  establishes ([`../../spec/slots.md`](../../spec/slots.md)).
- **The kernel.** [`../../core/engine.md`](../../core/engine.md) is 47 lines, railed at 60 by
  [`../verify/docs.sh`](../verify/docs.sh), and only in **this repository's** recipe.
- **Per-host compilation.** Gates compile to Claude Code settings and a GitHub ruleset, with a degradation
  report, and recipes run through the Stop-gate those settings call. `vendor --host` writes an `AGENTS.md`
  that inlines the kernel verbatim and links every slot, deterministically and with no size check.

**The gap:** nothing measures, budgets or demotes what a host loads into every context. `doctor` never
opens `CLAUDE.md` or `AGENTS.md`. Every size rail in the CLI counts lines, columns or bytes, and none
counts tokens. The rule this repository states for its own kernel, *the always-loaded layer is the scarce
one*, reaches no adopter's always-loaded layer at all.

## Proposed rule

For a new doctrine page, `core/operating/context.md`, with `context` added to the kernel's map (47 of 60
lines used today):

1. **Every piece of guidance sits in a load tier, and belongs in the latest tier that still reaches the
   agent in time.** There are four tiers. **Always**: loaded into every context, which covers project
   instruction files and their imports, unscoped rules, and skill and agent descriptions. **On-path**:
   loaded when the agent first touches a matching path, which covers nested instruction files and
   path-scoped rules. **On-invoke**: loaded when a skill, persona or ritual runs. **On-read**: loaded when
   the agent opens the file. **One level of index only**, which the study under *Provenance* motivates
   and does not establish: an always-tier line may point at content, and a pointer may not point at
   another pointer. A **pointer** is a line the agent reads to decide whether to open something; a file a
   procedure always reads is content loaded in that procedure's tier, not a pointer. So the kernel's map,
   whose lines point at directories of content, is one level, and so is the boot's path to a memory
   record: the boot always reads the memory index, and each index line is the one pointer to its record.
2. **The always tier is budgeted in tokens.** The budget is declared in the manifest and never defaulted.
   A breach is repaired by **demotion** to a later tier, by **merge** or by **retirement**, and never by
   raising the budget in the change that breached it. The shape is memory's on purpose, its limit
   included: a budget is a rail, not an aim, and the no-raise half is a rule no checker establishes.
3. **Portulan budgets its own contribution by default, because it owns it.** That is the kernel, the boot
   skill and the engine half of the boot read-set, skill and persona prompts, hook-injected text, and the
   vendored `AGENTS.md` skeleton. The default is a rail in this repository, not a budget in any adopter's
   manifest, so rule 2's *never defaulted* holds. This is what lets every install benefit on upgrade
   without configuring anything.
4. **A fresh context is priced where it is created.** Whatever spawns one (a checkpoint, a persona, a
   ritual) states what it loads, and the compiled agent carries that. **Reviewers keep the conventions
   they grade against**: the remedy for an expensive always tier is a smaller always tier, never a blind
   reviewer.
5. **No optimisation may lower context or code quality.** Prefer moving content to a later tier over
   deleting it, keep one source per fact, and measure before and after. A demotion states both figures.

## Enforcement — each piece is a rail, a measurement or a report

- **Measurement.** One module converts the bytes each tier loads into tokens at a **declared** ratio, with
  an **exact** mode, run on demand, that asks the host for the true count and prints the ratio to declare.
  The manifest records which host's exact count calibrated the declared ratio. It exits 0, 1 or 2 like
  every recipe. **The exact mode never runs inside a recipe**, because no verify
  recipe may make a network call ([`../gate-map.md`](../gate-map.md)).
- **A report by default, a rail by declaration.** `doctor` reports every workspace's always tier per host
  with no configuration: its size, the top contributors, and the tier each sits in. The same figure closes
  the boot. `doctor` fails only where the manifest declares a budget. A defaulted rail is a non-goal; the
  default is the report.
- **Compile targets per host.** For Claude Code that means path-scoped rules and nested instruction files
  for the on-path tier, skills for on-invoke, and each persona's `model`, `omitClaudeMd` and cache
  lifetime from what it declares it needs. The compiled files are **committed, regenerated from source
  and byte-compared**. The degradation report says which tiers a host can express, and the vendored
  `AGENTS.md` inherits the tiers.
- **Portulan's own footprint** is railed in this repository's recipes, as the kernel already is. Its
  budgets start at today's measured figures and are lowered as each demotion lands. The first two
  demotions are named here: the boot skill keeps its procedure and moves its rationale into on-read
  references, and the Stop-gate relays failing lines only. _(Amended the same day, on the later ruling
  recorded under *What the maintainer ruled*: the boot skill's procedure for a pointer manifest and for
  packs loads only where the manifest is a pointer or names a pack, and the rest of its procedure stays
  in the skill. Annotated rather than rewritten, so the record keeps what was accepted beside what
  changed.)_
- **A librarian pass** reports always-tier headroom beside memory's and **drafts** demotions as a pull
  request. It never applies one, because the curated layer is agent-drafted and human-owned.
- **`init` offers a starting budget** in its interview: the larger of 8k tokens and what the repository
  loads today. It is an offer the human accepts, not a default.
- **Not a ninth subcommand.** [`../../docs/vision.md`](../../docs/vision.md) enumerates eight, and that
  list is the maintainer's. Unless he rules otherwise, the measurement is reached through `doctor` and a
  recipe.

## What this does not ask for

A defaulted workspace rail: the default is a report. Lossy compression. A codebase vector index.
Switching model or effort mid-session. Output-shortening tricks, since output was about 3% of the cost.
Any change to a host: Portulan compiles to what hosts load and does not change how they load it. **And
the handoff series:** its size budget is proposal `0037`'s, by the ruling below.

## What the maintainer ruled — five questions, 2026-09-23

Each question went to him with a recommendation, and he ruled on all five in one message:

> 1. Run before row 9. It's top priority.
> 2. Bytes per token: declared in the manifest, measured exactly on demand.
> 3. Committed and checked against their source.
> 4. It's own proposal.
> 5. The larger of 8k tokens and what the repo loads todays.

1. **Where this sits in the milestone map: a new row 12, run before row 9, and top priority.** Row 9
   multiplies fresh contexts (fleet, headless runs, babysitter rituals), so each context is priced before
   there are more of them. The row is appended rather than inserted, so nothing is renumbered, which is
   the precedent row 11 set. It lands in this change, with its drafting rationale in
   [`../../docs/milestones/m12.md`](../../docs/milestones/m12.md).
2. **Bytes per token: declared in the manifest, measured exactly on demand.** A per-run measurement would
   be a network call inside a recipe, and a ratio that moved between runs would make one tree red on one
   run and green on the next.
3. **Compiled rule files: committed, and checked against their source**, as `.claude/settings.json` is
   here. A desktop session's worktree is a fresh checkout, so a gitignored, regenerated rule would be
   missing from exactly the contexts this makes cheaper: a silent loss of context quality. Rule files
   carry no machine paths. The absolute paths that make an adopter ignore `.claude/` sit in compiled hook
   commands and drafted recipes, which are their own open issues
   ([#423](https://github.com/sleepy-panda-srl/portulan/issues/423),
   [#428](https://github.com/sleepy-panda-srl/portulan/issues/428)).
4. **The handoff size budget: its own proposal, `0037`.** The schema records the missing handoff budget
   as a considered choice: a series total has every remedy barred, because retiring or splitting a handoff
   breaks its correspondence with the Session log. A per-record cap has a live remedy, compression, and
   deserves that argument on its own. Handoffs are also an on-read cost, not an always-tier one.
5. **The starting budget `init` offers: the larger of 8k tokens and what the repository loads today.** A
   new repository gets room for an instruction file of about 200 lines, the host's own guidance (about
   5.4k tokens at the measured ratio), plus rules and descriptions. An existing repository is never red on
   the day it adopts, and slimming then lowers the figure.

**A later ruling, the same day: the boot skill's procedure for pointers and packs loads only where it
applies.** Once the first demotion had landed
([#432](https://github.com/sleepy-panda-srl/portulan/pull/432)), the skill's pointer branch (its step
2a) and pack limits (its step 3a) were 10,120 of its 17,813 bytes, read at every boot and needed only
where a manifest is a pointer or names a pack. Reading them from files the skill opens on that
condition moves procedure, which the *keeps its procedure* wording under *Enforcement* ruled out, so at
13:44 UTC the question went to him with a recommendation to amend it. At 17:07 UTC he answered the calls
then pending, this one among them:

> My answer to the pending calls is yes.

The wording under *Enforcement* carries the amendment as an annotation, made in the same change as the
move.

**A coordination note, not a question.** The manifest key needs a MINOR. `2.9` is commissioned by
[`0034`](0034-one-spec-bump-carries-both-evals-and-telemetry.md) for `evals` and `telemetry` and is not
drafted yet. By 0034's own argument this key rides that MINOR if they are drafted together, and neither
waits for the other if they are not. _(Settled the same day, when the key was drafted: `0034`'s slots were
not drafted with it, and `0034`'s accepted text commissions one MINOR without naming its number, so the key
took `2.9` alone in [#440](https://github.com/sleepy-panda-srl/portulan/pull/440) and `0034`'s slots take
the next free MINOR. Annotated rather than rewritten, so the record keeps what was accepted beside what
changed.)_

## Order of work after acceptance — one change per pull request

Row 12 carries the exit criterion; this is the order the changes land in.

1. `core/operating/context.md`, and the kernel's pointer to it.
2. The manifest key and the MINOR.
3. The measurement module and its recipe.
4. The `doctor` report, and the boot's closing figure.
5. Claude Code compile targets and the degradation report.
6. The own-footprint rail, with its two named demotions.
7. Persona frontmatter.
8. The librarian pass.
9. The handoff budget, as proposal `0037`.

Then adoption in the sealed repository, from a session rooted there: declare the budget, slim its
instruction file to an index, and measure before and after with the new recipe. That work is private
and gates nothing here.

**Provenance.** `form=sealed` `owner=Marius Cetanas` `date=2026-09-21` `shape=an adopting repository's
always-loaded instruction files measured 130k tokens per fresh context; cache writes were most of the
spend, and every subagent and checkpoint paid it again, because nothing measured, budgeted or demoted what
the host loads`. Public corroboration: `form=link`
`href=https://github.com/sleepy-panda-srl/portulan/blob/43038826f31e85ec02e36e5cdea20376ac1b58cf/docs/plan.md`,
this repository's plan, 452,764 bytes at that commit, which its own header says every session boots by
reading. Host facts come from the Claude Code documentation on costs, prompt caching and memory, checked
2026-09-21 by the kickoff. `omitClaudeMd` and `subagentPromptCacheTtl` were confirmed present in the
2.1.280 binary on 2026-09-23, as strings only and not as behaviour. The one-level-of-index rule is
motivated by arXiv 2607.17598, *Is Progressive Disclosure All You Need for Long-Context Agents?* (He,
Zhao, Wang and Chen, submitted 2026-07-20), whose abstract finds that *"a second, deeper routing level
never helps and sometimes breaks accuracy outright, so one level is enough"*; it measured long-document
question answering on InfiniteBench, across three agent harnesses and three model families, and not
instruction files, so it motivates the rule and does not establish it.

**Retire when.** A host measures and enforces a declared per-project budget on what it loads into every
context, so that Portulan's measurement would describe the host's mechanism instead of supplying one.

**Decision.** Marius Cetanas, by delegation — accepted, on 2026-09-23 — because an independent review
of the drafted head reproduced every public figure on the tree, found his five rulings quoted as he gave
them, and found the budget rule consistent with memory's, its no-checker limit included, with the
revisions listed at the end of this line correcting the text and changing no ruling. He delegated the ruling that day to the
project's coordinator, acting as supervisor in a session separate from the drafting one. He merged
[#429](https://github.com/sleepy-panda-srl/portulan/pull/429) while this line still read pending and
then asked for the revisions, which landed in its follow-up the same day: the cited study read and
stated under *Provenance*, *pointer* defined in rule 1, four accuracy fixes, and two wording fixes from
review.
