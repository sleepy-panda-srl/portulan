# Handoff — the install said `Agents (0)`, and everything else follows from that

**State.** Milestone 3, session 1 of 1–2. The fresh-machine install is demonstrated, the first
`CHANGELOG.md` is written, and a defect the install found — the three personas never registering on any
install — is fixed, along with the two fail-opens the fix itself opened. **`v0.1.0` is not tagged yet**:
the maintainer's ruling is *fix first, then tag the merge*, so the tag names a merge commit that does not
exist until this pull request lands, and cutting it is the next Gated action after that. **Milestone 3
does not close here.** One clause is left: the boot, which needs a live session, and the account's credit
balance blocks every one.

## The finding, and why nothing before it could have found it

`claude plugin details portulan`, against a plugin installed from the remote:

```
Component inventory
  Skills (3)  clarify, codify, portulan
  Agents (0)
```

Three agent files shipped in the cache. `plugin-lint` counted three. `claude plugin validate --strict`
exited 0. Task [`0003`](../tasks/0003-plugin-and-public-marketplace.md) had ticked the persona-binding
criterion in session 0. Every one of those was true and the personas were still inert.

**The defect is not in any file**, which is why the session-0 checkpoint missed it while doing exactly
the right thing. That checkpoint measured the first-party validator's coverage by forcing reds — the
discipline [`../memory/a-checkers-coverage-is-measured-not-named.md`](../memory/a-checkers-coverage-is-measured-not-named.md)
exists to enforce — and every red it forced was inside a file. This one lives in the relationship
between a manifest and a loader, and only an install shows it. New rule:
[`../memory/a-manifest-field-can-validate-and-load-nothing.md`](../memory/a-manifest-field-can-validate-and-load-nothing.md).

**The positive control is the part to copy, not the finding.** `Agents (0)` alone is equally consistent
with *the personas did not load* and with *this command does not count agents*. A second, throwaway
plugin reporting `Agents (1)` from the same command in the same minute is what made it a measurement.
A negative reading with no positive control is not evidence — and this session nearly acted on one.

Seven forms, measured against Claude Code v2.1.215:

| `agents` declaration | plugin loads | registered |
|---|---|---|
| **absent**, files at `./agents/` | yes | **1 — the control** |
| absent, files at `./plugin/agents/` | yes | 0 |
| `["./agents/probe.md"]` explicit file, default path | yes | 0 |
| `["./plugin/agents/implementer.md", …]` ← what this repository shipped | yes | **0** |
| `["./agents/"]` · `["./plugin/agents/"]` · `["./plugin/agents"]` | **fails to load at all** | — |

Row 3 is the one that matters: the same files, in the place the host reads, register nothing once a key
names them. **The key does not fail to help — it suppresses the scan that works.** No form the manifest
can express is both accepted and live.

## Decisions + why

- **The fix is `git mv plugin/agents/*.md agents/`, and the `agents` key is gone.** The maintainer's
  ruling settled the doctrine first — a persona is role doctrine in `core/personas/`, an agent is that
  persona registered on a host, the relationship is source → binding like gate map → compiled hooks, and
  **separation is load-bearing** (LLM-agnostic by construction, design for deletion, altitude) while
  **duplication is not permitted** — and then settled the mechanics: the bindings go to the platform's
  default agents directory, which for a plugin rooted at this repository is the repository root.

- **Re-rooting the plugin at `plugin/` is the alternative to record as refused**, because it is the one
  that looks right. It would make `plugin/agents/` the default location and keep every host-specific
  file under `plugin/` — but **the installed payload is the plugin root's subtree**, so that plugin
  would ship skills and agents and *not* `core/`. The install exists to deliver the engine; "the plugin
  IS the core". The repo-rooted plugin was session 0's load-bearing decision and the bindings' location
  simply follows from it.

- **Root `agents/` is not host vocabulary leaking into the engine**, and the topology annotation says so
  rather than leaving it to be re-litigated. The quarantine boundary that matters is the engine's:
  `core/personas/` holds role, charter, capability classes and autonomy reach with no host's tool names
  in it. `agents/` is the plugin's component surface, and this repository *is* the plugin, so a default
  component directory sitting where the platform fixes it is the contract showing through. A leak would
  be `core/` learning the word `Grep`.

- **A symlink `agents/ → plugin/agents/` was built first, and worked.** It is recorded because a
  decision record that never mentions the alternative is not a decision record. It passed
  `--plugin-dir` (`Agents (3)`) and a local-path marketplace install, which dereferenced it into the
  cache. It was rejected on the maintainer's direction for the reason that survives scrutiny: the path
  that actually matters — a clone from the remote, then an install — was never tested, so it stacked an
  untested behaviour on top of a platform quirk, and it carried the checkout-without-symlink-support
  fragility besides. Moving the files removes that whole question.

- **Two fail-opens opened by the fix, both closed in it.** This is the part worth reading twice.
  1. The recipe printed `0 agent(s)` and **GREEN** the moment nothing declared them. A validator that
     only checks declarations stops seeing undeclared things, and the milestone's own criterion asks
     that CI check "every declared skill and agent". `plugin-lint` now finds agents by convention,
     **fails** on a present `agents` key, and asserts this repository's count of three against the tree.
  2. The `map` check could not see the new top-level entry **at all** — `awk -F/ 'NF > 1'` yields only
     directories that contain tracked files, and git tracks a symlink as a single path with no `/`. It
     had silently stopped covering the tree the day the tree gained one. Extended, red-first.

- **One hole is left open on purpose and named rather than hidden.** Deleting `agents/` outright is a
  note and exit 0, because a plugin that ships no agents is legitimate. What binds it is a persona with
  no binding, which is not — [`../tasks/0005-lint-the-persona-agent-binding.md`](../tasks/0005-lint-the-persona-agent-binding.md),
  handed to the next session by the maintainer along with
  [`0006`](../tasks/0006-three-things-called-agent.md), the glossary entry separating *persona*, *agent*
  and *agent identity*.

## The measurements that corrected the record

**The payload decision rested on a false sentence.** `plugin/README.md` said a local-directory install
skips symlinks resolving outside the plugin directory. Measured on a committed git fixture with exactly
that shape, **both readings follow the link**: a marketplace install from a local path *dereferences* it
into the cache (real file, different inode, no symlink survives), and `--plugin-dir` *loads* it in place
(`Skills (2)  direct, linked`). A third path — a clone from a remote carrying such a link — is left
**unmeasured**, because testing it means publishing a fixture repository, and one measurement standing
in for two claims is how the false sentence got written.

**The decision stands on a reason the record never gave:** this repository's own lint refuses a declared
path that is a link out of the plugin root (`FAIL paths … which is a link out of the plugin root`, exit
1), a check hardened in session 0 after a review found lexical containment satisfiable by precisely that
shape. Taking the alternative now means *relaxing* it, which the gate map singles out as the change to
scrutinise hardest.

**Session 0's open question 1 was wrong.** GitHub shorthand did not need
`CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`; the CLI probed SSH, said *"SSH not configured, cloning via
HTTPS"*, and fell back unaided. Recorded because it was written as a warning for this session and would
otherwise be repeated as one.

**The bundle ships three workspace manifests, not two.** Two valid, plus the deliberately drifted
fixture under `cli/fixtures/` that `doctor` exits 1 on — which is the *worse* one to boot on. Counted
rather than remembered; `plugin/README.md` and the boot skill both said two.

## The install, and the limits of the simulation

```
SSH not configured, cloning via HTTPS: https://github.com/sleepy-panda-works/portulan.git
✔ Successfully added marketplace: portulan
✔ Successfully installed plugin: portulan@portulan (scope: user)
```

Clone HEAD `9e216888d3`, byte-identical to `origin/main` — pinned rather than asserted, on the
session-open supervisor's instruction, which also pins the demonstration to the commit under the tag.
Visibility at the moment of the install: **PRIVATE**. Payload confirmed as `docs/ examples/ cli/ spec/
.portulan/ core/ packs/ plugin/ evals/`.

**What was isolated:** the config directory (verified empty — "No marketplaces configured" against a
real config listing one), the marketplace, the plugin cache, and the project directory. The real
environment was checked afterwards and is untouched.

**What was not, and this is the honest limit:** it is the same machine, so git credentials are shared.
What is demonstrated is *no local folder*, not *no local credentials* — and a private repository's
install path is authenticated by construction, which is why the criterion asks for the visibility rather
than pretending the distinction away.

## What the session-open checkpoint found

**APPROVE-WITH-ADJUSTMENTS, eight required, six changing the work.** Two earned their keep outright:

- **The changelog.** Protocol → Versioning has required *"changelog per release"* since this file was
  locked; none existed, and this session cuts the first release. The implementer's plan had not
  mentioned it — a clause of the versioning protocol quietly reinterpreted as "SemVer only".
- **List what the host actually registered.** That single instruction is what found `Agents (0)`. The
  implementer's plan would have booted the plugin and never counted its components.

Also: an ordering that would have merged a Session log asserting a tag that did not yet exist — the
shape the preceding commit is literally named for; pinning the clone's provenance rather than asserting
it; inspecting the payload *before* the boot test whose meaning depends on it; and requiring the symlink
measurement to exercise the install path each claim is about, which is what produced the "unmeasured
third path" above instead of one result standing for two.

## What the pre-commit checkpoints found — both of them

Recorded here rather than left in a transcript, because the commit this branch sits on is named *the
session record did not contain the reviews that changed the session*, and this session had two.

**First pre-commit — APPROVE-WITH-ADJUSTMENTS, four required, on the symlink version.** Every one was a
claim false against the thing beside it. `v0.1.0` was asserted as cut in four places when no tag existed
— the same defect class as the commit above, one session later. `Agents (3)` was attributed to an
install in three files when it had been read through `--plugin-dir`; the record was applying "one
measurement must not stand for two claims" to the road not taken and skipping it for the road taken.
The handoff claimed it had added a fail-open to task `0004` and had not — repaired by making the claim
true rather than by softening it, which is the stronger of the two fixes. And the suite arithmetic was
wrong: 141 → 149 was carried from a stale figure in session 0's handoff; measured against `origin/main`
it is **146 → 149**.

**Second pre-commit — APPROVE-WITH-ADJUSTMENTS, seven required, one of them work**, re-run because the
maintainer changed the fix and delegated a `docs/plan.md` topology amendment, which his standing rule
sends to a fresh context. The work item is the one worth carrying: **the rejected symlink arrangement
passed every check in this repository.** The supervisor rebuilt it — `plugin-lint` GREEN with three
agents counted, `map` GREEN, suite green — one session after "a shape that passed both checkers and was
inert at runtime" became this repository's newest rule. It is now refused by a repository-anchored test
rather than by a rule in the lint, because the shape is one the *platform* accepts and a generic
refusal would encode this repository's risk appetite into a tool other plugins run. The same finding
named a sibling gap: `readdirSync` reports a symlink as neither file nor directory, so the obvious
`isFile()` filter **dropped** a symlinked agent silently — present in the tree, absent from the count,
which is this session's defect in miniature. Symlinked entries are now taken in and judged.

The rest were prose, and the pattern is the same one twice: five sentences still describing the tree as
it was for about an hour, and `product.md` asserting a release that does not exist.

## Open questions

1. **The boot is the only clause left, and it is blocked by billing, not by packaging.** Every live run
   returns `Credit balance is too low`, including a control `claude -p` with no plugin loaded — which is
   how it was classified rather than mistaken for a packaging failure, the misreading session 0 flagged
   in advance. Two projects were built for it — one bare (must report the absence of a workspace) and
   one carrying its own workspace with a marker term, so the transcript *proves* which one was read
   rather than inferring it from silence — and both are **gone**, along with the scratch directory that
   held them. Rebuilding them is step 2 of the checklist below, including the reason the old marker term
   must not be reused. The discriminator was the session-open supervisor's requirement, and the reason
   it needs replacing was the pre-commit supervisor's.
2. **`claude plugin tag` would have created `portulan--v0.1.0`, not `v0.1.0`.** The platform namespaces
   a plugin release inside a marketplace that may ship several, which this one will once `packs/` ship.
   Measured before recommending: the marketplace clone is **shallow and single-ref** (`+refs/heads/main`,
   zero tags), so that form is **decorative for installation here** and the maintainer deferred it. It
   becomes the right shape the day a pack is versioned independently of the engine.
3. **Nothing still tests the five verify recipes** — [`0004`](../tasks/0004-a-harness-for-the-verify-recipes.md),
   carried for a third session. This session added the **eighth** fail-open to its list, in the `map`
   check — and it is the fourth of that list whose defect is a *short input set* rather than a wrong
   answer, which is the pattern the harness should be built to catch first.
4. **`plugin-lint` now encodes a platform behaviour as a hard failure** (a present `agents` key). That is
   a repo-owned invariant with a dated measurement beside it, not a claim to own the platform's contract
   — but it is the first check here that will go stale if the platform changes, and it should be re-run
   rather than trusted at the next upgrade.

## Next action — the checklist for the session that closes milestone 3

Written out rather than summarised, because two of these are the kind of thing a closing session
assumes was already done.

**1. Re-install from the remote and count the agents.** `Agents (3)` today is read from a
`--plugin-dir` load and from a **local-path** marketplace install — both real, neither the path a
stranger uses. The remote could not carry the fix while it sat on a branch. So: clone-backed install,
then `claude plugin details portulan`, and the criterion in
[`0003`](../tasks/0003-plugin-and-public-marketplace.md) that names *"installed from the remote"* is
**deliberately unticked** until that reading exists. This is the session's first act, before the boot,
because everything after it assumes the personas arrived.

```
CLAUDE_CONFIG_DIR=<empty temp dir> claude plugin marketplace add sleepy-panda-works/portulan
CLAUDE_CONFIG_DIR=<same>           claude plugin install portulan@portulan
CLAUDE_CONFIG_DIR=<same>           claude plugin details portulan     # expect Skills (3), Agents (3)
```

**Pre-agreed fallback, so this does not stall:** if the clone-backed install still reports `Agents (0)`,
the files are already at the platform's default location and the remaining suspects are the clone or the
copier — capture the cache listing before changing anything, and take it to the maintainer rather than
improvising a second workaround.

**2. Boot the engine — the one clause milestone 3 is still open on.** It needs a live session, and
every one in session 1 returned `Credit balance is too low`, **including a control `claude -p` with no
plugin loaded**, which is how it was classified as an auth failure rather than mistaken for a packaging
failure. Re-checked four times across the session; still blocked at its end. Two runs, and the second is
the one that matters:

- in a project with **no** workspace → the engine must *report the absence* rather than improvise a
  policy layer;
- in a project **with** a workspace of its own → it must read *that* one and not either of the two valid
  workspaces inside its own bundle.

The second needs a discriminator, or the transcript proves nothing: build a minimal spec-2.0 workspace
(`portulan.spec` `2.0`, `name`, `kind: repository`, `tree`, `slots.{identity,principles,gates}`,
`verify`) whose identity glossary carries a marker term that exists in no other workspace anywhere, and
check the boot output names it. Validate it with `node cli/doctor.mjs` before trusting it, as session 1
did with a fictional "Lanternfish Cartography" workspace.

**Mint a new marker term — do not reuse session 1's.** It was `SOUNDING-LINE-7`, and the moment this
handoff merges that string ships **inside the plugin payload**, because the payload is the whole
repository and this file is in it. A boot transcript echoing it would no longer prove the bundle was not
the source, which was the term's entire job. The discriminator has to be absent from the merged tree —
grep for it before using it. _(The fixture itself is gone regardless: it lived in a session-scoped
scratch directory. Rebuild, do not go looking.)_

**3. Tag `v0.1.0`** on the merge commit, and push it. Both Gated, both the maintainer's. The ruling is
*fix first, then tag the merge*, so the tagged tree carries its own `CHANGELOG.md` entry. Note the
platform's own `claude plugin tag` would create `portulan--v0.1.0` instead — deferred, and open
question 2 below has the measurement behind that.

**4. Milestone-close supervisor**, fresh context, verifying the criterion was *demonstrated*. Its
fidelity note goes in the Status column verbatim.

**5. Carried, not absorbed:** [`0004`](../tasks/0004-a-harness-for-the-verify-recipes.md) (now eight
fail-opens), [`0005`](../tasks/0005-lint-the-persona-agent-binding.md) and
[`0006`](../tasks/0006-three-things-called-agent.md).

## Recoverability

Three files moved, one manifest key removed, two validators extended, and documentation. All five
recipes are green and the suite is 149. The move is the only change that alters what an installed plugin
does; reverting it restores the previous behaviour exactly, which was three personas that never loaded.
The push, the pull request, the merge, and the tag were each asked for separately.
