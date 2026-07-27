# Gate map — what an agent may do at Rooftop

> The **policy** half of autonomy. Core defines the tiers — Auto, Propose, Gated, Prohibited — as universal
> mechanism; this file binds *our* concrete actions to them, because which action is dangerous is a
> property of the team, not of the engine. _(Fictional. See [`README.md`](README.md).)_

## The tiers, bound

### Auto — the agent acts unattended

Recoverable and reversible inside a working copy. Nothing here reaches a co-op, a shared branch, or the
database.

- Read anything in either repository, including git history and the CI logs.
- Create and edit files on a working branch.
- Run the verify recipes ([`verify/README.md`](verify/README.md)) or any read-only command.
- Run the service locally against the seeded development database.
- Commit to a working branch — never to `main`.
- Draft memory entries, task files, and proposals.

### Propose — a human reviews before it counts

Reversible but consequential: it changes what ships, or what we say.

- Open a pull request in either repository. An agent never merges its own.
- Add or change a rule in [`memory/`](memory/), this file, or [`dod.md`](dod.md).
- Change public copy on `fieldnotes` — including compliance guidance, which reads as advice whether we
  meant it to or not.
- Add a dependency. Three people maintain everything they add.
- Change a verify recipe — and *relaxing* a check is the case to scrutinise hardest, because it is the
  one change that makes every future green mean less.

### Gated — explicit human approval, per action, before it happens

Outward-facing or hard to undo. The agent prepares and asks; approval for one action never generalises
to the next.

- **Any migration that drops or rewrites a column, or deletes rows.** Ana approves, and only after a
  restore has been tested that week. This is the tier's whole reason for existing here.
- Deploy `combcount` to production. (`fieldnotes` ships on merge and is not gated — a bad page is
  fixed by another merge; a bad migration is not.)
- Run anything against the production database, including a read-only query, because a read that locks
  a table on a Tuesday morning is not read-only in the sense that matters.
- Mail co-ops — including a test send, including "just to myself", because the reminder run's recipient
  list has been wrong before.
- Change repository settings, branch protection, or hosting configuration.
- Add or remove a person's access to anything.

## Above the tiers

No agent changes a co-op's inspection history. Not with approval, not through a migration, not to fix
what looks like a typo. A correction is a new row, entered by the co-op. _This is a prohibition rather
than a Gated action because approving it one case at a time is exactly how it would become routine._

## The triage threshold

- **Triage lane** — a change confined to one file, with no rule change, no schema effect, and no new
  claim about what the product does. A typo, a dead link, copy tightened.
- **Full lane** — everything else, and always: anything touching a migration, the reminder run, the
  gate map, or a verify recipe.

_Why the boundary is blast radius and not diff size: a one-line change to a migration and a two-hundred
line docs edit are not the same risk, and a rule that sorted them by size would get the first one wrong
every time._

## The platform floor

What the platform enforces regardless of what any prompt says:

| Setting | `combcount` | `fieldnotes` |
|---|---|---|
| Direct pushes to `main` | rejected | rejected |
| Required status check | `check` | `check` |
| Required approving reviews | 1 | 1 |
| Administrators included | yes | yes |
| Force-pushes and deletion | blocked | blocked |
| `CODEOWNERS` | `migrations/` → Ana | none |

**Honest limit:** production deploy is gated by a human clicking a button in the hosting dashboard, not
by anything in this repository. Nothing here can stop a deploy, and nothing should imply otherwise.
