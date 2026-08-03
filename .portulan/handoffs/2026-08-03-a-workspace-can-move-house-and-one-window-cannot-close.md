# Handoff — a workspace can move house, and one window cannot be closed

**Milestone 7, session 3.** `vendor` and the residence switch — task
[`0011`](../tasks/0011-vendor-carries-the-residence-switch.md), which was scoped by session 2 with its
blocking question already answered and cost this session nothing to re-derive. **M7 still open.**

## What landed

`cli/vendor.mjs`, the sixth of the eight subcommands to dispatch. One operation with a direction, which
is what the constitution's widened gloss describes:

- **`--host <id>`** — a self-contained `AGENTS.md` beside a copied `.portulan/`, for a host that cannot
  install the plugin. Core's kernel inlined verbatim; the workspace's slots and recipes named; the pack
  layer **named rather than composed**, because a pack resolves from a feed at a pinned version and
  vendoring resolves nothing. `core/engine.md` claimed the CLI composes all three layers — two thirds of
  that is now true and the third is named in the artifact rather than implied by "self-contained".
- **`--switch`** — feed-side ↔ in-repo, under
  [`0017`](../proposals/0017-one-repository-one-governing-workspace.md)'s ordering. The residence is
  **never inferred from a path**: `--residence` is required, which is `init`'s rule for `init`'s reason.

Plus a `compile` fix D4 found, and **fifteen carriers** that said `vendor` was unbuilt or that the switch
had no verb: **13 prose** — `identity.md`, `product.md`, `repos/portulan.md`, `CHANGELOG.md` (twice),
`README.md`, `cli/README.md`, the boot skill, `core/engine.md`, row 7's Status cell, `spec/README.md`,
`cli/portulan.mjs`, `cli/init.mjs` (its header, its refusal, and the README it emits into adopters'
trees), and this task's own status header — plus **2 suites**, `cli/portulan.test.mjs`'s hand-written
unbuilt list and `cli/init.test.mjs`'s comment on the unassigned verb.

_The count is split rather than given as one number, because it was claimed as thirteen and as fourteen
by two counters using different definitions — the session's own sweep counted the suites and not the task
header; the pre-commit checkpoint counted the task header and not the suites. Both were right about their
own set. A bare figure would have been checkable by neither. Proposal `0017` is a sixteenth file touched
and is **not** a carrier: its "does not build `vendor`'s switch" describes the proposal's own scope and is
still true, so it was appended to rather than corrected._

## The window is irreducible, and the session-open checkpoint is why that is written down

The plan submitted at session-open argued that governance lives in two manifests in two directories, no
POSIX primitive changes both, and therefore *some* intermediate state is unavoidable — two governors, or
zero. It asked the checkpoint to refute that rather than agree with it. **It tried three orderings and
each failed**, including the one worth recording because it looks like the answer: materialise the feed
workspace *without* the card naming the repository, retire the repo to a pointer, then add the card.
That avoids both named windows and creates a worse third — a pointer aimed at a workspace that does not
name it, which `doctor` cannot see (visibility is one-way) and which is **green at both ends while
functionally ungoverned**. A false green, which is the enemy this repository names most often.

So the ordering chooses the **loud** failure over the silent one, and that choice is not this session's:
`0017`'s switch contract already numbers materialise before pointer-or-nothing, and argues it. The
two-governor state is what `doctor --repo-root` refuses **by name**; zero governors is silent and, in the
proposal's words, looks identical to a repository that never adopted Portulan. What the tool owes on top
of that ordering, and delivers:

- **Every handled failure leaves exactly one governor.** Before the flip it rolls back; past the flip it
  goes **forward and reports**, because undoing a completed flip re-opens the window in the other
  direction. Rollback past the flip would be the bug, not the fix.
- **The window is one `rename` wide.** The copy is staged and validated somewhere that is a residence
  nowhere, so a destination that would not have been green never becomes a second governor at all.
- **A crash inside that rename leaves two**, and the recovery sentence is printed *before* it opens —
  after is exactly when the process may not be there to print anything.

Task `0011` said *"never zero and never two"*. That sentence is unachievable and is now amended in place,
citing `0017` as the binding carrier. **A task file is not ratified law**; the row is, and the row says
"under the contract the proposal sets".

## D4 found a parity breach, which is the whole argument for demonstrating rather than asserting

Row 7's fourth demonstration ran against the real `portulan-internal` checkout: one workspace drafted by
the real `init`, curated by hand, exercised in-repo, switched feed-side, exercised there, switched back
with `--leave nothing`, exercised again. `doctor`, `index` and the workspace's own verify recipe were
**identical at both ends**. `compile` exited **2 — could not run** — looking for a gate policy at
`<feed>/workspaces/.portulan/gates.json`, a directory that does not exist and never would.

`0017`: *"A feature that ever dispatches on residence is a parity breach and is refusable on this
sentence."* It was refused and fixed in the same change: `--workspace` now takes a repository root **or a
workspace directory**, told apart by `tree` — the one thing the proposal says is keyed to location, and
the same key `vendor` reads. A feed-side workspace's artifacts land beside it, because an installed
plugin's directory *is* the workspace root and they ship together. **Reading the compiler would never
have found this**; its `--workspace` documentation was a true sentence about a tool that worked in one of
two residences the ruling calls equal.

The feed checkout ends byte-identical: nothing committed, nothing pushed, nothing left. Verified.

## Decisions a later session would otherwise re-derive

- **The retirement deletes only what it can account for.** Files at the old residence this run did not
  move are left and named. The one exception is `compile`'s own output, which is deleted because it is
  generated and residence-keyed — carrying it across would put a settings file naming the old residence's
  paths where nothing reads and nothing sweeps it. Found by running D4, not by reading the copier.
- **`<repo>/.claude/settings.json` is outside the workspace directory and is NOT touched.** It is named
  in the output instead. A tool that starts deleting beyond the directory it was given is the tool that
  eventually deletes the wrong thing.
- **The scope bound is refused in both shapes.** A workspace naming more than one repository will not
  switch: moving the whole thing in-repo cannot answer which repository hosts it, and extracting one
  would edit another workspace's curated cards — the rule `init` and `new` both hold.
- **A workspace whose slots escape its own directory cannot be materialised.** Customer zero is exactly
  that shape (`"constitution": "../docs/vision.md"`), which is why this repository's own workspace is not
  D4's subject. Refused ahead of writing rather than produced and then graded.
- **`vendor` has an exit 1 where `init` and `new` do not.** It runs the real validator and reports its
  verdict; collapsing that into "could not run" would hide a bad workspace behind a missing flag.
- **The fault-injection seam is deliberate.** `options.faultAt` throws after a named write step. The
  property this tool exists to protect is what a failure *partway* leaves on disk, and an ordering
  nothing can interrupt is an ordering nobody has checked.

## Where it stands

Suite **973/973** (was 907; +58 in `cli/vendor.test.mjs`, +7 in `cli/compile.test.mjs`, +1 in `cli/new.test.mjs`, and one
deliberate red in `cli/portulan.test.mjs` whose hand-written list is *designed* to go red when a
subcommand ships — the mechanism working). Eight recipes green. `npm pack` **85 files**.

_The figure above read 964 and the eight-recipes claim was **false when written**: the handoff was
drafted before the index was regenerated and before the Session-log entry existed, so `index`, `tests`
and `docs` were all red at that moment, and 964 was 966 minus the two failures it was asserting were not
there. The pre-commit checkpoint measured it. Recorded rather than quietly corrected, because this is the
class the checkpoint exists for and the third session running to hit it: a record that describes the
world the session **meant** to leave rather than the one on disk._

## What M7 still owes

`upgrade` · verify-recipe composition · clause (b)'s parity · `feedback` · `init`'s interview loop · the
agent-legibility score · pack-cache discovery ([#123](https://github.com/sleepy-panda-works/portulan/issues/123)) ·
the persona↔agent binding check · and **five of the six** demonstrations. D4 is done; the count is pinned
in [`../../docs/milestones/m07.md`](../../docs/milestones/m07.md) and must not be re-derived from memory.
