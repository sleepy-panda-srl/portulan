# Identity — Rooftop

> The **identity slot**: who this team is and what it works with — the first thing an agent reads after
> the kernel. Identity is policy: it is what makes an agent work *our* way rather than generically.
> How we decide is [`principles.md`](principles.md); what we are building is in
> [`products/`](products/). _(Fictional. See [`README.md`](README.md).)_

## Who

**Rooftop** — three people building software for urban beekeeping cooperatives: Ana (backend, also the
only one who has ever run a migration in anger), Dov (frontend and docs), Priya (part-time, ops and
support). No dedicated QA, no dedicated ops, no on-call rota. Ana reviews Dov's work and Dov reviews
Ana's; Priya reviews neither and merges neither.

That shape drives more of our policy than the stack does, and it is worth being blunt about the
consequence: **there is no second reviewer for the database.** Anything Ana writes against the schema
has, in practice, one pair of eyes on it. Half the rules below exist to put a machine where a second
reviewer would be.

Our customers are cooperatives with between four and two hundred hives, mostly volunteer-run. They are
not technical, they call us on the phone, and their data is the record their local authority inspects.
Losing it is not an outage, it is a compliance problem for someone who trusted us.

## What we build

Two products, deliberately unlike each other:

- **[Combcount](products/combcount/product.md)** — the hive-records service. Deployed, stateful, has a
  staging environment and a migration story.
- **[Fieldnotes](products/fieldnotes/product.md)** — the public documentation and compliance-guidance
  site. Static, stateless, ships on merge.

They share a team, a review culture, and almost nothing else operationally. That is why
[`affordances.md`](affordances.md) is the workspace default and
[`products/combcount/affordances.md`](products/combcount/affordances.md) overrides it: one honest answer
does not cover both.

## Stack

| Layer | What | Where |
|---|---|---|
| Service | Python 3.12, FastAPI, SQLAlchemy, Alembic migrations | `combcount` |
| Database | PostgreSQL 16, one instance per environment | `combcount` |
| Jobs | Celery + Redis, for the nightly inspection-reminder mail | `combcount` |
| Site | Astro, Markdown content, no client-side JavaScript beyond search | `fieldnotes` |
| CI | GitHub Actions; required checks on `main` in both repositories | both |
| Hosting | Fly.io for the service, Netlify for the site | both |

**What is deliberately absent:** no Kubernetes, no service mesh, no feature-flag platform, no
observability vendor beyond hosted logs. Three people cannot operate what they cannot debug at 9pm, and
every one of those would be a system whose failure modes nobody here has seen.

## Glossary

Words that mean something specific here. Ambiguity in these is what has cost us most.

| Term | Meaning |
|---|---|
| **Cooperative** (or **co-op**) | A customer. Never "tenant", never "org" — the domain word is the one support uses on the phone, and matching it stops translation errors in tickets. |
| **Hive** | The unit a co-op counts. A co-op has many; an inspection belongs to exactly one. |
| **Inspection** | A dated record against a hive. Append-only in practice: corrections are new rows, never edits, because the authority reads the history. |
| **Season** | The reporting year, which starts in March, not January. Every date-bucketing bug we have shipped came from someone assuming otherwise. |
| **Reminder run** | The nightly job that mails co-ops with overdue inspections. Idempotent by design; the failure that taught us why is in [`memory/`](memory/). |
| **Green** | The product's verify recipe exited `0` on this branch, not "CI looks fine". |
| **Shipped** | Merged *and* deployed. `fieldnotes` ships on merge; `combcount` does not, and conflating the two has caused two support incidents. |
