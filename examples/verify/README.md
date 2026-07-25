# Verify recipes — Rooftop

> The executable half of "done". Core defines the hierarchy — *it compiles < the tests pass < the
> behaviour was exercised* — and a workspace supplies the recipes, because what "green" means is a
> property of the repository. _(Fictional. See [`../README.md`](../README.md).)_

## The recipes

Three, declared in [`../workspace.json`](../workspace.json), which is also where the **default** is
named — `service`, the one the Stop-gate runs when nothing more specific applies.

| Recipe | Runs | Covers | Needs |
|---|---|---|---|
| `service` — default | `make check` | lint · types · unit tests · migration check, in that order, stopping at the first failure | `make`, `python`, `docker` |
| `site` | `npm run check` | the Astro build, and a link check across the content | `node` |
| `migrations` | `make check-migrations` | every new revision applies and reverts against an **empty** database | `make`, `python`, `docker` |

Exit `0` green · `1` red · `2` could not run. That third code is why each recipe declares what it needs
rather than discovering it: a recipe that *could not run* must never be mistaken for one that ran and
passed. `make check` without Docker running is the case we hit weekly.

## Why `migrations` is a recipe of its own

It is already the last stage of `make check`, so a separate recipe looks redundant. It is not: the repo
card can point a *task* at `migrations` alone, which is what makes a migration-only change cheap to
iterate on — and, more importantly, it makes the migration check a thing that can be named, required,
and argued about separately from "the tests". With three people and one database, the migration check is
the one standing in for a second reviewer ([`../principles.md`](../principles.md)); burying it inside a
general recipe would make it easy to weaken by accident.

## Where this sits in the hierarchy — honestly

`service` reaches the middle rung: real tests, real assertions, run against a real Postgres in Docker.
It does not reach the top. Nothing here exercises the deployed behaviour — no smoke test against
staging, no synthetic check against production — so "green" means *these tests passed on this branch*,
never *the service works*.

`site` is lower still: it proves the site builds and its links resolve. It cannot tell whether a
compliance page is correct, which is the only way that repository can be badly wrong. Condition 6 of
[`../dod.md`](../dod.md) is a human standing in for the check that cannot exist.

## Known limits

- **`check-migrations` uses an empty database.** It catches a migration that will not apply or will not
  revert. It cannot catch one that takes a four-minute lock on a real table — the failure recorded in
  [`../memory/staging-seeds-must-be-shaped-like-production.md`](../memory/staging-seeds-must-be-shaped-like-production.md),
  and the reason destructive migrations are Gated rather than merely tested.
- **The job layer is thinly covered.** One idempotency test and no recipient-filter test. Stated in
  [`../products/combcount/affordances.md`](../products/combcount/affordances.md) rather than left to be
  inferred from a green run.
- **No recipe touches production.** Deliberate, and it means there is no check anywhere that would
  notice a bad deploy. The deploy gate is a human in a dashboard
  ([`../gate-map.md`](../gate-map.md)).
- **Nothing here can run in this repository.** Rooftop's repositories are fictional. These are
  declarations, and the Portulan repository's `doctor` never executes a workspace's recipes in any case
  — that is the Stop-gate runner, milestone 4.
