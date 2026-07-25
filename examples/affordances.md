# Agent affordances — any Rooftop repository

> The **workspace-level default** for the agent-affordances slot: what an agent can rely on in either
> Rooftop repository, and — just as load-bearing — what it must not assume. A product may override this
> with its own; [`products/combcount/affordances.md`](products/combcount/affordances.md) does, and
> `fieldnotes` inherits this file unchanged. _(Fictional. See [`README.md`](README.md).)_

## What an agent can rely on, anywhere here

| Affordance | Where | The contract |
|---|---|---|
| A single entry command | `make check` (service) · `npm run check` (site) | One command per repository runs everything CI runs. If it passes locally it passes in CI, and a divergence is a bug in the command, not in your machine. |
| The domain glossary is binding | [`identity.md`](identity.md) | Co-op, hive, inspection, season. Naming is settled by that table in review, not by argument. |
| A repo card per repository | [`repos/`](repos/) | Build, test, run, gates, layout, and the quirks nobody can infer from the tree. |
| Rules carry their incident | [`memory/`](memory/) | Every rule states why it holds, when it applies, and the condition under which it stops being true — so it can be judged, not just obeyed. |
| `main` is protected in both repos | [`gate-map.md`](gate-map.md) | Direct pushes rejected, one approving review, required check green, administrators included. |
| Conventional commits | both | `type(scope): subject`. The changelog is generated from them, so the subject line is user-facing text. |

## What an agent must not assume

Written at the same level of detail, because a list of only strengths is marketing.

- **There is no staging for `fieldnotes`.** Preview builds exist per pull request; there is no
  long-lived environment. Anything that needs one needs `combcount`.
- **Tests are not evenly distributed.** The service's API layer is well covered; the Celery tasks are
  covered by three tests written after the incident in [`memory/`](memory/) and nothing else. Green
  means *these* tests passed, and on the job layer that is a weak claim.
- **CI does not run migrations against a production-shaped database.** It runs them against an empty
  one. This is the known gap that the `migrations` recipe only partly closes.
- **Nothing here stops a deploy.** Production deploy is a human clicking a button in a dashboard, and
  no rule in this repository reaches it.
- **The reminder run's recipient query is not covered by a test that would catch a wrong filter.** It is
  covered by an idempotency test, which is a different thing, and the distinction has been confused
  before.
- **`make check` does not lint the docs site's content**, only its build. Prose is read by a person or
  not at all.
- **There is no rollback automation.** Condition 4 of [`dod.md`](dod.md) requires a rollback to have
  been *run*, by hand, on staging. If a document ever implies a one-command rollback, that document is
  wrong.
