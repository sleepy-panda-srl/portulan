# Handoff — the feed points, the public repository carries, and a scope lands empty

**Date:** 2026-07-30 · **M6, session 1** · Branch `m6-the-feed-resolves-and-a-scope-lands`, opened as a
pull request against `main` as [#117](https://github.com/sleepy-panda-srl/portulan/pull/117)

**State.** Three of milestone 6's four remaining clauses are demonstrated. `portulan-internal`
**publishes** two plugins; the `rituals/checkpoints` pack **resolves from it**; and a pack-declared
persona memory scope **lands empty in the adopting workspace's own layer**, on the feed adopter and on
customer zero, each forced red three ways. Workspace Definition **2.6** is the mechanism, and it did not
exist in any form when the session opened. Suite 674 → 721, eight recipes green. **The row does not
close:** the Sleepy Panda SRL product task through the full loop remains, scoped by the maintainer to
Portulan first and Tipar API next. Supervision: session-open APPROVE-WITH-ADJUSTMENTS (12), all folded
in; pre-commit APPROVE-WITH-ADJUSTMENTS (7), all folded in — one of them a fail-open in the flag the
first checkpoint had asked for. **Milestone-close has not run and could not** — it grades a merged tree.

## Decisions + why — the reasons are the payload

- **#113 ruled: the feed points, the public repository carries.** Put to the maintainer with four
  options, not three — the session-open checkpoint produced a fourth nobody had named (a generated,
  byte-compared copy in the feed, redeemed by the idiom this project already uses for its indexes) and it
  went into the packet beside the recommendation. He chose the pointer. *Why it is a reading of the row
  and not an amendment of it:* the row's own contrast is "resolves … rather than being **declared and
  counted**", so its enemy is declaration without resolution — and after install the content sits at a
  root the feed produced, at a version the feed pins, behind access the feed gates. *The residue, stated
  because it is real:* if the public repository were unavailable, the feed could not deliver the pack. A
  feed that carries content does not have that property. *Why not copy:* two carriers of one file, with
  the drift on the private side where no public check can see it.

- **Measured before it was put to him, which is why it was rulable at all.** #113 said the choice turned
  on *"does this need new code or only a new root"* and that the pointer option "needs measuring, not
  assuming". CLI 2.1.220, isolated `CLAUDE_CONFIG_DIR`: a marketplace manifest carrying **none** of a
  pack's files installs it from a `git-subdir` source pointing at another repository; with `path: "packs"`
  the install root **is** a packs root; the shipped `resolvePack` found `rituals/checkpoints` there with
  `why: null`. The marketplace `source` field turns out to accept **five** forms, not one — `./`, `npm`,
  `url`, `github`, `git-subdir` — and only `git-subdir` was exercised. The other three remote forms are
  declared-only, and the marketplace was added from a local directory in the first probe, so
  private-marketplace add **over authenticated git** was measured separately and does work.

- **The flag the first checkpoint asked for was itself a fail-open, and the second checkpoint found it.**
  `--pack-root` went onto three tools; `doctor` and `index` spell it `options.packRoots ?? packRoots(…)` and
  so **replace** the derived root, while `compile` **appended** it. Demonstrated: the pack in a workspace's
  own tree, `--pack-root <empty directory>`, compiled green from the local copy — the exact substitution the
  flag exists to prevent, in the one tool whose output is the compiled artifact, with all six prose carriers
  describing the other behaviour. Replacement in all three now, and the divergent case is a test rather than
  a sentence. Worth stating as a pattern: **the defect was in the scaffolding around the mechanism, not in
  the mechanism** — the ninth time this repository has found that shape.

- **"Zero new resolver code" was true; "only a new root" was not.** The checkpoint caught the gap:
  `packContributions` and `doctor`'s `inspect` had accepted `options.packRoots` since session 0 and
  **nothing ever set it**, so the path built for the feed case was reachable only from a test. `--pack-root`
  is that caller now, on `compile`, `doctor` and `index`, and named roots **replace** the one derived from
  `tree` — deliberately, so a claim that a pack resolved *from the feed* cannot be satisfied by a copy
  sitting in the local tree at all. A root that does not exist is **exit 2**, never "the pack did not
  resolve": the first is a fact about the filesystem and the second sends an author to the one file that
  is not at fault. Still absent, and named rather than implied: **discovery**. Nothing finds a host's
  plugin cache on its own.

- **The scope layer is declared, not derived, and is sited outside `slots.memory`.** The first design put a
  generated marker *inside* the store and cited the `memory.index` siting rule as support; that rule says
  the **opposite** — it refuses in-store generated files "rather than teaching one filename to hide from a
  walk". Rejected by the checkpoint, and rightly. Not derived, because a path this specification computed
  would be Portulan choosing a location inside every adopter's workspace in a key nobody typed. Not nested
  in the store, because doctrine holds per-agent memory apart so a reviewer's recall does not spend the
  implementer's budget — and because a nested store would be railed by a `kilobytes` budget the flat walk
  cannot see, which is [#76](https://github.com/sleepy-panda-srl/portulan/issues/76). Siting it outside
  leaves #76 to be decided on its merits instead of settled as a side effect of an unrelated feature.

- **"Present and empty" binds literally — the maintainer's ruling, and the design leans on it.** The
  alternative reading was *empty of records*, with a marker file inside. Because it is literal, and because
  **git does not record an empty directory**, the location cannot travel in a plugin payload at all: the
  declaration travels in the generated index, and the directory is created in the adopter's own layer when
  the adopter runs the landing. An absent location is therefore never a finding — it is the state of every
  fresh clone. That turned a constraint into the cleanest available proof that the contents are the
  adopter's.

- **The index is the positive control, and a first sentence would not have been.** Every field on a line is
  derived from the pack, including an 8-hex digest over the declared scope's normalized text, so a pack
  rewording a scope turns the byte comparison red in the adopter's tree. A legible first sentence sits
  beside it, and *only* beside it: a first sentence alone would let a pack reword everything after it
  invisibly. The digest is content-derived and therefore **path-independent** — customer zero and the
  feed-installed adopter produced the identical `41216e14`, which is why an index generated against a local
  packs root byte-compares green when re-derived from the feed install. That equality is the single
  strongest thing measured this session. **Its cost, found by repairing the pattern:** the digest is a
  function of the generator's normalization too, so changing `memoryScopeOf` staled every committed index
  including the feed's — a red every adopter must repair and none of them caused. No mitigation this
  session; written down so the next change to that function is taken knowingly.

- **A MINOR, argued rather than asserted.** 2.5 → 2.6 adds two optional keys and tightens nothing; every
  manifest valid at 2.5 is valid at 2.6, `examples/` stays on 2.4 untouched, and no migration is owed. The
  contrast with session 0 — where the intent was the same bump and the schema had not moved at all — is the
  same discipline pointing the other way, and both are now in `spec/README.md` so the next bump is held to
  the pair rather than to whichever is convenient.

- **Tipar API's card is sealed rather than invented.** The portfolio workspace covers every Sleepy Panda SRL
  product, and this agent has not been told Tipar's stack, repositories, commands or gates. A plausible
  guess would have put false claims in the one layer whose entire purpose is to hold true ones — and would
  have been caught by the claims lint the moment a repos card existed to check. The card carries a sealed
  provenance stamp, names the three things owed, and says outright that a task on Tipar cannot honestly be
  called done until they exist.

## What went wrong in here, and is now a rule

**Every control in this session was first measured with its exit code read through a pipe.** Three correct
red *messages* printed beside three `exit 0`s, because `$?` after `cmd | sed …` is `sed`'s status. Caught
only because a red message next to a zero is visibly incoherent. **Second occurrence of the class in this
repository** — the first was 2026-07-25, inside a change whose own subject was a check that must fail
closed. Now a memory record:
[`an-exit-code-read-through-a-pipe-is-the-pipes`](../memory/an-exit-code-read-through-a-pipe-is-the-pipes.md).
It is small and it matters: every forced-red demonstration this project
relies on has that shape, and a control that reports success is worse than no control, because the
transcript then reads as evidence.

Three smaller defects of my own, all caught by tests written for them rather than by reading: `index`
printed a green naming the store and the handoffs while silently omitting the scope index it had just
written — the third door through a trap whose own comment said "two doors now"; the index line's href lost
the trailing slash its label carried; and the scope sentence broke on a colon, rendering `Its own
supervisor memory:` and nothing informative.

**And then CI found the one neither checkpoint could, which is worth more than any of them.** That href
should not have existed at all. The index *linked* each location, `links` passed here — where the generator
had just made the directory — and failed on a clean checkout, because the location is **empty** and git
records no empty directory. A local false green **in a generated file**, faithfully reproducible by
regenerating. Locations are now **named** as inline code, not linked. The exemption repair was available and
refused for the reason this repository always refuses it. Reproduced in both directions before believing the
fix. Rule:
[`a-generated-file-must-not-point-at-what-git-cannot-carry`](../memory/a-generated-file-must-not-point-at-what-git-cannot-carry.md).

**One property, three consequences — and only two were designed for.** *An empty directory cannot travel:*
not into a plugin payload, not into a commit, and **not into a link**. The third is the one that got out.

## The second pass on both rulings, and what its riders changed

The reviewing session re-derived both maintainer answers at source and returned five riders. **Four
changed the tree; one was already true.**

- **The pin is now byte-compared, not just declared** — all six installed files hash identical to
  `git show 5a707e3:packs/rituals/checkpoints/…`. A pin nobody compares is a claim about a fetch nobody
  checked.
- **The split is stated out loud, and it is the sentence the close must be held to:** the pointing pack
  demonstrates resolution *mechanics* and nothing about private *carriage*; the portfolio workspace, whose
  content is native to the feed, demonstrates the carriage. Together they cover the clause; neither does
  alone. #113 closes on the merge that lands that wording.
- **The reverse direction is railed** — `plugin-lint` refuses a public marketplace entry sourced from a
  private feed, because a stranger's fetch 404s and the entry publishes the private feed's structure, and
  neither is visible from inside this tree. Preventive; no such entry ever existed.
- **"Empty" now means readable-and-zero** — a declared location that exists and cannot be enumerated is
  exit 2. This feature makes that confusion unusually dangerous: empty is the *success state*, so an
  unreadable location reported as empty reads as the design working. Absent stays green and is a third fact.
- **Observation 2 got its strongest available form.** A record written *through* the declared scope landed
  at the location and the workspace store report did not move — 26 records, 97.8 KB before and after, index
  unchanged, tree restored. Arrived-because-connected rather than because-mkdir, and it measures the
  separate-store claim the prose had only asserted.

**Already satisfied on arrival:** the doctrine's *nothing reads it, nothing consolidates it* half, which the
Session-0 verification flagged as live residue. This change discharges it.

**Not actioned, and deliberately.** Session 0's records disagree about the Copilot round count — three in
the Session log, two in the handoff and #105. `/pulls/105/reviews` holds **eight** Copilot submissions, so
neither figure matches the raw count and "round" is nowhere defined tightly enough to settle it. Editing a
merged record to an indefensible number is worse than a visible disagreement; it goes to the maintainer's
queue.

## For the next session

**One clause of the row remains: the Sleepy Panda SRL product task through the full loop from a private-feed
install.** The maintainer scoped it *"both, Portulan first"* — demonstrate the loop on Portulan, whose tree
is public and so whose five phases and red→green verify a stranger can check, then Tipar API once he
supplies its repos card, affordances and gate deltas. Then **milestone-close**, which needs the merged
tree and therefore its own session. Read `docs/milestones/m06.md`'s session notes before re-deriving any
of the above; the measurement scope and its unmeasured edges are enumerated there. The feed is live and
private — verified by negative control on `api.github.com`, `github.com` and `raw.githubusercontent.com`
after publishing, not just before.

**Two carried obligations.** A pin is not a subscription: `portulan-internal` pins commit `5a707e3`, and
the pack advances upstream without the feed noticing — when a release finally carries the pack (`v0.2.0`
predates it), the pin should become that tag. And `spec/slots.md`'s "premium packs" prediction was
corrected to what the tree shows; whether a premium pack should exist at all is the maintainer's
commercial question, now routed rather than left open in prose.
