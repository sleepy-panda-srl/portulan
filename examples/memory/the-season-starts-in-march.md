**type:** rule
**scope:** workspace — anyone bucketing, filtering, or reporting by time in `combcount`
**provenance:** `form=link` `href=https://git.example.com/rooftop/combcount/pull/151`
— the second time a report grouped inspections by calendar year. The first time was caught in review;
this one shipped, and a cooperative's annual return was short by every inspection recorded in January
and February.

The reporting season starts on **1 March**. Every date bucket goes through `app/season.py`; nothing
computes a year from a timestamp directly.

**Why it holds:** the bug is invisible for nine months of the year. Group by calendar year in April and
the numbers look correct, because the difference only appears once the season boundary is inside the
range you are looking at. That is what makes it worth a rule rather than a code review comment — the
usual defence, "someone would notice", is empirically false here, twice.

**When to apply:** any query, report, export, or test fixture involving a date range. The concrete test:
if the code contains a year derived from a timestamp without `season.py` in the call, it is wrong even
if the output currently looks right.

Enforced partly rather than fully: a lint rule flags `\.year` on a datetime in `app/`, which catches the
obvious spelling and not the arithmetic one. The seeded development database includes a hive whose
inspections span a season boundary, which is the case that makes the failure visible locally.

Related: [`staging-seeds-must-be-shaped-like-production.md`](staging-seeds-must-be-shaped-like-production.md)
— also a rule about what a small tidy dataset fails to show you.

**Retire when:** the domain stops having a season, which would mean the regulator changed the reporting
year. If that happens this rule should *move* to the new boundary rather than be deleted.
