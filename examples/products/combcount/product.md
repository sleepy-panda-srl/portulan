# Product — Combcount

> The **product layer** for one product: mission, what it is, why it exists. Short and pointer-heavy on
> purpose — the working orientation an agent needs before it can judge whether a change serves the
> product. _(Fictional. See [`../../README.md`](../../README.md).)_

**Mission.** Let a volunteer with cold hands and one bar of signal record a hive inspection in under
thirty seconds, and let their cooperative produce the year's compliance report without anybody
retyping anything.

**What it is.** A Python service — FastAPI over PostgreSQL, with a Celery worker for the nightly
reminder run — serving a mobile web client and a small number of cooperative administrators. Deployed
to Fly.io, one database per environment. Roughly nine thousand inspections a year across forty
cooperatives.

**Why it exists.** The alternative most cooperatives use is a shared spreadsheet, and the failure mode
is not that it is inelegant: it is that the season's records are one accidental sort away from being
useless, and the person who notices is an inspector. What we sell is the record being *there*, in order,
a year later.

**Why the shape is what it is.** Append-only inspections, a season that starts in March, and reminders
that are safe to send twice all come from the same place — the customer is a volunteer rota, not a
company. People forget, hand over, and re-enter. The system assumes that rather than punishing it.

**Stage, honestly.** In production with paying cooperatives since 2025. The API layer is stable; the
job layer is where the last two incidents came from, and
[`affordances.md`](affordances.md) says plainly which parts of it are not covered by tests.
