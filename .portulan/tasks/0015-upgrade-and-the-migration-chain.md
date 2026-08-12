# Task 0015 — `upgrade`, and what a migration is

**Lane:** full · **Opened:** 2026-08-12, milestone 7 session 9, at the session-open checkpoint
**Verify recipe:** `tests` · **Status:** DONE — merged as [#231](https://github.com/sleepy-panda-works/portulan/pull/231) (`1d5ac96`), 2026-08-12

> The eighth of the eight subcommands [`../../docs/vision.md`](../../docs/vision.md) names.
> **At the moment this task opened**, seven dispatched and `upgrade` was listed in
> [`../../cli/portulan.mjs`](../../cli/portulan.mjs) with `module: null`, exiting **2 — could not
> run**; all eight dispatch as of `ddcf5b3`. **M7 does not close this session** — demonstrations D1,
> D2 and D5 are untouched, and the row stays open by the maintainer's ruling of 2026-08-11.

## The criterion, quoted rather than paraphrased

Row 7 of [`../../docs/plan.md`](../../docs/plan.md), in two places. The base clause:

> `npx @sleepy-panda-works/portulan` ships init/doctor/compile/vendor/index/**upgrade** …

and the 2026-07-30 residence amendment, ratified 2026-07-31:

> **`upgrade` migrates a workspace in either residence.**

## The maintainer's three rulings, taken at session open before planning

Asked because `upgrade` plus its migration mechanics is a session on its own and the other open items
are a different kind of work:

1. **The slice** — `upgrade` plus its mechanics, both residences. D1, D2 and D5 untouched.
2. **What a step may carry** — *version steps **and** portable repairs*. A step is either a
   spec-version migration or a repair a rewriter owes a workspace it touches. The
   `portulan:bundle-fallback` absolute path is the first repair.
3. **No MAJOR bump.** 2.8 stands. Minting a schema change to give the machinery a live subject would
   be inventing a contract change to justify a tool.

Ruling 2 is what makes this tool useful on a real workspace today, and the reason is measured rather
than argued: the workspace train's only MAJOR migration is `1.0 → 2.0`, and **no manifest anywhere in
the tree declares 1.0**. Version steps alone would have shipped machinery demonstrable on a fixture.

## What a migration is — the contract

`spec/README.md` says today: *"There is still no `migrations/` directory … **One arrives when a
migration needs code.**"* A repair re-derives a path, so the directory arrives on the spec's own
stated condition rather than because a tool wanted a home.

A **step** is a zero-dependency ESM module exporting one object: `id` (stable, sortable — the chain's
order), `kind` (`version` | `repair`), `from`/`to` for version steps, `title`, `why`, `owed(ws)` and
`plan(ws, ctx)`.

Three properties carry the design, and each replaces machinery this session would otherwise build:

- **Owedness is derived from the workspace's state, never from a stamp.** No applied-ledger, nothing
  to keep in sync, and nothing that can lie about what ran.
- **Every step is idempotent**, so a run interrupted partway is recovered by re-running rather than by
  a transaction.
- **`owed` is three-valued** — `true` / `false` / **`null` = could not tell**. A step that cannot
  answer must not answer *not owed*: the workspace's own *an empty set is two questions*, and *only
  `ENOENT` means absent*. `null` maps to exit 2, never to a green.

### The two steps

**`0001-repository-declares-its-tree`** — kind `version`, 1.0 → 2.0. Owed when the declared MAJOR is
1. `demo`/`portfolio` take the version bump alone; `repository` must also supply `tree`, and the step
**will not guess** — `"../"` is emitted only where `<workspaceDir>/..` is verifiably the repository
root, otherwise it refuses and names `--tree`. The root test accepts `.git` as **either a directory or
a file**, because a worktree's `.git` is a file and this repository is currently checked out as one.

**`0002-bundle-fallback-path`** — kind `repair`. `init` bakes the bundle it ran from into
`verify/index.sh` as an absolute path on two lines marked `# portulan:bundle-fallback`; `vendor
--switch` copies it byte for byte, and a stale path exits **2** rather than failing loudly. Owed when
a marked line's embedded path is not this bundle's. A marked line whose shape is not the one `init`
writes is a **refusal**, never a best-effort rewrite.

## Supervisor adjustments — session-open, fresh Fable 5 context

**APPROVE-WITH-ADJUSTMENTS (10).** The spine was not reworked: the step contract, derived owedness,
idempotency, the two steps, the `skills-set`-shaped surface, the two-push record shape and the
sequence all stand. Recorded as numbered items rather than folded invisibly into the plan they graded.

**Design-changing**

1. **The pre-state branch was direction-blind and minted a false green for a workspace from the
   future.** `doctor` refuses on `major !== here.major` — behind *and* ahead — and refuses MINOR-ahead
   separately. Branching on *the fact of the throw* sent a 2.9 or 3.0 workspace into the plan phase,
   where step `0001` answers *not owed* and the run exits **0, "nothing owed"** — a green rendered by
   a tool that could not read the workspace. **Folded:** `upgrade` branches on the declared version
   itself, proceeding only when the declared MAJOR is **below** the schema's; MAJOR-ahead and
   MINOR-ahead are exit 2, *this bundle is older than the workspace — upgrade the CLI*. 2.9 and 3.0
   pre-state fixtures ship.
2. **Writing into the host's plugin cache was a decision taken silently**, and it diverges a directory
   whose identity is a version claim — against the install-cache byte-identity this repository's own
   evidence practice leans on. **Folded:** routed to the maintainer (below); pending his answer,
   `upgrade` **refuses to write into a resolved install**, resolves and reports.
3. **The rollback's own failure arm was unstated, and one sentence overclaimed causation.**
   **Folded:** a restore that itself fails names what was and was not restored and exits 2; and for a
   MAJOR-behind run the pre-state was ungradeable by construction, so a red post-state reports its
   findings **without asserting the migration produced them**.

**Sweep completeness — carriers this change makes untrue that the plan had not named**

4. `CHANGELOG.md` — *"Of the eight, **seven dispatch** …"* and *"The unbuilt ones are listed and exit
   2, naming the milestone they arrive at"*, which stops describing anything once none is unbuilt.
5. `docs/plan.md`'s **topology block** — *"(today: seven of the eight dispatch and `upgrade` exits
   2 …)"*. It describes the code, so it rides the **code** push, not the records push.
6. `cli/portulan.mjs`'s own prose beyond the wiring: the header section *"## One of the eight is not
   built"*, the entry's *"One thing waiting for whoever builds this…"* comment, and the `summary` —
   *"migrate a workspace to a newer Workspace Definition"* — which becomes the narrower carrier once
   the chain also carries version-independent repairs.
7. `cli/README.md`'s **counts**, pinned in this change rather than left for pre-commit: the
   *"nine files … have no row"* figure moves unless rows are added for all three new files.

**Wording**

8. The demonstrations header contradicted its own item 3: `init` writes `SPEC = "2.7"` and cannot
   draft a 1.0 workspace. Demos 1–2 are against real-`init` drafts; demo 3 is **fixture-only**.
9. The Status cell is **447** by check 6c's own method (`length($6)` of the pipe-split row), not the
   448 `wc -c` reports with a trailing newline. 447 − 14 = 433; an ~36-byte s9 clause lands ~469.
   Conclusion unchanged — but a figure carries its method here.
10. Three limits to write where the reader is: the chain governs the **workspace** train only
    (`portulan.pack` at 1.0 is reached by no step); `owed: null` maps to exit 2, never green; and the
    repair rewrites a marked path **that still resolves** — a rail pointing at a second working
    checkout is re-pointed at the bundle that ran `upgrade`, deterministic and idempotent, chosen out
    loud rather than discovered. Plus the pre-state gate's asymmetry: it can only grade same-MAJOR
    runs, and a MAJOR-behind pre-state is graded **post-state only**.

### The three questions routed to the supervisor

- **`vendor --switch` and the repair** — plan's (a) upheld as **`0020`-compliant**: the knowingly-left
  arm requires the sibling be *recorded*, and a truthed comment naming `upgrade` is that record. Two
  strengthenings folded: **file (b) as an owned issue**, since an unowned deferral is the
  promised-but-unowned class `m07.md` documents three times; and put the question in the PR body,
  since (b) changes `vendor`'s shipped contract. Noted: (b)'s payoff is smaller than it looks — a
  same-machine switch leaves the path still resolving, and it breaks when the tree travels, which is
  where `upgrade` runs and `vendor` does not.
- **The pre-state gate** — right, not too strict, and nearly forced by the rollback design: without
  it a red workspace with an owed repair would apply, verify red for the pre-existing reason, roll
  back, and exit 1 blaming the migration. The refusal names `doctor` as the findings source.
- **Rollback-on-red** — correct and hides nothing, *because* the pre-state gate exists. Adjustment 3
  covers the two places the story leaked.

## Supervisor adjustments — pre-commit, fresh Fable 5 context

**APPROVE-WITH-ADJUSTMENTS (7).** The spine was not reworked. The checkpoint ran **nine mutations of
its own** rather than trusting the session's harness (which lived in a scratchpad and is not in the
diff); eight went red on the assertion that guards them, and the ninth is adjustment 3. It also
judged the rewritten tripwire in `cli/portulan.test.mjs` **not disarmed** — it set the refusal to
`return 0` and the replacement went red.

**Design-changing**

1. **`String.prototype.replace` read the new bundle path as a replacement pattern.**
   `0002`'s splice used a string replacement, so `$&`, `` $` ``, `$'` and `$$` in the path are
   patterns: a checkout under such a directory wrote a rail with the **old path spliced back in** and
   the quoting broken — which `doctor` grades **green**, because it never runs shell. **Folded:** a
   function replacer, plus a case over all four sequences. Found by building the path, not reading
   the line.
2. **`doctor`'s new direction-split remedy was a rail nobody could see fail.** The checkpoint
   **inverted the two arms** — sending a 1.0 workspace to upgrade the CLI and a 3.0 workspace to
   `portulan upgrade` — and all 259 tests across the `doctor` and `upgrade` suites stayed green.
   **Folded:** both arms pinned in `doctor.test.mjs`, each asserting the remedy it names **and** the
   one it must not.

**Wording**

3. **An unfiled "Filed".** `cli/vendor.mjs` claimed the `--switch` deferral had been filed as an issue
   and no such issue existed — the promised-but-unowned class wearing the word. **Folded:** filed as
   [#230](https://github.com/sleepy-panda-works/portulan/issues/230) and cited by URL.
4. **The MINOR-ahead refusal is the MAJOR arm's sibling, ten lines below.** It still stopped at
   *"Refusing"* while the arm this change repaired named its remedy — `0020` committed inside the
   change that cites it. **Folded:** it names the same remedy, and a test pins it.
5. **Advice that contradicted the refusal beside it.** For a resolved install the owed-steps line
   still said *"run with --write to apply them"* — the exact invocation the tool then refuses with
   exit 2. **Folded:** the advice is conditioned on the target's residence.
6. **Both exit-code enumerations under-counted their own width** — the header and `cli/README.md`
   omitted the exit-1 arm for a pointer that is `not-installed`/`ambiguous`. **Folded** in both.
7. **No `Unreleased` entry.** The falsified counts were corrected but nothing said what a release
   reader *gets*. **Folded:** an `### Added` entry covering the subcommand, the `spec/migrations/`
   contract, the three properties, what it refuses, and what stays undemonstrated.

**Noted without a number, folded anyway** (the maintainer's standing instruction is that optional
feedback is addressed too): a symlink refusal surfaced through `upgrade` spoke in `vendor`'s voice
(*"refusing to **copy** through one"*) — true sentence, wrong verb — now re-worded with the
attribution left clean; and `shown` could print `../../../../…` chains for a target outside the tree,
so it now takes the shorter of the relative and absolute spellings.

## Supervisor adjustments — pre-commit over the CORRECTION, fresh Fable 5 context

**APPROVE-WITH-ADJUSTMENTS (3)**, and this one was graded **before** the commit, which is what
adjustment 1 of the previous pass asked for and what makes its Done-when box true. Every figure was
re-derived rather than believed — including the 1415 baseline, re-run in a scratch worktree at
`5a7b5ca`, and the finding counts read from **64** reviews, of which page one alone carries half.

1. **A fold claimed and not made — in the correction whose subject is claims outrunning their tree.**
   This file said round 7's finding was *"Carried now, with round 8"*; the handoff carried rounds 8,
   11 and 12 and **not** round 7. Folded properly: the handoff now carries it, and the reason it is
   the sharpest of the four is that `resolveTarget()` did not half-copy a rule from elsewhere — it
   failed to apply one `readWorkspace()` argues for **twelve lines above it in the same file**.
2. **The world falsified this file's Status line mid-checkpoint.** It read *"merged state pending the
   maintainer's decision"*; he decided, and #231 merged as `1d5ac96` at 15:39:19Z. Committing that
   sentence would have repeated the class adjustments 4 and 5 repair — a maintainer act described as
   pending after it landed. Truthed to `0014`'s shape.
3. **Unbalanced emphasis** in the handoff's round-8 bullet, its sibling correctly closed.

**What it recorded that no adjustment could fix.** `main` currently asserts the defects this
correction repairs — the merged handoff still says *"Six Copilot rounds… suite 1485"* — because the
maintainer chose to merge and fix as a follow-up. The merge was a rebase, so this correction travels
by its own pull request, and the commit SHAs cited above (`df84039`, `96fdbb6`, `ddcf5b3`, `b5be6a7`)
resolve through #231's record rather than through `main`'s history.

**And what stays undemonstrated:** nothing here shows the ordering failure cannot recur.
`self-certify-a-checkpoint` **compiles to nothing on every backend**, exactly as the pack says out
loud. The only rail is the practice — and the record of the one time it was skipped.

## Both open questions — SETTLED by a fresh-context supervisor, 2026-08-12

Routed to a supervisor on the maintainer's instruction, under a standing constraint to grade against
**Portulan's vision and direction** rather than general software taste, and to test the implementer's
framing rather than accept it. **Both ruled (a) — keep what is shipped. Neither needed a code change.**

**Q1 — `upgrade --write` at a pointer-resolved install stays refused.**

The framing survived with **one citation corrected**, and the correction is recorded rather than
quietly fixed because a citation wrong about its own address is a defect class this repository names:
[`../identity.md`](../identity.md)'s byte-identity paragraph is about the **npm package the CLI ships
as**, not about workspace installs. The load-bearing carriers are `0020`'s version-bump paragraph —
*"one identifier with two contents"* — and the m06/m07 records that read cache-vs-payload identity as
provenance.

What decided it was the constitution rather than the implementer's argument: **thesis 6, *storage
follows ownership***. The plugin cache is a layer the host's **installer** owns, and a `marketplace
update` rebuilds it from the pinned payload — so a migration written there is the team's durable value
persisted in a layer that silently discards it. A "loud report" cannot survive that revert: the report
is prose, the revert is machinery.

It also refused the implementer's own fallback, an `--allow-installed` flag, on a ruling recorded in
[`0017`](../proposals/0017-one-repository-one-governing-workspace.md) and forgotten here: ***"a flag
that overwrites files is the flag that eventually overwrites the wrong ones."***

And it separated the "against" argument into two people: a **non-owner** must not unilaterally fork a
shared policy layer — `0017`'s own nightmare, distributed across a team — and an **owner** without a
checkout has one by construction, since the feed is a git repository.

**Q2 — `vendor --switch` does not call the repair, and does not report it either.**

On a sharper argument than the one offered. [`../../spec/migrations/README.md`](../../spec/migrations/README.md)
defines a repair as fixing *"a value that was true where it was written and is not true where the
workspace now is"* — and after a same-machine switch, **the baked path is still true**. `vendor` cannot
observe the event that breaks it, and the correct post-travel value is derivable only by the bundle
running on the destination machine, which is what `upgrade` is. So `vendor` is **not a sibling
enforcement site** under `0020`'s membership test: copying and repairing are not the same operation.

It rated the session-open supervisor **too mild** rather than too generous — `0020` part 1 does not
merely permit leaving it, it prescribes it.

It also settled *write-the-limit* against *prefer-the-rail* without splitting the difference: **the
rail already exists** — the drafted recipe's own fail-closed exit 2 with a self-describing remedy, plus
`0002`'s state-derived `owed()`. Option (c) would add a *reminder*, attached to the wrong event, for an
operator who can do nothing durable about it.

**Ruled and closed.** The maintainer disposed of
[#230](https://github.com/sleepy-panda-works/portulan/issues/230) on 2026-08-12, taking the option the
supervisor recommended: *"`vendor` copies; `upgrade` repairs; `vendor`'s comment names the remedy.
Current state. One tool, one job."* `cli/vendor.mjs`'s comment carries the ruling and its argument.

## Supervisor adjustments — pre-commit over the RECORDS, fresh Fable 5 context

**REQUEST-CHANGES (8).** The verdict is recorded here in full because its first finding is about this
session's own conduct, and this repository records a defect in the class it belongs to.

**1. The records were committed before their verdict, and the commit says otherwise.** `df84039`
landed the records bundled with round 7's code, under a message asserting they were *"graded by its
own pre-commit pass."* That pass was still running and returned **REQUEST-CHANGES**. It is
`self-certify-a-checkpoint` — the fragment this workspace marks **prohibited** and which the
checkpoints pack states plainly it *cannot mechanically enforce*, since no tool grant can observe
whether a context has already seen the work. The supervisor caught it by noticing the commit appear
**while it was grading**. Nothing was merged, so the recovery is a correction commit **graded before
it is committed**, which is what this section's own adjustments are folded into.

**2. The loop was not empty, and the records carried closure-shaped figures anyway.** Two findings
from round 8 were outstanding when the verdict was written. **Since satisfied** — the supervisor
graded `df84039` and never saw `96fdbb6`, which fixed and answered both.

**3. The figures were false of the tree carrying them.** *"Six rounds, seventeen findings"* and
*"suite 1485"* were true of `b5be6a7` when drafted and were committed onto a tree titled **Round 7**
measuring **1489**. A total quoted from an earlier run is a number about a tree that no longer
exists — this repository's most-repaired defect, committed in the record of a session about it.

**4. #230 described as awaiting disposal** after the maintainer had ruled and closed it. **Since
satisfied** in `96fdbb6`.

**5. The preamble spoke in the present tense** about a state three commits old — *"Seven dispatch;
`upgrade` … exits 2"*. Dated to the moment the task opened.

**6. The records-pass Done-when box was ticked** while that pass had returned nothing. Un-ticked, and
it becomes true only when the correction is graded ahead of its commit.

**7. The sibling site.** [`0014`](0014-the-registrable-set.md) still read `IN PROGRESS` for work
merged as #227 — the same class this diff repairs at `0015`, one file away. Flipped.

**8. The handoff ended a round early.** Round 7's finding — read and parse conflated in
`resolveTarget()`, with `readWorkspace()` twelve lines above stating the distinction as a contract —
is the *previous* session's headline lesson recurring in this session's new code, inside a handoff
titled about tests that do not bind. Carried now, with round 8.

**And a lane violation running the other way from the one being watched for:** round 7's **code** was
pushed inside the records commit, collapsing the two-push shape this very task file records as the
plan. The separation is restored by keeping this correction records-only.

## Open with the maintainer — asked, unanswered at time of writing (superseded above)

**`upgrade --write` on a pointer-resolved workspace: where does the write land?** Adjustment 2. Two
readings fit the criterion: migrate the resolved install in place and say loudly that it no longer
matches the version the host's record claims for it; or refuse the cache and direct migration to the
workspace's own directory, which is the only act that re-pins the feed.

**Proceeding on the second**, stated as an assumption rather than a ruling: it writes less into
somebody else's tree, it is the fail-closed direction, and a cache install is a *materialisation*
rather than one of `0017`'s two residences — both of which stay directly migratable. Built as a single
small branch so the alternative is cheap. **In the PR body for his decision.**

## Done when

- [x] `spec/migrations/` exists with its README and the two steps, and `spec/README.md`'s
      "there is still no `migrations/` directory" paragraph is corrected rather than left standing.
- [x] `cli/upgrade.mjs` dispatches from `cli/portulan.mjs`; `upgrade` no longer exits 2 for being
      unbuilt.
- [x] **Either residence**: an in-repo workspace migrates, and a pointer resolves through
      `cli/discover.mjs` and reports with the resolver's own sentence.
- [x] The repair is demonstrated **end to end on a workspace the real `init` drafts** — the rail exits
      2 before and renders a verdict after.
- [x] The version step migrates a 1.0 fixture to 2.0, graded **green by the real `doctor`**, which
      refuses it outright beforehand.
- [x] `upgrade --check` reports **nothing owed** for `.portulan` and for `examples/` — the 2.4
      compatibility evidence is not eaten.
- [x] Every new test forced red once before it is trusted.
- [x] The prose sweep of items 4–7 run as a grep per claim, not from memory.
- [x] Eleven recipes green; suite **1505 pass / 0 fail** against the 1415 baseline at `5a7b5ca`.
- [x] Seam scan clean over the diff, the branch name and the commit message, **term by term**.
- [x] Pre-commit checkpoint in a fresh context. **The records push failed this the first time**: it
      was committed in `df84039` while its pass was still running, under a message claiming that
      pass's verdict, and the pass then returned **REQUEST-CHANGES**. The correction carrying its
      eight adjustments was graded by a fresh context *before* it was committed, which is what makes
      this box true — and the failure is recorded above rather than repaired away.
