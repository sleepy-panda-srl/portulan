# Handoff — four readers of one set, and the fixture that agreed with the bug

**Milestone 7, session 6 (session A of the three-session close).** Row 7's composition amendment of
2026-07-31, and **D6**.

## State

`main` was `069e3b4` at session-open and moved to `56b23aa` under the branch (a concurrent memory
consolidation); rebased before any file was written. Branch
`m7-a-composed-recipe-reaches-the-runnable-set`. Suite **1129 → 1158**. **Ten recipes green** — nine
declared, one composed.

_The baseline is 1129, not the 1128 measured at session-open: `6165218` landed one test inside the
rebase span, so 1128 describes a tree this work never sat on. Caught at the pre-commit checkpoint — a
figure about the wrong tree, in a handoff whose own subject is a harness that agreed with a bug._

## What landed

`cli/recipe-set.mjs`, the **one carrier** of the runnable set. Four readers each enumerated
`verify.recipes` independently — `.github/workflows/verify.yml`, `cli/doctor.mjs`, `cli/vendor.mjs`,
`cli/stop-gate.mjs` — and all four now call it. That is `0020`'s repair where the rule can be a
function, and CI is inside the set on purpose: the row says *CI runs the recipe set the manifest
yields*, so a workflow computing its own would be the required check reporting green over a recipe
nobody ran. The workflow's four inline validations moved into the carrier and are asserted there.

_Precise version, since the pre-commit checkpoint asked: `verify.yml`, `vendor` and `stop-gate` call
`recipeSet`; `doctor` imports `composedId` and keeps two direct reads of `verify.recipes` — the `doc`
resolution and the `verify.default` cross-check. Those validate the workspace's **declaration**, not the
runnable set, and are exempted by name from the undeclared-reader sweep. One carrier of the runnable
set; not zero direct reads of the manifest key._

`packs/tools/github` — D6's subject, on the maintainer's ruling of 2026-08-09 that the demonstration
take a real pack rather than a fixture or a reversal of the checkpoints pack's argued refusal. One
recipe: every `uses:` pinned to a full commit SHA. Composed into `.portulan/workspace.json` and running
in this workspace's own set as `tools/github:actions-pinned`.

## The three things worth carrying forward

1. **The fixture agreed with the bug.** `compile.mjs`'s `resolvePack` returns `manifest` as a **path**;
   the first cut of `resolverFor` treated it as parsed. Every composed pack contributed nothing, and the
   unit suite stayed green **because its fixture resolver returned a parsed object** — the same
   assumption the code made. Found by running the emitter against this repository, not against its own
   harness. `cli/recipe-set.live.test.mjs` is what stops it returning. Second measured instance of this
   class here; the first was #183's discovery draft seeing neither plugin its own feed ships.
2. **The contract is structural, not checked.** A composed id is `<category>/<name>:<id>`; a workspace id
   and `verify.default` are both `$defs/slug`, which excludes `/` and `:`. So *collision impossible* and
   *never the default* hold by construction. The shadow refusal is kept as belt and braces and is not a
   dead rail — a pack declaring one id twice with different `run`s is schema-legal, because
   `contributes.verify`'s `uniqueItems` compares whole objects, and that is what it is forced red on.
3. **`${PACK_ROOT}` was an undesigned mechanism the session-open checkpoint found.** A pack has no
   repository until adoption and its script ships inside the pack, so a composed `run` had no way to
   name its own files. Expanded by the carrier, before the newline check, so a pack root carrying one
   cannot pass a validation that ran too early.

## Forced red, and restored

Four ways on the new recipe — a tag instead of a SHA (1), a `uses:` with no ref (1), an absent
`.github/workflows/` (2), a present-but-empty one (2). Tree restored and verified clean each time.

The undeclared-reader sweep was forced red too, by planting an enumeration in `cli/gate.mjs`; it named
that file and went green on restore. **It also produced a false red on its first cut** — `stop-gate` and
`vendor` both reach the carrier, and both were flagged because their *comments* name the enumeration
they no longer do. Fixed by stripping comments before matching, not by editing the comments: a matcher
that cannot tell a mention from a use is the shape this repository paid for once already, when a persona
disclaiming *Prohibited* failed a check looking for the word.

## Left, and what is owed to the maintainer

`upgrade`, `feedback`, persona↔agent binding, legibility, clause (b) parity, `init`'s interview, the
index rail, **four of six** demonstrations. Clause (c) stays ungradeable until (b) is demonstrated.

- **The feed pin has not moved.** A delegated supervisor ruled 2026-08-09 that **D5 requires the real
  install** and cannot be graded demonstrated while it stands still. The act is his.
- **Row 7's Status cell numbers this session `s5` while the Session log calls it session 6.** The cell's
  `s0`–`s3` track the log exactly and then skip session 4, which delivered doctrine and no row item. The
  drift is named rather than silently renumbered; which convention wins is his.
- **#167's retrospective pass** was ruled owed and gates the close, not the sessions.
