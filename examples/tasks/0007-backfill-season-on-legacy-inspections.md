# Task — backfill `season` on inspections recorded before the column existed

**Goal.** Every inspection carries the season it belongs to. Roughly 4,100 rows predate the column and
have it `NULL`, so every report currently computes their season on the fly — which is the code path that
has been wrong twice ([`../memory/the-season-starts-in-march.md`](../memory/the-season-starts-in-march.md)).

**Acceptance criteria.**

- [x] When an inspection is created, the system shall set `season` from `app/season.py`.
- [x] When a report groups by season, the system shall read the stored column and never derive it.
- [ ] When the backfill runs against every row with `season IS NULL`, it shall assign the same value
      `app/season.py` computes for that inspection's date.
- [ ] When the backfill runs a second time, it shall change nothing.
- [ ] When the backfill is running, ordinary inspection writes shall not block — batched, with the batch
      size and the pause between batches stated in the migration.
- [ ] When the backfill has completed, the `season IS NULL` count shall be zero, checked in production
      after the run rather than inferred from the batch count.

**Verify.** `migrations` for the schema half, then `service` for the report half. The backfill itself is
verified on **staging with a production-scale copy**, not on the seeded database: this task is precisely
the case
[`../memory/staging-seeds-must-be-shaped-like-production.md`](../memory/staging-seeds-must-be-shaped-like-production.md)
is about, and a timing taken on three seeded cooperatives would mean nothing.

**Constraints.** Inspections are append-only in practice; this is the rare change that writes to
existing rows, and it writes exactly one derived column, never a field a cooperative entered.
The run itself is **Gated** — it rewrites rows in every cooperative's history
([`../gate-map.md`](../gate-map.md)), so Ana approves it and a restore is tested that week.

**Context.** [`../repos/combcount.md`](../repos/combcount.md) — the repo card ·
[`../products/combcount/affordances.md`](../products/combcount/affordances.md) — what staging does and
does not prove · [`../dod.md`](../dod.md) conditions 4 and 7.

**Lane.** full — it touches a migration, which the triage threshold puts in the full lane on its own.

_(Fictional, and left deliberately **half-done**: an unticked box with the work still to do is what a
task file actually looks like most of the time it is being read. See [`../README.md`](../README.md).)_
