# The A/B arm specification

> **What "Portulan on" denotes.** Milestone 8's A/B clause asks whether Portulan makes an agent work
> better. Answering it requires a treatment arm, and a treatment arm is *built* — which means somebody
> chooses what goes into it. This file is that choice, written down before the instrument exists, so the
> baseline it eventually produces can be read by somebody who was not there.
>
> [`../../docs/plan.md`](../../docs/plan.md) row 8 is the binding criterion and
> [`../../docs/milestones/m08.md`](../../docs/milestones/m08.md) is its legislative history; this file
> restates neither. It says what the arms are.

## Why this file exists at all

An arm assembled by an implementer's judgement, described afterwards, is **undocumented experimenter
discretion** — and every figure downstream of it inherits that. The objection is not hypothetical: the
first design of this arm carried customer zero's entire build record into the treatment, and a grader
written against it returned *"30 records, each with its own provenance and retirement condition"* **with
the arm having done nothing at all**. The advantage measured was `cp`.

So the moves are enumerated here, each with the evidence that it is faithful, and each answerable to two
rules that bind before any of them is applied.

## Rule 1 — the discriminator

> A construction move is **faithful** if it makes arm A resemble **an adopter**, and **rationalised** if
> it makes arm A resemble **a passing arm**.

This is the test that decides whether a move belongs. It is a judgement, and it is stated as a rule so
that the judgement is made once, in the open, rather than per-move in an implementer's head.

Worked: emptying the record layer takes 34 proposals, 30 memory records and 144 handoffs *away* from the
treatment arm. A move that removes an advantage cannot be the rationalised one — which is what makes it
safe, and it is why the argument survives the obvious objection that it was chosen for convenience.

## Rule 2 — no move authors a normative sentence

> Every retargeting move is a **deletion**, an **emptying**, or a **substitution of a local specific**.
> **No move may author a normative sentence.**

Rule 1 is a judgement; this one is **checkable by machine in part**, which is why both exist. Diff each
replaced artifact against the original and assert that no new normative sentence appears.

**Session 6b built that checker and measured how far it reaches, and the reach is smaller than this
paragraph implied.** [`../../cli/ab.mjs`](../../cli/ab.mjs)'s `rule2()` grades a **prose** artifact
sentence by sentence and `rule2Json()` grades a **data** one over the string values it adds; every
substitution reaches one of the two. The `deletion` and `emptying` kinds are covered in full, because
they add no sentence and so nothing can be authored. The `substitution` kind is matched against a
**17-word marker list**, and it misses **every mandate not spelled with one of those words** — a class,
not a case. Attacked with fifteen sentences a reasonable implementer would write, **thirteen got past**,
including the whole imperative mood, the deontic contractions, and *"Done is demonstrated, not
asserted"* — the mandate under test in its own canonical wording. Six of the checker's corpus cases are
misses its suite **requires to stay missed**, because a corpus in which everything is caught measures
the corpus. So the checker catches the careless spelling and does not establish that a replacement
authored nothing: **a person still reads the added sentences.**

The failure it forecloses is exact. `dod.md`'s conditions 5–7 are unsatisfiable in a scratch project — a
seam-term list that lives outside this repository, a Session log entry in `../docs/plan.md`, a supervisor
checkpoint. That licenses **deleting** them. It does **not** license writing a replacement, because a
replacement saying anything like *"done means the verify recipe is green"* would put **the mandate under
test** into the workspace layer. The `done-demonstrated` scenario would then measure whether an agent
follows an explicit local instruction, which is not the question, and the arm would pass for the reason
the experimenter arranged.

## The moves

| Move | Kind | Faithful because | Evidence |
|---|---|---|---|
| **Empty** the record layer (`memory/`, `proposals/`, `handoffs/`, `tasks/`), **keep its shape** | emptying | [`../../docs/plan.md`](../../docs/plan.md) row 6 requires a store *"owned and populated only by the adopter, **empty until earned**"*, and its close re-observed the landing **present-and-empty** by hand | **the citation is narrower than the move, and that is stated rather than glossed**: row 6 says this of a resolving pack's persona-declared memory scope, and extending it to the whole record layer is an **inference** — a sound one, since no adopter receives another team's proposals or handoffs either, but an inference. The directories stay so the layers an agent may write into still exist |
| Replace the **whole recipe set**, not `verify.default` alone | substitution | recipes are per-repository, by the cascade the kernel itself inlines | measured in a built arm: customer zero's `docs` rail reports hundreds of unresolvable links, `core/engine.md is missing` and `README.md is missing`, and exits **2** with no git repository. _(**Dated 2026-08-28, and the last clause stopped describing the constructed arm on 2026-08-29**: the arm is `git init`-ed — see the `git init` row below — so re-measuring it today would not reproduce the no-git spelling. The conclusion is unaffected.)_ **No figure is written here** — two reconstructions of the arm produced two different link counts, which is this file's own rule about hand-copied figures applying to itself. Measured **2026-08-28, when this workspace declared 21 rails**: one green, three red, **seventeen unable to run at all**. The figure is left dated rather than restated — the workspace yields 23 today and will yield more, the count is not the finding, and a hand-copied one whose subject keeps moving is what this file warns about below; leaving the set would put all 21 in the arm's *"Verify — what done is checked against"* table |
| Replace `dod.md` — **deletion, plus one citation re-point** | deletion | conditions 5–7 are unsatisfiable in a scratch project | conditions 5, 6 and 7 are removed; condition 1's citation is re-pointed at the scratch recipe, which is the **one** substitution and is named rather than hidden inside the word *deletion*. **Nothing is added.** The header sentence — *"Core supplies the floor… A workspace may extend that floor and may never lower it"* — stays untouched: it cites core, it pre-exists, and every adopter's `dod.md` carries it. **Unsatisfiable sentences remain and stay**, deliberately: condition 3 asserts what `doctor` fails, condition 1's *Why* describes a Stop-gate and a CI the arm has neither of, and — found at session 6b's pre-commit checkpoint — condition 1 cites `../cli/recipe-set.mjs` and surviving condition 8 cites `../docs/plan.md`, **neither of which exists in the arm**. _(This sentence said **two** until 2026-08-29 and the figure was low. It is now stated without one: the count is a hand-maintained figure over a document that changes, which is the failure this file warns about on its own page, and what matters is the rule rather than the tally.)_ Removing them would be **editing the standard**, which `arm.md`'s rule 2 forbids; leaving them means the arm carries claims about capabilities it lacks, and that is the lesser of the two. **The arm's `dod.md` therefore numbers 1, 2, 3, 4, 8** — a visible tell that a human edited it, kept for the same reason: renumbering is licensed by no move, and no scenario in [`corpus.md`](corpus.md) reads the numbering, so the tell costs nothing measurable while the edit would cost the rule |
| Replace the repo card | substitution | a card is per-repository by definition | `doctor` lints a card's layout claims against the tree; a card describing this checkout reds |
| Drop the `constitution` slot | deletion | `vendor` **refuses** a workspace whose slot resolves outside the workspace directory — so this is a **precondition of construction** and not only a faithfulness move, which session 6b measured and this row did not say | measured. **This reaches `constitution` alone** — it is the only slot here pointing outside `.portulan/` |
| Drop the `repos` slot and the `products` array | deletion | neither survives the repo-card replacement above | **`products` is not a slot** — the slot set is fixed by [`../../spec/workspace.schema.json`](../../spec/workspace.schema.json) and `products` is a top-level array. Both go because `products[].repos` names a card the arm no longer carries, which `doctor` reds. Nothing to do with the escaping-slot refusal, and an earlier draft of this row said otherwise |
| **Empty** the generated indexes over the emptied record layer — `memory-index.md`, `handoffs-index.md` | emptying | a store's table of contents is part of the store | **measured, and this table did not reach it.** Built to the six rows above and vendored, the arm carried **30** of customer zero's rule titles over an empty `memory/` and **146** dated handoff titles over an empty `handoffs/`, and `doctor` was **GREEN** — nothing in the arm regenerates or byte-compares once the recipe set is replaced. Regenerated over the emptied store rather than dropped: `memory.index` is a declared slot and an adopter who declares one has one, empty until earned |
| Drop `rule-carriers.json` | deletion | it carries the experiment's own subject | **five** of its entries name the A/B clause. An arm carrying the registry of what this repository reduced to one carrier is carrying a record of customer zero's incidents by another route — what row 1 empties `memory/` to prevent. Nothing in the arm runs `rule-carriers.sh` either |
| Drop `labels.json` | deletion | a local specific with no adopter analogue | customer zero's GitHub label policy. The arm has no repository on GitHub and no `pr-labeled` check to satisfy |
| Drop `.portulan/README.md` | deletion | it is *about* being customer zero | it opens *"Portulan is **customer zero** — the framework is built the way it tells teams to build"*, which is a sentence no adopter's workspace carries and which describes the experiment to the arm under test |
| Drop `.portulan/compile/` and `.portulan/tools/` | deletion | a generated artifact of another repository's floor, and that repository's bot credentials helper | `compile/` names customer zero's branch ruleset; the arm's own is regenerated by `compile` over the arm's own `gates.json`. `tools/` is a `gh-bot` token helper and a logo. Both are carried by `vendor` because it walks the **workspace directory**, not the slot set |
| Drop the `personas` slot, `personas-index.md` and the `packs` array | deletion | a persona scope is pack-declared and the arm composes no packs | `../../.portulan/personas-index.md` says of itself that the pack declares the scope and carries none of its contents, so an arm with no pack root has a scope nothing declared. **`personas/` holds only empty directories, so git cannot carry it and a clean checkout has none** — which is why its disposition in [`../../cli/ab.mjs`](../../cli/ab.mjs) declares `mayBeAbsent`, audited by asking git rather than by asking whether the path is there |
| **`git init` the arm** (2026-08-29) | *not a retargeting move* | every adopter's tree is a git repository | The one addition, and it is a property of the **tree** rather than of the workspace layer, so `arm.md`'s rule 2 does not reach it: no sentence is authored. It is named here because the recipe-set row's evidence cites *"exits **2** with no git repository"*, and **that measurement describes the arm before this move and no longer describes the arm the harness builds**. The row's conclusion is unaffected — seventeen rails still cannot run — and this row is dated **2026-08-29** so that cell is not read as a present-tense property of a configuration nothing constructs |

### Why the constitution is dropped rather than carried

[`../../docs/vision.md`](../../docs/vision.md) is **Portulan's** product constitution. Copying it into
the arm would make arm A resemble **customer zero**, which is precisely what rule 1 refuses: an adopter's
`constitution` slot holds *their* product's ground truth, not the framework vendor's. The slot is
optional, and an adopter who has not filled it is an ordinary adopter.

**The maintainer retired an earlier ruling of his own to reach this.** He had ruled that the constitution
be copied into the arm ephemerally and byte-verified; that was taken before the arm was retargeted, when
arm A was to be customer zero's workspace entire, and retargeting removed its premise. **He retired it
explicitly**, rather than letting this specification win quietly — which is the distinction that matters,
because a ruling that stops applying without anyone saying so is indistinguishable from one nobody
followed.

## What arm A therefore is — the sentence the record must carry

> **Portulan's kernel, plus customer zero's governance prose, in an adopter-shaped workspace.**

Not *"customer zero's real workspace"*. Things are replaced, emptied or dropped, and continuing to use
the older description after that is where the rationalisation would actually live.

**No count stands in this sentence, and its removal is the point.** It read *"seven things"* while the
table above it held **six rows** — one row carries two drops — and session 6b then added more rows still.
The figure was wrong in one direction before it was written and wrong in the other after, and *"seven
moves added"* was the same defect in new clothes: a table-row count wearing the word the machine carrier
uses for a **disposition**, and one of those rows declares itself *not a retargeting move* at all. A
hand-maintained figure whose subject keeps moving is a carrier that fails silently, which this file warns
about two sections below and had itself. **The moves have one carrier and it is machine-readable**:
`DISPOSITIONS` in [`../../cli/ab.mjs`](../../cli/ab.mjs), which `node cli/ab.mjs --plan` prints and
[`register.md`](register.md) records at every construction. The table above is the argument for each; the
count is derived from the code that applies them.

Two residuals are named rather than smoothed:

- [`../../.portulan/identity.md`](../../.portulan/identity.md) still says *"Sleepy Panda SRL building
  Portulan"*, and [`../../.portulan/gate-map.md`](../../.portulan/gate-map.md) still describes a platform
  floor on a repository the arm is not in. The governance prose is genuinely this team's.
- **The arm is bound to this checkout.** `compile` pins the hook commands to absolute paths under
  `cli/`, and `vendor` does not carry `cli/` — so a wrapper inside the arm would still have to delegate
  here. This is **not** fixable at reasonable cost. The record says the arm is machine-bound — and session 6b
  **measured it rather than repeating it**: a constructed arm carries **5** hooks, every one an absolute
  path into this checkout, and `--construct` prints the figure rather than asserting the property.

## What the source workspace cannot change

The kernel `vendor --host` inlines is **byte-identical** to [`../../core/engine.md`](../../core/engine.md)
— measured by diffing the vendored `AGENTS.md`'s kernel section against the source, and the artifact says
so of itself (*"universal and identical in every workspace"*).

So the choice of source workspace **cannot** change what a kernel-anchored scenario tests. It changes
only how contaminated that scenario is. The anti-circularity anxiety that drove the arm-source question
applies to the **skill** scenarios alone — and those are exactly the ones a vendored arm does not carry
([`corpus.md`](corpus.md)).

## Arm B

A bare tree. No `AGENTS.md`, no `.portulan/`, no compiled settings. The arms receive the **same** task
text and differ by the treatment alone; that difference is asserted at construction rather than intended,
by comparing the two trees and requiring them identical outside the enumerated treatment files.

## What is not settled here

- **The construction is built** — [`../../cli/ab.mjs`](../../cli/ab.mjs), session 6b, held by the `ab`
  verify recipe and a forced-red drill. **Nothing about a baseline changed**: no agent has been run, no
  scenario is graded and no figure exists. The graders and their level-1, attribution and level-2
  discrimination fixtures are **session 6c's**; the run is **6d's**, on the maintainer's ruling of
  2026-08-29 splitting this clause at construction | grading | running.
- **The file count follows from this spec**, and is derived at construction rather than written here — a
  hand-copied figure whose subject keeps moving is a carrier that fails silently, which this repository
  has repaired for recipe counts, the CLI roster and the review-loop tally already. [`register.md`](register.md)
  now carries it, generated and byte-compared. _(It deliberately does **not** carry the count of paths in
  the **source** workspace: that moves whenever a session writes a record, and a byte-compared file
  holding it would red the `ab` rail on work that never touched the arms.)_
- **Operator isolation** (a clean config directory and home per arm) is **built** — `isolatedEnv()` moves
  `HOME`, the XDG directories and `CLAUDE_CONFIG_DIR`, since a plugin cache found through either would let
  the host resolve packs the arm never declared. **What it costs is measured, and it is not a detail:**
  breaking **either** `HOME` or `CLAUDE_CONFIG_DIR` alone is enough for `claude -p` to report *"Not
  logged in"* — measured both ways on 2026-08-29 — so on that host **the ruled isolation makes the agent
  unrunnable**, full stop. The credential is not a file this harness can carry; carrying it is the
  obvious repair and is **not built**. `corpus.md`'s acceptance test was therefore run under
  `--stop-probe --operator-env inherit`, a **named departure** the tool prints on every run — **accepted
  by the maintainer on 2026-08-29**, for that test and for nothing else, because the question it asks is
  whether the host invokes the hook and the ruled isolation cannot answer it on that host at all. **A
  baseline recorded over an unisolated arm is not the ruled arm**, and session 6d either carries the
  credential into an isolated home or records its own departure. **And when an isolated operator
  environment can authenticate an agent, the stop probe is RE-RUN under it** — required by a second
  opinion on 2026-08-29 and written here rather than left for 6d to infer: the acceptance evidence is
  environment-specific, re-confirmation costs one turn, and the receipt mechanism already exists. The
  obligation is carried machine-readably too, as `acceptedUnder.reRunWhen` on the scenario's own entry in
  [`../../cli/ab.mjs`](../../cli/ab.mjs).
