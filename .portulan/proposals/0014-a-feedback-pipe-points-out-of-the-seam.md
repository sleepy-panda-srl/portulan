# Proposal 0014 — a feedback pipe points out of the seam

**Status. ACCEPTED 2026-08-10, with Q5 ruled (a).** The channel, named rather than left to be inferred:
the maintainer's **close-out instruction on milestone 7 session 6's maintainer items**, given once the
CLI half was built and D3 demonstrated, and **ratified by his merge of
[#206](https://github.com/sleepy-panda-works/portulan/pull/206)** — the pull request that carries this
record. That is the `0020` pattern: the drafting is the implementer's, the ratification is the merge,
and the merge is also where he corrects a record that read more into the instruction than it held.

_Proposed 2026-07-27, on the maintainer's directive of the same day. Everything below the ruling is left
**exactly as drafted** — except the Decision line, which existed to be filled and has been. A proposal
records what was argued when it was argued, and editing the argument to match its own outcome destroys
the record that makes the outcome legible._

This is the **product-side sender**. The repository-side half — the issue forms under
`.github/ISSUE_TEMPLATE/` and `CONTRIBUTING.md` — is being built by a parallel session and is **not
touched here**; this proposal names it as a dependency and nothing more. One question (Q5) is
constitutional and is left to the maintainer.

## The ruling on Q5, 2026-08-10

**(a): the user's own GitHub identity, through an existing `gh` login.** Accountable, rate-limited by
GitHub, no Sleepy Panda service in the path — which is what makes it compliant with the constitution as
it stands rather than requiring a change to it. That is what `cli/feedback.mjs` ships: it shells out to
whatever `gh` is logged in, mints no identity of its own, and refuses with exit **2** when `gh` is
absent or unauthenticated rather than finding another way out.

**(b) is not taken up.** Said that way rather than *refused*, because the maintainer's words were
"stays unbuilt" and a refusal reaches a question he did not reach. What is recorded is narrower and
checkable: a Sleepy Panda-operated relay is a hosted service, `docs/vision.md` **as written** permits
exactly one by name, so building one would need a change to the constitution, **no such change is being
made, and it stays unbuilt.** _Deliberately not grounded on "the constitution forbids it": that ground
would presuppose the answer to the second question below — whether the relay exception is a name or a
class — which this same ruling leaves open. A rule defended on a ground that can move is a rule that
gets defended on the wrong one._

**What (a)-only costs, as a consequence rather than as part of the ruling:** someone without a GitHub
account cannot use this sender. That follows from shipping (a) and nothing else; it is not something the
maintainer weighed and accepted here, and recording it as such would put words in the ruling.

**The second question, left open on purpose.** The draft asked whether the relay exception is *a single
named thing* or *a class — self-hostable-first relays*. It is not answered here, because nothing turns
on it until a second relay is actually wanted, and settling a constitutional category in the abstract is
how a category gets settled wrongly. It stays a live question in `docs/vision.md`'s terms.

**What the ruling does not cover.** No OAuth device flow — the draft names it beside an existing `gh`
login and only the second shipped; a device flow is a second identity path and would be its own
decision. And the desktop half of this proposal is milestone 11's, unbuilt, and unaffected by this
ruling except that it inherits the same answer to Q5.

## The ask, in the maintainer's words

> In-product *send feedback / bug / suggestion*, from CLI and Desktop, that auto-creates GitHub issues.

## Why this matters more than it looks

The maintainer ruled on 2026-07-27 that **this repository accepts no external pull requests** —
outside participation is proposals and feedback only. That ruling makes this sender **the only inbound
path a user has**. It is not a convenience feature bolted onto two surfaces; it is the entire external
contribution mechanism, and it should be designed as one: the quality of what arrives here is set by
what this thing lets a user send.

## The finding this proposal exists to surface

**A feedback sender is a pipe from a private workspace into a permanent public record.** The repository
is public and its history is permanent. The workspace the user is sending from may be a company's — full
of repo names, paths, product identifiers, gate maps and memory entries. `docs/plan.md` → Protocol → The
seam exists because this product's own build treats exactly that leakage as unacceptable, and the seam
scan runs before every commit here.

The sender points the other way through the same wall. Everything below follows from that one sentence.

## The design

**What it sends — three parts, and nothing else.**

1. **The user's own words** — a title and a body they typed.
2. **A structured environment block**: Portulan version, spec version, host and version, OS and
   architecture. If the report was started from a failure, the failing recipe's **id and exit code** —
   the id is a slug and the code is an integer.
3. **Nothing else.** Not recipe *output*, which carries paths and file contents. Not the workspace name,
   repo names, file paths, gate map, memory, git remote, branch names, or any identifier of the user
   beyond the GitHub account they authenticate with.

**The report is a file before it is a request.** `portulan feedback` writes
`.portulan/feedback/<date>-<slug>.md` and opens it for editing. What gets sent is a file the user can
read, diff and delete. This is the same files-as-source-of-truth rule the rest of the product lives
under, and it pays for itself three times: the preview is just the file, offline queueing is just the
folder, and the record of what was sent is a local artifact rather than a claim.

**Sending is Gated, per `core/operating/autonomy.md`** — outward-facing, explicit human approval, per
action. Concretely: **no silent send, no background telemetry, no send-on-crash, and no *include
diagnostics?* checkbox that defaults to on.** The user sees the exact bytes and presses the button. A
send that happens without that is this product violating its own gate model in the one place users can
see it.

**The workspace's own seam scan runs on the payload before the preview appears.** The mechanism exists
and the term list lives in the user's private context, which is exactly where it should stay — Portulan
never sees it. A hit blocks the send and names the term. This turns our internal discipline into a
product feature, which is the strongest form of dogfooding available here.

**Rate and abuse limits come from the identity, not from a limiter we operate.** Because the sender uses
the user's own GitHub identity (Q5 below), GitHub's abuse limits apply and every issue is attributable
to an accountable account. There is no anonymous firehose into a public tracker, and there is nothing
for Sleepy Panda to run, meter or pay for. Local guards only: a report file records its issue URL once
sent, so re-sending is a no-op, and a short cooldown catches a loop.

**Offline queueing is the folder.** Unsent drafts sit in `.portulan/feedback/`. Nothing auto-sends on
reconnect: the Gated approval is per-action and does not survive going offline, so a queued draft is
re-approved when it is actually sent. _(A queue that flushes itself when the network returns is a silent
send with extra steps.)_

**The repository-side dependency.** The issue forms the parallel session is authoring are what give this
structure — the sender fills a form, it does not compose free-form issue bodies. Field names must match;
that agreement is the integration point and belongs in a task when both halves are real.

## Where it lands

Not its own milestone. It is one small feature of two surfaces, and it ships with each: a clause in
**milestone 7** (`portulan feedback` in the CLI) and in **milestone 11** (the Desktop sender), each
demonstrating the same two things — **a payload the user saw before it left the machine, and a seam scan
that blocks a send it should block.**

## What this deliberately does not do

- **No telemetry.** Opt-in OTel is milestone 8 and a separate mechanism with separate consent. This
  sender transmits only what a human typed and approved, once, per report.
- **No crash reporter.** An automatic uploader is precisely the silent-send shape ruled out above.
- **No attachments, no screenshots, no log bundles** in v1. Every one of them is an unbounded channel
  through the wall this proposal is about; if they are ever wanted, they are their own decision.
- **No issue triage, labelling or routing from the client.** The repository owns its own labels.

## Question for the maintainer

**Q5 — Whose identity files the issue, and is a relay permitted?** Two options:
&nbsp;&nbsp;**(a) The user's own GitHub identity** (OAuth device flow, or an existing `gh` login).
Accountable, rate-limited by GitHub, no Sleepy Panda service in the path, **fully compliant today**.
Cost: the user needs a GitHub account. **This is the recommendation.**
&nbsp;&nbsp;**(b) A Sleepy Panda-operated relay** that files on the user's behalf. Serves people without
GitHub accounts — and it is a hosted service. `vision.md` permits exactly one, the approval relay, by
name. So (b) needs a constitutional ruling, and it also inherits an abuse surface we would then have to
operate.
A second question rides along if he wants (b) ever: **is the relay exception a single named thing, or a
class — *self-hostable-first relays*?** Written as a name today. That wording is doing more work than it
looks like it is.

**Provenance.** `form=link href=docs/plan.md` — Protocol → The seam, and `core/operating/autonomy.md` → the Gated tier,
read against the maintainer's directive and the no-external-pull-requests ruling of 2026-07-27.

**Decision.** Marius Cetanas — **accepted 2026-08-10, on option (a)**; (b) not taken up and unbuilt.
Given as the close-out instruction on milestone 7 session 6's maintainer items and ratified by his merge
of [#206](https://github.com/sleepy-panda-works/portulan/pull/206); the argument is in *The ruling on Q5*
above, including the one question this deliberately leaves open.

**Pull request:** [#52](https://github.com/sleepy-panda-works/portulan/pull/52) — the change that filed this.
