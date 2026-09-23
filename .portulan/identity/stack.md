# Identity — the stack, argued and measured

> The rest of the [Stack](../identity.md#stack) section of [`../identity.md`](../identity.md), which keeps
> the rows and the property they protect. Where the text below says *this file*, it means the identity
> document as a whole.

## Why the Tests row carries no count

_([The Tests row](../identity.md#stack)'s cell carried a figure from milestone 7 session 2 that was wrong by a factor of four by milestone 8. The dated qualifier kept it defensible and kept it useless — which is the failure a date does not fix. The pack-file counts below are restated at each cut because a release is a moment somebody re-measures; a test count has no such moment, so it gets no number.)_

## The same bytes, measured at each cut

Re-measured 2026-08-13 on `74240fa` — `npm pack` produces
**114** files and **all 114 are byte-identical to `git show HEAD:<path>`**, `package.json` included,
with no exemption. **Re-measured again 2026-08-18 at the first publish, and the roster narrowed:
`files` stopped being a directory sweep, so `npm pack` produces 73 — every one byte-identical, and
this time the comparison ran against THE REGISTRY rather than a local pack: the published tarball and
a fresh `npm pack` of the same tree hash to the same value.** _(**Re-measured at the 0.1.1 cut: 74.**
`cli/pack-identity.mjs` joined the payload after the 0.1.0 publish, so the roster grew by one — the
count is restated here rather than left standing, per this file's own convention, and the property is
unchanged: every one of the 74 is byte-identical to its staged blob, which is now railed on every
commit by the `pack-identity` recipe rather than measured by hand. The 73 above remains the correct
figure for the tree `0.1.0` was published from, which is `d6498f0` and is what `v0.1.0` tags.)_ _(**Re-measured at the 0.1.2 cut: 76.** `cli/inside.mjs` and
`cli/version-carriers.mjs` joined the payload after the `0.1.1` publish, so the roster grew by two.
Measured on a clean `git clone` fixture at each tag rather than in a working tree, because
re-measuring amid uncommitted edits reports the measurer's own edits as drift — the trap this file
already records below. The 74 above remains the correct figure for the tree `v0.1.1` tags, and the
property is unchanged at 76.)_ _(**Re-measured at the 0.1.3 cut: 88.** Twelve files joined the payload
since `0.1.2` published and none left it: milestone 8's eight instruments — `cli/drills.mjs`,
`cli/fuzz-shell.mjs`, `cli/goldens.mjs`, `cli/mutants.mjs`, `cli/release-eval.mjs`,
`cli/review-meter.mjs`, `cli/skill-goldens.mjs` and `cli/telemetry.mjs` — plus
`evals/README.md`, `evals/releases/README.md` and the record pair
`evals/releases/0.1.3.{json,md}`, which ships because a release carries its eval result in the payload
as well as in the tagged tree. The 76 above remains the correct figure for the tree `v0.1.2` tags, and
the property is unchanged at 88 — byte-identity is railed on every commit by `pack-identity` rather
than measured by hand here. **This figure is about the pull request's head tree**, measured on a clean
export of that tree — `git archive` of the index tree `d64ef46c`, unpacked and packed outside the
working copy — because re-measuring amid uncommitted edits reports the measurer's own edits as drift.
The 76 beside it was re-measured on a `git clone` fixture at `v0.1.2`, which is the spelling available
once a tag exists. The tree the tag names is the maintainer's to confirm at the cut, and that nothing
carries that obligation is [#384](https://github.com/sleepy-panda-srl/portulan/issues/384), which this
change does not close.)_ _(First measured 2026-07-31 at 72 files, all 72 identical — recorded then against `0f49868`, **an object that does not resolve in this repository today**, the branch having been squashed at merge; the date is the durable half and the sha is kept only as the original record. The property
strengthened as the package grew; only the count moved, and it is restated rather than left standing,
because a count is the half of this claim that goes stale silently. **Measure it on a clean checkout:**
re-measuring inside a working tree with uncommitted edits reports those edits as drift — it did here,
at milestone 7's close, and the two "differing" files were the measurer's own.)_ This is milestone 6's install-cache byte-identity discipline turned on the package the CLI
ships as, and it is what a build step would end: a compiled artifact cannot be compared to a tracked
file, so *no build* stops being a taste and becomes a property an adopter can verify. _(Until 2026-09-23 this
paragraph ended *"Measured by hand so far — the rail is routed, not built (see the handoff)."* The notes
above had already overtaken it: `pack-identity` is declared in [`../workspace.json`](../workspace.json), and
[`verify.yml`](../../.github/workflows/verify.yml) runs it on every pull request and every push to `main`.
Deleted rather than left beside them, because two carriers that contradict each other leave a reader to
guess which one is live.)_

## Where the line sits, and the one tool outside it

**Where the line sits now, precisely.** [`verify/docs.sh`](../verify/docs.sh) needs `git`, `bash`, and the
POSIX text utilities and nothing else, and among the recipes this workspace **declares** it is the only
one that stops there: **every other one needs `node` as well.** _(That sentence used to enumerate the
others by name, and the enumeration went stale without anyone noticing: it listed eight while the
manifest declared thirteen non-`docs` recipes, missing `rule-carriers`, `pack-version`, `pack-identity`,
`eval-bundle` and `version-carriers`. Deleted rather than extended on 2026-08-24 — a hand-copied roster
in prose is a second carrier of what [`workspace.json`](../workspace.json) already declares, and the
declaration is the authority. The same repair, on the same day, as the recipe **counts** in
[`repos/portulan.md`](../repos/portulan.md).)_ **Declared is no longer the whole runnable set**, and this
paragraph is not the floor: since milestone 7's composition amendment the set CI runs also carries
`tools/github:actions-pinned`, which needs neither `node` nor `git` and so stops *short* of `docs.sh`.
Each recipe declares its own needs — in [`workspace.json`](../workspace.json) for these, in its own pack's
manifest for a composed one — which is the authority on this line rather than the paragraph you are
reading, and is what keeps *could not run* distinguishable from *ran and failed*.

**Two recipes need a third thing beyond `bash` and `node`**, and the pair is worth naming because each
moved this line once: [`verify/workflow-filters.sh`](../verify/workflow-filters.sh) needs **`jq`**, argued
below, and [`verify/pack-identity.sh`](../verify/pack-identity.sh) needs **`npm`** — which the paragraph
below omitted from the day it was written until 2026-08-24, having been drafted when `jq` was the only
such case and never re-read when it stopped being.

**The first of them since milestone 2 to move this line.**
[`verify/workflow-filters.sh`](../verify/workflow-filters.sh) needs **`jq`**, because what it checks is
jq's own behaviour: two merge-gate workflows branch on what a jq program prints for null input, and no
other tool can answer for that. Same test as milestone 2 applied to a different binary — the property
that matters is not the letter *bash*, it is that nothing is installed before it runs, and `jq` is
present on the maintainer's machine and on `ubuntu-latest` alike — **measured on the first CI run of
that recipe, `jq-1.7` on the runner against `jq-1.7.1` locally**, rather than assumed. The cost is
stated rather than hidden: on a machine without it that recipe exits `2`, and every other one still runs.

**One tool is deliberately outside that line.** `claude plugin validate --strict` — the authority on the
Claude Code plugin contract — is run by hand at the supervised checkpoints and before a release, and is
**not** a verify recipe. Declaring it would make a recipe that exits `2` on every CI run, since CI here
installs nothing; and installing it would make this workflow a build. The cost of that choice is that the
platform's contract is checked at a checkpoint rather than on every pull request, which is stated in
[`verify/README.md`](../verify/README.md) rather than left to be discovered.

That line moved at milestone 2 rather than drifting: the milestone's criterion requires validating a
manifest against a schema, and there is no honest way to ask `bash` for that — a bash approximation of a
schema validator is a worse rail than no rail, because it would pass things it does not understand. What
survives is the property that actually mattered, and it is not the letter *bash*: a framework that needed
a toolchain to check itself would not survive its own "design for deletion" thesis. `node -e` with zero
dependencies and no install step is not a toolchain.
