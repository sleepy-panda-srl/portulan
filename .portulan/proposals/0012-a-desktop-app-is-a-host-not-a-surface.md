# Proposal 0012 — a desktop app is a host, not a surface

**Status. PROPOSED, 2026-07-27 — drafted on the maintainer's directive of the same day.** Merging this
pull request adopts the **milestone-11 row** and the shape below. It does **not** settle the four
questions in [Questions for the maintainer](#questions-for-the-maintainer): those are constitutional,
`docs/vision.md` is human-owned, and no agent may answer them by building. The row lands `todo` and
**gated on those answers** — it is drafted so that a compliant v1 *is possible*, not so that one is
approved. **Numbering ruled by Marius, 2026-07-27: this is milestone 11; milestone 10 keeps its number
and nothing is renumbered.**

**The gating schedule, stated here so all three documents say the same thing: Q1 and Q2 gate opening a
milestone-11 session. Q3 rides Q2. Q4 gates the signed release rather than the session. Q5 and Q6
(proposals 0013 and 0014) block nothing.**

## The ask, in the maintainer's words

> A Desktop version of Portulan — Windows/macOS/Linux, basic to start: very similar to Claude Desktop,
> Gemini, Copilot, ChatGPT.

## The finding this proposal exists to surface

Every human-facing surface the constitution admits so far is a **renderer over the files**. A chat
application is not that. It runs an agent loop, holds a conversation, and takes turn-level actions —
it is a **host**, in the same sense Claude Code and Claude Desktop are hosts. That is a different
category from `init`, `doctor`, curation and the approval relay, and the constitution has not ruled on
it. Three clauses bear on it, and they do not obviously agree with each other:

- **`vision.md` → Non-goals → No operating cockpit.** *"no run controls"*, and then an in-bounds list
  of four named surfaces — onboarding, curation and review, `doctor` reports, the approval relay —
  *"local-first, and always renderers over the files, never a second source of truth."* A chat window
  has a stop button, an approve button and a retry button. Those are run controls. They are not *fleet*
  controls, which is what the sentence around them is plainly about — but the sentence does not say so.
- **`vision.md` → Non-goals → No operating cockpit → compose, never compete.** *"Compose with
  orchestrators (Claude Code agent teams, GitHub Agentic Workflows, Hyprlayer); never compete with
  them."* The four products named in the ask are hosts. Shipping a chat desktop app puts Portulan in
  their category.
- **`vision.md` → The thesis → 2.** *"Context layers outlive workflow machinery… Therefore: design for
  deletion — workflow stays thin."* A desktop application is the heaviest piece of workflow machinery
  this product could build, and chat-over-a-local-workspace is precisely the surface hosts are most
  likely to absorb next.

**None of these is a refusal, and this proposal does not read them as one.** Two of the three turn on a
distinction the constitution gestures at but never states: *fleet* versus *one workspace*. The
cockpit paragraph is about many runs across many repos surfaced for monitoring; a window onto a single
workspace the human is sitting in front of is the human gate with a better view of itself. But that
reading has to come from the maintainer, because the file it lives in is his.

There is precedent for exactly this failure mode, one milestone back. `core/operating/autonomy.md` now
carries a paragraph explaining that its tier examples are *illustrative, not binding*, because a session
read them as binding and spent itself handing `git push` commands to a human to type. The in-bounds list
in the cockpit non-goal has the same shape: four examples, no statement of the class. Question 1 asks
for the class.

## The shape a compliant v1 would have

Drafted so a *yes* can be built immediately and a *no* costs nothing but this document. Four properties,
each of which is a demonstration in the milestone row rather than a promise here.

**1. Files are the only source of truth.** Every state the window shows is read from the workspace tree
on disk. Every change it makes lands as a file a human can read and `git diff` can show. No app-private
database, no cloud sync, no account, no hidden state that survives deleting the folder. The app is a
renderer and a driver; the portulan is the files. _(This is the non-goal's own words, met literally.)_

**2. Deletion is survivable — and it is a test, not a promise.** Uninstall the app and the workspace
runs green from the CLI and the plugin, unchanged. This is thesis 2 turned into something a session can
fail. It does not make the app *thin*; it makes it **disposable**, which is the honest weaker claim,
and question 3 asks whether disposable is good enough.

**3. The gates hold inside the app, or the app is a hole in them.** The compiled gate policy is in force
in a desktop session exactly as in a headless one: an unapproved outward action is refused, `"done"` on
a red verify is blocked. If the desktop loop does not run the compiled gates, then milestone 4's whole
argument — that a tier is configuration rather than a sentence an agent is trusted to have read —
survives only until someone opens the friendlier window. **A surface that exempts itself from the gates
is worse than no surface**, because the gate map would still claim to describe the repository.

**4. The model is the user's.** Bring-your-own credentials, at least two providers demonstrated driving
the same loop. No Sleepy Panda service in the request path. This is `vision.md`'s *LLM-agnostic by
construction* applied to the one artifact most likely to quietly break it, and it is also what keeps the
app a **reference host** — a proof the standards work on a host we control end to end — rather than a
product competing for the seat Claude Desktop already has.

**Explicitly not in v1**, so the scope cannot drift into the thing the non-goal actually bans: no view
of more than one workspace at a time, no run history across sessions, no queue of concurrent agents, no
metrics, no charts, no remote anything. If a screen would be useful for *watching work happen* rather
than *doing or approving it*, it is out.

## Cost, stated

A cross-platform signed desktop application is the largest single build in the plan and the only one
carrying an ongoing operational tail: code signing, notarisation, an update feed, and a per-OS release
matrix that must keep working after every dependency bump. It is also the first artifact whose bugs
reach users who never read a Markdown file. **Two to three sessions is the estimate for a v1 that meets
the four properties, and it should be read as the floor, not the expectation.** The alternative shapes
in question 2 — particularly a workspace surface with no chat — cost a fraction of it and need no
constitutional change at all.

## The constitution changes this implies — drafted, never applied

`docs/vision.md` is human-owned and **no agent edits it, ever**. What follows is a redline **for Marius's
own hand**, recorded here so it is reviewable documentation rather than a line in a report, and so a
fresh-context review can be run against it. Nothing in this pull request touches `vision.md`.

**Redline A — Product identity → Delivery tiers.** Two changes: the CLI subcommand list gains the two
subcommands milestone 7 grows (`new` from
[proposal 0013](0013-the-architecture-is-extensible-the-product-is-not.md), `feedback` from
[proposal 0014](0014-a-feedback-pipe-points-out-of-the-seam.md)), and Desktop becomes a fourth tier.

**Find** — the tail of the Delivery-tiers bullet, which currently reads:

> · `index` · `upgrade`; (3) vendored
> standards mode for cloud/CI/non-Claude hosts.

**Replace with:**

> · `index` · `upgrade` · `new` (scaffold a skill, persona, pack
> or workspace) · `feedback` (file an issue from a report the user previewed); (3) vendored
> standards mode for cloud/CI/non-Claude hosts; (4) **Portulan Desktop** — a local-first surface over
> **one** workspace (macOS/Windows/Linux): curation and review, `doctor`, the gate map, approvals and
> authoring, with the files as the only source of truth and no state that survives deleting the app.

_If and only if Q2(a) is ruled in, append to tier (4):_

> It also drives a local agent loop on the user's own model credentials — a reference host, never a
> hosted service.

**Redline B — Non-goals → No operating cockpit.** **Required if Q2(a)'s chat host is built; wanted for
any desktop surface at all.** The clause bans *"run controls"* without saying across what, and names a
roster of four in-bounds surfaces without naming the class they belong to — so even the no-chat surface
of Q2(b) is in-bounds only by a reading, which is what Q1 asks him to confirm. Replace the clause with:

> - **No operating cockpit.** No fleet-management UI, no agent-monitoring dashboard, no run controls
>   **across runs, repos or agents**. Compose with orchestrators (Claude Code agent teams, GitHub
>   Agentic Workflows, Hyprlayer); never compete with them. Human-facing surfaces that serve the human
>   gate — onboarding (`init`), curation and review, `doctor` reports, the approval relay, **a desktop
>   surface over one workspace** — are in-bounds: local-first, always renderers over the files, never a
>   second source of truth, and always deletable without loss. **The line is fleet versus one
>   workspace:** watching many runs is the cockpit; doing and approving the work in front of you is the
>   gate.

_(The added final sentence is the point. The list is the illustration; the line is the rule — the same
correction `core/operating/autonomy.md` had to make after a roster was read as binding.)_

**Redline C — Non-goals → No hosted SaaS** (answers Q4). Append to the existing clause:

> Release, signing and update endpoints are outside this line — they carry bits, never workspace
> content. Anything that receives a user's context is inside it.

**Redline D — optional, and his call whether the constitution should carry it at all.** The
no-external-pull-requests ruling of 2026-07-27 currently has no home in `vision.md`, and *open-core*
unqualified reads as open-contribution. If he wants the line, the smallest one that says it, as a new
Non-goal:

> - **No external pull requests.** The engine is open to read, fork and adopt; the curated layer changes
>   through proposals and feedback, reviewed by the maintainer. *Human-curated, agent-drafted* applies to
>   strangers too.

`CONTRIBUTING.md` may well be the right and only home for this — that file is being authored by a
parallel session, and this redline should not land without reading it first.

## Questions for the maintainer

Answers wanted before a milestone-11 session opens. They are constitutional; only Marius may settle
them, and the answer to 2 may retire 1, 3 and 4 outright.

**Q1 — Is the cockpit non-goal's in-bounds list exhaustive or illustrative, and what is the class?**
Today it names four surfaces and bans *"run controls"*. A chat window has run controls over one local
loop. Proposed reading, needing his yes or his correction: **the line is fleet-versus-one-workspace** —
cockpit means many runs across many repos surfaced for *monitoring*, and a single-workspace window that
*does and approves* work is the human gate. If that is right, the non-goal wants a sentence saying so,
for the same reason `autonomy.md` needed one.

**Q2 — Is a bundled host in scope at all?** Three coherent answers:
&nbsp;&nbsp;**(a) Yes — a reference host.** The app runs its own loop, positioned as the proof that the
standards work, kept deliberately behind Claude Code in capability. Needs Q1 and probably an amended
non-goal.
&nbsp;&nbsp;**(b) No — a workspace surface with no chat and no loop.** Curate, review, `doctor`, gate
map, approvals, authoring. It hands actual work to an installed host. **It asks for no new permission
and is a fraction of the build** — it needs his confirmation of the *fleet versus one workspace* reading
in Q1 rather than a grant, since the in-bounds list does not name it either — but it is *not* what the
ask describes.
&nbsp;&nbsp;**(c) Both, staged** — (b) ships first and earns the surface; chat arrives only if (a) is
ruled in. **This is the recommendation if one is wanted**, because it makes the expensive,
constitutionally-contested half a second decision rather than a precondition, and (b) is worth shipping
on its own merits either way.

**Q3 — Does *design for deletion — workflow stays thin* survive a desktop app?** The mitigation offered
is the deletion test in property 2, which buys *disposable*, not *thin*. If hosts absorb workspace-folder
chat next year, the app is dead weight the deletion test does not prevent — it only guarantees the
customer keeps their portulan. Is disposable the standard, or does *thin* mean this is the wrong artifact
to build regardless of the cockpit question?

**Q4 — Do signing and update endpoints cross the *no hosted SaaS* line?** A desktop build needs Apple
notarisation, Windows code signing, and an update feed — Sleepy Panda-operated infrastructure the
constitution does not contemplate. Proposed distinction, wanted as a ruling: **release, signing and
update endpoints carry bits, never workspace content, and are outside the line; anything that receives a
user's context is inside it.** Worth writing into `vision.md` if he agrees, so the next session does not
re-litigate it from scratch.

**Provenance.** `form=link href=docs/vision.md` — Non-goals (*No operating cockpit*, *No hosted SaaS*) and The thesis
clause 2, read against the maintainer's directive of 2026-07-27. The precedent for the
examples-versus-class defect is `core/operating/autonomy.md` and
[`../memory/two-layers-need-two-jobs.md`](../memory/two-layers-need-two-jobs.md)'s sibling finding that a
component can read as active while being inert.

**Decision.** Marius Cetanas — pending.
