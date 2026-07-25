# Repo — combcount

**What it is.** The hive-records service: FastAPI over PostgreSQL with a Celery worker, deployed to
Fly.io. Blast radius is every cooperative's inspection history, which is the record their local
authority reads. _(Fictional. See [`../README.md`](../README.md).)_

**Build / test / run.**
- build: `docker compose build`
- test: `make check` — lint, types, unit tests, then the migration check; stops at the first failure
- run: `make up` then `make seed`, and the API is on `localhost:8000`

**Gates.** Inherits [`../gate-map.md`](../gate-map.md). Two worth keeping in front of mind: a migration
that drops or rewrites a column is **Gated**, and *any* query against production is Gated including a
read, because there is no replica and a read that takes a lock is not read-only in the sense that
matters.

**Layout.** `app/` the API · `app/jobs/` the Celery tasks · `migrations/` Alembic revisions, owned by
Ana via `CODEOWNERS` · `tests/` · `Makefile` the single entry point.

**Quirks.**
- The season starts in **March**. Anything bucketing by year without going through `app/season.py` is
  wrong, and it will look right for nine months.
- Inspections are append-only in practice but not by constraint — the database will happily let you
  `UPDATE`. The rule is in [`../principles.md`](../principles.md) and nothing enforces it.
- `make check` needs Docker running. It fails with a confusing SQLAlchemy error rather than a clear one
  when Docker is not up; that is a known rough edge nobody has fixed.
- The reminder run is idempotent by design — see
  [`../memory/the-reminder-run-must-be-idempotent.md`](../memory/the-reminder-run-must-be-idempotent.md).

**Provenance.** Written when Rooftop adopted Portulan. Rewrite it if the job layer moves off Celery,
which has been discussed twice and not decided.
