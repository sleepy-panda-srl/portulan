# Handoff — a client name reached a public repository, and the rail that closed the session

**Session:** 2026-08-19, continuing after the release arc closed. Scope: *"build the current-version
rail. Last thing. I'm serious."* **No milestone row moves.**
[#309](https://github.com/sleepy-panda-srl/portulan/pull/309), merged as `8f2c0b6`.

## State

`main` = `8f2c0b6`. The rail is built, registered, and running in CI. **A client identifier is on
`main` in one commit message and is staying there on the maintainer's ruling** — see below.

## THE SEAM INCIDENT

**A client identifier from `../portulan-private/CONTEXT.md` reached this public repository**, in the
message of `a15dde4`, inside a sentence explaining that a *different* seam hit had been a false
positive. Message only: not in any tracked file, not in any line of code, repository public, zero
forks.

**How it got out.** The scan that would have caught it ran in the **same shell command** as the
`git push` that carried it. Its result could not reach the decision. This is recorded as its own rule
— [`../memory/a-gate-that-cannot-reach-the-act-is-a-report.md`](../memory/a-gate-that-cannot-reach-the-act-is-a-report.md)
— because the lesson is not "run the scan": the scan ran, fired correctly, and named the right token.

**Three seam-gate failures this session, two from this ordering, and the second happened after the
first was recorded and the ordering declared fixed.** Writing *"gated on before this commit"* in a
commit message is not gating.

**What caught it:** the at-the-act sweep before the merge — after the bytes were public. That is the
difference between a gate and a report, and the reason the merge sweep exists at all.

**The ruling.** Presented with three options — leave and record, rewrite `main`, or a support request
— the maintainer ruled **leave it and record it**. The cure was worse: rewriting a protected branch
breaks every clone, invalidates every SHA these records cite, and leaves the old objects reachable
until GitHub garbage-collects. **The record is the remediation**, which holds only because the
exposure is a directory name rather than data, a person, or a document.

_A branch with the name rewritten out was prepared and never pushed: the pull request had already
merged at the old head, so the push would have changed nothing and created a stale ref. Reported as a
no-op rather than run as one._

## The rail, and the five ways it could have lied

Built because a sibling list in prose is not a rail: `README.md` and `product.md` drifted from
`package.json` twice, with the pairing recorded both times.

**Every version I wrote unaided could report a false green. Four of the five were found by review.**

1. **The entry guard never ran here.** `import.meta.url` percent-encodes; this checkout's path has
   spaces; the tool exited 0 having run nothing and I read the 0 as green. The repository already
   documents this incident and names the correct form.
2. **A fail-open on an unreadable blob** — `git show :<path>` failing made the scan `continue`, so a
   file `ls-files` had just named could go unexamined under a green.
3. **`import.meta.dirname` is Node 20.11+** while `engines.node` says `>=20`: on an older runner the
   subprocess cases could not resolve the CLI, silencing the guard against silence.
4. **The version was read from the worktree while carriers were read from the index** — half of my own
   index fix, shipped as whole.
5. **The guard's regression test only worked on this machine.** It spaced the working directory, not
   the SCRIPT path the guard compares. This checkout's path has a space, so it passed here — and the
   mutation test I ran to *prove* it passed here too. In CI it would have caught nothing. The CLI is
   now copied into the spaced fixture; the broken guard fails six cases anywhere.

**Two hand-maintained counts came out of one documentation row**, an hour apart, the second because
fixing the fail-open added a case. A figure I got wrong twice while writing about getting figures
wrong is an argument against writing one.

## Open questions

- **Whether the deleted self-corrective notes return to the files.** Raised three times, undecided.
- **The seam scan as a hook that can refuse a push**, which is the only thing that retires the memory
  record above. Prose is what failed here.

## Next action

Nothing owed by this arc. The rail runs on every pull request from here.

## Recoverability

Nothing partial. The client name stays on `main` by ruling, recorded here and in the memory store.
