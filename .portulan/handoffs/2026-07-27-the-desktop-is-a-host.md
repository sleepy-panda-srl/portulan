# Handoff — planning the Desktop, user extensibility, and the feedback sender

**State.** Planning only; **nothing was built and no milestone advanced**. One pull request carries three
proposals ([`0012`](../proposals/0012-a-desktop-app-is-a-host-not-a-surface.md),
[`0013`](../proposals/0013-the-architecture-is-extensible-the-product-is-not.md),
[`0014`](../proposals/0014-a-feedback-pipe-points-out-of-the-seam.md)), two tasks
([`0008`](../tasks/0008-a-declared-skills-path-sees-one-level-down.md),
[`0009`](../tasks/0009-the-walk-reports-on-files-git-does-not-track.md)) for defects found while reading,
a new **milestone 11** row, amendments to rows **6, 7 and 10**, the sequencing-rationale sentence, and
this handoff. `docs/vision.md` is **untouched** — the constitutional changes the plan implies are drafted
as an exact redline inside proposal 0012, for the maintainer's own hand.

**One gating rule, stated once because it was stated three ways before review caught it: Q1 and Q2
gate opening a milestone-11 session. Q3 rides Q2. Q4 gates the signed release, not the session. Q5 and
Q6 block nothing.**

**Decisions + why.**

- **Milestone 11, not a renumber** — because the maintainer ruled it mid-session: milestone 10 keeps its
  number. The question of insert-versus-renumber was dropped rather than answered by this session.
- **The row is drafted as gated rather than as approved** — because a chat application runs an agent
  loop and takes turn-level actions, which makes it a **host**, and every human-facing surface the
  constitution admits so far is a *renderer over the files*. That is a category `vision.md` has not
  ruled on. Alternatives considered: drafting the row as ordinary work (rejected — it would settle a
  constitutional question by building), and refusing to draft it until the questions are answered
  (rejected — the maintainer asked for a plan, and the questions are sharper with a concrete row
  beside them).
- **Four demonstrations in the exit criterion, one of which is the deletion test** — because *design for
  deletion — workflow stays thin* cannot be met by a desktop application in the literal sense, and
  saying so is better than pretending. Uninstall-and-the-workspace-still-runs buys **disposable**, not
  **thin**; the row claims the weaker thing on purpose and Q3 asks whether it is enough.
- **The gates must hold inside the app, stated as a demonstration** — because a friendlier window that
  exempts itself from the compiled gates would make the gate map a false description of the repository,
  one milestone after the compiler was built to stop exactly that.
- **Extensibility lands in existing rows (6, 7, 10) rather than in a new milestone** — because the
  cascade is already the architecture; what is missing is the product surface. The pack manifest goes to
  6 because that is where a pack is first *resolved* and `doctor` already points there; `new` and the
  validation go to 7; the docs page to 10; the rendered surface to 11.
- **The pack tighten-only floor is cited, not re-proposed** — because proposal
  [`0010`](../proposals/0010-prohibited-as-a-fourth-universal-tier.md) already records *"Packs may
  contribute gate rules, tighten-only"* as agreed by Marius on the same day. Drafted first as a fresh
  proposal; corrected at review, because re-deciding a settled ruling is how a record starts disagreeing
  with itself. What is left to add is only that the manifest be shaped so the rule is **checkable**.
- **The feedback report is a file before it is a request, and sending is Gated** — because the sender is
  a pipe from a private workspace into a permanent public record. The file buys the preview, the offline
  queue and the local record in one move; the Gated tier is what `autonomy.md` already says about
  outward actions. No silent send, no crash reporter, no default-on diagnostics checkbox.
- **The user's own GitHub identity files the issue (recommended, Q5a)** — because it makes abuse limits
  and accountability GitHub's problem rather than a service we would have to operate, and `vision.md`
  permits exactly one hosted service by name.

**Open questions.** All are the maintainer's; the numbering matches proposals 0012, 0013 and 0014.
- **Q1** — is the cockpit non-goal's in-bounds list exhaustive or illustrative, and is the line *fleet
  versus one workspace*? **Q2** — is a bundled host in scope at all: (a) reference host, (b) workspace
  surface with no chat, (c) staged, (b) then (a)? **Q3** — does *design for deletion* survive a desktop
  app, i.e. is *disposable* the standard? **Q4** — are signing and update endpoints outside *no hosted
  SaaS*? **Q5** — whose identity files a feedback issue, and is the relay exception a name or a class?
  **Q6** — do workspace-local skills and personas get slots, or must everything be a pack?
- Redlines **A–D** in proposal 0012 are drafted but **not applied**. `vision.md` is human-owned; redline
  D (no external pull requests) may belong only in `CONTRIBUTING.md`, which a parallel session owns.

**Next action.** Marius answers Q1 and Q2. Under **Q2(b)** or **Q2(c)** a workspace-surface session can
open as soon as Q1 confirms the *fleet versus one workspace* reading — that is a sentence from him, not a
new permission, and redline B is wanted rather than required. Under **Q2(a)**, redlines A and B land in
`vision.md` in his own hand, with a fresh-context review, before any session opens.

**Recoverability.** Nothing is in a partial state. No file outside this pull request was modified, no
milestone status changed, no criterion ticked, nothing merged, and the parallel session's files
(`.github/ISSUE_TEMPLATE/`, `CONTRIBUTING.md`, the tier-model work) were not touched. Reverting the pull
request removes the plan rows and the proposals together and leaves the tree exactly as it was at
`b9722da`.

**Known defects found while reading, filed as
[`../tasks/0008-a-declared-skills-path-sees-one-level-down.md`](../tasks/0008-a-declared-skills-path-sees-one-level-down.md)
and [`../tasks/0009-the-walk-reports-on-files-git-does-not-track.md`](../tasks/0009-the-walk-reports-on-files-git-does-not-track.md)
rather than fixed** — both would meet the first real author of a skill or pack, and neither is a planning
question: skill resolution in `cli/plugin-lint.mjs` is one
level deep (a declared root resolves `root/SKILL.md` or its immediate child directories and nothing
below), so a pack cannot ship skills under a single declared path; and the same file's walk consults no
`.gitignore`, so every worktree copy under `.claude/` adds a full set of false *undeclared skill* notes —
72 in the maintainer's checkout when this was written, a figure that moves with the worktree count, which
is why the mechanism rather than the number is the finding.
