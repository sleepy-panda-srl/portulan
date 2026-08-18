# Handoff — the pack the feed ships declared nothing

**Milestone 7, session 5 (continued).** The maintainer's instruction: *"fix the checkpoints plugin
manifest in portulan-internal"*. It is fixed, and **not in `portulan-internal`** — which is the finding.

## Where the defect actually was

`portulan-checkpoints@portulan-internal` is a **`git-subdir`** source rooted at this repository's
`packs/`, pinned to a commit. So what a host installs is the contents of `packs/`, and it reads a
manifest from `packs/.claude-plugin/plugin.json` — which **did not exist**. The payload declared nothing,
the host registered nothing, and the only symptom was a count nobody was watching: `Skills (0)`, for the
whole of milestone 6 and after.

The feed's own repository is correct as written. Nothing there needed changing except, later, the pin.

**And [#134](https://github.com/sleepy-panda-srl/portulan/issues/134)'s diagnosis of its own bullet was
wrong.** It attributed the zero to a declared path one level too high. That trap is real — a host expands
a declared skills path exactly one level — and it is a *different* trap from having no declaration at all.
Both were reproduced from scratch on Claude Code 2.1.226, installed through a local marketplace under an
isolated `CLAUDE_CONFIG_DIR`:

| declared skills path | `plugin-lint` | host |
|---|---|---|
| *(no manifest at all)* | — | **Skills (0)** |
| `./rituals/` | **exit 1**, three failures naming the repair | **Skills (0)** |
| `./rituals/checkpoints/skills/` | **exit 0** | **Skills (3)** |

## What that forced, and it is the part worth reading

Adding the manifest made `packs/` a **second plugin root in this tree** — and the verify recipe found it
before anyone declared it, exiting **2** with `in tree: . packs` against `validated: .`. That is
`a-checkers-coverage-is-measured-not-named` working exactly as written, unprompted.

But `plugin-lint` requires **both** manifests at every root, and `packs/` has no `marketplace.json` and
is owed none: the feed carries that entry. So the lint needed a notion it did not have — a **payload
root**. It is an **opt-in flag**, never an inference from an absent file, because a lint that relaxed
whenever a manifest was missing would get narrower every time someone deleted one. The recipe declares
`PAYLOAD_ROOTS` separately for the same reason. What the exemption costs is counted rather than worded:
one `unverifiable`, because nothing here can check that the feed's entry agrees with this manifest.

## What the pre-commit checkpoint caught, since it changed the diff rather than the wording

Four things, and the first was a **regression in the gate machinery**:

- **A could-not-run flattened into a red.** Running the lint twice under `|| status=1` turned exit 2 into
  exit 1 — *nobody looked* reported as *we looked and it was bad*, in a recipe whose own header promises
  three codes. **Third instance in this repository**; `compile.sh` and `index.sh` both carry the `case`
  that fixes it, both after the same finding at the same checkpoint.
- **`existsSync` follows a symlink**, so a dangling `marketplace.json` link read as *"none is owed"* and
  went green where the strict path calls it a failure. `lstatSync`, ENOENT only.
- **The relaxation shipped with no test.** Four forced reds now cover it, including the opt-in invariant.
- **The version was `0.1.0`** where the pack's own is `0.2.0`, and the number the host displays is this
  one.

## Left, and stated rather than implied

**The feed's pin has not moved**, so the real `portulan-checkpoints@portulan-internal` still reports
`Skills (0)` until it does. The green half of the measurement above is observed on the payload and
**inferred** for the feed; it cannot be observed until this commit exists. That is a one-line change in
`portulan-internal`'s marketplace entry, and it is the maintainer's repository.
