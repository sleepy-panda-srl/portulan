# Autonomy & gates

> Core doctrine — loaded on demand. What an agent may do on its own, what it must get approval for, and
> the gate no model can talk its way past. The engine defines the *mechanism* (the tiers, the modes, the
> floor); the workspace supplies the *policy* (which concrete action sits in which tier, and which mode
> it runs) — mechanism/policy separation.

**Two axes, and confusing them is the expensive mistake.** A **tier** says what an action *is* — how hard
it is to undo — and is decided per action. A **mode** says how often the *development cycle* stops for
approval, and is decided per workspace and per session. A tier is a property of the action; a mode is a
property of the run. Neither substitutes for the other, and the sections below take them in that order.

## Actions are tiered by undoability

Every action an agent can take is classified by how hard it is to undo — and, past a line, by whether
any approval could make it acceptable at all. That class, not the agent's confidence, decides who has to
say yes. _(The recoverable-vs-reversible axis is safety doctrine; see `safety.md`. The fourth tier is
not an undoability class: editing the standard you are graded against is trivially revertible and
forbidden anyway, which is why the axis needed the second clause when that tier arrived.)_

| Tier | Action class | Who approves |
|---|---|---|
| **Auto** | Recoverable and reversible — edits in a working branch, reads, local runs. | The agent, unattended. |
| **Propose** | Reversible but consequential — a diff to merge, a schema change. | Human or eval-gated review (a PR). |
| **Gated** | Outward-facing or hard to undo — push to a shared remote, publish, deploy, buy, delete, send. | Explicit human approval, per action. |
| **Prohibited** | Actions no approval makes acceptable — editing the standard the work is graded against. | Nobody, at runtime. |

**The examples in that table are illustrative, not binding.** Which concrete action sits in which tier is
workspace policy, always — an example here is a typical case, never a classification a team inherits. The
*Action class* column is the doctrine; the actions after the dash are there to make it legible.

_(Written down because the misreading has a price attached. An example read as binding once cost a whole
session of `git push` commands handed back to a maintainer to type by hand — and by way of demonstration,
this table's own Gated example is already false for the repository that wrote it: a working-branch push is
Auto there, gated at the merge instead. If a future edit drops the examples from the column, this paragraph
retires with them.)_

**Gated** is grantable at runtime by a human yes. **Prohibited** compiles to deny and is grantable only
by changing the rule itself through the evolution gate — never by runtime approval.

That distinction is the whole reason the fourth tier exists rather than being folded into Gated, and it
is not academic: a compiler with three tiers must file *"no agent edits the constitution"* under Gated,
and Gated compiles to a prompt. *Never* would become *unless somebody clicks yes* — a difference no
reader of the gate map would see, produced entirely by the vocabulary being one word short. _(Found by
building the compiler: milestone 4 needed a fourth class before it had a schema, and the workspace layer
carried it for one session while core still named three.)_

Use it sparingly. A tier that cannot be approved is a tier that cannot be worked around in an emergency
either, and a policy that reaches for it often has stopped distinguishing *dangerous* from *forbidden*.

The tiers are the engine's vocabulary. The **gate map** — the table of which concrete action lands in
which tier for this team and repo — lives in the workspace, because it is policy and it varies.
_(Provenance: platform engineering — the same policy for agents as for humans.)_

## Autonomy modes — how often the cycle stops

The tiers answer *what may I do*. They do not answer *how often will this run stop and ask*, and that is a
separate question with a separate right answer per team, per repository, and sometimes per session. A
team shipping to a staging environment and a team shipping to production want the same tier table and a
different checkpoint frequency.

| Mode | The development cycle | The one-line version |
|---|---|---|
| **Auto** | No checkpoint anywhere, including the last step. | Fully autonomous, end to end. |
| **Gated** | Unattended until the ship step, which asks once. | Autonomous until it lands. |
| **Strict** | Every push asks, and so does the ship step. | Ask before anything leaves the machine. |

**`gated` is the engine's shipped default**, and it is the recommendation, not merely a value: one
approval at the moment work lands is the smallest checkpoint that still puts a human between a change and
the repository's record. A workspace should have a reason to move off it in either direction.

Two different things are easy to confuse here, so they are named separately:

| | Value | What it is |
|---|---|---|
| **Shipped default** | `gated` | What a workspace should declare absent a reason not to. A recommendation, and nothing enforces it. |
| **Fallback on silence** | `strict` | What a compiler resolves when a policy declares no mode at all. Not a recommendation — the safest reading of *nobody chose*, so that an omission can never be the loosest setting. |

_(Which mode any particular workspace runs is that workspace's declaration, not core's business — core
would be stating a fact it cannot check, and a doctrine file carrying another file's live value is how
the two drift apart. Read the workspace's own gate policy.)_

**A mode governs the development cycle and nothing else.** It moves only the actions a workspace marks as
cycle steps — the push, the ship. It does not reach settings changes, deletions, releases, or spending:
those are classified by undoability, and how often a team wants to be asked about its own loop says
nothing about whether deleting a repository is recoverable. A mode is not a licence.

**No mode reaches the Prohibited tier**, in either direction. That tier exists precisely because it is the
one no approval unlocks, and a prohibition a setting could grant or revoke would be the Gated tier wearing
its name — the same collapse the fourth tier was added to prevent, arriving by a different door. This is
enforced by the compiler rather than promised: a mode-keyed tier naming `prohibited` fails the whole
compile.

### The names collide with the tiers, deliberately

**Auto** and **Gated** are both a tier and a mode. That is a real ambiguity and it is not an oversight —
the modes were named this way by ruling, and the words are the ones practitioners already use. The
ambiguity is closed by *position* rather than by vocabulary: a tier is a property of a rule, a mode is a
property of a policy and a session, and the two never occupy the same slot. In prose, write **"the Auto
tier"** or **"Auto mode"**; the bare word is always wrong where both are in scope.

Worth knowing which is which, because they answer different questions: *"is a push Auto?"* is a tier
question whose answer depends on the mode, and *"is this workspace on Auto?"* is a mode question whose
answer changes several tiers at once.

### Two scopes: a workspace default, and a session that may tighten

The workspace declares a **default mode**, and that default is what the enforcement compiler compiles —
so the generated artifact expresses it and a reviewer can read it in a diff.

A **session may tighten its own mode** at any point, without touching the policy, without a pull request,
and without affecting any other session. It may **not loosen**. Both halves matter:

- **Tightening is free** because raising your own bar needs nobody's permission.
- **Loosening is not available at runtime at all** — not gated, *absent*. Two independent reasons, either
  sufficient. First, it could not be honoured: the load-bearing layer is the compiled permission rule,
  emitted at the default, so a session claiming to be looser would still meet every prompt its mode
  promised to remove — a mode announcing a posture the host does not have is a false claim about an
  enforcer. Second, the agent writes that setting, and editing on a working branch is unattended — an
  agent that could loosen its own mode could un-gate its own ship step, which is self-authorisation with
  extra steps.

So loosening is a change to the workspace default: a policy edit, which is Propose, which is a review.
**The direction that needs a human keeps one.**

**Precedence, in one line:** _session override > workspace default; the Prohibited tier and every
mode-invariant action ignore both._

The override is session state, never repository state: worktree-local, untracked, carrying the session
that claimed it, and ignored by any other session — which is also how it expires, since the next
session's identity will not match it. A mode that outlived its session would be a setting nobody
remembers making.

_(One consequence to take deliberately rather than discover: a workspace on **Auto** removes the agent-side
prompt at the last step. Any argument a workspace makes that rests on a human approving every merge —
commit attribution is the usual one — is an argument that changes under Auto. Say so where the argument
lives, rather than leaving a paragraph defending a property the setting has already removed.)_

**Auto removes a prompt; it does not remove the floor.** This is the sentence to keep hold of, because
"fully autonomous" invites the other reading. The platform floor below is enforced by the server, and a
mode is a property of the run — so required checks, required reviews, and required conversation
resolution all still hold at Auto. An Auto-mode agent still cannot land a change *that carries an
unresolved review thread* where resolving one is authorised to a human: the mode deleted the prompt the
*agent* would have raised and left every gate the *platform* raises exactly where it was.

**But read what that floor actually guarantees before leaning on it**, because the reassuring version of
this paragraph is the one that goes stale. Required conversation resolution establishes that no comment
was *ignored*, not that anyone agreed — a reviewer can resolve its own thread. A pull request that drew no
comment trips none of it. And a workspace with zero required approving reviews has no floor row that
demands a human act at all. So a workspace declaring Auto is choosing **where** its checkpoints come from,
and it should check that the floor it is delegating to actually has the ones it thinks it does.

### What a mode does not survive

The **platform floor** below is indifferent to modes. Branch protection, required checks and review
requirements hold at Auto exactly as at Strict, because they are enforced by the server rather than by
the run. A mode changes how often *this* loop stops; it changes nothing about what the platform will
accept. That is the property that makes Auto safe to offer at all.

## The platform floor

Prompt-level rules can be argued with; branch protection cannot. The durable gates are the ones the
platform enforces regardless of which model, host, or prompt is driving:

- Branch protection and required status checks — no merge without green.
- PR-as-gate, and `CODEOWNERS` where configured — a human in the path for owned code.
- Least privilege — an agent gets the tools and scopes its task needs and nothing more (the `tools:`
  allow-list, see `../personas/`).

This is the *floor* because it holds when everything above it fails: a jailbroken prompt still cannot
push to a protected branch. Portulan configures the floor rather than asking you to trust that the model
will behave. The **enforcement compiler** (milestone 4) reads the workspace's gate policy and generates
the host's own enforcement — permissions and hooks — so a tier is configuration rather than a sentence an
agent is trusted to have read.

Two things about that compiled layer, stated here because they are mechanism rather than policy. It sits
**above** the floor and does not replace it: a local permission rule matches the spelling it was given,
so a command reaching the same action by another route escapes it, and only the floor is indifferent to
spelling. And what a host can enforce **varies**, so a backend reports honestly what it could not
compile rather than passing over it — a gate silently not emitted is worse than one openly refused.
_(Provenance: platform engineering — the internal developer platform, turned on agents; vision thesis 3,
"rails, not prose.")_

## Approvals should not block the human's day

A gated action should not mean the agent idles until someone is at a keyboard. The doctrine-permitted
**approval relay** carries a gated-action request to the human asynchronously (chat / webhook) and the
decision back. It is the one hosted-ish surface the product allows, and it ships self-hostable first.
_(Built later — the enforcement compiler and the relay are milestones 4 and 9; named here so the loop's
"gated" tier has somewhere to send its requests.)_
