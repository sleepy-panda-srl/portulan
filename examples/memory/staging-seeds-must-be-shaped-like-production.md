**type:** rule
**scope:** workspace — anyone judging a query or a migration by how it behaves on staging
**provenance:** `form=sealed` `owner=Ana` `date=2026-03-18` `shape=a migration adding an index was timed on a seeded staging database of a few hundred rows and took under a second; the same migration against a customer's real table took an exclusive lock for several minutes during their working morning. The obvious guard misses it because the migration was correct, reversible, reviewed, and green — nothing about the change was wrong, only the database it was measured against`

A measurement taken on staging tells you nothing about production unless the staging data is shaped like
production: same order of magnitude, same skew, same worst-case row. Timing, query plans, and lock
duration are all properties of the data, not of the statement.

**Why it is sealed rather than linked:** the incident happened inside one cooperative's own database
during their working hours, and the details — who, when, what it cost them — are theirs and not ours to
publish. The rule generalises; the episode does not travel. What is recorded above is the mechanism and
enough of the failure shape that somebody who never saw it can still write the test: seed a table to
production scale, run the migration, measure the lock.

**Why it holds beyond the one incident:** every check Rooftop owns runs against a small, tidy database.
`make check-migrations` uses an *empty* one. So the entire verification stack is blind to this class of
failure by construction, and no amount of green says otherwise — which is precisely why the rule has to
live in memory rather than in a test.

**When to apply:** before quoting any duration, plan, or lock estimate from staging; and before
approving a Gated migration. The answer to "how long will this take in production" is never "it was fast
on staging".

Related: [`the-reminder-run-must-be-idempotent.md`](the-reminder-run-must-be-idempotent.md) — the other
rule minted from an incident rather than stated in advance.

**Retire when:** staging is seeded from a scrubbed production snapshot at production scale, at which
point the measurement becomes meaningful and this rule becomes redundant. That is on the list and has
been for a year.

_This entry is also here to show what a sealed stamp looks like in use. `doctor` validates its **form**
— owner, date, and a failure shape — and can never validate its **truth**: a fabricated stamp passes
exactly as this one does. What guards the content is review, and the bar that a generic rule must not
decay into a vague one._
