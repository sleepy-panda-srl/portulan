# Proposal 0044 — five roles a staffed workforce needed and the engine does not name

**Status. DRAFT — prepared 2026-11-20 for Marius Cetanas. Not accepted; nothing here is ruled.**
Extends [`core/personas/README.md`](../../core/personas/README.md) (a persona is a role packaged as a
context firewall) and the pattern of the checkpoints pack (a role contributed by a pack, with its skills).

---

## Incident — a workforce wrote five role rules outside the engine

The maintainer, 2026-11-20, staffed a standing workforce in a consumer workspace, on a host that runs
several agents: coordinators he picks by hand, and workers a coordinator starts for one task. Each role
had been given a card of its own rules. Asked whether the roles should also get skills of their own, he
answered: "Portulan has skill in it although they aren't defined clearly as skills."

That held for three roles. The builder, the reviewer and the librarian were rewritten the same day to
point at the implementer, reviewer and librarian personas, at the supervisor's three checkpoints and at
`clarify`, `codify`, `consolidate` and `delegate-local`. Their cards now add only what the engine cannot
know: who a worker answers to and what it hands back.

Five roles had nothing to point at, and their rules stayed in the consumer's own folder.

## What exists, and the gap

- **Three core personas and two pack personas.** `implementer`, `reviewer`, `librarian` in core;
  `supervisor` from `rituals/checkpoints`; `local-worker` from `tools/local-llm`.
- **A persona's contract.** A tool allow-list, a charter, an autonomy reach in tier vocabulary, a memory
  scope, a read and write posture, and optionally one `model` and one `effort`.
- **A pack can contribute a role.** The checkpoints pack contributes contexts, skills, personas and gates.

**The gap, role by role:**

| Role | What the engine says today | What is missing |
|---|---|---|
| Coordinator | `core/personas/README.md` speaks of "the parent loop" that fans work out to personas. | A charter for that loop: which lane, when a checkpoint is owed, what a brief says, how a worker is chosen, what it never grades itself. |
| Gate | [`verification.md`](../../core/operating/verification.md) defines a recipe's exits (0, 1, 2) and the hierarchy. | A role that only runs the recipes on a push and reports, without being the author or the reviewer. |
| QA | The hierarchy's top rung is "the behaviour was exercised". | A role that uses the built product as a person would and reports what it saw. |
| Language review | The reviewer's binding ([`agents/reviewer.md`](../../agents/reviewer.md)) says its bar "is hardest on prose". | A role, and a procedure, for the words a person reads, in each language shipped. |
| Release | Publishing is a typical Gated act; the implementer prepares such an act and hands it to the human. | A charter for a role that performs a Gated act once the human has said yes to that act. |

Two things sit under all five:

- **A roster.** A persona may declare one model and one effort. A workforce with more than one provider
  staffs a role with several, and needs a rule for choosing among them. The consumer's rule reads what is
  left of each plan's allowance before starting a worker and shares the work in that proportion.
- **A reach that includes a Gated act.** No persona today acts in the Gated tier. The release role does,
  on an explicit yes for that one act.

## Proposed rule

1. **The five roles arrive as personas in a pack, and core stays at three.** A workspace that staffs no
   workforce composes nothing, which keeps the ceremony able to scale down.
2. **Each charter is short and states its reach in tier vocabulary:**
   - **Coordinator.** For: taking a task from the human, choosing the lane, fanning work out, reading what
     comes back, reporting. Not for: grading its own plan or its own worker's change (a checkpoint needs a
     context that has not seen the work), or deciding what the human did not decide. Reach: Auto and
     Propose.
   - **Gate.** For: running the workspace's verify recipes at one commit and reporting each exit. Not for:
     fixing, or judging the change. Reach: Auto, read and run-verify; its only write is its report.
   - **QA.** For: exercising the built product and reporting steps, expectation and result. Not for:
     fixing. Reach: Auto; its only write is its report.
   - **Language review.** For: each changed string in each shipped language, read where it is shown. Not
     for: editing the files. Reach: Auto, read; its output is advice.
   - **Release.** For: preparing a release and performing its Gated acts. Reach: Gated, and only on the
     human's explicit yes for that act, quoted in its brief. A yes for one release is not a yes for the next.
3. **A roster is workspace policy.** The pack defines its shape (a role, and for it one or more of: host
   agent, model, effort) and the shape of the choosing rule (what is left of each allowance decides). It
   never carries the values.
4. **A procedure with fixed steps becomes a skill; a judgement stays a charter.** Candidates: starting a
   worker (brief, choice, start), a gate run, a language review, a release. QA has no fixed steps.
5. **Nothing here binds a host.** How a host starts a worker, and what a worker inherits from it, is the
   host binding's to say.

## Enforcement — what would hold it, and what is built

- `doctor` and `compile` already validate the personas of a composed pack; the five would pass through the
  same checks, including a declared reach.
- The release role's rule, Gated only on a quoted yes, is a rule and not a rail. What holds a release is
  the platform floor: the account that publishes and who is signed in to it. The charter would say so.
- A checkpoint the coordinator runs itself is the failure the `self-certify-a-checkpoint` fragment already
  names; the coordinator's charter would cite it rather than restate it.

**What is built today, and what is not.** Nothing in this repository. The five role rules exist as plain
files in the consumer's folder, with a roster and a script that starts a worker from it. No pack, persona,
skill or spec field named here exists. They would arrive in the change that follows the maintainer's rulings.

## Questions for the maintainer

1. **One pack for all five** (proposed: `rituals/workforce`), or does the coordinator belong in core,
   since core already speaks of the parent loop?
2. **Which first?** Proposed order: coordinator and gate, which every task uses; then QA, language review
   and release.
3. **May a persona's reach include performing a Gated act on an explicit, quoted yes,** as the release role
   needs, or does every persona stop at preparing the act?
4. **Is the roster a workspace slot** the Workspace Definition should name (several models for a role,
   chosen by what is left of each allowance), or does it stay a consumer's own policy outside the spec?

---

**Provenance.** `form=sealed` `owner=Marius Cetanas` `date=2026-11-20` `shape=a consumer workspace staffed
eight roles on a multi-agent host; three mapped onto existing personas and skills; five (coordinator, gate,
QA, language review, release) had no persona or skill to point at and were written as the consumer's own
files, together with a roster of models per role and a rule that chooses among them by remaining allowance`

**Retire when.** The maintainer rules on the four questions: the roles are packed, placed in core, or
declined, and the persona README says which.

**Decision.** Pending: Marius Cetanas.
