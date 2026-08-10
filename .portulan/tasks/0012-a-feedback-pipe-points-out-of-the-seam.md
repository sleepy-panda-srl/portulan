# Task 0012 — `feedback` files an issue from a report the user previewed

**Lane:** full · **Opened:** 2026-08-10, milestone 7 session 6, at the session-open checkpoint
**Verify recipe:** `tests` · **Status:** IN PROGRESS, 2026-08-10, milestone 7 session 6

> Scoped the way [`0011`](0011-vendor-carries-the-residence-switch.md) was: the blocking question is
> named and answered before a line is written, so the *Done when* list below is the failing-test spec
> rather than a summary of one. Proposal [`0014`](../proposals/0014-a-feedback-pipe-points-out-of-the-seam.md)
> named this agreement — the field names the sender fills — as belonging "in a task when both halves
> are real". Both halves are real: the forms have been under `.github/ISSUE_TEMPLATE/` since milestone
> 7 session 0, and the sender is this task.

## The criterion, quoted rather than paraphrased

Row 7 of [`../../docs/plan.md`](../../docs/plan.md): the CLI ships **`feedback`, which files a GitHub
issue from a report the user previewed, under the Gated tier, seam-scanned before it leaves the
machine.** [`../../docs/vision.md`](../../docs/vision.md) glosses it identically, so nothing here needs
the constitution widened.

The demonstration is **D3**, pinned in [`../../docs/milestones/m07.md`](../../docs/milestones/m07.md):
*"`feedback` both ways: a send whose exact payload the user saw first, and a send a seam hit refused."*

## Why this is not a convenience feature

The maintainer ruled on 2026-07-27 that this repository accepts **no external pull requests** —
outside participation is proposals and feedback only. `.github/ISSUE_TEMPLATE/config.yml` turns blank
issues off, so the three forms are the whole intake vocabulary. This sender is therefore **the only
inbound path a user has that does not go through a browser**, and its quality sets the quality of what
arrives here.

## The one thing that can go wrong silently, and it points out of the seam

A feedback sender is a pipe from a **private** workspace into a **permanent public** record. The
workspace it sends from may be a company's — repo names, paths, product identifiers, gate maps,
memory. This repository's own Protocol → The seam exists because that leakage is unacceptable in the
other direction, and the sender points the same wall the other way.

So the payload is assembled from a **closed list of fields** rather than filtered after the fact:
the user's own words, a structured environment block, and nothing else. Not recipe *output*, which
carries paths and file contents. Not the workspace name, repo names, file paths, gate map, memory, git
remote or branch names.

**The term list never enters this product.** It is client-confidential by definition, so the sender is
*told where to find one* and never carries terms of its own.

## What already exists to build on

- `.github/ISSUE_TEMPLATE/{bug,improvement,feedback}.yml` — the three forms, with their labels,
  required flags, dropdown options and acknowledgement checkboxes.
- `cli/portulan.mjs` — the entry point, where `feedback` is listed with `module: null` and exits 2.
- `cli/plugin-lint.mjs`'s exported `parseFrontmatter`. _(**Overtaken by the implementation, recorded
  rather than edited away:** reusing it means importing a 74 KB module for four `key: value` lines, and
  the block being read is the block this tool wrote — so `feedback.mjs` reads its own frontmatter and
  says so at the function. A task records what was expected when it was written.)_
- `cli/recipe-set.live.test.mjs` — the shape for a rail that checks a shipped constant against the
  tree it mirrors.
- `.portulan/memory/verify-preconditions-fail-closed.md` — the three-code discipline this obeys.

## Done when

Each line is a test that fails before the change and passes after.

**The report is a file before it is a request.**
1. `draft <kind>` writes `<workspace>/feedback/<YYYY-MM-DD>-<slug>.md` with the chosen form's
   sections, its acknowledgement checkboxes unticked, and frontmatter carrying `kind`, `title` and
   `created`. It never writes over an existing report.
2. An unknown kind, a missing title, and a title that yields an empty slug each exit **2**, naming
   what is missing.

**The preview and the send are the same bytes because they are the same call.**
3. `preview <report>` prints the repository, the issue title, and the body between explicit markers,
   and the printed body is byte-identical to what `send` hands to `gh`.
4. A required section left empty, an unticked required acknowledgement, and a dropdown section that
   does not hold exactly one declared option each exit **2** and name the section.

**Gated means per action.**
5. `send` without `--approve` exits **2** and prints the preview instead of filing. Approval is never
   inherited from an earlier `draft` or `preview`.
6. A report that already carries `issue:` refuses a second send with **2** and the existing URL.
7. A send inside the cooldown window of the previous send in the same directory exits **2**.
8. `gh` absent, or present and unauthenticated, exits **2** and prints the exact command the user can
   run themselves. The report survives on disk.

**The seam scan, and where fail-closed sits.**
9. A term list is located as `--seam-terms <file>` → `$PORTULAN_SEAM_TERMS` → `<workspace>/seam-terms.txt`,
   and the verdict **names which of the three answered**.
10. A hit exits **1** — a verdict was rendered — naming the term and the section, and nothing is sent.
11. A list named by flag or env that cannot be read exits **2**. Nothing is sent.
12. At the convention path, **only `ENOENT` means absent**; any other error is a declared list that
    cannot be read and exits 2. (`existsSync` answers false for `EACCES`, which is how a layer at
    `0400` once skipped every location it declared — #166.)
13. With no list configured anywhere, the preview **and the send** both print *nothing was scanned*
    in the sentence the user approves. A green that states its own coverage, never a silent one.

**The payload carries what it says and nothing else.**
14. A workspace stuffed with identifying material — name, repo cards, a git remote, paths — yields a
    payload containing none of it.
15. No labels are sent: proposal `0014` rules that the repository owns its own labels, and the form's
    title prefix is what marks the kind.

**One carrier, and a rail on the pair it cannot avoid.**
16. A live test reads the real `.github/ISSUE_TEMPLATE/*.yml` and fails when the shipped field map
    disagrees with them in id, label, required flag, dropdown option or acknowledgement text.
17. The entry point dispatches `feedback` to the module and returns its code unchanged; the count of
    unbuilt subcommands drops to one and is derived rather than written down.

## Added during the session, on the pre-commit checkpoint's finding

Recorded here rather than folded into the list above, because a *Done when* list edited to match the
code it was meant to grade has stopped being a spec.

18. **`send` refuses any payload that does not match the one `preview` last showed.** The checkpoint
    found that *"a send whose exact payload the user saw first"* was a property of the **flow** and not
    of the mechanism: a never-previewed report filed sight-unseen, and a report edited between the two
    verbs filed bytes nobody had read. `preview` now stamps a digest and `send` compares it — including
    the machine facts, since they are in the payload.
19. **An empty `title:` is refused.** `draft` already refused an absent title, but the report is a file
    a human edits afterwards, and a blanked line filed as a bare `[feedback] `.

## What M7 still owes after this

`upgrade` · persona↔agent binding · the legibility score · clause (b) parity's adopter half
([#184](https://github.com/sleepy-panda-works/portulan/issues/184)) · `init`'s interview · the index
rail · and **three of six** demonstrations — D1, D2 and D5. D5 stays blocked on the feed pin, which is
the maintainer's act.
