# Agent affordances — Combcount

> **Overrides** the workspace-level default at [`../../affordances.md`](../../affordances.md). Read this
> instead of that one when working on Combcount — the more specific layer wins, as it does everywhere in
> the cascade. The override exists because a deployed, stateful service offers an agent handholds a
> static site does not, and carries hazards a static site does not have.
> _(Fictional. See [`../../README.md`](../../README.md).)_

## What an agent can rely on here

| Affordance | Where | The contract |
|---|---|---|
| `make check` runs everything CI runs | repo root | Lint, types, unit tests, and the migration check, in that order. Fails on the first failing stage. |
| A disposable local stack | `make up` | Postgres and Redis in Docker, torn down with `make down`. Nothing local ever points at a shared database; the connection string has no production form. |
| A seeded development database | `make seed` | Three cooperatives, one mid-season, one dormant, one with a hive whose inspections span a season boundary — the case that has broken date bucketing twice. |
| A staging environment | `fly deploy -a combcount-staging` | Real shape, fake co-ops. This is where a rollback is *run* before condition 4 of [`../../dod.md`](../../dod.md) is satisfied. |
| Migrations are reversible by contract | `migrations/` | Every migration has a `downgrade`. `make check-migrations` applies and reverts each new one against an empty database. |
| An OpenAPI document generated from the code | `/openapi.json` | Generated, never hand-edited. If it disagrees with the handlers, the handlers are right and the document is stale — regenerate rather than patch. |
| Structured logs with a co-op id on every line | hosted logs | Enough to answer "what happened to this cooperative" without a debugger. |

## What an agent must not assume

- **`make check-migrations` does not prove a migration is safe.** It applies and reverts against an
  **empty** database. It cannot catch a rewrite that takes an exclusive lock for four minutes on a table
  with two hundred thousand rows, and that is exactly the failure that put destructive migrations in the
  Gated tier ([`../../gate-map.md`](../../gate-map.md)).
- **`downgrade` existing is not `downgrade` having been run.** The check proves it executes on an empty
  schema. Condition 4 of [`../../dod.md`](../../dod.md) is the one that requires it on staging, by hand,
  with data in the tables.
- **The Celery tasks are thinly tested.** See
  [`../../memory/the-reminder-run-must-be-idempotent.md`](../../memory/the-reminder-run-must-be-idempotent.md).
  There is an idempotency test and there is not a recipient-filter test; do not read the first as the
  second.
- **Staging's data is not production-shaped.** It is seeded, and the seed is smaller and tidier than any
  real cooperative — see
  [`../../memory/staging-seeds-must-be-shaped-like-production.md`](../../memory/staging-seeds-must-be-shaped-like-production.md).
  A query that is fast on staging tells you almost nothing.
- **There is no read replica.** Every query an agent proposes runs against the primary, which is why
  even a read against production is Gated.
- **Nothing rate-limits outbound mail.** The reminder run's safety is idempotency and the Gated tier,
  not a quota. There is no mechanism that would stop a loop.
