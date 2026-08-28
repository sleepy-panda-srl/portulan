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

Rule 1 is a judgement; this one is **mechanically checkable**, which is why both exist. Diff each
replaced artifact against the original and assert that no new normative sentence appears.

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
| Replace the **whole recipe set**, not `verify.default` alone | substitution | recipes are per-repository, by the cascade the kernel itself inlines | measured in a built arm: customer zero's `docs` rail reports hundreds of unresolvable links, `core/engine.md is missing` and `README.md is missing`, and exits **2** with no git repository. **No figure is written here** — two reconstructions of the arm produced two different link counts, which is this file's own rule about hand-copied figures applying to itself. Of the 21 declared rails, one is green, three are red and **seventeen cannot run** at all; leaving the set would put all 21 in the arm's *"Verify — what done is checked against"* table |
| Replace `dod.md` — **deletion, plus one citation re-point** | deletion | conditions 5–7 are unsatisfiable in a scratch project | conditions 5, 6 and 7 are removed; condition 1's citation is re-pointed at the scratch recipe, which is the **one** substitution and is named rather than hidden inside the word *deletion*. **Nothing is added.** The header sentence — *"Core supplies the floor… A workspace may extend that floor and may never lower it"* — stays untouched: it cites core, it pre-exists, and every adopter's `dod.md` carries it. **Two more sentences are unsatisfiable and stay**, deliberately: condition 3 asserts what `doctor` fails, and condition 1's *Why* describes a Stop-gate and a CI the arm has neither of. Removing them would be **editing the standard**, which rule 2 forbids; leaving them means the arm carries two claims about capabilities it lacks, and that is the lesser of the two |
| Replace the repo card | substitution | a card is per-repository by definition | `doctor` lints a card's layout claims against the tree; a card describing this checkout reds |
| Drop the `constitution` slot | deletion | `vendor` **refuses** a workspace whose slot resolves outside the workspace directory | measured. **This reaches `constitution` alone** — it is the only slot here pointing outside `.portulan/` |
| Drop the `repos` slot and the `products` array | deletion | neither survives the repo-card replacement above | **`products` is not a slot** — the slot set is fixed by [`../../spec/workspace.schema.json`](../../spec/workspace.schema.json) and `products` is a top-level array. Both go because `products[].repos` names a card the arm no longer carries, which `doctor` reds. Nothing to do with the escaping-slot refusal, and an earlier draft of this row said otherwise |

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

Not *"customer zero's real workspace"*. Seven things are replaced, emptied or dropped, and continuing to
use the older description after that is where the rationalisation would actually live. Two residuals are
named rather than smoothed:

- [`../../.portulan/identity.md`](../../.portulan/identity.md) still says *"Sleepy Panda SRL building
  Portulan"*, and [`../../.portulan/gate-map.md`](../../.portulan/gate-map.md) still describes a platform
  floor on a repository the arm is not in. The governance prose is genuinely this team's.
- **The arm is bound to this checkout.** `compile` pins the hook commands to absolute paths under
  `cli/`, and `vendor` does not carry `cli/` — so a wrapper inside the arm would still have to delegate
  here. This is **not** fixable at reasonable cost. The record says the arm is machine-bound.

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

- **The construction is not built.** This file is denotation; the harness is
  [`../../docs/milestones/m08.md`](../../docs/milestones/m08.md)'s session 6b.
- **The file count follows from this spec**, and is derived at construction rather than written here — a
  hand-copied figure whose subject keeps moving is a carrier that fails silently, which this repository
  has repaired for recipe counts, the CLI roster and the review-loop tally already.
- **Operator isolation** (a clean config directory and home per arm) is ruled and unbuilt; a populated
  and an isolated environment resolve packs differently, so an arm built without isolation is not the
  ruled arm.
