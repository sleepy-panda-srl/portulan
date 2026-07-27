# Autonomy & gates

> Core doctrine — loaded on demand. What an agent may do on its own, what it must get approval for, and
> the gate no model can talk its way past. The engine defines the *mechanism* (the tiers, the floor);
> the workspace supplies the *policy* (which concrete action sits in which tier) — mechanism/policy
> separation.

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

## The platform floor

Prompt-level rules can be argued with; branch protection cannot. The durable gates are the ones the
platform enforces regardless of which model, host, or prompt is driving:

- Branch protection and required status checks — no merge without green.
- `CODEOWNERS` and PR-as-gate — a human in the path for owned code.
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
