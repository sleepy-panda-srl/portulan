# Handoff — the boot reports the layer it never mentioned, and three claims stop pointing the wrong way

Sixth handoff of 2026-08-07, and the third of three from one working thread — the maintainer asked for
the top three `Now` items one by one, one pull request each, and ruled that each carries its own handoff
and Session log entry. This one is [#178](https://github.com/sleepy-panda-works/portulan/pull/178), for
[#134](https://github.com/sleepy-panda-works/portulan/issues/134).

**State.** The boot skill reads and reports `packs`. Three claims that denied or overstated a capability
are corrected. Nine recipes green, `claude plugin validate --strict` passes.

## What was wrong, stated narrowly because the issue states it too broadly

`/portulan` read a workspace's slots and never its `packs` — `grep -c 'packs'` on the skill returned
**0** — so the middle of the cascade went unmentioned in every boot and a reader could not tell a
composed ritual from an invocable one.

**#134's own framing has partly gone stale and this change does not repeat it.** The issue says the
skill *"has no concept of a feed, a marketplace, or an install cache; the words do not appear in it"*.
Measured: *feed* twice, *cache* once, *marketplace* never — and the cache mention exists precisely to
disclaim discovery. Two of three were already there.

## Three drafts of one paragraph, and what refuted each

Section 3a took three attempts, and the corrections are the substance:

1. *"declared but not composed"* — refuted by milestone 6's own close. A pack **does** resolve;
   `--pack-root` was demonstrated refusing a local copy.
2. *"a pack resolves"*, unconditional — refuted by `cli/compile.mjs`: `packRoots()` returns `[]` without
   a `tree`, and `init`'s own drafted README tells adopters *"The pack is named, and nothing resolves
   it… validation is RED"*.
3. *"from a feed at a pinned version"* — **nothing here pins.** A `packs` entry is a name; the version
   is whatever the named root holds. Invented, and caught before it shipped.

Copilot then caught a fourth: *"two shapes — a feed install or a directory beside the workspace"*
conflates where a root comes from with what it points at, and hid the load-bearing part —
**named roots REPLACE the derived one** rather than being searched ahead of it, which is what makes
*"this pack resolved from the feed"* a claim a local copy cannot satisfy.

Two more corrections were the checkpoint's: the reason pack skills do not register is **not the feed**
(this engine's own plugin declares the pack directory as a skills path and they still do not appear), and
personas are not simply absent — a composing workspace lands their declared scope, so reporting them as
absent would be as wrong as reporting them as loaded.

## The sibling claims, and the one that reached further than expected

Under the ruling that the defect class sets a fix's scope, the same file's two false claims went with
it: *"there is no scaffolder yet"*, contradicted by step 5 one screen later, and *"memory has no
generated index"*, written 2026-07-26 and false since milestone 5 built one on 2026-07-28.

**On the maintainer's instruction of 2026-08-07** — address the session's findings here rather than
filing them — the class reached two carriers outside the skill:

- [`../../cli/plugin-lint.mjs`](../../cli/plugin-lint.mjs) prints `7 skill(s)` and a reader takes that
  for what a host loads. It is a count of what the manifests **declare** and what resolves on disk, and
  the header now says so at the count.
- [`../tasks/0008`](../tasks/0008-a-declared-skills-path-sees-one-level-down.md) records the three pack
  skills as resolving. True of the linter, false of the host. Amended in place, not reopened — what the
  task asked for is what the tool does.

**Re-measured rather than copied:** Claude Code **2.1.224**, a feed-installed pack and a feed-installed
workspace both report `Skills (0), Agents (0)`. The issue measured 2.1.220. The figure is deliberately
**not** restated in the shipped skill, which states the shape only —
[`../../docs/milestones/m07.md`](../../docs/milestones/m07.md) is its carrier.

## #134 closes, and the closing half was one line

The first version of this handoff said #134 stays open, because row 7 makes clause **(b)** what closes
it — *"a composed pack's skill is invoked in the adopting workspace the same way a core skill is"* — and
that read as needing discovery. It did not. **It needed the manifest to name the right directory.**

`portulan@portulan` was not installed here, so the session first reported the public plugin's half as
unmeasurable. `claude plugin marketplace add ./` takes a directory, which makes it measurable in
minutes. Read back on **Claude Code 2.1.224**, both directions:

| `.claude-plugin/plugin.json` declares | Host inventory |
|---|---|
| `./packs/rituals/` | **`Skills (4)`** — `clarify`, `codify`, `consolidate`, `portulan` |
| `./packs/rituals/checkpoints/skills/` | **`Skills (7)`** — plus `pre-commit`, `session-open`, `milestone-close` |

**A host expands a declared skills root exactly one level.** `./core/skills/` yields 3 and
`./plugin/skills/` yields 1 — which is the whole of the old `Skills (4)`, so the rule is not inferred
from one case. `./packs/rituals/` yielded nothing because the pack's skills sit two levels down. The
declaration is corrected, and clause (b) is **demonstrated rather than asserted**, which is the only
form this repository accepts for a milestone clause.

## The rail, because the count had been wrong for a milestone and nothing said so

`plugin-lint` counted **7** while the host loaded **4**, and a validator whose count exceeds the host's
is a false green over skills nobody can invoke —
[`../memory/a-manifest-field-can-validate-and-load-nothing.md`](../memory/a-manifest-field-can-validate-and-load-nothing.md)
a second time, in the sibling field. It now fails a skill resolved deeper than `HOST_SKILL_DEPTH` below
its declared root, and the message names the repair: *"Declare `<dir>` instead"*. Forced red against the
old declaration and green against the new.

**Two existing tests had to change, and that is the finding.** *"a pack-shaped tree resolves skills
nested below the declared root"* and *"a skill at exactly the bound is found"* both asserted **zero
failures** on shapes the host silently drops. They were written at milestone 6 and they are the reason
the gap survived one: the suite agreed with the tool rather than with the platform. Both now assert the
resolution *and* the out-of-reach failure, with the measurement in the comment. A positive control and a
`./`-form control were added beside them so the rail is a depth comparison rather than a ban on nesting.

## Still owed, and outside this repository

The private feed's own pack plugin ships `rituals/checkpoints/skills/` under a `packs` root and will
keep reporting `Skills (0)` until its manifest names that directory. **The mechanism is proven here; the
edit is there**, and it is one line. Nothing in this repository can verify it, which is why it is named
rather than claimed.

`#123` — discovery of a host's plugin cache — is untouched and stays row 7's. It was adjacent to #134
rather than a precondition for it, which is the thing this session had backwards.
