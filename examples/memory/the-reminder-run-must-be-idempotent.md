**type:** rule
**scope:** workspace — anyone touching `app/jobs/` in `combcount`
**provenance:** `form=link` `href=https://git.example.com/rooftop/combcount/pull/214`
— the night a worker restart mid-run mailed 31 cooperatives their overdue-inspection reminder a second
time, four minutes after the first. Two secretaries replied asking which one was correct.

Anything the reminder run does must be safe to do twice. A task that cannot be re-run is not finished;
it is a task with an outage scheduled in it.

**Why it holds:** the run is a Celery task on a worker we restart for ordinary reasons — a deploy, a
memory limit, a Fly.io host move. "It will not run twice" is a claim about infrastructure we do not
control, made by three people who do not operate a scheduler. The only version of this we can actually
guarantee is the one where running twice is harmless. The cost of the alternative is not a duplicate
email; it is a volunteer who now distrusts every message we send, at the exact moment we need them to
act on one.

**When to apply:** any change to `app/jobs/`, and any new job. The test is concrete — write down what a
second execution with the same inputs does, and the answer must be "nothing". If it is "it depends on
timing", the job is not done.

Enforced by a test rather than remembered: `tests/jobs/test_reminders.py` runs the task twice and
asserts one mail. **What that test does not cover** is whether the *recipient query* is right — running
the wrong list twice idempotently still mails the wrong list. That gap is stated in
[`../products/combcount/affordances.md`](../products/combcount/affordances.md) rather than left for
somebody to assume away.

**Retire when:** the job layer moves to a scheduler with exactly-once delivery we actually trust, or the
reminder stops being an outbound message to a human. Neither is close.
