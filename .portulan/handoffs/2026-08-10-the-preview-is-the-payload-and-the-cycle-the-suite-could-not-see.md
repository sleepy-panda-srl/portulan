# Handoff — the preview is the payload, and the cycle the suite could not see

**Milestone 7, session 6.** Row 7's `feedback` clause and **D3** — the last demonstration on the row
that was neither blocked on the maintainer nor waiting on another clause.

## State

`main` was `159df14` at session-open and did not move. Branch
`m7-a-feedback-pipe-points-out-of-the-seam`. Suite **1187 → 1234**, both measured — the baseline on a
detached worktree at `159df14` rather than copied from the previous entry. **Ten recipes green** — nine
declared, one composed. Seam scan clean across the diff, the branch name and the paths.

## What landed

`cli/feedback.mjs` — `draft` · `preview` · `send`, dispatched by the entry point, which now builds
**seven of the eight**. The design is proposal
[`0014`](../proposals/0014-a-feedback-pipe-points-out-of-the-seam.md); the task is
[`0012`](../tasks/0012-a-feedback-pipe-points-out-of-the-seam.md), written at the session-open
checkpoint so its *Done when* list is the failing-test spec rather than a description of one.

Four properties are worth carrying forward, because each was a choice between defensible answers:

1. **The preview and the send are one `payload()` call**, so the previewed bytes are not *compared*
   with the filed bytes — they are the same bytes.
2. **The approval is bound to those bytes.** `preview` stamps a digest into the report and `send`
   refuses unless it matches. Without it, *"the exact payload the user saw first"* was a property of the
   habit: a never-previewed report filed sight-unseen and an edited one filed bytes nobody had read.
   **The pre-commit checkpoint found that**, and it is the difference between a demonstration and a
   mechanism.
3. **The payload is a closed list, not a filter.** A filter enumerates what to remove and is wrong the
   day something new arrives. The only thing this tool reads out of a workspace is `portulan.spec`.
4. **No labels.** `0014` rules the repository owns them, and dropping them also removed a
   preview-versus-actual divergence rather than documenting one: GitHub applies labels only for an actor
   permitted to set them.

**The seam scan carries no terms**, ever. It is told where a list is — `--seam-terms`, then
`$PORTULAN_SEAM_TERMS`, then `<workspace>/seam-terms.txt` — and the verdict names which answered. Hit
→ **1**. Named-and-unreadable → **2**. At the convention path **only `ENOENT` means absent**, since
`existsSync` answers false for `EACCES` and that is how #166's layer at `0400` skipped every location it
declared. **No list at all is said out loud** in the sentence the user approves, in the preview *and* in
the send: blocking every listless adopter would close the only non-browser inbound path an outside
reader has, and silence would be a green implying coverage it does not have. That last is a ruling the
maintainer should ratify rather than inherit, and `docs/milestones/m07.md` argues both readings.

## D3, run against the real API

- **The send whose exact payload the user saw first.**
  [#205](https://github.com/sleepy-panda-works/portulan/issues/205), filed from a workspace that is not
  this repository's. Filed body fetched back and compared with the previewed body: **2,046 bytes each,
  sha256 `31c0a8d4…2477472`, byte-identical**, zero CRLF and zero lone CR, zero labels.
- **The send a seam hit refused.** A report naming an **invented** company and an invented ticket
  prefix, against a list held outside every repository — exit 1, both terms named with their section,
  nothing sent.
- **Five more refusals**, each leaving the report on disk: a report nobody previewed (2), a report
  edited after its preview (2, both digests printed), an unreadable named list (2), `send` without
  `--approve` (2, printing the payload instead of filing it), a second send of an already-filed report
  (2, with the URL), and a fresh report inside the 60-second cooldown (2).

**Two real issues were filed by this session's own tool, and both stand as reports.**
[#204](https://github.com/sleepy-panda-works/portulan/issues/204) was the first run, under the build
that had not yet bound the approval to a digest; when the mechanism changed the demonstration was
**re-run rather than re-labelled**, because a demonstration of a superseded build is an assertion about
the shipped one. Both are genuine — #204 reports the roster drift this change repairs, #205 the
`none`-action finding below. **They are artifacts the maintainer may not have wanted**; closing either
costs one click, and the pre-commit checkpoint ruled the act within this session's authority
(`gates.json`'s only plausibly-covering gate scopes itself to *"someone else's tracker"*, and #150,
#196 and #203 are precedent).

## The demonstration's own seam incident

The first run's term list was called **fictional** in two records, and one of its two terms was not: a
ticket prefix picked off the top of the head collided, case-insensitively and byte for byte, with a real
entry on the private list. **The committed diff was clean** — the term lived only in a scratch
transcript — but the two sentences were false and the transcript could not be pasted anywhere.

Caught at the pre-commit checkpoint, by a supervisor that compared the demo's list against the real one
instead of reading the word *fictional*. Re-cut with terms checked against the real list **before** use
— zero hits, and the check is in the transcript — and the old transcript deleted. **Invented is a claim,
and a claim about the seam is the kind this project checks.**

## The two defects the suite could not see

1. **An import cycle that exited 13 printing nothing.** `feedback.mjs` imported `VERSION` from
   `portulan.mjs` — one carrier, correct in isolation — while `portulan.mjs` ends in `await run(…)` and
   dispatches *to* `feedback.mjs`. Neither module can settle. **Every dispatch test stayed green**,
   because they inject the loader and an injected loader never imports the real module. Caught by the
   one case that spawns the real binary, written in the same change for exactly that reason. The read
   moved to `cli/manifest.mjs`, which imports nothing of ours.
2. **The environment block silently one fact short.** The suite injects all four machine facts, so
   nothing saw that the un-injected `release` fell back to `""` and the shipped tool printed
   `System: darwin arm64`. Caught by reading the demonstration's own output.

Third and fourth instances of **a harness you write to check your own change inherits your change's
blind spot**. Both were found by running the thing, not by reading it.

## The sweeps, and why they are in this diff

Session-open returned **APPROVE-WITH-ADJUSTMENTS (13)**; pre-commit returned **APPROVE-WITH-ADJUSTMENTS
(8)**. All twenty-one were folded, and nine of them were stale carriers the checkpoints found that the
implementer's own sweep had missed.

- **The dispatch count had eight carriers and the first sweep found four.** `cli/portulan.mjs`,
  `cli/README.md`, the root `README.md`, `docs/plan.md`'s topology — then, at pre-commit,
  `plugin/skills/portulan/SKILL.md`, `CHANGELOG.md`, `.portulan/identity.md`, and the workspace's own
  repo card. The boot skill's copy carried a parenthetical saying the count *"has now gone stale three
  times"*; this was the fourth.
- **Three of those named a tool roster, and no two agreed** — `plugin-lint`/`librarian`/`discover`
  against `plugin-lint`/`librarian`/`control-chars`, with four on disk and two compiled-hook runners
  besides. `cli/README.md` is now the **one carrier** and the rest cite it —
  [`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)'s repair where the rule
  cannot be a function. `cli/portulan.test.mjs` is the one place that could not be centralised, since an
  assertion must name what it asserts; it lists all four and cites the roster.
- **Row 7's Status cell** listed `verify composition` under *Left* and said **five of six** demos while
  `docs/milestones/m07.md` recorded them delivered — the **law's** carrier the stale one. Repairing it
  took the cell to 893 bytes against a 500-byte rail, so the per-session narrative was cut back and
  m07.md is now cited from the cell. At **496 bytes** it has four bytes of headroom: **session 7 cannot
  add a clause without cutting one.**
- **`cli/README.md`'s table is seven files short**, not the eleven this session first measured — four
  of the eleven are its own and got rows. [#203](https://github.com/sleepy-panda-works/portulan/issues/203)
  owns the rest.
- **A sibling in the repo card:** *seven more recipes, all eight run in CI* — wrong since
  `control-chars` landed on 2026-08-07 and wrong again since composition. Now eight more and ten.
- `.portulan/gates.json`'s `send-something-outside-this-repository` still compiles to **nothing**, and
  the reason now says why: the refusal lives in the tool, so it holds on every host, while a `Bash(…)`
  matcher would cover one spelling of three. The gate map's *Which identity acts* gained the row and
  states that its count of three is unchanged.

## Left, and what is owed to the maintainer

`upgrade`, persona↔agent binding, legibility, clause (b) parity's adopter half, `init`'s interview, the
index rail, and **three of six** demonstrations — D1, D2, D5.

- **Proposal `0014` is still `PROPOSED` and its Q5 is still formally open.** What shipped is Q5(a), the
  user's own `gh` login, which the proposal recommends and which needs no constitutional change; Q5(b),
  a relay, is a hosted service and stays unbuilt. The Status was **not** edited here — that is his
  ruling to record, not an implementer's.
- **The listless-send policy wants ratifying.** Row 7 says *"seam-scanned before it leaves the
  machine"*, which bears a stricter reading — no list, no send. What shipped states the coverage instead
  of blocking, and both checkpoints endorsed it. It is his to ratify at the merge gate.
- **The feed pin has not moved.** D5 requires the real install and cannot be graded demonstrated while
  it stands still. The act is his.
- **#167's retrospective supervisory pass** is still owed and gates the close rather than the sessions.
- **`BOOTSTRAP.md` is itself a stale carrier**, flagged by the pre-commit checkpoint: it calls pushes
  gated, while `.portulan/gates.json` — merged, and the living policy — makes `push-a-working-branch`
  **Auto** and `open-a-pull-request` **Propose**. The file is untracked and his; noted rather than
  edited.
